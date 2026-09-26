import { CINEMA_FILMS } from '../lib/cinema';
import type { FilmModule } from './types';
import {
  alpha,
  box,
  captions,
  clamp,
  disc,
  ease,
  easeIn,
  easeOut,
  glow,
  H,
  hump,
  lerp,
  letterbox,
  line,
  mix,
  oval,
  person,
  poly,
  presence,
  rainfall,
  rand,
  span,
  TAU,
  vignette,
  W,
  write,
  type Ctx,
} from './kit';
import { composeFilm, type Section } from './score-kit';

/*
 * NIGHT COURIER
 * Kai is a bike courier at the end of a long wet shift. The dispatcher has one more job: a
 * small white cold box for St. Alder's Hospital, with a countdown on its lid. The city is the
 * antagonist: stalled traffic, a bus, a closed road, a night market, a drawbridge on the rise,
 * a snapped chain, a dead lift. Only when the surgeon carries the box away do we read its
 * side: DONOR HEART. Dawn comes up gold, somewhere upstairs a small heart finds its rhythm,
 * and when the radio asks for one more, Kai laughs and switches it off.
 *
 * Every hit is a shared constant in story seconds, read by both the pictures and the score:
 * the horn, the sparks, the tram bell, the skid, the jump, the landing, the snap, the doors,
 * the monitor. The clock on the lid runs fast between inserts and in real time whenever we
 * cut back to it.
 */

// ——— Time ———
const STORY = (CINEMA_FILMS.find((film) => film.artwork === 'courier')?.duration ?? 150) - 6;
/** Story seconds → story time p. */
const T = (seconds: number) => seconds / STORY;

// Shots, in story seconds.
const SHOTS = [
  ['city', 0],
  ['eyes', 6],
  ['hatch', 11],
  ['timer1', 16],
  ['launch', 18.5],
  ['track', 23],
  ['jam', 29],
  ['bus', 34.5],
  ['face', 39],
  ['overhead', 41.5],
  ['timer2', 47.5],
  ['closed', 50],
  ['market', 54.5],
  ['orange', 61],
  ['bridge', 64.5],
  ['choice', 70],
  ['pedals', 74],
  ['ramp', 77.5],
  ['apex', 81],
  ['air', 84.5],
  ['land', 86.5],
  ['timer3', 89.6],
  ['hill', 92.5],
  ['chain', 95.8],
  ['run', 98.3],
  ['lift', 104.8],
  ['stairs', 108],
  ['timer4', 113],
  ['doors', 115],
  ['handoff', 118],
  ['surgeon', 120.2],
  ['kai', 121.6],
  ['label', 123],
  ['shut', 125.2],
  ['bench', 127.6],
  ['window', 133.5],
  ['steps', 138.5],
] as const;
type ShotName = (typeof SHOTS)[number][0];
function current(S: number) {
  let i = 0;
  while (i + 1 < SHOTS.length && S >= SHOTS[i + 1][1]) i++;
  const from: number = SHOTS[i][1];
  const to: number = i + 1 < SHOTS.length ? SHOTS[i + 1][1] : STORY;
  return { name: SHOTS[i][0] as ShotName, from, to };
}
/** One frame of one shot: seconds into it, its length, progress, story seconds, film clock. */
type Cut = { t: number; d: number; k: number; S: number; sec: number };

// Sync points, in story seconds, shared by the pictures and the score.
const RADIO_IN = 6.9;
const START = 16.9;
const LAUNCH = 19.8;
const PUDDLE = 20.9;
const DOOR = 31.4;
const HORN = 35.7;
const SCRAPE = 37.1;
const TRAM_BELL = [42.6, 42.95] as const;
const CROSS = 44.6;
const SKID = 51;
const TURN = 53.1;
const DUCK = 57.4;
const CRATE = 59.3;
const ROLL = 62.3;
const GATE = 65.4;
const LIFT = 66.2;
const GLANCE = 71.3;
const RESOLVE = 72.7;
const STAND = 74.7;
const TAKEOFF = 80.3;
const LAND = 87;
const PAT = 91.2;
const SNAP = 96.6;
const RUN = 99;
const BUTTON = [105.9, 106.45] as const;
const STAIRS_DOOR = 107.4;
const BURST = 115.4;
const HANDOFF = 119;
const STOP_CLOCK = 119.5;
const SHUT = 125.8;
const MONITOR = [133.9, 134.62, 135.05, 135.9, 136.7, 137.5, 138.3] as const;
const WAVE = 136.3;
const RADIO_OUT = 139;
const LAUGH = 141.3;
const OFF = 142.5;
const DAWN_FROM = 127.6;

// The clock on the lid: [story second, seconds left]. Real time during the inserts.
const CLOCK = [
  [START, 900],
  [18.5, 898.4],
  [47.5, 541.2],
  [50, 538.7],
  [89.6, 212],
  [92.5, 209.1],
  [113, 16.4],
  [115, 14.4],
  [STOP_CLOCK, 3.4],
] as const;
function remaining(S: number) {
  if (S <= CLOCK[0][0]) return CLOCK[0][1];
  for (let i = 0; i < CLOCK.length - 1; i++) {
    const [a, va] = CLOCK[i],
      [b, vb] = CLOCK[i + 1];
    if (S < b) return lerp(va, vb, (S - a) / (b - a));
  }
  return CLOCK[CLOCK.length - 1][1];
}
/** Story seconds inside [from, to) where the display clicks down a second. */
function ticks(from: number, to: number) {
  const list: number[] = [];
  const left = remaining(from);
  const frac = left - Math.floor(left) || 1;
  for (let t = from + frac; t < to; t += 1) list.push(t);
  return list;
}
function readout(left: number) {
  const s = Math.max(0, Math.ceil(left - 1e-6));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
const clockColor = (left: number) => (left > 300 ? '#7DFFB4' : left > 60 ? '#FFC04A' : '#FF4E60');

// Running: one stride cycle (two footfalls) every 1/STRIDE seconds.
const STRIDE = 1.6;
const footfalls = (from: number, to: number, rate = STRIDE) => {
  const list: number[] = [];
  for (let k = 0; ; k++) {
    const t = from + (0.25 + k / 2) / rate;
    if (t >= to) return list;
    list.push(t);
  }
};
const RUN_STEPS = footfalls(RUN, 104.8);
const LIFT_STEPS = [...footfalls(104.8, 105.6), ...footfalls(107, 108)];
const STAIR_STEPS = footfalls(108, 113, 2);
const DOOR_STEPS = footfalls(BURST, 117.6);

// ——— Palette ———
const INK = '#04050B';
const MAGENTA = '#FF3FA4';
const CYAN = '#3DE6FF';
const AMBER = '#FFB547';
const TAIL = '#FF2F4A';
const HEADLIGHT = '#FFF1C9';
const JACKET = '#F2C230';
const JACKET_D = '#A57C16';
const PANTS = '#222A45';
const SHOE = '#16161E';
const SKIN = '#B87852';
const SKIN_D = '#87543C';
const HAIR = '#16111B';
const GLOVE = '#23232C';
const WHITE = '#EDF1F4';
const RED = '#E0314B';
const SCRUBS = '#3E8C70';
const SCRUBS_D = '#2C6A54';
const MASK = '#A9D9C8';
const DOC_SKIN = '#D9A684';
const FRAME = '#1B2C3A';
const ASPHALT = '#090C1C';
const NIGHT_SKY = ['#04061A', '#0D0F33', '#27194C', '#4B2258'] as const;
const DAWN_SKY = ['#8AA5CC', '#CFCBC6', '#F4D49C', '#FFE6B0'] as const;
const WARM_WINDOWS = ['#FFD27E', '#9FE6FF', '#FFB2D6', '#FFE9B8'] as const;
const WORDS = [
  'NOODLES',
  'HOTEL',
  'OPEN',
  'KARAOKE',
  'DINER',
  'LAUNDRY',
  '24H',
  'TEA',
  'RAMEN',
  'BAR',
  'CAFE',
  'ARCADE',
] as const;

// ——— Little helpers ———
/** A camera jolt after an impact: a quick, damped shake. */
const jolt = (S: number, at: number, amount: number, rate = 7) =>
  S < at ? 0 : amount * Math.exp(-(S - at) * rate) * Math.sin((S - at) * 46);
/** A warning lamp: a slow, soft swell, never a strobe. */
const lamp = (sec: number, phase = 0, rate = 0.8) =>
  0.5 + 0.5 * Math.sin((sec * rate + phase) * TAU);
function zoomed(ctx: Ctx, cx: number, cy: number, z: number, paint: () => void) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(z, z);
  ctx.translate(-cx, -cy);
  paint();
  ctx.restore();
}
function gradient(ctx: Ctx, top: number, bottom: number, stops: readonly string[]) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(-60, top, W + 120, bottom - top);
}
const skyAt = (dawn: number) => NIGHT_SKY.map((c, i) => mix(c, DAWN_SKY[i], dawn));
function rain(
  ctx: Ctx,
  sec: number,
  amount = 1,
  slant = 0.25,
  o: { speed?: number; length?: number; seed?: number; color?: string } = {},
) {
  rainfall(ctx, sec, {
    amount,
    slant,
    speed: o.speed ?? 210,
    length: o.length ?? 7,
    color: o.color ?? alpha('#B4C8EE', 0.5),
    seed: o.seed ?? 13,
  });
}
function clouds(ctx: Ctx, sec: number, top: number, color: string, amount = 0.3) {
  for (let i = 0; i < 6; i++) {
    const x = ((rand(i * 4.1) * 440 + sec * (1.5 + i * 0.6)) % 440) - 60;
    oval(
      ctx,
      x,
      top + rand(i * 2.3) * 44,
      46 + rand(i) * 44,
      3 + rand(i * 7) * 4,
      alpha(color, amount),
    );
  }
}
function bokeh(
  ctx: Ctx,
  sec: number,
  amount = 1,
  colors: readonly string[] = [MAGENTA, CYAN, AMBER],
) {
  for (let i = 0; i < 9; i++) {
    const x = rand(i * 3.3) * W + Math.sin(sec * 0.3 + i) * 6;
    glow(
      ctx,
      x,
      rand(i * 5.9) * H,
      18 + rand(i * 1.7) * 26,
      colors[i % colors.length],
      0.22 * amount,
    );
  }
}
function steam(ctx: Ctx, x: number, y: number, sec: number, amount = 1, height = 50) {
  for (let i = 0; i < 6; i++) {
    const t = (sec * 0.32 + i / 6) % 1;
    oval(
      ctx,
      x + Math.sin(t * 5 + i) * 5 + t * 12,
      y - t * height,
      5 + t * 14,
      3 + t * 8,
      alpha('#C9D2EA', 0.14 * (1 - t) * amount),
    );
  }
}
function motionLines(
  ctx: Ctx,
  sec: number,
  speed: number,
  top: number,
  bottom: number,
  amount = 1,
  color = '#DDE8FF',
) {
  for (let i = 0; i < 14; i++) {
    const y = top + rand(i * 2.9) * (bottom - top);
    const x = W + 60 - ((rand(i * 1.3) * 500 + sec * speed) % (W + 140));
    box(ctx, x, y, 20 + rand(i * 4.1) * 50, 1, alpha(color, 0.12 * amount));
  }
}
/** Paints `lights` mirrored in the wet street below `axis`, broken up by ripples. */
function reflect(
  ctx: Ctx,
  axis: number,
  sec: number,
  lights: () => void,
  amount = 0.5,
  bottom = H,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(-60, axis, W + 120, bottom - axis);
  ctx.clip();
  ctx.globalAlpha *= amount;
  ctx.translate(0, axis * 2);
  ctx.scale(1, -1);
  lights();
  ctx.restore();
  for (let i = 0; i < 20; i++) {
    const y = axis + 2 + rand(i * 3.7) * (bottom - axis - 2);
    const x = ((rand(i * 1.9) * 400 + sec * (6 + rand(i) * 8)) % 400) - 40;
    box(ctx, x, y, 8 + rand(i * 5.3) * 20, 1, alpha(ASPHALT, 0.55));
  }
}
function splash(ctx: Ctx, x: number, y: number, t: number, size = 1) {
  if (t < 0 || t > 0.9) return;
  const k = t / 0.9;
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI * (0.1 + rand(i * 3.1) * 0.8);
    const v = (30 + rand(i * 7.3) * 50) * size;
    const px = x + Math.cos(a) * v * t,
      py = y + Math.sin(a) * v * t + 160 * t * t * size;
    if (py < y + 2) box(ctx, px, py, 1.5, 1.5, alpha('#CFE0FF', 0.9 * (1 - k)));
  }
  ctx.strokeStyle = alpha('#CFE0FF', 0.6 * (1 - k));
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y, (6 + 30 * k) * size, (1 + 4 * k) * size, 0, 0, TAU);
  ctx.stroke();
}
function sparks(ctx: Ctx, x: number, y: number, t: number, dir = 1, size = 1) {
  if (t < 0 || t > 0.6) return;
  const k = t / 0.6;
  glow(ctx, x, y, 14 * size, '#FFD27A', 0.5 * (1 - k));
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI * (0.05 + rand(i * 2.7) * 0.5);
    const v = (40 + rand(i * 5.3) * 80) * size;
    const px = x - Math.cos(a) * v * t * dir,
      py = y + Math.sin(a) * v * t + 180 * t * t;
    line(ctx, alpha('#FFE9A8', 1 - k), 0.8, [
      px,
      py,
      px + Math.cos(a) * 3 * dir,
      py - Math.sin(a) * 3,
    ]);
  }
}
/** Spray thrown up behind a tyre on a wet road. */
function spray(ctx: Ctx, x: number, y: number, sec: number, s = 1) {
  for (let i = 0; i < 14; i++) {
    const t = (sec * 2.2 + i / 14) % 1;
    const px = x - t * 44 * s - rand(i) * 6,
      py = y - 2 - Math.sin(t * Math.PI) * 14 * s * (0.5 + rand(i * 3.3) * 0.6);
    box(ctx, px, py, 1.4, 1.2, alpha('#C8DAFF', 0.7 * (1 - t)));
  }
}

// ——— The city ———
type Row = {
  seed: number;
  spacing: number;
  base: number;
  lo: number;
  hi: number;
  color: string;
  lit: number;
  signs: number;
};
const FAR: Row = {
  seed: 3,
  spacing: 30,
  base: 116,
  lo: 36,
  hi: 88,
  color: '#16183C',
  lit: 0.1,
  signs: 0,
};
const MID: Row = {
  seed: 11,
  spacing: 44,
  base: 132,
  lo: 44,
  hi: 96,
  color: '#10122E',
  lit: 0.16,
  signs: 0.45,
};
const NEAR: Row = {
  seed: 29,
  spacing: 58,
  base: 150,
  lo: 40,
  hi: 80,
  color: '#0B0D23',
  lit: 0.2,
  signs: 0.7,
};

function neonH(ctx: Ctx, x: number, y: number, word: string, color: string, on = 1, size = 6) {
  const w = word.length * size * 0.62 + 6;
  box(ctx, x - w / 2, y - size - 1, w, size + 4, '#090812');
  if (on > 0.02) glow(ctx, x, y - size / 2, w * 0.8, color, 0.35 * on);
  write(ctx, word, x, y, { size, color: alpha(mix('#FFFFFF', color, 0.45), 0.25 + 0.75 * on) });
}
function neonV(ctx: Ctx, x: number, y: number, word: string, color: string, on = 1) {
  const n = word.length;
  box(ctx, x - 4, y - 2, 8, n * 7 + 3, '#090812');
  if (on > 0.02) glow(ctx, x, y + n * 3.5, n * 5 + 6, color, 0.3 * on);
  const ink = alpha(mix('#FFFFFF', color, 0.45), 0.25 + 0.75 * on);
  for (let i = 0; i < n; i++) write(ctx, word[i], x, y + 6 + i * 7, { size: 6, color: ink });
}
/** The neon heart over the city: on all night, and switched off at dawn. */
function heartSign(ctx: Ctx, x: number, y: number, s: number, color: string, on = 1) {
  const pts: number[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * TAU;
    pts.push(
      x + 8 * Math.sin(a) ** 3 * s,
      y -
        (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 0.5 * s,
    );
  }
  if (on > 0.02) glow(ctx, x, y, 22 * s, color, 0.35 * on);
  line(ctx, alpha(mix('#3A2A40', color, on), 0.5 + 0.5 * on), 1.6, pts);
  if (on > 0.02) line(ctx, alpha('#FFFFFF', 0.6 * on), 0.6, pts);
}

/** A row of towers. `lights` paints only their windows and signs (for reflections). */
function row(ctx: Ctx, r: Row, scroll: number, lights = false, dawn = 0, tint?: string) {
  const on = 1 - dawn;
  const first = Math.floor(scroll / r.spacing) - 1,
    last = Math.ceil((scroll + W) / r.spacing) + 1;
  for (let n = first; n <= last; n++) {
    const seed = r.seed + n * 17.3;
    const w = r.spacing * (0.72 + rand(seed + 1) * 0.3);
    const x = n * r.spacing - scroll + (r.spacing - w) * rand(seed + 9);
    const h = lerp(r.lo, r.hi, rand(seed + 2));
    const top = r.base - h;
    if (!lights) {
      const color = tint ?? r.color;
      box(ctx, x, top, w, h + 1, color);
      box(ctx, x, top, 1, h, alpha(dawn > 0.5 ? '#FFD9A0' : '#7E70D0', 0.22));
      if (rand(seed + 3) > 0.55) box(ctx, x + w * 0.25, top - 4, w * 0.4, 4, color);
    }
    if (on > 0.03) {
      const cols = Math.max(1, Math.floor((w - 4) / 5)),
        rows = Math.max(1, Math.floor((h - 8) / 7));
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const k = seed + i * 3.1 + j * 7.9;
          if (rand(k) > r.lit) continue;
          box(
            ctx,
            x + 3 + i * 5,
            top + 5 + j * 7,
            2,
            3,
            alpha(WARM_WINDOWS[Math.floor(rand(k + 1) * 4)], 0.85 * on),
          );
        }
      if (rand(seed + 5) < r.signs) {
        const word = WORDS[Math.floor(rand(seed + 6) * WORDS.length)];
        const color = rand(seed + 7) > 0.5 ? MAGENTA : CYAN;
        if (rand(seed + 8) > 0.45 && word.length * 7 + 12 < h)
          neonV(ctx, x + w - 6, top + 6, word, color, on);
        else neonH(ctx, x + w / 2, top + 12 + rand(seed + 4) * h * 0.35, word, color, on);
      }
    }
  }
}

function tramSide(ctx: Ctx, x: number, y: number, sec: number) {
  glow(ctx, x - 4, y - 7, 22, HEADLIGHT, 0.45);
  box(ctx, x, y - 17, 124, 15, '#4A5277');
  box(ctx, x, y - 17, 124, 2, '#8C94B8');
  box(ctx, x + 2, y - 13, 120, 6, '#FFD58A');
  for (let i = 0; i < 9; i++) {
    box(ctx, x + 6 + i * 13, y - 12, 3, 5, '#2A2438');
    box(ctx, x + 12 + i * 13, y - 13, 1, 6, '#3A4262');
  }
  box(ctx, x, y - 5, 124, 2, MAGENTA);
  box(ctx, x - 1, y - 15, 3, 10, '#1A2038');
  line(ctx, '#23263C', 1, [x + 54, y - 17, x + 60, y - 25, x + 66, y - 17]);
  glow(ctx, x + 60, y - 26, 6, '#A8C8FF', 0.25 + 0.1 * Math.sin(sec * 2));
  box(ctx, x + 8, y - 2, 16, 2, '#0A0B16');
  box(ctx, x + 100, y - 2, 16, 2, '#0A0B16');
}

// ——— Kai and her bike ———
const BBX = -2,
  BBY = -8;
type Bike = { crank?: number; wheel?: number; box?: boolean; chain?: boolean; blur?: number };
type Tone = (c: string) => string;
const toner = (dark: number, night = '#05060E'): Tone =>
  dark > 0 ? (c: string) => mix(c, night, dark) : (c: string) => c;
function ik(hx: number, hy: number, fx: number, fy: number, a: number, b: number, bend = 1) {
  const d = clamp(Math.hypot(fx - hx, fy - hy), 0.5, a + b - 0.05);
  const base = Math.atan2(fy - hy, fx - hx);
  const off = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  return [hx + Math.cos(base - off * bend) * a, hy + Math.sin(base - off * bend) * a] as const;
}
function wheel(ctx: Ctx, cx: number, cy: number, r: number, turn: number, tone: Tone, blur = 0) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = tone('#06070C');
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = tone('#6E7892');
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2.3, 0, TAU);
  if (blur < 0.5)
    for (let i = 0; i < 3; i++) {
      const a = turn + (i * Math.PI) / 3;
      ctx.moveTo(cx + Math.cos(a) * (r - 2.3), cy + Math.sin(a) * (r - 2.3));
      ctx.lineTo(cx - Math.cos(a) * (r - 2.3), cy - Math.sin(a) * (r - 2.3));
    }
  ctx.stroke();
  if (blur >= 0.5) disc(ctx, cx, cy, r - 2.5, alpha(tone('#8C96B0'), 0.14));
  disc(ctx, cx, cy, 1.1, tone('#A2AABE'));
}
function coldBoxSmall(ctx: Ctx, x: number, y: number, tone: Tone) {
  box(ctx, x, y, 12, 8, tone(WHITE));
  box(ctx, x, y, 12, 1, tone('#FFFFFF'));
  box(ctx, x + 5, y + 1, 2, 6, tone(RED));
  box(ctx, x + 3, y + 3, 6, 2, tone(RED));
  box(ctx, x, y + 7, 12, 1, tone('#8E9AAA'));
  box(ctx, x + 8, y - 0.8, 3, 1, '#FF5A6A');
}
/** The bike in its own frame, facing right, ground at y = 0. */
function bikeParts(ctx: Ctx, tone: Tone, b: Bike) {
  const crank = b.crank ?? 0;
  wheel(ctx, -16, -9, 9, b.wheel ?? 0, tone, b.blur ?? 0);
  wheel(ctx, 16, -9, 9, b.wheel ?? 0, tone, b.blur ?? 0);
  const fr = tone(FRAME);
  line(ctx, fr, 1.7, [-16, -9, BBX, BBY, -8, -24, -16, -9]);
  line(ctx, fr, 1.7, [-8, -24, 10, -23, BBX, BBY]);
  line(ctx, fr, 1.7, [10, -23, 16, -9]);
  line(ctx, fr, 1.4, [10, -23, 11, -27, 14, -27.5]);
  line(ctx, tone(CYAN), 0.6, [0.5, -11.5, 8, -21]);
  box(ctx, -12, -26.5, 7, 1.8, tone('#0D0E15'));
  const chain = tone('#5A6072');
  if (b.chain ?? true)
    line(ctx, chain, 0.6, [BBX, BBY - 2.6, -16, -10.3, -16, -7.7, BBX, BBY + 2.6]);
  else line(ctx, chain, 0.6, [BBX, BBY + 2.6, BBX - 1, BBY + 7, BBX - 4, BBY + 8.5]);
  disc(ctx, BBX, BBY, 2.7, tone('#3A4152'));
  const px = Math.cos(crank) * 4.5,
    py = Math.sin(crank) * 4.5;
  line(ctx, tone('#9AA2B4'), 1, [BBX - px, BBY - py, BBX + px, BBY + py]);
  line(ctx, tone('#2A3444'), 1, [16, -9, 20, -19]);
  line(ctx, tone('#2A3444'), 1, [12.5, -19, 25.5, -19]);
  if (b.box ?? true) coldBoxSmall(ctx, 13, -27, tone);
}
function bicycle(ctx: Ctx, x: number, y: number, s: number, tilt: number, b: Bike, dark = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(tilt);
  bikeParts(ctx, toner(dark), b);
  ctx.restore();
}
/** Kai's head in her hood, in profile facing right. */
function hoodHead(ctx: Ctx, x: number, y: number, tone: Tone, rim?: string) {
  disc(ctx, x, y, 5.8, tone(JACKET));
  oval(ctx, x + 2.6, y + 1.2, 3.1, 3.9, tone(SKIN));
  box(ctx, x + 2.6, y - 3.1, 3.2, 1.2, tone(HAIR));
  box(ctx, x + 3.7, y - 0.2, 1, 1.4, tone(INK));
  box(ctx, x + 5.4, y + 1, 1, 1, tone(SKIN_D));
  line(ctx, tone(JACKET_D), 1, [x - 1, y - 5.2, x + 4, y - 4.4, x + 6, y - 2]);
  if (rim) {
    ctx.strokeStyle = rim;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(x, y, 5.8, Math.PI * 0.95, Math.PI * 1.65);
    ctx.stroke();
  }
}
type Ride = Bike & {
  stand?: number;
  crouch?: number;
  tilt?: number;
  foot?: boolean;
  dark?: number;
  rim?: string;
};
/** Kai on her bike, side on, facing right; (x, y) is the ground between the wheels. */
function rider(ctx: Ctx, x: number, y: number, s: number, r: Ride = {}) {
  const tone = toner(r.dark ?? 0);
  const crank = r.crank ?? 0,
    stand = r.stand ?? 0,
    crouch = r.crouch ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (r.tilt) ctx.rotate(r.tilt);
  const hip = [lerp(-8, -4, stand) + crouch * 3, lerp(-26, -29, stand) + crouch * 3] as const;
  const sh = [lerp(3, 6, stand) + crouch * 6, lerp(-39, -41, stand) + crouch * 11] as const;
  const hd = [sh[0] + 4 + crouch * 2, sh[1] - 6 + crouch * 2] as const;
  const pedal = (k: number) =>
    [BBX + Math.cos(crank + k * Math.PI) * 4.5, BBY + Math.sin(crank + k * Math.PI) * 4.5] as const;
  const far = pedal(1);
  const near = r.foot ? ([-1, 0] as const) : pedal(0);
  const fk = ik(hip[0], hip[1], far[0], far[1], 12.5, 12.5);
  line(ctx, tone('#151A2E'), 3.4, [hip[0], hip[1], fk[0], fk[1], far[0], far[1]]);
  box(ctx, far[0] - 2, far[1] - 1, 5, 2, tone(SHOE));
  bikeParts(ctx, tone, r);
  // Torso, and the bag on her back with its reflective band.
  line(ctx, tone(JACKET), 7, [hip[0], hip[1], sh[0], sh[1]]);
  const mx = (hip[0] + sh[0]) / 2,
    my = (hip[1] + sh[1]) / 2;
  oval(
    ctx,
    mx - 3.2,
    my + 0.5,
    3,
    4.6,
    tone('#262A3A'),
    Math.atan2(sh[0] - hip[0], hip[1] - sh[1]),
  );
  line(ctx, alpha(tone('#E6ECF4'), 0.7), 1, [mx - 1, my - 3, mx + 3.5, my + 1]);
  const nk = ik(hip[0], hip[1], near[0], near[1], 12.5, 12.5);
  line(ctx, tone(PANTS), 3.6, [hip[0], hip[1], nk[0], nk[1], near[0], near[1]]);
  box(ctx, near[0] - 2, near[1] - 1.2, 5.5, 2.4, tone(SHOE));
  box(ctx, near[0] - 1.5, near[1] - 2.2, 2, 1, alpha(tone('#DDE6F0'), 0.8));
  const el = ik(sh[0], sh[1], 12, -27, 8, 8.5, -1);
  line(ctx, tone(JACKET_D), 2.8, [sh[0], sh[1], el[0], el[1], 12, -27]);
  disc(ctx, 12, -27, 1.5, tone(GLOVE));
  hoodHead(ctx, hd[0], hd[1], tone, r.rim);
  // The radio on her strap.
  box(ctx, sh[0] + 0.5, sh[1] + 1.5, 2, 3, tone('#15161E'));
  box(ctx, sh[0] + 1, sh[1] + 1.8, 1, 1, '#7DFF9E');
  if (r.rim) line(ctx, alpha(r.rim, 0.8), 0.9, [hip[0] - 3.2, hip[1] - 1, sh[0] - 3, sh[1] - 1.5]);
  ctx.restore();
}

