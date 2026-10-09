import type { FilmModule } from './types';
import {
  alpha,
  box,
  camera,
  clamp,
  disc,
  ease,
  easeIn,
  easeOut,
  glow,
  H,
  handOf,
  lerp,
  letterbox,
  line,
  mix,
  oval,
  person,
  poly,
  presence,
  rand,
  shot,
  span,
  TAU,
  track,
  vignette,
  W,
  within,
  type Ctx,
  type Figure,
  type View,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * TALL ORDER
 * At the Morning Market the orange seller and the melon seller across the aisle try to out-stack
 * each other, one course at a time, until their fruit towers rise past the clock, the bunting and
 * the glass tube line. A stand-off at the summit; one perfect orange against one enormous
 * watermelon. Then a sparrow lands on top, and gravity does something nobody expects: the towers
 * lean in and meet as an arch. One orange rolls down it into a little girl's hands.
 *
 * Height is pitch: every placement in LAYERS is one note a scale step above the last, oranges on
 * the pluck (right), melons on the bell (left). Picture and score read the same story seconds.
 */

// ——— Time ———
/** Story seconds between the title card and The End (the film runs 60 s). */
export const STORY = 54;
/** Story seconds → story time. */
const P = (sec: number) => sec / STORY;

// ——— Hit points, in story seconds, shared by picture and score ———
export const PELL_TOP = 5.0;
export const MAGS_FIRST = 9.5;
type Side = 'L' | 'R';
export type Layer = {
  s: number;
  side: Side;
  /** MIDI note: one scale step above the last placement. */
  note: number;
  base?: 'crate' | 'barrel';
  ladder?: 'step' | 'long';
};
/** Every placement in the display war: R is Pell's oranges, L is Mags's melons. */
export const LAYERS: readonly Layer[] = [
  { s: 11.0, side: 'R', note: 55, base: 'crate' },
  { s: 12.3, side: 'L', note: 57, base: 'barrel' },
  { s: 13.5, side: 'R', note: 59 },
  { s: 14.6, side: 'L', note: 60 },
  { s: 15.6, side: 'R', note: 62, ladder: 'step' },
  { s: 16.55, side: 'L', note: 64, ladder: 'long' },
  { s: 17.45, side: 'R', note: 65, base: 'crate' },
  { s: 18.3, side: 'L', note: 67 },
  { s: 19.1, side: 'R', note: 69 },
  { s: 19.85, side: 'L', note: 71 },
  { s: 20.55, side: 'R', note: 72 },
  { s: 21.25, side: 'L', note: 74 },
  { s: 21.9, side: 'R', note: 76 },
  { s: 22.55, side: 'L', note: 77 },
  { s: 23.15, side: 'R', note: 79 },
  { s: 23.75, side: 'L', note: 81 },
];
/** The capsule passes between the summits: in, a gawping crawl, and out. */
export const CAPSULE = [27.0, 28.6] as const;
const CRAWL = [27.3, 28.3] as const;
export const SWAY = 28.4;
/** The draught: a decaying sway, Mags's tower first (the capsule passes left to right). */
const SWAY_HZ = 0.8;
const SWAY_DECAY = 0.55;
const SWAY_LAG = { L: 0, R: 0.15 } as const;
/** When a tower swings to its n-th extreme: where the damped sine turns round. */
const swayPeak = (side: Side, n: number) =>
  SWAY + SWAY_LAG[side] + (Math.atan((TAU * SWAY_HZ) / SWAY_DECAY) + n * Math.PI) / (TAU * SWAY_HZ);
/** Two creaks, each on a tower's extreme: Mags's on the wide, Pell's on his close-up. */
export const CREAKS: readonly [number, number] = [swayPeak('L', 1), swayPeak('R', 2)];
/** Pell, eyes shut, hugging his swaying stack. */
const CLING_CU = [29.5, 30.5] as const;
export const STANDOFF = 32.0;
const RAISE = 36.2;
export const PLACE = 37.0;
export const SPARROW = 38.6;
export const CREAK = 39.8;
export const GASP = 40.2;
export const MEET = 43.0;
export const HOP = 44.0;
export const BOUNCES = [44.2, 44.5, 44.8, 45.05, 45.3] as const;
export const CATCH = 45.6;
export const UNISON = 46.5;
const FIRST_STEP = 47.0;
/** When each seller slides down their ladder, after the arch has held. */
const SLIDE = { L: 48.6, R: 48.4 } as const;
export const HANDSHAKE = 52.0;

// ——— Shots (story seconds where each begins) ———
const CUTS = [
  0, // the whole market at eight
  4.0, // Pell's pyramid
  8.0, // CU Mags: her customers have gone
  9.2, // the challenge
  10.0, // CU Pell: nostrils
  10.6, // a crate
  11.9, // a barrel
  13.1, // oranges, on tiptoe
  14.2, // melons, on a bucket
  15.2, // the stepladder
  16.15, // the long ladder
  17.1, // the climb
  18.0, // the crowd
  18.6, // the climb
  21.0, // the crowd: the cap
  21.6, // the climb
  24.0, // looking up
  26.0, // the tube
  27.3, // the capsule window
  28.3, // the draught
  CLING_CU[0], // Pell clings on
  CLING_CU[1], // the draught dies away
  32.0, // Pell's eyes
  33.0, // Mags's eyes
  34.0, // Pell polishes
  35.0, // Mags hoists
  36.2, // both raise; PLACE
  38.0, // the sparrow
  40.2, // below
  42.0, // the turn
  43.4, // nose to nose
  44.35, // the roll
  46.5, // under the arch
  50.0, // the handshake, and the pull out
] as const;

// ——— Palette: an early-morning market ———
const SKY_HI = '#BFD9E6';
const SKY_LO = '#F6D9B8';
const SUN = '#FFE7C2';
const ORANGE = '#F28C28';
const ORANGE_HI = '#FFB866';
const ORANGE_LO = '#C9661C';
const MELON = '#4E8C46';
const MELON_ST = '#2F5E2B';
const MELON_HI = '#7DB86A';
const WATER = '#24532B';
const WATER_ST = '#67A653';
const WOOD = '#B07A45';
const WOOD_D = '#7E5530';
const WOOD_L = '#CF9A62';
const CREAM = '#FFF3D6';
const P_APRON = '#E8892B';
const M_APRON = '#5FA24B';
const M_SCARF = '#2F7A47';
const INK = '#2A2530';
const GLASS = '#CFE9F0';
const CAPSULE_C = '#E8EEF2';
const COBBLE = '#CDB898';
const COBBLE_D = '#B39F7E';
const RIVER = '#9CC3CF';
const FAR = '#A9B4C2';
const FAR_D = '#95A1B2';
const FLAGS = [P_APRON, M_APRON, CREAM] as const;
const SPIRE = mix('#A7B4C3', SKY_HI, 0.3);
const SPIRE_D = mix('#9AA8B9', SKY_HI, 0.3);

// ——— The set: one tall world, 320 wide and 300 high ———
const COUNTER = 262;
const GROUND = 290;
const TX = { L: 84, R: 236 } as const;
/** Where each seller stands to stack: on the aisle side of their own tower. */
const STAND = { L: 110, R: 210 } as const;
const BEHIND = { L: 62, R: 258 } as const;
/** Behind the counters the sellers stand on a raised board, so they show above them. */
const FLOOR = 277;
const FOOT = { L: 128, R: 200 } as const;
const BACK_FOOT = 224;
const BASE = { L: 18, R: 17 } as const;
const COURSE = 21;
/** The arch: each tower bends by lean · REACH · (h / HREF)². */
const HREF = 186;
const REACH = 63;
const SIGN = { L: 1, R: -1 } as const;
/** How far below the top a seller's feet are when they can just reach it. */
const UP = { L: 34, R: 38 } as const;
/** How far each seller steps down after PLACE, so the crown never sits on a head. */
const STEP_DOWN = 16;
const SIZE = { L: 0.95, R: 1.15 } as const;
/** Arms reaching forward, a little up: both hands stay below the face. */
const LIFT: readonly [number, number] = [1.75, 1.95];
const MEETX = { L: 149, R: 170 } as const;
const SIDES: readonly Side[] = ['L', 'R'];
const tubeY = (x: number) => 44 + ((x - 160) / 260) ** 2 * 30;
const TUBE_R = 7;
const CLOCK = { x: 160, y: 150, r: 12 } as const;

// ——— Small helpers ———
type Key = readonly [number, number];
function along(t: number, keys: readonly Key[]) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, av] = keys[i],
      [b, bv] = keys[i + 1];
    if (t < b) return lerp(av, bv, ease((t - a) / (b - a)));
  }
  return keys[keys.length - 1][1];
}
type CamKey = readonly [number, number, number, number];
/** A camera move at constant speed between keys (track() eases into every key). */
function glide(t: number, keys: readonly CamKey[]): View {
  if (t <= keys[0][0]) return { x: keys[0][1], y: keys[0][2], zoom: keys[0][3] };
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, ax, ay, az] = keys[i],
      [b, bx, by, bz] = keys[i + 1];
    if (t < b) {
      const u = (t - a) / (b - a);
      return { x: lerp(ax, bx, u), y: lerp(ay, by, u), zoom: lerp(az, bz, u) };
    }
  }
  const k = keys[keys.length - 1];
  return { x: k[1], y: k[2], zoom: k[3] };
}
const darker = (c: string, k = 0.28) => mix(c, '#1A1410', k);
type Bounds = { x0: number; x1: number; y0: number; y1: number };
function clampView(v: View): View {
  const hw = W / 2 / v.zoom,
    hh = H / 2 / v.zoom;
  return { x: clamp(v.x, -130 + hw, 450 - hw), y: clamp(v.y, -40 + hh, 300 - hh), zoom: v.zoom };
}
function boundsOf(v: View): Bounds {
  const hw = W / 2 / v.zoom,
    hh = H / 2 / v.zoom;
  return { x0: v.x - hw, x1: v.x + hw, y0: v.y - hh, y1: v.y + hh };
}

// ——— The towers ———
function lean(t: number) {
  if (t < CREAK) return 0;
  if (t < MEET) return span(t, CREAK, MEET) ** 2.2;
  if (t >= MEET + 0.55) return 1;
  // A soft bump as the tops meet, then perfectly still.
  return (
    1 -
    0.06 * Math.sin(Math.PI * span(t, MEET, MEET + 0.3)) -
    0.02 * Math.sin(Math.PI * span(t, MEET + 0.3, MEET + 0.55))
  );
}
/** The capsule's draught: both towers sway, Mags's first, and settle before the stand-off. */
function sway(side: Side, time: number) {
  const t = time - SWAY_LAG[side];
  if (t < SWAY || t >= 32) return 0;
  const u = t - SWAY;
  return 15 * Math.sin(TAU * SWAY_HZ * u) * Math.exp(-SWAY_DECAY * u) * (1 - span(t, 31, 32));
}
const bend = (side: Side, h: number, t: number) =>
  (SIGN[side] * lean(t) * REACH + sway(side, t)) * (Math.max(0, h) / HREF) ** 2;

type Kind = 'orange' | 'melon' | 'crate' | 'barrel' | 'tiny' | 'water';
type Item = { kind: Kind; dx: number; h: number; hi: boolean };
type Course = { side: Side; at: number; bottom: number; items: readonly Item[] };
function oranges(rows: readonly number[], bottom: number, step = 4.1): Item[] {
  const out: Item[] = [];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++)
      out.push({
        kind: 'orange',
        dx: (i - (n - 1) / 2) * 5,
        h: bottom + 2.5 + r * step,
        hi: r === 0 && i % 2 === 1,
      });
  });
  return out;
}
function melons(rows: readonly number[], bottom: number, step = 7): Item[] {
  const out: Item[] = [];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++)
      out.push({
        kind: 'melon',
        dx: (i - (n - 1) / 2) * 9,
        h: bottom + 3.5 + r * step,
        hi: (i + r) % 2 === 0,
      });
  });
  return out;
}
const topAfter = (side: Side, n: number) => COUNTER - BASE[side] - n * COURSE;
const TINY_H = BASE.R + 8 * COURSE + 1.8;
const WATER_H = BASE.L + 8 * COURSE + 7.5;
/** Every course of both towers, in the order they land. A constant table. */
const COURSES: readonly Course[] = (() => {
  const out: Course[] = [
    { side: 'R', at: -1, bottom: 0, items: oranges([4, 3, 2], 0, 4.2) },
    { side: 'R', at: PELL_TOP, bottom: 12.6, items: oranges([1], 12.6) },
    { side: 'L', at: -1, bottom: 0, items: melons([3, 2], 0, 6) },
    { side: 'L', at: MAGS_FIRST, bottom: 12, items: melons([3], 12) },
  ];
  const count = { L: 0, R: 0 };
  for (const l of LAYERS) {
    const bottom = BASE[l.side] + count[l.side]++ * COURSE;
    const items: Item[] =
      l.side === 'R'
        ? l.base === 'crate'
          ? [{ kind: 'crate', dx: 0, h: bottom + 6, hi: false }, ...oranges([5, 4], bottom + 12)]
          : oranges([5, 4, 5, 4, 5], bottom)
        : l.base === 'barrel'
          ? [{ kind: 'barrel', dx: 0, h: bottom + 7.5, hi: false }, ...melons([3], bottom + 15)]
          : melons([3, 2, 3], bottom);
    out.push({ side: l.side, at: l.s, bottom, items });
  }
  out.push({
    side: 'R',
    at: PLACE,
    bottom: TINY_H - 1.8,
    items: [{ kind: 'tiny', dx: 0, h: TINY_H, hi: true }],
  });
  out.push({
    side: 'L',
    at: PLACE,
    bottom: WATER_H - 7.5,
    items: [{ kind: 'water', dx: 0, h: WATER_H, hi: true }],
  });
  return out;
})();
const placed = (side: Side, t: number) =>
  LAYERS.reduce((n, l) => n + (l.side === side && l.s <= t ? 1 : 0), 0);
