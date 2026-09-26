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
  poly,
  presence,
  rand,
  snowfall,
  span,
  TAU,
  veil,
  vignette,
  W,
  write,
  type Ctx,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * WHITEOUT
 * Ines keeps the rescue hut under the north face. At dusk the radio tells her what the window
 * already has: the helicopter is grounded, a front is coming in, and a young climber is sitting
 * on a ledge under the ridge with a bad ankle. She clips in and goes up alone. The storm is the
 * villain: it takes the light, then the air, then the snow bridge under Theo's feet, then the
 * whole slope above them. She takes it all back one axe placement at a time. At dawn the
 * helicopter finally comes over the ridge, and she looks up at the mountain the way you look
 * at a dog that has been sick on the rug, and drinks her tea.
 *
 * Every hit is a shared constant in story seconds, read by both the pictures and the score.
 */

// ——— Time ———
const STORY = (CINEMA_FILMS.find((film) => film.artwork === 'whiteout')?.duration ?? 120) - 6;
/** Story seconds → story time p. */
const T = (seconds: number) => seconds / STORY;

// Shots, in story seconds.
const SHOTS = [
  ['hut', 0],
  ['radio', 5],
  ['face', 9.5],
  ['gear', 14],
  ['door', 16.5],
  ['mountain', 20.5],
  ['boots', 26.5],
  ['climb', 30],
  ['axe', 35],
  ['blind', 37.5],
  ['ledge', 43],
  ['theo', 47.5],
  ['ines', 50.5],
  ['rope', 54],
  ['bridge', 56.5],
  ['under', 61.5],
  ['drag', 63.5],
  ['strain', 66],
  ['groove', 68.5],
  ['dangle', 71],
  ['haul', 73],
  ['breath', 77.5],
  ['look', 80.5],
  ['wall', 82.5],
  ['dive', 86],
  ['buried', 88.6],
  ['descent', 93.5],
  ['call', 98],
  ['dawn', 103.5],
  ['bench', 108.5],
  ['peak', 111.5],
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
const RADIO_IN = 5.3;
const RADIO_2 = 8.4;
const REPLY = 11.9;
const CLIP = 15;
const LOCK = 15.35;
const TUG = 15.9;
const DOOR = 16.9;
const STEP_OUT = 17.6;
const LAMP_ON = 18.9;
const KICKS = [26.9, 27.6, 28.3, 29, 29.7] as const;
const PLANTS = [27.3, 29.35] as const;
const GUST = 32.4;
const BITES = [35.5, 36.7] as const;
const CALL = 38.4;
const FOUND = 42.1;
const LEDGE = 45;
const CLIP2 = 54.7;
const TUGS = [55.3, 55.9] as const;
const GROAN = 60.3;
const HAIRLINE = 61;
const CRACK = 62;
const BREAK = 62.5;
const TAUT = 63.7;
const ARREST = 65.3;
const HOLD = 70;
const HAULS = [73.5, 74.3, 75.1, 75.9] as const;
const GRAB = 76.3;
const OUT = 77;
const RUMBLE = 79;
const HIT = 87.2;
const WHITE_FULL = 88.3;
const WHITE_HOLD = 89.3;
const WHITE_CLEAR = 91;
const PUNCH = 90.6;
const SURFACE = 91.2;
const THEO_UP = 92.2;
const COUGH = 92.5;
const HUT_LIGHT = 96.2;
const RADIO_OUT = 98.2;
const ANSWER = 100.9;
const DARK_FROM = 102.8;
const DAWN_FROM = 103.5;
const HELI = 104.8;
const NOD = 109.4;
const NOD_BACK = 110.4;
const LOOK_UP = 111.9;
const SIP = 112.8;

/** Walking: one stride cycle (two footfalls) every 1/rate seconds. */
const footfalls = (from: number, to: number, rate: number) => {
  const list: number[] = [];
  for (let k = 0; ; k++) {
    const t = from + (0.25 + k / 2) / rate;
    if (t >= to) return list;
    list.push(t);
  }
};
const DOOR_RATE = 1.05;
const DOOR_STEPS = footfalls(STEP_OUT, 20.5, DOOR_RATE);
/** Seconds of actual climbing: she freezes against the slope while the gust goes through. */
const climbed = (S: number) => S - 30 - clamp(S - (GUST - 0.1), 0, 1.3);
const CLIMB_RATE = 0.45;
const CLIMB_STEPS = [0, 1, 2, 3, 4, 5]
  .map((k) => (0.25 + k / 2) / CLIMB_RATE)
  .map((u) => (u < GUST - 30.1 ? 30 + u : 31.3 + u))
  .filter((t) => t < 35);
const THEO_RATE = 0.85;
const THEO_STEPS = footfalls(56.5, 61.4, THEO_RATE);
const DESCENT_RATE = 0.62;
const DESCENT_STEPS = footfalls(93.5, 98, DESCENT_RATE);

// ——— Palette ———
const INK = '#07090F';
const NIGHT = '#0A111E';
const SNOW = '#EEF3F8';
const ICE = '#9ACBE6';
const ICE_D = '#3A78A6';
const DEEP = '#081628';
const ROCK = '#2C333F';
const ROCK_L = '#46505F';
const ROCK_D = '#1A1F28';
const AMBER = '#FFB24A';
const AMBER_L = '#FFE0A6';
const LAMP = '#FFF7E4';
const RED = '#C73A3E';
const RED_D = '#862530';
const FLEECE = '#4B5668';
const PANTS = '#2C3442';
const PANTS_D = '#1E242F';
const BOOT = '#191C24';
const GLOVE = '#262B35';
const ORANGE = '#EE9B2E';
const ORANGE_D = '#A9631A';
const BEANIE = '#2F7294';
const BEANIE_D = '#1F5170';
const ROPE = '#BCD94A';
const METAL = '#CBD3DD';
const SKIN_I = '#BC8466';
const SKIN_I_D = '#8C5A45';
const HAIR_I = '#4C4644';
const GREY = '#B9B4AE';
const SKIN_T = '#E9C0A0';
const SKIN_T_D = '#C49274';
const HAIR_T = '#7B4F2E';
const OLIVE = '#4A5236';
const BLANKET = '#5E6E88';
const MIST = '#EEF3F8';

type Grade = {
  sky: readonly string[];
  lit: string;
  shade: string;
  rock: string;
  gully: string;
  far: string;
  ground: string;
  groundD: string;
  glow: string;
  glowAmt: number;
};
const DUSK: Grade = {
  sky: ['#18223C', '#2E3B62', '#5E6589', '#A08DA3'],
  lit: '#BCC4D6',
  shade: '#55607C',
  rock: '#626C88',
  gully: '#7985A0',
  far: '#6B7390',
  ground: '#A9B5CA',
  groundD: '#7E8AA4',
  glow: '#F4A9B8',
  glowAmt: 0.4,
};
const STORM: Grade = {
  sky: ['#0B111C', '#161F2D', '#243043', '#354259'],
  lit: '#6A7993',
  shade: '#303B50',
  rock: '#36425A',
  gully: '#46536B',
  far: '#2A3448',
  ground: '#5A6882',
  groundD: '#3C485F',
  glow: '#9FB0C8',
  glowAmt: 0,
};
const CLEAR: Grade = {
  sky: ['#050913', '#0B1428', '#16233E', '#243452'],
  lit: '#586B8C',
  shade: '#26324A',
  rock: '#303C56',
  gully: '#3C4B66',
  far: '#1E2A40',
  ground: '#4A5A78',
  groundD: '#34425C',
  glow: '#9FB0C8',
  glowAmt: 0,
};
const DAWN: Grade = {
  sky: ['#6A83B8', '#B0A0C6', '#F0B6A8', '#FFD9A2'],
  lit: '#A898BC',
  shade: '#F2C0A0',
  rock: '#907EA2',
  gully: '#FFDCC0',
  far: '#C4ADCB',
  ground: '#F6ECEA',
  groundD: '#CDBBD2',
  glow: '#FFD2A0',
  glowAmt: 0.55,
};
function blend(a: Grade, b: Grade, t: number): Grade {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    sky: a.sky.map((c, i) => mix(c, b.sky[i], t)),
    lit: mix(a.lit, b.lit, t),
    shade: mix(a.shade, b.shade, t),
    rock: mix(a.rock, b.rock, t),
    gully: mix(a.gully, b.gully, t),
    far: mix(a.far, b.far, t),
    ground: mix(a.ground, b.ground, t),
    groundD: mix(a.groundD, b.groundD, t),
    glow: mix(a.glow, b.glow, t),
    glowAmt: lerp(a.glowAmt, b.glowAmt, t),
  };
}

// ——— Little helpers ———
type P = readonly [number, number];
type Tone = (c: string) => string;
const toner = (dark: number, night = NIGHT): Tone =>
  dark > 0 ? (c: string) => mix(c, night, dark) : (c: string) => c;
const lp = (a: P, b: P, t: number): P => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
function ik(hx: number, hy: number, fx: number, fy: number, a: number, b: number, bend = 1) {
  const d = clamp(Math.hypot(fx - hx, fy - hy), 0.5, a + b - 0.05);
  const base = Math.atan2(fy - hy, fx - hx);
  const off = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  return [hx + Math.cos(base - off * bend) * a, hy + Math.sin(base - off * bend) * a] as const;
}
function zoomed(ctx: Ctx, cx: number, cy: number, z: number, paint: () => void) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(z, z);
  ctx.translate(-cx, -cy);
  paint();
  ctx.restore();
}
function gradient(
  ctx: Ctx,
  top: number,
  bottom: number,
  stops: readonly string[],
  left = -80,
  width = W + 160,
) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(left, top, width, bottom - top);
}
/** A camera jolt after an impact: a quick, damped shake. */
const jolt = (S: number, at: number, amount: number, rate = 7) =>
  S < at ? 0 : amount * Math.exp(-(S - at) * rate) * Math.sin((S - at) * 46);
/** A steady tremor, for the scrape of the axe and the rumble of the slope. */
const tremor = (sec: number, amount: number): P => [
  Math.sin(sec * 53) * amount,
  Math.sin(sec * 41 + 1) * amount * 0.7,
];
/** A point part-way along a polyline. */
function along(pts: readonly number[], u: number): P {
  let total = 0;
  for (let i = 2; i < pts.length; i += 2)
    total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  let left = clamp(u) * total;
  for (let i = 2; i < pts.length; i += 2) {
    const l = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    if (left <= l || i === pts.length - 2) {
      const k = l ? Math.min(1, left / l) : 0;
      return [lerp(pts[i - 2], pts[i], k), lerp(pts[i - 1], pts[i + 1], k)];
    }
    left -= l;
  }
  return [pts[0], pts[1]];
}

type Gale = {
  amount?: number;
  speed?: number;
  fall?: number;
  length?: number;
  color?: string;
  seed?: number;
  top?: number;
  bottom?: number;
};
/** Wind-driven snow: streaks that race right to left, thick or thin. */
function gale(ctx: Ctx, sec: number, o: Gale = {}) {
  const n = Math.round(60 * (o.amount ?? 1));
  if (n <= 0) return;
  const speed = o.speed ?? 180,
    fall = o.fall ?? 0.2,
    len = o.length ?? 6;
  const top = o.top ?? -10,
    h = (o.bottom ?? H + 10) - top,
    run = W + 80;
  ctx.fillStyle = o.color ?? alpha(SNOW, 0.75);
  for (let i = 0; i < n; i++) {
    const seed = (o.seed ?? 5) + i;
    const v = 0.55 + rand(seed * 1.3) * 0.9;
    const d = (rand(seed * 2.1) * run + sec * speed * v) % run;
    const x = W + 40 - d;
    const y = top + ((rand(seed * 3.7) * h + d * fall * v) % h);
    ctx.fillRect(
      Math.round(x),
      Math.round(y),
      Math.max(1, Math.round(len * v)),
      i % 6 === 0 ? 2 : 1,
    );
  }
}
function cone(ctx: Ctx, x: number, y: number, a: number, len: number, spread: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a - spread) * len, y + Math.sin(a - spread) * len);
  ctx.lineTo(x + Math.cos(a + spread) * len, y + Math.sin(a + spread) * len);
  ctx.closePath();
}
/** A headlamp beam: a soft cone that fades with distance. */
function beam(
  ctx: Ctx,
  x: number,
  y: number,
  a: number,
  len: number,
  spread: number,
  amount: number,
  color = LAMP,
) {
  if (amount <= 0) return;
  const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
  g.addColorStop(0, alpha(color, 0.5 * amount));
  g.addColorStop(0.35, alpha(color, 0.2 * amount));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  cone(ctx, x, y, a, len, spread);
  ctx.fill();
  glow(ctx, x, y, 7, color, 0.9 * amount);
}
/** Snow caught in a beam: the same gale, brighter, clipped to the cone. */
function litSnow(
  ctx: Ctx,
  sec: number,
  x: number,
  y: number,
  a: number,
  len: number,
  spread: number,
  o: Gale,
) {
  ctx.save();
  cone(ctx, x, y, a, len, spread);
  ctx.clip();
  gale(ctx, sec, o);
  ctx.restore();
}
function breath(ctx: Ctx, x: number, y: number, sec: number, dir = 1, amount = 1, phase = 0) {
  const t = ((sec + phase) * 0.45) % 1;
  if (t > 0.75) return;
  const k = t / 0.75;
  oval(
    ctx,
    x + dir * k * 9,
    y - k * 6,
    2 + k * 5,
    1.5 + k * 3.5,
    alpha('#E8F0F8', 0.4 * (1 - k) * amount),
  );
}
function cloudBank(
  ctx: Ctx,
  sec: number,
  cx: number,
  cy: number,
  w: number,
  color: string,
  amount: number,
  seed = 1,
  n = 12,
) {
  const under = mix(color, INK, 0.3),
    top = mix(color, '#FFFFFF', 0.08);
  for (let i = 0; i < n; i++) {
    const r = rand(seed + i * 3.3);
    const x = cx + (rand(seed + i * 1.7) - 0.5) * w + Math.sin(sec * 0.25 + i) * 3;
    const y = cy + (rand(seed + i * 2.9) - 0.5) * w * 0.22;
    const rx = 24 + r * 34,
      ry = 7 + r * 9;
    oval(ctx, x, y + ry * 0.35, rx, ry * 0.8, alpha(under, amount));
    oval(ctx, x - rx * 0.1, y - ry * 0.1, rx * 0.85, ry * 0.9, alpha(color, amount));
    oval(ctx, x - rx * 0.25, y - ry * 0.55, rx * 0.4, ry * 0.6, alpha(top, amount * 0.8));
  }
}
function stars(ctx: Ctx, sec: number, amount: number, bottom = 80, seed = 3) {
  for (let i = 0; i < 30; i++) {
    const tw = 0.6 + 0.4 * Math.sin(sec * (0.5 + rand(seed + i) * 0.8) + i);
    box(
      ctx,
      rand(seed + i * 3.1) * W,
      rand(seed + i * 5.3) * bottom,
      1,
      1,
      alpha('#E8EEFF', amount * tw * (0.4 + rand(i * 7.7) * 0.6)),
    );
  }
}

// ——— The mountain ———
const MASSIF = [
  -80, 200, -80, 126, -30, 120, 8, 110, 40, 100, 70, 90, 96, 76, 118, 66, 140, 52, 160, 38, 178, 24,
  196, 10, 206, 17, 218, 28, 234, 38, 252, 50, 270, 60, 290, 74, 316, 84, 346, 92, 400, 100, 400,
  200,
];
const LIT_FACE = [
  196, 10, 178, 24, 160, 38, 140, 52, 118, 66, 96, 76, 70, 90, 40, 100, 8, 110, -30, 120, -80, 126,
  -80, 200, 172, 200, 180, 160, 174, 126, 184, 92, 182, 62, 190, 34,
];
/** Rock bands breaking through the snow: [x0, y0, x1, y1, thickness]. */
const BANDS = [
  [22, 132, 116, 100, 6],
  [96, 90, 152, 64, 5],
  [132, 118, 172, 100, 4],
  [148, 50, 184, 28, 3.5],
  [-40, 152, 40, 136, 5],
  [58, 152, 112, 130, 3.5],
  [196, 64, 232, 92, 4],
  [240, 72, 284, 104, 4],
  [212, 108, 260, 134, 3.5],
] as const;
/** Snow ribs running down the fall line of both faces. */
const RIBS = [
  [150, 52, 146, 84, 138, 120],
  [118, 68, 108, 96, 96, 132],
  [84, 86, 74, 110, 60, 140],
  [206, 22, 212, 56, 206, 96],
  [236, 44, 248, 78, 262, 114],
  [270, 66, 288, 96, 300, 126],
] as const;
const SPUR = [196, 10, 190, 34, 182, 62, 184, 92, 174, 126, 180, 160, 172, 200];
const FAR = [
  -80, 200, -80, 104, -44, 92, -10, 100, 24, 84, 54, 96, 80, 90, 250, 86, 272, 70, 296, 80, 318, 64,
  344, 78, 400, 84, 400, 200,
];
function farRange(ctx: Ctx, g: Grade) {
  poly(ctx, g.far, FAR);
  const cap = mix(g.far, g.lit, 0.45);
  poly(ctx, cap, [16, 90, 24, 84, 32, 90, 26, 92]);
  poly(ctx, cap, [310, 70, 318, 64, 326, 70, 318, 72]);
  poly(ctx, cap, [264, 76, 272, 70, 280, 76, 272, 78]);
}
function massif(ctx: Ctx, g: Grade) {
  const sg = ctx.createLinearGradient(0, 10, 0, 180);
  sg.addColorStop(0, mix(g.shade, g.gully, 0.25));
  sg.addColorStop(1, mix(g.shade, INK, 0.15));
  ctx.fillStyle = sg;
  ctx.beginPath();
  for (let i = 0; i < MASSIF.length; i += 2)
    if (i) ctx.lineTo(MASSIF[i], MASSIF[i + 1]);
    else ctx.moveTo(MASSIF[i], MASSIF[i + 1]);
  ctx.closePath();
  ctx.fill();
  const lg = ctx.createLinearGradient(0, 10, 0, 180);
  lg.addColorStop(0, mix(g.lit, '#FFFFFF', 0.15));
  lg.addColorStop(1, mix(g.lit, g.shade, 0.3));
  ctx.fillStyle = lg;
  ctx.beginPath();
  for (let i = 0; i < LIT_FACE.length; i += 2)
    if (i) ctx.lineTo(LIT_FACE[i], LIT_FACE[i + 1]);
    else ctx.moveTo(LIT_FACE[i], LIT_FACE[i + 1]);
  ctx.closePath();
  ctx.fill();
  for (let r = 0; r < RIBS.length; r++)
    line(
      ctx,
      alpha(r < 3 ? mix(g.lit, '#FFFFFF', 0.5) : g.gully, r < 3 ? 0.45 : 0.7),
      1.4,
      RIBS[r],
    );
  BANDS.forEach(([x0, y0, x1, y1, th], b) => {
    const top: number[] = [],
      under: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8,
        x = lerp(x0, x1, u),
        y = lerp(y0, y1, u),
        w = Math.sin(u * Math.PI);
      top.push(x, y - w * th * (0.55 + rand(b * 13 + i) * 0.7));
      under.unshift(x, y + w * th * 0.3);
    }
    poly(ctx, g.rock, [...top, ...under]);
    line(ctx, alpha(mix(g.lit, '#FFFFFF', 0.4), 0.55), 0.8, top);
  });
  line(ctx, alpha(mix(g.lit, '#FFFFFF', 0.5), 0.7), 1, MASSIF.slice(4, 26));
  line(ctx, alpha(mix(g.lit, '#FFFFFF', 0.3), 0.5), 1, SPUR);
  if (g.glowAmt > 0) glow(ctx, 194, 20, 46, g.glow, g.glowAmt);
}
function foreground(ctx: Ctx, g: Grade) {
  poly(
    ctx,
    g.groundD,
    [-80, 200, -80, 144, -10, 140, 60, 147, 130, 144, 200, 138, 280, 143, 400, 133, 400, 200],
  );
  poly(
    ctx,
    g.ground,
    [-80, 200, -80, 154, 30, 151, 110, 157, 190, 153, 270, 149, 400, 145, 400, 200],
  );
  for (let i = 0; i < 6; i++) {
    const x = -10 + i * 58 + rand(i * 4.3) * 30,
      y = 156 + rand(i * 2.7) * 14;
    poly(ctx, g.rock, [x - 6, y + 2, x - 2, y - 3, x + 3, y - 4, x + 8, y + 2]);
    box(ctx, x - 3, y - 4, 5, 1, g.ground);
  }
}

