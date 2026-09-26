import { MILLPOND_SITE } from './town-config.ts';
import { BLOCK_SIZE, PLOTS, hash, project, type Point } from './world.ts';
import { townCalendarAt, DAYS_PER_SEASON } from './town-calendar.ts';
import { groundFraction, yearDayAt } from './seasons.ts';

// The Millpond: one long pond on H3–I6, south of the Meadow Ground. Everything here is a pure
// function of the shared UTC town clock (minutes, day), so every visitor sees the same pond.

export const MILLPOND_VENUE = {
  id: 'millpond',
  plot: 'H4',
  name: 'The Millpond',
  kind: 'millpond',
} as const;
export const MILLPOND_PLOTS = PLOTS.filter(
  (p) =>
    p.row >= MILLPOND_SITE.row &&
    p.row < MILLPOND_SITE.row + MILLPOND_SITE.rows &&
    p.col >= MILLPOND_SITE.col &&
    p.col < MILLPOND_SITE.col + MILLPOND_SITE.columns,
).map((p) => p.id);
export const isMillpondPlot = (id: string) => MILLPOND_PLOTS.includes(id);
export const MILLPOND_GROUND = {
  left: 2 + MILLPOND_SITE.col * BLOCK_SIZE,
  right: 1 + (MILLPOND_SITE.col + MILLPOND_SITE.columns) * BLOCK_SIZE,
  top: 2 + MILLPOND_SITE.row * BLOCK_SIZE,
  bottom: 1 + (MILLPOND_SITE.row + MILLPOND_SITE.rows) * BLOCK_SIZE,
};
export const MILLPOND_CENTER: Point = {
  x: (MILLPOND_GROUND.left + MILLPOND_GROUND.right) / 2,
  y: (MILLPOND_GROUND.top + MILLPOND_GROUND.bottom) / 2,
};
const SPAN =
  MILLPOND_GROUND.right - MILLPOND_GROUND.left + MILLPOND_GROUND.bottom - MILLPOND_GROUND.top;
export const MILLPOND_FRAME = {
  center: project(MILLPOND_CENTER.x, MILLPOND_CENTER.y),
  width: SPAN * 38 + 100,
  height: SPAN * 19 + 220,
};
// Half-open like the layout's own site test, so the perimeter roads stay outside.
export const insideMillpond = (p: Point) =>
  p.x >= MILLPOND_GROUND.left &&
  p.x < MILLPOND_GROUND.right &&
  p.y >= MILLPOND_GROUND.top &&
  p.y < MILLPOND_GROUND.bottom;

// One shared outline for the art and every rule: a mill promontory and wheel bay in the
// south-west, a grassy spit on the north shore, a thin quay under the north lamp, a south-east
// cove for the heron, and a small landing at the gate.
export const MILLPOND_WATER: readonly Point[] = (
  [
    [10.8, 30.75],
    [12.2, 30.5],
    [13.6, 30.65],
    [14.6, 30.95],
    [15.4, 30.7],
    [16.6, 30.4],
    [17.6, 30.15],
    [19.2, 30.15],
    [20.3, 30.45],
    [21.8, 30.5],
    [23.3, 30.75],
    [24.3, 31.5],
    [24.4, 32.6],
    [23.6, 33.5],
    [23.2, 34.6],
    [23.5, 35.6],
    [22.8, 36.3],
    [21.4, 36.4],
    [20.2, 36.1],
    [18.9, 36.35],
    [17.9, 36.0],
    [16.8, 36.3],
    [16.0, 36.2],
    [15.7, 35.95],
    [14.85, 35.95],
    [14.85, 34.75],
    [12.9, 34.75],
    [11.6, 34.95],
    [10.5, 34.95],
    [10.15, 34.3],
    [10.2, 33.2],
    [10.45, 31.9],
  ] as const
).map(([x, y]) => ({ x, y }));