/** How far up the crowd is looking: 0 at the first pyramid, 1 at the summits. */
const gaze = (t: number) =>
  clamp(((placed('L', t) + placed('R', t)) / 16) * 0.9 + (t > PLACE ? 0.1 : 0));

// ——— The sellers ———
type Support = 'behind' | 'counter' | 'bucket' | 'step' | 'long' | 'ground';
type Stance = { x: number; y: number; on: Support };
/** Feet on the ladders: each seller climbs one course just after placing one. */
function feetKeys(side: Side) {
  const mine = LAYERS.filter((l) => l.side === side);
  const start = mine.findIndex((l) => l.ladder);
  const keys: [number, number][] = [];
  for (let n = start; n < mine.length; n++) {
    const before = topAfter(side, n) + UP[side],
      after = topAfter(side, n + 1) + UP[side];
    if (n === start) keys.push([mine[n].s - 2, before]);
    keys.push([mine[n].s + 0.1, before], [mine[n].s + 0.45, after]);
  }
  return keys;
}
const FEET_KEYS = { L: feetKeys('L'), R: feetKeys('R') } as const;
/** Where a seller is standing, ignoring the slide down at the end. */
function perch(side: Side, t: number): Stance {
  if (side === 'R') {
    if (t < 10.6) return { x: BEHIND.R, y: FLOOR, on: 'behind' };
    if (t < 15.2)
      return { x: STAND.R, y: COUNTER - (within(t, 12.95, 13.65) ? 3 : 0), on: 'counter' };
  } else {
    if (t < 11.9) return { x: BEHIND.L, y: FLOOR, on: 'behind' };
    if (t < 14.2) return { x: STAND.L, y: COUNTER, on: 'counter' };
    if (t < 16.15) return { x: STAND.L, y: COUNTER - 10, on: 'bucket' };
  }
  // Once the summit is set, each steps down a rung so the crown stands clear above them.
  const y = along(t, FEET_KEYS[side]) + STEP_DOWN * ease(span(t, PLACE + 0.25, PLACE + 0.6));
  // Through the draught and the lean they shuffle in to hug their own stacks.
  const hug = presence(t, SWAY, 31.8, 0.25) + presence(t, CREAK, MEET + 0.1, 0.25);
  const x = STAND[side] + bend(side, COUNTER - y, t) - SIGN[side] * 5 * hug;
  return { x, y, on: side === 'R' ? 'step' : 'long' };
}
function stance(side: Side, t: number): Stance {
  if (t < SLIDE[side]) return perch(side, t);
  const top = perch(side, SLIDE[side]);
  const k = easeIn(span(t, SLIDE[side], SLIDE[side] + 1));
  if (k < 1) return { x: lerp(top.x, FOOT[side], k), y: lerp(top.y, GROUND, k), on: top.on };
  return { x: lerp(FOOT[side], MEETX[side], ease(span(t, 50.2, 51.0))), y: GROUND, on: 'ground' };
}
/** Ladders follow the feet; once both sellers are down they rest lower, against the legs. */
const LADDERS_DOWN = 50.0;
function ladderTop(side: Side, t: number) {
  const top = perch(side, Math.min(t, SLIDE[side]));
  if (t < LADDERS_DOWN) return top;
  const y = top.y + 36;
  return { ...top, y, x: STAND[side] + bend(side, COUNTER - y, t) };
}

const PELL: Figure = {
  skin: '#E8B48E',
  hair: '#4A3A30',
  coat: '#F3EFE6',
  legs: '#4B4D5C',
  shoes: '#2E2A30',
  size: 1.15,
  build: 'adult',
  hat: 'cap',
  hatColor: '#8C8E94',
  blush: false,
};
const MAGS: Figure = {
  skin: '#D99B74',
  hair: '#5A3E2E',
  coat: '#8E4F6A',
  legs: '#3F3A4A',
  size: 0.95,
  build: 'adult',
  blush: true,
};

function sellerPose(side: Side, t: number, st: Stance): Figure {
  const rival: 1 | -1 = side === 'R' ? -1 : 1;
  const toTower: 1 | -1 = TX[side] > st.x ? 1 : -1;
  const f: Figure = {
    ...(side === 'R' ? PELL : MAGS),
    facing: rival,
    arms: [0.3, 0.6],
    eyes: 'closed',
    mouth: 'flat',
  };
  const carrying = COURSES.find(
    (c) => c.side === side && c.at > 0 && c.at < PLACE && t >= c.at - 0.55 && t < c.at + 0.12,
  );
  if (carrying) {
    if (carrying.at === PELL_TOP)
      return { ...f, facing: toTower, arms: [0.3, 2.1], eyes: 'open', mouth: 'smile' };
    return { ...f, facing: toTower, arms: LIFT, eyes: 'closed', mouth: 'flat' };
  }
  if (t < 4.4) return { ...f, eyes: 'open', mouth: 'smile', arms: [0.2, 0.3] };
  if (side === 'R' && t < 9.2)
    return { ...f, facing: -1, arms: [0.25, 0.25], eyes: 'happy', mouth: 'smile' };
  if (side === 'L' && t < 9.2)
    return { ...f, eyes: t > 8.5 ? 'closed' : 'open', mouth: 'frown', arms: [0.2, 0.3] };
  // Her customers are back: smug.
  if (side === 'L' && t >= 9.7 && t < 10.6)
    return { ...f, arms: [0.2, 0.3], eyes: 'happy', mouth: 'smile' };
  // Hugging the stack, eyes screwed shut: through the draught and the lean.
  const cling: Figure = {
    ...f,
    facing: toTower,
    lean: 0.35,
    arms: [2.3, 2.5],
    eyes: 'closed',
    mouth: 'o',
  };
  if (t < 26.9) {
    const holding = st.on === 'step' || st.on === 'long';
    return { ...f, arms: holding ? [0.4, 1.1] : [0.3, 0.5], mouth: t < 11 ? 'frown' : 'flat' };
  }
  if (t < SWAY) return { ...f, arms: [0.4, 1.1], eyes: 'wide', mouth: 'o' };
  if (t < 31.8) return cling;
  if (side === 'L' && t >= 35 && t < 36.75) {
    // The hoist: from behind her hip up over her shoulder, wobbling under the weight.
    const a = ease(span(t, 35.05, 35.8));
    const up = lerp(-0.5, -2.2, a) + Math.sin(t * 19) * 0.08 * (1 - a);
    return { ...f, arms: [up - 0.1, up], eyes: 'closed', mouth: a < 1 ? 'flat' : 'smile' };
  }
  if (side === 'R' && t >= RAISE && t < 36.75) {
    const a = ease(span(t, RAISE, 36.55));
    return { ...f, arms: [0.3, lerp(0.7, 2.25, a)], eyes: 'closed', mouth: 'smile' };
  }
  if (t >= 36.75 && t < PLACE + 0.15)
    return {
      ...f,
      facing: toTower,
      arms: side === 'L' ? LIFT : [0.3, 2.0],
      eyes: 'closed',
      mouth: 'flat',
    };
  if (t < PLACE) return { ...f, arms: [0.3, 0.7], eyes: 'closed', mouth: 'flat' };
  if (t < SPARROW - 0.15) return { ...f, arms: [0.3, 0.9], eyes: 'closed', mouth: 'smile' };
  if (t < CREAK)
    return side === 'R'
      ? { ...f, facing: toTower, arms: [0.3, 0.9], eyes: 'wide', mouth: 'o' }
      : { ...f, arms: [0.3, 0.9], eyes: 'open', mouth: 'flat' };
  if (t < MEET + 0.1) return cling;
  if (t < MEET + 0.5) return { ...f, arms: [0.5, 1.2], eyes: 'wide', mouth: 'o' };
  if (t < SLIDE[side]) return { ...f, arms: [0.5, 1.2], eyes: 'wide', mouth: 'flat' };
  if (st.on !== 'ground') return { ...f, arms: LIFT, eyes: 'wide', mouth: 'o' };
  // Down on the cobbles.
  if (t < 50.2) return { ...f, arms: [0.2, 0.3], eyes: 'open', mouth: 'flat' };
  if (t < 51.0) return { ...f, step: t * 11, eyes: 'open', mouth: 'flat' };
  if (t < 51.55) return { ...f, arms: [0.2, 0.3], lean: -0.3, eyes: 'open', mouth: 'flat' };
  if (t < 51.8) return { ...f, arms: [0.2, 0.3], eyes: 'closed', mouth: 'flat' };
  if (t < 52.45) {
    const pump = Math.sin(Math.PI * span(t, 51.95, 52.3)) * 0.3;
    return { ...f, arms: [0.2, 1.3 - pump], eyes: 'closed', mouth: 'flat' };
  }
  return { ...f, arms: [0.2, 0.3], eyes: 'open', mouth: 'smile' };
}

/** The summit fruit while it is in a seller's hands; the tower draws it once it lands. */
function summitHeld(side: Side, t: number) {
  const from = side === 'R' ? 34.0 : 35.0;
  if (t < from || t >= PLACE) return null;
  const hold = (time: number) => {
    const st = stance(side, time),
      f = sellerPose(side, time, st);
    const hand = handOf(st.x, st.y, f, 'front');
    return side === 'R'
      ? { x: hand.x, y: hand.y - 2 }
      : { x: hand.x - (f.facing ?? 1) * 4, y: hand.y - 7 };
  };
  if (t < 36.75) return hold(t);
  const a = easeOut(span(t, 36.75, PLACE));
  const s = hold(36.74);
  const h = side === 'R' ? TINY_H : WATER_H;
  return {
    x: lerp(s.x, TX[side] + bend(side, h, t), a),
    y: lerp(s.y, COUNTER - h, a) - 5 * Math.sin(Math.PI * a),
  };
}

/** A seller in the wide: the town figure, plus apron, nose, headscarf and belly. */
function sellerArt(ctx: Ctx, side: Side, x: number, y: number, f: Figure) {
  person(ctx, x, y, f);
  const s = f.size ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((f.facing ?? 1) * s, s);
  ctx.translate(0, -11 - (f.step === undefined ? 0 : Math.abs(Math.cos(f.step))));
  ctx.rotate(f.lean ?? 0);
  const apron = side === 'R' ? P_APRON : M_APRON;
  if (side === 'L') oval(ctx, 1.5, -4.5, 5.5, 5, f.coat);
  box(ctx, -3, -10, 8, 14, apron);
  box(ctx, -1, -13, 4, 3, apron);
  if (side === 'L') oval(ctx, 2, -4.5, 4.5, 4.5, apron);
  // The front arm again, over the apron.
  ctx.save();
  ctx.translate(1, -11);
  ctx.rotate(-(f.arms?.[1] ?? 0));
  box(ctx, -1, 0, 2, 10, f.coat);
  box(ctx, -1, 9, 2, 2, f.skin);
  ctx.restore();
  if (side === 'R') {
    // The long nose and the thin moustache.
    box(ctx, 5, -19, 3, 2, f.skin);
    box(ctx, 7, -18, 1, 1, darker(f.skin));
    box(ctx, 2, -17, 4, 1, '#4A3A30');
  } else {
    // The headscarf, knotted on top.
    box(ctx, -6, -26, 12, 5, M_SCARF);
    box(ctx, -6, -22, 3, 6, M_SCARF);
    box(ctx, -1, -28, 3, 2, M_SCARF);
    box(ctx, -4, -29, 3, 2, M_SCARF);
    box(ctx, 2, -29, 3, 2, M_SCARF);
  }
  ctx.restore();
}

function sellerAt(ctx: Ctx, side: Side, t: number) {
  const st = stance(side, t);
  const f = sellerPose(side, t, st);
  if (st.on === 'ground' || st.on === 'counter')
    oval(ctx, st.x + 9, st.y + 0.5, 11, 1.6, alpha('#6A5440', 0.2));
  sellerArt(ctx, side, st.x, st.y, f);
  const held = summitHeld(side, t);
  if (held) {
    if (side === 'R') tinyOrange(ctx, held.x, held.y, 1);
    else watermelon(ctx, held.x, held.y, 1);
  }
}

// ——— Fruit ———
function tinyOrange(ctx: Ctx, x: number, y: number, s: number) {
  disc(ctx, x, y, 1.9 * s, ORANGE);
  disc(ctx, x - 0.6 * s, y - 0.6 * s, 0.7 * s, ORANGE_HI);
  box(ctx, x - 0.2 * s, y - 2.6 * s, 0.8 * s, 1 * s, '#4A6A2A');
  oval(ctx, x + 1 * s, y - 2.4 * s, 1.2 * s, 0.6 * s, '#5E9C3A', -0.4);
}
function watermelon(ctx: Ctx, x: number, y: number, s: number) {
  oval(ctx, x, y, 11 * s, 7.5 * s, WATER);
  for (const dx of [-6.5, -2, 2.5, 7]) {
    const hh = Math.sqrt(Math.max(0, 1 - (dx / 11) ** 2)) * 7 * s;
    box(ctx, x + dx * s - s, y - hh, 1.6 * s, hh * 2, WATER_ST);
  }
  oval(ctx, x - 4 * s, y - 4 * s, 2.5 * s, 1.2 * s, alpha('#FFFFFF', 0.25), -0.3);
}
function fruit(ctx: Ctx, it: Item, x: number, y: number) {
  switch (it.kind) {
    case 'orange':
      box(ctx, x - 2.5, y - 1.5, 5, 3, ORANGE);
      box(ctx, x - 1.5, y - 2.5, 3, 5, ORANGE);
      if (it.hi) box(ctx, x - 1.5, y - 1.5, 1, 1, ORANGE_HI);
      break;
    case 'melon':
      // A dark rind shows at the bottom and right, so each melon reads on its own.
      box(ctx, x - 4.5, y - 2.5, 9, 5, MELON_ST);
      box(ctx, x - 2.5, y - 3.5, 5, 7, MELON_ST);
      box(ctx, x - 4.5, y - 2.5, 8, 4, MELON);
      box(ctx, x - 2.5, y - 3.5, 4, 6, MELON);
      box(ctx, x - 3.5, y - 0.5, 6, 1, MELON_ST);
      if (it.hi) box(ctx, x - 2.5, y - 2.5, 2, 1, MELON_HI);
      break;
    case 'crate':
      box(ctx, x - 12, y - 6, 24, 12, WOOD);
      box(ctx, x - 12, y - 6, 24, 1, WOOD_L);
      box(ctx, x - 12, y - 1, 24, 1, WOOD_D);
      box(ctx, x - 12, y - 6, 2, 12, WOOD_D);
      box(ctx, x + 10, y - 6, 2, 12, WOOD_D);
      break;
    case 'barrel':
      box(ctx, x - 8, y - 7.5, 16, 15, '#A06A3A');
      box(ctx, x - 9, y - 5.5, 18, 11, '#A06A3A');
      box(ctx, x - 9, y - 4, 18, 1, '#5A4030');
      box(ctx, x - 9, y + 3, 18, 1, '#5A4030');
      box(ctx, x - 5, y - 7.5, 2, 15, '#B98050');
      break;
    case 'tiny':
      tinyOrange(ctx, x, y, 1);
      break;
    case 'water':
      watermelon(ctx, x, y, 1);
      break;
  }
}

