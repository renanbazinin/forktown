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
  lerp,
  line,
  mix,
  oval,
  poly,
  rand,
  shade,
  shot,
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
} from './kit';
import { composeFilm } from './score-kit';

/*
 * THE TINY GRAND PRIX
 * Three beetles race bottle-cap cars across a kitchen floor. Blitz, the flashy favourite,
 * cheats with a shortcut under the fridge; old Pip putters along at the back in his dented
 * yellow cap with one squeaky wheel. Then a giant shadow falls and the mop arrives with other
 * plans: it sweeps the leaders away, and the soapy wave it leaves carries Pip, surfing on his
 * upturned bottle cap, over the finish line.
 *
 * Pip's crooked wheel keeps time. It turns once a beat, and whenever he is rolling on screen
 * the score squeaks as the nick in it comes round to the top. The start lights, the jumps,
 * the stomps, and the mop's slap live in one table of beats that pictures and score share.
 */

// ——— Story beats ———
// A beat is 1/128 of the story: 142 bpm in the one-minute cut. The score derives its tempo
// from the same number, so the squeaks sit on the music's grid.
const BEAT = 1 / 128;
const SQUEAK = BEAT;
const T = {
  revs: [0.052, 0.0565],
  flex: 0.059,
  sputter: 0.0615,
  breath: 0.0715,
  polish: [0.0745, 0.0768, 0.0791],
  ting: 0.0815,
  hop: 0.0835,
  lights: [0.093, 0.101, 0.109],
  go: 0.117,
  backfire: [0.121, 0.1255],
  putter: 0.13,
  legs: [0.146, 0.153],
  slow: 0.156,
  stop: 0.163,
  pipIn: 0.166,
  up: 0.1835,
  launch: 0.188,
  land: 0.198,
  launch2: 0.191,
  land2: 0.2005,
  pipSpoon: 0.2015,
  tip: 0.212,
  touch: 0.2165,
  drop: 0.2195,
  spin: 0.238,
  plow: 0.246,
  popUp: 0.254,
  weave: 0.262,
  pipPeas: 0.274,
  bonks: [0.2832, 0.2862],
  wave: 0.306,
  arrive: 0.332,
  peek: 0.336,
  smirk: 0.341,
  dash: 0.35,
  popOut: 0.378,
  skid: 0.388,
  laugh: 0.397,
  jewelIn: 0.43,
  shadow: 0.447,
  look: 0.458,
  glassesOff: 0.465,
  gulp: 0.471,
  stomps: [0.452, 0.466, 0.482],
  mopDown: 0.492,
  slap: 0.502,
  sweep: 0.517,
  scoop: [0.5265, 0.5315],
  lift: 0.536,
  hear: 0.556,
  turn: 0.56,
  seeWave: 0.563,
  grin: 0.577,
  goggles: 0.58,
  flip: 0.586,
  board: 0.594,
  ride: 0.6,
  finish: 0.735,
  whistle: 0.768,
  climb: 0.803,
  handUp: 0.82,
  raise: 0.834,
  clap1: 0.878,
  glance: 0.885,
  clap2: 0.893,
  pop: 0.9,
} as const;
const CUTS = [
  0, 0.05, 0.087, 0.122, 0.14, 0.18, 0.226, 0.262, 0.294, 0.325, 0.372, 0.405, 0.478, 0.515, 0.55,
  0.605, 0.705, 0.765, 0.8, 0.87, 0.915,
] as const;
// While Pip rolls on screen, his wheel squeaks once a turn, on the beat.
const ROLLS = [
  [T.putter, 0.14],
  [T.pipIn, 0.18],
  [T.pipSpoon, 0.226],
  [T.pipPeas, 0.294],
  [0.294, 0.325],
  [0.55, T.hear],
] as const;
const SQUEAKS = ROLLS.flatMap(([a, b]) => {
  const out: number[] = [];
  for (let k = Math.ceil(a / SQUEAK); k * SQUEAK < b; k++) out.push(k * SQUEAK);
  return out;
});
const wrap = (v: number, m: number) => ((v % m) + m) % m;
/** 1 as the nick in Pip's wheel passes the top, fading over the next quarter turn. */
const squeakAt = (p: number) => Math.max(0, 1 - wrap(p / SQUEAK, 1) / 0.28);
const wheelTurn = (p: number) => (p / SQUEAK) * TAU;

// ——— Palette ———
const SHADE = '#1E1A16';
const INK = '#2A2320';
const CREAM = '#FFF3DA';
const GOLD = '#D3AE4C';
const SCARF = '#C9483A';
const TYRE = '#2B2729';
const TILE = ['#EAD8B0', '#D6BB8C'] as const;
const GROUT = '#C2A172';
const CAB = '#7F9F8A',
  CAB_DARK = '#66856F',
  CAB_LIGHT = '#98B69F',
  KICK = '#3B332D',
  BRASS = '#D4B060';
const WOOD = '#8C5B3A',
  WOOD_DARK = '#5E3B25',
  WOOD_LIGHT = '#B07B50',
  MATCH = '#E8C98E';
const STEEL = '#CDD5DA',
  STEEL_DARK = '#8C979F';
const SUGAR = '#FCF8EF',
  SUGAR_SHADE = '#E6DCC8';
const PEA = '#7DB44A',
  PEA_DARK = '#568A2F',
  PEA_LIGHT = '#BFE184';
const SOAP = '#8AD4E0',
  SOAP_DEEP = '#4E9FB9',
  FOAM = '#F3FBFC';
const FRIDGE = '#E9EEF0',
  FRIDGE_SHADE = '#C3CCD2',
  GAP = '#1B1721';
const MOP = '#E2DDCE',
  MOP_DARK = '#A9A290';
const SLIPPER = '#E88FA5',
  SLIPPER_DARK = '#C66A82';
const ANT = '#3B2A22',
  ANT_RED = '#7A3324';
const CRICKET = '#7FAE4A',
  CRICKET_DARK = '#4F7430';
const DUSK = '#1D2838';
const SUN = '#FFE4A0';
const RED = '#C8463A',
  BLUE = '#3F6FB0',
  GREEN = '#5E9A5A';

// ——— Little drawing helpers ———
/** An unrounded rectangle, for detail inside scaled characters. */
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function ring(ctx: Ctx, x: number, y: number, r: number, color: string, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
  ctx.stroke();
}
/** Distance covered at speed v from `start`, braking evenly to a halt between slow and stop. */
function braking(p: number, start: number, v: number, slow: number, stop: number) {
  const d = stop - slow;
  const t = clamp(p - start, 0, slow - start),
    u = clamp(p - slow, 0, d);
  return v * t + v * (u - (u * u) / (2 * d));
}
/** Linear through [p, value] keys: steady speeds for things that travel. */
function glide(p: number, keys: readonly (readonly [number, number])[]) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, av] = keys[i],
      [b, bv] = keys[i + 1];
    if (p < b) return lerp(av, bv, (p - a) / (b - a));
  }
  return keys[keys.length - 1][1];
}
/** A two-segment insect limb; angles are from hanging straight down, positive forward. */
function limb(
  ctx: Ctx,
  color: string,
  x: number,
  y: number,
  angle: number,
  bend: number,
  len = 4.4,
  width = 1.5,
) {
  const ex = x + Math.sin(angle) * len,
    ey = y + Math.cos(angle) * len;
  const hx = ex + Math.sin(angle + bend) * len,
    hy = ey + Math.cos(angle + bend) * len;
  line(ctx, color, width, [x, y, ex, ey, hx, hy]);
  disc(ctx, hx, hy, width * 0.8, color);
  return { x: hx, y: hy };
}
function glint(ctx: Ctx, x: number, y: number, r: number, amount = 1) {
  if (amount <= 0) return;
  const c = alpha('#FFFFFF', amount);
  poly(ctx, c, [x, y - r, x + r * 0.22, y, x, y + r, x - r * 0.22, y]);
  poly(ctx, c, [x - r, y, x, y + r * 0.22, x + r, y, x, y - r * 0.22]);
}
function puff(ctx: Ctx, x: number, y: number, t: number, size = 6, color = '#D9CCB2') {
  if (t <= 0 || t >= 1) return;
  for (let i = 0; i < 3; i++) {
    const r = size * (0.5 + t * 0.9) * (1 - i * 0.2);
    disc(
      ctx,
      x - i * size * 0.7 * (0.5 + t),
      y - r * 0.5 - i * t * 3,
      r,
      alpha(color, (1 - t) * 0.8),
    );
  }
}
function bubble(ctx: Ctx, x: number, y: number, r: number, amount = 1) {
  if (amount <= 0 || r <= 0) return;
  ctx.fillStyle = alpha('#D8F6FF', 0.2 * amount);
  ctx.strokeStyle = alpha('#FFFFFF', 0.8 * amount);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  box(ctx, x - r * 0.45, y - r * 0.55, 1, 1, alpha('#FFFFFF', amount));
}
/** Soap bubbles that wobble upward through a box and loop. */
function bubbles(
  ctx: Ctx,
  sec: number,
  {
    count = 16,
    seed = 1,
    left = 0,
    right = W,
    top = 0,
    bottom = H,
    rise = 16,
    size = 3,
    amount = 1,
  },
) {
  const h = bottom - top;
  for (let i = 0; i < count; i++) {
    const y = bottom - wrap(rand(seed + i) * h + sec * rise * (0.6 + rand(seed + i * 2) * 0.8), h);
    const x = left + rand(seed + i * 3) * (right - left) + Math.sin(sec * 2 + i) * 3;
    bubble(ctx, x, y, size * (0.5 + rand(seed + i * 7)), amount * Math.min(1, (bottom - y) / 12));
  }
}
function speedLines(ctx: Ctx, sec: number, amount: number, top: number, bottom: number) {
  if (amount <= 0) return;
  for (let i = 0; i < 16; i++) {
    const y = top + rand(3 + i) * (bottom - top);
    const len = 14 + rand(5 + i * 2) * 30;
    const x = W + 60 - wrap(rand(7 + i * 3) * 500 + sec * (420 + rand(9 + i) * 300), W + 120 + len);
    box(ctx, x, y, len, 1, alpha(CREAM, 0.5 * amount));
  }
}
function motes(ctx: Ctx, sec: number, x0: number, x1: number, y0: number, y1: number) {
  for (let i = 0; i < 12; i++) {
    const x = x0 + wrap(rand(i * 2.3) * (x1 - x0) + sec * (3 + (i % 3)), x1 - x0);
    const y = y0 + wrap(rand(i * 4.1) * (y1 - y0) + Math.sin(sec * 0.7 + i) * 6, y1 - y0);
    box(ctx, x, y, 1, 1, alpha(SUN, 0.7));
  }
}
function quaver(ctx: Ctx, x: number, y: number, color: string) {
  box(ctx, x, y, 3, 2, color);
  box(ctx, x + 2, y - 7, 1, 8, color);
  box(ctx, x + 3, y - 7, 2, 1, color);
  box(ctx, x + 4, y - 6, 1, 2, color);
}

// ——— The racers ———
type Who = 'blitz' | 'jewel' | 'pip';
type Colors = {
  shell: string;
  light: string;
  dark: string;
  belly: string;
  head: string;
  limb: string;
  car: string;
  carLight: string;
  carDark: string;
  hub: string;
  n: string;
};
const BUGS: Record<Who, Colors> = {
  blitz: {
    shell: '#C4322B',
    light: '#FF7A62',
    dark: '#6E1715',
    belly: '#8E2520',
    head: '#8A2A24',
    limb: '#3C1714',
    car: '#D83B31',
    carLight: '#FF9A80',
    carDark: '#8E1E1B',
    hub: '#2F2E36',
    n: '1',
  },
  jewel: {
    shell: '#2E6CB4',
    light: '#6CE0C8',
    dark: '#1B3E70',
    belly: '#27528A',
    head: '#22497A',
    limb: '#1A2A45',
    car: '#3F84CE',
    carLight: '#A4D0F6',
    carDark: '#22528C',
    hub: '#EEEDE6',
    n: '2',
  },
  pip: {
    shell: '#E6C03E',
    light: '#FFE994',
    dark: '#A7822A',
    belly: '#C99E34',
    head: '#9C7038',
    limb: '#5C4024',
    car: '#D3AE4C',
    carLight: '#F7DE90',
    carDark: '#93721F',
    hub: '#EDE4CE',
    n: '3',
  },
};
type Eyes = 'open' | 'wide' | 'happy' | 'closed' | 'squint' | 'dizzy';
type Mouth = 'smile' | 'grin' | 'smirk' | 'laugh' | 'o' | 'frown' | 'wobble' | 'flat';
type Pose = {
  eyes?: Eyes;
  mouth?: Mouth;
  look?: readonly [number, number];
  arms?: readonly [number, number];
  bends?: readonly [number, number];
  lean?: number;
  /** Blitz's sunglasses: 1 on, lower to peek over them, below 0 off. */
  glasses?: number;
  crooked?: boolean;
  /** Pip's goggles: 0 up on his forehead, 1 down over his eyes. */
  goggles?: number;
  /** How hard Pip's scarf streams behind him. */
  scarf?: number;
  sweat?: boolean;
  bunny?: boolean;
  sugar?: boolean;
  wet?: boolean;
  /** Draw the upper body turned round, looking back. */
  back?: boolean;
  hold?: 'rag' | 'trophy';
  flex?: boolean;
};
// Hands on the steering washer.
const DRIVE = [1.0, 1.15] as const,
  DRIVE_BEND = [0.2, -0.1] as const;

function face(ctx: Ctx, who: Who, hx: number, hy: number, o: Pose, sec: number) {
  const c = BUGS[who];
  const glasses = who === 'blitz' ? (o.glasses ?? 1) : -1;
  let eyes = o.eyes ?? 'open';
  if (eyes === 'open' && wrap(sec + (who === 'pip' ? 0.9 : who === 'jewel' ? 2.2 : 0), 3.6) < 0.11)
    eyes = 'closed';
  const [lx, ly] = o.look ?? [0.5, 0];
  const ey = hy - 0.8;
  if (glasses < 0.95)
    [hx + 0.8, hx + 3.4].forEach((x, i) => {
      const rx = i ? 1.6 : 1.3,
        ry = i ? 2.1 : 1.8;
      if (eyes === 'open' || eyes === 'wide' || eyes === 'squint') {
        const big = eyes === 'wide' ? 1.25 : 1;
        oval(ctx, x, ey, rx * big, ry * big, '#FFFFFF');
        disc(ctx, x + lx * 0.6, ey + ly * 0.8, eyes === 'wide' ? 0.6 : 0.9, INK);
        if (eyes === 'squint')
          poly(ctx, c.head, [
            x - rx - 0.3,
            ey - ry - 0.3,
            x + rx + 0.3,
            ey - ry - 0.3,
            x + rx + 0.3,
            ey - 0.3,
            x - rx - 0.3,
            ey + 0.3,
          ]);
      } else if (eyes === 'happy')
        line(ctx, INK, 0.7, [x - 1.1, ey + 0.5, x, ey - 0.7, x + 1.1, ey + 0.5]);
      else if (eyes === 'closed') line(ctx, INK, 0.7, [x - 1.1, ey + 0.2, x + 1.1, ey + 0.2]);
      else {
        line(ctx, INK, 0.6, [x - 1, ey - 1, x + 1, ey + 1]);
        line(ctx, INK, 0.6, [x - 1, ey + 1, x + 1, ey - 1]);
      }
    });
  if (who === 'pip') {
    oval(ctx, hx + 0.6, hy - 3.3, 1.6, 0.7, '#F4EEE0');
    oval(ctx, hx + 3.6, hy - 3.4, 1.8, 0.8, '#F4EEE0');
  } else if (who === 'jewel') {
    line(ctx, INK, 0.5, [hx - 0.4, hy - 3.2, hx + 1.4, hy - 3.9]);
    line(ctx, INK, 0.5, [hx + 2.6, hy - 4, hx + 4.2, hy - 3.3]);
  }
  const mx = hx + 2.8,
    my = hy + 2.7;
  switch (o.mouth ?? 'smile') {
    case 'smile':
      line(ctx, INK, 0.7, [mx - 1.2, my - 0.4, mx, my + 0.5, mx + 1.3, my - 0.5]);
      break;
    case 'grin':
      poly(ctx, INK, [
        mx - 1.9,
        my - 0.8,
        mx + 1.9,
        my - 0.9,
        mx + 1.2,
        my + 1.1,
        mx - 1.1,
        my + 1.1,
      ]);
      poly(ctx, '#FFFFFF', [
        mx - 1.5,
        my - 0.6,
        mx + 1.5,
        my - 0.7,
        mx + 1.3,
        my - 0.1,
        mx - 1.3,
        my,
      ]);
      break;
    case 'smirk':
      line(ctx, INK, 0.7, [mx - 1.3, my + 0.3, mx + 0.5, my + 0.3, mx + 1.7, my - 0.9]);
      break;
    case 'laugh': {
      const open = 1.3 + Math.abs(Math.sin(sec * 18)) * 0.8;
      oval(ctx, mx, my + 0.4, 1.9, open, INK);
      oval(ctx, mx + 0.2, my + open * 0.6, 1, 0.6, '#E37A7A');
      break;
    }
    case 'o':
      oval(ctx, mx, my + 0.3, 0.9, 1.2, INK);
      break;
    case 'frown':
      line(ctx, INK, 0.7, [mx - 1.2, my + 0.7, mx, my - 0.3, mx + 1.3, my + 0.7]);
      break;
    case 'wobble':
      line(ctx, INK, 0.6, [
        mx - 1.6,
        my,
        mx - 0.8,
        my - 0.6,
        mx,
        my,
        mx + 0.8,
        my - 0.6,
        mx + 1.6,
        my,
      ]);
      break;
    case 'flat':
      line(ctx, INK, 0.7, [mx - 1.2, my, mx + 1.2, my]);
      break;
  }
  if (who === 'pip') oval(ctx, mx - 0.3, my - 1.2, 1.9, 0.75, '#F4EEE0');
  if (glasses >= 0) {
    const gy = ey + (1 - glasses) * 2.6;
    ctx.save();
    if (o.crooked) {
      ctx.translate(hx + 2, gy);
      ctx.rotate(0.24);
      ctx.translate(-hx - 2, -gy);
    }
    line(ctx, INK, 0.6, [hx - 3.4, gy - 1.6, hx - 0.5, gy - 0.8]);
    poly(ctx, INK, [
      hx - 0.8,
      gy - 1.5,
      hx + 5.6,
      gy - 1.9,
      hx + 5.2,
      gy + 1.2,
      hx + 3.6,
      gy + 1.5,
      hx + 2.3,
      gy + 0.3,
      hx + 1.2,
      gy + 1.4,
      hx - 0.6,
      gy + 1.1,
    ]);
    line(ctx, alpha('#FFFFFF', 0.7), 0.5, [hx + 3.4, gy - 0.9, hx + 4.8, gy - 1.2]);
    if (o.crooked)
      line(ctx, '#FFFFFF', 0.4, [hx + 0.2, gy - 1, hx + 1.2, gy + 0.2, hx + 0.6, gy + 0.9]);
    ctx.restore();
  }
  if (who === 'pip') {
    const g = o.goggles ?? 0;
    const gy = lerp(hy - 5, ey, g);
    line(ctx, '#6B4A2A', 0.9, [hx - 5, gy + 0.4, hx - 0.8, gy]);
    [hx + 0.8, hx + 3.5].forEach((x, i) => {
      const r = lerp(1, 2.1, g) + i * 0.2;
      disc(ctx, x, gy, r, alpha(g > 0.5 ? '#A9DDF0' : '#5E8FA6', g > 0.5 ? 0.35 : 1));
      ring(ctx, x, gy, r, BRASS, 0.7);
    });
  }
  if (o.sweat) oval(ctx, hx - 4, hy - 2 + wrap(sec * 1.3, 1) * 5, 0.7, 1, '#BFE8F5');
  if (o.bunny) {
    oval(ctx, hx - 1, hy - 5.2, 3, 1.8, '#A29D96');
    oval(ctx, hx + 1.2, hy - 6, 1.4, 1.2, '#B7B2AA');
  }
  if (o.sugar) {
    oval(ctx, hx, hy - 4.4, 4, 1.7, SUGAR);
    rect(ctx, hx + 3.5, hy - 1, 1, 1, SUGAR);
  }
}