type HutLook = {
  sec: number;
  light?: number;
  door?: number;
  wind?: number;
  warm?: number;
  smoke?: number;
};
/** The rescue hut: stone walls, a roof loaded with snow, one warm window. Ground at y = 0. */
function hut(ctx: Ctx, x: number, y: number, s: number, o: HutLook) {
  const warm = o.warm ?? 0,
    light = o.light ?? 1,
    door = o.door ?? 0;
  const stone = mix('#5C6474', '#B39A94', warm),
    stoneD = mix('#3E4554', '#8A7280', warm);
  const wood = mix('#3A3038', '#5A3E3A', warm),
    woodD = mix('#2A2228', '#46302E', warm);
  const snow = mix('#C9D3E2', '#FFF1EA', warm),
    snowD = mix('#95A3BA', '#E2C8CC', warm);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  poly(ctx, stoneD, [26, -26, 38, -31, 38, -5, 26, 0]);
  box(ctx, -26, -26, 52, 26, stone);
  for (let i = 0; i < 10; i++)
    box(
      ctx,
      -25 + ((i * 13) % 46),
      -24 + Math.floor(i / 3.4) * 7,
      7 + (i % 3) * 2,
      4,
      alpha(stoneD, 0.55),
    );
  poly(ctx, woodD, [31, -25, 0, -47, 12, -51, 43, -30]);
  poly(ctx, wood, [-31, -25, 0, -47, 31, -25]);
  poly(ctx, snowD, [31, -26, 0, -49, 12, -53, 45, -31]);
  poly(ctx, snow, [-34, -23, 0, -50, 34, -23, 28, -22, 0, -44, -28, -22]);
  for (let i = 0; i < 8; i++)
    poly(ctx, alpha(snow, 0.9), [-27 + i * 7, -22, -25 + i * 7, -22, -26 + i * 7, -18 + (i % 3)]);
  box(ctx, 10, -52, 7, 12, stoneD);
  box(ctx, 9, -54, 9, 3, snow);
  box(ctx, -20, -19, 12, 10, woodD);
  box(ctx, -19, -18, 10, 8, mix('#2A3446', AMBER, light));
  box(ctx, -14.5, -18, 1, 8, woodD);
  box(ctx, -19, -14.5, 10, 1, woodD);
  box(ctx, -21, -9, 14, 2, snow);
  box(ctx, 3, -22, 13, 22, woodD);
  if (door > 0) {
    box(ctx, 4, -21, 11, 21, mix(AMBER, AMBER_L, 0.5));
    poly(ctx, wood, [4, -21, 4 - 7 * door, -23, 4 - 7 * door, 1, 4, 0]);
  } else {
    box(ctx, 4, -21, 11, 21, wood);
    for (let i = 1; i < 4; i++) box(ctx, 4 + i * 2.75, -21, 0.6, 21, woodD);
    box(ctx, 13, -11, 1.2, 1.2, '#C9A060');
  }
  oval(ctx, -6, 0, 40, 3.2, snow);
  oval(ctx, 34, -3, 8, 3, snowD);
  if (light > 0) glow(ctx, -14, -14, 26, AMBER, 0.45 * light);
  if (door > 0) {
    glow(ctx, 9.5, -8, 34, AMBER, 0.5 * door);
    poly(ctx, alpha(AMBER, 0.3 * door), [4, 0, 15, 0, 36, 16, -12, 16]);
  }
  const wind = o.wind ?? 0.5,
    smoke = o.smoke ?? 1;
  for (let i = 0; i < 6; i++) {
    const t = (o.sec * 0.22 + i / 6) % 1;
    oval(
      ctx,
      13.5 - t * 34 * wind + Math.sin(t * 6 + i) * 2,
      -56 - t * 30 * (1.2 - wind * 0.6),
      2.5 + t * 6,
      2 + t * 4,
      alpha(mix('#8A94A8', '#FFFFFF', warm), 0.4 * (1 - t) * smoke),
    );
  }
  ctx.restore();
}

// ——— Ines and Theo, full figure ———
type Kit = {
  jacket: string;
  jacketD: string;
  pants: string;
  pantsD: string;
  boot: string;
  head: string;
  skin: string;
  glove: string;
  pack: string | null;
  beanie: boolean;
};
const INES: Kit = {
  jacket: RED,
  jacketD: RED_D,
  pants: PANTS,
  pantsD: PANTS_D,
  boot: BOOT,
  head: RED,
  skin: SKIN_I,
  glove: GLOVE,
  pack: '#39414F',
  beanie: false,
};
const THEO: Kit = {
  jacket: ORANGE,
  jacketD: ORANGE_D,
  pants: '#3B4352',
  pantsD: '#2A303C',
  boot: '#3A2E26',
  head: BEANIE,
  skin: SKIN_T,
  glove: OLIVE,
  pack: null,
  beanie: true,
};
/** Joint positions in the figure's own frame: facing right, ground at y = 0. */
type Pose = {
  hip: P;
  sh: P;
  head?: P;
  feet: readonly [P, P];
  hands: readonly [P, P];
  knees?: readonly [number, number];
  elbows?: readonly [number, number];
  /** Angle of an ice axe held in the near hand. */
  axe?: number;
  lamp?: number;
  tilt?: number;
};
const headOf = (p: Pose): P => p.head ?? [p.sh[0] + 2, p.sh[1] - 6.5];
function mixPose(a: Pose, b: Pose, t: number): Pose {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    hip: lp(a.hip, b.hip, t),
    sh: lp(a.sh, b.sh, t),
    head: lp(headOf(a), headOf(b), t),
    feet: [lp(a.feet[0], b.feet[0], t), lp(a.feet[1], b.feet[1], t)],
    hands: [lp(a.hands[0], b.hands[0], t), lp(a.hands[1], b.hands[1], t)],
    knees: t < 0.5 ? a.knees : b.knees,
    elbows: t < 0.5 ? a.elbows : b.elbows,
    axe:
      a.axe !== undefined && b.axe !== undefined ? lerp(a.axe, b.axe, t) : t < 0.5 ? a.axe : b.axe,
    lamp: lerp(a.lamp ?? 0, b.lamp ?? 0, t),
    tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t),
  };
}
function walk(ph: number, stride = 1, lean = 0.1): Pose {
  const sw = Math.sin(ph) * 6.5 * stride;
  const bob = Math.abs(Math.cos(ph)) * 1.2 * stride;
  const hip: P = [0, -21 - bob + 0.8];
  const sh: P = [hip[0] + Math.sin(lean) * 14, hip[1] - Math.cos(lean) * 14];
  return {
    hip,
    sh,
    feet: [
      [-sw, -Math.max(0, -Math.cos(ph)) * 3 * stride],
      [sw, -Math.max(0, Math.cos(ph)) * 3 * stride],
    ],
    hands: [
      [sh[0] + sw * 0.55, sh[1] + 13.5],
      [sh[0] - sw * 0.55, sh[1] + 13.5],
    ],
  };
}
/** Climbing a slope that rises m units per unit to the right. */
function climbPose(m: number, ph: number, hunch = 0): Pose {
  const a = Math.sin(ph) * 2.5;
  const f0 = -6 + a,
    f1 = 4 - a;
  const hip: P = [-1.5 + hunch * 3, -19.5 + hunch * 5];
  const sh: P = [3.5 + hunch * 5, -33 + hunch * 8];
  return {
    hip,
    sh,
    head: [sh[0] + 3.5 + hunch, sh[1] - 6 + hunch * 2],
    feet: [
      [f0, -m * f0],
      [f1, -m * f1 - Math.max(0, Math.cos(ph)) * 2],
    ],
    hands: [
      [19 - hunch * 3, -m * (19 - hunch * 3) - 1],
      [14 - hunch * 2, -27 + hunch * 7],
    ],
    elbows: [-1, 1],
    axe: 0.08,
    lamp: 1,
    tilt: -0.3 + hunch * 0.45,
  };
}
/** Face down, head to the right: the self-arrest. */
const PRONE: Pose = {
  hip: [0, -3.5],
  sh: [14, -4.2],
  head: [20.5, -6.5],
  feet: [
    [-20, -1.5],
    [-19, -2.5],
  ],
  hands: [
    [26, -1.5],
    [25, -2.8],
  ],
  knees: [-1, -1],
  elbows: [1, 1],
  lamp: 1,
  tilt: 0.1,
};
/** Face up, head to the left. `lift` raises the head. */
function supine(lift = 0): Pose {
  return {
    hip: [0, -3],
    sh: [-14, -3.5 - lift * 3],
    head: [-20 + lift * 2, -5.5 - lift * 6],
    feet: [
      [20, -2],
      [19, -4],
    ],
    hands: [
      [-6, -6 - lift * 2],
      [-3, -7],
    ],
    knees: [1, 1],
    elbows: [1, 1],
    lamp: 1,
    tilt: -1.45 + lift * 0.9,
  };
}
function kneel(lean = 0.2, hands?: readonly [P, P]): Pose {
  const hip: P = [0, -12];
  const sh: P = [Math.sin(lean) * 14, -12 - Math.cos(lean) * 14];
  return {
    hip,
    sh,
    feet: [
      [-11, 0],
      [8, 0],
    ],
    hands: hands ?? [
      [sh[0] + 7, sh[1] + 10],
      [sh[0] + 9, sh[1] + 9],
    ],
    lamp: 1,
    tilt: 0.25,
  };
}
/** Sitting on the ground, knees up, arms round them. */
function huddle(lift = 0): Pose {
  return {
    hip: [0, -3],
    sh: [1.5 + lift, -16.5],
    head: [4.5 + lift * 1.5, -22 - lift],
    feet: [
      [9, 0],
      [10.5, 0],
    ],
    hands: [
      [8, -8],
      [9, -7],
    ],
    tilt: 0.45 - lift * 0.7,
  };
}
function headSide(
  ctx: Ctx,
  hx: number,
  hy: number,
  kit: Kit,
  tone: Tone,
  lamp: number,
  tilt: number,
) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);
  if (kit.beanie) {
    oval(ctx, -2, 0.6, 3.6, 4.6, tone(HAIR_T));
    oval(ctx, 1, 0.8, 4.4, 4.9, tone(kit.skin));
    oval(ctx, -0.4, -2.4, 5.3, 3.6, tone(kit.head));
    box(ctx, -5.4, -1.8, 10, 1.8, tone(BEANIE_D));
    box(ctx, 2.8, -0.2, 1, 1.4, tone(INK));
    box(ctx, 5, 1.2, 1, 1, tone(kit.skin));
  } else {
    disc(ctx, 0, 0, 5.8, tone(kit.head));
    oval(ctx, 2.7, 1.1, 3.1, 3.9, tone(kit.skin));
    box(ctx, 3.8, -0.2, 1, 1.4, tone(INK));
    box(ctx, 5.6, 1.2, 1, 1, tone(SKIN_I_D));
    line(ctx, tone(RED_D), 1, [-1.5, -5.4, 3.5, -4.6, 5.8, -2]);
    line(ctx, tone('#1B1E26'), 1.3, [-5.4, -2.4, 5.2, -4]);
    box(ctx, 4.4, -6, 2.6, 2.8, tone('#D5DBE4'));
    box(ctx, 6.4, -5.5, 1, 1.8, lamp > 0 ? LAMP : tone('#6A7280'));
  }
  ctx.restore();
}
const LENS: P = [7, -4.6];
/** Where the headlamp lens is on screen. */
function lensAt(x: number, y: number, s: number, pose: Pose, facing: 1 | -1 = 1): P {
  const [hx, hy] = headOf(pose);
  const t = pose.tilt ?? 0;
  const lx = hx + LENS[0] * Math.cos(t) - LENS[1] * Math.sin(t);
  const ly = hy + LENS[0] * Math.sin(t) + LENS[1] * Math.cos(t);
  return [x + lx * s * facing, y + ly * s];
}
/** A direction in the figure's frame (0 = the way it faces), on screen. */
const aim = (a: number, facing: 1 | -1) => (facing > 0 ? a : Math.PI - a);
function axeSide(ctx: Ctx, x: number, y: number, a: number, len: number, tone: Tone, w = 1.3) {
  const cx = Math.cos(a),
    cy = Math.sin(a),
    px = -cy,
    py = cx;
  const ex = x + cx * len,
    ey = y + cy * len;
  line(ctx, tone('#34465E'), w, [x - cx * 2, y - cy * 2, ex, ey]);
  line(ctx, tone(METAL), w * 1.1, [
    ex - px * 2.6,
    ey - py * 2.6,
    ex + px * 3,
    ey + py * 3,
    ex + px * 4.8 - cx * 1.6,
    ey + py * 4.8 - cy * 1.6,
  ]);
  line(ctx, tone(METAL), w * 1.8, [ex - px * 2.4, ey - py * 2.4, ex - px * 3.4, ey - py * 3.4]);
}
type Look = { facing?: 1 | -1; dark?: number; night?: string; rim?: string; rimAmt?: number };
function figure(ctx: Ctx, x: number, y: number, s: number, kit: Kit, pose: Pose, o: Look = {}) {
  const tone = toner(o.dark ?? 0, o.night ?? NIGHT);
  const { hip, sh } = pose;
  const head = headOf(pose);
  const kn = pose.knees ?? [1, 1],
    el = pose.elbows ?? [-1, -1];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (o.facing ?? 1), s);
  const leg = (i: 0 | 1, color: string) => {
    const f = pose.feet[i];
    const k = ik(hip[0], hip[1], f[0], f[1], 10.5, 10.5, kn[i]);
    line(ctx, color, 3.8, [hip[0], hip[1], k[0], k[1], f[0], f[1]]);
    box(ctx, f[0] - 2, f[1] - 1.5, 5.5, 2.7, tone(kit.boot));
  };
  const arm = (i: 0 | 1, color: string) => {
    const h = pose.hands[i];
    const e = ik(sh[0], sh[1], h[0], h[1], 7.8, 7.8, el[i]);
    line(ctx, color, 3, [sh[0], sh[1], e[0], e[1], h[0], h[1]]);
    disc(ctx, h[0], h[1], 1.7, tone(kit.glove));
  };
  leg(0, tone(kit.pantsD));
  arm(0, tone(kit.jacketD));
  const dx = sh[0] - hip[0],
    dy = sh[1] - hip[1],
    len = Math.hypot(dx, dy) || 1;
  const nx = dy / len,
    ny = -dx / len;
  if (kit.pack)
    oval(
      ctx,
      (hip[0] + sh[0]) / 2 + nx * 3.8,
      (hip[1] + sh[1]) / 2 + ny * 3.8,
      3.4,
      5.8,
      tone(kit.pack),
      Math.atan2(dx, -dy),
    );
  line(ctx, tone(kit.jacket), 7.5, [hip[0], hip[1], sh[0], sh[1]]);
  line(ctx, tone('#262C38'), 2, [
    hip[0] + nx * 3.7 + dx * 0.08,
    hip[1] + ny * 3.7 + dy * 0.08,
    hip[0] - nx * 3.7 + dx * 0.08,
    hip[1] - ny * 3.7 + dy * 0.08,
  ]);
  leg(1, tone(kit.pants));
  headSide(ctx, head[0], head[1], kit, tone, pose.lamp ?? 0, pose.tilt ?? 0);
  arm(1, tone(mix(kit.jacket, kit.jacketD, 0.35)));
  if (pose.axe !== undefined) axeSide(ctx, pose.hands[1][0], pose.hands[1][1], pose.axe, 11, tone);
  if (o.rim && (o.rimAmt ?? 1) > 0)
    line(ctx, alpha(o.rim, 0.85 * (o.rimAmt ?? 1)), 1, [
      hip[0] + nx * 3.7,
      hip[1] + ny * 3.7,
      sh[0] + nx * 3.7,
      sh[1] + ny * 3.7,
    ]);
  ctx.restore();
}

// ——— Faces for the close-ups ———
type Lips = 'flat' | 'set' | 'grit' | 'open' | 'part' | 'breath' | 'smile' | 'small' | 'o';
type Face = {
  lid?: number;
  look?: P;
  /** Raises both brows. */
  brow?: number;
  /** Raises the inner ends (fear, pleading); negative knits them (resolve). */
  worry?: number;
  /** Raises one brow. */
  quirk?: number;
  mouth?: Lips;
  turn?: number;
  tilt?: number;
  hood?: number;
  lamp?: number;
  /** The headlamp tipped down, out of someone's eyes. */
  dip?: number;
  frost?: number;
  shade?: number;
  night?: string;
  rimL?: string;
  rimR?: string;
  key?: string;
  keyAmt?: number;
  keySide?: number;
  shiver?: number;
  wide?: number;
  collar?: string;
  nod?: number;
};
type EyeLook = { lid: number; look: P; iris: string; wide: number };
function eyeAt(ctx: Ctx, ex: number, ey: number, w: number, o: EyeLook, tone: Tone, skin: string) {
  const open = o.wide * 0.7;
  oval(ctx, ex, ey, 4.6 * w, 2.7 + open, tone('#E6E0D8'));
  const ix = ex + o.look[0] * 2 * w,
    iy = ey + o.look[1] * 0.9;
  disc(ctx, ix, iy, 2.4, tone(o.iris));
  disc(ctx, ix, iy, 1.15, '#050407');
  box(ctx, ix - 1.5, iy - 1.4, 1, 1, alpha('#FFFFFF', 0.85));
  box(ctx, ix + 0.6, iy - 0.8, 0.8, 0.8, alpha('#DCEBFF', 0.7));
  const lid = clamp(o.lid);
  box(ctx, ex - 5 * w, ey - 3.4 - open, 10 * w, 0.7 + lid * (6.3 + open), skin);
  const ly = ey - 2.6 - open + lid * (5.2 + open);
  line(ctx, tone(INK), 1.1, [ex - 4.9 * w, ly + 0.3, ex, ly - 0.4, ex + 4.9 * w, ly + 0.4]);
}
function mouthAt(ctx: Ctx, mx: number, my: number, m: Lips, tone: Tone) {
  const lip = tone('#6A3432'),
    dark = tone('#3A1418'),
    teeth = tone('#EFE9DF');
  if (m === 'flat') line(ctx, lip, 1.4, [mx - 5, my, mx + 5, my]);
  else if (m === 'set') {
    line(ctx, lip, 1.7, [mx - 5.5, my + 0.3, mx + 5.5, my + 0.3]);
    line(ctx, alpha(lip, 0.6), 0.8, [mx - 7, my + 1.3, mx - 5.5, my + 0.3]);
  } else if (m === 'grit') {
    box(ctx, mx - 5.5, my - 1.8, 11, 3.6, teeth);
    line(ctx, lip, 1, [mx - 6, my - 1.9, mx + 6, my - 1.9]);
    line(ctx, lip, 1, [mx - 6, my + 1.9, mx + 6, my + 1.9]);
    line(ctx, alpha(lip, 0.6), 0.6, [mx - 5, my, mx + 5, my]);
  } else if (m === 'open') oval(ctx, mx, my + 0.6, 3.8, 3.4, dark);
  else if (m === 'part') oval(ctx, mx, my + 0.2, 3.4, 1.4, dark);
  else if (m === 'breath') oval(ctx, mx, my + 0.2, 2.2, 1.5, dark);
  else if (m === 'o') oval(ctx, mx, my + 0.4, 2.2, 2.6, dark);
  else if (m === 'smile')
    line(ctx, lip, 1.4, [
      mx - 6.5,
      my - 1.8,
      mx - 2.5,
      my + 0.8,
      mx + 2.5,
      my + 0.8,
      mx + 6.5,
      my - 1.8,
    ]);
  else
    line(ctx, lip, 1.4, [mx - 5, my - 0.4, mx - 2, my + 0.6, mx + 2, my + 0.6, mx + 5, my - 0.8]);
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
/** A big face in the flat pixel style: face oval 38 × 46 units at s = 1, centred between the eyes. */
function face(
  ctx: Ctx,
  who: 'ines' | 'theo',
  x: number,
  y: number,
  s: number,
  f: Face,
  sec: number,
) {
  const ines = who === 'ines';
  const tone = toner(f.shade ?? 0.15, f.night ?? NIGHT);
  const skin = tone(ines ? SKIN_I : SKIN_T),
    skinD = tone(ines ? SKIN_I_D : SKIN_T_D);
  const turn = f.turn ?? 0,
    fx = turn * 5,
    cx0 = fx * 0.25;
  const hood = ines ? (f.hood ?? 1) : 0,
    shiver = f.shiver ?? 0;
  ctx.save();
  ctx.translate(
    x + Math.sin(sec * 47) * 0.5 * shiver * s,
    y + (Math.sin(sec * 39 + 1) * 0.4 * shiver + (f.nod ?? 0) * 3) * s,
  );
  ctx.scale(s, s);
  if (f.tilt) ctx.rotate(f.tilt);
  const coat = tone(f.collar ?? (ines ? RED : ORANGE));
  poly(ctx, coat, [-50, 76, -38, 28, -13, 21, 13, 21, 38, 28, 50, 76]);
  if (ines && hood <= 0 && f.collar === undefined) {
    // Jacket open at the neck over the grey fleece.
    poly(ctx, tone(FLEECE), [-13, 21, 13, 21, 7 + fx * 0.3, 44, -7 + fx * 0.3, 44]);
    line(ctx, mix(coat, INK, 0.35), 1.4, [-13, 21, -6 + fx * 0.3, 46, -8, 76]);
    line(ctx, mix(coat, INK, 0.35), 1.4, [13, 21, 6 + fx * 0.3, 46, 8, 76]);
  } else line(ctx, mix(coat, INK, 0.4), 1.2, [fx * 0.4, 30, fx * 0.4, 76]);
  if (hood > 0) {
    oval(ctx, -turn * 3, -4, 31, 34, tone(RED));
    oval(ctx, -turn * 1.5, 1, 24.5, 29, tone('#2A2B33'));
  } else if (ines) {
    disc(ctx, (turn >= 0 ? -17 : 17) - fx * 0.2, -12, 7.5, tone(HAIR_I));
    oval(ctx, fx * 0.2, -8, 21, 18, tone(HAIR_I));
  } else oval(ctx, fx * 0.2, -6, 20.5, 16, tone(HAIR_T));
  box(ctx, -7 + fx * 0.3, 14, 14, 11, skinD);
  const rx = ines ? 19 : 18.5,
    ry = ines ? 23 : 22;
  oval(ctx, cx0, 0, rx, ry, skin);
  oval(ctx, cx0, 8, ines ? 15.5 : 15, ines ? 16.5 : 15.5, skin);
  if (ines) poly(ctx, skin, [cx0 - 14, 10, cx0 - 9, 21.5, cx0 + 9, 21.5, cx0 + 14, 10]);
  // Soft modelling: shade falls away on the far side, the key light wraps the near one.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx0, 0, rx, ry, 0, 0, TAU);
  ctx.clip();
  const far = turn >= 0 ? -1 : 1;
  const sh = ctx.createLinearGradient(cx0 + far * rx, 0, cx0 - far * 4, 0);
  sh.addColorStop(0, alpha(skinD, 0.75));
  sh.addColorStop(1, alpha(skinD, 0));
  ctx.fillStyle = sh;
  ctx.fillRect(cx0 - rx, -ry, rx * 2, ry * 2);
  if (f.key && (f.keyAmt ?? 0) > 0) {
    const ks = f.keySide ?? 1;
    const kg = ctx.createLinearGradient(cx0 + ks * rx, 0, cx0 - ks * 2, 0);
    kg.addColorStop(0, alpha(f.key, (f.keyAmt ?? 0) * 1.6));
    kg.addColorStop(1, alpha(f.key, 0));
    ctx.fillStyle = kg;
    ctx.fillRect(cx0 - rx, -ry, rx * 2, ry * 2);
  }
  ctx.restore();
  for (const side of [-1, 1])
    oval(
      ctx,
      side * 11 + fx,
      8,
      ines ? 4 : 4.5,
      ines ? 2.6 : 3,
      alpha('#D8605A', ines ? 0.2 : 0.42),
    );
  if (ines && hood > 0)
    poly(ctx, tone(HAIR_I), [
      cx0 - 17,
      -11,
      -9,
      -20,
      6,
      -21.5,
      cx0 + 17,
      -12,
      10 + fx * 0.3,
      -15,
      1 + fx * 0.3,
      -12.5,
      -7 + fx * 0.3,
      -15,
    ]);
  else if (ines) {
    // Swept back from a side parting into a knot, grey coming in at the temples.
    const part = -4 + fx * 0.4;
    poly(ctx, tone(HAIR_I), [
      cx0 - 19.5,
      -1,
      cx0 - 19,
      -13,
      -12,
      -21.5,
      part,
      -24.5,
      12,
      -22,
      cx0 + 19,
      -12,
      cx0 + 19.5,
      -1,
      cx0 + 16,
      -10,
      part + 12,
      -16,
      part + 2,
      -18.5,
      part - 8,
      -16,
      cx0 - 16,
      -10,
    ]);
    for (const side of [-1, 1]) {
      const ex = cx0 + side * 17;
      line(ctx, tone(GREY), 0.9, [ex, -3, ex - side * 1.5, -11, ex - side * 6, -17]);
      line(ctx, tone(mix(GREY, HAIR_I, 0.35)), 0.8, [ex + side * 1.5, -6, ex - side * 1, -15]);
    }
    line(ctx, tone(mix(GREY, HAIR_I, 0.5)), 0.8, [part + 2, -18, part + 9, -21]);
    line(ctx, tone('#2E2826'), 0.9, [part, -24, part + 1, -18.5]);
  } else {
    oval(ctx, fx * 0.2, -19, 22.5, 15, tone(BEANIE));
    box(ctx, -22.5 + fx * 0.2, -20, 45, 8, tone(BEANIE_D));
    for (let i = 0; i < 9; i++)
      box(ctx, -20 + i * 5 + fx * 0.2, -19, 1, 6, tone(mix(BEANIE_D, INK, 0.3)));
    disc(ctx, fx * 0.2, -35, 5, tone('#DCE6EE'));
    poly(ctx, tone(HAIR_T), [cx0 - 18.5, -12, cx0 - 16, -4, cx0 - 13, -12]);
    poly(ctx, tone(HAIR_T), [cx0 + 18.5, -12, cx0 + 16, -4, cx0 + 13, -12]);
    for (const [dx, dy] of [
      [-7, 5],
      [-5, 6.5],
      [6, 5.5],
      [8, 4.5],
    ])
      box(ctx, dx + fx, dy, 0.9, 0.9, alpha('#A8684A', 0.6));
  }
  if (hood > 0) {
    line(ctx, tone('#1B1E26'), 3.2, [-25, -11, -13, -22, 13, -22, 25, -11]);
    const lx = fx * 0.3,
      dip = f.dip ?? 0,
      lamp = f.lamp ?? 0;
    box(ctx, lx - 6, -28, 12, 8, tone('#C9D0DA'));
    box(ctx, lx - 6, -28, 12, 1.5, tone('#E8ECF2'));
    disc(ctx, lx, -24 + dip, 2.8, lamp > 0 ? mix('#8A93A0', LAMP, lamp) : tone('#6A7280'));
    if (lamp > 0) glow(ctx, lx, -24 + dip * 3, 24, LAMP, 0.5 * lamp * (1 - 0.45 * dip));
  }
  const b = f.brow ?? 0,
    w = f.worry ?? 0,
    q = f.quirk ?? 0;
  for (const side of [-1, 1]) {
    const bx = side * 9 + fx;
    const lift = b + (side > 0 ? q : 0);
    line(ctx, tone(ines ? '#3A3230' : '#6A4428'), ines ? 2.5 : 2.3, [
      bx + side * 5.5,
      -9.5 - lift * 2,
      bx - side * 4.5,
      -10 - lift * 2 - w * 2.6,
    ]);
  }
  const eo: EyeLook = {
    lid: f.lid ?? 0.22,
    look: f.look ?? [0, 0],
    iris: ines ? '#5A7890' : '#6B4424',
    wide: f.wide ?? 0,
  };
  for (const side of [-1, 1]) {
    const wv = (1 - Math.max(0, -side * turn) * 0.28) * (ines ? 1 : 1.06);
    const ex = side * 9 + fx * (side * turn > 0 ? 1.1 : 0.9);
    eyeAt(ctx, ex, -2, wv, eo, tone, skin);
    if (ines) {
      line(ctx, alpha(skinD, 0.85), 0.7, [ex + side * 5 * wv, -2.5, ex + side * 7.5 * wv, -4]);
      line(ctx, alpha(skinD, 0.85), 0.7, [ex + side * 5 * wv, -0.5, ex + side * 7.5 * wv, 0.8]);
    }
  }
  if (ines) line(ctx, alpha('#EBC7AE', 0.85), 0.7, [11.5 + fx, -12.8, 12.8 + fx, -8.6]);
  line(ctx, alpha(skinD, 0.9), 1.3, [fx * 1.1 + 0.5, -1, fx * 1.2 + 2.6, 7, fx * 1.2 + 0.2, 8.6]);
  box(ctx, fx * 1.2 - 2.5, 8.2, 1.4, 0.9, tone('#5E3326'));
  box(ctx, fx * 1.2 + 1.5, 8.2, 1.4, 0.9, tone('#5E3326'));
  if (!ines) oval(ctx, fx * 1.2 + 0.8, 7.2, 3, 2, alpha('#E0706A', 0.45));
  if (ines)
    for (const side of [-1, 1])
      line(ctx, alpha(skinD, 0.6), 0.8, [
        fx + side * 5,
        6,
        fx + side * 8.5,
        11,
        fx + side * 8,
        15.5,
      ]);
  mouthAt(ctx, fx * 0.95, ines ? 14.6 : 14, f.mouth ?? 'flat', tone);
  const frost = f.frost ?? 0;
  if (frost > 0) {
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++)
        box(
          ctx,
          side * 9 + fx - 4 + i * 2.6,
          -12.2 - b * 2 + (i % 2),
          1,
          1,
          alpha('#FFFFFF', 0.85 * frost),
        );
    if (hood > 0)
      for (let i = 0; i < 22; i++) {
        const a = Math.PI * (0.9 + rand(i * 3.7) * 1.2);
        const r = 0.84 + rand(i * 5.3) * 0.2;
        const z = 0.8 + rand(i * 1.9) * 1.6;
        box(
          ctx,
          -turn * 3 + Math.cos(a) * 31 * r,
          -4 + Math.sin(a) * 34 * r,
          z,
          z,
          alpha('#F4F8FF', (0.35 + rand(i) * 0.5) * frost),
        );
      }
    if (!ines)
      for (let i = 0; i < 10; i++)
        box(ctx, -21 + i * 4.6 + fx * 0.2, -21 + (i % 3), 1.4, 1.4, alpha('#FFFFFF', 0.75 * frost));
  }
  if (f.rimL) {
    rimArc(ctx, cx0, 0, 19, 23, Math.PI * 0.62, Math.PI * 1.3, f.rimL);
    if (hood > 0) rimArc(ctx, -turn * 3, -4, 31, 34, Math.PI * 0.75, Math.PI * 1.3, f.rimL);
  }
  if (f.rimR) {
    rimArc(ctx, cx0, 0, 19, 23, -Math.PI * 0.32, Math.PI * 0.38, f.rimR);
    if (hood > 0) rimArc(ctx, -turn * 3, -4, 31, 34, -Math.PI * 0.3, Math.PI * 0.25, f.rimR);
  }
  ctx.restore();
}

