import { isRoad, ROAD_MIN, ROAD_MAX_X, ROAD_MAX_Y, type Point } from './world';
import type { ResidentState } from './simulation';

export function facingAlong(from: Point, to: Point): ResidentState['facing'] {
  if (to.x !== from.x) return to.x > from.x ? 'se' : 'nw';
  return to.y >= from.y ? 'sw' : 'ne';
}
export const roadNodes: Point[] = [];
// Road tiles by integer index, so a search needs no string keys: tile (x, y) is x * ROWS + y.
const ROWS = ROAD_MAX_Y + 1;
const TILES = (ROAD_MAX_X + 1) * ROWS;
const nodes: Point[] = [];
const road = new Uint8Array(TILES);
for (let x = ROAD_MIN; x <= ROAD_MAX_X; x++)
  for (let y = ROAD_MIN; y <= ROAD_MAX_Y; y++)
    if (isRoad(x, y)) {
      const point = { x: x + 0.5, y: y + 0.5 };
      roadNodes.push(point);
      nodes[x * ROWS + y] = point;
      road[x * ROWS + y] = 1;
    }
/** The road tile whose centre is exactly `(x, y)`, or -1. */
function tileAt(x: number, y: number) {
  const i = x - 0.5,
    j = y - 0.5;
  const inside = Number.isInteger(i) && Number.isInteger(j) && i >= 0 && j >= 0;
  return inside && i <= ROAD_MAX_X && j <= ROAD_MAX_Y && road[i * ROWS + j] ? i * ROWS + j : -1;
}
const key = (point: Point) => `${point.x},${point.y}`;
const paths = new Map<string, Point[]>();
// One search at a time: reused buffers, with `seen` stamped per search instead of cleared.
const parent = new Int32Array(TILES);
const queue = new Int32Array(TILES);
const seen = new Uint32Array(TILES);
let search = 0;
/**
 * The shortest road route, breadth first in a fixed order (east, west, south, north), so every
 * visitor walks the same one. Starting off the road (a doorway, a seat) steps onto the road tiles
 * beside it; an unreachable goal gives `[from]`.
 */
export function roadPath(from: Point, to: Point): Point[] {
  const cacheKey = `${key(from)}:${key(to)}`;
  const cached = paths.get(cacheKey);
  if (cached) return cached;
  let path: Point[];
  if (key(from) === key(to)) path = [to];
  else {
    const goal = tileAt(to.x, to.y);
    if (goal < 0) return [from];
    if (++search > 0xffffffff) {
      seen.fill(0);
      search = 1;
    }
    let head = 0,
      tail = 0;
    const visit = (tile: number, previous: number) => {
      if (seen[tile] === search) return;
      seen[tile] = search;
      parent[tile] = previous;
      queue[tail++] = tile;
    };
    const start = tileAt(from.x, from.y);
    if (start >= 0) visit(start, -1);
    else
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const tile = tileAt(from.x + dx, from.y + dy);
        if (tile >= 0) visit(tile, -1);
      }
    while (head < tail) {
      const tile = queue[head++];
      if (tile === goal) break;
      const x = (tile / ROWS) | 0,
        y = tile - x * ROWS;
      if (x < ROAD_MAX_X && road[tile + ROWS]) visit(tile + ROWS, tile);
      if (x > 0 && road[tile - ROWS]) visit(tile - ROWS, tile);
      if (y < ROAD_MAX_Y && road[tile + 1]) visit(tile + 1, tile);
      if (y > 0 && road[tile - 1]) visit(tile - 1, tile);
    }
    if (seen[goal] !== search) return [from];
    // The ends are the caller's own points; the road tiles between are shared.
    path = [to];
    for (let tile = parent[goal]; tile >= 0 && tile !== start; tile = parent[tile])
      path.push(nodes[tile]);
    path.push(from);
    path.reverse();
  }
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
