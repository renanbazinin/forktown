// How far every outing is from every house plot of the 20 × 15 town, and who can make it
// (SPEC §4.8, §6.4): the worst door-to-seat trip to each venue, best of walk or tube, and the
// share of house plots whose narrowest routine can make each outing under the planner's own
// rules (worth the walk, each home's own market window, each regatta seat's own launch, night
// owls at mid-band). No plans: seat 0 from every house plot, about a second in all.
import { describe, expect, it } from 'vitest';
import { OUTING_TIMES, REGATTA_LAUNCH_EVERY, type OutingId } from '../src/lib/district-calendar';
import {
  BANDSTAND_VENUE,
  HARVEST_VENUE,
  LANDING_VENUE,
  MARKET_VENUE,
  type DistrictVenue,
} from '../src/lib/district-places';
import { eventsForDay, HOUSE_PLOTS, VENUES } from '../src/lib/events';
import {
  eventRoute,
  eventTubeJourney,
  footballVisit,
  marketWindow,
  skatingVisit,
  type VisitEvent,
} from '../src/lib/resident-trips';
import type { Place } from '../src/lib/schema';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { fixedMinutes, walkedTiles } from '../src/lib/tube-journeys';
import { planJourney, routeLength, WALK_SPEED, WORTH_THE_WALK } from '../src/lib/walking';

const program = eventsForDay(CALENDAR_EPOCH_DAY + 100);
const event = (id: string) => program.find((candidate) => candidate.id === id)!;
const outing = (id: OutingId, venue: DistrictVenue, period: VisitEvent['period']): VisitEvent => ({
  id,
  outing: id,
  name: id,
  description: '',
  venue,
  period,
  ...OUTING_TIMES[id],
});
const OUTINGS = {
  footballMorning: footballVisit('morning'),
  footballAfternoon: footballVisit('afternoon'),
  lunch: program[0],
  zoo: event('zoo'),
  skating: skatingVisit,
  concert: program[1],
  film: event('cinema'),
  disco: event('night-party'),
  market: outing('market', MARKET_VENUE, 'morning'),
  regatta: outing('regatta', LANDING_VENUE, 'afternoon'),
  fair: outing('harvest-fair', HARVEST_VENUE, 'afternoon'),
  tea: outing('bandstand-tea', BANDSTAND_VENUE, 'afternoon'),
  table: outing('long-table', HARVEST_VENUE, 'evening'),
  sundown: outing('bandstand-sundown', BANDSTAND_VENUE, 'evening'),
  stars: outing('stargazing', BANDSTAND_VENUE, 'night'),
} satisfies Record<string, VisitEvent>;
type Name = keyof typeof OUTINGS;

/** A home on a plot whose narrowest routine is out only in `period` (and at night, owls). */
const homeOn = (plot: string, morningOnly = false): Place =>
  ({
    id: `full-town-${plot.toLowerCase()}`,
    plot,
    resident: {
      routine: morningOnly
        ? { morning: 'stroll', afternoon: 'work', evening: 'work', night: 'sleep' }
        : {},
    },
  }) as unknown as Place;
/** Seat `seat`'s trip from a plot, best of walk or tube: walked tiles and fixed minutes. */
function trip(plot: string, visit: VisitEvent, seat = 0) {
  const home = homeOn(plot);
  const tube = eventTubeJourney(home, visit, seat);
  const walkTiles = tube ? walkedTiles(tube.legs) : routeLength(eventRoute(home, visit, seat));
  const fixed = tube ? fixedMinutes(tube.legs) : 0;
  return { walkTiles, fixed, unhurried: walkTiles / WALK_SPEED + fixed };
}
/** The worst unhurried door-to-seat minutes over every house plot. */
const worst = (visit: VisitEvent, seat = 0) =>
  Math.max(...HOUSE_PLOTS.map((plot) => trip(plot.id, visit, seat).unhurried));