// ——— Hands and hardware for the inserts ———
function mitt(ctx: Ctx, x: number, y: number, s: number, a: number, color = GLOVE, cuff = RED) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  box(ctx, -15, -6, 7, 12, cuff);
  oval(ctx, -2, 0, 8, 6, color);
  oval(ctx, 5.5, 0.6, 4.5, 5.4, color);
  oval(ctx, -1, -5.6, 4, 2.4, color, -0.4);
  line(ctx, alpha('#FFFFFF', 0.14), 1, [-5, -3.5, 4, -3.8]);
  line(ctx, alpha(INK, 0.4), 0.8, [4, -3, 4.5, 4]);
  ctx.restore();
}
function carabiner(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  a: number,
  gate: number,
  lock: number,
  color = '#D9B24A',
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(5, 6);
  ctx.quadraticCurveTo(5, 11, 0, 11);
  ctx.quadraticCurveTo(-4, 11, -4, 7);
  ctx.lineTo(-3, -9);
  ctx.quadraticCurveTo(-2, -12, 1, -12);
  ctx.quadraticCurveTo(5, -12, 5, -8);
  ctx.stroke();
  line(ctx, mix(color, '#FFFFFF', 0.3), 1.8, [5, 6, 5 - gate * 4, -8 + gate * 2]);
  box(ctx, 3.6, -5 + lock * 6, 3, 5, mix(color, INK, 0.25));
  ctx.restore();
}
/** A big ice axe: grip at (x, y), shaft along angle a, pick on the clockwise side (or not, flipped). */
function bigAxe(ctx: Ctx, x: number, y: number, a: number, len: number, s: number, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, flip ? -s : s);
  line(ctx, '#2F4460', 7, [-4, 0, len, 0]);
  line(ctx, alpha('#8FA8C8', 0.5), 1.2, [0, -2.4, len - 4, -2.4]);
  line(ctx, '#15181E', 8.5, [-4, 0, len * 0.22, 0]);
  poly(ctx, '#15181E', [-4, -4, -12, 0, -4, 4]);
  box(ctx, len - 6, -6, 12, 12, '#7E8A98');
  box(ctx, len - 6, -6, 12, 2, '#C4CCD6');
  poly(ctx, METAL, [len - 4, 6, len + 5, 6, len + 7, 20, len + 4, 32, len - 1, 38, len + 1, 20]);
  for (let i = 0; i < 4; i++)
    poly(ctx, '#7E8A98', [
      len - 1 + i * 0.3,
      22 + i * 4,
      len - 3,
      24 + i * 4,
      len - 0.5 + i * 0.3,
      25 + i * 4,
    ]);
  poly(ctx, METAL, [len - 4, -6, len + 4, -6, len + 7, -15, len - 7, -15]);
  line(ctx, '#E8EDF2', 1.2, [len - 7, -15, len + 7, -15]);
  line(ctx, alpha('#5E6A78', 0.8), 0.8, [len + 4, -6, len + 7, -15]);
  disc(ctx, len, 0, 1.6, '#4E5864');
  ctx.restore();
}
function mug(ctx: Ctx, x: number, y: number, s: number, sec: number, steam = 1, warm = 0) {
  const body = mix('#E6ECF0', '#FFF1E4', warm),
    rim = '#2C4468';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = body;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(10, -10, 4, 5, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  box(ctx, -9, -20, 18, 20, body);
  box(ctx, -9, -20, 18, 2, rim);
  box(ctx, -9, -1, 18, 1, alpha(rim, 0.5));
  box(ctx, -9, -20, 3, 20, alpha('#FFFFFF', 0.35));
  box(ctx, 4, -9, 3, 2, alpha('#3A4A60', 0.5));
  ctx.restore();
  // Steam: thin wisps that curl up and thin out.
  for (let i = 0; i < 3; i++) {
    const t = (sec * 0.3 + i / 3) % 1;
    const pts: number[] = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      pts.push(
        x + (i - 1) * 4 * s + Math.sin(u * 5 + sec * 1.3 + i * 2) * (1.5 + u * 3) * s,
        y - (22 + t * 10 + u * 16) * s,
      );
    }
    line(ctx, alpha('#F4F6FA', 0.35 * Math.sin(t * Math.PI) * steam), 1.2 * s, pts);
  }
}
function mic(ctx: Ctx, x: number, y: number, s: number, a = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  box(ctx, -5, -9, 10, 18, '#1D2128');
  box(ctx, -4, -8, 8, 6, '#2C323C');
  for (let i = 0; i < 3; i++) box(ctx, -3, -7 + i * 2, 6, 1, '#12151A');
  box(ctx, 5, -2, 1.5, 5, '#3A414C');
  ctx.restore();
}

// ——— Inside the hut ———
function planks(ctx: Ctx, color = '#2A1E17') {
  box(ctx, 0, 0, W, H, color);
  for (let x = 6; x < W; x += 26) {
    box(ctx, x, 0, 1, H, '#1E150F');
    box(ctx, x + 1, 0, 1, H, alpha('#4A3424', 0.6));
  }
}
function windowView(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  sec: number,
  storm: number,
) {
  box(ctx, x - 5, y - 5, w + 10, h + 10, '#1A120D');
  const g = blend(DUSK, STORM, storm);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  gradient(ctx, y, y + h, g.sky, x, w);
  ctx.save();
  ctx.translate(x + w / 2, y + h * 0.14);
  const sc = w / 230;
  ctx.scale(sc, sc);
  ctx.translate(-196, -10);
  massif(ctx, g);
  cloudBank(ctx, sec, 290 - sec * 2, 26, 200, '#2C3550', 0.35 + 0.3 * storm, 3);
  ctx.restore();
  for (let i = 0; i < 14; i++) {
    const fx = x + ((((rand(i * 3.1) * w - sec * 12 * (0.6 + rand(i))) % w) + w) % w);
    const fy = y + ((rand(i * 5.7) * h + sec * 16 * (0.6 + rand(i * 2))) % h);
    box(ctx, fx, fy, 1, 1, alpha('#E8EEF6', 0.8));
  }
  ctx.restore();
  box(ctx, x + w / 2 - 1.5, y, 3, h, '#1A120D');
  box(ctx, x, y + h / 2 - 1.5, w, 3, '#1A120D');
  poly(ctx, alpha('#E6EEF6', 0.35), [x, y + h, x, y + h - 14, x + 18, y + h]);
  poly(ctx, alpha('#E6EEF6', 0.25), [x + w, y, x + w - 16, y, x + w, y + 12]);
  box(ctx, x - 7, y + h + 4, w + 14, 4, '#3A2A1E');
}
function oilLamp(ctx: Ctx, x: number, y: number, sec: number) {
  const flicker = 0.92 + 0.08 * Math.sin(sec * 5.3) * Math.sin(sec * 3.1);
  glow(ctx, x, y - 26, 150, AMBER, 0.3 * flicker);
  oval(ctx, x, y - 3, 12, 4, '#5A4028');
  box(ctx, x - 9, y - 12, 18, 9, '#7A5A34');
  oval(ctx, x, y - 26, 7, 12, alpha('#FFF2D0', 0.25));
  oval(ctx, x, y - 24, 2.2, 4.5, '#FFD27A');
  box(ctx, x - 5, y - 40, 10, 3, '#3A2A1E');
  glow(ctx, x, y - 24, 20, '#FFE6A8', 0.6 * flicker);
}
function wallMap(ctx: Ctx, x: number, y: number) {
  box(ctx, x, y, 74, 54, '#D9CFB6');
  ctx.strokeStyle = alpha('#8C7A58', 0.7);
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(x + 40, y + 26, 6 + i * 6, 4 + i * 4.5, -0.3, 0, TAU);
    ctx.stroke();
  }
  line(ctx, alpha('#C0392B', 0.8), 0.8, [
    x + 12,
    y + 46,
    x + 22,
    y + 40,
    x + 28,
    y + 34,
    x + 36,
    y + 30,
  ]);
  disc(ctx, x + 37, y + 29, 1.8, '#D8403A');
  box(ctx, x + 2, y + 2, 4, 4, alpha('#EDE6D2', 0.9));
  box(ctx, x + 68, y + 2, 4, 4, alpha('#EDE6D2', 0.9));
}
function table(ctx: Ctx, y: number) {
  box(ctx, -40, y, W + 80, H - y + 40, '#5C4030');
  box(ctx, -40, y, W + 80, 2, '#7E5A3E');
  for (let i = 0; i < 6; i++)
    box(ctx, -40 + rand(i * 3.7) * 400, y + 6 + i * 8, 60 + rand(i) * 80, 1, alpha('#3E2A1E', 0.6));
}
function radioSet(ctx: Ctx, x: number, y: number, sec: number, talk: number) {
  box(ctx, x, y, 96, 44, '#2A2E36');
  box(ctx, x, y, 96, 2, '#4A515E');
  box(ctx, x + 4, y + 6, 88, 34, '#363C46');
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 7; i++) box(ctx, x + 9 + i * 5, y + 11 + j * 5, 2, 2, '#1A1D23');
  box(ctx, x + 50, y + 10, 34, 11, '#0C2418');
  write(ctx, '146.52', x + 67, y + 19, { size: 7, color: alpha('#7DFFA8', 0.85) });
  for (const kx of [58, 76]) {
    disc(ctx, x + kx, y + 31, 4.2, '#15171C');
    disc(ctx, x + kx, y + 31, 1.2, '#8A93A0');
  }
  const led = 0.3 + 0.7 * talk * (0.75 + 0.25 * Math.sin(sec * 8));
  glow(ctx, x + 88, y + 12, 10, '#6CFF96', 0.45 * led);
  disc(ctx, x + 88, y + 12, 1.6, mix('#1E4A2C', '#9CFFB8', led));
  line(ctx, '#15171C', 1.4, [x + 90, y, x + 112, y - 58]);
  box(ctx, x + 96, y + 10, 3, 4, '#15171C');
}

// ——— Shots ———
function hutShot(ctx: Ctx, c: Cut) {
  const push = ease(span(c.t, 0.5, c.d + 1.5));
  zoomed(ctx, 104, 140, 1 + push * 0.12, () => {
    gradient(ctx, -30, 150, DUSK.sky);
    stars(ctx, c.sec, 0.4, 50, 3);
    glow(ctx, 0, 126, 150, '#D9A2B4', 0.22);
    farRange(ctx, DUSK);
    massif(ctx, DUSK);
    cloudBank(ctx, c.sec, 372 - c.t * 4, 30, 190, '#343E5C', 0.55, 3);
    cloudBank(ctx, c.sec, 392 - c.t * 4, 58, 150, '#2A3350', 0.5, 9);
    foreground(ctx, DUSK);
    hut(ctx, 100, 160, 0.62, { sec: c.sec, wind: 0.7 });
  });
  snowfall(ctx, c.sec, {
    amount: 0.35,
    speed: 14,
    color: alpha('#E4EAF4', 0.7),
    drift: -4,
    seed: 12,
  });
}

function radioShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const talk = presence(S, RADIO_IN, 11.2, 0.12);
  const reach = ease(span(S, 8.3, 9.1));
  const lift = ease(span(S, 9.05, 9.5));
  zoomed(ctx, 150, 100, 1.02 + c.k * 0.08, () => {
    planks(ctx);
    windowView(ctx, 206, 16, 94, 80, sec, 0.45);
    wallMap(ctx, 72, 18);
    oilLamp(ctx, 30, 124, sec);
    table(ctx, 124);
    radioSet(ctx, 100, 80, sec, talk);
    mug(ctx, 250, 126, 1, sec, 1);
    const hook: P = [202, 100];
    const hand: P = [lerp(330, 206, reach), lerp(200, 104, reach)];
    const m = lp(hook, [hand[0] + 4, hand[1] - 16], lift);
    ctx.strokeStyle = '#15171C';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const px = lerp(196, m[0], t) + Math.sin(t * TAU * 3) * 3;
      const py = lerp(118, m[1] + 9, t) + Math.cos(t * TAU * 3) * 3;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    mic(ctx, m[0], m[1], 1.3, -0.1 * lift);
    if (reach > 0) {
      line(ctx, FLEECE, 18, [hand[0] + 40, hand[1] + 70, hand[0] + 8, hand[1] + 10]);
      oval(ctx, hand[0], hand[1], 8, 9, SKIN_I);
      for (let i = 0; i < 3; i++) oval(ctx, hand[0] - 6, hand[1] - 5 + i * 4.5, 3, 2.2, SKIN_I_D);
    }
  });
}

function faceShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  planks(ctx, '#21170F');
  windowView(ctx, 238, 8, 90, 84, sec, 0.55);
  glow(ctx, -10, 120, 190, AMBER, 0.3);
  const settle = ease(span(S, 11.25, 11.8));
  const blink = hump(S, 11.2, 11.55);
  const micUp = ease(span(S, 11.45, 11.95));
  const speaking = presence(S, REPLY + 0.1, REPLY + 2.5, 0.05) > 0.5;
  const talk = speaking && Math.sin(sec * 13) > -0.2;
  face(
    ctx,
    'ines',
    138,
    100 - c.k * 2,
    2.4 + c.k * 0.12,
    {
      hood: 0,
      collar: FLEECE,
      turn: lerp(0.35, 0.15, settle),
      look: [lerp(0.95, 0.25, settle), lerp(-0.2, 0.15, settle)],
      lid: 0.22 + blink * 0.8 + settle * 0.1,
      worry: lerp(0.35, -0.4, settle),
      brow: lerp(0.1, -0.1, settle),
      mouth: talk ? 'part' : settle > 0.5 ? 'set' : 'flat',
      key: AMBER,
      keyAmt: 0.26,
      keySide: -1,
      rimR: alpha('#9CC0F0', 0.85),
      shade: 0.1,
      night: '#1C120C',
    },
    sec,
  );
  if (micUp > 0) {
    const mx = lerp(250, 206, micUp),
      my = lerp(215, 156, micUp);
    line(ctx, FLEECE, 26, [mx + 40, my + 70, mx + 12, my + 22]);
    mic(ctx, mx, my, 2.2, -0.35);
    oval(ctx, mx + 8, my + 12, 11, 12, SKIN_I);
    for (let i = 0; i < 3; i++) oval(ctx, mx - 2, my + 6 + i * 6, 4, 2.6, SKIN_I_D);
  }
}

