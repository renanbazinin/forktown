import type { FilmModule } from './types';
import {
  alpha,
  backOut,
  box,
  camera,
  caption,
  clamp,
  disc,
  ease,
  easeIn,
  easeOut,
  font,
  glow,
  H,
  hump,
  lerp,
  line,
  mix,
  oval,
  person,
  poly,
  presence,
  rand,
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
 * MIRROR, SIGNAL, PANIC
 * Grace is forty-three and on her ninth driving test. Mr. Pike, her examiner, has a clipboard,
 * a beige jacket and no eyelids to speak of. She indicates with the wipers, stalls twice, waits
 * out a family of ducks, joins a funeral, laps a roundabout four times and parks on the twelfth
 * try. Back at the test centre he says one word, and for the first time in the film he blinks.
 *
 * Everything is timed in story seconds (94 of them between the title and the end card). The
 * hit points are shared by the pictures and the score, so every swish, stall, quack and blink
 * lands on its frame.
 */

// ——— Timing ———
const STORY = 94;
const at = (s: number) => s / STORY;

/** Where each shot begins, in story seconds. */
const CUTS = [
  0, 4.5, 9, 11.3, 14.5, 16.8, 19.5, 23, 26.8, 29.8, 35, 37, 41, 45.3, 49.5, 51.5, 57.6, 59.5, 62.2,
  66.8, 68.8, 71.6, 76, 80, 83.2, 86.8, 89.6,
] as const;

const STAMP = 1.2; // ATTEMPT 9
const PEP = [4.8, 7.6] as const;
const REACH = 7.7;
const TILT = 9.4;
const OWN_TIME = [11.7, 14.3] as const;
const MIRROR = 14.75; // "Mirror…"
const SIGNAL = 15.15; // "…signal…"
const FLICK = 15.5; // the wrong stalk
/** The wipers keep time with the panic: one sweep per beat. */
const BEAT = 60 / 132;
const WIPES = 8;
const WIPERS_OFF = FLICK + WIPES * BEAT;
const HORN = 18.2;
const CHUGS = [19.6, 21.1] as const;
const STALLS = [20.4, 21.9] as const;
const SCRATCH = 24.4;
const PEN = 26.0;
const HALT = 27.4;
const QUACKS = [27.9, 28.6, 29.3] as const;
const LAPSE = 29.8;
const LAPSE_END = 35;
/** The time-lapse runs eight times faster than life. */
const FAST = 8;
const LAPSE_QUACKS = [30.4, 31.1, 31.9, 32.6, 33.3, 34.1, 34.6] as const;
const FAR_QUACK = 36.0;
const ROLLBACK = 38.0;
const REV = 38.8;
const LURCH = 39.4;
const TOLLS = [40.2, 44.2, 48.2] as const;
const HATS = 43.0;
const NOD = 46.6;
const NOD_BACK = 47.6;
const SCRATCH_2 = 50.2;
const RING_IN = 51.9;
const EXIT = 58.6;
const TURNS = 9.5 * Math.PI;
const RING_FROM = Math.PI / 2 + 0.22;
const TRIES = [62.2, 63.0, 63.7, 64.3, 64.8, 65.25, 65.7, 66.1, 66.45, 67.3, 68.1, 68.8] as const;
const FLIP_PAGE = 67.9;
const SHUT = 69.5;
const EXHALE = 69.9;
const OPEN = 70.9;
const GLIDE = 72.2;
const GLIDE_END = 75.2;
const SETTLE = 75.3;
const CLICK_2 = 78.8;
const PASS = 81.2;
const WAKE = 83.4;
const SCREAM = 83.7;
const HUG = 84.2;
const FLIP = 84.5;
const BLINK = 87.6;
const SMILE = 88.6;
const DRIVE_OFF = 89.8;
const BUTTON = 89.9;
const WIPE_AGAIN = BUTTON + 3 * BEAT;
const INDICATE = WIPE_AGAIN - 0.15;
/** Story seconds where the music stops dead for Mr. Pike. */
const STOPS = [11.3, STALLS[0], STALLS[1], LAPSE_END, 49.5, EXIT, SHUT, 86.8] as const;

/** The roundabout: four laps and three quarters, faster every time round. */
function ringAngle(t: number) {
  const u = clamp((t - RING_IN) / (EXIT - RING_IN));
  return RING_FROM + TURNS * (0.55 * u + 0.45 * u * u);
}
/** When each lap starts: the moment the car passes the road it came in on. */
const LAPS = [0, 1, 2, 3].map((k) => {
  if (!k) return RING_IN;
  const f = (k * TAU - (RING_FROM - Math.PI / 2)) / TURNS;
  const u = (-0.55 + Math.sqrt(0.55 * 0.55 + 4 * 0.45 * f)) / (2 * 0.45);
  return RING_IN + u * (EXIT - RING_IN);
});

/** The hit points, in story time (0..1), for anyone who wants to check the sync. */
export const SYNC = {
  flick: at(FLICK),
  wipes: Array.from({ length: WIPES }, (_, i) => at(FLICK + i * BEAT)),
  horn: at(HORN),
  stalls: STALLS.map(at),
  quacks: QUACKS.map(at),
  laps: LAPS.map(at),
  tries: TRIES.map(at),
  settle: at(SETTLE),
  pass: at(PASS),
  flip: at(FLIP),
  blink: at(BLINK),
  wipeAgain: at(WIPE_AGAIN),
} as const;

/** Wiper sweep 0 (parked) → 1 (up) → 0, one sweep per beat while they run. */
function wiper(t: number, from: number, to = Infinity) {
  if (t < from || t >= to) return 0;
  return (1 - Math.cos((Math.PI * (t - from)) / BEAT)) / 2;
}
const tries = (t: number) => TRIES.filter((k) => k <= t).length;
const lapOf = (t: number) => LAPS.filter((k) => k <= t).length;
/** Scene time for the duck crossing: real time, then eight times faster. */
const lapseT = (t: number) =>
  t < LAPSE ? t : LAPSE + (Math.min(t, LAPSE_END) - LAPSE) * FAST + Math.max(0, t - LAPSE_END);
/** A damped wobble after an impact at t0. */
const jolt = (t: number, t0: number, rate = 4.5, freq = 17) =>
  t > t0 ? Math.exp(-(t - t0) * rate) * Math.sin((t - t0) * freq) : 0;

// ——— Palette: a crisp, pastel morning ———
const INK = '#26232B';
const CHERRY = '#D62839';
const CHERRY_L = '#F2606E';
const GLASS = '#BFE1F0';
const CABIN = '#3A404B';
const TYRE = '#26262C';
const HUB = '#C5CAD0';
const TARMAC = '#858B93';
const PAINT = '#F3F1EA';
const PAVE = '#D5CFC3';
const KERB = '#B3AC9E';
const AMBER = '#F2A93B';
const GRASS = '#93C77E';
const LEAF = '#6FAE62';
const LINING = '#D5CEBF';
const SEAT = '#4B505A';
const DASH = '#2E3138';
const PASTELS = ['#F4B8C1', '#A9DCC6', '#F6DE9E', '#C9BAE6', '#F8C6A0', '#B4D7F0', '#E4E9B0'];
const ROOFS = ['#8E5B5B', '#5F6C7E', '#7A6A5A', '#6B5B7B'];
const PAPER = '#FAF7EE';
const BOARD = '#A87B4F';
const BIRO = '#23306B';
const SKY = ['#86C8E6', '#B3DEF1', '#DDF1F7'] as const;

function wash(ctx: Ctx, y: number, h: number, stops: readonly string[], x = 0, w = W) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  stops.forEach((c, i) => g.addColorStop(i / Math.max(1, stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}
function ring(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  width: number,
  from = 0,
  to = TAU,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, from, to);
  ctx.stroke();
}
/** The top half of a disc: a wheel arch. */
function arch(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI, TAU);
  ctx.fill();
}
function cloud(ctx: Ctx, x: number, y: number, s: number) {
  oval(ctx, x, y, 15 * s, 5 * s, '#F6FBFD');
  disc(ctx, x - 6 * s, y - 3 * s, 6 * s, '#F6FBFD');
  disc(ctx, x + 4 * s, y - 5 * s, 7.5 * s, '#FFFFFF');
}
function tree(ctx: Ctx, x: number, base: number, s: number) {
  box(ctx, x - 1.5 * s, base - 14 * s, 3 * s, 14 * s, '#7A5A3E');
  disc(ctx, x - 6 * s, base - 15 * s, 7 * s, mix(LEAF, INK, 0.12));
  disc(ctx, x + 6 * s, base - 16 * s, 7 * s, LEAF);
  disc(ctx, x, base - 21 * s, 9.5 * s, LEAF);
  disc(ctx, x - 2 * s, base - 25 * s, 4.5 * s, mix(LEAF, '#FFFFFF', 0.22));
}
/** A pastel town house, facade on the street; `base` is the pavement line. */
function house(ctx: Ctx, x: number, base: number, w: number, h: number, i: number) {
  const wall = PASTELS[i % PASTELS.length];
  const roof = ROOFS[i % ROOFS.length];
  const top = base - h;
  if (i % 3 === 1) box(ctx, x - 1, top - 5, w + 2, 5, mix(wall, INK, 0.2));
  else {
    box(ctx, x + w * 0.66, top - w * 0.34, 5, 11, mix(roof, INK, 0.2));
    poly(ctx, roof, [x - 3, top + 1, x + w / 2, top - w * 0.3, x + w + 3, top + 1]);
  }
  box(ctx, x, top, w, h, wall);
  box(ctx, x + w - 3, top, 3, h, mix(wall, INK, 0.1));
  const door = i % 2;
  const cols = w > 36 ? 2 : 1;
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < cols; c++) {
      const wx = x + (cols === 2 ? w * (0.18 + c * 0.44) : w * 0.35);
      const wy = top + 7 + r * h * 0.44;
      if (r === 1 && c === door) {
        box(ctx, wx, base - 17, 10, 17, mix(ROOFS[(i + 2) % 4], '#FFFFFF', 0.15));
        box(ctx, wx + 7, base - 9, 1.5, 1.5, '#F2C94C');
      } else {
        box(ctx, wx, wy, 10, 12, '#FFFFFF');
        box(ctx, wx + 1.5, wy + 1.5, 7, 9, '#9CC7DC');
      }
    }
}
/** A time-and-state plate in the corner: ATTEMPT 9, LAP 3, TRY 12. */
function plate(
  ctx: Ctx,
  text: string,
  amount: number,
  o: { pop?: number; squash?: number; color?: string } = {},
) {
  if (amount <= 0) return;
  const color = o.color ?? AMBER;
  ctx.save();
  ctx.globalAlpha *= clamp(amount);
  ctx.font = font('mono', 9);
  const w = Math.round(ctx.measureText(text).width) + 14,
    h = 16;
  ctx.translate(10 + w / 2, 10 + h / 2);
  const k = o.pop ?? 1;
  ctx.scale(k, k * (o.squash ?? 1));
  box(ctx, -w / 2, -h / 2, w, h, alpha('#141B26', 0.86));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
  write(ctx, text, 0, 3.5, { size: 9, color });
  ctx.restore();
}
function puffs(ctx: Ctx, x: number, y: number, t: number, t0: number, color: string, dir = -1) {
  const k = span(t, t0, t0 + 1.4);
  if (k <= 0 || k >= 1) return;
  for (let i = 0; i < 3; i++) {
    const q = clamp(k * 1.4 - i * 0.18);
    if (q <= 0) continue;
    disc(
      ctx,
      x + dir * (3 + q * 16 + i * 4),
      y - q * 7 - i * 1.5,
      1.8 + q * 5,
      alpha(color, (1 - q) * 0.75),
    );
  }
}

// ——— People: close-ups that can act ———
type Who = 'grace' | 'pike' | 'mourner';
type Eyes = 'open' | 'wide' | 'stare' | 'closed' | 'happy' | 'squeeze' | 'dizzy';
type Mouth = 'flat' | 'smile' | 'grin' | 'o' | 'wobble' | 'grit' | 'scream' | 'tight' | 'open';
type Face = {
  eyes?: Eyes;
  /** 0..1: how far the eyelids have come down (Mr. Pike's one blink). */
  lid?: number;
  look?: readonly [number, number];
  /** -1 worried … 1 cross. */
  brows?: number;
  raise?: number;
  mouth?: Mouth;
  /** Lifts the right-hand corner of a flat mouth. */
  corner?: number;
  turn?: number;
  tilt?: number;
  nod?: number;
  sweat?: number;
  blush?: number;
  /** Wind in Grace's curls, -1..1. */
  wind?: number;
  /** Swing of Mr. Pike's tie. */
  tie?: number;
  /** Dizzy pupils, as a phase. */
  spin?: number;
};
type Cast = {
  skin: string;
  shade: string;
  hair: string;
  hairD: string;
  hairL: string;
  coat: string;
  coatD: string;
  brow: string;
  rx: number;
  ry: number;
};
const CAST: Record<Who, Cast> = {
  grace: {
    skin: '#EDB894',
    shade: '#D29A74',
    hair: '#A8462A',
    hairD: '#80331E',
    hairL: '#CB6A42',
    coat: '#1FB0A2',
    coatD: '#178A7F',
    brow: '#6A2C1B',
    rx: 19,
    ry: 22.5,
  },
  pike: {
    skin: '#EFD3BC',
    shade: '#D4B299',
    hair: '#A6A8AD',
    hairD: '#83868D',
    hairL: '#C6C8CC',
    coat: '#C9B893',
    coatD: '#AA9A76',
    brow: '#6C6F76',
    rx: 17.5,
    ry: 24.5,
  },
  mourner: {
    skin: '#E8C6AA',
    shade: '#CBA68A',
    hair: '#C4BEB8',
    hairD: '#9E9791',
    hairL: '#DDD8D3',
    coat: '#2B2931',
    coatD: '#1E1C23',
    brow: '#8C857F',
    rx: 18,
    ry: 22,
  },
};

const SHOULDERS = [-44, 92, -41, 45, -17, 29, 17, 29, 41, 45, 44, 92];
function clothes(ctx: Ctx, who: Who, c: Cast, f: Face) {
  poly(ctx, c.coat, SHOULDERS);
  poly(ctx, c.coatD, [-44, 92, -41, 45, -29, 35, -31, 92]);
  if (who === 'grace') {
    poly(ctx, '#F47C5F', [-12, 28, 12, 28, 0, 54]);
    line(ctx, c.coatD, 1.6, [-12, 29, -3, 92]);
    line(ctx, c.coatD, 1.6, [12, 29, 3, 92]);
    for (const y of [58, 72, 86]) disc(ctx, -12 + ((y - 29) / 63) * 9 - 2.4, y, 1.9, '#F6F0E2');
    line(ctx, '#F2C94C', 0.6, [-6, 29, 0, 38, 6, 29]);
    disc(ctx, 0, 39.5, 1.7, '#F2C94C');
  } else if (who === 'pike') {
    poly(ctx, '#DFE2E6', [-11, 28, 11, 28, 0, 50]);
    ctx.save();
    ctx.translate(0, 30);
    ctx.rotate(f.tie ?? 0);
    poly(ctx, '#6A6F77', [-2.6, 0, 2.6, 0, 3.6, 16, 0, 21, -3.6, 16]);
    ctx.restore();
    poly(ctx, '#FFFFFF', [-10.5, 27, -1, 31, -6.5, 36]);
    poly(ctx, '#FFFFFF', [10.5, 27, 1, 31, 6.5, 36]);
    poly(ctx, c.coatD, [-11, 28, -3, 56, -18, 43]);
    poly(ctx, c.coatD, [11, 28, 3, 56, 18, 43]);
    box(ctx, -32, 56, 11, 1.4, c.coatD);
    line(ctx, BIRO, 1.6, [-27, 50, -26.5, 57]);
  } else {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.18 + i * 0.107);
      disc(ctx, Math.cos(a) * 11, 26 + Math.sin(a) * 10, 1.5, '#F2EEE6');
    }
    poly(ctx, c.coatD, [-12, 28, -3, 56, -18, 43]);
    poly(ctx, c.coatD, [12, 28, 3, 56, 18, 43]);
  }
}

const CURLS_BACK = [
  [-19, -12, 9],
  [-9, -21, 9.5],
  [4, -23, 9.5],
  [15, -17, 9],
  [22, -5, 8],
  [-23, -1, 8.5],
  [-24, 10, 7.5],
  [24, 8, 7.5],
  [-21, 19, 6.5],
  [22, 18, 6],
] as const;
const CURLS_FRONT = [
  [-13, -18, 6.5],
  [-3, -21.5, 6.8],
  [7.5, -20.5, 6.5],
  [15.5, -14, 5.5],
  [-18.5, -10, 5],
] as const;
function curls(ctx: Ctx, c: Cast, u: number, wind: number, back: boolean) {
  const list = back ? CURLS_BACK : CURLS_FRONT;
  const at = (cx: number, cy: number) =>
    [
      cx + u * (back ? 0.2 : 0.35) + wind * (3 + Math.abs(cx) * 0.3),
      cy - Math.abs(wind) * 1.5,
    ] as const;
  if (back)
    for (const [cx, cy, r] of list) {
      const [x, y] = at(cx, cy);
      disc(ctx, x, y, r, c.hairD);
    }
  for (const [cx, cy, r] of list) {
    const [x, y] = at(cx, cy);
    disc(ctx, x + (back ? 0 : 0), y - (back ? 1 : 0), back ? r * 0.72 : r, c.hair);
    if (!back) disc(ctx, x - r * 0.3, y - r * 0.35, r * 0.28, c.hairL);
  }
}

