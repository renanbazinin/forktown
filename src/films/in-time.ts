import type { FilmModule } from './types';
import type { Voice } from '../music/score';
import {
  alpha,
  box,
  camera,
  captions,
  clamp,
  disc,
  ease,
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
  rand,
  span,
  track,
  vignette,
  W,
  write,
  type Ctx,
  type Figure,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * IN TIME
 * At the riverside regatta, Luka enters his mother Marta, once a champion, in the veterans'
 * pairs. Since her stroke she rows with one good arm. Their old wooden pair spins in circles
 * while every other crew pulls away, until he stops pulling his hardest and follows her.
 *
 * Everything is timed in story seconds (114 between the title and the end card). The boat's
 * heading and position are closed-form functions of the story second, the oars read the two
 * stroke lists, and the score plays the same lists: two clocks that refuse to agree, and then
 * one waltz, a bar to every stroke.
 */

// ——— Timing ———
export const STORY = 114;
const at = (s: number) => s / STORY;

/** Her catches through the spin: every 2.4 s, the pace she can hold. */
export const HER_STROKES: readonly number[] = [28.0, 30.4, 32.8, 35.2, 37.6, 40.0, 42.4, 44.8];
/** His: every 1.5 s, quickening to 1.2 s as he tries to make up for her. */
export const HIS_STROKES: readonly number[] = [
  28.0, 29.5, 30.95, 32.35, 33.7, 35.0, 36.25, 37.45, 38.65, 39.85, 41.05, 42.25, 43.45, 44.65,
];
/** Her blade jams on her last catch of the spin. */
export const CRAB = 44.8;
/** Her good hand on the gunwale, at her own pace. */
export const TAPS: readonly number[] = [56.0, 58.4, 60.8];
/** The first catch together. */
export const SYNC = 63.2;
/** One bar of the waltz is one of her strokes. */
const BAR = 2.4;
const BEAT = BAR / 3;
export const TOGETHER: readonly number[] = Array.from(
  { length: 16 },
  (_, k) => Math.round((SYNC + BAR * k) * 100) / 100,
);
export const FINISH = 101.0;
export const HAND = 108.4;

const LIFT = 8.0;
const BUCKLE = 21.5;
const START = 26.5;
const SPIN = HER_STROKES[0];
const GIGGLE = 37.2;
const SHUSH = 37.8;
const STRAIGHT = 70.0;
const ROLL = 92.0;
const SPOT = 95.0;
const RAISE = 97.0;
const CLAP = 102.0;
const CLAPS = 103.5;
const LAUGH = 104.5;
/** Marta's walk cycle down the pontoon, in radians per second: the steps in the score read it. */
const WALK_RATE = 3.1;
/** The moment the old photo was taken: a frame of the memory itself. */
const PHOTO_T = 78.9;

/** Where each shot begins, in story seconds, and what it is. */
const SHOT_LIST = [
  [0, 'reach'], // the regatta reach in late-afternoon gold
  [7, 'boathouse'], // Luka lifts the old pair off its rack
  [9, 'bow'], // MARTA on the bow
  [11, 'photo'], // the photo beside the cups
  [14, 'pontoon'], // Marta's slow walk past the crews
  [16.5, 'doubt'], // her doubt
  [18, 'eager'], // "Like old times, Mum."
  [21, 'buckle'], // the strap round her weak hand
  [23, 'start'], // five boats abreast; the flag drops
  [28, 'spin'], // big fast strokes against short slow ones
  [32, 'overhead'], // the key image: a spiral among straight lines
  [36, 'bank'], // heads turning in unison
  [40, 'strain'], // he pulls harder
  [42, 'slip'], // her hand slipping in the strap
  [44, 'crab'], // her blade jams
  [47, 'still'], // broadside, alone on the river
  [52, 'bite'], // he bites it back
  [55, 'back'], // over his shoulder: her back, and three taps
  [59, 'watch'], // between the taps, he watches her hand, and gets it
  [60.4, 'back'], // the last tap, through his eyes
  [61.2, 'copy'], // he loosens, and swings with her
  [62.8, 'blades'], // two blades, one instant
  [65, 'straighten'], // the spiral straightens
  [72, 'then'], // the same river, years ago
  [74, 'young'], // she smiles at the back of his head
  [77, 'memory'], // the photo, alive
  [80, 'reversed'], // the same boat, roles reversed
  [84, 'glide'], // golden light, oars as one
  [92, 'finish'], // the officials are packing up
  [100, 'cross'], // the flag, the bell, one clap
  [104, 'laugh'], // Marta, breathless, laughing
  [108, 'hand'], // her hand back over her shoulder
  [111.4, 'final'], // into the low sun, a straight wake (after her line)
] as const;
type ShotName = (typeof SHOT_LIST)[number][1];
const CUTS = SHOT_LIST.map(([s]) => s);
/** Match-dissolves: into the memory on the overhead, and back on the side two-shot. */
const SOFT: readonly (readonly [number, number, ShotName, ShotName])[] = [
  [72, 74, 'straighten', 'then'],
  [80, 82, 'memory', 'reversed'],
];
function scene(t: number): ShotName {
  let i = 0;
  while (i + 1 < CUTS.length && t >= CUTS[i + 1]) i++;
  return SHOT_LIST[i][1];
}

// ——— The boat's path: closed-form, in plan units (about a metre each; the boat is eight) ———
type Pt = { x: number; y: number };
const TURNS = 2.5 * Math.PI;
/** At the crab she lies broadside across the river, bow to the near bank. */
const BROADSIDE = TURNS;
const R0 = 6;
const S0: Pt = { x: 0, y: 4 };
const CENTRE: Pt = { x: S0.x, y: S0.y + R0 };
const GLIDE_V = 2.4;
/** The quarter turn back to straight, sized so the speed meets the glide's. */
const RQ = (GLIDE_V * (STRAIGHT - SYNC)) / Math.PI;

/**
 * Plan heading in radians: 0 is upriver, and it grows clockwise seen from above, toward her
 * side, because he out-pulls her on the other one.
 */
export function HEADING(s: number) {
  if (s <= SPIN) return 0;
  if (s <= CRAB) return TURNS * ((s - SPIN) / (CRAB - SPIN)) ** 1.4;
  if (s <= SYNC) {
    const tau = s - CRAB,
      k = tau / (SYNC - CRAB);
    return (
      BROADSIDE +
      0.1 * (1 - Math.exp(-tau / 0.2)) -
      0.1 * ease(k) +
      0.04 * Math.sin(3 * Math.PI * k)
    );
  }
  if (s <= STRAIGHT) return BROADSIDE - (Math.PI / 2) * ((s - SYNC) / (STRAIGHT - SYNC)) ** 2;
  return 2 * Math.PI;
}
function spinAt(s: number): Pt {
  const u = clamp((s - SPIN) / (CRAB - SPIN));
  const th = HEADING(Math.min(s, CRAB));
  const r = R0 * (1 - 0.62 * u);
  return { x: CENTRE.x + r * Math.sin(th), y: CENTRE.y - r * Math.cos(th) };
}
const CRAB_AT = spinAt(CRAB);
function holdAt(s: number): Pt {
  const tau = s - CRAB;
  return { x: CRAB_AT.x - 0.1 * tau, y: CRAB_AT.y + 0.45 * (1 - Math.exp(-tau / 0.25)) };
}
const SYNC_AT = holdAt(SYNC);
const TURN_C: Pt = { x: SYNC_AT.x + RQ, y: SYNC_AT.y };
const STRAIGHT_AT: Pt = { x: TURN_C.x, y: TURN_C.y + RQ };
/** The boat's centre: a tightening spiral, a drift, a quarter turn, then a dead-straight run. */
export function POSITION(s: number): Pt {
  if (s <= SPIN) return S0;
  if (s <= CRAB) return spinAt(s);
  if (s <= SYNC) return holdAt(s);
  if (s <= STRAIGHT) {
    const th = HEADING(s);
    return { x: TURN_C.x - RQ * Math.sin(th), y: TURN_C.y + RQ * Math.cos(th) };
  }
  const run = Math.min(s, FINISH) - STRAIGHT;
  const coast = s > FINISH ? 6 * (1 - Math.exp(-(s - FINISH) / 6)) : 0;
  return { x: STRAIGHT_AT.x + GLIDE_V * (run + coast), y: STRAIGHT_AT.y };
}
const sternAt = (s: number): Pt => {
  const p = POSITION(s),
    th = HEADING(s);
  return { x: p.x - Math.cos(th) * 4, y: p.y - Math.sin(th) * 4 };
};

/** The other four crews: a racing start, then a long pull to the bridge. */
const RIVAL_LANES = [-16, -11, -6, -1] as const;
const RIVAL_V = [6.1, 5.8, 6.3, 5.95] as const;
function rivalRun(i: number, s: number) {
  if (s <= START) return 0;
  const t = s - START;
  return Math.min(150 + i * 3, RIVAL_V[i] * (t - 0.6 * (1 - Math.exp(-t / 0.6))));
}
const RIVAL_STROKES: readonly (readonly number[])[] = RIVAL_LANES.map((_, i) =>
  Array.from({ length: 13 }, (_, k) => START + 0.07 * i + 1.4 * k),
);

// ——— Oars: each angle is a function of the time since that rower's last catch ———
type Oar = {
  /** Sweep angle: positive toward the bow (the catch), negative toward the stern (the finish). */
  phi: number;
  /** Blade height: below zero buried in the water, zero resting on it, above zero in the air. */
  lift: number;
  /** Body: 1 compressed at the catch, 0 laid back at the finish. */
  c: number;
  /** Blade squared (1) or feathered flat (0). */
  square: number;
};
const REST: Oar = { phi: 0.06, lift: 0, c: 0.45, square: 0 };
const READY: Oar = { phi: 0.62, lift: 0.1, c: 1, square: 1 };
const mixOar = (a: Oar, b: Oar, k: number): Oar => ({
  phi: lerp(a.phi, b.phi, k),
  lift: lerp(a.lift, b.lift, k),
  c: lerp(a.c, b.c, k),
  square: lerp(a.square, b.square, k),
});
function stroke(
  s: number,
  catches: readonly number[],
  reach: number,
  pull: number,
  drive: number,
): Oar {
  const first = catches[0];
  if (s < first) {
    const k = span(s, first - 1.2, first);
    if (k <= 0) return REST;
    const e = ease(k);
    return {
      phi: lerp(REST.phi, reach, e),
      lift: 0.35 * Math.sin(Math.PI * Math.min(1, k * 1.15)) + 0.12 * e,
      c: lerp(REST.c, 1, e),
      square: span(k, 0.5, 0.95),
    };
  }
  let i = 0;
  while (i + 1 < catches.length && s >= catches[i + 1]) i++;
  const c0 = catches[i];
  const last = i === catches.length - 1;
  const gap = last ? (i ? c0 - catches[i - 1] : 2.4) : catches[i + 1] - c0;
  const d = Math.min(drive, gap * 0.45);
  const tau = s - c0;
  if (tau < d) {
    const k = tau / d;
    const lift =
      k < 0.12 ? lerp(0.12, -1, k / 0.12) : k > 0.9 ? lerp(-1, 0.15, (k - 0.9) / 0.1) : -1;
    return { phi: lerp(reach, -pull, ease(k)), lift, c: 1 - ease(k), square: 1 };
  }
  if (last) {
    const k = clamp((tau - d) / 1.5);
    return {
      phi: lerp(-pull, REST.phi, ease(k)),
      lift: 0.4 * Math.sin(Math.PI * k),
      c: lerp(0, REST.c, ease(k)),
      square: 0,
    };
  }
  const k = (tau - d) / (gap - d);
  return {
    phi: lerp(-pull, reach, ease(k)),
    lift: 0.12 + 0.55 * Math.sin(Math.PI * k),
    c: ease(k),
    square: span(k, 0.6, 0.92),
  };
}
const together = (s: number) => stroke(s, TOGETHER, 0.6, 0.52, 0.9);
function herOar(s: number): Oar {
  if (s < CRAB) return stroke(s, HER_STROKES, 0.4, 0.32, 0.95);
  if (s >= SYNC - 1.3) return together(s);
  const tau = s - CRAB;
  if (tau < 0.3) {
    const k = easeOut(tau / 0.3);
    return { phi: lerp(0.4, -1.0, k), lift: -1.3, c: lerp(1, 0, k), square: 1 };
  }
  if (tau < 1.2) return { phi: -1.0, lift: -1.2, c: 0, square: 1 };
  const k = ease((tau - 1.2) / 3);
  const trail: Oar = {
    phi: lerp(-1.0, -0.3, k),
    lift: lerp(-1.2, 0, k),
    c: lerp(0, 0.4, k),
    square: 1 - k,
  };
  return mixOar(trail, REST, ease(span(s, 50, 54)));
}
function hisOar(s: number): Oar {
  if (s >= SYNC - 1.3) return together(s);
  const spin = stroke(s, HIS_STROKES, 0.9, 0.78, 0.55);
  if (s < CRAB) return spin;
  return mixOar(spin, REST, ease((s - CRAB) / 0.9));
}
const leanOf = (o: Oar) => lerp(-0.3, 0.42, o.c);
/** Her low point: after the jolt, the shoulders drop; the taps lift them again. */
const slump = (s: number) => ease(span(s, 46.2, 48.5)) * (1 - ease(span(s, 57.4, 60.4)));
function herLean(s: number, o: Oar) {
  let lean = leanOf(o);
  if (s >= CRAB && s < SYNC - 1.3) {
    const tau = s - CRAB;
    const jolt = tau < 0.14 ? easeOut(tau / 0.14) : 1 - ease((tau - 0.45) / 1.6);
    lean = lerp(lean, -0.78, clamp(jolt));
  }
  return lean + slump(s) * 0.3;
}
function sinceLast(s: number, ...lists: (readonly number[])[]) {
  let last = -Infinity;
  for (const list of lists) for (const c of list) if (c <= s && c > last) last = c;
  return s - last;
}
function rivalOar(i: number, s: number): Oar {
  const list = RIVAL_STROKES[i];
  if (s < list[0]) return mixOar(REST, READY, ease(span(s, 23.6, 24.6)));
  return stroke(s, list, 0.62, 0.55, 0.6);
}

// ——— Palette ———
const INK = '#2A2228';
const HULL = '#A8683A';
const HULL_HI = '#D49A5E';
const HULL_D = '#7A4626';
const INSIDE = '#6A3E22';
const DECK = '#C2844E';
const CREAM = '#F4E6C4';
const YELLOW = '#E8C24A';
const BLUE = '#3A6FB0';
const NAVY = '#2C3E66';
const SHAFT = '#EFE6D0';
const BUNT_A = '#F2E8D0';
const BUNT_B = '#A9C29A';
const RED = '#C8433A';
const GREEN = '#3E8E5A';
const WHITE = '#F2F0E8';
const PURPLE = '#7A4E9A';
const FOAM = '#EEF6F2';
const SKY_DAY = ['#9CC3D9', '#C7D5C8', '#F4D9A0'] as const;
const SKY_GOLD = ['#E8C38A', '#EDBA7C', '#F2B870'] as const;
const WATER_DAY = ['#93B7C0', '#5E8FA0', '#4A788A'] as const;
const WATER_GOLD = ['#E6B97C', '#C99A5A', '#9C7044'] as const;
const WATER_TOP = '#4F8296';
const BANK_TOP = '#7E9E5C';
const TREE_TOP = '#5C7E46';
const mixAll = (a: readonly string[], b: readonly string[], k: number) =>
  a.map((c, i) => mix(c, b[i], k));
/** The light warms over the long race, from late afternoon to low gold. */
const goldAt = (t: number) => ease(span(t, 58, 88));

function vgrad(ctx: Ctx, x: number, y0: number, w: number, y1: number, stops: readonly string[]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y0, w, y1 - y0);
}
/** A full-frame wash that respects any fade it is drawn inside. */
function wash(ctx: Ctx, color: string, amount: number, x = 0, y = 0, w = W, h = H) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(amount);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
/** The memory's grade: sepia, warm and faded, and perfectly steady. */
function sepia(ctx: Ctx, amount: number, x = 0, y = 0, w = W, h = H) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(amount) * 0.85;
  ctx.globalCompositeOperation = 'color';
  ctx.fillStyle = '#A8804E';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  wash(ctx, '#E8D2A8', amount * 0.3, x, y, w, h);
}
const blink = (seconds: number, seed: number) => (seconds + seed * 1.7) % (3.6 + seed * 0.4) < 0.13;
function glints(
  ctx: Ctx,
  seconds: number,
  n: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  color: string,
  seed = 3,
  drift = 0,
) {
  for (let i = 0; i < n; i++) {
    const a = 0.5 + 0.5 * Math.sin(seconds * (1.1 + rand(seed + i) * 1.4) + i * 2.1);
    if (a < 0.3) continue;
    const yy = rand(seed + i * 9.1) ** 1.5;
    const x = x0 + ((((rand(seed + i * 3.7) * w - drift * (0.4 + yy)) % w) + w) % w);
    const len = 2 + rand(seed + i * 5.3) * 6 * (0.3 + yy);
    box(ctx, x, y0 + yy * h, len, 1, alpha(color, a * 0.75));
  }
}

// ——— People ———
type Kind = 'marta' | 'luka' | 'young' | 'little' | 'rival';
type Who = {
  kind: Kind;
  skin: string;
  shade: string;
  hair: string;
  top: string;
  topD: string;
  legs: string;
  cap?: string;
  beard?: string;
};
const MARTA: Who = {
  kind: 'marta',
  skin: '#EDC3A0',
  shade: '#CC9C7C',
  hair: '#BFC3C7',
  top: NAVY,
  topD: '#212F50',
  legs: '#2B3346',
};
const LUKA: Who = {
  kind: 'luka',
  skin: '#E2AC84',
  shade: '#BF8A64',
  hair: '#5A3A24',
  top: BLUE,
  topD: '#2C5890',
  legs: '#2A3040',
  cap: BLUE,
  beard: '#5A3A24',
};
const YOUNG: Who = { ...MARTA, kind: 'young', skin: '#F0C8A4', shade: '#D2A484', hair: '#4A3226' };
const LITTLE: Who = {
  kind: 'little',
  skin: '#F2CBA8',
  shade: '#D6A886',
  hair: '#7A5234',
  top: '#E9E2CE',
  topD: '#CFC6B0',
  legs: '#3A5A86',
  cap: BLUE,
};
const rival = (top: string, skin: string, hair: string, cap?: string): Who => ({
  kind: 'rival',
  skin,
  shade: mix(skin, '#6A4030', 0.25),
  hair,
  top,
  topD: mix(top, '#0B0E14', 0.25),
  legs: '#2A2A32',
  cap,
});
const RIVAL_CREWS: readonly (readonly [Who, Who])[] = [
  [rival(RED, '#E8B896', '#D8D8D4'), rival(RED, '#C98F68', '#D8D8D4', RED)],
  [rival(GREEN, '#F0C4A0', '#A8A29A'), rival(GREEN, '#8C5A3C', '#2A2220')],
  [rival(WHITE, '#E4B08C', '#E8E6E0', '#E2DED2'), rival(WHITE, '#D49E78', '#6A5440')],
  [rival(PURPLE, '#F2C8A8', '#C9C4BC'), rival(PURPLE, '#B07850', '#3A2A22', PURPLE)],
];
const RIVAL_BLADES = [RED, GREEN, '#DCD8CC', PURPLE] as const;

type Seat = {
  who: Who;
  /** Seat position along the boat; the stroke seat is nearer the stern. */
  u: number;
  /** Oar side: 1 starboard, -1 port. */
  side: 1 | -1;
  oar: Oar;
  fs: number;
  blade: string;
  since: number;
  lean?: number;
  drop?: number;
  tiny?: boolean;
  smile?: boolean;
};
const U_STROKE = -1.25,
  U_BOW = 1.35;
