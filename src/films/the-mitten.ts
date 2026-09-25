import type { FilmModule } from './types';
import type { Voice } from '../music/score';
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
  snowfall,
  span,
  starfield,
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
 * THE MITTEN
 * After the old Ukrainian folk tale. Grandma knits Mila a pair of red mittens, and Mila loses
 * one in the snowy woods. That night a mouse moves in, then a hedgehog, a rabbit, a fox, and
 * at last a bear, and the mitten stretches for every one of them, until a single snowflake
 * lands on the bear's nose.
 *
 * The score is cumulative, like the tale: a folk waltz in D minor where every guest brings an
 * instrument (mouse bell, hedgehog pluck, rabbit keys, fox lead, bear bass and kick). Guests
 * move in on the downbeats of that waltz, so the art and the score read one bar grid, and the
 * reprise brings the instruments back in the same order as the animals peek out at the end.
 */

const ROOT = 62; // D
/** One waltz bar in story units: about 126 bpm over the 54 s story. */
const BAR = 0.0265;
/** The downbeat where the mouse settles in and the cumulative waltz begins. */
const TALE = 0.205;
const bar = (n: number) => TALE + n * BAR;
const MOUSE_IN = bar(0),
  HOG_IN = bar(2),
  RABBIT_IN = bar(5),
  FOX_IN = bar(9),
  BEAR_IN = bar(15),
  HUSH = bar(16),
  ACHOO = bar(19),
  LANDS = bar(23);
const ENTRIES = [MOUSE_IN, HOG_IN, RABBIT_IN, FOX_IN, BEAR_IN];
/** The bear's footfalls land on downbeats; his three shoves on the beats of bar 14. */
const STOMPS = [bar(11), bar(12), bar(13)];
const SHOVES = [bar(14), bar(14) + BAR / 3, bar(14) + (2 * BAR) / 3];
const FLAKE_LANDS = 0.672;
const AH = [0.682, 0.694];
/** In the reprise each guest peeks out as its instrument rejoins. */
const PEEK = {
  mouse: bar(26),
  hog: bar(26) + (2 * BAR) / 3,
  rabbit: bar(27),
  fox: bar(28),
  bear: bar(29),
};
const SLIP = 0.106,
  PLOP = 0.113;
/** The mitten's flight over the treetops, into the dawn. */
const FLIGHT = 0.748;

// ——— Colour ———
const RED = '#D8433B',
  RED_DARK = '#A52F2C',
  RED_LIGHT = '#EF6D5C',
  WOOL = '#F7FAFF',
  RIB = '#C3CDDD',
  DEEP = '#2A0E14',
  INK = '#241C22',
  PINK = '#E99A9A';
const MOUSE = { fur: '#8E8580', belly: '#D2C7BE', ear: '#E8A4A2', tail: '#C29A96' };
const HOG = { spine: '#5E4434', tip: '#A8876A', face: '#E2C49C', foot: '#4A3428' };
const HARE = { fur: '#A38E79', dark: '#7E6B5A', belly: '#F2ECE4', ear: '#E6A9A4' };
const FOX = { fur: '#DC6A2C', white: '#F6EEE4', sock: '#3A2A26', dark: '#2B1E1C' };
const BEAR = { fur: '#6E4B34', dark: '#553826', muzzle: '#B48E66', pad: '#3A2A22' };

type Light = {
  sky: readonly string[];
  snow: string;
  shadow: string;
  far: string;
  fir: string;
  firDark: string;
  cap: string;
  trunk: string;
};
const MORNING: Light = {
  sky: ['#8FB0D8', '#B9C6DF', '#E6D0C6', '#F6DDBE'],
  snow: '#F8F3F0',
  shadow: '#C9D1E6',
  far: '#9EAECB',
  fir: '#3D6158',
  firDark: '#2B4A45',
  cap: '#FFFFFF',
  trunk: '#5B4436',
};
const DAY: Light = {
  sky: ['#6E9FD6', '#8DB7E3', '#B6D1EC', '#DDE9F5'],
  snow: '#F7FAFF',
  shadow: '#C0D0E8',
  far: '#98AED0',
  fir: '#335E55',
  firDark: '#244540',
  cap: '#FFFFFF',
  trunk: '#54402F',
};
const DUSK: Light = {
  sky: ['#303C6C', '#645A8E', '#B27A96', '#E9A585'],
  snow: '#D8CBDD',
  shadow: '#9A90B8',
  far: '#6A6A96',
  fir: '#2B3B50',
  firDark: '#1F2B3E',
  cap: '#E6DCEC',
  trunk: '#3A2E36',
};
const NIGHT: Light = {
  sky: ['#0A1122', '#111C35', '#1A2A4A', '#26395E'],
  snow: '#A9BCDB',
  shadow: '#6C80A8',
  far: '#2C3C60',
  fir: '#1C2C3E',
  firDark: '#142030',
  cap: '#C8D5EC',
  trunk: '#1A2130',
};
const DAWN_SKY = ['#3E4C7E', '#8A7CA8', '#DDA6A2', '#F7CFA2'];

function blend(a: Light, b: Light, t: number): Light {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    sky: a.sky.map((c, i) => mix(c, b.sky[i], t)),
    snow: mix(a.snow, b.snow, t),
    shadow: mix(a.shadow, b.shadow, t),
    far: mix(a.far, b.far, t),
    fir: mix(a.fir, b.fir, t),
    firDark: mix(a.firDark, b.firDark, t),
    cap: mix(a.cap, b.cap, t),
    trunk: mix(a.trunk, b.trunk, t),
  };
}

// ——— Little helpers ———
type Mood = 'look' | 'cosy' | 'wide' | 'shut' | 'sly' | 'dizzy';
/** One animal eye; `lid` is the fur colour a sly eye's lid is drawn in. */
function eye(ctx: Ctx, x: number, y: number, r: number, mood: Mood, lid = INK, dx = 0) {
  switch (mood) {
    case 'cosy':
      line(ctx, INK, Math.max(0.5, r * 0.7), [
        x - r,
        y + r * 0.3,
        x,
        y - r * 0.5,
        x + r,
        y + r * 0.3,
      ]);
      return;
    case 'shut':
      box(ctx, x - r, y - r * 0.15, r * 2, Math.max(0.5, r * 0.5), INK);
      return;
    case 'dizzy':
      line(ctx, INK, Math.max(0.4, r * 0.45), [x - r, y - r, x + r, y + r]);
      line(ctx, INK, Math.max(0.4, r * 0.45), [x - r, y + r, x + r, y - r]);
      return;
    case 'wide':
      disc(ctx, x, y, r * 1.45, '#FFFFFF');
      disc(ctx, x + dx * r * 0.5, y, r * 0.75, INK);
      return;
    default:
      disc(ctx, x + dx * r * 0.3, y, r, INK);
      if (mood === 'sly') box(ctx, x - r - 0.3, y - r - 0.3, r * 2 + 0.6, r + 0.2, lid);
      else
        box(
          ctx,
          x - r * 0.45,
          y - r * 0.6,
          Math.max(0.4, r * 0.5),
          Math.max(0.4, r * 0.5),
          '#FFFFFF',
        );
  }
}
/** Paints only the part of something between two x positions: for going in and out of things. */
function clipX(ctx: Ctx, left: number, right: number, paint: () => void) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, -400, right - left, 1000);
  ctx.clip();
  paint();
  ctx.restore();
}
function spiky(ctx: Ctx, x: number, y: number, r1: number, r2: number, n: number, color: string) {
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU,
      r = i % 2 ? r2 : r1;
    pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  poly(ctx, color, pts);
}
/** Little stars circling a dazed head. */
function dizzy(ctx: Ctx, x: number, y: number, seconds: number) {
  for (let k = 0; k < 3; k++) {
    const a = seconds * 4 + k * 2.1;
    box(ctx, x + Math.cos(a) * 5 - 0.7, y + Math.sin(a) * 1.6 - 0.7, 1.4, 1.4, '#F6E27A');
  }
}
function snowflake(ctx: Ctx, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = r * 0.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    ctx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.restore();
}

// ——— The mitten ———
type Mitt = { w: number; h: number; strain: number; warm: number };
const BASE: Mitt = { w: 26, h: 16, strain: 0, warm: 0 };
type Cuff = { ox: number; oy: number; rx: number; ry: number; rim: number };
/** The cuff opening in mitten space: (0, 0) is the cuff's foot on the snow, fingers to the right. */
const cuffOf = (h: number): Cuff => ({
  ox: -h * 0.04,
  oy: -h * 0.52,
  rx: h * 0.25,
  ry: h * 0.43,
  rim: clamp(h * 0.1, 1.6, 5),
});

function knitFlake(ctx: Ctx, x: number, y: number, rx: number, ry: number) {
  const t = Math.max(0.8, Math.min(rx, ry) * 0.3);
  box(ctx, x - rx, y - t / 2, rx * 2, t, WOOL);
  box(ctx, x - t / 2, y - ry, t, ry * 2, WOOL);
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    box(ctx, x + dx * rx * 0.62 - t / 2, y + dy * ry * 0.62 - t / 2, t, t, WOOL);
}
/** Body and thumb, with knitted rows and snowflakes that stretch as the wool does. */
function mittenShell(ctx: Ctx, m: Mitt) {
  const { w, h } = m;
  const bx = w * 0.52,
    by = -h * 0.5,
    rx = w * 0.5,
    ry = h * 0.5;
  oval(ctx, w * 0.36, -h * 0.82, h * 0.2 + 1, h * 0.36 + 1, RED_DARK, 0.55);
  oval(ctx, w * 0.355, -h * 0.84, h * 0.17 + 1, h * 0.33 + 1, RED, 0.55);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(bx, by, rx, ry, 0, 0, TAU);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.clip();
  oval(ctx, bx, by + ry * 0.95, rx * 1.1, ry * 0.7, RED_DARK);
  oval(ctx, bx - rx * 0.15, by - ry * 0.62, rx * 0.62, ry * 0.2, RED_LIGHT);
  const sx = w / BASE.w,
    sy = h / BASE.h;
  for (const row of [-0.27, 0.24]) {
    const y = by + row * h;
    for (let x = h * 0.35 + 1.5 * sx; x < w; x += 3.2 * sx)
      box(ctx, x, y - 0.5 * sy, 1.3 * sx, Math.max(0.8, 0.9 * sy), WOOL);
  }
  for (const u of [0.44, 0.64, 0.84]) knitFlake(ctx, u * w, by, 2.2 * sx, 2.2 * sy);
  ctx.restore();
}
/** Where each guest peers out once the seams start to give. */
const GAPS = [
  { u: 0.4, v: 0.8, who: 'mouse' },
  { u: 0.64, v: 0.72, who: 'rabbit' },
  { u: 0.84, v: 0.46, who: 'fox' },
  { u: 0.5, v: 0.38, who: 'hog' },
  { u: 0.72, v: 0.2, who: 'paw' },
] as const;
function seams(ctx: Ctx, m: Mitt, mood: Mood, seconds: number) {
  if (m.strain <= 0.02) return;
  for (const g of GAPS) {
    const x = g.u * m.w,
      y = -g.v * m.h;
    const rx = 1.2 + m.strain * 8,
      ry = 0.6 + m.strain * 4.4;
    oval(ctx, x, y, rx, ry, DEEP);
    if (m.strain > 0.6) {
      const look = mood === 'wide' ? Math.sin(seconds * 2.6 + x) : -0.6;
      if (g.who === 'fox') foxEyes(ctx, x - 1.7, y, mood === 'shut' ? 'shut' : 'wide');
      else if (g.who === 'paw')
        for (let k = -1; k <= 1; k++)
          poly(ctx, '#EDE3CF', [
            x + k * 1.6 - 0.6,
            y + 1,
            x + k * 1.6,
            y - 2.2,
            x + k * 1.6 + 0.6,
            y + 1,
          ]);
      else {
        const r = g.who === 'mouse' ? 0.9 : 1.2;
        eye(ctx, x - r * 1.4, y, r, mood, INK, look);
        eye(ctx, x + r * 1.4, y, r, mood, INK, look);
        if (g.who === 'hog') disc(ctx, x - r * 3.6, y + r * 0.8, 0.8, INK);
      }
    }
    // The yarn, straining across the gap.
    for (const k of m.strain > 0.6 ? [-1, 1] : [-1, 0, 1])
      box(ctx, x + k * rx * 0.72 - 0.35, y - ry * 0.85, 0.7, ry * 1.7, RED_LIGHT);
  }
}
function prickles(ctx: Ctx, m: Mitt) {
  const x0 = m.w * 0.6,
    top = -m.h * 0.97;
  for (let k = -2; k <= 2; k++) {
    const x = x0 + k * 1.8,
      len = 2.6 - Math.abs(k) * 0.5;
    poly(ctx, HOG.spine, [x - 0.8, top + 1.5, x + k * 0.35, top - len, x + 0.8, top + 1.5]);
  }
}
function cuffBand(ctx: Ctx, c: Cuff, h: number) {
  const cx = c.ox + h * 0.2,
    rx = h * 0.24,
    ry = c.ry + c.rim;
  oval(ctx, cx, c.oy, rx, ry, WOOL);
  for (let k = 1; k <= 4; k++) {
    const x = c.ox + h * 0.05 + h * 0.07 * k;
    const len = ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)) * 0.9;
    box(ctx, x, c.oy - len, Math.max(0.5, h * 0.02), len * 2, RIB);
  }
}
function cuffRim(ctx: Ctx, c: Cuff) {
  ctx.strokeStyle = WOOL;
  ctx.lineWidth = c.rim;
  ctx.beginPath();
  ctx.ellipse(c.ox, c.oy, c.rx + c.rim / 2, c.ry + c.rim / 2, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = RIB;
  ctx.lineWidth = Math.max(0.4, c.rim * 0.18);
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU,
      ca = Math.cos(a),
      sa = Math.sin(a);
    ctx.moveTo(c.ox + ca * (c.rx + c.rim * 0.2), c.oy + sa * (c.ry + c.rim * 0.2));
    ctx.lineTo(c.ox + ca * (c.rx + c.rim * 0.8), c.oy + sa * (c.ry + c.rim * 0.8));
  }
  ctx.stroke();
}
/** The empty mitten on its own, spinning about its middle: flying, falling, or lying lost. */
function mittenAlone(ctx: Ctx, x: number, y: number, rot: number, s: number) {
  const c = cuffOf(BASE.h);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.translate(-BASE.w * 0.45, BASE.h * 0.5);
  mittenShell(ctx, BASE);
  cuffBand(ctx, c, BASE.h);
  oval(ctx, c.ox, c.oy, c.rx, c.ry, DEEP);
  cuffRim(ctx, c);
  ctx.restore();
}
/** A small upright mitten (cuff down), for hands, needles, and the sky. */
function mittenIcon(ctx: Ctx, x: number, y: number, s: number, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  oval(ctx, -3, -4.4, 1.4, 2.3, RED_DARK, -0.5);
  oval(ctx, 0.3, -5.4, 3.1, 4.3, RED);
  box(ctx, -2.8, -3, 6.2, 3.4, RED);
  box(ctx, -0.3, -7.6, 1, 4, WOOL);
  box(ctx, -1.8, -6.1, 4, 1, WOOL);
  box(ctx, -3, 0.2, 6.6, 2.6, WOOL);
  box(ctx, -1.6, 0.2, 0.6, 2.6, RIB);
  box(ctx, 0.8, 0.2, 0.6, 2.6, RIB);
  ctx.restore();
}

