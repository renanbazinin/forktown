import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { placeSchema, type Place } from '../src/lib/schema';
import { HOUSE_PLOTS, eventsForDay, insideVenue, venueAt } from '../src/lib/events';
import { getPlot, isRoad, plotEntrance, project, unproject, STREETLIGHTS } from '../src/lib/world';
import {
  ZOO_GROUND,
  ZOO_HABITATS,
  ZOO_PLOTS,
  ZOO_SPOTS,
  ZOO_ENTRANCE,
  insideZoo,
  insideZooHabitat,
  zooAnimalsAt,
} from '../src/lib/zoo';
import { cityHit } from '../src/city/render';
import { ZOO_SIGN, zooSignHit } from '../src/city/zoo';
import {
  MAX_TRAVEL_SPEED_MULTIPLIER,
  MIN_VISIT_MINUTES,
  planTravel,
  roadPath,
  routeLength,
  WALK_SPEED,
} from '../src/lib/walking';
import { residentTrips } from '../src/lib/resident-trips';
import { residentActivityLabel, simulateResidents } from '../src/lib/simulation';
import { walkingPace } from '../src/lib/tube-journeys';
import { onRoadOrTube, stepBound } from './tube-riders';

const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
const homes: Place[] = HOUSE_PLOTS.slice(0, 36).map((plot, index) => ({
  ...sample,
  id: `zoo-neighbor-${index}`,
  plot: plot.id,
  resident: {
    ...sample.resident,
    routine: { morning: 'stroll', afternoon: 'stroll', evening: 'stroll', night: 'stroll' },
  },
}));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const at = (time: number, places = homes, day = 7) =>
  simulateResidents(places, time % 1440, day + Math.floor(time / 1440));
const zooPlans = residentTrips(homes, 7);
const zooVisits = homes.flatMap((home) =>
  (zooPlans.get(home.id) ?? [])
    .filter((trip) => trip.event.id === 'zoo')
    .map((trip) => ({ home, trip })),
);

