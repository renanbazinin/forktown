import type { Place } from './schema';
import type { ResidentState } from './simulation';
import { getPlot, hash, plotEntrance, type Point } from './world';
import { EVENT_SPOTS, eventSpot, eventsForDay, type TownEvent, type Venue } from './events';
import { cinemaGuests, CINEMA_ENTRANCE } from './cinema';
import { FOOTBALL_ENTRANCE, FOOTBALL_VENUE, spectatorSpot, footballAt } from './football';
import { zooRoute } from './zoo';
import { MILLPOND_VENUE, SKATING, millpondRoute, millpondSkatingDay, skateGlide } from './millpond';
import {
  alongRoute,
  planJourney,
  roadPath,
  routeLength,
  WALK_SPEED,
  MIN_VISIT_MINUTES,
  type TravelPlan,
} from './walking';
import { nightBedtime } from './night-routine';
import {
  fixedMinutes,
  journeyAt,
  legsMinutes,
  legsRoute,
  paceLegs,
  reverseLegs,
  tubeChoice,
  tubeLegs,
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

/** Walking the whole way: road from the doorstep, then the venue's own approach. */
export function eventRoute(home: Place, event: VisitEvent, seat: number): Point[] {
  const doorstep = plotEntrance(getPlot(home.plot)!);
  const approach = eventApproach(event, seat);
  return [...roadPath(doorstep, approach[0]), ...approach.slice(1)];
}

/** The unhurried tube journey to the event, or undefined when walking is as good. */
export function eventTubeJourney(home: Place, event: VisitEvent, seat: number) {
  const doorstep = plotEntrance(getPlot(home.plot)!);
  const approach = eventApproach(event, seat);
  const choice = tubeChoice(doorstep, approach[0]);
  if (!choice) return undefined;
  const legs = tubeLegs(choice, approach);
  return { route: legsRoute(legs), legs };
}

/** Derive a full day's commitments together so early departures and return walks survive period changes. */
export function residentTrips(places: Place[], day: number): Map<string, ResidentTrip[]> {
  const cached = plans.get(places)?.get(day);
  if (cached) return cached;
  const result = planResidentTrips(places, day);
  let byDay = plans.get(places);
  if (!byDay) {
    byDay = new Map();
    plans.set(places, byDay);
  }
  if (byDay.size >= 3) byDay.clear();
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

/**
 * The day's plan, uncached. Guests are drawn in a daily hash order, and a seat goes to the next
 * neighbor in line whenever someone ahead can't make it (too far to walk there and home in time,
 * or an earlier outing runs late), so a seat is only given out when it will be filled.
 *
 * With `tube: false` the same guests are invited but nobody rides: that is the walking-only
 * planner. A tube plan equals it for every trip before a resident's first ride, and never drops
 * one of its trips for a trip only the tube makes possible.
 */
export function planResidentTrips(
  places: Place[],
  day: number,
  options: { tube?: boolean } = {},
): Map<string, ResidentTrip[]> {
  const program = eventsForDay(day);
  const movieGuests = cinemaGuests(places, day);
  // Each home's invitations so far, and the day they make.
  const days = new Map<string, { list: Candidate[]; trips: ResidentTrip[] }>();
  const empty = { list: [], trips: [] };
  const invite = (home: Place, candidate: Candidate) => {
    const before = days.get(home.id) ?? empty;
    const list = [...before.list, candidate].sort((a, b) => a.event.start - b.event.start);
    const trips = planWithTube(home, list);
    const kept = new Set(trips.map((trip) => trip.event));
    // A visit that costs an outing already planned would leave that seat empty.
    if (!kept.has(candidate.event) || before.trips.some((trip) => !kept.has(trip.event)))
      return false;
    days.set(home.id, { list, trips });
    return true;
  };
  const sorted = (period: Period, key: string, excluded: readonly string[] = []) =>
    places
      .filter(
        (home) =>
          home.resident.routine[period] === 'stroll' &&
          !excluded.includes(home.id) &&
          getPlot(home.plot),
      )
      .sort((a, b) => hash(`${key}:${a.id}`) - hash(`${key}:${b.id}`) || a.id.localeCompare(b.id));
  /** Seat guests in line order until the seats are full or nobody else can make it. */
  const seat = (event: VisitEvent, line: readonly Place[], seats: number) => {
    const guests: string[] = [];
    for (const home of line) {
      if (guests.length >= seats) break;
      if (invite(home, { event, seat: guests.length, period: event.period })) guests.push(home.id);
    }
    return guests;
  };
  const half = (line: readonly Place[], seats: number) =>
    Math.min(seats, Math.ceil(line.length / 2));
  // Cinema guests keep their seats whatever happens; their evening is planned around the film.
  const cinema = program.find((e) => e.id === 'cinema')!;
  movieGuests.forEach((id, seat) => {
    const home = places.find((place) => place.id === id);
    if (home && getPlot(home.plot)) invite(home, { event: cinema, seat, period: 'evening' });
  });
  // The rest in time order, so an outing is planned around the ones earlier in the day.
  const morningFans = sorted('morning', `fans:${day}:morning`);
  seat(footballVisit('morning'), morningFans, half(morningFans, 6));
  const picnic = program[0];
  const picnicIds = seat(
    picnic,
    sorted('afternoon', `${day}:${picnic.id}`),
    EVENT_SPOTS.green.length,
  );
  const zooLine = sorted('afternoon', `zoo:${day}`, picnicIds);
  const zooIds = seat(
    program.find((e) => e.id === 'zoo')!,
    zooLine,
    half(zooLine, EVENT_SPOTS.zoo.length),
  );
  const afternoonFans = sorted('afternoon', `fans:${day}:afternoon`, [...picnicIds, ...zooIds]);
  const fanIds = seat(footballVisit('afternoon'), afternoonFans, half(afternoonFans, 6));
  // Winter skating on the frozen Millpond, for afternoon strollers nobody else has claimed.
  if (millpondSkatingDay(day)) {
    const skaters = sorted('afternoon', `skate:${day}`, [...picnicIds, ...zooIds, ...fanIds]);
    seat(skatingVisit, skaters, half(skaters, 6));
  }
  const concert = program[1];
  seat(concert, sorted('evening', `${day}:${concert.id}`, movieGuests), EVENT_SPOTS.stage.length);
  const party = program.find((e) => e.id === 'night-party')!;
  seat(party, sorted('night', `${day}:${party.id}`), EVENT_SPOTS.stage.length);
  const result = new Map<string, ResidentTrip[]>();
  for (const home of places) {
    if (!getPlot(home.plot)) continue;
    const { list, trips } = days.get(home.id) ?? empty;
    result.set(home.id, options.tube === false ? planHome(home, list) : trips);
  }
  return result;
}

type TubeJourney = NonNullable<ReturnType<typeof eventTubeJourney>>;

/**
 * The tube plan, keeping every trip the walking-only plan keeps. The planner is greedy, so a trip
 * only the tube makes possible (one the walking plan leaves out) could take time a later walking
 * trip needs: then the nearest such trip before the lost one gives way and the day is planned
 * again, until every walking trip is back.
 */
function planWithTube(home: Place, list: readonly Candidate[]): ResidentTrip[] {
  const journeys = new Map(list.map((c) => [c.event, eventTubeJourney(home, c.event, c.seat)]));
  const skip = new Set<VisitEvent>();
  let trips = planHome(home, list, journeys, skip);
  // Without any ride on offer the tube plan is the walking plan.
  if (![...journeys.values()].some(Boolean)) return trips;
  const kept = new Set(planHome(home, list).map((trip) => trip.event));
  for (;;) {
    const planned = new Set(trips.map((trip) => trip.event));
    const lost = list.findIndex((c) => kept.has(c.event) && !planned.has(c.event));
    if (lost < 0) return trips;
    let extra: VisitEvent | undefined;
    for (let i = lost - 1; i >= 0 && !extra; i--)
      if (planned.has(list[i].event) && !kept.has(list[i].event)) extra = list[i].event;
    // Nothing the tube added comes before it (the planner's own greed); keep the day as it is.
    if (!extra) return trips;
    skip.add(extra);
    trips = planHome(home, list, journeys, skip);
  }
}

/** One home's day: each candidate in start order, kept when it fits after the trip before. With
 *  `journeys`, a candidate that has a tube journey rides it; without, everyone walks. */
function planHome(
  home: Place,
  list: readonly Candidate[],
  journeys?: ReadonlyMap<VisitEvent, TubeJourney | undefined>,
  skip: ReadonlySet<VisitEvent> = new Set(),
): ResidentTrip[] {
  const trips: ResidentTrip[] = [];
  for (const { event, seat, period } of list) {
    if (skip.has(event)) continue;
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
      const exit = venueApproach(previous.event.venue, previous.seat).reverse();
      const approach = venueApproach(event.venue, seat);
      const hop = [...exit, ...roadPath(exit.at(-1)!, approach[0]).slice(1), ...approach.slice(1)];
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
    // Only the walking picks up the pace; boarding, riding and stepping off keep their minutes.
    const plan = planJourney(
      tube ? walkedTiles(tube.legs) : routeLength(route),
      tube ? fixedMinutes(tube.legs) : 0,
      event.start + (partyVisit ? hash(`party-arrival:${home.id}`) % 61 : 0),
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
  // Skaters step onto the ice at their loop's south point and glide from that moment on.
  const skating = event.venue.kind === 'millpond';
  const phase =
    time < (skating ? arrive : Math.max(arrive, event.start))
      ? 'going'
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
  const movement =
    phase === 'going'
      ? legs
        ? journeyAt(legs, depart, time)
        : alongRoute(route, (time - depart) / duration)
      : phase === 'returning'
        ? returnLegs
          ? journeyAt(returnLegs, leave, time)
          : alongRoute(returnRoute, (time - leave) / returnDuration)
        : { position: route.at(-1)!, moving: false, facing, walkPhase: 0 };
  const beat = Math.floor((time + (hash(home.id) % 19)) / 12);
  const pose =
    event.venue.kind === 'football'
      ? supporterCheers(time, day, seat)
        ? 'cheer'
        : undefined
      : event.venue.kind === 'zoo'
        ? undefined
        : event.venue.kind === 'cinema'
          ? 'sit'
          : event.id === 'night-party'
            ? 'dance'
            : event.venue.kind === 'stage'
              ? (event.id === 'rock' ? beat % 3 !== 0 : beat % 4 === 0)
                ? 'cheer'
                : 'sway'
              : event.id === 'books'
                ? beat % 4 === 0
                  ? 'sip'
                  : 'read'
                : event.id === 'games' && seat % 2 === 0
                  ? 'play'
                  : (['sit', 'sip', 'chat', 'sit'] as const)[(beat + seat) % 4];
  return {
    ...movement,
    activity: 'stroll',
    event: { id: event.id, name: event.name, phase },
    ...(phase === 'attending' ? { pose, walkPhase: (time / 5 + seat / 10) % 1 } : {}),
  };
}
