import type { FilmModule } from './types';
import type { Voice } from '../music/score';
import {
  alpha,
  backOut,
  box,
  camera,
  clamp,
  disc,
  ease,
  easeIn,
  easeOut,
  glow,
  H,
  hump,
  lerp,
  line,
  mix,
  oval,
  person,
  poly,
  rand,
  sky,
  span,
  TAU,
  track,
  veil,
  vignette,
  W,
  write,
  type Ctx,
  type Figure,
} from './kit';
import { composeFilm, type Score } from './score-kit';

/*
 * THE WASP CONCERTO
 * Sunday, four o'clock, the riverside bandstand. The Maestro has ruled his brass band by fear for
 * years (there is a little black book of Horace's late entries to prove it). Then a wasp leaves a
 * small boy's jam sandwich for the podium, and the band, faithful to the last, plays every flick,
 * swat, duck and flail of the baton. The fight becomes the concert; Horace's tuba saves the day;
 * and the Maestro, for the first time, shuts his book and bows to his band.
 *
 * Every beat lives in story seconds (104 between the title and the end card), shared by the
 * pictures and the score, so each swat lands on its note. The wasp's path is one list of
 * keyframes, read by the drawing (and its dotted trail) and by the buzz in the score.
 */

// ——— Timing ———
export const STORY = 104;
const at = (s: number) => s / STORY;

export const KNOCKS = [7.6, 8.0, 8.4] as const;
export const DOWNBEAT = 14.5;
export const FLICK = 28.8;
export const SWIPE = 35.2;
export const DUCK = 40.8;
export const RISE = 43.2;
export const LAND_NOSE = 46.0;
export const DROPS = [49.0, 51.0, 53.0] as const;
export const SAGS = [54.0, 54.8, 55.6] as const;
export const SQUEAK = 56.2;
export const PRESTO = 62.0;
export const INTO_TUBA = 70.0;
export const LAUNCH = 72.5;
export const FINAL_HIT = 81.0;
export const BOW = 93.0;
export const JAR = 101.0;

const WARM = 6.5;
const LATE_OOM = 7.0;
const SCRIBBLE = 10.0;
/** The shot on Horace's ears, going red, and the close-up where the baton goes up. */
const EARS_CUT = 11.4;
const RAISE_CUT = 12.5;
const RAISE = 12.8;
const NOD = 18.0;
const LANDS_ON_JAM = 21.65;
const OFF_JAM = 23.0;
/** The deadpan crash insert after the swipe, and the front row the crash wakes up. */
const CRASH_CUT = 35.35;
const WAKE_CUT = 36.0;
const SNORT = 36.2;
const LAWN_ROUND = 37.4;
const LIFT = 58.0;
const EXHALE = 58.5;
const RETURN = 59.5;
const FLAIL = 60.0;
/** The close-up as he chases it, and the over-the-shoulder shot where it dives into the tuba. */
const CHASE_CUT = 68.0;
const DIVE_CUT = 69.4;
const POINT = 70.8;
const INHALE = 71.5;
const CLAP_ONE = 86.0;
/** The boy's three claps, alone: picture and sound. */
const CLAPS = [CLAP_ONE, 86.35, 86.7] as const;
const OVATION = 87.0;
/** The turn: he half turns to the lawn, shuts the book and tosses it, sees his band, smiles. */
const TURN_CUT = 89.4;
const BOOK_CUT = 90.6;
const BOOK_SHUT = 91.0;
const BOOK_TOSS = 91.35;
const ROW_CUT = 91.8;
const SMILE_CUT = 92.4;
const SMILE = 92.65;
const ENCORE = 94.6;
/** The insert on the cymbal player, and the moment he finally grins. */
const GRIN_CUT = 93.9;
const GRIN = 94.1;
const ENCORE_PLAY = 95.0;
const NEXT_SUNDAY = 96.0;
const LAST_RAISE = 102.0;
const TWEET_AT = 57.3;

// ——— The cutting ———
type Kind =
  | 'lawn'
  | 'ots'
  | 'cuM'
  | 'book'
  | 'front'
  | 'sandwich'
  | 'row'
  | 'nose'
  | 'clarinet'
  | 'trumpet'
  | 'trombone'
  | 'horace'
  | 'cymbals'
  | 'bell'
  | 'flight'
  | 'tip'
  | 'boy'
  | 'sign'
  | 'tableau';
/** Where each shot begins, in story seconds, and what it shows. */
const SHOTS: readonly (readonly [number, Kind])[] = [
  [0, 'lawn'],
  [6.0, 'ots'],
  [7.6, 'cuM'],
  [9.6, 'book'],
  [EARS_CUT, 'ots'],
  [RAISE_CUT, 'cuM'],
  [DOWNBEAT, 'lawn'],
  [19.0, 'front'],
  [22.0, 'sandwich'],
  [OFF_JAM, 'lawn'],
  [25.5, 'cuM'],
  [FLICK, 'ots'],
  [31.0, 'cuM'],
  [32.5, 'row'],
  [34.0, 'ots'],
  [CRASH_CUT, 'cymbals'],
  [WAKE_CUT, 'front'],
  [LAWN_ROUND, 'lawn'],
  [DUCK, 'ots'],
  [44.0, 'lawn'],
  [45.7, 'nose'],
  [46.8, 'ots'],
  [48.0, 'clarinet'],
  [49.5, 'trumpet'],
  [51.4, 'nose'],
  [52.2, 'trombone'],
  [53.5, 'horace'],
  [56.6, 'lawn'],
  [57.8, 'cuM'],
  [FLAIL, 'ots'],
  [PRESTO, 'ots'],
  [64.0, 'row'],
  [66.0, 'front'],
  [CHASE_CUT, 'cuM'],
  [DIVE_CUT, 'ots'],
  [INHALE, 'horace'],
  [72.3, 'bell'],
  [74.2, 'lawn'],
  [76.0, 'flight'],
  [80.0, 'ots'],
  [82.0, 'tip'],
  [84.0, 'lawn'],
  [85.8, 'boy'],
  [OVATION, 'lawn'],
  [TURN_CUT, 'cuM'],
  [BOOK_CUT, 'book'],
  [ROW_CUT, 'row'],
  [SMILE_CUT, 'cuM'],
  [BOW, 'ots'],
  [GRIN_CUT, 'cymbals'],
  [ENCORE, 'cuM'],
  [NEXT_SUNDAY, 'sign'],
  [98.5, 'lawn'],
  [JAR, 'tableau'],
];
function shotAt(t: number) {
  let i = 0;
  while (i + 1 < SHOTS.length && t >= SHOTS[i + 1][0]) i++;
  return { index: i, kind: SHOTS[i][1], from: SHOTS[i][0], to: SHOTS[i + 1]?.[0] ?? STORY };
}

// ——— Palette: a bright Sunday afternoon ———
const INK = '#26202A';
const SKY_A = '#9FCBE8';
const SKY_B = '#CFE6F2';
const SKY_HI = '#7DB4DE';
const GRASS = '#7FB35A';
const GRASS_L = '#8DC067';
const STAND = '#F4F1EA';
const STAND_D = '#DCD5C6';
const ROOF = '#C8323A';
const ROOF_D = '#A12631';
const JACKET = '#B8262E';
const JACKET_D = '#8C1B23';
const PIPING = '#E8C14A';
const BRASS = '#E3B544';
const BRASS_D = '#A87E28';
const BRASS_L = '#F8DE8C';
const TAILS = '#24212B';
const TAILS_L = '#3D3946';
const SILVER = '#F3F3F5';
const SILVER_D = '#BEC2CC';
const BROW = '#2B262E';
const PALE = '#F2DCCB';
const PALE_D = '#DDBCA6';
const RIVER = '#7DB9D9';
const TREE = '#5E9547';
const TREE_D = '#4A7A37';
const WOOD = '#A0703F';
const WOOD_D = '#7A5230';
const TROUSERS = '#2B2C3A';
const CHALK = '#F3F0E6';
const BOARD = '#2E3A36';
const JAM = '#C4283A';
const BREAD = '#F0D7A0';
const CRUST = '#C98E4A';
const WASP_Y = '#F6C519';
const PAPER = '#FBF6E8';
const WHITE = '#FFFFFF';
const DECK = '#E4D2B0';
const STRIPES = ['#D2423F', '#3E78B8', '#E7A23A', '#3E9A78'] as const;
const SKINS = ['#E9BC9A', '#C68A62', '#F2D3B5', '#9A6B4E'] as const;
const HAIRS = ['#3A2A22', '#D9D6D0', '#B5532F', '#2A2024'] as const;

// ——— Little helpers ———
function ring(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  width: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, TAU);
  ctx.stroke();
}
function wash(ctx: Ctx, y: number, h: number, stops: readonly string[]) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  stops.forEach((c, i) => g.addColorStop(i / Math.max(1, stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, h);
}
function cloud(ctx: Ctx, x: number, y: number, s: number) {
  oval(ctx, x, y, 16 * s, 5 * s, '#F7FBFD');
  disc(ctx, x - 7 * s, y - 3 * s, 6 * s, '#F7FBFD');
  disc(ctx, x + 4 * s, y - 5 * s, 7.5 * s, WHITE);
}
type Pt = readonly [number, number];
const blend = (a: Pt, b: Pt, u: number): [number, number] => [
  lerp(a[0], b[0], u),
  lerp(a[1], b[1], u),
];
/** A white glove, fingers up, turned by `a`, with its cuff and black sleeve. */
function glove(ctx: Ctx, x: number, y: number, s: number, a = 0, sleeve = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  if (sleeve) {
    box(ctx, -6, 6, 12, 22, TAILS);
    box(ctx, -6, 5, 12, 3, WHITE);
  }
  oval(ctx, 0, 0, 5.6, 6, WHITE);
  for (let i = 0; i < 4; i++) oval(ctx, -3.6 + i * 2.4, -6, 1.25, 2.8, WHITE);
  oval(ctx, -5.8, -0.6, 1.7, 3, WHITE);
  for (let i = 0; i < 3; i++) line(ctx, SILVER_D, 0.5, [-2.4 + i * 2.4, -5, -2.4 + i * 2.4, -1]);
  ctx.restore();
}

// ——— The Maestro's body: one pose, seen from the front, from behind, and in close-up ———
type MPose = {
  /** His right hand (the baton) and his left, relative to his feet, for a 64-px figure. */
  rh: Pt;
  lh: Pt;
  /** Baton angle: 0 points straight up, positive leans toward screen right (front view). */
  baton: number;
  crouch: number;
  bow: number;
  spin: number;
  /** 0 swept back, 1 coming loose, 2 wild. */
  hair: number;
  tie: number;
  /** The whole figure tipped about his feet (radians; negative leans toward screen left). */
  lean: number;
};
const BATON = 17;
/** How far he sinks when he ducks under the wasp. */
const DUCK_DEPTH = 27;
/** The four-beat pattern, as ictus points for the baton hand. */
const PATTERN = [
  [0, 8],
  [9, 3],
  [-10, 3],
  [-1, -9],
] as const;
function beatHand(t: number, origin: number, bpm: number, size: number): [number, number] {
  const b = Math.max(0, ((t - origin) * bpm) / 60);
  const k = Math.floor(b),
    f = b - k;
  const a = PATTERN[k % 4],
    c = PATTERN[(k + 1) % 4];
  const u = ease(f);
  const lift = Math.sin(Math.PI * Math.min(1, f * 1.25)) * 5;
  return [-14 + lerp(a[0], c[0], u) * size, -46 + (lerp(a[1], c[1], u) - lift) * size];
}
const beatBaton = (t: number, origin: number, bpm: number) =>
  0.5 + 0.3 * Math.sin(((Math.max(0, t - origin) * bpm) / 60) * TAU);

function mPose(t: number): MPose {
  const pose: MPose = {
    rh: [-13, -21],
    lh: [13, -21],
    baton: 2.6,
    crouch: 0,
    bow: 0,
    spin: 0,
    hair:
      t >= NEXT_SUNDAY
        ? 0
        : t < FINAL_HIT
          ? ease(span(t, PRESTO, 68))
          : 1 + backOut(span(t, FINAL_HIT, FINAL_HIT + 0.3)),
    tie:
      t >= FINAL_HIT && t < NEXT_SUNDAY ? 0.55 * backOut(span(t, FINAL_HIT, FINAL_HIT + 0.3)) : 0,
    lean: 0,
  };
  if (t < 6) return pose;
  if (t < KNOCKS[0]) {
    const u = ease(span(t, 6, 6.6));
    return {
      ...pose,
      rh: blend([-13, -21], [-17, -44], u),
      lh: blend([13, -21], [11, -30], u),
      baton: lerp(2.6, 0.5, u),
    };
  }
  if (t < 9.6) {
    const tap = KNOCKS.reduce((m, k) => Math.max(m, hump(t, k - 0.12, k + 0.1)), 0);
    return { ...pose, rh: [4, -36], lh: [11, -30], baton: 1.2 + tap * 0.8 };
  }
  if (t < 11.4) return { ...pose, rh: [6, -38], lh: [11, -30], baton: 2.4 };
  if (t < DOWNBEAT - 0.25) {
    const u = ease(span(t, RAISE, RAISE + 0.8));
    const shake = Math.sin(t * 37) * 0.5 * u;
    return {
      ...pose,
      rh: blend([-14, -36], [-17 + shake, -68], u),
      lh: blend([11, -30], [17 - shake, -68], u),
      baton: lerp(0.6, 0.15, u),
    };
  }
  if (t < DOWNBEAT) {
    const u = easeIn(span(t, DOWNBEAT - 0.25, DOWNBEAT));
    return {
      ...pose,
      rh: blend([-17, -68], beatHand(DOWNBEAT, DOWNBEAT, 100, 1), u),
      lh: blend([17, -68], [11, -30], u),
      baton: lerp(0.15, 0.5, u),
    };
  }
  if (t < FLICK)
    return {
      ...pose,
      rh: beatHand(t, DOWNBEAT, 100, 1),
      lh: [11, -30],
      baton: beatBaton(t, DOWNBEAT, 100),
    };
  const nervous: Pt = [12 + Math.sin(t * 9) * 2, -40 + Math.sin(t * 7) * 3];
  if (t < 34.0) {
    const flick = hump(t, FLICK, FLICK + 0.35);
    return {
      ...pose,
      rh: blend(beatHand(t, FLICK, 126, 1.2), [-5, -60], flick),
      lh: nervous,
      baton: beatBaton(t, FLICK, 126) - flick * 1.8,
    };
  }
  if (t < SWIPE + 0.8) {
    const up = ease(span(t, 34.0, 35.05));
    const down = easeIn(span(t, 35.05, SWIPE + 0.1));
    const back = ease(span(t, SWIPE + 0.25, SWIPE + 0.8));
    const beat = beatHand(t, FLICK, 126, 1.2);
    const rh = blend(blend(blend(beat, [-4, -78], up), [-32, -14], down), beat, back);
    const b0 = beatBaton(t, FLICK, 126);
    return {
      ...pose,
      rh,
      lh: [12, -40],
      baton: lerp(lerp(lerp(b0, -0.5, up), 2.5, down), b0, back),
    };
  }
  if (t < DUCK)
    return {
      ...pose,
      rh: beatHand(t, FLICK, 126, 1.2),
      lh: nervous,
      baton: beatBaton(t, FLICK, 126),
    };
  if (t < LAND_NOSE) {
    const crouch = easeOut(span(t, DUCK, DUCK + 0.25)) * (1 - ease(span(t, RISE, RISE + 0.4)));
    const size = t < RISE ? 0.45 : lerp(0.45, 1.8, ease(span(t, RISE, RISE + 0.5)));
    const h = beatHand(t, FLICK, 126, size);
    return {
      ...pose,
      crouch,
      rh: h,
      lh: t < RISE ? [11, -38] : [-h[0], h[1]],
      baton: beatBaton(t, FLICK, 126),
    };
  }
  if (t < LIFT) {
    const u = easeOut(span(t, LAND_NOSE, LAND_NOSE + 0.15));
    const from = beatHand(LAND_NOSE, FLICK, 126, 1.8);
    const shake = Math.sin(t * 41) * 0.3 * (1 + (t - LAND_NOSE) * 0.15);
    return {
      ...pose,
      rh: blend(from, [-19 + shake, -64], u),
      lh: blend([-from[0], from[1]], [19 - shake, -64], u),
      baton: 0.2,
    };
  }
  if (t < RETURN) {
    const u = ease(span(t, EXHALE, EXHALE + 0.6));
    return {
      ...pose,
      rh: blend([-19, -64], [-17, -50], u),
      lh: blend([19, -64], [17, -50], u),
      baton: lerp(0.2, 0.9, u),
    };
  }
  if (t < INTO_TUBA) {
    const jerk = ease(span(t, RETURN, RETURN + 0.2));
    const flail = ease(span(t, FLAIL - 0.25, FLAIL));
    const presto = t >= PRESTO;
    const w = presto ? 12 : 9,
      r = presto ? 17 : 13;
    const a = t * w;
    const rhF: Pt = [-14 + Math.cos(a) * r, -56 + Math.sin(a) * r * 0.8];
    const lhF: Pt = [14 + Math.cos(-a + 1.2) * r, -56 + Math.sin(-a + 1.2) * r * 0.8];
    return {
      ...pose,
      rh: blend(blend([-17, -50], [-18, -66], jerk), rhF, flail),
      lh: blend(blend([17, -50], [18, -66], jerk), lhF, flail),
      baton: lerp(0.6, a * 0.8, flail),
      spin: presto ? 1 : 0.3 * flail,
    };
  }
  if (t < LAUNCH) {
    const point = ease(span(t, POINT, POINT + 0.25));
    return {
      ...pose,
      rh: blend([-18, -62], [-36, -48], point),
      lh: blend([18, -62], [-24, -50], point),
      baton: lerp(0.3, -1.85, point),
    };
  }
  if (t < 80) {
    const u = ease(span(t, LAUNCH + 0.1, LAUNCH + 1));
    return {
      ...pose,
      rh: blend([-36, -48], [-15, -30], u),
      lh: blend([-24, -50], [15, -30], u),
      baton: lerp(-1.85, 2.3, u),
    };
  }
  if (t < FINAL_HIT) {
    const up = ease(span(t, 80.0, 80.5)),
      down = easeIn(span(t, 80.72, FINAL_HIT));
    return {
      ...pose,
      rh: blend(blend([-15, -30], [-18, -72], up), [-26, -44], down),
      lh: blend(blend([15, -30], [18, -72], up), [17, -40], down),
      baton: lerp(lerp(2.3, 0.1, up), -1.25, down),
    };
  }
  if (t < BOW) return { ...pose, rh: [-26, -44], lh: [17, -40], baton: -1.25 };
  if (t < ENCORE) {
    const bow = ease(span(t, BOW, BOW + 0.35)) * (1 - ease(span(t, 94.1, 94.5)));
    // To Horace first (his bell is on screen left), then to the whole band.
    const lean = -0.2 * ease(span(t, BOW, BOW + 0.18)) * (1 - ease(span(t, 93.4, 93.75)));
    return { ...pose, bow, lean, rh: [-26, -44], lh: [3, -38], baton: -1.25 };
  }
  if (t < ENCORE_PLAY) {
    const u = ease(span(t, ENCORE, ENCORE + 0.3));
    return {
      ...pose,
      rh: blend([-26, -44], [-16, -66], u),
      lh: [12, -34],
      baton: lerp(-1.25, 0.25, u),
    };
  }
  if (t < NEXT_SUNDAY) {
    const h = beatHand(t, ENCORE_PLAY, 200, 1.3);
    return { ...pose, rh: h, lh: [-h[0], h[1]], baton: beatBaton(t, ENCORE_PLAY, 200) };
  }
  return {
    ...pose,
    rh: beatHand(t, 96.5, 100, 0.8),
    lh: [12, -34],
    baton: beatBaton(t, 96.5, 100),
  };
}
/** Where a hand really is once he crouches or bows. */
const handAt = (m: MPose, h: Pt): Pt => [h[0], h[1] + m.crouch * DUCK_DEPTH + m.bow * 12];
function tipLocal(m: MPose): Pt {
  const h = handAt(m, m.rh);
  return [h[0] + Math.sin(m.baton) * BATON, h[1] - Math.cos(m.baton) * BATON];
}
/** The Maestro's feet in the fixed framings. */
const OTS_FEET = [160, 120] as const;
const LAWN_FEET = [160, 94] as const;
const LAWN_SCALE = 0.52;
const otsPoint = (l: Pt): Pt => [OTS_FEET[0] + l[0], OTS_FEET[1] + l[1]];
/** A point on his figure once the whole of him tips by `m.lean` about his feet. */
const leaned = (m: MPose, l: Pt): Pt => {
  const c = Math.cos(m.lean),
    s = Math.sin(m.lean);
  return [l[0] * c - l[1] * s, l[0] * s + l[1] * c];
};
/** From the lawn we see his back, so his right hand is on our right. */
const lawnPoint = (l: Pt): Pt => [
  LAWN_FEET[0] - l[0] * LAWN_SCALE,
  LAWN_FEET[1] + l[1] * LAWN_SCALE,
];
/** Close-up: his face, and the spots the wasp lands on. */
const CU_FACE = [160, 100] as const;
const CU_SCALE = 1.6;
const NOSE: Pt = [166, 117];
const BROW_SPOT: Pt = [160, 84];
/** In the over-the-shoulder shot, the tuba bell is the big gold mouth at bottom left. */
const TUBA_BELL: Pt = [30, 84];
/** In the launch shot, the bell's opening. */
const BELL_OPEN: Pt = [102, 70];
/** In the front-row shot, the jam sandwich at the boy's mouth, and held out at arm's length. */
const JAM_EAT: Pt = [111, 122];
const JAM_OUT: Pt = [55, 114];

// ——— The wasp's path ———
const TIP_OTS = otsPoint(tipLocal(mPose(FINAL_HIT)));
type Key = readonly [number, number, number];
const circle = (
  from: number,
  n: number,
  dt: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): Key[] =>
  Array.from(
    { length: n },
    (_, i) => [from + i * dt, cx + Math.cos(i * 1.05) * rx, cy + Math.sin(i * 1.05) * ry] as const,
  );
const flightArc = (): Key[] =>
  Array.from({ length: 17 }, (_, i) => {
    const u = i / 16;
    return [76 + u * 4, 300 - 272 * u, lerp(64, 74, u) - 176 * u * (1 - u)] as const;
  });
/**
 * Keyframes [s, x, y] in the coordinates of whichever fixed framing is on screen; two keys at
 * the same s are a cut. Sitting spells (the sandwich, his nose, the baton) hold still here and
 * the shot pins the wasp to whatever it sits on.
 */
export const WASP: readonly Key[] = [
  [0, -30, 60],
  // The front row: it finds the jam.
  [20.4, -30, 60],
  [20.4, -12, 40],
  [20.9, 30, 30],
  [21.3, 70, 84],
  [LANDS_ON_JAM, JAM_EAT[0], JAM_EAT[1] - 4],
  [OFF_JAM, JAM_EAT[0], JAM_EAT[1] - 4],
  // The lawn: off the sandwich, a loop over the deckchairs, and on to the podium.
  [OFF_JAM, 112, 107],
  [23.35, 104, 95],
  [23.7, 86, 102],
  [24.05, 74, 89],
  [24.45, 98, 79],
  [24.9, 132, 71],
  [25.5, 168, 63],
  // Close-up: across his face, left, right, left.
  [25.5, 336, 70],
  [26.35, 52, 46],
  [27.2, 290, 34],
  [28.05, 40, 132],
  [FLICK, 100, 56],
  // At his ear; the flick.
  [FLICK, 152, 66],
  [29.15, 184, 46],
  [29.7, 212, 62],
  [30.3, 188, 38],
  [31.0, 150, 46],
  [31.0, -20, 30],
  [31.5, -20, 30],
  [32.1, 340, 24],
  [34.0, 340, 24],
  // The swipe misses.
  [34.0, 196, 58],
  [34.45, 178, 42],
  [34.85, 142, 46],
  [35.15, 150, 62],
  [35.45, 122, 36],
  [35.8, 168, 30],
  [36.0, 186, 44],
  // The lawn: round and round the podium.
  ...circle(36.0, 13, 0.4, 160, 60, 17, 7),
  // He ducks; it hovers where his head was.
  [DUCK, 160, 58],
  [41.5, 146, 52],
  [42.2, 174, 56],
  [42.9, 156, 46],
  [RISE, 160, 50],
  [43.6, 134, 40],
  [44.0, 118, 34],
  [44.0, 134, 54],
  [44.85, 178, 48],
  [45.7, 158, 58],
  // Down onto his nose.
  [45.7, 146, 62],
  [LAND_NOSE, NOSE[0], NOSE[1]],
  [57.8, NOSE[0], NOSE[1]],
  [57.8, BROW_SPOT[0], BROW_SPOT[1]],
  [LIFT, BROW_SPOT[0], BROW_SPOT[1]],
  [58.6, 340, 8],
  [RETURN, 340, 74],
  [59.95, 190, 98],
  // He flails; it stays.
  [FLAIL, 168, 62],
  [60.4, 146, 54],
  [60.8, 178, 48],
  [61.2, 140, 68],
  [61.6, 182, 70],
  [PRESTO, 154, 44],
  [62.3, 188, 60],
  [62.6, 136, 72],
  [62.9, 178, 40],
  [63.2, 128, 50],
  [63.5, 192, 74],
  [63.8, 150, 34],
  [64.0, 172, 52],
  [64.0, 340, 20],
  [CHASE_CUT, 340, 20],
  [CHASE_CUT, 332, 40],
  [68.5, 56, 78],
  [69.0, 272, 136],
  [DIVE_CUT, 150, 26],
  // Into the tuba: a long, eased dive the eye can follow, ending in the bell.
  [DIVE_CUT, 168, 56],
  [INTO_TUBA, TUBA_BELL[0], TUBA_BELL[1]],
  [72.3, TUBA_BELL[0], TUBA_BELL[1]],
  // Out like a cork.
  [72.3, BELL_OPEN[0], BELL_OPEN[1]],
  [LAUNCH, BELL_OPEN[0], BELL_OPEN[1]],
  [72.85, BELL_OPEN[0] + 12, -24],
  [74.2, BELL_OPEN[0] + 12, -24],
  [74.2, 220, 56],
  [74.8, 204, 20],
  [75.4, 160, 9],
  [76.0, 112, 13],
  // Slow motion, high over the lawn.
  ...flightArc(),
  // Onto the baton tip, on the last beat.
  [80.0, 30, 14],
  [80.5, 84, 34],
  [FINAL_HIT, TIP_OTS[0], TIP_OTS[1]],
  [JAR, TIP_OTS[0], TIP_OTS[1]],
  // Next Sunday, one more comes in from the left, and on under the end card toward the jam
  // (slowing, and staying left of and below the card's title so it never hides behind it).
  [JAR, -30, 70],
  [LAST_RAISE, -6, 68],
  [102.6, 22, 62],
  [103.3, 48, 70],
  [104.0, 78, 64],
  [104.8, 90, 74],
  [105.6, 98, 70],
  [106.4, 106, 80],
  [107.2, 112, 78],
];
/** Where the wasp is at story second s, in the coordinates of the shot on screen then. */
function waspPos(s: number): [number, number] {
  const k = WASP;
  if (s <= k[0][0]) return [k[0][1], k[0][2]];
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i],
      b = k[i + 1];
    if (s < b[0]) {
      const f = (s - a[0]) / (b[0] - a[0]);
      const u = b[0] - a[0] <= 0.3 ? f : ease(f);
      const moving = Math.hypot(b[1] - a[1], b[2] - a[2]) > 1;
      const weave = moving ? Math.sin(s * 19) * 1.6 * Math.sin(Math.PI * f) : 0;
      return [lerp(a[1], b[1], u), lerp(a[2], b[2], u) + weave];
    }
  }
  const last = k[k.length - 1];
  return [last[1], last[2]];
}
const flying = (s: number) => {
  const a = waspPos(s - 0.03),
    b = waspPos(s);
  return Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.05;
};

