import type { FilmModule } from './types';
import {
  alpha,
  box,
  camera,
  caption,
  clamp,
  disc,
  ease,
  easeIn,
  faded,
  font,
  glow,
  H,
  hump,
  lerp,
  line,
  mix,
  oval,
  poly,
  presence,
  rainfall,
  rand,
  shot,
  sky,
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
} from './kit';
import { composeFilm, type Score } from './score-kit';

/*
 * THE LONG TABLE
 * After their mother's funeral three grown siblings come back to the family kitchen and sit as
 * far apart as the long table allows, leaving the carver at its head empty. Ruth stayed and
 * nursed her; Daniel sent money from the city; Nell makes jokes. An old fight surfaces and
 * lands. Then Nell finds Mum's recipe tin: the Sunday loaf, written out "for the kids" and never
 * finished. Each of them turns out to hold one missing piece, so they bake it together, and the
 * kitchen warms from rain-blue to oven amber. It comes out burnt, the way hers always did.
 *
 * Time is kept in story seconds (0–174), so the picture and the score share every hit point:
 * the chair scrape, the lid of the tin, each knead, each pinch of sugar, the oven door, the
 * crust. Mum's theme is heard three times as a fragment that stops where her handwriting stops,
 * and only once whole, as the fourth chair is pulled back in.
 */

// ——— Time ———
/** Story seconds between the title card and The End (the film runs 180 s). */
const STORY = 174;
/** Story seconds → story time. */
const P = (sec: number) => sec / STORY;

// ——— Hit points, in story seconds, shared by picture and score ———
const DOOR_SHUT = 1.2;
export const LIGHT_ON = 3;
const DRIPS = [7.7, 9.0, 10.3, 11.6] as const;
const STIRS = [13.7, 14.4, 15.1] as const;
const SPOON_DOWN = 16.2;
const BUZZ = [36.0, 37.3] as const;
const GRAB = 38.3;
const FACE_DOWN = 56.4;
const SCRAPE = 63.3;
const TOUCH = 66.6;
const TIN = 68.6;
const LID = 70.0;
const SLIDE = 79.6;
const DIAL = 99.9;
export const MEMORY_KNEADS = [89.7, 90.6, 91.5, 92.4, 93.3, 94.2] as const;
export const PINCHES = [103.0, 104.0, 105.0] as const;
const MILK = 106.3;
const HONEY = 108.6;
const STIR = 110.0;
/** Daniel's kneading, on the beat of the baking music (75 bpm from 111.6 s). */
export const KNEADS = [111.6, 112.4, 113.2, 114.0, 114.8, 116.4, 117.2, 118.0, 118.8] as const;
const BAKE_KNEADS = [119.6, 120.4, 121.2, 122.0, 126.8, 127.6] as const;
const BUZZ2 = 114.35;
const FLIP = 115.8;
const POINT = 122.4;
const FLICK = 124.0;
const RUTH_LAUGH = 125.4;
const OVEN_SHUT = 130.2;
const LEAN = 135.6;
const PHONE_OFF = 138.0;
const TIMER = 142.3;
const OVEN_OPEN = 142.7;
const TIN_DOWN = 143.4;
const CRACKLE = 144.0;
const BREAK = 152.6;
/** The whole of Mum's theme, at last: it starts as Ruth laughs and resolves on the lit window. */
const THEME_START = 152.9;
const THEME_BPM = 88;
const HUG = 156.0;
export const TEARS = [160.0, 161.4] as const;
const CHAIR_IN = 163.8;
const CUP_DOWN = 164.7;

// ——— Shots (story seconds where each begins) ———
const CUTS = [
  0, // the house at dusk
  7, // the hall: three wet coats, one yellow one
  12.5, // the kitchen: as far apart as the table allows
  20, // Daniel and Nell
  26, // Nell: Margaret
  31.5, // Ruth does not laugh
  35, // the phone
  39, // Ruth: answer it
  43, // Daniel: only work
  47.5, // Ruth: you sent money
  52.5, // Daniel: I know
  57.5, // push in on the empty chair
  64.8, // Nell at the dresser
  70.5, // the card
  78.8, // overhead: it just stops
  84, // Daniel: until it pushes back
  89, // memory: small hands, her hands
  95, // Ruth at the oven
  100.6, // Nell: a pinch each
  102.5, // the pinches
  105.8, // milk and honey
  111, // kneading
  119, // the three of them at the table
  128, // into the oven
  132, // on the kitchen floor
  139.6, // the clock
  142.6, // the loaf, and their faces
  148, // Ruth: hers was always burnt too
  154.4, // laughing and crying
  158.8, // tearing the bread
  162.6, // the fourth chair
  170.6, // the lit window
] as const;

type Who = 'ruth' | 'daniel' | 'nell';
type Speaker = Who | 'vo';
const LINES: readonly (readonly [number, number, Speaker, string])[] = [
  [20.5, 23.4, 'daniel', 'Lovely service.'],
  [26.4, 30.4, 'nell', 'He called her Margaret. Twice.'],
  [39.3, 42.4, 'ruth', 'Go on. Answer it.'],
  [43.5, 46.4, 'daniel', 'It’s only work.'],
  [47.8, 52.0, 'ruth', 'You sent money. She wanted you.'],
  [54.0, 56.8, 'daniel', 'I know.'],
  [79.9, 83.2, 'nell', 'It just stops.'],
  [84.5, 88.0, 'daniel', 'Until it pushes back.'],
  [89.6, 93.4, 'vo', 'She only ever let me knead.'],
  [95.6, 99.6, 'ruth', 'Her oven runs hot. Take five off.'],
  [100.8, 104.8, 'nell', 'A pinch of sugar for each of us.'],
  [148.9, 152.5, 'ruth', 'Hers was always burnt too.'],
  [165.3, 168.0, 'daniel', 'Same time next Sunday?'],
  [168.1, 170.9, 'ruth', 'Bring an apron.'],
];

// ——— Colour ———
type Tone = (hex: string) => string;
type Keys = readonly (readonly [number, number, number, number])[];
type Pt = readonly [number, number];

const INK = '#171319';
const FLOUR = '#F4EFE4';
const MUSTARD = '#CC9238';
const MUSTARD_DARK = '#A0702A';
const WALL = '#A2B2A0';
const SKIN = {
  ruth: '#E2B596',
  daniel: '#D5A07C',
  nell: '#F1C6A6',
  mum: '#E9C2A6',
  kid: '#F4CBAA',
} as const;
const HAIR: Record<Who, string> = { ruth: '#7E726A', daniel: '#2C2420', nell: '#AE5230' };
const IRIS: Record<Who, string> = { ruth: '#5C6E80', daniel: '#4C3628', nell: '#58744C' };
const CLOTH = {
  ruth: { main: '#5C4664', dark: '#44344C', inner: '#25222A', legs: '#2A2630' },
  daniel: { main: '#28324C', dark: '#1B2236', inner: '#ECEAE4', legs: '#222A40' },
  nell: { main: '#2C2A31', dark: '#1E1D22', inner: '#2C2A31', legs: '#23222A' },
} as const;
const TIE = '#141419';
const PHASE: Record<Who, number> = { ruth: 0.3, daniel: 1.9, nell: 3.1 };

const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
const byte = (v: number) =>
  Math.round(clamp(v, 0, 255))
    .toString(16)
    .padStart(2, '0');
/** A colour grade: rain-blue (0) to oven amber (1), darkened for night, or sepia for memory. */
function grade(warm: number, dark = 0, sepia = 0): Tone {
  const w = clamp(warm);
  const mr = lerp(0.72, 1.05, w),
    mg = lerp(0.82, 0.9, w),
    mb = lerp(0.98, 0.68, w);
  const ar = lerp(6, 18, w),
    ag = lerp(12, 8, w),
    ab = lerp(28, 0, w);
  const lit = 1 - dark;
  return (hex) => {
    let r = channel(hex, 0),
      g = channel(hex, 1),
      b = channel(hex, 2);
    if (sepia > 0) {
      const l = r * 0.3 + g * 0.59 + b * 0.11;
      r = lerp(r, l * 1.05 + 32, sepia);
      g = lerp(g, l * 0.9 + 16, sepia);
      b = lerp(b, l * 0.62 + 2, sepia);
    }
    return `#${byte((r * mr + ar) * lit)}${byte((g * mg + ag) * lit)}${byte((b * mb + ab) * lit)}`;
  };
}
/** How warm the kitchen has become: rain-blue while they sit apart, amber by supper. */
function warmth(t: number) {
  return (
    0.2 * ease(span(t, 97, 106)) +
    0.3 * ease(span(t, 106, 126)) +
    0.22 * ease(span(t, 128, 142)) +
    0.28 * ease(span(t, 150, 163))
  );
}
/** The kitchen's grade at story second t: dim and blue while it is cold, lifting as it warms. */
const look = (t: number) => grade(warmth(t), 0.11 * (1 - clamp(warmth(t) / 0.45)));
const rainAt = (t: number) => lerp(1, 0.6, ease(span(t, 60, 110))) * (1 - ease(span(t, 116, 150)));
/** How hot the oven glows: lit on Ruth's dial, cooling once the loaf is out. */
const ovenHeat = (t: number) => ease(span(t, DIAL, DIAL + 3)) * (1 - ease(span(t, 144, 152)));

// ——— Small helpers ———
/** Eases through keyframes [time, ...values]; holds at either end. */
function keyed(t: number, keys: readonly (readonly number[])[]) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i],
      b = keys[i + 1];
    if (t < b[0]) {
      const u = ease((t - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((v, j) => lerp(v, b[j + 1], u));
    }
  }
  return keys[keys.length - 1].slice(1);
}
/** 1 as the heel of the hand drives into the dough, easing back between strokes. */
function press(t: number, beats: readonly number[]) {
  let v = 0;
  for (const b of beats)
    v = Math.max(v, ease(span(t, b - 0.36, b)) * (1 - ease(span(t, b + 0.04, b + 0.38))));
  return v;
}
function speaking(who: Speaker, t: number) {
  return LINES.some(([from, to, w]) => w === who && t >= from + 0.1 && t < to - 0.45);
}

// ——— Faces ———
type Eye = 'open' | 'down' | 'closed' | 'wide' | 'laugh';
type Lips = 'flat' | 'tight' | 'frown' | 'smile' | 'wry' | 'open' | 'laugh' | 'o' | 'wobble';
type Face = {
  eyes?: Eye;
  /** -1 grieving … 0 … 1 cross. */
  brows?: number;
  /** Both brows lifted, in face units. */
  raise?: number;
  mouth?: Lips;
  /** Where the eyes point: -1 screen-left … 1 screen-right. */
  look?: number;
  /** 0..1 wet eyes; past 1 a tear is running (the excess is how far). */
  tear?: number;
  flour?: number;
  blush?: number;
};
/** A mouth that moves while its owner has a subtitle up, and rests otherwise. */
function lips(who: Who, t: number, seconds: number, rest: Lips): Lips {
  if (!speaking(who, t)) return rest;
  return rand(Math.floor(seconds * 8.5) + PHASE[who] * 10) > 0.38 ? 'open' : 'flat';
}
function blink(who: Who, seconds: number, eyes: Eye = 'open'): Eye {
  return eyes === 'open' && (seconds * 0.9 + PHASE[who]) % 3.7 < 0.13 ? 'closed' : eyes;
}

// ——— The family, at table scale (1 unit = 1 px in the wide) ———
type Body = {
  x: number;
  y: number;
  mode: 'sit' | 'stand' | 'floor';
  size?: number;
  turn?: number;
  tilt?: number;
  lean?: number;
  bob?: number;
  step?: number;
  /** Seen from behind. */
  back?: boolean;
  /** Hand targets [screen-left, screen-right], in the figure's own units from its anchor. */
  hands?: readonly [Pt | null, Pt | null];
  face?: Face;
  flour?: number;
  loose?: number;
  mitts?: boolean;
};
const HIP = { sit: 0, stand: -30, floor: 0 } as const;
const hipOf = (b: Body) =>
  HIP[b.mode] + (b.bob ?? 0) - (b.step === undefined ? 0 : Math.abs(Math.cos(b.step)));

function torso(ctx: Ctx, k: Tone, who: Who, b: Body) {
  const c = CLOTH[who];
  poly(ctx, k(c.main), [-8, 0, 8, 0, 10, -19, 9, -24, 4, -27, -4, -27, -9, -24, -10, -19]);
  if (!b.back) {
    if (who === 'ruth') {
      poly(ctx, k(c.inner), [-3, -27, 3, -27, 2, -12, -2, -12]);
      poly(ctx, k(SKIN.ruth), [-2, -27, 2, -27, 0, -24]);
      box(ctx, -3, -10, 1, 1, k('#CBB9A0'));
      box(ctx, -3, -5, 1, 1, k('#CBB9A0'));
    } else if (who === 'daniel') {
      poly(ctx, k(c.inner), [-4, -27, 4, -27, 0, -15]);
      const knot = -26 + Math.round((b.loose ?? 0) * 2);
      box(ctx, -1, knot, 2, 2, k(TIE));
      poly(ctx, k(TIE), [-1, knot + 2, 1, knot + 2, 1.5, -12, 0, -10, -1.5, -12]);
      line(ctx, k(c.dark), 1, [-4, -26, -1.5, -15, -1, -3]);
      line(ctx, k(c.dark), 1, [4, -26, 1.5, -15]);
      const f = b.flour ?? 0;
      if (f > 0)
        faded(ctx, f, () => {
          const w = k(FLOUR);
          poly(ctx, w, [-8, -3, -3, -6, -4, -13, -8, -12]);
          oval(ctx, 5, -9, 3, 4, w);
          box(ctx, -7, -21, 3, 3, w);
          box(ctx, 5, -19, 2, 2, w);
        });
    } else {
      box(ctx, -3, -27, 6, 1, k(c.dark));
      box(ctx, 0, -23, 1, 1, k('#C8CCD4'));
    }
  } else if (who === 'nell') box(ctx, -6, -27, 12, 9, k(HAIR.nell));
  poly(ctx, k(c.dark), [7, 0, 8, 0, 10, -19, 9, -24, 8, -20]);
}

function head(ctx: Ctx, k: Tone, who: Who, f: Face, turn: number) {
  const skin = k(SKIN[who]);
  const shadow = k(mix(SKIN[who], '#50304A', 0.28));
  const hair = k(HAIR[who]);
  const ink = k(INK);
  const tx = Math.round(clamp(turn, -1, 1) * 1.6);
  if (who === 'nell') poly(ctx, hair, [-5, -16, 5, -16, 7, -14, 7, 3, 6, 4, -6, 4, -7, 3, -7, -14]);
  box(ctx, -2, -3, 4, 4, shadow);
  box(ctx, -5, -14, 10, 12, skin);
  box(ctx, -6, -13, 12, 10, skin);
  box(ctx, turn > 0.15 ? -6 : 5, -12, 1, 8, shadow);
  if (who === 'ruth') {
    box(ctx, -6, -15, 12, 4, hair);
    box(ctx, -6, -12, 2, 4, hair);
    box(ctx, 4, -12, 2, 4, hair);
    box(ctx, -3, -17, 6, 2, hair);
    box(ctx, -1 + tx, -15, 2, 2, k('#BDB4AC'));
  } else if (who === 'daniel') {
    box(ctx, -6, -15, 12, 3, hair);
    box(ctx, -6, -12, 2, 3, hair);
    box(ctx, 5, -12, 1, 2, hair);
    box(ctx, -6, -9, 1, 2, k('#8E847E'));
    box(ctx, 5, -9, 1, 2, k('#8E847E'));
  } else {
    box(ctx, -6, -15, 12, 4, hair);
    box(ctx, -6, -11, 2, 2, hair);
    box(ctx, -1 + tx, -11, 3, 1, hair);
    box(ctx, 4, -11, 2, 1, hair);
    box(ctx, -7, -12, 2, 13, hair);
    box(ctx, 5, -12, 2, 13, hair);
    box(ctx, -4, -15, 3, 1, k(mix(HAIR.nell, '#FFD8A0', 0.35)));
  }
  const eyes = f.eyes ?? 'open';
  const brow = k(mix(HAIR[who], INK, 0.45));
  const b = f.brows ?? 0;
  const lift = Math.round(f.raise ?? 0);
  for (const [ex, side] of [
    [-3 + tx, -1],
    [2 + tx, 1],
  ] as const) {
    if (eyes === 'open') box(ctx, ex, -9, 1, 2, ink);
    else if (eyes === 'wide') box(ctx, ex, -10, 1, 3, ink);
    else if (eyes === 'down' || eyes === 'closed')
      box(ctx, ex - (side < 0 ? 1 : 0), eyes === 'down' ? -8 : -8, 2, 1, ink);
    else {
      box(ctx, ex - 1, -8, 1, 1, ink);
      box(ctx, ex, -9, 1, 1, ink);
      box(ctx, ex + 1, -8, 1, 1, ink);
    }
    const inner = ex - side,
      outer = ex + side;
    const yi = b > 0.3 ? -11 : b < -0.3 ? -13 : -12,
      yo = b > 0.3 ? -13 : b < -0.3 ? -11 : -12;
    box(ctx, inner, yi - lift, 1, 1, brow);
    box(ctx, ex, -12 - lift, 1, 1, brow);
    box(ctx, outer, yo - lift, 1, 1, brow);
  }
  if (who === 'ruth') {
    const g = k('#3E3440');
    box(ctx, -5 + tx, -10, 4, 1, g);
    box(ctx, 1 + tx, -10, 4, 1, g);
    box(ctx, -5 + tx, -7, 4, 1, alpha(g, 0.6));
    box(ctx, 1 + tx, -7, 4, 1, alpha(g, 0.6));
  }
  box(ctx, tx, -7, 1, 1, shadow);
  const mc = k('#6A3A3E');
  const mx = tx;
  switch (f.mouth ?? 'flat') {
    case 'flat':
      box(ctx, mx - 1, -5, 3, 1, mc);
      break;
    case 'tight':
      box(ctx, mx - 1, -5, 2, 1, mc);
      break;
    case 'frown':
      box(ctx, mx - 2, -4, 1, 1, mc);
      box(ctx, mx - 1, -5, 3, 1, mc);
      box(ctx, mx + 2, -4, 1, 1, mc);
      break;
    case 'smile':
      box(ctx, mx - 2, -6, 1, 1, mc);
      box(ctx, mx - 1, -5, 3, 1, mc);
      box(ctx, mx + 2, -6, 1, 1, mc);
      break;
    case 'wry':
      box(ctx, mx - 1, -5, 3, 1, mc);
      box(ctx, mx + 2, -6, 1, 1, mc);
      break;
    case 'open':
      box(ctx, mx - 1, -5, 3, 2, ink);
      break;
    case 'o':
      box(ctx, mx, -5, 2, 2, ink);
      break;
    case 'laugh':
      box(ctx, mx - 2, -6, 5, 3, ink);
      box(ctx, mx - 1, -6, 3, 1, k('#F4EEE6'));
      break;
    case 'wobble':
      box(ctx, mx - 2, -5, 1, 1, mc);
      box(ctx, mx - 1, -4, 1, 1, mc);
      box(ctx, mx, -5, 1, 1, mc);
      box(ctx, mx + 1, -4, 1, 1, mc);
      break;
  }
  const blush = f.blush ?? 0;
  if (blush > 0)
    faded(ctx, blush * 0.6, () => {
      box(ctx, -5 + tx, -6, 2, 1, '#E48A80');
      box(ctx, 3 + tx, -6, 2, 1, '#E48A80');
    });
  const flour = f.flour ?? 0;
  if (flour > 0) faded(ctx, flour, () => box(ctx, tx - 1, -7, 3, 2, k(FLOUR)));
  const run = (f.tear ?? 0) - 1;
  if (run > 0) box(ctx, -3 + tx, -7 + Math.round(run * 3), 1, 1, k('#DDEEF8'));
}

function headBack(ctx: Ctx, k: Tone, who: Who) {
  const skin = k(SKIN[who]),
    hair = k(HAIR[who]);
  box(ctx, -2, -3, 4, 4, k(mix(SKIN[who], '#50304A', 0.28)));
  box(ctx, -7, -9, 1, 3, skin);
  box(ctx, 6, -9, 1, 3, skin);
  box(ctx, -5, -14, 10, 12, skin);
  box(ctx, -6, -13, 12, 10, skin);
  if (who === 'nell') {
    box(ctx, -6, -16, 12, 2, hair);
    box(ctx, -7, -14, 14, 16, hair);
    box(ctx, -6, 2, 12, 3, hair);
    box(ctx, -5, 5, 10, 2, k(mix(HAIR.nell, INK, 0.25)));
    box(ctx, -3, -14, 2, 18, k(mix(HAIR.nell, '#FFD8A0', 0.2)));
    box(ctx, 3, -10, 1, 14, k(mix(HAIR.nell, INK, 0.2)));
  } else {
    box(ctx, -6, -15, 12, who === 'ruth' ? 9 : 10, hair);
    box(ctx, -5, -14, 10, 11, hair);
    if (who === 'ruth') box(ctx, -3, -12, 6, 5, k(mix(HAIR.ruth, INK, 0.3)));
  }
}

function body(ctx: Ctx, k: Tone, who: Who, b: Body) {
  const c = CLOTH[who];
  const hip = hipOf(b);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.size ?? 1, b.size ?? 1);
  const shoe = k('#18161C');
  if (b.mode === 'stand') {
    const sw = b.step === undefined ? 0 : Math.round(Math.sin(b.step) * 2);
    const legs = k(c.legs);
    box(ctx, -6 + sw, -30, 5, 28, legs);
    box(ctx, 1 - sw, -30, 5, 28, legs);
    box(ctx, -7 + sw, -2, 6, 2, shoe);
    box(ctx, 1 - sw, -2, 6, 2, shoe);
  }
  ctx.save();
  ctx.translate(0, hip);
  ctx.rotate(b.lean ?? 0);
  torso(ctx, k, who, b);
  ctx.translate(0, -27);
  ctx.rotate(b.tilt ?? 0);
  if (b.back) headBack(ctx, k, who);
  else head(ctx, k, who, b.face ?? {}, b.turn ?? 0);
  ctx.restore();
  if (b.mode === 'floor') {
    const legs = k(c.legs);
    box(ctx, -9, -17, 7, 15, legs);
    box(ctx, 2, -17, 7, 15, legs);
    disc(ctx, -5.5, -17, 3.8, legs);
    disc(ctx, 5.5, -17, 3.8, legs);
    box(ctx, -10, -3, 8, 3, shoe);
    box(ctx, 2, -3, 8, 3, shoe);
  }
  ctx.restore();
}

