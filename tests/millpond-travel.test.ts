import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { placeSchema, type Place } from '../src/lib/schema';
import { HOUSE_PLOTS } from '../src/lib/events';
import { getPlot, isRoad, plotEntrance, type Point } from '../src/lib/world';
import { roadPath } from '../src/lib/walking';
import { residentTrips, tripState, type ResidentTrip } from '../src/lib/resident-trips';
import { residentActivityLabel, simulateResidents } from '../src/lib/simulation';
import { project } from '../src/lib/world';
import {
  MILLPOND_GATE,
  MILLPOND_MILL,
  SEAT_LOOPS,
  SHORE_Y,
  SKATE_LOOPS,
  SKATING,
  behindMill,
  insideMillpond,
  insideWater,
  loopForSeat,
  millpondRoute,
  millpondSkatingDay,
  skateGlide,
} from '../src/lib/millpond';

// A roster-proof crowd: 36 synthetic homes on rows A–E who stroll all day.
const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
const homes: Place[] = HOUSE_PLOTS.slice(0, 36).map((plot, index) => ({
  ...sample,
  id: `skater-${index}`,
  plot: plot.id,
  resident: {
    ...sample.resident,
    routine: { morning: 'stroll', afternoon: 'stroll', evening: 'stroll', night: 'stroll' },
  },
}));
const SKATING_DAYS = [76, 77, 86];
const QUIET_DAYS = [75, 87, 70, 20];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const onRoad = (p: Point) => isRoad(Math.floor(p.x), Math.floor(p.y));
const skaterTrips = (day: number, places = homes) =>
  [...residentTrips(places, day)].flatMap(([id, trips]) =>
    trips
      .filter((trip) => trip.event.id === 'millpond')
      .map((trip) => ({ home: places.find((h) => h.id === id)!, trip })),
  );
/** Distance from a point to its seat's loop (sampled). */
const offLoop = (p: Point, seat: number) => {
  const loop = loopForSeat(seat);
  let best = Infinity;
  for (let i = 0; i < 720; i++) {
    const t = (i / 720) * Math.PI * 2;
    best = Math.min(
      best,
      distance(p, { x: loop.x + loop.rx * Math.cos(t), y: loop.y + loop.ry * Math.sin(t) }),
    );
  }
  return best;
};
/** Distance from a point to a polyline. */
const offRoute = (p: Point, route: Point[]) => {
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i],
      b = route[i + 1];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, distance(p, { x: a.x + u * dx, y: a.y + u * dy }));
  }
  return best;
};
const southPoint = (seat: number) => {
  const loop = loopForSeat(seat);
  return { x: loop.x, y: loop.y + loop.ry };
};
/**
 * The water rule: a resident is on the ice only while skating, and then only on their own loop
 * (attending) or on the ice legs of their own route in from the gate (going and returning).
 */
const onTheirIce = (p: Point, seat: number, phase: string) =>
  phase === 'attending' ? offLoop(p, seat) < 0.05 : offRoute(p, millpondRoute(seat)) < 0.05;
// The walker sprite's recorded extent (critique probe code-mill-occlusion): ±8.75 px, 32.5 px up.
const WALKER = { half: 8.75, up: 32.5 };
/** The mill is one depth object at its south-west corner: anything with a smaller x + y is drawn first. */
const MILL_DEPTH = MILLPOND_MILL.left + MILLPOND_MILL.bottom;