// ——— The wasp ———
type WaspLook = { face?: number; tilt?: number; still?: boolean; clean?: number };
/** The wasp at `size` pixels long: a dot in wides, almost dainty in close-ups. */
function wasp(ctx: Ctx, x: number, y: number, size: number, seconds: number, o: WaspLook = {}) {
  const face = o.face ?? 1;
  if (size <= 4) {
    // In a wide it is a bright dot: yellow body, one black band, a pale blur of wing.
    box(ctx, x - 2, y - 1.2, 4, 2.6, WASP_Y);
    box(ctx, x - 0.5 - face * 0.4, y - 1.2, 1, 2.6, INK);
    box(ctx, x + face * 1.6 - 0.6, y - 0.8, 1.2, 1.6, INK);
    box(ctx, x - 1.5, y - 2.8, 3, 1.6, alpha(WHITE, 0.85));
    return;
  }
  const k = size / 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.tilt ?? 0);
  ctx.scale(k * face, k);
  const buzz = o.still ? 0 : Math.sin(seconds * 61);
  // Wings: pale and blurred while flying, folded along the back while sitting.
  if (o.still) {
    oval(ctx, -1.5, -1.6, 4.2, 1.3, alpha('#E8F2FA', 0.75), 0.18);
    oval(ctx, -1, -1.9, 3.6, 1.1, alpha(WHITE, 0.6), 0.32);
  } else {
    oval(ctx, -0.5, -3.4, 2.4, 4.2, alpha('#E8F2FA', 0.45), -0.5 + buzz * 0.25);
    oval(ctx, 1, -3.6, 2.2, 4, alpha(WHITE, 0.4), 0.3 - buzz * 0.25);
  }
  // Legs.
  const clean = o.clean ?? 0;
  for (const lx of [-1, 1, 3]) line(ctx, INK, 0.45, [lx, 1, lx - 0.6, 3.2, lx - 1.2, 3.6]);
  if (clean > 0) {
    const rub = Math.sin(seconds * 13) * 0.8;
    line(ctx, INK, 0.5, [3.4, 0.6, 5.6, -0.4 + rub, 6.2, 0.6 + rub]);
    line(ctx, INK, 0.5, [3.2, 0.9, 5.2, 0.2 - rub, 5.9, 1.2 - rub]);
  }
  // Abdomen: yellow with two stripes, round at the tail (no sting on show).
  oval(ctx, -3, 0.4, 3.9, 2.6, WASP_Y);
  oval(ctx, -2.1, 0.4, 0.75, 2.5, INK);
  oval(ctx, -4.1, 0.5, 0.7, 2.1, INK);
  oval(ctx, -6.1, 0.6, 0.9, 1.1, INK);
  // Thorax and head.
  oval(ctx, 1.4, -0.1, 1.9, 1.8, INK);
  disc(ctx, 1.2, -0.6, 0.7, WASP_Y);
  disc(ctx, 3.9, -0.2, 1.75, WASP_Y);
  oval(ctx, 4.5, -0.6, 1.1, 1.3, INK);
  disc(ctx, 4.2, -1, 0.35, WHITE);
  // Antennae.
  line(ctx, INK, 0.45, [4.2, -1.6, 5.4, -3.6, 6.6, -3.9]);
  line(ctx, INK, 0.45, [3.6, -1.7, 4.2, -3.9, 5.2, -4.6]);
  ctx.restore();
}
/** The wasp in flight, with a dotted trail sampled from its own path at earlier moments. */
function waspFlying(
  ctx: Ctx,
  t: number,
  from: number,
  seconds: number,
  size: number,
  o: { dots?: number; dot?: number; gap?: number; tumble?: number } = {},
) {
  const [x, y] = waspPos(t);
  const n = o.dots ?? 6,
    dot = o.dot ?? 1,
    gap = o.gap ?? 0.06;
  if (flying(t))
    for (let k = 1; k <= n; k++) {
      const s = t - k * gap;
      if (s < from) break;
      const [px, py] = waspPos(s);
      box(ctx, px - dot / 2, py - dot / 2, dot, dot, alpha(INK, 0.75 - (k / (n + 1)) * 0.5));
    }
  const ahead = waspPos(t + 0.05);
  const face = ahead[0] < x - 0.2 ? -1 : 1;
  wasp(ctx, x, y, size, seconds, { face, tilt: o.tumble });
}

// ——— Faces: the band and the lawn share one close-up head ———
type Who =
  | 'horace'
  | 'trombone'
  | 'clarinet'
  | 'trumpet'
  | 'snare'
  | 'cymbals'
  | 'boy'
  | 'mum'
  | 'grandad'
  | 'lady'
  | 'man';
type Player = 'horace' | 'trombone' | 'clarinet' | 'trumpet' | 'snare' | 'cymbals';
const PLAYERS: readonly Player[] = [
  'horace',
  'trombone',
  'clarinet',
  'trumpet',
  'snare',
  'cymbals',
];
type Cast = { skin: string; hair: string; brow: string; rx: number; ry: number };
const CAST: Record<Who, Cast> = {
  horace: { skin: '#F2C3A4', hair: '#F4F1EA', brow: '#E6E1D8', rx: 21, ry: 21 },
  trombone: { skin: '#E6BD96', hair: '#5A3B28', brow: '#4A3020', rx: 16, ry: 25 },
  clarinet: { skin: '#F4D6BC', hair: '#C9853E', brow: '#A8682C', rx: 18, ry: 21 },
  trumpet: { skin: '#B97B55', hair: '#2A1C18', brow: '#22160F', rx: 18, ry: 21 },
  snare: { skin: '#EBC3A3', hair: '#B5532F', brow: '#8C3E22', rx: 18, ry: 21 },
  cymbals: { skin: '#8E5E43', hair: '#8E5E43', brow: '#3A2418', rx: 23, ry: 22 },
  boy: { skin: '#F3CDB0', hair: '#7A4A2A', brow: '#6A3E22', rx: 19, ry: 18 },
  mum: { skin: '#E3AE88', hair: '#4A2E22', brow: '#3A2218', rx: 18, ry: 21 },
  grandad: { skin: '#EFC6AA', hair: '#D9D6D0', brow: '#B9B4AC', rx: 19, ry: 21 },
  lady: { skin: '#9A6B4E', hair: '#1E1A1C', brow: '#1E1A1C', rx: 18, ry: 21 },
  man: { skin: '#F2D3B5', hair: '#B5532F', brow: '#8C3E22', rx: 19, ry: 21 },
};
type Mood = {
  eyes?: 'open' | 'wide' | 'bulge' | 'squeeze' | 'closed' | 'happy' | 'half' | 'sleep';
  look?: Pt;
  /** -1 worried … 1 cross. */
  brows?: number;
  raise?: number;
  mouth?:
    'flat' | 'smile' | 'grin' | 'o' | 'open' | 'blow' | 'frown' | 'wobble' | 'sleep' | 'wheeze';
  /** Cheeks ballooning, 0..1. */
  puff?: number;
  /** 0 normal, 1 red, 2 purple. */
  flush?: number;
  tears?: number;
  ears?: number;
  turn?: number;
  tilt?: number;
  veil?: number;
  jam?: boolean;
  /** How far a startled flat cap jumps off the head. */
  hop?: number;
};
function faceTone(c: Cast, flush: number) {
  return flush <= 1
    ? mix(c.skin, '#E5767A', flush * 0.3)
    : mix(mix(c.skin, '#E5767A', 0.3), '#A0609E', (flush - 1) * 0.55);
}
/** A head-and-cap close-up, about 42 px wide at s = 1, centred on the face. */
function head(ctx: Ctx, who: Who, x: number, y: number, s: number, m: Mood = {}) {
  const c = CAST[who];
  const u = (m.turn ?? 0) * c.rx * 0.32;
  const flush = m.flush ?? 0;
  const skin = faceTone(c, flush);
  const cheek =
    flush <= 1 ? mix('#EE9088', '#E0404C', flush) : mix('#E0404C', '#8C3C9E', flush - 1);
  const band = (PLAYERS as readonly Who[]).includes(who);
  const straw = who === 'mum' || who === 'lady';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(m.tilt ?? 0);
  ctx.scale(s, s);
  // Hair that sits behind the head.
  if (who === 'trumpet') disc(ctx, -c.rx + 1 - u * 0.4, -5, 8, c.hair);
  if (straw) oval(ctx, u * 0.1, -4, c.rx + 4, c.ry * 0.82, c.hair);
  if (who === 'snare') {
    box(ctx, -c.rx - 3, -8, 8, 22, c.hair);
    box(ctx, c.rx - 5, -8, 8, 22, c.hair);
  }
  // Ears, red when scolded.
  const ear = mix(skin, '#E2474B', m.ears ?? 0);
  if (u < c.rx * 0.28) oval(ctx, -c.rx + u * 0.3, 3, 3.8, 5.8, ear);
  if (u > -c.rx * 0.28) oval(ctx, c.rx + u * 0.3, 3, 3.8, 5.8, ear);
  // Sideburns under the cap.
  if (band && who !== 'cymbals') {
    box(ctx, -c.rx + 1 + u * 0.2, -9, 4, 8, c.hair);
    box(ctx, c.rx - 5 + u * 0.2, -9, 4, 8, c.hair);
  }
  oval(ctx, u * 0.15, 0, c.rx, c.ry, skin);
  // Cheeks: they balloon right out of the face when he blows.
  const puff = m.puff ?? 0;
  const cy = c.ry * 0.38;
  if (puff > 0)
    for (const sd of [-1, 1])
      oval(ctx, sd * (c.rx * 0.5 + puff * 6) + u, cy, 6 + puff * 8, 6 + puff * 6, skin);
  for (const sd of [-1, 1])
    oval(
      ctx,
      sd * (c.rx * 0.56 + puff * 7) + u,
      cy + 1,
      4 + puff * 5,
      2.6 + puff * 3,
      alpha(cheek, 0.5 + 0.35 * Math.min(1, flush)),
    );
  // Eyes.
  const ey = -2,
    gap = c.rx * 0.42;
  const [lx, ly] = m.look ?? [0, 0];
  for (const sd of [-1, 1]) {
    const ex = sd * gap + u;
    switch (m.eyes ?? 'open') {
      case 'open':
        oval(ctx, ex, ey, 3.9, 4.5, WHITE);
        disc(ctx, ex + lx * 1.6, ey + ly * 1.7 + 0.4, 2.3, INK);
        disc(ctx, ex + lx * 1.6 - 0.8, ey + ly * 1.7 - 0.5, 0.7, WHITE);
        break;
      case 'wide':
        oval(ctx, ex, ey, 5, 6, WHITE);
        disc(ctx, ex + lx * 2.2, ey + ly * 2.4, 1.6, INK);
        break;
      case 'bulge':
        oval(ctx, ex, ey - 0.5, 5.8, 6.6, WHITE);
        disc(ctx, ex + lx * 2.4, ey + ly * 2.4, 1.3, INK);
        line(ctx, alpha('#D8404C', 0.6), 0.6, [ex + 2.5, ey + 3, ex + 4.4, ey + 1.5]);
        break;
      case 'squeeze':
        line(ctx, INK, 1.7, [ex - sd * 3.6, ey - 3, ex + sd * 2.6, ey, ex - sd * 3.6, ey + 3]);
        break;
      case 'closed':
        line(ctx, INK, 1.5, [ex - 3.6, ey + 1, ex, ey + 2.6, ex + 3.6, ey + 1]);
        break;
      case 'happy':
        line(ctx, INK, 1.7, [ex - 3.6, ey + 1.6, ex, ey - 1.6, ex + 3.6, ey + 1.6]);
        break;
      case 'half':
        oval(ctx, ex, ey + 0.6, 3.9, 3.6, WHITE);
        disc(ctx, ex + lx * 1.4, ey + 1.4, 2, INK);
        poly(ctx, skin, [ex - 4.5, ey - 5, ex + 4.5, ey - 5, ex + 4.5, ey, ex - 4.5, ey]);
        line(ctx, INK, 1.2, [ex - 4, ey, ex + 4, ey]);
        break;
      case 'sleep':
        line(ctx, INK, 1.5, [ex - 3.6, ey + 1.4, ex + 3.6, ey + 1.4]);
        break;
    }
    const tears = m.tears ?? 0;
    if (tears > 0) {
      line(ctx, alpha('#9FD3EE', 0.9), 1.2, [ex - 3.2, ey + 4.4, ex + 3.2, ey + 4.4]);
      const fall = (tears * 3) % 1;
      oval(ctx, ex + sd * 3.4, ey + 6 + fall * 12, 1.4, 2, alpha('#9FD3EE', 0.9 * (1 - fall)));
    }
  }
  // Brows.
  const b = m.brows ?? 0,
    lift = -9.5 - (m.raise ?? 0) * 3.5;
  for (const sd of [-1, 1]) {
    const ex = sd * gap + u;
    line(ctx, c.brow, who === 'horace' || who === 'grandad' ? 3 : 2.3, [
      ex + sd * 4.6,
      lift - b * 0.6,
      ex - sd * 3.6,
      lift + b * 2,
    ]);
  }
  // Nose.
  if (who === 'horace') oval(ctx, u * 1.1, 6.5, 4.6, 3.8, mix(skin, '#E06A5E', 0.45));
  else oval(ctx, u * 1.1, 6, who === 'boy' ? 2.4 : 3, 2.6, mix(skin, '#B9765C', 0.32));
  // Mouth.
  const my = c.ry * 0.58;
  switch (m.mouth ?? 'flat') {
    case 'flat':
      line(ctx, INK, 1.5, [u - 5, my, u + 5, my]);
      break;
    case 'smile':
      line(ctx, INK, 1.6, [u - 6, my - 1.2, u - 2.5, my + 2, u + 2.5, my + 2, u + 6, my - 1.2]);
      break;
    case 'grin':
      poly(ctx, INK, [u - 8, my - 2, u + 8, my - 2, u + 5, my + 5, u - 5, my + 5]);
      box(ctx, u - 7, my - 2, 14, 2.6, WHITE);
      oval(ctx, u, my + 3.6, 3, 1.2, '#D8605A');
      break;
    case 'o':
      oval(ctx, u, my + 1, 2.6, 3.2, INK);
      break;
    case 'open':
      oval(ctx, u, my + 1.5, 4.6, 4.2, INK);
      oval(ctx, u, my + 3.6, 2.6, 1.3, '#C8605A');
      break;
    case 'blow':
      oval(ctx, u, my, 3.4, 2.4, mix(skin, '#B0404A', 0.6));
      break;
    case 'frown':
      line(ctx, INK, 1.5, [u - 5, my + 2, u - 2, my, u + 2, my, u + 5, my + 2]);
      break;
    case 'wobble':
      line(ctx, INK, 1.4, [
        u - 6,
        my + 1,
        u - 3,
        my - 0.6,
        u,
        my + 1,
        u + 3,
        my - 0.6,
        u + 6,
        my + 1,
      ]);
      break;
    case 'sleep':
      oval(ctx, u, my + 1, 3.2, 3.8, INK);
      break;
    case 'wheeze':
      oval(ctx, u, my + 1, 5.4, 3.2, INK);
      box(ctx, u - 4.4, my - 1.6, 8.8, 1.6, WHITE);
      break;
  }
  if (m.jam) oval(ctx, u + 6, my + 1, 2.6, 1.6, alpha(JAM, 0.85));
  // Horace's walrus moustache.
  if (who === 'horace')
    poly(ctx, '#F7F5EF', [
      u - 15,
      my + 2,
      u - 10,
      my - 5,
      u - 2,
      my - 4,
      u,
      my - 5,
      u + 2,
      my - 4,
      u + 10,
      my - 5,
      u + 15,
      my + 2,
      u + 13,
      my + 6,
      u + 7,
      my + 1,
      u,
      my + 2,
      u - 7,
      my + 1,
      u - 13,
      my + 6,
    ]);
  if (who === 'clarinet') {
    for (const sd of [-1, 1]) ring(ctx, sd * gap + u, ey, 6, 5.6, INK, 1.3);
    line(ctx, INK, 1.2, [u - gap + 6, ey - 1, u + gap - 6, ey - 1]);
  }
  // Hats.
  const top = -c.ry;
  if (m.veil) {
    // A beekeeper's hat: wide white brim, and a mesh veil to the chin.
    oval(ctx, u * 0.3, top * 0.95, c.rx * 0.8, c.ry * 0.45, '#F6F4EE');
    oval(ctx, u * 0.3, top * 0.62, c.rx + 15, 5, '#F6F4EE');
    poly(ctx, alpha(WHITE, 0.42 * m.veil), [
      -c.rx - 10 + u * 0.3,
      top * 0.6,
      c.rx + 10 + u * 0.3,
      top * 0.6,
      c.rx + 4,
      c.ry + 6,
      -c.rx - 4,
      c.ry + 6,
    ]);
    for (let i = -2; i <= 2; i++)
      line(ctx, alpha(WHITE, 0.35), 0.6, [i * 8 + u * 0.3, top * 0.6, i * 7, c.ry + 6]);
    line(ctx, alpha(WHITE, 0.35), 0.6, [-c.rx - 7, 4, c.rx + 7, 4]);
  } else if (band) {
    // The peaked cap sits on the forehead, and jumps when the brows do.
    const hop = (m.raise ?? 0) * 3.5;
    const peak = top * 0.72 - hop;
    poly(ctx, JACKET, [
      -c.rx - 2 + u * 0.3,
      peak,
      -c.rx + u * 0.3,
      top * 1.1 - hop,
      -c.rx * 0.6 + u * 0.3,
      top * 1.45 - hop,
      c.rx * 0.6 + u * 0.3,
      top * 1.45 - hop,
      c.rx + u * 0.3,
      top * 1.1 - hop,
      c.rx + 2 + u * 0.3,
      peak,
    ]);
    box(ctx, -c.rx - 2 + u * 0.3, top * 0.9 - hop, c.rx * 2 + 4, 4, PIPING);
    disc(ctx, u * 0.6, top * 1.18 - hop, 3, PIPING);
    poly(ctx, '#1E1A22', [
      -c.rx - 3 + u * 0.5,
      peak,
      c.rx + 3 + u * 0.5,
      peak,
      c.rx - 2 + u,
      peak + 5.5,
      -c.rx + 2 + u,
      peak + 5.5,
    ]);
  } else if (who === 'grandad') {
    ctx.translate(0, -(m.hop ?? 0));
    poly(ctx, '#7D6B55', [
      -c.rx - 1,
      top * 0.38,
      -c.rx + 2,
      top * 0.95,
      c.rx * 0.4,
      top * 1.06,
      c.rx + 4,
      top * 0.62,
      c.rx + 8 + u,
      top * 0.36,
    ]);
    line(ctx, '#5E5040', 1.2, [-c.rx, top * 0.48, c.rx + 6 + u, top * 0.42]);
  } else if (straw) {
    oval(ctx, u * 0.3, top * 0.86, c.rx * 0.78, c.ry * 0.45, '#E8C77A');
    oval(ctx, u * 0.3, top * 0.58, c.rx + 14, 5, '#E8C77A');
    box(ctx, -c.rx * 0.78 + u * 0.3, top * 0.72, c.rx * 1.56, 3.2, who === 'mum' ? '#3E78B8' : JAM);
  } else {
    // A mop of hair.
    poly(ctx, c.hair, [
      -c.rx - 1,
      top * 0.15,
      -c.rx + 1,
      top * 0.8,
      -c.rx * 0.4,
      top * 1.12,
      c.rx * 0.5,
      top * 1.08,
      c.rx + 1,
      top * 0.7,
      c.rx + 1,
      top * 0.1,
      c.rx * 0.6 + u,
      top * 0.45,
      u,
      top * 0.55,
      -c.rx * 0.6 + u,
      top * 0.4,
    ]);
  }
  ctx.restore();
}

