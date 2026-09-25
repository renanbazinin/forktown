import { CINEMA_FILMS } from '../lib/cinema';
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
  faded,
  glow,
  H,
  hump,
  iris,
  lerp,
  line,
  mix,
  oval,
  poly,
  presence,
  rand,
  span,
  TAU,
  track,
  veil,
  vignette,
  W,
  within,
  type Ctx,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * MISO AND THE MOON
 * Miso, Forktown's plump rooftop cat, wants the moon. She pounces on its reflection in a rain
 * barrel, then climbs a chimney, an aerial, and the Stargazer Station's telescope, and the
 * moon stays exactly as far away. Then the moon opens one eye and giggles: it wants to play.
 * After a chase and a lonely moment, it blows her a staircase of clouds and they play catch
 * with a star, until Miso falls asleep curled around it on the roof.
 *
 * The magic waltz runs at 80 bpm from the moment the moon blows the steps: every cloud puff,
 * every hop, and every catch and bounce of the star sits on its beat grid, and the score
 * reads the same constants.
 */

const STORY = (CINEMA_FILMS.find((film) => film.artwork === 'moon')?.duration ?? 60) - 6;
const BPM = 80;
const BEAT = 60 / BPM / STORY;
/** The chase runs at 120 bpm: two quick beats to every waltz beat and a half. */
const QUICK = (BEAT * 2) / 3;
const sec = (seconds: number) => seconds / STORY;

// Shots, in story order.
const SHOTS = [
  ['town', 0],
  ['crouch', 0.058],
  ['splash', 0.09],
  ['lookup', 0.122],
  ['chimney', 0.145],
  ['antenna', 0.18],
  ['dome', 0.212],
  ['swipe', 0.245],
  ['scope', 0.272],
  ['peek', 0.306],
  ['chase', 0.345],
  ['alone', 0.418],
  ['sad', 0.47],
  ['moonsad', 0.497],
  ['stairs', 0.522],
  ['climb', 0.584],
  ['catch', 0.63],
  ['shower', 0.738],
  ['yawn', 0.79],
  ['down', 0.822],
  ['goodnight', 0.88],
] as const;
type ShotName = (typeof SHOTS)[number][0];
function current(p: number) {
  let i = 0;
  while (i + 1 < SHOTS.length && p >= SHOTS[i + 1][1]) i++;
  const from = SHOTS[i][1],
    to = SHOTS[i + 1]?.[1] ?? 1;
  return { name: SHOTS[i][0] as ShotName, local: span(p, from, to) };
}
const at = (name: ShotName) => SHOTS.find((s) => s[0] === name)![1];

// ——— Story beats shared by the pictures and the score ———
// Act one: the reflection.
const SPOT = 0.046;
const CROUCH_AT = 0.066;
const POUNCE = 0.083;
const SPLASH = 0.093;
const SURFACE = 0.101;
const GLARE = 0.108;
// Act two: higher and higher.
const CLAWS = [0.149, 0.153, 0.157, 0.161];
const TOP_CHIMNEY = 0.163;
const RUNGS = [0.184, 0.189, 0.194, 0.199];
const WOBBLE = 0.201;
const JUMP_DOME = 0.216,
  LAND_DOME = 0.224;
const SWIPE = 0.257;
const SLIDE = 0.263,
  BONK = 0.2685;
// Act three: the moon wakes up.
const PAW_IN = 0.278;
const EYE_OPEN = 0.287;
const WINK = 0.296;
const PEEK = at('peek');
const quick = (n: number) => PEEK + n * QUICK;
const DUCK = quick(1);
const POP = quick(2.5);
const BOLT = quick(3.5);
const LEAPS = [quick(6), quick(8), quick(10)];
const LEAP_TIME = QUICK * 1.4;
const HIDE = 0.397;
// Act four: too far away.
const SIGH = 0.478;
const IDEA = 0.51;
// Act five: the magic waltz, on its own beat grid.
const MAGIC = at('stairs');
const beat = (n: number) => MAGIC + n * BEAT;
const CHEEKS = beat(0.4),
  BLOW = beat(1);
const STEPS = 6;
/** The moon blows the steps from the top down; Miso hops them from the bottom up. */
const PUFFS = Array.from({ length: STEPS }, (_, i) => beat(1.5 + i * 0.5));
const PERK = beat(3),
  RISE = beat(4);
const HOPS = Array.from({ length: STEPS }, (_, i) => beat(5 + i * 0.5));
const HOP_TIME = BEAT * 0.42;
const DROP = beat(8.5),
  CATCH = beat(10);
/** Miso bats, the moon bounces it back, twice; then Miso keeps it. */
const HITS = [beat(11), beat(12), beat(13), beat(14)];
const KEEP = beat(15);
// Act six: a gift, a yawn, and the way down.
const SHOWER = beat(16);
const YAWN = 0.795,
  YAWN_LENGTH = sec(1.3);
const DESCEND = 0.826,
  SETTLE = 0.868;
const SNORE_FROM = 0.925;

// ——— Palette ———
const INK = '#2B1B1E';
const FUR = '#EC8E3C',
  FUR_D = '#B45C27',
  FUR_S = '#C8712F',
  WET = '#C98552',
  WET_D = '#8C5634';
const CREAM = '#FFF3E2',
  PINK = '#F4A3A6',
  NOSE = '#E47C88',
  EYE = '#C8E47C',
  PUPIL = '#1C1620';
const MOON = '#FFE5A0',
  MOON_L = '#FFF4D4',
  MOON_D = '#EFCB84',
  MOON_INK = '#8A5A3E',
  BLUSH = '#F6A48E';
const STAR = '#FFE58A',
  STAR_D = '#E7AE45';
const LAMP = '#FFC96E';

type Palette = { body: string; lit: string; dark: string };
const NIGHT_CLOUD: Palette = { body: '#3E4574', lit: '#6B6D9E', dark: '#2A305E' };
const MAGIC_CLOUD: Palette = { body: '#B8B0E2', lit: '#F6ECF6', dark: '#877FC0' };

const SKY_KEYS: readonly (readonly [number, readonly string[]])[] = [
  [0, ['#090E2C', '#111943', '#1B2757', '#29396B']],
  [0.41, ['#090E2C', '#111943', '#1B2757', '#29396B']],
  [0.43, ['#06091A', '#0B112D', '#121A3B', '#1A2447']],
  [0.5, ['#06091A', '#0B112D', '#121A3B', '#1A2447']],
  [0.55, ['#10144A', '#221F63', '#3A3479', '#5A4A8C']],
  [0.8, ['#10144A', '#221F63', '#3A3479', '#5A4A8C']],
  [0.88, ['#0A1132', '#131C48', '#1E2C5C', '#2D4071']],
];
function skyAt(p: number) {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && p >= SKY_KEYS[i + 1][0]) i++;
  const [a, from] = SKY_KEYS[i],
    [b, to] = SKY_KEYS[i + 1];
  const t = ease(span(p, a, b));
  return from.map((color, j) => mix(color, to[j], t));
}

// ——— Little helpers ———
type Pt = { x: number; y: number };
/** Flat bands joined by one row of checker dither: a night sky on a small call budget. */
function bands(ctx: Ctx, colors: readonly string[], top = 0, bottom = H) {
  const step = (bottom - top) / colors.length;
  colors.forEach((color, i) => box(ctx, 0, top + i * step, W, Math.ceil(step) + 1, color));
  for (let i = 1; i < colors.length; i++) {
    const y = Math.round(top + i * step);
    for (let x = 0; x < W; x += 4) {
      box(ctx, x, y - 1, 2, 1, colors[i]);
      box(ctx, x + 2, y, 2, 1, colors[i - 1]);
    }
  }
}
/** Twinkling stars in screen space; `shift` slides them a little for parallax. */
function stars(
  ctx: Ctx,
  seconds: number,
  amount: number,
  { count = 34, seed = 3, top = 0, height = 120, shiftX = 0, shiftY = 0 } = {},
) {
  if (amount <= 0) return;
  faded(ctx, amount, () => {
    for (let i = 0; i < count; i++) {
      const x = (((rand(seed + i * 3.1) * W - shiftX) % W) + W) % W,
        y = top + rand(seed + i * 5.7) * height - shiftY;
      const twinkle = Math.sin(seconds * (0.7 + rand(seed + i) * 0.8) + i * 2.3);
      const color = i % 3 ? '#FFF1C8' : '#AFC2E8';
      box(ctx, x, y, 1, 1, color);
      if (twinkle > 0.6 && i % 4 === 0) {
        box(ctx, x - 1, y, 3, 1, alpha(color, 0.5));
        box(ctx, x, y - 1, 1, 3, alpha(color, 0.5));
      }
    }
  });
}
function arc(
  ctx: Ctx,
  color: string,
  width: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, from, to);
  ctx.stroke();
}
/** A point on a parabola from a to b, peaking `height` above the higher end. */
function lob(a: Pt, b: Pt, t: number, height: number): Pt {
  const c = clamp(t);
  const top = Math.min(a.y, b.y) - height;
  const y = c < 0.5 ? lerp(a.y, top, 1 - (1 - c * 2) ** 2) : lerp(top, b.y, ((c - 0.5) * 2) ** 2);
  return { x: lerp(a.x, b.x, c), y };
}

// ——— The moon ———
type MoonLook = {
  /** 0 = just a moon, 1 = a face. */
  face?: number;
  eyes?: 'open' | 'happy' | 'closed' | 'wink';
  /** 0 = eyelids up, 1 = shut. */
  lids?: number;
  look?: readonly [number, number];
  mouth?: 'smile' | 'giggle' | 'o' | 'pout' | 'none';
  cheeks?: number;
  /** Negative: worried; positive: cheeky. */
  brows?: number;
  tilt?: number;
  shine?: number;
};
function moon(ctx: Ctx, x: number, y: number, r: number, f: MoonLook = {}) {
  glow(ctx, x, y, r * 3.4, MOON, 0.3 * (f.shine ?? 1));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(f.tilt ?? 0);
  const cheeks = f.cheeks ?? 0;
  if (cheeks > 0)
    for (const side of [-1, 1])
      disc(ctx, side * r * 0.7, r * 0.3, r * (0.2 + cheeks * 0.22), MOON_D);
  disc(ctx, 0, 0, r, MOON);
  disc(ctx, -r * 0.1, -r * 0.1, r * 0.86, MOON_L);
  disc(ctx, r * 0.5, -r * 0.52, r * 0.13, MOON_D);
  disc(ctx, -r * 0.66, -r * 0.4, r * 0.1, MOON_D);
  disc(ctx, r * 0.24, r * 0.7, r * 0.08, MOON_D);
  const face = f.face ?? 0;
  if (face > 0) faded(ctx, face, () => moonFace(ctx, r, f));
  ctx.restore();
}
function moonFace(ctx: Ctx, r: number, f: MoonLook) {
  const e = r * 0.12,
    w = Math.max(0.8, r * 0.05);
  const [lx, ly] = f.look ?? [0, 0];
  const lids = clamp(f.lids ?? 0),
    brows = f.brows ?? 0;
  for (const side of [-1, 1]) {
    const ex = side * r * 0.34,
      ey = -r * 0.1;
    const kind = f.eyes === 'wink' && side > 0 ? 'happy' : (f.eyes ?? 'open');
    if (kind === 'happy')
      arc(ctx, MOON_INK, w, ex, ey + e * 0.5, e, e * 0.9, Math.PI * 1.12, Math.PI * 1.88);
    else if (kind === 'closed' || lids > 0.88)
      arc(ctx, MOON_INK, w, ex, ey - e * 0.1, e, e * 0.7, Math.PI * 0.12, Math.PI * 0.88);
    else {
      const ry = e * 1.15 * (1 - lids * 0.8);
      oval(ctx, ex + lx * e * 0.35, ey + e * lids * 0.6 + ly * e * 0.3, e * 0.85, ry, MOON_INK);
      if (ry > e * 0.5)
        disc(ctx, ex + lx * e * 0.35 - e * 0.3, ey - ry * 0.4 + ly * e * 0.3, e * 0.28, '#FFFFFF');
    }
    if (brows) {
      const by = ey - e * 2;
      line(ctx, alpha(MOON_INK, 0.75), w * 0.8, [
        ex - side * e * 0.9,
        by + brows * e * 0.55,
        ex + side * e * 1.1,
        by - brows * e * 0.55,
      ]);
    }
    oval(ctx, side * r * 0.54, r * 0.2, r * 0.14, r * 0.075, alpha(BLUSH, 0.75));
  }
  const my = r * 0.32;
  switch (f.mouth ?? 'smile') {
    case 'smile':
      arc(ctx, MOON_INK, w, 0, my - r * 0.1, r * 0.17, r * 0.12, Math.PI * 0.15, Math.PI * 0.85);
      break;
    case 'giggle':
      oval(ctx, 0, my, r * 0.15, r * 0.12, MOON_INK);
      oval(ctx, 0, my + r * 0.06, r * 0.09, r * 0.05, '#E9847E');
      box(ctx, -r * 0.15, my - r * 0.13, r * 0.3, r * 0.08, MOON_L);
      break;
    case 'o':
      oval(ctx, 0, my, r * 0.07, r * 0.09, MOON_INK);
      break;
    case 'pout':
      oval(ctx, 0, my, r * 0.06, r * 0.045, MOON_INK);
      break;
  }
}