function scarfTail(ctx: Ctx, stream: number, sec: number) {
  const top: number[] = [],
    bottom: number[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const x = -1 - t * (4 + stream * 9);
    const y = -14 + t * 7 * (1 - stream * 0.85) + Math.sin(sec * 13 - i * 1.3) * stream * 1.4 * t;
    top.push(x, y - 1.1);
    bottom.unshift(x, y + 1.1);
  }
  poly(ctx, SCARF, [...top, ...bottom]);
}

/** Everything from the hips up, facing +x, with the hip at the origin. */
function upper(ctx: Ctx, who: Who, o: Pose, sec: number) {
  const c = BUGS[who];
  const [backArm, frontArm] = o.arms ?? [0.5, 0.7];
  const [bb, fb] = o.bends ?? [0.5, 0.5];
  ctx.save();
  if (o.back) ctx.scale(-1, 1);
  ctx.rotate(o.lean ?? 0);
  const tall = who === 'jewel' ? 9 : who === 'blitz' ? 8.4 : 7.8;
  const wide = who === 'jewel' ? 5.6 : who === 'blitz' ? 6.6 : 7.2;
  limb(ctx, mix(c.limb, '#000000', 0.25), -1.5, -tall - 1, backArm, bb);
  if (who === 'pip') scarfTail(ctx, o.scarf ?? 0.2, sec);
  oval(ctx, -0.5, -tall + 0.5, wide, tall, c.shell);
  oval(ctx, 2.4, -tall + 1.5, wide * 0.5, tall * 0.72, c.belly);
  if (who === 'jewel') {
    oval(ctx, -2.8, -tall, 1.5, tall * 0.7, alpha(c.light, 0.7));
    oval(ctx, -4.2, -tall + 2, 0.7, tall * 0.5, alpha('#B8F0E0', 0.6));
  } else if (who === 'blitz') {
    oval(ctx, -3.2, -tall - 2.5, 1.8, 3.6, alpha(c.light, 0.85));
    rect(ctx, -3.6, -tall - 5.2, 1, 1, '#FFFFFF');
  } else {
    disc(ctx, -3.8, -9, 1.3, c.dark);
    disc(ctx, -2.2, -4.2, 1, c.dark);
    oval(ctx, -3, -12.6, 2.2, 1.2, alpha(c.light, 0.9));
    rect(ctx, -1.6, -15.8, 7.6, 2.8, SCARF);
  }
  if (o.wet)
    for (let i = 0; i < 3; i++)
      disc(ctx, -4 + i * 4, -2 + wrap(sec * 1.6 + i * 0.37, 1) * 9, 0.7, alpha(SOAP, 0.9));
  const hx = who === 'jewel' ? 3.8 : 4.4,
    hy = -tall * 2 - 2.2;
  const hr = who === 'jewel' ? 4.6 : who === 'blitz' ? 5 : 5.3;
  if (who === 'pip') {
    line(ctx, c.limb, 0.7, [hx + 0.5, hy - 4.5, hx - 1, hy - 8, hx - 3, hy - 9.2]);
    line(ctx, c.limb, 0.7, [hx + 2.5, hy - 4.6, hx + 3.2, hy - 8.6, hx + 2.2, hy - 10.4]);
    disc(ctx, hx - 3.2, hy - 9.3, 1.1, c.limb);
    disc(ctx, hx + 2, hy - 10.5, 1.1, c.limb);
  } else if (who === 'blitz') {
    line(ctx, c.limb, 0.7, [hx - 0.5, hy - 4.4, hx - 2, hy - 7.5, hx - 4.5, hy - 8]);
    poly(ctx, c.dark, [
      hx + 2,
      hy - 2.4,
      hx + 6,
      hy - 5,
      hx + 8.4,
      hy - 9.4,
      hx + 7.4,
      hy - 5,
      hx + 5,
      hy - 2,
    ]);
  } else {
    const shiver = Math.sin(sec * 40) * 0.4;
    line(ctx, c.limb, 0.6, [
      hx + 0.5,
      hy - 4,
      hx + 1 + shiver,
      hy - 9,
      hx + 3.5 + shiver,
      hy - 11.5,
    ]);
    line(ctx, c.limb, 0.6, [
      hx + 2.2,
      hy - 3.8,
      hx + 4 + shiver,
      hy - 8.4,
      hx + 6.5 + shiver,
      hy - 10,
    ]);
  }
  disc(ctx, hx, hy, hr, c.head);
  oval(ctx, hx - 1.5, hy - 2.6, 1.8, 1, alpha('#FFFFFF', 0.18));
  face(ctx, who, hx, hy, o, sec);
  if (who === 'blitz') {
    poly(ctx, c.dark, [
      hx + 4.2,
      hy - 0.2,
      hx + 7.6,
      hy - 2.8,
      hx + 10.4,
      hy - 7.4,
      hx + 9.8,
      hy - 3,
      hx + 7.6,
      hy + 0.2,
      hx + 4.8,
      hy + 1.4,
    ]);
    poly(ctx, c.dark, [hx + 7.2, hy - 2.4, hx + 8.8, hy - 4.6, hx + 8.4, hy - 2]);
    line(ctx, alpha(c.light, 0.6), 0.5, [hx + 5.4, hy - 0.6, hx + 8.8, hy - 4]);
  }
  const hand = limb(ctx, c.limb, 2, -tall - 1, frontArm, fb);
  if (o.flex)
    disc(ctx, 2 + Math.sin(frontArm) * 2.4, -tall - 1 + Math.cos(frontArm) * 2.4, 1.6, c.limb);
  if (o.hold === 'rag')
    poly(ctx, CREAM, [
      hand.x - 1.5,
      hand.y - 1,
      hand.x + 2,
      hand.y - 1.5,
      hand.x + 1.5,
      hand.y + 2.5,
      hand.x - 1,
      hand.y + 2,
    ]);
  if (o.hold === 'trophy') trophy(ctx, hand.x - 0.5, hand.y - 8.5, 1);
  ctx.restore();
}

function button(ctx: Ctx, x: number, y: number, spin: number, hub: string, nick: boolean) {
  disc(ctx, x, y, 3.6, TYRE);
  disc(ctx, x, y, 2.5, hub);
  const dx = Math.cos(spin) * 0.9,
    dy = Math.sin(spin) * 0.9;
  disc(ctx, x + dx, y + dy, 0.5, TYRE);
  disc(ctx, x - dx, y - dy, 0.5, TYRE);
  if (nick)
    rect(ctx, x + Math.sin(spin) * 3 - 0.6, y - Math.cos(spin) * 3 - 0.6, 1.2, 1.2, '#F4EEE0');
}
function squeakMark(ctx: Ctx, x: number, y: number, t: number) {
  if (t <= 0.05) return;
  const c = alpha(INK, clamp(t) * 0.8);
  line(ctx, c, 0.6, [x - 1, y - 2.2, x - 2.8, y - 3.8]);
  line(ctx, c, 0.6, [x - 1.6, y, x - 3.8, y]);
  line(ctx, c, 0.6, [x - 1, y + 2.2, x - 2.8, y + 3.8]);
}
/** An upturned bottle cap: crimped rim up, number on the side. */
function capBody(ctx: Ctx, who: Who, f: number, number = true) {
  const c = BUGS[who];
  if (who === 'blitz') {
    poly(ctx, c.carDark, [-10, -13, -15, -19.5, -10.5, -20, -7.5, -13]);
    rect(ctx, -17.5, -8, 4, 2, STEEL);
  } else rect(ctx, -15.5, -7, 3, 1.6, STEEL_DARK);
  poly(ctx, c.car, [-12, -3.6, 12, -3.6, 14, -13, -14, -13]);
  rect(ctx, -12, -5.2, 24, 1.6, c.carDark);
  for (let i = -11; i <= 10; i += 3) rect(ctx, i, -12.5, 1, 6.2, alpha(c.carDark, 0.35));
  rect(ctx, -14, -13.8, 28, 1.4, c.carLight);
  rect(ctx, -9, -11.4, 4, 1, alpha('#FFFFFF', 0.55));
  if (who === 'pip') {
    poly(ctx, c.carDark, [4.5, -13.9, 7, -10.6, 9.5, -13.9]);
    line(ctx, alpha(c.carDark, 0.7), 0.5, [3, -11.4, 7, -9.4, 11, -11.6]);
    rect(ctx, -10.5, -10.6, 5, 3, '#EBCB9E');
    rect(ctx, -8.5, -9.6, 1, 1, '#C49A66');
  }
  if (who === 'blitz') rect(ctx, -13, -8.9, 26, 1.2, alpha(CREAM, 0.8));
  if (number) {
    disc(ctx, 1.5, -8.5, 3.2, CREAM);
    ctx.save();
    ctx.scale(f, 1);
    write(ctx, c.n, 1.5 * f, -6.6, { size: 5, color: INK });
    ctx.restore();
  }
}
type Ride = Pose & {
  s?: number;
  facing?: 1 | -1;
  tilt?: number;
  /** Horizontal squash: cos of a spin in the floor plane, for spin-outs. */
  squash?: number;
  spin?: number;
  bounce?: number;
  rise?: number;
  shake?: number;
  empty?: boolean;
  squeak?: number;
};
/** A beetle in its bottle-cap car. (x, y) is where the wheels meet the floor. */
function racer(ctx: Ctx, x: number, y: number, who: Who, o: Ride, sec: number) {
  const c = BUGS[who],
    s = o.s ?? 1,
    f = o.facing ?? 1,
    squash = o.squash ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.tilt ?? 0);
  ctx.scale(s * f * squash, s);
  ctx.translate(o.shake ?? 0, -(o.bounce ?? 0));
  if (!o.empty) {
    ctx.save();
    ctx.translate(0, -10 - (o.rise ?? 0) * 7);
    upper(ctx, who, o, sec);
    ctx.restore();
    line(ctx, STEEL_DARK, 0.9, [6.5, -12, 9, -16]);
    ring(ctx, 9.4, -16.4, 2, STEEL, 1);
  }
  capBody(ctx, who, f * Math.sign(squash || 1));
  const spin = o.spin ?? 0,
    sq = o.squeak ?? 0;
  button(ctx, -8, -3.6 - sq * 0.7, spin, who === 'pip' ? '#C8463A' : c.hub, who === 'pip');
  button(ctx, 8, -3.6, spin + 1.3, c.hub, false);
  if (who === 'pip') squeakMark(ctx, -12, -4, sq);
  ctx.restore();
}
type Stand = Pose & {
  s?: number;
  facing?: 1 | -1;
  knees?: number;
  stride?: number;
  hop?: number;
  tilt?: number;
};
/** A beetle standing on its hind legs. (x, y) is between the feet. */
function bug(ctx: Ctx, x: number, y: number, who: Who, o: Stand, sec: number) {
  const c = BUGS[who],
    s = o.s ?? 1;
  ctx.save();
  ctx.translate(x, y - (o.hop ?? 0));
  ctx.rotate(o.tilt ?? 0);
  ctx.scale(s * (o.facing ?? 1), s);
  const k = o.knees ?? 0,
    st = o.stride ?? 2.2,
    hip = -7 + k * 2.2;
  line(ctx, mix(c.limb, '#000000', 0.25), 1.6, [
    -1.2,
    hip,
    -st - k * 2,
    hip + 3.6 - k * 0.6,
    -st,
    -0.6,
  ]);
  line(ctx, c.limb, 1.6, [1.2, hip, st + k * 2.4, hip + 3.6 - k * 0.6, st, -0.6]);
  rect(ctx, -st - 1.4, -1, 2.6, 1, c.limb);
  rect(ctx, st - 0.6, -1, 2.6, 1, c.limb);
  ctx.translate(0, hip + 1.5);
  upper(ctx, who, o, sec);
  ctx.restore();
}
/** The same racers seen from straight above, for the pea chicane. */
function topRacer(ctx: Ctx, x: number, y: number, heading: number, who: Who, sec: number, s = 1.2) {
  const c = BUGS[who];
  ctx.save();
  ctx.translate(x, y);
  oval(ctx, 3, 4, 14 * s, 12 * s, alpha('#0B0E14', 0.2));
  ctx.rotate(heading);
  ctx.scale(s, s);
  if (who === 'pip')
    line(ctx, SCARF, 2, [
      -2,
      1,
      -9,
      3 + Math.sin(sec * 12) * 1.5,
      -16,
      1 + Math.sin(sec * 12 - 1) * 2.4,
    ]);
  for (const [wx, wy] of [
    [-8, -13.2],
    [5, -13.2],
    [-8, 10.4],
    [5, 10.4],
  ])
    rect(ctx, wx, wy, 6, 2.8, TYRE);
  disc(ctx, 0, 0, 12, c.carDark);
  disc(ctx, 0, 0, 10.8, c.car);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    rect(ctx, Math.cos(a) * 11.3 - 0.6, Math.sin(a) * 11.3 - 0.6, 1.2, 1.2, c.carLight);
  }
  disc(ctx, 0, 0, 8.6, mix(c.car, SHADE, 0.3));
  if (who === 'pip') poly(ctx, c.carDark, [5, -10.5, 8.5, -6, 9.8, -8.5]);
  oval(ctx, -1.6, 0, 6.4, 5.4, c.shell);
  rect(ctx, -8, -0.5, 7, 1, c.dark);
  oval(ctx, -3, -2.6, 2.4, 1.2, alpha(c.light, 0.8));
  if (who === 'blitz') {
    line(ctx, c.dark, 1.3, [7, -1.5, 10.5, -3.2, 12.2, -1]);
    line(ctx, c.dark, 1.3, [7, 1.5, 10.5, 3.2, 12.2, 1]);
  } else {
    line(ctx, c.limb, 0.6, [6.5, -2, 9.5, -4.6]);
    line(ctx, c.limb, 0.6, [6.5, 2, 9.5, 4.6]);
  }
  disc(ctx, 5, 0, 3.4, c.head);
  if (who === 'blitz') rect(ctx, 5.4, -3, 2.2, 6, INK);
  else {
    disc(ctx, 6.4, -1.6, 1, '#FFFFFF');
    disc(ctx, 6.4, 1.6, 1, '#FFFFFF');
  }
  if (who === 'pip') {
    disc(ctx, 3.4, -1.7, 1, BRASS);
    disc(ctx, 3.4, 1.7, 1, BRASS);
  }
  ctx.restore();
}

// ——— The referee and the crowd ———
function chequer(ctx: Ctx, x: number, y: number, angle: number, wave: number, sec: number) {
  const tx = x + Math.sin(angle) * 13,
    ty = y + Math.cos(angle) * 13;
  line(ctx, MATCH, 0.9, [x - Math.sin(angle) * 2, y - Math.cos(angle) * 2, tx, ty]);
  const cell = 2.3;
  for (let col = 0; col < 4; col++) {
    const dy =
      (Math.sin(sec * 11 - col * 1.2) * wave * 1.4 * (col + 1)) / 4 + col * 0.35 * (1 - wave);
    for (let row = 0; row < 3; row++)
      rect(
        ctx,
        tx + col * cell,
        ty + row * cell + dy,
        cell + 0.1,
        cell + 0.1,
        (row + col) % 2 ? INK : '#FFFFFF',
      );
  }
}
type Ref = {
  flag?: number;
  wave?: number;
  eyes?: Eyes;
  whistle?: boolean;
  hop?: number;
  look?: readonly [number, number];
  back?: number;
};
/** The cricket referee, in a striped shirt, with the chequered flag. */
function cricket(ctx: Ctx, x: number, y: number, s: number, o: Ref, sec: number) {
  ctx.save();
  ctx.translate(x, y - (o.hop ?? 0));
  ctx.scale(s, s);
  line(ctx, CRICKET_DARK, 1.8, [-1, -9, -7.5, -17, -6, -0.6]);
  rect(ctx, -7.5, -1, 3, 1, CRICKET_DARK);
  limb(ctx, CRICKET_DARK, -1.5, -20, o.back ?? 0.35, 0.4, 4, 1.1);
  oval(ctx, -1.6, -10.5, 3.8, 6.4, CRICKET);
  rect(ctx, -3.6, -22.5, 7.4, 9.5, '#F4F0E6');
  for (let i = 0; i < 3; i++) rect(ctx, -3.1 + i * 2.6, -22.5, 1.2, 9.5, INK);
  line(ctx, CRICKET, 2.2, [0.6, -9.5, -4.6, -16.5, -2.2, -0.6]);
  rect(ctx, -3.4, -1, 3.4, 1, CRICKET_DARK);
  line(ctx, CRICKET_DARK, 0.6, [2.5, -30, -0.5, -38, -8, -43]);
  line(ctx, CRICKET_DARK, 0.6, [4.5, -30.4, 4.8, -39, 1, -46]);
  oval(ctx, 2.6, -26.6, 4.6, 4.2, CRICKET);
  poly(ctx, INK, [-1.8, -29, 5.6, -31.4, 6.6, -29.4, 9.4, -28.6, 9.2, -27.8, -1.6, -27.6]);
  const [lx, ly] = o.look ?? [0.6, 0];
  for (const ex of [3.8, 6.2]) {
    if (o.eyes === 'happy') line(ctx, INK, 0.6, [ex - 1, -25.6, ex, -26.6, ex + 1, -25.6]);
    else {
      oval(ctx, ex, -26, 1.2, 1.6, '#FFFFFF');
      disc(ctx, ex + lx * 0.5, -26 + ly * 0.6, o.eyes === 'wide' ? 0.5 : 0.75, INK);
    }
  }
  if (o.whistle) {
    rect(ctx, 6.6, -24.2, 3.2, 1.6, STEEL);
    line(ctx, SCARF, 0.4, [7, -23, 4, -20, 1, -21]);
  } else line(ctx, INK, 0.6, [4.6, -23.4, 6, -22.6, 7.2, -23.4]);
  const a = o.flag ?? 2.4;
  const hand = limb(ctx, CRICKET, 1.8, -20, a, -0.35, 4, 1.2);
  chequer(ctx, hand.x, hand.y, a - 0.35, o.wave ?? 0, sec);
  ctx.restore();
}
function ants(
  ctx: Ctx,
  x0: number,
  y0: number,
  count: number,
  gap: number,
  cheer: number,
  sec: number,
  seed: number,
  s = 1,
) {
  for (let i = 0; i < count; i++) {
    const r = rand(seed + i * 1.7);
    const x = x0 + i * gap + (r - 0.5) * gap * 0.5;
    const y = y0 - cheer * Math.max(0, Math.sin(sec * (7 + r * 5) + i * 2.1)) * 3 * s;
    const col = r > 0.72 ? ANT_RED : ANT;
    box(ctx, x - s, y - 4 * s, 3 * s, 4 * s, col);
    box(ctx, x - s, y - 7 * s, 3 * s, 3 * s, col);
    box(ctx, x, y - 6 * s, s, s, '#F2E4CC');
    const up = cheer > 0.3,
      reach = up ? 3 : 2;
    box(ctx, x - (up ? 2 : 1) * s, y - (7 + reach) * s, s, reach * s, col);
    box(ctx, x + (up ? 2 : 1) * s, y - (7 + reach) * s, s, reach * s, col);
    if (i % 4 === 1) {
      const flap = Math.sin(sec * 8 + i) * s;
      box(ctx, x + 2 * s, y - 15 * s, s * 0.8, 6 * s, INK);
      poly(ctx, i % 8 === 1 ? GOLD : RED, [
        x + 2.8 * s,
        y - 15 * s,
        x + 2.8 * s,
        y - 11 * s,
        x + 7 * s,
        y - 13 * s + flap,
      ]);
    }
  }
}

