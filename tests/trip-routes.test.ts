// The shape of every outing on foot, and how a neighbor looks while walking it and while there:
// no walking past a gate and back, a steady lane of their own on the road, a moment's crouch
// into and out of a seat, a quiet crowd once the band has gone, zoo visitors who look about, and
// a duck stop that keeps its gaze.
import { describe, expect, it } from 'vitest';
import { duckAwareWalk, DUCK_LOVE_SECONDS } from '../src/lib/duck-reactions';
import { ducksAt, DUCK_STREET_Y, DUCK_WALK_START } from '../src/lib/ducks';
import { EVENT_SPOTS, HOUSE_PLOTS, VENUES } from '../src/lib/events';
import { FOOTBALL_VENUE } from '../src/lib/football';
import { MILLPOND_VENUE } from '../src/lib/millpond';
import {
  eventApproach,
  eventRoute,
  eventTubeJourney,
  residentTrips,
  POSE_HOLD,
  SEAT_SETTLE,
  tripLanes,
  tripState,
  ZOO_CHEER,
  ZOO_TURN,
  type ResidentTrip,
} from '../src/lib/resident-trips';
import {
  LANE_DRIFT,
  LANE_SHIFT,
  LANE_TURN,
  laneAt,
  laneOffset,
  laneWalk,
  planLaneWalks,
  residentGround,
  routeLane,
} from '../src/lib/lanes';
import type { Place } from '../src/lib/schema';
import {
  residentActivityLabel,
  simulateResidents,
  type ResidentState,
} from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { laneSide, LANE_RAMP, legsMinutes, walkAlong, walkLane } from '../src/lib/tube-journeys';
import { TUBE_MIN_SAVING } from '../src/lib/tubes';
import { roadPath, routeLength, MAX_TRAVEL_SPEED_MULTIPLIER, WALK_SPEED } from '../src/lib/walking';
import { getPlot, plotEntrance, type Point } from '../src/lib/world';
import { fullTown, fullTownHouse, readPlaces } from './full-town';

const real = readPlaces();
const everyone = fullTown(real);
/** The harness's days: the published town for a whole year of 112 days, the full town for 28. */
const DAYS = (count: number) =>
  Array.from({ length: count }, (_, d) => CALENDAR_EPOCH_DAY + 224 + d);

/** Points where a walk turns straight back along the line it came in on (repeats skipped). */
function reversals(route: readonly Point[]): Point[] {
  const points = route.filter(
    (p, i) => i === 0 || p.x !== route[i - 1].x || p.y !== route[i - 1].y,
  );
  const turns: Point[] = [];
  for (let i = 1; i + 1 < points.length; i++) {
    const ax = points[i].x - points[i - 1].x,
      ay = points[i].y - points[i - 1].y,
      bx = points[i + 1].x - points[i].x,
      by = points[i + 1].y - points[i].y;
    if ((ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)) < -0.999)
      turns.push(points[i]);
  }
  return turns;
}
/** Every walk a planned outing makes on foot: the whole way unless it rides, and the walk legs. */
const walksOf = (trip: ResidentTrip): Point[][] => [
  ...(trip.legs ? [] : [trip.route]),
  ...(trip.returnLegs ? [] : [trip.returnRoute]),
  ...[...(trip.legs ?? []), ...(trip.returnLegs ?? [])]
    .filter((leg) => leg.kind === 'walk')
    .map((leg) => leg.route),
];
/** A neighbor's state on an outing at trip time `time` (past midnight counts on from 1440). */
function stateOn(home: Place, trip: ResidentTrip, time: number, day: number): ResidentState {
  return {
    id: home.id,
    resident: home.resident,
    home,
    position: plotEntrance(getPlot(home.plot)!),
    activity: 'stroll',
    moving: false,
    facing: 'se',
    walkPhase: 0,
    greeting: false,
    ...tripState(home, trip, time, day),
  };
}
/** Every planned outing of a town over some days, with its home and day. */
function outings(town: Place[], days: number[]) {
  return days.flatMap((day) =>
    [...residentTrips(town, day)].flatMap(([id, trips]) => {
      const home = town.find((place) => place.id === id)!;
      return trips.map((trip) => ({ home, trip, day }));
    }),
  );
}
const SEATED = ['sit', 'read', 'sip', 'chat'];

