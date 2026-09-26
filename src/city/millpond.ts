import {
  MILLPOND_GROUND as G,
  MILLPOND_JETTY as JETTY,
  MILLPOND_LEAVES,
  MILLPOND_MILL as MILL,
  MILLPOND_REEDS,
  MILLPOND_SIGN,
  MILLPOND_WATER,
  PETAL_DRIFTERS,
  SHORE_Y,
  SKATE_LOOPS,
  behindMill,
  boatsAt,
  fishRisesAt,
  fisherAt,
  heronAt,
  iceOn,
  iceSecretAt,
  insideWater,
  leafCountAt,
  leafFadeAt,
  lilyFlowersOn,
  lilyPadsOn,
  mistAt,
  openPondWater,
  petalCountAt,
  pondWaterPoints,
  sceneSkatersAt,
  shoreDistance,
  wheelAngleAt,
} from '../lib/millpond';
import { DEFAULT_RESIDENT, type Place } from '../lib/schema';
import { groundFraction, seedFraction, snowAt, type TownSeason } from '../lib/seasons';
import { moonSlice, townSkyAt } from '../lib/town-calendar';
import { hash, project, unproject, type Point } from '../lib/world';
import { lampBlocksGoal } from './football';
import { LIGHT } from './glow';
import { LAMPS, lampOn } from './lamplight';
import { drawResident } from './residents';
import { groundTuft } from './season-ground';
import {
  BLOSSOM,
  FALLEN_LEAVES,
  ICE,
  POND,
  REED,
  SNOW,
  mixHex,
  pick,
  type Pair,
} from './season-palette';
import { drawVenueTitle } from './venue-title';

// The Millpond in three layers, like the farm and the zoo:
//  1. drawMillpondGround: bank, path, water or the day's ice, lily pads and the jetty deck. It is
//     painted into the cached ground layer, so it reads only `night` and the season's whole day.
//  2. drawMillpondSurface: flat, per frame, straight onto the water: glints, the moon and the
//     lamps in the water, the lanterns' glimmer, fish rings, wakes, petals, leaves, mist and the
//     one winter secret. Painted before the depth sort, so everyone standing on the banks stays
//     in front of it.
//  3. drawMillpond: upright depth objects: reeds, posts, boats, the fisher, the heron, leaping
//     fish, skaters, the mill, its wheel and the gate sign.
// Everything keeps the football in view (spec rules 1-3): nothing rises over the road in front
// of the pitch or the west road, and only the mill is taller than 40 px, left of the football
// panel's frame. The pond never paints a glow, and its only amber is reflected light.

type Ctx = CanvasRenderingContext2D;
type Visible = (point: Point, rx: number, above: number, below: number) => boolean;
type Resident = Place['resident'];
export type Heron = NonNullable<ReturnType<typeof heronAt>>;
export type Boat = ReturnType<typeof boatsAt>[number];
export type Fisher = NonNullable<ReturnType<typeof fisherAt>>;
export type Rise = ReturnType<typeof fishRisesAt>[number];
export type Skater = ReturnType<typeof sceneSkatersAt>[number];
export type Secret = NonNullable<ReturnType<typeof iceSecretAt>>;
type Ice = ReturnType<typeof iceOn>;

export type MillpondOptions = {
  minutes: number;
  day: number;
  night: boolean;
  season: TownSeason;
  selected: boolean;
  /** The frame's lantern count and register size, from the same lantern-hour clock. */
  litCount: number;
  total: number;
  visible: Visible;
};
export type MillpondPart =
  'reeds' | 'posts' | 'boats' | 'fisher' | 'heron' | 'fish' | 'skaters' | 'mill' | 'wheel' | 'sign';
/** A depth object, tagged with what it is and where it stands for the tests: `ground` is its
 * contact point and `slope` the screen slope of its footprint through it (0.5 along x for the
 * sign, -0.5 along y for the wheel, 0 for everything that stands on a point). */
export type MillpondObject = {
  depth: number;
  paint: () => void;
  part: MillpondPart;
  ground: Point;
  slope: number;
};

// ---------------------------------------------------------------------------------------------
// Small helpers

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const mod = (value: number, length: number) => ((value % length) + length) % length;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** A table built on first use, so importing the renderer costs nothing. */
function lazy<T>(build: () => T) {
  let value: T | undefined;
  return () => (value ??= build());
}
const at = (x: number, y: number, lift = 0): Point => {
  const p = project(x, y);
  return { x: p.x, y: p.y - lift };
};
function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function trace(ctx: Ctx, points: readonly Point[]) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}
function shape(ctx: Ctx, points: readonly Point[], color: string) {
  trace(ctx, points);
  ctx.fillStyle = color;
  ctx.fill();
}
/** An ellipse drawn in tile space (axis-aligned there, radii in tiles) as the screen ellipse it
 * projects to, so it can be stroked 1 px wide: its centre, radii, rotation, and the angle to add
 * to a tile-space angle to get the screen ellipse's own. */