// ——— Clouds and stars ———
function cloud(ctx: Ctx, x: number, y: number, w: number, seed: number, c = NIGHT_CLOUD) {
  const n = w > 50 ? 6 : w > 22 ? 4 : 3;
  oval(ctx, x, y + w * 0.02, w * 0.52, w * 0.13, c.dark);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const r = w * (0.12 + 0.12 * Math.sin(t * Math.PI) + rand(seed + i) * 0.04);
    disc(ctx, x - w * 0.44 + w * 0.88 * t, y - r * 0.5, r, c.body);
  }
  for (let i = 1; i < n; i += 2) {
    const t = (i + 0.5) / n;
    const r = w * (0.12 + 0.12 * Math.sin(t * Math.PI) + rand(seed + i) * 0.04);
    disc(ctx, x - w * 0.44 + w * 0.88 * t + r * 0.18, y - r * 0.85, r * 0.55, c.lit);
  }
}
function starShape(ctx: Ctx, x: number, y: number, r: number, color: string, spin = 0) {
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = spin - Math.PI / 2 + (i * Math.PI) / 5,
      rr = i % 2 ? r * 0.46 : r;
    points.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  poly(ctx, color, points);
}
/** The star the moon gives Miso: a plump golden star, soft as a ball of yarn. */
function bigStar(ctx: Ctx, x: number, y: number, r: number, spin: number, shine = 1) {
  glow(ctx, x, y, r * 5, '#FFE9A8', 0.42 * shine);
  starShape(ctx, x, y + r * 0.08, r * 1.14, STAR_D, spin);
  starShape(ctx, x, y, r, STAR, spin);
  disc(ctx, x - r * 0.18, y - r * 0.2, r * 0.26, '#FFFBE8');
}
/** A tiny four-point twinkle. */
function twinkle(ctx: Ctx, x: number, y: number, size: number, color = '#FFF1C0') {
  box(ctx, x - size, y - 0.5, size * 2 + 1, 1, alpha(color, 0.7));
  box(ctx, x - 0.5, y - size, 1, size * 2 + 1, alpha(color, 0.7));
  box(ctx, x - 0.5, y - 0.5, 1.5, 1.5, color);
}

// ——— Miso, side on ———
/** Hip, shoulder, head, four paws, and the tail, in cat units: (0, 0) is the ground. */
type Joints = {
  hx: number;
  hy: number;
  sx: number;
  sy: number;
  kx: number;
  ky: number;
  bfx: number;
  bfy: number;
  bnx: number;
  bny: number;
  ffx: number;
  ffy: number;
  fnx: number;
  fny: number;
  /** Tail base angle: 0 points straight back, positive lifts it. */
  tail: number;
  curl: number;
  ry: number;
  tilt: number;
};
const STAND: Joints = {
  hx: -6,
  hy: -11,
  sx: 6,
  sy: -11,
  kx: 12,
  ky: -18,
  bfx: -7,
  bfy: 0,
  bnx: -5,
  bny: 0,
  ffx: 5,
  ffy: 0,
  fnx: 7,
  fny: 0,
  tail: 1.25,
  curl: -0.12,
  ry: 7,
  tilt: 0,
};
const CROUCH: Joints = {
  ...STAND,
  hx: -6,
  hy: -8,
  sx: 5,
  sy: -5.5,
  kx: 12,
  ky: -8,
  bfx: -8,
  bnx: -5.5,
  ffx: 8.5,
  fnx: 11,
  tail: 0.15,
  curl: 0.04,
  ry: 5.6,
  tilt: 0.1,
};
const LEAP: Joints = {
  hx: -8,
  hy: -12,
  sx: 8,
  sy: -14,
  kx: 16,
  ky: -18,
  bfx: -19,
  bfy: -7,
  bnx: -18,
  bny: -5,
  ffx: 20,
  ffy: -13,
  fnx: 19,
  fny: -10,
  tail: 0.3,
  curl: -0.06,
  ry: 5.8,
  tilt: -0.1,
};
const SIT: Joints = {
  ...STAND,
  hx: -4,
  hy: -6,
  sx: 2,
  sy: -15,
  kx: 4,
  ky: -23,
  bfx: -2,
  bnx: 0,
  ffx: 4,
  fnx: 6.5,
  ry: 7,
};
/** Sitting up with the front paws together at the chest: holding the star. */
const HOLD: Joints = { ...SIT, ffx: 6, ffy: -12, fnx: 7.5, fny: -11, tilt: 0.1 };
/** Sitting up with a paw raised high: batting the star. */
const BAT: Joints = {
  ...SIT,
  sy: -16,
  kx: 3,
  ky: -24,
  ffx: 7,
  ffy: -12,
  fnx: 9,
  fny: -27,
  tilt: -0.3,
};
const REAR: Joints = {
  hx: -2,
  hy: -9,
  sx: 1,
  sy: -20,
  kx: 3,
  ky: -28,
  bfx: -4,
  bfy: 0,
  bnx: -1,
  bny: 0,
  ffx: 6,
  ffy: -30,
  fnx: 5,
  fny: -24,
  tail: 0.25,
  curl: 0.1,
  ry: 6.5,
  tilt: -0.3,
};
/** Clinging to a wall on her right, belly to it. */
const CLIMB_A: Joints = {
  hx: -1,
  hy: -8,
  sx: 1,
  sy: -19,
  kx: 3,
  ky: -26,
  bfx: 3,
  bfy: -3,
  bnx: 3,
  bny: 0,
  ffx: 4,
  ffy: -25,
  fnx: 4,
  fny: -21,
  tail: -1,
  curl: 0.12,
  ry: 6,
  tilt: -0.35,
};
const CLIMB_B: Joints = { ...CLIMB_A, bfy: 0, bny: -4, ffy: -21, fny: -26 };
const GATHER: Joints = {
  ...STAND,
  hx: -5,
  hy: -12,
  sx: 5,
  sy: -12,
  kx: 12,
  ky: -17,
  bfx: 0,
  bfy: -1,
  bnx: 2,
  ffx: -1,
  ffy: -1,
  fnx: 1,
  tail: 0.8,
  curl: -0.1,
  ry: 6.8,
};
const EXTEND: Joints = {
  ...STAND,
  hx: -8,
  sx: 8,
  sy: -12,
  kx: 15,
  ky: -16,
  bfx: -16,
  bfy: -2,
  bnx: -15,
  ffx: 17,
  ffy: -3,
  fnx: 16,
  tail: 0.5,
  curl: -0.08,
  ry: 6,
};
/** A cosy loaf, head up; CURL tucks the head down to sleep. */
const LOAF: Joints = {
  ...STAND,
  hx: -6,
  hy: -6,
  sx: 6,
  sy: -6,
  kx: 11,
  ky: -11,
  bfx: -6,
  bnx: -4,
  ffx: 8,
  ffy: -1,
  fnx: 10,
  fny: -1,
  ry: 6,
};
const CURL: Joints = { ...LOAF, kx: 11, ky: -6.5, tilt: 0.35 };

function mixJoints(a: Joints, b: Joints, t: number): Joints {
  const out = { ...a };
  for (const key of Object.keys(a) as (keyof Joints)[]) out[key] = lerp(a[key], b[key], t);
  return out;
}
function walking(step: number, base = STAND): Joints {
  const j = { ...base };
  const a = Math.sin(step) * 3,
    ay = -Math.max(0, Math.cos(step)) * 1.8;
  const b = -a,
    by = -Math.max(0, -Math.cos(step)) * 1.8;
  j.bnx += a;
  j.bny += ay;
  j.ffx += a;
  j.ffy += ay;
  j.bfx += b;
  j.bfy += by;
  j.fnx += b;
  j.fny += by;
  const bob = Math.abs(Math.cos(step)) * 0.6;
  j.hy -= bob;
  j.sy -= bob;
  j.ky -= bob;
  return j;
}
function running(step: number): Joints {
  const j = mixJoints(GATHER, EXTEND, 0.5 + 0.5 * Math.sin(step));
  const lift = Math.max(0, Math.sin(step)) * 2.5;
  for (const key of ['hy', 'sy', 'ky', 'bfy', 'bny', 'ffy', 'fny'] as const) j[key] -= lift;
  return j;
}
const climbing = (step: number) => mixJoints(CLIMB_A, CLIMB_B, 0.5 + 0.5 * Math.sin(step));

type Look = {
  size?: number;
  facing?: 1 | -1;
  lean?: number;
  eyes?: 'open' | 'wide' | 'happy' | 'closed' | 'sad' | 'glare' | 'sleepy';
  /** 0 = slit pupils, 1 = saucers. */
  pupil?: number;
  look?: readonly [number, number];
  mouth?: 'w' | 'o' | 'meow' | 'smile' | 'yawn';
  yawn?: number;
  /** 0 = ears up, 1 = flat. */
  ears?: number;
  /** Tail wrapped round the paws (sitting and curled up). */
  wrap?: boolean;
  sway?: number;
  wet?: number;
  puff?: number;
  seconds?: number;
  /** Painted in world space in front of the body, behind the wrapped tail: the star. */
  nestle?: () => void;
};
/**
 * Miso in profile: a plump ginger tabby with a white chest and socks, big eyes, and a tail
 * with a crooked tip. (x, y) is the ground under her; she faces right unless told otherwise.
 */
function miso(ctx: Ctx, x: number, y: number, j: Joints, f: Look = {}) {
  const s = f.size ?? 1,
    dir = f.facing ?? 1,
    lean = f.lean ?? 0;
  const wet = clamp(f.wet ?? 0),
    puff = clamp(f.puff ?? 0),
    seconds = f.seconds ?? 0;
  const fur = mix(FUR, WET, wet),
    furD = mix(FUR_D, WET_D, wet),
    furS = mix(FUR_S, WET_D, wet * 0.8);
  const c = Math.cos(lean),
    sn = Math.sin(lean);
  const toWorld = (px: number, py: number): Pt => ({
    x: x + dir * s * (px * c - py * sn),
    y: y + s * (px * sn + py * c),
  });
  const apply = () => {
    ctx.translate(x, y);
    ctx.scale(dir * s, s);
    ctx.rotate(lean);
  };
  const dx = j.sx - j.hx,
    dy = j.sy - j.hy;
  const len = Math.max(0.1, Math.hypot(dx, dy)),
    angle = Math.atan2(dy, dx);
  const ux = dx / len,
    uy = dy / len,
    nx = uy,
    ny = -ux;
  const cx = (j.hx + j.sx) / 2,
    cy = (j.hy + j.sy) / 2;
  const half = len / 2 + 5.5,
    ry = j.ry + puff * 1.8;
  const hip = { x: j.hx - nx * ry * 0.3, y: j.hy - ny * ry * 0.3 },
    shoulder = { x: j.sx - nx * ry * 0.3, y: j.sy - ny * ry * 0.3 };
  const leg = (from: Pt, px: number, py: number, color: string) => {
    line(ctx, color, 3.4, [from.x, from.y, px, py]);
    oval(ctx, px, py - 0.7, 2.1, 1.5, CREAM);
  };
  const raised = j.fny < j.sy - 4;

  ctx.save();
  apply();
  // Far legs, then the tail behind the body.
  leg(hip, j.bfx, j.bfy, furS);
  leg(shoulder, j.ffx, j.ffy, furS);
  if (!f.wrap) {
    const points = [
      cx - ux * (half - 2.5) + nx * ry * 0.25,
      cy - uy * (half - 2.5) + ny * ry * 0.25,
    ];
    let a = j.tail + (f.sway ?? 0);
    for (let i = 0; i < 6; i++) {
      if (i === 5) a += 1.05;
      const px = points[points.length - 2],
        py = points[points.length - 1];
      points.push(px - Math.cos(a) * 2.7, py - Math.sin(a) * 2.7);
      a += j.curl;
    }
    const width = 3.2 * (1 + puff * 0.7);
    line(ctx, fur, width, points);
    for (const i of [1, 3, 5]) line(ctx, furD, width, points.slice(i * 2, i * 2 + 4));
  }
  // Body: a plump oval with tabby stripes over the back and a white chest.
  oval(ctx, cx, cy, half, ry, fur, angle);
  if (puff > 0.05 || wet > 0.3)
    for (let i = 0; i < 5; i++) {
      const t = -0.62 + i * 0.3;
      const bx = cx + ux * half * t + nx * ry * 0.85,
        by = cy + uy * half * t + ny * ry * 0.85;
      const reach = 1.8 + puff * 1.8;
      poly(ctx, fur, [
        bx - ux * 1.6,
        by - uy * 1.6,
        bx + nx * reach - ux * 1.2,
        by + ny * reach - uy * 1.2,
        bx + ux * 1.6,
        by + uy * 1.6,
      ]);
    }
  for (const t of [-0.45, -0.12, 0.2]) {
    const tx = cx + ux * half * t + nx * ry * 0.95,
      ty = cy + uy * half * t + ny * ry * 0.95;
    line(ctx, furD, 1.6, [tx, ty, tx - nx * 3.4, ty - ny * 3.4]);
  }
  oval(
    ctx,
    cx + ux * half * 0.55 - nx * ry * 0.22,
    cy + uy * half * 0.55 - ny * ry * 0.22,
    ry * 0.62,
    ry * 0.72,
    CREAM,
    angle,
  );
  oval(ctx, hip.x - ux * 0.5, hip.y + 0.5, 5.2, 5.6, fur, angle);
  line(ctx, alpha(furD, 0.7), 1.2, [hip.x - 3, hip.y - 2, hip.x - 1, hip.y + 1]);
  leg(hip, j.bnx, j.bny, fur);
  if (!raised) leg(shoulder, j.fnx, j.fny, fur);
  // Head.
  ctx.save();
  ctx.translate(j.kx, j.ky);
  ctx.rotate(j.tilt);
  catHead(ctx, f, fur, furD, furS, seconds);
  ctx.restore();
  if (raised) leg(shoulder, j.fnx, j.fny, fur);
  // Drips off a soaked cat.
  if (wet > 0.3)
    for (let i = 0; i < 4; i++) {
      const fall = (seconds * 1.3 + i * 0.29) % 1;
      box(ctx, cx - 5 + i * 3.4, cy + ry - 1 + fall * 7, 1, 1.6, alpha('#A9DAF2', 1 - fall));
    }
  if (f.nestle) {
    ctx.restore();
    f.nestle();
    ctx.save();
    apply();
  }
  if (f.wrap) {
    const tail = [
      j.hx - 5,
      j.hy + 1,
      j.hx - 7.5,
      j.hy + 4,
      j.hx - 5,
      j.hy + 6.2,
      j.hx + 1,
      j.hy + 6.8,
      j.hx + 7,
      j.hy + 6.6,
      j.hx + 11.5,
      j.hy + 5.6,
      j.hx + 13.2,
      j.hy + 3,
    ];
    line(ctx, fur, 3.2, tail);
    for (const i of [1, 3, 5]) line(ctx, furD, 3.2, tail.slice(i * 2, i * 2 + 4));
  }
  ctx.restore();
  return { paw: toWorld(j.fnx, j.fny), head: toWorld(j.kx, j.ky) };
}
function catHead(ctx: Ctx, f: Look, fur: string, furD: string, furS: string, seconds: number) {
  const ears = f.ears ?? 0;
  const ear = (bx: number, by: number, a: number, color: string) => {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(a);
    poly(ctx, color, [-2.8, 0.5, -0.4, -6.6, 2.8, 0.5]);
    poly(ctx, PINK, [-1.4, -0.2, -0.4, -4.6, 1.4, -0.2]);
    ctx.restore();
  };
  ear(-3.6, -4.4, -0.35 - ears * 0.95, furS);
  oval(ctx, 0, 0, 7.6, 6.9, fur);
  oval(ctx, -0.5, 2.6, 8.2, 4.6, fur);
  poly(ctx, fur, [-7.5, 1.5, -10, 4.8, -6.5, 5.2]);
  ear(2.6, -5.6, 0.2 - ears * 1.05, fur);
  if ((f.wet ?? 0) > 0.3 || (f.puff ?? 0) > 0.05)
    for (const tx of [-3, 0, 3]) poly(ctx, fur, [tx - 1.5, -6, tx, -9, tx + 1.5, -6]);
  box(ctx, -0.8, -6.8, 1.2, 2.6, furD);
  box(ctx, 1.6, -7, 1.2, 2.8, furD);
  box(ctx, 3.9, -6.4, 1.1, 2.2, furD);
  line(ctx, furD, 1, [-6.5, 1, -4, 1.6]);
  oval(ctx, 4.6, 2.4, 3.7, 2.5, CREAM);
  oval(ctx, 4.2, 4.3, 2.4, 1.3, CREAM);
  // Eyes: the far one a little narrower.
  const style = f.eyes ?? 'open';
  const [lx, ly] = f.look ?? [0, 0];
  for (const [ex, k] of [
    [0.2, 0.8],
    [4.6, 1],
  ] as const) {
    const ey = -1.3;
    if (style === 'happy')
      arc(ctx, INK, 0.9, ex, ey + 1, 1.9 * k, 1.6, Math.PI * 1.15, Math.PI * 1.85);
    else if (style === 'closed')
      arc(ctx, INK, 0.9, ex, ey, 1.9 * k, 1.2, Math.PI * 0.15, Math.PI * 0.85);
    else {
      const big = style === 'wide' ? 1.15 : 1;
      oval(ctx, ex, ey, 2.3 * k * big, 2.8 * big, INK);
      oval(ctx, ex, ey, 1.8 * k * big, 2.3 * big, EYE);
      const pw = style === 'wide' ? 0.55 : 0.45 + (f.pupil ?? 0.35) * 1.15;
      oval(ctx, ex + lx * 0.6, ey + ly * 0.5, pw * k, 2 * big, PUPIL);
      box(ctx, ex - 1 + lx * 0.3, ey - 1.7, 0.9, 0.9, '#FFFFFF');
      const lid =
        style === 'sleepy'
          ? [-0.4, -0.4]
          : style === 'glare'
            ? [-1.3, 0.2]
            : style === 'sad'
              ? [0.1, -1.4]
              : null;
      if (lid) {
        poly(ctx, fur, [
          ex - 2.7,
          ey - 3.3,
          ex + 2.7,
          ey - 3.3,
          ex + 2.7,
          ey + lid[1],
          ex - 2.7,
          ey + lid[0],
        ]);
        line(ctx, INK, 0.7, [ex - 2.3 * k, ey + lid[0], ex + 2.3 * k, ey + lid[1]]);
      }
    }
  }
  poly(ctx, NOSE, [6.6, 0.4, 8.4, 0.4, 7.5, 1.5]);
  const yawn = f.yawn ?? 0;
  switch (f.mouth ?? 'w') {
    case 'w':
      line(ctx, INK, 0.6, [7.5, 1.5, 7.5, 2.5, 6.5, 3.1]);
      line(ctx, INK, 0.6, [7.5, 2.5, 8.4, 3.1]);
      break;
    case 'o':
      oval(ctx, 7.2, 3.5, 0.9, 1.1, INK);
      break;
    case 'meow':
      poly(ctx, INK, [6.1, 2.6, 8.7, 2.6, 7.6, 5.4]);
      oval(ctx, 7.4, 4.4, 0.8, 0.5, PINK);
      break;
    case 'smile':
      oval(ctx, 7, 3.2, 1.5, 1.3, INK);
      oval(ctx, 7, 3.8, 0.9, 0.6, PINK);
      break;
    case 'yawn':
      oval(ctx, 6.4, 3.4 + yawn * 1.4, 1.8 + yawn * 2, 1 + yawn * 3, '#5A1D24');
      oval(ctx, 6.4, 4.2 + yawn * 3, 1 + yawn * 1.2, yawn * 1.1, PINK);
      break;
  }
  const whisker = alpha('#FFF6E8', 0.75);
  line(ctx, whisker, 0.4, [8, 2.6, 13, 1.3]);
  line(ctx, whisker, 0.4, [8, 3.2, 13, 4.3 + Math.sin(seconds * 3) * 0.3]);
}