function eyesOf(ctx: Ctx, who: Who, c: Cast, f: Face, u: number) {
  const kind = f.eyes ?? (who === 'pike' ? 'stare' : 'open');
  const [lx, ly] = f.look ?? [0, 0];
  const gap = who === 'pike' ? 7.6 : 8;
  const ey = -2;
  const lid = clamp(f.lid ?? 0);
  for (const sd of [-1, 1]) {
    const ex = sd * gap + u;
    if (kind === 'open') {
      oval(ctx, ex, ey, 4.5, 4.9, '#FFFFFF');
      const px = ex + lx * 1.7,
        py = ey + ly * 1.7;
      oval(ctx, px, py + 0.4, 2.3, 2.6, INK);
      disc(ctx, px - 0.8, py - 0.5, 0.8, '#FFFFFF');
      line(ctx, INK, 1, [
        ex - 4.6,
        ey - 1.6,
        ex - 1.6,
        ey - 4.8,
        ex + 1.6,
        ey - 4.8,
        ex + 4.6,
        ey - 1.6,
      ]);
    } else if (kind === 'wide') {
      oval(ctx, ex, ey, 5.6, 6.4, '#FFFFFF');
      disc(ctx, ex + lx * 2.2, ey + ly * 2.2, 1.35, INK);
    } else if (kind === 'stare') {
      oval(ctx, ex, ey, 5.2, 5.4, '#FFFFFF');
      disc(ctx, ex + lx * 1.8, ey + ly * 1.8, 1.7, INK);
      disc(ctx, ex + lx * 1.8 - 0.6, ey + ly * 1.8 - 0.6, 0.5, '#FFFFFF');
      line(ctx, INK, 0.9, [
        ex - 5.4,
        ey - 1.2,
        ex - 2.2,
        ey - 5.3,
        ex + 2.2,
        ey - 5.3,
        ex + 5.4,
        ey - 1.2,
      ]);
      line(ctx, c.shade, 0.8, [ex - 4, ey + 6.8, ex, ey + 7.4, ex + 4, ey + 6.8]);
    } else if (kind === 'dizzy') {
      oval(ctx, ex, ey, 4.8, 5.2, '#FFFFFF');
      const a = (f.spin ?? 0) + (sd > 0 ? Math.PI : 0);
      disc(ctx, ex + Math.cos(a) * 2.2, ey + Math.sin(a) * 2.2, 1.8, INK);
    } else if (kind === 'closed')
      line(ctx, INK, 1.2, [ex - 4, ey + 1, ex, ey + 2.4, ex + 4, ey + 1]);
    else if (kind === 'happy')
      line(ctx, INK, 1.3, [ex - 4, ey + 1.5, ex, ey - 1.8, ex + 4, ey + 1.5]);
    else line(ctx, INK, 1.3, [ex + sd * 3.5, ey - 2.5, ex - sd * 3, ey, ex + sd * 3.5, ey + 2.5]);
    if (lid > 0 && (kind === 'stare' || kind === 'open' || kind === 'wide')) {
      const h = 6.6,
        w = 6.2;
      const edge = ey - h + 2 * h * lid;
      poly(ctx, c.skin, [ex - w, ey - h - 1, ex + w, ey - h - 1, ex + w, edge, ex - w, edge]);
      line(ctx, INK, 1.1, [ex - w + 0.8, edge, ex + w - 0.8, edge]);
    }
  }
  const b = f.brows ?? 0;
  for (const sd of [-1, 1]) {
    const ex = sd * gap + u;
    const lift = (who === 'pike' ? -9.2 : -10) - (f.raise ?? 0) * 4;
    line(ctx, c.brow, who === 'pike' ? 2.4 : 2.1, [
      ex + sd * 5,
      lift - b,
      ex - sd * 4,
      lift + b * 2.2,
    ]);
  }
  if (who === 'pike') line(ctx, c.shade, 0.8, [u - 0.5, -8.5, u - 0.3, -5.4]);
}

function mouthOf(ctx: Ctx, who: Who, f: Face, u: number) {
  const mx = u,
    my = who === 'pike' ? 15.5 : 14.5;
  const lip = who === 'grace' ? '#A8403A' : INK;
  switch (f.mouth ?? 'flat') {
    case 'flat': {
      const k = f.corner ?? 0;
      line(ctx, lip, 1.4, [mx - 5.5, my + 1, mx + 1.5, my + 1 - k * 0.2, mx + 5.8, my + 1 - k * 3]);
      if (k > 0.3)
        line(ctx, alpha(INK, (k - 0.3) * 0.8), 0.8, [mx + 6.6, my - 2.6, mx + 7.1, my - 0.6]);
      break;
    }
    case 'smile':
      line(ctx, lip, 1.5, [mx - 6, my, mx - 2.5, my + 2.8, mx + 2.5, my + 2.8, mx + 6, my]);
      break;
    case 'grin':
      poly(ctx, INK, [mx - 7.5, my - 1, mx + 7.5, my - 1, mx + 5, my + 5.5, mx - 5, my + 5.5]);
      box(ctx, mx - 6.5, my - 1, 13, 2.6, '#FFFFFF');
      oval(ctx, mx, my + 4, 3, 1.3, '#D8605A');
      break;
    case 'o':
      oval(ctx, mx, my + 1.5, 2.3, 2.9, INK);
      break;
    case 'open':
      oval(ctx, mx, my + 1.8, 4.4, 3.6, INK);
      oval(ctx, mx, my + 3.8, 2.6, 1.4, '#C8605A');
      break;
    case 'wobble':
      line(ctx, lip, 1.3, [
        mx - 6,
        my + 2,
        mx - 3,
        my + 0.8,
        mx,
        my + 2.2,
        mx + 3,
        my + 0.8,
        mx + 6,
        my + 2,
      ]);
      break;
    case 'grit':
      box(ctx, mx - 7, my - 2, 14, 6, INK);
      box(ctx, mx - 6, my - 1, 12, 4, '#FFFFFF');
      box(ctx, mx - 6, my + 0.6, 12, 0.7, alpha(INK, 0.6));
      break;
    case 'scream':
      oval(ctx, mx, my + 3, 7, 7.5, INK);
      oval(ctx, mx, my + 7.2, 4.5, 2.6, '#D8605A');
      box(ctx, mx - 5, my - 3.6, 10, 2.2, '#FFFFFF');
      break;
    case 'tight':
      line(ctx, lip, 1.5, [mx - 4, my + 1, mx + 4, my + 1]);
      line(ctx, alpha(INK, 0.5), 0.8, [mx - 5.4, my - 0.4, mx - 4, my + 1]);
      break;
  }
}

function hairFront(ctx: Ctx, who: Who, c: Cast, u: number, wind: number) {
  const h = (points: number[]) =>
    poly(
      ctx,
      c.hair,
      points.map((v, i) => (i % 2 ? v : v + u * 0.3)),
    );
  if (who === 'grace') curls(ctx, c, u, wind, false);
  else if (who === 'pike') {
    h([
      -18.3, -3, -18.8, -13, -15, -20.5, -7, -25.5, 3, -26.5, 12, -23.5, 17.5, -16, 18.3, -3, 16.8,
      -10, 13.5, -15.5, 5, -17.8, -3.5, -17.2, -6.5, -19.8, -9.5, -16.5, -14.5, -12.5, -16.8, -7,
    ]);
    line(ctx, c.hairD, 0.9, [-6.5 + u * 0.3, -19.8, -4.5 + u * 0.3, -25.5]);
    line(ctx, c.hairL, 0.8, [2 + u * 0.3, -24.5, 11 + u * 0.3, -21.5]);
  } else {
    h([
      -18, 2, -19, -10, -14, -19, -4, -23, 6, -23, 14, -19, 18.5, -10, 18, 2, 15, -8, 9, -14, 0,
      -15, -9, -14, -15, -8,
    ]);
    // A pillbox hat, and a veil.
    poly(ctx, '#1A181E', [
      -13 + u * 0.3,
      -19,
      13 + u * 0.3,
      -23,
      12.5 + u * 0.3,
      -31,
      -12.5 + u * 0.3,
      -27.5,
    ]);
    line(ctx, '#3E3B46', 1, [-12.5 + u * 0.3, -27.4, 12.5 + u * 0.3, -30.8]);
    disc(ctx, 9 + u * 0.3, -26, 2.2, '#5A4C66');
    poly(ctx, alpha('#1A181E', 0.3), [
      -17 + u * 0.3,
      -20,
      17 + u * 0.3,
      -24,
      18.5 + u,
      1,
      -18.5 + u,
      3,
    ]);
    for (let i = -2; i <= 2; i++) {
      line(ctx, alpha('#1A181E', 0.3), 0.5, [i * 7 - 5 + u * 0.5, -21, i * 7 + 5 + u * 0.8, 2]);
      line(ctx, alpha('#1A181E', 0.3), 0.5, [i * 7 + 5 + u * 0.5, -21, i * 7 - 5 + u * 0.8, 2]);
    }
  }
}

/** A head-and-shoulders close-up, about 40 × 50 at s = 1, centred on the face. */
function portrait(ctx: Ctx, who: Who, x: number, y: number, s: number, f: Face) {
  const c = CAST[who];
  const u = (f.turn ?? 0) * 6;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  clothes(ctx, who, c, f);
  box(ctx, -7 + u * 0.25, 10, 14, 20, c.shade);
  ctx.translate(0, 20);
  ctx.rotate(f.tilt ?? 0);
  ctx.translate(0, -20 + (f.nod ?? 0) * 3.5);
  if (who === 'grace') curls(ctx, c, u, f.wind ?? 0, true);
  if (who === 'mourner') disc(ctx, -13 + u * 0.2, -15, 7.5, c.hairD);
  if (u < 5) oval(ctx, -c.rx - 0.5 + u * 0.35, 2, 3.6, 5.6, c.skin);
  if (u > -5) oval(ctx, c.rx + 0.5 + u * 0.35, 2, 3.6, 5.6, c.skin);
  oval(ctx, u * 0.15, 0, c.rx, c.ry, c.skin);
  if (who === 'pike') oval(ctx, u * 0.15, 14, c.rx * 0.8, 8, alpha(c.shade, 0.2));
  eyesOf(ctx, who, c, f, u);
  if (who === 'pike') oval(ctx, u * 1.2, 5.5, 2.3, 4.6, c.shade);
  else oval(ctx, u * 1.15, 7, 2.4, 3, c.shade);
  oval(ctx, u * 1.15 - 0.7, 5.6, 1, 1.3, alpha('#FFFFFF', 0.3));
  mouthOf(ctx, who, f, u);
  if (f.blush)
    for (const sd of [-1, 1]) oval(ctx, sd * 11 + u, 7.5, 3.6, 2, alpha('#EE8A86', 0.5 * f.blush));
  hairFront(ctx, who, c, u, f.wind ?? 0);
  if (f.sweat && f.sweat > 0 && f.sweat < 1) {
    const dy = -12 + f.sweat * 20,
      dx = c.rx - 3 + u * 0.3;
    poly(ctx, '#CBEAF3', [dx, dy - 4, dx + 2.6, dy + 1, dx, dy + 3.6, dx - 2.6, dy + 1]);
    disc(ctx, dx - 0.8, dy, 0.7, '#FFFFFF');
  }
  ctx.restore();
}

/** A hand, fingers up, rotated by `a`; with an optional sleeve under it. */
function hand(ctx: Ctx, x: number, y: number, s: number, skin: string, a = 0, sleeve?: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  if (sleeve) box(ctx, -5.5, 3.5, 11, 18, sleeve);
  oval(ctx, 0, 0, 5.4, 5.8, skin);
  for (let i = 0; i < 4; i++) oval(ctx, -3.6 + i * 2.4, -5.8, 1.2, 2.6, skin);
  oval(ctx, -5.6, -0.5, 1.6, 3, skin);
  ctx.restore();
}

// ——— Tiny heads, for the cars on the road ———
type Tiny = 'calm' | 'wide' | 'shut' | 'happy' | 'bored' | 'low' | 'stare' | 'grit';
function tinyHead(ctx: Ctx, who: 'grace' | 'pike', x: number, y: number, mood: Tiny) {
  const c = CAST[who];
  if (mood === 'low') y += 4;
  if (who === 'grace') {
    disc(ctx, x - 3.6, y - 3.4, 3.8, c.hairD);
    disc(ctx, x - 5.2, y + 1.8, 3.2, c.hairD);
    disc(ctx, x + 1.2, y - 4.9, 3.7, c.hair);
    disc(ctx, x + 4.6, y - 2.6, 2.6, c.hair);
  }
  oval(ctx, x + 0.8, y + 0.2, 4.3, 5, c.skin);
  if (who === 'grace') disc(ctx, x - 0.4, y - 4.4, 2.6, c.hair);
  else
    poly(ctx, c.hair, [
      x - 3.6,
      y + 0.5,
      x - 3.8,
      y - 3.4,
      x - 1,
      y - 5.3,
      x + 3.2,
      y - 5,
      x + 5,
      y - 2.8,
      x + 1.5,
      y - 3.4,
      x - 1.6,
      y - 2.6,
      x - 2.2,
      y + 0.5,
    ]);
  const ex = x + 2,
    ey = y - 0.8,
    my = y + 2.6;
  if (mood === 'wide' || mood === 'stare') {
    box(ctx, ex - 0.8, ey - 1.5, 2.4, 3, '#FFFFFF');
    box(ctx, ex + 2.2, ey - 1.5, 2.4, 3, '#FFFFFF');
    box(ctx, ex + 0.1, ey - 0.5, 1, 1.1, INK);
    box(ctx, ex + 3.1, ey - 0.5, 1, 1.1, INK);
  } else if (mood === 'shut' || mood === 'low' || mood === 'bored') {
    box(ctx, ex - 0.6, ey + 0.3, 2.2, 0.8, INK);
    box(ctx, ex + 2.4, ey + 0.3, 2.2, 0.8, INK);
  } else if (mood === 'happy') {
    box(ctx, ex - 0.4, ey, 1.6, 0.8, INK);
    box(ctx, ex + 2.6, ey, 1.6, 0.8, INK);
  } else {
    box(ctx, ex, ey - 0.6, 0.9, 1.6, INK);
    box(ctx, ex + 2.8, ey - 0.6, 0.9, 1.6, INK);
  }
  if (mood === 'wide') box(ctx, x + 2.4, my - 0.4, 1.6, 1.8, INK);
  else if (mood === 'grit') box(ctx, x + 1.4, my - 0.2, 3.6, 1.4, '#FFFFFF');
  else if (mood === 'happy') {
    box(ctx, x + 1.4, my, 3.6, 1, INK);
    box(ctx, x + 1, my - 0.8, 0.8, 0.8, INK);
  } else box(ctx, x + 1.6, my + 0.2, 2.8, 0.7, INK);
}

// ——— The cars ———
const BODY = [
  -31, -7, -32.5, -21, -30, -34, -25.5, -40.5, 5, -40.5, 9.5, -37.5, 17.5, -26.5, 29, -23.5, 32.5,
  -19, 32.5, -10, 30.5, -7,
];
const PANE = [-27, -27.5, -25, -36.5, -22, -38.3, 3.5, -38.3, 7.5, -35.5, 14.5, -27.5];
type Side = {
  color?: string;
  facing?: 1 | -1;
  /** Nose-down tilt in radians. */
  pitch?: number;
  /** Distance travelled, to turn the wheels. */
  roll?: number;
  grace?: Tiny;
  pike?: Tiny;
  graceX?: number;
  lplate?: boolean;
  lights?: boolean;
  stretch?: number;
  /** Silhouettes behind tinted glass: the funeral cars. */
  mourners?: boolean;
};
/** A little hatchback in profile, about 64 × 42 at s = 1; (x, y) is the ground under its middle. */
function carSide(ctx: Ctx, x: number, y: number, s: number, o: Side = {}) {
  const body = o.color ?? CHERRY;
  const dark = mix(body, INK, 0.25),
    light = mix(body, '#FFFFFF', 0.3);
  const st = o.stretch ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (o.facing ?? 1), s);
  oval(ctx, 0, 0.5, 34 * st, 3.2, alpha(INK, 0.22));
  ctx.save();
  ctx.translate(0, -9);
  ctx.rotate(o.pitch ?? 0);
  ctx.translate(0, 9);
  ctx.save();
  ctx.scale(st, 1);
  poly(ctx, body, BODY);
  box(ctx, -31, -12.5, 62, 5.5, dark);
  poly(ctx, o.mourners ? '#15151A' : CABIN, PANE);
  ctx.restore();
  if (o.mourners)
    for (const hx of [-12, 4, 18]) {
      disc(ctx, hx * st, -31, 3.6, '#2C2B33');
      box(ctx, hx * st - 4, -36.5, 8, 2, '#2C2B33');
    }
  if (o.pike) tinyHead(ctx, 'pike', 8.5, -32, o.pike);
  if (o.grace) tinyHead(ctx, 'grace', 2 + (o.graceX ?? 0), -30.5, o.grace);
  ctx.save();
  ctx.scale(st, 1);
  poly(ctx, alpha(GLASS, o.mourners ? 0.12 : 0.28), PANE);
  line(ctx, alpha('#FFFFFF', 0.55), 1, [-20, -37, -24, -29]);
  box(ctx, -7.5, -38.3, 2.6, 11, body);
  line(ctx, light, 1, [-25, -39.8, 4.5, -39.8]);
  line(ctx, dark, 0.7, [-7, -27, -7, -12.5]);
  line(ctx, dark, 0.7, [14.5, -26.5, 15, -12.5]);
  box(ctx, 3.5, -24.5, 5, 1.4, dark);
  box(ctx, 27.5, -21.5, 4.5, 3.5, o.lights ? '#FFF3B8' : '#F2EEDC');
  box(ctx, -32.5, -23, 2.5, 5.5, '#8E1A26');
  box(ctx, -32.5, -17.5, 2.5, 2, AMBER);
  box(ctx, 28, -11.5, 5.5, 3, '#C3C8CE');
  box(ctx, -33.5, -11.5, 5.5, 3, '#C3C8CE');
  box(ctx, 12, -30, 3.5, 3.2, dark);
  box(ctx, -33.5, -8.5, 3, 1.6, '#55585E');
  ctx.restore();
  if (o.lights) glow(ctx, 31 * st, -20, 9, '#FFF3B8', 0.5);
  if (o.lplate) {
    box(ctx, 18, -22.5, 7, 7, '#FFFFFF');
    box(ctx, 19.6, -21.2, 1.4, 4.4, CHERRY);
    box(ctx, 19.6, -18.2, 3.6, 1.4, CHERRY);
  }
  ctx.restore();
  const r = (o.roll ?? 0) / 7;
  for (const wx of [-19, 20]) {
    const cx = wx * st;
    arch(ctx, cx, -7, 8.4, mix(body, INK, 0.55));
    disc(ctx, cx, -7, 7, TYRE);
    disc(ctx, cx, -7, 3.6, HUB);
    line(ctx, '#8C9198', 0.9, [
      cx - Math.cos(r) * 3,
      -7 - Math.sin(r) * 3,
      cx + Math.cos(r) * 3,
      -7 + Math.sin(r) * 3,
    ]);
  }
  ctx.restore();
}