function nowSeats(s: number): Seat[] {
  const her = herOar(s),
    his = hisOar(s);
  return [
    {
      who: MARTA,
      u: U_STROKE,
      side: 1,
      oar: her,
      fs: 1,
      blade: YELLOW,
      since: sinceLast(s, HER_STROKES, TOGETHER),
      lean: herLean(s, her),
      drop: slump(s),
      smile: s > 82,
    },
    {
      who: LUKA,
      u: U_BOW,
      side: -1,
      oar: his,
      fs: 1.14,
      blade: BLUE,
      since: sinceLast(s, HIS_STROKES, TOGETHER),
      smile: s > 82,
    },
  ];
}
function thenSeats(s: number): Seat[] {
  const hers = stroke(s, TOGETHER, 0.42, 0.36, 0.95);
  const his = stroke(s, TOGETHER, 0.34, 0.28, 0.95);
  const since = sinceLast(s, TOGETHER);
  return [
    {
      who: LITTLE,
      u: U_STROKE,
      side: 1,
      oar: his,
      fs: 0.66,
      blade: YELLOW,
      since,
      tiny: true,
      smile: true,
    },
    { who: YOUNG, u: U_BOW, side: -1, oar: hers, fs: 1, blade: BLUE, since, smile: true },
  ];
}
function rivalSeats(i: number, s: number): Seat[] {
  const oar = rivalOar(i, s);
  const since = sinceLast(s, RIVAL_STROKES[i]);
  const [a, b] = RIVAL_CREWS[i];
  return [
    { who: a, u: U_STROKE, side: 1, oar, fs: 1, blade: RIVAL_BLADES[i], since },
    { who: b, u: U_BOW, side: -1, oar, fs: 1.04, blade: RIVAL_BLADES[i], since },
  ];
}

// ——— The skiff, from the bank: a raked side view that holds for any heading ———
const HL = 8,
  HB = 0.62,
  GUN = 0.55;
const beam = (u: number) => HB * Math.max(0, 1 - Math.abs((2 * u) / HL) ** 2.4) ** 0.55;
const OUTLINE: readonly (readonly [number, number])[] = (() => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const u = -HL / 2 + (HL * i) / 10;
    pts.push([u, beam(u)]);
  }
  for (let i = 9; i >= 1; i--) {
    const u = -HL / 2 + (HL * i) / 10;
    pts.push([u, -beam(u)]);
  }
  return pts;
})();
const ALL = OUTLINE.map((_, i) => i);
const BOW_DECK = [9, 10, 11] as const;
const STERN_DECK = [19, 0, 1] as const;

type Skiff = {
  /** Screen position of the boat's centre at the waterline. */
  x: number;
  y: number;
  /** Pixels per plan unit along the boat. */
  k: number;
  /** 0 points the bow to screen right; +π/2 points it at the camera. */
  heading: number;
  /** How much the plan is squashed by the camera's height. */
  sq?: number;
  seats: readonly Seat[];
  oars?: boolean;
  name?: boolean;
  splash?: boolean;
};
type XY = readonly [number, number];
type Proj = (u: number, w: number, h: number) => XY;
function projector(b: Skiff): Proj {
  const c = Math.cos(b.heading),
    sn = Math.sin(b.heading),
    sq = b.sq ?? 0.28;
  return (u, w, h) => [b.x + (u * c - w * sn) * b.k, b.y + (u * sn + w * c) * b.k * sq - h * b.k];
}
const depthOf = (b: Skiff, u: number, w: number) =>
  u * Math.sin(b.heading) + w * Math.cos(b.heading);
const flat = (ids: readonly number[], pts: readonly XY[]) => {
  const out: number[] = [];
  for (const i of ids) out.push(pts[i][0], pts[i][1]);
  return out;
};

type OarGeo = { handle: XY; pin: XY; root: XY; tip: XY; far: boolean };
function oarGeom(b: Skiff, P: Proj, seat: Seat): OarGeo {
  const o = seat.oar;
  const L = seat.tiny ? 1.8 : 2.7,
    Lin = seat.tiny ? 0.62 : 0.95;
  const pu = seat.u - 0.55,
    pw = seat.side * (HB + 0.3);
  const du = Math.sin(o.phi),
    dw = seat.side * Math.cos(o.phi);
  const bh = o.lift > 0 ? o.lift * 0.6 : o.lift * 0.08;
  const along = (d: number, h: number) => P(pu + d * du, pw + d * dw, h);
  const rootAt = L - (seat.tiny ? 0.5 : 0.85);
  return {
    handle: along(-Lin, GUN + (seat.tiny ? 0.3 : 0.45)),
    pin: along(0, GUN + 0.12),
    root: along(rootAt, lerp(GUN + 0.12, bh, rootAt / L)),
    tip: along(L, bh),
    far: depthOf(b, pu + L * du, pw + L * dw) < depthOf(b, seat.u, 0),
  };
}
function oarOut(ctx: Ctx, b: Skiff, g: OarGeo, seat: Seat) {
  const k = b.k;
  line(ctx, SHAFT, Math.max(0.9, k * 0.1), [g.pin[0], g.pin[1], g.root[0], g.root[1]]);
  const th = k * lerp(0.05, seat.tiny ? 0.14 : 0.21, seat.oar.square);
  const wet = seat.oar.lift < 0;
  poly(ctx, wet ? mix(seat.blade, '#3E6E80', 0.4) : seat.blade, [
    g.root[0],
    g.root[1] - th * 0.55,
    g.tip[0],
    g.tip[1] - th,
    g.tip[0],
    g.tip[1] + th,
    g.root[0],
    g.root[1] + th * 0.55,
  ]);
  const mx = (g.root[0] + g.tip[0]) / 2,
    my = (g.root[1] + g.tip[1]) / 2;
  if (wet || seat.oar.lift < 0.05)
    oval(
      ctx,
      mx,
      my + th * 0.45,
      Math.abs(g.tip[0] - g.root[0]) / 2 + k * 0.28,
      Math.max(0.8, k * 0.08),
      alpha(FOAM, wet ? 0.6 : 0.3),
    );
  if (b.splash !== false && seat.since < 0.55) {
    const q = seat.since / 0.55;
    for (let i = 0; i < 6; i++) {
      const a = (i / 5 - 0.5) * 2.2;
      const r = k * (0.35 + rand(i * 7.7 + seat.u) * 0.5) * (seat.tiny ? 0.6 : 1);
      disc(
        ctx,
        g.tip[0] + Math.sin(a) * r * q * 1.4,
        g.tip[1] - Math.sin(Math.PI * q) * r * (1.2 + rand(i * 3.1) * 0.8),
        Math.max(0.6, k * 0.06 * (1 - q * 0.5)),
        alpha(FOAM, 0.9 * (1 - q)),
      );
    }
  }
}
function oarIn(ctx: Ctx, k: number, g: OarGeo) {
  line(ctx, SHAFT, Math.max(0.9, k * 0.1), [g.handle[0], g.handle[1], g.pin[0], g.pin[1]]);
  line(ctx, '#9A7650', Math.max(1, k * 0.12), [
    g.handle[0],
    g.handle[1],
    lerp(g.handle[0], g.pin[0], 0.3),
    lerp(g.handle[1], g.pin[1], 0.3),
  ]);
  disc(ctx, g.pin[0], g.pin[1], Math.max(0.7, k * 0.07), '#8E9399');
}

/** A two-bone limb from `a` to `b`; the joint bends toward `bend` (+1 down, -1 up). */
function limb(ctx: Ctx, a: XY, b: XY, len: number, width: number, color: string, bend: 1 | -1) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  const off = Math.sqrt(Math.max(0, len * len - (Math.min(d, len * 2) / 2) ** 2));
  let px = -dy / d,
    py = dx / d;
  if (py * bend < 0) {
    px = -px;
    py = -py;
  }
  line(ctx, color, width, [
    a[0],
    a[1],
    a[0] + dx / 2 + px * off,
    a[1] + dy / 2 + py * off,
    b[0],
    b[1],
  ]);
}
function pose(b: Skiff, P: Proj, seat: Seat, f: number) {
  const z = (b.k / 8.4) * seat.fs;
  const slide = lerp(0.3, -0.5, seat.oar.c) * (seat.tiny ? 0.5 : 1);
  const hip = P(seat.u + 0.15 + slide, 0, 0.28);
  const lean = seat.lean ?? leanOf(seat.oar);
  const drop = seat.drop ?? 0;
  const dx = f * Math.sin(lean),
    dy = -Math.cos(lean);
  const torso = 9 * z;
  const sh: XY = [hip[0] + dx * torso, hip[1] + dy * torso + drop * 1.5 * z];
  const head: XY = [
    hip[0] + dx * (torso + 4.8 * z) + f * drop * 1.2 * z,
    hip[1] + dy * (torso + 4.8 * z) + drop * 3 * z,
  ];
  return { z, hip, sh, head };
}
function headSide(ctx: Ctx, who: Who, x: number, y: number, z: number, f: number, smile = false) {
  const r = 4.4 * z;
  const at2 = (dx: number, dy: number): XY => [x + f * dx * z, y + dy * z];
  const blob = (dx: number, dy: number, rx: number, ry: number, c: string) => {
    const [px, py] = at2(dx, dy);
    oval(ctx, px, py, rx * z, ry * z, c);
  };
  if (who.kind === 'marta' || who.kind === 'young') {
    blob(-1.3, -0.9, 3.8, 3.9, who.hair);
    blob(-3.9, -2.9, 2.0, 2.0, who.hair);
  } else if (who.kind === 'rival' && !who.cap) blob(-1.2, -1, 3.9, 3.8, who.hair);
  oval(ctx, x + f * 0.4 * z, y, r * 0.95, r, who.skin);
  blob(4.3, 0.6, 0.95, 0.95, who.skin);
  if (z > 1.3) blob(-0.5, 0.5, 0.9, 1.3, who.shade);
  const dark = (c: string) => mix(c, '#0B0E14', 0.3);
  const brim = (from: XY, to: XY, c: string, w: number) =>
    line(ctx, dark(c), w * z, [from[0], from[1], to[0], to[1]]);
  switch (who.kind) {
    case 'marta':
    case 'young':
      blob(-0.6, -2.3, 3.9, 2.4, who.hair);
      break;
    case 'luka':
      // A beard on the jaw only, so the eye, cheek and nose sit on skin under the cap.
      blob(1.8, 3.0, 2.8, 1.7, who.beard ?? who.hair);
      blob(-0.6, 1.2, 1.0, 1.8, who.beard ?? who.hair);
      blob(-0.2, -3.0, 4.5, 2.2, who.cap ?? who.hair);
      brim(at2(2.6, -2.2), at2(6.6, -1.7), who.cap ?? BLUE, 1.3);
      break;
    case 'little':
      blob(-0.3, -2.4, 5.2, 3.1, who.cap ?? BLUE);
      brim(at2(2.8, -1.7), at2(7.6, -1.1), who.cap ?? BLUE, 1.4);
      break;
    default:
      if (who.cap) {
        blob(-0.2, -2.3, 4.5, 2.6, who.cap);
        brim(at2(2.6, -1.6), at2(6, -1.1), who.cap, 1.2);
      } else blob(-0.8, -2.4, 3.7, 2.1, who.hair);
  }
  const [ex, ey] = at2(2.2, -0.4);
  if (z >= 1.7) {
    oval(ctx, ex, ey, 0.95 * z, 1.05 * z, '#F8F4EE');
    disc(ctx, ex + f * 0.35 * z, ey + 0.1 * z, 0.58 * z, INK);
  } else box(ctx, ex - 0.5 * z, ey - 0.7 * z, Math.max(1, z * 0.9), Math.max(1, 1.4 * z), INK);
  if (z >= 1.3) {
    const pts = smile
      ? [...at2(2.0, 2.2), ...at2(2.9, 2.8), ...at2(3.8, 2.3)]
      : [...at2(2.3, 2.6), ...at2(3.7, 2.6)];
    line(ctx, who.kind === 'luka' ? '#2A1A12' : INK, 0.5 * z, pts);
  }
}
/** Luka's beard on a `person()` sprite, in the sprite's own units, so he matches his close-ups. */
function spriteBeard(ctx: Ctx, x: number, y: number, f: Figure) {
  const size = f.size ?? 1;
  const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((f.facing ?? 1) * size, size);
  // The sprite's hip; its head runs from 24 to 13 units above it.
  ctx.translate(0, -11 - bob);
  box(ctx, -1, -17.5, 2, 4.5, LUKA.beard ?? LUKA.hair);
  box(ctx, -1, -14, 7, 2.4, LUKA.beard ?? LUKA.hair);
  ctx.restore();
}
function legsSide(ctx: Ctx, b: Skiff, P: Proj, seat: Seat, f: number) {
  const { z, hip } = pose(b, P, seat, f);
  const foot = P(seat.u - (seat.tiny ? 0.9 : 1.3), 0, 0.32);
  limb(ctx, hip, foot, (seat.tiny ? 3.8 : 5.6) * z, 3.2 * z, seat.who.legs, -1);
  oval(ctx, foot[0], foot[1], 1.8 * z, 1.1 * z, '#2A2228');
}
function rowerSide(
  ctx: Ctx,
  b: Skiff,
  P: Proj,
  seat: Seat,
  g: OarGeo,
  f: number,
  part: 'body' | 'arm',
) {
  const { z, hip, sh, head } = pose(b, P, seat, f);
  const who = seat.who;
  const arm = (seat.tiny ? 3.4 : 4.9) * z;
  const club = who.kind === 'marta' || who.kind === 'young';
  if (part === 'arm') {
    limb(ctx, sh, g.handle, arm, 2.3 * z, who.top, 1);
    if (club) disc(ctx, g.handle[0] - f * 0.9 * z, g.handle[1], 1.0 * z, YELLOW);
    disc(ctx, g.handle[0], g.handle[1], 1.25 * z, who.skin);
    return;
  }
  const farHand: XY = [lerp(g.handle[0], g.pin[0], 0.22), lerp(g.handle[1], g.pin[1], 0.22)];
  limb(ctx, [sh[0] - f * 0.8 * z, sh[1] + 0.6 * z], farHand, arm, 2.2 * z, who.topD, 1);
  disc(ctx, farHand[0], farHand[1], 1.15 * z, who.shade);
  line(ctx, who.top, (seat.tiny ? 5 : 6.2) * z, [hip[0], hip[1] - 1.5 * z, sh[0], sh[1]]);
  if (club)
    line(ctx, YELLOW, 1.1 * z, [
      sh[0] - f * 1.6 * z,
      sh[1] - 0.6 * z,
      sh[0] + f * 1.8 * z,
      sh[1] - 0.2 * z,
    ]);
  headSide(ctx, who, head[0], head[1], z * (seat.tiny ? 1.2 : 1), f, seat.smile);
}
/** End-on: the rowers face the camera (stern toward us) or show their backs. */
function rowerEnd(
  ctx: Ctx,
  b: Skiff,
  P: Proj,
  seat: Seat,
  g: OarGeo,
  front: boolean,
  part: 'body' | 'arm',
) {
  const z = (b.k / 8.4) * seat.fs;
  const who = seat.who;
  const slide = lerp(0.3, -0.5, seat.oar.c);
  const hip = P(seat.u + 0.15 + slide, 0, 0.28);
  const lean = seat.lean ?? leanOf(seat.oar);
  const drop = seat.drop ?? 0;
  const top: XY = [hip[0], hip[1] - 9 * z * (1 - 0.15 * Math.abs(Math.sin(lean))) + drop * 1.5 * z];
  if (part === 'arm') {
    for (const sd of [-1, 1]) {
      const hand: XY = [g.handle[0] + sd * 1.2 * z, g.handle[1]];
      limb(ctx, [top[0] + sd * 3.4 * z, top[1] + 1 * z], hand, 4.9 * z, 2.2 * z, who.top, 1);
      disc(ctx, hand[0], hand[1], 1.2 * z, who.skin);
    }
    return;
  }
  poly(ctx, who.top, [
    hip[0] - 3.4 * z,
    hip[1],
    hip[0] + 3.4 * z,
    hip[1],
    top[0] + 4.2 * z,
    top[1] + 1.2 * z,
    top[0] - 4.2 * z,
    top[1] + 1.2 * z,
  ]);
  const hx = top[0],
    hy = top[1] - 4.4 * z + drop * 2 * z;
  const club = who.kind === 'marta' || who.kind === 'young';
  if (club)
    line(ctx, YELLOW, 1 * z, [
      top[0] - 2.6 * z,
      top[1] + 0.6 * z,
      top[0] + 2.6 * z,
      top[1] + 0.6 * z,
    ]);
  if (!front && club) disc(ctx, hx, hy - 2.6 * z, 2 * z, who.hair);
  disc(ctx, hx, hy, 4.2 * z, who.skin);
  if (who.cap) oval(ctx, hx, hy - 2 * z, 4.6 * z, 2.8 * z, who.cap);
  else if (front) oval(ctx, hx, hy - 2.4 * z, 4.3 * z, 2.2 * z, who.hair);
  else oval(ctx, hx, hy - 0.6 * z, 4.3 * z, 3.8 * z, who.hair);
  if (front && z > 0.7) {
    box(ctx, hx - 1.8 * z, hy - 0.3 * z, Math.max(1, 0.8 * z), Math.max(1, 1.2 * z), INK);
    box(ctx, hx + 1.0 * z, hy - 0.3 * z, Math.max(1, 0.8 * z), Math.max(1, 1.2 * z), INK);
    if (who.beard) oval(ctx, hx, hy + 2.6 * z, 3.4 * z, 1.8 * z, who.beard);
  }
}
function skiff(ctx: Ctx, b: Skiff) {
  const P = projector(b);
  const k = b.k;
  const lo = OUTLINE.map(([u, w]) => P(u, w, 0));
  const hi = OUTLINE.map(([u, w]) => P(u, w, GUN));
  const n = lo.length;
  let iL = 0,
    iR = 0;
  for (let i = 1; i < n; i++) {
    if (lo[i][0] < lo[iL][0]) iL = i;
    if (lo[i][0] > lo[iR][0]) iR = i;
  }
  const walk = (a: number, z: number) => {
    const ids: number[] = [];
    for (let i = a; ; i = (i + 1) % n) {
      ids.push(i);
      if (i === z) break;
    }
    return ids;
  };
  const A = walk(iL, iR),
    B = walk(iR, iL);
  const meanY = (ids: number[]) => ids.reduce((sum, i) => sum + lo[i][1], 0) / ids.length;
  const near = meanY(A) >= meanY(B) ? A : B;
  const seats = [...b.seats].sort((a, c) => depthOf(b, a.u, 0) - depthOf(b, c.u, 0));
  const oars = b.oars !== false;
  const geo = seats.map((seat) => oarGeom(b, P, seat));
  const cos = Math.cos(b.heading);
  const side = Math.abs(cos) > 0.42;
  const f = cos > 0 ? -1 : 1;
  const front = Math.sin(b.heading) < 0;
  // The boat's shadow on the water, then the far blades.
  poly(
    ctx,
    alpha('#0B1A22', 0.2),
    flat(ALL, lo).map((v, i) => (i % 2 ? v + k * 0.14 : v)),
  );
  if (oars) seats.forEach((seat, i) => geo[i].far && oarOut(ctx, b, geo[i], seat));
  poly(ctx, INSIDE, flat(ALL, hi));
  poly(ctx, DECK, flat(BOW_DECK, hi));
  poly(ctx, DECK, flat(STERN_DECK, hi));
  if (side) seats.forEach((seat) => legsSide(ctx, b, P, seat, f));
  poly(ctx, HULL, [...flat(near, lo), ...flat([...near].reverse(), hi)]);
  line(ctx, alpha(HULL_D, 0.7), Math.max(0.7, k * 0.07), flat(near, lo));
  line(ctx, HULL_HI, Math.max(0.8, k * 0.09), flat(near, hi));
  if (b.name && side && k >= 7) {
    const sd = cos > 0 ? 1 : -1;
    const [nx, ny] = P(2.5, sd * beam(2.5), GUN * 0.5);
    for (let i = 0; i < 5; i++)
      box(
        ctx,
        nx + (i - 2.5) * k * 0.13,
        ny - k * 0.08,
        Math.max(1, k * 0.08),
        Math.max(1, k * 0.14),
        alpha(CREAM, 0.9),
      );
  }
  if (oars) seats.forEach((_, i) => geo[i].far && oarIn(ctx, k, geo[i]));
  seats.forEach((seat, i) =>
    side
      ? rowerSide(ctx, b, P, seat, geo[i], f, 'body')
      : rowerEnd(ctx, b, P, seat, geo[i], front, 'body'),
  );
  if (oars) seats.forEach((_, i) => !geo[i].far && oarIn(ctx, k, geo[i]));
  seats.forEach((seat, i) =>
    side
      ? rowerSide(ctx, b, P, seat, geo[i], f, 'arm')
      : rowerEnd(ctx, b, P, seat, geo[i], front, 'arm'),
  );
  if (oars) seats.forEach((seat, i) => !geo[i].far && oarOut(ctx, b, geo[i], seat));
}