// ——— Props at beetle scale ———
function matchbox(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  d = 6,
  n = '',
) {
  poly(ctx, '#F4E9CF', [
    x,
    y - h,
    x + d,
    y - h - d * 0.6,
    x + w + d,
    y - h - d * 0.6,
    x + w,
    y - h,
  ]);
  poly(ctx, '#7D553A', [
    x + w,
    y - h,
    x + w + d,
    y - h - d * 0.6,
    x + w + d,
    y - d * 0.6,
    x + w,
    y,
  ]);
  box(ctx, x, y - h, w, h, '#E8D8B4');
  box(ctx, x + 2, y - h + 2, w - 4, h - 4, label);
  if (n) write(ctx, n, x + w / 2, y - h / 2 + 5, { size: 14, color: CREAM, type: 'serif' });
  else if (h >= 12) {
    const cx = x + w / 2,
      cy = y - h / 2;
    poly(ctx, GOLD, [cx - 3, cy + 3, cx - 1, cy - 3, cx, cy - 1, cx + 1, cy - 5, cx + 3, cy + 3]);
  }
}
function capFace(ctx: Ctx, x: number, y: number, r: number, color: string, rim: string) {
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    disc(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.14, rim);
  }
  disc(ctx, x, y, r, rim);
  disc(ctx, x, y, r * 0.8, color);
  oval(ctx, x - r * 0.3, y - r * 0.35, r * 0.3, r * 0.18, alpha('#FFFFFF', 0.45), -0.5);
}
/** A golden bottle cap on a thimble stem. */
function trophy(ctx: Ctx, x: number, y: number, s: number) {
  rect(ctx, x - 1.2 * s, y + 3.5 * s, 2.4 * s, 3 * s, BRASS);
  rect(ctx, x - 3 * s, y + 6.5 * s, 6 * s, 1.4 * s, '#A8862E');
  capFace(ctx, x, y, 4 * s, GOLD, '#A8862E');
}
const lampColor = (lit: number, go: number) => mix(mix('#5B2B25', '#F0503A', lit), '#62D86A', go);
const lamps = (p: number) => T.lights.map((l) => ease(span(p, l, l + 0.0056)));
const green = (p: number) => ease(span(p, T.go, T.go + 0.0056));

function cabinets(ctx: Ctx, base: number, off: number, left = -20, right = W + 20, top = -20) {
  box(ctx, left, top, right - left, base - top, CAB);
  const door = 78;
  for (let x = left - wrap(off, door) - door; x < right + door; x += door) {
    box(ctx, x + 4, top + 26, door - 8, base - top - 38, CAB_DARK);
    box(ctx, x + 7, top + 29, door - 14, base - top - 44, CAB);
    box(ctx, x + 7, top + 29, 2, base - top - 44, CAB_LIGHT);
    box(ctx, x + door - 15, top + 36, 3, 14, BRASS);
  }
  box(ctx, left, base - 10, right - left, 10, KICK);
  box(ctx, left, base - 11, right - left, 1, CAB_DARK);
}
function fridgeFront(ctx: Ctx, x: number, w: number, base: number, gap = 12) {
  box(ctx, x, -20, w, base - gap + 20, FRIDGE);
  box(ctx, x + w - 8, -20, 8, base - gap + 20, FRIDGE_SHADE);
  box(ctx, x + 4, base - gap - 8, w - 12, 6, '#A9B2B8');
  for (let i = 0; i < Math.floor((w - 16) / 8); i++)
    box(ctx, x + 7 + i * 8, base - gap - 6, 5, 2, '#7F8990');
  box(ctx, x, base - gap, w, gap, GAP);
  box(ctx, x + 5, base - gap, 4, gap, '#57525E');
  box(ctx, x + w - 10, base - gap, 4, gap, '#57525E');
}
// The floor in perspective, for the wide shots: tiles recede toward a vanishing point.
const WALL0 = 88,
  VY0 = 30;
const DEPTH = [1, 1.176, 1.4286, 1.818, 2.5, 4, 10];
const depthAt = (y: number, wallY = WALL0, vy = VY0) => (y - vy) / (wallY - vy);
const seamX = (u: number, y: number) => 160 + u * depthAt(y);
const carScale = (y: number) => 0.4 * depthAt(y);
function tiles(ctx: Ctx, wallY: number, vy = VY0, colors: readonly [string, string] = TILE) {
  const ys = DEPTH.map((k) => vy + (wallY - vy) * k);
  box(ctx, -20, wallY, W + 40, H + 20 - wallY, colors[0]);
  const x = (j: number, k: number) => 160 + j * 26 * k;
  for (let r = 0; r < DEPTH.length - 1 && ys[r] < H + 20; r++) {
    for (let j = -16; j < 16; j++) {
      if (wrap(j + r, 2) === 0) continue;
      const a = x(j, DEPTH[r]),
        b = x(j + 1, DEPTH[r]),
        c = x(j + 1, DEPTH[r + 1]),
        d = x(j, DEPTH[r + 1]);
      if (Math.max(a, b, c, d) < -20 || Math.min(a, b, c, d) > W + 20) continue;
      poly(ctx, colors[1], [a, ys[r], b, ys[r], c, ys[r + 1], d, ys[r + 1]]);
    }
    box(ctx, -20, ys[r], W + 40, 1, GROUT);
  }
}
/** The floor seen side on, for tracking shots: near tiles slide past faster than far ones. */
function sideTiles(ctx: Ctx, top: number, scroll: number, cx = 160, left = -20, right = W + 20) {
  const rows = [0, 0.09, 0.21, 0.38, 0.6, 0.88, 1.2].map((t) => top + t * (H - top));
  const sc = (y: number) => lerp(0.42, 1.3, (y - top) / (H - top));
  box(ctx, left, top, right - left, H + 30 - top, TILE[0]);
  const size = 48;
  const j0 = Math.floor((scroll - (cx - left) / 0.42) / size) - 1,
    j1 = Math.ceil((scroll + (right - cx) / 0.42) / size) + 1;
  for (let r = 0; r < rows.length - 1; r++) {
    const s0 = sc(rows[r]),
      s1 = sc(rows[r + 1]);
    for (let j = j0; j < j1; j++) {
      if (wrap(j + r, 2) === 0) continue;
      const u0 = j * size - scroll,
        u1 = u0 + size;
      const a = cx + u0 * s0,
        b = cx + u1 * s0,
        c = cx + u1 * s1,
        d = cx + u0 * s1;
      if (Math.max(a, b, c, d) < left || Math.min(a, b, c, d) > right) continue;
      poly(ctx, TILE[1], [a, rows[r], b, rows[r], c, rows[r + 1], d, rows[r + 1]]);
    }
  }
}
function tableLeg(ctx: Ctx, x: number, top: number, bottom: number, w: number, color = WOOD) {
  box(ctx, x, top, w, bottom - top, color);
  box(ctx, x + w * 0.18, top, Math.max(1, w * 0.14), bottom - top, alpha('#FFFFFF', 0.14));
  box(ctx, x + w * 0.72, top, w * 0.28, bottom - top, alpha('#000000', 0.18));
  box(ctx, x - 1, bottom - 4, w + 2, 4, '#4A3A30');
}
function pea(ctx: Ctx, x: number, y: number, r: number, roll = 0) {
  oval(ctx, x + r * 0.25, y + r * 0.8, r, r * 0.32, alpha('#0B0E14', 0.2));
  disc(ctx, x, y, r, PEA_DARK);
  disc(ctx, x - r * 0.1, y - r * 0.1, r * 0.86, PEA);
  oval(ctx, x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.2, PEA_LIGHT);
  disc(ctx, x + Math.cos(roll) * r * 0.5, y + Math.sin(roll) * r * 0.5, r * 0.12, PEA_DARK);
}
function sugarCube(ctx: Ctx, x: number, y: number, size: number) {
  box(ctx, x, y - size, size, size, SUGAR);
  box(ctx, x + size * 0.72, y - size, size * 0.28, size, SUGAR_SHADE);
  box(ctx, x, y - size, size, 1, '#FFFFFF');
  for (let i = 0; i < 6; i++)
    box(
      ctx,
      x + rand(i * 3.3) * (size - 2),
      y - size + rand(i * 5.1) * (size - 2),
      1,
      1,
      i % 2 ? '#DDD3BF' : '#FFFFFF',
    );
}
function sugarBowl(ctx: Ctx, x: number, y: number, r: number) {
  shade(ctx, x, y, r * 2.4, 0.2);
  box(ctx, x - r * 0.5, y - r * 0.2, r, r * 0.2, '#D9E1E6');
  oval(ctx, x, y - r * 0.75, r, r * 0.62, '#EEF3F5');
  oval(ctx, x + r * 0.4, y - r * 0.7, r * 0.45, r * 0.5, '#D8E0E5');
  box(ctx, x - r * 0.95, y - r * 0.95, r * 1.9, r * 0.14, '#5C86B8');
  oval(ctx, x, y - r * 1.34, r * 0.92, r * 0.16, '#DDE5EA');
  oval(ctx, x + r * 0.6, y - r * 1.52, r * 0.6, r * 0.2, '#EEF3F5', 0.5);
  disc(ctx, x + r * 0.84, y - r * 1.74, r * 0.12, '#5C86B8');
  poly(ctx, SUGAR, [
    x - r * 2.2,
    y + 1,
    x - r * 1.2,
    y - r * 0.45,
    x - r * 0.6,
    y - r * 0.25,
    x - r * 0.2,
    y + 1,
  ]);
}
function thimble(ctx: Ctx, x: number, y: number, w: number, h: number) {
  poly(ctx, STEEL, [x - w / 2, y, x - w * 0.42, y - h, x + w * 0.42, y - h, x + w / 2, y]);
  box(ctx, x - w / 2, y - 2, w, 2, STEEL_DARK);
  for (let i = 0; i < 3; i++)
    for (let k = 0; k < 3; k++)
      box(ctx, x - w * 0.3 + k * w * 0.25, y - h + 2 + i * (h / 3.5), 1, 1, STEEL_DARK);
  box(ctx, x - w * 0.38, y - h, 2, h - 2, '#EEF2F4');
}
/** Pink fuzzy slipper, toe toward us, with a pyjama leg rising out of frame. */
function slipper(ctx: Ctx, x: number, y: number, s: number) {
  box(ctx, x - 22 * s, -240, 44 * s, y - 30 * s + 240, '#7F9CC8');
  for (let i = 0; i < 4; i++)
    box(ctx, x - 20 * s + i * 11 * s, -240, 4 * s, y - 30 * s + 240, '#A9C0E0');
  box(ctx, x - 24 * s, y - 34 * s, 48 * s, 6 * s, '#6A87B4');
  shade(ctx, x, y, 74 * s, 0.32);
  oval(ctx, x, y - 14 * s, 35 * s, 16 * s, SLIPPER_DARK);
  oval(ctx, x, y - 16 * s, 32 * s, 15 * s, SLIPPER);
  for (let i = 0; i < 9; i++)
    disc(ctx, x - 28 * s + i * 7 * s, y - 28 * s + Math.abs(i - 4) * 1.4 * s, 5 * s, '#F6C2CF');
  disc(ctx, x, y - 19 * s, 8 * s, '#FFFFFF');
  disc(ctx, x + 2 * s, y - 21 * s, 5 * s, '#FBE3EA');
}
/** The mop head seen from the front: a clamp and a curtain of wet strings. */
function mopFront(ctx: Ctx, x: number, y: number, splay: number, sec: number) {
  for (let i = 0; i < 16; i++) {
    const t = i / 15 - 0.5;
    const sway = Math.sin(sec * 3 + i) * 2 * (1 - splay);
    const x0 = x + t * 44,
      x1 = x + t * (54 + splay * 90) + sway;
    line(ctx, i % 3 ? MOP : MOP_DARK, 6, [x0, y - 58, lerp(x0, x1, 0.5) + sway, y - 30, x1, y - 2]);
  }
  box(ctx, x - 26, y - 72, 52, 14, '#5E7F9A');
  box(ctx, x - 26, y - 72, 52, 3, '#86A6C0');
}
/** The mop seen side on, dragged along the floor to the right; its strings trail behind. */
function mopSide(ctx: Ctx, x: number, y: number, sec: number) {
  line(ctx, WOOD_LIGHT, 7, [x - 4, y - 70, x - 150, y - 330]);
  oval(ctx, x - 16, y - 24, 46, 26, MOP_DARK);
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const wob = Math.sin(sec * 9 + i * 1.7) * 3;
    line(ctx, i % 3 ? MOP : MOP_DARK, 5, [
      x - 6 + t * 16,
      y - 58,
      x - 20 - t * 30 + wob,
      y - 36 + t * 8,
      x - 44 - t * 40 + wob * 1.5,
      y - 4 - rand(i) * 4,
    ]);
  }
  box(ctx, x - 18, y - 70, 30, 14, '#5E7F9A');
  box(ctx, x - 18, y - 70, 30, 3, '#86A6C0');
}
/** A rolling wall of soapy water; `front` is where the curl meets the floor. */
function soapWave(ctx: Ctx, front: number, base: number, crest: number, sec: number, left = -40) {
  if (front < left || crest <= 0) return;
  const top = base - crest;
  const pts = [left, base + 30, left, base - crest * 0.45];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6,
      x = lerp(left, front - 14, t);
    pts.push(x, base - crest * (0.45 + 0.55 * t * t) + Math.sin(sec * 3 + x * 0.08) * 1.5);
  }
  pts.push(
    front - 6,
    top - 2,
    front + 8,
    top + crest * 0.14,
    front + 3,
    top + crest * 0.34,
    front + 4,
    base + 30,
  );
  poly(ctx, SOAP, pts);
  poly(ctx, alpha(SOAP_DEEP, 0.6), [
    left,
    base + 30,
    left,
    base - crest * 0.2,
    front - 24,
    base - crest * 0.3,
    front + 4,
    base + 30,
  ]);
  for (let i = 0; i < 3; i++) {
    const y = base - crest * (0.3 + i * 0.12);
    box(ctx, lerp(left, front - 30, wrap(sec * 0.3 + i * 0.37, 1)), y, 18, 1, alpha(FOAM, 0.5));
  }
  disc(ctx, front + 1, top + crest * 0.24, crest * 0.12, alpha(SOAP_DEEP, 0.7));
  for (let i = 0; i < 7; i++)
    disc(
      ctx,
      front - 4 - i * 8 + Math.sin(sec * 6 + i) * 1.5,
      top + i * i * 0.5 + 1,
      Math.max(1, 3.6 - i * 0.35) * (crest / 30 + 0.4),
      FOAM,
    );
  for (let i = 0; i < 6; i++) {
    const t = wrap(sec * 1.4 + i * 0.17, 1);
    box(
      ctx,
      front + 2 + t * 14 + i,
      top - 4 - Math.sin(t * Math.PI) * 10,
      2,
      2,
      alpha(FOAM, 1 - t),
    );
  }
}

// ——— Shot 0: the kitchen, at beetle height ———
const U_START = 40;
function gridWide(ctx: Ctx, p: number, sec: number) {
  cabinets(ctx, WALL0, 30);
  fridgeFront(ctx, -4, 60, WALL0);
  poly(ctx, alpha(SUN, 0.14), [150, -20, 240, -20, 320, WALL0, 206, WALL0]);
  tiles(ctx, WALL0);
  poly(ctx, alpha(SUN, 0.2), [206, WALL0, 330, WALL0, 380, H + 20, 262, H + 20]);
  sugarBowl(ctx, 290, WALL0 + 6, 26);
  sugarCube(ctx, 236, WALL0 + 10, 7);
  line(ctx, STEEL, 2, [212, WALL0 + 10, 240, WALL0 + 2]);
  oval(ctx, 246, WALL0 + 1, 8, 3, STEEL, -0.28);
  tableLeg(ctx, 72, -20, 114, 18);
  shade(ctx, 81, 114, 28);
  pea(ctx, 128, 104, 5);
  pea(ctx, 22, 166, 11);
  // The start line is chalked along a grout seam, with the lights over it.
  const lx = (y: number) => seamX(U_START, y);
  poly(ctx, alpha('#FFFFFF', 0.85), [
    lx(96) - 1,
    96,
    lx(96) + 2,
    96,
    lx(178) + 4,
    178,
    lx(178) - 2,
    178,
  ]);
  const lit = lamps(p),
    g = green(p);
  const gx = lx(98) + 4;
  box(ctx, gx - 1, 44, 3, 54, MATCH);
  box(ctx, gx - 32, 42, 36, 3, MATCH);
  oval(ctx, gx - 33, 43.5, 3, 2.4, RED);
  for (let i = 0; i < 3; i++) capFace(ctx, gx - 24 + i * 9, 50, 3, lampColor(lit[i], g), '#3A2B26');
  cricket(ctx, gx + 16, 102, 0.42, { flag: 2.7, wave: 0.3 }, sec);
  // The grid: Blitz on pole, #2 behind him, and Pip at the very back, polishing.
  const by = 114,
    bs = carScale(by);
  shade(ctx, lx(by) - 14 * bs - 2, by, 30 * bs);
  racer(
    ctx,
    lx(by) - 14 * bs - 2,
    by,
    'blitz',
    { s: bs, arms: DRIVE, bends: DRIVE_BEND, mouth: 'smirk', shake: Math.sin(sec * 50) * 0.3 },
    sec,
  );
  puff(ctx, lx(by) - 31 * bs, by - 7 * bs, wrap(sec * 0.9, 1), 3, '#9D968D');
  const jy = 131,
    js = carScale(jy);
  shade(ctx, lx(jy) - 46, jy, 30 * js);
  racer(
    ctx,
    lx(jy) - 46,
    jy,
    'jewel',
    {
      s: js,
      arms: DRIVE,
      bends: DRIVE_BEND,
      eyes: 'wide',
      mouth: 'wobble',
      shake: Math.sin(sec * 60) * 0.35,
      sweat: true,
    },
    sec,
  );
  const py = 152,
    ps = carScale(py);
  shade(ctx, 112, py, 30 * ps);
  racer(ctx, 112, py, 'pip', { s: ps, empty: true }, sec);
  const r = sec * 11;
  bug(
    ctx,
    112 + 18 * ps + 6,
    py + 3,
    'pip',
    {
      s: ps,
      facing: -1,
      lean: 0.15,
      arms: [0.4, 1.35 + Math.sin(r) * 0.35],
      bends: [0.5, 0.4 + Math.cos(r) * 0.35],
      hold: 'rag',
      eyes: 'happy',
    },
    sec,
  );
  // Ants in matchbox grandstands.
  matchbox(ctx, 246, 142, 64, 18, RED, 8);
  ants(ctx, 254, 122, 8, 7.4, 0.6, sec, 11, 0.9);
  matchbox(ctx, 236, 190, 90, 22, BLUE, 10);
  ants(ctx, 246, 164, 9, 9, 0.6, sec, 17, 1.15);
  motes(ctx, sec, 190, 320, 10, 150);
  glow(ctx, 290, 10, 170, SUN, 0.28);
}
function establishing(ctx: Ctx, p: number, sec: number) {
  camera(
    ctx,
    track(p, [
      [0, 160, 90, 1],
      [0.05, 172, 116, 1.3],
    ]),
    () => gridWide(ctx, p, sec),
  );
  vignette(ctx, 0.42);
}

