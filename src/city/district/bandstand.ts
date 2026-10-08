// The Bandstand on K15 (agent C, SPEC §4.2): a low octagonal stand, 40 px at most with its cap and
// peak lamp, on six slender posts under a shallow green-and-cream cap; the night's three players,
// who fade in at 15:45, take their tea on the steps 17:30–18:15 and are gone by 20:15; the eight
// deckchairs per BANDSTAND_FURNITURE, stacked by the stand otherwise; and the peak lamp, lit in the
// streetlamp wave and dark on star nights. Render cap: 500 calls with the players (SPEC §6.6).
// The stand's own art is static, so it is painted once per look into two cached layers: what
// stands behind the players, and what stands in front of them. The Landing (landing.ts) borrows
// the cache and the scenery figures.
// No Math.random, Date.now or performance.now: everything runs on the town clock.
import { bandOf, starNight, type Band } from '../../lib/district-calendar';
import {
  BANDSTAND_FURNITURE,
  BANDSTAND_VENUE,
  DISTRICT_SPOTS,
  type Spot,
} from '../../lib/district-places';
import { eveningMinutes, FORK_PLOT, lampLightsAt } from '../../lib/lanterns';
import { AUTUMN, groundFraction, SPRING, snowAt, WINTER } from '../../lib/seasons';
import type { EventPose } from '../../lib/events';
import type { ResidentState } from '../../lib/simulation';
import { getPlot, project, type Point } from '../../lib/world';
import type {
  DepthObject,
  DistrictGroundScene,
  DistrictHit,
  DistrictPainter,
  DistrictScene,
} from '../district-art';
import { drawGlow } from '../glow';
import { tint } from '../houses';
import { MAX_LAMP_DISTANCE, MIN_LAMP_DISTANCE } from '../lamplight';
import { BANDSTAND_NOTE } from '../residents';
import { BLOSSOM, FALLEN_LEAVES, pick, SNOW, type Pair } from '../season-palette';
import { groundTuft } from '../season-ground';

type Ctx = CanvasRenderingContext2D;
type Facing = Spot['facing'];

// ---------------------------------------------------------------------------------------------
// Shared with the Landing: points, fades, cached layers and the scenery figures.

/** World px of a tile point, `rise` px above the ground. */
export const iso = (x: number, y: number, rise = 0): Point => {
  const p = project(x, y);
  return { x: p.x, y: p.y - rise };
};
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export const smooth = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
/** 0 → 1 over `span` minutes from `from`, eased: the art's fades never jump. */
export const ease = (minutes: number, from: number, span: number) =>
  smooth((minutes - from) / span);

export function fill(ctx: Ctx, points: readonly Point[], color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
}
export function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** A box in world px, for a cached layer. */
export type Box = { left: number; top: number; width: number; height: number };
type Layer = {
  canvas: HTMLCanvasElement;
  ctx: Ctx;
  key: string;
  scale: number;
  /** A new zoom, and how many frames in a row it has held. */
  pending: { scale: number; frames: number };
};
const layers = new WeakMap<Ctx, Map<string, Layer>>();
/** Where a layer over `area` lands in device px, or null to paint it straight onto `ctx`. */
function layerFrame(ctx: Ctx, area: Box) {
  if (typeof document === 'undefined' || typeof ctx.getTransform !== 'function') return null;
  const t = ctx.getTransform();
  const scale = t.a;
  const w = Math.ceil(area.width * scale),
    h = Math.ceil(area.height * scale);
  if (t.b || t.c || t.d !== scale || scale <= 0 || !w || !h || w * h > 4_000_000) return null;
  return {
    scale,
    w,
    h,
    x: Math.round(t.e + area.left * scale),
    y: Math.round(t.f + area.top * scale),
  };
}
/**
 * Paints static art through an offscreen copy at the device scale, one per canvas (the dusk's
 * second look keeps its own). The copy is remade when its key (the art's kind, the season's day
 * and the night) changes, or once a new zoom has held for three frames: a pinch paints straight
 * onto the map rather than remaking the copy every frame. Without a document (tests), or under a
 * skewed transform, it always paints straight on.
 */
export function cachedArt(
  ctx: Ctx,
  name: string,
  key: string,
  area: Box,
  paint: (target: Ctx) => void,
) {
  const frame = layerFrame(ctx, area);
  if (!frame) return paint(ctx);
  let all = layers.get(ctx);
  if (!all) layers.set(ctx, (all = new Map()));
  let layer = all.get(name);
  if (!layer) {
    const canvas = document.createElement('canvas');
    const target = canvas.getContext('2d');
    if (!target) return paint(ctx);
    layer = { canvas, ctx: target, key: '', scale: 0, pending: { scale: 0, frames: 0 } };
    all.set(name, layer);
  }
  if (layer.key !== key || layer.scale !== frame.scale) {
    if (layer.pending.scale !== frame.scale) layer.pending = { scale: frame.scale, frames: 0 };
    layer.pending.frames++;
    // A new look is painted at once; a new zoom only once it has settled.
    if (layer.key === key && layer.pending.frames < 3) return paint(ctx);
    layer.canvas.width = frame.w;
    layer.canvas.height = frame.h;
    const s = frame.scale;
    layer.ctx.setTransform(s, 0, 0, s, -area.left * s, -area.top * s);
    paint(layer.ctx);
    layer.key = key;
    layer.scale = frame.scale;
  }
  ctx.save();
  ctx.resetTransform();
  ctx.drawImage(layer.canvas, frame.x, frame.y);
  ctx.restore();
}

/** A scenery figure's colours: never a neighbor, never counted. */
export type Look = { skin: string; hair: string; outfit: string; female?: boolean };
/** Paints a rect in the figure's own px, mirrored and scaled with it, inked for the night. */
export type FigureRect = (x: number, y: number, w: number, h: number, color: string) => void;
export type FigureHands = (r: FigureRect, look: Look, bob: number) => void;
export type Figure = {
  look: Look;
  facing: Facing;
  /** Standing, walking (with `phase`), halfway down, or sat on something `seat` own px high. */
  stance: 'stand' | 'walk' | 'crouch' | 'seat';
  seat?: number;
  phase?: number;
  /** Px the body rises (negative) or sinks, on top of the stance's own. */
  lift?: number;
  /** Arms and whatever they hold, over the body; both arms hang when absent. */
  hands?: FigureHands;
  /** Anything behind the body: a far arm, a tuba's bell over the shoulder. */
  behind?: FigureHands;
  /** A peaked cap in this colour, or a flat cap with `flat`. */
  cap?: string;
  flat?: boolean;
  scarf?: string;
  night: boolean;
  alpha?: number;
};
/** The town's figures stand 1.25 times their own px (render.ts' RESIDENT_SCALE). */
export const FIGURE_SCALE = 1.25;
/** Feet to the top of the hair, in world px. */
export const FIGURE_HEIGHT = 22 * FIGURE_SCALE;
const SHADOW = '#23341B30';
/**
 * A scenery figure drawn the way the town draws its neighbors (residents.ts): the same body, head
 * and hair, so a player or a boatwright reads as one of the town's own people. Only the arms are
 * the scene's, to hold an instrument, a teacup, a paper boat or a net.
 */
