import type { Place } from './schema';
import type { ResidentState } from './simulation';
import { getPlot, hash, plotEntrance, type Point } from './world';
import {
  EVENT_SPOTS,
  eventSpot,
  eventsForDay,
  HOUSE_PLOTS,
  isDistrictVenue,
  type EventPose,
  type TownEvent,
  type Venue,
} from './events';
import { cinemaGuests, CINEMA_ENTRANCE } from './cinema';
import { FOOTBALL_ENTRANCE, FOOTBALL_VENUE, spectatorSpot, footballAt } from './football';
import { zooRoute } from './zoo';
import {
  districtApproach,
  DISTRICT_OUTINGS,
  MARKET_VENUE,
  outingSpots,
  type DistrictVenue,
} from './district-places';
import {
  activeIndex,
  OUTING_TABLE,
  OUTING_TIMES,
  REGATTA_LAUNCH_EVERY,
  type OutingId,
} from './district-calendar';
import {
  outingOf,
  SEAT_EXCLUDES,
  snowmenBuilderFacing,
  snowmenBuilderPose,
  snowmenWatcherPose,
  type PoseContext,
  type SeatCall,
  type SnowmenContext,
} from './outings';
import { MILLPOND_VENUE, SKATING, millpondRoute, millpondSkatingDay, skateGlide } from './millpond';
import {
  facingAlong,
  opposite,
  planJourney,
  roadPath,
  routeLength,
  sideways,
  WALK_SPEED,
  MIN_VISIT_MINUTES,
  WORTH_THE_WALK,
  type TravelPlan,
} from './walking';
import { nightBedtime } from './night-routine';
import { TUBE_DOOR_HEADWAY, tubeMinSaving } from './tubes';
import {
  laneAt,
  laneWalk,
  planLaneWalks,
  type LanePath,
  type LanePiece,
  type LaneWalk,
} from './lanes';
import {
  fixedMinutes,
  joinApproach,
  journeyAt,
  laneSide,
  legsMinutes,
  legsRoute,
  paceLegs,
  reverseLegs,
  tubeChoice,
  tubeLegs,
  walkAlong,
  walkedTiles,
  type TripLeg,
} from './tube-journeys';

export type VisitEvent = Omit<TownEvent, 'venue' | 'period'> & {
  venue: Venue | DistrictVenue | typeof FOOTBALL_VENUE | typeof MILLPOND_VENUE;
  period: 'morning' | 'afternoon' | 'evening' | 'night';
};
export type ResidentTrip = TravelPlan & {
  // Chained visits end at the next departure; their homeBy is the handoff time.
  continuesTo?: string;
  returnRoute: Point[];
  returnDuration: number;
  event: VisitEvent;
  seat: number;
  facing: ResidentState['facing'];
  availableFrom: number;
  availableUntil: number;
  /** Timed legs of the way there, only when it rides the tube; walking trips have no key. */
  legs?: TripLeg[];
  /** Timed legs of the way home, only when it rides the tube. */
  returnLegs?: TripLeg[];
  /** The walking pace of the plan (its speed multiplier, 1 to 1.4); 1 on the film's hop. */
  pace: number;
  /**
   * How the day's headways moved the trip, when it was planned with a book: minutes the arrival
   * came earlier (0 to HEADWAY_SHIFT_MAX), minutes the leave went later (below 0 when it was cut
   * earlier instead), and the minute the leave may never pass.
   */
  headway?: { arriveShift: number; leaveShift: number; leaveCap: number };
};
const periods = ['morning', 'afternoon', 'evening', 'night'] as const;
type Period = (typeof periods)[number];
/** An event a resident is invited to, with their seat and the routine period it belongs to. */
export type Candidate = { event: VisitEvent; seat: number; period: Period };
const boundaries = [360, 720, 1080, 1320, 1800];
const plans = new WeakMap<Place[], Map<number, Map<string, ResidentTrip[]>>>();

/** The run of stroll periods around `period` (merged with its neighbours), to bedtime at night. */
function availableWindow(home: Place, period: Period) {
  let first = periods.indexOf(period),
    last = first;
  while (first > 0 && home.resident.routine[periods[first - 1]] === 'stroll') first--;
  while (last < 3 && home.resident.routine[periods[last + 1]] === 'stroll') last++;
  return {
    availableFrom: boundaries[first],
    availableUntil: Math.min(
      boundaries[last + 1],
      home.resident.routine.night === 'stroll' ? nightBedtime(home) : 1800,
    ),
  };
}

/**
 * A neighbor's day as runs of consecutive stroll periods, in plan-day minutes: exactly the
 * windows their outings are planned in (nobody has to be home at 12:00 or 18:00 unless their
 * routine changes), a night out ending at bedtime.
 */
export function strollRuns(home: Place): { start: number; end: number }[] {
  const runs: { start: number; end: number }[] = [];
  for (const period of periods)
    if (home.resident.routine[period] === 'stroll') {
      const { availableFrom: start, availableUntil: end } = availableWindow(home, period);
      if (runs.at(-1)?.start !== start) runs.push({ start, end });
    }
  return runs;
}

function venueApproach(venue: Venue, seat: number): Point[] {
  const audience = eventSpot(venue, seat).position;
  const entrance = venue.kind === 'cinema' ? CINEMA_ENTRANCE : plotEntrance(getPlot(venue.plot)!);
  const laneX =
    venue.kind === 'cinema' ? 28.5 : venue.kind === 'green' ? entrance.x - 1.35 : audience.x;
  return [entrance, { x: laneX, y: entrance.y }, { x: laneX, y: audience.y }, audience];
}

/** The Riverside outing whose spots and ways in a visit uses: its own, else its venue's first. */
const districtOuting = (event: Pick<VisitEvent, 'outing'>, venue: DistrictVenue) =>
  event.outing ?? DISTRICT_OUTINGS[venue.kind][0];

/** The venue's own way in, from the road point where the approach starts to the seat. */
export function eventApproach(event: Pick<VisitEvent, 'venue' | 'outing'>, seat: number): Point[] {
  // The Riverside's venues have their own frozen ways in (an outing's seat k, district-places).
  if (isDistrictVenue(event.venue))
    return districtApproach(districtOuting(event, event.venue), seat);
  if (event.venue.kind === 'football') {
    const spot = spectatorSpot(seat);
    return [FOOTBALL_ENTRANCE, { x: spot.x, y: FOOTBALL_ENTRANCE.y }, spot];
  }
  if (event.venue.kind === 'zoo') return zooRoute(eventSpot(event.venue, seat).position);
  if (event.venue.kind === 'millpond') return millpondRoute(seat);
  return venueApproach(event.venue, seat);
}

/**
 * Walking the whole way: road from the doorstep, then the venue's own approach, joined like a tube
 * leg's so nobody walks past the gate or the lane and back.
 */
export function eventRoute(
  home: Place,
  event: Pick<VisitEvent, 'venue' | 'outing'>,
  seat: number,
): Point[] {
  const doorstep = plotEntrance(getPlot(home.plot)!);
  const approach = eventApproach(event, seat);
  return joinApproach(roadPath(doorstep, approach[0]), approach);
}