// ——— Miso, face on (for the close-ups) ———
type Face = {
  eyes?: 'open' | 'wide' | 'sad' | 'happy' | 'closed' | 'glare';
  /** Sleepy lids, 0..1. */
  lids?: number;
  pupil?: number;
  look?: readonly [number, number];
  mouth?: 'w' | 'o' | 'frown' | 'smile' | 'yawn';
  yawn?: number;
  ears?: number;
  wet?: number;
  /** The moon reflected in her eyes. */
  shine?: number;
  tilt?: number;
  seconds?: number;
};
function misoFace(ctx: Ctx, x: number, y: number, s: number, f: Face) {
  const wet = clamp(f.wet ?? 0),
    ears = f.ears ?? 0,
    seconds = f.seconds ?? 0;
  const fur = mix(FUR, WET, wet),
    furD = mix(FUR_D, WET_D, wet);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Shoulders and chest.
  oval(ctx, 0, 26, 22, 14, fur);
  oval(ctx, 0, 24, 9.5, 11, CREAM);
  ctx.rotate(f.tilt ?? 0);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 9.5, -8.5);
    ctx.rotate(side * (0.22 + ears * 1.05));
    poly(ctx, fur, [-4.6, 1.5, side * 0.6, -10, 4.6, 1.5]);
    poly(ctx, PINK, [-2.5, 0.5, side * 0.4, -6.6, 2.5, 0.5]);
    ctx.restore();
  }
  oval(ctx, 0, 0, 16, 13.5, fur);
  for (const side of [-1, 1]) {
    poly(ctx, fur, [side * 14, 1, side * 19.5, 5.5, side * 15, 7, side * 18, 10.5, side * 11, 10]);
    line(ctx, furD, 1.1, [side * 15.6, -1, side * 11.5, 0.2]);
    line(ctx, furD, 1.1, [side * 15.8, 3, side * 12.2, 3.4]);
  }
  if (wet > 0.3)
    for (const tx of [-7, -2.5, 2.5, 7])
      poly(ctx, fur, [tx - 2.4, -12, tx + (tx > 0 ? 1 : -1), -16.5, tx + 2.4, -12]);
  box(ctx, -0.9, -13.4, 1.8, 5.6, furD);
  box(ctx, -5.2, -12.4, 1.6, 4.2, furD);
  box(ctx, 3.6, -12.4, 1.6, 4.2, furD);
  const style = f.eyes ?? 'open',
    lids = clamp(f.lids ?? 0);
  const [lx, ly] = f.look ?? [0, 0];
  for (const side of [-1, 1]) {
    const ex = side * 6.4,
      ey = -1.6;
    if (style === 'happy')
      arc(ctx, INK, 1.2, ex, ey + 1.6, 3.4, 2.8, Math.PI * 1.15, Math.PI * 1.85);
    else if (style === 'closed' || lids > 0.85)
      arc(ctx, INK, 1.2, ex, ey + 0.4, 3.4, 2.2, Math.PI * 0.12, Math.PI * 0.88);
    else {
      const big = style === 'wide' ? 1.12 : 1;
      oval(ctx, ex, ey, 4.4 * big, 5 * big, INK);
      oval(ctx, ex, ey, 3.7 * big, 4.3 * big, EYE);
      const pw = style === 'wide' ? 1.1 : 1.1 + (f.pupil ?? 0.35) * 2;
      const px = ex + lx * 1.3,
        py = ey + ly * 1.2;
      oval(ctx, px, py, pw, 3.9 * big, PUPIL);
      if ((f.shine ?? 0) > 0) disc(ctx, px + 0.3, py - 1.2, 1.2, alpha(MOON, f.shine ?? 0));
      box(ctx, ex - 2.2 + lx * 0.8, ey - 3.2, 1.6, 1.6, '#FFFFFF');
      box(ctx, ex + 1 + lx * 0.8, ey + 1.4, 0.9, 0.9, '#FFFFFF');
      const inner = ex - side * 4.9,
        outer = ex + side * 4.9;
      let lidIn = -9,
        lidOut = -9;
      if (style === 'sad') [lidIn, lidOut] = [ey - 3.4, ey - 0.4];
      else if (style === 'glare') [lidIn, lidOut] = [ey + 0.2, ey - 2.8];
      if (lids > 0) [lidIn, lidOut] = [ey - 5.6 + lids * 8.4, ey - 5.6 + lids * 8.4];
      if (lidIn > -9) {
        poly(ctx, fur, [inner, ey - 5.8, outer, ey - 5.8, outer, lidOut, inner, lidIn]);
        line(ctx, INK, 1, [inner, lidIn, outer, lidOut]);
      }
    }
    oval(ctx, side * 10, 4.6, 2.4, 1.2, alpha(PINK, 0.6));
  }
  oval(ctx, -2.8, 5.4, 3.8, 2.9, CREAM);
  oval(ctx, 2.8, 5.4, 3.8, 2.9, CREAM);
  oval(ctx, 0, 8.4, 2.8, 1.6, CREAM);
  poly(ctx, NOSE, [-1.9, 2.6, 1.9, 2.6, 0, 4.6]);
  const yawn = f.yawn ?? 0;
  switch (f.mouth ?? 'w') {
    case 'w':
      line(ctx, INK, 0.9, [0, 4.6, 0, 6.2, -2.4, 7.3]);
      line(ctx, INK, 0.9, [0, 6.2, 2.4, 7.3]);
      break;
    case 'o':
      oval(ctx, 0, 7.6, 1.6, 1.9, INK);
      break;
    case 'frown':
      line(ctx, INK, 0.9, [0, 4.6, 0, 6.6]);
      arc(ctx, INK, 0.9, 0, 9, 2.4, 1.8, Math.PI * 1.15, Math.PI * 1.85);
      break;
    case 'smile':
      poly(ctx, INK, [-3, 6.2, 3, 6.2, 0, 9.6]);
      oval(ctx, 0, 8.3, 1.3, 0.9, PINK);
      break;
    case 'yawn': {
      const w = 2.5 + yawn * 4.8,
        h = 1.5 + yawn * 6.8,
        my = 6.6 + yawn * 3.2;
      oval(ctx, 0, my, w, h, '#5A1D24');
      oval(ctx, 0, my + h * 0.55, w * 0.6, h * 0.35, PINK);
      if (yawn > 0.3)
        for (const side of [-1, 1])
          poly(ctx, '#FFFFFF', [
            side * w * 0.55,
            my - h * 0.8,
            side * w * 0.35,
            my - h * 0.8,
            side * w * 0.45,
            my - h * 0.5,
          ]);
      break;
    }
  }
  const whisker = alpha('#FFF6E8', 0.8);
  for (const side of [-1, 1])
    for (const k of [0, 1, 2])
      line(ctx, whisker, 0.5, [
        side * 6,
        5 + k * 1.2,
        side * 19,
        2.5 + k * 3 + Math.sin(seconds * 2 + k) * 0.4,
      ]);
  if (wet > 0.3)
    for (let i = 0; i < 3; i++) {
      const fall = (seconds * 1.1 + i * 0.37) % 1;
      box(ctx, -10 + i * 9, 11 + fall * 16, 1, 2, alpha('#A9DAF2', 1 - fall));
    }
  ctx.restore();
}

// ——— Forktown by night ———
const WALLS = ['#2E3960', '#3A3559', '#2A4058', '#3B3A62'];
const ROOFS = ['#553250', '#3E3156', '#5C3B3E', '#46355C'];
type House = { x0: number; x1: number; ridge: number; eave: number; tone: number; seed: number };
/** A pitched roof seen side on, so a cat can walk its ridge, over a wall of warm windows. */
function house(ctx: Ctx, h: House, lit = 1, bottom = H) {
  const wall = WALLS[h.tone % 4],
    roof = ROOFS[h.tone % 4];
  const frame = mix(wall, '#05060C', 0.35);
  box(ctx, h.x0, h.eave, h.x1 - h.x0, bottom - h.eave, wall);
  box(ctx, h.x0, h.eave, 3, bottom - h.eave, mix(wall, '#05060C', 0.3));
  const cols = Math.max(1, Math.floor((h.x1 - h.x0 - 8) / 20));
  const gap = (h.x1 - h.x0) / cols;
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < 3; r++) {
      const wx = h.x0 + gap * (c + 0.5) - 4,
        wy = h.eave + 8 + r * 22;
      if (wy > bottom - 12) continue;
      const on = rand(h.seed + c * 3 + r * 7) < 0.75 * lit;
      box(ctx, wx - 1, wy - 1, 10, 13, frame);
      box(ctx, wx, wy, 8, 11, on ? LAMP : '#1A2040');
      if (on) {
        glow(ctx, wx + 4, wy + 6, 16, LAMP, 0.16);
        box(ctx, wx, wy + 7, 8, 4, '#F2A95A');
      }
      box(ctx, wx + 3.5, wy, 1, 11, frame);
    }
  const slope = (h.eave - h.ridge) * 0.8;
  poly(ctx, roof, [
    h.x0 - 5,
    h.eave + 1,
    h.x0 - 5 + slope,
    h.ridge,
    h.x1 + 5 - slope,
    h.ridge,
    h.x1 + 5,
    h.eave + 1,
  ]);
  const dark = mix(roof, '#05060C', 0.3);
  for (let yy = h.ridge + 4; yy < h.eave; yy += 4) {
    const k = (yy - h.ridge) / (h.eave - h.ridge);
    box(ctx, h.x0 - 5 + slope * (1 - k), yy, h.x1 - h.x0 + 10 - 2 * slope * (1 - k), 1, dark);
  }
  box(
    ctx,
    h.x0 - 5 + slope,
    h.ridge - 1,
    h.x1 - h.x0 + 10 - 2 * slope,
    2,
    mix(roof, '#C9C8F0', 0.35),
  );
}
function chimney(ctx: Ctx, x: number, top: number, w: number, base: number) {
  box(ctx, x, top, w, base - top, '#6A3C3C');
  box(ctx, x, top, 2, base - top, '#8A5550');
  for (let yy = top + 5; yy < base; yy += 5) box(ctx, x, yy, w, 1, '#56302F');
  box(ctx, x - 1.5, top - 2, w + 3, 3, '#8E5E54');
}
/** A roof aerial that sways by `wob` radians around its foot. */
function antenna(ctx: Ctx, x: number, base: number, top: number, wob: number) {
  const h = base - top,
    color = '#9AA2C0';
  ctx.save();
  ctx.translate(x, base);
  ctx.rotate(wob);
  line(ctx, color, 1.5, [0, 0, 0, -h]);
  for (const [k, w] of [
    [0.08, 22],
    [0.22, 17],
    [0.36, 12],
  ])
    line(ctx, color, 1, [-w / 2, -h + h * k, w / 2, -h + h * k]);
  line(ctx, color, 1, [-5, 0, 0, -9, 5, 0]);
  ctx.restore();
}
const antennaTip = (x: number, base: number, top: number, wob: number): Pt => ({
  x: x + Math.sin(wob) * (base - top),
  y: base - Math.cos(wob) * (base - top),
});
/** A far row of rooftops in screen space; `shift` scrolls it for parallax. */
function skyline(
  ctx: Ctx,
  base: number,
  color: string,
  shift: number,
  seed: number,
  scale = 1,
  lights = 0.4,
) {
  const slot = 26 * scale;
  for (let i = Math.floor(shift / slot) - 1; i * slot - shift < W + slot; i++) {
    const x = i * slot - shift,
      h = (8 + rand(seed + i) * 16) * scale,
      w = slot * (0.8 + rand(seed + i * 2) * 0.3);
    box(ctx, x, base - h, w, H - base + h, color);
    poly(ctx, color, [
      x - 2 * scale,
      base - h + 1,
      x + w / 2,
      base - h - 7 * scale,
      x + w + 2 * scale,
      base - h + 1,
    ]);
    if (rand(seed + i * 5) < lights)
      box(ctx, x + w * 0.3, base - h + 4 * scale, 2 * scale, 2.5 * scale, alpha(LAMP, 0.85));
    if (rand(seed + i * 7) < lights)
      box(ctx, x + w * 0.62, base - h + 9 * scale, 2 * scale, 2.5 * scale, alpha(LAMP, 0.7));
  }
}