/** How many guests are in the mitten. */
const guests = (p: number) => (p >= ACHOO ? 0 : ENTRIES.filter((at) => p >= at).length);
// Each move-in stretches the mitten with a squash-and-stretch wobble; the bear takes three
// shoves before the last almighty one.
const GROWTH = [
  [MOUSE_IN, 27, 17],
  [HOG_IN, 33, 20],
  [RABBIT_IN, 44, 27],
  [FOX_IN, 64, 38],
  [SHOVES[0], 74, 44],
  [SHOVES[1], 86, 52],
  [SHOVES[2], 98, 60],
  [BEAR_IN, 128, 86],
] as const;
function mittState(p: number): Mitt {
  let w = BASE.w,
    h = BASE.h,
    pw = w,
    ph = h,
    since = -1;
  if (p < ACHOO)
    for (const [at, gw, gh] of GROWTH) {
      if (p < at) break;
      pw = w;
      ph = h;
      w = gw;
      h = gh;
      since = p - at;
    }
  if (since >= 0) {
    const grow = backOut(since / 0.006);
    w = lerp(pw, w, grow);
    h = lerp(ph, h, grow);
    const wobble = Math.sin((since / 0.0032) * Math.PI) * Math.exp(-since / 0.005);
    w *= 1 + wobble * 0.07;
    h *= 1 - wobble * 0.08;
  }
  // The long breath before the sneeze.
  const breath = p < ACHOO ? easeIn(span(p, AH[0], ACHOO)) * 0.09 : 0;
  h *= 1 + breath;
  w *= 1 + breath * 0.5;
  return { w, h, strain: clamp((w - 64) / 60), warm: [0, 0.2, 0.3, 0.4, 0.5, 0.62][guests(p)] };
}
function insideMood(p: number): Mood {
  if (p >= AH[0]) return 'shut';
  if (p >= 0.37) return 'wide';
  if (p >= RABBIT_IN + 0.008) return 'cosy';
  if (p >= 0.29) return 'look';
  if (p >= HOG_IN + 0.008) return 'cosy';
  if (p >= 0.236) return 'look';
  if (p >= MOUSE_IN + 0.006) return 'cosy';
  return 'look';
}

// ——— Guests, as seen inside the cuff ———
function mouseFace(ctx: Ctx, x: number, y: number, mood: Mood) {
  disc(ctx, x + 1.8, y - 2.3, 1.6, MOUSE.fur);
  disc(ctx, x + 1.9, y - 2.2, 0.9, MOUSE.ear);
  disc(ctx, x, y, 2.3, MOUSE.fur);
  poly(ctx, MOUSE.fur, [x - 0.8, y - 1.5, x - 4.4, y + 0.4, x - 0.5, y + 1.8]);
  eye(ctx, x - 0.8, y - 0.6, 0.6, mood);
}
function hogFace(ctx: Ctx, x: number, y: number, mood: Mood) {
  spiky(ctx, x + 2.2, y - 0.5, 3.4, 4.8, 10, HOG.spine);
  disc(ctx, x, y, 2.8, HOG.face);
  poly(ctx, HOG.face, [x - 0.5, y - 2, x - 5.2, y + 0.8, x - 0.3, y + 2.2]);
  eye(ctx, x - 1, y - 0.7, 0.7, mood);
}
function rabbitFace(ctx: Ctx, x: number, y: number, mood: Mood) {
  disc(ctx, x, y, 3.4, HARE.fur);
  oval(ctx, x - 2.4, y + 1, 1.9, 1.6, HARE.belly);
  disc(ctx, x - 3.9, y + 0.3, 0.75, PINK);
  eye(ctx, x - 1.2, y - 1.2, 0.85, mood);
}
function foxEyes(ctx: Ctx, x: number, y: number, mood: Mood) {
  for (const dx of [0, 3.4]) {
    if (mood === 'wide') {
      disc(ctx, x + dx, y, 1.3, '#F4C95A');
      disc(ctx, x + dx, y, 0.55, INK);
    } else if (mood === 'shut') box(ctx, x + dx - 1.2, y, 2.4, 0.5, '#F4C95A');
    else {
      oval(ctx, x + dx, y, 1.3, 0.55, '#F4C95A', -0.15);
      box(ctx, x + dx - 0.2, y - 0.5, 0.4, 1, INK);
    }
  }
}
function rabbitEar(ctx: Ctx, x: number, y: number, angle: number, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  oval(ctx, 0, -6 * s, 1.8 * s, 6.5 * s, HARE.fur);
  oval(ctx, 0.2 * s, -6 * s, 0.8 * s, 5 * s, HARE.ear);
  ctx.restore();
}
// Face positions inside the opening, as fractions of its radii, by how many are in.
const SLOTS: Record<number, Record<string, readonly [number, number]>> = {
  1: { mouse: [-0.1, 0.3] },
  2: { mouse: [0.2, -0.32], hog: [-0.05, 0.4] },
  3: { mouse: [0.4, -0.55], hog: [-0.05, 0.6], rabbit: [-0.05, -0.08] },
  4: { mouse: [0.12, -0.6], hog: [-0.2, 0.56], rabbit: [-0.32, -0.16] },
};
/** Bear-sized: his nose sits right at the rim, where a snowflake could land on it. */
const bearNose = (c: Cuff) => ({ x: c.ox - c.rx - 4, y: c.oy + 1 });
function guestFaces(ctx: Ctx, c: Cuff, inside: number, p: number) {
  const mood = insideMood(p);
  if (inside >= 5) {
    // The bear's head fills the whole cuff. His eyes follow the falling snowflake.
    const cross = span(p, HUSH + 0.01, FLAKE_LANDS);
    const bm: Mood = p >= AH[0] ? 'shut' : p >= HUSH ? 'look' : 'wide';
    disc(ctx, c.ox + 6, c.oy - 2, 17, BEAR.fur);
    eye(ctx, c.ox - 4, c.oy - 9, 1.6, bm, INK, -cross * 1.4);
    eye(ctx, c.ox + 4, c.oy - 10, 1.5, bm, INK, -cross * 2.2);
    return;
  }
  const slot = SLOTS[inside];
  if (!slot) return;
  const at = (k: string) => {
    const [u, v] = slot[k];
    return { x: c.ox + u * c.rx, y: c.oy + v * c.ry };
  };
  if (inside === 4)
    foxEyes(ctx, c.ox + c.rx * 0.45, c.oy - c.ry * 0.12, p >= 0.49 ? 'wide' : 'sly');
  if (slot.rabbit) {
    const r = at('rabbit');
    rabbitFace(ctx, r.x, r.y, mood);
  }
  if (slot.hog) {
    const g = at('hog');
    hogFace(ctx, g.x, g.y, mood);
  }
  const m = at('mouse');
  // While the hedgehog knocks, the mouse leans out to see who it is, and nods.
  const lean = inside === 1 ? hump(p, 0.234, 0.254) * 1.2 : 0;
  mouseFace(ctx, m.x - lean, m.y - hump(p, 0.246, 0.25) * 0.8, mood);
}
/** What pokes out past the rim: noses, ears, and one fox tail. */
function guestTails(ctx: Ctx, c: Cuff, inside: number, p: number, seconds: number) {
  if (inside === 1) {
    const y = c.oy + c.ry * 0.3 + 0.4;
    const x = c.ox - c.rx - c.rim * 0.4 - hump(p, 0.234, 0.254) * 1.2;
    disc(ctx, x, y, 0.85, PINK);
    line(ctx, alpha('#FFFFFF', 0.6), 0.25, [x - 0.4, y - 0.3, x - 2.6, y - 1.1]);
    line(ctx, alpha('#FFFFFF', 0.6), 0.25, [x - 0.4, y + 0.2, x - 2.6, y + 0.8]);
  }
  if (inside >= 2 && inside < 5) {
    const [, v] = SLOTS[inside].hog;
    disc(ctx, c.ox - c.rx - c.rim * 0.35, c.oy + v * c.ry + 0.8, 1, INK);
  }
  if (inside >= 3) {
    const u = inside === 5 ? 0 : SLOTS[inside].rabbit[0];
    const bx = c.ox + u * c.rx,
      by = c.oy - c.ry - c.rim * 0.6;
    const stiff = p >= 0.37 && p < AH[0];
    const twitch = stiff ? 0 : Math.max(0, Math.sin(seconds * 2.3)) ** 12 * 0.35;
    rabbitEar(ctx, bx - 1.3, by, stiff ? -0.05 : -0.3 - twitch);
    rabbitEar(ctx, bx + 1.3, by, stiff ? 0.06 : 0.22);
  }
  if (inside >= 4) {
    ctx.save();
    ctx.translate(c.ox - c.rx * 0.2, -1.8);
    ctx.rotate(-0.05 + Math.sin(seconds * 1.7) * 0.05);
    oval(ctx, -9, 0, 10, 3.6, FOX.fur);
    oval(ctx, -17.5, -0.4, 3.4, 2.9, FOX.white);
    ctx.restore();
  }
  if (inside >= 5) {
    // Muzzle and nose; after the flake lands, the nostrils start to flare.
    const n = bearNose(c);
    const flare = 1 + ease(span(p, FLAKE_LANDS + 0.004, ACHOO)) * 0.35;
    const twitch = within(p, FLAKE_LANDS + 0.004, ACHOO) ? Math.sin(seconds * 40) * 0.4 : 0;
    oval(ctx, c.ox - c.rx + 4, c.oy + 3, 9, 7, BEAR.muzzle);
    oval(ctx, n.x + twitch, n.y, 3.4 * flare, 2.6 * flare, INK);
    box(ctx, n.x - 1.8 + twitch, n.y - 1.6, 1.4, 0.8, alpha('#FFFFFF', 0.7));
    line(ctx, INK, 0.7, [
      c.ox - c.rx + 1,
      c.oy + 7,
      c.ox - c.rx + 4,
      c.oy + 8.5,
      c.ox - c.rx + 7,
      c.oy + 7.5,
    ]);
  }
}

/** The whole mitten at cuff-foot (x, g): `between` paints whatever is squeezing through the cuff. */
function drawMitten(
  ctx: Ctx,
  x: number,
  g: number,
  m: Mitt,
  p: number,
  seconds: number,
  between?: () => void,
) {
  const inside = guests(p);
  const c = cuffOf(m.h);
  ctx.save();
  ctx.translate(x, g);
  mittenShell(ctx, m);
  if (inside >= 2) prickles(ctx, m);
  seams(ctx, m, insideMood(p), seconds);
  cuffBand(ctx, c, m.h);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(c.ox, c.oy, c.rx, c.ry, 0, 0, TAU);
  ctx.fillStyle = DEEP;
  ctx.fill();
  ctx.clip();
  glow(ctx, c.ox + c.rx * 0.5, c.oy + c.ry * 0.3, c.ry * 1.7, '#FF9C5A', m.warm);
  guestFaces(ctx, c, inside, p);
  ctx.restore();
  ctx.restore();
  between?.();
  ctx.save();
  ctx.translate(x, g);
  cuffRim(ctx, c);
  guestTails(ctx, c, inside, p, seconds);
  ctx.restore();
}

