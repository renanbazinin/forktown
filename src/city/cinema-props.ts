// The Starlight Cinema's popcorn cart and film projector, drawn as small isometric objects.
// Each face is painted flat in its own sheared frame (`face` for upright ones, `plane` for level
// ones), so most details are single fillRects; the budget tests count every canvas call.
import { project, TILE_W, type Point } from '../lib/world';
import { drawGlow } from './glow';
import { mixHex, pick, SNOW, type Pair } from './season-palette';

type Ctx = CanvasRenderingContext2D;
/** Screen pixels per town unit along an upright face. */
const PX = TILE_W / 2;
const TAU = Math.PI * 2;

export type CinemaPropsState = {
  minutes: number;
  night: boolean;
  /** Serving from when guests set out until the lawn has emptied. */
  open: boolean;
  /** A card, film or ad is on the screen. */
  live: boolean;
  /** How far tonight's reel has run, 0 before the show to 1 after it. */
  progress: number;
  /** Snow lying on flat tops, 0..1. */
  snow: number;
};

const C = {
  shadow: ['#3C5A3C24', '#0C1B1C33'],
  red: ['#B5554C', '#6F4449'],
  redShade: ['#96463F', '#5A3A40'],
  cream: ['#F2E4BF', '#A9A68F'],
  creamShade: ['#D8C8A1', '#8C8B78'],
  gold: ['#D2A955', '#8C7D57'],
  counter: ['#E4D1A4', '#9C9A84'],
  wheel: ['#4A3F38', '#2C3130'],
  glass: ['#D5E2DA', '#4E6064'],
  popcorn: ['#F7E6AA', '#B2AA86'],
  kernel: ['#DDB866', '#8E8062'],
  kettle: ['#98A5A4', '#5B6767'],
  bulb: ['#E6DCBD', '#7D8174'],
  metal: ['#51666A', '#34464B'],
  metalShade: ['#415457', '#29393E'],
  metalTop: ['#6A8080', '#465A5E'],
  metalLight: ['#A9B6AE', '#72817E'],
  reel: ['#7D8D89', '#56676A'],
  empty: ['#5D6E6E', '#3E4F53'],
  film: ['#3A2F2B', '#262322'],
  wood: ['#B08A68', '#6A5A4E'],
  woodFront: ['#9A7457', '#5A4C43'],
  woodSide: ['#86644C', '#4D423B'],
  can: ['#BCC2B6', '#737D7A'],
  canShade: ['#99A096', '#5D6765'],
} satisfies Record<string, Pair>;
const LIT = { glass: '#F7DC94', popcorn: '#FFF1BF', bulb: '#FFE9A8', vent: '#FFD98A' };

const lift = (p: Point, rise: number): Point => ({ x: p.x, y: p.y - rise });
const at = (x: number, y: number, rise = 0) => lift(project(x, y), rise);
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
/** Paint a level surface `rise` pixels up, from its far corner: u runs along x, w along y. */
function plane(ctx: Ctx, x: number, y: number, rise: number, paint: () => void) {
  const origin = at(x, y, rise);
  ctx.save();
  ctx.transform(1, 0.5, -1, 0.5, origin.x, origin.y);
  paint();
  ctx.restore();
}
function level(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rise: number,
  color: string,
) {
  plane(ctx, x0, y0, rise, () => rect(ctx, 0, 0, (x1 - x0) * PX, (y1 - y0) * PX, color));
}
/**
 * Paint an upright face flat: u runs along the face in screen pixels, v is height (negative up).
 * An 'x' face runs down-right with the town's x axis, from its left end; a 'y' face runs up-right
 * toward the screen, from its front corner.
 */