/** Two-bone arm: elbow out and down, hand clamped to reach. */
function limb(sx: number, sy: number, tx: number, ty: number, side: number) {
  const a = 11,
    c = 11;
  let dx = tx - sx,
    dy = ty - sy;
  let d = Math.hypot(dx, dy);
  const reach = a + c - 0.4;
  if (d > reach) {
    tx = sx + (dx / d) * reach;
    ty = sy + (dy / d) * reach;
    dx = tx - sx;
    dy = ty - sy;
    d = reach;
  }
  d = Math.max(d, 1);
  const base = Math.atan2(dy, dx);
  const bend = Math.acos(clamp((a * a + d * d - c * c) / (2 * a * d), -1, 1));
  const e1 = [sx + Math.cos(base + bend) * a, sy + Math.sin(base + bend) * a];
  const e2 = [sx + Math.cos(base - bend) * a, sy + Math.sin(base - bend) * a];
  const score = (e: number[]) => (e[0] - sx) * side + (e[1] - sy) * 0.3;
  const e = score(e1) >= score(e2) ? e1 : e2;
  return { ex: e[0], ey: e[1], hx: tx, hy: ty };
}
function restHand(b: Body, side: number): Pt {
  if (b.mode === 'sit') return [side * 6, -8];
  if (b.mode === 'floor') return [side * 4, -17];
  const walk = b.step === undefined ? 0 : Math.sin(b.step) * side * 3;
  return [side * 11 + walk, -32];
}
/** Where a figure's hand is in the world. */
function handAt(b: Body, i: 0 | 1) {
  const [hx, hy] = b.hands?.[i] ?? restHand(b, i ? 1 : -1);
  const s = b.size ?? 1;
  return { x: b.x + hx * s, y: b.y + hy * s };
}
function armsOf(ctx: Ctx, k: Tone, who: Who, b: Body) {
  const c = CLOTH[who];
  const hip = hipOf(b);
  const lean = b.lean ?? 0;
  const cs = Math.cos(lean),
    sn = Math.sin(lean);
  const sleeve = k(c.main);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.size ?? 1, b.size ?? 1);
  for (const i of [0, 1] as const) {
    const side = i ? 1 : -1;
    const lx = side * 9,
      ly = -23;
    const sx = lx * cs - ly * sn,
      sy = hip + lx * sn + ly * cs;
    const [tx, ty] = b.hands?.[i] ?? restHand(b, side);
    const j = limb(sx, sy, tx, ty, side);
    line(ctx, sleeve, 4, [sx, sy, j.ex, j.ey, j.hx, j.hy]);
    const ux = j.hx - j.ex,
      uy = j.hy - j.ey,
      ul = Math.hypot(ux, uy) || 1;
    if (who === 'daniel' && !b.mitts)
      line(ctx, k(c.inner), 3, [
        j.hx - (ux / ul) * 2.6,
        j.hy - (uy / ul) * 2.6,
        j.hx - (ux / ul) * 1.5,
        j.hy - (uy / ul) * 1.5,
      ]);
    const f = b.flour ?? 0;
    if (f > 0)
      faded(ctx, f, () =>
        line(ctx, k(FLOUR), 2.2, [lerp(j.ex, j.hx, 0.4), lerp(j.ey, j.hy, 0.4), j.hx, j.hy]),
      );
    if (b.mitts) {
      box(ctx, j.hx - 3, j.hy - 2.5, 6, 5, k('#D6C8AA'));
      box(ctx, j.hx - 3, j.hy, 6, 1, k('#7A96B8'));
    } else box(ctx, j.hx - 1.5, j.hy - 1.5, 3, 3, k(SKIN[who]));
  }
  ctx.restore();
}

// ——— The family, close up (face units; the head is about 22 × 31) ———
type Portrait = {
  x: number;
  y: number;
  s: number;
  face: Face;
  turn?: number;
  tilt?: number;
  /** Which side the key light comes from: -1 the window, 1 the oven. */
  light?: number;
  rim?: string;
  flour?: number;
  loose?: number;
  shake?: number;
};
const HEAD_SHAPE = [
  -11, -8, -10, -13, -6, -16, 6, -16, 10, -13, 11, -8, 11, 3, 9, 8, 5, 13, 1, 15, -1, 15, -5, 13,
  -9, 8, -11, 3,
];
const CHEEK_SHADE = [
  4, -15.6, 6, -16, 10, -13, 11, -8, 11, 3, 9, 8, 5, 13, 1, 15, 3.5, 11, 6.6, 5, 7.6, -2, 7, -10,
];
const SHOULDERS = [
  -7, 12, 7, 12, 19, 16, 27, 22, 31, 32, 33, 64, -33, 64, -31, 32, -27, 22, -19, 16,
];
const RUTH_HAIR = [
  -11.8, -5, -11.8, -12, -8, -16.5, -3, -18.2, 0, -17, 3, -18.2, 8, -16.5, 11.8, -12, 11.8, -5,
  10.4, -9.5, 6.5, -13, 1.2, -13.8, 0, -12.6, -1.2, -13.8, -6.5, -13, -10.4, -9.5,
];
const RUTH_STREAK = [-3, -18.2, 0, -17, -1.2, -13.8, -4.5, -13.5];
const DANIEL_HAIR = [
  -11.6, -6, -11.6, -12, -8.6, -16.4, -3, -18.2, 4, -17.9, 9, -15.8, 11.6, -12, 11.6, -6, 10.4,
  -9.6, 7.5, -12.4, 2, -13.4, -3, -12.8, -4.4, -14.2, -6.5, -12.6, -9.6, -10.2,
];
const NELL_BACK = [
  -14, -9, -13, -16, -8, -20.5, 0, -21.5, 8, -20.5, 13, -16, 14, -9, 15, 5, 17, 16, 19, 25, 12, 27,
  9, 19, 8, 10, -8, 10, -9, 19, -12, 27, -19, 25, -17, 16, -15, 5,
];
const NELL_FRINGE = [
  -11.5, -6, -11.5, -13, -7, -18, 0, -19, 7, -18, 11.5, -13, 11.5, -6, 10, -9, 8, -8, 6.5, -11, 4,
  -9, 2, -12, -0.5, -9.5, -3, -12, -5.5, -9, -8, -11.5, -10, -8.5,
];
const NELL_LOCKS = [
  [-12.6, -9, -10.2, -9.4, -10, 6, -11, 12, -13.6, 9],
  [12.6, -9, 10.2, -9.4, 10, 6, 11, 12, 13.6, 9],
] as const;
const FRECKLES = [
  [-6.2, 2.2],
  [-4.6, 3.4],
  [-3.2, 2],
  [3.2, 2],
  [4.6, 3.4],
  [6.2, 2.2],
  [-5.4, 1],
] as const;

function clothes(ctx: Ctx, k: Tone, who: Who, flour: number, loose: number) {
  const c = CLOTH[who];
  if (who === 'ruth') {
    poly(ctx, k(c.inner), SHOULDERS);
    poly(ctx, k(SKIN.ruth), [-5, 11, 5, 11, 0, 18]);
    poly(ctx, k(c.main), [-7, 12, -3, 22, -4.5, 64, -33, 64, -31, 32, -27, 22, -19, 16]);
    poly(ctx, k(c.main), [7, 12, 3, 22, 4.5, 64, 33, 64, 31, 32, 27, 22, 19, 16]);
    line(ctx, k(c.dark), 1.4, [-3.4, 22, -5, 64]);
    line(ctx, k(c.dark), 1.4, [3.4, 22, 5, 64]);
    for (let i = 0; i < 3; i++) {
      line(ctx, k(c.dark), 0.5, [-12 - i * 6, 25, -13 - i * 6, 62]);
      line(ctx, k(c.dark), 0.5, [12 + i * 6, 25, 13 + i * 6, 62]);
    }
    for (const y of [32, 42, 52]) disc(ctx, -5.2 - (y - 22) * 0.03, y, 0.9, k('#D6C6AE'));
    line(ctx, k('#C8BCA8'), 0.45, [-4, 12.5, 0, 20, 4, 12.5]);
    disc(ctx, 0, 20.6, 0.9, k('#D8C8A8'));
  } else if (who === 'daniel') {
    poly(ctx, k(c.main), SHOULDERS);
    poly(ctx, k(c.inner), [-6.5, 12, 6.5, 12, 4.2, 34, 0, 40, -4.2, 34]);
    const knot = 16.5 + loose * 3;
    if (loose > 0.5) poly(ctx, k(SKIN.daniel), [-2.6, 11.5, 2.6, 11.5, 0, knot - 0.5]);
    poly(ctx, k('#F6F4F0'), [-7, 11, -1.4, 16.5, -3.8, 20.5, -8.6, 14.5]);
    poly(ctx, k('#F6F4F0'), [7, 11, 1.4, 16.5, 3.8, 20.5, 8.6, 14.5]);
    poly(ctx, k(TIE), [-2, knot, 2, knot, 1.5, knot + 3, -1.5, knot + 3]);
    poly(ctx, k(TIE), [
      -1.5,
      knot + 3,
      1.5,
      knot + 3,
      2.8,
      knot + 23,
      0,
      knot + 26,
      -2.8,
      knot + 23,
    ]);
    poly(ctx, k(c.dark), [-6.5, 12, -4.2, 34, -9.5, 27, -12, 17]);
    poly(ctx, k(c.dark), [6.5, 12, 4.2, 34, 9.5, 27, 12, 17]);
    line(ctx, k('#3C4868'), 0.6, [-12, 17, -9.5, 27, -4.2, 34]);
    line(ctx, k('#3C4868'), 0.6, [12, 17, 9.5, 27, 4.2, 34]);
    if (flour > 0)
      faded(ctx, flour, () => {
        const w = k(FLOUR);
        oval(ctx, -15, 34, 6, 4.5, w);
        oval(ctx, 12, 46, 7, 6, w);
        oval(ctx, -8, 54, 5, 3.5, w);
        oval(ctx, 21, 30, 3, 5, w);
        oval(ctx, -21, 47, 3.2, 3.8, w);
        for (let i = 0; i < 4; i++) line(ctx, w, 1.4, [-22.5 + i * 1.6, 44, -24 + i * 2.2, 38.5]);
      });
  } else {
    poly(ctx, k(c.main), SHOULDERS);
    poly(ctx, k(c.dark), [-7.5, 11, 7.5, 11, 6.5, 15, 0, 16.8, -6.5, 15]);
    poly(ctx, k(SKIN.nell), [-5.8, 11, 5.8, 11, 5, 13.4, 0, 14.8, -5, 13.4]);
    for (let i = 0; i < 5; i++) line(ctx, k(c.dark), 0.5, [-18 + i * 9, 26, -18.5 + i * 9, 62]);
    line(ctx, k('#D0D4DC'), 0.45, [-4.4, 13.5, 0, 21, 4.4, 13.5]);
    disc(ctx, 0, 21.6, 0.8, k('#E0E4EC'));
  }
}

function eye(
  ctx: Ctx,
  k: Tone,
  who: Who,
  ex: number,
  kind: Eye,
  look: number,
  skin: string,
  lid: string,
) {
  const EY = -1.5;
  if (kind === 'closed') {
    line(ctx, lid, 0.8, [ex - 2.6, EY, ex, EY + 0.9, ex + 2.6, EY]);
    return;
  }
  if (kind === 'laugh') {
    line(ctx, lid, 0.9, [ex - 2.6, EY + 0.7, ex, EY - 0.8, ex + 2.6, EY + 0.7]);
    return;
  }
  const ry = kind === 'wide' ? 1.95 : 1.45;
  oval(ctx, ex, EY, 2.5, ry, k('#F1ECE6'));
  const ix = ex + clamp(look, -1, 1) * 1.05,
    iy = EY + (kind === 'down' ? 0.6 : 0.05);
  disc(ctx, ix, iy, 1.3, k(IRIS[who]));
  disc(ctx, ix, iy, 0.62, k('#120E14'));
  disc(ctx, ix - 0.45, iy - 0.5, 0.36, k('#FFFFFF'));
  if (kind === 'down') {
    poly(ctx, skin, [
      ex - 2.9,
      EY - 2.3,
      ex + 2.9,
      EY - 2.3,
      ex + 2.9,
      EY + 0.15,
      ex - 2.9,
      EY + 0.15,
    ]);
    line(ctx, lid, 0.85, [ex - 2.6, EY + 0.1, ex, EY + 0.35, ex + 2.6, EY + 0.1]);
  } else
    line(ctx, lid, 0.8, [
      ex - 2.7,
      EY - 0.1,
      ex - 1,
      EY - ry - 0.05,
      ex + 1,
      EY - ry - 0.05,
      ex + 2.7,
      EY - 0.1,
    ]);
}
function brow(ctx: Ctx, color: string, ex: number, side: number, b: number, raise: number) {
  const BY = -5.6 - raise;
  const inner = ex - side * 2.4,
    outer = ex + side * 3;
  const yi = BY + (b > 0 ? b * 1.2 : b * 1.7),
    yo = BY - b * 0.5;
  line(ctx, color, 1.25, [inner, yi, (inner + outer) / 2, (yi + yo) / 2 - 0.45, outer, yo]);
}
function mouth(ctx: Ctx, k: Tone, m: Lips, mx: number, shade: string) {
  const MY = 8;
  const lip = k('#8A4848'),
    dark = k('#2C1418'),
    teeth = k('#F2ECE2');
  switch (m) {
    case 'flat':
      line(ctx, lip, 0.95, [mx - 3, MY, mx + 3, MY]);
      line(ctx, shade, 0.6, [mx - 1.6, MY + 1.8, mx + 1.6, MY + 1.8]);
      break;
    case 'tight':
      line(ctx, lip, 1.05, [mx - 2.3, MY + 0.1, mx + 2.3, MY + 0.1]);
      line(ctx, shade, 0.6, [mx - 1.2, MY + 2.4, mx + 1.2, MY + 2.4]);
      break;
    case 'frown':
      line(ctx, lip, 0.95, [mx - 3.2, MY + 1.1, mx - 1.2, MY, mx + 1.2, MY, mx + 3.2, MY + 1.1]);
      break;
    case 'smile':
      line(ctx, lip, 0.95, [
        mx - 3.4,
        MY - 0.9,
        mx - 1.3,
        MY + 0.6,
        mx + 1.3,
        MY + 0.6,
        mx + 3.4,
        MY - 0.9,
      ]);
      line(ctx, shade, 0.55, [mx - 1.4, MY + 2.2, mx + 1.4, MY + 2.2]);
      break;
    case 'wry':
      line(ctx, lip, 0.95, [mx - 3, MY + 0.3, mx + 0.5, MY + 0.3, mx + 3.3, MY - 1]);
      break;
    case 'open':
      oval(ctx, mx, MY + 0.5, 2.3, 1.3, dark);
      line(ctx, teeth, 0.6, [mx - 1.6, MY - 0.4, mx + 1.6, MY - 0.4]);
      break;
    case 'o':
      oval(ctx, mx, MY + 0.6, 1.3, 1.7, dark);
      break;
    case 'laugh':
      poly(ctx, dark, [
        mx - 4,
        MY - 0.9,
        mx + 4,
        MY - 0.9,
        mx + 2.8,
        MY + 2.6,
        mx,
        MY + 3.4,
        mx - 2.8,
        MY + 2.6,
      ]);
      poly(ctx, teeth, [
        mx - 3.5,
        MY - 0.9,
        mx + 3.5,
        MY - 0.9,
        mx + 3.1,
        MY + 0.2,
        mx - 3.1,
        MY + 0.2,
      ]);
      oval(ctx, mx, MY + 2.4, 1.6, 0.7, k('#B85A5A'));
      break;
    case 'wobble':
      line(ctx, lip, 0.95, [
        mx - 3,
        MY + 0.8,
        mx - 1.5,
        MY,
        mx,
        MY + 0.6,
        mx + 1.5,
        MY,
        mx + 3,
        MY + 0.8,
      ]);
      break;
  }
}
function glasses(ctx: Ctx, k: Tone, dx: number) {
  const g = k('#3E3440');
  for (const side of [-1, 1]) {
    const ex = side * 4.8 + dx;
    line(ctx, g, 0.65, [ex - 3.3, -3.9, ex + 3.3, -3.9, ex + 3, 0.8, ex - 3, 0.8, ex - 3.3, -3.9]);
    line(ctx, alpha('#FFFFFF', 0.22), 0.5, [ex + 1.2, -3.2, ex + 2.4, -2]);
  }
  line(ctx, g, 0.65, [-1.5 + dx, -2.8, 1.5 + dx, -2.8]);
  line(ctx, g, 0.6, [-8.1 + dx, -3.5, -11.2, -2.6]);
  line(ctx, g, 0.6, [8.1 + dx, -3.5, 11.2, -2.6]);
}

function portrait(ctx: Ctx, k: Tone, who: Who, o: Portrait, seconds: number) {
  const f = o.face;
  const turn = o.turn ?? 0,
    dx = turn * 2.4,
    nx = turn * 2.9;
  const light = o.light ?? -1;
  const base = SKIN[who];
  const skin = k(base),
    shade = k(mix(base, '#56344C', 0.3)),
    deep = k(mix(base, '#3A1E30', 0.5));
  const hairC = k(HAIR[who]),
    hairDark = k(mix(HAIR[who], INK, 0.35)),
    hairLight = k(mix(HAIR[who], '#F6E6CC', 0.28));
  const lid = k(mix(base, '#2A1420', 0.62));
  const breathe = Math.sin(seconds * 1.6 + PHASE[who] * 2) * 0.35 + (o.shake ?? 0);
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(o.s, o.s);
  ctx.save();
  ctx.translate(0, breathe);
  clothes(ctx, k, who, o.flour ?? 0, o.loose ?? 0);
  ctx.restore();
  if (who === 'nell') poly(ctx, hairDark, NELL_BACK);
  box(ctx, -5, 6, 10, 10, shade);
  ctx.save();
  ctx.rotate(o.tilt ?? 0);
  if (who === 'ruth') oval(ctx, -dx * 0.4, -18.5, 5.5, 3.3, hairDark);
  oval(ctx, -11.2 + dx * 0.25, 0.5, 1.8, 3.1, shade);
  oval(ctx, 11.2 + dx * 0.25, 0.5, 1.8, 3.1, shade);
  poly(ctx, skin, HEAD_SHAPE);
  poly(
    ctx,
    shade,
    CHEEK_SHADE.map((v, i) => (i % 2 ? v : -light * v + dx * 0.35)),
  );
  if (o.rim)
    line(ctx, alpha(o.rim, 0.7), 0.8, [
      light * 10.9,
      -9,
      light * 11,
      3,
      light * 9,
      8,
      light * 5,
      13,
    ]);
  const eyes = f.eyes ?? 'open';
  const browC = k(mix(HAIR[who], INK, 0.5));
  for (const side of [-1, 1] as const) {
    const ex = side * 4.8 + dx;
    eye(ctx, k, who, ex, eyes, f.look ?? 0, skin, lid);
    brow(ctx, browC, ex, side, f.brows ?? 0, f.raise ?? 0);
    if (who === 'ruth') line(ctx, shade, 0.5, [ex - 2, 1.6, ex, 2.2, ex + 2, 1.6]);
    const wet = clamp(f.tear ?? 0);
    if (wet > 0)
      faded(ctx, wet, () => line(ctx, k('#E6F2FA'), 0.55, [ex - 2.1, 0.2, ex + 2.1, 0.2]));
  }
  line(ctx, shade, 0.9, [0.5 + nx, -1.8, 1.5 + nx, 3.3, -0.1 + nx, 4.3]);
  line(ctx, deep, 0.6, [-1.8 + nx, 4.1, -0.7 + nx, 4.6]);
  if (who === 'nell')
    for (const [fx, fy] of FRECKLES) box(ctx, fx + dx, fy, 0.7, 0.7, k('#C88A64'));
  if (who === 'daniel')
    poly(
      ctx,
      alpha(k('#6A5058'), 0.2),
      [-9.5, 5, -5.5, 12, 0, 14.4, 5.5, 12, 9.5, 5, 6, 9.5, 0, 11.6, -6, 9.5],
    );
  mouth(ctx, k, f.mouth ?? 'flat', dx * 1.1, shade);
  const blush = f.blush ?? 0;
  if (blush > 0)
    faded(ctx, blush * 0.45, () => {
      oval(ctx, -6.6 + dx, 3.6, 2.3, 1.1, '#E27C76');
      oval(ctx, 6.6 + dx, 3.6, 2.3, 1.1, '#E27C76');
    });
  const flour = f.flour ?? 0;
  if (flour > 0)
    faded(ctx, flour, () => {
      oval(ctx, 1.4 + nx, 2.6, 1.7, 1.2, k(FLOUR));
      oval(ctx, -6.5 + dx, 2.4, 2.6, 1.1, k(FLOUR));
    });
  const run = (f.tear ?? 0) - 1;
  if (run > 0) {
    const tx = light * 5.6 + dx,
      ty = 0.8 + run * 9;
    line(ctx, alpha(k('#DCEEF8'), 0.5), 0.5, [tx, 0.8, tx + 0.2, ty]);
    disc(ctx, tx + 0.2, ty, 0.65, k('#E4F2FA'));
  }
  if (who === 'ruth') {
    poly(ctx, hairC, RUTH_HAIR);
    poly(ctx, k('#BEB5AD'), RUTH_STREAK);
    line(ctx, hairDark, 0.6, [-7.5, -13, -10, -8, -10.6, -2.5]);
    glasses(ctx, k, dx);
  } else if (who === 'daniel') {
    poly(ctx, hairC, DANIEL_HAIR);
    poly(ctx, k('#8E847C'), [-11.6, -8.5, -10.4, -8.5, -10.4, -4.5, -11.6, -4.5]);
    poly(ctx, k('#8E847C'), [11.6, -8.5, 10.4, -8.5, 10.4, -4.5, 11.6, -4.5]);
    line(ctx, hairLight, 0.5, [-3, -17.6, -4.2, -13.8]);
  } else {
    poly(ctx, hairC, NELL_FRINGE);
    for (const lock of NELL_LOCKS) poly(ctx, hairC, lock);
    line(ctx, hairLight, 0.7, [-5, -18, 1, -18.8, 6, -17.6]);
  }
  ctx.restore();
  ctx.restore();
}