type Run = {
  phase?: number;
  speed?: number;
  dark?: number;
  rim?: string;
  reach?: readonly [number, number];
  box?: boolean;
  lean?: number;
  facing?: 1 | -1;
};
/** Kai on foot, side on, hugging the box; (x, y) is the ground under her. */
function runner(ctx: Ctx, x: number, y: number, s: number, r: Run = {}) {
  const tone = toner(r.dark ?? 0);
  const ph = r.phase ?? 0,
    sp = r.speed ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (r.facing ?? 1), s);
  const bob = sp * Math.abs(Math.cos(ph)) * 1.6;
  const hip = [0, -23 - bob] as const;
  const lean = r.lean ?? 0.08 + 0.26 * sp;
  const sh = [hip[0] + Math.sin(lean) * 14, hip[1] - Math.cos(lean) * 14] as const;
  const hd = [sh[0] + 2 + Math.sin(lean) * 5, sh[1] - 7] as const;
  const leg = (k: number, color: string) => {
    const a = ph + k * Math.PI;
    const f =
      sp < 0.15
        ? ([k ? -2.5 : 2.5, 0] as const)
        : ([8.5 * Math.sin(a) * sp, -Math.max(0, Math.cos(a)) * 7 * sp] as const);
    const kn = ik(hip[0], hip[1], f[0], f[1], 11.5, 11.5);
    line(ctx, color, 3.6, [hip[0], hip[1], kn[0], kn[1], f[0], f[1]]);
    box(ctx, f[0] - 2, f[1] - 1.2, 5.5, 2.4, tone(SHOE));
  };
  leg(1, tone('#151A2E'));
  line(ctx, tone(JACKET), 7, [hip[0], hip[1], sh[0], sh[1]]);
  oval(ctx, (hip[0] + sh[0]) / 2 - 3.4, (hip[1] + sh[1]) / 2, 3, 4.6, tone('#262A3A'), lean);
  leg(0, tone(PANTS));
  const bx = sh[0] + 2.5,
    by = sh[1] + 3;
  if (r.box ?? true) {
    box(ctx, bx, by, 10, 7, tone(WHITE));
    box(ctx, bx + 4, by + 1, 2, 5, tone(RED));
    box(ctx, bx + 2.5, by + 2.5, 5, 2, tone(RED));
    box(ctx, bx + 6.5, by - 0.6, 2.5, 0.8, '#FF5A6A');
  }
  if (r.reach) {
    const el = ik(sh[0], sh[1], r.reach[0], r.reach[1], 8, 8.5, -1);
    line(ctx, tone(JACKET_D), 2.8, [sh[0], sh[1], el[0], el[1], r.reach[0], r.reach[1]]);
    disc(ctx, r.reach[0], r.reach[1], 1.5, tone(GLOVE));
  } else {
    line(ctx, tone(JACKET_D), 2.8, [sh[0], sh[1], sh[0] + 1, sh[1] + 8, bx + 8.5, by + 7]);
    disc(ctx, bx + 8.5, by + 6.5, 1.5, tone(GLOVE));
  }
  hoodHead(ctx, hd[0], hd[1], tone, r.rim);
  box(ctx, sh[0] + 0.5, sh[1] + 1.5, 2, 3, tone('#15161E'));
  ctx.restore();
}

/** Kai from overhead: on the bike, or running with the box. Heading 0 is screen right. */
function kaiTop(ctx: Ctx, x: number, y: number, s: number, heading: number, bike = true, ph = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(s, s);
  oval(ctx, 1, 1.5, 12, 5, alpha('#000000', 0.35));
  if (bike) {
    line(ctx, '#07080D', 2, [-11, 0, 11, 0]);
    line(ctx, FRAME, 1.2, [-6, 0, 7, 0]);
    line(ctx, '#2A2E3A', 1.2, [7, -5, 7, 5]);
    box(ctx, 9, -3.5, 6, 7, WHITE);
    box(ctx, 11.3, -2.5, 1.4, 5, RED);
    box(ctx, 10, -0.7, 4, 1.4, RED);
    line(ctx, JACKET_D, 1.6, [0, -3.5, 6.5, -5]);
    line(ctx, JACKET_D, 1.6, [0, 3.5, 6.5, 5]);
  } else {
    const k = Math.sin(ph) * 3;
    oval(ctx, k, -2, 2.5, 1.5, PANTS);
    oval(ctx, -k, 2, 2.5, 1.5, PANTS);
    box(ctx, 3, -3, 5, 6, WHITE);
    box(ctx, 5, -2.2, 1.2, 4.4, RED);
    line(ctx, JACKET_D, 1.6, [0, -3.5, 5, -3.5]);
    line(ctx, JACKET_D, 1.6, [0, 3.5, 5, 3.5]);
  }
  oval(ctx, -1, 0, 3.6, 5, JACKET);
  box(ctx, -4.5, -2, 3, 4, '#262A3A');
  disc(ctx, 1.8, 0, 3, JACKET);
  disc(ctx, 2.6, 0, 1.7, JACKET_D);
  ctx.restore();
}

/** Kai from behind on the bike, for the chase camera. */
function riderRear(ctx: Ctx, x: number, y: number, s: number, crank: number, lean = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(lean);
  oval(ctx, 0, 0, 6, 1.6, alpha('#000000', 0.4));
  oval(ctx, 0, -9, 1.9, 9, '#06070C');
  for (const side of [-1, 1]) {
    const k = Math.sin(crank + (side > 0 ? 0 : Math.PI));
    line(ctx, side > 0 ? PANTS : '#1A2038', 3.6, [
      side * 3.5,
      -27,
      side * 5.5,
      -19 - k * 3,
      side * 4,
      -8 - k * 4,
    ]);
    box(ctx, side * 4 - 2, -8 - k * 4, 4, 2.5, SHOE);
  }
  box(ctx, -4, -27, 8, 2, '#0D0E15');
  glow(ctx, 0, -22, 8, TAIL, 0.45);
  box(ctx, -1.2, -23, 2.4, 2, '#FF4A5E');
  poly(ctx, JACKET, [-8, -27, 8, -27, 11, -44, -11, -44]);
  box(ctx, -5.5, -41, 11, 10, '#262A3A');
  line(ctx, alpha('#E8EEF6', 0.85), 1.2, [-7.5, -29, 7.5, -42.5]);
  line(ctx, alpha('#E8EEF6', 0.85), 1.2, [7.5, -29, -7.5, -42.5]);
  line(ctx, JACKET_D, 2.8, [-10, -42, -15, -36, -12, -33]);
  line(ctx, JACKET_D, 2.8, [10, -42, 15, -36, 12, -33]);
  disc(ctx, 0, -50, 7, JACKET);
  box(ctx, -5, -46, 10, 2, JACKET_D);
  line(ctx, alpha(MAGENTA, 0.7), 0.9, [-11, -44, -8, -27]);
  line(ctx, alpha(CYAN, 0.6), 0.9, [11, -44, 8, -27]);
  ctx.restore();
}

// ——— Faces for the close-ups ———
type Lips = 'flat' | 'grit' | 'open' | 'breath' | 'smile' | 'laugh';
type Face = {
  lid?: number;
  look?: readonly [number, number];
  brow?: number;
  mouth?: Lips;
  hood?: number;
  turn?: number;
  wet?: number;
  rimL?: string;
  rimR?: string;
  shade?: number;
  tear?: number;
  tilt?: number;
  happy?: number;
  smile?: number;
  catch?: readonly [string, string];
  collar?: boolean;
  night?: string;
};
type EyeLook = {
  lid: number;
  look: readonly [number, number];
  happy: number;
  smile: number;
  catch: readonly [string, string];
  tear: number;
  iris: string;
};
function eyeAt(ctx: Ctx, ex: number, ey: number, w: number, o: EyeLook, tone: Tone, skin: string) {
  if (o.happy > 0.5) {
    line(ctx, tone(INK), 1.4, [ex - 4.2 * w, ey + 0.8, ex, ey - 1.6, ex + 4.2 * w, ey + 0.8]);
    return;
  }
  oval(ctx, ex, ey, 4.6 * w, 2.7, tone('#E4DED6'));
  const ix = ex + o.look[0] * 2 * w,
    iy = ey + o.look[1] * 0.9;
  disc(ctx, ix, iy, 2.4, tone(o.iris));
  disc(ctx, ix, iy, 1.15, '#040306');
  box(ctx, ix - 1.5, iy - 1.4, 1, 1, o.catch[0]);
  box(ctx, ix + 0.6, iy - 0.8, 0.8, 0.8, o.catch[1]);
  const lid = clamp(o.lid);
  box(ctx, ex - 5 * w, ey - 3.3, 10 * w, 0.7 + lid * 6.2, skin);
  const ly = ey - 2.6 + lid * 5.2;
  line(ctx, tone(INK), 1.1, [ex - 4.9 * w, ly + 0.3, ex, ly - 0.4, ex + 4.9 * w, ly + 0.4]);
  if (o.smile > 0) box(ctx, ex - 5 * w, ey + 2.9 - o.smile * 2, 10 * w, 1 + o.smile * 2, skin);
  line(ctx, alpha(tone(SKIN_D), 0.8), 0.7, [
    ex - 3.6 * w,
    ey + 3.3 - o.smile * 1.6,
    ex + 3.6 * w,
    ey + 3.3 - o.smile * 1.6,
  ]);
  if (o.tear > 0)
    line(ctx, alpha('#DDF4FF', 0.85 * o.tear), 0.8, [ex - 3 * w, ey + 2.7, ex + 3.2 * w, ey + 2.5]);
}
function rimArc(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, a0, a1);
  ctx.stroke();
}
function mouthAt(ctx: Ctx, mx: number, m: Lips, tone: Tone) {
  const lip = tone('#5C2B2C'),
    dark = tone('#361014'),
    teeth = tone('#EFE9DF');
  if (m === 'flat') line(ctx, lip, 1.4, [mx - 5, 14.6, mx + 5, 14.6]);
  else if (m === 'grit') {
    box(ctx, mx - 5.5, 12.8, 11, 3.6, teeth);
    line(ctx, lip, 1, [mx - 6, 12.7, mx + 6, 12.7]);
    line(ctx, lip, 1, [mx - 6, 16.5, mx + 6, 16.5]);
    line(ctx, alpha(lip, 0.6), 0.6, [mx - 5, 14.6, mx + 5, 14.6]);
  } else if (m === 'open') oval(ctx, mx, 15, 3.8, 3.3, dark);
  else if (m === 'breath') oval(ctx, mx, 14.8, 2.4, 1.5, dark);
  else if (m === 'smile')
    line(ctx, lip, 1.4, [mx - 6.5, 12.8, mx - 2.5, 15.4, mx + 2.5, 15.4, mx + 6.5, 12.8]);
  else {
    poly(ctx, dark, [mx - 7.5, 12.4, mx + 7.5, 12.4, mx + 4.5, 18.6, mx - 4.5, 18.6]);
    box(ctx, mx - 6.5, 12.4, 13, 1.8, teeth);
  }
}
/** Kai's face, big, in the flat pixel style: face oval 38 × 46 units at s = 1. */
function kaiFace(ctx: Ctx, x: number, y: number, s: number, f: Face, sec: number) {
  const tone = toner(f.shade ?? 0.2, f.night ?? '#0A0C24');
  const turn = f.turn ?? 0,
    hood = f.hood ?? 1,
    fx = turn * 5;
  const skin = tone(SKIN);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (f.tilt) ctx.rotate(f.tilt);
  if (f.collar ?? true)
    poly(ctx, tone(JACKET_D), [-46, 70, -34, 27, -12, 21, 12, 21, 34, 27, 46, 70]);
  const drop = (1 - hood) * 16;
  if (hood > 0) {
    oval(ctx, -turn * 3, -5 + drop, 31, 34, tone(JACKET));
    oval(ctx, -turn * 2, drop, 24.5, 29, tone(mix(JACKET_D, '#2A1E08', 0.35)));
  }
  oval(ctx, fx * 0.2, -9, 21, 17.5, tone(HAIR));
  box(ctx, -7 + fx * 0.3, 14, 14, 11, tone(SKIN_D));
  oval(ctx, fx * 0.25, 0, 19, 23, skin);
  oval(ctx, fx * 0.25, 8, 15.5, 16.5, skin);
  oval(ctx, fx * 0.25 + (turn >= 0 ? -12 : 12), 3, 7.5, 19, alpha(tone(SKIN_D), 0.5));
  poly(ctx, tone(HAIR), [
    -19 + fx * 0.2,
    -6,
    -17,
    -18,
    -2,
    -24,
    15,
    -20,
    19.5 + fx * 0.2,
    -7,
    13 + fx * 0.3,
    -12,
    7 + fx * 0.3,
    -8,
    1 + fx * 0.3,
    -13,
    -6 + fx * 0.3,
    -9,
    -12 + fx * 0.3,
    -12,
  ]);
  if (hood > 0.5)
    poly(ctx, tone(JACKET), [
      -26,
      -12 + drop,
      -20,
      -26 + drop,
      0,
      -32 + drop,
      20,
      -26 + drop,
      26,
      -12 + drop,
      19,
      -18 + drop,
      0,
      -23 + drop,
      -19,
      -18 + drop,
    ]);
  const b = f.brow ?? 0;
  for (const side of [-1, 1]) {
    const cx = side * 9 + fx;
    line(ctx, tone(HAIR), 2.5, [cx + side * 5.5, -9.5 - b * 0.6, cx - side * 4.5, -10 - b * 2.6]);
  }
  const eo: EyeLook = {
    lid: f.lid ?? 0.2,
    look: f.look ?? [0, 0],
    happy: f.happy ?? 0,
    smile: f.smile ?? 0,
    catch: f.catch ?? [alpha(MAGENTA, 0.9), alpha(CYAN, 0.9)],
    tear: f.tear ?? 0,
    iris: '#3B2417',
  };
  for (const side of [-1, 1]) {
    const w = 1 - Math.max(0, -side * turn) * 0.28;
    eyeAt(ctx, side * 9 + fx * (side * turn > 0 ? 1.1 : 0.9), -2, w, eo, tone, skin);
  }
  line(ctx, alpha(tone(SKIN_D), 0.9), 1.3, [
    fx * 1.1 + 0.5,
    -1,
    fx * 1.2 + 2.6,
    7,
    fx * 1.2 + 0.2,
    8.6,
  ]);
  box(ctx, fx * 1.2 - 2.5, 8.2, 1.4, 0.9, tone('#5E3326'));
  box(ctx, fx * 1.2 + 1.5, 8.2, 1.4, 0.9, tone('#5E3326'));
  mouthAt(ctx, fx * 0.95, f.mouth ?? 'flat', tone);
  const wet = f.wet ?? 0;
  for (let i = 0; i < Math.round(wet * 6); i++) {
    const dx = (rand(i * 3.3) - 0.5) * 30;
    const dy = -16 + ((rand(i * 5.1) * 40 + sec * (3 + rand(i) * 4)) % 40);
    box(ctx, dx, dy, 0.6, 1.8, alpha('#E4F2FF', 0.4));
    box(ctx, dx, dy + 1.2, 0.6, 0.6, alpha('#FFFFFF', 0.6));
  }
  if (f.rimL) {
    rimArc(ctx, fx * 0.25, 0, 19, 23, Math.PI * 0.62, Math.PI * 1.3, f.rimL);
    if (hood > 0) rimArc(ctx, -turn * 3, -5 + drop, 31, 34, Math.PI * 0.75, Math.PI * 1.3, f.rimL);
  }
  if (f.rimR) {
    rimArc(ctx, fx * 0.25, 0, 19, 23, -Math.PI * 0.32, Math.PI * 0.38, f.rimR);
    if (hood > 0) rimArc(ctx, -turn * 3, -5 + drop, 31, 34, -Math.PI * 0.3, Math.PI * 0.25, f.rimR);
  }
  ctx.restore();
}
type Doc = {
  turn?: number;
  look?: readonly [number, number];
  smile?: number;
  lid?: number;
  shade?: number;
  brow?: number;
};
/** The surgeon: cap, mask, and kind tired eyes. Same units as Kai's face. */
function surgeonFace(ctx: Ctx, x: number, y: number, s: number, f: Doc) {
  const tone = toner(f.shade ?? 0.12, '#0E1A22');
  const turn = f.turn ?? 0,
    fx = turn * 5,
    smile = f.smile ?? 0;
  const skin = tone(DOC_SKIN);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  poly(ctx, tone(SCRUBS), [-50, 70, -38, 27, -12, 20, 12, 20, 38, 27, 50, 70]);
  poly(ctx, tone(SCRUBS_D), [-10, 21, 10, 21, 0, 34]);
  box(ctx, -7 + fx * 0.3, 13, 14, 10, tone('#B98466'));
  oval(ctx, -19 + fx * 0.2, 0, 3, 5, skin);
  oval(ctx, 19 + fx * 0.2, 0, 3, 5, skin);
  oval(ctx, fx * 0.25, 0, 19, 23, skin);
  oval(ctx, fx * 0.25, 8, 15.5, 16, skin);
  oval(ctx, fx * 0.25 + (turn >= 0 ? -12 : 12), 2, 7, 18, alpha(tone('#A8765A'), 0.45));
  poly(
    ctx,
    tone('#5AAE90'),
    [-21, -4, -20, -18, -10, -27, 8, -28, 19, -20, 21, -4, 14, -11, 0, -13, -14, -11],
  );
  for (let i = 0; i < 6; i++)
    box(ctx, -14 + i * 5.5, -22 + (i % 2) * 5, 1.5, 1.5, alpha(tone('#CFEFE2'), 0.5));
  box(ctx, -20, -6, 3, 6, tone('#BDB6AE'));
  box(ctx, 17, -6, 3, 6, tone('#BDB6AE'));
  const b = f.brow ?? 0.2;
  for (const side of [-1, 1]) {
    const cx = side * 9 + fx;
    line(ctx, tone('#7A6A60'), 2.2, [
      cx + side * 5.5,
      -9 - b * 0.6,
      cx - side * 4.5,
      -9.5 - b * 2.2,
    ]);
  }
  const eo: EyeLook = {
    lid: f.lid ?? 0.2,
    look: f.look ?? [0, 0],
    happy: 0,
    smile,
    catch: [alpha('#FFFFFF', 0.85), alpha('#FFE6C0', 0.7)],
    tear: 0,
    iris: '#4E5E3C',
  };
  for (const side of [-1, 1]) {
    const w = 1 - Math.max(0, -side * turn) * 0.28;
    const ex = side * 9 + fx * (side * turn > 0 ? 1.1 : 0.9);
    eyeAt(ctx, ex, -2, w, eo, tone, skin);
    if (smile > 0.1)
      line(ctx, alpha(tone('#8A5A44'), 0.8 * smile), 0.7, [
        ex + side * 5.5 * w,
        -3,
        ex + side * 7.5 * w,
        -4.5,
        ex + side * 5.8 * w,
        -1,
        ex + side * 7.8 * w,
        0.5,
      ]);
  }
  const up = smile * 1.4;
  poly(ctx, tone(MASK), [
    -18 + fx * 0.2,
    3 - up,
    -8 + fx * 0.3,
    1 - up,
    fx * 0.3,
    2 - up,
    8 + fx * 0.3,
    1 - up,
    18 + fx * 0.2,
    3 - up,
    16 + fx * 0.2,
    17,
    8,
    23,
    fx * 0.2,
    25,
    -8,
    23,
    -16 + fx * 0.2,
    17,
  ]);
  line(ctx, alpha(tone('#7FB5A2'), 0.9), 0.8, [-15, 9, 15, 9]);
  line(ctx, alpha(tone('#7FB5A2'), 0.9), 0.8, [-14, 14, 14, 14]);
  line(ctx, tone('#E4F2EC'), 0.8, [
    -8 + fx * 0.3,
    1.4 - up,
    fx * 0.3,
    2.3 - up,
    8 + fx * 0.3,
    1.4 - up,
  ]);
  line(ctx, tone('#E4F2EC'), 0.7, [-18 + fx * 0.2, 3 - up, -20 + fx * 0.2, -1]);
  line(ctx, tone('#E4F2EC'), 0.7, [18 + fx * 0.2, 3 - up, 20 + fx * 0.2, -1]);
  ctx.restore();
}

