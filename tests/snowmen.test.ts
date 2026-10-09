// Snowmen on the Lunch Green (docs/STARGAZING.md): the builders and the watchers, the snowmen
// themselves from their first snowball to the carrot left on the grass, and the green's panel line.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  builtDay,
  GREEN_CENTER,
  HEADLESS,
  scarfOf,
  SCARVES,
  SNOWMAN_RADII,
  SNOWMAN_SPOTS,
  snowmanShape,
} from '../src/city/district/snowmen';
import GreenNote from '../src/components/district/GreenNote';
import { SNOWMAN_DAYS, SNOWMAN_STAGES, snowmanState } from '../src/lib/district-calendar';
import { EVENT_SPOTS } from '../src/lib/events';
import {
  builderSpells,
  snowmenBuilderFacing,
  snowmenBuilderPose,
  snowmenStanding,
  snowmenWatcherPose,
  WATCHER_CHEERS,
  type SnowmenContext,
} from '../src/lib/outings/snowmen';
import {
  residentTrips,
  SEAT_SETTLE,
  tripState,
  type ResidentTrip,
} from '../src/lib/resident-trips';
import type { Place } from '../src/lib/schema';
import { CALENDAR_EPOCH_DAY, townCalendarAt } from '../src/lib/town-calendar';
import { FROZEN_TOWN, outAllDay, TOWNS, YEAR } from './district';
import { fullTown } from './full-town';

const BUILD_DAYS = SNOWMAN_DAYS.map((d) => CALENDAR_EPOCH_DAY + d);
const label = (day: number) => {
  const { season, date } = townCalendarAt(day);
  return `${season} ${date}`;
};
const dayOf = (name: string) => YEAR.find((day) => label(day) === name)!;
/** A lunch guest's moment for the snowmen's poses, with the lunch's own pose (`sit` unless given):
 *  there from 12:50, before the lunch starts at 13:00, to 16:15. */
const at = (
  seat: number,
  time: number,
  day: number,
  lunch: SnowmenContext['lunch'] = () => 'sit',
): SnowmenContext =>
  ({
    seat,
    time,
    day,
    arrive: 770,
    leave: 975,
    trip: { event: { start: 780 } },
    lunch,
  }) as unknown as SnowmenContext;
/** The runs of one pose in a list of samples. */
function runs(samples: { time: number; pose: string | undefined }[]) {
  const out: { pose: string | undefined; from: number; to: number }[] = [];
  for (const { time, pose } of samples) {
    const last = out.at(-1);
    if (last && last.pose === pose) last.to = time;
    else out.push({ pose, from: time, to: time });
  }
  return out;
}
/** Minutes between pose samples. */
const STEP = 0.05;
/**
 * A lunch guest's poses at their spot from `from` to `to` (their whole stay unless given), sampled
 * by index so the step never drifts, as runs: `all` of them, and the ones that must be `held` a
 * minute. Only sitting down and getting up are shorter (the crouch, or a quarter turn at the
 * spot), and a run cut off by a window's own end is not counted.
 */
function poseRuns(
  home: Place,
  trip: ResidentTrip,
  day: number,
  from = trip.arrive,
  to = trip.leave,
) {
  const samples = [];
  for (let i = 0, time = from; time < to; time = from + ++i * STEP) {
    const state = tripState(home, trip, time, day);
    if (state.event?.phase === 'attending') samples.push({ time, pose: state.pose });
  }
  const all = runs(samples);
  const settled = Math.max(trip.arrive, trip.event.start) + SEAT_SETTLE;
  const held = all.filter(
    (run, i) =>
      run.to >= settled &&
      run.from < trip.leave - SEAT_SETTLE &&
      !(i === 0 && from > trip.arrive) &&
      !(i === all.length - 1 && to < trip.leave),
  );
  return { all, held };
}
/** A run shorter than a minute, as samples measure it. */
const brief = (run: { from: number; to: number }) => run.to - run.from + STEP < 1 - 1e-6;