// ——— Hands, for the inserts (hand units: the palm is about 11 × 11, fingers up) ———
type Glove = Who | 'mum' | 'kid' | 'mitt';
type HandPose = {
  x: number;
  y: number;
  a: number;
  s: number;
  who: Glove;
  left?: boolean;
  curl?: number;
  pinch?: number;
  flour?: number;
  /** Paint the hand as one flat silhouette in this colour (for a soft shadow under it). */
  ink?: string;
};
function sleeveOf(ctx: Ctx, k: Tone, who: Glove) {
  switch (who) {
    case 'daniel':
      box(ctx, -6.5, 3.2, 13, 22, k(CLOTH.daniel.main));
      box(ctx, -6, 0, 12, 4, k('#ECEAE4'));
      box(ctx, -0.8, 1.4, 1.6, 1.2, k('#C8B070'));
      break;
    case 'ruth':
      box(ctx, -6.8, 0, 13.6, 22, k(CLOTH.ruth.main));
      for (let i = -5; i <= 5; i += 2) box(ctx, i, 0.5, 0.6, 4, k(CLOTH.ruth.dark));
      break;
    case 'nell':
      box(ctx, -6.4, 0.5, 12.8, 22, k(CLOTH.nell.main));
      box(ctx, -5.6, -0.4, 11.2, 1.4, k('#C8CCD6'));
      break;
    case 'mum':
      box(ctx, -6.8, 0, 13.6, 22, k(MUSTARD));
      for (let i = -5; i <= 5; i += 2) box(ctx, i, 0.5, 0.6, 4, k(MUSTARD_DARK));
      break;
    case 'kid':
      box(ctx, -6.4, 0, 12.8, 22, k('#B84A44'));
      box(ctx, -6.4, 0, 12.8, 2, k('#9A3A36'));
      break;
    case 'mitt':
      box(ctx, -6.8, 0, 13.6, 22, k(CLOTH.ruth.main));
      break;
  }
}
function bigHand(ctx: Ctx, k: Tone, h: HandPose) {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.a);
  ctx.scale(h.left ? -h.s : h.s, h.s);
  if (!h.ink) sleeveOf(ctx, k, h.who);
  if (h.who === 'mitt') {
    const quilt = k('#D8CBAE'),
      check = k('#7C98BA');
    poly(ctx, quilt, [-7, 1, 7, 1, 7.5, -12, 5, -17, -3, -17, -6, -13, -9, -12, -9.5, -7, -7, -5]);
    for (let i = -4; i <= 4; i += 4) box(ctx, i, -16, 1, 16, check);
    for (let j = -14; j <= -2; j += 4) box(ctx, -7, j, 14, 1, check);
    ctx.restore();
    return;
  }
  const base = SKIN[h.who];
  const skin = h.ink ?? k(base),
    crease = h.ink ?? k(mix(base, '#5A3040', 0.3)),
    nail = h.ink ?? k(mix(base, '#FFFFFF', 0.38));
  const curl = h.curl ?? 0,
    pinch = h.pinch ?? 0;
  if (h.ink) box(ctx, -6, 0, 12, 20, h.ink);
  poly(ctx, skin, [-5, 0.5, 5, 0.5, 5.8, -7, 4.6, -11, -4.6, -11, -5.8, -7]);
  const fingers = [
    [-3.5, 7],
    [-1.15, 7.8],
    [1.15, 7.3],
    [3.4, 5.8],
  ] as const;
  fingers.forEach(([fx, len], i) => {
    const L = len * (1 - curl * 0.55) * (i === 0 ? 1 - pinch * 0.3 : 1);
    const fa = (i - 1.5) * 0.08;
    const tipx = fx + Math.sin(fa) * L + (i === 0 ? pinch * 1.6 : 0),
      tipy = -10.5 - Math.cos(fa) * L;
    line(ctx, skin, 2.3, [fx, -10, tipx, tipy]);
    oval(ctx, tipx, tipy + 0.7, 0.7, 0.9, nail);
    box(ctx, fx - 0.6, -12.6, 1.2, 0.4, crease);
  });
  line(ctx, skin, 2.6, [
    -5.2,
    -3,
    -7.4 + pinch * 4,
    -6.5 - pinch * 3.6,
    -8.2 + pinch * 5.2,
    -9.2 - pinch * 4.4,
  ]);
  if (h.ink) {
    ctx.restore();
    return;
  }
  line(ctx, crease, 0.35, [-3.4, -10, -2, -3]);
  line(ctx, crease, 0.35, [1.2, -10, 1, -3]);
  if (h.who === 'mum') {
    box(ctx, 0.3, -13.6, 1.8, 0.9, k('#E0B040'));
    disc(ctx, 2, -6, 0.5, crease);
    disc(ctx, -2.2, -4, 0.4, crease);
  }
  if (h.who === 'nell') box(ctx, -4.4, -13.2, 1.8, 0.7, k('#C8CCD6'));
  const flour = h.flour ?? 0;
  if (flour > 0)
    faded(ctx, flour, () => {
      const w = k(FLOUR);
      oval(ctx, 0, -6, 4, 3, w);
      oval(ctx, -2.4, -15, 2, 2, w);
      oval(ctx, 2.2, -16, 1.8, 2.2, w);
    });
  ctx.restore();
}

// ——— The kitchen (world 320 × 180; the back wall meets the floor at y 122) ———
const FLOOR_Y = 122;
const WIN = { x: 86, y: 24, w: 54, h: 46 } as const;
const OVEN_X = 264;
const TABLE = { l: 46, r: 276, top: 112, front: 124, apron: 130 } as const;
const SEAT_Y = 124;
const STAND_Y = 128;
const APART = { ruth: 96, daniel: 170, nell: 244 } as const;
const STANDS = { ruth: 128, daniel: 150, nell: 172 } as const;
const CLOSE = { ruth: 72, daniel: 100, nell: 128 } as const;

/** The pane of the kitchen window: sky, the terrace opposite, rain. */
function pane(
  ctx: Ctx,
  k: Tone,
  t: number,
  seconds: number,
  x: number,
  y: number,
  w: number,
  h: number,
  amount: number,
) {
  const night = ease(span(t, 15, 140));
  const out = (a: string, b: string) => k(mix(a, b, night));
  box(ctx, x, y, w, h, out('#5E6A84', '#141C32'));
  box(ctx, x, y, w, Math.round(h * 0.3), out('#4E5A74', '#10162A'));
  poly(ctx, out('#394258', '#0C101C'), [
    x,
    y + h,
    x,
    y + h * 0.66,
    x + w * 0.26,
    y + h * 0.48,
    x + w * 0.55,
    y + h * 0.66,
    x + w * 0.55,
    y + h,
  ]);
  box(ctx, x + w * 0.37, y + h * 0.46, w * 0.07, h * 0.13, out('#394258', '#0C101C'));
  box(ctx, x + w * 0.6, y + h * 0.6, w * 0.4, h * 0.4, out('#424A60', '#0E1220'));
  box(ctx, x + w * 0.74, y + h * 0.73, w * 0.07, h * 0.11, k(mix('#8A8C80', '#E8C878', night)));
  const n = Math.round(26 * amount * (w / 54));
  if (n <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const drop = k('#C4D2E0');
  for (let i = 0; i < n; i++) {
    const fall = (rand(i * 3.7 + 1) * (h + 10) + seconds * (80 + rand(i * 1.3) * 40)) % (h + 10);
    const px = (rand(i * 7.1 + 2) * w + fall * 0.2) % w;
    box(ctx, x + px, y + fall - 8, 1, 3, drop);
  }
  ctx.restore();
}
function kitchenWindow(ctx: Ctx, k: Tone, t: number, seconds: number) {
  const { x, y, w, h } = WIN;
  const frame = k('#E4DECE');
  box(ctx, x - 4, y - 4, w + 8, h + 8, frame);
  pane(ctx, k, t, seconds, x, y, w, h, rainAt(t));
  box(ctx, x + w / 2 - 1, y, 2, h, frame);
  box(ctx, x, y + 20, w, 2, frame);
  box(ctx, x - 7, y + h + 4, w + 14, 3, k('#EEE8DA'));
  const cloth = k('#B9705E'),
    fold = k('#9A5A4A');
  poly(ctx, cloth, [x - 7, y - 6, x + 7, y - 6, x + 5, y + h + 3, x - 7, y + h + 3]);
  poly(ctx, cloth, [
    x + w + 7,
    y - 6,
    x + w - 7,
    y - 6,
    x + w - 5,
    y + h + 3,
    x + w + 7,
    y + h + 3,
  ]);
  box(ctx, x - 2, y - 5, 1, h + 7, fold);
  box(ctx, x + w + 1, y - 5, 1, h + 7, fold);
  box(ctx, x - 9, y - 8, w + 18, 2, k('#6A4A34'));
  // A geranium on the sill, gone leggy since spring.
  box(ctx, x + 38, y + h - 1, 6, 5, k('#B8664A'));
  disc(ctx, x + 41, y + h - 4, 3, k('#5C7A4A'));
  disc(ctx, x + 39, y + h - 8, 2, k('#C85050'));
  // The worktop and cupboards under it.
  box(ctx, 64, 78, 100, 4, k('#C9B894'));
  box(ctx, 66, 82, 96, 35, k('#8C9C88'));
  for (let i = 0; i < 4; i++) {
    box(ctx, 69 + i * 24, 85, 20, 29, k('#96A692'));
    box(ctx, 85 + i * 24, 98, 1, 4, k('#C8A060'));
  }
}
function recipeTin(ctx: Ctx, k: Tone, x: number, y: number, s: number, open: boolean) {
  const w = 12 * s,
    h = 8 * s;
  box(ctx, x - w / 2, y - h, w, h, k('#A83A3C'));
  box(ctx, x - w / 2, y - h, w, s, k('#D8B060'));
  for (let i = 0; i < 3; i++)
    disc(
      ctx,
      x - w / 2 + (2.5 + i * 3.5) * s,
      y - h / 2 + (i % 2 ? 1 : -1) * s,
      0.9 * s,
      k('#F2E4C8'),
    );
  if (open) box(ctx, x - w / 2 + s, y - h - 2 * s, w - 2 * s, 2 * s, k('#EFE3C4'));
  else box(ctx, x - w / 2 - 0.5 * s, y - h - 1.5 * s, w + s, 2 * s, k('#B8484A'));
}
function photo(ctx: Ctx, k: Tone, x: number, y: number) {
  box(ctx, x, y - 13, 10, 13, k('#3A2A20'));
  box(ctx, x + 1, y - 12, 8, 11, k('#E6D6B8'));
  box(ctx, x + 2, y - 5, 6, 4, k(MUSTARD));
  disc(ctx, x + 5, y - 7.5, 2, k(SKIN.mum));
  box(ctx, x + 2, y - 11, 6, 2, k('#E8E6E2'));
}
function mumCup(ctx: Ctx, k: Tone, x: number, y: number) {
  box(ctx, x - 3, y - 5, 6, 5, k('#EEE6D6'));
  box(ctx, x - 3, y - 4, 6, 1, k('#4E70A8'));
  box(ctx, x + 3, y - 4, 2, 1, k('#EEE6D6'));
  box(ctx, x + 4, y - 4, 1, 3, k('#EEE6D6'));
}
function dresser(ctx: Ctx, k: Tone, t: number) {
  const edge = k('#87603F');
  box(ctx, 4, 22, 56, FLOOR_Y - 22, k('#6C4832'));
  box(ctx, 2, 18, 60, 5, edge);
  box(ctx, 8, 26, 48, 50, k('#4E3424'));
  box(ctx, 8, 43, 48, 2, edge);
  box(ctx, 8, 60, 48, 2, edge);
  box(ctx, 2, 76, 60, 4, edge);
  for (let i = 0; i < 4; i++) {
    const px = 15 + i * 11.3;
    disc(ctx, px, 35, 5, k('#E8E4DA'));
    disc(ctx, px, 35, 3, k('#8CA2C0'));
    disc(ctx, px, 35, 1.4, k('#E8E4DA'));
  }
  box(ctx, 11, 50, 7, 10, k('#C8D4D0'));
  box(ctx, 11, 49, 7, 2, k('#8A6A4A'));
  box(ctx, 22, 51, 8, 9, k('#3E5E4A'));
  box(ctx, 22, 51, 8, 2, k('#2C4636'));
  if (t < TIN) recipeTin(ctx, k, 44, 60, 1, false);
  // Cups on hooks under the middle shelf; Mum's is the one with the blue band.
  for (let i = 0; i < 3; i++) {
    box(ctx, 13 + i * 9, 63, 5, 5, k('#E6E0D2'));
    box(ctx, 18 + i * 9, 64, 1, 3, k('#E6E0D2'));
  }
  if (t < 158) mumCup(ctx, k, 44, 69);
  box(ctx, 8, 84, 22, 32, k('#7A5238'));
  box(ctx, 34, 84, 22, 32, k('#7A5238'));
  disc(ctx, 27, 100, 1.2, k('#C8A060'));
  disc(ctx, 37, 100, 1.2, k('#C8A060'));
  photo(ctx, k, 12, 76);
  if (t >= 72) recipeTin(ctx, k, 48, 76, 1, true);
}
function clockMinutes(t: number) {
  return 17 * 60 + 38 + t / 60 + 40 * ease(span(t, 139.8, 142.3));
}
function wallClock(ctx: Ctx, k: Tone, x: number, y: number, r: number, t: number) {
  disc(ctx, x, y, r * 1.18, k('#5A4030'));
  disc(ctx, x, y, r, k('#F2ECDC'));
  const s = Math.max(1, r * 0.07);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU,
      q = i % 3 === 0 ? 1.8 : 1;
    box(
      ctx,
      x + Math.cos(a) * r * 0.82 - (s * q) / 2,
      y + Math.sin(a) * r * 0.82 - (s * q) / 2,
      s * q,
      s * q,
      k('#3A3036'),
    );
  }
  const m = clockMinutes(t);
  const ma = ((m % 60) / 60) * TAU - Math.PI / 2,
    ha = (((m / 60) % 12) / 12) * TAU - Math.PI / 2;
  const ink = k(INK);
  line(ctx, ink, Math.max(0.9, r * 0.1), [
    x,
    y,
    x + Math.cos(ha) * r * 0.5,
    y + Math.sin(ha) * r * 0.5,
  ]);
  line(ctx, ink, Math.max(0.7, r * 0.06), [
    x,
    y,
    x + Math.cos(ma) * r * 0.78,
    y + Math.sin(ma) * r * 0.78,
  ]);
  if (r > 20) {
    const sa = ((t * (within(t, 139.8, 142.3) ? 40 : 1)) / 60) * TAU;
    line(ctx, k('#B8433A'), r * 0.025, [
      x,
      y,
      x + Math.sin(sa) * r * 0.85,
      y - Math.cos(sa) * r * 0.85,
    ]);
  }
  disc(ctx, x, y, Math.max(0.8, r * 0.06), ink);
}
function doorway(ctx: Ctx, k: Tone) {
  box(ctx, 164, 38, 40, FLOOR_Y - 38, k('#E4DECE'));
  box(ctx, 168, 42, 32, FLOOR_Y - 42, k('#2A2C34'));
  box(ctx, 190, 48, 10, 70, k('#33353E'));
  poly(ctx, k('#1A1A22'), [192, 52, 200, 52, 200, 100, 194, 94]);
  box(ctx, 196, 52, 3, 50, k('#C89A36'));
}
function range(ctx: Ctx, k: Tone, t: number) {
  const x = OVEN_X;
  const heat = ovenHeat(t);
  box(ctx, x - 6, 40, 62, 34, k('#E6E4DC'));
  for (let i = 1; i < 6; i++) box(ctx, x - 6 + i * 10, 40, 1, 34, k('#CFCCC2'));
  for (let j = 1; j < 4; j++) box(ctx, x - 6, 40 + j * 9, 62, 1, k('#CFCCC2'));
  box(ctx, x + 2, 46, 44, 1, k('#8A8680'));
  box(ctx, x + 10, 47, 2, 12, k('#8A8680'));
  disc(ctx, x + 11, 60, 3, k('#8A8680'));
  box(ctx, x + 30, 47, 1, 10, k('#8A8680'));
  oval(ctx, x + 30.5, 60, 2, 3.5, k('#A8A49C'));
  box(ctx, x, 74, 50, FLOOR_Y - 74, k('#E0D4B6'));
  box(ctx, x - 2, 71, 54, 4, k('#2A2A2E'));
  oval(ctx, x + 14, 66, 7, 5, k('#B84A3A'));
  box(ctx, x + 9, 60, 10, 2, k('#8A3228'));
  poly(ctx, k('#B84A3A'), [x + 20, 66, x + 26, 60, x + 27, 61, x + 22, 68]);
  for (let i = 0; i < 4; i++) {
    const kx = x + 8 + i * 8;
    disc(ctx, kx, 80, 2.2, k('#2A2A2E'));
    const a = i === 2 && t >= DIAL - 0.4 ? -2.2 * ease(span(t, DIAL - 0.4, DIAL)) : 0;
    line(ctx, k('#E8E0CC'), 0.8, [kx, 80, kx + Math.sin(a) * 1.8, 80 - Math.cos(a) * 1.8]);
  }
  box(ctx, x + 5, 86, 40, 30, k('#D6CAAC'));
  box(ctx, x + 5, 86, 40, 1, k('#F0E8D2'));
  const glass = heat > 0 ? mix('#2A2424', '#FF9A48', heat * 0.9) : '#2A2626';
  box(ctx, x + 13, 93, 24, 13, k(glass));
  if (heat > 0) {
    box(ctx, x + 15, 100, 20, 1, alpha(k('#FFD890'), heat * 0.7));
    glow(ctx, x + 25, 100, 34, '#FF9A40', 0.3 * heat);
  }
  box(ctx, x + 3, 88, 44, 2, k('#B8B0A0'));
  poly(ctx, k('#6C8CB2'), [x + 30, 88, x + 38, 88, x + 39, 105, x + 29, 105]);
  box(ctx, x + 29, 96, 10, 1, k('#E8E4DA'));
  box(ctx, x + 29, 100, 10, 1, k('#E8E4DA'));
}
function backWall(ctx: Ctx, k: Tone, t: number, seconds: number) {
  // The wall runs on past the dresser, for the push in on her chair.
  box(ctx, -80, 0, W + 80, FLOOR_Y, k(WALL));
  for (let x = -76; x < W; x += 10) box(ctx, x, 16, 1, FLOOR_Y - 20, k('#98A896'));
  box(ctx, -80, 12, W + 80, 3, k('#E6E0CE'));
  box(ctx, -80, 0, W + 80, 12, k('#D8D2C2'));
  box(ctx, -80, FLOOR_Y - 5, W + 80, 5, k('#76846F'));
  // A calendar still on last month, and the light switch.
  box(ctx, -52, 30, 22, 30, k('#EEE8DA'));
  box(ctx, -52, 30, 22, 12, k('#7A9AB8'));
  for (let i = 0; i < 4; i++) box(ctx, -50, 45 + i * 4, 18, 1, k('#C8C0B0'));
  box(ctx, -38, 48, 3, 3, alpha(k('#C84A40'), 0.8));
  box(ctx, -10, 64, 5, 8, k('#EEE8DA'));
  box(ctx, -8, 66, 1, 3, k('#A8A090'));
  kitchenWindow(ctx, k, t, seconds);
  dresser(ctx, k, t);
  doorway(ctx, k);
  wallClock(ctx, k, 184, 26, 8, t);
  range(ctx, k, t);
}
function lino(ctx: Ctx, k: Tone, top: number) {
  box(ctx, -80, top, W + 80, H - top, k('#968C78'));
  const dark = k('#7E7462');
  const rows = [0, 5, 11, 19, 29, 42, 58];
  for (let r = 0; r < rows.length - 1; r++) {
    const y0 = top + rows[r],
      y1 = top + rows[r + 1];
    if (y0 >= H) break;
    const size = 14 + r * 5;
    for (let x = (r % 2) * size - 90; x < W; x += size * 2) box(ctx, x, y0, size, y1 - y0, dark);
  }
}
function lamp(ctx: Ctx, k: Tone, t: number) {
  const w = warmth(t);
  line(ctx, k('#3A3A3A'), 1, [160, 0, 160, 24]);
  poly(ctx, k('#E6E2D6'), [150, 32, 170, 32, 165, 24, 155, 24]);
  box(ctx, 150, 31, 20, 1, k('#2A4A6A'));
  oval(ctx, 160, 33, 3, 1.5, mix('#EAF2FF', '#FFE2A0', w));
}
function lampLight(ctx: Ctx, t: number) {
  const w = warmth(t);
  glow(ctx, 160, 44, 160, mix('#C8DCF0', '#FFC468', w), lerp(0.1, 0.26, w));
  glow(ctx, 113, 46, 90, mix('#B8CCE4', '#8A9CC0', w), lerp(0.14, 0.04, w));
}
function tableTop(ctx: Ctx, k: Tone) {
  const leg = k('#634128');
  box(ctx, 50, TABLE.apron, TABLE.r - TABLE.l - 8, 14, alpha(k('#1E1A1E'), 0.35));
  box(ctx, 56, 130, 4, 8, leg);
  box(ctx, 262, 130, 4, 8, leg);
  box(ctx, 48, 130, 7, 44, leg);
  box(ctx, 267, 130, 7, 44, leg);
  box(ctx, 49, 130, 2, 44, k('#7C5636'));
  box(ctx, 268, 130, 2, 44, k('#7C5636'));
  box(ctx, TABLE.l, TABLE.top, TABLE.r - TABLE.l, 12, k('#A77A52'));
  box(ctx, TABLE.l, TABLE.top, TABLE.r - TABLE.l, 1, k('#8E6440'));
  const grain = k('#976C46');
  box(ctx, 60, 115, 50, 1, grain);
  box(ctx, 130, 118, 70, 1, grain);
  box(ctx, 214, 115, 44, 1, grain);
  box(ctx, 90, 121, 40, 1, grain);
  box(ctx, 236, 120, 30, 1, grain);
  box(ctx, TABLE.l - 2, TABLE.front, TABLE.r - TABLE.l + 4, 6, k('#7A5334'));
  box(ctx, TABLE.l - 2, TABLE.front, TABLE.r - TABLE.l + 4, 1, k('#BA8C60'));
}
function chairBack(ctx: Ctx, k: Tone, x: number, empty: boolean) {
  const wood = k('#6E4A30');
  box(ctx, x - 11, 88, 2, 36, wood);
  box(ctx, x + 9, 88, 2, 36, wood);
  box(ctx, x - 11, 88, 22, 4, k('#80583A'));
  if (empty) {
    box(ctx, x - 11, 100, 22, 2, wood);
    box(ctx, x - 5, 92, 2, 20, wood);
    box(ctx, x + 3, 92, 2, 20, wood);
    box(ctx, x - 11, 110, 22, 3, k('#80583A'));
  }
  box(ctx, x - 11, 130, 2, 8, wood);
  box(ctx, x + 9, 130, 2, 8, wood);
}
function shins(ctx: Ctx, k: Tone, who: Who, x: number) {
  const legs = k(CLOTH[who].legs),
    shoe = k('#18161C');
  box(ctx, x - 6, 130, 5, 11, legs);
  box(ctx, x + 1, 130, 5, 11, legs);
  box(ctx, x - 7, 140, 6, 2, shoe);
  box(ctx, x + 1, 140, 6, 2, shoe);
}
/** Mum's carver at the head of the table, in profile, her cardigan over the back. */
function carver(ctx: Ctx, k: Tone, cx: number) {
  const wood = k('#63412B'),
    lite = k('#80593A'),
    dark = k('#4E3220');
  // Splayed Windsor legs and a stretcher.
  line(ctx, dark, 2, [cx + 9, 120, cx + 8, 146]);
  line(ctx, dark, 2, [cx + 18, 120, cx + 19, 146]);
  line(ctx, wood, 2.4, [cx + 5, 120, cx + 1, 150]);
  line(ctx, wood, 2.4, [cx + 21, 120, cx + 25, 150]);
  box(ctx, cx + 3, 136, 21, 2, wood);
  // Seat and her flat red cushion.
  poly(ctx, lite, [cx + 2, 116, cx + 25, 116, cx + 24, 121, cx + 3, 121]);
  box(ctx, cx + 2, 116, 23, 1, k('#9A7050'));
  poly(ctx, k('#8C4E4A'), [cx + 5, 113, cx + 22, 113, cx + 23, 116, cx + 4, 116]);
  // The back leans a little; its spindles are seen edge-on.
  for (let i = 0; i < 4; i++)
    line(ctx, i % 2 ? wood : lite, 1.3, [cx + 3 + i * 1.6, 116, cx + i * 1.6, 82]);
  poly(ctx, lite, [cx - 3, 78, cx + 8, 78, cx + 9, 82, cx - 2, 83]);
  // The arm and its support.
  poly(ctx, lite, [cx + 3, 100, cx + 22, 100, cx + 23, 103, cx + 3, 103]);
  line(ctx, wood, 1.4, [cx + 20, 103, cx + 21, 116]);
  // Her cardigan, left over the back, one sleeve hanging.
  const m = k(MUSTARD),
    md = k(MUSTARD_DARK);
  poly(ctx, m, [
    cx - 6,
    80,
    cx + 3,
    76,
    cx + 11,
    80,
    cx + 12,
    96,
    cx + 10,
    106,
    cx + 6,
    102,
    cx + 2,
    104,
    cx - 1,
    110,
    cx - 6,
    104,
    cx - 8,
    92,
  ]);
  poly(ctx, m, [cx + 9, 84, cx + 14, 88, cx + 15, 110, cx + 11, 111, cx + 10, 94]);
  box(ctx, cx + 11, 108, 4, 3, md);
  line(ctx, md, 1, [cx + 2, 78, cx + 1, 104]);
  line(ctx, md, 0.5, [cx - 5, 90, cx - 4, 104]);
  line(ctx, md, 0.5, [cx + 8, 86, cx + 9, 100]);
  for (const y of [88, 94, 100]) box(ctx, cx + 5, y, 1, 1, k('#EFE2C4'));
}

