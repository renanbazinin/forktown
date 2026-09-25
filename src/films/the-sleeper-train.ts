import { CINEMA_FILMS } from '../lib/cinema';
import type { FilmModule } from './types';
import {
  alpha,
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
  lerp,
  line,
  mix,
  oval,
  poly,
  presence,
  rand,
  shade,
  span,
  TAU,
  track,
  veil,
  vignette,
  W,
  within,
  write,
  type Ctx,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * THE SLEEPER TRAIN
 * Fennel, a young fox travelling alone on the night train to Grandma's, means to stay awake
 * to see the sea at sunrise; he has never seen it. Sleep wins. But the old badger conductor
 * has seen his crayon drawing, and wakes him at exactly the right moment.
 *
 * The chug is the film's heartbeat: the lullaby waltz runs at 78 bpm so every chug puff lands
 * on an eighth note, and the sheep Fennel counts jump on the beat. Snores, the yawn, the
 * whistles, and the steam all read the same timing constants as the score.
 */

const STORY = (CINEMA_FILMS.find((film) => film.artwork === 'train')?.duration ?? 60) - 6;
const BPM = 78;
const BEAT = 60 / BPM / STORY;
const beat = (n: number) => n * BEAT;
const sec = (seconds: number) => seconds / STORY;

// Shots, in story order.
const SHOTS = [
  ['platform', 0],
  ['whistle', 0.078],
  ['depart', 0.092],
  ['room', 0.135],
  ['sketch', 0.175],
  ['watch', 0.2],
  ['lake', beat(16)],
  ['viaduct', beat(19)],
  ['sheep', beat(21.5)],
  ['count', beat(24.5)],
  ['awake', beat(27.5)],
  ['glass', 0.465],
  ['yawn', 0.492],
  ['tunnel', 0.517],
  ['asleep', 0.542],
  ['keeper', 0.58],
  ['night', 0.655],
  ['dawn', beat(49)],
  ['cliff', 0.728],
  ['wake', 0.752],
  ['light', beat(55)],
  ['sea', 0.81],
  ['coast', 0.85],
  ['compare', 0.872],
  ['arrive', 0.918],
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

// Story beats shared by the pictures and the score.
const PUNCH = 0.063;
const WHISTLE = 0.081;
const DEPART = 0.09;
/** The counted sheep clear the hurdle on the beat, then slow down as Fennel does. */
const JUMPS = [beat(22), beat(23), beat(24), beat(25), beat(26.5)];
const JOLT = at('awake');
const PINCH = JOLT + 0.005,
  PROP = 0.415;
const YAWN = at('yawn') + 0.003,
  YAWN_LENGTH = sec(1.35);
const SLIP = 0.557;
const TUNNEL_OUT = 0.574;
const CLIFF_WHISTLE = 0.734;
const TAPS = [0.763, 0.769];
const STIR = 0.772;
const STOP = 0.946;
const LEAP = 0.949;

// The chug: one puff every 1/2.6 s, i.e. every eighth note at 78 bpm.
const PUFF = sec(1 / 2.6);
const cumulative = (from: number, gaps: readonly number[]) =>
  gaps.reduce<number[]>((list, gap) => [...list, list[list.length - 1] + sec(gap)], [from]);
const DEPART_PUFFS = cumulative(DEPART, [0.85, 0.7, 0.58, 0.5]);
const EIGHTH = 30 / BPM;
/** The steady chug starts on an eighth note, so from here on it rides the waltz. */
const CRUISE =
  (Math.ceil((DEPART_PUFFS[DEPART_PUFFS.length - 1] * STORY + 0.4) / EIGHTH) * EIGHTH - 0.096) /
  STORY;
const BRAKE = 0.9;
const ARRIVE_PUFFS = cumulative(BRAKE, [0.4, 0.44, 0.5, 0.58, 0.64]);
const chugPhase = (p: number) => Math.max(0, (p - CRUISE) / PUFF);

// The bear opposite snores every 2.2 s: in on the first half, out on the second.
const SNORE = sec(1 / 0.45);
const SNORE_FROM = 0.3;
const snorePhase = (p: number) => ((((p - SNORE_FROM) / SNORE) % 1) + 1) % 1;
const breath = (p: number) => {
  const t = snorePhase(p);
  return t < 0.5 ? ease(t * 2) : 1 - ease((t - 0.5) * 2);
};

// Palette.
const INK = '#221A1C';
const FUR = '#E27A35',
  FUR_D = '#B65823',
  CREAM = '#FCF0DF',
  SOCK = '#3A2419',
  NOSE = '#1C1412',
  EAR_IN = '#F3C3A4';
const SCARF = '#3E9A5B',
  SCARF_D = '#2B7243',
  PACK = '#B7473A',
  PACK_D = '#8A3129';
const NAVY = '#27346B',
  NAVY_D = '#1B2450',
  BRASS = '#E6BA55';
const BADGER = '#8E8B95',
  BADGER_FACE = '#F1EEE6',
  STRIPE = '#2E2A34';
const BEAR = '#7A5236',
  BEAR_D = '#5A3A25',
  JUMPER = '#3F6F6A',
  JUMPER_D = '#2F5650';
const CAR = '#2F5A4A',
  CAR_D = '#22443A',
  GOLD = '#D9B25A',
  ROOF = '#34343E',
  WARM = '#FFD58A';
const RED = '#8E2F3A',
  RED_L = '#A93F48',
  RED_D = '#6E2230';
const MAMA_COAT = '#C0525E',
  GRAN_FUR = '#D99A68',
  GRAN_CREAM = '#FFF8EE',
  GRAN_DRESS = '#5E6F9A',
  GRAN_SHAWL = '#9A3E6A';

// ——— Sky and light ———
const SKY_KEYS: readonly (readonly [number, readonly string[]])[] = [
  [0, ['#2A2C5C', '#4E3D78', '#9C5878', '#EC9668']],
  [0.2, ['#1B2150', '#2C3266', '#46427A', '#6E5486']],
  [0.26, ['#0B1132', '#131B45', '#1B2757', '#28366A']],
  [0.68, ['#0B1132', '#131B45', '#1B2757', '#28366A']],
  [0.72, ['#17204E', '#283870', '#476292', '#8AA4C6']],
  [0.775, ['#2C3C78', '#62679C', '#CE9696', '#F4C48E']],
  [0.83, ['#6484C0', '#BCA4C4', '#F6BC9A', '#FFDFA0']],
  [0.93, ['#86C0EA', '#A6D0EE', '#CCE4EF', '#F2ECD4']],
];
function skyAt(p: number) {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && p >= SKY_KEYS[i + 1][0]) i++;
  const [a, from] = SKY_KEYS[i],
    [b, to] = SKY_KEYS[i + 1];
  const t = ease(span(p, a, b));
  return from.map((color, j) => mix(color, to[j], t));
}
const starry = (p: number) => clamp(span(p, 0.16, 0.24) - span(p, 0.72, 0.78));

/** Flat colour bands joined by a single row of checker dither (lighter on the call budget). */
function bands(
  ctx: Ctx,
  colors: readonly string[],
  top: number,
  bottom: number,
  left = 0,
  width = W,
) {
  const step = (bottom - top) / colors.length;
  colors.forEach((color, i) => box(ctx, left, top + i * step, width, Math.ceil(step) + 1, color));
  for (let i = 1; i < colors.length; i++) {
    const y = Math.round(top + i * step);
    for (let x = left; x < left + width; x += 4) {
      box(ctx, x, y - 1, 2, 1, colors[i]);
      box(ctx, x + 2, y, 2, 1, colors[i - 1]);
    }
  }
}
function stars(
  ctx: Ctx,
  seconds: number,
  amount: number,
  { count = 30, seed = 3, left = 0, top = 0, width = W, height = 100, size = 1 } = {},
) {
  if (amount <= 0) return;
  faded(ctx, amount, () => {
    for (let i = 0; i < count; i++) {
      const x = left + rand(seed + i * 3.1) * width,
        y = top + rand(seed + i * 5.7) * height;
      const twinkle = Math.sin(seconds * (0.7 + rand(seed + i) * 0.8) + i * 2.3);
      const color = i % 3 ? '#FFF1C8' : '#AFC2E8';
      box(ctx, x, y, size, size, color);
      if (twinkle > 0.6 && i % 4 === 0) {
        box(ctx, x - size, y, size * 3, size, alpha(color, 0.5));
        box(ctx, x, y - size, size, size * 3, alpha(color, 0.5));
      }
    }
  });
}
function moon(ctx: Ctx, x: number, y: number, r: number) {
  glow(ctx, x, y, r * 6, '#C9D6F2', 0.28);
  disc(ctx, x, y, r, '#F6F1DA');
  disc(ctx, x - r * 0.3, y - r * 0.2, r * 0.22, '#E2DBC0');
  disc(ctx, x + r * 0.35, y + r * 0.3, r * 0.16, '#E2DBC0');
}
/** A ridge of hills across a frame: `off` scrolls it for parallax. */
function ridge(
  ctx: Ctx,
  color: string,
  left: number,
  width: number,
  base: number,
  amp: number,
  off: number,
  seed: number,
  bottom: number,
  step = 8,
) {
  const points = [left, bottom];
  for (let u = 0; u <= width + step; u += step) {
    const t = u + off;
    points.push(
      left + u,
      base -
        amp * (0.55 + 0.3 * Math.sin(t * 0.021 + seed) + 0.15 * Math.sin(t * 0.057 + seed * 2)),
    );
  }
  points.push(left + width + step, bottom);
  poly(ctx, color, points);
}
/** A row of pines: triangles on a band, scrolled by `off`. */
function pines(
  ctx: Ctx,
  color: string,
  left: number,
  width: number,
  ground: number,
  size: number,
  off: number,
  seed: number,
) {
  const gap = size * 0.9;
  const first = Math.floor(off / gap);
  box(ctx, left, ground - size * 0.3, width, size * 2, color);
  for (let i = first; i * gap - off < width + size; i++) {
    const x = left + i * gap - off;
    const h = size * (1.2 + rand(seed + i) * 1.1);
    poly(ctx, color, [x - size * 0.55, ground, x, ground - h, x + size * 0.55, ground]);
  }
}

// ——— Characters ———
type Pt = { x: number; y: number };
function turn(x: number, y: number, cx: number, cy: number, angle: number): Pt {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return { x: cx + (x - cx) * c - (y - cy) * s, y: cy + (x - cx) * s + (y - cy) * c };
}
function limb(ctx: Ctx, x: number, y: number, angle: number, length: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-angle);
  box(ctx, -1, 0, 2.5, length, color);
  ctx.restore();
}
function ear(ctx: Ctx, x: number, y: number, angle: number, fur: string, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, size);
  poly(ctx, fur, [-2.6, 1, 0, -9, 2.6, 1]);
  poly(ctx, EAR_IN, [-1.3, 0, 0, -6, 1.3, 0]);
  poly(ctx, SOCK, [-1, -5.2, 0, -9, 1, -5.2]);
  ctx.restore();
}

type Eyes = 'open' | 'wide' | 'happy' | 'closed' | 'squeeze';
type Fox = {
  size?: number;
  facing?: 1 | -1;
  fur?: string;
  cream?: string;
  pose?: 'stand' | 'sit' | 'leap';
  step?: number;
  /** Arm angles from hanging down; positive swings toward the facing side. */
  arms?: readonly [number, number];
  /** Paws that go to the face: pinching cheeks, propping eyelids, rubbing eyes. */
  paws?: 'cheeks' | 'lids' | 'rub';
  phase?: number;
  frontArm?: boolean;
  eyes?: Eyes;
  /** 0 = eyelids up, 1 = shut. */
  lids?: number;
  mouth?: 'smile' | 'grin' | 'o' | 'flat' | 'yawn';
  yawn?: number;
  /** 0 = ears up, 1 = flat back. */
  ears?: number;
  lean?: number;
  tilt?: number;
  pinch?: number;
  scarf?: boolean;
  pack?: boolean;
  blanket?: number;
  adult?: boolean;
  dress?: string;
  shawl?: string;
  glasses?: boolean;
  wag?: number;
};
type Pose = { front: Pt; back: Pt; head: Pt; shoulder: Pt };

/**
 * A fox in three-quarter view: big head, pointed snout, bushy white-tipped tail. (x, y) is
 * the ground between the feet, or the seat under the hips when sitting.
 */