// ——— Animals, full size ———
type Beast = {
  facing?: 1 | -1;
  s?: number;
  step?: number;
  mood?: Mood;
  rot?: number;
};
function mouse(ctx: Ctx, x: number, y: number, o: Beast = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((o.facing ?? 1) * (o.s ?? 1), o.s ?? 1);
  if (o.rot) {
    ctx.translate(0, -5);
    ctx.rotate(o.rot);
    ctx.translate(0, 5);
  }
  const leg = o.step === undefined ? 0 : Math.sin(o.step) * 1.2;
  line(ctx, MOUSE.tail, 0.9, [-5, -2.5, -9, -2.2, -12, -4.5, -13, -7.5]);
  box(ctx, -3.5 + leg, -1.5, 2.2, 1.5, PINK);
  box(ctx, 2 - leg, -1.5, 2.2, 1.5, PINK);
  oval(ctx, -0.5, -4, 5.5, 3.8, MOUSE.fur);
  oval(ctx, 0.5, -2.1, 4, 1.7, MOUSE.belly);
  disc(ctx, 5, -5.5, 3.1, MOUSE.fur);
  poly(ctx, MOUSE.fur, [5.5, -8, 10.5, -4.8, 5.5, -3]);
  disc(ctx, 10.4, -4.9, 0.9, PINK);
  disc(ctx, 3.4, -9, 2.5, MOUSE.fur);
  disc(ctx, 3.6, -8.8, 1.5, MOUSE.ear);
  eye(ctx, 6.6, -6.2, 0.75, o.mood ?? 'look');
  line(ctx, alpha('#FFFFFF', 0.55), 0.3, [9.5, -4.6, 12.8, -5.6]);
  line(ctx, alpha('#FFFFFF', 0.55), 0.3, [9.5, -4, 12.8, -3.2]);
  ctx.restore();
}
function hedgehog(ctx: Ctx, x: number, y: number, o: Beast & { roll?: number; pat?: number } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((o.facing ?? 1) * (o.s ?? 1), o.s ?? 1);
  if (o.roll !== undefined) {
    // Curled into a prickly ball.
    ctx.translate(0, -6);
    ctx.rotate(o.roll);
    spiky(ctx, 0, 0, 5.2, 7.4, 14, HOG.spine);
    disc(ctx, 0, 0, 4.4, mix(HOG.spine, HOG.tip, 0.4));
    disc(ctx, 1.6, 1.4, 2.2, HOG.face);
    disc(ctx, 3.4, 1.8, 0.7, INK);
    ctx.restore();
    return;
  }
  const leg = o.step === undefined ? 0 : Math.sin(o.step) * 1;
  box(ctx, -4 + leg, -1.6, 2.2, 1.6, HOG.foot);
  box(ctx, 3 - leg, -1.6, 2.2, 1.6, HOG.foot);
  oval(ctx, 0.5, -3.2, 6.5, 2.6, HOG.face);
  const pts: number[] = [];
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI * (0.98 + (i / 14) * 0.9),
      r = i % 2 ? 1.28 : 1;
    pts.push(-1 + Math.cos(a) * 7 * r, -3.4 + Math.sin(a) * 6 * r);
  }
  pts.push(4, -1.5, -7.5, -1.5);
  poly(ctx, HOG.spine, pts);
  for (let i = 1; i < 14; i += 2) {
    const a = Math.PI * (0.98 + (i / 14) * 0.9);
    box(ctx, -1.5 + Math.cos(a) * 7.6, -3.9 + Math.sin(a) * 6.6, 1, 1, HOG.tip);
  }
  disc(ctx, 4.2, -4, 2.8, HOG.face);
  poly(ctx, HOG.face, [4, -6.2, 11, -3, 4.5, -1.4]);
  disc(ctx, 11, -3.1, 0.95, INK);
  disc(ctx, 3.4, -6.5, 1, HOG.spine);
  eye(ctx, 6, -4.6, 0.75, o.mood ?? 'look');
  if (o.pat) {
    ctx.save();
    ctx.translate(6, -2.5);
    ctx.rotate(-1.4 * o.pat);
    box(ctx, -0.8, 0, 1.8, 3.4, HOG.foot);
    ctx.restore();
  }
  ctx.restore();
}
function rabbit(ctx: Ctx, x: number, y: number, o: Beast & { hop?: number; ears?: number } = {}) {
  const hop = o.hop ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((o.facing ?? 1) * (o.s ?? 1), o.s ?? 1);
  if (o.rot) {
    ctx.translate(0, -10);
    ctx.rotate(o.rot);
    ctx.translate(0, 10);
  }
  // In the air he stretches out long, ears streaming back.
  ctx.rotate(-0.25 * hop);
  ctx.scale(1 + 0.25 * hop, 1 - 0.12 * hop);
  disc(ctx, -7.5, -6.5, 2.4, HARE.belly);
  oval(ctx, -2, -5.5, 7, 5.5, HARE.fur);
  oval(ctx, -hop * 3, -1, 5.5 + hop * 2, 1.4, HARE.dark);
  oval(ctx, 3.5, -8.5, 4.5, 5.5, HARE.fur);
  oval(ctx, 5, -6.5, 2.5, 3.5, HARE.belly);
  box(ctx, 5 + hop * 3, -3.5, 2.2, 3.5, HARE.fur);
  const ears = (o.ears ?? 0) + hop * 0.9;
  rabbitEar(ctx, 5.5, -16.5, -0.3 - ears, 1.1);
  disc(ctx, 7, -13.5, 4.3, HARE.fur);
  oval(ctx, 9.8, -12.3, 2.4, 2, HARE.belly);
  disc(ctx, 11.6, -13, 0.8, PINK);
  eye(ctx, 8, -14.6, 0.85, o.mood ?? 'look');
  rabbitEar(ctx, 7.5, -16.8, 0.12 - ears * 0.8, 1.1);
  ctx.restore();
}
function foxHead(ctx: Ctx, x: number, y: number, mood: Mood, bow: number, shh: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bow * 0.7);
  oval(ctx, 0.5, 2.5, 3.6, 4.6, FOX.white);
  poly(ctx, FOX.fur, [-1, -4, 0.2, -12.5, 4, -5.5]);
  poly(ctx, FOX.dark, [-0.3, -9.5, 0.2, -12.5, 1.6, -10]);
  disc(ctx, 3, -2.5, 5, FOX.fur);
  poly(ctx, FOX.fur, [3, -6, 5.6, -13.2, 7.4, -5.2]);
  poly(ctx, FOX.dark, [4.8, -10.2, 5.6, -13.2, 6.6, -10.4]);
  poly(ctx, FOX.fur, [5, -5.5, 13.5, -1, 5, 1.2]);
  poly(ctx, FOX.white, [2.5, -0.8, 13, -0.6, 5, 2.4]);
  disc(ctx, 13.4, -1.2, 1.1, INK);
  eye(ctx, 5.4, -3.6, 1, mood, FOX.fur);
  if (shh > 0) {
    // One paw up to the lips: shh.
    line(ctx, FOX.fur, 2.8, [1, 7, 4 + shh * 4, 4.5 - shh * 4]);
    disc(ctx, 4.5 + shh * 4.5, 4 - shh * 4.4, 1.8, FOX.sock);
  }
  ctx.restore();
}
function fox(
  ctx: Ctx,
  x: number,
  y: number,
  o: Beast & { bow?: number; shh?: number; sit?: boolean; swish?: number } = {},
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((o.facing ?? 1) * (o.s ?? 1), o.s ?? 1);
  if (o.rot) {
    ctx.translate(0, -12);
    ctx.rotate(o.rot);
    ctx.translate(0, 12);
  }
  const mood = o.mood ?? 'sly';
  if (o.sit) {
    oval(ctx, 0, -1.8, 11, 3, FOX.fur);
    oval(ctx, 10, -2, 3.4, 2.6, FOX.white);
    oval(ctx, -2, -7, 7, 7, FOX.fur);
    box(ctx, 3, -10, 2.4, 10, FOX.sock);
    box(ctx, 6, -10, 2.4, 10, FOX.sock);
    oval(ctx, 1, -14, 6, 8, FOX.fur, 0.3);
    oval(ctx, 5, -13, 3, 5.5, FOX.white);
    foxHead(ctx, 5, -21, mood, 0, o.shh ?? 0);
    ctx.restore();
    return;
  }
  const sw = o.step === undefined ? 0 : Math.sin(o.step) * 2.2;
  ctx.save();
  ctx.translate(-9, -13);
  ctx.rotate(0.35 + (o.swish ?? 0) * 0.3);
  oval(ctx, -9, 0, 10, 4.3, FOX.fur);
  oval(ctx, -16.5, 0, 3.6, 3.2, FOX.white);
  ctx.restore();
  box(ctx, -7 + sw, -10, 2.4, 10, FOX.dark);
  box(ctx, 5 - sw, -10, 2.4, 10, FOX.dark);
  oval(ctx, -1, -13, 10.5, 5.3, FOX.fur);
  oval(ctx, 0, -10.2, 7, 2.2, FOX.white);
  box(ctx, -4 - sw, -10, 2.4, 10, FOX.sock);
  box(ctx, 8 + sw, -10, 2.4, 10, FOX.sock);
  foxHead(ctx, 8, -16, mood, o.bow ?? 0, o.shh ?? 0);
  ctx.restore();
}
function bearHead(ctx: Ctx, x: number, y: number, mood: Mood, tilt: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  disc(ctx, -6, -9.5, 4.2, BEAR.fur);
  disc(ctx, -6, -9.5, 2.2, BEAR.muzzle);
  disc(ctx, 3, -10.5, 4.2, BEAR.fur);
  disc(ctx, 3, -10.5, 2.2, BEAR.muzzle);
  disc(ctx, 0, 0, 11, BEAR.fur);
  oval(ctx, 9, 3, 7, 5.5, BEAR.muzzle);
  oval(ctx, 14.5, 0.8, 2.8, 2.1, INK);
  box(ctx, 13.4, -0.4, 1.2, 0.7, alpha('#FFFFFF', 0.7));
  line(ctx, INK, 0.8, [8.5, 6, 11, 7.2, 13.5, 6]);
  eye(ctx, 5.5, -3, 1.3, mood);
  eye(ctx, -0.5, -3.6, 1.2, mood);
  ctx.restore();
}
type BearPose = 'walk' | 'sit' | 'push' | 'bank' | 'peek';
function bear(
  ctx: Ctx,
  x: number,
  y: number,
  o: Beast & { pose: BearPose; rub?: number; kick?: number; wave?: number; tilt?: number },
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((o.facing ?? 1) * (o.s ?? 1.2), o.s ?? 1.2);
  if (o.rot) {
    ctx.translate(0, -26);
    ctx.rotate(o.rot);
    ctx.translate(0, 26);
  }
  const mood = o.mood ?? 'look';
  const k = o.kick ?? 0;
  switch (o.pose) {
    case 'walk': {
      const sw = o.step === undefined ? 0 : Math.sin(o.step) * 3;
      const lift = (phase: number) =>
        o.step === undefined ? 0 : Math.max(0, Math.sin(o.step + phase)) * 2.5;
      box(ctx, -19 + sw, -17 - lift(0), 9, 17, BEAR.dark);
      box(ctx, 14 - sw, -17 - lift(Math.PI), 9, 17, BEAR.dark);
      oval(ctx, -15, -27, 14, 15, BEAR.fur);
      oval(ctx, 2, -27, 24, 16, BEAR.fur);
      oval(ctx, 12, -33, 14, 11, BEAR.fur);
      disc(ctx, -28, -33, 3, BEAR.fur);
      box(ctx, -15 - sw, -17 - lift(Math.PI), 9.5, 17, BEAR.fur);
      box(ctx, 18 + sw, -17 - lift(0), 9.5, 17, BEAR.fur);
      box(ctx, -15.5 - sw, -3 - lift(Math.PI), 10.5, 3, BEAR.pad);
      box(ctx, 17.5 + sw, -3 - lift(0), 10.5, 3, BEAR.pad);
      bearHead(ctx, 30, -33, mood, o.tilt ?? 0);
      break;
    }
    case 'sit': {
      // Up on his haunches, paws together: a very polite, very large guest.
      const r = o.rub ?? 0;
      oval(ctx, -4, -4, 10, 5, BEAR.dark);
      oval(ctx, 0, -26, 17, 23, BEAR.fur);
      oval(ctx, 5, -22, 10.5, 15, BEAR.muzzle);
      oval(ctx, 9, -3.5, 8.5, 4.2, BEAR.fur);
      oval(ctx, 15, -3.8, 3, 3.3, BEAR.pad);
      oval(ctx, 5, -37, 4, 9, BEAR.fur, -0.7);
      disc(ctx, 11 + r, -31, 4.5, BEAR.fur);
      disc(ctx, 14 - r, -30, 4.5, BEAR.dark);
      bearHead(ctx, 4, -52, mood, o.tilt ?? 0);
      break;
    }
    case 'push': {
      // Only his back half: head, shoulders, and good manners are already inside.
      ctx.scale(1.14, 0.78);
      const leg = (dx: number, phase: number, color: string) => {
        ctx.save();
        ctx.translate(dx, -18);
        ctx.rotate(0.55 + Math.sin(k + phase) * 0.45);
        box(ctx, -4.5, 0, 9, 16, color);
        oval(ctx, 0, 16, 5, 2.4, BEAR.pad);
        ctx.restore();
      };
      leg(-12, 0, BEAR.dark);
      oval(ctx, 6, -26, 22, 16, BEAR.fur);
      oval(ctx, -9, -26, 15, 16, BEAR.fur);
      disc(ctx, -23, -32, 3.2, BEAR.fur);
      leg(-6, Math.PI, BEAR.fur);
      break;
    }
    case 'bank': {
      // Head-first in the snowbank: only his legs and his dignity stick out.
      for (const [dx, dir] of [
        [-6, 1],
        [6, -1],
      ]) {
        ctx.save();
        ctx.translate(dx, -8);
        ctx.rotate(Math.PI + dir * (0.25 + Math.sin(k + dx) * 0.22));
        box(ctx, -4.5, 0, 9, 17, BEAR.fur);
        oval(ctx, 0, 17, 5.5, 3, BEAR.pad);
        ctx.restore();
      }
      oval(ctx, 0, -6, 13, 9, BEAR.fur);
      disc(ctx, 0, -15, 3, BEAR.fur);
      break;
    }
    case 'peek': {
      // Head and one waving paw, round the side of a tree.
      const w = Math.sin(o.wave ?? 0) * 0.35;
      oval(ctx, -2, -18, 14, 20, BEAR.fur);
      bearHead(ctx, 0, -40, mood, -0.12);
      ctx.save();
      ctx.translate(19, -27);
      ctx.rotate(-2.75 + w);
      oval(ctx, 0, 6, 3.6, 8, BEAR.fur);
      disc(ctx, 0, 13, 4.3, BEAR.fur);
      oval(ctx, 0, 14.5, 2.4, 2, BEAR.pad);
      ctx.restore();
      break;
    }
  }
  ctx.restore();
}