/** Where a course is while it is lifted and set down (null until it is in someone's hands). */
function carry(c: Course, t: number) {
  if (t >= c.at) return { dx: 0, dy: -1.2 * Math.sin(Math.PI * span(t, c.at, c.at + 0.14)) };
  if (c.at === PLACE || t < c.at - 0.55) return null;
  const st = perch(c.side, t);
  // A course is held out at arm's length, like a tray; the pyramid's last orange in one hand.
  const toward = Math.sign(TX[c.side] - st.x),
    size = SIZE[c.side];
  const hand =
    c.at === PELL_TOP
      ? handOf(st.x, st.y, sellerPose(c.side, t, st), 'front')
      : {
          x: st.x + toward * ((c.side === 'R' ? 12.5 : 13.5) + 5 * size),
          y: st.y - 24.5 * size,
        };
  const dx0 = hand.x - TX[c.side];
  const dy0 = hand.y - (COUNTER - c.bottom) - (c.at === PELL_TOP ? 3 : -1);
  const a = easeOut(span(t, c.at - 0.3, c.at));
  return { dx: dx0 * (1 - a), dy: dy0 * (1 - a) - 6 * Math.sin(Math.PI * a) };
}

function tower(ctx: Ctx, side: Side, t: number, b: Bounds) {
  for (const c of COURSES) {
    if (c.side !== side) continue;
    const off = carry(c, t);
    if (!off) continue;
    for (const it of c.items) {
      if (it.kind === 'tiny' && t >= HOP) continue;
      const x = TX[side] + it.dx + bend(side, it.h, t) + off.dx;
      const y = COUNTER - it.h + off.dy;
      if (x < b.x0 - 14 || x > b.x1 + 14 || y < b.y0 - 12 || y > b.y1 + 12) continue;
      fruit(ctx, it, x, y);
    }
    // A puff of dust as each course lands.
    const d = span(t, c.at, c.at + 0.3);
    if (c.at > 0 && d > 0 && d < 1) {
      const y = COUNTER - c.bottom,
        x = TX[side] + bend(side, c.bottom, t);
      for (const sd of [-1, 1])
        box(ctx, x + sd * (14 + d * 6), y - 1 - d * 3, 2, 1, alpha(CREAM, 1 - d));
    }
  }
}

function ladders(ctx: Ctx, t: number) {
  // Mags's long ladder, the grandson at its foot.
  if (t >= 16.15) {
    const top = ladderTop('L', t);
    const bow = 3 * ease(span(t, 35.3, 35.9)) * (1 - ease(span(t, PLACE, PLACE + 0.4)));
    rails(ctx, FOOT.L, GROUND, top.x + 1, top.y - 6, bow);
  }
  // Pell's stepladder: a front leg with rungs and a back leg, always reaching his feet.
  if (t >= 15.2) {
    const top = ladderTop('R', t);
    line(ctx, WOOD_D, 2, [top.x + 1, top.y, BACK_FOOT, GROUND]);
    rails(ctx, FOOT.R, GROUND, top.x - 1, top.y, 0);
    box(ctx, top.x - 5, top.y, 10, 2, WOOD);
  }
  // The upturned bucket Mags stood on.
  if (t >= 14.2) {
    box(ctx, STAND.L - 5, COUNTER - 9, 10, 9, '#8C9BA8');
    box(ctx, STAND.L - 6, COUNTER - 10, 12, 2, '#6E7D8A');
  }
}
/** Two rails and their rungs, from a foot on the ground to a top, bowed sideways by `bow`. */
function rails(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, bow: number) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const nx = (-(y1 - y0) / len) * 3.5,
    ny = ((x1 - x0) / len) * 3.5;
  const at = (u: number, sd: number) => {
    const b = 4 * u * (1 - u) * bow * sd;
    return [lerp(x0, x1, u) + nx * sd + b, lerp(y0, y1, u) + ny * sd];
  };
  for (const sd of [-1, 1]) line(ctx, WOOD_D, 1.5, [...at(0, sd), ...at(0.5, sd), ...at(1, sd)]);
  const n = Math.floor(len / 6);
  for (let i = 1; i < n; i++) {
    const [ax, ay] = at(i / n, -1),
      [bx] = at(i / n, 1);
    box(ctx, Math.min(ax, bx), ay, Math.abs(bx - ax), 1, WOOD);
  }
}

// ——— The crowd ———
// prettier-ignore
const FOLK: readonly Figure[] = [
  { skin: '#E9BC98', hair: '#6B4A32', coat: '#7A9BC4', legs: '#3E4256', build: 'adult', hairStyle: 'bob' },
  { skin: '#C68B62', hair: '#2A211C', coat: '#C25A4E', legs: '#4A4038', build: 'adult', hat: 'brim', hatColor: '#E8D7A8' },
  { skin: '#F0C7A6', hair: '#C9A15A', coat: '#7A8FB0', legs: '#3A3E4C', build: 'adult', hairStyle: 'long' },
  { skin: '#A8714E', hair: '#1E1A1A', coat: '#D9A441', legs: '#3D3A48', build: 'adult' },
  { skin: '#E5B08C', hair: '#9A9A9A', coat: '#8A6BA8', legs: '#45404E', build: 'adult', hairStyle: 'bun' },
  { skin: '#D49A73', hair: '#4A3020', coat: '#4F8C8A', legs: '#3A3540', build: 'adult', hat: 'beanie', hatColor: '#D9A441' },
  { skin: '#F2CBB0', hair: '#B5562E', coat: '#E2D2B4', legs: '#5A4A40', build: 'adult', hairStyle: 'long' },
  { skin: '#8E5B3E', hair: '#151215', coat: '#3F5E8C', legs: '#2F3240', build: 'adult' },
  { skin: '#E9BC98', hair: '#3A2A20', coat: '#B86A8A', legs: '#3E3A48', build: 'kid', hairStyle: 'bob' },
  { skin: '#C99070', hair: '#5A3A28', coat: '#9A7A4A', legs: '#3A3540', build: 'adult', hat: 'cap', hatColor: '#4A6A8A' },
  { skin: '#EDC2A0', hair: '#E8E0D0', coat: '#8C7A9E', legs: '#4A4450', build: 'adult', hairStyle: 'bun' },
  { skin: '#B07854', hair: '#2A1E18', coat: '#A9443F', legs: '#3A3540', build: 'adult', hairStyle: 'short' },
];
type Shopper = {
  look: number;
  lane: number;
  /** Arriving and gathering, up to the summits. */
  keys: readonly Key[];
  /** Where they scurry to when the towers lean. */
  hide: number;
  /** Strolling through the arch: when they set off, and where to. */
  cross: number;
  to: number;
  basket: boolean;
};
// prettier-ignore
const SHOPPERS: readonly Shopper[] = [
  // Three early birds, who change stalls twice in a minute.
  { look: 0, lane: 288, keys: [[0, 150], [4.3, 156], [6.0, 192], [9.55, 192], [9.9, 128], [10.6, 98], [13.5, 104], [16.5, 134]], hide: 74, cross: FIRST_STEP, to: 246, basket: true },
  { look: 1, lane: 292, keys: [[0, 176], [4.5, 178], [6.4, 205], [9.6, 205], [9.95, 142], [10.75, 82], [14, 88], [17.2, 150]], hide: 284, cross: 47.3, to: 92, basket: false },
  { look: 2, lane: 285, keys: [[0, 122], [4.7, 124], [6.8, 218], [9.65, 218], [10.0, 156], [10.9, 112], [15, 118], [18, 170]], hide: 298, cross: 47.5, to: 78, basket: true },
  // Everyone else, drawn in as the war builds.
  { look: 3, lane: 295, keys: [[0, -170], [9.5, -170], [14.5, 122]], hide: 60, cross: 47.4, to: 238, basket: true },
  { look: 4, lane: 287, keys: [[0, 490], [10.5, 490], [15.5, 186]], hide: 291, cross: 47.6, to: 88, basket: true },
  { look: 5, lane: 293, keys: [[0, -170], [11.5, -170], [16.8, 146]], hide: 82, cross: 47.2, to: 254, basket: false },
  { look: 6, lane: 289, keys: [[0, 490], [12.5, 490], [17.6, 204]], hide: 306, cross: 47.45, to: 70, basket: true },
  { look: 7, lane: 296, keys: [[0, -170], [13.5, -170], [18.6, 176]], hide: 300, cross: 99, to: 300, basket: false },
  { look: 8, lane: 297, keys: [[0, 490], [14.5, 490], [19.4, 160]], hide: 92, cross: 47.35, to: 236, basket: false },
  { look: 9, lane: 286, keys: [[0, -170], [15.5, -170], [20.6, 138]], hide: 66, cross: 99, to: 66, basket: true },
  { look: 10, lane: 291, keys: [[0, 490], [16.5, 490], [21.5, 192]], hide: 314, cross: 99, to: 314, basket: true },
  { look: 11, lane: 294, keys: [[0, -170], [17.5, -170], [22.5, 112]], hide: 52, cross: 47.25, to: 270, basket: false },
];
/** After the handshake everyone wanders back in under the arch. */
const WANDER = 52.4;
function shopperX(i: number, s: Shopper, t: number) {
  let x = along(t, s.keys);
  const d0 = GASP + 0.15 + (i % 4) * 0.08;
  x = lerp(x, s.hide, ease(span(t, d0, d0 + 1.2)));
  x = lerp(x, s.to, ease(span(t, s.cross, Math.max(s.cross + 2.4, 49.9))));
  const back = WANDER + (i % 4) * 0.2;
  if (t > back) x += (s.to < 160 ? 1 : -1) * (14 + (i % 3) * 4) * (t - back);
  return x;
}
const GRANDSON: Figure = {
  skin: '#E8B48E',
  hair: '#3A2A20',
  coat: '#3F6FB5',
  legs: '#2F3550',
  build: 'kid',
  hat: 'cap',
  hatColor: '#D0443A',
};
const GIRL: Figure = {
  skin: '#C98D66',
  hair: '#2A1E1A',
  coat: '#F2C230',
  legs: '#7A4A5A',
  build: 'kid',
  hairStyle: 'pigtails',
};
const GIRL_X = 266;
const GIRL_LANE = 292;
const CAP_OFF = 21.2;
const CATCH_HAND = handOf(GIRL_X, GIRL_LANE, { ...GIRL, facing: -1, arms: [1.9, 1.9] });

function girlPose(t: number): Figure {
  const k = gaze(t);
  if (t >= GASP + 0.1 && t < HOP)
    return { ...GIRL, facing: -1, arms: [2.6, 2.85], eyes: 'closed', mouth: 'o' };
  if (t >= HOP && t < CATCH + 0.12)
    return { ...GIRL, facing: -1, arms: [1.9, 1.9], eyes: 'wide', mouth: 'o', lean: -0.15 };
  if (t >= CATCH + 0.12) {
    // Caught: she grins and holds it up.
    const walking = t > GIRL_OFF;
    const up = ease(span(t, CATCH + 0.12, CATCH + 0.5));
    return {
      ...GIRL,
      facing: -1,
      arms: [lerp(1.9, 0.3, up), lerp(1.9, 2.3, up)],
      eyes: 'happy',
      mouth: 'grin',
      step: walking ? t * 10 : undefined,
    };
  }
  const moving = t > 15.5 && t < 19.6;
  return {
    ...GIRL,
    facing: -1,
    step: moving ? t * 10 : undefined,
    lean: -0.3 * k,
    eyes: k > 0.35 ? 'wide' : 'open',
    mouth: k > 0.55 ? 'o' : 'smile',
  };
}
const GIRL_OFF = WANDER + 0.3;
const girlX = (t: number) =>
  along(t, [
    [15.5, 490],
    [19.6, GIRL_X],
  ]) - (t > GIRL_OFF ? (t - GIRL_OFF) * 14 : 0);