function fox(ctx: Ctx, x: number, y: number, f: Fox): Pose {
  const s = f.size ?? 1,
    dir = f.facing ?? 1;
  const fur = f.fur ?? FUR,
    cream = f.cream ?? CREAM,
    shadow = mix(fur, '#2A1510', 0.28);
  const adult = !!f.adult,
    pose = f.pose ?? 'stand';
  const legLen = adult ? 10 : 6;
  const swing = f.step === undefined ? 0 : Math.sin(f.step);
  const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step)) * 0.8;
  const hipY = pose === 'sit' ? -2 : -legLen - bob;
  const torsoY = adult ? -8 : -6,
    rx = adult ? 6 : 5,
    ry = adult ? 8.5 : 6.5;
  const shoulderY = adult ? -13 : -10,
    neckY = adult ? -15 : -12;
  const hx = 1,
    hy = adult ? -22 : -18;
  const armLen = adult ? 9.5 : 7;
  const lean = f.lean ?? 0,
    tilt = f.tilt ?? 0,
    pinch = f.pinch ?? 0;
  const headToHip = (px: number, py: number) => turn(px, py, hx, neckY, tilt);
  const toWorld = (pt: Pt) => {
    const r = turn(pt.x, pt.y, 0, 0, lean);
    return { x: x + dir * s * r.x, y: y + s * (hipY + r.y) };
  };
  const shoulderBack = { x: -1, y: shoulderY },
    shoulderFront = { x: 2, y: shoulderY };
  const reach = (from: Pt, angle: number) => ({
    x: from.x + Math.sin(angle) * armLen,
    y: from.y + Math.cos(angle) * armLen,
  });
  const [backAngle, frontAngle] = f.arms ?? [-swing * 0.6, swing * 0.6];
  let backPaw = reach(shoulderBack, backAngle),
    frontPaw = reach(shoulderFront, frontAngle);
  let backInFront = false;
  if (f.paws === 'cheeks') {
    backPaw = headToHip(hx - 7 - pinch * 4, hy + 3);
    frontPaw = headToHip(hx + 8 + pinch * 4, hy + 3);
  } else if (f.paws === 'lids') {
    backPaw = headToHip(hx + 1, hy - 6);
    frontPaw = headToHip(hx + 5, hy - 6);
  } else if (f.paws === 'rub') {
    const c = Math.cos(f.phase ?? 0),
      sn = Math.sin(f.phase ?? 0);
    backPaw = headToHip(hx + 1 + c, hy - 2 + sn);
    frontPaw = headToHip(hx + 5 - c, hy - 2 - sn);
    backInFront = true;
  }
  const sleeve = adult && f.dress ? f.dress : fur;
  const arm = (from: Pt, to: Pt, color: string) => {
    line(ctx, color, adult ? 2.8 : 2.4, [from.x, from.y, to.x, to.y]);
    disc(ctx, to.x, to.y, 1.4, SOCK);
  };

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  // Legs: dark fox stockings.
  if (pose === 'sit') {
    box(ctx, -1, -4, 10, 4, fur);
    box(ctx, 8, -5, 3, 4, SOCK);
  } else if (pose === 'leap') {
    limb(ctx, -2, hipY + 1, -1.2, legLen, SOCK);
    limb(ctx, 2, hipY + 1, 1.1, legLen, SOCK);
  } else {
    box(ctx, -3 - swing * 1.5, -legLen, 2.5, legLen, mix(SOCK, '#000000', 0.25));
    box(ctx, -4 - swing * 1.5, -1.5, 4, 1.5, SOCK);
    box(ctx, 1 + swing * 1.5, -legLen, 2.5, legLen, SOCK);
    box(ctx, 1 + swing * 1.5, -1.5, 4, 1.5, SOCK);
  }
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  // Tail.
  ctx.save();
  ctx.translate(-4, -1);
  ctx.rotate((pose === 'sit' ? 0.15 : pose === 'leap' ? -0.2 : 0.65) + (f.wag ?? 0));
  oval(ctx, -6.5, 0, 6.5, 3.4, fur);
  oval(ctx, -6, 1.4, 5, 1.6, FUR_D);
  oval(ctx, -11.5, 0, 3, 2.6, cream);
  ctx.restore();
  if (!backInFront)
    arm(shoulderBack, backPaw, adult && f.dress ? mix(f.dress, '#000000', 0.2) : shadow);
  if (f.paws === 'lids') arm(shoulderFront, frontPaw, sleeve);
  // Body.
  oval(ctx, 0.5, torsoY, rx, ry, fur);
  oval(ctx, 2.8, torsoY - 0.5, rx * 0.5, ry * 0.7, cream);
  if (adult && f.dress) {
    poly(ctx, f.dress, [-rx + 0.5, shoulderY - 1, rx, shoulderY - 1, rx + 2.5, 5, -rx - 1.5, 5]);
    poly(ctx, cream, [0.5, neckY + 1, 4.5, neckY + 1, 2.5, neckY + 5]);
    for (const by of [shoulderY + 4, shoulderY + 8]) disc(ctx, 3.8, by, 0.7, GOLD);
  }
  if (f.shawl) {
    poly(ctx, f.shawl, [
      -rx - 1,
      neckY,
      rx + 1,
      neckY,
      rx + 2,
      shoulderY + 6,
      1,
      shoulderY + 10,
      -rx - 2,
      shoulderY + 6,
    ]);
    for (let i = 0; i < 5; i++) box(ctx, -rx + i * 2.2, shoulderY + 7 + i * 0.6, 1, 2, GOLD);
  }
  if (f.pack) {
    box(ctx, -rx - 4, shoulderY - 1, 5, 9, PACK);
    box(ctx, -rx - 4, shoulderY - 1, 5, 2.5, PACK_D);
    box(ctx, -rx - 3, shoulderY + 4, 3, 1, GOLD);
  }
  const blanket = f.blanket ?? 0;
  if (blanket > 0) {
    const top = lerp(-1, neckY + 2, blanket);
    poly(ctx, '#3F6E86', [-rx - 1, top, 7, top - 1, 14, 0, 14, 3, -rx - 1, 3]);
    for (let i = 0; i < 4; i++) box(ctx, -rx + i * 5, top, 1, 3 - top, alpha('#E6C36A', 0.7));
    box(ctx, -rx - 1, top + (3 - top) * 0.45, 21, 1, alpha('#1F3F52', 0.8));
  }
  // Head.
  ctx.save();
  ctx.translate(hx, neckY);
  ctx.rotate(tilt);
  ctx.translate(-hx, -neckY);
  const ears = f.ears ?? 0;
  ear(ctx, hx - 4, hy - 4, -0.4 - ears * 0.9, fur);
  ear(ctx, hx + 2, hy - 5, 0.1 - ears * 0.9, fur);
  if (pinch > 0) oval(ctx, hx - 7 - pinch * 3.5, hy + 3, 2 + pinch * 3.5, 2.6, fur);
  oval(ctx, hx, hy, 7.5, 6.5, fur);
  poly(ctx, cream, [hx - 7, hy + 1, hx - 2, hy + 6, hx - 8, hy + 5]);
  const yawn = f.mouth === 'yawn' ? (f.yawn ?? 1) : 0;
  oval(ctx, hx + 4.5, hy + 3 + yawn * 1.2, 4.8, 2.8 + yawn * 1.6, cream);
  poly(ctx, fur, [hx + 2, hy - 0.5, hx + 9.5, hy + 1, hx + 9.5, hy + 2, hx + 3, hy + 2]);
  oval(ctx, hx + 9.6, hy + 1.6, 1.5, 1.2, NOSE);
  if (pinch > 0) oval(ctx, hx + 8 + pinch * 3.5, hy + 3.5, 2 + pinch * 3.5, 2.6, cream);
  // Eyes.
  const lids = clamp(f.lids ?? 0);
  const style = f.eyes ?? 'open';
  for (const [i, ex] of [hx, hx + 4].entries()) {
    const ey = hy - 3;
    if (style === 'wide') {
      box(ctx, ex - 1, ey - 1, 3, 4, '#FFFFFF');
      box(ctx, ex, ey, 2, 2, INK);
    } else if (style === 'happy') {
      box(ctx, ex - 1, ey + 2, 1, 1, INK);
      box(ctx, ex, ey + 1, 2, 1, INK);
      box(ctx, ex + 2, ey + 2, 1, 1, INK);
    } else if (style === 'squeeze') {
      const d = i ? -1 : 1;
      box(ctx, ex + (d > 0 ? 0 : 1), ey, 1, 1, INK);
      box(ctx, ex + (d > 0 ? 1 : 0), ey + 1, 1, 1, INK);
      box(ctx, ex + (d > 0 ? 0 : 1), ey + 2, 1, 1, INK);
    } else if (style === 'closed' || lids > 0.85) {
      box(ctx, ex - 1, ey + 2, 4, 1, INK);
    } else {
      box(ctx, ex, ey, 2, 3, INK);
      box(ctx, ex + 1, ey, 1, 1, '#FFFFFF');
      const rows = Math.round(lids * 3);
      if (rows > 0) {
        box(ctx, ex - 1, ey - 1, 4, rows, fur);
        box(ctx, ex - 1, ey + rows - 1, 4, 1, INK);
      }
    }
  }
  if (f.glasses) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 0.6;
    for (const ex of [hx + 1, hx + 5]) {
      ctx.beginPath();
      ctx.arc(ex, hy - 1.5, 2.2, 0, TAU);
      ctx.stroke();
    }
    box(ctx, hx - 1, hy - 5, 3, 1, '#FFFFFF');
    box(ctx, hx + 3, hy - 5, 3, 1, '#FFFFFF');
  }
  box(ctx, hx + 3, hy + 1, 2, 1, alpha('#E77E7A', 0.85));
  const mx = hx + 6,
    my = hy + 4;
  switch (f.mouth ?? 'smile') {
    case 'smile':
      box(ctx, mx - 1, my, 1, 1, INK);
      box(ctx, mx, my + 1, 2, 1, INK);
      break;
    case 'grin':
      box(ctx, mx - 2, my, 5, 2, INK);
      box(ctx, mx - 1, my, 3, 1, '#FFFFFF');
      break;
    case 'o':
      box(ctx, mx, my, 2, 2, INK);
      break;
    case 'flat':
      box(ctx, mx - 1, my + 1, 3, 1, INK);
      break;
    case 'yawn':
      oval(ctx, mx - 0.5, my + 1 + yawn * 1.4, 1.8 + yawn * 1.8, 0.8 + yawn * 3, '#5A1D24');
      oval(ctx, mx - 0.5, my + 2.5 + yawn * 3, 0.5 + yawn * 1.4, yawn * 1.1, '#E47A84');
      break;
  }
  ctx.restore();
  if (f.scarf) {
    const flap = Math.sin((f.phase ?? 0) * 0.7) * 0.8;
    poly(ctx, SCARF_D, [
      -3,
      neckY + 1,
      -7 - flap,
      neckY + 7,
      -4.5 - flap,
      neckY + 8,
      -1,
      neckY + 2,
    ]);
    box(ctx, -4, neckY - 1, 9, 3, SCARF);
    box(ctx, -4, neckY + 1, 9, 1, SCARF_D);
    box(ctx, 2, neckY + 1, 2, 5, SCARF);
    box(ctx, 2, neckY + 5, 2, 1, '#F2E6C8');
  }
  if (backInFront) arm(shoulderBack, backPaw, shadow);
  // Propping the eyelids: arms tucked behind the head, paws on the brows.
  if (f.paws === 'lids') for (const paw of [backPaw, frontPaw]) disc(ctx, paw.x, paw.y, 1.6, SOCK);
  if (f.frontArm !== false && f.paws !== 'lids') arm(shoulderFront, frontPaw, sleeve);
  ctx.restore();
  return {
    front: toWorld(frontPaw),
    back: toWorld(backPaw),
    head: toWorld(headToHip(hx, hy)),
    shoulder: toWorld(shoulderFront),
  };
}

/** Fennel face-on, for the close-ups through the glass and over the top of his drawing. */
type Face = {
  eyes?: Eyes;
  lids?: number;
  look?: number;
  mouth?: 'smile' | 'o' | 'awe' | 'grin' | 'flat';
  ears?: number;
  squash?: number;
  sparkle?: boolean;
};
function foxFace(ctx: Ctx, x: number, y: number, s: number, f: Face) {
  const squash = f.squash ?? 0,
    ears = f.ears ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Shoulders, scarf, then the head on top.
  oval(ctx, 0, 22, 15, 11, FUR);
  oval(ctx, 0, 23, 6, 9, CREAM);
  ear(ctx, -8, -6, -0.45 - ears * 0.6, FUR, 1.35);
  ear(ctx, 8, -6, 0.45 + ears * 0.6, FUR, 1.35);
  oval(ctx, 0, 0, 13 + squash, 10.5, FUR);
  poly(ctx, CREAM, [-12.5, 1, -7, 8, -15, 6.5]);
  poly(ctx, CREAM, [12.5, 1, 7, 8, 15, 6.5]);
  oval(ctx, -5.5, 3.5, 4.5 + squash, 3.2, CREAM);
  oval(ctx, 5.5, 3.5, 4.5 + squash, 3.2, CREAM);
  oval(ctx, 0, 5, 6 + squash * 2, 4.8, CREAM);
  // Eyes.
  const look = Math.round(f.look ?? 0);
  const lids = clamp(f.lids ?? 0);
  for (const ex of [-5, 5]) {
    const ey = -3;
    const style = f.eyes ?? 'open';
    if (style === 'wide') {
      box(ctx, ex - 2, ey - 2, 4, 5, '#FFFFFF');
      box(ctx, ex - 1 + look, ey - 1, 2, 3, INK);
      if (f.sparkle) box(ctx, ex + look, ey - 1, 1, 1, '#FFFFFF');
    } else if (style === 'happy') {
      box(ctx, ex - 2, ey + 1, 1, 1, INK);
      box(ctx, ex - 1, ey, 2, 1, INK);
      box(ctx, ex + 1, ey + 1, 1, 1, INK);
    } else if (style === 'closed' || lids > 0.85) box(ctx, ex - 2, ey + 1, 4, 1, INK);
    else {
      box(ctx, ex - 1 + look, ey - 1, 2, 3, INK);
      box(ctx, ex + look, ey - 1, 1, 1, '#FFFFFF');
      const rows = Math.round(lids * 3);
      if (rows > 0) {
        box(ctx, ex - 2, ey - 2, 4, rows + 1, FUR);
        box(ctx, ex - 2, ey - 2 + rows, 4, 1, INK);
      }
    }
  }
  box(ctx, -9, 1, 2, 1, alpha('#E77E7A', 0.9));
  box(ctx, 7, 1, 2, 1, alpha('#E77E7A', 0.9));
  // Nose, flattened against the glass when pressed.
  oval(ctx, 0, 2.5, 2.3 + squash * 1.6, 1.6 - squash * 0.4, NOSE);
  box(ctx, -1, 1.5, 1, 1, alpha('#FFFFFF', 0.5));
  switch (f.mouth ?? 'smile') {
    case 'smile':
      box(ctx, -2, 5, 1, 1, INK);
      box(ctx, -1, 6, 1, 1, INK);
      box(ctx, 0, 5, 1, 1, INK);
      box(ctx, 1, 6, 1, 1, INK);
      box(ctx, 2, 5, 1, 1, INK);
      break;
    case 'o':
      oval(ctx, 0, 6.5, 1.3, 1.6, INK);
      break;
    case 'awe':
      oval(ctx, 0, 7, 2.4, 3, '#5A1D24');
      oval(ctx, 0, 8.6, 1.5, 1, '#E47A84');
      break;
    case 'grin':
      poly(ctx, '#5A1D24', [-5, 5, 5, 5, 3.5, 8, 0, 9.5, -3.5, 8]);
      box(ctx, -4, 5, 8, 1, '#FFFFFF');
      oval(ctx, 0, 8.2, 2, 0.9, '#E47A84');
      break;
    case 'flat':
      box(ctx, -2, 6, 5, 1, INK);
      break;
  }
  // Scarf.
  box(ctx, -11, 10, 22, 4, SCARF);
  box(ctx, -11, 13, 22, 1, SCARF_D);
  box(ctx, 4, 13, 4, 9, SCARF);
  box(ctx, 4, 21, 4, 1, '#F2E6C8');
  ctx.restore();
}
function pawPad(ctx: Ctx, x: number, y: number, s: number) {
  oval(ctx, x, y, 3.4 * s, 3.8 * s, SOCK);
  oval(ctx, x, y + 0.8 * s, 1.5 * s, 1.2 * s, '#D98C8C');
  for (const dx of [-1.8, 0, 1.8]) disc(ctx, x + dx * s, y - 2 * s, 0.7 * s, '#D98C8C');
}