// ——— People ———
const MILA: Figure = {
  skin: '#F2C7A5',
  hair: '#5A3322',
  coat: '#3F6DB3',
  legs: '#2C3452',
  shoes: '#6A3A2A',
  hairStyle: 'pigtails',
  hat: 'beanie',
  hatColor: RED,
};
const GRAN: Figure = {
  skin: '#E6B896',
  hair: '#CBC6C2',
  coat: '#4C6A78',
  legs: '#3A3440',
  shoes: '#4A3530',
  build: 'adult',
  hairStyle: 'bun',
};
type Mitts = { front: boolean; back: boolean };
const BOTH: Mitts = { front: true, back: true };
function handMitt(ctx: Ctx, x: number, y: number, s: number, arm: number, facing: number) {
  // mittenIcon points its fingers up; turn them to point down the arm, cuff at the wrist.
  const dx = facing * Math.sin(arm),
    dy = Math.cos(arm);
  ctx.save();
  ctx.translate(x - dx * 1.6 * s, y - dy * 1.6 * s);
  ctx.scale(facing, 1);
  mittenIcon(ctx, 0, 0, 0.5 * s, Math.PI - arm);
  ctx.restore();
}
/** Mila, in her blue coat, red scarf, red bobble hat, and however many red mittens. */
function mila(ctx: Ctx, x: number, y: number, over: Partial<Figure>, mitts: Mitts = BOTH) {
  const f: Figure = { ...MILA, ...over };
  const s = f.size ?? 1;
  const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step));
  const swing = f.step === undefined ? 0 : Math.sin(f.step);
  const [back, front] = f.arms ?? [-swing * 0.6, swing * 0.6];
  const neck = (paint: () => void) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((f.facing ?? 1) * s, s);
    ctx.translate(0, -6 - bob);
    ctx.rotate(f.lean ?? 0);
    paint();
    ctx.restore();
  };
  // The scarf's tail flies out behind her when she runs.
  neck(() => {
    ctx.translate(-3, -8);
    ctx.rotate(f.step === undefined ? 0.15 : 1.1 + Math.sin(f.step * 2) * 0.2);
    box(ctx, -1.2, 0, 2.6, 6, RED_DARK);
    box(ctx, -1.2, 5, 2.6, 1, WOOL);
  });
  person(ctx, x, y, f);
  neck(() => box(ctx, -4.5, -9.6, 9, 2.6, RED));
  if (mitts.back && Math.abs(back) > 0.5) {
    const h = handOf(x, y, f, 'back');
    handMitt(ctx, h.x, h.y, s, back, f.facing ?? 1);
  }
  if (mitts.front) {
    const h = handOf(x, y, f, 'front');
    handMitt(ctx, h.x, h.y, s, front, f.facing ?? 1);
  }
}
/** Grandma: grey bun, round glasses, and a shawl with a fringe. */
function granny(ctx: Ctx, x: number, y: number, over: Partial<Figure>) {
  const f: Figure = { ...GRAN, ...over };
  const s = f.size ?? 1;
  const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step));
  person(ctx, x, y, f);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((f.facing ?? 1) * s, s);
  ctx.translate(0, f.sitting ? -4 : -11 - bob);
  ctx.rotate(f.lean ?? 0);
  poly(ctx, '#8E3B46', [-5.5, -13.5, 5, -13.5, 6.5, -9, 1, -3.5, -5.5, -6]);
  for (const [dx, dy] of [
    [-3, -10],
    [1, -11],
    [3.5, -8],
    [-1, -7],
  ])
    box(ctx, dx, dy, 1, 1, '#F0D9A8');
  for (let i = 0; i < 4; i++) box(ctx, -0.5 + i * 1.6, -4.5 + i * 0.1, 0.6, 1.8, '#6E2C36');
  ctx.strokeStyle = '#C9A55A';
  ctx.lineWidth = 0.45;
  ctx.strokeRect(-0.3, -19.9, 2.6, 3);
  ctx.strokeRect(3, -19.9, 2.6, 3);
  ctx.restore();
}
/** Mila lying on her back in the snow, seen from above: arms and legs sweep out an angel. */
function milaAbove(ctx: Ctx, x: number, y: number, s: number, sweep: number, bare: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const leg = lerp(0.1, 0.55, sweep);
  for (const side of [-1, 1]) {
    const hx = side * 2.6,
      hy = 5;
    const ex = hx + Math.sin(leg) * 11 * side,
      ey = hy + Math.cos(leg) * 11;
    line(ctx, MILA.legs, 3.4, [hx, hy, ex, ey]);
    oval(ctx, ex + side * 0.4, ey + 1.2, 2.1, 2.5, MILA.shoes ?? INK);
  }
  for (const side of [-1, 1]) {
    const hand = armAbove(sweep, side);
    line(ctx, mix(MILA.coat, '#0B0E14', 0.2), 3.2, [side * 4.2, -9, hand.x, hand.y]);
    if (side === 1 && bare) disc(ctx, hand.x, hand.y, 1.6, MILA.skin);
    else disc(ctx, hand.x, hand.y, 2.2, RED);
  }
  poly(ctx, MILA.coat, [-5, -11, 5, -11, 6.5, 6, -6.5, 6]);
  box(ctx, -0.5, -10, 1, 15, mix(MILA.coat, '#0B0E14', 0.25));
  box(ctx, -5.5, -13, 11, 3, RED);
  box(ctx, 1.8, -11, 3, 7, RED_DARK);
  disc(ctx, -6.8, -17, 2.4, MILA.hair);
  disc(ctx, 6.8, -17, 2.4, MILA.hair);
  disc(ctx, 0, -18, 6, MILA.skin);
  oval(ctx, 0, -22.5, 6.8, 3.8, RED);
  box(ctx, -6.4, -21.6, 12.8, 1.8, RED_DARK);
  disc(ctx, 0, -27, 2.3, RED_DARK);
  line(ctx, INK, 0.8, [-3.3, -17.4, -2.3, -18.5, -1.3, -17.4]);
  line(ctx, INK, 0.8, [1.3, -17.4, 2.3, -18.5, 3.3, -17.4]);
  box(ctx, -1.8, -15.4, 3.6, 1.5, INK);
  box(ctx, -1.2, -15.4, 2.4, 0.6, '#FFFFFF');
  box(ctx, -4.8, -16.4, 1.6, 1, alpha('#E58A86', 0.8));
  box(ctx, 3.2, -16.4, 1.6, 1, alpha('#E58A86', 0.8));
  ctx.restore();
}
/** Hand position (in Mila-above units) for a sweep amount and side. */
function armAbove(sweep: number, side: number) {
  const arm = lerp(0.35, 2.35, sweep);
  return { x: side * 4.2 + Math.sin(arm) * 10 * side, y: -9 + Math.cos(arm) * 10 };
}

// ——— Scenery ———
function fir(ctx: Ctx, x: number, base: number, h: number, l: Light) {
  box(ctx, x - h * 0.035, base - h * 0.16, h * 0.07, h * 0.16, l.trunk);
  for (let i = 0; i < 3; i++) {
    const apex = base - h + i * h * 0.24;
    const foot = base - h * (0.52 - i * 0.2);
    const half = h * (0.15 + i * 0.09);
    const d = (foot - apex) * 0.42;
    poly(ctx, l.fir, [x, apex, x + half, foot, x - half, foot]);
    poly(ctx, l.firDark, [x, apex, x + half, foot, x + half * 0.15, foot]);
    poly(ctx, l.cap, [
      x,
      apex - 1,
      x + half * 0.52,
      apex + d,
      x + half * 0.22,
      apex + d * 0.8,
      x,
      apex + d * 1.05,
      x - half * 0.3,
      apex + d * 0.78,
      x - half * 0.56,
      apex + d,
    ]);
  }
}
function birch(ctx: Ctx, x: number, base: number, h: number, l: Light) {
  const bark = mix('#EEEAE2', l.shadow, 0.3);
  box(ctx, x - 2.5, base - h, 5, h, bark);
  box(ctx, x + 1, base - h, 1.5, h, mix(bark, l.firDark, 0.25));
  for (let i = 0; i < 7; i++)
    box(ctx, x - 2.5 + (i % 2) * 2, base - h + 6 + i * (h / 8), 2.5, 1, '#3A3438');
  line(ctx, mix(l.trunk, bark, 0.3), 1, [
    x,
    base - h * 0.62,
    x + 10,
    base - h * 0.8,
    x + 13,
    base - h * 0.86,
  ]);
  line(ctx, mix(l.trunk, bark, 0.3), 1, [x, base - h * 0.5, x - 9, base - h * 0.66]);
  box(ctx, x + 4, base - h * 0.81, 6, 1.5, l.cap);
}
function treeline(ctx: Ctx, y: number, color: string, seed: number, from: number, to: number) {
  const pts = [from, y + 40];
  for (let x = from; x < to; x += 9)
    pts.push(x, y - 2, x + 4.5, y - 10 - rand(seed + x * 0.37) * 20);
  pts.push(to, y - 2, to, y + 40);
  poly(ctx, color, pts);
}
/** A little burst of snow, 0 → 1. */
function puff(ctx: Ctx, x: number, y: number, t: number, color: string) {
  if (t <= 0 || t >= 1) return;
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + (i / 5) * Math.PI;
    disc(
      ctx,
      x + Math.cos(a) * (4 + t * 12),
      y + Math.sin(a) * (2 + t * 8),
      2.6 * (1 - t * 0.5),
      alpha(color, 0.9 * (1 - t)),
    );
  }
}

// ——— Grandma's cottage, at the edge of the woods ———
/** A whitewashed cottage under snowy thatch; `x` is the left of its walls. */
function cottage(ctx: Ctx, x: number, g: number, l: Light, seconds: number) {
  const wall = mix('#F1E8DA', l.shadow, 0.2);
  shade(ctx, x + 42, g + 1, 104, 0.18);
  for (let i = 0; i < 6; i++) {
    const t = (seconds * 0.16 + i / 6) % 1;
    disc(
      ctx,
      x + 64 + t * 18 + Math.sin(t * 6 + i) * 2,
      g - 96 - t * 46,
      2.5 + t * 6,
      alpha(mix('#F2EEF4', l.sky[1], 0.35), 0.5 * (1 - t)),
    );
  }
  box(ctx, x + 60, g - 94, 9, 20, '#D8CEC2');
  box(ctx, x + 58, g - 97, 13, 4, l.cap);
  box(ctx, x, g - 44, 84, 44, wall);
  box(ctx, x + 70, g - 44, 14, 44, mix(wall, l.shadow, 0.5));
  box(ctx, x, g - 6, 84, 6, '#4F6FA3');
  for (let i = 0; i < 14; i++) disc(ctx, x + 3 + i * 6, g - 7.5, 1, i % 2 ? '#E3A23B' : '#C8433B');
  poly(ctx, '#8A6A44', [x - 8, g - 40, x + 12, g - 76, x + 72, g - 76, x + 92, g - 40]);
  box(ctx, x - 8, g - 41, 100, 4, '#6E5234');
  poly(ctx, l.cap, [
    x - 10,
    g - 46,
    x + 10,
    g - 82,
    x + 74,
    g - 82,
    x + 94,
    g - 46,
    x + 86,
    g - 42,
    x + 78,
    g - 46,
    x + 68,
    g - 41,
    x + 56,
    g - 46,
    x + 44,
    g - 41,
    x + 32,
    g - 46,
    x + 20,
    g - 41,
    x + 8,
    g - 46,
    x - 2,
    g - 42,
  ]);
  for (const wx of [x + 8, x + 60]) {
    box(ctx, wx - 5, g - 36, 4, 18, '#3F68A6');
    box(ctx, wx + 17, g - 36, 4, 18, '#3F68A6');
    box(ctx, wx - 1, g - 36, 18, 18, '#3F68A6');
    box(ctx, wx + 1, g - 34, 14, 14, '#FFDC94');
    box(ctx, wx + 7, g - 34, 2, 14, '#3F68A6');
    box(ctx, wx + 1, g - 28, 14, 2, '#3F68A6');
    box(ctx, wx - 3, g - 18, 22, 2, l.cap);
    glow(ctx, wx + 8, g - 27, 34, '#FFC46A', 0.35);
  }
  box(ctx, x + 34, g - 38, 18, 38, '#5E3E26');
  box(ctx, x + 36, g - 36, 14, 36, '#7A5234');
  for (const dx of [40, 45]) box(ctx, x + dx, g - 36, 0.6, 36, '#5E3E26');
  box(ctx, x + 47, g - 19, 2, 2, '#D9B36A');
  oval(ctx, x + 10, g + 1, 22, 4, l.snow);
  oval(ctx, x + 76, g + 1, 18, 4, l.snow);
}
/** A woven wattle fence with snow on every stake. */
function fence(ctx: Ctx, from: number, to: number, g: number, l: Light) {
  for (let r = 0; r < 3; r++)
    box(ctx, from, g - 18 + r * 5, to - from, 3, r % 2 ? '#7A5A3C' : '#6B4E34');
  for (let x = from; x <= to; x += 9) {
    box(ctx, x, g - 23, 2, 23, '#5C4330');
    box(ctx, x - 0.5, g - 24.5, 3, 1.8, l.cap);
  }
}

// The Mila-sized world: woods on the left, the clearing, and the cottage on the right.
const EW = 680,
  GE = 150,
  FEET = 152;
const FIRS = [
  [14, 94],
  [50, 76],
  [88, 60],
  [268, 72],
  [304, 90],
  [338, 66],
  [652, 92],
] as const;
const BIRCHES = [
  [124, 72],
  [246, 60],
] as const;
const COTTAGE = 540;
const LOST = 176;
const FIR_A = { x: 372, h: 150, base: 190 };
const visible = (view: View, x: number, margin = 70) =>
  Math.abs(x - view.x) < W / 2 / view.zoom + margin;
function edgeSky(ctx: Ctx, l: Light, sun: number) {
  sky(ctx, l.sky);
  if (sun <= 0) return;
  glow(ctx, 64, 60, 130, '#FFE3B4', 0.45 * sun);
  disc(ctx, 64, 60, 9, alpha('#FFF3DC', sun));
}
function edgeWorld(ctx: Ctx, seconds: number, l: Light, view: View, cast: () => void) {
  camera(
    ctx,
    view,
    () => {
      ctx.save();
      ctx.translate((view.x - EW / 2) * 0.5, 0);
      oval(ctx, 140, 142, 280, 22, mix(l.snow, l.far, 0.3));
      oval(ctx, 560, 144, 300, 20, mix(l.snow, l.far, 0.25));
      treeline(ctx, 136, l.far, 7, -140, EW + 140);
      ctx.restore();
      box(ctx, -40, 136, EW + 80, 70, mix(l.snow, l.shadow, 0.35));
      box(ctx, -40, 143, EW + 80, 70, l.snow);
      for (const [x, h] of FIRS) if (visible(view, x)) fir(ctx, x, 146, h, l);
      for (const [x, h] of BIRCHES) if (visible(view, x)) birch(ctx, x, 148, h, l);
      if (visible(view, COTTAGE + 42, 140)) {
        cottage(ctx, COTTAGE, GE, l, seconds);
        fence(ctx, COTTAGE + 96, EW + 10, GE, l);
      }
      for (const [x, w] of [
        [150, 60],
        [330, 40],
        [450, 50],
        [230, 30],
      ])
        oval(ctx, x, 159, w, 3.5, alpha(l.shadow, 0.35));
      for (let i = 0; i < 12; i++)
        if (Math.sin(seconds * 2 + i * 1.7) > 0.75)
          box(ctx, (i * 71) % EW, 150 + ((i * 13) % 24), 1, 1, '#FFFFFF');
      cast();
    },
    { w: EW, h: H },
  );
}

