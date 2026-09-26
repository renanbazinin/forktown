// The Treeline: one glass tube behind the north-west trees, for people and parcels.
// Facts only: stations, reserved plots, the one shared route geometry (art and model both read it,
// so a rider is always drawn inside the glass) and timing. Pure; imports nothing but the world, so
// the build-time schema can import it.
import { getPlot, hash, plotEntrance, project, TILE_H, type Point } from './world.ts';

/** The first station's tiny enamel sign, word for word. */
export const TUBE_SIGN = 'People & parcels. Please remove umbrella.';
/** The sign's three painted lines; joined with single spaces they are TUBE_SIGN. */
export const TUBE_SIGN_LINES = ['People & parcels.', 'Please remove', 'umbrella.'] as const;
export const TUBE_LINE_NAME = 'The Treeline';

// In order along the line, north to south by row: a new station goes in at its row, not at the end,
// so the first and last are always the line's two ends (the parcels, the panel's words and the art
// rely on it, and a test holds it). Hedgerow Halt carries the sign.
const STATIONS = [
  { plot: 'C1', name: 'Hedgerow Halt' },
  { plot: 'N1', name: 'Willow Halt' },
] as const;

export type TubeStation = {
  /** The station's plot id doubles as its id. */
  id: string;
  plot: string;
  name: string;
  /** plotEntrance, on the road: where the walk to and from the tube starts and ends. */
  door: Point;
  /** The glass stack's foot, 0.7 tiles in from the door: (plot.x + 0.5, plot.y + 1.8). */
  stack: Point;
  /** Plot centre: the corner where the spur turns west along its tree-free row. */
  dock: Point;
};
/** Tiles between a station's door and its stack. */
export const TUBE_STACK_WALK = 0.7;
export const TUBE_STATIONS: readonly TubeStation[] = STATIONS.map(({ plot, name }) => {
  const p = getPlot(plot);
  if (!p) throw new Error(`Tube station ${name} needs plot ${plot}.`);
  const door = plotEntrance(p);
  return {
    id: plot,
    plot,
    name,
    door,
    stack: { x: door.x, y: door.y - TUBE_STACK_WALK },
    dock: { x: p.x + 0.5, y: p.y + 0.5 },
  };
});
export const TUBE_PLOTS: readonly string[] = TUBE_STATIONS.map((station) => station.plot);
export const isTubePlot = (id: string) => TUBE_PLOTS.includes(id);
export const tubeStation = (id: string): TubeStation => {
  const station = TUBE_STATIONS.find((s) => s.id === id);
  if (!station) throw new Error(`No tube station ${id}.`);
  return station;
};
/** One selection for the whole line, like the Millpond's H4. */
export const TUBE_VENUE = {
  id: 'tube',
  plot: TUBE_PLOTS[0],
  name: TUBE_LINE_NAME,
  kind: 'tube',
} as const;
/** Camera frame around one station, its spur and the trunk behind it (world px), like MILLPOND_FRAME. */
export function tubeFrame(id: string): { center: Point; width: number; height: number } {
  const s = tubeStation(id);
  const a = project(TUBE_TRUNK_X, s.dock.y),
    b = project(s.door.x + 1.5, s.door.y);
  return {
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 20 },
    width: Math.abs(b.x - a.x) + 240,
    height: Math.abs(b.y - a.y) + 160,
  };
}

// Timing, in town minutes (one town minute is one real second).
/** Door → stack walk, turn, crouch and fwoomp. */
export const TUBE_BOARD = 2;
/** Tiles per town minute in the glass. */
export const TUBE_SPEED = 10;
/** Drop, settle and the walk from the stack back to the door. */
export const TUBE_ALIGHT = 2;
/**
 * Ride only when door to door is at least this many unhurried minutes faster than walking.
 * ≥ (MAX_TRAVEL_SPEED_MULTIPLIER − 1) × the largest tubeFixedMinutes: only walking hurries, so the
 * tube journey stays the shorter one even when both walks hurry to the full 1.4×, and a tube plan
 * never fails where the walking plan would succeed.
 */
