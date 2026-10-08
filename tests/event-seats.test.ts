import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { placeSchema, type Place } from '../src/lib/schema';
import { EVENT_SPOTS, eventsForDay, HOUSE_PLOTS } from '../src/lib/events';
import { hash } from '../src/lib/world';
import {
  eventApproach,
  eventRoute,
  eventTubeJourney,
  HEADWAY_SHIFT_MAX,
  planHome,
  planResidentTrips,
  VENUE_GATE_HEADWAY,
  withPreview,
  type ResidentTrip,
} from '../src/lib/resident-trips';
import { fixedMinutes, legsMinutes, walkedTiles } from '../src/lib/tube-journeys';
import { tubeParcels, tubeRides } from '../src/lib/tube-traffic';
import { TUBE_DOOR_HEADWAY, TUBE_PARCELS } from '../src/lib/tubes';
import {
  MIN_VISIT_MINUTES,
  planJourney,
  routeLength,
  WALK_SPEED,
  WORTH_THE_WALK,
} from '../src/lib/walking';
import { simulateResidents } from '../src/lib/simulation';
import { CINEMA_FILMS, cinemaGuests, cinemaProgram } from '../src/lib/cinema';
import { millpondSkatingDay, SKATING } from '../src/lib/millpond';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { nightBedtime } from '../src/lib/night-routine';
import { readPlaces } from './full-town';
import { OUTINGS, outingOf, SEAT_EXCLUDES, type SeatCall } from '../src/lib/outings';

const real = readPlaces();
const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
const YEAR = Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + i);
type Routine = Place['resident']['routine'];
const ACTIVITIES = ['stroll', 'work', 'home'] as const;
/** One of the 54 routines: morning, afternoon and evening out, working or home, then night. */
const routine = (k: number): Routine => ({
  morning: ACTIVITIES[k % 3],
  afternoon: ACTIVITIES[Math.floor(k / 3) % 3],
  evening: ACTIVITIES[Math.floor(k / 9) % 3],
  night: k % 54 < 27 ? 'stroll' : 'sleep',
});
/** Every house plot taken by a made-up neighbor. */
const fullTown = (prefix: string, routineOf: (index: number) => Routine): Place[] =>
  HOUSE_PLOTS.map((plot, index) =>
    placeSchema.parse({
      ...sample,
      id: `${prefix}-${plot.id.toLowerCase()}`,
      plot: plot.id,
      resident: { ...sample.resident, routine: routineOf(index) },
    }),
  );
/** Evening owls who all go to bed by ten past midnight: the farthest can't see a whole film. */
const sleepyOwls = HOUSE_PLOTS.map((plot) => {
  const owl = (n: number): Place => ({
    ...sample,
    id: `owl-${plot.id.toLowerCase()}-${n}`,
    plot: plot.id,
    resident: { ...sample.resident, routine: routine(8) },
  });
  let n = 0;
  while (nightBedtime(owl(n)) >= 1450) n++;
  return placeSchema.parse(owl(n));
});
const TOWNS = {
  // Every routine, spread over the plots.
  mixed: fullTown('mixed', (index) => routine((index * 7) % 54)),
  // Everyone out all day and a night owl: every seat has a taker from every house plot.
  eager: fullTown('eager', () => routine(0)),
  // Out only in the evening and at night: twelve film guests a night, from every corner.
  owls: sleepyOwls,
  real,
};
const GREEN = ['picnic', 'books', 'games'],
  CONCERTS = ['rock', 'acoustic', 'jazz'];
/**
 * The seats each call has (SPEC §4.0.A): today's, then every Riverside outing's spots from the
 * registry. Football and skating seat six (six stands, six loops).
 */
const CAPACITY: Record<SeatCall, number> = {
  'football-morning': 6,
  green: EVENT_SPOTS.green.length,
  zoo: EVENT_SPOTS.zoo.length,
  'football-afternoon': 6,
  millpond: 6,
  concert: EVENT_SPOTS.stage.length,
  cinema: EVENT_SPOTS.cinema.length,
  'night-party': EVENT_SPOTS.stage.length,
  ...(Object.fromEntries(OUTINGS.map((spec) => [spec.id, spec.seats.spots])) as Record<
    (typeof OUTINGS)[number]['id'],
    number
  >),
};
type Outing = SeatCall;
const outing = (trip: ResidentTrip): Outing =>
  trip.event.outing ??
  (trip.event.id === 'football'
    ? `football-${trip.event.period as 'morning' | 'afternoon'}`
    : GREEN.includes(trip.event.id)
      ? 'green'
      : CONCERTS.includes(trip.event.id)
        ? 'concert'
        : (trip.event.id as Outing));