/** Kai from the front: riding toward the camera, or running with the box in her arms. */
function kaiFront(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  o: { phase?: number; ride?: boolean; face?: Face; sec: number; lean?: number; dark?: number },
) {
  const tone = toner(o.dark ?? 0);
  const ph = o.phase ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (o.lean) ctx.rotate(o.lean);
  if (o.ride) {
    oval(ctx, 0, 0, 7, 1.8, alpha('#000000', 0.4));
    oval(ctx, 0, -10, 2.2, 10, tone('#07080D'));
    line(ctx, tone(FRAME), 1.4, [-2.5, -10, -2, -25, 2, -25, 2.5, -10]);
    for (const side of [-1, 1]) {
      const k = Math.sin(ph + (side > 0 ? 0 : Math.PI));
      line(ctx, tone(side > 0 ? PANTS : '#1A2038'), 4, [
        side * 4,
        -30,
        side * 8,
        -25 + k * 4,
        side * 6,
        -8 + k * 4,
      ]);
      box(ctx, side * 6 - 2, -8 + k * 4, 4, 2.5, tone(SHOE));
    }
  } else
    for (const side of [-1, 1]) {
      const lift = Math.max(0, Math.cos(ph + (side > 0 ? 0 : Math.PI)));
      line(ctx, tone(side > 0 ? PANTS : '#1A2038'), 4.2, [
        side * 3.5,
        -26,
        side * 4,
        -13 - lift * 6,
        side * 4,
        -lift * 9,
      ]);
      box(ctx, side * 4 - 2.5, -lift * 9 - 1, 5, 3, tone(SHOE));
    }
  poly(ctx, tone(JACKET), [-9, -24, 9, -24, 11.5, -44, -11.5, -44]);
  line(ctx, alpha(tone('#E8EEF2'), 0.8), 1.2, [-9, -29, 9, -29]);
  box(ctx, -7, -43, 2, 4, tone('#15161E'));
  box(ctx, -6.5, -42.5, 1, 1, '#7DFF9E');
  if (o.ride) {
    line(ctx, tone('#2A2E3A'), 1.4, [-14, -34, 14, -34]);
    line(ctx, tone(JACKET_D), 3, [-11, -42, -14, -38, -13, -34]);
    line(ctx, tone(JACKET_D), 3, [11, -42, 14, -38, 13, -34]);
    disc(ctx, -13.5, -34, 1.6, tone(GLOVE));
    disc(ctx, 13.5, -34, 1.6, tone(GLOVE));
    box(ctx, -7, -33, 14, 9, tone(WHITE));
    box(ctx, -7, -33, 14, 1, tone('#FFFFFF'));
    box(ctx, -1, -32, 2, 7, tone(RED));
    box(ctx, -3.5, -29.5, 7, 2, tone(RED));
  } else {
    box(ctx, -8, -41, 16, 11, tone(WHITE));
    box(ctx, -8, -41, 16, 1, tone('#FFFFFF'));
    box(ctx, -8, -38, 16, 3, tone(RED));
    box(ctx, 3, -42, 4, 1, '#FF5A6A');
    line(ctx, tone(JACKET_D), 3, [-11, -42, -12, -34, -7, -31]);
    line(ctx, tone(JACKET_D), 3, [11, -42, 12, -34, 7, -31]);
    disc(ctx, -6.5, -31.5, 1.6, tone(GLOVE));
    disc(ctx, 6.5, -31.5, 1.6, tone(GLOVE));
  }
  kaiFace(ctx, 0, -55, 0.36, { collar: false, ...o.face }, o.sec);
  ctx.restore();
}

/** Kai sitting, facing us: on the corridor bench, then on the hospital steps. */
function kaiSit(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  o: {
    shake?: number;
    face: Face;
    hands?: 'lap' | 'knees' | 'radio' | 'back';
    sec: number;
    lean?: number;
    radio?: boolean;
    wet?: number;
  },
) {
  const tone = toner(o.face.shade ?? 0.1, o.face.night ?? '#0A0C24');
  const jit = (o.shake ?? 0) * Math.sin(o.sec * 34) * 0.8;
  const wet = o.wet ?? 0;
  const jacket = tone(mix(JACKET, JACKET_D, wet * 0.45));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Seated, facing us: thighs foreshortened, knees wide and up at hip height.
  for (const side of [-1, 1]) {
    const j = side > 0 ? jit : -jit;
    const leg = tone(side > 0 ? PANTS : '#1C2340');
    const kx = side * 10 + j;
    line(ctx, leg, 7, [side * 5, -2, kx, 1]);
    line(ctx, leg, 5.5, [kx, 2, side * 9 + j * 0.4, 25]);
    disc(ctx, kx, 1, 4.2, tone(side > 0 ? '#2C3558' : '#252D4C'));
    box(ctx, side * 9 - 3.5 + j * 0.4, 24, 7, 3, tone(SHOE));
    box(ctx, side * 9 - 3.5 + j * 0.4, 23, 7, 1, alpha(tone('#DDE6F0'), 0.6));
  }
  ctx.save();
  ctx.rotate(o.lean ?? 0);
  poly(ctx, jacket, [-11, -1, 11, -1, 12.5, -26, -12.5, -26]);
  line(ctx, alpha(tone('#E8EEF2'), 0.75), 1.2, [-11, -8, 11, -8]);
  oval(ctx, 0, -27, 12, 4, tone(JACKET_D));
  if (o.radio ?? true) {
    box(ctx, -8, -22, 4, 6, tone('#15161E'));
    line(ctx, tone('#15161E'), 0.8, [-7, -22, -7, -26]);
    if (o.hands !== 'back' || o.sec < 0) box(ctx, -7, -21, 1.2, 1.2, '#7DFF9E');
  }
  const arm = (side: number, hand: readonly [number, number]) => {
    line(ctx, tone(JACKET_D), 4, [side * 12, -24, side * 14, -11, hand[0], hand[1]]);
    disc(ctx, hand[0], hand[1], 2, tone(GLOVE));
  };
  const h = o.hands ?? 'lap';
  if (h === 'knees') {
    arm(-1, [-9 - jit, -2]);
    arm(1, [9 + jit, -2]);
  } else if (h === 'radio') {
    arm(-1, [-9, -2]);
    line(ctx, tone(JACKET_D), 4, [12, -24, 4, -14, -5, -19]);
    disc(ctx, -5, -19, 2, tone(GLOVE));
  } else if (h === 'back') {
    line(ctx, tone(JACKET_D), 4, [-12, -24, -17, -10, -19, 2]);
    line(ctx, tone(JACKET_D), 4, [12, -24, 17, -10, 19, 2]);
  } else {
    arm(-1, [-2, 1]);
    arm(1, [2, 1]);
  }
  kaiFace(ctx, 0, -38, 0.42, { collar: false, ...o.face }, o.sec);
  ctx.restore();
  ctx.restore();
}

// ——— Vehicles ———
function carRear(ctx: Ctx, x: number, y: number, s: number, color: string, door = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  oval(ctx, 0, 0, 17, 2.5, alpha('#000000', 0.4));
  box(ctx, -14, -4, 5, 4, '#050509');
  box(ctx, 9, -4, 5, 4, '#050509');
  poly(ctx, color, [-15, -3, 15, -3, 15, -11, 11, -19, -11, -19, -15, -11]);
  poly(ctx, '#121828', [-10, -12, 10, -12, 8, -17.5, -8, -17.5]);
  line(ctx, alpha(MAGENTA, 0.35), 0.8, [-7, -13, -3, -17]);
  box(ctx, -15, -4.5, 30, 1.5, mix(color, '#000000', 0.4));
  box(ctx, -3, -8, 6, 2.5, '#8E96A8');
  glow(ctx, -12, -9, 9, TAIL, 0.55);
  glow(ctx, 12, -9, 9, TAIL, 0.55);
  box(ctx, -14.5, -10.5, 5, 2.5, '#FF5A6E');
  box(ctx, 9.5, -10.5, 5, 2.5, '#FF5A6E');
  // Their smeared reflections in the wet road.
  box(ctx, -13, 1, 2, 3, alpha(TAIL, 0.14));
  box(ctx, 11, 1, 2, 3, alpha(TAIL, 0.14));
  box(ctx, -13, 5, 2, 3, alpha(TAIL, 0.07));
  box(ctx, 11, 5, 2, 3, alpha(TAIL, 0.07));
  if (door > 0) {
    // The driver's door, flung open into the gap, lit from inside.
    const reach = door * 17;
    glow(ctx, -16, -10, 22, '#FFD89A', 0.6 * door);
    poly(ctx, '#4A5070', [-15, -2, -15 - reach, -1, -15 - reach, -16, -15, -17]);
    poly(ctx, '#E8C890', [-15, -4, -15 - reach * 0.92, -3, -15 - reach * 0.92, -9, -15, -9.5]);
    poly(ctx, '#20283C', [
      -15,
      -10.5,
      -15 - reach * 0.92,
      -10,
      -15 - reach * 0.85,
      -15,
      -15,
      -15.5,
    ]);
    box(ctx, -15 - reach, -16, 1.5, 15, '#FFE9B8');
  }
  ctx.restore();
}
function carTop(ctx: Ctx, x: number, y: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  box(ctx, -12, -6, 24, 12, color);
  box(ctx, -4, -5, 10, 10, mix(color, '#FFFFFF', 0.12));
  box(ctx, 5, -5, 3, 10, '#121828');
  box(ctx, -8, -5, 3, 10, '#121828');
  glow(ctx, 17, -4, 10, HEADLIGHT, 0.3);
  glow(ctx, 17, 4, 10, HEADLIGHT, 0.3);
  box(ctx, -12, -5, 1, 3, TAIL);
  box(ctx, -12, 2, 1, 3, TAIL);
  ctx.restore();
}
function busFront(ctx: Ctx, x: number, y: number, s: number, lights = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  glow(ctx, 0, -8, 70, HEADLIGHT, 0.2 * lights);
  box(ctx, -22, -52, 44, 49, '#1E2A4E');
  box(ctx, -22, -52, 44, 3, '#2C3A66');
  box(ctx, -22, -18, 44, 3, MAGENTA);
  box(ctx, -19, -45, 38, 22, '#0E1426');
  line(ctx, alpha(CYAN, 0.35), 1, [-15, -26, -6, -44]);
  box(ctx, 6, -36, 7, 12, '#070910');
  disc(ctx, 9.5, -38, 3, '#070910');
  box(ctx, -15, -51, 30, 5, '#07080C');
  write(ctx, '44 NIGHT', 0, -47, { size: 4, color: AMBER });
  line(ctx, '#05060A', 0.8, [-12, -24, -2, -32]);
  line(ctx, '#05060A', 0.8, [4, -24, 14, -32]);
  box(ctx, -22, -6, 44, 4, '#12182C');
  box(ctx, -21, -3, 7, 3, '#050509');
  box(ctx, 14, -3, 7, 3, '#050509');
  for (const side of [-1, 1]) {
    glow(ctx, side * 15, -10, 18, HEADLIGHT, 0.6 * lights);
    disc(ctx, side * 15, -10, 3, HEADLIGHT);
  }
  ctx.restore();
}
function ambulance(ctx: Ctx, x: number, y: number, s: number, sec: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  box(ctx, -30, -30, 60, 26, '#C9D0DA');
  box(ctx, 18, -22, 14, 18, '#C9D0DA');
  box(ctx, 20, -20, 9, 7, '#1A2238');
  box(ctx, -30, -16, 62, 4, RED);
  box(ctx, -8, -27, 4, 10, RED);
  box(ctx, -11, -24, 10, 4, RED);
  disc(ctx, -18, -4, 5, '#0A0B10');
  disc(ctx, 20, -4, 5, '#0A0B10');
  // Roof lights: a slow, soft alternation, never a strobe.
  const a = lamp(sec, 0, 0.7);
  glow(ctx, -20, -32, 22, '#4A7CFF', 0.2 + 0.3 * a);
  glow(ctx, 0, -32, 22, TAIL, 0.2 + 0.3 * (1 - a));
  box(ctx, -24, -33, 8, 3, mix('#2A3A80', '#8AB0FF', a));
  box(ctx, -4, -33, 8, 3, mix('#801A2A', '#FF7A8A', 1 - a));
  ctx.restore();
}

// ——— The cold box ———
const SEGMENTS = [
  'abcdef',
  'bc',
  'abdeg',
  'abcdg',
  'bcfg',
  'acdfg',
  'acdefg',
  'abc',
  'abcdefg',
  'abcdfg',
];
function segWidth(text: string, h: number) {
  const w = Math.round(h * 0.56),
    th = Math.max(1, Math.round(h / 8)),
    gap = Math.max(2, Math.round(h * 0.2));
  let total = 0;
  for (const ch of text) total += (ch === ':' ? th : w) + gap;
  return total - gap;
}
/** Seven-segment digits: big, blocky, and readable from the back of the field. */
function sevenSeg(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  h: number,
  on: string,
  off: string,
) {
  const w = Math.round(h * 0.56),
    th = Math.max(1, Math.round(h / 8)),
    gap = Math.max(2, Math.round(h * 0.2)),
    half = Math.round(h / 2);
  let cx = x;
  for (const ch of text) {
    if (ch === ':') {
      box(ctx, cx, y + h * 0.28, th, th, on);
      box(ctx, cx, y + h * 0.64, th, th, on);
      cx += th + gap;
      continue;
    }
    const lit = SEGMENTS[Number(ch)] ?? '';
    const seg = (id: string, sx: number, sy: number, sw: number, sh: number) =>
      box(ctx, sx, sy, sw, sh, lit.includes(id) ? on : off);
    seg('a', cx + th, y, w - 2 * th, th);
    seg('b', cx + w - th, y + th, th, half - th);
    seg('c', cx + w - th, y + half, th, h - half - th);
    seg('d', cx + th, y + h - th, w - 2 * th, th);
    seg('e', cx, y + half, th, h - half - th);
    seg('f', cx, y + th, th, half - th);
    seg('g', cx + th, y + half - th / 2, w - 2 * th, th);
    cx += w + gap;
  }
}
type LidLook = {
  S: number;
  press?: number;
  beads?: number;
  scuff?: number;
  night?: number;
  sy?: number;
  pulse?: number;
};
/** The lid of the box, seen from above: 200 × 120 units at s = 1. */
function lid(ctx: Ctx, x: number, y: number, s: number, rot: number, o: LidLook) {
  const left = remaining(o.S);
  const col = clockColor(left);
  const text = readout(left);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s * (o.sy ?? 1));
  box(ctx, -95, -53, 200, 120, alpha('#000000', 0.45));
  box(ctx, -100, -58, 200, 116, '#C9D3DC');
  box(ctx, -98, -60, 196, 120, '#C9D3DC');
  box(ctx, -96, -56, 192, 110, '#E6ECF0');
  box(ctx, -96, -52, 192, 20, RED);
  write(ctx, 'URGENT', 0, -36.5, { size: 15, color: '#FFFFFF' });
  write(ctx, "ST. ALDER'S HOSPITAL", 0, 47, { size: 9, color: '#34404D' });
  write(ctx, 'START', 72, 22, { size: 6, color: '#56606E' });
  const press = o.press ?? 0;
  disc(ctx, 72, -3, 12.5, '#8E1C2C');
  disc(ctx, 72, -4 + press * 1.2, 10.5, press > 0.5 ? '#B8263A' : '#E03A50');
  box(ctx, 67, -10, 4, 2, alpha('#FFFFFF', 0.4));
  if (o.scuff) {
    line(ctx, alpha('#5A4A42', 0.55 * o.scuff), 2, [-92, 34, -44, 20]);
    line(ctx, alpha('#5A4A42', 0.45 * o.scuff), 1.2, [40, -57, 74, -44]);
    line(ctx, alpha('#5A4A42', 0.45 * o.scuff), 1, [-60, 54, -20, 50]);
  }
  box(ctx, -100, -60, 200, 120, alpha('#1A2150', o.night ?? 0.3));
  box(ctx, -74, -26, 122, 50, '#1A2230');
  box(ctx, -72, -24, 118, 46, '#07100C');
  glow(ctx, -13, -1, 80, col, 0.16 + 0.16 * (o.pulse ?? 0));
  const width = segWidth(text, 32);
  sevenSeg(ctx, text, -13 - width / 2, -17, 32, col, alpha(col, 0.07));
  for (let i = 0; i < Math.round((o.beads ?? 0) * 16); i++) {
    const bx = -90 + rand(i * 7.7) * 180,
      by = -54 + rand(i * 3.9) * 104;
    oval(ctx, bx, by, 1.6 + rand(i) * 1.6, 1.3 + rand(i) * 1.2, alpha('#DDEBFF', 0.35));
    box(ctx, bx - 0.5, by - 0.8, 1, 1, alpha('#FFFFFF', 0.8));
  }
  ctx.restore();
}
/** The box in three-quarter view, front face 30 × 18 units at s = 1; (x, y) is its base. */
function box3(ctx: Ctx, x: number, y: number, s: number, S: number) {
  const left = remaining(S);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  oval(ctx, 3, 0.5, 20, 2.5, alpha('#000000', 0.35));
  poly(ctx, '#AEB9C4', [15, 0, 21, -6, 21, -24, 15, -18]);
  poly(ctx, '#F4F7F9', [-15, -18, 15, -18, 21, -24, -9, -24]);
  box(ctx, -15, -18, 30, 18, '#E3E9ED');
  box(ctx, -15, -15, 30, 5, RED);
  write(ctx, 'URGENT', 0, -11, { size: 4.2, color: '#FFFFFF' });
  write(ctx, "ST. ALDER'S", 0, -4, { size: 3, color: '#34404C' });
  poly(ctx, '#0A120E', [-3, -19.5, 9, -19.5, 12, -22.5, 0, -22.5]);
  box(ctx, 1, -21.5, 7, 1, alpha(clockColor(left), 0.8));
  box(ctx, 16, -12, 3, 5, '#96A2AE');
  ctx.restore();
}

// ——— Shots ———
function cityShot(ctx: Ctx, c: Cut) {
  const crane = ease(span(c.t, 0.2, c.d));
  const lift = lerp(54, 0, crane);
  zoomed(ctx, 160, 90, 1 + crane * 0.05, () => {
    ctx.save();
    ctx.translate(0, lift);
    gradient(ctx, -80, 150, NIGHT_SKY);
    glow(ctx, 110, -20, 110, '#6A5A9A', 0.25);
    clouds(ctx, c.sec, -50, MAGENTA, 0.16);
    row(ctx, FAR, 20);
    box(ctx, 196, 20, 40, 120, '#121436');
    for (let j = 0; j < 8; j++)
      box(ctx, 202 + (j % 3) * 11, 60 + j * 8, 2, 3, alpha('#FFD27E', 0.7));
    heartSign(ctx, 216, 36, 1, MAGENTA);
    row(ctx, MID, 70);
    box(ctx, -40, 74, W + 80, 4, '#1B1E3C');
    for (let x = 10; x < W; x += 70) box(ctx, x, 78, 5, 60, '#121430');
    line(ctx, alpha('#5A6490', 0.6), 0.6, [-40, 52, W + 40, 52]);
    tramSide(ctx, 380 - c.sec * 31, 74, c.sec);
    row(ctx, NEAR, 0);
    depot(ctx, c.sec);
    box(ctx, -40, 150, W + 80, 90, ASPHALT);
    box(ctx, -40, 150, W + 80, 1, alpha('#9AB0E8', 0.3));
    reflect(
      ctx,
      150,
      c.sec,
      () => {
        row(ctx, NEAR, 0, true);
        depotLights(ctx, c.sec);
      },
      0.45,
      240,
    );
    steam(ctx, 70, 162, c.sec, 1, 60);
    rider(ctx, 244, 158, 1, { foot: true, crank: 0.5, dark: 0.2, rim: MAGENTA, box: false });
    ctx.restore();
  });
  rain(ctx, c.sec, 1.1, 0.22);
}
function depotLights(ctx: Ctx, sec: number) {
  glow(ctx, 273, 124, 40, '#CFF4E8', 0.3);
  box(ctx, 258, 114, 30, 18, '#BFE3D8');
  neonH(ctx, 273, 104, 'DISPATCH', CYAN, 0.85 + 0.15 * Math.sin(sec * 1.3), 6);
}
function depot(ctx: Ctx, sec: number) {
  box(ctx, 236, 64, 90, 87, '#0E1030');
  box(ctx, 236, 64, 90, 2, '#23265A');
  for (let j = 0; j < 4; j++) box(ctx, 246 + j * 18, 74, 8, 12, alpha('#9FE6FF', 0.25));
  depotLights(ctx, sec);
  box(ctx, 263, 117, 9, 15, '#3D5F8A');
  box(ctx, 256, 132, 34, 4, '#5A6478');
  poly(ctx, '#1F2A4A', [244, 108, 302, 108, 308, 113, 238, 113]);
  for (let i = 0; i < 4; i++) {
    const t = (sec * 0.9 + i * 0.29) % 1;
    box(ctx, 242 + i * 19, lerp(113, 150, easeIn(t)), 1, 2, alpha('#CFE2FF', 0.7));
  }
}

function eyesShot(ctx: Ctx, c: Cut) {
  box(ctx, 0, 0, W, H, '#07091A');
  bokeh(ctx, c.sec, 0.9);
  const heard = ease(span(c.S, RADIO_IN + 0.15, RADIO_IN + 0.6));
  const back = ease(span(c.S, 9.3, 9.9));
  const lidAmount =
    lerp(0.55, 0.22, heard) + hump(c.S, 6.2, 6.75) * 0.4 + hump(c.S, 10.15, 10.35) * 0.75;
  kaiFace(
    ctx,
    160,
    100 + c.k * 2,
    4.3 + c.k * 0.25,
    {
      lid: lidAmount,
      look: [lerp(0, -0.9, heard * (1 - back)), lerp(0.15, 0.7, heard * (1 - back))],
      brow: 0.35 * heard - 0.3 * back,
      wet: 1,
      rimL: alpha(MAGENTA, 0.9),
      rimR: alpha(CYAN, 0.8),
      shade: 0.32,
    },
    c.sec,
  );
  const talk = presence(c.S, RADIO_IN, 10.3, 0.2);
  glow(ctx, 30, 176, 44, '#6DFF9A', 0.24 * talk * (0.75 + 0.25 * Math.sin(c.sec * 9)));
  for (let i = 0; i < 3; i++) {
    const t = (c.sec * 0.8 + i * 0.37) % 1;
    box(ctx, [52, 118, 262][i], lerp(6, 190, easeIn(t)), 1.4, 3, alpha('#CFE2FF', 0.7));
  }
}

function hatchShot(ctx: Ctx, c: Cut) {
  box(ctx, 0, 0, W, H, '#0D1029');
  for (let y = 6, r = 0; y < H; y += 9, r++) {
    box(ctx, 0, y, W, 1, '#090B1F');
    for (let x = (r % 2) * 15; x < W; x += 30) box(ctx, x, y - 8, 1, 8, '#090B1F');
  }
  glow(ctx, 160, 76, 150, '#9FE6FF', 0.12);
  neonH(ctx, 160, 22, 'DISPATCH', CYAN, 0.9, 9);
  box(ctx, 70, 32, 180, 88, '#2A3040');
  box(ctx, 76, 36, 168, 80, '#C6E4DA');
  glow(ctx, 160, 70, 110, '#F0FFF8', 0.35);
  for (const sy of [52, 76]) {
    box(ctx, 80, sy, 64, 2, '#8FA8A2');
    for (let i = 0; i < 4; i++) box(ctx, 84 + i * 15, sy - 9, 12, 9, i % 2 ? '#E8EEF0' : '#D8E2E6');
  }
  // The night porter behind the hatch, cropped at the chin: scrubs, lanyard, badge.
  box(ctx, 193, 36, 14, 10, '#C98E6A');
  poly(ctx, '#3F6FA8', [166, 116, 168, 56, 184, 44, 216, 44, 232, 56, 234, 116]);
  poly(ctx, '#2E5688', [190, 44, 210, 44, 200, 58]);
  line(ctx, RED, 1.2, [190, 45, 196, 70, 204, 70, 210, 45]);
  box(ctx, 194, 70, 12, 9, '#F2F4F6');
  box(ctx, 196, 72, 5, 2, '#3A4450');
  const slide = ease(span(c.t, 0.2, 1.5)),
    grab = ease(span(c.t, 1.6, 2.3)),
    take = ease(span(c.t, 3.7, 4.9));
  const bx = lerp(186, 160, slide) - take * 46,
    by = lerp(112, 124, slide) + take * 56,
    bs = lerp(1.7, 2.3, slide) + take * 1.4;
  poly(ctx, '#7A8496', [66, 118, 254, 118, 266, 132, 54, 132]);
  box(ctx, 54, 132, 212, 5, '#3A4254');
  if (c.t < 2) {
    const hx = bx + 20 * bs,
      hy = by - 9 * bs;
    line(ctx, '#3F6FA8', 9, [214, 80, hx + 8, hy - 2]);
    oval(ctx, hx + 2, hy, 6, 5, '#6FB8E0');
  }
  box3(ctx, bx, by, bs, c.S);
  if (grab > 0)
    for (const side of [-1, 1]) {
      const tx = bx + (side * 15 + (side > 0 ? 3 : 0)) * bs,
        ty = by - 9 * bs;
      const sx = 160 + side * 80;
      const hx = lerp(sx, tx, grab),
        hy = lerp(200, ty, grab);
      line(ctx, JACKET_D, 12, [sx + side * 10, 200, hx + side * 6, hy + 10]);
      oval(ctx, hx, hy, 6, 7, GLOVE);
      box(ctx, hx - side * 5, hy - 5, 3, 7, SKIN);
    }
  rain(ctx, c.sec, 0.6, 0.2);
}

