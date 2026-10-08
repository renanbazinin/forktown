// The towns and the year the Riverside's checks share: four towns planned once
// for all 112 days of a town year, and each day's guests by seat call. tests/outings.test.ts reads
// them; nothing here asserts anything.
import { readFileSync } from 'node:fs';
import { HOUSE_PLOTS } from '../src/lib/events';
import { planResidentTrips, type PlanOptions, type ResidentTrip } from '../src/lib/resident-trips';
import { placeSchema, type Place } from '../src/lib/schema';
import type { SeatCall } from '../src/lib/outings';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { fullTown, readPlaces } from './full-town';

/** A town year, from the calendar's epoch: Spring 1 to Winter 28. */
export const YEAR = Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + i);

export const SAMPLE = placeSchema.parse(
  JSON.parse(readFileSync('places/my-little-place.json', 'utf8')),
);
type Routine = Place['resident']['routine'];
const ACTIVITIES = ['stroll', 'work', 'home'] as const;
/** One of the 54 routines: morning, afternoon and evening out, working or home, then night. */
export const routine = (k: number): Routine => ({
  morning: ACTIVITIES[k % 3],
  afternoon: ACTIVITIES[Math.floor(k / 3) % 3],
  evening: ACTIVITIES[Math.floor(k / 9) % 3],
  night: k % 54 < 27 ? 'stroll' : 'sleep',
});
/** Every house plot taken by a made-up neighbor with the routine its index gives. */
export const madeUpTown = (prefix: string, routineOf: (index: number) => Routine): Place[] =>
  HOUSE_PLOTS.map((plot, index) =>
    placeSchema.parse({
      ...SAMPLE,
      id: `${prefix}-${plot.id.toLowerCase()}`,
      plot: plot.id,
      resident: { ...SAMPLE.resident, routine: routineOf(index) },
    }),
  );

/**
 * Today's 30 houses, frozen in October 2026 (tests/fixtures/town-2026-10.json): the real town's
 * floors run on this copy, so a neighbor who remodels or moves out never turns a check red.
 */
export const FROZEN_TOWN: Place[] = (
  JSON.parse(readFileSync('tests/fixtures/town-2026-10.json', 'utf8')) as unknown[]
).map((place) => placeSchema.parse(place));
/** The published roster as it is (in check:full-town, every house plot taken). */
export const LIVE_TOWN = readPlaces();

export const TOWNS = {
  /** Every routine, spread over the plots. */
  mixed: madeUpTown('mixed', (index) => routine((index * 7) % 54)),
  /** Everyone out all day and a night owl: every seat has a taker from every house plot. */
  eager: madeUpTown('eager', () => routine(0)),
  /** The frozen real town. */
  real: FROZEN_TOWN,
  /** The real town with a made-up house on every free plot. */
  full: fullTown(LIVE_TOWN),
};
export type TownName = keyof typeof TOWNS;

const GREEN = ['picnic', 'books', 'games'],
  CONCERTS = ['rock', 'acoustic', 'jazz'];
/** The seat call a trip answers (SEAT_ORDER). */
export const callOf = (trip: ResidentTrip): SeatCall =>
  trip.event.outing ??
  (trip.event.id === 'football'
    ? `football-${trip.event.period as 'morning' | 'afternoon'}`
    : GREEN.includes(trip.event.id)
      ? 'green'
      : CONCERTS.includes(trip.event.id)
        ? 'concert'
        : (trip.event.id as SeatCall));

export type PlanDay = {
  day: number;
  plans: Map<string, ResidentTrip[]>;
  /** Each call's guests: their home id and trip. */
  guests: Map<SeatCall, [string, ResidentTrip][]>;
};
/** A day's guests by call. */
export function guestsOf(plans: ReadonlyMap<string, readonly ResidentTrip[]>) {
  const guests = new Map<SeatCall, [string, ResidentTrip][]>();
  for (const [id, trips] of plans)
    for (const trip of trips) {
      const call = callOf(trip);
      const list = guests.get(call);
      if (list) list.push([id, trip]);
      else guests.set(call, [[id, trip]]);
    }
  return guests;
}

const years = new Map<Place[], Map<string, PlanDay[]>>();
/** A town's year of plans, planned once per town and options. */
export function yearOf(homes: Place[], options: PlanOptions = {}): PlanDay[] {
  const key = JSON.stringify(options);
  let byOptions = years.get(homes);
  if (!byOptions) years.set(homes, (byOptions = new Map()));
  let days = byOptions.get(key);
  if (!days) {
    days = YEAR.map((day) => {
      const plans = planResidentTrips(homes, day, options);
      return { day, plans, guests: guestsOf(plans) };
    });
    byOptions.set(key, days);
  }
  return days;
}