export function drawFigure(ctx: Ctx, x: number, y: number, figure: Figure) {
  const alpha = figure.alpha ?? 1;
  if (alpha <= 0) return;
  const { look, night } = figure;
  const ink = (color: string) => (night ? tint(color, -35) : color);
  const left = figure.facing === 'sw' || figure.facing === 'nw';
  const back = figure.facing === 'ne' || figure.facing === 'nw';
  const before = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha = before * alpha;
  ctx.translate(x, y);
  ctx.scale(left ? -FIGURE_SCALE : FIGURE_SCALE, FIGURE_SCALE);
  box(ctx, -5, 0, 10, 2, SHADOW);
  const r: FigureRect = (rx, ry, w, h, color) => box(ctx, rx, ry, w, h, ink(color));
  const seated = figure.stance === 'seat';
  const seat = figure.seat ?? 7;
  const stride = figure.stance === 'walk' ? Math.sin((figure.phase ?? 0) * Math.PI * 2) : 0;
  const swing = Math.round(stride * 2);
  const bob =
    (figure.lift ?? 0) +
    (seated
      ? 5 - seat
      : figure.stance === 'crouch'
        ? 2
        : figure.stance === 'walk'
          ? -Math.round(Math.abs(stride) * 0.8)
          : 0);
  const outfit = look.outfit,
    shade = tint(look.outfit, -24);
  if (seated) ctx.translate(-3, 0);
  figure.behind?.(r, look, bob);
  if (!figure.hands) {
    r(-4, -11 + bob - swing, 2, 6, shade);
    r(-4, -6 + bob - swing, 2, 2, look.skin);
  }
  // Legs: standing, striding, bent halfway, or shins down from a seat.
  if (seated) {
    r(2, -seat, 2, seat, '#3C4744');
    r(2, -1, 4, 2, '#3C4744');
    r(4, 1 - seat, 2, seat - 1, '#53605A');
    r(4, -1, 4, 2, '#35413D');
  } else if (figure.stance === 'crouch') {
    r(-2, -4, 2, 4, '#3C4744');
    r(-2, -1, 4, 2, '#3C4744');
    r(1, -5, 5, 2, '#53605A');
    r(4, -4, 2, 3, '#53605A');
    r(3, -1, 4, 2, '#35413D');
  } else {
    const near = Math.max(0, Math.round(stride * 2)),
      far = Math.max(0, Math.round(-stride * 2));
    r(-2 - swing, -6, 2, 6 - far, '#3C4744');
    r(-2 - swing, -1 - far, 4, 2, '#3C4744');
    r(1 + swing, -6, 2, 6 - near, '#53605A');
    r(1 + swing, -1 - near, 4, 2, '#35413D');
  }
  if (look.female) {
    r(-5, -20 + bob, 9, 9, tint(look.hair, -18));
    r(-3, -13 + bob, 7, 3, outfit);
    r(-2, -10 + bob, 5, 3, outfit);
    r(-3, -7 + bob, 7, 3, outfit);
    r(-3, -12 + bob, 1, 2, shade);
  } else {
    r(-3, -13 + bob, 7, 9, outfit);
    r(-3, -12 + bob, 2, 8, shade);
  }
  r(-1, -13 + bob, 4, 1, tint(outfit, 16));
  if (seated) r(-2, -seat - 1, 8, 2, '#53605A');
  // The head, the hair and the face, as residents.ts draws them.
  r(-3, -21 + bob, 7, 8, look.skin);
  r(4, -18 + bob, 1, 2, look.skin);
  r(-4, -22 + bob, 8, 3, look.hair);
  r(-4, -20 + bob, back ? 7 : 3, back ? 6 : 4, look.hair);
  r(-3, -22 + bob, 4, 1, tint(look.hair, 18));
  if (!back) {
    r(1, -18 + bob, 1, 1, '#35453D');
    r(3, -18 + bob, 1, 1, '#35453D');
    r(3, -15 + bob, 1, 1, tint(look.skin, -28));
  }
  if (look.female) {
    r(-4, -20 + bob, 2, 9, look.hair);
    r(1, -21 + bob, 3, 1, look.hair);
  }
  if (figure.cap) {
    // A peaked band cap, or a flat cap: the crown over the hair, the peak over the brow.
    r(-4, figure.flat ? -23 + bob : -24 + bob, 8, figure.flat ? 2 : 3, figure.cap);
    r(-4, -22 + bob, 8, 1, tint(figure.cap, figure.flat ? -18 : 40));
    r(2, -21 + bob, figure.flat ? 3 : 4, 1, tint(figure.cap, -24));
  }
  if (figure.scarf) {
    r(-3, -14 + bob, 7, 2, figure.scarf);
    r(-3, -12 + bob, 2, 3, tint(figure.scarf, -16));
  }
  if (figure.hands) figure.hands(r, look, bob);
  else {
    r(3, -11 + bob + swing, 2, 6, outfit);
    r(3, -6 + bob + swing, 2, 2, look.skin);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// The stand.

/** The stand's centre: the plot's north half, local (0.25, −0.6) from K15's centre. */
export const STAND = { x: 59.75, y: 42.9 } as const;
const G = project(STAND.x, STAND.y);
/** A point on the stand, from its centre in tiles, `rise` px up. */
const at = (dx: number, dy: number, rise = 0): Point => ({
  x: G.x + (dx - dy) * 38,
  y: G.y + (dx + dy) * 19 - rise,
});
/** Its eight corners at radius `r`: k = 0 is the front right, 1 the front left, then round. */
const corner = (r: number, k: number) => {
  const a = ((22.5 + 45 * k) * Math.PI) / 180;
  return { dx: r * Math.cos(a), dy: r * Math.sin(a) };
};
const ring = (r: number, rise: number) =>
  Array.from({ length: 8 }, (_, k) => {
    const c = corner(r, k);
    return at(c.dx, c.dy, rise);
  });
/** Radii in tiles: the plinth about 1.4 tiles across, the posts, and the cap's eave. */
const PLINTH = 0.72,
  POSTS = 0.58,
  EAVE_R = 0.64;
/** Px above the lawn: the deck, the lower step, the valance's hem, the eave and the peak. */
const DECK = 4,
  STEP = 2,
  VALANCE = 32,
  EAVE = 34,
  PEAK = 36.5;
/** The stand's height, cap and peak lamp included: the stage's rule (SPEC §2.4). */
export const BANDSTAND_HEIGHT = 40;
export const STAND_DEPTH = STAND.x + STAND.y;

const P = {
  lawn: ['#BFD5A4', '#577468'],
  gravel: ['#DCD3B4', '#7D8573'],
  gravelEdge: ['#CBC19F', '#6D7667'],
  plinthLeft: ['#E0D7BC', '#81887A'],
  plinthFront: ['#D2C8AA', '#767D70'],
  plinthRight: ['#C2B797', '#697064'],
  deck: ['#C6A57B', '#736A59'],
  plank: ['#B38F64', '#665E4F'],
  stepTop: ['#E4DCC3', '#858C7E'],
  post: ['#F1ECDD', '#A1AAA0'],
  postShade: ['#D3CDBA', '#858E85'],
  rail: ['#ECE6D4', '#99A298'],
  valance: ['#F1E9D3', '#9AA398'],
  valanceShade: ['#DCD1B5', '#868E85'],
  green: ['#5E8B76', '#3A5A4F'],
  greenLight: ['#6E9C86', '#44665A'],
  greenDark: ['#4E7766', '#314D45'],
  cream: ['#F0E8D2', '#99A297'],
  creamDark: ['#DCD2B7', '#878F86'],
  finial: ['#4E7766', '#314D45'],
  lampOff: ['#ECE5CA', '#7C8272'],
  shadow: ['#23341B26', '#0B171533'],
  note: BANDSTAND_NOTE,
  pot: ['#7FA39A', '#4F6A64'],
  potLid: ['#5F8278', '#3E5650'],
} satisfies Record<string, Pair>;
/** The peak lamp, lit: the streetlamps' own light. */
const LAMP_LIT = '#F4D79A',
  LAMP_CORE = '#FFF6D8';

/** A face of `w` px along an iso axis from its left foot `a`, `h` px tall. */
function face(ctx: Ctx, a: Point, along: 'x' | 'y', w: number, h: number, color: string) {
  ctx.save();
  ctx.transform(1, along === 'x' ? 0.5 : -0.5, 0, 1, a.x, a.y);
  box(ctx, 0, -h, w, h, color);
  ctx.restore();
}
/** A sloped bar from `a` to `b`, `h` px thick: a rail or a valance. */
function bar(ctx: Ctx, a: Point, b: Point, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x, b.y + h);
  ctx.lineTo(a.x, a.y + h);
  ctx.fill();
}
/** The left and right ends of a convex outline at a screen row. */
function spanAt(outline: readonly Point[], y: number) {
  let left = Infinity,
    right = -Infinity;
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length];
    if ((a.y - y) * (b.y - y) > 0 || a.y === b.y) return;
    const x = a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
    left = Math.min(left, x);
    right = Math.max(right, x);
  });
  return { left, right };
}
const pointAt = (c: { dx: number; dy: number }, rise: number) => at(c.dx, c.dy, rise);
/** The edge from corner k to k + 1 runs along the town's x (k 1, 5), its y (k 3, 7), or across
 *  the screen (k 0, 4); the other two are seen end on. */