// ——— Inside the cottage ———
function rushnyk(ctx: Ctx, x: number, y: number, w: number) {
  // An embroidered towel draped over the window.
  box(ctx, x, y, w, 5, '#F6F0E6');
  for (let i = 2; i < w - 2; i += 4) box(ctx, x + i, y + 2, 2, 1, '#C23A34');
  for (const ex of [x - 1, x + w - 7]) {
    box(ctx, ex, y + 2, 8, 44, '#F6F0E6');
    for (let k = 0; k < 3; k++)
      box(ctx, ex + 1, y + 30 + k * 4, 6, 2, k % 2 ? '#2F2A30' : '#C23A34');
    for (let k = 0; k < 4; k++) box(ctx, ex + 0.5 + k * 2, y + 46, 1, 3, '#F6F0E6');
  }
}
function stove(ctx: Ctx, seconds: number, flicker: number) {
  // The big whitewashed clay stove, painted with flowers, with the fire in its mouth.
  box(ctx, 2, 50, 96, 5, '#B89A78');
  box(ctx, 18, 41, 8, 9, '#A0583A');
  box(ctx, 70, 44, 11, 6, '#6E7F8C');
  box(ctx, 10, 55, 80, 8, '#EFE3CF');
  box(ctx, 6, 60, 88, 86, '#EFE3CF');
  box(ctx, 82, 55, 12, 91, '#D9C7AB');
  box(ctx, 6, 140, 88, 6, '#CDBB9F');
  box(ctx, 26, 112, 36, 28, '#2E1A12');
  oval(ctx, 44, 113, 18, 9, '#2E1A12');
  glow(ctx, 44, 128, 32, '#FF8A3A', 0.6 + flicker * 3);
  box(ctx, 30, 136, 28, 3, '#4A2A1A');
  for (let i = 0; i < 3; i++) {
    const fx = 34 + i * 10,
      fh = 13 + Math.sin(seconds * 9 + i * 2.1) * 3;
    poly(ctx, '#F28A2E', [fx - 5, 137, fx, 137 - fh, fx + 5, 137]);
    poly(ctx, '#FFD36A', [fx - 2.5, 137, fx, 137 - fh * 0.55, fx + 2.5, 137]);
  }
  for (const [x, y, c] of [
    [20, 76, '#C8433B'],
    [32, 70, '#3F68A6'],
    [44, 78, '#C8433B'],
    [58, 70, '#E3A23B'],
    [70, 77, '#3F68A6'],
  ] as const) {
    box(ctx, x - 0.5, y + 2, 1, 6, '#4E7A4A');
    disc(ctx, x, y, 2.2, c);
    disc(ctx, x, y, 0.8, '#F6E7B8');
  }
}
function cottageDoor(ctx: Ctx, open: number, seconds: number) {
  box(ctx, 262, 64, 42, 82, '#5A3A26');
  if (open > 0) {
    // The cold, bright morning outside.
    box(ctx, 266, 68, 34, 78, '#D3E3F4');
    box(ctx, 266, 126, 34, 20, '#F4F8FC');
    poly(ctx, '#7F9CB2', [276, 124, 283, 96, 290, 124]);
    for (let i = 0; i < 10; i++) {
      const t = (seconds * 0.7 + i / 10) % 1;
      box(ctx, 300 - t * 70, 76 + ((i * 23) % 60) + t * 14, 1, 1, alpha('#FFFFFF', open * (1 - t)));
    }
    glow(ctx, 283, 112, 70, '#CFE3F8', 0.45 * open);
    poly(ctx, alpha('#E6F0FA', 0.3 * open), [266, 146, 300, 146, 262, 176, 196, 176]);
  }
  const leaf = lerp(34, 6, open);
  box(ctx, 300 - leaf, 68, leaf, 78, '#8A5E3A');
  if (leaf > 12) {
    for (let k = 1; k < 4; k++) box(ctx, 300 - leaf + (leaf / 4) * k, 68, 0.6, 78, '#6E4A2E');
    box(ctx, 300 - leaf + 2, 86, leaf - 4, 3, '#6E4A2E');
    box(ctx, 300 - leaf + 2, 124, leaf - 4, 3, '#6E4A2E');
    box(ctx, 300 - leaf + 4, 104, 2, 3, '#D9B36A');
  }
}
function rockingChair(ctx: Ctx, x: number) {
  const wood = '#6B4128';
  box(ctx, x - 12, 84, 3, 58, wood);
  for (let i = 0; i < 3; i++) box(ctx, x - 12, 94 + i * 10, 5, 2, wood);
  box(ctx, x - 12, 128, 26, 4, wood);
  box(ctx, x - 12, 114, 22, 2, wood);
  box(ctx, x + 8, 114, 3, 16, wood);
  box(ctx, x - 10, 132, 2, 11, wood);
  box(ctx, x + 10, 132, 2, 11, wood);
  line(ctx, wood, 2.5, [x - 22, 140, x - 10, 145, x + 10, 145, x + 22, 141]);
}
function interior(ctx: Ctx, p: number, seconds: number) {
  const open = ease(span(p, 0.06, 0.066));
  const flicker = Math.sin(seconds * 7) * 0.02 + Math.sin(seconds * 13) * 0.015;
  box(ctx, 0, 0, W, H, '#DCC6A4');
  glow(ctx, 50, 120, 220, '#FFB566', 0.4 + flicker);
  box(ctx, 0, 0, W, 17, '#5A3A27');
  for (const x of [30, 110, 190, 270]) box(ctx, x, 0, 12, 20, '#46301F');
  box(ctx, 0, 17, W, 2, '#46301F');
  box(ctx, 0, 146, W, 34, '#76503A');
  for (let y = 152; y < H; y += 7) box(ctx, 0, y, W, 1, '#664430');
  oval(ctx, 150, 162, 74, 9, '#9C3A34');
  oval(ctx, 150, 162, 66, 7, '#C8604A');
  for (let i = -3; i <= 3; i++) box(ctx, 150 + i * 16 - 2, 160, 4, 4, '#F0D9A8');
  // The window onto the snowy woods, and the embroidered towel over it.
  box(ctx, 150, 46, 50, 48, '#3F68A6');
  ctx.save();
  ctx.beginPath();
  ctx.rect(154, 50, 42, 40);
  ctx.clip();
  box(ctx, 154, 50, 42, 40, '#BCD2EC');
  box(ctx, 154, 74, 42, 16, '#EEF3FA');
  for (const [fx, fh] of [
    [160, 22],
    [172, 16],
    [188, 26],
  ])
    poly(ctx, '#5E7F8C', [fx, 76 - fh, fx + 6, 77, fx - 6, 77]);
  for (let i = 0; i < 8; i++)
    box(
      ctx,
      154 + ((i * 11 + seconds * 4) % 42),
      50 + ((i * 17 + seconds * 9) % 40),
      1,
      1,
      '#FFFFFF',
    );
  ctx.restore();
  box(ctx, 173, 50, 4, 40, '#3F68A6');
  box(ctx, 154, 68, 42, 3, '#3F68A6');
  glow(ctx, 175, 70, 46, '#CFE0F6', 0.25);
  box(ctx, 146, 94, 58, 4, '#C9AE86');
  rushnyk(ctx, 142, 42, 66);
  cottageDoor(ctx, open, seconds);
  stove(ctx, seconds, flicker);
  // The yarn basket.
  box(ctx, 132, 136, 18, 10, '#9A7248');
  for (let k = 0; k < 4; k++) box(ctx, 133 + k * 4.5, 136, 1, 10, '#7E5A36');
  disc(ctx, 136, 134, 3, '#3F6DB3');
  disc(ctx, 142, 133, 4, RED);

  // Grandma rocks and knits, finishes, holds up the pair, and hands them over.
  const GX = 104;
  const finished = span(p, 0.029, 0.034);
  const holding = p >= 0.029 && p < 0.042;
  const arms: [number, number] =
    p < 0.029
      ? [0.95 + Math.sin(seconds * 12) * 0.05, 1.25 - Math.sin(seconds * 12) * 0.05]
      : p < 0.034
        ? [lerp(0.95, 1.9, ease(finished)), lerp(1.25, 2.2, ease(finished))]
        : p < 0.042
          ? [1.45, 1.65]
          : p < 0.062
            ? [0.7, 0.9]
            : [0.6, 2.5 + Math.sin(seconds * 9) * 0.3];
  const g: Partial<Figure> = {
    size: 1.7,
    facing: 1,
    sitting: true,
    arms,
    eyes: p < 0.029 ? 'sleepy' : 'happy',
    mouth: p < 0.029 ? 'smile' : p < 0.042 ? 'grin' : 'smile',
  };
  ctx.save();
  ctx.translate(GX, 146);
  ctx.rotate(Math.sin(seconds * 1.6) * 0.035);
  ctx.translate(-GX, -146);
  rockingChair(ctx, GX);
  granny(ctx, GX, 129, g);
  box(ctx, GX + 15, 120, 8, 23, GRAN.coat);
  box(ctx, GX + 16, 142, 8, 3, GRAN.shoes ?? INK);
  const fig: Figure = { ...GRAN, ...g };
  const a = handOf(GX, 129, fig, 'back'),
    b = handOf(GX, 129, fig, 'front');
  if (p < 0.029) {
    const click = Math.sin(seconds * 12);
    mittenIcon(ctx, (a.x + b.x) / 2 + 3, (a.y + b.y) / 2 + 9, 1.25, 0.15);
    line(ctx, '#D6D0C0', 0.8, [a.x - 1, a.y + 1, a.x + 9, a.y - 8 + click]);
    line(ctx, '#D6D0C0', 0.8, [b.x - 2, b.y + 1.5, b.x + 10, b.y - 5 - click]);
    line(ctx, RED, 0.5, [(a.x + b.x) / 2 + 3, (a.y + b.y) / 2 + 12, 136, 140, 142, 133]);
  } else if (holding) {
    mittenIcon(ctx, a.x, a.y - 2, 1.5, -0.2);
    mittenIcon(ctx, b.x + 1, b.y - 2, 1.5, 0.15);
  }
  ctx.restore();

  // Mila watches, reaches, wiggles her new mittens, and is out of the door.
  const on = p >= 0.042;
  if (p < 0.058) {
    const reach = p >= 0.034;
    const x = reach ? lerp(176, 164, ease(span(p, 0.034, 0.039))) : 176;
    const wig = Math.sin(seconds * 14) * 0.25;
    const hop = on ? Math.abs(Math.sin(seconds * 9)) * 2 : 0;
    shade(ctx, x, 146, 20);
    mila(
      ctx,
      x,
      146 - hop,
      {
        size: 1.7,
        facing: -1,
        arms: on ? [-1.8 + wig, 1.9 - wig] : reach ? [1.3, 1.5] : [0.2, 0.3],
        eyes: on ? 'happy' : reach || p > 0.03 ? 'wide' : 'open',
        mouth: on || reach ? 'grin' : p > 0.03 ? 'o' : 'smile',
      },
      { front: on, back: on },
    );
  } else {
    const run = span(p, 0.058, 0.074);
    const x = lerp(164, 292, easeIn(run) * 0.4 + run * 0.6);
    faded(ctx, 1 - span(p, 0.069, 0.074), () =>
      mila(ctx, x, 146, { size: 1.7, facing: 1, step: seconds * 16, eyes: 'happy', mouth: 'grin' }),
    );
  }
}

// ——— In the woods: a snow angel, and a mitten that slips away ———
const ANGEL = { x: 160, y: 98, s: 2.1 };
const REST = { x: 238, y: 58 };
const sweepAt = (p: number) => 0.5 - 0.5 * Math.cos(span(p, 0.095, 0.124) * 3.5 * TAU);
const duskAt = (p: number) => ease(span(p, 0.108, 0.14));
/** A fir seen from straight above. */
function crown(ctx: Ctx, x: number, y: number, r: number, l: Light) {
  spiky(ctx, x, y, r * 0.7, r, 9, l.firDark);
  spiky(ctx, x, y, r * 0.5, r * 0.75, 9, l.fir);
  disc(ctx, x - r * 0.2, y - r * 0.2, r * 0.3, l.cap);
  disc(ctx, x + r * 0.3, y + r * 0.15, r * 0.18, l.cap);
}
function angelPrint(ctx: Ctx, amount: number, l: Light) {
  faded(ctx, amount, () => {
    ctx.save();
    ctx.translate(ANGEL.x, ANGEL.y);
    ctx.scale(ANGEL.s, ANGEL.s);
    const c = mix(l.shadow, l.snow, 0.25);
    for (const side of [-1, 1]) {
      const pts = [side * 4, -9];
      for (let a = 0.2; a <= 2.56; a += 0.26)
        pts.push(side * 4 + Math.sin(a) * 15 * side, -9 + Math.cos(a) * 15);
      poly(ctx, c, pts);
    }
    const skirt = [0, 2];
    for (let a = -0.72; a <= 0.73; a += 0.18) skirt.push(Math.sin(a) * 17, 4 + Math.cos(a) * 17);
    poly(ctx, c, skirt);
    oval(ctx, 0, -5, 8, 13, c);
    disc(ctx, 0, -20, 8.5, c);
    ctx.restore();
  });
}
const OVERHEAD_CAMERA = [
  [0.093, 164, 92, 1.0],
  [0.125, 170, 88, 1.28],
] as const;
function overhead(ctx: Ctx, p: number) {
  const l = blend(DAY, DUSK, duskAt(p));
  camera(ctx, track(p, OVERHEAD_CAMERA), () => {
    box(ctx, -20, -20, W + 40, H + 40, l.snow);
    for (let i = 0; i < 9; i++)
      oval(
        ctx,
        rand(i * 3.3) * W,
        rand(i * 5.1) * H,
        30 + rand(i + 0.5) * 40,
        4 + rand(i * 2.2) * 4,
        alpha(l.shadow, 0.3),
      );
    // Her footprints lead in from the corner.
    for (let i = 0; i < 10; i++) {
      const t = i / 10;
      oval(
        ctx,
        lerp(330, 196, t) + (i % 2 ? 3 : -3),
        lerp(-8, 66, t),
        1.8,
        2.6,
        alpha(l.shadow, 0.9),
      );
    }
    crown(ctx, 8, 14, 38, l);
    crown(ctx, 312, 172, 44, l);
    crown(ctx, 296, 12, 24, l);
    angelPrint(ctx, span(p, 0.095, 0.11), l);
    if (p >= SLIP) {
      // Flung off on an upswing, the mitten tumbles away into the snow. She never notices.
      const t = span(p, SLIP, PLOP);
      const from = armAbove(sweepAt(SLIP), 1);
      const fx = ANGEL.x + from.x * ANGEL.s,
        fy = ANGEL.y + from.y * ANGEL.s;
      const lift = Math.sin(t * Math.PI);
      const mx = lerp(fx, REST.x, t),
        my = lerp(fy, REST.y, t);
      if (t < 1) oval(ctx, mx + lift * 4, my + 3, 5, 2.5, alpha(l.shadow, 0.6));
      mittenIcon(ctx, mx, my - lift * 14, 2 + lift * 0.8, 0.6 + t * 5.2);
      const ring = span(p, PLOP, PLOP + 0.006);
      if (ring > 0 && ring < 1) {
        ctx.strokeStyle = alpha(WOOL, 1 - ring);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(REST.x, REST.y, 6 + ring * 12, 3 + ring * 6, 0, 0, TAU);
        ctx.stroke();
      }
    }
    milaAbove(ctx, ANGEL.x, ANGEL.y, ANGEL.s, sweepAt(p), p >= SLIP);
  });
}
function woodsShots(ctx: Ctx, p: number, seconds: number) {
  if (p >= 0.093 && p < 0.125) {
    overhead(ctx, p);
    vignette(ctx, 0.35);
    return;
  }
  const dusk = duskAt(p);
  const l = blend(DAY, DUSK, dusk);
  edgeSky(ctx, l, 0);
  glow(ctx, 300, 150, 170, '#FFB07A', dusk * 0.4);
  edgeWorld(ctx, seconds, l, track(p, EDGE_CAMERA), () => {
    if (p < 0.093) {
      // She runs into the clearing and flops backwards into the deep snow.
      const run = span(p, 0.08, 0.088),
        flop = easeIn(span(p, 0.088, 0.093));
      const x = lerp(262, 198, easeOut(run));
      shade(ctx, x, FEET, 18);
      ctx.save();
      ctx.translate(x, FEET);
      ctx.rotate(flop * Math.PI * 0.5);
      mila(ctx, 0, 0, {
        size: 1.45,
        facing: -1,
        step: run < 1 ? seconds * 16 : undefined,
        arms: run < 1 ? undefined : [-2.4, 1.6],
        eyes: 'happy',
        mouth: 'grin',
      });
      ctx.restore();
      puff(ctx, x + 22, FEET - 2, span(p, 0.091, 0.1), l.cap);
      return;
    }
    // Dusk: up she jumps and runs home, one hand bare. The mitten stays behind.
    mittenIcon(ctx, LOST, FEET - 1, 0.85, 1.5);
    oval(ctx, LOST + 1, FEET + 1.5, 7, 1.8, l.snow);
    const x = lerp(202, 350, easeIn(span(p, 0.127, 0.141)));
    shade(ctx, x, FEET, 18);
    mila(
      ctx,
      x,
      FEET,
      { size: 1.45, facing: 1, step: seconds * 16, eyes: 'happy', mouth: 'grin' },
      { front: false, back: true },
    );
  });
  vignette(ctx, 0.4);
}

