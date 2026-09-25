import type { FilmModule } from './types';
import {
  alpha,
  backOut,
  box,
  camera,
  captions,
  clamp,
  disc,
  ease,
  easeIn,
  easeOut,
  glow,
  H,
  handOf,
  hump,
  lerp,
  line,
  mix,
  oval,
  person,
  poly,
  presence,
  rand,
  shade,
  sky,
  span,
  TAU,
  track,
  veil,
  vignette,
  W,
  within,
  write,
  type Ctx,
  type Figure,
  type View,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * THE GREAT PIE HEIST
 * Rocco the raccoon has a meticulous three-step plan to steal a cherry pie cooling on a
 * windowsill. Every step goes gloriously wrong, and when he's finally caught dangling upside
 * down in front of the baker, she laughs and sets out an extra plate.
 *
 * One timetable (T) drives both the pictures and the score, so every squeak, boing, thud,
 * and yowl lands on its frame. The garden is one set seen through one camera track with hard
 * cuts; the plan, the bench, and the sunset are sets of their own.
 */

// ——— Timetable, in story time ———
const T = {
  glint: 0.056,
  rise: 0.068,
  push: 0.262,
  hose: 0.3,
  land: 0.333,
  daisy: 0.346,
  cast: 0.384,
  hook: 0.398,
  yowl: 0.42,
  launch: 0.43,
  pounce: 0.447,
  settle: 0.476,
  ridge: 0.503,
  open: 0.508,
  jump: 0.518,
  gust: 0.537,
  snag: 0.55,
  spot: 0.576,
  reach: 0.592,
  window: 0.612,
  laugh: 0.72,
  burst: 0.732,
  wipe: 0.748,
  exit: 0.764,
  back: 0.784,
  unroll: 0.87,
  wink: 0.93,
} as const;
const REEL_TICKS = [0.406, 0.41, 0.414, 0.418] as const;
const CLIMB_GRABS = [0.492, 0.495, 0.498, 0.501] as const;
const PLAN_AT = 0.1,
  SKATE_AT = 0.25,
  BENCH_AT = 0.8;

// ——— Palette ———
const FUR = '#A29DAC',
  FUR_DARK = '#6D6879',
  FUR_LIGHT = '#CBC6D3',
  BELLY = '#DCD7E1',
  MASK = '#221E29',
  WHITE = '#F6F3F8',
  PAW = '#3B3643',
  INK = '#1C1820',
  TAIL_DARK = '#39343F',
  BEANIE = '#1E1A23';
const ORANGE = '#EC9444',
  STRIPE = '#C0662A',
  CREAM = '#F8D9AE';
const CRUST = '#E8B060',
  CRUST_DARK = '#C4853C',
  CHERRY = '#B3223A';
const ACCENT = '#E0504B';
const CHALK = '#EAF1FA',
  PAPER = '#1C3A6E',
  GRID = '#27497F';
const TRIM = '#F5EFE3',
  GUTTER = '#8B8F99',
  APRON = '#FBF6EC',
  FRAMES = '#5E4A56';

// ——— Rocco ———
type Eyes = 'open' | 'wide' | 'narrow' | 'happy' | 'closed' | 'dizzy';
type Mouth = 'smile' | 'smirk' | 'grin' | 'o' | 'open' | 'flat' | 'frown' | 'chew';
type Raccoon = {
  size?: number;
  facing?: 1 | -1;
  eyes?: Eyes;
  mouth?: Mouth;
  /** Where the pupils point, -1..1 on each axis. */
  look?: readonly [number, number];
  /** Arm angles from hanging straight down; positive swings toward the facing side. */
  arms?: readonly [number, number];
  legs?: 'stand' | 'crouch' | 'sit' | 'tuck' | 'splay' | 'climb';
  step?: number;
  /** Rotation about the middle of the body, for flips and falls. */
  spin?: number;
  hang?: boolean;
  daisy?: boolean;
  /** After the cat: tufts of fur, a sticking plaster, a crooked beanie. */
  bruised?: boolean;
  /** How much pie is inside him, and how much is still on his face. */
  full?: number;
  stain?: boolean;
  /** Paint every part in this one colour: an outline pass. */
  ink?: string;
  /** Film seconds, for the tail's idle sway and chewing. */
  t?: number;
};
const SHOULDER = -19;
/** The hanging tail is a little shorter, so his face meets the pie on the sill. */
const HANG_STEP = 2.3;
const dipOf = (r: Raccoon) => (r.legs === 'crouch' ? 4 : r.legs === 'sit' ? 5 : 0);

/** A bushy ringed tail: overlapping discs that alternate grey and black, tip dark. */
function ringTail(
  ctx: Ctx,
  x: number,
  y: number,
  angle: number,
  curl: number,
  step = 2.6,
  ink?: string,
) {
  const k = (c: string) => ink ?? c;
  const radii = [2.6, 3.2, 3.6, 3.8, 3.7, 3.4, 2.9, 2.3];
  let a = angle,
    px = x,
    py = y;
  radii.forEach((r, i) => {
    px -= Math.cos(a) * step;
    py -= Math.sin(a) * step;
    disc(ctx, px, py, r, (radii.length - 1 - i) % 2 === 0 ? k(TAIL_DARK) : k(FUR_LIGHT));
    a += curl;
  });
}
function limb(ctx: Ctx, angle: number, color: string, sx: number, ink?: string) {
  const k = (c: string) => ink ?? c;
  ctx.save();
  ctx.translate(sx, SHOULDER);
  ctx.rotate(-angle);
  box(ctx, -1.5, -1, 3, 8, k(color));
  oval(ctx, 0, 7.4, 2.1, 1.9, k(PAW));
  ctx.restore();
}
function daisy(ctx: Ctx, x: number, y: number, tilt: number, ink?: string) {
  const k = (c: string) => ink ?? c;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  line(ctx, k('#5E9A48'), 0.9, [0, 0, 0, -5]);
  for (let petal = 0; petal < 7; petal++) {
    const a = (petal * TAU) / 7;
    oval(ctx, Math.cos(a) * 2.1, -6.5 + Math.sin(a) * 2.1, 1.6, 0.9, k(WHITE), a);
  }
  disc(ctx, 0, -6.5, 1.2, k('#F2C230'));
  ctx.restore();
}

/** Eyes, mouth, and the souvenirs of the day, drawn inside the head. */
function raccoonFace(ctx: Ctx, r: Raccoon, t: number) {
  const eyes = r.eyes ?? 'open',
    mouth = r.mouth ?? 'smile';
  const [lx, ly] = r.look ?? [0.4, 0];

  // Big expressive eyes: whites in the bandit mask.
  [1, 6.8].forEach((ex, i) => {
    const rx = i ? 2.1 : 1.9,
      ey = -28;
    if (eyes === 'open' || eyes === 'narrow' || eyes === 'wide') {
      const wide = eyes === 'wide';
      oval(ctx, ex, ey, rx + (wide ? 0.5 : 0), wide ? 3 : 2.4, WHITE);
      disc(ctx, ex + lx * 0.8, ey + 0.2 + ly * 0.9, wide ? 0.95 : 1.2, INK);
      if (eyes === 'narrow') box(ctx, ex - 3, ey - 3.2, 6, 3, MASK);
    } else if (eyes === 'happy')
      line(ctx, WHITE, 1.1, [ex - 1.9, ey + 0.8, ex, ey - 1.2, ex + 1.9, ey + 0.8]);
    else if (eyes === 'closed') line(ctx, WHITE, 1.1, [ex - 1.9, ey, ex + 1.9, ey + 0.4]);
    else {
      line(ctx, WHITE, 0.9, [ex - 1.5, ey - 1.5, ex + 1.5, ey + 1.5]);
      line(ctx, WHITE, 0.9, [ex - 1.5, ey + 1.5, ex + 1.5, ey - 1.5]);
    }
  });
  if (mouth === 'smile') line(ctx, INK, 0.9, [8, -22.4, 10.2, -21, 12.6, -22.2]);
  else if (mouth === 'smirk') line(ctx, INK, 0.9, [8.4, -21.4, 11, -21.4, 13, -22.8]);
  else if (mouth === 'grin') {
    poly(ctx, INK, [7.4, -22.8, 13.4, -22.8, 12, -19.6, 8.8, -19.6]);
    box(ctx, 8.4, -22.8, 4.2, 1, WHITE);
  } else if (mouth === 'o') oval(ctx, 11, -21, 1.3, 1.6, INK);
  else if (mouth === 'open') {
    oval(ctx, 10.8, -20.6, 2.3, 2.6, INK);
    oval(ctx, 10.8, -19.2, 1.3, 0.9, '#D76C7C');
  } else if (mouth === 'flat') line(ctx, INK, 0.9, [8.4, -21.4, 12.6, -21.4]);
  else if (mouth === 'frown') line(ctx, INK, 0.9, [8.2, -20.6, 10.4, -21.9, 12.6, -20.6]);
  else {
    const full = Math.sin(t * 9) > 0;
    oval(ctx, 8.4, -22.4, full ? 4.8 : 4, full ? 2.9 : 2.3, WHITE);
    line(ctx, INK, 0.9, [8.6, -21.2, 12.4, full ? -21.6 : -21]);
  }
  if (r.stain) {
    // Cherry at the corners of the grin and a crumb on the chin.
    box(ctx, 7, -21.6, 1.8, 1.4, CHERRY);
    disc(ctx, 13.2, -21.6, 1, CHERRY);
    box(ctx, 10.2, -19, 1.2, 1, CRUST);
  }
  if (r.bruised) {
    // A sticking plaster across the nose and a few tufts standing on end.
    box(ctx, 9, -27, 4.6, 1.8, '#EBC99F');
    box(ctx, 10.5, -26.6, 1, 1, '#C9A47A');
    poly(ctx, FUR_LIGHT, [-7, -35, -10.5, -38, -6, -37]);
    poly(ctx, FUR_LIGHT, [11, -30, 14.8, -31.4, 11.6, -28]);
    poly(ctx, FUR_LIGHT, [-9, -24, -12.5, -25, -9.5, -22]);
  }
}
function raccoonHead(ctx: Ctx, r: Raccoon, t: number) {
  const k = (c: string) => r.ink ?? c;
  // Ears sit behind the skull; the cheek ruff flares out behind the mask.
  // An outline pass (`ink`) only needs the silhouette, not the face inside it.
  const face = !r.ink;
  poly(ctx, k(FUR_DARK), [-7, -31, -5.5, -41, 0.5, -35]);
  if (face) poly(ctx, '#58495A', [-5.2, -33.5, -4.8, -38.4, -1.6, -35]);
  poly(ctx, k(FUR), [4.5, -35, 8.5, -42, 11.5, -33]);
  if (face) poly(ctx, '#58495A', [6.4, -35, 8.4, -39.4, 10, -34]);
  poly(ctx, k(FUR), [-6, -32, -11.5, -21.5, -2, -24]);
  oval(ctx, 2, -28, 10, 8.2, k(FUR));
  if (face) {
    oval(ctx, 4.6, -31.8, 7.4, 2.3, WHITE);
    oval(ctx, 3.8, -27.8, 8.8, 3.5, MASK);
    poly(ctx, MASK, [-3.5, -30.5, -9, -24, -1.5, -25.5]);
  }
  oval(ctx, 7.8, -23.6, 5.8, 3.6, k(WHITE));
  oval(ctx, 11.8, -24.6, 3.2, 2.4, k(WHITE));
  disc(ctx, 14.3, -25.2, 1.5, k(MASK));
  if (face) raccoonFace(ctx, r, t);
  // The tiny black burglar's beanie, knocked askew by the cat.
  ctx.save();
  if (r.bruised) {
    ctx.translate(2, -36);
    ctx.rotate(-0.24);
    ctx.translate(-2, 36);
  }
  poly(ctx, k(BEANIE), [-5.2, -34.4, -3.6, -39.6, 2, -41.6, 7.6, -39.6, 9.6, -34.4]);
  box(ctx, -5.6, -35.8, 15.6, 2.4, k('#302A37'));
  disc(ctx, 2, -42.2, 1.8, k('#3B3544'));
  if (r.daisy) daisy(ctx, 7, -40, 0.35 + Math.sin(t * 2.4) * 0.15, r.ink);
  ctx.restore();
}

function raccoon(ctx: Ctx, r: Raccoon) {
  const k = (c: string) => r.ink ?? c;
  const t = r.t ?? 0;
  const dip = dipOf(r);
  const [backArm, frontArm] = r.arms ?? [0.25, -0.1];
  const swing = r.step === undefined ? 0 : Math.sin(r.step);
  if (r.hang) ringTail(ctx, -5, -9, -Math.PI / 2, 0, HANG_STEP, r.ink);
  else ringTail(ctx, -5, -9 + dip, 0.45 + Math.sin(t * 2.3) * 0.08, 0.16, 2.6, r.ink);
  switch (r.legs ?? 'stand') {
    case 'stand': {
      const a = swing * 1.6;
      box(ctx, -5 - a, -7, 4, 6, k(FUR_DARK));
      box(ctx, -6 - a, -2 - Math.max(0, swing) * 1.5, 5, 2, k(PAW));
      box(ctx, a, -7, 4, 6, k(FUR));
      box(ctx, a, -2 - Math.max(0, -swing) * 1.5, 6, 2, k(PAW));
      break;
    }
    case 'crouch':
      box(ctx, -7, -4, 5, 3, k(FUR_DARK));
      box(ctx, -8, -2, 6, 2, k(PAW));
      box(ctx, 0, -4, 5, 3, k(FUR));
      box(ctx, 0, -2, 7, 2, k(PAW));
      break;
    case 'sit':
      box(ctx, -3, -6, 9, 4, k(FUR_DARK));
      box(ctx, 5, -8, 3, 6, k(PAW));
      box(ctx, 0, -5, 10, 4, k(FUR));
      box(ctx, 9, -8, 3, 7, k(PAW));
      break;
    case 'tuck':
      box(ctx, -4, -9, 5, 5, k(FUR_DARK));
      box(ctx, 1, -9, 5, 5, k(FUR));
      box(ctx, -3, -5, 4, 2, k(PAW));
      box(ctx, 3, -5, 4, 2, k(PAW));
      break;
    case 'splay':
      line(ctx, k(FUR_DARK), 3.4, [-3, -8, -9, -2 + swing * 2]);
      disc(ctx, -10, -1.5 + swing * 2, 2, k(PAW));
      line(ctx, k(FUR), 3.4, [3, -8, 9, -2 - swing * 2]);
      disc(ctx, 10, -1.5 - swing * 2, 2, k(PAW));
      break;
    case 'climb': {
      const a = swing * 3;
      box(ctx, -4, -8 + a, 4, 6, k(FUR_DARK));
      box(ctx, -4, -3 + a, 5, 2, k(PAW));
      box(ctx, 1, -8 - a, 4, 6, k(FUR));
      box(ctx, 1, -3 - a, 5, 2, k(PAW));
      break;
    }
  }
  ctx.save();
  ctx.translate(0, dip);
  limb(ctx, backArm, FUR_DARK, -2, r.ink);
  const full = r.full ?? 0;
  oval(ctx, -0.8, -14, 7.4 + full, 8.6, k(FUR_DARK));
  oval(ctx, 0.4, -14 + full * 0.3, 7 + full * 1.8, 8.6 + full * 0.5, k(FUR));
  oval(ctx, 2 + full * 1.2, -13 + full * 0.5, 4.6 + full * 2, 6.4 + full, k(BELLY));
  raccoonHead(ctx, r, t);
  limb(ctx, frontArm, FUR, 2.5, r.ink);
  ctx.restore();
}
/** Rocco standing at (x, y), his feet on the ground; `spin` turns him about his middle. */
function rocco(ctx: Ctx, x: number, y: number, r: Raccoon) {
  const s = r.size ?? 1.1,
    f = r.facing ?? 1;
  ctx.save();
  ctx.translate(x, y);
  if (r.spin) {
    ctx.translate(0, -16 * s);
    ctx.rotate(r.spin * f);
    ctx.translate(0, 16 * s);
  }
  ctx.scale(f * s, s);
  raccoon(ctx, r);
  ctx.restore();
}
/**
 * Rocco hanging upside down by his tail from (gx, gy). The figure is mirrored vertically, so
 * he still faces the way he was facing, and the tail tip sits exactly on the hook point.
 */
function hanging(ctx: Ctx, gx: number, gy: number, swing: number, r: Raccoon) {
  const s = r.size ?? 1.1,
    f = r.facing ?? 1;
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(swing);
  ctx.save();
  ctx.scale(f * s, -s);
  ctx.translate(5, 9 - 8 * HANG_STEP);
  // A dark outline first, so the upside-down shape reads against the pale wall.
  for (const [ox, oy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    ctx.save();
    ctx.translate(ox, oy);
    raccoon(ctx, { ...r, hang: true, ink: '#231B28' });
    ctx.restore();
  }
  raccoon(ctx, { ...r, hang: true });
  ctx.restore();
  // The tip of the tail wraps once around the gutter.
  disc(ctx, 0, -1.2 * s, 2.6 * s, TAIL_DARK);
  disc(ctx, -1.8 * s, 0.8 * s, 2 * s, TAIL_DARK);
  ctx.restore();
}
/** Where one of Rocco's paws is, for props (ignores `spin`). */
function pawOf(x: number, y: number, r: Raccoon, side: 'front' | 'back' = 'front') {
  const s = r.size ?? 1.1,
    f = r.facing ?? 1;
  const [back, front] = r.arms ?? [0.25, -0.1];
  const angle = side === 'front' ? front : back;
  const hx = (side === 'front' ? 2.5 : -2) + Math.sin(angle) * 7.4;
  const hy = SHOULDER + dipOf(r) + Math.cos(angle) * 7.4;
  return { x: x + hx * f * s, y: y + hy * s };
}

// ——— Miso, the cat on the back step ———
type CatPose = 'nap' | 'alarm' | 'air' | 'sit' | 'lap' | 'smug';
type Cat = { size?: number; facing?: 1 | -1; t?: number; lift?: number; open?: number };
const catEar = (ctx: Ctx, x: number, y: number, dx: number) => {
  poly(ctx, ORANGE, [x - 2.4, y + 2, x + dx, y - 5.5, x + 2.6, y + 1]);
  poly(ctx, '#E9A1A0', [x - 1, y + 1, x + dx * 0.8, y - 3.2, x + 1.4, y + 0.6]);
};
function miso(ctx: Ctx, x: number, y: number, pose: CatPose, c: Cat = {}) {
  const t = c.t ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((c.facing ?? 1) * (c.size ?? 1), c.size ?? 1);
  if (pose === 'nap' || pose === 'alarm') {
    const breathe = pose === 'nap' ? Math.sin(t * 1.7) * 0.5 : 0;
    const lift = c.lift ?? 0,
      open = c.open ?? 1;
    // The tail stretches out behind her along the step, lifted at the tip by the line.
    line(ctx, ORANGE, 3.2, [-9, -2.6, -15, -2.6 - lift * 0.35, -21, -2.6 - lift]);
    for (const k of [0.35, 0.7]) box(ctx, -9 - 12 * k, -4 - lift * k * 0.8, 1.4, 3, STRIPE);
    if (pose === 'alarm' && open > 0.9)
      for (let k = 0; k < 7; k++)
        poly(ctx, ORANGE, [-9 + k * 3, -12, -7.5 + k * 3, -17.5, -6 + k * 3, -12]);
    oval(ctx, 0, -7 - breathe * 0.5, 12.5, 7 + breathe, ORANGE);
    for (const sx of [-8, -4, 0, 4]) box(ctx, sx, -13.8 - breathe, 2, 4.2, STRIPE);
    oval(ctx, 5, -2.2, 7, 2.2, CREAM);
    oval(ctx, 15, -1.2, 3, 1.4, CREAM);
    const hx = 11,
      hy = -8.5;
    catEar(ctx, hx - 3.5, hy - 5, pose === 'alarm' && open > 0.9 ? -3 : 0);
    catEar(ctx, hx + 3.5, hy - 5, pose === 'alarm' && open > 0.9 ? 3 : 1);
    disc(ctx, hx, hy, 6, ORANGE);
    box(ctx, hx - 1.5, hy - 6, 1, 2.4, STRIPE);
    box(ctx, hx + 0.5, hy - 6.2, 1, 2.6, STRIPE);
    oval(ctx, hx + 2.6, hy + 1.8, 3.2, 2.2, CREAM);
    box(ctx, hx + 4.6, hy + 0.4, 1.3, 1, '#D8736E');
    for (const [i, ex] of [
      [0, hx - 1.8],
      [1, hx + 2.6],
    ] as const) {
      if (pose === 'nap' || open < (i ? 0.3 : 0.7))
        line(ctx, INK, 0.7, [ex - 1.2, hy - 0.8, ex, hy, ex + 1.2, hy - 0.8]);
      else {
        disc(ctx, ex, hy - 0.8, 1.9, '#F4F0C8');
        box(ctx, ex - 0.4, hy - 2.2, 0.9, 2.8, INK);
      }
    }
    if (pose === 'alarm' && open > 0.9) {
      oval(ctx, hx + 3, hy + 3.4, 2.1, 2.4, INK);
      box(ctx, hx + 1.9, hy + 1.6, 0.8, 1.2, WHITE);
      box(ctx, hx + 3.6, hy + 1.6, 0.8, 1.2, WHITE);
    }
  } else if (pose === 'air') {
    // Every hair on end, legs locked straight, tail like a bottle brush.
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU,
        cx = Math.cos(a),
        cy = Math.sin(a);
      poly(ctx, ORANGE, [
        cx * 8 - cy * 2.4,
        -10 + cy * 7 + cx * 2.4,
        cx * 13,
        -10 + cy * 11,
        cx * 8 + cy * 2.4,
        -10 + cy * 7 - cx * 2.4,
      ]);
    }
    oval(ctx, 0, -10, 10, 8.5, ORANGE);
    for (const sx of [-6, -2, 2]) box(ctx, sx, -18, 1.6, 5, STRIPE);
    for (const [a, b, cx2, cy2] of [
      [-6, -4, -10, 4],
      [-2, -3, -3, 6],
      [3, -3, 4, 6],
      [7, -4, 11, 4],
    ]) {
      line(ctx, ORANGE, 2.8, [a, b, cx2, cy2]);
      disc(ctx, cx2, cy2, 1.6, CREAM);
    }
    line(ctx, ORANGE, 5, [-8, -15, -11, -28]);
    for (let k = 0; k < 4; k++) {
      poly(ctx, ORANGE, [
        -10.5 - k * 0.75,
        -17 - k * 3,
        -15.5 - k * 0.75,
        -19 - k * 3,
        -11 - k * 0.75,
        -20 - k * 3,
      ]);
      poly(ctx, ORANGE, [
        -8 - k * 0.75,
        -17 - k * 3,
        -4 - k * 0.75,
        -19 - k * 3,
        -8.5 - k * 0.75,
        -20 - k * 3,
      ]);
    }
    box(ctx, -11.2, -24, 2.6, 1.4, STRIPE);
    catEar(ctx, 4, -21, -3);
    catEar(ctx, 11.5, -21, 3);
    disc(ctx, 8, -16, 6.5, ORANGE);
    for (const ex of [5.6, 10.6]) {
      disc(ctx, ex, -17, 2, '#F4F0C8');
      box(ctx, ex - 0.4, -18.4, 0.9, 2.8, INK);
    }
    oval(ctx, 8.2, -12, 2.4, 2.6, INK);
    box(ctx, 6.8, -14.2, 0.8, 1.3, WHITE);
    box(ctx, 8.9, -14.2, 0.8, 1.3, WHITE);
  } else {
    // Sitting up: curled tail, cream chest, a head that can bow to a saucer.
    oval(ctx, -5, -1.6, 7.5, 2.2, ORANGE);
    box(ctx, -9, -3, 1.4, 2.8, STRIPE);
    box(ctx, -4, -3.4, 1.4, 3, STRIPE);
    oval(ctx, 0, -9, 7.5, 9, ORANGE);
    oval(ctx, 3.5, -9, 3.6, 6, CREAM);
    for (const sy of [-14, -10, -6]) box(ctx, -6.8, sy, 3, 1.4, STRIPE);
    box(ctx, 2, -6, 2.6, 6, ORANGE);
    box(ctx, 5.2, -6, 2.6, 6, ORANGE);
    box(ctx, 2, -1.4, 2.8, 1.4, CREAM);
    box(ctx, 5.2, -1.4, 2.8, 1.4, CREAM);
    const lap = pose === 'lap' ? 0.5 + 0.5 * Math.sin(t * 5) : 0;
    const hx = pose === 'lap' ? 8 : 2.5,
      hy = pose === 'lap' ? -9 + lap : -19.5;
    catEar(ctx, hx - 3.4, hy - 4.6, -1);
    catEar(ctx, hx + 3, hy - 4.6, 1.2);
    disc(ctx, hx, hy, 6.2, ORANGE);
    box(ctx, hx - 1, hy - 6, 1, 2.4, STRIPE);
    oval(ctx, hx + 2.5, hy + 2.2, 3, 2, CREAM);
    box(ctx, hx + 3.8, hy + 0.6, 1.3, 1, '#D8736E');
    if (pose === 'sit') {
      box(ctx, hx - 1.4, hy - 1.6, 1.2, 2, INK);
      box(ctx, hx + 2.6, hy - 1.6, 1.2, 2, INK);
    } else {
      for (const ex of [hx - 0.8, hx + 3.2])
        line(ctx, INK, 0.7, [ex - 1.2, hy - 0.6, ex, hy + 0.2, ex + 1.2, hy - 0.6]);
      if (pose === 'lap') box(ctx, hx + 3.6, hy + 4, 1.4, 1.2 + lap, '#E07A86');
    }
  }
  ctx.restore();
}
/** Where the tip of the napping cat's tail is (the fishing hook's target). */
const tailTip = (x: number, y: number, lift: number) => ({ x: x - 21, y: y - 2.6 - lift });

// ——— Grandma Rose ———
const ROSE: Figure = {
  skin: '#F2C8A6',
  hair: '#DEDAE3',
  coat: '#7C8EC8',
  legs: '#E9D6C4',
  shoes: '#6B4636',
  build: 'adult',
  hairStyle: 'bun',
};
type Rose = Partial<Figure> & {
  wink?: boolean;
  tear?: number;
  shake?: number;
  shins?: number;
  silhouette?: string;
};
/** The kit's townsperson in her apron and round glasses. */
function rose(ctx: Ctx, x: number, y: number, over: Rose) {
  const f: Figure = { ...ROSE, size: 2.2, ...over };
  const s = f.size ?? 2.2,
    facing = f.facing ?? 1,
    yy = y + (over.shake ?? 0);
  if (over.silhouette) {
    const c = over.silhouette;
    person(ctx, x, yy, { ...f, skin: c, hair: c, coat: c, legs: c, shoes: c, blush: false });
    return;
  }
  person(ctx, x, yy, f);
  ctx.save();
  ctx.translate(x, yy);
  ctx.scale(facing * s, s);
  if (f.sitting) {
    if (over.shins) {
      box(ctx, 9, -5, 3, over.shins + 4, f.legs);
      box(ctx, 8, over.shins - 2, 6, 2, f.shoes ?? INK);
    }
    ctx.translate(0, -1);
  }
  const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step));
  ctx.translate(0, f.sitting ? -3 : -11 - bob);
  ctx.rotate(f.lean ?? 0);
  // A skirt to the knee and a floury apron.
  if (f.sitting) {
    box(ctx, -4, -1, 15, 4, f.coat);
    box(ctx, -2, -1, 11, 3, APRON);
  } else {
    box(ctx, -5, -1, 11, 7, f.coat);
    box(ctx, -3, -2, 8, 7, APRON);
  }
  box(ctx, -2, -11, 6, 9, APRON);
  box(ctx, 2, -6, 2, 1, '#E6DAC6');
  box(ctx, -1, -9, 1, 1, '#E6DAC6');
  // Round glasses, a dab of flour, and the wink.
  const eyeY = -19;
  if (f.eyes === 'happy')
    for (const ex of [1.5, 4.5]) {
      box(ctx, ex - 1.5, eyeY - 1, 3, 3, f.skin);
      line(ctx, '#2A2530', 0.7, [ex - 1.2, eyeY + 1.4, ex, eyeY, ex + 1.2, eyeY + 1.4]);
    }
  if (over.wink) {
    box(ctx, 4, eyeY - 1, 2, 3, f.skin);
    box(ctx, 3, eyeY + 1, 3, 1, '#2A2530');
  }
  ctx.strokeStyle = FRAMES;
  ctx.lineWidth = 0.45;
  for (const ex of [1.6, 4.7]) {
    ctx.beginPath();
    ctx.arc(ex, eyeY + 1, 1.75, 0, TAU);
    ctx.stroke();
  }
  box(ctx, -4, eyeY, 3, 1, FRAMES);
  box(ctx, -2, eyeY + 3, 2, 1, alpha('#FFFFFF', 0.55));
  if (over.tear) disc(ctx, 6.6, eyeY + 2 + over.tear * 5, 0.8, '#9FD3F0');
  // The near arm again, over the apron.
  const front = (f.arms ?? [0, 0])[1];
  ctx.save();
  ctx.translate(1, -11);
  ctx.rotate(-front);
  box(ctx, -1, 0, 2, 10, f.coat);
  box(ctx, -1, 9, 2, 2, f.skin);
  ctx.restore();
  ctx.restore();
}