// ——— Shots 1 and 3: the grid, side on ———
const GRID = { blitz: [236, 134, 0.95], jewel: [196, 156, 1.05], pip: [88, 156, 1.05] } as const;
function gridSide(ctx: Ctx, cheer: number, sec: number) {
  cabinets(ctx, 62, 10);
  sideTiles(ctx, 62, 0);
  matchbox(ctx, -12, 104, 118, 20, BLUE, 8);
  matchbox(ctx, 112, 104, 116, 20, RED, 8);
  matchbox(ctx, 234, 104, 110, 20, GREEN, 8);
  ants(ctx, -4, 82, 15, 7.6, cheer, sec, 3);
  ants(ctx, 120, 82, 15, 7.6, cheer, sec, 5);
  ants(ctx, 242, 82, 13, 7.6, cheer, sec, 7);
  poly(ctx, alpha('#FFFFFF', 0.85), [258, 104, 262, 104, 282, H + 10, 274, H + 10]);
  for (let i = 0; i < 9; i++) {
    const y = 106 + i * 9;
    box(ctx, 265 + (y - 104) * 0.22, y, 4, 4.5, i % 2 ? INK : '#FFFFFF');
  }
  box(ctx, 290, 10, 4, 96, MATCH);
}
function gridShot(ctx: Ctx, p: number, sec: number) {
  camera(
    ctx,
    track(p, [
      [0.05, 232, 116, 2.2],
      [0.064, 228, 114, 2.35],
      [0.07, 104, 124, 2.3],
      [0.087, 100, 126, 2.45],
    ]),
    () => {
      gridSide(ctx, 0.5, sec);
      // Blitz revs, then stands up in his seat to flex for the crowd.
      {
        const [x, y, s] = GRID.blitz;
        const rev = Math.max(...T.revs.map((r) => hump(p, r, r + 0.004)));
        const flex = Math.min(
          span(p, T.flex, T.flex + 0.0015),
          1 - span(p, T.flex + 0.0055, T.flex + 0.0075),
        );
        shade(ctx, x, y, 30 * s);
        racer(
          ctx,
          x,
          y,
          'blitz',
          {
            s,
            shake: rev * Math.sin(sec * 80) * 0.5,
            bounce: rev * Math.abs(Math.sin(sec * 40)) * 0.8,
            rise: flex * 0.8,
            arms: flex > 0.2 ? [1.7, 1.6] : DRIVE,
            bends: flex > 0.2 ? [1.6, 1.7] : DRIVE_BEND,
            flex: flex > 0.2,
            mouth: flex > 0.2 ? 'grin' : 'smirk',
          },
          sec,
        );
        T.revs.forEach((r) =>
          puff(ctx, x - 18 * s, y - 7 * s, span(p, r, r + 0.008), 4, '#9D968D'),
        );
        glint(
          ctx,
          x + 7.5 * s,
          y - (29.8 + flex * 5.6) * s,
          5,
          hump(p, T.flex + 0.002, T.flex + 0.005),
        );
      }
      // #2 trembles; his engine only sputters.
      {
        const [x, y, s] = GRID.jewel;
        const cough = hump(p, T.sputter, T.sputter + 0.003);
        shade(ctx, x, y, 30 * s);
        racer(
          ctx,
          x + cough * 2,
          y,
          'jewel',
          {
            s,
            arms: DRIVE,
            bends: DRIVE_BEND,
            eyes: 'wide',
            mouth: cough > 0.3 ? 'o' : 'wobble',
            look: [0.8, -0.5],
            sweat: true,
            shake: Math.sin(sec * 60) * 0.35,
          },
          sec,
        );
        puff(ctx, x - 17 * s, y - 7 * s, span(p, T.sputter, T.sputter + 0.007), 3, '#5E5852');
      }
      // Pip breathes on his dent, polishes it, admires it, and hops in.
      {
        const [x, y, s] = GRID.pip;
        shade(ctx, x, y, 30 * s);
        if (p >= T.hop + 0.003) {
          racer(
            ctx,
            x,
            y,
            'pip',
            { s, arms: DRIVE, bends: DRIVE_BEND, eyes: 'happy', mouth: 'grin' },
            sec,
          );
          return;
        }
        racer(ctx, x, y, 'pip', { s, empty: true }, sec);
        const sx = 112,
          sy = 162;
        const hop = span(p, T.hop, T.hop + 0.003);
        if (hop > 0) {
          bug(
            ctx,
            lerp(sx, x, hop),
            lerp(sy, y - 6, hop) - Math.sin(hop * Math.PI) * 16,
            'pip',
            {
              s: 1.1,
              arms: [2.5, 2.7],
              bends: [0.3, 0.3],
              eyes: 'happy',
              mouth: 'grin',
              knees: 0.8,
              scarf: 0.6,
            },
            sec,
          );
          return;
        }
        const breath = hump(p, T.breath, T.breath + 0.003);
        const rubbing = within(p, T.breath + 0.0025, T.ting - 0.001);
        const proud = p >= T.ting - 0.001;
        const r = sec * 11;
        bug(
          ctx,
          sx + (proud ? 3 : 0),
          sy,
          'pip',
          {
            s: 1.1,
            facing: -1,
            lean: breath * 0.35 + (rubbing ? 0.15 : 0) - (proud ? 0.08 : 0),
            arms: proud ? [0.5, 0.5] : rubbing ? [0.4, 1.35 + Math.sin(r) * 0.35] : [0.3, 0.9],
            bends: proud ? [-1.6, -1.6] : rubbing ? [0.5, 0.4 + Math.cos(r) * 0.35] : [0.5, 0.6],
            hold: proud ? undefined : 'rag',
            eyes: breath > 0.2 ? 'closed' : proud || rubbing ? 'happy' : 'open',
            mouth: breath > 0.2 ? 'o' : proud ? 'grin' : 'smile',
          },
          sec,
        );
        const dx = x + 7 * s,
          dy = y - 12 * s;
        faded(ctx, breath, () => oval(ctx, dx + 3, dy, 4, 2.5, alpha('#FFFFFF', 0.6)));
        glint(ctx, dx, dy - 1, 6, hump(p, T.ting, T.ting + 0.004));
      }
    },
  );
  vignette(ctx, 0.35);
}

// ——— Shot 2: the lights ———
function lightsShot(ctx: Ctx, p: number, sec: number) {
  const lit = lamps(p),
    g = green(p);
  camera(
    ctx,
    track(p, [
      [0.087, 160, 92, 1],
      [0.122, 160, 86, 1.12],
    ]),
    () => {
      sky(ctx, ['#6F8F7B', '#7F9F8A', '#A8B08A', '#D6BD8E', '#E2C99A'], 0, H);
      for (let i = 0; i < 9; i++)
        disc(
          ctx,
          rand(i * 3.1) * W,
          20 + rand(i * 5.3) * 140,
          10 + rand(i * 7.7) * 18,
          alpha(i % 3 ? SUN : '#FFFFFF', 0.12),
        );
      box(ctx, 30, 38, 262, 8, MATCH);
      box(ctx, 30, 38, 262, 2, '#F6DDAA');
      oval(ctx, 298, 42, 10, 7, RED);
      box(ctx, 52, 46, 8, 140, MATCH);
      box(ctx, 52, 46, 2, 140, '#F6DDAA');
      for (let i = 0; i < 3; i++) {
        const x = 118 + i * 52,
          y = 90;
        const on = Math.max(lit[i], g),
          c = lampColor(lit[i], g);
        line(ctx, '#5B4A3E', 1, [x, 46, x, y - 18]);
        glow(ctx, x, y, 46, c, 0.5 * on);
        capFace(ctx, x, y, 17, c, mix('#3A2B26', c, 0.25));
        disc(ctx, x - 4, y - 5, 4, alpha('#FFFFFF', 0.35 * on));
      }
      const drop = easeOut(span(p, T.go, T.go + 0.004));
      cricket(
        ctx,
        272,
        204,
        2.6,
        {
          flag: lerp(2.9, 1.3, drop),
          wave: 0.2,
          whistle: true,
          look: drop > 0.5 ? [0.6, 0] : [-0.9, -0.6],
          hop: hump(p, T.go, T.go + 0.004) * 6,
        },
        sec,
      );
    },
  );
  vignette(ctx, 0.5);
}

// ——— Shot 3: GO ———
function launchShot(ctx: Ctx, p: number, sec: number) {
  camera(
    ctx,
    track(p, [
      [0.122, 206, 120, 1.45],
      [0.13, 196, 122, 1.5],
      [0.142, 156, 126, 1.85],
    ]),
    () => {
      gridSide(ctx, 1, sec);
      for (let k = 0; k < 3; k++) {
        puff(ctx, 226 - k * 7, 132, span(p, T.go + k * 0.0015, T.go + k * 0.0015 + 0.014), 6);
        puff(
          ctx,
          186 - k * 7,
          154,
          span(p, T.go + 0.0025 + k * 0.0015, T.go + 0.0165 + k * 0.0015),
          7,
        );
      }
      const bx = 236 + easeIn(span(p, T.go, T.go + 0.012)) * 330;
      if (bx > 240)
        for (let i = 0; i < 4; i++)
          box(ctx, bx - 70 - i * 8, 122 - i * 5, 44, 1, alpha(CREAM, 0.7));
      racer(
        ctx,
        bx,
        134,
        'blitz',
        { s: 0.95, lean: 0.25, spin: p * 900, arms: DRIVE, bends: DRIVE_BEND, mouth: 'grin' },
        sec,
      );
      const jx = 196 + easeIn(span(p, T.go + 0.0025, T.go + 0.016)) * 360;
      racer(
        ctx,
        jx,
        156,
        'jewel',
        {
          s: 1.05,
          spin: p * 800,
          eyes: 'wide',
          mouth: 'o',
          arms: DRIVE,
          bends: DRIVE_BEND,
          lean: -0.2,
        },
        sec,
      );
      // Pip's engine coughs twice, then off he putters.
      const [x, y, s] = GRID.pip;
      const jolt = T.backfire.reduce((a, b) => a + 3 * easeOut(span(p, b, b + 0.002)), 0);
      const rolling = Math.max(0, p - T.putter) * 6000;
      const cough = Math.max(...T.backfire.map((b) => hump(p, b - 0.001, b + 0.003)));
      shade(ctx, x + jolt + rolling, y, 30 * s);
      racer(
        ctx,
        x + jolt + rolling,
        y,
        'pip',
        {
          s,
          spin: rolling > 0 ? wheelTurn(p) : 0,
          squeak: rolling > 0 ? squeakAt(p) : 0,
          shake: cough * Math.sin(sec * 90) * 0.6,
          goggles: span(p, T.go, T.go + 0.003),
          arms: DRIVE,
          bends: DRIVE_BEND,
          eyes: cough > 0.3 ? 'closed' : p > T.putter ? 'happy' : 'open',
          mouth: cough > 0.3 ? 'flat' : 'grin',
          scarf: p > T.putter ? 0.4 : 0.1,
        },
        sec,
      );
      T.backfire.forEach((b) =>
        puff(ctx, x + jolt - 16 * s, y - 6 * s, span(p, b, b + 0.01), 5, '#6A625C'),
      );
      cricket(
        ctx,
        300,
        130,
        0.95,
        { flag: 1.4, wave: 1, hop: Math.abs(Math.sin(sec * 9)) * 2 },
        sec,
      );
    },
  );
  vignette(ctx, 0.35);
}

// ——— Shot 4: under the table ———
const tableScroll = (p: number) => braking(p, 0.14, 12000, T.slow, T.stop);
function tableShot(ctx: Ctx, p: number, sec: number) {
  const scroll = tableScroll(p),
    atSlow = tableScroll(T.slow);
  const moving = 1 - span(p, T.slow, T.stop);
  cabinets(ctx, 100, scroll * 0.3);
  sideTiles(ctx, 100, scroll);
  for (let i = 0; i < 3; i++)
    tableLeg(ctx, wrap(i * 150 - scroll * 0.55, 450) - 60, 20, 104, 10, WOOD_DARK);
  box(ctx, 0, 0, W, 22, '#3E2A1E');
  for (let i = 0; i < 9; i++) box(ctx, wrap(i * 40 - scroll * 0.6, 360) - 20, 0, 1, 22, '#33231A');
  box(ctx, 0, 22, W, 5, '#57392A');
  box(ctx, 0, 27, W, H - 27, alpha(DUSK, 0.24));
  for (let i = 0; i < 8; i++)
    box(ctx, wrap(i * 97 - scroll, 800) - 40, 146 + (i % 3) * 9, 3, 2, '#C99A5E');
  // The leaders keep pace with the camera, then leave it standing.
  const world = (start: number, v: number) =>
    start + (p < T.slow ? scroll : atSlow + v * (p - T.slow));
  const jx = world(140 + Math.sin(sec * 2.3) * 8, 15000) - scroll;
  racer(
    ctx,
    jx,
    140,
    'jewel',
    {
      s: 1.4,
      spin: sec * 30,
      arms: DRIVE,
      bends: DRIVE_BEND,
      eyes: 'wide',
      mouth: 'wobble',
      sweat: true,
      lean: 0.1,
      bounce: Math.abs(Math.sin(sec * 23)) * 0.5,
    },
    sec,
  );
  const bx = world(196 + Math.sin(sec * 1.7) * 6, 17000) - scroll;
  const glance = within(p, 0.147, 0.153);
  racer(
    ctx,
    bx,
    168,
    'blitz',
    {
      s: 1.7,
      spin: sec * 30,
      lean: 0.25,
      arms: DRIVE,
      bends: DRIVE_BEND,
      glasses: glance ? 0.45 : 1,
      look: [-1, 0],
      mouth: glance ? 'smirk' : 'grin',
      bounce: Math.abs(Math.sin(sec * 19)) * 0.4,
    },
    sec,
  );
  speedLines(ctx, sec, moving, 30, 170);
  // A beat of empty floor... then here comes Pip.
  if (p > T.pipIn) {
    const px = -34 + 6500 * (p - T.pipIn);
    shade(ctx, px, 168, 46);
    racer(
      ctx,
      px,
      168,
      'pip',
      {
        s: 1.7,
        spin: wheelTurn(p),
        squeak: squeakAt(p),
        arms: DRIVE,
        bends: DRIVE_BEND,
        goggles: 1,
        eyes: 'happy',
        mouth: 'smile',
        scarf: 0.5,
      },
      sec,
    );
  }
  for (const at of T.legs)
    tableLeg(ctx, 140 - (scroll - tableScroll(at)) * 1.8, -20, H + 20, 40, '#3A2618');
  puff(ctx, 300, 158, span(p, T.stop - 0.002, T.stop + 0.012), 9, '#B9AE98');
  box(ctx, 0, 0, W, H, alpha(DUSK, 0.1));
  vignette(ctx, 0.5);
}

// ——— Shot 5: the spoon ———
const PIVOT = { x: 275, y: 124 };
const TILT0 = -Math.asin(26 / 130),
  TILT1 = 0.3;
