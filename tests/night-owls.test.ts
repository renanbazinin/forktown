import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cinemaGuests } from '../src/lib/cinema';
import { eventsForDay, EVENT_SPOTS, HOUSE_PLOTS } from '../src/lib/events';
import {
  costsTheDance,
  DISCO_CARRY_NIGHTS,
  discoTickets,
  eventTubeJourney,
  planHome,
  planResidentTrips,
  ticketRank,
  withPreview,
  type ResidentTrip,
} from '../src/lib/resident-trips';
import { placeSchema, type Place } from '../src/lib/schema';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { MY_LITTLE_PLACE } from './fixtures';

// A night owl on any free plot gets to dance. The disco seats on turn tickets, but the film and the
// concert are seated first, and from far off neither leaves room for the dance afterwards: before,
// an owl busy in the afternoon and out all evening and night never danced all year on about
// seventy plots. Built on the town frozen in October 2026, so no roster change moves these.

const FROZEN: Place[] = (
  JSON.parse(readFileSync('tests/fixtures/town-2026-10.json', 'utf8')) as unknown[]
).map((place) => placeSchema.parse(place));
const YEAR = Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + i);
const CAP = EVENT_SPOTS.stage.length;
type Routine = Place['resident']['routine'];
const ACTIVITIES = ['stroll', 'work', 'home'] as const;
/** One of the 27 routines out at night: morning, afternoon and evening out, working or home. */
const owlRoutine = (k: number): Routine => ({
  morning: ACTIVITIES[k % 3],
  afternoon: ACTIVITIES[Math.floor(k / 3) % 3],
  evening: ACTIVITIES[Math.floor(k / 9) % 3],
  night: 'stroll',
});
/** A newcomer who has moved in on `plot` (in the roster, so they hold tickets). */
const owl = (plot: string, k: number, id = 'a-night-owl'): Place =>
  placeSchema.parse({
    ...MY_LITTLE_PLACE,
    id,
    plot,
    resident: { ...MY_LITTLE_PLACE.resident, routine: owlRoutine(k) },
  });
const party = (day: number) => eventsForDay(day).find((event) => event.id === 'night-party')!;
const cinema = (day: number) => eventsForDay(day).find((event) => event.id === 'cinema')!;
/** Whether the owl's night has room for the disco with nothing else on, by tube or on foot. */
const canDance = (home: Place) => {
  const dance = { event: party(YEAR[0]), seat: 0, period: 'night' as const };
  const journeys = new Map([[dance.event, eventTubeJourney(home, dance.event, 0)]]);
  return planHome(home, [dance], journeys).length > 0;
};
const dances = (trips: readonly ResidentTrip[] | undefined) =>
  !!trips?.some((trip) => trip.event.id === 'night-party');
const holds = (plot: string, day: number) =>
  ticketRank('night-party', CAP, day, plot) !== undefined;
const free = HOUSE_PLOTS.map((plot) => plot.id).filter(
  (plot) => !FROZEN.some((home) => home.plot === plot),
);

describe('Night owls on any plot', () => {
  it('dance on some night of the year, wherever they move in, when they can dance alone', () => {
    const missed: string[] = [];
    let owls = 0;
    free.forEach((plot, index) => {
      // On every plot an owl busy in the afternoon and out all evening (the ones the film and the
      // concert kept off the floor), and one of the other routines in turn.
      for (const k of [3 + (index % 6), (index * 5) % 27]) {
        const newcomer = owl(plot, k);
        if (!canDance(newcomer)) continue;
        owls++;
        const town = [...FROZEN, newcomer];
        // Their ticket nights first, then the rest of the year: the first dance will do.
        const nights = new Set([...YEAR.filter((day) => holds(plot, day)), ...YEAR]);
        if (![...nights].some((day) => dances(planResidentTrips(town, day).get(newcomer.id))))
          missed.push(`${plot}:${k}`);
      }
    });
    expect(owls).toBeGreaterThan(300);
    expect(missed, missed.join(' ')).toEqual([]);
  }, 60_000);

  it('turns the concert down only when it would cost a ticket holder the dance', () => {
    // Far owls, busy in the afternoon and out all evening and night, around the town.
    const owls = ['M6', 'K4', 'J12', 'T12', 'R10'].map((plot, n) => owl(plot, 3 + n, `owl-${n}`));
    const town = [...FROZEN, ...owls];
    let held = 0,
      turned = 0;
    for (const day of YEAR) {
      const plans = planResidentTrips(town, day),
        concert = eventsForDay(day)[1].id;
      for (const [home] of discoTickets(town, day)) {
        held++;
        const trips = plans.get(home.id)!;
        const seated = trips.find((trip) => trip.event.id === concert);
        // At the concert with a ticket: it left room for the dance.
        if (seated) {
          const candidate = { event: seated.event, seat: seated.seat, period: 'evening' as const };
          expect(costsTheDance(home, candidate, party(day)), `${home.id} on ${day}`).toBe(false);
        } else if (owls.includes(home) && dances(trips)) turned++;
      }
    }
    expect(held).toBeGreaterThan(20);
    // The far owls dance on their ticket nights rather than sit through the concert.
    expect(turned).toBeGreaterThan(5);
  });

  it('carries a ticket the film wastes on to the next night off the film', () => {
    let carried = 0,
      danced = 0;
    free
      .filter((_, index) => index % 4 === 0)
      .forEach((plot) => {
        const newcomer = owl(plot, 3);
        const town = [...FROZEN, newcomer];
        for (const night of YEAR.filter((day) => holds(plot, day))) {
          const seat = cinemaGuests(town, night).indexOf(newcomer.id);
          // A night off the film: the ticket is tonight's.
          if (seat < 0) {
            expect(discoTickets(town, night).get(newcomer)).toBe(night);
            continue;
          }
          const film = { event: cinema(night), seat, period: 'evening' as const };
          if (!costsTheDance(newcomer, film, party(night))) continue;
          // The film costs the dance: no ticket tonight, but on the next night off the film.
          expect(discoTickets(town, night).has(newcomer)).toBe(false);
          const next = Array.from({ length: DISCO_CARRY_NIGHTS }, (_, n) => night + n + 1).find(
            (day) => !cinemaGuests(town, day).includes(newcomer.id),
          );
          if (next === undefined) continue;
          carried++;
          expect(discoTickets(town, next).get(newcomer), `${plot} on ${next}`).toBe(night);
          if (dances(planResidentTrips(town, next).get(newcomer.id))) danced++;
        }
      });
    expect(carried).toBeGreaterThan(5);
    // Nearly every carried ticket is danced: only the stars, or a floor full of tonight's own
    // holders, can still take one.
    expect(danced).toBeGreaterThan(carried * 0.8);
  });

  it('keeps the tickets the same in any roster order, and never moves one for a draft', () => {
    const town = [...FROZEN, owl('M6', 4)];
    const tickets = (homes: Place[], day: number) =>
      [...discoTickets(homes, day)].map(([home, night]) => `${home.id}@${night}`).sort();
    for (const day of YEAR.filter((_, index) => index % 5 === 0)) {
      expect(tickets([...town].reverse(), day)).toEqual(tickets(town, day));
      // A previewed draft on a plot whose ticket is tonight holds none, and moves nobody.
      const plot = free.find((id) => id !== 'M6' && holds(id, day))!;
      const draft = owl(plot, 0, 'my-draft');
      const shown = planResidentTrips(withPreview(town, draft), day),
        alone = planResidentTrips(town, day);
      for (const home of town) expect(shown.get(home.id)).toEqual(alone.get(home.id));
    }
  });
});