export function insideWater(p: Point) {
  let inside = false;
  for (let i = 0, j = MILLPOND_WATER.length - 1; i < MILLPOND_WATER.length; j = i++) {
    const a = MILLPOND_WATER[i],
      b = MILLPOND_WATER[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
/** Distance to the shoreline in tiles: positive inside the water, negative on the bank. */
export function shoreDistance(p: Point) {
  let best = Infinity;
  for (let i = 0, j = MILLPOND_WATER.length - 1; i < MILLPOND_WATER.length; j = i++) {
    const a = MILLPOND_WATER[j],
      b = MILLPOND_WATER[i];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return insideWater(p) ? best : -best;
}

export const MILLPOND_GATE: Point = { x: 17.5, y: 37.5 };
export const SHORE_Y = 36.65;
export const MILLPOND_JETTY = { x: 18.3, from: 36.4, to: 34.9, width: 0.5 } as const;
// The one landmark stands on the south-west bank, left of the football panel's framing.
export const MILLPOND_MILL = {
  left: 13.1,
  right: 14.7,
  top: 35.0,
  bottom: 36.6,
  height: 88,
  wheel: { x: 14.95, y: 35.35, radius: 0.5, hub: 16 },
  door: { from: 36.1, to: 36.45 },
} as const;
// East of every skater's approach column (the easternmost is x 21.0), so nobody walks behind
// it, and clear of the jetty, the boats and the heron's south spots and roost.
export const MILLPOND_SIGN: Point = { x: 22.9, y: 36.9 };
/**
 * Reed beds at the waterline, `size` px tall. North-bank beds stay at x ≤ 11.5 or x ≥ 20.5 and
 * at most 14 px (the fans' foreground and the goal confetti keep the middle clear); the east cove
 * is thick with them and the heron roosts there. None stand in the gate lane, a skater's approach
 * column, beside the jetty, in the wheel bay, over a lamp's reflection or behind the mill.
 */
export const MILLPOND_REEDS: readonly { x: number; y: number; size: number; seed: number }[] = [
  { x: 10.85, y: 31.05, size: 14, seed: 1 },
  { x: 11.4, y: 30.8, size: 12, seed: 2 },
  { x: 10.35, y: 32.65, size: 16, seed: 3 },
  { x: 21.25, y: 30.72, size: 14, seed: 4 },
  { x: 22.35, y: 30.78, size: 13, seed: 5 },
  { x: 24.1, y: 31.55, size: 14, seed: 6 },
  { x: 23.45, y: 33.65, size: 18, seed: 7 },
  { x: 23.4, y: 34.8, size: 20, seed: 8 },
  { x: 23.3, y: 35.6, size: 19, seed: 9 },
  { x: 22.6, y: 36.07, size: 18, seed: 10 },
  { x: 21.85, y: 36.3, size: 15, seed: 11 },
  { x: 20.35, y: 36.2, size: 16, seed: 12 },
  { x: 16.3, y: 36.27, size: 14, seed: 13 },
];
export const SKATE_LOOPS: readonly { x: number; y: number; rx: number; ry: number }[] = [
  { x: 12.6, y: 32.3, rx: 0.95, ry: 0.7 },
  { x: 15.4, y: 32.1, rx: 0.95, ry: 0.7 },
  { x: 18.2, y: 32.0, rx: 0.95, ry: 0.7 },
  { x: 21.0, y: 32.2, rx: 0.95, ry: 0.7 },
  { x: 16.9, y: 34.5, rx: 0.95, ry: 0.7 },
  { x: 19.7, y: 34.6, rx: 0.95, ry: 0.7 },
];
/**
 * Which loop each seat skates: the loops in full view fill first, and loop 0, tucked in by the
 * mill, is the sixth skater's (reached across the ice, never behind the mill).
 */
export const SEAT_LOOPS = [4, 1, 2, 5, 3, 0] as const;
export const loopForSeat = (seat: number) =>
  SKATE_LOOPS[SEAT_LOOPS[((seat % SEAT_LOOPS.length) + SEAT_LOOPS.length) % SEAT_LOOPS.length]];
/** Two small figures in the free ice of the east cove, clear of every resident loop and path. */
export const SCENERY_SKATE_LOOPS: readonly { x: number; y: number; rx: number; ry: number }[] = [
  { x: 23.45, y: 32.3, rx: 0.55, ry: 0.42 },
  { x: 22.3, y: 34.75, rx: 0.6, ry: 0.45 },
];
export const HERON_ROOST: Point = { x: 23.35, y: 35.2 };

/** The pond may never rise over the road in front of the pitch, the west road, or into the football frame. */
export const SIGHTLINE = { northY: 29, westX: 9, frameX: -770, frameHeight: 40 } as const;
export const sightlineLimit = (p: Point, halfWidth = 0) =>
  38 * Math.min(p.y - SIGHTLINE.northY, p.x - SIGHTLINE.westX) - halfWidth / 2;

export type IceStage = 'open' | 'freezing' | 'frozen' | 'thawing';
/** The pond freezes with the river: whole days only, so the ground cache can hold it. */
export function iceOn(groundDay: number): { stage: IceStage; cover: number } {
  if (groundDay >= 87 && groundDay <= 91) return { stage: 'freezing', cover: (groundDay - 86) / 6 };
  if (groundDay >= 92 && groundDay <= 102) return { stage: 'frozen', cover: 1 };
  if (groundDay >= 103 && groundDay <= 106)
    return { stage: 'thawing', cover: (107 - groundDay) / 5 };
  return { stage: 'open', cover: 0 };
}
/** The renderer's whole day of the year, straight from the almanac (no floating-point hair at midnight). */
export function millpondGroundDay(minutes: number, day: number) {
  const almanac = townCalendarAt(day, minutes);
  return almanac.seasonIndex * DAYS_PER_SEASON + almanac.date - 1;
}
export const millpondSkatingDay = (day: number) =>
  iceOn(millpondGroundDay(720, day)).stage === 'frozen';
export const SKATING = { depart: 780, start: 840, end: 1000, homeBy: 1070 } as const;

// ---------------------------------------------------------------------------------------------
// Shared helpers. Every moment is `absolute = day * 1440 + minutes`, split back into the town
// day it falls on, so (minutes + 1440, day - 1) and (minutes, day) are the same moment.

const TAU = Math.PI * 2;
const mod = (value: number, length: number) => ((value % length) + length) % length;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
/** A seeded fraction in [0, 1), the same for every visitor (seedFraction's formula). */
const seeded = (key: string) => (hash(`millpond:${key}`) % 10007) / 10007;
function moment(minutes: number, day: number) {
  const absolute = day * 1440 + minutes;
  const today = Math.floor(absolute / 1440);
  return { absolute, today, time: absolute - today * 1440 };
}
/** The whole day of the year of a town day, read at its first minute. */
const groundDayOf = (today: number) => millpondGroundDay(0, today);
const openWaterOn = (today: number) => iceOn(groundDayOf(today)).stage === 'open';
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
/** On screen, x grows with (x − y), so a move with dx < dy runs to the left. */
const screenLeft = (d: Point) => d.x - d.y < 0;
const pathLength = (path: readonly Point[]) =>
  path.slice(1).reduce((sum, p, i) => sum + distance(path[i], p), 0);
function alongPath(path: readonly Point[], at: number) {
  let remaining = Math.max(0, at);
  for (let i = 1; i < path.length; i++) {
    const length = distance(path[i - 1], path[i]);
    if (remaining <= length || i === path.length - 1) {
      return {
        position: lerp(path[i - 1], path[i], length > 0 ? Math.min(1, remaining / length) : 1),
        direction: { x: path[i].x - path[i - 1].x, y: path[i].y - path[i - 1].y },
      };
    }
    remaining -= length;
  }
  return { position: path[0], direction: { x: 1, y: 0 } };
}
function bezier(p0: Point, p1: Point, p2: Point, p3: Point, s: number) {
  const u = 1 - s;
  const a = u * u * u,
    b = 3 * u * u * s,
    c = 3 * u * s * s,
    d = s * s * s;
  const da = -3 * u * u,
    db = 3 * u * u - 6 * u * s,
    dc = 6 * u * s - 3 * s * s,
    dd = 3 * s * s;
  return {
    position: {
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    },
    heading: Math.atan2(
      da * p0.y + db * p1.y + dc * p2.y + dd * p3.y,
      da * p0.x + db * p1.x + dc * p2.x + dd * p3.x,
    ),
  };
}
/** A small bounded memo for per-day plans: pure, so a cache hit never changes an answer. */
function memo<T>(cache: Map<number, T>, key: number, build: () => T) {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = build();
  if (cache.size >= 64) cache.clear();
  cache.set(key, value);
  return value;
}
const WATER_SCREEN = MILLPOND_WATER.map((p) => project(p.x, p.y));
/** Distance from the shoreline in world px on screen: positive on the water, negative on the bank. */
export function screenShoreDistance(p: Point) {
  const s = project(p.x, p.y);
  let best = Infinity;
  for (let i = 0, j = WATER_SCREEN.length - 1; i < WATER_SCREEN.length; j = i++) {
    const a = WATER_SCREEN[j],
      b = WATER_SCREEN[i];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const t = clamp01(((s.x - a.x) * dx + (s.y - a.y) * dy) / (dx * dx + dy * dy));
    best = Math.min(best, Math.hypot(s.x - (a.x + t * dx), s.y - (a.y + t * dy)));
  }
  return insideWater(p) ? best : -best;
}
/**
 * How far the ice reaches in from the shore, in world px on screen (the art's rim): 0 on open
 * water, Infinity when frozen over. Water with `screenShoreDistance < iceRim` is ice.
 */
export function iceRim(groundDay: number) {
  const { stage, cover } = iceOn(groundDay);
  if (stage === 'freezing') return 6 + 40 * cover;
  if (stage === 'thawing') return 3 + 12 * cover;
  return stage === 'frozen' ? Infinity : 0;
}

// ---------------------------------------------------------------------------------------------
// The grey heron: scenery whenever the pond is not frozen over. It sleeps on one leg in the
// east-cove reeds, wades out at dawn, hunts the south shallows 06:00–08:00 and the east
// shallows 16:00–18:30, and stands or preens in between. On freezing and thawing days it only
// rests near its roost: on the ice edge while the pond freezes, in the first open shallows while
// it thaws. It never flies, and it moves continuously all day.

export type HeronPose =
  'stand' | 'preen' | 'walk' | 'stalk' | 'freeze' | 'strike' | 'swallow' | 'sleep';
export type HeronState = {
  position: Point;
  /** Faces screen-left (mirror the sprite). */
  left: boolean;
  pose: HeronPose;
  /** 0..1 through the current pose (strike: neck down and back; swallow: head back, gulp). */
  progress: number;
  /** 0..1 leg cycle, advancing with the distance walked or stalked. */
  stride: number;
  /** A silver fish in the beak (a catch, while swallowing). */
  fish: boolean;
  /** Standing in the water: clip the legs at the waterline (`wade > 0.5`). */
  wading: boolean;
  /**
   * 0 on the bank or the ice, 1 in the shallows, smooth across the shore band (0.05–0.19 tiles
   * in): how far the sprite sinks and the shadow gives way to ripples, so nothing pops.
   */
  wade: number;
  /** Head turned toward a fish leaping within 2 tiles: −1 screen-left … +1 screen-right, 0 ahead. */
  look: number;
  /** Only ever below 1 at the roost, around the midnights the pond freezes over and thaws. */
  opacity: number;
};
/** The heron is away only while the pond is frozen over. */
const heronHome = (today: number) => iceOn(groundDayOf(today)).stage !== 'frozen';
export const HERON_SCHEDULE = {
  wake: 330,
  hunts: [
    { from: 360, to: 480 },
    { from: 960, to: 1110 },
  ],
  roost: 1260,
  sleep: 1290,
} as const;
/** Stalking pace, tiles a town minute (the spec allows 0.05). */
export const HERON_STALK_SPEED = 0.045;
/** The heron's shallows: the south band and the east cove (the spec's range, with margins). */
export const inHeronRange = (p: Point) =>
  (p.y >= 35.3 && p.x >= 19.4 && p.x <= 22.3) || p.x >= 22.0;
// Waypoints that keep its walks to and from the roost in open shallows.
const HERON_CORNER: Point = { x: 22.15, y: 35.6 };
const HERON_REED_EDGE: Point = { x: 22.75, y: 34.75 };

type HeronStill = { from: number; to: number; pose: HeronPose; fish: boolean };
type HeronLeg =
  | { kind: 'walk'; from: number; to: number; path: Point[] }
  | { kind: 'hunt'; from: number; to: number; path: Point[]; still: HeronStill[] }
  | { kind: 'rest'; from: number; to: number; spot: Point; still: HeronStill[]; left: boolean };
type HeronCore = Omit<HeronState, 'wading' | 'wade' | 'look' | 'opacity'>;

/** Time spent stalking (not frozen, striking or swallowing) since the hunt began. */
function stalkedFor(leg: { from: number; still: HeronStill[] }, time: number) {
  let paused = 0;
  for (const still of leg.still)
    paused += Math.max(0, Math.min(time, still.to) - Math.max(leg.from, still.from));
  return time - leg.from - paused;
}
/** Walk to and fro along a short line of shallows, at the stalking pace. */
function pingPong(path: Point[], along: number) {
  const length = pathLength(path);
  const u = mod(along, 2 * length);
  const forward = u <= length;
  const at = alongPath(path, forward ? u : 2 * length - u);
  return {
    position: at.position,
    direction: forward ? at.direction : { x: -at.direction.x, y: -at.direction.y },
  };
}

const heronPlans = new Map<number, HeronLeg[]>();
function heronPlan(today: number): HeronLeg[] {
  return memo(heronPlans, today, () => {
    const r = (key: string) => seeded(`heron:${today}:${key}`);
    const spot = (x0: number, x1: number, y0: number, y1: number, key: string) => ({
      x: x0 + (x1 - x0) * r(`${key}x`),
      y: y0 + (y1 - y0) * r(`${key}y`),
    });
    const south = [
      spot(20.55, 20.85, 35.6, 35.85, 's0'),
      spot(21.2, 21.5, 35.5, 35.75, 's1'),
      spot(21.85, 22.1, 35.6, 35.85, 's2'),
    ];
    const east = [
      spot(22.4, 22.7, 31.8, 32.2, 'e0'),
      spot(22.55, 22.85, 32.7, 33.1, 'e1'),
      spot(22.4, 22.7, 33.5, 33.9, 'e2'),
      spot(22.5, 22.8, 34.3, 34.7, 'e3'),
    ];
    if (r('south') < 0.5) south.reverse();
    if (r('east') < 0.5) east.reverse();
    const hunt = (window: { from: number; to: number }, path: Point[], key: string) => {
      const count = 3 + Math.floor(r(`${key}n`) * 3);
      const slot = (window.to - window.from) / count;
      const still: HeronStill[] = [];
      for (let i = 0; i < count; i++) {
        const strike = window.from + slot * i + 4 + r(`${key}s${i}`) * (slot - 10);
        const caught = r(`${key}c${i}`) < 0.4;
        still.push(
          { from: strike - 1 - 1.5 * r(`${key}f${i}`), to: strike, pose: 'freeze', fish: false },
          { from: strike, to: strike + 0.8, pose: 'strike', fish: false },
          caught
            ? { from: strike + 0.8, to: strike + 2.3, pose: 'swallow', fish: true }
            : { from: strike + 0.8, to: strike + 1.4, pose: 'stand', fish: false },
        );
      }
      const leg = { kind: 'hunt' as const, ...window, path, still };
      return { leg, end: pingPong(path, HERON_STALK_SPEED * stalkedFor(leg, window.to)).position };
    };
    const rest = (from: number, to: number, at: Point, arrival: Point[], key: string) => {
      const count = to - from > 180 ? 3 : 2;
      const slot = (to - from) / count;
      const still: HeronStill[] = [];
      for (let i = 0; i < count; i++) {
        const start = from + slot * i + 2 + r(`${key}p${i}`) * (slot - 9);
        still.push({
          from: start,
          to: start + 3 + 2 * r(`${key}d${i}`),
          pose: 'preen',
          fish: false,
        });
      }
      const last = arrival.length > 1 ? arrival.length - 1 : 0;
      const direction = last
        ? { x: arrival[last].x - arrival[last - 1].x, y: arrival[last].y - arrival[last - 1].y }
        : { x: -1, y: 0 };
      return { kind: 'rest' as const, from, to, spot: at, still, left: screenLeft(direction) };
    };
    const walk = (from: number, to: number, path: Point[]) => ({
      kind: 'walk' as const,
      from,
      to,
      path,
    });
    const groundDay = groundDayOf(today);
    if (iceOn(groundDay).stage !== 'open') {
      // Freezing or thawing: no hunting. It steps out from the roost, west across the cove, and
      // stops on the ice edge (freezing) or in the first open shallows past the thin rim
      // (thawing), and rests there all day. Freezing, every step stays on the ice. The seeded
      // headings (188°–210° in tile space) reach 34 px from the shore within 1.2 tiles.
      const rim = iceRim(groundDay);
      const freezing = iceOn(groundDay).stage === 'freezing';
      const want = freezing ? Math.max(4, rim - 5) : rim + 18;
      const heading = ((188 + 22 * r('ia')) * Math.PI) / 180;
      let at: Point = HERON_ROOST;
      for (let k = 1; k <= 150; k++) {
        at = {
          x: HERON_ROOST.x + Math.cos(heading) * 0.01 * k,
          y: HERON_ROOST.y + Math.sin(heading) * 0.01 * k,
        };
        if (screenShoreDistance(at) >= want) break;
      }
      const out = [HERON_ROOST, at];
      const legs: HeronLeg[] = [walk(HERON_SCHEDULE.wake, HERON_SCHEDULE.hunts[0].from, out)];
      let from: number = HERON_SCHEDULE.hunts[0].from;
      for (const to of [540, 720, 900, 1080, HERON_SCHEDULE.roost]) {
        legs.push(rest(from, to, at, out, `i${to}`));
        from = to;
      }
      legs.push(walk(HERON_SCHEDULE.roost, HERON_SCHEDULE.sleep, [at, HERON_ROOST]));
      return legs;
    }
    const [morningHunt, eveningHunt] = HERON_SCHEDULE.hunts;
    const morning = hunt(morningHunt, south, 'a'),
      evening = hunt(eveningHunt, east, 'b');
    const rest1 = spot(22.0, 22.2, 35.5, 35.8, 'r1'),
      rest2 = spot(22.5, 22.85, 33.8, 34.5, 'r2'),
      rest3 = spot(22.4, 22.8, 32.4, 33.3, 'r3');
    const toRest1 = [morning.end, rest1],
      toRest2 = [rest1, rest2],
      toRest3 = [evening.end, rest3];
    return [
      walk(HERON_SCHEDULE.wake, morningHunt.from, [HERON_ROOST, HERON_CORNER, south[0]]),
      morning.leg,
      walk(morningHunt.to, morningHunt.to + 12, toRest1),
      rest(morningHunt.to + 12, 700, rest1, toRest1, 'm'),
      walk(700, 712, toRest2),
      rest(712, eveningHunt.from - 12, rest2, toRest2, 'n'),
      walk(eveningHunt.from - 12, eveningHunt.from, [rest2, east[0]]),
      evening.leg,
      walk(eveningHunt.to, eveningHunt.to + 12, toRest3),
      rest(eveningHunt.to + 12, HERON_SCHEDULE.roost, rest3, toRest3, 'e'),
      walk(HERON_SCHEDULE.roost, HERON_SCHEDULE.sleep, [rest3, HERON_REED_EDGE, HERON_ROOST]),
    ];
  });
}
const STRIDE = 0.3;
function heronCore(today: number, time: number): HeronCore {
  const asleep: HeronCore = {
    position: HERON_ROOST,
    left: true,
    pose: 'sleep',
    progress: 0,
    stride: 0,
    fish: false,
  };
  if (time < HERON_SCHEDULE.wake || time >= HERON_SCHEDULE.sleep) return asleep;
  const plan = heronPlan(today);
  const leg = plan.find((l) => time < l.to) ?? plan[plan.length - 1];
  const span = leg.to - leg.from;
  if (leg.kind === 'walk') {
    const along = smooth((time - leg.from) / span) * pathLength(leg.path);
    const at = alongPath(leg.path, along);
    return {
      position: at.position,
      left: screenLeft(at.direction),
      pose: 'walk',
      progress: clamp01((time - leg.from) / span),
      stride: mod(along / STRIDE, 1),
      fish: false,
    };
  }
  const still = leg.still.find((s) => time >= s.from && time < s.to);
  if (leg.kind === 'rest')
    return {
      position: leg.spot,
      left: leg.left,
      pose: still ? still.pose : 'stand',
      progress: still ? (time - still.from) / (still.to - still.from) : 0,
      stride: 0,
      fish: false,
    };
  const along = HERON_STALK_SPEED * stalkedFor(leg, time);
  const at = pingPong(leg.path, along);
  let progress: number;
  if (still) progress = (time - still.from) / (still.to - still.from);
  else {
    const before = leg.still.filter((s) => s.to <= time).map((s) => s.to);
    const after = leg.still.filter((s) => s.from > time).map((s) => s.from);
    const runFrom = Math.max(leg.from, ...before),
      runTo = Math.min(leg.to, ...after);
    progress = clamp01((time - runFrom) / Math.max(1e-9, runTo - runFrom));
  }
  return {
    position: at.position,
    left: screenLeft(at.direction),
    pose: still ? still.pose : 'stalk',
    progress,
    stride: mod(along / STRIDE, 1),
    fish: still?.fish ?? false,
  };
}
/** Where the heron stands at an absolute minute, for keeping fish rises clear of it. */
const heronPositionAt = (absolute: number) => {
  const today = Math.floor(absolute / 1440);
  return heronCore(today, absolute - today * 1440).position;
};
/** What the heron is about, for the panel: asleep, hunting, resting, or which walk it is on. */
function heronDoing(today: number, time: number) {
  if (time < HERON_SCHEDULE.wake || time >= HERON_SCHEDULE.sleep) return 'asleep';
  const plan = heronPlan(today);
  const index = plan.findIndex((l) => time < l.to);
  const leg = plan[index < 0 ? plan.length - 1 : index];
  if (leg.kind === 'hunt') return 'hunting';
  if (leg.kind === 'rest') return 'resting';
  return index === 0 ? 'out' : index < 0 || index === plan.length - 1 ? 'home' : 'between';
}
/** 0 on the bank or the ice, 1 in the shallows; on a thaw day, 1 only past the thin rim of ice. */
function heronWade(today: number, p: Point) {
  const groundDay = groundDayOf(today);
  const { stage } = iceOn(groundDay);
  if (stage === 'freezing' || stage === 'frozen') return 0;
  const wade = smooth((shoreDistance(p) - 0.05) / 0.14);
  return stage === 'thawing'
    ? Math.min(wade, smooth((screenShoreDistance(p) - iceRim(groundDay) - 2) / 8))
    : wade;
}
export function heronAt(minutes: number, day: number): HeronState | null {
  const { today, time } = moment(minutes, day);
  const home = heronHome(today);
  let opacity = 1;
  // It fades at its roost, fast asleep, across the midnights the pond freezes over and opens.
  if (time >= 1430 && heronHome(today + 1) !== home)
    opacity = home ? 1 - smooth((time - 1430) / 20) : smooth((time - 1430) / 20);
  else if (time < 10 && heronHome(today - 1) !== home)
    opacity = home ? smooth((time + 10) / 20) : 1 - smooth((time + 10) / 20);
  else if (!home) return null;
  if (opacity <= 0) return null;
  const core = heronCore(today, time);
  let look = 0;
  if (core.pose !== 'sleep')
    for (const rise of fishRisesAt(time, today)) {
      const away = distance(rise.position, core.position);
      if (!rise.leap || away > 2) continue;
      const turn =
        Math.sin(Math.PI * rise.progress) *
        Math.min(1, 2 * (1 - away / 2)) *
        (rise.position.x - rise.position.y > core.position.x - core.position.y ? 1 : -1);
      if (Math.abs(turn) > Math.abs(look)) look = turn;
    }
  const wade = heronWade(today, core.position);
  return { ...core, wading: wade > 0.5, wade, look, opacity };
}

// ---------------------------------------------------------------------------------------------
// Rowboats: moored at the jetty from Spring 10, rowed out 08:30–18:30 from Summer 1 to Autumn 6,
// and turned over on the west bank from Autumn 21 to Spring 9.

export type PondBoat = {
  id: number;
  position: Point;
  /** The bow's direction in tile space: atan2(dy, dx). */
  heading: number;
  state: 'out' | 'moored' | 'stored';
  /** 0..1 through a stroke while out; 0 otherwise. */
  oar: number;
  rower: boolean;
  opacity: number;
  rowerOpacity: number;
};
/** Each boat's rowing loop (it rows it with θ decreasing, entering at `entry`). */
export const BOAT_LOOPS = [
  { x: 16.2, y: 32.4, rx: 1.45, ry: 0.75, omega: 0.15, entry: 0 },
  { x: 20.3, y: 32.55, rx: 1.1, ry: 0.75, omega: 0.19, entry: Math.PI / 2 },
] as const;
/** Moored on the jetty's east side, bows to the shore. */
export const BOAT_MOORINGS: readonly Point[] = [
  { x: 18.85, y: 35.3 },
  { x: 19.35, y: 35.45 },
];
/**
 * Clear water north of each berth, where a boat turns on its way out and in. Boat 0's lies
 * straight up from its berth, so coming home it glides in beside boat 1 without closing on it.
 */
const BOAT_STAGING: readonly Point[] = [
  { x: 18.85, y: 34.35 },
  { x: 19.45, y: 34.5 },
];
/** Turned over on the west bank beside the mill, out of every walker's way: a tidy, square pair. */
export const BOAT_STORE: readonly (Point & { heading: number })[] = [
  { x: 10.95, y: 35.7, heading: 0 },
  { x: 11.05, y: 36.25, heading: 0.08 },
];
/** A hull's footprint in its own frame (bow +u, port +v), tiles: what the art draws. */
export const BOAT_HULL = { bow: 0.46, stern: -0.42, beam: 0.19 } as const;
/**
 * Push-off: each boat backs straight out, stern first, for `back` minutes and `distance` tiles,
 * then swings its bow round (boat 0 through west, away from boat 1; boat 1 through east) on the
 * way to its staging point, four minutes in all.
 */
const PUSH_OFF = { distance: 0.85, back: 2.4, turn: [1, -1] } as const;
/** Out on the water, push-off to moored again. The glides take ten minutes at either end. */
export const BOAT_TIMES = [
  { out: 510, back: 1110 },
  { out: 525, back: 1095 },
] as const;
export const BOAT_SEASON = { moored: 9, out: 28, lastOut: 61, stored: 76 } as const;
const GLIDE = 10;
const MOORED_HEADING = Math.PI / 2;
const boatsStored = (groundDay: number) =>
  groundDay >= BOAT_SEASON.stored || groundDay < BOAT_SEASON.moored;
function loopAt(id: number, theta: number) {
  const loop = BOAT_LOOPS[id];
  const velocity = {
    x: loop.rx * loop.omega * Math.sin(theta),
    y: -loop.ry * loop.omega * Math.cos(theta),
  };
  return {
    position: { x: loop.x + loop.rx * Math.cos(theta), y: loop.y + loop.ry * Math.sin(theta) },
    velocity,
    heading: Math.atan2(velocity.y, velocity.x),
  };
}
function boatOut(id: number, time: number) {
  const { out, back } = BOAT_TIMES[id];
  const loop = BOAT_LOOPS[id];
  const berth = BOAT_MOORINGS[id],
    staging = BOAT_STAGING[id];
  const loopFrom = out + GLIDE,
    loopTo = back - GLIDE;
  const onLoop = (at: number) => loopAt(id, loop.entry - loop.omega * (at - loopFrom));
  const clear = { x: berth.x, y: berth.y - PUSH_OFF.distance };
  if (time < out + PUSH_OFF.back)
    // Stern first, straight out along the jetty, the bow still to the shore.
    return {
      position: lerp(berth, clear, smooth((time - out) / PUSH_OFF.back)),
      heading: MOORED_HEADING,
    };
  if (time < out + 4) {
    // Clear of the other boat, swing the bow round while easing on to the staging point,
    // arriving with the loop leg's own heading (north) and speed (0.25 tiles a minute).
    const span = 4 - PUSH_OFF.back;
    const u = (time - out - PUSH_OFF.back) / span;
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1,
      h01 = 3 * u ** 2 - 2 * u ** 3,
      h11 = u ** 3 - u ** 2;
    return {
      position: {
        x: h00 * clear.x + h01 * staging.x,
        y: h00 * clear.y + h01 * staging.y - 0.25 * span * h11,
      },
      heading: MOORED_HEADING + PUSH_OFF.turn[id] * Math.PI * smooth(u),
    };
  }
  if (time < loopFrom) {
    const entry = onLoop(loopFrom);
    return bezier(
      staging,
      { x: staging.x, y: staging.y - 0.5 },
      { x: entry.position.x - 2 * entry.velocity.x, y: entry.position.y - 2 * entry.velocity.y },
      entry.position,
      (time - out - 4) / 6,
    );
  }
  if (time < loopTo) {
    const at = onLoop(time);
    return { position: at.position, heading: at.heading };
  }
  if (time < loopTo + 6) {
    const leave = onLoop(loopTo);
    return bezier(
      leave.position,
      { x: leave.position.x + 2 * leave.velocity.x, y: leave.position.y + 2 * leave.velocity.y },
      { x: staging.x, y: staging.y - 0.5 },
      staging,
      (time - loopTo) / 6,
    );
  }
  const u = (time - loopTo - 6) / 4;
  return { position: lerp(staging, berth, 1 - (1 - u) * (1 - u)), heading: MOORED_HEADING };
}
export function boatsAt(minutes: number, day: number): PondBoat[] {
  const { today, time } = moment(minutes, day);
  const groundDay = groundDayOf(today);
  const stored = boatsStored(groundDay);
  // Put away and brought back at midnight, fading out and in over 23:50–00:10.
  let opacity = 1;
  if (time < 10 && boatsStored(groundDayOf(today - 1)) !== stored) opacity = smooth(time / 10);
  else if (time >= 1430 && boatsStored(groundDayOf(today + 1)) !== stored)
    opacity = smooth((1440 - time) / 10);
  const rowing = groundDay >= BOAT_SEASON.out && groundDay <= BOAT_SEASON.lastOut;
  return BOAT_MOORINGS.map((berth, id): PondBoat => {
    if (stored) {
      const store = BOAT_STORE[id];
      return {
        id,
        position: { x: store.x, y: store.y },
        heading: store.heading,
        state: 'stored',
        oar: 0,
        rower: false,
        opacity,
        rowerOpacity: 0,
      };
    }
    const { out, back } = BOAT_TIMES[id];
    if (rowing && time >= out && time < back) {
      const rowerOpacity =
        time < out + GLIDE
          ? smooth((time - out) / GLIDE)
          : 1 - smooth((time - back + GLIDE) / GLIDE);
      return {
        id,
        ...boatOut(id, time),
        state: 'out',
        oar: mod((time - out) / 1.2, 1),
        rower: rowerOpacity > 0,
        opacity,
        rowerOpacity,
      };
    }
    return {
      id,
      position: berth,
      heading: MOORED_HEADING,
      state: 'moored',
      oar: 0,
      rower: false,
      opacity,
      rowerOpacity: 0,
    };
  });
}
const boatPositionsAt = (absolute: number) => {
  const today = Math.floor(absolute / 1440);
  return boatsAt(absolute - today * 1440, today).map((boat) => boat.position);
};

// ---------------------------------------------------------------------------------------------
// Rising fish: rings on open water from 06:00, one in three a leap, busiest at dusk (18:30–20:30
// about one every half minute, two or three rings at once), and a few quiet rings under the moon
// until 23:00.

export type FishRise = {
  /** The town minute of its slot, plus 0.5 for a slot's second, dusk-only rise. */
  id: number;
  position: Point;
  leap: boolean;
  /** 0..1 through the rise's 1.2 minutes. */
  progress: number;
  /** Which way a leap carries the fish on screen: −1 to the left, +1 to the right. */
  side: 1 | -1;
  /** Where a leaping fish drops back in: 8 world px to `side` along the rise's screen row. */
  landing: Point;
};
export const FISH_RISE = {
  from: 360,
  dusk: 1110,
  night: 1230,
  leaps: 1290,
  until: 1380,
  lasts: 1.2,
} as const;
/** The chance that a town minute's first rise happens (open water only). */
function firstRiseChance(time: number) {
  if (time < FISH_RISE.from || time >= FISH_RISE.until) return 0;
  if (time < FISH_RISE.dusk - 30) return 0.33;
  if (time < FISH_RISE.dusk) return 0.33 + (0.67 * (time - FISH_RISE.dusk + 30)) / 30;
  if (time < FISH_RISE.night) return 1;
  if (time < FISH_RISE.leaps) return 1 - (0.7 * (time - FISH_RISE.night)) / 60;
  return 0.15;
}
/** The chance of a second rise half a minute into the slot: only around dusk. */
const secondRiseChance = (time: number) =>
  time < FISH_RISE.dusk - 30 || time >= FISH_RISE.leaps
    ? 0
    : clamp01((firstRiseChance(time) - 0.33) / 0.67);
/** Rises a town minute brings on open water: 0.33 by day, 2 at dusk, 0.15 under the moon. */
export const fishRiseRate = (time: number) => firstRiseChance(time) + secondRiseChance(time);
const JETTY_BOX = {
  left: MILLPOND_JETTY.x - MILLPOND_JETTY.width / 2,
  right: MILLPOND_JETTY.x + MILLPOND_JETTY.width / 2,
  top: MILLPOND_JETTY.to,
  bottom: MILLPOND_JETTY.from,
};
/** Distance from a point to the jetty's deck (0 on it). */
export const jettyDistance = (p: Point) =>
  Math.hypot(
    Math.max(JETTY_BOX.left - p.x, 0, p.x - JETTY_BOX.right),
    Math.max(JETTY_BOX.top - p.y, 0, p.y - JETTY_BOX.bottom),
  );
/**
 * The mill's screen silhouette (world px), the one outline the art and every rule share: the
 * convex hull of the painted mill (walls to the eaves at 50 px, the ridge along x at its full
 * height) with a 2 px margin on top. Convex; the inside lies to the right of each edge in screen
 * space (y down).
 */
export const MILL_SILHOUETTE: readonly Point[] = (() => {
  const { left, right, top, bottom, height } = MILLPOND_MILL;
  const at = (x: number, y: number, rise: number) => {
    const s = project(x, y);
    return { x: s.x, y: s.y - rise };
  };
  const ridge = (top + bottom) / 2;
  return [
    at(left, bottom, 0),
    at(right, bottom, 0),
    at(right, top, 0),
    at(right, top, 52),
    at(right, ridge, height + 2),
    at(left, ridge, height + 2),
    at(left, bottom, 52),
  ];
})();
/** Whether a screen point comes within `margin` px of the mill's silhouette. */
export function nearMillSilhouette(s: Point, margin = 0) {
  for (let i = 0; i < MILL_SILHOUETTE.length; i++) {
    const a = MILL_SILHOUETTE[i],
      b = MILL_SILHOUETTE[(i + 1) % MILL_SILHOUETTE.length];
    const edge = Math.hypot(b.x - a.x, b.y - a.y);
    if (((b.x - a.x) * (s.y - a.y) - (b.y - a.y) * (s.x - a.x)) / edge > margin) return false;
  }
  return true;
}
/** A screen point inside (or on the edge of) the mill's silhouette. */
export const behindMill = (s: Point) => nearMillSilhouette(s, 0);
/** A patch of water whose ring or leaping fish the mill's walls and roof would cover. */
export const hiddenByMill = (p: Point) => nearMillSilhouette(project(p.x, p.y), 16);
type RiseSlot = Omit<FishRise, 'progress'> & { start: number };
const riseSlots = new Map<number, RiseSlot | null>();
/** A leap's splash-down: 8 world px along its screen row, (+4, −4)/38 tiles for each px pair. */
const landingOf = (p: Point, side: 1 | -1): Point => ({
  x: p.x + (side * 4) / 38,
  y: p.y - (side * 4) / 38,
});
/**
 * The rise a town minute brings, if any, or with `second` the dusk rise half a minute into it:
 * a pure function of that minute. Second rises also keep 0.8 tiles from the first rises they
 * share the water with, so two rings never run into each other.
 */
function riseInSlot(slot: number, second = false): RiseSlot | null {
  return memo(riseSlots, second ? slot + 0.5 : slot, () => {
    const today = Math.floor(slot / 1440),
      time = slot - today * 1440;
    const chance = second ? secondRiseChance(time) : firstRiseChance(time);
    if (chance <= 0) return null;
    const r = (key: string) => seeded(`rise:${slot}:${second ? 'b' : ''}${key}`);
    if (!openWaterOn(today) || r('p') >= chance) return null;
    const start = slot + (second ? 0.5 : 0) + 0.2 * r('o');
    const samples = [0, 0.3, 0.6, 0.9, 1.2].map((dt) => start + dt);
    const herons = samples.map(heronPositionAt);
    const boats = samples.flatMap(boatPositionsAt);
    const rings = second
      ? [riseInSlot(slot), riseInSlot(slot + 1)].flatMap((rise) => (rise ? [rise.position] : []))
      : [];
    const side: 1 | -1 = second ? (r('side') < 0.5 ? 1 : -1) : slot % 2 ? 1 : -1;
    for (let attempt = 0; attempt < 10; attempt++) {
      const position = {
        x: 10.6 + 13.6 * r(`x${attempt}`),
        y: 31.0 + 5.1 * r(`y${attempt}`),
      };
      if (
        shoreDistance(position) < 0.5 ||
        jettyDistance(position) < 0.5 ||
        hiddenByMill(position) ||
        hiddenByMill(landingOf(position, side)) ||
        herons.some((h) => distance(h, position) < 0.65) ||
        boats.some((b) => distance(b, position) < 0.65) ||
        rings.some((ring) => distance(ring, position) < 0.8)
      )
        continue;
      return {
        id: second ? slot + 0.5 : slot,
        position,
        leap: time < FISH_RISE.leaps && r('leap') < 1 / 3,
        side,
        landing: landingOf(position, side),
        start,
      };
    }
    return null;
  });
}
export function fishRisesAt(minutes: number, day: number): FishRise[] {
  const { absolute } = moment(minutes, day);
  const rises: FishRise[] = [];
  for (let slot = Math.floor(absolute - FISH_RISE.lasts - 1); slot <= Math.floor(absolute); slot++)
    for (const rise of [riseInSlot(slot), riseInSlot(slot, true)]) {
      if (!rise || absolute < rise.start || absolute >= rise.start + FISH_RISE.lasts) continue;
      const { start, ...shown } = rise;
      rises.push({ ...shown, progress: (absolute - start) / FISH_RISE.lasts });
    }
  return rises;
}

// ---------------------------------------------------------------------------------------------
// The early fisher: scenery on the jetty's end at dawn on open-water days (never a resident).

export type PondFisher = {
  position: Point;
  /** How far the line is out: 0 rod up, 1 bobber on the water. */
  cast: number;
  /** 0..1..0 around the morning's one bite (the bobber dips 2 px, one ripple). */
  bite: number;
  /** 0..1 landing a small fish after the bite (1 in 3 mornings); it stays 1 once landed. */
  catch: number;
  opacity: number;
};
export const FISHER = { from: 330, to: 420, fade: 5 } as const;
export const FISHER_SEAT: Point = { x: MILLPOND_JETTY.x, y: MILLPOND_JETTY.to + 0.12 };
export function fisherAt(minutes: number, day: number): PondFisher | null {
  const { today, time } = moment(minutes, day);
  if (time <= FISHER.from || time >= FISHER.to || !openWaterOn(today)) return null;
  const opacity = smooth(Math.min(time - FISHER.from, FISHER.to - time) / FISHER.fade);
  const bite = 345 + 55 * seeded(`fisher:${today}:bite`);
  const landed = hash(`millpond:fisher:${today}`) % 3 === 0;
  const castOut = smooth((time - 336) / 2) * (1 - smooth((time - 412) / 2));
  const reeling = landed ? smooth((time - bite - 0.5) / 2) : 0;
  const recast = landed ? smooth((time - bite - 5) / 2) : 0;
  return {
    position: FISHER_SEAT,
    cast: castOut * (1 - reeling + recast),
    bite: Math.max(0, 1 - Math.abs(time - bite) / 0.6),
    catch: reeling,
    opacity,
  };
}

// ---------------------------------------------------------------------------------------------
// Two scenery skaters on the east-cove ice during the skating session.

export type Facing = 'ne' | 'nw' | 'se' | 'sw';
export type SceneSkater = {
  id: number;
  position: Point;
  facing: Facing;
  /** 0..1 stride phase (walkPhase for drawResident's skate pose). */
  phase: number;
  opacity: number;
};
const SCENERY_LAP = [9.5, 11] as const;
// Same convention as walking.ts facingAlong: +x faces se, −x nw, +y sw, −y ne.
const facingOf = (dx: number, dy: number): Facing =>
  Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'se' : 'nw') : dy >= 0 ? 'sw' : 'ne';
export function sceneSkatersAt(minutes: number, day: number): SceneSkater[] {
  const { absolute, today, time } = moment(minutes, day);
  if (time <= SKATING.start || time >= SKATING.end || !millpondSkatingDay(today)) return [];
  const opacity = smooth(Math.min(time - SKATING.start, SKATING.end - time) / 5);
  return SCENERY_SKATE_LOOPS.map((loop, id) => {
    const turns = mod(absolute / SCENERY_LAP[id], 1);
    const direction = id % 2 === 0 ? 1 : -1;
    const theta = TAU * (seeded(`skater:${id}`) + direction * turns);
    const dx = -direction * loop.rx * Math.sin(theta),
      dy = direction * loop.ry * Math.cos(theta);
    return {
      id,
      position: { x: loop.x + loop.rx * Math.cos(theta), y: loop.y + loop.ry * Math.sin(theta) },
      facing: facingOf(dx, dy),
      phase: mod(turns * 5, 1),
      opacity,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Dawn mist, the waterwheel and the winter secret.

/** A bell over 05:30–07:00 peaking at 06:15; half as thick over ice. */
export function mistAt(minutes: number, day: number): number {
  const { today, time } = moment(minutes, day);
  if (time <= 330 || time >= 420) return 0;
  const bell = (1 - Math.cos((TAU * (time - 330)) / 90)) / 2;
  return openWaterOn(today) ? bell : bell / 2;
}
export function wheelAngleAt(minutes: number, day: number): number | null {
  if (iceOn(millpondGroundDay(minutes, day)).stage !== 'open') return null;
  const absolute = day * 1440 + minutes;
  return ((((absolute / 6) % 1) + 1) % 1) * Math.PI * 2;
}
export const ICE_SECRET = {
  season: 3,
  dates: [14, 15, 16],
  start: 180,
  crack: 4,
  duration: 90,
} as const;
export type IceSecret = {
  /** 0..1 of the crack drawn, spreading from the jetty end over the first four minutes. */
  crack: number;
  /** The glint's alpha before `opacity`: 0 until the crack is done, then 0.3–0.85 on a 5-minute pulse. */
  glint: number;
  /** 1, easing to 0 over the last eight minutes. */
  opacity: number;
  /** Minutes since 03:00. */
  phase: number;
};
export function iceSecretAt(minutes: number, day: number): IceSecret | null {
  const { today, time } = moment(minutes, day);
  const elapsed = time - ICE_SECRET.start;
  if (elapsed < 0 || elapsed >= ICE_SECRET.duration) return null;
  // Whole-day almanac lookup: no floating-point hair at midnight.
  const { seasonIndex, date } = townCalendarAt(today, 0);
  if (seasonIndex !== ICE_SECRET.season || !(ICE_SECRET.dates as readonly number[]).includes(date))
    return null;
  const pulse = (1 - Math.cos((TAU * (elapsed - ICE_SECRET.crack)) / 5)) / 2;
  return {
    crack: smooth(elapsed / ICE_SECRET.crack),
    glint:
      elapsed < ICE_SECRET.crack
        ? 0
        : smooth((elapsed - ICE_SECRET.crack) / 1.5) * (0.3 + 0.55 * pulse),
    opacity: 1 - smooth((elapsed - ICE_SECRET.duration + 8) / 8),
    phase: elapsed,
  };
}

// ---------------------------------------------------------------------------------------------
// The water's seasons, in one place for the art and the panel: the lily pads and flowers, the
// spring petals and the autumn leaves. The art paints exactly these, so the copy never promises
// a pad, a petal or a leaf the pond is not showing.

/** Seasonal outer windows (whole days of the year); the tables below say what is actually out. */
export const MILLPOND_SEASON = {
  petals: { from: 14, to: 27 },
  leaves: { from: 69, to: 85 },
  lilies: { from: 20, to: 77 },
} as const;
const nearJettyDeck = (p: Point, margin: number) =>
  p.x > JETTY_BOX.left - margin &&
  p.x < JETTY_BOX.right + margin &&
  p.y > JETTY_BOX.top - margin &&
  p.y < JETTY_BOX.bottom + margin;
/** Open water for flat art: `inset` tiles deep, clear of the jetty deck, not hidden by the mill. */
export const openPondWater = (p: Point, inset: number) =>
  shoreDistance(p) >= inset && !nearJettyDeck(p, 0.12) && !behindMill(project(p.x, p.y));
/** Seeded points on open water, found in a fixed order, so every build agrees. */
export function pondWaterPoints(key: string, count: number, inset: number) {
  const G = MILLPOND_GROUND;
  const found: { tile: Point; seed: number }[] = [];
  for (let i = 0; found.length < count && i < 2000; i++) {
    const seed = hash(`millpond:${key}:${i}`);
    const tile = {
      x: G.left + 0.2 + groundFraction(seed, 1) * (G.right - G.left - 0.4),
      y: G.top + 0.2 + groundFraction(seed, 2) * (G.bottom - G.top - 0.4),
    };
    if (openPondWater(tile, inset)) found.push({ tile, seed });
  }
  return found;
}
/** Lily beds in the calm corners: the west bay, under the north-west bank, the south shallows,
 * and among the heron's reeds. */
export const LILY_BEDS: readonly Point[] = [
  { x: 11.2, y: 33.3 },
  { x: 12.3, y: 31.4 },
  { x: 16.6, y: 35.5 },
  { x: 21.5, y: 35.7 },
  { x: 23.1, y: 32.2 },
];
export type LilyPad = {
  position: Point;
  seed: number;
  /** Half-width in px. */
  size: number;
  /** Whole days of the year the pad floats, inclusive. */
  from: number;
  until: number;
  /** Whether it flowers, and the days it is in flower (inclusive). */
  flower: boolean;
  bloom: number;
  fade: number;
};
/** Pads open over early summer and go by the end of Autumn 21; some flower in midsummer. */
export const MILLPOND_LILIES: readonly LilyPad[] = LILY_BEDS.flatMap((bed, b) =>
  Array.from({ length: 5 }, (_, i): LilyPad[] => {
    const seed = hash(`millpond:lily:${b}:${i}`);
    const position = {
      x: bed.x + (groundFraction(seed, 1) - 0.5) * 1.1,
      y: bed.y + (groundFraction(seed, 2) - 0.5) * 0.6,
    };
    if (shoreDistance(position) < 0.12 || nearJettyDeck(position, 0.2)) return [];
    return [
      {
        position,
        seed,
        size: 3 + (seed % 3),
        from: 20 + Math.floor(groundFraction(seed, 3) * 8),
        until: 66 + Math.floor(groundFraction(seed, 4) * 11),
        flower: seed % 3 === 0,
        bloom: 30 + Math.floor(groundFraction(seed, 5) * 6),
        fade: 46 + Math.floor(groundFraction(seed, 6) * 8),
      },
    ];
  }).flat(),
);
/** The lily pads floating on a whole day of the year (none on ice). */
export const lilyPadsOn = (groundDay: number) =>
  iceOn(groundDay).stage !== 'open'
    ? []
    : MILLPOND_LILIES.filter((pad) => groundDay >= pad.from && groundDay <= pad.until);
/** The pads in flower that day. */
export const lilyFlowersOn = (groundDay: number) =>
  lilyPadsOn(groundDay).filter(
    (pad) => pad.flower && groundDay >= pad.bloom && groundDay <= pad.fade,
  );
/** Drifting blossom petals the art keeps (it shows the first `petalCountAt` of them). */
export const PETAL_DRIFTERS = 14;
/** Petals afloat at a fractional day of the year: in over 36 hours from Spring 15, out by Spring 28. */
export function petalCountAt(yearDay: number) {
  const { from, to } = MILLPOND_SEASON.petals;
  if (yearDay < from || yearDay >= to) return 0;
  return Math.floor(PETAL_DRIFTERS * clamp01(Math.min(yearDay - from, to - yearDay) / 1.5));
}
/** Fallen leaves: where each lands on the water, and the fractional day of the year it does. */
export const MILLPOND_LEAVES: readonly { position: Point; seed: number; lands: number }[] =
  pondWaterPoints('leaf', 18, 0.5).map(({ tile, seed }) => ({
    position: tile,
    seed,
    lands: MILLPOND_SEASON.leaves.from + groundFraction(seed, 7) * 10,
  }));
/** Leaves on the water at a fractional day of the year (they fade out over Winter 0.5–1). */
export function leafCountAt(yearDay: number) {
  const { from, to } = MILLPOND_SEASON.leaves;
  if (yearDay < from || yearDay >= to) return 0;
  return MILLPOND_LEAVES.filter((leaf) => yearDay >= leaf.lands).length;
}
/** How strongly the floating leaves still show (1, fading to 0 over the last day and a half). */
export function leafFadeAt(yearDay: number) {
  const { from, to } = MILLPOND_SEASON.leaves;
  if (yearDay < from || yearDay >= to) return 0;
  return clamp01((to - yearDay) / 1.5);
}

export type MillpondStatus = {
  ice: IceStage;
  skating: null | { live: boolean; start: number; end: number };
  boats: 'out' | 'moored' | 'stored';
  heron: null | 'hunting' | 'resting' | 'asleep';
  fishRising: boolean;
  fisher: boolean;
  /** At least one petal, leaf or lily pad is painted on the water at this instant. */
  petals: boolean;
  leaves: boolean;
  lilies: boolean;
  /** At least one painted lily pad is in flower. */
  flowers: boolean;
  /** Dawn mist thick enough to see (`mistAt > 0.2`). */
  mist: boolean;
  /** How many boats are out on the water (0 when moored or stored). */
  boatsOut?: number;
  /** Set only while the heron walks: out of the reeds at dawn, home at night, or between spots. */
  heronWalking?: 'out' | 'home' | 'between';
};
export function millpondStatusAt(minutes: number, day: number): MillpondStatus {
  const { today, time } = moment(minutes, day);
  const groundDay = groundDayOf(today);
  const yearDay = yearDayAt(today, time);
  const ice = iceOn(groundDay).stage;
  const heron = heronAt(time, today);
  const doing = heron && heron.pose !== 'sleep' ? heronDoing(today, time) : 'asleep';
  const boats = boatsAt(time, today);
  const boatsOut = boats.filter((b) => b.state === 'out').length;
  return {
    ice,
    skating: millpondSkatingDay(today)
      ? {
          live: time >= SKATING.start && time < SKATING.end,
          start: SKATING.start,
          end: SKATING.end,
        }
      : null,
    boats: boatsOut > 0 ? 'out' : boats[0].state,
    heron: !heron ? null : doing === 'hunting' || doing === 'asleep' ? doing : 'resting',
    fishRising: ice === 'open' && time >= FISH_RISE.dusk && time < FISH_RISE.night,
    fisher: fisherAt(time, today) !== null,
    petals: ice === 'open' && petalCountAt(yearDay) > 0,
    // Only while the leaves still read on the water, not through their last faint hours.
    leaves: ice === 'open' && leafCountAt(yearDay) > 0 && leafFadeAt(yearDay) >= 0.3,
    lilies: lilyPadsOn(groundDay).length > 0,
    flowers: lilyFlowersOn(groundDay).length > 0,
    mist: mistAt(time, today) > 0.2,
    boatsOut,
    ...(heron?.pose === 'walk' && (doing === 'out' || doing === 'home' || doing === 'between')
      ? { heronWalking: doing }
      : {}),
  };
}

/** The line across the ice to the mill-side loop: a walker's feet stay above the mill's roof. */
export const MILL_CROSSING_Y = 33.2;
// Skating itinerary: in at the south gate and along the shore path, then up the loop's own
// column. The mill-side loop is reached across the ice from loop 1's column instead, so its
// skater never walks behind the mill.
export function millpondRoute(seat: number): Point[] {
  const loop = loopForSeat(seat);
  const shore = { x: MILLPOND_GATE.x, y: SHORE_Y };
  if (loop.x < MILLPOND_MILL.right) {
    const via = SKATE_LOOPS[1];
    return [
      MILLPOND_GATE,
      shore,
      { x: via.x, y: SHORE_Y },
      { x: via.x, y: MILL_CROSSING_Y },
      { x: loop.x, y: MILL_CROSSING_Y },
      { x: loop.x, y: loop.y + loop.ry },
    ];
  }
  return [MILLPOND_GATE, shore, { x: loop.x, y: SHORE_Y }, { x: loop.x, y: loop.y + loop.ry }];
}
const PERIMETER = 5.213; // of the 0.95 × 0.7 ellipse, in tiles
/** Whole laps only, starting and ending on the loop's south point; peak speed ≤ 0.435 tiles a minute. */
export function skateGlide(seat: number, from: number, until: number, time: number) {
  const loop = loopForSeat(seat);
  const span = Math.max(1e-9, until - from);
  const laps = Math.max(1, Math.floor((span * 0.38) / PERIMETER));
  const progress = Math.max(0, Math.min(1, (time - from) / span));
  const theta = Math.PI / 2 + Math.PI * 2 * laps * progress;
  const position = { x: loop.x + loop.rx * Math.cos(theta), y: loop.y + loop.ry * Math.sin(theta) };
  const dx = -loop.rx * Math.sin(theta),
    dy = loop.ry * Math.cos(theta);
  return { position, facing: facingOf(dx, dy), walkPhase: (laps * progress * 4) % 1 };
}