// ——— Props ———
function cherryPie(ctx: Ctx, x: number, y: number, s = 1, eaten = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  poly(ctx, '#8E95A2', [-11, -3, 11, -3, 9, 0, -9, 0]);
  if (eaten < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -3.5, 10.5, 6.5, 0, Math.PI, TAU);
    ctx.clip();
    box(ctx, -11, -11, 22, 8, CHERRY);
    box(ctx, -5, -8, 2, 1, '#E0506A');
    for (let k = -3; k <= 3; k++) {
      line(ctx, CRUST, 1.5, [k * 3.6 - 3, -3, k * 3.6 + 3, -11]);
      line(ctx, CRUST, 1.5, [k * 3.6 + 3, -3, k * 3.6 - 3, -11]);
    }
    // A missing slice or two, showing the tin.
    if (eaten > 0) poly(ctx, '#B9BEC8', [0, -3, 11, -3, 11, -11, 11 - eaten * 22, -11]);
    ctx.restore();
    for (let k = -5; k <= 5; k++)
      if (eaten === 0 || k < 1 - eaten * 8) disc(ctx, k * 2, -3.6, 1.3, k % 2 ? CRUST_DARK : CRUST);
  } else {
    box(ctx, -10, -4.2, 20, 1.4, '#B9BEC8');
    for (let k = 0; k < 7; k++) box(ctx, -8 + k * 2.6, -5 - (k % 2), 1, 1, CRUST_DARK);
    box(ctx, 3, -5, 1.5, 1, CHERRY);
  }
  ctx.restore();
}
/** Rising steam. With `beckon` it gathers into a hand that crooks one finger: come hither. */
function steam(ctx: Ctx, x: number, y: number, t: number, beckon = 0, dir: 1 | -1 = -1) {
  for (let i = 0; i < 4; i++) {
    const phase = (t * 0.45 + i / 4) % 1;
    const wx = x - 6 + i * 4 + Math.sin(t * 1.8 + i * 2 + phase * 5) * 2.2;
    const a = 0.32 * (1 - phase) * (1 - beckon);
    if (a > 0.01) disc(ctx, wx, y - 3 - phase * 20, 1.2 + phase * 1.8, alpha('#FFFFFF', a));
  }
  if (beckon <= 0) return;
  const col = alpha('#FFFFFF', 0.72 * beckon),
    soft = alpha('#FFFFFF', 0.3 * beckon);
  // A wavy wrist of steam, a palm, three folded fingers, and one crooked finger.
  const wrist: number[] = [];
  for (let k = 0; k <= 6; k++)
    wrist.push(x + Math.sin(k * 0.9 + t * 2) * 1.6 * (1 - k / 7), y - 2 - k * 3.4);
  line(ctx, soft, 5, wrist);
  line(ctx, col, 3, wrist);
  const px = x,
    py = y - 27;
  oval(ctx, px, py, 4.4, 3.8, col);
  for (let k = 0; k < 3; k++) disc(ctx, px + dir * 3.6, py + 2.2 - k * 1.9, 1.3, col);
  disc(ctx, px - dir * 3.4, py + 0.6, 1.4, col);
  const curl = 0.5 + 0.5 * Math.sin(t * 5);
  const finger = [px + dir * 1.6, py - 3.2];
  let fx = finger[0],
    fy = finger[1],
    angle = -Math.PI / 2;
  for (const len of [4.6, 3.9, 3.2]) {
    angle += dir * (0.25 + curl * 0.95);
    fx += Math.cos(angle) * len;
    fy += Math.sin(angle) * len;
    finger.push(fx, fy);
  }
  line(ctx, soft, 4.6, finger);
  line(ctx, col, 2.8, finger);
}
function skate(ctx: Ctx, x: number, y: number, tilt: number, spin: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  box(ctx, -9, -6, 18, 3, ACCENT);
  box(ctx, -9, -6, 18, 1, '#F2877C');
  box(ctx, 7, -9, 3, 4, '#B8383A');
  for (const wx of [-6, -1.8, 2.4, 6.6]) {
    disc(ctx, wx, -1.8, 1.9, '#2D2833');
    box(
      ctx,
      wx - 0.5 + Math.cos(spin + wx) * 0.9,
      -2.3 + Math.sin(spin + wx) * 0.9,
      1,
      1,
      '#E5DFD2',
    );
  }
  ctx.restore();
}
/** An umbrella held at (x, y); `inside` blows it inside out. */
function brolly(ctx: Ctx, x: number, y: number, open: number, inside = 0, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  line(ctx, '#3A3038', 1.1, [0, 2, 0, -31]);
  line(ctx, '#3A3038', 1.1, [0, 2, -1.2, 3.6, -3, 3, -3.4, 1.4]);
  if (open < 0.05) poly(ctx, ACCENT, [-1.8, -9, 0, -32, 1.8, -9]);
  else {
    const R = 3 + 14 * open;
    const rim = lerp(-21, -40, inside),
      tip = -31;
    const curve = (u: number) => tip + (rim - tip) * u * u;
    for (let k = 0; k < 6; k++) {
      const pts: number[] = [];
      for (let j = 0; j <= 3; j++) {
        const u = -1 + (2 * (k + j / 3)) / 6;
        pts.push(u * R, curve(u));
      }
      const u0 = -1 + (2 * k) / 6,
        u1 = -1 + (2 * (k + 1)) / 6;
      pts.push(u1 * R, rim, ((u0 + u1) / 2) * R, rim - 1.6 * (1 - 2 * inside), u0 * R, rim);
      poly(ctx, k % 2 ? '#F6ECDD' : ACCENT, pts);
    }
    if (inside > 0.4)
      for (let k = 0; k <= 6; k++) {
        const u = -1 + (2 * k) / 6;
        line(ctx, '#4A3C44', 0.7, [0, tip, u * R, rim]);
      }
  }
  ctx.restore();
}
function plate(ctx: Ctx, x: number, y: number, slice = false) {
  oval(ctx, x, y, 7, 2, '#F3F0EA');
  oval(ctx, x, y - 0.3, 4.8, 1.2, '#DCD7CF');
  if (slice) {
    poly(ctx, CRUST, [x - 3.5, y - 1, x + 3.5, y - 1.6, x + 3, y - 4]);
    box(ctx, x - 2, y - 2.2, 4, 1, CHERRY);
  }
}
function saucer(ctx: Ctx, x: number, y: number, milk = 1) {
  oval(ctx, x, y, 5.5, 1.7, '#E9E4F0');
  if (milk > 0) oval(ctx, x, y - 0.4, 3.6 * milk, 0.9 * milk, '#FFFFFF');
}
function fork(ctx: Ctx, x: number, y: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  box(ctx, -0.5, 0, 1, 7, '#C9CDD6');
  box(ctx, -1.5, -3, 3, 3, '#C9CDD6');
  box(ctx, -0.5, -3, 1, 2, alpha('#000000', 0.25));
  ctx.restore();
}