// The rooftop set, left to right: Miso's ridge, the rain barrel, the chimney, the aerial,
// and the Stargazer Station. The sky is painted in screen space, so the world has no top.
const HOUSE_A: House = { x0: 0, x1: 108, ridge: 116, eave: 130, tone: 0, seed: 11 };
const HOUSE_B: House = { x0: 176, x1: 270, ridge: 104, eave: 120, tone: 1, seed: 23 };
const HOUSE_C: House = { x0: 282, x1: 372, ridge: 110, eave: 124, tone: 2, seed: 37 };
const HOUSE_D: House = { x0: 530, x1: 620, ridge: 118, eave: 132, tone: 3, seed: 41 };
const BARREL = { x: 140, y: 142 };
const CHIMNEY_B = { x: 226, top: 84 };
const MAST = { x: 336, base: 110, top: 56 };
const DOME = { x: 456, y: 104, rx: 52, ry: 44 };
const SCOPE = { x0: 468, y0: 72, x1: 508, y1: 47 };
const RIDGE_END = 98;
/** A point on top of the telescope tube, 0 at the eyepiece and 1 at the lens. */
function onScope(t: number): Pt {
  const dx = SCOPE.x1 - SCOPE.x0,
    dy = SCOPE.y1 - SCOPE.y0,
    len = Math.hypot(dx, dy);
  return { x: SCOPE.x0 + dx * t + (dy / len) * 3.5, y: SCOPE.y0 + dy * t - (dx / len) * 3.5 };
}
const SCOPE_TILT = Math.atan2(SCOPE.y1 - SCOPE.y0, SCOPE.x1 - SCOPE.x0);
const domeY = (x: number) =>
  DOME.y - DOME.ry * Math.sqrt(Math.max(0, 1 - ((x - DOME.x) / DOME.rx) ** 2));