function gearShot(ctx: Ctx, c: Cut) {
  const S = c.S;
  const tug = jolt(S, TUG, 2.5, 8);
  ctx.save();
  ctx.translate(0, tug);
  gradient(ctx, -20, H + 20, ['#D0443F', RED, '#9E2C34', RED_D]);
  line(ctx, RED_D, 4, [176, -20, 170, 100]);
  line(ctx, alpha('#E6EAF0', 0.7), 1, [176, -20, 170, 100]);
  poly(ctx, alpha(RED_D, 0.6), [40, 30, 120, 26, 122, 58, 42, 62]);
  line(ctx, alpha('#E6EAF0', 0.5), 1, [44, 34, 118, 30]);
  box(ctx, 220, 24, 100, 3, alpha('#F2F4F8', 0.45));
  poly(ctx, '#2A303C', [-20, 98, 340, 88, 340, 110, -20, 120]);
  for (let x = -10; x < 330; x += 8) {
    box(ctx, x, 101 - x * 0.028, 4, 1, alpha('#6A7A90', 0.7));
    box(ctx, x, 115 - x * 0.028, 4, 1, alpha('#6A7A90', 0.7));
  }
  box(ctx, 56, 95, 24, 22, '#9AA4B2');
  box(ctx, 60, 99, 16, 14, '#2A303C');
  box(ctx, 56, 95, 24, 2, '#D4DAE2');
  // Leg loops and the blue belay loop.
  poly(ctx, '#2A303C', [110, 118, 146, 112, 150, 124, 120, 190, 96, 190]);
  poly(ctx, '#2A303C', [196, 110, 226, 106, 250, 190, 224, 190, 192, 122]);
  ctx.strokeStyle = '#3F7FCF';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(170, 110, 13, 24, 0, 0.1, Math.PI - 0.1);
  ctx.stroke();
  // Spare gear on the loops.
  carabiner(ctx, 26, 124, 1.3, 0.1, 0, 1, '#E8B838');
  carabiner(ctx, 262, 116, 1.3, -0.1, 0, 1, '#4AB8E0');
  carabiner(ctx, 294, 114, 1.3, -0.2, 0, 1, '#E86A3A');
  // The locking karabiner, clipped and screwed shut.
  const k = easeOut(span(S, 14.05, CLIP));
  const gate = S < CLIP - 0.2 ? 0 : S < CLIP ? 1 : 0;
  const lock = ease(span(S, LOCK - 0.15, LOCK + 0.15));
  const kx = lerp(270, 172, k),
    ky = lerp(186, 146, k) + (S > CLIP ? 2 : 0);
  carabiner(ctx, kx, ky, 2.4, lerp(-0.6, 0.12, k), gate, lock);
  const away = ease(span(S, 15.6, 16.2));
  line(ctx, RED_D, 22, [
    kx + 30 + away * 60,
    ky + 70 + away * 30,
    kx + 18 + away * 60,
    ky + 14 + away * 30,
  ]);
  mitt(ctx, kx + 14 + away * 60, ky + 8 + away * 30, 2.3, -2.2 + lock * 0.5, GLOVE, RED_D);
  const pull = hump(S, TUG - 0.35, TUG + 0.5);
  if (pull > 0.01) {
    const px = lerp(-30, 40, pull) - ease(span(S, TUG, TUG + 0.2)) * 18;
    line(ctx, RED_D, 22, [px - 60, 170, px - 10, 116]);
    mitt(ctx, px, 108, 2.3, -0.4, GLOVE, RED_D);
  }
  ctx.restore();
}

function doorShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const g = blend(DUSK, STORM, 0.35);
  const open = ease(span(S, DOOR, DOOR + 0.5));
  const ix = 112 + Math.max(0, S - STEP_OUT) * 56;
  const pan = clamp((ix - 180) * 0.4, 0, 40);
  ctx.save();
  ctx.translate(-pan, 0);
  gradient(ctx, -10, 170, g.sky, -40, W + 120);
  ctx.save();
  ctx.translate(60, 44);
  ctx.scale(0.95, 0.95);
  farRange(ctx, g);
  massif(ctx, g);
  ctx.restore();
  cloudBank(ctx, sec, 330 - c.t * 6, 30, 260, '#2A3350', 0.5, 7);
  poly(ctx, g.groundD, [-40, 200, -40, 150, 120, 156, 260, 146, 400, 150, 400, 200]);
  poly(ctx, g.ground, [-40, 200, -40, 168, 100, 170, 220, 166, 400, 169, 400, 200]);
  hut(ctx, 90, 170, 2.3, { sec, door: open, wind: 0.8 });
  for (const f of DOOR_STEPS)
    if (f < S) {
      const fx = 112 + (f - STEP_OUT) * 56;
      oval(ctx, fx + 4, 172, 4, 1.2, alpha('#2E3A52', 0.55));
    }
  if (S > DOOR + 0.3) {
    const walking = S > STEP_OUT;
    const ph = Math.max(0, S - STEP_OUT) * DOOR_RATE * TAU;
    const lampOn = ease(span(S, LAMP_ON, LAMP_ON + 0.2));
    const reach = hump(S, LAMP_ON - 0.4, LAMP_ON + 0.35);
    let pose = walking ? walk(ph, 1, 0.12) : walk(0, 0, 0.02);
    pose = {
      ...pose,
      hands: [pose.hands[0], lp(pose.hands[1], [pose.sh[0] + 7, pose.sh[1] - 9], reach)],
      lamp: lampOn,
      tilt: 0.12,
    };
    const inDoor = clamp(1 - (S - STEP_OUT) / 0.5);
    figure(ctx, ix, 170, 2, INES, pose, {
      dark: lerp(0.18, 0.6, inDoor),
      night: '#1A1522',
      rim: AMBER,
      rimAmt: clamp(1 - (ix - 112) / 140),
    });
    if (lampOn > 0) {
      const [lx, ly] = lensAt(ix, 170, 2, pose);
      beam(ctx, lx, ly, 0.42, 130, 0.2, lampOn);
    }
  }
  ctx.restore();
  gale(ctx, sec, {
    amount: 0.7,
    speed: 150,
    fall: 0.3,
    length: 3,
    color: alpha(SNOW, 0.55),
    seed: 21,
  });
}

const ROUTE = [
  52, 166, 72, 158, 94, 152, 82, 142, 106, 134, 96, 124, 122, 116, 112, 106, 138, 98, 128, 88, 150,
  80,
];
function mountainShot(ctx: Ctx, c: Cut) {
  const sec = c.sec;
  const g = STORM;
  const u = lerp(0.12, 0.62, c.k);
  zoomed(ctx, 150, 100, 1 + ease(c.k) * 0.1, () => {
    gradient(ctx, -20, 160, g.sky);
    farRange(ctx, g);
    massif(ctx, g);
    cloudBank(ctx, sec, 262 - c.t * 7, 20, 230, '#1A2230', 0.75, 5, 14);
    cloudBank(ctx, sec, 300 - c.t * 9, 46, 220, '#232C3C', 0.55, 8, 12);
    foreground(ctx, g);
    hut(ctx, 44, 170, 0.34, { sec, wind: 1 });
    for (let i = 0; i < 18; i++) {
      const q = (i / 18) * u;
      if (q < 0.04) continue;
      const [tx, ty] = along(ROUTE, q);
      box(ctx, tx, ty, 1, 1, alpha('#9AA8C0', 0.55));
    }
    const [dx, dy] = along(ROUTE, u);
    const [nx, ny] = along(ROUTE, Math.min(1, u + 0.02));
    beam(ctx, dx, dy - 2, Math.atan2(ny - dy, nx - dx) - 0.2, 18, 0.28, 0.7);
    box(ctx, dx - 0.5, dy - 1, 1.5, 2.5, RED);
    glow(ctx, dx, dy - 2, 10, LAMP, 0.6);
    box(ctx, dx - 0.5, dy - 2.5, 1, 1, LAMP);
  });
  gale(ctx, sec, {
    amount: 0.55,
    speed: 110,
    fall: 0.35,
    length: 3,
    color: alpha(SNOW, 0.4),
    seed: 31,
  });
}

/** Where a kicked boot or a swung axe is: 0 while it is pulled back, 1 once it bites. */
function strike(S: number, times: readonly number[], pull = 0.2, swing = 0.25) {
  let next = Infinity,
    last = -Infinity;
  for (const t of times)
    if (t <= S) last = t;
    else {
      next = t;
      break;
    }
  const w = next - S;
  let q = 1;
  if (w < pull + swing) q = w > swing ? 1 - ease((pull + swing - w) / pull) : easeIn(1 - w / swing);
  return { q, since: S - last, out: w < pull + swing && w > swing };
}
function boot(ctx: Ctx, x: number, y: number, s: number, a: number, tone: Tone) {
  const ca = Math.cos(a),
    sa = Math.sin(a);
  const ankle: P = [x + (-8 * ca + 10 * sa) * s, y + (-8 * sa - 10 * ca) * s];
  line(ctx, tone(PANTS_D), 5.2 * s, [ankle[0], ankle[1], ankle[0] - 34 * s, ankle[1] - 52 * s]);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  line(ctx, tone(METAL), 0.7, [0, 0.8, 3.4, 1.4]);
  line(ctx, tone(METAL), 0.7, [0, 1.8, 3.4, 2.6]);
  line(ctx, tone(METAL), 0.6, [-12, 2.2, -1, 2.2]);
  for (let i = 0; i < 4; i++)
    poly(ctx, tone(METAL), [-11 + i * 3, 2.2, -10 + i * 3, 2.2, -10.5 + i * 3, 4.3]);
  box(ctx, -12.5, 0.4, 12.5, 1.8, tone('#101216'));
  poly(
    ctx,
    tone('#2E3038'),
    [-12.5, 0.5, -12.5, -6, -10, -8.5, -5, -9, -2, -5.5, 0, -2.5, 0.2, 0.5],
  );
  line(ctx, tone(RED_D), 0.9, [-12, -2, -1, -1.5]);
  for (let i = 0; i < 3; i++)
    line(ctx, tone('#8A93A0'), 0.4, [-9 + i * 1.6, -8, -7.5 + i * 1.6, -6]);
  poly(ctx, tone(PANTS_D), [-11.5, -6, -11, -14, -4, -14, -4.5, -8]);
  box(ctx, -11.5, -9, 7.5, 1.4, tone('#15181E'));
  ctx.restore();
}
function chips(ctx: Ctx, x: number, y: number, t: number, dir = -1, size = 1) {
  if (t < 0 || t > 0.6) return;
  const k = t / 0.6;
  for (let i = 0; i < 12; i++) {
    const a = (rand(i * 2.7) - 0.5) * 2;
    const v = (30 + rand(i * 5.3) * 70) * size;
    const px = x + dir * Math.cos(a) * v * t,
      py = y + Math.sin(a) * v * t * 0.8 - 20 * t * size + 160 * t * t * size;
    box(ctx, px, py, 1.5 * size, 1.5 * size, alpha(i % 3 ? '#E8F4FF' : '#9ACBE6', 1 - k));
  }
}
const BOOT_SLOPE = 0.95;
function bootsShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const up: P = [Math.cos(BOOT_SLOPE), -Math.sin(BOOT_SLOPE)];
  const into: P = [Math.sin(BOOT_SLOPE), Math.cos(BOOT_SLOPE)];
  const at = (u: number, v = 0): P => [64 + up[0] * u + into[0] * v, 200 + up[1] * u + into[1] * v];
  const scroll = c.t * 16;
  gradient(ctx, 0, H, ['#131A26', '#1E2836', '#2A3546']);
  gale(ctx, sec, { amount: 0.9, speed: 230, length: 6, color: alpha(SNOW, 0.35), seed: 51 });
  const a0 = at(-80),
    a1 = at(320);
  const g = ctx.createLinearGradient(a0[0], a0[1], a0[0] + into[0] * 140, a0[1] + into[1] * 140);
  g.addColorStop(0, '#D6E8F4');
  g.addColorStop(0.3, '#8EBEDC');
  g.addColorStop(1, '#3A6E98');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(a0[0], a0[1]);
  ctx.lineTo(a1[0], a1[1]);
  ctx.lineTo(a1[0] + into[0] * 400, a1[1] + into[1] * 400);
  ctx.lineTo(a0[0] + into[0] * 400, a0[1] + into[1] * 400);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 16; i++) {
    const u = ((((rand(i * 3.3) * 420 - scroll) % 420) + 420) % 420) - 60;
    const p = at(u, 5 + rand(i * 7.1) * 80);
    const l = 10 + rand(i) * 18;
    line(ctx, alpha('#F2FAFF', 0.35), 0.8, [p[0], p[1], p[0] + up[0] * l, p[1] + up[1] * l]);
    if (i % 3 === 0) oval(ctx, p[0] + 6, p[1] + 8, 1.6, 1.2, alpha('#FFFFFF', 0.35));
  }
  for (let i = 0; i < 6; i++) {
    const u = ((((rand(i * 9.1) * 420 - scroll) % 420) + 420) % 420) - 60;
    const p = at(u, 1);
    poly(ctx, alpha('#FFFFFF', 0.75), [
      p[0],
      p[1],
      p[0] + up[0] * 18,
      p[1] + up[1] * 18,
      p[0] + 6,
      p[1] + 3,
    ]);
  }
  line(ctx, alpha('#FFFFFF', 0.75), 1.2, [a0[0], a0[1], a1[0], a1[1]]);
  const pool = at(130, 10);
  glow(ctx, pool[0], pool[1], 110, LAMP, 0.25);
  // Her axe bites somewhere above: ice rattles down the slope past her boots.
  for (const p of PLANTS) {
    const t = S - p;
    if (t < 0 || t > 1.4) continue;
    for (let i = 0; i < 9; i++) {
      const d = t * (70 + rand(i * 3.1) * 60) + t * t * 40;
      const q = at(260 - d, -3 - rand(i * 5.7) * 10 - Math.abs(Math.sin(t * 9 + i)) * 4);
      box(ctx, q[0], q[1], 2, 2, alpha(i % 3 ? '#E8F4FF' : '#9ACBE6', 1 - t / 1.4));
    }
  }
  // Front-pointing: each boot pulls back and kicks in again.
  const kickAt = (i: number) => KICKS.filter((_, k) => k % 2 === i);
  for (const i of [1, 0] as const) {
    const st = strike(S, kickAt(i), 0.15, 0.22);
    const rest = at(i ? 150 : 104, 2.5);
    const back: P = [rest[0] - 30, rest[1] + 18];
    const pos = lp(back, rest, st.q);
    boot(ctx, pos[0], pos[1], 3.3, lerp(0.55, 0.08, st.q), toner(i ? 0.35 : 0, '#101826'));
    chips(ctx, rest[0] + 2, rest[1] + 2, st.since, -1, 1);
  }
  for (let i = 0; i < 28; i++) {
    const u = 380 - ((rand(i * 2.3) * 440 + sec * 70 * (0.7 + rand(i))) % 440);
    const p = at(u, -2 - rand(i * 5.1) * 7);
    box(ctx, p[0], p[1], 1.5, 1, alpha(SNOW, 0.65));
  }
}

const CLIMB_M = 0.9;
function climbShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const gust = hump(S, GUST - 0.2, GUST + 1.4);
  const prog = climbed(S);
  const ox = 150,
    oy = 124;
  const slope = (x: number) => oy - CLIMB_M * (x - ox);
  const scroll = prog * 8;
  gradient(ctx, -10, H + 10, ['#0E141F', '#1A2331', '#2A3547', '#3A465A']);
  poly(ctx, '#151C28', [-20, 120, 20, 92, 48, 104, 84, 74, 116, 90, 140, 80, 180, 130, -20, 150]);
  cloudBank(ctx, sec, 80 - c.t * 10, 40, 260, '#2A3446', 0.5, 17);
  gale(ctx, sec, {
    amount: 0.9 + gust * 1.1,
    speed: 210 + gust * 140,
    fall: 0.16,
    length: 7,
    color: alpha(SNOW, 0.4),
    seed: 61,
  });
  const sg = ctx.createLinearGradient(ox, oy, ox + 60, oy + 66);
  sg.addColorStop(0, '#B8C6D8');
  sg.addColorStop(1, '#5E6E88');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(-60, slope(-60));
  ctx.lineTo(380, slope(380));
  ctx.lineTo(380, 260);
  ctx.lineTo(-60, 260);
  ctx.closePath();
  ctx.fill();
  const dir: P = [Math.cos(Math.atan(CLIMB_M)), -Math.sin(Math.atan(CLIMB_M))];
  for (let i = 0; i < 12; i++) {
    const u = ((((rand(i * 4.1) * 480 - scroll) % 480) + 480) % 480) - 240;
    const v = 4 + rand(i * 6.3) * 60;
    const px = ox + dir[0] * u + dir[1] * -v,
      py = oy + dir[1] * u + dir[0] * v;
    if (i % 4 === 0) {
      poly(ctx, '#2A3242', [px - 8, py + 3, px - 3, py - 5, px + 5, py - 6, px + 9, py + 2]);
      box(ctx, px - 3, py - 6, 7, 1.5, '#D6E0EC');
    } else line(ctx, alpha('#E8F0F8', 0.5), 1, [px, py, px + dir[0] * 16, py + dir[1] * 16]);
  }
  line(ctx, alpha('#F2F6FA', 0.8), 1.2, [-60, slope(-60), 380, slope(380)]);
  const pose = climbPose(CLIMB_M, prog * CLIMB_RATE * TAU, gust);
  figure(ctx, ox, oy, 2.1, INES, pose, { dark: 0.3, night: '#101826' });
  const [lx, ly] = lensAt(ox, oy, 2.1, pose);
  const a = (pose.tilt ?? 0) - 0.15;
  beam(ctx, lx, ly, a, 150, 0.22, 0.85);
  litSnow(ctx, sec, lx, ly, a, 150, 0.22, {
    amount: 1.2 + gust,
    speed: 210 + gust * 140,
    fall: 0.16,
    length: 7,
    color: alpha('#FFFFFF', 0.9),
    seed: 62,
  });
  for (let i = 0; i < 24; i++) {
    const t = (sec * 1.3 + rand(i * 3.9)) % 1;
    const x0 = ox + 40 + rand(i * 1.9) * 200;
    box(ctx, x0 - t * 90, slope(x0) - t * 26 - rand(i) * 4, 2, 1, alpha(SNOW, 0.5 * (1 - t)));
  }
}

function axeShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  gradient(ctx, 0, H, ['#161E2B', '#222C3C', '#2C384A']);
  gale(ctx, sec, { amount: 1.1, speed: 240, length: 6, color: alpha(SNOW, 0.45), seed: 41 });
  const surf = (y: number) =>
    200 + (180 - y) * 0.12 + Math.sin(y * 0.21) * 2 + Math.sin(y * 0.07 + 1) * 3;
  const G: P = [124, 252];
  const bite = (y: number) => {
    const e: P = [surf(y) - 32, y - 4];
    return { a: Math.atan2(e[1] - G[1], e[0] - G[0]), len: Math.hypot(e[0] - G[0], e[1] - G[1]) };
  };
  const b1 = bite(98),
    b2 = bite(60);
  /** Where the pick of a planted axe breaks the surface of the ice. */
  const entry = (b: { a: number; len: number }): P => {
    const ca = Math.cos(b.a),
      sa = Math.sin(b.a);
    for (let i = 0; i <= 16; i++) {
      const lx = (b.len / 2.4 + 1 + (i / 16) * 3) * 2.4,
        ly = (6 + (i / 16) * 30) * 2.4;
      const x = G[0] + lx * ca - ly * sa,
        y = G[1] + lx * sa + ly * ca;
      if (x >= surf(y)) return [x, y];
    }
    return [surf(98), 98];
  };
  const holes = [entry(b1), entry(b2)] as const;
  const st = strike(S, BITES, 0.3, 0.2);
  const second = S >= BITES[0] + 0.4;
  const target = second ? b2 : b1;
  const from = second ? b1.a - 0.7 : b1.a - 0.9;
  const a = st.out ? lerp(b1.a, b1.a - 0.7, 1 - st.q) : lerp(from, target.a, st.q);
  const recoil = jolt(S, BITES[0], 0.02, 9) + jolt(S, BITES[1], 0.02, 9);
  bigAxe(ctx, G[0], G[1], a + recoil, target.len / 2.4, 2.4);
  const pts: number[] = [];
  for (let y = -10; y <= 190; y += 10) pts.push(surf(y), y);
  pts.push(340, 190, 340, -10);
  const ig = ctx.createLinearGradient(200, 0, 330, 0);
  ig.addColorStop(0, '#CFE6F4');
  ig.addColorStop(0.25, '#8CC0E0');
  ig.addColorStop(1, '#2C5E8A');
  ctx.fillStyle = ig;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2)
    if (i) ctx.lineTo(pts[i], pts[i + 1]);
    else ctx.moveTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 12; i++) {
    const y = rand(i * 3.1) * 180,
      x = surf(y) + 8 + rand(i * 5.9) * 100;
    line(ctx, alpha('#EAF6FF', 0.4), 0.8, [x, y, x + 10 + rand(i) * 14, y + 6 + rand(i * 2) * 10]);
    oval(ctx, x + 20, y + 30, 1.5, 1.2, alpha('#FFFFFF', 0.3));
  }
  line(ctx, alpha('#FFFFFF', 0.8), 1.4, pts.slice(0, pts.length - 4));
  BITES.forEach((t, i) => {
    if (S >= t) {
      const [x, y] = holes[i];
      poly(ctx, '#5E90B8', [x - 1, y - 2, x + 10, y + 2, x + 12, y + 8, x - 1, y + 6]);
      for (let i = 0; i < 5; i++) {
        const ca = rand(i * 7.7) * TAU;
        line(ctx, alpha('#FFFFFF', 0.7), 0.7, [
          x + 5,
          y + 3,
          x + 5 + Math.cos(ca) * 12,
          y + 3 + Math.sin(ca) * 10,
        ]);
      }
    }
  });
  glow(ctx, 214, 80, 130, LAMP, 0.3);
  const [gx, gy] = [G[0] + Math.cos(a) * 84, G[1] + Math.sin(a) * 84];
  line(ctx, RED_D, 30, [gx - 50, gy + 80, gx - 8, gy + 14]);
  mitt(ctx, gx, gy, 3, a + 1.3, GLOVE, RED_D);
  BITES.forEach((t, i) => chips(ctx, holes[i][0] - 2, holes[i][1], S - t, -1, 2));
}