// ——— The skiff from above ———
const K = 4.5;
function skiffTop(
  ctx: Ctx,
  x: number,
  y: number,
  k: number,
  heading: number,
  seats: readonly Seat[],
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  const pts = (ids: readonly number[], sw = 1, su = 1) => {
    const out: number[] = [];
    for (const i of ids) out.push(OUTLINE[i][0] * k * su, OUTLINE[i][1] * k * sw);
    return out;
  };
  poly(ctx, HULL, pts(ALL, 1.15));
  poly(ctx, INSIDE, pts(ALL, 0.7, 0.9));
  poly(ctx, DECK, pts(BOW_DECK, 1.15));
  poly(ctx, DECK, pts(STERN_DECK, 1.15));
  for (const seat of seats) {
    const o = seat.oar;
    const L = seat.tiny ? 2.1 : 3.3,
      Lin = 0.95;
    const pu = seat.u - 0.55,
      pw = seat.side * (HB + 0.3);
    const du = Math.sin(o.phi),
      dw = seat.side * Math.cos(o.phi);
    line(ctx, SHAFT, Math.max(0.8, k * 0.14), [
      (pu - Lin * du) * k,
      (pw - Lin * dw) * k,
      (pu + (L - 0.9) * du) * k,
      (pw + (L - 0.9) * dw) * k,
    ]);
    oval(
      ctx,
      (pu + (L - 0.45) * du) * k,
      (pw + (L - 0.45) * dw) * k,
      0.24 * k,
      0.55 * k * (seat.tiny ? 0.7 : 1),
      o.lift < 0 ? mix(seat.blade, WATER_TOP, 0.3) : seat.blade,
      Math.atan2(dw, du) - Math.PI / 2,
    );
  }
  for (const seat of seats) {
    const z = seat.fs * (seat.tiny ? 0.85 : 1);
    const cx = (seat.u - (seat.oar.c - 0.5) * 0.5) * k;
    oval(ctx, cx, 0, 0.42 * k * z, 0.7 * k * z, seat.who.top);
    disc(ctx, cx, 0, 0.36 * k * z, seat.who.cap ?? seat.who.hair);
    if (seat.who.kind === 'marta' || seat.who.kind === 'young')
      disc(ctx, cx + 0.32 * k, 0, 0.2 * k, seat.who.hair);
  }
  ctx.restore();
}
type TopView = { x: number; y: number; zoom: number };
/** The river from straight above, in plan units; `then` drops the lanes and the other crews. */
function riverTop(ctx: Ctx, t: number, seconds: number, view: TopView, then: boolean) {
  camera(
    ctx,
    { x: view.x * K, y: view.y * K, zoom: view.zoom },
    () => {
      const hw = W / 2 / view.zoom / K + 4,
        hh = H / 2 / view.zoom / K + 4;
      const x0 = view.x - hw,
        x1 = view.x + hw;
      box(ctx, x0 * K, (view.y - hh) * K, (x1 - x0) * K, hh * 2 * K, WATER_TOP);
      box(ctx, x0 * K, -9 * K, (x1 - x0) * K, 18 * K, alpha('#447A8E', 0.6));
      for (const sd of [-1, 1]) {
        const edge = sd * 20.5;
        box(ctx, x0 * K, (sd < 0 ? edge - 30 : edge) * K, (x1 - x0) * K, 30 * K, BANK_TOP);
        box(ctx, x0 * K, (sd < 0 ? edge - 0.8 : edge) * K, (x1 - x0) * K, 0.8 * K, '#B8A878');
        for (let i = Math.floor(x0 / 7); i <= Math.ceil(x1 / 7); i++) {
          const tx = i * 7 + rand(i * 3.3 + sd) * 4,
            ty = sd * (23.2 + rand(i * 5.1 + sd) * 3);
          disc(ctx, tx * K, ty * K, (2 + rand(i * 1.7 + sd) * 1.3) * K, TREE_TOP);
          disc(ctx, (tx - 0.5) * K, (ty - 0.6) * K, 1.2 * K, '#77985A');
        }
      }
      for (let i = 0; i < 30; i++) {
        const rx = view.x - hw + rand(i * 4.3) * hw * 2,
          ry = -19 + rand(i * 6.1) * 38;
        const a = 0.5 + 0.5 * Math.sin(seconds * 1.4 + i * 1.9);
        box(ctx, rx * K, ry * K, 3 + rand(i) * 5, 1, alpha('#9CC4CF', 0.4 * a));
      }
      if (!then) {
        for (const ly of [-18.5, -13.5, -8.5, -3.5, 1.5, 6.5])
          for (let bx = Math.ceil(Math.max(x0, -6) / 5) * 5; bx <= Math.min(x1, 86); bx += 5)
            box(
              ctx,
              bx * K - 1,
              ly * K - 1,
              2,
              2,
              alpha((bx / 5) % 2 ? '#F2F0E8' : '#E88A3A', 0.55),
            );
        // The rivals, and their dead-straight wakes.
        RIVAL_LANES.forEach((ly, i) => {
          const rx = rivalRun(i, t);
          if (rx - 6 > x1 || rx + 6 < x0) return;
          line(ctx, alpha(FOAM, 0.35), 1.6, [
            Math.max(-4, rx - 40) * K,
            ly * K,
            (rx - 4) * K,
            ly * K,
          ]);
          skiffTop(ctx, rx * K, ly * K, K, 0, rivalSeats(i, t));
        });
      }
      // Her wake: the stern's own path, sampled back in time.
      const pts: (readonly [number, number, number])[] = [];
      const from = then ? t - 9 : SPIN;
      const here = POSITION(t);
      for (let back = 0; back <= 40; back += 0.25) {
        const s = t - back;
        if (s < from) break;
        const p = then ? { x: here.x - 4 - GLIDE_V * back, y: here.y } : sternAt(s);
        pts.push([p.x * K, p.y * K, back]);
      }
      // In the race the wake is the story (a spiral, then a line), so it is drawn bolder.
      const [wide, bright] = then ? [1.6, 0.6] : [2.2, 0.8];
      for (let i = 0; i + 1 < pts.length; i += 8) {
        const seg = pts.slice(i, i + 9);
        const age = seg[0][2];
        const xy: number[] = [];
        for (const [x, y] of seg) xy.push(x, y);
        line(ctx, alpha(FOAM, bright * (1 - age / 40)), wide, xy);
      }
      if (!then) {
        // Puddles left by each catch through the spin: the spiral in miniature.
        for (const [list, sd] of [
          [HER_STROKES, 1],
          [HIS_STROKES, -1],
        ] as const)
          for (const c of list) {
            const age = t - c;
            if (age < 0 || age > 7) continue;
            const p = POSITION(c),
              th = HEADING(c);
            const reach = sd > 0 ? 0.4 : 0.9;
            const pu = (sd > 0 ? U_STROKE : U_BOW) - 0.55 + 3.3 * Math.sin(reach),
              pw = sd * (HB + 0.3 + 3.3 * Math.cos(reach));
            const wx = p.x + pu * Math.cos(th) - pw * Math.sin(th),
              wy = p.y + pu * Math.sin(th) + pw * Math.cos(th);
            const r = (0.3 + age * 0.18) * K;
            oval(ctx, wx * K, wy * K, r, r * 0.8, alpha(FOAM, 0.22 * (1 - age / 7)));
          }
      }
      skiffTop(ctx, here.x * K, here.y * K, K, HEADING(t), then ? thenSeats(t) : nowSeats(t));
    },
    null,
  );
}

// ——— Close-ups: faces that act ———
type Face = {
  eyes?: 'open' | 'half' | 'closed' | 'down' | 'wide' | 'happy' | 'squeeze';
  look?: readonly [number, number];
  /** Positive lifts the inner ends (worry); negative knits them (anger, strain). */
  brows?: number;
  raise?: number;
  mouth?:
    'flat' | 'soft' | 'smile' | 'grin' | 'talk' | 'open' | 'teeth' | 'laugh' | 'press' | 'part';
  turn?: number;
  tilt?: number;
  flush?: number;
  sweat?: number;
  key?: string;
  keyAmount?: number;
  breath?: number;
  wisps?: number;
};
function portrait(ctx: Ctx, who: Who, x: number, y: number, s: number, f: Face) {
  const u = (f.turn ?? 0) * 6;
  const flush = f.flush ?? 0;
  const skin = mix(who.skin, '#E86C5C', flush * 0.42),
    shade = mix(who.shade, '#B84A44', flush * 0.4);
  const old = who.kind === 'marta';
  const big = who.kind === 'luka';
  const lift = -(f.breath ?? 0) * 2.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (big) {
    poly(ctx, who.top, [
      -56,
      100,
      -52,
      46 + lift,
      -22,
      30 + lift * 0.4,
      22,
      30 + lift * 0.4,
      52,
      46 + lift,
      56,
      100,
    ]);
    poly(ctx, who.topD, [-56, 100, -52, 46 + lift, -38, 38, -38, 100]);
    box(ctx, -9.5 + u * 0.25, 10, 19, 24, shade);
    line(ctx, '#86AEDC', 2.6, [-14, 30, -6, 37, 6, 37, 14, 30]);
  } else {
    poly(ctx, who.top, [
      -48,
      100,
      -45,
      47 + lift,
      -18,
      32 + lift * 0.4,
      18,
      32 + lift * 0.4,
      45,
      47 + lift,
      48,
      100,
    ]);
    poly(ctx, who.topD, [-48, 100, -45, 47 + lift, -34, 40, -34, 100]);
    box(ctx, -7 + u * 0.25, 12, 14, 20, shade);
    poly(ctx, who.top, [-15, 25 + lift * 0.3, 15, 25 + lift * 0.3, 18, 37, -18, 37]);
    line(ctx, YELLOW, 1.8, [-15, 26.5 + lift * 0.3, 15, 26.5 + lift * 0.3]);
    line(ctx, '#C9CDD6', 1, [0, 37, 0, 100]);
  }
  ctx.translate(0, 20);
  ctx.rotate(f.tilt ?? 0);
  ctx.translate(0, -20);
  const hairD = mix(who.hair, '#0B0E14', 0.18);
  if (who.kind === 'marta' || who.kind === 'young') disc(ctx, u * 0.3 + 3, -24, 8.5, hairD);
  const fw = big ? 21 : 18.5,
    fh = big ? 23.5 : 22.5;
  if (u < 5) oval(ctx, -fw - 0.6 + u * 0.35, 3, 3.6, 6, skin);
  if (u > -5) oval(ctx, fw + 0.6 + u * 0.35, 3, 3.6, 6, skin);
  if (old) {
    if (u < 5) disc(ctx, -fw - 0.8 + u * 0.35, 8.5, 1.4, CREAM);
    if (u > -5) disc(ctx, fw + 0.8 + u * 0.35, 8.5, 1.4, CREAM);
  }
  oval(ctx, u * 0.15, 0, fw, fh, skin);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(u * 0.15, 0, fw, fh, 0, 0, Math.PI * 2);
  ctx.clip();
  oval(ctx, -u * 2.6 + (u >= 0 ? -fw - 2 : fw + 2), 4, 12, 26, alpha(shade, 0.5));
  if (f.key && (f.keyAmount ?? 0) > 0) glow(ctx, 14, -8, 40, f.key, f.keyAmount);
  if (flush > 0) {
    oval(ctx, u - 11, 7, 6, 4, alpha('#E2564C', 0.3 * flush));
    oval(ctx, u + 11, 7, 6, 4, alpha('#E2564C', 0.3 * flush));
  }
  ctx.restore();
  if (old) {
    // Seventy years: the forehead, the crow's feet, the folds by the mouth.
    line(ctx, alpha(shade, 0.85), 0.9, [u - 9, -13.5, u - 2, -14.6, u + 8, -13.5]);
    line(ctx, alpha(shade, 0.7), 0.8, [u - 6, -16.8, u + 5, -16.8]);
    line(ctx, shade, 1, [u - 5.5, 8, u - 8.6, 13.5, u - 8.4, 17.6]);
    line(ctx, shade, 1, [u + 5.5, 8, u + 8.4, 13, u + 8, 16.8]);
    for (const sd of [-1, 1]) {
      const ex = sd * 8 + u;
      line(ctx, alpha(shade, 0.85), 0.8, [ex + sd * 5.6, -3.4, ex + sd * 8.4, -5]);
      line(ctx, alpha(shade, 0.85), 0.8, [ex + sd * 5.6, -0.8, ex + sd * 8.4, -0.4]);
      line(ctx, alpha(shade, 0.8), 0.9, [ex - 3.5, 4.4, ex, 5.8, ex + 3.5, 4.4]);
    }
  }
  if (big) {
    const beard = who.beard ?? who.hair;
    poly(ctx, beard, [
      -21 + u * 0.1,
      0,
      -20 + u * 0.15,
      12,
      -13 + u * 0.6,
      22,
      u,
      27,
      13 + u * 0.6,
      22,
      20 + u * 0.15,
      12,
      21 + u * 0.1,
      0,
      16 + u,
      7,
      11 + u,
      11,
      u,
      12.5,
      -11 + u,
      11,
      -16 + u,
      7,
    ]);
  }
  // Eyes. Her right lid sits a little heavier since the stroke.
  const eyes = f.eyes ?? 'open';
  const [lx, ly] = f.look ?? [0, 0];
  const iris = big ? '#5A3A22' : old ? '#5E7488' : '#4A3A2A';
  for (const sd of [-1, 1]) {
    const ex = sd * 8 + u,
      ey = -2;
    if (eyes === 'closed') {
      line(ctx, INK, 1.3, [ex - 4.2, ey + 0.6, ex, ey + 2.4, ex + 4.2, ey + 0.6]);
      continue;
    }
    if (eyes === 'happy') {
      line(ctx, INK, 1.6, [ex - 4.4, ey + 1.6, ex, ey - 1.8, ex + 4.4, ey + 1.6]);
      continue;
    }
    if (eyes === 'squeeze') {
      line(ctx, INK, 1.6, [ex - 4.4, ey - 0.4 * sd, ex, ey + 0.6, ex + 4.4, ey + 0.4 * sd]);
      line(ctx, alpha(shade, 0.9), 0.9, [ex - 3, ey + 3.2, ex + 3, ey + 3.6]);
      continue;
    }
    const wide = eyes === 'wide' ? 1.15 : 1;
    const px = ex + lx * 1.7,
      py = ey + ly * 1.5 + (eyes === 'down' ? 1.6 : 0);
    oval(ctx, ex, ey, 4.5 * wide, 4.7 * wide, '#F8F4EE');
    disc(ctx, px, py + 0.4, 2.7, iris);
    disc(ctx, px, py + 0.4, 1.3, INK);
    disc(ctx, px - 0.9, py - 0.5, 0.8, '#FFFFFF');
    const droop = old && sd < 0 ? 0.14 : 0;
    const base =
      eyes === 'half' ? 0.55 : eyes === 'down' ? 0.6 : eyes === 'wide' ? 0 : old ? 0.26 : 0.14;
    const topY = ey - 5.4 * wide,
      cut = topY + (base + droop) * 9.6;
    poly(ctx, skin, [ex - 5.6, topY - 1, ex + 5.6, topY - 1, ex + 5.6, cut, ex - 5.6, cut]);
    line(ctx, INK, 1.2, [ex - 4.6, cut + 0.6, ex, cut - 0.2, ex + 4.6, cut + 0.6]);
  }
  // Brows.
  const browC = old ? '#9DA2A8' : big ? '#4A2E1C' : '#3A2418';
  const b = f.brows ?? 0;
  for (const sd of [-1, 1]) {
    const ex = sd * 8 + u;
    const base = big ? -9.4 - (f.raise ?? 0) * 1.8 : -10.5 - (f.raise ?? 0) * 3.5;
    line(ctx, browC, big ? 2.8 : 2, [ex + sd * 5.4, base + b * 0.8, ex - sd * 4, base - b * 2.4]);
  }
  // Nose.
  oval(ctx, u * 1.15, 7.5, big ? 3.2 : 2.6, 3.2, shade);
  oval(ctx, u * 1.15 - 0.7, 6.3, 1.1, 1.3, alpha('#FFFFFF', 0.25));
  // Mouth. Hers falls a little at the right corner (screen left).
  const mx = u,
    my = big ? 16.5 : 15.5;
  const dl = old ? 1.5 : 0;
  const lip = big ? '#3A1E14' : '#5A2A24';
  switch (f.mouth ?? 'flat') {
    case 'flat':
      line(ctx, lip, 1.4, [mx - 5, my + 1 + dl, mx + 5, my + 1]);
      break;
    case 'soft':
      line(ctx, lip, 1.4, [
        mx - 5.5,
        my + 0.2 + dl,
        mx - 2,
        my + 1.6,
        mx + 2,
        my + 1.6,
        mx + 5.5,
        my + 0.2,
      ]);
      break;
    case 'smile':
      line(ctx, lip, 1.4, [
        mx - 6,
        my - 0.4 + dl * 0.6,
        mx - 2.5,
        my + 2.4,
        mx + 2.5,
        my + 2.4,
        mx + 6,
        my - 0.6,
      ]);
      break;
    case 'press':
      line(ctx, lip, 1.6, [mx - 5, my + 2 + dl, mx, my + 0.8, mx + 5, my + 2]);
      break;
    case 'part':
      oval(ctx, mx, my + 1.4, 3.6, 1.6, lip);
      break;
    case 'talk':
      oval(ctx, mx, my + 1.8, 3.4, 2.9, lip);
      oval(ctx, mx, my + 3.2, 2, 1, '#B8605A');
      break;
    case 'open':
      oval(ctx, mx, my + 2, 4.2, 3.8, lip);
      box(ctx, mx - 3, my - 1.4, 6, 1.6, '#F4EEE4');
      break;
    case 'grin':
      poly(ctx, lip, [
        mx - 7.5,
        my - 1,
        mx + 7.5,
        my - 1.2,
        mx + 4.5,
        my + 4.8,
        mx - 4.5,
        my + 4.8,
      ]);
      poly(ctx, '#F4EEE4', [
        mx - 6.4,
        my - 0.6,
        mx + 6.4,
        my - 0.8,
        mx + 5.6,
        my + 1.2,
        mx - 5.6,
        my + 1.2,
      ]);
      break;
    case 'teeth':
      poly(ctx, lip, [mx - 8.5, my - 1.8, mx + 8.5, my - 1.8, mx + 7.5, my + 4, mx - 7.5, my + 4]);
      box(ctx, mx - 7, my - 1, 14, 4.2, '#F2ECE0');
      line(ctx, alpha(lip, 0.8), 0.8, [mx - 7, my + 1.1, mx + 7, my + 1.1]);
      break;
    case 'laugh':
      poly(ctx, lip, [
        mx - 8,
        my - 1.6 + dl * 0.5,
        mx + 8,
        my - 1.8,
        mx + 5,
        my + 7.4,
        mx - 5,
        my + 7.4,
      ]);
      poly(ctx, '#F4EEE4', [
        mx - 6.8,
        my - 1.1 + dl * 0.4,
        mx + 6.8,
        my - 1.3,
        mx + 6,
        my + 0.8,
        mx - 6,
        my + 0.8,
      ]);
      oval(ctx, mx, my + 5.4, 3.6, 1.8, '#C8645E');
      break;
  }
  if (big) {
    // The moustache sits over whatever the mouth is doing.
    poly(ctx, who.beard ?? who.hair, [
      u - 9,
      12.6,
      u,
      10.4,
      u + 9,
      12.6,
      u + 7,
      14,
      u,
      12.8,
      u - 7,
      14,
    ]);
  }
  // Hair, and his cap.
  const h = (points: number[], color = who.hair) =>
    poly(
      ctx,
      color,
      points.map((v, i) => (i % 2 ? v : v + u * 0.3)),
    );
  if (who.kind === 'marta' || who.kind === 'young') {
    h([
      -19, -2, -18.5, -13, -13, -20.5, -4, -24, 6, -24, 14, -20.5, 18.5, -13, 19.5, -2, 16, -10, 9,
      -15.5, 0, -17, -9, -15.5, -15, -10,
    ]);
    line(ctx, hairD, 0.9, [-10 + u * 0.3, -19.5, -2 + u * 0.3, -22.5, 9 + u * 0.3, -21]);
    line(ctx, mix(who.hair, '#FFFFFF', 0.3), 0.9, [-14 + u * 0.3, -14, -6 + u * 0.3, -19.5]);
    const w = f.wisps ?? 0;
    if (w > 0) {
      line(ctx, alpha(who.hair, w), 0.9, [16 + u * 0.3, -11, 20.5 + u * 0.3, -4, 19 + u * 0.3, 4]);
      line(ctx, alpha(who.hair, w), 0.9, [
        -15 + u * 0.3,
        -12,
        -19.5 + u * 0.3,
        -6,
        -18.5 + u * 0.3,
        1,
      ]);
    }
  } else if (big) {
    const cap = who.cap ?? BLUE,
      dark = mix(cap, '#0B0E14', 0.35);
    h([-22, -3, -21, -13, -16, -12, -16, -3]);
    h([22, -3, 21, -13, 16, -12, 16, -3]);
    h([-23, -14, -22, -27, -12, -34, 12, -34, 22, -27, 23, -14], cap);
    h([-23, -17.5, 23, -17.5, 23, -14, -23, -14], mix(cap, '#0B0E14', 0.15));
    h([-22, -14.5, 22, -14.5, 19, -11.6, -19, -11.6], dark);
    line(ctx, alpha('#FFFFFF', 0.25), 1, [-14 + u * 0.3, -13.6, 14 + u * 0.3, -13.6]);
  }
  const sweat = f.sweat ?? 0;
  if (sweat > 0) {
    oval(ctx, u + 15, -9, 1.3, 2.1, alpha('#F4FAFF', 0.85 * sweat));
    oval(ctx, u - 16, -4, 1.1, 1.8, alpha('#F4FAFF', 0.7 * sweat));
  }
  ctx.restore();
}