function station(ctx: Ctx) {
  box(ctx, 404, DOME.y, 104, H - DOME.y, '#34466E');
  for (const sx of [412, 436, 474, 498]) box(ctx, sx, DOME.y + 6, 2, H - DOME.y, '#2A395E');
  for (const wx of [424, 456, 488]) {
    disc(ctx, wx, 128, 5.5, '#1E2748');
    disc(ctx, wx, 128, 4.2, LAMP);
    glow(ctx, wx, 128, 16, LAMP, 0.18);
  }
  box(ctx, 448, 150, 16, 30, '#1E2748');
  box(ctx, 450, 152, 12, 28, '#6B4A3A');
  box(ctx, 398, DOME.y - 3, 116, 4, '#5C6E98');
  for (let x = 400; x < 514; x += 6) box(ctx, x, DOME.y - 8, 1, 6, '#5C6E98');
  box(ctx, 398, DOME.y - 9, 116, 1, '#5C6E98');
  // The blue dome, lit from the moon's side.
  ctx.fillStyle = '#3F74B8';
  ctx.beginPath();
  ctx.ellipse(DOME.x, DOME.y, DOME.rx, DOME.ry, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = '#5A93D4';
  ctx.beginPath();
  ctx.ellipse(DOME.x + 8, DOME.y, DOME.rx * 0.78, DOME.ry * 0.94, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = '#7FB2EA';
  ctx.beginPath();
  ctx.ellipse(DOME.x + 20, DOME.y, DOME.rx * 0.4, DOME.ry * 0.8, 0, Math.PI, TAU);
  ctx.fill();
  for (const k of [0.34, 0.68])
    arc(ctx, '#2F5C98', 1, DOME.x, DOME.y, DOME.rx * k, DOME.ry, Math.PI, TAU);
  poly(ctx, '#18203C', [
    DOME.x - 5,
    DOME.y - DOME.ry + 1,
    DOME.x + 5,
    DOME.y - DOME.ry + 1,
    474,
    84,
    462,
    84,
  ]);
  // The telescope pokes out of the slot toward the sky.
  line(ctx, '#C9CEDF', 7, [SCOPE.x0, SCOPE.y0, SCOPE.x1, SCOPE.y1]);
  line(ctx, '#EEF1F8', 2, [SCOPE.x0 - 1, SCOPE.y0 - 3, SCOPE.x1 - 1, SCOPE.y1 - 3]);
  for (const t of [0.35, 0.7]) {
    const bx = lerp(SCOPE.x0, SCOPE.x1, t),
      by = lerp(SCOPE.y0, SCOPE.y1, t);
    line(ctx, '#7D86A6', 8, [bx - 1, by + 0.6, bx + 1, by - 0.6]);
  }
  disc(ctx, SCOPE.x1 + 1, SCOPE.y1 - 0.5, 4.6, '#7D86A6');
  disc(ctx, SCOPE.x1 + 2, SCOPE.y1 - 1, 3, '#23304F');
  disc(ctx, SCOPE.x0 - 2, SCOPE.y0 + 1.5, 2.5, '#7D86A6');
}
function roofSet(ctx: Ctx, p: number, wob: number) {
  house(ctx, HOUSE_A);
  chimney(ctx, 28, 100, 10, 118);
  box(ctx, 108, 162, 70, 18, '#2B3352');
  box(ctx, 106, 160, 74, 3, '#4B4E72');
  chimney(ctx, CHIMNEY_B.x, CHIMNEY_B.top, 14, 110);
  house(ctx, HOUSE_B);
  house(ctx, HOUSE_C);
  antenna(ctx, MAST.x, MAST.base, MAST.top, wob);
  station(ctx);
  house(ctx, HOUSE_D);
  chimney(ctx, 580, 104, 10, 122);
  barrelBack(ctx, p);
}
function barrelBack(ctx: Ctx, p: number) {
  const { x, y } = BARREL;
  oval(ctx, x, y, 12.5, 3.4, '#7A5C48');
  oval(ctx, x, y + 0.4, 10.6, 2.6, '#1B2A52');
  // The moon's reflection shatters into slivers and slowly gathers itself again.
  const spread = p < SPLASH ? 0 : 1 - ease(span(p, SPLASH + 0.012, SPLASH + 0.03));
  if (spread <= 0.02) {
    glow(ctx, x + 2, y + 0.4, 12, MOON, 0.35);
    oval(ctx, x + 2, y + 0.4, 3.4, 1.2, MOON);
  } else
    for (let i = 0; i < 6; i++) {
      const off = (rand(i + 3) - 0.5) * 16 * spread;
      box(
        ctx,
        x + 2 + off - 1,
        y - 0.6 + (i % 3) * 0.8,
        2 + (1 - spread) * 2,
        0.8,
        alpha(MOON, 0.9),
      );
    }
  if (p >= SPLASH) {
    const t = span(p, SPLASH, SPLASH + 0.035);
    for (let k = 0; k < 3; k++) {
      const r = ((t * 3 + k / 3) % 1) * 10;
      if (t < 1) arc(ctx, alpha('#AFC6EE', (1 - t) * 0.8), 0.6, x, y + 0.4, r, r * 0.24, 0, TAU);
    }
  }
}
function barrelFront(ctx: Ctx) {
  const { x, y } = BARREL;
  poly(ctx, '#5E4636', [x - 12.5, y, x + 12.5, y, x + 11, y + 20, x - 11, y + 20]);
  box(ctx, x - 12, y + 1, 5, 19, '#4C3A2E');
  box(ctx, x - 12.5, y + 4, 25, 2, '#8B8F9C');
  box(ctx, x - 11.5, y + 14, 23, 2, '#8B8F9C');
  arc(ctx, '#8E6E58', 1.2, x, y, 12.5, 3.4, 0, Math.PI);
}
function splashDrops(ctx: Ctx, p: number) {
  const t = (p - SPLASH) * STORY;
  if (t < 0 || t > 0.9) return;
  for (let i = 0; i < 16; i++) {
    const vx = (rand(i * 1.7) - 0.5) * 70,
      vy = 50 + rand(i * 2.3) * 70;
    const x = BARREL.x + vx * t,
      y = BARREL.y - vy * t + 160 * t * t;
    if (y < BARREL.y + 4) box(ctx, x, y, 1.5, 2, alpha('#BFE3F6', 1 - t));
  }
  if (t < 0.3)
    oval(ctx, BARREL.x, BARREL.y - 6 * (1 - t / 0.3), 7, 9 * (1 - t / 0.3), alpha('#CFEAF7', 0.8));
}

// ——— Act one and two: Miso on the rooftops ———
const MOON_AT = { x: 256, y: 38, r: 16 };
function wobbleAt(p: number) {
  if (p < WOBBLE || p > JUMP_DOME + 0.01) return 0;
  const t = (p - WOBBLE) * STORY;
  return Math.sin(t * 7) * 0.1 * (1 - span(p, WOBBLE, JUMP_DOME + 0.01) * 0.6);
}
function roofCast(ctx: Ctx, p: number, seconds: number) {
  const size = 1.3;
  const sway = Math.sin(seconds * 2) * 0.15;
  const base = { size, seconds, sway };
  if (p < POUNCE) {
    // Stroll the ridge, spot the reflection, crouch, and wiggle.
    const walk = Math.min(1, p / SPOT);
    const x = lerp(18, RIDGE_END, 1 - (1 - walk) ** 1.4);
    const spotted = p >= SPOT;
    const crouch = ease(span(p, CROUCH_AT - 0.004, CROUCH_AT));
    const wiggle = span(p, CROUCH_AT + 0.002, POUNCE - 0.002);
    const j = spotted ? mixJoints({ ...STAND, tilt: 0.35 }, CROUCH, crouch) : walking(x * 0.55);
    if (wiggle > 0) j.hx += Math.sin(seconds * 26) * wiggle * 1.4;
    miso(ctx, x, HOUSE_A.ridge - 1, j, {
      ...base,
      eyes: spotted ? 'wide' : 'open',
      pupil: spotted ? 1 : 0.35,
      look: spotted ? [0.8, 1] : [1, 0],
      mouth: within(p, SPOT + 0.003, SPOT + 0.01) ? 'meow' : 'w',
      sway: wiggle > 0 ? Math.sin(seconds * 9) * 0.35 : sway,
    });
    return;
  }
  if (p < SURFACE) {
    if (p < SPLASH) {
      // The pounce: a flying cat, aimed at the moon in the water.
      const t = span(p, POUNCE, SPLASH);
      const at = lob(
        { x: RIDGE_END, y: HOUSE_A.ridge - 1 },
        { x: BARREL.x - 2, y: BARREL.y + 6 },
        t,
        6,
      );
      miso(ctx, at.x, at.y, mixJoints(CROUCH, LEAP, ease(t * 3)), {
        ...base,
        lean: lerp(-0.25, 1, easeIn(t)),
        eyes: 'wide',
        pupil: 1,
        look: [1, 1],
        mouth: 'o',
      });
    } else {
      // Under the water: only the crooked tail tip, and bubbles.
      const t = (p - SPLASH) * STORY;
      const tip = BARREL.y - 3 - Math.sin(t * 9) * 1.5;
      line(ctx, WET, 2.6, [BARREL.x + 3, BARREL.y + 1, BARREL.x + 4, tip, BARREL.x + 6, tip - 1.5]);
      for (let i = 0; i < 3; i++) {
        const rise = (t * 1.6 + i * 0.33) % 1;
        disc(ctx, BARREL.x - 4 + i * 4, BARREL.y - rise * 6, 1, alpha('#CFEAF7', 1 - rise));
      }
    }
    return;
  }
  if (p < at('lookup')) {
    // Up she comes, soaked, and settles on the rim to glare at it.
    const climb = ease(span(p, SURFACE + 0.004, SURFACE + 0.008));
    const rise = easeOut(span(p, SURFACE, SURFACE + 0.004));
    const x = lerp(BARREL.x + 1, BARREL.x - 7, climb),
      y = lerp(BARREL.y + 22 - rise * 8, BARREL.y - 1, climb);
    const grumble = within(p, GLARE + 0.004, GLARE + 0.009);
    miso(
      ctx,
      x,
      y,
      { ...SIT, tilt: 0.25 },
      {
        ...base,
        wet: 1,
        wrap: climb > 0.9,
        ears: p < GLARE ? 1 : 0.55,
        eyes: p < SURFACE + 0.006 ? 'closed' : 'glare',
        look: [0.7, 1],
        mouth: grumble ? 'meow' : 'w',
      },
    );
    return;
  }
  if (p < at('antenna')) {
    // Up the chimney.
    const ridge = HOUSE_B.ridge - 1;
    if (p < CLAWS[0]) {
      const x = lerp(202, CHIMNEY_B.x - 5, span(p, at('chimney'), CLAWS[0]));
      miso(ctx, x, ridge, walking(x * 0.6), { ...base, look: [1, -0.5] });
    } else if (p < TOP_CHIMNEY) {
      const t = span(p, CLAWS[0], TOP_CHIMNEY);
      miso(ctx, CHIMNEY_B.x - 5, lerp(ridge, CHIMNEY_B.top + 3, t), climbing(t * 14), {
        ...base,
        look: [0.4, -1],
        sway: -0.3,
      });
    } else {
      const up = ease(span(p, TOP_CHIMNEY, TOP_CHIMNEY + 0.003));
      const reach = hump(p, 0.167, 0.176);
      const x = lerp(CHIMNEY_B.x - 3, CHIMNEY_B.x + 6, up),
        y = lerp(CHIMNEY_B.top + 3, CHIMNEY_B.top - 2, up);
      const j = mixJoints(SIT, { ...REAR, fnx: 9, fny: -30 }, reach);
      miso(
        ctx,
        x,
        y,
        { ...j, tilt: -0.45 },
        {
          ...base,
          wrap: reach < 0.2,
          look: [0.8, -1],
          pupil: 0.8,
          ears: p > 0.176 ? 0.35 : 0,
          mouth: reach > 0.5 ? 'o' : 'w',
        },
      );
    }
    return;
  }
  if (p < JUMP_DOME) {
    // Up the aerial, which does not like it.
    const wob = wobbleAt(p);
    if (p < WOBBLE) {
      const t = span(p, at('antenna'), WOBBLE);
      miso(ctx, MAST.x - 5, lerp(MAST.base - 1, MAST.top + 4, t), climbing(t * 16), {
        ...base,
        look: [0.3, -1],
        sway: -0.3,
      });
    } else {
      const tip = antennaTip(MAST.x, MAST.base, MAST.top, wob);
      const crouching = ease(span(p, at('dome'), at('dome') + 0.003));
      const reach = hump(p, WOBBLE + 0.003, at('dome'));
      const j = mixJoints(
        mixJoints(REAR, { ...REAR, fnx: 10, fny: -31 }, reach),
        { ...CROUCH, tilt: 0 },
        crouching,
      );
      miso(ctx, tip.x, tip.y, j, {
        ...base,
        lean: wob * 1.5,
        eyes: crouching > 0.5 ? 'open' : 'wide',
        pupil: 0.9,
        look: crouching > 0.5 ? [1, 0.2] : [0.7, -1],
        sway: Math.sin(seconds * 11) * 0.5,
        mouth: reach > 0.4 ? 'o' : 'w',
      });
    }
    return;
  }
  if (p < at('swipe')) {
    // The leap to the dome, a scrabble up it, and a walk up the telescope.
    if (p < LAND_DOME) {
      const t = span(p, JUMP_DOME, LAND_DOME);
      const from = antennaTip(MAST.x, MAST.base, MAST.top, wobbleAt(p));
      const to = { x: 420, y: domeY(420) };
      const at2 = lob(from, to, t, 16);
      miso(ctx, at2.x, at2.y, mixJoints(LEAP, STAND, easeIn(t)), {
        ...base,
        lean: lerp(-0.2, 0.3, t),
        eyes: 'wide',
        pupil: 1,
        look: [1, 0.3],
      });
    } else if (p < 0.234) {
      const slip = hump(p, LAND_DOME, LAND_DOME + 0.004) * 5;
      const x = lerp(420, 452, ease(span(p, LAND_DOME + 0.003, 0.234))) - slip;
      const slope = Math.atan2(domeY(x + 1) - domeY(x - 1), 2);
      miso(ctx, x, domeY(x), walking(p * 900), {
        ...base,
        lean: slope,
        eyes: slip > 1 ? 'wide' : 'open',
        look: [1, -0.4],
      });
    } else {
      const t = ease(span(p, 0.234, at('swipe')));
      const pt = onScope(lerp(0.02, 0.82, t));
      miso(ctx, pt.x, pt.y, walking(t * 30), { ...base, lean: SCOPE_TILT, look: [1, -0.6] });
    }
    return;
  }
  if (p < at('scope')) {
    // The swipe: so close, and exactly as far away as ever.
    if (p < SLIDE) {
      const rear = ease(span(p, at('swipe'), at('swipe') + 0.006));
      const windUp = hump(p, 0.251, SWIPE);
      const swipe = ease(span(p, SWIPE - 0.001, SWIPE + 0.003));
      const flail = span(p, SWIPE + 0.003, SLIDE);
      const j = mixJoints(STAND, REAR, rear);
      j.fnx = lerp(lerp(j.fnx, -2, windUp), 13, swipe);
      j.fny = lerp(lerp(j.fny, -26, windUp), -30, swipe);
      if (flail > 0) {
        j.fnx += Math.sin(seconds * 30) * 3;
        j.ffx -= Math.sin(seconds * 30) * 3;
      }
      const pt = onScope(0.82);
      miso(ctx, pt.x, pt.y, j, {
        ...base,
        lean: lerp(SCOPE_TILT, -0.1, rear) + (flail > 0 ? Math.sin(seconds * 13) * 0.18 : 0),
        eyes: flail > 0 ? 'wide' : 'open',
        pupil: 1,
        look: [0.7, -1],
        mouth: swipe > 0 && flail < 0.2 ? 'o' : flail > 0 ? 'meow' : 'w',
        sway: flail > 0 ? Math.sin(seconds * 20) * 0.8 : sway,
      });
    } else if (p < BONK) {
      const pt = onScope(lerp(0.82, 0.02, easeIn(span(p, SLIDE, BONK))));
      miso(ctx, pt.x, pt.y, CROUCH, {
        ...base,
        lean: SCOPE_TILT,
        eyes: 'wide',
        look: [-1, 0.5],
        mouth: 'o',
        sway: 0.8,
      });
    } else {
      const pt = onScope(0.02);
      const peer = ease(span(p, BONK + 0.0015, at('scope') - 0.0005));
      const { head } = miso(
        ctx,
        pt.x - 4,
        pt.y + 2,
        { ...SIT, tilt: lerp(0, 0.5, peer) },
        {
          ...base,
          wrap: true,
          eyes: peer > 0.3 ? 'open' : 'closed',
          look: [1, 0.5],
        },
      );
      for (let i = 0; i < 3; i++) {
        const a = seconds * 5 + (i * TAU) / 3;
        twinkle(ctx, head.x + Math.cos(a) * 8, head.y - 9 + Math.sin(a) * 2.5, 1.5);
      }
    }
    return;
  }
  // The moon's game of peekaboo: Miso on top of the dome.
  const jump = hump(p, PEEK, PEEK + 0.006) * 7;
  const puff = 1 - ease(span(p, PEEK + 0.004, PEEK + 0.014));
  const facing = p > POP + 0.002 && p < BOLT ? -1 : 1;
  const bolt = span(p, BOLT, BOLT + 0.006);
  const x = DOME.x + easeIn(bolt) * 60;
  miso(ctx, x, domeY(x) - jump, bolt > 0 ? running(seconds * 18) : { ...STAND, tilt: -0.35 }, {
    ...base,
    facing,
    lean: bolt > 0 ? Math.atan2(domeY(x + 1) - domeY(x - 1), 2) : 0,
    puff,
    eyes: puff > 0.3 ? 'wide' : 'open',
    pupil: 0.9,
    look: facing > 0 ? [1, -1] : [1, -0.8],
    mouth: puff > 0.3 ? 'o' : 'w',
    sway: puff > 0.3 ? 0.6 : sway,
  });
}

// ——— The telescope's view ———
function scopeShot(ctx: Ctx, p: number, seconds: number) {
  bands(ctx, ['#0A0E28', '#10173E', '#141C48', '#0F1538']);
  stars(ctx, seconds, 0.8, { count: 20, seed: 9, height: 180 });
  const face = ease(span(p, EYE_OPEN - 0.003, EYE_OPEN + 0.003));
  const winking = within(p, WINK, WINK + 0.006);
  const giggle = p > WINK;
  moon(ctx, 172 + Math.sin(seconds * 0.6) * 3, 98, 104, {
    face,
    lids: 1 - ease(span(p, EYE_OPEN, EYE_OPEN + 0.005)),
    look: p < 0.292 ? [-0.7, 0.7] : [0, 0],
    eyes: winking ? 'wink' : 'open',
    mouth: giggle ? 'giggle' : p > EYE_OPEN + 0.004 ? 'o' : 'smile',
    brows: giggle ? 0.6 : 0,
    tilt: giggle ? Math.sin(seconds * 14) * 0.03 : 0,
    shine: 0.5,
  });
  // Miso's paw tries its luck.
  const reach = easeOut(span(p, PAW_IN - 0.003, PAW_IN + 0.002)) - easeIn(span(p, 0.286, 0.29));
  if (reach > 0) {
    const px = 128 + Math.sin(seconds * 11) * 16 * span(p, PAW_IN, 0.285),
      py = lerp(260, 128, reach);
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1.8, 1.8);
    ctx.rotate(0.15);
    line(ctx, FUR, 28, [-16, 90, 0, 6]);
    for (const k of [22, 40]) line(ctx, FUR_D, 3, [-22 + k * 0.1, k, -6 + k * 0.1, k + 3]);
    oval(ctx, 0, 0, 17, 14, CREAM);
    oval(ctx, 0, 3, 7, 5, PINK);
    for (const [bx, by] of [
      [-10, -6],
      [-3.5, -10],
      [3.5, -10],
      [10, -6],
    ])
      oval(ctx, bx, by, 3, 3.4, PINK);
    ctx.restore();
  }
  iris(ctx, 160, 90, 76, '#07090C');
  arc(ctx, '#353C5A', 5, 160, 90, 78, 78, 0, TAU);
  arc(ctx, alpha('#AFC2E8', 0.3), 1, 160, 90, 73, 73, Math.PI * 1.1, Math.PI * 1.4);
}

// ——— Act three: the chase across the rooftops ———
const RUN_FROM = at('chase');
const RUN_SPEED = 74;
const LANDED = LEAPS[2] + LEAP_TIME;
const runX = (p: number) =>
  40 +
  (Math.min(p, LANDED) - RUN_FROM) * STORY * RUN_SPEED +
  12 * easeOut(span(p, LANDED, LANDED + 0.008));
const GAPS = LEAPS.map((leap) => runX(leap + LEAP_TIME / 2));
const CHASE_HOUSES: readonly House[] = [
  { x0: -200, x1: GAPS[0] - 12, ridge: 118, eave: 134, tone: 1, seed: 5 },
  { x0: GAPS[0] + 12, x1: GAPS[1] - 12, ridge: 108, eave: 124, tone: 2, seed: 15 },
  { x0: GAPS[1] + 12, x1: GAPS[2] - 12, ridge: 116, eave: 130, tone: 0, seed: 25 },
  { x0: GAPS[2] + 12, x1: GAPS[2] + 400, ridge: 94, eave: 112, tone: 3, seed: 35 },
];
/** Where Miso is in the chase, and which leap she is in (or -1 on a roof). */
function chaseMiso(p: number) {
  for (let i = 0; i < LEAPS.length; i++) {
    const t = span(p, LEAPS[i], LEAPS[i] + LEAP_TIME);
    if (t > 0 && t < 1) {
      const a = { x: runX(LEAPS[i]), y: CHASE_HOUSES[i].ridge - 1 },
        b = { x: runX(LEAPS[i] + LEAP_TIME), y: CHASE_HOUSES[i + 1].ridge - 1 };
      return { ...lob(a, b, t, 12), leap: t };
    }
  }
  const roof = LEAPS.filter((leap) => p >= leap + LEAP_TIME).length;
  return { x: runX(p), y: CHASE_HOUSES[roof].ridge - 1, leap: -1 };
}
/** Peekaboo: the moon bobs up between the clouds at the top of every leap. */
function chaseMoon(p: number) {
  const period = LEAPS[1] - LEAPS[0];
  const phase = ((p - LEAPS[0] - LEAP_TIME / 2) / period) * TAU;
  const hidden = p > HIDE;
  const y = hidden ? 72 : 52 - 18 * Math.cos(Math.max(-Math.PI, phase));
  return { x: 236 + (p - RUN_FROM) * 480, y };
}
function chaseShot(ctx: Ctx, p: number, seconds: number) {
  bands(ctx, skyAt(p));
  const run = runX(p);
  stars(ctx, seconds, 1, { seed: 17, height: 110, shiftX: run * 0.08 });
  const m = chaseMoon(p);
  const up = clamp((72 - m.y) / 30);
  moon(ctx, m.x, m.y, 13, {
    face: 1,
    eyes: up > 0.6 ? 'happy' : 'open',
    mouth: up > 0.6 ? 'giggle' : 'smile',
    look: [-1, 0.5],
    tilt: Math.sin(seconds * 12) * 0.05 * up,
  });
  for (const [cx, w, seed] of [
    [150, 60, 2],
    [214, 72, 4],
    [284, 70, 6],
    [350, 66, 8],
  ])
    cloud(ctx, cx - run * 0.12, 80, w, seed);
  if (p > HIDE - 0.01) {
    const bank = ease(span(p, HIDE - 0.01, HIDE));
    cloud(ctx, 300 - bank * 40, 74, 110, 12);
  }
  skyline(ctx, 100, '#161E44', run * 0.3, 3, 1, 0.5);
  skyline(ctx, 118, '#1E2750', run * 0.6, 8, 1.5, 0.45);
  const cat = chaseMiso(p);
  const view = { x: run + 34, y: lerp(98, 84, ease(span(p, LEAPS[2], LANDED))), zoom: 1.8 };
  camera(
    ctx,
    view,
    () => {
      for (const h of CHASE_HOUSES) house(ctx, h);
      chimney(ctx, CHASE_HOUSES[1].x0 + 30, 94, 9, 110);
      chimney(ctx, CHASE_HOUSES[3].x0 + 70, 76, 11, 96);
      const stopped = p > LANDED;
      const settle = ease(span(p, LANDED + 0.006, LANDED + 0.011));
      const j =
        cat.leap >= 0
          ? mixJoints(EXTEND, LEAP, hump(cat.leap, 0, 1))
          : stopped
            ? mixJoints(CROUCH, SIT, settle)
            : running(run * 0.42);
      const lookAround = span(p, LANDED + 0.008, at('alone'));
      miso(ctx, cat.x, cat.y, j, {
        size: 1.3,
        seconds,
        wrap: settle > 0.9,
        eyes: stopped ? 'open' : 'wide',
        pupil: 0.9,
        look: stopped ? [Math.cos(lookAround * 7), -0.6] : [1, -0.8],
        ears: stopped ? lookAround * 0.6 : 0,
        mouth: cat.leap >= 0 ? 'o' : 'w',
        sway: stopped ? Math.sin(seconds * 2) * 0.2 : Math.sin(seconds * 9) * 0.3,
      });
    },
    null,
  );
}

// ——— Act four onward: the highest roof ———
const SUMMIT: House = { x0: 100, x1: 196, ridge: 132, eave: 148, tone: 3, seed: 51 };
const PERCHED = { x: 140, y: SUMMIT.ridge - 1 };
const stepPos = (i: number): Pt => ({ x: 164 + i * 14.5, y: 124 - i * 12.5 });
const stepTop = (i: number): Pt => ({ x: stepPos(i).x - 1, y: stepPos(i).y - 5 });
const LOWER: readonly House[] = Array.from({ length: 8 }, (_, i) => ({
  x0: -70 + i * 58,
  x1: -70 + i * 58 + 50,
  ridge: 150 + rand(i * 4.1) * 10,
  eave: 162,
  tone: i,
  seed: 70 + i,
}));
function summitMoon(p: number) {
  const x = lerp(266, 262, ease(span(p, 0.84, 0.9))),
    y = lerp(40, 58, ease(span(p, 0.84, 0.9)));
  return { x, y, r: lerp(22, 20, ease(span(p, 0.84, 0.9))) };
}
function summitSet(ctx: Ctx, p: number, seconds: number) {
  // The moon, then the cloud bank that hides it for the lonely stretch.
  const m = summitMoon(p);
  const out = ease(span(p, 0.513, 0.53));
  if (p >= at('stairs')) {
    const cheeks =
      ease(span(p, CHEEKS, BLOW)) * (1 - ease(span(p, BLOW + BEAT * 0.4, PUFFS[STEPS - 1])));
    const blowing = within(p, BLOW, PUFFS[STEPS - 1] + BEAT * 0.3);
    const asleep = p > 0.9;
    moon(ctx, m.x, m.y, m.r, {
      face: 1,
      eyes: asleep ? 'closed' : p > HOPS[STEPS - 1] ? 'happy' : 'open',
      look: p < PERK ? [-0.9, 0.8] : [-0.9, 0.5],
      mouth: blowing ? 'o' : cheeks > 0.3 ? 'pout' : 'smile',
      cheeks,
      tilt: Math.sin(seconds * 0.8) * 0.04,
    });
    if (blowing)
      for (let i = 0; i < 6; i++) {
        const t = (seconds * 1.4 + i / 6) % 1;
        const from = { x: m.x - 6, y: m.y + 8 },
          to = stepPos(0);
        twinkle(
          ctx,
          lerp(from.x, to.x, t) + Math.sin(t * 9 + i) * 4,
          lerp(from.y, to.y, t),
          1,
          alpha('#FFF6DA', 1 - t),
        );
      }
  } else moon(ctx, m.x, m.y, m.r);
  if (out < 1) {
    cloud(ctx, 262 + out * 110, 56 + out * 10, 104, 21);
    cloud(ctx, 222 + out * 120, 66, 64, 22);
  }
  // Forktown below, and the tall house at the top of the hill.
  const lit = 1 - span(p, 0.9, 1) * 0.6;
  for (const h of LOWER) house(ctx, h, lit);
  chimney(ctx, 178, 116, 10, 136);
  house(ctx, SUMMIT, Math.max(lit, 0.9));
  // The cloud staircase.
  if (p >= at('stairs')) {
    const ride = span(p, DESCEND, SETTLE) * STEPS;
    for (let i = 0; i < STEPS; i++) {
      if (p >= DESCEND && i === STEPS - 1) continue;
      const born = PUFFS[STEPS - 1 - i];
      const grow = backOut(span(p, born, born + BEAT / 2));
      const gone = p >= DESCEND ? clamp(ride - (STEPS - 1 - i)) : 0;
      if (grow <= 0 || gone >= 1) continue;
      const landed = HOPS[i];
      const dip = hump(p, landed, landed + BEAT * 0.6) * 2;
      const pos = stepPos(i);
      faded(ctx, 1 - gone, () =>
        cloud(
          ctx,
          pos.x,
          pos.y + dip + Math.sin(seconds * 1.4 + i) * 0.8,
          22 * grow,
          30 + i,
          MAGIC_CLOUD,
        ),
      );
      if (within(p, landed, landed + BEAT))
        glow(ctx, pos.x, pos.y - 2, 16, '#FFF1C8', 0.35 * (1 - span(p, landed, landed + BEAT)));
    }
  }
}
/** The ride down: a point along the steps, from the top one to the ridge. */
function ridePos(p: number): Pt {
  const k = ease(span(p, DESCEND, SETTLE)) * STEPS;
  const i = Math.min(STEPS - 1, Math.floor(k));
  const a = stepPos(STEPS - 1 - i),
    b = i + 1 >= STEPS ? { x: PERCHED.x + 6, y: SUMMIT.ridge + 3 } : stepPos(STEPS - 2 - i);
  return { x: lerp(a.x, b.x, k - i), y: lerp(a.y, b.y, k - i) };
}
function summitCast(ctx: Ctx, p: number, seconds: number) {
  const size = 1.4;
  const sway = Math.sin(seconds * 1.5) * 0.12;
  if (p < RISE) {
    // Alone on the highest roof; then the steps appear and her ears come up.
    const perk = ease(span(p, PERK, PERK + 0.006));
    const stand = ease(span(p, RISE - 0.004, RISE + 0.002));
    miso(
      ctx,
      PERCHED.x,
      PERCHED.y,
      mixJoints({ ...SIT, tilt: lerp(0.3, -0.25, perk) }, STAND, stand),
      {
        size,
        seconds,
        wrap: stand < 0.5,
        ears: lerp(1, 0, perk),
        eyes: perk > 0.5 ? 'wide' : 'open',
        pupil: 0.8,
        look: perk > 0.5 ? [1, -0.8] : [0.3, 1],
        sway: 0,
      },
    );
    return;
  }
  if (p < DESCEND) {
    // Hop, hop, hop: up the steps on the beat.
    let pos: Pt = {
      x: lerp(PERCHED.x, PERCHED.x + 10, span(p, RISE, HOPS[0] - HOP_TIME)),
      y: PERCHED.y,
    };
    let j = walking(p * 700);
    let hopping = false;
    if (p < HOPS[0] - HOP_TIME && p > HOPS[0] - HOP_TIME - 0.004) j = CROUCH;
    for (let i = 0; i < STEPS; i++) {
      const from = i ? stepTop(i - 1) : { x: PERCHED.x + 10, y: PERCHED.y },
        to = stepTop(i);
      const t = span(p, HOPS[i] - HOP_TIME, HOPS[i]);
      if (t > 0 && t < 1) {
        pos = lob(from, to, t, 7);
        j = mixJoints(LEAP, STAND, t);
        hopping = true;
      } else if (t >= 1) {
        const bob = hump(p, HOPS[i], HOPS[i] + BEAT * 0.4) * 1.5;
        pos = { x: to.x, y: to.y + bob };
        j = i === STEPS - 1 ? { ...STAND, tilt: -0.3 } : STAND;
      }
    }
    miso(ctx, pos.x, pos.y, j, {
      size,
      seconds,
      eyes: p > HOPS[STEPS - 1] ? 'happy' : hopping ? 'wide' : 'open',
      pupil: 0.8,
      look: [1, -0.7],
      mouth: p > HOPS[STEPS - 1] ? 'smile' : 'w',
      sway: Math.sin(seconds * 5) * 0.2,
    });
    return;
  }
  // The ride down, and tucked in on the roof.
  const settled = p >= SETTLE;
  const tuck = ease(span(p, SETTLE, SETTLE + 0.01));
  const sleepy = span(p, DESCEND, SETTLE);
  const ride = ridePos(p);
  if (!settled) cloud(ctx, ride.x, ride.y, 26, 35, MAGIC_CLOUD);
  const breath = Math.sin(seconds * 1.6) * 0.3;
  const j = settled ? mixJoints(LOAF, CURL, tuck) : LOAF;
  const at2 = settled
    ? { x: lerp(ride.x - 2, PERCHED.x + 6, tuck), y: PERCHED.y }
    : { x: ride.x - 2, y: ride.y - 4 };
  miso(
    ctx,
    at2.x,
    at2.y,
    { ...j, ry: j.ry + breath },
    {
      size,
      seconds,
      wrap: true,
      eyes: settled || sleepy > 0.6 ? 'closed' : 'sleepy',
      look: [0.5, 0.5],
      sway,
      nestle: () => {
        const glowUp = 1 + 0.12 * Math.sin(seconds * 1.6);
        bigStar(ctx, at2.x + 11 * size, at2.y - 3 * size, 3.4 * size * 0.8, 0.2, glowUp);
      },
    },
  );
  if (settled) {
    const w = lerp(26, 21, tuck);
    cloud(
      ctx,
      lerp(ride.x, at2.x - 3, tuck),
      lerp(ride.y, at2.y - 11 * size, tuck) + breath * 0.5,
      w,
      35,
      {
        body: mix(MAGIC_CLOUD.body, '#6F6AA8', span(p, 0.88, 0.95) * 0.5),
        lit: MAGIC_CLOUD.lit,
        dark: MAGIC_CLOUD.dark,
      },
    );
  }
  if (p > SNORE_FROM - 0.01)
    for (let i = 0; i < 3; i++) {
      const t = (seconds * 0.45 + i / 3) % 1;
      const zx = at2.x + 16 + t * 14 + Math.sin(t * 6) * 2,
        zy = at2.y - 16 - t * 16,
        z = 1.5 + t * 1.5;
      line(ctx, alpha('#FFF3DA', (1 - t) * 0.8), 0.7, [
        zx,
        zy,
        zx + z,
        zy,
        zx,
        zy + z,
        zx + z,
        zy + z,
      ]);
    }
}

// ——— Act five and six: high above the town ———
const HIGH_MOON = { x: 234, y: 72, r: 40 };
const PERCH = { x: 96, y: 126 };
const HOLD_AT = { x: 112, y: 101 },
  BAT_AT = { x: 116, y: 68 },
  HIT_AT = { x: 197, y: 80 },
  CHIN = { x: 220, y: 110 };
/** The star's flight: dropped, caught, batted, bounced, and kept. */
function starAt(p: number): Pt | null {
  if (p < DROP - 0.006) return null;
  if (p < DROP) return CHIN;
  if (p < CATCH) return lob(CHIN, HOLD_AT, span(p, DROP, CATCH), 8);
  if (p < HITS[0] - 0.005) return HOLD_AT;
  if (p < HITS[0]) {
    const t = easeOut(span(p, HITS[0] - 0.005, HITS[0]));
    return { x: lerp(HOLD_AT.x, BAT_AT.x, t), y: lerp(HOLD_AT.y, BAT_AT.y, t) };
  }
  const legs = [
    [HITS[0], HITS[1], BAT_AT, HIT_AT, 30],
    [HITS[1], HITS[2], HIT_AT, BAT_AT, 22],
    [HITS[2], HITS[3], BAT_AT, HIT_AT, 38],
    [HITS[3], KEEP, HIT_AT, HOLD_AT, 18],
  ] as const;
  for (const [a, b, from, to, height] of legs)
    if (p < b) return lob(from, to, span(p, a, b), height);
  return HOLD_AT;
}
const flying = (p: number) => (p > DROP && p < CATCH) || (p > HITS[0] && p < KEEP);
function highSet(ctx: Ctx, p: number, seconds: number) {
  // Forktown far below, asleep under a lavender mist.
  skyline(ctx, 170, '#161B46', 0, 61, 0.55, 0.75);
  box(ctx, 0, 150, W, 30, alpha('#8E88C8', 0.14));
  cloud(ctx, 40, 166, 30, 3, MAGIC_CLOUD);
  cloud(ctx, 64, 150, 22, 5, MAGIC_CLOUD);
  cloud(ctx, 292, 150, 60, 9, { body: '#6E68AA', lit: '#9C95CC', dark: '#514C8C' });
  // The moon keeps its eyes on the star.
  const star = starAt(p);
  const toward = star
    ? ([
        clamp((star.x - HIGH_MOON.x) / 40, -1, 1),
        clamp((star.y - HIGH_MOON.y) / 40, -1, 1),
      ] as const)
    : ([-0.8, 0.6] as const);
  const bounce = Math.max(
    hump(p, HITS[1] - 0.004, HITS[1] + 0.006),
    hump(p, HITS[3] - 0.004, HITS[3] + 0.006),
  );
  const showering = p > SHOWER - 0.01;
  moon(ctx, HIGH_MOON.x - bounce * 4, HIGH_MOON.y, HIGH_MOON.r, {
    face: 1,
    eyes: bounce > 0.3 || showering ? 'happy' : 'open',
    look: toward,
    mouth:
      bounce > 0.2 || (p > KEEP && p < KEEP + 0.01) ? 'giggle' : showering ? 'giggle' : 'smile',
    tilt: -bounce * 0.2 + (showering ? Math.sin(seconds * 4) * 0.06 : 0),
    cheeks: showering ? 0.15 : 0,
    shine: 1.2,
  });
  cloud(ctx, PERCH.x + 4, PERCH.y + 7, 68, 7, MAGIC_CLOUD);
}
function highCast(ctx: Ctx, p: number, seconds: number) {
  const star = starAt(p);
  let j: Joints = SIT;
  let eyes: Look['eyes'] = 'open',
    mouth: Look['mouth'] = 'w';
  const look: [number, number] = star
    ? [clamp((star.x - PERCH.x - 20) / 40, -1, 1), clamp((star.y - PERCH.y + 50) / 30, -1, 1)]
    : [1, -0.5];
  if (p < DROP) mouth = 'smile';
  else if (p < CATCH) {
    j = mixJoints(SIT, HOLD, ease(span(p, CATCH - 0.007, CATCH)));
    eyes = 'wide';
    mouth = 'o';
  } else if (p < KEEP - 0.004) {
    const bat = Math.max(
      hump(p, HITS[0] - 0.007, HITS[0] + 0.006),
      hump(p, HITS[2] - 0.007, HITS[2] + 0.006),
    );
    j = p < HITS[0] - 0.007 ? HOLD : mixJoints(SIT, BAT, bat);
    eyes = p < HITS[0] - 0.007 || bat > 0.5 ? 'happy' : 'open';
    mouth = p < CATCH + 0.008 ? 'meow' : bat > 0.3 ? 'smile' : 'w';
  } else {
    j = HOLD;
    eyes = p > SHOWER ? (Math.sin(seconds * 1.3) > 0.3 ? 'happy' : 'wide') : 'happy';
    mouth = 'smile';
  }
  const pupil = eyes === 'wide' ? 1 : 0.8;
  miso(ctx, PERCH.x, PERCH.y, j, {
    size: 2.1,
    seconds,
    wrap: true,
    eyes,
    mouth,
    pupil,
    look: p > SHOWER ? [0.4, -1] : look,
    sway: Math.sin(seconds * 3) * 0.2,
  });
  if (!star) return;
  // Star trails and a little burst of sparkle at every catch and bounce.
  if (flying(p))
    for (let k = 8; k >= 1; k--) {
      const q = p - k * 0.0012;
      if (!flying(q)) continue;
      const t = starAt(q);
      if (t) disc(ctx, t.x, t.y, 2.2 - k * 0.2, alpha(STAR, 0.55 * (1 - k / 9)));
    }
  const spin = flying(p) ? seconds * 6 : Math.sin(seconds * 2) * 0.15;
  const grow = p < DROP ? ease(span(p, DROP - 0.006, DROP)) : 1;
  bigStar(ctx, star.x, star.y, 5.5 * grow, spin, p > KEEP ? 1.2 : 1);
  for (const hit of [CATCH, ...HITS, KEEP]) {
    const t = span(p, hit, hit + 0.012);
    if (t <= 0 || t >= 1) continue;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + hit * 40;
      twinkle(
        ctx,
        star.x + Math.cos(a) * (4 + t * 12),
        star.y + Math.sin(a) * (4 + t * 12),
        1.5 * (1 - t),
      );
    }
  }
}
/** The moon's gift: a slow, soft shower of little stars. */
function starShower(ctx: Ctx, p: number, seconds: number) {
  const amount = presence(p, SHOWER - 0.004, at('yawn'), 0.012);
  if (amount <= 0) return;
  const t = (p - SHOWER + 0.004) * STORY;
  faded(ctx, amount, () => {
    for (let i = 0; i < 44; i++) {
      const speed = 12 + rand(i * 1.9) * 12;
      const y = -8 + t * speed - rand(i * 7.1) * 60;
      if (y < -8 || y > H) continue;
      const x = rand(i * 3.3) * W + Math.sin(t * 1.3 + i) * 5;
      if (i % 4 === 0) starShape(ctx, x, y, 2.4, STAR, t + i);
      else twinkle(ctx, x, y, 1 + (Math.sin(seconds * 3 + i) > 0.4 ? 1 : 0));
    }
  });
}

