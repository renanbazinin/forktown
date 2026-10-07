// Lanes: every walker keeps to a side of the road, edging across only to walk clear of someone,
// so neighbors who share a street walk side by side instead of as one figure. Pure geometry in
// world tiles; src/city draws, sorts and clicks each figure at residentGround.
import type { ResidentState } from './simulation';
import { hash, type Point } from './world';
import { insideVenue, VENUES } from './events';

/** How far in from either end of a walk a walker's lane is all the way out, in tiles. */
export const LANE_RAMP = 0.6;
/**
 * World tiles a whole lane moves a walker, sideways of the way they walk: about 8 screen px
 * across and 4 down at zoom 1, so two walkers a whole lane apart stand clear of each other.
 */
export const LANE_SHIFT = 0.22;
/**
 * Tiles either side of a walker over which their sideways direction is averaged, so it turns
 * with them through a corner (or a run of short stretches) at an unhurried rate.
 */
export const LANE_TURN = 0.75;

/** A resident's own side of the road, -1..1, when nobody walks alongside them. */
export const laneSide = (id: string) => (hash(`lane:${id}`) % 2001) / 1000 - 1;
/**
 * The lane `walked` tiles into a walk `length` tiles long: out to `side` in the middle, eased in
 * from the start and back to 0 by the end, so every walk still leaves and reaches its points
 * (a doorstep, a gate, a seat) dead on.
 */
export const walkLane = (side: number, walked: number, length: number) =>
  side * Math.min(1, Math.max(0, Math.min(walked, length - walked) / LANE_RAMP));

/**
 * A walk's straight stretches (repeated points dropped): where each ends, and its side; and the
 * part of the walk where a lane is kept (all of it but the way through the stage's crowd).
 */
type Stretches = {
  ends: number[];
  sides: Point[];
  /** Each stretch's first point and unit direction. */
  starts: Point[];
  dirs: Point[];
  from: number;
  to: number;
};
const stretchesOf = new WeakMap<readonly Point[], Stretches>();
function stretches(route: readonly Point[]): Stretches {
  let found = stretchesOf.get(route);
  if (found) return found;
  const ends = [0],
    sides: Point[] = [],
    starts: Point[] = [],
    dirs: Point[] = [];
  let from = Infinity,
    to = -Infinity;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    // To the walker's side, and toward the right of the screen whichever way they walk: -y
    // (up-right on screen) along the x axis, +x (down-right) along the y axis. So a lane turning
    // with its walker round a corner passes across the screen, never up or down it, and two
    // walkers turning a corner in lanes apart stay side by side instead of one over the other.
    const right = dx + dy <= 0 ? 1 : -1;
    sides.push({ x: (right * -dy) / length, y: (right * dx) / length });
    starts.push(a);
    dirs.push({ x: dx / length, y: dy / length });
    const start = ends[ends.length - 1];
    ends.push(start + length);
    // Threading between the stage's standing crowd, single file, lane 0.
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (![a, middle, b].some((point) => insideVenue(STAGE, point))) {
      from = Math.min(from, start);
      to = start + length;
    }
  }
  found = { ends, sides, starts, dirs, from, to };
  stretchesOf.set(route, found);
  return found;
}

/** The Little Stage's lawn, where the crowd stands in rows the walk-ins thread between. */
const STAGE = VENUES.find((venue) => venue.kind === 'stage')!;

/**
 * The lane `walked` tiles along `route` for a walker on `side`: walkLane over the walk, but 0 on
 * the way through the stage's crowd at either end of it, so nobody's lane carries them into
 * someone standing there.
 */
export function routeLane(route: readonly Point[], walked: number, side: number) {
  if (!side) return 0;
  const { from, to } = stretches(route);
  if (!(walked > from && walked < to)) return 0;
  return walkLane(side, walked - from, to - from);
}

/**
 * The world offset of a walker in lane `lane` (already eased) `walked` tiles along `route`:
 * sideways of the way they walk, averaged over LANE_TURN either side of them (the first and
 * last stretches running on beyond the ends), so the figure rounds a corner instead of hopping
 * across it.
 */
