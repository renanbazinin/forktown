// The Treeline: one glass bore round the back and the river edges of town, for people and
// parcels. Facts only: stations, reserved plots, the one shared route geometry (art and model both
// read it, so a rider is always drawn inside the glass) and timing. Pure; imports nothing but the
// world, so the build-time schema can import it.
import {
  getPlot,
  hash,
  PLOTS,
  plotEntrance,
  project,
  TILE_H,
  WORLD_WIDTH,
  type Point,
} from './world.ts';

/** Hedgerow Halt's tiny enamel sign, word for word. */
export const TUBE_SIGN = 'People & parcels. Please remove umbrella.';
/** The sign's three painted lines; joined with single spaces they are TUBE_SIGN. */
export const TUBE_SIGN_LINES = ['People & parcels.', 'Please remove', 'umbrella.'] as const;
export const TUBE_LINE_NAME = 'The Treeline';

/**
 * Every plot the Treeline holds, in line order round the edge of town: Barley R1, Willow N1,
 * Hedgerow C1, Hawthorn A9, Watercress C15, Kingfisher L15 and Bulrush R15. Line order is arc
 * length along the loop, from the south-west end up the west run, along the north run and down
 * the far bank: a new halt goes in at its place on the loop, not at the end.
 */
export const TUBE_HALT_PLOTS = ['R1', 'N1', 'C1', 'A9', 'C15', 'L15', 'R15'] as const;
const HALT_NAMES: Record<(typeof TUBE_HALT_PLOTS)[number], string> = {
  R1: 'Barley Halt',
  N1: 'Willow Halt',
  C1: 'Hedgerow Halt',
  A9: 'Hawthorn Halt',
  C15: 'Watercress Halt',
  L15: 'Kingfisher Halt',
  R15: 'Bulrush Halt',
};
/** The halt with the sign, the umbrella stand and the parcels: never "the first station". */
export const TUBE_SIGN_STATION = 'C1';
/** Parcels run between these two halts only, as they always have; they never reach the river. */
export const TUBE_PARCEL_ROUTE = ['C1', 'N1'] as const;

