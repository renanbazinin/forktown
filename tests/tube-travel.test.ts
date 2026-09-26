import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { placeSchema, validatePlaces, type Place } from '../src/lib/schema';
import { HOUSE_PLOTS, eventsForDay, insideVenue } from '../src/lib/events';
import {
  eventRoute,
  eventTubeJourney,
  planResidentTrips,
  residentTrips,
  tripState,
  type ResidentTrip,
} from '../src/lib/resident-trips';
import { residentActivityLabel, simulateResidents } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { insideCinema } from '../src/lib/cinema';
import { insideFootball } from '../src/lib/football';
import { insideMillpond } from '../src/lib/millpond';
import { insideZoo } from '../src/lib/zoo';
import { nightBedtime } from '../src/lib/night-routine';
import { getPlot, plotEntrance, type Point } from '../src/lib/world';
import { MAX_TRAVEL_SPEED_MULTIPLIER, routeLength, WALK_SPEED } from '../src/lib/walking';
import {
  TUBE_MIN_SAVING,
  TUBE_PARCELS,
  tubeAt,
  tubeFixedMinutes,
  tubeStation,
} from '../src/lib/tubes';
import { fixedMinutes, legsMinutes, walkingPace } from '../src/lib/tube-journeys';
import { tubeParcels, tubeParcelsAt, tubeRides, tubeStatus } from '../src/lib/tube-traffic';
import { onRoadOrTube, riding, stationWalk, stepBound } from './tube-riders';

const places = validatePlaces(
  readdirSync('places')
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({ file, data: JSON.parse(readFileSync(`places/${file}`, 'utf8')) })),
).places.sort((a, b) => a.plot.localeCompare(b.plot, 'en', { numeric: true }));
const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
const YEAR = Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + i);
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/** Evening and night strollers on the chosen house plots, with ids `${prefix}-0`, `${prefix}-1`, …. */
const nightOwls = (prefix: string, where: (plot: (typeof HOUSE_PLOTS)[number]) => boolean) =>
  HOUSE_PLOTS.filter(where).map((plot, i) => ({
    ...sample,
    id: `${prefix}-${i}`,
    plot: plot.id,
    resident: {
      ...sample.resident,
      routine: { morning: 'home', afternoon: 'home', evening: 'stroll', night: 'stroll' } as const,
    },
  }));
const rides = (trip: ResidentTrip) => !!(trip.legs || trip.returnLegs);
/** Everything the walking planner decides, in comparable form. */
const plan = (trip: ResidentTrip) => ({
  event: trip.event.id,
  seat: trip.seat,
  depart: trip.depart,
  arrive: trip.arrive,
  leave: trip.leave,
  homeBy: trip.homeBy,
  duration: trip.duration,
  returnDuration: trip.returnDuration,
  continuesTo: trip.continuesTo,
  route: trip.route,
  returnRoute: trip.returnRoute,
  availableFrom: trip.availableFrom,
  availableUntil: trip.availableUntil,
  facing: trip.facing,
});
/** Where a traveller may stand: the road, the tube line while in transit, or their own venue. */
const allowed = (trip: ResidentTrip, state: ReturnType<typeof tripState>) => {
  const p = state.position!;
  const venue = trip.event.venue;
  return (
    onRoadOrTube({ position: p, transit: state.transit }) ||
    (venue.kind === 'zoo' && insideZoo(p)) ||
    (venue.kind === 'cinema' && insideCinema(p)) ||
    (venue.kind === 'football' && insideFootball(p)) ||
    (venue.kind === 'millpond' && insideMillpond(p)) ||
    ((venue.kind === 'stage' || venue.kind === 'green') && insideVenue(venue, p)) ||
    // A chained party starts inside the cinema.
    (trip.event.id === 'night-party' && insideCinema(p))
  );
};