type Badger = {
  size?: number;
  facing?: 1 | -1;
  step?: number;
  arms?: readonly [number, number];
  lean?: number;
  tilt?: number;
  eyes?: 'open' | 'happy' | 'closed';
  mouth?: 'smile' | 'o' | 'grin';
  cap?: number;
  /** 0: none, 1: pocket watch shut in the front paw, 2: open. */
  watch?: number;
  /** Stretches the front arm, for a long, gentle reach. */
  reach?: number;
};
/** Conductor Badger: old, kind, brass-buttoned, with a pocket watch on a chain. */
function badger(ctx: Ctx, x: number, y: number, b: Badger): Pose {
  const s = b.size ?? 1,
    dir = b.facing ?? 1;
  const swing = b.step === undefined ? 0 : Math.sin(b.step);
  const bob = b.step === undefined ? 0 : Math.abs(Math.cos(b.step));
  const hipY = -10 - bob;
  const lean = b.lean ?? 0,
    tilt = b.tilt ?? 0;
  const hx = 2.5,
    hy = -26,
    neckY = -19;
  const shoulderBack = { x: -2, y: -16 },
    shoulderFront = { x: 2.5, y: -16 };
  const [backAngle, frontAngle] = b.arms ?? [-swing * 0.5, swing * 0.5];
  const reach = (from: Pt, angle: number, length = 11) => ({
    x: from.x + Math.sin(angle) * length,
    y: from.y + Math.cos(angle) * length,
  });
  const backPaw = reach(shoulderBack, backAngle),
    frontPaw = reach(shoulderFront, frontAngle, 11 * (b.reach ?? 1));
  const toWorld = (pt: Pt) => {
    const r = turn(pt.x, pt.y, 0, 0, lean);
    return { x: x + dir * s * r.x, y: y + s * (hipY + r.y) };
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  box(ctx, -4 - swing * 1.5, -10, 3.5, 9, NAVY_D);
  box(ctx, -5 - swing * 1.5, -2, 5, 2, '#15151B');
  box(ctx, 1 + swing * 1.5, -10, 3.5, 9, NAVY);
  box(ctx, 0.5 + swing * 1.5, -2, 5.5, 2, '#15151B');
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  line(ctx, NAVY_D, 3.2, [shoulderBack.x, shoulderBack.y, backPaw.x, backPaw.y]);
  disc(ctx, backPaw.x, backPaw.y, 1.8, '#6F6C75');
  // Round body in a brass-buttoned coat.
  oval(ctx, 0, -8, 8.2, 10.5, NAVY_D);
  oval(ctx, 0.9, -8, 7.3, 10, NAVY);
  box(ctx, -7, 1, 15, 1.5, NAVY_D);
  for (const [bx, by] of [
    [5.6, -15],
    [6.4, -11],
    [6.6, -7],
    [6.2, -3],
  ])
    disc(ctx, bx, by, 0.8, BRASS);
  if (!b.watch) line(ctx, BRASS, 0.6, [6.4, -11, 4.8, -8, 3, -7]);
  // Head: grey, white face, black stripe through the eye, little round spectacles.
  ctx.save();
  ctx.translate(hx, neckY);
  ctx.rotate(tilt);
  ctx.translate(-hx, -neckY);
  disc(ctx, hx - 4, hy - 4.5, 2.3, STRIPE);
  disc(ctx, hx - 4, hy - 4.5, 1, '#D8D4CC');
  oval(ctx, hx - 0.5, hy, 6.5, 6, BADGER);
  poly(ctx, BADGER_FACE, [
    hx - 4,
    hy - 5.5,
    hx + 2,
    hy - 6,
    hx + 10.5,
    hy + 1,
    hx + 10,
    hy + 2.8,
    hx + 3,
    hy + 5,
    hx - 3,
    hy + 3.5,
  ]);
  poly(ctx, STRIPE, [
    hx - 6,
    hy - 3.5,
    hx - 1,
    hy - 4.5,
    hx + 9.5,
    hy + 0.2,
    hx + 9.2,
    hy + 1.2,
    hx - 1,
    hy - 0.8,
    hx - 6.2,
    hy - 0.5,
  ]);
  oval(ctx, hx + 10.2, hy + 1, 1.5, 1.1, NOSE);
  const eyes = b.eyes ?? 'open';
  if (eyes === 'open') {
    box(ctx, hx + 2.5, hy - 3, 2, 2, '#0B0A0E');
    box(ctx, hx + 3.5, hy - 3, 1, 1, '#FFFFFF');
  } else if (eyes === 'happy') {
    box(ctx, hx + 2, hy - 2, 1, 1, '#EDE8DC');
    box(ctx, hx + 3, hy - 3, 1, 1, '#EDE8DC');
    box(ctx, hx + 4, hy - 2, 1, 1, '#EDE8DC');
  } else box(ctx, hx + 2, hy - 2, 3, 1, '#EDE8DC');
  box(ctx, hx + 1, hy - 5.5, 5, 1.5, '#FFFFFF');
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(hx + 3.5, hy - 1.8, 2.3, 0, TAU);
  ctx.stroke();
  const mouth = b.mouth ?? 'smile';
  if (mouth === 'smile') {
    box(ctx, hx + 5, hy + 3, 1, 1, INK);
    box(ctx, hx + 6, hy + 4, 2, 1, INK);
  } else if (mouth === 'grin') {
    box(ctx, hx + 5, hy + 3, 4, 2, INK);
    box(ctx, hx + 6, hy + 3, 2, 1, '#FFFFFF');
  } else box(ctx, hx + 6, hy + 3, 2, 2, INK);
  // Conductor's cap, which lifts off for a polite tip.
  const lift = b.cap ?? 0;
  ctx.save();
  ctx.translate(hx - 0.5, hy - 5);
  ctx.translate(lift * 2, -lift * 5);
  ctx.rotate(-lift * 0.45);
  box(ctx, -6, -4, 12, 4.5, NAVY);
  box(ctx, -6.5, -5.5, 13, 2, NAVY);
  box(ctx, -6, -0.5, 12, 1.3, NAVY_D);
  disc(ctx, 2.5, -2.8, 1.1, BRASS);
  poly(ctx, '#15151C', [4, 0, 10.5, 1.3, 4, 2]);
  ctx.restore();
  ctx.restore();
  // Front arm, with the pocket watch.
  line(ctx, NAVY, 3.2, [shoulderFront.x, shoulderFront.y, frontPaw.x, frontPaw.y]);
  if (b.watch) {
    line(ctx, BRASS, 0.6, [6.4, -11, frontPaw.x - 1, frontPaw.y]);
    disc(ctx, frontPaw.x + 1.5, frontPaw.y - 1.5, 2.8, BRASS);
    if (b.watch > 1) {
      disc(ctx, frontPaw.x + 1.5, frontPaw.y - 1.5, 2, '#FFF6DE');
      line(ctx, INK, 0.5, [
        frontPaw.x + 1.5,
        frontPaw.y - 3,
        frontPaw.x + 1.5,
        frontPaw.y - 1.5,
        frontPaw.x + 2.6,
        frontPaw.y - 1.5,
      ]);
      disc(ctx, frontPaw.x + 1.5, frontPaw.y - 6.5, 2.6, '#C99A3C');
    }
  }
  disc(ctx, frontPaw.x, frontPaw.y, 1.8, '#77747D');
  ctx.restore();
  return {
    front: toWorld(frontPaw),
    back: toWorld(backPaw),
    head: toWorld(turn(hx, hy, hx, neckY, tilt)),
    shoulder: toWorld(shoulderFront),
  };
}

/** The big bear in the seat opposite, facing left. `breath` swells him as he snores. */
function bear(ctx: Ctx, x: number, y: number, size: number, asleep: boolean, puff: number) {
  const b = asleep ? puff * 1.6 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-size, size);
  box(ctx, 0, -10, 22, 10, BEAR_D);
  oval(ctx, 23, -5, 3.5, 6, BEAR);
  oval(ctx, 24.5, -5, 1.8, 4, '#C9A27A');
  oval(ctx, -3, -21 - b * 0.5, 15 + b * 0.7, 17 + b * 0.6, JUMPER);
  box(ctx, -16, -7, 26, 3, JUMPER_D);
  oval(ctx, 1, -22 - b * 0.5, 7, 11 + b * 0.4, alpha('#5E8C84', 0.55));
  for (let i = 0; i < 3; i++) box(ctx, -12 + i * 6, -30 - b * 0.5, 1, 20, alpha(JUMPER_D, 0.6));
  const hx = 3,
    hy = -44 - b * 0.4;
  ctx.save();
  ctx.translate(hx, hy + 8);
  ctx.rotate(asleep ? -0.28 : 0);
  ctx.translate(-hx, -hy - 8);
  disc(ctx, hx - 7, hy - 8, 3.8, BEAR);
  disc(ctx, hx - 7, hy - 8, 1.9, BEAR_D);
  disc(ctx, hx + 4, hy - 10, 3.8, BEAR);
  disc(ctx, hx + 4, hy - 10, 1.9, BEAR_D);
  oval(ctx, hx, hy, 11, 10, BEAR);
  oval(ctx, hx + 8, hy + 3, 6, 4.5, '#C49D74');
  oval(ctx, hx + 13.5, hy + 1, 2.3, 1.7, NOSE);
  if (asleep) {
    box(ctx, hx + 3, hy - 2, 4, 1, INK);
    oval(ctx, hx + 9, hy + 6, 1 + b * 0.9, 0.6 + b * 1.1, '#4A1E1E');
  } else {
    box(ctx, hx + 4, hy - 3, 2, 2, INK);
    box(ctx, hx + 8, hy + 6, 3, 1, INK);
  }
  ctx.restore();
  // Paws folded on the tummy, and the newspaper.
  line(ctx, BEAR, 5, [-5, -32 - b * 0.5, 7, -19 - b * 0.4]);
  disc(ctx, 8, -19 - b * 0.4, 3, BEAR_D);
  if (!asleep) {
    poly(ctx, '#EFE6D2', [8, -58, 30, -60, 31, -30, 9, -28]);
    for (let i = 0; i < 6; i++) box(ctx, 12, -54 + i * 4, i % 3 ? 15 : 9, 1, '#9C9486');
    box(ctx, 12, -58, 14, 2, '#6A6258');
    disc(ctx, 9, -38, 3, BEAR_D);
    disc(ctx, 30, -42, 3, BEAR_D);
  } else {
    poly(ctx, '#EFE6D2', [-6, -16 - b * 0.3, 10, -22 - b * 0.4, 16, -10, -2, -6]);
    for (let i = 0; i < 3; i++) box(ctx, 0 + i * 3, -14 + i * 0.5 - b * 0.3, 7, 1, '#9C9486');
  }
  ctx.restore();
}

/** Floating snore Zs. */
function zees(ctx: Ctx, x: number, y: number, phase: number, size: number, color = '#FFF3D6') {
  for (let k = 0; k < 2; k++) {
    const t = (phase + k * 0.5) % 1;
    faded(ctx, hump(t, 0, 1), () =>
      write(ctx, 'z', x + t * 8 + Math.sin(t * 6) * 2, y - t * 16, {
        size: Math.round(size * (0.7 + t * 0.6)),
        color,
        type: 'italic',
      }),
    );
  }
}

/** Fennel's crayon picture of the sea he has never seen: a 60 × 42 sheet. */
function drawing(ctx: Ctx, x: number, y: number, scale: number, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(scale, scale);
  ctx.translate(-30, -21);
  box(ctx, 1.5, 1.5, 60, 42, alpha('#000000', 0.25));
  box(ctx, 0, 0, 60, 42, '#FBF4E2');
  box(ctx, 0, 40, 60, 2, '#E6D9BC');
  line(ctx, alpha('#8CC4EE', 0.9), 1.4, [4, 20, 12, 15, 9, 22, 20, 14, 16, 22, 28, 15, 24, 22]);
  for (let i = 0; i < 10; i++) {
    const a = (i * TAU) / 10;
    line(ctx, '#F29A38', 1.6, [
      44 + Math.cos(a) * 9.5,
      14 + Math.sin(a) * 9.5,
      44 + Math.cos(a) * 13.5,
      14 + Math.sin(a) * 13.5,
    ]);
  }
  disc(ctx, 44, 14, 8, '#FFD23F');
  box(ctx, 41, 12, 1.5, 1.5, '#C8761E');
  box(ctx, 46, 12, 1.5, 1.5, '#C8761E');
  line(ctx, '#C8761E', 1, [41, 16.5, 44, 18, 47, 16.5]);
  for (let r = 0; r < 4; r++) {
    const points: number[] = [];
    for (let u = 2; u <= 58; u += 4) points.push(u, 28 + r * 3.4 + (u % 8 ? 1.4 : -0.6));
    line(ctx, r % 2 ? '#2F6CC0' : '#4F92DA', 1.6, points);
  }
  // A little fox standing at the shore.
  oval(ctx, 9, 25, 2.6, 2.2, '#F07A2A');
  poly(ctx, '#F07A2A', [7, 23.5, 7.6, 20.5, 9, 23]);
  poly(ctx, '#F07A2A', [9.5, 23, 10.8, 20.5, 11.2, 23.5]);
  if (scale > 0.45)
    write(ctx, 'THE SEA!', 3, 9, { size: 8, color: '#D8433A', type: 'mono', align: 'left' });
  else box(ctx, 3, 5, 22, 3, '#D8433A');
  ctx.restore();
}

// ——— Trains ———
/** A small night train for the wide shots: engine at (x, y) on the rails, carriages behind. */
function miniTrain(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  { cars = 2, lit = 1, puffs = 0, day = false, steam = '#A9B4D4', one = false } = {},
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const body = day ? '#2F5A48' : '#1C3A30',
    dark = day ? '#1F3E32' : '#122620';
  const wheel = day ? '#8E2E2A' : '#4A1E22';
  // Steam trails back from the chimney, one puff per chug.
  for (let j = 5; j >= 0; j--) {
    const age = (puffs % 1) + j;
    oval(
      ctx,
      -6 - age * 7,
      -21 - age * 2.4,
      2 + age * 1.3,
      1.6 + age,
      alpha(steam, 0.6 * (1 - age / 6.5)),
    );
  }
  box(ctx, -26, -14, 23, 8, body);
  box(ctx, -3, -15, 3, 10, dark);
  box(ctx, -8, -19, 3, 5, dark);
  box(ctx, -9, -20, 5, 1.5, dark);
  box(ctx, -16, -16, 4, 2, GOLD);
  box(ctx, -34, -19, 9, 13, body);
  box(ctx, -35, -20.5, 11, 1.5, dark);
  box(ctx, -32, -17, 4, 3, '#FFB860');
  box(ctx, -34, -6, 34, 2, '#101014');
  for (const wx of [-8, -15, -22]) disc(ctx, wx, -3, 3, wheel);
  poly(ctx, dark, [0, -5, 3, -1, 0, -1]);
  glow(ctx, 1, -11, 14, '#FFE0A0', lit * 0.5);
  disc(ctx, 0.5, -11, 1, '#FFF2C8');
  box(ctx, -46, -13, 11, 9, dark);
  disc(ctx, -43, -3, 2, wheel);
  disc(ctx, -38, -3, 2, wheel);
  for (let i = 0; i < cars; i++) {
    const cx = -48 - (i + 1) * 32;
    box(ctx, cx, -17, 30, 13, body);
    box(ctx, cx - 0.5, -18.5, 31, 2, ROOF);
    box(ctx, cx, -8, 30, 0.8, GOLD);
    for (let j = 0; j < 5; j++) {
      const on = one ? i === cars - 1 && j === 1 : lit > 0;
      box(ctx, cx + 2.5 + j * 5.4, -15, 3.5, 4, on ? WARM : '#2A3248');
    }
    disc(ctx, cx + 5, -3, 2.2, wheel);
    disc(ctx, cx + 25, -3, 2.2, wheel);
  }
  ctx.restore();
}

