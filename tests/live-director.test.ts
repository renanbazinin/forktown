import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  easeLiveCamera,
  liveCamera,
  liveProgram,
  liveShotAt,
  SCENERY_START,
  SCENERY_SECONDS,
} from '../src/lib/live-director';
import { placeSchema } from '../src/lib/schema';
import { simulateResidents } from '../src/lib/simulation';
import { eventsForDay, isEventLive } from '../src/lib/events';
import { footballAt } from '../src/lib/football';
import { townCatAt } from '../src/lib/town-cat';
import { isRoad, project } from '../src/lib/world';

const places = readdirSync('places')
  .filter((name) => name.endsWith('.json'))
  .map((name) => placeSchema.parse(JSON.parse(readFileSync(`places/${name}`, 'utf8'))));
const shotAt = (day: number, minute: number) =>
  liveShotAt(liveProgram(places, day), minute, simulateResidents(places, minute, day));

describe('Live broadcast director', () => {
  it('limits scenery to exactly 60 seconds and films actual outdoor activity for the rest of each day', () => {
    const sleepers = places.map((p) => ({
      ...p,
      resident: {
        ...p.resident,
        routine: { morning: 'home', afternoon: 'home', evening: 'home', night: 'sleep' } as const,
      },
    }));
    for (const homes of [places, sleepers, [], [places[0]]]) {
      for (let day = 0; day < 4; day++) {
        const program = liveProgram(homes, day);
        let scenery = 0;
        for (let minute = 0; minute < 1440; minute++) {
          const residents = simulateResidents(homes, minute, day);
          const shot = liveShotAt(program, minute, residents);
          if (shot.kind === 'home') {
            scenery++;
            expect(minute).toBeGreaterThanOrEqual(SCENERY_START);
            expect(minute).toBeLessThan(SCENERY_START + SCENERY_SECONDS);
          } else if (shot.kind === 'neighbor') {
            expect(residents.find((r) => r.id === shot.residentId)?.activity).toBe('stroll');
          } else if (shot.kind === 'event') {
            if (shot.id.startsWith('football:')) expect(footballAt(minute, day).live).toBe(true);
            else {
              const event = eventsForDay(day).find((event) => shot.id.endsWith(`:${event.id}`))!;
              expect(event).toBeDefined();
              expect(isEventLive(event, minute)).toBe(true);
              if (event.venue.kind === 'green')
                expect(
                  residents.some(
                    (r) =>
                      r.activity === 'stroll' &&
                      r.event?.id === event.id &&
                      r.event.phase === 'attending',
                  ),
                ).toBe(true);
            }
          } else expect(shot.kind).toBe('cat');
        }
        expect(scenery).toBe(60);
      }
    }
  });

  it('prefers each live gathering, follows people outside the old morning window, and stays for a full match', () => {
    for (const minute of [100, 800, 1200, 1420]) expect(shotAt(12, minute).kind).toBe('event');
    expect(shotAt(12, 420).kind).toBe('neighbor');
    expect(shotAt(12, 1000).kind).toBe('neighbor');
    for (const minute of [640, 700, 779.9]) expect(shotAt(12, minute).id).toContain('football:');
    expect(shotAt(12, 299.99).kind).not.toBe('home');
    expect(shotAt(12, 300).kind).toBe('home');
    expect(shotAt(12, 359.99).kind).toBe('home');
    expect(shotAt(12, 360).kind).not.toBe('home');
  });

  it('keeps casting deterministic and switches away from a resident who goes indoors', () => {
    const program = liveProgram(places, 12);
    expect(liveProgram([...places].reverse(), 12)).toEqual(program);
    const residents = simulateResidents(places, 510, 12);
    const shot = liveShotAt(program, 510, residents);
    expect(shot.kind).toBe('neighbor');
    const indoors = residents.map((r) =>
      r.id === shot.residentId ? { ...r, activity: 'sleep' as const } : r,
    );
    expect(liveShotAt(program, 510, indoors).residentId).not.toBe(shot.residentId);
  });

  it('keeps the party continuous at midnight and follows its guests home afterward', () => {
    expect(shotAt(2, 1439.9)).toEqual(shotAt(3, 0));
    expect(shotAt(3, 149.9).kind).toBe('event');
    expect(shotAt(3, 160).kind).toBe('neighbor');
    expect(shotAt(3, 290).kind).toBe('cat');
  });

  it('keeps the cat on the street, visible during scenery, and continuous across midnight', () => {
    for (const homes of [places, [], [places[0]]]) {
      const program = liveProgram(homes, 12);
      for (let minute = 0; minute < 1440; minute += 0.5) {
        const cat = townCatAt(homes, minute);
        expect(isRoad(Math.floor(cat.position.x), Math.floor(cat.position.y))).toBe(true);
        if (minute >= 300 && minute < 360) {
          const shot = liveShotAt(program, minute, []);
          const point = project(cat.position.x, cat.position.y);
          for (const [width, height] of [
            [1920, 900],
            [390, 844],
          ]) {
            const camera = liveCamera(shot, width, height, minute);
            expect(point.x * camera.zoom + camera.x).toBeGreaterThan(20);
            expect(point.x * camera.zoom + camera.x).toBeLessThan(width - 20);
            expect(point.y * camera.zoom + camera.y).toBeGreaterThan(20);
            expect(point.y * camera.zoom + camera.y).toBeLessThan(height - 20);
          }
        }
      }
      const before = townCatAt(homes, 1439.999).position;
      const after = townCatAt(homes, 0).position;
      expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(0.001);
    }
  });

  it('keeps subjects framed during gentle drift and leaves people and cat tracking alone', () => {
    for (const minute of [100, 320, 650, 800, 1200]) {
      const shot = shotAt(12, minute);
      for (const [width, height] of [
        [1920, 900],
        [390, 844],
        [844, 390],
      ]) {
        const base = liveCamera(shot, width, height);
        for (let second = 0; second < 1440; second += 5) {
          const camera = liveCamera(shot, width, height, second);
          const x = camera.x + shot.center.x * camera.zoom,
            y = camera.y + shot.center.y * camera.zoom;
          expect(camera.zoom).toBeGreaterThanOrEqual(base.zoom);
          expect(camera.zoom).toBeLessThanOrEqual(base.zoom * 1.04);
          expect(x - (shot.width * camera.zoom) / 2).toBeGreaterThan(0);
          expect(x + (shot.width * camera.zoom) / 2).toBeLessThan(width);
          expect(y - (shot.height * camera.zoom) / 2).toBeGreaterThan(0);
          expect(y + (shot.height * camera.zoom) / 2).toBeLessThan(height);
        }
      }
    }
    for (const minute of [290, 510]) {
      const shot = shotAt(12, minute);
      expect(['cat', 'neighbor']).toContain(shot.kind);
      expect(liveCamera(shot, 1920, 1080, 35)).toEqual(liveCamera(shot, 1920, 1080));
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