/** Owls' bedtimes at the middle of their three bands: 00:30, 02:30 and 04:30. */
const BEDS = [1470, 1590, 1710];
/** The narrowest routine window of each outing's period; film-goers stay out to bedtime. */
const windows = (name: Name): [number, number][] => {
  if (name === 'film') return BEDS.map((bed) => [1080, bed]);
  if (name === 'disco' || name === 'stars') return BEDS.map((bed) => [1320, bed]);
  const period = OUTINGS[name].period;
  return [period === 'morning' ? [360, 720] : period === 'afternoon' ? [720, 1080] : [1080, 1320]];
};
/** The house plots whose narrowest routine makes the outing, per window, under the planner's rules. */
function reach(name: Name, seat = 0): Set<string>[] {
  const visit = OUTINGS[name];
  return windows(name).map(([from, until]) => {
    const made = new Set<string>();
    for (const plot of HOUSE_PLOTS) {
      const { walkTiles, fixed } = trip(plot.id, visit, seat);
      // The market at each home's own hour, each regatta seat at its own launch.
      const own =
        name === 'market'
          ? marketWindow(homeOn(plot.id, true))
          : name === 'regatta'
            ? { start: visit.start + REGATTA_LAUNCH_EVERY * seat, end: visit.end }
            : visit;
      const stagger = name === 'regatta' ? seat * 1.3 : 0;
      if (
        planJourney(
          walkTiles,
          fixed,
          own.start,
          own.end,
          from,
          until,
          visit.depart,
          stagger,
          WORTH_THE_WALK,
        )
      )
        made.add(plot.id);
    }
    return made;
  });
}
const share = (plots: Set<string>) => plots.size / HOUSE_PLOTS.length;

describe('Journeys across the 20 × 15 town', () => {
  it('reaches every venue from every house plot within its ceiling', () => {
    // Unhurried minutes, door to seat, best of walk or tube (SPEC §6.4). Today's 20 × 10 worst
    // is 273: no venue may take longer than that.
    const ceilings: [string, VisitEvent, number][] = [
      ['football', OUTINGS.footballMorning, 209],
      ['green', OUTINGS.lunch, 184],
      ['zoo', OUTINGS.zoo, 245],
      ['millpond', OUTINGS.skating, 226],
      ['stage', OUTINGS.concert, 189],
      ['cinema', OUTINGS.film, 235],
      ['market', OUTINGS.market, 178],
      ['landing', OUTINGS.regatta, 170],
      // Seat 0 of both farm outings, through the north gate.
      ['farm, the fair', OUTINGS.fair, 197],
      ['farm, the Long Table', OUTINGS.table, 197],
      ['bandstand', OUTINGS.tea, 172],
    ];
    expect(VENUES.map((venue) => venue.id)).toEqual(
      expect.arrayContaining(['green', 'stage', 'cinema', 'zoo', 'market', 'bandstand', 'landing']),
    );
    for (const [where, visit, ceiling] of ceilings) {
      const minutes = worst(visit);
      expect(minutes, where).toBeLessThanOrEqual(ceiling);
      expect(minutes, where).toBeLessThan(273);
    }
  }, 60_000);

  it('lets the narrowest routines make each outing, as often as the town promises', () => {
    const at = (name: Name) => reach(name).map(share);
    // Every house plot: the football both times, the lunch, the market, the fair and the film.
    for (const name of ['footballMorning', 'footballAfternoon', 'lunch', 'market', 'fair'] as const)
      expect(at(name)[0], name).toBe(1);
    expect(at('film')).toEqual([1, 1, 1]);
    // The regatta's seats launch six minutes apart: the last two leave a little less time.
    for (let seat = 0; seat < 10; seat++)
      expect(share(reach('regatta', seat)[0]), `regatta seat ${seat}`).toBeGreaterThanOrEqual(
        seat < 8 ? 1 : 0.95,
      );
    expect(at('zoo')[0]).toBeGreaterThanOrEqual(0.96);
    expect(at('concert')[0]).toBeGreaterThanOrEqual(0.74);
    // An evening-only neighbor far from the stage has the sundown set instead.
    expect(share(new Set([...reach('concert')[0], ...reach('sundown')[0]]))).toBeGreaterThanOrEqual(
      0.95,
    );
    expect(at('tea')[0]).toBeGreaterThanOrEqual(0.49);
    expect(at('sundown')[0]).toBeGreaterThanOrEqual(0.9);
    expect(at('table')[0]).toBeGreaterThanOrEqual(0.77);
    const stars = at('stars'),
      disco = at('disco');
    [0.42, 0.96, 0.96].forEach((floor, band) => expect(stars[band]).toBeGreaterThanOrEqual(floor));
    [0.05, 0.9, 0.98].forEach((floor, band) => expect(disco[band]).toBeGreaterThanOrEqual(floor));
  }, 60_000);
});
