import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  easeLiveCamera,
  liveCamera,
  liveFeature,
  liveProgram,
  liveShotAt,
} from '../src/lib/live-director';
import { placeSchema } from '../src/lib/schema';
import { simulateResidents } from '../src/lib/simulation';
import { getPlot, plotCenter } from '../src/lib/world';

const places = readdirSync('places')
  .filter((name) => name.endsWith('.json'))
  .map((name) => placeSchema.parse(JSON.parse(readFileSync(`places/${name}`, 'utf8'))));
const shotAt = (day: number, minute: number) =>
  liveShotAt(liveProgram(places, day), minute, simulateResidents(places, minute, day));

describe('Live broadcast director', () => {
  it('keeps every postcard centered on an occupied home, including a sparse town', () => {
    const sparse = [
      { ...places[0], plot: 'A1' },
      { ...places[1], plot: 'J10' },
    ];
    for (const homes of [places, sparse, [places[0]]]) {
      const seen = new Set<string>();
      for (let day = 0; day < 8; day++) {
        const program = liveProgram(homes, day);
        for (let minute = 0; minute < 1440; minute += 30) {
          const shot = liveShotAt(program, minute, []);
          if (shot.kind === 'event') continue;
          expect(shot.kind).toBe('home');
          const home = homes.find((place) => place.name === shot.label)!;
          expect(home).toBeDefined();
          seen.add(home.id);
          const center = plotCenter(getPlot(home.plot)!);
          for (const [width, height] of [
            [1920, 900],
            [390, 844],
          ]) {
            const camera = liveCamera(shot, width, height);
            const x = center.x * camera.zoom + camera.x;
            const y = (center.y - 40) * camera.zoom + camera.y;
            expect(x).toBeCloseTo(width / 2);
            expect(y).toBeCloseTo(height / 2);
          }
          expect(liveCamera(shot, 1920, 900).zoom).toBeGreaterThanOrEqual(2);
        }
      }
      expect(seen.size).toBe(homes.length);
    }
  });

  it('films a public landmark instead of empty terrain when there are no homes', () => {
    const shot = liveShotAt(liveProgram([], 0), 360, []);
    expect(shot.kind).toBe('venue');
    expect(shot.label).toBe('The Little Stage');
  });

  it('casts the same neighbor regardless of input order or reload, and follows for three real minutes', () => {
    const program = liveProgram(places, 12);
    expect(program.neighborId).toBeTruthy();
    expect(liveProgram([...places].reverse(), 12)).toEqual(program);
    for (const minute of [450, 510, 570, 629.9]) {
      const shot = shotAt(12, minute);
      expect(shot.kind).toBe('neighbor');
      expect(shot.residentId).toBe(program.neighborId);
    }
    expect(shotAt(12, 449.9).kind).not.toBe('neighbor');
    expect(shotAt(12, 630).kind).not.toBe('neighbor');
    expect(
      new Set(Array.from({ length: 30 }, (_, day) => liveProgram(places, day).neighborId)).size,
    ).toBeGreaterThan(1);
  });

  it('covers every available event type over time, only during its scheduled feature', () => {
    const featured = new Set<string>();
    for (let day = 0; day < 100; day++) {
      const feature = liveFeature(day);
      featured.add(feature.id);
      for (const time of [feature.start, (feature.start + feature.end) / 2, feature.end - 0.1]) {
        const shot = shotAt(day + Math.floor(time / 1440), time % 1440);
        expect(shot.kind).toBe('event');
        expect(shot.id).toBe(`event:${day}:${feature.id}`);
      }
      for (let time = 360; time < 1440; time += 15) {
        if (time < feature.start || time >= feature.end)
          expect(shotAt(day, time).kind).not.toBe('event');
      }
    }
    expect([...featured].sort()).toEqual([
      'acoustic',
      'books',
      'football',
      'games',
      'jazz',
      'night-party',
      'picnic',
      'rock',
    ]);
  });

  it('keeps the midnight party framed across the day boundary, then releases it at 02:30', () => {
    expect(shotAt(2, 1439.9)).toEqual(shotAt(3, 0));
    expect(shotAt(3, 149.9).kind).toBe('event');
    expect(shotAt(3, 150).kind).not.toBe('event');
  });

  it('has valid framing all day, including empty towns and portrait screens', () => {
    for (const homes of [
      places,
      [],
      places.map((p) => ({
        ...p,
        resident: {
          ...p.resident,
          routine: { morning: 'home', afternoon: 'home', evening: 'home', night: 'sleep' } as const,
        },
      })),
    ]) {
      const program = liveProgram(homes, 4);
      for (let minute = 0; minute < 1440; minute += 30) {
        const shot = liveShotAt(program, minute, simulateResidents(homes, minute, 4));
        for (const [width, height] of [
          [1920, 1080],
          [390, 844],
        ]) {
          const camera = liveCamera(shot, width, height);
          expect(Object.values(camera).every(Number.isFinite)).toBe(true);
          expect(camera.zoom).toBeGreaterThan(0);
          expect(shot.center.x * camera.zoom + camera.x).toBeCloseTo(width / 2);
          expect(shot.center.y * camera.zoom + camera.y).toBeCloseTo(height / 2);
        }
      }
    }
  });

  it('eases camera changes without overshoot and independently of frame rate', () => {
    const from = { x: 0, y: 40, zoom: 0.5 },
      to = { x: 900, y: -100, zoom: 1.5 };
    const next = easeLiveCamera(from, to, 1);
    expect(next.x).toBeGreaterThan(from.x);
    expect(next.x).toBeLessThan(to.x);
    let stepped = from;
    for (let i = 0; i < 30; i++) stepped = easeLiveCamera(stepped, to, 1 / 30);
    expect(stepped.x).toBeCloseTo(next.x);
    expect(stepped.zoom).toBeCloseTo(next.zoom);
  });

  it('adds gentle motion to held shots while keeping the entire subject framed', () => {
    const shots = [
      shotAt(0, 360),
      liveShotAt(liveProgram([], 0), 360, []),
      ...[0, 1, 2, 3].map((day) => shotAt(day, liveFeature(day).start)),
    ];
    for (const shot of shots) {
      for (const [width, height] of [
        [1920, 900],
        [390, 844],
        [844, 390],
      ]) {
        const base = liveCamera(shot, width, height);
        const later = liveCamera(shot, width, height, 22.5);
        expect(later.zoom).toBeGreaterThan(base.zoom);
        expect(later.x + shot.center.x * later.zoom).toBeGreaterThan(width / 2);
        for (let second = 0; second <= 1440; second++) {
          const camera = liveCamera(shot, width, height, second);
          expect(camera.zoom).toBeGreaterThanOrEqual(base.zoom);
          expect(camera.zoom).toBeLessThanOrEqual(base.zoom * 1.04);
          const x = camera.x + shot.center.x * camera.zoom;
          const y = camera.y + shot.center.y * camera.zoom;
          expect(x - (shot.width * camera.zoom) / 2).toBeGreaterThan(0);
          expect(x + (shot.width * camera.zoom) / 2).toBeLessThan(width);
          expect(y - (shot.height * camera.zoom) / 2).toBeGreaterThan(0);
          expect(y + (shot.height * camera.zoom) / 2).toBeLessThan(height);
        }
      }
    }
  });

  it('keeps motion continuous at midnight and leaves resident tracking alone', () => {
    const before = liveCamera(shotAt(2, 1439.999), 1920, 1080, 1439.999);
    const after = liveCamera(shotAt(3, 0), 1920, 1080, 0);
    expect(Math.abs(before.x - after.x)).toBeLessThan(0.01);
    expect(Math.abs(before.zoom - after.zoom)).toBeLessThan(0.00001);
    const neighbor = shotAt(12, 510);
    expect(neighbor.kind).toBe('neighbor');
    expect(liveCamera(neighbor, 1920, 1080, 35)).toEqual(liveCamera(neighbor, 1920, 1080));
  });
});