describe('The builders and the watchers', () => {
  it('builds at seats 0 and 1: on the knees and up packing snow, turn about, 14:00–15:45', () => {
    for (const day of [...BUILD_DAYS, BUILD_DAYS[0] + 112])
      for (const seat of [0, 1]) {
        const spells = builderSpells(seat, day);
        expect(spells[0]).toMatchObject({ from: SNOWMAN_STAGES.base, pose: 'crouch' });
        expect(spells.at(-1)).toMatchObject({ to: SNOWMAN_STAGES.dressed, pose: 'crouch' });
        for (const [i, spell] of spells.entries()) {
          expect(spell.to - spell.from).toBeGreaterThanOrEqual(1);
          if (i) expect(spell.pose).not.toBe(spells[i - 1].pose);
          if (i) expect(spell.from).toBe(spells[i - 1].to);
        }
        expect(spells.some((spell) => spell.pose === 'play')).toBe(true);
        for (let time = SNOWMAN_STAGES.base; time < SNOWMAN_STAGES.dressed; time += 0.25)
          expect(['crouch', 'play']).toContain(snowmenBuilderPose(at(seat, time, day)));
        // Either side, the lunch's own pose: the one a minute before 14:00 holds on until the
        // building starts, and the one a minute after 15:45 starts as it ends.
        const { base, dressed } = SNOWMAN_STAGES;
        const lunch = (time: number) =>
          time < base - 0.5 || time >= dressed + 0.5 ? 'sip' : 'read';
        for (const time of [base - 30, base - 1.01, base - 0.5, base - 0.01])
          expect(snowmenBuilderPose(at(seat, time, day, lunch))).toBe('sip');
        for (const time of [dressed, dressed + 0.4, dressed + 1, dressed + 20])
          expect(snowmenBuilderPose(at(seat, time, day, lunch))).toBe('sip');
      }
    // The two builders keep their own time.
    expect(builderSpells(0, BUILD_DAYS[0])).not.toEqual(builderSpells(1, BUILD_DAYS[0]));
    for (const seat of [2, 3, 4, 5, -1, 6])
      expect(snowmenBuilderPose(at(seat, 900, BUILD_DAYS[0]))).toBeUndefined();
  });

  it('watches from seats 2–5: sat, chatting, and up on their feet as the head and the carrot go on', () => {
    const { base } = SNOWMAN_STAGES;
    const last = WATCHER_CHEERS.at(-1)!;
    for (const day of BUILD_DAYS)
      for (const seat of [2, 3, 4, 5]) {
        const samples = [];
        for (let time = base; time < 960; time += 0.05)
          samples.push({ time, pose: snowmenWatcherPose(at(seat, time, day)) });
        for (const { pose } of samples) expect(['sit', 'chat', 'cheer']).toContain(pose);
        const all = runs(samples);
        for (const run of all.slice(0, -1))
          expect(
            run.to - run.from + 0.05,
            `${seat} ${run.pose} at ${run.from}`,
          ).toBeGreaterThanOrEqual(1);
        for (const cheer of WATCHER_CHEERS)
          expect(snowmenWatcherPose(at(seat, cheer.from + 0.5, day))).toBe('cheer');
        // The lunch's own pose either side, handed over a minute out.
        const done = last.from + last.minutes + 0.3;
        const lunch = (time: number) => (time < base - 0.5 || time >= done + 0.5 ? 'play' : 'read');
        expect(snowmenWatcherPose(at(seat, base - 0.01, day, lunch))).toBe('play');
        expect(snowmenWatcherPose(at(seat, 960, day, lunch))).toBe('play');
      }
    for (const seat of [0, 1, 6])
      expect(snowmenWatcherPose(at(seat, 900, BUILD_DAYS[0]))).toBeUndefined();
  });

  it('gives every lunch guest on a build day poses held a minute at least, in the full town and frozen ones', () => {
    const { base, dressed } = SNOWMAN_STAGES;
    // Today's town filled up, and two frozen guest lists where a neighbor out all day on R11 once
    // sent a watcher to the green mid-chat, to hold it under a minute: 14:01 on Winter 3 in the
    // frozen town, 14:14 on Winter 15 with every other plot taken too.
    const R11 = outAllDay('R11');
    const towns: [string, Place[]][] = [
      ['the full town', TOWNS.full],
      ['the frozen town with R11 taken', [...FROZEN_TOWN, R11]],
      ['the frozen town full with R11 taken', fullTown([...FROZEN_TOWN, R11])],
    ];
    for (const [name, town] of towns) {
      let builders = 0,
        ownPoses = 0,
        midway = 0;
      for (const day of BUILD_DAYS) {
        const plans = residentTrips(town, day);
        for (const [id, trips] of plans)
          for (const trip of trips) {
            if (trip.event.variant !== 'snowmen') continue;
            const home = town.find((place) => place.id === id)!;
            if (trip.arrive > base) midway++;
            const { all, held } = poseRuns(home, trip, day);
            // Between sitting down and getting up.
            for (const run of held)
              expect(
                brief(run),
                `${name}: ${label(day)} seat ${trip.seat} ${run.pose} at ${run.from.toFixed(2)}`,
              ).toBe(false);
            if (trip.seat < 2 && all.some((run) => run.pose === 'play')) builders++;
            // The lunch keeps its own poses either side of the building.
            if (
              all.some(
                (run) =>
                  (run.from < base || run.to >= dressed + 3) &&
                  ['sip', 'read', 'chat', 'play'].includes(run.pose ?? ''),
              )
            )
              ownPoses++;
            // A builder sat on the blanket as the building starts goes to it and back by way of
            // the crouch (one walking in on it later never sat down).
            if (trip.seat < 2 && trip.arrive < base)
              for (let i = 1; i < all.length; i++)
                if (all[i].pose === 'play' && all[i].from >= base && all[i].from < dressed)
                  expect(all[i - 1].pose).toBe('crouch');
          }
      }
      expect(builders, name).toBeGreaterThanOrEqual(BUILD_DAYS.length);
      expect(ownPoses, name).toBeGreaterThanOrEqual(BUILD_DAYS.length);
      // The frozen guest lists still send someone in once the building has begun.
      if (name !== 'the full town') expect(midway, name).toBeGreaterThan(0);
    }
  });

  it('holds every pose a minute whenever a lunch guest sits down or gets up', () => {
    // A guest list only decides when each seat's guest arrives and leaves (a far plot, the
    // headways, a newcomer taking a seat): so sweep both across the whole build, for every seat
    // on every build day, with each lunch's own poses either side.
    const { base } = SNOWMAN_STAGES;
    const last = WATCHER_CHEERS.at(-1)!;
    const until = last.from + last.minutes + 3;
    const LUNCHES = ['picnic', 'books', 'games'];
    const WINDOW = 5;
    const town = TOWNS.eager;
    const short: string[] = [];
    let held = 0;
    for (const day of BUILD_DAYS) {
      const guests = [...residentTrips(town, day)].flatMap(([id, trips]) =>
        trips
          .filter((trip) => trip.event.variant === 'snowmen')
          .map((trip) => ({ home: town.find((place) => place.id === id)!, trip })),
      );
      expect(guests.map(({ trip }) => trip.seat).sort()).toEqual([0, 1, 2, 3, 4, 5]);
      for (const { home, trip } of guests)
        for (let k = 0, edge = base - 3; edge < until; edge = base - 3 + ++k * 0.7) {
          const event = { ...trip.event, id: LUNCHES[k % LUNCHES.length] };
          // Sitting down at `edge` and staying on, or there early and getting up at `edge`.
          const late = { ...trip, event, depart: edge - trip.duration, arrive: edge };
          const early = { ...trip, event, leave: edge, homeBy: edge + trip.returnDuration };
          for (const [guest, from, to] of [
            [late, edge, edge + WINDOW],
            [early, edge - WINDOW, edge],
          ] as const)
            for (const run of poseRuns(home, guest, day, from, to).held) {
              held++;
              if (brief(run))
                short.push(
                  `${label(day)} seat ${trip.seat} ${event.id}, ${guest === late ? 'in' : 'up'} at ${edge.toFixed(2)}: ${run.pose} at ${run.from.toFixed(2)}`,
                );
            }
        }
    }
    expect(short.slice(0, 5)).toEqual([]);
    // Thousands of poses begun and ended inside a window (4,061 when written).
    expect(held).toBeGreaterThan(3000);
  });

  it('turns the builders to their snowman while they build, a quarter at a time', () => {
    const { base, dressed } = SNOWMAN_STAGES;
    const opposite = { ne: 'sw', sw: 'ne', se: 'nw', nw: 'se' } as const;
    let builders = 0;
    for (const day of BUILD_DAYS) {
      const plans = residentTrips(TOWNS.full, day);
      for (const [id, trips] of plans)
        for (const trip of trips) {
          if (trip.event.variant !== 'snowmen' || trip.seat > 1) continue;
          builders++;
          const home = TOWNS.full.find((place) => place.id === id)!;
          const blanket = EVENT_SPOTS.green[trip.seat].facing;
          let before: keyof typeof opposite | undefined;
          for (let time = trip.arrive; time < trip.leave; time += 0.05) {
            const state = tripState(home, trip, time, day);
            if (state.event?.phase !== 'attending') continue;
            const building = time >= base && time < dressed;
            const settled = time >= trip.arrive + 0.5 && time < trip.leave - 0.5;
            if (settled)
              expect(state.facing, `${label(day)} seat ${trip.seat} at ${time.toFixed(2)}`).toBe(
                building ? snowmenBuilderFacing(trip.seat, time, day) : blanket,
              );
            if (before) expect(state.facing).not.toBe(opposite[before]);
            before = state.facing;
          }
        }
    }
    expect(builders).toBe(2 * BUILD_DAYS.length);
  });
});