const lipY = (u: number) => (u <= 30 ? 0 : -(((u - 30) / 50) ** 2) * 14);
const lipSlope = (u: number) => (u <= 30 ? 0 : (-2 * (u - 30) * 14) / 2500);
const spoonTilt = (p: number) => lerp(TILT0, TILT1, easeIn(span(p, T.tip, T.touch)));
function onSpoon(u: number, tilt: number, v = lipY(u)) {
  const c = Math.cos(tilt),
    s = Math.sin(tilt);
  return {
    x: PIVOT.x + u * c - v * s,
    y: PIVOT.y + u * s + v * c,
    tilt: tilt + Math.atan(lipSlope(u)),
  };
}
function spoon(ctx: Ctx, tilt: number) {
  const at = (u: number, v: number) => onSpoon(u, tilt, v);
  const a = at(-130, 0),
    b = at(0, 0),
    c = at(0, 3.4),
    d = at(-130, 2.4);
  poly(ctx, STEEL, [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]);
  const e = at(-130, 1.2);
  disc(ctx, e.x, e.y, 3.4, STEEL);
  const pts: number[] = [];
  for (let u = 0; u <= 80; u += 8) {
    const q = at(u, lipY(u));
    pts.push(q.x, q.y);
  }
  for (let u = 80; u >= 0; u -= 8) {
    const q = at(u, lipY(u) + 3 + (u > 5 ? 10 * Math.sin((Math.PI * (u - 5)) / 75) : 0));
    pts.push(q.x, q.y);
  }
  poly(ctx, STEEL, pts);
  const f = at(20, 6),
    g = at(62, 3);
  line(ctx, STEEL_DARK, 3, [f.x, f.y, g.x, g.y]);
  const h = at(-120, 0.4),
    k = at(70, lipY(70) + 0.4);
  line(ctx, alpha('#FFFFFF', 0.8), 1, [h.x, h.y, b.x, b.y - 0.2, k.x, k.y]);
}
/** Where a car is on the spoon course: floor, handle, lip, air, and floor again. */
function jump(p: number, up: number, launch: number, land: number, rise: number, reach: number) {
  if (p < up) return { x: lerp(20, 147.6, span(p, 0.18, up)), y: 150, tilt: 0, air: 0 };
  if (p < launch) return { ...onSpoon(lerp(-130, 80, span(p, up, launch)), TILT0), air: 0 };
  const tip = onSpoon(80, TILT0);
  const fall = 150 - tip.y - rise;
  if (p < land) {
    const t = span(p, launch, land);
    return {
      x: tip.x + reach * t,
      y: tip.y + rise * t + fall * t * t,
      tilt: lerp(-0.7, 0.2, t),
      air: t,
    };
  }
  return {
    x: tip.x + reach + 30000 * (p - land),
    y: 150 - hump(p, land, land + 0.003) * 5,
    tilt: 0,
    air: 0,
  };
}
function pipOnSpoon(p: number) {
  const tilt = spoonTilt(p),
    on = T.pipSpoon + 0.0035;
  if (p < on) return { x: lerp(70, 147.6, span(p, T.pipSpoon, on)), y: 150, tilt: 0 };
  if (p < T.touch) {
    const u = p < T.tip ? lerp(-130, 8, span(p, on, T.tip)) : 8 + 10 * span(p, T.tip, T.touch);
    return onSpoon(u, tilt);
  }
  if (p < T.drop) return onSpoon(lerp(18, 80, easeIn(span(p, T.touch, T.drop))), TILT1);
  const tip = onSpoon(80, TILT1);
  const t = span(p, T.drop, T.drop + 0.002);
  return {
    x: tip.x + 10 * t + 9000 * Math.max(0, p - T.drop - 0.002),
    y: t < 1 ? lerp(tip.y, 150, t * t) : 150 - hump(p, T.drop + 0.002, T.drop + 0.0035) * 4,
    tilt: t < 1 ? 0.4 * (1 - t) : 0,
  };
}
const SPOON_CAM = [
  [0.18, 150, 116, 1.35],
  [0.186, 262, 100, 1.25],
  [0.191, 360, 70, 1.2],
  [0.197, 450, 96, 1.25],
  [0.2015, 470, 112, 1.35],
  [0.2015, 150, 124, 1.75],
  [0.211, 250, 118, 1.7],
  [0.2165, 300, 122, 1.6],
  [0.226, 400, 128, 1.5],
] as const;
function spoonShot(ctx: Ctx, p: number, sec: number) {
  const view = track(p, SPOON_CAM);
  const reach = W / 2 / view.zoom + 30;
  const pipPart = p >= T.pipSpoon;
  camera(
    ctx,
    view,
    () => {
      cabinets(ctx, 96, -view.x * 0.4, view.x - reach, view.x + reach, -160);
      sideTiles(ctx, 96, view.x, view.x, view.x - reach, view.x + reach);
      matchbox(ctx, 420, 106, 120, 16, GREEN, 8);
      const flying = !pipPart && p > T.launch;
      ants(ctx, 428, 88, 15, 7.4, flying ? 1 : 0.3, sec, 23);
      sugarCube(ctx, 262, 150, 26);
      shade(ctx, 275, 150, 34);
      spoon(ctx, pipPart ? spoonTilt(p) : TILT0);
      if (!pipPart) {
        const j = jump(p, T.up + 0.003, T.launch2, T.land2, -120, 110);
        racer(
          ctx,
          j.x,
          j.y,
          'jewel',
          {
            s: 1,
            tilt: j.tilt + j.air * Math.sin(sec * 20) * 0.3,
            spin: p * 900,
            eyes: 'wide',
            mouth: 'o',
            arms: j.air > 0 ? [2.6, 2.8] : DRIVE,
            bends: j.air > 0 ? [0.2, 0.2] : DRIVE_BEND,
          },
          sec,
        );
        const b = jump(p, T.up, T.launch, T.land, -200, 150);
        const air = hump(p, T.launch, T.land);
        racer(
          ctx,
          b.x,
          b.y,
          'blitz',
          {
            s: 1.05,
            tilt: b.tilt,
            spin: p * 1200,
            rise: air * 0.9,
            arms: air > 0.2 ? [2.7, 2.5] : DRIVE,
            bends: air > 0.2 ? [0.5, 0.6] : DRIVE_BEND,
            flex: air > 0.2,
            mouth: air > 0.2 ? 'laugh' : 'grin',
          },
          sec,
        );
        glint(ctx, b.x + 8, b.y - 36, 6, hump(p, T.launch + 0.003, T.launch + 0.007));
        puff(ctx, b.x - 6, 150, span(p, T.land, T.land + 0.01), 8);
        puff(ctx, j.x - 6, 150, span(p, T.land2, T.land2 + 0.01), 7);
      } else {
        const q = pipOnSpoon(p);
        const scared = within(p, T.tip, T.touch + 0.001);
        const glee = p > T.drop;
        racer(
          ctx,
          q.x,
          q.y,
          'pip',
          {
            s: 1.05,
            tilt: q.tilt,
            spin: wheelTurn(p),
            squeak: squeakAt(p),
            arms: glee ? [2.6, 2.7] : DRIVE,
            bends: glee ? [0.3, 0.3] : DRIVE_BEND,
            goggles: 1,
            eyes: scared ? 'wide' : glee ? 'happy' : 'open',
            mouth: scared ? 'o' : glee ? 'grin' : 'smile',
            scarf: 0.4,
            bounce: hump(p, T.touch, T.touch + 0.002) * 3,
          },
          sec,
        );
        puff(ctx, q.x, 150, span(p, T.drop + 0.002, T.drop + 0.01), 6);
      }
    },
    null,
  );
  vignette(ctx, 0.38);
}

// ——— Shot 6: the sugar dunes ———
const dune = (x: number) => 150 - 8 * Math.sin(x * 0.021) - 5 * Math.sin(x * 0.047 + 1);
const farDune = (x: number) => dune(x + 40) - 18;
const X_DRIFT = 356;
const sugarScroll = (p: number) => braking(p, 0.226, 10000, 0.24, 0.25);
function dunes(ctx: Ctx, f: (x: number) => number, color: string) {
  const pts: number[] = [-30, H + 20];
  for (let x = -30; x <= W + 30; x += 20) pts.push(x, f(x));
  pts.push(W + 30, H + 20);
  poly(ctx, color, pts);
}
function sugarShot(ctx: Ctx, p: number, sec: number) {
  const scroll = sugarScroll(p);
  const moving = 1 - span(p, 0.24, 0.25);
  camera(
    ctx,
    track(p, [
      [0.226, 160, 96, 1.1],
      [0.246, 160, 100, 1.12],
      [0.2535, 148, 112, 1.7],
      [0.262, 146, 114, 1.8],
    ]),
    () => {
      cabinets(ctx, 84, scroll * 0.2);
      const bx = 60 - scroll * 0.25;
      oval(ctx, bx, 34, 124, 60, '#EDF1F3');
      oval(ctx, bx + 50, 40, 56, 44, '#DCE4E8');
      oval(ctx, bx, 46, 118, 7, '#5C86B8');
      for (let i = 0; i < 5; i++) disc(ctx, bx - 80 + i * 40, 46, 3, '#EDF1F3');
      dunes(
        ctx,
        (x) =>
          90 -
          10 * Math.sin((x + scroll * 0.45) * 0.017) -
          4 * Math.sin((x + scroll * 0.45) * 0.05),
        '#E3D3B4',
      );
      dunes(
        ctx,
        (x) =>
          110 -
          11 * Math.sin((x + scroll * 0.7) * 0.013 + 2) -
          4 * Math.sin((x + scroll * 0.7) * 0.041),
        '#EDE0C6',
      );
      dunes(ctx, (x) => farDune(x + scroll), '#F4EAD6');
      // #2, in the far lane, hits a crest and spins out into a drift.
      const spin = span(p, T.spin, T.plow);
      const jw = p < T.spin ? 140 + 10000 * (p - 0.226) : 260 + 96 * easeOut(spin);
      const sink = easeIn(span(p, T.plow - 0.001, T.plow + 0.002));
      const pop = backOut(span(p, T.popUp, T.popUp + 0.004));
      const dizzy = p > T.spin;
      if (!within(p, T.plow + 0.003, T.popUp))
        racer(
          ctx,
          jw - scroll,
          farDune(jw) + sink * 12 - hump(p, T.spin, T.spin + 0.004) * 8,
          'jewel',
          {
            s: 1.15,
            squash: Math.cos(easeOut(spin) * TAU * 1.75),
            tilt: -sink * 0.5,
            spin: sec * 25,
            rise: pop * 1.6,
            eyes: dizzy ? 'dizzy' : 'wide',
            mouth: dizzy ? (p > T.popUp ? 'wobble' : 'o') : 'wobble',
            arms: p > T.popUp ? [2.4, 2.6] : DRIVE,
            bends: p > T.popUp ? [0.6, 0.4] : DRIVE_BEND,
            sugar: p > T.plow,
            sweat: !dizzy,
          },
          sec,
        );
      const mx = X_DRIFT + 10 - scroll,
        my = farDune(X_DRIFT) + 6;
      const mound: number[] = [];
      for (let i = 0; i <= 8; i++)
        mound.push(mx - Math.cos((i / 8) * Math.PI) * 38, my - Math.sin((i / 8) * Math.PI) * 20);
      poly(ctx, SUGAR, mound);
      oval(ctx, mx + 10, my - 12, 12, 5, SUGAR_SHADE);
      if (within(p, T.plow + 0.003, T.popUp)) {
        // Buried: just two wheels and a pair of antennae, wiggling.
        const w = Math.sin(sec * 14) * 1.5;
        disc(ctx, mx - 8, my - 19 + w * 0.3, 4, TYRE);
        disc(ctx, mx - 8, my - 19 + w * 0.3, 2.6, BUGS.jewel.hub);
        disc(ctx, mx + 12, my - 18 - w * 0.3, 4, TYRE);
        disc(ctx, mx + 12, my - 18 - w * 0.3, 2.6, BUGS.jewel.hub);
        line(ctx, BUGS.jewel.limb, 1, [mx + 2, my - 19, mx + 4 + w, my - 30]);
        line(ctx, BUGS.jewel.limb, 1, [mx + 5, my - 19, mx + 9 - w, my - 28]);
      }
      for (let k = 0; k < 3; k++)
        puff(
          ctx,
          mx - 10 + k * 12,
          my - 10,
          span(p, T.plow + k * 0.001, T.plow + 0.012),
          9,
          '#FFFFFF',
        );
      puff(ctx, mx + 6, my - 26, span(p, T.popUp + 0.002, T.popUp + 0.008), 4, '#FFFFFF');
      dunes(ctx, (x) => dune(x + scroll), SUGAR);
      for (let i = 0; i < 14; i++) {
        const x = wrap(i * 53 - scroll, 700) - 30;
        if (Math.sin(sec * 4 + i * 1.9) > 0.3)
          glint(ctx, x, dune(x + scroll) + 5 + (i % 4) * 7, 2, 0.9);
      }
      // Blitz leaves a spray of sugar and a laugh.
      const bw = 200 + 11000 * (p - 0.226);
      const bxs = bw - scroll,
        by = dune(bw);
      for (let i = 0; i < 6; i++) {
        const t = wrap(sec * 3 + i * 0.17, 1);
        box(
          ctx,
          bxs - 16 - t * 34,
          by - 3 - Math.sin(t * Math.PI) * 10,
          2,
          2,
          alpha('#FFFFFF', 1 - t),
        );
      }
      racer(
        ctx,
        bxs,
        by,
        'blitz',
        {
          s: 1.35,
          tilt: Math.atan((dune(bw + 4) - dune(bw - 4)) / 8),
          spin: sec * 30,
          lean: 0.2,
          arms: DRIVE,
          bends: DRIVE_BEND,
          mouth: within(p, T.spin, T.plow + 0.004) ? 'laugh' : 'grin',
        },
        sec,
      );
    },
  );
  speedLines(ctx, sec, moving * 0.8, 20, 150);
  vignette(ctx, 0.3);
}

// ——— Shot 7: the pea chicane, from above ———
const PEAS = [
  [70, 60],
  [125, 120],
  [180, 58],
  [235, 122],
  [290, 62],
] as const;
const weaveY = (x: number) => 90 + 28 * Math.cos(((x - 70) / 55) * Math.PI);
function peaShot(ctx: Ctx, p: number, sec: number) {
  camera(
    ctx,
    track(p, [
      [0.262, 160, 90, 1.08],
      [0.294, 170, 92, 1.12],
    ]),
    () => {
      box(ctx, 0, 0, W, H, TILE[0]);
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 8; c++)
          if ((r + c) % 2) box(ctx, c * 48 - 8, r * 48 - 6, 48, 48, TILE[1]);
      for (let c = 0; c < 8; c++) box(ctx, c * 48 - 8, 0, 1, H, GROUT);
      for (let r = 0; r < 5; r++) box(ctx, 0, r * 48 - 6, W, 1, GROUT);
      poly(ctx, alpha(SUN, 0.2), [160, 0, 250, 0, 150, H, 60, H]);
      PEAS.forEach(([x, y], i) => {
        let px: number = x,
          py: number = y,
          roll = 0;
        if (i === 1) {
          const t = span(p, T.bonks[0], T.bonks[0] + 0.012);
          px += 30 * easeOut(t);
          py += 70 * easeOut(t);
          roll = t * 6;
        }
        if (i === 2) {
          const t = span(p, T.bonks[1], T.bonks[1] + 0.012);
          px += 24 * easeOut(t);
          py -= 70 * easeOut(t);
          roll = -t * 6;
        }
        pea(ctx, px, py, 11, roll);
      });
      // Blitz threads the chicane like a needle, leaving a thin skid line.
      const bt = span(p, T.weave, T.weave + 0.011);
      if (bt > 0 && bt < 1) {
        const trail: number[] = [];
        for (let k = 0; k < 10; k++) {
          const x = -30 + 380 * Math.max(0, bt - k * 0.025);
          trail.push(x, weaveY(x));
        }
        line(ctx, alpha(INK, 0.18), 2, trail);
        const x = -30 + 380 * bt;
        const slope = ((-28 * Math.PI) / 55) * Math.sin(((x - 70) / 55) * Math.PI);
        topRacer(ctx, x, weaveY(x), Math.atan(slope), 'blitz', sec);
      }
      // Pip takes the chicane a pea at a time.
      if (p > T.pipPeas) {
        const x = -30 + 16000 * (p - T.pipPeas);
        const b1 = span(p, T.bonks[0], T.bonks[0] + 0.004),
          b2 = span(p, T.bonks[1], T.bonks[1] + 0.004);
        const y = 98 - 20 * easeOut(b1) + 20 * easeOut(b2);
        const wobble =
          hump(p, T.bonks[0], T.bonks[0] + 0.004) * -0.7 +
          hump(p, T.bonks[1], T.bonks[1] + 0.004) * 0.7;
        topRacer(ctx, x, y, wobble, 'pip', sec);
        const sq = squeakAt(p);
        if (sq > 0.05) {
          line(ctx, alpha(INK, sq * 0.7), 0.8, [x - 18, y - 12, x - 22, y - 16]);
          line(ctx, alpha(INK, sq * 0.7), 0.8, [x - 20, y - 8, x - 25, y - 9]);
        }
        T.bonks.forEach((b, i) => {
          const t = span(p, b, b + 0.005);
          if (t <= 0 || t >= 1) return;
          const [cx, cy] = [PEAS[i + 1][0] - 7, PEAS[i + 1][1] + (i ? 12 : -12)];
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * TAU;
            line(ctx, alpha('#FFFFFF', 1 - t), 1, [
              cx + Math.cos(a) * (3 + t * 6),
              cy + Math.sin(a) * (3 + t * 6),
              cx + Math.cos(a) * (6 + t * 9),
              cy + Math.sin(a) * (6 + t * 9),
            ]);
          }
        });
      }
    },
  );
  vignette(ctx, 0.35);
}

// ——— Shot 8: Pip, far behind and perfectly happy ———
function pipAlone(ctx: Ctx, p: number, sec: number) {
  const scroll = 6000 * (p - 0.294);
  camera(
    ctx,
    track(p, [
      [0.294, 160, 104, 1],
      [0.325, 168, 110, 1.12],
    ]),
    () => {
      cabinets(ctx, 92, scroll * 0.3);
      const fx = 300 - scroll * 0.3;
      box(ctx, fx, -20, 180, 100, FRIDGE);
      box(ctx, fx, 80, 180, 12, GAP);
      sideTiles(ctx, 92, scroll);
      poly(ctx, alpha(SUN, 0.14), [0, 92, 120, 92, 60, H, -80, H]);
      // A ladybird on a crumb waves a tiny flag as he passes.
      const lx = 300 - scroll;
      ctx.save();
      ctx.translate(0, -12);
      oval(ctx, lx, 146, 12, 6, '#C99A5E');
      oval(ctx, lx - 3, 143, 6, 3, '#DDB37A');
      oval(ctx, lx + 2, 136, 6, 5, '#D2402F');
      box(ctx, lx + 2, 131, 1, 10, '#2A1E1A');
      disc(ctx, lx - 1, 135, 1.3, INK);
      disc(ctx, lx + 5, 137, 1.2, INK);
      disc(ctx, lx + 8, 135, 3, INK);
      disc(ctx, lx + 9, 134, 1, '#FFFFFF');
      const fl = Math.sin(sec * 10) * 2;
      line(ctx, MATCH, 1, [lx + 10, 136, lx + 12, 124]);
      box(ctx, lx + 12, 124 + fl * 0.3, 3, 3, INK);
      box(ctx, lx + 15, 124 + fl * 0.6, 3, 3, '#FFFFFF');
      box(ctx, lx + 12, 127 + fl * 0.3, 3, 3, '#FFFFFF');
      box(ctx, lx + 15, 127 + fl * 0.6, 3, 3, INK);
      ctx.restore();
      // Pip hums along to his own squeak: one note a beat.
      const x = 150,
        y = 166,
        s = 2.4;
      const waving = hump(p, T.wave, T.wave + 0.012);
      shade(ctx, x, y, 64);
      racer(
        ctx,
        x,
        y,
        'pip',
        {
          s,
          spin: wheelTurn(p),
          squeak: squeakAt(p),
          arms: waving > 0.1 ? [DRIVE[0], 2.6 + Math.sin(sec * 14) * 0.3] : DRIVE,
          bends: waving > 0.1 ? [DRIVE_BEND[0], 0.4] : DRIVE_BEND,
          goggles: 1,
          eyes: 'happy',
          mouth: squeakAt(p) > 0.4 ? 'o' : 'smile',
          look: waving > 0.1 ? [0.6, 0.8] : [0.5, 0],
          scarf: 0.55,
          bounce: squeakAt(p) * 0.5,
        },
        sec,
      );
      const k0 = Math.floor(p / SQUEAK);
      for (let k = k0 - 3; k <= k0; k++) {
        const t = span(p, k * SQUEAK, k * SQUEAK + SQUEAK * 3.5);
        if (k * SQUEAK < 0.296 || t <= 0 || t >= 1) continue;
        faded(ctx, 1 - ease((t - 0.6) / 0.4), () =>
          quaver(ctx, x + 6 - t * 26 + Math.sin(t * 8) * 3, y - 96 - t * 30, k % 2 ? GOLD : CREAM),
        );
      }
    },
  );
  vignette(ctx, 0.35);
}