const EDGE_LENGTH = 2 * PLINTH * Math.sin(Math.PI / 8);

/** The plinth's three faces that look toward us, darkest on the right, its deck and steps. */
function plinth(ctx: Ctx, night: boolean) {
  const c = (k: number) => corner(PLINTH, k);
  const px = EDGE_LENGTH * 38;
  face(ctx, pointAt(c(2), 0), 'x', px, DECK, pick(P.plinthLeft, night));
  face(ctx, pointAt(c(0), 0), 'y', px, DECK, pick(P.plinthRight, night));
  const front = pointAt(c(1), 0);
  box(ctx, front.x, front.y - DECK, pointAt(c(0), 0).x - front.x, DECK, pick(P.plinthFront, night));
  const top = ring(PLINTH, DECK);
  fill(ctx, top, pick(P.deck, night));
  // Boards across the deck, parallel to its front edge.
  ctx.fillStyle = pick(P.plank, night);
  for (let j = -2; j <= 2; j++) {
    const y = Math.round(G.y - DECK + j * 6.5);
    const { left, right } = spanAt(top, y);
    ctx.fillRect(Math.round(left) + 3, y, Math.round(right - left) - 6, 1);
  }
  // Two stone steps up the front, toward the lawn and the chairs: treads and risers.
  const half = 0.24 * 53.74,
    deep = 0.1 * 26.87;
  for (const [out, low, high] of [
    [0.9, 0, STEP],
    [0.8, STEP, DECK],
  ]) {
    const foot = G.y + out * 26.87;
    box(ctx, G.x - half, foot - high - deep, half * 2, deep, pick(P.stepTop, night));
    box(ctx, G.x - half, foot - high, half * 2, high - low, pick(P.plinthFront, night));
  }
}

/** Six slender posts round the back and sides; the front stays open to the lawn. */
const POST_CORNERS = [2, 3, 4, 5, 6, 7];
function posts(ctx: Ctx, night: boolean) {
  for (const k of POST_CORNERS) {
    const foot = pointAt(corner(POSTS, k), DECK);
    const x = Math.round(foot.x);
    box(ctx, x - 1, foot.y - (VALANCE - DECK), 2, VALANCE - DECK, pick(P.post, night));
    box(ctx, x, foot.y - (VALANCE - DECK), 1, VALANCE - DECK, pick(P.postShade, night));
  }
}

/** Low railings round the deck's edge: the back behind the players, the sides in front. */
const RAIL = 6;
function railings(ctx: Ctx, night: boolean, edges: readonly number[]) {
  const color = pick(P.rail, night);
  const r = (k: number) => corner(PLINTH - 0.05, k);
  for (const k of edges) {
    const a = r(k),
      b = r((k + 1) % 8);
    const mid = { dx: (a.dx + b.dx) / 2, dy: (a.dy + b.dy) / 2 };
    // Balusters at the near corner and the middle; the far corner is the next edge's.
    for (const p of [a, mid]) {
      const foot = pointAt(p, DECK);
      box(ctx, Math.round(foot.x), foot.y - RAIL, 1, RAIL, color);
    }
    // The handrail, unless the edge is seen end on.
    if (k === 2 || k === 6) continue;
    bar(ctx, pointAt(a, DECK + RAIL), pointAt(b, DECK + RAIL), 1.5, color);
  }
}

/** The cap: a scalloped valance, eight wedges in green and cream, and the peak lamp. */
function roof(ctx: Ctx, night: boolean, groundDay: number) {
  const eave = ring(EAVE_R, EAVE);
  const tall = EAVE - VALANCE;
  // The valance on the three edges facing us (the two side edges are seen end on).
  bar(ctx, eave[1], eave[2], tall, pick(P.valance, night));
  bar(ctx, eave[7], eave[0], tall, pick(P.valanceShade, night));
  box(ctx, eave[1].x, eave[1].y, eave[0].x - eave[1].x, tall, pick(P.valance, night));
  // Scallops along its hem.
  ctx.fillStyle = pick(P.valanceShade, night);
  for (const [a, b] of [
    [eave[2], eave[1]],
    [eave[1], eave[0]],
    [eave[0], eave[7]],
  ])
    for (const f of [0.33, 0.67])
      ctx.fillRect(Math.round(a.x + (b.x - a.x) * f) - 1, a.y + (b.y - a.y) * f + tall - 1, 2, 2);
  const peak = at(0, 0, PEAK);
  // The back wedges first, then the front: on a shallow cap every wedge shows.
  for (const k of [4, 3, 5, 2, 6, 1, 7, 0]) {
    const n = (k + 1) % 8;
    const green = k % 2 === 0;
    // Wedges turned to the right are a shade darker, those to the left a shade lighter.
    const shade = k === 6 || k === 7 || k === 0 ? 'dark' : k === 1 || k === 2 ? 'light' : 'mid';
    const color = green
      ? shade === 'dark'
        ? P.greenDark
        : shade === 'light'
          ? P.greenLight
          : P.green
      : shade === 'dark'
        ? P.creamDark
        : P.cream;
    fill(ctx, [peak, eave[k], eave[n]], pick(color, night));
  }
  // Spring petals and autumn leaves come to rest on the cap, a few more each day.
  const petals = groundDay >= SPRING + 3 && groundDay < SPRING + 22;
  const leaves = groundDay >= AUTUMN + 10 && groundDay < WINTER + 2;
  if (petals || leaves)
    for (let i = 0; i < 9; i++) {
      const when = groundFraction(i, 1);
      if (groundDay < (petals ? SPRING + 3 : AUTUMN + 10) + Math.floor(when * 8)) continue;
      const a = groundFraction(i, 2) * Math.PI * 2,
        d = 0.15 + groundFraction(i, 3) * 0.4;
      const p = at(Math.cos(a) * d, Math.sin(a) * d, PEAK - (PEAK - EAVE) * (d / EAVE_R));
      const color = petals
        ? i % 3
          ? BLOSSOM.pink
          : BLOSSOM.white
        : FALLEN_LEAVES[i % FALLEN_LEAVES.length];
      box(ctx, Math.round(p.x), Math.round(p.y), 2, 1, pick(color, night));
    }
  // The peak lamp on the cap's crown, under its own small hood.
  const x = Math.round(peak.x);
  box(ctx, x - 2, peak.y - 3, 4, 3, pick(P.lampOff, night));
  box(ctx, x - 2, peak.y - 3, 1, 3, pick(P.finial, night));
  box(ctx, x - 3, peak.y - (BANDSTAND_HEIGHT - PEAK), 6, 1, pick(P.finial, night));
}