/** The hearse: long, black, polished, and in no hurry. */
function hearse(ctx: Ctx, x: number, y: number, s: number, roll: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  oval(ctx, 0, 0.5, 48, 3.4, alpha(INK, 0.24));
  const body = '#1F1E24',
    trim = '#C9CDD3';
  poly(
    ctx,
    body,
    [-46, -7, -47, -33, -44, -41, 12, -41, 17, -38, 25, -27, 41, -24, 45, -19, 45, -10, 43, -7],
  );
  poly(ctx, '#DCE2E6', [-43, -21, -43, -37, 3, -37, 3, -21]);
  box(ctx, -40, -28, 38, 7, '#8C5B3B');
  box(ctx, -40, -28, 38, 1.5, '#A8744E');
  for (let i = 0; i < 9; i++) disc(ctx, -38 + i * 4.3, -29.5, 1.9, i % 2 ? '#F4F0E6' : '#F2A7B6');
  write(ctx, 'NAN', -21, -21.6, { size: 7, color: '#FFFFFF' });
  poly(ctx, CABIN, [7, -37, 11, -37, 18.5, -27.5, 7, -27.5]);
  oval(ctx, 11.5, -31, 2.8, 3.2, '#E6C2A6');
  box(ctx, 9, -40, 5, 6, '#111014');
  box(ctx, 7.6, -34.6, 7.8, 1.2, '#111014');
  poly(ctx, alpha(GLASS, 0.22), [7, -37, 11, -37, 18.5, -27.5, 7, -27.5]);
  box(ctx, 3.5, -38, 3, 27, body);
  line(ctx, trim, 1, [-46, -15, 44, -15]);
  line(ctx, alpha('#FFFFFF', 0.4), 1, [-44, -40, 11, -40]);
  line(ctx, trim, 1.2, [-12, -19, -8, -24, -2, -19]);
  box(ctx, 41, -12, 5, 3, trim);
  box(ctx, -48, -12, 5, 3, trim);
  box(ctx, 40.5, -22, 4, 3, '#FFF3B8');
  const r = roll / 7;
  for (const wx of [-30, 29]) {
    arch(ctx, wx, -7, 8.4, '#0E0E12');
    disc(ctx, wx, -7, 7, TYRE);
    disc(ctx, wx, -7, 3.6, trim);
    line(ctx, '#8C9198', 0.9, [
      wx - Math.cos(r) * 3,
      -7 - Math.sin(r) * 3,
      wx + Math.cos(r) * 3,
      -7 + Math.sin(r) * 3,
    ]);
  }
  ctx.restore();
}

/** The hatchback from behind, about 46 × 42 at s = 1; the rear wiper has a mind of its own. */
function carRear(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  o: { wipe?: number; squirt?: number; wave?: number },
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  oval(ctx, 0, 0.5, 26, 3, alpha(INK, 0.25));
  box(ctx, -22, -8, 7, 8, TYRE);
  box(ctx, 15, -8, 7, 8, TYRE);
  poly(ctx, CHERRY, [-23, -7, -23.5, -24, -19.5, -28, 19.5, -28, 23.5, -24, 23, -7]);
  poly(ctx, CHERRY, [-19.5, -27.5, -16, -41, 16, -41, 19.5, -27.5]);
  poly(ctx, CABIN, [-15.5, -29, -13.5, -38.5, 13.5, -38.5, 15.5, -29]);
  // Grace, from behind, on the driver's side.
  disc(ctx, 6.5, -32.5, 4.4, CAST.grace.hairD);
  disc(ctx, 4, -34.5, 3.4, CAST.grace.hair);
  disc(ctx, 9, -34, 3, CAST.grace.hair);
  poly(ctx, alpha(GLASS, 0.3), [-15.5, -29, -13.5, -38.5, 13.5, -38.5, 15.5, -29]);
  line(ctx, alpha('#FFFFFF', 0.5), 1, [-11, -37, -13, -31]);
  box(ctx, -23, -12, 46, 5, '#3A3D44');
  box(ctx, -22.5, -24, 5, 5, '#E0303C');
  box(ctx, 17.5, -24, 5, 5, '#E0303C');
  box(ctx, -22.5, -19.5, 5, 1.6, AMBER);
  box(ctx, 17.5, -19.5, 5, 1.6, AMBER);
  box(ctx, -8, -20, 16, 5, '#F4DE6A');
  for (let i = 0; i < 4; i++) box(ctx, -6 + i * 3.4, -19, 2, 3, '#3A3440');
  // The rear wiper.
  const a = Math.PI + (o.wipe ?? 0) * 2.9;
  line(ctx, '#15161A', 1.6, [0, -29.5, Math.cos(a) * 13, -29.5 + Math.sin(a) * 13]);
  disc(ctx, 0, -29.5, 1.6, '#2A2D33');
  const q = o.squirt ?? 0;
  if (q > 0 && q < 1)
    for (let i = 0; i < 6; i++) {
      const k = clamp(q * 1.6 - i * 0.1);
      disc(
        ctx,
        (i - 2.5) * 2.2 * k,
        -30 - Math.sin(k * Math.PI) * 11 - k * 2,
        1,
        alpha('#A8DDF2', 1 - k),
      );
    }
  // A cheerful arm out of the window.
  if (o.wave !== undefined) {
    const hx = 27 + Math.sin(o.wave) * 3,
      hy = -44 + Math.cos(o.wave) * 1.5;
    line(ctx, CAST.grace.coat, 3, [20, -33, hx, hy]);
    disc(ctx, hx, hy - 1, 2.2, CAST.grace.skin);
  }
  ctx.restore();
}

const TOP = [-18, -10, 17, -10, 20, -7, 20, 7, 17, 10, -18, 10, -20, 8, -20, -8];
/** A car from above, about 40 × 20 at s = 1, heading along angle `a`. */
function carTop(
  ctx: Ctx,
  x: number,
  y: number,
  a: number,
  s: number,
  o: {
    color?: string;
    blink?: boolean;
    lplate?: boolean;
    shadow?: readonly [number, number];
    ghost?: number;
    long?: number;
  } = {},
) {
  const body = o.color ?? CHERRY;
  const glass = '#2F3845';
  const long = o.long ?? 1;
  ctx.save();
  if (o.ghost !== undefined) ctx.globalAlpha *= o.ghost;
  ctx.translate(x, y);
  if (o.shadow) {
    ctx.save();
    ctx.translate(o.shadow[0], o.shadow[1]);
    ctx.rotate(a);
    ctx.scale(s * long, s);
    poly(ctx, alpha(INK, 0.22), TOP);
    ctx.restore();
  }
  ctx.rotate(a);
  ctx.scale(s * long, s);
  poly(ctx, body, TOP);
  poly(ctx, mix(body, '#FFFFFF', 0.14), [-9, -7.5, 5, -7.5, 5, 7.5, -9, 7.5]);
  poly(ctx, glass, [5, -7.5, 10.5, -8.6, 10.5, 8.6, 5, 7.5]);
  poly(ctx, glass, [-13.5, -8, -9, -7.5, -9, 7.5, -13.5, 8]);
  box(ctx, -9, -9.4, 14, 1.4, glass);
  box(ctx, -9, 8, 14, 1.4, glass);
  box(ctx, 6.5, -11.6, 3, 1.8, mix(body, INK, 0.3));
  box(ctx, 6.5, 9.8, 3, 1.8, mix(body, INK, 0.3));
  box(ctx, 18.4, -8, 1.8, 4, '#FFF3C4');
  box(ctx, 18.4, 4, 1.8, 4, '#FFF3C4');
  box(ctx, -20, -8, 1.8, 4, '#B0202E');
  box(ctx, -20, 4, 1.8, 4, '#B0202E');
  if (o.lplate) {
    box(ctx, 12.5, -3, 5.5, 5.5, '#FFFFFF');
    box(ctx, 13.6, -2, 1.1, 3.6, CHERRY);
    box(ctx, 13.6, 0.5, 2.8, 1.1, CHERRY);
  }
  if (o.blink) {
    box(ctx, 17, -10.5, 3, 2.5, AMBER);
    box(ctx, -19, -10.5, 3, 2.5, AMBER);
    glow(ctx, 18, -10, 6, AMBER, 0.6);
  }
  ctx.restore();
}

// ——— Ducks ———
function duck(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  facing: number,
  phase: number,
  mum: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * facing, s);
  oval(ctx, 0, 0.3, mum ? 6 : 3, 1, alpha(INK, 0.18));
  ctx.rotate(Math.sin(phase) * 0.14);
  if (mum) {
    poly(ctx, '#7E5E3E', [-5, -5, -9.5, -8, -6, -2.5]);
    oval(ctx, 0, -4.2, 6.5, 3.8, '#9A7650');
    oval(ctx, -1.5, -4.8, 3.6, 2, '#7E5E3E');
    disc(ctx, 5, -8.6, 2.7, '#8A6A45');
    box(ctx, 7, -8.9, 3.2, 1.5, '#E8902E');
    box(ctx, 5.4, -9.6, 1, 1, INK);
    box(ctx, -1, -0.8, 1.2, 1, '#E8902E');
  } else {
    oval(ctx, 0, -2.1, 3, 2.1, '#F5D451');
    disc(ctx, 2.5, -4.5, 1.8, '#F5D451');
    box(ctx, 4, -4.8, 1.7, 1, '#E8902E');
    box(ctx, 2.8, -5.2, 0.8, 0.8, INK);
  }
  ctx.restore();
}
/** Ducks from above, for the parking payoff. */
function duckTop(ctx: Ctx, x: number, y: number, s: number, mum: boolean) {
  const sz = mum ? 1.8 : 1;
  oval(ctx, x, y, 2.6 * sz * s, 3.6 * sz * s, mum ? '#9A7650' : '#F5D451');
  disc(ctx, x, y + 3.6 * sz * s, 1.6 * sz * s, mum ? '#8A6A45' : '#F2CC45');
  box(ctx, x - 0.6 * s, y + (3.6 * sz + 1.2 * sz) * s, 1.2 * s, 1.4 * s, '#E8902E');
}

// ——— The test centre car park ———
const BAY_Y = 144;
function carPark(ctx: Ctx, seconds: number) {
  sky(ctx, SKY, 0, 106);
  glow(ctx, 276, 22, 70, '#FFF1C0', 0.6);
  disc(ctx, 276, 22, 8, '#FFF7DC');
  const drift = seconds * 1.2;
  cloud(ctx, ((60 + drift) % 400) - 40, 24, 1);
  cloud(ctx, ((250 + drift * 0.7) % 400) - 40, 12, 0.75);
  tree(ctx, 12, 106, 1.3);
  tree(ctx, 232, 106, 1.5);
  tree(ctx, 256, 106, 1.9);
  tree(ctx, 304, 106, 1.4);
  box(ctx, 26, 50, 180, 56, '#E8E1D1');
  box(ctx, 22, 46, 188, 6, '#8E8A99');
  box(ctx, 26, 98, 180, 8, '#D2C9B5');
  for (let i = 0; i < 6; i++) {
    if (i === 3) continue;
    const wx = 36 + i * 28;
    box(ctx, wx, 60, 20, 18, '#FFFFFF');
    box(ctx, wx + 1.5, 61.5, 17, 15, '#A7CDE0');
    line(ctx, alpha('#FFFFFF', 0.6), 1, [wx + 4, 74, wx + 9, 63]);
  }
  box(ctx, 118, 66, 22, 40, '#FFFFFF');
  box(ctx, 120, 68, 18, 38, '#9CC4D8');
  box(ctx, 128.5, 68, 1, 38, '#FFFFFF');
  box(ctx, 112, 61, 34, 5, '#2F6F8F');
  box(ctx, 110, 45, 2, 4, '#6E6A78');
  box(ctx, 184, 45, 2, 4, '#6E6A78');
  box(ctx, 96, 30, 104, 16, '#FFFFFF');
  box(ctx, 96, 30, 104, 2.5, '#2F6F8F');
  write(ctx, 'DRIVING TEST CENTRE', 148, 42, { size: 7, color: '#24354A' });
  box(ctx, 0, 106, W, 6, PAVE);
  box(ctx, 0, 111, W, 2, KERB);
  box(ctx, 0, 113, W, 67, TARMAC);
  for (const bx of [8, 88, 216, 296])
    poly(ctx, PAINT, [bx, 115, bx + 2, 115, bx - 4, 148, bx - 6, 148]);
  box(ctx, 0, 166, W, 2, '#E8C44A');
  box(ctx, 0, 170, W, 2, '#E8C44A');
  box(ctx, 214, 64, 2, 48, '#5D6470');
  box(ctx, 208, 62, 10, 3, '#5D6470');
}

function openingShot(ctx: Ctx, t: number, seconds: number) {
  camera(
    ctx,
    track(t, [
      [0, 160, 90, 1],
      [0.8, 160, 90, 1],
      [4.5, 154, 112, 1.32],
    ]),
    () => {
      carPark(ctx, seconds);
      carSide(ctx, 46, BAY_Y - 2, 1, { color: '#B9A8DA' });
      carSide(ctx, 262, BAY_Y - 2, 1, { color: '#8FD3BC', facing: -1 });
      carSide(ctx, 152, BAY_Y, 1.1, { grace: 'wide', pike: 'stare', lplate: true });
    },
  );
}

function stallShot(ctx: Ctx, t: number, seconds: number) {
  const lurch = (k: number) => 8 * easeIn(span(t, STALLS[k] - 0.4, STALLS[k]));
  const x = 146 + lurch(0) + lurch(1);
  const hit = jolt(t, STALLS[0]) + jolt(t, STALLS[1]);
  const surge = hump(t, STALLS[0] - 0.4, STALLS[0]) + hump(t, STALLS[1] - 0.4, STALLS[1]);
  const stalled = within(t, STALLS[0], CHUGS[1]) || t >= STALLS[1];
  camera(ctx, { x: 154, y: 116 + hit * 1.2, zoom: 1.7 }, () => {
    carPark(ctx, seconds);
    carSide(ctx, 46, BAY_Y - 2, 1, { color: '#B9A8DA' });
    carSide(ctx, 262, BAY_Y - 2, 1, { color: '#8FD3BC', facing: -1 });
    carSide(ctx, x, BAY_Y, 1.1, {
      grace: stalled ? 'wide' : 'grit',
      pike: 'stare',
      lplate: true,
      pitch: 0.09 * hit - 0.03 * surge,
      roll: x,
      graceX: hit * 1.5,
    });
    for (const c of CHUGS) puffs(ctx, x - 37, BAY_Y - 9, t, c, '#E4E6EA');
    for (const c of STALLS) puffs(ctx, x - 37, BAY_Y - 9, t, c, '#6E7078');
  });
}

// ——— Inside the car: the two-shot through the windscreen ———
type Hands = 'wheel' | 'mirror' | 'flail' | 'horn' | 'fists' | 'hug';
type Cabin = {
  outside: 'carpark' | 'streak';
  speed?: number;
  grace: Face;
  pike: Face;
  hands?: Hands;
  reach?: number;
  lean?: number;
  hug?: number;
  aloft?: number;
  write?: number;
  wipe?: number;
  jump?: number;
  sway?: number;
};
const GX = 104,
  GY = 86,
  PX = 216,
  PY = 83,
  SEAT_S = 0.95;

/** What the rear window shows. */
function behind(ctx: Ctx, kind: Cabin['outside'], seconds: number, speed: number) {
  wash(ctx, 0, 96, [SKY[0], SKY[2]]);
  if (kind === 'carpark') {
    tree(ctx, 68, 92, 2.2);
    box(ctx, 110, 42, 220, 52, '#E8E1D1');
    box(ctx, 106, 38, 228, 5, '#8E8A99');
    for (let i = 0; i < 5; i++) {
      box(ctx, 122 + i * 40, 52, 22, 18, '#FFFFFF');
      box(ctx, 124 + i * 40, 54, 18, 14, '#A7CDE0');
    }
    box(ctx, 0, 88, W, 10, PAVE);
  } else {
    const off = seconds * speed;
    for (let i = 0; i < 8; i++) {
      const x = ((((i * 58 - off) % 464) + 464) % 464) - 72;
      box(ctx, x, 46, 54, 50, PASTELS[i % 7]);
      box(ctx, x + 10, 54, 10, 12, '#FFFFFF');
      box(ctx, x + 32, 54, 10, 12, '#FFFFFF');
    }
    if (speed > 200)
      for (let i = 0; i < 9; i++) {
        const x = ((((i * 71 - off * 1.4) % 460) + 460) % 460) - 70;
        box(ctx, x, 40 + ((i * 13) % 50), 46, 1.2, alpha('#FFFFFF', 0.6));
      }
    box(ctx, 0, 88, W, 10, PAVE);
  }
}