/** Each routine period's calls, at most one of them per neighbor (SPEC §4.0.F). */
const PERIOD_CALLS: Record<'morning' | 'afternoon' | 'evening' | 'night', Outing[]> = {
  morning: ['football-morning'],
  afternoon: ['green', 'zoo', 'football-afternoon', 'millpond'],
  evening: ['concert'],
  night: ['night-party'],
};
for (const spec of OUTINGS) PERIOD_CALLS[spec.period].push(spec.id);
/**
 * Whether the planner seats the Riverside's outings in this town at all: until it does (SPEC §7.2
 * F4 wires them), none of them has a guest on any day, and their seat checks wait for it.
 */
const riversideSeated = (homes: Place[]) =>
  year(homes).some(({ guests }) => OUTINGS.some((spec) => guests.has(spec.id)));
type Day = {
  day: number;
  plans: Map<string, ResidentTrip[]>;
  guests: Map<Outing, [string, ResidentTrip][]>;
};
/** A year of plans, with each day's guests by outing. */
const years = new Map<Place[], Day[]>();
function year(homes: Place[]) {
  let days = years.get(homes);
  if (!days) {
    days = YEAR.map((day) => {
      const plans = planResidentTrips(homes, day);
      const guests = new Map<Outing, [string, ResidentTrip][]>();
      for (const [id, trips] of plans)
        for (const trip of trips)
          guests.set(outing(trip), [...(guests.get(outing(trip)) ?? []), [id, trip]]);
      return { day, plans, guests };
    });
    years.set(homes, days);
  }
  return days;
}