// ——— The departure platform, a 680 × 180 set ———
const TRAIN_TAIL = 60;
const DOOR = 72;
const trainShift = (p: number) => 210 * span(p, DEPART, at('room')) ** 2;
function carriage(ctx: Ctx, x0: number, width: number, door: number, seconds: number) {
  poly(ctx, ROOF, [x0 - 2, 67, x0 + 4, 59, x0 + width - 4, 59, x0 + width + 2, 67]);
  box(ctx, x0, 66, width, 68, CAR);
  box(ctx, x0, 116, width, 18, CAR_D);
  box(ctx, x0, 114, width, 1.5, GOLD);
  box(ctx, x0, 70, width, 1, alpha(GOLD, 0.6));
  box(ctx, x0 + 4, 134, width - 8, 5, '#15151B');
  // Rear door with its step; the windows are warm and full of passengers.
  if (door) {
    box(ctx, x0 + 4, 74, 16, 60, door > 1 ? '#6E3E24' : CAR_D);
    if (door > 1) glow(ctx, x0 + 12, 104, 18, WARM, 0.45);
    else box(ctx, x0 + 7, 80, 10, 12, WARM);
    box(ctx, x0 + 2, 134, 20, 3, '#6C6C74');
    line(ctx, BRASS, 1, [x0 + 22, 80, x0 + 22, 128]);
  }
  for (let i = 0; door ? 26 + i * 26 < width - 20 : i * 26 < width - 20; i++) {
    const wx = x0 + (door ? 26 : 8) + i * 26;
    box(ctx, wx - 1, 79, 20, 22, '#1A2A24');
    box(ctx, wx, 80, 18, 20, WARM);
    box(ctx, wx, 80, 18, 3, '#C9804A');
    // Silhouettes of other travellers.
    const kind = Math.floor(rand(x0 * 0.7 + i * 13) * 5);
    const sil = '#C2804A';
    const bobble = Math.sin(seconds * 1.1 + i) * 0.5;
    if (kind === 0 && i > 0) {
      oval(ctx, wx + 9, 94 + bobble, 5, 6, sil);
      box(ctx, wx + 6, 83 + bobble, 2, 8, sil);
      box(ctx, wx + 10, 83 + bobble, 2, 8, sil);
    } else if (kind === 1) {
      oval(ctx, wx + 8, 93, 6, 7, sil);
      poly(ctx, sil, [wx + 3, 88, wx + 5, 84, wx + 7, 88]);
      poly(ctx, sil, [wx + 9, 88, wx + 11, 84, wx + 13, 88]);
    } else if (kind === 2) {
      oval(ctx, wx + 10, 95, 5, 5, sil);
      box(ctx, wx + 6, 88, 9, 2, sil);
      box(ctx, wx + 8, 84, 5, 4, sil);
    }
  }
}
function engine(ctx: Ctx, x0: number, p: number, seconds: number) {
  // Tender, cab, boiler, chimney, and the brass whistle on top.
  box(ctx, x0, 82, 34, 52, '#1E3A30');
  box(ctx, x0, 80, 34, 3, '#15151B');
  box(ctx, x0 + 38, 62, 28, 72, '#26463A');
  box(ctx, x0 + 36, 58, 32, 5, '#15151B');
  box(ctx, x0 + 42, 70, 14, 14, '#FFB060');
  glow(ctx, x0 + 49, 77, 22, '#FF9A40', 0.35);
  // The driver, a mole in goggles, at the cab window.
  oval(ctx, x0 + 50, 80, 5, 5, '#3A3040');
  box(ctx, x0 + 50, 76, 5, 2, '#9A8C70');
  box(ctx, x0 + 66, 86, 76, 36, '#26463A');
  box(ctx, x0 + 66, 86, 76, 4, '#335A4A');
  for (const bx of [x0 + 80, x0 + 104, x0 + 128]) box(ctx, bx, 86, 2, 36, GOLD);
  box(ctx, x0 + 142, 82, 10, 44, '#1C1C22');
  disc(ctx, x0 + 147, 104, 3, '#2A2A32');
  box(ctx, x0 + 126, 62, 10, 24, '#1C1C22');
  box(ctx, x0 + 123, 58, 16, 5, '#1C1C22');
  box(ctx, x0 + 99, 80, 10, 7, BRASS);
  oval(ctx, x0 + 104, 80, 5, 3, BRASS);
  box(ctx, x0 + 82, 72, 3, 14, BRASS);
  box(ctx, x0 + 80, 68, 7, 5, BRASS);
  box(ctx, x0 + 82, 66, 3, 2, '#FFE6A0');
  box(ctx, x0 + 60, 122, 94, 12, '#15151B');
  const roll = trainShift(p) / 13;
  for (const wx of [x0 + 88, x0 + 116]) {
    disc(ctx, wx, 132, 13, '#A8322E');
    for (let k = 0; k < 3; k++) {
      const a = roll + (k * Math.PI) / 3;
      line(ctx, '#6E1E1C', 1.5, [
        wx - Math.cos(a) * 11,
        132 - Math.sin(a) * 11,
        wx + Math.cos(a) * 11,
        132 + Math.sin(a) * 11,
      ]);
    }
    disc(ctx, wx, 132, 3, '#E0B060');
  }
  line(ctx, '#C9C9C9', 2, [
    x0 + 88 + Math.cos(roll) * 7,
    128 + Math.sin(roll) * 3,
    x0 + 116 + Math.cos(roll) * 7,
    128 + Math.sin(roll) * 3,
  ]);
  glow(ctx, x0 + 152, 96, 30, '#FFE6A0', 0.5);
  disc(ctx, x0 + 152, 96, 3, '#FFF4D0');
  // Chimney smoke, and the whistle's plume.
  for (let j = 0; j < 5; j++) {
    const t = (seconds * 0.4 + j / 5) % 1;
    oval(
      ctx,
      x0 + 131 - t * 30,
      54 - t * 34,
      4 + t * 12,
      3 + t * 8,
      alpha('#BFC2D6', 0.5 * (1 - t)),
    );
  }
  const blow = hump(p, WHISTLE, WHISTLE + sec(1.4));
  if (blow > 0)
    for (let j = 0; j < 8; j++) {
      const t = (seconds * 1.6 + j / 8) % 1;
      oval(
        ctx,
        x0 + 83 - t * 14,
        64 - t * 44,
        3 + t * 12,
        2 + t * 8,
        alpha('#FFFFFF', 0.85 * (1 - t) * blow),
      );
    }
}
function platformSet(ctx: Ctx, p: number, seconds: number) {
  const shift = trainShift(p);
  // Beyond the line: dusk hills and the lights of the town we're leaving.
  ridge(ctx, '#3E3464', 0, 680, 120, 26, 0, 2, 142, 16);
  for (let i = 0; i < 16; i++) {
    const hx = 150 + i * 30 + rand(i) * 12,
      hy = 118 + rand(i * 3) * 8;
    box(ctx, hx, hy, 10, 14, '#2E2850');
    poly(ctx, '#2E2850', [hx - 2, hy, hx + 5, hy - 6, hx + 12, hy]);
    if (i % 2) box(ctx, hx + 3, hy + 4, 2, 3, WARM);
  }
  box(ctx, 0, 134, 680, 8, '#231C2A');
  ctx.save();
  ctx.translate(shift, 0);
  carriage(ctx, TRAIN_TAIL, 220, p < 0.062 ? 1 : 2, seconds);
  carriage(ctx, 286, 220, 0, seconds);
  engine(ctx, 512, p, seconds);
  // A red tail lamp on the last carriage.
  disc(ctx, TRAIN_TAIL + 3, 72, 2, '#E0453A');
  glow(ctx, TRAIN_TAIL + 3, 72, 10, '#FF5A40', 0.5);
  ctx.restore();
  // The platform.
  box(ctx, 0, 140, 680, 40, '#5E5468');
  box(ctx, 0, 140, 680, 2, GOLD);
  box(ctx, 0, 142, 680, 3, '#4A4254');
  for (let x = 0; x < 680; x += 22) box(ctx, x, 148, 1, 32, '#544A5E');
  box(ctx, 0, 162, 680, 1, '#544A5E');
  // Station house.
  box(ctx, -10, 76, 50, 70, '#8E6A5A');
  poly(ctx, '#4A3040', [-16, 78, 15, 58, 46, 78]);
  box(ctx, 6, 92, 16, 20, '#1A1A22');
  box(ctx, 7, 93, 14, 18, WARM);
  box(ctx, 13, 93, 2, 18, '#8E6A5A');
  disc(ctx, 15, 70, 5, '#F4EAD0');
  line(ctx, INK, 1, [15, 70, 15, 67]);
  line(ctx, INK, 1, [15, 70, 17, 71]);
  // Lamp posts.
  for (const lx of [196, 330, 470]) {
    box(ctx, lx - 1, 72, 3, 70, '#2A2430');
    box(ctx, lx - 3, 138, 7, 4, '#2A2430');
    box(ctx, lx - 4, 64, 9, 9, '#3A3040');
    box(ctx, lx - 3, 65, 7, 6, '#FFE3A0');
    glow(ctx, lx, 68, 44, '#FFD08A', 0.45);
  }
  // Bench.
  box(ctx, 250, 150, 34, 3, '#6E4A36');
  box(ctx, 250, 143, 34, 3, '#6E4A36');
  box(ctx, 252, 153, 2, 8, '#3A2A24');
  box(ctx, 280, 153, 2, 8, '#3A2A24');
  // Steam drifting down the platform from the engine.
  for (let i = 0; i < 6; i++) {
    const t = (seconds * 0.05 + i / 6) % 1;
    oval(
      ctx,
      560 - t * 560,
      128 + Math.sin(i * 2 + seconds * 0.3) * 6,
      30 + i * 4,
      9,
      alpha('#D8D2E6', 0.16 * hump(t, 0, 1)),
    );
  }
  platformCast(ctx, p, seconds, shift);
}
function platformCast(ctx: Ctx, p: number, seconds: number, shift: number) {
  const wrapping = within(p, 0.004, 0.03),
    hug = within(p, 0.03, 0.046);
  const walk = span(p, 0.046, 0.056);
  const toDoor = span(p, 0.064, 0.07),
    climb = span(p, 0.07, 0.074);
  const riding = p >= at('depart');
  // Once the train moves, the conductor rides the step and Fennel waves from his window,
  // behind Mama on the platform.
  if (riding) {
    badger(ctx, TRAIN_TAIL + 14 + shift, 137, {
      size: 1.05,
      facing: 1,
      arms: [2.9, 2.5 + Math.sin(seconds * 8) * 0.3],
      eyes: 'happy',
    });
    const wx = TRAIN_TAIL + 26 + shift;
    ctx.save();
    ctx.beginPath();
    ctx.rect(wx, 80, 18, 20);
    ctx.clip();
    fox(ctx, wx + 10, 104, {
      size: 0.8,
      facing: -1,
      pose: 'sit',
      scarf: true,
      arms: [0.2, 2.6 + Math.sin(seconds * 10) * 0.35],
      eyes: 'happy',
      mouth: 'grin',
    });
    ctx.restore();
  }
  // Mama: winds his scarf, hugs him, then waves her handkerchief.
  shade(ctx, 144, 167, 22);
  const m = fox(ctx, 144, 166, {
    adult: true,
    size: 1.2,
    fur: '#D46C2C',
    dress: MAMA_COAT,
    facing: 1,
    lean: wrapping ? 0.22 : hug ? 0.3 : 0,
    arms: riding
      ? [0.2, 2.6 + Math.sin(seconds * 9) * 0.35]
      : wrapping
        ? [0.4, 1.45 + Math.sin(seconds * 12) * 0.2]
        : hug
          ? [1.4, 1.2]
          : [0.2, 0.3],
    eyes: hug || wrapping ? 'happy' : 'open',
    mouth: 'smile',
    tilt: hug ? 0.25 : 0,
    frontArm: !hug,
  });
  if (riding) {
    const hand = m.front;
    const flutter = Math.sin(seconds * 14) * 1.5;
    poly(ctx, '#FFFFFF', [
      hand.x,
      hand.y,
      hand.x + 7,
      hand.y - 3 + flutter,
      hand.x + 6,
      hand.y + 4,
    ]);
  }
  // Fennel: the hug, the walk to the door, the ticket, the step up.
  let fx = 170,
    fy = 166;
  if (walk > 0) fx = lerp(170, 82, walk);
  if (toDoor > 0) {
    fx = lerp(82, 76, toDoor);
    fy = lerp(166, 142, toDoor);
  }
  if (climb > 0) {
    fx = lerp(76, DOOR, climb);
    fy = lerp(142, 135, climb);
  }
  const moving = (walk > 0 && walk < 1) || (toDoor > 0 && toDoor < 1);
  const inDoor = p >= 0.07;
  const ticket = within(p, 0.056, 0.066);
  if (!riding) {
    if (!inDoor) shade(ctx, fx, fy + 1, 14);
    const f = fox(ctx, fx, fy, {
      size: 0.95,
      facing: p >= 0.074 ? 1 : -1,
      step: moving ? seconds * 13 : undefined,
      pack: true,
      scarf: p > 0.012,
      phase: seconds * 3,
      arms: hug
        ? [1.9, 1.7]
        : ticket
          ? [0.2, 1.8]
          : p >= 0.074
            ? [0.2, 2.7 + Math.sin(seconds * 10) * 0.3]
            : undefined,
      eyes: hug || wrapping ? 'happy' : 'open',
      mouth: ticket || p >= 0.074 ? 'grin' : 'smile',
      tilt: hug ? 0.18 : ticket ? -0.12 : 0,
      ears: hug ? 0.35 : 0,
    });
    if (ticket) {
      box(ctx, f.front.x - 4, f.front.y - 3, 6, 4, '#F4E6C0');
      if (p > PUNCH) box(ctx, f.front.x - 2, f.front.y - 2, 1, 1, INK);
    }
    if (wrapping) {
      // The loose end of the scarf, winding round.
      line(ctx, SCARF, 2.4, [fx - 1, fy - 11, m.front.x, m.front.y]);
    }
    if (hug) {
      line(ctx, MAMA_COAT, 3.2, [m.shoulder.x, m.shoulder.y, fx + 4, fy - 12]);
      disc(ctx, fx + 4, fy - 12, 1.7, SOCK);
    }
    // The conductor waits by the door with his ticket punch.
    const punch = hump(p, PUNCH - 0.004, PUNCH + 0.004);
    shade(ctx, 46, 167, 18);
    const b = badger(ctx, 46, 166, {
      size: 1.1,
      facing: 1,
      arms: [0.3, 1.2 + punch * 0.5 + (ticket ? 0.3 : 0)],
      eyes: p > PUNCH ? 'happy' : 'open',
      mouth: 'smile',
      tilt: within(p, 0.05, 0.07) ? 0.12 : 0,
    });
    box(ctx, b.front.x, b.front.y - 2, 4, 2, '#B8BCC4');
    if (punch > 0.5) box(ctx, b.front.x + 3, b.front.y - 6, 1, 1, '#F4E6C0');
  }
}

// ——— The compartment, a 320 × 180 set ———
const WX = 112,
  WY = 30,
  WW = 96,
  WH = 64;
const SEAT = 117;
type Frame = { x: number; y: number; w: number; h: number };

/**
 * The view out of the window, painted into any frame so the same journey plays in the
 * compartment's window and in full-frame point-of-view shots. Units: the frame is 100 tall.
 */
function view(ctx: Ctx, p: number, seconds: number, F: Frame) {
  const k = F.h / 100;
  const X = (u: number) => F.x + u * k,
    Y = (v: number) => F.y + v * k;
  const cw = F.w / k;
  const dist = p * STORY * 60;
  if (within(p, 0.542, TUNNEL_OUT)) {
    tunnelWall(ctx, F, k, dist);
    return;
  }
  const colors = skyAt(p);
  bands(ctx, colors, F.y, Y(66), F.x, F.w);
  stars(ctx, seconds, starry(p), {
    count: Math.round(cw / 6),
    seed: 9,
    left: F.x,
    top: F.y,
    width: F.w,
    height: 50 * k,
    size: Math.max(1, Math.round(k * 0.7)),
  });
  if (p < 0.2) {
    // Dusk fields and farms.
    ridge(ctx, '#3F3563', F.x, F.w, Y(62), 10 * k, dist * 0.03, 1, Y(100), 6 * k);
    box(ctx, F.x, Y(62), F.w, 38 * k, '#3A3C40');
    for (let i = 0; i < 4; i++) box(ctx, F.x, Y(68 + i * 8), F.w, k, '#44464A');
    for (let i = Math.floor((dist * 0.25) / 90); i < (dist * 0.25 + cw) / 90 + 1; i++) {
      const u = i * 90 - dist * 0.25 + 20;
      box(ctx, X(u), Y(56), 14 * k, 8 * k, '#2E2A36');
      poly(ctx, '#2A2430', [X(u - 2), Y(56), X(u + 7), Y(50), X(u + 16), Y(56)]);
      box(ctx, X(u + 4), Y(58), 3 * k, 3 * k, WARM);
    }
    pines(ctx, '#23282E', F.x, F.w, Y(80), 7 * k, dist * 0.6, 4);
  } else if (p < 0.7) {
    // Moonlit hills; after the tunnel, a wide open plain.
    const plain = p >= TUNNEL_OUT;
    const mx = plain ? lerp(cw * 0.25, cw * 0.8, span(p, TUNNEL_OUT, 0.7)) : cw * 0.72;
    const my = plain ? 22 - Math.sin(span(p, TUNNEL_OUT, 0.7) * Math.PI) * 8 : 18;
    moon(ctx, X(mx), Y(my), 5.5 * k);
    ridge(ctx, '#1A2250', F.x, F.w, Y(62), 16 * k, dist * 0.02, 3, Y(100), 6 * k);
    if (!plain) {
      ridge(ctx, '#223058', F.x, F.w, Y(74), 12 * k, dist * 0.1, 5, Y(100), 6 * k);
      sheepHill(ctx, p, X, Y, k, cw);
      box(ctx, F.x, Y(86), F.w, 14 * k, '#131A38');
    } else {
      box(ctx, F.x, Y(70), F.w, 30 * k, '#10183A');
      for (let i = 0; i < 5; i++)
        box(ctx, F.x + rand(i) * F.w, Y(72 + rand(i + 3) * 4), k, k, WARM);
      pines(ctx, '#0B1230', F.x, F.w, Y(88), 6 * k, dist * 0.5, 8);
    }
  } else if (p < 0.752) {
    // Pre-dawn: the cliff rushes past, with glimpses of a pale sea.
    box(ctx, F.x, Y(64), F.w, 36 * k, '#2A3A62');
    box(ctx, F.x, Y(64), F.w, k, '#9FB4D0');
    const gap = 120;
    for (let i = Math.floor((dist * 1.2) / gap) - 1; i < (dist * 1.2 + cw) / gap + 1; i++) {
      const u = i * gap - dist * 1.2;
      poly(ctx, '#161C30', [
        X(u),
        Y(100),
        X(u + 4),
        Y(20 + rand(i) * 20),
        X(u + 30),
        Y(4),
        X(u + 70),
        Y(14 + rand(i + 1) * 20),
        X(u + 84),
        Y(100),
      ]);
      line(ctx, '#34426A', k, [X(u + 4), Y(20 + rand(i) * 20), X(u + 30), Y(4)]);
    }
  } else {
    seaView(ctx, p, seconds, F, k, X, Y, cw, dist);
    return;
  }
  // Telegraph poles whip past closest of all.
  for (let i = Math.floor((dist * 1.6) / 90); i < (dist * 1.6 + cw) / 90 + 1; i++) {
    const u = i * 90 - dist * 1.6;
    box(ctx, X(u), Y(20), 2.5 * k, 80 * k, '#141014');
    box(ctx, X(u - 5), Y(24), 12 * k, 1.5 * k, '#141014');
  }
  line(ctx, alpha('#141014', 0.8), 0.6 * k, [F.x, Y(26), F.x + F.w * 0.5, Y(30), F.x + F.w, Y(26)]);
}
function tunnelWall(ctx: Ctx, F: Frame, k: number, dist: number) {
  box(ctx, F.x, F.y, F.w, F.h, '#0A0806');
  // Lamps streak past in the dark: small, steady, never a flash.
  const gap = 70;
  for (let i = Math.floor((dist * 2) / gap); i < (dist * 2 + F.w / k) / gap + 1; i++) {
    const u = i * gap - dist * 2;
    const x = F.x + u * k;
    glow(ctx, x + 10 * k, F.y + 40 * k, 14 * k, '#FF9A40', 0.35);
    box(ctx, x, F.y + 39 * k, 20 * k, 2 * k, '#FFC070');
  }
}
/** The hurdle on the moonlit hill, where the sheep take turns. */
const hurdleAt = (p: number, cw: number) => cw * 0.6 - (p - at('sheep')) * STORY * 10;
function sheepHill(
  ctx: Ctx,
  p: number,
  X: (u: number) => number,
  Y: (v: number) => number,
  k: number,
  cw: number,
) {
  if (p < at('sheep') - 0.01 || p > JOLT + 0.03) return;
  const h = hurdleAt(p, cw);
  oval(ctx, X(h), Y(88), 80 * k, 18 * k, '#2A3A66');
  oval(ctx, X(h), Y(89), 78 * k, 17 * k, '#223058');
  // Hurdle.
  for (const dx of [-6, 6]) box(ctx, X(h + dx), Y(59), 2 * k, 12 * k, '#6A5A48');
  box(ctx, X(h - 9), Y(61), 20 * k, 2 * k, '#8A7658');
  box(ctx, X(h - 9), Y(66), 20 * k, 2 * k, '#8A7658');
  if (p > JOLT) return;
  JUMPS.forEach((jump, i) => {
    const t = (p - jump) * STORY;
    if (t < -2.2 || t > 2.2) return;
    // Sheep are drawn 1.4× life size: they are the stars of this shot.
    const z = 1.4 * k;
    const u = h + t * 24;
    const lift = Math.max(0, 1 - (t / 0.42) ** 2) * 15;
    const air = lift > 1;
    const sx = X(u),
      sy = Y(71 - lift);
    for (const lx of [-3, 2])
      box(ctx, sx + lx * z, sy - (air ? 3 : 2) * z, z, (air ? 2 : 3) * z, '#1A1A24');
    oval(ctx, sx, sy - 5 * z, 5 * z, 3.4 * z, '#E4E8F4');
    for (const bx of [-3, 0, 3]) disc(ctx, sx + bx * z, sy - 7.3 * z, 1.8 * z, '#EEF1FA');
    oval(ctx, sx + 5 * z, sy - 6 * z, 1.8 * z, 2.2 * z, '#23232E');
    box(ctx, sx + 3.5 * z, sy - 8 * z, 1.5 * z, z, '#23232E');
    box(ctx, sx + 5.5 * z, sy - 6.5 * z, 0.8 * z, 0.8 * z, '#FFFFFF');
    // The count pops up over each sheep at the top of its jump, and rides along with it.
    if (t > -0.08 && t < 0.95) {
      const label = i < 3 ? `${i + 1}` : i === 3 ? '4.' : '5...';
      faded(ctx, ease(span(t, -0.08, 0.04)) * (1 - span(t, 0.6, 0.95)), () =>
        write(ctx, label, sx, sy - 14 * z - t * 5 * k, {
          size: Math.round(10 * k),
          color: '#FFF3C8',
          type: 'serif',
          shadow: alpha('#000000', 0.5),
        }),
      );
    }
  });
}
function seaView(
  ctx: Ctx,
  p: number,
  seconds: number,
  F: Frame,
  k: number,
  X: (u: number) => number,
  Y: (v: number) => number,
  cw: number,
  dist: number,
) {
  // Sunrise over the sea: the sun lifts, the water catches it, gulls ride the air.
  const rise = span(p, 0.77, 0.9);
  const sunX = cw * 0.55,
    sunY = 66 - easeOut(rise) * 30;
  const warm = ease(span(p, 0.772, 0.81));
  glow(ctx, X(sunX), Y(sunY), 90 * k, '#FFC47A', 0.55 * warm);
  disc(ctx, X(sunX), Y(sunY), 16 * k, mix('#F6B08A', '#FFF0B8', warm));
  box(ctx, F.x, Y(62), F.w, 38 * k, mix('#2E3E6E', '#5A74A8', warm));
  box(ctx, F.x, Y(62), F.w, k, mix('#9FB4D0', '#FFE6B0', warm));
  for (let i = 0; i < 3; i++) box(ctx, F.x, Y(70 + i * 9), F.w, k * 2, alpha('#2A3C6E', 0.35));
  // The sun's path across the water.
  for (let i = 0; i < 26; i++) {
    const row = i % 9,
      v = 64 + row * 3.4 + rand(i) * 2;
    const spread = 4 + row * 3;
    const u = sunX + (rand(i * 7) - 0.5) * spread * 2;
    const on = Math.sin(seconds * 3 + i * 1.7) > -0.2;
    if (on)
      box(
        ctx,
        X(u),
        Y(v),
        (2 + rand(i * 3) * 5) * k,
        Math.max(1, k * 0.8),
        alpha('#FFF4C8', 0.9 * warm),
      );
  }
  for (let i = 0; i < 3; i++) {
    const gx = X(((cw * (0.2 + i * 0.3) + seconds * (6 + i * 2)) % (cw + 20)) - 10);
    const gy = Y(24 + i * 9 + Math.sin(seconds * 1.4 + i) * 3);
    const flap = Math.sin(seconds * 6 + i * 2) * 1.5 * k;
    line(ctx, '#FFFFFF', Math.max(1, k * 0.9), [
      gx - 4 * k,
      gy - flap,
      gx,
      gy,
      gx + 4 * k,
      gy - flap,
    ]);
  }
  // Grass on the cliff edge flicks past below.
  box(ctx, F.x, Y(94), F.w, 6 * k, mix('#1E3024', '#4E7A48', warm));
  for (let i = Math.floor((dist * 1.4) / 14); i < (dist * 1.4 + cw) / 14 + 1; i++) {
    const u = i * 14 - dist * 1.4;
    poly(ctx, mix('#1E3024', '#5E8A50', warm), [
      X(u),
      Y(95),
      X(u + 3),
      Y(88 + rand(i) * 3),
      X(u + 6),
      Y(95),
    ]);
  }
}