// ——— Shot 9: the fridge ———
const FX = 196;
function fridgeShot(ctx: Ctx, p: number, sec: number) {
  camera(
    ctx,
    track(p, [
      [0.325, 116, 126, 2.1],
      [0.334, 150, 124, 2.3],
      [0.341, 156, 122, 2.8],
      [0.3475, 158, 122, 2.8],
      [0.355, 196, 116, 1.4],
      [0.372, 210, 110, 1.3],
    ]),
    () => {
      cabinets(ctx, 88, 60);
      sideTiles(ctx, 88, 0);
      // The official route: a dotted line of breadcrumbs, the long way round.
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        box(ctx, 176 + t * 60 + t * t * 20, 152 + t * t * 34, 3 + t * 2, 2 + t, '#C99A5E');
      }
      box(ctx, FX, -20, 140, 120, FRIDGE);
      box(ctx, FX, -20, 3, 120, '#FFFFFF');
      box(ctx, FX + 120, -20, 20, 120, FRIDGE_SHADE);
      box(ctx, FX + 4, 100, 132, 8, '#A9B2B8');
      for (let i = 0; i < 15; i++) box(ctx, FX + 8 + i * 8, 103, 5, 2, '#7F8990');
      box(ctx, FX, 108, 140, 46, GAP);
      oval(ctx, FX + 40, 146, 9, 5, '#4A4550');
      oval(ctx, FX + 86, 148, 11, 6, '#4A4550');
      disc(ctx, FX + 64, 146, 5, '#5E4A6A');
      box(ctx, FX + 106, 140, 12, 10, '#6A5A3A');
      box(ctx, FX + 4, 108, 5, 46, '#57525E');
      box(ctx, FX + 130, 108, 5, 46, '#57525E');
      // The sign points the long way round.
      box(ctx, 181, 116, 2, 36, MATCH);
      box(ctx, 172, 104, 20, 13, CREAM);
      poly(ctx, INK, [176, 108, 184, 108, 184, 106, 188, 110.5, 184, 115, 184, 112, 176, 112]);
      box(ctx, 183, 98, 3, 3, INK);
      box(ctx, 186, 98, 3, 3, '#FFFFFF');
      // Blitz stops, peeks over his sunglasses, and takes the other way.
      const arrive = easeOut(span(p, 0.325, T.arrive));
      const dash = easeIn(span(p, T.dash, T.dash + 0.012));
      const x = lerp(-40, 150, arrive) + dash * 260;
      const peek = Math.min(span(p, T.peek, T.peek + 0.002), 1 - span(p, 0.3455, 0.3475));
      const look: readonly [number, number] =
        p < 0.339 ? [0.7, 0.8] : p < T.smirk ? [1, 0.1] : [0.3, 0];
      const rev = hump(p, 0.3475, T.dash + 0.001);
      shade(ctx, x, 152, 32);
      racer(
        ctx,
        x,
        152,
        'blitz',
        {
          s: 1.05,
          spin: p * 800,
          glasses: 1 - peek * 0.65,
          look,
          mouth: p > T.smirk ? 'smirk' : 'flat',
          arms: DRIVE,
          bends: DRIVE_BEND,
          lean: dash > 0 ? 0.5 : 0,
          shake: rev * Math.sin(sec * 80) * 0.5,
        },
        sec,
      );
      box(ctx, FX + 1, 108, 139, 46, alpha(GAP, 0.8));
      if (x > FX - 6 && x < FX + 150) {
        glint(ctx, x + 9, 122, 4, 0.9);
        for (let k = 0; k < 3; k++)
          puff(
            ctx,
            FX + 30 + k * 40,
            150,
            span(p, T.dash + 0.007 + k * 0.0015, T.dash + 0.016 + k * 0.0015),
            6,
            '#6E6878',
          );
      }
    },
  );
  vignette(ctx, 0.4);
}

// ——— Shots 10 and 16: the finish, wide ———
const U_FINISH = 36;
function finishWide(ctx: Ctx, sec: number, cheer: number, flag: number, tape: number) {
  cabinets(ctx, WALL0, 50);
  fridgeFront(ctx, -4, 70, WALL0);
  poly(ctx, alpha(SUN, 0.12), [170, -20, 250, -20, 320, WALL0, 230, WALL0]);
  tiles(ctx, WALL0);
  matchbox(ctx, 252, WALL0 + 8, 74, 18, RED, 8);
  ants(ctx, 258, WALL0 - 12, 9, 7.6, cheer, sec, 21, 0.9);
  // The chequered strip on the floor.
  for (let r = 0; r < 12; r++) {
    const ya = lerp(92, 180, r / 12),
      yb = lerp(92, 180, (r + 1) / 12);
    for (let c = 0; c < 2; c++) {
      const ua = U_FINISH - 3 + c * 3,
        ub = ua + 3;
      poly(ctx, (r + c) % 2 ? INK : '#FFFFFF', [
        seamX(ua, ya),
        ya,
        seamX(ub, ya),
        ya,
        seamX(ub, yb),
        yb,
        seamX(ua, yb),
        yb,
      ]);
    }
  }
  // Posts and the banner above the line.
  const fy = 94,
    ny = 168;
  const far = { x: seamX(U_FINISH, fy), h: 44 * depthAt(fy), w: 3 * depthAt(fy) };
  const near = { x: seamX(U_FINISH, ny), h: 44 * depthAt(ny), w: 3 * depthAt(ny) };
  box(ctx, far.x - far.w / 2, fy - far.h, far.w, far.h, MATCH);
  thimble(ctx, far.x + 18, fy + 2, 13, 15);
  cricket(
    ctx,
    far.x + 18,
    fy - 13,
    0.5,
    {
      flag: flag > 0 ? 2.6 + Math.sin(sec * 12) * 0.5 : 2.2,
      wave: flag,
      hop: flag * Math.abs(Math.sin(sec * 8)) * 3,
      eyes: flag > 0 ? 'happy' : 'open',
    },
    sec,
  );
  // The finish tape, low across the lanes; it snaps when someone breaks it.
  const tapeAt = (t: number) => ({ x: lerp(far.x, near.x, t), y: lerp(fy - 5, ny - 10, t) });
  if (tape <= 0) {
    const a = tapeAt(0),
      b = tapeAt(1);
    line(ctx, RED, 1.5, [a.x, a.y, b.x, b.y]);
  } else {
    const mid = tapeAt(0.45);
    const a = tapeAt(0),
      b = tapeAt(1);
    const fall = easeOut(tape);
    line(ctx, RED, 1.5, [a.x, a.y, lerp(mid.x, a.x + 6, fall), lerp(mid.y, a.y + 14, fall)]);
    line(ctx, RED, 1.5, [b.x, b.y, lerp(mid.x, b.x - 8, fall), lerp(mid.y, b.y + 26, fall)]);
  }
  for (let c = 0; c < 8; c++)
    for (let r = 0; r < 2; r++) {
      const t0 = c / 8,
        t1 = (c + 1) / 8;
      const top = (t: number) => lerp(fy - far.h, ny - near.h, t);
      const tall = (t: number) => lerp(9 * depthAt(fy), 9 * depthAt(ny), t);
      const xa = lerp(far.x, near.x, t0),
        xb = lerp(far.x, near.x, t1);
      const ya = top(t0) + (tall(t0) * r) / 2,
        yb = top(t1) + (tall(t1) * r) / 2;
      poly(ctx, (r + c) % 2 ? INK : '#FFFFFF', [
        xa,
        ya,
        xb,
        yb,
        xb,
        yb + tall(t1) / 2,
        xa,
        ya + tall(t0) / 2,
      ]);
    }
  box(ctx, near.x - near.w / 2, ny - near.h, near.w, near.h, MATCH);
  oval(ctx, near.x, ny - near.h, near.w * 0.9, near.w * 0.7, RED);
  // The near grandstand.
  matchbox(ctx, 268, 196, 70, 28, BLUE, 10);
  ants(ctx, 276, 166, 7, 9, cheer, sec, 31, 1.2);
  glow(ctx, 300, 0, 180, SUN, 0.22);
}
function popOutShot(ctx: Ctx, p: number, sec: number) {
  camera(
    ctx,
    track(p, [
      [0.372, 150, 96, 1.15],
      [0.39, 176, 104, 1.25],
      [0.405, 192, 112, 1.42],
    ]),
    () => {
      finishWide(ctx, sec, p > T.skid ? 0.15 : 0.6, 0, 0);
      for (let k = 0; k < 3; k++)
        puff(
          ctx,
          30 + k * 10,
          84,
          span(p, T.popOut + k * 0.0015, T.popOut + 0.012 + k * 0.0015),
          6,
          '#9A958E',
        );
      const t = span(p, T.popOut, T.skid + 0.004);
      const y = lerp(86, 132, Math.sqrt(t)),
        x = lerp(30, 207, easeOut(t));
      const s = carScale(y);
      if (p > T.skid - 0.004) {
        const a = Math.min(1, span(p, T.skid - 0.004, T.skid + 0.004));
        const skid: number[] = [];
        for (let k = 0; k <= 6; k++) {
          const u = lerp(Math.max(0, t - 0.25 * a), t, k / 6);
          skid.push(lerp(30, 207, easeOut(u)), lerp(86, 132, Math.sqrt(u)) + 1);
        }
        line(ctx, alpha(INK, 0.3), 2, skid);
      }
      puff(ctx, x - 10, y, span(p, T.skid, T.skid + 0.01), 7);
      const laughing = p > T.laugh;
      shade(ctx, x, y, 30 * s);
      racer(
        ctx,
        x,
        y,
        'blitz',
        {
          s,
          tilt: hump(p, T.skid - 0.002, T.skid + 0.005) * -0.12,
          spin: t < 1 ? p * 900 : 0,
          rise: laughing ? 0.9 + Math.abs(Math.sin(sec * 9)) * 0.1 : 0,
          back: laughing,
          arms: laughing ? [0.7, 2.2] : DRIVE,
          bends: laughing ? [-1.5, 0.3] : DRIVE_BEND,
          mouth: laughing ? 'laugh' : 'grin',
          bunny: true,
        },
        sec,
      );
    },
  );
  vignette(ctx, 0.38);
}

// ——— Shot 11: Blitz lounges at the line; a shadow falls ———
function finishSide(ctx: Ctx, sec: number, cheer: number) {
  cabinets(ctx, 70, 120);
  sideTiles(ctx, 70, 0);
  matchbox(ctx, 214, 102, 140, 18, RED, 8);
  ants(ctx, 220, 82, 17, 7.6, cheer, sec, 41);
  for (let i = 0; i < 12; i++) {
    const y = 104 + i * 7;
    const x = 258 + (y - 70) * 0.18;
    box(ctx, x, y, 5, 7, i % 2 ? INK : '#FFFFFF');
    box(ctx, x + 5, y, 5, 7, i % 2 ? '#FFFFFF' : INK);
  }
  thimble(ctx, 294, 108, 20, 22);
}
const stompShake = (p: number, sec: number) =>
  T.stomps.reduce((a, st) => a + (p >= st ? 1 - span(p, st, st + 0.008) : 0), 0) *
  Math.sin(sec * 70) *
  2.2;
function loungeShot(ctx: Ctx, p: number, sec: number) {
  const view = track(p, [
    [0.405, 196, 118, 2.3],
    [0.428, 190, 118, 2.2],
    [0.442, 162, 116, 1.75],
    [0.452, 168, 116, 1.75],
    [0.46, 196, 114, 2.5],
    [0.478, 196, 112, 2.8],
  ]);
  const shake = stompShake(p, sec);
  const shadow = ease(span(p, T.shadow, T.shadow + 0.015));
  camera(ctx, { ...view, y: view.y + shake }, () => {
    finishSide(ctx, sec, p > T.shadow ? 0 : 0.5);
    cricket(
      ctx,
      294,
      86,
      0.9,
      { flag: p > T.look ? 0.6 : 2.2, eyes: p > T.look ? 'wide' : 'open', look: [-0.3, -1] },
      sec,
    );
    // #2 limps in, still sugared.
    if (p > T.jewelIn) {
      const jx = lerp(-40, 118, easeOut(span(p, T.jewelIn, T.jewelIn + 0.012)));
      const scared = p > T.shadow + 0.006;
      shade(ctx, jx, 146, 30);
      racer(
        ctx,
        jx,
        146,
        'jewel',
        {
          s: 0.98,
          spin: p * 600,
          sugar: true,
          eyes: scared ? 'wide' : 'dizzy',
          mouth: scared ? 'wobble' : 'flat',
          look: [0.2, -1],
          sweat: scared,
          arms: scared ? [2.2, 2.4] : DRIVE,
          bends: scared ? [1.2, 1.2] : DRIVE_BEND,
          shake: scared ? Math.sin(sec * 70) * 0.5 : 0,
        },
        sec,
      );
    }
    // Blitz lounges, laughing, until the light goes.
    const worried = p > 0.455;
    const peek = span(p, T.look, T.look + 0.003);
    const off = p > T.glassesOff;
    shade(ctx, 214, 152, 34);
    racer(
      ctx,
      214,
      152,
      'blitz',
      {
        s: 1.05,
        lean: worried ? -0.1 : -0.38,
        arms: worried ? (p > T.gulp ? [1.2, 1.3] : DRIVE) : [2.9, 2.8],
        bends: worried ? DRIVE_BEND : [1.9, 1.8],
        glasses: off ? -1 : 1 - peek * 0.7,
        look: [0.2, -1],
        eyes: worried ? 'wide' : 'open',
        mouth: worried ? (p > T.gulp ? 'wobble' : 'o') : 'laugh',
        bunny: true,
        sweat: p > T.gulp,
        bounce: worried ? 0 : Math.abs(Math.sin(sec * 9)) * 0.4,
      },
      sec,
    );
    if (off) {
      const t = span(p, T.glassesOff, T.glassesOff + 0.005);
      const gx = 222 + t * 10,
        gy = lerp(121, 154, t * t);
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(t * 3.5);
      poly(ctx, INK, [-4, -1, 4, -1.5, 3.6, 1.5, 0.5, 1, -0.5, 1.6, -3.6, 1.2]);
      ctx.restore();
    }
    // The shadow slides across the floor from the left.
    const edge = lerp(-80, 420, shadow);
    poly(ctx, alpha(DUSK, 0.5), [-40, -40, edge + 30, -40, edge - 30, H + 40, -40, H + 40]);
    poly(ctx, alpha(DUSK, 0.18), [edge + 30, -40, edge + 60, -40, edge, H + 40, edge - 30, H + 40]);
  });
  for (let i = 0; i < 10; i++) {
    const t = span(p, T.stomps[1] + i * 0.0006, T.stomps[1] + 0.012 + i * 0.0006);
    if (t > 0 && t < 1) box(ctx, 20 + rand(i * 9.1) * 280, t * 180, 1, 2, alpha('#C9BFA8', 1 - t));
  }
  vignette(ctx, 0.45 + shadow * 0.2);
}

// ——— Shot 12: the giant ———
function giantShot(ctx: Ctx, p: number, sec: number) {
  const view = track(p, [
    [0.478, 160, 84, 1.05],
    [0.49, 168, 88, 1.05],
    [0.502, 186, 104, 1.12],
    [0.515, 196, 108, 1.18],
  ]);
  const slap = span(p, T.slap, T.slap + 0.006);
  const shake =
    stompShake(p, sec) + (slap > 0 && slap < 1 ? Math.sin(sec * 60) * 2 * (1 - slap) : 0);
  camera(ctx, { ...view, y: view.y + shake }, () => {
    cabinets(ctx, 124, 60, -30, W + 30, -60);
    tiles(ctx, 124, 100);
    slipper(ctx, 88, 162, 1);
    const down = easeIn(span(p, T.stomps[2] - 0.008, T.stomps[2]));
    slipper(ctx, 190, 152 - (1 - down) * 170, 0.9);
    for (let k = 0; k < 3; k++) {
      puff(ctx, 150 + k * 20, 152, span(p, T.stomps[2], T.stomps[2] + 0.012), 9, '#B8AE9A');
      puff(ctx, 230 - k * 12, 154, span(p, T.stomps[2] + 0.001, T.stomps[2] + 0.013), 8, '#B8AE9A');
    }
    // Two tiny racers, looking up.
    for (const [x, who] of [
      [282, 'jewel'],
      [304, 'blitz'],
    ] as const)
      racer(
        ctx,
        x,
        172,
        who,
        {
          s: 0.5,
          eyes: 'wide',
          mouth: 'o',
          look: [0, -1],
          arms: [2.4, 2.6],
          bends: [0.4, 0.4],
          glasses: -1,
          shake: Math.sin(sec * 60) * 0.5,
        },
        sec,
      );
    // The mop comes down.
    const m = easeIn(span(p, T.mopDown, T.slap));
    const my = lerp(-90, 158, m);
    if (slap > 0) {
      oval(ctx, 206, 160, 30 + easeOut(slap) * 80, 6 + easeOut(slap) * 10, alpha(SOAP, 0.7));
      oval(ctx, 206, 158, 20 + easeOut(slap) * 60, 3 + easeOut(slap) * 6, alpha(FOAM, 0.5));
    }
    line(ctx, WOOD_LIGHT, 8, [340, -120, 218, my - 72]);
    mopFront(ctx, 206, my, easeOut(slap) * 0.7, sec);
    if (slap > 0 && slap < 1)
      for (let i = 0; i < 14; i++) {
        const a = Math.PI + (i / 13) * Math.PI;
        const r = 20 + easeOut(slap) * 70;
        disc(
          ctx,
          206 + Math.cos(a) * r * 1.4,
          150 + Math.sin(a) * r * 0.8 + slap * slap * 40,
          2,
          alpha(FOAM, 1 - slap),
        );
      }
    bubbles(ctx, sec, {
      count: 10,
      seed: 51,
      left: 180,
      right: 330,
      top: 60,
      bottom: 160,
      amount: slap,
    });
  });
  veil(ctx, DUSK, 0.32);
  vignette(ctx, 0.55);
}