// ——— Hands, for the inserts ———
type HandOpts = {
  open?: number;
  white?: number;
  sleeve: string;
  cuff?: string;
  old?: boolean;
  /** How far the sleeve runs back from the wrist, in hand units. */
  reach?: number;
};
/** The back of a hand gripping a bar that runs left to right; the arm comes from below. */
function gripHand(ctx: Ctx, who: Who, x: number, y: number, s: number, rot: number, o: HandOpts) {
  const skin = who.skin,
    shade = who.shade;
  const open = o.open ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  poly(ctx, o.sleeve, [-14, 80, 14, 80, 12, 24, -12, 24]);
  if (o.cuff) box(ctx, -12.5, 22, 25, 3.4, o.cuff);
  poly(ctx, skin, [-11, 23, 11, 23, 13, 9, 11, 0, -11, 0, -13, 9]);
  line(ctx, skin, 4.8, [-11, 14, -16, 6, -15, -1]);
  for (let i = 0; i < 4; i++) {
    const fx = -7.6 + i * 5.1;
    const len = (i === 3 ? 7 : 9) * (1 - open * 0.45);
    line(ctx, skin, 4.6, [fx, 1, fx + open * 1.5, -len]);
    oval(ctx, fx + open * 1.5, -len, 2.1, 1.6, open > 0.5 ? mix(skin, '#FFFFFF', 0.3) : shade);
    disc(ctx, fx, 1.2, 2.5, mix(skin, '#FFFFFF', (o.white ?? 0) * 0.45 + 0.08));
  }
  for (const gy of [-6, -1, 4]) line(ctx, alpha(shade, 0.35), 0.8, [-8, 18 + gy * 0.3, -2 + gy, 4]);
  if (o.old) {
    line(ctx, alpha('#8A98C4', 0.45), 1, [-8, 20, -4, 12, -5, 5]);
    line(ctx, alpha('#8A98C4', 0.4), 1, [5, 21, 3, 11, 6, 4]);
    disc(ctx, -3, 15, 1.2, alpha(shade, 0.7));
    disc(ctx, 6, 12, 0.9, alpha(shade, 0.6));
  }
  ctx.restore();
}
/** A hand in profile, reaching along `rot` from the wrist at (x, y); `curl` closes the fingers. */
function reachHand(
  ctx: Ctx,
  who: Who,
  x: number,
  y: number,
  s: number,
  rot: number,
  curl: number,
  o: HandOpts,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  const back = -(o.reach ?? 90);
  poly(ctx, o.sleeve, [back, -10, -10, -9, -10, 9, back, 11]);
  if (o.cuff) box(ctx, -13, -9.5, 3.4, 19, o.cuff);
  poly(ctx, who.skin, [-10, -7.5, 6, -9, 14, -6, 15, 5, 6, 8, -10, 7]);
  line(ctx, who.skin, 4.6, [2, -6, 10, -13, 16, -14]);
  for (let i = 0; i < 4; i++) {
    const fy = -4.2 + i * 3.2;
    const len = 13 - Math.abs(i - 1.2) * 1.4;
    const bend = curl * 1.5;
    const mx = 14 + len * 0.55 * Math.cos(bend * 0.5),
      my = fy + len * 0.55 * Math.sin(bend * 0.5);
    const tx = mx + len * 0.5 * Math.cos(bend),
      ty = my + len * 0.5 * Math.sin(bend);
    line(ctx, i % 2 ? mix(who.skin, who.shade, 0.25) : who.skin, 3.4, [13, fy, mx, my, tx, ty]);
  }
  line(ctx, alpha(who.shade, 0.5), 0.8, [-4, -3, 10, -4]);
  if (o.old) disc(ctx, 0, 1, 1.1, alpha(who.shade, 0.7));
  ctx.restore();
}

// ——— Sets ———
function willow(ctx: Ctx, x: number, ground: number, s: number, tone: number, seconds: number) {
  const leaf = mix('#7F9F5C', '#8A7A40', tone),
    dark = mix('#5F7F48', '#5E5030', tone),
    light = mix('#A4BE78', '#C8A860', tone);
  box(ctx, x - 1.5 * s, ground - 14 * s, 3 * s, 14 * s, '#5A4A3A');
  oval(ctx, x, ground - 22 * s, 17 * s, 11 * s, dark);
  oval(ctx, x - 6 * s, ground - 25 * s, 11 * s, 8 * s, leaf);
  oval(ctx, x + 7 * s, ground - 23 * s, 10 * s, 8 * s, leaf);
  oval(ctx, x - 3 * s, ground - 29 * s, 7 * s, 4 * s, light);
  const sway = Math.sin(seconds * 0.9 + x * 0.05) * s;
  for (let i = 0; i < 6; i++) {
    const sx = x + (i - 2.5) * 5.4 * s;
    line(ctx, i % 2 ? dark : leaf, 2 * s, [
      sx,
      ground - 20 * s,
      sx + sway,
      ground - 6 * s - (i % 3) * 2 * s,
    ]);
  }
}
function bunting(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sag: number,
  seconds: number,
  n: number,
) {
  const pts: number[] = [];
  for (let i = 0; i <= 12; i++) {
    const q = i / 12;
    pts.push(lerp(x0, x1, q), lerp(y0, y1, q) + Math.sin(Math.PI * q) * sag);
  }
  line(ctx, '#6A5A48', 0.8, pts);
  for (let i = 0; i < n; i++) {
    const q = (i + 0.5) / n;
    const fx = lerp(x0, x1, q),
      fy = lerp(y0, y1, q) + Math.sin(Math.PI * q) * sag;
    const flap = Math.sin(seconds * 2.2 + i * 1.3) * 0.8;
    poly(ctx, i % 2 ? BUNT_B : BUNT_A, [fx - 2.4, fy, fx + 2.4, fy, fx + flap, fy + 5.5]);
  }
}
const skyBands = (gold: number) => mixAll(SKY_DAY, SKY_GOLD, gold);
const waterBands = (gold: number) => mixAll(WATER_DAY, WATER_GOLD, gold);

/** A crowd on the near bank, seen from behind: heads, shoulders, the odd sun hat. */
function crowdBacks(
  ctx: Ctx,
  x0: number,
  x1: number,
  y: number,
  seconds: number,
  every: number,
  seed: number,
) {
  const tops = ['#C8433A', '#E8D6A0', '#4C6A9A', '#F2F0E8', '#6E8C5A', '#B86A8A', '#E89A4A'];
  const hairs = ['#3A2A22', '#8A6A48', '#D8D4CC', '#2A2228', '#B8884A'];
  for (let i = 0, x = x0; x < x1; i++, x += every) {
    const px = x + rand(seed + i) * every * 0.6,
      py = y + rand(seed + i * 2.3) * 6;
    const sz = 0.85 + rand(seed + i * 4.1) * 0.35;
    const bob = Math.sin(seconds * 1.3 + i) * 0.4;
    oval(ctx, px, py + 6 * sz, 8 * sz, 7 * sz, tops[i % tops.length]);
    disc(ctx, px, py - 3 * sz + bob, 5 * sz, '#E0B090');
    disc(ctx, px, py - 4 * sz + bob, 5 * sz, hairs[i % hairs.length]);
    if (i % 4 === 1) {
      oval(ctx, px, py - 6 * sz + bob, 8.5 * sz, 2 * sz, '#E8D7A0');
      oval(ctx, px, py - 8 * sz + bob, 4.5 * sz, 3 * sz, '#E8D7A0');
    }
  }
}
type ReachOpts = { gold: number; moored?: boolean };
/** The regatta reach from the near bank, 480 wide: boathouse, willows, bunting, bandstand, bridge. */
function reachSet(ctx: Ctx, seconds: number, o: ReachOpts) {
  const g = o.gold;
  vgrad(ctx, 0, 0, 480, 66, skyBands(g));
  glow(ctx, 440, 26, 90, mix('#FFF0C8', '#FFD08A', g), 0.4);
  // Distant trees, and the bridge upriver.
  poly(
    ctx,
    mix('#9DB592', '#C4A878', g),
    [0, 66, 0, 56, 40, 52, 90, 55, 150, 51, 220, 54, 300, 50, 380, 53, 440, 49, 480, 52, 480, 66],
  );
  const stone = mix('#D2BE9A', '#E0B07A', g);
  box(ctx, 384, 50, 96, 6, stone);
  box(ctx, 384, 49, 96, 1.5, mix(stone, '#FFFFFF', 0.2));
  for (let i = 0; i < 3; i++) {
    const ax = 398 + i * 30;
    box(ctx, ax - 15, 56, 4, 12, stone);
    oval(ctx, ax + 2, 66, 11, 9, mix(stone, '#5A4A3A', 0.45));
  }
  // The bandstand roof, right.
  const roof = mix('#6E8C7A', '#8A7A58', g);
  for (const px of [334, 352, 370, 388]) box(ctx, px, 46, 2, 20, WHITE);
  poly(ctx, roof, [326, 47, 340, 33, 382, 33, 396, 47]);
  poly(ctx, mix(roof, '#0B0E14', 0.2), [326, 47, 396, 47, 396, 49, 326, 49]);
  poly(ctx, mix(roof, '#FFFFFF', 0.15), [340, 33, 361, 22, 382, 33]);
  box(ctx, 360, 17, 2, 6, CREAM);
  disc(ctx, 361, 16, 1.8, YELLOW);
  // Willows between.
  for (const [wx, ws] of [
    [146, 1.0],
    [196, 0.85],
    [256, 1.05],
    [302, 0.8],
    [420, 0.9],
  ] as const)
    willow(ctx, wx, 66, ws, g, seconds);
  // The boathouse, left, flying her old club's pennant.
  const wall = mix('#E6D6B4', '#E8C890', g);
  box(ctx, 16, 36, 94, 32, wall);
  for (let px = 20; px < 110; px += 6) box(ctx, px, 36, 1, 32, alpha('#B8A684', 0.6));
  poly(ctx, '#7E3B2E', [10, 38, 63, 16, 116, 38]);
  poly(ctx, '#5E2A20', [10, 38, 116, 38, 116, 40, 10, 40]);
  box(ctx, 40, 46, 46, 22, '#3A2A22');
  box(ctx, 44, 60, 30, 3, HULL);
  box(ctx, 62, 4, 1.2, 14, '#5A4A3A');
  poly(ctx, NAVY, [63, 4, 76, 7, 63, 10]);
  line(ctx, YELLOW, 1, [63, 7, 74, 7]);
  bunting(ctx, 112, 34, 330, 44, 12, seconds, 22);
  // Far bank and the pontoon.
  box(ctx, 0, 64, 480, 7, mix('#8DAA62', '#A89A58', g));
  box(ctx, 0, 70, 480, 1.5, '#6F8C4E');
  box(ctx, 10, 68, 200, 4, '#B48C5C');
  for (let px = 14; px < 210; px += 22) box(ctx, px, 72, 2, 4, '#6A5038');
  // The river.
  vgrad(ctx, 0, 71, 480, 152, waterBands(g));
  for (const [wx, ws] of [
    [146, 1.0],
    [256, 1.05],
    [420, 0.9],
  ] as const)
    oval(ctx, wx, 75, 18 * ws, 3, alpha(mix('#4F6E44', '#6A5A34', g), 0.16));
  oval(ctx, 63, 76, 46, 4, alpha('#E6D6B4', 0.18));
  glints(ctx, seconds, 34, 0, 74, 480, 76, mix('#FFF4D0', '#FFE0A0', g), 5, seconds * 6);
  if (o.moored)
    for (let i = 0; i < 5; i++)
      skiff(ctx, { x: 30 + i * 37, y: 76, k: 3.6, heading: 0, seats: [], oars: false });
  // The near bank and its crowd.
  box(ctx, 0, 150, 480, 30, mix('#86A35C', '#9A8A50', g));
  box(ctx, 0, 149, 480, 2, mix('#A4BC74', '#C0A868', g));
  crowdBacks(ctx, 0, 480, 160, seconds, 17, 11);
}
/** A soft river backdrop for mediums and close-ups: sky, willows, water; `scroll` pans it. */
function sideBack(
  ctx: Ctx,
  seconds: number,
  o: { gold: number; scroll: number; horizon?: number; bunting?: boolean; sun?: boolean },
) {
  const hz = o.horizon ?? 70;
  vgrad(ctx, 0, 0, W, hz, skyBands(o.gold));
  if (o.sun) glow(ctx, 250, hz - 16, 120, '#FFE2A8', 0.55);
  const off = ((o.scroll % 110) + 110) % 110;
  for (let i = -1; i < 4; i++) willow(ctx, i * 110 - off + 50, hz + 2, 1.6, o.gold, seconds);
  if (o.bunting) {
    const boff = (((o.scroll * 1.4) % 160) + 160) % 160;
    for (let i = -1; i < 3; i++)
      bunting(ctx, i * 160 - boff, 14, i * 160 - boff + 160, 14, 10, seconds, 12);
  }
  box(ctx, 0, hz - 2, W, 5, mix('#8DAA62', '#A08A50', o.gold));
  vgrad(ctx, 0, hz + 3, W, H, waterBands(o.gold));
  glints(
    ctx,
    seconds,
    30,
    0,
    hz + 6,
    W,
    H - hz,
    mix('#FFF4D0', '#FFE0A0', o.gold),
    9,
    o.scroll * 1.3,
  );
}

// ——— Perspective: looking up the river ———
const HZ = 64,
  VX = 160,
  FOC = 150,
  CAMH = 2.6;
const persp = (X: number, Z: number): XY => [VX + (FOC * X) / Z, HZ + (FOC * CAMH) / Z];
function upriver(ctx: Ctx, seconds: number, gold: number, sunX: number) {
  vgrad(ctx, 0, 0, W, HZ + 1, skyBands(gold));
  glow(ctx, sunX, HZ - 8, 70 + gold * 50, '#FFE8B0', 0.35 + gold * 0.35);
  if (gold > 0.5) disc(ctx, sunX, HZ - 7, 7, alpha('#FFF4D8', (gold - 0.5) * 1.6));
  poly(ctx, mix('#A2B898', '#D0A878', gold), [
    0,
    HZ + 1,
    0,
    HZ - 7,
    60,
    HZ - 10,
    120,
    HZ - 6,
    200,
    HZ - 9,
    260,
    HZ - 6,
    320,
    HZ - 10,
    320,
    HZ + 1,
  ]);
  // The bridge, far upriver.
  const [bl] = persp(-17, 140),
    [br] = persp(17, 140);
  const stone = mix('#C8B494', '#7A5A44', gold);
  box(ctx, bl - 4, HZ - 3, br - bl + 8, 4, stone);
  for (let i = 0; i < 3; i++)
    oval(ctx, lerp(bl, br, (i + 0.5) / 3), HZ + 2, 4, 2.4, mix(stone, '#3A2A22', 0.4));
  // Water, then the banks converging to the bridge, willows diminishing along them.
  vgrad(ctx, 0, HZ + 1, W, H, waterBands(gold));
  const bank = mix('#86A35C', '#7A6A3A', gold);
  const yb = persp(17, 140)[1];
  const [lx0, ly0] = persp(-17, 15.9),
    [rx0, ry0] = persp(17, 15.9);
  poly(ctx, bank, [0, HZ - 2, bl, HZ - 1, bl, yb, lx0, ly0, 0, ly0]);
  poly(ctx, bank, [W, HZ - 2, br, HZ - 1, br, yb, rx0, ry0, W, ry0]);
  const edge = mix('#C8B888', '#E0B070', gold);
  line(ctx, edge, 1, [bl, yb, lx0, ly0]);
  line(ctx, edge, 1, [br, yb, rx0, ry0]);
  for (const Z of [110, 70, 46, 30, 20]) {
    const s = FOC / Z / 7;
    const [lx, ly] = persp(-20, Z);
    willow(ctx, lx, ly, s * 1.4, gold, seconds);
    const [rx, ry] = persp(21, Z * 1.15);
    willow(ctx, rx, ry, s * 1.2, gold, seconds);
  }
  // Glints in rows that open out toward us; in gold, a path of light under the sun.
  for (const Z of [9, 11, 14, 18, 23, 30, 40, 55, 80, 120]) {
    const y = persp(0, Z)[1];
    for (let i = 0; i < 4; i++) {
      const X = -15 + rand(Z * 3.1 + i) * 30 + Math.sin(seconds * 0.6 + i + Z) * 0.6;
      const a = 0.5 + 0.5 * Math.sin(seconds * 1.6 + i * 2.3 + Z);
      const x = persp(X, Z)[0];
      box(ctx, x, y, (FOC / Z) * 1.2, 1, alpha(mix('#E6F0F0', '#FFE8B0', gold), 0.45 * a));
    }
    if (gold > 0.4) {
      const x = persp(((sunX - VX) * Z) / FOC, Z)[0];
      box(
        ctx,
        x - (FOC / Z) * 1.4 + Math.sin(seconds * 2 + Z) * 1.5,
        y,
        (FOC / Z) * 2.8,
        1.2,
        alpha('#FFF0C8', 0.6 * gold),
      );
    }
  }
}