function graceArms(ctx: Ctx, o: Cabin, g: { x: number; y: number }, seconds: number) {
  const c = CAST.grace;
  const L = { x: g.x - 30, y: g.y + 44 },
    R = { x: g.x + 30, y: g.y + 44 };
  const reach = o.reach ?? 0;
  let lh = { x: 76, y: 141 },
    rh = { x: 132, y: 141 };
  switch (o.hands ?? 'wheel') {
    case 'mirror':
      rh = { x: lerp(132, 150, reach), y: lerp(141, 24, reach) };
      break;
    case 'flail':
      lh = { x: 78 + Math.sin(seconds * 11) * 10, y: 114 + Math.sin(seconds * 7) * 12 };
      rh = { x: 134 + Math.sin(seconds * 9 + 1) * 10, y: 110 + Math.sin(seconds * 8 + 2) * 12 };
      break;
    case 'horn':
      lh = { x: 97, y: 150 };
      rh = { x: 111, y: 150 };
      break;
    case 'fists':
      lh = { x: 72, y: 50 + Math.sin(seconds * 14) * 3 };
      rh = { x: 136, y: 48 + Math.sin(seconds * 14 + 1) * 3 };
      break;
    case 'hug':
      lh = { x: 250, y: 132 };
      rh = { x: 242, y: 104 };
      break;
  }
  line(ctx, c.coatD, 8, [L.x, L.y, lh.x, lh.y + 4]);
  line(ctx, c.coat, 8, [R.x, R.y, rh.x, rh.y + 4]);
  const fist = o.hands === 'fists';
  hand(ctx, lh.x, lh.y, 0.85, c.skin, fist ? 0 : -0.3);
  hand(ctx, rh.x, rh.y, 0.85, c.skin, fist ? 0 : 0.3);
}

function pikeLap(ctx: Ctx, o: Cabin, seconds: number) {
  const c = CAST.pike;
  const up = o.aloft ?? 0;
  if (up > 0) {
    // Hugged: one arm out stiff as a signpost, the clipboard held well clear.
    const hx = lerp(238, 294, up),
      hy = lerp(128, 66, up);
    line(ctx, c.coat, 8, [PX + 30, PY + 44, hx, hy + 3]);
    ctx.save();
    ctx.translate(hx, hy - 8);
    ctx.rotate(-0.25 * up);
    box(ctx, -12, -24, 26, 30, BOARD);
    box(ctx, -5, -27, 12, 5, '#C9CDD2');
    ctx.restore();
    hand(ctx, hx, hy, 0.85, c.skin, 0.6);
    hand(ctx, lerp(186, 170, up), lerp(130, 96, up), 0.85, c.skin, -0.5);
    return;
  }
  box(ctx, 194, 122, 44, 30, BOARD);
  box(ctx, 194, 122, 44, 2, mix(BOARD, '#FFFFFF', 0.2));
  box(ctx, 208, 118, 16, 6, '#C9CDD2');
  hand(ctx, 196, 134, 0.85, c.skin, -0.3);
  const w = o.write ?? 0;
  const px = 228 + (w ? Math.sin(seconds * 13) * 7 : 0),
    py = 121 + (w ? Math.sin(seconds * 41) * 1.5 : 0);
  line(ctx, BIRO, 1.6, [px + 1, py - 3, px - 3, py - 14]);
  hand(ctx, px, py, 0.85, c.skin, 0.2);
}

function wiperArm(ctx: Ctx, x: number, y: number, len: number, sweep: number) {
  const a = Math.PI + sweep * 1.95;
  const c = Math.cos(a),
    s = Math.sin(a);
  line(ctx, '#1C1E22', 2.2, [x, y, x + c * len * 0.92, y + s * len * 0.92]);
  const nx = -s * 1.6,
    ny = c * 1.6;
  line(ctx, '#0E0F12', 3.2, [
    x + c * len * 0.3 + nx,
    y + s * len * 0.3 + ny,
    x + c * len + nx,
    y + s * len + ny,
  ]);
  disc(ctx, x, y, 3, '#2A2D33');
}
/** The little four-leaf clover hanging from the mirror: Grace's lucky charm. */
function charm(ctx: Ctx, x: number, y: number, swing: number) {
  const ex = x + Math.sin(swing) * 10,
    ey = y + Math.cos(swing) * 10;
  line(ctx, '#EDE6D6', 0.6, [x, y, ex, ey]);
  for (const [dx, dy] of [
    [-1.6, -1.6],
    [1.6, -1.6],
    [-1.6, 1.6],
    [1.6, 1.6],
  ])
    disc(ctx, ex + dx, ey + dy + 2, 1.9, '#4FAE5C');
}

function cabin(ctx: Ctx, seconds: number, o: Cabin) {
  behind(ctx, o.outside, seconds, o.speed ?? 0);
  // The inside of the car behind them.
  box(ctx, 0, 0, W, 24, LINING);
  poly(ctx, '#CAC2B1', [0, 24, 46, 24, 32, 98, 0, 98]);
  poly(ctx, '#CAC2B1', [W, 24, W - 46, 24, W - 32, 98, W, 98]);
  box(ctx, 30, 88, W - 60, 9, '#3E424A');
  box(ctx, 0, 97, W, 83, '#565C67');
  const lean = o.lean ?? 0;
  const hug = o.hug ?? 0;
  const breathe = Math.sin(seconds * 2.2) * 0.6;
  const seat = (x: number) => {
    box(ctx, x - 14, 48, 28, 20, SEAT);
    disc(ctx, x - 14, 58, 10, SEAT);
    disc(ctx, x + 14, 58, 10, SEAT);
    box(ctx, x - 31, 70, 62, 110, SEAT);
    box(ctx, x - 20, 76, 40, 104, '#565B66');
  };
  seat(GX);
  seat(PX);
  // Mr. Pike.
  ctx.save();
  ctx.translate(PX, 172);
  ctx.rotate(lean);
  ctx.translate(-PX, -172);
  portrait(ctx, 'pike', PX, PY, SEAT_S, o.pike);
  pikeLap(ctx, o, seconds);
  ctx.restore();
  // Grace.
  const g = {
    x: GX + hug * 62,
    y: GY + hug * 6 - (o.jump ?? 0) + breathe * (o.hands === 'wheel' ? 1 : 0),
  };
  ctx.save();
  ctx.translate(GX, 172);
  ctx.rotate(lean + hug * 0.28);
  ctx.translate(-GX, -172);
  portrait(ctx, 'grace', g.x, g.y, SEAT_S, o.grace);
  if (hug <= 0) graceArms(ctx, o, g, seconds);
  ctx.restore();
  if (hug > 0) graceArms(ctx, o, g, seconds);
  // The rear-view mirror, from behind, and the charm.
  line(ctx, '#2F3238', 3, [160, 6, 160, 14]);
  box(ctx, 136, 13, 48, 13, '#2F3238');
  disc(ctx, 136, 19.5, 6.5, '#2F3238');
  disc(ctx, 184, 19.5, 6.5, '#2F3238');
  charm(ctx, 160, 26, (o.sway ?? 0) + Math.sin(seconds * 2.4) * 0.12);
  // The dashboard, the wheel and its stalks.
  poly(ctx, DASH, [0, 150, 60, 146, 160, 148, 260, 146, W, 150, W, H, 0, H]);
  line(ctx, '#474C56', 1.2, [0, 150, 60, 146, 160, 148, 260, 146, W, 150]);
  line(ctx, '#3E424B', 1, [184, 162, 262, 161]);
  line(ctx, '#34373E', 3, [98, 156, 64, 149]);
  box(ctx, 60, 146.5, 6, 4, AMBER);
  line(ctx, '#34373E', 3, [110, 156, 144, 149]);
  box(ctx, 142, 146.5, 6, 4, '#9CC7DC');
  if (hug <= 0 && o.hands !== 'hug') {
    ring(ctx, GX, 154, 34, 20, '#1D1F24', 5.5);
    oval(ctx, GX, 156, 9, 6, '#2A2D34');
    line(ctx, '#2A2D34', 4, [GX - 32, 158, GX - 8, 156]);
    line(ctx, '#2A2D34', 4, [GX + 32, 158, GX + 8, 156]);
    // Hands go on top of the rim.
    if (o.hands === 'wheel' || o.hands === 'mirror' || o.hands === 'horn') {
      const c = CAST.grace;
      if (o.hands === 'horn') {
        hand(ctx, 97, 150, 0.85, c.skin, -0.2);
        hand(ctx, 111, 150, 0.85, c.skin, 0.2);
      } else {
        hand(ctx, 76, 141, 0.85, c.skin, -0.3);
        if (o.hands === 'wheel') hand(ctx, 132, 141, 0.85, c.skin, 0.3);
      }
    }
  } else {
    ring(ctx, GX, 154, 34, 20, '#1D1F24', 5.5);
    oval(ctx, GX, 156, 9, 6, '#2A2D34');
  }
  // The windscreen: frame, glass, wipers.
  poly(ctx, CHERRY, [0, 0, 22, 0, 7, 172, 0, 172]);
  poly(ctx, CHERRY, [W, 0, W - 22, 0, W - 7, 172, W, 172]);
  line(ctx, '#1D1F24', 2, [22, 0, 7, 172]);
  line(ctx, '#1D1F24', 2, [W - 22, 0, W - 7, 172]);
  box(ctx, 0, 0, W, 6, CHERRY);
  box(ctx, 0, 6, W, 2, '#1D1F24');
  poly(ctx, alpha('#FFFFFF', 0.06), [60, 8, 112, 8, 42, 172, -10, 172]);
  poly(ctx, alpha('#FFFFFF', 0.05), [128, 8, 140, 8, 70, 172, 58, 172]);
  box(ctx, 0, 171, W, 9, CHERRY);
  box(ctx, 0, 171, W, 1.5, '#1D1F24');
  box(ctx, 0, 173, W, 1, CHERRY_L);
  const wipe = o.wipe ?? 0;
  wiperArm(ctx, 100, 170, 118, wipe);
  wiperArm(ctx, 224, 170, 110, wipe);
}

// ——— Mr. Pike, up close ———
type Outlook = 'carpark' | 'street' | 'crossing' | 'hearse';
/** A strip of the world outside a side window, across the whole frame (y 0 to 130). */
function outlook(ctx: Ctx, kind: Outlook, seconds: number) {
  wash(ctx, 0, 130, kind === 'hearse' ? ['#9FC6DA', '#DDE9EE'] : [SKY[0], SKY[2]]);
  if (kind === 'carpark') {
    tree(ctx, 300, 120, 3);
    box(ctx, 150, 44, 140, 86, '#E8E1D1');
    box(ctx, 146, 38, 150, 7, '#8E8A99');
    for (let i = 0; i < 3; i++) {
      box(ctx, 164 + i * 42, 58, 26, 24, '#FFFFFF');
      box(ctx, 166 + i * 42, 60, 22, 20, '#A7CDE0');
    }
    box(ctx, 0, 116, W, 14, PAVE);
  } else {
    for (let i = 0; i < 5; i++)
      house(ctx, 150 + i * 60, 124, 56, 70, i + (kind === 'hearse' ? 3 : 0));
    box(ctx, 0, 120, W, 10, PAVE);
    if (kind === 'crossing') {
      box(ctx, 262, 50, 3, 76, '#2A2A30');
      for (let k = 0; k < 6; k++) box(ctx, 262, 56 + k * 12, 3, 6, '#FFFFFF');
      const on = 0.6 + Math.sin(seconds * 3) * 0.4;
      glow(ctx, 263.5, 46, 16, AMBER, 0.4 * on);
      disc(ctx, 263.5, 46, 6, mix('#C67A1E', AMBER, on));
    }
    if (kind === 'hearse') {
      box(ctx, 196, 12, 16, 50, '#CFC8BA');
      poly(ctx, '#8E877B', [194, 13, 204, -14, 214, 13]);
    }
  }
}

function pikeClose(ctx: Ctx, seconds: number, f: Face, kind: Outlook, o: { write?: number } = {}) {
  outlook(ctx, kind, seconds);
  // The car around him: his window on the right, the back seat on the left.
  box(ctx, 0, 0, W, 16, LINING);
  poly(ctx, '#4F5561', [0, 16, 176, 16, 164, 180, 0, 180]);
  // The rear side window: a sliver of sky and a treetop.
  poly(ctx, SKY[1], [12, 26, 72, 22, 66, 68, 12, 72]);
  poly(ctx, ROOFS[1], [40, 60, 54, 49, 67, 58, 66, 68, 40, 68]);
  oval(ctx, 30, 66, 16, 6, LEAF);
  line(ctx, '#2A2D33', 2, [12, 26, 72, 22, 66, 68, 12, 72, 12, 26]);
  poly(ctx, '#5F6571', [164, 118, W, 112, W, H, 160, H]);
  line(ctx, '#474C57', 1.4, [176, 136, W, 132]);
  line(ctx, '#2A2D33', 2, [176, 16, 164, 118, W, 112]);
  poly(ctx, '#454A55', [144, 30, 184, 30, 192, 38, 192, 72, 136, 72, 136, 38]);
  box(ctx, 108, 72, 112, 108, SEAT);
  portrait(ctx, 'pike', 164, 98, 1.7, f);
  // The clipboard, held to his chest; the pen, always ready.
  ctx.save();
  ctx.translate(90, 164);
  ctx.rotate(-0.12);
  box(ctx, -34, -22, 68, 60, BOARD);
  box(ctx, -29, -16, 58, 54, PAPER);
  for (let i = 0; i < 5; i++) box(ctx, -24, -8 + i * 6, 40, 1, '#C9CFDA');
  box(ctx, -10, -26, 20, 9, '#C9CDD2');
  ctx.restore();
  const w = o.write ?? 0;
  const px = 108 + (w ? Math.sin(seconds * 13) * 8 : 0),
    py = 158 + (w ? Math.sin(seconds * 41) * 1.5 : 0);
  line(ctx, BIRO, 2.4, [px, py, px - 6, py + 14]);
  hand(ctx, px + 4, py + 10, 1.5, CAST.pike.skin, 0.5, CAST.pike.coat);
}

// ——— Grace, up close ———
function graceClose(ctx: Ctx, t: number, seconds: number) {
  const shut = t >= SHUT && t < OPEN;
  const exhale = within(t, EXHALE, EXHALE + 0.8);
  wash(ctx, 0, 130, [SKY[0], SKY[2]]);
  house(ctx, -10, 124, 70, 80, 4);
  house(ctx, 64, 124, 62, 74, 5);
  box(ctx, 0, 120, 150, 10, PAVE);
  carSide(ctx, 70, 150, 1.6, { color: '#8FD3BC' });
  // Her side of the car.
  box(ctx, 0, 0, W, 14, LINING);
  poly(ctx, '#4F5561', [144, 14, W, 14, W, H, 156, H]);
  poly(ctx, '#5F6571', [0, 118, 156, 124, 156, H, 0, H]);
  line(ctx, '#2A2D33', 2, [0, 118, 156, 124, 144, 14]);
  poly(ctx, '#454A55', [140, 26, 180, 26, 188, 34, 188, 72, 132, 72, 132, 34]);
  box(ctx, 104, 72, 112, 108, SEAT);
  portrait(ctx, 'grace', 160, 104 + Math.sin(seconds * 2.2) * 0.8, 2.1, {
    eyes: shut ? 'closed' : t < SHUT ? 'wide' : 'open',
    brows: t < SHUT ? -1 : t < OPEN ? -0.3 : 0.4,
    raise: t < SHUT ? 0.7 : 0,
    mouth: t < SHUT ? 'wobble' : exhale ? 'o' : 'tight',
    sweat: span(t, 68.8, SHUT + 0.4),
    turn: 0.12,
    look: t >= OPEN ? [0.3, 0] : [0, 0],
    blush: t < SHUT ? 0.6 : 0,
  });
  if (exhale) {
    const k = span(t, EXHALE, EXHALE + 0.8);
    for (let i = 0; i < 3; i++)
      line(ctx, alpha('#FFFFFF', (1 - k) * 0.7), 1.2, [
        164 + i * 5,
        142 + k * 6,
        172 + i * 7 + k * 14,
        150 + k * 12,
      ]);
  }
  // A second bead of sweat, on the other temple.
  if (t < SHUT) {
    const k = span(t, 69.2, 70.2);
    if (k > 0) {
      const dy = 80 + k * 30;
      poly(ctx, '#CBEAF3', [124, dy - 6, 127.5, dy + 1, 124, dy + 5, 120.5, dy + 1]);
    }
  }
}