function face(ctx: Ctx, origin: Point, along: 'x' | 'y', paint: () => void) {
  ctx.save();
  ctx.transform(1, along === 'x' ? 0.5 : -0.5, 0, 1, origin.x, origin.y);
  paint();
  ctx.restore();
}
function disc(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
const frac = (value: number) => value - Math.floor(value);

// ---------------------------------------------------------------------------------------------
// The popcorn cart: a striped wagon with a lit glass case, parked by the side lane.

const CART_LONG = 24,
  CART_DEEP = 16;
const CART = { x1: 28.34, y1: 20.9, x0: 28.34 - CART_LONG / PX, y0: 20.9 - CART_DEEP / PX };
const BODY = { bottom: 4, top: 20 };
// The glass case stands on the counter's left, leaving a shelf for a full bucket.
const CASE = { x0: CART.x0 + 0.05, long: 16, deep: 12, high: 16 };
const CASE_X1 = CASE.x0 + CASE.long / PX,
  CASE_Y1 = CART.y1 - 0.06,
  CASE_Y0 = CASE_Y1 - CASE.deep / PX;
const ROOF = BODY.top + CASE.high;
export const CART_DEPTH = (CART.x0 + CART.x1 + CART.y0 + CART.y1) / 2;

function stripes(ctx: Ctx, width: number, night: boolean, shade: boolean) {
  const { bottom, top } = BODY;
  rect(ctx, 0, -top, width, top - bottom, pick(shade ? C.redShade : C.red, night));
  for (let u = 4; u < width; u += 8)
    rect(
      ctx,
      u,
      -top,
      Math.min(4, width - u),
      top - bottom,
      pick(shade ? C.creamShade : C.cream, night),
    );
  rect(ctx, 0, -top, width, 2, pick(C.gold, night));
  rect(ctx, 0, -bottom - 1, width, 1, pick(C.gold, night));
}

function caseFace(ctx: Ctx, width: number, s: CinemaPropsState, heap: readonly number[]) {
  const { night, open } = s;
  const h = CASE.high;
  rect(ctx, 0, -h, width, h, open ? LIT.glass : pick(C.glass, night));
  // The heap of popcorn, bumpy along its top.
  ctx.fillStyle = open ? LIT.popcorn : pick(C.popcorn, night);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let u = 0; u <= width; u += 2) ctx.lineTo(u, -heap[(u / 2) % heap.length]);
  ctx.lineTo(width, 0);
  ctx.closePath();
  ctx.fill();
  rect(ctx, 2, -3, 1, 1, pick(C.kernel, night));
  rect(ctx, width - 5, -2, 1, 1, pick(C.kernel, night));
  // Glints on the glass, then the brass frame.
  rect(ctx, 2, -h + 3, 1, 6, '#FFFFFF40');
  rect(ctx, 4, -h + 4, 1, 3, '#FFFFFF30');
  rect(ctx, 0, -h, width, 1.5, pick(C.gold, night));
  rect(ctx, 0, -1.5, width, 1.5, pick(C.gold, night));
  rect(ctx, 0, -h, 1.5, h, pick(C.gold, night));
  rect(ctx, width - 1.5, -h, 1.5, h, pick(C.gold, night));
}

function valance(ctx: Ctx, width: number, night: boolean, shade: boolean) {
  for (let u = 0, i = 0; u < width; u += 4, i++) {
    const color = pick(
      i % 2 ? (shade ? C.creamShade : C.cream) : shade ? C.redShade : C.red,
      night,
    );
    const w = Math.min(4, width - u);
    rect(ctx, u, 0, w, 4, color);
    rect(ctx, u + 1, 4, Math.max(0, w - 2), 1.5, color);
  }
}

const HEAP = [5, 6, 5.5, 7, 6, 5, 6.5, 5.5, 6, 7, 5.5];