// ——— The plan, in chalk on blue paper ———
type Stroke = { pts: readonly number[]; color?: string; width?: number };
const arc = (cx: number, cy: number, r: number, from = 0, to = TAU, n = 16) => {
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
};
/** A chalk stick-raccoon: head, ears, bandit mask, body, legs, and a curly tail. */
const stickCoon = (x: number, y: number, arms: readonly number[]): Stroke[] => [
  { pts: arc(x, y, 4.5) },
  { pts: [x - 4, y - 2, x - 3.4, y - 7.5, x - 0.8, y - 4.2] },
  { pts: [x + 0.8, y - 4.2, x + 3.4, y - 7.5, x + 4, y - 2] },
  { pts: [x - 3.6, y - 0.4, x + 3.6, y - 0.4], width: 2.4 },
  { pts: [x, y + 4.5, x, y + 12] },
  { pts: [x - 3.5, y + 18, x, y + 12, x + 3.5, y + 18] },
  { pts: arms },
  { pts: [x - 0.5, y + 11, x - 5, y + 10, x - 8, y + 6, x - 7, y + 2] },
];
const arrow = (x0: number, y0: number, x1: number, y1: number): Stroke[] => {
  const a = Math.atan2(y1 - y0, x1 - x0);
  return [
    { pts: [x0, y0, x1, y1] },
    {
      pts: [
        x1 - Math.cos(a - 0.5) * 5,
        y1 - Math.sin(a - 0.5) * 5,
        x1,
        y1,
        x1 - Math.cos(a + 0.5) * 5,
        y1 - Math.sin(a + 0.5) * 5,
      ],
    },
  ];
};
type Step = {
  from: number;
  to: number;
  tap: number;
  label: string;
  x: number;
  strokes: readonly Stroke[];
};
const LABEL_Y = 128;
const STEPS: readonly Step[] = [
  {
    from: 0.113,
    to: 0.143,
    tap: 0.147,
    label: 'SKATE',
    x: 66,
    strokes: [
      { pts: [26, 62, 42, 63, 58, 71, 74, 85, 90, 99, 106, 106] },
      { pts: [36, 57, 52, 57] },
      { pts: arc(39, 60, 2, 0, TAU, 8) },
      { pts: arc(49, 60, 2, 0, TAU, 8) },
      ...stickCoon(44, 39, [38, 49, 44, 45, 50, 47]),
      { pts: [18, 42, 29, 42] },
      { pts: [16, 48, 28, 48] },
      { pts: [19, 54, 30, 54] },
      ...arrow(64, 80, 88, 97),
    ],
  },
  {
    from: 0.15,
    to: 0.178,
    tap: 0.183,
    label: 'HOOK',
    x: 164,
    strokes: [
      ...arrow(104, 34, 118, 34),
      { pts: [160, 36, 198, 36, 198, 74, 160, 74, 160, 36] },
      { pts: [179, 36, 179, 74] },
      { pts: [160, 55, 198, 55] },
      { pts: [138, 77, 204, 77] },
      { pts: arc(150, 76, 7, Math.PI, TAU, 10) },
      { pts: [146, 72, 148, 75] },
      { pts: [153, 72, 155, 75] },
      ...stickCoon(124, 90, [120, 98, 124, 94, 130, 93]),
      { pts: [130, 94, 138, 50] },
      { pts: [138, 50, 143, 44, 148, 46, 151, 54, 151, 62] },
      { pts: [151, 62, 151, 65, 149, 66, 148, 64] },
    ],
  },
  {
    from: 0.186,
    to: 0.212,
    tap: 0.217,
    label: 'GLIDE',
    x: 264,
    strokes: [
      ...arrow(204, 34, 218, 34),
      { pts: [222, 96, 246, 70, 270, 96] },
      { pts: [226, 94, 226, 114, 266, 114, 266, 94] },
      { pts: [250, 66, 254, 63] },
      { pts: [259, 60, 263, 58] },
      { pts: [268, 56, 272, 55] },
      { pts: arc(288, 50, 12, Math.PI, TAU, 10) },
      { pts: [276, 50, 300, 50] },
      { pts: [288, 50, 288, 64] },
      ...stickCoon(288, 74, [284, 84, 288, 80, 288, 64]),
      { pts: arc(296, 85, 3, Math.PI, TAU, 6) },
      { pts: [300, 90, 304, 94] },
      { pts: [296, 96, 300, 101] },
    ],
  },
];
const MARK: readonly Stroke[] = [
  { pts: [140, 63, 160, 83], color: ACCENT, width: 2.2 },
  { pts: [160, 63, 140, 83], color: ACCENT, width: 2.2 },
];
const MARK_AT = [0.224, 0.232] as const;
const lengthOf = (pts: readonly number[]) => {
  let total = 0;
  for (let i = 2; i < pts.length; i += 2)
    total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return total;
};
/** Draws the first `t` of a chalk line, with a little dust and a bright tip while drawing. */
function chalk(ctx: Ctx, s: Stroke, t: number) {
  if (t <= 0) return;
  const { pts } = s,
    color = s.color ?? CHALK,
    width = s.width ?? 1.2;
  let left = lengthOf(pts) * clamp(t);
  const out = [pts[0], pts[1]];
  for (let i = 2; i < pts.length && left > 0; i += 2) {
    const seg = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    const k = Math.min(1, left / seg);
    out.push(lerp(pts[i - 2], pts[i], k), lerp(pts[i - 1], pts[i + 1], k));
    left -= seg;
  }
  line(ctx, alpha(color, 0.28), width + 1.2, out);
  line(ctx, alpha(color, 0.92), width, out);
  if (t < 1) disc(ctx, out[out.length - 2], out[out.length - 1], 1.4, '#FFFFFF');
}
/** Strokes share their step's window in proportion to their length, one after another. */
function drawStrokes(ctx: Ctx, p: number, strokes: readonly Stroke[], from: number, to: number) {
  const lengths = strokes.map((s) => Math.max(8, lengthOf(s.pts)));
  const total = lengths.reduce((a, b) => a + b, 0);
  let at = from;
  strokes.forEach((s, i) => {
    const dur = ((to - from) * lengths[i]) / total;
    chalk(ctx, s, span(p, at, at + dur));
    at += dur;
  });
}
/** Chalk lettering that writes itself one character at a time. */
function chalkText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  t: number,
  size: number,
  color = CHALK,
) {
  const shown = text.slice(0, Math.ceil(text.length * clamp(t)));
  if (!shown) return;
  ctx.save();
  ctx.font = `bold ${size}px "Space Mono", monospace`;
  const full = ctx.measureText(text).width;
  ctx.restore();
  write(ctx, shown, x - full / 2, y, { size, color: alpha(color, 0.92), align: 'left' });
}