function room(ctx: Ctx, p: number, seconds: number) {
  // Warm wood, a brass lamp, red plush seats, and the window onto the night.
  box(ctx, 0, 0, W, H, '#3A2016');
  box(ctx, 0, 12, W, 92, '#8C5536');
  for (let x = 8; x < W; x += 26) box(ctx, x, 14, 1, 88, '#7C4A2E');
  box(ctx, 0, 0, W, 10, '#2A1812');
  box(ctx, 0, 10, W, 3, '#5A3322');
  box(ctx, 0, 102, W, 3, '#B7824E');
  box(ctx, 0, 105, W, 41, '#5C3222');
  for (let x = 4; x < W; x += 26) box(ctx, x, 109, 20, 33, '#66382A');
  box(ctx, 0, 146, W, 34, '#4A2229');
  for (let x = 0; x < W; x += 16) {
    box(ctx, x + 4, 156, 6, 2, '#5E2E34');
    box(ctx, x + 12, 168, 6, 2, '#5E2E34');
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(WX, WY, WW, WH);
  ctx.clip();
  view(ctx, p, seconds, { x: WX, y: WY, w: WW, h: WH });
  faded(ctx, 0.07, () => {
    poly(ctx, '#FFFFFF', [WX + 14, WY + WH, WX + 36, WY, WX + 44, WY, WX + 22, WY + WH]);
    poly(ctx, '#FFFFFF', [WX + 52, WY + WH, WX + 74, WY, WX + 77, WY, WX + 55, WY + WH]);
  });
  ctx.restore();
  const frame = '#C4945A';
  box(ctx, WX - 4, WY - 4, WW + 8, 4, frame);
  box(ctx, WX - 4, WY + WH, WW + 8, 3, frame);
  box(ctx, WX - 4, WY, 4, WH, frame);
  box(ctx, WX + WW, WY, 4, WH, frame);
  for (const [cx, cy] of [
    [WX, WY],
    [WX + WW - 2, WY],
    [WX, WY + WH - 2],
    [WX + WW - 2, WY + WH - 2],
  ])
    box(ctx, cx, cy, 2, 2, frame);
  box(ctx, WX + WW / 2 - 6, WY + 2, 12, 2, BRASS);
  // Curtains, tied back.
  for (const side of [1, -1]) {
    const m = (x: number) => (side > 0 ? x : 2 * (WX + WW / 2) - x);
    poly(ctx, RED_D, [
      m(WX - 13),
      WY - 6,
      m(WX + 3),
      WY - 6,
      m(WX),
      WY + 30,
      m(WX - 3),
      WY + 40,
      m(WX - 11),
      WY + 70,
      m(WX - 16),
      WY + 70,
    ]);
    line(ctx, alpha(RED_L, 0.7), 1, [m(WX - 6), WY - 5, m(WX - 5), WY + 36, m(WX - 12), WY + 68]);
    box(ctx, Math.min(m(WX - 9), m(WX - 3)), WY + 36, 6, 2, BRASS);
  }
  box(ctx, WX - 16, WY - 10, WW + 32, 6, RED_D);
  box(ctx, WX - 16, WY - 4, WW + 32, 1, GOLD);
  // The fold-down table under the window.
  box(ctx, WX - 8, WY + WH + 3, WW + 16, 4, '#A06A40');
  box(ctx, WX - 6, WY + WH + 7, WW + 12, 1, '#6E4428');
  poly(ctx, '#6E4428', [150, WY + WH + 8, 170, WY + WH + 8, 160, WY + WH + 16]);
  // Lamp.
  box(ctx, 158, 10, 4, 4, BRASS);
  poly(ctx, '#F6D48C', [150, 14, 170, 14, 166, 21, 154, 21]);
  box(ctx, 154, 21, 12, 1, '#D8A650');
  // Luggage racks: Fennel's backpack, the bear's enormous suitcase.
  for (const [a, b] of [
    [22, 104],
    [216, 298],
  ]) {
    line(ctx, BRASS, 1, [a, 24, b, 24]);
    line(ctx, alpha(BRASS, 0.6), 1, [a, 27, b, 27]);
    for (let x = a; x <= b; x += 8) box(ctx, x, 24, 1, 3, alpha(BRASS, 0.5));
  }
  box(ctx, 48, 14, 14, 10, PACK);
  box(ctx, 48, 14, 14, 3, PACK_D);
  box(ctx, 232, 6, 42, 18, '#6B4A2E');
  box(ctx, 242, 6, 2, 18, '#4A3020');
  box(ctx, 262, 6, 2, 18, '#4A3020');
  box(ctx, 250, 3, 8, 3, '#4A3020');
  // Benches.
  for (const side of [1, -1]) {
    const m = (x: number) => (side > 0 ? x : W - x);
    const l = (a: number, b: number) => Math.min(m(a), m(b));
    poly(ctx, RED, [m(16), 118, m(16), 62, m(20), 56, m(30), 56, m(34), 62, m(34), 118]);
    for (let y = 66; y < 112; y += 12) box(ctx, l(24, 26), y, 2, 2, RED_D);
    box(ctx, l(16, 110), 113, 94, 6, RED_L);
    box(ctx, l(18, 108), 119, 90, 23, RED);
    box(ctx, l(18, 108), 119, 90, 1, RED_L);
    box(ctx, l(18, 108), 142, 90, 4, '#2A1812');
  }
}

/** The compartment's light: lamp, tunnel dark, moonlight, pre-dawn blue, then sunrise. */
function roomLight(ctx: Ctx, p: number) {
  const tunnel = presence(p, 0.542, TUNNEL_OUT + 0.008, 0.008);
  const night = clamp(span(p, TUNNEL_OUT, TUNNEL_OUT + 0.01)) * (1 - span(p, 0.695, 0.705));
  const blue = span(p, 0.695, 0.705) * (1 - span(p, 0.785, 0.8));
  const sun = ease(span(p, 0.785, 0.803));
  veil(ctx, '#050408', tunnel * 0.45);
  veil(ctx, '#0A1030', night * 0.32);
  veil(ctx, '#1A2C62', blue * 0.3);
  const lamp = 0.45 - tunnel * 0.12 - night * 0.2 - blue * 0.35;
  glow(ctx, 160, 22, 120, '#FFC878', lamp);
  glow(ctx, 160, 18, 26, '#FFF0C0', lamp);
  if (night > 0) glow(ctx, WX + WW / 2, WY + 30, 90, '#8FA8E8', night * 0.18);
  if (sun > 0) {
    glow(ctx, WX + WW / 2, WY + 40, 190, '#FFBE6A', sun * 0.55);
    veil(ctx, '#FFB86A', sun * 0.08);
  }
}

function fennelInRoom(ctx: Ctx, p: number, seconds: number) {
  const name = current(p).name;
  const blink = Math.sin(seconds * 1.3) > 0.985;
  let f: Fox = {
    size: 1.1,
    pose: 'sit',
    scarf: true,
    phase: seconds * 2,
    arms: [0.3, 0.5],
    eyes: blink ? 'closed' : 'open',
    mouth: 'smile',
  };
  let holding: 'up' | 'lap' | 'none' = 'lap';
  let dz = 0;
  if (name === 'room') {
    const show = span(p, 0.143, 0.15);
    f = {
      ...f,
      arms: show > 0 ? [lerp(0.4, 1.9, show), lerp(0.5, 2.2, show)] : [0.4, 0.5],
      eyes: show > 0.5 ? 'happy' : f.eyes,
      mouth: show > 0.5 ? 'grin' : 'smile',
      tilt: show > 0 ? -0.08 : -0.18,
    };
    holding = show > 0.5 ? 'up' : 'lap';
  } else if (name === 'watch') {
    f = { ...f, tilt: -0.16, mouth: 'grin', arms: [0.4, 0.6] };
  } else if (name === 'count') {
    // Counting the sheep, one heavy blink at a time.
    const counted = JUMPS.filter((j) => p >= j).length;
    const lids = [0.2, 0.2, 0.2, 0.34, 0.34, 0.67][counted];
    const doze = span(p, JUMPS[4] + sec(0.9), JOLT);
    f = {
      ...f,
      lean: 0.12 + doze * 0.1,
      tilt: -0.05 + doze * 0.4 + Math.sin(seconds * 2) * 0.03,
      lids: Math.max(lids, doze > 0 ? 1 : 0),
      eyes: 'open',
      mouth: doze > 0.5 ? 'o' : 'flat',
      ears: 0.2 + doze * 0.6,
      arms: [0.3, p < JUMPS[3] + sec(0.6) ? 2.1 : p < JUMPS[4] + sec(0.5) ? 1.6 : 0.4],
    };
    holding = 'none';
  } else if (name === 'awake') {
    const jolt = hump(p, JOLT, JOLT + sec(0.5));
    const pinch = span(p, PINCH, PINCH + sec(0.35)) * (1 - span(p, PROP - sec(0.3), PROP));
    const prop = within(p, PROP, 0.448);
    const glare = p > 0.448;
    dz = -jolt * 4;
    f = {
      ...f,
      eyes: glare ? 'open' : 'wide',
      lids: glare ? 0.34 + span(p, 0.448, 0.465) * 0.33 : 0,
      ears: jolt > 0 ? -0.15 : glare ? 0.3 : 0,
      mouth: pinch > 0 ? 'grin' : prop ? 'flat' : glare ? 'flat' : 'o',
      paws: pinch > 0 ? 'cheeks' : prop ? 'lids' : undefined,
      pinch: pinch * (0.8 + Math.sin(seconds * 9) * 0.2),
      arms: glare ? [0.2, 0.3] : [0.3, 0.5],
      tilt: prop ? -0.1 : 0,
    };
    holding = 'none';
  } else if (name === 'yawn') {
    const y = hump(p, YAWN, YAWN + YAWN_LENGTH);
    f = {
      ...f,
      mouth: 'yawn',
      yawn: y,
      eyes: y > 0.3 ? 'squeeze' : 'open',
      lids: 0.67,
      ears: y * 0.8,
      tilt: -y * 0.35,
      arms: [lerp(0.3, 2.8, y), lerp(0.5, 3.0, y)],
    };
    holding = 'none';
  } else if (name === 'asleep' || name === 'keeper' || name === 'dawn') {
    const sag = ease(span(p, 0.543, 0.556));
    f = {
      ...f,
      lids: name === 'asleep' ? lerp(0.67, 1, sag) : 1,
      eyes: sag > 0.9 || name !== 'asleep' ? 'closed' : 'open',
      lean: 0.08 + sag * 0.26,
      tilt: 0.05 + sag * 0.22,
      ears: 0.3 + sag * 0.4,
      mouth: sag > 0.9 ? 'o' : 'flat',
      arms: [0.2, p < SLIP ? 0.9 : 0.25],
      blanket: ease(span(p, 0.623, 0.636)),
    };
    holding = p < SLIP ? 'lap' : 'none';
  } else if (name === 'wake') {
    const stir = span(p, STIR, STIR + 0.006);
    const rub = within(p, 0.774, 0.785);
    f = {
      ...f,
      lids: 1 - stir * 0.4,
      eyes: rub ? 'closed' : stir > 0 ? 'open' : 'closed',
      lean: lerp(0.34, 0.08, stir),
      tilt: lerp(0.27, 0, stir),
      ears:
        lerp(0.7, 0.2, stir) - Math.max(0, Math.sin(seconds * 20)) * hump(p, 0.763, 0.771) * 0.3,
      mouth: stir > 0 ? 'flat' : 'o',
      paws: rub ? 'rub' : undefined,
      phase: seconds * 10,
      blanket: 1 - stir * 0.6,
    };
    holding = 'none';
  } else if (name === 'light') {
    const turnUp = span(p, 0.787, 0.795);
    f = {
      ...f,
      lean: 0.14,
      eyes: turnUp > 0.5 ? 'wide' : 'open',
      lids: turnUp > 0.5 ? 0 : 0.34,
      ears: lerp(0.2, -0.2, turnUp),
      mouth: turnUp > 0.5 ? 'o' : 'flat',
      tilt: -0.1 * turnUp,
      blanket: 0.4,
    };
    holding = 'none';
  }
  const pose = fox(ctx, 96, SEAT + dz, f);
  if (holding === 'up')
    drawing(ctx, (pose.front.x + pose.back.x) / 2 + 2, pose.front.y - 3, 0.24, -0.1);
  else if (holding === 'lap') drawing(ctx, pose.front.x + 1, pose.front.y - 2, 0.2, 0.3);
  if (name === 'asleep' || name === 'keeper' || name === 'dawn')
    zees(ctx, pose.head.x + 6, pose.head.y - 10, (seconds * 0.5) % 1, 7);
  if (name === 'count' && p > JUMPS[4] + sec(1.2))
    zees(ctx, pose.head.x + 6, pose.head.y - 10, (seconds * 0.7) % 1, 6);
}
/** Where Fennel's drawing is when it isn't in his paws. */
function looseDrawing(ctx: Ctx, p: number) {
  if (p < SLIP || p >= 0.785) return;
  const fall = span(p, SLIP, SLIP + sec(0.7));
  const lifted = span(p, 0.59, 0.595);
  const propped = p >= 0.648;
  if (propped) {
    drawing(ctx, WX + 12, WY + WH - 3, 0.22, -0.08);
    return;
  }
  if (lifted > 0) return;
  const x = lerp(104, 124, fall) + Math.sin(fall * 9) * 3 * (1 - fall);
  const y = lerp(108, 150, easeIn(fall));
  drawing(ctx, x, y, 0.2, lerp(0.3, 1.25, fall));
}
function conductorInRoom(ctx: Ctx, p: number, seconds: number) {
  const name = current(p).name;
  const base = { size: 1.4, facing: -1 as const, eyes: 'happy' as const };
  if (name === 'room') {
    const lookIn = span(p, 0.145, 0.155);
    badger(ctx, 152, 150, { ...base, lean: lookIn * 0.12, arms: [0.3, 0.4] });
  } else if (name === 'watch') {
    const nod = Math.sin(span(p, 0.201, 0.209) * TAU * 2) * 0.12;
    const out = span(p, 0.209, 0.214);
    badger(ctx, 152, 150, {
      ...base,
      tilt: nod + out * 0.16,
      arms: [0.3, lerp(0.4, 1.7, out)],
      watch: out > 0 ? (p > 0.216 ? 2 : 1) : 0,
      eyes: out > 0.5 ? 'open' : 'happy',
      mouth: 'smile',
    });
  } else if (name === 'keeper') {
    const walk = span(p, 0.58, 0.59);
    const stoop = hump(p, 0.589, 0.6);
    const study = within(p, 0.598, 0.613);
    const watch = within(p, 0.613, 0.623);
    const tuck = within(p, 0.623, 0.637);
    const prop = within(p, 0.637, 0.65);
    const x = walk < 1 ? lerp(300, 140, walk) : lerp(140, 132, span(p, 0.589, 0.595));
    const b = badger(ctx, x, 150, {
      ...base,
      step: walk > 0 && walk < 1 ? seconds * 9 : undefined,
      lean: stoop * 0.55 + (tuck ? 0.3 : 0) + (prop ? 0.15 : 0),
      arms:
        stoop > 0.1
          ? [0.3, 0.5 + stoop * 0.4]
          : study
            ? [1.6, 1.9]
            : watch
              ? [0.8, 1.7]
              : tuck
                ? [1.2 + Math.sin(seconds * 6) * 0.1, 1.3]
                : prop
                  ? [0.3, 2.1]
                  : [0.3, 0.4],
      tilt: study ? 0.18 : watch ? 0.2 : 0,
      eyes: study ? 'happy' : watch ? 'open' : 'happy',
      watch: watch ? 2 : 0,
    });
    if (study) drawing(ctx, (b.front.x + b.back.x) / 2, b.front.y - 4, 0.26, 0.05);
    else if (watch) drawing(ctx, b.back.x, b.back.y, 0.2, 0.4);
    else if (tuck) drawing(ctx, b.back.x, b.back.y + 2, 0.2, 0.4);
    else if (prop && p < 0.646) drawing(ctx, b.front.x, b.front.y, 0.22, -0.05);
    else if (stoop > 0.1 && p > 0.595) drawing(ctx, b.front.x, b.front.y, 0.2, 0.9);
  } else if (name === 'dawn') {
    badger(ctx, 214, 150, {
      ...base,
      arms: [0.3, 1.8],
      watch: 2,
      tilt: -0.2,
      eyes: 'open',
    });
  } else if (name === 'wake') {
    const tap = Math.max(...TAPS.map((t) => hump(p, t - 0.003, t + 0.003)));
    const point = span(p, 0.777, 0.781);
    // He keeps a polite distance and reaches over to tap Fennel's shoulder.
    badger(ctx, 146, 150, {
      ...base,
      lean: 0.22 * (1 - point),
      reach: point > 0 ? 1 : 1.9,
      arms: [point > 0 ? -2.2 * point : 0.3, point > 0 ? 0.6 : 1.72 + tap * 0.12],
      eyes: 'happy',
      mouth: point > 0 ? 'grin' : 'smile',
    });
  } else if (name === 'light') {
    badger(ctx, 150, 150, { ...base, arms: [0.2, 0.4], mouth: 'grin' });
  }
}
function bearInRoom(ctx: Ctx, p: number) {
  const asleep = p > 0.29;
  bear(ctx, 250, SEAT, 1.1, asleep, asleep ? breath(p) : 0);
  if (asleep) zees(ctx, 228, 60, snorePhase(p), 9);
}

// ——— Exterior sets ———
function lakeShot(ctx: Ctx, p: number, local: number, seconds: number) {
  bands(ctx, skyAt(0.3), 0, 114);
  stars(ctx, seconds, 1, { count: 36, seed: 21, height: 80 });
  moon(ctx, 240, 58, 8);
  const pan = local * 40;
  ridge(ctx, '#1C2656', 0, W, 104, 34, pan * 0.2, 7, 114, 10);
  pines(ctx, '#111A3C', 0, W, 111, 9, pan * 0.6, 12);
  box(ctx, 0, 111, W, 4, '#0B1330');
  const tx = lerp(30, 300, local);
  miniTrain(ctx, tx, 111, 1.25, { cars: 2, puffs: chugPhase(p) });
  // The lake: everything above it, again, upside down and rippling.
  box(ctx, 0, 115, W, 65, '#132150');
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.translate(0, 230);
  ctx.scale(1, -1);
  moon(ctx, 240, 58, 8);
  ridge(ctx, '#2A3668', 0, W, 104, 34, pan * 0.2, 7, 114, 10);
  miniTrain(ctx, tx, 111, 1.25, { cars: 2, puffs: 0 });
  ctx.restore();
  for (let y = 117; y < H; y += 3) box(ctx, 0, y, W, 1, alpha('#0C1636', 0.55));
  for (let i = 0; i < 14; i++) {
    const w = 10 - i * 0.5;
    const jitter = Math.sin(seconds * 2 + i * 1.9) * 3;
    box(ctx, 240 - w / 2 + jitter, 120 + i * 4, w, 1, alpha('#E4ECFA', 0.7 - i * 0.04));
  }
  // Reeds in the foreground, sliding by.
  for (let i = 0; i < 9; i++) {
    const x = ((i * 47 - local * 160) % 380) + 380 - 30;
    const rx = (x % 380) - 30;
    line(ctx, '#070B1C', 2, [rx, H, rx + 3, H - 20 - (i % 3) * 8]);
    line(ctx, '#070B1C', 2, [rx + 6, H, rx + 4, H - 14 - (i % 2) * 8]);
  }
}
function viaductShot(ctx: Ctx, p: number, local: number, seconds: number) {
  bands(ctx, skyAt(0.32), 0, 150);
  stars(ctx, seconds, 1, { count: 36, seed: 33, height: 90 });
  moon(ctx, 64, 36, 7);
  // The valley and its village far below.
  poly(ctx, '#18214A', [0, 70, 60, 92, 110, 130, 120, 180, 0, 180]);
  poly(ctx, '#18214A', [320, 62, 250, 96, 214, 134, 200, 180, 320, 180]);
  box(ctx, 0, 150, W, 30, '#0E1532');
  for (let i = 0; i < 30; i++) {
    const x = 90 + rand(i * 1.3) * 150,
      y = 148 + rand(i * 2.1) * 26;
    const on = Math.sin(seconds * 0.8 + i * 1.7) > -0.8;
    box(ctx, x, y, 2, 1, on ? '#FFD07A' : '#C08A4A');
    if (i % 5 === 0) glow(ctx, x, y, 6, '#FFC070', 0.4);
  }
  poly(ctx, '#0B1128', [160, 146, 163, 128, 166, 146]);
  for (let i = 0; i < 3; i++)
    oval(ctx, 160 + Math.sin(seconds * 0.2 + i) * 20, 140 + i * 8, 120, 4, alpha('#B8C4E8', 0.08));
  // The viaduct: a deck on tall stone arches.
  const stone = '#262E52',
    lit = '#56649A';
  ctx.fillStyle = stone;
  for (let pier = -44; pier < W + 64; pier += 64) {
    box(ctx, pier - 5, 90, 10, 90, stone);
    box(ctx, pier - 5, 90, 2, 90, lit);
    ctx.beginPath();
    ctx.moveTo(pier, 90);
    ctx.lineTo(pier + 64, 90);
    ctx.lineTo(pier + 64, 118);
    ctx.arc(pier + 32, 118, 27, 0, Math.PI, true);
    ctx.lineTo(pier, 118);
    ctx.closePath();
    ctx.fill();
  }
  box(ctx, -10, 84, W + 20, 7, stone);
  box(ctx, -10, 84, W + 20, 1, lit);
  box(ctx, -10, 90, W + 20, 1, '#1A2040');
  miniTrain(ctx, lerp(20, 330, local), 84, 1.1, { cars: 2, puffs: chugPhase(p) });
}
function tunnelShot(ctx: Ctx, p: number, local: number, seconds: number) {
  bands(ctx, skyAt(0.45), 0, 130);
  stars(ctx, seconds, 1, { count: 30, seed: 44, height: 70 });
  moon(ctx, 70, 34, 7);
  poly(ctx, '#0F1530', [196, 130, 200, 96, 226, 70, 262, 50, 320, 42, 320, 180, 196, 180]);
  line(ctx, '#4A5C92', 1.5, [200, 96, 226, 70, 262, 50, 320, 42]);
  box(ctx, 0, 130, W, 50, '#0C1230');
  box(ctx, 0, 128, W, 3, '#070A18');
  // The train runs into the hill: the stone portal swallows it, carriage by carriage.
  const front = lerp(40, 420, local);
  miniTrain(ctx, front, 129, 1.35, { cars: 2, puffs: chugPhase(p) });
  poly(ctx, '#3E4666', [198, 131, 198, 86, 238, 86, 238, 131]);
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 4; col++)
      box(ctx, 199 + col * 10 + (row % 2) * 5, 87 + row * 9, 1, 8, '#2E3452');
  for (let row = 1; row < 5; row++) box(ctx, 198, 86 + row * 9, 40, 1, '#2E3452');
  box(ctx, 196, 84, 44, 3, '#56608A');
  poly(ctx, '#020204', [204, 131, 204, 108, 210, 100, 218, 97, 226, 100, 232, 108, 232, 131]);
  poly(ctx, '#0F1530', [0, 131, 198, 131, 198, 180, 0, 180]);
  box(ctx, 0, 131, 198, 1, '#1A2448');
  const swallowed = span(front, 200, 330);
  for (let i = 0; i < 5; i++) {
    const t = (seconds * 0.9 + i / 5) % 1;
    oval(
      ctx,
      214 - t * 16,
      92 - t * 22,
      5 + t * 10,
      4 + t * 6,
      alpha('#B8C0DA', 0.4 * swallowed * (1 - t)),
    );
  }
  for (let i = 0; i < 14; i++)
    line(ctx, '#070B1C', 1.5, [i * 24 + 6, H, i * 24 + 9, H - 8 - (i % 3) * 4]);
}
function timelapseShot(ctx: Ctx, p: number, local: number) {
  // Time runs fast: the stars wheel round the pole, the moon crosses the sky.
  bands(ctx, ['#070B24', '#0B1232', '#111A42', mix('#18244F', '#2A3A70', local)], 0, 150);
  const px = 96,
    py = 40;
  const turnBy = easeOut(local) * 1.3;
  ctx.lineWidth = 1;
  for (let i = 0; i < 48; i++) {
    const r = 12 + rand(i * 1.7) * 280,
      a0 = rand(i * 3.3) * TAU;
    const bright = 0.35 + rand(i * 5.1) * 0.6;
    ctx.strokeStyle = alpha(i % 4 ? '#FFF1C8' : '#AFC2E8', bright * 0.8);
    ctx.beginPath();
    ctx.arc(px, py, r, a0, a0 + Math.max(0.01, turnBy));
    ctx.stroke();
    box(ctx, px + Math.cos(a0 + turnBy) * r, py + Math.sin(a0 + turnBy) * r, 1, 1, '#FFFFFF');
  }
  box(ctx, px, py, 2, 2, '#FFFFFF');
  glow(ctx, px, py, 8, '#FFFFFF', 0.4);
  const ma = Math.PI * (1.1 + local * 0.8);
  moon(ctx, 160 + Math.cos(ma) * 150, 150 + Math.sin(ma) * 120, 7);
  ridge(ctx, '#0A1030', 0, W, 150, 10, 0, 17, H, 10);
  box(ctx, 0, 150, W, 30, '#080C24');
  poly(ctx, '#060918', [236, 150, 242, 126, 248, 150]);
  poly(ctx, '#060918', [250, 150, 255, 132, 260, 150]);
  miniTrain(ctx, lerp(40, 300, local), 152, 0.75, { cars: 2, one: true, puffs: chugPhase(p) });
}
function cliffShot(ctx: Ctx, p: number, local: number, seconds: number) {
  bands(ctx, skyAt(0.735), 0, 104);
  stars(ctx, seconds, 0.4, { count: 16, seed: 55, height: 50 });
  glow(ctx, 290, 104, 130, '#F2B48E', 0.3);
  box(ctx, 0, 104, W, 76, '#26355E');
  box(ctx, 0, 104, W, 1, '#A8BCD8');
  for (let i = 0; i < 10; i++)
    box(ctx, (i * 67 + seconds * 4) % W, 112 + i * 6, 16 + (i % 3) * 8, 1, alpha('#8FA4C8', 0.3));
  poly(ctx, '#1C2440', [240, 104, 262, 92, 300, 90, 320, 96, 320, 104]);
  // The line runs along a rocky shelf at the cliff foot, waves breaking below it.
  poly(ctx, '#1A2136', [140, 99, 320, 97, 320, 128, 250, 124, 190, 132, 140, 130]);
  box(ctx, 140, 98, 180, 1, '#4A5A86');
  for (let i = 0; i < 6; i++) {
    const t = (seconds * 0.4 + i / 6) % 1;
    oval(ctx, 170 + i * 26, 128 - (i % 2) * 3, 6 + t * 8, 1.5, alpha('#DCE6F4', 0.5 * (1 - t)));
  }
  // The train rounds the headland: it slides out from behind the rock.
  const front = lerp(150, 330, local);
  miniTrain(ctx, front, 98, 1.15, { cars: 2, puffs: chugPhase(p), steam: '#C0C8E0' });
  const blow = hump(p, CLIFF_WHISTLE, CLIFF_WHISTLE + sec(1.2));
  if (blow > 0)
    for (let j = 0; j < 6; j++) {
      const t = ((seconds * 2 + j / 6) % 1) * blow;
      oval(
        ctx,
        front - 18 * 1.15 - t * 6,
        70 - t * 26,
        2 + t * 6,
        2 + t * 4,
        alpha('#FFFFFF', 0.8 * (1 - t)),
      );
    }
  poly(
    ctx,
    '#121828',
    [0, 30, 40, 18, 90, 26, 140, 50, 162, 80, 170, 100, 150, 140, 120, 180, 0, 180],
  );
  line(ctx, '#34426A', 1.5, [40, 18, 90, 26, 140, 50, 162, 80, 170, 100]);
  box(ctx, 0, 98, 170, 2, '#1E2438');
  for (let i = 0; i < 4; i++) {
    const t = (seconds * 0.35 + i / 4) % 1;
    ctx.strokeStyle = alpha('#DCE6F4', 0.5 * (1 - t));
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(150 - i * 20, 176, 8 + t * 16, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
}
function coastShot(ctx: Ctx, p: number, local: number, seconds: number) {
  bands(ctx, skyAt(0.86), 0, 96);
  const sunY = 70 - local * 6;
  glow(ctx, 232, sunY, 150, '#FFB870', 0.55);
  disc(ctx, 232, sunY, 22, '#FFEBB0');
  box(ctx, 0, 94, W, 86, '#4E6CA6');
  box(ctx, 0, 94, W, 1, '#FFE2A8');
  for (let i = 0; i < 5; i++) box(ctx, 0, 104 + i * 16, W, 8, alpha('#2E4A86', 0.25 + i * 0.05));
  for (let i = 0; i < 40; i++) {
    const row = i % 12;
    const y = 96 + row * 6 + rand(i) * 3;
    const x = 232 + (rand(i * 7) - 0.5) * (10 + row * 12);
    if (Math.sin(seconds * 3 + i * 1.9) > -0.3) box(ctx, x, y, 2 + rand(i * 3) * 6, 1, '#FFF4C8');
  }
  poly(ctx, '#8E6E8A', [250, 94, 280, 84, 320, 82, 320, 94]);
  // Cliffs along the shore; the train runs along the top.
  poly(ctx, '#C98A5A', [0, 112, 70, 110, 150, 116, 196, 122, 212, 150, 190, 180, 0, 180]);
  poly(ctx, '#9A6444', [150, 116, 196, 122, 212, 150, 190, 180, 150, 180, 170, 140]);
  poly(ctx, '#6E9A5A', [0, 108, 70, 106, 150, 112, 196, 119, 196, 123, 150, 117, 70, 111, 0, 113]);
  for (let i = 0; i < 5; i++) {
    const t = (seconds * 0.3 + i / 5) % 1;
    oval(ctx, 196 + i * 3, 172 - i * 7, 6 + t * 10, 2, alpha('#FFFFFF', 0.6 * (1 - t)));
  }
  miniTrain(ctx, lerp(40, 190, local), 110, 0.8, {
    cars: 2,
    day: true,
    lit: 0.3,
    puffs: chugPhase(p),
    steam: '#FFFFFF',
  });
  for (let i = 0; i < 3; i++) {
    const gx = 60 + i * 70 + local * 30,
      gy = 40 + i * 12 + Math.sin(seconds + i) * 4;
    const flap = Math.sin(seconds * 5 + i * 2) * 2;
    line(ctx, '#FFFFFF', 1.5, [gx - 6, gy - flap, gx, gy, gx + 6, gy - flap]);
  }
}
/** The window seen from inside, full frame: a wood-and-brass border round the view. */
function windowFrame(ctx: Ctx, ledge: boolean) {
  const frame = '#7A4A2C';
  box(ctx, 0, 0, W, 12, frame);
  box(ctx, 0, 0, 14, H, frame);
  box(ctx, W - 14, 0, 14, H, frame);
  box(ctx, 0, H - 20, W, 20, frame);
  box(ctx, 14, 12, W - 28, 2, '#C4945A');
  box(ctx, 14, H - 22, W - 28, 2, '#C4945A');
  box(ctx, 14, 12, 2, H - 32, '#C4945A');
  box(ctx, W - 16, 12, 2, H - 32, '#C4945A');
  for (const [x, y] of [
    [16, 14],
    [W - 20, 14],
    [16, H - 26],
    [W - 20, H - 26],
  ])
    box(ctx, x, y, 4, 4, '#C4945A');
  poly(ctx, RED_D, [0, 0, 26, 0, 20, 70, 8, 100, 0, 100]);
  poly(ctx, RED_D, [W, 0, W - 26, 0, W - 20, 70, W - 8, 100, W, 100]);
  box(ctx, 0, H - 14, W, 14, '#A06A40');
  box(ctx, 0, H - 14, W, 1, '#C8905A');
  if (ledge) return;
  faded(ctx, 0.06, () => poly(ctx, '#FFFFFF', [60, H - 20, 120, 12, 136, 12, 76, H - 20]));
}

function glassShot(ctx: Ctx, p: number, seconds: number, sunrise: boolean) {
  // Outside the carriage, looking in at Fennel's window.
  const panel = sunrise ? '#3F6E58' : '#1A3029';
  box(ctx, 0, 0, W, H, panel);
  box(ctx, 0, 160, W, 2, GOLD);
  box(ctx, 0, 12, W, 1, alpha(GOLD, 0.7));
  for (let x = 6; x < W; x += 14) {
    box(ctx, x, 6, 2, 2, mix(panel, '#FFFFFF', 0.15));
    box(ctx, x, 168, 2, 2, mix(panel, '#FFFFFF', 0.15));
  }
  const inner = { x: 64, y: 24, w: 192, h: 128 };
  box(ctx, inner.x - 6, inner.y - 6, inner.w + 12, inner.h + 12, '#12211C');
  box(ctx, inner.x - 2, inner.y - 2, inner.w + 4, inner.h + 4, GOLD);
  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.clip();
  // The compartment behind him.
  box(ctx, inner.x, inner.y, inner.w, inner.h, sunrise ? '#C98A5A' : '#8C5536');
  box(ctx, inner.x, 118, inner.w, 40, sunrise ? '#9A5E3C' : '#5C3222');
  glow(ctx, 110, 40, 90, '#FFC878', sunrise ? 0.3 : 0.5);
  for (let x = inner.x + 10; x < inner.x + inner.w; x += 26)
    box(ctx, x, inner.y, 1, 94, alpha('#000000', 0.12));
  if (!sunrise) {
    // Face pressed flat to the cold glass, breath fogging it.
    const press = ease(span(p, at('glass'), at('glass') + 0.006));
    const fog = 0.25 + 0.2 * Math.sin(seconds * 2.2);
    foxFace(ctx, 160, 92 - press * 2, 4.2, {
      eyes: 'wide',
      look: 0,
      mouth: 'flat',
      squash: press * 1.4,
      ears: 0.1,
    });
    oval(ctx, 160, 107, 14 * press, 5 * press, alpha('#FFE2D0', 0.3 * press));
    oval(ctx, 160, 116, 26, 9 + fog * 6, alpha('#E8F0FA', fog * press));
    pawPad(ctx, 92, 128, 4.2 * (0.9 + press * 0.1));
    pawPad(ctx, 228, 128, 4.2 * (0.9 + press * 0.1));
  } else {
    const lift = ease(span(p, 0.886, 0.893)) * (1 - span(p, 0.907, 0.914) * 0.6);
    const slide = ease(span(p, 0.884, 0.892));
    const awe = p < 0.905;
    const look = within(p, 0.893, 0.897)
      ? -1
      : within(p, 0.897, 0.901)
        ? 1
        : within(p, 0.901, 0.905)
          ? -1
          : 0;
    foxFace(ctx, lerp(160, 122, slide), 92, 4.2, {
      eyes: awe ? 'wide' : 'happy',
      look,
      sparkle: true,
      mouth: awe ? 'awe' : 'grin',
      ears: -0.15,
      squash: 0.6,
    });
    if (lift > 0) drawing(ctx, 206, lerp(200, 78, lift), 1.3, 0.06);
    pawPad(ctx, lerp(92, 58 + 40, slide), 128, 4);
    if (lift > 0) {
      pawPad(ctx, 176, lerp(210, 110, lift), 3.4);
      pawPad(ctx, 236, lerp(210, 104, lift), 3.4);
    } else pawPad(ctx, 228, 128, 4);
  }
  ctx.restore();
  // The glass itself: frost at night, the sunrise reflected by day.
  if (!sunrise) {
    for (let i = 0; i < 26; i++) {
      const corner = i % 4;
      const cx = corner % 2 ? inner.x + inner.w : inner.x,
        cy = corner > 1 ? inner.y + inner.h : inner.y;
      const r = rand(i * 3.7) * 22;
      const a = rand(i * 1.9) * (Math.PI / 2);
      box(
        ctx,
        cx + (corner % 2 ? -1 : 1) * Math.cos(a) * r,
        cy + (corner > 1 ? -1 : 1) * Math.sin(a) * r,
        2,
        2,
        alpha('#DCEBFA', 0.6 - r / 50),
      );
    }
  } else {
    glow(ctx, 96, 50, 60, '#FFE2A0', 0.45);
    disc(ctx, 96, 50, 14, alpha('#FFF4D0', 0.5));
    for (let i = 0; i < 12; i++) {
      const y = 76 + i * 3;
      const w = 30 - i * 2;
      if (Math.sin(seconds * 3 + i * 2.1) > -0.4)
        box(ctx, 96 - w / 2 + Math.sin(i * 3) * 4, y, w, 1, alpha('#FFF0C0', 0.35));
    }
  }
  faded(ctx, sunrise ? 0.1 : 0.06, () => {
    poly(ctx, '#FFFFFF', [
      inner.x + 20,
      inner.y + inner.h,
      inner.x + 70,
      inner.y,
      inner.x + 82,
      inner.y,
      inner.x + 32,
      inner.y + inner.h,
    ]);
    poly(ctx, '#FFFFFF', [
      inner.x + 96,
      inner.y + inner.h,
      inner.x + 146,
      inner.y,
      inner.x + 150,
      inner.y,
      inner.x + 100,
      inner.y + inner.h,
    ]);
  });
}
function sketchShot(ctx: Ctx, local: number, seconds: number) {
  // What the conductor sees: the drawing held up high, and a very proud pair of ears.
  box(ctx, 0, 0, W, H, '#8C5536');
  for (let x = 8; x < W; x += 26) box(ctx, x, 0, 1, H, '#7C4A2E');
  box(ctx, 236, 0, 84, 110, '#C4945A');
  bands(ctx, skyAt(0.16), 4, 104, 240, 80);
  glow(ctx, 60, 20, 120, '#FFC878', 0.35);
  const bob = Math.sin(seconds * 5) * 1.5;
  const zoom = 1 + local * 0.06;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -H / 2);
  foxFace(ctx, 160, 52 + bob * 0.5, 2.6, { eyes: 'happy', mouth: 'grin', ears: -0.1 });
  drawing(ctx, 160, 116 + bob, 2.3, -0.03);
  for (const px of [96, 224]) {
    oval(ctx, px, 70 + bob, 5, 4, SOCK);
    box(ctx, px - 3, 73 + bob, 6, 3, SOCK);
  }
  ctx.restore();
}

// ——— Forktown station, a 400 × 180 set ———
const ARRIVE_TAIL = 200;
const arriveShift = (p: number) => -300 * (1 - easeOut(span(p, at('arrive'), STOP)));
function stationSet(ctx: Ctx, p: number, seconds: number) {
  // Morning: the sea glitters beyond the line, gulls wheel over the platform.
  glow(ctx, 110, 48, 120, '#FFE2A0', 0.5);
  disc(ctx, 110, 48, 14, '#FFF3C8');
  box(ctx, 0, 92, 400, 44, '#4E86C0');
  box(ctx, 0, 92, 400, 1, '#E8F2F8');
  for (let i = 0; i < 3; i++) box(ctx, 0, 100 + i * 12, 400, 5, alpha('#3A70AE', 0.4));
  for (let i = 0; i < 36; i++) {
    const x = rand(i * 2.3) * 400,
      y = 94 + rand(i * 4.1) * 38;
    if (Math.sin(seconds * 3 + i * 2.7) > 0.2) box(ctx, x, y, 3 + rand(i) * 4, 1, '#FFFFFF');
  }
  poly(ctx, '#7FA0B8', [0, 92, 30, 84, 70, 86, 90, 92]);
  box(ctx, 0, 128, 400, 6, '#9A9486');
  for (let x = 4; x < 400; x += 12) box(ctx, x, 122, 2, 8, '#F4F0E4');
  box(ctx, 0, 124, 400, 1, '#F4F0E4');
  box(ctx, 0, 134, 400, 8, '#5A5048');
  const shift = arriveShift(p);
  ctx.save();
  ctx.translate(shift, 0);
  carriage(ctx, ARRIVE_TAIL, 220, p >= STOP ? 2 : 1, seconds);
  // The bear, finally waking, in the second window.
  const yawnUp = span(p, 0.965, 0.975);
  if (yawnUp > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(ARRIVE_TAIL + 52, 80, 18, 20);
    ctx.clip();
    oval(ctx, ARRIVE_TAIL + 61, 94, 8, 7, BEAR);
    disc(ctx, ARRIVE_TAIL + 55, 87, 2.5, BEAR);
    disc(ctx, ARRIVE_TAIL + 67, 87, 2.5, BEAR);
    oval(ctx, ARRIVE_TAIL + 61, 97, 3, 2.5 * yawnUp + 0.5, '#4A1E1E');
    ctx.restore();
  }
  ctx.restore();
  box(ctx, 0, 140, 400, 40, '#B8A48E');
  box(ctx, 0, 140, 400, 2, '#F2D06A');
  box(ctx, 0, 142, 400, 3, '#9A8872');
  for (let x = 0; x < 400; x += 22) box(ctx, x, 148, 1, 32, '#A8947E');
  // The sign, and flowers.
  box(ctx, 84, 96, 3, 46, '#4A4A52');
  box(ctx, 130, 96, 3, 46, '#4A4A52');
  box(ctx, 76, 90, 67, 14, '#2E4A6E');
  box(ctx, 78, 92, 63, 10, '#F4EEDC');
  write(ctx, 'FORKTOWN', 109.5, 100.5, { size: 8, color: '#2E4A6E' });
  for (const fx of [110, 300]) {
    box(ctx, fx, 150, 16, 8, '#9A5A3C');
    for (let i = 0; i < 4; i++)
      disc(ctx, fx + 3 + i * 3.5, 148 - (i % 2) * 2, 2, i % 2 ? '#E8504A' : '#F4C84A');
  }
  for (let i = 0; i < 3; i++) {
    const gx = 60 + ((seconds * 10 + i * 90) % 300),
      gy = 30 + i * 10 + Math.sin(seconds * 1.5 + i) * 4;
    const flap = Math.sin(seconds * 5 + i * 2) * 2;
    line(ctx, '#FFFFFF', 1.5, [gx - 5, gy - flap, gx, gy, gx + 5, gy - flap]);
  }
  stationCast(ctx, p, seconds, shift);
}
function stationCast(ctx: Ctx, p: number, seconds: number, shift: number) {
  const door = ARRIVE_TAIL + 12 + shift;
  const flight = span(p, LEAP, LEAP + sec(0.5));
  const hugging = p >= LEAP + sec(0.5);
  // Grandma with her lantern: she has been waiting since before dawn.
  shade(ctx, 150, 167, 22);
  const gran = fox(ctx, 150, 166, {
    adult: true,
    size: 1.15,
    fur: GRAN_FUR,
    cream: GRAN_CREAM,
    dress: GRAN_DRESS,
    shawl: GRAN_SHAWL,
    glasses: true,
    facing: 1,
    lean: hugging ? 0.1 : 0.06,
    arms: hugging ? [0.3, 1.5] : p > STOP ? [0.3, 1.9] : [0.3, 2.5 + Math.sin(seconds * 8) * 0.3],
    frontArm: !hugging,
    eyes: hugging ? 'happy' : 'open',
    mouth: 'grin',
  });
  const lantern = gran.back;
  line(ctx, '#3A3036', 0.8, [lantern.x, lantern.y, lantern.x, lantern.y + 3]);
  box(ctx, lantern.x - 3, lantern.y + 3, 6, 7, '#3A3036');
  box(ctx, lantern.x - 2, lantern.y + 4, 4, 5, '#FFD27A');
  glow(ctx, lantern.x, lantern.y + 6, 16, '#FFC870', 0.45);
  // Fennel: in the doorway, flying, then in her arms.
  if (p >= STOP && flight <= 0) {
    fox(ctx, door, 135, {
      size: 0.95,
      facing: -1,
      pack: true,
      scarf: true,
      arms: [2.4, 2.6],
      eyes: 'wide',
      mouth: 'grin',
      phase: seconds * 3,
    });
  } else if (flight > 0 && !hugging) {
    const fx = lerp(door, 160, flight),
      fy = lerp(135, 150, flight) - Math.sin(flight * Math.PI) * 26;
    fox(ctx, fx, fy, {
      size: 0.95,
      facing: -1,
      pose: 'leap',
      pack: true,
      scarf: true,
      arms: [2.6, 2.8],
      eyes: 'happy',
      mouth: 'grin',
      phase: seconds * 6,
    });
  } else if (hugging) {
    fox(ctx, 162, 150, {
      size: 0.95,
      facing: -1,
      pose: 'leap',
      pack: true,
      scarf: true,
      arms: [1.8, 1.9],
      eyes: 'happy',
      mouth: 'grin',
      tilt: 0.12,
      wag: Math.sin(seconds * 8) * 0.3,
      phase: seconds * 3,
    });
    line(ctx, GRAN_DRESS, 3.2, [gran.shoulder.x, gran.shoulder.y, 168, 138]);
    disc(ctx, 168, 138, 1.7, SOCK);
  }
  // The conductor tips his cap from the step, then waves.
  if (p >= LEAP + sec(0.3)) {
    const tip = hump(p, 0.962, 0.978);
    const wave = p > 0.975;
    badger(ctx, door + 4, 137, {
      size: 1.05,
      facing: -1,
      arms: [2.8, tip > 0 ? 2.9 : wave ? 2.5 + Math.sin(seconds * 7) * 0.35 : 0.4],
      cap: tip,
      eyes: 'happy',
      mouth: 'grin',
    });
  }
}

// ——— Cameras: [p, x, y, zoom] ———
const PLATFORM_CAMERA = [
  [0, 192, 90, 1],
  [0.006, 192, 90, 1],
  [0.03, 156, 130, 2.1],
  [0.046, 152, 130, 2.1],
  [0.06, 82, 124, 1.9],
  [0.078, 80, 122, 2],
  [0.078, 590, 94, 1.9],
  [0.092, 594, 90, 2.05],
  [0.092, 170, 104, 1.25],
  [0.135, 176, 100, 1.3],
] as const;
const ROOM_CAMERA = [
  [0.135, 160, 92, 1],
  [0.175, 132, 100, 1.6],
  [0.2, 160, 100, 2.3],
  [at('lake'), 160, 96, 2.5],
  [at('count'), 126, 86, 2.2],
  [at('awake'), 120, 86, 2.4],
  [at('awake'), 100, 96, 2.9],
  [0.432, 100, 96, 2.9],
  [0.447, 180, 94, 1.35],
  [at('glass'), 178, 94, 1.38],
  [at('yawn'), 100, 94, 3],
  [at('tunnel'), 100, 92, 3.2],
  [at('asleep'), 130, 100, 1.6],
  [at('keeper'), 118, 100, 1.9],
  [at('keeper'), 150, 104, 1.5],
  [at('night'), 130, 102, 1.8],
  [at('dawn'), 170, 100, 1.25],
  [at('cliff'), 165, 98, 1.35],
  [at('wake'), 112, 96, 2.4],
  [at('light'), 108, 94, 2.6],
  [at('light'), 112, 92, 2.2],
  [at('sea'), 160, 62, 3.2],
] as const;
const STATION_CAMERA = [
  [at('arrive'), 200, 104, 1.15],
  [0.95, 190, 110, 1.3],
  [0.975, 172, 126, 1.66],
  [1, 170, 126, 1.72],
] as const;

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const theSleeperTrainScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: 65, voice: 'bell', intro: [12, 9, 7], outro: [2, 9, 14, 18] }, (s) => {
    const F = 65,
      E = 64,
      G = 67;
    // The lullaby: eight bars of 3/4, over F C Bb F C Bb F C.
    const THEME = [12, null, 9, 7, null, 4, 5, 4, 2, 0, null, null];
    const THEME_B = [2, 4, 7, 9, null, 7, 4, 2, 4, 7, null, null];
    const LULLABY = [...THEME, ...THEME_B];
    const CHORDS = [0, 7, 5, 0, 7, 5, 0, 7];
    const seconds = (from: number, to: number) => (to - from) * s.story;

    // ——— The train's heartbeat ———
    s.fx('crowd', 0, seconds(0, DEPART), 0.035);
    s.fx('sweep', DEPART - 0.002, 0.9, 0.08, 0.4);
    // It starts slow, gathers pace, then locks to the eighth notes of the waltz.
    DEPART_PUFFS.forEach((p, i) => s.fx('chug', p, 0.19, 0.15 + i * 0.015, 0.3));
    const grid = (p: number) => CRUISE + Math.round((p - CRUISE) / PUFF) * PUFF;
    const loudness: readonly (readonly [number, number])[] = [
      [CRUISE, 0.08],
      [at('lake'), 0.2],
      [at('sheep'), 0.1],
      [at('awake'), 0.07],
      [at('glass'), 0.14],
      [at('yawn'), 0.07],
      [at('tunnel'), 0.2],
      [at('asleep'), 0.05],
      [at('night'), 0.1],
      [at('dawn'), 0.06],
      [at('cliff'), 0.13],
      [at('wake'), 0.06],
      [at('light'), 0.08],
      [at('coast'), 0.18],
      [at('compare'), 0.1],
    ];
    loudness.forEach(([from, gain], i) => {
      const a = grid(from),
        b = grid(loudness[i + 1]?.[0] ?? BRAKE);
      if (b > a) s.fx('chug', a, seconds(a, b), gain, 0.2);
    });
    // And slows into Forktown.
    ARRIVE_PUFFS.forEach((p, i) => s.fx('chug', p, 0.19, 0.12 - i * 0.012, 0.2));
    s.fx('sweep', STOP, 1.1, 0.1, 0.3);

    // ——— Act one: goodbye on the platform, and a promise ———
    s.section({
      from: 0,
      to: beat(22),
      bpm: BPM,
      root: F,
      chords: CHORDS,
      melody: LULLABY,
      voice: 'keys',
      gain: 0.75,
      level: 0.6,
      groove: 'waltz',
    });
    s.fx('rustle', 0.01, 0.8, 0.05, -0.2);
    for (let i = 0; i < 5; i++) s.fx('step', 0.047 + i * sec(0.26), 0.12, 0.06, -0.3);
    s.fx('click', PUNCH, 0.08, 0.2, -0.3);
    s.fx('click', PUNCH + sec(0.12), 0.08, 0.12, -0.3);
    s.fx('step', 0.07, 0.12, 0.08, -0.4);
    s.fx('step', 0.073, 0.12, 0.08, -0.4);
    s.fx('whistle', WHISTLE, 1.4, 0.2, 0.5);
    for (let i = 0; i < 6; i++) s.fx('tick', 0.216 + i * sec(0.38), 0.05, 0.09, 0.2);
    // The night journey: a bell descant rides over the lullaby.
    s.section({
      from: at('lake'),
      to: beat(22),
      bpm: BPM,
      root: F,
      chords: [0],
      melody: [21, null, 19, 16, null, 14],
      voice: 'bell',
      gain: 0.7,
      pad: false,
      bass: false,
    });
    s.fx('water', at('lake'), seconds(at('lake'), at('viaduct')), 0.04);
    s.fx('rumble', at('viaduct'), seconds(at('viaduct'), at('sheep')), 0.05);
    // Counting sheep: one plucked note per jump, each slower and softer.
    s.section({
      from: beat(22),
      to: JOLT,
      bpm: BPM,
      root: F,
      chords: [0, 0, 5, 5],
      level: 0.5,
      bass: false,
      fade: 1.5,
    });
    [72, 74, 76, 77, 79].forEach((pitch, i) =>
      s.note(JUMPS[i], pitch, 1.2, 'pluck', 0.13 - i * 0.012, 0.3),
    );

    // ——— Act two: fighting sleep ———
    s.fx('boing', JOLT, 0.5, 0.14);
    s.fx('squeak', PINCH + 0.002, 0.4, 0.1, -0.2);
    s.fx('pop', PROP, 0.2, 0.14, -0.2);
    s.fx('pop', PROP + sec(0.15), 0.2, 0.12, -0.1);
    s.section({
      from: JOLT,
      to: at('tunnel'),
      bpm: BPM,
      root: F,
      chords: [0, 5, 7, 0],
      melody: [7, null, 7, 9, null, 7, 5, null, 4, 2, null, null],
      voice: 'pluck',
      gain: 0.7,
      level: 0.5,
      groove: 'waltz',
      fade: 0.8,
    });
    // The bear snores through everything: loudest when the camera finds him.
    for (let p = SNORE_FROM; p < beat(55); p += SNORE) {
      const name = current(p).name;
      const gain = within(p, 0.432, at('glass'))
        ? 0.24
        : ['count', 'awake', 'yawn', 'asleep', 'keeper', 'dawn', 'wake'].includes(name)
          ? 0.07
          : 0.02;
      s.fx('snore', p, SNORE * s.story, gain, 0.45);
    }
    s.fx('squeak', at('glass') + 0.002, 0.35, 0.12);
    s.fx('wind', at('glass'), seconds(at('glass'), at('yawn')), 0.05);
    s.fx('yawn', YAWN, YAWN_LENGTH * s.story, 0.24, -0.2);
    s.fx('swish', 0.527, 0.6, 0.15, 0.3);
    s.fx('rumble', 0.528, seconds(0.528, TUNNEL_OUT), 0.12);

    // ——— Act three: asleep, and somebody keeping watch ———
    s.section({
      from: at('tunnel'),
      to: at('night'),
      bpm: 56,
      root: F,
      chords: [5, 0, 5, 0],
      melody: [12, null, null, 9, null, null, 7, null, null, 4, null, null, 5, null, 4, 0],
      voice: 'bell',
      gain: 0.5,
      level: 0.55,
      bass: false,
      fade: 2,
    });
    s.fx('rustle', SLIP, 0.6, 0.06, -0.2);
    for (let i = 0; i < 3; i++) s.fx('step', 0.582 + i * sec(0.3), 0.12, 0.06, 0.4);
    s.fx('rustle', 0.593, 0.4, 0.05);
    s.fx('click', 0.613, 0.08, 0.12);
    for (let i = 0; i < 4; i++) s.fx('tick', 0.614 + i * sec(0.38), 0.05, 0.08);
    s.fx('rustle', 0.624, 0.8, 0.06, -0.2);
    s.section({
      from: at('night'),
      to: at('dawn'),
      bpm: 56,
      root: E,
      minor: true,
      chords: [0, -4],
      melody: [0, 7, 12, 15, 12, 7],
      step: 0.5,
      voice: 'bell',
      gain: 0.4,
      level: 0.5,
      bass: false,
      fade: 1.5,
    });
    s.fx('sparkle', at('night') + 0.004, 1.6, 0.05, 0.3);
    s.fx('wind', at('night'), seconds(at('night'), at('cliff')), 0.035);

    // ——— Act four: the right moment ———
    s.section({
      from: at('dawn'),
      to: at('light'),
      bpm: BPM,
      root: E,
      minor: true,
      chords: [0, -4, -2, -2],
      melody: [3, 7, 10, 12, 10, 7, 5, 7],
      step: 0.5,
      voice: 'pluck',
      gain: 0.45,
      level: 0.55,
      groove: 'tick',
      fade: 1,
    });
    for (let i = 0; i < 5; i++) s.fx('tick', at('dawn') + 0.003 + i * sec(0.38), 0.05, 0.08);
    s.fx('whistle', CLIFF_WHISTLE, 1.2, 0.18, 0.3);
    s.fx('wave', at('cliff'), 2.2, 0.06, -0.3);
    TAPS.forEach((p) => s.fx('knock', p, 0.1, 0.08, -0.3));
    s.fx('yawn', STIR, 0.8, 0.07, -0.3);
    s.chord(at('wake') + 0.01, [G - 5, G - 1, G + 2, G + 7], 2, 'pad', 0.03);

    // ——— The sea: up a key, everything at once ———
    s.section({
      from: at('light'),
      to: beat(64.5),
      bpm: BPM,
      root: G,
      chords: CHORDS,
      melody: LULLABY,
      voice: 'bell',
      gain: 1.1,
      level: 1,
      groove: 'waltz',
      fade: 0.5,
    });
    s.chord(at('light'), [G - 12, G - 5, G - 1, G + 2, G + 7], 5, 'pad', 0.045);
    s.chord(at('sea'), [G - 5, G + 2, G + 7, G + 11, G + 14], 4, 'pad', 0.04);
    s.note(at('light'), G - 24, 5, 'bass', 0.1);
    s.fx('gasp', 0.794, 0.5, 0.1, -0.2);
    s.fx('sparkle', at('light') + 0.003, 1.4, 0.1, 0.3);
    [at('sea'), 0.835, 0.86, 0.885].forEach((p, i) => s.fx('wave', p, 3, 0.07, i % 2 ? 0.4 : -0.4));
    [0.815, 0.83, 0.855, 0.9, 0.96, 0.985].forEach((p, i) =>
      s.fx('gull', p, 0.5, 0.08, i % 2 ? -0.5 : 0.5),
    );
    s.fx('sparkle', 0.905, 1, 0.08, 0.3);
    s.fx('giggle', 0.907, 0.6, 0.07);

    // ——— Forktown: warm and settled ———
    s.section({
      from: beat(64.5),
      to: 1,
      bpm: BPM,
      root: G,
      chords: [0, 5, 7, 0],
      melody: [...THEME_B.slice(0, 9), 0, null, null],
      voice: 'keys',
      gain: 0.8,
      level: 0.7,
      groove: 'waltz',
      fade: 2.5,
    });
    s.fx('swish', LEAP, 0.4, 0.1, -0.2);
    s.fx('giggle', LEAP + 0.012, 0.6, 0.08, -0.2);
    s.fx('wave', 0.93, 3, 0.05, -0.5);
  });

