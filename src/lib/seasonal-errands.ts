// One small seasonal round, fitted around the day's existing outings. No inventory or saved
// errands: the resident, routes, objects and handoffs all come from the published town and clock.
import type { Place } from './schema';
import type { ResidentState } from './simulation';
import { getPlot, hash, plotEntrance, type Point } from './world';
import { townCalendarAt } from './town-calendar';
import { MILLPOND_GATE } from './millpond';
import { tubeStation } from './tubes';
import {
  endFacing,
  publishedRoster,
  residentTrips,
  startFacing,
  strollRuns,
} from './resident-trips';
import { laneAt, laneSide, type LanePath, type LanePiece } from './lanes';
import { walkAlong } from './tube-journeys';
import { opposite, roadPath, routeLength, sideways, WALK_SPEED } from './walking';

export type ErrandKind = 'seedlings' | 'lemonade' | 'harvest' | 'thermos';
export type ErrandPhase = 'outbound' | 'pickup' | 'carrying' | 'dropoff' | 'returning';
export type ErrandVisual = { kind: ErrandKind; phase: ErrandPhase; progress: number };
export type ErrandStop = {
  name: string;
  plot: string;
  /** The road tile's centre the walk leaves from, and the handoff spot on its north kerb. */
  road: Point;
  point: Point;
  facing: ResidentState['facing'];
};
export type SeasonalRitual = {
  kind: ErrandKind;
  seasonIndex: number;
  name: string;
  description: string;
  pickup: ErrandStop;
  delivery: ErrandStop;
};
export type ErrandWalk = {
  phase: 'outbound' | 'carrying' | 'returning';
  start: number;
  end: number;
  route: Point[];
};
export type ErrandPause = {
  phase: 'pickup' | 'dropoff';
  start: number;
  end: number;
  position: Point;
  facing: ResidentState['facing'];
};
export type ErrandSegment = ErrandWalk | ErrandPause;
export type ErrandTrip = {
  key: string;
  residentId: string;
  day: number;
  ritual: SeasonalRitual;
  depart: number;
  homeBy: number;
  segments: readonly ErrandSegment[];
};
/** All departures and returns stay in daylight, with time to pause at home on either side. */
export const ERRAND_HOURS = { from: 480, until: 1140 } as const;
export const ERRAND_PAUSE = 12;
export const ERRAND_MARGIN = 12;
/** Even a far neighbor's complete round takes at most five real minutes. */
export const ERRAND_MAX_MINUTES = 300;
/** Turning happens before lifting, and after lowering, rather than during either handoff. */
export const ERRAND_TURN = 0.4;

const KERB = 0.45;
/** `shift` moves the spot along the kerb, for a stop that must stand off its road's centre. */
const stop = (
  name: string,
  plot: string,
  road = plotEntrance(getPlot(plot)!),
  shift = 0,
): ErrandStop => ({
  name,
  plot,
  road,
  point: { x: road.x + shift, y: road.y - KERB },
  facing: 'ne',
});
const GREEN = stop('The Lunch Green', 'C5');
const FORK = stop('The Lantern Fork', 'D3');
// The stage's own kerb is its front row: evening audiences stand and sit there until 20:00.
// The jug waits on the stage's east corner instead, half a tile in from the junction beside it,
// clear of both rows, their lanes and the junction's own walking lines.
const stageRoad = plotEntrance(getPlot('B5')!);
const STAGE = stop('The Little Stage', 'B5', { x: stageRoad.x + 2, y: stageRoad.y }, -0.5);
const halt = tubeStation('C1');
// The waiting basket has its own kerb spot beside the station; it never stands on a tube pad.
const DEPOT = stop('Hedgerow Halt', halt.plot, { x: halt.door.x + 1, y: halt.door.y });
const POND = stop('The Millpond south gate', 'I4', MILLPOND_GATE);