describe('Walking routes to the venues', () => {
  it('never walks past a gate, a lane or a seat and back, from any doorstep', () => {
    const venues = [
      ...VENUES.filter((venue) => venue.kind !== 'fork').flatMap((venue) =>
        EVENT_SPOTS[venue.kind].map((_, seat) => ({ venue, seat })),
      ),
      ...Array.from({ length: 6 }, (_, seat) => [
        { venue: FOOTBALL_VENUE, seat },
        { venue: MILLPOND_VENUE, seat },
      ]).flat(),
    ];
    let checked = 0,
      trimmed = 0,
      rides = 0;
    for (const plot of HOUSE_PLOTS) {
      const home = fullTownHouse(plot.id);
      const doorstep = plotEntrance(plot);
      for (const { venue, seat } of venues) {
        const event = { venue } as Parameters<typeof eventRoute>[1];
        const approach = eventApproach({ venue }, seat);
        const route = eventRoute(home, event, seat);
        // The road then the approach, end to end, as the town walked them before the join.
        const plain = [...roadPath(doorstep, approach[0]), ...approach.slice(1)];
        expect(route[0]).toEqual(doorstep);
        expect(route.at(-1)).toEqual(approach.at(-1));
        expect(reversals(route)).toEqual([]);
        expect(routeLength(route)).toBeLessThanOrEqual(routeLength(plain) + 1e-9);
        // Every stretch runs along a row or a column, like the roads and the approaches.
        route
          .slice(1)
          .forEach((p, i) => expect(p.x === route[i].x || p.y === route[i].y).toBe(true));
        if (reversals(plain).length) trimmed++;
        checked++;
        // A ride still saves its ten unhurried minutes against the shorter walk.
        const tube = eventTubeJourney(home, event, seat);
        if (!tube) continue;
        expect(routeLength(route) / WALK_SPEED - legsMinutes(tube.legs)).toBeGreaterThanOrEqual(
          TUBE_MIN_SAVING,
        );
        rides++;
      }
    }
    expect(checked).toBe(HOUSE_PLOTS.length * venues.length);
    // Most doorsteps used to overshoot somewhere: the gate lanes all share their entrance's row.
    expect(trimmed).toBeGreaterThan(1000);
    expect(rides).toBeGreaterThan(1000);
  });

  it('turns in at the zoo gate even when home is on the zoo road, east of the gate', () => {
    const zoo = VENUES.find((venue) => venue.kind === 'zoo')!;
    const approach = eventApproach({ venue: zoo }, 0);
    const gate = approach[1];
    const onZooRoad = HOUSE_PLOTS.filter((plot) => {
      const doorstep = plotEntrance(plot);
      return doorstep.y === gate.y && doorstep.x > gate.x && doorstep.x < approach[0].x;
    });
    expect(onZooRoad.length).toBeGreaterThan(0);
    for (const plot of onZooRoad) {
      const route = eventRoute(fullTownHouse(plot.id), { venue: zoo } as never, 0);
      // Straight west to the gate: never east to the old centre gate and back.
      expect(route.slice(0, 2)).toEqual([plotEntrance(plot), gate]);
      const onRoad = route.filter((p) => p.y === gate.y);
      expect(Math.max(...onRoad.map((p) => p.x))).toBe(plotEntrance(plot).x);
    }
  });

  it('plans no outing, walked or partly ridden, that turns back on itself', () => {
    for (const [town, days, least] of [
      [real, DAYS(112), 2000],
      [everyone, DAYS(28), 1000],
    ] as const) {
      let walks = 0,
        hops = 0;
      for (const { home, trip, day } of outings(town, days)) {
        for (const walk of walksOf(trip)) {
          expect(reversals(walk), `${home.id} ${trip.event.id} on day ${day}`).toEqual([]);
          walks++;
        }
        // The next outing walks from a cinema seat straight on to the stage for the night party.
        if (trip.continuesTo) hops++;
      }
      expect(walks).toBeGreaterThan(least);
      if (town === everyone) expect(hops).toBeGreaterThan(0);
    }
  });
});