function crowd(ctx: Ctx, t: number, b: Bounds, front: boolean) {
  const k = gaze(t);
  SHOPPERS.forEach((s, i) => {
    if (s.lane > 290 !== front) return;
    const x = shopperX(i, s, t);
    if (x < b.x0 - 12 || x > b.x1 + 12) return;
    const vel = (shopperX(i, s, t + 0.05) - shopperX(i, s, t - 0.05)) / 0.1;
    const moving = Math.abs(vel) > 4;
    const facing: 1 | -1 = moving ? (vel > 0 ? 1 : -1) : x < 160 ? 1 : -1;
    const base = FOLK[s.look];
    let f: Figure = { ...base, facing, step: moving ? t * 10 + i * 1.7 : undefined };
    const ducking = t >= GASP + 0.1 && t < UNISON;
    if (ducking) f = { ...f, arms: [2.6, 2.85], eyes: 'closed', mouth: 'o', lean: 0.12 };
    else if (t >= UNISON) {
      const awe = t < FIRST_STEP + (i % 5) * 0.5;
      f = {
        ...f,
        lean: awe ? -0.3 : -0.12,
        eyes: awe ? 'wide' : 'happy',
        mouth: awe ? 'o' : 'smile',
      };
    } else
      f = {
        ...f,
        lean: -0.32 * k,
        eyes: k > 0.35 ? 'wide' : 'open',
        mouth: k > 0.55 ? 'o' : 'smile',
      };
    oval(ctx, x + 9, s.lane + 0.5, 11, 1.6, alpha('#6A5440', 0.2));
    person(ctx, x, s.lane, f);
    if (s.basket && !ducking) {
      const hand = handOf(x, s.lane, f, 'back');
      box(ctx, hand.x - 3, hand.y, 6, 4, '#B8894E');
      box(ctx, hand.x - 3, hand.y, 6, 1, '#8A6236');
    }
  });
  if (front) {
    // The grandson: at the foot of Mags's ladder from the moment it goes up.
    // He steps aside as Grandma slides down.
    const gx =
      t < 16.15
        ? 28
        : along(t, [
            [49.0, FOOT.L + 7],
            [49.7, 108],
          ]);
    const holding = t >= 16.15;
    const ducking = t >= GASP && t < UNISON;
    const g: Figure = {
      ...GRANDSON,
      facing: holding && t < 49.0 ? -1 : 1,
      hat: t < CAP_OFF ? 'cap' : 'none',
      arms: holding && t < 49.0 ? [1.35, 1.55] : [0.2, 0.3],
      step: t > 49.0 && t < 49.7 ? t * 12 : undefined,
      lean: holding && !ducking ? -0.3 * k : 0,
      eyes: ducking ? 'closed' : k > 0.35 ? 'wide' : 'open',
      mouth: k > 0.55 ? 'o' : 'smile',
    };
    oval(ctx, gx + 7, 291.5, 8, 1.4, alpha('#6A5440', 0.2));
    person(ctx, gx, 291, g);
    if (t >= CAP_OFF + 0.4) {
      // His cap, where it fell.
      box(ctx, FOOT.L + 13, 289, 6, 2, '#D0443A');
      box(ctx, FOOT.L + 18, 290, 3, 1, darker('#D0443A'));
    }
    // The girl in the yellow coat.
    const yx = girlX(t);
    if (yx < b.x1 + 12) {
      const f = girlPose(t);
      oval(ctx, yx + 7, GIRL_LANE + 0.5, 8, 1.4, alpha('#6A5440', 0.2));
      person(ctx, yx, GIRL_LANE, f);
      if (t >= CATCH) {
        const hand = handOf(yx, GIRL_LANE, f, 'front');
        tinyOrange(ctx, hand.x, hand.y - 1.5, 1);
      }
    }
  }
}

// ——— The sparrow and the orange that rolls ———
function sparrow(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  facing: number,
  flap: number,
  look = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * s, s);
  poly(ctx, '#6B4A30', [-2.5, -0.5, -7, -3, -7.2, -1, -2.5, 1.5]);
  oval(ctx, 0, 0, 3.8, 3, '#8A5E3A');
  oval(ctx, 0.9, 1, 2.6, 1.9, '#F1E2C4');
  disc(ctx, 2.6 + look * 0.3, -2.6, 2.2, '#8A5E3A');
  box(ctx, 1.8, -4.8, 2.6, 1.2, '#6B4A30');
  disc(ctx, 3.3 + look * 0.8, -2.9, 0.6, '#141014');
  poly(ctx, '#E0A040', [4.6, -2.9, 6.6, -2.2, 4.6, -1.6]);
  if (flap > 0)
    poly(ctx, '#6B4A30', [
      -1.5,
      -1,
      1.5,
      -1,
      -1 + Math.cos(flap * 6) * 1.5,
      -4 - Math.sin(flap * 6) * 3,
    ]);
  else oval(ctx, -0.7, -0.4, 2.6, 1.5, '#6B4A30', 0.25);
  box(ctx, -0.2, 2.6, 0.6, 1.6, '#5A4030');
  box(ctx, 1.2, 2.6, 0.6, 1.6, '#5A4030');
  ctx.restore();
}
function sparrowAt(t: number) {
  if (t < SPARROW - 0.5) return null;
  const tx = TX.R + bend('R', TINY_H, t),
    ty = COUNTER - TINY_H - 5.5;
  if (t < SPARROW) {
    const u = easeOut(span(t, SPARROW - 0.5, SPARROW));
    return {
      x: lerp(tx - 46, tx, u),
      y: lerp(ty - 30, ty, u) - Math.sin(u * Math.PI) * 4,
      facing: 1,
      flap: t,
    };
  }
  if (t < HOP) return { x: tx, y: ty, facing: t < 39.3 ? 1 : -1, flap: 0 };
  const wx = TX.L + bend('L', WATER_H, t),
    wy = COUNTER - WATER_H - 10.5;
  if (t < HOP + 0.25) {
    const u = span(t, HOP, HOP + 0.25);
    return { x: lerp(tx, wx, u), y: lerp(ty, wy, u) - 4 * u * (1 - u) * 8, facing: -1, flap: 0 };
  }
  return { x: wx, y: wy, facing: t % 4 < 2 ? 1 : -1, flap: 0 };
}

/** The roll: from the summit, five bounces down the arch, into the girl's hands. */
const ROLL: readonly (readonly [number, number, number])[] = (() => {
  const edge = (h: number) => TX.R - REACH * (h / HREF) ** 2 + 12.5 + 2.5;
  const out: [number, number, number][] = [
    [HOP, TX.R - REACH * (TINY_H / HREF) ** 2, COUNTER - TINY_H],
  ];
  [176, 160, 136, 104].forEach((h, i) => out.push([BOUNCES[i], edge(h), COUNTER - h - 2.5]));
  out.push([BOUNCES[4], 258, 219.5]);
  out.push([CATCH, CATCH_HAND.x, CATCH_HAND.y - 1.5]);
  return out;
})();
const HOPS = [2, 6, 5, 4, 3, 9] as const;
function rollAt(t: number, arcs = true) {
  for (let i = 0; i < ROLL.length - 1; i++) {
    const [a, ax, ay] = ROLL[i],
      [b, bx, by] = ROLL[i + 1];
    if (t < b) {
      const u = span(t, a, b);
      return {
        x: lerp(ax, bx, u),
        y: lerp(ay, by, u) - (arcs ? HOPS[i] * 4 * u * (1 - u) : 0),
      };
    }
  }
  const last = ROLL[ROLL.length - 1];
  return { x: last[1], y: last[2] };
}

// ——— The capsule on the glass line ———
function capsuleAt(t: number) {
  if (t < 2.4) return 40 + t * 190;
  if (t >= 26.8 && t < 28.8) {
    if (t < CRAWL[0]) return lerp(-70, 128, easeOut(span(t, 26.8, CRAWL[0])));
    if (t < CRAWL[1]) return lerp(128, 176, span(t, CRAWL[0], CRAWL[1]));
    return lerp(176, 380, easeIn(span(t, CRAWL[1], CAPSULE[1])));
  }
  if (t >= 52.4) return 470 - (t - 52.4) * 210;
  return null;
}
const PASSENGERS = [
  { skin: '#E9BC98', hair: '#6B4A32', coat: '#5A7AA8' },
  { skin: '#A8714E', hair: '#1E1A1A', coat: '#B05A4A' },
  { skin: '#F2CBB0', hair: '#B5562E', coat: '#6E8A5A' },
] as const;
function capsule(ctx: Ctx, x: number) {
  const y = tubeY(x);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan((60 * (x - 160)) / 260 ** 2));
  box(ctx, -17, -5, 34, 10, CAPSULE_C);
  disc(ctx, -17, 0, 5, CAPSULE_C);
  disc(ctx, 17, 0, 5, CAPSULE_C);
  box(ctx, -17, 3, 34, 2, '#B9C6CF');
  box(ctx, -14, -3, 28, 5, '#33424F');
  PASSENGERS.forEach((p, i) => {
    const fx = -9 + i * 9;
    disc(ctx, fx, -0.3, 2.3, p.skin);
    box(ctx, fx - 2, -3, 4, 1.4, p.hair);
    box(ctx, fx - 1.5, -1, 1, 1, '#FFFFFF');
    box(ctx, fx + 0.5, -1, 1, 1, '#FFFFFF');
  });
  ctx.restore();
}

// ——— The world ———
const HOUSES: readonly (readonly [number, number, number, number])[] = Array.from(
  { length: 15 },
  (_, i) => [
    -140 + i * 41 + rand(i * 3.3) * 14,
    18 + rand(i * 5.1) * 16,
    10 + rand(i * 2.7) * 12,
    i,
  ],
);
function skyScreen(ctx: Ctx, v: View) {
  const b = Math.round((150 - v.y) * v.zoom + H / 2);
  box(ctx, 0, 0, W, H, SKY_HI);
  if (b > H + 2) return;
  box(ctx, 0, Math.max(0, b), W, H - Math.max(0, b), SKY_LO);
  if (b < -2) return;
  for (let x = 0; x < W; x += 4) {
    box(ctx, x, b - 2, 2, 1, SKY_LO);
    box(ctx, x + 2, b - 1, 2, 1, SKY_LO);
    box(ctx, x, b, 2, 1, SKY_HI);
    box(ctx, x + 2, b + 1, 1, 1, SKY_HI);
  }
}
function backdrop(ctx: Ctx, t: number, seconds: number, b: Bounds) {
  const x0 = Math.max(-140, b.x0 - 4),
    x1 = Math.min(460, b.x1 + 4),
    w = x1 - x0;
  if (b.y1 > 150) glow(ctx, 0, 226, 170, SUN, 0.55);
  if (b.y1 > 212) {
    // The far bank: roofs and trees across the river.
    for (const [hx, hw, hh, i] of HOUSES) {
      if (hx + hw < b.x0 || hx > b.x1) continue;
      box(ctx, hx, 251 - hh, hw, hh, i % 2 ? FAR : FAR_D);
      box(ctx, hx - 1, 249 - hh, hw + 2, 3, '#8A8FA6');
      box(ctx, hx + hw / 2 - 1, 255 - hh, 2, 3, '#C9D0DA');
    }
    for (let i = 0; i < 8; i++) {
      const tx = -120 + i * 76 + rand(i * 9.1) * 30;
      if (tx < b.x0 - 12 || tx > b.x1 + 12) continue;
      oval(ctx, tx, 244, 9, 8, '#9DB2A6');
    }
  }
  clockTower(ctx, t, b);
  if (b.y1 > 248) {
    box(ctx, x0, 249, w, 15, RIVER);
    for (let i = 0; i < 16; i++) {
      const gx = -130 + ((rand(i * 4.7) * 580 + seconds * (4 + rand(i) * 5)) % 580);
      if (gx < b.x0 || gx > b.x1) continue;
      if (Math.sin(seconds * 2.2 + i * 1.9) > 0.1)
        box(ctx, gx, 252 + rand(i * 2.9) * 9, 3, 1, alpha('#FFFFFF', 0.75));
    }
    box(ctx, x0, 263, w, 40, COBBLE);
    box(ctx, x0, 263, w, 2, '#A89070');
    for (let i = 0; i < 26; i++) {
      const cx = -130 + rand(i * 6.1) * 580,
        cy = 268 + rand(i * 8.3) * 30;
      if (cx < b.x0 || cx > b.x1) continue;
      box(ctx, cx, cy, 5, 1, COBBLE_D);
    }
  }
  tube(ctx, t, b);
}
function clockTower(ctx: Ctx, t: number, b: Bounds) {
  if (b.x1 < 140 || b.x0 > 180 || b.y1 < 96 || b.y0 > 252) return;
  // Across the river, so a little hazy: a squat spire, well clear of the arch's crown.
  box(ctx, 147, 116, 26, 136, '#DEC9A8');
  box(ctx, 165, 116, 8, 136, '#CDB492');
  poly(ctx, SPIRE, [146, 117, 160, 101, 174, 117]);
  poly(ctx, SPIRE_D, [160, 101, 174, 117, 166, 117]);
  box(ctx, 159, 96, 2, 6, SPIRE_D);
  disc(ctx, 160, 96, 1.6, SPIRE_D);
  box(ctx, 144, 115, 32, 3, '#C4AA86');
  // The belfry: three tall louvred openings and a cornice, so it reads as a tower at any crop.
  for (const lx of [150.5, 158.5, 166.5]) {
    box(ctx, lx, 121, 3, 15, '#9C8166');
    disc(ctx, lx + 1.5, 121, 1.5, '#9C8166');
  }
  box(ctx, 145, 138, 30, 2, '#C4AA86');
  box(ctx, 153, 182, 14, 28, '#CDB492');
  box(ctx, 156, 185, 8, 22, '#A88E72');
  const { x, y, r } = CLOCK;
  disc(ctx, x, y, r + 1.5, '#7C5E48');
  disc(ctx, x, y, r, '#FFF6E2');
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4;
    box(ctx, x + Math.cos(a) * (r - 2.5) - 1, y + Math.sin(a) * (r - 2.5) - 1, 2, 2, INK);
  }
  // Eight o'clock at the first frame, nine at the last: the hands run on story time.
  const p = clamp(t / STORY);
  const m = p * TAU - Math.PI / 2,
    h = ((8 + p) / 12) * TAU - Math.PI / 2;
  line(ctx, INK, 1.4, [x, y, x + Math.cos(h) * 6, y + Math.sin(h) * 6]);
  line(ctx, INK, 1, [x, y, x + Math.cos(m) * 9.5, y + Math.sin(m) * 9.5]);
  disc(ctx, x, y, 1.2, INK);
}
function tube(ctx: Ctx, t: number, b: Bounds) {
  if (b.y0 > 86) return;
  for (const px of [-70, 390]) {
    if (px < b.x0 - 10 || px > b.x1 + 10) continue;
    const py = tubeY(px);
    box(ctx, px - 2, py, 5, GROUND - py, '#A7B0B9');
    box(ctx, px - 4, py + 6, 9, 3, '#8E98A2');
    box(ctx, px - 6, GROUND - 4, 13, 4, '#8E98A2');
  }
  const pts: number[] = [];
  const xa = Math.max(-150, Math.floor((b.x0 - 20) / 20) * 20),
    xb = Math.min(470, b.x1 + 20);
  for (let x = xa; x <= xb + 0.1; x += 20) pts.push(x, tubeY(x));
  const shift = (d: number) => pts.map((v, i) => (i % 2 ? v + d : v));
  line(ctx, alpha(GLASS, 0.55), TUBE_R * 2, pts);
  const cx = capsuleAt(t);
  if (cx !== null && cx > b.x0 - 30 && cx < b.x1 + 30) capsule(ctx, cx);
  line(ctx, alpha('#8FB2C0', 0.9), 1, shift(-TUBE_R));
  line(ctx, alpha('#8FB2C0', 0.9), 1, shift(TUBE_R));
  line(ctx, alpha('#FFFFFF', 0.8), 1.5, shift(-TUBE_R + 2.5));
  for (const rx of [-40, 40, 280, 360])
    if (rx > b.x0 - 4 && rx < b.x1 + 4) box(ctx, rx - 1.5, tubeY(rx) - 8, 3, 16, '#B4C2CC');
}
const STALL = { L: { x0: 38, colour: M_APRON }, R: { x0: 193, colour: P_APRON } } as const;
const STALL_W = 89;
function stallBack(ctx: Ctx, side: Side) {
  const { x0, colour } = STALL[side];
  const inner = side === 'L' ? x0 + STALL_W - 6 : x0 + 3,
    outer = side === 'L' ? x0 + 3 : x0 + STALL_W - 6;
  box(ctx, x0 + 5, 238, STALL_W - 10, 24, mix(colour, '#3A3020', 0.55));
  box(ctx, outer, 222, 3, 68, WOOD_D);
  box(ctx, inner, 193, 3, 97, WOOD_D);
  box(ctx, inner - 1, 192, 5, 2, WOOD_D);
  box(ctx, x0, 220, STALL_W, 3, darker(colour));
  box(ctx, x0, 222, STALL_W, 14, colour);
  for (let i = 0; i < STALL_W - 6; i += 12) box(ctx, x0 + i + 6, 222, 6, 14, CREAM);
  for (let i = 0; i < STALL_W - 1; i += 6)
    box(ctx, x0 + i, 236, 5, 2, (i / 6) % 2 ? CREAM : colour);
}
function counterFront(ctx: Ctx, side: Side) {
  const { x0, colour } = STALL[side];
  box(ctx, x0 + 6, 262, STALL_W - 12, 28, WOOD);
  box(ctx, x0 + 4, 261, STALL_W - 8, 2, WOOD_L);
  box(ctx, x0 + 6, 271, STALL_W - 12, 1, WOOD_D);
  box(ctx, x0 + 6, 280, STALL_W - 12, 1, WOOD_D);
  box(ctx, x0 + 6, 286, STALL_W - 12, 4, darker(WOOD));
  // A cloth flap in the stall's colour.
  box(ctx, x0 + 20, 263, STALL_W - 40, 6, colour);
}
function bunting(ctx: Ctx, t: number, seconds: number, b: Bounds) {
  if (b.y0 > 214 || b.y1 < 186) return;
  const xa = 124,
    xb = 197,
    sag = (u: number) => 195 + 9 * Math.sin(Math.PI * u);
  const wind = 0.7 + 1.5 * presence(t, STANDOFF - 0.5, PLACE + 0.5, 0.6);
  const rope: number[] = [];
  for (let i = 0; i <= 8; i++) rope.push(lerp(xa, xb, i / 8), sag(i / 8));
  line(ctx, '#6B5440', 1, rope);
  for (let i = 0; i < 9; i++) {
    const u = (i + 0.5) / 9,
      x = lerp(xa, xb, u),
      y = sag(u);
    const f = Math.sin(seconds * 4.5 + i * 1.7) * wind * 1.6;
    poly(ctx, FLAGS[i % 3], [x - 3, y, x + 3, y, x + f, y + 7 - Math.abs(f) * 0.3]);
  }
}