/**
 * Snow on the cap, settling and thawing with the roofs round it: the left slopes in the light, the
 * right in shade, a rim of the stripes and the valance still showing below it.
 */
function drawSnow(ctx: Ctx, snow: number, night: boolean) {
  const cover = ring(EAVE_R - 0.1, EAVE + 1.2);
  const peak = at(0, 0, PEAK + 0.6);
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * snow;
  fill(ctx, [peak, cover[5], cover[6], cover[7], cover[0], cover[1]], pick(SNOW.shade, night));
  fill(ctx, [peak, cover[1], cover[2], cover[3], cover[4], cover[5]], pick(SNOW.top, night));
  ctx.globalAlpha = alpha;
}

/** The stand's screen box, with room for the players' heads. */
const AREA: Box = { left: G.x - 48, top: G.y - 48, width: 96, height: 76 };
const backArt = (night: boolean) => (target: Ctx) => {
  plinth(target, night);
  railings(target, night, [2, 3, 4, 5, 6]);
  posts(target, night);
};
const frontArt = (night: boolean, groundDay: number) => (target: Ctx) => {
  railings(target, night, [1, 7]);
  roof(target, night, groundDay);
};

// ---------------------------------------------------------------------------------------------
// The players.

/** A place on the stand, from its centre: `s` tiles toward us, `t` to the right. */
const onStand = (s: number, t: number) => ({
  dx: (s + t) / Math.SQRT2,
  dy: (s - t) / Math.SQRT2,
});
const SLOTS = [onStand(0.47, -0.33), onStand(0.58, 0), onStand(0.47, 0.33)];
/** Where they take their tea: on the front edge and the steps, the teapot between them. */
const TEA = [onStand(0.76, -0.27), onStand(0.84, 0.01), onStand(0.76, 0.28)];

type Play = (beat: number, playing: boolean) => { hands: FigureHands; behind?: FigureHands };
type Player = {
  look: Look;
  cap?: string;
  flat?: boolean;
  /** Sat on a chair to play (the string trio). */
  seated?: boolean;
  play: Play;
};
const BRASS = { body: '#C2A04E', dark: '#8F7337', light: '#DCCB94' } as const;
const WOOD = { body: '#A3643E', dark: '#6E4129', light: '#C2875A' } as const;
const BOW = '#E3D9C2';

/** A tuba's bell, turned up beside the player's head, and the pipe down behind the shoulder, in
 *  the player's own px from `y`: low enough to show under the cap's valance (BANDSTAND_HEIGHT). */
function tubaBell(r: FigureRect, x: number, y: number) {
  r(x + 1, y - 19, 5, 1, BRASS.light);
  r(x, y - 18, 7, 1, BRASS.light);
  r(x + 1, y - 18, 5, 1, TUBA_THROAT);
  r(x, y - 17, 7, 1, BRASS.light);
  r(x + 1, y - 16, 5, 1, BRASS.body);
  r(x + 2, y - 15, 3, 4, BRASS.body);
  r(x + 4, y - 15, 1, 4, BRASS.dark);
}
/** A tuba's coil: a round body of brass with its tubing looped round in a U, and its valves. */
function tubaCoil(r: FigureRect, x: number, y: number) {
  r(x + 1, y - 13, 6, 1, BRASS.body);
  r(x, y - 12, 8, 6, BRASS.body);
  r(x + 1, y - 6, 6, 1, BRASS.body);
  r(x + 2, y - 11, 1, 4, BRASS.dark);
  r(x + 2, y - 8, 4, 1, BRASS.dark);
  r(x + 5, y - 11, 1, 4, BRASS.dark);
  r(x + 7, y - 12, 1, 5, BRASS.light);
  r(x + 3, y - 15, 1, 2, BRASS.light);
  r(x + 5, y - 15, 1, 2, BRASS.light);
}
const TUBA_THROAT = '#6E5528';
/** A tuba: the coil held in front of the body, the bell turned up beside the head. */
const tuba: Play = (beat, playing) => {
  const sway = playing && beat < 0.5 ? 1 : 0;
  return {
    behind: (r, look, bob) => {
      tubaBell(r, -11, bob - sway);
      r(-5, -15 + bob, 2, 3, tint(look.outfit, -24));
    },
    hands: (r, look, bob) => {
      tubaCoil(r, -2, bob);
      r(3, -16 + bob, 2, 1, BRASS.dark);
      r(3, -11 + bob, 3, 2, look.outfit);
      r(4, -16 + bob + (playing && beat < 0.25 ? 1 : 0), 2, 2, look.skin);
    },
  };
};
/** A cornet: held level from the lips, bell forward, tipping up at the end of the beat. */
const cornet: Play = (beat, playing) => {
  const tip = playing && beat > 0.75 ? -1 : 0;
  return {
    hands: (r, look, bob) => {
      r(-1, -12 + bob, 6, 2, tint(look.outfit, -24));
      r(3, -11 + bob, 2, 3, look.outfit);
      r(4, -13 + bob, 3, 2, look.outfit);
      r(4, -15 + bob, 7, 2, BRASS.body);
      r(6, -17 + bob, 3, 2, BRASS.dark);
      r(10, -17 + bob + tip, 2, 5, BRASS.body);
      r(11, -17 + bob + tip, 1, 5, BRASS.light);
      r(6, -14 + bob, 2, 2, look.skin);
      r(4, -13 + bob, 2, 2, look.skin);
    },
  };
};
const DRUM = { hoop: '#A8524A', shell: '#7C3A34', skin: '#EFE6CF', cord: '#E3D9C2' } as const;
/** A bass drum's near head, round: a red hoop round a cream skin, 8 px across, from (x, y). */
function drumHead(r: FigureRect, x: number, y: number) {
  r(x + 2, y, 4, 10, DRUM.hoop);
  r(x + 1, y + 1, 6, 8, DRUM.hoop);
  r(x, y + 2, 8, 6, DRUM.hoop);
  r(x + 2, y + 1, 4, 8, DRUM.skin);
  r(x + 1, y + 2, 6, 6, DRUM.skin);
}
/** A bass drum on its strap, its laced shell toward the body, the beater swinging in on the beat. */
const drum: Play = (beat, playing) => {
  const up = playing ? (beat < 0.5 ? 3 : 0) : 1;
  return {
    hands: (r, look, bob) => {
      r(-1, -16 + bob, 1, 4, '#4A3A2E');
      r(-1, -12 + bob, 3, 7, DRUM.shell);
      r(-1, -11 + bob, 1, 1, DRUM.cord);
      r(0, -9 + bob, 1, 1, DRUM.cord);
      r(-1, -7 + bob, 1, 1, DRUM.cord);
      drumHead(r, 1, -14 + bob);
      r(8, -11 + bob, 2, 2, look.outfit);
      r(7, -16 + bob - up, 1, 5, '#8C6A4A');
      r(6, -18 + bob - up, 3, 2, DRUM.skin);
      r(6, -12 + bob - up, 2, 2, look.skin);
    },
  };
};
/** A fiddle under the chin, the bow drawn across it to the beat. */
const fiddle =
  (size: number, body: string): Play =>
  (beat, playing) => {
    const draw = playing ? Math.round(Math.sin(beat * Math.PI * 2) * 3) : 0;
    return {
      hands: (r, look, bob) => {
        r(-1, -13 + bob, 10, 2, tint(look.outfit, -24));
        r(9, -16 + bob, 2, 2, look.skin);
        r(2, -16 + bob, 4 + size, 3, body);
        r(3, -15 + bob, 2, 1, WOOD.dark);
        r(6 + size, -17 + bob, 5, 1, '#3A2A20');
        r(3, -11 + bob, 2, 2, look.outfit);
        r(3 + draw, -13 + bob, 2, 2, look.skin);
        r(-2 + draw, -14 + bob, 11, 1, BOW);
      },
    };
  };