function thumb(ctx: Ctx, x: number, y: number) {
  line(ctx, JACKET_D, 30, [350, 240, x + 30, y + 44]);
  line(ctx, GLOVE, 20, [x + 30, y + 44, x + 6, y + 10]);
  oval(ctx, x, y, 8, 10, SKIN, -0.5);
  oval(ctx, x - 2, y - 3, 4, 5, alpha('#E0A882', 0.8), -0.5);
}
function timerShot(ctx: Ctx, c: Cut, n: 1 | 2 | 3 | 4) {
  const S = c.S,
    sec = c.sec;
  if (n === 1) {
    box(ctx, 0, 0, W, H, '#353C4B');
    for (let i = 0; i < 12; i++) box(ctx, 0, 8 + i * 15, W, 1, alpha('#566076', 0.5));
    const press = hump(S, START - 0.45, START + 0.45);
    lid(ctx, 160, 92, 1.1, -0.03, { S, press: press > 0.8 ? 1 : 0, beads: 0.6, night: 0.16 });
    thumb(ctx, lerp(292, 239, press), lerp(210, 84, press));
    rain(ctx, sec, 0.4, 0.1, { length: 4 });
    return;
  }
  if (n === 2) {
    box(ctx, 0, 0, W, H, '#0B0E1E');
    motionLines(ctx, sec, 900, 0, H, 3, '#9DB8FF');
    motionLines(ctx, sec + 3, 700, 0, H, 2, MAGENTA);
    const sh = Math.sin(sec * 37) * 0.8 + Math.sin(sec * 23) * 0.6;
    lid(ctx, 162 + sh * 0.5, 92 + sh, 1.05, 0.06, { S, beads: 1, night: 0.32 });
    for (const sx of [74, 256]) box(ctx, sx + sh * 0.5, 22 + sh, 6, 140, '#14151D');
    line(ctx, '#2A2E3A', 10, [-10, 176, 90, 168]);
    oval(ctx, 58, 168, 14, 9, GLOVE);
    rain(ctx, sec, 0.9, 1.4, { speed: 320 });
    return;
  }
  if (n === 3) {
    box(ctx, 0, 0, W, H, '#0E1024');
    glow(ctx, 60, 20, 120, AMBER, 0.2);
    for (let i = 0; i < 7; i++) box(ctx, 0, 20 + i * 24, W, 2, alpha('#20243E', 0.8));
    lid(ctx, 160, 94, 1.05, -0.08, { S, beads: 0.9, scuff: 1, night: 0.28 });
    const pat = hump(S, PAT - 0.35, PAT + 0.35);
    if (pat > 0) {
      const px = lerp(-40, 96, pat),
        py = lerp(10, 70, pat);
      line(ctx, JACKET_D, 28, [-60, -20, px - 20, py - 20]);
      oval(ctx, px, py, 18, 13, GLOVE, 0.4);
      for (let f = 0; f < 3; f++) box(ctx, px + 8 + f * 5, py + 4, 4, 7, SKIN);
    }
    rain(ctx, sec, 0.8, 0.3);
    return;
  }
  const bob = Math.sin(sec * TAU * 3.2) * 2;
  box(ctx, 0, 0, W, H, '#28343A');
  for (let i = 0; i < 6; i++) box(ctx, 0, 14 + i * 30 + bob, W, 2, alpha('#3E4E54', 0.8));
  const since = S - Math.floor(S - 0.4) - 0.4;
  lid(ctx, 160, 92 + bob, 1.02, 0.03, {
    S,
    beads: 0.5,
    scuff: 1,
    night: 0.12,
    pulse: Math.exp(-since * 5),
  });
  line(ctx, JACKET_D, 40, [-10, 20 + bob, 10, 170 + bob]);
  line(ctx, JACKET_D, 40, [330, 20 + bob, 312, 170 + bob]);
  oval(ctx, 44, 120 + bob, 16, 12, GLOVE, 0.3);
  oval(ctx, 276, 120 + bob, 16, 12, GLOVE, -0.3);
}

const launchX = (S: number) => {
  const u = Math.max(0, S - LAUNCH);
  return 92 + Math.min(u, 1.5) ** 2 * 26 + Math.max(0, u - 1.5) * 78;
};
const PUDDLE_X = launchX(PUDDLE) + 16 * 1.3;
function launchShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  gradient(ctx, -10, 150, NIGHT_SKY);
  clouds(ctx, sec, 4, MAGENTA, 0.14);
  row(ctx, MID, 300);
  row(ctx, NEAR, 180);
  box(ctx, -20, 70, 76, 81, '#0E1030');
  neonH(ctx, 22, 92, 'DISPATCH', CYAN, 0.9, 6);
  glow(ctx, 22, 124, 30, '#CFF4E8', 0.25);
  box(ctx, 8, 114, 28, 18, '#BFE3D8');
  box(ctx, -20, 150, W + 40, 40, ASPHALT);
  box(ctx, -20, 150, W + 40, 1, alpha('#9AB0E8', 0.3));
  reflect(ctx, 150, sec, () => {
    row(ctx, NEAR, 180, true);
    neonH(ctx, 22, 92, 'DISPATCH', CYAN, 0.9, 6);
  });
  oval(ctx, PUDDLE_X, 157, 26, 3.5, alpha('#2A3560', 0.8));
  line(ctx, alpha(MAGENTA, 0.4), 1, [PUDDLE_X - 14, 156, PUDDLE_X + 6, 156]);
  const x = launchX(S);
  const go = S > LAUNCH;
  const u = Math.max(0, S - LAUNCH);
  rider(ctx, x, 157, 1.3, {
    crank: (x - 92) / 6 + 0.5,
    wheel: (x - 92) / 9,
    stand: go ? 0.85 : 0,
    foot: !go,
    rim: CYAN,
    blur: u > 1.2 ? 1 : 0,
  });
  if (u > 1.4) spray(ctx, x - 21, 157, sec, 1);
  splash(ctx, PUDDLE_X, 157, S - PUDDLE, 1.2);
  rain(ctx, sec, 1, 0.25);
}

function trackShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  gradient(ctx, -10, 150, NIGHT_SKY);
  clouds(ctx, sec, 4, MAGENTA, 0.14);
  row(ctx, FAR, S * 12);
  row(ctx, MID, S * 45);
  row(ctx, NEAR, S * 170);
  box(ctx, -20, 150, W + 40, 40, ASPHALT);
  reflect(ctx, 150, sec, () => row(ctx, NEAR, S * 170, true), 0.5);
  for (let i = 0; i < 5; i++) {
    const x = W + 40 - ((i * 90 + S * 420) % 450);
    box(ctx, x, 172, 34, 2, alpha('#C9D2E8', 0.35));
  }
  motionLines(ctx, sec, 600, 20, 170, 1);
  const crank = S * 12;
  rider(ctx, 128, 160, 2.2, {
    crank,
    wheel: S * 22,
    stand: 0.45 + 0.15 * Math.sin(crank),
    rim: MAGENTA,
    blur: 1,
  });
  spray(ctx, 128 - 16 * 2.2, 160, sec, 1.3);
  for (let i = 0; i < 3; i++) {
    const x = W + 60 - ((i * 190 + S * 480) % 570);
    box(ctx, x, 0, 7, H, alpha('#05060C', 0.9));
    box(ctx, x - 5, 0, 5, H, alpha('#05060C', 0.3));
    glow(ctx, x + 3, 18, 50, '#FFD9A0', 0.22);
    const near = 1 - clamp(Math.abs(x - 140) / 90);
    if (near > 0) glow(ctx, 140, 100, 90, '#FFD9A0', 0.16 * near);
  }
  rain(ctx, sec, 1, 0.9, { speed: 260 });
}

// Street-level cameras: X across the road, Z depth, h height, all in car-ish units.
type Proj = (X: number, Z: number, h?: number) => { x: number; y: number };
const perspective =
  (horizon: number, camX: number, camH: number): Proj =>
  (X, Z, h = 0) => ({ x: 160 + ((X - camX) * 120) / Z, y: horizon + ((camH - h) * 120) / Z });
const quad = (
  ctx: Ctx,
  color: string,
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
) => poly(ctx, color, [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]);
const JAM = perspective(46, -0.75, 1.4);
const JAM_SPEED = 4.3,
  KAI_Z = 2.8;
const CAR_COLORS = ['#2A3150', '#3B2A48', '#1F3A44', '#4A4A58', '#5A2A30', '#2E2E3A'] as const;
/** Shopfronts and neon down both sides of a street; `dir` says which way it slides. */
function streetWalls(ctx: Ctx, P: Proj, cam: number, dir: 1 | -1) {
  for (const side of [-1, 1]) {
    const X = side * 4.2;
    quad(ctx, '#121538', P(X, 40, 7), P(X, 40, 0), P(X, 0.6, 0), P(X, 0.6, 7));
    quad(ctx, '#171A34', P(X, 40, 0), P(side * 3.1, 40, 0), P(side * 3.1, 0.6, 0), P(X, 0.6, 0));
  }
  for (let k = 0; k < 12; k++) {
    const Z = dir > 0 ? k * 3 + 2.2 - (cam % 3) : k * 3 + 0.9 + (cam % 3);
    if (Z < 0.7 || Z > 36) continue;
    for (const side of [-1, 1]) {
      const X = side * 4.18;
      const warm = WARM_WINDOWS[(k + (side > 0 ? 2 : 0)) % 4];
      quad(
        ctx,
        alpha(warm, 0.45),
        P(X, Z, 1.7),
        P(X, Z + 1.7, 1.7),
        P(X, Z + 1.7, 0.3),
        P(X, Z, 0.3),
      );
      if ((k + (side > 0 ? 1 : 0)) % 2) continue;
      const color = (k >> 1) % 2 ? MAGENTA : CYAN;
      const mid = P(X, Z + 0.5, 3.6);
      glow(ctx, mid.x, mid.y, 90 / Z, color, 0.3);
      quad(
        ctx,
        alpha(mix('#FFFFFF', color, 0.5), 0.9),
        P(X, Z + 0.3, 4.8),
        P(X, Z + 0.7, 4.8),
        P(X, Z + 0.7, 2.4),
        P(X, Z + 0.3, 2.4),
      );
    }
  }
}
function jamShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec,
    cam = (S - 29) * JAM_SPEED;
  gradient(ctx, -10, 50, NIGHT_SKY);
  row(ctx, { ...FAR, base: 50, lo: 14, hi: 40 }, 300);
  box(ctx, 0, 46, W, H - 46, ASPHALT);
  streetWalls(ctx, JAM, cam, 1);
  for (const X of [-0.78, 0.78])
    for (let k = 0; k < 14; k++) {
      const Z = k * 2.4 + 1 - (cam % 2.4);
      if (Z < 0.9) continue;
      const a = JAM(X, Z),
        b = JAM(X, Z + 1.1);
      line(ctx, alpha('#C9D2E8', 0.35), Math.max(0.6, 3 / Z), [a.x, a.y, b.x, b.y]);
    }
  const proj = JAM;
  const swerve = hump(S, DOOR - 0.05, 32.7);
  const kx = -0.5 * swerve;
  type Car = { lane: number; n: number; Z: number };
  const cars: Car[] = [];
  for (const lane of [-1, 1])
    for (let n = 0; n < 26; n++) {
      const Z = n * 3.3 + (lane > 0 ? 1.5 : 0) + 1.2 - cam;
      if (Z >= 0.8 && Z <= 36) cars.push({ lane, n, Z });
    }
  cars.sort((a, b) => b.Z - a.Z);
  let drawn = false;
  const drawKai = () => {
    const at = proj(kx, KAI_Z);
    riderRear(
      ctx,
      at.x,
      at.y,
      1.3,
      S * 11,
      -0.18 * Math.sin(swerve * Math.PI) * Math.sign(kx || 1),
    );
    drawn = true;
  };
  for (const car of cars) {
    if (!drawn && car.Z < KAI_Z) drawKai();
    const at = proj(car.lane * 1.55, car.Z);
    const door = car.lane > 0 && car.n === 4 ? ease(span(S, DOOR, DOOR + 0.35)) : 0;
    carRear(
      ctx,
      at.x,
      at.y,
      7.2 / car.Z,
      CAR_COLORS[(car.n * 7 + (car.lane > 0 ? 3 : 0)) % 6],
      door,
    );
  }
  if (!drawn) drawKai();
  rain(ctx, sec, 1, 0.12, { speed: 250 });
}

const BUS_CAMX = 0.7;
const busZ = (S: number) => 12 - (S - 34.5) * 7.2;
function busShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const HB = 60;
  const P = perspective(HB, BUS_CAMX, 1.1);
  const cam = (S - 34.5) * 4;
  gradient(ctx, -10, HB + 4, NIGHT_SKY);
  row(ctx, { ...FAR, base: HB + 2, lo: 16, hi: 44 }, 500);
  box(ctx, 0, HB, W, H - HB, ASPHALT);
  streetWalls(ctx, P, cam, -1);
  for (let k = 0; k < 6; k++) {
    const Z = k * 5 + 1.5 + (cam % 5);
    const top = P(-3, Z, 5.5);
    glow(ctx, top.x, top.y, 160 / Z, '#FFD9A0', 0.3);
    const road = P(-1.5, Z, 0);
    glow(ctx, road.x, road.y, 140 / Z, '#FFD9A0', 0.08);
  }
  const cf = P(1.35, 40),
    cn = P(1.35, 0.8),
    sf = P(3, 40),
    sn = P(3, 0.8);
  poly(ctx, '#171A30', [cf.x, cf.y, sf.x, sf.y, sn.x, sn.y, cn.x, cn.y]);
  line(ctx, '#3A4060', 1.5, [cf.x, cf.y, cn.x, cn.y]);
  for (let k = 0; k < 12; k++) {
    const Z = k * 2.4 + 1 + (cam % 2.4);
    const a = P(-1.3, Z),
      b = P(-1.3, Z + 1.1);
    line(ctx, alpha('#C9D2E8', 0.35), Math.max(0.6, 3 / Z), [a.x, a.y, b.x, b.y]);
  }
  const swerve = ease(span(S, HORN + 0.05, HORN + 0.55));
  const kx = lerp(0, 1.08, swerve);
  const bz = busZ(S);
  const bx = lerp(0, -0.75, ease(span(S, HORN - 0.1, HORN + 0.4)));
  if (bz + 5.2 > 0.35) {
    const X = bx + 1.25;
    const z0 = Math.max(bz, 0.35),
      z1 = bz + 5.2;
    const q = (Z: number, h: number) => P(X, Z, h);
    const [a, b, c2, d] = [q(z0, 0.15), q(z0, 3.1), q(z1, 3.1), q(z1, 0.15)];
    poly(ctx, '#1A2446', [a.x, a.y, b.x, b.y, c2.x, c2.y, d.x, d.y]);
    const [e, f, g, h] = [q(z0, 1.7), q(z0, 2.7), q(z1, 2.7), q(z1, 1.7)];
    poly(ctx, alpha('#FFD58A', 0.55), [e.x, e.y, f.x, f.y, g.x, g.y, h.x, h.y]);
    const [i, j, k2, l] = [q(z0, 1), q(z0, 1.12), q(z1, 1.12), q(z1, 1)];
    poly(ctx, MAGENTA, [i.x, i.y, j.x, j.y, k2.x, k2.y, l.x, l.y]);
  }
  const drawBus = () => {
    if (bz <= 0.5 || bz > 30) return;
    const at = P(bx, bz);
    busFront(ctx, at.x, at.y, 6.8 / bz, clamp((14 - bz) / 9));
  };
  if (bz > 2.3) drawBus();
  const kp = P(kx, 2.3);
  const panic = hump(S, HORN - 0.1, HORN + 1.4);
  kaiFront(ctx, kp.x, kp.y, 1.33, {
    ride: true,
    phase: S * 11,
    sec,
    lean: 0.18 * Math.sin(swerve * Math.PI),
    face: {
      turn: -0.2 * panic,
      lid: 0.05,
      brow: panic > 0.3 ? 0.9 : -0.6,
      mouth: panic > 0.3 ? 'open' : 'grit',
      rimL: alpha(HEADLIGHT, 0.4 + 0.5 * clamp((10 - bz) / 7)),
      rimR: alpha(CYAN, 0.6),
      shade: 0.3,
    },
  });
  if (bz <= 2.3) drawBus();
  sparks(ctx, kp.x + 12, kp.y - 2, S - SCRAPE, -1, 1.2);
  rain(ctx, sec, 1, 0.1, { speed: 240 });
}

function faceShot(ctx: Ctx, c: Cut) {
  box(ctx, 0, 0, W, H, '#080A1C');
  motionLines(ctx, c.sec, 500, 0, H, 2.2, '#FFB0DA');
  bokeh(ctx, c.sec * 4, 0.7);
  const swap = 0.5 + 0.5 * Math.sin(c.sec * 2.2);
  const grit = c.S > 40.2;
  kaiFace(
    ctx,
    150,
    98,
    2.5,
    {
      turn: 0.45,
      lid: grit ? 0.3 : 0.02,
      look: [0.7, -0.1],
      brow: grit ? -1 : 0.7,
      mouth: grit ? 'grit' : 'open',
      wet: 1,
      rimL: alpha(mix(MAGENTA, CYAN, swap), 0.9),
      rimR: alpha(mix(CYAN, AMBER, swap), 0.7),
      shade: 0.3,
    },
    c.sec,
  );
  for (let i = 0; i < 3; i++) {
    const t = (c.sec * 1.1 + i / 3) % 1;
    oval(ctx, 176 - t * 70, 136 - t * 8, 4 + t * 10, 2 + t * 4, alpha('#DDE6F8', 0.18 * (1 - t)));
  }
  rain(ctx, c.sec, 0.9, 1.4, { speed: 300 });
}

// Overhead: Kai cuts across the tramlines a wheel's width ahead of the tram.
const kaiCross = (S: number) => ({
  x: lerp(150, 176, ease(span(S, 42.8, 46))),
  y: -8 + (S - 41.5) * 36.5,
});
const TRAM_SPEED = 60;
const TRAM_FRONT = kaiCross(CROSS).x + 12;
function umbrella(ctx: Ctx, x: number, y: number, r: number, color: string) {
  disc(ctx, x + 1.5, y + 2, r, alpha('#000000', 0.35));
  disc(ctx, x, y, r, color);
  line(ctx, alpha('#000000', 0.3), 0.5, [x - r, y, x + r, y]);
  line(ctx, alpha('#000000', 0.3), 0.5, [x, y - r, x, y + r]);
  box(ctx, x - 0.5, y - 0.5, 1, 1, '#1A1A22');
}
function overheadShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  zoomed(ctx, 166, 98, 1.4 + c.k * 0.1, () => {
    box(ctx, -20, -20, W + 40, H + 40, '#11142C');
    const blocks = [
      [-20, -20, 150, 84],
      [190, -20, 150, 84],
      [-20, 126, 150, 74],
      [190, 126, 150, 74],
    ] as const;
    blocks.forEach(([x, y, w, h], i) => {
      box(ctx, x, y, w, h, '#262A44');
      box(ctx, x + 8, y + 8, w - 16, h - 16, '#15182E');
      box(ctx, x + 22, y + 18, 14, 9, '#2A2E48');
      disc(ctx, x + w - 34, y + h - 28, 7, '#262A40');
      glow(ctx, i % 2 ? x + 6 : x + w - 6, y + h / 2, 44, i < 2 ? MAGENTA : CYAN, 0.22);
    });
    for (let i = 0; i < 6; i++) {
      box(ctx, 104, 67 + i * 9.5, 14, 4, alpha('#D8DEEA', 0.4));
      box(ctx, 202, 67 + i * 9.5, 14, 4, alpha('#D8DEEA', 0.4));
    }
    for (let y = -20; y < 64; y += 12) box(ctx, 159, y, 2, 6, alpha('#D8DEEA', 0.35));
    for (let y = 130; y < 200; y += 12) box(ctx, 159, y, 2, 6, alpha('#D8DEEA', 0.35));
    for (const ty of [81, 93, 103, 115]) box(ctx, -20, ty, W + 40, 1, '#5A6078');
    line(ctx, alpha('#8A92B0', 0.4), 0.6, [-20, 87, W + 20, 87]);
    line(ctx, alpha('#8A92B0', 0.4), 0.6, [-20, 109, W + 20, 109]);
    for (let i = 0; i < 5; i++) {
      oval(ctx, 60 + i * 50, 70 + (i % 2) * 50, 12, 4, alpha('#2A3560', 0.8));
      box(ctx, 56 + i * 50, 69 + (i % 2) * 50, 6, 1, alpha(i % 2 ? CYAN : MAGENTA, 0.6));
    }
    carTop(ctx, 146, 146, -Math.PI / 2, CAR_COLORS[0]);
    carTop(ctx, 146, 174, -Math.PI / 2, CAR_COLORS[2]);
    carTop(ctx, 236, 121, Math.PI, CAR_COLORS[4]);
    carTop(ctx, 264, 121, Math.PI, CAR_COLORS[1]);
    carTop(ctx, 86, 71, 0, CAR_COLORS[3]);
    glow(ctx, 128, 130, 9, TAIL, 0.7);
    glow(ctx, 194, 60, 9, TAIL, 0.7);
    glow(ctx, 194, 130, 7, '#FFFFFF', 0.5);
    const colors = [RED, '#3A5AA8', '#2E8A5A', AMBER, '#8A3AA8', '#D8DEE8'];
    const walkers = [
      [70, 56, 1],
      [250, 58, -1],
      [96, 134, 1],
      [236, 136, -1],
    ] as const;
    walkers.forEach(([x0, y0, dir], i) =>
      umbrella(ctx, x0 + dir * ((sec * 4 + i * 11) % 40), y0, 6, colors[i]),
    );
    for (const [x, y, i] of [
      [210, 60, 4],
      [221, 58, 5],
      [120, 134, 1],
      [206, 134, 3],
    ] as const)
      umbrella(ctx, x, y, 6, colors[i]);
    const tramX = TRAM_FRONT - (S - CROSS) * TRAM_SPEED;
    glow(ctx, tramX - 20, 87, 40, HEADLIGHT, 0.45);
    box(ctx, tramX, 77, 150, 20, '#6C759C');
    box(ctx, tramX + 2, 79, 146, 16, '#8A94BA');
    box(ctx, tramX + 2, 77, 146, 1.5, alpha('#FFD58A', 0.85));
    box(ctx, tramX + 2, 95.5, 146, 1.5, alpha('#FFD58A', 0.85));
    box(ctx, tramX + 22, 83, 14, 8, '#5A6284');
    box(ctx, tramX + 108, 83, 14, 8, '#5A6284');
    for (const j of [50, 100]) box(ctx, tramX + j, 77, 1.5, 20, '#454C6C');
    line(ctx, '#23263C', 1, [
      tramX + 66,
      87,
      tramX + 72,
      81,
      tramX + 78,
      87,
      tramX + 72,
      93,
      tramX + 66,
      87,
    ]);
    box(ctx, tramX, 97, 150, 1, MAGENTA);
    box(ctx, tramX, 78, 4, 18, '#1A2038');
    const k = kaiCross(S),
      k2 = kaiCross(S + 0.05);
    kaiTop(ctx, k.x, k.y, 0.9, Math.atan2(k2.y - k.y, k2.x - k.x));
    for (let i = 0; i < 18; i++) {
      const phase = sec * 1.3 + rand(i);
      const cycle = Math.floor(phase),
        t = phase - cycle;
      const x = 40 + rand(i * 13 + cycle * 7.1) * 250,
        y = 30 + rand(i * 17 + cycle * 3.3) * 140;
      ctx.strokeStyle = alpha('#AFC4EE', 0.45 * (1 - t));
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y, 1 + t * 4, 0.6 + t * 2.4, 0, 0, TAU);
      ctx.stroke();
    }
  });
  rain(ctx, sec, 0.5, 0.05, { length: 3, speed: 90 });
}

function closedShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  gradient(ctx, -10, 148, NIGHT_SKY);
  row(ctx, FAR, 500);
  box(ctx, -10, 40, 106, 110, '#0C0E26');
  for (let j = 0; j < 12; j++)
    box(ctx, 8 + (j % 4) * 22, 56 + Math.floor(j / 4) * 22, 6, 8, alpha(WARM_WINDOWS[j % 4], 0.6));
  box(ctx, 96, 58, 46, 92, '#2A1420');
  glow(ctx, 119, 112, 60, '#FF9A4A', 0.45);
  for (let k = 0; k < 4; k++) {
    const y = 72 + k * 9,
      inset = k * 5;
    line(ctx, alpha('#3A2A20', 0.8), 0.6, [96 + inset, y, 119, y + 4 - k, 142 - inset, y]);
    for (let i = 0; i < 4; i++) {
      const lx = 100 + inset + i * ((42 - inset * 2) / 3);
      glow(ctx, lx, y + 3, 6 - k, '#FF7A3A', 0.5);
      disc(ctx, lx, y + 3, 1.6 - k * 0.25, '#FF6A3A');
    }
  }
  for (let i = 0; i < 3; i++) box(ctx, 102 + i * 12, 128, 9, 20 - i * 3, '#1A0C12');
  box(ctx, 142, 30, 190, 120, '#0B0D24');
  for (let j = 0; j < 16; j++)
    box(
      ctx,
      152 + (j % 8) * 22,
      42 + Math.floor(j / 8) * 20,
      6,
      8,
      alpha(WARM_WINDOWS[(j + 1) % 4], 0.5),
    );
  neonV(ctx, 150, 50, 'RAMEN', MAGENTA);
  box(ctx, -10, 148, W + 20, 40, ASPHALT);
  const lampA = lamp(sec, 0, 0.9),
    lampB = lamp(sec, 0.5, 0.9);
  reflect(ctx, 148, sec, () => {
    glow(ctx, 119, 112, 60, '#FF9A4A', 0.45);
    glow(ctx, 216, 114, 16, AMBER, 0.25 + 0.35 * lampA);
    glow(ctx, 292, 114, 16, AMBER, 0.25 + 0.35 * lampB);
    neonV(ctx, 150, 50, 'RAMEN', MAGENTA);
  });
  poly(ctx, '#05060E', [226, 148, 318, 148, 314, 156, 230, 156]);
  line(ctx, '#15172A', 3, [262, 148, 276, 104, 300, 92]);
  line(ctx, '#15172A', 5, [300, 92, 318, 108]);
  const bx = 212,
    by = 148;
  for (const lx of [bx + 6, bx + 76])
    line(ctx, '#4A4E60', 2, [lx - 6, by, lx, by - 26, lx + 6, by]);
  for (const [yy, hh] of [
    [by - 30, 7],
    [by - 16, 6],
  ] as const) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, yy, 84, hh);
    ctx.clip();
    box(ctx, bx, yy, 84, hh, '#E8E6E0');
    for (let k = -hh; k < 84; k += 10)
      poly(ctx, RED, [bx + k, yy + hh, bx + k + 5, yy + hh, bx + k + 5 + hh, yy, bx + k + hh, yy]);
    ctx.restore();
  }
  box(ctx, bx + 22, by - 48, 40, 16, '#F2F0EA');
  box(ctx, bx + 22, by - 48, 40, 2, RED);
  write(ctx, 'ROAD', bx + 42, by - 40.5, { size: 5.5, color: RED });
  write(ctx, 'CLOSED', bx + 42, by - 34.5, { size: 5.5, color: RED });
  [lampA, lampB].forEach((a, i) => {
    const lx = bx + 4 + i * 76;
    glow(ctx, lx, by - 34, 16, AMBER, 0.25 + 0.35 * a);
    disc(ctx, lx, by - 34, 2.2, mix('#7A4A10', AMBER, a));
  });
  // Kai: in hard, a skid, a look back, and away into the alley.
  let x: number,
    y = 155,
    s = 1.25,
    tilt = 0,
    face = 1;
  if (S < SKID) x = lerp(-30, 180, span(S, 50, SKID));
  else if (S < 52.6) {
    x = lerp(180, 196, easeOut(span(S, SKID, 51.6)));
    tilt = -0.22 * hump(S, SKID, 51.7);
  } else if (S < TURN) {
    x = 196;
    face = Math.cos(Math.PI * span(S, 52.6, 53));
  } else {
    const t = span(S, TURN, 54.5);
    x = lerp(196, 119, easeIn(span(t, 0, 0.55)));
    y = lerp(155, 132, ease(span(t, 0.45, 1)));
    s = lerp(1.25, 0.55, ease(span(t, 0.45, 1)));
    face = -1;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face >= 0 ? Math.max(0.08, face) : Math.min(-0.08, face), 1);
  const stopped = S >= 51.5 && S < TURN + 0.15;
  rider(ctx, 0, 0, s, {
    crank: x / 6,
    wheel: x / 9,
    tilt,
    foot: stopped,
    stand: S >= TURN ? 0.8 : 0.2,
    rim: CYAN,
  });
  ctx.restore();
  if (S >= SKID && S < 51.9) {
    const t = S - SKID;
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI * (0.55 + rand(i * 2.1) * 0.4);
      const v = 40 + rand(i * 4.3) * 60;
      box(
        ctx,
        x - 20 + Math.cos(a) * v * t,
        y + Math.sin(a) * v * t + 150 * t * t,
        1.5,
        1.5,
        alpha('#CFE0FF', 0.9 * (1 - t / 0.9)),
      );
    }
  }
  rain(ctx, sec, 1, 0.3);
}

// The night market: tracking alongside Kai through the stalls.
const MARKET_SPEED = 135;
const marketScroll = (S: number) => (S - 54.5) * MARKET_SPEED;
const MARKET_KAI = 112;
const LOW_LANTERNS = marketScroll(DUCK) + MARKET_KAI + 12;
const CRATE_X = marketScroll(CRATE) + MARKET_KAI + 44;
const ORANGES = [0, 1, 2, 3, 4].map((i) => ({
  dx: rand(i * 3.1) * 10 - 4,
  vx: 30 + rand(i * 5.7) * 60,
  h0: 14 + rand(i * 2.2) * 16,
  rate: 2.2 + rand(i * 9.1) * 1.2,
}));
function orangeAt(o: (typeof ORANGES)[number], t: number) {
  return {
    x: CRATE_X + o.dx + (o.vx * (1 - Math.exp(-t * 1.4))) / 1.4,
    y: -o.h0 * Math.exp(-t * 1.6) * Math.abs(Math.sin(t * o.rate * Math.PI + 0.35)),
  };
}
/** When each orange first hits the cobbles (for the score). */
const ORANGE_BOUNCES = ORANGES.slice(0, 3).flatMap((o) =>
  [1, 2].map((k) => CRATE + (k - 0.35 / Math.PI) / o.rate),
);
const STALL_COLORS = [
  ['#C8323C', '#F2E6D2'],
  ['#2E8A5A', '#F2E6D2'],
  ['#D9822B', '#F7E7C8'],
  ['#3A5AA8', '#EDE6D8'],
] as const;
function stall(ctx: Ctx, x: number, y: number, i: number, sec: number) {
  const [a, b] = STALL_COLORS[((i % 4) + 4) % 4];
  box(ctx, x, y - 62, 2, 62, '#2A1A14');
  box(ctx, x + 84, y - 62, 2, 62, '#2A1A14');
  glow(ctx, x + 43, y - 50, 44, '#FFC070', 0.4);
  for (let k = 0; k < 7; k++) box(ctx, x - 4 + k * 13, y - 68, 13, 9, k % 2 ? b : a);
  for (let k = 0; k < 7; k++) disc(ctx, x + 2.5 + k * 13, y - 59, 6.5, k % 2 ? b : a);
  disc(ctx, x + 43, y - 50, 2, '#FFF0C0');
  box(ctx, x + 2, y - 26, 82, 26, '#3A2418');
  box(ctx, x + 2, y - 26, 82, 3, '#5A3A24');
  const kind = ((i % 3) + 3) % 3;
  if (kind === 0)
    for (let k = 0; k < 9; k++)
      disc(ctx, x + 12 + (k % 5) * 14 + (k > 4 ? 7 : 0), y - 29 - (k > 4 ? 5 : 0), 3.4, '#F28A1E');
  else if (kind === 1)
    for (let k = 0; k < 5; k++)
      oval(ctx, x + 14 + k * 14, y - 30, 6, 3.5, k % 2 ? '#4A9A3A' : '#7ABA4A');
  else {
    box(ctx, x + 30, y - 38, 22, 12, '#5A5E6A');
    steam(ctx, x + 38, y - 40, sec, 1.6, 34);
  }
}
function marketShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const scroll = marketScroll(S);
  const ground = 146;
  box(ctx, 0, 0, W, ground, '#170C18');
  for (let i = -1; i < 7; i++) {
    const x = i * 56 - ((scroll * 0.4) % 56);
    box(ctx, x + 6, 10, 12, 16, alpha('#FFB870', 0.35));
    box(ctx, x + 30, 30, 12, 16, alpha('#FF9A6A', 0.3));
  }
  for (const [y0, par] of [
    [16, 0.55],
    [34, 0.8],
  ] as const) {
    const off = (scroll * par) % 120;
    for (let i = -1; i < 4; i++) {
      const x0 = i * 120 - off;
      const pts: number[] = [];
      for (let k = 0; k <= 6; k++) pts.push(x0 + k * 20, y0 + Math.sin((k / 6) * Math.PI) * 10);
      line(ctx, alpha('#2A1A14', 0.9), 0.7, pts);
      for (let k = 1; k < 6; k++) {
        const lx = x0 + k * 20,
          ly = y0 + Math.sin((k / 6) * Math.PI) * 10 + 4;
        glow(ctx, lx, ly, 9, '#FF7A3A', 0.45);
        oval(ctx, lx, ly, 2.4, 3, k % 2 ? '#E8402E' : '#FF8A2A');
      }
    }
  }
  const first = Math.floor((scroll - 90) / 118);
  for (let i = first; i < first + 5; i++) stall(ctx, i * 118 + 30 - scroll, ground, i, sec);
  box(ctx, 0, ground, W, H - ground, '#20141C');
  for (let r = 0; r < 4; r++)
    for (let i = -1; i < 14; i++) {
      const w = 22 + r * 4;
      const x = i * w - ((scroll + r * 11) % w);
      box(ctx, x, ground + 2 + r * 8, w - 2, 1, alpha('#3A2230', 0.8));
    }
  reflect(
    ctx,
    ground,
    sec,
    () => {
      for (let i = first; i < first + 5; i++)
        glow(ctx, i * 118 + 73 - scroll, ground - 50, 40, '#FFC070', 0.4);
    },
    0.6,
  );
  // Shoppers who leap out of the way.
  const folk = [
    {
      at: 56.1,
      x: marketScroll(56.1) + MARKET_KAI + 70,
      coat: '#6A3A5A',
      hair: '#2A1A14',
      skin: '#E0B08A',
    },
    {
      at: 58.6,
      x: marketScroll(58.6) + MARKET_KAI + 76,
      coat: '#2E5A6A',
      hair: '#B8B0A8',
      skin: '#C08A64',
    },
    { at: 0, x: 220, coat: '#5A4A2A', hair: '#1A1418', skin: '#D8A07A' },
    { at: 0, x: 560, coat: '#3A3A6A', hair: '#3A2A1A', skin: '#B8805A' },
  ];
  for (const f of folk) {
    const sx = f.x - scroll;
    if (sx < -40 || sx > W + 40) continue;
    const jump = f.at ? ease(span(S, f.at - 0.3, f.at + 0.1)) : 0;
    person(ctx, sx + jump * 4, ground - 1 - jump * 5, {
      skin: f.skin,
      hair: f.hair,
      coat: f.coat,
      legs: '#2A2230',
      build: 'adult',
      size: 1.9,
      facing: -1,
      lean: -0.3 * jump,
      arms: jump > 0 ? [2.6 * jump, 2.2 * jump] : [0.2, -0.2],
      eyes: jump > 0.3 ? 'wide' : 'open',
      mouth: jump > 0.3 ? 'o' : 'flat',
      blush: false,
    });
  }
  const lx = LOW_LANTERNS - scroll;
  if (lx > -30 && lx < W + 30) {
    line(ctx, alpha('#3A2A20', 0.9), 0.7, [lx - 16, 0, lx, 84, lx + 16, 0]);
    for (const [dx, dy] of [
      [-3, 88],
      [3, 92],
      [0, 97],
    ] as const) {
      glow(ctx, lx + dx, dy, 12, '#FF7A3A', 0.45);
      oval(ctx, lx + dx, dy, 3.5, 4.5, '#E8402E');
      box(ctx, lx + dx - 2, dy - 5, 4, 1, '#3A2418');
    }
  }
  const crouch = hump(S, DUCK - 0.45, DUCK + 0.45);
  rider(ctx, MARKET_KAI, 154, 1.55, {
    crank: S * 11,
    wheel: S * 18,
    stand: 0.3 * (1 - crouch),
    crouch,
    rim: '#FFB070',
    blur: 1,
  });
  const cx = CRATE_X - scroll;
  if (cx > -40 && cx < W + 40) {
    const tip = ease(span(S, CRATE, CRATE + 0.3));
    box(ctx, cx - 14, 146, 28, 16, '#8A5A2A');
    box(ctx, cx - 14, 150, 28, 1, '#5A3A1A');
    ctx.save();
    ctx.translate(cx + 14, 146);
    ctx.rotate(tip * 1.3);
    box(ctx, -28, -14, 28, 14, '#9A6A34');
    box(ctx, -28, -10, 28, 1, '#5A3A1A');
    if (tip < 0.2) for (let k = 0; k < 4; k++) disc(ctx, -24 + k * 6.5, -16, 3.2, '#F28A1E');
    ctx.restore();
    if (S >= CRATE)
      for (const o of ORANGES) {
        const p = orangeAt(o, S - CRATE);
        disc(ctx, p.x - scroll, 160 + p.y, 3.2, '#F28A1E');
        box(ctx, p.x - scroll - 1, 157 + p.y, 1, 1, '#FFD08A');
      }
  }
  rain(ctx, sec, 0.45, 0.2);
}

function orangeShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  box(ctx, 0, 0, W, H, '#1A0C18');
  for (let i = 0; i < 10; i++)
    glow(
      ctx,
      16 + i * 34 + Math.sin(i) * 10,
      26 + rand(i) * 56,
      26 + rand(i * 3) * 22,
      i % 3 ? '#FF9A4A' : '#FF4A6A',
      0.35,
    );
  for (let i = 0; i < 4; i++) box(ctx, i * 90 - 10, 70, 60, 54, alpha('#0E0610', 0.6));
  box(ctx, 0, 122, W, 58, '#1E121A');
  for (let r = 0; r < 6; r++) {
    const y = 122 + (r * r * 1.8 + r * 4),
      h = 3 + r * 2.2,
      w = 16 + r * 9;
    for (let x = -((r * 7) % w); x < W; x += w)
      box(ctx, x + 1, y + 1, w - 2, h, r % 2 ? '#2E1C26' : '#2A1822');
  }
  for (let i = 0; i < 5; i++) glow(ctx, 30 + i * 70, 150, 30, i % 2 ? '#FF9A4A' : '#FF4A6A', 0.16);
  const ox = lerp(346, 104, easeOut(span(S, 61, 64.3))),
    oy = 151,
    r = 11;
  for (const [delay, big] of [
    [0, 1],
    [0.32, 0.92],
  ] as const) {
    const w = span(S, ROLL - 0.3 + delay, ROLL + 0.25 + delay);
    if (w <= 0 || w >= 1) continue;
    const wx = lerp(-130, 460, w),
      R = 96 * big;
    ctx.strokeStyle = '#07070C';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(wx, 140 - R, R, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = alpha('#8A92A8', 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wx, 140 - R, R - 10, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI * rand(i * 3.3);
      const d = 20 + rand(i * 1.7) * 60;
      box(
        ctx,
        wx - 20 - Math.cos(a) * d * w * 2,
        138 + Math.sin(a) * d * 0.5,
        2,
        2,
        alpha('#CFE0FF', 0.7),
      );
    }
  }
  if (S > 63.8) {
    const t = S - 63.8;
    ctx.strokeStyle = alpha('#FFB07A', 0.5 * Math.max(0, 1 - t / 1.2));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(ox, oy + 2, 12 + t * 26, 2 + t * 4, 0, 0, TAU);
    ctx.stroke();
  }
  oval(ctx, ox + 2, oy + 3, r + 2, 3, alpha('#000000', 0.4));
  const spin = (346 - ox) / r;
  disc(ctx, ox, oy - r + 2, r, '#EE8418');
  disc(ctx, ox - 3, oy - r - 1, r * 0.55, alpha('#FFB34A', 0.6));
  for (let k = 0; k < 5; k++) {
    const a = -spin + k * 1.26;
    box(ctx, ox + Math.cos(a) * r * 0.6, oy - r + 2 + Math.sin(a) * r * 0.6, 1, 1, '#B85A10');
  }
  const la = -spin + 0.4;
  oval(
    ctx,
    ox + Math.cos(la) * (r - 1),
    oy - r + 2 + Math.sin(la) * (r - 1),
    3,
    1.6,
    '#3A8A2A',
    la,
  );
  glow(ctx, ox - 4, oy - r - 2, 14, '#FFD08A', 0.2);
  for (let i = 0; i < 10; i++) {
    const t = (sec * 1.6 + rand(i)) % 1;
    const x = rand(i * 5 + Math.floor(sec * 1.6 + rand(i))) * W;
    box(ctx, x - t * 3, 128 + rand(i * 7) * 40 - t * 5, 1, 1, alpha('#FFD8B0', 0.6 * (1 - t)));
  }
  rain(ctx, sec, 0.5, 0.2, { color: alpha('#FFC8A0', 0.35) });
}

// The drawbridge.
const leafAngle = (S: number) => 0.6 * easeOut(span(S, LIFT, 82));
function leafSlab(
  ctx: Ctx,
  px: number,
  py: number,
  len: number,
  a: number,
  dir: 1 | -1,
  sec: number,
  thick = 8,
) {
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(dir, 1);
  ctx.rotate(-a);
  box(ctx, 0, 0, len, thick, '#23284A');
  for (let k = 8; k < len; k += 14) box(ctx, k, 2, 1, thick - 2, '#151932');
  box(ctx, 0, -2, len, 2, '#454C78');
  box(ctx, 0, -2, len, 1, alpha('#8FA6E0', 0.6));
  line(ctx, '#353B62', 1, [0, -9, len, -9]);
  for (let k = 0; k < len; k += 12) {
    box(ctx, k, -9, 1, 7, '#353B62');
    box(ctx, k, -10.5, 1.5, 1.5, alpha('#FFD27E', 0.9));
  }
  glow(ctx, len - 2, -10, 14, TAIL, 0.35 + 0.3 * lamp(sec, dir > 0 ? 0 : 0.5));
  disc(ctx, len - 2, -10, 1.8, '#FF6A7A');
  ctx.restore();
}
function bridgeShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const a = leafAngle(S);
  const deck = 110;
  const across: Row = { ...MID, base: 98, lo: 18, hi: 58, signs: 0.5 };
  const lamps = () => {
    for (let x = -10; x < W + 10; x += 22) {
      if (x > 82 && x < 246) continue;
      glow(ctx, x, deck - 12, 10, '#FFD27E', 0.4);
    }
  };
  zoomed(ctx, 150, 100, 1 + c.k * 0.08, () => {
    gradient(ctx, -10, 100, NIGHT_SKY);
    clouds(ctx, sec, 6, MAGENTA, 0.16);
    row(ctx, { ...FAR, base: 96 }, 900);
    row(ctx, across, 1400);
    box(ctx, -20, 98, W + 40, 100, '#070A1C');
    reflect(
      ctx,
      98,
      sec,
      () => {
        row(ctx, across, 1400, true);
        lamps();
      },
      0.55,
      200,
    );
    // The ship that needs the bridge open.
    const shipX = lerp(306, 276, c.k);
    poly(ctx, '#0C0E1A', [shipX - 34, 132, shipX + 38, 132, shipX + 30, 144, shipX - 26, 144]);
    box(ctx, shipX - 10, 118, 26, 14, '#141828');
    for (let i = 0; i < 4; i++) box(ctx, shipX - 7 + i * 6, 122, 3, 3, '#FFD27E');
    line(ctx, '#141828', 1.4, [shipX + 3, 118, shipX + 3, 56]);
    glow(ctx, shipX + 3, 58, 10, '#FFFFFF', 0.55);
    glow(ctx, shipX - 30, 134, 7, TAIL, 0.7);
    glow(ctx, shipX + 34, 134, 7, '#4AFF8A', 0.7);
    // Approaches on stone arches.
    for (const [x0, x1] of [
      [-20, 86],
      [242, 340],
    ] as const) {
      box(ctx, x0, deck, x1 - x0, 7, '#2E345E');
      box(ctx, x0, deck, x1 - x0, 1, alpha('#8FA6E0', 0.6));
      for (let x = x0 + 14; x < x1 - 6; x += 36) {
        box(ctx, x, deck + 7, 8, 40, '#1C2142');
        oval(ctx, x + 22, deck + 8, 14, 5, '#070A1C');
      }
      line(ctx, '#353B62', 1, [x0, deck - 8, x1, deck - 8]);
    }
    lamps();
    for (let x = -10; x < W + 10; x += 22) {
      if (x > 82 && x < 246) continue;
      box(ctx, x, deck - 12, 1, 12, '#2A2F55');
      disc(ctx, x, deck - 12, 1.4, '#FFE2A0');
    }
    // Two towers, lamps soft-pulsing on top.
    for (const tx of [86, 216]) {
      box(ctx, tx, 38, 26, 100, '#2A2F5C');
      box(ctx, tx, 38, 3, 100, alpha('#8FA6E0', 0.3));
      poly(ctx, '#232852', [tx - 4, 40, tx + 30, 40, tx + 13, 20]);
      for (let j = 0; j < 3; j++) box(ctx, tx + 10, 50 + j * 16, 6, 8, alpha('#FFD27E', 0.75));
      const la = lamp(sec, tx > 100 ? 0.5 : 0, 0.8);
      glow(ctx, tx + 13, 18, 16, TAIL, 0.3 + 0.35 * la);
      disc(ctx, tx + 13, 18, 2.2, mix('#6A1A2A', '#FF6A7A', la));
    }
    leafSlab(ctx, 112, deck, 52, a, 1, sec, 6);
    leafSlab(ctx, 216, deck, 52, a, -1, sec, 6);
    // The warning gantry over the road.
    box(ctx, 16, 70, 2, 40, '#2A2F55');
    box(ctx, 70, 70, 2, 40, '#2A2F55');
    box(ctx, 14, 72, 60, 12, '#07080C');
    write(ctx, 'BRIDGE LIFTING', 44, 80.5, {
      size: 5,
      color: alpha(AMBER, 0.6 + 0.4 * lamp(sec, 0, 0.8)),
    });
    for (let i = 0; i < 2; i++) {
      const la = lamp(sec, i * 0.5, 0.9);
      glow(ctx, 22 + i * 44, 88, 10, TAIL, 0.25 + 0.4 * la);
      disc(ctx, 22 + i * 44, 88, 1.8, mix('#6A1A2A', '#FF6A7A', la));
    }
    const kx = lerp(-24, 60, easeOut(span(S, 64.5, 68.4)));
    const moving = S < 68.4;
    rider(ctx, kx, deck, 0.9, {
      crank: kx / 5,
      wheel: kx / 7,
      foot: !moving,
      rim: AMBER,
      stand: moving ? 0.4 : 0,
    });
  });
  rain(ctx, sec, 1, 0.25);
}

