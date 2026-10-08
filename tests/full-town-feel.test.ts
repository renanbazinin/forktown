// How the full town feels on its busiest days: with every house plot taken,
// walkers who share a street are drawn side by side, never as one figure for long; nobody jumps
// further in a sample than a brisk walk (or the tube); greetings never talk over each other at
// the Riverside's busy gates; nobody turns about in a frame at the Harvest Fair or the Long
// Table; and a frame of the whole town stays cheap. One pass over each day's frames serves the
// side-by-side, teleport and greeting checks.
import { beforeAll, describe, expect, it } from 'vitest';
import { residentGround } from '../src/lib/lanes';
import { residentTrips, tripState } from '../src/lib/resident-trips';
import type { Place } from '../src/lib/schema';
import { GREETING_MINUTES, simulateResidents, type ResidentState } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY, townCalendarAt } from '../src/lib/town-calendar';
import { tubeStation } from '../src/lib/tubes';
import { MAX_TRAVEL_SPEED_MULTIPLIER, WALK_SPEED } from '../src/lib/walking';
import { project, type Point } from '../src/lib/world';
import { TOWNS } from './district';
import { rosterTimeout } from './roster-timeout';
import { stepBound } from './tube-riders';

const town: Place[] = TOWNS.full;
/** A day of the third town year, the trip-routes test's year: `date` of `season`. */
const dayOf = (season: string, date: number) => {
  for (let day = CALENDAR_EPOCH_DAY + 224; ; day++) {
    const calendar = townCalendarAt(day);
    if (calendar.season === season && calendar.date === date) return day;
  }
};
/**
 * The days: a new-moon night, the regatta's first day, the Harvest Fair's, a skating and
 * snowmen day, and Spring 3, where a fan and a stroller once walked as one figure at the pitch
 * gate. Measured with everyone's lanes planned together, stuck pairs both at once (the branch's
 * 30 houses and a made-up one on every free plot): fused 0.8, 1.0, 1.0, 1.2, 1.2; stacked 1.6,
 * 1.6, 1.4, 1.8, 1.8; close/together 0.016 over the five.
 */
const SPRING_1 = dayOf('Spring', 1),
  SUMMER_10 = dayOf('Summer', 10),
  AUTUMN_23 = dayOf('Autumn', 23),
  WINTER_11 = dayOf('Winter', 11),
  SPRING_3 = dayOf('Spring', 3);
const SIDE_DAYS = [SPRING_1, SUMMER_10, AUTUMN_23, WINTER_11, SPRING_3];
const FESTIVAL_DAYS = [SPRING_1, SUMMER_10, AUTUMN_23, WINTER_11];
const GREETING_DAYS = [SUMMER_10, AUTUMN_23];
const STEP = 0.2;
/** The Riverside's busiest ways in: the market's two gates, L15's door, the Bandstand's two ways
 * in and the two farm gates. */
const BUSY: Point[] = [
  { x: 61.5, y: 15.5 },
  { x: 55.5, y: 21.5 },
  tubeStation('L15').door,
  { x: 59.5, y: 45.5 },
  { x: 61.5, y: 45.5 },
  { x: 13.5, y: 75.5 },
  { x: 13.5, y: 79.5 },
];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