// ——— Shot 13: the sweep ———
function sweepShot(ctx: Ctx, p: number, sec: number) {
  const view = track(p, [
    [0.515, 170, 112, 1.35],
    [0.55, 190, 100, 1.2],
  ]);
  const hit = Math.max(...T.scoop.map((s) => (p >= s ? 1 - span(p, s, s + 0.006) : 0)));
  camera(ctx, { ...view, y: view.y + Math.sin(sec * 60) * 1.6 * hit }, () => {
    cabinets(ctx, 96, 30);
    sideTiles(ctx, 96, 0);
    const mx = lerp(-120, 460, ease(span(p, T.sweep, 0.546)));
    const lift = easeIn(span(p, T.lift, 0.548));
    const my = 154 - lift * 200;
    box(ctx, -20, 140, mx + 20, 30, alpha(SOAP, 0.35));
    for (let i = 0; i < 4; i++)
      box(ctx, mx - 60 - i * 70, 150 + (i % 2) * 8, 40, 1, alpha(FOAM, 0.6));
    // The racers cower, get scooped into the strings, and spin away with them.
    const riders = [
      { who: 'jewel' as const, x: 160, y: 148, s: 1, at: T.scoop[0] },
      { who: 'blitz' as const, x: 226, y: 154, s: 1.08, at: T.scoop[1] },
    ];
    for (const r of riders) {
      if (p >= r.at) continue;
      shade(ctx, r.x, r.y, 30 * r.s);
      racer(
        ctx,
        r.x,
        r.y,
        r.who,
        {
          s: r.s,
          eyes: 'wide',
          mouth: r.who === 'blitz' ? 'o' : 'wobble',
          look: [-1, 0],
          arms: [2.3, 2.5],
          bends: [1.3, 1.2],
          glasses: -1,
          bunny: r.who === 'blitz',
          sweat: true,
          shake: Math.sin(sec * 70) * 0.6,
        },
        sec,
      );
    }
    mopSide(ctx, mx, my, sec);
    for (const [i, r] of riders.entries()) {
      if (p < r.at) continue;
      const t = p - r.at;
      const x = mx - 20 - i * 14,
        y = my - 34 + i * 8;
      racer(
        ctx,
        x,
        y,
        r.who,
        {
          s: r.s,
          tilt: t * 900 + i,
          eyes: r.who === 'blitz' ? 'wide' : 'dizzy',
          mouth: 'o',
          arms: [2.8, 2.2 + Math.sin(sec * 20) * 0.5],
          bends: [0.2, 0.2],
          glasses: -1,
          bunny: r.who === 'blitz',
        },
        sec,
      );
      line(ctx, MOP, 4, [x - 20, y - 20, x - 4, y - 6, x + 16, y - 14]);
      line(ctx, MOP_DARK, 3, [x - 10, y + 8, x + 4, y - 4, x + 20, y + 6]);
    }
    for (let i = 0; i < 12; i++) {
      const t = wrap(sec * 1.7 + i * 0.083, 1);
      disc(
        ctx,
        mx - 30 + t * 60 + i * 3,
        my - 50 - Math.sin(t * Math.PI) * 30,
        1.6,
        alpha(FOAM, 1 - t),
      );
    }
    bubbles(ctx, sec, {
      count: 12,
      seed: 61,
      left: 0,
      right: W,
      top: 60,
      bottom: 160,
      amount: span(p, T.sweep, T.sweep + 0.01),
    });
  });
  veil(ctx, DUSK, 0.28);
  vignette(ctx, 0.5);
}

// ——— Shot 14: Pip sees the wave ———
function waveFront(p: number) {
  return glide(p, [
    [T.hear, -30],
    [0.566, 34],
    [0.577, 62],
    [T.ride, 150],
    [0.606, 170],
  ]);
}
function waveShot(ctx: Ctx, p: number, sec: number) {
  const view = track(p, [
    [0.55, 160, 120, 1.7],
    [0.558, 172, 122, 1.7],
    [0.562, 124, 114, 1.25],
    [0.568, 124, 114, 1.25],
    [0.574, 168, 110, 2.9],
    [0.583, 168, 110, 2.9],
    [0.589, 156, 106, 1.6],
    [0.605, 140, 100, 1.35],
  ]);
  const scroll = Math.min(p, T.hear) * 3000 - 0.55 * 3000;
  camera(ctx, view, () => {
    cabinets(ctx, 92, scroll * 0.3);
    sideTiles(ctx, 92, scroll);
    const px = 150 + scroll;
    const front = waveFront(p);
    const crest = lerp(18, 46, span(p, T.hear, T.ride));
    const turned = within(p, T.turn, T.flip);
    const flip = span(p, T.flip, T.board);
    // Before the flip: in the car. During: the cap spins up and lands upside down.
    if (p < T.flip) {
      shade(ctx, px, 156, 42);
      racer(
        ctx,
        px,
        156,
        'pip',
        {
          s: 1.5,
          spin: p < T.hear ? wheelTurn(p) : 0,
          squeak: p < T.hear ? squeakAt(p) : 0,
          back: turned,
          arms: p > T.grin ? [0.4, 2.8] : DRIVE,
          bends: p > T.grin ? [0.3, 0.6] : DRIVE_BEND,
          goggles: span(p, T.goggles, T.goggles + 0.003),
          eyes: p < T.seeWave ? 'happy' : p < T.grin ? 'wide' : 'squint',
          mouth: p < T.seeWave ? 'smile' : p < T.grin ? 'o' : 'grin',
          look: [0.6, -0.2],
          scarf: p < T.hear ? 0.4 : 0.15,
        },
        sec,
      );
    } else {
      const b = { x: px, y: 156 - Math.sin(flip * Math.PI) * 26 };
      ctx.save();
      ctx.translate(b.x, b.y - 8 * 1.5);
      ctx.rotate(flip * Math.PI);
      ctx.scale(1.5, 1.5);
      ctx.translate(0, 8);
      capBody(ctx, 'pip', 1, false);
      ctx.restore();
      for (let i = 0; i < 2; i++) {
        const t = span(p, T.flip, T.flip + 0.02);
        disc(
          ctx,
          px - 12 + i * 24 + t * (i ? 40 : -30),
          150 + t * 6 - Math.sin(t * Math.PI) * 6,
          5.4,
          TYRE,
        );
      }
      const land = p > T.board;
      bug(
        ctx,
        px,
        land ? 142 : 156 - Math.sin(Math.min(1, flip * 1.2) * Math.PI) * 34,
        'pip',
        {
          s: 1.5,
          knees: land ? 0.6 : 0.3,
          stride: land ? 4 : 2.4,
          arms: [1.9, 1.3],
          bends: [-0.3, 0.2],
          goggles: 1,
          back: !land,
          eyes: 'squint',
          mouth: 'grin',
          scarf: 0.7,
        },
        sec,
      );
    }
    soapWave(ctx, front, 160, crest, sec);
    bubbles(ctx, sec, {
      count: 8,
      seed: 71,
      left: -40,
      right: front,
      top: 60,
      bottom: 150,
      amount: span(p, T.hear, T.hear + 0.01),
    });
  });
  veil(ctx, DUSK, 0.28 * (1 - span(p, 0.58, 0.605)));
  vignette(ctx, 0.42);
}

// ——— Shot 15: surf's up ———
const surface = (x: number, peak: number, sec: number) =>
  124 - 30 * Math.exp(-(((x - peak) / 44) ** 2)) + Math.sin(x * 0.05 + sec * 2) * 1.5;
function surfShot(ctx: Ctx, p: number, sec: number) {
  const scroll = 9000 * (p - 0.605);
  const view = track(p, [
    [0.605, 160, 96, 1.08],
    [0.628, 166, 98, 1.15],
    [0.645, 172, 88, 2.25],
    [0.668, 172, 86, 2.35],
    [0.684, 166, 96, 1.15],
    [0.705, 176, 96, 1.08],
  ]);
  camera(ctx, view, () => {
    cabinets(ctx, 100, scroll * 0.3);
    glow(ctx, 300, 0, 200, SUN, 0.32);
    // Kitchen landmarks drift past, half under water.
    const layer = (x: number) => x - scroll * 0.55;
    tableLeg(ctx, layer(260), -20, 118, 22);
    sugarBowl(ctx, layer(470), 118, 30);
    tableLeg(ctx, layer(690), -20, 118, 16, WOOD_DARK);
    box(ctx, -20, 100, W + 40, 24, mix(TILE[0], SOAP, 0.5));
    // The water, and the swell Pip rides.
    const px = 172 + Math.sin(sec * 1.3) * 6,
      peak = px - 34;
    const pts: number[] = [-30, H + 30];
    for (let x = -30; x <= W + 30; x += 10) pts.push(x, surface(x, peak, sec));
    pts.push(W + 30, H + 30);
    poly(ctx, SOAP, pts);
    for (let i = 0; i < 6; i++) {
      const x = wrap(i * 70 - scroll * 1.2, 420) - 50;
      box(ctx, x, 140 + (i % 3) * 12, 26, 1, alpha(FOAM, 0.6));
    }
    box(ctx, -20, 160, W + 40, 30, alpha(SOAP_DEEP, 0.45));
    // Things bob by: Blitz's lost sunglasses, a pea, and a matchbox raft of ants.
    const bob = (x: number) => surface(x, peak, sec) - 2 + Math.sin(sec * 3 + x) * 1.5;
    const gx = wrap(420 - scroll * 1.1, 900) - 60;
    poly(ctx, INK, [
      gx - 7,
      bob(gx) - 2,
      gx + 7,
      bob(gx) - 3,
      gx + 6,
      bob(gx) + 2,
      gx + 1,
      bob(gx) + 1,
      gx - 6,
      bob(gx) + 2,
    ]);
    pea(ctx, wrap(620 - scroll * 1.1, 900) - 60, bob(wrap(620 - scroll * 1.1, 900) - 60) - 4, 7);
    const rx = wrap(820 - scroll * 1.1, 900) - 60;
    matchbox(ctx, rx - 24, bob(rx) + 4, 48, 10, GREEN, 5);
    ants(ctx, rx - 18, bob(rx) - 7, 5, 8, 1, sec, 81);
    // Pip, standing on his upturned cap.
    const py = surface(px, peak, sec);
    const tilt = Math.atan((surface(px + 4, peak, sec) - surface(px - 4, peak, sec)) / 8);
    ctx.save();
    ctx.translate(px, py - 2);
    ctx.rotate(tilt);
    ctx.scale(1.6, -1.6);
    ctx.translate(0, 3.6);
    capBody(ctx, 'pip', 1, false);
    ctx.restore();
    const close = within(p, 0.64, 0.684);
    bug(
      ctx,
      px,
      py - 3,
      'pip',
      {
        s: 1.6,
        tilt,
        knees: 0.6 + Math.sin(sec * 3) * 0.15,
        stride: 4,
        arms: close ? [2.6, 2.9] : [1.9 + Math.sin(sec * 2) * 0.1, 1.2],
        bends: close ? [0.3, 0.2] : [-0.3, 0.3],
        goggles: 1,
        eyes: close ? 'happy' : 'squint',
        mouth: close ? 'laugh' : 'grin',
        scarf: 1,
      },
      sec,
    );
    // The curl breaks behind him.
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      disc(
        ctx,
        peak - 20 + t * 30 + Math.sin(sec * 7 + i) * 2,
        surface(peak - 20 + t * 30, peak, sec) - 2 + t * t * 6,
        5 - t * 2,
        FOAM,
      );
    }
    for (let i = 0; i < 10; i++) {
      const t = wrap(sec * 1.2 + i * 0.1, 1);
      box(
        ctx,
        peak - 30 + t * 20 - i * 3,
        surface(peak, peak, sec) - 6 - Math.sin(t * Math.PI) * 18,
        2,
        2,
        alpha(FOAM, 1 - t),
      );
    }
    bubbles(ctx, sec, {
      count: 18,
      seed: 91,
      left: -20,
      right: W + 20,
      top: 20,
      bottom: 170,
      rise: 22,
    });
  });
  vignette(ctx, 0.3);
}

// ——— Shot 16: through the line ———
function crashShot(ctx: Ctx, p: number, sec: number) {
  const hit = span(p, T.finish, T.finish + 0.008);
  const view = track(p, [
    [0.705, 150, 100, 1.1],
    [0.728, 205, 106, 1.35],
    [0.74, 226, 104, 1.75],
    [0.765, 244, 106, 1.6],
  ]);
  camera(
    ctx,
    { ...view, y: view.y + (hit > 0 && hit < 1 ? Math.sin(sec * 60) * 2 * (1 - hit) : 0) },
    () => {
      const cheer = p > T.finish ? 1 : 0.5;
      finishWide(ctx, sec, cheer, p > T.finish ? 1 : 0, hit);
      // The flood: a sheet of soapy water with a rolling crest.
      const px = glide(p, [
        [0.705, -60],
        [T.finish, 222],
        [0.745, 268],
        [0.765, 286],
      ]);
      const settle = span(p, 0.742, 0.765);
      const fX = (y: number) => px + 16 + (y - 128) * 0.55;
      poly(ctx, alpha(SOAP, 0.75), [-30, 90, fX(90), 90, fX(190), 190, -30, 190]);
      const crest = 18 * (1 - settle);
      for (let i = 0; i < 9; i++) {
        const y = 92 + i * 11;
        const d = depthAt(y);
        disc(ctx, fX(y) - 4 * d, y - crest * d * 0.35, (3 + crest * 0.15) * d, FOAM);
      }
      const ps = carScale(128) * 1.1;
      const py = 128 - crest * 0.5;
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(ps, -ps);
      ctx.translate(0, 3.6);
      capBody(ctx, 'pip', 1, false);
      ctx.restore();
      bug(
        ctx,
        px,
        py - 2,
        'pip',
        {
          s: ps,
          knees: 0.5,
          stride: 4,
          arms: p > T.finish ? [2.8, 2.9] : [1.9, 1.2],
          bends: [0.2, 0.2],
          goggles: 1,
          eyes: 'happy',
          mouth: 'laugh',
          scarf: 1 - settle * 0.6,
        },
        sec,
      );
      // A burst of bubbles as he breaks the tape.
      if (hit > 0)
        for (let i = 0; i < 22; i++) {
          const a = rand(i * 1.3) * TAU,
            r = (20 + rand(i * 2.9) * 50) * easeOut(span(p, T.finish, T.finish + 0.02));
          const t = span(p, T.finish, 0.765);
          bubble(
            ctx,
            222 + Math.cos(a) * r,
            112 + Math.sin(a) * r * 0.7 - t * 40,
            2 + rand(i * 4.4) * 3,
            1 - ease((t - 0.6) / 0.4),
          );
        }
      bubbles(ctx, sec, {
        count: 10,
        seed: 101,
        left: 0,
        right: 250,
        top: 40,
        bottom: 170,
        amount: span(p, 0.71, 0.72),
      });
    },
  );
  vignette(ctx, 0.35);
}

// ——— Shot 17: the flag and the crowd ———
function cheerShot(ctx: Ctx, p: number, sec: number) {
  camera(
    ctx,
    track(p, [
      [0.765, 96, 104, 1.9],
      [0.779, 100, 100, 1.9],
      [0.788, 226, 104, 1.6],
      [0.8, 232, 102, 1.6],
    ]),
    () => {
      cabinets(ctx, 84, 90);
      sideTiles(ctx, 84, 0);
      box(ctx, -20, 150, W + 40, 40, alpha(SOAP, 0.35));
      thimble(ctx, 96, 180, 30, 32);
      const whistle = within(p, T.whistle, T.whistle + 0.012);
      cricket(
        ctx,
        96,
        150,
        1.6,
        {
          flag: 2.3 + Math.sin(sec * 11) * 0.7,
          wave: 1,
          whistle,
          eyes: whistle ? 'wide' : 'happy',
          hop: Math.abs(Math.sin(sec * 7)) * 3,
        },
        sec,
      );
      matchbox(ctx, 160, 186, 170, 36, RED, 10);
      matchbox(ctx, 186, 150, 120, 24, BLUE, 8);
      ants(ctx, 168, 150, 9, 9, 1, sec, 111, 1.6);
      ants(ctx, 196, 124, 8, 13, 1, sec, 121, 1.6);
      // Three ants hold up a paper banner.
      const by = 84 + Math.sin(sec * 6) * 2;
      box(ctx, 206, by, 76, 16, CREAM);
      box(ctx, 206, by + 14, 76, 2, '#E3D2AE');
      write(ctx, 'GO PIP!', 244, by + 12, { size: 11, color: RED, type: 'serif' });
      for (let i = 0; i < 12; i++) {
        const t = wrap(sec * 0.6 + i * 0.083, 1);
        box(
          ctx,
          170 + rand(i * 3.3) * 140,
          40 + t * 120,
          2,
          2,
          [GOLD, RED, '#FFFFFF', BLUE][i % 4],
        );
      }
      bubbles(ctx, sec, { count: 14, seed: 131, top: 0, bottom: 170 });
    },
  );
  vignette(ctx, 0.35);
}