/** Which edge of town a halt stands on: its spur runs west, north or east over the river. */
export type TubeEdge = 'west' | 'north' | 'bank';
export type TubeStation = {
  /** The station's plot id doubles as its id. */
  id: string;
  plot: string;
  name: string;
  edge: TubeEdge;
  /** plotEntrance, on the road: where the walk to and from the tube starts and ends. */
  door: Point;
  /** The glass stack's foot, 0.7 tiles in from the door: (plot.x + 0.5, plot.y + 1.8). */
  stack: Point;
  /** Plot centre: where a west or bank spur turns along its row (a north spur runs straight on). */
  dock: Point;
};
/** Tiles between a station's door and its stack. */
export const TUBE_STACK_WALK = 0.7;
const COLUMNS = Math.max(...PLOTS.map((plot) => plot.col)) + 1;
/** A halt's edge: column 0 is west, the last column is the bank, row 0 is north. */
function edgeOf(plot: string): TubeEdge {
  const p = getPlot(plot);
  if (!p) throw new Error(`Tube station needs plot ${plot}.`);
  if (p.col === 0) return 'west';
  if (p.col === COLUMNS - 1) return 'bank';
  if (p.row === 0) return 'north';
  throw new Error(`Tube station ${plot} is on no edge of town.`);
}
export const TUBE_STATIONS: readonly TubeStation[] = TUBE_HALT_PLOTS.map((plot) => {
  const p = getPlot(plot)!;
  const door = plotEntrance(p);
  return {
    id: plot,
    plot,
    name: HALT_NAMES[plot],
    edge: edgeOf(plot),
    door,
    stack: { x: door.x, y: door.y - TUBE_STACK_WALK },
    dock: { x: p.x + 0.5, y: p.y + 0.5 },
  };
});
export const TUBE_PLOTS: readonly string[] = TUBE_STATIONS.map((station) => station.plot);
const HALT_PLOTS: readonly string[] = TUBE_HALT_PLOTS;
export const isTubePlot = (id: string) => HALT_PLOTS.includes(id);
export const tubeStation = (id: string): TubeStation => {
  const station = TUBE_STATIONS.find((s) => s.id === id);
  if (!station) throw new Error(`No tube station ${id}.`);
  return station;
};
/** One selection for the whole line, like the Millpond's H4, on the halt with the sign. */
export const TUBE_VENUE = {
  id: 'tube',
  plot: TUBE_SIGN_STATION,
  name: TUBE_LINE_NAME,
  kind: 'tube',
} as const;
/** Camera frame around one station, its spur and the trunk behind it (world px), like MILLPOND_FRAME. */
export function tubeFrame(id: string): { center: Point; width: number; height: number } {
  const s = tubeStation(id);
  const tap = trunkPoint(stationTap(id));
  const a = project(tap.x, tap.y),
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
 * Ride only when door to door is at least this many unhurried minutes faster than walking (the
 * floor of every pair's own threshold, tubeMinSaving).
 */
export const TUBE_MIN_SAVING = 10;
/** MAX_TRAVEL_SPEED_MULTIPLIER − 1 (tested equal): the share of a ride's fixed minutes it must save. */
export const TUBE_SAVING_SHARE = 0.4;
/**
 * The saving a ride between these two halts must clear: at least TUBE_MIN_SAVING, and at least
 * (MAX_TRAVEL_SPEED_MULTIPLIER − 1) × its own fixed minutes. Only walking hurries, so the tube
 * journey stays the shorter one even when both walks hurry to the full 1.4×, and a tube plan
 * never fails where the walking plan would succeed. Only Barley ↔ Bulrush is above 10 (10.31).
 */
export const tubeMinSaving = (from: string, to: string) =>
  Math.max(TUBE_MIN_SAVING, TUBE_SAVING_SHARE * tubeFixedMinutes(from, to));
/**
 * Within one day's plan, two riders never reach a boarding door, or leave a stepping-off door,
 * within this many minutes of each other (the planner's headways, resident-trips.ts).
 */
export const TUBE_DOOR_HEADWAY = 2;
/** Minutes into boarding: the walk to the stack ends, the turn ends, the crouch ends (fwoomp to TUBE_BOARD). */
export const TUBE_BOARD_STEPS = { walk: 1.6, turn: 1.8, crouch: 1.88 } as const;
/** Minutes into stepping off: the drop ends, the settle ends (then the walk out to TUBE_ALIGHT). */
export const TUBE_ALIGHT_STEPS = { drop: 0.12, settle: 0.25 } as const;

// Geometry. The trunk is one loop half a tile beyond the slab's west and north edges, behind the
// tree lines, and down the far bank of the river: west run, a rounded north-west corner, north
// run, a rounded corner round the river's head, bank run. Each spur leaves its stack's top, runs
// back over the lawn to the plot centre (west and bank halts turn there along their tree-free
// row), crosses the lane or the riverside road high, and dips through its tree gap, or over the
// river, into an elbow onto the trunk.
/** The west run (unchanged). */
export const TUBE_TRUNK_X = -0.5;
/** The north run. */
export const TUBE_TRUNK_Y = -0.5;
/** The bank run, on the far bank between the water and the far-bank trees: 63.5. */
export const TUBE_BANK_X = WORLD_WIDTH - 0.5;
/** Corner radius, tiles. */
export const TUBE_CORNER = 1;
/** Centreline lift, world px: over the lawn and the lane, on the back runs and on the bank run, and
 *  the glass's half height on the back runs and on the bank run. */
export const TUBE_ALTITUDE = { spur: 39, trunk: 8, bank: 5, radius: 2.5, bankRadius: 2 } as const;
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

/** A west halt's spur, stack top first, ending exactly on the west run; dir = +1 when it turns south. */
function westSpur(station: TubeStation, dir: 1 | -1): TubePoint[] {
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

// ---- The loop trunk, by arc length s in ground tiles: 0 where the west run meets the north-west
// corner, negative down the west run, past S_E0 down the bank run.
const R = TUBE_CORNER;
const S_N0 = (Math.PI / 2) * R;
const S_N1 = S_N0 + (TUBE_BANK_X - R - (TUBE_TRUNK_X + R));
const S_E0 = S_N1 + (Math.PI / 2) * R;
/** Where the north run starts (S_N0) and ends (S_N1), and where the bank run starts (S_E0). */
export const TRUNK_ARCS = { S_N0, S_N1, S_E0 } as const;
/** 8 px along the back runs, easing to 5 px round the river's head, 5 px down the bank. */
const trunkLift = (s: number) =>
  s <= S_N1
    ? TUBE_ALTITUDE.trunk
    : s >= S_E0
      ? TUBE_ALTITUDE.bank
      : TUBE_ALTITUDE.trunk +
        ((TUBE_ALTITUDE.bank - TUBE_ALTITUDE.trunk) * (s - S_N1)) / (S_E0 - S_N1);
/** The arc length of a point on one of the three straight runs; throws for any other point. */
export function trunkS(p: Point): number {
  if (Math.abs(p.x - TUBE_TRUNK_X) < 1e-9 && p.y >= TUBE_TRUNK_Y + R - 1e-9)
    return -(p.y - (TUBE_TRUNK_Y + R));
  if (Math.abs(p.y - TUBE_TRUNK_Y) < 1e-9) return S_N0 + (p.x - (TUBE_TRUNK_X + R));
  if (Math.abs(p.x - TUBE_BANK_X) < 1e-9) return S_E0 + (p.y - (TUBE_TRUNK_Y + R));
  throw new Error(`The point ${p.x},${p.y} is not on the Treeline's trunk.`);
}
/** The trunk's centreline at arc length s. */
export function trunkPoint(s: number): TubePoint {
  const h = trunkLift(s);
  if (s <= 0) return { x: TUBE_TRUNK_X, y: TUBE_TRUNK_Y + R - s, h };
  if (s < S_N0) {
    const a = Math.PI + s / R;
    return { x: TUBE_TRUNK_X + R + R * Math.cos(a), y: TUBE_TRUNK_Y + R + R * Math.sin(a), h };
  }
  if (s <= S_N1) return { x: TUBE_TRUNK_X + R + (s - S_N0), y: TUBE_TRUNK_Y, h };
  if (s < S_E0) {
    const a = -Math.PI / 2 + (s - S_N1) / R;
    return { x: TUBE_BANK_X - R + R * Math.cos(a), y: TUBE_TRUNK_Y + R + R * Math.sin(a), h };
  }
  return { x: TUBE_BANK_X, y: TUBE_TRUNK_Y + R + (s - S_E0), h };
}
/** Points across each corner, ends included; the ones strictly inside a run of trunk join it. */
const CORNER_STEPS = 8;
/** The trunk from s1 to s2: both ends, plus every corner sample strictly between them. */
function trunkBetween(s1: number, s2: number): TubePoint[] {
  const keys = [s1, s2];
  for (const [low, high] of [
    [0, S_N0],
    [S_N1, S_E0],
  ])
    for (let k = 0; k <= CORNER_STEPS; k++) {
      const v = low + ((high - low) * k) / CORNER_STEPS;
      if (v > Math.min(s1, s2) + 1e-9 && v < Math.max(s1, s2) - 1e-9) keys.push(v);
    }
  keys.sort((p, q) => (s2 >= s1 ? p - q : q - p));
  return keys.map(trunkPoint);
}
/**
 * The run of trunk between two points on it: `from` and `to` themselves, with every corner sample
 * strictly between them in order. A ride's glass behind the trees is exactly this, so the art cuts
 * the same polyline.
 */
export function tubeTrunkBetween(from: TubePoint, to: TubePoint): TubePoint[] {
  const run = trunkBetween(trunkS(from), trunkS(to));
  return [from, ...run.slice(1, -1), to];
}

/** A north halt's I-spur: straight north at full height over its lawn and the y = 1 lane, the dip
 *  through its tree gap, then the elbow east (e = +1) or west (e = −1) onto the north run. */
function northSpur(station: TubeStation, e: 1 | -1): TubePoint[] {
  const { stack } = station;
  const { back, step, dipFrom, dipTo, dipSteps, elbow, elbowSteps } = TUBE_SPUR;
  const high = TUBE_ALTITUDE.spur;
  const legFrom = stack.y - back;
  const points: TubePoint[] = [
    { x: stack.x, y: stack.y, h: high },
    { x: stack.x, y: legFrom, h: high },
  ];
  const legSteps = Math.max(1, Math.ceil(Math.abs(legFrom - dipFrom) / step));
  for (let i = 1; i <= legSteps; i++)
    points.push({
      x: stack.x,
      y: i === legSteps ? dipFrom : legFrom + ((dipFrom - legFrom) * i) / legSteps,
      h: high,
    });
  for (let i = 1; i <= dipSteps; i++) {
    const y = i === dipSteps ? dipTo : dipFrom + ((dipTo - dipFrom) * i) / dipSteps;
    points.push({ x: stack.x, y, h: descent(dipFrom - y) });
  }
  for (let i = 1; i < elbowSteps; i++) {
    const t = (i / elbowSteps) * (Math.PI / 2);
    points.push({
      x: stack.x + e * elbow * (1 - Math.cos(t)),
      y: dipTo - elbow * Math.sin(t),
      h: descent(dipFrom - dipTo + elbow * t),
    });
  }
  points.push({ x: stack.x + e * elbow, y: TUBE_TRUNK_Y, h: TUBE_ALTITUDE.trunk });
  return points;
}
/** Bank spurs start down 0.35 tiles short of the riverside road's far edge, as west spurs do. */
const BANK_DIP_FROM = WORLD_WIDTH - 2.35;
/** A bank halt's bridge: north over the lawn to the dock, east over the lawn and the riverside road
 *  at full height, down over the river with the dip's own ramp (retargeted to the bank run's
 *  height), then the elbow south (e = +1) or north (e = −1) onto the bank run. */
function bankSpur(station: TubeStation, e: 1 | -1): TubePoint[] {
  const { stack, dock } = station;
  const { back, step, dipSteps, elbow, elbowSteps } = TUBE_SPUR;
  const high = TUBE_ALTITUDE.spur;
  const dipFrom = BANK_DIP_FROM,
    dipTo = TUBE_BANK_X - elbow;
  const run = dipTo - dipFrom + (Math.PI / 2) * elbow;
  const down = (u: number) =>
    TUBE_ALTITUDE.bank + (TUBE_ALTITUDE.spur - TUBE_ALTITUDE.bank) * (1 - ramp(u / run));
  const legFrom = stack.y - back;
  const points: TubePoint[] = [
    { x: stack.x, y: stack.y, h: high },
    { x: stack.x, y: legFrom, h: high },
  ];
  const legSteps = Math.max(1, Math.ceil(Math.abs(dock.y - legFrom) / step));
  for (let i = 1; i <= legSteps; i++)
    points.push({
      x: stack.x,
      y: i === legSteps ? dock.y : legFrom + ((dock.y - legFrom) * i) / legSteps,
      h: high,
    });
  const straightSteps = Math.max(1, Math.ceil((dipFrom - dock.x) / step));
  for (let i = 1; i <= straightSteps; i++)
    points.push({
      x: i === straightSteps ? dipFrom : dock.x + ((dipFrom - dock.x) * i) / straightSteps,
      y: dock.y,
      h: high,
    });
  for (let i = 1; i <= dipSteps; i++) {
    const x = i === dipSteps ? dipTo : dipFrom + ((dipTo - dipFrom) * i) / dipSteps;
    points.push({ x, y: dock.y, h: down(x - dipFrom) });
  }
  for (let i = 1; i < elbowSteps; i++) {
    const t = (i / elbowSteps) * (Math.PI / 2);
    points.push({
      x: dipTo + elbow * Math.sin(t),
      y: dock.y + e * elbow * (1 - Math.cos(t)),
      h: down(dipTo - dipFrom + elbow * t),
    });
  }
  points.push({ x: TUBE_BANK_X, y: dock.y + e * elbow, h: TUBE_ALTITUDE.bank });
  return points;
}
/**
 * A station's spur toward larger arc length along the loop (dir = +1) or smaller (−1), stack top
 * first, ending exactly on the trunk. A west halt's +1 spur turns north, a north halt's east, a
 * bank halt's south. A middle halt's two spurs share everything but the elbow.
 */
export function loopSpur(station: TubeStation, dir: 1 | -1): TubePoint[] {
  if (station.edge === 'west') return westSpur(station, dir === 1 ? -1 : 1);
  if (station.edge === 'north') return northSpur(station, dir);
  return bankSpur(station, dir);
}
const taps = new Map<string, number>();
/** Where a station taps the trunk: the arc length midway between its two elbow ends. */
export function stationTap(id: string): number {
  let tap = taps.get(id);
  if (tap === undefined) {
    const station = tubeStation(id);
    tap = (trunkS(loopSpur(station, 1).at(-1)!) + trunkS(loopSpur(station, -1).at(-1)!)) / 2;
    taps.set(id, tap);
  }
  return tap;
}
TUBE_STATIONS.forEach((station, i) => {
  if (i > 0 && !(stationTap(station.id) > stationTap(TUBE_STATIONS[i - 1].id)))
    throw new Error(`The Treeline's halts run in line order, but ${station.id} is out of order.`);
});
/**
 * The edge-tree tiles each spur passes through, which never grow a tree: (0, ⌊dock.y⌋) for a west
 * halt, (⌊dock.x⌋, 0) for a north halt and (W − 1, ⌊dock.y⌋) for a bank halt. In line order.
 */
export const TUBE_TREE_GAPS: readonly Point[] = TUBE_STATIONS.map(({ edge, dock }) =>
  edge === 'west'
    ? { x: 0, y: Math.floor(dock.y) }
    : edge === 'north'
      ? { x: Math.floor(dock.x), y: 0 }
      : { x: WORLD_WIDTH - 1, y: Math.floor(dock.y) },
);
/** Whether tile (x, y) is one of the Treeline's tree gaps. */
export const isTubeTreeGap = (x: number, y: number) =>
  TUBE_TREE_GAPS.some((gap) => gap.x === x && gap.y === y);

const routes = new Map<string, readonly TubePoint[]>();
const distances = new Map<string, readonly number[]>();
/**
 * Stack top to stack top along the loop: the boarding halt's spur toward the other, the trunk
 * between the two elbows, and the stepping-off halt's spur backwards. Memoised; never mutate.
 * Throws for a === b.
 */
export function tubeRoute(from: string, to: string): readonly TubePoint[] {
  const key = `${from}>${to}`;
  const known = routes.get(key);
  if (known) return known;
  const a = tubeStation(from),
    b = tubeStation(to);
  if (a === b) throw new Error(`No tube ride from ${from} to itself.`);
  const dir = stationTap(to) > stationTap(from) ? 1 : -1;
  const there = loopSpur(a, dir),
    back = loopSpur(b, dir === 1 ? -1 : 1);
  const trunk = trunkBetween(trunkS(there.at(-1)!), trunkS(back.at(-1)!));
  const route = [...there, ...trunk.slice(1, -1), ...back.reverse()];
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
  // Hedgerow Halt to Willow Halt and back, as they always have run.
  const [north, south] = TUBE_PARCEL_ROUTE;
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