// Props at table scale; (x, y) is where they stand on the table.
function cup(ctx: Ctx, k: Tone, x: number, y: number) {
  box(ctx, x - 5, y, 10, 1, k('#E4DDCF'));
  box(ctx, x - 3, y - 5, 6, 5, k('#EEE8DC'));
  box(ctx, x + 3, y - 4, 2, 1, k('#EEE8DC'));
  box(ctx, x + 4, y - 4, 1, 3, k('#EEE8DC'));
}
function mug(ctx: Ctx, k: Tone, x: number, y: number, color: string) {
  box(ctx, x - 3, y - 6, 6, 6, k(color));
  box(ctx, x + 3, y - 5, 2, 3, k(color));
}
function teapot(ctx: Ctx, k: Tone, x: number, y: number) {
  oval(ctx, x, y - 5, 8, 6, k(MUSTARD));
  box(ctx, x - 8, y - 2, 16, 2, k(MUSTARD_DARK));
  for (let i = -5; i <= 5; i += 3) box(ctx, x + i, y - 9, 1, 6, k(MUSTARD_DARK));
  disc(ctx, x, y - 11, 2, k('#E8C070'));
  box(ctx, x + 7, y - 5, 4, 1, k('#E8E2D6'));
}
function steam(ctx: Ctx, x: number, y: number, seconds: number, amount = 1) {
  for (let i = 0; i < 2; i++) {
    const u = (seconds * 0.5 + i * 0.5 + x * 0.01) % 1;
    box(
      ctx,
      x + Math.sin(u * 6 + i) * 1.5,
      y - u * 9,
      1,
      2,
      alpha('#FFF4E4', 0.45 * (1 - u) * amount),
    );
  }
}
function flourSpill(ctx: Ctx, k: Tone, from: number, to: number) {
  const f = k(FLOUR);
  for (let i = 0; i < 24; i++)
    box(ctx, from + rand(i * 2.3) * (to - from), 113 + rand(i * 5.1) * 10, i % 3 ? 1 : 2, 1, f);
}
function bakeMess(ctx: Ctx, k: Tone) {
  flourSpill(ctx, k, 92, 212);
  // The mixing bowl, the flour bag, the jug, the sugar bowl.
  poly(ctx, k('#E6DCC8'), [100, 107, 124, 107, 120, 118, 104, 118]);
  box(ctx, 100, 109, 24, 1, k('#5A7AAE'));
  poly(ctx, k('#E8E0CC'), [188, 118, 188, 103, 192, 100, 198, 100, 200, 103, 200, 118]);
  box(ctx, 190, 107, 8, 4, k('#C85A4A'));
  box(ctx, 214, 108, 7, 9, k('#E8E4DA'));
  box(ctx, 221, 110, 2, 4, k('#E8E4DA'));
  box(ctx, 176, 114, 7, 4, k('#EEE8DC'));
  box(ctx, 177, 113, 5, 1, k('#FFFFFF'));
}
function board(ctx: Ctx, k: Tone, x: number) {
  box(ctx, x - 15, 116, 30, 3, k('#C49A68'));
  box(ctx, x - 15, 118, 30, 1, k('#9A7048'));
}
function loafTin(ctx: Ctx, k: Tone, x: number, seconds: number, smoke: number) {
  poly(ctx, k('#4A4A52'), [x - 10, 108, x + 10, 108, x + 9, 116, x - 9, 116]);
  box(ctx, x - 10, 108, 20, 1, k('#74747C'));
  // Risen over the rim, and burnt on top: the way hers always came out.
  poly(ctx, k('#7A4424'), [
    x - 10,
    109,
    x - 9,
    105,
    x - 5,
    102,
    x + 5,
    102,
    x + 9,
    105,
    x + 10,
    109,
  ]);
  poly(ctx, k('#2A1810'), [
    x - 8,
    105,
    x - 5,
    102.5,
    x + 5,
    102.5,
    x + 8,
    105,
    x + 4,
    104.2,
    x - 4,
    104.2,
  ]);
  box(ctx, x - 3, 103, 6, 1, k('#140C08'));
  box(ctx, x - 9, 107, 3, 1, k('#A8663A'));
  box(ctx, x + 6, 107, 3, 1, k('#A8663A'));
  if (smoke > 0)
    for (let i = 0; i < 5; i++) {
      const u = (seconds * 0.3 + i * 0.2) % 1;
      disc(
        ctx,
        x - 4 + i * 2 + Math.sin(u * 6 + i) * 3,
        101 - u * 20,
        1 + u * 1.5,
        alpha('#C8C4C0', 0.45 * (1 - u) * smoke),
      );
    }
}
function kneadDough(ctx: Ctx, k: Tone, x: number, p: number) {
  oval(ctx, x, 114, 7 + p * 2, 3.5 - p * 0.8, k('#EADCB8'));
  box(ctx, x - 4, 112, 5, 1, k('#F6EEDC'));
}

// ——— Staging in the kitchen ———
/** `rear` is drawn behind the chairs; `hug` draws the arms straight after the body, behind the next one. */
type Cast = { who: Who; b: Body; seat?: boolean; rear?: boolean; hug?: boolean }[];
type Stage = {
  cast: Cast;
  chairs: readonly number[];
  carver: number;
  under?: (ctx: Ctx, k: Tone) => void;
  over?: (ctx: Ctx, k: Tone) => void;
};

function tea(ctx: Ctx, k: Tone, t: number, seconds: number) {
  cup(ctx, k, 105, 117);
  if (t < SPOON_DOWN) line(ctx, k('#C8C8D0'), 1, [105, 111, 107, 108]);
  else line(ctx, k('#C8C8D0'), 1, [109, 117, 113, 116]);
  teapot(ctx, k, 140, 117);
  cup(ctx, k, 179, 117);
  box(ctx, 187, 116, 7, 1, k('#1C1C24'));
  mug(ctx, k, 236, 117, '#40688A');
  if (t < 40) {
    steam(ctx, 104, 110, seconds, 0.7);
    steam(ctx, 236, 109, seconds, 0.7);
  }
  if (t >= SLIDE) box(ctx, 154, 115, 12, 2, k('#EFE3C4'));
}

/** Nell leaves her chair, passes her mother's, and finds the tin. */
function nellUp(t: number, seconds: number): Body {
  const walking = within(t, SCRAPE + 0.3, 66.2);
  const x = lerp(APART.nell, 40, ease(span(t, SCRAPE + 0.3, 66.3)));
  const touching = within(t, TOUCH - 0.3, TOUCH + 0.8);
  const shelf = within(t, 67.3, 69.2);
  let hands: Body['hands'];
  if (touching) hands = [[-16, -38], null];
  else if (shelf && t < TIN) {
    const r = ease(span(t, 67.5, 68.2));
    hands = [
      [lerp(-11, -2, r), lerp(-32, -69, r)],
      [lerp(11, 9, r), lerp(-32, -69, r)],
    ];
  }
  if (t >= TIN) {
    const d = ease(span(t, TIN, TIN + 0.6));
    const y = lerp(-69, -42, d);
    hands = [
      [lerp(-2, -5, d), y],
      [lerp(9, 6, d), y],
    ];
    if (t >= LID) {
      const l = ease(span(t, LID, LID + 0.35));
      hands = [
        [-5, -42],
        [lerp(6, 13, l), lerp(-42, -47, l)],
      ];
    }
  }
  const looking = touching || (t >= TIN && !shelf);
  return {
    x,
    y: 126,
    mode: 'stand',
    step: walking ? seconds * 10 : undefined,
    back: shelf,
    turn: walking ? -1 : touching ? -0.9 : 0,
    tilt: looking ? 0.12 : 0,
    hands,
    face: { eyes: looking ? 'down' : blink('nell', seconds), brows: -0.5, mouth: 'flat' },
  };
}
function apartStage(t: number, seconds: number): Stage {
  const stir = within(t, STIRS[0] - 0.35, SPOON_DOWN);
  const ruthWatch = within(t, 65, 71);
  const cast: Cast = [
    {
      who: 'ruth',
      seat: true,
      b: {
        x: APART.ruth,
        y: SEAT_Y,
        mode: 'sit',
        turn: ruthWatch ? -0.7 : 0.25,
        lean: 0.03,
        hands: [
          [-5, -8],
          stir ? [9 + Math.cos(seconds * 10) * 1.4, -10 + Math.sin(seconds * 10) * 0.7] : [8, -8],
        ],
        face: {
          eyes: ruthWatch ? blink('ruth', seconds) : 'down',
          brows: ruthWatch ? -0.4 : 0.35,
          mouth: lips('ruth', t, seconds, 'tight'),
        },
      },
    },
    {
      who: 'daniel',
      seat: true,
      b: {
        x: APART.daniel,
        y: SEAT_Y,
        mode: 'sit',
        turn: within(t, 20, 26) ? -0.3 : 0,
        hands: [
          [-2, -8],
          [3, -8],
        ],
        face: {
          eyes: within(t, 17.2, 18.4) || t > 57.5 ? 'down' : blink('daniel', seconds),
          brows: -0.15,
          mouth: lips('daniel', t, seconds, 'flat'),
        },
      },
    },
  ];
  if (t < SCRAPE) {
    const chair = within(t, 18.2, 19.7);
    cast.push({
      who: 'nell',
      seat: true,
      b: {
        x: APART.nell,
        y: SEAT_Y,
        mode: 'sit',
        turn: within(t, 20, 26) ? -0.8 : chair ? -1 : -0.3,
        tilt: chair ? 0.06 : -0.04,
        hands: [
          [-6, -8],
          [6, Math.sin(seconds * 12) > 0.2 ? -9 : -8],
        ],
        face: {
          eyes: blink('nell', seconds),
          brows: chair ? -0.7 : 0.1,
          mouth: within(t, 23.6, 26) ? 'wry' : 'flat',
        },
      },
    });
  } else cast.push({ who: 'nell', b: nellUp(t, seconds) });
  const nell = cast[2].b;
  return {
    cast,
    chairs: [APART.ruth, APART.daniel, APART.nell],
    carver: 14,
    under: (ctx, k) => tea(ctx, k, t, seconds),
    over: (ctx, k) => {
      if (t < TIN || t >= 72) return;
      const a = handAt(nell, 0),
        b = handAt(nell, 1);
      // From behind, the tin disappears in front of her once it drops below her shoulders.
      if (nell.back && a.y > nell.y - 60) return;
      const open = t >= LID;
      const tx = open ? a.x + 2 : (a.x + b.x) / 2,
        ty = (open ? a.y : (a.y + b.y) / 2) + 4;
      recipeTin(ctx, k, tx, ty, 1, open);
      if (open) box(ctx, b.x - 6, b.y - 2, 12, 2, k('#B8484A'));
    },
  };
}

function ovenStage(t: number, seconds: number): Stage {
  const twist = within(t, DIAL - 0.4, DIAL + 0.2) ? Math.sin(seconds * 30) * 0.5 : 0;
  return {
    cast: [
      {
        who: 'ruth',
        rear: true,
        b: {
          x: 260,
          y: STAND_Y,
          mode: 'stand',
          turn: 0.8,
          hands: [
            [-8, -36],
            [20 + twist, -48],
          ],
          face: {
            eyes: blink('ruth', seconds),
            brows: -0.2,
            mouth: lips('ruth', t, seconds, 'flat'),
          },
        },
      },
      {
        who: 'daniel',
        seat: true,
        b: {
          x: APART.daniel,
          y: SEAT_Y,
          mode: 'sit',
          turn: 0.6,
          hands: [
            [-2, -8],
            [3, -8],
          ],
          face: { eyes: blink('daniel', seconds), brows: -0.1, mouth: 'flat' },
        },
      },
    ],
    chairs: [APART.ruth, APART.daniel, APART.nell],
    carver: 14,
    under: (ctx, k) => tea(ctx, k, t, seconds),
  };
}

const laughBob = (seconds: number, phase: number) =>
  Math.round(Math.sin(seconds * 15 + phase) * 0.8);
function bakeStage(t: number, seconds: number): Stage {
  const p = press(t, BAKE_KNEADS);
  const flour = lerp(0.55, 0.95, span(t, 119, 124));
  const allLaugh = t >= RUTH_LAUGH;
  // Daniel: kneading, then he sees his suit, then he flicks a pinch at his sister.
  const sees = within(t, POINT + 0.3, FLICK - 0.5);
  const flicking = within(t, FLICK - 0.5, FLICK + 0.3);
  const flick = hump(t, FLICK - 0.45, FLICK + 0.3);
  const daniel: Body = {
    x: STANDS.daniel,
    y: STAND_Y,
    mode: 'stand',
    flour,
    turn: flicking ? 0.6 : t > FLICK ? 0.4 : 0,
    tilt: sees ? 0.2 : 0,
    bob: allLaugh ? laughBob(seconds, 1) : 0,
    hands: flicking
      ? [
          [-5, -13],
          [lerp(5, 16, flick), lerp(-13, -50, flick)],
        ]
      : [
          [-5, -13 + p * 2],
          [5, -13 + p * 2],
        ],
    face: {
      eyes: allLaugh ? 'laugh' : sees || t < POINT + 0.3 ? 'down' : blink('daniel', seconds),
      brows: sees ? -0.3 : 0,
      mouth: allLaugh ? 'laugh' : sees ? 'o' : t > FLICK - 0.5 ? 'smile' : 'flat',
      flour: t > POINT ? 0.4 : 0,
    },
  };
  // Nell points at his suit and laughs, gets a faceful, and laughs harder.
  const pointing = within(t, POINT, FLICK);
  const hit = within(t, FLICK + 0.15, FLICK + 0.8);
  const nell: Body = {
    x: STANDS.nell,
    y: STAND_Y,
    mode: 'stand',
    turn: -0.6,
    bob: t >= POINT && !hit ? laughBob(seconds, 2) : 0,
    hands: pointing
      ? [
          [-18, -40],
          [6, -14],
        ]
      : [
          [-5, -14],
          [6, -14],
        ],
    face: {
      eyes: hit ? 'closed' : t >= POINT ? 'laugh' : blink('nell', seconds),
      brows: 0,
      mouth: hit ? 'o' : t >= POINT ? 'laugh' : 'smile',
      flour: ease(span(t, FLICK + 0.1, FLICK + 0.2)),
      blush: t >= POINT ? 1 : 0,
    },
  };
  // Ruth tries not to, and then does.
  const cover = within(t, RUTH_LAUGH, RUTH_LAUGH + 1.2);
  const ruth: Body = {
    x: STANDS.ruth,
    y: STAND_Y,
    mode: 'stand',
    turn: 0.45,
    bob: allLaugh ? laughBob(seconds, 0) : 0,
    hands: cover
      ? [
          [1, -60],
          [8, -14],
        ]
      : [
          [-6, -14 + (t < POINT ? Math.max(0, Math.sin(seconds * 6)) : 0)],
          [8, -14],
        ],
    face: {
      eyes: allLaugh ? 'laugh' : t < POINT ? 'down' : blink('ruth', seconds),
      brows: allLaugh ? -0.3 : 0.1,
      mouth: allLaugh ? 'laugh' : t > FLICK + 0.2 ? 'wry' : 'tight',
      blush: allLaugh ? 1 : 0,
    },
  };
  return {
    cast: [
      { who: 'ruth', b: ruth },
      { who: 'daniel', b: daniel },
      { who: 'nell', b: nell },
    ],
    chairs: [],
    carver: 14,
    under: (ctx, k) => {
      bakeMess(ctx, k);
      board(ctx, k, STANDS.daniel);
      kneadDough(ctx, k, STANDS.daniel, p);
    },
    over: (ctx, k) => {
      const w = k(FLOUR);
      for (const b of BAKE_KNEADS) {
        const u = span(t, b, b + 0.35);
        if (u > 0 && u < 1)
          for (let i = 0; i < 6; i++)
            box(
              ctx,
              STANDS.daniel + (i - 2.5) * 3 * (1 + u),
              112 - u * 5 - (i % 2) * 2,
              1,
              1,
              alpha(w, 1 - u),
            );
      }
      const fly = span(t, FLICK - 0.05, FLICK + 0.15);
      if (fly > 0 && fly < 1)
        for (let i = 0; i < 5; i++)
          box(ctx, lerp(166, 171, fly) + (i - 2) * fly * 2, lerp(78, 64, fly) + (i % 2), 1, 1, w);
      const cloud = span(t, FLICK + 0.15, FLICK + 0.9);
      if (cloud > 0 && cloud < 1) glow(ctx, 171, 64, 4 + cloud * 6, FLOUR, 0.8 * (1 - cloud));
    },
  };
}