// ——— Shots 18 to 20: the podium ———
function podiumSet(ctx: Ctx, p: number, sec: number, cheer: number) {
  cabinets(ctx, 96, 40);
  glow(ctx, 250, 20, 220, SUN, 0.35);
  // The mop, leaning against the cabinets, its work done.
  line(ctx, WOOD_LIGHT, 5, [310, -30, 270, 90]);
  oval(ctx, 266, 96, 24, 10, MOP_DARK);
  for (let i = 0; i < 9; i++)
    line(ctx, i % 2 ? MOP : MOP_DARK, 3, [262 + i * 1.5, 88, 248 + i * 5, 100]);
  box(ctx, 258, 84, 18, 7, '#5E7F9A');
  tiles(ctx, 96, 40, ['#EDD6A6', '#DDBB84']);
  for (const [x, y, w] of [
    [60, 150, 60],
    [250, 160, 70],
    [140, 172, 90],
  ])
    oval(ctx, x, y, w / 2, 4, alpha(SOAP, 0.4));
  // Bunting made of sweet wrappers.
  const sag = (x: number) => 14 + Math.sin((x / W) * Math.PI) * 14;
  line(ctx, '#5B4A3E', 1, [0, 14, 80, sag(80), 160, sag(160), 240, sag(240), 320, 14]);
  for (let i = 0; i < 12; i++) {
    const x = 8 + i * 26,
      y = sag(x);
    poly(ctx, [RED, GOLD, BLUE, GREEN][i % 4], [
      x - 5,
      y,
      x + 5,
      y,
      x + Math.sin(sec * 3 + i) * 1.5,
      y + 10,
    ]);
  }
  matchbox(ctx, 2, 118, 58, 16, BLUE, 8);
  ants(ctx, 8, 101, 7, 7.6, cheer, sec, 141);
  matchbox(ctx, 252, 124, 64, 16, GREEN, 8);
  ants(ctx, 258, 107, 8, 7.6, cheer, sec, 151);
  line(ctx, MOP_DARK, 1.6, [118, 110, 140, 124, 180, 126, 200, 116]);
  matchbox(ctx, 88, 150, 48, 24, BLUE, 7, '2');
  matchbox(ctx, 136, 150, 46, 40, RED, 7, '1');
  matchbox(ctx, 182, 150, 46, 18, GREEN, 7, '3');
  // The trophy travels from the referee up to Pip.
  const climb = span(p, T.climb, T.climb + 0.007);
  const give = span(p, T.handUp, T.handUp + 0.008);
  const raised = p > T.raise;
  cricket(
    ctx,
    232,
    164,
    1.05,
    {
      flag: give < 1 ? lerp(1.2, 2.2, give) : 2.4 + Math.sin(sec * 10) * 0.5,
      wave: give >= 1 ? 1 : 0.2,
      eyes: 'happy',
    },
    sec,
  );
  const px = lerp(118, 159, climb),
    py = climb < 1 ? lerp(160, 108, climb) - Math.sin(climb * Math.PI) * 24 : 108;
  bug(
    ctx,
    px,
    py,
    'pip',
    {
      s: 1.2,
      arms: raised ? [3.02, 3.08 + Math.sin(sec * 4) * 0.05] : give > 0 ? [1.6, 2.2] : [0.5, 0.6],
      bends: raised ? [0, 0] : [-0.4, -0.4],
      hold: raised ? 'trophy' : undefined,
      goggles: 0,
      eyes: 'happy',
      mouth: raised ? 'laugh' : 'grin',
      wet: true,
      scarf: 0.15,
      knees: climb > 0 && climb < 1 ? 0.8 : 0,
    },
    sec,
  );
  if (!raised && p > T.handUp - 0.002)
    trophy(ctx, lerp(224, 172, give), lerp(132, 90, give) - Math.sin(give * Math.PI) * 10, 1.2);
  for (let i = 0; i < 3; i++)
    bubble(ctx, px - 6 + i * 5, py - 42 - i * 2 + Math.sin(sec * 2 + i), 1.6 + (i % 2), 1);
  glint(ctx, 160, 60, 8, raised ? hump(p, T.raise, T.raise + 0.008) : 0);
  // Blitz and #2, soggy and tied together by one mop string.
  const clap1 = p > T.clap1,
    clap2 = p > T.clap2;
  const c = Math.sin(sec * 26);
  bug(
    ctx,
    112,
    124,
    'blitz',
    {
      s: 1.05,
      arms: clap2 ? [1.3 + c * 0.25, 1.5 - c * 0.25] : [0.3, 0.3],
      bends: clap2 ? [0.6, 0.6] : [0.2, 0.2],
      glasses: 1,
      crooked: true,
      eyes: within(p, T.glance + 0.003, T.clap2) ? 'closed' : 'open',
      look: within(p, T.glance, T.clap2) ? [1, 0.2] : [0.4, 0],
      mouth: clap2 ? 'smile' : 'frown',
      wet: true,
      lean: clap2 ? 0 : 0.1,
    },
    sec,
  );
  bug(
    ctx,
    205,
    130,
    'jewel',
    {
      s: 1,
      facing: -1,
      arms: clap1 ? [1.3 + c * 0.25, 1.5 - c * 0.25] : [0.2, 0.3],
      bends: clap1 ? [0.6, 0.6] : [0.2, 0.2],
      eyes: clap1 ? 'happy' : 'open',
      mouth: clap1 ? 'grin' : 'wobble',
      wet: true,
      sugar: true,
    },
    sec,
  );
  line(ctx, MOP, 1.8, [103, 107, 112, 111, 121, 107]);
  line(ctx, MOP, 1.8, [197, 113, 205, 117, 213, 113]);
  line(ctx, MOP_DARK, 1.4, [120, 108, 126, 116, 122, 124]);
  const popT = span(p, T.pop - 0.012, T.pop);
  if (popT > 0 && popT < 1) bubble(ctx, 212, 100 - popT * 16, 2 + popT * 2, 1);
  if (p > T.pop && p < T.pop + 0.004) glint(ctx, 212, 84, 3, 1 - span(p, T.pop, T.pop + 0.004));
  bubbles(ctx, sec, {
    count: 20,
    seed: 161,
    left: 20,
    right: 300,
    top: -10,
    bottom: 150,
    rise: 12,
    amount: 0.9,
  });
}
function podiumShot(ctx: Ctx, p: number, sec: number) {
  camera(
    ctx,
    track(p, [
      [0.8, 150, 110, 1.45],
      [0.812, 160, 100, 1.7],
      [0.83, 160, 96, 1.9],
      [0.87, 160, 94, 2.0],
    ]),
    () => podiumSet(ctx, p, sec, p > T.raise ? 1 : 0.5),
  );
  vignette(ctx, 0.35);
}
function clapShot(ctx: Ctx, p: number, sec: number) {
  camera(
    ctx,
    track(p, [
      [0.87, 160, 112, 2.2],
      [0.915, 160, 110, 2.35],
    ]),
    () => podiumSet(ctx, p, sec, 1),
  );
  vignette(ctx, 0.35);
}
function finaleShot(ctx: Ctx, p: number, sec: number) {
  camera(
    ctx,
    track(p, [
      [0.915, 160, 100, 1.5],
      [1, 170, 96, 1.12],
    ]),
    () => podiumSet(ctx, p, sec, 1),
  );
  glow(ctx, 160, 60, 140, SUN, 0.18);
  vignette(ctx, 0.4);
}

const SHOTS = [
  establishing,
  gridShot,
  lightsShot,
  launchShot,
  tableShot,
  spoonShot,
  sugarShot,
  peaShot,
  pipAlone,
  fridgeShot,
  popOutShot,
  loungeShot,
  giantShot,
  sweepShot,
  waveShot,
  surfShot,
  crashShot,
  cheerShot,
  podiumShot,
  clapShot,
  finaleShot,
] as const;

// ——— The score ———
// The race theme is the original's: minor, driving, and a little breathless.
const RACE = [12, 12, 15, 19, 22, 19, 15, 12, 17, 17, 20, 24, 23, 19, 15, 12];
const SURF = [7, 12, 14, 16, 19, 16, 14, 12, 7, 12, 14, 16, 21, 19, 16, 14];
const FANFARE = [12, null, 16, 19, 24, null, 19, 21, 23, null, 19, 16, 12, 16, 19, 24];

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const theTinyGrandPrixScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: 57, voice: 'lead', intro: [0, 7, 12], outro: [0, 7, 12, 16] }, (s) => {
    const bpm = 60 / (BEAT * s.story); // 142 in the one-minute cut
    // Engine revs, pitched per car: a growl for Blitz, a whine for #2.
    const rev = (p: number, who: 'blitz' | 'jewel', gain = 1) => {
      const base = who === 'blitz' ? 33 : 45;
      s.fx('engine', p, who === 'blitz' ? 0.9 : 0.6, 0.16 * gain, who === 'blitz' ? 0.3 : -0.2);
      [0, 5, 12].forEach((d, i) =>
        s.note(p + i * 0.0014, base + d, 0.12, 'lead', 0.05 * gain, 0.2),
      );
    };
    // Act one: the grid, a bouncy bustle over the ant crowd.
    s.section({
      from: 0,
      to: 0.089,
      bpm,
      root: 57,
      chords: [0, 5, 7, 5],
      melody: [12, null, 16, 19, null, 16, 14, null],
      step: 0.5,
      voice: 'pluck',
      gain: 0.5,
      level: 0.55,
      groove: 'tick',
      fade: 0.6,
    });
    s.fx('crowd', 0, s.story * 0.09, 0.12);
    T.revs.forEach((r, i) => rev(r, 'blitz', 1 + i * 0.2));
    s.fx('sparkle', T.flex + 0.002, 0.8, 0.08, 0.3);
    rev(T.sputter, 'jewel', 0.6);
    s.fx('pop', T.sputter + 0.002, 0.2, 0.1, 0.1);
    s.fx('rustle', T.breath, 0.4, 0.08, -0.2);
    T.polish.forEach((q) => s.fx('squeak', q, 0.18, 0.12, -0.3));
    s.fx('chime', T.ting, 1, 0.1, -0.3);
    s.fx('bounce', T.hop, 0.3, 0.14, -0.3);
    // The lights: a hush on the dominant, three short beeps and a long one.
    s.section({ from: 0.087, to: T.go, bpm, root: 57, chords: [7], level: 0.45, fade: 0.4 });
    s.fx('crowd', 0.087, s.story * 0.03, 0.05);
    T.lights.forEach((l) => {
      s.fx('beep', l, 0.16, 0.2);
      s.note(l, 81, 0.2, 'bell', 0.05);
    });
    s.fx('beep', T.go, 0.6, 0.24);
    s.note(T.go, 93, 0.6, 'bell', 0.06);
    // GO: the racing theme.
    s.section({
      from: T.go,
      to: 0.296,
      bpm,
      root: 57,
      minor: true,
      chords: [0, 0, 5, 7],
      melody: RACE,
      step: 0.5,
      voice: 'lead',
      gain: 0.55,
      level: 0.9,
      groove: 'drive',
      fade: 0.25,
    });
    rev(T.go, 'blitz', 1.3);
    rev(T.go + 0.003, 'jewel');
    s.fx('crowd', T.go, s.story * 0.03, 0.14);
    T.backfire.forEach((b) => {
      s.fx('pop', b, 0.25, 0.22, -0.4);
      s.fx('crackle', b, 0.4, 0.08, -0.4);
    });
    s.fx('chug', T.putter, 1.2, 0.1, -0.3);
    // Under the table.
    s.fx('engine', 0.14, 1.0, 0.14);
    T.legs.forEach((l) => s.fx('swish', l - 0.003, 0.4, 0.16));
    s.fx('engine', T.slow, 0.7, 0.12, 0.6);
    s.fx('chug', T.pipIn, 0.8, 0.08, -0.5);
    // The spoon: a leap for Blitz, a see-saw for Pip.
    s.fx('engine', T.up - 0.002, 0.5, 0.14);
    s.fx('swish', T.launch, 0.5, 0.16);
    s.fx('woo', T.launch + 0.002, 0.7, 0.08, 0.2);
    s.fx('sparkle', T.launch + 0.004, 0.6, 0.08);
    s.fx('thud', T.land, 0.4, 0.2, 0.4);
    s.fx('crunch', T.land, 0.2, 0.08, 0.4);
    s.fx('swish', T.launch2, 0.4, 0.1);
    s.fx('thud', T.land2, 0.35, 0.16, 0.5);
    s.fx('clatter', T.land2, 0.4, 0.06, 0.5);
    s.fx('creak', T.tip, 0.4, 0.14);
    s.fx('boing', T.touch, 0.8, 0.18);
    s.fx('bounce', T.drop, 0.25, 0.14);
    s.fx('bounce', T.drop + 0.002, 0.2, 0.1);
    // The sugar dunes.
    for (let i = 0; i < 6; i++) s.fx('crunch', 0.228 + i * 0.0035, 0.15, 0.06, i % 2 ? 0.3 : -0.3);
    s.fx('whir', T.spin, 0.45, 0.12, 0.1);
    s.fx('crunch', T.plow, 0.3, 0.2);
    s.fx('thud', T.plow, 0.3, 0.14);
    s.fx('pop', T.popUp, 0.2, 0.14);
    s.fx('sneeze', T.popUp + 0.002, 0.6, 0.12);
    // The peas.
    for (let i = 0; i < 4; i++)
      s.fx('swish', T.weave + 0.0025 + i * 0.0023, 0.25, 0.1, -0.6 + i * 0.4);
    T.bonks.forEach((b, i) => s.fx('boing', b, 0.6, 0.18, i ? 0.1 : -0.3));
    // Pip, far behind: his own little tune, humming along to the squeak.
    s.section({
      from: 0.294,
      to: 0.327,
      bpm,
      root: 57,
      chords: [0, 5, 0, 7],
      melody: [12, 14, 16, 19, 16, 14, 12, null],
      voice: 'pluck',
      gain: 0.6,
      level: 0.5,
      groove: 'tick',
      fade: 0.3,
    });
    s.fx('giggle', T.wave + 0.004, 0.5, 0.05, 0.4);
    SQUEAKS.forEach((q) => s.fx('squeak', q, 0.13, 0.09, -0.2));
    // The cheat: a sneaky minor tiptoe, and the fridge's hum.
    s.section({
      from: 0.325,
      to: 0.374,
      bpm: bpm / 2,
      root: 57,
      minor: true,
      chords: [0, 1],
      melody: [12, null, 13, null, 12, null, 11, null, 12, 15, 13, 12],
      step: 0.5,
      voice: 'pluck',
      gain: 0.55,
      level: 0.55,
      groove: 'tick',
      fade: 0.4,
    });
    s.fx('hum', 0.325, s.story * 0.047, 0.05, 0.4);
    s.fx('engine', T.arrive - 0.006, 0.6, 0.1);
    s.fx('squeak', T.arrive - 0.002, 0.3, 0.05);
    s.fx('click', T.peek, 0.1, 0.1);
    s.note(T.smirk, 64, 0.3, 'pluck', 0.08);
    s.note(T.smirk + 0.003, 63, 0.4, 'pluck', 0.07);
    rev(T.dash, 'blitz');
    s.fx('swish', T.dash + 0.002, 0.5, 0.12, 0.3);
    s.fx('rustle', T.dash + 0.004, 0.8, 0.12, 0.5);
    // Out he pops, smug, and parks at the line to wait.
    s.section({
      from: 0.372,
      to: 0.449,
      bpm,
      root: 57,
      minor: true,
      chords: [0, 5, 0, 7],
      melody: [12, null, 15, 12, 19, null, 17, 15],
      voice: 'lead',
      gain: 0.4,
      level: 0.55,
      groove: 'pulse',
      fade: 0.4,
    });
    s.fx('pop', T.popOut, 0.2, 0.16, -0.5);
    s.fx('rustle', T.popOut, 0.6, 0.1, -0.5);
    s.fx('engine', T.popOut, 1, 0.16, -0.3);
    s.fx('squeak', T.skid, 0.45, 0.1, 0.2);
    s.fx('gasp', T.skid + 0.004, 0.6, 0.1, 0.4);
    for (const at of [T.laugh, 0.412, 0.426])
      [76, 74, 72, 76, 74, 72].forEach((pitch, i) =>
        s.note(at + i * 0.0035, pitch, 0.12, 'lead', 0.06, 0.2),
      );
    s.fx('engine', T.jewelIn, 0.6, 0.08, -0.4);
    // The mop's shadow: two low notes, closer and closer.
    s.section({
      from: T.shadow,
      to: 0.552,
      bpm: 90,
      root: 45,
      minor: true,
      chords: [0, 1],
      level: 0.7,
      fade: 0.8,
    });
    s.fx('rumble', T.shadow, 2.2, 0.2);
    [0.448, 0.46, 0.47, 0.478, 0.485, 0.491, 0.4955, 0.499].forEach((at, i) =>
      s.note(at, 33 + (i % 2), 0.35, 'bass', 0.14),
    );
    T.stomps.forEach((st) => {
      s.fx('thud', st, 0.6, 0.3);
      s.fx('rumble', st, 0.6, 0.14);
    });
    s.fx('gasp', T.look, 0.5, 0.14, 0.2);
    s.fx('clatter', T.glassesOff + 0.005, 0.3, 0.08, 0.2);
    s.note(T.gulp, 50, 0.15, 'pluck', 0.08);
    s.fx('swish', T.mopDown, 0.8, 0.14);
    s.fx('splash', T.slap, 1.2, 0.3);
    s.fx('water', T.slap, 2.5, 0.08);
    s.fx('sweep', T.sweep, 1.8, 0.28, 0.2);
    T.scoop.forEach((sc) => s.fx('boing', sc, 0.5, 0.14, 0.2));
    s.fx('woo', T.scoop[1] + 0.002, 0.8, 0.1, 0.4);
    s.fx('splash', T.lift, 0.6, 0.12, 0.5);
    // Pip hears it coming.
    s.section({
      from: 0.55,
      to: T.grin,
      bpm,
      root: 52,
      minor: true,
      chords: [0],
      level: 0.4,
      bass: false,
      fade: 0.6,
    });
    s.fx('wave', T.hear, 2.8, 0.26, -0.6);
    s.fx('rumble', T.hear, 2, 0.12, -0.5);
    s.fx('gasp', T.seeWave, 0.4, 0.08);
    [52, 55, 57, 59, 62, 64].forEach((pitch, i) =>
      s.note(T.grin + i * 0.0016, pitch, 0.18, 'lead', 0.08, -0.2),
    );
    s.fx('click', T.goggles, 0.1, 0.1);
    s.fx('boing', T.flip, 0.6, 0.14);
    s.fx('knock', T.board, 0.2, 0.12);
    s.fx('bounce', T.board + 0.002, 0.2, 0.1);
    // Surf's up: the theme turns to E major, with a tremolo picking layer.
    s.section({
      from: T.ride - 0.004,
      to: 0.8,
      bpm,
      root: 52,
      chords: [0, 0, 5, 7],
      melody: SURF,
      step: 0.5,
      voice: 'lead',
      gain: 0.6,
      level: 0.95,
      groove: 'drive',
      fade: 0.3,
    });
    s.section({
      from: T.ride,
      to: 0.78,
      bpm,
      root: 64,
      chords: [0],
      melody: [12, 12, 12, 12, 14, 14, 16, 16],
      step: 0.25,
      voice: 'pluck',
      gain: 0.22,
      level: 0,
      fade: 0.5,
    });
    s.fx('wave', T.ride, 4, 0.2);
    s.fx('wave', 0.66, 4, 0.18, 0.3);
    s.fx('splash', 0.62, 0.8, 0.1);
    s.fx('woo', 0.648, 1, 0.1);
    for (let i = 0; i < 14; i++)
      s.fx('bubble', 0.612 + i * 0.0065, 0.2, 0.06, Math.sin(i * 1.7) * 0.6);
    s.fx('splash', T.finish, 1.5, 0.3);
    s.fx('pop', T.finish, 0.2, 0.18);
    s.fx('crowd', T.finish, s.story * 0.07, 0.2);
    s.fx('applause', T.finish + 0.004, s.story * 0.06, 0.18);
    for (let i = 0; i < 8; i++)
      s.fx('bubble', T.finish + i * 0.003, 0.2, 0.08, Math.sin(i * 2.3) * 0.7);
    s.fx('whistle', T.whistle, 0.5, 0.14, -0.4);
    s.fx('whistle', T.whistle + 0.012, 0.4, 0.1, -0.4);
    // The podium: a fanfare.
    s.section({
      from: 0.8,
      to: 1,
      bpm,
      root: 57,
      chords: [0, 5, 7, 0],
      melody: FANFARE,
      voice: 'lead',
      gain: 0.55,
      level: 0.75,
      groove: 'march',
      fade: 1.6,
    });
    s.fx('crowd', 0.8, s.story * 0.15, 0.1);
    s.fx('bounce', T.climb + 0.004, 0.3, 0.12);
    s.fx('chime', T.raise, 1.4, 0.16);
    s.fx('sparkle', T.raise, 1.2, 0.12);
    s.fx('applause', T.raise, s.story * 0.1, 0.16);
    for (let i = 0; i < 8; i++) {
      s.fx('knock', T.clap1 + i * 0.0045, 0.08, 0.05, 0.3);
      s.fx('knock', T.clap2 + 0.002 + i * 0.0045, 0.08, 0.05, -0.3);
    }
    s.fx('pop', T.pop, 0.15, 0.1, 0.2);
    for (let i = 0; i < 5; i++)
      s.fx('bubble', 0.93 + i * 0.011, 0.2, 0.05, Math.sin(i * 1.9) * 0.6);
  });

export const theTinyGrandPrix: FilmModule = {
  draw(ctx, p, seconds) {
    SHOTS[shot(p, CUTS).index](ctx, p, seconds);
    // Soft dips into and out of the giant's shadow.
    veil(ctx, SHADE, Math.max(hump(p, 0.472, 0.484) * 0.6, hump(p, 0.598, 0.612) * 0.4));
    captions(ctx, p, [
      [0.012, 0.06, 'The Kitchen Grand Prix.'],
      [0.408, 0.455, 'Rules are for other bugs.'],
      [0.626, 0.674, 'Slow and steady catches the wave.'],
      [0.928, 0.982, 'A clean sweep.'],
    ]);
  },
  score: theTinyGrandPrixScore,
  look: {
    shade: SHADE,
    ink: CREAM,
    accent: GOLD,
    dedication: 'slow and steady, and a little bit lucky',
  },
};