function tileEllipse(x: number, y: number, rx: number, ry: number) {
  // The projection times diag(rx, ry), split into rotation · scale · rotation.
  const a = 38 * rx,
    b = -38 * ry,
    c = 19 * rx,
    d = 19 * ry;
  const E = (a + d) / 2,
    F = (a - d) / 2,
    G = (c + b) / 2,
    H = (c - b) / 2;
  const Q = Math.hypot(E, H),
    R = Math.hypot(F, G);
  const a1 = Math.atan2(G, F),
    a2 = Math.atan2(H, E);
  const centre = project(x, y);
  return { ...centre, rx: Q + R, ry: Q - R, rotation: (a2 + a1) / 2, shift: (a2 - a1) / 2 };
}
/** Adds a tile-space elliptical arc to the path, starting a new subpath at its first point. */
function tileArc(
  ctx: Ctx,
  loop: { x: number; y: number; rx: number; ry: number },
  from: number,
  to: number,
) {
  const e = tileEllipse(loop.x, loop.y, loop.rx, loop.ry);
  const start = project(loop.x + loop.rx * Math.cos(from), loop.y + loop.ry * Math.sin(from));
  ctx.moveTo(start.x, start.y);
  ctx.ellipse(e.x, e.y, e.rx, e.ry, e.rotation, from + e.shift, to + e.shift);
}
function convexHull(points: readonly Point[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [],
    upper: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** How far anything may rise above the screen point (sx, sy) and stay below the north line (the
 * road in front of the pitch, `sy = 1102 + sx / 2`) and the west line (`sy = 342 - sx / 2`). */
export const headroom = (sx: number, sy: number) => Math.min(sy - 1102 - sx / 2, sy - 342 + sx / 2);
/** Uprights beside the north road keep walkers' feet clear: 38 px per tile beyond y = 29.6. */
const northRoad = (y: number) => 38 * (y - 29.6);

// ---------------------------------------------------------------------------------------------
// Fixed geometry

const WATER_PX = MILLPOND_WATER.map((p) => project(p.x, p.y));
const JETTY_LEFT = JETTY.x - JETTY.width / 2,
  JETTY_RIGHT = JETTY.x + JETTY.width / 2;
const nearJetty = (p: Point, margin: number) =>
  p.x > JETTY_LEFT - margin &&
  p.x < JETTY_RIGHT + margin &&
  p.y > JETTY.to - margin &&
  p.y < JETTY.from + margin;

/** The mill: stone to 22 px, timber to the eaves at 50 px, the ridge along x at 88 px. */
const BASE = 22,
  EAVE = 50,
  RIDGE = MILL.height,
  RIDGE_Y = (MILL.top + MILL.bottom) / 2;
export const MILL_DEPTH = (MILL.left + MILL.right) / 2 + RIDGE_Y;
export const WHEEL_DEPTH = MILL.wheel.x + MILL.wheel.y;

/** The screen row of open water through a screen point, as [left, right] world px. */
function rowThrough(s: Point, inset: number): [number, number] {
  const ok = (x: number) => openPondWater(unproject(x, s.y), inset);
  let left = s.x,
    right = s.x;
  while (left > -1100 && ok(left - 2)) left -= 2;
  while (right < 0 && ok(right + 2)) right += 2;
  return [left, right];
}
/** Drifting flat things: a screen row they slide along, entering and leaving at its ends. */
const drifters = (key: string, count: number, inset: number) =>
  pondWaterPoints(key, count, inset).map(({ tile, seed }) => {
    const s = project(tile.x, tile.y);
    const [left, right] = rowThrough(s, inset);
    return { y: Math.round(s.y), left, right, seed };
  });

// ---------------------------------------------------------------------------------------------
// Colours that are not seasonal: the mill, the boats, the heron, the jetty.

const MILL_COLOURS = {
  stone: ['#B9B4A2', '#6D7470'] as Pair,
  stoneSide: ['#A19C8B', '#5A615E'] as Pair,
  mortar: ['#9E9887', '#5A605C'] as Pair,
  mortarSide: ['#88836F', '#4B514E'] as Pair,
  timber: ['#A5825C', '#6A5A48'] as Pair,
  timberSide: ['#8E6F4E', '#584B3E'] as Pair,
  board: ['#8C6C4A', '#56493B'] as Pair,
  boardSide: ['#785B3E', '#4A3F34'] as Pair,
  beam: ['#6F5A41', '#4A4035'] as Pair,
  window: ['#3B4A45', '#26332F'] as Pair,
  frame: ['#CDB88F', '#7F7A68'] as Pair,
  door: ['#6A5238', '#453B30'] as Pair,
  roof: ['#6E7D74', '#44504C'] as Pair,
  roofLight: ['#7C8B82', '#505C57'] as Pair,
  course: ['#65746B', '#3E4945'] as Pair,
  trim: ['#8E9C92', '#5D6964'] as Pair,
  rim: ['#6E5638', '#4A3F33'] as Pair,
  paddle: ['#C9AE82', '#8A7A60'] as Pair,
  foam: ['#E6F1EE', '#9DBCC1'] as Pair,
  shadow: ['#2E433630', '#10201A40'] as Pair,
};
const WOOD = {
  deck: ['#B99D71', '#6F6754'] as Pair,
  deckGap: ['#9A8160', '#5A5446'] as Pair,
  deckSide: ['#86704F', '#4E4A3F'] as Pair,
  post: ['#7C6547', '#4B443A'] as Pair,
  postTop: ['#A48A64', '#686152'] as Pair,
  hull: ['#8E6A48', '#5B4E3E'] as Pair,
  hullInside: ['#B8905F', '#7C6A52'] as Pair,
  hullKeel: ['#A47E57', '#6A5B48'] as Pair,
  /** The planked side of an upturned boat, in shade. */
  hullSide: ['#7A5A3D', '#4F4437'] as Pair,
  thwart: ['#D0B283', '#8E7E62'] as Pair,
  oar: ['#C7AA7C', '#857559'] as Pair,
  rope: ['#CBBE98', '#7F7A66'] as Pair,
};
const HERON = {
  back: ['#8E989C', '#5A666A'] as Pair,
  wing: ['#AAB2B4', '#6E7A7D'] as Pair,
  flight: ['#3E464A', '#283236'] as Pair,
  neck: ['#DDE2DC', '#98A4A0'] as Pair,
  head: ['#F0F2EC', '#AEB9B5'] as Pair,
  belly: ['#C3C9C6', '#7E8A87'] as Pair,
  dark: ['#2B3134', '#1D2427'] as Pair,
  /** A dagger bill, muted ochre-grey: never amber. */
  bill: ['#A99C73', '#6E6B58'] as Pair,
  /** Dark enough to read against the water: the long legs are what say "heron". */
  leg: ['#6B6552', '#3A3E38'] as Pair,
  legFar: ['#57523F', '#30342F'] as Pair,
  shadow: ['#23341B25', '#0E1C1630'] as Pair,
};
const CATTAIL = ['#7C5E43', '#4B4038'] as Pair;
const CATTAIL_SEED = ['#C9BFA2', '#77766A'] as Pair;
/** The moon in the water keeps the sky moon's own cream. */
export const MOON_WATER = '#DFE6CF';
/** The lamps' light, reflected: the same amber as the lamp heads. */
export const LAMP_WATER = '#F4D79A';
/** The secret's cool glint under the ice: silver, never gold. */
export const SECRET_GLINT = '#DDEEF0';
const BOBBER = { body: '#F3EEDF', top: '#C25A4A' };
const SELECTION = '#F2E2A1';

// ---------------------------------------------------------------------------------------------
// Layer 1: the ground (cached; reads night and the season's whole day only)

type GroundState = {
  night: boolean;
  season?: TownSeason;
  day?: number;
  ice: Ice;
  water: string;
  waterLight: string;
};

// A deep middle, well inside the shallows.
const DEEP = (
  [
    [11.6, 32.0],
    [13.4, 31.7],
    [15.2, 31.6],
    [17.0, 31.2],
    [19.3, 31.1],
    [21.4, 31.4],
    [22.9, 31.9],
    [22.6, 32.9],
    [21.9, 34.0],
    [21.3, 35.2],
    [19.9, 35.1],
    [18.9, 34.5],
    [17.0, 34.45],
    [15.9, 33.9],
    [13.6, 33.9],
    [11.6, 33.8],
    [11.2, 32.9],
  ] as const
).map(([x, y]) => project(x, y));
// The seeded tables below are built on first use, so importing the renderer costs nothing.
const RIPPLES = lazy(() =>
  pondWaterPoints('ripple', 9, 0.9).map(({ tile, seed }) => {
    const p = project(tile.x, tile.y);
    return { x: Math.round(p.x), y: Math.round(p.y), w: 6 + (seed % 9) };
  }),
);
// Tufts on the banks, off the path and the mill.
const TUFTS = lazy(() => {
  const found: { x: number; y: number; seed: number }[] = [];
  for (let i = 0; found.length < 30 && i < 600; i++) {
    const seed = hash(`millpond:tuft:${i}`);
    const tile = {
      x: G.left + 0.15 + groundFraction(seed, 3) * (G.right - G.left - 0.3),
      y: G.top + 0.15 + groundFraction(seed, 4) * (G.bottom - G.top - 0.3),
    };
    const onPath = tile.y > SHORE_Y - 0.25 && tile.x > 14.5 && tile.x < 23.3;
    const onMill =
      tile.x > MILL.left - 0.2 &&
      tile.x < MILL.right + 0.4 &&
      tile.y > MILL.top - 0.3 &&
      tile.y < MILL.bottom + 0.2;
    const lane = tile.x > 17.1 && tile.x < 18.7 && tile.y > 35.8;
    if (shoreDistance(tile) < -0.15 && !onPath && !onMill && !lane) {
      const p = project(tile.x, tile.y);
      found.push({ x: Math.round(p.x), y: Math.round(p.y), seed });
    }
  }
  return found;
});
// Stones: at the gate landing, the mill door and along the banks.
const STONES = (
  [
    [17.25, 36.3, 5],
    [17.55, 36.15, 4],
    [18.75, 36.55, 4],
    [15.0, 36.3, 5],
    [15.25, 36.45, 3],
    [12.4, 35.1, 4],
    [10.4, 35.2, 5],
    [23.55, 34.25, 4],
    [24.6, 32.2, 5],
    [16.4, 30.2, 4],
  ] as const
).map(([x, y, size]) => ({ ...project(x, y), size }));
// Where the freezing starts: the shallow coves in the west bay, the east cove, by the wheel and
// in the heron's south shallows (tile centres and radii).
const COVE_PANS = [
  { x: 10.9, y: 33.2, r: 0.9 },
  { x: 23.4, y: 33.8, r: 1.0 },
  { x: 15.3, y: 35.3, r: 0.6 },
  { x: 21.8, y: 35.9, r: 0.7 },
] as const;
// The thaw's floes, each with its own shape.
const FLOES = (
  [
    [12.3, 32.5, 0.55],
    [14.6, 32.2, 0.5],
    [16.9, 31.6, 0.6],
    [19.6, 31.7, 0.55],
    [21.9, 32.2, 0.5],
    [17.4, 33.9, 0.55],
    [20.6, 34.2, 0.5],
  ] as const
).map(([x, y, r], i) => ({
  x,
  y,
  r,
  shape: Array.from(
    { length: 6 },
    (_, k) => 0.75 + groundFraction(hash(`millpond:floe:${i}`), k) * 0.5,
  ),
}));
const SNOW_PATCHES = lazy(() =>
  pondWaterPoints('snow', 9, 0.45).map(({ tile, seed }) => {
    const p = project(tile.x, tile.y);
    return {
      x: Math.round(p.x),
      y: Math.round(p.y),
      w: 12 + (seed % 14),
      when: groundFraction(seed, 9),
    };
  }),
);
const SHEEN = lazy(() =>
  pondWaterPoints('sheen', 8, 0.5).map(({ tile, seed }) => {
    const p = project(tile.x, tile.y);
    return { x: Math.round(p.x), y: Math.round(p.y), w: 10 + (seed % 18) };
  }),
);

export const MILLPOND_GROUND_PARTS = {
  /** The banks: a shadow at the mill's foot, its stone quay, the shore path, stones and tufts. */
  bank(ctx: Ctx, { night, season }: GroundState) {
    shape(
      ctx,
      [
        at(MILL.left - 0.12, MILL.top - 0.12),
        at(MILL.right + 0.18, MILL.top - 0.12),
        at(MILL.right + 0.18, MILL.bottom + 0.12),
        at(MILL.left - 0.12, MILL.bottom + 0.12),
      ],
      pick(MILL_COLOURS.shadow, night),
    );
    // A dressed-stone quay where the mill meets the water, and round its wheel bay.
    const stone = pick(POND.stone, night);
    shape(ctx, [at(12.9, 34.75), at(14.85, 34.75), at(14.85, 35.0), at(12.9, 35.0)], stone);
    shape(ctx, [at(14.7, 35.0), at(14.85, 35.0), at(14.85, 35.95), at(14.7, 35.95)], stone);
    const path = pick(POND.path, night);
    shape(
      ctx,
      [
        at(14.85, SHORE_Y - 0.15),
        at(23.0, SHORE_Y - 0.15),
        at(23.0, SHORE_Y + 0.15),
        at(14.85, SHORE_Y + 0.15),
      ],
      path,
    );
    // From the mill door, down to the landing, and out through the gate to the south road.
    shape(
      ctx,
      [at(MILL.right, 36.1), at(15.05, 36.1), at(15.05, SHORE_Y), at(MILL.right, SHORE_Y)],
      path,
    );
    shape(ctx, [at(17.3, 36.1), at(17.7, 36.1), at(17.7, SHORE_Y), at(17.3, SHORE_Y)], path);
    shape(
      ctx,
      [at(17.2, SHORE_Y), at(17.8, SHORE_Y), at(17.8, G.bottom), at(17.2, G.bottom)],
      path,
    );
    for (const { x, y, size } of STONES) {
      box(ctx, x - size, y - 1, size * 2, 3, stone);
      box(ctx, x - size + 1, y - 2, size * 2 - 3, 1, path);
    }
    for (const { x, y, seed } of TUFTS()) {
      const tuft = groundTuft(seed, seed % 3, night, season);
      box(ctx, x, y, tuft.w, tuft.h, tuft.fill);
    }
  },
  /** Open water: the shallows along the shore, the deep middle, and a damp shoreline. */
  water(ctx: Ctx, { night, water, waterLight }: GroundState) {
    ctx.lineWidth = 3;
    trace(ctx, WATER_PX);
    ctx.fillStyle = water;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = waterLight;
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = pick(POND.shore, night);
    ctx.stroke();
    shape(ctx, DEEP, pick(POND.deep, night));
    for (const { x, y, w } of RIPPLES()) box(ctx, x - w / 2, y, w, 1, waterLight);
  },
  /** Lily pads from early summer to late autumn, and pink flowers in midsummer. */
  lilies(ctx: Ctx, { night, day, water }: GroundState) {
    if (day === undefined) return;
    // The model's own schedule, so the panel never names a pad or a flower the pond lacks.
    const flowers = new Set(lilyFlowersOn(day));
    for (const pad of lilyPadsOn(day)) {
      const p = project(pad.position.x, pad.position.y);
      const x = Math.round(p.x),
        y = Math.round(p.y);
      box(ctx, x - pad.size, y - 1, pad.size * 2, 2, pick(POND.lily, night));
      box(ctx, x - pad.size + 1, y - 2, pad.size * 2 - 2, 1, pick(POND.lilyLight, night));
      box(ctx, x + 1, y - 1, 2, 1, water);
      if (flowers.has(pad)) {
        box(ctx, x - 2, y - 4, 3, 2, pick(POND.lilyFlower, night));
        box(ctx, x - 1, y - 5, 1, 1, '#F6E7EC');
      }
    }
  },
  /** The ice, whole days at a time: a rim that grows in from the shore, the frozen sheet with
   * the skaters' tracks, and the thaw's shrinking floes. */
  ice(ctx: Ctx, { night, ice }: GroundState) {
    if (ice.stage === 'open') return;
    const sheet = pick(ICE.sheet, night);
    ctx.lineWidth = 3;
    trace(ctx, WATER_PX);
    if (ice.stage === 'frozen') {
      ctx.fillStyle = sheet;
      ctx.fill();
      ctx.strokeStyle = pick(POND.shore, night);
      ctx.stroke();
      for (const { x, y, w } of SHEEN()) box(ctx, x - w / 2, y, w, 1, pick(SNOW.ice, night));
      // Skates have scored the ice along every loop: two long partial arcs each, a little
      // apart, solid and faint, like real scratches rather than a drawn ring.
      ctx.beginPath();
      SKATE_LOOPS.forEach((loop, i) => {
        const seed = hash(`millpond:tracks:${i}`);
        for (const k of [0, 1]) {
          const rx = loop.rx * (1 + (k ? -0.04 : 0.04) * groundFraction(seed, k));
          const from = Math.PI * 2 * groundFraction(seed, 2 + k) + k * Math.PI * 0.9;
          tileArc(ctx, { ...loop, rx }, from, from + 1.3 * Math.PI);
        }
      });
      ctx.save();
      ctx.globalAlpha = night ? 0.22 : 0.35;
      ctx.strokeStyle = pick(ICE.crackLight, night);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      return;
    }
    // Freezing: the rim grows inward, with a dark edge where it meets the water. Thawing: a
    // thin rim lingers at the shore while floes shrink and drift apart.
    const rim = ice.stage === 'freezing' ? 6 + 40 * ice.cover : 3 + 12 * ice.cover;
    ctx.save();
    ctx.clip();
    ctx.lineJoin = 'round';
    if (ice.stage === 'freezing') {
      ctx.strokeStyle = pick(ICE.crack, night);
      ctx.lineWidth = rim * 2 + 3;
      ctx.stroke();
      // Ice takes the still, shallow coves first: round pans there, edged with the rim's dark
      // line. The rim's sheet then goes over both, so rim and pans join into one sheet.
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (const pan of COVE_PANS) {
        const r = pan.r * (0.3 + 0.7 * ice.cover);
        const c = project(pan.x, pan.y);
        // A circle in tiles is an ellipse twice as wide as tall on screen.
        ctx.moveTo(c.x + 38 * Math.SQRT2 * r, c.y);
        ctx.ellipse(c.x, c.y, 38 * Math.SQRT2 * r, 19 * Math.SQRT2 * r, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.fillStyle = sheet;
      ctx.fill();
      trace(ctx, WATER_PX);
    }
    ctx.strokeStyle = sheet;
    ctx.lineWidth = rim * 2;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = pick(POND.shore, night);
    ctx.stroke();
    if (ice.stage !== 'thawing') return;
    // Each floe sits a pixel proud of the water, its lower edge a dark crack line.
    ctx.save();
    ctx.shadowColor = pick(ICE.crack, night);
    ctx.shadowOffsetY = 1;
    for (const floe of FLOES) {
      const r = floe.r * ice.cover;
      shape(
        ctx,
        floe.shape.map((k, i) => {
          const a = (i / floe.shape.length) * Math.PI * 2;
          return at(floe.x + Math.cos(a) * r * k, floe.y + Math.sin(a) * r * k * 0.8);
        }),
        sheet,
      );
    }
    ctx.restore();
  },
  /** Snow lying on the frozen pond, patch by patch, on the town's own snow schedule. */
  snow(ctx: Ctx, { night, day, ice }: GroundState) {
    if (day === undefined || ice.stage !== 'frozen') return;
    for (const { x, y, w, when } of SNOW_PATCHES()) {
      if (snowAt(day, when) <= 0.5) continue;
      box(ctx, x - w / 2 + 3, y - 3, w - 6, 2, pick(SNOW.top, night));
      box(ctx, x - w / 2, y - 1, w, 2, pick(SNOW.top, night));
      box(ctx, x - w / 2 + 2, y + 1, w - 3, 1, pick(SNOW.shade, night));
    }
  },
  /** The jetty's deck, a hand's width above the water, with its east side showing, and snow
   * lying on its planks through the snowy weeks. */
  jetty(ctx: Ctx, { night, day }: GroundState) {
    const lift = 3;
    const snowy = day !== undefined && snowAt(day, seedFraction('millpond:jetty')) > 0.5;
    shape(
      ctx,
      [
        at(JETTY_RIGHT, JETTY.to, lift),
        at(JETTY_RIGHT, JETTY.from, lift),
        at(JETTY_RIGHT, JETTY.from),
        at(JETTY_RIGHT, JETTY.to),
      ],
      pick(WOOD.deckSide, night),
    );
    shape(
      ctx,
      [
        at(JETTY_LEFT, JETTY.to, lift),
        at(JETTY_RIGHT, JETTY.to, lift),
        at(JETTY_RIGHT, JETTY.from, lift),
        at(JETTY_LEFT, JETTY.from, lift),
      ],
      pick(snowy ? SNOW.top : WOOD.deck, night),
    );
    // Planks run across the deck.
    const origin = at(JETTY_LEFT, JETTY.to, lift);
    ctx.save();
    ctx.transform(1, 0.5, 0, 1, origin.x, origin.y);
    ctx.fillStyle = pick(snowy ? SNOW.shade : WOOD.deckGap, night);
    const span = (JETTY.from - JETTY.to) * 38;
    for (let v = 4; v < span; v += 5) ctx.fillRect(-v, v, JETTY.width * 38, 1);
    ctx.restore();
  },
};
type GroundPart = keyof typeof MILLPOND_GROUND_PARTS;
export const GROUND_ORDER: readonly GroundPart[] = [
  'bank',
  'water',
  'lilies',
  'ice',
  'snow',
  'jetty',
];
export function millpondGroundState(
  night: boolean,
  season: TownSeason | undefined,
  water: string,
  waterLight: string,
): GroundState {
  const day = season?.groundDay;
  return {
    night,
    season,
    day,
    ice: day === undefined ? { stage: 'open', cover: 0 } : iceOn(day),
    water,
    waterLight,
  };
}

/** The pond's ground for the cached layer: `night` and the season's whole day only. */
export function drawMillpondGround(
  ctx: Ctx,
  night: boolean,
  season: TownSeason | undefined,
  water: string,
  waterLight: string,
) {
  const state = millpondGroundState(night, season, water, waterLight);
  ctx.save();
  for (const part of GROUND_ORDER) MILLPOND_GROUND_PARTS[part](ctx, state);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// The scene: the model's moving parts for one moment, shared by the surface and the objects.

type Scene = {
  heron: Heron | null;
  rises: Rise[];
  boats: Boat[];
  fisher: Fisher | null;
  skaters: Skater[];
  mist: number;
  secret: Secret | null;
  wheel: number | null;
};
let lastScene: { minutes: number; day: number; scene: Scene } | undefined;
export function millpondSceneAt(minutes: number, day: number): Scene {
  if (lastScene?.minutes === minutes && lastScene.day === day) return lastScene.scene;
  const scene = {
    heron: heronAt(minutes, day),
    // A rise behind the mill would be hidden by it anyway.
    rises: fishRisesAt(minutes, day).filter(
      (rise) => !behindMill(project(rise.position.x, rise.position.y)),
    ),
    boats: boatsAt(minutes, day),
    fisher: fisherAt(minutes, day),
    skaters: sceneSkatersAt(minutes, day),
    mist: mistAt(minutes, day),
    secret: iceSecretAt(minutes, day),
    wheel: wheelAngleAt(minutes, day),
  };
  lastScene = { minutes, day, scene };
  return scene;
}

// ---------------------------------------------------------------------------------------------
// Layer 2: the surface (flat, per frame)

type SurfaceState = {
  night: boolean;
  minutes: number;
  day: number;
  absolute: number;
  season: TownSeason;
  ice: Ice;
  litCount: number;
  total: number;
  selected: boolean;
  scene: Scene;
};

const GLINTS = lazy(() =>
  pondWaterPoints('glint', 14, 0.45).map(({ tile, seed }) => {
    const p = project(tile.x, tile.y);
    return {
      x: Math.round(p.x),
      y: Math.round(p.y),
      depth: shoreDistance(tile),
      rate: 0.35 + groundFraction(seed, 1) * 0.5,
      phase: groundFraction(seed, 2) * Math.PI * 2,
    };
  }),
);
/** Dawn mist lies in five banks: each a cloud of thin bands a few rows apart that drift
 * together along the water, every band cut to its own row's open water. */
const MIST_BANKS = 5,
  MIST_BAND_COUNT = 24;
export const mistBanks = lazy(() => {
  // Five centres on open water, at least 14 px apart down the screen.
  const centres: Point[] = [];
  for (const { tile } of pondWaterPoints('mist-bank', 40, 0.6)) {
    const s = project(tile.x, tile.y);
    if (centres.every((c) => Math.abs(c.y - s.y) >= 14)) centres.push(s);
    if (centres.length === MIST_BANKS) break;
  }
  return centres.map((centre, b) => {
    const seed = hash(`millpond:mist-bank:${b}`);
    const [left, right] = rowThrough(centre, 0.15);
    const bands = Array.from({ length: Math.ceil(MIST_BAND_COUNT / MIST_BANKS) }, (_, k) => {
      const band = hash(`millpond:mist:${b}:${k}`);
      const y = Math.round(centre.y) + Math.round((groundFraction(band, 1) - 0.5) * 6.99);
      const [from, to] = rowThrough({ x: centre.x, y }, 0.15);
      return {
        y,
        from,
        to,
        dx: Math.round((groundFraction(band, 2) - 0.5) * 50),
        length: 26 + (band % 37),
        alpha: 0.6 + groundFraction(band, 3) * 0.4,
      };
    });
    return {
      left,
      right,
      offset: groundFraction(seed, 1) * 600,
      // The first four banks keep five bands and the last four, 24 in all.
      bands: bands.slice(0, b < MIST_BAND_COUNT % MIST_BANKS ? bands.length : bands.length - 1),
    };
  });
});
// Petals drift along the rows they fell on; the model says how many are afloat.
const PETALS = lazy(() =>
  drifters('petal', PETAL_DRIFTERS + 8, 0.25)
    .filter((petal) => petal.right - petal.left >= 4)
    .slice(0, PETAL_DRIFTERS)
    .map((petal, i) => ({
      ...petal,
      speed: 0.8 + groundFraction(petal.seed, 5) * 1.2,
      offset: groundFraction(petal.seed, 6) * 400,
      white: i % 3 === 0,
    })),
);
// Fallen leaves land where the model says, on the day it says, and drift in to gather along the
// nearest bank.
const LEAVES = lazy(() =>
  MILLPOND_LEAVES.map(({ position: tile, seed, lands }) => {
    let best = { x: tile.x, y: tile.y, d: Infinity };
    for (let i = 0, j = MILLPOND_WATER.length - 1; i < MILLPOND_WATER.length; j = i++) {
      const a = MILLPOND_WATER[j],
        b = MILLPOND_WATER[i];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const t = clamp01(((tile.x - a.x) * dx + (tile.y - a.y) * dy) / (dx * dx + dy * dy));
      const q = { x: a.x + t * dx, y: a.y + t * dy };
      const d = Math.hypot(tile.x - q.x, tile.y - q.y);
      if (d < best.d) best = { ...q, d };
    }
    // Stop a little short of the bank, on the water.
    const k = 0.22 / Math.max(best.d, 1e-6);
    const shore = { x: best.x + (tile.x - best.x) * k, y: best.y + (tile.y - best.y) * k };
    return {
      from: tile,
      to: nearJetty(shore, 0.1) || behindMill(project(shore.x, shore.y)) ? tile : shore,
      lands,
      colour: FALLEN_LEAVES[seed % FALLEN_LEAVES.length],
      wide: seed % 2 === 0,
      seed,
    };
  }),
);
// The lamps whose light reaches the water: the north lamp by the pitch and the west lamp.
export const WATER_LAMPS = LAMPS.filter(
  (lamp) => (lamp.x === 17 && lamp.y === 29) || (lamp.x === 9 && lamp.y === 33),
);
/** The bars of each water lamp's reflection, fixed in place: the ones that fall on water 0.15
 * tile deep or more, 34 px and further below the lamp's foot. */
export const lampColumns = lazy(() =>
  WATER_LAMPS.map((lamp) => {
    const foot = project(lamp.x + 0.5, lamp.y + 0.5);
    return LAMP_BARS.flatMap((w, k) => {
      const y = foot.y + 34 + 2 * k;
      if (shoreDistance(unproject(foot.x + 1, y)) < 0.15) return [];
      return [{ k, x: Math.round(foot.x + 1 - w / 2), y, w, alpha: 0.8 - (0.65 * k) / 8 }];
    });
  }),
);
const LAMP_BARS = [7, 4, 6, 3, 5, 2, 4, 2, 3];
/** The moon's broken path, bar by bar toward the viewer. */
const MOON_PATH = [9, 7, 6, 4, 3, 2];
// The far shore's waterline, where the town's lanterns glimmer across still water.
const northShore = (x: number) => {
  let y = G.top;
  while (y < G.bottom && !insideWater({ x, y })) y += 0.01;
  return y;
};
/** The lantern glints' places, in the order they light: 24 spots spread along the far shore's
 * water, each nudged along the bank and 0.3–0.6 tile out from it, then shuffled by a seeded
 * order, so lit glints appear here and there rather than sweeping along the bank. None fall in
 * the north lamp's own column. */
export const lanternSpots = lazy(() => {
  const west = 17.8 - 11.2,
    east = 22.8 - 19.2,
    span = west + east,
    spacing = span / LANTERN_SPOTS;
  return Array.from({ length: LANTERN_SPOTS }, (_, k) => {
    const seed = hash(`millpond:lantern:${k}`);
    const along = Math.min(
      span,
      Math.max(0, (k + 0.5 + (groundFraction(seed, 1) - 0.5) * 0.8) * spacing),
    );
    const x = along < west ? 11.2 + along : 19.2 + (along - west);
    const p = project(x, northShore(x) + 0.3 + 0.3 * groundFraction(seed, 2));
    return {
      x: Math.round(p.x),
      y: Math.round(p.y),
      rate: 1.3 + 0.5 * groundFraction(seed, 3),
      phase: Math.PI * 2 * groundFraction(seed, 4),
      order: groundFraction(seed, 5),
    };
  }).sort((a, b) => a.order - b.order);
});
const LANTERN_SPOTS = 24;

const MOON_INSET = 0.6;
/** Samples along the moon's chord, in tiles of (x − y). */
const MOON_T = Array.from({ length: 221 }, (_, i) => -27 + i * 0.1);
/** Which chord samples are open water for the moon, for each 1/400 of its crossing: the costly
 * part of the reflection, built once per step and then reused every night. */
const moonChords = new Map<number, boolean[]>();
function moonChord(progress: number) {
  const key = Math.round(progress * 400);
  let clear = moonChords.get(key);
  if (!clear) {
    const S = 47.8 + 3.6 * Math.sin((Math.PI * key) / 400);
    clear = MOON_T.map((t) => {
      const p = { x: (S + t) / 2, y: (S - t) / 2 },
        s = project(p.x, p.y);
      return (
        shoreDistance(p) >= MOON_INSET &&
        !nearJetty(p, 0.3) &&
        ![-14, 0, 14].some((dx) => behindMill({ x: s.x + dx, y: s.y }))
      );
    });
    moonChords.set(key, clear);
  }
  return clear;
}
/** Where the moon lies on the water: on a screen row that swings nearer the viewer at midnight,
 * sliding west to east as the moon crosses the sky. Null while the moon is down. */
export function moonReflectionAt(minutes: number, day: number) {
  const sky = townSkyAt(day, minutes);
  if (sky.moon.opacity <= 0) return null;
  const progress = clamp01((sky.moon.x - 0.12) / 0.76);
  const S = 47.8 + 3.6 * Math.sin(Math.PI * progress);
  const clear = moonChord(progress);
  const first = clear.indexOf(true),
    last = clear.lastIndexOf(true);
  if (first < 0) return null;
  const t = lerp(MOON_T[first], MOON_T[last], progress);
  // Fade out over a gap (the jetty) rather than jump across it.
  let gap = Infinity;
  for (let i = first; i <= last; i++) if (!clear[i]) gap = Math.min(gap, Math.abs(MOON_T[i] - t));
  const fade = clamp01((gap - 0.05) / 0.45);
  const p = { x: (S + t) / 2, y: (S - t) / 2 };
  return { tile: p, screen: project(p.x, p.y), fade, sky };
}
/** Where the fisher's lost lure lies under the ice: two tiles and more from the moon's path. */
export const SECRET_LURE: Point = { x: 16.35, y: 33.05 };
const CRACK = (() => {
  const start = { x: JETTY.x, y: JETTY.to - 0.08 },
    end = { x: 16.7, y: 31.5 };
  return Array.from({ length: 9 }, (_, i) => {
    const t = i / 8,
      jitter = i && i < 8 ? (groundFraction(hash('millpond:crack'), i) - 0.5) * 0.28 : 0;
    return project(lerp(start.x, end.x, t) + jitter, lerp(start.y, end.y, t) - jitter * 0.5);
  });
})();

export const MILLPOND_SURFACE_PARTS = {
  /** Small streaks of light that come and go on open water. */
  glints(ctx: Ctx, { night, absolute, ice }: SurfaceState) {
    if (ice.stage === 'frozen') return;
    const rim = ice.stage === 'freezing' ? 0.2 + 1.8 * ice.cover : 0;
    ctx.fillStyle = pick(POND.glint, night);
    const alpha = ctx.globalAlpha;
    GLINTS().forEach((glint, i) => {
      if (glint.depth < rim || (ice.stage === 'thawing' && i % 2)) return;
      const wave = Math.sin(absolute * glint.rate + glint.phase);
      if (wave < 0.25) return;
      ctx.globalAlpha = alpha * (night ? 0.55 : 0.85) * smooth((wave - 0.25) / 0.5);
      const w = 3 + Math.round(wave * 5);
      ctx.fillRect(
        glint.x - Math.round(w / 2) + Math.round(Math.sin(absolute * 0.6 + i)),
        glint.y,
        w,
        1,
      );
    });
    ctx.globalAlpha = alpha;
  },
  /** The moon in the water: the sky moon's own phase in 1-px slices with dark water between,
   * and a broken path of bars toward the viewer, so it reads as light rather than a floe. */
  moon(ctx: Ctx, { absolute, ice, minutes, day }: SurfaceState) {
    const moon = moonReflectionAt(minutes, day);
    if (!moon || moon.fade <= 0) return;
    const { screen, fade, sky } = moon;
    const iced = ice.stage !== 'open';
    const strength = sky.moon.opacity * fade * (iced ? 0.5 : 1);
    const alpha = ctx.globalAlpha;
    const radius = 12,
      half = 5;
    ctx.fillStyle = MOON_WATER;
    const cx = Math.round(screen.x),
      cy = Math.round(screen.y);
    ctx.globalAlpha = alpha * 0.75 * strength * sky.illumination;
    for (let row = -half; row < half; row += 2) {
      const [left, right] = moonSlice(sky.moonPhase, (row + 1) / half);
      if (right - left < 0.04) continue;
      const wobble = iced ? 0 : Math.round(Math.sin(absolute * 0.9 + row * 1.7));
      ctx.fillRect(
        Math.round(cx + left * radius) + wobble,
        cy + row,
        Math.max(1, Math.round((right - left) * radius)),
        1,
      );
    }
    // A short broken path toward the viewer, on water only.
    MOON_PATH.forEach((w, k) => {
      const y = cy + 7 + k * 3;
      if (shoreDistance(unproject(cx, y + 1)) < 0.2) return;
      const wobble = iced ? 0 : Math.round(Math.sin(absolute * 1.1 + k * 2.3) * 1.5);
      ctx.globalAlpha = alpha * 0.3 * strength * sky.illumination * (1 - k / 7);
      ctx.fillRect(cx - Math.round(w / 2) + wobble, y, w, 1);
    });
    ctx.globalAlpha = alpha;
  },
  /** Each lit lamp's light hangs in the water straight below it: 1-px bars on a 2-px pitch that
   * narrow and fade with distance, each wobbling on its own, and none over the shallows. */
  lamps(ctx: Ctx, { night, minutes, absolute, ice }: SurfaceState) {
    if (!night) return;
    const iced = ice.stage !== 'open';
    const alpha = ctx.globalAlpha;
    ctx.fillStyle = LAMP_WATER;
    WATER_LAMPS.forEach((lamp, i) => {
      if (!lampOn(lamp.distance, minutes) || lampBlocksGoal(lamp.x + 0.5, lamp.y + 0.5)) return;
      for (const bar of lampColumns()[i]) {
        const wobble = iced ? 0 : Math.round(1.2 * Math.sin(absolute * 2.3 + bar.k * 1.9 + lamp.x));
        ctx.globalAlpha = alpha * bar.alpha * (iced ? 0.5 : 1);
        ctx.fillRect(bar.x + wobble, bar.y, bar.w, 1);
      }
    });
    ctx.globalAlpha = alpha;
  },
  /** The town's lanterns glimmering across still water: one glint per lit lantern, up to 24,
   * from the same lantern-hour count as the posts, each a 2x1 fleck that shimmers and shifts. */
  lanterns(ctx: Ctx, { litCount, total, ice, absolute }: SurfaceState) {
    if (ice.stage !== 'open') return;
    const lit = Math.min(litCount, total, LANTERN_SPOTS);
    if (lit <= 0) return;
    const alpha = ctx.globalAlpha;
    ctx.fillStyle = LIGHT.lit;
    for (const spot of lanternSpots().slice(0, lit)) {
      const wave = Math.sin(absolute * spot.rate + spot.phase);
      ctx.globalAlpha = alpha * 0.7 * (0.55 + 0.45 * wave);
      ctx.fillRect(spot.x - 1 + Math.round(Math.sin(absolute * 0.7 + spot.phase)), spot.y, 2, 1);
    }
    ctx.globalAlpha = alpha;
  },
  /** Blossom petals afloat for the fortnight the trees shed. */
  petals(ctx: Ctx, { night, season, absolute, ice }: SurfaceState) {
    const count = petalCountAt(season.yearDay);
    if (ice.stage !== 'open' || count <= 0) return;
    for (const petal of PETALS().slice(0, count)) {
      const span = petal.right - petal.left;
      const x = Math.round(petal.left + mod(petal.offset + absolute * petal.speed, span));
      const colour = pick(petal.white ? BLOSSOM.white : BLOSSOM.pink, night);
      box(ctx, x, petal.y, 3, 1, colour);
      box(ctx, x + 1, petal.y - 1, 1, 1, colour);
    }
  },
  /** Autumn leaves land on the water and drift in to the banks. */
  leaves(ctx: Ctx, { night, season, absolute, ice }: SurfaceState) {
    const d = season.yearDay;
    if (ice.stage !== 'open' || leafCountAt(d) <= 0) return;
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * leafFadeAt(d);
    for (const leaf of LEAVES()) {
      if (d < leaf.lands) continue;
      const q = smooth((d - leaf.lands) / 3);
      const p = at(lerp(leaf.from.x, leaf.to.x, q), lerp(leaf.from.y, leaf.to.y, q));
      const bob = Math.round(Math.sin(absolute * 0.5 + leaf.seed) * (1 - q * 0.7));
      const colour = pick(leaf.colour, night);
      const x = Math.round(p.x) + bob,
        y = Math.round(p.y);
      box(ctx, x, y, leaf.wide ? 4 : 3, 2, colour);
      box(ctx, x + (leaf.wide ? 4 : 3), y + 1, 1, 1, colour);
    }
    ctx.globalAlpha = alpha;
  },
  /** Rings where fish rise (a dimple, then a ring with a smaller one inside), and where a
   * leaping fish lands, a second ring and two droplets. */
  fish(ctx: Ctx, { night, scene }: SurfaceState) {
    if (!scene.rises.length) return;
    const alpha = ctx.globalAlpha;
    const ring = pick(POND.ring, night);
    ctx.strokeStyle = ring;
    ctx.fillStyle = ring;
    ctx.lineWidth = 1.5;
    // The youngest few: an old ring is nearly gone by the time a sixth appears.
    const rises = [...scene.rises].sort((a, b) => a.progress - b.progress).slice(0, FISH_RINGS);
    for (const rise of rises) {
      const s = project(rise.position.x, rise.position.y);
      const q = clamp01(rise.progress);
      ctx.globalAlpha = alpha * 0.85 * (1 - q);
      const rx = 2 + q * 12;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, rx, rx * 0.45, 0, 0, Math.PI * 2);
      ctx.moveTo(s.x + rx * 0.55, s.y);
      ctx.ellipse(s.x, s.y, rx * 0.55, rx * 0.55 * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (q < 0.2) ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y), 2, 1);
      if (!rise.leap) continue;
      const t = q / LEAP;
      if (t < 0.95 || t > 1.6) continue;
      const u = (t - 0.95) / 0.65;
      ctx.globalAlpha = alpha * 0.85 * (1 - u);
      const landing = project(rise.landing.x, rise.landing.y),
        r = 2 + 6 * u;
      ctx.beginPath();
      ctx.ellipse(landing.x, landing.y, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      const x = Math.round(landing.x),
        y = Math.round(landing.y);
      const up = Math.round(Math.sin(u * Math.PI) * 5);
      ctx.fillRect(x - 3, y - 1 - up, 1, 1);
      ctx.fillRect(x + 2, y - 2 - up, 1, 1);
    }
    ctx.globalAlpha = alpha;
  },
  /** Wakes behind rowing boats; the heron's strike ring. */
  wakes(ctx: Ctx, { night, scene }: SurfaceState) {
    const alpha = ctx.globalAlpha;
    ctx.strokeStyle = pick(POND.ring, night);
    ctx.lineWidth = 1;
    for (const boat of scene.boats) {
      if (boat.state !== 'out' || boat.opacity <= 0) continue;
      const d = { x: Math.cos(boat.heading), y: Math.sin(boat.heading) },
        n = { x: -d.y, y: d.x };
      const stern = { x: boat.position.x - 0.45 * d.x, y: boat.position.y - 0.45 * d.y };
      let reach = 0.55;
      const arm = (side: number) => ({
        x: stern.x - reach * d.x + side * reach * 0.5 * n.x,
        y: stern.y - reach * d.y + side * reach * 0.5 * n.y,
      });
      while (reach > 0.15 && (shoreDistance(arm(1)) < 0.05 || shoreDistance(arm(-1)) < 0.05))
        reach -= 0.1;
      ctx.globalAlpha = alpha * 0.5 * boat.opacity * clamp01(boat.rowerOpacity);
      const a = at(arm(1).x, arm(1).y),
        s = at(stern.x, stern.y),
        b = at(arm(-1).x, arm(-1).y);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(s.x, s.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    const heron = scene.heron;
    if (heron?.pose === 'strike' && heron.wading && heron.progress > STRIKE_HIT) {
      const u = clamp01((heron.progress - STRIKE_HIT) / (1 - STRIKE_HIT));
      const s = project(heron.position.x, heron.position.y);
      const x = s.x + (heron.left ? -15 : 15);
      ctx.globalAlpha = alpha * 0.8 * (1 - u) * heron.opacity;
      ctx.beginPath();
      ctx.ellipse(x, s.y, 3 + u * 9, (3 + u * 9) * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (u < 0.5) {
        ctx.fillStyle = pick(POND.ring, night);
        const up = Math.round(Math.sin(u * 2 * Math.PI) * 6);
        ctx.fillRect(x - 3, s.y - 2 - up, 1, 2);
        ctx.fillRect(x + 3, s.y - 1 - up, 1, 2);
      }
    }
    ctx.globalAlpha = alpha;
  },
  /** Winter's full-moon secret: a crack runs out from the jetty, and something silver glints
   * under the ice. */
  secret(ctx: Ctx, { night, scene }: SurfaceState) {
    const secret = scene.secret;
    if (!secret || secret.opacity <= 0) return;
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * clamp01(secret.opacity);
    const reach = clamp01(secret.crack) * (CRACK.length - 1);
    if (reach > 0) {
      const whole = Math.floor(reach);
      const points = CRACK.slice(0, whole + 1);
      if (whole < CRACK.length - 1) {
        const a = CRACK[whole],
          b = CRACK[whole + 1],
          f = reach - whole;
        points.push({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) });
      }
      for (const [colour, width, lift] of [
        [pick(ICE.crack, night), 2, 0],
        [pick(ICE.crackLight, night), 1, 1.5],
      ] as const) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = width;
        ctx.beginPath();
        points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y - lift) : ctx.moveTo(p.x, p.y - lift)));
        ctx.stroke();
      }
    }
    if (secret.glint > 0) {
      const lure = project(SECRET_LURE.x, SECRET_LURE.y);
      const x = Math.round(lure.x),
        y = Math.round(lure.y);
      ctx.globalAlpha = alpha * clamp01(secret.opacity) * Math.min(0.85, secret.glint);
      ctx.fillStyle = SECRET_GLINT;
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.fillRect(x - 4, y, 3, 1);
      ctx.fillRect(x + 2, y, 3, 1);
      ctx.fillRect(x, y - 4, 1, 3);
      ctx.fillRect(x, y + 2, 1, 3);
    }
    ctx.globalAlpha = alpha;
  },
  /** Dawn mist in five banks drifting slowly along the water: each band a 1-px core with a
   * fainter row above and below, so the banks read as soft mist rather than streaks. */
  mist(ctx: Ctx, { night, absolute, scene }: SurfaceState) {
    if (scene.mist <= 0) return;
    const alpha = ctx.globalAlpha;
    ctx.fillStyle = pick(POND.mist, night);
    const strength = alpha * clamp01(scene.mist);
    for (const bank of mistBanks()) {
      // The bank's own frame drifts east and wraps, with room to enter and leave off the water.
      const x0 = bank.left - 60 + mod(bank.offset + absolute * 4, bank.right - bank.left + 120);
      for (const band of bank.bands) {
        const from = Math.max(band.from, x0 + band.dx),
          to = Math.min(band.to, x0 + band.dx + band.length);
        if (to - from < 2) continue;
        const x = Math.round(from),
          w = Math.round(to - from);
        ctx.globalAlpha = strength * 0.45 * band.alpha;
        ctx.fillRect(x, band.y, w, 1);
        ctx.globalAlpha = strength * 0.2 * band.alpha;
        ctx.fillRect(x + 2, band.y - 1, Math.max(1, w - 4), 1);
        ctx.fillRect(x + 1, band.y + 1, Math.max(1, w - 2), 1);
      }
    }
    ctx.globalAlpha = alpha;
  },
  /** The zoo's selection outline, round the whole site. */
  selection(ctx: Ctx, { selected }: SurfaceState) {
    if (!selected) return;
    ctx.strokeStyle = SELECTION;
    ctx.lineWidth = 3;
    ctx.beginPath();
    [at(G.left, G.top), at(G.right, G.top), at(G.right, G.bottom), at(G.left, G.bottom)].forEach(
      (p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)),
    );
    ctx.closePath();
    ctx.stroke();
  },
};
type SurfacePart = keyof typeof MILLPOND_SURFACE_PARTS;
export const SURFACE_ORDER: readonly SurfacePart[] = [
  'glints',
  'moon',
  'lamps',
  'lanterns',
  'petals',
  'leaves',
  'fish',
  'wakes',
  'secret',
  'mist',
  'selection',
];
export function millpondSurfaceState(opts: MillpondOptions): SurfaceState {
  const { minutes, day, night, season, litCount, total, selected } = opts;
  return {
    night,
    minutes,
    day,
    absolute: day * 1440 + minutes,
    season,
    ice: iceOn(season.groundDay),
    litCount,
    total,
    selected,
    scene: millpondSceneAt(minutes, day),
  };
}

/** Flat pond art for this frame, painted straight onto the water before the depth sort. */
export function drawMillpondSurface(ctx: Ctx, opts: MillpondOptions) {
  if (!opts.visible(project(17.5, 33.5), 480, 250, 250)) return;
  const state = millpondSurfaceState(opts);
  ctx.save();
  for (const part of SURFACE_ORDER) MILLPOND_SURFACE_PARTS[part](ctx, state);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Layer 3: sprites

/** How much of a rise's progress the leap takes, up and back into the water. */
const LEAP = 0.35;
/** The most rings on the water at once, within the surface's call budget. */
const FISH_RINGS = 5;
/** When the heron's bill meets the water, as a fraction of the strike. */
const STRIKE_HIT = 0.3;

/** Reeds: straight stalks, a few cattails from midsummer, clipped under both sightlines. */
export function drawReeds(
  ctx: Ctx,
  reed: { x: number; y: number; size: number; seed: number },
  night: boolean,
  yearDay: number,
  half: 'back' | 'front' | 'all' = 'all',
) {
  const base = project(reed.x, reed.y);
  const green = pick(REED.green, night),
    light = pick(REED.greenLight, night),
    straw = pick(REED.straw, night),
    pale = pick(REED.pale, night);
  // New shoots through last year's straw in spring, green all summer, straw through autumn,
  // pale straw by midwinter.
  const [main, lit] =
    yearDay < 12
      ? [mixHex(pale, green, smooth(yearDay / 12)), mixHex(pale, light, smooth(yearDay / 12))]
      : yearDay < 58
        ? [green, light]
        : yearDay < 84
          ? [
              mixHex(green, straw, smooth((yearDay - 58) / 20)),
              mixHex(light, pale, smooth((yearDay - 58) / 20)),
            ]
          : [mixHex(straw, pale, smooth((yearDay - 84) / 8)), pale];
  const heads = yearDay >= 35 || yearDay < 6;
  const snowy = snowAt(yearDay, groundFraction(reed.seed, 30)) > 0.5;
  const stalks = 4 + (reed.seed % 3);
  const spread = 4 + reed.size / 4;
  for (let i = 0; i < stalks; i++) {
    const dx = Math.round((groundFraction(reed.seed, i) - 0.5) * 2 * spread),
      dy = Math.round((groundFraction(reed.seed, i + 10) - 0.5) * 4);
    if ((half === 'back' && dy >= 0) || (half === 'front' && dy < 0)) continue;
    const x = base.x + dx,
      y = base.y + dy;
    const tile = unproject(x, y);
    const h = Math.floor(
      Math.min(
        reed.size * (0.6 + 0.4 * groundFraction(reed.seed, i + 20)),
        headroom(x, y) - 1,
        northRoad(tile.y),
      ),
    );
    if (h < 3) continue;
    box(ctx, x, y - h, 1, h, i % 2 ? main : lit);
    if (heads && i < 2 && h >= 8) {
      box(
        ctx,
        x - 1,
        y - h + 2,
        3,
        5,
        pick(yearDay >= 84 || yearDay < 6 ? CATTAIL_SEED : CATTAIL, night),
      );
      if (snowy) box(ctx, x - 1, y - h + 1, 3, 1, pick(SNOW.top, night));
    }
  }
  if (half !== 'back') {
    box(ctx, base.x - 4, base.y - 5, 2, 5, lit);
    box(ctx, base.x + 3, base.y - 6, 2, 5, main);
    box(ctx, base.x - 5, base.y - 1, 11, 2, main);
  }
}

// Boats: a hull in tile space turned to its heading, then projected.
const HULL = [
  [0.46, 0],
  [0.3, 0.17],
  [-0.3, 0.19],
  [-0.42, 0.13],
  [-0.42, -0.13],
  [-0.3, -0.19],
  [0.3, -0.17],
] as const;
const INSIDE = [
  [0.36, 0],
  [0.2, 0.13],
  [-0.32, 0.13],
  [-0.32, -0.13],
  [0.2, -0.13],
] as const;
const ROWERS: Resident[] = [
  { ...DEFAULT_RESIDENT, figure: 'female', skin: '#D8B391', hair: '#6B4A36', outfit: '#6F8FA6' },
  { ...DEFAULT_RESIDENT, skin: '#B98563', hair: '#3A322C', outfit: '#9C6B5A', accessory: 'hat' },
];
const facingOf = (dx: number, dy: number) =>
  Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'se' : 'nw') : dy >= 0 ? 'sw' : 'ne';

/** A rowboat: moored at the jetty, out with a rower, or stored upside down on the west bank. */
export function drawBoat(ctx: Ctx, boat: Boat, night: boolean, yearDay = 0) {
  if (boat.opacity <= 0) return;
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * clamp01(boat.opacity);
  const d = { x: Math.cos(boat.heading), y: Math.sin(boat.heading) },
    n = { x: -d.y, y: d.x };
  const point = (u: number, v: number, lift: number) =>
    at(boat.position.x + u * d.x + v * n.x, boat.position.y + u * d.y + v * n.y, lift);
  if (boat.state === 'stored') {
    // Upside down on the grass: a shadow, the planked sides sloping in to the flat bottom on
    // top with its keel, and the town's snow lying on that bottom in winter.
    const lift = 6;
    const outline = HULL.map(([u, v]) => point(u, v, 0));
    const bottom = INSIDE.map(([u, v]) => point(u * 0.9, v * 0.75, lift));
    shape(
      ctx,
      outline.map((p) => ({ x: p.x + 2, y: p.y + 2 })),
      pick(HERON.shadow, night),
    );
    shape(ctx, convexHull([...outline, ...bottom]), pick(WOOD.hullSide, night));
    shape(ctx, bottom, pick(WOOD.hullKeel, night));
    const snowy = snowAt(yearDay, 0.4 + boat.id * 0.2) > 0.5;
    if (snowy)
      shape(
        ctx,
        INSIDE.map(([u, v]) => point(u * 0.82, v * 0.6, lift + 1)),
        pick(SNOW.top, night),
      );
    const keel = [point(0.34, 0, lift), point(-0.3, 0, lift)];
    ctx.strokeStyle = pick(snowy ? SNOW.shade : WOOD.deckGap, night);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(keel[0].x, keel[0].y);
    ctx.lineTo(keel[1].x, keel[1].y);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    return;
  }
  const gunwale = 5;
  shape(
    ctx,
    convexHull([
      ...HULL.map(([u, v]) => point(u, v, 0)),
      ...HULL.map(([u, v]) => point(u, v, gunwale)),
    ]),
    pick(WOOD.hull, night),
  );
  shape(
    ctx,
    INSIDE.map(([u, v]) => point(u, v, gunwale)),
    pick(WOOD.hullInside, night),
  );
  const seatA = point(0.05, -0.15, gunwale),
    seatB = point(0.05, 0.15, gunwale);
  ctx.strokeStyle = pick(WOOD.thwart, night);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(seatA.x, seatA.y);
  ctx.lineTo(seatB.x, seatB.y);
  ctx.stroke();
  if (boat.state === 'moored') {
    // A painter line to the jetty's nearest post.
    const bow = point(0.44, 0, gunwale - 1),
      post = at(
        JETTY_RIGHT,
        Math.max(JETTY.to + 0.1, Math.min(JETTY.from - 0.1, boat.position.y + 0.4)),
        7,
      );
    ctx.strokeStyle = pick(WOOD.rope, night);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bow.x, bow.y);
    ctx.lineTo(post.x, post.y);
    ctx.stroke();
  }
  const rower = clamp01(boat.rowerOpacity);
  if (boat.rower && rower > 0) {
    // Nobody fades in: the rower sits up out of the boat and runs the oars out through the
    // rowlocks as it pushes off, and lies back and ships them as it comes in. The blades dip
    // on the drive and lift on the recovery.
    const sweep = Math.sin(boat.oar * Math.PI * 2) * rower;
    const dip = Math.cos(boat.oar * Math.PI * 2) > 0 ? 0 : 3;
    ctx.strokeStyle = pick(WOOD.oar, night);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const blades: Point[] = [];
    for (const side of [-1, 1]) {
      const lock = point(0.02, side * 0.19, gunwale),
        out = point(0.02 + sweep * 0.28, side * 0.62, dip),
        blade = { x: lerp(lock.x, out.x, rower), y: lerp(lock.y, out.y, rower) };
      ctx.moveTo(lock.x, lock.y);
      ctx.lineTo(blade.x, blade.y);
      blades.push(blade);
    }
    ctx.stroke();
    ctx.fillStyle = pick(WOOD.oar, night);
    for (const blade of blades)
      ctx.fillRect(Math.round(blade.x) - 1, Math.round(blade.y) - 1, 3, 2);
    // The rower sits at the rowlocks facing the stern, clipped at the gunwale (the clip's top
    // is a pixel over the hat, 28 px above the seat).
    const seat = point(0.02, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(seat.x - 16, seat.y - 29, 32, 29 - gunwale);
    ctx.clip();
    drawResident(
      ctx,
      ROWERS[boat.id % ROWERS.length],
      seat.x,
      seat.y - 3 + Math.round((1 - rower) * 24),
      1.25,
      {
        moving: false,
        facing: facingOf(-d.x, -d.y),
        walkPhase: boat.oar,
        greeting: false,
        pose: 'sit',
      },
    );
    ctx.restore();
  }
  ctx.globalAlpha = alpha;
}

const FISHER: Resident = {
  ...DEFAULT_RESIDENT,
  skin: '#D6AF88',
  hair: '#8A8378',
  outfit: '#6F7F5E',
  accessory: 'hat',
};
/** Where the jetty meets the shore path: the fisher comes and goes this way. */
const JETTY_ROOT: Point = { x: JETTY.x, y: SHORE_Y - 0.05 };
/** The linear time behind a smoothstep: the model eases the fisher's opacity in and out over
 * five minutes, and the art spends those minutes walking the jetty instead of fading. */
const unsmooth = (value: number) => 0.5 - Math.sin(Math.asin(1 - 2 * clamp01(value)) / 3);
/** Where the fisher is drawn: seated at the jetty's end, or walking out along it at dawn and
 * back after the morning's fishing, fading only for the last steps off the shore path. */
export function fisherWalk(fisher: Fisher, leaving: boolean) {
  const u = fisher.opacity >= 1 ? 1 : unsmooth(fisher.opacity);
  const position = {
    x: lerp(JETTY_ROOT.x, fisher.position.x, u),
    y: lerp(JETTY_ROOT.y, fisher.position.y, u),
  };
  const walked =
    (1 - u) * Math.hypot(fisher.position.x - JETTY_ROOT.x, fisher.position.y - JETTY_ROOT.y);
  return {
    position,
    seated: u >= 1,
    facing: leaving ? ('sw' as const) : ('ne' as const),
    phase: mod(walked / 0.3, 1),
    alpha: clamp01(u / 0.1),
  };
}
/** The early fisher at the jetty's end, back to us, rod out over the water; walking out to it at
 * dawn and home again after, rod on the shoulder. */
export function drawFisher(ctx: Ctx, fisher: Fisher, night: boolean, leaving = false) {
  if (fisher.opacity <= 0) return;
  const walk = fisherWalk(fisher, leaving);
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * walk.alpha;
  if (!walk.seated) {
    const s = project(walk.position.x, walk.position.y);
    const x = Math.round(s.x),
      y = Math.round(s.y);
    drawResident(ctx, FISHER, x, y, 1.25, {
      moving: true,
      facing: walk.facing,
      walkPhase: walk.phase,
      greeting: false,
    });
    // The rod over the shoulder, the float hooked at its tip; the morning's fish in hand.
    const side = walk.facing === 'ne' ? 1 : -1;
    ctx.strokeStyle = pick(WOOD.oar, night);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 2 * side, y - 13);
    ctx.lineTo(x + 9 * side, y - 36);
    ctx.stroke();
    box(ctx, x + 9 * side - 1, y - 36, 2, 2, BOBBER.body);
    if (fisher.catch >= 1) {
      box(ctx, x + 5 * side, y - 12, 1, 4, pick(POND.fishBack, night));
      box(ctx, x + 5 * side + side, y - 12, 1, 4, pick(POND.fish, night));
    }
    ctx.globalAlpha = alpha;
    return;
  }
  const s = project(fisher.position.x, fisher.position.y);
  const x = Math.round(s.x),
    y = Math.round(s.y) - 3;
  drawResident(ctx, FISHER, x, y, 1.25, {
    moving: false,
    facing: 'ne',
    walkPhase: 0,
    greeting: false,
    pose: 'sit',
  });
  // Rod from the hands up and out over the water; the float lies 0.8 tile out.
  const hands = { x: x + 5, y: y - 10 },
    tip = { x: x + 22, y: y - 27 };
  const rest = at(fisher.position.x, fisher.position.y - 0.8);
  const cast = clamp01(fisher.cast),
    caught = clamp01(fisher.catch),
    bite = clamp01(fisher.bite);
  const float = {
    x: Math.round(lerp(tip.x, rest.x, cast)),
    y: Math.round(lerp(tip.y, rest.y, cast) - Math.sin(cast * Math.PI) * 8 + bite * 2),
  };
  ctx.strokeStyle = pick(WOOD.oar, night);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hands.x, hands.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.strokeStyle = night ? '#9AA7A2' : '#E6E3D6';
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  if (caught > 0) {
    // A small silver fish comes up on the line, dark back and silver belly.
    const fish = {
      x: Math.round(lerp(rest.x, tip.x - 4, caught)),
      y: Math.round(lerp(rest.y, tip.y + 8, caught)),
    };
    ctx.lineTo(fish.x, fish.y);
    ctx.stroke();
    box(ctx, fish.x - 1, fish.y, 1, 5, pick(POND.fishBack, night));
    box(ctx, fish.x, fish.y, 1, 5, pick(POND.fish, night));
    box(ctx, fish.x - 1, fish.y + 5, 3, 1, pick(POND.fishBack, night));
  } else {
    ctx.lineTo(float.x, float.y - 2);
    ctx.stroke();
    box(ctx, float.x - 1, float.y - 2, 3, 2, BOBBER.body);
    box(ctx, float.x, float.y - 3, 1, 1, BOBBER.top);
    if (bite > 0 && cast >= 1) {
      ctx.globalAlpha = alpha * bite;
      box(ctx, float.x - 3, float.y, 6, 1, pick(POND.ring, night));
      box(ctx, float.x - 2, float.y + 1, 4, 1, pick(POND.ring, night));
    }
  }
  ctx.globalAlpha = alpha;
}