function world(ctx: Ctx, t: number, seconds: number, v: View) {
  const b = boundsOf(v);
  backdrop(ctx, t, seconds, b);
  for (const side of SIDES) stallBack(ctx, side);
  bunting(ctx, t, seconds, b);
  for (const side of SIDES) if (stance(side, t).on === 'behind') sellerAt(ctx, side, t);
  for (const side of SIDES) counterFront(ctx, side);
  for (const side of SIDES) tower(ctx, side, t, b);
  ladders(ctx, t);
  for (const side of SIDES) {
    const on = stance(side, t).on;
    if (on !== 'behind' && on !== 'ground') sellerAt(ctx, side, t);
  }
  crowd(ctx, t, b, false);
  for (const side of SIDES) if (stance(side, t).on === 'ground') sellerAt(ctx, side, t);
  crowd(ctx, t, b, true);
  if (t >= HOP && t < CATCH) {
    const o = rollAt(t);
    tinyOrange(ctx, o.x, o.y, 1);
  }
  const bird = sparrowAt(t);
  if (bird) sparrow(ctx, bird.x, bird.y, 1, bird.facing, bird.flap);
}

function scene(ctx: Ctx, t: number, seconds: number, view: View) {
  const v = clampView(view);
  skyScreen(ctx, v);
  camera(ctx, v, () => world(ctx, t, seconds, v), null);
}
type ShotFn = (ctx: Ctx, t: number, seconds: number) => void;
const eased =
  (keys: readonly CamKey[]): ShotFn =>
  (ctx, t, seconds) =>
    scene(ctx, t, seconds, track(t, keys));
const steady =
  (keys: readonly CamKey[]): ShotFn =>
  (ctx, t, seconds) =>
    scene(ctx, t, seconds, glide(t, keys));

// ——— Close-ups: the two sellers, drawn large ———
type Face = {
  /** 1 open, about 0.3 a narrowed glare, 0 shut. */
  eyes?: number;
  wide?: boolean;
  look?: readonly [number, number];
  /** −1 a scowl, +1 raised in surprise. */
  brow?: number;
  mouth?: 'flat' | 'frown' | 'smirk' | 'o' | 'purse' | 'smile' | 'strain';
  flare?: number;
  puff?: number;
  sweat?: number;
};
const P_SKIN = '#E8B48E',
  P_SKIN_D = '#C98E6A',
  P_HAIR = '#4A3A30',
  P_CAP = '#8C8E94',
  P_CAP_D = '#6E7076',
  SHIRT = '#F3EFE6',
  SHIRT_D = '#D6D0C4';
const M_SKIN = '#D99B74',
  M_SKIN_D = '#B97C58',
  M_CHEEK = '#E57C70',
  M_CARDI = '#8E4F6A',
  M_CARDI_D = '#6E3A52',
  M_SCARF_D = '#215C35';
function eye(ctx: Ctx, ex: number, ey: number, f: Face, skin: string, size = 1) {
  const o = f.eyes ?? 1;
  if (o < 0.1) {
    line(ctx, INK, 1.2, [ex - 3.2 * size, ey + 0.4, ex, ey + 1.2, ex + 3.2 * size, ey + 0.4]);
    return;
  }
  const wide = f.wide ? 1.25 : 1;
  const ry = 2.7 * o * wide * size,
    rx = 3.2 * wide * size;
  const [lx, ly] = f.look ?? [0, 0];
  oval(ctx, ex, ey, rx, ry, '#FAF6EE');
  disc(ctx, ex + lx * 1.4, ey + ly * Math.min(1, ry), Math.min(1.7 * size, ry + 0.2), INK);
  if (o > 0.6) disc(ctx, ex + lx * 1.4 - 0.6, ey - 0.6, 0.5, '#FFFFFF');
  // Wide eyes have no lid showing; on a glare the lid presses down.
  if (f.wide) return;
  poly(ctx, skin, [
    ex - rx - 0.5,
    ey - ry - 2,
    ex + rx + 0.5,
    ey - ry - 2,
    ex + rx + 0.5,
    ey - ry + 0.6,
    ex - rx - 0.5,
    ey - ry + 0.6,
  ]);
  line(ctx, INK, 1, [ex - rx, ey - ry + 0.6, ex + rx, ey - ry + 0.6]);
}
/** Pell from the chest up, drawn facing right; `facing` −1 mirrors him. (x, y) is the head. */
function pellBust(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  facing: number,
  f: Face,
  extra?: () => void,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * s, s);
  poly(ctx, SHIRT, [-27, 60, -24, 27, -9, 18, 9, 18, 23, 27, 26, 60]);
  poly(ctx, SHIRT_D, [-27, 60, -24, 27, -15, 22, -15, 60]);
  poly(ctx, P_APRON, [-8, 60, -7, 28, 9, 28, 10, 60]);
  line(ctx, darker(P_APRON, 0.2), 1.6, [-7, 28, -5, 18]);
  line(ctx, darker(P_APRON, 0.2), 1.6, [9, 28, 7, 18]);
  box(ctx, -5, 9, 10, 10, P_SKIN_D);
  poly(ctx, '#FFFFFF', [-7, 17, 0, 23, 7, 17, 5, 14, -5, 14]);
  oval(ctx, -9, 2, 3, 4.5, P_SKIN);
  oval(ctx, -9, 2, 1.4, 2.4, P_SKIN_D);
  oval(ctx, 1, 0, 11, 16, P_SKIN);
  oval(ctx, -6.5, 3, 4, 11, alpha(P_SKIN_D, 0.55));
  box(ctx, -11, -8, 4, 9, P_HAIR);
  // The long nose, under the eyes so it never covers them.
  poly(ctx, P_SKIN, [7, -5, 18.5, 6, 16.5, 8.5, 9, 8]);
  line(ctx, P_SKIN_D, 1, [10, 8.3, 16.5, 8.3]);
  // Eyes: the far one a little smaller.
  eye(ctx, -0.5, -2, f, P_SKIN, 0.85);
  eye(ctx, 7.5, -2, f, P_SKIN);
  const brow = f.brow ?? 0,
    scowl = Math.max(0, -brow);
  line(ctx, P_HAIR, 1.6, [4, -6.5 - brow * 1.5 + scowl * 1.6, 11, -6.8 - brow * 1.3 - scowl * 1.2]);
  line(ctx, P_HAIR, 1.4, [-4, -6.3 - brow * 1.3 - scowl * 1.2, 2, -6.5 - brow * 1.5 + scowl * 1.6]);
  // The nostrils, which flare.
  const flare = f.flare ?? 0;
  disc(ctx, 14.3, 7.9, 0.6 + flare * 1.1, INK);
  disc(ctx, 11.2, 8.1, 0.5 + flare * 0.9, INK);
  line(ctx, P_HAIR, 1.4, [4.5, 11.2, 9, 10.4, 14, 11]);
  const mouth = f.mouth ?? 'flat';
  if (mouth === 'flat') line(ctx, INK, 1, [6, 14, 12, 14]);
  else if (mouth === 'frown') line(ctx, INK, 1, [6, 15, 9, 13.8, 12, 15]);
  else if (mouth === 'smirk') line(ctx, INK, 1, [6, 14.2, 10, 14, 13, 12.8]);
  else if (mouth === 'smile') line(ctx, INK, 1, [6, 13.4, 9, 14.6, 12.5, 13.4]);
  else if (mouth === 'o') oval(ctx, 9, 14.5, 1.8, 2.4, '#5A2A2A');
  else line(ctx, INK, 1.2, [5.5, 14.4, 12.5, 14.4]);
  // The flat cap.
  poly(
    ctx,
    P_CAP,
    [-12.5, -7, -12, -14, -6, -19.5, 4, -20.5, 11, -17.5, 13.5, -11, 22, -9.2, 22, -7],
  );
  box(ctx, -12.5, -8, 26, 2, P_CAP_D);
  line(ctx, alpha('#FFFFFF', 0.25), 1, [-6, -17.5, 5, -18.5]);
  if ((f.sweat ?? 0) > 0) oval(ctx, -3, -5 + (f.sweat ?? 0) * 6, 0.9, 1.4, '#DDF2FA');
  extra?.();
  ctx.restore();
}
/** Mags from the chest up, drawn facing right. (x, y) is the head. */
function magsBust(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  facing: number,
  f: Face,
  extra?: () => void,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * s, s);
  poly(ctx, M_CARDI, [-28, 60, -25, 25, -10, 16, 10, 16, 25, 25, 28, 60]);
  poly(ctx, M_CARDI_D, [-28, 60, -25, 25, -16, 20, -16, 60]);
  poly(ctx, M_APRON, [-9, 60, -8, 26, 10, 26, 11, 60]);
  line(ctx, darker(M_APRON, 0.2), 1.6, [-8, 26, -6, 16]);
  line(ctx, darker(M_APRON, 0.2), 1.6, [10, 26, 8, 16]);
  oval(ctx, -1, -3, 17, 15.5, M_SCARF);
  oval(ctx, 2, 3, 13.2, 12.6, M_SKIN);
  oval(ctx, -6, 5, 4, 8, alpha(M_SKIN_D, 0.5));
  poly(
    ctx,
    M_SCARF,
    [-13, -1, -9, -11, 0, -15, 10, -13.5, 15, -6, 14.5, -3.5, 6, -7, -4, -7.5, -11, 0],
  );
  line(ctx, alpha('#FFFFFF', 0.18), 1, [-5, -11, 6, -12]);
  oval(ctx, -5.5, -18.5, 4.8, 3, M_SCARF, -0.5);
  oval(ctx, 6.5, -18.5, 4.8, 3, M_SCARF, 0.5);
  disc(ctx, 0.5, -16, 2.8, M_SCARF_D);
  const puff = f.puff ?? 0;
  oval(ctx, -3, 8, 3.6 + puff, 2.5 + puff * 0.7, alpha(M_CHEEK, 0.75));
  oval(ctx, 11, 8, 3.6 + puff, 2.5 + puff * 0.7, alpha(M_CHEEK, 0.75));
  eye(ctx, -0.5, 1.5, f, M_SKIN, 0.9);
  eye(ctx, 8.5, 1.5, f, M_SKIN);
  const brow = f.brow ?? 0,
    scowl = Math.max(0, -brow);
  line(ctx, '#4A3020', 1.5, [5.5, -3 - brow * 1.4 + scowl * 1.4, 11.5, -3.2 - brow * 1.2 - scowl]);
  line(ctx, '#4A3020', 1.3, [-3.5, -3.1 - brow * 1.2 - scowl, 1.5, -3 - brow * 1.4 + scowl * 1.4]);
  disc(ctx, 12.5, 5.5, 2.3, M_SKIN_D);
  disc(ctx, 12, 5, 1.6, M_SKIN);
  const mouth = f.mouth ?? 'purse';
  if (mouth === 'purse') {
    disc(ctx, 8, 11, 1.9, '#B8505A');
    disc(ctx, 8, 11, 0.8, '#5A2A2A');
  } else if (mouth === 'o') oval(ctx, 8, 11.5, 2, 2.6, '#5A2A2A');
  else if (mouth === 'strain') {
    box(ctx, 4.5, 10.5, 7, 2, '#5A2A2A');
    box(ctx, 5, 10.5, 6, 1, '#FFFFFF');
  } else if (mouth === 'smirk') line(ctx, INK, 1, [5, 11.5, 8, 11.3, 11, 10]);
  else if (mouth === 'smile') line(ctx, INK, 1, [5, 10.5, 8, 12, 11, 10.5]);
  else if (mouth === 'frown') line(ctx, INK, 1, [5, 12, 8, 10.8, 11, 12]);
  else line(ctx, INK, 1, [5, 11, 11, 11]);
  if ((f.sweat ?? 0) > 0) oval(ctx, -6, -2 + (f.sweat ?? 0) * 6, 0.9, 1.4, '#DDF2FA');
  extra?.();
  ctx.restore();
}