function choiceShot(ctx: Ctx, c: Cut) {
  box(ctx, 0, 0, W, H, '#08091A');
  bokeh(ctx, c.sec, 0.8, [AMBER, TAIL, CYAN]);
  const glance = hump(c.S, GLANCE - 0.25, GLANCE + 0.9);
  const set = ease(span(c.S, RESOLVE, RESOLVE + 0.5));
  const lamps = lamp(c.sec, 0, 0.8);
  kaiFace(
    ctx,
    160,
    100 - c.k * 2,
    4.3 + c.k * 0.35,
    {
      lid: lerp(0.15, 0.36, set) + glance * 0.25,
      look: [0.15 * (1 - glance), lerp(-0.1, 1, glance)],
      brow: lerp(0.5, -1, set),
      mouth: 'flat',
      wet: 1,
      catch: [alpha(AMBER, 0.6 + 0.4 * lamps), alpha(TAIL, 0.4 + 0.4 * (1 - lamps))],
      rimL: alpha(AMBER, 0.55 + 0.3 * lamps),
      rimR: alpha(CYAN, 0.6),
      shade: 0.34,
    },
    c.sec,
  );
  glow(ctx, 160, 200, 120, TAIL, 0.25 * glance);
}

/** A sneaker on a pedal, sole down, toe to the right; (x, y) is the pedal spindle. */
function sneaker(ctx: Ctx, x: number, y: number, s: number, dark = 0) {
  const tone = toner(dark);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  box(ctx, -9, 0, 18, 3, tone('#8A92A4'));
  poly(ctx, tone('#1A1C28'), [-14, -3, -12, -12, -2, -13, 8, -9, 15, -6, 17, -2, 17, -1, -14, -1]);
  box(ctx, -15, -2, 33, 3, tone('#D8DEE8'));
  box(ctx, -14, -11, 5, 5, alpha(tone('#E8F0FF'), 0.85));
  line(ctx, tone('#6A7084'), 0.8, [-1, -12, 3, -10.5, 7, -9]);
  ctx.restore();
}
function pedalsShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const u = S - 74;
  const crank = TAU * (1.1 * u + 0.42 * Math.max(0, S - STAND) ** 2);
  const a = leafAngle(S);
  gradient(ctx, -10, 100, NIGHT_SKY);
  row(ctx, { ...FAR, base: 100 }, 900 + u * 30);
  // Ahead, small and far: the leaf of the bridge, still rising.
  ctx.save();
  ctx.translate(262, 100);
  ctx.rotate(-a);
  box(ctx, 0, -3, 44, 4, '#2A2F55');
  for (let k = 0; k < 44; k += 8) box(ctx, k, -5, 1, 1, '#FFD27E');
  ctx.restore();
  glow(ctx, 262 + 44 * Math.cos(a), 100 - 44 * Math.sin(a), 12, TAIL, 0.35 + 0.3 * lamp(sec));
  box(ctx, -10, 100, W + 20, 90, ASPHALT);
  reflect(ctx, 100, sec, () => row(ctx, { ...FAR, base: 100 }, 900 + u * 30, true), 0.4);
  motionLines(ctx, sec, 500 + u * 140, 104, 178, 3, '#9DB8FF');
  // The wheels fill the edges of the frame, spinning to a blur.
  for (const wx of [-24, 344]) {
    ctx.strokeStyle = '#06070C';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(wx, 92, 82, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = alpha('#8A94AE', 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wx, 92, 72, 0, TAU);
    ctx.stroke();
    disc(ctx, wx, 92, 70, alpha('#8C96B0', 0.07));
  }
  const bx = 160,
    by = 118;
  line(ctx, FRAME, 9, [-24, 92, bx, by]);
  line(ctx, FRAME, 10, [bx, by, 120, -20]);
  line(ctx, FRAME, 10, [bx, by, 300, -20]);
  line(ctx, CYAN, 2, [196, 68, 236, 14]);
  line(ctx, '#4A5064', 2, [-24, 86, bx, by - 28]);
  line(ctx, '#4A5064', 2, [-24, 98, bx, by + 28]);
  const pedalAt = (k: number) => ({
    x: bx + Math.cos(crank + k * Math.PI) * 46,
    y: by + Math.sin(crank + k * Math.PI) * 46,
  });
  const far = pedalAt(1),
    near = pedalAt(0);
  // Far leg and shoe, in shadow behind the chainring.
  line(ctx, '#151A2E', 20, [far.x - 30, -30, far.x - 4, far.y - 14]);
  sneaker(ctx, far.x, far.y, 1.6, 0.55);
  disc(ctx, bx, by, 30, '#2E3446');
  disc(ctx, bx, by, 22, '#161A26');
  for (let i = 0; i < 20; i++) {
    const t = crank + (i / 20) * TAU;
    box(ctx, bx + Math.cos(t) * 30.5 - 1.5, by + Math.sin(t) * 30.5 - 1.5, 3, 3, '#454D60');
  }
  for (let i = 0; i < 5; i++) {
    const t = crank + (i / 5) * TAU;
    disc(ctx, bx + Math.cos(t) * 14, by + Math.sin(t) * 14, 2.5, '#2A2E3A');
  }
  line(ctx, '#AEB6C6', 7, [far.x, far.y, bx, by, near.x, near.y]);
  disc(ctx, bx, by, 6, '#D0D6E0');
  // Near leg, driving down.
  line(ctx, PANTS, 24, [near.x - 34, -30, near.x - 6, near.y - 14]);
  box(ctx, near.x - 10, near.y - 18, 12, 5, alpha('#DDE6F0', 0.7));
  sneaker(ctx, near.x, near.y, 1.7);
  spray(ctx, 40, 172, sec, 2.4);
  splash(ctx, 300, 172, (S - STAND + 1.8) % 0.9, 1.6);
  rain(ctx, sec, 0.9, 0.9, { speed: 300 });
}

function rampShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const a = leafAngle(S);
  const L = 150,
    px = 34,
    py = 166,
    rx = px + 2 * L + 4;
  gradient(ctx, -10, 180, NIGHT_SKY);
  clouds(ctx, sec, 8, MAGENTA, 0.16);
  row(ctx, FAR, 1200);
  row(ctx, { ...MID, base: 178 }, 1500);
  box(ctx, -20, 176, W + 40, 20, '#060818');
  for (let i = 0; i < 8; i++)
    box(ctx, 150 + rand(i) * 110, 170 + rand(i * 3) * 8, 8, 1, alpha('#8FA6E0', 0.3));
  box(ctx, -20, py, px + 20, 8, '#1C2036');
  leafSlab(ctx, px, py, L, a, 1, sec);
  leafSlab(ctx, rx, py, L, a, -1, sec);
  const d = L - 100 * (TAKEOFF - S);
  let x: number, y: number, tilt: number;
  if (S < TAKEOFF) {
    if (d < 0) {
      x = px + d;
      y = py - 2;
      tilt = 0;
    } else {
      x = px + d * Math.cos(a);
      y = py - 2 - d * Math.sin(a);
      tilt = -a;
    }
  } else {
    const t = S - TAKEOFF;
    x = px + L * Math.cos(a) + 100 * Math.cos(a) * t;
    y = py - 2 - L * Math.sin(a) - 100 * Math.sin(a) * t + 0.5 * 170 * t * t;
    tilt = -a + t * 0.3;
  }
  rider(ctx, x, y, 1.15, { crank: S * 13, wheel: S * 20, stand: 0.9, tilt, rim: CYAN, blur: 1 });
  if (S < TAKEOFF && d > 0) spray(ctx, x - 18, y, sec, 1);
  rain(ctx, sec, 1, 0.3);
}

function apexShot(ctx: Ctx, c: Cut) {
  const S = c.S;
  const slow = (S - 81) * 0.06;
  zoomed(ctx, 160, 120, 1 + c.k * 0.1, () => {
    gradient(ctx, -20, H + 20, ['#070920', '#141440', '#34205A', '#241640']);
    glow(ctx, 168, 70, 130, '#CFC8FF', 0.3);
    disc(ctx, 168, 70, 30, '#DCD8F4');
    disc(ctx, 160, 62, 7, alpha('#B8B4D8', 0.6));
    disc(ctx, 178, 80, 5, alpha('#B8B4D8', 0.5));
    for (let i = 0; i < 4; i++)
      oval(ctx, 110 + i * 44 + slow * 20, 50 + i * 13, 60, 2.5, alpha('#4A3A6A', 0.45));
    // Seen from below: the raised leaves poke up from the bottom corners, lamps at their tips.
    poly(ctx, '#0A0B18', [-20, 200, -20, 150, 86, 132, 92, 140, 30, 200]);
    poly(ctx, '#0A0B18', [340, 200, 340, 146, 236, 128, 230, 136, 290, 200]);
    for (let k = 0; k < 6; k++) {
      box(ctx, -10 + k * 17, 148 - k * 3, 1.5, 1.5, '#FFD27E');
      box(ctx, 330 - k * 17, 144 - k * 3, 1.5, 1.5, '#FFD27E');
    }
    glow(ctx, 88, 134, 18, TAIL, 0.5);
    glow(ctx, 234, 130, 18, TAIL, 0.5);
    const x = lerp(128, 192, c.k),
      y = lerp(138, 132, c.k) - Math.sin(c.k * Math.PI) * 4;
    glow(ctx, x, y - 50, 70, CYAN, 0.1);
    rider(ctx, x, y, 1.9, {
      crank: 1.3 + slow * 6,
      wheel: slow * 8,
      stand: 0.7,
      tilt: lerp(-0.26, -0.08, c.k),
      dark: 0.84,
      rim: alpha(MAGENTA, 0.95),
    });
    for (let i = 0; i < 22; i++) {
      const a = rand(i * 2.3) * TAU,
        d = 16 + rand(i * 4.1) * 28;
      box(
        ctx,
        x - 34 + Math.cos(a) * d * 0.6 - slow * 20,
        y - 8 + Math.sin(a) * d * 0.35 + slow * 10,
        1.5,
        1.5,
        alpha('#DDE8FF', 0.7),
      );
    }
  });
  rainfall(ctx, 84 + (S - 81) * 0.04, {
    amount: 1.2,
    speed: 200,
    slant: 0.1,
    length: 3,
    color: alpha('#DDE8FF', 0.75),
    seed: 21,
  });
}

function airShot(ctx: Ctx, c: Cut) {
  const S = c.S;
  const clock = 84 + (S - 84.5) * 0.05;
  gradient(ctx, 0, H, ['#0A0B26', '#1A1846', '#40225E']);
  glow(ctx, 256, 36, 90, '#CFC8FF', 0.22);
  bokeh(ctx, clock, 0.7);
  kaiFace(
    ctx,
    150,
    104,
    2.7,
    {
      hood: 0.45,
      lid: 0.3,
      look: [0.55, 0.9],
      brow: 0.1,
      mouth: 'breath',
      wet: 0.8,
      rimL: alpha(CYAN, 0.9),
      rimR: alpha(MAGENTA, 0.8),
      shade: 0.36,
      tilt: -0.12 + c.k * 0.05,
    },
    clock,
  );
  for (let i = 0; i < 14; i++) {
    const x = rand(i * 4.7) * W,
      y = rand(i * 2.1) * H + (S - 84.5) * 2;
    disc(ctx, x, y, 1.5 + rand(i) * 2.5, alpha('#E8F0FF', 0.3));
    box(ctx, x - 1, y - 1, 1, 1, alpha('#FFFFFF', 0.7));
  }
}

function landShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec,
    a = leafAngle(S);
  const L = 176,
    tipX = 110,
    tipY = 64;
  const pivX = tipX + L * Math.cos(a),
    pivY = tipY + L * Math.sin(a);
  ctx.save();
  ctx.translate(jolt(S, LAND, 1.5), jolt(S, LAND, 3.5));
  gradient(ctx, -20, 200, NIGHT_SKY);
  clouds(ctx, sec, 10, MAGENTA, 0.16);
  row(ctx, { ...MID, base: 190 }, 2000);
  box(ctx, -20, 176, W + 40, 20, '#060818');
  leafSlab(ctx, tipX - 66 - L * Math.cos(a), pivY, L, a, 1, sec);
  leafSlab(ctx, pivX, pivY, L, a, -1, sec);
  box(ctx, pivX, pivY, 80, 8, '#1C2036');
  const touch = 24;
  let x: number, y: number, tilt: number;
  if (S < LAND) {
    const t = span(S, 86.5, LAND);
    const tx = tipX + touch * Math.cos(a),
      ty = tipY + touch * Math.sin(a) - 2;
    x = lerp(tx - 80, tx, t);
    y = lerp(ty - 34, ty, t * t);
    tilt = lerp(-0.2, a, t);
  } else {
    const d = touch + (S - LAND) * 120;
    if (d < L) {
      x = tipX + d * Math.cos(a);
      y = tipY + d * Math.sin(a) - 2;
      tilt = a + Math.sin((S - LAND) * 14) * 0.12 * Math.exp(-(S - LAND) * 3);
    } else {
      x = pivX + (d - L);
      y = pivY - 2;
      tilt = 0;
    }
  }
  const crouch = hump(S, LAND - 0.05, LAND + 0.5);
  rider(ctx, x, y, 1.2, {
    crank: S * 12,
    wheel: S * 20,
    stand: 0.6 * (1 - crouch),
    crouch,
    tilt,
    rim: CYAN,
  });
  const rear = { x: x - 16 * 1.2 * Math.cos(tilt), y: y - 16 * 1.2 * Math.sin(tilt) };
  sparks(ctx, rear.x, rear.y, S - LAND, 1, 1.3);
  splash(ctx, rear.x + 10, rear.y, S - LAND, 1.3);
  ctx.restore();
  rain(ctx, sec, 1, 0.3);
}

function hillShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const slope = 0.3;
  const ground = (x: number) => 178 - x * Math.tan(slope);
  gradient(ctx, -10, 180, NIGHT_SKY);
  clouds(ctx, sec, 4, MAGENTA, 0.14);
  box(ctx, 196, -4, 150, 94, '#1A1E3A');
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 6; i++)
      if (rand(i * 3 + j * 11) < 0.7)
        box(ctx, 248 + i * 13, 32 + j * 14, 8, 6, alpha('#DDF2FF', 0.7));
  glow(ctx, 226, 44, 34, TAIL, 0.4);
  box(ctx, 222, 30, 8, 26, '#FF5A6A');
  box(ctx, 213, 39, 26, 8, '#FF5A6A');
  box(ctx, 240, 12, 84, 12, '#0A0B14');
  glow(ctx, 282, 18, 40, MAGENTA, 0.25);
  write(ctx, "ST. ALDER'S", 282, 21, { size: 8, color: '#FFE4EC' });
  for (let i = 0; i < 5; i++) {
    const x = i * 44 - 6;
    const top = ground(x + 44) - 46 - rand(i) * 20;
    box(ctx, x, top, 42, ground(x) - top, i % 2 ? '#0D0F28' : '#101230');
    box(ctx, x + 8, top + 10, 6, 8, alpha(WARM_WINDOWS[i % 4], 0.6));
    box(ctx, x + 24, top + 14, 6, 8, alpha(WARM_WINDOWS[(i + 2) % 4], 0.5));
  }
  poly(ctx, ASPHALT, [-10, ground(-10), W + 10, ground(W + 10), W + 10, 200, -10, 200]);
  line(ctx, alpha('#9AB0E8', 0.35), 1, [-10, ground(-10), W + 10, ground(W + 10)]);
  for (let i = 0; i < 3; i++) {
    const lx = 40 + i * 110;
    line(ctx, '#07080F', 2, [lx, ground(lx), lx, ground(lx) - 70]);
    glow(ctx, lx, ground(lx) - 70, 30, '#FFD9A0', 0.3);
  }
  const x = lerp(30, 150, c.k),
    y = ground(x);
  rider(ctx, x, y, 1.3, {
    crank: S * 4.5,
    wheel: S * 5,
    stand: 1,
    tilt: -slope + Math.sin(S * 9) * 0.03,
    rim: MAGENTA,
  });
  rain(ctx, sec, 1.1, 0.35);
}

function chainShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const snapped = S >= SNAP,
    since = S - SNAP;
  box(ctx, 0, 0, W, H, '#0C0F20');
  bokeh(ctx, sec, 0.5, [AMBER, MAGENTA]);
  poly(ctx, '#080A16', [0, 176, W, 136, W, H, 0, H]);
  const strain = snapped ? jolt(S, SNAP, 3) : Math.sin(sec * 31) * 0.8 * span(S, 95.8, SNAP);
  ctx.save();
  ctx.translate(strain, strain * 0.5);
  const cx = 212,
    cy = 96,
    R = 42;
  const crank = snapped ? 0.9 + 9 * (1 - Math.exp(-since * 1.4)) : 0.35 + (S - 95.8) * 0.7;
  const link = (x: number, y: number, i: number) =>
    box(ctx, x - 2, y - 1.5, 4, 3, i % 2 ? '#9AA2B4' : '#5A6072');
  const run = (x0: number, y0: number, x1: number, y1: number, offset = 0) => {
    const n = Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 4.5));
    for (let i = 0; i <= n; i++) link(lerp(x0, x1, i / n), lerp(y0, y1, i / n), i + offset);
  };
  const top = { x: cx - 4, y: cy - R - 1 },
    far = { x: -10, y: cy - 22 },
    cut = { x: 116, y: lerp(far.y, top.y, (116 - far.x) / (top.x - far.x)) };
  run(-10, cy + 22, cx - 4, cy + R + 1, Math.floor(crank * 6));
  if (!snapped) run(far.x, far.y, top.x, top.y, Math.floor(crank * 6));
  else {
    // The loose end whips away; the rest flops off the ring and swings.
    ctx.save();
    ctx.translate(-150 * since, -40 * since + 260 * since * since);
    ctx.rotate(-1.6 * since);
    run(far.x, far.y, cut.x, cut.y, 0);
    ctx.restore();
    if (since < 0.6)
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * rand(i * 3.3);
        link(
          cut.x + Math.cos(a) * since * 110,
          cut.y + Math.sin(a) * since * 80 + 260 * since * since,
          i,
        );
      }
    if (since < 0.18) glow(ctx, cut.x, cut.y, 22, '#FFE9A8', 0.6 * (1 - since / 0.18));
  }
  disc(ctx, cx, cy, R + 2, '#3A4254');
  disc(ctx, cx, cy, R - 7, '#1A1E2A');
  for (let i = 0; i < 24; i++) {
    const t = crank + (i / 24) * TAU;
    box(ctx, cx + Math.cos(t) * (R + 3) - 1.5, cy + Math.sin(t) * (R + 3) - 1.5, 3, 3, '#4A5264');
  }
  for (let i = 0; i < 5; i++) {
    const t = crank + (i / 5) * TAU;
    disc(ctx, cx + Math.cos(t) * 20, cy + Math.sin(t) * 20, 3, '#2A2E3A');
  }
  if (snapped) {
    // What is left flops off the top of the ring and swings, dripping.
    const length = Math.hypot(top.x - cut.x, top.y - cut.y) * 0.7;
    const swing = Math.PI / 2 + (Math.PI / 2) * Math.exp(-since * 2.4) * Math.cos(since * 7);
    run(top.x, top.y, top.x + Math.cos(swing) * length, top.y + Math.sin(swing) * length, 1);
  }
  const pedal = { x: cx + Math.cos(crank) * 62, y: cy + Math.sin(crank) * 62 };
  line(ctx, '#AEB6C6', 8, [cx, cy, pedal.x, pedal.y]);
  disc(ctx, cx, cy, 7, '#D0D6E0');
  box(ctx, pedal.x - 14, pedal.y - 1, 28, 4, '#8A92A4');
  // Her foot, pushing hard, then gone off the spinning pedal.
  const slip = snapped ? ease(span(since, 0, 0.35)) : 0;
  const foot = {
    x:
      lerp(cx + Math.cos(0.35) * 62, cx + 150, slip) +
      (snapped ? 0 : Math.cos(crank) * 62 - Math.cos(0.35) * 62),
    y:
      lerp(cy + Math.sin(0.35) * 62, 250, slip) +
      (snapped ? 0 : Math.sin(crank) * 62 - Math.sin(0.35) * 62),
  };
  line(ctx, PANTS, 24, [foot.x - 50, -30, foot.x - 6, foot.y - 14]);
  box(ctx, foot.x - 10, foot.y - 18, 12, 5, alpha('#DDE6F0', 0.7));
  sneaker(ctx, foot.x, foot.y, 1.8);
  ctx.restore();
  for (let i = 0; i < 4; i++) {
    const t = (sec * 1.4 + i / 4) % 1;
    box(ctx, cx - 30 + i * 18, cy + R + 6 + t * 40, 1.2, 2.5, alpha('#CFE2FF', 0.7 * (1 - t)));
  }
  rain(ctx, sec, 0.7, 0.3);
}

// Running up to St. Alder's.
const runX = (S: number) => (S < RUN ? 76 : 76 + (S - RUN) * 118);
function hospitalFront(ctx: Ctx, sec: number, from: number, to: number) {
  box(ctx, 300, 10, 820, 140, '#171B36');
  for (let x = Math.max(310, Math.floor(from / 24) * 24 + 10); x < Math.min(1110, to); x += 24)
    for (let j = 0; j < 4; j++)
      if (rand(x * 0.37 + j * 5.3) < 0.62) box(ctx, x, 22 + j * 18, 10, 8, alpha('#DDF2FF', 0.65));
  glow(ctx, 560, 40, 34, TAIL, 0.35);
  box(ctx, 556, 26, 8, 28, '#FF5A6A');
  box(ctx, 546, 36, 28, 8, '#FF5A6A');
  glow(ctx, 640, 90, 24, TAIL, 0.3);
  box(ctx, 614, 84, 52, 10, '#0A0B14');
  write(ctx, 'EMERGENCY', 640, 91.5, { size: 6, color: '#FF6A7A' });
  box(ctx, 700, 98, 170, 7, '#23284A');
  box(ctx, 712, 90, 146, 9, '#0A0B14');
  write(ctx, "ST. ALDER'S HOSPITAL", 785, 97, { size: 6.5, color: '#F2F6FF' });
  box(ctx, 706, 105, 4, 45, '#23284A');
  box(ctx, 862, 105, 4, 45, '#23284A');
  glow(ctx, 780, 128, 50, '#CFEFF0', 0.35);
  box(ctx, 752, 110, 58, 40, '#BFE3E4');
  box(ctx, 780, 110, 2, 40, '#6A8A90');
  void sec;
}
function runShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const kx = runX(S);
  const scroll = clamp(kx - 110, 0, 600);
  gradient(ctx, -10, 150, NIGHT_SKY);
  clouds(ctx, sec, 4, MAGENTA, 0.12);
  ctx.save();
  ctx.translate(-scroll * 0.3, 0);
  row(ctx, FAR, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(-scroll, 0);
  box(ctx, -20, 60, 320, 90, '#0D0F28');
  hospitalFront(ctx, sec, scroll, scroll + W);
  box(ctx, -20, 150, 1200, 40, ASPHALT);
  box(ctx, -20, 150, 1200, 1, alpha('#9AB0E8', 0.3));
  for (let lx = 30; lx < 1100; lx += 140) {
    if (lx + 20 < scroll || lx - 20 > scroll + W) continue;
    box(ctx, lx, 70, 2, 80, '#07080F');
    box(ctx, lx - 6, 70, 10, 2, '#07080F');
    glow(ctx, lx - 4, 74, 36, '#FFD9A0', 0.32);
    glow(ctx, lx - 4, 150, 30, '#FFD9A0', 0.1);
  }
  ambulance(ctx, 520, 148, 1.3, sec);
  reflect(ctx, 150, sec, () => {
    glow(ctx, 780, 128, 50, '#CFEFF0', 0.35);
    glow(ctx, 640, 90, 24, TAIL, 0.3);
    glow(ctx, 560, 40, 34, TAIL, 0.35);
  });
  const fall = ease(span(S, 98.5, 99.1));
  bicycle(ctx, 60, 158, 1.3, fall * -1.35, { chain: false, box: S < 98.75, crank: 1 }, 0);
  const running = S >= RUN;
  runner(ctx, kx, 160, 1.45, {
    phase: TAU * STRIDE * Math.max(0, S - RUN),
    speed: running ? 1 : 0,
    rim: MAGENTA,
    box: S >= 98.75,
    reach: S < 98.75 ? ([10, -22] as const) : undefined,
  });
  for (const f of RUN_STEPS) splash(ctx, runX(f) + 4, 162, S - f, 0.5);
  ctx.restore();
  rain(ctx, sec, 1, 0.3);
}

function liftShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  box(ctx, 0, 0, W, H, '#8FAAA6');
  box(ctx, 0, 0, W, 14, '#6E8884');
  box(ctx, 40, 4, 90, 4, '#F4FFFC');
  box(ctx, 190, 4, 90, 4, '#F4FFFC');
  glow(ctx, 160, 10, 180, '#F4FFFC', 0.25);
  box(ctx, 0, 110, W, 3, '#6E8884');
  box(ctx, 0, 140, W, 40, '#6E7E7C');
  box(ctx, 116, 46, 78, 94, '#5A6A70');
  box(ctx, 120, 50, 34, 90, '#B8C6CC');
  box(ctx, 156, 50, 34, 90, '#B8C6CC');
  box(ctx, 154, 50, 2, 90, '#6A7A80');
  box(ctx, 140, 36, 30, 8, '#101418');
  write(ctx, '- -', 155, 42.5, { size: 6, color: alpha('#FF4A5A', 0.5) });
  box(ctx, 128, 74, 54, 24, '#F4F1E8');
  box(ctx, 126, 72, 7, 3, alpha('#E8E0B0', 0.8));
  box(ctx, 177, 72, 7, 3, alpha('#E8E0B0', 0.8));
  write(ctx, 'OUT OF', 155, 84, { size: 7, color: '#15161C' });
  write(ctx, 'ORDER', 155, 94, { size: 7, color: '#15161C' });
  box(ctx, 202, 86, 9, 16, '#7A888C');
  const pressed = BUTTON.some((b) => S >= b && S < b + 0.2);
  disc(ctx, 206.5, 94, 2.4, pressed ? '#C8D0D4' : '#E4ECEE');
  box(ctx, 262, 46, 50, 94, '#6A7E7A');
  const doorOpen =
    ease(span(S, STAIRS_DOOR - 0.1, STAIRS_DOOR + 0.2)) * (1 - ease(span(S, 107.9, 108)));
  box(ctx, 266, 50, 42 * (1 - doorOpen * 0.8), 90, '#9AB0AC');
  box(ctx, 270, 36, 34, 9, '#1A7A4A');
  write(ctx, 'STAIRS', 287, 43, { size: 5, color: '#EFFFF4' });
  reflect(
    ctx,
    140,
    sec,
    () => {
      box(ctx, 120, 50, 70, 90, '#B8C6CC');
      box(ctx, 128, 74, 54, 24, '#F4F1E8');
    },
    0.25,
  );
  let x: number,
    phase = 0,
    speed = 0,
    facing: 1 | -1 = 1;
  let reach: readonly [number, number] | undefined;
  if (S < 105.6) {
    x = lerp(-20, 172, span(S, 104.8, 105.6));
    phase = TAU * STRIDE * (S - 104.8);
    speed = 1;
  } else if (S < 107) {
    x = 172;
    const jab = Math.max(...BUTTON.map((b) => hump(S, b - 0.2, b + 0.25)));
    reach = [lerp(9, 19.5, jab), lerp(-24, -34, jab)];
  } else {
    x = lerp(172, 300, easeIn(span(S, 107, 107.9)));
    phase = TAU * STRIDE * (S - 107);
    speed = 1;
  }
  for (let i = 0; i < 6; i++)
    oval(ctx, 30 + i * 30, 152 + (i % 2) * 3, 4, 1.2, alpha('#4A5A5C', 0.5));
  runner(ctx, x, 152, 1.7, { phase, speed, facing, reach, rim: alpha('#FFFFFF', 0.5) });
  for (let i = 0; i < 3; i++) {
    const t = (sec * 1.2 + i / 3) % 1;
    box(ctx, x - 6 + i * 6, 120 + t * 32, 1, 2, alpha('#DDF2FF', 0.7 * (1 - t)));
  }
}

function stairsShot(ctx: Ctx, c: Cut) {
  const S = c.S;
  box(ctx, 0, 0, W, H, '#2A3434');
  const u = span(S, 108, 112.8);
  const cx = 160,
    cy = 92;
  for (let f = 0; f <= 4; f++) {
    const sc = 1 / (1 + 0.5 * f);
    const outer = 150 * sc,
      inner = 64 * sc;
    const shade = mix('#8FA8A2', '#1A2222', f / 5);
    box(ctx, cx - outer, cy - outer * 0.62, outer * 2, outer * 1.24, shade);
    for (let k = 0; k < 6; k++) {
      const t = k / 6;
      box(
        ctx,
        cx - outer + t * (outer - inner),
        cy - outer * 0.62,
        1,
        outer * 1.24,
        alpha('#000000', 0.12),
      );
      box(
        ctx,
        cx + inner + t * (outer - inner),
        cy - outer * 0.62,
        1,
        outer * 1.24,
        alpha('#000000', 0.12),
      );
    }
    box(ctx, cx - inner, cy - inner * 0.62, inner * 2, inner * 1.24, '#101616');
    ctx.strokeStyle = mix('#C8D84A', '#2A3020', f / 5);
    ctx.lineWidth = Math.max(0.8, 3 * sc);
    ctx.strokeRect(cx - inner, cy - inner * 0.62, inner * 2, inner * 1.24);
    write(ctx, String(4 - f), cx - outer + 12 * sc, cy - outer * 0.62 + 18 * sc, {
      size: Math.max(4, 16 * sc),
      color: mix('#F2F2EA', '#3A4040', f / 5),
    });
  }
  const floors = 3 * (1 - u);
  const sc = 1 / (1 + 0.5 * floors);
  const ang = u * TAU * 3 + Math.PI * 0.75;
  const m = Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
  const rr = 100 * sc;
  const kx = cx + (Math.cos(ang) / m) * rr,
    ky = cy + (Math.sin(ang) / m) * rr * 0.62;
  kaiTop(ctx, kx, ky, 2.6 * sc, ang + Math.PI / 2, false, (S - 108) * TAU * 2);
  glow(ctx, cx, cy, 160, '#F4FFFC', 0.1);
}

function corridor(ctx: Ctx, vx: number, vy: number, warm = 0) {
  const wall = mix('#7FA09C', '#C8A888', warm * 0.5);
  box(ctx, 0, 0, W, H, wall);
  poly(ctx, mix('#B8CCC8', '#E8D8C0', warm * 0.5), [
    0,
    0,
    W,
    0,
    vx + 30,
    vy - 30,
    vx - 30,
    vy - 30,
  ]);
  poly(ctx, '#6E7E7C', [0, H, W, H, vx + 30, vy + 26, vx - 30, vy + 26]);
  poly(ctx, mix('#6A8A86', '#A88A70', warm * 0.5), [
    0,
    0,
    vx - 30,
    vy - 30,
    vx - 30,
    vy + 26,
    0,
    H,
  ]);
  poly(ctx, mix('#6A8A86', '#A88A70', warm * 0.5), [
    W,
    0,
    vx + 30,
    vy - 30,
    vx + 30,
    vy + 26,
    W,
    H,
  ]);
  for (let k = 1; k < 5; k++) {
    const z = 1 + k * 0.9;
    const w = 40 / z,
      y = vy - 30 - 60 / z;
    box(ctx, vx - w / 2, y, w, 3 / z + 1, '#F4FFFC');
  }
  box(ctx, vx - 30, vy - 30, 60, 56, mix('#5A7A76', '#8A6A58', warm * 0.5));
}
function doorsShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const vx = 160,
    vy = 82;
  corridor(ctx, vx, vy);
  write(ctx, 'SURGERY  →', 60, 40, { size: 6, color: '#1A2A2A' });
  const open =
    ease(span(S, BURST, BURST + 0.15)) * (1 - 0.2 * ease(span(S, BURST + 0.2, BURST + 1)));
  box(ctx, vx - 22, vy - 26, 44, 52, '#1A2A2A');
  glow(ctx, vx, vy, 30, '#F4FFFC', 0.3 * open);
  box(ctx, vx - 22, vy - 26, 22 * (1 - open * 0.85), 52, '#9AB0AC');
  box(ctx, vx + 22 - 22 * (1 - open * 0.85), vy - 26, 22 * (1 - open * 0.85), 52, '#9AB0AC');
  const t = span(S, BURST + 0.05, 117.9);
  if (S >= BURST) {
    const Z = lerp(4, 1.3, t);
    const ph = TAU * STRIDE * (S - BURST);
    kaiFront(ctx, vx - 10 / Z, vy + 100 / Z, 2.58 / Z, {
      phase: ph,
      sec,
      face: { lid: 0.1, brow: 0.8, mouth: 'open', wet: 1, shade: 0.12, night: '#1C2A34' },
    });
  }
  const turn = ease(span(S, 116.1, 116.6));
  ctx.save();
  ctx.translate(270, 180);
  poly(ctx, SCRUBS, [-50, 0, -42, -60, -20, -72, 20, -72, 42, -60, 50, 0]);
  box(ctx, -7, -82, 14, 12, '#B98466');
  oval(ctx, 0, -98, 17, 20, DOC_SKIN);
  poly(ctx, '#5AAE90', [-18, -96, -16, -114, 0, -120, 16, -114, 18, -96, 0, -104]);
  line(ctx, '#E4F2EC', 0.8, [-16, -94, -8, -90]);
  if (turn > 0.2) {
    poly(ctx, MASK, [-17 + turn * 4, -96, -10, -88, -13, -80, -18, -84]);
    box(ctx, -15, -104, 3, 2, '#2A2A2A');
  }
  ctx.restore();
}

function handoffShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  box(ctx, 0, 0, W, H, '#6E8C88');
  glow(ctx, 290, 50, 120, '#FFE2B0', 0.3);
  box(ctx, 0, 118, W, 62, '#5A6E6C');
  const pass = ease(span(S, HANDOFF - 0.3, HANDOFF + 0.4));
  poly(ctx, JACKET_D, [-10, 180, 0, 112, 54, 100, 104, 112, 116, 180]);
  kaiFace(
    ctx,
    66,
    62,
    1.25,
    {
      turn: 0.7,
      lid: 0.3,
      look: [0.8, 0.5],
      brow: 0.6,
      mouth: 'open',
      wet: 1,
      collar: false,
      shade: 0.12,
      night: '#1C2A34',
    },
    sec,
  );
  poly(ctx, SCRUBS, [216, 180, 222, 110, 262, 96, 300, 104, 330, 180]);
  surgeonFace(ctx, 258, 58, 1.25, { turn: -0.6, look: [-0.9, 0.5], shade: 0.06 });
  const bx = lerp(150, 176, pass),
    by = lerp(126, 120, pass);
  const kaiReach = 1 - ease(span(S, HANDOFF + 0.3, HANDOFF + 0.9));
  if (kaiReach > 0.25)
    for (const dy of [-12, 12]) {
      line(ctx, JACKET_D, 11, [70, 150 + dy, lerp(96, bx - 40, kaiReach), by + dy * 0.6]);
      disc(ctx, lerp(96, bx - 44, kaiReach), by + dy * 0.6, 5, GLOVE);
    }
  lid(ctx, bx, by, 0.44, -0.05, { S, sy: 0.72, beads: 0.6, scuff: 1, night: 0.08 });
  const reach = ease(span(S, HANDOFF - 0.6, HANDOFF));
  for (const dy of [-12, 12]) {
    line(ctx, SCRUBS_D, 11, [250, 150 + dy, lerp(262, bx + 46, reach), by + dy * 0.6]);
    disc(ctx, lerp(262, bx + 46, reach), by + dy * 0.6, 5, '#6FB8C8');
  }
  const press = hump(S, STOP_CLOCK - 0.25, STOP_CLOCK + 0.35);
  if (press > 0) oval(ctx, bx + 32 - press * 2, by - 6 + (1 - press) * 10, 5, 6, '#6FB8C8');
}
function surgeonShot(ctx: Ctx, c: Cut) {
  box(ctx, 0, 0, W, H, '#6E8C88');
  glow(ctx, 260, 40, 140, '#FFE2B0', 0.35);
  glow(ctx, 40, 150, 90, '#9FE6E0', 0.15);
  const nod = hump(c.S, 120.6, 121.15);
  surgeonFace(ctx, 170, 100 + nod * 5, 3.4, {
    turn: -0.25,
    look: [-0.5, 0.1 + nod * 0.5],
    smile: ease(span(c.S, 120.85, 121.3)),
    lid: 0.15 + nod * 0.3,
    shade: 0.04,
    brow: 0.5,
  });
}
function kaiCloseShot(ctx: Ctx, c: Cut) {
  box(ctx, 0, 0, W, H, '#3E5452');
  glow(ctx, 60, 30, 120, '#DFF6F2', 0.25);
  const nod = hump(c.S, 122, 122.5);
  kaiFace(
    ctx,
    156,
    100 + nod * 5,
    3.4,
    {
      turn: 0.25,
      lid: 0.35 + nod * 0.35,
      look: [0.4, 0.1],
      brow: 0.8,
      mouth: c.S > 122.3 ? 'breath' : 'flat',
      wet: 1,
      tear: 1,
      shade: 0.12,
      night: '#1C2A34',
      rimR: alpha('#FFE2B0', 0.5),
      catch: [alpha('#FFFFFF', 0.9), alpha('#FFE2B0', 0.8)],
    },
    c.sec,
  );
}
function labelShot(ctx: Ctx, c: Cut) {
  box(ctx, 0, 0, W, H, '#6E8C88');
  box(ctx, 60, 10, 200, 170, '#5A7A76');
  disc(ctx, 110, 60, 16, '#FFE6B8');
  disc(ctx, 210, 60, 16, '#FFE6B8');
  glow(ctx, 160, 60, 120, '#FFE2B0', 0.35);
  const away = ease(span(c.S, 123.7, 125.2));
  const s = lerp(1, 0.8, away),
    x = lerp(160, 172, away),
    y = lerp(98, 92, away);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  line(ctx, SCRUBS_D, 18, [-160, 80, -112, 10]);
  line(ctx, SCRUBS_D, 18, [160, 80, 112, 10]);
  box(ctx, -110, -54, 220, 108, '#DCE3E8');
  box(ctx, -106, -50, 212, 100, '#EAF0F3');
  const hp: number[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * TAU;
    hp.push(
      -74 + 16 * Math.sin(a) ** 3 * 1.1,
      -2 - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 1.1,
    );
  }
  poly(ctx, RED, hp);
  write(ctx, 'DONOR', 22, -6, { size: 20, color: RED });
  write(ctx, 'HEART', 22, 16, { size: 20, color: RED });
  write(ctx, 'HUMAN ORGAN FOR TRANSPLANT', 0, 38, { size: 7, color: '#3A4450' });
  oval(ctx, -112, 10, 8, 10, '#6FB8C8');
  oval(ctx, 112, 10, 8, 10, '#6FB8C8');
  ctx.restore();
}
function shutShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  box(ctx, 0, 0, W, H, '#6A8884');
  box(ctx, 0, 140, W, 40, '#5A6A68');
  box(ctx, 104, 34, 112, 116, '#3E5654');
  const through = 1 - ease(span(S, 125.2, SHUT));
  glow(ctx, 160, 90, 70, '#FFE2B0', 0.2 + 0.4 * through);
  box(ctx, 110, 40, 100, 110, '#FFE9C4');
  const docX = lerp(160, 176, span(S, 125.2, SHUT));
  person(ctx, docX, 138, {
    skin: DOC_SKIN,
    hair: '#5AAE90',
    coat: SCRUBS,
    legs: SCRUBS_D,
    build: 'adult',
    size: 2 - span(S, 125.2, SHUT) * 0.4,
    facing: 1,
    hat: 'cap',
    hatColor: '#5AAE90',
    arms: [0.8, 0.8],
    mouth: 'none',
  });
  const swing =
    S < SHUT
      ? lerp(1.2, 0, ease(span(S, 125.3, SHUT)))
      : 0.14 * Math.exp(-(S - SHUT) * 3) * Math.sin((S - SHUT) * 12);
  const pw = 50 * Math.cos(Math.abs(swing));
  box(ctx, 110, 40, pw, 110, '#9AB4B0');
  box(ctx, 210 - pw, 40, pw, 110, '#9AB4B0');
  if (pw > 20) {
    for (const px of [110 + pw / 2, 210 - pw / 2]) {
      disc(ctx, px, 72, 9 * (pw / 50), '#5A6E6C');
      oval(ctx, px, 72, 7 * (pw / 50), 7, '#FFE6B8');
    }
  }
  box(ctx, 159, 40, 2, 110, alpha('#3E5654', pw / 50));
  const lit = ease(span(S, SHUT + 0.5, SHUT + 1.2));
  box(ctx, 130, 20, 60, 10, '#1A1A1E');
  glow(ctx, 160, 25, 40, TAIL, 0.35 * lit);
  write(ctx, 'IN SURGERY', 160, 27.5, { size: 5.5, color: mix('#4A2A2E', '#FF8A96', lit) });
  // Kai from behind, watching the doors: hood up, the courier's X on her back.
  ctx.save();
  ctx.translate(62, 184 + Math.sin(sec * 3) * 1.2);
  ctx.scale(1.9, 1.9);
  poly(ctx, '#6A5418', [-40, 0, -36, -32, -16, -42, 16, -42, 36, -32, 40, 0]);
  box(ctx, -12, -36, 24, 22, '#262A3A');
  line(ctx, alpha('#E8EEF6', 0.6), 1.6, [-20, -4, 20, -34]);
  line(ctx, alpha('#E8EEF6', 0.6), 1.6, [20, -4, -20, -34]);
  oval(ctx, 0, -56, 16, 18, '#8A6C1E');
  poly(ctx, '#7A6019', [-14, -60, 0, -76, 14, -60, 0, -64]);
  line(ctx, '#5A4612', 1, [0, -74, 0, -40]);
  line(ctx, alpha('#FFE2B0', 0.6), 1, [13, -66, 16, -52, 14, -44]);
  line(ctx, alpha('#FFE2B0', 0.5), 1, [36, -32, 40, 0]);
  ctx.restore();
}

function benchShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const dawn = ease(span(S, DAWN_FROM, 133.5));
  zoomed(ctx, 140, 104, 1.3 + c.k * 0.1, () => {
    box(ctx, -20, -20, W + 40, 150, mix('#5E7A80', '#B8A48C', dawn * 0.6));
    box(ctx, -20, 92, W + 40, 3, mix('#4A6468', '#8A7A6A', dawn * 0.5));
    box(ctx, 214, 16, 88, 96, '#3A4A50');
    ctx.save();
    ctx.beginPath();
    ctx.rect(218, 20, 80, 88);
    ctx.clip();
    gradient(ctx, 20, 108, skyAt(dawn));
    glow(ctx, 270, 104, 60, '#FFE2A0', 0.5 * dawn);
    row(ctx, { ...FAR, base: 112 }, 700, false, dawn, mix('#16183C', '#6A5A70', dawn));
    for (let i = 0; i < Math.round(14 * (1 - dawn * 0.7)); i++) {
      const t = (sec * 0.2 + rand(i)) % 1;
      box(ctx, 220 + rand(i * 3.3) * 76, 20 + t * 88, 1, 3, alpha('#DDEBFF', 0.5));
    }
    ctx.restore();
    box(ctx, 257, 16, 2, 96, '#3A4A50');
    poly(ctx, alpha('#FFE2A0', 0.22 * dawn), [218, 108, 298, 108, 250, 180, 120, 180]);
    box(ctx, -20, 130, W + 40, 60, mix('#4E5E60', '#8A7A68', dawn * 0.6));
    box(ctx, 60, 20, 22, 22, '#EDEDE6');
    ctx.strokeStyle = '#2A2A2E';
    ctx.lineWidth = 1;
    ctx.strokeRect(60.5, 20.5, 21, 21);
    line(ctx, '#1A1A1E', 1.2, [71, 31, 71, 24]);
    line(ctx, '#1A1A1E', 1, [71, 31, 75, 34]);
    for (let i = 0; i < 3; i++) {
      box(ctx, 70 + i * 34, 124, 30, 5, '#2A5A8A');
      box(ctx, 70 + i * 34, 104, 30, 20, '#2F6494');
      box(ctx, 82 + i * 34, 129, 3, 14, '#3A3A40');
    }
    oval(ctx, 124, 162, 30 + dawn * 6, 4, alpha('#3A5A70', 0.5));
    const shake = 1 - ease(span(S, 130.2, 131.2));
    const rest = ease(span(S, 131.8, 132.4));
    kaiSit(ctx, 120, 128, 1.45, {
      shake,
      sec,
      hands: S < 130.2 ? 'lap' : 'knees',
      wet: 1,
      lean: -0.05 * rest,
      face: {
        hood: 0,
        lid: lerp(0.35, 1, rest),
        look: [0, 0.8],
        brow: 0.5,
        mouth: rest > 0.5 ? 'breath' : 'flat',
        wet: 1,
        shade: lerp(0.1, 0.02, dawn),
        night: '#1C2A34',
        tilt: -0.08 * rest,
        rimR: alpha('#FFE2A0', 0.6 * dawn),
      },
    });
    for (let i = 0; i < 2; i++) {
      const t = (sec * 0.9 + i / 2) % 1;
      box(ctx, 112 + i * 16, 132 + t * 28, 1, 2, alpha('#DDF2FF', 0.7 * (1 - t)));
    }
  });
}