/** A squeezebox, its bellows opening and closing with the phrase. */
const squeezebox: Play = (beat, playing) => {
  const open = playing ? 5 + Math.round((1 + Math.sin(beat * Math.PI)) * 1.5) : 5;
  return {
    hands: (r, look, bob) => {
      r(-2, -14 + bob, 2, 9, '#A84F45');
      r(0, -13 + bob, open, 7, '#ECE3CA');
      for (let i = 1; i < open; i += 2) r(i, -13 + bob, 1, 7, '#C9BFA4');
      r(open, -14 + bob, 2, 9, '#A84F45');
      r(open, -13 + bob, 1, 6, '#F4EEDC');
      r(-3, -11 + bob, 2, 2, look.skin);
      r(3, -11 + bob, 2, 2, look.outfit);
      r(open + 1, -10 + bob, 2, 2, look.skin);
    },
  };
};
/** A guitar, strummed on the beat. */
const guitar: Play = (beat, playing) => {
  const strum = playing && beat < 0.3 ? 1 : 0;
  return {
    hands: (r, look, bob) => {
      r(-1, -11 + bob, 10, 2, tint(look.outfit, -24));
      r(-1, -10 + bob, 6, 5, '#B98A57');
      r(0, -11 + bob, 4, 1, '#B98A57');
      r(2, -8 + bob, 2, 2, '#5A3E2A');
      r(5, -11 + bob, 7, 1, '#5A3E2A');
      r(12, -12 + bob, 2, 2, '#3A2A20');
      r(9, -12 + bob, 2, 2, look.skin);
      r(3, -11 + bob, 2, 2, look.outfit);
      r(2, -8 + bob + strum, 2, 2, look.skin);
    },
  };
};
/** A cello between the knees, the bow across its waist. */
const cello: Play = (beat, playing) => {
  const draw = playing ? Math.round(Math.sin(beat * Math.PI * 2) * 3) : 0;
  return {
    hands: (r, look, bob) => {
      r(6, -2, 1, 2, '#3A2A20');
      r(3, -14 + bob, 7, 12, '#8A4F32');
      r(4, -9 + bob, 5, 1, '#6A3A24');
      r(5, -24 + bob, 2, 10, '#3A2A20');
      r(4, -26 + bob, 3, 2, '#3A2A20');
      r(-1, -13 + bob, 7, 2, tint(look.outfit, -24));
      r(5, -19 + bob, 2, 2, look.skin);
      r(3, -11 + bob, 2, 2, look.outfit);
      r(4 + draw, -8 + bob, 2, 2, look.skin);
      r(draw - 2, -7 + bob, 13, 1, BOW);
    },
  };
};

const PLAYERS_BY_BAND: Record<Band, readonly Player[]> = {
  brass: [
    { look: { skin: '#D8B391', hair: '#3A322C', outfit: '#3F5373' }, cap: '#33435C', play: tuba },
    {
      look: { skin: '#8D5B3E', hair: '#2C2420', outfit: '#3F5373', female: true },
      cap: '#33435C',
      play: cornet,
    },
    { look: { skin: '#B98563', hair: '#6B4A36', outfit: '#3F5373' }, cap: '#33435C', play: drum },
  ],
  folk: [
    {
      look: { skin: '#C79A72', hair: '#4A3A2E', outfit: '#A5674A' },
      cap: '#5E5A4E',
      flat: true,
      play: squeezebox,
    },
    {
      look: { skin: '#DDB497', hair: '#9A5A3A', outfit: '#7E9A6B', female: true },
      play: fiddle(0, WOOD.body),
    },
    { look: { skin: '#8D5B3E', hair: '#22201E', outfit: '#5F7FA0' }, play: guitar },
  ],
  strings: [
    {
      look: { skin: '#EBCBB4', hair: '#2E2722', outfit: '#4B3F57', female: true },
      seated: true,
      play: fiddle(0, WOOD.light),
    },
    {
      look: { skin: '#B98563', hair: '#8C857C', outfit: '#3F4446' },
      seated: true,
      play: fiddle(1, WOOD.body),
    },
    {
      look: { skin: '#8D5B3E', hair: '#1F1B19', outfit: '#3E5A4E', female: true },
      seated: true,
      play: cello,
    },
  ],
};
/** Each band's tempo, its arrangement's (bandstand-tracks.ts), in beats a town minute. */
export const BAND_BPM: Record<Band, number> = { brass: 96, folk: 104, strings: 84 };
/** Winter scarves for the three players, in muted wool. */
const SCARVES = ['#A9574C', '#5F84A0', '#B99A55'];

/** The players' evening, in town minutes (SPEC §4.2). */
export const PLAYERS = {
  /** They fade in, then tune up for the teatime set. */
  in: 945,
  /** The teatime set is over: tea on the steps. */
  teaFrom: 1050,
  /** Back up for the sundown set. */
  teaTo: 1095,
  /** They fade out after the sundown set, gone by 20:15. */
  out: 1212,
  gone: 1215,
} as const;
const TEATIME = { start: 960, end: 1050 },
  SUNDOWN = { start: 1095, end: 1200 };
/** Minutes a player takes to step between their place and the front edge. */
const STEP_DOWN = 0.5;

/** Where the players are in their evening: how faded in, whether a set is on, and how far
 *  they are from their places to the tea on the front edge (0 at their places, 1 at tea). */
export function playersAt(minutes: number) {
  if (minutes < PLAYERS.in || minutes >= PLAYERS.gone) return undefined;
  const alpha = Math.min(ease(minutes, PLAYERS.in, 1.5), 1 - ease(minutes, PLAYERS.out, 2.5));
  const playing =
    (minutes >= TEATIME.start && minutes < TEATIME.end) ||
    (minutes >= SUNDOWN.start && minutes < SUNDOWN.end);
  const tea =
    minutes < PLAYERS.teaFrom || minutes >= PLAYERS.teaTo
      ? 0
      : Math.min(
          clamp01((minutes - PLAYERS.teaFrom) / STEP_DOWN),
          clamp01((PLAYERS.teaTo - minutes) / STEP_DOWN),
        );
  return { alpha, playing, tea };
}

/** Where the instruments are set down while the band takes tea: at the deck's two ends, between
 *  the side posts, and flat on its boards at the back, where the players on the front edge leave
 *  them in sight. From the stand's centre, in tiles. */
const REST_AT = {
  left: { dx: -0.34, dy: 0.34 },
  right: { dx: 0.34, dy: -0.34 },
  back: { dx: -0.25, dy: -0.25 },
  backLeft: { dx: -0.33, dy: -0.17 },
  backRight: { dx: -0.17, dy: -0.33 },
} as const;
/** One instrument set down: where, and how it lies, as a painter from its foot on the deck. */
type Rest = { at: keyof typeof REST_AT; paint: (r: FigureRect) => void };
const lying =
  (length: number, body: string, dark: string): Rest['paint'] =>
  (r) => {
    r(-Math.ceil(length / 2), -2, length, 2, body);
    r(-Math.ceil(length / 2), -1, length, 1, dark);
  };