/** A soft, out-of-focus stall far behind a close-up. */
function farStall(ctx: Ctx, x: number, y: number, s: number, colour: string, fruitC: string) {
  box(ctx, x - 26 * s, y, 52 * s, 7 * s, mix(colour, SKY_LO, 0.35));
  for (let i = -26; i < 26; i += 10)
    box(ctx, x + (i + 5) * s, y, 5 * s, 7 * s, mix(CREAM, SKY_LO, 0.35));
  box(ctx, x - 22 * s, y + 7 * s, 2 * s, 24 * s, mix(WOOD_D, SKY_LO, 0.4));
  box(ctx, x + 20 * s, y + 7 * s, 2 * s, 24 * s, mix(WOOD_D, SKY_LO, 0.4));
  box(ctx, x - 22 * s, y + 20 * s, 44 * s, 14 * s, mix(WOOD, SKY_LO, 0.35));
  for (let i = 0; i < 4; i++)
    disc(
      ctx,
      x + (i - 1.5) * 5 * s,
      y + 18 * s - (i % 2) * 2 * s,
      2.6 * s,
      mix(fruitC, SKY_LO, 0.3),
    );
}
function softBackground(ctx: Ctx, split = 108) {
  box(ctx, 0, 0, W, H, SKY_LO);
  box(ctx, 0, 0, W, split - 40, mix(SKY_HI, SKY_LO, 0.35));
  box(ctx, 0, split, W, H - split, mix(COBBLE, SKY_LO, 0.25));
  box(ctx, 0, split - 14, W, 14, mix(RIVER, SKY_LO, 0.35));
}
function blurPerson(ctx: Ctx, x: number, y: number, coat: string, skin: string, s = 1) {
  oval(ctx, x, y, 7 * s, 12 * s, mix(coat, SKY_LO, 0.35));
  disc(ctx, x, y - 15 * s, 5.5 * s, mix(skin, SKY_LO, 0.3));
}

/** 8.0–9.2: Mags, left of frame, watches her customers cross the aisle. */
const cuMags: ShotFn = (ctx, t) => {
  softBackground(ctx);
  farStall(ctx, 236, 58, 1.2, P_APRON, ORANGE);
  for (let i = 0; i < 3; i++) blurPerson(ctx, 206 + i * 22, 120, FOLK[i].coat, FOLK[i].skin, 1.1);
  // Her own awning, close and out of focus, above her.
  box(ctx, 0, 0, W, 16, M_APRON);
  for (let i = 0; i < W; i += 24) box(ctx, i + 12, 0, 12, 16, CREAM);
  box(ctx, 0, 16, W, 2, darker(M_APRON));
  const narrow = ease(span(t, 8.3, 8.75));
  magsBust(ctx, 92, 96, lerp(2.6, 2.75, span(t, 8, 9.2)), 1, {
    eyes: lerp(1, 0.28, narrow),
    look: [1.2, 0],
    brow: -narrow,
    mouth: narrow > 0.5 ? 'purse' : 'flat',
  });
};
/** 10.0–10.6: Pell, right of frame: the shoppers have gone back across. Nostrils. */
const cuPell: ShotFn = (ctx, t) => {
  softBackground(ctx);
  farStall(ctx, 84, 58, 1.2, M_APRON, MELON);
  for (let i = 0; i < 3; i++) blurPerson(ctx, 56 + i * 22, 120, FOLK[i].coat, FOLK[i].skin, 1.1);
  box(ctx, 0, 0, W, 16, P_APRON);
  for (let i = 0; i < W; i += 24) box(ctx, i + 12, 0, 12, 16, CREAM);
  box(ctx, 0, 16, W, 2, darker(P_APRON));
  const flare = ease(span(t, 10.12, 10.28)) * (1 - 0.4 * ease(span(t, 10.4, 10.55)));
  pellBust(ctx, 228, 92, lerp(2.6, 2.7, span(t, 10, 10.6)), -1, {
    eyes: 0.32,
    look: [1, 0],
    brow: -1,
    mouth: 'frown',
    flare,
  });
};

// ——— Faces in the crowd, tipped back ———
type Gawk = { skin: string; hair: string; coat: string; hat?: string; pigtails?: boolean };
function gawker(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  g: Gawk,
  tilt: number,
  open: number,
  cover = 0,
  hat: { dx: number; dy: number; rot: number } | null = null,
) {
  const skinD = mix(g.skin, '#4A2E24', 0.25);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  poly(ctx, g.coat, [-19, 34, -17, 9, -7, 3, 7, 3, 17, 9, 19, 34]);
  const hy = -17 - tilt * 2;
  box(ctx, -4.5, hy + 6, 9, 4 - hy, skinD);
  oval(ctx, 0, hy + 9, 8.5, 3 + tilt * 3, skinD);
  if (g.pigtails) {
    oval(ctx, -13, hy - 1, 3, 5, g.hair);
    oval(ctx, 13, hy - 1, 3, 5, g.hair);
  }
  oval(ctx, -11.5, hy + 1 - tilt * 2, 2, 3, g.skin);
  oval(ctx, 11.5, hy + 1 - tilt * 2, 2, 3, g.skin);
  oval(ctx, 0, hy, 11.5, 12.5, g.skin);
  oval(ctx, 0, hy - 9 - tilt * 3, 11.5, 6 - tilt * 2.5, g.hair);
  const ey = hy - 1 - tilt * 4.5;
  for (const sd of [-1, 1]) {
    oval(ctx, sd * 4.5, ey, 2.4, 2.3, '#FAF6EE');
    disc(ctx, sd * 4.5, ey - 0.9, 1.2, INK);
    box(ctx, sd * 4.5 - 2, ey - 4.5, 4, 1, g.hair);
  }
  if (tilt > 0.3) {
    box(ctx, -2, hy + 3.5 - tilt * 2.5, 1, 1, skinD);
    box(ctx, 1, hy + 3.5 - tilt * 2.5, 1, 1, skinD);
  }
  oval(ctx, 0, hy + 7.5 - tilt * 2.5, 1.8 + open * 1.4, 0.8 + open * 2.6, '#5A2A2A');
  if (g.hat && hat) {
    ctx.save();
    ctx.translate(hat.dx, hy - 11 - tilt * 3 + hat.dy);
    ctx.rotate(hat.rot);
    oval(ctx, 0, 0, 12, 5, g.hat);
    box(ctx, -2, 2, 13, 2.5, darker(g.hat));
    ctx.restore();
  }
  if (cover > 0)
    for (const sd of [-1, 1]) {
      const hx = sd * lerp(16, 6, cover),
        hyy = lerp(10, hy - 12, cover);
      line(ctx, g.coat, 5, [
        sd * 15,
        14,
        sd * lerp(17, 14, cover),
        lerp(8, -6, cover),
        hx,
        hyy + 2,
      ]);
      oval(ctx, hx, hyy, 3.6, 2.8, g.skin);
    }
  ctx.restore();
}
const GAWKS: readonly Gawk[] = [
  { skin: FOLK[0].skin, hair: FOLK[0].hair, coat: FOLK[0].coat },
  { skin: FOLK[3].skin, hair: FOLK[3].hair, coat: FOLK[3].coat },
  { skin: GRANDSON.skin, hair: GRANDSON.hair, coat: GRANDSON.coat, hat: '#D0443A' },
  { skin: GIRL.skin, hair: GIRL.hair, coat: GIRL.coat, pigtails: true },
  { skin: FOLK[10].skin, hair: FOLK[10].hair, coat: FOLK[10].coat },
  // Only the grandson's cap is red, so the cap gag has the frame to itself.
  { skin: FOLK[5].skin, hair: FOLK[5].hair, coat: FOLK[5].coat, hat: FOLK[5].hatColor },
];
/** A column of fruit rising out of the top of a close-up. */
function column(ctx: Ctx, x: number, s: number, side: Side, offset: number) {
  for (let r = 0; r < 9; r++) {
    const y = 140 - r * 18 * s + offset;
    if (y < -20 || y > H + 20) continue;
    if (side === 'R')
      for (let i = 0; i < 4; i++)
        disc(ctx, x + (i - 1.5 + (r % 2) * 0.5) * 11 * s, y, 5.5 * s, ORANGE);
    else
      for (let i = 0; i < 3; i++) {
        const mx = x + (i - 1 + (r % 2) * 0.5) * 16 * s;
        oval(ctx, mx, y, 8 * s, 6 * s, MELON);
        box(ctx, mx - 1, y - 6 * s, 2, 12 * s, MELON_ST);
      }
  }
}
/** 18.0 and 21.0: the row of upturned faces, tipped further back each time. */
const crowdCut =
  (second: boolean): ShotFn =>
  (ctx, t) => {
    const from = second ? 21.0 : 18.0;
    const u = span(t, from, from + 0.6);
    box(ctx, 0, 0, W, H, mix(SKY_LO, SKY_HI, 0.3));
    box(ctx, 0, 112, W, 68, mix(COBBLE, SKY_LO, 0.3));
    // The two towers, soft, climbing out of frame at either side.
    column(ctx, 22, 1, 'L', u * 10);
    column(ctx, 298, 1, 'R', u * 10);
    for (let i = 0; i < 6; i++) {
      box(ctx, 40 + i * 20, 0, 10, 12, mix(i % 2 ? CREAM : M_APRON, SKY_LO, 0.4));
      box(ctx, 160 + i * 20, 0, 10, 12, mix(i % 2 ? CREAM : P_APRON, SKY_LO, 0.4));
    }
    const tilt = (second ? 0.7 : 0.35) + u * 0.12;
    const row = second ? [1, 2, 4, 5] : [0, 3, 1, 4];
    row.forEach((g, i) => {
      const x = 62 + i * 66,
        kid = g === 2 || g === 3;
      let hat: { dx: number; dy: number; rot: number } | null = { dx: 1, dy: 0, rot: -0.1 };
      if (g === 2 && second) {
        const off = easeIn(span(t, CAP_OFF, CAP_OFF + 0.35));
        hat = { dx: -off * 12, dy: -off * 4 + off * off * 40, rot: -0.1 - off * 1.4 };
      }
      gawker(
        ctx,
        x,
        kid ? 166 : 150,
        kid ? 2.0 : 2.3,
        GAWKS[g],
        tilt + (i % 2) * 0.05,
        0.4 + tilt * 0.6,
        0,
        hat,
      );
    });
  };

