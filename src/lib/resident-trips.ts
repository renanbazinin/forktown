import type { Place } from './schema';
import type { ResidentState } from './simulation';
import { getPlot, hash, plotEntrance, type Point } from './world';
import {
  EVENT_SPOTS,
  eventSpot,
  eventsForDay,
  type EventPose,
  type TownEvent,
  type Venue,
} from './events';
import { cinemaGuests, CINEMA_ENTRANCE } from './cinema';
import { FOOTBALL_ENTRANCE, FOOTBALL_VENUE, spectatorSpot, footballAt } from './football';
import { zooRoute } from './zoo';
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
  type TravelPlan,
} from './walking';
import { nightBedtime } from './night-routine';
import { TUBE_MIN_SAVING } from './tubes';
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

type VisitEvent = Omit<TownEvent, 'venue' | 'period'> & {
  venue: Venue | typeof FOOTBALL_VENUE | typeof MILLPOND_VENUE;
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
};
const periods = ['morning', 'afternoon', 'evening', 'night'] as const;
type Period = (typeof periods)[number];
/** An event a resident is invited to, with their seat and the routine period it belongs to. */
type Candidate = { event: VisitEvent; seat: number; period: Period };
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

/** The venue's own way in, from the road point where the approach starts to the seat. */
export function eventApproach(event: Pick<VisitEvent, 'venue'>, seat: number): Point[] {
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
export function eventRoute(home: Place, event: VisitEvent, seat: number): Point[] {
  const doorstep = plotEntrance(getPlot(home.plot)!);
  const approach = eventApproach(event, seat);
  return joinApproach(roadPath(doorstep, approach[0]), approach);
}

/** The unhurried tube journey to the event, or undefined when walking is as good. */
export function eventTubeJourney(home: Place, event: VisitEvent, seat: number) {
  const doorstep = plotEntrance(getPlot(home.plot)!);
  const approach = eventApproach(event, seat);
  const choice = tubeChoice(doorstep, approach[0]);
  if (!choice) return undefined;
  const legs = tubeLegs(choice, approach);
  // The walk turns in at the gate as well: ride only while that still saves the minutes.
  const walk = routeLength(eventRoute(home, event, seat)) / WALK_SPEED;
  if (walk - legsMinutes(legs) < TUBE_MIN_SAVING) return undefined;
  return { route: legsRoute(legs), legs };
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
function footballVisit(period: 'morning' | 'afternoon'): VisitEvent {
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

const skatingVisit: VisitEvent = {
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

/**
 * The day's plan, uncached. Guests are drawn in a daily hash order, and a seat goes to the next
 * neighbor in line whenever someone ahead can't make it (too far to get there, on foot or by tube,
 * and home in time, or an earlier outing runs late), so a seat is only given out when it will be
 * filled. A far neighbor who can only make it by tube keeps their turn, so the tube changes who
 * gets a seat as well as how they travel.
 *
 * With `tube: false` the same guests are seated but nobody rides. That is not the town without
 * the tube, whose lines would pass a rider's seat on. A tube plan equals it for every trip before
 * a resident's first ride, and never drops one of its trips for a trip only the tube makes
 * possible, because a guest is only seated when the tube plan keeps every one of their outings.
 */
export function planResidentTrips(
  places: Place[],
  day: number,
  options: { tube?: boolean } = {},
): Map<string, ResidentTrip[]> {
  const program = eventsForDay(day);
  // A previewed draft joins every line behind the whole town.
  const { roster, newcomers } = previews.get(places) ?? { roster: places, newcomers: [] };
  // Each home's invitations so far, and the day they make.
  const days = new Map<string, { list: Candidate[]; trips: ResidentTrip[] }>();
  const empty = { list: [], trips: [] };
  const invite = (home: Place, candidate: Candidate) => {
    const before = days.get(home.id) ?? empty;
    const list = [...before.list, candidate].sort((a, b) => a.event.start - b.event.start);
    const trips = planHome(home, list, tubeJourneys(home, list));
    // A visit that costs an outing already planned would leave that seat empty. That rule alone
    // keeps every trip the walking-only plan makes: all of them are among the outings.
    if (trips.length < list.length) return false;
    days.set(home.id, { list, trips });
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
   * Seat guests in line order until the seats are full or nobody else can make it. `seats` counts
   * the spots for a line of that many; newcomers get only the spots the town's line leaves.
   */
  const seat = (
    event: VisitEvent,
    [line, late]: Place[][],
    seats: (entrants: number) => number,
  ) => {
    const guests: string[] = [];
    for (const [homes, spots] of [
      [line, seats(line.length)],
      [late, seats(line.length + late.length)],
    ] as const)
      for (const home of homes) {
        if (guests.length >= spots) break;
        if (invite(home, { event, seat: guests.length, period: event.period }))
          guests.push(home.id);
      }
    return guests;
  };
  const all = (spots: number) => () => spots;
  const half = (spots: number) => (entrants: number) => Math.min(spots, Math.ceil(entrants / 2));
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
  // The rest in time order, so an outing is planned around the ones earlier in the day.
  seat(footballVisit('morning'), sorted('morning', `fans:${day}:morning`), half(6));
  const picnic = program[0];
  const picnicIds = seat(
    picnic,
    sorted('afternoon', `${day}:${picnic.id}`),
    all(EVENT_SPOTS.green.length),
  );
  const zooIds = seat(
    program.find((e) => e.id === 'zoo')!,
    sorted('afternoon', `zoo:${day}`, picnicIds),
    half(EVENT_SPOTS.zoo.length),
  );
  const fanIds = seat(
    footballVisit('afternoon'),
    sorted('afternoon', `fans:${day}:afternoon`, [...picnicIds, ...zooIds]),
    half(6),
  );
  // Winter skating on the frozen Millpond, for afternoon strollers nobody else has claimed.
  if (millpondSkatingDay(day))
    seat(
      skatingVisit,
      sorted('afternoon', `skate:${day}`, [...picnicIds, ...zooIds, ...fanIds]),
      half(6),
    );
  const concert = program[1];
  seat(
    concert,
    sorted('evening', `${day}:${concert.id}`, movieGuests),
    all(EVENT_SPOTS.stage.length),
  );
  const party = program.find((e) => e.id === 'night-party')!;
  seat(party, sorted('night', `${day}:${party.id}`), all(EVENT_SPOTS.stage.length));
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

/** One home's day: each candidate in start order, kept when it fits after the trip before. With
 *  `journeys`, a candidate that has a tube journey rides it; without, everyone walks. */
function planHome(
  home: Place,
  list: readonly Candidate[],
  journeys?: ReadonlyMap<VisitEvent, TubeJourney | undefined>,
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
      if (leave - Math.max(event.start, arrive) >= MIN_VISIT_MINUTES) {
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
    const plan = planJourney(
      walkTiles,
      fixed,
      event.start + arrival,
      end,
      Math.max(window.availableFrom, previousReturn),
      window.availableUntil,
      event.depart,
      seat * 1.3,
    );
    if (!plan) continue;
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
      facing:
        event.venue.kind === 'football' || event.venue.kind === 'millpond'
          ? 'ne'
          : eventSpot(event.venue, seat).facing,
      ...(legs ? { legs, returnLegs: reverseLegs(legs) } : {}),
    });
  }
  return trips;
}

// ---- Lanes for walkers who share a street -------------------------------------------------

/** A trip's lanes on the way there and on the way home, -1..1 (laneAt reads them at a minute). */
export type TripLanes = { going: LanePath; returning: LanePath };
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
  // there. Anyone early for a show waits at their spot until it starts.
  const skating = event.venue.kind === 'millpond';
  const underway = skating || event.venue.kind === 'zoo' || event.venue.kind === 'football';
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
  const lanes = phase === 'going' || phase === 'returning' ? tripLanes(trip, home.id) : undefined;
  const zoo =
    event.venue.kind === 'zoo' && phase === 'attending' && zooGlance(home.id, arrive, time, leave);
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
            facing: zoo ? zoo.facing : facing,
            walkPhase: 0,
          };
  // A blanket or a cinema seat is for sitting on while the show gets ready; the lawn stands.
  const seatedVenue = event.venue.kind === 'green' || event.venue.kind === 'cinema';
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
  const shown = settling ? 'crouch' : turning ? undefined : pose;
  return {
    ...movement,
    ...(turning ? { facing: sideways(movement.facing) } : {}),
    activity: 'stroll',
    event: { id: event.id, name: event.name, phase },
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
export function chainTurn(homeId: string, trips: readonly ResidentTrip[], time: number) {
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
      laneAt(tripLanes(before, homeId).returning, from),
    ).laneOffset;
    const drawnOut = walkAlong(
      out.route,
      step / outLength,
      laneAt(tripLanes(after, homeId).going, until),
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
  { event, seat, arrive, leave }: ResidentTrip,
  time: number,
  day: number,
  zoo: ReturnType<typeof zooGlance> | false,
): EventPose | undefined {
  const from = Math.max(arrive, event.start) + SEAT_SETTLE,
    to = (event.venue.kind === 'stage' ? Math.min(leave, event.end) : leave) - SEAT_SETTLE;
  const held =
    to - from >= 2 * POSE_HOLD
      ? Math.min(Math.max(time, from + POSE_HOLD), to - POSE_HOLD)
      : (from + to) / 2;
  const beat = Math.floor((held + (hash(home.id) % 19)) / 12);
  if (event.venue.kind === 'football')
    return supporterCheers(time, day, seat) ? 'cheer' : undefined;
  if (event.venue.kind === 'zoo') return zoo && zoo.cheer ? 'cheer' : undefined;
  if (event.venue.kind === 'cinema') return 'sit';
  if (event.venue.kind === 'stage') {
    // The band has gone: the last of the crowd stand quietly until they leave, with no more notes.
    if (time >= event.end) return undefined;
    if (event.id === 'night-party') return 'dance';
    return (event.id === 'rock' ? beat % 3 !== 0 : beat % 4 === 0) ? 'cheer' : 'sway';
  }
  if (event.id === 'books') return beat % 4 === 0 ? 'sip' : 'read';
  if (event.id === 'games' && seat % 2 === 0) return 'play';
  return (['sit', 'sip', 'chat', 'sit'] as const)[(beat + seat) % 4];
}

/** Poses the figure draws sitting down; the crouch leads into and out of them. */
const SEATED_POSES: ReadonlySet<string> = new Set(['sit', 'read', 'sip', 'chat']);
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