/** Where Ines is sweeping her headlamp in the whiteout, on screen. */
function searchAngle(S: number) {
  const sweep = ease(span(S, 40.7, FOUND));
  return lerp(Math.PI + 0.1 + Math.sin(S * 1.3) * 0.14, Math.PI - 0.6, sweep);
}
function blindShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const push = ease(span(S, FOUND, 43.2));
  const A = searchAngle(S);
  const found = ease(span(S, 41.3, FOUND)) * clamp(1 - Math.abs(A - (Math.PI - 0.6)) / 0.35);
  zoomed(ctx, 110, 150, 1 + push * 0.18, () => {
    gradient(ctx, -20, H + 20, ['#7D8A9E', '#98A4B6', '#AEB8C8', '#A0ACBE']);
    for (let i = 0; i < 8; i++) {
      const x = ((((rand(i * 2.2) * 500 - sec * (30 + i * 8)) % 500) + 500) % 500) - 90;
      oval(
        ctx,
        x,
        30 + rand(i * 4.4) * 130,
        60 + rand(i) * 50,
        12 + rand(i * 3) * 10,
        alpha('#DDE4EC', 0.2),
      );
    }
    poly(ctx, alpha('#C4CCD8', 0.8), [-40, 200, -40, 150, 90, 166, 220, 160, 360, 150, 360, 200]);
    if (found > 0) {
      glow(ctx, 60, 166, 26, ORANGE, 0.35 * found);
      oval(ctx, 60, 167, 9, 5, alpha(ORANGE, found));
      oval(ctx, 63, 169, 5, 3, alpha(ORANGE_D, found));
      disc(ctx, 53, 163, 3, alpha(BEANIE, found * 0.9));
    }
    const tilt = Math.PI - A;
    const pose = {
      ...walk(0, 0, 0.05),
      lamp: 1,
      tilt,
      hands: [
        [1, -9],
        [5, -26],
      ] as const,
    };
    figure(ctx, 196, 162, 1.9, INES, pose, { facing: -1, dark: 0.35, night: '#5A687E' });
    const [lx, ly] = lensAt(196, 162, 1.9, pose, -1);
    beam(ctx, lx, ly, A, 190, 0.2, 0.9);
    litSnow(ctx, sec, lx, ly, A, 190, 0.2, {
      amount: 2,
      speed: 260,
      fall: 0.2,
      length: 8,
      color: alpha('#FFFFFF', 0.95),
      seed: 72,
    });
  });
  gale(ctx, sec, {
    amount: 1.6,
    speed: 260,
    fall: 0.2,
    length: 9,
    color: alpha('#F4F7FA', 0.55),
    seed: 71,
  });
  gale(ctx, sec + 7, {
    amount: 1,
    speed: 160,
    fall: 0.3,
    length: 4,
    color: alpha('#FFFFFF', 0.35),
    seed: 73,
  });
}

function ledgeShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const down = ease(span(S, 43.1, LEDGE));
  const crouch = ease(span(S, 45.4, 46.3));
  gradient(ctx, 0, H, ['#2A3446', '#46526A', '#6A7890', '#56647C']);
  for (let i = 0; i < 6; i++) {
    const x = ((((rand(i * 2.2) * 500 - sec * (26 + i * 6)) % 500) + 500) % 500) - 90;
    oval(ctx, x, 140 + rand(i * 4.4) * 50, 70, 14, alpha('#A8B4C6', 0.25));
  }
  poly(ctx, ROCK, [-10, -10, 94, -10, 86, 30, 100, 62, 90, 100, 98, 128, -10, 128]);
  poly(ctx, ROCK_L, [40, -10, 94, -10, 86, 30, 70, 20]);
  poly(ctx, ROCK_L, [60, 64, 100, 62, 90, 100, 66, 90]);
  for (const [x, y, w] of [
    [20, 40, 30],
    [46, 76, 24],
    [10, 100, 34],
  ] as const) {
    poly(ctx, '#C8D2DE', [x, y, x + w, y - 3, x + w + 2, y, x, y + 3]);
  }
  poly(ctx, ROCK_D, [-10, 128, 222, 128, 214, 138, 196, 146, -10, 152]);
  poly(ctx, '#C8D2DE', [-10, 125, 220, 126, 223, 129, -10, 131]);
  const ix = lerp(172, 150, crouch),
    iy = lerp(-30, 128, down);
  line(ctx, ROPE, 1.2, [174, -10, 174, Math.min(128, iy) - 44]);
  const lift = ease(span(S, 46.2, 46.8));
  figure(ctx, 104, 128, 1.9, THEO, huddle(lift), { dark: 0.3, night: '#1A2232' });
  const hang: Pose = {
    hip: [0, -21],
    sh: [-1, -35],
    feet: [
      [-4, -1],
      [4, -2],
    ],
    hands: [
      [2, -40],
      [2, -31],
    ],
    lamp: 1,
    tilt: 0.3,
  };
  const pose = mixPose(hang, kneel(0.35), crouch);
  figure(ctx, ix, S < LEDGE ? iy : 128, 1.9, INES, pose, {
    facing: -1,
    dark: 0.25,
    night: '#1A2232',
  });
  const [lx, ly] = lensAt(ix, S < LEDGE ? iy : 128, 1.9, pose, -1);
  // Her beam finds him first, sweeping down the rock before she drops into frame.
  const a =
    S < LEDGE
      ? Math.atan2(118 - ly, 106 - lx) + Math.sin(S * 2) * 0.05
      : aim((pose.tilt ?? 0) + 0.1, -1);
  const reach = Math.hypot(106 - lx, 118 - ly) + 30;
  beam(ctx, lx, ly, a, reach, 0.2, 0.9);
  litSnow(ctx, sec, lx, ly, a, reach, 0.2, {
    amount: 1.4,
    speed: 200,
    length: 6,
    color: alpha('#FFFFFF', 0.9),
    seed: 82,
  });
  gale(ctx, sec, {
    amount: 1.1,
    speed: 200,
    fall: 0.2,
    length: 6,
    color: alpha(SNOW, 0.4),
    seed: 81,
  });
}

function theoShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  gradient(ctx, 0, H, ['#1A2029', '#252D39', '#2E3846']);
  poly(ctx, '#20262F', [-10, 0, 90, 0, 70, 180, -10, 180]);
  glow(ctx, 320, -10, 220, LAMP, 0.35);
  const talking = presence(S, 47.7, 50.4, 0.05) > 0.5 && Math.sin(sec * 12) > 0;
  face(
    ctx,
    'theo',
    156,
    104 - c.k * 2,
    2.45 + c.k * 0.1,
    {
      turn: 0.2,
      look: [0.5, -0.55],
      lid: 0.5 + hump(S, 49.2, 49.5) * 0.5,
      worry: 0.9,
      brow: 0.15,
      mouth: talking ? 'part' : 'breath',
      frost: 1,
      shiver: 1,
      key: LAMP,
      keyAmt: 0.22,
      keySide: 1,
      rimR: alpha(LAMP, 0.9),
      shade: 0.12,
    },
    sec,
  );
  gale(ctx, sec, { amount: 0.8, speed: 200, length: 7, color: alpha(SNOW, 0.5), seed: 91 });
  breath(ctx, 172, 146, sec, 1, talking ? 0.4 : 0.9);
}

function inesShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const tip = ease(span(S, 50.8, 51.5));
  const hand = hump(S, 50.6, 51.9);
  gradient(ctx, 0, H, ['#161C26', '#222A36', '#2C3644']);
  poly(ctx, '#1C222C', [230, 0, 330, 0, 330, 180, 250, 180]);
  const talking = presence(S, 50.8, 53.8, 0.05) > 0.5 && Math.sin(sec * 11) > -0.1;
  const nod = hump(S, 53.3, 53.9);
  face(
    ctx,
    'ines',
    160,
    102,
    2.4 + c.k * 0.1,
    {
      turn: -0.22,
      look: [-0.45, 0.4],
      lid: 0.3,
      worry: 0.15,
      mouth: talking ? 'part' : 'small',
      lamp: 1,
      dip: tip,
      frost: 0.7,
      rimL: alpha('#9FC0E8', 0.8),
      key: '#9FC0E8',
      keyAmt: 0.1,
      keySide: -1,
      shade: 0.18,
      nod: nod * 0.8,
    },
    sec,
  );
  if (hand > 0.01) {
    const hx = lerp(320, 176, hand),
      hy = lerp(200, 50, hand);
    line(ctx, RED_D, 24, [hx + 60, hy + 110, hx + 8, hy + 12]);
    mitt(ctx, hx, hy, 2.2, -2 + tip * 0.4, GLOVE, RED_D);
  }
  gale(ctx, sec, { amount: 0.6, speed: 190, length: 6, color: alpha(SNOW, 0.45), seed: 93 });
}

function ropeShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const tug = jolt(S, TUGS[0], 2.2, 8) + jolt(S, TUGS[1], 2.2, 8);
  ctx.save();
  ctx.translate(tug * 0.4, tug);
  gradient(ctx, -20, H + 20, ['#F4A640', ORANGE, '#C77A22', ORANGE_D]);
  line(ctx, ORANGE_D, 4, [150, -20, 147, 66]);
  poly(ctx, alpha(ORANGE_D, 0.5), [206, 8, 290, 4, 292, 40, 208, 44]);
  poly(ctx, '#2E3440', [100, 88, 136, 84, 140, 96, 110, 190, 84, 190]);
  poly(ctx, '#2E3440', [176, 82, 206, 80, 232, 190, 206, 190, 172, 94]);
  poly(ctx, '#2E3440', [-20, 70, 340, 64, 340, 84, -20, 92]);
  for (let x = -10; x < 330; x += 8) box(ctx, x, 74 - x * 0.02, 4, 1, alpha('#6A7A90', 0.7));
  ctx.strokeStyle = '#D84A3A';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(154, 84, 11, 20, 0, 0.1, Math.PI - 0.1);
  ctx.stroke();
  const k = easeOut(span(S, 54, CLIP2));
  const kx = lerp(250, 158, k),
    ky = lerp(190, 112, k);
  const pull = (S > TUGS[0] ? 1 : 0) * 0;
  line(ctx, ROPE, 5, [340, 128, 280, 136, kx + 30, ky + 14, kx + 8, ky + 8]);
  ctx.strokeStyle = ROPE;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(kx + 14, ky + 6, 8, 5, 0.3, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(kx + 22, ky + 10, 7, 4.5, 0.3, 0, TAU);
  ctx.stroke();
  carabiner(
    ctx,
    kx,
    ky + pull,
    2.3,
    0.2,
    S > CLIP2 - 0.18 && S < CLIP2 ? 1 : 0,
    ease(span(S, CLIP2 + 0.1, CLIP2 + 0.4)),
    '#C9D2DC',
  );
  const yank = hump(S, TUGS[0] - 0.1, TUGS[0] + 0.25) + hump(S, TUGS[1] - 0.1, TUGS[1] + 0.25);
  mitt(ctx, kx + 22 + yank * 10, ky + 20 + yank * 6, 2.4, -2.6, GLOVE, RED_D);
  line(ctx, RED_D, 26, [kx + 60 + yank * 10, ky + 90, kx + 36 + yank * 10, ky + 30]);
  const grip = ease(span(S, 55.5, 56));
  if (grip > 0) {
    mitt(ctx, lerp(-20, 64, grip), lerp(190, 142, grip), 2.4, -0.6, OLIVE, ORANGE_D);
  }
  ctx.restore();
  snowfall(ctx, sec, { amount: 0.5, speed: 30, drift: -8, color: alpha(SNOW, 0.7), seed: 95 });
}

// The snow bridge, in section.
const BRIDGE = { x0: 116, x1: 204, y0: 104, y1: 100 } as const;
const bridgeSag = (S: number) => 3 + ease(span(S, 58.5, 61.8)) * 3;
function bridgeTop(x: number, S: number) {
  if (x <= BRIDGE.x0) return BRIDGE.y0;
  if (x >= BRIDGE.x1) return BRIDGE.y1;
  const t = (x - BRIDGE.x0) / (BRIDGE.x1 - BRIDGE.x0);
  return lerp(BRIDGE.y0, BRIDGE.y1, t) + Math.sin(t * Math.PI) * bridgeSag(S);
}
const theoBridgeX = (S: number) => 62 + Math.max(0, S - 56.5) * 18.5;
function bridgeShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  zoomed(ctx, 164, 104, 1 + ease(c.k) * 0.12, () => {
    gradient(ctx, -30, 110, ['#1A2230', '#2A3446', '#46526A']);
    poly(
      ctx,
      '#3A465C',
      [-40, 106, 20, 80, 70, 92, 120, 70, 190, 90, 250, 66, 300, 86, 360, 76, 360, 106],
    );
    const cg = ctx.createLinearGradient(0, 100, 0, 200);
    cg.addColorStop(0, ICE);
    cg.addColorStop(0.3, ICE_D);
    cg.addColorStop(1, DEEP);
    ctx.fillStyle = cg;
    ctx.fillRect(110, 98, 100, 110);
    poly(ctx, '#7F9CB8', [-40, 104, 122, 104, 126, 130, 132, 170, 134, 210, -40, 210]);
    poly(ctx, '#7F9CB8', [198, 100, 360, 100, 360, 210, 186, 210, 190, 160, 194, 124]);
    for (let i = 0; i < 7; i++) {
      const y = 112 + i * 13;
      line(ctx, alpha('#5E7C9C', 0.7), 1, [-40, y, 124 + i * 1.4, y + 1]);
      line(ctx, alpha('#5E7C9C', 0.7), 1, [194 - i * 1.2, y - 2, 360, y - 3]);
    }
    box(ctx, -40, 100, 162, 5, '#E4ECF4');
    box(ctx, 198, 96, 162, 5, '#E4ECF4');
    for (let i = 0; i < 5; i++) {
      poly(ctx, alpha('#DDF0FF', 0.8), [
        124 + i * 2,
        110 + i * 9,
        127 + i * 2,
        110 + i * 9,
        125.5 + i * 2,
        118 + i * 9,
      ]);
      poly(ctx, alpha('#DDF0FF', 0.8), [
        192 - i * 2,
        106 + i * 9,
        195 - i * 2,
        106 + i * 9,
        193.5 - i * 2,
        114 + i * 9,
      ]);
    }
    const top: number[] = [],
      bottom: number[] = [];
    for (let i = 0; i <= 10; i++) {
      const x = lerp(BRIDGE.x0, BRIDGE.x1, i / 10);
      const y = bridgeTop(x, S);
      top.push(x, y);
      bottom.unshift(x, y + 5 - Math.sin((i / 10) * Math.PI) * 2.2);
    }
    poly(
      ctx,
      '#9CB4CC',
      [...top, ...bottom].map((v, i) => (i % 2 ? v + 1 : v)),
    );
    poly(ctx, '#E8EFF6', [...top, ...bottom]);
    if (S > HAIRLINE) {
      const k = ease(span(S, HAIRLINE, 61.5));
      line(ctx, '#3A5270', 0.8, [
        158,
        bridgeTop(158, S),
        160,
        bridgeTop(160, S) + 2 * k,
        157,
        bridgeTop(157, S) + 4 * k,
      ]);
    }
    const tx = theoBridgeX(S);
    const ph = Math.max(0, S - 56.5) * THEO_RATE * TAU;
    const limp = Math.max(0, Math.sin(ph)) * 1.2;
    const theoPose = {
      ...walk(ph, 0.7, 0.14),
      hands: [
        [4, -12],
        [7, -10],
      ] as const,
    };
    const ty = bridgeTop(tx, S) + limp;
    const ines = kneel(-0.25, [
      [-9, -22],
      [-6, -20],
    ]);
    const inesPose: Pose = { ...walk(0, 0, -0.18), hands: ines.hands, lamp: 1, tilt: 0.25 };
    const hands: P = [238 - -7.5 * -2, 96 - 21 * 2];
    line(ctx, ROPE, 1.2, [
      tx + 1.8 * 2,
      ty - 20 * 1.8,
      lerp(tx, hands[0], 0.5),
      (ty + 96) / 2 - 12,
      hands[0],
      hands[1],
    ]);
    figure(ctx, tx, ty, 1.8, THEO, theoPose, { dark: 0.3, night: '#1A2232' });
    figure(ctx, 238, 96, 2, INES, inesPose, { facing: -1, dark: 0.3, night: '#1A2232' });
    const [lx, ly] = lensAt(238, 96, 2, inesPose, -1);
    beam(ctx, lx, ly, aim(0.35, -1), 110, 0.22, 0.7);
  });
  snowfall(ctx, sec, { amount: 0.5, speed: 20, drift: -3, color: alpha(SNOW, 0.7), seed: 101 });
}

type Chunk = { x: number; y: number; w: number; spin: number; drift: number };
const CHUNKS: readonly Chunk[] = [
  { x: 124, y: 38, w: 16, spin: -1.3, drift: -1.6 },
  { x: 146, y: 42, w: 13, spin: 1.1, drift: -0.6 },
  { x: 174, y: 42, w: 14, spin: -0.8, drift: 0.8 },
  { x: 198, y: 38, w: 16, spin: 1.5, drift: 1.6 },
];
function underShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const shake = jolt(S, CRACK, 2) + jolt(S, BREAK, 4);
  ctx.save();
  ctx.translate(shake * 0.5, shake);
  // Looking straight up from the blue: two ice walls climbing to a slot of storm.
  const bg = ctx.createLinearGradient(0, -20, 0, 200);
  bg.addColorStop(0, '#9CCBE8');
  bg.addColorStop(0.3, '#3C7CAC');
  bg.addColorStop(1, '#06101E');
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  gradient(ctx, -20, 40, ['#3A465C', '#5A677E'], 112, 96);
  const wall = (side: -1 | 1, color: string) => {
    const e = (x: number) => 160 + side * x;
    poly(ctx, color, [
      e(46),
      -20,
      e(44),
      30,
      e(60),
      80,
      e(96),
      130,
      e(150),
      200,
      e(200),
      200,
      e(200),
      -20,
    ]);
  };
  wall(-1, '#4A88B4');
  wall(1, '#3C78A6');
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    const x0 = 160 + side * (50 + i * 11);
    line(ctx, alpha('#CDEBFA', 0.25 + rand(i) * 0.2), 1 + (i % 3), [
      160 + side * (44 + rand(i) * 4),
      -10,
      x0,
      200,
    ]);
  }
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const y = 60 + rand(i * 2.3) * 120;
    oval(ctx, 160 + side * (70 + rand(i * 5.1) * 80), y, 3, 5, alpha('#DDF2FF', 0.3));
  }
  glow(ctx, 160, 30, 110, '#CFE8F8', 0.4);
  const broken = S >= BREAK;
  if (!broken) {
    // The bridge from underneath: thin enough that Theo's boots show through as shadows.
    const sag = 2 + ease(span(S, 61.5, BREAK)) * 3;
    poly(ctx, '#D8EAF6', [108, 30, 160, 34 + sag, 212, 30, 212, 44, 160, 50 + sag, 108, 44]);
    poly(ctx, alpha('#FFFFFF', 0.5), [
      120,
      34,
      160,
      37 + sag,
      200,
      34,
      196,
      38,
      160,
      41 + sag,
      124,
      38,
    ]);
    const tw = S > CRACK ? Math.sin(sec * 40) * 0.5 : 0;
    oval(ctx, 153 + tw, 42 + sag, 4, 7, alpha('#2A3A52', 0.45));
    oval(ctx, 166 + tw, 41 + sag, 4, 7, alpha('#2A3A52', 0.45));
    const crack = ease(span(S, CRACK, BREAK));
    if (crack > 0) {
      line(ctx, '#2A4260', 1, [160, 48 + sag, 160 - 28 * crack, 44, 160 - 46 * crack, 46]);
      line(ctx, '#2A4260', 1, [160, 48 + sag, 160 + 24 * crack, 43, 160 + 42 * crack, 45]);
      line(ctx, '#2A4260', 0.8, [150, 46 + sag, 146 - 10 * crack, 36]);
    }
    for (let i = 0; i < 10; i++) {
      const t = ((S - CRACK) * 1.4 + rand(i)) % 1;
      if (S > CRACK) box(ctx, 124 + rand(i * 3.3) * 72, 48 + t * 150, 1.5, 1.5, alpha(SNOW, 1 - t));
    }
  } else {
    const t = S - BREAK;
    const tx = 160 + t * 12,
      ty = 40 + t * t * 120;
    line(ctx, ROPE, 1.6, [214, -10, tx, ty]);
    const ts = 1.5 + t * t * 6;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(t * 1.2);
    ctx.scale(ts, ts);
    // Falling toward us, seen from below: boots first, arms thrown up.
    line(ctx, '#3B4352', 3.4, [-2, 2, -5, 12]);
    line(ctx, '#3B4352', 3.4, [2, 2, 6, 11]);
    oval(ctx, -5, 13, 2.4, 1.8, '#3A2E26');
    oval(ctx, 6, 12, 2.4, 1.8, '#3A2E26');
    oval(ctx, 0, -4, 6, 7, ORANGE);
    line(ctx, ORANGE_D, 2.6, [-4, -7, -10, -14]);
    line(ctx, ORANGE_D, 2.6, [4, -7, 9, -15]);
    disc(ctx, -10, -15, 1.6, OLIVE);
    disc(ctx, 9, -16, 1.6, OLIVE);
    disc(ctx, 0, -12, 3.6, BEANIE);
    ctx.restore();
    for (const ch of CHUNKS) {
      const s = 1 + t * t * 9;
      ctx.save();
      ctx.translate(ch.x + (ch.x - 160) * t * 1.8 + ch.drift * t * 20, ch.y + t * 30 + t * t * 140);
      ctx.rotate(t * ch.spin);
      ctx.scale(s, s);
      poly(ctx, '#9CB4CC', [
        -ch.w / 2,
        -3,
        ch.w / 2,
        -4,
        ch.w / 2 + 2,
        2,
        ch.w / 4,
        5,
        -ch.w / 2,
        4,
      ]);
      poly(ctx, '#E8EFF6', [-ch.w / 2, -3, ch.w / 2, -4, ch.w / 2, 0, -ch.w / 2, 1]);
      ctx.restore();
    }
  }
  ctx.restore();
}

