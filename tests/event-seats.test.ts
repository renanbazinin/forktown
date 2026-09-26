import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { placeSchema, validatePlaces, type Place } from '../src/lib/schema';
import { EVENT_SPOTS, eventsForDay, HOUSE_PLOTS } from '../src/lib/events';
import { hash } from '../src/lib/world';
import {
  eventRoute,
  eventTubeJourney,
  planResidentTrips,
  withPreview,
  type ResidentTrip,
} from '../src/lib/resident-trips';
import { legsMinutes } from '../src/lib/tube-journeys';
import { tubeParcels, tubeRides } from '../src/lib/tube-traffic';
import { TUBE_PARCELS } from '../src/lib/tubes';
import { MIN_VISIT_MINUTES, routeLength, WALK_SPEED } from '../src/lib/walking';
import { simulateResidents } from '../src/lib/simulation';
import { CINEMA_FILMS, cinemaGuests, cinemaProgram } from '../src/lib/cinema';
import { millpondSkatingDay } from '../src/lib/millpond';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { nightBedtime } from '../src/lib/night-routine';

const real = validatePlaces(
  readdirSync('places')
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({ file, data: JSON.parse(readFileSync(`places/${file}`, 'utf8')) })),
).places;
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
const TOWNS = {
  // Every routine, spread over the plots.
  mixed: fullTown('mixed', (index) => routine((index * 7) % 54)),
  // Everyone out all day and a night owl: every seat has 141 takers.
  eager: fullTown('eager', () => routine(0)),
  real,
};
const GREEN = ['picnic', 'books', 'games'],
  CONCERTS = ['rock', 'acoustic', 'jazz'];
/** The seats each kind of outing has. Football and skating seat six (six stands, six loops). */
const CAPACITY = {
  'football-morning': 6,
  green: EVENT_SPOTS.green.length,
  zoo: EVENT_SPOTS.zoo.length,
  'football-afternoon': 6,
  millpond: 6,
  concert: EVENT_SPOTS.stage.length,
  cinema: EVENT_SPOTS.cinema.length,
  'night-party': EVENT_SPOTS.stage.length,
};
type Outing = keyof typeof CAPACITY;
const outing = (trip: ResidentTrip): Outing =>
  trip.event.id === 'football'
    ? `football-${trip.event.period as 'morning' | 'afternoon'}`
    : GREEN.includes(trip.event.id)
      ? 'green'
      : CONCERTS.includes(trip.event.id)
        ? 'concert'
        : (trip.event.id as Outing);
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
    for (const homes of [TOWNS.mixed, TOWNS.eager])
      for (const { day, guests } of year(homes))
        for (const [kind, capacity] of Object.entries(CAPACITY) as [Outing, number][]) {
          const seated = guests.get(kind)?.length ?? 0;
          if (kind === 'millpond' && !millpondSkatingDay(day)) expect(seated).toBe(0);
          // The cinema keeps its own guest list: half the evening owls, and every one of them goes.
          else if (kind === 'cinema') expect(seated).toBe(cinemaGuests(homes, day).length);
          else expect(seated, `${kind} on day ${day}`).toBe(capacity);
        }
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
        // One afternoon outing each, and the film instead of the concert.
        const afternoon = (['green', 'zoo', 'football-afternoon', 'millpond'] as const).flatMap(
          (kind) => (guests.get(kind) ?? []).map(([id]) => id),
        );
        expect(new Set(afternoon).size).toBe(afternoon.length);
        const film = new Set((guests.get('cinema') ?? []).map(([id]) => id));
        expect((guests.get('concert') ?? []).some(([id]) => film.has(id))).toBe(false);
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
    // Everyone is free for everything, so most neighbors get to every kind of outing.
    for (const kind of [
      'football-morning',
      'green',
      'zoo',
      'football-afternoon',
      'concert',
      'cinema',
    ] as const)
      expect(seen.get(kind)!.size, kind).toBeGreaterThan(homes.length * 0.8);
    // Eleven frozen afternoons of six loops go round as far as they can.
    expect(seen.get('millpond')!.size).toBeGreaterThan(50);
  }, 60_000);

  it('lets every night owl with time to dance before bedtime dance on some nights', () => {
    const party = eventsForDay(YEAR[0]).find((event) => event.id === 'night-party')!;
    /** Minutes to spare after reaching the stage by 23:30, dancing fifteen and going home unhurried. */
    const spare = (owl: Place) => {
      const tube = eventTubeJourney(owl, party, 0);
      const trip = tube
        ? legsMinutes(tube.legs)
        : routeLength(eventRoute(owl, party, 0)) / WALK_SPEED;
      return nightBedtime(owl) - party.start - MIN_VISIT_MINUTES - trip;
    };
    const dancers = (homes: Place[]) =>
      new Set(
        year(homes).flatMap(({ guests }) => (guests.get('night-party') ?? []).map(([id]) => id)),
      );
    for (const homes of [TOWNS.eager, TOWNS.mixed, TOWNS.real]) {
      const danced = dancers(homes);
      for (const owl of homes)
        if (owl.resident.routine.night === 'stroll' && spare(owl) >= 2)
          expect(danced.has(owl.id), owl.id).toBe(true);
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