export const TUBE_MIN_SAVING = 10;
/** Minutes into boarding: the walk to the stack ends, the turn ends, the crouch ends (fwoomp to TUBE_BOARD). */
export const TUBE_BOARD_STEPS = { walk: 1.6, turn: 1.8, crouch: 1.88 } as const;
/** Minutes into stepping off: the drop ends, the settle ends (then the walk out to TUBE_ALIGHT). */
export const TUBE_ALIGHT_STEPS = { drop: 0.12, settle: 0.25 } as const;

// Geometry. The trunk runs half a tile beyond the slab's north-west edge, behind the tree line;
// each spur leaves its stack's top, runs back over the lawn to the plot centre, then west along
// that tree-free row over the lane, and dips through the tree gap into an elbow onto the trunk.
export const TUBE_TRUNK_X = -0.5;
/** Centreline lift, world px: over the lawn and the lane, on the trunk, and the glass's half height. */
export const TUBE_ALTITUDE = { spur: 39, trunk: 8, radius: 2.5 } as const;
/** Spur plan, tiles: how far the leg starts behind the stack's foot, the step length, the dip's
 *  run, its point count and eased ends, and the elbow's radius and point count. */
const TUBE_SPUR = {
  back: 0.15,
  step: 0.5,
  dipFrom: 1.35,
  dipTo: 0,
  dipSteps: 6,
  ease: 0.2,
  elbow: 0.5,
  elbowSteps: 4,
} as const;
/** A ground tile point plus the glass centreline's lift above it, in world px. */
export type TubePoint = { x: number; y: number; h: number };

/** A straight ramp with short rounded ends. A smoothstep would bob on screen, because the ground
 *  itself climbs toward the back; a straight ramp reads as one clean line. */
function ramp(t: number) {
  const c = Math.max(0, Math.min(1, t)),
    ease = TUBE_SPUR.ease;
  const peak = 1 / (1 - ease);
  if (c < ease) return (peak * c * c) / (2 * ease);
  if (c > 1 - ease) return 1 - (peak * (1 - c) * (1 - c)) / (2 * ease);
  return peak * (ease / 2 + (c - ease));
}
// The descent runs from the lane's west edge through the whole elbow, so its bottom ease happens
// while the glass already heads down the trunk: no bump where the spur meets the trunk.
const DESCENT = TUBE_SPUR.dipFrom - TUBE_SPUR.dipTo + (Math.PI / 2) * TUBE_SPUR.elbow;
const descent = (u: number) =>
  TUBE_ALTITUDE.trunk + (TUBE_ALTITUDE.spur - TUBE_ALTITUDE.trunk) * (1 - ramp(u / DESCENT));