describe('A builder’s facing, for the planner to use', () => {
  it('turns each builder to the day’s snowman while building, and says nothing otherwise', () => {
    // The town's walking rule: the larger of the two steps decides, +x is se and −y is ne.
    const facingOf = (dx: number, dy: number) =>
      Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'nw' : 'se') : dy < 0 ? 'ne' : 'sw';
    for (const [k, day] of BUILD_DAYS.entries())
      for (const seat of [0, 1]) {
        const from = EVENT_SPOTS.green[seat],
          to = SNOWMAN_SPOTS[k];
        expect(snowmenBuilderFacing(seat, 870, day)).toBe(facingOf(to.x - from.x, to.y - from.y));
        expect(snowmenBuilderFacing(seat, SNOWMAN_STAGES.base - 0.1, day)).toBeUndefined();
        expect(snowmenBuilderFacing(seat, SNOWMAN_STAGES.dressed, day)).toBeUndefined();
        expect(snowmenBuilderFacing(seat, 870, day + 1)).toBeUndefined();
        expect(snowmenBuilderFacing(seat, 870, day + 112)).toBe(
          snowmenBuilderFacing(seat, 870, day),
        );
      }
    expect(snowmenBuilderFacing(2, 870, BUILD_DAYS[0])).toBeUndefined();
    // Never about in one frame: from the blanket's way and back to it, a quarter at a time.
    const opposite = { ne: 'sw', sw: 'ne', se: 'nw', nw: 'se' } as const;
    for (const day of BUILD_DAYS)
      for (const seat of [0, 1]) {
        const blanket = EVENT_SPOTS.green[seat].facing;
        let before = blanket;
        for (let time = 830; time < 960; time += 0.05) {
          const now = snowmenBuilderFacing(seat, time, day) ?? blanket;
          expect(now, `${label(day)} seat ${seat} at ${time.toFixed(2)}`).not.toBe(
            opposite[before],
          );
          before = now;
        }
      }
  });
});