// ——— The hollow: the forest floor at mouse height, where the mitten lies ———
const HW = 440,
  G = 148,
  MX = 200;
function trunk(ctx: Ctx, x: number, w: number, l: Light) {
  box(ctx, x - w / 2, -60, w, G + 58, l.trunk);
  box(ctx, x - w / 2, -60, 2, G + 58, mix(l.trunk, l.cap, 0.25));
  box(ctx, x + w * 0.15, -60, w * 0.35, G + 58, mix(l.trunk, '#000000', 0.25));
  for (let i = 0; i < 9; i++)
    box(
      ctx,
      x - w / 2 + 3 + ((i * 7) % (w - 6)),
      8 + i * 15,
      1.5,
      7,
      mix(l.trunk, '#000000', 0.35),
    );
  oval(ctx, x, G - 1, w * 0.85, 5, l.trunk);
  oval(ctx, x - w * 0.3, G, w * 0.5, 3, l.snow);
}
function bough(ctx: Ctx, x: number, y: number, len: number, droop: number, l: Light) {
  const d = Math.sign(len),
    L = Math.abs(len);
  poly(ctx, l.fir, [
    x,
    y,
    x + d * L * 0.5,
    y + droop * 0.35,
    x + d * L,
    y + droop,
    x + d * L * 0.84,
    y + droop + 5,
    x + d * L * 0.62,
    y + droop * 0.62 + 6,
    x + d * L * 0.34,
    y + droop * 0.3 + 8,
    x,
    y + 9,
  ]);
  poly(ctx, l.cap, [
    x,
    y - 1.5,
    x + d * L * 0.5,
    y + droop * 0.35 - 2,
    x + d * L * 0.97,
    y + droop - 1,
    x + d * L * 0.7,
    y + droop * 0.55 + 0.5,
    x + d * L * 0.4,
    y + droop * 0.3 + 1.5,
    x,
    y + 2,
  ]);
}
function snowbank(ctx: Ctx, l: Light) {
  oval(ctx, 392, G + 4, 54, 26, mix(l.snow, l.shadow, 0.35));
  oval(ctx, 386, G + 2, 50, 24, l.snow);
  oval(ctx, 376, G - 12, 26, 6, mix(l.snow, '#FFFFFF', 0.3));
}
const flareAt = (p: number) => 1 + ease(span(p, FLAKE_LANDS + 0.004, ACHOO)) * 0.35;
/** One snowflake, drifting down through the stillness onto the bear's nose. */
function flakeFall(ctx: Ctx, p: number, seconds: number) {
  if (p < HUSH || p >= ACHOO) return;
  const n = bearNose(cuffOf(mittState(p).h));
  const nx = MX + n.x,
    ny = G + n.y - 2.6 * flareAt(p);
  const t = span(p, HUSH + 0.004, FLAKE_LANDS);
  const x = lerp(188, nx, ease(t)) + Math.sin(t * 11) * 5 * (1 - t);
  const y = lerp(50, ny, t);
  glow(ctx, x, y, 6, '#DDEBFF', 0.5);
  snowflake(ctx, x, y, 1.3, t < 1 ? seconds * 0.8 : 0.4);
}
/** Whoever is arriving, on the snow; `door` is where they vanish into the cuff. */
function arrivals(ctx: Ctx, p: number, seconds: number, door: number) {
  const through = (paint: () => void) => clipX(ctx, -400, door, paint);
  if (within(p, 0.176, MOUSE_IN)) {
    // A shivering mouse, a sniff, and a dive.
    const run = span(p, 0.176, 0.19),
      dive = span(p, 0.197, MOUSE_IN);
    const shiver = run >= 1 && dive === 0 ? Math.sin(seconds * 55) * 0.35 : 0;
    const x = lerp(146, 182, easeOut(run)) + easeIn(dive) * 18 + shiver;
    through(() =>
      mouse(ctx, x, G, { step: run < 1 || dive > 0 ? seconds * 26 : undefined, mood: 'wide' }),
    );
    if (shiver) {
      line(ctx, alpha('#E4EEFA', 0.8), 0.4, [x - 15, G - 9, x - 17, G - 7]);
      line(ctx, alpha('#E4EEFA', 0.8), 0.4, [x - 15, G - 4, x - 17, G - 3]);
      line(ctx, alpha('#E4EEFA', 0.8), 0.4, [x + 11, G - 11, x + 13, G - 13]);
    }
  }
  if (within(p, 0.222, HOG_IN)) {
    // A hedgehog knocks, pat pat, and asks.
    const walk = span(p, 0.222, 0.236),
      dive = span(p, 0.252, HOG_IN);
    const pat = Math.max(hump(p, 0.237, 0.241), hump(p, 0.242, 0.246));
    const x = lerp(132, 177, easeOut(walk)) + easeIn(dive) * 20;
    through(() =>
      hedgehog(ctx, x, G, {
        step: walk < 1 || dive > 0 ? seconds * 18 : undefined,
        pat,
        mood: p > 0.248 && dive === 0 ? 'cosy' : 'look',
      }),
    );
  }
  if (within(p, 0.285, RABBIT_IN)) {
    // A rabbit bounds in from the far side, clean over the mitten.
    let x = 300,
      y = G,
      hop = 0;
    for (const [a, b, x0, x1, height] of [
      [0.287, 0.297, 300, 262, 10],
      [0.299, 0.309, 262, 238, 8],
      [0.311, 0.324, 238, 172, 34],
    ])
      if (p >= a) {
        const t = span(p, a, b);
        x = lerp(x0, x1, t);
        y = G - Math.sin(t * Math.PI) * height;
        hop = t < 1 ? Math.sin(t * Math.PI) : 0;
      }
    const dive = span(p, 0.331, RABBIT_IN);
    x += easeIn(dive) * 22;
    const paint = () =>
      rabbit(ctx, x, y, { facing: p >= 0.327 ? 1 : -1, hop, mood: 'look', ears: dive * 0.9 });
    if (dive > 0) through(paint);
    else paint();
  }
  if (within(p, 0.355, FOX_IN)) {
    // The fox: out from behind the tree, a sly bow, and in it curls.
    let x: number,
      bow = 0,
      walking: boolean;
    if (p < 0.385) {
      const out = span(p, 0.357, 0.371);
      x = lerp(50, 112, ease(out));
      walking = out > 0 && out < 1;
    } else {
      const a = span(p, 0.385, 0.396),
        b = span(p, 0.411, 0.424);
      x = lerp(112, 150, ease(a)) + ease(b) * 28;
      walking = (a > 0 && a < 1) || (b > 0 && b < 1);
      bow = hump(p, 0.397, 0.41);
    }
    const dive = span(p, 0.427, FOX_IN);
    x += easeIn(dive) * 34;
    const paint = () =>
      fox(ctx, x, G, {
        step: walking || dive > 0 ? seconds * 12 : undefined,
        bow,
        mood: bow > 0.3 ? 'cosy' : 'sly',
        swish: Math.sin(seconds * 2.5),
      });
    if (p < 0.372) clipX(ctx, 77, 1000, paint);
    else if (dive > 0) through(paint);
    else paint();
  }
  if (within(p, 0.505, 0.572)) {
    if (p < 0.542) {
      const walk = span(p, 0.505, 0.53);
      const x = lerp(10, 112, walk);
      shade(ctx, x + 4, G + 1, 70, 0.3);
      bear(ctx, x, G, { pose: 'walk', step: walk < 1 ? seconds * 5 : undefined, mood: 'look' });
    } else {
      shade(ctx, 114, G + 1, 50, 0.3);
      bear(ctx, 112, G, {
        pose: 'sit',
        rub: Math.sin(seconds * 8) * 1.2,
        mood: p > 0.556 ? 'cosy' : 'look',
        tilt: -hump(p, 0.55, 0.57) * 0.18,
      });
    }
  }
  if (within(p, 0.572, BEAR_IN)) {
    // The bear squeezes in head first: three shoves, and his back legs paddling air.
    const shoves = SHOVES.filter((t) => p >= t).length;
    const last = shoves ? SHOVES[shoves - 1] : 0.572;
    const push = shoves ? backOut(span(p, last, last + 0.004)) : ease(span(p, 0.572, 0.575));
    const x = door - 30 + shoves * 5 + push * 2;
    through(() => bear(ctx, x, G, { pose: 'push', kick: seconds * 14 }));
  }
}
function mittenScene(ctx: Ctx, p: number, seconds: number) {
  const m = mittState(p);
  const jolt = STOMPS.reduce((a, t) => Math.max(a, hump(p, t, t + 0.007)), 0) * 3;
  if (m.warm > 0)
    oval(ctx, MX - 8, G + 1, 12 + m.h * 0.6, 2 + m.h * 0.05, alpha('#FFB06A', m.warm * 0.45));
  shade(ctx, MX + m.w * 0.5, G + 1, m.w + 8, 0.32);
  const door = MX + cuffOf(m.h).ox;
  drawMitten(ctx, MX, G - jolt, m, p, seconds, () => arrivals(ctx, p, seconds, door));
  // The bear's shadow falls across the cuff.
  if (within(p, 0.528, 0.542))
    oval(
      ctx,
      lerp(MX - 60, MX - 14, ease(span(p, 0.528, 0.54))),
      G - 26,
      40,
      34,
      alpha('#04060C', 0.4),
    );
}
/** ACHOO: everyone goes flying, and the mitten, back to its own size, shoots off over the trees. */
function scatter(ctx: Ctx, p: number, seconds: number, l: Light) {
  const u = (d: number) => span(p, ACHOO, ACHOO + d);
  const burst = u(0.012);
  if (burst < 1)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU,
        r = 8 + easeOut(burst) * 70;
      disc(
        ctx,
        MX + 50 + Math.cos(a) * r * 1.3,
        G - 34 + Math.sin(a) * r * 0.7,
        2.6 * (1 - burst) + 0.4,
        alpha(l.cap, 1 - burst),
      );
    }
  const um = u(0.018);
  mouse(ctx, lerp(MX - 4, 112, um), lerp(G - 24, 35, um) - Math.sin(um * Math.PI) * 40, {
    facing: -1,
    rot: um < 1 ? um * 14 : 0,
    mood: um < 1 ? 'wide' : 'dizzy',
  });
  if (um >= 1) dizzy(ctx, 110, 22, seconds);
  const uh = u(0.026);
  if (p < ACHOO + 0.03)
    hedgehog(
      ctx,
      lerp(MX - 6, 112, easeOut(uh)),
      G - Math.abs(Math.sin(uh * Math.PI * 3)) * 9 * (1 - uh),
      { roll: -uh * 22 },
    );
  else {
    hedgehog(ctx, 112, G, { mood: 'dizzy' });
    dizzy(ctx, 114, G - 13, seconds);
  }
  const ur = u(0.02);
  rabbit(ctx, lerp(MX + 2, 284, ur), lerp(G - 20, G + 10, ur) - Math.sin(ur * Math.PI) * 30, {
    rot: ur < 1 ? ur * TAU * 2 : 0,
    mood: ur < 1 ? 'wide' : 'dizzy',
    ears: ur < 1 ? 0.8 : -0.4,
  });
  if (ur >= 1) dizzy(ctx, 292, G - 16, seconds);
  const uf = u(0.022);
  fox(ctx, lerp(MX + 24, 318, uf), lerp(G - 16, G + 6, uf) - Math.sin(uf * Math.PI) * 52, {
    facing: -1,
    rot: uf < 1 ? uf * TAU * 3 : 0,
    mood: uf < 1 ? 'wide' : 'dizzy',
  });
  if (uf >= 1) dizzy(ctx, 306, G - 18, seconds);
  const mf = u(0.024);
  if (mf < 1)
    mittenAlone(ctx, lerp(MX + 14, MX + 120, mf), lerp(G - 10, -40, easeOut(mf)), mf * 9, 1.1);
}
function scatterBear(ctx: Ctx, p: number, seconds: number) {
  const ub = span(p, ACHOO, ACHOO + 0.017);
  if (ub < 1)
    bear(
      ctx,
      lerp(MX + 40, 366, easeOut(ub)),
      lerp(G - 20, G - 10, ub) - Math.sin(ub * Math.PI) * 40,
      {
        pose: 'walk',
        rot: ub * 2.8,
        mood: 'wide',
      },
    );
  else bear(ctx, 368, G - 12, { pose: 'bank', kick: seconds * 7 });
}
function hollowWorld(ctx: Ctx, p: number, seconds: number, l: Light, view: View) {
  // Distant trunks drift slower than the hollow.
  ctx.save();
  ctx.translate((view.x - HW / 2) * 0.55, 0);
  for (let i = 0; i < 16; i++) {
    const x = -70 + i * 38 + rand(i * 1.7) * 18,
      w = 3 + rand(i * 2.9) * 7;
    box(ctx, x, -60, w, 182, mix(l.far, l.sky[1], 0.3));
  }
  ctx.restore();
  box(ctx, -80, 119, HW + 160, 50, mix(l.snow, l.far, 0.45));
  for (const [x, w] of [
    [40, 70],
    [220, 90],
    [400, 80],
  ])
    oval(ctx, x, 121, w, 4, mix(l.snow, l.far, 0.3));
  trunk(ctx, 62, 30, l);
  trunk(ctx, 404, 24, l);
  bough(ctx, 70, 6, 150, 18, l);
  bough(ctx, 74, 34, 118, 14, l);
  bough(ctx, 60, 58, 70, 10, l);
  bough(ctx, 392, 22, -64, 12, l);
  box(ctx, -80, G - 3, HW + 160, 60, l.snow);
  for (const [x, y, w] of [
    [90, G + 6, 50],
    [300, G + 3, 60],
    [180, G + 18, 70],
  ]) {
    oval(ctx, x, y + 1.5, w, 3.5, alpha(l.shadow, 0.5));
    oval(ctx, x, y, w * 0.9, 3, mix(l.snow, '#FFFFFF', 0.2));
  }
  for (const x of [128, 132, 256, 262, 318])
    line(ctx, mix('#6E5A40', l.far, 0.4), 0.6, [x, G + 1, x - 1 + (x % 3), G - 7 - (x % 5)]);
  if (p >= ACHOO) scatterBear(ctx, p, seconds);
  snowbank(ctx, l);
  if (p < ACHOO) mittenScene(ctx, p, seconds);
  else {
    scatter(ctx, p, seconds, l);
    puff(ctx, 368, G - 24, span(p, ACHOO + 0.017, ACHOO + 0.027), l.cap);
  }
  // Snow shaken off the boughs by the bear's footsteps.
  STOMPS.forEach((t, i) => {
    const cx = [132, 168, 108][i],
      top = [38, 20, 40][i];
    const fall = span(p, t, t + 0.012);
    if (fall > 0 && fall < 1) disc(ctx, cx, lerp(top, G - 2, easeIn(fall)), 2.4, l.cap);
    puff(ctx, cx, G - 1, span(p, t + 0.012, t + 0.02), l.cap);
  });
  flakeFall(ctx, p, seconds);
  oval(ctx, 60, 186, 80, 14, mix(l.snow, '#FFFFFF', 0.15));
  oval(ctx, 330, 190, 100, 16, mix(l.snow, '#FFFFFF', 0.15));
}
function lettering(ctx: Ctx, p: number) {
  const say = (text: string, from: number, x: number, y: number, size: number) =>
    faded(ctx, presence(p, from, ACHOO, 0.003), () =>
      write(ctx, text, x, y, {
        size,
        type: 'italic',
        color: '#F4F0E4',
        shadow: alpha('#05080F', 0.8),
      }),
    );
  say('ah...', AH[0], 92, 58, 10);
  say('ah...!', AH[1], 158, 40, 13);
  const boom = presence(p, ACHOO, ACHOO + 0.022, 0.003);
  if (boom <= 0) return;
  const pop = 1 + (1 - easeOut(span(p, ACHOO, ACHOO + 0.006))) * 0.5;
  ctx.save();
  ctx.globalAlpha = boom;
  ctx.translate(132, 60);
  ctx.rotate(-0.08);
  ctx.scale(pop, pop);
  write(ctx, 'ACHOO!', 0, 0, { size: 24, type: 'serif', color: '#FFF6E0', shadow: '#241C22' });
  ctx.restore();
}
// Camera keyframes: [p, x, y, zoom].
const HOLLOW_CAMERA = [
  [0.14, 222, 102, 1.25],
  [0.176, 214, 116, 1.7],
  [0.176, 186, 132, 3.3],
  [MOUSE_IN, 190, 134, 3.3],
  [0.222, 196, 136, 3.8],
  [0.222, 184, 128, 2.8],
  [0.285, 190, 128, 2.8],
  [0.285, 212, 118, 2.2],
  [0.355, 214, 118, 2.2],
  [0.355, 88, 124, 2.8],
  [0.372, 104, 124, 2.8],
  [0.372, 197, 128, 4.6],
  [0.385, 197, 128, 4.8],
  [0.385, 180, 124, 2.3],
  [FOX_IN, 196, 124, 2.3],
  [0.49, 214, 112, 1.6],
  [0.528, 214, 112, 1.6],
  [0.528, 197, 124, 4.2],
  [0.542, 197, 124, 4.4],
  [0.542, 116, 104, 1.9],
  [0.572, 122, 100, 2.0],
  [0.572, 236, 104, 1.2],
  [BEAR_IN, 238, 102, 1.2],
  [HUSH, 242, 98, 1.14],
  [HUSH, 178, 80, 3.4],
  [FLAKE_LANDS, 174, 100, 3.8],
  [ACHOO, 172, 103, 4.6],
  [ACHOO, 252, 90, 1.05],
  [FLIGHT, 252, 88, 1.0],
] as const;
function hollowShots(ctx: Ctx, p: number, seconds: number) {
  const night = ease(span(p, 0.14, 0.2));
  const l = blend(DUSK, NIGHT, night);
  const view = track(p, HOLLOW_CAMERA);
  sky(ctx, l.sky);
  faded(ctx, night, () =>
    starfield(ctx, seconds, { count: 44, seed: 3, bottom: 110, colors: ['#FFF4D0', '#B8C8EA'] }),
  );
  const moonY = 44 - night * 14;
  glow(ctx, 258, moonY, 70, '#C9DAFF', 0.12 + night * 0.22);
  disc(ctx, 258, moonY, 12, mix('#F2D2B4', '#F4F2E4', night));
  disc(ctx, 254, moonY - 3, 2.4, alpha('#D6D2C2', 0.8));
  disc(ctx, 262, moonY + 4, 1.7, alpha('#D6D2C2', 0.8));
  camera(ctx, view, () => hollowWorld(ctx, p, seconds, l, view), { w: HW, h: H });
  const fall = p < HUSH ? 0.2 + span(p, 0.15, 0.22) * 0.3 : p < ACHOO ? 0 : 0.3;
  if (fall > 0) snowfall(ctx, seconds, { amount: fall, color: '#E4ECF8', speed: 12 });
  lettering(ctx, p);
  vignette(ctx, 0.5, '#05080F');
}