function afterStage(t: number, seconds: number): Stage {
  const setting = t < 144.2;
  const crying = t >= 154;
  const hug = ease(span(t, HUG, HUG + 0.6));
  const wiping = within(t, 154.4, 155.6);
  const ruth: Body = {
    x: crying ? 131 : STANDS.ruth,
    y: STAND_Y,
    mode: 'stand',
    mitts: !crying,
    turn: crying ? 0.2 : 0.3,
    lean: crying ? 0.06 : 0,
    bob: crying ? laughBob(seconds, 0) : 0,
    hands: setting
      ? [
          [2, lerp(-17, -13, ease(span(t, 142.8, TIN_DOWN)))],
          [13, lerp(-17, -13, ease(span(t, 142.8, TIN_DOWN)))],
        ]
      : crying
        ? [
            [-2, -14],
            [10, -30],
          ]
        : [
            [0, -14],
            [10, -14],
          ],
    face: crying
      ? { eyes: 'laugh', brows: -0.6, mouth: 'laugh', tear: 1.8, blush: 1 }
      : { eyes: 'down', brows: -0.2, mouth: 'flat' },
  };
  const daniel: Body = {
    x: STANDS.daniel,
    y: STAND_Y,
    mode: 'stand',
    flour: 0.9,
    loose: 0.6,
    bob: crying && !wiping ? laughBob(seconds, 1) : 0,
    tilt: wiping ? 0.1 : 0,
    hands: wiping
      ? [
          [-2, -65],
          [5, -14],
        ]
      : hug > 0
        ? [
            [lerp(-5, -29, hug), lerp(-14, -55, hug)],
            [lerp(5, 29, hug), lerp(-14, -55, hug)],
          ]
        : [
            [-5, -14],
            [5, -14],
          ],
    face: crying
      ? {
          eyes: wiping ? 'closed' : 'laugh',
          brows: -0.5,
          mouth: wiping ? 'wobble' : 'laugh',
          flour: ease(span(t, 155.1, 155.4)) * 0.9 + 0.1,
          tear: 0.8,
        }
      : { eyes: 'down', brows: -0.5, mouth: 'flat', flour: 0.4 },
  };
  const nell: Body = {
    x: crying ? 169 : STANDS.nell,
    y: STAND_Y,
    mode: 'stand',
    turn: crying ? -0.3 : -0.2,
    lean: crying ? -0.06 : 0,
    bob: crying ? laughBob(seconds, 2) : 0,
    hands: crying
      ? [
          [-10, -30],
          [2, -14],
        ]
      : undefined,
    face: crying
      ? { eyes: 'laugh', brows: -0.4, mouth: 'laugh', flour: 0.8, blush: 1, tear: 0.6 }
      : { eyes: 'down', brows: -0.7, mouth: t < 145.2 ? 'o' : 'frown', flour: 0.8 },
  };
  return {
    cast: [
      { who: 'daniel', b: daniel, hug: hug > 0 },
      { who: 'ruth', b: ruth },
      { who: 'nell', b: nell },
    ],
    chairs: [],
    carver: 14,
    under: (ctx, k) => {
      bakeMess(ctx, k);
      board(ctx, k, STANDS.daniel + 6);
      const set = ease(span(t, 142.8, TIN_DOWN));
      if (setting) {
        ctx.save();
        ctx.translate(0, lerp(-4, 0, set));
        loafTin(ctx, k, 136, seconds, 1);
        ctx.restore();
      } else loafTin(ctx, k, 136, seconds, 1 - span(t, 150, 158));
    },
    over: (ctx, k) => {
      // His hands come to rest on their far shoulders.
      if (hug <= 0) return;
      for (const i of [0, 1] as const) {
        const h = handAt(daniel, i);
        box(ctx, h.x + (i ? -3.5 : 1.5), h.y - 1.5, 2, 3, k(CLOTH.daniel.inner));
        box(ctx, h.x - 1.5, h.y - 1.5, 3, 3, k(SKIN.daniel));
      }
    },
  };
}

function supperStage(t: number, seconds: number): Stage {
  const cx = lerp(14, 24, ease(span(t, 163.3, CHAIR_IN)));
  const pulling = within(t, 162.9, CHAIR_IN + 0.15);
  const carrying = within(t, CHAIR_IN + 0.15, CUP_DOWN + 0.25);
  const carry = ease(span(t, CHAIR_IN + 0.25, CUP_DOWN));
  const listened = t >= 165.4;
  const laughing = t >= 169.4;
  const ruth: Body = {
    x: CLOSE.ruth,
    y: SEAT_Y,
    mode: 'sit',
    lean: pulling
      ? -0.45 * hump(t, 162.9, CHAIR_IN + 0.15)
      : carrying
        ? -0.28 * hump(t, CHAIR_IN + 0.15, CUP_DOWN + 0.25)
        : 0,
    turn: listened ? 0.45 : -0.4,
    hands: pulling
      ? [[cx + 19 - CLOSE.ruth, -20], null]
      : carrying
        ? [[lerp(8, -18, carry), -9], null]
        : undefined,
    face: {
      eyes: blink('ruth', seconds),
      brows: -0.1,
      mouth: lips('ruth', t, seconds, t > 168 ? 'wry' : 'smile'),
      blush: laughing ? 0.6 : 0,
    },
  };
  const daniel: Body = {
    x: CLOSE.daniel,
    y: SEAT_Y,
    mode: 'sit',
    flour: 0.8,
    loose: 1,
    turn: -0.45,
    bob: laughing ? laughBob(seconds, 1) : 0,
    hands: [
      [-4, -8],
      [5, -9],
    ],
    face: {
      eyes: laughing ? 'laugh' : blink('daniel', seconds),
      brows: t < 168 && listened ? 0.1 : -0.1,
      raise: within(t, 166.8, 168.4) ? 1 : 0,
      mouth: lips('daniel', t, seconds, laughing ? 'laugh' : 'smile'),
      flour: 0.9,
    },
  };
  const nell: Body = {
    x: CLOSE.nell,
    y: SEAT_Y,
    mode: 'sit',
    turn: -0.5,
    bob: laughing ? laughBob(seconds, 2) : 0,
    face: {
      eyes: laughing ? 'laugh' : blink('nell', seconds),
      brows: 0,
      mouth: laughing ? 'laugh' : 'smile',
      flour: 0.6,
      blush: laughing ? 1 : 0.3,
    },
  };
  return {
    cast: [
      { who: 'ruth', b: ruth, seat: true },
      { who: 'daniel', b: daniel, seat: true },
      { who: 'nell', b: nell, seat: true },
    ],
    chairs: [CLOSE.ruth, CLOSE.daniel, CLOSE.nell],
    carver: cx,
    under: (ctx, k) => {
      flourSpill(ctx, k, 170, 260);
      poly(ctx, k('#E6DCC8'), [190, 107, 214, 107, 210, 118, 194, 118]);
      box(ctx, 190, 109, 24, 1, k('#5A7AAE'));
      poly(ctx, k('#E8E0CC'), [228, 118, 228, 103, 232, 100, 238, 100, 240, 103, 240, 118]);
      box(ctx, 230, 107, 8, 4, k('#C85A4A'));
      // The loaf, torn in four, on its board.
      box(ctx, 92, 116, 26, 3, k('#C49A68'));
      for (const [bx, w] of [
        [96, 5],
        [103, 5],
        [110, 5],
      ] as const) {
        box(ctx, bx - w / 2, 112, w, 4, k('#F2E6CC'));
        box(ctx, bx - w / 2, 111, w, 2, k('#4A2C1A'));
      }
      cup(ctx, k, 86, 117);
      cup(ctx, k, 113, 117);
      mug(ctx, k, 138, 117, '#40688A');
      teapot(ctx, k, 158, 117);
      steam(ctx, 85, 110, seconds);
      steam(ctx, 112, 110, seconds);
      if (t >= CUP_DOWN) {
        mumCup(ctx, k, 54, 117);
        steam(ctx, 54, 110, seconds);
        box(ctx, 60, 114, 4, 3, k('#F2E6CC'));
        box(ctx, 60, 113, 4, 1, k('#4A2C1A'));
      } else if (!carrying) mumCup(ctx, k, 79, 117);
    },
    over: (ctx, k) => {
      if (!carrying) return;
      const h = handAt(ruth, 0);
      mumCup(ctx, k, h.x + 1, h.y + 3);
    },
  };
}

function kitchen(ctx: Ctx, t: number, seconds: number, keys: Keys, st: Stage, free = false) {
  const k = look(t);
  const world = free ? null : undefined;
  camera(
    ctx,
    track(t, keys),
    () => {
      backWall(ctx, k, t, seconds);
      lino(ctx, k, FLOOR_Y);
      lamp(ctx, k, t);
      for (const c of st.cast) if (c.rear) body(ctx, k, c.who, c.b);
      for (const x of st.chairs)
        chairBack(ctx, k, x, !st.cast.some((c) => c.seat && Math.abs(c.b.x - x) < 1));
      for (const c of st.cast)
        if (!c.rear) {
          body(ctx, k, c.who, c.b);
          if (c.hug) armsOf(ctx, k, c.who, c.b);
        }
      for (const c of st.cast) if (c.seat) shins(ctx, k, c.who, c.b.x);
      carver(ctx, k, st.carver);
      tableTop(ctx, k);
      st.under?.(ctx, k);
      for (const c of st.cast) if (!c.hug) armsOf(ctx, k, c.who, c.b);
      st.over?.(ctx, k);
      lampLight(ctx, t);
    },
    world,
  );
  vignette(ctx, 0.5);
}

// ——— Close-ups ———
const BACKDROP: Record<Who, Pt> = { ruth: [104, 58], daniel: [184, 62], nell: [238, 64] };
function closeUp(ctx: Ctx, t: number, seconds: number, who: Who, o: Portrait, drift = 0) {
  const k = look(t);
  const [x, y] = BACKDROP[who];
  camera(
    ctx,
    { x: x + drift, y, zoom: 2.4 },
    () => {
      backWall(ctx, k, t, seconds);
      lamp(ctx, k, t);
    },
    null,
  );
  veil(ctx, k('#9CAC9A'), 0.42);
  lampLight(ctx, t);
  portrait(ctx, k, who, o, seconds);
  vignette(ctx, 0.55);
}
const zoomIn = (t: number, from: number, to: number, a: number, b: number) =>
  lerp(a, b, ease(span(t, from, to)));

function nellJoke(ctx: Ctx, t: number, seconds: number) {
  const after = t > 30.6;
  closeUp(
    ctx,
    t,
    seconds,
    'nell',
    {
      x: 198,
      y: 84,
      s: zoomIn(t, 26, 31.5, 2.35, 2.5),
      turn: after ? -0.2 : -0.45,
      face: {
        eyes: blink('nell', seconds),
        look: after ? (Math.sin(seconds * 1.4) > 0 ? -1 : -0.2) : -0.8,
        brows: after ? -0.2 : 0.2,
        raise: after ? 0 : 1.2,
        mouth: lips('nell', t, seconds, after ? 'wry' : 'smile'),
      },
    },
    (t - 26) * 0.8,
  );
}
function ruthStare(ctx: Ctx, t: number, seconds: number) {
  const away = t > 33.8;
  closeUp(ctx, t, seconds, 'ruth', {
    x: 134,
    y: 88,
    s: zoomIn(t, 31.5, 35, 2.15, 2.3),
    turn: away ? 0.05 : 0.25,
    face: { eyes: away ? 'down' : blink('ruth', seconds), look: 0.8, brows: 0.6, mouth: 'tight' },
  });
}
function ruthAnswer(ctx: Ctx, t: number, seconds: number) {
  closeUp(ctx, t, seconds, 'ruth', {
    x: 120,
    y: 82,
    s: 2.6,
    turn: 0.35,
    face: {
      eyes: blink('ruth', seconds),
      look: 0.8,
      brows: 0.75,
      mouth: lips('ruth', t, seconds, 'tight'),
    },
  });
}
function danielWork(ctx: Ctx, t: number, seconds: number) {
  const down = t > 46.2;
  closeUp(ctx, t, seconds, 'daniel', {
    x: 200,
    y: 82,
    s: 2.6,
    turn: -0.35,
    face: {
      eyes: down ? 'down' : blink('daniel', seconds),
      look: -0.6,
      brows: -0.25,
      mouth: lips('daniel', t, seconds, 'tight'),
    },
  });
}
function ruthMoney(ctx: Ctx, t: number, seconds: number) {
  closeUp(ctx, t, seconds, 'ruth', {
    x: 126,
    y: 90,
    s: zoomIn(t, 47.5, 52.5, 2.9, 3.45),
    turn: 0.35,
    face: {
      eyes: blink('ruth', seconds),
      look: 0.8,
      brows: t > 51.4 ? -0.3 : 0.9,
      mouth: lips('ruth', t, seconds, 'wobble'),
      tear: ease(span(t, 49, 52)),
    },
  });
}
function danielKnow(ctx: Ctx, t: number, seconds: number) {
  const up = within(t, 53.8, 57);
  closeUp(ctx, t, seconds, 'daniel', {
    x: 200,
    y: 84,
    s: zoomIn(t, 52.5, 57.5, 2.7, 2.9),
    turn: -0.35,
    tilt: t > FACE_DOWN ? 0.05 : 0,
    shake: t > FACE_DOWN && t < FACE_DOWN + 0.3 ? 0.6 : 0,
    face: {
      eyes: up ? blink('daniel', seconds) : 'down',
      look: -0.7,
      brows: -0.85,
      mouth: lips('daniel', t, seconds, 'flat'),
      tear: ease(span(t, 54, 57)) * 0.6,
    },
  });
}
function danielKnead(ctx: Ctx, t: number, seconds: number) {
  const up = t > 86.6;
  closeUp(ctx, t, seconds, 'daniel', {
    x: 196,
    y: 86,
    s: zoomIn(t, 84, 89, 2.6, 2.9),
    turn: up ? -0.3 : -0.1,
    tilt: up ? 0 : 0.08,
    face: {
      eyes: up ? blink('daniel', seconds) : 'down',
      look: -0.5,
      brows: -0.5,
      raise: up ? 0.6 : 0,
      mouth: lips('daniel', t, seconds, up ? 'wry' : 'flat'),
    },
  });
}
function nellPinch(ctx: Ctx, t: number, seconds: number) {
  closeUp(ctx, t, seconds, 'nell', {
    x: 196,
    y: 86,
    s: 2.5,
    turn: -0.4,
    tilt: 0.06,
    face: {
      eyes: t > 101.9 ? 'down' : blink('nell', seconds),
      look: -0.9,
      brows: -0.3,
      mouth: lips('nell', t, seconds, 'smile'),
    },
  });
}
function ruthBurnt(ctx: Ctx, t: number, seconds: number) {
  const broke = t >= BREAK;
  const smiling = t > 151.3;
  closeUp(
    ctx,
    t,
    seconds,
    'ruth',
    {
      x: 150,
      y: 84,
      s: zoomIn(t, 148, 154.4, 2.7, 3.15),
      turn: t > 150.4 ? 0.15 : 0,
      tilt: broke ? 0.06 : 0,
      light: 1,
      rim: '#FFB060',
      shake: broke ? Math.sin(seconds * 15) * 0.5 : 0,
      face: {
        eyes: broke ? 'laugh' : t > 150.4 ? blink('ruth', seconds) : 'down',
        look: 0.3,
        brows: broke ? -0.6 : -0.3,
        mouth: broke ? 'laugh' : lips('ruth', t, seconds, smiling ? 'wry' : 'flat'),
        tear: broke ? 1 + ease(span(t, BREAK + 0.2, 154.3)) : ease(span(t, 150, 152.4)),
        blush: broke ? 1 : 0,
      },
    },
    (t - 148) * 0.5,
  );
}

// ——— Inserts ———
function planksAcross(ctx: Ctx, k: Tone, x0: number, height: number) {
  for (let i = 0; i < Math.ceil(H / height); i++) {
    box(ctx, x0, i * height, W - x0 + 40, height, k(i % 2 ? '#A87A52' : '#A07350'));
    box(ctx, x0, i * height, W - x0 + 40, 1, k('#7C5434'));
    box(ctx, x0 + 20 + ((i * 53) % 140), i * height + height * 0.45, 60, 1, k('#94693F'));
  }
}
function topCup(ctx: Ctx, k: Tone, x: number, y: number, r: number, mugColor?: string) {
  if (!mugColor) disc(ctx, x, y, r * 1.45, k('#E6DED0'));
  disc(ctx, x, y, r, k(mugColor ?? '#EEE8DC'));
  disc(ctx, x, y, r * 0.78, k('#6E4428'));
  disc(ctx, x - r * 0.25, y - r * 0.25, r * 0.2, alpha(k('#F0D8B8'), 0.4));
  box(ctx, x + r * 0.9, y - r * 0.22, r * 0.5, r * 0.44, k(mugColor ?? '#EEE8DC'));
}

function phoneShot(ctx: Ctx, t: number, seconds: number) {
  const k = look(t);
  camera(
    ctx,
    track(t, [
      [35, 160, 92, 1],
      [39, 164, 94, 1.1],
    ]),
    () => {
      planksAcross(ctx, k, 0, 30);
      topCup(ctx, k, 92, 74, 18);
      line(ctx, k('#C8C8D0'), 2, [118, 96, 138, 112]);
      const buzzing = BUZZ.some((b) => within(t, b, b + 0.5));
      const jx = buzzing ? Math.sin(seconds * 95) * 1.4 : 0;
      const slide = ease(span(t, GRAB + 0.2, 39.2));
      const px = 196 + jx,
        py = 100 - slide * 90;
      const lit = t >= BUZZ[0];
      box(ctx, px - 20, py - 38, 40, 76, k('#15151C'));
      box(ctx, px - 18, py - 36, 36, 72, lit ? '#DCE6F2' : k('#23242C'));
      if (lit) {
        glow(ctx, px, py, 60, '#C8DAF2', 0.3);
        box(ctx, px - 15, py - 26, 30, 14, '#F4F8FC');
        disc(ctx, px - 10, py - 19, 3.5, '#6A8CB8');
        box(ctx, px - 4, py - 22, 16, 2, '#8A9AB0');
        box(ctx, px - 4, py - 17, 11, 2, '#AAB6C8');
        box(ctx, px - 15, py - 8, 30, 10, '#F4F8FC');
        box(ctx, px - 11, py - 5, 20, 2, '#AAB6C8');
      }
      if (t >= GRAB - 0.6) {
        const reach = ease(span(t, GRAB - 0.6, GRAB));
        bigHand(ctx, k, {
          x: px + 6,
          y: lerp(-40, py - 44, reach),
          a: Math.PI + 0.1,
          s: 3,
          who: 'daniel',
          curl: 0.35,
        });
      }
    },
  );
  vignette(ctx, 0.55);
}

function cardShot(ctx: Ctx, t: number, seconds: number) {
  const k = look(t);
  const ink = k('#2A3464');
  camera(
    ctx,
    track(t, [
      [70.5, 160, 94, 1],
      [72.2, 160, 94, 1],
      [78.8, 150, 92, 1.45],
    ]),
    () => {
      box(ctx, 0, 0, W, H, k('#4A3424'));
      for (let i = 0; i < 6; i++) box(ctx, 0, i * 32 + 8, W, 1, k('#3C2A1C'));
      ctx.save();
      ctx.translate(160, 92);
      ctx.rotate(-0.025 + Math.sin(seconds * 0.8) * 0.004);
      box(ctx, -114, -62, 232, 132, alpha('#000000', 0.25));
      box(ctx, -118, -66, 236, 132, k('#EFE3C4'));
      box(ctx, -118, -38, 236, 1, k('#C86A6A'));
      for (let y = -20; y < 66; y += 16) box(ctx, -118, y, 236, 1, k('#A8B8D0'));
      // A tea ring and a floury thumbprint: it was used, not kept.
      ctx.strokeStyle = alpha(k('#8A6040'), 0.25);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(74, 32, 15, 0, TAU);
      ctx.stroke();
      oval(ctx, -92, 48, 4, 5, alpha(k('#FFFFFF'), 0.45));
      const hand = { color: ink, type: 'italic' as const, align: 'left' as const };
      write(ctx, 'Sunday Loaf', -104, -44, { ...hand, size: 17 });
      ctx.font = font('italic', 17);
      const title = ctx.measureText('Sunday Loaf').width;
      write(ctx, 'for the kids', -104 + title + 8, -44, { ...hand, size: 11 });
      write(ctx, '4 cups flour, warm milk', -104, -24, { ...hand, size: 11 });
      write(ctx, 'honey, butter, salt, yeast', -104, -8, { ...hand, size: 11 });
      ctx.save();
      ctx.translate(-104, 8);
      ctx.rotate(0.025);
      write(ctx, 'knead until', 0, 0, { ...hand, size: 11 });
      ctx.font = font('italic', 11);
      const end = ctx.measureText('knead until').width + 3;
      line(ctx, ink, 1.1, [end, -2, end + 5, -3, end + 9, -1, end + 13, 0, end + 16, 2.5]);
      line(ctx, alpha(ink, 0.45), 0.8, [end + 16, 2.5, end + 21, 5.5, end + 24, 9]);
      ctx.restore();
      ctx.restore();
      // Nell's thumbs on the bottom corners.
      const skin = k(SKIN.nell);
      for (const side of [-1, 1]) {
        const bx = 160 + side * 100;
        poly(ctx, k(CLOTH.nell.main), [
          bx + side * 10,
          H,
          bx + side * 40,
          H,
          bx + side * 40,
          168,
          bx + side * 16,
          170,
        ]);
        line(ctx, skin, 10, [bx + side * 18, 184, bx + side * 8, 166]);
        line(ctx, skin, 5.5, [bx + side * 8, 166, bx - side * 2, 150]);
        oval(ctx, bx - side * 1.6, 151.6, 1.9, 1.4, k(mix(SKIN.nell, '#FFFFFF', 0.4)));
      }
    },
  );
  vignette(ctx, 0.5);
}