export function laneOffset(
  route: readonly Point[],
  walked: number,
  lane: number,
): Point | undefined {
  if (!lane) return undefined;
  const { ends, sides } = stretches(route);
  const last = sides.length - 1;
  if (last < 0) return undefined;
  const low = walked - LANE_TURN,
    high = walked + LANE_TURN;
  let x = 0,
    y = 0;
  for (let i = 0; i <= last; i++) {
    const from = i ? ends[i] : -Infinity,
      to = i < last ? ends[i + 1] : Infinity;
    const overlap = Math.min(to, high) - Math.max(from, low);
    if (overlap <= 0) continue;
    x += sides[i].x * overlap;
    y += sides[i].y * overlap;
  }
  const shift = (LANE_SHIFT * lane) / (2 * LANE_TURN);
  return { x: shift * x, y: shift * y };
}

/**
 * Where a resident's feet are drawn, sorted, clicked and greeted from: their position, moved
 * sideways by their lane while they walk the road.
 */
export function residentGround(resident: Pick<ResidentState, 'position' | 'laneOffset'>): Point {
  const offset = resident.laneOffset;
  return offset
    ? { x: resident.position.x + offset.x, y: resident.position.y + offset.y }
    : resident.position;
}

// ---- Planning lanes for walkers who walk together ----------------------------------------

/** A stretch of walking, with an optional actual motion sample for pauses and changes of pace. */
export type LanePiece = {
  route: readonly Point[];
  start: number;
  minutes: number;
  /** Motion in lane 1 at this town minute, including any easing, turns and duck stops. */
  sample?: (minute: number) => Pick<ResidentState, 'position' | 'moving' | 'facing' | 'laneOffset'>;
};
/** Minutes between the samples that find who walks with whom, and between a planned lane's steps. */
export const LANE_SAMPLE = 0.25;
/**
 * Tiles apart, heading the same way, within which two lanes could draw two figures as one: two
 * whole lanes apart (2 · LANE_SHIFT) and a figure's width along the street, with a little over.
 */
const NEAR = 0.75;
/** A planned lane moves in eighths of a lane, an eighth a sample at most. */
const LANE_STEPS = 8;
const STATES = 2 * LANE_STEPS + 1;
const stateLane = (state: number) => state / LANE_STEPS - 1;
/**
 * Lane units a planned lane drifts across in a minute at most: half a lane, a ninth of a tile,
 * so a walker making room for another edges over as they walk on.
 */
export const LANE_DRIFT = 1 / (LANE_STEPS * LANE_SAMPLE);
/** Rounds of lane planning: enough for a street's walkers to settle side by side. */
const LANE_PASSES = 3;
/**
 * What drifting an eighth of a lane costs, and what each sample a whole lane from one's own side
 * costs: a walker keeps to their side, and moves over only to walk clear of someone.
 */
const DRIFT_COST = 0.1;
const SIDE_COST = 0.01;

/**
 * A walk's lane, -1..1: one steady lane, or one lane per LANE_SAMPLE from minute
 * k0 · LANE_SAMPLE, drifting evenly from each to the next and held beyond either end.
 */
export type LanePath = number | { k0: number; lanes: Float32Array };
/** The lane `path` has at `minute`. */
export function laneAt(path: LanePath, minute: number): number {
  if (typeof path === 'number') return path;
  const { k0, lanes } = path;
  const last = lanes.length - 1;
  const f = minute / LANE_SAMPLE - k0;
  if (!(f > 0) || last < 1) return lanes[0] ?? 0;
  if (f >= last) return lanes[last];
  const i = Math.floor(f);
  return lanes[i] + (lanes[i + 1] - lanes[i]) * (f - i);
}
/** The lane `path` has at sample `k` (minute k · LANE_SAMPLE). */
const laneAtSample = (path: LanePath, k: number) =>
  typeof path === 'number'
    ? path
    : (path.lanes[Math.max(0, Math.min(path.lanes.length - 1, k - path.k0))] ?? 0);