const slid = (S: number) => {
  if (S < TAUT + 0.2) return 0;
  const run = Math.min(S, ARREST) - (TAUT + 0.2);
  const after = Math.max(0, S - ARREST);
  return run * 45 + (45 / 0.9) * (1 - Math.exp(-0.9 * after));
};
function dragShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const surf = (x: number) => 124 - (x - 40) * 0.05;
  const ix = 222 - slid(S);
  const pan = clamp((222 - ix) * 0.5, 0, 50);
  const shake = jolt(S, TAUT, 3);
  ctx.save();
  ctx.translate(pan, shake);
  gradient(ctx, -20, 130, ['#101826', '#1E2838', '#34405A'], -80, W + 200);
  cloudBank(ctx, sec, 200 - c.t * 12, 40, 400, '#2A3446', 0.5, 23);
  const cg = ctx.createLinearGradient(0, 124, 0, 200);
  cg.addColorStop(0, ICE_D);
  cg.addColorStop(1, DEEP);
  ctx.fillStyle = cg;
  ctx.fillRect(-120, 122, 162, 90);
  poly(ctx, '#7F9CB8', [-120, 118, -60, 118, -58, 200, -120, 200]);
  box(ctx, -120, 114, 60, 5, '#DCE6F0');
  const sg = ctx.createLinearGradient(0, 110, 0, 190);
  sg.addColorStop(0, '#DCE6F0');
  sg.addColorStop(1, '#7E90AC');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(40, surf(40));
  ctx.lineTo(420, surf(420));
  ctx.lineTo(420, 210);
  ctx.lineTo(36, 210);
  ctx.closePath();
  ctx.fill();
  poly(ctx, '#EEF3F8', [30, 123, 46, 121, 48, 125, 34, 127]);
  for (let i = 0; i < 5; i++)
    poly(ctx, alpha('#DDF0FF', 0.8), [
      36 + i * 1.2,
      126 + i * 10,
      39 + i * 1.2,
      126 + i * 10,
      37 + i * 1.2,
      134 + i * 10,
    ]);
  if (S > ARREST) {
    const ax = 222 - slid(ARREST) - 22 * 1.9;
    const nx = ix - 22 * 1.9;
    line(ctx, alpha('#5E7090', 0.8), 2, [ax, surf(ax) + 1, nx, surf(nx) + 1]);
  }
  const fall = ease(span(S, TAUT, TAUT + 0.45));
  const braced: Pose = {
    ...walk(0, 0.4, -0.2),
    lamp: 1,
    tilt: 0.3,
    hands: [
      [-4, -24],
      [-2, -22],
    ],
  };
  const arrest = ease(span(S, ARREST - 0.3, ARREST));
  const prone: Pose = { ...PRONE, axe: lerp(-0.8, 1.2, arrest) };
  const pose = mixPose(braced, prone, fall);
  const iy = surf(ix);
  const hip: P = [ix - pose.hip[0] * 1.9, iy + pose.hip[1] * 1.9];
  line(ctx, ROPE, 1.4, [hip[0], hip[1], 42, surf(42), 38, 150]);
  figure(ctx, ix, iy, 1.9, INES, pose, { facing: -1, dark: 0.3, night: '#1A2232' });
  if (S > TAUT + 0.3)
    for (let i = 0; i < 16; i++) {
      const t = (sec * 2.4 + i / 16) % 1;
      const speed = S < ARREST ? 1 : Math.exp(-0.9 * (S - ARREST));
      box(
        ctx,
        ix + 20 + t * 40 * speed,
        iy - 2 - Math.sin(t * Math.PI) * 10 * speed,
        1.5,
        1.5,
        alpha(SNOW, 0.8 * (1 - t)),
      );
    }
  ctx.restore();
  gale(ctx, sec, { amount: 1, speed: 210, length: 6, color: alpha(SNOW, 0.45), seed: 111 });
}

function strainShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const speed = 1 - ease(span(S, 66, HOLD + 0.2));
  const [jx, jy] = tremor(sec, 1.4 * speed);
  ctx.save();
  ctx.translate(jx, jy);
  gradient(ctx, -10, 50, ['#141C28', '#26303F', '#3A465A']);
  gradient(ctx, 46, H + 10, ['#6E7E96', '#A8B6C8', '#D6DEE8']);
  for (let i = 0; i < 26; i++) {
    const t = (rand(i * 3.3) + sec * 1.6 * speed) % 1;
    const y = 48 + t * t * 150;
    const x = 160 + (rand(i * 7.1) - 0.5) * (40 + t * t * 500);
    box(ctx, x, y, 1 + t * 6, 1, alpha('#5E6E88', 0.5));
  }
  const z = 2 + c.k * 0.22;
  face(
    ctx,
    'ines',
    174,
    84,
    z,
    {
      turn: 0.12,
      tilt: -0.12,
      lid: 0.82,
      worry: -0.8,
      brow: -0.3,
      mouth: 'grit',
      lamp: 1,
      frost: 1,
      rimL: alpha('#C9D8EA', 0.7),
      shade: 0.2,
    },
    sec,
  );
  glow(ctx, 174 + 2 * z, 84 - 25 * z, 60, LAMP, 0.3);
  // Both fists on the head of the axe, its pick ploughing the snow in front of her.
  line(ctx, RED_D, 28, [84, 206, 104, 166]);
  line(ctx, RED, 28, [236, 206, 206, 164]);
  line(ctx, METAL, 8, [70, 166, 206, 160]);
  line(ctx, '#7E8A98', 3, [72, 169.5, 204, 163.5]);
  poly(ctx, METAL, [72, 161, 58, 170, 50, 188, 62, 190, 70, 174, 78, 168]);
  poly(ctx, METAL, [200, 156, 222, 148, 226, 158, 206, 164]);
  mitt(ctx, 110, 160, 2.3, 0.1, GLOVE, RED_D);
  mitt(ctx, 190, 156, 2.3, Math.PI - 0.1, GLOVE, RED);
  for (let i = 0; i < 22; i++) {
    const t = (sec * 2.8 + i / 22) % 1;
    const a = -Math.PI * (0.15 + rand(i * 2.1) * 0.7);
    const v = (50 + rand(i) * 90) * (0.3 + 0.7 * speed);
    box(
      ctx,
      54 + Math.cos(a) * v * t,
      182 + Math.sin(a) * v * t + 70 * t * t,
      2,
      2,
      alpha(SNOW, 0.9 * (1 - t) * (0.2 + 0.8 * speed)),
    );
  }
  ctx.restore();
}

function grooveShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const k = easeOut(span(S, 68.5, HOLD));
  const px = lerp(318, 108, k);
  const moving = S < HOLD ? 1 - k : 0;
  const [jx, jy] = tremor(sec, 1.2 * moving);
  ctx.save();
  ctx.translate(jx, jy);
  gradient(ctx, -10, 130, ['#101826', '#222C3E', '#3A4660']);
  const cg = ctx.createLinearGradient(0, 128, 0, 190);
  cg.addColorStop(0, ICE_D);
  cg.addColorStop(1, DEEP);
  ctx.fillStyle = cg;
  ctx.fillRect(-20, 126, 88, 70);
  poly(ctx, '#7F9CB8', [-20, 120, 8, 120, 10, 190, -20, 190]);
  box(ctx, -20, 116, 28, 5, '#DCE6F0');
  const snow = () => {
    const sg = ctx.createLinearGradient(0, 128, 0, 184);
    sg.addColorStop(0, '#E4ECF4');
    sg.addColorStop(1, '#8A9CB6');
    ctx.fillStyle = sg;
  };
  snow();
  ctx.fillRect(64, 132, 280, 60);
  poly(ctx, '#EEF3F8', [56, 131, 72, 129, 74, 134, 60, 135]);
  line(ctx, ROPE, 1.8, [340, 136, 66, 133, 62, 184]);
  // The axe side on: shaft low along the snow under her, pick driven down, adze up.
  line(ctx, RED_D, 13, [px + 104, 106, px + 260, 100]);
  line(ctx, '#2F4460', 5, [px + 4, 118, px + 150, 108]);
  line(ctx, alpha('#8FA8C8', 0.6), 1, [px + 10, 116, px + 146, 106]);
  line(ctx, '#15181E', 6, [px + 118, 109, px + 152, 107.5]);
  poly(ctx, '#7E8A98', [px - 7, 113, px + 8, 112, px + 9, 123, px - 7, 124]);
  poly(ctx, METAL, [px - 6, 112, px + 7, 111, px + 13, 97, px + 1, 95]);
  box(ctx, px + 1, 94, 13, 2, '#E8EDF2');
  poly(ctx, METAL, [px - 7, 122, px + 7, 122, px + 3, 137, px - 4, 150, px - 10, 152, px - 6, 137]);
  for (let i = 0; i < 3; i++)
    poly(ctx, '#7E8A98', [
      px - 1 - i,
      127 + i * 6,
      px - 5 - i,
      129 + i * 6,
      px - 1 - i,
      131 + i * 6,
    ]);
  snow();
  ctx.fillRect(px - 30, 132, 60, 60);
  line(ctx, alpha('#46587A', 0.9), 3, [px + 8, 134, 330, 134]);
  line(ctx, alpha('#FFFFFF', 0.8), 1, [px + 8, 131.5, 330, 131.5]);
  oval(ctx, px - 8, 132, 10 + 8 * moving, 2.5 + 3 * moving, '#F4F7FA');
  line(ctx, RED, 14, [px + 40, 117, px + 250, 110]);
  mitt(ctx, px + 30, 116, 1.7, Math.PI + 0.06, GLOVE, RED);
  mitt(ctx, px + 100, 109, 1.7, Math.PI + 0.07, GLOVE, RED_D);
  if (moving > 0.02)
    for (let i = 0; i < 18; i++) {
      const t = (sec * 3 + i / 18) % 1;
      const sa = -Math.PI * (0.55 + rand(i * 2.1) * 0.4);
      const v = (40 + rand(i) * 70) * moving;
      box(
        ctx,
        px - 6 + Math.cos(sa) * v * t,
        130 + Math.sin(sa) * v * t + 80 * t * t,
        2,
        2,
        alpha(SNOW, 0.9 * (1 - t)),
      );
    }
  if (S > HOLD + 0.3)
    for (let i = 0; i < 4; i++) {
      const t = (S - HOLD - 0.3 - i * 0.2) * 1.4;
      if (t > 0 && t < 1) box(ctx, 60 + i * 3, 133 + t * t * 60, 2, 2, alpha(SNOW, 1 - t));
    }
  ctx.restore();
  gale(ctx, sec, { amount: 0.7, speed: 200, length: 6, color: alpha(SNOW, 0.4), seed: 121 });
}

function dangleShot(ctx: Ctx, c: Cut) {
  const sec = c.sec;
  gradient(ctx, -10, H + 10, ['#6E9CC0', '#2C5A80', '#123050', '#06101E']);
  poly(ctx, '#4A86B2', [-10, -10, 112, -10, 104, 40, 96, 100, 84, 190, -10, 190]);
  poly(ctx, '#3A76A2', [330, -10, 212, -10, 222, 40, 230, 100, 244, 190, 330, 190]);
  for (let i = 0; i < 8; i++) {
    line(ctx, alpha('#CDEBFA', 0.35), 1, [100 - i * 12, -10, 80 - i * 16, 190]);
    line(ctx, alpha('#CDEBFA', 0.3), 1, [220 + i * 12, -10, 240 + i * 16, 190]);
  }
  gradient(ctx, -10, 18, ['#2A3446', '#4A566C'], 112, 100);
  poly(ctx, '#E4ECF4', [196, 12, 222, 10, 222, 18, 198, 20]);
  glow(ctx, 162, 0, 110, '#DDEEFA', 0.4);
  const sway = Math.sin(sec * 1.1) * 4;
  const hx = 160 + sway,
    hy = 110;
  line(ctx, ROPE, 1.5, [204, 16, hx, hy - 2]);
  const hang: Pose = {
    hip: [0, 0],
    sh: [1, -14],
    head: [2, -20],
    feet: [
      [-2, 20],
      [5, 16],
    ],
    hands: [
      [1, -24],
      [3, -19],
    ],
    knees: [1, 1],
    elbows: [1, 1],
    tilt: -0.5,
  };
  figure(ctx, hx, hy, 2.3, THEO, hang, {
    facing: Math.sin(sec * 0.55) > 0 ? 1 : -1,
    dark: 0.35,
    night: '#0E2238',
  });
  for (let i = 0; i < 12; i++) {
    const t = (sec * 0.7 + rand(i * 2.9)) % 1;
    box(ctx, 120 + rand(i * 5.1) * 90, t * 190, 1.5, 1.5, alpha(SNOW, 0.7 * (1 - t)));
  }
}

function haulShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  let rise = 0;
  for (const h of HAULS) rise += ease(span(S, h - 0.35, h)) * 14;
  const out = ease(span(S, GRAB, OUT));
  gradient(ctx, -10, 110, ['#101826', '#1E2838', '#34405A']);
  const cg = ctx.createLinearGradient(0, 100, 0, 190);
  cg.addColorStop(0, ICE_D);
  cg.addColorStop(1, DEEP);
  ctx.fillStyle = cg;
  ctx.fillRect(20, 98, 100, 92);
  poly(ctx, '#7F9CB8', [-20, 96, 26, 96, 30, 190, -20, 190]);
  box(ctx, -20, 92, 46, 5, '#DCE6F0');
  poly(ctx, '#7F9CB8', [118, 100, 340, 98, 340, 190, 124, 190]);
  for (let i = 0; i < 6; i++)
    line(ctx, alpha('#5E7C9C', 0.7), 1, [120 + i, 110 + i * 13, 340, 108 + i * 13]);
  box(ctx, 116, 94, 230, 6, '#E4ECF4');
  poly(ctx, '#EEF3F8', [110, 95, 124, 93, 126, 98, 114, 99]);
  line(ctx, '#34465E', 3, [176, 70, 176, 100]);
  box(ctx, 170, 68, 12, 3, METAL);
  // Theo, coming up out of the blue.
  const tIn: P = [106, 172 - rise];
  const tOut: P = [150, 96];
  const tp = lp(tIn, tOut, out);
  const hang: Pose = {
    hip: [0, 0],
    sh: [2, -14],
    head: [4, -20],
    feet: [
      [-3, 20],
      [4, 17],
    ],
    hands: [
      [6, -24],
      [8, -20],
    ],
    elbows: [1, 1],
    tilt: -0.4,
  };
  const lying: Pose = {
    ...PRONE,
    lamp: 0,
    hands: [
      [24, -2],
      [22, -3],
    ],
    tilt: 0.2,
  };
  const tpose = mixPose(hang, lying, out);
  line(ctx, ROPE, 1.4, [tp[0] + 2, tp[1] - 2, 120, 96, 176, 92, 196, 80]);
  figure(ctx, tp[0], tp[1] + out * 2, 1.9, THEO, tpose, { dark: 0.3, night: '#1A2232' });
  // Ines: hand over hand, then the grab, then over backwards.
  const cyc = HAULS.reduce((n, h) => n + (S > h - 0.35 ? 1 : 0), 0);
  const pulling = HAULS.some((h) => S > h - 0.35 && S < h);
  const reachFwd = (a: number): readonly [P, P] =>
    a % 2
      ? [
          [12, -16],
          [4, -22],
        ]
      : [
          [4, -22],
          [12, -16],
        ];
  const grab = ease(span(S, GRAB - 0.3, GRAB));
  const base = kneel(lerp(0.35, 0.2, pulling ? 1 : 0), reachFwd(cyc));
  const lunge: Pose = kneel(0.9, [
    [22, -8],
    [23, -9],
  ]);
  const back: Pose = {
    ...supine(0.6),
    feet: [
      [10, -2],
      [14, -1],
    ],
  };
  let pose = mixPose(base, lunge, grab);
  pose = mixPose(
    pose,
    {
      ...back,
      hands: [
        [-2, -10],
        [0, -12],
      ],
    },
    ease(span(S, GRAB + 0.2, OUT + 0.2)) * 0.6,
  );
  figure(ctx, 204, 96, 1.9, INES, pose, { facing: -1, dark: 0.25, night: '#1A2232' });
  const [lx, ly] = lensAt(204, 96, 1.9, pose, -1);
  beam(ctx, lx, ly, aim((pose.tilt ?? 0) + 0.3, -1), 90, 0.22, 0.6);
  gale(ctx, sec, { amount: 0.7, speed: 190, length: 6, color: alpha(SNOW, 0.4), seed: 131 });
}

function breathShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const rumble = ease(span(S, RUMBLE, 80.5));
  const [jx, jy] = tremor(sec, 0.5 * rumble);
  ctx.save();
  ctx.translate(jx, jy);
  gradient(ctx, -10, 130, ['#131B28', '#26303F', '#3E4A60']);
  cloudBank(ctx, sec, 160, 20, 400, '#1E2634', 0.5, 29);
  poly(ctx, '#A8B6CA', [80, 130, 360, -10, 360, 130]);
  poly(ctx, '#C8D2E0', [180, 80, 360, -10, 360, 20, 260, 60]);
  poly(ctx, '#EEF3F8', [300, 18, 360, -12, 360, 2, 320, 20]);
  poly(ctx, '#8E9CB4', [-20, 130, 360, 124, 360, 200, -20, 200]);
  gradient(ctx, 136, 200, ['#C4CEDC', '#E4EAF2'], -20, 360);
  const lift = ease(span(S, 79.7, 80.4));
  figure(
    ctx,
    110,
    150,
    1.7,
    THEO,
    { ...supine(0), lamp: 0, tilt: -1.45 },
    { dark: 0.3, night: '#1A2232' },
  );
  const ip = supine(lift);
  figure(ctx, 214, 152, 1.7, INES, ip, { dark: 0.25, night: '#1A2232' });
  breath(ctx, 110 - 20 * 1.7 + 2, 150 - 9 * 1.7 - 4, sec, -0.3, 1, 0.3);
  breath(ctx, 214 - 20 * 1.7 + 3, 152 - 9 * 1.7 - 4, sec, 0.3, 1, 0);
  const [lx, ly] = lensAt(214, 152, 1.7, ip);
  beam(ctx, lx, ly, (ip.tilt ?? 0) - 0.1, 90, 0.22, 0.6);
  if (rumble > 0)
    for (let i = 0; i < 20; i++) {
      const x = rand(i * 3.7) * W;
      box(
        ctx,
        x,
        160 + rand(i * 1.3) * 20 - Math.abs(Math.sin(sec * 30 + i)) * 2 * rumble,
        1,
        1,
        alpha('#FFFFFF', 0.8),
      );
    }
  ctx.restore();
  snowfall(ctx, sec, { amount: 0.4, speed: 12, drift: -2, color: alpha(SNOW, 0.7), seed: 141 });
}

function lookShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const dawn = ease(span(S, 80.6, 81.4));
  const [jx, jy] = tremor(sec, 0.6 + 1.2 * c.k);
  ctx.save();
  ctx.translate(jx, jy);
  gradient(ctx, -10, H + 10, ['#1A2230', '#2A3446', '#46526A']);
  gradient(ctx, 150, H + 10, ['#8E9CB4', '#C4CEDC'], -20, 360);
  face(
    ctx,
    'ines',
    166,
    108,
    2.3 + c.k * 0.25,
    {
      tilt: -0.12,
      look: [lerp(0, -0.25, dawn), lerp(0.2, -1, dawn)],
      lid: lerp(0.3, 0, dawn),
      wide: dawn,
      brow: lerp(0, 0.9, dawn),
      worry: 0.3 * dawn,
      mouth: dawn > 0.5 ? 'part' : 'breath',
      lamp: 1,
      frost: 1,
      rimL: alpha('#C9D8EA', 0.6),
      shade: 0.2,
    },
    sec,
  );
  ctx.restore();
  snowfall(ctx, sec, { amount: 0.5, speed: 14, drift: -2, color: alpha(SNOW, 0.8), seed: 151 });
}

