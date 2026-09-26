import type { Place } from './schema';
import { duckAwareWalk } from './duck-reactions';
import { getPlot, hash, plotEntrance, type Point } from './world';
import type { EventPose } from './events';
import { roadNodes, roadPath, facingAlong, WALK_SPEED } from './walking';
import { residentTrips, tripState } from './resident-trips';
import { nightBedtime, nightLeisure } from './night-routine';
import { tubeStation, type ResidentTransit } from './tubes';
export { roadPath, facingAlong } from './walking';

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
  duckLove?: boolean;
  nightWalk?: boolean;
  nightPorch?: boolean;
  pose?: EventPose;
  event?: { name: string; id: string; phase: 'going' | 'attending' | 'returning' };
  /** Only while boarding, riding or stepping off the tube on the way to or from an event. */
  transit?: ResidentTransit;
};
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
// Where a tube ride is heading, and where it is coming home from.
const TUBE_PLACES: Record<string, readonly [to: string, from: string]> = {
  zoo: ['Willow Grove Zoo', 'the zoo'],
  cinema: ['the Starlight Cinema', 'the movies'],
  football: ['the football', 'the football'],
  millpond: ['the Millpond', 'the Millpond'],
};
function tubeLabel(transit: ResidentTransit, event: NonNullable<ResidentState['event']>) {
  if (transit.stage === 'alighting')
    return `Stepping off the tube at ${tubeStation(transit.to).name}`;
  const [to, from] = TUBE_PLACES[event.id] ?? [event.name, 'the event'];
  const verb = transit.stage === 'boarding' ? 'Boarding' : 'Riding';
  return event.phase === 'returning'
    ? `${verb} the tube home from ${from}`
    : `${verb} the tube to ${to}`;
}
export function residentActivityLabel(state: ResidentState): string {
  if (state.duckLove) return 'Stopped to admire the ducklings';
  if (state.transit && state.event) return tubeLabel(state.transit, state.event);
  if (state.event?.id === 'zoo')
    return state.event.phase === 'going'
      ? 'Walking to Willow Grove Zoo'
      : state.event.phase === 'returning'
        ? 'Walking home from the zoo'
        : 'Watching the animals at Willow Grove Zoo';
  if (state.event?.id === 'cinema')
    return state.event.phase === 'going'
      ? 'Walking to the Starlight Cinema'
      : state.event.phase === 'returning'
        ? 'Walking home from the movies'
        : 'Watching a film under the stars';
  if (state.event?.id === 'football')
    return state.event.phase === 'going'
      ? 'Walking to the football'
      : state.event.phase === 'returning'
        ? 'Walking home from the football'
        : 'Watching football at The Meadow Ground';
  if (state.event?.id === 'millpond')
    return state.event.phase === 'going'
      ? 'Walking to the Millpond'
      : state.event.phase === 'returning'
        ? 'Walking home from the Millpond'
        : 'Skating on the Millpond';
  if (state.event)
    return state.event.phase === 'going'
      ? `Walking to ${state.event.name}`
      : state.event.phase === 'returning'
        ? 'Walking home from the event'
        : `${state.pose === 'dance' ? 'Dancing' : state.pose === 'read' ? 'Reading' : state.pose === 'sip' ? 'Sipping lemonade' : state.pose === 'chat' ? 'Chatting' : state.pose === 'play' ? 'Playing' : state.pose === 'cheer' ? 'Cheering' : state.pose === 'sway' ? 'Swaying' : 'Relaxing'} at ${state.event.name}`;
  if (state.nightWalk) return 'Out for a moonlit stroll';
  if (state.nightPorch) return 'Enjoying the night on the doorstep';
  return {
    stroll: 'Out for a stroll',
    work: 'Working at home',
    home: 'Relaxing at home',
    sleep: 'Sleeping',
  }[state.activity];
}

/** The minute of the town day, wrapped by 1440. A single `%` keeps every in-day minute bit-exact,
 *  so anything else that reads the day's plans at a minute (the tube panel) agrees with the town. */
export function townClock(minutes: number) {
  const wrapped = minutes % 1440;
  return wrapped < 0 ? wrapped + 1440 : wrapped;
}