// ——— Shots ———
function reachShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [0, 252, 92, 1.0],
    [7, 196, 84, 1.22],
  ]);
  camera(
    ctx,
    view,
    () => {
      reachSet(ctx, seconds, { gold: 0, moored: true });
      // The pontoon's crews, small and busy; and a child's paper boat going downstream.
      const coats = [RED, RED, GREEN, GREEN, WHITE, WHITE, PURPLE, PURPLE];
      for (let i = 0; i < 8; i++)
        person(ctx, 24 + i * 22 + (i % 2) * 5, 69, {
          skin: i % 3 ? '#E8B896' : '#B07850',
          hair: '#D8D8D4',
          coat: coats[i],
          legs: '#2A2A32',
          build: 'adult',
          size: 0.42,
          facing: i % 2 ? -1 : 1,
          arms: i % 3 === 0 ? [2.6, 2.8] : undefined,
        });
      const px = 340 - (t + 3) * 7.5,
        bob = Math.sin(seconds * 2.1) * 0.8;
      oval(ctx, px, 143, 9, 1.6, alpha('#0B1A22', 0.2));
      poly(ctx, '#F4F2EC', [
        px - 8,
        138 + bob,
        px + 8,
        138 + bob,
        px + 5,
        142 + bob,
        px - 5,
        142 + bob,
      ]);
      poly(ctx, '#E4E0D4', [px - 3, 138 + bob, px + 2, 129 + bob, px + 5, 138 + bob]);
      oval(ctx, px, 146, 6, 1.2, alpha('#F4F2EC', 0.25));
    },
    { w: 480, h: H },
  );
}
function boathouseShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [7, 160, 90, 1.0],
    [9, 150, 86, 1.08],
  ]);
  const up = ease(span(t, LIFT - 0.3, LIFT + 0.6));
  camera(ctx, view, () => {
    box(ctx, 0, 0, W, H, '#3A2C24');
    for (let px = 0; px < W; px += 12) box(ctx, px, 0, 1, 150, '#2E221C');
    // The open doors: the bright afternoon and a strip of river.
    box(ctx, 238, 18, 84, 134, '#F4D9A0');
    box(ctx, 238, 96, 84, 56, '#8DB3BF');
    glints(ctx, seconds, 8, 240, 100, 80, 48, '#FFF4D0', 4, seconds * 4);
    box(ctx, 232, 14, 8, 140, '#5A4232');
    box(ctx, 238, 14, 84, 6, '#5A4232');
    box(ctx, 0, 150, W, 30, '#5A4232');
    for (let px = 0; px < W; px += 16) box(ctx, px, 150, 1, 30, '#4A3628');
    poly(ctx, alpha('#FFE6B0', 0.14), [238, 20, 238, 150, 60, 180, 150, 180, 320, 120, 320, 20]);
    // The racks, and the boats on them.
    for (const ry of [40, 75, 110]) {
      box(ctx, 10, ry, 8, 6, '#2A1E18');
      box(ctx, 196, ry, 8, 6, '#2A1E18');
    }
    poly(ctx, '#7A5A3C', [6, 40, 30, 32, 190, 32, 212, 40]);
    poly(ctx, '#C8C2B4', [6, 75, 30, 67, 190, 67, 212, 75]);
    // Luka lifts the old pair off the middle rack; the hull rides on his hands.
    const fig: Figure = {
      skin: LUKA.skin,
      hair: LUKA.hair,
      coat: BLUE,
      legs: LUKA.legs,
      build: 'adult',
      size: 2.15,
      facing: -1,
      hat: 'cap',
      hatColor: BLUE,
      arms: [lerp(2.2, 3.05, up), lerp(2.25, 3.1, up)],
      mouth: up > 0.2 && up < 0.9 ? 'flat' : 'smile',
      eyes: blink(seconds, 2) ? 'closed' : 'open',
    };
    const hand = handOf(160, 170, fig);
    ctx.save();
    ctx.translate(108, hand.y - 7);
    ctx.rotate(-up * 0.04);
    poly(ctx, HULL, [-104, 0, -80, 7, 80, 7, 106, -2, 80, -5, -80, -5]);
    line(ctx, HULL_HI, 1.4, [-100, -1, -80, -4, 80, -4, 104, -2]);
    line(ctx, HULL_D, 1, [-96, 3, -78, 6, 78, 6, 100, 1]);
    for (let i = 0; i < 5; i++) box(ctx, 66 + i * 4, -1, 2, 3, alpha(CREAM, 0.8));
    ctx.restore();
    person(ctx, 160, 170, fig);
    spriteBeard(ctx, 160, 170, fig);
    for (let i = 0; i < 12; i++) {
      const mx = 140 + rand(i * 2.7) * 160 + Math.sin(seconds * 0.4 + i) * 6,
        my = 30 + ((rand(i * 5.3) * 140 + seconds * 3) % 140);
      box(ctx, mx, my, 1, 1, alpha('#FFF0C8', 0.5));
    }
  });
}
function bowShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [9, 150, 90, 1.0],
    [11, 172, 92, 1.06],
  ]);
  // His hand sweeps across from the left, wiping the name clean as it goes.
  const handX = lerp(40, 440, ease(span(t, 9.1, 10.3)));
  const wipe = clamp(handX + 34, 92, 266);
  camera(ctx, view, () => {
    box(ctx, 0, 0, W, H, '#2E2420');
    glow(ctx, 300, 40, 160, '#F4D9A0', 0.35);
    // Clinker planks, curving up to the stem.
    for (let i = 0; i < 5; i++) {
      const y0 = 54 + i * 18;
      poly(ctx, i % 2 ? '#B0703E' : HULL, [
        -10,
        y0,
        250,
        y0 - i * 2,
        300,
        y0 - 14 - i * 6,
        312,
        y0 - 8 - i * 6,
        312,
        y0 + 22,
        -10,
        y0 + 22,
      ]);
      line(ctx, HULL_D, 1.6, [-10, y0 + 18, 250, y0 + 16 - i * 2, 304, y0 + 2 - i * 6]);
    }
    box(ctx, -10, 46, 330, 9, HULL_HI);
    line(ctx, '#E8B878', 1.4, [-10, 47, 260, 46, 312, 30]);
    box(ctx, -10, 36, 330, 10, '#3A2618');
    line(ctx, '#8A6A40', 4, [300, 36, 316, 150]);
    // The name, in cream; dust over it until his hand wipes it clean.
    write(ctx, 'MARTA', 176, 112, {
      size: 26,
      type: 'serif',
      color: CREAM,
      shadow: alpha('#3A2014', 0.5),
    });
    // Years of boathouse dust in soft streaks, wiped away from the left.
    for (let i = 0; i < 26; i++) {
      const sy = 82 + (i % 13) * 3.2;
      const sx = Math.max(wipe + rand(i * 5.1) * 8, 92 + rand(i * 2.3) * 20);
      const ex = 250 + rand(i * 1.7) * 18;
      if (ex > sx) box(ctx, sx, sy, ex - sx, 2.4, alpha('#CDBDA4', 0.32 + rand(i) * 0.2));
    }
    if (handX < 400)
      reachHand(ctx, LUKA, handX, 112 + Math.sin(t * 10) * 2, 2.1, -0.45, 0.12, { sleeve: BLUE });
    glow(ctx, 230, 100, 60, '#FFE6B0', 0.18 + 0.08 * Math.sin(seconds * 0.8));
  });
}
function photoShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [11, 160, 92, 1.0],
    [14, 208, 82, 2.15],
  ]);
  camera(ctx, view, () => {
    box(ctx, 0, 0, W, H, '#33261F');
    for (let px = 4; px < W; px += 13) box(ctx, px, 0, 1, H, '#2A1F1A');
    glow(ctx, 190, 80, 150, '#F4D9A0', 0.3);
    box(ctx, 20, 120, 280, 6, '#6A4A30');
    box(ctx, 20, 126, 280, 3, '#3A2618');
    // Old cups.
    const cup = (cx: number, h: number, metal: string) => {
      box(ctx, cx - 7, 112, 14, 8, mix(metal, '#2A1F1A', 0.3));
      box(ctx, cx - 2, 132 - h, 4, h - 20, metal);
      poly(ctx, metal, [cx - 11, 120 - h, cx + 11, 120 - h, cx + 7, 134 - h, cx - 7, 134 - h]);
      line(ctx, metal, 2, [cx - 11, 122 - h, cx - 16, 126 - h, cx - 9, 132 - h]);
      line(ctx, metal, 2, [cx + 11, 122 - h, cx + 16, 126 - h, cx + 9, 132 - h]);
      box(ctx, cx - 8, 121 - h, 3, 10, alpha('#FFFFFF', 0.35));
    };
    cup(64, 44, '#C8CCD2');
    cup(106, 36, '#D8B860');
    oval(ctx, 140, 104, 12, 14, '#B8BCC2');
    oval(ctx, 140, 104, 8, 10, '#8A8E96');
    box(ctx, 136, 116, 8, 4, '#6A4A30');
    // The frame and the photograph: a frame of the memory itself, faded.
    box(ctx, 160, 44, 104, 76, '#6A4428');
    box(ctx, 165, 49, 94, 66, '#E8DCC0');
    const px = 169,
      py = 53,
      pw = 86,
      ph = 58;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
    ctx.translate(px - 5, py - 1);
    ctx.scale(0.3, 0.33);
    twoShot(ctx, PHOTO_T, PHOTO_T + 3, 'then');
    ctx.restore();
    sepia(ctx, 1, px, py, pw, ph);
    wash(ctx, '#F4E6C4', 0.12, px, py, pw, ph);
    poly(ctx, alpha('#FFFFFF', 0.12), [
      px + 50,
      py,
      px + 70,
      py,
      px + 30,
      py + ph,
      px + 10,
      py + ph,
    ]);
    glow(ctx, 172, 92, 30, '#F4D9A0', 0.1 + 0.03 * Math.sin(seconds));
  });
}
function pontoonShot(ctx: Ctx, t: number, seconds: number) {
  const walk = t - 14;
  const mx = 156 + walk * 12;
  const view = { x: mx + 14, y: 100, zoom: 1.16 };
  sideBack(ctx, seconds, { gold: 0.05, scroll: mx * 0.4, horizon: 40, bunting: true });
  camera(
    ctx,
    view,
    () => {
      for (let i = 0; i < 5; i++)
        skiff(ctx, { x: 40 + i * 92, y: 108, k: 9, heading: 0, sq: 0.3, seats: [], oars: false });
      box(ctx, 0, 112, 460, 40, '#C09868');
      for (let py = 116; py < 152; py += 7) box(ctx, 0, py, 460, 1, '#9A7650');
      box(ctx, 0, 150, 460, 4, '#7A5A3C');
      for (let px = 10; px < 460; px += 46) box(ctx, px, 152, 5, 30, '#5A4232');
      box(ctx, 0, 156, 460, 24, '#4E7E90');
      glints(ctx, seconds, 10, 0, 158, 460, 20, '#FFF4D0', 12);
      // Fit, loud veterans stretching and joking along the back of the pontoon.
      const crew = (x: number, coat: string, f: Partial<Figure>) =>
        person(ctx, x, 130, {
          skin: '#E8B896',
          hair: '#D8D8D4',
          coat,
          legs: '#2A2A32',
          build: 'adult',
          size: 1.35,
          ...f,
        });
      const stretch = Math.sin(seconds * 2.2);
      crew(70, WHITE, { mouth: 'open', eyes: 'happy', arms: [0.3, 1.9 + stretch * 0.4] });
      crew(96, WHITE, { mouth: 'grin', eyes: 'happy', facing: -1, hairStyle: 'bald' });
      crew(214, RED, { arms: [2.6 + stretch * 0.2, 2.9], mouth: 'grin' });
      crew(240, RED, { mouth: 'open', facing: -1, skin: '#C98F68', hair: '#2A2220' });
      crew(296, GREEN, { arms: [0.4, 1.4 + stretch * 0.3], lean: 0.25, mouth: 'smile' });
      crew(322, GREEN, {
        arms: [-0.6, 2.4],
        mouth: 'grin',
        facing: -1,
        skin: '#8C5A3C',
        hair: '#2A2220',
      });
      crew(380, PURPLE, { arms: [2.8, 2.8], mouth: 'smile' });
      // Luka, a pace behind with both oars on his shoulder, keeps her pace.
      const lx = mx - 52;
      const sy = 164 - 23 * 1.95;
      line(ctx, SHAFT, 2, [lx + 16, sy - 2, lx - 72, sy + 12]);
      line(ctx, SHAFT, 2, [lx + 12, sy + 2, lx - 76, sy + 16]);
      poly(ctx, YELLOW, [lx - 66, sy + 8, lx - 86, sy + 9, lx - 86, sy + 18, lx - 66, sy + 15]);
      poly(ctx, BLUE, [lx - 70, sy + 12, lx - 90, sy + 14, lx - 90, sy + 23, lx - 70, sy + 19]);
      const son: Figure = {
        skin: LUKA.skin,
        hair: LUKA.hair,
        coat: BLUE,
        legs: LUKA.legs,
        build: 'adult',
        size: 1.95,
        hat: 'cap',
        hatColor: BLUE,
        step: walk * WALK_RATE,
        arms: [0.2, 2.5],
        mouth: 'smile',
      };
      person(ctx, lx, 164, son);
      spriteBeard(ctx, lx, 164, son);
      // Marta: upright, slow, the cane in her good hand and the right arm held in.
      const step = walk * WALK_RATE;
      const fig: Figure = {
        skin: MARTA.skin,
        hair: MARTA.hair,
        coat: NAVY,
        legs: MARTA.legs,
        build: 'adult',
        size: 1.8,
        hairStyle: 'bun',
        step,
        arms: [0.32 + Math.sin(step) * 0.08, 0.18],
        mouth: 'flat',
        blush: false,
        eyes: blink(seconds, 1) ? 'closed' : 'open',
      };
      person(ctx, mx, 164, fig);
      box(ctx, mx - 6.5, 164 - 24 * 1.8 - 1, 14, 2, YELLOW);
      // The cane: a dark stick with a crook over her hand, wide enough to read from the rug.
      const hand = handOf(mx, 164, fig, 'back');
      const foot = hand.x + 5 + Math.sin(step) * 2;
      line(ctx, '#3A2618', 2.6, [
        foot,
        164,
        hand.x,
        hand.y - 1.5,
        hand.x + 1.2,
        hand.y - 4.4,
        hand.x + 3.6,
        hand.y - 4.6,
        hand.x + 4.6,
        hand.y - 2.2,
      ]);
      line(ctx, alpha('#8A6A48', 0.8), 0.8, [
        hand.x - 0.4,
        hand.y - 2.4,
        hand.x + 1.6,
        hand.y - 4.8,
      ]);
    },
    { w: 460, h: H },
  );
}
/** Background for the pontoon close-ups: the bright river, the crews as soft blobs. */
function pontoonBlur(ctx: Ctx, seconds: number, reverse: boolean) {
  sideBack(ctx, seconds, { gold: 0.05, scroll: reverse ? 200 : 40, horizon: 62, bunting: reverse });
  const tops = reverse ? [WHITE, PURPLE] : [RED, GREEN, WHITE];
  tops.forEach((c, i) => {
    const bx = (reverse ? 40 : 230) + i * 34;
    oval(ctx, bx, 128, 15, 26, alpha(c, 0.8));
    disc(ctx, bx, 96, 10, alpha('#E0B090', 0.8));
  });
  box(ctx, 0, 150, W, 30, alpha('#C09868', 0.9));
}
function doubtShot(ctx: Ctx, t: number, seconds: number) {
  pontoonBlur(ctx, seconds, false);
  const look = t < 17.3;
  camera(
    ctx,
    track(t, [
      [16.5, 160, 90, 1.0],
      [18, 160, 92, 1.05],
    ]),
    () =>
      portrait(ctx, MARTA, 140, 98, 1.85, {
        eyes: blink(seconds, 1) ? 'closed' : look ? 'open' : 'down',
        look: look ? [1, -0.1] : [0.3, 0.8],
        brows: 0.6,
        raise: 0.1,
        mouth: look ? 'flat' : 'press',
        turn: 0.2,
      }),
  );
}
function eagerShot(ctx: Ctx, t: number, seconds: number) {
  pontoonBlur(ctx, seconds, true);
  const talk = t > 18.15 && t < 19.8 && Math.sin((t - 18.15) * 17) > -0.2;
  camera(
    ctx,
    track(t, [
      [18, 160, 92, 1.04],
      [21, 160, 94, 1.1],
    ]),
    () =>
      portrait(ctx, LUKA, 178, 100, 1.8, {
        eyes: blink(seconds, 2) ? 'closed' : t > 20 ? 'happy' : 'open',
        look: [-0.7, 0.1],
        brows: 0.2,
        raise: 0.5,
        mouth: talk ? 'talk' : 'grin',
        turn: -0.25,
        tilt: Math.sin(t * 2) * 0.03,
      }),
  );
}
/** Her weak hand on the oar handle, from above: the strap goes on, and later it slips. */
function handleShot(ctx: Ctx, t: number, seconds: number, slip: boolean) {
  const o = herOar(t);
  const jolt = slip ? Math.max(0, ...HIS_STROKES.map((c) => hump(t, c, c + 0.35))) : 0;
  const dx = slip ? -o.phi * 50 + jolt * 4 : 0,
    dy = slip ? Math.sin(t * 7) * 1.5 + jolt * 3 : 0;
  const keys: readonly (readonly [number, number, number, number])[] = slip
    ? [
        [42, 160, 92, 1.1],
        [44, 160, 92, 1.18],
      ]
    : [
        [21, 160, 90, 1.0],
        [23, 160, 92, 1.06],
      ];
  camera(ctx, track(t, keys), () => {
    box(ctx, 0, 0, W, H, INSIDE);
    for (let px = 6; px < W; px += 26) box(ctx, px + dx * 0.3, 0, 6, H, '#5A3420');
    oval(ctx, 110 + dx * 0.4, 168, 62, 36, MARTA.legs);
    oval(ctx, 222 + dx * 0.4, 172, 62, 36, mix(MARTA.legs, '#0B0E14', 0.15));
    const hy = 88 + dy;
    line(ctx, '#C9A472', 13, [-20, hy - 6, 270 + dx, hy + 2]);
    line(ctx, '#8A6A48', 13, [140 + dx, hy - 1.6, 262 + dx, hy + 1.8]);
    line(ctx, alpha('#FFFFFF', 0.3), 2, [-20, hy - 10, 262 + dx, hy - 2]);
    if (slip)
      for (let i = 0; i < 9; i++) {
        const k = (seconds * 1.4 + rand(i)) % 1;
        disc(
          ctx,
          40 + rand(i * 3.3) * 240,
          30 + rand(i * 7.7) * 120 + k * 4,
          1.4,
          alpha('#DCEAF0', 0.6 * (1 - k)),
        );
      }
    // Her hand: in the slip it slides along the handle inside the strap.
    const slid = slip ? ease(span(t, 42.3, 43.8)) : 0;
    const hx = 190 + dx - slid * 18 + jolt * 2;
    gripHand(ctx, MARTA, hx, hy + 2, 1.35, -0.12 * slid, {
      open: slip ? 0.15 + jolt * 0.3 : 0.35,
      white: slip ? 0.8 : 0,
      sleeve: NAVY,
      cuff: YELLOW,
      old: true,
    });
    // The strap: navy webbing and a steel buckle.
    const wrap = slip ? 1 : lerp(0.25, 1, ease(span(t, 21.0, BUCKLE)));
    const sx = 190 + dx;
    const strapY = hy + 10;
    if (wrap > 0) {
      ctx.save();
      ctx.translate(sx, strapY);
      ctx.rotate(0.18 * slid);
      box(ctx, -18, -5, 36 * wrap, 10, '#1E2A44');
      line(ctx, alpha('#5A6A8A', 0.8), 1, [-18, -3, -18 + 36 * wrap, -3]);
      if (wrap >= 1) {
        box(ctx, 16, -7, 7, 14, '#C8CCD2');
        box(ctx, 18, -4, 3, 8, '#6A707A');
        if (!slip)
          glow(ctx, 19, -2, 10, '#FFFFFF', 0.6 * (1 - ease(span(t, BUCKLE, BUCKLE + 0.5))));
      }
      ctx.restore();
    }
    if (!slip) {
      // His hand, reaching past her to pull the strap through, then a pat, then gone.
      const reach = 1 - ease(span(t, 22.2, 22.9));
      const pat = hump(t, 21.75, 22.1);
      const lx = lerp(330, sx + 24 * wrap - 4, reach),
        ly = lerp(-30, strapY - 16 - pat * 6, reach);
      if (reach > 0.02) gripHand(ctx, LUKA, lx, ly, 1.55, 2.3, { open: 0.4, sleeve: BLUE });
    }
  });
}
/** The five lanes of the start, far to near: [screen y, pixels per plan unit]. */
const LANES = [
  [122, 7.5],
  [106, 6.3],
  [92, 5.3],
  [80, 4.0],
] as const;
function rivals(ctx: Ctx, t: number) {
  // Far lanes first; lane j from the bank is crew 3 - j, the same lanes the overhead shows.
  // The rivals sit in echelon up and to the right of her boat, each lane a little left of the
  // one nearer the bank, so every crew gets clear water and hers stands apart from the pack.
  for (let j = 3; j >= 0; j--) {
    const [y, k] = LANES[j];
    const i = 3 - j;
    const x = 240 - 4 * k + (3 - j) * 12 + rivalRun(i, t) * k;
    skiff(ctx, { x, y, k, heading: 0, seats: rivalSeats(i, t) });
  }
}
function startShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [23, 236, 100, 1.08],
    [28, 252, 104, 1.12],
  ]);
  camera(
    ctx,
    view,
    () => {
      reachSet(ctx, seconds, { gold: 0 });
      rivals(ctx, t);
      skiff(ctx, {
        x: 240 - 4 * 9,
        y: 138,
        k: 9,
        heading: HEADING(t),
        seats: nowSeats(t),
        name: true,
      });
      // The umpire on the near bank: the flag rises, holds, and drops.
      const up = ease(span(t, 23.4, 24.8)),
        drop = easeOut(span(t, START, START + 0.25));
      const a = lerp(0.3, 2.9, up) - drop * 1.9;
      const fig: Figure = {
        skin: '#E4B08C',
        hair: '#D8D8D4',
        coat: WHITE,
        legs: '#2A3040',
        build: 'adult',
        size: 1.8,
        facing: 1,
        hat: 'brim',
        hatColor: '#E8D7A0',
        arms: [0.2, a],
        mouth: t > START ? 'open' : 'flat',
      };
      person(ctx, 120, 178, fig);
      const hand = handOf(120, 178, fig);
      const tipX = hand.x + Math.sin(a) * 18,
        tipY = hand.y + Math.cos(a) * 18;
      line(ctx, '#5A4232', 1.6, [hand.x, hand.y, tipX, tipY]);
      const wave = Math.sin(seconds * 6) * 1.5;
      poly(ctx, RED, [
        tipX,
        tipY,
        tipX + 12,
        tipY + 2 + wave,
        tipX + 11,
        tipY + 10 + wave,
        tipX,
        tipY + 8,
      ]);
    },
    { w: 480, h: H },
  );
}
/** Plan position → the start-shot world, for following her boat from the bank. */
const sideX = (p: Pt) => 204 + p.x * 9;
const sideY = (p: Pt) => 138 + (p.y - S0.y) * 9 * 0.28;
function spinShot(ctx: Ctx, t: number, seconds: number) {
  const p = POSITION(t);
  const view = { x: lerp(222, sideX(p) + 10, 0.6), y: 116, zoom: 1.45 };
  camera(
    ctx,
    view,
    () => {
      reachSet(ctx, seconds, { gold: 0 });
      rivals(ctx, t);
      // Her wake: the same path, sampled back.
      const wake: number[] = [];
      for (let back = 0; back <= 4; back += 0.2) {
        const st = sternAt(t - back);
        wake.push(sideX(st), sideY(st));
      }
      line(ctx, alpha(FOAM, 0.5), 1.2, wake);
      skiff(ctx, {
        x: sideX(p),
        y: sideY(p),
        k: 9,
        heading: HEADING(t),
        seats: nowSeats(t),
        name: true,
      });
    },
    { w: 480, h: H },
  );
}
function overheadShot(ctx: Ctx, t: number, seconds: number) {
  // Wide enough to see the four crews shoot away; then in on the spiral.
  const v = track(t, [
    [32, 16, 0, 0.92],
    [33.4, 14, 1, 0.95],
    [36, 2, 9, 1.9],
  ]);
  riverTop(ctx, t, seconds, v, false);
}
const straightView = (t: number): TopView => {
  const p = POSITION(t);
  // Through the match-dissolve the camera pushes down onto the boat, into the memory's close-up.
  const dive = ease(span(t, 71, 74));
  return {
    x: lerp(lerp(3, p.x + 6, ease(span(t, 65, 70))), p.x, dive),
    y: lerp(10, p.y, dive),
    zoom: lerp(1.3, 2.3, dive),
  };
};
function straightenShot(ctx: Ctx, t: number, seconds: number) {
  riverTop(ctx, t, seconds, straightView(t), false);
}
function thenShot(ctx: Ctx, t: number, seconds: number) {
  riverTop(ctx, t, seconds, straightView(t), true);
  sepia(ctx, 1);
}
type Bust = {
  x: number;
  y: number;
  s: number;
  skin: string;
  hair: string;
  top: string;
  hat?: string;
  kid?: boolean;
};
const BANK_ROW: readonly Bust[] = [
  { x: 30, y: 118, s: 1.0, skin: '#E8B896', hair: '#8A6A48', top: '#C8433A' },
  { x: 78, y: 114, s: 1.05, skin: '#B07850', hair: '#2A2228', top: '#E8D6A0', hat: '#E8D7A0' },
  { x: 128, y: 120, s: 1.0, skin: '#F0C4A0', hair: '#D8D4CC', top: '#4C6A9A' },
  { x: 176, y: 128, s: 0.72, skin: '#F2CBA8', hair: '#B8884A', top: '#E89A4A', kid: true },
  { x: 220, y: 116, s: 1.05, skin: '#F2CBA8', hair: '#B8884A', top: '#6E8C5A' },
  { x: 268, y: 118, s: 1.0, skin: '#8C5A3C', hair: '#2A2220', top: '#B86A8A' },
  { x: 312, y: 115, s: 1.0, skin: '#E4B08C', hair: '#3A2A22', top: '#F2F0E8', hat: '#E8D7A0' },
];
/** The spectators from the river: heads turning together to follow the circling boat. */
function bankShot(ctx: Ctx, t: number, seconds: number) {
  const yaw = Math.sin(HEADING(t)) * 0.9;
  camera(
    ctx,
    track(t, [
      [36, 160, 92, 1.02],
      [40, 164, 90, 1.08],
    ]),
    () => {
      vgrad(ctx, 0, 0, W, 84, skyBands(0.1));
      for (const [wx, ws] of [
        [40, 2.2],
        [150, 1.8],
        [270, 2.4],
      ] as const)
        willow(ctx, wx, 84, ws, 0.1, seconds);
      bunting(ctx, -10, 20, 330, 26, 14, seconds, 24);
      box(ctx, 0, 80, W, 100, '#86A35C');
      box(ctx, 0, 80, W, 2, '#A4BC74');
      box(ctx, 0, 160, W, 20, '#4E7E90');
      box(ctx, 0, 158, W, 3, '#6E8C4E');
      const giggle = t >= GIGGLE && t < SHUSH;
      const hushed = t >= SHUSH;
      for (const b of BANK_ROW) {
        const kid = !!b.kid;
        const shake = kid && giggle ? Math.sin(seconds * 28) * 0.8 : 0;
        const turn = yaw * (kid ? 1.1 : 1) + Math.sin(seconds * 0.7 + b.x) * 0.05;
        const s = b.s * 1.6;
        const by = b.y + shake;
        oval(ctx, b.x, by + 22 * s, 17 * s, 12 * s, b.top);
        box(ctx, b.x - 3 * s, by + 6 * s, 6 * s, 6 * s, mix(b.skin, '#6A4030', 0.2));
        const hx = b.x + turn * 2 * s;
        oval(ctx, hx, by, 9 * s, 10.5 * s, b.skin);
        oval(ctx, hx - turn * 3 * s, by - 6 * s, 9.4 * s, 5.5 * s, b.hair);
        if (b.hat) {
          oval(ctx, hx, by - 8 * s, 13 * s, 2.6 * s, b.hat);
          oval(ctx, hx, by - 11 * s, 7 * s, 4 * s, b.hat);
          box(ctx, hx - 7 * s, by - 9.5 * s, 14 * s, 1.4 * s, '#6A4A3A');
        }
        const ex = hx + turn * 4.5 * s;
        for (const sd of [-1, 1]) {
          if (kid && giggle)
            line(ctx, INK, 1.1 * s, [
              ex + sd * 3.4 * s - 1.6 * s,
              by + 0.5 * s,
              ex + sd * 3.4 * s,
              by - 1.2 * s,
              ex + sd * 3.4 * s + 1.6 * s,
              by + 0.5 * s,
            ]);
          else {
            const wide = kid && hushed ? 1.4 : 1;
            oval(ctx, ex + sd * 3.4 * s, by, 1.6 * s * wide, 1.8 * s * wide, '#F8F4EE');
            disc(ctx, ex + sd * 3.4 * s + turn * s, by + 0.2 * s, 0.95 * s, INK);
          }
        }
        if (kid && giggle) oval(ctx, ex, by + 5 * s, 3 * s, 2.4 * s, '#5A2A24');
        else line(ctx, '#5A2A24', 1 * s, [ex - 2.2 * s, by + 5 * s, ex + 2.2 * s, by + 5 * s]);
      }
      // The parent's hand, at once.
      const kid = BANK_ROW[3],
        mum = BANK_ROW[4];
      const cover = ease(span(t, SHUSH, SHUSH + 0.22));
      if (cover > 0) {
        const s = kid.s * 1.6;
        const tx = kid.x + yaw * 6.5 * s,
          ty = kid.y + 5 * s;
        const hx = lerp(mum.x - 6, tx + 2, cover),
          hy = lerp(mum.y + 30, ty, cover);
        line(ctx, mum.top, 7, [mum.x - 12, mum.y + 34, hx + 8, hy + 6]);
        oval(ctx, hx, hy, 12, 8, mum.skin);
        for (let i = 0; i < 3; i++)
          line(ctx, mix(mum.skin, '#6A4030', 0.25), 1, [
            hx - 7 + i * 5,
            hy - 6,
            hx - 8 + i * 5,
            hy + 6,
          ]);
      }
    },
  );
}
/** A river backdrop that swings past behind a close-up as the boat turns. */
function spinBack(ctx: Ctx, t: number, seconds: number, gold: number, horizon = 76) {
  sideBack(ctx, seconds, { gold, scroll: HEADING(t) * 140, horizon });
}
function strainShot(ctx: Ctx, t: number, seconds: number) {
  spinBack(ctx, t, seconds, 0.05);
  const pull = Math.max(0, ...HIS_STROKES.map((c) => hump(t, c, c + 0.55)));
  camera(
    ctx,
    track(t, [
      [40, 160, 90, 1.04],
      [42, 164, 92, 1.16],
    ]),
    () =>
      portrait(ctx, LUKA, 162, 100 + pull * 4, 1.85, {
        eyes: pull > 0.4 ? 'squeeze' : 'half',
        look: [-0.4, 0.3],
        brows: -0.9,
        raise: -0.2,
        mouth: 'teeth',
        flush: 0.6 + pull * 0.4,
        sweat: 0.8,
        tilt: pull * -0.08,
        turn: -0.1,
      }),
  );
}
function crabShot(ctx: Ctx, t: number, seconds: number) {
  const tau = t - CRAB;
  const shake = tau > 0 ? Math.exp(-tau / 0.3) * 2.2 : 0;
  const jx = Math.sin(seconds * 47) * shake,
    jy = Math.cos(seconds * 39) * shake;
  spinBack(ctx, t, seconds, 0.08, 64);
  camera(ctx, { x: 160 - jx, y: 96 - jy, zoom: 1 }, () => {
    const b: Skiff = { x: 168, y: 126, k: 15, heading: 0, seats: nowSeats(t), name: true };
    skiff(ctx, b);
    // The jam: her blade digs in, and the river throws up its spray.
    if (tau > 0 && tau < 1.2) {
      const q = tau / 1.2;
      const g = oarGeom(b, projector(b), b.seats[0]);
      for (let i = 0; i < 14; i++) {
        const a = (i / 13 - 0.5) * 2.6;
        const r = 22 * (0.4 + rand(i * 5.9) * 0.8);
        disc(
          ctx,
          g.tip[0] + Math.sin(a) * r * q * 1.3,
          g.tip[1] - Math.sin(Math.PI * q) * r * (1 + rand(i) * 0.7),
          1.8 * (1 - q * 0.5),
          alpha(FOAM, 0.95 * (1 - q)),
        );
      }
      oval(ctx, g.tip[0], g.tip[1] + 2, 14 + q * 20, 3 + q * 3, alpha(FOAM, 0.6 * (1 - q)));
    }
  });
}
function ring(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}
function stillShot(ctx: Ctx, t: number, seconds: number) {
  camera(
    ctx,
    track(t, [
      [47, 160, 90, 1.0],
      [52, 160, 88, 1.06],
    ]),
    () => {
      upriver(ctx, seconds, 0.15, 230);
      // Far upriver, the other crews are tiny boats at the bridge, in their colours.
      const [bl] = persp(-17, 140),
        [br] = persp(17, 140);
      const wl = persp(0, 138)[1];
      RIVAL_CREWS.forEach(([a, b], i) => {
        const x = Math.round(lerp(bl + 5, br - 5, i / 3) + Math.sin(seconds * 0.3 + i) * 0.4);
        box(ctx, x - 3, wl, 6, 1, HULL_D);
        box(ctx, x - 2, wl - 2, 1, 2, a.top);
        box(ctx, x + 1, wl - 2, 1, 2, b.top);
      });
      // Her boat, nearer and to the left, clear of the horizon and the bridge.
      const Z = 9;
      const [bx, by] = persp(-3.6, Z);
      const k = FOC / Z;
      // Rings spreading from the crab, then settling.
      for (let i = 0; i < 3; i++) {
        const age = t - CRAB - i * 0.9;
        const a = 0.35 * Math.max(0, 1 - age / 7);
        if (age > 0 && a > 0) {
          const r = (2 + age * 1.4) * k;
          ring(ctx, bx, by, r, r * 0.13, alpha(FOAM, a));
        }
      }
      skiff(ctx, { x: bx, y: by, k, heading: 0, sq: CAMH / Z, seats: nowSeats(t), name: true });
    },
  );
}
function biteShot(ctx: Ctx, t: number, seconds: number) {
  spinBack(ctx, t, seconds, 0.12);
  const open = t > 52.7 && t < 53.6;
  const after = t > 54;
  camera(
    ctx,
    track(t, [
      [52, 160, 92, 1.02],
      [55, 158, 90, 1.12],
    ]),
    () =>
      portrait(ctx, LUKA, 160, 100, 1.85, {
        eyes: blink(seconds, 2) && !open ? 'closed' : after ? 'down' : 'open',
        look: after ? [-0.6, 0.6] : [-0.3, 0.1],
        brows: open ? -1 : after ? 0.5 : -0.6,
        raise: open ? 0.1 : 0,
        mouth: open ? 'open' : after ? 'press' : 'teeth',
        flush: lerp(0.8, 0.3, ease(span(t, 53.6, 55))),
        sweat: 0.6,
        breath: Math.sin(t * 3.4) * 0.6,
        turn: -0.15,
      }),
  );
}
/** A seated person from behind: jacket, shoulders, the back of the head. */
function backOf(ctx: Ctx, who: Who, x: number, y: number, s: number, drop: number, lean: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Dropped shoulders slope down and in, and the head bows forward until the bun nears the collar.
  const sh = drop * 15;
  const hy = -64 + drop * 20 + lean * 6;
  box(ctx, -8, hy + 10, 16, 40, who.shade);
  poly(ctx, who.top, [
    -34 + drop * 2,
    60,
    -37 + drop * 3,
    -22 + sh,
    -26,
    -34 + sh * 0.5,
    26,
    -34 + sh * 0.5,
    37 - drop * 3,
    -22 + sh,
    34 - drop * 2,
    60,
  ]);
  poly(ctx, who.topD, [-34 + drop * 2, 60, -37 + drop * 3, -22 + sh, -31, -28 + sh, -27, 60]);
  line(ctx, alpha(who.topD, 0.6), 1, [0, -24 + sh * 0.5, 0, 60]);
  if (who.kind === 'luka') line(ctx, '#86AEDC', 3, [-14, -35 + sh * 0.5, 14, -35 + sh * 0.5]);
  if (who.kind === 'marta' || who.kind === 'young') {
    const cy = -34 + sh * 0.5;
    poly(ctx, who.top, [-16, cy, 16, cy, 14, cy - 8, -14, cy - 8]);
    line(ctx, YELLOW, 2, [-14, cy - 7, 14, cy - 7]);
  }
  oval(ctx, -19, hy + 2, 3.5, 6, who.skin);
  oval(ctx, 19, hy + 2, 3.5, 6, who.skin);
  oval(ctx, 0, hy, 18, 21, who.kind === 'luka' ? who.skin : who.hair);
  if (who.kind === 'luka') {
    const cap = who.cap ?? BLUE;
    oval(ctx, 0, hy - 5, 19.5, 17, cap);
    box(ctx, -6, hy + 6, 12, 3, mix(cap, '#0B0E14', 0.3));
    oval(ctx, 0, hy + 12, 14, 8, who.hair);
  } else {
    const strand = mix(who.hair, '#0B0E14', 0.2);
    line(ctx, strand, 1, [-13, hy + 10, -16, hy - 1, -9, hy - 11]);
    line(ctx, strand, 1, [13, hy + 10, 16, hy - 1, 9, hy - 11]);
    line(ctx, strand, 1, [-4, hy + 14, -5, hy - 10]);
    disc(ctx, 0, hy - 13, 9, mix(who.hair, '#0B0E14', 0.12));
    disc(ctx, -1.5, hy - 14.5, 5.5, mix(who.hair, '#FFFFFF', 0.12));
  }
  ctx.restore();
}
/** Where her good hand taps: on the gunwale beside her hip, well clear of the oar shaft. */
const TAP_X = 112,
  TAP_Y = 131;