const RITUALS: readonly SeasonalRitual[] = [
  {
    kind: 'seedlings',
    seasonIndex: 0,
    name: 'Seedlings for the Fork',
    description: 'A tray of seedlings from the Lunch Green to the Lantern Fork.',
    pickup: GREEN,
    delivery: FORK,
  },
  {
    kind: 'lemonade',
    seasonIndex: 1,
    name: 'Lemonade for the stage',
    description: 'A jug of lemonade from the Lunch Green to the Little Stage.',
    pickup: GREEN,
    delivery: STAGE,
  },
  {
    kind: 'harvest',
    seasonIndex: 2,
    name: 'A basket for the green',
    description: 'A harvest basket waiting at Hedgerow Halt, carried to the Lunch Green.',
    pickup: DEPOT,
    delivery: GREEN,
  },
  {
    kind: 'thermos',
    seasonIndex: 3,
    name: 'Warm cups by the pond',
    description: 'A thermos from the Lunch Green to the Millpond south gate.',
    pickup: GREEN,
    delivery: POND,
  },
];

export const seasonalRitual = (day: number): SeasonalRitual =>
  RITUALS[townCalendarAt(day).seasonIndex];

type Commitment = { depart: number; homeBy: number };
/** Real free time only: consecutive stroll periods, minus every already-booked event journey. */
function freeWindows(home: Place, trips: readonly Commitment[]) {
  const windows: { start: number; end: number }[] = [];
  for (const run of strollRuns(home)) {
    let start = Math.max(run.start, ERRAND_HOURS.from);
    const end = Math.min(run.end, ERRAND_HOURS.until);
    for (const trip of trips) {
      if (trip.homeBy <= start || trip.depart >= end) continue;
      if (trip.depart > start) windows.push({ start, end: trip.depart });
      start = Math.max(start, trip.homeBy);
    }
    if (end > start) windows.push({ start, end });
  }
  return windows;
}

/** From the road's centre onto the kerb: along the road first if the spot is shifted. */
const toKerb = ({ road, point }: ErrandStop): Point[] =>
  point.x === road.x ? [point] : [{ x: point.x, y: road.y }, point];
const fromKerb = (stop: ErrandStop): Point[] => toKerb(stop).reverse();
/** A shifted spot lies between two road centres: never walk on to the far one and back. */
function straight(route: Point[]): Point[] {
  const out: Point[] = [];
  for (const point of route) {
    const [a, b] = out.slice(-2);
    const back = (p: number, q: number, r: number) => (q - p) * (r - q) < 0;
    if (
      b &&
      ((a.y === b.y && b.y === point.y && back(a.x, b.x, point.x)) ||
        (a.x === b.x && b.x === point.x && back(a.y, b.y, point.y)))
    )
      out.pop();
    out.push(point);
  }
  return out;
}
/** Three physical walks, with each handoff off the street's walking line. */
function routes(home: Place, ritual: SeasonalRitual): [Point[], Point[], Point[]] {
  const entrance = plotEntrance(getPlot(home.plot)!);
  const { pickup, delivery } = ritual;
  return [
    straight([...roadPath(entrance, pickup.road), ...toKerb(pickup)]),
    straight([...fromKerb(pickup), ...roadPath(pickup.road, delivery.road), ...toKerb(delivery)]),
    straight([...fromKerb(delivery), ...roadPath(delivery.road, entrance)]),
  ];
}

const days = new WeakMap<Place[], Map<number, ReadonlyMap<string, readonly ErrandTrip[]>>>();
/**
 * At most one published resident makes the day's round. Existing events are planned first and
 * never changed. A private house preview neither joins the draw nor changes anybody's round.
 */