function overheadShot(ctx: Ctx, t: number) {
  const k = look(t);
  camera(
    ctx,
    track(t, [
      [78.8, 160, 90, 1.05],
      [84, 156, 92, 1.12],
    ]),
    () => {
      box(ctx, 0, 0, 44, H, k('#8E8472'));
      for (let i = 0; i < 6; i++) box(ctx, (i % 2) * 22, i * 30, 22, 30, k('#7E7462'));
      // The carver from above, the cardigan folded over its back rail.
      box(ctx, 6, 64, 30, 34, k('#7C5638'));
      box(ctx, 9, 67, 26, 28, k('#8C4E4A'));
      box(ctx, 4, 60, 4, 42, k('#63412B'));
      box(ctx, 6, 60, 28, 3, k('#63412B'));
      box(ctx, 6, 99, 28, 3, k('#63412B'));
      poly(ctx, k(MUSTARD), [0, 62, 12, 60, 14, 102, 0, 104]);
      for (let y = 64; y < 102; y += 5) box(ctx, 2, y, 10, 1, k(MUSTARD_DARK));
      box(ctx, 42, 0, 4, H, k('#7C5434'));
      planksAcross(ctx, k, 46, 26);
      topCup(ctx, k, 104, 40, 7);
      topCup(ctx, k, 186, 40, 7);
      topCup(ctx, k, 266, 40, 6, '#40688A');
      disc(ctx, 146, 26, 12, k(MUSTARD));
      disc(ctx, 146, 26, 3, k('#E8C070'));
      for (let i = 0; i < 8; i++)
        box(ctx, 146 + Math.cos(i * 0.8) * 8, 26 + Math.sin(i * 0.8) * 8, 1, 1, k(MUSTARD_DARK));
      box(ctx, 200, 50, 16, 28, k('#26262E'));
      disc(ctx, 204, 54, 1.5, k('#15151C'));
      // The card, slid into the middle of them.
      const s = ease(span(t, 78.9, SLIDE));
      const cx = lerp(252, 162, s),
        cy = lerp(108, 102, s);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(lerp(0.2, -0.05, s));
      box(ctx, -25, -16, 52, 34, alpha('#000000', 0.2));
      box(ctx, -26, -17, 52, 34, k('#EFE3C4'));
      box(ctx, -26, -9, 52, 1, k('#C86A6A'));
      for (let y = -3; y < 17; y += 5) box(ctx, -26, y, 52, 1, k('#B8C4D6'));
      write(ctx, 'Sunday Loaf', -22, -11, {
        size: 7,
        type: 'italic',
        color: k('#2A3464'),
        align: 'left',
      });
      for (let i = 0; i < 3; i++) box(ctx, -22, -5 + i * 5, 34 - i * 4, 1, k('#5A6490'));
      box(ctx, -22, 10, 12, 1, k('#5A6490'));
      ctx.restore();
      // Their hands, from their side of the table.
      const reach = ease(span(t, 82.2, 83.2));
      bigHand(ctx, k, {
        x: lerp(100, 128, reach),
        y: lerp(30, 62, reach),
        a: Math.PI - reach * 0.5,
        s: 2.1,
        who: 'ruth',
        curl: 0.2,
      });
      bigHand(ctx, k, { x: 180, y: 34, a: Math.PI + 0.5, s: 2.1, who: 'daniel', curl: 0.4 });
      bigHand(ctx, k, {
        x: 192,
        y: 32,
        a: Math.PI - 0.5,
        s: 2.1,
        who: 'daniel',
        left: true,
        curl: 0.4,
      });
      const nx = s < 1 ? cx + 18 : lerp(cx + 18, 262, ease(span(t, SLIDE + 0.2, SLIDE + 1)));
      const ny = s < 1 ? cy - 16 : lerp(cy - 16, 40, ease(span(t, SLIDE + 0.2, SLIDE + 1)));
      bigHand(ctx, k, { x: nx + 6, y: ny - 22, a: Math.PI - 0.3, s: 2.1, who: 'nell', curl: 0.1 });
    },
  );
  vignette(ctx, 0.55);
}

function memoryShot(ctx: Ctx, t: number, seconds: number) {
  const k = grade(0.7, 0.1, 0.72);
  const p = press(t, MEMORY_KNEADS);
  camera(
    ctx,
    track(t, [
      [89, 160, 96, 1.1],
      [95, 160, 92, 1.2],
    ]),
    () => {
      box(ctx, 0, 0, W, H, k('#5A3C26'));
      for (let i = 0; i < 7; i++) box(ctx, 0, i * 28, W, 1, k('#4A301E'));
      box(ctx, 44, 22, 232, 150, k('#A07850'));
      box(ctx, 44, 22, 232, 2, k('#B88C60'));
      for (let i = 0; i < 50; i++)
        box(ctx, 52 + rand(i * 1.7) * 216, 28 + rand(i * 4.3) * 136, 2, 1, k('#E4D4B4'));
      oval(ctx, 162, 102 + p * 6, 40 + p * 8, 25 - p * 4, k('#7A5A3A'));
      oval(ctx, 160, 98 + p * 6, 38 + p * 8, 24 - p * 4, k('#D8C094'));
      oval(ctx, 156, 94 + p * 6, 32 + p * 7, 18 - p * 4, k('#F2E2BC'));
      line(ctx, k('#C8AC80'), 1.2, [138, 98 + p * 6, 160, 93 + p * 6, 180, 99 + p * 6]);
      // His small hands in the dough; hers round them, showing him how.
      const shadow = alpha(k('#3A2414'), 0.45);
      for (const side of [-1, 1]) {
        const kid = {
          x: 160 + side * 14,
          y: 150 + p * 8,
          a: side * 0.18,
          s: 1.8,
          left: side < 0,
          curl: 0.3,
        };
        const mum = {
          x: 160 + side * 33,
          y: 173 + p * 7,
          a: -side * 0.34,
          s: 2.6,
          left: side < 0,
          curl: 0.25,
        };
        bigHand(ctx, k, { ...kid, who: 'kid', x: kid.x + 1.5, y: kid.y + 2, ink: shadow });
        bigHand(ctx, k, { ...kid, who: 'kid', flour: 0.5 });
        bigHand(ctx, k, { ...mum, who: 'mum', x: mum.x + 2, y: mum.y + 2.5, ink: shadow });
        bigHand(ctx, k, { ...mum, who: 'mum', flour: 0.3 });
      }
    },
  );
  glow(ctx, 70, 10, 180, '#FFE0A0', 0.22);
  const grain = Math.floor(seconds * 12);
  for (let i = 0; i < 40; i++)
    box(
      ctx,
      rand(i * 3.1 + grain) * W,
      rand(i * 7.7 + grain * 1.3) * H,
      1,
      1,
      alpha('#FFF4DC', 0.2),
    );
  vignette(ctx, 0.85, '#1A1008');
  veil(ctx, '#F0DEB8', 1 - ease(span(t, 89, 89.6)));
  veil(ctx, '#F0DEB8', ease(span(t, 94.4, 95)));
}

const SUGAR: Pt = [74, 118];
const OVER_BOWL: Pt = [168, 100];
function pinchShot(ctx: Ctx, t: number, seconds: number) {
  const k = look(t);
  camera(
    ctx,
    track(t, [
      [102.5, 160, 96, 1],
      [105.8, 162, 100, 1.1],
    ]),
    () => {
      box(ctx, 0, 0, W, 116, k('#8E9C8C'));
      box(ctx, 16, 6, 92, 74, k('#E4DECE'));
      pane(ctx, k, t, seconds, 20, 10, 84, 66, rainAt(t) * 0.7);
      veil(ctx, k('#8E9C8C'), 0.35);
      box(ctx, 0, 116, W, 64, k('#A77A52'));
      box(ctx, 0, 116, W, 1, k('#8E6440'));
      flourSpill(ctx, k, 40, 280);
      // The sugar bowl.
      poly(ctx, k('#EEE8DC'), [56, 112, 92, 112, 88, 132, 60, 132]);
      oval(ctx, 74, 112, 18, 4, k('#F8F6F0'));
      for (let i = 0; i < 10; i++)
        box(ctx, 62 + rand(i * 3.3) * 24, 110 + rand(i * 1.9) * 4, 1, 1, k('#D8D4CC'));
      // The mixing bowl, flour heaped in it.
      poly(ctx, k('#E6DCC8'), [110, 118, 226, 118, 214, 172, 122, 172]);
      box(ctx, 114, 126, 108, 3, k('#5A7AAE'));
      oval(ctx, 168, 118, 58, 9, k('#CFC4AC'));
      oval(ctx, 168, 116, 44, 10, k(FLOUR));
      oval(ctx, 162, 113, 26, 6, k('#FBF8F0'));
    },
  );
  // Nell's pinches: to the sugar, over the bowl, fingers rubbing it in.
  let tip: Pt = OVER_BOWL;
  let pinch = 0.2;
  for (const pt of PINCHES) {
    if (t >= pt - 1 && t < pt + 0.3) {
      const [x, y, q] = keyed(t, [
        [pt - 1, OVER_BOWL[0], OVER_BOWL[1], 0.2],
        [pt - 0.66, SUGAR[0], SUGAR[1], 0.3],
        [pt - 0.56, SUGAR[0], SUGAR[1] - 2, 1],
        [pt - 0.42, SUGAR[0] + 4, SUGAR[1] - 14, 1],
        [pt - 0.1, OVER_BOWL[0], OVER_BOWL[1], 1],
        [pt + 0.25, OVER_BOWL[0], OVER_BOWL[1], 0.35],
      ]);
      tip = [x, y];
      pinch = q + (t > pt ? Math.sin(seconds * 40) * 0.12 : 0);
    }
  }
  const v = track(t, [
    [102.5, 160, 96, 1],
    [105.8, 162, 100, 1.1],
  ]);
  camera(ctx, v, () => {
    for (const pt of PINCHES) {
      const u = span(t, pt - 0.05, pt + 0.55);
      if (u <= 0 || u >= 1) continue;
      for (let i = 0; i < 9; i++) {
        const d = (u * 1.4 - rand(i * 2.1) * 0.4) * 1.0;
        if (d < 0 || d > 1) continue;
        box(
          ctx,
          OVER_BOWL[0] - 6 + rand(i * 5.3 + pt) * 10,
          OVER_BOWL[1] + 2 + easeIn(d) * 14,
          1,
          1,
          alpha(k('#FFFFFF'), 1 - d * 0.6),
        );
      }
    }
    bigHand(ctx, k, {
      x: tip[0] + 12,
      y: tip[1] - 28,
      a: Math.PI - 0.35,
      s: 2.3,
      who: 'nell',
      pinch: clamp(pinch),
      curl: 0.25,
    });
  });
  vignette(ctx, 0.5);
}

/** 0 → 1 → 0 with a hold between: in over [a0, a1], out over [b0, b1]. */
const held = (t: number, a0: number, a1: number, b0: number, b1: number) =>
  ease(span(t, a0, a1)) * (1 - ease(span(t, b0, b1)));
function bowlShot(ctx: Ctx, t: number) {
  const k = look(t);
  camera(
    ctx,
    track(t, [
      [105.8, 160, 90, 1.05],
      [111, 160, 92, 1.16],
    ]),
    () => {
      planksAcross(ctx, k, 0, 30);
      for (let i = 0; i < 40; i++) box(ctx, rand(i * 2.7) * W, rand(i * 6.1) * H, 2, 1, k(FLOUR));
      disc(ctx, 163, 96, 60, k('#6A4A30'));
      disc(ctx, 160, 92, 60, k('#EDE4D0'));
      ctx.strokeStyle = k('#5A7AAE');
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(160, 92, 56.5, 0, TAU);
      ctx.stroke();
      disc(ctx, 160, 92, 52, k('#9A8A6C'));
      disc(ctx, 158, 90, 42, k('#E6DCC6'));
      disc(ctx, 153, 85, 33, k('#FFFFFF'));
      disc(ctx, 160, 92, 12, k('#BCAE92'));
      const milk = ease(span(t, MILK + 0.1, MILK + 1.8));
      if (milk > 0) {
        disc(ctx, 160, 92, 3 + 10 * milk, k('#FFFFFA'));
        disc(ctx, 157, 89, 2 + 3 * milk, k('#FFFFFF'));
      }
      const honey = ease(span(t, HONEY + 0.2, HONEY + 1.4));
      if (honey > 0) {
        ctx.strokeStyle = k('#D89A30');
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(160, 92, 6, 0, TAU * honey);
        ctx.stroke();
        disc(ctx, 160, 92, 2.5 * honey, k('#E0A838'));
      }
      const stir = span(t, STIR, 111);
      if (stir > 0)
        for (let i = 0; i < 7; i++) {
          const a = i * 0.9 + stir * 9;
          oval(
            ctx,
            160 + Math.cos(a) * 10 * stir,
            92 + Math.sin(a) * 8 * stir,
            4.5,
            3,
            k('#E8D6B0'),
          );
        }
      // Ruth pours the milk.
      const jug = held(t, MILK - 0.6, MILK - 0.05, MILK + 1.8, MILK + 2.3);
      if (jug > 0) {
        const jx = lerp(30, 104, jug),
          jy = lerp(-30, 40, jug);
        if (within(t, MILK, MILK + 1.8)) line(ctx, k('#FFFFFA'), 3, [jx + 18, jy + 16, 160, 92]);
        disc(ctx, jx, jy, 15, k('#E8E4DA'));
        disc(ctx, jx, jy, 11, k('#FAF8F2'));
        poly(ctx, k('#E8E4DA'), [jx + 10, jy + 6, jx + 22, jy + 18, jx + 6, jy + 12]);
        ctx.strokeStyle = k('#D8D2C6');
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(jx - 16, jy - 8, 6, 0, TAU);
        ctx.stroke();
        bigHand(ctx, k, {
          x: jx - 34,
          y: jy - 34,
          a: Math.PI - 0.8,
          s: 2.2,
          who: 'ruth',
          curl: 0.65,
        });
      }
      // Nell's honey spoon.
      const spoon = held(t, HONEY - 0.5, HONEY, HONEY + 1.4, HONEY + 1.9);
      if (spoon > 0) {
        const sx = lerp(300, 196, spoon),
          sy = lerp(-20, 60, spoon);
        if (within(t, HONEY, HONEY + 1.4)) line(ctx, k('#E0A838'), 1.2, [sx - 8, sy + 10, 160, 92]);
        line(ctx, k('#B89060'), 2.5, [sx + 26, sy - 30, sx - 4, sy + 6]);
        oval(ctx, sx - 7, sy + 9, 5, 3.5, k('#D89A30'));
        bigHand(ctx, k, {
          x: sx + 36,
          y: sy - 46,
          a: Math.PI + 0.7,
          s: 2.1,
          who: 'nell',
          curl: 0.6,
        });
      }
      // Daniel's wooden spoon.
      if (stir > 0) {
        const a = stir * 9;
        const ex = 160 + Math.cos(a) * 12,
          ey = 92 + Math.sin(a) * 9;
        line(ctx, k('#B8905E'), 3.5, [ex, ey, ex + 36, ey - 70]);
        oval(ctx, ex, ey, 5, 3.5, k('#C8A070'));
        bigHand(ctx, k, {
          x: ex + 42,
          y: ey - 92,
          a: Math.PI - 0.45,
          s: 2.2,
          who: 'daniel',
          curl: 0.7,
          flour: 0.3,
        });
      }
    },
  );
  vignette(ctx, 0.5);
}

function kneadShot(ctx: Ctx, t: number, seconds: number) {
  const k = look(t);
  const p = press(t, KNEADS);
  const flour = lerp(0.2, 0.75, span(t, 111, 119));
  camera(
    ctx,
    track(t, [
      [111, 160, 92, 1],
      [119, 158, 96, 1.08],
    ]),
    () => {
      box(ctx, 0, 0, W, 70, k('#8E9C8C'));
      // Daniel leaning over it, out of focus: suit, shirt, a tie that dangles into the flour.
      poly(ctx, k(CLOTH.daniel.main), [80, 70, 240, 70, 230, 0, 90, 0]);
      poly(ctx, k(CLOTH.daniel.inner), [130, 0, 190, 0, 160, 40]);
      const sway = Math.sin(t * 7.85) * 3 * (p > 0.1 ? 1 : 0.3);
      poly(ctx, k(TIE), [154, 0, 166, 0, 166 + sway, 56, 160 + sway, 64, 154 + sway, 56]);
      faded(ctx, flour, () =>
        poly(ctx, k(FLOUR), [155 + sway, 50, 165 + sway, 50, 160 + sway, 60]),
      );
      faded(ctx, flour * 0.8, () => {
        oval(ctx, 110, 40, 12, 9, k(FLOUR));
        oval(ctx, 206, 30, 9, 12, k(FLOUR));
      });
      box(ctx, 0, 70, W, 110, k('#A77A52'));
      poly(ctx, k('#C8A070'), [40, 84, 280, 84, 300, 176, 20, 176]);
      for (let i = 0; i < 30; i++)
        box(ctx, 50 + rand(i * 1.3) * 220, 88 + rand(i * 2.9) * 80, 2, 1, k('#F2EADA'));
      oval(ctx, 160, 128 + p * 6, 38 + p * 10, 20 - p * 5, k('#E2CEA4'));
      oval(ctx, 157, 124 + p * 6, 34 + p * 9, 16 - p * 4, k('#EEDDBA'));
      line(ctx, k('#D2BC90'), 1.2, [136, 124 + p * 6, 160, 118 + p * 6, 182, 124 + p * 6]);
      // Flour puffs on every stroke.
      for (const b of KNEADS) {
        const u = span(t, b, b + 0.4);
        if (u <= 0 || u >= 1) continue;
        for (let i = 0; i < 8; i++)
          box(
            ctx,
            160 + (i - 3.5) * 10 * (1 + u),
            132 - u * 14 - (i % 3) * 3,
            2,
            2,
            alpha(k(FLOUR), 1 - u),
          );
      }
      // The phone on the corner of the board: it buzzes, and he turns it over with a floury hand.
      const buzzing = within(t, BUZZ2, BUZZ2 + 0.5);
      const flip = span(t, FLIP - 0.25, FLIP + 0.1);
      const w = Math.abs(Math.cos(flip * Math.PI)) * 14;
      const px = 262 + (buzzing ? Math.sin(seconds * 95) : 0),
        py = 128;
      const face = flip < 0.5;
      box(ctx, px - w, py - 24, w * 2, 48, k(face ? '#15151C' : '#3A3C44'));
      if (face && t >= BUZZ2 && w > 2) {
        box(ctx, px - w + 2, py - 22, w * 2 - 4, 44, '#DCE6F2');
        glow(ctx, px, py, 40, '#C8DAF2', 0.3);
      }
      if (!face && w > 4) {
        disc(ctx, px - w + 5, py - 18, 2, k('#1A1A20'));
        faded(ctx, 0.85, () => {
          oval(ctx, px, py + 4, w * 0.45, 8, k(FLOUR));
          for (let i = 0; i < 4; i++)
            line(ctx, k(FLOUR), 2, [px - 5 + i * 3.3, py - 4, px - 6 + i * 4, py - 14]);
        });
      }
      const aside = hump(t, 115.1, 116.3);
      const lp = [148 - p * 2, 104 + p * 16] as const;
      const rp = [lerp(172 + p * 2, 250, aside), lerp(104 + p * 16, 112, aside)] as const;
      bigHand(ctx, k, {
        x: lp[0],
        y: lp[1] - 24,
        a: Math.PI + 0.25,
        s: 2.6,
        who: 'daniel',
        left: true,
        curl: 0.3,
        flour,
      });
      bigHand(ctx, k, {
        x: rp[0],
        y: rp[1] - 24,
        a: Math.PI - 0.25,
        s: 2.6,
        who: 'daniel',
        curl: 0.3 - aside * 0.2,
        flour,
      });
    },
  );
  vignette(ctx, 0.5);
}

function ovenInShot(ctx: Ctx, t: number, seconds: number) {
  const k = look(t);
  const shut = ease(span(t, 129.6, OVEN_SHUT));
  const rise = ease(span(t, OVEN_SHUT, 132));
  camera(
    ctx,
    track(t, [
      [128, 160, 92, 1],
      [130.3, 160, 94, 1.04],
      [132, 160, 86, 1.3],
    ]),
    () => {
      box(ctx, 0, 0, W, H, k('#E2D6B8'));
      box(ctx, 0, 0, W, 8, k('#2A2A2E'));
      box(ctx, 56, 26, 208, 116, k('#C8BC9E'));
      // Inside: the glow, the racks, the elements.
      box(ctx, 60, 30, 200, 108, '#3A1C12');
      glow(ctx, 160, 90, 130, '#FF8A30', 0.55);
      box(ctx, 70, 128, 180, 3, '#FFB060');
      box(ctx, 70, 36, 180, 2, '#FF9A48');
      box(ctx, 64, 72, 192, 2, '#8A6A58');
      box(ctx, 64, 104, 192, 2, '#8A6A58');
      // The tin goes in on Ruth's gloves.
      const into = ease(span(t, 128.1, 129.3));
      const sc = lerp(1.6, 0.9, into),
        ty = lerp(176, 100, into);
      if (shut < 0.6) {
        ctx.save();
        ctx.translate(160, ty);
        ctx.scale(sc, sc);
        box(ctx, -30, -10, 60, 16, '#4A4A52');
        oval(ctx, 0, -10, 28, 10, '#EAD6A8');
        oval(ctx, -4, -13, 18, 5, '#F4E6C4');
        ctx.restore();
      }
      const gloves = 1 - ease(span(t, 129.3, 129.6));
      if (gloves > 0)
        for (const side of [-1, 1])
          bigHand(ctx, k, {
            x: 160 + side * 36 * sc,
            y: ty + 30 * sc + (1 - gloves) * 60,
            a: -side * 0.5,
            s: 2.6 * sc,
            who: 'mitt',
            left: side < 0,
          });
      if (shut <= 0) return;
      // The door swings up and shuts; through its glass, the loaf on the rack.
      const top = lerp(140, 26, shut);
      box(ctx, 52, top, 216, 144 - top, k('#D6CAAC'));
      box(ctx, 52, top, 216, 3, k('#F0E8D2'));
      const wy = lerp(140, 46, shut),
        wh = lerp(0, 72, shut);
      box(ctx, 84, wy - 4, 152, wh + 8, k('#2A2A2E'));
      box(ctx, 88, wy, 144, wh, '#4A2010');
      if (wh > 8) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(88, wy, 144, wh);
        ctx.clip();
        glow(ctx, 160, wy + wh * 0.55, 90, '#FF9A48', 0.6);
        box(ctx, 92, wy + 4, 136, 2, '#FFB060');
        box(ctx, 90, wy + wh * 0.72, 140, 2, '#9A7058');
        const bx = 160,
          by = wy + wh * 0.72;
        box(ctx, bx - 30, by - 12, 60, 12, '#3E3E46');
        oval(ctx, bx, by - 12, 27, 7 + rise * 3, '#E4C890');
        oval(ctx, bx - 5, by - 14 - rise, 16, 3, '#F2DCA8');
        // Heat shimmer over the loaf.
        for (let i = 0; i < 4; i++) {
          const u = (seconds * 0.6 + i * 0.25) % 1;
          box(
            ctx,
            bx - 24 + i * 16 + Math.sin(u * 9 + i) * 2,
            by - 26 - u * 20,
            1,
            4,
            alpha('#FFD8A0', 0.5 * (1 - u)),
          );
        }
        poly(ctx, alpha('#FFFFFF', 0.1), [150, wy, 186, wy, 130, wy + wh, 94, wy + wh]);
        ctx.restore();
      }
      box(ctx, 60, top + 8, 200, 5, k('#C8C2B4'));
      box(ctx, 60, top + 8, 200, 1, k('#F4F0E6'));
      box(ctx, 62, top + 6, 4, 9, k('#A8A294'));
      box(ctx, 254, top + 6, 4, 9, k('#A8A294'));
      if (t < OVEN_SHUT + 0.3)
        bigHand(ctx, k, { x: 200, y: top + 38, a: 0.1, s: 2.6, who: 'mitt' });
    },
  );
  glow(ctx, 160, 110, 200, '#FFB060', 0.15);
  vignette(ctx, 0.5);
}

