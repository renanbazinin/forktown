import { residentTrips } from '../src/lib/resident-trips';
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { placeSchema, type Place } from '../src/lib/schema';
import {
  eventAtVenue,
  eventsForDay,
  eventStatus,
  HOUSE_PLOTS,
  insideVenue,
} from '../src/lib/events';
import { residentActivityLabel, simulateResidents } from '../src/lib/simulation';
import { getPlot, isRoad, plotEntrance } from '../src/lib/world';
import { insideCinema } from '../src/lib/cinema';
import { nightBedtime } from '../src/lib/night-routine';
import { MAX_TRAVEL_SPEED_MULTIPLIER, routeLength, WALK_SPEED } from '../src/lib/walking';
import { stepBound } from './tube-riders';

const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
const owls: Place[] = HOUSE_PLOTS.slice(0, 32).map((plot, index) => ({
  ...sample,
  id: `night-owl-${index}`,
  plot: plot.id,
  resident: { ...sample.resident, routine: { ...sample.resident.routine, night: 'stroll' } },
}));
const day = 8;
const at = (minutes: number, homes = owls) =>
  simulateResidents(homes, minutes % 1440, day + Math.floor(minutes / 1440));
const party = eventsForDay(day).find((event) => event.id === 'night-party')!;
const plans = residentTrips(owls, day);
const overflow = owls.filter((home) => !plans.get(home.id)!.some((trip) => trip.homeBy > 1320));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('Night owls and the midnight party', () => {
  it('keeps omitted and explicit sleep choices indoors throughout the night', () => {
    const { night: _night, ...routine } = sample.resident.routine;
    const old = { ...sample, resident: { ...sample.resident, routine } };
    expect(placeSchema.parse(old).resident.routine.night).toBe('sleep');
    expect(
      placeSchema.safeParse({
        ...old,
        resident: { ...old.resident, routine: { ...routine, night: 'work' } },
      }).success,
    ).toBe(false);
    const sleepers = [
      placeSchema.parse(old),
      {
        ...sample,
        id: 'explicit-sleeper',
        resident: { ...sample.resident, routine: { ...routine, night: 'sleep' as const } },
      },
    ];
    for (let minute = 1320; minute < 1800; minute += 7.3) {
      for (const state of at(minute, sleepers)) {
        expect(state.activity).toBe('sleep');
        expect(state.moving).toBe(false);
        expect(state.event).toBeUndefined();
        expect(state.position).toEqual(plotEntrance(getPlot(state.home.plot)!));
      }
    }
  });
  it('keeps four starter neighbors awake after 22:00 and some outside after 04:00', () => {
    const homes = readdirSync('places')
      .filter((file) => file.endsWith('.json'))
      .map((file) => placeSchema.parse(JSON.parse(readFileSync(`places/${file}`, 'utf8'))));
    expect(
      homes
        .filter((home) => home.creator === 'forktown' && home.resident.routine.night === 'stroll')
        .map((home) => home.id)
        .sort(),
    ).toEqual(['after-hours', 'moonbeam-cafe', 'plot-twist', 'stargazer']);
    expect(
      at(1320, homes).filter(
        (state) => state.home.creator === 'forktown' && state.activity === 'stroll',
      ),
    ).toHaveLength(4);
    expect(
      at(1680, homes).filter(
        (state) => state.home.creator === 'forktown' && state.activity === 'stroll',
      ).length,
    ).toBeGreaterThanOrEqual(2);
    expect(at(1740, homes).every((state) => state.activity === 'sleep')).toBe(true);
  });
  it('fills free nights with local walks and doorstep breaks until varied bedtimes', () => {
    expect(overflow.length).toBeGreaterThan(0);
    const bedtimes = new Set<number>();
    for (const home of overflow) {
      const bedtime = nightBedtime(home),
        doorstep = plotEntrance(getPlot(home.plot)!);
      bedtimes.add(bedtime);
      expect(bedtime).toBeGreaterThanOrEqual(1440);
      expect(bedtime).toBeLessThanOrEqual(1740);
      let walked = false,
        rested = false;
      for (let minute = 1320; minute < 1800; minute += 2.5) {
        const state = at(minute).find((state) => state.id === home.id)!;
        expect(state.activity).toBe(minute < bedtime ? 'stroll' : 'sleep');
        expect(state.event).toBeUndefined();
        expect(isRoad(Math.floor(state.position.x), Math.floor(state.position.y))).toBe(true);
        if (state.nightWalk) {
          walked = true;
          expect(state.moving).toBe(true);
          expect(residentActivityLabel(state)).toBe('Out for a moonlit stroll');
          expect(
            Math.abs(state.position.x - doorstep.x) + Math.abs(state.position.y - doorstep.y),
          ).toBeLessThanOrEqual(12.001);
        } else {
          expect(state.position).toEqual(doorstep);
          expect(state.moving).toBe(false);
          if (minute < bedtime) {
            rested = true;
            expect(state.nightPorch).toBe(true);
            expect(residentActivityLabel(state)).toBe('Enjoying the night on the doorstep');
          }
        }
      }
      expect(walked && rested).toBe(true);
    }
    expect(bedtimes.size).toBeGreaterThan(3);
  });
  it('keeps attendance bounded, seats unique, and the itinerary stable across midnight', () => {
    const invited = [...plans.values()].flat().filter((trip) => trip.event.id === 'night-party');
    expect(invited.length).toBeGreaterThan(0);
    expect(invited.length).toBeLessThanOrEqual(8);
    expect(new Set(invited.map((trip) => trip.seat)).size).toBe(invited.length);
    expect(new Set(invited.map((trip) => trip.depart)).size).toBeGreaterThan(1);
    expect(new Set(invited.map((trip) => trip.leave)).size).toBeGreaterThan(1);
    const before = at(1439.999),
      after = at(1440.001);
    before.forEach((state, index) => {
      expect(distance(state.position, after[index].position)).toBeLessThan(0.01);
      expect(state.event).toEqual(after[index].event);
    });
    for (const minute of [1430, 1500, 1570]) {
      const dancers = at(minute).filter(
        (state) => state.event?.id === 'night-party' && state.event.phase === 'attending',
      );
      expect(new Set(dancers.map((state) => JSON.stringify(state.position))).size).toBe(
        dancers.length,
      );
      dancers.forEach((state) => {
        expect(state).toMatchObject({ activity: 'stroll', moving: false, pose: 'dance' });
        expect(insideVenue(party.venue, state.position)).toBe(true);
        expect(residentActivityLabel(state)).toBe(`Dancing at ${party.name}`);
      });
    }
    expect(at(1500)).toEqual(at(1500, [...owls].reverse()).reverse());
    at(1700);
    expect(at(1500)).toEqual(at(1500, structuredClone(owls)));
  });
  it('walks directly from cinema to disco, then returns to the actual home', () => {
    let transfers = 0;
    for (const home of owls) {
      const trips = plans.get(home.id)!;
      for (const [index, cinema] of trips.entries()) {
        if (!cinema.continuesTo) continue;
        transfers++;
        const next = trips[index + 1];
        expect(cinema.event.id).toBe('cinema');
        expect(next.event.id).toBe('night-party');
        expect(next.depart).toBe(cinema.leave);
        expect(cinema.homeBy).toBe(next.depart);
        expect(next.route[0]).toEqual(cinema.route.at(-1));
        expect(next.arrive).toBeGreaterThan(next.depart);
        expect(next.leave - next.arrive).toBeGreaterThanOrEqual(15);
        expect(next.returnRoute.at(-1)).toEqual(plotEntrance(getPlot(home.plot)!));
        expect(routeLength(next.route) / next.duration).toBeCloseTo(WALK_SPEED);
        expect(routeLength(next.returnRoute) / next.returnDuration).toBeCloseTo(WALK_SPEED);
        for (let minute = next.depart; minute < next.homeBy; minute += 1.7) {
          const state = at(minute).find((state) => state.id === home.id)!;
          expect(state.event?.id).toBe('night-party');
          expect(
            isRoad(Math.floor(state.position.x), Math.floor(state.position.y)) ||
              insideCinema(state.position) ||
              insideVenue(party.venue, state.position),
          ).toBe(true);
        }
        expect(
          distance(
            at(next.homeBy).find((state) => state.id === home.id)!.position,
            plotEntrance(getPlot(home.plot)!),
          ),
        ).toBeLessThan(0.001);
      }
      trips.forEach((trip, index) => {
        expect(trip.homeBy).toBeLessThanOrEqual(nightBedtime(home));
        if (index) expect(trip.depart).toBeGreaterThanOrEqual(trips[index - 1].homeBy);
      });
    }
    expect(transfers).toBeGreaterThan(0);
  });
  it('never jumps between outings, doorstep rests, midnight, bedtime, or sunrise', () => {
    const boundaries = new Set([1320, 1440, 1800]);
    for (const home of owls) {
      boundaries.add(nightBedtime(home));
      plans
        .get(home.id)!
        .forEach((trip) =>
          [trip.depart, trip.arrive, trip.leave, trip.homeBy].forEach((time) =>
            boundaries.add(time),
          ),
        );
    }
    for (const boundary of boundaries) {
      const before = at(boundary - 0.001),
        after = at(boundary + 0.001);
      before.forEach((state, index) =>
        expect(distance(state.position, after[index].position)).toBeLessThan(
          stepBound(state, after[index], 0.002, 0.01),
        ),
      );
    }
    let previous = at(1320);
    for (let minute = 1320.5; minute < 1800; minute += 0.5) {
      const states = at(minute);
      states.forEach((state, index) =>
        expect(distance(state.position, previous[index].position)).toBeLessThanOrEqual(
          WALK_SPEED * MAX_TRAVEL_SPEED_MULTIPLIER * 0.5 + 0.001,
        ),
      );
      previous = states;
    }
  });
  it('selects the right stage program across midnight', () => {
    expect(eventStatus(party, 1409.999)).toBe('Later tonight');
    for (const minute of [1410, 1439.999, 0, 149.999]) {
      expect(eventStatus(party, minute)).toBe('Happening now');
      expect(eventAtVenue(eventsForDay(9), 'stage', minute)?.id).toBe('night-party');
    }
    expect(eventStatus(party, 150)).toBe('Finished today');
    expect(eventStatus(party, 360)).toBe('Later tonight');
    expect(eventAtVenue(eventsForDay(9), 'stage', 1200)?.period).toBe('evening');
  });
});