describe('A snowman', () => {
  it('stands on the back lawn, clear of the blankets, the lane and the stepping stones', () => {
    for (const spot of SNOWMAN_SPOTS) {
      for (const seat of EVENT_SPOTS.green)
        expect(Math.hypot(spot.x - seat.x, spot.y - seat.y)).toBeGreaterThanOrEqual(0.85);
      expect(Math.abs(spot.x - -1.35)).toBeGreaterThanOrEqual(0.75);
      const stones = Math.hypot(spot.x, spot.y - Math.max(0.5, Math.min(1.6, spot.y)));
      expect(stones).toBeGreaterThanOrEqual(0.3);
      expect(Math.abs(spot.x)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(spot.y)).toBeLessThanOrEqual(1.5);
    }
    expect(GREEN_CENTER).toEqual({ x: 19.5, y: 11.5 });
  });

  it('is rolled up ball by ball on its build day, and dressed at 15:45', () => {
    for (const [k, day] of BUILD_DAYS.entries()) {
      expect(snowmanShape(k, day, SNOWMAN_STAGES.base - 1)).toBeUndefined();
      let before = 0;
      for (let minute = SNOWMAN_STAGES.base; minute < SNOWMAN_STAGES.dressed; minute += 0.5) {
        const shape = snowmanShape(k, day, minute)!;
        expect(shape.face).toBeUndefined();
        expect(shape.scarf).toBeUndefined();
        const balls = snowmanState(k, day, minute)!.stage;
        expect(shape.balls).toHaveLength(balls);
        // Only ever growing, a little at a time.
        const size = shape.balls.reduce((sum, ball) => sum + ball.rx, 0);
        expect(size).toBeGreaterThanOrEqual(before - 1e-9);
        expect(size - before).toBeLessThanOrEqual(SNOWMAN_RADII[0] * 0.7 + 1e-9);
        before = size;
      }
      const dressed = snowmanShape(k, day, SNOWMAN_STAGES.dressed)!;
      expect(dressed.balls.map((ball) => ball.rx)).toEqual([...SNOWMAN_RADII]);
      expect(dressed.face).toBeDefined();
      expect(dressed.scarf).toBeDefined();
    }
  });

  it('is about 22 px tall: balls of 10, 8 and 6, never over 22', () => {
    const shape = snowmanShape(0, BUILD_DAYS[3], 720)!;
    const top = Math.min(...shape.balls.map((ball) => ball.y - ball.ry));
    const bottom = Math.max(...shape.balls.map((ball) => ball.y + ball.ry));
    expect(-top).toBeGreaterThanOrEqual(20);
    expect(-top).toBeLessThanOrEqual(22);
    expect(bottom).toBeLessThanOrEqual(0.5);
    for (let k = 0; k < 4; k++)
      for (let day = BUILD_DAYS[0]; day < BUILD_DAYS[0] + 30; day++)
        for (let minute = 0; minute < 1440; minute += 60) {
          const s = snowmanShape(k, day, minute);
          if (s) for (const ball of s.balls) expect(ball.y - ball.ry).toBeGreaterThanOrEqual(-22);
        }
  });

  it('leans, shrinks to 40% and loses its head at 0.7; then a carrot and a scarf lie on the grass', () => {
    for (let k = 0; k < 4; k++) {
      let shrank = false,
        headless = false,
        leftovers = false;
      for (let t = BUILD_DAYS[3] + 1; t < BUILD_DAYS[0] + 26; t += 1 / 48) {
        const day = Math.floor(t),
          minute = (t - day) * 1440;
        const state = snowmanState(k, day, minute);
        const shape = snowmanShape(k, day, minute);
        expect(!!shape).toBe(!!state);
        if (!state || !shape) continue;
        const base = shape.balls[0];
        if (state.melt >= 1) {
          leftovers = true;
          expect(shape.balls).toHaveLength(0);
          expect(shape.dropped).toEqual({ carrot: true, scarf: true });
          continue;
        }
        expect(base.rx).toBeCloseTo(SNOWMAN_RADII[0] * (1 - 0.6 * state.melt), 6);
        if (state.melt > 0.5) shrank = true;
        expect(shape.balls.length === 3).toBe(state.melt < HEADLESS);
        if (state.melt >= HEADLESS) {
          headless = true;
          expect(shape.face).toBeUndefined();
          expect(shape.dropped.carrot).toBe(true);
          // Leaning over: its body is off its base, to one side.
          expect(Math.abs(shape.balls[1].x)).toBeGreaterThan(1);
        }
      }
      expect([shrank, headless, leftovers]).toEqual([true, true, true]);
    }
  });

  it('is gone by the end of Winter 27, so every spring starts clear', () => {
    for (const year of [0, 1, 2])
      for (let k = 0; k < 4; k++) {
        const spring = CALENDAR_EPOCH_DAY + 112 * (year + 1);
        for (let minute = 0; minute < 1440; minute += 30) {
          expect(snowmanShape(k, spring - 1, minute)).toBeUndefined();
          expect(snowmanShape(k, spring, minute)).toBeUndefined();
        }
      }
  });

  it('wears a muted wool scarf from its own build day, never amber, and no two alike', () => {
    for (const year of [0, 1, 2, 3, 4, 5]) {
      const day = BUILD_DAYS[0] + 112 * year;
      const worn = [0, 1, 2, 3].map((k) => scarfOf(k, day));
      expect(new Set(worn.map((pair) => pair[0])).size).toBe(4);
      expect(builtDay(2, day)).toBe(BUILD_DAYS[2] + 112 * year);
    }
    for (const pair of SCARVES)
      for (const colour of pair) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));
        // Muted: no channel near full, and not the warm yellow of lamplight.
        expect(Math.max(r, g, b)).toBeLessThan(0xc0);
        expect(r >= 0xe0 && g >= 0xb0 && b <= 0xb8).toBe(false);
      }
  });
});