export function residentErrands(
  places: Place[],
  day: number,
): ReadonlyMap<string, readonly ErrandTrip[]> {
  const roster = publishedRoster(places);
  const cached = days.get(roster)?.get(day);
  if (cached) return cached;
  const ritual = seasonalRitual(day);
  const outings = residentTrips(roster, day);
  const result = new Map<string, readonly ErrandTrip[]>();
  const candidates = roster
    .filter((home) => getPlot(home.plot))
    .map((home) => ({ home, rank: hash(`errand:${day}:${ritual.kind}:${home.id}`) }))
    .sort(
      (a, b) => a.rank - b.rank || (a.home.id < b.home.id ? -1 : a.home.id > b.home.id ? 1 : 0),
    );
  for (const { home } of candidates) {
    const free = freeWindows(home, outings.get(home.id) ?? []);
    if (!free.length) continue;
    const walks = routes(home, ritual);
    const minutes = walks.map((route) => routeLength(route) / WALK_SPEED);
    const duration = minutes.reduce((sum, n) => sum + n, 0) + 2 * ERRAND_PAUSE;
    if (duration > ERRAND_MAX_MINUTES) continue;
    const fitting = free.filter(({ start, end }) => end - start >= duration + 2 * ERRAND_MARGIN);
    if (!fitting.length) continue;
    const key = `errand:${day}:${ritual.kind}:${home.id}`;
    const window = fitting[hash(`${key}:window`) % fitting.length];
    const spare = Math.floor(window.end - window.start - duration - 2 * ERRAND_MARGIN);
    const depart = window.start + ERRAND_MARGIN + (hash(`${key}:depart`) % (spare + 1));
    let at = depart;
    const walking = (phase: ErrandWalk['phase'], index: number): ErrandWalk => {
      const start = at;
      at += minutes[index];
      return { phase, start, end: at, route: walks[index] };
    };
    const pausing = (phase: ErrandPause['phase'], stop: ErrandStop): ErrandPause => {
      const start = at;
      at += ERRAND_PAUSE;
      return { phase, start, end: at, position: stop.point, facing: stop.facing };
    };
    const segments = [
      walking('outbound', 0),
      pausing('pickup', ritual.pickup),
      walking('carrying', 1),
      pausing('dropoff', ritual.delivery),
      walking('returning', 2),
    ];
    result.set(home.id, [{ key, residentId: home.id, day, ritual, depart, homeBy: at, segments }]);
    break;
  }
  let cache = days.get(roster);
  if (!cache) days.set(roster, (cache = new Map()));
  if (cache.size >= 3) cache.delete(cache.keys().next().value!);
  cache.set(day, result);
  return result;
}

export const errandLaneKey = (trip: ErrandTrip, segment: ErrandWalk): string =>
  `${trip.key}:${segment.phase}`;
/** Only walking pieces need lanes; the two pauses remain at their physical handoff points. */
export const errandWalkPieces = (trip: ErrandTrip): { key: string; piece: LanePiece }[] =>
  trip.segments.flatMap((segment) =>
    'route' in segment
      ? [
          {
            key: errandLaneKey(trip, segment),
            piece: {
              route: segment.route,
              start: segment.start,
              minutes: segment.end - segment.start,
            },
          },
        ]
      : [],
  );

type LaneLookup = (key: string) => LanePath | undefined;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** Pause edges keep the arrival/departure facing, with a quarter turn between opposite facings. */
function pauseFacing(trip: ErrandTrip, index: number, segment: ErrandPause, time: number) {
  const before = trip.segments[index - 1] as ErrandWalk;
  const after = trip.segments[index + 1] as ErrandWalk;
  const incoming = endFacing(before.route),
    outgoing = startFacing(after.route);
  if (time < segment.start + ERRAND_TURN) {
    if (time < segment.start + ERRAND_TURN / 2) return incoming;
    return opposite(incoming, segment.facing) ? sideways(incoming) : segment.facing;
  }
  if (time >= segment.end - ERRAND_TURN) {
    if (time >= segment.end - ERRAND_TURN / 2) return outgoing;
    return opposite(segment.facing, outgoing) ? sideways(segment.facing) : segment.facing;
  }
  return segment.facing;
}

/** The round at a minute, including exact endpoints for previews; no elapsed-time state. */
export function errandState(
  trip: ErrandTrip,
  time: number,
  lanes: LaneLookup = () => undefined,
): Partial<ResidentState> {
  const index = trip.segments.findIndex((segment) => time < segment.end);
  const segmentIndex = index < 0 ? trip.segments.length - 1 : index;
  const segment = trip.segments[segmentIndex];
  const progress = clamp((time - segment.start) / (segment.end - segment.start));
  const visual: ErrandVisual = { kind: trip.ritual.kind, phase: segment.phase, progress };
  if ('route' in segment) {
    const lane = lanes(errandLaneKey(trip, segment)) ?? laneSide(trip.residentId);
    return {
      ...walkAlong(segment.route, progress, laneAt(lane, time)),
      activity: 'stroll',
      errand: visual,
    };
  }
  return {
    position: segment.position,
    moving: false,
    facing: pauseFacing(trip, segmentIndex, segment, time),
    walkPhase: 0,
    activity: 'stroll',
    errand: {
      ...visual,
      progress: clamp(
        (time - segment.start - ERRAND_TURN) / (segment.end - segment.start - 2 * ERRAND_TURN),
      ),
    },
  };
}