export function simulateResidents(places: Place[], minutes: number, day = 0): ResidentState[] {
  const time = townClock(minutes);
  const period = periodAt(time);
  const eventDay = time < 360 ? day - 1 : day;
  const itinerary = residentTrips(places, eventDay);
  const tripTime = time < 360 ? time + 1440 : time;
  const start = period === 'morning' ? 360 : period === 'afternoon' ? 720 : 1080;
  const states = places.flatMap((home): ResidentState[] => {
    const plot = getPlot(home.plot);
    if (!plot) return [];
    const doorstep = plotEntrance(plot);
    const trips = itinerary.get(home.id) ?? [];
    const trip = trips.find((trip) => tripTime >= trip.depart && tripTime < trip.homeBy);
    if (trip)
      return [
        {
          id: home.id,
          resident: home.resident,
          home,
          position: doorstep,
          activity: 'stroll',
          moving: false,
          facing: 'se',
          walkPhase: 0,
          greeting: false,
          ...tripState(home, trip, tripTime, day),
        },
      ];
    const awakeAtNight =
      period === 'night' &&
      home.resident.routine.night === 'stroll' &&
      tripTime < nightBedtime(home);
    if (awakeAtNight) {
      return [
        {
          id: home.id,
          resident: home.resident,
          home,
          activity: 'stroll',
          greeting: false,
          ...nightLeisure(home, tripTime, trips),
        },
      ];
    }
    const activity = period === 'night' ? 'sleep' : home.resident.routine[period];
    let position = doorstep,
      moving = false;
    let facing: ResidentState['facing'] = 'se',
      walkPhase = 0;
    let duckLove: boolean | undefined;
    if (activity === 'stroll') {
      // Fill only the free time between commitments, always returning to the doorstep.
      const freeStart = Math.max(
        start,
        ...trips.filter((trip) => trip.homeBy <= tripTime).map((trip) => trip.homeBy),
      );
      const freeEnd = Math.min(
        period === 'morning' ? 720 : period === 'afternoon' ? 1080 : 1320,
        ...trips.filter((trip) => trip.depart > tripTime).map((trip) => trip.depart),
      );
      const duration = freeEnd - freeStart;
      const seed = hash(home.id);
      const nearby = roadNodes.filter(
        (point) => Math.abs(point.x - doorstep.x) + Math.abs(point.y - doorstep.y) <= 24,
      );
      const a = nearby[seed % nearby.length],
        b = nearby[(seed * 7 + 43) % nearby.length];
      const outward = [...roadPath(doorstep, a), ...roadPath(a, b).slice(1)].slice(
        0,
        Math.max(1, Math.floor((Math.max(0, duration - 12) * WALK_SPEED) / 2) + 1),
      );
      const route = [...outward, ...outward.slice(0, -1).reverse()];
      const loopLength = route.length - 1 + 12;
      const cycles = Math.max(1, Math.floor((duration * WALK_SPEED) / loopLength));
      const sample = (
        at: number,
      ): Pick<ResidentState, 'position' | 'moving' | 'facing' | 'walkPhase' | 'duckLove'> => {
        const phase = ((at - freeStart) / duration) * loopLength * cycles;
        // Finish each walk at home, take a short break, and wander out again.
        const step = phase % loopLength;
        if (step < route.length - 1) {
          const index = Math.floor(step),
            fraction = step - index;
          return {
            position: {
              x: route[index].x + (route[index + 1].x - route[index].x) * fraction,
              y: route[index].y + (route[index + 1].y - route[index].y) * fraction,
            },
            moving: true,
            facing: facingAlong(route[index], route[index + 1]),
            walkPhase: (step * 3) % 1,
          };
        }
        return {
          position: doorstep,
          moving: false,
          facing:
            route.length > 1
              ? facingAlong(route[route.length - 2], route[route.length - 1])
              : facing,
          walkPhase: 0,
        };
      };
      const movement = duckAwareWalk(
        `${home.id}:${home.plot}:${period}:${freeStart}:${freeEnd}`,
        time,
        freeStart,
        freeEnd,
        sample,
      );
      ({ position, moving, facing, walkPhase } = movement);
      duckLove = movement.duckLove;
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
        ...(duckLove ? { duckLove: true } : {}),
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
        !a.duckLove &&
        !b.duckLove &&
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