describe('Event seats at a full town', () => {
  it('fills every seat when enough neighbors can make it', () => {
    for (const homes of [TOWNS.mixed, TOWNS.eager]) {
      const riverside = riversideSeated(homes);
      for (const { day, guests } of year(homes))
        for (const [kind, capacity] of Object.entries(CAPACITY) as [Outing, number][]) {
          const seated = guests.get(kind)?.length ?? 0;
          const spec = outingOf(kind);
          // A Riverside outing seats nobody off its own days, and every seat on them.
          if (spec && !spec.on(day)) expect(seated, `${kind} on day ${day}`).toBe(0);
          else if (spec) {
            if (riverside) expect(seated, `${kind} on day ${day}`).toBe(capacity);
          } else if (kind === 'millpond' && !millpondSkatingDay(day)) expect(seated).toBe(0);
          // The film keeps its own guest list, half the evening owls, and passes no seat on; see
          // the film guests' own test below.
          else if (kind === 'cinema')
            expect(seated).toBeLessThanOrEqual(cinemaGuests(homes, day).length);
          else expect(seated, `${kind} on day ${day}`).toBe(capacity);
        }
    }
  }, 60_000);

  it('seats every film guest who can get to the film and home by bedtime', () => {
    let missed = 0;
    for (const homes of [TOWNS.mixed, TOWNS.eager, TOWNS.owls])
      for (const { day, plans } of year(homes)) {
        const film = eventsForDay(day).find((event) => event.id === 'cinema')!;
        cinemaGuests(homes, day).forEach((id, seat) => {
          const going = plans.get(id)!.find((trip) => trip.event.id === 'cinema');
          if (going) return expect(going.seat).toBe(seat);
          // The film is planned first, so a seat stays empty only for a guest who couldn't make
          // it with nothing else on, worth the walk: not by the tube either, from as early as
          // their day allows.
          missed++;
          const home = homes.find((place) => place.id === id)!;
          const { morning, afternoon } = home.resident.routine;
          const tube = eventTubeJourney(home, film, seat);
          const plan = planJourney(
            tube ? walkedTiles(tube.legs) : routeLength(eventRoute(home, film, seat)),
            tube ? fixedMinutes(tube.legs) : 0,
            film.start,
            film.end,
            afternoon !== 'stroll' ? 1080 : morning !== 'stroll' ? 720 : 360,
            nightBedtime(home),
            film.depart,
            seat * 1.3,
            WORTH_THE_WALK,
          );
          expect(plan, `${id} on day ${day}`).toBeUndefined();
        });
      }
    // The sleepy owls in the far corners do miss it.
    expect(missed).toBeGreaterThanOrEqual(1);
  }, 60_000);

  it('keeps every trip on foot, and the day up to the first ride, at a full town', () => {
    const key = (trip: ResidentTrip) => `${trip.event.id}@${trip.event.start}:${trip.seat}`;
    /**
     * What a trip is, leaving out when: the town's headways move only the times. Times decide
     * whether a party guest hops straight over from the film, so a hop's way there may differ.
     */
    const outing = (trip: ResidentTrip, hop: boolean) => ({
      event: trip.event.id,
      seat: trip.seat,
      facing: trip.facing,
      returnRoute: trip.returnRoute,
      ...(hop ? {} : { route: trip.route }),
    });
    let added = 0,
      retimed = 0;
    for (const homes of [TOWNS.mixed, TOWNS.eager, TOWNS.owls])
      for (const { day, plans } of year(homes).filter((_, index) => index % 4 === 0)) {
        // The same guests in the same seats on foot, each day planned on its own (no headways).
        const walking = planResidentTrips(homes, day, { tube: false });
        for (const home of homes) {
          const trips = plans.get(home.id)!,
            walked = walking.get(home.id)!;
          for (const trip of walked) expect(trips.map(key)).toContain(key(trip));
          added += trips.length - walked.length;
          // Up to the first ride, the same outings walked the same way; only the times move.
          const first = trips.findIndex((trip) => trip.legs || trip.returnLegs);
          for (let i = 0; i < (first < 0 ? trips.length : first); i++) {
            const hop = !!(trips[i - 1]?.continuesTo || walked[i - 1]?.continuesTo);
            expect(outing(trips[i], hop)).toEqual(outing(walked[i], hop));
            if (trips[i].depart !== walked[i].depart || trips[i].leave !== walked[i].leave)
              retimed++;
          }
        }
      }
    expect(added).toBeGreaterThan(100);
    // The headways do move some of them.
    expect(retimed).toBeGreaterThan(0);
  }, 60_000);

  it('never seats more guests than spots, or two guests on one spot', () => {
    for (const homes of Object.values(TOWNS))
      for (const { guests } of year(homes)) {
        for (const [kind, list] of guests) {
          expect(list.length).toBeLessThanOrEqual(CAPACITY[kind]);
          const seats = list.map(([, trip]) => trip.seat);
          expect(new Set(seats).size).toBe(seats.length);
          for (const seat of seats) {
            expect(seat).toBeGreaterThanOrEqual(0);
            expect(seat).toBeLessThan(CAPACITY[kind]);
          }
        }
        // At most one outing each in every routine period (SPEC §4.0.F).
        for (const calls of Object.values(PERIOD_CALLS)) {
          const ids = calls.flatMap((kind) => (guests.get(kind) ?? []).map(([id]) => id));
          expect(new Set(ids).size).toBe(ids.length);
        }
        // The film instead of every call that leaves its guests out: the concert, the Long
        // Table, the sundown set and the stars.
        const film = new Set((guests.get('cinema') ?? []).map(([id]) => id));
        const afterFilm = (Object.keys(SEAT_EXCLUDES) as Outing[]).filter((kind) =>
          SEAT_EXCLUDES[kind].includes('cinema'),
        );
        expect(afterFilm).toContain('concert');
        for (const kind of afterFilm)
          expect(
            (guests.get(kind) ?? []).some(([id]) => film.has(id)),
            kind,
          ).toBe(false);
      }
  }, 60_000);

  it('keeps every day whole at a full town, rides and parcels included', () => {
    const { margin, wait } = TUBE_PARCELS;
    for (const homes of [TOWNS.mixed, TOWNS.eager])
      for (const { day, plans } of year(homes)) {
        for (const home of homes)
          plans.get(home.id)!.forEach((trip, index, trips) => {
            expect(trip.depart).toBeGreaterThanOrEqual(trip.availableFrom);
            expect(trip.homeBy).toBeLessThanOrEqual(trip.availableUntil + 1e-9);
            if (home.resident.routine.night === 'stroll')
              expect(trip.homeBy).toBeLessThanOrEqual(nightBedtime(home) + 1e-9);
            if (index) expect(trip.depart).toBeGreaterThanOrEqual(trips[index - 1].homeBy);
            // At least fifteen minutes while the show is on.
            expect(
              Math.min(trip.event.end, trip.leave) - Math.max(trip.event.start, trip.arrive),
            ).toBeGreaterThanOrEqual(MIN_VISIT_MINUTES - 1e-9);
            if (trip.legs) expect(legsMinutes(trip.legs)).toBeCloseTo(trip.duration, 9);
          });
        if (day % 4) continue;
        const rides = tubeRides(homes, day);
        for (const parcel of tubeParcels(homes, day))
          for (const ride of rides)
            expect(
              ride.off + margin <= parcel.depart - wait ||
                parcel.arrive + wait + margin <= ride.board,
            ).toBe(true);
      }
  }, 60_000);

  it('passes seats round the whole town over a year', () => {
    const homes = TOWNS.eager;
    const seen = new Map<Outing, Set<string>>();
    for (const { guests } of year(homes))
      for (const [kind, list] of guests)
        for (const [id] of list) seen.set(kind, (seen.get(kind) ?? new Set()).add(id));
    // Everyone is free for everything, so most neighbors get to every kind of daily outing: the
    // market's and both Bandstand sets' turn tickets come round to every house.
    for (const kind of [
      'football-morning',
      'green',
      'zoo',
      'football-afternoon',
      'concert',
      'cinema',
      ...(riversideSeated(homes)
        ? (['market', 'bandstand-tea', 'bandstand-sundown'] as const)
        : []),
    ] as const)
      expect(seen.get(kind)!.size, kind).toBeGreaterThan(homes.length * 0.8);
    // Eleven frozen afternoons of six loops go round as far as they can.
    expect(seen.get('millpond')!.size).toBeGreaterThan(50);
  }, 60_000);

  it('lets every night owl who can dance alone dance on some nights', () => {
    const party = eventsForDay(YEAR[0]).find((event) => event.id === 'night-party')!;
    /** Whether the owl's night has room for the disco with nothing else on, by tube or on foot. */
    const canDance = (owl: Place) =>
      planHome(
        owl,
        [{ event: party, seat: 0, period: 'night' }],
        new Map([[party, eventTubeJourney(owl, party, 0)]]),
      ).length > 0;
    const dancers = (homes: Place[]) =>
      new Set(
        year(homes).flatMap(({ guests }) => (guests.get('night-party') ?? []).map(([id]) => id)),
      );
    // The disco takes turns, so every owl's ticket night comes round, wherever they live.
    for (const homes of [TOWNS.eager, TOWNS.mixed, TOWNS.real]) {
      const danced = dancers(homes);
      const owls = homes.filter((owl) => owl.resident.routine.night === 'stroll' && canDance(owl));
      expect(owls.length).toBeGreaterThan(0);
      const missed = owls.filter((owl) => !danced.has(owl.id)).map((owl) => owl.id);
      expect(missed, missed.join(' ')).toEqual([]);
    }
    // A bedtime between midnight and one leaves room to dance when the stage is near enough.
    const early = [...dancers(TOWNS.eager)].filter(
      (id) => nightBedtime(TOWNS.eager.find((home) => home.id === id)!) < 1500,
    );
    expect(early.length).toBeGreaterThan(3);
  }, 60_000);

  it('previews a draft house without moving anyone already in town', () => {
    let outings = 0;
    // A night owl out all day beside the stage, an evening stroller, and a far lunch-goer, each
    // previewed in today's town and in a town a third full.
    for (const [plot, k] of [
      ['A4', 0],
      ['B10', 35],
      ['T10', 46],
    ] as const) {
      const draft = placeSchema.parse({
        ...sample,
        id: 'my-draft',
        plot,
        resident: { ...sample.resident, routine: routine(k) },
      });
      for (const homes of [real, TOWNS.mixed.filter((_, index) => index % 3 === 0)]) {
        const roster = homes.filter((home) => home.plot !== plot);
        const town = withPreview(roster, draft);
        for (const day of YEAR.filter((_, index) => index % 6 === 0)) {
          const before = planResidentTrips(roster, day),
            after = planResidentTrips(town, day);
          for (const home of roster) expect(after.get(home.id)).toEqual(before.get(home.id));
          // The draft's neighbor sits only where nobody else does.
          for (const trip of after.get(draft.id)!) {
            outings++;
            const others = [...before.values()].flat().filter((t) => outing(t) === outing(trip));
            expect(others.map((t) => t.seat)).not.toContain(trip.seat);
            expect(others.length).toBeLessThan(CAPACITY[outing(trip)]);
          }
        }
        for (const minutes of [500, 790, 845, 1150, 1225, 1300, 1430]) {
          const alone = simulateResidents(roster, minutes, YEAR[5]),
            shown = simulateResidents(town, minutes, YEAR[5]);
          alone.forEach((state, index) => {
            expect(shown[index].position).toEqual(state.position);
            expect(shown[index].event).toEqual(state.event);
          });
        }
      }
    }
    expect(outings).toBeGreaterThan(20);
  }, 60_000);

  it('is worth the walk, and keeps two minutes apart at every tube door and venue gate', () => {
    type Mark = { t: number; home: string; hop: boolean };
    /** The minute each rider reaches a boarding door, or leaves a stepping-off one. */
    const doors = (trip: ResidentTrip, going: boolean) => {
      const legs = (going ? trip.legs : trip.returnLegs) ?? [];
      let at = going ? trip.depart : trip.leave;
      const marks: [string, number][] = [];
      for (const leg of legs) {
        if (leg.kind === 'board') marks.push([`door:${leg.from}`, at]);
        at += leg.minutes;
        if (leg.kind === 'alight') marks.push([`door:${leg.to}`, at]);
      }
      return marks;
    };
    let moved = 0,
      trips = 0;
    for (const homes of Object.values(TOWNS))
      for (const { day, plans } of year(homes)) {
        const marks = new Map<string, Mark[]>();
        const mark = (key: string, t: number, home: string, hop: boolean) =>
          marks.set(key, [...(marks.get(key) ?? []), { t, home, hop }]);
        for (const [home, list] of plans)
          list.forEach((trip, index) => {
            trips++;
            const visit =
              Math.min(trip.event.end, trip.leave) - Math.max(trip.event.start, trip.arrive);
            expect(trip.duration).toBeLessThanOrEqual(WORTH_THE_WALK * visit + 1e-9);
            // The film's hop to the stage books its marks but is never moved.
            const hop = !!list[index - 1]?.continuesTo;
            if (!hop) {
              const { arriveShift, leaveShift, leaveCap } = trip.headway!;
              expect(arriveShift).toBeGreaterThanOrEqual(0);
              expect(arriveShift).toBeLessThanOrEqual(HEADWAY_SHIFT_MAX);
              expect(leaveShift).toBeLessThanOrEqual(HEADWAY_SHIFT_MAX);
              expect(trip.leave).toBeLessThanOrEqual(leaveCap + 1e-9);
              if (arriveShift || leaveShift) moved++;
            }
            if (trip.event.id === 'millpond')
              expect(trip.leave).toBeLessThanOrEqual(SKATING.end + 1e-9);
            // Doors, and the minute the guest passes the first point of their way in.
            for (const [key, t] of doors(trip, true)) mark(key, t, home, hop);
            if (!trip.continuesTo)
              for (const [key, t] of doors(trip, false)) mark(key, t, home, hop);
            const approach = eventApproach(trip.event, trip.seat);
            const gate = `gate:${trip.event.venue.id}:${approach[0].x},${approach[0].y}`;
            const minutes = routeLength(approach) / (WALK_SPEED * trip.pace);
            mark(gate, trip.arrive - minutes, home, hop);
            if (!trip.continuesTo) mark(gate, trip.leave + minutes, home, hop);
          });
        for (const [key, list] of marks) {
          const headway = key.startsWith('gate:') ? VENUE_GATE_HEADWAY : TUBE_DOOR_HEADWAY;
          list.sort((a, b) => a.t - b.t);
          for (let i = 0; i < list.length; i++)
            for (let j = i + 1; j < list.length && list[j].t - list[i].t < headway; j++)
              if (list[i].home !== list[j].home && !list[i].hop && !list[j].hop)
                expect.fail(`${key} on day ${day}: ${list[i].home} and ${list[j].home}`);
        }
      }
    // The headways move some trips a little; most keep their time.
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(trips);
  }, 60_000);

  it('plans one home the same whatever was planned before', () => {
    const party = eventsForDay(YEAR[3]).find((event) => event.id === 'night-party')!;
    const owl = TOWNS.eager.find((home) => home.plot === 'A4')!;
    const alone = () =>
      planHome(
        owl,
        [{ event: party, seat: 0, period: 'night' }],
        new Map([[party, eventTubeJourney(owl, party, 0)]]),
      );
    const before = alone();
    expect(before).toHaveLength(1);
    planResidentTrips(TOWNS.eager, YEAR[3]);
    expect(alone()).toEqual(before);
    expect(before[0].headway).toBeUndefined();
  });

  it('plans the same day for any roster order', () => {
    for (const homes of [TOWNS.mixed, TOWNS.eager]) {
      const day = YEAR[93];
      const forward = planResidentTrips(homes, day),
        backward = planResidentTrips([...homes].reverse(), day);
      for (const home of homes) expect(backward.get(home.id)).toEqual(forward.get(home.id));
    }
  });
});