describe('Lanes on the road', () => {
  it('keeps a paused walker in the same lane through the first step after the stop', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ];
    const sample = (time: number, side = 1) => ({
      ...walkAlong(route, (time < 5 ? time : time < 9 ? 5 : time - 4) / 20, side),
      moving: time < 5 || time >= 9,
    });
    const paused = laneWalk('a', 0, false, [{ route, start: 0, minutes: 24, sample }], 0, 24);
    // Opposite fixed lanes before and after the stop tempt the planner to swap sides during it.
    const before = laneWalk('b', 0, false, [{ route, start: 0, minutes: 20 }], 0, 5, -1);
    const after = laneWalk('c', 0, false, [{ route, start: 4, minutes: 20 }], 9, 24, 1);
    planLaneWalks([paused, before, after]);
    const ground = (time: number) => residentGround(sample(time, laneAt(paused.path!, time)));
    for (let time = 5; time <= 9; time += 0.05) expect(ground(time)).toEqual(ground(5));
    const a = ground(9 - 1e-6),
      b = ground(9 + 1e-6);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(1e-5);
  });

  it('plans lanes from actual motion when a walk slows down and catches up', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ];
    const sample = (time: number, side = 1) =>
      walkAlong(route, (time < 10 ? time / 2 : 5 + (time - 10) * 1.5) / 20, side);
    const slower = laneWalk('a', 0, false, [{ route, start: 0, minutes: 20, sample }], 0, 20);
    const steady = laneWalk('b', 0, false, [{ route, start: 0, minutes: 40 }], 0, 40);
    planLaneWalks([slower, steady]);
    // The first walk's average pace is twice the other's, but they actually walk together here.
    for (let time = 2; time <= 8; time += 0.2) {
      const a = residentGround(sample(time, laneAt(slower.path!, time)));
      const b = residentGround(walkAlong(route, time / 40, laneAt(steady.path!, time)));
      expect(Math.abs((a.x - a.y - b.x + b.y) * 38)).toBeGreaterThanOrEqual(7);
    }
  });

  it('moves overtaking walkers apart without lingering one head over the other', () => {
    // Two picnic return walks, fixed independently of the growing roster. A flat penalty for
    // every stacked position left them directly above one another for over three minutes.
    const routes = [
      [
        { x: 20.6, y: 12.75 },
        { x: 18.15, y: 12.75 },
        { x: 18.15, y: 13.5 },
        { x: 17.5, y: 13.5 },
        { x: 17.5, y: 17.5 },
        { x: 7.5, y: 17.5 },
      ],
      [
        { x: 19.95, y: 12.4 },
        { x: 18.15, y: 12.4 },
        { x: 18.15, y: 13.5 },
        { x: 17.5, y: 13.5 },
        { x: 17.5, y: 17.5 },
        { x: 15.5, y: 17.5 },
      ],
    ];
    const starts = [966.5, 963.9];
    const durations = [48.5, 29.84375];
    const walks = ['evergreen', 'stargazer'].map((id, i) =>
      laneWalk(
        id,
        0,
        false,
        [{ route: routes[i], start: starts[i], minutes: durations[i] }],
        starts[i],
        starts[i] + durations[i],
      ),
    );
    planLaneWalks(walks);
    let run = 0,
      longest = 0;
    for (let time = starts[0]; time < starts[1] + durations[1]; time += 0.05) {
      const [a, b] = walks.map((walk, i) =>
        residentGround(
          walkAlong(routes[i], (time - starts[i]) / durations[i], laneAt(walk.path!, time)),
        ),
      );
      const across = Math.abs((a.x - a.y - b.x + b.y) * 38);
      const down = Math.abs((a.x + a.y - b.x - b.y) * 19);
      run = across < 7 && down < 22 ? run + 0.05 : 0;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThan(3);
  });

  it('gives each neighbor a steady side of their own, eased in and out of every walk', () => {
    const sides = real.map((home) => laneSide(home.id));
    for (const side of sides) expect(Math.abs(side)).toBeLessThanOrEqual(1);
    // Hashed from the id, so a big town may repeat a side now and then, but no more than that.
    expect(new Set(sides).size).toBeGreaterThanOrEqual(Math.floor(real.length * 0.9));
    expect(sides.some((side) => side > 0.5) && sides.some((side) => side < -0.5)).toBe(true);
    expect(laneSide(real[0].id)).toBe(laneSide(real[0].id));
    expect(walkLane(0.8, 0, 10)).toBe(0);
    expect(walkLane(0.8, 10, 10)).toBe(0);
    expect(walkLane(0.8, LANE_RAMP / 2, 10)).toBeCloseTo(0.4, 12);
    expect(walkLane(0.8, 5, 10)).toBe(0.8);
    expect(walkLane(-0.8, 10 - LANE_RAMP, 10)).toBeCloseTo(-0.8, 12);
  });

  it('walks each outing in its lane, on foot only, and back on the line at every end', () => {
    const fastest = WALK_SPEED * MAX_TRAVEL_SPEED_MULTIPLIER,
      STEP = 0.1;
    let walking = 0,
      rides = 0,
      turned = 0;
    // Three days of the published town (under a hundred outings); a full town takes as many.
    for (const { home, trip, day } of outings(real, DAYS(3)).slice(0, 120)) {
      if (trip.event.venue.kind === 'millpond') continue;
      const lanes = tripLanes(trip, home.id);
      const at = (t: number) => stateOn(home, trip, t, day);
      for (const [from, to, path] of [
        [trip.depart, trip.arrive, lanes.going],
        [trip.leave, trip.homeBy, lanes.returning],
      ] as const) {
        // The lane is 0 where a walk leaves and where it arrives.
        expect(at(from).lane ?? 0).toBe(0);
        expect(Math.abs(at(to - 1e-6).lane ?? 0)).toBeLessThan(1e-4);
        let before = at(from);
        for (let t = from + STEP; t < to; t += STEP) {
          const now = at(t);
          // The planned lane, eased in and out of the walk's ends.
          const side = laneAt(path, t);
          expect(Math.abs(side)).toBeLessThanOrEqual(1);
          if (now.lane !== undefined) {
            expect(now.moving).toBe(true);
            expect(now.transit).toBeUndefined();
            expect(Math.abs(now.lane)).toBeLessThanOrEqual(Math.abs(side));
            expect(Math.sign(now.lane)).toBe(Math.sign(side));
            // Drawn a lane's width off the line at most, to the side of the way they walk.
            const shift = now.laneOffset!;
            expect(Math.hypot(shift.x, shift.y)).toBeLessThanOrEqual(
              LANE_SHIFT * Math.abs(now.lane) + 1e-9,
            );
            const ahead = { se: [1, 0], sw: [0, 1], ne: [0, -1], nw: [-1, 0] }[now.facing];
            if (Math.abs(shift.x * ahead[0] + shift.y * ahead[1]) > 1e-9) turned++;
          } else expect(now.laneOffset).toBeUndefined();
          if (now.transit) rides++;
          else if (now.moving) walking++;
          // Eased: never more than a walking step's worth of ramp from one sample to the next,
          // and a planned lane drifts across at most LANE_DRIFT a minute.
          expect(Math.abs((now.lane ?? 0) - (before.lane ?? 0))).toBeLessThanOrEqual(
            (fastest * STEP) / LANE_RAMP + LANE_DRIFT * STEP + 1e-9,
          );
          // And drawn without a hop, rounding corners in their lane too.
          if (!now.transit && !before.transit && now.moving && before.moving) {
            const a = residentGround(before),
              b = residentGround(now);
            expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(fastest * STEP * 1.35);
          }
          before = now;
        }
      }
      // Out in the lane on a long straight walk: the middle of the way there.
      if (!trip.legs && routeLength(trip.route) > 4 * LANE_RAMP) {
        const t = (trip.depart + trip.arrive) / 2;
        const middle = at(t);
        if (middle.moving) expect(middle.lane ?? 0).toBe(laneAt(lanes.going, t));
      }
      // Nobody keeps a lane while at the venue.
      expect(at((trip.arrive + trip.leave) / 2).lane).toBeUndefined();
    }
    expect(walking).toBeGreaterThan(2000);
    expect(rides).toBeGreaterThan(20);
    // Corners are rounded, turning the lane with the walk rather than hopping across.
    expect(turned).toBeGreaterThan(50);
  }, 60_000);

  it('draws neighbors who walk together side by side, not as one figure', () => {
    // Pairs of walkers heading the same way, and how long each pair is drawn as one figure at
    // zoom 1 (figures about 12 px wide and 27 tall): within 6 px across and 12 up or down they
    // read as one; within 7 across and 22 up or down, one head over the other, as a two-headed
    // one. The published town for four days (one of them a busy one, with the stage's night owls
    // out late), and a full town for a day.
    const STEP = 0.2;
    let together = 0,
      close = 0;
    const longest = { fused: 0, stacked: 0 };
    const longestAt = { fused: '', stacked: '' };
    for (const [town, days] of [
      [real, [...DAYS(3), DAYS(43)[42]]],
      [everyone, DAYS(1)],
    ] as const)
      for (const day of days) {
        const runs = { fused: new Map<string, number>(), stacked: new Map<string, number>() };
        for (let minute = 360; minute < 1800; minute += STEP) {
          const states = simulateResidents(town, minute % 1440, day + Math.floor(minute / 1440));
          const walkers = states.filter(
            (state) =>
              state.activity === 'stroll' &&
              state.moving &&
              !state.transit &&
              state.fade === undefined,
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
              // Walkers the simulation has on one spot of the road (lockstep), and how many of
              // those moments lanes still draw on top of each other.
              if (Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) < 0.2) {
                together++;
                if (x < 8 && y < 8) close++;
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
                if (run > longest[kind]) {
                  longest[kind] = run;
                  longestAt[kind] =
                    `${town === real ? 'published' : 'full'} town: ${key}, day ${day}, ending at ${minute.toFixed(2)}`;
                }
              }
            }
          for (const kind of ['fused', 'stacked'] as const)
            for (const key of [...runs[kind].keys()])
              if (!now[kind].has(key)) runs[kind].delete(key);
        }
      }
    expect(together).toBeGreaterThan(300);
    // Lanes keep all but a few moments apart (where two walks both ease in to a doorstep or a
    // seat, or one walker overtakes another), and never draw two neighbors as one figure for
    // long: under two minutes as one, under three one head over the other.
    expect(close / together).toBeLessThan(0.1);
    expect(longest.fused, longestAt.fused).toBeLessThan(2);
    expect(longest.stacked, longestAt.stacked).toBeLessThan(3);
  }, 60_000);

  it('gives lanes that stay put on a straight and turn smoothly round a corner', () => {
    const route = [
      { x: 0.5, y: 0.5 },
      { x: 4.5, y: 0.5 },
      { x: 4.5, y: 4.5 },
    ];
    // Lane 1 is to the right of the screen whichever way they walk: -y of the line along x (up
    // and right on screen), +x of it along y (down and right).
    const first = laneOffset(route, 1, 1)!;
    expect(first.x).toBeCloseTo(0, 12);
    expect(first.y).toBeCloseTo(-LANE_SHIFT, 12);
    const along = laneOffset(route, 6, 1)!;
    expect(along.x).toBeCloseTo(LANE_SHIFT, 12);
    expect(along.y).toBeCloseTo(0, 12);
    for (const [a, b] of [
      [
        { x: 4.5, y: 4.5 },
        { x: 0.5, y: 4.5 },
      ],
      [
        { x: 0.5, y: 4.5 },
        { x: 0.5, y: 0.5 },
      ],
    ]) {
      const back = laneOffset([a, b], 1, 1)!;
      expect(back.x - back.y).toBeCloseTo(LANE_SHIFT, 12);
    }
    expect(laneOffset(route, 2, 0)).toBeUndefined();
    let before = laneOffset(route, 0, 1)!;
    for (let walked = 0.05; walked <= 8; walked += 0.05) {
      const now = laneOffset(route, walked, 1)!;
      expect(Math.hypot(now.x - before.x, now.y - before.y)).toBeLessThan(
        (LANE_SHIFT * Math.SQRT2 * 0.05) / (2 * LANE_TURN) + 1e-9,
      );
      // Round the corner it stays a lane's width to the right on screen, never swinging up or
      // down over the line, so two walkers turning it in lanes apart stay side by side.
      expect((now.x - now.y) * 38).toBeGreaterThanOrEqual(LANE_SHIFT * 38 - 1e-9);
      before = now;
    }
    // Through the stage's crowd a walk keeps to the line: the lane is 0 on its lawn.
    const stage = VENUES.find((venue) => venue.kind === 'stage')!;
    const home = everyone.find((place) => place.plot === 'A1')!;
    const approach = eventRoute(home, { venue: stage } as never, 0);
    const length = routeLength(approach);
    expect(routeLane(approach, length - 0.3, 1)).toBe(0);
    expect(routeLane(approach, length / 2, 1)).toBe(1);
  });

  it('eases the lane to 0 at the station door before boarding and after stepping off', () => {
    let doors = 0;
    for (const { home, trip, day } of outings(real, DAYS(14)))
      for (const [legs, start] of [
        [trip.legs, trip.depart],
        [trip.returnLegs, trip.leave],
      ] as const) {
        if (!legs) continue;
        let at = start;
        for (const leg of legs) {
          const end = at + leg.minutes;
          if (leg.kind === 'walk') {
            for (const t of [at + 1e-6, end - 1e-6])
              expect(Math.abs(stateOn(home, trip, t, day).lane ?? 0)).toBeLessThan(1e-4);
            doors++;
          }
          at = end;
        }
      }
    expect(doors).toBeGreaterThan(100);
  });
});

