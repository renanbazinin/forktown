import { isRoad, ROAD_MIN, ROAD_MAX_X, ROAD_MAX_Y, type Point } from './world';
import type { ResidentState } from './simulation';

export function facingAlong(from: Point, to: Point): ResidentState['facing'] {
  if (to.x !== from.x) return to.x > from.x ? 'se' : 'nw';
  return to.y >= from.y ? 'sw' : 'ne';
}
export const roadNodes: Point[] = [];
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
export function alongRoute(route: Point[], progress: number) {
  if (progress >= 1)
    return { position: route.at(-1)!, moving: false, facing: 'ne' as const, walkPhase: 0 };
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

// Tiles per town minute, with a bounded brisk pace for longer event journeys.
export const WALK_SPEED = 0.32;
export const MAX_TRAVEL_SPEED_MULTIPLIER = 1.4;
// One town minute is one real second: leave time to enjoy the destination.
export const MIN_VISIT_MINUTES = 15;
export const routeLength = (route: readonly Point[]) =>
  route
    .slice(1)
    .reduce(
      (sum, point, index) => sum + Math.hypot(point.x - route[index].x, point.y - route[index].y),
      0,
    );
/**
 * Plan a journey of `walkTiles` walked tiles plus `fixed` minutes that never speed up (boarding,
 * riding and stepping off the tube). Only the walking picks up the pace, up to 1.4×. With
 * `fixed = 0` every number is bit-identical to the walking-only planner.
 */
export function planJourney(
  walkTiles: number,
  fixed: number,
  start: number,
  end: number,
  availableFrom: number,
  availableUntil: number,
  preferredDepart: number,
  stagger = 0,
) {
  const normalDuration = walkTiles / WALK_SPEED;
  const targetArrival = start - 5 - stagger;
  const travelWindow = targetArrival - Math.max(preferredDepart, availableFrom) - fixed;
  // Pick up the pace before borrowing time from an earlier free period.
  const speedMultiplier = Math.min(
    MAX_TRAVEL_SPEED_MULTIPLIER,
    Math.max(1, travelWindow > 0 ? normalDuration / travelWindow : MAX_TRAVEL_SPEED_MULTIPLIER),
  );
  const duration = normalDuration / speedMultiplier + fixed;
  const depart = Math.max(availableFrom, targetArrival - duration);
  const arrive = depart + duration;
  const leave = Math.min(end + stagger, availableUntil - duration);
  // Count only time while the event is open, excluding early arrival and lingering.
  if (Math.min(end, leave) - Math.max(start, arrive) < MIN_VISIT_MINUTES) return undefined;
  return { duration, depart, arrive, leave, homeBy: leave + duration, speedMultiplier };
}
export function planTravel(
  route: Point[],
  start: number,
  end: number,
  availableFrom: number,
  availableUntil: number,
  preferredDepart: number,
  stagger = 0,
) {
  const plan = planJourney(
    routeLength(route),
    0,
    start,
    end,
    availableFrom,
    availableUntil,
    preferredDepart,
    stagger,
  );
  if (!plan) return undefined;
  const { duration, depart, arrive, leave, homeBy } = plan;
  return { route, duration, depart, arrive, leave, homeBy };
}
export type TravelPlan = NonNullable<ReturnType<typeof planTravel>>;
