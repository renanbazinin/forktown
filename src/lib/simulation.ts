import type { Place } from './schema';
import { FOOTBALL_ENTRANCE, spectatorSpot, footballAt } from './football';
import {
  EVENT_SPOTS,
  eventMinutes,
  eventSpot,
  eventsForDay,
  type EventPose,
  type TownEvent,
} from './events';
import {
  getPlot,
  hash,
  isRoad,
  plotEntrance,
  ROAD_MIN,
  ROAD_MAX_X,
  ROAD_MAX_Y,
  type Point,
} from './world';

export type ResidentState = {
  id: string;
  resident: Place['resident'];
  home: Place;
  position: Point;
  activity: 'stroll' | 'work' | 'home' | 'sleep';
  moving: boolean;
  facing: 'se' | 'sw' | 'ne' | 'nw';
  walkPhase: number;
  greeting: boolean;
  nightWalk?: boolean;
  pose?: EventPose;
  event?: { name: string; id: string; phase: 'going' | 'attending' | 'returning' };
};
export function facingAlong(from: Point, to: Point): ResidentState['facing'] {
  if (to.x !== from.x) return to.x > from.x ? 'se' : 'nw';
  return to.y >= from.y ? 'sw' : 'ne';
}
const roadNodes: Point[] = [];
for (let x = ROAD_MIN; x <= ROAD_MAX_X; x++)
  for (let y = ROAD_MIN; y <= ROAD_MAX_Y; y++)
    if (isRoad(x, y)) roadNodes.push({ x: x + 0.5, y: y + 0.5 });
const key = (point: Point) => `${point.x},${point.y}`;
const graph = new Map(roadNodes.map((point) => [key(point), point]));
const paths = new Map<string, Point[]>();
export function roadPath(from: Point, to: Point): Point[] {
  const cacheKey = `${key(from)}:${key(to)}`;
  if (paths.has(cacheKey)) return paths.get(cacheKey)!;
  const queue = [from],
    previous = new Map<string, Point | null>([[key(from), null]]);
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (key(current) === key(to)) break;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = graph.get(key({ x: current.x + dx, y: current.y + dy }));
      if (next && !previous.has(key(next))) {
        previous.set(key(next), current);
        queue.push(next);
      }
    }
  }
  if (!previous.has(key(to))) return [from];
  const path: Point[] = [];
  for (let current: Point | null = to; current; current = previous.get(key(current)) ?? null)
    path.unshift(current);
  // Bound the cache even when many custom neighbors are previewed.
  if (paths.size > 4096) paths.clear();
  paths.set(cacheKey, path);
  return path;
}
export function timeLabel(minutes: number) {
  const value = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function periodAt(minutes: number) {
  const value = ((minutes % 1440) + 1440) % 1440;
  return value < 360 || value >= 1320
    ? 'night'
    : value < 720
      ? 'morning'
      : value < 1080
        ? 'afternoon'
        : 'evening';
}
function alongRoute(route: Point[], progress: number) {
  // Distance-based interpolation also handles the short, fractional audience spacing.
  const lengths = route
    .slice(1)
    .map((point, i) => Math.hypot(point.x - route[i].x, point.y - route[i].y));
  let remaining = Math.max(0, Math.min(1, progress)) * lengths.reduce((sum, n) => sum + n, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining < lengths[i]) {
      const fraction = remaining / lengths[i];
      return {
        position: {
          x: route[i].x + (route[i + 1].x - route[i].x) * fraction,
          y: route[i].y + (route[i + 1].y - route[i].y) * fraction,
        },
        moving: true,
        facing: facingAlong(route[i], route[i + 1]),
        walkPhase: (remaining * 3) % 1,
      };
    }
    remaining -= lengths[i];
  }
  return { position: route.at(-1)!, moving: false, facing: 'ne' as const, walkPhase: 0 };
}