describe('At the venue', () => {
  it('crouches for a moment sitting down on a blanket or a cinema seat, and getting up', () => {
    let seats = 0,
      players = 0;
    for (const { home, trip, day } of outings(everyone, DAYS(4))) {
      const kind = trip.event.venue.kind;
      const pose = (t: number) => stateOn(home, trip, t, day).pose;
      if (kind !== 'green' && kind !== 'cinema') {
        for (const t of [trip.arrive + SEAT_SETTLE / 2, trip.leave - SEAT_SETTLE / 2])
          expect(pose(t)).not.toBe('crouch');
        continue;
      }
      const settled = pose(trip.arrive + SEAT_SETTLE + 0.01);
      const rising = pose(trip.leave - SEAT_SETTLE - 0.01);
      // Standing guests (games players) may drop their pose while they turn to go.
      const standing = (at: number, shown: string | undefined) =>
        SEATED.includes(shown!) ? 'crouch' : pose(at) === undefined ? undefined : shown;
      for (const t of [trip.arrive + 0.001, trip.arrive + SEAT_SETTLE - 0.001])
        expect(pose(t)).toBe(standing(t, settled));
      for (const t of [trip.leave - SEAT_SETTLE / 2, trip.leave - 0.001])
        expect(pose(t)).toBe(standing(t, rising));
      // Standing up again to walk away: no pose once walking.
      expect(pose(trip.leave + 0.001)).toBeUndefined();
      seats++;
      // Waiting sat on the blanket for the games, a player gets up (halfway, then up) to play;
      // one there with under a minute to wait stays on their feet.
      const start = trip.event.start;
      if (
        trip.arrive < start &&
        trip.arrive + SEAT_SETTLE + POSE_HOLD > start &&
        pose(start + 0.01) === 'play'
      )
        expect(pose(start - 0.01)).toBeUndefined();
      if (
        trip.arrive + SEAT_SETTLE + POSE_HOLD <= start &&
        pose(start + SEAT_SETTLE + 0.01) === 'play'
      ) {
        expect(pose(start - 0.01)).toBe('sit');
        expect(pose(start + 0.001)).toBe('crouch');
        expect(pose(start + SEAT_SETTLE - 0.001)).toBe('crouch');
        players++;
      }
    }
    expect(seats).toBeGreaterThan(40);
    expect(players).toBeGreaterThan(0);
  });

  it('holds each pose a minute at least as a guest settles in, the show starts and they go', () => {
    // Frame by frame (30 a town minute) around each guest's arrival, the start and leaving, over
    // the published town's year: every pose seen begin and end there lasts POSE_HOLD at least,
    // but for the crouch sitting down or getting up.
    let runs = 0;
    for (const { home, trip, day } of outings(real, DAYS(112))) {
      const kind = trip.event.venue.kind;
      if (kind !== 'green' && kind !== 'stage' && kind !== 'cinema') continue;
      for (const [from, to] of [
        [trip.arrive, trip.arrive + 3],
        [trip.event.start - 2, trip.event.start + 3],
        [trip.leave - 3, trip.leave],
      ]) {
        let pose: string | undefined,
          since = -Infinity;
        for (let t = Math.max(from, trip.arrive); t < Math.min(to, trip.leave); t += 1 / 30) {
          const now = stateOn(home, trip, t, day).pose;
          if (now === pose) continue;
          if (pose && pose !== 'crouch' && since > from) {
            expect(
              t - since,
              `${home.id} ${trip.event.id} ${pose} at ${since.toFixed(2)}`,
            ).toBeGreaterThan(POSE_HOLD - 1 / 15);
            runs++;
          }
          pose = now;
          since = t;
        }
      }
    }
    expect(runs).toBeGreaterThan(100);
  }, 30_000);

  it('turns through a quarter arriving at a spot or leaving it, never about in a frame', () => {
    const opposite = { se: 'nw', nw: 'se', sw: 'ne', ne: 'sw' } as const;
    let turns = 0;
    for (const { home, trip, day } of outings(everyone, DAYS(4))) {
      if (trip.event.venue.kind === 'millpond') continue;
      const at = (t: number) => stateOn(home, trip, t, day);
      for (const [from, to] of [
        [trip.arrive - 0.2, trip.arrive + 0.6],
        [trip.leave - 0.6, trip.leave + 0.2],
      ]) {
        let before = at(from);
        for (let t = from + 0.02; t < to; t += 0.02) {
          const now = at(t);
          expect(now.facing, `${home.id} ${trip.event.id} at ${t.toFixed(2)}`).not.toBe(
            opposite[before.facing],
          );
          if (now.facing !== before.facing && !now.moving && !before.moving) turns++;
          before = now;
        }
      }
    }
    // Football fans, dancers and blanket guests turn back to leave the way they came.
    expect(turns).toBeGreaterThan(100);
    // And every outing of the published town's year, frame by frame (30 a town minute): a zoo
    // visitor's look about never starts so late that it runs into the turn to go.
    let frames = 0;
    for (const { home, trip, day } of outings(real, DAYS(112))) {
      if (trip.event.venue.kind === 'millpond') continue;
      for (const [from, to] of [
        [trip.arrive - 0.3, trip.arrive + 0.5],
        [trip.leave - 0.6, trip.leave + 0.2],
      ]) {
        let before = tripState(home, trip, from, day).facing!;
        for (let t = from + 1 / 30; t < to; t += 1 / 30) {
          const now = tripState(home, trip, t, day).facing!;
          expect(now, `${home.id} ${trip.event.id} at ${t.toFixed(3)}`).not.toBe(opposite[before]);
          before = now;
          frames++;
        }
      }
    }
    expect(frames).toBeGreaterThan(100_000);
  }, 30_000);

  it('turns round on the doorstep between two outings, never about in a frame', () => {
    const opposite = { se: 'nw', nw: 'se', sw: 'ne', ne: 'sw' } as const;
    let chains = 0;
    for (const day of DAYS(28)) {
      const plan = residentTrips(real, day);
      for (const home of real) {
        const trips = plan.get(home.id) ?? [];
        for (let i = 1; i < trips.length; i++) {
          const handoff = trips[i].depart;
          if (trips[i - 1].continuesTo || trips[i - 1].homeBy !== handoff) continue;
          const state = (t: number) =>
            simulateResidents(real, t % 1440, day + Math.floor(t / 1440)).find(
              (s) => s.id === home.id,
            )!;
          let before = state(handoff - 0.5);
          let still = 0;
          for (let t = handoff - 0.49; t < handoff + 0.5; t += 0.01) {
            const now = state(t);
            expect(now.facing, `${home.id} d${day - DAYS(1)[0]} ${t.toFixed(2)}`).not.toBe(
              opposite[before.facing],
            );
            // Never further than a step from the doorstep, and never faster than a brisk walk.
            const drawn = [residentGround(before), residentGround(now)];
            expect(Math.hypot(drawn[1].x - drawn[0].x, drawn[1].y - drawn[0].y)).toBeLessThan(
              WALK_SPEED * MAX_TRAVEL_SPEED_MULTIPLIER * 0.01 * 1.35,
            );
            if (!now.moving) still++;
            before = now;
          }
          if (still) chains++;
        }
      }
    }
    expect(chains).toBeGreaterThan(3);
  }, 30_000);

  it('stops swaying and cheering at the stage once the band has gone', () => {
    let lingering = 0;
    for (const { home, trip, day } of outings(everyone, DAYS(7))) {
      if (trip.event.venue.kind !== 'stage') continue;
      const at = (t: number) => stateOn(home, trip, t, day);
      const start = Math.max(trip.arrive, trip.event.start);
      expect(['sway', 'cheer', 'dance']).toContain(at(start + 1).pose);
      for (let t = trip.event.end; t < trip.leave; t += 0.1) {
        expect(at(t).event?.phase).toBe('attending');
        expect(at(t).pose).toBeUndefined();
        lingering++;
      }
    }
    expect(lingering).toBeGreaterThan(100);
  });

  it('lets zoo visitors look about from their spot, one side then the other, now and then cheering', () => {
    let visits = 0,
      cheers = 0;
    // Which way each visitor looks, minute by minute, per day.
    const looks = new Map<string, string[]>();
    for (const { home, trip, day } of outings(everyone, DAYS(7))) {
      if (trip.event.id !== 'zoo') continue;
      visits++;
      for (let t = Math.ceil(trip.arrive); t < trip.leave; t++) {
        const key = `${day}:${t}`;
        looks.set(key, [...(looks.get(key) ?? []), stateOn(home, trip, t, day).facing]);
      }
      const at = (t: number) => stateOn(home, trip, t, day);
      let look = at(trip.arrive).facing,
        since = trip.arrive,
        cheering = -1;
      expect(look).toBe('ne');
      for (let i = 0, t = trip.arrive; t < trip.leave; i++, t = trip.arrive + i * 0.1) {
        const now = at(t);
        expect(now.position).toEqual(trip.route.at(-1));
        expect(now.moving).toBe(false);
        if (i % 10 === 0)
          expect(residentActivityLabel(now)).toBe('Watching the animals at Willow Grove Zoo');
        if (now.facing === 'se' || now.facing === 'nw') {
          // Turning clockwise: north-east through south-east to south-west, and back via north-west.
          expect(now.facing).toBe(look === 'ne' ? 'se' : 'nw');
          continue;
        }
        if (now.facing !== look) {
          expect(now.facing).toBe(look === 'ne' ? 'sw' : 'ne');
          const length = t - since;
          // Each look lasts 5 to 11 minutes, the turn included.
          expect(length).toBeGreaterThan(5 - 0.2);
          expect(length).toBeLessThan(11 + ZOO_TURN + 0.2);
          look = now.facing;
          since = t - ZOO_TURN;
        }
        if (now.pose === 'cheer') {
          if (cheering < 0) cheering = t;
          // Carried to the figure, which draws no music notes at the zoo (tests/lot-art).
          expect(now.event?.id).toBe('zoo');
          expect(t - cheering).toBeLessThan(ZOO_CHEER + 0.1);
        } else {
          if (cheering >= 0) cheers++;
          cheering = -1;
          expect(now.pose).toBeUndefined();
        }
      }
    }
    expect(visits).toBeGreaterThan(20);
    expect(cheers).toBeGreaterThan(visits / 2);
    // Staggered: with three or more visitors in, they seldom all look the same way at once.
    const crowds = [...looks.values()].filter((facings) => facings.length >= 3);
    const together = crowds.filter((facings) => new Set(facings).size === 1).length;
    expect(crowds.length).toBeGreaterThan(300);
    expect(together / crowds.length).toBeLessThan(0.35);
  });
});