/**
 * Where another walker is, from this one, at each sample the two walk near each other the same
 * way, and where a whole lane would draw each of them there (eased and turned as they walk):
 * the sample's index and six numbers.
 */
type Near = { other: LaneWalk; d: number[] };
const NEAR_STRIDE = 7;
/** One walk for the lane planner, sampled every LANE_SAMPLE minutes. */
export type LaneWalk = {
  id: string;
  /** Orders two walks of one resident that start on the same sample. */
  order: number;
  /** A previewed draft's neighbor: placed after the town, and never moving anyone in it. */
  late: boolean;
  /** Already has its lanes (planned before): others make room for it. */
  fixed: boolean;
  pieces: readonly LanePiece[];
  /**
   * The first sample's index (minute / LANE_SAMPLE), and per sample: where, facing which way
   * (-1 while not walking), which piece and how far along it.
   */
  k0: number;
  xs: Float64Array;
  ys: Float64Array;
  faces: Int8Array;
  piece: Int16Array;
  walked: Float64Array;
  /** Unit-lane offsets for pieces with a custom motion clock. */
  offsets?: Float64Array;
  /** Visible pauses in sampled motion keep their lane until walking resumes. */
  paused?: Uint8Array;
  box: { left: number; right: number; top: number; bottom: number };
  near: Near[];
  path?: LanePath;
};

/** The facing's index, as facingAlong names it: 0 se (+x), 1 sw (+y), 2 ne (-y), 3 nw (-x). */
const facingIndex = (dx: number, dy: number) => (dx ? (dx > 0 ? 0 : 3) : dy >= 0 ? 1 : 2);

/** Sample the walking `pieces` from minute `from` to `to` (not walking between pieces). */
export function laneWalk(
  id: string,
  order: number,
  late: boolean,
  pieces: readonly LanePiece[],
  from: number,
  to: number,
  path?: LanePath,
): LaneWalk {
  const k0 = Math.ceil(from / LANE_SAMPLE),
    n = Math.max(0, Math.ceil(to / LANE_SAMPLE) - k0);
  const walk: LaneWalk = {
    id,
    order,
    late,
    fixed: path !== undefined,
    pieces,
    k0,
    xs: new Float64Array(n),
    ys: new Float64Array(n),
    faces: new Int8Array(n).fill(-1),
    piece: new Int16Array(n).fill(-1),
    walked: new Float64Array(n),
    ...(pieces.some((piece) => piece.sample)
      ? { offsets: new Float64Array(2 * n), paused: new Uint8Array(n) }
      : {}),
    box: { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity },
    near: [],
    ...(path === undefined ? {} : { path }),
  };
  pieces.forEach(({ route, start, minutes, sample }, p) => {
    const { ends, dirs, starts } = stretches(route);
    const length = ends[ends.length - 1];
    if (!(minutes > 0) || !length) return;
    let s = 0;
    const first = Math.max(0, Math.ceil(start / LANE_SAMPLE) - k0),
      last = Math.min(n, Math.ceil((start + minutes) / LANE_SAMPLE) - k0);
    for (let i = first; i < last; i++) {
      const progress = ((k0 + i) * LANE_SAMPLE - start) / minutes;
      if (progress < 0 || progress >= 1) continue;
      const walked = progress * length;
      while (s < dirs.length - 1 && walked >= ends[s + 1]) s++;
      const motion = sample?.((k0 + i) * LANE_SAMPLE);
      if (motion && !motion.moving) {
        walk.paused![i] = 1;
        continue;
      }
      const x = motion?.position.x ?? starts[s].x + dirs[s].x * (walked - ends[s]),
        y = motion?.position.y ?? starts[s].y + dirs[s].y * (walked - ends[s]);
      walk.xs[i] = x;
      walk.ys[i] = y;
      walk.faces[i] = motion
        ? { se: 0, sw: 1, ne: 2, nw: 3 }[motion.facing]
        : facingIndex(dirs[s].x, dirs[s].y);
      walk.piece[i] = p;
      walk.walked[i] = walked;
      if (walk.offsets) {
        const offset = motion
          ? motion.laneOffset
          : laneOffset(route, walked, routeLane(route, walked, 1));
        walk.offsets[2 * i] = offset?.x ?? 0;
        walk.offsets[2 * i + 1] = offset?.y ?? 0;
      }
      walk.box.left = Math.min(walk.box.left, x);
      walk.box.right = Math.max(walk.box.right, x);
      walk.box.top = Math.min(walk.box.top, y);
      walk.box.bottom = Math.max(walk.box.bottom, y);
    }
  });
  return walk;
}