type DayWalk = {
  together: number;
  close: number;
  longest: { fused: number; stacked: number };
  longestAt: { fused: string; stacked: string };
  jumps: string[];
  steps: number;
  overlaps: string[];
  spells: number[];
  nearBusy: number;
};
const walks = new Map<number, DayWalk>();
/** One pass over a day's frames, 06:00 to 06:00 every 0.2 town minutes. */
function walkDay(day: number): DayWalk {
  const result: DayWalk = {
    together: 0,
    close: 0,
    longest: { fused: 0, stacked: 0 },
    longestAt: { fused: '', stacked: '' },
    jumps: [],
    steps: 0,
    overlaps: [],
    spells: [],
    nearBusy: 0,
  };
  const runs = { fused: new Map<string, number>(), stacked: new Map<string, number>() };
  const since = new Map<string, number>();
  const greetings = GREETING_DAYS.includes(day);
  let previous: ResidentState[] | undefined;
  for (let minute = 360; minute < 1800; minute += STEP) {
    const states = simulateResidents(town, minute % 1440, day + Math.floor(minute / 1440));
    // Side by side, as trip-routes measures it.
    const walkers = states.filter(
      (state) =>
        state.activity === 'stroll' && state.moving && !state.transit && state.fade === undefined,
    );
    const drawn = walkers.map((state) => {
      const ground = residentGround(state);
      return { x: (ground.x - ground.y) * 38, y: (ground.x + ground.y) * 19 };
    });
    const now = { fused: new Set<string>(), stacked: new Set<string>() };
    for (let i = 0; i < walkers.length; i++)
      for (let j = i + 1; j < walkers.length; j++) {
        const a = walkers[i],
          b = walkers[j];
        if (a.facing !== b.facing) continue;
        const x = Math.abs(drawn[i].x - drawn[j].x),
          y = Math.abs(drawn[i].y - drawn[j].y);
        if (distance(a.position, b.position) < 0.2) {
          result.together++;
          if (x < 8 && y < 8) result.close++;
        }
        const key = `${a.id}&${b.id}`;
        for (const [kind, over] of [
          ['fused', x < 6 && y < 12],
          ['stacked', x < 7 && y < 22],
        ] as const) {
          if (!over) continue;
          now[kind].add(key);
          const run = (runs[kind].get(key) ?? 0) + STEP;
          runs[kind].set(key, run);
          if (run > result.longest[kind]) {
            result.longest[kind] = run;
            result.longestAt[kind] = `${key}, day ${day}, ending at ${minute.toFixed(2)}`;
          }
        }
      }
    for (const kind of ['fused', 'stacked'] as const)
      for (const key of [...runs[kind].keys()]) if (!now[kind].has(key)) runs[kind].delete(key);
    // No teleports: a brisk walk at most between samples, or the tube's own speed.
    if (previous && FESTIVAL_DAYS.includes(day))
      states.forEach((state, index) => {
        const before = previous![index];
        result.steps++;
        const step = distance(state.position, before.position);
        const bound = stepBound(
          state,
          before,
          STEP,
          WALK_SPEED * MAX_TRAVEL_SPEED_MULTIPLIER * STEP + 1e-9,
        );
        if (step > bound && result.jumps.length < 5)
          result.jumps.push(`${state.id} on ${day} at ${minute.toFixed(1)}: ${step.toFixed(3)}`);
      });
    previous = states;
    // Greetings: no bubble over another, and each said for a whole spell.
    if (!greetings) continue;
    const talking = states.filter((state) => state.greeting);
    const bubble = (state: ResidentState) => {
      const at = project(state.position.x, state.position.y);
      // Sized by simulation.ts's own rule: a wide glyph (emoji, CJK) is 12 px, by code point.
      let width = 12;
      for (const char of state.resident.greeting)
        width += char.codePointAt(0)! < 0x2000 ? 6.12 : 12;
      const half = (width * 1.25) / 2;
      return { left: at.x - half, right: at.x + half, top: at.y - 57.5 };
    };
    for (let i = 0; i < talking.length; i++) {
      if (BUSY.some((point) => distance(point, talking[i].position) < 3)) result.nearBusy++;
      for (let j = i + 1; j < talking.length; j++) {
        const a = bubble(talking[i]),
          b = bubble(talking[j]);
        if (a.left < b.right && b.left < a.right && Math.abs(a.top - b.top) < 20)
          result.overlaps.push(`${talking[i].id} & ${talking[j].id} on ${day} at ${minute}`);
      }
    }
    for (const state of states) {
      const started = since.get(state.id);
      if (state.greeting && started === undefined) since.set(state.id, minute);
      if (!state.greeting && started !== undefined) {
        result.spells.push(minute - started);
        since.delete(state.id);
      }
    }
  }
  return result;
}
const walked = (day: number) => {
  let result = walks.get(day);
  if (!result) walks.set(day, (result = walkDay(day)));
  return result;
};

