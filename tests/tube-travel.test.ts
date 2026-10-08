import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { placeSchema, type Place } from '../src/lib/schema';
import { EVENT_SPOTS, HOUSE_PLOTS, eventsForDay } from '../src/lib/events';
import {
  eventRoute,
  eventTubeJourney,
  footballVisit,
  planResidentTrips,
  residentTrips,
  skatingVisit,
  tripState,
  type ResidentTrip,
  type VisitEvent,
} from '../src/lib/resident-trips';
import { outingSpots } from '../src/lib/district-places';
import { residentActivityLabel, simulateResidents } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { insideCinema } from '../src/lib/cinema';
import { nightBedtime } from '../src/lib/night-routine';
import { getPlot, plotEntrance, type Point } from '../src/lib/world';
import { MAX_TRAVEL_SPEED_MULTIPLIER, routeLength, WALK_SPEED } from '../src/lib/walking';
import {
  TUBE_MIN_SAVING,
  TUBE_PARCELS,
  tubeAt,
  tubeFixedMinutes,
  tubeMinSaving,
  tubeStation,
} from '../src/lib/tubes';
import {
  fixedMinutes,
  legsMinutes,
  paceLegs,
  reverseLegs,
  walkingPace,
  type TripLeg,
} from '../src/lib/tube-journeys';
import { tubeParcels, tubeParcelsAt, tubeRides, tubeStatus } from '../src/lib/tube-traffic';
import { FROZEN_TOWN, outAllDay } from './district';
import { readPlaces } from './full-town';
import { rosterTimeout } from './roster-timeout';
import { onRoadOrTube, rideLegs, rideTrip, riding, stationWalk, stepBound } from './tube-riders';
import { insideEventGround } from './event-ground';

const places = readPlaces().sort((a, b) => a.plot.localeCompare(b.plot, 'en', { numeric: true }));
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
/**
 * What the walking planner decides apart from the times, which the town's headways move. Times
 * decide whether a party guest hops straight over from the film, so a hop's way there may differ.
 */
const plan = (trip: ResidentTrip, hop = false) => ({
  event: trip.event.id,
  seat: trip.seat,
  ...(hop ? {} : { route: trip.route }),
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
    insideEventGround(venue, p) ||
    // A chained party starts inside the cinema.
    (trip.event.id === 'night-party' && insideCinema(p))
  );
};