export function drawPopcornCart(ctx: Ctx, s: CinemaPropsState) {
  const { night, open, minutes } = s;
  const { x0, x1, y0, y1 } = CART;
  const midY = (y0 + y1) / 2;
  level(ctx, x0 - 0.06, y0 - 0.02, x1 + 0.14, y1 + 0.1, 0, pick(C.shadow, night));
  // The push handle, out of the far end.
  const grip = at(x0 - 0.24, midY, 17),
    root = at(x0, midY, 15);
  ctx.strokeStyle = pick(C.wheel, night);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(root.x, root.y);
  ctx.lineTo(grip.x, grip.y);
  ctx.stroke();
  rect(ctx, grip.x - 2, grip.y - 1, 3, 2, pick(C.gold, night));
  // The wagon, striped like a popcorn box, with its little stand and the far wheel's rim.
  face(ctx, at(x1, y1), 'y', () => {
    rect(ctx, CART_DEEP - 3, -BODY.bottom, 2, BODY.bottom, pick(C.wheel, night));
    stripes(ctx, CART_DEEP, night, true);
  });
  face(ctx, at(x0, y1), 'x', () => {
    rect(ctx, 2, -BODY.bottom, 2, BODY.bottom, pick(C.wheel, night));
    stripes(ctx, CART_LONG, night, false);
    // The near wheel: rim, spokes and a brass hub.
    const cx = CART_LONG - 7,
      cy = -8;
    disc(ctx, cx, cy, 8, pick(C.wheel, night));
    disc(ctx, cx, cy, 6.5, pick(C.red, night));
    ctx.strokeStyle = pick(C.cream, night);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 4;
      ctx.moveTo(cx - Math.cos(a) * 6.5, cy - Math.sin(a) * 6.5);
      ctx.lineTo(cx + Math.cos(a) * 6.5, cy + Math.sin(a) * 6.5);
    }
    ctx.stroke();
    disc(ctx, cx, cy, 1.8, pick(C.gold, night));
  });
  level(ctx, x0 - 0.03, y0 - 0.03, x1 + 0.03, y1 + 0.03, BODY.top, pick(C.counter, night));
  // The glass case: its far faces show through, so only the two near ones are painted.
  face(ctx, at(CASE_X1, CASE_Y1, BODY.top), 'y', () => caseFace(ctx, CASE.deep, s, HEAP.slice(3)));
  face(ctx, at(CASE.x0, CASE_Y1, BODY.top), 'x', () => {
    caseFace(ctx, CASE.long, s, HEAP);
    // The kettle hangs from the roof; at showtime it keeps a few kernels in the air.
    const k = -CASE.high;
    rect(ctx, 7.5, k, 1, 2.5, pick(C.metalShade, night));
    rect(ctx, 5, k + 2.5, 6, 1, pick(C.metalLight, night));
    rect(ctx, 4, k + 3.5, 8, 3, pick(C.kettle, night));
    rect(ctx, 5, k + 6.5, 6, 1, pick(C.metalShade, night));
    rect(ctx, 12, k + 4, 1.5, 1, pick(C.metalShade, night));
    if (!open) return;
    ctx.fillStyle = '#FFF8DD';
    for (let i = 0; i < 6; i++) {
      const t = frac(minutes * 0.8 + i / 6);
      const side = i % 2 ? 1 : -1;
      const u = 8 + side * (2 + (i % 3) * 2) * t;
      const v = -CASE.high + 3.5 + (CASE.high - 9.5) * t - 12 * t * (1 - t);
      ctx.fillRect(u - 0.8, v - 0.8, 1.6, 1.6);
    }
  });
  // A bucket of popcorn on the shelf beside the case.
  const bucket = at((CASE_X1 + x1) / 2 + 0.02, midY + 0.04, BODY.top);
  face(ctx, bucket, 'x', () => {
    rect(ctx, -2.5, -6, 5, 6, pick(C.cream, night));
    rect(ctx, -1.5, -6, 1, 6, pick(C.red, night));
    rect(ctx, 0.5, -6, 1, 6, pick(C.red, night));
    rect(ctx, -3, -8, 6, 2.5, open ? LIT.popcorn : pick(C.popcorn, night));
    rect(ctx, -1.5, -9, 3, 1.5, open ? LIT.popcorn : pick(C.popcorn, night));
  });
  // The striped canopy and its scalloped edge.
  const r = { x0: CASE.x0 - 0.08, x1: CASE_X1 + 0.08, y0: CASE_Y0 - 0.08, y1: CASE_Y1 + 0.08 };
  const snowy = (pair: Pair) => mixHex(pick(pair, night), pick(SNOW.top, night), s.snow);
  const roofLong = (r.x1 - r.x0) * PX;
  plane(ctx, r.x0, r.y0, ROOF + 6, () => {
    rect(ctx, 0, 0, roofLong, (r.y1 - r.y0) * PX, snowy(C.red));
    for (let u = 4; u < roofLong - 1; u += 8)
      rect(ctx, u, 0, 4, (r.y1 - r.y0) * PX, snowy(C.cream));
  });
  face(ctx, at(r.x1, r.y1, ROOF + 6), 'y', () => valance(ctx, (r.y1 - r.y0) * PX, night, true));
  face(ctx, at(r.x0, r.y1, ROOF + 6), 'x', () => valance(ctx, roofLong, night, false));
  // The marquee on the roof, with bulbs that chase at showtime.
  const signMid = (r.x0 + r.x1) / 2;
  const signY = (r.y0 + r.y1) / 2;
  const sign = at(signMid - 15 / PX, signY, ROOF + 9);
  face(ctx, sign, 'x', () => {
    rect(ctx, 6, 0, 1.5, 3, pick(C.wheel, night));
    rect(ctx, 22.5, 0, 1.5, 3, pick(C.wheel, night));
    rect(ctx, 0, -11, 30, 11, pick(C.red, night));
    rect(ctx, 1.5, -9.5, 27, 8, pick(C.cream, night));
    if (s.snow > 0)
      rect(ctx, 0, -12, 30, 1, mixHex(pick(C.red, night), pick(SNOW.top, night), s.snow));
    ctx.font = 'bold 6px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = pick(C.red, night);
    ctx.fillText('POPCORN', 15, -3.5);
    const step = Math.floor(minutes * 3);
    for (let i = 0; i < 8; i++) {
      const on = open && (i + step) % 3 !== 0;
      rect(ctx, 1 + i * 4, -11, 1.5, 1.5, on ? LIT.bulb : pick(C.bulb, night));
    }
  });
  if (open && night) {
    const glass = at((CASE.x0 + CASE_X1) / 2, (CASE_Y0 + CASE_Y1) / 2, BODY.top + 8);
    drawGlow(ctx, glass.x, glass.y, 30, 0.2);
    drawGlow(ctx, sign.x + 15, sign.y - 6, 18, 0.14);
  }
}