// ——— The mirror, the stalks and the wipers ———
function mirrorShot(ctx: Ctx, t: number, seconds: number) {
  const tilt = ease(span(t, TILT, TILT + 0.8));
  camera(
    ctx,
    track(t, [
      [9, 160, 90, 1],
      [11.3, 164, 86, 1.08],
    ]),
    () => {
      wash(ctx, 0, 130, [SKY[0], SKY[2]]);
      glow(ctx, 40, 20, 60, '#FFF1C0', 0.5);
      box(ctx, 0, 84, W, 60, '#E8E1D1');
      box(ctx, 0, 80, W, 5, '#8E8A99');
      for (let i = 0; i < 6; i++) {
        box(ctx, 10 + i * 54, 96, 30, 26, '#FFFFFF');
        box(ctx, 12 + i * 54, 98, 26, 22, '#A7CDE0');
      }
      tree(ctx, 280, 96, 2.4);
      box(ctx, 0, 150, W, 30, DASH);
      box(ctx, 0, 0, W, 20, LINING);
      poly(ctx, '#CAC2B1', [0, 20, 92, 20, 86, 40, 0, 44]);
      line(ctx, '#B8AF9C', 1, [0, 44, 86, 40, 92, 20]);
      ctx.save();
      ctx.translate(172, 76);
      ctx.rotate(lerp(-0.05, 0.08, tilt) + jolt(t, TILT + 0.8, 6, 20) * 0.02);
      line(ctx, '#2F3238', 6, [0, -76, 0, -34]);
      box(ctx, -100, -34, 200, 68, '#2B2E34');
      disc(ctx, -100, 0, 34, '#2B2E34');
      disc(ctx, 100, 0, 34, '#2B2E34');
      ctx.save();
      ctx.beginPath();
      ctx.rect(-116, -28, 232, 56);
      ctx.clip();
      reflection(ctx, tilt, t, seconds);
      ctx.restore();
      line(ctx, alpha('#FFFFFF', 0.35), 2, [-90, -22, -60, 24]);
      line(ctx, alpha('#FFFFFF', 0.25), 1.2, [-70, -22, -46, 14]);
      ctx.restore();
      hand(ctx, 280 + tilt * 2, 96 - tilt * 6, 2.3, CAST.grace.skin, -0.5, CAST.grace.coat);
    },
  );
}
/** What the rear-view mirror sees: the road behind, then, tilted, her own face. */
function reflection(ctx: Ctx, tilt: number, t: number, seconds: number) {
  const dy = tilt * 124;
  box(ctx, -120, -30, 240, 60, '#DCD5C7');
  ctx.save();
  ctx.translate(0, -dy);
  wash(ctx, -40, 60, [SKY[0], SKY[2]], -120, 240);
  for (let i = 0; i < 5; i++) house(ctx, -120 + i * 50, 14, 48, 34, i + 2);
  box(ctx, -120, 14, 240, 20, TARMAC);
  box(ctx, -2, 22, 4, 12, PAINT);
  box(ctx, -120, -40, 30, 80, '#CAC2B1');
  box(ctx, 90, -40, 30, 80, '#CAC2B1');
  box(ctx, -80, 22, 44, 30, SEAT);
  box(ctx, 36, 22, 44, 30, SEAT);
  ctx.restore();
  ctx.save();
  ctx.translate(0, 124 - dy);
  ctx.scale(-1, 1);
  const dart = t > 10.5 ? Math.sin(seconds * 5) * 0.5 : 0;
  portrait(ctx, 'grace', 0, 8, 2.3, {
    eyes: 'wide',
    brows: -1,
    raise: t > 10.4 ? 1 : 0.5,
    look: [dart, 0],
    mouth: 'wobble',
  });
  ctx.restore();
}

function stalk(ctx: Ctx, x: number, y: number, a: number, len: number, tip: string) {
  const ex = x + Math.cos(a) * len,
    ey = y + Math.sin(a) * len;
  line(ctx, '#50555E', 6, [x, y, ex, ey]);
  line(ctx, '#737983', 1.2, [x, y - 1.6, ex, ey - 1.6]);
  line(ctx, tip, 6, [lerp(x, ex, 0.76), lerp(y, ey, 0.76), ex, ey]);
}

function povShot(ctx: Ctx, t: number, seconds: number) {
  const wipe = wiper(t, FLICK, WIPERS_OFF);
  const reach = ease(span(t, SIGNAL - 0.1, FLICK - 0.05));
  const press = span(t, FLICK - 0.08, FLICK + 0.06);
  camera(
    ctx,
    track(t, [
      [14.5, 160, 94, 1.04],
      [16.8, 160, 92, 1.1],
    ]),
    () => {
      // Ahead: the way out of the car park and the town beyond.
      wash(ctx, 0, 84, [SKY[0], SKY[2]]);
      glow(ctx, 250, 20, 60, '#FFF1C0', 0.5);
      cloud(ctx, ((80 + seconds * 1.5) % 400) - 40, 30, 1.1);
      for (let i = 0; i < 7; i++) house(ctx, -10 + i * 48, 80, 46, 30 + (i % 3) * 6, i + 1);
      box(ctx, 0, 80, W, 6, PAVE);
      box(ctx, 0, 86, W, 50, TARMAC);
      poly(ctx, PAINT, [158, 88, 162, 88, 128, 132, 118, 132]);
      poly(ctx, PAINT, [182, 88, 186, 88, 238, 132, 228, 132]);
      poly(ctx, PAINT, [168, 104, 176, 104, 180, 118, 164, 118]);
      poly(ctx, PAINT, [160, 104, 172, 94, 184, 104]);
      // The wipers, outside the glass.
      wiperArm(ctx, 96, 114, 150, wipe);
      wiperArm(ctx, 226, 114, 140, wipe);
      // Inside.
      box(ctx, 0, 0, W, 16, LINING);
      poly(ctx, '#3A3E46', [0, 16, 30, 16, 6, 120, 0, 120]);
      poly(ctx, '#3A3E46', [W, 16, W - 30, 16, W - 6, 120, W, 120]);
      poly(ctx, DASH, [0, 116, 90, 110, 230, 110, W, 116, W, H, 0, H]);
      line(ctx, '#4A4F59', 1.2, [0, 116, 90, 110, 230, 110, W, 116]);
      oval(ctx, 140, 122, 46, 12, '#25282E');
      box(ctx, 120, 116, 40, 6, '#1A1C20');
      // The mirror, still aimed at her own face.
      box(ctx, 124, 12, 92, 24, '#2F3238');
      ctx.save();
      ctx.beginPath();
      ctx.rect(127, 15, 86, 18);
      ctx.clip();
      box(ctx, 127, 15, 86, 18, '#E9D6C6');
      ctx.translate(170, 24);
      ctx.scale(-1, 1);
      portrait(ctx, 'grace', 0, 3, 1.4, {
        eyes: t < FLICK ? 'open' : 'wide',
        look: t < SIGNAL ? [0, -0.2] : [0.3, 0.7],
        brows: -0.8,
        raise: 0.5,
      });
      ctx.restore();
      line(ctx, alpha('#FFFFFF', 0.4), 1.2, [132, 30, 140, 17]);
      // The stalks: wipers on the left, the indicator on the right.
      box(ctx, 114, 124, 52, 16, '#24272C');
      stalk(ctx, 118, 131, Math.PI + 0.12 - press * 0.4, 48, '#9CC7DC');
      stalk(ctx, 162, 131, -0.12, 48, AMBER);
      // The wheel.
      ring(ctx, 140, 214, 104, 76, '#1D1F24', 12);
      ring(ctx, 140, 214, 104, 76, '#3A3D44', 2, Math.PI * 1.15, Math.PI * 1.85);
      const c = CAST.grace;
      hand(
        ctx,
        lerp(52, 76, reach),
        lerp(166, 138 + press * 8, reach),
        2,
        c.skin,
        lerp(-0.3, 0.25, reach),
        c.coat,
      );
      hand(ctx, 228, 166, 2, c.skin, 0.3, c.coat);
      // Mr. Pike, at the edge of frame, entirely still.
      box(ctx, 286, 124, 40, 60, CAST.pike.coat);
      box(ctx, 286, 124, 5, 60, CAST.pike.coatD);
      poly(ctx, BOARD, [262, 180, 270, 142, 320, 136, 320, 180]);
      poly(ctx, PAPER, [270, 180, 276, 148, 320, 143, 320, 180]);
    },
  );
}

// ——— The zebra crossing ———
const ZEBRA = [190, 222] as const;
function duckU(T: number) {
  if (T < 27.6) return 0;
  if (T < 40) return (T - 27.6) / 12.4;
  if (T < 43) return 1;
  if (T < 53) return 1 - (T - 43) / 10;
  if (T < 56) return 0;
  if (T < 66) return (T - 56) / 10;
  return 1 + (T - 66) / 5;
}
const duckBack = (T: number) => T >= 43 && T < 53;
function beacon(ctx: Ctx, x: number, base: number, h: number, seconds: number) {
  box(ctx, x - 1.5, base - h, 3, h, '#2A2A30');
  for (let k = 0; k < h / 10; k++) box(ctx, x - 1.5, base - h + 5 + k * 10, 3, 5, '#FFFFFF');
  const on = 0.6 + Math.sin(seconds * 3) * 0.4;
  glow(ctx, x, base - h - 3, 12, AMBER, 0.4 * on);
  disc(ctx, x, base - h - 3, 4, mix('#C67A1E', AMBER, on));
}
function street(ctx: Ctx, T: number, seconds: number, lapse: number) {
  wash(ctx, 0, 112, [mix(SKY[0], '#78BCE6', lapse), mix(SKY[2], '#F6E7C4', lapse * 0.7)]);
  const sx = lerp(40, 222, lapse),
    sy = 26 - Math.sin(lapse * Math.PI) * 12;
  glow(ctx, sx, sy, 50, '#FFF1C0', 0.6);
  disc(ctx, sx, sy, 7, '#FFF7DC');
  const drift = T * 5;
  cloud(ctx, ((90 + drift) % 400) - 40, 30, 1);
  cloud(ctx, ((300 + drift * 0.8) % 400) - 40, 16, 0.7);
  // The town-hall clock.
  box(ctx, 250, 16, 28, 90, '#E3D6C0');
  poly(ctx, '#7B6A5A', [247, 17, 264, -4, 281, 17]);
  disc(ctx, 264, 32, 9.5, '#FFFFFF');
  ring(ctx, 264, 32, 9.5, 9.5, '#5A4E44', 1.2);
  const minutes = 12 + (T - 26.8) * 0.9;
  const m = (minutes / 60) * TAU - Math.PI / 2,
    hr = ((9 + minutes / 60) / 12) * TAU - Math.PI / 2;
  line(ctx, INK, 1.1, [264, 32, 264 + Math.cos(m) * 7.5, 32 + Math.sin(m) * 7.5]);
  line(ctx, INK, 1.6, [264, 32, 264 + Math.cos(hr) * 5, 32 + Math.sin(hr) * 5]);
  for (let i = 0; i < 7; i++) house(ctx, -6 + i * 47, 110, 45, 56 + ((i * 7) % 3) * 7, i + 1);
  // The sun swings the shadows across the fronts of the houses.
  const lean = lerp(-14, 14, lapse);
  for (let i = 0; i < 7; i++) {
    const x = -6 + i * 47 + (lean < 0 ? 0 : 45);
    poly(ctx, alpha('#3A3450', 0.12), [x, 110, x, 70, x - lean * 0.8, 70, x - lean, 110]);
  }
  box(ctx, 0, 108, W, 8, PAVE);
  box(ctx, 0, 115, W, 2, KERB);
  box(ctx, 0, 117, W, 43, TARMAC);
  for (let x = 0; x < W; x += 24)
    if (x + 12 < ZEBRA[0] - 22 || x > ZEBRA[1] + 22) box(ctx, x, 137.5, 12, 1.5, PAINT);
  for (const [a, b] of [
    [120, ZEBRA[0] - 6],
    [ZEBRA[1] + 6, 300],
  ]) {
    for (const y of [120, 156]) {
      const pts: number[] = [];
      for (let x = a, k = 0; x <= b; x += 6, k++) pts.push(x, y + (k % 2 ? 1.6 : -1.6));
      line(ctx, PAINT, 1, pts);
    }
  }
  for (let k = 0; k < 8; k += 2) box(ctx, ZEBRA[0], 117 + k * 5.4, ZEBRA[1] - ZEBRA[0], 5.4, PAINT);
  box(ctx, 0, 160, W, 2, KERB);
  box(ctx, 0, 162, W, 18, PAVE);
  // Shadows of the beacons wheel round with the sun.
  const sh = lerp(0.9, -0.9, lapse);
  poly(ctx, alpha(INK, 0.16), [
    ZEBRA[0] - 5,
    113,
    ZEBRA[0] - 3,
    113,
    ZEBRA[0] - 3 + sh * 26,
    108,
    ZEBRA[0] - 5 + sh * 26,
    108,
  ]);
  beacon(ctx, ZEBRA[0] - 4, 113, 26, seconds);
}
const WALKERS = [
  { skin: '#E8B998', hair: '#6B4A34', coat: '#7D9BC9', legs: '#3F444C', speed: 15, off: 20 },
  { skin: '#8E5A3E', hair: '#2A1E1C', coat: '#E28E6A', legs: '#4A4F58', speed: -12, off: 170 },
  { skin: '#F0C8A8', hair: '#C9A66B', coat: '#9C7FBE', legs: '#3A3F4A', speed: 18, off: 300 },
] as const;
function crossingShot(ctx: Ctx, t: number, seconds: number, lapsing: boolean) {
  const T = lapseT(t);
  const k = clamp((T - LAPSE) / ((LAPSE_END - LAPSE) * FAST));
  const view = lapsing
    ? { x: 160, y: 90, zoom: 1 }
    : track(t, [
        [26.8, 150, 94, 1.02],
        [29.8, 178, 112, 1.22],
      ]);
  camera(ctx, view, () => {
    street(ctx, T, seconds, k);
    WALKERS.forEach((w, i) => {
      const x = ((((T * w.speed + w.off) % 380) + 380) % 380) - 30;
      person(ctx, x, 112, {
        skin: w.skin,
        hair: w.hair,
        coat: w.coat,
        legs: w.legs,
        build: 'adult',
        size: 0.72,
        facing: w.speed > 0 ? 1 : -1,
        step: T * 9 + i,
        hairStyle: i === 1 ? 'bun' : 'short',
      });
    });
    const arrive = easeOut(span(t, 26.8, HALT));
    const cx = lerp(96, 149, arrive);
    const moods: Tiny[] = ['happy', 'calm', 'bored', 'low', 'wide', 'bored'];
    const mood: Tiny =
      t < 28.2 ? 'calm' : t < LAPSE ? 'happy' : moods[Math.floor(T / 5) % moods.length];
    carSide(ctx, cx, 155, 1.15, {
      grace: mood,
      pike: 'stare',
      lplate: true,
      roll: cx,
      pitch: jolt(t, HALT, 6, 16) * 0.05,
    });
    for (let d = 5; d >= 0; d--) {
      const DT = T - d * 1.15;
      const u = duckU(DT);
      let x = u <= 1 ? lerp(199, 214, u) : 214 + (u - 1) * 90;
      let y = u <= 1 ? lerp(114, 168, u) : 168;
      // Ducklings queue along the far kerb, then fall in behind their mother.
      if (u < 0.1 && !duckBack(DT)) {
        const k = u / 0.1;
        x = lerp(199 + d * 6.5, lerp(199, 214, 0.1), k);
        y = lerp(112, lerp(114, 168, 0.1), k);
      }
      const still = u === 0 && !duckBack(DT);
      duck(
        ctx,
        x,
        y,
        d ? 1 : 1.1,
        duckBack(DT) ? -1 : 1,
        still ? seconds * 5 + d : T * 12 + d,
        d === 0,
      );
    }
    beacon(ctx, ZEBRA[1] + 7, 172, 36, seconds);
  });
}

// ——— The hill and the hearse ———
const SLOPE = -0.19;
const roadY = (x: number) => 176 + x * Math.tan(SLOPE);
function hillShot(ctx: Ctx, t: number, seconds: number) {
  const hx = 262 + 5 * (t - 37);
  const cx =
    t < LURCH
      ? 158 - 7 * ease(span(t, ROLLBACK, ROLLBACK + 0.5))
      : lerp(151, hx - 100, backOut(span(t, LURCH, LURCH + 0.45)));
  camera(
    ctx,
    track(t, [
      [37, 170, 112, 1.15],
      [41, 216, 100, 1.2],
    ]),
    () => {
      wash(ctx, -60, 240, [SKY[0], SKY[2]], -40, 520);
      glow(ctx, 70, 10, 60, '#FFF1C0', 0.5);
      cloud(ctx, ((140 + seconds * 1.2) % 460) - 40, 18, 1);
      for (let i = 0; i < 9; i++) {
        const x = -20 + i * 50;
        if (i === 7) {
          const b = roadY(x) - 28;
          box(ctx, x + 6, b - 58, 40, 58, '#DCD4C4');
          box(ctx, x + 18, b - 92, 16, 36, '#DCD4C4');
          poly(ctx, '#8E877B', [x + 16, b - 91, x + 26, b - 124, x + 36, b - 91]);
          disc(ctx, x + 26, b - 76, 5, '#9CC7DC');
          box(ctx, x + 20, b - 26, 12, 26, '#6E5A48');
          continue;
        }
        house(ctx, x, roadY(x) - 27, 48, 60, i + 3);
      }
      const band = (a: number, b: number, color: string) =>
        poly(ctx, color, [
          -60,
          roadY(-60) + a,
          500,
          roadY(500) + a,
          500,
          roadY(500) + b,
          -60,
          roadY(-60) + b,
        ]);
      band(-34, -26, PAVE);
      band(-27, -25, KERB);
      band(-25, 10, TARMAC);
      band(10, 12, KERB);
      band(12, 120, PAVE);
      for (let x = -40; x < 480; x += 26) {
        const y = roadY(x) - 8;
        line(ctx, PAINT, 1.4, [x, y, x + 12, y + 12 * Math.tan(SLOPE)]);
      }
      const place = (x: number, paint: () => void) => {
        ctx.save();
        ctx.translate(x, roadY(x) - 2);
        ctx.rotate(SLOPE);
        paint();
        ctx.restore();
      };
      place(hx, () => hearse(ctx, 0, 0, 1.05, hx));
      const kick = jolt(t, LURCH, 5, 14);
      place(cx, () => {
        carSide(ctx, 0, 0, 1.1, {
          grace: t < REV ? 'wide' : 'grit',
          pike: 'stare',
          lplate: true,
          roll: cx,
          pitch: -0.06 * kick + (within(t, REV, LURCH) ? Math.sin(seconds * 60) * 0.008 : 0),
        });
        puffs(ctx, -37, -9, t, REV, '#D8DADF');
        puffs(ctx, -37, -9, t, LURCH, '#9A9CA3');
      });
    },
    { w: 440, h: 180 },
  );
}