// ——— The close-ups ———
function lookupShot(ctx: Ctx, p: number, seconds: number) {
  bands(ctx, skyAt(p));
  stars(ctx, seconds, 1, { seed: 29, height: 90 });
  moon(ctx, 262, 30, 9);
  skyline(ctx, 168, '#141A3C', 20, 44, 1.6, 0.5);
  const shake = within(p, 0.128, 0.134) ? Math.sin(seconds * 45) * 0.2 : 0;
  const up = ease(span(p, 0.134, 0.138));
  const wet = 1 - span(p, 0.128, 0.134) * 0.4;
  misoFace(ctx, 150, 106 - up * 4, 2.5 + span(p, at('lookup'), at('chimney')) * 0.25, {
    wet,
    seconds,
    tilt: shake - up * 0.08,
    eyes: p < 0.128 ? 'glare' : up > 0.5 ? (p > 0.14 ? 'glare' : 'wide') : 'closed',
    pupil: up > 0.5 ? 1 : 0.4,
    look: up > 0.5 ? [0.7, -1] : [0.2, 1],
    ears: p < 0.128 ? 0.6 : lerp(0.3, 0, up),
    mouth: within(p, 0.141, 0.145) ? 'o' : 'w',
    shine: up,
  });
  // Water flung off by the shake.
  if (within(p, 0.128, 0.136))
    for (let i = 0; i < 14; i++) {
      const t = (seconds * 2.2 + rand(i)) % 1;
      const a = rand(i * 3.7) * TAU;
      box(
        ctx,
        150 + Math.cos(a) * (40 + t * 60),
        100 + Math.sin(a) * (30 + t * 40),
        2,
        2,
        alpha('#BFE3F6', 1 - t),
      );
    }
}
function sadShot(ctx: Ctx, p: number, seconds: number) {
  bands(ctx, skyAt(p));
  stars(ctx, seconds, 0.6, { seed: 31, height: 80 });
  cloud(ctx, 262, 40, 104, 21);
  skyline(ctx, 170, '#0E1330', 60, 45, 1.6, 0.35);
  const sigh = hump(p, SIGH, SIGH + 0.01);
  const hope = ease(span(p, 0.489, 0.494));
  misoFace(ctx, 150, 116 + sigh * 4, 2.6, {
    seconds,
    eyes: 'sad',
    look: hope > 0.5 ? [0.8, -0.8] : [-0.2, 1],
    ears: 1 - hope * 0.3,
    mouth: sigh > 0.3 ? 'o' : 'frown',
    lids: sigh * 0.5,
    tilt: -0.08 + hope * 0.06,
  });
  if (sigh > 0.05)
    oval(ctx, 150, 140 + sigh * 8, 3 + sigh * 6, 2 + sigh * 2, alpha('#DDE6F6', sigh * 0.25));
  vignette(ctx, 0.6);
}
function moonSadShot(ctx: Ctx, p: number, seconds: number) {
  bands(ctx, skyAt(p));
  stars(ctx, seconds, 0.7, { seed: 37, height: 100 });
  const peek = easeOut(span(p, at('moonsad'), at('moonsad') + 0.006));
  const idea = ease(span(p, IDEA, IDEA + 0.004));
  const blink = hump(p, IDEA - 0.004, IDEA);
  moon(ctx, 176, lerp(136, 104, peek) - idea * 12, 46, {
    face: 1,
    lids: blink,
    eyes: idea > 0.5 ? 'happy' : 'open',
    look: [-0.8, 0.7],
    brows: idea > 0.5 ? 0 : -1,
    mouth: idea > 0.5 ? 'smile' : 'o',
    tilt: Math.sin(seconds * 0.7) * 0.03,
    shine: 0.7 + idea * 0.5,
  });
  cloud(ctx, 110, 158, 190, 41);
  cloud(ctx, 262, 150, 150, 43);
  box(ctx, 0, 162, W, 18, NIGHT_CLOUD.dark);
}
function yawnShot(ctx: Ctx, p: number, seconds: number) {
  bands(ctx, skyAt(p));
  stars(ctx, seconds, 1, { seed: 47, height: 110 });
  cloud(ctx, 60, 60, 60, 13, MAGIC_CLOUD);
  cloud(ctx, 270, 44, 50, 15, MAGIC_CLOUD);
  const yawn = hump(p, YAWN, YAWN + YAWN_LENGTH);
  const drowsy = span(p, YAWN + YAWN_LENGTH * 0.8, at('down'));
  misoFace(ctx, 160, 104, 2.5, {
    seconds,
    eyes: yawn > 0.15 ? 'closed' : 'open',
    lids: 0.25 + drowsy * 0.45,
    look: [0, 0.6],
    mouth: yawn > 0.05 ? 'yawn' : 'w',
    yawn,
    ears: yawn * 0.4,
    tilt: -yawn * 0.1,
  });
  bigStar(ctx, 160, 178, 9, Math.sin(seconds) * 0.1, 1.2);
}