// ——— Looking up from the crowd: two towers in steep perspective ———
const VP_Y = -160;
function lowAngle(ctx: Ctx, t: number, below: boolean) {
  const k = below ? lean(t) : 0;
  const rise = below ? 0 : ease(span(t, 24, 26)) * 10;
  box(ctx, 0, 0, W, H, SKY_HI);
  box(ctx, 0, 120 + rise, W, H, SKY_LO);
  for (let x = 0; x < W; x += 4) {
    box(ctx, x, 118 + rise, 2, 1, SKY_LO);
    box(ctx, x + 2, 119 + rise, 2, 1, SKY_LO);
  }
  // The glass line, far above.
  line(ctx, alpha(GLASS, 0.7), 5, [0, 14 + rise, 160, 6 + rise, 320, 14 + rise]);
  line(ctx, alpha('#FFFFFF', 0.8), 1, [0, 12 + rise, 160, 4 + rise, 320, 12 + rise]);
  for (const side of SIDES) {
    const bx = side === 'L' ? 46 : 274;
    const at = (d: number) => {
      const y = VP_Y + (200 - VP_Y) * d + rise;
      const x = 160 + (bx - 160) * d + SIGN[side] * k * 140 * (1 - d) ** 2;
      return { x, y, w: 80 * d };
    };
    // A dark core so the gaps between the fruit read as the stack, not sky.
    const a = at(1),
      z = at(0.49);
    poly(ctx, side === 'R' ? ORANGE_LO : MELON_ST, [
      a.x - a.w / 2.3,
      a.y,
      a.x + a.w / 2.3,
      a.y,
      z.x + z.w / 2.3,
      z.y,
      z.x - z.w / 2.3,
      z.y,
    ]);
    for (let i = 0; i < 18; i++) {
      const d = 0.96 ** i;
      if (d < 0.49) break;
      const { x, y, w } = at(d);
      if (y > H + 20) continue;
      const haze = (1 - d) * 1.1;
      if (side === 'R') {
        const r = w / 10,
          n = i % 2 ? 4 : 5;
        for (let j = 0; j < n; j++)
          disc(ctx, x + (j - (n - 1) / 2) * r * 2, y, r, mix(ORANGE, SKY_HI, haze));
      } else {
        const rx = w / 6,
          n = i % 2 ? 2 : 3;
        for (let j = 0; j < n; j++) {
          const mx = x + (j - (n - 1) / 2) * rx * 2;
          oval(ctx, mx, y, rx, rx * 0.75, mix(MELON, SKY_HI, haze));
          box(
            ctx,
            mx - rx * 0.3,
            y - rx * 0.7,
            Math.max(1, rx * 0.15),
            rx * 1.4,
            mix(MELON_ST, SKY_HI, haze),
          );
        }
      }
    }
    // The seller at the top, tiny and clinging.
    const top = at(0.49);
    ctx.save();
    ctx.translate(top.x - SIGN[side] * 10, top.y + 8);
    ctx.scale(0.55, 0.55);
    person(ctx, 0, 0, {
      ...(side === 'R' ? PELL : MAGS),
      size: 1,
      facing: side === 'R' ? 1 : -1,
      arms: [1.4, 1.7],
      eyes: below ? 'wide' : 'closed',
      mouth: below ? 'o' : 'flat',
    });
    ctx.restore();
  }
  // The faces in the foreground.
  const tilt = below ? 0.75 : 0.95;
  const cover = below ? ease(span(t, GASP + 0.05, GASP + 0.5)) : 0;
  const order = [0, 2, 1, 3, 4, 5];
  order.forEach((g, i) => {
    const x = 26 + i * 54 + (i % 2) * 6;
    const kid = g === 2 || g === 3;
    gawker(
      ctx,
      x,
      (kid ? 196 : 186) + (i % 2) * 6,
      kid ? 1.9 : 2.1,
      g === 2 ? { ...GAWKS[g], hat: undefined } : GAWKS[g],
      tilt,
      below ? 1 : 0.8,
      cover,
      { dx: 1, dy: 0, rot: -0.1 },
    );
  });
}

// ——— The capsule window, close up ———
const capsuleWindow: ShotFn = (ctx, t, seconds) => {
  // The capsule crawls left to right, as it does in the wides.
  const drift = (t - CRAWL[0]) * 26;
  box(ctx, 0, 0, W, H, mix(SKY_HI, '#FFFFFF', 0.2));
  // The capsule's skin, with its long window.
  box(ctx, 0, 34, W, 118, CAPSULE_C);
  box(ctx, 0, 34, W, 4, '#FFFFFF');
  box(ctx, 0, 140, W, 12, '#B9C6CF');
  box(ctx, 0, 52, W, 76, '#2C3A47');
  for (let i = -1; i < 3; i++) box(ctx, 56 + i * 150 + drift, 52, 6, 76, '#C9D3DA');
  // Three passengers, faces squashed flat on the glass, staring down at the summits.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 52, W, 76);
  ctx.clip();
  PASSENGERS.forEach((p, i) => {
    const x = 32 + i * 98 + drift,
      y = 94 + (i === 1 ? -3 : 3);
    const press = mix(p.skin, '#FFFFFF', 0.18),
      rim = mix(p.skin, '#FFFFFF', 0.55);
    oval(ctx, x, y + 44, 34, 20, p.coat);
    oval(ctx, x, y, 28, 31, p.skin);
    oval(ctx, x, y - 25, 27, 12, p.hair);
    // Hands flat on the glass at the temples: a pale rim where they press, fingers spread.
    for (const sd of [-1, 1]) {
      const hx = x + sd * 33,
        hy = y - 8;
      oval(ctx, hx, hy + 2, 8.5, 9.5, rim);
      for (let k = 0; k < 4; k++) {
        const fx = hx + sd * (k - 1.5) * 4.2,
          rot = sd * (k - 1.5) * 0.16;
        oval(ctx, fx, hy - 10 + Math.abs(k - 1.5) * 1.6, 2.6, 7, rim, rot);
        oval(ctx, fx, hy - 10 + Math.abs(k - 1.5) * 1.6, 1.7, 6, press, rot);
      }
      oval(ctx, hx - sd * 8, hy + 4, 5, 2.4, press, sd * 0.5);
      oval(ctx, hx, hy + 2, 7, 8, press);
    }
    // Cheeks spread, lips pressed into an O.
    oval(ctx, x - 16, y + 9, 7, 4, alpha('#E58A86', 0.35));
    oval(ctx, x + 16, y + 9, 7, 4, alpha('#E58A86', 0.35));
    // The nose squashed flat: a broad soft shape with a white smudge where it meets the glass.
    oval(ctx, x, y + 6, 9, 5, darker(p.skin, 0.12));
    oval(ctx, x, y + 5, 8, 4.2, press);
    oval(ctx, x - 1, y + 4, 4, 1.6, alpha('#FFFFFF', 0.55));
    oval(ctx, x, y + 19, 6, 4, mix('#C0605A', '#FFFFFF', 0.25));
    oval(ctx, x, y + 19, 3.5, 2.2, '#5A2A2A');
    for (const sd of [-1, 1]) {
      oval(ctx, x + sd * 11, y - 7, 6.5, 7.5, '#FAF6EE');
      disc(ctx, x + sd * 11 + 1.5, y - 3.5, 3.2, INK);
      line(ctx, darker(p.hair, 0.1), 2, [x + sd * 5, y - 17, x + sd * 17, y - 19]);
    }
  });
  ctx.restore();
  // Reflections on the glass.
  for (let i = 0; i < 3; i++) {
    const rx = 20 + i * 110 + drift * 0.6;
    poly(ctx, alpha('#FFFFFF', 0.13), [rx, 52, rx + 24, 52, rx - 10, 128, rx - 34, 128]);
  }
  // The tube's glass, nearer still.
  box(ctx, 0, 0, W, 10, alpha(GLASS, 0.8));
  box(ctx, 0, 170, W, 10, alpha(GLASS, 0.8));
  box(ctx, 0, 9, W, 1, '#FFFFFF');
  box(ctx, 0, 156 + Math.sin(seconds * 3) * 0.5, W, 1, alpha('#FFFFFF', 0.5));
};

// ——— The stand-off ———
function skyOnly(ctx: Ctx, glass = true) {
  box(ctx, 0, 0, W, H, SKY_HI);
  box(ctx, 0, 130, W, 50, mix(SKY_HI, SKY_LO, 0.5));
  if (glass) {
    box(ctx, 0, 18, W, 16, alpha(GLASS, 0.7));
    box(ctx, 0, 18, W, 1, '#8FB2C0');
    box(ctx, 0, 33, W, 1, '#8FB2C0');
    box(ctx, 0, 21, W, 2, alpha('#FFFFFF', 0.8));
  }
}
const pellEyes: ShotFn = (ctx, t) => {
  skyOnly(ctx);
  const s = lerp(6.2, 6.7, span(t, 32, 33));
  pellBust(ctx, 160 + 3.5 * s, 92 + 2 * s, s, -1, {
    eyes: 0.3,
    look: [-1, 0],
    brow: -1,
    mouth: 'flat',
    sweat: span(t, 32.1, 33),
  });
};
const magsEyes: ShotFn = (ctx, t) => {
  skyOnly(ctx);
  const s = lerp(6.2, 6.7, span(t, 33, 34));
  magsBust(ctx, 160 - 4 * s, 92 - 1.5 * s, s, 1, {
    eyes: 0.28,
    look: [1, 0],
    brow: -1,
    mouth: 'purse',
  });
};
/** 29.5–30.5: Pell, eyes screwed shut, hugging his stack as it swings. */
const clingCU: ShotFn = (ctx, t) => {
  skyOnly(ctx);
  // The whole stack swings about a point far below; the sky and the glass stay put.
  const swing = (sway('R', t) / 15) * 0.09;
  ctx.save();
  ctx.translate(160, 520);
  ctx.rotate(swing);
  ctx.translate(-160, -520);
  column(ctx, 262, 1.5, 'R', 6);
  pellBust(
    ctx,
    172,
    84,
    2.7,
    1,
    { eyes: 0, brow: -1, mouth: 'strain', sweat: span(t, CLING_CU[0] + 0.1, CLING_CU[1]) },
    () => {
      // Both arms round the oranges, fingers dug in.
      line(ctx, SHIRT_D, 7, [-18, 34, 6, 30, 30, 22]);
      line(ctx, SHIRT, 7, [18, 34, 26, 30, 32, 26]);
      oval(ctx, 32, 22, 4.5, 3.5, P_SKIN);
      oval(ctx, 34, 27, 4.5, 3.5, P_SKIN);
    },
  );
  ctx.restore();
};
/** 34.0: Pell polishes his tiny perfect orange on his apron. */
const polish: ShotFn = (ctx, t) => {
  skyOnly(ctx);
  column(ctx, 300, 1.4, 'R', -20);
  const lift = ease(span(t, 34.55, 34.85));
  const rub = Math.sin((t - 34) * 17) * 6 * (1 - lift);
  pellBust(
    ctx,
    196,
    70,
    2.5,
    -1,
    {
      eyes: 0.35,
      look: [lift > 0.5 ? 1 : 0, lift > 0.5 ? -0.6 : 0.6],
      brow: -0.6,
      mouth: 'smirk',
    },
    () => {
      // His hand, rubbing the orange on the bib, then raising it to the light.
      const hx = lerp(3 + rub, 18, lift),
        hy = lerp(33, 0, lift);
      line(ctx, SHIRT, 6, [20, 30, lerp(16, 24, lift), lerp(34, 16, lift), hx, hy + 4]);
      tinyOrange(ctx, hx, hy - 1, 2.3);
      oval(ctx, hx, hy + 3, 4, 3, P_SKIN);
      const glint = Math.sin(Math.PI * span(t, 34.7, 34.98));
      if (glint > 0) {
        const gx = hx - 3,
          gy = hy - 5;
        poly(ctx, alpha('#FFFFFF', glint), [
          gx,
          gy - 7 * glint,
          gx + 1.2,
          gy,
          gx,
          gy + 7 * glint,
          gx - 1.2,
          gy,
        ]);
        poly(ctx, alpha('#FFFFFF', glint), [
          gx - 7 * glint,
          gy,
          gx,
          gy - 1.2,
          gx + 7 * glint,
          gy,
          gx,
          gy + 1.2,
        ]);
      }
    },
  );
};

// ——— The sparrow, extremely close ———
const sparrowShot: ShotFn = (ctx, t, seconds) => {
  skyOnly(ctx, false);
  box(ctx, 0, 0, W, 30, alpha(GLASS, 0.75));
  box(ctx, 0, 29, W, 1, '#8FB2C0');
  box(ctx, 0, 6, W, 3, alpha('#FFFFFF', 0.8));
  const tip = -0.11 * easeIn(span(t, CREAK, GASP));
  ctx.save();
  ctx.translate(160, 300);
  ctx.rotate(tip);
  ctx.translate(-160, -300);
  // The top course of Pell's tower, enormous at this distance.
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 7; i++) {
      if (r === 1 && i > 5) continue;
      const x = 40 + i * 40 + r * 20,
        y = 196 - r * 34;
      disc(ctx, x, y, 21, ORANGE);
      disc(ctx, x - 7, y - 7, 5, ORANGE_HI);
      disc(ctx, x + 5, y + 9, 6, alpha(ORANGE_LO, 0.5));
    }
  // The perfect one, on top.
  tinyOrange(ctx, 160, 124, 7.5);
  // Pell, peeking in from the left, on his ladder.
  pellBust(ctx, 18, 112, 3.3, 1, {
    eyes: t > SPARROW ? 1 : 0.6,
    wide: t > CREAK,
    look: [1, -0.4],
    brow: t > SPARROW ? 1 : 0,
    mouth: t > CREAK ? 'o' : 'flat',
    sweat: t > CREAK ? span(t, CREAK, GASP) : 0,
  });
  // The sparrow lands, settles, looks about.
  const land = span(t, SPARROW - 0.6, SPARROW);
  const bx = lerp(-20, 160, easeOut(land)),
    by = lerp(40, 101, easeOut(land)) - Math.sin(land * Math.PI) * 18;
  const settle = Math.sin(Math.PI * span(t, SPARROW, SPARROW + 0.25)) * 2;
  const look = t > 39.0 && t < 39.5 ? 1 : 0;
  sparrow(
    ctx,
    bx,
    by + 4 + settle,
    4,
    t > 39.4 && t < CREAK ? -1 : 1,
    t < SPARROW ? seconds * 3 : 0,
    look,
  );
  // The first creak: small strain marks.
  if (t > CREAK) {
    const c = span(t, CREAK, GASP);
    for (const [x, y] of [
      [96, 150],
      [228, 148],
    ])
      for (let i = -1; i <= 1; i++)
        line(ctx, alpha(INK, 1 - c), 1.5, [x + i * 7, y - 4, x + i * 9, y - 12]);
  }
  ctx.restore();
};

