import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  easeLiveCamera,
  liveCamera,
  liveProgram,
  liveHighlights,
  liveShotAt,
  SCENERY_START,
  SCENERY_SECONDS,
  FOLLOW_SECONDS,
} from '../src/lib/live-director';
import { placeSchema } from '../src/lib/schema';
import { simulateResidents } from '../src/lib/simulation';
import { eventsForDay, isEventLive } from '../src/lib/events';
import { footballAt } from '../src/lib/football';
import { townCatAt } from '../src/lib/town-cat';
import { ducksAt } from '../src/lib/ducks';
import { isRoad, project } from '../src/lib/world';

const places = readdirSync('places')
  .filter((name) => name.endsWith('.json'))
  .map((name) => placeSchema.parse(JSON.parse(readFileSync(`places/${name}`, 'utf8'))));
const shotAt = (day: number, minute: number) =>
  liveShotAt(liveProgram(places, day), minute, simulateResidents(places, minute, day));

describe('Live broadcast director', () => {
  it('keeps the scenery window and films only selected events or eligible outdoor subjects', () => {
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
            if (shot.id.startsWith('postcard:')) {
              scenery++;
              expect(minute).toBeGreaterThanOrEqual(SCENERY_START);
              expect(minute).toBeLessThan(SCENERY_START + SCENERY_SECONDS);
            } else {
              expect(
                residents.some(
                  (resident) =>
                    resident.activity === 'stroll' && resident.event?.phase !== 'attending',
                ),
              ).toBe(false);
              expect(townCatAt(homes, minute, day).outside).toBe(false);
            }
          } else if (shot.kind === 'neighbor') {
            const subject = residents.find((r) => r.id === shot.residentId)!;
            expect(subject.activity).toBe('stroll');
            if (subject.event?.phase === 'attending') {
              const highlight =
                subject.event.id === 'football'
                  ? 'football'
                  : program.events.find((event) => event.id === subject.event?.id)!.period;
              expect(
                liveHighlights(highlight === 'night' && minute < 360 ? day - 1 : day),
              ).toContain(highlight);
            }
          } else if (shot.kind === 'event') {
            if (shot.id.startsWith('football:')) {
              expect(program.highlights).toContain('football');
              expect(footballAt(minute, day).live).toBe(true);
              expect(minute).toBeGreaterThanOrEqual(640);
              expect(minute).toBeLessThan(780);
            } else {
              const event = eventsForDay(day).find((event) => shot.id.endsWith(`:${event.id}`))!;
              expect(event).toBeDefined();
              expect(
                liveHighlights(event.period === 'night' && minute < 360 ? day - 1 : day),
              ).toContain(event.period);
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
          } else if (shot.kind === 'ducks') {
            expect(program.highlights).toContain('ducks');
            expect(ducksAt(minute).length).toBeGreaterThan(0);
            expect(minute).toBeGreaterThanOrEqual(600);
            expect(minute).toBeLessThan(640);
          } else {
            expect(shot.kind).toBe('cat');
            expect(townCatAt(homes, minute, day).outside).toBe(true);
          }
        }
        expect(scenery).toBe(60);
      }
    }
  });

  it('chooses three varied highlights each day, with no always-on ducks or disco', () => {
    const lineups = new Set<string>();
    for (let day = 0; day < 30; day++) {
      const highlights = liveHighlights(day);
      expect(new Set(highlights).size).toBe(3);
      expect(liveHighlights(day)).toEqual(highlights);
      lineups.add([...highlights].sort().join(','));
      for (const [highlight, minute] of [
        ['ducks', 620],
        ['football', 700],
        ['afternoon', 800],
        ['evening', 1200],
        ['night', 1420],
      ] as const) {
        const shot = shotAt(day, minute);
        expect(shot.kind === 'event' || shot.kind === 'ducks').toBe(highlights.includes(highlight));
      }
    }
    expect(lineups.size).toBeGreaterThanOrEqual(7);
    for (const highlight of ['ducks', 'football', 'afternoon', 'evening', 'night'] as const) {
      const count = Array.from({ length: 30 }, (_, day) =>
        liveHighlights(day).includes(highlight),
      ).filter(Boolean).length;
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(30);
    }
  });

  it('follows people between highlights and holds the full selected football match', () => {
    expect(shotAt(12, 420).kind).toBe('neighbor');
    expect(shotAt(12, 1000).kind).toBe('neighbor');
    const day = Array.from({ length: 30 }, (_, day) => day).find((day) =>
      liveHighlights(day).includes('football'),
    )!;
    for (const minute of [640, 700, 779.9]) expect(shotAt(day, minute).id).toContain('football:');
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

  it('reshuffles the people followed across days and gives each available neighbor screen time', () => {
    const homes = places.slice(0, 3).map((home) => ({
      ...home,
      resident: {
        ...home.resident,
        routine: { morning: 'stroll', afternoon: 'home', evening: 'home', night: 'sleep' } as const,
      },
    }));
    const sequences = new Set<string>();
    for (let day = 0; day < 30; day++) {
      if (!liveHighlights(day).includes('football')) continue;
      const program = liveProgram(homes, day);
      const ids = Array.from({ length: 6 }, (_, index) => {
        const time = 360 + index * FOLLOW_SECONDS;
        return liveShotAt(program, time, simulateResidents(homes, time, day)).residentId!;
      });
      expect(new Set(ids).size).toBe(homes.length);
      for (const home of homes) expect(ids.filter((id) => id === home.id)).toHaveLength(2);
      sequences.add(ids.join(','));
    }
    expect(sequences.size).toBeGreaterThanOrEqual(6);
  });

  it('shares 45-second clips among outdoor neighbors, including spectators instead of repeating a lone walker', () => {
    const homes = places.slice(0, 3).map((home) => ({
      ...home,
      resident: {
        ...home.resident,
        routine: {
          morning: 'stroll',
          afternoon: 'stroll',
          evening: 'stroll',
          night: 'sleep',
        } as const,
      },
    }));
    for (const day of Array.from({ length: 10 }, (_, day) => day).filter((day) =>
      liveHighlights(day).includes('football'),
    )) {
      const program = liveProgram(homes, day);
      const featured: string[] = [];
      for (let time = 360; time < 585; time += FOLLOW_SECONDS) {
        const residents = simulateResidents(homes, time, day);
        if (time >= 450)
          expect(residents.filter((r) => r.event?.phase !== 'attending')).toHaveLength(1);
        const shot = liveShotAt(program, time, residents);
        expect(shot.kind).toBe('neighbor');
        expect(shot.residentId).not.toBe(featured.at(-1));
        featured.push(shot.residentId!);
        for (const offset of [0.1, 20, FOLLOW_SECONDS - 0.01]) {
          expect(
            liveShotAt(program, time + offset, simulateResidents(homes, time + offset, day))
              .residentId,
          ).toBe(shot.residentId);
        }
        expect(liveShotAt(program, time, [...residents].reverse())).toEqual(shot);
      }
      expect(new Set(featured).size).toBe(3);
    }
  });

  it('rotates replacements too, and keeps an only available resident on screen', () => {
    const homes = places.slice(0, 4).map((home) => ({
      ...home,
      resident: {
        ...home.resident,
        routine: {
          morning: 'stroll',
          afternoon: 'stroll',
          evening: 'home',
          night: 'sleep',
        } as const,
      },
    }));
    const program = liveProgram(homes, 12);
    const replacements = new Set<string>();
    for (let time = 450; time < 585; time += FOLLOW_SECONDS) {
      const residents = simulateResidents(homes, time, 12);
      const original = liveShotAt(program, time, residents);
      const remaining = residents
        .filter((r) => r.id !== original.residentId)
        .map((r) => ({ ...r, event: undefined }));
      const replacement = liveShotAt(program, time, remaining);
      expect(replacement.kind).toBe('neighbor');
      expect(replacement.residentId).not.toBe(original.residentId);
      replacements.add(replacement.residentId!);
      expect(liveShotAt(program, time, [remaining[0]]).residentId).toBe(remaining[0].id);
    }
    expect(replacements.size).toBeGreaterThan(1);
  });

  it('keeps both selected and skipped parties consistent across midnight', () => {
    for (let day = 0; day < 10; day++) {
      const selected = liveHighlights(day).includes('night');
      const before = shotAt(day, 1439.9);
      const after = shotAt(day + 1, 0);
      expect(before.kind === 'event').toBe(selected);
      expect(after.kind === 'event').toBe(selected);
      expect(shotAt(day + 1, 149.9).kind === 'event').toBe(selected);
      if (selected) expect(before).toEqual(after);
    }
    expect(shotAt(3, 160).kind).toBe('neighbor');
    expect(shotAt(3, 290).kind).toBe('cat');
  });

  it('frames the whole duck family on selected days and ends its clip on time', () => {
    const day = Array.from({ length: 30 }, (_, day) => day).find((day) =>
      liveHighlights(day).includes('ducks'),
    )!;
    for (const homes of [places, []]) {
      const program = liveProgram(homes, day);
      for (let minute = 600; minute < 640; minute += 0.5) {
        const shot = liveShotAt(program, minute, simulateResidents(homes, minute, day));
        expect(shot.kind).toBe('ducks');
        for (const [width, height] of [
          [1920, 900],
          [390, 844],
        ]) {
          const camera = liveCamera(shot, width, height, minute);
          expect(camera).toEqual(liveCamera(shot, width, height));
          for (const duck of ducksAt(minute)) {
            const point = project(duck.position.x, duck.position.y);
            expect(point.x * camera.zoom + camera.x).toBeGreaterThan(20);
            expect(point.x * camera.zoom + camera.x).toBeLessThan(width - 20);
            expect(point.y * camera.zoom + camera.y).toBeGreaterThan(30);
            expect(point.y * camera.zoom + camera.y).toBeLessThan(height - 20);
          }
        }
      }
      expect(liveShotAt(program, 640, []).kind).not.toBe('ducks');
    }
  });

  it('keeps the cat on the street, visible during scenery, and continuous across midnight', () => {
    for (const homes of [places, [], [places[0]]]) {
      const program = liveProgram(homes, 12);
      for (let minute = 0; minute < 1440; minute += 0.5) {
        const cat = townCatAt(homes, minute, 12);
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
      const before = townCatAt(homes, 1439.999, 12).position;
      const after = townCatAt(homes, 0, 13).position;
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