function floorShot(ctx: Ctx, t: number, seconds: number) {
  const k = look(t);
  const heat = ovenHeat(t);
  camera(
    ctx,
    track(t, [
      [132, 160, 96, 1.02],
      [139.6, 172, 106, 1.24],
    ]),
    () => {
      box(ctx, 0, 0, W, 64, k(WALL));
      for (let x = 4; x < W; x += 10) box(ctx, x, 0, 1, 60, k('#98A896'));
      box(ctx, 100, 4, 84, 56, k('#E4DECE'));
      pane(ctx, k, t, seconds, 104, 8, 76, 48, rainAt(t));
      box(ctx, 141, 8, 2, 48, k('#E4DECE'));
      poly(ctx, k('#B9705E'), [94, 2, 108, 2, 106, 60, 94, 60]);
      poly(ctx, k('#B9705E'), [190, 2, 176, 2, 178, 60, 190, 60]);
      box(ctx, 0, 60, 262, 7, k('#C9B894'));
      box(ctx, 0, 67, 262, 88, k('#8C9C88'));
      for (let i = 0; i < 7; i++) {
        box(ctx, 4 + i * 38, 72, 34, 76, k('#96A692'));
        box(ctx, 34 + i * 38, 104, 2, 8, k('#C8A060'));
      }
      lino(ctx, k, 155);
      // The oven, glowing.
      box(ctx, 262, 50, 70, 108, k('#E0D4B6'));
      box(ctx, 260, 50, 72, 5, k('#2A2A2E'));
      box(ctx, 270, 90, 50, 44, k('#D6CAAC'));
      box(ctx, 276, 98, 38, 26, mix('#3A2A20', '#FF9A48', heat));
      box(ctx, 282, 114, 26, 6, '#3A2418');
      glow(ctx, 295, 110, 70, '#FF9A40', 0.45 * heat);
      const nellLean = ease(span(t, LEAN, LEAN + 0.9));
      const phoneUp = within(t, 136.8, 138.5);
      const size = 1.55;
      const ruth: Body = {
        x: 112,
        y: 162,
        mode: 'floor',
        size,
        turn: 0.55,
        face: { eyes: blink('ruth', seconds), brows: -0.2, mouth: 'flat' },
      };
      const nell: Body = {
        x: 146 - nellLean * 5,
        y: 162,
        mode: 'floor',
        size,
        turn: 0.3,
        lean: -0.2 * nellLean,
        tilt: -0.25 * nellLean,
        face: { eyes: nellLean > 0.5 ? 'closed' : 'down', brows: -0.3, mouth: 'smile' },
      };
      const phoneDown = ease(span(t, 138.3, 138.8));
      const daniel: Body = {
        x: 182,
        y: 162,
        mode: 'floor',
        size,
        turn: phoneUp ? 0 : 0.5,
        tilt: phoneUp ? 0.14 : 0,
        loose: 0.6,
        flour: 0.8,
        hands:
          t >= 136.6 && t < 139
            ? [
                [lerp(-3, -14, phoneDown), lerp(-21, -3, phoneDown)],
                [4, -17],
              ]
            : undefined,
        face: {
          eyes: phoneUp ? 'down' : blink('daniel', seconds),
          brows: -0.2,
          mouth: t > PHONE_OFF ? 'smile' : 'flat',
          flour: 0.4,
        },
      };
      const cast = [
        ['ruth', ruth],
        ['nell', nell],
        ['daniel', daniel],
      ] as const;
      for (const [who, b] of cast) body(ctx, k, who, b);
      for (const [who, b] of cast) armsOf(ctx, k, who, b);
      if (t >= 136.6 && t < 139.6) {
        const h = handAt(daniel, 0);
        box(ctx, h.x - 3, h.y - 5, 6, 9, k('#15151C'));
        if (t < PHONE_OFF) {
          box(ctx, h.x - 2, h.y - 4, 4, 7, '#DCE6F2');
          glow(ctx, h.x, h.y - 10, 22, '#BFD8FF', 0.35);
        }
      }
      glow(ctx, 290, 120, 210, '#FF9A48', 0.36 * heat);
      glow(ctx, 272, 166, 90, '#FFB060', 0.3 * heat);
    },
  );
  vignette(ctx, 0.55);
}

function clockShot(ctx: Ctx, t: number) {
  const k = look(t);
  camera(
    ctx,
    track(t, [
      [139.6, 160, 90, 1],
      [142.6, 160, 90, 1.08],
    ]),
    () => {
      box(ctx, 0, 0, W, H, k(WALL));
      for (let x = 4; x < W; x += 20) box(ctx, x, 0, 2, H, k('#98A896'));
      box(ctx, 90, 156, 140, 30, k('#E4DECE'));
      box(ctx, 100, 164, 120, 20, k('#2A2C34'));
      wallClock(ctx, k, 160, 78, 58, t);
    },
  );
  glow(ctx, 160, 78, 120, '#FFC468', 0.12);
  vignette(ctx, 0.6);
}

/** Top of the loaf's burnt dome at u (the loaf is 100 wide), above its rim. */
const dome = (u: number) => 20 * Math.sqrt(Math.max(0, 1 - ((u - 50) / 52) ** 2));
/**
 * The stretch [u0, u1] of a tin loaf, its left end at x. Ends that were torn show the soft
 * white inside; the others show crust.
 */
function loafPiece(ctx: Ctx, k: Tone, x: number, u0: number, u1: number, dy: number) {
  const rim = 110 + dy,
    base = 134 + dy,
    w = u1 - u0;
  box(ctx, x, rim, w, base - rim, k('#A0602E'));
  box(ctx, x, base - 4, w, 4, k('#7A4420'));
  const pts: number[] = [x, rim + 2];
  for (let i = 0; i <= 8; i++) {
    const u = u0 + (w * i) / 8;
    pts.push(x + u - u0, rim - 2 - dome(u));
  }
  pts.push(x + w, rim + 2);
  poly(ctx, k('#2E1A10'), pts);
  box(ctx, x, rim, w, 2, k('#C8844A'));
  const crack: number[] = [];
  for (let i = 0; i <= 4; i++) {
    const u = lerp(Math.max(u0, 22), Math.min(u1, 78), i / 4);
    if (u > u0 && u < u1) crack.push(x + u - u0, rim + 3 - dome(u));
  }
  if (crack.length >= 4) line(ctx, k('#6E3E20'), 1.4, crack);
  const crumb = k('#F2E4C4'),
    hole = k('#D6C096');
  for (const [u, ex, dir] of [
    [u0, x, 1],
    [u1, x + w, -1],
  ] as const) {
    if (u <= 0 || u >= 100) continue;
    const top = rim - dome(u);
    poly(ctx, crumb, [
      ex,
      top,
      ex + dir * 6,
      top + 4,
      ex + dir * 4,
      top + 11,
      ex + dir * 7,
      top + 19,
      ex + dir * 4,
      base - 10,
      ex + dir * 6,
      base - 4,
      ex,
      base - 2,
    ]);
    for (let n = 0; n < 5; n++)
      box(ctx, ex + dir * (2 + (n % 2) * 2.5) - (dir < 0 ? 1 : 0), top + 5 + n * 7, 1, 2, hole);
  }
}
function breadShot(ctx: Ctx, t: number, seconds: number) {
  const k = look(t);
  camera(
    ctx,
    track(t, [
      [158.8, 160, 102, 1.25],
      [162.6, 160, 104, 1.35],
    ]),
    () => {
      box(ctx, 0, 0, W, 84, k(WALL));
      for (let x = 4; x < W; x += 10) box(ctx, x, 0, 1, 84, k('#98A896'));
      faded(ctx, 0.55, () => {
        oval(ctx, 60, 74, 20, 14, k(MUSTARD));
        box(ctx, 250, 62, 16, 16, k('#EEE8DC'));
      });
      box(ctx, 0, 84, W, 96, k('#A77A52'));
      box(ctx, 0, 84, W, 1, k('#8E6440'));
      poly(ctx, k('#C49A68'), [50, 132, 270, 132, 264, 150, 56, 150]);
      box(ctx, 56, 148, 208, 2, k('#9A7048'));
      const sep = 14 * ease(span(t, TEARS[0] - 0.15, TEARS[0] + 0.45));
      const lift = ease(span(t, TEARS[1] - 0.05, TEARS[1] + 0.7));
      const left = 110 - sep,
        right = 160 + sep;
      if (sep < 0.3) loafPiece(ctx, k, 110, 0, 100, 0);
      else {
        loafPiece(ctx, k, left, 0, 50, 0);
        if (t < TEARS[1] - 0.05) loafPiece(ctx, k, right, 50, 100, 0);
        else {
          loafPiece(ctx, k, right, 50, 75, 0);
          loafPiece(ctx, k, right + 25 + lift * 16, 75, 100, -lift * 34);
        }
      }
      // Steam out of the torn middles.
      const faces =
        sep < 0.3
          ? []
          : [left + 50, right, ...(lift > 0 ? [right + 25, right + 25 + lift * 16] : [])];
      for (const x of faces)
        for (let i = 0; i < 3; i++) {
          const u = (seconds * 0.45 + i * 0.33 + x * 0.013) % 1;
          box(
            ctx,
            x + Math.sin(u * 6 + i) * 3,
            88 - u * 40,
            1,
            3,
            alpha('#FFF4E4', 0.6 * (1 - u) * clamp(sep / 4)),
          );
        }
      for (const tear of TEARS) {
        const u = span(t, tear, tear + 0.5);
        if (u > 0 && u < 1)
          for (let i = 0; i < 6; i++)
            box(
              ctx,
              (tear === TEARS[1] ? right + 25 : 160) + (i - 2.5) * 6 * u,
              90 - Math.sin(u * Math.PI) * 12 + i,
              2,
              2,
              k('#5A3620'),
            );
      }
      // Daniel's hands on the two ends pull it apart; then Nell reaches in for a piece.
      const letGo = ease(span(t, 160.7, 161.1));
      bigHand(ctx, k, {
        x: left - 6,
        y: 126,
        a: 1.1,
        s: 1.9,
        who: 'daniel',
        curl: 0.55,
        flour: 0.5,
      });
      bigHand(ctx, k, {
        x: right + 56 + letGo * 40,
        y: 126 + letGo * 30,
        a: -1.1,
        s: 1.9,
        who: 'daniel',
        left: true,
        curl: 0.55,
        flour: 0.5,
      });
      const reach = ease(span(t, 160.8, 161.3));
      if (reach > 0)
        bigHand(ctx, k, {
          x: lerp(330, right + 50, reach) + lift * 16,
          y: lerp(-20, 64, reach) - lift * 34,
          a: Math.PI - 0.35,
          s: 1.8,
          who: 'nell',
          curl: 0.6,
        });
    },
  );
  glow(ctx, 160, 60, 220, '#FFC468', 0.18);
  vignette(ctx, 0.5);
}

// ——— The house from the street ———
function houseWindow(
  ctx: Ctx,
  k: Tone,
  x: number,
  y: number,
  w: number,
  h: number,
  light: string | null,
  amount: number,
) {
  box(ctx, x - 2, y - 2, w + 4, h + 4, k('#D8D2C4'));
  box(ctx, x, y, w, h, k('#1C2230'));
  box(ctx, x + 2, y + 2, w * 0.3, 1, alpha(k('#8A9AB8'), 0.5));
  if (light && amount > 0) {
    faded(ctx, amount, () => {
      box(ctx, x, y, w, h, light);
      glow(ctx, x + w / 2, y + h / 2, w * 1.6, light, 0.35);
    });
  }
  box(ctx, x + w / 2 - 1, y, 2, h, k('#D8D2C4'));
  box(ctx, x, y + h / 2 - 1, w, 2, k('#D8D2C4'));
  box(ctx, x - 3, y + h + 2, w + 6, 2, k('#B8B2A4'));
}
function street(ctx: Ctx, k: Tone, t: number, seconds: number, night: boolean) {
  const dusk = ['#2E3850', '#434F68', '#5A6680', '#737E96'];
  const late = ['#0A1022', '#10182E', '#18223C', '#212E4C'];
  sky(
    ctx,
    (night ? late : dusk).map((c) => k(c)),
    0,
    100,
  );
  if (night)
    faded(ctx, ease(span(t, 170.6, 173)), () =>
      starfield(ctx, seconds, { count: 44, seed: 5, bottom: 64 }),
    );
  for (let i = 0; i < 7; i++) {
    const cx = ((i * 61 + seconds * (1.2 + i * 0.3)) % 440) - 60;
    const c = k(night ? '#1A2238' : '#3A4458');
    faded(ctx, night ? 0.45 : 0.9, () =>
      oval(ctx, cx, 12 + (i % 3) * 14, 40 + (i % 3) * 14, 8 + (i % 2) * 4, c),
    );
  }
  const brick = k(night ? '#2C2430' : '#6A4C44'),
    brickD = k(night ? '#241E2A' : '#58403A'),
    roof = k(night ? '#16161E' : '#3A3A46');
  poly(ctx, roof, [-10, 64, 20, 40, 100, 40, 100, 64]);
  box(ctx, -10, 64, 110, 86, brickD);
  poly(ctx, roof, [220, 64, 220, 40, 300, 40, 330, 64]);
  box(ctx, 220, 64, 110, 86, brickD);
  box(ctx, 120, 18, 10, 16, brickD);
  box(ctx, 192, 20, 10, 14, brickD);
  box(ctx, 121, 15, 3, 4, k('#8A5A48'));
  box(ctx, 126, 15, 3, 4, k('#8A5A48'));
  poly(ctx, roof, [92, 66, 116, 30, 204, 30, 228, 66]);
  box(ctx, 96, 66, 128, 84, brick);
  for (let y = 72; y < 150; y += 6) box(ctx, 96, y, 128, 1, brickD);
  for (const [x, y] of [
    [30, 78],
    [250, 78],
    [112, 74],
    [182, 74],
  ] as const)
    houseWindow(ctx, k, x, y, 24, 20, null, 0);
  houseWindow(ctx, k, 26, 108, 32, 24, null, 0);
  houseWindow(ctx, k, 256, 108, 32, 24, null, 0);
  houseWindow(ctx, k, 104, 104, 34, 28, null, 0);
  // The kitchen window: cold strip light at dusk, amber after supper.
  const on = night ? 1 : ease(span(t, LIGHT_ON, LIGHT_ON + 0.25));
  houseWindow(ctx, k, 184, 104, 30, 26, night ? '#FFC468' : '#D2E0EC', on);
  if (night) {
    for (const [hx, hy] of [
      [192, 124],
      [198, 123],
      [205, 124],
    ] as const) {
      disc(ctx, hx, hy - 3, 2.4, '#5A3A20');
      box(ctx, hx - 3, hy - 1, 6, 4, '#5A3A20');
    }
    glow(ctx, 199, 140, 60, '#FFB860', 0.25);
  } else if (on > 0) glow(ctx, 199, 146, 50, '#C8DAEC', 0.18 * on);
  // Front door, just shut behind them.
  box(ctx, 146, 98, 26, 52, k('#D8D2C4'));
  box(ctx, 149, 106, 20, 44, k('#2E4A3E'));
  box(ctx, 149, 100, 20, 5, k(night ? '#6A5A40' : '#3A4A5A'));
  box(ctx, 158, 120, 2, 3, k('#C8A050'));
  const gap = night ? 0 : 5 * (1 - ease(span(t, 0.5, DOOR_SHUT)));
  if (gap > 0.3) box(ctx, 169 - gap, 106, gap, 44, '#E8D2A0');
  // Front wall, pavement, wet road.
  box(ctx, 90, 140, 56, 10, brickD);
  box(ctx, 174, 140, 56, 10, brickD);
  box(ctx, 90, 139, 56, 2, k('#8A8478'));
  box(ctx, 174, 139, 56, 2, k('#8A8478'));
  box(ctx, 0, 150, W, 9, k(night ? '#262832' : '#5A5E66'));
  box(ctx, 0, 159, W, 2, k('#8A8C90'));
  box(ctx, 0, 161, W, 19, k(night ? '#10121A' : '#30343E'));
  // Reflections in the wet road.
  for (let i = 0; i < 5; i++) {
    box(
      ctx,
      196 + i * 2,
      163 + i * 3,
      6 - i,
      2,
      alpha(night ? '#FFC468' : '#C8DAEC', 0.35 * on * (1 - i / 5)),
    );
    box(ctx, 37 + (i % 2), 163 + i * 3, 5, 2, alpha('#DCE6F0', 0.3 * (1 - i / 5)));
  }
  // Streetlamp.
  box(ctx, 38, 70, 3, 90, k('#22242A'));
  box(ctx, 33, 66, 14, 4, k('#22242A'));
  box(ctx, 35, 70, 10, 2, '#EAF0F6');
  glow(ctx, 40, 72, 56, '#DCE6F0', night ? 0.28 : 0.34);
  // Daniel's car, and Nell's bicycle against the wall.
  const cx = 232,
    cy = 168;
  const car = k(night ? '#141A24' : '#2A3444'),
    glass = k(night ? '#1E2838' : '#5A6A80');
  poly(ctx, car, [
    cx,
    cy,
    cx + 2,
    cy - 8,
    cx + 16,
    cy - 10,
    cx + 24,
    cy - 18,
    cx + 48,
    cy - 18,
    cx + 58,
    cy - 10,
    cx + 68,
    cy - 8,
    cx + 70,
    cy,
  ]);
  poly(ctx, glass, [cx + 26, cy - 16, cx + 46, cy - 16, cx + 54, cy - 10, cx + 20, cy - 10]);
  box(ctx, cx + 36, cy - 16, 2, 6, car);
  box(ctx, cx + 4, cy - 7, 60, 1, k('#6A7A90'));
  disc(ctx, cx + 14, cy, 5, k('#101014'));
  disc(ctx, cx + 56, cy, 5, k('#101014'));
  disc(ctx, cx + 14, cy, 2, k('#6A6A70'));
  disc(ctx, cx + 56, cy, 2, k('#6A6A70'));
  const bx = 104,
    by = 150;
  ctx.strokeStyle = k('#141418');
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(bx + 5, by - 5, 5, 0, TAU);
  ctx.moveTo(bx + 29, by - 5);
  ctx.arc(bx + 24, by - 5, 5, 0, TAU);
  ctx.stroke();
  const frame = k(night ? '#1E3A40' : '#3E8080');
  line(ctx, frame, 1.2, [
    bx + 5,
    by - 5,
    bx + 13,
    by - 5,
    bx + 21,
    by - 13,
    bx + 11,
    by - 13,
    bx + 5,
    by - 5,
  ]);
  line(ctx, frame, 1.2, [bx + 13, by - 5, bx + 10, by - 16]);
  line(ctx, frame, 1.2, [bx + 21, by - 13, bx + 24, by - 5]);
  line(ctx, frame, 1, [bx + 19, by - 17, bx + 23, by - 17]);
  box(ctx, bx + 8, by - 18, 5, 2, k('#1A1A1E'));
  box(ctx, bx + 21, by - 21, 7, 4, k('#8A6A40'));
  // Puddles: rain rings at dusk, still water and stars by night.
  for (let i = 0; i < 4; i++) {
    const px = 70 + i * 62,
      py = 170 + (i % 2) * 5;
    oval(ctx, px, py, 16, 2.5, k(night ? '#182030' : '#3A4252'));
    if (!night) {
      const u = (seconds * 1.3 + i * 0.37) % 1;
      ctx.strokeStyle = alpha(k('#A8B8CC'), 0.6 * (1 - u));
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.ellipse(px - 4 + i * 2, py, 2 + u * 7, 0.6 + u * 1.4, 0, 0, TAU);
      ctx.stroke();
    } else box(ctx, px - 5 + i * 3, py - 1, 1, 1, alpha('#FFE9B8', 0.7));
  }
  if (!night) rainfall(ctx, seconds, { amount: 1.2, color: k('#B8C6D6'), seed: 3 });
  else {
    // The last drips from the gutter.
    for (const d of [171.1, 172.6, 173.5]) {
      const u = span(t, d - 0.5, d);
      if (u > 0 && u < 1) box(ctx, 224, lerp(66, 150, easeIn(u)), 1, 2, alpha('#C8D8E8', 0.8));
    }
  }
}
function exterior(ctx: Ctx, t: number, seconds: number, night: boolean) {
  const k = grade(night ? 0.2 : 0.05);
  const keys: Keys = night
    ? [
        [170.6, 200, 118, 1.6],
        [171.2, 200, 118, 1.6],
        [174, 160, 90, 1],
      ]
    : [
        [0, 160, 90, 1],
        [7, 176, 100, 1.2],
      ];
  camera(ctx, track(t, keys), () => street(ctx, k, t, seconds, night));
  vignette(ctx, 0.5);
}