// ——— The Maestro, close up ———
type MFace = {
  eyes?: 'open' | 'wide' | 'glare' | 'cross' | 'closed' | 'happy';
  look?: Pt;
  /** Per side (his right, his left): -1 worried … 1 knitted. */
  brows?: Pt;
  raise?: Pt;
  mouth?: 'stern' | 'o' | 'puff' | 'grit' | 'smile' | 'open' | 'gape';
  hair?: number;
  tie?: number;
  turn?: number;
  tilt?: number;
  flush?: number;
};
/** Sprung hair: a shock of white in every direction, drawn behind the face. */
function shock(ctx: Ctx, cx: number, cy: number, r0: number, r1: number, n: number, k: number) {
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU + 0.2;
    const r = (i % 2 ? r0 : r1 * (0.9 + (i % 4) * 0.06)) * lerp(0.8, 1, k);
    pts.push(cx + Math.cos(a) * r * 1.08, cy + Math.sin(a) * r * 0.92);
  }
  poly(
    ctx,
    SILVER_D,
    pts.map((v, i) => (i % 2 ? v + 2 : v + 1)),
  );
  poly(ctx, SILVER, pts);
}
function mane(ctx: Ctx, hair: number, u: number) {
  const x = u * 0.3;
  if (hair >= 1.5) {
    // A spiky fringe over the forehead, above the brows.
    const pts: number[] = [-19 + x, -17];
    for (let i = 0; i <= 8; i++) pts.push(-19 + x + i * 4.75, i % 2 ? -26 : -34 - (i % 3) * 3);
    pts.push(19 + x, -17, x, -20);
    poly(ctx, SILVER, pts);
    return;
  }
  poly(ctx, SILVER, [
    -20 + x,
    -4,
    -22 + x,
    -20,
    -15 + x,
    -34,
    -2 + x,
    -42,
    14 + x,
    -42,
    27 + x,
    -35,
    32 + x,
    -24,
    25 + x,
    -12,
    20 + x,
    -4,
    15 + x,
    -16,
    7 + x,
    -21,
    -3 + x,
    -21,
    -11 + x,
    -17,
    -16 + x,
    -11,
  ]);
  line(ctx, SILVER_D, 1.1, [-12 + x, -22, -3 + x, -33, 14 + x, -36, 26 + x, -30]);
  line(ctx, SILVER_D, 1, [-6 + x, -20, 6 + x, -28, 22 + x, -26]);
  if (hair > 0) {
    const k = clamp(hair);
    line(ctx, SILVER, 1.4, [-8 + x, -38, -12 + x, -38 - k * 10]);
    line(ctx, SILVER, 1.4, [8 + x, -41, 11 + x, -41 - k * 12]);
    line(ctx, SILVER, 1.4, [26 + x, -32, 34 + x, -36 - k * 6]);
    line(ctx, SILVER, 1.2, [-19 + x, -24, -28 + x, -26 - k * 4]);
  }
}
/** The Maestro's head and shoulders, about 40 × 60 at s = 1. */
function maestroFace(ctx: Ctx, x: number, y: number, s: number, f: MFace) {
  // The shoulders take the whole turn; the face turns at most about three-quarters.
  const turn = f.turn ?? 0;
  const u = clamp(turn, -1.1, 1.1) * 7;
  const th = turn * 0.55,
    cw = Math.cos(th),
    sx = Math.sin(th) * 20;
  const skin = mix(PALE, '#D86A72', (f.flush ?? 0) * 0.45);
  const shade = mix(PALE_D, '#C25A66', (f.flush ?? 0) * 0.45);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Tails, white shirtfront, and the bow tie; turned, the shoulders narrow and the front swings round.
  poly(ctx, TAILS, [
    -52 * cw,
    90,
    -46 * cw,
    38,
    -18 * cw,
    26,
    18 * cw,
    26,
    46 * cw,
    38,
    52 * cw,
    90,
  ]);
  poly(ctx, WHITE, [-13 * cw + sx, 25, 13 * cw + sx, 25, 6 * cw + sx, 90, -6 * cw + sx, 90]);
  poly(ctx, TAILS_L, [-13 * cw + sx, 26, -2 * cw + sx, 66, -24 * cw + sx, 42]);
  poly(ctx, TAILS_L, [13 * cw + sx, 26, 2 * cw + sx, 66, 24 * cw + sx, 42]);
  box(ctx, -8 + sx * 0.3, 12, 16, 16, shade);
  ctx.save();
  ctx.translate(sx * 0.9, 29);
  ctx.rotate(f.tie ?? 0);
  poly(ctx, '#D9D9E0', [-11, -5, -11, 5, 0, 0]);
  poly(ctx, '#D9D9E0', [11, -5, 11, 5, 0, 0]);
  poly(ctx, WHITE, [-10, -4, -10, 4, 0, 0]);
  poly(ctx, WHITE, [10, -4, 10, 4, 0, 0]);
  box(ctx, -2.5, -3, 5, 6, '#E9E9EE');
  ctx.restore();
  ctx.translate(0, 20);
  ctx.rotate(f.tilt ?? 0);
  ctx.translate(0, -20);
  // The back of the mane, ears, face.
  const hair = f.hair ?? 0;
  if (hair < 1.5) oval(ctx, 6 + u * 0.3, -18, 26, 22, SILVER_D);
  else shock(ctx, u * 0.3, -10, 26, 44, 13, clamp(hair - 1.5) * 2);
  for (const sd of [-1, 1]) if (sd * turn < 0.7) oval(ctx, sd * 19.5 + u * 0.35, 1, 3.6, 6, skin);
  oval(ctx, u * 0.15, 0, 19, 24, skin);
  line(ctx, shade, 1, [-9 + u, 10, -11 + u, 18]);
  line(ctx, shade, 1, [9 + u, 10, 11 + u, 18]);
  // Deep-set eyes.
  const [lx, ly] = f.look ?? [0, 0];
  const kind = f.eyes ?? 'open';
  for (const sd of [-1, 1]) {
    const ex = sd * 7.5 + u,
      ey = -3;
    oval(ctx, ex, ey, 5.6, 3.8, alpha(shade, 0.7));
    if (kind === 'closed') line(ctx, INK, 1.3, [ex - 3.6, ey, ex, ey + 1.6, ex + 3.6, ey]);
    else if (kind === 'happy')
      line(ctx, INK, 1.4, [ex - 3.6, ey + 1, ex, ey - 1.6, ex + 3.6, ey + 1]);
    else {
      const wide = kind === 'wide';
      oval(ctx, ex, ey, wide ? 4.6 : 4.1, wide ? 4.6 : 3.2, WHITE);
      const px = kind === 'cross' ? ex - sd * 2.3 : ex + lx * 1.8;
      const py = kind === 'cross' ? ey + 0.8 : ey + ly * 1.4;
      disc(ctx, px, py, wide ? 1.4 : 1.9, INK);
      if (kind === 'glare') {
        poly(ctx, skin, [ex - 5, ey - 5, ex + 5, ey - 5, ex + 5, ey - 0.6, ex - 5, ey - 0.6]);
        line(ctx, INK, 1.2, [ex - 4.4, ey - 0.6, ex + 4.4, ey - 0.6]);
      }
    }
  }
  // The brows do the acting.
  const brows = f.brows ?? [0, 0],
    raise = f.raise ?? [0, 0];
  [-1, 1].forEach((sd, i) => {
    const b = brows[i],
      base = -10 - raise[i] * 4.5;
    const ix = sd * 2.6 + u,
      ox = sd * 13.5 + u;
    const iy = base + b * 2.8,
      oy = base - b * 0.8 - 1;
    poly(ctx, BROW, [ox, oy, ix, iy, ix, iy + 3.6, ox, oy + 2.6]);
    poly(ctx, BROW, [ox, oy, ox + sd * 3, oy - 1.4, ox - sd * 1, oy + 1.6]);
  });
  if ((brows[0] + brows[1]) / 2 > 0.5) line(ctx, shade, 1, [u - 1, -11, u - 0.6, -6]);
  // The hawk nose.
  poly(ctx, shade, [
    -1.8 + u,
    -6,
    1.6 + u,
    -6,
    4.8 + u * 1.25,
    7,
    4.4 + u * 1.3,
    12,
    0.6 + u * 1.3,
    14.6,
    -2.6 + u * 1.25,
    13,
    -1.4 + u,
    8,
  ]);
  line(ctx, alpha('#FFF4EA', 0.8), 0.9, [0.2 + u, -4, 2.6 + u * 1.2, 7]);
  oval(ctx, -0.6 + u * 1.3, 13.2, 1.3, 0.8, alpha(INK, 0.6));
  // Mouth.
  const my = 19.5;
  switch (f.mouth ?? 'stern') {
    case 'stern':
      line(ctx, INK, 1.6, [u - 7, my + 1.4, u - 3, my, u + 3, my, u + 7, my + 1.4]);
      break;
    case 'o':
      oval(ctx, u, my + 0.5, 2.4, 3, INK);
      break;
    case 'puff':
      for (const sd of [-1, 1]) oval(ctx, sd * 10 + u, 12, 7, 6, skin);
      oval(ctx, u, my, 2.2, 1.8, '#B04A52');
      break;
    case 'grit':
      box(ctx, u - 7, my - 2, 14, 5, INK);
      box(ctx, u - 6, my - 1, 12, 3, WHITE);
      break;
    case 'smile':
      line(ctx, INK, 1.6, [u - 7, my - 1.6, u - 3, my + 1.4, u + 3, my + 1.4, u + 7, my - 1.6]);
      line(ctx, shade, 1, [u - 9, my - 3, u - 8, my]);
      line(ctx, shade, 1, [u + 9, my - 3, u + 8, my]);
      break;
    case 'open':
      oval(ctx, u, my + 1, 5, 4, INK);
      break;
    case 'gape':
      oval(ctx, u, my + 2, 4, 6, INK);
      oval(ctx, u, my + 5.5, 2.4, 1.6, '#C8605A');
      break;
  }
  mane(ctx, hair, u);
  ctx.restore();
}

// ——— The Maestro, full figure: from the front (over the band's shoulders) and from behind ———
type Small = {
  eyes?: 'dot' | 'wide' | 'cross' | 'closed' | 'happy';
  /** -1 worried … 1 cross. */
  brows?: number;
  mouth?: 'line' | 'o' | 'smile' | 'grit';
  look?: number;
};
function arm(ctx: Ctx, side: -1 | 1, sx: number, sy: number, h: Pt, width: number): Pt {
  const len = 13;
  let dx = h[0] - sx,
    dy = h[1] - sy;
  const d0 = Math.hypot(dx, dy) || 1;
  const d = Math.min(d0, len * 2 - 0.01);
  dx = (dx / d0) * d;
  dy = (dy / d0) * d;
  const a = Math.atan2(dy, dx),
    b = Math.acos(d / (len * 2));
  const e1: Pt = [sx + Math.cos(a + b) * len, sy + Math.sin(a + b) * len];
  const e2: Pt = [sx + Math.cos(a - b) * len, sy + Math.sin(a - b) * len];
  const e = (e1[0] - e2[0]) * side > 0 ? e1 : e2;
  line(ctx, TAILS, width, [sx, sy, e[0], e[1], sx + dx, sy + dy]);
  box(ctx, sx + dx - 1.6, sy + dy - 1.6, 3.2, 1.2, WHITE);
  return [sx + dx, sy + dy];
}
function maestro(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  m: MPose,
  view: 'front' | 'back',
  t: number,
  f: Small = {},
  veiled = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  if (m.lean) ctx.rotate(m.lean);
  ctx.scale(view === 'back' ? -s : s, s);
  const drop = m.crouch * DUCK_DEPTH,
    bowY = m.bow * 12;
  const hip = -22 + m.crouch * 16;
  // Legs, bending as he ducks.
  for (const sd of [-1, 1]) {
    const knee = sd * (3.5 + m.crouch * 9);
    line(ctx, TAILS, 4.6, [sd * 3.5, hip, knee, -11 + drop * 0.1, sd * 3.5, -2]);
    box(ctx, sd * 3.5 - 3 + sd * 1.5, -2.5, 6, 2.5, '#111014');
  }
  // Coat tails: they fly out while he spins.
  for (const sd of [-1, 1]) {
    const flare = m.spin * (0.7 + 0.5 * Math.sin(t * 13 + sd * 1.3));
    ctx.save();
    ctx.translate(sd * 5, hip);
    ctx.rotate(sd * (0.1 + flare));
    poly(ctx, view === 'back' ? TAILS : TAILS_L, [
      -3.2,
      0,
      3.2,
      0,
      4.2,
      18 - flare * 4,
      -1,
      19 - flare * 4,
    ]);
    ctx.restore();
  }
  const sh = -44 + drop + bowY;
  // Torso.
  poly(ctx, TAILS, [-11, sh, 11, sh, 9, hip, -9, hip]);
  if (view === 'front') {
    poly(ctx, WHITE, [-4.5, sh, 4.5, sh, 1.5, sh + 15, -1.5, sh + 15]);
    poly(ctx, TAILS_L, [-4.5, sh, -1, sh + 14, -7, sh + 6]);
    poly(ctx, TAILS_L, [4.5, sh, 1, sh + 14, 7, sh + 6]);
    ctx.save();
    ctx.translate(0, sh + 1.5);
    ctx.rotate(m.tie);
    poly(ctx, WHITE, [-4, -1.8, -4, 1.8, 0, 0]);
    poly(ctx, WHITE, [4, -1.8, 4, 1.8, 0, 0]);
    ctx.restore();
  } else line(ctx, TAILS_L, 1, [0, sh + 3, 0, hip]);
  // Arms, and the baton from the right hand.
  const hr = arm(ctx, -1, -10, sh + 2, handAt(m, m.rh), 4);
  const hl = arm(ctx, 1, 10, sh + 2, handAt(m, m.lh), 4);
  disc(ctx, hl[0], hl[1], 2.6, WHITE);
  const tx = hr[0] + Math.sin(m.baton) * BATON,
    ty = hr[1] - Math.cos(m.baton) * BATON;
  line(ctx, alpha('#C9CBD3', 0.9), 1.9, [hr[0], hr[1], tx, ty]);
  line(ctx, WHITE, 1.2, [hr[0], hr[1], tx, ty]);
  box(ctx, hr[0] - 1.2, hr[1] - 1.2, 2.4, 2.4, '#D8B98A');
  disc(ctx, hr[0], hr[1], 2.6, WHITE);
  // Head.
  const hy = sh - 9 + m.bow * 4;
  if (view === 'back') {
    box(ctx, -2.5, sh - 4, 5, 4, PALE_D);
    for (const sd of [-1, 1]) oval(ctx, sd * 6.4, hy + 1, 1.6, 2.6, PALE);
    if (veiled) {
      oval(ctx, 0, hy - 3, 6.5, 6, SILVER);
      oval(ctx, 0, hy - 6.5, 12, 2.6, '#F6F4EE');
      oval(ctx, 0, hy - 9, 6, 4, '#F6F4EE');
      poly(ctx, alpha(WHITE, 0.45), [-11, hy - 6, 11, hy - 6, 8, hy + 7, -8, hy + 7]);
    } else if (m.hair >= 1.5) {
      const pts: number[] = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        const r = i % 2 ? 6 : 10;
        pts.push(Math.cos(a) * r, hy - 3 + Math.sin(a) * r * 0.9);
      }
      poly(ctx, SILVER, pts);
    } else {
      oval(ctx, 0, hy - 2, 7.6, 7.4, SILVER);
      oval(ctx, -1, hy - 7, 6, 3.6, SILVER);
      line(ctx, SILVER_D, 0.8, [-4, hy - 7, 2, hy - 3, 3, hy + 3]);
      if (m.hair > 0.3) line(ctx, SILVER, 1, [3, hy - 8, 6, hy - 13 * m.hair]);
    }
  } else if (m.bow > 0.55) {
    oval(ctx, 0, hy + 2, 7.4, 6, SILVER);
    line(ctx, SILVER_D, 0.8, [-4, hy - 1, 0, hy + 3, 4, hy + 6]);
  } else {
    if (m.hair >= 1.5) shock(ctx, 0, hy - 2, 7.5, 12.5, 8, clamp(m.hair - 1.5) * 2);
    box(ctx, -2.5, sh - 4, 5, 4, PALE_D);
    for (const sd of [-1, 1]) oval(ctx, sd * 6.2, hy + 0.5, 1.4, 2.4, PALE);
    oval(ctx, 0, hy, 6, 7.4, PALE);
    // Mane: a white swoosh, coming loose, then wild.
    if (m.hair >= 1.5)
      poly(ctx, SILVER, [
        -6,
        hy - 4.6,
        -7.5,
        hy - 10,
        -4,
        hy - 7.5,
        -1,
        hy - 12,
        2,
        hy - 7.5,
        5,
        hy - 11,
        7,
        hy - 4.6,
        0,
        hy - 6,
      ]);
    else {
      poly(ctx, SILVER, [
        -6.4,
        hy - 1,
        -7,
        hy - 6,
        -4,
        hy - 11,
        2,
        hy - 13,
        8,
        hy - 11.5,
        10.5,
        hy - 7,
        8,
        hy - 3,
        6.4,
        hy - 1,
        5,
        hy - 5,
        1,
        hy - 6.5,
        -3,
        hy - 6,
        -5,
        hy - 4,
      ]);
      line(ctx, SILVER_D, 0.7, [-3, hy - 8, 3, hy - 10.5, 8, hy - 8]);
      if (m.hair > 0.3) {
        line(ctx, SILVER, 1, [-5, hy - 10, -8, hy - 10 - m.hair * 4]);
        line(ctx, SILVER, 1, [6, hy - 12, 9, hy - 12 - m.hair * 5]);
      }
    }
    if (veiled) {
      oval(ctx, 0, hy - 7, 12, 2.6, '#F6F4EE');
      oval(ctx, 0, hy - 9.5, 6, 4, '#F6F4EE');
    }
    // Face.
    const ey = hy - 1;
    const b = f.brows ?? 0;
    for (const sd of [-1, 1]) {
      const ex = sd * 2.5;
      poly(ctx, BROW, [
        ex + sd * 2.6,
        ey - 2.6 - b * 0.3,
        ex - sd * 1.6,
        ey - 2.4 + b * 1.1,
        ex - sd * 1.6,
        ey - 1.2 + b * 1.1,
        ex + sd * 2.6,
        ey - 1.4 - b * 0.3,
      ]);
      const kind = f.eyes ?? 'dot';
      if (kind === 'wide') {
        box(ctx, ex - 1.2, ey - 1, 2.6, 2.6, WHITE);
        box(ctx, ex - 0.2 + (f.look ?? 0) * 0.6, ey - 0.2, 1, 1, INK);
      } else if (kind === 'cross') {
        box(ctx, ex - 1.2, ey - 1, 2.6, 2.4, WHITE);
        box(ctx, ex - sd * 0.8, ey, 1, 1, INK);
      } else if (kind === 'closed') box(ctx, ex - 1.2, ey + 0.6, 2.6, 0.8, INK);
      else if (kind === 'happy') {
        box(ctx, ex - 1.3, ey + 0.6, 1, 0.8, INK);
        box(ctx, ex - 0.3, ey - 0.2, 1, 0.8, INK);
        box(ctx, ex + 0.7, ey + 0.6, 1, 0.8, INK);
      } else box(ctx, ex - 0.4 + (f.look ?? 0) * 0.5, ey - 0.6, 1, 1.8, INK);
    }
    poly(ctx, PALE_D, [-0.6, ey, 0.8, ey, 2, ey + 3.6, 0.2, ey + 4.4, -0.8, ey + 3.4]);
    const mouth = f.mouth ?? 'line';
    if (mouth === 'o') oval(ctx, 0, hy + 5, 1.1, 1.4, INK);
    else if (mouth === 'smile') line(ctx, INK, 0.8, [-2.2, hy + 4.2, 0, hy + 5.4, 2.2, hy + 4.2]);
    else if (mouth === 'grit') box(ctx, -2.2, hy + 4, 4.4, 1.6, WHITE);
    else box(ctx, -2, hy + 4.6, 4, 0.9, INK);
    if (veiled) poly(ctx, alpha(WHITE, 0.45), [-11, hy - 6, 11, hy - 6, 8, hy + 8, -8, hy + 8]);
  }
  ctx.restore();
}

// ——— The band ———
type Play = {
  mood: Mood;
  /** Instrument at the mouth (1) or lowered (0). */
  up?: number;
  /** Beat count, for sticks, slides and cymbals. */
  beat?: number;
  /** Cymbals flung apart, 0..1. */
  crash?: number;
  bob?: number;
  veil?: number;
};
/** One bandsman on his chair, facing screen left toward the podium; (x, y) is the seat. */
function bandsman(ctx: Ctx, who: Player, x: number, y: number, s: number, st: Play) {
  const c = CAST[who];
  const up = st.up ?? 1;
  const beat = st.beat ?? 0;
  const hit = Math.pow(Math.abs(Math.sin(beat * Math.PI)), 0.6);
  ctx.save();
  ctx.translate(x, y + (st.bob ?? 0));
  ctx.scale(s, s);
  // Chair and legs.
  box(ctx, 5, -27, 3, 27, WOOD_D);
  box(ctx, -9, -1, 18, 3, WOOD);
  box(ctx, -8, 2, 2, 20, WOOD_D);
  box(ctx, 6, 2, 2, 20, WOOD_D);
  box(ctx, -16, -3, 16, 6, TROUSERS);
  box(ctx, -16, 2, 5, 18, TROUSERS);
  box(ctx, -19, 19, 9, 3, '#15141A');
  // The tuba's bell rises behind his shoulder; the bass drum stands beside the stoic one.
  if (who === 'horace') {
    poly(ctx, BRASS, [-6, -14, -13, -14, -28, -50, -18, -50]);
    poly(ctx, BRASS, [-14, -50, -32, -50, -38, -62, -8, -62]);
    oval(ctx, -23, -62, 15.5, 4.6, BRASS_L);
    oval(ctx, -23, -62, 12.5, 3.2, BRASS_D);
    line(ctx, BRASS_L, 1.2, [-11, -16, -21, -48]);
  }
  if (who === 'cymbals') {
    disc(ctx, -16, -10, 14, '#F4F1EA');
    ring(ctx, -16, -10, 14, 14, JACKET, 3);
    ring(ctx, -16, -10, 15.5, 15.5, PIPING, 1);
  }
  // Jacket.
  poly(ctx, JACKET, [-10, -27, 9, -27, 8, 0, -9, 0]);
  box(ctx, 4, -27, 5, 27, JACKET_D);
  line(ctx, PIPING, 1, [-3, -26, -3, -1]);
  for (const by of [-21, -14, -7]) box(ctx, -5.6, by, 2, 2, PIPING);
  box(ctx, -12, -28.5, 7, 3, PIPING);
  box(ctx, 5, -28.5, 7, 3, PIPING);
  for (let i = 0; i < 4; i++) box(ctx, -12 + i * 2, -25.5, 1, 2, PIPING);
  box(ctx, -5, -30.5, 10, 3, JACKET_D);
  box(ctx, -3, -34, 6, 5, mix(c.skin, INK, 0.15));
  // Instrument and hands.
  const hand = (hx: number, hy: number) => disc(ctx, hx, hy, 2.4, c.skin);
  const sleeve = (hx: number, hy: number, from: Pt = [-7, -24]) =>
    line(ctx, JACKET, 4.4, [
      from[0],
      from[1],
      (from[0] + hx) / 2 - 2,
      (from[1] + hy) / 2 + 4,
      hx,
      hy,
    ]);
  const down = 1 - up;
  if (who === 'horace') {
    oval(ctx, 1, -12, 12, 13, BRASS);
    oval(ctx, 1, -12, 7.5, 8, BRASS_D);
    oval(ctx, 1, -12, 5, 5.6, BRASS);
    for (let i = 0; i < 3; i++) box(ctx, -6 + i * 3.4, -27, 2.2, 5, BRASS_L);
    line(ctx, BRASS, 2.2, [-4, -20, -7 - down * 2, -30 + down * 6, -4, -37 + down * 9]);
    sleeve(-5, -22);
    hand(-5, -22);
    hand(4, -24);
  }
  head(ctx, who, -1, -42, 0.42, { turn: -0.45, ...st.mood, veil: st.veil });
  ctx.save();
  ctx.translate(-down * 2, down * 22);
  ctx.rotate(down * 0.35);
  if (who === 'trumpet') {
    line(ctx, BRASS, 2.6, [-3, -36.5, -22, -36.5]);
    for (let i = 0; i < 3; i++) box(ctx, -15 + i * 2.6, -40.5, 1.8, 4, BRASS_L);
    poly(ctx, BRASS, [-21, -38, -31, -43, -31, -30, -21, -35]);
    oval(ctx, -31, -36.5, 1.6, 6.5, BRASS_L);
    sleeve(-12, -34);
    hand(-12, -34);
    hand(-8, -35);
  } else if (who === 'clarinet') {
    line(ctx, '#1C1A20', 3, [-3, -36, -12, -9]);
    for (let i = 1; i < 5; i++) disc(ctx, -3 - i * 1.8, -36 + i * 5.4, 0.8, '#C8CCD4');
    poly(ctx, '#1C1A20', [-10.5, -11, -15, -6, -9, -5]);
    sleeve(-6, -27);
    hand(-6, -27);
    hand(-9.5, -18);
  } else if (who === 'trombone') {
    const slide = 6 + Math.sin(beat * Math.PI) * 6;
    poly(ctx, BRASS, [-5, -43, -20, -49, -20, -37]);
    oval(ctx, -20, -43, 1.6, 6.2, BRASS_L);
    line(ctx, BRASS, 1.3, [-3, -38, -30 - slide, -38]);
    line(ctx, BRASS, 1.3, [-3, -34.5, -30 - slide, -34.5]);
    line(ctx, BRASS, 1.6, [-30 - slide, -38, -32 - slide, -36, -30 - slide, -34.5]);
    sleeve(-22 - slide, -36);
    hand(-22 - slide, -36);
    hand(-6, -39);
  }
  ctx.restore();
  if (who === 'snare') {
    box(ctx, -18, -10, 20, 8, '#F4F1EA');
    for (let i = 0; i < 4; i++) line(ctx, JACKET, 0.9, [-18 + i * 5, -10, -13 + i * 5, -2]);
    oval(ctx, -8, -10, 10, 3, '#FBFAF6');
    ring(ctx, -8, -10, 10, 3, PIPING, 0.8);
    const l = hit * 9,
      r = (1 - hit) * 9;
    sleeve(-10, -16 - l * 0.4);
    sleeve(-2, -17 - r * 0.4, [6, -24]);
    line(ctx, '#E9D8B0', 1.2, [-10, -16 - l * 0.4, -4, -12 - l]);
    line(ctx, '#E9D8B0', 1.2, [-2, -17 - r * 0.4, -12, -13 - r]);
    hand(-10, -16 - l * 0.4);
    hand(-2, -17 - r * 0.4);
  }
  if (who === 'cymbals') {
    const k = st.crash ?? 0;
    const lx = lerp(-7, -26, k),
      rx = lerp(-4, 14, k),
      cy = lerp(-22, -34, k);
    sleeve(lx, cy);
    sleeve(rx, cy, [6, -24]);
    for (const cx of [lx, rx]) {
      oval(ctx, cx, cy, lerp(2.2, 9, k), 9, BRASS);
      oval(ctx, cx, cy, lerp(1, 3, k), 2.5, BRASS_D);
      hand(cx, cy);
    }
  }
  ctx.restore();
}