/** A grey heron, about 30 px tall: grey back, white neck with black streaks, a black crest,
 * a muted dagger bill, and long legs that disappear at the waterline while it wades. */
export function drawHeron(ctx: Ctx, heron: Heron, night: boolean) {
  if (heron.opacity <= 0) return;
  const s = project(heron.position.x, heron.position.y);
  const c = (pair: Pair) => pick(pair, night);
  const alpha = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha = alpha * clamp01(heron.opacity);
  ctx.translate(Math.round(s.x), Math.round(s.y));
  // How far into the water it stands, 0 on the bank to 1 in the shallows: the shadow gives way
  // to ripples and the feet sink out of sight, a pixel at a time, never with a jump.
  const wade = clamp01(heron.wade);
  if (wade < 1) {
    ctx.globalAlpha = alpha * clamp01(heron.opacity) * (1 - wade);
    ctx.fillStyle = c(HERON.shadow);
    ctx.beginPath();
    ctx.ellipse(0, 1, 8, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (wade > 0) {
    ctx.globalAlpha = alpha * clamp01(heron.opacity) * wade;
    box(ctx, -6, 0, 4, 1, pick(POND.ring, night));
    box(ctx, 3, 0, 4, 1, pick(POND.ring, night));
    const sink = Math.round(2 * wade);
    if (sink) {
      ctx.beginPath();
      ctx.rect(-20, -31, 40, 31);
      ctx.clip();
      ctx.translate(0, sink);
    }
  }
  ctx.globalAlpha = alpha * clamp01(heron.opacity);
  if (heron.left) ctx.scale(-1, 1);
  const p = clamp01(heron.progress);
  const pose = heron.pose;
  const hunting = pose === 'stalk' || pose === 'freeze' || pose === 'strike';
  const wave = Math.sin(heron.stride * Math.PI * 2);
  const step = pose === 'walk' || pose === 'stalk' ? Math.round(wave * 2) : 0;
  // A slight crouch while it stalks or freezes, low on one leg asleep, a small bob in the walk.
  // Through the strike the legs stay straight: they are what makes it a heron, not a duck.
  const drop =
    pose === 'stalk' || pose === 'freeze'
      ? 2
      : pose === 'sleep'
        ? 3
        : pose === 'walk'
          ? Math.round(Math.abs(wave))
          : 0;
  // Long legs; one is tucked up in its feathers while it sleeps.
  if (pose === 'sleep') box(ctx, 0, -12 + drop, 1, 12 - drop, c(HERON.leg));
  else {
    box(ctx, -1 - step, -12 + drop, 1, 12 - drop, c(HERON.legFar));
    box(ctx, 1 + step, -12 + drop, 1, 12 - drop, c(HERON.leg));
  }
  // How far a strike has shot the neck out: 0 poised, 1 with the bill in the water.
  const reach =
    pose !== 'strike'
      ? 0
      : p < STRIKE_HIT
        ? p / STRIKE_HIT
        : 1 - (p - STRIKE_HIT) / (1 - STRIKE_HIT);
  // The body tips breast-up at rest, levels out while it hunts and pitches forward to strike.
  ctx.save();
  ctx.translate(0, drop);
  ctx.transform(
    1,
    pose === 'strike'
      ? lerp(-0.08, 0.25, reach)
      : hunting
        ? -0.08
        : pose === 'sleep'
          ? -0.15
          : -0.3,
    0,
    1,
    0,
    0,
  );
  const round = pose === 'sleep' ? 1 : 0;
  box(ctx, -10, -17, 5, 3, c(HERON.flight));
  box(ctx, -8, -21 - round, 12, 7 + round, c(HERON.back));
  box(ctx, -6, -22 - round, 8, 1, c(HERON.back));
  box(ctx, -7, -19, 9, 3, c(HERON.wing));
  box(ctx, -5, -15, 8, 2, c(HERON.belly));
  box(ctx, 3, -22 - round, 3, 8 + round, c(HERON.neck));
  box(ctx, 2, -20, 2, 2, c(HERON.dark));
  ctx.restore();
  // The neck and head for each pose: base B, bend C, head H and the bill's angle a (radians,
  // 0 = level, positive = down).
  let B = { x: 4, y: -22 },
    C = { x: 2, y: -26 },
    H = { x: 6, y: -28 },
    a = 0;
  if (pose === 'walk') {
    B = { x: 4, y: -22 + drop };
    C = { x: 3, y: -25 + drop };
    H = { x: 7, y: -27 + drop };
    a = 0.1;
  } else if (pose === 'preen') {
    C = { x: 7, y: -25 };
    H = { x: 1 + Math.round(Math.sin(p * Math.PI * 6)), y: -20 };
    a = 2.6;
  } else if (pose === 'stalk') {
    // Neck raised in an S and craned forward, only the bill angled down at the water.
    B = { x: 5, y: -19 };
    C = { x: 7, y: -25 };
    H = { x: 11, y: -25 };
    a = 0.5;
  } else if (pose === 'freeze') {
    B = { x: 5, y: -18 };
    C = { x: 5, y: -23 };
    H = { x: 9, y: -21 };
    a = 0.55;
  } else if (pose === 'strike') {
    // The neck shoots out and down to the water, then draws back.
    B = { x: 5, y: -18 };
    C = { x: lerp(5, 11, reach), y: lerp(-23, -11, reach) };
    H = { x: lerp(9, 13, reach), y: lerp(-21, -4, reach) };
    a = lerp(0.55, 1.2, reach);
  } else if (pose === 'swallow') {
    // Head back and bill up, with a lump going down the neck.
    C = { x: 2, y: -23 };
    H = { x: 5, y: -24 };
    a = -0.9;
  } else if (pose === 'sleep') {
    // The head sunk into the shoulders, the bill resting forward and down.
    B = { x: 3, y: -19 };
    H = { x: 4, y: -20 };
    a = 0.35;
  }
  // When a fish leaps close by, the head comes up and turns towards it.
  const alert = Math.abs(heron.look) > 0.3 && pose !== 'sleep' && pose !== 'strike';
  const turned = alert && heron.look * (heron.left ? 1 : -1) > 0;
  if (alert && pose !== 'swallow') H = { ...H, y: H.y - 1 };
  const neck = c(HERON.neck);
  if (pose !== 'sleep') {
    // 2-px dabs close enough to join up however far the neck reaches, with the black streaks
    // down its front a third and half the way along.
    const samples = Math.max(5, Math.ceil(Math.hypot(H.x - B.x, H.y - B.y) / 1.6));
    const streaks = [Math.round(0.3 * samples - 0.5), Math.round(0.5 * samples - 0.5)];
    for (let i = 0; i < samples; i++) {
      const t = (i + 0.5) / samples;
      const x = Math.round((1 - t) * (1 - t) * B.x + 2 * t * (1 - t) * C.x + t * t * H.x),
        y = Math.round((1 - t) * (1 - t) * B.y + 2 * t * (1 - t) * C.y + t * t * H.y);
      box(ctx, x - 1, y - 1, 2, 2, neck);
      if (streaks.includes(i)) box(ctx, x + 1, y, 1, 1, c(HERON.dark));
    }
  }
  if (pose === 'swallow' && p < 0.8) {
    const t = 0.3 + p * 0.6;
    box(ctx, Math.round(lerp(H.x, B.x, t)) - 1, Math.round(lerp(H.y, B.y, t)) - 1, 3, 2, neck);
  }
  // White head, black stripe running back into the crest, a dark eye and the dagger bill.
  ctx.save();
  ctx.translate(H.x, H.y);
  if (turned) ctx.scale(-1, 1);
  ctx.rotate(a);
  box(ctx, -2, -2, 4, 3, c(HERON.head));
  if (pose === 'sleep') box(ctx, -3, -2, 4, 1, c(HERON.dark));
  else {
    box(ctx, -5, -2, 6, 1, c(HERON.dark));
    box(ctx, -6, -1, 2, 1, c(HERON.dark));
  }
  box(ctx, 0, -1, 1, 1, c(HERON.dark));
  box(ctx, 2, -1, 6, 1, c(HERON.bill));
  box(ctx, 2, 0, 4, 1, c(HERON.bill));
  if (heron.fish) {
    // Held crosswise in the bill: a dark back, a silver belly and a tail, still dripping.
    box(ctx, 5, -1, 1, 5, c(POND.fishBack));
    box(ctx, 6, -1, 1, 5, c(POND.fish));
    box(ctx, 4, 4, 3, 1, c(POND.fishBack));
    if (p < 0.4) {
      box(ctx, 8, 5, 1, 1, c(POND.ring));
      box(ctx, 3, 6, 1, 1, c(POND.ring));
    }
  }
  ctx.restore();
  ctx.restore();
  ctx.globalAlpha = alpha;
}

/** A leaping fish in a low arc out of its ring and back: a dark back over a silver belly, an
 * eye at the head and a forked tail, nose up on the way out and down on the way back. */
export function drawLeapingFish(ctx: Ctx, rise: Rise, night: boolean) {
  const t = clamp01(rise.progress) / LEAP;
  if (!rise.leap || t >= 1) return;
  const s = project(rise.position.x, rise.position.y);
  const side = rise.side,
    landing = project(rise.landing.x, rise.landing.y);
  // Out of its ring and down into the model's landing ring, in a low arc.
  const x = Math.round(lerp(s.x, landing.x, t)),
    y = Math.round(lerp(s.y, landing.y, t) - Math.sin(t * Math.PI) * 14);
  // The head half sits a pixel above the tail half on the way up, below it on the way down.
  const tilt = t < 0.4 ? -1 : t > 0.6 ? 1 : 0;
  const back = pick(POND.fishBack, night),
    belly = pick(POND.fish, night);
  // Six pixels long, tail at the back (x - 3 * side), head at the front.
  const left = side > 0 ? x - 3 : x;
  const tail = side > 0 ? left : left + 3,
    head = side > 0 ? left + 3 : left;
  box(ctx, tail, y - 2, 3, 1, back);
  box(ctx, tail, y - 1, 3, 1, belly);
  box(ctx, head, y - 2 + tilt, 3, 1, back);
  box(ctx, head, y - 1 + tilt, 3, 1, belly);
  box(ctx, side > 0 ? head + 2 : head, y - 2 + tilt, 1, 1, pick(HERON.dark, night));
  const fin = side > 0 ? tail - 1 : tail + 3;
  box(ctx, fin, y - 3 - tilt, 1, 1, back);
  box(ctx, fin, y - tilt, 1, 1, back);
}

const SKATERS: Resident[] = [
  { ...DEFAULT_RESIDENT, figure: 'female', skin: '#D9B28E', hair: '#3E3530', outfit: '#B0615A' },
  { ...DEFAULT_RESIDENT, skin: '#C99A74', hair: '#2F2A26', outfit: '#4F6F8F', accessory: 'hat' },
];
export function drawSceneSkater(ctx: Ctx, skater: Skater) {
  if (skater.opacity <= 0) return;
  const s = project(skater.position.x, skater.position.y);
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * clamp01(skater.opacity);
  drawResident(ctx, SKATERS[skater.id % SKATERS.length], s.x, s.y, 1.25, {
    moving: false,
    facing: skater.facing,
    walkPhase: skater.phase,
    greeting: false,
    pose: 'skate',
  });
  ctx.globalAlpha = alpha;
}

// The mill's two faces towards us, drawn in their own skewed frames: the south (eave) face runs
// along x, the east (gable) face along y.
const MILL_SW = at(MILL.left, MILL.bottom),
  MILL_SE = at(MILL.right, MILL.bottom);
const MILL_FACE = (MILL.right - MILL.left) * 38;
const MILL_END = (MILL.bottom - MILL.top) * 38;
/** The mill: a stone base, a boarded timber storey, a slate roof along x with a gable end and
 * its door facing the wheel bay. Its windows are dark: nobody lives here. */
export function drawMill(ctx: Ctx, night: boolean, yearDay: number) {
  const c = (pair: Pair) => pick(pair, night);
  // South face.
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, MILL_SW.x, MILL_SW.y);
  box(ctx, 0, -BASE, MILL_FACE, BASE, c(MILL_COLOURS.stone));
  box(ctx, 0, -8, MILL_FACE, 1, c(MILL_COLOURS.mortar));
  box(ctx, 0, -15, MILL_FACE, 1, c(MILL_COLOURS.mortar));
  for (const [u, v] of [
    [8, -7],
    [27, -7],
    [46, -7],
    [17, -14],
    [37, -14],
    [55, -14],
    [10, -21],
    [30, -21],
    [49, -21],
  ])
    box(ctx, u, v, 1, 6, c(MILL_COLOURS.mortar));
  box(ctx, 0, -EAVE, MILL_FACE, EAVE - BASE, c(MILL_COLOURS.timber));
  for (let u = 6; u < MILL_FACE - 2; u += 7)
    box(ctx, u, -EAVE, 1, EAVE - BASE, c(MILL_COLOURS.board));
  box(ctx, 0, -BASE - 2, MILL_FACE, 2, c(MILL_COLOURS.beam));
  box(ctx, 0, -EAVE, MILL_FACE, 2, c(MILL_COLOURS.beam));
  for (const u of [11, 41]) {
    box(ctx, u, -44, 9, 11, c(MILL_COLOURS.frame));
    box(ctx, u + 1, -43, 7, 9, c(MILL_COLOURS.window));
    box(ctx, u + 4, -43, 1, 9, c(MILL_COLOURS.frame));
  }
  ctx.restore();
  // East face: the gable end, with the door onto the wheel bay's path.
  ctx.save();
  ctx.transform(1, -0.5, 0, 1, MILL_SE.x, MILL_SE.y);
  box(ctx, 0, -BASE, MILL_END, BASE, c(MILL_COLOURS.stoneSide));
  box(ctx, 0, -8, MILL_END, 1, c(MILL_COLOURS.mortarSide));
  box(ctx, 0, -15, MILL_END, 1, c(MILL_COLOURS.mortarSide));
  for (const [u, v] of [
    [30, -7],
    [48, -7],
    [26, -14],
    [44, -14],
    [34, -21],
    [53, -21],
  ])
    box(ctx, u, v, 1, 6, c(MILL_COLOURS.mortarSide));
  box(ctx, 0, -EAVE, MILL_END, EAVE - BASE, c(MILL_COLOURS.timberSide));
  for (let u = 5; u < MILL_END - 2; u += 7)
    box(ctx, u, -EAVE, 1, EAVE - BASE, c(MILL_COLOURS.boardSide));
  box(ctx, 0, -BASE - 2, MILL_END, 2, c(MILL_COLOURS.beam));
  // The gable, boarded, with a loft door.
  const peak = MILL_END / 2;
  shape(
    ctx,
    [
      { x: 0, y: -EAVE },
      { x: MILL_END, y: -EAVE },
      { x: peak, y: -RIDGE },
    ],
    c(MILL_COLOURS.timberSide),
  );
  for (const u of [peak - 14, peak - 7, peak + 7, peak + 14]) {
    const rise = (1 - Math.abs(u - peak) / peak) * (RIDGE - EAVE);
    box(ctx, u, -EAVE - rise + 2, 1, rise - 2, c(MILL_COLOURS.boardSide));
  }
  box(ctx, peak - 5, -69, 10, 11, c(MILL_COLOURS.frame));
  box(ctx, peak - 4, -68, 8, 10, c(MILL_COLOURS.window));
  // The door, between its frame posts, and a window above it.
  const door = (MILL.bottom - MILL.door.to) * 38,
    doorWidth = (MILL.door.to - MILL.door.from) * 38;
  box(ctx, door - 1, -21, doorWidth + 2, 21, c(MILL_COLOURS.frame));
  box(ctx, door, -20, doorWidth, 20, c(MILL_COLOURS.door));
  box(ctx, door + doorWidth / 2, -20, 1, 20, c(MILL_COLOURS.beam));
  box(ctx, door + 1, -44, 8, 10, c(MILL_COLOURS.frame));
  box(ctx, door + 2, -43, 6, 8, c(MILL_COLOURS.window));
  ctx.restore();
  // The roof: the south slope towards us, the ridge and the gable's verge boards. The north
  // slope is steeper than the view, so it is out of sight behind the ridge.
  const sw = at(MILL.left, MILL.bottom, EAVE),
    se = at(MILL.right, MILL.bottom, EAVE),
    ne = at(MILL.right, MILL.top, EAVE),
    rw = at(MILL.left, RIDGE_Y, RIDGE),
    re = at(MILL.right, RIDGE_Y, RIDGE);
  shape(
    ctx,
    [{ x: sw.x, y: sw.y + 2 }, { x: se.x, y: se.y + 2 }, re, rw],
    c(MILL_COLOURS.roofLight),
  );
  ctx.strokeStyle = c(MILL_COLOURS.course);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const f of [0.2, 0.4, 0.6, 0.8]) {
    ctx.moveTo(lerp(sw.x, rw.x, f), lerp(sw.y + 2, rw.y, f));
    ctx.lineTo(lerp(se.x, re.x, f), lerp(se.y + 2, re.y, f));
  }
  ctx.stroke();
  ctx.strokeStyle = c(MILL_COLOURS.trim);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(se.x, se.y + 1);
  ctx.lineTo(re.x, re.y);
  ctx.lineTo(ne.x, ne.y + 1);
  ctx.moveTo(rw.x, rw.y);
  ctx.lineTo(re.x, re.y);
  ctx.stroke();
  // Snow settles on the roof and thaws with the town's roofs.
  const snow = snowAt(yearDay, seedFraction('millpond:mill'));
  if (snow > 0) {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * Math.min(1, snow);
    shape(
      ctx,
      [
        rw,
        re,
        { x: lerp(re.x, se.x, 0.75), y: lerp(re.y, se.y, 0.75) + 1 },
        { x: lerp(rw.x, sw.x, 0.75), y: lerp(rw.y, sw.y, 0.75) + 1 },
      ],
      pick(SNOW.top, night),
    );
    // The snow's thickness along its lower edge.
    ctx.strokeStyle = pick(SNOW.shade, night);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lerp(rw.x, sw.x, 0.75), lerp(rw.y, sw.y, 0.75) + 2);
    ctx.lineTo(lerp(re.x, se.x, 0.75), lerp(re.y, se.y, 0.75) + 2);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }
}