// ——— Over the treetops, from night into dawn ———
function treeTops(
  ctx: Ctx,
  scroll: number,
  base: number,
  size: number,
  color: string,
  cap: string,
  seed: number,
) {
  const gap = size * 1.3,
    loop = W + gap * 2;
  for (let i = 0; i < Math.ceil(loop / gap); i++) {
    const x = ((((i * gap - scroll) % loop) + loop) % loop) - gap;
    const h = size * (1.3 + rand(seed + i) * 0.8);
    poly(ctx, color, [x, base - h, x + size * 0.55, base, x - size * 0.55, base]);
    poly(ctx, cap, [
      x,
      base - h - 1,
      x + size * 0.22,
      base - h * 0.6,
      x,
      base - h * 0.66,
      x - size * 0.22,
      base - h * 0.58,
    ]);
  }
  box(ctx, 0, base - 2, W, H - base + 2, color);
}
function flightShot(ctx: Ctx, p: number, seconds: number) {
  const t = span(p, FLIGHT, 0.777);
  const dawn = ease(span(p, FLIGHT + 0.002, 0.777));
  sky(
    ctx,
    NIGHT.sky.map((c, i) => mix(c, DAWN_SKY[i], dawn)),
  );
  faded(ctx, 1 - dawn, () => starfield(ctx, seconds, { count: 40, seed: 5, bottom: 120 }));
  faded(ctx, 1 - dawn * 0.7, () => {
    glow(ctx, 62, 34 + dawn * 40, 50, '#C9DAFF', 0.3);
    disc(ctx, 62, 34 + dawn * 40, 11, '#F3F0DE');
  });
  glow(ctx, 280, 190, 190, '#FFC98E', dawn * 0.55);
  const cap = mix(NIGHT.cap, '#F4E6E4', dawn);
  treeTops(ctx, t * 160, 140, 14, mix(NIGHT.far, '#8C8AB0', dawn), cap, 3);
  treeTops(ctx, t * 440, 182, 36, mix(NIGHT.fir, '#3A4A5E', dawn), cap, 9);
  const mx = lerp(40, 290, t),
    my = 86 - Math.sin(t * Math.PI) * 40 + t * t * 26;
  for (let i = 1; i <= 3; i++)
    box(ctx, mx - 14 - i * 9, my - 5 + i * 3, 11 - i * 2, 1, alpha(WOOL, 0.4));
  mittenAlone(ctx, mx, my, t * 10, 1.5);
  vignette(ctx, 0.45, '#05080F');
}

// ——— Next morning ———
const EDGE_CAMERA = [
  [0, 573, 108, 1.5],
  [0.018, 556, 122, 2.3],
  [0.08, 228, 114, 1.8],
  [0.093, 214, 118, 1.95],
  [0.125, 212, 112, 1.6],
  [0.14, 220, 110, 1.55],
  [0.777, 206, 116, 2.2],
  [0.817, 200, 118, 2.3],
  [0.817, 190, 124, 3.4],
  [0.868, 188, 123, 3.6],
  [0.868, 446, 110, 1.55],
  [1, 486, 104, 1.3],
] as const;
/** The five guests peek out of the trees as Mila and Grandma walk home. */
function peekers(ctx: Ctx, p: number, seconds: number, l: Light) {
  const up = (at: number) => backOut(span(p, at, at + 0.012));
  const b = up(PEEK.bear);
  if (b > 0)
    bear(ctx, 390 + b * 14, 176, { pose: 'peek', s: 1.45, mood: 'cosy', wave: seconds * 7 });
  fir(ctx, FIR_A.x, FIR_A.base, FIR_A.h, l);
  // The mouse and the rabbit pop up behind the snowy bush, which also hides the bear's middle.
  const m = up(PEEK.mouse);
  if (m > 0) mouse(ctx, 410, 148 + (1 - clamp(m)) * 14, { s: 1.6, mood: 'cosy' });
  const r = up(PEEK.rabbit);
  if (r > 0) rabbit(ctx, 440, 168 + (1 - clamp(r)) * 24, { s: 1.5, mood: 'look' });
  oval(ctx, 420, 164, 25, 15, l.firDark);
  oval(ctx, 408, 156, 13, 10, l.fir);
  oval(ctx, 432, 155, 14, 10, l.fir);
  oval(ctx, 420, 150, 19, 5, l.cap);
  oval(ctx, 406, 148, 9, 4, l.cap);
  oval(ctx, 434, 147, 10, 4, l.cap);
  const h = up(PEEK.hog);
  if (h > 0) faded(ctx, clamp(h), () => hedgehog(ctx, 382 + h * 10, 172, { s: 1.7, mood: 'look' }));
  const f = up(PEEK.fox);
  if (f > 0) {
    fox(ctx, 470, 172 + (1 - clamp(f)) * 24, { sit: true, s: 1.45, shh: clamp(f), mood: 'sly' });
    faded(ctx, span(p, PEEK.fox + 0.006, PEEK.fox + 0.014), () =>
      write(ctx, 'shh...', 474, 116, { size: 7, type: 'italic', color: '#5A4A56' }),
    );
  }
  oval(ctx, 470, 176, 22, 5, l.snow);
}
function morningShots(ctx: Ctx, p: number, seconds: number) {
  const l = MORNING;
  edgeSky(ctx, l, 1);
  edgeWorld(ctx, seconds, l, track(p, EDGE_CAMERA), () => {
    if (p < 0.868) {
      // Searching the snow. Then something falls out of the sky, right onto her hand.
      const walk = span(p, 0.777, 0.797);
      const moving = walk > 0 && walk < 1;
      const mx = lerp(214, 192, walk),
        gx = lerp(238, 218, walk);
      const found = p >= LANDS;
      const close = p >= 0.817;
      const puzzled = within(p, 0.832, 0.852),
        glad = p >= 0.852;
      const wig = found && !glad ? Math.sin(seconds * 16) * 0.12 : 0;
      const mf: Partial<Figure> = {
        size: 1.45,
        facing: -1,
        step: moving ? seconds * 7 : undefined,
        arms: moving ? undefined : glad ? [2.4, 2.7] : found ? [-0.2, 1.9 + wig] : [-0.2, 1.35],
        eyes: glad ? 'happy' : puzzled ? 'open' : found ? 'wide' : 'sad',
        mouth: glad ? 'grin' : puzzled ? 'flat' : found ? 'o' : 'frown',
        lean: puzzled ? -0.1 : found ? 0 : 0.08,
      };
      const looking = within(p, 0.797, 0.804);
      granny(ctx, gx, FEET, {
        size: 1.4,
        facing: looking ? 1 : -1,
        step: moving ? seconds * 6 : undefined,
        arms: p >= 0.804 && !found ? [0.3, 2.6] : close ? [0.3, 0.9] : undefined,
        eyes: glad ? 'happy' : p >= 0.804 ? 'wide' : 'sad',
        mouth: glad ? 'smile' : p >= 0.804 ? 'o' : 'flat',
      });
      shade(ctx, mx, FEET, 18);
      mila(ctx, mx, FEET, mf, { front: found, back: true });
      const hand = handOf(mx, FEET, { ...MILA, ...mf }, 'front');
      if (p >= 0.804 && !found) {
        const t = span(p, 0.804, LANDS);
        const x = lerp(hand.x + 16, hand.x, t) + Math.sin(t * 9) * 4 * (1 - t);
        mittenIcon(ctx, x, lerp(56, hand.y, easeIn(t)), 0.75, Math.sin(t * 8) * 0.8);
      }
      if (found && !glad) {
        // Warm! Little curls of warmth rise off it.
        glow(ctx, hand.x, hand.y, 14, '#FFB060', 0.5);
        for (let k = 0; k < 3; k++) {
          const t = (seconds * 0.6 + k / 3) % 1;
          const cx = hand.x - 2 + k * 2;
          faded(ctx, (1 - t) * 0.9, () =>
            line(ctx, '#FFE2B8', 0.8, [
              cx,
              hand.y - 3 - t * 9,
              cx + Math.sin(t * 9 + k) * 1.2,
              hand.y - 5 - t * 9,
              cx,
              hand.y - 7 - t * 9,
            ]),
          );
        }
      }
      if (puzzled)
        faded(ctx, span(p, 0.832, 0.836), () =>
          write(ctx, '?', mx - 3, FEET - 44, { size: 9, type: 'serif', color: '#3A3440' }),
        );
      return;
    }
    // Home, hand in hand, with both mittens on. Behind them, the woods are watching.
    const walk = span(p, 0.868, 1);
    const gx = lerp(492, 516, walk),
      mx = gx + 18;
    const hop = Math.abs(Math.sin(seconds * 4.5)) * 1.5;
    shade(ctx, gx, FEET, 22);
    shade(ctx, mx, FEET, 18);
    granny(ctx, gx, FEET, {
      size: 1.4,
      facing: 1,
      step: seconds * 4,
      arms: [0.2, 0.45],
      eyes: 'happy',
      mouth: 'smile',
    });
    mila(ctx, mx, FEET - hop, {
      size: 1.5,
      facing: 1,
      step: seconds * 5,
      arms: [-1.1, 0.5 + Math.sin(seconds * 5) * 0.4],
      eyes: 'happy',
      mouth: 'grin',
    });
    peekers(ctx, p, seconds, l);
  });
  vignette(ctx, 0.35);
}

function openingShots(ctx: Ctx, p: number, seconds: number) {
  if (p < 0.018) {
    edgeSky(ctx, MORNING, 1);
    edgeWorld(ctx, seconds, MORNING, track(p, EDGE_CAMERA), () => {});
    vignette(ctx, 0.4);
    return;
  }
  camera(ctx, track(p, INTERIOR_CAMERA), () => interior(ctx, p, seconds));
  vignette(ctx, 0.5, '#1A0E08');
}
const INTERIOR_CAMERA = [
  [0.018, 152, 104, 1.45],
  [0.034, 140, 110, 1.75],
  [0.034, 142, 110, 2.45],
  [0.058, 146, 110, 2.5],
  [0.058, 204, 102, 1.5],
  [0.08, 214, 100, 1.55],
] as const;

const CAPTIONS = [
  [0.138, 0.19, 'One red mitten, left behind.'],
  [0.228, 0.28, 'Room for one more?'],
  [0.388, 0.438, 'Everyone scooched. Carefully.'],
  [0.546, 0.596, 'Room for... one more?'],
  [0.822, 0.87, 'Somehow, it was still warm.'],
] as const;