/** A bandsman seen from behind (the over-the-shoulder shot); (x, y) is the seat. */
function bandBack(ctx: Ctx, who: Player, x: number, y: number, s: number, st: Play) {
  const c = CAST[who];
  const shrink = st.mood.eyes === 'squeeze' ? 1 : 0;
  const turn = st.mood.turn ?? 0;
  ctx.save();
  ctx.translate(x, y + (st.bob ?? 0));
  ctx.scale(s, s);
  // Instruments that show past the body.
  if (who === 'trombone') {
    const slide = 4 + Math.sin((st.beat ?? 0) * Math.PI) * 5;
    line(ctx, BRASS, 1.4, [-6, -42, -40 - slide, -54]);
    line(ctx, BRASS, 1.4, [-6, -39, -40 - slide, -51]);
    line(ctx, BRASS, 1.8, [-40 - slide, -54, -42 - slide, -52.5, -40 - slide, -51]);
    poly(ctx, BRASS, [-8, -46, -24, -54, -20, -42]);
  }
  if (who === 'snare') {
    box(ctx, -22, -14, 16, 7, '#F4F1EA');
    oval(ctx, -14, -14, 8, 2.4, '#FBFAF6');
    const hit = Math.abs(Math.sin((st.beat ?? 0) * Math.PI));
    line(ctx, '#E9D8B0', 1.2, [-10, -22, -16, -34 + hit * 10]);
    line(ctx, '#E9D8B0', 1.2, [8, -22, 12, -34 + (1 - hit) * 10]);
  }
  if (who === 'cymbals') {
    disc(ctx, 22, -12, 13, '#F4F1EA');
    ring(ctx, 22, -12, 13, 13, JACKET, 2.6);
    const k = st.crash ?? 0;
    for (const sd of [-1, 1]) {
      const cx = sd * lerp(10, 24, k),
        cy = lerp(-26, -36, k);
      line(ctx, JACKET, 4, [sd * 10, -24, cx, cy]);
      oval(ctx, cx, cy, lerp(2, 9, k), 9, BRASS);
      oval(ctx, cx, cy, lerp(0.8, 2.6, k), 2.4, BRASS_D);
    }
  }
  if (who === 'trumpet') poly(ctx, BRASS, [-8, -44, -20, -50, -20, -38]);
  // Jacket from behind: epaulettes, a gold seam, a gold collar.
  const lift = shrink * 3;
  poly(ctx, JACKET, [-13, -27 - lift, 13, -27 - lift, 11, 0, -11, 0]);
  poly(ctx, JACKET_D, [8, -27 - lift, 13, -27 - lift, 11, 0, 7, 0]);
  line(ctx, PIPING, 1, [0, -25, 0, -1]);
  box(ctx, -15, -29 - lift, 8, 3, PIPING);
  box(ctx, 7, -29 - lift, 8, 3, PIPING);
  for (let i = 0; i < 4; i++) {
    box(ctx, -15 + i * 2, -26 - lift, 1, 2, PIPING);
    box(ctx, 8 + i * 2, -26 - lift, 1, 2, PIPING);
  }
  box(ctx, -5.5, -31, 11, 3, PIPING);
  // Head from behind: neck, hair, ears (red when scolded), cap.
  const hy = -40 + shrink * 4;
  box(ctx, -4, -34, 8, 5, mix(c.skin, INK, 0.12));
  const ear = mix(c.skin, '#E2474B', st.mood.ears ?? 0);
  if (turn !== 0) oval(ctx, turn * 6.5, hy + 2, 4, 6.5, c.skin);
  oval(ctx, -8.8 + turn * 2, hy + 1, 2.2, 3.4, ear);
  oval(ctx, 8.8 + turn * 2, hy + 1, 2.2, 3.4, ear);
  oval(ctx, turn * 1.5, hy, 8.6, 8.8, who === 'cymbals' ? c.skin : c.hair);
  if (who === 'trumpet') disc(ctx, turn * 1.5, hy + 5, 4.2, c.hair);
  if (who === 'horace') oval(ctx, turn * 1.5, hy + 4, 8.6, 4, '#F4F1EA');
  if (st.veil) {
    oval(ctx, 0, hy - 6, 16, 3.4, '#F6F4EE');
    oval(ctx, 0, hy - 9, 8, 5, '#F6F4EE');
    poly(ctx, alpha(WHITE, 0.45), [-15, hy - 5, 15, hy - 5, 11, hy + 10, -11, hy + 10]);
  } else {
    poly(ctx, JACKET, [
      -9.6,
      hy - 3,
      -9,
      hy - 10,
      -5,
      hy - 14,
      5,
      hy - 14,
      9,
      hy - 10,
      9.6,
      hy - 3,
    ]);
    box(ctx, -9.8, hy - 5, 19.6, 3, PIPING);
  }
  ctx.restore();
}

// ——— The band's state, for every shot ———
/** How each player looks and plays at story second t. The cymbals never react, until the bow. */
function bandMood(who: Player, t: number): Play {
  const play = bandPlay(who, t);
  if (who !== 'cymbals' || t >= GRIN) return play;
  return { ...play, mood: { eyes: 'half', look: play.mood.look, mouth: 'flat' } };
}
function bandPlay(who: Player, t: number): Play {
  const tip = tipLocal(mPose(t));
  const look: Pt = [clamp(-tip[0] / 22, -1, 1), clamp((tip[1] + 50) / 22, -1, 1)];
  const brass = who === 'horace' || who === 'trumpet' || who === 'trombone';
  const beatAt = (origin: number, bpm: number) => ((t - origin) * bpm) / 60;
  if (t < 6) return { mood: { eyes: 'open', mouth: 'flat' }, up: 0.6 };
  if (t < EARS_CUT) {
    const warm = hump(t, 6.3, 7.0);
    const late = who === 'horace' ? hump(t, LATE_OOM - 0.05, LATE_OOM + 0.5) : 0;
    const puff = brass ? Math.max(who === 'horace' ? 0 : warm, late) * 0.6 : 0;
    return {
      mood: { eyes: 'open', look, mouth: puff > 0.1 ? 'blow' : 'flat', puff },
      up: 1,
    };
  }
  // The scolding lands: the band shrinks, and Horace's ears go red on screen.
  if (t < RAISE_CUT)
    return {
      mood: {
        eyes: 'squeeze',
        look: [0, 1],
        mouth: 'wobble',
        brows: -1,
        ears: who === 'horace' ? span(t, 11.5, 12.0) : 0,
      },
      up: 0.8,
    };
  if (t < DOWNBEAT)
    return {
      mood: {
        eyes: 'wide',
        look,
        mouth: 'flat',
        brows: -0.6,
        ears: who === 'horace' ? 1 - span(t, RAISE_CUT, 14) : 0,
      },
      up: 1,
    };
  if (t < FLICK)
    return {
      mood: {
        eyes: 'open',
        look,
        mouth: brass ? 'blow' : 'flat',
        puff: brass ? 0.35 : 0,
        brows: 0.3,
      },
      up: 1,
      beat: beatAt(DOWNBEAT, 100),
    };
  if (t < LAND_NOSE) {
    // He takes the swat for a cue: arms flung wide on the crash, held through his insert.
    const crash =
      who === 'cymbals'
        ? ease(span(t, SWIPE - 0.05, SWIPE + 0.1)) * (1 - ease(span(t, 35.75, WAKE_CUT)))
        : 0;
    return {
      mood: {
        eyes: 'wide',
        look,
        brows: -0.8,
        raise: 0.6,
        puff: !brass ? 0 : t >= DUCK && t < RISE ? 0.15 : t >= RISE ? 0.55 : 0.4,
        mouth: brass ? 'blow' : 'o',
      },
      up: 1,
      beat: beatAt(FLICK, 126),
      crash,
    };
  }
  if (t < 56.6) {
    const drop =
      who === 'clarinet'
        ? DROPS[0]
        : who === 'trumpet'
          ? DROPS[1]
          : who === 'trombone'
            ? DROPS[2]
            : who === 'horace'
              ? SQUEAK
              : LAND_NOSE;
    const strain = span(t, LAND_NOSE, drop);
    // Horace's note sags at each SAG: his cheeks go down a notch, his eyes droop.
    const sags = who === 'horace' ? SAGS.filter((k) => t >= k).length : 0;
    if (t < drop)
      return {
        mood: {
          eyes: sags >= 2 ? 'half' : strain > 0.6 || sags ? 'bulge' : 'wide',
          look: [0, sags >= 2 ? 0.6 : -0.6],
          mouth: 'blow',
          puff:
            who === 'clarinet'
              ? 0.15
              : who === 'trombone'
                ? 0.3 + strain * 0.2
                : 0.5 + strain * 0.5 - sags * 0.2,
          flush: who === 'horace' ? clamp((t - 53.5) / 2.4) * 2 : strain * 1.7,
          brows: -1,
          raise: 0.8,
          tears: who === 'clarinet' ? strain : 0,
        },
        up: 1,
      };
    return {
      mood: {
        eyes: 'closed',
        mouth: 'wheeze',
        flush: Math.max(0, 1.4 - (t - drop) * 0.6),
        brows: -1,
      },
      up: 0.4,
      bob: Math.sin(t * 8) * 0.8,
    };
  }
  if (t < PRESTO)
    return { mood: { eyes: 'wide', look, mouth: 'o', brows: -0.8, raise: 1 }, up: 0.7 };
  if (t < INTO_TUBA)
    return {
      mood: {
        eyes: 'wide',
        look,
        mouth: brass ? 'blow' : 'o',
        puff: brass ? 0.7 : 0,
        brows: -0.5,
        raise: 0.8,
      },
      up: 1,
      beat: beatAt(PRESTO, 200),
      crash: who === 'cymbals' ? Math.abs(Math.sin(beatAt(PRESTO, 200) * Math.PI * 0.5)) : 0,
      bob: Math.sin(t * 20) * 1.2,
    };
  if (t < 80) {
    if (who === 'horace' && t >= INHALE)
      return {
        mood: {
          eyes: t < LAUNCH ? 'wide' : 'squeeze',
          mouth: 'blow',
          puff: t < LAUNCH ? span(t, INHALE, LAUNCH) : 1 - span(t, 74, 76) * 0.8,
          flush: t < LAUNCH ? 0.5 : 2 - span(t, 74, 77) * 1.5,
          brows: -1,
          raise: 1,
        },
        up: 1,
      };
    return {
      mood: {
        eyes: 'wide',
        look: [-0.5, -1],
        mouth: 'o',
        raise: 1,
        ears: who === 'horace' && t >= POINT ? 0.6 : 0,
      },
      up: 0.6,
    };
  }
  if (t < FINAL_HIT)
    return {
      mood: { eyes: 'wide', look, mouth: brass ? 'blow' : 'o', puff: brass ? 0.5 : 0, brows: -0.6 },
      up: 1,
    };
  if (t < ROW_CUT)
    return {
      mood: {
        eyes: 'wide',
        look: [0, -0.4],
        mouth: brass ? 'blow' : 'o',
        puff: brass ? 0.3 : 0,
        flush: 0.6,
        raise: 0.6,
      },
      up: 1,
      crash: who === 'cymbals' ? 1 : 0,
    };
  if (t < NEXT_SUNDAY) {
    const grin = who !== 'cymbals' || t >= GRIN;
    const wheezing = who === 'horace' && t < BOW;
    return {
      mood: {
        eyes: wheezing ? 'half' : grin ? 'happy' : 'open',
        mouth: wheezing ? 'wheeze' : grin ? 'grin' : 'flat',
        flush: 0.8,
      },
      up: t >= ENCORE_PLAY ? 1 : 0,
      beat: beatAt(ENCORE_PLAY, 200),
      // Still held out from the final crash, until one tiny happy tap as he grins.
      crash: who === 'cymbals' ? 1 - hump(t, GRIN - 0.1, GRIN + 0.12) : 0,
    };
  }
  return {
    mood: { eyes: 'happy', mouth: 'grin', flush: 0.3 },
    up: 1,
    veil: 1,
    beat: beatAt(96.5, 100),
  };
}

// ——— The lawn ———
type Folk = {
  row: 0 | 1 | 2;
  x: number;
  hair: string;
  coat: string;
  hat: 'none' | 'straw' | 'flat' | 'cap' | 'bald';
  stripe: number;
  who?: 'grandad' | 'mum' | 'boy';
};
const ROW_BASE = [136, 157, 184] as const;
const ROW_W = [20, 27, 36] as const;
const LAWN_FOLK: readonly Folk[] = [
  { row: 0, x: 42, hair: '#3A2A22', coat: '#5A7FB0', hat: 'none', stripe: 1 },
  { row: 0, x: 70, hair: '#D9D6D0', coat: '#8A7458', hat: 'flat', stripe: 0, who: 'grandad' },
  { row: 0, x: 98, hair: '#4A2E22', coat: '#E07A6A', hat: 'straw', stripe: 1, who: 'mum' },
  { row: 0, x: 126, hair: '#7A4A2A', coat: '#F2C94C', hat: 'none', stripe: 0, who: 'boy' },
  { row: 0, x: 214, hair: '#2A221E', coat: '#6A9F6A', hat: 'cap', stripe: 2 },
  { row: 0, x: 242, hair: '#B5532F', coat: '#C26AA0', hat: 'none', stripe: 0 },
  { row: 0, x: 270, hair: '#CFCBC4', coat: '#5E6B80', hat: 'bald', stripe: 3 },
  { row: 0, x: 298, hair: '#E0C080', coat: '#7FB6C8', hat: 'straw', stripe: 1 },
  { row: 1, x: 24, hair: '#6A4430', coat: '#D9784A', hat: 'none', stripe: 2 },
  { row: 1, x: 62, hair: '#2E2420', coat: '#4C6E9E', hat: 'cap', stripe: 0 },
  { row: 1, x: 100, hair: '#C9C4BB', coat: '#9C6AA8', hat: 'none', stripe: 3 },
  { row: 1, x: 226, hair: '#3E2A20', coat: '#E4B640', hat: 'straw', stripe: 1 },
  { row: 1, x: 264, hair: '#1E1A1C', coat: '#58A08A', hat: 'none', stripe: 0 },
  { row: 1, x: 302, hair: '#8A5A3A', coat: '#D2604E', hat: 'flat', stripe: 2 },
  { row: 2, x: 14, hair: '#4A3226', coat: '#7A8FB4', hat: 'none', stripe: 0 },
  { row: 2, x: 64, hair: '#E3D2A8', coat: '#C25450', hat: 'straw', stripe: 3 },
  { row: 2, x: 114, hair: '#2A2024', coat: '#5E9A6A', hat: 'none', stripe: 1 },
  { row: 2, x: 214, hair: '#B9B4AC', coat: '#8E6E52', hat: 'bald', stripe: 2 },
  { row: 2, x: 262, hair: '#5A3626', coat: '#3E78B8', hat: 'cap', stripe: 0 },
  { row: 2, x: 312, hair: '#9A4A2A', coat: '#E39A4A', hat: 'none', stripe: 3 },
];
type Crowd = {
  jump: number;
  lean: number;
  /** A lawn-space point every head turns toward, or null. */
  follow: Pt | null;
  stand: number;
  /** Seconds since the hats went up. */
  hats: number;
  grandadAsleep: number;
  packed: boolean;
};
function crowdAt(t: number, follow: Pt | null): Crowd {
  return {
    jump: hump(t, 36.0, 36.45),
    lean: t >= 44.0 && t < 46.8 ? ease(span(t, 44.15, 45.2)) : 0,
    follow,
    stand: t >= OVATION && t < NEXT_SUNDAY ? backOut(span(t, OVATION, OVATION + 0.4)) : 0,
    hats: t >= OVATION + 0.25 && t < NEXT_SUNDAY ? t - OVATION - 0.25 : -1,
    grandadAsleep: t >= NOD && t < SNORT ? ease(span(t, NOD, NOD + 0.8)) : 0,
    packed: t >= NEXT_SUNDAY,
  };
}
/** A striped deckchair from behind, with its sitter's head and shoulders above the canvas. */
function lawnSitter(ctx: Ctx, f: Folk, i: number, crowd: Crowd, t: number) {
  const base = ROW_BASE[f.row],
    w = ROW_W[f.row];
  const h = w * 0.78;
  const top = base - h;
  // Frame.
  line(ctx, WOOD_D, Math.max(1, w / 14), [f.x - w * 0.5, top, f.x - w * 0.44, base]);
  line(ctx, WOOD_D, Math.max(1, w / 14), [f.x + w * 0.5, top, f.x + w * 0.44, base]);
  // Who sits here, and how they move.
  const kid = f.who === 'boy';
  const r = w * (kid ? 0.17 : 0.21);
  const jump = crowd.jump * w * 0.22 * (0.7 + rand(i) * 0.6);
  // Leaning in: every head drawn toward the bandstand, and dipping forward.
  const leanX = (160 - f.x) * 0.05 * crowd.lean;
  const stand = crowd.stand * w * 0.55 * (0.85 + rand(i * 3) * 0.3);
  const doze = f.who === 'grandad' ? crowd.grandadAsleep : 0;
  const lift = jump + stand;
  const hx = f.x + doze * r * 0.6 + leanX,
    hy = top - r * (kid ? 0.3 : 0.7) - lift + doze * r * 0.8 + crowd.lean * r * 0.35;
  // Shoulders (or, standing, the whole back and arms in the air), then the canvas sling.
  if (crowd.stand > 0.5) {
    box(ctx, f.x - r * 1.4, hy + r, r * 2.8, base - hy - r - h * 0.2, f.coat);
    const wave = Math.sin(t * 7 + i) * r * 0.3;
    line(ctx, f.coat, r * 0.55, [f.x - r * 1.2, hy + r * 1.4, f.x - r * 1.9 + wave, hy - r * 1.4]);
    line(ctx, f.coat, r * 0.55, [f.x + r * 1.2, hy + r * 1.4, f.x + r * 1.9 - wave, hy - r * 1.4]);
  } else
    oval(
      ctx,
      f.x + doze * r * 0.3 + leanX * 0.6,
      top + r * 0.4 - lift * 0.6,
      r * 1.45,
      r * 0.75,
      f.coat,
    );
  box(ctx, f.x - w * 0.47, top, w * 0.94, h * 0.62, STRIPES[f.stripe]);
  for (let k = 0; k < 2; k++)
    box(ctx, f.x - w * 0.47 + w * (0.16 + k * 0.4), top, w * 0.16, h * 0.62, '#FBF6EE');
  box(ctx, f.x - w * 0.5, top - 1, w, Math.max(1, w / 12), WOOD);
  // Head, from behind; a turned head shows a cheek.
  const turn = crowd.follow ? clamp((crowd.follow[0] - f.x) / 60, -1, 1) : 0;
  if (turn !== 0) oval(ctx, hx + turn * r * 0.7, hy + r * 0.15, r * 0.55, r * 0.7, '#E9BC9A');
  disc(ctx, hx, hy, r, f.hat === 'bald' ? '#E3B494' : f.hair);
  if (f.hat === 'bald') oval(ctx, hx, hy + r * 0.3, r, r * 0.5, f.hair);
  oval(ctx, hx - r * 0.95, hy + r * 0.1, r * 0.22, r * 0.35, '#E9BC9A');
  oval(ctx, hx + r * 0.95, hy + r * 0.1, r * 0.22, r * 0.35, '#E9BC9A');
  // Hats go up at the ovation.
  const toss = crowd.hats >= 0 && f.hat !== 'none' && f.hat !== 'bald' ? crowd.hats : -1;
  const hatY = toss >= 0 && toss < 1.6 ? hy - Math.sin((toss / 1.6) * Math.PI) * w * 1.6 : hy;
  const hatX = hx + (toss >= 0 ? Math.sin(toss * 3 + i) * 2 : 0);
  if (f.hat === 'straw') {
    oval(ctx, hatX, hatY - r * 0.55, r * 1.55, r * 0.35, '#E8C77A');
    oval(ctx, hatX, hatY - r * 0.75, r * 0.8, r * 0.5, '#E8C77A');
  } else if (f.hat === 'flat') oval(ctx, hatX, hatY - r * 0.5, r * 1.05, r * 0.5, '#7D6B55');
  else if (f.hat === 'cap') oval(ctx, hatX, hatY - r * 0.5, r * 1.02, r * 0.55, '#3E5E8E');
}
function bunting(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sag: number,
  seconds: number,
  s: number,
) {
  const n = Math.round((x1 - x0) / (6 * s));
  const at2 = (u: number): Pt => [lerp(x0, x1, u), lerp(y0, y1, u) + Math.sin(u * Math.PI) * sag];
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) pts.push(...at2(i / n));
  line(ctx, alpha('#5A4A40', 0.7), 0.6 * s, pts);
  const colors = [ROOF, '#FBF6EE', PIPING, '#3E78B8'];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = at2(i / n),
      [bx, by] = at2((i + 1) / n);
    const stir = Math.sin(seconds * 2.2 + i * 0.9) * 1.2 * s;
    poly(ctx, colors[i % 4], [ax, ay, bx, by, (ax + bx) / 2 + stir, (ay + by) / 2 + 5.5 * s]);
  }
}
/** The bandstand, its band and the Maestro's back, as seen from the lawn. */
function bandstand(ctx: Ctx, t: number, seconds: number) {
  const veils = t >= NEXT_SUNDAY ? 1 : 0;
  oval(ctx, 160, 116, 84, 9, alpha(INK, 0.14));
  // Back posts and rail, the deck behind the band.
  for (const x of [116, 146, 174, 204]) box(ctx, x - 1, 50, 2, 44, '#E3DED3');
  box(ctx, 98, 82, 124, 2, '#E3DED3');
  poly(ctx, '#E4D7BC', [100, 90, 220, 90, 226, 100, 94, 100]);
  // The band, seated in an arc; small, red and gold.
  const order: readonly Player[] = [
    'cymbals',
    'trombone',
    'clarinet',
    'trumpet',
    'snare',
    'horace',
  ];
  const xs = [110, 128, 145, 175, 192, 210];
  order.forEach((who, i) => {
    const c = CAST[who];
    const st = bandMood(who, t);
    const e = st.mood.eyes;
    const fig: Figure = {
      skin: c.skin,
      hair: who === 'cymbals' ? c.skin : c.hair,
      coat: JACKET,
      legs: TROUSERS,
      build: 'adult',
      size: 0.62,
      facing: i < 3 ? 1 : -1,
      sitting: true,
      hat: veils ? 'brim' : 'cap',
      hatColor: veils ? '#F6F4EE' : JACKET,
      eyes:
        e === 'wide' || e === 'bulge'
          ? 'wide'
          : e === 'happy'
            ? 'happy'
            : e === 'closed'
              ? 'closed'
              : 'open',
      mouth: st.mood.mouth === 'grin' ? 'grin' : 'none',
      arms: [0.9, 1.1],
      blush: false,
    };
    const x = xs[i],
      bob = (st.bob ?? 0) * 0.4;
    person(ctx, x, 97 + bob, fig);
    if (veils)
      poly(ctx, alpha(WHITE, 0.5), [
        x - 6,
        79 + bob,
        x + 6,
        79 + bob,
        x + 5,
        88 + bob,
        x - 5,
        88 + bob,
      ]);
    // Instruments: gold glints at this size.
    if (who === 'horace') {
      poly(ctx, BRASS, [x + 1, 92, x + 5, 92, x + 7, 76, x + 1, 76]);
      oval(ctx, x + 4, 74, 6, 2, BRASS_L);
      oval(ctx, x + 4, 74, 4.6, 1.3, BRASS_D);
      oval(ctx, x - 1, 90, 5, 5, BRASS);
    } else if (who === 'trombone') line(ctx, BRASS, 1, [x + 3, 83, x + 17, 86]);
    else if (who === 'trumpet') line(ctx, BRASS, 1.2, [x - 3, 83, x - 11, 83]);
    else if (who === 'clarinet') line(ctx, '#1C1A20', 1.2, [x + 2, 84, x + 5, 92]);
    else if (who === 'snare') oval(ctx, x - 4, 91, 5, 1.6, '#FBFAF6');
    else {
      disc(ctx, x + 8, 90, 5.5, '#F4F1EA');
      ring(ctx, x + 8, 90, 5.5, 5.5, JACKET, 1);
    }
  });
  // Podium and the Maestro's back.
  box(ctx, 150, 93, 20, 6, WOOD);
  box(ctx, 150, 93, 20, 1.5, mix(WOOD, WHITE, 0.25));
  maestro(ctx, LAWN_FEET[0], LAWN_FEET[1], LAWN_SCALE, mPose(t), 'back', t, {}, veils);
  // Deck front, steps and front posts.
  box(ctx, 94, 99, 132, 3, '#ECE6D9');
  poly(ctx, STAND_D, [94, 101, 120, 102, 120, 116, 94, 112]);
  box(ctx, 120, 102, 80, 14, STAND);
  poly(ctx, STAND_D, [200, 102, 226, 101, 226, 112, 200, 116]);
  for (let x = 124; x < 198; x += 8) line(ctx, alpha(STAND_D, 0.9), 1, [x, 104, x + 6, 114]);
  box(ctx, 146, 116, 28, 3, STAND);
  box(ctx, 143, 119, 34, 3, STAND_D);
  box(ctx, 140, 122, 40, 3, STAND);
  for (const x of [128, 222]) {
    box(ctx, x - 30, 87, 30, 2, STAND);
    for (let k = 3; k < 30; k += 4) box(ctx, x - 30 + k, 89, 1, 10, STAND_D);
  }
  for (const x of [98, 128, 192, 222]) {
    box(ctx, x - 2, 48, 4, 52, STAND);
    box(ctx, x + 1, 48, 1, 52, STAND_D);
  }
  // Roof: red and white, with a gold finial.
  poly(ctx, ROOF_D, [88, 46, 122, 47, 160, 14]);
  poly(ctx, ROOF_D, [198, 47, 232, 46, 160, 14]);
  const xs2 = [122, 135, 147, 160, 173, 185, 198];
  for (let k = 0; k < xs2.length - 1; k++)
    poly(ctx, k % 2 ? '#F6F1EA' : ROOF, [xs2[k], 47, xs2[k + 1], 47, 160, 14]);
  poly(ctx, alpha('#F6F1EA', 0.55), [100, 46, 111, 46.5, 160, 14]);
  poly(ctx, alpha('#F6F1EA', 0.55), [209, 46.5, 220, 46, 160, 14]);
  box(ctx, 88, 46, 144, 4, ROOF);
  for (let x = 91; x < 230; x += 6) disc(ctx, x, 50, 2.6, '#F6F1EA');
  line(ctx, BRASS_D, 1, [160, 14, 160, 6]);
  disc(ctx, 160, 12, 2.4, BRASS);
  bunting(ctx, 92, 54, 228, 54, 7, seconds, 1);
}
/** The chalk A-board by the steps, in lawn coordinates. */
function lawnSign(ctx: Ctx, t: number) {
  line(ctx, WOOD_D, 1.2, [178, 104, 175, 126]);
  line(ctx, WOOD_D, 1.2, [198, 104, 201, 126]);
  box(ctx, 176, 103, 24, 18, WOOD);
  box(ctx, 177.5, 104.5, 21, 15, BOARD);
  if (t < NEXT_SUNDAY) {
    write(ctx, 'BAND', 188, 108.6, { size: 3.9, color: CHALK });
    write(ctx, 'CONCERT', 188, 113.1, { size: 3.9, color: CHALK });
    write(ctx, '4 PM', 188, 117.8, { size: 3.9, color: PIPING });
  } else
    for (let k = 0; k < 3; k++)
      box(ctx, 180 + (k % 2) * 2, 107 + k * 4, 16 - (k % 2) * 4, 1, alpha(CHALK, 0.8));
}
function lawnSet(ctx: Ctx, t: number, seconds: number, from: number) {
  sky(ctx, [SKY_A, SKY_B], 0, 62);
  cloud(ctx, 60 + ((seconds * 1.2) % 60), 20, 0.9);
  cloud(ctx, 262 + ((seconds * 0.8) % 40), 30, 0.7);
  // The far bank and the river behind the bandstand.
  for (let i = 0; i < 14; i++)
    disc(ctx, i * 25 + 6, 56 - (i % 3) * 2, 11 + (i % 2) * 3, i % 2 ? TREE : TREE_D);
  box(ctx, 0, 60, W, 9, RIVER);
  for (let i = 0; i < 12; i++) {
    const gx = ((rand(i * 3.3) * 340 + seconds * (4 + (i % 3))) % 330) - 5;
    if (Math.sin(seconds * 1.7 + i * 2.1) > 0.2)
      box(ctx, gx, 62 + (i % 3) * 2, 4, 1, alpha(WHITE, 0.8));
  }
  box(ctx, 0, 68, W, 112, GRASS);
  for (let k = 0; k < 4; k++) box(ctx, 0, 76 + k * 26, W, 13, alpha(GRASS_L, 0.5));
  bandstand(ctx, t, seconds);
  lawnSign(ctx, t);
  // The audience, nearest row last.
  let follow: Pt | null = null;
  if (t >= 74.2 && t < 76) follow = waspPos(t);
  if (t >= 84 && t < 85.8) follow = [181, 0];
  const crowd = crowdAt(t, follow);
  if (crowd.packed)
    for (let i = 0; i < 9; i++) {
      // Next Sunday: people standing at the sides.
      const x = i < 4 ? 8 + i * 9 : 278 + (i - 4) * 9;
      person(ctx, x, 124 - (i % 2) * 3, {
        skin: SKINS[i % 4],
        hair: HAIRS[i % 4],
        coat: STRIPES[i % 4],
        legs: TROUSERS,
        build: 'adult',
        size: 0.55,
        facing: i < 4 ? 1 : -1,
        eyes: 'happy',
        blush: false,
      });
    }
  LAWN_FOLK.forEach((f, i) => {
    if (!(f.row === 2 && crowd.packed)) lawnSitter(ctx, f, i, crowd, t);
  });
  if (crowd.packed)
    for (let i = 0; i < 7; i++) {
      // The standing row at the back, right in front of the camera.
      const x = 18 + i * 48 + (i > 2 ? 8 : 0);
      const coat = ['#5A7FB0', '#C25450', '#6A9F6A', '#E39A4A', '#9C6AA8'][i % 5];
      oval(ctx, x, 170, 19, 12, coat);
      box(ctx, x - 19, 170, 38, 12, coat);
      oval(ctx, x - 9, 152, 2, 3, '#E9BC9A');
      oval(ctx, x + 9, 152, 2, 3, '#E9BC9A');
      disc(ctx, x, 150, 9, HAIRS[i % 4]);
      if (i % 3 === 1) {
        oval(ctx, x, 142, 17, 3.5, '#F6F4EE');
        oval(ctx, x, 138, 8, 5, '#F6F4EE');
        poly(ctx, alpha(WHITE, 0.45), [x - 15, 143, x + 15, 143, x + 11, 162, x - 11, 162]);
      }
    }
  // The wasp over the lawn, or sitting on the baton.
  if (t >= OFF_JAM && t < 76 && (t < 46 || t >= 74.2)) waspFlying(ctx, t, from, seconds, 3);
  if (t >= FINAL_HIT && t < NEXT_SUNDAY) {
    const tip = lawnPoint(tipLocal(mPose(t)));
    wasp(ctx, tip[0], tip[1] - 1, 3, seconds, { still: true });
  }
}