describe('Skating on the Millpond', () => {
  it('only plans skaters on fully frozen days', () => {
    for (const day of SKATING_DAYS) {
      expect(millpondSkatingDay(day)).toBe(true);
      expect(skaterTrips(day).length).toBeGreaterThan(0);
    }
    for (const day of QUIET_DAYS) {
      expect(millpondSkatingDay(day)).toBe(false);
      expect(skaterTrips(day)).toHaveLength(0);
    }
  });

  it('seats at most six skaters, each on their own loop, never double-booked for the afternoon', () => {
    for (const day of SKATING_DAYS) {
      const skaters = skaterTrips(day);
      expect(skaters.length).toBeLessThanOrEqual(6);
      const seats = skaters.map(({ trip }) => trip.seat);
      expect(new Set(seats).size).toBe(seats.length);
      for (const seat of seats) expect(seat).toBeLessThan(SKATE_LOOPS.length);
      const plans = residentTrips(homes, day);
      for (const { home, trip } of skaters) {
        // Posted 14:00–16:40; the plan ends 6.5 minutes early so the last seat's stagger
        // still has everyone off the ice by 16:40.
        expect(trip.event).toMatchObject({
          name: 'Skating on the Millpond',
          start: SKATING.start,
          end: SKATING.end - 6.5,
        });
        expect(trip.leave).toBeLessThanOrEqual(SKATING.end);
        expect(trip.homeBy).toBeLessThanOrEqual(trip.availableUntil);
        const others = plans.get(home.id)!.filter((t) => t !== trip);
        // Never also a picnic, the zoo or the afternoon football on the same day.
        for (const other of others) expect(other.event.period).not.toBe('afternoon');
      }
      for (const trips of plans.values())
        trips.forEach((trip, i) => {
          expect(trip.homeBy).toBeLessThanOrEqual(trip.availableUntil);
          if (i) expect(trips[i - 1].homeBy).toBeLessThanOrEqual(trip.depart);
        });
    }
  });

  it('fills the loops in full view first, and leaves the mill-side loop for the sixth skater', () => {
    expect(SEAT_LOOPS).toEqual([4, 1, 2, 5, 3, 0]);
    expect([...SEAT_LOOPS].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    for (let seat = 0; seat < SKATE_LOOPS.length; seat++)
      expect(loopForSeat(seat)).toBe(SKATE_LOOPS[SEAT_LOOPS[seat]]);
    for (let seat = 0; seat < 5; seat++)
      expect(loopForSeat(seat).x).toBeGreaterThan(MILLPOND_MILL.right);
    expect(loopForSeat(5)).toBe(SKATE_LOOPS[0]);
    expect(loopForSeat(5).x).toBeLessThan(MILLPOND_MILL.right);
  });

  it('walks in by the south gate and the shore path, onto the ice only on the last legs, never behind the mill', () => {
    for (const plot of HOUSE_PLOTS)
      expect(roadPath(plotEntrance(plot), MILLPOND_GATE).at(-1)).toEqual(MILLPOND_GATE);
    let behind = 0,
      checked = 0;
    for (let seat = 0; seat < SKATE_LOOPS.length; seat++) {
      const route = millpondRoute(seat);
      const loop = loopForSeat(seat);
      expect(route[0]).toEqual(MILLPOND_GATE);
      expect(route[1]).toEqual({ x: MILLPOND_GATE.x, y: SHORE_Y });
      expect(route.at(-1)).toEqual(southPoint(seat));
      expect(insideWater(route.at(-1)!)).toBe(true);
      if (loop.x > MILLPOND_MILL.right)
        // Straight up its own column from the shore path.
        expect(route).toEqual([
          MILLPOND_GATE,
          { x: MILLPOND_GATE.x, y: SHORE_Y },
          { x: loop.x, y: SHORE_Y },
          southPoint(seat),
        ]);
      else {
        // The mill-side loop: up loop 1's column, then west across the ice north of the mill.
        const via = SKATE_LOOPS[1].x;
        expect(route).toHaveLength(6);
        expect(route[2]).toEqual({ x: via, y: SHORE_Y });
        expect(route[3].x).toBe(via);
        expect(route[4].y).toBe(route[3].y);
        expect(route[4].x).toBe(loop.x);
        expect(route[3].y).toBeGreaterThan(southPoint(seat).y);
      }
      // Dry along the gate lane and the shore path; once on the ice, it stays on the ice.
      let wet = false;
      for (let i = 0; i < route.length - 1; i++)
        for (let k = 0; k <= 100; k++) {
          const p = {
            x: route[i].x + ((route[i + 1].x - route[i].x) * k) / 100,
            y: route[i].y + ((route[i + 1].y - route[i].y) * k) / 100,
          };
          expect(onRoad(p) || insideMillpond(p)).toBe(true);
          if (i < 2) expect(insideWater(p)).toBe(false);
          if (insideWater(p)) wet = true;
          else expect(wet).toBe(false);
          // Wherever the mill is drawn over a walker, no pixel of the walker lies under it.
          if (p.x + p.y >= MILL_DEPTH) continue;
          checked++;
          const s = project(p.x, p.y);
          for (let dx = -WALKER.half; dx <= WALKER.half; dx += 0.5)
            for (let dy = 0; dy <= WALKER.up; dy += 0.5)
              if (behindMill({ x: s.x + dx, y: s.y - dy })) behind++;
        }
    }
    // (Every sample behind the mill's depth: the whole crossing and the far end of loop 1's column.)
    expect(checked).toBeGreaterThan(200);
    expect(behind).toBe(0);
  });

  it('glides whole laps from the loop south point and back, never faster than 0.448 tiles a minute', () => {
    for (let seat = 0; seat < SKATE_LOOPS.length; seat++)
      for (const [from, until] of [
        [840, 1000],
        [851.3, 877],
        [845, 999.2],
      ]) {
        const loop = loopForSeat(seat);
        const south = southPoint(seat);
        expect(distance(skateGlide(seat, from, until, from).position, south)).toBeLessThan(1e-9);
        expect(distance(skateGlide(seat, from, until, until).position, south)).toBeLessThan(1e-9);
        for (let t = from; t < until; t += 0.05) {
          const a = skateGlide(seat, from, until, t).position,
            b = skateGlide(seat, from, until, t + 0.01).position;
          expect(distance(a, b) / 0.01).toBeLessThanOrEqual(0.448);
          expect(((a.x - loop.x) / loop.rx) ** 2 + ((a.y - loop.y) / loop.ry) ** 2).toBeCloseTo(
            1,
            9,
          );
        }
      }
  });

  it.each(SKATING_DAYS)(
    'keeps every skater on the roads, the shore path, their own route in or their loop on day %i',
    { timeout: 20_000 },
    (day) => {
      const skaters = skaterTrips(day);
      expect(skaters.length).toBeGreaterThan(0);
      for (const { home, trip } of skaters) {
        const at = (t: number) => tripState(home, trip, t, day);
        for (let t = trip.depart; t <= trip.homeBy; t += 0.25) {
          const state = at(t);
          const p = state.position!;
          const phase = state.event!.phase;
          expect(onRoad(p) || insideMillpond(p)).toBe(true);
          if (insideWater(p)) expect(onTheirIce(p, trip.seat, phase)).toBe(true);
          // Skating from the moment they reach the loop until they step off it: no standing about.
          const attending = phase === 'attending';
          expect(attending).toBe(t >= trip.arrive && t < trip.leave);
          expect(state.pose === 'skate').toBe(attending);
          if (attending) {
            expect(state.moving).toBe(false);
            expect(offLoop(p, trip.seat)).toBeLessThan(0.01);
          }
        }
        // The outing's real edges, each inside it: out of the door, onto the ice at the loop's
        // south point, off it there again, and home.
        expect(trip.depart).toBeLessThan(trip.arrive);
        expect(trip.arrive).toBeLessThan(trip.leave);
        expect(trip.leave).toBeLessThan(trip.homeBy);
        expect(trip.leave).toBeLessThanOrEqual(SKATING.end);
        for (const edge of [trip.depart, trip.arrive, trip.leave, trip.homeBy])
          expect(distance(at(edge - 0.001).position!, at(edge + 0.001).position!)).toBeLessThan(
            0.002,
          );
        for (const edge of [trip.arrive, trip.leave])
          expect(distance(at(edge).position!, southPoint(trip.seat))).toBeLessThan(1e-9);
        expect(at(trip.arrive - 0.001).event!.phase).toBe('going');
        expect(at(trip.arrive + 0.001).pose).toBe('skate');
        expect(at(trip.leave - 0.001).pose).toBe('skate');
        expect(at(trip.leave + 0.001).event!.phase).toBe('returning');
        // Away from the doorstep in between (the edges are not all one clamped point).
        expect(distance(at(trip.depart).position!, at(trip.arrive).position!)).toBeGreaterThan(1);
        // Glide speed while attending.
        const from = trip.arrive;
        for (let t = from; t < trip.leave - 0.01; t += 0.05)
          expect(distance(at(t).position!, at(t + 0.01).position!) / 0.01).toBeLessThanOrEqual(
            0.448,
          );
      }
    },
  );

  it.each(SKATING_DAYS)(
    'keeps the whole crowd off the ice unless skating, with skate poses only on the ice on day %i',
    { timeout: 20_000 },
    (day) => {
      const skaters = new Map(skaterTrips(day).map(({ home, trip }) => [home.id, trip]));
      for (let t = 700; t <= 1100; t += 1) {
        for (const state of simulateResidents(homes, t, day)) {
          if (insideWater(state.position)) {
            expect(state.event?.id).toBe('millpond');
            const trip = skaters.get(state.id)!;
            expect(onTheirIce(state.position, trip.seat, state.event!.phase)).toBe(true);
          }
          if (state.pose === 'skate') {
            expect(state.event).toMatchObject({ id: 'millpond', phase: 'attending' });
            expect(state.moving).toBe(false);
          }
          if (state.event?.id === 'millpond') {
            expect(residentActivityLabel(state)).toContain('Millpond');
            expect(onRoad(state.position) || insideMillpond(state.position)).toBe(true);
          }
        }
      }
    },
  );

  it('labels each leg of the outing', () => {
    const day = 77;
    const { home, trip } = skaterTrips(day)[0];
    const label = (t: number) =>
      residentActivityLabel(simulateResidents(homes, t, day).find((r) => r.id === home.id)!);
    expect(label(trip.depart + 1)).toBe('Walking to the Millpond');
    expect(label(trip.arrive - 0.5)).toBe('Walking to the Millpond');
    expect(label(trip.arrive + 0.5)).toBe('Skating on the Millpond');
    expect(label((trip.arrive + trip.leave) / 2)).toBe('Skating on the Millpond');
    expect(label((trip.leave + trip.homeBy) / 2)).toBe('Walking home from the Millpond');
  });

  it('does not depend on the order of the roster', () => {
    for (const day of SKATING_DAYS) {
      const forward = skaterTrips(day).map(({ home, trip }) => [home.id, trip.seat, trip.depart]);
      const reversed = skaterTrips(day, [...homes].reverse()).map(({ home, trip }) => [
        home.id,
        trip.seat,
        trip.depart,
      ]);
      expect(new Set(reversed.map((r) => JSON.stringify(r)))).toEqual(
        new Set(forward.map((r) => JSON.stringify(r))),
      );
      expect(simulateResidents([...homes].reverse(), 900, day).reverse()).toEqual(
        simulateResidents(homes, 900, day),
      );
    }
  });

  it('leaves quiet days exactly as they were', () => {
    for (const day of QUIET_DAYS) {
      const trips: ResidentTrip[] = [...residentTrips(homes, day).values()].flat();
      expect(trips.some((trip) => trip.event.id === 'millpond')).toBe(false);
      for (let t = 720; t <= 1080; t += 10)
        for (const state of simulateResidents(homes, t, day)) {
          expect(insideWater(state.position)).toBe(false);
          expect(state.pose).not.toBe('skate');
        }
    }
    expect(getPlot(homes[0].plot)).toBeDefined();
  });
});