// ---------------------------------------------------------------------------------------------
// The projector: a 35 mm machine on a wooden stand behind the audience, aimed along -y at the
// screen, with a feed reel that empties into the take-up reel over the night's bill.

const TABLE = { x0: 25.31, x1: 25.69, y0: 20.2, y1: 20.84, high: 13 };
const MACHINE = { x0: 25.39, x1: 25.61, y0: 20.34, y1: 20.64, high: 10 };
const LAMP = { y1: 20.8, high: 15 };
/** The feed reel up front and the take-up reel over the lamp house. */
const REELS = { feed: 20.3, takeUp: 20.73 };
const REEL_R = 7,
  REEL_RISE = TABLE.high + 23;
const LENS = { y: 20.13, rise: TABLE.high + 5 };
export const PROJECTOR_DEPTH = 46;
/** Where the cart and the projector's stand meet the lawn. */
export const CINEMA_PROPS = { cart: CART, projector: TABLE } as const;
/** Where the beam leaves the lens, in world pixels. */
export const LENS_TIP = at(25.5, LENS.y, LENS.rise);

function reel(ctx: Ctx, u: number, s: CinemaPropsState, full: number, spin: number) {
  const { night } = s;
  const v = -REEL_RISE;
  disc(ctx, u, v, REEL_R, pick(C.reel, night));
  // Three windows in the flange show how much film is still wound on.
  const hole = mixHex(pick(C.empty, night), pick(C.film, night), full);
  ctx.fillStyle = hole;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = spin + (k * TAU) / 3;
    const hx = u + Math.cos(a) * 3.9,
      hy = v + Math.sin(a) * 3.9;
    ctx.moveTo(hx + 2.1, hy);
    ctx.arc(hx, hy, 2.1, 0, TAU);
  }
  ctx.fill();
  disc(ctx, u, v, 1.4, pick(C.metalLight, night));
}