// ——— The hall ———
function coat(
  ctx: Ctx,
  k: Tone,
  x: number,
  len: number,
  color: string,
  hood: boolean,
  wet: boolean,
) {
  const c = k(color),
    d = k(mix(color, '#000000', 0.3)),
    sheen = k(mix(color, '#9AB0C8', 0.35));
  if (hood) poly(ctx, d, [x - 9, 30, x + 9, 30, x + 11, 42, x - 11, 42]);
  poly(ctx, c, [x - 3, 32, x + 3, 32, x + 14, 40, x + 16, 36 + len, x - 16, 36 + len, x - 14, 40]);
  poly(ctx, d, [x - 14, 40, x - 19, 46, x - 18, 36 + len * 0.7, x - 12, 36 + len * 0.7]);
  poly(ctx, d, [x + 14, 40, x + 19, 46, x + 18, 36 + len * 0.7, x + 12, 36 + len * 0.7]);
  poly(ctx, d, [x - 5, 32, x + 5, 32, x + 3, 42, x, 46, x - 3, 42]);
  line(ctx, d, 1, [x, 46, x, 36 + len]);
  if (wet) {
    line(ctx, sheen, 1, [x - 10, 46, x - 11, 32 + len]);
    line(ctx, sheen, 1, [x + 8, 52, x + 9, 30 + len]);
    box(ctx, x - 8, 36 + len, 1, 2, k('#C8D8E8'));
    box(ctx, x + 6, 36 + len, 1, 2, k('#C8D8E8'));
  } else
    for (let y = 50; y < 36 + len; y += 10) {
      box(ctx, x - 1, y, 3, 2, k('#E8D8B0'));
    }
}
function shoe(ctx: Ctx, k: Tone, x: number, y: number, f: number, color: string, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(1.5, 1.5);
  poly(ctx, k(color), [0, 0, 13 * f, 0, 13 * f, -3, 6 * f, -4, 4 * f, -7, 0, -7]);
  box(ctx, f > 0 ? 1 : -5, -6, 4, 1, alpha(k('#FFFFFF'), 0.3));
  ctx.restore();
}
function hallShot(ctx: Ctx, t: number) {
  const k = grade(0.05);
  camera(
    ctx,
    track(t, [
      [7, 160, 66, 1.3],
      [12.5, 160, 112, 1.3],
    ]),
    () => {
      box(ctx, 0, 0, W, 104, k('#6C6A5A'));
      for (let x = 0; x < W; x += 16) box(ctx, x, 0, 6, 104, k('#646252'));
      box(ctx, 0, 100, W, 4, k('#E0D8C4'));
      box(ctx, 0, 104, W, 40, k('#4C463C'));
      for (let x = 6; x < W; x += 52) box(ctx, x, 110, 42, 28, k('#544E44'));
      box(ctx, 0, 144, W, 36, k('#D8D2C4'));
      for (let r = 0; r < 3; r++)
        for (let c = r % 2; c < 16; c += 2) box(ctx, c * 20, 144 + r * 12, 20, 12, k('#2A2A2E'));
      glow(ctx, 330, 90, 160, '#C8DAEC', 0.18);
      box(ctx, 50, 26, 230, 6, k('#6A4A34'));
      for (const px of [80, 140, 200, 256]) disc(ctx, px, 32, 2, k('#8A6A4A'));
      coat(ctx, k, 80, 78, '#1E1E26', false, true);
      coat(ctx, k, 140, 72, '#2E3038', false, true);
      coat(ctx, k, 200, 58, '#1C2028', true, true);
      coat(ctx, k, 256, 66, '#D8A836', true, false);
      // Puddles under the wet coats; neat slippers under the dry one.
      for (const [px, w] of [
        [80, 14],
        [140, 12],
        [200, 11],
      ] as const)
        oval(ctx, px, 152, w, 2.5, alpha(k('#8AA0B8'), 0.45));
      shoe(ctx, k, 64, 160, 1, '#18161C', -0.1);
      shoe(ctx, k, 86, 166, -1, '#18161C', 0.3);
      shoe(ctx, k, 122, 158, 1, '#202028');
      shoe(ctx, k, 150, 170, 1, '#202028', -1.4);
      shoe(ctx, k, 186, 162, -1, '#1A1A20', 0.2);
      shoe(ctx, k, 212, 170, 1, '#1A1A20', 0.6);
      for (const sx of [245, 261]) {
        oval(ctx, sx, 164, 7, 4.5, k('#7A2A34'));
        oval(ctx, sx, 161, 5, 2.2, k('#EADCCC'));
        oval(ctx, sx, 161.5, 3.4, 1.2, k('#5A1E26'));
      }
      DRIPS.forEach((d, i) => {
        const cx = [80, 140, 200, 80][i] + [-8, 6, -4, 9][i],
          hem = [114, 108, 94, 114][i];
        const fall = span(t, d - 0.45, d);
        if (fall > 0 && fall < 1) box(ctx, cx, lerp(hem, 151, easeIn(fall)), 1, 2, k('#C8D8E8'));
        const splash = span(t, d, d + 0.45);
        if (splash > 0 && splash < 1) {
          ctx.strokeStyle = alpha(k('#C8D8E8'), 1 - splash);
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.ellipse(cx, 152, 1 + splash * 6, 0.5 + splash * 1.2, 0, 0, TAU);
          ctx.stroke();
        }
      });
    },
  );
  vignette(ctx, 0.55);
}

// ——— The film ———
type ShotFn = (ctx: Ctx, t: number, seconds: number) => void;
const SHOTS: readonly ShotFn[] = [
  (ctx, t, s) => exterior(ctx, t, s, false),
  hallShot,
  (ctx, t, s) =>
    kitchen(
      ctx,
      t,
      s,
      [
        [12.5, 160, 92, 1],
        [20, 156, 94, 1.07],
      ],
      apartStage(t, s),
    ),
  (ctx, t, s) =>
    kitchen(
      ctx,
      t,
      s,
      [
        [20, 212, 96, 2.05],
        [26, 207, 97, 2.2],
      ],
      apartStage(t, s),
    ),
  nellJoke,
  ruthStare,
  phoneShot,
  ruthAnswer,
  danielWork,
  ruthMoney,
  danielKnow,
  (ctx, t, s) =>
    kitchen(
      ctx,
      t,
      s,
      [
        [57.5, 160, 90, 1],
        [63, 24, 96, 2.8],
        [64.8, 23, 96, 2.85],
      ],
      apartStage(t, s),
      true,
    ),
  (ctx, t, s) =>
    kitchen(
      ctx,
      t,
      s,
      [
        [64.8, 52, 84, 2.2],
        [70.5, 44, 80, 2.5],
      ],
      apartStage(t, s),
      true,
    ),
  cardShot,
  overheadShot,
  danielKnead,
  memoryShot,
  (ctx, t, s) =>
    kitchen(
      ctx,
      t,
      s,
      [
        [95, 244, 78, 2.25],
        [100.6, 250, 80, 2.45],
      ],
      ovenStage(t, s),
    ),
  nellPinch,
  pinchShot,
  bowlShot,
  kneadShot,
  (ctx, t, s) =>
    kitchen(
      ctx,
      t,
      s,
      [
        [119, 150, 86, 1.9],
        [128, 150, 88, 2.05],
      ],
      bakeStage(t, s),
    ),
  ovenInShot,
  floorShot,
  clockShot,
  (ctx, t, s) =>
    kitchen(
      ctx,
      t,
      s,
      [
        [142.6, 136, 110, 3.6],
        [144.3, 136, 110, 3.6],
        [146.4, 150, 86, 2.2],
        [148, 150, 86, 2.2],
      ],
      afterStage(t, s),
    ),
  ruthBurnt,
  (ctx, t, s) =>
    kitchen(
      ctx,
      t,
      s,
      [
        [154.4, 150, 82, 2.5],
        [158.8, 150, 82, 2.75],
      ],
      afterStage(t, s),
    ),
  breadShot,
  (ctx, t, s) =>
    kitchen(
      ctx,
      t,
      s,
      [
        [162.6, 104, 98, 1.5],
        [170.6, 100, 99, 1.68],
      ],
      supperStage(t, s),
    ),
  (ctx, t, s) => exterior(ctx, t, s, true),
];

function subtitles(ctx: Ctx, t: number) {
  for (const [from, to, , text] of LINES) caption(ctx, text, presence(t, from, to, 0.3));
}

// ——— The score ———
const ROOT = 60; // C
/** Mum's theme: two four-bar phrases. The first stops on D, like her card. */
// prettier-ignore
const THEME = [
  4, null, 7, null, 9, 7, 4, null, 2, null, 0, 2, 4, null, null, null,
  4, null, 7, null, 12, 11, 9, null, 7, null, 4, 2, 0, null, null, null,
] as const;
/** The full theme's harmony, one chord per bar: [bass, ...pad]. */
const THEME_CHORDS = [
  [48, 60, 64, 67],
  [41, 57, 60, 65],
  [43, 55, 59, 62],
  [45, 57, 60, 64],
  [48, 60, 64, 67],
  [41, 57, 60, 65],
  [43, 55, 59, 62],
  [36, 48, 55, 60, 64],
] as const;

type Voice = Parameters<Score['note']>[3];
type Effect = Parameters<Score['fx']>[0];

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const theLongTableScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: ROOT + 12, voice: 'keys', intro: [4, 7, 9], outro: [0, 4, 7, 12] },
    (s) => {
      const n = (sec: number, pitch: number, dur: number, voice: Voice, gain: number, pan = 0) =>
        s.note(P(sec), pitch, dur, voice, gain, pan);
      const fx = (kind: Effect, sec: number, dur: number, gain: number, pan = 0) =>
        s.fx(kind, P(sec), dur, gain, pan);
      const pad = (sec: number, pitches: readonly number[], dur: number, gain = 0.028) =>
        pitches.forEach((p, i) =>
          n(sec, p, dur, 'pad', gain, (i / Math.max(1, pitches.length - 1) - 0.5) * 0.6),
        );
      /** The first phrase of her theme, stopping on the D where her handwriting stops. */
      const fragment = (start: number, bpm: number, voice: Voice, gain: number) => {
        const beat = 60 / bpm;
        THEME.slice(0, 9).forEach((d, i) => {
          if (d !== null)
            n(
              start + i * beat,
              ROOT + 12 + d,
              beat * (i === 8 ? 3 : 1.8),
              voice,
              gain,
              Math.sin(i) * 0.25,
            );
        });
      };

      // Rain: loud in the street, a hush through the window, easing off while the loaf bakes.
      const bounds = [0, 3.5, 7, 9.75, 12.5];
      for (let c = 15.5; c < 150; c += 3) bounds.push(c);
      bounds.push(150);
      const rainGain = (sec: number) =>
        sec < 7
          ? 0.16
          : sec < 12.5
            ? 0.075
            : lerp(0.08, 0.055, span(sec, 58, 110)) * (1 - ease(span(sec, 116, 150)));
      for (let i = 0; i < bounds.length - 1; i++) {
        const a = bounds[i],
          b = bounds[i + 1],
          g = rainGain((a + b) / 2);
        if (g < 0.004) continue;
        fx('rain', a, b - a + 0.02, g * 0.62, -0.45);
        fx('rain', a + 0.011, b - a, g * 0.62, 0.45);
      }

      // Arrival: the door, the switch, the strip light's hum.
      fx('thud', DOOR_SHUT, 0.4, 0.16, 0.1);
      fx('knock', DOOR_SHUT, 0.12, 0.08, 0.1);
      fx('click', LIGHT_ON, 0.06, 0.12, 0.25);
      fx('hum', LIGHT_ON + 0.05, 1.2, 0.025, 0.25);
      DRIPS.forEach((d, i) => fx('drip', d, 0.25, 0.14, [-0.5, 0, 0.4, -0.2][i]));

      // The kitchen clock, loudest in the silences.
      const tickGain = (sec: number) => {
        if (within(sec, 31.5, 35)) return 0.1;
        if (within(sec, 52.5, 70.5)) return 0.12;
        if (within(sec, 89, 95) || within(sec, 106, 132) || sec >= 139.6) return 0;
        return 0.055;
      };
      for (let sec = 12.6; sec < 139.6; sec += 1) {
        const g = tickGain(sec),
          tock = Math.round(sec) % 2 === 0;
        if (g > 0) fx('tick', sec, 0.05, g * (tock ? 0.75 : 1), tock ? 0.1 : 0.2);
      }
      for (let i = 0; i < 20; i++)
        fx('tick', 139.7 + 2.5 * (i / 20) ** 0.7, 0.05, 0.05, i % 2 ? 0.2 : 0.1);

      // Sitting apart: the spoon, and a cold pad with nothing in the middle of it.
      STIRS.forEach((sec) => {
        fx('click', sec, 0.05, 0.07, -0.35);
        n(sec, 100, 0.3, 'bell', 0.012, -0.35);
      });
      fx('click', SPOON_DOWN, 0.06, 0.09, -0.35);
      pad(12.5, [57, 64, 71], 8.2, 0.02);
      pad(20.5, [53, 60, 67], 8.2, 0.022);
      pad(28.5, [55, 62, 69], 8.2, 0.022);
      pad(36.5, [57, 64, 72], 8.2, 0.024);
      pad(44.5, [53, 60, 69], 3.6, 0.024);
      pad(48, [52, 59, 65], 4.4, 0.028);
      BUZZ.forEach((b) => {
        fx('hum', b, 0.45, 0.2, 0.2);
        fx('click', b, 0.03, 0.04, 0.2);
      });
      fx('rustle', GRAB, 0.35, 0.06, 0.2);
      fx('knock', FACE_DOWN, 0.1, 0.12, 0.1);

      // Silence, then Nell's chair, her steps, the cardigan, the tin.
      fx('scribble', SCRAPE, 0.55, 0.16, 0.55);
      fx('creak', SCRAPE + 0.05, 0.45, 0.2, 0.55);
      [63.9, 64.6, 65.3, 65.9].forEach((sec, i) => fx('step', sec, 0.12, 0.06, 0.5 - i * 0.3));
      fx('rustle', TOUCH, 0.7, 0.04, -0.4);
      fx('scribble', TIN - 0.1, 0.2, 0.05, -0.4);
      fx('clatter', TIN + 0.02, 0.18, 0.025, -0.4);
      fx('pop', LID, 0.2, 0.16, -0.3);
      fx('rustle', 70.8, 0.5, 0.05);

      // The card: her theme, once, stopping where the ink stops.
      pad(71.2, [53, 57, 60, 64], 4.6, 0.02);
      pad(75.8, [50, 57, 62, 65], 5.4, 0.02);
      fragment(71.4, 66, 'keys', 0.095);
      fx('swish', SLIDE - 0.5, 0.5, 0.05, 0.3);
      pad(84.3, [48, 55, 64], 4.8, 0.022);

      // Memory: small hands, her hands, the fragment again in a warmer key.
      pad(89.2, [53, 57, 60, 64], 5.8, 0.03);
      fragment(89.8, 70, 'bell', 0.065);
      MEMORY_KNEADS.forEach((sec) => fx('thud', sec, 0.25, 0.06));
      fx('giggle', 91.9, 0.7, 0.035, 0.2);

      // The pieces: the oven dial, three pinches (a note each, a chord together).
      pad(95.2, [55, 62, 67, 71], 5.6, 0.022);
      [99.35, 99.6, 99.85].forEach((sec) => fx('click', sec, 0.04, 0.07, 0.4));
      fx('sweep', DIAL, 0.7, 0.07, 0.4);
      pad(100.8, [48, 55, 60, 64], 5.2, 0.024);
      PINCHES.forEach((sec, i) => {
        n(sec, ROOT + [16, 19, 24][i], 1.6, 'bell', 0.055, [-0.3, 0, 0.3][i]);
        fx('rustle', sec - 0.05, 0.2, 0.03);
      });

      // Baking: milk, honey, and a working tune that the kneading keeps time for.
      fx('swish', 106.0, 0.4, 0.04);
      fx('water', MILK, 1.6, 0.07, -0.2);
      fx('drip', HONEY + 0.5, 0.2, 0.06, 0.3);
      fx('scribble', STIR, 0.9, 0.04);
      pad(106, [48, 55, 60, 64, 67], 5.6, 0.022);
      for (let i = 0; i < 7; i++)
        n(108.4 + i * 0.4, [60, 64, 67, 72][i % 4], 0.5, 'keys', 0.035, 0.2);
      s.section({
        from: P(111.6),
        to: P(128),
        bpm: 75,
        root: 48,
        chords: [0, 5, 7, 0],
        melody: [
          12,
          16,
          19,
          16,
          12,
          16,
          19,
          16,
          12,
          17,
          21,
          17,
          12,
          17,
          21,
          17,
          11,
          14,
          19,
          14,
          11,
          14,
          19,
          14,
          12,
          16,
          19,
          24,
          19,
          16,
          12,
          null,
        ],
        step: 0.5,
        voice: 'pluck',
        gain: 0.55,
        level: 0.75,
        fade: 1,
      });
      [...KNEADS, ...BAKE_KNEADS].forEach((sec) => fx('thud', sec, 0.28, 0.15));
      fx('hum', BUZZ2, 0.4, 0.15, 0.4);
      fx('knock', FLIP, 0.08, 0.1, 0.4);
      fx('giggle', POINT, 1.3, 0.07, 0.35);
      fx('swish', FLICK - 0.05, 0.2, 0.06, 0.2);
      fx('gasp', FLICK + 0.25, 0.35, 0.06, 0.35);
      fx('giggle', FLICK + 0.8, 1.2, 0.06, 0.35);
      fx('giggle', RUTH_LAUGH, 1.6, 0.07, -0.3);
      fx('giggle', RUTH_LAUGH + 0.3, 1.4, 0.05, 0);

      // The oven, and the floor in front of it.
      pad(128, [53, 60, 64, 69], 4.4, 0.026);
      fx('scribble', 128.9, 0.5, 0.05, -0.1);
      fx('creak', 129.7, 0.5, 0.12);
      fx('thud', OVEN_SHUT, 0.35, 0.2);
      fx('knock', OVEN_SHUT, 0.1, 0.1);
      pad(132.2, [53, 57, 60, 65], 7.6, 0.03);
      fx('wind', 132, 7.6, 0.05, 0.5);
      fragment(132.8, 70, 'keys', 0.09);
      fx('rustle', LEAN, 0.5, 0.04, -0.1);
      fx('rustle', 136.7, 0.3, 0.03, 0.3);
      fx('click', PHONE_OFF, 0.04, 0.07, 0.3);
      fx('knock', 138.7, 0.06, 0.05, 0.3);
      fx('sweep', 139.7, 2.6, 0.03);
      fx('chime', TIMER, 1.2, 0.12, 0.3);
      n(TIMER, 88, 1.2, 'bell', 0.04, 0.3);

      // Burnt. No music at all: the door, the tin, the crust ticking as it cools.
      fx('creak', OVEN_OPEN, 0.6, 0.14, 0.2);
      fx('thud', TIN_DOWN, 0.3, 0.14);
      fx('clatter', TIN_DOWN, 0.18, 0.04);
      fx('crackle', CRACKLE, 3.2, 0.075);
      fx('crackle', CRACKLE + 3.3, 1.5, 0.045);
      n(144.2, 40, 3.8, 'pad', 0.02);
      pad(148.4, [45, 52, 57, 60], 4.4, 0.022);
      fx('gasp', BREAK, 0.45, 0.07, -0.1);

      // Her theme, whole, at last.
      const beat = 60 / THEME_BPM;
      THEME.forEach((d, i) => {
        if (d !== null)
          n(
            THEME_START + i * beat,
            ROOT + 12 + d,
            beat * (i === 28 ? 5 : 1.9),
            'keys',
            0.11,
            Math.sin(i * 0.9) * 0.2,
          );
      });
      THEME_CHORDS.forEach((chord, bar) => {
        const at = THEME_START + bar * 4 * beat;
        const [bass, ...rest] = chord;
        n(at, bass, beat * 3.6 + (bar === 7 ? 1.8 : 0), 'bass', 0.06);
        rest.forEach((p, i) =>
          n(
            at,
            p,
            beat * 3.95 + (bar === 7 ? 1.9 : 0),
            'pad',
            0.032,
            (i / (rest.length - 1) - 0.5) * 0.6,
          ),
        );
        if (bar >= 4)
          for (let b = 0; b < 4; b++)
            n(at + b * beat + beat / 2, rest[(b + 1) % rest.length] + 12, beat, 'bell', 0.014, 0.3);
      });
      fx('giggle', 154.7, 1.2, 0.05, -0.2);
      fx('gasp', 155.3, 0.4, 0.05);
      fx('giggle', 155.9, 1.4, 0.05, 0.25);
      fx('rustle', HUG, 0.5, 0.05);
      TEARS.forEach((sec) => {
        fx('crackle', sec - 0.05, 0.7, 0.09);
        fx('crunch', sec, 0.18, 0.1);
      });
      fx('creak', CHAIR_IN - 0.35, 0.55, 0.15, -0.5);
      fx('scribble', CHAIR_IN - 0.35, 0.4, 0.05, -0.5);
      fx('click', CUP_DOWN, 0.05, 0.08, -0.4);
      n(CUP_DOWN, 100, 0.3, 'bell', 0.01, -0.4);
      fx('giggle', 169.9, 1.0, 0.045, 0.2);
      fx('wind', 170.6, 3.3, 0.03);
      [171.1, 172.6, 173.5].forEach((sec, i) =>
        fx('drip', sec, 0.2, 0.08 - i * 0.01, [-0.3, 0.4, -0.1][i]),
      );
    },
  );

export const theLongTable: FilmModule = {
  draw(ctx, p, seconds) {
    const t = p * STORY;
    const { index } = shot(t, CUTS);
    SHOTS[index](ctx, t, seconds);
    subtitles(ctx, t);
  },
  score: theLongTableScore,
  look: {
    shade: '#1A1820',
    ink: '#F3E6D2',
    accent: '#CC9238',
    dedication: 'for Mum, who never wrote it all down',
  },
};