// ——— Nose to nose under the keystone ———
const keystone: ShotFn = (ctx, t, seconds) => {
  skyOnly(ctx, false);
  box(ctx, 0, 0, W, 12, alpha(GLASS, 0.7));
  box(ctx, 0, 11, W, 1, '#8FB2C0');
  // The two sides of the arch, curving down out of frame behind them.
  for (let r = 0; r < 4; r++) {
    const mx = 96 - r * 25,
      my = 66 + r * 27;
    oval(ctx, mx, my, 20, 14, MELON);
    box(ctx, mx - 5, my - 13, 3, 26, MELON_ST);
    box(ctx, mx + 4, my - 13, 3, 26, MELON_ST);
    disc(ctx, 206 + r * 24, 68 + r * 28, 11, ORANGE);
    disc(ctx, 224 + r * 24, 77 + r * 28, 11, ORANGE);
  }
  // The crown: Mags's watermelon and Pell's tiny orange, side by side, sky beneath.
  disc(ctx, 186, 64, 11, ORANGE);
  disc(ctx, 182, 60, 3, ORANGE_HI);
  watermelon(ctx, 140, 48, 2.6);
  const o = keystoneOrange(t);
  if (o) tinyOrange(ctx, o.x, o.y, 3);
  // Nose to nose, a rung below the crown.
  const look = t > 43.75 ? 1 : 0;
  magsBust(ctx, 112, 133, 2.3, 1, {
    eyes: 1,
    wide: true,
    look: [look ? 1 : 0.4, look ? 0 : -1],
    brow: 1,
    mouth: 'o',
  });
  pellBust(ctx, 210, 131, 2.3, -1, {
    eyes: 1,
    wide: true,
    look: [look ? 1 : 0.4, look ? 0 : -1],
    brow: 1,
    mouth: 'flat',
  });
  // The sparrow, from the orange onto the top of the keystone.
  const hop = easeOut(span(t, HOP, HOP + 0.15));
  const bx = lerp(180, 144, hop),
    by = lerp(31.5, 17.5, hop) - 4 * hop * (1 - hop) * 10;
  sparrow(ctx, bx, by, 2.6, -1, hop > 0 && hop < 1 ? seconds * 3 : 0, t > HOP + 0.3 ? 1 : 0);
};
/** In the close-up the tiny orange sits on the crown, then rolls off right with its first bounce. */
function keystoneOrange(t: number) {
  if (t < HOP + 0.05) return { x: 182, y: 50 };
  if (t < BOUNCES[0]) {
    const u = easeIn(span(t, HOP + 0.05, BOUNCES[0]));
    return { x: lerp(182, 214, u), y: lerp(50, 56, u) };
  }
  const u = span(t, BOUNCES[0], 44.35);
  return { x: lerp(214, 336, u), y: lerp(56, 150, u) - 20 * 4 * u * (1 - u) };
}

// ——— The score ———
const ROOT = 60;
/** The bustle: a light market tune in C, two quavers to a beat over C–F–G–C. */
// prettier-ignore
const BUSTLE = [
  12, null, 16, 19, 24, null, 19, 16,
  17, null, 21, 24, 21, null, 17, null,
  19, null, 23, 26, 23, null, 19, 17,
  16, 14, 12, null, 7, null, 12, null,
] as const;
const panOf = (side: Side) => (side === 'R' ? 0.6 : -0.6);
const voiceOf = (side: Side) => (side === 'R' ? ('pluck' as const) : ('bell' as const));

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const tallOrderScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: ROOT, voice: 'pluck', intro: [0, 4, 7], outro: [0, 4, 7, 12] }, (s) => {
    // Beds: the morning crowd, a breath of wind high up.
    s.fx('crowd', P(0), 17, 0.06);
    s.fx('crowd', P(17), 15, 0.075);
    s.fx('wind', P(24), 22, 0.05);
    // The crowd stays hushed through the lean; they find their voices on the unison.
    s.fx('crowd', P(UNISON), STORY - UNISON + 0.2, 0.05);
    // The capsule at the opening, panned left to right.
    for (const [at, pan] of [
      [0.5, -0.7],
      [1.0, 0],
      [1.5, 0.7],
    ])
      s.fx('sweep', P(at), 0.7, 0.08, pan);
    // The bustle.
    s.section({
      from: 0,
      to: P(10.9),
      bpm: 112,
      root: ROOT,
      chords: [0, 5, 7, 0],
      groove: 'tick',
      melody: BUSTLE,
      step: 0.5,
      voice: 'keys',
      gain: 0.5,
      level: 0.6,
      fade: 0.8,
    });
    s.note(P(PELL_TOP), 52, 0.6, 'pluck', 0.12, 0.6);
    s.fx('chime', P(PELL_TOP), 0.8, 0.04, 0.6);
    s.note(P(MAGS_FIRST), 53, 0.6, 'bell', 0.12, -0.6);
    s.fx('knock', P(MAGS_FIRST), 0.2, 0.1, -0.6);
    // The display war: height is pitch.
    for (const l of LAYERS) {
      s.note(P(l.s), l.note, 0.5, voiceOf(l.side), 0.12, panOf(l.side));
      if (l.base) s.fx('knock', P(l.s), 0.25, 0.16, panOf(l.side) * 0.7);
      if (l.ladder) s.fx('clatter', P(l.s - 0.45), 0.4, 0.07, panOf(l.side) * 0.7);
    }
    const pulse = (from: number, to: number, bpm: number, level: number) =>
      s.section({
        from: P(from),
        to: P(to),
        bpm,
        root: ROOT,
        chords: [0, 5, 7, 0],
        groove: 'pulse',
        level,
        fade: 0.3,
      });
    pulse(11.0, 15.6, 112, 0.55);
    pulse(15.6, 20.55, 122, 0.65);
    pulse(20.55, 26.0, 132, 0.75);
    s.section({
      from: P(26.0),
      to: P(31.75),
      bpm: 132,
      root: ROOT,
      chords: [0, 5, 7, 0],
      groove: 'pulse',
      level: 0.4,
      pad: false,
      fade: 0.2,
    });
    // The tube: the capsule in, a gawping crawl, and out; the draught; the creaks.
    s.fx('sweep', P(CAPSULE[0]), 0.5, 0.1, -0.7);
    s.fx('sweep', P(CRAWL[0]), CRAWL[1] - CRAWL[0], 0.05, -0.1);
    s.fx('sweep', P(CRAWL[1]), CAPSULE[1] - CRAWL[1] + 0.2, 0.12, 0.7);
    s.fx('wind', P(SWAY), 1.8, 0.14);
    s.fx('creak', P(CREAKS[0]), 0.7, 0.14, -0.4);
    s.fx('creak', P(CREAKS[1]), 0.7, 0.14, 0.4);
    // The stand-off: no music, only the market clock and the wind in the bunting.
    s.fx('wind', P(STANDOFF - 0.3), 5.6, 0.07);
    for (let x = STANDOFF; x < PLACE - 0.1; x += 0.5) s.fx('tick', P(x), 0.05, 0.05);
    s.fx('rustle', P(34.1), 0.8, 0.04, 0.4);
    s.fx('sparkle', P(34.7), 0.4, 0.05, 0.4);
    s.fx('creak', P(35.3), 0.6, 0.1, -0.4);
    // PLACE: the two summits, struck together a semitone apart. Sour.
    s.note(P(PLACE), 83, 1.0, 'pluck', 0.13, 0.6);
    s.note(P(PLACE), 84, 1.0, 'bell', 0.13, -0.6);
    // The sparrow, the lean, the gasp, and one long low note for the slow motion.
    s.fx('tweet', P(SPARROW), 0.5, 0.12, 0.3);
    s.fx('creak', P(CREAK), 1.2, 0.12);
    s.fx('gasp', P(GASP), 0.6, 0.15);
    s.note(P(40.4), 36, MEET - 40.4, 'bass', 0.12);
    s.chord(P(40.4), [48, 55, 62, 63], MEET - 40.4, 'pad', 0.04);
    // MEET: a soft bump, then a full second of nothing but wind.
    s.fx('thud', P(MEET), 0.4, 0.2);
    s.fx('wind', P(MEET), 1.2, 0.08);
    s.fx('tweet', P(HOP), 0.35, 0.1);
    // The roll: one note down per bounce, and a soft catch.
    [79, 76, 72, 67, 64].forEach((n, i) =>
      s.note(P(BOUNCES[i]), n, 0.35, 'pluck', 0.1, 0.2 + i * 0.05),
    );
    s.fx('pop', P(CATCH), 0.2, 0.15, 0.4);
    s.note(P(CATCH), 60, 0.6, 'pluck', 0.1, 0.3);
    // Resolution: for the first time the two voices play the same note.
    s.note(P(UNISON), 72, 1.6, 'pluck', 0.1);
    s.note(P(UNISON), 72, 1.6, 'bell', 0.1);
    s.chord(P(47.0), [60, 64, 67, 72], 2.0, 'keys', 0.06);
    s.section({
      from: P(47.0),
      to: P(53.5),
      bpm: 112,
      root: ROOT,
      chords: [0, 5, 7, 0],
      groove: 'tick',
      melody: BUSTLE,
      step: 0.5,
      voice: 'keys',
      gain: 0.38,
      level: 0.45,
      fade: 1.0,
    });
    s.note(P(HANDSHAKE), 60, 1.0, 'bell', 0.1, -0.2);
    s.note(P(HANDSHAKE), 67, 1.0, 'pluck', 0.1, 0.2);
    s.fx('sweep', P(52.5), 0.6, 0.07, 0.7);
    s.fx('sweep', P(53.0), 0.6, 0.07, -0.7);
    s.fx('tweet', P(53.0), 0.4, 0.08, -0.2);
  });

// ——— The shots, in order ———
const draught = steady([
  [28.3, 160, 80, 1.45],
  [32.0, 160, 77, 1.55],
]);
/** The pull out after the handshake: away, and arrived well before The End. */
const PULL = [52.35, 53.1] as const;
const SHOTS: readonly ShotFn[] = [
  // The whole market at eight, then down to the stalls.
  eased([
    [0, 160, 150, 0.6],
    [1.4, 160, 150, 0.6],
    [4.0, 160, 226, 1.05],
  ]),
  // Pell's pyramid.
  steady([
    [4.0, 238, 246, 2.3],
    [8.0, 232, 244, 2.5],
  ]),
  cuMags,
  // The challenge.
  steady([
    [9.2, 98, 244, 2.25],
    [10.0, 106, 244, 2.35],
  ]),
  cuPell,
  // Escalation: one cut per placement, each framed a little higher.
  steady([
    [10.6, 224, 242, 1.9],
    [11.9, 224, 236, 1.9],
  ]),
  steady([
    [11.9, 96, 234, 1.9],
    [13.1, 96, 228, 1.9],
  ]),
  steady([
    [13.1, 224, 224, 1.9],
    [14.2, 224, 218, 1.9],
  ]),
  steady([
    [14.2, 96, 214, 1.9],
    [15.2, 96, 208, 1.9],
  ]),
  steady([
    [15.2, 218, 208, 1.75],
    [16.15, 218, 200, 1.75],
  ]),
  steady([
    [16.15, 104, 226, 1.25],
    [17.1, 104, 220, 1.25],
  ]),
  // The climb.
  steady([
    [17.1, 160, 206, 1.22],
    [18.0, 160, 188, 1.22],
  ]),
  crowdCut(false),
  steady([
    [18.6, 160, 176, 1.22],
    [21.0, 160, 130, 1.22],
  ]),
  crowdCut(true),
  steady([
    [21.6, 160, 118, 1.22],
    [24.0, 160, 90, 1.25],
  ]),
  (ctx, t) => lowAngle(ctx, t, false),
  // The tube.
  steady([
    [26.0, 160, 82, 1.5],
    [27.3, 160, 80, 1.55],
  ]),
  capsuleWindow,
  // The draught, either side of Pell hugging his stack: one continuous move.
  draught,
  clingCU,
  draught,
  pellEyes,
  magsEyes,
  polish,
  // Mags hoists the watermelon; her ladder bows.
  steady([
    [35.0, 114, 92, 2.5],
    [36.2, 114, 86, 2.6],
  ]),
  // Both raise their fruit, and PLACE.
  steady([
    [36.2, 160, 82, 1.5],
    [38.0, 160, 80, 1.56],
  ]),
  sparrowShot,
  (ctx, t) => lowAngle(ctx, t, true),
  // The turn.
  steady([
    [42.0, 160, 140, 0.98],
    [43.4, 160, 136, 1.0],
  ]),
  keystone,
  // The roll: the camera rides the orange down.
  (ctx, t, seconds) => {
    const o = rollAt(Math.max(t, HOP), false);
    scene(ctx, t, seconds, { x: lerp(o.x, 220, 0.25), y: o.y + 6, zoom: 2.5 });
  },
  // Under the arch.
  eased([
    [UNISON, 160, 214, 1.0],
    [47.6, 160, 214, 1.0],
    [50.0, 160, 176, 0.74],
  ]),
  // The handshake, and the pull out: a quick ease-out, so the punchline holds before the card.
  (ctx, t, seconds) => {
    if (t < PULL[0])
      return scene(
        ctx,
        t,
        seconds,
        track(t, [
          [50.0, 160, 256, 2.55],
          [PULL[0], 160, 255, 2.65],
        ]),
      );
    const u = easeOut(span(t, PULL[0], PULL[1]));
    scene(ctx, t, seconds, {
      x: 160,
      y: lerp(255, 150, u),
      zoom: Math.exp(lerp(Math.log(2.65), Math.log(0.6), u)),
    });
  },
];

export const tallOrder: FilmModule = {
  draw(ctx, p, seconds) {
    const t = p * STORY;
    const { index } = shot(t, CUTS);
    SHOTS[index](ctx, t, seconds);
    vignette(ctx, 0.28, '#2F3A1F');
    // A widescreen squeeze for the western stand-off.
    letterbox(ctx, presence(t, STANDOFF, 38.0, 0.25));
  },
  score: tallOrderScore,
  look: {
    shade: '#2F3A1F',
    ink: '#FFF3D6',
    accent: '#F28C28',
    dedication: 'please do not climb the displays',
  },
};