export function drawProjector(ctx: Ctx, s: CinemaPropsState) {
  const { night, live, minutes, progress } = s;
  const T = TABLE,
    M = MACHINE;
  const tableLong = (T.x1 - T.x0) * PX,
    tableDeep = (T.y1 - T.y0) * PX;
  level(ctx, T.x0 - 0.05, T.y0 - 0.02, T.x1 + 0.12, T.y1 + 0.1, 0, pick(C.shadow, night));
  // A low shelf with two film cans, between the legs.
  level(ctx, T.x0 + 0.03, T.y0 + 0.03, T.x1 - 0.03, T.y1 - 0.03, 4, pick(C.woodSide, night));
  for (const [y, rise] of [
    [20.62, 4],
    [20.6, 6.5],
  ] as const) {
    const can = at(25.5, y, rise);
    rect(ctx, can.x - 6.5, can.y - 2.5, 13, 2.5, pick(C.canShade, night));
    ctx.fillStyle = pick(C.can, night);
    ctx.beginPath();
    ctx.ellipse(can.x, can.y - 2.5, 6.5, 3.25, 0, 0, TAU);
    ctx.fill();
    rect(ctx, can.x - 1.5, can.y - 3, 3, 1, pick(C.canShade, night));
  }
  face(ctx, at(T.x0, T.y1), 'x', () => {
    rect(ctx, 0, -T.high, 2, T.high, pick(C.woodFront, night));
    rect(ctx, tableLong - 2, -T.high, 2, T.high, pick(C.woodFront, night));
    rect(ctx, 0, -T.high, tableLong, 2, pick(C.woodFront, night));
  });
  face(ctx, at(T.x1, T.y1), 'y', () => {
    rect(ctx, 0, -T.high, 2, T.high, pick(C.woodSide, night));
    rect(ctx, tableDeep - 2, -T.high, 2, T.high, pick(C.woodSide, night));
    rect(ctx, 0, -T.high, tableDeep, 2, pick(C.woodSide, night));
  });
  level(ctx, T.x0, T.y0, T.x1, T.y1, T.high, pick(C.wood, night));
  // The lens barrel points past the machine toward the screen.
  face(ctx, at(25.53, M.y0, T.high), 'y', () => {
    const long = (M.y0 - LENS.y) * PX;
    rect(ctx, 0, -7, long, 4, pick(C.metalShade, night));
    rect(ctx, 0, -7, long, 1, pick(C.metalLight, night));
    rect(ctx, long - 2.5, -7.5, 1.5, 5, pick(C.gold, night));
  });
  // The machine: a dark body and the lamp house behind it, facing the audience.
  const bodyDeep = (M.y1 - M.y0) * PX;
  face(ctx, at(M.x1, M.y1, T.high), 'y', () => {
    rect(ctx, 0, -M.high, bodyDeep, M.high, pick(C.metalShade, night));
    rect(ctx, 2, -M.high + 2, bodyDeep - 4, M.high - 4, pick(C.metal, night));
    disc(ctx, bodyDeep - 3.5, -M.high + 3.5, 1.5, pick(C.metalLight, night));
  });
  level(
    ctx,
    M.x0,
    M.y0,
    M.x1,
    M.y1,
    T.high + M.high,
    mixHex(pick(C.metalTop, night), pick(SNOW.top, night), s.snow),
  );
  // Feed reel up front, take-up reel over the lamp house; both turn while the show runs.
  const spin = live ? -minutes * 2.4 : 0.4;
  const reelFace = at(25.5, T.y1, 0);
  face(ctx, reelFace, 'y', () => {
    const front = (T.y1 - REELS.feed) * PX;
    rect(
      ctx,
      front - 0.75,
      -REEL_RISE,
      1.5,
      REEL_RISE - T.high - M.high,
      pick(C.metalShade, night),
    );
    // The film runs down from the feed reel into the gate.
    rect(ctx, front - REEL_R + 1, -REEL_RISE, 1, REEL_RISE - T.high - M.high, pick(C.film, night));
    reel(ctx, front, s, 1 - progress, spin);
  });
  const L = { x0: 25.4, x1: 25.6, y0: M.y1, y1: LAMP.y1 };
  const lampLong = (L.x1 - L.x0) * PX,
    lampDeep = (L.y1 - L.y0) * PX;
  const vent = live && night ? LIT.vent : pick(C.film, night);
  face(ctx, at(L.x1, L.y1, T.high), 'y', () => {
    rect(ctx, 0, -LAMP.high, lampDeep, LAMP.high, pick(C.metalShade, night));
    for (let i = 0; i < 3; i++) rect(ctx, 1.5, -LAMP.high + 4 + i * 3, lampDeep - 3, 1, vent);
  });
  face(ctx, at(L.x0, L.y1, T.high), 'x', () => {
    rect(ctx, 0, -LAMP.high, lampLong, LAMP.high, pick(C.metal, night));
    for (let i = 0; i < 3; i++) rect(ctx, 1.5, -LAMP.high + 4 + i * 3, lampLong - 3, 1, vent);
    rect(ctx, 0, -LAMP.high, lampLong, 1.5, pick(C.metalLight, night));
  });
  level(
    ctx,
    L.x0,
    L.y0,
    L.x1,
    L.y1,
    T.high + LAMP.high,
    mixHex(pick(C.metalTop, night), pick(SNOW.top, night), s.snow),
  );
  face(ctx, reelFace, 'y', () => {
    const back = (T.y1 - REELS.takeUp) * PX;
    rect(
      ctx,
      back - 0.75,
      -REEL_RISE,
      1.5,
      REEL_RISE - T.high - LAMP.high,
      pick(C.metalShade, night),
    );
    rect(
      ctx,
      back + REEL_R - 2,
      -REEL_RISE,
      1,
      REEL_RISE - T.high - LAMP.high,
      pick(C.film, night),
    );
    reel(ctx, back, s, progress, spin);
  });
  if (live && night) {
    const lamp = at(25.5, (L.y0 + L.y1) / 2, T.high + 8);
    drawGlow(ctx, lamp.x, lamp.y, 14, 0.16);
    drawGlow(ctx, LENS_TIP.x, LENS_TIP.y, 10, 0.4);
  }
}