function backShot(ctx: Ctx, t: number, seconds: number) {
  camera(
    ctx,
    track(t, [
      [55, 160, 96, 1.0],
      [57.5, 150, 100, 1.08],
      [61.2, 128, 108, 1.45],
    ]),
    () => {
      sideBack(ctx, seconds, { gold: 0.2, scroll: HEADING(t) * 140 + 40, horizon: 62 });
      // The boat, from the bow seat: the gunwales converge to the stern.
      poly(ctx, INSIDE, [30, 180, 144, 112, 176, 112, 300, 180]);
      line(ctx, HULL_HI, 3, [30, 180, 144, 112, 176, 112, 300, 180]);
      poly(ctx, DECK, [144, 112, 176, 112, 168, 122, 152, 122]);
      // Her oar, out to the left over the starboard gunwale, its blade flat on the water.
      line(ctx, SHAFT, 3, [178, 140, 70, 146, -4, 152]);
      poly(ctx, YELLOW, [0, 148, -30, 150, -30, 158, 0, 157]);
      oval(ctx, -10, 157, 26, 3, alpha(FOAM, 0.35));
      const drop = slump(t);
      backOf(ctx, MARTA, 152, 130, 0.92, drop, 0);
      // Her good hand: trembling, then three taps on the gunwale at her own pace.
      // Each tap lands on the gunwale exactly on its knock.
      const tap = Math.max(0, ...TAPS.map((c) => hump(t, c - 0.45, c)));
      const out =
        ease(span(t, TAPS[0] - 0.9, TAPS[0] - 0.4)) *
        (1 - ease(span(t, TAPS[2] + 0.4, TAPS[2] + 1)));
      const tremble = t < TAPS[0] - 0.9 ? Math.sin(seconds * 22) * 0.8 : 0;
      // At rest in her lap, then out onto the gunwale; each tap lifts it high and brings it down.
      const hx = lerp(128, TAP_X, out) + tremble,
        hy = lerp(140, TAP_Y - 4, out) - tap * 19;
      const sy = 113 + drop * 12;
      line(ctx, NAVY, 7, [126, sy, lerp(124, 118, out), lerp(133, 128, out), hx + 7, hy + 2]);
      // The hand, palm down, fingers toward the stern: big enough to read from the rug.
      oval(ctx, hx, hy + 1, 10, 7, MARTA.skin);
      for (let i = 0; i < 3; i++) box(ctx, hx - 7 + i * 4, hy + 6, 2, 3 + (i % 2), MARTA.skin);
      line(ctx, alpha(MARTA.shade, 0.8), 1, [hx - 6, hy + 3, hx + 4, hy + 4]);
      box(ctx, hx + 7, hy - 4, 3, 10, YELLOW);
      for (const c of TAPS) {
        const age = t - c;
        if (age >= 0 && age < 0.6)
          oval(
            ctx,
            TAP_X,
            TAP_Y + 2,
            6 + age * 24,
            1.6 + age * 4.5,
            alpha('#FFF4D8', 0.55 * (1 - age / 0.6)),
          );
      }
      // His shoulder and head, close and dark in the corner.
      faded(ctx, 0.92, () => backOf(ctx, LUKA, 300, 180, 1.55, 0, 0.1));
      wash(ctx, '#0B0E14', 0.08);
    },
  );
}
/** Between her second and third taps: Luka watching her hand, and the fight going out of him. */
function watchShot(ctx: Ctx, t: number, seconds: number) {
  sideBack(ctx, seconds, { gold: 0.2, scroll: HEADING(t) * 140 + 260, horizon: 76 });
  const soften = ease(span(t, 59.1, 60.1));
  camera(
    ctx,
    track(t, [
      [59, 160, 92, 1.04],
      [60.4, 160, 90, 1.1],
    ]),
    () =>
      portrait(ctx, LUKA, 160, 100, 1.85, {
        eyes: 'open',
        look: [-0.2, 0.7],
        brows: lerp(-0.4, 0.5, soften),
        mouth: t < 59.75 ? 'press' : 'part',
        flush: 0.25,
        breath: Math.sin(t * 2.6) * 0.4,
        turn: -0.1,
      }),
  );
}
function copyShot(ctx: Ctx, t: number, seconds: number) {
  const lean = leanOf(together(t));
  const relax = ease(span(t, 61.3, 61.9));
  camera(ctx, { x: 160, y: 92, zoom: 1.0 }, () => {
    sideBack(ctx, seconds, { gold: 0.22, scroll: HEADING(t) * 140 + 40, horizon: 56 });
    poly(ctx, INSIDE, [10, 180, 146, 104, 174, 104, 310, 180]);
    line(ctx, HULL_HI, 3, [10, 180, 146, 104, 174, 104, 310, 180]);
    line(ctx, SHAFT, 3, [170, 132, 60, 138, -4, 146]);
    backOf(ctx, MARTA, 158, 128 + lean * 12, 0.62 - lean * 0.06, 0, lean);
    // His shoulders come down as he lets go of the fight; then he swings with her.
    backOf(ctx, LUKA, 196, 200 + lean * 20 - (1 - relax) * 6, 1.15 - lean * 0.08, 0, lean);
    const gx = 264 - lean * 12,
      gy = 152 + lean * 6;
    line(ctx, SHAFT, 5, [gx - 30, gy + 6, 330, gy - 4]);
    gripHand(ctx, LUKA, gx, gy, 0.9, -1.4, { open: relax * 0.35, white: 1 - relax, sleeve: BLUE });
  });
}
function bladesShot(ctx: Ctx, t: number, seconds: number) {
  const o = together(t);
  // 1 leaning in toward us at the catch, 0 laid back at the finish.
  const q = clamp((leanOf(o) + 0.3) / 0.72);
  const since = sinceLast(t, TOGETHER);
  const view = track(t, [
    [62.8, 160, 92, 1.1],
    [65, 160, 92, 1.0],
  ]);
  camera(ctx, view, () => {
    const hz = 62;
    vgrad(ctx, 0, 0, W, hz, skyBands(0.3));
    poly(ctx, mix('#86A35C', '#A08A50', 0.3), [
      0,
      hz,
      0,
      52,
      60,
      48,
      140,
      54,
      220,
      48,
      320,
      52,
      320,
      hz,
    ]);
    for (const [wx, ws] of [
      [30, 1.4],
      [270, 1.6],
    ] as const)
      willow(ctx, wx, hz, ws, 0.3, seconds);
    vgrad(ctx, 0, hz, W, H, waterBands(0.3));
    for (const Z of [1.2, 1.6, 2.2, 3, 4.2, 6, 9])
      for (let i = 0; i < 5; i++)
        box(
          ctx,
          160 + (rand(Z * 7 + i) - 0.5) * 300,
          hz + 100 / Z,
          30 / Z + 3,
          1,
          alpha('#E6F0F0', 0.35 + 0.2 * Math.sin(seconds * 1.7 + i + Z)),
        );
    // We sit on the water just behind the stern. Luka, over her shoulder, swings with her.
    portrait(ctx, LUKA, 196, lerp(44, 54, q), 0.5, {
      eyes: blink(seconds, 2) ? 'closed' : 'open',
      look: [-0.5, 0.5],
      brows: 0.25,
      mouth: 'soft',
      turn: -0.25,
    });
    poly(ctx, INSIDE, [98, 116, 222, 116, 198, 136, 122, 136]);
    // Quiet resolve, not pain: level brows, a soft mouth, and the first of a smile once it holds.
    portrait(ctx, MARTA, 158, lerp(58, 70, q), lerp(0.6, 0.68, q), {
      eyes: 'open',
      look: [0.2, 0.3],
      brows: 0.1,
      raise: 0.2,
      mouth: t >= 64.4 ? 'smile' : 'soft',
      turn: 0.1,
    });
    for (const sd of [-1, 1]) oval(ctx, 158 + sd * 13, lerp(134, 122, q), 11, 9, MARTA.legs);
    // The stern, pointing at us.
    poly(ctx, HULL, [160, 176, 94, 118, 104, 116, 160, 160, 216, 116, 226, 118]);
    poly(ctx, DECK, [160, 162, 130, 138, 190, 138]);
    line(ctx, HULL_HI, 2.4, [94, 118, 160, 176, 226, 118]);
    // Her handle across her, to the pin on her side: yellow, screen right from here.
    const hand: XY = [lerp(152, 140, q), lerp(116, 128, q)];
    line(ctx, SHAFT, 3, [hand[0] - 10, hand[1], 218, 114]);
    oval(ctx, hand[0] - 6, hand[1], 4.5, 4, MARTA.skin);
    oval(ctx, hand[0] + 6, hand[1], 4.5, 4, MARTA.skin);
    box(ctx, hand[0] + 9, hand[1] - 3, 2, 6, YELLOW);
    // Two blades at the edges of frame, entering the water as one.
    for (const b of [
      { sd: 1, color: YELLOW, depth: 4.3, pin: [218, 114] as XY },
      { sd: -1, color: BLUE, depth: 4.9, pin: [104, 108] as XY },
    ]) {
      const L = 2.7;
      const bu = -0.55 + L * Math.sin(o.phi),
        bw = b.sd * (HB + 0.3 + L * Math.cos(o.phi));
      const z = Math.max(0.6, b.depth + bu);
      const f = 170;
      const sz = f / z;
      const bh = o.lift > 0 ? o.lift * 0.5 : 0;
      const bx = 160 + (f * bw) / z,
        by = hz + (f * (0.9 - bh)) / z;
      line(ctx, SHAFT, Math.max(2, sz * 0.08), [b.pin[0], b.pin[1], bx, by]);
      const th = sz * lerp(0.05, 0.24, o.square);
      const wet = o.lift < 0;
      poly(ctx, wet ? mix(b.color, '#3E6E80', 0.3) : b.color, [
        bx - b.sd * sz * 0.1,
        by - th * 0.5,
        bx + b.sd * sz * 0.75,
        by - th,
        bx + b.sd * sz * 0.75,
        by + th,
        bx - b.sd * sz * 0.1,
        by + th * 0.5,
      ]);
      if (wet)
        oval(ctx, bx + b.sd * sz * 0.32, by + th * 0.2, sz * 0.55, sz * 0.07, alpha(FOAM, 0.6));
      if (since < 0.75) {
        const k = since / 0.75;
        // The first catch together throws the biggest rings: one instant, at both edges of frame.
        const first = t < SYNC + 0.75;
        oval(
          ctx,
          bx + b.sd * sz * 0.32,
          by + th * 0.3,
          sz * (first ? 0.7 + k * 0.9 : 0.5 + k * 0.7),
          sz * (0.08 + k * 0.07),
          alpha(FOAM, 0.7 * (1 - k)),
        );
        for (let i = 0; i < 9; i++) {
          const a = (i / 8 - 0.5) * 2.4;
          const r = sz * (0.3 + rand(i * 3.7) * 0.45);
          disc(
            ctx,
            bx + b.sd * sz * 0.32 + Math.sin(a) * r * k * 1.5,
            by - Math.sin(Math.PI * k) * r * 1.7,
            Math.max(1, sz * 0.045),
            alpha(FOAM, 0.9 * (1 - k)),
          );
        }
      }
    }
  });
}
function twoShot(ctx: Ctx, t: number, seconds: number, era: 'then' | 'now') {
  const now = era === 'now';
  const surge = Math.sin(((t - SYNC) / BAR) * Math.PI * 2) * 1.5;
  sideBack(ctx, seconds, {
    gold: now ? 0.85 : 0.3,
    scroll: t * 26,
    horizon: 66,
    bunting: true,
    sun: now,
  });
  camera(ctx, { x: 152, y: 110, zoom: 1.4 }, () =>
    skiff(ctx, {
      x: 158 + surge,
      y: 132,
      k: 21,
      heading: 0,
      sq: 0.2,
      seats: now ? nowSeats(t) : thenSeats(t),
      name: true,
    }),
  );
}
function youngShot(ctx: Ctx, t: number, seconds: number) {
  sideBack(ctx, seconds, { gold: 0.3, scroll: t * 26, horizon: 84, bunting: true });
  const lean = leanOf(stroke(t, TOGETHER, 0.34, 0.28, 0.95));
  camera(
    ctx,
    track(t, [
      [74, 160, 92, 1.0],
      [77, 156, 94, 1.08],
    ]),
    () => {
      portrait(ctx, YOUNG, 204, 92 - lean * 3, 1.7, {
        eyes: blink(seconds, 3) ? 'closed' : 'down',
        look: [-0.8, 0.7],
        brows: 0.35,
        mouth: 'smile',
        turn: -0.45,
        tilt: -0.06 + lean * 0.05,
      });
      // The back of a six-year-old head under a cap two sizes too big.
      const bx = 92 - lean * 10,
        by = 148 + lean * 4;
      oval(ctx, bx, by + 40, 34, 26, LITTLE.top);
      box(ctx, bx - 7, by + 4, 14, 14, LITTLE.shade);
      oval(ctx, bx - 17, by - 2, 4, 6, LITTLE.skin);
      oval(ctx, bx + 17, by - 2, 4, 6, LITTLE.skin);
      oval(ctx, bx, by - 6, 18, 18, LITTLE.hair);
      oval(ctx, bx, by - 14, 22, 16, BLUE);
      box(ctx, bx - 6, by - 2, 12, 3, mix(BLUE, '#0B0E14', 0.3));
      poly(ctx, mix(BLUE, '#0B0E14', 0.25), [
        bx - 26,
        by - 18,
        bx - 36,
        by - 22,
        bx - 34,
        by - 14,
        bx - 22,
        by - 12,
      ]);
    },
  );
  sepia(ctx, 1);
}
function glideShot(ctx: Ctx, t: number, seconds: number) {
  const scroll = (t - 84) * 30;
  vgrad(ctx, 0, 0, W, 92, skyBands(1));
  glow(ctx, 270, 70, 150, '#FFE2A8', 0.6);
  disc(ctx, 270, 74, 9, alpha('#FFF4D8', 0.8));
  const off = ((scroll % 120) + 120) % 120;
  for (let i = -1; i < 4; i++) willow(ctx, i * 120 - off + 40, 92, 1.4, 1, seconds);
  box(ctx, 0, 90, W, 4, '#7A6438');
  vgrad(ctx, 0, 94, W, H, waterBands(1));
  // Long reflections of the sun.
  for (let i = 0; i < 12; i++)
    box(
      ctx,
      270 - 8 - i * 1.5 + Math.sin(seconds * 2 + i) * 3,
      98 + i * 7,
      16 + i * 3,
      1.5,
      alpha('#FFF0C8', 0.55),
    );
  glints(ctx, seconds, 24, 0, 96, W, 84, '#FFE8B0', 21, scroll);
  const b: Skiff = {
    x: lerp(92, 214, span(t, 84, 92)),
    y: 132,
    k: 17,
    heading: 0,
    // High enough that his blue blade clears the hull on the far side, rising with her yellow one.
    sq: 0.24,
    seats: nowSeats(t),
  };
  // The reflection: the same boat, flipped under the waterline.
  ctx.save();
  ctx.globalAlpha *= 0.32;
  ctx.translate(0, 132 * 2 + 4);
  ctx.scale(1, -1);
  skiff(ctx, { ...b, splash: false });
  ctx.restore();
  skiff(ctx, b);
}
type Official = {
  x: number;
  facing: 1 | -1;
  arm: number;
  flag: string;
  cloth: number;
  startled: boolean;
};
function official(ctx: Ctx, y: number, size: number, o: Official) {
  const fig: Figure = {
    skin: '#E4B08C',
    hair: '#D8D8D4',
    coat: WHITE,
    legs: '#2A3040',
    build: 'adult',
    size,
    facing: o.facing,
    hat: 'brim',
    hatColor: '#E8D7A0',
    arms: [0.2, o.arm],
    eyes: o.startled ? 'wide' : 'open',
    mouth: o.startled ? 'o' : 'flat',
  };
  person(ctx, o.x, y, fig);
  const hand = handOf(o.x, y, fig);
  const top = { x: hand.x + o.facing * 2, y: hand.y - 13 * size };
  line(ctx, '#5A4232', 1.6, [hand.x, hand.y + 2 * size, top.x, top.y]);
  const c = Math.max(0.15, o.cloth);
  poly(ctx, o.flag, [
    top.x,
    top.y,
    top.x + o.facing * 8 * size * c,
    top.y + 1,
    top.x + o.facing * 7.5 * size * c,
    top.y + 6 * size,
    top.x,
    top.y + 5.5 * size,
  ]);
}
function finishShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [92, 168, 94, 1.0],
    [100, 184, 98, 1.08],
  ]);
  camera(ctx, view, () => {
    sideBack(ctx, seconds, { gold: 0.95, scroll: 300, horizon: 70, sun: true });
    // Her boat comes up the reach, small, in time.
    const approach = span(t, 92, 100);
    skiff(ctx, {
      x: lerp(20, 128, approach),
      y: lerp(100, 112, approach),
      k: lerp(3.2, 6.2, approach),
      heading: 0,
      sq: 0.22,
      seats: nowSeats(t),
    });
    // The finish pontoon, the bell on its post, two officials packing up.
    box(ctx, 190, 132, 140, 10, '#B08A5C');
    for (let px = 196; px < 330; px += 9) box(ctx, px, 132, 1, 10, '#8A6A44');
    box(ctx, 190, 142, 140, 4, '#6A5038');
    for (const px of [198, 252, 306]) box(ctx, px, 146, 5, 34, '#5A4232');
    box(ctx, 312, 82, 3, 50, '#5A4232');
    box(ctx, 304, 82, 12, 2, '#5A4232');
    poly(ctx, '#D8A848', [302, 84, 308, 84, 310, 94, 300, 94]);
    disc(ctx, 305, 95, 1.4, '#8A6A2A');
    const turned = t >= SPOT;
    const up = ease(span(t, RAISE, RAISE + 0.6));
    const roll = ease(span(t, ROLL - 0.5, ROLL + 2.2));
    official(ctx, 133, 1.7, {
      x: 236,
      facing: turned ? -1 : 1,
      arm: lerp(0.9, 2.6, up),
      flag: RED,
      cloth: Math.max(1 - roll, up),
      startled: turned && t < RAISE + 1,
    });
    official(ctx, 133, 1.7, {
      x: 272,
      facing: 1,
      arm: 0.6,
      flag: WHITE,
      cloth: 0.15,
      startled: false,
    });
  });
}
function crossShot(ctx: Ctx, t: number, seconds: number) {
  sideBack(ctx, seconds, { gold: 1, scroll: 320, horizon: 72, sun: true });
  // The finish line: a striped pole on the far bank.
  for (let i = 0; i < 6; i++) box(ctx, 163, 34 + i * 7, 4, 7, i % 2 ? WHITE : RED);
  box(ctx, 162, 30, 6, 4, '#5A4232');
  const k = 8;
  const x = 165 - 4 * k + (POSITION(t).x - POSITION(FINISH).x) * k;
  skiff(ctx, { x, y: 118, k, heading: 0, sq: 0.22, seats: nowSeats(t), name: true });
  // The pontoon: the flag drops, the bell swings.
  box(ctx, 210, 126, 120, 8, '#B08A5C');
  box(ctx, 210, 134, 120, 3, '#6A5038');
  const swing = t >= FINISH ? Math.exp(-(t - FINISH) / 1.2) * Math.sin((t - FINISH) * 9) * 0.5 : 0;
  box(ctx, 302, 86, 2, 40, '#5A4232');
  box(ctx, 296, 86, 8, 2, '#5A4232');
  ctx.save();
  ctx.translate(298, 88);
  ctx.rotate(swing);
  poly(ctx, '#D8A848', [-3, 0, 3, 0, 4.5, 8, -4.5, 8]);
  ctx.restore();
  const drop = easeOut(span(t, FINISH, FINISH + 0.3));
  official(ctx, 127, 1.15, {
    x: 236,
    facing: -1,
    arm: lerp(2.7, 0.6, drop),
    flag: RED,
    cloth: 1,
    startled: false,
  });
  official(ctx, 127, 1.15, {
    x: 262,
    facing: -1,
    arm: 0.4,
    flag: WHITE,
    cloth: 0.15,
    startled: false,
  });
  // The near bank has thinned: a few left on the grass. One claps; then a few more.
  box(ctx, 0, 150, W, 30, '#9A8A50');
  box(ctx, 0, 149, W, 2, '#C0A868');
  const sitters: readonly (readonly [number, string, string, number])[] = [
    [40, '#C8433A', '#8A6A48', CLAP],
    [96, '#4C6A9A', '#D8D4CC', CLAPS],
    [150, '#E8D6A0', '#2A2228', CLAPS + 0.15],
    [220, '#6E8C5A', '#B8884A', CLAPS + 0.3],
  ];
  sitters.forEach(([sx, coat, hair, from], i) => {
    // One clap on its own at CLAP; from CLAPS a few more join in, and so does she.
    const start = i ? from : CLAPS + 0.1;
    const clapping = (t >= start && t < start + 2.4) || (!i && t >= CLAP - 0.2 && t < CLAP + 0.25);
    const beat = !clapping
      ? 0
      : !i && t < CLAPS
        ? hump(t, CLAP - 0.2, CLAP + 0.25)
        : Math.abs(Math.sin((t - start) * Math.PI * 3.2));
    person(ctx, sx, 172, {
      skin: i % 2 ? '#B07850' : '#E8B896',
      hair,
      coat,
      legs: '#3A3A44',
      build: 'adult',
      size: 1.25,
      facing: 1,
      sitting: true,
      arms: clapping ? [1.15 + beat * 0.3, 1.55 - beat * 0.3] : [0.3, 0.4],
      mouth: clapping ? 'smile' : 'flat',
    });
  });
}
function laughShot(ctx: Ctx, t: number, seconds: number) {
  sideBack(ctx, seconds, { gold: 1, scroll: (t - 100) * 20 + 400, horizon: 84, sun: true });
  for (let i = 0; i < 7; i++)
    glow(ctx, 30 + i * 46, 120 + rand(i * 3) * 50, 14 + rand(i) * 10, '#FFE8B0', 0.4);
  const laughing = t < 106.8;
  camera(
    ctx,
    track(t, [
      [104, 160, 92, 1.02],
      [108, 160, 90, 1.12],
    ]),
    () =>
      portrait(ctx, MARTA, 160, 100, 1.85, {
        eyes: laughing ? 'happy' : blink(seconds, 1) ? 'closed' : 'open',
        look: [0.1, 0],
        brows: 0.3,
        raise: 0.4,
        mouth: laughing ? (Math.sin(t * 9) > -0.3 ? 'laugh' : 'grin') : 'smile',
        tilt: (laughing ? Math.sin(t * 9) * 0.04 : 0) - 0.04,
        breath: Math.sin(t * 5.5) * (laughing ? 1 : 0.5),
        key: '#FFC870',
        keyAmount: 0.35,
        wisps: 1,
      }),
  );
}
/** Marta in profile facing left, for the last close-up: she doesn't turn round. */
function martaProfile(ctx: Ctx, x: number, y: number, s: number, talk: boolean, seconds: number) {
  const skin = MARTA.skin,
    shade = MARTA.shade,
    hair = MARTA.hair,
    hairD = mix(hair, '#0B0E14', 0.18);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  disc(ctx, 15, -15, 11, hairD);
  disc(ctx, 21, -20, 7, hair);
  disc(ctx, 20, -21, 3.6, mix(hair, '#FFFFFF', 0.2));
  box(ctx, -3, 12, 13, 22, shade);
  poly(
    ctx,
    skin,
    [
      -4, -23, -12, -17, -14, -8, -15.2, -5, -13.6, -2, -14.8, 2, -18.8, 6.4, -15, 8.4, -15.4, 11,
      -13, 13, -14.6, 14.6, -13.6, 19, -9, 22.5, -2, 22, 8, 16, 16, 2, 13, -17,
    ],
  );
  oval(ctx, 7, 2, 3.4, 5.2, shade);
  disc(ctx, 7, 7.6, 1.3, CREAM);
  poly(
    ctx,
    hair,
    [
      -10, -19, -4, -25.5, 6, -26.5, 15.5, -21, 18.5, -8, 15.5, 6, 11, 10, 10, 0, 6.5, -8, 0, -14,
      -7, -15.5,
    ],
  );
  line(ctx, hairD, 0.6, [-6, -20, 4, -22.5, 13, -17]);
  line(ctx, hairD, 0.6, [-2, -16, 8, -16, 14, -9]);
  // The eye, steady on the water ahead; a heavier lid since the stroke.
  const closed = (seconds + 1.7) % 4 < 0.12;
  if (closed) line(ctx, INK, 0.8, [-12, -1, -9.5, 0, -7, -1]);
  else {
    oval(ctx, -9.6, -1, 2.6, 2, '#F8F4EE');
    disc(ctx, -10.6, -0.9, 1.4, '#5E7488');
    disc(ctx, -10.8, -0.9, 0.7, INK);
    line(ctx, INK, 0.8, [-12.2, -2, -9.5, -2.8, -7, -1.8]);
  }
  line(ctx, '#B4B8BE', 0.9, [-13.6, -6.8, -10, -7.8, -6.4, -7.2]);
  line(ctx, alpha(shade, 0.9), 0.5, [-5.6, -1.6, -3.6, -2.6]);
  line(ctx, alpha(shade, 0.9), 0.5, [-5.6, 0, -3.4, 0.4]);
  line(ctx, alpha(shade, 0.8), 0.6, [-14.4, 7.6, -12.6, 10.4, -11.6, 13.6]);
  line(ctx, alpha(shade, 0.6), 0.5, [-11, -12, -5, -13]);
  if (talk) oval(ctx, -13.6, 12.6, 1.4, 1.1, '#5A2A24');
  else line(ctx, '#5A2A24', 0.8, [-14.4, 12.2, -12.6, 12.8, -11.2, 12.2]);
  ctx.restore();
}
function handShot(ctx: Ctx, t: number, seconds: number) {
  sideBack(ctx, seconds, { gold: 1, scroll: (t - 100) * 20 + 520, horizon: 96, sun: true });
  const reach = ease(span(t, 108.0, HAND));
  const take = ease(span(t, HAND, HAND + 0.4));
  camera(
    ctx,
    track(t, [
      [108, 160, 96, 1.0],
      [111.4, 166, 92, 1.09],
    ]),
    () => {
      // Marta in profile, facing the stern: she doesn't turn round.
      poly(ctx, NAVY, [40, 180, 46, 146, 74, 128, 112, 126, 142, 140, 158, 180]);
      poly(ctx, '#212F50', [120, 180, 128, 134, 142, 140, 158, 180]);
      line(ctx, YELLOW, 3, [80, 128, 112, 127]);
      martaProfile(ctx, 96, 92, 2.2, t > 108.7 && t < 110.6 && Math.sin(t * 15) > 0, seconds);
      // Her good hand comes up over her shoulder, back toward him; he takes it.
      const elbow: XY = [lerp(140, 152, reach), lerp(178, 96, reach)];
      const wrist: XY = [lerp(134, 196, reach), lerp(210, 78, reach)];
      line(ctx, NAVY, 13, [134, 142, elbow[0], elbow[1]]);
      const fore = Math.atan2(wrist[1] - elbow[1], wrist[0] - elbow[0]);
      const len = Math.hypot(wrist[0] - elbow[0], wrist[1] - elbow[1]) / 1.25;
      reachHand(ctx, MARTA, wrist[0], wrist[1], 1.25, fore, 0.15, {
        sleeve: NAVY,
        cuff: YELLOW,
        old: true,
        reach: len,
      });
      const meet = ease(span(t, 107.9, HAND));
      reachHand(
        ctx,
        LUKA,
        lerp(380, 250, meet),
        lerp(20, 70, meet),
        1.45,
        Math.PI - 0.32,
        0.2 + take * 0.95,
        { sleeve: BLUE },
      );
      if (take > 0) glow(ctx, 222, 72, 34, '#FFE8B0', 0.3 * take);
    },
  );
}
function finalShot(ctx: Ctx, t: number, seconds: number) {
  const sunX = VX + FOC * 0.22;
  upriver(ctx, seconds, 1, sunX);
  // Held near enough to read the two of them, on the sun's path of light.
  const Z = 15 + (t - 111) * 1.2;
  const X = -0.5 + (Z - 15) * 0.22;
  const [bx, by] = persp(X, Z);
  const k = FOC / Z;
  // The wake: one dead-straight line all the way back to us.
  const wake: number[] = [];
  // Straight on the water is straight on screen: the stern and a point under the camera.
  for (const z of [Z - 4, 4]) wake.push(...persp(X + (z - Z) * 0.22, z));
  line(ctx, alpha(FOAM, 0.55), 1.4, wake);
  const vl: number[] = [],
    vr: number[] = [];
  for (const z of [Z - 4, 4.5]) {
    const spread = (Z - 4 - z) * 0.18;
    vl.push(...persp(X + (z - Z) * 0.22 - spread, z));
    vr.push(...persp(X + (z - Z) * 0.22 + spread, z));
  }
  line(ctx, alpha(FOAM, 0.22), 1, vl);
  line(ctx, alpha(FOAM, 0.22), 1, vr);
  const seats = nowSeats(t).map((s) => ({ ...s, oar: REST }));
  skiff(ctx, { x: bx, y: by, k, heading: -Math.PI / 2 + Math.atan(0.22), sq: CAMH / Z, seats });
}