// ——— Shot: over the band's shoulders, at the Maestro ———
function otsFace(t: number): Small {
  if (t < LATE_OOM) return { eyes: 'dot', brows: 0.4 };
  if (t < 7.6) return { eyes: 'dot', brows: 1, look: -1 };
  if (t < FLICK) return { eyes: 'dot', brows: 1 };
  if (t < LAND_NOSE)
    return { eyes: 'wide', brows: -1, mouth: t >= SWIPE && t < SWIPE + 0.4 ? 'grit' : 'line' };
  if (t < LIFT) return { eyes: 'cross', brows: -1, mouth: 'line' };
  if (t < INTO_TUBA) return { eyes: 'wide', brows: -1, mouth: t >= FLAIL ? 'grit' : 'o' };
  if (t < 80) return { eyes: 'wide', brows: -0.4, mouth: 'o', look: -1 };
  if (t < FINAL_HIT) return { eyes: 'dot', brows: 1, mouth: 'grit' };
  if (t < BOW) return { eyes: 'cross', brows: -0.6, mouth: 'o' };
  if (t < ENCORE) return { eyes: 'happy', brows: -0.3, mouth: 'smile' };
  return { eyes: 'dot', brows: 0.2, mouth: 'line' };
}
function otsSet(ctx: Ctx, t: number, seconds: number, from: number) {
  const m = mPose(t);
  // Through the bandstand's front opening: sky, trees, the lawn and its deckchairs.
  sky(ctx, [SKY_A, SKY_B], 0, 50);
  cloud(ctx, 220 + ((seconds * 1.1) % 50), 28, 0.8);
  for (let i = 0; i < 12; i++)
    disc(ctx, i * 30 + 4, 48 - (i % 3) * 2, 12 + (i % 2) * 2, i % 2 ? TREE : TREE_D);
  box(ctx, 0, 50, W, 80, GRASS);
  box(ctx, 0, 62, W, 10, alpha(GRASS_L, 0.5));
  box(ctx, 0, 86, W, 12, alpha(GRASS_L, 0.5));
  // The audience, facing us.
  const jump = hump(t, SWIPE, SWIPE + 0.45) * 3;
  // The lawn leans in with the swell, and stays on the edge of its seats through the hold.
  const lean =
    t >= RISE && t < LAND_NOSE
      ? 1.5 * ease(span(t, RISE, RISE + 0.6))
      : t >= 46.8 && t < 48
        ? 1.5
        : 0;
  const cheer = t >= OVATION && t < NEXT_SUNDAY;
  for (let r = 0; r < 3; r++) {
    const y = 66 + r * 16,
      rad = 3 + r * 0.9,
      n = 11 - r;
    for (let i = 0; i < n; i++) {
      const x = 14 + i * (292 / (n - 1)) + (r % 2) * 8;
      const dy = -jump * (0.6 + rand(i + r * 11) * 0.8) - lean;
      box(ctx, x - rad * 1.6, y - rad * 1.2, rad * 3.2, rad * 3, STRIPES[(i + r) % 4]);
      box(ctx, x - rad * 0.6, y - rad * 1.2, rad * 1.2, rad * 3, '#FBF6EE');
      oval(ctx, x, y + rad * 1.8 + dy * 0.5, rad * 1.3, rad * 0.9, STRIPES[(i + r + 1) % 4]);
      disc(ctx, x, y + dy, rad, SKINS[(i * 3 + r) % 4]);
      oval(ctx, x, y - rad * 0.5 + dy, rad, rad * 0.55, HAIRS[(i + r * 2) % 4]);
      if (rad > 3.5) {
        box(ctx, x - rad * 0.45, y + dy - 0.2, 1, 1, INK);
        box(ctx, x + rad * 0.35, y + dy - 0.2, 1, 1, INK);
      }
      if (cheer) box(ctx, x - 0.5, y + dy + rad * 0.45, 1.5, 1.5, INK);
    }
  }
  // The roof overhead, its far eave and valance, the front posts and the balustrade.
  wash(ctx, 0, 24, ['#7E1C24', '#A2343C']);
  for (let k = 0; k < 9; k++) {
    const x0 = k * 40 - 20;
    if (k % 2)
      poly(ctx, alpha('#EDE3D6', 0.32), [x0 + 20, 0, x0 + 60, 0, x0 + 52, 24, x0 + 28, 24]);
  }
  box(ctx, 0, 23, W, 6, ROOF);
  for (let x = 4; x < W; x += 8) disc(ctx, x, 29, 3.2, '#F6F1EA');
  bunting(ctx, 0, 33, W, 33, 6, seconds, 1.4);
  for (const x of [24, 296]) {
    box(ctx, x - 5, 26, 10, 104, STAND);
    box(ctx, x + 2, 26, 3, 104, STAND_D);
  }
  box(ctx, 29, 100, 262, 4, STAND);
  for (let x = 34; x < 290; x += 9) box(ctx, x, 104, 3, 18, STAND_D);
  box(ctx, 29, 120, 262, 3, STAND);
  // The deck.
  box(ctx, 0, 123, W, 57, DECK);
  for (let k = 0; k < 6; k++) line(ctx, alpha('#C8B48E', 0.8), 1, [0, 128 + k * 9, W, 128 + k * 9]);
  // Music stand (from behind) and podium.
  line(ctx, '#3A3540', 1.6, [194, 100, 194, 128]);
  line(ctx, '#3A3540', 1.2, [188, 130, 194, 126, 200, 130]);
  poly(ctx, '#3A3540', [181, 88, 207, 88, 205, 102, 183, 102]);
  box(ctx, 142, 118, 36, 12, WOOD);
  box(ctx, 142, 118, 36, 2, mix(WOOD, WHITE, 0.25));
  box(ctx, 142, 128, 36, 2, WOOD_D);
  // The Maestro, and the wasp sitting on him.
  maestro(ctx, OTS_FEET[0], OTS_FEET[1], 1, m, 'front', t, otsFace(t), t >= NEXT_SUNDAY ? 1 : 0);
  if (t >= LAND_NOSE && t < LIFT) {
    const nose = otsPoint([0.8, -51 + m.crouch * DUCK_DEPTH]);
    wasp(ctx, nose[0], nose[1] - 1.5, 4.5, seconds, { still: true, face: -1 });
  } else if (t >= FINAL_HIT && t < NEXT_SUNDAY) {
    const tip = otsPoint(leaned(m, tipLocal(m)));
    wasp(ctx, tip[0] - 1, tip[1] - 2.4, 5, seconds, { still: true, face: -1 });
  }
  // Paper flying off the stands in the presto.
  if (t >= PRESTO && t < INTO_TUBA)
    for (let i = 0; i < 5; i++) {
      const k = ((t - PRESTO) * 0.55 + i * 0.21) % 1;
      const px = 60 + i * 50 + Math.sin(k * 9 + i) * 18,
        py = 150 - k * 150;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(k * 9 + i);
      box(ctx, -5, -6.5, 10, 13, PAPER);
      for (let l = 0; l < 3; l++) box(ctx, -3.5, -4 + l * 3.5, 7, 0.8, alpha(INK, 0.5));
      ctx.restore();
    }
  // The band, from behind: the middle row, then the two in front.
  const mid: readonly (readonly [Player, number, number, number])[] = [
    ['snare', 92, 162, 1],
    ['clarinet', 124, 158, 0.95],
    ['trumpet', 202, 158, 0.95],
    ['cymbals', 240, 162, 1],
  ];
  for (const [who, x, y, s] of mid) bandBack(ctx, who, x, y, s, bandMood(who, t));
  // Horace and the great gold bell.
  const oom = hump(t, LATE_OOM, LATE_OOM + 0.45);
  const shake =
    t >= INTO_TUBA && t < LAUNCH ? Math.sin(t * 40) * 1.2 : Math.sin(t * 60) * 1.6 * oom;
  const [bx, by] = [TUBA_BELL[0] + shake, TUBA_BELL[1]];
  poly(ctx, BRASS, [8, 168, 44, 168, 48, 100, 4, 100]);
  poly(ctx, BRASS, [bx - 28, by, bx + 28, by, 48, 104, 8, 104]);
  oval(ctx, bx, by, 28, 8.5, BRASS_L);
  oval(ctx, bx, by + 0.6, 24, 6.4, BRASS_D);
  oval(ctx, bx, by + 1.6, 18, 4, '#6E4F18');
  line(ctx, BRASS_L, 2, [14, 160, 12, 106]);
  // Horace's lone, late OOM: the bell shudders and rings of sound roll out of it.
  if (t >= LATE_OOM && t < LATE_OOM + 0.7)
    for (let i = 0; i < 3; i++) {
      const k = (t - LATE_OOM) / 0.7 - i * 0.18;
      if (k > 0 && k < 1)
        ring(ctx, bx, by - 8 - k * 30, 14 + k * 16, 3 + k * 4, alpha(WHITE, 0.85 * (1 - k)), 2);
    }
  bandBack(ctx, 'horace', 64, 206, 1.85, bandMood('horace', t));
  bandBack(ctx, 'trombone', 274, 206, 1.85, bandMood('trombone', t));
  // The wasp in flight, over everything.
  const inFlight = (t >= FLICK && t < INTO_TUBA) || (t >= 80 && t < FINAL_HIT);
  if (inFlight && !(t >= LAND_NOSE && t < FLAIL))
    waspFlying(ctx, t, from, seconds, 5, { dot: 1.4 });
}

// ——— Shot: the band row, three-quarter, all eyes on the baton ———
function rowSet(ctx: Ctx, t: number, seconds: number) {
  // Behind the band: the river, the far bank, the bandstand's back posts.
  sky(ctx, [SKY_A, SKY_B], 0, 70);
  for (let i = 0; i < 12; i++) disc(ctx, i * 30 + 10, 64 - (i % 3) * 3, 14, i % 2 ? TREE : TREE_D);
  box(ctx, 0, 66, W, 22, RIVER);
  for (let i = 0; i < 10; i++) {
    const gx = ((rand(i * 7.1) * 340 + seconds * 5) % 330) - 5;
    box(ctx, gx, 70 + (i % 4) * 4, 6, 1, alpha(WHITE, 0.7));
  }
  wash(ctx, 0, 18, ['#7E1C24', '#A2343C']);
  box(ctx, 0, 17, W, 5, ROOF);
  for (let x = 3; x < W; x += 7) disc(ctx, x, 22, 2.8, '#F6F1EA');
  for (const x of [60, 190, 300]) {
    box(ctx, x - 4, 20, 8, 100, STAND);
    box(ctx, x + 2, 20, 2, 100, STAND_D);
  }
  box(ctx, 0, 92, W, 3, STAND);
  for (let x = 4; x < W; x += 10) box(ctx, x, 95, 3, 18, STAND_D);
  box(ctx, 0, 112, W, 68, DECK);
  for (let k = 0; k < 6; k++)
    line(ctx, alpha('#C8B48E', 0.8), 1, [0, 118 + k * 11, W, 118 + k * 11]);
  // Every head swivels after the tip of the baton, which whirls in and out at the left edge.
  const m = mPose(t);
  const tip = tipLocal(m);
  const presto = t >= PRESTO && t < INTO_TUBA;
  const reach = clamp((tip[0] + 48) / 68),
    high = clamp((tip[1] + 87) / 62);
  for (let i = PLAYERS.length - 1; i >= 0; i--) {
    const who = PLAYERS[i];
    const st = bandMood(who, t);
    const mood: Mood = { ...st.mood };
    if (presto) {
      mood.turn = -0.2 - reach * 1.1;
      mood.tilt = -reach * 0.3 + (high - 0.5) * 0.14;
      mood.look = [-0.2 - reach * 0.9, lerp(-1, 0.6, high)];
    }
    bandsman(ctx, who, 50 + i * 49, 156 - i * 7, 1.32 - i * 0.08, { ...st, mood });
  }
  if (presto) {
    // The Maestro's glove and baton, just in at the edge of frame.
    const gx = lerp(56, 10, reach),
      gy = lerp(26, 84, high);
    const bx = gx + Math.sin(m.baton) * 34,
      by = gy - Math.cos(m.baton) * 34;
    line(ctx, alpha('#C9CBD3', 0.9), 3.4, [gx, gy, bx, by]);
    line(ctx, WHITE, 2.2, [gx, gy, bx, by]);
    glove(ctx, gx, gy, 1.5, m.baton * 0.25 - 0.5);
    // Sheet music, blown off the stands.
    for (let i = 0; i < 3; i++) {
      const k = ((t - 64) * 0.42 + i * 0.34) % 1;
      ctx.save();
      ctx.translate(330 - k * 360 + Math.sin(k * 7 + i) * 14, 130 - k * 110 - i * 14);
      ctx.rotate(k * 8 + i * 2);
      box(ctx, -6, -8, 12, 16, PAPER);
      for (let l = 0; l < 3; l++) box(ctx, -4.5, -5 + l * 4, 9, 0.9, alpha(INK, 0.5));
      ctx.restore();
    }
  }
}