// ——— The procession ———
function shopfront(ctx: Ctx, x: number, base: number, i: number) {
  const wall = PASTELS[(i * 3) % PASTELS.length];
  box(ctx, x, base - 70, 64, 70, wall);
  box(ctx, x, base - 74, 64, 5, mix(wall, INK, 0.2));
  box(ctx, x + 8, base - 62, 14, 14, '#FFFFFF');
  box(ctx, x + 42, base - 62, 14, 14, '#FFFFFF');
  box(ctx, x + 9.5, base - 60.5, 11, 11, '#9CC7DC');
  box(ctx, x + 43.5, base - 60.5, 11, 11, '#9CC7DC');
  box(ctx, x + 4, base - 30, 40, 26, '#A7CDE0');
  box(ctx, x + 48, base - 28, 12, 28, mix(wall, INK, 0.35));
  const stripe = ['#E0585E', '#4E9A8A', '#E8A33A', '#6A7FC0'][i % 4];
  for (let k = 0; k < 8; k++) box(ctx, x + k * 8, base - 40, 8, 7, k % 2 ? '#FFFFFF' : stripe);
  box(ctx, x + 6, base - 48, 52, 7, '#FFFFFF');
  write(ctx, ['BAKERY', 'FLORIST', 'BOOKS', 'CAFE', 'HARDWARE'][i % 5], x + 32, base - 42.5, {
    size: 5,
    color: '#3A3440',
  });
}
function processionShot(ctx: Ctx, t: number, seconds: number) {
  const tau = t - 41;
  const hx = 262 + 18 * tau,
    cx = hx - 104,
    l1 = cx - 94,
    l2 = l1 - 94;
  camera(
    ctx,
    { x: 170 + 17 * tau, y: 94, zoom: 1.02 },
    () => {
      wash(ctx, 0, 112, [SKY[0], SKY[2]], 0, 720);
      for (let i = 0; i < 11; i++) shopfront(ctx, i * 66, 110, i);
      box(ctx, 0, 108, 720, 8, PAVE);
      box(ctx, 0, 115, 720, 2, KERB);
      box(ctx, 0, 117, 720, 43, TARMAC);
      for (let x = 0; x < 720; x += 24) box(ctx, x, 137.5, 12, 1.5, PAINT);
      box(ctx, 0, 160, 720, 2, KERB);
      box(ctx, 0, 162, 720, 18, PAVE);
      // A gentleman takes his cap off for the hearse, and keeps it off for Grace.
      const doff = ease(span(t, HATS - 0.4, HATS + 0.2));
      const bow = hump(t, 44.2, 45.3) * 0.3 + doff * 0.12;
      const man = {
        skin: '#E8B998',
        hair: '#9A9A9A',
        coat: '#6E7F6A',
        legs: '#3F444C',
        build: 'adult' as const,
        facing: 1 as const,
        hat: doff > 0.5 ? ('none' as const) : ('cap' as const),
        hatColor: '#5A4E44',
        lean: bow,
        arms: [0.1, lerp(0.1, 1.9, doff)] as const,
        hairStyle: 'bald' as const,
      };
      person(ctx, 225, 114, man);
      if (doff > 0.5) {
        box(ctx, 231 + bow * 4, 88 + bow * 6, 7, 3, '#5A4E44');
        box(ctx, 229 + bow * 4, 90 + bow * 6, 4, 1.5, '#4A4038');
      }
      person(ctx, 128, 114, {
        skin: '#8E5A3E',
        hair: '#2A1E1C',
        coat: '#C98A8A',
        legs: '#4A4F58',
        build: 'adult',
        facing: 1,
        hairStyle: 'bun',
        lean: 0.18,
        eyes: 'closed',
        mouth: 'flat',
      });
      box(ctx, 136, 98, 16, 10, '#5A6E8A');
      disc(ctx, 139, 110, 3, '#2A2A30');
      disc(ctx, 150, 110, 3, '#2A2A30');
      hearse(ctx, hx, 152, 1.05, hx);
      carSide(ctx, cx, 153, 1.05, {
        grace: tau < 2.5 ? 'wide' : 'grit',
        pike: 'stare',
        lplate: true,
        roll: cx,
      });
      carSide(ctx, l1, 152, 1.05, {
        color: '#232228',
        stretch: 1.3,
        mourners: true,
        lights: true,
        roll: l1,
      });
      carSide(ctx, l2, 152, 1.05, {
        color: '#232228',
        stretch: 1.3,
        mourners: true,
        lights: true,
        roll: l2,
      });
      glow(ctx, hx + 48, 132, 10, '#FFF3B8', 0.4 + Math.sin(seconds) * 0.05);
    },
    { w: 720, h: 180 },
  );
}

// ——— A nod, at the lights ———
function mournerShot(ctx: Ctx, t: number, seconds: number) {
  const nod = hump(t, NOD, NOD + 1.1);
  const nodBack = hump(t, NOD_BACK, NOD_BACK + 1.1);
  const glance = t > 45.9;
  camera(
    ctx,
    track(t, [
      [45.3, 160, 92, 1],
      [49.5, 172, 94, 1.08],
    ]),
    () => {
      // Beyond the red car: the street.
      wash(ctx, 0, 120, [SKY[0], SKY[2]]);
      for (let i = 0; i < 6; i++) house(ctx, 100 + i * 52, 70, 50, 44, i + 4);
      box(ctx, 100, 70, 220, 60, PAVE);
      // The red car alongside: its far windows, its seats, and the two of them.
      box(ctx, 120, 64, 200, 70, '#474C57');
      box(ctx, 176, 46, 36, 24, SEAT);
      box(ctx, 238, 44, 36, 24, SEAT);
      portrait(ctx, 'pike', 258, 86, 0.85, { eyes: 'stare', turn: 0.05 });
      portrait(ctx, 'grace', 196, 88, 0.95, {
        eyes: 'open',
        look: glance ? [-1, 0.1] : [0.7, 0],
        turn: glance ? -0.55 : 0.25,
        nod: nodBack,
        mouth: t < NOD ? 'tight' : t < NOD_BACK ? 'grit' : 'flat',
        brows: -0.8,
        raise: t < NOD_BACK ? 0.4 : 0.1,
        blush: t > NOD ? 0.8 : 0,
      });
      if (t > NOD_BACK + 0.1)
        hand(
          ctx,
          196,
          128 - ease(span(t, NOD_BACK + 0.1, NOD_BACK + 0.6)) * 8,
          0.9,
          CAST.grace.skin,
          0.1,
          CAST.grace.coat,
        );
      poly(ctx, CHERRY, [110, 128, W, 122, W, H, 110, H]);
      line(ctx, mix(CHERRY, INK, 0.25), 1, [150, 132, 150, 180]);
      box(ctx, 168, 142, 12, 2.6, mix(CHERRY, INK, 0.3));
      line(ctx, CHERRY_L, 1, [110, 131, W, 125]);
      poly(ctx, CHERRY, [298, 28, W, 26, W, 124, 312, 124]);
      line(ctx, '#1D1F24', 3, [126, 128, 134, 34, 298, 30, 312, 124]);
      box(ctx, 110, 20, 210, 8, CHERRY);
      poly(ctx, alpha(GLASS, 0.16), [128, 128, 136, 34, 298, 30, 312, 124]);
      line(ctx, alpha('#FFFFFF', 0.4), 1.5, [150, 40, 138, 110]);
      // We are inside the black car: tinted glass, and its dark frame.
      box(ctx, 90, 0, 230, H, alpha('#1B2230', 0.14));
      poly(ctx, '#1C1B21', [0, 0, W, 0, W, 12, 100, 16, 90, 160, W, 158, W, H, 0, H]);
      line(ctx, '#34323B', 2, [W, 12, 100, 16, 90, 160, W, 158]);
      // The mourner, her back to us, veiled, perfectly kind.
      portrait(ctx, 'mourner', 58, 108, 1.35, {
        eyes: 'open',
        look: [1, 0.1],
        turn: 0.85,
        nod,
        mouth: t > 48.6 ? 'smile' : 'flat',
        brows: -0.3,
      });
      glow(ctx, 40, 150, 40, '#0B0E14', 0.3 + Math.sin(seconds * 0.5) * 0.02);
    },
  );
}

// ——— The roundabout, from above ———
const RB = { x: 160, y: 90 } as const;
function roundaboutShot(ctx: Ctx, t: number) {
  const th = ringAngle(t);
  const spin = -0.22 * (th - RING_FROM) - 0.1 * (t - 51.5);
  const zoom = lerp(1.05, 1.28, ease(span(t, 51.5, 57.6)));
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(spin);
  ctx.scale(zoom, zoom);
  ctx.translate(-RB.x, -RB.y);
  box(ctx, -80, -140, 480, 460, GRASS);
  // Four corners of town: roofs, gardens, trees.
  for (const [qx, qy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    for (let i = 0; i < 3; i++) {
      const hx = RB.x + qx * (56 + i * 34) - 14,
        hy = RB.y + qy * (84 + (i % 2) * 16) - 11;
      const roof = PASTELS[(i + (qx > 0 ? 2 : 0) + (qy > 0 ? 4 : 0)) % PASTELS.length];
      box(ctx, hx, hy, 28, 22, mix(roof, INK, 0.12));
      box(ctx, hx, hy, 28, 11, roof);
      box(ctx, hx, hy + 10.5, 28, 1, mix(roof, INK, 0.3));
    }
    for (let i = 0; i < 3; i++) {
      const tx = RB.x + qx * (84 + i * 30),
        ty = RB.y + qy * (40 + i * 7);
      disc(ctx, tx, ty, 7, LEAF);
      disc(ctx, tx - 2, ty - 2, 3.5, mix(LEAF, '#FFFFFF', 0.2));
    }
  }
  // Roads and pavements.
  box(ctx, RB.x - 27, -140, 54, 460, PAVE);
  box(ctx, -80, RB.y - 27, 480, 54, PAVE);
  box(ctx, RB.x - 22, -140, 44, 460, TARMAC);
  box(ctx, -80, RB.y - 22, 480, 44, TARMAC);
  for (let k = 0; k < 7; k++) {
    const d = 74 + k * 24;
    box(ctx, RB.x - 0.8, RB.y - d - 12, 1.6, 12, PAINT);
    box(ctx, RB.x - 0.8, RB.y + d, 1.6, 12, PAINT);
    box(ctx, RB.x - d - 12, RB.y - 0.8, 12, 1.6, PAINT);
    box(ctx, RB.x + d, RB.y - 0.8, 12, 1.6, PAINT);
  }
  disc(ctx, RB.x, RB.y, 67, PAVE);
  disc(ctx, RB.x, RB.y, 63, TARMAC);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU;
    line(ctx, PAINT, 1.2, [
      RB.x + Math.cos(a) * 45,
      RB.y + Math.sin(a) * 45,
      RB.x + Math.cos(a + 0.13) * 45,
      RB.y + Math.sin(a + 0.13) * 45,
    ]);
  }
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    for (const r of [64, 67])
      for (let k = -2; k <= 2; k++) {
        const c = Math.cos(a),
          s = Math.sin(a);
        box(ctx, RB.x + c * r - s * k * 8 - 1.5, RB.y + s * r + c * k * 8 - 1.5, 3, 3, PAINT);
      }
  disc(ctx, RB.x, RB.y, 29, PAVE);
  disc(ctx, RB.x, RB.y, 27, '#7FBF6A');
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU;
    disc(ctx, RB.x + Math.cos(a) * 20, RB.y + Math.sin(a) * 20, 2.4, k % 2 ? '#F2A7B6' : '#F6DE6A');
  }
  disc(ctx, RB.x, RB.y, 10, LEAF);
  disc(ctx, RB.x - 3, RB.y - 3, 4.5, mix(LEAF, '#FFFFFF', 0.25));
  // Everyone else waits their turn, for ever.
  carTop(ctx, RB.x + 84, RB.y - 11, Math.PI, 0.9, { color: '#F2C94C', shadow: [2, 2] });
  carTop(ctx, RB.x + 124, RB.y - 11, Math.PI, 0.9, { color: '#7DA7D9', shadow: [2, 2] });
  carTop(ctx, RB.x + 11, RB.y - 84, Math.PI / 2, 0.9, { color: '#EDEDED', shadow: [2, 2] });
  carTop(ctx, RB.x - 11, RB.y + 118, -Math.PI / 2, 0.9, { color: '#B9A8DA', shadow: [2, 2] });
  // Grace, going round.
  let x: number, y: number, a: number;
  if (t < RING_IN) {
    const k = easeOut(span(t, 51.5, RING_IN));
    x = RB.x - 11;
    y = lerp(RB.y + 150, RB.y + 58, k);
    a = -Math.PI / 2;
  } else {
    x = RB.x + Math.cos(th) * 45 * 0.98;
    y = RB.y + Math.sin(th) * 45;
    const onto = ease(span(t, RING_IN, RING_IN + 0.3));
    a = lerp(-Math.PI / 2, th + Math.PI / 2 - TAU, onto);
    if (onto >= 1) a = th + Math.PI / 2;
  }
  carTop(ctx, x, y, a, 0.95, { blink: Math.floor(t * 3) % 2 === 0, lplate: true, shadow: [2, 2] });
  ctx.restore();
}

// ——— Parallel parking, from above ———
const START = [212, 90, 0] as const;
const SPOT = [147, 57.5, 0] as const;
const BAD: readonly (readonly [number, number, number])[] = [
  [156, 72, 0.42],
  [126, 44, 0.5],
  [147, 76, 0.04],
  [118, 59, 0.1],
  [142, 36, 0.95],
  [147, 57.5, Math.PI],
  [176, 98, 0.8],
  [147, 25, 0],
  [147, 60, Math.PI / 2],
  [130, 70, -0.2],
  [150, 61, 0.1],
];
function parkingStreet(ctx: Ctx, seconds: number, sun: number) {
  box(ctx, -40, -40, 400, 260, TARMAC);
  for (let i = 0; i < 9; i++) {
    const roof = PASTELS[(i * 2) % PASTELS.length];
    box(ctx, -20 + i * 44, -30, 42, 44, mix(roof, INK, 0.1));
    box(ctx, -20 + i * 44, -30, 42, 24, roof);
  }
  box(ctx, -40, 14, 400, 27, PAVE);
  for (let x = -32; x < 360; x += 16) box(ctx, x, 14, 1, 27, mix(PAVE, INK, 0.08));
  box(ctx, -40, 40, 400, 3, KERB);
  const sh = [Math.cos(sun) * 4, Math.sin(sun) * 4] as const;
  for (const tx of [30, 270]) {
    disc(ctx, tx + sh[0] * 2, 27 + sh[1] * 2, 11, alpha(INK, 0.15));
    disc(ctx, tx, 27, 11, LEAF);
    disc(ctx, tx - 3, 24, 5, mix(LEAF, '#FFFFFF', 0.2));
  }
  for (let x = -30; x < 360; x += 20) box(ctx, x, 110.5, 10, 1.6, PAINT);
  box(ctx, -40, 150, 400, 3, KERB);
  box(ctx, -40, 153, 400, 60, PAVE);
  // The van and the little green car, with a gap between them that is plenty big enough.
  carTop(ctx, 70, 57.5, 0, 1, { color: '#4F79B8', long: 1.4, shadow: sh });
  carTop(ctx, 216, 57.5, 0, 1, { color: '#8FD3BC', shadow: sh });
  void seconds;
}
function parkingShot(ctx: Ctx, t: number, seconds: number, mode: 'arrive' | 'lapse' | 'glide') {
  const sun = mode === 'lapse' ? lerp(0.4, 2.8, span(t, 62.2, 66.8)) : mode === 'glide' ? 2.8 : 0.4;
  const view =
    mode === 'arrive'
      ? { x: 160, y: 88, zoom: 1.02 }
      : mode === 'lapse'
        ? { x: 156, y: 80, zoom: 1.12 }
        : track(t, [
            [71.6, 158, 78, 1.12],
            [GLIDE_END, 150, 64, 1.5],
          ]);
  camera(ctx, view, () => {
    parkingStreet(ctx, seconds, sun);
    const sh = [Math.cos(sun) * 4, Math.sin(sun) * 4] as const;
    if (mode === 'arrive') {
      const k = easeOut(span(t, 59.5, 61.4));
      carTop(ctx, lerp(-30, START[0], k), START[1], 0, 1, { lplate: true, shadow: sh });
    } else if (mode === 'lapse') {
      const n = tries(t);
      const from = TRIES[n - 1],
        to = TRIES[n] ?? 66.8;
      const k = ease(clamp((t - from) / ((to - from) * 0.6)));
      const bad = BAD[n - 1];
      for (let g = 3; g >= 1; g--) {
        const q = clamp(k - g * 0.22);
        if (q <= 0 || q >= 1) continue;
        carTop(ctx, lerp(START[0], bad[0], q), lerp(START[1], bad[1], q), lerp(0, bad[2], q), 1, {
          ghost: 0.18,
        });
      }
      carTop(ctx, lerp(START[0], bad[0], k), lerp(START[1], bad[1], k), lerp(0, bad[2], k), 1, {
        lplate: true,
        shadow: sh,
      });
    } else {
      const u = ease(span(t, GLIDE, GLIDE_END));
      const bounce = 1 + jolt(t, SETTLE, 7, 22) * 0.04;
      const x = lerp(START[0], SPOT[0], u),
        y = lerp(START[1], SPOT[1], ease(u)),
        a = 0.55 * Math.sin(Math.PI * u);
      carTop(ctx, x, y, a, bounce, { lplate: true, shadow: sh });
      // The ducks, who have seen it all, approve.
      const k = ease(span(t, 73.5, 75.5));
      duckTop(ctx, 126 + k * 6, 26, 1.2, true);
      for (let d = 1; d <= 4; d++)
        duckTop(ctx, 126 + k * 6 - d * 7, 26 + (d % 2) * 1.5, 1.2, false);
    }
  });
}