describe('Riding the Treeline over a whole year', () => {
  it('plans every trip before a ride exactly as without the tube', () => {
    // Synthetic full town for a week, then the real roster for a year.
    const crowd = HOUSE_PLOTS.map((plot, i) => ({
      ...sample,
      id: `rider-${i}`,
      plot: plot.id,
      resident: {
        ...sample.resident,
        routine: [
          { morning: 'stroll', afternoon: 'stroll', evening: 'stroll', night: 'stroll' },
          { morning: 'work', afternoon: 'stroll', evening: 'home', night: 'sleep' },
          { morning: 'home', afternoon: 'home', evening: 'stroll', night: 'stroll' },
        ][i % 3] as Place['resident']['routine'],
      },
    }));
    let identical = 0,
      withRides = 0;
    for (const [homes, days] of [
      [crowd, [0, 1, 2, 3, 4, 5, 6, 7]],
      [places, YEAR],
    ] as const)
      for (const day of days) {
        const now = residentTrips(homes, day),
          walking = planResidentTrips(homes, day, { tube: false });
        for (const home of homes) {
          const trips = now.get(home.id)!,
            old = walking.get(home.id)!;
          // Without the tube nobody has legs.
          for (const trip of old) expect('legs' in trip || 'returnLegs' in trip).toBe(false);
          const first = trips.findIndex(rides);
          if (first < 0) {
            identical++;
            expect(trips.map(plan)).toEqual(old.map(plan));
            for (const trip of trips) expect('legs' in trip || 'returnLegs' in trip).toBe(false);
            continue;
          }
          withRides++;
          for (let i = 0; i < first; i++) {
            // A cinema trip that now hands over to a party with a tube ride home keeps its
            // own plan; only its end becomes the handover.
            const handover = i === first - 1 && trips[i].continuesTo === 'night-party';
            const { homeBy: _a, continuesTo: _b, ...mine } = plan(trips[i]);
            const { homeBy: _c, continuesTo: _d, ...theirs } = plan(old[i]);
            if (handover) expect(mine).toEqual(theirs);
            else expect(plan(trips[i])).toEqual(plan(old[i]));
          }
        }
      }
    expect(identical).toBeGreaterThan(2000);
    expect(withRides).toBeGreaterThan(300);
  }, 60_000);

  it('never loses a trip the walking plan keeps, even for far night owls', () => {
    // Rows J onwards, out every evening and night: the tube can make a far concert just
    // reachable, and the greedy planner would then have no time left for that night's party.
    const owls = nightOwls('owl', (plot) => plot.row >= 9);
    const key = (trip: ResidentTrip) => `${trip.event.id}@${trip.event.start}`;
    let kept = 0,
      added = 0;
    for (const day of YEAR) {
      const tube = residentTrips(owls, day),
        walking = planResidentTrips(owls, day, { tube: false });
      for (const owl of owls) {
        const planned = tube.get(owl.id)!.map(key),
          walked = walking.get(owl.id)!.map(key);
        for (const trip of walked) expect(planned).toContain(trip);
        kept += walked.length;
        added += planned.filter((trip) => !walked.includes(trip)).length;
      }
    }
    expect(kept).toBeGreaterThan(2000);
    // The tube still makes other trips possible.
    expect(added).toBeGreaterThan(200);
  }, 60_000);

  it('rides only when it saves ten unhurried minutes, and nearby trips stay on foot', () => {
    let rode = 0,
      walked = 0;
    for (const day of YEAR)
      for (const [id, trips] of residentTrips(places, day)) {
        const home = places.find((place) => place.id === id)!;
        for (const trip of trips) {
          const tube = eventTubeJourney(home, trip.event, trip.seat);
          expect(!!tube).toBe(rides(trip));
          if (!tube) {
            walked++;
            continue;
          }
          rode++;
          // Unhurried, door to seat: the whole way on foot against the tube journey.
          const onFoot = routeLength(eventRoute(home, trip.event, trip.seat)) / WALK_SPEED;
          expect(onFoot - legsMinutes(tube.legs)).toBeGreaterThanOrEqual(TUBE_MIN_SAVING);
          expect(fixedMinutes(tube.legs)).toBeCloseTo(tubeFixedMinutes('C1', 'N1'), 9);
        }
      }
    expect(rode).toBeGreaterThan(200);
    expect(walked).toBeGreaterThan(rode);
  }, 60_000);

  it('moves riders continuously, on the road or the line, never faster than the tube', () => {
    let checked = 0;
    for (const day of YEAR.filter((_, i) => i % 2 === 0))
      for (const ride of tubeRides(places, day)) {
        checked++;
        const home = places.find((place) => place.id === ride.residentId)!;
        const trip = residentTrips(places, day)
          .get(home.id)!
          .find((t) => t.event.id === ride.eventId)!;
        const legs = ride.direction === 'there' ? trip.legs! : trip.returnLegs!;
        const pace = walkingPace(legs);
        expect(pace).toBeGreaterThanOrEqual(WALK_SPEED - 1e-9);
        expect(pace).toBeLessThanOrEqual(WALK_SPEED * MAX_TRAVEL_SPEED_MULTIPLIER + 1e-9);
        // Every other minute of the trip, then densely from a minute before boarding to a minute after.
        for (let t = trip.depart; t < trip.homeBy; t += 2)
          expect(allowed(trip, tripState(home, trip, t, day))).toBe(true);
        let previous = tripState(home, trip, ride.board - 1, day);
        for (let t = ride.board - 1 + 0.05; t < ride.off + 1; t += 0.05) {
          const now = tripState(home, trip, t, day);
          expect(allowed(trip, now)).toBe(true);
          expect(distance(now.position!, previous.position!)).toBeLessThanOrEqual(
            stepBound(now, previous, 0.05, WALK_SPEED * MAX_TRAVEL_SPEED_MULTIPLIER * 0.05 + 1e-9),
          );
          if (now.transit) {
            // Moving only on the short walks between a station door and its stack.
            if (now.transit.progress < 1) expect(now.moving).toBe(stationWalk(now));
            expect(now.pose).toBeUndefined();
            expect(now.transit.progress).toBeGreaterThanOrEqual(0);
            expect(now.transit.progress).toBeLessThanOrEqual(1);
          }
          previous = now;
        }
      }
    expect(checked).toBeGreaterThan(300);
  }, 60_000);

  it('shows riders only inside their ride windows, and parcels never share the tube', () => {
    const { margin, wait } = TUBE_PARCELS;
    for (const day of YEAR.filter((_, i) => i % 4 === 0)) {
      const today = tubeRides(places, day);
      for (let minutes = 360; minutes < 1440 + 360; minutes += 2.3) {
        const time = minutes % 1440,
          on = minutes < 1440 ? day : day + 1;
        const states = simulateResidents(places, time, on);
        for (const state of states) {
          const ride = today.find(
            (r) => r.residentId === state.id && minutes >= r.board && minutes < r.off,
          );
          expect(!!state.transit).toBe(!!ride);
          if (state.transit && ride) {
            expect([state.transit.from, state.transit.to]).toEqual([ride.from, ride.to]);
            expect(state.transit.stage).toBe(
              minutes < ride.depart ? 'boarding' : minutes < ride.arrive ? 'riding' : 'alighting',
            );
          }
        }
        if (minutes < 1440) {
          const parcels = tubeParcelsAt(places, time, day);
          for (const parcel of parcels) {
            // Each parcel is in exactly the stage its window says.
            expect(parcel.stage).toBe(
              time < parcel.depart ? 'sending' : time < parcel.arrive ? 'riding' : 'arrived',
            );
            expect(time).toBeGreaterThanOrEqual(parcel.depart - wait);
            expect(time).toBeLessThan(parcel.arrive + wait);
            expect(parcel.progress).toBeGreaterThanOrEqual(0);
            expect(parcel.progress).toBeLessThanOrEqual(1);
            if (parcel.stage === 'riding') {
              const at = tubeAt(parcel.from, parcel.to, parcel.distance);
              expect(parcel.position).toEqual(at.position);
              expect(parcel.altitude).toBe(at.altitude);
            } else
              expect(parcel.position).toEqual(
                tubeStation(parcel.stage === 'sending' ? parcel.from : parcel.to).stack,
              );
            for (const state of states) expect(state.transit).toBeUndefined();
          }
          const expected = tubeParcels(places, day).filter(
            (parcel) => time >= parcel.depart - wait && time < parcel.arrive + wait,
          );
          expect(parcels.map((parcel) => parcel.id)).toEqual(expected.map((parcel) => parcel.id));
        }
      }
      for (const parcel of tubeParcels(places, day)) {
        // The whole episode (on the pad, in the glass, on the far pad) clears every ride's.
        expect(parcel.arrive + wait).toBeLessThan(1200);
        for (const ride of today)
          expect(
            ride.off + margin <= parcel.depart - wait ||
              parcel.arrive + wait + margin <= ride.board,
          ).toBe(true);
      }
    }
  }, 60_000);

  it('gives the info card the same riders the town shows', () => {
    let early = 0;
    for (const day of YEAR.slice(0, 14).filter((_, i) => i % 2 === 0))
      for (let minutes = 0; minutes < 1440; minutes += 1.7) {
        const status = tubeStatus(places, minutes, day);
        const riders = simulateResidents(places, minutes, day).filter((r) => r.transit);
        expect(status.now.map((ride) => ride.residentId).sort()).toEqual(
          riders.map((r) => r.id).sort(),
        );
        for (const ride of status.now)
          expect(ride.stage).toBe(riders.find((r) => r.id === ride.residentId)!.transit!.stage);
        expect(
          status.done +
            status.now.length +
            status.today.filter((r) => r.board > status.time).length,
        ).toBe(status.today.length);
        const first = tubeRides(places, day)[0];
        if (minutes < 360 && !status.next && first) {
          early++;
          expect(status.firstToday).toEqual(first);
        } else expect(status.firstToday).toBeUndefined();
        if (status.parcel) {
          expect(status.parcel.arrive + TUBE_PARCELS.wait).toBeGreaterThan(minutes);
          expect(status.parcel.stage).toBe(
            minutes < status.parcel.depart - TUBE_PARCELS.wait
              ? undefined
              : minutes < status.parcel.depart
                ? 'sending'
                : minutes < status.parcel.arrive
                  ? 'riding'
                  : 'arrived',
          );
        }
      }
    expect(early).toBeGreaterThan(0);
  }, 60_000);

  it('agrees with the town at the edge of every ride stage and the whole minutes near it', () => {
    // A pinned clock (?m=) lands exactly on whole minutes, where many zoo rides change stage.
    const owls = nightOwls('far-owl', (plot) => plot.row >= 14 && plot.col <= 2);
    let edges = 0,
      whole = 0,
      midnight = 0;
    for (const [homes, days] of [
      [places, YEAR.filter((_, i) => i % 2 === 0)],
      [owls, [0, 1, 2, 3, 4, 5, 6, 7]],
    ] as const)
      for (const day of days)
        for (const ride of tubeRides(homes, day))
          for (const edge of [ride.board, ride.depart, ride.arrive, ride.off]) {
            edges++;
            const near = [Math.floor(edge), Math.ceil(edge), Math.round(edge * 2) / 2];
            if (near.includes(edge)) whole++;
            for (const t of new Set([edge, ...near])) {
              // The plan's timeline runs past midnight: 1440 + m is minute m of the next day.
              const [minutes, on] = t >= 1440 ? [t - 1440, day + 1] : [t, day];
              if (t >= 1440) midnight++;
              const status = tubeStatus(homes, minutes, on);
              const riders = simulateResidents(homes, minutes, on).filter((r) => r.transit);
              expect(status.now.map((r) => `${r.residentId} ${r.stage}`).sort()).toEqual(
                riders.map((r) => `${r.id} ${r.transit!.stage}`).sort(),
              );
            }
          }
    expect(edges).toBeGreaterThan(1500);
    expect(whole).toBeGreaterThan(100);
    expect(midnight).toBeGreaterThan(0);
  }, 60_000);

  it('gets every rider home before the next commitment', () => {
    for (const day of YEAR)
      for (const [id, trips] of residentTrips(places, day)) {
        const home = places.find((place) => place.id === id)!;
        trips.forEach((trip, index) => {
          expect(trip.homeBy).toBeLessThanOrEqual(trip.availableUntil + 1e-9);
          if (home.resident.routine.night === 'stroll')
            expect(trip.homeBy).toBeLessThanOrEqual(nightBedtime(home) + 1e-9);
          if (index) expect(trip.depart).toBeGreaterThanOrEqual(trips[index - 1].homeBy);
          if (trip.legs) expect(legsMinutes(trip.legs)).toBeCloseTo(trip.duration, 9);
          if (trip.returnLegs)
            expect(legsMinutes(trip.returnLegs)).toBeCloseTo(trip.returnDuration, 9);
          if (trip.legs) expect(trip.returnDuration).toBe(trip.duration);
        });
      }
  });

  it('is the same for any roster order, any reload and any question asked before', () => {
    const day = YEAR[3];
    // On a 1/64-minute grid, so minute + 1440 wraps back to exactly the same minute.
    const depart = tubeRides(places, day).find((r) => r.depart < 1440)!.depart;
    const minute = Math.round((depart + 1) * 64) / 64;
    const states = simulateResidents(places, minute, day);
    expect(states.some(riding)).toBe(true);
    simulateResidents(places, 1300, day + 1);
    expect(simulateResidents([...places].reverse(), minute, day).reverse()).toEqual(states);
    expect(simulateResidents(structuredClone(places), minute, day)).toEqual(states);
    expect(tubeRides(structuredClone(places), day)).toEqual(tubeRides(places, day));
    expect(simulateResidents(places, minute + 1440, day)).toEqual(states);
  });

  it('labels every leg of a ride to the zoo and home', () => {
    const day = YEAR.find((d) => tubeRides(places, d).some((r) => r.eventId === 'zoo'))!;
    const there = tubeRides(places, day).find(
      (r) => r.eventId === 'zoo' && r.direction === 'there',
    )!;
    const back = tubeRides(places, day).find(
      (r) => r.residentId === there.residentId && r.direction === 'home',
    )!;
    const label = (t: number) =>
      residentActivityLabel(
        simulateResidents(places, t, day).find((r) => r.id === there.residentId)!,
      );
    const mid = (ride: typeof there) => (ride.depart + ride.arrive) / 2;
    expect(label(there.board - 0.5)).toBe('Walking to Willow Grove Zoo');
    expect(label(there.board + 0.5)).toBe('Boarding the tube to Willow Grove Zoo');
    expect(label(there.board + 1.9)).toBe('Boarding the tube to Willow Grove Zoo');
    expect(label(mid(there))).toBe('Riding the tube to Willow Grove Zoo');
    expect(label(there.off - 0.5)).toBe('Stepping off the tube at Willow Halt');
    expect(label(there.off + 0.5)).toBe('Walking to Willow Grove Zoo');
    expect(label(back.board - 0.5)).toBe('Walking home from the zoo');
    expect(label(back.board + 0.5)).toBe('Boarding the tube home from the zoo');
    expect(label(back.board + 1.9)).toBe('Boarding the tube home from the zoo');
    expect(label(mid(back))).toBe('Riding the tube home from the zoo');
    expect(label(back.off - 0.5)).toBe('Stepping off the tube at Hedgerow Halt');
    expect(label(back.off + 0.5)).toBe('Walking home from the zoo');
  });

  it('takes a far night owl home from the party by tube, at an unhurried pace, across midnight', () => {
    const owls = nightOwls('far-owl', (plot) => plot.row >= 14 && plot.col <= 2);
    const plans = residentTrips(owls, 8);
    const chained = [...plans].flatMap(([id, trips]) =>
      trips
        .filter((trip, i) => i && trips[i - 1].continuesTo && trip.returnLegs)
        .map((trip) => ({ home: owls.find((owl) => owl.id === id)!, trip })),
    );
    expect(chained.length).toBeGreaterThan(0);
    for (const { home, trip } of chained) {
      expect(trip.legs).toBeUndefined();
      expect(walkingPace(trip.returnLegs!)).toBeCloseTo(WALK_SPEED, 9);
      expect(trip.returnDuration).toBeCloseTo(legsMinutes(trip.returnLegs!), 9);
      expect(trip.returnRoute.at(-1)).toEqual(plotEntrance(getPlot(home.plot)!));
      expect(trip.homeBy).toBeLessThanOrEqual(nightBedtime(home));
      expect(routeLength(trip.route) / trip.duration).toBeCloseTo(WALK_SPEED);
    }
    // A guest who goes on to the party never takes the cinema's own way home.
    const handovers = [...plans].flatMap(([id, trips]) =>
      trips.filter((trip) => trip.continuesTo).map((trip) => ({ id, trip })),
    );
    expect(handovers.some(({ trip }) => trip.returnLegs)).toBe(true);
    for (const { id, trip } of handovers) {
      expect(
        tubeRides(owls, 8).some(
          (ride) =>
            ride.residentId === id && ride.eventId === trip.event.id && ride.direction === 'home',
        ),
      ).toBe(false);
      const home = owls.find((owl) => owl.id === id)!;
      for (let t = trip.leave - 0.5; t < trip.leave + 3; t += 0.25) {
        const state = simulateResidents(owls, t % 1440, 8 + Math.floor(t / 1440)).find(
          (r) => r.id === id,
        )!;
        expect(state.event?.id === 'cinema' && state.event.phase === 'returning').toBe(false);
        expect(home.id).toBe(id);
      }
    }
    expect(eventsForDay(8).some((event) => event.id === 'night-party')).toBe(true);
    // Rides run across midnight too, with no jump at the day's rollover.
    const at = (day: number, minutes: number) =>
      simulateResidents(owls, minutes % 1440, day + Math.floor(minutes / 1440));
    let midnight = 0;
    for (let day = 0; day < 40; day++) {
      midnight += tubeRides(owls, day).filter((ride) => ride.off > 1440).length;
      const before = at(day, 1439.999),
        after = at(day, 1440.001);
      before.forEach((state, index) =>
        expect(distance(state.position, after[index].position)).toBeLessThan(
          stepBound(state, after[index], 0.002, 0.01),
        ),
      );
      if (day % 4) continue;
      let previous = at(day, 1320);
      for (let minutes = 1320.5; minutes < 1800; minutes += 0.5) {
        const states = at(day, minutes);
        states.forEach((state, index) =>
          expect(distance(state.position, previous[index].position)).toBeLessThanOrEqual(
            stepBound(state, previous[index], 0.5, 1.4 * 0.32 * 0.5 + 0.001),
          ),
        );
        previous = states;
      }
    }
    expect(midnight).toBeGreaterThan(0);
  }, 60_000);
});