// ——— Shot: the front row, from the bandstand ———
type Sit = {
  who: 'boy' | 'mum' | 'grandad';
  mood: Mood;
  arms: 'eat' | 'out' | 'fan' | 'drop' | 'rest' | 'grip' | 'clap' | 'up';
  bob?: number;
  clap?: number;
  /** The fan slipping out of her hand, 0..1. */
  drop?: number;
};
/** A paper fan, pivoting on its handle at the origin. */
function fan(ctx: Ctx) {
  poly(ctx, '#F4EAD2', [0, 0, -12, -14, -4, -18, 4, -18, 12, -14]);
  for (let k = -2; k <= 2; k++) line(ctx, alpha('#C9A36A', 0.8), 0.8, [0, 0, k * 4, -17]);
}
function sitter(ctx: Ctx, x: number, y: number, s: number, o: Sit, t: number) {
  const kid = o.who === 'boy';
  const coat = kid ? '#F2C94C' : o.who === 'mum' ? '#E07A6A' : '#8A7458';
  const legs = kid ? '#3E5E8E' : o.who === 'mum' ? '#F4E8D8' : '#5A5048';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // The deckchair, from the front.
  line(ctx, WOOD_D, 3, [-24, -74, -28, 0]);
  line(ctx, WOOD_D, 3, [24, -74, 28, 0]);
  line(ctx, WOOD, 3, [-30, -30, 30, -30]);
  poly(ctx, o.who === 'mum' ? STRIPES[1] : STRIPES[0], [-22, -74, 22, -74, 18, -24, -18, -24]);
  for (let k = 0; k < 2; k++) {
    const x0 = -14 + k * 18;
    poly(ctx, '#FBF6EE', [x0, -74, x0 + 7, -74, x0 + 5.6, -24, x0 - 0.4, -24]);
  }
  box(ctx, -24, -76, 48, 3, WOOD);
  ctx.translate(0, o.bob ?? 0);
  // Body, reclining in the sling, legs toward us.
  const sh = kid ? -44 : -50;
  poly(ctx, coat, [-13, sh, 13, sh, 15, -20, -15, -20]);
  box(ctx, -12, -22, 24, 8, legs);
  for (const sd of [-1, 1]) {
    box(ctx, sd * 7 - 4, -16, 8, kid ? 12 : 16, legs);
    box(ctx, sd * 7 - 5, kid ? -6 : -2, 10, 4, '#3B3440');
  }
  const skin = CAST[o.who].skin;
  const hy = sh - (kid ? 11 : 13);
  const shoulderL: Pt = [-11, sh + 4],
    shoulderR: Pt = [11, sh + 4];
  const limb = (a: Pt, b: Pt) => {
    line(ctx, coat, 5, [a[0], a[1], b[0], b[1]]);
    disc(ctx, b[0], b[1], 3, skin);
  };
  let sandwich: Pt | null = null;
  switch (o.arms) {
    case 'eat':
      limb(shoulderL, [-12, -26]);
      limb(shoulderR, [9, hy + 9]);
      sandwich = [9, hy + 7];
      break;
    case 'out':
      limb(shoulderR, [12, -26]);
      limb(shoulderL, [-34, hy + 4]);
      sandwich = [-36, hy + 1];
      break;
    case 'fan': {
      limb(shoulderL, [-10, -26]);
      limb(shoulderR, [14, hy + 8]);
      ctx.save();
      ctx.translate(14, hy + 6);
      ctx.rotate(-0.5 + Math.sin(t * 9) * 0.5);
      fan(ctx);
      ctx.restore();
      break;
    }
    case 'drop': {
      // Startled, her hand flies open and the fan tumbles into her lap.
      const k = o.drop ?? 0;
      limb(shoulderL, [-10, -26]);
      limb(shoulderR, blend([14, hy + 8], [19, hy + 2], hump(k, 0, 0.6)));
      ctx.save();
      ctx.translate(lerp(14, 6, k), lerp(hy + 6, -18, easeIn(k)));
      ctx.rotate(-0.5 + k * 2.6);
      fan(ctx);
      ctx.restore();
      break;
    }
    case 'rest':
      limb(shoulderL, [-4, -24]);
      limb(shoulderR, [4, -25]);
      break;
    case 'grip':
      limb(shoulderL, [-22, -32]);
      limb(shoulderR, [22, -32]);
      break;
    case 'clap': {
      // Hands up in front of his chest, meeting on each clap.
      const gap = 2.6 + (o.clap ?? 0) * 9;
      limb(shoulderL, [-gap, hy + 15]);
      limb(shoulderR, [gap, hy + 15]);
      if ((o.clap ?? 1) < 0.5)
        for (const sd of [-1, 1]) line(ctx, alpha(INK, 0.6), 1, [sd * 6, hy + 9, sd * 9, hy + 6]);
      break;
    }
    case 'up':
      limb(shoulderL, [-20, hy - 8 + Math.sin(t * 9) * 3]);
      limb(shoulderR, [20, hy - 8 - Math.sin(t * 9) * 3]);
      break;
  }
  head(ctx, o.who, 0, hy, kid ? 0.5 : 0.55, o.mood);
  if (sandwich) {
    const [sx, sy] = sandwich;
    poly(ctx, CRUST, [sx - 7, sy + 4, sx + 7, sy + 4, sx, sy - 7]);
    poly(ctx, BREAD, [sx - 5.6, sy + 3, sx + 5.6, sy + 3, sx, sy - 5.4]);
    line(ctx, JAM, 1.3, [sx - 6, sy + 4.2, sx + 6, sy + 4.2]);
  }
  ctx.restore();
}
function frontBackdrop(ctx: Ctx, t: number) {
  // Beyond the front row: more of the lawn, and the town's trees.
  sky(ctx, [SKY_A, SKY_B], 0, 40);
  for (let i = 0; i < 12; i++) disc(ctx, i * 30, 40 - (i % 3) * 3, 15, i % 2 ? TREE : TREE_D);
  box(ctx, 0, 42, W, 138, GRASS);
  box(ctx, 0, 50, W, 10, alpha(GRASS_L, 0.5));
  // Back rows: chair tops and faces.
  const delight = t >= 66 && t < 68;
  for (let r = 0; r < 2; r++) {
    const y = 56 + r * 20,
      rad = 4.5 + r * 1.5;
    for (let i = 0; i < 9 - r; i++) {
      const x = 18 + i * (r ? 44 : 36) + r * 20;
      const dy = delight ? -Math.abs(Math.sin(t * 8 + i)) * 2 : 0;
      box(ctx, x - rad * 1.7, y - rad * 1.4, rad * 3.4, rad * 3.4, STRIPES[(i + r) % 4]);
      box(ctx, x - rad * 0.6, y - rad * 1.4, rad * 1.2, rad * 3.4, '#FBF6EE');
      disc(ctx, x, y + dy, rad, SKINS[(i + r) % 4]);
      oval(ctx, x, y - rad * 0.55 + dy, rad, rad * 0.55, HAIRS[(i + r) % 4]);
      box(ctx, x - rad * 0.45, y + dy, 1, 1.2, INK);
      box(ctx, x + rad * 0.3, y + dy, 1, 1.2, INK);
      if (delight) oval(ctx, x, y + rad * 0.5 + dy, rad * 0.35, rad * 0.3, INK);
    }
  }
}
function frontSet(ctx: Ctx, t: number, seconds: number, from: number) {
  frontBackdrop(ctx, t);
  // The front row: the boy, his mum, and the grandad.
  let boy: Sit, mum: Sit, grandad: Sit;
  const out = ease(span(t, LANDS_ON_JAM + 0.1, LANDS_ON_JAM + 0.35));
  if (t < 30) {
    const noticed = t >= LANDS_ON_JAM + 0.05;
    boy = {
      who: 'boy',
      mood: noticed
        ? {
            eyes: 'wide',
            look: [-1, 0],
            mouth: 'wobble',
            brows: -1,
            raise: 1,
            jam: true,
            tilt: 0.1 * out,
          }
        : { eyes: 'open', look: [0.4, 0.3], mouth: Math.sin(t * 9) > 0 ? 'flat' : 'o', jam: true },
      arms: out > 0.5 ? 'out' : 'eat',
    };
    mum = {
      who: 'mum',
      mood: { eyes: 'half', look: [0.4, -0.5], mouth: 'flat', brows: -0.2 },
      arms: 'fan',
    };
    grandad = { who: 'grandad', mood: { eyes: 'sleep', mouth: 'sleep', tilt: 0.28 }, arms: 'rest' };
  } else if (t < LAWN_ROUND) {
    // After the crash: the grandad snorts awake, the mum drops her fan, the boy flinches.
    const awake = t >= SNORT;
    const jolt = hump(t, SNORT, SNORT + 0.4);
    const flinch = hump(t, SNORT + 0.04, SNORT + 0.6);
    boy = {
      who: 'boy',
      mood: {
        eyes: flinch > 0.35 ? 'squeeze' : 'wide',
        look: [1, -0.2],
        mouth: awake ? 'o' : 'flat',
        brows: -1,
        raise: 1,
        jam: true,
        tilt: -0.2 * flinch,
      },
      arms: 'eat',
      bob: flinch * 3,
    };
    mum = {
      who: 'mum',
      mood: { eyes: 'wide', look: [awake ? 1 : 0, -0.3], mouth: 'o', raise: 1, brows: -0.6 },
      arms: 'drop',
      drop: ease(span(t, WAKE_CUT + 0.05, WAKE_CUT + 0.5)),
    };
    grandad = {
      who: 'grandad',
      mood: awake
        ? { eyes: 'wide', look: [-0.4, -0.6], mouth: 'o', brows: -0.6, raise: 1, hop: jolt * 8 }
        : { eyes: 'sleep', mouth: 'sleep', tilt: 0.28 },
      arms: awake ? 'grip' : 'rest',
      bob: -jolt * 6,
    };
  } else {
    boy = {
      who: 'boy',
      mood: { eyes: 'happy', mouth: 'grin', jam: true },
      arms: 'up',
      bob: -Math.abs(Math.sin(t * 9)) * 3,
    };
    mum = {
      who: 'mum',
      mood: { eyes: 'wide', mouth: 'open', raise: 1 },
      arms: 'grip',
      bob: -Math.abs(Math.sin(t * 8 + 1)) * 2,
    };
    grandad = {
      who: 'grandad',
      mood: { eyes: 'happy', mouth: 'grin', raise: 0.6 },
      arms: 'up',
      bob: -Math.abs(Math.sin(t * 10 + 2)) * 5,
    };
  }
  sitter(ctx, 100, 182, 1.25, boy, t);
  sitter(ctx, 178, 184, 1.3, mum, t);
  sitter(ctx, 256, 184, 1.3, grandad, t);
  if (t < 30 && t >= LANDS_ON_JAM) {
    const p = blend(JAM_EAT, JAM_OUT, out);
    wasp(ctx, p[0], p[1] - 4.5, 7, seconds, { still: true, face: -1 });
  } else if (t < 30 && t >= 20.4) waspFlying(ctx, t, from, seconds, 6, { dot: 1.5 });
}
/** The boy's close-up, at the end: the first clap. */
function boyShot(ctx: Ctx, t: number) {
  const last = CLAPS.filter((c) => c <= t).at(-1);
  const clap = last === undefined ? 1 : clamp((t - last) / 0.18);
  camera(
    ctx,
    track(t, [
      [85.8, 104, 118, 2.2],
      [87, 104, 112, 2.45],
    ]),
    () => {
      frontBackdrop(ctx, t);
      sitter(
        ctx,
        178,
        184,
        1.3,
        {
          who: 'mum',
          mood: { eyes: 'wide', look: [-0.8, 0], mouth: 'o', raise: 1 },
          arms: 'rest',
        },
        t,
      );
      sitter(
        ctx,
        100,
        182,
        1.25,
        {
          who: 'boy',
          mood: {
            eyes: t >= CLAP_ONE ? 'happy' : 'wide',
            mouth: t >= CLAP_ONE ? 'grin' : 'o',
            jam: true,
            raise: 0.6,
          },
          arms: 'clap',
          clap,
        },
        t,
      );
    },
  );
}

// ——— Shot: the Maestro's close-up ———
function cuBackdrop(ctx: Ctx, seconds: number) {
  // Behind him, soft: the lawn and its stripes, the sky, the valance at the top.
  sky(ctx, [SKY_A, SKY_B], 0, 70);
  for (let i = 0; i < 8; i++)
    disc(ctx, i * 46, 66 - (i % 2) * 6, 22, alpha(i % 2 ? TREE : TREE_D, 0.7));
  box(ctx, 0, 72, W, 108, mix(GRASS, SKY_B, 0.2));
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 7; i++) {
      const x = 20 + i * 48 + r * 24,
        y = 96 + r * 34;
      box(ctx, x - 12, y - 10, 24, 22, alpha(STRIPES[(i + r) % 4], 0.45));
      disc(ctx, x, y - 8, 7, alpha('#E3B494', 0.5));
    }
  box(ctx, 0, 0, W, 8, ROOF);
  for (let x = 6; x < W; x += 12) disc(ctx, x, 8, 4.5, '#F6F1EA');
  bunting(ctx, -4, 12, W + 4, 12, 7, seconds, 2);
}
function maestroCU(ctx: Ctx, t: number, seconds: number, from: number) {
  const m = mPose(t);
  let face: MFace = { eyes: 'glare', brows: [1, 1], mouth: 'stern', hair: m.hair, tie: m.tie };
  let view = { x: 160, y: 92, zoom: 1 };
  const set = (k: MFace) => (face = { ...face, ...k });
  if (from === 7.6) {
    // Three raps on the stand; a glare; one brow up, then both down.
    set({ eyes: 'glare', brows: t < 8.6 ? [-0.2, 1] : [1, 1], raise: t < 8.6 ? [1, 0] : [0, 0] });
    view = track(t, [
      [7.6, 160, 96, 1],
      [9.6, 160, 92, 1.12],
    ]);
  } else if (from === RAISE_CUT) {
    const up = t >= RAISE;
    set({
      eyes: up ? 'open' : 'glare',
      brows: [0.6, 0.6],
      raise: up ? [0.4, 0.4] : [0, 0],
      look: [0, -0.4],
    });
    view = track(t, [
      [RAISE_CUT, 160, 100, 1.05],
      [DOWNBEAT, 160, 94, 1.2],
    ]);
  } else if (from === 25.5) {
    const wx = waspPos(t)[0];
    set({ eyes: 'open', brows: [0.8, 0.8], look: [clamp((wx - 160) / 110, -1, 1), 0] });
  } else if (from === 31.0) {
    set({ eyes: 'wide', brows: [-1, -1], raise: [1, 1], mouth: 'open' });
    view = track(t, [
      [31, 160, 96, 1],
      [32.5, 160, 92, 1.1],
    ]);
  } else if (from === 57.8) {
    const lifted = t >= LIFT;
    const exhale = t >= EXHALE && t < RETURN + 0.15;
    set({
      eyes: !lifted ? 'cross' : exhale ? 'closed' : 'wide',
      brows: exhale ? [-0.6, -0.6] : [-1, -1],
      raise: exhale ? [0, 0] : [1, 1],
      mouth: exhale ? 'puff' : t >= RETURN ? 'gape' : 'o',
      look: t >= RETURN ? [0.8, 0] : [0, -0.6],
    });
    view = track(t, [
      [57.8, BROW_SPOT[0], BROW_SPOT[1] + 4, 2.4],
      [LIFT + 0.1, BROW_SPOT[0], BROW_SPOT[1] + 4, 2.4],
      [EXHALE + 0.2, 160, 94, 1],
    ]);
  } else if (from === CHASE_CUT) {
    const wx = waspPos(t)[0];
    set({
      eyes: 'wide',
      brows: [-1, -1],
      raise: [1, 1],
      mouth: 'grit',
      look: [clamp((wx - 160) / 110, -1, 1), 0],
      tilt: Math.sin(t * 10) * 0.12,
    });
  } else if (from === TURN_CUT) {
    // He half turns, shoulders and all, to the cheering lawn; stops; turns back to his band.
    const turn = ease(span(t, 89.5, 89.85)) * (1 - ease(span(t, 90.12, 90.47)));
    const back = t >= 90.12;
    set({
      eyes: 'open',
      brows: back ? [-0.4, -0.4] : [0.3, 0.3],
      raise: back ? [0.5, 0.5] : [0.6, 0.6],
      mouth: 'stern',
      turn: turn * 1.5,
      look: [back ? -0.6 : turn, 0],
      tilt: turn * -0.08,
    });
    view = track(t, [
      [TURN_CUT, 160, 94, 1],
      [BOOK_CUT, 160, 92, 1.06],
    ]);
  } else if (from === SMILE_CUT) {
    // He looks at his band, and for the first time, he smiles.
    const soften = ease(span(t, SMILE_CUT + 0.05, SMILE + 0.1));
    set({
      eyes: t >= 92.6 ? 'happy' : 'open',
      brows: [lerp(0.6, -0.3, soften), lerp(0.6, -0.3, soften)],
      raise: [soften * 0.4, soften * 0.4],
      mouth: t >= SMILE ? 'smile' : 'stern',
      look: [-0.3, 0.2],
    });
    view = track(t, [
      [SMILE_CUT, 160, 94, 1],
      [BOW, 160, 90, 1.15],
    ]);
  } else if (from === ENCORE) {
    // One eyebrow up, deadpan: shall we?
    set({ eyes: 'open', brows: [-0.4, 1], raise: [1.2, 0], mouth: 'stern', look: [-0.5, -0.3] });
    view = track(t, [
      [ENCORE, 160, 96, 1.05],
      [96, 160, 92, 1.12],
    ]);
  }
  camera(ctx, view, () => {
    cuBackdrop(ctx, seconds);
    maestroFace(ctx, CU_FACE[0], CU_FACE[1], CU_SCALE, face);
    // Hands and baton where the story needs them.
    if (from === 7.6) {
      const tap = KNOCKS.reduce((mm, k) => Math.max(mm, hump(t, k - 0.12, k + 0.1)), 0);
      box(ctx, 214, 160, 120, 30, '#3A3540');
      box(ctx, 214, 160, 120, 3, '#57505E');
      const a = -0.9 + tap * 0.5;
      line(ctx, WHITE, 2.6, [254, 140, 254 + Math.sin(a) * 30, 140 - Math.cos(a) * 30]);
      glove(ctx, 262, 150, 1.6, -0.6);
      if (tap > 0.8) {
        line(ctx, alpha(WHITE, 0.8), 1, [226, 154, 222, 148]);
        line(ctx, alpha(WHITE, 0.8), 1, [232, 152, 232, 145]);
      }
    } else if (from === RAISE_CUT) {
      const up = ease(span(t, RAISE, RAISE + 0.8));
      const y = lerp(210, 56, up) + Math.sin(t * 37) * 0.6 * up;
      glove(ctx, 60, y, 1.8, 0.2);
      glove(ctx, 260, y, 1.8, -0.2);
      line(ctx, WHITE, 2.4, [56, y - 8, 70, y - 50]);
    } else if (from === 25.5) {
      const h = beatHand(t, DOWNBEAT, 100, 1);
      const x = 52 + (h[0] + 14) * 2,
        y = 166 + (h[1] + 46) * 2.2;
      glove(ctx, x, y, 1.6, 0.3);
      line(ctx, WHITE, 2.2, [x + 4, y - 8, x + 24, y - 42]);
    } else if (from === 31.0) {
      glove(ctx, 56, 150, 1.8, 0.4);
      glove(ctx, 264, 150, 1.8, -0.4);
    } else if (from === 57.8 && t >= RETURN) {
      const a = t * 9;
      glove(ctx, 70 + Math.cos(a) * 18, 120 + Math.sin(a) * 18, 1.7, 0.3);
      glove(ctx, 250 + Math.cos(-a) * 18, 120 + Math.sin(-a) * 18, 1.7, -0.3);
    } else if (from === CHASE_CUT) {
      const a = t * 12;
      glove(ctx, 60 + Math.cos(a) * 26, 110 + Math.sin(a) * 30, 1.7, a);
      glove(ctx, 260 + Math.cos(-a + 1) * 26, 110 + Math.sin(-a + 1) * 30, 1.7, -a);
    } else if (from === ENCORE) {
      // The baton comes up, wasp and all.
      const up = ease(span(t, ENCORE, ENCORE + 0.35));
      const bx = 262,
        by = lerp(210, 120, up) + (t >= ENCORE_PLAY ? Math.sin((t - ENCORE_PLAY) * 21) * 6 : 0);
      line(ctx, WHITE, 2.4, [bx, by, bx - 26, by - 52]);
      glove(ctx, bx + 2, by + 6, 1.8, -0.4);
      wasp(ctx, bx - 27, by - 56, 10, seconds, { still: true, face: -1 });
    }
    // The wasp at work.
    if (from === 25.5 || from === 31.0 || from === CHASE_CUT)
      waspFlying(ctx, t, from, seconds, 9, { dot: 2, gap: 0.05 });
    if (from === 57.8) {
      if (t < LIFT)
        wasp(ctx, BROW_SPOT[0], BROW_SPOT[1] - 3, 7, seconds, { still: true, face: -1 });
      else waspFlying(ctx, t, from, seconds, 9, { dot: 2, gap: 0.05 });
    }
  });
}
/** The extreme close-up on his nose: the landing, and the stroll up to his brow. */
function noseShot(ctx: Ctx, t: number, seconds: number, from: number) {
  const landing = from < 46;
  const face: MFace = {
    eyes: landing && t < LAND_NOSE + 0.1 ? 'wide' : 'cross',
    brows: [-1, -1],
    raise: [1, 1],
    mouth: 'o',
    flush: landing ? 0 : 0.4,
  };
  const view = landing
    ? track(t, [
        [45.7, 163, 104, 2.6],
        [46.8, 163, 106, 2.75],
      ])
    : track(t, [
        [51.4, 163, 104, 2.6],
        [52.2, 162, 96, 2.7],
      ]);
  camera(ctx, view, () => {
    cuBackdrop(ctx, seconds);
    maestroFace(ctx, CU_FACE[0], CU_FACE[1], CU_SCALE, face);
    if (landing) {
      if (t < LAND_NOSE) waspFlying(ctx, t, from, seconds, 7, { dot: 0.8, gap: 0.04 });
      else wasp(ctx, NOSE[0], NOSE[1] - 2.5, 7, seconds, { still: true, face: -1, tilt: -0.9 });
    } else {
      const u = ease(span(t, 51.5, 52.15));
      const p = blend(NOSE, BROW_SPOT, u);
      wasp(ctx, p[0] + Math.sin(t * 30) * 0.15, p[1] - 2.5, 7, seconds, {
        still: true,
        face: -1,
        tilt: -1.4,
      });
    }
  });
}

// ——— Shot: one player's close-up ———
function playerCU(ctx: Ctx, who: Player, t: number, seconds: number, from: number, to: number) {
  // Behind the band: the river, glinting, and a white post.
  sky(ctx, [SKY_A, SKY_B], 0, 80);
  for (let i = 0; i < 7; i++) disc(ctx, i * 54, 76, 26, alpha(i % 2 ? TREE : TREE_D, 0.75));
  box(ctx, 0, 84, W, 40, mix(RIVER, SKY_B, 0.2));
  for (let i = 0; i < 8; i++) {
    const gx = ((rand(i * 4.1) * 340 + seconds * 6) % 330) - 5;
    box(ctx, gx, 92 + (i % 4) * 7, 10, 1.5, alpha(WHITE, 0.6));
  }
  box(ctx, 0, 124, W, 56, DECK);
  box(ctx, 250, 0, 16, 180, alpha(STAND, 0.9));
  box(ctx, 0, 0, W, 10, ROOF);
  for (let x = 6; x < W; x += 12) disc(ctx, x, 10, 4.5, '#F6F1EA');
  const st = bandMood(who, t);
  const mood: Mood = { ...st.mood, turn: -0.25 };
  camera(
    ctx,
    track(t, [
      [from, 160, 92, 1],
      [to, 160, 92, 1.12],
    ]),
    () => {
      const hx = 168,
        hy = 84,
        s = 2.35;
      const c = CAST[who];
      // Shoulders.
      poly(ctx, JACKET, [
        hx - 70,
        190,
        hx - 58,
        140,
        hx - 22,
        124,
        hx + 22,
        124,
        hx + 58,
        140,
        hx + 70,
        190,
      ]);
      box(ctx, hx - 30, 128, 18, 6, PIPING);
      box(ctx, hx + 12, 128, 18, 6, PIPING);
      box(ctx, hx - 12, 116, 24, 12, mix(c.skin, INK, 0.12));
      box(ctx, hx - 14, 124, 28, 6, PIPING);
      if (who === 'horace') {
        // The tuba bell rising at his shoulder.
        poly(ctx, BRASS, [hx + 40, 190, hx + 70, 190, hx + 82, 30, hx + 46, 30]);
        oval(ctx, hx + 64, 26, 34, 10, BRASS_L);
        oval(ctx, hx + 64, 27, 29, 7.5, BRASS_D);
      }
      head(ctx, who, hx, hy, s, mood);
      // The instrument at the lips.
      const my = hy + c.ry * 0.58 * s;
      const mx = hx + (mood.turn ?? 0) * c.rx * 0.32 * s;
      const dy = (1 - (st.up ?? 1)) * 40;
      if (who === 'trumpet') {
        line(ctx, BRASS, 7, [mx - 6, my + dy, mx - 100, my + dy]);
        for (let i = 0; i < 3; i++) box(ctx, mx - 70 + i * 9, my - 14 + dy, 6, 12, BRASS_L);
        poly(ctx, BRASS, [
          mx - 96,
          my - 4 + dy,
          mx - 140,
          my - 30 + dy,
          mx - 140,
          my + 30 + dy,
          mx - 96,
          my + 4 + dy,
        ]);
        oval(ctx, mx - 140, my + dy, 5, 30, BRASS_L);
        glove(ctx, mx - 62, my + 12 + dy, 2.2, 0.3, false);
      } else if (who === 'clarinet') {
        ctx.save();
        ctx.translate(mx, my + dy);
        ctx.rotate(0.35 + dy * 0.01);
        box(ctx, -5, 0, 10, 110, '#1C1A20');
        for (let i = 0; i < 5; i++) disc(ctx, 0, 18 + i * 16, 2.4, '#C8CCD4');
        ctx.restore();
      } else if (who === 'trombone') {
        const wob =
          st.up === 1 && t < DROPS[2] ? Math.sin(t * 24) * (0.03 + span(t, 52.2, 53) * 0.08) : 0;
        ctx.save();
        ctx.translate(mx - 4, my + dy);
        ctx.rotate(wob + dy * 0.012);
        line(ctx, BRASS, 4, [0, -4, -200, -4]);
        line(ctx, BRASS, 4, [0, 6, -200, 6]);
        line(ctx, BRASS, 4, [-60, -4, -64, -30, -86, -32]);
        poly(ctx, BRASS, [-84, -36, -136, -62, -136, 2, -84, -26]);
        oval(ctx, -136, -30, 5, 32, BRASS_L);
        ctx.restore();
      } else if (who === 'horace')
        line(ctx, BRASS, 7, [mx, my + 4 + dy, mx + 6, my + 60, mx + 30, 190]);
      if (who === 'cymbals') {
        // Flung wide on a crash, held out, and pressed together edge-on in front of his chest.
        const k = st.crash ?? 0;
        for (const sd of [-1, 1]) {
          const cx = hx + sd * lerp(12, 104, k),
            cy = lerp(hy + 82, hy + 58, k);
          line(ctx, JACKET, 15, [hx + sd * 50, 150, (hx + sd * 50 + cx) / 2, cy + 22, cx, cy + 6]);
          disc(ctx, cx, cy + 6, 7, CAST.cymbals.skin);
          oval(ctx, cx, cy, lerp(9, 30, k), 34, BRASS);
          ring(ctx, cx, cy, lerp(6, 22, k), 25, alpha(BRASS_L, 0.8), 2.4);
          oval(ctx, cx, cy, lerp(3, 9, k), 10, BRASS_D);
        }
      } else oval(ctx, mx, my + dy * 0.2, 5, 4, who === 'clarinet' ? '#1C1A20' : BRASS_L);
      // The breath he takes for the note of his life.
      if (who === 'horace' && t >= INHALE && t < LAUNCH)
        for (let i = 0; i < 3; i++) {
          const k = ((t - INHALE) * 1.6 + i / 3) % 1;
          line(ctx, alpha(WHITE, 0.8 * (1 - k)), 2, [
            hx - 110 + k * 40,
            60 + i * 20,
            hx - 90 + k * 40,
            60 + i * 20,
          ]);
        }
    },
  );
}