function drawShot(ctx: Ctx, name: ShotName, t: number, seconds: number) {
  switch (name) {
    case 'reach':
      return reachShot(ctx, t, seconds);
    case 'boathouse':
      return boathouseShot(ctx, t, seconds);
    case 'bow':
      return bowShot(ctx, t, seconds);
    case 'photo':
      return photoShot(ctx, t, seconds);
    case 'pontoon':
      return pontoonShot(ctx, t, seconds);
    case 'doubt':
      return doubtShot(ctx, t, seconds);
    case 'eager':
      return eagerShot(ctx, t, seconds);
    case 'buckle':
      return handleShot(ctx, t, seconds, false);
    case 'start':
      return startShot(ctx, t, seconds);
    case 'spin':
      return spinShot(ctx, t, seconds);
    case 'overhead':
      return overheadShot(ctx, t, seconds);
    case 'bank':
      return bankShot(ctx, t, seconds);
    case 'strain':
      return strainShot(ctx, t, seconds);
    case 'slip':
      return handleShot(ctx, t, seconds, true);
    case 'crab':
      return crabShot(ctx, t, seconds);
    case 'still':
      return stillShot(ctx, t, seconds);
    case 'bite':
      return biteShot(ctx, t, seconds);
    case 'back':
      return backShot(ctx, t, seconds);
    case 'watch':
      return watchShot(ctx, t, seconds);
    case 'copy':
      return copyShot(ctx, t, seconds);
    case 'blades':
      return bladesShot(ctx, t, seconds);
    case 'straighten':
      return straightenShot(ctx, t, seconds);
    case 'then':
      return thenShot(ctx, t, seconds);
    case 'young':
      return youngShot(ctx, t, seconds);
    case 'memory':
      twoShot(ctx, t, seconds, 'then');
      return sepia(ctx, 1);
    case 'reversed':
      return twoShot(ctx, t, seconds, 'now');
    case 'glide':
      return glideShot(ctx, t, seconds);
    case 'finish':
      return finishShot(ctx, t, seconds);
    case 'cross':
      return crossShot(ctx, t, seconds);
    case 'laugh':
      return laughShot(ctx, t, seconds);
    case 'hand':
      return handShot(ctx, t, seconds);
    default:
      return finalShot(ctx, t, seconds);
  }
}