function blueprint(ctx: Ctx, p: number, seconds: number) {
  camera(ctx, track(p, PLAN_CAMERA), () => {
    // A garden-shed wall lit by one bulb, and the plan pinned up on it.
    box(ctx, 0, 0, W, H, '#3A2A22');
    for (let x = 6; x < W; x += 22) box(ctx, x, 0, 1, H, '#2C1F19');
    glow(ctx, 160, -10, 230, '#FFCB7A', 0.2);
    box(ctx, 13, 9, 300, 150, alpha('#000000', 0.35));
    box(ctx, 10, 6, 300, 150, PAPER);
    for (let x = 16; x < 310; x += 12) box(ctx, x, 6, 1, 150, GRID);
    for (let y = 12; y < 156; y += 12) box(ctx, 10, y, 300, 1, GRID);
    box(ctx, 10, 6, 300, 1, '#3A5E98');
    for (const [px, py] of [
      [15, 11],
      [305, 11],
      [15, 151],
      [305, 151],
    ])
      disc(ctx, px, py, 2.2, ACCENT);
    chalkText(ctx, 'THE PLAN', 160, 27, span(p, 0.101, 0.111), 12);
    chalk(ctx, { pts: [118, 31, 202, 31] }, span(p, 0.109, 0.114));
    STEPS.forEach((step, i) => {
      drawStrokes(ctx, p, step.strokes, step.from, step.to - 0.008);
      // The step's number in a chalk ring, then its name, written last.
      const nx = step.x - 26,
        ny = LABEL_Y - 3;
      chalk(ctx, { pts: arc(nx, ny, 6.5) }, span(p, step.to - 0.009, step.to - 0.005));
      chalkText(ctx, String(i + 1), nx, ny + 3.5, span(p, step.to - 0.006, step.to - 0.005), 9);
      chalkText(ctx, step.label, step.x + 4, LABEL_Y, span(p, step.to - 0.005, step.to), 9);
      // The tapped label glows for a moment.
      const lit = hump(p, step.tap - 0.002, step.tap + 0.01);
      if (lit > 0) glow(ctx, step.x, LABEL_Y - 3, 26, '#FFFFFF', lit * 0.35);
    });
    drawStrokes(ctx, p, MARK, MARK_AT[0], MARK_AT[1]);
    if (p > MARK_AT[1]) glow(ctx, 150, 73, 26, ACCENT, 0.3 * hump(p, MARK_AT[1], 0.25));
    planner(ctx, p, seconds);
  });
  vignette(ctx, 0.55);
}
// Rocco walks from panel to panel and taps each label with a pointer as its step finishes.
const PLANNER_STOPS = [
  [0.1, 350],
  [0.116, 108],
  [0.149, 108],
  [0.158, 206],
  [0.185, 206],
  [0.194, 302],
  [0.219, 302],
  [0.229, 184],
] as const;
function planner(ctx: Ctx, p: number, seconds: number) {
  let x: number = PLANNER_STOPS[0][1],
    moving = false,
    facing: 1 | -1 = -1;
  for (let i = 0; i < PLANNER_STOPS.length - 1; i++) {
    const [a, ax] = PLANNER_STOPS[i],
      [b, bx] = PLANNER_STOPS[i + 1];
    if (p >= a && p < b) {
      x = lerp(ax, bx, ease(span(p, a, b)));
      moving = ax !== bx;
      facing = bx > ax ? 1 : -1;
    } else if (p >= b) x = bx;
  }
  const gloat = span(p, 0.236, 0.242);
  if (!moving && gloat > 0) facing = 1;
  let point = 0,
    target = { x: 0, y: 0, t: 0 };
  for (const step of STEPS) {
    const k = hump(p, step.tap - 0.011, step.tap + 0.008);
    if (k > point) {
      point = k;
      target = { x: step.x - 4 * facing, y: LABEL_Y - 4, t: step.tap };
    }
  }
  const y = 194;
  const r: Raccoon = {
    size: 1.55,
    facing,
    t: seconds,
    step: moving ? seconds * 13 : undefined,
    arms: gloat > 0 ? [1.35, 1.25] : [0.35, lerp(0.55, 2.3, ease(point * 1.6))],
    eyes: gloat > 0 ? 'narrow' : point > 0.5 ? 'open' : 'narrow',
    mouth: gloat > 0 ? 'grin' : point > 0.5 ? 'smile' : 'smirk',
    look: gloat > 0 ? [0.6, 0.2] : [0.5, -0.9],
  };
  rocco(ctx, x, y, r);
  const paw = pawOf(x, y, r);
  // The pointer: resting down by his side, or lifted to touch the label.
  const rest = { x: paw.x + facing * 6, y: paw.y + 24 };
  const touch = 1 - hump(p, target.t - 0.003, target.t + 0.003);
  const aim = { x: target.x, y: target.y + touch * 3 };
  const k = ease(point * 1.6);
  const tip =
    gloat > 0
      ? { x: paw.x + 12, y: paw.y - 22 }
      : { x: lerp(rest.x, aim.x, k), y: lerp(rest.y, aim.y, k) };
  line(ctx, '#C9A36A', 1.6, [paw.x, paw.y, tip.x, tip.y]);
  disc(ctx, tip.x, tip.y, 1.3, '#F4EAD6');
  if (gloat > 0) {
    // Paws together: the villain's steeple.
    oval(ctx, paw.x - 2, paw.y + 1, 3, 2.4, PAW);
  }
}
const PLAN_CAMERA = [
  [0.1, 160, 90, 1],
  [0.112, 160, 90, 1],
  [0.127, 80, 90, 1.15],
  [0.148, 84, 90, 1.18],
  [0.163, 166, 90, 1.15],
  [0.184, 168, 90, 1.18],
  [0.199, 240, 90, 1.15],
  [0.219, 244, 90, 1.18],
  [0.227, 152, 72, 2.3],
  [0.235, 152, 73, 2.5],
  [0.242, 176, 140, 1.9],
  [0.25, 178, 140, 2],
] as const;

// ——— The garden: hill, hedge, flower bed, rain barrel, and Grandma's cottage ———
const WORLD_W = 660;
const GROUND = 148;
const HILL = 300;
/** Ground height along the garden: a smooth hill down to the flat lawn by the cottage. */
const groundY = (x: number) => (x >= HILL ? GROUND : GROUND - 62 * (1 - ease(x / HILL)));
const slopeAt = (x: number) => Math.atan2(groundY(x + 2) - groundY(x - 2), 4);
const HOUSE = { left: 446, right: 640, eaves: 54, ridge: 16 } as const;
const WINDOW = { x: 534, y: 60, w: 58, h: 46 } as const;
const SILL = WINDOW.y + WINDOW.h;
const PIE_X = 560;
const DOOR = { x: 482, w: 26, top: 92 } as const;
const BARREL = { x: 444, w: 24, top: 116 } as const;
const PIPE_X = 455;
const HEDGE = { x0: 320, x1: 398, top: 112 } as const;
const BED = { x0: 402, x1: 442 } as const;
const HOOK = { x: 527, y: 55 } as const;
const HOME = { x: 500, y: 144 } as const;
const HORIZON = 118;

const SKIES = [
  ['#E4A07C', '#F0B686', '#F6CA92', '#FADDA8'],
  ['#A96A8E', '#D9807A', '#EE9E6E', '#F7C27E'],
  ['#3C3C78', '#7A5689', '#D2726E', '#F2A86C'],
] as const;
function skyAt(d: number) {
  const k = clamp(d) * 2,
    i = Math.min(1, Math.floor(k));
  return SKIES[0].map((_, band) => mix(SKIES[i][band], SKIES[i + 1][band], k - i));
}
/** The sun sets as the film goes on: golden hour, sunset, then dusk over the bench. */
const duskAt = (p: number) => clamp(p < 0.62 ? p * 0.8 : 0.496 + (p - 0.62) * 1.33);

/** Sky, sun, clouds, and far hills in screen space, sliding slower than the garden. */
function backdrop(ctx: Ctx, view: View, d: number, seconds: number) {
  const bands = skyAt(d);
  const hy = H / 2 + (HORIZON - view.y) * view.zoom * 0.3 + 6;
  box(ctx, 0, 0, W, H, bands[0]);
  sky(ctx, bands, hy - 150, hy + 8);
  box(ctx, 0, hy + 8, W, H, bands[3]);
  const drift = (view.x - 440) * view.zoom * 0.08;
  const sx = 70 - drift,
    sy = hy - 46 + d * 52;
  glow(ctx, sx, sy, 140, '#FFD89A', 0.55 - d * 0.2);
  disc(ctx, sx, sy, 12, mix('#FFF3CF', '#FFBF78', d));
  for (let i = 0; i < 5; i++) {
    const cx = ((((i * 91 - drift * 1.5 + seconds * 1.2) % 440) + 440) % 440) - 60;
    const cy = hy - 112 + (i % 3) * 17;
    oval(ctx, cx, cy, 24 + (i % 2) * 10, 3.5, alpha(mix('#FFE6C4', '#E58A8A', d), 0.75));
    oval(ctx, cx + 8, cy - 2.5, 13, 3, alpha(mix('#FFF3E0', '#F2A6A0', d), 0.7));
  }
  const far = mix('#C3A9B0', '#6A5480', d),
    near = mix('#8C9E6A', '#4A4760', d);
  for (let i = 0; i < 9; i++) {
    const x = ((((i * 52 - drift * 2.2) % 468) + 468) % 468) - 74;
    oval(ctx, x, hy + 5, 46, 13 + (i % 3) * 3, far);
  }
  for (let i = 0; i < 12; i++) {
    const x = ((((i * 37 - drift * 4) % 444) + 444) % 444) - 62;
    oval(ctx, x, hy + 13, 22, 9 + (i % 4) * 2, near);
  }
}

function cottage(ctx: Ctx, p: number, seconds: number, d: number) {
  const { left, right, eaves, ridge } = HOUSE;
  const wall = mix('#F0DDBA', '#B99C90', d * 0.8),
    roof = mix('#B85C42', '#7A4450', d * 0.7),
    roofDark = mix('#8E4232', '#58303E', d * 0.7);
  // Chimney and its lazy smoke.
  box(ctx, 590, -6, 16, 36, mix('#A05C48', '#6E4A48', d));
  box(ctx, 587, -8, 22, 4, mix('#7E4638', '#50363A', d));
  for (let i = 0; i < 4; i++) {
    const ph = (seconds * 0.22 + i / 4) % 1;
    disc(
      ctx,
      598 + ph * 16 + Math.sin(seconds + i) * 2,
      -10 - ph * 34,
      2.5 + ph * 5,
      alpha('#F4ECE4', 0.35 * (1 - ph)),
    );
  }
  poly(ctx, roof, [left - 12, eaves, left + 30, ridge, right - 30, ridge, right + 12, eaves]);
  for (let y = ridge + 6, row = 0; y < eaves; y += 6, row++) {
    const inset = ((eaves - y) / (eaves - ridge)) * 42;
    box(ctx, left - 12 + inset, y, right - left + 24 - inset * 2, 1, roofDark);
    for (let x = left - 6 + inset + (row % 2) * 5; x < right + 6 - inset; x += 10)
      box(ctx, x, y + 1, 1, 5, roofDark);
  }
  box(ctx, left + 30, ridge - 2, right - left - 60, 3, roofDark);
  // Walls, footing, and the soft shadow under the eaves.
  box(ctx, left, eaves, right - left, GROUND - eaves, wall);
  box(ctx, left, eaves + 3, right - left, 4, alpha('#5A3A30', 0.18));
  box(ctx, left, GROUND - 9, right - left, 9, mix('#B6A896', '#7E7684', d));
  for (let x = left + 4, k = 0; x < right - 6; x += 13, k++)
    box(ctx, x, GROUND - 9 + (k % 2) * 4, 10, 1, mix('#9A8C7C', '#6A6270', d));
  // Climbing rose by the window.
  for (let k = 0; k < 9; k++) {
    const rx = 606 + (k % 3) * 9 + Math.sin(k * 2.1) * 3,
      ry = 70 + k * 8;
    oval(ctx, rx, ry, 6, 4, mix('#5C8A44', '#34483C', d));
    if (k % 2 === 0) disc(ctx, rx + 2, ry - 1, 1.6, mix('#E0607A', '#9A4A64', d));
  }
  // Gutter, drainpipe, back door and step.
  box(ctx, left - 12, eaves, right - left + 24, 3, GUTTER);
  box(ctx, left - 12, eaves + 3, right - left + 24, 1, '#5E626C');
  box(ctx, PIPE_X - 2, eaves + 3, 4, BARREL.top - eaves - 2, GUTTER);
  box(ctx, PIPE_X - 2, eaves + 3, 1, BARREL.top - eaves - 2, '#A9ADB6');
  for (const by of [74, 96]) box(ctx, PIPE_X - 3, by, 6, 2, '#6A6E78');
  const door = mix('#4E7A5C', '#3A4E4A', d);
  box(ctx, DOOR.x - 2, DOOR.top - 2, DOOR.w + 4, GROUND - DOOR.top + 2, TRIM);
  box(ctx, DOOR.x, DOOR.top, DOOR.w, GROUND - DOOR.top, door);
  for (const [dx, dy] of [
    [4, 6],
    [15, 6],
    [4, 30],
    [15, 30],
  ])
    box(ctx, DOOR.x + dx, DOOR.top + dy, 7, 19, mix(door, '#1C2420', 0.25));
  disc(ctx, DOOR.x + 22, DOOR.top + 29, 1.4, '#E2B85A');
  box(ctx, 476, GROUND - 4, 38, 4, '#B3A898');
  box(ctx, 476, GROUND - 4, 38, 1, '#D2C9BB');
  kitchenWindow(ctx, p, seconds, d);
}

