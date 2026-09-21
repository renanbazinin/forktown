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

const places = readdirSync('places')
  .filter((name) => name.endsWith('.json'))
  .map((name) => placeSchema.parse(JSON.parse(readFileSync(`places/${name}`, 'utf8'))));
const shotAt = (day: number, minute: number) =>
  liveShotAt(liveProgram(places, day), minute, simulateResidents(places, minute, day));

describe('Live broadcast director', () => {
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
});