/** Run with the default collation set to another language, as a visitor's browser would. */
function inLanguage<T>(locale: string, run: () => T): T {
  const original = String.prototype.localeCompare;
  String.prototype.localeCompare = function (
    this: string,
    that: string,
    locales?: Intl.LocalesArgument,
    options?: Intl.CollatorOptions,
  ) {
    return original.call(this, that, locales ?? locale, options);
  } as typeof original;
  try {
    return run();
  } finally {
    String.prototype.localeCompare = original;
  }
}

describe('Event seats in every browser language', () => {
  it('draws the same guests, seats and films when two ids tie', () => {
    const day = CALENDAR_EPOCH_DAY;
    // Pairs whose daily draw ties exactly, so only the ids can order them. Lithuanian sorts "y"
    // with "i", before "j"; English and code units put "j" first.
    const lunch = ['tie-j41488', 'tie-y563242'],
      film = ['tie-j101642', 'tie-y1769200'],
      bill = ['tie-j31989', 'tie-y5994356'];
    const picnic = eventsForDay(day)[0].id;
    expect(hash(`${day}:${picnic}:${lunch[0]}`)).toBe(hash(`${day}:${picnic}:${lunch[1]}`));
    expect(hash(`cinema-guests:${day}:${film[0]}`)).toBe(hash(`cinema-guests:${day}:${film[1]}`));
    expect(hash(`cinema:${day}:${bill[0]}`)).toBe(hash(`cinema:${day}:${bill[1]}`));
    expect(inLanguage('lt', () => lunch[1].localeCompare(lunch[0]))).toBeLessThan(0);
    // Two lunch-goers who both get the green, and two evening owls who share one film seat.
    const homes = [...lunch, ...film].map((id, index) =>
      placeSchema.parse({
        ...sample,
        id,
        plot: HOUSE_PLOTS[index].id,
        resident: { ...sample.resident, routine: routine(index < 2 ? 47 : 8) },
      }),
    );
    const library = CINEMA_FILMS.slice(0, 3).map((entry, index) => ({
      ...entry,
      id: bill[index] ?? entry.id,
    }));
    const draw = () => ({
      trips: [...planResidentTrips(homes, day)],
      town: [...planResidentTrips(real, day)],
      guests: cinemaGuests(homes, day),
      films: cinemaProgram(day, library).films.map((film) => film.id),
    });
    const english = inLanguage('en', draw);
    expect(english.guests).toEqual([film[0]]);
    for (const locale of ['lt', 'haw', 'da', 'cs'])
      expect(inLanguage(locale, draw)).toEqual(english);
  });
});