describe('Willow Grove Zoo and physical journey times', () => {
  it('skips brief visits, including time lost to the return journey or event closing', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 80.4, y: 0 },
    ];
    // Evergreen's old zoo trip: ~179.5 minutes each way, only ~1 second on site.
    expect(planTravel(route, 840, 1020, 720, 1080, 720)).toBeUndefined();
    const doorstep = [{ x: 0, y: 0 }];
    expect(planTravel(doorstep, 840, 1020, 1006, 1080, 720, 10)).toBeUndefined();
    expect(planTravel(doorstep, 840, 1020, 1005, 1080, 720)?.arrive).toBe(1005);
    expect(planTravel(doorstep, 840, 1020, 720, 854, 720)).toBeUndefined();
    expect(planTravel(doorstep, 840, 1020, 720, 855, 720)?.leave).toBe(855);
  });
  it('gives every planned visit at least fifteen minutes while the event is open', () => {
    const town = HOUSE_PLOTS.map((plot, i) => ({
      ...homes[i % homes.length],
      id: `visit-${i}`,
      plot: plot.id,
    }));
    for (let day = 0; day < 8; day++)
      for (const trips of residentTrips(town, day).values())
        for (const trip of trips)
          expect(
            Math.min(trip.event.end, trip.leave) - Math.max(trip.event.start, trip.arrive),
          ).toBeGreaterThanOrEqual(MIN_VISIT_MINUTES - 1e-8);
  });
  it('reserves 24 plots starting at O, with four animal species and two empty habitats', () => {
    expect(ZOO_PLOTS).toHaveLength(24);
    expect(ZOO_PLOTS[0]).toBe('O4');
    expect(ZOO_PLOTS.at(-1)).toBe('R9');
    expect(ZOO_HABITATS.filter((h) => h.animal === null)).toHaveLength(2);
    expect(new Set(zooAnimalsAt(840).map((a) => a.species))).toEqual(
      new Set(['giraffe', 'elephant', 'zebra', 'penguin']),
    );
    for (const plot of ZOO_PLOTS) {
      expect(venueAt(plot)?.id).toBe('zoo');
      expect(HOUSE_PLOTS.some((p) => p.id === plot)).toBe(false);
      expect(placeSchema.safeParse({ ...sample, plot }).success).toBe(false);
    }
    const { left, right, top, bottom } = ZOO_GROUND;
    for (let x = left; x < right; x++)
      for (let y = top; y < bottom; y++) expect(isRoad(x, y)).toBe(false);
    expect(STREETLIGHTS.some((p) => insideZoo({ x: p.x + 0.5, y: p.y + 0.5 }))).toBe(false);
    for (const plot of HOUSE_PLOTS)
      expect(roadPath(plotEntrance(plot), ZOO_ENTRANCE).at(-1)).toEqual(ZOO_ENTRANCE);
    expect(cityHit(project(left + 0.2, top + 0.2), [], [])).toEqual({ kind: 'place', id: 'O6' });
    expect(cityHit(project(right - 0.2, bottom - 0.2), [], [])).toEqual({
      kind: 'place',
      id: 'O6',
    });
    const sign = project(ZOO_SIGN.point.x, ZOO_SIGN.point.y);
    for (const x of [-ZOO_SIGN.width / 2, 0, ZOO_SIGN.width / 2]) {
      for (const y of [-ZOO_SIGN.rise, -ZOO_SIGN.rise + ZOO_SIGN.height]) {
        const corner = { x: sign.x + x, y: sign.y + y + x * 0.5 };
        expect(insideZoo(unproject(corner.x, corner.y))).toBe(true);
        expect(zooSignHit(corner)).toBe(true);
        expect(cityHit(corner, [], [])).toEqual({ kind: 'place', id: 'O6' });
      }
    }
    const oldGate = project(ZOO_ENTRANCE.x, ZOO_ENTRANCE.y);
    expect(zooSignHit({ x: oldGate.x, y: oldGate.y - 30 })).toBe(false);
  });

  it('keeps animated animals inside their habitats and every visitor spot outside', () => {
    for (let time = 0; time < 1440; time += 7.3)
      for (const animal of zooAnimalsAt(time)) {
        const h = ZOO_HABITATS.find((h) => h.animal === animal.species)!;
        expect(animal.position.x).toBeGreaterThan(h.left);
        expect(animal.position.x).toBeLessThan(h.left + h.width);
        expect(animal.position.y).toBeGreaterThan(h.top);
        expect(animal.position.y).toBeLessThan(h.top + h.height);
      }
    for (const spot of ZOO_SPOTS) {
      expect(insideZoo(spot)).toBe(true);
      expect(insideZooHabitat(spot)).toBe(false);
    }
    expect(zooAnimalsAt(900)).toEqual(zooAnimalsAt(900));
    expect(zooAnimalsAt(900)).not.toEqual(zooAnimalsAt(910));
  });

  it('increases speed before leaving early, arrives late when busy, and skips impossible visits', () => {
    const short = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const long = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
    ];
    const near = planTravel(short, 840, 1020, 360, 1320, 720)!;
    const medium = planTravel([short[0], { x: 44.8, y: 0 }], 840, 1020, 360, 1320, 720)!;
    expect(near.duration).toBeCloseTo(10 / WALK_SPEED);
    expect(near.depart).toBeGreaterThan(720);
    expect(medium.depart).toBeCloseTo(720);
    expect(medium.arrive).toBeCloseTo(835);
    expect(44.8 / medium.duration / WALK_SPEED).toBeCloseTo(140 / 115);
    const far = planTravel(long, 840, 1020, 360, 1320, 720)!;
    expect(far.depart).toBeLessThan(720);
    expect(near.arrive).toBe(835);
    expect(far.arrive).toBe(835);
    expect(far.duration).toBeCloseTo(80 / (WALK_SPEED * 1.4));
    expect(far.depart).toBeGreaterThan(835 - 80 / WALK_SPEED);
    const late = planTravel(long, 840, 1020, 720, 1320, 720)!;
    expect(late.depart).toBe(720);
    expect(late.arrive).toBeCloseTo(720 + 250 / 1.4);
    expect(late.homeBy - late.leave).toBeCloseTo(late.duration);
    expect(planTravel(long, 840, 1020, 990, 1320, 720)).toBeUndefined();
    expect(planTravel(long, 840, 1020, 720, 1060, 720)).toBeUndefined();
  });

  it('accounts for busy time and stagger when choosing a bounded pace', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 32, y: 0 },
    ];
    const trip = planTravel(route, 840, 1020, 750, 1150, 720, 10)!;
    expect(trip.depart).toBeCloseTo(750);
    expect(trip.arrive).toBeCloseTo(825);
    expect(trip.duration).toBeCloseTo(75);
    expect(trip.homeBy).toBeCloseTo(1105);
    const late = planTravel(route, 840, 1020, 850, 1150, 720)!;
    expect(late.depart).toBe(850);
    expect(late.duration).toBeCloseTo(100 / 1.4);
  });

  it('plans zoo visits from the far side of town, including early departures', () => {
    expect(zooVisits.length).toBeGreaterThan(0);
    expect(zooVisits.some(({ trip }) => trip.depart < trip.event.depart)).toBe(true);
  });

  // Each complete journey gets its own timeout budget, even on slower CI runners.
  it.each(zooVisits)(
    'walks $home.id from $home.plot to the zoo and home at a constant speed without shortcuts',
    ({ home, trip }) => {
      // A tube trip is judged on its walking legs; the ride keeps its own time.
      const speed = trip.legs ? walkingPace(trip.legs) : routeLength(trip.route) / trip.duration;
      expect(speed).toBeGreaterThanOrEqual(WALK_SPEED);
      expect(speed).toBeLessThanOrEqual(WALK_SPEED * MAX_TRAVEL_SPEED_MULTIPLIER + 1e-8);
      const stateAt = (time: number) => at(time).find((r) => r.id === home.id)!;
      expect(
        distance(stateAt(trip.depart).position, plotEntrance(getPlot(home.plot)!)),
      ).toBeLessThan(1e-8);
      expect(stateAt(Math.max(trip.arrive, trip.event.start) + 0.01).event).toMatchObject({
        id: 'zoo',
        phase: 'attending',
      });
      expect(residentActivityLabel(stateAt(900))).toContain('Zoo');
      for (let time = trip.depart; time < trip.homeBy; time += 1.71) {
        const now = stateAt(time),
          next = stateAt(time + 0.001);
        expect(onRoadOrTube(now) || insideZoo(now.position)).toBe(true);
        expect(insideZooHabitat(now.position)).toBe(false);
        expect(distance(now.position, next.position)).toBeLessThanOrEqual(
          stepBound(now, next, 0.001, WALK_SPEED * MAX_TRAVEL_SPEED_MULTIPLIER * 0.001 + 1e-8),
        );
        // The short walks between a station door and its stack keep their own fixed pace.
        if (
          now.moving &&
          next.moving &&
          now.facing === next.facing &&
          !now.transit &&
          !next.transit
        )
          expect(distance(now.position, next.position) / 0.001).toBeCloseTo(speed, 6);
      }
      expect(
        distance(stateAt(trip.homeBy).position, plotEntrance(getPlot(home.plot)!)),
      ).toBeLessThan(1e-8);
      expect(stateAt(trip.homeBy).event?.id).not.toBe('zoo');
      for (const boundary of [
        trip.depart,
        trip.arrive,
        trip.event.start,
        trip.leave,
        trip.homeBy,
        720,
        1080,
        1320,
      ]) {
        const before = stateAt(boundary - 0.001),
          after = stateAt(boundary + 0.001);
        expect(distance(before.position, after.position)).toBeLessThan(
          stepBound(before, after, 0.002, 0.002),
        );
      }
    },
  );

  it('respects work commitments and cannot double-book a resident or teleport at midnight', () => {
    const workers = homes.map((h) => ({
      ...h,
      resident: {
        ...h.resident,
        routine: {
          morning: 'work',
          afternoon: 'stroll',
          evening: 'stroll',
          night: 'sleep',
        } as const,
      },
    }));
    const visits = [...residentTrips(workers, 7).values()]
      .flat()
      .filter((p) => p.event.id === 'zoo');
    expect(visits.length).toBeGreaterThan(0);
    expect(
      // Riders can make the 14:00 start; walkers from this far away cannot.
      visits.every(
        (p) => p.depart >= 720 && (p.legs || p.arrive > p.event.start) && p.arrive < p.event.end,
      ),
    ).toBe(true);
    expect(at(650, workers).every((r) => r.activity === 'work' && !r.event && !r.moving)).toBe(
      true,
    );
    for (const trips of residentTrips(homes, 7).values())
      trips.forEach((trip, index) => {
        expect(trip.arrive).toBeLessThan(trip.event.end);
        expect(trip.homeBy).toBeLessThanOrEqual(trip.availableUntil);
        if (index) expect(trip.depart).toBeGreaterThanOrEqual(trips[index - 1].homeBy);
      });
    for (const boundary of [360, 720, 1080, 1320, 1440, 1800]) {
      const before = at(boundary - 0.001),
        after = at(boundary + 0.001);
      before.forEach((r, index) =>
        expect(distance(r.position, after[index].position)).toBeLessThan(
          stepBound(r, after[index], 0.002, 0.002),
        ),
      );
    }
    expect(at(900, [...homes].reverse()).reverse()).toEqual(at(900));
    at(1400);
    expect(at(900)).toEqual(at(900, [...homes]));
    const fullTown = HOUSE_PLOTS.map((plot, i) => ({
      ...homes[i % homes.length],
      id: `full-${i}`,
      plot: plot.id,
    }));
    for (let time = 370; time < 1800; time += 31.7)
      for (const state of at(time, fullTown)) {
        if (!state.event || state.event.id === 'football') continue;
        const event = eventsForDay(7).find((e) => e.id === state.event!.id)!;
        expect(onRoadOrTube(state) || insideVenue(event.venue, state.position)).toBe(true);
      }
  });
});