export const theSleeperTrain: FilmModule = {
  draw(ctx, p, seconds) {
    const { name, local } = current(p);
    const screenSky = (at: number) => bands(ctx, skyAt(at), 0, H);
    if (name === 'platform' || name === 'whistle' || name === 'depart') {
      screenSky(0);
      stars(ctx, seconds, 0.5, { count: 20, seed: 5, height: 50 });
      camera(ctx, track(p, PLATFORM_CAMERA), () => platformSet(ctx, p, seconds), { w: 680, h: H });
      vignette(ctx, 0.4);
    } else if (name === 'sketch') {
      sketchShot(ctx, local, seconds);
      vignette(ctx, 0.35);
    } else if (name === 'lake') {
      lakeShot(ctx, p, local, seconds);
      vignette(ctx, 0.5);
    } else if (name === 'viaduct') {
      viaductShot(ctx, p, local, seconds);
      vignette(ctx, 0.5);
    } else if (name === 'sheep' || name === 'sea') {
      view(ctx, p, seconds, { x: 0, y: 0, w: W, h: H });
      if (name === 'sea') drawing(ctx, 44, 150, 0.7, -0.1);
      windowFrame(ctx, name === 'sea');
      vignette(ctx, 0.35);
    } else if (name === 'glass' || name === 'compare') {
      glassShot(ctx, p, seconds, name === 'compare');
      vignette(ctx, 0.4);
    } else if (name === 'tunnel') {
      tunnelShot(ctx, p, local, seconds);
      vignette(ctx, 0.5);
    } else if (name === 'night') {
      timelapseShot(ctx, p, local);
      vignette(ctx, 0.5);
    } else if (name === 'cliff') {
      cliffShot(ctx, p, local, seconds);
      vignette(ctx, 0.45);
    } else if (name === 'coast') {
      coastShot(ctx, p, local, seconds);
      vignette(ctx, 0.3);
    } else if (name === 'arrive') {
      bands(ctx, skyAt(0.95), 0, 100);
      camera(ctx, track(p, STATION_CAMERA), () => stationSet(ctx, p, seconds), { w: 400, h: H });
      vignette(ctx, 0.3);
    } else {
      camera(ctx, track(p, ROOM_CAMERA), () => {
        room(ctx, p, seconds);
        bearInRoom(ctx, p);
        fennelInRoom(ctx, p, seconds);
        looseDrawing(ctx, p);
        conductorInRoom(ctx, p, seconds);
        roomLight(ctx, p);
      });
      vignette(ctx, 0.45);
    }
    // Dips to black between acts.
    veil(
      ctx,
      '#07090C',
      Math.max(
        hump(p, 0.128, 0.142),
        hump(p, 0.53, 0.554),
        hump(p, 0.646, 0.664) * 0.85,
        hump(p, 0.692, 0.708) * 0.85,
        hump(p, 0.911, 0.925) * 0.7,
      ),
    );
    captions(ctx, p, [
      [0.142, 0.198, "I'm staying awake for the sea."],
      [0.397, 0.447, 'Awake. Completely awake.'],
      [0.652, 0.702, 'Somebody else stayed awake instead.'],
      [0.874, 0.921, 'Even better than the drawing.'],
      [0.947, 0.994, 'Just in time for breakfast.'],
    ]);
  },
  score: theSleeperTrainScore,
  look: {
    shade: '#0E1528',
    ink: '#FFF4E4',
    accent: '#F5A65B',
    dedication: 'wake me for the good parts',
  },
};