beforeAll(
  () => {
    for (const day of SIDE_DAYS) walked(day);
  },
  rosterTimeout(1.3, 300_000),
);

describe('The full town on its busiest days', () => {
  it(
    'draws neighbors who walk together side by side, not as one figure',
    () => {
      let together = 0,
        close = 0;
      for (const day of SIDE_DAYS) {
        const { longest, longestAt, ...counts } = walked(day);
        together += counts.together;
        close += counts.close;
        // Under two minutes as one figure, under three one head over the other, every day.
        expect(longest.fused, longestAt.fused).toBeLessThan(2);
        expect(longest.stacked, longestAt.stacked).toBeLessThan(3);
      }
      expect(together).toBeGreaterThan(1000);
      expect(close / together).toBeLessThan(0.1);
    },
    rosterTimeout(0.5, 120_000),
  );

  it(
    'moves nobody further between samples than a brisk walk, or the tube',
    () => {
      for (const day of FESTIVAL_DAYS) {
        const { jumps, steps } = walked(day);
        expect(jumps).toEqual([]);
        expect(steps).toBeGreaterThan(1_000_000);
      }
    },
    rosterTimeout(0.5, 120_000),
  );

  it(
    'keeps greetings apart at the Riverside’s busy gates, each said for its whole spell',
    () => {
      let spells = 0,
        nearBusy = 0;
      for (const day of GREETING_DAYS) {
        const walk = walked(day);
        expect(walk.overlaps.slice(0, 5)).toEqual([]);
        for (const length of walk.spells)
          expect(length).toBeGreaterThan(GREETING_MINUTES - STEP - 1e-6);
        spells += walk.spells.length;
        nearBusy += walk.nearBusy;
      }
      expect(spells).toBeGreaterThan(100);
      expect(nearBusy).toBeGreaterThan(0);
    },
    rosterTimeout(0.3, 60_000),
  );

  it(
    'turns through a quarter at the fair and the table, never about in a frame',
    () => {
      const opposite = { se: 'nw', nw: 'se', sw: 'ne', ne: 'sw' } as const;
      let frames = 0,
        guests = 0;
      for (const day of [AUTUMN_23, AUTUMN_23 + 1, AUTUMN_23 + 2])
        for (const [id, trips] of residentTrips(town, day)) {
          const home = town.find((place) => place.id === id)!;
          for (const trip of trips) {
            if (trip.event.outing !== 'harvest-fair' && trip.event.outing !== 'long-table')
              continue;
            guests++;
            for (const [from, to] of [
              [trip.arrive - 0.3, trip.arrive + 0.5],
              [trip.leave - 0.6, trip.leave + 0.2],
            ]) {
              let before = tripState(home, trip, from, day).facing!;
              for (let t = from + 1 / 30; t < to; t += 1 / 30) {
                const now = tripState(home, trip, t, day).facing!;
                expect(now, `${id} ${trip.event.id} at ${t.toFixed(3)}`).not.toBe(opposite[before]);
                before = now;
                frames++;
              }
            }
          }
        }
      // Twelve at the fair and sixteen at the table, three days running.
      expect(guests).toBe(3 * (12 + 16));
      expect(frames).toBeGreaterThan(3000);
    },
    rosterTimeout(0.3, 60_000),
  );

  it('stays cheap to simulate, frame after frame', () => {
    // A day's first frame plans it (prefetched in idle time in the app); the rest only read the
    // plan. 400 frames spread over the day, in node: measured 0.67 ms each, five times under. The
    // best of three runs, so tests running alongside on a busy machine do not decide it.
    const day = SUMMER_10 + 1;
    simulateResidents(town, 360, day);
    const runs = [0, 1, 2].map((run) => {
      const begin = performance.now();
      for (let n = 0; n < 400; n++) simulateResidents(town, 361 + run * 0.9 + n * 2.7, day);
      return (performance.now() - begin) / 400;
    });
    expect(Math.min(...runs)).toBeLessThan(3.5);
  }, 60_000);
});