/** The monitor's trace: one spike per beat, scrolling left. */
function ecg(ctx: Ctx, x0: number, y0: number, w: number, S: number) {
  const spike = (u: number) => {
    if (u < 0 || u > 0.45) return 0;
    if (u < 0.03) return u / 0.03;
    if (u < 0.06) return lerp(1, -12, (u - 0.03) / 0.03);
    if (u < 0.09) return lerp(-12, 4, (u - 0.06) / 0.03);
    if (u < 0.12) return lerp(4, 0, (u - 0.09) / 0.03);
    if (u > 0.22 && u < 0.38) return -3 * Math.sin(((u - 0.22) / 0.16) * Math.PI);
    return 0;
  };
  const pts: number[] = [];
  for (let i = 0; i <= 40; i++) {
    const tau = S - 2.4 + (i / 40) * 2.4;
    let v = 0;
    for (const b of MONITOR) v += spike(tau - b);
    pts.push(x0 + (i / 40) * w, y0 + v);
  }
  line(ctx, '#6DFF9A', 1, pts);
  glow(ctx, x0 + w, pts[pts.length - 1], 6, '#6DFF9A', 0.6);
}
function windowShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  zoomed(ctx, 152, 98, 1.15 + c.k * 0.2, () => {
    box(ctx, -20, -20, W + 40, H + 40, '#C9A888');
    for (let y = 6; y < H + 20; y += 12) box(ctx, -20, y, W + 40, 1, alpha('#A8866A', 0.6));
    glow(ctx, 40, 20, 200, '#FFE2A0', 0.35);
    box(ctx, 66, 20, 188, 134, '#8A7260');
    box(ctx, 72, 26, 176, 122, '#3A3440');
    glow(ctx, 110, 100, 90, '#FFD8A0', 0.3);
    box(ctx, 72, 124, 176, 24, '#2E2A36');
    // A child asleep in the bed, a bear by her feet.
    box(ctx, 76, 86, 6, 50, '#6A6A78');
    oval(ctx, 100, 104, 17, 7, '#EFEFEA');
    const wake = ease(span(S, WAVE - 0.6, WAVE - 0.2));
    disc(ctx, 101, 99, 7.5, '#D8A07A');
    oval(ctx, 100, 95.5, 8, 5, '#3A2418');
    if (wake > 0.5) {
      box(ctx, 102, 99, 1.2, 1.4, '#2A1A14');
      box(ctx, 106, 99, 1.2, 1.4, '#2A1A14');
    } else {
      box(ctx, 101.5, 100, 2, 0.8, '#2A1A14');
      box(ctx, 105.5, 100, 2, 0.8, '#2A1A14');
    }
    box(ctx, 103.5, 103.5, 2.5, 0.8, '#8A4A3A');
    box(ctx, 90, 106, 96, 42, '#B8C8E0');
    box(ctx, 90, 106, 96, 3, '#DCE6F4');
    line(ctx, alpha('#8A9CB8', 0.8), 1, [120, 118, 150, 124, 176, 120]);
    disc(ctx, 170, 108, 5, '#8A5A34');
    disc(ctx, 166.5, 103.5, 2, '#8A5A34');
    disc(ctx, 173.5, 103.5, 2, '#8A5A34');
    box(ctx, 169, 107, 1, 1, '#1A1210');
    box(ctx, 172, 107, 1, 1, '#1A1210');
    const wave = hump(S, WAVE, WAVE + 1.2);
    const hx = 122,
      hy = 110;
    box(ctx, hx - 6, hy - 1, 5, 3.5, '#F4F4F0');
    oval(ctx, hx + 2, hy, 4.5, 3.2, '#E8B894');
    for (let f = 0; f < 4; f++) {
      const lift = wave * (0.5 + 0.5 * Math.sin(sec * 9 - f * 0.9)) * 3.5;
      box(
        ctx,
        hx + 4.5 + f * 2,
        hy - 3 - lift * (f === 1 || f === 2 ? 1 : 0.7),
        1.5,
        3.6,
        '#E8B894',
      );
    }
    box(ctx, 196, 48, 8, 70, '#4A4A52');
    box(ctx, 176, 40, 58, 40, '#2A2A32');
    box(ctx, 179, 43, 52, 30, '#061008');
    ecg(ctx, 181, 60, 44, S);
    const steady = S > 135.9;
    write(ctx, steady ? '72' : '--', 224, 71, { size: 5, color: '#6DFF9A' });
    poly(ctx, alpha('#FFFFFF', 0.12), [72, 26, 120, 26, 72, 90]);
    poly(ctx, alpha('#FFFFFF', 0.08), [150, 26, 190, 26, 110, 148, 72, 148]);
    box(ctx, 160, 26, 3, 122, '#8A7260');
    box(ctx, 60, 150, 200, 8, '#B8987A');
    for (let i = 0; i < 3; i++) {
      const t = (sec * 0.7 + i * 0.33) % 1;
      box(ctx, 90 + i * 60, 158 + t * 24, 1.4, 2.5, alpha('#FFF4E0', 0.8 * (1 - t)));
    }
  });
}

function stepsShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const pull = ease(span(S, 142.6, 144));
  zoomed(ctx, 160, 116, lerp(1.4, 1, pull), () => {
    gradient(ctx, -40, 130, skyAt(1));
    glow(ctx, 262, 118, 110, '#FFE2A0', 0.55);
    disc(ctx, 262, 122, 14, '#FFF2C8');
    clouds(ctx, sec, 10, '#FFB8A0', 0.35);
    row(ctx, { ...FAR, base: 124 }, 60, false, 1, '#8A7A8E');
    box(ctx, 196, 40, 34, 84, '#8A7A8E');
    heartSign(ctx, 213, 56, 0.9, MAGENTA, 0);
    row(ctx, { ...MID, base: 128, signs: 0.6 }, 140, false, 1, '#6E6070');
    box(ctx, -40, 124, W + 80, 70, '#B89A80');
    for (let k = 0; k < 5; k++) {
      box(ctx, -40, 124 + k * 9, W + 80, 9, k % 2 ? '#C8AA8E' : '#BCA086');
      box(ctx, -40, 124 + k * 9, W + 80, 1, alpha('#FFE8C8', 0.6));
    }
    oval(ctx, 70, 170, 30, 3, alpha('#FFE2A0', 0.5));
    oval(ctx, 250, 166, 24, 2.5, alpha('#FFE2A0', 0.45));
    box(ctx, 250, 20, 14, 106, '#D8C0A4');
    box(ctx, 250, 20, 3, 106, '#F0DCC0');
    line(ctx, '#5A4A40', 1.5, [40, 124, 40, 98, 150, 98]);
    bicycle(ctx, 96, 124, 1.3, -0.12, { chain: false, box: false, crank: 1.2 }, 0.1);
    const radio = S >= RADIO_OUT && S < OFF;
    const laugh = ease(span(S, LAUGH, LAUGH + 0.3)) * (1 - ease(span(S, OFF + 0.4, OFF + 1)));
    const listening = ease(span(S, RADIO_OUT + 0.1, RADIO_OUT + 0.5)) * (1 - laugh);
    const after = ease(span(S, OFF + 0.4, OFF + 1.2));
    kaiSit(ctx, 168, 124, 1.25, {
      sec,
      hands: S >= OFF - 0.35 && S < OFF + 0.4 ? 'radio' : S >= OFF + 0.4 ? 'back' : 'lap',
      wet: 0.5,
      lean: -0.12 * laugh - 0.06 * after,
      radio: true,
      face: {
        hood: 0,
        lid: listening > 0.5 ? 0.2 : lerp(1, 0.2, listening),
        look: [-0.5 * listening, 0.8 * listening],
        brow: 0.9 * listening,
        happy: laugh > 0.4 || after > 0.4 ? 1 : 0,
        mouth: laugh > 0.4 ? 'laugh' : after > 0.4 || S < RADIO_OUT ? 'smile' : 'flat',
        tilt: -0.18 * laugh - 0.1 * after,
        shade: 0,
        rimR: alpha('#FFE2A0', 0.8),
        wet: 0.3,
      },
    });
    if (radio) glow(ctx, 158, 98, 12, '#6DFF9A', 0.3 + 0.15 * Math.sin(sec * 9));
    for (let i = 0; i < 3; i++) {
      const bx = ((sec * (10 + i * 3) + i * 90) % 380) - 30,
        by = 40 + i * 14 + Math.sin(sec * 2 + i) * 3;
      const flap = Math.sin(sec * 9 + i * 2) * 2;
      line(ctx, '#5A4A50', 0.9, [bx - 3, by - flap, bx, by, bx + 3, by - flap]);
    }
  });
}

const SCENES: Record<ShotName, (ctx: Ctx, c: Cut) => void> = {
  city: cityShot,
  eyes: eyesShot,
  hatch: hatchShot,
  timer1: (ctx, c) => timerShot(ctx, c, 1),
  launch: launchShot,
  track: trackShot,
  jam: jamShot,
  bus: busShot,
  face: faceShot,
  overhead: overheadShot,
  timer2: (ctx, c) => timerShot(ctx, c, 2),
  closed: closedShot,
  market: marketShot,
  orange: orangeShot,
  bridge: bridgeShot,
  choice: choiceShot,
  pedals: pedalsShot,
  ramp: rampShot,
  apex: apexShot,
  air: airShot,
  land: landShot,
  timer3: (ctx, c) => timerShot(ctx, c, 3),
  hill: hillShot,
  chain: chainShot,
  run: runShot,
  lift: liftShot,
  stairs: stairsShot,
  timer4: (ctx, c) => timerShot(ctx, c, 4),
  doors: doorsShot,
  handoff: handoffShot,
  surgeon: surgeonShot,
  kai: kaiCloseShot,
  label: labelShot,
  shut: shutShot,
  bench: benchShot,
  window: windowShot,
  steps: stepsShot,
};

const CAPTIONS = [
  [T(RADIO_IN + 0.1), T(RADIO_IN + 3.4), '“Kai. One more run. Urgent.”'],
  [T(11.3), T(14.7), '“St. Alder’s. Fifteen minutes.”'],
  [T(RADIO_OUT + 0.1), T(RADIO_OUT + 3), '“Kai, you there? Got one more…”'],
] as const;

// ——— The score ———
const ROOT = 57; // A
/** Kai's theme, in quavers over i–iv–v–i: it climbs, it pushes, it lands. */
const THEME = [
  12,
  null,
  12,
  15,
  17,
  null,
  15,
  12,
  17,
  null,
  17,
  19,
  20,
  null,
  19,
  17,
  19,
  null,
  22,
  null,
  19,
  17,
  15,
  14,
  12,
  null,
  null,
  7,
  12,
  null,
  null,
  null,
] as const;
/** The same theme, tired, at the end of a shift. */
const TIRED = [
  12,
  null,
  null,
  15,
  17,
  null,
  15,
  null,
  12,
  null,
  null,
  null,
  10,
  null,
  7,
  null,
] as const;
/** And in the major, at dawn. */
const TENDER = [
  12,
  null,
  16,
  17,
  19,
  null,
  16,
  null,
  17,
  null,
  21,
  19,
  16,
  null,
  null,
  null,
] as const;
const FINALE = [
  16,
  19,
  24,
  null,
  21,
  19,
  16,
  null,
  19,
  null,
  24,
  null,
  null,
  null,
  null,
  null,
] as const;

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const nightCourierScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: ROOT, voice: 'keys', intro: [0, 3, 7, 12], outro: [0, 4, 7, 12] },
    (s) => {
      const drive = (
        from: number,
        to: number,
        bpm: number,
        root = ROOT,
        extra: Partial<Section> = {},
      ) =>
        s.section({
          from: T(from),
          to: T(to),
          bpm,
          root,
          minor: true,
          chords: [0, 5, 7, 0],
          melody: THEME,
          step: 0.5,
          voice: 'lead',
          gain: 0.65,
          groove: 'drive',
          fade: 0.12,
          ...extra,
        });
      const heartbeat = (from: number, to: number, gap = 0.8) => {
        for (let t = from; t < to - 0.1; t += gap) {
          s.note(T(t), 33, 0.3, 'kick', 0.09);
          s.note(T(t + 0.22), 33, 0.3, 'kick', 0.06);
        }
      };
      // Rain over everything, muffled once we are indoors, gone by dawn.
      s.fx('rain', 0, TAKEOFF, 0.045);
      s.fx('rain', T(TAKEOFF), LAND - TAKEOFF, 0.05);
      s.fx('rain', T(LAND), 104.8 - LAND, 0.045);
      s.fx('rain', T(104.8), DAWN_FROM - 104.8, 0.02);
      s.fx('rain', T(DAWN_FROM), 4.5, 0.012);
      // The city at night: a tram overhead, traffic far off.
      s.section({
        from: 0,
        to: T(RADIO_IN),
        bpm: 84,
        root: ROOT,
        minor: true,
        chords: [0, 5],
        level: 0.55,
        bass: false,
        fade: 1.5,
      });
      s.fx('hum', T(0.3), 5.5, 0.05, 0.3);
      s.fx('whir', T(1), 4, 0.03, 0.2);
      s.fx('engine', T(2), 3.5, 0.03, -0.5);
      // Dispatch: the radio, the box, the button.
      s.fx('click', T(RADIO_IN), 0.05, 0.1, -0.4);
      s.fx('crackle', T(RADIO_IN), 3.4, 0.045, -0.4);
      s.fx('crackle', T(11.2), 3.4, 0.04, -0.4);
      s.section({
        from: T(RADIO_IN),
        to: T(LAUNCH),
        bpm: 100,
        root: ROOT,
        minor: true,
        chords: [0, 0, 5, 7],
        melody: TIRED,
        step: 1,
        voice: 'keys',
        gain: 0.45,
        level: 0.55,
        groove: 'tick',
        fade: 0.8,
      });
      s.fx('rustle', T(11.3), 1.2, 0.07);
      s.fx('click', T(START), 0.05, 0.14);
      s.fx('beep', T(START), 0.15, 0.09);
      for (const t of ticks(START, 18.5)) s.fx('tick', T(t), 0.05, 0.08);
      // Go. The drive kicks in with her first pedal stroke, and ratchets up the whole way.
      drive(LAUNCH, 34.5, 132);
      s.fx('swish', T(LAUNCH), 0.5, 0.12);
      s.fx('splash', T(PUDDLE), 0.8, 0.2, 0.2);
      s.fx('engine', T(29), 5.5, 0.05, -0.3);
      s.fx('beep', T(30.1), 0.25, 0.05, 0.5);
      s.fx('beep', T(33.4), 0.18, 0.05, -0.6);
      s.fx('creak', T(DOOR), 0.35, 0.14, 0.4);
      s.fx('swish', T(DOOR + 0.3), 0.4, 0.16, -0.2);
      drive(34.5, SKID, 140);
      s.fx('engine', T(34.5), 2.2, 0.12, -0.2);
      s.fx('foghorn', T(HORN), 1, 0.2, -0.2);
      s.fx('rumble', T(35.8), 1, 0.18, -0.5);
      s.fx('swish', T(35.9), 0.6, 0.2, -0.6);
      s.fx('crunch', T(SCRAPE), 0.3, 0.2, 0.5);
      s.fx('clatter', T(SCRAPE), 0.35, 0.12, 0.5);
      s.fx('sparkle', T(SCRAPE + 0.02), 0.5, 0.08, 0.5);
      s.fx('gasp', T(39.2), 0.5, 0.14);
      for (const b of TRAM_BELL) s.fx('chime', T(b), 0.4, 0.14, 0.4);
      s.fx('hum', T(42), 4.5, 0.06, 0.3);
      s.fx('rumble', T(CROSS - 0.3), 1.4, 0.16);
      s.fx('swish', T(CROSS), 0.5, 0.14, -0.3);
      for (const t of ticks(47.5, 50)) s.fx('tick', T(t), 0.05, 0.09);
      // Road closed: a skid, a held breath, then the market.
      s.fx('squeak', T(SKID), 0.55, 0.1, 0.2);
      s.fx('splash', T(SKID + 0.05), 0.6, 0.14, 0.2);
      s.fx('swish', T(SKID), 0.5, 0.12);
      s.section({
        from: T(SKID),
        to: T(TURN),
        bpm: 140,
        root: ROOT,
        minor: true,
        chords: [1],
        level: 0.5,
        groove: 'tick',
        bass: false,
        fade: 0.2,
      });
      s.section({
        from: T(TURN),
        to: T(64.5),
        bpm: 146,
        root: ROOT,
        minor: true,
        chords: [0, 5, 0, 7],
        melody: THEME,
        step: 0.5,
        voice: 'pluck',
        gain: 0.6,
        groove: 'drive',
        fade: 0.15,
      });
      s.fx('crowd', T(54.5), 6.5, 0.08);
      s.fx('swish', T(DUCK - 0.1), 0.4, 0.14);
      s.fx('rustle', T(DUCK), 0.6, 0.12);
      s.fx('crunch', T(CRATE), 0.3, 0.2, 0.3);
      s.fx('clatter', T(CRATE + 0.05), 0.5, 0.12, 0.3);
      for (const b of ORANGE_BOUNCES) s.fx('bounce', T(b), 0.15, 0.06, 0.3);
      s.fx('swish', T(ROLL), 0.4, 0.16);
      s.fx('splash', T(ROLL + 0.05), 0.5, 0.14);
      // The drawbridge: bells, the lift, and a choice made in one heartbeat.
      s.section({
        from: T(64.5),
        to: T(70),
        bpm: 146,
        root: ROOT,
        minor: true,
        chords: [0, 0, 1, 1],
        melody: [12, null, null, null, 13, null, null, null],
        step: 1,
        voice: 'lead',
        gain: 0.4,
        level: 0.7,
        groove: 'pulse',
        fade: 0.3,
      });
      for (let t = GATE; t < TAKEOFF - 0.3; t += 0.9) s.fx('toll', T(t), 1.2, 0.06, -0.3);
      s.fx('creak', T(LIFT), 1.2, 0.14);
      s.fx('rumble', T(LIFT), 4, 0.1);
      s.fx('hum', T(LIFT), 14, 0.04, 0.2);
      heartbeat(70.2, 74);
      s.chord(T(70), [ROOT, ROOT + 3, ROOT + 7], 4, 'pad', 0.03);
      s.fx('tick', T(GLANCE), 0.05, 0.1);
      s.fx('sweep', T(RESOLVE), 1.3, 0.1);
      drive(74, 77.5, 152);
      drive(77.5, TAKEOFF, 160, ROOT + 2);
      s.fx('whir', T(STAND), 3, 0.06);
      s.fx('swish', T(STAND), 0.4, 0.12);
      s.fx('rumble', T(77.5), 2.8, 0.1);
      s.fx('creak', T(TAKEOFF - 0.1), 0.4, 0.1);
      s.fx('swish', T(TAKEOFF), 0.6, 0.16);
      // The jump: one held note, the wind and the rain.
      s.note(T(TAKEOFF + 0.05), ROOT + 19, LAND - TAKEOFF - 0.1, 'pad', 0.07);
      s.fx('wind', T(TAKEOFF), LAND - TAKEOFF, 0.08);
      // The landing slams everything back in, a step higher.
      s.fx('thud', T(LAND), 0.6, 0.36);
      s.fx('crunch', T(LAND), 0.3, 0.2);
      s.fx('splash', T(LAND + 0.02), 0.7, 0.2);
      s.fx('clatter', T(LAND + 0.05), 0.3, 0.1);
      s.fx('sparkle', T(LAND), 0.5, 0.07);
      drive(LAND, SNAP, 160, ROOT + 2, { gain: 0.7 });
      for (const t of ticks(89.6, 92.5)) s.fx('tick', T(t), 0.05, 0.09);
      s.fx('knock', T(PAT), 0.12, 0.1);
      // The chain goes: silence but for her heart.
      s.fx('clatter', T(SNAP), 0.7, 0.28);
      s.fx('click', T(SNAP), 0.08, 0.2);
      s.fx('swish', T(SNAP + 0.02), 0.3, 0.12);
      s.fx('whir', T(SNAP + 0.05), 1.4, 0.07);
      s.fx('gasp', T(SNAP + 0.5), 0.5, 0.14);
      s.chord(T(SNAP + 0.2), [ROOT + 2, ROOT + 5, ROOT + 9], 2.2, 'pad', 0.03);
      heartbeat(97, RUN, 0.66);
      s.fx('clatter', T(98.9), 0.4, 0.1, -0.3);
      s.fx('rustle', T(98.7), 0.4, 0.1);
      // On foot, up the hill, up the stairs.
      drive(RUN, 104.8, 168, ROOT + 2, { gain: 0.5 });
      for (const f of RUN_STEPS) {
        s.fx('step', T(f), 0.12, 0.14, 0.1);
        s.fx('splash', T(f), 0.25, 0.05, 0.1);
      }
      s.section({
        from: T(104.8),
        to: T(108),
        bpm: 168,
        root: ROOT + 2,
        minor: true,
        chords: [0],
        level: 0.5,
        groove: 'tick',
        fade: 0.1,
      });
      for (const f of LIFT_STEPS) s.fx('step', T(f), 0.12, 0.12);
      for (const b of BUTTON) s.fx('knock', T(b), 0.1, 0.12, 0.2);
      s.fx('thud', T(STAIRS_DOOR), 0.3, 0.14, 0.5);
      drive(108, 113, 176, ROOT + 2, { gain: 0.55 });
      for (const f of STAIR_STEPS) s.fx('step', T(f), 0.1, 0.13, f % 0.5 < 0.25 ? -0.2 : 0.2);
      s.section({
        from: T(113),
        to: T(BURST),
        bpm: 176,
        root: ROOT + 2,
        minor: true,
        chords: [7],
        groove: 'drive',
        level: 0.8,
        fade: 0.1,
      });
      for (const t of ticks(113, 115)) s.fx('beep', T(t), 0.1, 0.06);
      s.fx('gasp', T(113.6), 0.5, 0.1);
      // The doors, the hand-off, and the clock stopped at four seconds.
      s.fx('thud', T(BURST), 0.5, 0.32);
      s.fx('swish', T(BURST), 0.4, 0.14);
      for (const f of DOOR_STEPS) s.fx('step', T(f), 0.12, 0.1);
      s.chord(T(BURST), [ROOT - 10, ROOT + 2, ROOT + 5, ROOT + 9], 3, 'pad', 0.035);
      s.fx('rustle', T(HANDOFF), 0.4, 0.1);
      s.fx('click', T(STOP_CLOCK), 0.06, 0.16);
      s.fx('beep', T(STOP_CLOCK + 0.05), 0.6, 0.06);
      [12, 15, 17, 19].forEach((d, i) => s.note(T(120.3 + i * 0.6), ROOT + d, 1.4, 'keys', 0.06));
      s.chord(T(121.6), [ROOT, ROOT + 3, ROOT + 7], 1.6, 'pad', 0.03);
      // DONOR HEART: the harmony turns to the major.
      s.chord(T(123.05), [ROOT - 12, ROOT, ROOT + 4, ROOT + 7, ROOT + 12], 3, 'pad', 0.035);
      s.note(T(123.05), ROOT + 16, 2.2, 'bell', 0.06);
      s.fx('thud', T(SHUT), 0.4, 0.24);
      // Dawn on the bench.
      s.section({
        from: T(DAWN_FROM),
        to: T(133.5),
        bpm: 72,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: TENDER,
        step: 1,
        voice: 'keys',
        gain: 0.65,
        level: 0.55,
        fade: 1.2,
      });
      for (const t of [128.4, 129.9, 131.6, 132.8]) s.fx('drip', T(t), 0.2, 0.05, 0.3);
      // Upstairs, a small heart settles into its rhythm.
      for (const b of MONITOR) s.fx('beep', T(b), 0.12, 0.07, 0.2);
      s.section({
        from: T(133.5),
        to: T(138.5),
        bpm: 72,
        root: ROOT,
        chords: [0, 5, 0, 7],
        melody: [16, null, 19, null, 21, null, 19, null],
        step: 2,
        voice: 'bell',
        gain: 0.55,
        level: 0.5,
        fade: 1,
      });
      s.fx('sparkle', T(WAVE), 0.8, 0.03);
      // One more? No.
      s.fx('tweet', T(139.4), 0.8, 0.05, 0.5);
      s.fx('click', T(RADIO_OUT), 0.05, 0.1, -0.3);
      s.fx('crackle', T(RADIO_OUT), 2.9, 0.04, -0.3);
      s.section({
        from: T(138.5),
        to: T(OFF),
        bpm: 72,
        root: ROOT,
        chords: [5, 0],
        level: 0.35,
        bass: false,
        fade: 1,
      });
      s.fx('click', T(OFF), 0.06, 0.16, -0.3);
      s.section({
        from: T(OFF),
        to: 1,
        bpm: 80,
        root: ROOT,
        chords: [5, 7, 0],
        melody: FINALE,
        step: 0.5,
        voice: 'lead',
        gain: 0.5,
        level: 0.5,
        fade: 0.6,
      });
      s.fx('tweet', T(143.2), 0.8, 0.04, -0.4);
    },
  );

export const nightCourier: FilmModule = {
  draw(ctx, p, seconds) {
    const S = p * STORY;
    const shotNow = current(S);
    SCENES[shotNow.name](ctx, {
      t: S - shotNow.from,
      d: shotNow.to - shotNow.from,
      k: span(S, shotNow.from, shotNow.to),
      S,
      sec: seconds,
    });
    const dawn = ease(span(S, DAWN_FROM, 134));
    vignette(ctx, lerp(0.5, 0.28, dawn), mix('#05060F', '#2A1A10', dawn));
    letterbox(ctx, 0.4 * (1 - dawn));
    captions(ctx, p, CAPTIONS);
  },
  score: nightCourierScore,
  look: {
    shade: '#0C0E1C',
    ink: '#F2F6FF',
    accent: '#FF4F8E',
    dedication: 'for every rider still out in the rain',
  },
};