/** The avalanche, from its wavy front edge upward. */
function avalanche(ctx: Ctx, front: number, sec: number) {
  const pts = [-40, -30, 360, -30];
  for (let i = 12; i >= 0; i--)
    pts.push(-40 + i * 33.3, front + Math.sin(i * 1.7 + sec * 2) * 6 + rand(i) * 8);
  poly(ctx, '#C6D2E0', pts);
  // Churn inside the mass, rolling as it comes.
  for (let row = 3; row >= 1; row--)
    for (let i = 0; i < 9; i++) {
      const x = -20 + i * 44 + rand(i * 5 + row) * 20 + Math.sin(sec * 0.9 + i + row) * 5;
      const y = front - row * 30 + Math.sin(sec * 1.3 + i * 1.7) * 4;
      const r = 22 + rand(i * 3.1 + row) * 18;
      oval(ctx, x + 3, y + r * 0.35, r, r * 0.62, alpha('#8E9EB6', 0.6));
      oval(ctx, x, y, r, r * 0.62, alpha(row === 1 ? '#E4EAF2' : '#D4DDE8', 0.95));
    }
  for (let i = 0; i < 16; i++) {
    const x = -30 + i * 24 + Math.sin(sec * 0.8 + i) * 4;
    const y = front - 4 + rand(i * 2.1) * 10 + Math.sin(sec * 1.7 + i * 2) * 3;
    const r = 16 + rand(i * 3.3) * 18;
    oval(ctx, x + 2, y + 6, r, r * 0.75, '#94A6BE');
    oval(ctx, x, y, r, r * 0.75, '#EEF3F8');
  }
  for (let i = 0; i < 10; i++) {
    const t = (sec * 0.8 + i / 10) % 1;
    oval(
      ctx,
      -20 + rand(i * 7.3) * 360,
      front + 10 + t * 30,
      20 + t * 20,
      8 + t * 6,
      alpha('#FFFFFF', 0.3 * (1 - t)),
    );
  }
}
function wallShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const k = span(S, 82.5, 86.1);
  const front = lerp(-2, 150, k * 0.45 + easeIn(k) * 0.55);
  const [jx, jy] = tremor(sec, 0.5 + 2 * k);
  ctx.save();
  ctx.translate(jx, jy);
  gradient(ctx, -10, 40, ['#141C28', '#26303F']);
  const sg = ctx.createLinearGradient(0, 20, 0, 190);
  sg.addColorStop(0, '#8E9CB4');
  sg.addColorStop(1, '#D6DEE8');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(-40, 34);
  ctx.lineTo(360, 14);
  ctx.lineTo(360, 200);
  ctx.lineTo(-40, 200);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 10; i++) {
    const y = 40 + i * 14;
    line(ctx, alpha('#FFFFFF', 0.3), 1, [-20 + rand(i) * 40, y, 300 + rand(i * 2) * 40, y - 8]);
  }
  avalanche(ctx, front, sec);
  poly(ctx, ROCK, [214, 170, 222, 138, 240, 124, 268, 128, 286, 146, 292, 172]);
  poly(ctx, ROCK_L, [222, 138, 240, 124, 252, 126, 236, 142]);
  poly(ctx, '#E4ECF4', [224, 136, 240, 122, 268, 126, 246, 128]);
  const run = span(S, 82.8, 86.1);
  const ix = lerp(96, 206, run),
    tx = ix - 26;
  const ph = S * 1.9 * TAU;
  // She hauls him along by the wrist, his bad foot barely touching down.
  figure(
    ctx,
    tx,
    172,
    1.25,
    THEO,
    {
      ...walk(ph + 1, 0.7, 0.32),
      hands: [
        [4, -14],
        [11, -24],
      ],
      tilt: -0.1,
    },
    { dark: 0.35, night: '#3A4660' },
  );
  figure(
    ctx,
    ix,
    172,
    1.25,
    INES,
    {
      ...walk(ph, 1.1, 0.38),
      hands: [
        [-10, -24],
        [9, -19],
      ],
      elbows: [1, -1],
      lamp: 1,
      tilt: 0.05,
    },
    { dark: 0.25, night: '#3A4660' },
  );
  ctx.restore();
  gale(ctx, sec, {
    amount: 0.8 + k,
    speed: 180,
    fall: 0.3,
    length: 5,
    color: alpha('#FFFFFF', 0.5),
    seed: 161,
  });
}

function diveShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const shake = jolt(S, HIT, 5, 3);
  const [jx, jy] = tremor(sec, 1 + 2 * span(S, 86, HIT));
  ctx.save();
  ctx.translate(jx + shake * 0.4, jy + shake);
  gradient(ctx, -10, 150, ['#5A667C', '#8C98AE', '#B8C4D4']);
  avalanche(ctx, lerp(40, 80, span(S, 86, HIT)), sec);
  gradient(ctx, 146, H + 10, ['#C4CEDC', '#E4EAF2'], -20, 360);
  poly(ctx, ROCK, [160, 160, 170, 100, 196, 70, 236, 62, 280, 70, 320, 96, 340, 160]);
  poly(ctx, ROCK_L, [170, 100, 196, 70, 236, 62, 220, 84, 190, 104]);
  poly(ctx, '#E4ECF4', [180, 84, 196, 68, 236, 60, 262, 64, 230, 70, 200, 76]);
  const dive = ease(span(S, 86.05, 86.7));
  const ix = lerp(80, 136, dive),
    tx = lerp(60, 126, dive);
  const tpose = mixPose({ ...walk(S * 11, 0.8, 0.3) }, { ...PRONE, lamp: 0 }, dive);
  figure(ctx, tx, 156, 1.6, THEO, tpose, { dark: 0.3, night: '#3A4660' });
  const ipose = mixPose(
    { ...walk(S * 11 + 2, 1, 0.4), lamp: 1 },
    {
      ...PRONE,
      hands: [
        [18, -6],
        [20, -8],
      ],
    },
    dive,
  );
  figure(ctx, ix, 152, 1.6, INES, ipose, { dark: 0.25, night: '#3A4660' });
  const pour = ease(span(S, 86.7, HIT + 0.5));
  if (pour > 0) {
    // Powder pouring over the top of the rock and on over them.
    const edge = lerp(330, -80, pour);
    const pts = [360, 40, 360, -30, edge, -30];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      pts.push(lerp(edge, 360, u), 40 + Math.sin(i * 2.1 + sec * 3) * 6 + (1 - u) * 50 * pour);
    }
    poly(ctx, '#DCE4EE', pts);
    for (let i = 0; i < 24; i++) {
      const u = rand(i * 3.1);
      const x = lerp(edge, 340, u) + Math.sin(sec * 2 + i) * 4;
      const y = 44 + rand(i * 5.3) * 40 + (1 - u) * 44 * pour + Math.sin(sec * 1.5 + i) * 3;
      const r = 8 + rand(i * 7.7) * 22;
      oval(ctx, x + 2, y + r * 0.35, r * 1.5, r * 0.6, alpha('#9EAEC4', 0.55));
      oval(ctx, x, y, r * 1.5, r * 0.6, alpha('#F2F6FA', 0.9));
    }
    for (let i = 0; i < 16; i++) {
      const x = edge - 10 + rand(i * 2.7) * 70,
        y = 60 + rand(i * 4.9) * 70;
      line(ctx, alpha('#FFFFFF', 0.5), 1, [x, y, x + 24 + rand(i) * 30, y - 6]);
    }
  }
  ctx.restore();
  gale(ctx, sec, {
    amount: 1.6,
    speed: 240,
    fall: 0.35,
    length: 7,
    color: alpha('#FFFFFF', 0.6),
    seed: 171,
  });
}

function buriedShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  gradient(ctx, -10, 140, ['#7E8AA0', '#A4AEC0', '#C4CCD8']);
  poly(ctx, '#B4BECE', [-20, 104, 120, 76, 330, 44, 340, 130, -20, 130]);
  poly(ctx, ROCK, [196, 150, 204, 92, 226, 66, 262, 58, 302, 68, 336, 92, 350, 150]);
  poly(ctx, ROCK_L, [204, 92, 226, 66, 262, 58, 246, 80, 216, 98]);
  poly(ctx, '#EEF3F8', [210, 80, 226, 64, 262, 56, 290, 62, 256, 68, 228, 74]);
  // The new snow: one smooth drift filling the lee of the rock.
  const drift = (x: number) => 130 + Math.sin(x * 0.014 + 0.6) * 7 - Math.max(0, x - 170) * 0.12;
  const pts: number[] = [];
  for (let x = -20; x <= 340; x += 20) pts.push(x, drift(x));
  const mound = ctx.createLinearGradient(0, 116, 0, 190);
  mound.addColorStop(0, '#F6F8FB');
  mound.addColorStop(1, '#C4CEDC');
  ctx.fillStyle = mound;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2)
    if (i) ctx.lineTo(pts[i], pts[i + 1]);
    else ctx.moveTo(pts[i], pts[i + 1]);
  ctx.lineTo(340, 200);
  ctx.lineTo(-20, 200);
  ctx.closePath();
  ctx.fill();
  const punch = easeOut(span(S, PUNCH, PUNCH + 0.35));
  const up = ease(span(S, SURFACE - 0.2, SURFACE + 0.7));
  const dig = ease(span(S, 91.7, 92.2));
  const theo = ease(span(S, THEO_UP - 0.1, THEO_UP + 0.6));
  // Everything that comes up out of the snow is clipped at its surface.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-20, -20);
  for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1] + 4);
  ctx.lineTo(340, -20);
  ctx.closePath();
  ctx.clip();
  if (theo > 0)
    face(
      ctx,
      'theo',
      104,
      lerp(172, 116, theo),
      0.8,
      {
        lid: 0.6,
        look: [0.7, -0.2],
        worry: 0.6,
        mouth: S > COUGH && S < COUGH + 0.8 ? 'open' : 'breath',
        frost: 1,
        shade: 0.15,
      },
      sec,
    );
  if (up > 0)
    face(
      ctx,
      'ines',
      158,
      lerp(180, 104, up),
      0.95,
      {
        lid: lerp(0.7, 0.4, up),
        look: [lerp(0, -0.8, dig), 0.3],
        turn: -0.25 * dig,
        mouth: S > SURFACE && S < SURFACE + 0.9 ? 'open' : 'breath',
        lamp: 0.6,
        frost: 1,
        shade: 0.15,
        tilt: -0.08,
      },
      sec,
    );
  if (punch > 0) {
    const hx = lerp(192, 134, dig),
      hy = lerp(lerp(150, 100, punch), 132, dig);
    line(ctx, RED, 11, [lerp(186, 150, dig), 142, hx + 4, hy + 8]);
    mitt(ctx, hx, hy, 1.4, lerp(-1.6, Math.PI + 0.3, dig), GLOVE, RED);
  }
  ctx.restore();
  // Broken crust where each of them came up.
  for (const [x, at, n] of [
    [190, PUNCH, 3],
    [158, SURFACE, 5],
    [104, THEO_UP, 4],
  ] as const)
    if (S > at)
      for (let i = 0; i < n; i++) {
        const k = easeOut(span(S, at, at + 0.4));
        const dx = ((i / (n - 1)) * 2 - 1) * (10 + rand(x + i) * 8) * k;
        const y = drift(x + dx) + 1.5,
          w = 3 + rand(x * 2 + i) * 4;
        oval(ctx, x + dx + 1, y + 1.2, w, w * 0.45, '#B4C0D2');
        oval(ctx, x + dx, y, w, w * 0.5, '#F4F7FA');
      }
  for (let i = 0; i < 44; i++) {
    const t = (rand(i * 2.9) + (S - 88.6) * 0.1) % 1;
    box(
      ctx,
      rand(i * 4.1) * W + Math.sin(sec * 0.7 + i) * 5,
      t * 180,
      1.5,
      1.5,
      alpha('#FFFFFF', 0.75),
    );
  }
  if (up > 0.6) breath(ctx, 170, 112, sec, 1, 1);
  if (theo > 0.6) breath(ctx, 112, 124, sec, 1, 0.8, 0.5);
}

function descentShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const g = CLEAR;
  const slope = (x: number) => 96 + x * 0.19;
  gradient(ctx, -10, 180, g.sky);
  stars(ctx, sec, 0.8, 70, 11);
  cloudBank(ctx, sec, 90 + c.t * 6, 26, 260, '#141C2C', 0.8, 31, 10);
  cloudBank(ctx, sec, 300 + c.t * 6, 50, 200, '#1A2334', 0.7, 37, 8);
  poly(
    ctx,
    '#131C2E',
    [-20, 150, 60, 120, 140, 140, 220, 116, 290, 136, 360, 120, 360, 200, -20, 200],
  );
  const light = ease(span(S, HUT_LIGHT, HUT_LIGHT + 1));
  if (light > 0) {
    glow(ctx, 292, 166, 40, AMBER, 0.55 * light);
    glow(ctx, 292, 166, 12, AMBER_L, 0.8 * light);
    box(ctx, 290, 165, 4, 3, alpha(AMBER_L, light));
  }
  const sg = ctx.createLinearGradient(0, 90, 0, 170);
  sg.addColorStop(0, g.ground);
  sg.addColorStop(1, g.groundD);
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(-20, slope(-20));
  ctx.lineTo(250, slope(250));
  ctx.lineTo(236, 200);
  ctx.lineTo(-20, 200);
  ctx.closePath();
  ctx.fill();
  line(ctx, alpha('#8FA2C0', 0.6), 1, [-20, slope(-20), 250, slope(250)]);
  for (let i = 0; i < 9; i++) {
    const x = -10 + i * 30 + rand(i * 3.3) * 20,
      y = slope(x) + 8 + rand(i * 7.1) * 50;
    if (i % 3 === 0) {
      poly(ctx, '#1C2638', [x - 6, y + 2, x - 2, y - 3, x + 4, y - 3, x + 7, y + 2]);
      box(ctx, x - 2, y - 4, 6, 1, alpha('#8FA2C0', 0.8));
    } else line(ctx, alpha('#8FA2C0', 0.35), 1, [x, y, x + 22, y + 4]);
  }
  const ix = 76 + c.t * 17;
  const ph = (S - 93.5) * DESCENT_RATE * TAU;
  const ipose: Pose = {
    ...walk(ph, 0.7, 0.18),
    lamp: 1,
    tilt: 0.3,
    hands: [
      [-10, -24],
      [8, -18],
    ],
    elbows: [1, -1],
  };
  const tx = ix - 15;
  const tpose: Pose = {
    ...walk(ph + Math.PI, 0.5, 0.3),
    hands: [
      [3, -12],
      [ipose.sh[0] + 15 / 1.35 + 1, ipose.sh[1] + 0.5],
    ],
    tilt: 0.35,
  };
  const tFeet = tpose.feet;
  figure(
    ctx,
    tx,
    slope(tx),
    1.35,
    THEO,
    { ...tpose, feet: [tFeet[0], [4, -4]] },
    { dark: 0.45, night: '#0A1224' },
  );
  figure(ctx, ix, slope(ix), 1.35, INES, ipose, { dark: 0.35, night: '#0A1224' });
  const [lx, ly] = lensAt(ix, slope(ix), 1.35, ipose);
  beam(ctx, lx, ly, 0.5, 90, 0.2, 0.7);
  for (const f of DESCENT_STEPS)
    if (f < S) {
      const fx = 76 + (f - 93.5) * 17;
      box(ctx, fx - 1, slope(fx) + 1, 3, 1, alpha('#1A2436', 0.6));
    }
  snowfall(ctx, sec, { amount: 0.25, speed: 10, drift: -1, color: alpha(SNOW, 0.6), seed: 181 });
}

function callShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  gradient(ctx, -10, H + 10, CLEAR.sky);
  stars(ctx, sec, 0.9, 90, 17);
  poly(
    ctx,
    '#0E1626',
    [-20, 150, 40, 128, 110, 144, 200, 124, 270, 140, 340, 126, 340, 200, -20, 200],
  );
  glow(ctx, 266, 146, 22, AMBER, 0.65);
  box(ctx, 265, 145, 2, 2, AMBER_L);
  // Theo, asleep on his feet against her shoulder.
  face(
    ctx,
    'theo',
    24,
    112,
    1.5,
    {
      turn: 0.5,
      tilt: 0.28,
      lid: 0.9,
      worry: 0.3,
      mouth: 'breath',
      frost: 1,
      shade: 0.45,
      night: '#0A1224',
    },
    sec,
  );
  const talking = presence(S, ANSWER + 0.2, ANSWER + 2.8, 0.05) > 0.5 && Math.sin(sec * 11) > -0.3;
  const radioUp = ease(span(S, ANSWER - 0.4, ANSWER)) * (1 - ease(span(S, 103.6, 104)));
  face(
    ctx,
    'ines',
    142,
    102,
    2.3 + c.k * 0.08,
    {
      turn: 0.3,
      look: [0.7, 0.35],
      lid: 0.48,
      worry: 0.25,
      mouth: talking ? 'part' : S > 102.6 ? 'small' : 'breath',
      lamp: 0.7,
      frost: 1,
      rimR: alpha(AMBER, 0.35),
      shade: 0.28,
      night: '#0A1224',
    },
    sec,
  );
  const led = presence(S, RADIO_OUT, RADIO_OUT + 2.7, 0.1);
  const rx = lerp(214, 196, radioUp),
    ry = lerp(176, 150, radioUp);
  line(ctx, RED_D, 22, [rx + 50, 200, rx + 10, ry + 14]);
  box(ctx, rx - 6, ry - 14, 12, 24, '#1D2128');
  line(ctx, '#1D2128', 1.4, [rx + 3, ry - 14, rx + 4, ry - 30]);
  glow(ctx, rx + 3, ry - 10, 8, '#6CFF96', 0.5 * led);
  disc(ctx, rx + 3, ry - 10, 1.2, mix('#1E4A2C', '#9CFFB8', led));
  mitt(ctx, rx + 6, ry + 4, 2, -2.4, GLOVE, RED_D);
  breath(ctx, 150, 140, sec, 1, 0.8);
}

function heli(ctx: Ctx, x: number, y: number, s: number, sec: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(-0.08);
  line(ctx, '#2A2E38', 1.4, [-4, 5, -26, 1]);
  poly(ctx, '#C73A3E', [-28, -3, -24, -3, -22, 2, -27, 2]);
  disc(ctx, -27, 0, 2.6, alpha('#8A93A0', 0.4));
  oval(ctx, 0, 0, 9, 5.5, '#C73A3E');
  oval(ctx, 3.5, -1, 4.5, 3, '#9CC0E0');
  box(ctx, -8, 1, 16, 1.5, '#F2F4F8');
  line(ctx, '#2A2E38', 0.8, [-6, 6.5, 7, 6.5]);
  line(ctx, '#2A2E38', 0.8, [-4, 5, -4, 6.5]);
  line(ctx, '#2A2E38', 0.8, [4, 5, 4, 6.5]);
  box(ctx, -0.5, -7.5, 1, 2, '#2A2E38');
  oval(ctx, 0, -7.5, 22, 1.4, alpha('#3A3E48', 0.35 + 0.1 * Math.sin(sec * 50)));
  ctx.restore();
}
function dawnShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const g = DAWN;
  const rise = ease(span(S, HELI, 108.6));
  zoomed(ctx, 160, 110, 1 + ease(c.k) * 0.06, () => {
    gradient(ctx, -20, 160, g.sky);
    glow(ctx, 320, 80, 160, '#FFE0A8', 0.5);
    if (S > HELI) heli(ctx, lerp(262, 222, rise), lerp(66, 28, rise), 1.2, sec);
    farRange(ctx, g);
    massif(ctx, g);
    foreground(ctx, g);
    hut(ctx, 76, 166, 0.8, { sec, warm: 1, wind: 0.05, smoke: 0.8 });
    for (const [x, col] of [
      [108, BLANKET],
      [116, RED],
    ] as const) {
      box(ctx, x - 2, 158, 4, 6, col);
      disc(ctx, x, 156, 2, x > 110 ? HAIR_I : BEANIE);
    }
    box(ctx, 102, 163, 18, 1.5, '#5A3E3A');
    for (let i = 0; i < 14; i++) {
      const tw = Math.sin(sec * (0.8 + rand(i) * 1.2) + i * 1.7);
      if (tw > 0.6) {
        const x = rand(i * 3.3) * W,
          y = 150 + rand(i * 5.1) * 30;
        box(ctx, x - 1, y, 3, 1, alpha('#FFFFFF', (tw - 0.6) * 2));
        box(ctx, x, y - 1, 1, 3, alpha('#FFFFFF', (tw - 0.6) * 2));
      }
    }
  });
}

function benchShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const warm = '#FFD6A0';
  box(ctx, 0, 0, W, H, '#B39A94');
  for (let j = 0; j < 7; j++)
    for (let i = 0; i < 9; i++)
      box(
        ctx,
        (j % 2) * 18 + i * 38 - 10,
        j * 22 + 4,
        34,
        18,
        alpha(i % 3 ? '#A48A88' : '#C4ACA2', 0.8),
      );
  glow(ctx, 330, 40, 220, warm, 0.35);
  box(ctx, -10, 146, W + 20, 40, '#F6ECEA');
  box(ctx, 20, 138, 280, 6, '#6A4A3A');
  box(ctx, 20, 138, 280, 1.5, '#8A6A54');
  box(ctx, 34, 144, 5, 30, '#4A3228');
  box(ctx, 280, 144, 5, 30, '#4A3228');
  box(ctx, 6, 150, 30, 24, '#6A4A3A');
  oval(ctx, 26, 146, 10, 6, '#EDEFF2');
  line(ctx, alpha('#B8C0CC', 0.8), 1, [20, 144, 32, 148]);
  const nod = hump(S, NOD - 0.3, NOD + 0.5);
  const turnT = ease(span(S, NOD - 0.8, NOD - 0.3)) * (1 - ease(span(S, 110.6, 111.3)));
  face(
    ctx,
    'theo',
    98,
    72,
    1.15,
    {
      collar: BLANKET,
      turn: lerp(-0.1, 0.45, turnT),
      look: [lerp(0, 0.8, turnT), 0.1],
      lid: 0.35 + nod * 0.3,
      worry: 0.2,
      mouth: turnT > 0.5 ? 'small' : 'flat',
      nod: nod * 0.9,
      shade: 0,
      rimR: alpha(warm, 0.9),
    },
    sec,
  );
  for (let i = 0; i < 4; i++)
    line(ctx, alpha('#46546C', 0.7), 1.4, [58 + i * 18, 120, 62 + i * 16, 160]);
  // A hut blanket: two woven stripes.
  line(ctx, alpha('#9AA8C0', 0.8), 2.4, [47, 136, 149, 136]);
  line(ctx, alpha('#3E4A62', 0.8), 1.4, [46, 141, 150, 141]);
  line(ctx, alpha('#9AA8C0', 0.8), 2.4, [45, 146, 151, 146]);
  const glance = ease(span(S, NOD + 0.2, NOD + 0.6)) * (1 - ease(span(S, 111, 111.4)));
  const back = hump(S, NOD_BACK - 0.3, NOD_BACK + 0.5);
  face(
    ctx,
    'ines',
    216,
    70,
    1.15,
    {
      hood: 0,
      turn: lerp(0.1, -0.35, glance),
      look: [lerp(0.3, -0.9, glance), 0.1],
      lid: 0.4 + back * 0.25,
      mouth: back > 0.3 ? 'small' : 'flat',
      nod: back * 0.8,
      shade: 0,
      rimR: alpha(warm, 0.9),
    },
    sec,
  );
  mug(ctx, 216, 158, 1.05, sec, 1, 0.3);
  hands(ctx, 216, 148, 1.05);
}