/** The waterwheel on the mill's east wall: eight paddles turning through the wheel bay, or held
 * still in the ice. */
export function drawWheel(ctx: Ctx, night: boolean, angle: number | null) {
  const c = (pair: Pair) => pick(pair, night);
  const { wheel } = MILL;
  const hub = at(wheel.x, wheel.y, wheel.hub);
  // The wheel stands in a plane of constant x: `u` runs north along y (38 px a tile, rising half
  // as much on screen), `v` straight down. Everything is cut at the waterline, `v = hub`.
  const across = wheel.radius * 38,
    tall = 20;
  const turn = angle ?? Math.PI / 16;
  const point = (theta: number, k: number) => {
    const u = k * across * Math.cos(theta),
      v = k * tall * Math.sin(theta);
    return { x: hub.x + u, y: hub.y - u / 2 + v, v };
  };
  type WheelPoint = ReturnType<typeof point>;
  const above = (a: WheelPoint, b: WheelPoint): [WheelPoint, WheelPoint] | null => {
    if (a.v > wheel.hub && b.v > wheel.hub) return null;
    if (a.v <= wheel.hub && b.v <= wheel.hub) return [a, b];
    const t = (wheel.hub - a.v) / (b.v - a.v);
    const cut = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), v: wheel.hub };
    return a.v <= wheel.hub ? [a, cut] : [cut, b];
  };
  const segments = (pairs: [WheelPoint, WheelPoint][]) => {
    ctx.beginPath();
    for (const [a, b] of pairs) {
      const part = above(a, b);
      if (!part) continue;
      ctx.moveTo(part[0].x, part[0].y);
      ctx.lineTo(part[1].x, part[1].y);
    }
    ctx.stroke();
  };
  // The axle from the wall.
  const wall = at(MILL.right, wheel.y, wheel.hub);
  ctx.strokeStyle = c(MILL_COLOURS.beam);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(wall.x, wall.y);
  ctx.lineTo(hub.x, hub.y);
  ctx.stroke();
  // The rim, as sixteen straight pieces above the water, then the spokes and the paddles.
  ctx.strokeStyle = c(MILL_COLOURS.rim);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i <= 16; i++) {
    const p = point((i / 16) * Math.PI * 2, 1);
    if (p.v > wheel.hub - 1) {
      pen = false;
      continue;
    }
    if (pen) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
    pen = true;
  }
  ctx.stroke();
  const arms = Array.from({ length: 8 }, (_, k) => turn + (k * Math.PI) / 4);
  segments(arms.map((a) => [point(a, 0), point(a, 0.97)]));
  ctx.strokeStyle = c(MILL_COLOURS.paddle);
  ctx.lineWidth = 3;
  segments(arms.map((a) => [point(a, 0.72), point(a, 0.98)]));
  box(ctx, hub.x - 2, hub.y - 2, 4, 4, c(MILL_COLOURS.beam));
  const water = at(wheel.x, wheel.y);
  if (angle === null) {
    // Held fast: a few icicles hang from the lowest paddles.
    for (const dx of [-9, -2, 6])
      box(ctx, water.x + dx, water.y - 8 + Math.abs(dx) / 3, 1, 4, pick(ICE.crackLight, night));
  } else {
    // White water where the paddles meet the bay.
    for (const [dx, k] of [
      [-12, 0],
      [0, 1],
      [11, 2],
    ]) {
      const w = 3 + Math.round((Math.sin(angle * 4 + k * 2.1) + 1) * 1.5);
      box(ctx, water.x + dx - w / 2, water.y - 0.5 * dx - 1, w, 1, c(MILL_COLOURS.foam));
    }
  }
}