/** The unhurried tube journey to the event, or undefined when walking is as good. */
export function eventTubeJourney(
  home: Place,
  event: Pick<VisitEvent, 'venue' | 'outing'>,
  seat: number,
) {
  const doorstep = plotEntrance(getPlot(home.plot)!);
  const approach = eventApproach(event, seat);
  const choice = tubeChoice(doorstep, approach[0]);
  if (!choice) return undefined;
  const legs = tubeLegs(choice, approach);
  // The walk turns in at the gate as well: ride only while that still saves the pair's minutes.
  const walk = routeLength(eventRoute(home, event, seat)) / WALK_SPEED;
  if (walk - legsMinutes(legs) < tubeMinSaving(choice.from, choice.to)) return undefined;
  return { route: legsRoute(legs), legs };
}

// ---- Turn tickets ------------------------------------------------------------------------------

/** Each kind's house-plot ranks for one block of active days (a few blocks kept). */
const blockRanks = new Map<string, ReadonlyMap<string, number>>();
function ranksOf(kind: string, block: number): ReadonlyMap<string, number> {
  const key = `${kind}:${block}`;
  let ranks = blockRanks.get(key);
  if (!ranks) {
    ranks = new Map(
      HOUSE_PLOTS.map((plot) => ({ id: plot.id, draw: hash(`turn:${kind}:${block}:${plot.id}`) }))
        // Plot ids break a tie by code unit, never by the browser's language.
        .sort((a, b) => a.draw - b.draw || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(({ id }, rank) => [id, rank] as const),
    );
    if (blockRanks.size >= 32) blockRanks.delete(blockRanks.keys().next().value!);
    blockRanks.set(key, ranks);
  }
  return ranks;
}

/**
 * Turn tickets, fair turns that stay put when the town grows: the active days of `kind` run in
 * blocks of ⌈house plots / cap⌉, and every house plot holds the ticket on exactly one day of each
 * block, at most `cap` plots a day, whoever lives in town. The plot's rank in today's block when
 * it holds today's ticket, otherwise undefined.
 */
export function ticketRank(
  kind: string,
  cap: number,
  day: number,
  plot: string,
): number | undefined {
  const plots = HOUSE_PLOTS.length,
    perBlock = Math.ceil(plots / cap);
  const index = activeIndex(kind, day),
    block = Math.floor(index / perBlock);
  const rank = ranksOf(kind, block).get(plot);
  return rank !== undefined && Math.floor((rank * perBlock) / plots) === index - block * perBlock
    ? rank
    : undefined;
}

// ---- Door and gate headways ----------------------------------------------------------------------

/** Minutes two guests keep apart passing the same venue gate, the first point of their approach. */
export const VENUE_GATE_HEADWAY = 2;
/** Minutes an arrival may move earlier, or a leave later, to keep the headways. */
export const HEADWAY_SHIFT_MAX = 6;
/** Half-minute steps tried before a plan that still clashes passes its seat on. */
export const HEADWAY_STEPS = 200;
type VenueKind = VisitEvent['venue']['kind'];
/** Venues nobody leaves after a set minute, however the headways fall: the ice closes at 16:40. */
export const HARD_END: Partial<Record<VenueKind, number>> = { millpond: SKATING.end };

/** A door or gate passed at minute `t` by a home's neighbor; `late` for a previewed draft's. */
export type HeadwayMark = { t: number; home: string; late: boolean };
/**
 * One day's marks so far, by door (`door:${station}`) or gate (`gate:${venue}:${x},${y}`), and the
 * previewed drafts, whose marks the town never makes way for. Each `planResidentTrips` call keeps
 * its own; it is never module state.
 */
export type HeadwayBook = { marks: Map<string, HeadwayMark[]>; late: ReadonlySet<string> };
type Mark = { key: string; t: number };

/** The minute a rider reaches each boarding door and leaves each stepping-off door. */
function doorMarks(legs: readonly TripLeg[], start: number): Mark[] {
  const marks: Mark[] = [];
  let at = start;
  for (const leg of legs) {
    if (leg.kind === 'board') marks.push({ key: `door:${leg.from}`, t: at });
    at += leg.minutes;
    if (leg.kind === 'alight') marks.push({ key: `door:${leg.to}`, t: at });
  }
  return marks;
}
/** A seat's gate: its approach's first point, and the tiles from there to the spot. */
function gateOf(event: Pick<VisitEvent, 'venue'>, seat: number) {
  const approach = eventApproach(event, seat);
  const [{ x, y }] = approach;
  return { key: `gate:${event.venue.id}:${x},${y}`, tiles: routeLength(approach) };
}
/**
 * A trip's marks: its doors, and the minute it passes its gate (going in, and coming out unless
 * it continues to the next outing), at the trip's own pace.
 */
function tripMarks(trip: ResidentTrip): Mark[] {
  const gate = gateOf(trip.event, trip.seat);
  const minutes = gate.tiles / (WALK_SPEED * trip.pace);
  return [
    ...(trip.legs ? doorMarks(trip.legs, trip.depart) : []),
    { key: gate.key, t: trip.arrive - minutes },
    ...(trip.continuesTo
      ? []
      : [
          ...(trip.returnLegs ? doorMarks(trip.returnLegs, trip.leave) : []),
          { key: gate.key, t: trip.leave + minutes },
        ]),
  ];
}
/** Replace a home's marks in the book with those of its new day. */
function bookTrips(book: HeadwayBook, home: string, trips: readonly ResidentTrip[]) {
  for (const [key, marks] of book.marks)
    if (marks.some((mark) => mark.home === home))
      book.marks.set(
        key,
        marks.filter((mark) => mark.home !== home),
      );
  const late = book.late.has(home);
  for (const trip of trips)
    for (const { key, t } of tripMarks(trip)) {
      const marks = book.marks.get(key);
      if (marks) marks.push({ t, home, late });
      else book.marks.set(key, [{ t, home, late }]);
    }
}
/** Whether any mark comes within the headway of another home's on the same door or gate. */
function clashes(book: HeadwayBook, home: string, marks: readonly Mark[]) {
  // A previewed draft makes way for everyone; the town never makes way for a draft.
  const draft = book.late.has(home);
  return marks.some(({ key, t }) => {
    const headway = key.startsWith('gate:') ? VENUE_GATE_HEADWAY : TUBE_DOOR_HEADWAY;
    return (book.marks.get(key) ?? []).some(
      (mark) => mark.home !== home && (draft || !mark.late) && Math.abs(mark.t - t) < headway,
    );
  });
}

/** Derive a full day's commitments together so early departures and return walks survive period changes. */
export function residentTrips(places: Place[], day: number): Map<string, ResidentTrip[]> {
  const cached = plans.get(places)?.get(day);
  if (cached) return cached;
  const result = planResidentTrips(places, day);
  // Each trip knows its day, so the walkers sharing a street can be given lanes of their own.
  const lanesDay: LanesDay = { plan: result, newcomers: previewNewcomers(places) };
  for (const trips of result.values()) for (const trip of trips) daysOf.set(trip, lanesDay);
  let byDay = plans.get(places);
  if (!byDay) {
    byDay = new Map();
    plans.set(places, byDay);
  }
  // Drop the oldest day: tomorrow's plan, prefetched before 06:00, must not evict today's.
  if (byDay.size >= 3) byDay.delete(byDay.keys().next().value!);
  byDay.set(day, result);
  return result;
}

/** Football uses the same physical travel rules, with a morning or afternoon visit. */
export function footballVisit(period: 'morning' | 'afternoon'): VisitEvent {
  const start = period === 'morning' ? 360 : 720;
  return {
    id: 'football',
    name: 'The Meadow Ground',
    description: 'Watching the football',
    venue: FOOTBALL_VENUE,
    period,
    depart: start,
    start: start + 70,
    end: start + 285,
    homeBy: start + 350,
  };
}

/** Skating on the frozen Millpond, as the planner seats it. */
export const skatingVisit: VisitEvent = {
  id: 'millpond',
  name: 'Skating on the Millpond',
  description: 'Skating on the frozen millpond',
  venue: MILLPOND_VENUE,
  period: 'afternoon',
  ...SKATING,
  // Whoever leaves last (stagger 5 × 1.3) is still off the ice by the posted 16:40.
  end: SKATING.end - 6.5,
};

const previews = new WeakMap<Place[], { roster: Place[]; newcomers: Place[] }>();

/**
 * The town with a builder's draft house in it, for "Preview in town". Everyone already in town is
 * planned exactly as without the draft, and the draft's neighbor only takes a seat they leave
 * free, so a preview never moves anyone else.
 */
export function withPreview(places: Place[], draft: Place): Place[] {
  const town = [...places, draft];
  previews.set(town, { roster: places, newcomers: [draft] });
  return town;
}
/** The ids of a previewed draft's neighbors in `places` (none outside a preview). */
export const previewNewcomers = (places: Place[]): ReadonlySet<string> =>
  new Set((previews.get(places)?.newcomers ?? []).map((home) => home.id));

/** Published neighbors only: town-owned rounds never select a builder's private preview. */
export const publishedRoster = (places: Place[]): Place[] => previews.get(places)?.roster ?? places;

/** How a day is planned; every option defaults to the town as it is. */
export type PlanOptions = {
  /** false: the same guests in the same seats, nobody rides, and no headways (each home alone). */
  tube?: boolean;
  /** false: none of the Riverside's outings (for tests: the town without them). */
  outings?: boolean;
  /** false: the Riverside's daily outings only, none of the four festivals (for tests). */
  festivals?: boolean;
};
/** Minutes before its launch that the boatwright picks a regatta guest's boat up. */
export const REGATTA_HANDOVER = 1;
/** The Riverside's outings that run on some days only: each seats first in its period. */
const FESTIVALS: ReadonlySet<OutingId> = new Set([
  'regatta',
  'harvest-fair',
  'long-table',
  'stargazing',
]);

// ---- The market's own hours ---------------------------------------------------------------------

/** Minutes between the market's thirteen browsing slots, 08:00 to 10:00. */
const MARKET_SLOT = 10;
const MARKET_SLOTS = 13;
const marketWindows = new Map<string, { start: number; end: number }>();
/**
 * A browser's own hour at the market: a slot from 08:00 to 10:00 every ten minutes, and a stay of
 * 60 to 90 minutes (never past 11:30), both from the home's id. The home keeps its own slot when
 * its seat-0 trip (on foot or by tube, worth the walk, in its morning window) can make it, else
 * takes one of the slots it can make, else the whole market (08:00–11:30).
 */
export function marketWindow(home: Place): { start: number; end: number } {
  const { routine } = home.resident;
  const key = `${home.id}|${home.plot}|${routine.morning}|${routine.afternoon}|${routine.evening}|${routine.night}`;
  const cached = marketWindows.get(key);
  if (cached) return cached;
  const { depart, start, end } = OUTING_TIMES.market;
  const market = { venue: MARKET_VENUE, outing: 'market' as const };
  const tube = eventTubeJourney(home, market, 0);
  const walkTiles = tube ? walkedTiles(tube.legs) : routeLength(eventRoute(home, market, 0));
  const fixed = tube ? fixedMinutes(tube.legs) : 0;
  const window = availableWindow(home, 'morning');
  const stay = 60 + (hash(`market-stay:${home.id}`) % 31);
  const at = (from: number) => ({ start: from, end: Math.min(end, from + stay) });
  const fits = (from: number) =>
    !!planJourney(
      walkTiles,
      fixed,
      from,
      at(from).end,
      window.availableFrom,
      window.availableUntil,
      depart,
      0,
      WORTH_THE_WALK,
    );
  const slots = Array.from({ length: MARKET_SLOTS }, (_, j) => start + MARKET_SLOT * j);
  const draw = hash(`market-browse:${home.id}`);
  const own = slots[draw % MARKET_SLOTS];
  const feasible = slots.filter(fits);
  const result = fits(own)
    ? at(own)
    : feasible.length
      ? at(feasible[draw % feasible.length])
      : { start, end };
  // A town's worth of homes, and a few drafts: start over rather than grow without end.
  if (marketWindows.size >= 4096) marketWindows.clear();
  marketWindows.set(key, result);
  return result;
}

/**
 * The day's plan, uncached. Guests are drawn in a daily hash order, and a seat goes to the next
 * neighbor in line whenever someone ahead can't make it (too far to get there, on foot or by tube,
 * and home in time, or an earlier outing runs late), so a seat is only given out when it will be
 * filled. A far neighbor who can only make it by tube keeps their turn, so the tube changes who
 * gets a seat as well as how they travel.
 *
 * Within the day, no two riders reach or leave the same tube door, and no two guests pass the
 * same venue gate, within two minutes of each other (the headways): a trip that would moves a
 * little (an arrival up to six minutes earlier, a leave up to six later, else the other way),
 * and passes its seat on if it still can't keep them. A previewed draft makes way for the town,
 * never the other way round.
 *
 * With `tube: false` the same guests are seated but nobody rides, each home's day planned on its
 * own (no headways). That is not the town without the tube, whose lines would pass a rider's seat
 * on. It never holds an outing the tube plan lacks, because a guest is only seated when the tube
 * plan keeps every one of their outings.
 *
 * The calls go in the order of SEAT_ORDER (outings.ts): the film; the morning football; each
 * period's festival first (the regatta and the Harvest Fair in the afternoon, the Long Table in
 * the evening, stargazing at night); today's daily outings on their own hash lines; the
 * Riverside's daily outings last of all, so on a day without a festival they never change who
 * goes to anything else. Every Riverside outing and the disco seat on turn tickets.
 * `outings: false` plans the town without any Riverside outing, `festivals: false` without the
 * four festivals (for tests).
 */
export function planResidentTrips(
  places: Place[],
  day: number,
  options: PlanOptions = {},
): Map<string, ResidentTrip[]> {
  const program = eventsForDay(day);
  // A previewed draft joins every line behind the whole town.
  const { roster, newcomers } = previews.get(places) ?? { roster: places, newcomers: [] };
  // Each home's invitations so far, and the day they make.
  const days = new Map<string, { list: Candidate[]; trips: ResidentTrip[] }>();
  const empty = { list: [], trips: [] };
  // This plan's doors and gates, passed to every home it plans and to nothing else.
  const book: HeadwayBook = { marks: new Map(), late: new Set(newcomers.map((home) => home.id)) };
  const invite = (home: Place, candidate: Candidate) => {
    const before = days.get(home.id) ?? empty;
    const list = [...before.list, candidate].sort((a, b) => a.event.start - b.event.start);
    const trips = planHome(home, list, tubeJourneys(home, list), book);
    // A visit that costs an outing already planned would leave that seat empty. That rule alone
    // keeps every trip the walking-only plan makes: all of them are among the outings.
    if (trips.length < list.length) return false;
    days.set(home.id, { list, trips });
    bookTrips(book, home.id, trips);
    return true;
  };
  const sorted = (period: Period, key: string, excluded: readonly string[] = []) =>
    [roster, newcomers].map((homes) =>
      homes
        .filter(
          (home) =>
            home.resident.routine[period] === 'stroll' &&
            !excluded.includes(home.id) &&
            getPlot(home.plot),
        )
        .map((home) => ({ home, draw: hash(`${key}:${home.id}`) }))
        // Ids break a tie by code unit, never by the browser's language.
        .sort(
          (a, b) => a.draw - b.draw || (a.home.id < b.home.id ? -1 : a.home.id > b.home.id ? 1 : 0),
        )
        .map(({ home }) => home),
    );
  /**
   * A line on turn tickets: today's ticket holders among the town's homes first, in rank order,
   * then everyone else on the hash line. A previewed draft never holds a ticket.
   */
  const ticketed = (
    kind: string,
    cap: number,
    period: Period,
    key: string,
    excluded: readonly string[] = [],
  ) => {
    const [line, late] = sorted(period, key, excluded);
    const ranks = new Map(line.map((home) => [home, ticketRank(kind, cap, day, home.plot)]));
    const holders = line
      .filter((home) => ranks.get(home) !== undefined)
      .sort((a, b) => ranks.get(a)! - ranks.get(b)! || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return [[...holders, ...line.filter((home) => ranks.get(home) === undefined)], late];
  };
  /**
   * Seat guests in line order until the seats are full or nobody else can make it. `seats` counts
   * the spots for a line of that many; newcomers get only the spots the town's line leaves. With
   * `personal`, each guest goes to their own version of the event (the market's own hour, the
   * regatta's launch for that seat).
   */
  const seat = (
    event: VisitEvent,
    [line, late]: Place[][],
    seats: (entrants: number) => number,
    personal?: (home: Place, seat: number) => VisitEvent,
  ) => {
    const guests: string[] = [];
    for (const [homes, spots] of [
      [line, seats(line.length)],
      [late, seats(line.length + late.length)],
    ] as const)
      for (const home of homes) {
        if (guests.length >= spots) break;
        const own = personal ? personal(home, guests.length) : event;
        if (invite(home, { event: own, seat: guests.length, period: event.period }))
          guests.push(home.id);
      }
    return guests;
  };
  const all = (spots: number) => () => spots;
  const half = (spots: number) => (entrants: number) => Math.min(spots, Math.ceil(entrants / 2));
  // Each call's guests so far, so a later call can leave them out (SEAT_EXCLUDES).
  const seated = new Map<SeatCall, readonly string[]>();
  const excluded = (call: SeatCall) => SEAT_EXCLUDES[call].flatMap((id) => seated.get(id) ?? []);
  const daily = options.outings !== false,
    festive = daily && options.festivals !== false;
  /** A Riverside outing's call, on its own days: its ticket line, seats and personal times. */
  const outing = (id: OutingId) => {
    const event = program.find((candidate) => candidate.outing === id);
    const spec = outingOf(id)!;
    if (!event || !(FESTIVALS.has(id) ? festive : daily)) return;
    const { cap, newcomerKey } = OUTING_TABLE[id];
    seated.set(
      id,
      seat(
        event,
        ticketed(id, cap, spec.period, newcomerKey(day), excluded(id)),
        (spec.seats.rule === 'all' ? all : half)(spec.seats.spots),
        id === 'market'
          ? (home) => ({ ...event, ...marketWindow(home) })
          : id === 'regatta'
            ? // A launch every six minutes: seat k's boat goes in at 14:00 + 6k.
              (_, k) => ({ ...event, start: event.start + REGATTA_LAUNCH_EVERY * k })
            : undefined,
      ),
    );
  };
  // Cinema guests keep their seats whatever happens; their evening is planned around the film.
  const cinema = program.find((e) => e.id === 'cinema')!;
  const movieGuests = cinemaGuests(roster, day);
  // A newcomer sees the film only from a seat the town's own guests leave free.
  const filmSeats = cinemaGuests(places, day).length;
  for (const { id, resident } of newcomers)
    if (
      movieGuests.length < filmSeats &&
      resident.routine.evening === 'stroll' &&
      resident.routine.night === 'stroll'
    )
      movieGuests.push(id);
  movieGuests.forEach((id, seat) => {
    const home = places.find((place) => place.id === id);
    if (home && getPlot(home.plot)) invite(home, { event: cinema, seat, period: 'evening' });
  });
  seated.set('cinema', movieGuests);
  // The rest in the seat order, so an outing is planned around the ones before it.
  seated.set(
    'football-morning',
    seat(
      footballVisit('morning'),
      sorted('morning', `fans:${day}:morning`, excluded('football-morning')),
      half(6),
    ),
  );
  // A festival comes first in its afternoon: rare days are the point.
  outing('regatta');
  outing('harvest-fair');
  const picnic = program[0];
  seated.set(
    'green',
    seat(
      picnic,
      sorted('afternoon', `${day}:${picnic.id}`, excluded('green')),
      all(EVENT_SPOTS.green.length),
    ),
  );
  seated.set(
    'zoo',
    seat(
      program.find((e) => e.id === 'zoo')!,
      sorted('afternoon', `zoo:${day}`, excluded('zoo')),
      half(EVENT_SPOTS.zoo.length),
    ),
  );
  seated.set(
    'football-afternoon',
    seat(
      footballVisit('afternoon'),
      sorted('afternoon', `fans:${day}:afternoon`, excluded('football-afternoon')),
      half(6),
    ),
  );
  // Winter skating on the frozen Millpond, for afternoon strollers nobody else has claimed.
  if (millpondSkatingDay(day))
    seated.set(
      'millpond',
      seat(skatingVisit, sorted('afternoon', `skate:${day}`, excluded('millpond')), half(6)),
    );
  outing('long-table');
  const concert = program[1];
  seated.set(
    'concert',
    seat(
      concert,
      sorted('evening', `${day}:${concert.id}`, excluded('concert')),
      all(EVENT_SPOTS.stage.length),
    ),
  );
  // On a new-moon night the stars come first; their guests don't dance as well.
  outing('stargazing');
  // The disco takes turns: every home's ticket night comes round once a month or so.
  const party = program.find((e) => e.id === 'night-party')!;
  seated.set(
    'night-party',
    seat(
      party,
      ticketed(
        'night-party',
        EVENT_SPOTS.stage.length,
        'night',
        `${day}:${party.id}`,
        excluded('night-party'),
      ),
      all(EVENT_SPOTS.stage.length),
    ),
  );
  // The Riverside's daily outings last of all, on turn tickets.
  outing('market');
  outing('bandstand-tea');
  outing('bandstand-sundown');
  const result = new Map<string, ResidentTrip[]>();
  for (const home of places) {
    if (!getPlot(home.plot)) continue;
    const { list, trips } = days.get(home.id) ?? empty;
    result.set(home.id, options.tube === false ? planHome(home, list) : trips);
  }
  return result;
}

type TubeJourney = NonNullable<ReturnType<typeof eventTubeJourney>>;

/** Each outing's tube journey, or undefined where walking is as good. */
const tubeJourneys = (home: Place, list: readonly Candidate[]) =>
  new Map(list.map((c) => [c.event, eventTubeJourney(home, c.event, c.seat)]));

/**
 * One home's day: each candidate in start order, kept when it fits after the trip before and is
 * worth the walk. With `journeys`, a candidate that has a tube journey rides it; without, everyone
 * walks. With `book`, each trip keeps the headways to every other home's marks in it, or drops;
 * without one (the default), nothing is moved for anyone.
 */
export function planHome(
  home: Place,
  list: readonly Candidate[],
  journeys?: ReadonlyMap<VisitEvent, TubeJourney | undefined>,
  book?: HeadwayBook,
): ResidentTrip[] {
  const trips: ResidentTrip[] = [];
  for (const { event, seat, period } of list) {
    const window = availableWindow(home, period);
    const previous = trips.at(-1);
    const previousReturn = previous?.homeBy ?? window.availableFrom;
    // Unhurried tube legs when the ride saves time; walking trips never build any.
    const tube = journeys?.get(event);
    const route = tube ? tube.route : eventRoute(home, event, seat);
    const returnRoute = [...route].reverse();
    const partyVisit = event.id === 'night-party';
    const end = event.end - (partyVisit ? hash(`last-song:${home.id}`) % 61 : 0);
    // Cinema guests can walk straight from their seat to the stage after the closing card.
    if (partyVisit && event.venue.kind === 'stage' && previous?.event.venue.kind === 'cinema') {
      const exit = venueApproach(previous.event.venue, previous.seat);
      const approach = venueApproach(event.venue, seat);
      // Out along the aisle and on to the stage, joined at both ends so the hop never turns back.
      const onward = joinApproach(roadPath(exit[0], approach[0]), approach);
      const hop = joinApproach(onward.reverse(), exit).reverse();
      const duration = routeLength(hop) / WALK_SPEED;
      // The way home can ride the tube; the short hop from the cinema never does.
      const returnLegs = tube && reverseLegs(tube.legs);
      const returnDuration = returnLegs
        ? legsMinutes(returnLegs)
        : routeLength(returnRoute) / WALK_SPEED;
      const depart = previous.leave;
      const arrive = depart + duration;
      const leave = Math.min(end, window.availableUntil - returnDuration);
      const visit = leave - Math.max(event.start, arrive);
      // The hop books its doors and gate but never moves: the film's end sets it off.
      if (visit >= MIN_VISIT_MINUTES && duration <= WORTH_THE_WALK * visit) {
        previous.homeBy = depart;
        previous.continuesTo = event.id;
        trips.push({
          route: hop,
          duration,
          depart,
          arrive,
          leave,
          homeBy: leave + returnDuration,
          returnRoute,
          returnDuration,
          ...window,
          event,
          seat,
          facing: eventSpot(event.venue, seat).facing,
          ...(returnLegs ? { returnLegs } : {}),
          pace: 1,
        });
        continue;
      }
    }
    const walkTiles = tube ? walkedTiles(tube.legs) : routeLength(route);
    const fixed = tube ? fixedMinutes(tube.legs) : 0;
    // Night owls drift in through the party's first hour, but never so late that their bedtime
    // leaves less than fifteen minutes to dance and an unhurried walk home.
    const unhurried = walkTiles / WALK_SPEED + fixed;
    const lateness = Math.floor(
      window.availableUntil - unhurried - event.start - MIN_VISIT_MINUTES,
    );
    const arrival = partyVisit
      ? hash(`party-arrival:${home.id}`) % (Math.min(60, Math.max(0, lateness)) + 1)
      : 0;
    // Only the walking picks up the pace; boarding, riding and stepping off keep their minutes.
    let from = Math.max(window.availableFrom, previousReturn),
      until = window.availableUntil;
    const first = planJourney(
      walkTiles,
      fixed,
      event.start + arrival,
      end,
      from,
      until,
      event.depart,
      seat * 1.3,
      WORTH_THE_WALK,
    );
    if (!first) continue;
    let plan = first,
      headway: ResidentTrip['headway'];
    if (book) {
      // Keep two minutes from every other home's mark on the same door or gate. A clash on the
      // way there arrives half a minute earlier (at most six), else later; a clash on the way
      // home leaves half a minute later (at most six, never past the cap), else earlier. Only a
      // plan with no clash left is kept.
      const hardEnd = HARD_END[event.venue.kind];
      const leaveCap = hardEnd ?? end + seat * 1.3 + HEADWAY_SHIFT_MAX;
      const gate = gateOf(event, seat);
      const marks = (p: typeof first) => {
        const paced = tube && paceLegs(tube.legs, p.speedMultiplier);
        const minutes = gate.tiles / (WALK_SPEED * p.speedMultiplier);
        return {
          going: [
            ...(paced ? doorMarks(paced, p.depart) : []),
            { key: gate.key, t: p.arrive - minutes },
          ],
          home: [
            ...(paced ? doorMarks(reverseLegs(paced), p.leave) : []),
            { key: gate.key, t: p.leave + minutes },
          ],
        };
      };
      let arriveShift = 0,
        leaveShift = 0,
        later = hardEnd === undefined,
        clear = false;
      for (let step = 0, p: typeof first | undefined = first; p; step++) {
        const { going, home: back } = marks(p);
        const goingClash = clashes(book, home.id, going);
        if (!goingClash && !clashes(book, home.id, back)) {
          clear = true;
          plan = p;
          break;
        }
        if (step === HEADWAY_STEPS) break;
        if (goingClash) {
          if (arriveShift < HEADWAY_SHIFT_MAX && p.depart - 0.5 >= from) arriveShift += 0.5;
          else from = p.depart + 0.5;
        } else if (
          later &&
          leaveShift < HEADWAY_SHIFT_MAX &&
          p.leave + 0.5 <= leaveCap &&
          p.homeBy + 0.5 <= until
        )
          leaveShift += 0.5;
        else {
          until = p.homeBy - (later ? leaveShift : 0) - 0.5;
          later = false;
        }
        // Arrival and leave shifts are separate: moving the arrival never delays the leave.
        p = planJourney(
          walkTiles,
          fixed,
          event.start + arrival,
          end,
          from,
          until,
          event.depart,
          seat * 1.3 + arriveShift,
          WORTH_THE_WALK,
          seat * 1.3 + (later ? leaveShift : 0),
          leaveCap,
        );
      }
      if (!clear) continue;
      // A leave cut earlier records how far; one that only moved with a brisker walk records 0.
      headway = {
        arriveShift,
        leaveShift: later ? leaveShift : Math.min(0, plan.leave - first.leave),
        leaveCap,
      };
    }
    // A regatta guest sets their boat down before the boatwright comes for it, a minute before
    // its launch: one who would be later passes the seat on.
    if (event.outing === 'regatta' && plan.arrive > event.start - REGATTA_HANDOVER) continue;
    const legs = tube && paceLegs(tube.legs, plan.speedMultiplier);
    trips.push({
      route,
      duration: plan.duration,
      depart: plan.depart,
      arrive: plan.arrive,
      leave: plan.leave,
      homeBy: plan.homeBy,
      returnRoute,
      returnDuration: plan.duration,
      ...window,
      event,
      seat,
      facing: isDistrictVenue(event.venue)
        ? outingSpots(districtOuting(event, event.venue))[seat].facing
        : event.venue.kind === 'football' || event.venue.kind === 'millpond'
          ? 'ne'
          : eventSpot(event.venue, seat).facing,
      ...(legs ? { legs, returnLegs: reverseLegs(legs) } : {}),
      pace: plan.speedMultiplier,
      ...(headway ? { headway } : {}),
    });
  }
  return trips;
}

// ---- Lanes for walkers who share a street -------------------------------------------------

/** A trip's lanes on the way there and on the way home, -1..1 (laneAt reads them at a minute). */
export type TripLanes = { going: LanePath; returning: LanePath };
/**
 * Where tripState and chainTurn read a trip's lanes: tripLanes (the trips' own plan) unless the
 * caller has lanes planned with everyone else's walks too (the town's, in simulation.ts).
 */
export type TripLaneLookup = (trip: ResidentTrip, homeId: string) => TripLanes;
type LanesDay = {
  plan: Map<string, ResidentTrip[]>;
  /** A previewed draft's neighbor, who takes whatever lanes the town leaves. */
  newcomers: ReadonlySet<string>;
  lanes?: { byTrip: WeakMap<ResidentTrip, TripLanes>; walks: LaneWalk[] };
};
const daysOf = new WeakMap<ResidentTrip, LanesDay>();

/**
 * The lanes of one planned trip (planLaneWalks, over the whole day's trips): walkers who would
 * walk as one figure get lanes that draw them apart; everyone else keeps their own side. Trips
 * from outside `residentTrips` keep the resident's own side both ways.
 */
export function tripLanes(trip: ResidentTrip, homeId: string): TripLanes {
  const day = daysOf.get(trip);
  const lanes = day && (day.lanes ??= planLanes(day)).byTrip.get(trip);
  if (lanes) return lanes;
  const side = laneSide(homeId);
  return { going: side, returning: side };
}

/**
 * Every walk of the day's trips, sampled, with its lane: for planning the loops round the blocks
 * around them. Empty for trips from outside `residentTrips`.
 */
export function dayTripWalks(plan: ReadonlyMap<string, readonly ResidentTrip[]>): LaneWalk[] {
  for (const trips of plan.values())
    for (const trip of trips) {
      const day = daysOf.get(trip);
      return day ? (day.lanes ??= planLanes(day)).walks : [];
    }
  return [];
}

/** The walking pieces of a trip's way there or home: the whole route, or its walking legs. */
function walkPieces(trip: ResidentTrip, going: boolean): LanePiece[] {
  const legs = going ? trip.legs : trip.returnLegs;
  const start = going ? trip.depart : trip.leave;
  if (!legs)
    return [
      going
        ? { route: trip.route, start, minutes: trip.duration }
        : { route: trip.returnRoute, start, minutes: trip.returnDuration },
    ];
  const pieces: LanePiece[] = [];
  let at = start;
  for (const leg of legs) {
    if (leg.kind === 'walk') pieces.push({ route: leg.route, start: at, minutes: leg.minutes });
    at += leg.minutes;
  }
  return pieces;
}

function planLanes({ plan, newcomers }: LanesDay): NonNullable<LanesDay['lanes']> {
  const walks: LaneWalk[] = [];
  const trips: ResidentTrip[] = [];
  for (const [id, list] of plan)
    list.forEach((trip, n) => {
      for (const going of [true, false]) {
        walks.push(
          laneWalk(
            id,
            2 * n + Number(!going),
            newcomers.has(id),
            walkPieces(trip, going),
            going ? trip.depart : trip.leave,
            going ? trip.arrive : trip.homeBy,
          ),
        );
        trips.push(trip);
      }
    });
  planLaneWalks(walks);
  const byTrip = new WeakMap<ResidentTrip, TripLanes>();
  walks.forEach((walk, i) => {
    const found = byTrip.get(trips[i]) ?? { going: 0, returning: 0 };
    found[walk.order % 2 ? 'returning' : 'going'] = walk.path!;
    byTrip.set(trips[i], found);
  });
  return { byTrip, walks };
}

/** Spectators split by seat: even seats back Meadow FC, odd seats Sunset United. */
function supporterCheers(time: number, day: number, seat: number) {
  const game = footballAt(time, day);
  if (!game.goal) return false;
  return !game.celebration || game.celebration.team === seat % 2;
}

export function tripState(
  home: Place,
  trip: ResidentTrip,
  time: number,
  day: number,
  lanesOf: TripLaneLookup = tripLanes,
): Partial<ResidentState> {
  const {
    event,
    seat,
    route,
    duration,
    depart,
    arrive,
    leave,
    facing,
    returnRoute,
    returnDuration,
    legs,
    returnLegs,
  } = trip;
  // Skaters step onto the ice at their loop's south point and glide from that moment on. Zoo
  // visitors and football fans likewise join in on arrival: the animals and the match are already
  // there, and so are the Riverside's browsing outings (OutingSpec.underway). Anyone early for a
  // show waits at their spot until it starts.
  const spec = event.outing ? outingOf(event.outing) : undefined;
  const skating = event.venue.kind === 'millpond';
  const underway =
    skating ||
    event.venue.kind === 'zoo' ||
    event.venue.kind === 'football' ||
    spec?.underway === true;
  const phase =
    time < arrive
      ? 'going'
      : time < (underway ? arrive : event.start)
        ? 'waiting'
        : time < leave
          ? 'attending'
          : 'returning';
  if (skating && phase === 'attending')
    return {
      ...skateGlide(seat, arrive, leave, time),
      moving: false,
      activity: 'stroll',
      pose: 'skate',
      event: { id: event.id, name: event.name, phase },
    };
  // Each walker keeps to a lane, apart from anyone walking with them, so they stay two.
  const lanes = phase === 'going' || phase === 'returning' ? lanesOf(trip, home.id) : undefined;
  const zoo =
    event.venue.kind === 'zoo' && phase === 'attending' && zooGlance(home.id, arrive, time, leave);
  // Where a Riverside guest looks while it is on (the market's stalls), and where a snowman's
  // builders look while they build (its own side of the lunch), else their spot's way.
  const looking =
    phase !== 'attending'
      ? undefined
      : spec?.facing
        ? spec.facing({ home, trip, time, day, seat, arrive, leave })
        : event.variant === 'snowmen'
          ? snowmenBuilderFacing(seat, time, day)
          : undefined;
  const movement =
    phase === 'going'
      ? legs
        ? journeyAt(legs, depart, time, laneAt(lanes!.going, time))
        : walkAlong(route, (time - depart) / duration, laneAt(lanes!.going, time))
      : phase === 'returning'
        ? returnLegs
          ? journeyAt(returnLegs, leave, time, laneAt(lanes!.returning, time))
          : walkAlong(returnRoute, (time - leave) / returnDuration, laneAt(lanes!.returning, time))
        : {
            position: route.at(-1)!,
            moving: false,
            facing: zoo ? zoo.facing : (looking ?? facing),
            walkPhase: 0,
          };
  // A blanket, a cinema seat or a deckchair is for sitting on while the show gets ready; the lawn
  // stands.
  const seatedVenue =
    event.venue.kind === 'green' || event.venue.kind === 'cinema' || spec?.seated === true;
  // With under a minute to wait once settled, a guest takes up straight away what they will do
  // when it starts (sat down, or on their feet to play) instead of sitting for a moment first.
  const briefWait =
    seatedVenue && arrive < event.start && event.start - (arrive + SEAT_SETTLE) < POSE_HOLD;
  const starting = briefWait ? attendingPose(home, trip, event.start, day, zoo) : undefined;
  const pose =
    phase === 'attending'
      ? attendingPose(home, trip, time, day, zoo)
      : phase === 'waiting' && seatedVenue
        ? briefWait
          ? starting && SEATED_POSES.has(starting)
            ? starting
            : undefined
          : ('sit' as const)
        : undefined;
  // Sitting down on arrival and getting up to leave take a moment, halfway down; so does getting
  // up off the blanket to play once the games begin, after waiting sat down.
  const settling =
    seatedVenue &&
    pose !== undefined &&
    (SEATED_POSES.has(pose)
      ? time < arrive + SEAT_SETTLE || time >= leave - SEAT_SETTLE
      : phase === 'attending' &&
        arrive < event.start &&
        !briefWait &&
        time < event.start + SEAT_SETTLE);
  // Reaching a spot that faces back the way they came, or leaving one that way, a guest turns
  // through a quarter first (seated guests while halfway down), never about in a single frame.
  const there = phase === 'waiting' || phase === 'attending';
  const turning =
    there &&
    ((time < arrive + SPOT_TURN && opposite(endFacing(route), movement.facing)) ||
      (time >= leave - SPOT_TURN && opposite(movement.facing, startFacing(returnRoute))));
  // What a Riverside guest carries, on their outing's own leg only (OutingSpec.carry).
  const carry = spec?.carry;
  // Something carried there and set on the ground (the regatta's paper boat) is set down halfway
  // down, through the turn to the spot's own way, waiting for the start or not.
  const settingDown =
    there && carry?.leg === 'going' && carry.setDown !== undefined && time < arrive + carry.setDown;
  const shown = settling || settingDown ? 'crouch' : turning ? undefined : pose;
  const carrying = carry && carry.leg === phase;
  return {
    ...movement,
    ...(turning ? { facing: sideways(movement.facing) } : {}),
    activity: 'stroll',
    event: { id: event.id, name: event.name, phase },
    ...(carrying ? { carry: { kind: carry.kind, variant: carry.variant(day, home.id) } } : {}),
    ...(phase === 'attending'
      ? {
          ...(shown ? { pose: shown } : {}),
          // A zoo cheer is a quick, excited point at the animals.
          walkPhase: zoo && zoo.cheer ? (zoo.since * 2) % 1 : (time / 5 + seat / 10) % 1,
        }
      : {}),
    ...(phase === 'waiting' && shown ? { pose: shown } : {}),
  };
}

/** A walk of a trip: its route and the minutes it takes. */
type TripWalk = { route: Point[]; minutes: number };
/** The last walk home, when the way home ends on foot. */
function homeWalk(trip: ResidentTrip): TripWalk | undefined {
  if (!trip.returnLegs) return { route: trip.returnRoute, minutes: trip.returnDuration };
  const last = trip.returnLegs.at(-1);
  return last?.kind === 'walk' ? last : undefined;
}
/** The first walk out, when the way there starts on foot. */
function outWalk(trip: ResidentTrip): TripWalk | undefined {
  if (!trip.legs) return { route: trip.route, minutes: trip.duration };
  const first = trip.legs[0];
  return first?.kind === 'walk' ? first : undefined;
}
/** Tiles short of the doorstep where a neighbor turns round between two outings. */
export const CHAIN_TURN_TILES = 0.05;

/**
 * Home from one outing at the very minute the next sets off back the way they came: a moment's
 * stand a step short of the doorstep, turning round through a quarter instead of about in a
 * single frame. The walks keep their planned times: the stand takes only the minutes those last
 * and first steps would have taken. Undefined outside such a turn.
 */
export function chainTurn(
  homeId: string,
  trips: readonly ResidentTrip[],
  time: number,
  lanesOf: TripLaneLookup = tripLanes,
) {
  for (let i = 1; i < trips.length; i++) {
    const before = trips[i - 1],
      after = trips[i];
    if (before.continuesTo || before.homeBy !== after.depart) continue;
    if (Math.abs(time - after.depart) > 1) continue;
    const back = homeWalk(before),
      out = outWalk(after);
    if (!back || !out) continue;
    const end = back.route.at(-1)!;
    const inward = lastStretch(back.route),
      outward = firstStretch(out.route);
    if (!inward || !outward) continue;
    // Only a turn straight back along the same line needs it.
    if (inward.x * outward.x + inward.y * outward.y > -0.999) continue;
    const step = Math.min(CHAIN_TURN_TILES, inward.length, outward.length);
    const from = before.homeBy - step / (routeLength(back.route) / back.minutes),
      until = after.depart + step / (routeLength(out.route) / out.minutes);
    if (time < from || time >= until) continue;
    const f = (time - from) / (until - from);
    const arriving = endFacing(back.route);
    const trip = time < before.homeBy ? before : after;
    // The last step in and the first step out are a hair off the line in their lanes: the figure
    // shifts across between the two while it turns, never in a single frame.
    const inLength = routeLength(back.route),
      outLength = routeLength(out.route);
    const drawnIn = walkAlong(
      back.route,
      (inLength - step) / inLength,
      laneAt(lanesOf(before, homeId).returning, from),
    ).laneOffset;
    const drawnOut = walkAlong(
      out.route,
      step / outLength,
      laneAt(lanesOf(after, homeId).going, until),
    ).laneOffset;
    const shift = {
      x: (drawnIn?.x ?? 0) * (1 - f) + (drawnOut?.x ?? 0) * f,
      y: (drawnIn?.y ?? 0) * (1 - f) + (drawnOut?.y ?? 0) * f,
    };
    return {
      position: { x: end.x - inward.x * step, y: end.y - inward.y * step },
      ...(shift.x || shift.y ? { laneOffset: shift } : {}),
      moving: false,
      facing: f < 0.25 ? arriving : f < 0.75 ? sideways(arriving) : startFacing(out.route),
      walkPhase: 0,
      activity: 'stroll' as const,
      event: {
        id: trip.event.id,
        name: trip.event.name,
        phase: trip === before ? ('returning' as const) : ('going' as const),
      },
    } satisfies Partial<ResidentState>;
  }
  return undefined;
}
/** A route's last or first straight stretch, as a unit direction and a length. */
function lastStretch(route: readonly Point[]) {
  for (let i = route.length - 1; i > 0; i--) {
    const x = route[i].x - route[i - 1].x,
      y = route[i].y - route[i - 1].y;
    const length = Math.hypot(x, y);
    if (length) return { x: x / length, y: y / length, length };
  }
  return undefined;
}
function firstStretch(route: readonly Point[]) {
  for (let i = 1; i < route.length; i++) {
    const x = route[i].x - route[i - 1].x,
      y = route[i].y - route[i - 1].y;
    const length = Math.hypot(x, y);
    if (length) return { x: x / length, y: y / length, length };
  }
  return undefined;
}

/** Minutes a guest takes to turn through a quarter at their spot, arriving or leaving. */
export const SPOT_TURN = 0.2;
type Facing = ResidentState['facing'];
/** The facing a walk arrives with, along its last stretch (repeated points skipped). */
export function endFacing(route: readonly Point[]): Facing {
  for (let i = route.length - 1; i > 0; i--)
    if (route[i].x !== route[i - 1].x || route[i].y !== route[i - 1].y)
      return facingAlong(route[i - 1], route[i]);
  return 'sw';
}
/** The facing a walk sets off with, along its first stretch. */
export function startFacing(route: readonly Point[]): Facing {
  for (let i = 1; i < route.length; i++)
    if (route[i].x !== route[i - 1].x || route[i].y !== route[i - 1].y)
      return facingAlong(route[i - 1], route[i]);
  return 'sw';
}

/** Minutes a guest's pose is held at least: none flashes up as they settle, or as they go. */
export const POSE_HOLD = 1;
/**
 * What a guest does at their spot while the event is on (worked out only then). Most change on
 * the beat, every 12 minutes, each guest on beats of their own; the first and the last are held
 * POSE_HOLD at least, from settling at the spot to the crouch to get up (or the band going).
 */
function attendingPose(
  home: Place,
  trip: ResidentTrip,
  time: number,
  day: number,
  zoo: ReturnType<typeof zooGlance> | false,
): EventPose | undefined {
  const { event, seat, arrive, leave } = trip;
  // A Riverside outing's guests take the poses its own file gives them (src/lib/outings/*.ts).
  const spec = event.outing ? outingOf(event.outing) : undefined;
  if (spec) {
    const context: PoseContext = { home, trip, time, day, seat, arrive, leave };
    return spec.pose(context);
  }
  if (event.venue.kind === 'football')
    return supporterCheers(time, day, seat) ? 'cheer' : undefined;
  if (event.venue.kind === 'zoo') return zoo && zoo.cheer ? 'cheer' : undefined;
  if (event.venue.kind === 'cinema') return 'sit';
  if (event.venue.kind === 'stage') {
    // The band has gone: the last of the crowd stand quietly until they leave, with no more notes.
    if (time >= event.end) return undefined;
    if (event.id === 'night-party') return 'dance';
    const beat = poseBeat(home, trip, time);
    return (event.id === 'rock' ? beat % 3 !== 0 : beat % 4 === 0) ? 'cheer' : 'sway';
  }
  // On a snowman build day lunch seats 0 and 1 build and the rest watch (outings/snowmen.ts).
  // Either side of it the lunch keeps its own poses, handed over so each is held a minute.
  if (event.variant === 'snowmen') {
    const context: SnowmenContext = {
      home,
      trip,
      time,
      day,
      seat,
      arrive,
      leave,
      lunch: (at) => lunchPose(home, trip, at),
    };
    const snowmen = seat < 2 ? snowmenBuilderPose(context) : snowmenWatcherPose(context);
    if (snowmen) return snowmen;
  }
  return lunchPose(home, trip, time);
}
/**
 * The beat a guest's pose is on at `time`: every 12 minutes, each guest on beats of their own,
 * the first and the last held POSE_HOLD at least, from settling at the spot to the crouch to get
 * up (or the band going).
 */
function poseBeat(home: Place, trip: ResidentTrip, time: number) {
  const { event, arrive, leave } = trip;
  const from = Math.max(arrive, event.start) + SEAT_SETTLE,
    to = (event.venue.kind === 'stage' ? Math.min(leave, event.end) : leave) - SEAT_SETTLE;
  const held =
    to - from >= 2 * POSE_HOLD
      ? Math.min(Math.max(time, from + POSE_HOLD), to - POSE_HOLD)
      : (from + to) / 2;
  return Math.floor((held + (hash(home.id) % 19)) / 12);
}
/** A lunch guest's own pose on the green at `time`, by the lunch and their seat. */
function lunchPose(home: Place, trip: ResidentTrip, time: number): EventPose {
  const { event, seat } = trip;
  const beat = poseBeat(home, trip, time);
  if (event.id === 'books') return beat % 4 === 0 ? 'sip' : 'read';
  if (event.id === 'games' && seat % 2 === 0) return 'play';
  return (['sit', 'sip', 'chat', 'sit'] as const)[(beat + seat) % 4];
}

/**
 * Poses the figure draws sitting down; the crouch leads into and out of them. `perch` and `tea`
 * sit on a raised seat (the Bandstand's deckchairs).
 */
const SEATED_POSES: ReadonlySet<string> = new Set(['sit', 'read', 'sip', 'chat', 'perch', 'tea']);
/** Minutes spent halfway down after reaching a seat, and again before getting up to leave. */
export const SEAT_SETTLE = 0.4;

/** Minutes a zoo visitor takes to turn from one side of the promenade to the other. */
export const ZOO_TURN = 0.25;
/** Minutes of a zoo visitor's cheer, a little after turning to a habitat. */
export const ZOO_CHEER = 1.5;
/**
 * Where a zoo visitor is looking `time` minutes into the day, having reached their spot on the
 * promenade at `arrive`: habitats line both sides, so they face north-east, then turn clockwise
 * through south-east to look south-west, and on through north-west back again. Each look lasts
 * 5 to 11 minutes, staggered per visitor, and about one in three starts with a pointing cheer.
 * No look begins so close to `leave` that its turn would run into the turn to go, so a visitor
 * never swings about in a frame on setting off.
 */
export function zooGlance(id: string, arrive: number, time: number, leave = Infinity) {
  const elapsed = Math.max(0, time - arrive);
  // Look k (k ≥ 1) starts between 8k − 3 and 8k minutes after arriving.
  const turnAt = (k: number) => (k ? 8 * k - 3 + (hash(`zoo-look:${id}:${k}`) % 4) : 0);
  let look = Math.floor((elapsed + 3) / 8);
  if (turnAt(look) > elapsed) look--;
  while (look && arrive + turnAt(look) > leave - SPOT_TURN - ZOO_TURN) look--;
  const since = elapsed - turnAt(look);
  const facing: ResidentState['facing'] =
    look && since < ZOO_TURN ? (look % 2 ? 'se' : 'nw') : look % 2 ? 'sw' : 'ne';
  const cheer = hash(`zoo-cheer:${id}:${look}`) % 3 === 0 && since >= 1 && since < 1 + ZOO_CHEER;
  return { facing, cheer, since };
}