/** A whole lane's offset for `walk` at sample `i`. */
function unitOffset(walk: LaneWalk, i: number): Point {
  if (walk.offsets) return { x: walk.offsets[2 * i], y: walk.offsets[2 * i + 1] };
  const { route } = walk.pieces[walk.piece[i]];
  const walked = walk.walked[i];
  return laneOffset(route, walked, routeLane(route, walked, 1)) ?? { x: 0, y: 0 };
}

/** The samples two walks spend near each other the same way, as seen from `a`. */
function nearness(a: LaneWalk, b: LaneWalk): Near | undefined {
  const from = Math.max(a.k0, b.k0),
    to = Math.min(a.k0 + a.faces.length, b.k0 + b.faces.length);
  const near: Near = { other: b, d: [] };
  for (let k = from; k < to; k++) {
    const i = k - a.k0,
      j = k - b.k0;
    if (a.faces[i] < 0 || a.faces[i] !== b.faces[j]) continue;
    const dx = b.xs[j] - a.xs[i],
      dy = b.ys[j] - a.ys[i];
    if (dx * dx + dy * dy >= NEAR * NEAR) continue;
    const oa = unitOffset(a, i),
      ob = unitOffset(b, j);
    near.d.push(k, dx, dy, oa.x, oa.y, ob.x, ob.y);
  }
  return near.d.length >= 2 * NEAR_STRIDE ? near : undefined;
}

/**
 * How badly two figures drawn `x`, `y` world tiles apart read as one, in screen px at zoom 1
 * (project), each figure about 12 px wide and 27 tall: within 6 px across and 12 up or down they
 * read as one figure (on one spot, worst of all); within 7 across and 22 up or down, one head
 * over the other, as a two-headed one; within 10, only just apart.
 */
function overlapWeight(x: number, y: number) {
  const across = Math.abs((x - y) * 38),
    down = Math.abs((x + y) * 19);
  if (down >= 22 || across >= 10) return 0;
  if (across < 6 && down < 12) return across < 3 && down < 6 ? 16 : 8;
  // Within a stacked pair, prefer making room over lingering directly below the other head.
  return across < 7 ? 3 + (3 * (7 - across)) / 7 : 0.5;
}

/**
 * The lanes, sample by sample, that draw `walk` over its neighbors (in the lanes they have now)
 * least: each sample's overlaps, plus a little for each eighth of a lane drifted and for each
 * sample away from the walker's own side, summed over the whole walk and made least (Viterbi).
 * So a walker keeps to their side, and edges over, at most half a lane a minute, only where
 * someone walks with them: beside a column, or round a neighbor they catch up with.
 */