/** The gate sign: a small timber plaque on two short posts, skewed along the south road, east of
 * the gate lane and of every skater's column. */
const SIGN = { width: 100, height: 20, rise: 28, fontSize: 11 };
const SIGN_POINT = project(MILLPOND_SIGN.x, MILLPOND_SIGN.y);
/**
 * The sign's paint and hit depth: its far (west) end. It is one depth object: wherever a walker on
 * the south road overlaps it on screen, that walker stands nearer than its far end, so they are
 * painted over it and keep their click; and whatever is behind it (a skater walking up the
 * easternmost column) is painted under it and loses the click to it. So nothing needs the plaque
 * cut into strips, and its lettering is painted once.
 */
export const MILLPOND_SIGN_DEPTH = MILLPOND_SIGN.x + MILLPOND_SIGN.y - SIGN.width / 2 / 38;
/** The plaque's box on screen (world px), for tests. */
export const MILLPOND_SIGN_BOX = { ...SIGN, point: SIGN_POINT };
export function millpondSignHit(point: Point) {
  const x = point.x - SIGN_POINT.x;
  const y = point.y - SIGN_POINT.y - x * 0.5;
  return (
    x >= -SIGN.width / 2 && x <= SIGN.width / 2 && y >= -SIGN.rise && y <= -SIGN.rise + SIGN.height
  );
}
export function drawSign(ctx: Ctx, night: boolean) {
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, SIGN_POINT.x, SIGN_POINT.y);
  for (const side of [-1, 1]) {
    const x = side * (SIGN.width / 2 - 13);
    box(ctx, x - 2, -SIGN.rise + 8, 4, SIGN.rise - 8, night ? '#6E7560' : '#927B59');
    box(ctx, x - 2, -SIGN.rise + 8, 1, SIGN.rise - 8, night ? '#919274' : '#B8A078');
    box(ctx, x - 4, -2, 8, 3, night ? '#647B68' : '#A5B47F');
  }
  drawVenueTitle(ctx, {
    x: 0,
    y: -SIGN.rise,
    width: SIGN.width,
    height: SIGN.height,
    title: 'The Millpond',
    fontSize: SIGN.fontSize,
    night,
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Layer 3: the objects

/** The pond's upright art as depth objects, each at the depth of its ground contact. */
export function drawMillpond(ctx: Ctx, opts: MillpondOptions): MillpondObject[] {
  const { minutes, day, night, season, visible } = opts;
  const objects: MillpondObject[] = [];
  if (!visible(project(17.5, 33.5), 520, 300, 250)) return objects;
  const scene = millpondSceneAt(minutes, day);
  const yearDay = season.yearDay;
  const add = (
    part: MillpondPart,
    ground: Point,
    depth: number,
    reach: [rx: number, above: number, below: number],
    paint: () => void,
    slope = 0,
  ) => {
    if (visible(project(ground.x, ground.y), ...reach))
      objects.push({ part, ground, depth, paint, slope });
  };
  // Reeds in two halves, so a bird or a boat among them has stalks behind and in front.
  for (const reed of MILLPOND_REEDS) {
    const depth = reed.x + reed.y;
    add('reeds', reed, depth - 0.01, [24, 24, 6], () =>
      drawReeds(ctx, reed, night, yearDay, 'back'),
    );
    add('reeds', reed, depth + 0.01, [24, 24, 6], () =>
      drawReeds(ctx, reed, night, yearDay, 'front'),
    );
  }
  for (const y of [JETTY.to + 0.1, (JETTY.to + JETTY.from) / 2, JETTY.from - 0.15])
    for (const x of [JETTY_LEFT, JETTY_RIGHT]) {
      const post = { x, y };
      add('posts', post, x + y, [4, 10, 3], () => {
        const s = project(x, y);
        const snowy = snowAt(yearDay, groundFraction(hash(`millpond:post:${x},${y}`), 1)) > 0.5;
        box(ctx, Math.round(s.x) - 1, Math.ceil(s.y) - 8, 3, 10, pick(WOOD.post, night));
        box(
          ctx,
          Math.round(s.x) - 1,
          Math.ceil(s.y) - 8,
          3,
          1,
          pick(snowy ? SNOW.top : WOOD.postTop, night),
        );
      });
    }
  for (const boat of scene.boats)
    add('boats', boat.position, boat.position.x + boat.position.y, [40, 36, 12], () =>
      drawBoat(ctx, boat, night, yearDay),
    );
  const fisher = scene.fisher;
  if (fisher) {
    // Walking out along the jetty before seven, home again after.
    const leaving = mod(minutes, 1440) > 375;
    const { position } = fisherWalk(fisher, leaving);
    add('fisher', position, position.x + position.y, [34, 40, 12], () =>
      drawFisher(ctx, fisher, night, leaving),
    );
  }
  const heron = scene.heron;
  if (heron)
    add('heron', heron.position, heron.position.x + heron.position.y, [30, 36, 8], () =>
      drawHeron(ctx, heron, night),
    );
  for (const rise of scene.rises.filter((r) => r.leap && clamp01(r.progress) < LEAP).slice(0, 2))
    if (rise.leap)
      add('fish', rise.position, rise.position.x + rise.position.y, [16, 20, 4], () =>
        drawLeapingFish(ctx, rise, night),
      );
  for (const skater of scene.skaters.slice(0, 2))
    add('skaters', skater.position, skater.position.x + skater.position.y, [16, 40, 6], () =>
      drawSceneSkater(ctx, skater),
    );
  const millGround = { x: (MILL.left + MILL.right) / 2, y: RIDGE_Y };
  add('mill', millGround, MILL_DEPTH, [90, 140, 50], () => drawMill(ctx, night, yearDay));
  add(
    'wheel',
    { x: MILL.wheel.x, y: MILL.wheel.y },
    WHEEL_DEPTH,
    [34, 50, 20],
    () => drawWheel(ctx, night, scene.wheel),
    -0.5,
  );
  add('sign', MILLPOND_SIGN, MILLPOND_SIGN_DEPTH, [56, 56, 30], () => drawSign(ctx, night), 0.5);
  return objects;
}