// ——— The clipboard ———
function scribbleLine(ctx: Ctx, x0: number, y: number, x1: number, seed: number) {
  if (x1 <= x0 + 1) return;
  const pts: number[] = [];
  for (let x = x0, k = 0; x <= x1; x += 2.2, k++)
    pts.push(x, y + Math.sin(k * 1.9 + seed) * 1.6 + (rand(seed + k) - 0.5) * 1.2);
  line(ctx, BIRO, 0.9, pts);
}
function clipboardShot(ctx: Ctx, t: number, seconds: number) {
  const n = tries(t);
  const page2 = t >= FLIP_PAGE + 0.25;
  const flip = span(t, FLIP_PAGE, FLIP_PAGE + 0.25);
  camera(
    ctx,
    track(t, [
      [66.8, 160, 96, 1.04],
      [68.8, 160, 104, 1.12],
    ]),
    () => {
      box(ctx, 0, 0, W, H, '#8C8577');
      line(ctx, '#7C7568', 2, [30, 0, 40, 180]);
      line(ctx, '#7C7568', 2, [290, 0, 282, 180]);
      ctx.save();
      ctx.translate(160, 100);
      ctx.rotate(-0.04);
      box(ctx, -100, -96, 200, 200, BOARD);
      box(ctx, -90, -80, 180, 190, PAPER);
      write(ctx, page2 ? 'REPORT (CONT.)' : 'DRIVING TEST REPORT', 0, -66, {
        size: 7,
        color: '#2C3E50',
      });
      box(ctx, -80, -60, 160, 0.8, '#9AA5B5');
      if (!page2) {
        const rows = ['MIRRORS', 'SIGNALS', 'CONTROL', 'JUNCTIONS', 'PARKING'];
        rows.forEach((label, i) => {
          const y = -48 + i * 13;
          write(ctx, label, -80, y, { size: 6, color: '#2C3E50', align: 'left' });
          box(ctx, -80, y + 3, 160, 0.6, '#C9CFDA');
        });
        for (let k = 0; k < 4; k++) {
          const x = -18 + k * 10;
          line(ctx, BIRO, 1, [x, -54, x + 5, -49]);
          line(ctx, BIRO, 1, [x + 5, -54, x, -49]);
        }
        write(ctx, 'wipers?!', 4, -35, { size: 8, type: 'italic', color: BIRO, align: 'left' });
        write(ctx, 'stalled x2', -18, -22, { size: 8, type: 'italic', color: BIRO, align: 'left' });
        write(ctx, 'ducks. roundabout x4', -18, -9, {
          size: 8,
          type: 'italic',
          color: BIRO,
          align: 'left',
        });
        // The parking row: a tally, one mark per try.
        for (let k = 0; k < n; k++) {
          const group = Math.floor(k / 5),
            j = k % 5;
          const gx = -18 + group * 16;
          if (j < 4) line(ctx, BIRO, 1, [gx + j * 3, 0, gx + j * 3 + 0.6, 6]);
          else line(ctx, BIRO, 1, [gx - 2, 5, gx + 12, 1]);
        }
        for (let r = 0; r < 4; r++) {
          const y = 22 + r * 12;
          box(ctx, -80, y + 3, 160, 0.6, '#C9CFDA');
        }
      }
      // Notes, written as fast as it happens.
      const start = page2 ? FLIP_PAGE + 0.25 : 66.8;
      const run = (t - start) * 150;
      const lines = page2 ? [-44, -32, -20, -8, 4] : [36, 48, 60];
      if (!page2)
        write(ctx, 'Joined a funeral.', -76, 26, {
          size: 8,
          type: 'italic',
          color: BIRO,
          align: 'left',
        });
      let pen = { x: -76, y: lines[0] };
      lines.forEach((y, i) => {
        const x1 = -76 + clamp(run - i * 150, 0, 150);
        if (x1 > -76) {
          scribbleLine(ctx, -76, y, x1, i * 7 + (page2 ? 40 : 0));
          pen = { x: x1, y };
        }
      });
      if (flip > 0 && flip < 1) {
        const h = 190 * (1 - flip);
        poly(ctx, PAPER, [-90, -80, 90, -80, 96 - flip * 20, -80 + h, -96 + flip * 20, -80 + h]);
        line(ctx, alpha(INK, 0.2), 1, [-96 + flip * 20, -80 + h, 96 - flip * 20, -80 + h]);
      }
      box(ctx, -24, -104, 48, 26, '#C9CDD2');
      box(ctx, -24, -80, 48, 3, '#A2A7AE');
      disc(ctx, -14, -92, 2.5, '#A2A7AE');
      disc(ctx, 14, -92, 2.5, '#A2A7AE');
      // His hand, and the pen, scratching away.
      const px = pen.x + 2,
        py = pen.y - 1 + Math.sin(seconds * 45) * 0.8;
      line(ctx, BIRO, 3, [px, py, px + 18, py - 26]);
      box(ctx, px + 16, py - 32, 4, 8, '#3A4FA8');
      hand(ctx, px + 12, py - 6, 1.7, CAST.pike.skin, 0.9, CAST.pike.coat);
      ctx.restore();
    },
  );
}

// ——— The blink ———
function blinkShot(ctx: Ctx, t: number, seconds: number) {
  const lid = hump(t, BLINK, BLINK + 0.32);
  const corner = ease(span(t, SMILE, SMILE + 1));
  camera(
    ctx,
    track(t, [
      [86.8, 172, 90, 1],
      [89.6, 180, 86, 1.08],
    ]),
    () => {
      outlook(ctx, 'carpark', seconds);
      box(ctx, 0, 0, W, 14, LINING);
      poly(ctx, '#4F5561', [0, 14, 110, 14, 100, 180, 0, 180]);
      poly(ctx, '#5F6571', [100, 124, W, 118, W, H, 100, H]);
      portrait(ctx, 'pike', 196, 88, 2.7, {
        eyes: 'stare',
        lid,
        corner,
        raise: corner * 0.2,
        brows: -0.35 * corner,
        turn: -0.35,
        look: [-0.5, 0.15],
      });
      // Grace, still hugging him, in the foreground.
      const c = CAST.grace;
      for (const [x, y, r, dark] of [
        [30, 150, 34, true],
        [70, 132, 28, true],
        [8, 116, 26, true],
        [60, 172, 30, false],
        [96, 160, 22, false],
        [34, 120, 18, false],
        [16, 176, 24, false],
      ] as const)
        disc(ctx, x, y, r, dark ? c.hairD : c.hair);
      line(ctx, c.coat, 22, [112, 190, 250, 172]);
      hand(ctx, 262, 166, 2.4, c.skin, 1.5);
    },
  );
}

// ——— Driving off ———
function buttonShot(ctx: Ctx, tt: number, seconds: number) {
  const go = Math.max(0, tt - DRIVE_OFF);
  const e = 1 - Math.exp(-go * 0.42);
  const s = lerp(1.3, 0.2, e),
    x = lerp(116, 138, e),
    y = lerp(156, 98, e);
  camera(
    ctx,
    track(tt, [
      [89.6, 160, 92, 1.04],
      [94, 164, 90, 1.1],
    ]),
    () => {
      wash(ctx, 0, 100, [SKY[0], SKY[2]]);
      glow(ctx, 64, 22, 60, '#FFF1C0', 0.6);
      disc(ctx, 64, 22, 7, '#FFF7DC');
      cloud(ctx, ((200 + seconds * 1.2) % 400) - 40, 20, 1);
      // A street running away to the edge of town.
      const vp = [140, 92] as const;
      const side = (dir: number) => {
        for (let i = 4; i >= 0; i--) {
          const d0 = i / 5,
            d1 = (i + 1) / 5;
          const xa = (d: number) => lerp(dir < 0 ? -60 : 360, vp[0] + dir * 22, d ** 0.7);
          const ba = (d: number) => lerp(200, vp[1] + 2, d ** 0.7);
          const ha = (d: number) => lerp(150, 8, d ** 0.7);
          const wall = PASTELS[(i * 2 + (dir > 0 ? 3 : 0)) % PASTELS.length];
          poly(ctx, wall, [
            xa(d0),
            ba(d0) - ha(d0),
            xa(d1),
            ba(d1) - ha(d1),
            xa(d1),
            ba(d1),
            xa(d0),
            ba(d0),
          ]);
          poly(ctx, mix(wall, INK, 0.25), [
            xa(d0),
            ba(d0) - ha(d0),
            xa(d1),
            ba(d1) - ha(d1),
            xa(d1),
            ba(d1) - ha(d1) - 3,
            xa(d0),
            ba(d0) - ha(d0) - 8,
          ]);
          const wx = lerp(xa(d0), xa(d1), 0.35),
            wh = lerp(ha(d0), ha(d1), 0.35);
          box(
            ctx,
            wx - wh * 0.06,
            lerp(ba(d0), ba(d1), 0.35) - wh * 0.8,
            wh * 0.14,
            wh * 0.18,
            '#FFFFFF',
          );
        }
      };
      side(-1);
      side(1);
      poly(ctx, PAVE, [vp[0] - 22, vp[1] + 2, vp[0] + 22, vp[1] + 2, 380, 200, -60, 200]);
      poly(ctx, TARMAC, [vp[0] - 16, vp[1] + 2, vp[0] + 16, vp[1] + 2, 300, 200, -20, 200]);
      for (let k = 0; k < 7; k++) {
        const d0 = (k + 0.5) / 7,
          d1 = (k + 0.85) / 7;
        const yy = (d: number) => lerp(vp[1] + 2, 190, d * d);
        poly(ctx, PAINT, [
          vp[0] - 0.3 - d0 * 1.5,
          yy(d0),
          vp[0] + 0.3 + d0 * 1.5,
          yy(d0),
          vp[0] + 0.3 + d1 * 1.5,
          yy(d1),
          vp[0] - 0.3 - d1 * 1.5,
          yy(d1),
        ]);
      }
      carRear(ctx, x, y, s, {
        wipe: wiper(tt, WIPE_AGAIN),
        squirt: span(tt, WIPE_AGAIN + 0.2, WIPE_AGAIN + 0.9),
        wave: within(tt, 90.2, INDICATE) ? seconds * 10 : undefined,
      });
      puffs(ctx, x - 16 * s, y - 6 * s, tt, DRIVE_OFF, '#E4E6EA');
      // Mr. Pike, on the kerb, with a spare L plate for his collection.
      const corner = ease(span(tt, 92.4, 93.4));
      const blink2 = hump(tt, 93.4, 93.9);
      portrait(ctx, 'pike', 270, 100, 1.3, {
        eyes: 'stare',
        turn: -0.6,
        look: [-0.9, 0.1],
        corner,
        lid: blink2,
        raise: corner * 0.2,
        brows: -0.35 * corner,
      });
      ctx.save();
      ctx.translate(262, 162);
      ctx.rotate(0.06);
      box(ctx, -22, -10, 44, 40, BOARD);
      box(ctx, -18, -5, 36, 34, PAPER);
      box(ctx, -8, -13, 16, 6, '#C9CDD2');
      box(ctx, 2, 0, 14, 14, '#FFFFFF');
      box(ctx, 5, 2.5, 3, 9, CHERRY);
      box(ctx, 5, 8.5, 8, 3, CHERRY);
      ctx.restore();
      hand(ctx, 240, 170, 1.4, CAST.pike.skin, -0.4, CAST.pike.coat);
    },
  );
}