// ——— Shot: the notebook ———
function bookShot(ctx: Ctx, t: number, closing: boolean) {
  // The stand's wooden desk fills the frame.
  box(ctx, 0, 0, W, H, '#C9A57A');
  for (let k = 0; k < 7; k++)
    line(ctx, alpha('#B08C60', 0.7), 1.4, [0, 12 + k * 26, W, 18 + k * 26]);
  box(ctx, 0, 158, W, 22, '#8E6A44');
  // He shuts it, rests his hand on it for a moment, and tosses it over his shoulder; the cut
  // comes while it is still in the air.
  const close = closing ? ease(span(t, BOOK_CUT + 0.1, BOOK_SHUT)) : 0;
  const fly = closing ? easeIn(span(t, BOOK_TOSS, BOOK_TOSS + 0.6)) : 0;
  ctx.save();
  ctx.translate(fly * -80, fly * -260);
  ctx.rotate(-fly * 0.8);
  // The black cover under the pages.
  box(ctx, 52 + close * 108, 22, 216 - close * 108, 140, '#1C1A20');
  // Left page: a doodle of a tuba, in pencil.
  if (close < 1) {
    box(ctx, 58, 28, 100, 128, PAPER);
    for (let k = 0; k < 9; k++) box(ctx, 64, 40 + k * 13, 88, 0.8, alpha('#9FB8D0', 0.6));
    ring(ctx, 100, 104, 22, 22, '#5A5A66', 1.2);
    ring(ctx, 100, 104, 12, 12, '#5A5A66', 1);
    line(ctx, '#5A5A66', 1.2, [114, 88, 124, 50, 140, 44]);
    line(ctx, '#5A5A66', 1.2, [104, 84, 112, 50, 120, 46]);
    ring(ctx, 130, 45, 11, 4, '#5A5A66', 1.2);
    for (let k = 0; k < 3; k++) box(ctx, 88 + k * 6, 74, 3, 8, '#5A5A66');
    // Two little cross eyes and a frown, drawn on its bell.
    line(ctx, '#5A5A66', 1, [124, 46, 130, 44, 136, 46]);
  }
  // Right page: rows of tally marks, Horace's late entries, and today's.
  const pageW = 100 * Math.cos(Math.PI * close);
  if (Math.abs(pageW) > 1) {
    ctx.save();
    ctx.translate(160, 0);
    ctx.scale(pageW / 100, 1);
    box(ctx, 2, 28, 100, 128, close < 0.5 ? PAPER : '#1C1A20');
    if (close < 0.5) {
      for (let k = 0; k < 9; k++) box(ctx, 8, 40 + k * 13, 88, 0.8, alpha('#9FB8D0', 0.6));
      for (let r = 0; r < 6; r++) {
        const groups = r < 5 ? 4 : 3;
        for (let g = 0; g < groups; g++) {
          const gx = 12 + g * 22,
            gy = 36 + r * 19;
          for (let k = 0; k < 4; k++)
            line(ctx, '#3A3A46', 1.3, [gx + k * 4, gy, gx + k * 4 - 1, gy + 13]);
          if (r < 5 || g < 2) line(ctx, '#3A3A46', 1.3, [gx - 3, gy + 11, gx + 15, gy + 2]);
        }
      }
      // Today's: the pencil adds one more.
      const draw = closing ? 1 : ease(span(t, SCRIBBLE, SCRIBBLE + 0.35));
      if (draw > 0) line(ctx, '#3A3A46', 1.5, [53, 142, 53 + draw * 18, 142 - draw * 9]);
    }
    ctx.restore();
  }
  box(ctx, 156, 20, 8, 8, BRASS);
  box(ctx, 154, 26, 12, 4, BRASS_D);
  ctx.restore();
  // The gloved hand: a pencil at the tally, then shutting the book and tossing it.
  if (!closing) {
    const draw = ease(span(t, SCRIBBLE, SCRIBBLE + 0.35));
    const px = 213 + draw * 18,
      py = 142 - draw * 9;
    const away = ease(span(t, 10.6, 11.2));
    ctx.save();
    ctx.translate(away * 70, away * 60);
    line(ctx, '#F2C94C', 4, [px, py, px + 40, py + 34]);
    line(ctx, '#3A3A46', 1.4, [px, py, px + 4, py + 3.4]);
    box(ctx, px + 38, py + 32, 6, 6, '#F08A9A');
    glove(ctx, px + 34, py + 36, 2.2, -0.8);
    ctx.restore();
  } else if (fly < 1)
    glove(ctx, lerp(270, 130, close) - fly * 80, 100 - fly * 260, 2.4, -0.4 - close * 0.4);
}

// ——— Shot: the jam sandwich ———
function sandwichShot(ctx: Ctx, t: number, seconds: number) {
  camera(
    ctx,
    track(t, [
      [22, 160, 90, 1],
      [23, 150, 90, 1.08],
    ]),
    () => {
      const bg = mix(GRASS, SKY_B, 0.3);
      box(ctx, 0, 0, W, H, bg);
      box(ctx, 0, 0, W, 34, mix(SKY_A, SKY_B, 0.4));
      for (let i = 0; i < 5; i++) disc(ctx, i * 70 + 10, 28, 18, mix(TREE, SKY_B, 0.45));
      box(ctx, 0, 40, W, 140, bg);
      // His deckchair behind him.
      for (let i = 0; i < 5; i++)
        box(ctx, 190 + i * 26, 20, 13, 160, mix(i % 2 ? '#FBF6EE' : STRIPES[0], bg, 0.35));
      // The boy leans away, holding it as far out as his arm will go.
      poly(ctx, '#F2C94C', [200, 190, 214, 150, 250, 138, 300, 138, 324, 160, 324, 190]);
      head(ctx, 'boy', 266, 92, 2.5, {
        eyes: 'wide',
        look: [-1, 0.1],
        mouth: 'wobble',
        brows: -1,
        raise: 1,
        jam: true,
        turn: -0.3,
        tilt: 0.2,
      });
      line(ctx, '#F2C94C', 20, [232, 160, 192, 150]);
      line(ctx, CAST.boy.skin, 12, [192, 150, 140, 138]);
      // The sandwich: a slice of white bread with a bite out of it, and jam in the bite.
      const slice = [62, 136, 62, 82, 70, 68, 84, 60, 102, 58, 120, 60, 134, 68, 140, 82, 140, 136];
      poly(ctx, CRUST, slice);
      poly(
        ctx,
        BREAD,
        [67, 131, 67, 84, 74, 72, 86, 65, 102, 63, 118, 65, 130, 72, 135, 84, 135, 131],
      );
      for (let i = 0; i < 6; i++)
        box(ctx, 76 + rand(i * 3.1) * 50, 84 + rand(i * 5.3) * 40, 2, 2, alpha(CRUST, 0.35));
      const bite = [
        [128, 66, 11],
        [139, 79, 10],
        [118, 58, 8],
      ] as const;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < slice.length; i += 2)
        if (i) ctx.lineTo(slice[i], slice[i + 1]);
        else ctx.moveTo(slice[i], slice[i + 1]);
      ctx.clip();
      for (const [bx, by, r] of bite) disc(ctx, bx, by, r + 3.5, JAM);
      for (const [bx, by, r] of bite) disc(ctx, bx, by, r, bg);
      ctx.restore();
      oval(ctx, 112, 92, 4, 7, alpha(JAM, 0.9));
      // Fingers round the bottom of the slice.
      disc(ctx, 140, 134, 11, CAST.boy.skin);
      for (let i = 0; i < 3; i++) oval(ctx, 118 + i * 9, 132, 4.4, 7, CAST.boy.skin);
      wasp(ctx, 120 + Math.sin(t * 5) * 1.2, 74, 26, seconds, {
        still: true,
        face: -1,
        tilt: 0.35,
        clean: hump(t, 22.3, 22.85),
      });
    },
  );
}

// ——— Shot: the tuba launch ———
function bellShot(ctx: Ctx, t: number, seconds: number, from: number) {
  camera(
    ctx,
    track(t, [
      [72.3, 160, 96, 1.05],
      [LAUNCH, 160, 96, 1.05],
      [74.2, 160, 80, 1],
    ]),
    () => {
      sky(ctx, [SKY_HI, SKY_A, SKY_B], 0, 120);
      cloud(ctx, 250, 30, 1.2);
      box(ctx, 0, 0, W, 10, ROOF);
      for (let x = 6; x < W; x += 12) disc(ctx, x, 10, 4.5, '#F6F1EA');
      box(ctx, 0, 120, W, 60, DECK);
      // The bell, huge and gold.
      const shake =
        t < LAUNCH ? Math.sin(t * 50) * 1.5 : Math.exp(-(t - LAUNCH) * 5) * Math.sin(t * 40) * 3;
      const [bx, by] = [BELL_OPEN[0] + shake, BELL_OPEN[1]];
      poly(ctx, BRASS, [bx - 46, by, bx + 46, by, BELL_OPEN[0] + 18, 130, BELL_OPEN[0] - 18, 130]);
      poly(ctx, BRASS_D, [
        bx + 20,
        by + 4,
        bx + 46,
        by,
        BELL_OPEN[0] + 18,
        130,
        BELL_OPEN[0] + 8,
        130,
      ]);
      oval(ctx, bx, by, 46, 12, BRASS_L);
      oval(ctx, bx, by + 1, 40, 9, BRASS_D);
      oval(ctx, bx, by + 2.5, 30, 6, '#5E4314');
      box(ctx, BELL_OPEN[0] - 18, 130, 36, 50, BRASS);
      // Horace, blowing the note of his life.
      poly(ctx, JACKET, [170, 190, 186, 140, 236, 126, 286, 140, 300, 190]);
      head(ctx, 'horace', 236, 92, 1.9, { ...bandMood('horace', t).mood, turn: -0.5 });
      line(ctx, BRASS, 6, [206, 112, 160, 128, BELL_OPEN[0] + 18, 140]);
      // The pop: rings of air from the bell, and the wasp shot out like a cork.
      if (t >= LAUNCH) {
        const k = t - LAUNCH;
        for (let i = 0; i < 3; i++) {
          const r = (k - i * 0.12) * 120;
          if (r > 0 && r < 120)
            ring(
              ctx,
              BELL_OPEN[0],
              BELL_OPEN[1] - r * 0.3,
              30 + r * 0.6,
              6 + r * 0.15,
              alpha(WHITE, 0.7 * (1 - r / 120)),
              2,
            );
        }
        for (let i = 0; i < 4; i++)
          line(ctx, alpha(WHITE, 0.8 * Math.max(0, 1 - k * 2)), 1.6, [
            BELL_OPEN[0] - 30 + i * 20,
            BELL_OPEN[1] - 10,
            BELL_OPEN[0] - 36 + i * 24,
            BELL_OPEN[1] - 34 - k * 40,
          ]);
        if (t < 73.2)
          waspFlying(ctx, t, from, seconds, 12, { dot: 3, gap: 0.03, dots: 8, tumble: k * 20 });
      }
    },
  );
}

// ——— Shot: slow motion, high over the lawn ———
function flightShot(ctx: Ctx, t: number, seconds: number, from: number) {
  sky(ctx, [SKY_HI, SKY_A, SKY_B], 0, H);
  glow(ctx, 40, 10, 90, '#FFF6D0', 0.55);
  cloud(ctx, 90 + seconds * 2, 120, 1.6);
  cloud(ctx, 250 - seconds * 1.5, 70, 1.2);
  // The bandstand roof's corner, top right, with its bunting.
  poly(ctx, ROOF, [320, 0, 236, 0, 320, 46]);
  poly(ctx, '#F6F1EA', [320, 0, 268, 0, 320, 28]);
  poly(ctx, ROOF, [320, 0, 292, 0, 320, 14]);
  bunting(ctx, 240, 4, 330, 52, 4, seconds, 1.6);
  // The wasp, tumbling, with a long dotted trail.
  waspFlying(ctx, t, from, seconds, 11, { dots: 14, dot: 2, gap: 0.09, tumble: (t - 76) * 3.2 });
  // Faces from below, all turned up to follow it.
  const [wx] = waspPos(t);
  const folk: readonly (readonly [Who, number, number, number])[] = [
    ['grandad', 30, 158, 1.5],
    ['lady', 94, 164, 1.6],
    ['boy', 160, 156, 1.45],
    ['man', 226, 164, 1.6],
    ['mum', 292, 160, 1.5],
  ];
  // Shoulders first, so the faces sit on bodies.
  for (const [who, x, y, s] of folk)
    oval(ctx, x, y + 34 * s, 30 * s, 16 * s, who === 'boy' ? '#F2C94C' : STRIPES[(x >> 4) % 4]);
  for (const [who, x, y, s] of folk) {
    const dx = clamp((wx - x) / 120, -1, 1);
    head(ctx, who, x, y, s, {
      eyes: 'wide',
      look: [dx, -1],
      mouth: 'o',
      raise: 1,
      turn: dx * 0.6,
      tilt: dx * 0.15,
      jam: who === 'boy',
    });
  }
}

// ——— Shot: the wasp on the baton tip ———
function tipShot(ctx: Ctx, t: number, seconds: number) {
  camera(
    ctx,
    track(t, [
      [82, 160, 90, 1],
      [84, 170, 86, 1.1],
    ]),
    () => {
      cuBackdrop(ctx, seconds);
      // Behind it, out of focus: the Maestro, hair sprung, eyes crossed on the wasp.
      maestroFace(ctx, 232, 150, 2.9, {
        eyes: 'cross',
        brows: [-1, -1],
        raise: [1, 1],
        mouth: 'gape',
        hair: 2,
        tie: 0.55,
      });
      veil(ctx, '#DCE8EE', 0.32);
      // The baton, sharp.
      line(ctx, '#C9CBD3', 7, [-10, 196, 190, 86]);
      line(ctx, WHITE, 5, [-10, 196, 190, 86]);
      line(ctx, '#D8B98A', 9, [-10, 196, 20, 179]);
      glove(ctx, 6, 186, 3.2, 0.9);
      wasp(ctx, 196, 76, 36, seconds, { still: true, face: -1, clean: t < 83.6 ? 1 : 0 });
    },
  );
}

// ——— Shot: next Sunday's sign ———
function signShot(ctx: Ctx, t: number, seconds: number) {
  camera(
    ctx,
    track(t, [
      [NEXT_SUNDAY, 160, 92, 1],
      [98.5, 160, 90, 1.08],
    ]),
    () => {
      sky(ctx, [SKY_A, SKY_B], 0, 40);
      // Behind the board: the bandstand's white skirt, the bunting.
      box(ctx, 0, 30, W, 70, STAND);
      for (let x = -10; x < W; x += 16) line(ctx, STAND_D, 1.4, [x, 36, x + 12, 96]);
      box(ctx, 0, 26, W, 6, ROOF);
      bunting(ctx, -6, 30, W + 6, 30, 8, seconds, 2);
      box(ctx, 0, 100, W, 80, GRASS);
      box(ctx, 0, 110, W, 12, alpha(GRASS_L, 0.5));
      // The A-board.
      line(ctx, WOOD_D, 5, [70, 40, 56, 176]);
      line(ctx, WOOD_D, 5, [250, 40, 264, 176]);
      box(ctx, 50, 26, 220, 132, WOOD);
      box(ctx, 58, 33, 204, 118, BOARD);
      for (let i = 0; i < 6; i++)
        box(ctx, 70 + i * 32, 40 + (i % 3) * 30, 20, 2, alpha(CHALK, 0.06));
      write(ctx, 'BY POPULAR DEMAND', 160, 66, { size: 12, color: CHALK });
      line(ctx, alpha(PIPING, 0.9), 1.4, [88, 74, 232, 74]);
      write(ctx, 'THE WASP CONCERTO', 160, 104, { size: 17, color: CHALK, type: 'serif' });
      // A chalk wasp, and its dotted trail.
      for (let i = 0; i < 7; i++)
        box(ctx, 120 + i * 9, 132 - Math.sin(i * 0.8) * 6, 2, 2, alpha(CHALK, 0.8));
      oval(ctx, 190, 128, 7, 4.5, alpha(PIPING, 0.95));
      line(ctx, BOARD, 1.4, [188, 124, 188, 132]);
      line(ctx, BOARD, 1.4, [192, 124, 192, 132]);
      disc(ctx, 199, 127, 3, alpha(CHALK, 0.9));
      oval(ctx, 188, 121, 4, 2.4, alpha(CHALK, 0.6), -0.4);
    },
  );
}

// ——— Shot: the final tableau, from the side aisle ———
function maestroSide(ctx: Ctx, x: number, y: number, s: number, t: number, tt: number) {
  const raise = ease(span(tt, LAST_RAISE, LAST_RAISE + 0.45));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Tails behind, legs, shoes pointing right.
  poly(ctx, TAILS_L, [-6, -24, 2, -24, -4, -2, -12, -4]);
  line(ctx, TAILS, 5, [-1, -24, -2, -2]);
  line(ctx, TAILS, 5, [3, -24, 4, -2]);
  box(ctx, -4, -3, 8, 3, '#111014');
  box(ctx, 2, -3, 8, 3, '#111014');
  // Torso, white shirtfront at the chest, bow tie.
  poly(ctx, TAILS, [-7, -46, 8, -46, 7, -22, -6, -22]);
  poly(ctx, WHITE, [5, -45, 9, -45, 8, -30, 5, -32]);
  poly(ctx, WHITE, [8, -46, 11, -48, 11, -44]);
  // Head in profile: the hawk nose, the bushy brow, the mane swept back.
  const hy = -55;
  box(ctx, -1, -49, 6, 4, PALE_D);
  poly(ctx, SILVER, [
    4,
    hy - 6,
    0,
    hy - 8,
    -6,
    hy - 7,
    -10,
    hy - 2,
    -11,
    hy + 5,
    -6,
    hy + 3,
    -3,
    hy - 2,
  ]);
  oval(ctx, 2, hy, 6.4, 7.2, PALE);
  // The beekeeper's hat and a light mesh veil; his profile shows through it.
  oval(ctx, 1, hy - 7, 13, 2.4, '#F6F4EE');
  oval(ctx, 1, hy - 9.5, 6.5, 4, '#F6F4EE');
  poly(ctx, alpha(WHITE, 0.26), [-11, hy - 6, 15, hy - 6, 13, hy + 9, -9, hy + 9]);
  for (let i = 0; i < 5; i++)
    line(ctx, alpha(WHITE, 0.3), 0.4, [-9 + i * 5.8, hy - 6, -8 + i * 5.4, hy + 9]);
  poly(ctx, mix(PALE, PALE_D, 0.55), [7, hy - 3.4, 12.8, hy + 2.6, 11.2, hy + 4, 7.4, hy + 3.2]);
  line(ctx, '#B98E78', 0.7, [7.4, hy - 3.2, 12.8, hy + 2.6, 11.2, hy + 4, 8.6, hy + 3.4]);
  oval(ctx, 9.6, hy + 3, 0.9, 0.6, alpha(INK, 0.5));
  poly(ctx, BROW, [
    3.4,
    hy - 3.4 - raise * 1.4,
    9,
    hy - 3 - raise * 1.8,
    9,
    hy - 1.6 - raise * 1.8,
    3.4,
    hy - 2 - raise * 1.4,
  ]);
  box(ctx, 6.4, hy - 1, 1.4, 1.6, INK);
  line(ctx, INK, 0.8, [6.4, hy + 5.2, 9, hy + 4.8 - raise * 0.8]);
  // Arms: at the jar, then the baton raised.
  if (t < LAST_RAISE) {
    const twist = Math.sin(t * 14);
    line(ctx, TAILS, 4, [-1, -42, 8, -30, 20, -28]);
    disc(ctx, 20, -28, 2.4, WHITE);
    line(ctx, TAILS, 4, [2, -42, 12, -34, 22, -32 + twist]);
    disc(ctx, 22, -32 + twist, 2.4, WHITE);
  } else {
    const hx = lerp(18, 16, raise),
      hy2 = lerp(-30, -66, raise);
    line(ctx, TAILS, 4, [2, -42, 12, lerp(-34, -54, raise), hx, hy2]);
    disc(ctx, hx, hy2, 2.4, WHITE);
    line(ctx, WHITE, 1.3, [hx, hy2, hx + lerp(10, 9, raise), hy2 - lerp(2, 14, raise)]);
  }
  ctx.restore();
}
function tableauShot(ctx: Ctx, t: number, seconds: number) {
  // Under the end card the story is over, but the approaching wasp keeps coming.
  const tt = Math.max(t, seconds - 3);
  sky(ctx, [SKY_A, SKY_B], 0, 64);
  cloud(ctx, 60 + seconds * 1.5, 22, 1);
  for (let i = 0; i < 12; i++) disc(ctx, i * 30 + 6, 60 - (i % 3) * 3, 14, i % 2 ? TREE : TREE_D);
  box(ctx, 0, 62, W, 118, GRASS);
  box(ctx, 0, 74, W, 10, alpha(GRASS_L, 0.5));
  // The packed lawn behind him, everyone facing the bandstand (to the right); standing at the back.
  for (let r = 0; r < 4; r++)
    for (let i = 0; i < 7 - r; i++) {
      const rad = 3 + r * 1.3;
      const x = 6 + i * (rad * 5.2) + (r % 2) * rad * 2,
        y = 82 + r * 17 + r * r * 2;
      if (x > 104) continue;
      const standing = r === 0 || (r === 1 && i % 2 === 0);
      if (standing) box(ctx, x - rad, y - rad * 0.2, rad * 2, rad * 3, STRIPES[(i + 2) % 4]);
      else {
        box(ctx, x - rad * 1.7, y - rad * 0.4, rad * 3.2, rad * 2.6, STRIPES[(i + r) % 4]);
        box(ctx, x - rad * 0.5, y - rad * 0.4, rad, rad * 2.6, '#FBF6EE');
      }
      const hy = y - rad * (standing ? 1.4 : 1.1);
      disc(ctx, x + rad * 0.3, hy, rad, SKINS[(i + r) % 4]);
      oval(ctx, x - rad * 0.15, hy - rad * 0.45, rad * 0.9, rad * 0.6, HAIRS[(i + r * 2) % 4]);
      box(ctx, x + rad * 0.85, hy - rad * 0.15, 1, 1, INK);
      if ((i + r) % 3 === 0) {
        oval(ctx, x + rad * 0.2, hy - rad * 0.75, rad * 1.5, rad * 0.32, '#F6F4EE');
        poly(ctx, alpha(WHITE, 0.4), [
          x - rad * 1.1,
          hy - rad * 0.7,
          x + rad * 1.5,
          hy - rad * 0.7,
          x + rad * 1.3,
          hy + rad,
          x - rad,
          hy + rad,
        ]);
      }
    }
  // The bandstand from the side: roof edge, posts, deck.
  poly(ctx, ROOF, [70, 18, 330, 18, 330, 0, 104, 0]);
  for (let k = 0; k < 7; k++)
    poly(ctx, '#F6F1EA', [118 + k * 32, 0, 132 + k * 32, 0, 126 + k * 32, 18, 112 + k * 32, 18]);
  for (let x = 72; x < W; x += 8) disc(ctx, x, 19, 3, '#F6F1EA');
  bunting(ctx, 76, 24, 330, 24, 5, seconds, 1.3);
  box(ctx, 84, 16, 7, 138, STAND);
  box(ctx, 88, 16, 3, 138, STAND_D);
  box(ctx, 306, 16, 7, 138, STAND);
  box(ctx, 80, 148, 240, 9, DECK);
  box(ctx, 80, 156, 240, 24, STAND_D);
  for (let x = 84; x < W; x += 10) line(ctx, alpha(STAND, 0.9), 1.2, [x, 158, x + 8, 180]);
  // The band beyond him, in veils, grinning.
  const veiled: readonly (readonly [Player, number, number])[] = [
    ['horace', 238, 150],
    ['trumpet', 272, 146],
    ['trombone', 300, 150],
  ];
  for (const [who, x, y] of veiled) {
    poly(ctx, JACKET, [x - 15, y, x - 13, y - 26, x + 13, y - 26, x + 15, y]);
    box(ctx, x - 13, y - 27, 26, 2.5, PIPING);
    if (who === 'horace') {
      poly(ctx, BRASS, [x + 8, y - 8, x + 15, y - 8, x + 20, y - 62, x + 4, y - 62]);
      oval(ctx, x + 12, y - 64, 13, 3.8, BRASS_L);
      oval(ctx, x + 12, y - 64, 10.5, 2.6, BRASS_D);
      oval(ctx, x - 2, y - 10, 11, 10, BRASS);
    }
    head(ctx, who, x, y - 40, 0.62, { eyes: 'happy', mouth: 'grin', veil: 1, turn: -0.5 });
  }
  // Music stand with the jam jar; the lid comes off and is set aside.
  line(ctx, '#3A3540', 2, [176, 102, 176, 148]);
  line(ctx, '#3A3540', 1.4, [168, 148, 176, 142, 184, 148]);
  box(ctx, 158, 99, 36, 4, '#3A3540');
  box(ctx, 158, 98, 36, 1.5, '#57505E');
  box(ctx, 163, 82, 14, 17, alpha('#CFE8F2', 0.75));
  box(ctx, 164, 87, 12, 11, JAM);
  box(ctx, 165, 84, 2, 13, alpha(WHITE, 0.6));
  const lid = ease(span(t, 101.75, LAST_RAISE));
  ctx.save();
  ctx.translate(lerp(170, 187, lid), lerp(81, 96.5, lid) - hump(t, 101.75, LAST_RAISE) * 8);
  ctx.rotate((t < 101.75 ? Math.sin(t * 14) * 0.15 : 0) + lid * 0.15);
  box(ctx, -8, -2, 16, 4, '#D2423F');
  for (let k = 0; k < 4; k++) box(ctx, -7 + k * 4, -2, 2, 4, WHITE);
  ctx.restore();
  // Podium and the Maestro in profile.
  box(ctx, 98, 140, 40, 9, WOOD);
  box(ctx, 98, 140, 40, 2, mix(WOOD, WHITE, 0.25));
  maestroSide(ctx, 120, 141, 1.7, t, tt);
  // One more wasp, coming in from the left, heading for the jam.
  if (tt >= LAST_RAISE - 0.3) waspFlying(ctx, tt, JAR, seconds, 5, { dot: 1.5, gap: 0.09 });
}