function choosePath(walk: LaneWalk, { cost, from }: Tables): LanePath {
  const n = walk.faces.length;
  const own = laneSide(walk.id);
  for (let s = 0; s < STATES; s++) {
    const pull = SIDE_COST * Math.abs(stateLane(s) - own);
    for (let i = 0; i < n; i++) cost[i * STATES + s] = pull;
  }
  for (const { other, d } of walk.near) {
    if (other.path === undefined) continue;
    for (let t = 0; t < d.length; t += NEAR_STRIDE) {
      const lane = laneAtSample(other.path, d[t]);
      const x = d[t + 1] + lane * d[t + 5],
        y = d[t + 2] + lane * d[t + 6];
      const row = (d[t] - walk.k0) * STATES;
      for (let s = 0; s < STATES; s++) {
        const mine = stateLane(s);
        cost[row + s] += overlapWeight(x - mine * d[t + 3], y - mine * d[t + 4]);
      }
    }
  }
  // The least cost of reaching each lane at each sample, and the lane it came from.
  let before = cost.slice(0, STATES),
    now = new Float64Array(STATES);
  for (let i = 1; i < n; i++) {
    const canDrift = !walk.paused?.[i - 1] && !walk.paused?.[i];
    for (let s = 0; s < STATES; s++) {
      let best = before[s],
        came = s;
      if (canDrift && s > 0 && before[s - 1] + DRIFT_COST < best) {
        best = before[s - 1] + DRIFT_COST;
        came = s - 1;
      }
      if (canDrift && s < STATES - 1 && before[s + 1] + DRIFT_COST < best) {
        best = before[s + 1] + DRIFT_COST;
        came = s + 1;
      }
      now[s] = best + cost[i * STATES + s];
      from[i * STATES + s] = came;
    }
    [before, now] = [now, before];
  }
  let state = 0;
  for (let s = 1; s < STATES; s++) if (before[s] < before[state]) state = s;
  const lanes = new Float32Array(n);
  for (let i = n - 1; i >= 0; i--) {
    lanes[i] = stateLane(state);
    state = from[i * STATES + state];
  }
  return { k0: walk.k0, lanes };
}

/** choosePath's tables, a row of STATES a sample: made once per plan, for its longest walk. */
type Tables = { cost: Float64Array; from: Int8Array };

const byId = (a: LaneWalk, b: LaneWalk) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Give every walk its lanes. Anyone who walks alone keeps their own side all the way. Walkers who
 * walk near others the same way (within NEAR tiles, for half a minute or more) take, in time
 * order, the lanes that draw them over those already placed least (choosePath), then a few times
 * over the best beside everyone's latest, so a column settles side by side. Fixed walks keep
 * theirs. The town is placed before a previewed draft and never looks at it. Pure: the order of
 * `walks` does not matter.
 */
export function planLaneWalks(walks: readonly LaneWalk[]) {
  const ordered = [...walks].sort(
    (a, b) => Number(a.late) - Number(b.late) || a.k0 - b.k0 || byId(a, b) || a.order - b.order,
  );
  const byTime = [...walks].sort((a, b) => a.k0 - b.k0 || byId(a, b) || a.order - b.order);
  for (let i = 0; i < byTime.length; i++) {
    const a = byTime[i];
    const end = a.k0 + a.faces.length;
    for (let j = i + 1; j < byTime.length && byTime[j].k0 < end; j++) {
      const b = byTime[j];
      if (a.id === b.id || (a.fixed && b.fixed)) continue;
      if (
        b.box.left > a.box.right + NEAR ||
        a.box.left > b.box.right + NEAR ||
        b.box.top > a.box.bottom + NEAR ||
        a.box.top > b.box.bottom + NEAR
      )
        continue;
      const near = nearness(a, b);
      if (!near) continue;
      // The town's walkers keep their lanes whatever a draft's neighbor does.
      if (a.late || !b.late) a.near.push(near);
      if (b.late || !a.late) b.near.push(nearness(b, a)!);
    }
  }
  for (const walk of ordered) if (!walk.fixed && !walk.near.length) walk.path = laneSide(walk.id);
  const longest = ordered.reduce(
    (most, walk) => (!walk.fixed && walk.near.length ? Math.max(most, walk.faces.length) : most),
    0,
  );
  const tables: Tables = {
    cost: new Float64Array(longest * STATES),
    from: new Int8Array(longest * STATES),
  };
  for (let pass = 0; pass < LANE_PASSES; pass++)
    for (const walk of ordered)
      if (!walk.fixed && walk.near.length) walk.path = choosePath(walk, tables);
}