describe('Stopping for the ducklings', () => {
  it('freezes the drawn figure during a stop and uses the current lane while catching up', () => {
    const crossingX = ducksAt(540)[0].position.x;
    const walk = (routeTime: number, laneTime: number) => ({
      position: { x: crossingX + (routeTime - 540) * 0.15, y: DUCK_STREET_Y },
      laneOffset: { x: 0, y: laneTime / 1000 },
      moving: true,
      facing: 'se' as const,
      walkPhase: (routeTime * 0.45) % 1,
    });
    const at = (time: number) => duckAwareWalk('test:lane-clock', time, 360, 720, walk);
    let stops = 0;
    for (let start = DUCK_WALK_START; start < 720; start += 0.5) {
      if (!at(start).duckLove || at(start - 0.5).duckLove) continue;
      const ground = residentGround(at(start));
      for (let t = start; t < start + DUCK_LOVE_SECONDS; t += 0.05)
        expect(residentGround(at(t))).toEqual(ground);
      const time = start + DUCK_LOVE_SECONDS + 1;
      const recovering = at(time);
      expect(recovering.moving).toBe(true);
      expect(residentGround(recovering).y).toBeCloseTo(DUCK_STREET_Y + time / 1000, 12);
      expect(recovering.position.x).toBeLessThan(walk(time, time).position.x);
      stops++;
    }
    expect(stops).toBeGreaterThan(0);
  });

  it('keeps looking at the duck that caught their eye for the whole stop', () => {
    const crossingX = ducksAt(540)[0].position.x;
    const walk = (time: number) => ({
      position: { x: crossingX + (time - 540) * 0.15, y: DUCK_STREET_Y },
      moving: true,
      facing: 'se' as const,
      walkPhase: (time * 0.45) % 1,
    });
    // This walker meets the family head-on: the nearest duck swims past during the stop, which
    // used to swing the walker from south-east to north-east mid-stop.
    const reaction = (time: number) => duckAwareWalk('test:gaze', time, 360, 720, walk);
    let stops = 0;
    for (let start = DUCK_WALK_START; start < 720; start += 0.5) {
      if (!reaction(start).duckLove || reaction(start - 0.5).duckLove) continue;
      const facing = reaction(start).facing;
      for (let t = start; t < start + DUCK_LOVE_SECONDS; t += 0.05)
        expect(reaction(t).facing).toBe(facing);
      stops++;
    }
    expect(stops).toBeGreaterThan(0);
  });
});
