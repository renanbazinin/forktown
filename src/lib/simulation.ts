import type { Place } from './schema';
import { getPlot, hash, isRoad, plotEntrance, ROAD_MIN, ROAD_MAX, type Point } from './world';

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
};
export function facingAlong(from: Point, to: Point): ResidentState['facing'] {
  if (to.x !== from.x) return to.x > from.x ? 'se' : 'nw';
  return to.y >= from.y ? 'sw' : 'ne';
}
const roadNodes: Point[] = [];
for (let x = ROAD_MIN; x <= ROAD_MAX; x++)
  for (let y = ROAD_MIN; y <= ROAD_MAX; y++)
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
export function simulateResidents(places: Place[], minutes: number): ResidentState[] {
  const time = ((minutes % 1440) + 1440) % 1440;
  const period = periodAt(time);
  const start = period === 'morning' ? 360 : period === 'afternoon' ? 720 : 1080;
  const states = places.flatMap((home): ResidentState[] => {
    const plot = getPlot(home.plot);
    if (!plot) return [];
    const doorstep = plotEntrance(plot);
    const activity = period === 'night' ? 'sleep' : home.resident.routine[period];
    let position = doorstep,
      moving = false;
    let facing: ResidentState['facing'] = 'se',
      walkPhase = 0;
    if (activity === 'stroll') {
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