// ——— The score: a cumulative folk waltz ———
type Chord = readonly [number, boolean]; // root above D, and whether it is minor
const MINOR: readonly (readonly (number | null)[])[] = [
  [0, 3, 7],
  [8, 7, 5],
  [3, 5, 7],
  [2, null, null],
  [0, 3, 7],
  [12, 10, 8],
  [7, 2, -1],
  [0, null, null],
];
const MINOR_CHORDS: readonly Chord[] = [
  [0, true],
  [5, true],
  [0, true],
  [7, false],
  [0, true],
  [5, true],
  [7, false],
  [0, true],
];
const MAJOR: readonly (readonly (number | null)[])[] = [
  [0, 4, 7],
  [9, 7, 5],
  [4, 5, 7],
  [2, null, null],
  [0, 4, 7],
  [12, 11, 9],
  [7, 2, -1],
  [0, null, null],
];
const MAJOR_CHORDS: readonly Chord[] = [
  [0, false],
  [5, false],
  [0, false],
  [7, false],
  [0, false],
  [9, true],
  [7, false],
  [0, false],
];

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const theMittenScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: ROOT, voice: 'keys', intro: [0, 3, 7], outro: [0, 7, 12, 16] }, (s) => {
    const beat = (BAR * s.story) / 3;
    const at = (n: number, b = 0) => bar(n) + (b * BAR) / 3;
    const tune = (n: number, start: number, major: boolean) => {
      const i = (((n - start) % 8) + 8) % 8;
      return {
        notes: (major ? MAJOR : MINOR)[i],
        chord: (major ? MAJOR_CHORDS : MINOR_CHORDS)[i],
      };
    };
    const triad = ([root, minor]: Chord) => [root, root + (minor ? 3 : 4), root + 7];
    const melody = (
      voice: Voice,
      from: number,
      to: number,
      start: number,
      major: boolean,
      octave: number,
      gain: number,
      pan = 0,
      downbeats = false,
    ) => {
      for (let n = from; n < to; n++) {
        const { notes } = tune(n, start, major);
        notes.forEach((d, k) => {
          if (d === null || (downbeats && k)) return;
          const held = notes.slice(k + 1).every((x) => x === null) ? 3 - k : 1;
          s.note(at(n, k), ROOT + octave + d, beat * held * 0.95, voice, gain, pan);
        });
      }
    };
    const pads = (from: number, to: number, start: number, major: boolean, gain: number) => {
      for (let n = from; n < to; n++)
        s.chord(
          at(n),
          triad(tune(n, start, major).chord).map((x) => ROOT + x),
          beat * 3.05,
          'pad',
          gain,
        );
    };
    // Hedgehog: an oom-pah-pah on plucked strings.
    const oompah = (
      from: number,
      to: number,
      start: number,
      major: boolean,
      gain: number,
      voice: Voice = 'pluck',
    ) => {
      for (let n = from; n < to; n++) {
        const [r, third, fifth] = triad(tune(n, start, major).chord);
        s.note(at(n), ROOT - 12 + r, beat * 0.9, voice, gain * 1.3, -0.2);
        for (const k of [1, 2])
          for (const x of [third, fifth])
            s.note(at(n, k), ROOT + x, beat * 0.5, voice, gain * 0.6, 0.25);
      }
    };
    // Rabbit: a hopping arpeggio on the keys.
    const hops = (from: number, to: number, start: number, major: boolean, gain: number) => {
      for (let n = from; n < to; n++) {
        const [r, third, fifth] = triad(tune(n, start, major).chord);
        [r, fifth, r + 12, third + 12, r + 12, fifth].forEach((x, k) =>
          s.note(at(n, k / 2), ROOT + x, beat * 0.45, 'keys', gain, 0.45 - k * 0.12),
        );
      }
    };
    // Bear: heavy bass and a kick on every downbeat.
    const stomp = (from: number, to: number, start: number, major: boolean, gain: number) => {
      for (let n = from; n < to; n++) {
        const [r] = tune(n, start, major).chord;
        s.note(at(n), ROOT - 24 + r, beat * 1.8, 'bass', gain);
        s.note(at(n, 2), ROOT - 24 + r + 7, beat * 0.9, 'bass', gain * 0.6);
        s.note(at(n), 36, 0.3, 'kick', gain * 1.1);
      }
    };

    // Morning at the cottage, and Grandma's knitting song by the fire.
    s.fx('wind', 0, 2, 0.05);
    s.chord(0, [ROOT - 12, ROOT - 9, ROOT - 5], 1.8, 'pad', 0.03);
    s.fx('crackle', 0.018, 0.062 * s.story, 0.04, -0.5);
    melody('keys', -7, -5, -7, false, 12, 0.08, -0.1);
    pads(-7, -5, -7, false, 0.022);
    for (const t of [0.021, 0.0245, 0.028]) s.fx('click', t, 0.05, 0.06, -0.3);
    s.fx('click', 0.031, 0.06, 0.1, -0.3);
    s.fx('giggle', 0.038, 0.9, 0.1, 0.2);
    s.fx('sparkle', 0.043, 0.8, 0.07, 0.1);
    // Out of the door in a rush.
    [0, 3, 7, 12, 15, 19].forEach((d, i) =>
      s.note(0.058 + i * 0.0032, ROOT + d, 0.3, 'pluck', 0.07, 0.3),
    );
    for (const t of [0.06, 0.064, 0.068]) s.fx('step', t, 0.12, 0.1, 0.5);
    s.fx('creak', 0.061, 0.6, 0.1, 0.6);
    s.fx('wind', 0.066, 1.2, 0.1, 0.6);
    // Playing in the woods; the tune hangs unfinished as dusk comes down.
    melody('pluck', -5, -2, -5, false, 12, 0.08);
    melody('bell', -5, -3, -5, false, 24, 0.035, 0.3, true);
    oompah(-5, -3, -5, false, 0.045, 'keys');
    pads(-3, -1, -5, false, 0.02);
    s.note(bar(-2), ROOT + 14, beat * 3, 'bell', 0.06, 0.2);
    for (const t of [0.08, 0.083, 0.086]) s.fx('crunch', t, 0.12, 0.12, 0.3);
    s.fx('crunch', 0.09, 0.3, 0.16);
    s.fx('thud', 0.091, 0.3, 0.1);
    s.fx('giggle', 0.097, 1, 0.1);
    for (let i = 0; i < 3; i++) s.fx('swish', 0.1 + i * 0.0083, 0.35, 0.06, i % 2 ? 0.3 : -0.3);
    s.fx('pop', SLIP, 0.15, 0.12, 0.4);
    s.fx('crunch', PLOP, 0.15, 0.08, 0.5);
    s.fx('wind', 0.115, 0.095 * s.story, 0.07);
    for (let i = 0; i < 5; i++)
      s.fx('crunch', 0.127 + i * 0.003, 0.1, 0.1 - i * 0.015, 0.2 + i * 0.15);
    // The lonely mitten, then a mouse, shivering.
    s.chord(bar(-1), [ROOT - 12, ROOT - 9, ROOT - 5], beat * 3, 'pad', 0.02);
    for (let i = 0; i < 6; i++) s.fx('tick', 0.177 + i * 0.0022, 0.04, 0.06, -0.4);
    s.fx('squeak', 0.186, 0.25, 0.1, -0.2);
    s.fx('rustle', 0.198, 0.5, 0.08);
    s.fx('squeak', 0.212, 0.2, 0.08, -0.1);

    // The cumulative waltz: one loop of the tune, then another, one more guest at a time.
    pads(0, 16, 0, false, 0.02);
    melody('bell', 0, 9, 0, false, 12, 0.085, 0.15);
    melody('bell', 9, 16, 0, false, 24, 0.04, 0.35, true);
    oompah(2, 16, 0, false, 0.07);
    hops(5, 16, 0, false, 0.04);
    melody('lead', 9, 16, 0, false, 12, 0.07, -0.15);
    stomp(11, 16, 0, false, 0.1);
    // Arrivals.
    s.fx('rustle', 0.224, 0.4, 0.07, -0.4);
    s.fx('knock', 0.239, 0.15, 0.14, -0.2);
    s.fx('knock', 0.244, 0.15, 0.14, -0.2);
    s.fx('squeak', 0.249, 0.2, 0.08);
    s.fx('rustle', 0.253, 0.3, 0.07);
    for (const t of [0.287, 0.299, 0.311]) s.fx('boing', t, 0.5, 0.1, 0.4 - (t - 0.287) * 30);
    s.fx('rustle', 0.332, 0.3, 0.07);
    s.fx('boing', RABBIT_IN + 0.006, 0.4, 0.07);
    s.fx('swish', 0.357, 0.5, 0.08, -0.5);
    s.fx('gasp', 0.373, 0.5, 0.1);
    s.fx('swish', 0.43, 0.4, 0.08);
    s.fx('rumble', 0.49, 2, 0.12, -0.4);
    for (const t of STOMPS) s.fx('thud', t, 0.5, 0.24, -0.4);
    s.fx('gasp', 0.53, 0.6, 0.12);
    s.fx('hum', 0.55, 0.9, 0.07, -0.3);
    s.fx('rustle', 0.573, 1.6, 0.08);
    SHOVES.forEach((t, i) => s.fx('creak', t, 0.45, 0.13 + i * 0.04));
    s.fx('pop', BEAR_IN, 0.3, 0.24);
    GROWTH.slice(0, 4).forEach(([t], i) => s.fx('creak', t, 0.4, 0.06 + i * 0.02, 0.1));

    // Hush. Only the wind, and one snowflake.
    s.fx('wind', HUSH, (ACHOO - HUSH) * s.story + 0.4, 0.07);
    s.chord(HUSH, [ROOT + 7, ROOT + 12, ROOT + 14], (ACHOO - HUSH) * s.story, 'pad', 0.014);
    s.fx('sparkle', HUSH + 0.006, 1, 0.06, -0.2);
    s.fx('sparkle', FLAKE_LANDS, 0.8, 0.09, -0.3);
    s.fx('gasp', AH[0], 0.5, 0.1, -0.3);
    s.fx('gasp', AH[1], 0.6, 0.14, -0.3);
    s.fx('sneeze', ACHOO - (0.65 * 1.1) / s.story, 1.1, 0.3, -0.2);
    // Everyone goes flying.
    s.fx('pop', ACHOO, 0.2, 0.2);
    s.fx('boing', ACHOO + 0.002, 0.6, 0.16, -0.5);
    s.fx('woo', ACHOO + 0.003, 0.9, 0.12, 0.4);
    s.fx('swish', ACHOO + 0.004, 0.5, 0.14, 0.6);
    for (let i = 0; i < 3; i++) s.fx('bounce', ACHOO + 0.004 + i * 0.008, 0.25, 0.12, -0.6);
    s.fx('thud', ACHOO + 0.017, 0.5, 0.26, 0.8);
    s.fx('crunch', ACHOO + 0.017, 0.4, 0.2, 0.8);
    [12, 7, 3, 0, -5].forEach((d, i) =>
      s.note(ACHOO + 0.004 + i * 0.003, ROOT + d, 0.25, 'pluck', 0.06, 0.2),
    );
    // Up and away over the trees, into the dawn.
    s.fx('sweep', FLIGHT, 1.8, 0.12);
    s.fx('wind', FLIGHT, 1.8, 0.06);
    [0, 4, 7, 12, 16, 19, 24].forEach((d, i) =>
      s.note(FLIGHT + 0.002 + i * 0.0035, ROOT + d, 0.9, 'bell', 0.06, -0.6 + i * 0.2),
    );
    s.chord(FLIGHT, [ROOT - 12, ROOT - 8, ROOT - 5], 2, 'pad', 0.025);
    // Next morning: searching, and a question in the tune.
    s.fx('tweet', 0.782, 1.1, 0.06, 0.5);
    for (const t of [0.779, 0.786, 0.793]) s.fx('crunch', t, 0.12, 0.07, -0.1);
    melody('keys', 22, 23, 16, false, 12, 0.06);
    pads(22, 23, 16, false, 0.02);
    s.fx('swish', 0.805, 0.5, 0.08, -0.1);
    // It lands, and the tune comes home in a major key. The guests rejoin one by one.
    s.fx('chime', LANDS, 1.4, 0.16, -0.2);
    s.fx('sparkle', LANDS + 0.004, 1, 0.08, -0.2);
    melody('bell', 23, 30, 23, true, 12, 0.085, 0.1);
    pads(23, 30, 23, true, 0.022);
    oompah(24, 30, 23, true, 0.06);
    hops(25, 30, 23, true, 0.035);
    melody('lead', 28, 30, 23, true, 0, 0.06, -0.2);
    stomp(29, 30, 23, true, 0.07);
    s.fx('giggle', 0.856, 0.9, 0.09, -0.1);
    for (let i = 0; i < 12; i++) s.fx('crunch', 0.87 + i * 0.01, 0.1, 0.05, 0.1);
    s.fx('tweet', 0.9, 1.1, 0.05, 0.6);
    s.fx('squeak', PEEK.mouse, 0.2, 0.08, -0.4);
    s.fx('rustle', PEEK.hog, 0.3, 0.06, -0.4);
    s.fx('boing', PEEK.rabbit, 0.4, 0.05, -0.2);
    s.fx('rustle', PEEK.fox + 0.006, 0.4, 0.05, -0.3);
    s.fx('hum', PEEK.bear, 0.5, 0.05, -0.4);
    // Home: the last chord.
    s.chord(1, [ROOT - 12, ROOT - 8, ROOT - 5, ROOT], 2.8, 'pad', 0.03);
    s.note(1, ROOT + 12, 2.6, 'bell', 0.08);
    s.note(1, ROOT - 24, 2.2, 'bass', 0.1);
  });

export const theMitten: FilmModule = {
  draw(ctx, p, seconds) {
    if (p < 0.08) openingShots(ctx, p, seconds);
    else if (p < 0.14) woodsShots(ctx, p, seconds);
    else if (p < FLIGHT) hollowShots(ctx, p, seconds);
    else if (p < 0.777) flightShot(ctx, p, seconds);
    else morningShots(ctx, p, seconds);
    // Soft dips between places: indoors, out into the cold, into the night, into morning.
    veil(ctx, '#07090C', Math.max(hump(p, 0.012, 0.024) * 0.7, hump(p, 0.132, 0.148) * 0.8));
    veil(ctx, '#EEF3FA', hump(p, 0.072, 0.088) * 0.75);
    veil(ctx, '#F6E4C8', hump(p, 0.768, 0.786) * 0.85);
    captions(ctx, p, CAPTIONS);
  },
  score: theMittenScore,
  look: {
    shade: '#0F1826',
    ink: '#F7FAFF',
    accent: '#D8433B',
    dedication: 'there is always room for one more',
  },
};