function kitchenWindow(ctx: Ctx, p: number, seconds: number, d: number) {
  const { x, y, w, h } = WINDOW;
  box(ctx, x - 3, y - 3, w + 6, h + 3, TRIM);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // A warm kitchen: shelf of jars, a copper pan, a lamp.
  box(ctx, x, y, w, h, mix('#7A4E3A', '#5E3A30', d));
  box(ctx, x, y + h - 12, w, 12, '#4E3028');
  box(ctx, x + 8, y + 14, 22, 2, '#3A2420');
  box(ctx, x + 10, y + 8, 4, 6, '#D9A74A');
  box(ctx, x + 16, y + 9, 4, 5, '#C0503C');
  box(ctx, x + 22, y + 7, 4, 7, '#7FA36A');
  disc(ctx, x + 40, y + 22, 4, '#C7773F');
  line(ctx, '#3A2420', 1, [x + 40, y + 18, x + 40, y + 12]);
  glow(ctx, x + w - 12, y + 6, 36, '#FFD08A', 0.35 + d * 0.3);
  for (const cx of [x, x + w - 7]) {
    box(ctx, cx, y, 7, h, '#D9605A');
    for (let k = 0; k < h; k += 4)
      box(ctx, cx + ((k / 4) % 2) * 3 + 1, y + k, 2, 2, alpha('#FFFFFF', 0.45));
  }
  roseInWindow(ctx, p, seconds);
  ctx.restore();
  // Two casements that fold open like shutters.
  const open = ease(span(p, T.window, T.window + 0.008));
  const glass = alpha(mix('#CFE3EA', '#E8B9A0', d), 0.42);
  const pane = (px: number, pw: number) => {
    if (pw < 1) return;
    if (pw <= 6) {
      box(ctx, px, y, pw, h, TRIM);
      return;
    }
    box(ctx, px + 2, y + 2, pw - 4, h - 4, glass);
    for (const [bx, by, bw, bh] of [
      [px, y, pw, 2],
      [px, y + h - 2, pw, 2],
      [px, y, 2, h],
      [px + pw - 2, y, 2, h],
      [px + 2, y + h / 2 - 1, pw - 4, 2],
    ])
      box(ctx, bx, by, bw, bh, TRIM);
    poly(ctx, alpha('#FFFFFF', 0.3), [
      px + 3,
      y + h - 6,
      px + Math.min(pw - 3, 10),
      y + 4,
      px + Math.min(pw - 3, 13),
      y + 4,
      px + 5,
      y + h - 6,
    ]);
  };
  const half = w / 2;
  if (open < 0.5) {
    pane(x, half * (1 - open * 2));
    const rw = half * (1 - open * 2);
    pane(x + w - rw, rw);
  } else {
    const fw = half * (open - 0.5) * 2 * 0.5;
    pane(x - 3 - fw, fw);
    pane(x + w + 3, fw);
  }
  box(ctx, x - 7, SILL, w + 14, 4, TRIM);
  box(ctx, x - 6, SILL + 4, w + 12, 2, alpha('#5A3A30', 0.2));
}

function hedge(ctx: Ctx, d: number) {
  const dark = mix('#3F6B34', '#26382F', d),
    mid = mix('#557F3E', '#32463A', d),
    light = mix('#86AA52', '#4E5E48', d);
  const { x0, x1, top } = HEDGE;
  box(ctx, x0, top + 6, x1 - x0, GROUND - top - 6, mid);
  for (let x = x0 + 5; x < x1; x += 9) disc(ctx, x, top + 7 + ((x * 7) % 3), 7, mid);
  for (let i = 0; i < 26; i++)
    box(ctx, x0 + 2 + rand(i + 3) * (x1 - x0 - 4), top + 2 + rand(i + 40) * 30, 2, 1, light);
  for (let i = 0; i < 12; i++)
    box(ctx, x0 + 2 + rand(i + 90) * (x1 - x0 - 4), top + 10 + rand(i + 60) * 26, 2, 2, dark);
  box(ctx, x0, GROUND - 3, x1 - x0, 3, dark);
}
function barrel(ctx: Ctx, d: number) {
  const { x, w, top } = BARREL;
  const wood = mix('#8C5B38', '#5E4540', d);
  box(ctx, x, top, w, GROUND - top, wood);
  for (let k = 1; k < 6; k++)
    box(ctx, x + k * 4, top + 1, 1, GROUND - top - 1, mix(wood, '#1C1410', 0.3));
  box(ctx, x + 2, top + 2, 2, GROUND - top - 4, alpha('#FFFFFF', 0.14));
  for (const hy of [top + 3, top + 15, GROUND - 5]) box(ctx, x - 1, hy, w + 2, 2, '#4A4450');
}
/** The barrel's open top sits behind anyone hiding behind it. */
const barrelRim = (ctx: Ctx) =>
  oval(ctx, BARREL.x + BARREL.w / 2, BARREL.top, BARREL.w / 2, 2.5, '#3A2A24');
/** The flower bed, in two layers so Rocco can land in it rather than on it. */
function flowerBed(ctx: Ctx, p: number, seconds: number, d: number, layer: 0 | 1) {
  const { x0, x1 } = BED;
  if (layer === 0) {
    box(ctx, x0, GROUND - 8, x1 - x0, 8, mix('#7A5236', '#4E3A34', d));
    box(ctx, x0 + 1, GROUND - 9, x1 - x0 - 2, 2, '#5A3E2E');
  }
  const flat = p > T.land;
  for (let i = layer; i < 14; i += 2) {
    const fx = x0 + 3 + i * 2.6;
    const near = flat && Math.abs(fx - 424) < 11;
    const sway = Math.sin(seconds * 1.4 + i) * 0.8 + (near ? (fx < 424 ? -6 : 6) : 0);
    const h = near ? 4 : 8 + ((i * 5) % 7);
    const top = GROUND - 9 - h;
    line(ctx, mix('#5E9A48', '#3E5A40', d), 1, [fx, GROUND - 9, fx + sway, top]);
    const kind = i % 3;
    if (kind === 0) {
      for (let k = 0; k < 5; k++)
        disc(ctx, fx + sway + Math.cos(k * 1.26) * 1.8, top + Math.sin(k * 1.26) * 1.8, 1.1, WHITE);
      disc(ctx, fx + sway, top, 0.9, '#F2C230');
    } else if (kind === 1) {
      oval(ctx, fx + sway, top, 1.8, 2.4, mix('#E0485A', '#9A3A50', d));
      box(ctx, fx + sway - 0.5, top - 2.4, 1, 1, mix('#E0485A', '#9A3A50', d));
    } else
      for (let k = 0; k < 3; k++)
        disc(ctx, fx + sway, top + k * 1.6, 1, mix('#9C7BD0', '#6A5890', d));
  }
}
function hose(ctx: Ctx, p: number) {
  const hit = hump(p, T.hose, T.hose + 0.008);
  disc(ctx, 286, GROUND - 8, 7, '#2E6A3A');
  disc(ctx, 286, GROUND - 8, 5, '#3E8A4A');
  disc(ctx, 286, GROUND - 8, 1.6, '#C9C4B0');
  line(ctx, '#6A6E78', 1.2, [279, GROUND, 286, GROUND - 8, 293, GROUND]);
  line(ctx, '#3E8A4A', 2.2, [
    290,
    GROUND - 1,
    298,
    GROUND - 1,
    306,
    GROUND - 2.8 - hit * 3,
    314,
    GROUND - 1,
    322,
    GROUND - 1,
  ]);
}
function lawn(ctx: Ctx, d: number) {
  const grass = mix('#93AC4E', '#57694A', d),
    deep = mix('#7A9640', '#46563E', d),
    path = mix('#E0BE80', '#9C806C', d);
  const pts: number[] = [0, 180];
  for (let x = 0; x <= WORLD_W; x += 12) pts.push(x, groundY(x));
  pts.push(WORLD_W, 180);
  poly(ctx, grass, pts);
  const edge: number[] = [];
  for (let x = 0; x <= 318; x += 10) edge.push(x, groundY(x) + 2);
  line(ctx, path, 3.4, edge);
  box(ctx, 0, GROUND + 14, WORLD_W, 20, deep);
  for (let i = 0; i < 40; i++) {
    const gx = rand(i + 7) * WORLD_W;
    box(ctx, gx, Math.max(groundY(gx) + 5, GROUND + 4 + rand(i + 21) * 26), 1, 2, deep);
  }
  // A fence along the top of the hill, and the garden gate.
  const post = mix('#EADBC2', '#9C8E90', d);
  for (let x = 6; x < 170; x += 15) box(ctx, x, groundY(x) - 17, 3, 17, post);
  const rail: number[] = [];
  for (let x = 6; x < 170; x += 15) rail.push(x + 1, groundY(x) - 13);
  line(ctx, post, 1.4, rail);
  line(
    ctx,
    post,
    1.4,
    rail.map((v, i) => (i % 2 ? v + 7 : v)),
  );
}

/** Everyone in the garden, placed by story time. `layer` 0 sits behind the hedge and barrel. */
function gardenCast(ctx: Ctx, p: number, seconds: number, layer: 0 | 1) {
  const base: Raccoon = { size: 1.1, t: seconds };
  // Opening: the eyes in the hedge, then the masked face rises over it.
  if (p < PLAN_AT && layer === 0 && p >= T.rise) {
    const up = backOut(span(p, T.rise, T.rise + 0.012));
    const y = lerp(164, 134, up);
    rocco(ctx, 358, y, {
      ...base,
      eyes: 'narrow',
      mouth: p > 0.086 ? 'grin' : 'smirk',
      look: [1, -0.2],
      arms: [2.2, 2.3],
    });
  }
  // Step one: the skate.
  if (within(p, SKATE_AT, T.hose)) {
    const x = skateX(p),
      y = groundY(x),
      tilt = slopeAt(x);
    const going = span(p, T.push, T.hose);
    const rock = p < T.push ? Math.sin(seconds * 7) * 1.5 : 0;
    skate(ctx, x + rock, y, tilt, going * 90);
    ctx.save();
    ctx.translate(x + rock, y);
    ctx.rotate(tilt);
    const scared = going > 0.55;
    rocco(ctx, 0, -6, {
      ...base,
      legs: 'crouch',
      arms: p < T.push ? [0.5, 1.3] : [-1.1, -0.7],
      eyes: scared ? 'wide' : 'narrow',
      mouth: scared ? 'open' : 'grin',
      look: [1, 0.3],
    });
    ctx.restore();
    if (going > 0.15)
      for (let k = 0; k < 4; k++) {
        const ly = y - 8 - k * 7;
        line(ctx, alpha('#FFFFFF', 0.6 * going), 1, [
          x - 18 - k * 4,
          ly,
          x - 30 - going * 26 - k * 4,
          ly - Math.tan(tilt) * 10,
        ]);
      }
  }
  if (layer === 1 && within(p, SKATE_AT, 0.337)) hose(ctx, p);
  if (layer === 1 && within(p, T.hose, 0.337)) {
    // The skate stops dead at the hose and rolls back; he keeps going.
    const back = easeOut(span(p, T.hose, T.hose + 0.012));
    skate(
      ctx,
      304 - back * 12,
      GROUND - hump(p, T.hose, T.hose + 0.008) * 5,
      back * 0.3,
      seconds * 12,
    );
  }
  if (layer === 1 && within(p, T.hose, T.land)) {
    const t = span(p, T.hose, T.land);
    rocco(ctx, lerp(306, 424, t), lerp(146, 141, t) - 78 * 4 * t * (1 - t), {
      ...base,
      spin: t * TAU * 1.5,
      legs: 'splay',
      step: seconds * 20,
      arms: [2.5, 2.9],
      eyes: 'wide',
      mouth: 'open',
    });
  }
  if (layer === 0 && within(p, T.land, 0.337))
    rocco(ctx, 424, 141, {
      ...base,
      spin: Math.PI,
      legs: 'splay',
      step: seconds * 26,
      arms: [2, 2.4],
    });
  if (layer === 0 && within(p, 0.337, 0.37)) {
    const dazed = p < 0.355;
    const pop = backOut(span(p, 0.337, 0.342));
    const r: Raccoon = {
      ...base,
      legs: 'sit',
      eyes: dazed ? 'dizzy' : 'narrow',
      mouth: dazed ? 'o' : 'flat',
      look: [-0.7, 0.4],
      daisy: p >= T.daisy,
      arms: dazed ? [0.9, 1.1] : [0.5, 0.3],
    };
    rocco(ctx, 422, 150 + (1 - pop) * 10, r);
    if (p < T.daisy) {
      // The daisy he flattened drifts down and settles on his beanie.
      const k = span(p, 0.338, T.daisy);
      daisy(ctx, 426 + Math.sin(k * 9) * 5, lerp(98, 107, k), Math.sin(k * 7) * 0.8);
    }
    if (dazed)
      for (let k = 0; k < 3; k++) {
        const a = seconds * 5 + (k * TAU) / 3;
        const sx = 425 + Math.cos(a) * 11,
          sy = 105 + Math.sin(a) * 3;
        box(ctx, sx - 1.5, sy, 4, 1, '#FFE27A');
        box(ctx, sx, sy - 1.5, 1, 4, '#FFE27A');
      }
    for (let k = 0; k < 5; k++) {
      const f = (span(p, 0.337, 0.365) + k * 0.13) % 1;
      if (p < 0.365)
        box(
          ctx,
          410 + k * 7 + Math.sin(f * 8 + k) * 3,
          96 + f * 48,
          1.4,
          1,
          k % 2 ? WHITE : '#F29AB0',
        );
    }
  }
  // Step two: the rod, the cat, the cloud.
  if (within(p, 0.37, T.launch)) {
    if (layer === 0) angler(ctx, p, seconds);
  }
  if (layer === 1) cat(ctx, p, seconds);
  if (layer === 1 && within(p, T.launch, 0.49)) pounced(ctx, p, seconds);
  // Step three: up the drainpipe, onto the ridge, and off it.
  if (layer === 1 && within(p, 0.49, T.ridge)) {
    const k = span(p, 0.49, T.ridge);
    const y = lerp(118, 66, ease(k));
    const phase = k * 20;
    brolly(ctx, 446, y - 14, 0, 0, -0.55);
    rocco(ctx, 452, y, {
      ...base,
      legs: 'climb',
      step: phase,
      arms: [2.7 + Math.sin(phase) * 0.3, 2.95 - Math.sin(phase) * 0.3],
      eyes: 'narrow',
      mouth: 'flat',
      look: [0.2, -1],
      bruised: true,
      daisy: true,
    });
  }
  if (layer === 1 && within(p, T.ridge, T.snag)) umbrellaRide(ctx, p, seconds);
  if (layer === 1 && p >= T.snag) dangle(ctx, p, seconds);
}
const skateX = (p: number) => 44 + 262 * span(p, T.push, T.hose) ** 1.7;
const TAIL_LIFT = (p: number) => REEL_TICKS.filter((t) => p >= t).length * 1.6;