const RESTING: Record<Band, readonly Rest[]> = {
  brass: [
    {
      at: 'left',
      paint: (r) => {
        // Stood on its coil, the bell turned up.
        tubaBell(r, -1, 5);
        tubaCoil(r, -5, 6);
      },
    },
    {
      at: 'back',
      paint: (r) => {
        r(-3, -2, 6, 1, BRASS.body);
        r(-3, -1, 6, 1, BRASS.dark);
        r(3, -3, 2, 3, BRASS.light);
      },
    },
    { at: 'right', paint: (r) => drumHead(r, -4, -10) },
  ],
  folk: [
    {
      at: 'left',
      paint: (r) => {
        r(-4, -6, 2, 6, '#A84F45');
        r(-2, -5, 4, 5, '#ECE3CA');
        r(-1, -5, 1, 5, '#C9BFA4');
        r(1, -5, 1, 5, '#C9BFA4');
        r(2, -6, 2, 6, '#A84F45');
      },
    },
    {
      at: 'back',
      paint: (r) => {
        lying(5, WOOD.body, WOOD.dark)(r);
        r(3, -2, 3, 1, '#3A2A20');
      },
    },
    {
      at: 'right',
      paint: (r) => {
        r(-2, -6, 5, 6, '#B98A57');
        r(-1, -7, 3, 1, '#B98A57');
        r(0, -4, 1, 2, '#5A3E2A');
        r(0, -13, 1, 6, '#5A3E2A');
        r(-1, -14, 3, 2, '#3A2A20');
      },
    },
  ],
  strings: [
    {
      at: 'backLeft',
      paint: (r) => {
        lying(5, WOOD.light, WOOD.dark)(r);
        r(3, -2, 2, 1, '#3A2A20');
      },
    },
    {
      at: 'backRight',
      paint: (r) => {
        lying(6, WOOD.body, WOOD.dark)(r);
        r(4, -2, 2, 1, '#3A2A20');
      },
    },
    {
      at: 'right',
      paint: (r) => {
        r(-3, -9, 6, 9, '#8A4F32');
        r(-2, -10, 4, 1, '#8A4F32');
        r(-2, -5, 4, 1, '#6A3A24');
        r(0, -16, 1, 6, '#3A2A20');
        r(-1, -17, 2, 2, '#3A2A20');
      },
    },
  ],
};
/** Minutes an instrument takes to appear where it is set down, and to go when taken up. */
const REST_FADE = 0.45;
/** How far the set-down instruments show: once the players are halfway to the front edge, until
 *  they are halfway back to their places (playersAt's `tea` at 0.5), fading in and out. */
export function restingAt(minutes: number) {
  const down = PLAYERS.teaFrom + STEP_DOWN / 2,
    up = PLAYERS.teaTo - STEP_DOWN / 2;
  return Math.min(clamp01((minutes - down) / REST_FADE), clamp01((up - minutes) / REST_FADE));
}

/** A teacup in the near hand, lifted now and then. */
const teacup =
  (lift: number): FigureHands =>
  (r, look, bob) => {
    r(3, -11 + bob, 2, 3, look.outfit);
    r(3, -9 + bob - lift, 4, 2, look.skin);
    r(5, -12 + bob - lift, 3, 3, '#ECE6D6');
    r(5, -13 + bob - lift, 3, 1, '#FBF8EE');
    r(8, -12 + bob - lift, 1, 2, '#C7BEA6');
  };

/** The players under the cap (`front` false) or out on the front edge at tea (`front` true). */
function drawPlayers(
  ctx: Ctx,
  band: Band,
  minutes: number,
  night: boolean,
  winter: boolean,
  front: boolean,
) {
  const state = playersAt(minutes);
  if (!state) return;
  const t = state.tea;
  const alpha = ctx.globalAlpha;
  if (!front) {
    // Under the cap: the trio's chairs, and the instruments set down while the band takes tea.
    ctx.globalAlpha = alpha * state.alpha;
    PLAYERS_BY_BAND[band].forEach((player, i) => {
      if (!player.seated) return;
      const slot = at(SLOTS[i].dx, SLOTS[i].dy, DECK);
      const x = Math.round(slot.x),
        y = Math.round(slot.y);
      // A seat behind the player's feet (they face left), and its back.
      box(ctx, x, y - 9, 8, 2, pick(P.plank, night));
      box(ctx, x + 1, y - 7, 1, 7, pick(P.plank, night));
      box(ctx, x + 7, y - 19, 2, 19, pick(P.plank, night));
    });
    const shown = restingAt(minutes);
    if (shown > 0) {
      ctx.globalAlpha = alpha * state.alpha * shown;
      for (const rest of RESTING[band]) {
        const { dx, dy } = REST_AT[rest.at];
        const foot = at(dx, dy, DECK);
        const x = Math.round(foot.x),
          y = Math.round(foot.y);
        rest.paint((rx, ry, w, h, color) =>
          box(ctx, x + rx, y + ry, w, h, night ? tint(color, -35) : color),
        );
      }
    }
    ctx.globalAlpha = alpha;
  }
  if (t > 0.5 !== front) return;
  PLAYERS_BY_BAND[band].forEach((player, i) => {
    // Each steps down to the front edge, and back up, in a straight line.
    const from = SLOTS[i],
      to = TEA[i];
    const dx = from.dx + (to.dx - from.dx) * smooth(t),
      dy = from.dy + (to.dy - from.dy) * smooth(t);
    const settled = t >= 1;
    const stepping = t > 0 && !settled;
    const p = at(dx, dy, settled ? STEP : DECK - (DECK - STEP) * smooth(t));
    const beat = (minutes * BAND_BPM[band]) / 60 + i * 0.13;
    const phase = beat - Math.floor(beat);
    const playing = state.playing && t === 0;
    const sip = settled && ((minutes + i * 2.3) / 3) % 1 < 0.3 ? 4 : 0;
    // Down the deck with the instrument, set down halfway (restingAt), then a cup of tea; and
    // the other way round going back up.
    const parts = t >= 0.5 ? { hands: teacup(stepping ? 0 : sip) } : player.play(phase, playing);
    const x = Math.round(p.x),
      y = Math.round(p.y);
    drawFigure(ctx, x, y, {
      look: player.look,
      facing: 'sw',
      stance: settled ? 'seat' : stepping ? 'walk' : player.seated ? 'seat' : 'stand',
      seat: settled ? 4 : 7,
      phase: (minutes * 3) % 1,
      lift: playing && !player.seated && Math.floor(beat) % 2 ? -1 : 0,
      cap: player.cap,
      flat: player.flat,
      scarf: winter ? SCARVES[i] : undefined,
      night,
      alpha: state.alpha,
      ...parts,
    });
  });
  if (front && t >= 1) {
    // The teapot on the lower step, in the gap between the first two of them, over their feet.
    const spot = onStand(0.9, -0.15);
    const pot = at(spot.dx, spot.dy, STEP);
    ctx.globalAlpha = alpha * state.alpha;
    const x = Math.round(pot.x),
      y = Math.round(pot.y);
    box(ctx, x - 3, y - 5, 6, 5, pick(P.pot, night));
    box(ctx, x - 1, y - 6, 2, 1, pick(P.potLid, night));
    box(ctx, x + 3, y - 4, 2, 1, pick(P.pot, night));
    ctx.globalAlpha = alpha;
  }
}