// ——— Cameras: [p, x, y, zoom]; two keys at the same p make a hard cut ———
const ROOF_CAMERA = [
  [0, 330, 92, 1.05],
  [0.012, 322, 92, 1.05],
  [0.042, 92, 104, 2.1],
  [at('crouch'), 96, 106, 2.15],
  [at('crouch'), 118, 118, 1.8],
  [at('splash'), 122, 120, 1.85],
  [at('splash'), 136, 132, 2.8],
  [at('lookup'), 134, 130, 2.9],
  [at('chimney'), 214, 90, 2.1],
  [0.16, 236, 70, 2.05],
  [at('antenna'), 250, 56, 2],
  [at('antenna'), 322, 96, 2],
  [WOBBLE, 336, 40, 2],
  [at('dome'), 344, 32, 2],
  [at('dome'), 380, 66, 1.5],
  [at('swipe'), 440, 56, 1.55],
  [at('swipe'), 519, 26, 2.1],
  [0.26, 516, 28, 2.15],
  [0.265, 500, 40, 2],
  [at('scope'), 488, 52, 2.2],
  [at('peek'), 470, 40, 2.1],
  [at('chase'), 476, 38, 2.2],
] as const;
const SUMMIT_CAMERA = [
  [at('alone'), 146, 118, 1.6],
  [at('sad'), 160, 90, 1],
  [at('climb'), 172, 88, 1.08],
  [at('climb'), 170, 104, 1.7],
  [at('catch'), 214, 62, 1.7],
  [at('down'), 226, 52, 1.8],
  [SETTLE, 160, 110, 2],
  [at('goodnight'), 150, 120, 2.5],
  [0.905, 156, 116, 2.2],
  [0.96, 196, 96, 1.55],
  [1, 200, 94, 1.6],
] as const;
const HIGH_CAMERA = [
  [at('catch'), 138, 106, 1.35],
  [DROP, 142, 104, 1.35],
  [CATCH + 0.008, 162, 92, 1.04],
  [at('shower'), 160, 90, 1],
  [at('yawn'), 150, 96, 1.12],
] as const;

/** The peekaboo sky over the dome: giggle, duck, pop out the other side, and zip away. */
function peekSky(ctx: Ctx, p: number, seconds: number) {
  let x = MOON_AT.x,
    y = MOON_AT.y;
  let face: MoonLook = {
    face: 1,
    eyes: 'happy',
    mouth: 'giggle',
    tilt: Math.sin(seconds * 12) * 0.06,
  };
  if (p >= DUCK) {
    const t = ease(span(p, DUCK, DUCK + 0.004));
    x = lerp(MOON_AT.x, 262, t);
    y = lerp(MOON_AT.y, 72, t);
    face = { face: 1, eyes: 'open', mouth: 'smile', look: [-1, 0.5] };
  }
  if (p >= POP) {
    x = 74;
    y = lerp(80, 34, backOut(span(p, POP, POP + 0.004)));
    face = {
      face: 1,
      eyes: 'wink',
      mouth: 'giggle',
      brows: 0.8,
      tilt: Math.sin(seconds * 12) * 0.06,
    };
  }
  if (p >= 0.334) {
    const t = easeIn(span(p, 0.334, BOLT + 0.004));
    x = lerp(74, 380, t);
    y = lerp(34, 22, t);
    face = { face: 1, eyes: 'happy', mouth: 'giggle', tilt: 0.2 };
  }
  moon(ctx, x, y, 17, face);
  cloud(ctx, 262, 80, 62, 51);
  cloud(ctx, 76, 86, 60, 53);
}

