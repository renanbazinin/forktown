// The Riverside's outings: one spec for each, the planner's single registry (SPEC §4.0, §7.0).
// Every field but the feature functions is frozen data from the district calendar and places;
// the poses and glances come from src/lib/outings/*.ts, one file per feature agent. The planner
// (resident-trips.ts), the labels and the tests read the outings from here and nowhere else.
// events.ts never imports this file: the events list is built from the frozen data alone.
import type { Place } from './schema.ts';
import type { ResidentTrip } from './resident-trips.ts';
import type { EventPose } from './events.ts';
import { hash } from './world.ts';
import {
  MARKET_KINDS,
  marketKind,
  OUTING_TABLE,
  OUTING_TIMES,
  outingOn,
  type OutingId,
  type OutingTimes,
} from './district-calendar.ts';
import {
  BANDSTAND_VENUE,
  HARVEST_VENUE,
  LANDING_VENUE,
  MARKET_VENUE,
  outingSpots,
  type DistrictVenue,
  type Spot,
} from './district-places.ts';
import { marketFacing, marketPose } from './outings/market.ts';
import { sundownPose, teaPose } from './outings/bandstand.ts';
import { REGATTA_SET_DOWN, regattaPose } from './outings/regatta.ts';
import { fairPose, tablePose } from './outings/harvest.ts';
import { starPose } from './outings/stargazing.ts';

// The snowmen are a lunch on the green, not an outing: the planner calls these on its own.
export {
  snowmenBuilderFacing,
  snowmenBuilderPose,
  snowmenWatcherPose,
  type SnowmenContext,
} from './outings/snowmen.ts';

/** What a guest carries on one leg of an outing: drawn by src/city/carry-items.ts. */
export type CarryKind = 'paper-bag' | 'paper-boat' | 'dish';
/** Everything a feature's pose or glance may read: the home, its trip and the moment. */
export type PoseContext = {
  home: Place;
  trip: ResidentTrip;
  time: number;
  day: number;
  seat: number;
  arrive: number;
  leave: number;
};
/** A guest's pose at their spot while the outing is on; undefined stands them up. Existing poses only. */
export type OutingPose = (c: PoseContext) => EventPose | undefined;
/** Where a guest looks while the outing is on; undefined keeps their spot's own facing. */
export type OutingFacing = (c: PoseContext) => Spot['facing'] | undefined;

/**
 * Every seat call of a plan day, in the order the planner makes them (SPEC §4.0.A): festivals
 * first in their period, today's daily outings next on their own lines, new daily outings last.
 * The ids are the program's own where it has one (`cinema` is the film, `green` the lunch,
 * `concert` the evening show, `millpond` the skating).
 */
export const SEAT_ORDER = [
  'cinema',
  'football-morning',
  'regatta',
  'harvest-fair',
  'green',
  'zoo',
  'football-afternoon',
  'millpond',
  'long-table',
  'concert',
  'stargazing',
  'night-party',
  'market',
  'bandstand-tea',
  'bandstand-sundown',
] as const;
export type SeatCall = (typeof SEAT_ORDER)[number];
/** The calls whose guests a call leaves out, that day (SPEC §4.0.A "Excludes"). */
export const SEAT_EXCLUDES: Record<SeatCall, readonly SeatCall[]> = {
  cinema: [],
  'football-morning': [],
  regatta: [],
  'harvest-fair': ['regatta'],
  green: ['regatta', 'harvest-fair'],
  zoo: ['regatta', 'harvest-fair', 'green'],
  'football-afternoon': ['regatta', 'harvest-fair', 'green', 'zoo'],
  millpond: ['regatta', 'harvest-fair', 'green', 'zoo', 'football-afternoon'],
  'long-table': ['cinema'],
  concert: ['cinema', 'long-table'],
  stargazing: ['cinema'],
  'night-party': ['stargazing'],
  market: ['football-morning'],
  'bandstand-tea': ['regatta', 'harvest-fair', 'green', 'zoo', 'football-afternoon', 'millpond'],
  'bandstand-sundown': ['cinema', 'long-table', 'concert'],
};

export type OutingSpec = {
  id: OutingId;
  venue: DistrictVenue;
  period: 'morning' | 'afternoon' | 'evening' | 'night';
  on(day: number): boolean;
  times: OutingTimes;
  seats: { rule: 'all' | 'half'; spots: number };
  excludes: readonly string[];
  /** Its place in SEAT_ORDER, from 1 (SPEC §4.0.A's #). */
  order: number;
  underway: boolean;
  seated: boolean;
  carry?: {
    kind: CarryKind;
    leg: 'going' | 'returning';
    variant(day: number, homeId: string): number;
    /** Minutes halfway down on arrival, setting it on the ground there (the regatta's boat). */
    setDown?: number;
  };
  /** Feature-owned. */
  pose(c: PoseContext): EventPose | undefined;
  /** Feature-owned. */
  facing?(c: PoseContext): Spot['facing'] | undefined;
};

/** The frozen part of an outing's spec, straight from the calendar and the places. */
function frozen(id: OutingId, venue: DistrictVenue, period: OutingSpec['period']) {
  const { underway, seated, rule } = OUTING_TABLE[id];
  return {
    id,
    venue,
    period,
    on: (day: number) => outingOn(id, day),
    times: OUTING_TIMES[id],
    seats: { rule, spots: outingSpots(id).length },
    excludes: SEAT_EXCLUDES[id],
    order: SEAT_ORDER.indexOf(id) + 1,
    underway,
    seated,
  };
}

/** Every outing, in seat order. */
export const OUTINGS: readonly OutingSpec[] = [
  {
    ...frozen('regatta', LANDING_VENUE, 'afternoon'),
    carry: { kind: 'paper-boat', leg: 'going', variant: () => 0, setDown: REGATTA_SET_DOWN },
    pose: regattaPose,
  },
  { ...frozen('harvest-fair', HARVEST_VENUE, 'afternoon'), pose: fairPose },
  {
    ...frozen('long-table', HARVEST_VENUE, 'evening'),
    carry: { kind: 'dish', leg: 'going', variant: (day, id) => hash(`dish:${day}:${id}`) % 3 },
    pose: tablePose,
  },
  { ...frozen('stargazing', BANDSTAND_VENUE, 'night'), pose: starPose },
  {
    ...frozen('market', MARKET_VENUE, 'morning'),
    carry: {
      kind: 'paper-bag',
      leg: 'returning',
      variant: (day) => MARKET_KINDS.indexOf(marketKind(day)),
    },
    pose: marketPose,
    facing: marketFacing,
  },
  { ...frozen('bandstand-tea', BANDSTAND_VENUE, 'afternoon'), pose: teaPose },
  { ...frozen('bandstand-sundown', BANDSTAND_VENUE, 'evening'), pose: sundownPose },
];

const byId = new Map<string, OutingSpec>(OUTINGS.map((outing) => [outing.id, outing]));
/** The outing with this id (an event id or a seat call), or undefined for every other event. */
export const outingOf = (id: string): OutingSpec | undefined => byId.get(id);