function eventWalk(home: Place, event: TownEvent, seat: number, time: number) {
  const doorstep = plotEntrance(getPlot(home.plot)!);
  const entrance = plotEntrance(getPlot(event.venue.plot)!);
  const spot = eventSpot(event.venue, seat),
    audience = spot.position;
  // Enter from the side of the picnic lawn, or from the stage's front lawn.
  // All legs are axis-aligned; the route never crosses the platform or refreshment table.
  const laneX = event.venue.kind === 'green' ? entrance.x - 1.35 : audience.x;
  const route = [
    ...roadPath(doorstep, entrance),
    { x: laneX, y: entrance.y },
    { x: laneX, y: audience.y },
    audience,
  ];
  const leaveHome = event.depart + seat * 1.3;
  const leaveEvent = event.end + seat * 1.4;
  const phase: NonNullable<ResidentState['event']>['phase'] =
    time < event.start ? 'going' : time < leaveEvent ? 'attending' : 'returning';
  const movement =
    phase === 'going'
      ? {
          ...alongRoute(route, (time - leaveHome) / (event.start - leaveHome)),
          ...(time < leaveHome ? { moving: false } : {}),
        }
      : phase === 'returning'
        ? alongRoute([...route].reverse(), (time - leaveEvent) / (event.homeBy - leaveEvent))
        : { position: audience, moving: false, facing: spot.facing, walkPhase: 0 };
  const beat = Math.floor((time + (hash(home.id) % 19)) / 12);
  const pose: EventPose =
    event.id === 'night-party'
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
    ...(phase === 'attending'
      ? {
          pose,
          walkPhase:
            (time / (event.venue.kind === 'stage' ? 3 : 5) + (hash(home.id) % 10) / 10) % 1,
        }
      : {}),
    event: time < event.homeBy ? { name: event.name, id: event.id, phase } : undefined,
  };
}

export function residentActivityLabel(state: ResidentState): string {
  if (state.event?.id === 'football')
    return state.event.phase === 'going'
      ? 'Walking to the football'
      : state.event.phase === 'returning'
        ? 'Walking home from the football'
        : 'Watching football at The Meadow Ground';
  if (state.event)
    return state.event.phase === 'going'
      ? `Walking to ${state.event.name}`
      : state.event.phase === 'returning'
        ? 'Walking home from the event'
        : `${state.pose === 'dance' ? 'Dancing' : state.pose === 'read' ? 'Reading' : state.pose === 'sip' ? 'Sipping lemonade' : state.pose === 'chat' ? 'Chatting' : state.pose === 'play' ? 'Playing' : state.pose === 'cheer' ? 'Cheering' : state.pose === 'sway' ? 'Swaying' : 'Relaxing'} at ${state.event.name}`;
  if (state.nightWalk) return 'Out for a moonlit stroll';
  return {
    stroll: 'Out for a stroll',
    work: 'Working at home',
    home: 'Relaxing at home',
    sleep: 'Sleeping',
  }[state.activity];
}