const LINES: readonly (readonly [number, number, string])[] = [
  [18.0, 21.0, 'Like old times, Mum.'],
  [108.6, 111.4, 'Same time tomorrow?'],
];

// ——— The score ———
const ROOT = 62; // D
/** The music-box theme, [beat, degree above D, beats], three beats to the bar. */
const THEME: readonly (readonly [number, number, number])[] = [
  [0, 0, 1],
  [1, 4, 1],
  [2, 7, 1],
  [3, 9, 1],
  [4, 7, 1],
  [5, 4, 1],
  [6, 4, 1],
  [7, 2, 1],
  [8, -1, 1],
  [9, 2, 3],
  [12, 0, 1],
  [13, 4, 1],
  [14, 7, 1],
  [15, 12, 1],
  [16, 11, 1],
  [17, 9, 1],
  [18, 7, 1],
  [19, 4, 1],
  [20, 2, 1],
  [21, 0, 3],
];
/** One chord root per bar, as semitones above D, for the waltz from SYNC. */
const WALTZ_BARS: readonly number[] = [
  // together, no melody
  0, 0, 7, 5,
  // the memory: the first phrase on the music box
  0, 0, 7, 7, 0,
  // the glide: the whole theme, landing home just after the finish
  0, 0, 7, 7, 0, 5, 7, 0,
  // and a last bar, fading
  0,
];
/** The far brass band's march tune: [beat, degree], at 112 to the minute. */
const MARCH: readonly (readonly [number, number])[] = [
  [0, 7],
  [1, 7],
  [1.5, 9],
  [2, 7],
  [3, 4],
  [4, 5],
  [5, 4],
  [5.5, 2],
  [6, 4],
  [7, 0],
];

export const inTimeScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: ROOT, voice: 'bell', intro: [0, 4, 7], outro: [0, 7, 12, 16] }, (s) => {
    const fx = (kind: Parameters<typeof s.fx>[0], t: number, dur: number, gain: number, pan = 0) =>
      s.fx(kind, at(t), dur, gain, pan);
    const note = (t: number, pitch: number, dur: number, voice: Voice, gain: number, pan = 0) =>
      s.note(at(t), pitch, dur, voice, gain, pan);
    const into = (p: number, lo: number) => {
      let q = p;
      while (q < lo) q += 12;
      while (q >= lo + 12) q -= 12;
      return q;
    };

    // Act one: the regatta murmur, gulls, and a brass band far off by the bandstand.
    fx('crowd', 0, 7.3, 0.05);
    fx('crowd', 7, 7.2, 0.022);
    fx('crowd', 14, 9.4, 0.05);
    fx('crowd', 23.2, 3.4, 0.032);
    fx('crowd', 26.4, 2.2, 0.08);
    fx('water', 0, 28.2, 0.03);
    fx('gull', 2.0, 0.7, 0.04, 0.3);
    fx('gull', 15.5, 0.7, 0.035, -0.3);
    const mbeat = 60 / 112;
    for (const [from, to, gain] of [
      [0.2, 10.6, 0.022],
      [14.2, 22.6, 0.018],
    ] as const) {
      for (let bar = 0; from + bar * 4 * mbeat < to - 0.3; bar++) {
        const t0 = from + bar * 4 * mbeat;
        // Inside the boathouse the band is muffled.
        const g = gain * (t0 > 6.6 && t0 < 14 ? 0.5 : 1);
        note(t0, ROOT - 24, mbeat * 0.8, 'bass', g * 1.6, 0.4);
        note(t0 + mbeat * 2, ROOT - 17, mbeat * 0.8, 'bass', g * 1.6, 0.4);
        for (const off of [1, 3])
          for (const d of [4, 7])
            note(t0 + mbeat * off, ROOT + d, mbeat * 0.5, 'pluck', g * 0.7, 0.5);
        if (bar % 2 === 0)
          for (const [b, d] of MARCH)
            if (t0 + b * mbeat < to)
              note(t0 + b * mbeat, ROOT + 12 + d, mbeat * 0.8, 'lead', g, 0.45);
      }
    }
    fx('creak', LIFT, 0.8, 0.09, -0.2);
    // The photo: the theme's first phrase on the music box.
    THEME.slice(0, 6).forEach(([, d], i) =>
      note(11.25 + i * 0.45, ROOT + 12 + d, 0.9, 'bell', 0.07),
    );
    for (const d of [0, 4, 7]) note(11.1, ROOT - 12 + d, 3, 'pad', 0.018, (d - 3.5) * 0.08);
    // Her walk: slow steps, and the cane between them.
    // Her feet land where the walk cycle's stride is widest, sin(3.1 · walk) = ±1.
    for (const k of [0, 1]) {
      const foot = 14 + (Math.PI / 2 + k * Math.PI) / WALK_RATE;
      fx('step', foot, 0.12, 0.055, -0.1);
      fx('knock', foot + Math.PI / 2 / WALK_RATE, 0.06, 0.03, -0.1);
    }
    for (const d of [-3, 0, 4]) note(16.5, ROOT - 12 + d, 1.8, 'pad', 0.016);
    for (const d of [0, 4, 7]) note(18.0, ROOT - 12 + d, 3, 'pad', 0.02);
    fx('click', BUCKLE, 0.06, 0.12, 0.1);
    // The start: a held breath, the whistle, the four crews away.
    for (const d of [7, 14]) note(23.1, ROOT - 12 + d, 3.3, 'pad', 0.018);
    for (const k of [24.6, 25.4, 26.1]) note(k, 36, 0.25, 'kick', 0.05);
    fx('whistle', START, 0.7, 0.12, -0.2);
    RIVAL_STROKES.forEach((list, i) =>
      list.forEach((c) => {
        if (c < 31) fx('splash', c, 0.3, 0.04 * (1 - (c - START) / 5), 0.3 + i * 0.1);
      }),
    );

    // The spin: no melody, two clocks that refuse to agree. Her seat is screen left.
    fx('water', 28, CRAB - 28, 0.045);
    // The crowd rises over the clash, so the two clocks read as tension, not a mixing error.
    fx('crowd', 28.2, 4, 0.08);
    fx('crowd', 32, 4, 0.09);
    fx('crowd', 36, 4, 0.105);
    fx('crowd', 40, CRAB - 40, 0.13);
    for (const c of HER_STROKES) {
      note(c, 50, 0.9, 'pluck', 0.095, -0.35);
      if (c < CRAB) fx('splash', c, 0.35, 0.06, -0.5);
    }
    for (const c of HIS_STROKES) {
      note(c, 36, 0.2, 'kick', 0.06);
      note(c, 44, 0.5, 'bass', 0.055, 0.2);
      fx('splash', c, 0.4, 0.07, 0.5);
    }
    fx('giggle', GIGGLE, SHUSH - GIGGLE, 0.05, 0.2);
    // The crab. Then nothing but the water: the loudest cue in the film.
    fx('splash', CRAB, 0.6, 0.16, -0.3);
    fx('thud', CRAB, 0.35, 0.14);
    fx('water', CRAB, SYNC - CRAB, 0.07);
    fx('gull', 50, 0.8, 0.025, 0.4);
    for (const c of TAPS) fx('knock', c, 0.05, 0.09, -0.15);

    // SYNC: one shared splash and a deep D under it.
    fx('splash', SYNC, 0.5, 0.14);
    note(SYNC, 38, 2, 'bass', 0.1);
    fx('water', SYNC, STORY + 2 - SYNC, 0.04);
    TOGETHER.forEach((c, i) => {
      if (i) fx('splash', c, 0.3, c > 72 && c < 81 ? 0.05 : 0.07);
    });
    // The waltz: 75 to the minute, so every downbeat is a catch.
    // The home bar is pushed onto FINISH, a dotted eighth early, as they glide over the line.
    const HOME = 16;
    WALTZ_BARS.forEach((deg, n) => {
      const grid = SYNC + n * BAR;
      const t0 = n === HOME ? FINISH : grid;
      const len = n === HOME - 1 ? FINISH - grid : n === HOME ? grid + BAR - FINISH : BAR;
      const level = n === 0 ? 0.6 : n < 4 ? 0.8 : n < 9 ? 0.65 : n < 16 ? 1 : n === 16 ? 0.8 : 0.4;
      const r = ROOT + deg;
      note(t0, into(r, 36), len * 0.9, 'bass', 0.07 * level);
      [0, 4, 7].forEach((d, i) =>
        note(t0, into(r + d, 57), len * 0.95, 'pad', 0.02 * level, (i - 1) * 0.3),
      );
      for (const beat of [1, 2]) {
        const tb = grid + beat * BEAT;
        // Leave a clean gap before the finish bell.
        if (n === HOME - 1 && tb > FINISH - 0.3) continue;
        for (const d of [4, 7]) note(tb, into(r + d, 69), BEAT * 0.5, 'keys', 0.022 * level, 0.2);
      }
    });
    // The memory: the first phrase on the music box, over the same waltz.
    const mem = SYNC + 4 * BAR;
    for (const [b, d, len] of THEME.slice(0, 10))
      note(mem + b * BEAT, ROOT + 12 + d, len * BEAT, 'bell', 0.065, -0.1);
    // The glide: the whole theme on the lead. Its last note is pushed onto FINISH, so the
    // home D lands as they cross; the E before it shrinks to a sixteenth.
    const glide = SYNC + 9 * BAR;
    const last = THEME.length - 1;
    THEME.forEach(([b, d, beats], i) => {
      const t0 = i === last ? FINISH : glide + b * BEAT;
      const next =
        i === last ? glide + (b + beats) * BEAT : i === last - 1 ? FINISH : t0 + beats * BEAT;
      const len = next - t0;
      note(t0, ROOT + d, len * 0.95, 'lead', 0.07, Math.sin(b * 0.7) * 0.2);
      note(t0, ROOT + 24 + d, Math.min(len, beats * BEAT * 0.6), 'bell', 0.022, -0.2);
    });
    fx('gull', 90, 0.8, 0.03, -0.4);
    // The finish: the bell on its post, one clap, then a few, then her laugh.
    fx('chime', FINISH, 1.6, 0.1, 0.35);
    fx('applause', CLAP, 0.3, 0.04, -0.3);
    fx('applause', CLAPS, 2.5, 0.07, -0.1);
    fx('giggle', LAUGH, 0.8, 0.045);
    // The hand: the theme's last phrase on the keys, a plagal G to D, home.
    for (const d of [-7, -3, 0]) note(108.0, ROOT + d, 2.4, 'pad', 0.02, d * 0.04);
    [7, 4, 2].forEach((d, i) => note(108.0 + i * BEAT, ROOT + d, BEAT * 1.1, 'keys', 0.09));
    note(110.4, ROOT, 2.6, 'keys', 0.095);
    note(110.4, ROOT + 12, 2.2, 'bell', 0.035, 0.2);
    for (const d of [0, 4, 7]) note(110.4, ROOT - 12 + d, 5, 'pad', 0.028, (d - 3.5) * 0.08);
    note(110.4, 38, 3.4, 'bass', 0.07);
  });

export const inTime: FilmModule = {
  draw(ctx, p, seconds) {
    const t = p * STORY;
    const soft = SOFT.find(([a, b]) => t >= a && t < b);
    if (soft) {
      drawShot(ctx, soft[2], t, seconds);
      faded(ctx, ease(span(t, soft[0], soft[1])), () => drawShot(ctx, soft[3], t, seconds));
    } else drawShot(ctx, scene(t), t, seconds);
    // The race runs long into the evening: a slow warm grade, and a soft vignette.
    wash(ctx, '#F2B870', goldAt(t) * 0.06);
    vignette(ctx, 0.34, '#1E2A30');
    // Under the end card, let the last frame sink back so the words read.
    wash(ctx, '#0B0E14', ease((seconds - STORY - 3) / 0.9) * 0.3);
    captions(
      ctx,
      p,
      LINES.map(([a, b, text]) => [at(a), at(b), text] as const),
      {},
      0.3 / STORY,
    );
  },
  score: inTimeScore,
  look: {
    shade: '#1E3A4C',
    ink: '#F4E6C4',
    accent: '#E0A043',
    dedication: 'for everyone who once slowed down for us',
  },
};