const ROOF_SHOTS: readonly ShotName[] = [
  'town',
  'crouch',
  'splash',
  'chimney',
  'antenna',
  'dome',
  'swipe',
  'peek',
];
const SUMMIT_SHOTS: readonly ShotName[] = ['alone', 'stairs', 'climb', 'down', 'goodnight'];

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const misoAndTheMoonScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: 60, voice: 'bell', intro: [12, 16, 19], outro: [0, 7, 12, 16] },
    (s) => {
      const C = 60;
      const bpm = 60 / (BEAT * s.story);
      const quickBpm = 60 / (QUICK * s.story);
      const seconds = (from: number, to: number) => (to - from) * s.story;
      // The lullaby: eight bars of 3/4 over C F G G C F G C.
      const LULLABY = [16, null, 19, 21, 19, 16, 14, null, 12, 14, null, null];
      const LULLABY_B = [16, null, 19, 24, 21, 19, 16, 14, 12, 12, null, null];
      const WALTZ_CHORDS = [0, 5, 7, 7, 0, 5, 7, 0];
      const PENTA = [72, 74, 76, 79, 81, 84];

      // ——— The night itself ———
      s.fx('wind', 0, s.story, 0.035);

      // ——— Act one: a bell lullaby, a stalk, a splash ———
      s.section({
        from: 0,
        to: CROUCH_AT,
        bpm,
        root: C,
        chords: WALTZ_CHORDS,
        melody: [...LULLABY, ...LULLABY_B],
        voice: 'bell',
        gain: 0.75,
        level: 0.55,
        groove: 'waltz',
        fade: 0.8,
      });
      for (let i = 0; i < 7; i++) s.fx('step', 0.004 + i * 0.0062, 0.1, 0.035, -0.4);
      s.fx('meow', SPOT + 0.003, 0.45, 0.16, -0.3);
      // Tiptoe: pizzicato on the spot while she wiggles.
      s.section({
        from: CROUCH_AT - 0.004,
        to: POUNCE,
        bpm: quickBpm,
        root: C - 3,
        minor: true,
        chords: [0],
        melody: [0, null, 0, null, 3, null, 0, null],
        step: 0.5,
        voice: 'pluck',
        gain: 0.45,
        level: 0.35,
        pad: false,
        fade: 0.3,
      });
      s.fx('rustle', CROUCH_AT + 0.002, seconds(CROUCH_AT, POUNCE), 0.05, -0.2);
      s.fx('swish', POUNCE, 0.5, 0.15, 0);
      s.fx('splash', SPLASH, 1.1, 0.32, 0.1);
      s.fx('bubble', SPLASH + 0.003, 0.8, 0.07, 0.1);
      for (const [i, pitch] of [67, 66, 65, 63].entries())
        s.note(SPLASH + 0.004 + i * 0.004, pitch, 0.3, 'pluck', 0.07, -0.2);
      for (let i = 0; i < 3; i++) s.fx('drip', SURFACE + i * 0.006, 0.2, 0.07, -0.2 + i * 0.2);
      s.fx('meow', GLARE + 0.004, 0.55, 0.15, -0.1);
      s.section({
        from: SURFACE - 0.004,
        to: at('lookup') + 0.004,
        bpm,
        root: C - 3,
        minor: true,
        chords: [0, -4],
        melody: [null, 7, 3, null, 0, null],
        voice: 'pluck',
        gain: 0.4,
        level: 0.45,
        bass: false,
      });

      // ——— Act two: she looks up; higher and higher, a key at a time ———
      s.fx('rustle', 0.128, 0.35, 0.08, 0);
      s.chord(0.134, [C + 12, C + 16, C + 19], seconds(0.134, at('chimney')), 'pad', 0.05);
      s.note(0.135, C + 24, 1.4, 'bell', 0.08, 0.4);
      s.note(0.138, C + 28, 1.4, 'bell', 0.06, 0.5);
      s.fx('meow', 0.141, 0.3, 0.12, 0);
      const climb = (from: number, to: number, root: number) =>
        s.section({
          from,
          to,
          bpm: quickBpm,
          root,
          chords: [0, 5],
          melody: [0, 4, 7, 12, 7, 4, 7, 12],
          step: 0.5,
          voice: 'pluck',
          gain: 0.5,
          level: 0.55,
          groove: 'tick',
          fade: 0.4,
        });
      climb(at('chimney'), at('antenna'), C);
      climb(at('antenna'), at('dome'), C + 2);
      climb(at('dome'), at('swipe'), C + 4);
      for (const claw of CLAWS) s.fx('click', claw, 0.08, 0.08, 0.1);
      s.fx('swish', 0.17, 0.3, 0.07, 0.3);
      s.note(0.176, C + 7, 0.6, 'pluck', 0.08, 0.2);
      s.note(0.178, C + 6, 0.8, 'pluck', 0.06, 0.2);
      for (const rung of RUNGS) s.fx('click', rung, 0.08, 0.07, 0.2);
      s.fx('creak', WOBBLE, 0.9, 0.12, 0.2);
      s.fx('boing', WOBBLE + 0.002, 0.7, 0.06, 0.2);
      s.fx('swish', JUMP_DOME, 0.55, 0.15, 0.3);
      s.fx('thud', LAND_DOME, 0.3, 0.1, 0.3);
      s.fx('squeak', LAND_DOME + 0.001, 0.25, 0.05, 0.3);
      // The swipe: a held breath, a whiff, and a slide.
      s.section({
        from: at('swipe'),
        to: SLIDE,
        bpm,
        root: C + 5,
        chords: [0],
        level: 0.45,
        bass: false,
        fade: 0.3,
      });
      s.note(at('swipe') + 0.004, C + 17, seconds(at('swipe'), SWIPE), 'bell', 0.04, 0.3);
      s.fx('swish', SWIPE - 0.001, 0.35, 0.2, 0.3);
      for (const [i, pitch] of [C + 7, C + 6, C + 5, C + 4].entries())
        s.note(SLIDE + i * 0.0016, pitch, 0.22, 'pluck', 0.08, 0.1);
      s.fx('squeak', SLIDE, seconds(SLIDE, BONK), 0.05, 0.1);
      s.fx('knock', BONK, 0.15, 0.16, 0);
      s.fx('boing', BONK + 0.001, 0.5, 0.06, 0);

      // ——— Act three: the moon opens one eye ———
      s.section({
        from: at('scope'),
        to: PEEK,
        bpm: 60,
        root: C,
        chords: [0, 8],
        level: 0.55,
        bass: false,
        fade: 0.6,
      });
      s.fx('swish', PAW_IN - 0.002, 0.3, 0.07, -0.2);
      s.fx('chime', EYE_OPEN, 1.4, 0.1, 0.2);
      for (const [i, pitch] of [72, 76, 79].entries())
        s.note(EYE_OPEN + i * 0.002, pitch, 1.4, 'bell', 0.06, 0.2);
      s.fx('giggle', WINK, 0.9, 0.15, 0.2);
      // Peekaboo, then the chase: a playful pizzicato on the chase's beat grid.
      s.section({
        from: PEEK,
        to: LANDED + 0.004,
        bpm: quickBpm,
        root: C,
        chords: [0, 5, 7, 0],
        melody: [12, null, 7, null, 9, 11, 12, null, 16, null, 14, 12, 11, null, 7, null],
        step: 0.5,
        voice: 'pluck',
        gain: 0.55,
        level: 0.65,
        groove: 'pulse',
        fade: 0.3,
      });
      s.fx('squeak', PEEK, 0.25, 0.06, -0.2);
      s.fx('giggle', DUCK - 0.002, 0.6, 0.1, 0.5);
      s.fx('pop', POP, 0.14, 0.2, -0.6);
      s.fx('giggle', POP + 0.002, 0.8, 0.12, -0.6);
      s.fx('swish', BOLT, 0.3, 0.12, 0.4);
      for (const leap of LEAPS) {
        s.fx('swish', leap, 0.5, 0.13, 0);
        s.fx('thud', leap + LEAP_TIME, 0.2, 0.07, 0);
        s.fx('giggle', leap + LEAP_TIME / 2, 0.45, 0.07, 0.5);
      }
      for (let q = BOLT + QUICK; q < LANDED; q += QUICK / 2)
        if (!LEAPS.some((leap) => q > leap - 0.002 && q < leap + LEAP_TIME))
          s.fx('step', q, 0.08, 0.035, -0.1);

      // ——— Act four: too far away ———
      s.fx('wind', HIDE, seconds(HIDE, at('stairs')), 0.06, 0.3);
      s.section({
        from: LANDED,
        to: at('stairs'),
        bpm: 60,
        root: C - 3,
        minor: true,
        chords: [0, -4, 5, 7],
        melody: [7, null, 5, 3, null, null, 2, null, 3, 0, null, null],
        voice: 'keys',
        gain: 0.5,
        level: 0.45,
        fade: 1.6,
      });
      s.fx('meow', SIGH + 0.002, 0.6, 0.07, 0);
      s.fx('chime', IDEA, 1.3, 0.1, 0.3);

      // ——— Act five: the magic waltz ———
      s.section({
        from: MAGIC,
        to: beat(8),
        bpm,
        root: C,
        chords: [0, 9, 5, 7],
        level: 0.5,
        groove: 'waltz',
        fade: 0.9,
      });
      s.fx('wind', BLOW, 1.6, 0.1, 0.4);
      // The steps are the scale: puffed from the top down, hopped from the bottom up.
      PUFFS.forEach((puff, i) => {
        s.fx('pop', puff, 0.12, 0.06, 0.4 - i * 0.12);
        s.note(puff, PENTA[STEPS - 1 - i], 1.1, 'bell', 0.08, 0.4 - i * 0.12);
      });
      HOPS.forEach((hop, i) => {
        s.fx('bounce', hop, 0.2, 0.06, -0.2 + i * 0.1);
        s.note(hop, PENTA[i], 1.2, 'bell', 0.09, -0.2 + i * 0.1);
      });
      s.section({
        from: beat(8),
        to: SHOWER,
        bpm,
        root: C,
        chords: WALTZ_CHORDS,
        melody: [...LULLABY, ...LULLABY_B],
        voice: 'keys',
        gain: 0.55,
        level: 0.75,
        groove: 'waltz',
        fade: 0.4,
      });
      s.fx('sparkle', DROP, 0.8, 0.1, 0.4);
      s.fx('chime', CATCH, 1.2, 0.14, -0.3);
      s.fx('meow', CATCH + 0.003, 0.5, 0.14, -0.3);
      HITS.forEach((hit, i) => {
        if (i % 2 === 0) {
          s.fx('bounce', hit, 0.25, 0.13, -0.4);
          s.note(hit, C + 24, 0.9, 'bell', 0.09, -0.4);
        } else {
          s.fx('boing', hit, 0.5, 0.08, 0.5);
          s.fx('giggle', hit + 0.002, 0.5, 0.1, 0.5);
          s.note(hit, C + 19, 0.9, 'bell', 0.08, 0.5);
        }
        s.fx('chime', hit, 0.8, 0.07, i % 2 ? 0.5 : -0.4);
      });
      s.fx('sparkle', KEEP, 1.1, 0.12, -0.3);
      s.note(KEEP, C + 28, 1.6, 'bell', 0.08, -0.3);

      // ——— Act six: a shower of stars, a yawn, and the way down ———
      s.section({
        from: SHOWER,
        to: at('yawn') + 0.004,
        bpm,
        root: C,
        chords: [0, 5, 0, 7],
        level: 0.55,
        groove: 'waltz',
        fade: 1,
      });
      for (let i = 0; i < 4; i++) s.fx('sparkle', SHOWER + i * 0.011, 1.2, 0.07, -0.6 + i * 0.4);
      for (let i = 0; i < 12; i++)
        s.note(
          SHOWER + i * (BEAT / 2),
          PENTA[Math.floor(rand(i * 2.7) * PENTA.length)] + 12,
          1.2,
          'bell',
          0.045,
          rand(i * 5.3) * 1.4 - 0.7,
        );
      s.fx('giggle', SHOWER + 0.004, 0.8, 0.08, 0.5);
      s.chord(at('yawn'), [C, C + 4, C + 7], seconds(at('yawn'), DESCEND), 'pad', 0.05);
      s.fx('yawn', YAWN, YAWN_LENGTH * s.story, 0.22, 0);
      // The ride down: the steps play their scale again, softly, in reverse.
      for (let k = 1; k <= STEPS; k++) {
        let lo = DESCEND,
          hi = SETTLE;
        for (let n = 0; n < 30; n++) {
          const mid = (lo + hi) / 2;
          if (ease(span(mid, DESCEND, SETTLE)) * STEPS < k) lo = mid;
          else hi = mid;
        }
        s.note(lo, PENTA[STEPS - k], 1.4, 'bell', 0.045, 0.3 - k * 0.1);
      }
      s.fx('rustle', SETTLE, 0.6, 0.04, -0.2);

      // ——— Act seven: goodnight ———
      s.section({
        from: DESCEND,
        to: 0.975,
        bpm: 66,
        root: C,
        chords: WALTZ_CHORDS,
        melody: LULLABY,
        voice: 'bell',
        gain: 0.45,
        level: 0.38,
        groove: 'waltz',
        fade: 2,
      });
      s.fx('snore', SNORE_FROM, seconds(SNORE_FROM, 0.99), 0.12, -0.2);
    },
  );

export const misoAndTheMoon: FilmModule = {
  draw(ctx, p, seconds) {
    const { name } = current(p);
    if (ROOF_SHOTS.includes(name)) {
      const view = track(p, ROOF_CAMERA);
      bands(ctx, skyAt(p));
      stars(ctx, seconds, 1, { shiftX: view.x * 0.05, shiftY: (view.y - 90) * 0.15 });
      if (name === 'peek') peekSky(ctx, p, seconds);
      else if (name !== 'crouch' && name !== 'splash') moon(ctx, MOON_AT.x, MOON_AT.y, MOON_AT.r);
      const base = 90 + (132 - view.y) * view.zoom * 0.6;
      if (base < H)
        skyline(ctx, base, '#18204A', view.x * view.zoom * 0.35, 13, view.zoom * 0.7, 0.45);
      camera(
        ctx,
        view,
        () => {
          roofSet(ctx, p, wobbleAt(p));
          roofCast(ctx, p, seconds);
          barrelFront(ctx);
          splashDrops(ctx, p);
        },
        null,
      );
      vignette(ctx, 0.45);
    } else if (name === 'scope') scopeShot(ctx, p, seconds);
    else if (name === 'lookup') {
      lookupShot(ctx, p, seconds);
      vignette(ctx, 0.5);
    } else if (name === 'chase') {
      chaseShot(ctx, p, seconds);
      vignette(ctx, 0.45);
    } else if (name === 'sad') sadShot(ctx, p, seconds);
    else if (name === 'moonsad') {
      moonSadShot(ctx, p, seconds);
      vignette(ctx, 0.5);
    } else if (name === 'yawn') {
      yawnShot(ctx, p, seconds);
      vignette(ctx, 0.45);
    } else if (name === 'catch' || name === 'shower') {
      bands(ctx, skyAt(p));
      stars(ctx, seconds, 1, { seed: 23, height: 150 });
      camera(ctx, track(p, HIGH_CAMERA), () => {
        highSet(ctx, p, seconds);
        highCast(ctx, p, seconds);
      });
      starShower(ctx, p, seconds);
      vignette(ctx, 0.35);
    } else if (SUMMIT_SHOTS.includes(name)) {
      const view = track(p, SUMMIT_CAMERA);
      bands(ctx, skyAt(p));
      stars(ctx, seconds, 1, { seed: 5, shiftX: view.x * 0.05, height: 130 });
      skyline(
        ctx,
        90 + (160 - view.y) * view.zoom * 0.5,
        '#161D46',
        view.x * view.zoom * 0.3,
        19,
        view.zoom * 0.7,
        0.4,
      );
      camera(ctx, view, () => {
        summitSet(ctx, p, seconds);
        summitCast(ctx, p, seconds);
      });
      vignette(ctx, name === 'alone' ? 0.6 : 0.4);
    }
    // Dips between the big changes of light.
    veil(ctx, '#07090C', Math.max(hump(p, 0.411, 0.425) * 0.85, hump(p, 0.874, 0.886) * 0.6));
    captions(ctx, p, [
      [0.072, 0.121, 'Miso wanted the moon.'],
      [0.424, 0.468, 'The moon was just too far away.'],
      [0.54, 0.586, 'So the moon came a little closer.'],
      [0.905, 0.975, 'Goodnight, little moon.'],
    ]);
  },
  score: misoAndTheMoonScore,
  look: {
    shade: '#0E1328',
    ink: '#FFF3DA',
    accent: '#FFE5A0',
    dedication: 'for friends who are a little farther away',
  },
};