export function simulateResidents(places: Place[], minutes: number, day = 0): ResidentState[] {
  const time = ((minutes % 1440) + 1440) % 1440;
  const period = periodAt(time);
  const start = period === 'morning' ? 360 : period === 'afternoon' ? 720 : 1080;
  const event = eventsForDay(day).find((event) => event.period === period);
  const eventTime = event ? eventMinutes(event, time) : time;
  // Keep the guest list and seats attached to the evening across midnight.
  const eventDay = period === 'night' && time < 360 ? day - 1 : day;
  // Venue capacity comes from its physical spots. Overflow keeps its usual stroll.
  // Selection is shared, order-independent,
  // and changes each day; contributors never need to schedule a named meeting.
  const attendees = event
    ? places
        .filter((home) => home.resident.routine[event.period] === 'stroll')
        .sort(
          (a, b) =>
            hash(`${eventDay}:${event.id}:${a.id}`) - hash(`${eventDay}:${event.id}:${b.id}`) ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        )
        .slice(0, EVENT_SPOTS[event.venue.kind].length)
        .map((home) => home.id)
    : [];
  const footballCandidates =
    period === 'morning' || period === 'afternoon'
      ? places
          .filter(
            (home) => home.resident.routine[period] === 'stroll' && !attendees.includes(home.id),
          )
          .sort(
            (a, b) =>
              hash(`fans:${day}:${period}:${a.id}`) - hash(`fans:${day}:${period}:${b.id}`) ||
              a.id.localeCompare(b.id),
          )
          .map((home) => home.id)
      : [];
  // Leave some neighbors strolling through the streets as well.
  const footballFans = footballCandidates.slice(
    0,
    Math.min(6, Math.ceil(footballCandidates.length / 2)),
  );
  const football = footballFans.length ? footballAt(time, day) : undefined;
  const states = places.flatMap((home): ResidentState[] => {
    const plot = getPlot(home.plot);
    if (!plot) return [];
    const doorstep = plotEntrance(plot);
    const seat = attendees.indexOf(home.id);
    const footballSeat = footballFans.indexOf(home.id);
    const nightGuest = period === 'night' && seat !== -1;
    const partyTrip =
      nightGuest && !!event && eventTime >= event.depart && eventTime < event.homeBy;
    // One quiet, local walk, with departures spread from 22:00 to 02:00.
    // Anchor to the evening across midnight; a new UTC town day must not teleport walkers.
    const nightTime = (time - 1320 + 1440) % 1440;
    const nightDeparture = hash(`night:${home.id}`) % 240;
    const nightWalk =
      period === 'night' &&
      !nightGuest &&
      home.resident.routine.night === 'stroll' &&
      nightTime >= nightDeparture &&
      nightTime < nightDeparture + 180;
    const activity =
      period === 'night'
        ? nightWalk || partyTrip
          ? 'stroll'
          : 'sleep'
        : home.resident.routine[period];
    let position = doorstep,
      moving = false;
    let facing: ResidentState['facing'] = 'se',
      walkPhase = 0;
    if (nightWalk) {
      const nearby = roadNodes.filter((point) => {
        const distance = Math.abs(point.x - doorstep.x) + Math.abs(point.y - doorstep.y);
        return distance >= 4 && distance <= 8;
      });
      const destination = nearby[hash(`moon:${home.id}`) % nearby.length] ?? doorstep;
      const outward = roadPath(doorstep, destination);
      const route = [...outward, ...outward.slice(0, -1).reverse()];
      const movement = alongRoute(route, (nightTime - nightDeparture) / 180);
      ({ position, moving, facing, walkPhase } = movement);
    } else if (activity === 'stroll' && !partyTrip && footballSeat === -1) {
      const seed = hash(home.id),
        a = roadNodes[seed % roadNodes.length],
        b = roadNodes[(seed * 7 + 43) % roadNodes.length];
      const route = [
        ...roadPath(doorstep, a),
        ...roadPath(a, b).slice(1),
        ...roadPath(b, doorstep).slice(1),
      ];
      const duration = period === 'evening' ? 240 : 360;
      const loopLength = route.length - 1 + 12;
      const cycles = Math.max(1, Math.floor((duration * 0.32) / loopLength));
      const phase = ((time - start) / duration) * loopLength * cycles;
      // Finish each walk at home, take a short break, and wander out again.
      const step = phase % (route.length - 1 + 12);
      if (route.length > 1) facing = facingAlong(route[route.length - 2], route[route.length - 1]);
      if (step < route.length - 1) {
        const index = Math.floor(step),
          fraction = step - index;
        position = {
          x: route[index].x + (route[index + 1].x - route[index].x) * fraction,
          y: route[index].y + (route[index + 1].y - route[index].y) * fraction,
        };
        moving = true;
        facing = facingAlong(route[index], route[index + 1]);
        walkPhase = (step * 3) % 1;
      }
    }
    let footballVisit: Partial<ResidentState> = {};
    if (footballSeat !== -1) {
      const spot = spectatorSpot(footballSeat);
      const route = [
        ...roadPath(doorstep, FOOTBALL_ENTRANCE),
        { x: spot.x, y: FOOTBALL_ENTRANCE.y },
        spot,
      ];
      const arrive = start + 70,
        leave = start + 285,
        homeBy = start + 350;
      const phase = time < arrive ? 'going' : time < leave ? 'attending' : 'returning';
      footballVisit = {
        ...(phase === 'going'
          ? alongRoute(route, (time - start) / (arrive - start))
          : phase === 'returning'
            ? alongRoute([...route].reverse(), (time - leave) / (homeBy - leave))
            : {
                position: spot,
                moving: false,
                facing: 'ne',
                walkPhase: (time / 3 + footballSeat / 6) % 1,
              }),
        ...(phase === 'attending' && football?.goal ? { pose: 'cheer' as const } : {}),
        event: time < homeBy ? { id: 'football', name: 'The Meadow Ground', phase } : undefined,
      };
    }
    return [
      {
        id: home.id,
        resident: home.resident,
        home,
        position,
        activity,
        moving,
        facing,
        walkPhase,
        greeting: false,
        ...footballVisit,
        ...(nightWalk ? { nightWalk: true } : {}),
        ...(event && seat !== -1 && (period !== 'night' || partyTrip)
          ? eventWalk(home, event, seat, eventTime)
          : {}),
      },
    ];
  });
  for (let i = 0; i < states.length; i++)
    for (let j = i + 1; j < states.length; j++) {
      const a = states[i],
        b = states[j];
      if (
        a.activity === 'stroll' &&
        b.activity === 'stroll' &&
        !a.event &&
        !b.event &&
        Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) < 1.4
      ) {
        // Occasional greetings, with no named meetings or shared mutable state.
        const beat = Math.floor(time / 5);
        if (hash(`${[a.id, b.id].sort().join(':')}:${beat}`) % 3 === 0)
          a.greeting = b.greeting = true;
      }
    }
  return states;
}