function angler(ctx: Ctx, p: number, seconds: number) {
  const rise = ease(span(p, 0.376, 0.381));
  const x = 452,
    y = GROUND - rise * 6;
  const wind = span(p, 0.38, T.cast),
    cast = span(p, T.cast, T.cast + 0.004);
  const rod = lerp(lerp(1, 2.3, ease(wind)), 0.62, easeOut(cast));
  const bite = p > T.hook + 0.002;
  const r: Raccoon = {
    size: 1.1,
    t: seconds,
    daisy: true,
    legs: rise > 0 ? 'stand' : 'crouch',
    arms: [1.3, 1.5],
    eyes: bite ? 'happy' : 'narrow',
    mouth: bite ? 'grin' : 'smirk',
    look: [0.9, -0.5],
  };
  rocco(ctx, x, y, r);
  const hand = pawOf(x, y, r);
  const tip = { x: hand.x + Math.cos(rod) * 30, y: hand.y - Math.sin(rod) * 30 };
  line(ctx, '#8A5A36', 1.3, [hand.x, hand.y, tip.x, tip.y]);
  disc(ctx, hand.x + Math.cos(rod) * 4, hand.y - Math.sin(rod) * 4, 1.6, '#4A4450');
  fishingLine(ctx, p, tip);
}
/** The line and hook, from the rod tip: dangling, flying, then fast in Miso's tail. */
function fishingLine(ctx: Ctx, p: number, tip: { x: number; y: number }) {
  const target = tailTip(HOME.x, HOME.y, TAIL_LIFT(p));
  let hx = tip.x,
    hy = tip.y + 5;
  const fly = span(p, T.cast + 0.002, T.hook);
  if (fly > 0) {
    hx = lerp(tip.x, target.x, fly);
    hy = lerp(tip.y, target.y, fly) - 40 * 4 * fly * (1 - fly);
  }
  const sag = fly >= 1 ? 0 : 8;
  ctx.strokeStyle = alpha('#F4F0E8', 0.85);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.quadraticCurveTo((tip.x + hx) / 2, Math.max(tip.y, hy) + sag, hx, hy);
  ctx.stroke();
  line(ctx, '#C9CDD6', 0.8, [hx, hy, hx, hy + 2.5, hx - 1.4, hy + 3.2, hx - 2, hy + 2]);
}
function cat(ctx: Ctx, p: number, seconds: number) {
  if (p < T.launch) {
    const open = span(p, 0.412, 0.418);
    const pose = p < 0.412 ? 'nap' : 'alarm';
    const shiver = p > T.yowl ? Math.sin(seconds * 60) * 0.4 : 0;
    miso(ctx, HOME.x + shiver, HOME.y, pose, { size: 1, t: seconds, lift: TAIL_LIFT(p), open });
    if (p < 0.412)
      for (let k = 0; k < 2; k++) {
        const z = (seconds * 0.4 + k * 0.5) % 1;
        write(ctx, 'z', HOME.x + 14 + z * 8, HOME.y - 16 - z * 12, {
          size: 5 + z * 3,
          color: alpha('#FFFFFF', 0.7 * (1 - z)),
        });
      }
    if (p > T.yowl) {
      // YOWL: a burst of lines around her head.
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI * 0.9 + k * 0.3;
        line(ctx, alpha('#FFFFFF', 0.8), 1, [
          HOME.x + 11 + Math.cos(a) * 10,
          HOME.y - 9 + Math.sin(a) * 10,
          HOME.x + 11 + Math.cos(a) * 15,
          HOME.y - 9 + Math.sin(a) * 15,
        ]);
      }
    }
    return;
  }
  if (p < T.pounce) {
    // Straight up like a rocket, a cartoon hang at the top, then down onto Rocco.
    const up = easeOut(span(p, T.launch, 0.437)),
      down = easeIn(span(p, 0.443, T.pounce));
    const hang = Math.sin(seconds * 9) * 0.8;
    if (p < 0.443) {
      const x = lerp(HOME.x, 468, up),
        y = lerp(HOME.y, 64, up) + (p > 0.437 ? hang : 0);
      if (up < 0.9)
        for (let k = 0; k < 4; k++)
          line(ctx, alpha('#FFFFFF', 0.6 * (1 - up)), 1, [
            x - 6 + k * 4,
            y + 8,
            x - 6 + k * 4,
            y + 22,
          ]);
      miso(ctx, x, y, 'air', { t: seconds });
    } else miso(ctx, lerp(468, 434, down), lerp(64, 104, down), 'air', { facing: -1, t: seconds });
    return;
  }
  if (p < T.settle) return;
  if (p < 0.49) {
    miso(ctx, 436, 140, 'smug', { t: seconds });
    return;
  }
  miso(ctx, HOME.x, HOME.y, 'nap', { t: seconds });
}
function pounced(ctx: Ctx, p: number, seconds: number) {
  const x = 432;
  if (p < T.pounce) {
    // Reeling in with his eyes shut, then the line goes slack, then he looks up.
    const slack = p > 0.432;
    const up = p > 0.44;
    const r: Raccoon = {
      size: 1.1,
      t: seconds,
      daisy: true,
      arms: up ? [2.4, 2.2] : [1.3, 1.5],
      eyes: up ? 'wide' : p > 0.436 ? 'open' : 'happy',
      mouth: up ? 'o' : p > 0.436 ? 'flat' : 'grin',
      look: up ? [0.3, -1] : [0.9, 0.4],
    };
    shade(ctx, x, GROUND, 18 + span(p, 0.438, T.pounce) * 18, 0.3 + span(p, 0.438, T.pounce) * 0.2);
    rocco(ctx, x, GROUND, r);
    const hand = pawOf(x, GROUND, r);
    const rod = up ? 1.9 : 0.7;
    const tip = { x: hand.x + Math.cos(rod) * 30, y: hand.y - Math.sin(rod) * 30 };
    line(ctx, '#8A5A36', 1.3, [hand.x, hand.y, tip.x, tip.y]);
    if (!slack) line(ctx, alpha('#F4F0E8', 0.85), 0.6, [tip.x, tip.y, HOME.x - 21, HOME.y - 9]);
    else {
      const sway = Math.sin(seconds * 4) * 2;
      line(ctx, alpha('#F4F0E8', 0.85), 0.6, [tip.x, tip.y, tip.x + sway, tip.y + 14]);
      line(ctx, '#C9CDD6', 0.8, [
        tip.x + sway,
        tip.y + 14,
        tip.x + sway,
        tip.y + 16.5,
        tip.x + sway - 1.4,
        tip.y + 17.2,
      ]);
    }
    return;
  }
  if (p < T.settle + 0.006) {
    // The scuffle: a boiling cloud with bits of raccoon and cat flying out of it.
    const fade = 1 - ease(span(p, T.settle, T.settle + 0.006));
    const boil = Math.floor(seconds * 11);
    const cx = x,
      cy = 128;
    for (let i = 0; i < 6; i++) {
      const a = rand(boil * 7 + i) * TAU;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * 14, cy + Math.sin(a) * 9);
      ctx.rotate(a);
      const racoonBit = i % 2 === 0;
      box(ctx, 0, -1.5, 10, 3, racoonBit ? FUR : ORANGE);
      if (i === 4) for (let k = 0; k < 3; k++) box(ctx, 3 + k * 3, -2, 1.5, 4, TAIL_DARK);
      else disc(ctx, 10, 0, 2.2, racoonBit ? PAW : CREAM);
      ctx.restore();
    }
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7 + rand(boil + i * 3) * 0.4;
      disc(
        ctx,
        cx + Math.cos(a) * 13 + (rand(boil * 3 + i) - 0.5) * 3,
        cy + Math.sin(a) * 8 + (rand(boil * 5 + i) - 0.5) * 3,
        9 + (i % 3) * 2,
        alpha('#EADFC8', 0.97 * fade),
      );
    }
    for (let i = 0; i < 4; i++)
      disc(ctx, cx - 10 + i * 7, cy - 4 + (i % 2) * 6, 3, alpha('#D6C8AE', 0.8 * fade));
    for (let k = 0; k < 3; k++) {
      const sx = cx - 14 + rand(boil + k * 9) * 28,
        sy = cy - 20 + rand(boil + k * 13) * 10;
      box(ctx, sx - 2, sy, 5, 1, alpha('#FFE27A', fade));
      box(ctx, sx, sy - 2, 1, 5, alpha('#FFE27A', fade));
    }
    // The beanie pops out of the top and drops back in.
    const hop = hump(p, 0.455, 0.468);
    if (hop > 0) {
      poly(ctx, BEANIE, [
        cx - 6,
        cy - 12 - hop * 26,
        cx - 4,
        cy - 17 - hop * 26,
        cx + 2,
        cy - 19 - hop * 26,
        cx + 7,
        cy - 17 - hop * 26,
        cx + 9,
        cy - 12 - hop * 26,
      ]);
    }
    if (fade < 1) {
      // Rocco, flat out; Miso on his tummy.
      rocco(ctx, x, 158, {
        size: 1.1,
        t: seconds,
        spin: -Math.PI / 2,
        legs: 'splay',
        arms: [2.2, 2.6],
        eyes: 'dizzy',
        mouth: 'o',
        bruised: true,
        daisy: true,
      });
    }
    return;
  }
  rocco(ctx, x, 158, {
    size: 1.1,
    t: seconds,
    spin: -Math.PI / 2,
    legs: 'splay',
    arms: [2.2, 2.6],
    eyes: p > 0.482 ? 'closed' : 'dizzy',
    mouth: p > 0.482 ? 'frown' : 'o',
    bruised: true,
    daisy: true,
  });
  // The broken rod.
  line(ctx, '#8A5A36', 1.3, [404, GROUND - 1, 418, GROUND - 3]);
  line(ctx, '#8A5A36', 1.3, [450, GROUND - 1, 462, GROUND - 5]);
}
const RIDGE = HOUSE.ridge;
function umbrellaRide(ctx: Ctx, p: number, seconds: number) {
  const base: Raccoon = { size: 1.1, t: seconds, bruised: true, daisy: true };
  // The umbrella is held up in the far paw, so its shaft passes behind his head.
  if (p < T.jump) {
    const opened = ease(span(p, T.open, T.open + 0.004));
    const proud = p > 0.512;
    const r: Raccoon = {
      ...base,
      arms: [-2.75, proud ? 1.7 : 0.6],
      eyes: proud ? 'happy' : 'narrow',
      mouth: proud ? 'grin' : 'smirk',
      look: [1, 0.3],
    };
    const hand = pawOf(522, RIDGE, r, 'back');
    brolly(ctx, hand.x, hand.y + 2, opened, 0, -0.1);
    rocco(ctx, 522, RIDGE, r);
    return;
  }
  const glide = span(p, T.jump, T.gust);
  const flip = ease(span(p, T.gust + 0.001, T.gust + 0.005));
  const drop = easeIn(span(p, T.gust + 0.004, T.snag));
  const x = 522 + 14 * easeOut(glide) + 2 * drop;
  const y = RIDGE + 22 * glide + Math.sin(seconds * 2.6) * 1.2 * (1 - flip) + drop * 32;
  const r: Raccoon = {
    ...base,
    legs: flip > 0 ? 'splay' : 'tuck',
    step: seconds * 22,
    arms: [-2.85, flip > 0 ? 2.7 : 0.7],
    eyes: flip > 0 ? 'wide' : 'happy',
    mouth: flip > 0 ? 'open' : 'smile',
    look: [0, -1],
  };
  const hand = pawOf(x, y, r, 'back');
  const letGo = span(p, T.gust + 0.008, T.snag + 0.02);
  if (letGo <= 0)
    brolly(ctx, hand.x, hand.y + 2, 1, flip, Math.sin(seconds * 2) * 0.05 - flip * 0.2);
  rocco(ctx, x, y, r);
  if (letGo > 0) brolly(ctx, hand.x + letGo * 60, hand.y + 3 + letGo * letGo * 90, 1, 1, letGo * 5);
}
function dangle(ctx: Ctx, p: number, seconds: number) {
  const dt = p - T.snag;
  const swing =
    0.7 * Math.exp(-dt / 0.011) * Math.cos(dt / 0.0032) + Math.sin(seconds * 1.3) * 0.012;
  const grin = within(p, 0.582, T.window);
  const caught = within(p, T.window, T.laugh);
  const sweat = within(p, 0.648, 0.668);
  let eyes: Eyes = 'closed',
    mouth: Mouth = 'frown',
    look: readonly [number, number] = [1, 0];
  if (p > 0.566) [eyes, mouth] = ['open', 'flat'];
  if (p > T.spot) [eyes, mouth] = ['wide', 'o'];
  if (grin) [eyes, mouth] = ['narrow', 'grin'];
  if (caught) [eyes, mouth, look] = ['wide', 'o', [1, -0.4]];
  if (p > T.laugh) [eyes, mouth, look] = ['open', 'flat', [1, -0.4]];
  if (p > T.burst + 0.006) [eyes, mouth] = ['open', 'smile'];
  if (p > T.exit) [eyes, mouth, look] = ['open', 'flat', [-0.8, 0.2]];
  if (p > T.back + 0.002) [eyes, mouth, look] = ['happy', 'grin', [1, 0]];
  const reach = ease(span(p, T.reach, T.reach + 0.01));
  const r: Raccoon = {
    size: 1.1,
    t: seconds,
    bruised: true,
    daisy: true,
    eyes,
    mouth,
    look,
    arms: [-1.25, lerp(1.2, 1.8, reach)],
    legs: 'stand',
  };
  hanging(ctx, HOOK.x, HOOK.y, swing, r);
  if (sweat) {
    const k = span(p, 0.648, 0.668);
    disc(ctx, HOOK.x + 12, HOOK.y + 46 + k * 10, 1.1, '#A6DCF4');
  }
}
/** Grandma behind the glass, in the window, laughing, gone, and back with the plates. */
function roseInWindow(ctx: Ctx, p: number, seconds: number) {
  if (p < 0.584) return;
  // She leans on the sill, so her eyes come down level with his.
  const x0 = 578,
    y0 = 158;
  if (p < T.window) {
    // A shadow crossing the kitchen toward the glass, unseen by the raccoon.
    const near = ease(span(p, 0.584, 0.604));
    rose(ctx, lerp(598, x0, near), lerp(130, y0, near), {
      size: lerp(1.5, 2.4, near),
      facing: -1,
      silhouette: '#140C10',
    });
    return;
  }
  let x = x0,
    facing: 1 | -1 = -1;
  const out = ease(span(p, T.exit, T.exit + 0.01)),
    back = ease(span(p, T.back, T.back + 0.008));
  if (p > T.exit) {
    x = lerp(x0, 620, out);
    facing = 1;
  }
  if (p > T.back) {
    x = lerp(620, x0, back);
    facing = -1;
  }
  const f: Rose = { size: 2.4, facing, eyes: 'wide', mouth: 'o', arms: [0.4, 0.6], lean: 0.12 };
  if (within(p, 0.66, 0.664)) f.eyes = 'closed';
  const giggle = span(p, T.laugh, T.burst);
  const roar = within(p, T.burst, T.exit);
  if (p > T.laugh) {
    f.shake = Math.sin(seconds * 32) * (roar ? 0.9 : 0.4 * giggle);
    f.mouth = giggle < 0.5 ? 'flat' : 'smile';
    f.eyes = giggle < 0.5 ? 'wide' : 'open';
  }
  if (roar) {
    f.eyes = 'happy';
    f.mouth = 'grin';
    f.lean = -0.12;
    f.arms = [0.7, 0.9];
  }
  if (within(p, T.wipe, T.wipe + 0.012)) {
    f.arms = [0.7, 2.75];
    f.tear = span(p, T.wipe, T.wipe + 0.01);
  }
  if (p > T.exit) {
    f.shake = 0;
    f.lean = 0;
    f.eyes = 'happy';
    f.mouth = 'smile';
    f.step = out < 1 ? seconds * 10 : undefined;
  }
  if (p > T.back) {
    f.arms = [0.8, 1.1];
    f.step = back < 1 ? seconds * 10 : undefined;
  }
  rose(ctx, x, y0, f);
}
/** Two plates, a fork, and a saucer of milk for Miso, set down on the sill with a clink. */
function extraPlates(ctx: Ctx, p: number) {
  const down = easeOut(span(p, T.back + 0.002, T.back + 0.006));
  if (down <= 0) return;
  const lift = (1 - down) * 10;
  plate(ctx, 584, SILL - 1 - lift);
  plate(ctx, 584, SILL - 3 - lift);
  fork(ctx, 587, SILL - 7 - lift, 1.2);
  saucer(ctx, 595, SILL - 1 - lift * 1.3);
}