describe('Riding the Treeline over a whole year', () => {
  it('plans every trip before a ride as on foot, moved only in time', () => {
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
    const key = (trip: ResidentTrip) => `${trip.event.id}@${trip.event.start}`;
    let identical = 0,
      withRides = 0,
      lost = 0;
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
          // On foot nobody has legs.
          for (const trip of old) expect('legs' in trip || 'returnLegs' in trip).toBe(false);
          // Every outing on foot is one of the town's. A day on foot can lose one the headways
          // made room for (a leave moved earlier, so the next outing fits).
          for (const trip of old) expect(trips.map(key)).toContain(key(trip));
          const first = trips.findIndex(rides);
          // The same outings in the same seats, walked the same way, up to the first ride.
          for (let i = 0; i < (first < 0 ? trips.length : first); i++) {
            const j = old.findIndex((trip) => key(trip) === key(trips[i]));
            if (j < 0) {
              lost++;
              continue;
            }
            const hop = !!(trips[i - 1]?.continuesTo || old[j - 1]?.continuesTo);
            expect(plan(trips[i], hop)).toEqual(plan(old[j], hop));
          }
          if (first >= 0) withRides++;
          else {
            identical++;
            for (const trip of trips) expect('legs' in trip || 'returnLegs' in trip).toBe(false);
          }
        }
      }
    expect(identical).toBeGreaterThan(2000);
    expect(withRides).toBeGreaterThan(300);
    // Rare: measured 1 in the real town's year and 2 in the full town's (230 houses).
    expect(lost).toBeLessThan(identical / 100);
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
      walked = 0,
      rodeToday = 0;
    for (const day of YEAR)
      for (const [id, trips] of residentTrips(places, day)) {
        const home = places.find((place) => place.id === id)!;
        for (const trip of trips) {
          const tube = eventTubeJourney(home, trip.event, trip.seat);
          expect(!!tube).toBe(rides(trip));
          // The Riverside lies at the town's far edge, so most of its guests ride; today's
          // outings are counted on their own.
          if (!tube) {
            if (!trip.event.outing) walked++;
            continue;
          }
          rode++;
          if (!trip.event.outing) rodeToday++;
          // Unhurried, door to seat: the whole way on foot against the tube journey, which clears
          // its own pair's threshold (never less than ten minutes).
          const board = tube.legs.find((leg) => leg.kind === 'board')!;
          if (board.kind !== 'board') throw new Error('A ride with no boarding leg.');
          const onFoot = routeLength(eventRoute(home, trip.event, trip.seat)) / WALK_SPEED;
          expect(onFoot - legsMinutes(tube.legs)).toBeGreaterThanOrEqual(
            tubeMinSaving(board.from, board.to),
          );
          expect(tubeMinSaving(board.from, board.to)).toBeGreaterThanOrEqual(TUBE_MIN_SAVING);
          expect(fixedMinutes(tube.legs)).toBeCloseTo(tubeFixedMinutes(board.from, board.to), 9);
        }
      }
    expect(rode).toBeGreaterThan(200);
    expect(walked).toBeGreaterThan(rodeToday);
  }, 60_000);

  // Every ride of half a year, sampled densely: it grows with the town, so the steps gather what
  // they find and assert once.
  it('moves riders continuously, on the road or the line, never faster than the tube', () => {
    let checked = 0;
    const wrong: string[] = [];
    for (const day of YEAR.filter((_, i) => i % 2 === 0))
      for (const ride of tubeRides(places, day)) {
        checked++;
        const home = places.find((place) => place.id === ride.residentId)!;
        const trip = rideTrip(residentTrips(places, day).get(home.id)!, ride);
        const pace = walkingPace(rideLegs(trip, ride)!);
        expect(pace).toBeGreaterThanOrEqual(WALK_SPEED - 1e-9);
        expect(pace).toBeLessThanOrEqual(WALK_SPEED * MAX_TRAVEL_SPEED_MULTIPLIER + 1e-9);
        const say = (t: number, what: string) =>
          wrong.push(`${home.id} on ${day} at ${t}: ${what}`);
        // Every other minute of the trip, then densely from a minute before boarding to a minute after.
        for (let t = trip.depart; t < trip.homeBy; t += 2)
          if (!allowed(trip, tripState(home, trip, t, day))) say(t, 'off the road and the line');
        let previous = tripState(home, trip, ride.board - 1, day);
        for (let t = ride.board - 1 + 0.05; t < ride.off + 1; t += 0.05) {
          const now = tripState(home, trip, t, day);
          if (!allowed(trip, now)) say(t, 'off the road and the line');
          const step = distance(now.position!, previous.position!);
          if (
            step >
            stepBound(now, previous, 0.05, WALK_SPEED * MAX_TRAVEL_SPEED_MULTIPLIER * 0.05 + 1e-9)
          )
            say(t, `jumps ${step}`);
          if (now.transit) {
            // Moving only on the short walks between a station door and its stack.
            if (now.transit.progress < 1 && now.moving !== stationWalk(now))
              say(t, now.moving ? 'moves in the tube' : 'stands still on the station walk');
            if (now.pose !== undefined) say(t, `strikes a pose in transit: ${now.pose}`);
            if (!(now.transit.progress >= 0 && now.transit.progress <= 1))
              say(t, `transit progress ${now.transit.progress}`);
          }
          previous = now;
        }
      }
    expect(wrong.slice(0, 5)).toEqual([]);
    expect(checked).toBeGreaterThan(300);
  }, 60_000);

  it('names each ride’s own trip, even a second outing to the same event that day', () => {
    // The frozen town and a neighbor out all day on D13 (a sweep's newcomer): on some days they
    // walk to the morning football and ride to the afternoon's, where the event's id alone would
    // name the walk, which has no legs.
    const town = [...FROZEN_TOWN, outAllDay('D13')];
    let checked = 0,
      second = 0;
    for (const day of YEAR) {
      const plans = residentTrips(town, day);
      for (const ride of tubeRides(town, day)) {
        checked++;
        const trips = plans.get(ride.residentId)!;
        const trip = rideTrip(trips, ride);
        const legs = rideLegs(trip, ride)!;
        expect(walkingPace(legs)).toBeGreaterThanOrEqual(WALK_SPEED - 1e-9);
        // The ride is the one these legs make: the boarding minute summed leg by leg, as the
        // panel and the town both sum it.
        let board = ride.direction === 'there' ? trip.depart : trip.leave;
        for (const leg of legs) {
          if (leg.kind === 'board') break;
          board += leg.minutes;
        }
        expect(board).toBe(ride.board);
        const first = trips.find((t) => t.event.id === ride.eventId)!;
        if (first !== trip && !rideLegs(first, ride)) second++;
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(second).toBeGreaterThan(0);
  });

  it('builds whole tube journeys from every house plot to every seat of every venue', () => {
    // Pure geometry, whoever lives in town: a newcomer on any free plot rides these legs.
    const events = new Map<string, VisitEvent>();
    for (const day of YEAR)
      for (const event of eventsForDay(day))
        events.set(`${event.outing ?? event.id}@${event.venue.kind}`, event);
    events.set('football@morning', footballVisit('morning'));
    events.set('football@afternoon', footballVisit('afternoon'));
    events.set('millpond', skatingVisit);
    const seats = (event: VisitEvent) =>
      event.outing
        ? outingSpots(event.outing).length
        : event.venue.kind === 'football' || event.venue.kind === 'millpond'
          ? 6 // the touchline's and the ice's half(6)
          : (EVENT_SPOTS as Record<string, readonly unknown[]>)[event.venue.kind].length;
    const wrong: string[] = [];
    const whole = (legs: TripLeg[], what: string) => {
      legs.forEach((leg, i) => {
        if (leg.route.length < 2 || !(leg.minutes > 0) || !Number.isFinite(leg.minutes))
          wrong.push(
            `${what}: ${leg.kind} leg ${i} has ${leg.route.length} points, ${leg.minutes} min`,
          );
        const end = legs[i - 1]?.route.at(-1);
        if (end && (end.x !== leg.route[0].x || end.y !== leg.route[0].y))
          wrong.push(`${what}: ${leg.kind} leg ${i} starts away from the last one's end`);
      });
      if (legs.filter((leg) => leg.kind === 'board').length !== 1) wrong.push(`${what}: boardings`);
      if (Math.abs(walkingPace(legs) - WALK_SPEED) > 1e-9) wrong.push(`${what}: walking pace`);
      const brisk = walkingPace(paceLegs(legs, MAX_TRAVEL_SPEED_MULTIPLIER));
      if (Math.abs(brisk - WALK_SPEED * MAX_TRAVEL_SPEED_MULTIPLIER) > 1e-9)
        wrong.push(`${what}: brisk pace ${brisk}`);
    };
    let rode = 0;
    for (const plot of HOUSE_PLOTS) {
      const home = outAllDay(plot.id, `newcomer-${plot.id.toLowerCase()}`);
      for (const [key, event] of events)
        for (let seat = 0; seat < seats(event); seat++) {
          const tube = eventTubeJourney(home, event, seat);
          if (!tube) continue;
          rode++;
          whole(tube.legs, `${plot.id} to ${key} seat ${seat}`);
          whole(reverseLegs(tube.legs), `${plot.id} home from ${key} seat ${seat}`);
        }
    }
    expect(wrong.slice(0, 5)).toEqual([]);
    expect(rode).toBeGreaterThan(10_000);
  }, 20_000);

  // Every neighbor at every sampled minute of the year grows with the town, so the residents'
  // side gathers what it finds and asserts once.
  it(
    'shows riders only inside their ride windows, and parcels never share the tube',
    () => {
      const { margin, wait } = TUBE_PARCELS;
      const wrong: string[] = [];
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
            const say = (what: string) =>
              wrong.push(`${state.id} on ${day} at ${minutes}: ${what}`);
            if (!!state.transit !== !!ride)
              say(state.transit ? 'in the tube outside a ride' : 'missing from a ride');
            else if (state.transit && ride) {
              const stage =
                minutes < ride.depart ? 'boarding' : minutes < ride.arrive ? 'riding' : 'alighting';
              if (state.transit.from !== ride.from || state.transit.to !== ride.to)
                say(
                  `rides ${state.transit.from} to ${state.transit.to}, not ${ride.from} to ${ride.to}`,
                );
              if (state.transit.stage !== stage) say(`${state.transit.stage}, not ${stage}`);
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
              expect(states.filter((state) => state.transit).map((state) => state.id)).toEqual([]);
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
      expect(wrong.slice(0, 5)).toEqual([]);
    },
    rosterTimeout(520, 120_000),
  );

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

  it(
    'agrees with the town at the edge of every ride stage and the whole minutes near it',
    () => {
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
    },
    rosterTimeout(520, 120_000),
  );

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
      (r) =>
        r.residentId === there.residentId &&
        r.direction === 'home' &&
        r.eventId === 'zoo' &&
        r.eventStart === there.eventStart,
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
    expect(label(there.off - 0.5)).toBe(`Stepping off the tube at ${tubeStation(there.to).name}`);
    expect(label(there.off + 0.5)).toBe('Walking to Willow Grove Zoo');
    expect(label(back.board - 0.5)).toBe('Walking home from the zoo');
    expect(label(back.board + 0.5)).toBe('Boarding the tube home from the zoo');
    expect(label(back.board + 1.9)).toBe('Boarding the tube home from the zoo');
    expect(label(mid(back))).toBe('Riding the tube home from the zoo');
    expect(label(back.off - 0.5)).toBe(`Stepping off the tube at ${tubeStation(back.to).name}`);
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
            ride.residentId === id &&
            ride.eventId === trip.event.id &&
            ride.eventStart === trip.event.start &&
            ride.direction === 'home',
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