// ——— The score ———
const ROOT = 62; // D
/** "Mir-ror, sig-nal, pa-nic": a plucky, nervous little tune in eighths. */
const THEME: readonly (number | null)[] = [
  7,
  null,
  7,
  4,
  9,
  null,
  9,
  5,
  11,
  12,
  11,
  9,
  7,
  6,
  7,
  null,
  7,
  null,
  7,
  4,
  2,
  null,
  2,
  -1,
  0,
  2,
  4,
  5,
  7,
  null,
  0,
  null,
];
const MINOR: Record<string, number> = { '4': 3, '9': 8, '11': 10, '6': 5, '-1': -2 };
/** The same tune for the hearse: minor, slow, very sorry. */
const DIRGE = THEME.map((d) => (d === null ? null : (MINOR[String(d)] ?? d)));

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const mirrorSignalPanicScore: FilmModule['score'] = (film) => {
  const story = film.duration - 6;
  const time = (s: number) => 3 + at(s) * story;
  const cues = composeFilm(
    film,
    { root: ROOT, voice: 'pluck', intro: [7, 9, 11, 12], outro: [0, 4, 7, 12] },
    (s) => {
      const sec = (x: number) => (x * s.story) / STORY;
      const nervous = {
        chords: [0, 5, 7, 0],
        melody: THEME,
        step: 0.5,
        voice: 'pluck' as const,
        groove: 'tick' as const,
      };
      // Attempt nine. The engine idles; the theme tiptoes.
      s.fx('engine', 0, sec(14.5), 0.03, -0.2);
      s.section({
        ...nervous,
        from: 0,
        to: at(9),
        bpm: 108,
        root: ROOT,
        gain: 0.6,
        level: 0.42,
        fade: 0.6,
      });
      s.fx('thud', at(STAMP), 0.3, 0.14);
      s.fx('pop', at(STAMP), 0.12, 0.1);
      // The mirror: a chromatic climb, and a stop.
      s.section({
        from: at(9),
        to: at(11.3),
        bpm: 108,
        root: ROOT,
        chords: [7],
        melody: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        step: 0.5,
        voice: 'keys',
        gain: 0.5,
        level: 0.3,
        groove: 'tick',
        fade: 0.1,
      });
      s.fx('squeak', at(TILT), 0.8, 0.09, 0.3);
      // Mirror… signal…
      s.note(at(MIRROR), ROOT + 7, 0.4, 'pluck', 0.12, -0.2);
      s.note(at(SIGNAL), ROOT + 9, 0.35, 'pluck', 0.12, 0.2);
      s.fx('click', at(FLICK), 0.08, 0.3, -0.2);
      // Panic: the theme at full tilt, and the wipers keeping time with it.
      s.section({
        ...nervous,
        from: at(FLICK),
        to: at(WIPERS_OFF),
        bpm: 132,
        root: ROOT + 2,
        groove: 'drive',
        gain: 0.72,
        level: 0.62,
        fade: 0.08,
      });
      for (let i = 0; i < WIPES; i++) {
        s.fx('swish', at(FLICK + i * BEAT), BEAT * 0.95, 0.13, i % 2 ? 0.35 : -0.35);
        s.fx('squeak', at(FLICK + (i + 0.55) * BEAT), 0.14, 0.035, i % 2 ? 0.35 : -0.35);
      }
      s.fx('beep', at(HORN), 0.6, 0.18);
      // Two stalls: the theme gets going and dies, twice.
      CHUGS.forEach((c, i) => {
        s.fx('chug', at(c), 0.9, 0.2, -0.2);
        s.fx('engine', at(c + 0.1), STALLS[i] - c - 0.1, 0.1);
        s.section({
          ...nervous,
          from: at(c + 0.15),
          to: at(STALLS[i]),
          bpm: 132,
          root: ROOT + i * 2,
          groove: 'drive',
          gain: 0.7,
          level: 0.6,
          fade: 0.05,
        });
        s.fx('thud', at(STALLS[i]), 0.45, 0.28);
        s.fx('creak', at(STALLS[i] + 0.1), 0.8, 0.07, 0.2);
      });
      // The first stare: silence, and the pen.
      s.fx('scribble', at(SCRATCH), 0.9, 0.16, 0.3);
      s.fx('click', at(PEN), 0.06, 0.24, 0.3);
      // Ducks.
      s.fx('squeak', at(HALT - 0.35), 0.4, 0.07);
      s.section({
        ...nervous,
        from: at(26.9),
        to: at(LAPSE),
        bpm: 116,
        root: ROOT + 5,
        gain: 0.5,
        level: 0.4,
        fade: 0.3,
      });
      QUACKS.forEach((q, i) => s.fx('quack', at(q), 0.28, 0.14, 0.4 - i * 0.1));
      // The time-lapse: the same tune, fast-forwarded, and the town-hall clock racing.
      s.section({
        ...nervous,
        from: at(LAPSE),
        to: at(LAPSE_END),
        bpm: 184,
        root: ROOT + 5,
        voice: 'keys',
        groove: 'drive',
        gain: 0.55,
        level: 0.5,
        fade: 0.1,
      });
      for (let b = LAPSE; b < LAPSE_END - 0.1; b += 0.163) s.fx('tick', at(b), 0.04, 0.05, 0.5);
      LAPSE_QUACKS.forEach((q, i) => s.fx('quack', at(q), 0.16, 0.09, i % 2 ? 0.4 : -0.1));
      s.fx('quack', at(FAR_QUACK), 0.3, 0.05, 0.7);
      // The hill, and the hearse.
      s.section({
        from: at(37),
        to: at(LURCH),
        bpm: 84,
        root: ROOT - 12,
        minor: true,
        chords: [0, 1],
        groove: 'pulse',
        level: 0.5,
        pad: false,
        fade: 0.2,
      });
      s.fx('creak', at(ROLLBACK), 0.7, 0.14);
      s.fx('engine', at(REV), 0.9, 0.16);
      s.fx('chug', at(REV), 0.8, 0.12);
      s.fx('thud', at(LURCH), 0.3, 0.16);
      s.section({
        from: at(LURCH),
        to: at(49.5),
        bpm: 58,
        root: ROOT,
        minor: true,
        chords: [0, 5, 7, 0],
        melody: DIRGE,
        step: 1,
        voice: 'lead',
        gain: 0.5,
        level: 0.5,
        groove: 'march',
        fade: 0.3,
      });
      TOLLS.forEach((b) => s.fx('toll', at(b), 2.6, 0.07, -0.3));
      // The third stare.
      s.fx('scribble', at(SCRATCH_2), 0.5, 0.15, 0.3);
      s.fx('click', at(51.0), 0.06, 0.2, 0.3);
      // The roundabout: faster and a tone higher every lap.
      s.fx('engine', at(51.5), 0.5, 0.1);
      [132, 148, 164, 182].forEach((bpm, k) =>
        s.section({
          ...nervous,
          from: at(LAPS[k]),
          to: at(k < 3 ? LAPS[k + 1] : EXIT),
          bpm,
          root: ROOT + k * 2,
          groove: 'drive',
          gain: 0.72,
          level: 0.62,
          fade: 0.05,
        }),
      );
      LAPS.forEach((l, k) => s.fx('whir', at(l), 0.7, 0.1 + k * 0.02));
      for (let b = RING_IN + 0.1; b < EXIT; b += 1 / 3) s.fx('tick', at(b), 0.04, 0.05, -0.4);
      s.fx('thud', at(EXIT), 0.35, 0.24);
      s.fx('boing', at(EXIT + 0.35), 0.6, 0.07);
      // Parallel park, please.
      s.section({
        from: at(59.4),
        to: at(62.2),
        bpm: 100,
        root: ROOT,
        chords: [0, 7],
        melody: [7, null, null, null, 6, null, null, null, 7, null, 9, null, 7, null, null, null],
        step: 0.5,
        voice: 'pluck',
        gain: 0.5,
        level: 0.35,
        groove: 'tick',
        fade: 0.3,
      });
      s.fx('squeak', at(61.2), 0.3, 0.06);
      // Twelve tries, fast-forwarded; a bell for every one.
      s.section({
        ...nervous,
        from: at(62.2),
        to: at(SHUT),
        bpm: 168,
        root: ROOT + 2,
        voice: 'keys',
        groove: 'drive',
        gain: 0.5,
        level: 0.48,
        fade: 0.08,
      });
      TRIES.forEach((b, k) => {
        s.fx('tick', at(b), 0.05, 0.12);
        s.note(at(b), ROOT + 12 + k, 0.25, 'bell', 0.06, (k % 3) * 0.3 - 0.3);
      });
      s.fx('thud', at(TRIES[1] + 0.35), 0.2, 0.1);
      s.fx('knock', at(TRIES[3] + 0.3), 0.15, 0.16);
      s.fx('boing', at(TRIES[4] + 0.3), 0.4, 0.08);
      s.fx('boing', at(TRIES[7] + 0.25), 0.4, 0.08);
      s.fx('scribble', at(66.9), sec(1.9), 0.14, 0.3);
      s.fx('rustle', at(FLIP_PAGE), 0.35, 0.14, 0.2);
      // Eyes shut. One breath.
      s.fx('sweep', at(EXHALE), 0.9, 0.06);
      // One beautiful move.
      [0, 4, 7, 12, 16, 19, 24].forEach((d, i) =>
        s.note(at(GLIDE + i * 0.11), ROOT + d, 1.6 - i * 0.1, 'pluck', 0.07, (i / 6 - 0.5) * 0.6),
      );
      s.section({
        from: at(GLIDE),
        to: at(76),
        bpm: 84,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: THEME,
        step: 1,
        voice: 'bell',
        gain: 0.5,
        level: 0.42,
        fade: 0.6,
      });
      s.fx('bounce', at(SETTLE), 0.3, 0.12);
      s.fx('chime', at(SETTLE + 0.1), 1.2, 0.1);
      // Back at the test centre: the dashboard clock, the pen, the word.
      for (let b = 76.6; b < PASS; b += 1.1) s.fx('tick', at(b), 0.04, 0.05, 0.2);
      s.fx('click', at(CLICK_2), 0.06, 0.2, 0.3);
      // Joy.
      s.fx('gasp', at(WAKE), 0.4, 0.1);
      s.fx('woo', at(SCREAM), 1.0, 0.2, -0.1);
      s.fx('woo', at(SCREAM + 0.9), 0.8, 0.14, -0.1);
      s.fx('sparkle', at(FLIP), 1.0, 0.07);
      s.chord(at(FLIP), [ROOT, ROOT + 4, ROOT + 7, ROOT + 12], 1.3, 'bell', 0.06);
      [0, 4, 7, 12].forEach((d, i) =>
        s.note(at(FLIP + i * 0.14), ROOT + 12 + d, 0.5, 'lead', 0.07),
      );
      s.section({
        ...nervous,
        from: at(FLIP + 0.6),
        to: at(86.8),
        bpm: 132,
        root: ROOT,
        voice: 'lead',
        groove: 'drive',
        gain: 0.55,
        level: 0.55,
        fade: 0.1,
      });
      // The blink. Then, very quietly, something like a smile.
      s.fx('pop', at(BLINK), 0.1, 0.13);
      s.note(at(SMILE), ROOT + 19, 1.8, 'bell', 0.07);
      s.note(at(SMILE + 0.3), ROOT + 24, 1.6, 'bell', 0.05);
      s.chord(at(SMILE), [ROOT - 12, ROOT - 5, ROOT + 4], 1.6, 'pad', 0.035);
      // And off she goes.
      s.fx('engine', at(DRIVE_OFF), 1.4, 0.12);
      s.section({
        ...nervous,
        from: at(BUTTON),
        to: at(94),
        bpm: 132,
        root: ROOT,
        gain: 0.5,
        level: 0.45,
        fade: 0.5,
      });
      s.fx('click', at(INDICATE), 0.06, 0.22);
      for (let i = 0; i < 9; i++) s.fx('swish', at(WIPE_AGAIN + i * BEAT), BEAT * 0.95, 0.08, 0.2);
      s.fx('water', at(WIPE_AGAIN + 0.2), 0.6, 0.06);
      s.note(at(93.4), ROOT + 12, 0.9, 'pluck', 0.1);
      s.note(at(93.4), ROOT - 12, 0.9, 'bass', 0.1);
    },
  );
  // Hard stops: any note still ringing across a stop is cut off right on it.
  return cues.map((cue) => {
    if (cue.kind !== 'note') return cue;
    for (const stop of STOPS) {
      const cut = time(stop);
      if (cue.at < cut && cue.at > cut - 4 && cue.at + cue.duration > cut)
        return { ...cue, duration: cut - cue.at + 0.02 };
    }
    return cue;
  });
};

// ——— Putting it on screen ———
const LINES: readonly (readonly [number, number, string])[] = [
  [PEP[0], PEP[1], 'You are a calm, capable adult.'],
  [OWN_TIME[0], OWN_TIME[1], 'In your own time.'],
  [14.6, 17.1, 'Mirror… signal…'],
  [59.7, 62.3, 'Parallel park, please.'],
  [PASS, PASS + 2.6, 'Pass.'],
];
function scene(t: number) {
  let i = 0;
  while (i + 1 < CUTS.length && t >= CUTS[i + 1]) i++;
  return { index: i, from: CUTS[i], to: CUTS[i + 1] ?? STORY };
}
const talk = (t: number, from: number, to: number) =>
  within(t, from, to) && Math.sin((t - from) * 21) > -0.2;

function stare(
  ctx: Ctx,
  t: number,
  seconds: number,
  from: number,
  to: number,
  kind: Outlook,
  zoom: [number, number],
  write = 0,
) {
  camera(
    ctx,
    track(t, [
      [from, 164, 94.6, zoom[0]],
      [to, 164, 94.6, zoom[1]],
    ]),
    () => pikeClose(ctx, seconds, { eyes: 'stare' }, kind, { write }),
  );
}

export const mirrorSignalPanic: FilmModule = {
  draw(ctx, p, seconds) {
    const t = p * STORY;
    // The last shot keeps rolling under the end card.
    const tt = Math.max(t, seconds - 3);
    const { index, from, to } = scene(t);
    switch (index) {
      case 0:
        openingShot(ctx, t, seconds);
        break;
      case 1: {
        const reach = ease(span(t, REACH, REACH + 0.8));
        camera(
          ctx,
          track(t, [
            [4.5, 160, 92, 1],
            [9, 138, 94, 1.14],
          ]),
          () =>
            cabin(ctx, seconds, {
              outside: 'carpark',
              grace: {
                eyes: 'open',
                look: [0.7, -0.8],
                turn: 0.35,
                brows: -0.5,
                raise: 0.3,
                mouth: talk(t, PEP[0], PEP[1] - 0.4) ? 'open' : 'tight',
              },
              pike: { eyes: 'stare' },
              hands: reach > 0 ? 'mirror' : 'wheel',
              reach,
            }),
        );
        break;
      }
      case 2:
        mirrorShot(ctx, t, seconds);
        break;
      case 3:
        camera(
          ctx,
          track(t, [
            [11.3, 164, 96, 1.04],
            [14.5, 164, 94, 1.16],
          ]),
          () =>
            pikeClose(
              ctx,
              seconds,
              { eyes: 'stare', mouth: talk(t, OWN_TIME[0], 13.3) ? 'o' : 'flat' },
              'carpark',
            ),
        );
        break;
      case 4:
        povShot(ctx, t, seconds);
        break;
      case 5: {
        const honk = within(t, HORN - 0.1, HORN + 0.4);
        camera(ctx, { x: 160, y: 92, zoom: 1.02 }, () =>
          cabin(ctx, seconds, {
            outside: 'carpark',
            grace: {
              eyes: 'wide',
              brows: -1,
              raise: 0.8,
              mouth: honk ? 'o' : 'grit',
              turn: Math.sin(seconds * 5) * 0.3,
              look: [Math.sin(seconds * 6) * 0.8, -0.2],
              blush: 0.6,
            },
            pike: { eyes: 'stare' },
            hands: honk ? 'horn' : t < WIPERS_OFF ? 'flail' : 'wheel',
            jump: hump(t, HORN, HORN + 0.4) * 6,
            wipe: wiper(t, FLICK, WIPERS_OFF),
            sway: Math.sin(seconds * 9) * 0.4,
          }),
        );
        break;
      }
      case 6:
        stallShot(ctx, t, seconds);
        break;
      case 7:
        stare(
          ctx,
          t,
          seconds,
          from,
          to,
          'carpark',
          [2.1, 3.4],
          within(t, SCRATCH, SCRATCH + 0.9) ? 1 : 0,
        );
        break;
      case 8:
        crossingShot(ctx, t, seconds, false);
        break;
      case 9:
        crossingShot(ctx, t, seconds, true);
        break;
      case 10:
        camera(
          ctx,
          track(t, [
            [35, 164, 96, 1.08],
            [37, 164, 95, 1.2],
          ]),
          () => pikeClose(ctx, seconds, { eyes: 'stare' }, 'crossing'),
        );
        break;
      case 11:
        hillShot(ctx, t, seconds);
        break;
      case 12:
        processionShot(ctx, t, seconds);
        break;
      case 13:
        mournerShot(ctx, t, seconds);
        break;
      case 14:
        stare(
          ctx,
          t,
          seconds,
          from,
          to,
          'hearse',
          [2.4, 3.1],
          within(t, SCRATCH_2, SCRATCH_2 + 0.5) ? 1 : 0,
        );
        break;
      case 15:
        roundaboutShot(ctx, t);
        break;
      case 16: {
        const out = t - EXIT;
        const lean =
          out < 0
            ? 0.3 + Math.sin(seconds * 3) * 0.03
            : 0.3 * Math.exp(-out * 6) * Math.cos(out * 14);
        camera(ctx, { x: 160, y: 92, zoom: 1.04 }, () =>
          cabin(ctx, seconds, {
            outside: 'streak',
            speed: out < 0 ? 420 : 110,
            grace: {
              eyes: out < 0.5 ? 'dizzy' : 'wide',
              spin: seconds * 9,
              mouth: 'wobble',
              wind: lean * 3,
              brows: -0.6,
            },
            pike: { eyes: 'stare', tie: lean * 2.4 },
            lean,
            hands: 'wheel',
            sway: lean * 3,
          }),
        );
        break;
      }
      case 17:
        parkingShot(ctx, t, seconds, 'arrive');
        break;
      case 18:
        parkingShot(ctx, t, seconds, 'lapse');
        break;
      case 19:
        clipboardShot(ctx, t, seconds);
        break;
      case 20:
        camera(
          ctx,
          track(t, [
            [68.8, 160, 100, 1],
            [71.6, 160, 98, 1.14],
          ]),
          () => graceClose(ctx, t, seconds),
        );
        break;
      case 21:
        parkingShot(ctx, t, seconds, 'glide');
        break;
      case 22:
        camera(
          ctx,
          track(t, [
            [76, 160, 92, 1],
            [80, 160, 96, 1.1],
          ]),
          () =>
            cabin(ctx, seconds, {
              outside: 'carpark',
              grace: { eyes: 'closed', brows: -0.7, mouth: 'wobble' },
              pike: { eyes: 'stare', look: t < 78.6 ? [0, 0.8] : [0, 0] },
              hands: 'wheel',
              write: t < 78.4 ? 1 : 0,
            }),
        );
        break;
      case 23:
        camera(
          ctx,
          track(t, [
            [80, 164, 96, 1],
            [83.2, 164, 93, 1.34],
          ]),
          () =>
            pikeClose(
              ctx,
              seconds,
              { eyes: 'stare', mouth: within(t, PASS, PASS + 0.35) ? 'o' : 'flat' },
              'carpark',
            ),
        );
        break;
      case 24: {
        const hug = t < HUG ? 0 : backOut(span(t, HUG, HUG + 0.4));
        const grace: Face =
          t < WAKE
            ? { eyes: 'closed', brows: -0.7, mouth: 'wobble' }
            : t < SCREAM
              ? { eyes: 'wide', raise: 1, mouth: 'o' }
              : t < HUG
                ? { eyes: 'squeeze', mouth: 'scream', tilt: -0.12, raise: 1 }
                : { eyes: 'happy', mouth: 'grin', turn: 0.5, blush: 1, tilt: 0.1 };
        camera(
          ctx,
          track(t, [
            [83.2, 160, 92, 1.04],
            [86.8, 176, 92, 1.12],
          ]),
          () =>
            cabin(ctx, seconds, {
              outside: 'carpark',
              grace,
              pike: { eyes: 'stare', tilt: -0.05 * hug },
              hands: t < SCREAM ? 'wheel' : t < HUG ? 'fists' : 'hug',
              hug,
              aloft: ease(span(t, HUG + 0.05, HUG + 0.4)),
              jump: t >= SCREAM && t < HUG ? 4 : 0,
              sway: jolt(t, HUG, 3, 9) * 1.4,
            }),
        );
        break;
      }
      case 25:
        blinkShot(ctx, t, seconds);
        break;
      default:
        buttonShot(ctx, tt, seconds);
    }
    // The plates in the corner: the count that matters to Grace.
    if (index === 0) plate(ctx, 'ATTEMPT 9', 1, { pop: backOut(span(t, STAMP, STAMP + 0.35)) });
    if (index === 15 && t >= RING_IN) {
      const n = lapOf(t);
      plate(ctx, `LAP ${n}`, 1, { pop: backOut(span(t, LAPS[n - 1], LAPS[n - 1] + 0.3)) });
    }
    if (index >= 18 && index <= 21) {
      const n = tries(t);
      const done = t >= SETTLE;
      plate(ctx, `TRY ${n}`, 1, {
        pop: done
          ? backOut(span(t, SETTLE, SETTLE + 0.35))
          : backOut(span(t, TRIES[n - 1], TRIES[n - 1] + 0.25)),
        color: done ? '#7ED58F' : AMBER,
      });
    }
    if (index === 22) plate(ctx, 'ATTEMPT 9', ease(span(t, 76.4, 77.2)));
    if (index === 24) {
      const k = span(t, FLIP, FLIP + 0.4);
      const passed = k >= 0.5;
      plate(ctx, passed ? 'PASSED' : 'ATTEMPT 9', 1, {
        squash: Math.abs(Math.cos(Math.PI * k)),
        color: passed ? '#7ED58F' : AMBER,
      });
    }
    if (index === 26) plate(ctx, 'PASSED', ease(span(t, 90, 90.8)), { color: '#7ED58F' });
    vignette(ctx, 0.22);
    // Under the end card, let the last frame sink back so the words read.
    veil(ctx, '#0B0E14', ease((seconds - STORY - 3) / 0.9) * 0.4);
    for (const [a, b, text] of LINES) caption(ctx, text, presence(t, a, b, 0.25));
    void H;
  },
  score: mirrorSignalPanicScore,
  look: {
    shade: '#1D2A3A',
    ink: '#FFF4E2',
    accent: '#F2A93B',
    dedication: 'for everyone on their ninth attempt',
  },
};