// Camera keyframes [p, x, y, zoom] for the garden; equal p on consecutive keys = a cut.
const GARDEN_CAMERA = [
  [0, 440, 90, 1],
  [0.012, 440, 90, 1],
  [0.048, 556, 94, 2.7],
  [0.05, 358, 116, 3.2],
  [0.1, 358, 110, 3],
  [0.25, 60, 70, 2.6],
  [0.27, 66, 74, 2.5],
  [0.3, 366, 98, 1.35],
  [0.337, 372, 100, 1.4],
  [0.337, 422, 122, 3.4],
  [0.37, 422, 120, 3.6],
  [0.37, 494, 108, 1.9],
  [0.405, 488, 108, 2],
  [0.405, 486, 132, 4.2],
  [0.43, 490, 128, 3.9],
  [0.43, 466, 96, 1.45],
  [0.447, 462, 98, 1.5],
  [0.452, 442, 116, 2.2],
  [0.476, 440, 118, 2.3],
  [0.49, 442, 120, 2.2],
  [0.49, 454, 118, 2.1],
  [0.503, 454, 70, 2.1],
  [0.503, 524, -10, 2.3],
  [0.518, 524, -8, 2.2],
  [0.518, 526, -4, 1.9],
  [0.537, 532, 12, 1.9],
  [0.542, 533, 16, 1.9],
  [0.55, 538, 52, 1.8],
  [0.566, 542, 66, 1.9],
  [0.566, 542, 86, 2.5],
  [0.61, 546, 86, 2.7],
  [0.61, 558, 86, 2.65],
  [0.645, 558, 86, 2.7],
  [0.645, 551, 91, 4.1],
  [0.69, 551, 91, 4.4],
  [0.69, 560, 86, 2.65],
  [0.8, 560, 85, 2.55],
] as const;
/** The chase down the hill keeps the skater framed; everything else follows the track. */
function gardenView(p: number): View {
  let v: View = track(p, GARDEN_CAMERA);
  if (within(p, 0.27, T.hose)) {
    const x = skateX(p);
    v = { x: x + 26, y: groundY(x) - 24, zoom: 2.1 };
  }
  // Keep inside the set sideways and at the bottom; the sky above the roof is open.
  const hw = W / 2 / v.zoom,
    hh = H / 2 / v.zoom;
  return { x: clamp(v.x, hw, WORLD_W - hw), y: Math.min(v.y, 180 - hh), zoom: v.zoom };
}

function gardenScene(ctx: Ctx, p: number, seconds: number) {
  const view = gardenView(p);
  const d = duskAt(p);
  backdrop(ctx, view, d, seconds);
  camera(
    ctx,
    view,
    () => {
      cottage(ctx, p, seconds, d);
      const beckon =
        p < PLAN_AT ? presence(p, 0.016, 0.052, 0.008) : presence(p, 0.566, 0.594, 0.006);
      cherryPie(ctx, PIE_X, SILL, 1.05);
      steam(ctx, PIE_X, SILL - 8, seconds, beckon, -1);
      if (p > T.back) extraPlates(ctx, p);
      lawn(ctx, d);
      barrelRim(ctx);
      gardenCast(ctx, p, seconds, 0);
      barrel(ctx, d);
      flowerBed(ctx, p, seconds, d, 0);
      hedge(ctx, d);
      if (p < PLAN_AT) {
        if (within(p, T.glint, T.rise + 0.004)) {
          // Two eyes in the dark leaves, and a glint.
          const blink = within(p, 0.062, 0.064) ? 0.3 : 1;
          for (const ex of [355, 362]) oval(ctx, ex, 127, 1.6, 1.8 * blink, '#FFF6C8');
          const g = hump(p, T.glint, T.glint + 0.008);
          box(ctx, 362 - 4 * g, 126, 1 + 8 * g, 1, alpha('#FFFFFF', g));
          box(ctx, 362, 126 - 4 * g, 1, 1 + 8 * g, alpha('#FFFFFF', g));
        }
        if (p > T.rise + 0.012) {
          // His paws grip the top of the hedge.
          oval(ctx, 362, 113, 2.4, 2, PAW);
          oval(ctx, 370, 113, 2.4, 2, PAW);
        }
      }
      flowerBed(ctx, p, seconds, d, 1);
      gardenCast(ctx, p, seconds, 1);
    },
    null,
  );
  // Golden light from the low sun; it cools for the moment he's caught, then warms again.
  veil(ctx, '#FF9A4A', 0.07 * (1 - d));
  const caught = Math.min(
    ease(span(p, T.window, T.window + 0.01)),
    1 - ease(span(p, T.laugh, T.laugh + 0.02)),
  );
  veil(ctx, '#1E2440', 0.24 * caught);
  vignette(ctx, 0.4 + caught * 0.25);
  // The gust: streaks of wind across the frame.
  const gust = hump(p, T.gust - 0.004, T.gust + 0.01);
  if (gust > 0)
    for (let k = 0; k < 8; k++) {
      const gx = ((span(p, T.gust - 0.004, T.gust + 0.01) * 520 + k * 67) % 440) - 60,
        gy = 20 + k * 19;
      line(ctx, alpha('#FFFFFF', 0.55 * gust), 1, [gx, gy, gx + 40, gy - 3, gx + 52, gy + 1]);
    }
}

// ——— The bench, facing the sunset ———
const SEAT = 136;
function bench(ctx: Ctx, rim: string) {
  const wood = '#8A5A3C',
    dark = '#5E3C2A';
  box(ctx, 100, 100, 4, 40, dark);
  box(ctx, 232, 100, 4, 40, dark);
  box(ctx, 94, 104, 148, 6, wood);
  box(ctx, 94, 113, 148, 6, wood);
  box(ctx, 94, 104, 148, 1, rim);
  box(ctx, 90, SEAT, 156, 5, wood);
  box(ctx, 90, SEAT, 156, 1, rim);
  box(ctx, 90, SEAT + 5, 156, 2, dark);
  box(ctx, 98, SEAT + 5, 4, 20, dark);
  box(ctx, 234, SEAT + 5, 4, 20, dark);
  box(ctx, 88, 122, 8, 3, wood);
  box(ctx, 240, 122, 8, 3, wood);
  box(ctx, 90, 125, 3, 11, dark);
  box(ctx, 243, 125, 3, 11, dark);
}
function planB(ctx: Ctx, x: number, y: number, w: number, h: number, reveal = 1) {
  if (reveal <= 0) return;
  const shown = w * clamp(reveal);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, shown, h);
  ctx.clip();
  box(ctx, x, y, w, h, PAPER);
  for (let gx = x + 4; gx < x + w; gx += 6) box(ctx, gx, y, 0.6, h, GRID);
  write(ctx, 'PLAN B:', x + w * 0.36, y + h * 0.36, { size: h * 0.2, color: CHALK });
  write(ctx, 'ASK NICELY', x + w * 0.36, y + h * 0.7, { size: h * 0.17, color: ACCENT });
  // A chalk raccoon holding out a flower.
  const cx = x + w * 0.83,
    cy = y + h * 0.36;
  const u = h / 30;
  ctx.strokeStyle = CHALK;
  ctx.lineWidth = 0.7 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, 3.4 * u, 0, TAU);
  ctx.moveTo(cx, cy + 3.4 * u);
  ctx.lineTo(cx, cy + 11 * u);
  ctx.lineTo(cx - 3 * u, cy + 16 * u);
  ctx.moveTo(cx, cy + 11 * u);
  ctx.lineTo(cx + 3 * u, cy + 16 * u);
  ctx.moveTo(cx, cy + 6 * u);
  ctx.lineTo(cx - 5 * u, cy + 4 * u);
  ctx.stroke();
  box(ctx, cx - 2.8 * u, cy - 0.8 * u, 5.6 * u, 1.4 * u, CHALK);
  line(ctx, '#7FC77A', 0.6 * u, [cx - 5 * u, cy + 4 * u, cx - 6 * u, cy - 3 * u]);
  disc(ctx, cx - 6 * u, cy - 4 * u, 1.6 * u, ACCENT);
  ctx.restore();
  if (reveal < 1) {
    box(ctx, x + shown - 1.5, y - 1, 3, h + 2, '#2E5596');
    box(ctx, x + shown - 0.5, y - 1, 1, h + 2, '#4A74B6');
  }
}
/** The bench faces us; behind it the sun sinks into the hedge between Rocco and Grandma. */
function gardenAtDusk(ctx: Ctx, p: number, seconds: number) {
  const sink = span(p, BENCH_AT, 1);
  sky(ctx, ['#35366E', '#6A4C86', '#B8627A', '#EE9462', '#F8C07A'], 0, 102);
  for (let i = 0; i < 16; i++) {
    const tw = Math.sin(seconds * (0.8 + rand(i) * 0.9) + i * 2) > 0.6 ? 1 : 0.55;
    box(ctx, rand(i + 11) * W, rand(i + 31) * 40, 1, 1, alpha('#FFF2D6', tw * (0.4 + sink * 0.6)));
  }
  const sy = 80 + sink * 10;
  glow(ctx, 170, sy, 190, '#FFB060', 0.6);
  disc(ctx, 170, sy, 15, '#FFDA90');
  for (let i = 0; i < 8; i++) oval(ctx, i * 48 - 12, 98, 40, 7 + (i % 3) * 3, '#8A5A7E');
  // The hedge along the garden wall, its top edge lit by the last of the sun.
  for (let i = 0; i < 12; i++) {
    oval(ctx, i * 30, 102, 20, 11 + (i % 3) * 3, '#34403E');
    oval(ctx, i * 30, 92 - (i % 3) * 3, 12, 1.2, alpha('#F2A66A', 0.6));
  }
  // The apple tree, and the corner of the cottage with its kitchen lit.
  oval(ctx, 292, 52, 44, 30, '#3A4642');
  oval(ctx, 268, 70, 30, 20, '#3E4B46');
  box(ctx, 286, 70, 8, 40, '#3E3230');
  for (let i = 0; i < 6; i++)
    disc(ctx, 268 + rand(i + 3) * 50, 40 + rand(i + 9) * 40, 2, '#C8504A');
  box(ctx, 0, 30, 58, 120, '#9C7E86');
  poly(ctx, '#6E3E48', [-4, 34, 68, 34, 54, 20, -4, 20]);
  box(ctx, 12, 62, 34, 32, TRIM);
  box(ctx, 15, 65, 28, 26, '#FFD48A');
  box(ctx, 28, 65, 2, 26, TRIM);
  glow(ctx, 29, 78, 56, '#FFC870', 0.45);
  sky(ctx, ['#6A6446', '#505A40', '#3E4A38'], 102, 180);
}
function benchFront(ctx: Ctx, p: number, seconds: number) {
  camera(ctx, track(p, BENCH_CAMERA), () => {
    gardenAtDusk(ctx, p, seconds);
    // Long shadows fall toward us from the low sun behind the bench.
    poly(ctx, alpha('#1C1822', 0.4), [92, 152, 246, 152, 300, 180, 36, 180]);
    bench(ctx, '#F6B27A');
    const tag = p > 0.86,
      settled = p > T.wink;
    const unroll = ease(span(p, T.unroll, T.unroll + 0.016));
    // Miso laps her milk, then curls up on the bench beside Rocco.
    if (tag) miso(ctx, 104, SEAT, 'nap', { size: 1, facing: -1, t: seconds });
    // Rocco: eating, then full to the brim, then the new plan on his lap.
    const bite = Math.max(0, Math.sin(seconds * 2.4));
    const r: Raccoon = {
      size: 1.35,
      t: seconds,
      legs: 'sit',
      daisy: true,
      bruised: true,
      stain: tag,
      full: tag ? 1 : 0.3,
      eyes: 'happy',
      mouth: tag ? 'grin' : 'chew',
      look: [0.6, 0.2],
      arms: settled ? [0.4, 0.95] : tag ? [1.5, 1.5] : [0.5, 1.1 + bite * 1.1],
    };
    rocco(ctx, 132, SEAT, r);
    if (!tag) {
      plate(ctx, 144, SEAT - 5, true);
      const hand = pawOf(132, SEAT, r);
      fork(ctx, hand.x, hand.y - 2, 0.3);
    } else if (p > T.unroll - 0.004 && !settled) planB(ctx, 112, 117, 46, 30, unroll);
    // Grandma with her plate; she reads the plan and winks.
    const wink = within(p, T.wink, T.wink + 0.012);
    rose(ctx, 214, SEAT, {
      size: 2.1,
      facing: -1,
      sitting: true,
      shins: 11,
      arms: [0.9, 1.2],
      eyes: wink ? 'open' : 'happy',
      mouth: wink ? 'grin' : 'smile',
      wink,
    });
    const g = handOf(214, SEAT, {
      ...ROSE,
      size: 2.1,
      facing: -1,
      sitting: true,
      arms: [0.9, 1.2],
    });
    plate(ctx, g.x - 1, g.y + 1, !tag);
    // The pie goes, slice by slice; by the end the tin holds only crumbs.
    cherryPie(ctx, 172, SEAT, 1.1, p > T.wink ? 1 : tag ? 0.75 : 0.25);
    // The new plan, propped against the bench where everyone can read it.
    if (settled) planB(ctx, 140, 143, 46, 30);
    if (tag) saucer(ctx, 82, 166, 0);
    else {
      saucer(ctx, 88, 164, 1);
      miso(ctx, 72, 164, 'lap', { size: 1.25, t: seconds });
    }
    // Warm rim light from the sun behind them.
    glow(ctx, 170, 96, 120, '#FFC080', 0.18);
  });
  vignette(ctx, 0.45);
}
const BENCH_CAMERA = [
  [0.8, 160, 118, 1.35],
  [0.86, 160, 118, 1.5],
  [0.86, 138, 106, 2.4],
  [0.92, 138, 108, 2.5],
  [0.92, 204, 90, 3.3],
  [0.95, 204, 90, 3.4],
  [1, 160, 120, 1.5],
] as const;