/** One station's spur, stack top first, ending exactly on the trunk; dir = +1 when the trunk runs south. */
function spur(station: TubeStation, dir: 1 | -1): TubePoint[] {
  const { stack, dock } = station;
  const { back, step, dipFrom, dipTo, dipSteps, elbow, elbowSteps } = TUBE_SPUR;
  const high = TUBE_ALTITUDE.spur;
  const legFrom = stack.y - back;
  const points: TubePoint[] = [
    { x: stack.x, y: stack.y, h: high },
    { x: stack.x, y: legFrom, h: high },
  ];
  // Leg: back over the lawn to the plot centre.
  const legSteps = Math.max(1, Math.ceil(Math.abs(dock.y - legFrom) / step));
  for (let i = 1; i <= legSteps; i++)
    points.push({
      x: stack.x,
      y: i === legSteps ? dock.y : legFrom + ((dock.y - legFrom) * i) / legSteps,
      h: high,
    });
  // Straight west over the lawn and the lane.
  const straightSteps = Math.max(1, Math.ceil((dock.x - dipFrom) / step));
  for (let i = 1; i <= straightSteps; i++)
    points.push({
      x: i === straightSteps ? dipFrom : dock.x + ((dipFrom - dock.x) * i) / straightSteps,
      y: dock.y,
      h: high,
    });
  // The dip through the tree gap.
  for (let i = 1; i <= dipSteps; i++) {
    const x = i === dipSteps ? dipTo : dipFrom + ((dipTo - dipFrom) * i) / dipSteps;
    points.push({ x, y: dock.y, h: descent(dipFrom - x) });
  }
  // The elbow onto the trunk, then its end snapped exactly onto the trunk.
  const cy = dock.y + dir * elbow;
  const a0 = (-Math.PI / 2) * dir,
    a1 = -Math.PI * dir;
  for (let i = 1; i < elbowSteps; i++) {
    const a = a0 + ((a1 - a0) * i) / elbowSteps;
    points.push({
      x: dipTo + elbow * Math.cos(a),
      y: cy + elbow * Math.sin(a),
      h: descent(dipFrom - dipTo + (Math.PI / 2) * elbow * (i / elbowSteps)),
    });
  }
  points.push({ x: TUBE_TRUNK_X, y: cy, h: TUBE_ALTITUDE.trunk });
  return points;
}

const routes = new Map<string, readonly TubePoint[]>();
const distances = new Map<string, readonly number[]>();
/** Stack top to stack top: spur(a, dir) then spur(b, −dir) reversed. Memoised; never mutate. Throws for a === b. */
export function tubeRoute(from: string, to: string): readonly TubePoint[] {
  const key = `${from}>${to}`;
  const known = routes.get(key);
  if (known) return known;
  const a = tubeStation(from),
    b = tubeStation(to);
  if (a === b) throw new Error(`No tube ride from ${from} to itself.`);
  const dir = b.dock.y > a.dock.y ? 1 : -1;
  const route = [...spur(a, dir), ...spur(b, dir === 1 ? -1 : 1).reverse()];
  routes.set(key, route);
  return route;
}
/** Cumulative distances along tubeRoute: hypot(dx, dy, dh / TILE_H) per segment. */
function tubeRouteDistances(from: string, to: string): readonly number[] {
  const key = `${from}>${to}`;
  const known = distances.get(key);
  if (known) return known;
  const route = tubeRoute(from, to);
  const list = [0];
  for (let i = 1; i < route.length; i++) {
    const p = route[i - 1],
      q = route[i];
    list.push(list[i - 1] + Math.hypot(q.x - p.x, q.y - p.y, (q.h - p.h) / TILE_H));
  }
  distances.set(key, list);
  return list;
}
/** Tiles along the glass from stack top to stack top (C1 ↔ N1: 54.498). */
export const tubeLength = (from: string, to: string) => tubeRouteDistances(from, to).at(-1)!;
/** Board + ride + alight: the minutes that never speed up. */
export const tubeFixedMinutes = (from: string, to: string) =>
  TUBE_BOARD + tubeLength(from, to) / TUBE_SPEED + TUBE_ALIGHT;
type TubeFacing = 'se' | 'sw' | 'ne' | 'nw';
const facingOf = (a: Point, b: Point): TubeFacing =>
  b.x !== a.x ? (b.x > a.x ? 'se' : 'nw') : b.y >= a.y ? 'sw' : 'ne';

/** Where a capsule is, s tiles along the route (clamped): ground point, centreline lift, travel direction,
 *  and the route segment index i (between points i and i + 1). */
export function tubeAt(
  from: string,
  to: string,
  s: number,
): { position: Point; altitude: number; facing: TubeFacing; index: number } {
  const route = tubeRoute(from, to),
    along = tubeRouteDistances(from, to);
  const c = Math.max(0, Math.min(along.at(-1)!, s));
  // The last segment that starts at or before c; the final point belongs to the last segment.
  let low = 0,
    high = route.length - 2;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (along[middle] <= c) low = middle;
    else high = middle - 1;
  }
  const a = route[low],
    b = route[low + 1];
  const f =
    along[low + 1] > along[low] ? Math.min(1, (c - along[low]) / (along[low + 1] - along[low])) : 1;
  const position =
    f === 1 ? { x: b.x, y: b.y } : { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  return {
    position,
    altitude: f === 1 ? b.h : a.h + (b.h - a.h) * f,
    facing: facingOf(a, b),
    index: low,
  };
}

