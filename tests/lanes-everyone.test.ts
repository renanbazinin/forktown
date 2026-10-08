// Lanes for everyone out at once: the outings' walks, the seasonal rounds and the loops round the
// blocks are planned together, so any two neighbors who share a street walk it side by side,
// whatever each is out for and whoever else lives in town.
import { describe, expect, it } from 'vitest';
import {
  laneAt,
  laneOffset,
  laneWalk,
  planLaneWalks,
  residentGround,
  routeLane,
  type LanePath,
} from '../src/lib/lanes';
import type { Place } from '../src/lib/schema';
import { simulateResidents } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY, townCalendarAt } from '../src/lib/town-calendar';
import { WALK_SPEED } from '../src/lib/walking';
import type { Point } from '../src/lib/world';
import { FROZEN_TOWN, outAllDay } from './district';
import { fullTown } from './full-town';

/** Screen px apart at zoom 1, as the town draws two figures: across and up or down. */
const apart = (a: Point, b: Point) => ({
  x: Math.abs((a.x - a.y - (b.x - b.y)) * 38),
  y: Math.abs((a.x + a.y - (b.x + b.y)) * 19),
});
/** Within 6 px across and 12 up or down two figures read as one; within 7 and 22, stacked. */
const fused = ({ x, y }: { x: number; y: number }) => x < 6 && y < 12;
const stacked = ({ x, y }: { x: number; y: number }) => x < 7 && y < 22;

describe('Planning lanes together', () => {
  it('lets a quicker walker pass a slower one on a straight street without merging', () => {
    // A slow overtake down one street, the trip-routes measure's worst kind: the quicker
    // walker gains 0.035 tiles a minute, so in fixed lanes the two would pass through one
    // figure, and then one head over the other, for minutes. Planned together, each makes room.
    const street = (from: number) => [
      { x: 9.5, y: from },
      { x: 9.5, y: 40 },
    ];
    const walkers = [
      { id: 'home', route: street(10), speed: WALK_SPEED },
      { id: 'behind', route: street(9), speed: WALK_SPEED * 1.11 },
    ].map(({ id, route, speed }, order) => {
      const length = 40 - route[0].y;
      const minutes = length / speed;
      const walk = laneWalk(id, order, false, [{ route, start: 0, minutes }], 0, minutes);
      return { route, length, minutes, walk };
    });
    planLaneWalks(walkers.map(({ walk }) => walk));
    const drawn = ({ route, length, minutes, walk }: (typeof walkers)[number], t: number) => {
      const walked = Math.min(1, t / minutes) * length;
      const lane = routeLane(route, walked, laneAt(walk.path as LanePath, t));
      const offset = laneOffset(route, walked, lane) ?? { x: 0, y: 0 };
      return { x: 9.5 + offset.x, y: route[0].y + walked + offset.y };
    };
    const longest = { fused: 0, stacked: 0 };
    const run = { fused: 0, stacked: 0 };
    const STEP = 0.2;
    for (let t = 0; t < 80; t += STEP) {
      const gap = apart(drawn(walkers[0], t), drawn(walkers[1], t));
      run.fused = fused(gap) ? run.fused + STEP : 0;
      run.stacked = stacked(gap) ? run.stacked + STEP : 0;
      longest.fused = Math.max(longest.fused, run.fused);
      longest.stacked = Math.max(longest.stacked, run.stacked);
    }
    expect(longest.fused).toBeLessThan(2);
    expect(longest.stacked).toBeLessThan(3);
  });

  it('keeps an outing guest and a neighbor out round the block apart, in any town', () => {
    // The frozen town with every free plot taken, alone and with a newcomer out all day on H14:
    // the hours where a guest on the way to or from an outing caught up with someone out on a
    // loop, and the two walked as one figure for up to 4.6 minutes when the outings' lanes were
    // planned first and the loops' around them (neither could make room alone).
    const town = fullTown(FROZEN_TOWN);
    const newcomer = fullTown([...FROZEN_TOWN, outAllDay('H14')]);
    for (const [homes, season, date, from] of [
      [town, 'Autumn', 27, 14 * 60 + 20],
      [town, 'Summer', 14, 12 * 60 + 55],
      [town, 'Autumn', 22, 23 * 60],
      [town, 'Spring', 23, 12 * 60 + 15],
      [newcomer, 'Spring', 1, 12 * 60 + 15],
    ] as const) {
      const day = dayOf(season, date);
      const { longest, at } = sideBySide(homes, day, from, from + 60);
      expect(longest.fused, at.fused).toBeLessThan(2);
      expect(longest.stacked, at.stacked).toBeLessThan(3);
    }
    // Two full towns' day plans and five hours of frames: about 10 s alone, more beside others.
  }, 120_000);
});

/** A day of the third town year (the trip-routes test's year): `date` of `season`. */
function dayOf(season: string, date: number) {
  for (let day = CALENDAR_EPOCH_DAY + 224; ; day++) {
    const calendar = townCalendarAt(day);
    if (calendar.season === season && calendar.date === date) return day;
  }
}

/**
 * The trip-routes measure from `from` to `to` (town minutes of `day`'s plan): the longest each pair
 * of walkers heading the same way is drawn as one figure, and one head over the other.
 */
function sideBySide(town: Place[], day: number, from: number, to: number) {
  const STEP = 0.2;
  const longest = { fused: 0, stacked: 0 };
  const at = { fused: '', stacked: '' };
  const runs = { fused: new Map<string, number>(), stacked: new Map<string, number>() };
  for (let minute = from; minute < to; minute += STEP) {
    const states = simulateResidents(town, minute % 1440, day + Math.floor(minute / 1440));
    const walkers = states.filter(
      (state) =>
        state.activity === 'stroll' && state.moving && !state.transit && state.fade === undefined,
    );
    const ground = walkers.map(residentGround);
    const now = { fused: new Set<string>(), stacked: new Set<string>() };
    for (let i = 0; i < walkers.length; i++)
      for (let j = i + 1; j < walkers.length; j++) {
        if (walkers[i].facing !== walkers[j].facing) continue;
        const gap = apart(ground[i], ground[j]);
        const key = `${walkers[i].id}&${walkers[j].id}`;
        for (const [kind, over] of [
          ['fused', fused(gap)],
          ['stacked', stacked(gap)],
        ] as const) {
          if (!over) continue;
          now[kind].add(key);
          const run = (runs[kind].get(key) ?? 0) + STEP;
          runs[kind].set(key, run);
          if (run > longest[kind]) {
            longest[kind] = run;
            at[kind] = `${key}, day ${day}, ending at ${minute.toFixed(2)}`;
          }
        }
      }
    for (const kind of ['fused', 'stacked'] as const)
      for (const key of [...runs[kind].keys()]) if (!now[kind].has(key)) runs[kind].delete(key);
  }
  return { longest, at };
}