// ---------------------------------------------------------------------------------------------
// The beam: the sides of a pyramid of light from the lens to the picture on the cloth. The
// picture itself is left out, so the beam never washes over the film.

export function paintBeam(
  ctx: Ctx,
  corners: readonly [Point, Point, Point, Point],
  minutes: number,
) {
  const [tl, tr, br, bl] = corners;
  const lens = LENS_TIP;
  const middle = { x: (tl.x + br.x) / 2, y: (tl.y + br.y) / 2 };
  // A slow shimmer, never a flicker.
  const shimmer = 0.92 + 0.08 * Math.sin(minutes * 1.7) * Math.sin(minutes * 0.63 + 1);
  const glow = ctx.createLinearGradient(lens.x, lens.y, middle.x, middle.y);
  glow.addColorStop(0, `rgba(255, 243, 212, ${0.24 * shimmer})`);
  glow.addColorStop(0.3, `rgba(255, 243, 212, ${0.1 * shimmer})`);
  glow.addColorStop(1, `rgba(255, 243, 212, ${0.035 * shimmer})`);
  ctx.save();
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.moveTo(lens.x, lens.y);
  ctx.lineTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.closePath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.closePath();
  ctx.fill('evenodd');
  // Its outline, faint, so the cone reads from across the lawn.
  ctx.strokeStyle = `rgba(255, 243, 212, ${0.1 * shimmer})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(lens.x, lens.y);
  ctx.lineTo(br.x, br.y);
  ctx.stroke();
  // Dust drifting through the light near the lens.
  ctx.fillStyle = '#FFF6DC99';
  for (let i = 0; i < 7; i++) {
    const t = 0.06 + 0.4 * frac(i * 0.382 + minutes * 0.011);
    const side = Math.sin(i * 2.4 + minutes * 0.35) * 0.5;
    const x = lens.x + (middle.x - lens.x) * t + (tl.x - bl.x) * side * t * 0.6,
      y = lens.y + (middle.y - lens.y) * t + (tl.y - bl.y) * side * t * 0.6;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}