// ——— The score ———
const ROOT = 58; // B-flat
const CHORDS = [0, 5, 7, 0] as const;
/** The march, one note per beat: stiff, square, and the same tune at every tempo. */
const MARCH: readonly (number | null)[] = [
  12,
  12,
  16,
  19,
  17,
  17,
  21,
  17,
  19,
  17,
  16,
  14,
  12,
  7,
  12,
  null,
];
type Band = {
  from: number;
  to: number;
  bpm: number;
  level: (s: number) => number;
  tune?: number;
  drums?: 'march' | 'drive';
  pad?: boolean;
};
/** The brass band, in story seconds: oom on the beat, pah off it, the tune on top, a side drum. */
function band(s: Score, b: Band) {
  const beat = 60 / b.bpm;
  for (let i = 0; ; i++) {
    const t = b.from + i * beat;
    if (t >= b.to - 0.03) break;
    const g = b.level(t);
    if (g <= 0.01) continue;
    const k = i % 4;
    const chord = ROOT + CHORDS[Math.floor(i / 4) % 4];
    const len = (x: number) => Math.min(x, b.to - t);
    if (k % 2 === 0) s.note(at(t), chord - 12, len(beat * 0.8), 'bass', 0.11 * g, -0.25);
    else
      for (const d of [4, 7, 12]) s.note(at(t), chord + d, len(beat * 0.4), 'lead', 0.022 * g, 0.3);
    if (b.pad !== false && k === 0)
      for (const d of [0, 4, 7])
        s.note(at(t), chord + d, len(beat * 3.8), 'pad', 0.018 * g, d ? 0.35 : -0.35);
    if (b.drums === 'drive') {
      s.note(at(t), 36, 0.18, 'kick', 0.055 * g);
      if (k % 2) s.note(at(t), 36, 0.14, 'snare', 0.045 * g);
      if (t + beat / 2 < b.to) s.note(at(t + beat / 2), 80, 0.05, 'hat', 0.022 * g, 0.3);
    } else {
      s.note(at(t), 36, 0.12, k % 2 ? 'snare' : 'kick', 0.045 * g);
      if (k === 3 && t + beat / 2 < b.to) s.note(at(t + beat / 2), 36, 0.1, 'snare', 0.03 * g);
    }
    const d = MARCH[i % MARCH.length];
    if (d !== null)
      s.note(
        at(t),
        ROOT + d,
        len(beat * 0.82),
        'lead',
        0.075 * g * (b.tune ?? 1),
        Math.sin(i * 0.7) * 0.2,
      );
  }
}
/** The wasp's buzz, read from its path: short whirs along each flight, panned by its x. */
function buzz(s: Score) {
  for (let i = 0; i < WASP.length - 1; i++) {
    const a = WASP[i],
      b = WASP[i + 1];
    if (b[0] <= a[0] || a[0] >= JAR) continue;
    if (Math.hypot(b[1] - a[1], b[2] - a[2]) <= 1) continue;
    const kind = shotAt((a[0] + b[0]) / 2).kind;
    // Loudest in its close-ups; quiet in the wides, and off screen (circling, unseen) quieter still.
    const unseen = kind === 'cymbals' || (kind === 'front' && a[0] > 30);
    const gain =
      kind === 'lawn' || kind === 'flight' ? 0.05 : kind === 'ots' ? 0.065 : unseen ? 0.045 : 0.08;
    const length = b[0] - a[0];
    const n = Math.max(1, Math.ceil(length / 0.8));
    for (let k = 0; k < n; k++) {
      const from = a[0] + (k * length) / n,
        len = Math.max(0.3, length / n);
      const x = waspPos(from + len / 2)[0];
      s.fx('whir', at(from), len, gain, clamp(x / 160 - 1, -1, 1));
    }
  }
}

export const theWaspConcertoScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: ROOT, voice: 'lead', intro: [0, 4, 7, 12], outro: [0, 4, 7, 12] },
    (s) => {
      const fx = (
        kind: Parameters<Score['fx']>[0],
        sec: number,
        len: number,
        gain: number,
        pan = 0,
      ) => s.fx(kind, at(sec), len, gain, pan);
      const note = (sec: number, pitch: number, len: number, voice: Voice, gain: number, pan = 0) =>
        s.note(at(sec), pitch, len, voice, gain, pan);
      // The air on the green under everything, and the lawn murmuring before the downbeat.
      fx('wind', 0, STORY, 0.045);
      fx('crowd', 0, DOWNBEAT - 0.3, 0.04);
      // Warm-up: tuning a semitone off, the chord, and Horace a beat late.
      [57, 63, 69, 64].forEach((p, i) =>
        note(6.0 + i * 0.15, p, 0.3, 'keys', 0.035, (i - 1.5) * 0.3),
      );
      for (const p of [58, 62, 65, 70]) note(WARM, p, 0.45, 'pad', 0.04, p > 62 ? 0.3 : -0.3);
      for (const p of [62, 65, 70]) note(WARM, p, 0.42, 'lead', 0.03, 0.2);
      note(LATE_OOM, 46, 0.42, 'bass', 0.16, -0.3);
      for (const k of KNOCKS) fx('knock', k, 0.25, 0.18, 0.2);
      fx('scribble', SCRIBBLE, 0.4, 0.09, 0.1);
      fx('tweet', 13.0, 0.8, 0.05, 0.4);
      // The march: correct, stiff, joyless.
      band(s, { from: DOWNBEAT, to: FLICK, bpm: 100, level: () => 0.8 });
      // The grandad snores from the nod to the swat.
      for (let t = NOD; t < SWIPE - 0.4; t += 2.2)
        fx('snore', t, Math.min(2.2, SWIPE - t), 0.07, -0.5);
      buzz(s);
      // FLICK: the band lurches faster. DUCK: a whisper. RISE: a gorgeous swell.
      fx('swish', FLICK, 0.3, 0.14, -0.1);
      band(s, {
        from: FLICK,
        to: LAND_NOSE,
        bpm: 126,
        level: (t) =>
          t < DUCK ? 0.8 : t < RISE ? 0.25 : lerp(0.35, 1, ease(span(t, RISE, RISE + 1.4))),
      });
      fx('clash', SWIPE, 1.4, 0.22, 0.3);
      fx('swish', SWIPE - 0.12, 0.3, 0.16, 0);
      fx('gasp', SWIPE + 0.05, 0.5, 0.06, 0.1);
      fx('gasp', SNORT, 0.45, 0.09, -0.5);
      fx('crowd', 36.0, 1.2, 0.04);
      [0, 0.5, 1].forEach((d, i) => {
        for (const p of [58, 65, 70])
          note(
            RISE + d,
            p + (i === 2 ? 4 : 0),
            2.8 - d,
            'pad',
            0.02 + i * 0.012,
            p > 60 ? 0.3 : -0.3,
          );
      });
      fx('crowd', 44.2, 1.6, 0.035);
      // The fermata: four held notes, each player giving out in turn; Horace sags, and squeaks.
      // The hold rides on steady pads (no re-strikes, so it never pulses); the brass get one
      // attack each, and the tuba one more at every sag.
      const hold = (from: number, to: number, pitch: number, gain: number, pan: number) =>
        note(from, pitch, to - from, 'pad', gain, pan);
      hold(LAND_NOSE, DROPS[0], 82, 0.05, -0.4);
      hold(LAND_NOSE, DROPS[1], 74, 0.045, 0.35);
      note(LAND_NOSE, 74, 1.4, 'lead', 0.04, 0.35);
      hold(LAND_NOSE, DROPS[2], 65, 0.06, 0.15);
      hold(LAND_NOSE, SAGS[0] + 0.25, 46, 0.075, -0.25);
      note(LAND_NOSE, 46, 1.4, 'bass', 0.08, -0.25);
      [45, 44, 43].forEach((p, i) => {
        const to = i < 2 ? SAGS[i + 1] + 0.25 : SQUEAK;
        hold(SAGS[i], to, p, 0.075, -0.25);
        note(SAGS[i], p, 0.9, 'bass', 0.07, -0.25);
      });
      DROPS.forEach((d, i) => fx('gasp', d, 0.45, 0.05, [-0.4, 0.35, 0.15][i]));
      fx('squeak', SQUEAK, 0.45, 0.12, -0.25);
      fx('wind', SQUEAK, LIFT - SQUEAK, 0.06);
      fx('tweet', TWEET_AT, 0.8, 0.06, 0.5);
      // He exhales; it comes back; he flails.
      fx('gasp', EXHALE, 0.7, 0.05, 0);
      for (const t of [FLAIL, 60.7, 61.4]) fx('swish', t, 0.35, 0.14, t === 60.7 ? 0.3 : -0.3);
      // PRESTO: the march at double time, everybody hanging on.
      // The comic climax: louder than the stiff march it is making fun of.
      band(s, {
        from: PRESTO,
        to: INTO_TUBA,
        bpm: 200,
        level: () => 0.95,
        tune: 0.95,
        drums: 'drive',
        pad: false,
      });
      // Sheet music flying off the stands (on screen in the over-the-shoulder shot and the band row).
      for (const t of [62.6, 63.3, 63.9, 64.6]) fx('flutter', t, 0.6, 0.1, t === 63.3 ? 0.4 : -0.3);
      for (let t = PRESTO + 0.45; t < INTO_TUBA - 0.3; t += 0.9)
        fx('swish', t, 0.3, 0.11, Math.sin(t) * 0.4);
      fx('giggle', 66.0, 1.4, 0.07, -0.2);
      fx('crowd', 66.0, 2.0, 0.06);
      // The tuba: a pop as it vanishes into the bell, a muffled buzz inside, a point, a breath,
      // and the note of his life.
      fx('pop', INTO_TUBA, 0.12, 0.06, TUBA_BELL[0] / 160 - 1);
      for (let t = INTO_TUBA; t < 72.4; t += 0.6) fx('whir', t, Math.min(0.5, 72.4 - t), 0.04, 0);
      note(POINT, 65, 0.3, 'pluck', 0.08, -0.4);
      note(POINT + 0.22, 58, 0.5, 'pluck', 0.08, -0.4);
      fx('gasp', INHALE, 0.8, 0.09, -0.2);
      note(LAUNCH, 34, 1.5, 'bass', 0.24, -0.1);
      note(LAUNCH, 46, 1.5, 'pad', 0.05, -0.1);
      fx('rumble', LAUNCH, 1.5, 0.16);
      fx('pop', LAUNCH, 0.15, 0.2);
      fx('boing', LAUNCH + 0.05, 0.9, 0.12);
      [0.5, 0, -0.5].forEach((pan, i) => fx('whir', LAUNCH + i * 0.22, 0.3, 0.08, pan));
      // The whole lawn watches it go up: one long "ooh".
      fx('crowd', 74.2, 1.9, 0.05);
      fx('woo', 74.5, 1.2, 0.03, -0.2);
      // FLIGHT: the slow arc, a held chord and a rising run.
      for (const p of [58, 62, 65, 70]) note(76.0, p, 4.2, 'pad', 0.03, p > 62 ? 0.35 : -0.35);
      [12, 14, 16, 17, 19, 21].forEach((d, i) =>
        note(76.3 + i * 0.6, ROOT + d, 0.9, 'lead', 0.06, -0.3 + i * 0.1),
      );
      // The last beat: a roll, the wasp lands on the tip, and the final chord.
      for (let t = 80.25; t < FINAL_HIT - 0.04; t += 0.085)
        note(t, 36, 0.08, 'snare', 0.012 + (t - 80.25) * 0.03, 0.15);
      s.chord(at(FINAL_HIT), [58, 62, 65, 70, 74], 2.0, 'lead', 0.06);
      s.chord(at(FINAL_HIT), [58, 65, 70], 2.0, 'pad', 0.04);
      s.chord(at(FINAL_HIT), [70, 74, 77, 82], 1.8, 'keys', 0.035);
      note(FINAL_HIT, 34, 2.0, 'bass', 0.14);
      note(FINAL_HIT, 46, 2.0, 'bass', 0.08);
      note(FINAL_HIT, 36, 0.3, 'kick', 0.12);
      fx('clash', FINAL_HIT, 1.6, 0.2, 0.25);
      fx('thud', FINAL_HIT, 0.4, 0.22);
      fx('whir', 83.5, 0.2, 0.05, 0.2);
      // Silence. One boy's three claps (a quiet snare is a hand clap). Then all of them.
      fx('wind', 84.0, 2.0, 0.05);
      for (const c of CLAPS) note(c, 36, 0.12, 'snare', 0.07, -0.1);
      fx('applause', OVATION, 3.9, 0.2);
      fx('crowd', OVATION, 3.0, 0.08);
      fx('woo', 88.0, 0.7, 0.07, -0.4);
      fx('woo', 89.0, 0.7, 0.06, 0.4);
      // The turn: the lawn still cheering, softer, while the book shuts; the march's first
      // phrase, tender, on the bow; the applause gone for the encore.
      fx('applause', 90.3, ENCORE_PLAY - 90.3, 0.07);
      fx('thud', BOOK_SHUT, 0.3, 0.12, -0.3);
      fx('swish', BOOK_TOSS + 0.05, 0.3, 0.06, -0.3);
      MARCH.slice(0, 6).forEach((d, i) => {
        if (d !== null) note(BOW + i * 0.27, ROOT + d, 0.9, 'keys', 0.06, -0.2 + i * 0.08);
      });
      fx('woo', BOW + 0.2, 0.7, 0.035, 0.3);
      // The cymbal player's grin gets one tiny, happy tap.
      fx('clash', GRIN, 0.6, 0.05, 0.35);
      // The encore, cut dead for next Sunday.
      band(s, {
        from: ENCORE_PLAY,
        to: 95.9,
        bpm: 200,
        level: () => 0.85,
        tune: 0.8,
        drums: 'drive',
        pad: false,
      });
      // Next Sunday: the motif on a plucked string, a bigger crowd, a jar, and an approaching buzz.
      s.section({
        from: at(96.5),
        to: at(100.5),
        bpm: 100,
        root: ROOT,
        chords: CHORDS,
        melody: MARCH,
        voice: 'pluck',
        groove: 'none',
        level: 0.35,
        gain: 0.75,
        fade: 0.6,
      });
      fx('crowd', 98.5, 5.0, 0.07);
      fx('click', JAR, 0.1, 0.2, 0.3);
      fx('creak', JAR + 0.2, 0.5, 0.05, 0.3);
      // The approaching buzz, panned along the same path the picture draws.
      (
        [
          [LAST_RAISE, 0.03],
          [102.6, 0.05],
          [103.3, 0.07],
          [104.0, 0.08],
          [104.8, 0.08],
        ] as const
      ).forEach(([t, g]) => fx('whir', t, 0.6, g, clamp(waspPos(t + 0.3)[0] / 160 - 1, -1, 1)));
    },
  );

// ——— Putting it on screen ———
type Keys = readonly (readonly [number, number, number, number])[];
const LAWN_CAMERA: Record<number, Keys> = {
  // Push in until the chalk sign reads, keeping the Maestro's head in frame above it.
  0: [
    [0, 160, 90, 1],
    [1.6, 160, 90, 1],
    [4.6, 182, 96, 2.3],
    [6, 182, 95, 2.35],
  ],
  [DOWNBEAT]: [
    [DOWNBEAT, 160, 90, 1],
    [19, 112, 106, 1.5],
  ],
  [OFF_JAM]: [
    [OFF_JAM, 130, 98, 1.25],
    [25.5, 150, 88, 1.3],
  ],
  [LAWN_ROUND]: [
    [LAWN_ROUND, 160, 92, 1],
    [DUCK, 160, 84, 1.14],
  ],
  44: [
    [44, 160, 92, 1],
    [45.7, 160, 82, 1.16],
  ],
  98.5: [
    [98.5, 160, 92, 1],
    [JAR, 160, 90, 1.05],
  ],
};
const OTS_CAMERA: Record<number, Keys> = {
  6: [
    [6, 150, 90, 1],
    [LATE_OOM, 136, 92, 1.08],
    [7.6, 128, 92, 1.14],
  ],
  // Horace's ears, going red, with the Maestro glaring over them.
  [EARS_CUT]: [
    [EARS_CUT, 92, 110, 1.5],
    [RAISE_CUT, 90, 108, 1.65],
  ],
  34: [
    [34, 172, 90, 1.08],
    [36, 178, 92, 1.14],
  ],
  [FLICK]: [
    [FLICK, 160, 74, 1.4],
    [31, 160, 76, 1.3],
  ],
  [DUCK]: [
    [DUCK, 160, 84, 1.12],
    [44, 160, 86, 1.05],
  ],
  46.8: [
    [46.8, 160, 76, 1.25],
    [48, 160, 72, 1.4],
  ],
  [FLAIL]: [
    [FLAIL, 160, 72, 1.5],
    [PRESTO, 160, 74, 1.35],
  ],
  [DIVE_CUT]: [
    [DIVE_CUT, 130, 90, 1],
    [INHALE, 112, 92, 1.08],
  ],
  80: [
    [80, 150, 88, 1],
    [FINAL_HIT, 150, 88, 1],
    [82, 140, 80, 1.18],
  ],
  [BOW]: [
    [BOW, 150, 90, 1.04],
    [GRIN_CUT, 140, 88, 1.12],
  ],
};
const still = { x: 160, y: 90, zoom: 1 };

export const theWaspConcerto: FilmModule = {
  draw(ctx, p, seconds) {
    const t = p * STORY;
    const { kind, from, to } = shotAt(t);
    switch (kind) {
      case 'lawn': {
        const k = LAWN_CAMERA[from];
        camera(ctx, k ? track(t, k) : still, () => lawnSet(ctx, t, seconds, from));
        break;
      }
      case 'ots': {
        const k = OTS_CAMERA[from];
        camera(ctx, k ? track(t, k) : still, () => otsSet(ctx, t, seconds, from));
        break;
      }
      case 'cuM':
        maestroCU(ctx, t, seconds, from);
        break;
      case 'book':
        bookShot(ctx, t, from > 50);
        break;
      case 'front':
        camera(
          ctx,
          track(
            t,
            from === WAKE_CUT
              ? [
                  [from, 190, 98, 1.04],
                  [to, 206, 104, 1.14],
                ]
              : [
                  [from, 168, 96, 1],
                  [to, 140, 104, 1.1],
                ],
          ),
          () => frontSet(ctx, t, seconds, from),
        );
        break;
      case 'sandwich':
        sandwichShot(ctx, t, seconds);
        break;
      case 'row':
        camera(
          ctx,
          track(t, [
            [from, 160, 92, 1.04],
            [to, 172, 92, 1.1],
          ]),
          () => rowSet(ctx, t, seconds),
        );
        break;
      case 'nose':
        noseShot(ctx, t, seconds, from);
        break;
      case 'clarinet':
      case 'trumpet':
      case 'trombone':
      case 'horace':
      case 'cymbals':
        playerCU(ctx, kind, t, seconds, from, to);
        break;
      case 'bell':
        bellShot(ctx, t, seconds, from);
        break;
      case 'flight':
        flightShot(ctx, t, seconds, from);
        break;
      case 'tip':
        tipShot(ctx, t, seconds);
        break;
      case 'boy':
        boyShot(ctx, t);
        break;
      case 'sign':
        signShot(ctx, t, seconds);
        break;
      case 'tableau':
        tableauShot(ctx, t, seconds);
        break;
    }
    vignette(ctx, 0.2, '#3A1A1C');
  },
  score: theWaspConcertoScore,
  look: {
    shade: '#7A1E22',
    ink: '#F6E7B8',
    accent: '#F2C230',
    dedication: 'no wasps were harmed. one tuba was.',
  },
};