describe('The green’s panel line', () => {
  it('counts the snowmen standing, and says nothing when none do', () => {
    const at = (name: string, minute: number) => snowmenStanding(dayOf(name), minute);
    expect(at('Winter 2', 720)).toBe(0);
    expect(at('Winter 3', 900)).toBe(0);
    expect(at('Winter 3', 946)).toBe(1);
    expect(at('Winter 8', 720)).toBe(2);
    expect(at('Winter 16', 720)).toBe(4);
    expect(at('Winter 28', 720)).toBe(0);
    expect(at('Spring 3', 720)).toBe(0);
    const html = (name: string, minutes: number) =>
      renderToStaticMarkup(createElement(GreenNote, { day: dayOf(name), minutes }));
    expect(html('Winter 16', 720)).toBe(
      '<p class="muted-copy">Snowmen on the green: 4. They stand until the thaw.</p>',
    );
    // On a build day the snowmen lunch's own card says they stand until the thaw: the count only.
    expect(html('Winter 3', 946)).toBe('<p class="muted-copy">Snowmen on the green: 1.</p>');
    expect(html('Winter 7', 1300)).toBe('<p class="muted-copy">Snowmen on the green: 2.</p>');
    expect(html('Winter 2', 720)).toBe('');
    expect(html('Summer 9', 720)).toBe('');
  });
});