// A resident's transit state (ResidentState.transit). Defined here so art and UI import one module.
export type TubeStage = 'boarding' | 'riding' | 'alighting';
export type ResidentTransit = {
  stage: TubeStage;
  /** Boarding and stepping-off station ids. */
  from: string;
  to: string;
  /** 0..1 through the current stage. */
  progress: number;
  /** World px above `position` where the figure is: 0 standing and walking; boarding ramps 0 → spur over the
   *  fwoomp (TUBE_BOARD_STEPS.crouch → TUBE_BOARD); riding = the glass centreline; alighting ramps spur → 0 over
   *  the drop. Continuous across every stage, so cameras and labels never jump. */
  altitude: number;
  /** Tiles along tubeRoute(from, to): 0 while boarding, s while riding, tubeLength while alighting. */
  distance: number;
};
/** Minutes into the current stage. */
export const tubeStageTime = (t: Pick<ResidentTransit, 'stage' | 'progress' | 'distance'>) =>
  t.stage === 'boarding'
    ? t.progress * TUBE_BOARD
    : t.stage === 'alighting'
      ? t.progress * TUBE_ALIGHT
      : t.distance / TUBE_SPEED;
/** Inside the glass stack (drawn by the stack, not as a walker, and not clickable). */
export const tubeInStack = (t: Pick<ResidentTransit, 'stage' | 'progress'>) =>
  t.stage === 'boarding'
    ? t.progress * TUBE_BOARD >= TUBE_BOARD_STEPS.walk
    : t.stage === 'alighting'
      ? t.progress * TUBE_ALIGHT < TUBE_ALIGHT_STEPS.settle
      : false;

// Parcels: a deterministic daylight timetable of candidate slots, alternating direction.
// tube-traffic.ts drops any slot whose episode (waiting on the pad, riding, waiting on the far pad)
// comes within `margin` of a ride's episode.
export const TUBE_PARCELS = {
  /** First and last slot, town minutes. */
  first: 7 * 60,
  last: 19 * 60,
  every: 20,
  /** Each slot leaves 0..jitter whole minutes late. */
  jitter: 6,
  /** Minutes of clear line kept between a parcel's episode and a ride's. */
  margin: 1,
  /** Minutes a parcel waits on the pad before it leaves and after it arrives. */
  wait: 0.5,
} as const;
/** Candidate parcels for a town day, stack top to stack top. */
export function tubeParcelSlots(
  day: number,
): { id: string; from: string; to: string; depart: number }[] {
  // End to end: the stations run north to south.
  const [north, south] = [TUBE_STATIONS[0].id, TUBE_STATIONS.at(-1)!.id];
  const slots = [];
  for (let k = 0; TUBE_PARCELS.first + k * TUBE_PARCELS.every <= TUBE_PARCELS.last; k++) {
    const seed = hash(`tube-parcel:${Math.floor(day)}:${k}`);
    // About one slot in four stays empty.
    if (seed % 4 === 0) continue;
    slots.push({
      id: `parcel:${Math.floor(day)}:${k}`,
      from: k % 2 ? south : north,
      to: k % 2 ? north : south,
      depart:
        TUBE_PARCELS.first + k * TUBE_PARCELS.every + ((seed >>> 4) % (TUBE_PARCELS.jitter + 1)),
    });
  }
  return slots;
}
/** Stack top to stack top, like a rider. */
export const tubeParcelMinutes = (from: string, to: string) => tubeLength(from, to) / TUBE_SPEED;
