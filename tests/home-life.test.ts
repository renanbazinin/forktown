import { describe, expect, it } from 'vitest';
import { HOUSE_PLOTS } from '../src/lib/events';
import {
  BENCH_SEAT,
  BORROW_MAX,
  CHORE_MOST,
  CROUCH_MINUTES,
  DOOR_STAGGER,
  DOOR_SWING,
  DAWN,
  DUSK,
  doorIn,
  doorOut,
  FADE_MINUTES,
  FRONT_STEP,
  GATE_PAUSE,
  hasPorch,
  homeSpots,
  KERB_OFFSET,
  MIN_SPOT_MINUTES,
  NIGHT_START,
  planAt,
  plotDoor,
  PORCH_CHAIR,
  STONE_X,
  strollLoops,
  windowPlan,
  type HomeSpotKind,
  type PlanPoint,
} from '../src/lib/home-life';
import { LANE_DRIFT, LANE_RAMP } from '../src/lib/lanes';
import { nightBedtime } from '../src/lib/night-routine';
import { residentTrips, strollRuns } from '../src/lib/resident-trips';
import type { Place } from '../src/lib/schema';
import {
  residentActivityLabel,
  simulateResidents,
  type ResidentState,
} from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { WINTER } from '../src/lib/seasons';
import { MAX_TRAVEL_SPEED_MULTIPLIER, opposite, WALK_SPEED } from '../src/lib/walking';
import { getPlot, isRoad, plotEntrance, project, type Point } from '../src/lib/world';
import { AFTER_HOURS, BAZPLACE, FUNKY_FUN, MOONBEAM_CAFE } from './fixtures';
import { fullTown, readPlaces } from './full-town';
import { riding, stepBound } from './tube-riders';

const places = readPlaces();
/** Every house plot taken, dealing every building, look and routine the builder offers. */
const town = fullTown(places);
const DAY = CALENDAR_EPOCH_DAY + 224 + 42;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/** A plan-day minute (06:00 = 360 to 06:00 next day = 1800), as the clock and calendar show it. */
const at = (homes: Place[], minute: number, day: number) =>
  simulateResidents(homes, minute % 1440, day + Math.floor(minute / 1440));
const plotOf = (state: ResidentState) => getPlot(state.home.plot)!;
const offset = (state: ResidentState, point: Point) => ({
  x: plotOf(state).x + point.x,
  y: plotOf(state).y + point.y,
});
const visible = (state: ResidentState) => state.activity === 'stroll';
const SEATED = new Set<HomeSpotKind>(['bench', 'porch', 'step', 'tree']);
const NIGHT_SPOTS = new Set<HomeSpotKind>(['bench', 'porch', 'step', 'gate']);

/** A whole plan day of states every `step` minutes, sampled once and shared by the checks. */
type Frame = { minute: number; states: ResidentState[] };
const timelines = new Map<string, Frame[]>();
function timeline(homes: Place[], day: number, step: number): Frame[] {
  const key = `${homes === town ? 'town' : 'places'}:${day}:${step}`;
  let frames = timelines.get(key);
  if (!frames) {
    frames = [];
    for (let i = 0; 360 + i * step <= 1800 + 1e-9; i++) {
      const minute = 360 + i * step;
      frames.push({ minute, states: at(homes, minute, day) });
    }
    timelines.set(key, frames);
  }
  return frames;
}
const SAMPLES: [Place[], number, number][] = [
  [places, DAY, 0.1],
  [places, DAY + 1, 0.25],
  [town, DAY, 0.25],
];

/** Each resident's stroll runs, like the planner's own available windows. */
function runs(home: Place) {
  const { routine } = home.resident;
  const list: { start: number; end: number }[] = [];
  const add = (start: number, end: number) => {
    const last = list.at(-1);
    if (last?.end === start) last.end = end;
    else list.push({ start, end });
  };
  if (routine.morning === 'stroll') add(360, 720);
  if (routine.afternoon === 'stroll') add(720, 1080);
  if (routine.evening === 'stroll') add(1080, 1320);
  if (routine.night === 'stroll') add(1320, nightBedtime(home));
  return list;
}