/** Notes rise from the stand while a set is played, a few at a time, never flashing. */
function drawNotes(ctx: Ctx, minutes: number, night: boolean) {
  const state = playersAt(minutes);
  if (!state || !state.playing || state.tea > 0) return;
  const set = minutes < TEATIME.end ? TEATIME : SUNDOWN;
  const fade = Math.min(ease(minutes, set.start, 1), 1 - ease(minutes, set.end - 1, 1));
  const alpha = ctx.globalAlpha;
  ctx.fillStyle = pick(P.note, night);
  // Each note rises for two minutes, fading in and out; three are in the air at once.
  for (let k = 0; k < 3; k++) {
    const rising = minutes / 2 + k / 3;
    const age = rising - Math.floor(rising);
    const n = Math.floor(rising);
    const side = (n * 7 + k) % 3;
    const p = at([-0.45, 0.05, 0.5][side], [0.2, -0.3, -0.25][side], 30 + age * 14);
    ctx.globalAlpha = alpha * fade * Math.sin(age * Math.PI) * 0.9;
    const x = Math.round(p.x + Math.sin(age * 5 + k) * 2),
      y = Math.round(p.y);
    if ((n + k) % 2) {
      // A quaver: a head, a stem and its flag.
      ctx.fillRect(x, y, 3, 2);
      ctx.fillRect(x + 2, y - 5, 1, 5);
      ctx.fillRect(x + 3, y - 5, 2, 1);
    } else {
      // Two quavers joined.
      ctx.fillRect(x, y, 3, 2);
      ctx.fillRect(x + 5, y - 1, 3, 2);
      ctx.fillRect(x + 2, y - 6, 1, 6);
      ctx.fillRect(x + 7, y - 7, 1, 6);
      ctx.fillRect(x + 2, y - 7, 6, 1);
    }
  }
  ctx.globalAlpha = alpha;
}

// ---------------------------------------------------------------------------------------------
// The peak lamp.

const fork = getPlot(FORK_PLOT)!;
/** Tiles from the Fork, as the streetlamps measure them. */
const LAMP_DISTANCE = Math.abs(STAND.x - (fork.x + 0.5)) + Math.abs(STAND.y - (fork.y + 0.5));
/** The evening minute the peak lamp lights, in the streetlamp wave (20:20–20:30). */
export const PEAK_LAMP_LIGHTS = lampLightsAt(
  Math.max(0, LAMP_DISTANCE - MIN_LAMP_DISTANCE),
  MAX_LAMP_DISTANCE - MIN_LAMP_DISTANCE,
);
/** Minutes the lamp takes to come up to full: a lamp warming, never a flash. */
const LAMP_WARM = 1;
/**
 * How lit the peak lamp is, 0..1: from its place in the wave until 06:00, and never on a star
 * night (its evening's), so the sky stays dark for the stargazers. Only the night look lights it.
 */
export function peakLamp(day: number, minutes: number, night: boolean) {
  if (!night) return 0;
  const evening = minutes < 360 ? day - 1 : day;
  if (starNight(evening)) return 0;
  return ease(eveningMinutes(minutes), PEAK_LAMP_LIGHTS, LAMP_WARM);
}
function drawLamp(ctx: Ctx, lit: number) {
  if (lit <= 0) return;
  const peak = at(0, 0, PEAK);
  const x = Math.round(peak.x);
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * lit;
  box(ctx, x - 1, peak.y - 3, 3, 3, LAMP_LIT);
  box(ctx, x, peak.y - 2, 1, 1, LAMP_CORE);
  drawGlow(ctx, x + 0.5, peak.y - 2, 26, 0.32);
  ctx.globalAlpha = alpha;
}
/** The lamp's light falling on the deck under the cap, as if from within. */
function drawDeckLight(ctx: Ctx, lit: number) {
  if (lit <= 0) return;
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * lit;
  drawGlow(ctx, G.x, G.y - DECK - 6, 34, 0.16);
  ctx.globalAlpha = alpha;
}

// ---------------------------------------------------------------------------------------------
// The deckchairs.

/** Each chair's canvas stripe, by spot: sage, rose and sky, each with cream. */
const STRIPES: readonly Pair[] = [
  ['#86A77E', '#4E6A57'],
  ['#D08C80', '#7E5E5A'],
  ['#7FA2BC', '#4E6577'],
];
const CANVAS_CREAM: Pair = ['#F2EBD6', '#9AA297'];
const FRAME: Pair = ['#A5845E', '#625A4C'];
const FRAME_DARK: Pair = ['#8C6E4C', '#544D42'];
/** In tiles from the sitter's feet: half the width along x; the front bar ahead of the feet;
 *  the foot and the top of the back behind them along y, with their rise in px. The back's top
 *  meets a perched sitter's shoulders (residents.ts draws `perch` and `tea` near standing height). */
const CHAIR = {
  half: 0.17,
  front: -0.09,
  frontRise: 6,
  foot: 0.04,
  footRise: 3,
  top: 0.12,
  topRise: 20,
} as const;
/** Px the back is let down a notch for a sitter low in the canvas, or halfway down, so their head
 *  and shoulders still show over it. */
const SITTING_LOW: Partial<Record<EventPose, number>> = {
  sit: 5,
  sip: 5,
  read: 5,
  chat: 5,
  crouch: 2,
};

/**
 * A deckchair facing the stand (ne), its sitter's feet at the spot, in two parts: the seat, its
 * front legs and its shadow under the sitter, and the striped back over them. From behind, we see
 * the canvas and the sitter's head and shoulders above it, as one sees a row of deckchairs; the
 * back sits `drop` px lower for a sitter low in the canvas.
 */
function drawChair(
  ctx: Ctx,
  spot: Point,
  color: Pair,
  night: boolean,
  part: 'seat' | 'back',
  drop = 0,
) {
  const p = (dx: number, dy: number, rise: number) => iso(spot.x + dx, spot.y + dy, rise);
  const { half, front, frontRise, foot, footRise, top } = CHAIR;
  const topRise = CHAIR.topRise - drop;
  if (part === 'seat') {
    const shadow = p(0, 0, 0);
    box(ctx, Math.round(shadow.x) - 9, Math.round(shadow.y) - 1, 16, 3, pick(P.shadow, night));
    // The sling, from the front bar down to the foot of the back, a shade under the stripes:
    // u along the chair's width, v from the front bar (0) to the foot of the back (1).
    const f0 = p(-half, front, frontRise),
      b0 = p(-half, foot, footRise);
    ctx.save();
    ctx.transform(1, 0.5, b0.x - f0.x, b0.y - f0.y, f0.x, f0.y);
    box(ctx, 0, 0, half * 2 * 38, 1, tint(pick(color, night), -16));
    ctx.restore();
    for (const side of [-half, half]) {
      const a = p(side, front, 0);
      box(ctx, Math.round(a.x), Math.round(a.y) - frontRise, 1, frontRise, pick(FRAME, night));
    }
    return;
  }
  // The back legs, from the lawn behind up to the top bar.
  for (const side of [-half, half]) {
    const a = p(side, top + 0.05, 0);
    box(ctx, Math.round(a.x), Math.round(a.y) - topRise, 1, topRise, pick(FRAME_DARK, night));
  }
  // The striped back, leaning a little away from the stand: u along the chair's width (the
  // town's x), v from the foot of the back up to its top bar.
  const b0 = p(-half, foot, footRise),
    t0 = p(-half, top, topRise);
  const tall = topRise - footRise;
  ctx.save();
  ctx.transform(1, 0.5, (b0.x - t0.x) / tall, (b0.y - t0.y) / tall, t0.x, t0.y);
  const width = half * 2 * 38;
  box(ctx, 0, 0, width, tall, pick(color, night));
  box(ctx, width * 0.2, 0, width * 0.2, tall, pick(CANVAS_CREAM, night));
  box(ctx, width * 0.6, 0, width * 0.2, tall, pick(CANVAS_CREAM, night));
  box(ctx, -0.5, -0.5, width + 1, 1.5, pick(FRAME, night));
  ctx.restore();
}

