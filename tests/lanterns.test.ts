import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  BUILDER_DEFAULT_STORY,
  eveningDayAt,
  eveningMinutes,
  FORK_BOUNDS,
  FORK_ID,
  FORK_PLOT,
  FOUNDER_SLOTS,
  hasOwnStory,
  lampLightsAt,
  lampLit,
  lanternHourAt,
  lanternLit,
  lanternRegister,
  lanternsLit,
  taleOfTheEvening,
} from '../src/lib/lanterns';
import { eventsForDay, HOUSE_PLOTS, VENUES } from '../src/lib/events';
import { placeSchema } from '../src/lib/schema';
import { drawVenue, venueBounds } from '../src/city/venues';
import { townDayAt, townMinutesAt, TOWN_DAY_MS } from '../src/lib/town-time';
import { ARRIVALS, TOWN } from './lantern-town';

// Every house file, for checks that must hold however the town grows.
const everyHouse = readdirSync('places')
  .filter((name) => name.endsWith('.json'))
  .map((name) => placeSchema.parse(JSON.parse(readFileSync(`places/${name}`, 'utf8'))));
const places = TOWN;
const ORDER = [
  'after-hours',
  'evergreen',
  'hello-world',
  'little-workshop',
  'moonbeam-cafe',
  'plot-twist',
  'stargazer',
  'sunday-morning',
  'my-little-place',
  'funky-fun',
  'arts',
  'jons-arcade',
  'mulu-s',
  'moss-nook',
  'vaxsius-markus',
  'willow-lodge',
  'rehovot-orchard',
];
const DEFAULT_STORIES = ['arts', 'funky-fun', 'moss-nook', 'my-little-place', 'willow-lodge'];
const shuffled = <T>(items: readonly T[]) =>
  items
    .map((item, i) => ({ item, key: (i * 7919) % 31 }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
const neighbor = (id: string) => ({ id, creator: 'someone' });
const founder = (id: string) => ({ id, creator: 'forktown' });

describe('The lantern register', () => {
  it('numbers the real town in the order it moved in', () => {
    const register = lanternRegister(places, ARRIVALS);
    expect(register.entries.map((entry) => entry.id)).toEqual(ORDER);
    register.entries.forEach((entry, i) => {
      expect(entry.index).toBe(i);
      expect(entry.slot).toBe(i);
      expect(entry.number).toBe(i + 1);
      expect(entry.founding).toBe(i < FOUNDER_SLOTS);
      expect(register.byId.get(entry.id)).toBe(entry);
    });
    expect(register).toMatchObject({
      total: 17,
      founders: 8,
      neighbors: 9,
      ordered: true,
      newest: 'rehovot-orchard',
    });
    expect(register.byId.get('funky-fun')!.after).toBe('my-little-place');
    expect(register.byId.get('mulu-s')!.after).toBe('jons-arcade');
    expect(register.byId.get('my-little-place')!.after).toBeUndefined();
    expect(register.byId.get('sunday-morning')!.after).toBeUndefined();
  });

  it('is independent of input order and leaves its inputs alone', () => {
    const register = lanternRegister(places, ARRIVALS);
    const input = structuredClone(places);
    const arrivals = [...ARRIVALS];
    expect(lanternRegister([...input].reverse(), arrivals)).toEqual(register);
    expect(lanternRegister(shuffled(input), arrivals)).toEqual(register);
    expect(input).toEqual(structuredClone(places));
    expect(arrivals).toEqual(ARRIVALS);
    // Repeated ids in the history count once.
    expect(lanternRegister(places, [...ARRIVALS, 'arts', 'mulu-s'])).toEqual(register);
  });

  it('makes no claims without history', () => {
    const register = lanternRegister(places, []);
    expect(register.entries.slice(0, 8).map((entry) => entry.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    const neighbors = register.entries.slice(8);
    expect(neighbors.map((entry) => entry.id)).toEqual([...ORDER.slice(8)].sort());
    for (const entry of neighbors) {
      expect(entry.number).toBeUndefined();
      expect(entry.after).toBeUndefined();
    }
    expect(register.ordered).toBe(false);
    expect(register.newest).toBeUndefined();
    // A town of founders alone is fully ordered.
    expect(
      lanternRegister(
        places.filter((place) => place.creator === 'forktown'),
        [],
      ).ordered,
    ).toBe(true);
  });

  it('appends a neighbor missing from partial history without renumbering anyone', () => {
    const full = lanternRegister(places, ARRIVALS);
    const partial = lanternRegister(
      places,
      ARRIVALS.filter((id) => id !== 'rehovot-orchard'),
    );
    expect(partial.entries.slice(0, 16)).toEqual(full.entries.slice(0, 16));
    expect(partial.entries[16]).toEqual({
      id: 'rehovot-orchard',
      index: 16,
      slot: 16,
      founding: false,
    });
    expect(partial.ordered).toBe(false);
    expect(partial.newest).toBe('willow-lodge');
  });

  it('keeps every lantern in place as the town grows or loses a founder', () => {
    const today = lanternRegister(places, ARRIVALS);
    const tomorrow = lanternRegister(
      [...places, neighbor('new-house')],
      ['new-house', ...ARRIVALS],
    );
    expect(tomorrow.entries.slice(0, 17)).toEqual(today.entries);
    expect(tomorrow.entries[17]).toEqual({
      id: 'new-house',
      index: 17,
      slot: 17,
      founding: false,
      number: 18,
      after: 'rehovot-orchard',
    });
    expect(tomorrow.newest).toBe('new-house');

    const fewer = lanternRegister(
      places.filter((place) => place.id !== 'evergreen'),
      ARRIVALS,
    );
    for (const entry of fewer.entries.filter((entry) => !entry.founding))
      expect(entry.slot).toBe(today.byId.get(entry.id)!.slot);
    expect(fewer.founders).toBe(7);
  });

  it('gives every house in places/ exactly one lantern, founders first', () => {
    const register = lanternRegister(everyHouse, []);
    expect(register.total).toBe(everyHouse.length);
    expect(new Set(register.entries.map((entry) => entry.id)).size).toBe(everyHouse.length);
    const founders = everyHouse.filter((place) => place.creator === 'forktown').length;
    register.entries.forEach((entry, i) => {
      expect(entry.founding).toBe(i < founders);
      expect(entry.slot).toBe(entry.founding ? i : FOUNDER_SLOTS + i - founders);
    });
  });

  it('handles an empty town and a town of one neighbor', () => {
    expect(lanternRegister([], ARRIVALS)).toMatchObject({
      entries: [],
      total: 0,
      founders: 0,
      neighbors: 0,
      ordered: true,
      newest: undefined,
    });
    const one = lanternRegister([neighbor('solo'), founder('after-hours')], ['solo']);
    expect(one.entries).toEqual([
      { id: 'after-hours', index: 0, slot: 0, founding: true, number: 1 },
      { id: 'solo', index: 1, slot: FOUNDER_SLOTS, founding: false, number: 2 },
    ]);
  });
});

describe('Lantern hour', () => {
  it('lights one lantern a second from 20:00 until dawn', () => {
    for (const [minute, lit] of [
      [1199.999, 0],
      [1200, 1],
      [1215.999, 16],
      [1216, 17],
      [1439.999, 17],
      [0, 17],
      [359.999, 17],
      [360, 0],
    ])
      expect(lanternsLit(17, minute)).toBe(lit);
    expect(lanternsLit(152, 1219.9)).toBe(152);
    expect(lanternsLit(152, 1219.8)).toBeLessThan(152);
    expect(lanternsLit(1, 1200)).toBe(1);
    for (const minute of [0, 720, 1200, 1300]) expect(lanternsLit(0, minute)).toBe(0);
  });

  it('agrees with itself lantern by lantern and never goes out during the evening', () => {
    for (const total of [1, 17, 40, 152]) {
      let previous = 0;
      for (let k = 0; k < 200; k++) {
        const minute = 1190 + k * 0.25;
        const lit = lanternsLit(total, minute);
        for (let i = 0; i < total; i++) expect(lanternLit(i, total, minute)).toBe(i < lit);
        expect(lit).toBeGreaterThanOrEqual(previous);
        previous = lit;
      }
      // Across the whole evening timeline, 06:00 to 06:00.
      previous = 0;
      for (let evening = 360; evening < 1800; evening += 0.5) {
        const lit = lanternsLit(total, evening % 1440);
        expect(lit).toBeGreaterThanOrEqual(previous);
        previous = lit;
      }
    }
  });

  it('reads the same in every time zone and on every town day', () => {
    const instants = ['2026-09-24T00:20:05Z', '2026-09-24T05:50:05+05:30'].map(Date.parse);
    const readings = [...instants, instants[0] + 3 * TOWN_DAY_MS].map((stamp) => {
      const minutes = townMinutesAt(stamp);
      const day = townDayAt(stamp);
      return {
        lit: lanternsLit(17, minutes),
        hour: lanternHourAt(17, minutes),
        tale: taleOfTheEvening(places, eveningDayAt(minutes, day))?.placeId,
        offset: eveningDayAt(minutes, day) - day,
      };
    });
    expect(readings[0]).toMatchObject({ lit: 6, hour: { phase: 'lighting', lit: 6 } });
    expect(readings[1]).toEqual(readings[0]);
    // Three town days later the lights match; the tale has moved three evenings on.
    expect({ ...readings[2], tale: undefined }).toEqual({ ...readings[0], tale: undefined });
  });

  it('reports the phase, the countdown and the last lantern', () => {
    expect(lanternHourAt(17, 1193)).toEqual({
      phase: 'waiting',
      lit: 0,
      total: 17,
      startsIn: 7,
      lastLightsAt: 1216,
    });
    expect(lanternHourAt(17, 360).startsIn).toBe(840);
    expect(lanternHourAt(17, 1200)).toMatchObject({ phase: 'lighting', lit: 1, startsIn: 0 });
    expect(lanternHourAt(17, 1229.9).phase).toBe('lighting');
    expect(lanternHourAt(17, 1230)).toMatchObject({ phase: 'lit', lit: 17 });
    expect(lanternHourAt(17, 120).phase).toBe('lit');
    expect(lanternHourAt(152, 1300).lastLightsAt).toBeCloseTo(1200 + 151 * (20 / 152));
    expect(lanternHourAt(152, 1300).lastLightsAt).toBeLessThan(1220);
    expect(lanternHourAt(1, 1300).lastLightsAt).toBe(1200);
    expect(lanternHourAt(0, 1300)).toMatchObject({ lit: 0, total: 0, lastLightsAt: 1200 });
  });

  it('lights the lamps outward from the Fork after the lanterns', () => {
    expect(lampLightsAt(0, 20)).toBe(1220);
    expect(lampLightsAt(10, 20)).toBe(1225);
    expect(lampLightsAt(20, 20)).toBe(1230);
    expect(lampLightsAt(3, 0)).toBe(1220);
    expect(lampLit(0, 20, 1219.999)).toBe(false);
    expect(lampLit(0, 20, 1220)).toBe(true);
    expect(lampLit(20, 20, 1229.999)).toBe(false);
    expect(lampLit(20, 20, 1230)).toBe(true);
    expect(lampLit(20, 20, 300)).toBe(true);
    expect(lampLit(0, 20, 720)).toBe(false);
  });

  it('keeps the small hours with the evening before', () => {
    for (const [minute, day, evening] of [
      [0, 10, 9],
      [359.9, 10, 9],
      [360, 10, 10],
      [1439, 10, 10],
      [1500, 10, 10],
      [1800, 10, 11],
    ])
      expect(eveningDayAt(minute, day)).toBe(evening);
    expect(eveningMinutes(0)).toBe(1440);
    expect(eveningMinutes(359.9)).toBeCloseTo(1799.9);
    expect(eveningMinutes(360)).toBe(360);
    expect(eveningMinutes(-60)).toBe(1380);
  });
});

describe("Tonight's tale", () => {
  const tale = (minute: number, day: number) =>
    taleOfTheEvening(places, eveningDayAt(minute, day))?.placeId;

  it('tells only stories of their own', () => {
    expect(places.filter(hasOwnStory)).toHaveLength(12);
    for (const id of DEFAULT_STORIES)
      expect(hasOwnStory(places.find((place) => place.id === id)!)).toBe(false);
    expect(hasOwnStory({ story: `  ${BUILDER_DEFAULT_STORY}  ` })).toBe(false);
    expect(hasOwnStory({ story: 'Too short' })).toBe(false);
    const told = new Set(Array.from({ length: 60 }, (_, day) => tale(720, day)));
    for (const id of DEFAULT_STORIES) expect(told.has(id)).toBe(false);
  });

  it('only ever tells a real house its own story', () => {
    for (let day = 0; day < 40; day++) {
      const tonight = taleOfTheEvening(everyHouse, day);
      if (!tonight) continue;
      expect(hasOwnStory(everyHouse.find((place) => place.id === tonight.placeId)!)).toBe(true);
    }
  });

  it('is deterministic and independent of input order', () => {
    for (let day = 0; day < 30; day++) {
      const tonight = taleOfTheEvening(places, day);
      expect(tonight).toEqual({ placeId: expect.any(String), eveningDay: day, source: 'story' });
      expect(taleOfTheEvening([...places].reverse(), day)).toEqual(tonight);
      expect(taleOfTheEvening(shuffled(places), day)).toEqual(tonight);
    }
  });

  it('runs from 06:00 to 06:00', () => {
    for (let day = 0; day < 20; day++) {
      expect(tale(1439, day)).toBe(tale(1, day + 1));
      expect(tale(360, day)).toBe(tale(359.9, day + 1));
      expect(tale(360, day + 1)).not.toBe(tale(359.9, day + 1));
    }
  });

  it('gives every storied house one evening before any repeats', () => {
    for (const start of [-5, 0, 12, 400]) {
      const evenings = Array.from({ length: 12 }, (_, i) => taleOfTheEvening(places, start + i));
      expect(new Set(evenings.map((tonight) => tonight!.placeId)).size).toBe(12);
    }
    expect(taleOfTheEvening([], 3)).toBeUndefined();
    expect(
      taleOfTheEvening(
        places.filter((place) => !hasOwnStory(place)),
        3,
      ),
    ).toBeUndefined();
  });
});

describe('The Fork reserves D3', () => {
  it('keeps D3 free of houses and the venue order intact', () => {
    expect(HOUSE_PLOTS).toHaveLength(141);
    expect(HOUSE_PLOTS.some((plot) => plot.id === FORK_PLOT)).toBe(false);
    const sample = places.find((place) => place.id === 'my-little-place')!;
    const result = placeSchema.safeParse({ ...sample, plot: FORK_PLOT });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'This plot is reserved for a public town venue. Choose a house plot.',
    );
    expect(VENUES[0].id).toBe('green');
    expect(VENUES[1].id).toBe('stage');
    expect(VENUES.at(-1)).toEqual({
      id: FORK_ID,
      plot: FORK_PLOT,
      name: 'The Lantern Fork',
      kind: 'fork',
    });
    for (let day = 0; day <= 50; day++) {
      const events = eventsForDay(day);
      expect(events[0].venue.id).toBe('green');
      expect(events[1].venue.id).toBe('stage');
      expect(events.some((event) => event.venue.id === FORK_ID)).toBe(false);
    }
  });

  it('leaves the Fork to its own painter and hit area', () => {
    const fork = VENUES.find((venue) => venue.kind === 'fork')!;
    const calls: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_, key) => vi.fn(() => calls.push(String(key))),
        set: (_, key) => (calls.push(`set ${String(key)}`), true),
      },
    ) as unknown as CanvasRenderingContext2D;
    drawVenue(ctx, fork, 0, 0, false);
    drawVenue(ctx, fork, 0, 0, true, undefined, 1210, 'ground');
    expect(calls).toEqual([]);
    expect(venueBounds(fork)).toEqual(FORK_BOUNDS);
  });
});