describe('Life at home: the front door, the garden and loops round the block', () => {
  it('never idles on the road, and appears and vanishes only through the front door', () => {
    const wrong: string[] = [];
    for (const [homes, day, step] of SAMPLES) {
      const since = new Map<string, number>();
      let previous: ResidentState[] | undefined;
      let appearances = 0;
      for (const { minute, states } of timeline(homes, day, step)) {
        states.forEach((state, index) => {
          const door = plotDoor(plotOf(state));
          const where = `${state.id} d${day - DAY} m${minute.toFixed(1)}`;
          const onRoad = isRoad(Math.floor(state.position.x), Math.floor(state.position.y));
          // Standing or sitting on a road tile only at the road handoff, or up on the kerb in
          // front of the lot between two outings, and only for a moment. Errand handoffs have
          // their own public kerb stops, checked with their routes in seasonal-errands.test.ts.
          if (
            visible(state) &&
            !state.event &&
            !state.errand &&
            !state.duckLove &&
            !state.moving &&
            onRoad
          ) {
            const stands = [plotEntrance(plotOf(state))];
            if (state.lot?.spot === 'kerb') stands.push(offset(state, KERB_OFFSET));
            if (stands.every((point) => distance(state.position, point) > 1e-9))
              wrong.push(`${where}: stands on the road away from home`);
            if (!since.has(state.id)) since.set(state.id, minute);
            else if (minute - since.get(state.id)! > 4.5) wrong.push(`${where}: waits on the road`);
          } else since.delete(state.id);
          if (!visible(state)) {
            // Indoors, just inside the door, with nothing but the door itself to show.
            if (distance(state.position, door) > 0) wrong.push(`${where}: indoors off the door`);
            if (state.moving || state.lot || state.fade !== undefined || state.pose)
              wrong.push(`${where}: indoors but ${JSON.stringify(state.lot ?? state.pose)}`);
          }
          const before = previous?.[index];
          if (!before) return;
          if (!visible(before) && visible(state)) {
            appearances++;
            if (distance(state.position, door) > WALK_SPEED * step + 1e-9)
              wrong.push(`${where}: appears away from the door`);
            if (!((state.fade ?? 1) < 1 && state.lot?.stage === 'out' && state.door! > 0))
              wrong.push(`${where}: appears without the door and a fade`);
            if (!(before.door! > 0)) wrong.push(`${where}: the door was shut just before`);
          }
          if (visible(before) && !visible(state)) {
            if (distance(before.position, door) > WALK_SPEED * step + 1e-9)
              wrong.push(`${where}: vanishes away from the door`);
            // Walking in, fading, never from a standstill.
            if (!before.moving || !((before.fade ?? 1) < 1) || before.lot?.stage !== 'in')
              wrong.push(`${where}: vanishes without walking in`);
            if (!(state.door! > 0)) wrong.push(`${where}: the door shut on them`);
          }
        });
        previous = states;
      }
      expect(appearances).toBeGreaterThan(homes.length / 2);
    }
    expect(wrong.slice(0, 8)).toEqual([]);
  }, 30_000);

  it('walks its lot and its loops at walking pace, facing the way it goes', () => {
    const wrong: string[] = [];
    let lotSteps = 0;
    for (const [homes, day, step] of SAMPLES) {
      const frames = timeline(homes, day, step);
      for (let f = 1; f < frames.length; f++)
        frames[f].states.forEach((state, index) => {
          const before = frames[f - 1].states[index];
          if (!visible(before) || !visible(state)) return;
          const where = `${state.id} d${day - DAY} m${frames[f].minute.toFixed(1)}`;
          const moved = distance(before.position, state.position);
          const bound = stepBound(
            before,
            state,
            step,
            WALK_SPEED * MAX_TRAVEL_SPEED_MULTIPLIER * step,
          );
          if (moved > bound + 1e-9) wrong.push(`${where}: jumps ${moved.toFixed(3)}`);
          if (before.event || state.event) return;
          // Free time is walked at an easy pace, only a little brisker catching up after ducks.
          if (!riding(state) && moved > ((WALK_SPEED * 4) / 3) * step + 1e-9)
            wrong.push(`${where}: hurries ${moved.toFixed(3)}`);
          if (before.moving && state.moving && moved > 1e-9 && before.facing === state.facing) {
            const a = project(before.position.x, before.position.y),
              b = project(state.position.x, state.position.y);
            const direction = `${b.y > a.y ? 's' : 'n'}${b.x > a.x ? 'e' : 'w'}`;
            if (direction !== state.facing)
              wrong.push(`${where}: faces ${state.facing}, walks ${direction}`);
            if (state.lot) lotSteps++;
          }
          // Loops and garden paths turn at corners, never back on themselves mid-stride.
          const opposite = { se: 'nw', nw: 'se', sw: 'ne', ne: 'sw' } as const;
          if (before.moving && state.moving && opposite[before.facing] === state.facing)
            wrong.push(`${where}: about-faces mid-stride`);
        });
    }
    expect(lotSteps).toBeGreaterThan(1000);
    expect(wrong.slice(0, 8)).toEqual([]);
  }, 30_000);

  it('spends home time at the spots its own home has, seated with a crouch, never briefly', () => {
    const wrong: string[] = [];
    const used = new Map<HomeSpotKind, number>();
    const [homes, day, step] = SAMPLES[2];
    const frames = timeline(homes, day, step);
    // Runs of samples at one spot: [first minute, last minute, poses].
    const open = new Map<
      string,
      { spot: HomeSpotKind; from: number; to: number; poses: string[] }
    >();
    const close = (id: string, clipped: boolean) => {
      const run = open.get(id);
      open.delete(id);
      if (!run || clipped || run.spot === 'gate' || run.spot === 'kerb' || run.from === -Infinity)
        return;
      if (run.to - run.from + step < MIN_SPOT_MINUTES - 1e-9)
        wrong.push(
          `${id} m${run.from.toFixed(1)}: only ${(run.to - run.from + step).toFixed(1)} min at the ${run.spot}`,
        );
      if (SEATED.has(run.spot) && (run.poses[0] !== 'crouch' || run.poses.at(-1) !== 'crouch'))
        wrong.push(`${id} m${run.from.toFixed(1)}: sits at the ${run.spot} without a crouch`);
    };
    frames.forEach(({ minute, states }, f) =>
      states.forEach((state) => {
        const run = open.get(state.id);
        const here = visible(state) && state.lot?.stage === 'at' ? state.lot.spot : undefined;
        if (run && run.spot !== here) close(state.id, false);
        if (!here) return;
        const where = `${state.id} m${minute.toFixed(1)}`;
        used.set(here, (used.get(here) ?? 0) + 1);
        const spots = homeSpots(state.home).filter((spot) => spot.kind === here);
        const spot = spots.find(
          (spot) => distance(offset(state, spot.feet), state.position) < 1e-9,
        );
        // The only spot off the lot is a moment between two trips, up on the kerb in front of
        // it or, with no time to step up, at the road handoff.
        const handoff =
          here === 'kerb' &&
          [plotEntrance(plotOf(state)), offset(state, KERB_OFFSET)].some(
            (point) => distance(state.position, point) < 1e-9,
          );
        if (!spot && !handoff) wrong.push(`${where}: at a ${here} this home doesn't have`);
        // Night runs from 22:00 to 06:00, when the next morning's gardeners may be out already.
        if (minute >= NIGHT_START && minute < 1800 && !NIGHT_SPOTS.has(here))
          wrong.push(`${where}: ${here} at night`);
        if (spot && here !== 'gate' && here !== 'kerb') {
          if (state.facing !== spot.facing) wrong.push(`${where}: faces ${state.facing} there`);
          const cafeNight =
            here === 'porch' && !!state.nightPorch && state.home.building === 'cafe';
          const pose = cafeNight ? 'tea' : spot.pose;
          if (!(state.pose === pose || (SEATED.has(here) && state.pose === 'crouch')))
            wrong.push(`${where}: ${state.pose} at the ${here}`);
        }
        const current = open.get(state.id);
        if (current) {
          current.to = minute;
          current.poses.push(state.pose ?? '');
        } else
          open.set(state.id, { spot: here, from: minute, to: minute, poses: [state.pose ?? ''] });
        if (f === 0) open.get(state.id)!.from = -Infinity;
      }),
    );
    for (const id of [...open.keys()]) close(id, true);
    expect(wrong.slice(0, 8)).toEqual([]);
    // Every kind of spot is used somewhere in a full town.
    for (const kind of ['beds', 'bench', 'flowers', 'paving', 'porch', 'step', 'tree'] as const)
      expect(used.get(kind) ?? 0).toBeGreaterThan(0);
  }, 30_000);

  it('offers spots by the home’s own look, with the step and the gate for everyone', () => {
    const base = AFTER_HOURS;
    const kinds = (look: Partial<Place>, design: Partial<Place['design']> = {}) =>
      homeSpots({ ...base, ...look, design: { ...base.design, ...design } }).map(
        (spot) => spot.kind,
      );
    expect(
      kinds({ decoration: 'bench', building: 'studio' }, { feature: 'none', garden: 'paving' }),
    ).toEqual(['bench', 'step', 'paving', 'gate']);
    expect(
      kinds(
        { decoration: 'tree', building: 'cottage' },
        { feature: 'porch', garden: 'vegetables' },
      ),
    ).toEqual(['porch', 'step', 'tree', 'beds', 'gate']);
    expect(
      kinds(
        { decoration: 'flowers', building: 'cafe' },
        { feature: 'none', garden: 'wildflowers' },
      ),
    ).toEqual(['porch', 'step', 'flowers', 'beds', 'gate']);
    expect(
      kinds(
        { decoration: 'flowers', building: 'cottage' },
        { feature: 'none', garden: 'vegetables' },
      ),
    ).toEqual(['step', 'flowers', 'beds', 'beds', 'gate']);
    // A porch home waters only the bed right of its path: its chair stands behind the left one.
    const porch = homeSpots({
      ...base,
      building: 'cottage',
      design: { ...base.design, feature: 'porch', garden: 'wildflowers' },
    });
    for (const spot of porch.filter((spot) => spot.kind === 'beds'))
      expect(spot.feet.x).toBeGreaterThan(STONE_X);
    expect(
      kinds(
        { decoration: 'mailbox', building: 'bookshop' },
        { feature: 'balcony', garden: 'paving' },
      ),
    ).toEqual(['step', 'paving', 'gate']);
    // The seats line up with the art: bench and porch chair face the street.
    for (const spot of homeSpots({ ...base, decoration: 'bench', building: 'cafe' })) {
      if (spot.kind === 'bench')
        expect(spot).toMatchObject({ feet: BENCH_SEAT.feet, facing: 'sw', pose: 'perch' });
      if (spot.kind === 'porch')
        expect(spot).toMatchObject({ feet: PORCH_CHAIR.feet, facing: 'sw', pose: 'perch' });
      if (spot.kind === 'step')
        expect(spot).toMatchObject({ feet: FRONT_STEP.feet, facing: 'sw', pose: 'sit' });
      // Every spot is on the lot, in front of the house (never behind its walls).
      expect(spot.feet.x).toBeGreaterThan(-1);
      expect(spot.feet.x).toBeLessThan(2);
      expect(spot.feet.y).toBeGreaterThan(0.8);
      expect(spot.feet.y).toBeLessThan(2);
    }
  });

  it('opens the door and fades through the threshold on time', () => {
    // The door's own timing, stepping out at 10 and in at 20.
    expect([9.5, 9.6, 9.8, 10, 10.9, 11.1, 11.3].map((t) => doorOut(10, t))).toEqual(
      [0, 0, 0.5, 1, 1, 0.5, 0].map((v) => expect.closeTo(v, 9)),
    );
    expect([18.6, 18.7, 18.9, 19.1, 20, 20.3, 20.5, 20.7].map((t) => doorIn(20, t))).toEqual(
      [0, 0, 0.5, 1, 1, 1, 0.5, 0].map((v) => expect.closeTo(v, 9)),
    );
    expect(DOOR_SWING).toBe(0.4);
    // A morning out from a published home: the door opens, they fade in walking out, and back.
    const home = FUNKY_FUN;
    const plan = windowPlan(home, getPlot(home.plot)!, DAY, {
      ws: 600,
      we: 700,
      start: 'door',
      end: 'door',
    });
    // Out up to a few minutes early, to be out as it opens, and in a moment before it closes.
    const { te, ti } = plan as Required<typeof plan>;
    expect(te).toBeGreaterThanOrEqual(600 - DOOR_STAGGER);
    expect(te).toBeLessThanOrEqual(600);
    expect(ti).toBeLessThanOrEqual(700);
    expect(ti).toBeGreaterThanOrEqual(700 - DOOR_STAGGER);
    expect(plan).toMatchObject({ shown: te, hidden: ti });
    const point = (t: number) =>
      planAt(plan, t) as ReturnType<typeof planAt> & Partial<ResidentState>;
    expect(point(te - 0.5)).toEqual({ indoors: true });
    expect(point(te - 0.2)).toEqual({ indoors: true, door: expect.closeTo(0.5, 9) });
    expect(point(te)).toMatchObject({
      indoors: false,
      fade: 0,
      door: 1,
      moving: true,
      facing: 'sw',
      lot: { stage: 'out' },
    });
    expect(point(te + FADE_MINUTES / 2)).toMatchObject({ fade: expect.closeTo(0.5, 9), door: 1 });
    expect(point(te + FADE_MINUTES).fade).toBeUndefined();
    expect(point(te + 1.1).door).toBeCloseTo(0.5, 9);
    expect(point(te + 1.3).door).toBeUndefined();
    expect(point(ti - 0.25)).toMatchObject({
      fade: expect.closeTo(0.5, 9),
      door: 1,
      moving: true,
      facing: 'ne',
      lot: { stage: 'in' },
    });
    expect(point(ti - 1.1).door).toBeCloseTo(0.5, 9);
    expect(point(ti - 0.8).door).toBe(1);
    expect(point(ti - 0.8).fade).toBeUndefined();
    expect(point(ti)).toEqual({ indoors: true, door: 1 });
    expect(point(ti + 0.5)).toEqual({ indoors: true, door: expect.closeTo(0.5, 9) });
    expect(point(ti + 0.7)).toEqual({ indoors: true });
    // On the threshold itself at both ends, where they wait while indoors.
    const door = plotDoor(getPlot(home.plot)!);
    expect(distance((point(te) as ResidentState).position, door)).toBeLessThan(1e-9);
    expect(distance((point(ti - 1e-6) as ResidentState).position, door)).toBeLessThan(1e-4);
  });

  it('opens and shuts a street’s front doors a moment apart, not all on the hour', () => {
    for (const homes of [places, town]) {
      // Every door edge of the day: when each neighbor steps out or in, to the nearest frame.
      const outs = new Map<number, number>(),
        ins = new Map<number, number>();
      let previous: ResidentState[] | undefined;
      for (const { minute, states } of timeline(homes, DAY, homes === town ? 0.25 : 0.1)) {
        states.forEach((state, index) => {
          const before = previous?.[index];
          if (!before) return;
          const frame = Math.round(minute * 100);
          if (!visible(before) && visible(state)) outs.set(frame, (outs.get(frame) ?? 0) + 1);
          if (visible(before) && !visible(state)) ins.set(frame, (ins.get(frame) ?? 0) + 1);
        });
        previous = states;
      }
      const total = (map: Map<number, number>) => [...map.values()].reduce((a, b) => a + b, 0);
      // Never more than a small share of the town through its doors in one frame.
      for (const map of [outs, ins]) {
        expect(total(map)).toBeGreaterThan(homes.length / 4);
        expect(Math.max(...map.values())).toBeLessThanOrEqual(Math.max(3, total(map) / 20));
      }
    }
  }, 30_000);

  it('spends its free time in the very windows its outings are planned in', () => {
    // One builder for both (strollRuns, from the planner's available windows), which merges
    // stroll periods next to each other and ends a night out at bedtime, as this file's own does.
    for (const home of town) expect(strollRuns(home), home.id).toEqual(runs(home));
    expect(town.some((home) => runs(home).some((run) => run.end - run.start > 360))).toBe(true);
  });

  it('borrows a few indoor minutes so no walk through the door is ever cut', () => {
    let early = 0,
      late = 0;
    for (let d = 0; d < 7; d++) {
      const day = DAY + d;
      for (const home of places) {
        const trips = residentTrips(places, day).get(home.id) ?? [];
        const state = (minute: number) => at(places, minute, day).find((s) => s.id === home.id)!;
        for (const run of runs(home)) {
          // Off on a trip the moment the stroll period starts: out of the door a little before.
          const first = trips.find((trip) => trip.depart === run.start);
          if (first) {
            early++;
            const out = state(first.depart - 0.001);
            expect(out).toMatchObject({ activity: 'stroll', moving: true, lot: { spot: 'door' } });
            expect(out.event).toBeUndefined();
            expect(visible(state(first.depart - BORROW_MAX - DOOR_SWING - 0.1))).toBe(false);
          }
          // Home the moment it ends (or at bedtime): up the path and in a few minutes later.
          const last = trips.find((trip) => trip.homeBy === run.end);
          if (last) {
            late++;
            const back = state(last.homeBy + 0.001);
            expect(back).toMatchObject({ activity: 'stroll', moving: true, lot: { stage: 'in' } });
            expect(back.event).toBeUndefined();
            expect(visible(state(last.homeBy + BORROW_MAX))).toBe(false);
          }
        }
      }
    }
    expect(early).toBeGreaterThan(5);
    expect(late).toBeGreaterThan(5);
    // Before a 06:00 trip, stepping out reads the next plan day.
    const trips = residentTrips(places, DAY);
    const dawn = simulateResidents(places, 359.9, DAY).filter((state) =>
      trips.get(state.id)?.some((trip) => trip.depart === 360),
    );
    expect(dawn.length).toBeGreaterThan(0);
    for (const state of dawn)
      expect(state, state.id).toMatchObject({ activity: 'stroll', lot: { spot: 'door' } });
  });

  it('strolls real loops round the blocks from its own doorstep, on the road the whole way', () => {
    for (const plot of HOUSE_PLOTS) {
      const loops = strollLoops(plot);
      // The home block itself always goes round.
      expect(loops.some((loop) => loop.length === 16)).toBe(true);
      for (const loop of loops) {
        expect([16, 24, 32, 40]).toContain(loop.length);
        expect(loop.points[0]).toEqual(plotEntrance(plot));
        expect(loop.points.at(-1)).toEqual(plotEntrance(plot));
        expect(loop.minutes).toBeCloseTo(loop.length / WALK_SPEED, 9);
        for (let i = 1; i < loop.points.length; i++) {
          const a = loop.points[i - 1],
            b = loop.points[i];
          // Straight runs along the roads, turning a corner at each end.
          expect(a.x === b.x || a.y === b.y).toBe(true);
          for (let s = 0; s <= 1; s += 1 / Math.max(1, Math.abs(b.x - a.x) + Math.abs(b.y - a.y)))
            expect(
              isRoad(Math.floor(a.x + (b.x - a.x) * s), Math.floor(a.y + (b.y - a.y) * s)),
            ).toBe(true);
          if (i > 1) {
            const c = loop.points[i - 2];
            expect((b.x - a.x) * (a.x - c.x) + (b.y - a.y) * (a.y - c.y)).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
    // Round a loop a neighbor keeps a lane, eased in and out at home, and drifts across the road
    // only gradually (LANE_DRIFT a minute at most), to walk clear of someone.
    const [homes, day, step] = SAMPLES[2];
    const lanes = new Map<string, number>(),
      seen = new Set<number>();
    for (const { states } of timeline(homes, day, step))
      for (const state of states) {
        if (!visible(state) || state.event || state.lot) {
          lanes.delete(state.id);
          continue;
        }
        const lane = state.lane ?? 0;
        // Eased in and out at the doorstep, where the loop meets the garden path.
        if (distance(state.position, plotEntrance(plotOf(state))) < 0.06)
          expect(Math.abs(lane)).toBeLessThanOrEqual(0.1);
        expect(Math.abs(lane)).toBeLessThanOrEqual(1);
        const before = lanes.get(state.id);
        if (before !== undefined)
          expect(Math.abs(lane - before)).toBeLessThanOrEqual(
            (WALK_SPEED * step) / LANE_RAMP + LANE_DRIFT * step + 1e-9,
          );
        lanes.set(state.id, lane);
        if (lane) seen.add(Math.sign(lane));
      }
    expect(seen.size).toBe(2);
  }, 20_000);

  it('hands a strolling evening over to the night at home, and is in by bedtime', () => {
    let seated = 0;
    for (const homes of [places, town]) {
      const states = at(homes, NIGHT_START, DAY);
      for (const state of states) {
        const { routine } = state.home.resident;
        if (!visible(state) || state.event) continue;
        // No day stroll runs on past 22:00: the night starts at home.
        expect(state.nightWalk || state.lot).toBeTruthy();
        if (routine.evening === 'stroll' && routine.night === 'stroll' && state.lot?.stage === 'at')
          seated++;
      }
      for (const home of homes.filter((home) => home.resident.routine.night === 'stroll')) {
        const bedtime = nightBedtime(home);
        const trips = residentTrips(homes, DAY).get(home.id) ?? [];
        const state = at(homes, bedtime, DAY).find((s) => s.id === home.id)!;
        if (state.activity === 'sleep') {
          expect(state.position).toEqual(plotDoor(getPlot(home.plot)!));
          continue;
        }
        // Still on the way in only when a trip got them home just before or at bedtime.
        expect(state.lot?.stage).toBe('in');
        expect(trips.some((trip) => trip.homeBy > bedtime - BORROW_MAX)).toBe(true);
        expect(at(homes, bedtime + BORROW_MAX, DAY).find((s) => s.id === home.id)!.activity).toBe(
          'sleep',
        );
      }
    }
    expect(seated).toBeGreaterThan(0);
  }, 20_000);

  it('never jumps across 06:00, 12:00, 18:00, 22:00, midnight or anyone’s bedtime', () => {
    for (const homes of [places, town]) {
      const boundaries = new Set([360, 720, 1080, 1320, 1440, 1800]);
      for (const home of homes)
        if (home.resident.routine.night === 'stroll') boundaries.add(nightBedtime(home));
      for (const boundary of boundaries) {
        const before = at(homes, boundary - 0.001, DAY),
          after = at(homes, boundary + 0.001, DAY);
        before.forEach((state, index) => {
          expect(after[index].id).toBe(state.id);
          expect(distance(state.position, after[index].position)).toBeLessThan(
            stepBound(state, after[index], 0.002, 0.01),
          );
        });
      }
    }
  }, 20_000);

  it('labels every moment at home truthfully', () => {
    const state: ResidentState = {
      id: AFTER_HOURS.id,
      resident: AFTER_HOURS.resident,
      home: AFTER_HOURS,
      position: { x: 0, y: 0 },
      activity: 'stroll',
      moving: false,
      facing: 'sw',
      walkPhase: 0,
      greeting: false,
    };
    const cafe = MOONBEAM_CAFE;
    const label = (lot: ResidentState['lot'], extra: Partial<ResidentState> = {}) =>
      residentActivityLabel({ ...state, activity: 'stroll', lot, ...extra });
    expect(label({ spot: 'door', stage: 'out' })).toBe('Stepping out the front door');
    expect(label({ spot: 'bench', stage: 'out' })).toBe('Stepping out the front door');
    expect(label({ spot: 'porch', stage: 'in' })).toBe('Heading inside');
    expect(label({ spot: 'step', stage: 'from' })).toBe('Setting off');
    const day: [HomeSpotKind, string][] = [
      ['bench', 'Resting on the garden bench'],
      ['porch', 'Sitting on the porch'],
      ['step', 'Sitting on the front step'],
      ['tree', 'Reading under the tree'],
      ['flowers', 'Watering the flowers'],
      ['paving', 'Sweeping the front path'],
      ['gate', 'Looking down the street'],
      ['kerb', 'Home for a moment between outings'],
    ];
    for (const [spot, text] of day) {
      expect(label({ spot, stage: 'to' })).toBe(text);
      expect(label({ spot, stage: 'at' })).toBe(text);
    }
    const garden = (garden: Place['design']['garden']) =>
      label(
        { spot: 'beds', stage: 'at' },
        { home: { ...state.home, design: { ...state.home.design, garden } } },
      );
    expect(garden('vegetables')).toBe('Tending the vegetable patch');
    expect(garden('wildflowers')).toBe('Watering the wildflowers');
    const night = (spot: HomeSpotKind, home = state.home) =>
      label({ spot, stage: 'at' }, { nightPorch: true, home });
    expect(night('step')).toBe('Enjoying the night on the doorstep');
    expect(night('bench')).toBe('Enjoying the night on the bench');
    expect(night('porch')).toBe('Enjoying the night on the porch');
    expect(night('porch', cafe)).toBe('Sipping tea on the porch');
    // Out on the town, the older labels still lead.
    expect(label(undefined, { nightWalk: true })).toBe('Out for a moonlit stroll');
    expect(label(undefined)).toBe('Out for a stroll');
    expect(label({ spot: 'gate', stage: 'at' }, { duckLove: true })).toBe(
      'Stopped to admire the ducklings',
    );
    // Every label the town actually shows is one of these, and never "indoors" while outside.
    for (const { states } of timeline(...SAMPLES[0]))
      for (const resident of states)
        if (visible(resident))
          expect(residentActivityLabel(resident)).not.toMatch(/at home|Sleeping/);
  }, 30_000);

  it('stretches only on the top step, stepping out on a morning', () => {
    let stretches = 0;
    for (const [homes, day, step] of SAMPLES)
      for (const { minute, states } of timeline(homes, day, step))
        for (const state of states) {
          if (state.pose !== 'stretch') continue;
          stretches++;
          expect(minute % 1440).toBeGreaterThanOrEqual(350);
          expect(minute % 1440).toBeLessThan(542);
          expect(state).toMatchObject({ moving: false, facing: 'sw', lot: { stage: 'out' } });
          expect(state.position).toEqual(offset(state, FRONT_STEP.feet));
          // Never under a porch roof, which raised hands would reach through.
          expect(hasPorch(state.home), state.id).toBe(false);
        }
    expect(stretches).toBeGreaterThan(0);
    // Nor any other morning of a porch home.
    for (const home of town.filter(hasPorch))
      for (let day = DAY; day < DAY + 14; day++)
        for (const seg of windowPlan(home, getPlot(home.plot)!, day, {
          ws: 360,
          we: 720,
          start: 'door',
          end: 'door',
        }).segs)
          expect(seg.kind === 'lot' && seg.pose === 'stretch', home.id).toBe(false);
    expect(CROUCH_MINUTES).toBeGreaterThan(0);
  }, 20_000);

  it('plans the same day for copies of the town, in any order, and follows a changed look', () => {
    const minutes = [355, 360, 360.3, 612.4, 719.95, 1017, 1319.8, 1320.2, 1500, 1700];
    const forward = minutes.map((minute) => at(places, minute, DAY));
    const backward = [...minutes]
      .reverse()
      .map((minute) => at(places, minute, DAY))
      .reverse();
    expect(backward).toEqual(forward);
    const copies = structuredClone(places);
    expect(minutes.map((minute) => at(copies, minute, DAY))).toEqual(forward);
    expect(minutes.map((minute) => at([...places].reverse(), minute, DAY).reverse())).toEqual(
      forward,
    );
    // A builder draft keeps its id and plot while its look changes: its spots change with it.
    const home = BAZPLACE;
    const plot = getPlot(home.plot)!;
    const window = { ws: 720, we: 1080, start: 'door', end: 'door' } as const;
    const spots = (look: Place) =>
      new Set(
        windowPlan(look, plot, DAY, window).segs.flatMap((seg) =>
          seg.kind === 'lot' ? [seg.life.spot] : [],
        ),
      );
    expect(spots(home).has('tree')).toBe(false);
    const tree = spots({ ...home, decoration: 'tree' });
    expect(tree.has('bench')).toBe(false);
    expect(windowPlan({ ...home }, plot, DAY, window)).toBe(windowPlan(home, plot, DAY, window));
  });
  it('keeps garden chores and reading to daylight, and waters nothing under snow', () => {
    const CHORES = new Set(['water', 'sweep', 'read']);
    let chores = 0;
    for (const [homes, day, step] of SAMPLES)
      for (const { minute, states } of timeline(homes, day, step))
        for (const state of states) {
          if (!state.lot || !state.pose || !CHORES.has(state.pose)) continue;
          chores++;
          // The lamps are lit from 20:00 until 06:00: then, only sitting out.
          const dark = minute >= DUSK && minute < 1800;
          expect(dark, `${state.id} ${state.pose} m${minute}`).toBe(false);
        }
    expect(chores).toBeGreaterThan(100);
    // Nor before 06:00: out of the door a few minutes early for a morning, a neighbor may sit
    // out, but starts no chore and opens no book until it is light.
    let early = 0;
    for (const home of town)
      for (let day = DAY; day < DAY + 8; day++) {
        const plan = windowPlan(home, getPlot(home.plot)!, day, {
          ws: 360,
          we: 720,
          start: 'door',
          end: 'door',
        });
        if (plan.shown < DAWN) early++;
        for (const seg of plan.segs)
          if (seg.kind === 'lot' && seg.pose && CHORES.has(seg.pose))
            expect(seg.t0, `${home.id} ${seg.pose}`).toBeGreaterThanOrEqual(DAWN);
      }
    expect(early).toBeGreaterThan(100);
    // Mid-winter, with snow on every garden: sweeping the path, but nobody waters.
    const winter = CALENDAR_EPOCH_DAY + 224 + WINTER + 8;
    let sweeping = 0;
    for (let minute = 360; minute < DUSK; minute += 1)
      for (const state of at(places, minute, winter)) {
        if (!state.lot) continue;
        expect(state.pose).not.toBe('water');
        if (state.pose === 'sweep') sweeping++;
      }
    expect(sweeping).toBeGreaterThan(0);
  }, 20_000);

  it('never spends longer at a garden chore than a chore takes', () => {
    for (const home of town) {
      const plot = getPlot(home.plot)!;
      for (const window of [
        { ws: 360, we: 720, start: 'door', end: 'door' },
        { ws: 720, we: 1080, start: 'door', end: 'road' },
      ] as const) {
        const segs = windowPlan(home, plot, DAY, window).segs;
        // A stay's time at its spot, from the first walk to it to the last walk away.
        let from = -1,
          spot: HomeSpotKind | undefined;
        for (const seg of segs) {
          if (seg.kind !== 'lot' || seg.life.stage === 'out' || seg.life.stage === 'in') {
            from = -1;
            continue;
          }
          if (seg.life.stage === 'to' && from < 0) {
            from = seg.t0;
            spot = seg.life.spot;
          }
          if (
            seg.life.stage === 'from' &&
            from >= 0 &&
            ['beds', 'flowers', 'paving'].includes(spot!)
          )
            expect(seg.t1 - from).toBeLessThanOrEqual(CHORE_MOST + DOOR_STAGGER + 1e-9);
        }
      }
    }
  });

  it('stays in day mode until 22:00, even running on a few minutes into a night out', () => {
    // A window that ends two minutes past 22:00 (an outing leaves then) is an evening, not a night.
    const home = AFTER_HOURS;
    const plot = getPlot(home.plot)!;
    for (const we of [NIGHT_START + 2, NIGHT_START + 10]) {
      const plan = windowPlan(home, plot, DAY, { ws: 1080, we, start: 'door', end: 'road' });
      expect(plan.segs.filter((seg) => seg.night && seg.t0 < NIGHT_START - 6)).toEqual([]);
      const evening = planAt(plan, 1150);
      expect(evening.indoors || (!evening.nightWalk && !evening.nightPorch)).toBe(true);
    }
    // In town, nobody is out on a moonlit stroll or a night stay well before 22:00.
    for (const [homes, day, step] of SAMPLES)
      for (const { minute, states } of timeline(homes, day, step))
        if (minute % 1440 >= 360 && minute < NIGHT_START - 6)
          for (const state of states)
            if (visible(state) && !state.event)
              expect(state.nightWalk || state.nightPorch, `${state.id} m${minute}`).toBeFalsy();
  }, 20_000);

  it('pauses at the garden gate for a real moment or walks on down the path', () => {
    let pauses = 0,
      ambles = 0,
      stops = 0;
    for (const [homes, day, step] of SAMPLES) {
      const frames = timeline(homes, day, step);
      const still = new Map<string, number>(),
        halts = new Map<string, number>();
      for (const { minute, states } of frames)
        for (const state of states) {
          const through =
            visible(state) &&
            state.lot?.spot === 'door' &&
            (state.lot.stage === 'from' || state.lot.stage === 'in');
          const since = still.get(state.id);
          if (through && !state.moving) {
            if (since === undefined) still.set(state.id, minute);
          } else if (since !== undefined) {
            // A stand between two strides down the path: never a moment's halt.
            if (through && state.moving) {
              expect(minute - since, `${state.id} m${since}`).toBeGreaterThanOrEqual(
                GATE_PAUSE - step - 1e-9,
              );
              pauses++;
            }
            still.delete(state.id);
          }
          if (through && state.moving) ambles++;
          // Nor anywhere else on the lot or on the kerb: up to the gate and back between two
          // outings, it is a real pause there too.
          const onLot = visible(state) && !!state.lot;
          const halted = halts.get(state.id);
          if (onLot && !state.moving) {
            if (halted === undefined) halts.set(state.id, minute);
          } else if (halted !== undefined) {
            if (onLot && state.moving && halted > frames[0].minute) {
              expect(minute - halted, `${state.id} m${halted} halts`).toBeGreaterThanOrEqual(
                GATE_PAUSE - step - 1e-9,
              );
              stops++;
            }
            halts.delete(state.id);
          }
        }
    }
    expect(pauses).toBeGreaterThan(0);
    expect(ambles).toBeGreaterThan(100);
    expect(stops).toBeGreaterThan(100);
    // Every short window between the road and the door or the road again, a tenth of a minute
    // apart in length: whatever the spot (the gate, the kerb, the step), a stand between two
    // strides is a real pause.
    const home = AFTER_HOURS;
    const plot = getPlot(home.plot)!;
    let short = 0;
    for (const [start, end] of [
      ['road', 'road'],
      ['door', 'road'],
      ['road', 'door'],
    ] as const)
      for (let length = 2; length <= 9; length += 0.1) {
        const plan = windowPlan(home, plot, DAY, { ws: 700, we: 700 + length, start, end });
        let halted: number | undefined,
          moved = false;
        for (let t = plan.shown; t < plan.hidden; t += 0.01) {
          const point = planAt(plan, t);
          if (point.indoors) continue;
          if (!point.moving) halted ??= t;
          else {
            if (halted !== undefined && moved) {
              expect(
                t - halted,
                `${start}-${end} ${length.toFixed(1)} at ${halted}`,
              ).toBeGreaterThanOrEqual(GATE_PAUSE - 0.02);
              short++;
            }
            halted = undefined;
            moved = true;
          }
        }
      }
    expect(short).toBeGreaterThan(50);
  }, 30_000);

  it('sits on its bench or porch more than on its front step', () => {
    let seat = 0,
      step = 0;
    for (const [homes, day, every] of SAMPLES)
      for (const { states } of timeline(homes, day, every))
        for (const state of states) {
          if (state.lot?.stage !== 'at') continue;
          const spots = homeSpots(state.home).map((spot) => spot.kind);
          if (!spots.includes('bench') && !spots.includes('porch')) continue;
          if (state.lot.spot === 'bench' || state.lot.spot === 'porch') seat += every;
          if (state.lot.spot === 'step') step += every;
        }
    expect(step).toBeGreaterThan(0);
    expect(seat).toBeGreaterThan(step * 1.5);
  }, 20_000);

  it('waits between two outings at the kerb, and says so', () => {
    const home = AFTER_HOURS;
    const plot = getPlot(home.plot)!;
    // Home from one outing three minutes before the next leaves: no time to go up the path.
    const plan = windowPlan(home, plot, DAY, { ws: 700, we: 703, start: 'road', end: 'road' });
    const point = planAt(plan, 701.5);
    expect(point).toMatchObject({ indoors: false, moving: false, lot: { spot: 'kerb' } });
    if (point.indoors) return;
    expect(point.position).toEqual(plotEntrance(plot));
    expect(
      residentActivityLabel({
        id: home.id,
        resident: home.resident,
        home,
        activity: 'stroll',
        greeting: false,
        ...point,
      }),
    ).toBe('Home for a moment between outings');
    // With a little longer, too short for the gate, they step up onto the kerb in front of the
    // lot, off the road's walking line, turn round through a quarter and pause there properly
    // before stepping back down to leave on time.
    const kerb = { x: plot.x + KERB_OFFSET.x, y: plot.y + KERB_OFFSET.y };
    const longer = windowPlan(home, plot, DAY, { ws: 800, we: 804.5, start: 'road', end: 'road' });
    const at = (t: number) => planAt(longer, t) as Extract<PlanPoint, { indoors: false }>;
    expect(at(800).position).toEqual(plotEntrance(plot));
    expect(distance(at(804.5 - 1e-9).position, plotEntrance(plot))).toBeLessThan(1e-6);
    expect(at(802.25)).toMatchObject({ position: kerb, moving: false, facing: 'sw' });
    expect(at(802.25).lot).toEqual({ spot: 'kerb', stage: 'at' });
    let stood = 0,
      facing = at(800).facing;
    for (let t = 800; t < 804.5; t += 0.01) {
      const now = at(t);
      expect(now.lot?.spot).toBe('kerb');
      if (!now.moving) stood += 0.01;
      // Never about in a single frame.
      expect(facing === now.facing || !opposite(facing, now.facing)).toBe(true);
      facing = now.facing;
    }
    expect(stood).toBeGreaterThanOrEqual(GATE_PAUSE);
  });
});