/** The Bandstand's two sets: their guests sit in the deckchairs. */
const SETS = new Set(['bandstand-tea', 'bandstand-sundown']);
/**
 * How far each deckchair's back is let down for whoever sits in it now (SITTING_LOW), by spot,
 * read from the frame's residents: 0 for an empty chair or a perched, standing or cheering guest.
 */
export function sittersLow(residents: readonly ResidentState[]): number[] {
  const drops = DISTRICT_SPOTS.bandstand.map(() => 0);
  for (const resident of residents) {
    const event = resident.event;
    if (!event || !SETS.has(event.id) || (event.phase !== 'waiting' && event.phase !== 'attending'))
      continue;
    const k = DISTRICT_SPOTS.bandstand.findIndex(
      (spot) =>
        Math.abs(spot.x - resident.position.x) < 0.05 &&
        Math.abs(spot.y - resident.position.y) < 0.05,
    );
    if (k >= 0 && resident.pose) drops[k] = SITTING_LOW[resident.pose] ?? 0;
  }
  return drops;
}

/** The chairs folded and stacked by the stand's east side, toward the road. */
export const STACK = { x: 60.82, y: 42.42 } as const;
function drawStack(ctx: Ctx, count: number, night: boolean, alpha: number) {
  if (count <= 0 || alpha <= 0) return;
  const base = iso(STACK.x, STACK.y);
  const x = Math.round(base.x),
    y = Math.round(base.y);
  const before = ctx.globalAlpha;
  box(ctx, x - 9, y - 1, 18, 3, pick(P.shadow, night));
  for (let i = 0; i < count; i++) {
    // The top chair of the stack comes and goes with the chairs on the lawn.
    if (i === count - 1) ctx.globalAlpha = before * alpha;
    const row = y - 2 - i * 2;
    box(ctx, x - 8, row, 15, 2, pick(FRAME, night));
    box(ctx, x - 6, row, 11, 1, pick(STRIPES[i % STRIPES.length], night));
  }
  ctx.globalAlpha = before;
}

/** Minutes between one chair and the next going out or coming in; each takes 0.9 of it, so
 *  only one chair is ever on the move and none changes faster than 0.08 a frame. */
const CHAIR_FADE = 1;
/** How far chair k is out, 0..1: one after another by 15:35, gathered up from 20:20. */
export function chairOut(k: number, minutes: number) {
  const { from, to } = BANDSTAND_FURNITURE.chairs;
  const out = ease(minutes, from - CHAIR_FADE * 8.5 + k * CHAIR_FADE, CHAIR_FADE * 0.9);
  const away = ease(minutes, to + k * CHAIR_FADE, CHAIR_FADE * 0.9);
  return Math.min(out, 1 - away);
}

// ---------------------------------------------------------------------------------------------
// The painter.

const PLOT = getPlot(BANDSTAND_VENUE.plot)!;
const PLOT_CENTER = project(PLOT.x + 0.5, PLOT.y + 0.5);
const diamond = (c: Point, rx: number, ry: number) => [
  { x: c.x, y: c.y - ry },
  { x: c.x + rx, y: c.y },
  { x: c.x, y: c.y + ry },
  { x: c.x - rx, y: c.y },
];

/** The lawn and the gravel round the stand, in the cached ground layer. */
function ground(ctx: Ctx, scene: DistrictGroundScene) {
  if (!scene.visible(PLOT_CENTER, 110, 60, 60)) return;
  const { night, season } = scene;
  fill(ctx, diamond(PLOT_CENTER, 105, 52.5), pick(P.lawn, night));
  // A few tufts on the lawn, turning with the year like the town's own grass.
  for (let k = 0; k < 14; k++) {
    const gx = PLOT.x - 0.9 + groundFraction(k, 31) * 2.8,
      gy = PLOT.y - 0.9 + groundFraction(k, 32) * 2.8;
    if (Math.hypot(gx - STAND.x, gy - STAND.y) < 0.95) continue;
    const tuft = groundTuft(7919 * (k + 1), k % 3, night, season);
    const p = project(gx, gy);
    box(ctx, Math.round(p.x), Math.round(p.y), tuft.w, tuft.h, tuft.fill);
  }
  // The gravel ring the stand stands in.
  fill(ctx, ring(PLINTH + 0.16, 0), pick(P.gravelEdge, night));
  fill(ctx, ring(PLINTH + 0.1, 0), pick(P.gravel, night));
}

/** A hover or a selection lights the lawn, as it does a house's. */
function floor(ctx: Ctx, scene: DistrictScene) {
  const id = BANDSTAND_VENUE.plot;
  if (scene.selected !== id && scene.hovered !== id) return;
  if (!scene.visible(PLOT_CENTER, 110, 60, 60)) return;
  fill(ctx, diamond(PLOT_CENTER, 108, 54), scene.night ? '#B5C59B40' : '#F4EDCD80');
}

function objects(ctx: Ctx, scene: DistrictScene): DepthObject[] {
  const { day, minutes, night, season, visible } = scene;
  const out: DepthObject[] = [];
  if (visible(G, 52, 52, 30)) {
    const band = bandOf(day);
    const winter = season.index === 3;
    const groundDay = season.groundDay;
    const lit = peakLamp(day, minutes, night);
    const snow = snowAt(season.yearDay, 0.37);
    out.push({
      depth: STAND_DEPTH,
      paint: () => {
        cachedArt(ctx, 'bandstand:back', `${night}`, AREA, backArt(night));
        drawDeckLight(ctx, lit);
        drawPlayers(ctx, band, minutes, night, winter, false);
        cachedArt(
          ctx,
          'bandstand:front',
          `${night}:${groundDay}`,
          AREA,
          frontArt(night, groundDay),
        );
        if (snow > 0) drawSnow(ctx, snow, night);
        drawPlayers(ctx, band, minutes, night, winter, true);
        drawLamp(ctx, lit);
        drawNotes(ctx, minutes, night);
      },
    });
  }
  // The deckchairs, out on their spots for the sets and stacked by the stand otherwise.
  let stacked = 0;
  const drops = sittersLow(scene.residents);
  DISTRICT_SPOTS.bandstand.forEach((spot, k) => {
    const shown = chairOut(k, minutes);
    stacked += 1 - shown;
    if (shown <= 0 || !visible(iso(spot.x, spot.y), 20, 24, 8)) return;
    // Seat furniture sits just under its guest (district-art.ts); a deckchair's back, seen from
    // behind, just over them.
    for (const [part, depth] of [
      ['seat', -0.01],
      ['back', 0.01],
    ] as const)
      out.push({
        depth: spot.x + spot.y + depth,
        paint: () => {
          const alpha = ctx.globalAlpha;
          ctx.globalAlpha = alpha * shown;
          drawChair(ctx, spot, STRIPES[k % STRIPES.length], night, part, drops[k]);
          ctx.globalAlpha = alpha;
        },
      });
  });
  const count = Math.ceil(stacked - 1e-9);
  if (count > 0 && visible(iso(STACK.x, STACK.y), 14, 20, 4))
    out.push({
      depth: STACK.x + STACK.y,
      paint: () => drawStack(ctx, count, night, Math.min(1, stacked - (count - 1))),
    });
  return out;
}

/** The stand rises over the road and the Landing's lawn behind it: its own box selects K15. */
function hit(point: Point): DistrictHit | undefined {
  if (
    point.x >= G.x - 38 &&
    point.x <= G.x + 38 &&
    point.y >= G.y - BANDSTAND_HEIGHT - 18 &&
    point.y <= G.y + 18
  )
    return { plot: BANDSTAND_VENUE.plot, depth: STAND_DEPTH };
  return undefined;
}

export const bandstandPainter: DistrictPainter = { ground, floor, objects, hit };