function peakShot(ctx: Ctx, c: Cut) {
  const S = c.S,
    sec = c.sec;
  const up = ease(span(S, LOOK_UP - 0.3, LOOK_UP + 0.4));
  const sip = ease(span(S, SIP - 0.6, SIP));
  gradient(ctx, -10, H + 10, DAWN.sky);
  ctx.save();
  ctx.translate(96, 26);
  ctx.scale(1.35, 1.35);
  ctx.translate(-196, -10);
  massif(ctx, DAWN);
  ctx.restore();
  glow(ctx, 96, 30, 70, '#FFE6C0', 0.35);
  gradient(ctx, 150, H + 10, ['#F6ECEA', '#E4D2D8'], -20, 360);
  face(
    ctx,
    'ines',
    222,
    104,
    2.3,
    {
      hood: 0,
      turn: lerp(-0.15, -0.45, up),
      look: [lerp(-0.3, -0.75, up), lerp(0.1, -0.9, up)],
      lid: lerp(0.3, 0.52, up),
      brow: -0.1 * up,
      quirk: 0.45 * up,
      worry: -0.1 * up,
      mouth: 'flat',
      shade: 0,
      rimR: alpha('#FFD6A0', 0.9),
      key: '#FFD6A0',
      keyAmt: 0.12,
      keySide: 1,
    },
    sec,
  );
  const mx = lerp(232, 222, sip),
    my = lerp(212, 160, sip);
  line(ctx, RED, 28, [mx - 44, 240, mx - 20, my + 4]);
  line(ctx, RED, 28, [mx + 56, 240, mx + 24, my + 4]);
  mug(ctx, mx, my, 2.1, sec, 1, 0.3);
  hands(ctx, mx, my - 20, 2.1);
}
/** Two bare hands wrapped round a mug centred at (x, y). */
function hands(ctx: Ctx, x: number, y: number, s: number) {
  for (const side of [-1, 1]) {
    oval(ctx, x + side * 10 * s, y + 3 * s, 5 * s, 6.5 * s, SKIN_I);
    oval(ctx, x + side * 6 * s, y, 3.6 * s, 6.2 * s, SKIN_I);
    for (let i = 0; i < 3; i++)
      line(ctx, alpha(SKIN_I_D, 0.9), 0.6 * s, [
        x + side * 3 * s,
        y + (-3 + i * 3) * s,
        x + side * 7.5 * s,
        y + (-3.4 + i * 3) * s,
      ]);
    oval(ctx, x + side * 8.5 * s, y - 5.5 * s, 2.2 * s, 1.5 * s, mix(SKIN_I, '#FFFFFF', 0.15));
  }
}

const SCENES: Record<ShotName, (ctx: Ctx, c: Cut) => void> = {
  hut: hutShot,
  radio: radioShot,
  face: faceShot,
  gear: gearShot,
  door: doorShot,
  mountain: mountainShot,
  boots: bootsShot,
  climb: climbShot,
  axe: axeShot,
  blind: blindShot,
  ledge: ledgeShot,
  theo: theoShot,
  ines: inesShot,
  rope: ropeShot,
  bridge: bridgeShot,
  under: underShot,
  drag: dragShot,
  strain: strainShot,
  groove: grooveShot,
  dangle: dangleShot,
  haul: haulShot,
  breath: breathShot,
  look: lookShot,
  wall: wallShot,
  dive: diveShot,
  buried: buriedShot,
  descent: descentShot,
  call: callShot,
  dawn: dawnShot,
  bench: benchShot,
  peak: peakShot,
};

const CAPTIONS = [
  [T(RADIO_IN + 0.1), T(RADIO_IN + 2.9), '“Heli’s grounded. Front’s coming in fast.”'],
  [T(RADIO_2), T(RADIO_2 + 2.8), '“Kid’s on a ledge below the ridge.”'],
  [T(REPLY + 0.1), T(REPLY + 2.7), '“Copy. I’m going up.”'],
  [T(CALL), T(CALL + 2.6), '“THEO!”'],
  [T(47.7), T(50.4), '“I thought nobody would come.”'],
  [T(50.8), T(53.8), '“Look at me. We’re going down together.”'],
  [T(RADIO_OUT + 0.1), T(RADIO_OUT + 2.7), '“Ines? … Ines, come in.”'],
  [T(ANSWER + 0.2), T(ANSWER + 2.8), '“Two coming home.”'],
] as const;

/** The avalanche's whiteout: a soft veil that rises over a second, holds, and slowly clears. */
function whiteAt(S: number) {
  if (S < HIT || S >= WHITE_CLEAR) return 0;
  if (S < WHITE_FULL) return ease(span(S, HIT, WHITE_FULL));
  if (S < WHITE_HOLD) return 1;
  return 1 - ease(span(S, WHITE_HOLD, WHITE_CLEAR));
}
/** A dip to black between the long night and the dawn. */
function darkAt(S: number) {
  if (S < DARK_FROM || S > 104.8) return 0;
  return S < DAWN_FROM ? ease(span(S, DARK_FROM, DAWN_FROM)) : 1 - ease(span(S, DAWN_FROM, 104.8));
}

// ——— The score ———
const ROOT = 50; // D
/** The climb: a plucked ostinato in eighths. */
const CLIMB = [0, null, 7, null, 3, null, 7, 5] as const;
/** Ines's theme: it climbs a fourth, looks down, and climbs again. */
const THEME = [12, 15, 17, 19, null, 17, 15, null, 14, 15, 12, null, 10, 12, null, null] as const;
/** And in the major, at dawn. */
const THEME_MAJOR = [
  12,
  16,
  19,
  21,
  null,
  19,
  16,
  null,
  17,
  19,
  21,
  null,
  24,
  null,
  null,
  null,
] as const;

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const whiteoutScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: ROOT + 12, voice: 'bell', intro: [0, 7, 12, 15], outro: [0, 4, 7, 12] },
    (s) => {
      const wind = (from: number, to: number, gain: number, pan = 0) =>
        s.fx('wind', T(from), to - from, gain, pan);
      const crunch = (t: number, gain = 0.06, pan = 0) => s.fx('crunch', T(t), 0.18, gain, pan);
      const heartbeat = (from: number, to: number, gap: number, gain = 0.08) => {
        for (let t = from; t < to - 0.1; t += gap) {
          s.note(T(t), 33, 0.3, 'kick', gain);
          s.note(T(t + 0.24), 33, 0.3, 'kick', gain * 0.7);
        }
      };
      // The hut at dusk: a cold drone, an icy bell, the wind outside.
      s.section({
        from: 0,
        to: T(5.2),
        bpm: 60,
        root: ROOT,
        chords: [0],
        minor: true,
        level: 1,
        bass: false,
        fade: 2,
      });
      for (const [t, d] of [
        [0.8, 24],
        [2.2, 31],
        [3.4, 27],
      ] as const)
        s.note(T(t), ROOT + d, 2.2, 'bell', 0.05, 0.3);
      wind(0, 5.5, 0.06, 0.4);
      // The radio: the hut clock ticks, static carries the news.
      s.section({
        from: T(5),
        to: T(14.2),
        bpm: 60,
        root: ROOT,
        chords: [0, 8],
        minor: true,
        level: 0.5,
        fade: 1.2,
      });
      for (let t = 5.5; t < 14; t += 1) s.fx('tick', T(t), 0.05, 0.03, -0.5);
      s.fx('beep', T(RADIO_IN - 0.05), 0.12, 0.05, 0.3);
      s.fx('crackle', T(RADIO_IN), 2.9, 0.045, 0.3);
      s.fx('crackle', T(RADIO_2 - 0.05), 2.9, 0.04, 0.3);
      s.fx('click', T(RADIO_2 + 2.85), 0.05, 0.08, 0.3);
      s.fx('rustle', T(9.1), 0.4, 0.05);
      [15, 14, 12].forEach((d, i) => s.note(T(11.4 + i * 0.5), ROOT + d, 0.9, 'keys', 0.05, -0.2));
      s.chord(T(11.4), [ROOT - 12, ROOT, ROOT + 7], 3, 'pad', 0.035);
      s.fx('click', T(REPLY), 0.05, 0.1, 0.2);
      s.fx('click', T(REPLY + 2.7), 0.05, 0.08, 0.2);
      // Kit on: the karabiner, the strap, the door, the lamp.
      s.chord(T(14), [ROOT - 12, ROOT, ROOT + 7], 2.9, 'pad', 0.03);
      s.fx('click', T(CLIP), 0.06, 0.16);
      s.fx('clatter', T(CLIP + 0.02), 0.12, 0.04);
      s.fx('click', T(LOCK), 0.05, 0.08);
      s.fx('rustle', T(TUG), 0.3, 0.1);
      s.fx('creak', T(DOOR), 0.8, 0.12, -0.3);
      wind(DOOR + 0.2, 20.8, 0.08, 0.3);
      for (const f of DOOR_STEPS) crunch(f, 0.07);
      s.fx('click', T(LAMP_ON), 0.06, 0.14);
      s.section({
        from: T(16.5),
        to: T(20.6),
        bpm: 72,
        root: ROOT,
        chords: [0, 0, 8, 10],
        minor: true,
        level: 0.6,
        fade: 0.8,
      });
      // The climb: a heartbeat pulse, and an ostinato that ratchets up a step.
      s.section({
        from: T(20.5),
        to: T(30),
        bpm: 76,
        root: ROOT,
        chords: [0, 8, 10, 0],
        minor: true,
        melody: CLIMB,
        step: 0.5,
        voice: 'pluck',
        gain: 0.6,
        level: 1,
        groove: 'pulse',
        fade: 1.2,
      });
      s.section({
        from: T(30),
        to: T(37.5),
        bpm: 84,
        root: ROOT + 2,
        chords: [0, 8, 10, 0],
        minor: true,
        melody: CLIMB,
        step: 0.5,
        voice: 'pluck',
        gain: 0.7,
        level: 1,
        groove: 'pulse',
        fade: 0.3,
      });
      wind(20.5, 30.2, 0.06, 0.2);
      wind(30, 37.8, 0.09, -0.2);
      s.fx('sweep', T(GUST - 0.3), 1.8, 0.12, -0.4);
      wind(GUST - 0.2, GUST + 1.6, 0.08, -0.4);
      for (const k of KICKS) {
        s.fx('step', T(k), 0.12, 0.13, 0.1);
        crunch(k, 0.08, 0.1);
      }
      for (const a of PLANTS) {
        s.fx('swish', T(a - 0.22), 0.22, 0.06);
        s.fx('crunch', T(a), 0.25, 0.18, 0.2);
      }
      for (const f of CLIMB_STEPS) crunch(f, 0.07);
      for (const b of BITES) {
        s.fx('swish', T(b - 0.22), 0.24, 0.08, -0.2);
        s.fx('crunch', T(b), 0.3, 0.24, 0.2);
        s.fx('clatter', T(b + 0.01), 0.2, 0.04, 0.2);
      }
      // Whiteout: the harmony slips a semitone and the wind takes over.
      s.section({
        from: T(37.5),
        to: T(43),
        bpm: 92,
        root: ROOT,
        chords: [0, 1],
        minor: true,
        level: 0.65,
        groove: 'pulse',
        fade: 0.4,
      });
      wind(37.5, 43.2, 0.12);
      s.fx('rain', T(37.5), 5.5, 0.03);
      s.note(T(FOUND), ROOT + 31, 1.6, 'bell', 0.05);
      s.chord(T(FOUND), [ROOT + 3, ROOT + 7, ROOT + 12], 1.6, 'pad', 0.03);
      // The ledge: the storm eases; the theme is born quietly on keys with her promise.
      s.section({
        from: T(43),
        to: T(50.5),
        bpm: 66,
        root: ROOT,
        chords: [0, 8, 3, 10],
        minor: true,
        level: 0.7,
        fade: 1,
      });
      s.fx('swish', T(43.3), 1.6, 0.05);
      s.fx('step', T(LEDGE), 0.12, 0.14);
      crunch(LEDGE, 0.1);
      wind(43, 50.5, 0.07, -0.3);
      s.section({
        from: T(50.5),
        to: T(56.5),
        bpm: 66,
        root: ROOT,
        chords: [0, 8, 3, 10],
        minor: true,
        melody: THEME,
        step: 1,
        voice: 'keys',
        gain: 0.7,
        level: 0.65,
        fade: 0.8,
      });
      wind(50.5, 56.7, 0.045, 0.3);
      s.fx('click', T(CLIP2), 0.06, 0.15);
      for (const t of TUGS) s.fx('creak', T(t), 0.25, 0.12);
      // The snow bridge: quiet, dread, a groan.
      s.section({
        from: T(56.5),
        to: T(62),
        bpm: 60,
        root: ROOT,
        chords: [0],
        minor: true,
        level: 0.45,
        bass: false,
        fade: 0.8,
      });
      heartbeat(57, 62, 1, 0.07);
      for (const f of THEO_STEPS) crunch(f, 0.045, -0.2);
      s.fx('creak', T(GROAN), 1.1, 0.12);
      s.fx('crunch', T(HAIRLINE), 0.2, 0.06);
      wind(56.5, 62, 0.03);
      // The collapse.
      s.fx('thud', T(CRACK), 0.5, 0.3);
      s.fx('crunch', T(CRACK), 0.3, 0.22);
      s.chord(T(CRACK), [ROOT, ROOT + 1, ROOT + 6], 1.2, 'pad', 0.04);
      s.fx('thud', T(BREAK), 0.6, 0.28);
      s.fx('crunch', T(BREAK + 0.03), 0.4, 0.24);
      s.fx('rumble', T(BREAK), 1.6, 0.18);
      s.fx('swish', T(BREAK + 0.1), 0.7, 0.1);
      // The rope comes tight; she is dragged; the axe goes in; it holds.
      s.fx('thud', T(TAUT), 0.5, 0.34);
      s.fx('creak', T(TAUT), 0.5, 0.18);
      s.section({
        from: T(TAUT),
        to: T(HOLD),
        bpm: 126,
        root: ROOT,
        chords: [0, 1, 0, 1],
        minor: true,
        melody: CLIMB,
        step: 0.5,
        voice: 'pluck',
        gain: 0.5,
        level: 0.85,
        groove: 'drive',
        fade: 0.1,
      });
      s.fx('sweep', T(64), 1.4, 0.12);
      s.fx('rustle', T(64), 1.3, 0.08);
      s.fx('crunch', T(ARREST), 0.35, 0.26);
      s.fx('clatter', T(ARREST + 0.02), 0.15, 0.05);
      s.fx('sweep', T(ARREST), 2.4, 0.14);
      s.fx('rustle', T(ARREST), 2.4, 0.1);
      s.fx('sweep', T(67.6), 2.4, 0.1);
      s.fx('rustle', T(67.6), 2.4, 0.07);
      s.fx('gasp', T(66.5), 0.5, 0.08);
      s.fx('crunch', T(HOLD), 0.3, 0.22);
      s.fx('creak', T(HOLD + 0.05), 0.8, 0.18);
      s.note(T(HOLD), ROOT - 12, 3, 'pad', 0.05);
      s.fx('gasp', T(70.7), 0.6, 0.07);
      // Hanging in the blue.
      s.section({
        from: T(HOLD + 0.3),
        to: T(73),
        bpm: 60,
        root: ROOT,
        chords: [0],
        minor: true,
        level: 0.4,
        bass: false,
        fade: 0.6,
      });
      for (const t of [71.4, 72.4]) s.fx('creak', T(t), 0.6, 0.1);
      s.fx('rustle', T(72), 0.4, 0.04);
      // The haul: the theme on the lead, at last.
      s.section({
        from: T(73),
        to: T(77.5),
        bpm: 96,
        root: ROOT,
        chords: [0, 8, 10, 0],
        minor: true,
        melody: THEME,
        step: 1,
        voice: 'lead',
        gain: 0.65,
        level: 0.75,
        groove: 'pulse',
        fade: 0.3,
      });
      for (const t of HAULS) {
        s.fx('creak', T(t), 0.35, 0.14);
        s.fx('rustle', T(t), 0.25, 0.05);
      }
      s.fx('gasp', T(GRAB - 0.1), 0.4, 0.08);
      s.chord(T(GRAB), [ROOT, ROOT + 3, ROOT + 7, ROOT + 12], 1.8, 'pad', 0.035);
      s.fx('thud', T(OUT), 0.4, 0.22);
      crunch(OUT, 0.1);
      // Breath. Then a sound from above that does not stop.
      s.note(T(77.4), ROOT + 7, 3, 'pad', 0.03);
      s.note(T(77.4), ROOT, 3, 'pad', 0.03);
      s.fx('gasp', T(77.9), 0.6, 0.05);
      s.fx('gasp', T(78.9), 0.6, 0.04, 0.3);
      wind(77.5, 80.5, 0.025);
      s.fx('rumble', T(RUMBLE), 3.2, 0.07);
      s.fx('rumble', T(81), 3, 0.11);
      s.fx('rumble', T(83), 2.8, 0.15);
      s.fx('rumble', T(85), 2.4, 0.2);
      s.fx('thunder', T(84.8), 3, 0.1);
      heartbeat(80.6, 83, 0.62, 0.08);
      s.section({
        from: T(82.5),
        to: T(HIT),
        bpm: 132,
        root: ROOT,
        chords: [0, 1],
        minor: true,
        level: 0.75,
        groove: 'drive',
        fade: 0.3,
      });
      s.fx('swish', T(86.1), 0.6, 0.12);
      // It hits. Then white, and almost nothing.
      s.fx('thunder', T(HIT), 3.2, 0.3);
      s.fx('rumble', T(HIT), 2.6, 0.26);
      s.fx('thud', T(HIT), 0.6, 0.3);
      s.note(T(WHITE_FULL), ROOT + 36, 3.4, 'pad', 0.025);
      s.note(T(WHITE_FULL), ROOT + 24, 3.4, 'pad', 0.02);
      wind(88.8, 93.5, 0.02);
      s.fx('crunch', T(PUNCH), 0.25, 0.16);
      s.fx('rustle', T(PUNCH), 0.5, 0.08);
      s.fx('gasp', T(SURFACE), 0.6, 0.12);
      s.fx('rustle', T(91.8), 0.6, 0.07);
      s.fx('crunch', T(THEO_UP), 0.2, 0.08);
      s.fx('gasp', T(COUGH), 0.25, 0.1, -0.2);
      s.fx('gasp', T(COUGH + 0.35), 0.25, 0.08, -0.2);
      s.chord(T(93), [ROOT + 3, ROOT + 7, ROOT + 10, ROOT + 15], 3, 'keys', 0.035);
      // The long way down: the theme, tired, and a light below.
      s.section({
        from: T(93.5),
        to: T(98.2),
        bpm: 64,
        root: ROOT,
        chords: [0, 8, 3, 10],
        minor: true,
        melody: THEME,
        step: 1,
        voice: 'lead',
        gain: 0.6,
        level: 0.7,
        fade: 1,
      });
      for (const f of DESCENT_STEPS) crunch(f, 0.035);
      s.note(T(HUT_LIGHT), ROOT + 31, 2.2, 'bell', 0.05, 0.4);
      s.fx('chime', T(HUT_LIGHT + 0.05), 0.8, 0.025, 0.4);
      s.section({
        from: T(98),
        to: T(103.4),
        bpm: 64,
        root: ROOT,
        chords: [3, 10, 8, 3],
        minor: true,
        level: 0.5,
        fade: 0.9,
      });
      s.fx('beep', T(RADIO_OUT - 0.05), 0.12, 0.05, 0.3);
      s.fx('crackle', T(RADIO_OUT), 2.7, 0.045, 0.3);
      s.fx('click', T(ANSWER), 0.05, 0.1, 0.1);
      s.fx('crackle', T(ANSWER + 0.1), 2.6, 0.02, 0.1);
      s.fx('click', T(103.7), 0.05, 0.07, 0.1);
      // Dawn: the theme in the major, and the rotor over the ridge.
      s.section({
        from: T(DAWN_FROM + 0.1),
        to: T(108.8),
        bpm: 72,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: THEME_MAJOR,
        step: 1,
        voice: 'lead',
        gain: 0.8,
        level: 0.9,
        fade: 1.2,
      });
      s.fx('chug', T(HELI), 5, 0.05, 0.4);
      s.fx('whir', T(HELI), 5, 0.04, 0.4);
      s.fx('chug', T(HELI + 5), 4, 0.03, 0.2);
      s.fx('whir', T(HELI + 5), 4, 0.02, 0.2);
      s.fx('tweet', T(106.6), 0.8, 0.03, -0.5);
      s.section({
        from: T(108.5),
        to: 1,
        bpm: 72,
        root: ROOT,
        chords: [5, 0, 7, 0],
        melody: [16, null, 19, null, 21, 24, null, null, null, null],
        step: 1,
        voice: 'keys',
        gain: 0.7,
        level: 0.75,
        fade: 1,
      });
      s.note(T(NOD), ROOT + 28, 1.6, 'bell', 0.04, -0.3);
      s.note(T(NOD_BACK), ROOT + 31, 1.6, 'bell', 0.04, 0.3);
      s.chord(T(SIP), [ROOT, ROOT + 4, ROOT + 7, ROOT + 12], 2.5, 'pad', 0.035);
      s.fx('swish', T(SIP), 0.3, 0.03);
    },
  );

export const whiteout: FilmModule = {
  draw(ctx, p, seconds) {
    const S = p * STORY;
    const now = current(S);
    SCENES[now.name](ctx, {
      t: S - now.from,
      d: now.to - now.from,
      k: span(S, now.from, now.to),
      S,
      sec: seconds,
    });
    const white = whiteAt(S);
    veil(ctx, MIST, white);
    veil(ctx, INK, darkAt(S));
    const dawn = ease(span(S, DAWN_FROM, 106));
    vignette(ctx, lerp(0.5, 0.22, dawn) * (1 - white), mix('#060A12', '#2A1A18', dawn));
    letterbox(ctx, lerp(0.4, 0, dawn));
    captions(ctx, p, CAPTIONS, {}, 0.3 / STORY);
  },
  score: whiteoutScore,
  look: {
    shade: '#0E1624',
    ink: '#F4F8FC',
    accent: '#C73A3E',
    dedication: 'for the ones who go up when everyone else comes down',
  },
};