const CAPTIONS = [
  [0.052, 0.1, 'Rocco had a plan.'],
  [0.188, 0.236, 'A very good plan.'],
  [0.638, 0.702, 'Uh-oh.'],
  [0.806, 0.858, 'Grandma Rose always baked extra.'],
] as const;

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const theGreatPieHeistScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: 62, voice: 'pluck', intro: [0, 3, 7, 10], outro: [3, 7, 10, 15] },
    (s) => {
      const D = 62,
        F = 65;
      const beat = (bpm: number) => 60 / bpm / s.story;
      // Golden hour: birdsong and a warm little tune in F.
      s.fx('wind', 0, s.story * 0.1, 0.035);
      s.fx('tweet', 0.012, 1.2, 0.07, 0.5);
      s.fx('tweet', 0.034, 1, 0.05, -0.4);
      s.section({
        from: 0,
        to: 0.054,
        bpm: 84,
        root: F,
        chords: [0, 5],
        melody: [7, 9, 12, null, 9, 7, 4, null],
        voice: 'keys',
        gain: 0.7,
        level: 0.55,
      });
      s.fx('chime', T.glint, 0.9, 0.07, -0.2);
      // Sneaky: a pizzicato tiptoe as the eyes appear.
      const CAPER = [0, null, 3, null, 5, null, 6, 7, null, null, 3, null, 0, null, null, null];
      s.section({
        from: 0.05,
        to: 0.1,
        bpm: 112,
        root: D,
        minor: true,
        chords: [0],
        melody: CAPER,
        step: 0.5,
        voice: 'pluck',
        gain: 0.7,
        groove: 'tick',
        level: 0.45,
        fade: 0.4,
      });
      // THE PLAN: the caper proper.
      s.section({
        from: 0.1,
        to: SKATE_AT,
        bpm: 112,
        root: D,
        minor: true,
        chords: [0, 0, 5, 7],
        melody: [...CAPER, 0, null, 3, null, 5, null, 6, 7, null, 10, 8, 7, 5, 3, 2, null],
        step: 0.5,
        voice: 'pluck',
        gain: 0.85,
        groove: 'tick',
        level: 0.7,
        fade: 0.5,
      });
      for (const step of STEPS) {
        s.fx(
          'scribble',
          step.from,
          (step.to - step.from) * s.story * 0.9,
          0.09,
          (step.x / W - 0.5) * 0.8,
        );
        s.fx('knock', step.tap, 0.15, 0.2, (step.x / W - 0.5) * 0.8);
      }
      s.fx('scribble', 0.101, 0.6, 0.08);
      s.fx('scribble', MARK_AT[0], (MARK_AT[1] - MARK_AT[0]) * s.story, 0.14, 0.1);
      [0, 3, 7, 12].forEach((d, i) => s.note(0.236 + i * beat(224), D + 12 + d, 0.5, 'pluck', 0.1));
      // STEP ONE: frantic drive downhill.
      s.fx('squeak', T.push, 0.3, 0.12, -0.3);
      s.section({
        from: T.push,
        to: T.hose,
        bpm: 152,
        root: D,
        minor: true,
        chords: [0, 3, 5, 7],
        melody: [0, 3, 5, 7, 5, 7, 10, 12, 10, 12, 15, 12, 15, 17, 19, 24],
        step: 0.5,
        voice: 'lead',
        gain: 0.6,
        groove: 'drive',
        level: 0.8,
        fade: 0.2,
      });
      for (let i = 0; i < 5; i++)
        s.fx('squeak', T.push + 0.008 + i * 0.006, 0.18, 0.06 + i * 0.012, -0.2);
      s.fx('boing', T.hose, 0.9, 0.22);
      s.fx('swish', T.hose + 0.004, 1.4, 0.13, 0.2);
      s.fx('thud', T.land, 0.5, 0.3, 0.3);
      s.fx('rustle', T.land, 0.8, 0.12, 0.3);
      // A sad trombone for step one.
      [7, 6, 5].forEach((d, i) => s.note(0.34 + i * 0.006, D + d, 0.3, 'lead', 0.08));
      s.note(0.358, D + 4, 1.1, 'lead', 0.08);
      s.fx('tweet', 0.34, 1.2, 0.05, 0.3);
      s.fx('pop', T.daisy, 0.15, 0.12);
      // STEP TWO: sneak again...
      s.section({
        from: 0.37,
        to: T.yowl,
        bpm: 112,
        root: D,
        minor: true,
        chords: [0, 5],
        melody: CAPER,
        step: 0.5,
        voice: 'pluck',
        gain: 0.6,
        groove: 'tick',
        level: 0.5,
        fade: 0.3,
      });
      s.fx('snore', 0.37, s.story * 0.04, 0.05, 0.3);
      s.fx('swish', T.cast, 0.35, 0.14);
      s.fx('whir', T.cast + 0.002, 0.6, 0.1, 0.2);
      s.fx('click', T.hook, 0.1, 0.14, 0.3);
      for (const t of REEL_TICKS) s.fx('tick', t, 0.08, 0.14, -0.1);
      // ...then the yowl, and chaos.
      s.fx('meow', T.yowl, 0.8, 0.26, 0.3);
      s.fx('swish', T.launch, 0.35, 0.14, 0.3);
      s.fx('gasp', 0.44, 0.4, 0.1, -0.1);
      s.fx('thud', T.pounce, 0.4, 0.26, -0.1);
      s.fx('clatter', T.pounce, (T.settle - T.pounce) * s.story, 0.14, -0.1);
      s.fx('meow', 0.458, 0.4, 0.12, -0.3);
      s.section({
        from: T.pounce,
        to: T.settle,
        bpm: 168,
        root: D,
        minor: true,
        chords: [0, 1],
        melody: [12, 11, 12, 11, 7, 6, 7, 6],
        step: 0.5,
        voice: 'lead',
        gain: 0.5,
        groove: 'drive',
        level: 0.75,
        fade: 0.15,
      });
      [5, 4, 3].forEach((d, i) => s.note(T.settle + 0.004 + i * 0.006, D + d, 0.3, 'lead', 0.08));
      s.note(T.settle + 0.022, D + 2, 1, 'lead', 0.08);
      // STEP THREE: a scale for every paw up the drainpipe, then a fanfare.
      CLIMB_GRABS.forEach((t, i) => {
        s.note(t, D + [0, 3, 5, 7][i], 0.25, 'pluck', 0.1, -0.2);
        s.fx('step', t, 0.12, 0.07, -0.2);
      });
      s.fx('pop', T.open, 0.2, 0.16, 0.1);
      s.fx('swish', T.open, 0.3, 0.1, 0.1);
      s.chord(T.open + 0.002, [D + 12, D + 16, D + 19], 0.8, 'lead', 0.05);
      s.section({
        from: T.jump - 0.002,
        to: T.gust,
        bpm: 96,
        root: F,
        chords: [0, 5],
        melody: [12, 16, 19, 24],
        voice: 'bell',
        gain: 0.8,
        level: 0.5,
        fade: 0.2,
      });
      s.fx('wind', T.gust - 0.006, 1.6, 0.2, -0.4);
      s.fx('swish', T.gust + 0.002, 0.4, 0.18, 0.2);
      [12, 10, 8, 7, 5, 3].forEach((d, i) =>
        s.note(T.gust + 0.005 + i * 0.0015, D + d, 0.15, 'pluck', 0.08),
      );
      s.fx('boing', T.snag, 1, 0.22);
      s.fx('creak', T.snag + 0.004, 0.9, 0.12);
      // Dangling: a held breath, a tiptoe toward the pie.
      s.section({
        from: 0.556,
        to: T.window,
        bpm: 60,
        root: D,
        minor: true,
        chords: [0],
        level: 0.4,
        bass: false,
        fade: 0.6,
      });
      s.fx('sparkle', T.spot, 0.9, 0.08, 0.3);
      [0, 3, 7, 8].forEach((d, i) =>
        s.note(T.reach + i * beat(150), D + 12 + d, 0.2, 'pluck', 0.07, 0.2),
      );
      s.fx('creak', T.window, 0.7, 0.16, 0.3);
      s.fx('gasp', T.window + 0.006, 0.4, 0.1, 0.3);
      // Caught: the music stops; only the kitchen clock is brave enough to make a sound.
      for (let t = T.window + 0.012; t < T.laugh; t += 0.5 / s.story)
        s.fx('tick', t, 0.06, 0.12, 0.35);
      s.fx('wind', T.window, (T.laugh - T.window) * s.story, 0.03);
      // She laughs.
      s.fx('giggle', T.laugh + 0.004, 0.5, 0.08, 0.3);
      s.fx('giggle', T.burst, 1.4, 0.2, 0.3);
      s.fx('giggle', T.burst + 0.016, 1, 0.14, 0.3);
      s.chord(T.burst, [F, F + 4, F + 7], 3, 'pad', 0.04);
      s.fx('step', T.exit + 0.004, 0.15, 0.06, 0.5);
      s.fx('step', T.exit + 0.01, 0.15, 0.05, 0.6);
      s.fx('clatter', T.back - 0.004, 0.3, 0.06, 0.4);
      s.fx('knock', T.back + 0.004, 0.18, 0.14, 0.3);
      s.fx('knock', T.back + 0.008, 0.18, 0.12, 0.3);
      // A warm waltz for pie on the bench.
      s.section({
        from: 0.772,
        to: 1,
        bpm: 132,
        root: F,
        chords: [0, 5, 7, 0],
        melody: [
          4,
          7,
          12,
          14,
          12,
          9,
          7,
          11,
          14,
          12,
          null,
          null,
          4,
          7,
          12,
          17,
          14,
          12,
          11,
          7,
          11,
          12,
          null,
          null,
        ],
        voice: 'keys',
        gain: 0.8,
        groove: 'waltz',
        level: 0.8,
        fade: 1.5,
      });
      s.fx('knock', 0.806, 0.15, 0.1, -0.2);
      s.fx('snore', 0.81, s.story * 0.045, 0.04, -0.5);
      s.fx('rustle', T.unroll, 0.9, 0.14, -0.2);
      s.fx('chime', T.wink, 1.2, 0.12, 0.3);
      s.fx('tweet', 0.9, 1.2, 0.05, 0.6);
      s.fx('sparkle', 0.955, 1.4, 0.06, 0.4);
    },
  );

export const theGreatPieHeist: FilmModule = {
  draw(ctx, p, seconds) {
    if (p < PLAN_AT || within(p, SKATE_AT, BENCH_AT)) gardenScene(ctx, p, seconds);
    else if (p < SKATE_AT) blueprint(ctx, p, seconds);
    else benchFront(ctx, p, seconds);
    // Soft dips: into the plan, and from the window to the bench.
    veil(ctx, '#0E1830', hump(p, 0.092, 0.108));
    veil(ctx, '#1A0F0C', hump(p, 0.792, 0.808) * 0.9);
    captions(ctx, p, CAPTIONS);
  },
  score: theGreatPieHeistScore,
  look: {
    shade: '#1A1418',
    ink: '#FFF1E0',
    accent: '#E0504B',
    dedication: "crime doesn't pay. asking nicely does.",
  },
};
