import type { FilmModule } from './types';
import type { Voice } from '../music/score';
import {
  alpha,
  box,
  camera,
  clamp,
  disc,
  ease,
  easeIn,
  easeOut,
  faded,
  glow,
  H,
  hump,
  iris,
  lerp,
  line,
  mix,
  oval,
  person,
  poly,
  rand,
  shot,
  sky,
  snowfall,
  span,
  starfield,
  TAU,
  track,
  vignette,
  W,
  type Ctx,
  type Figure,
  type View,
} from './kit';
import { composeFilm, type Score, type Section } from './score-kit';

/*
 * STATUES
 * Alone on the snowy green, June builds a lopsided snowman and plays Statues with it: she
 * counts against the old oak, spins round, and every time there are more of them, closer, and
 * never, ever moving.
 *
 * The film keeps the game's one rule: we never see a snowman move. While June counts the camera
 * stays on her face; on every spin it hard-cuts to a tableau chosen by story time, constant for
 * as long as it is on screen. Only things done to the snowmen change inside a shot (her prod
 * leaves a dent, her snowball a splat). Offscreen sound tells what happened in between, and at
 * the end the camera itself blinks, so in the dark we hear them move.
 *
 * Time is kept in story seconds (0–84). Picture and score read the same hit points: the
 * counts, the spins, the peek, the thwump, the hat, the iris.
 */

// ——— Time ———
/** Story seconds between the title card and The End (the film runs 90 s). */
export const STORY = 84;
/** Story seconds → story time. */
const P = (sec: number) => sec / STORY;

// ——— Hit points, in story seconds, shared by picture and score ———
const LOOK_LEFT = 1.1,
  LOOK_RIGHT = 2.2;
const CROUCH = 3.5;
const ROLL = 5.2;
export const BODY_SET = 8.0;
const RUN_BACK = 8.5,
  SMALL_ROLL = 9.0,
  LIFT = 9.75;
export const HEAD_SET = 10.4;
export const COALS = [11.4, 11.8, 12.2] as const;
export const CARROT = 12.7;
export const STICKS = [13.1, 13.4] as const;
const SHRUG = 16.0;
/** The game, mimed: at the snowman, at the oak, hands over her eyes. */
export const POINTS = [17.3, 17.9, 18.4] as const;
const MARCH = 18.55;
export const SCARF_HUNG = 19.2;
const FACE_TRUNK = 19.8;
/** The five counts: June's face against the oak, eyes shut. */
export const COUNTS = [
  [20.0, 23.5],
  [26.0, 29.0],
  [34.0, 37.5],
  [42.0, 49.5],
  [52.0, 56.5],
] as const;
/** Each count's tempo: the tiptoe tune speeds up a notch a round (the fifth is counted in silence). */
const COUNT_BPM = [126, 132, 138, 144, 112] as const;
export const SPINS = [23.5, 29.0, 37.5, 49.5, 56.5, 60.3] as const;
const RUB = 25.0;
const NOSE = 31.8;
export const PROD = 32.4;
const BACK_AWAY = 33.0;
const JAW = 41.0;
const FINGERS = 44.0;
export const PEEK = 45.0;
export const UNPEEK = 47.0;
const FALL = 51.0;
const ONE_EYE = 56.0;
export const THWUMP = 59.5;
const GRIN = 61.6;
export const THROW = 62.0;
export const SPLAT = 62.6;
export const HIT_2 = 64.4;
const THROW_2 = 66.4;
export const ARCS = [67.3, 67.9] as const;
export const HAT_OFF = 70.0;
export const SWEEPS = [70.6, 71.3] as const;
const TUCK = 72.2;
const HUG = 73.2;
const WAVE = 74.0;
export const DOOR_OPEN = 76.0;
export const DOOR_SHUT = 77.2;
/** The blink: the iris starts to close, is shut, starts to open, is open. */
export const IRIS = [78.0, 79.0, 80.2, 81.2] as const;
/** In the black: three tiptoe notes, each with a crunch just after it. */
export const DARK_STEPS = [79.2, 79.55, 79.9] as const;
const LAUGHS = [51.0, GRIN, 65.4, 68.8, 70.8] as const;

// ——— Shots (story seconds where each begins) ———
const CUTS = [
  0, // the green, one child
  5, // rolling the body
  11, // dressing the face
  13.5, // the two of them, nobody else
  17, // the game
  20, // count 1
  23.5, // reveal 1
  RUB, // she rubs her eyes
  26, // count 2
  29, // reveal 2
  30.5, // nose to carrot
  34, // count 3
  37.5, // reveal 3
  39.5, // the bare branch
  40.5, // her jaw
  42, // count 4
  45, // the peek
  47, // fingers shut
  49.5, // reveal 4: the conga
  51, // she laughs and falls over
  52, // count 5, in silence
  56.5, // the empty green
  59.5, // thwump
  60.3, // round the oak
  GRIN, // her grin
  62, // fight: the throw
  64, // fight: the scoop
  65.2, // all innocent
  66.5, // behind the bench
  68.5, // the fort
  69.6, // hat off
  70.5, // a snow angel
  72, // dusk: the scarf, the hug
  74, // goodbye
  76, // home, then the blink
  79, // black
  80.2, // the class photo
] as const;

// ——— Colour ———
type Light = {
  skyTop: string;
  skyLow: string;
  snow: string;
  shadow: string;
  far: string;
  oak: string;
  oakDark: string;
  wall: string;
  wallDark: string;
  roof: string;
  roofShade: string;
  window: string;
  glow: number;
  body: string;
  bodyShade: string;
  rim: string;
  grass: string;
  bench: string;
};
type Tone = (color: string) => string;
/** `pop` grades the two things that must find the eye (her red hat, her yellow scarf) more lightly. */
type Grade = { l: Light; k: Tone; dusk: boolean; pop?: Tone };

const MORNING: Light = {
  skyTop: '#D8C3C9',
  skyLow: '#E6D6D6',
  snow: '#EEF0F5',
  shadow: '#C9C6DA',
  far: '#DCDCE8',
  oak: '#4A3A3A',
  oakDark: '#36292B',
  wall: '#8C7F8F',
  wallDark: '#76697A',
  roof: '#F6F4F8',
  roofShade: '#BDB8CE',
  window: '#FFD58A',
  glow: 0,
  body: '#FBFBFE',
  bodyShade: '#D9D5E6',
  rim: '#A9A3BE',
  grass: '#8C9C7C',
  bench: '#7A6260',
};
const brighter = (c: string) => mix(c, '#F2EEF2', 0.3);
const FIGHT: Light = {
  ...MORNING,
  skyTop: brighter(MORNING.skyTop),
  skyLow: brighter(MORNING.skyLow),
  snow: mix(MORNING.snow, '#FFFFFF', 0.3),
  far: brighter(MORNING.far),
  wall: mix(MORNING.wall, '#F2EEF2', 0.12),
};
const DUSK: Light = {
  skyTop: '#3E3B6B',
  skyLow: '#6A5A8E',
  snow: '#9D9AC4',
  shadow: '#6E6A9E',
  far: '#8783B4',
  oak: '#2C2438',
  oakDark: '#211B2C',
  wall: '#544B6E',
  wallDark: '#453D5E',
  roof: '#B6B4DA',
  roofShade: '#7C78AA',
  window: '#FFC062',
  glow: 0.55,
  body: '#C6C4EA',
  bodyShade: '#9692C6',
  rim: '#5E5A8E',
  grass: '#5E6872',
  bench: '#3E3248',
};
const keep: Tone = (c) => c;
const MORNING_G: Grade = { l: MORNING, k: keep, dusk: false };
const FIGHT_G: Grade = { l: FIGHT, k: (c) => mix(c, '#FFFFFF', 0.04), dusk: false };
const DUSK_G: Grade = {
  l: DUSK,
  k: (c) => mix(c, '#4A4580', 0.32),
  dusk: true,
  // Her red hat and the yellow scarf stay the brightest things at dusk.
  pop: (c) => mix(c, '#4A4580', 0.12),
};
const gradeAt = (t: number) => (t < THROW ? MORNING_G : t < 72 ? FIGHT_G : DUSK_G);

const SKIN = '#F4C9A8',
  SKIN_SHADE = '#E2A88A',
  CHEEK = '#EE8A86',
  HAIR = '#6E4428',
  HAIR_DARK = '#4A2C1A',
  HAT = '#D8433A',
  HAT_DARK = '#A8302C',
  POM = '#FBF8F4',
  SCARF = '#F2C230',
  SCARF_DARK = '#C9971C',
  COAT = '#3E6FB0',
  COAT_DARK = '#2D548E',
  GLOVE = '#262E56',
  LEGS = '#2E3550',
  BOOT = '#6A4428',
  COAL = '#2A2430',
  CARROT_C = '#EC8A3A',
  CARROT_DARK = '#B9622A',
  TWIG = '#6B4A36',
  BLUSH = '#F08C9A',
  POT = '#C46A48',
  POT_DARK = '#9A5034',
  LEAF = '#5E9A4A',
  LEAF_DARK = '#3D7232',
  LIP = '#B65E58',
  MOUTH = '#5A2630',
  LID = '#5A3A30',
  WHITE = '#FFFFFF';

// ——— The set: one snowy green, 480 wide, panned ———
const WORLD = { w: 480, h: 180 };
/** The green's horizon, where the houses stand. */
const BASE = 102;
const OAK_X = 60;
/** The low stub branch at June's head height, where the scarf hangs. */
const STUB = { x: 87, y: 118 };
const BENCH = { x: 150, y: 124 };
const BUILD = 300;
const DOOR = { x: 400, y: BASE };
/** Where her hat lies from the fight till the end: in front of them all, in every dusk shot. */
const HAT_SPOT = { x: 296, y: 169 };
const HOUSES: readonly (readonly [x: number, w: number, h: number, roof: number])[] = [
  [-10, 48, 30, 15],
  [42, 44, 36, 18],
  [90, 54, 28, 14],
  [148, 46, 34, 19],
  [198, 58, 30, 15],
  [260, 44, 38, 18],
  [308, 54, 29, 15],
  [368, 58, 34, 18],
  [430, 60, 30, 16],
];
/** June's house, with the red door. */
const HOME = 7;
const DRIFTS: readonly (readonly [number, number, number, number])[] = [
  [40, 172, 50, 4],
  [190, 128, 70, 3],
  [330, 176, 70, 4],
  [430, 134, 50, 3],
  [250, 164, 40, 2.5],
  [112, 160, 30, 2],
  [372, 118, 44, 2],
];
const LIMBS: readonly (readonly [number, readonly number[]])[] = [
  [5, [61, 54, 44, 32, 26, 18, 8, 12]],
  [5, [61, 50, 78, 30, 98, 20, 122, 14]],
  [4, [60, 48, 58, 24, 63, 2]],
  [2.2, [44, 32, 36, 14, 38, 0]],
  [2, [26, 18, 14, 4]],
  [2, [78, 30, 88, 12, 86, 0]],
  [2, [98, 20, 108, 4]],
  [1.6, [32, 24, 14, 26, 0, 22]],
  [1.6, [104, 17, 130, 22, 142, 18]],
  [1.4, [58, 24, 48, 8]],
  [1.4, [63, 12, 74, 0]],
];

// ——— Round prints: every tableau leaves its own, from a fixed list, never by frame ———
type Print = readonly [from: number, x: number, y: number];
function trail(from: number, x0: number, x1: number, y: number, n: number): Print[] {
  return Array.from({ length: n }, (_, i) => {
    const u = n > 1 ? i / (n - 1) : 0;
    return [from, lerp(x0, x1, u), y + (i % 2 ? 2.5 : -2.5)] as const;
  });
}
function scatter(
  from: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  n: number,
  seed: number,
): Print[] {
  return Array.from(
    { length: n },
    (_, i) =>
      [
        from,
        lerp(x0, x1, rand(seed * 31 + i * 3.1)),
        lerp(y0, y1, rand(seed * 17 + i * 5.3)),
      ] as const,
  );
}
const PRINTS: readonly Print[] = [
  [23.5, 294, 152],
  [23.5, 281, 148],
  ...trail(29, 258, 212, 150, 6),
  ...trail(37.5, 196, 186, 148, 3),
  ...scatter(45, 128, 250, 142, 160, 14, 4),
  ...scatter(49.5, 120, 280, 140, 162, 14, 5),
  ...scatter(56.5, 40, 440, 132, 174, 34, 6),
  ...scatter(60.3, 10, 160, 138, 160, 10, 7),
  ...scatter(65.2, 230, 440, 142, 166, 12, 8),
];

// ——— The snowmen: who they are ———
type Kind = 'big' | 'little' | 'pot' | 'bow' | 'fat' | 'tall' | 'june';
/** Balls from the bottom up, as [rx, ry]; the last is the head. */
const BALLS: Record<Kind, readonly (readonly [number, number])[]> = {
  big: [
    [14, 13.5],
    [9, 9],
  ],
  little: [
    [8, 7.6],
    [6, 6],
  ],
  pot: [
    [12, 11.5],
    [8, 8],
  ],
  bow: [
    [11.5, 11],
    [7.5, 7.5],
  ],
  fat: [
    [13, 12],
    [10, 9.5],
    [7, 7],
  ],
  tall: [
    [8, 12],
    [6.5, 10],
    [6, 6],
  ],
  june: [
    [9, 8.5],
    [7, 7],
  ],
};
/** Every head sits a little crooked; the big one's most of all (about 10°). */
const TIP: Record<Kind, number> = {
  big: 0.17,
  little: -0.22,
  pot: 0.06,
  bow: -0.1,
  fat: 0.1,
  tall: -0.07,
  june: 0.06,
};
type Parts = {
  head: boolean;
  eyes: number;
  smile: boolean;
  carrot: boolean;
  sticks: number;
  blush: boolean;
};
/** One snowman, frozen in one pose. Nothing here is ever a function of time. */
type SM = {
  kind: Kind;
  x: number;
  y: number;
  s?: number;
  lean?: number;
  /** Left and right arm, radians above horizontal (each pointing outward). */
  arms?: readonly [number, number];
  reach?: readonly [number, number];
  /** A foot ball lifted mid-tiptoe: -1 the left, 1 the right. */
  lift?: -1 | 1;
  /** Features shifted toward a side, -1 .. 1. */
  look?: number;
  /** Eyes rolled up: butter wouldn't melt. */
  up?: boolean;
  shh?: boolean;
  headstand?: boolean;
  /** A snowball balanced on the carrot. */
  ball?: boolean;
  /** Carrot angle, radians (0 points right; π left). */
  nose?: number;
  parts?: Parts;
};
type Tableau = { from: number; cast: readonly SM[] };
const LEFT = Math.PI - 0.15;

const TABLEAUX: readonly Tableau[] = [
  { from: 0, cast: [] },
  // T0: the big one alone at its build spot.
  { from: 13.5, cast: [{ kind: 'big', x: BUILD, y: 150, arms: [0.35, 0.5] }] },
  // T1: two steps closer.
  { from: SPINS[0], cast: [{ kind: 'big', x: 268, y: 150, arms: [0.2, 0.7], lean: -0.04 }] },
  // T2: halfway across, arms flung up, carrot at a jaunty angle.
  {
    from: SPINS[1],
    cast: [{ kind: 'big', x: 200, y: 150, arms: [1.2, 1.05], nose: -0.6, lean: -0.06, look: 0.3 }],
  },
  // T3: and now there are two, the new one in June's scarf.
  {
    from: SPINS[2],
    cast: [
      { kind: 'big', x: 180, y: 150, arms: [0.4, 0.3] },
      { kind: 'little', x: 205, y: 153, arms: [0.55, 0.25], look: -0.2 },
    ],
  },
  // PEEK: six, crowded into the slit between her fingers, frozen mid-tiptoe; one says shh.
  {
    from: PEEK,
    cast: [
      {
        kind: 'tall',
        x: 163,
        y: 145,
        lean: -0.2,
        lift: 1,
        arms: [0.9, 0.2],
        look: -0.5,
        nose: LEFT,
      },
      {
        kind: 'pot',
        x: 190,
        y: 146,
        lean: -0.16,
        lift: 1,
        arms: [1.0, 0.1],
        look: -0.4,
        nose: LEFT,
      },
      {
        kind: 'bow',
        x: 212,
        y: 149,
        lean: -0.14,
        lift: 1,
        arms: [0.9, 0.2],
        look: -0.4,
        nose: LEFT,
      },
      {
        kind: 'fat',
        x: 152,
        y: 152,
        lean: -0.18,
        lift: 1,
        arms: [1.1, 0.3],
        look: -0.5,
        nose: LEFT,
      },
      {
        kind: 'big',
        x: 176,
        y: 157,
        lean: -0.08,
        arms: [0.8, 0.3],
        shh: true,
        look: -0.4,
        nose: LEFT + 0.45,
      },
      { kind: 'little', x: 200, y: 160, lean: -0.22, lift: 1, arms: [1.0, 0.4], look: -0.5 },
    ],
  },
  // T4: a conga line, each stick arm on the one in front.
  {
    from: SPINS[3],
    cast: [
      { kind: 'big', x: 140, y: 150, arms: [0.9, 1.1], lift: -1, look: -0.5, nose: LEFT },
      { kind: 'little', x: 164, y: 154, arms: [0.05, 0.9], reach: [1.3, 1], lift: 1, look: -0.4 },
      {
        kind: 'pot',
        x: 186,
        y: 150,
        arms: [0.1, 1.0],
        reach: [1.1, 1],
        lift: -1,
        look: -0.4,
        nose: LEFT,
      },
      { kind: 'bow', x: 212, y: 152, headstand: true, arms: [0.1, 0.1], look: 0.2 },
      {
        kind: 'fat',
        x: 238,
        y: 151,
        arms: [0.15, 1.0],
        reach: [1.0, 1],
        lift: -1,
        look: -0.4,
        nose: LEFT,
      },
      {
        kind: 'tall',
        x: 264,
        y: 148,
        arms: [0.2, 1.1],
        reach: [1.1, 1],
        lift: 1,
        ball: true,
        nose: -0.5,
      },
    ],
  },
  // T5: nobody at all.
  { from: SPINS[4], cast: [] },
  // T6: lined up round the oak behind her; the Little One still in its follow-through.
  {
    from: SPINS[5],
    cast: [
      { kind: 'tall', x: 24, y: 146, arms: [0.3, 0.5], look: 0.5 },
      { kind: 'fat', x: 42, y: 153, arms: [0.4, 0.4], look: 0.5 },
      { kind: 'pot', x: 84, y: 150, arms: [0.3, 0.6], look: 0.5 },
      { kind: 'big', x: 106, y: 151, arms: [0.4, 0.5], look: 0.4 },
      {
        kind: 'little',
        x: 129,
        y: 155,
        arms: [0.6, -0.35],
        reach: [1, 1.35],
        lean: 0.14,
        look: 0.6,
      },
      { kind: 'bow', x: 150, y: 147, arms: [0.3, 0.6], look: 0.5 },
    ],
  },
  // F1: loosely spread, all innocent.
  {
    from: 65.2,
    cast: [
      { kind: 'big', x: 258, y: 152, arms: [-0.5, -0.45], up: true, look: -0.2 },
      { kind: 'little', x: 296, y: 157, arms: [-0.5, -0.5], up: true, look: 0.2 },
      { kind: 'tall', x: 326, y: 145, arms: [-0.55, -0.5], up: true, look: -0.3 },
      { kind: 'pot', x: 362, y: 151, arms: [-0.5, -0.55], up: true, look: 0.3 },
      { kind: 'fat', x: 398, y: 148, arms: [-0.45, -0.5], up: true, look: -0.2 },
      { kind: 'bow', x: 432, y: 154, arms: [-0.5, -0.5], up: true, look: 0.2 },
    ],
  },
  // F2: behind a low wall of snow blocks.
  {
    from: 68.5,
    cast: [
      { kind: 'tall', x: 256, y: 145, arms: [0.5, 0.3], look: -0.5, nose: LEFT },
      { kind: 'big', x: 284, y: 146, arms: [0.6, 0.2], look: -0.5, nose: LEFT },
      { kind: 'little', x: 310, y: 147, arms: [0.9, 0.3], look: -0.5 },
      { kind: 'pot', x: 336, y: 145, arms: [0.5, 0.4], look: -0.5, nose: LEFT },
      { kind: 'fat', x: 364, y: 146, arms: [0.4, 0.3], look: -0.5, nose: LEFT },
      { kind: 'bow', x: 392, y: 145, arms: [0.5, 0.3], look: -0.5, nose: LEFT },
    ],
  },
  // DUSK: standing by the fort, in the order they were behind it.
  {
    from: 72.0,
    cast: [
      { kind: 'tall', x: 252, y: 156, arms: [0.3, 0.3] },
      { kind: 'big', x: 280, y: 158, arms: [0.35, 0.45] },
      { kind: 'little', x: 314, y: 160, arms: [0.4, 0.35], look: -0.2 },
      { kind: 'pot', x: 340, y: 157, arms: [0.3, 0.4] },
      { kind: 'fat', x: 368, y: 158, arms: [0.35, 0.3] },
      { kind: 'bow', x: 396, y: 156, arms: [0.3, 0.35] },
    ],
  },
];
const tableauAt = (t: number) => {
  let found = TABLEAUX[0];
  for (const tableau of TABLEAUX) if (t >= tableau.from) found = tableau;
  return found;
};

// ——— Drawing helpers ———
/** The top half of an ellipse: hats and hair. */
function dome(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();
}
/** A soft burst of snow, 0 → 1. */
function puff(
  ctx: Ctx,
  x: number,
  y: number,
  u: number,
  size: number,
  color: string,
  edge = '#A9A3BE',
) {
  if (u <= 0 || u >= 1) return;
  // Snow on snow: every chunk gets a soft grey edge so it reads against white.
  for (const pass of [0, 1])
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.05 - (i / 6) * Math.PI * 0.9;
      const d = size * (0.4 + easeOut(u) * 1.1);
      const r = size * 0.38 * (1 - u * 0.45);
      disc(
        ctx,
        x + Math.cos(a) * d,
        y + Math.sin(a) * d * 0.8 + u * size * 0.4,
        pass ? r : r + 0.8,
        pass ? alpha(color, 0.95 * (1 - u)) : alpha(edge, 0.8 * (1 - u)),
      );
    }
}
/** A breath puff from a mouth, drifting up and fading. */
function breath(ctx: Ctx, x: number, y: number, u: number, size: number) {
  if (u <= 0 || u >= 1) return;
  const a = 0.6 * (1 - u);
  disc(ctx, x + u * size * 2.4, y - u * size * 3, size * (0.5 + u), alpha(WHITE, a));
  disc(
    ctx,
    x + u * size * 3.2,
    y - u * size * 3.4 + size * 0.4,
    size * (0.35 + u * 0.7),
    alpha(WHITE, a * 0.8),
  );
}
type Actor = readonly [y: number, paint: () => void];
function stage(actors: Actor[]) {
  actors.sort((a, b) => a[0] - b[0]);
  for (const [, paint] of actors) paint();
}

// ——— Snowmen ———
function ball(ctx: Ctx, x: number, y: number, rx: number, ry: number, l: Light) {
  oval(ctx, x, y, rx + 0.8, ry + 0.8, l.rim);
  oval(ctx, x, y, rx, ry, l.bodyShade);
  oval(ctx, x - rx * 0.13, y - ry * 0.15, rx * 0.84, ry * 0.82, l.body);
}
function stickArm(
  ctx: Ctx,
  x: number,
  y: number,
  side: number,
  angle: number,
  len: number,
  k: Tone,
) {
  const c = k(TWIG);
  const ex = x + side * Math.cos(angle) * len,
    ey = y - Math.sin(angle) * len;
  line(ctx, c, 1.5, [x, y, (x + ex) / 2 + side * 0.4, (y + ey) / 2 - 0.8, ex, ey]);
  const fx = x + side * Math.cos(angle) * len * 0.74,
    fy = y - Math.sin(angle) * len * 0.74;
  line(ctx, c, 1, [
    fx,
    fy,
    fx + side * Math.cos(angle + 0.7) * len * 0.3,
    fy - Math.sin(angle + 0.7) * len * 0.3,
  ]);
}
function carrot(ctx: Ctx, x: number, y: number, angle: number, len: number, k: Tone) {
  const w = Math.max(0.9, len * 0.17);
  const c = Math.cos(angle),
    s = Math.sin(angle);
  poly(ctx, k(CARROT_C), [x - s * w, y + c * w, x + c * len, y + s * len, x + s * w, y - c * w]);
  line(ctx, k(CARROT_DARK), Math.max(0.5, len * 0.07), [
    x + c * len * 0.3 - s * w * 0.5,
    y + s * len * 0.3 + c * w * 0.5,
    x + c * len * 0.42 + s * w * 0.2,
    y + s * len * 0.42 - c * w * 0.2,
  ]);
}
/** Coal eyes, a five-coal smile, a carrot and two pink blush dots, on a head of radius r. */
function snowFace(ctx: Ctx, r: number, sm: SM, parts: Parts | undefined, k: Tone) {
  const f = (sm.look ?? 0) * r * 0.22;
  const coal = k(COAL);
  const cr = Math.max(0.75, r * 0.13);
  const ey = sm.up ? -r * 0.34 : -r * 0.14;
  const eyes = parts ? parts.eyes : 2;
  if (eyes > 0) disc(ctx, -r * 0.36 + f, ey, cr, coal);
  if (eyes > 1) disc(ctx, r * 0.36 + f, ey, cr, coal);
  if (sm.up && eyes > 1)
    for (const ex of [-r * 0.36 + f, r * 0.36 + f])
      box(ctx, ex - cr * 0.3, ey - cr * 0.9, cr * 0.7, cr * 0.5, alpha(WHITE, 0.8));
  if (!parts || parts.blush) {
    oval(ctx, -r * 0.6 + f, r * 0.2, r * 0.2, r * 0.12, alpha(k(BLUSH), 0.8));
    oval(ctx, r * 0.6 + f, r * 0.2, r * 0.2, r * 0.12, alpha(k(BLUSH), 0.8));
  }
  if (!parts || parts.smile)
    for (let i = 0; i < 5; i++) {
      const u = (i - 2) / 2;
      // Pursed into a little o for a shh; otherwise a wide smile.
      const w = sm.shh ? 0.2 : 0.46;
      disc(ctx, f + u * r * w, r * 0.4 + (1 - u * u) * r * (sm.shh ? 0.06 : 0.16), cr * 0.72, coal);
    }
  if (!parts || parts.carrot) {
    if (sm.kind === 'june') disc(ctx, f, r * 0.08, r * 0.15, k('#8C8890'));
    else {
      const angle = sm.nose ?? ((sm.look ?? 0) < -0.1 ? LEFT : 0.15);
      carrot(ctx, f, r * 0.08, angle, r * (sm.kind === 'little' ? 0.6 : 0.95), k);
      if (sm.ball) {
        const tx = f + Math.cos(angle) * r * 0.95,
          ty = r * 0.08 + Math.sin(angle) * r * 0.95;
        disc(ctx, tx, ty - 3.2, 3.2, k('#9C98B8'));
        disc(ctx, tx - 0.4, ty - 3.5, 2.8, k('#F4F4FA'));
      }
    }
  }
}
/** What has been done to them: the prod's dent, the splat, the scarf (1 worn, 2 tucked snug). */
type Marks = { dent: boolean; splat: boolean; scarf: number };
const NO_MARKS: Marks = { dent: false, splat: false, scarf: 0 };
function marksAt(t: number): Marks {
  const scarf = t >= SPINS[2] ? 1 + ease(span(t, TUCK, TUCK + 0.6)) : 0;
  return { dent: t >= PROD, splat: t >= SPLAT, scarf };
}
/** A beanie: the crown, a ribbed band, and a white pompom, sized to a head of radius r. */
function bobbleHat(ctx: Ctx, r: number, k: Tone) {
  dome(ctx, 0, -r * 0.3, r * 1.05, r * 0.95, k(HAT));
  box(ctx, -r * 1.08, -r * 0.48, r * 2.16, r * 0.36, k(HAT_DARK));
  disc(ctx, r * 0.1, -r * 1.3, r * 0.34, k(POM));
}
function snowman(ctx: Ctx, sm: SM, g: Grade, marks: Marks) {
  const { l, k } = g;
  const s = sm.s ?? 1;
  const balls = BALLS[sm.kind];
  const parts = sm.parts;
  ctx.save();
  ctx.translate(sm.x, sm.y);
  ctx.scale(s, s);
  oval(ctx, 0, 0.5, balls[0][0] * 1.25, 2.6, alpha(l.shadow, 0.95));
  ctx.rotate(sm.lean ?? 0);
  if (sm.headstand) {
    headstand(ctx, sm, g);
    ctx.restore();
    return;
  }
  // Two small round feet: they make the round prints.
  const r0 = balls[0][0];
  for (const side of [-1, 1] as const) {
    const up = sm.lift === side ? 1 : 0;
    ball(ctx, side * r0 * 0.55 + up * side * 3, -2.4 - up * 6, 3.3, 2.7, l);
  }
  const centers: number[] = [];
  let cy = 0,
    prev = 0;
  balls.forEach(([, ry], i) => {
    cy = i === 0 ? -ry + 1 : cy - (prev + ry) * 0.8;
    centers.push(cy);
    prev = ry;
  });
  const n = balls.length;
  const hasHead = !parts || parts.head;
  for (let i = 0; i < n - 1; i++) ball(ctx, 0, centers[i], balls[i][0], balls[i][1], l);
  const [bx, by] = balls[n - 2];
  const armY = centers[n - 2] - by * 0.35;
  // What was done to the big one stays done.
  if (sm.kind === 'big' && marks.dent) {
    oval(ctx, 4.5, centers[0] - 2.5, 3.3, 2.7, mix(l.bodyShade, l.rim, 0.35));
    oval(ctx, 5.1, centers[0] - 1.9, 2.3, 1.8, mix(l.bodyShade, l.rim, 0.75));
    line(ctx, l.body, 0.6, [2, centers[0] - 0.4, 4.5, centers[0] + 0.4, 7.2, centers[0] - 0.6]);
  }
  if (sm.kind === 'big' && marks.splat) {
    // Packed snow on its tummy: a grey-edged white star that stays.
    const splat = [
      [-3, -1, 3],
      [0, 1, 2.2],
      [-6, 1, 1.6],
      [-1, -4, 1.5],
      [2.5, -3, 1.1],
      [-7, -3, 1],
      [-4, 3, 1.2],
    ] as const;
    for (const [dx, dy, r] of splat) disc(ctx, dx - 1, centers[0] + dy, r + 0.7, l.rim);
    for (const [dx, dy, r] of splat) disc(ctx, dx - 1, centers[0] + dy, r, k(WHITE));
    disc(ctx, -3.4, centers[0] - 0.4, 1.1, alpha(l.rim, 0.45));
  }
  if (sm.kind === 'fat' || sm.kind === 'tall')
    for (let i = 0; i < (sm.kind === 'tall' ? 3 : 2); i++)
      disc(ctx, 0, centers[n - 2] - by * 0.35 + i * by * 0.45, Math.max(0.8, bx * 0.12), k(COAL));
  // Stick arms.
  const sticks = parts ? parts.sticks : 2;
  const [aL, aR] = sm.arms ?? [0.35, 0.35];
  const [rL, rR] = sm.reach ?? [1, 1];
  const len = 7 + bx * 0.6;
  if (sticks > 0) stickArm(ctx, -bx * 0.78, armY, -1, aL, len * rL, k);
  if (sticks > 1 && !sm.shh) stickArm(ctx, bx * 0.78, armY, 1, aR, len * rR, k);
  if (!hasHead) {
    ctx.restore();
    return;
  }
  // The head, crooked.
  const [hx, hy] = balls[n - 1];
  ctx.save();
  ctx.translate(0, centers[n - 1]);
  ctx.rotate(TIP[sm.kind]);
  ball(ctx, 0, 0, hx, hy, l);
  if (sm.kind === 'little')
    for (const [x0, x1, y1] of [
      [-2, -4.5, -10],
      [0, 0.8, -11],
      [2, 4.8, -9.5],
    ] as const)
      line(ctx, k(TWIG), 0.9, [x0, -hy + 0.5, x1, y1]);
  snowFace(ctx, hx, sm, parts, k);
  if (sm.kind === 'pot') {
    poly(ctx, k(POT), [
      -hx * 0.8,
      -hy * 0.55,
      hx * 0.8,
      -hy * 0.55,
      hx * 0.55,
      -hy * 1.55,
      -hx * 0.55,
      -hy * 1.55,
    ]);
    box(ctx, -hx * 0.95, -hy * 0.75, hx * 1.9, hy * 0.32, k(POT_DARK));
  }
  if (sm.kind === 'june') {
    // Two short braided plaits from under the band, splayed out, each with a navy tie (June's
    // own), and her real hat worn high enough that both coal eyes show under the band.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * hx * 0.9, -hy * 0.58);
      ctx.rotate(-side * 0.4);
      for (let i = 0; i < 3; i++) oval(ctx, 0, 1 + i * 1.7, 1.5, 1.15, k(i % 2 ? HAIR_DARK : HAIR));
      box(ctx, -1.3, 5.4, 2.6, 1, k(GLOVE));
      poly(ctx, k(HAIR), [-1.1, 6.4, 1.1, 6.4, 1.5, 8, 0, 7.3, -1.5, 8]);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(0, -hx * 0.38);
    bobbleHat(ctx, hx * 0.95, g.pop ?? k);
    ctx.restore();
  }
  ctx.restore();
  if (sm.kind === 'bow') {
    const ny = centers[n - 2] - by * 0.95;
    oval(ctx, -3.6, ny, 3.6, 2.1, k(LEAF), 0.35);
    oval(ctx, 3.6, ny, 3.6, 2.1, k(LEAF), -0.35);
    line(ctx, k(LEAF_DARK), 0.6, [-6.5, ny + 1, -1, ny]);
    line(ctx, k(LEAF_DARK), 0.6, [6.5, ny + 1, 1, ny]);
    disc(ctx, 0, ny, 1.4, k(LEAF_DARK));
  }
  if (sm.kind === 'little' && marks.scarf > 0) {
    const snug = clamp(marks.scarf - 1);
    const ny = centers[0] - balls[0][1] * 0.82;
    const kp = g.pop ?? k;
    oval(ctx, 0, ny, 6.4 - snug * 0.6, 2.2, kp(SCARF));
    box(ctx, -5, ny, 10, 0.8, kp(SCARF_DARK));
    // The tail hangs loose; tucked, it is a knot and two short ends.
    line(ctx, kp(SCARF), 2.4, [3, ny + 1, lerp(6.5, 4, snug), lerp(ny + 9, ny + 5, snug)]);
    line(ctx, kp(SCARF_DARK), 2, [2, ny + 1, lerp(3.5, 2, snug), lerp(ny + 7.5, ny + 5.5, snug)]);
    if (snug > 0.5) disc(ctx, 2.6, ny + 0.8, 1.6, kp(SCARF_DARK));
  }
  if (sm.shh) {
    // One stick held up across its coal lips: shh.
    const tip = TIP[sm.kind],
      hy0 = centers[n - 1];
    const mx = (sm.look ?? 0) * hx * 0.22 - Math.sin(tip) * hx * 0.42,
      my = hy0 + Math.cos(tip) * hx * 0.44;
    line(ctx, k(TWIG), 1.7, [bx * 0.78, armY, bx * 0.55, armY - 4, mx + 1, my + 5.5, mx, my - 4.5]);
    line(ctx, k(TWIG), 1, [mx + 0.6, my + 2, mx + 3.4, my - 0.5]);
  }
  ctx.restore();
}
/** The headstand: head on the snow, body up top, round feet kicking at the sky. */
function headstand(ctx: Ctx, sm: SM, g: Grade) {
  const { l, k } = g;
  const [[bx, by], [hx, hy]] = BALLS[sm.kind];
  const hc = -hy + 0.5,
    bc = hc - (hy + by) * 0.8;
  const [aL, aR] = sm.arms ?? [0.1, 0.1];
  const len = 7 + bx * 0.6;
  ball(ctx, 0, bc, bx, by, l);
  stickArm(ctx, -bx * 0.78, bc + by * 0.3, -1, aL, len, k);
  stickArm(ctx, bx * 0.78, bc + by * 0.3, 1, aR, len, k);
  for (const side of [-1, 1])
    ball(ctx, side * 4.5, bc - by + 0.5 - (side > 0 ? 2 : 0), 3.3, 2.7, l);
  const ny = bc + by * 0.95;
  oval(ctx, -3.4, ny, 3.4, 2, k(LEAF), -0.35);
  oval(ctx, 3.4, ny, 3.4, 2, k(LEAF), 0.35);
  disc(ctx, 0, ny, 1.3, k(LEAF_DARK));
  ctx.save();
  ctx.translate(0, hc);
  ctx.rotate(0.12);
  ball(ctx, 0, 0, hx, hy, l);
  snowFace(ctx, hx, { ...sm, nose: 0.2 }, undefined, k);
  ctx.restore();
}

// ——— June ———
const JUNE: Figure = {
  skin: SKIN,
  hair: HAIR,
  coat: COAT,
  legs: LEGS,
  shoes: BOOT,
  build: 'kid',
  size: 1.25,
  hat: 'beanie',
  hatColor: HAT,
  hairStyle: 'pigtails',
  blush: true,
};
type JuneO = Partial<Figure> & {
  scarf?: boolean;
  /** The scarf tail's angle: it flies out when she spins or runs. */
  tail?: number;
  bare?: boolean;
  splat?: boolean;
  puff?: number;
  /** Ducked, arms up over her head, elbows out, gloves on her hat. */
  cover?: boolean;
};
/** June in a wide: the town's chunky kid, plus her pompom, her scarf and her navy gloves. */
function june(ctx: Ctx, x: number, y: number, o: JuneO, g: Grade) {
  const { k } = g;
  const f: Figure = {
    ...JUNE,
    ...o,
    skin: k(SKIN),
    hair: k(HAIR),
    coat: k(COAT),
    legs: k(LEGS),
    shoes: k(BOOT),
    hat: o.bare ? 'none' : 'beanie',
    hatColor: k(HAT),
  };
  const s = f.size ?? 1,
    facing = f.facing ?? 1;
  const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step));
  const swing = f.step === undefined ? 0 : Math.sin(f.step);
  const [back, front] = f.arms ?? [-swing * 0.6, swing * 0.6];
  const body = (paint: () => void) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing * s, s);
    ctx.translate(0, f.sitting ? -4 : -6 - bob);
    ctx.rotate(f.lean ?? 0);
    paint();
    ctx.restore();
  };
  if (o.scarf)
    body(() => {
      ctx.translate(-3.5, -8.5);
      ctx.rotate(o.tail ?? 0.2);
      box(ctx, -1.3, 0, 2.6, 7, k(SCARF_DARK));
      box(ctx, -1.3, 6.4, 2.6, 1.3, k(SCARF));
    });
  person(ctx, x, y, f);
  body(() => {
    if (!o.bare) disc(ctx, 0.5, -24.6, 2.5, k(POM));
    if (o.scarf) {
      box(ctx, -4.6, -10.4, 9.2, 2.8, k(SCARF));
      box(ctx, -4.6, -8.2, 9.2, 0.8, k(SCARF_DARK));
    }
    if (o.splat) {
      disc(ctx, -4.4, -5, 2, k(WHITE));
      disc(ctx, -3.4, -3.4, 1.2, k(WHITE));
      disc(ctx, -4.8, -7, 1, k(WHITE));
    }
    if (o.cover)
      for (const side of [-1, 1]) {
        line(ctx, k(COAT_DARK), 2.4, [side * 3.5, -8, side * 9.5, -14, side * 6.6, -20.5]);
        disc(ctx, side * 6.4, -21.2, 1.8, k(GLOVE));
      }
    else
      for (const [angle, dx, isFront] of [
        [back, -1, false],
        [front, 1, true],
      ] as const) {
        if (!isFront && Math.abs(angle) < 0.5) continue;
        disc(ctx, dx + Math.sin(angle) * 7, -7 + Math.cos(angle) * 7, 1.5, k(GLOVE));
      }
  });
  const pf = o.puff ?? -1;
  if (pf > 0 && pf < 1) breath(ctx, x + facing * 4.5 * s, y - 26 * s, pf, 1.4 * s);
}
/** Her breath, every second and a half or so. */
const breathAt = (seconds: number, every = 1.6) => ((seconds % every) / every) * 1.8;

type Back = {
  arms?: readonly [number, number];
  bare?: boolean;
  swing?: number;
  splat?: number;
  jolt?: number;
};
/** June from behind: boots, blue coat, plaits, and the red bobble hat. Units as the town's kid. */
function juneBack(ctx: Ctx, x: number, y: number, s: number, o: Back, g: Grade) {
  const { k } = g;
  ctx.save();
  ctx.translate(x, y - (o.jolt ?? 0) * 2 * s);
  ctx.scale(s, s);
  box(ctx, -4, -6.5, 3, 5.5, k(LEGS));
  box(ctx, 1, -6.5, 3, 5.5, k(LEGS));
  box(ctx, -4.4, -2, 3.8, 2, k(BOOT));
  box(ctx, 0.6, -2, 3.8, 2, k(BOOT));
  const [aL, aR] = o.arms ?? [0.15, 0.15];
  for (const [side, a] of [
    [-1, aL],
    [1, aR],
  ] as const) {
    ctx.save();
    ctx.translate(side * 4.4, -15);
    ctx.rotate(side * a);
    box(ctx, -1.3, 0, 2.6, 7.5, k(COAT_DARK));
    disc(ctx, 0, 7.6, 1.5, k(GLOVE));
    ctx.restore();
  }
  poly(ctx, k(COAT), [-5.6, -15, -4.4, -16.4, 4.4, -16.4, 5.6, -15, 6, -5.5, -6, -5.5]);
  box(ctx, -0.35, -15.5, 0.7, 10, k(COAT_DARK));
  box(ctx, -6, -6.8, 12, 1.3, k(COAT_DARK));
  box(ctx, -4.4, -16.9, 8.8, 1.4, k(COAT_DARK));
  const sp = o.splat ?? 0;
  if (sp > 0)
    for (const [dx, dy, r] of [
      [0.5, -11, 2.4],
      [-1.6, -12.2, 1.4],
      [2.2, -9.6, 1.3],
      [-0.6, -9, 1.1],
      [2.4, -12.6, 0.8],
    ] as const)
      disc(ctx, dx, dy, r * (0.6 + 0.4 * sp), k(WHITE));
  // Back of the head: hair, plaits that swing when she whips round.
  oval(ctx, 0, -21, 5.6, 5.3, k(HAIR));
  line(ctx, k(HAIR_DARK), 0.35, [-2.2, -19.8, -1.6, -16.6]);
  line(ctx, k(HAIR_DARK), 0.35, [2.2, -19.8, 1.6, -16.6]);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 4.6, -19.6);
    ctx.rotate(side * 0.22 + (o.swing ?? 0) * 0.6);
    for (let i = 0; i < 3; i++) oval(ctx, 0, 0.8 + i * 1.6, 1.25, 1, k(i % 2 ? HAIR_DARK : HAIR));
    box(ctx, -1.2, 4.3, 2.4, 0.9, k(GLOVE));
    poly(ctx, k(HAIR), [-0.9, 5.2, 0.9, 5.2, 1.2, 6.8, 0, 6.2, -1.2, 6.8]);
    ctx.restore();
  }
  if (!o.bare) {
    dome(ctx, 0, -21.4, 6.2, 6.6, k(HAT));
    box(ctx, -6.3, -22.6, 12.6, 2.6, k(HAT_DARK));
    for (let i = -5.4; i <= 5; i += 1.4) box(ctx, i, -22.6, 0.45, 2.6, alpha(k('#7E2420'), 0.5));
    disc(ctx, 0.3, -28.4, 2, k(POM));
  } else line(ctx, k(HAIR_DARK), 0.5, [0, -26.2, 0, -21.6]);
  ctx.restore();
}

// ——— June, close ———
type EyeK = 'shut' | 'open' | 'wide' | 'narrow' | 'happy';
type MouthK = 'o' | 'flat' | 'smile' | 'open' | 'gape' | 'grin' | 'laugh';
type Face = {
  eyes: EyeK;
  /** The screen-right eye, when it does something else (it is the one that peeks). */
  right?: EyeK;
  look?: number;
  lookY?: number;
  /** + worried (inner ends up), − cross or suspicious (inner ends down). */
  brows?: number;
  raise?: number;
  mouth: MouthK;
  /** Three-quarter turn toward a side, −1 .. 1. */
  turn?: number;
  bare?: boolean;
  swing?: number;
  /** A breath puff, 0 → 1 through its drift. */
  puff?: number;
};
function eye(
  ctx: Ctx,
  ex: number,
  ey: number,
  side: number,
  kind: EyeK,
  look: number,
  lookY: number,
  k: Tone,
) {
  const lid = k(LID);
  if (kind === 'shut') {
    // Squeezed tight: two short strokes, pointing in at the nose.
    line(ctx, lid, 2.3, [ex + side * 4.2, ey - 3, ex - side * 3, ey, ex + side * 4.2, ey + 2.6]);
    return;
  }
  if (kind === 'happy') {
    line(ctx, lid, 2.3, [ex - 4.6, ey + 1.8, ex, ey - 2.6, ex + 4.6, ey + 1.8]);
    return;
  }
  const wide = kind === 'wide',
    narrow = kind === 'narrow';
  const rx = wide ? 5.6 : 4.7,
    ry = wide ? 6.6 : narrow ? 2.7 : 5.3;
  const cy = narrow ? ey + 1.6 : ey;
  oval(ctx, ex, cy, rx, ry, k('#FBF8F6'));
  const ir = wide ? 2.9 : narrow ? 2.3 : 3.2;
  const ix = ex + clamp(look, -1, 1) * (rx - ir - 0.4),
    iy = cy + clamp(lookY, -1, 1) * Math.max(0, ry - ir - 0.4) + (narrow ? 0.3 : 0.4);
  disc(ctx, ix, iy, ir, k('#3A2A24'));
  disc(ctx, ix - ir * 0.35, iy - ir * 0.4, ir * 0.32, k(WHITE));
  line(ctx, lid, narrow ? 2.8 : 1.7, [
    ex - rx - 0.4,
    cy - ry * 0.25,
    ex - rx * 0.5,
    cy - ry - 0.3,
    ex + rx * 0.5,
    cy - ry - 0.3,
    ex + rx + 0.4,
    cy - ry * 0.25,
  ]);
}
function brow(ctx: Ctx, ex: number, side: number, b: number, raise: number, kind: EyeK, k: Tone) {
  const y = -1.5 - raise * 2.4 - (kind === 'wide' ? 1.5 : 0);
  const inner = ex - side * 5.5,
    outer = ex + side * 5;
  line(ctx, k(HAIR_DARK), 2.4, [
    inner,
    y - b * 2.6,
    (inner + outer) / 2,
    y - b * 1.2 - 0.6,
    outer,
    y + b * 0.6,
  ]);
}
function mouth(ctx: Ctx, mx: number, m: MouthK, k: Tone) {
  const dark = k(MOUTH),
    tongue = k('#E07272'),
    teeth = k(WHITE),
    lip = k(LIP);
  switch (m) {
    case 'o':
      oval(ctx, mx, 23, 3, 3.6, dark);
      break;
    case 'flat':
      line(ctx, lip, 2, [mx - 5, 23, mx + 5, 23]);
      break;
    case 'smile':
      line(ctx, lip, 2, [mx - 7, 20.5, mx - 3, 23.8, mx + 3, 23.8, mx + 7, 20.5]);
      break;
    case 'open':
      oval(ctx, mx, 24, 5.4, 4.6, dark);
      oval(ctx, mx, 26.4, 3.4, 1.6, tongue);
      break;
    case 'gape':
      oval(ctx, mx, 26, 6.4, 8.4, dark);
      oval(ctx, mx, 31, 4.4, 2.4, tongue);
      break;
    case 'grin':
      poly(ctx, dark, [mx - 10, 19.5, mx + 10, 19.5, mx + 7, 25.5, mx, 27.5, mx - 7, 25.5]);
      poly(ctx, teeth, [mx - 9.4, 19.5, mx + 9.4, 19.5, mx + 8.6, 21.8, mx - 8.6, 21.8]);
      break;
    case 'laugh':
      poly(ctx, dark, [mx - 10.5, 19, mx + 10.5, 19, mx + 7.5, 28, mx, 31, mx - 7.5, 28]);
      poly(ctx, teeth, [mx - 9.8, 19, mx + 9.8, 19, mx + 9, 21.4, mx - 9, 21.4]);
      oval(ctx, mx, 28, 4.6, 2.2, tongue);
      break;
  }
}
/** June's face, head radius 30 at s = 1, centred on (x, y). */
function juneHead(ctx: Ctx, x: number, y: number, s: number, tilt: number, f: Face, k: Tone) {
  const turn = f.turn ?? 0,
    dx = turn * 5;
  const skin = k(SKIN),
    shadeC = k(SKIN_SHADE),
    hair = k(HAIR),
    hairDark = k(HAIR_DARK);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(s, s);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 25 - dx * 0.4, 6);
    ctx.rotate(side * 0.16 + (f.swing ?? 0) * 0.5);
    for (let i = 0; i < 3; i++)
      oval(ctx, 0, 5 + i * 7, 5.4 - i * 0.5, 4.4, i % 2 ? hairDark : hair);
    box(ctx, -3.6, 23.5, 7.2, 3, k(GLOVE));
    poly(ctx, hair, [-3.4, 26.5, 3.4, 26.5, 4.6, 32.5, 0, 30, -4.6, 32.5]);
    ctx.restore();
  }
  oval(ctx, -29 + dx * 0.3, 9, 4, 6, shadeC);
  oval(ctx, 29 + dx * 0.3, 9, 4, 6, shadeC);
  oval(ctx, 0, 3, 30, f.mouth === 'gape' ? 32 : 30, skin);
  if (f.bare) {
    dome(ctx, 0, -1, 31, 31, hair);
    poly(ctx, hair, [-30, -1, -22, -8, -14, -2, -5, -9, 4, -3, 13, -9, 21, -2, 30, -6, 30, -1]);
    line(ctx, hairDark, 1.6, [dx * 0.6 + 2, -31, dx * 0.6, -10]);
  }
  oval(ctx, -17 + dx, 16, 6.2, 3.8, alpha(k(CHEEK), 0.55));
  oval(ctx, 17 + dx, 16, 6.2, 3.8, alpha(k(CHEEK), 0.55));
  for (const side of [-1, 1] as const) {
    const kind = side > 0 && f.right ? f.right : f.eyes;
    const ex = side * 12 + dx;
    eye(ctx, ex, 7, side, kind, f.look ?? 0, f.lookY ?? 0, k);
    brow(ctx, ex, side, f.brows ?? 0, f.raise ?? 0, kind, k);
  }
  oval(ctx, dx * 1.3, 14, 3.4, 2.6, shadeC);
  box(ctx, dx * 1.3 - 1.6, 12.4, 1.6, 1, alpha(WHITE, 0.55));
  mouth(ctx, dx * 1.1, f.mouth, k);
  if (!f.bare) {
    dome(ctx, 0, -9, 33.5, 29, k(HAT));
    dome(ctx, -9, -11, 13, 20, alpha(k('#F2705E'), 0.35));
    box(ctx, -34.5, -16, 69, 10, k(HAT_DARK));
    for (let i = -30; i <= 28; i += 6) box(ctx, i, -16, 2, 10, alpha(k('#7E2420'), 0.45));
    disc(ctx, 2, -40, 9, k(POM));
    disc(ctx, 5, -37, 4.5, alpha(k('#D9D2DA'), 0.65));
  }
  const pf = f.puff ?? -1;
  if (pf > 0 && pf < 1) breath(ctx, dx * 1.1 + 6, 22, pf, 4.4);
  ctx.restore();
}
/** Her shoulders under a close-up: coat, collar, and the scarf if she is wearing it. */
function bust(ctx: Ctx, x: number, y: number, s: number, k: Tone) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  box(ctx, -9, 26, 18, 14, k(SKIN_SHADE));
  poly(ctx, k(COAT), [-60, 96, -52, 54, -24, 38, 24, 38, 52, 54, 60, 96]);
  poly(ctx, k(COAT_DARK), [-24, 38, 24, 38, 15, 47, -15, 47]);
  box(ctx, -1, 47, 2, 50, k(COAT_DARK));
  ctx.restore();
}
/** A navy gloved hand for the close-ups: palm (x, y), fingers pointing along `angle`. */
function bigGlove(ctx: Ctx, x: number, y: number, angle: number, s: number, k: Tone) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  const c = k(GLOVE),
    hi = k('#3A4478');
  oval(ctx, 0, 0, 7, 8, c);
  for (let i = 0; i < 4; i++) {
    const fx = -4.5 + i * 3,
      a = (i - 1.5) * 0.12;
    line(ctx, c, 3, [fx, -2, fx + Math.sin(a) * 9, -2 - Math.cos(a) * 9]);
  }
  line(ctx, c, 3, [5, 1, 9, -3]);
  line(ctx, hi, 0.8, [-5, 3, 4, 3]);
  ctx.restore();
}

// ——— Scenery ———
function houses(ctx: Ctx, g: Grade, door: number, seconds: number, inDoor = -1) {
  const { l } = g;
  HOUSES.forEach(([x, w, h, r], i) => {
    const top = BASE - h;
    box(ctx, x, top, w, h, i % 2 ? l.wall : mix(l.wall, l.wallDark, 0.4));
    box(ctx, x + w - 5, top, 5, h, l.wallDark);
    const cx = x + w * (i % 2 ? 0.7 : 0.22);
    box(ctx, cx, top - r * 0.8, 5, r * 0.8, l.wallDark);
    box(ctx, cx - 1, top - r * 0.8 - 2, 7, 2.5, l.roof);
    if (i % 3 === 1)
      for (let j = 0; j < 3; j++) {
        const u = (seconds * 0.22 + j / 3 + i * 0.17) % 1;
        disc(
          ctx,
          cx + 2.5 + u * 6 + Math.sin(u * 5 + i) * 1.5,
          top - r * 0.8 - 4 - u * 18,
          1.6 + u * 2.4,
          alpha(l.roofShade, 0.45 * (1 - u)),
        );
      }
    poly(ctx, l.roof, [x - 5, top + 2, x + w / 2, top - r, x + w + 5, top + 2]);
    box(ctx, x - 5, top + 1, w + 10, 2, l.roofShade);
    const wins = i === HOME ? [x + 7, x + w - 15] : [x + w * 0.2, x + w * 0.6];
    for (const wx of wins) {
      const wy = top + h * 0.28;
      if (l.glow > 0) glow(ctx, wx + 3.5, wy + 4, 13, l.window, l.glow * 0.45);
      box(ctx, wx, wy, 7, 8, l.window);
      box(ctx, wx + 3, wy, 1, 8, l.wallDark);
      box(ctx, wx, wy + 4, 7, 1, l.wallDark);
      box(ctx, wx - 1, wy + 8, 9, 1.5, l.roof);
    }
    if (i === HOME) frontDoor(ctx, g, door, inDoor, seconds);
  });
}
/**
 * Her front door. `inDoor` (0 → 1) is June in the doorway from behind, walking into the warm
 * light; the door leaf, drawn after her, wipes her out of sight as it shuts.
 */
function frontDoor(ctx: Ctx, g: Grade, open: number, inDoor = -1, seconds = 0) {
  const { l, k } = g;
  const x = DOOR.x - 6,
    y = DOOR.y - 20;
  if (open > 0) {
    if (l.glow > 0) glow(ctx, DOOR.x, DOOR.y - 8, 26, l.window, 0.55 * open);
    box(ctx, x, y, 12, 20, mix(l.wallDark, '#FFD58A', open));
    if (inDoor >= 0) {
      const sw = Math.sin(seconds * 12) * 0.25;
      juneBack(
        ctx,
        DOOR.x + 0.5,
        DOOR.y - inDoor * 2,
        lerp(0.7, 0.6, inDoor),
        { bare: true, arms: [0.15 + sw, 0.15 - sw] },
        g,
      );
    }
    box(ctx, x - 1, y, lerp(12, 3, open), 20, k('#7A3A36'));
  } else {
    box(ctx, x, y, 12, 20, k('#8A3E38'));
    box(ctx, x + 1.5, y + 2, 9, 7, k('#7A3530'));
    box(ctx, x + 1.5, y + 11, 9, 7, k('#7A3530'));
    disc(ctx, x + 9.5, y + 11, 0.8, k('#E6C070'));
    // A wreath.
    disc(ctx, DOOR.x, y + 6, 3.4, k(LEAF_DARK));
    disc(ctx, DOOR.x, y + 6, 1.8, k('#8A3E38'));
    box(ctx, DOOR.x - 1, y + 8.5, 2, 1.5, k(HAT));
  }
  box(ctx, x - 1, y - 1.5, 14, 1.5, l.roofShade);
}
function doorLight(ctx: Ctx, g: Grade, open: number) {
  if (open <= 0) return;
  faded(ctx, open * 0.5, () =>
    poly(ctx, g.l.window, [
      DOOR.x - 6,
      DOOR.y,
      DOOR.x + 6,
      DOOR.y,
      DOOR.x + 16,
      DOOR.y + 16,
      DOOR.x - 10,
      DOOR.y + 16,
    ]),
  );
}
function ground(ctx: Ctx, g: Grade) {
  const { l } = g;
  box(ctx, -10, BASE - 2, WORLD.w + 20, WORLD.h - BASE + 12, l.snow);
  box(ctx, -10, BASE - 2, WORLD.w + 20, 6, l.far);
  box(ctx, -10, BASE + 4, WORLD.w + 20, 2, mix(l.far, l.snow, 0.5));
  for (const [x, y, rx, ry] of DRIFTS) oval(ctx, x, y, rx, ry, alpha(l.shadow, 0.35));
}
function band(ctx: Ctx, x0: number, x1: number, y: number, h0: number, h1: number, c: string) {
  poly(ctx, c, [x0, y - h0, x1, y - h1, x1, y + h1, x0, y + h0]);
}
/** The green grass stripes the balls rolled up, and the round prints of every tableau so far. */
function marksOnGround(ctx: Ctx, g: Grade, t: number) {
  const { l } = g;
  if (t >= ROLL) {
    const u = ease(span(t, ROLL, BODY_SET));
    band(ctx, 192, lerp(196, BUILD - 6, u), 153, 1, 1 + u * 2.6, l.grass);
  }
  if (t >= SMALL_ROLL) {
    const u = ease(span(t, SMALL_ROLL, LIFT));
    band(ctx, lerp(350, 322, u), 352, 155, 1 + u * 1.6, 1, l.grass);
  }
  if (t >= SPINS[2]) band(ctx, 214, 246, 157, 1.8, 1, l.grass);
  if (t >= SPINS[0]) {
    // Where it was built: a flattened round patch at the end of its grass stripe, empty.
    oval(ctx, BUILD, 151, 17, 4.6, alpha(l.roof, 0.9));
    oval(ctx, BUILD, 151.2, 15, 3.5, l.shadow);
    oval(ctx, BUILD, 151.6, 11, 2.3, mix(l.shadow, l.rim, 0.3));
    line(ctx, alpha(l.roof, 0.9), 1, [BUILD - 13, 149, BUILD, 147.9, BUILD + 13, 149]);
  }
  for (const [from, x, y] of PRINTS)
    if (t >= from) {
      // The first two prints are the first clue, so they are the plainest.
      const first = from === SPINS[0];
      oval(
        ctx,
        x,
        y,
        first ? 3.2 : 2.5,
        first ? 1.6 : 1.2,
        first ? mix(l.shadow, l.rim, 0.4) : l.shadow,
      );
    }
}
function bench(ctx: Ctx, g: Grade) {
  const { l } = g;
  const { x, y } = BENCH;
  const wood = l.bench,
    dark = mix(l.bench, '#1A1420', 0.35);
  // Snow banked up under the seat.
  poly(ctx, l.snow, [
    x - 19,
    y + 1,
    x - 16,
    y - 6,
    x - 6,
    y - 8,
    x + 6,
    y - 7.5,
    x + 16,
    y - 6,
    x + 19,
    y + 1,
  ]);
  line(ctx, l.roof, 1, [x - 16, y - 6, x - 6, y - 8, x + 6, y - 7.5, x + 16, y - 6]);
  box(ctx, x - 15, y - 8, 2, 8, dark);
  box(ctx, x + 13, y - 8, 2, 8, dark);
  box(ctx, x - 17, y - 19, 2, 11, dark);
  box(ctx, x + 15, y - 19, 2, 11, dark);
  box(ctx, x - 18, y - 10, 36, 2.5, wood);
  box(ctx, x - 18, y - 18, 36, 2, wood);
  box(ctx, x - 18, y - 14.5, 36, 2, wood);
  box(ctx, x - 18, y - 11.4, 36, 1.5, l.roof);
  box(ctx, x - 18, y - 19.2, 36, 1.3, l.roof);
  oval(ctx, x, y + 0.5, 20, 2, alpha(l.shadow, 0.8));
}
function scarfOnStub(ctx: Ctx, g: Grade) {
  const { k } = g;
  const { x, y } = STUB;
  box(ctx, x - 3, y - 2.6, 6, 4, k(SCARF));
  box(ctx, x - 3, y + 1, 2.6, 15, k(SCARF));
  box(ctx, x + 0.6, y + 1, 2.6, 11.5, k(SCARF_DARK));
  box(ctx, x - 3, y + 5, 2.6, 1, k(SCARF_DARK));
  box(ctx, x - 3, y + 10, 2.6, 1, k(SCARF_DARK));
  for (let i = 0; i < 3; i++) box(ctx, x - 3 + i, y + 16, 0.6, 1.6, k(SCARF));
}
function oak(ctx: Ctx, g: Grade, t: number) {
  const { l } = g;
  poly(ctx, l.oak, [50, 151, 70, 151, 67, 128, 66, 92, 65, 56, 57, 52, 56, 92, 54, 128]);
  poly(ctx, l.oak, [43, 151, 52, 140, 58, 151]);
  poly(ctx, l.oak, [62, 151, 68, 139, 77, 151]);
  for (const gx of [56, 60, 63.5]) line(ctx, l.oakDark, 1, [gx, 148, gx + 0.6, 112, gx - 0.5, 72]);
  box(ctx, 65, 64, 1.6, 84, l.oakDark);
  for (const [w, pts] of LIMBS) line(ctx, l.oak, w, pts);
  for (const [w, pts] of LIMBS.slice(0, 3))
    line(
      ctx,
      l.roof,
      1,
      pts.map((v, i) => (i % 2 ? v - w * 0.5 : v)),
    );
  // The low stub at June's head height, snow along its top (and a gap where the scarf hung).
  line(ctx, l.oak, 3.6, [65, 122, 77, 120, STUB.x + 3, STUB.y]);
  if (t >= SCARF_HUNG) {
    line(ctx, l.roof, 1.1, [67, 119.6, 77, 118.2, STUB.x - 3.6, STUB.y - 1.6]);
    box(ctx, STUB.x + 3, STUB.y - 2.6, 1.6, 1, l.roof);
  } else line(ctx, l.roof, 1.1, [67, 119.6, 77, 118.2, STUB.x + 3, STUB.y - 2]);
  oval(ctx, OAK_X, 151, 18, 2.5, l.roof);
  if (t >= SCARF_HUNG && t < SPINS[2]) scarfOnStub(ctx, g);
}
/** The snow fort: two courses of blocks, and a pyramid of snowballs ready on top. */
function fort(ctx: Ctx, g: Grade) {
  const { l } = g;
  oval(ctx, 325, 155, 92, 3, alpha(l.shadow, 0.9));
  for (let course = 0; course < 2; course++)
    for (let i = 0; i < 7; i++) {
      const bx = 238 + i * 24 + (course ? 12 : 0),
        by = 148 - course * 7;
      if (course && i === 6) continue;
      box(ctx, bx, by, 23, 7, l.rim);
      box(ctx, bx + 0.5, by + 0.5, 22, 6, l.bodyShade);
      box(ctx, bx + 0.5, by + 0.5, 22, 3.5, l.body);
    }
  for (const [bx, by] of [
    [300, 139],
    [306, 139],
    [312, 139],
    [303, 135],
    [309, 135],
    [306, 131],
  ] as const) {
    disc(ctx, bx, by, 3, l.rim);
    disc(ctx, bx - 0.4, by - 0.4, 2.5, l.body);
  }
}
/**
 * Her hat where it fell: tipped on its side in the shape she wore it (crown, ribbed band, white
 * pompom sticking out sideways), with a ridge of snow settled along its top.
 */
function hatInSnow(ctx: Ctx, g: Grade, x: number, y: number, s: number) {
  const { l } = g;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  oval(ctx, -0.5, 0.4, 9, 1.8, alpha(l.shadow, 0.95));
  ctx.save();
  // On its side and a little slumped, the way a dropped knit hat lies.
  ctx.translate(0, -5);
  ctx.scale(1, 0.74);
  ctx.rotate(-1.5);
  // Hat coordinates: the origin is the middle of the band's open edge, the crown is up.
  ctx.translate(0, 4);
  hatShape(ctx, g);
  // Snow settled along its upper side.
  line(ctx, l.roof, 1.3, [7, 0.2, 7, -2.6, 6.6, -3.1, 5.8, -5]);
  ctx.restore();
  ctx.restore();
}
/** Her hat off her head: crown up, origin at the middle of the band's open edge. */
function hatShape(ctx: Ctx, g: Grade) {
  const { l, k } = g;
  const kp = g.pop ?? k;
  dome(ctx, 0, -1.2, 6.2, 6.6, kp(HAT));
  dome(ctx, -2.2, -1.6, 2.6, 4.8, alpha(kp('#F2705E'), 0.4));
  box(ctx, -6.3, -2.6, 12.6, 2.6, kp(HAT_DARK));
  for (let i = -5.4; i <= 5; i += 1.4) box(ctx, i, -2.6, 0.45, 2.6, alpha(kp('#7E2420'), 0.55));
  oval(ctx, 0, 0.1, 6.1, 0.9, kp('#5A1A1A'));
  disc(ctx, 0.2, -8.1, 2.2, l.rim);
  disc(ctx, 0.2, -8.1, 1.8, k(POM));
}

type SceneO = {
  door?: number;
  /** June in her doorway, 0 → 1 (see frontDoor). */
  inDoor?: number;
  noOak?: boolean;
  fort?: boolean;
  hat?: boolean;
  snow?: number;
  vignette?: number;
};
/** The whole green through a camera: sky, houses, snow, marks, bench, oak, then everyone by depth. */
function scene(
  ctx: Ctx,
  view: View,
  g: Grade,
  t: number,
  seconds: number,
  actors: Actor[],
  o: SceneO = {},
) {
  const { l } = g;
  sky(ctx, [l.skyTop, l.skyLow], 0, 120);
  if (g.dusk)
    starfield(ctx, seconds, { count: 16, seed: 5, bottom: 60, colors: ['#FFE9B8', '#C9C2F0'] });
  camera(
    ctx,
    view,
    () => {
      houses(ctx, g, o.door ?? 0, seconds, o.inDoor);
      ground(ctx, g);
      doorLight(ctx, g, o.door ?? 0);
      marksOnGround(ctx, g, t);
      actors.push([BENCH.y, () => bench(ctx, g)]);
      if (!o.noOak) oak(ctx, g, t);
      if (o.fort) actors.push([152, () => fort(ctx, g)]);
      if (o.hat) actors.push([HAT_SPOT.y, () => hatInSnow(ctx, g, HAT_SPOT.x, HAT_SPOT.y, 1.6)]);
      stage(actors);
    },
    WORLD,
  );
  snowfall(ctx, seconds, {
    amount: o.snow ?? 0.7,
    speed: 10,
    color: g.dusk ? '#E6E4FA' : WHITE,
    seed: 11,
  });
  vignette(ctx, o.vignette ?? 0.32, g.dusk ? '#1A1838' : '#5A4A5E');
}
/** Every snowman of the tableau on at time t, as actors. */
function cast(ctx: Ctx, t: number, g: Grade, marks = marksAt(t)): Actor[] {
  return tableauAt(t).cast.map((sm) => [sm.y, () => snowman(ctx, sm, g, marks)] as const);
}

// ——— The soft world behind a close-up ———
const SOFT_HOUSES: readonly (readonly [number, number, number])[] = [
  [130, 70, 44],
  [206, 54, 52],
  [262, 76, 40],
];
function beyond(ctx: Ctx, g: Grade, horizon = 116) {
  const { l } = g;
  box(ctx, 0, 0, W, horizon, l.skyLow);
  box(ctx, 0, 0, W, horizon * 0.42, mix(l.skyTop, l.skyLow, 0.35));
  for (const [x, w, h] of SOFT_HOUSES) {
    const wall = mix(l.wall, l.skyLow, 0.5);
    box(ctx, x, horizon - h, w, h, wall);
    poly(ctx, mix(l.roof, l.skyLow, 0.35), [
      x - 8,
      horizon - h + 2,
      x + w / 2,
      horizon - h - 22,
      x + w + 8,
      horizon - h + 2,
    ]);
    box(ctx, x + w * 0.22, horizon - h * 0.7, 12, 14, mix(l.window, wall, 0.35));
    box(ctx, x + w * 0.62, horizon - h * 0.7, 12, 14, mix(l.window, wall, 0.35));
  }
  box(ctx, 0, horizon, W, H - horizon, l.snow);
  box(ctx, 0, horizon, W, 6, mix(l.far, l.snow, 0.3));
}
/** Oak bark filling the frame from x0 to x1. */
function bark(ctx: Ctx, g: Grade, x0: number, x1: number) {
  const { l } = g;
  box(ctx, x0, -20, x1 - x0, H + 40, l.oak);
  const ridge = mix(l.oak, '#9A8484', 0.25);
  for (let i = 0; i < 8; i++) {
    const gx = x0 + 10 + i * ((x1 - x0 - 16) / 8) + rand(i * 3.7) * 5;
    line(ctx, l.oakDark, 2.2 + rand(i + 0.5) * 1.6, [
      gx,
      -20,
      gx + 3,
      40,
      gx - 2,
      100,
      gx + 2,
      200,
    ]);
    line(ctx, ridge, 1, [gx + 4, -20, gx + 6, 50, gx + 3, 120, gx + 5, 200]);
  }
  box(ctx, x1 - 8, -20, 8, H + 40, l.oakDark);
  const kx = x0 + (x1 - x0) * 0.45;
  oval(ctx, kx, 128, 7, 10, l.oakDark);
  oval(ctx, kx, 126, 4, 6, mix(l.oakDark, '#000000', 0.2));
  oval(ctx, kx - 1, 118, 6, 2, l.roof);
}
/** A close-up's own finish: light snow in front, soft corners. */
function closeFinish(ctx: Ctx, seconds: number) {
  snowfall(ctx, seconds, { amount: 0.38, speed: 9, color: WHITE, seed: 23 });
  vignette(ctx, 0.36, '#4A3A4E');
}

// ——— The shots ———
type ShotFn = (ctx: Ctx, t: number, seconds: number) => void;

/** 0–5: the green at morning, one child. She looks left, then right; then she makes a snowball. */
function openingShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G;
  const view = track(t, [
    [0, 200, 90, 1.0],
    [5, 214, 102, 1.12],
  ]);
  const crouch = ease(span(t, CROUCH, CROUCH + 0.35));
  const facing = t < LOOK_LEFT || t >= LOOK_RIGHT ? 1 : -1;
  const pat = crouch > 0.9 ? Math.abs(Math.sin((t - CROUCH) * 8)) : 0;
  // Right of centre, clear of the title card's subtitle at p = 0.
  const x = 258,
    y = 148;
  scene(ctx, view, g, t, seconds, [
    [
      y,
      () => {
        if (t >= CROUCH + 0.3) {
          const r = lerp(1.6, 3.6, span(t, CROUCH + 0.3, 5));
          disc(ctx, x + 9, y - r + 0.5, r + 0.6, g.l.rim);
          disc(ctx, x + 9, y - r + 0.5, r, g.l.body);
        }
        june(
          ctx,
          x,
          y,
          {
            facing,
            sitting: crouch > 0.5,
            lean: crouch * 0.3,
            arms: crouch > 0.5 ? [1.0 + pat * 0.3, 1.3 + pat * 0.35] : [0.12, 0.12],
            scarf: true,
            mouth: crouch > 0.5 ? 'smile' : 'flat',
            puff: crouch > 0.5 ? -1 : breathAt(seconds),
          },
          g,
        );
      },
    ],
  ]);
}

/** Construction: the big one's parts by time (used only before T0). */
function built(t: number): Parts {
  return {
    head: t >= HEAD_SET,
    eyes: t >= COALS[1] ? 2 : t >= COALS[0] ? 1 : 0,
    smile: t >= COALS[2],
    carrot: t >= CARROT,
    sticks: t >= STICKS[1] ? 2 : t >= STICKS[0] ? 1 : 0,
    blush: false,
  };
}
const HEAD_POS = { x: BUILD, y: 119.5 };

/** 5–11: low and side-on, rolling the body across the green, then the head, heaved on top. */
function rollingShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G,
    { l } = g;
  const view = track(t, [
    [5, 206, 126, 2.3],
    [BODY_SET, 294, 126, 2.3],
    [9.1, 318, 124, 2.15],
    [11, 316, 122, 2.15],
  ]);
  const roll = ease(span(t, ROLL, BODY_SET));
  const bx = lerp(198, BUILD, roll),
    br = lerp(4, 14, roll);
  const actors: Actor[] = [];
  // The rolling ball, or the body once it is set.
  if (t < BODY_SET)
    actors.push([
      150,
      () => {
        oval(ctx, bx, 150.5, br * 1.2, 2.2, alpha(l.shadow, 0.95));
        ball(ctx, bx, 150 - br * 0.96, br, br * 0.96, l);
        const turn = (bx - 198) / Math.max(4, br);
        for (let i = 0; i < 3; i++) {
          const a = turn + (i * TAU) / 3;
          disc(
            ctx,
            bx + Math.cos(a) * br * 0.6,
            150 - br + Math.sin(a) * br * 0.55,
            br * 0.12,
            alpha(l.rim, 0.6),
          );
        }
      },
    ]);
  else
    actors.push([
      150,
      () =>
        snowman(
          ctx,
          { kind: 'big', x: BUILD, y: 150, parts: built(t), arms: [0.35, 0.5] },
          g,
          NO_MARKS,
        ),
    ]);
  // The head ball: rolled fast, then lifted.
  const sr = lerp(3, 9, ease(span(t, SMALL_ROLL, LIFT)));
  const sx = lerp(348, 322, ease(span(t, SMALL_ROLL, LIFT)));
  if (t >= SMALL_ROLL && t < HEAD_SET) {
    const lift = ease(span(t, LIFT, HEAD_SET));
    const hx = lerp(sx, HEAD_POS.x + 1, lift),
      hy = lerp(150 - sr, HEAD_POS.y, lift) - Math.sin(lift * Math.PI) * 14;
    actors.push([lift > 0 ? 160 : 151, () => ball(ctx, hx, hy, sr, sr, l)]);
  }
  // June.
  let jx: number, facing: 1 | -1, o: JuneO;
  if (t < ROLL) {
    jx = bx - 10;
    facing = 1;
    o = { sitting: true, lean: 0.3, arms: [1.0, 1.2 + Math.abs(Math.sin(t * 8)) * 0.3] };
  } else if (t < BODY_SET) {
    jx = bx - br - 6;
    facing = 1;
    o = { lean: 0.45, arms: [1.35, 1.55], step: seconds * 10 };
  } else if (t < RUN_BACK) {
    jx = BUILD - 20;
    facing = 1;
    const wipe = hump(t, BODY_SET + 0.1, RUN_BACK);
    o = {
      lean: 0.45 * (1 - ease(span(t, BODY_SET, BODY_SET + 0.25))),
      arms: [0.2, 0.2 + wipe * 2.6],
      eyes: wipe > 0.4 ? 'closed' : 'open',
    };
  } else if (t < SMALL_ROLL) {
    jx = lerp(BUILD - 20, 356, ease(span(t, RUN_BACK, SMALL_ROLL)));
    facing = 1;
    o = { step: seconds * 16, lean: 0.12 };
  } else if (t < LIFT) {
    jx = sx + sr + 6;
    facing = -1;
    o = { lean: 0.42, arms: [1.35, 1.55], step: seconds * 14 };
  } else if (t < HEAD_SET) {
    const lift = ease(span(t, LIFT, HEAD_SET));
    jx = lerp(sx + sr + 4, 318, lift);
    facing = -1;
    o = {
      lean: lerp(0.3, -0.18, lift),
      arms: [lerp(1.3, 2.9, lift), lerp(1.5, 3.0, lift)],
      mouth: 'o',
      eyes: 'closed',
    };
  } else {
    const st = span(t, HEAD_SET, HEAD_SET + 0.6);
    jx = lerp(318, 330, easeOut(st));
    facing = -1;
    o = {
      lean: Math.sin(st * 14) * 0.22 * (1 - st) - 0.1,
      arms: [1.2 + Math.sin(st * 17) * 0.8, 1.6 + Math.cos(st * 15) * 0.8],
      eyes: st < 1 ? 'wide' : 'happy',
      mouth: st < 1 ? 'o' : 'grin',
    };
  }
  const running = o.step !== undefined;
  actors.push([
    153,
    () => june(ctx, jx, 153, { facing, scarf: true, tail: running ? 1.0 : 0.25, ...o }, g),
  ]);
  scene(ctx, view, g, t, seconds, actors);
}

/** 11–13.5: on the snowman's face, her gloves bringing coals, a carrot, two sticks. */
function dressingShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G,
    { k } = g;
  const view = track(t, [
    [11, HEAD_POS.x + 2, HEAD_POS.y + 4, 4.0],
    [13.5, HEAD_POS.x + 2, HEAD_POS.y + 3, 4.5],
  ]);
  const head = (lx: number, ly: number) => {
    const a = TIP.big,
      c = Math.cos(a),
      s = Math.sin(a);
    return { x: HEAD_POS.x + lx * c - ly * s, y: HEAD_POS.y + lx * s + ly * c };
  };
  // Where each glove goes, and when: [hit, target, side, item].
  const r = 9;
  const jobs = [
    [COALS[0], head(-r * 0.36, -r * 0.14), -1, 'coal'],
    [COALS[1], head(r * 0.36, -r * 0.14), 1, 'coal'],
    [COALS[2], head(0, r * 0.46), 1, 'coal'],
    [CARROT, head(r * 0.5, r * 0.15), 1, 'carrot'],
    [STICKS[0], { x: BUILD - 14, y: 133 }, -1, 'stick'],
    [STICKS[1], { x: BUILD + 14, y: 133 }, 1, 'stick'],
  ] as const;
  const glovePos = (side: number) => {
    const rest = { x: BUILD + side * 34, y: 150 };
    let best = { ...rest, item: '', reach: 0 };
    for (const [hit, target, sd, item] of jobs) {
      if (sd !== side) continue;
      const reach = ease(span(t, hit - 0.32, hit)) * (1 - ease(span(t, hit + 0.06, hit + 0.34)));
      if (reach > best.reach)
        best = {
          x: lerp(rest.x, target.x + side * 2.5, reach),
          y: lerp(rest.y, target.y + 2, reach),
          item: t < hit ? item : '',
          reach,
        };
    }
    return best;
  };
  scene(
    ctx,
    view,
    g,
    t,
    seconds,
    [
      [
        150,
        () =>
          snowman(
            ctx,
            { kind: 'big', x: BUILD, y: 150, parts: built(t), arms: [0.35, 0.5] },
            g,
            NO_MARKS,
          ),
      ],
      [
        170,
        () => {
          for (const side of [-1, 1]) {
            const h = glovePos(side);
            line(ctx, k(COAT), 5, [h.x + side * 3, h.y + 3, BUILD + side * 40, 170]);
            line(ctx, k(COAT_DARK), 5.4, [
              h.x + side * 2.2,
              h.y + 2.2,
              h.x + side * 3.4,
              h.y + 3.4,
            ]);
            oval(ctx, h.x, h.y, 2.9, 2.5, k(GLOVE));
            oval(ctx, h.x - side * 2.2, h.y - 1, 1.1, 1.6, k(GLOVE), side * 0.5);
            if (h.item === 'coal') disc(ctx, h.x - side * 2.4, h.y - 1.8, 1.1, k(COAL));
            if (h.item === 'carrot') carrot(ctx, h.x - side * 1.5, h.y - 1.5, Math.PI, 8.5, k);
            if (h.item === 'stick')
              line(ctx, k(TWIG), 1.5, [h.x - side, h.y - 1, h.x + side * 8, h.y + 5]);
          }
        },
      ],
    ],
    { snow: 0.45 },
  );
}

/** 13.5–17: the two of them. She looks round: nobody else is out. She shrugs. */
function twoShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G;
  const view = track(t, [
    [13.5, 290, 124, 2.3],
    [14.2, 288, 124, 2.3],
    [15.1, 196, 120, 2.0],
    [15.4, 196, 120, 2.0],
    [16.0, 286, 124, 2.3],
    [17, 288, 124, 2.4],
  ]);
  const back = easeOut(span(t, 13.5, 13.95));
  const x = lerp(279, 262, back);
  const looking = t >= 14.0 && t < 15.6;
  const shrug = hump(t, SHRUG - 0.15, SHRUG + 0.55);
  const after = t >= SHRUG + 0.55;
  scene(ctx, view, g, t, seconds, [
    ...cast(ctx, t, g),
    [
      153,
      () =>
        june(
          ctx,
          x,
          153,
          {
            facing: looking ? -1 : 1,
            step: back > 0 && back < 1 ? seconds * 12 : undefined,
            arms: shrug > 0.05 ? [shrug * 1.4, shrug * 1.4] : after ? [0.1, 0.5] : [0.15, 0.25],
            lean: shrug * -0.06,
            eyes: !looking && shrug > 0.3 ? 'happy' : 'open',
            mouth: after ? 'grin' : shrug > 0.3 ? 'flat' : 'smile',
            scarf: true,
            puff: breathAt(seconds),
          },
          g,
        ),
    ],
  ]);
}

/** 17–20: the game, mimed in one wide: you, me, eyes shut. She marches to the oak. */
function gameShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G;
  // Wide on the oak and the snowman, in on her for the mime, and back out for the march.
  const view = track(t, [
    [17.0, 182, 90, 1.0],
    [17.75, 186, 112, 1.45],
    [18.5, 186, 112, 1.45],
    [18.9, 182, 90, 1.0],
  ]);
  const [toMan, toOak, mime] = POINTS;
  let x = 172,
    facing: 1 | -1 = -1,
    arms: readonly [number, number] = [0.12, 0.15],
    step: number | undefined,
    eyes: Figure['eyes'] = 'open',
    lean = 0;
  if (t < toOak - 0.35) {
    facing = 1;
    arms = [0.1, 1.65 * ease(span(t, 17.0, toMan))];
  } else if (t < mime - 0.2) arms = [0.1, 1.65 * ease(span(t, toOak - 0.3, toOak))];
  else if (t < MARCH) {
    const m = hump(t, mime - 0.2, MARCH + 0.05);
    arms = [m * 2.7, m * 2.75];
    eyes = m > 0.5 ? 'closed' : 'open';
  } else if (t < 19.05) {
    x = lerp(172, 98, span(t, MARCH, 19.05));
    step = seconds * 18;
  } else if (t < 19.35) {
    x = 98;
    arms = [0.1, 2.5 * hump(t, 19.0, 19.4) + 0.2];
  } else if (t < 19.75) {
    x = lerp(98, 75, span(t, 19.35, 19.75));
    step = seconds * 14;
  } else {
    x = 75;
    const lean0 = ease(span(t, 19.75, FACE_TRUNK + 0.1));
    arms = [lean0 * 2.2, lean0 * 2.4];
    lean = lean0 * 0.22;
    eyes = 'closed';
  }
  scene(ctx, view, g, t, seconds, [
    ...cast(ctx, t, g),
    [
      152,
      () =>
        june(
          ctx,
          x,
          152,
          {
            facing,
            arms,
            step,
            eyes,
            lean,
            scarf: t < SCARF_HUNG,
            tail: step !== undefined ? 1.1 : 0.2,
            mouth: t < MARCH ? 'grin' : 'smile',
          },
          g,
        ),
    ],
  ]);
}

/** A count: June's face against the oak, eyes shut, lips counting, a breath every second beat. */
function countShot(ctx: Ctx, t: number, seconds: number, round: number) {
  const g = MORNING_G,
    { k } = g;
  const [from, to] = COUNTS[round];
  const beat = 60 / COUNT_BPM[round];
  const beatN = Math.floor((t - from) / beat);
  const zoom = 1 + round * 0.035 + 0.05 * ease(span(t, from, to));
  // The peek: a hand up over her eyes, two fingers apart; later shut again and down.
  const peekRound = round === 3;
  const hand = !peekRound
    ? 0
    : t < UNPEEK
      ? ease(span(t, FINGERS, FINGERS + 0.3))
      : 1 - ease(span(t, UNPEEK + 0.25, UNPEEK + 0.6));
  const part = !peekRound
    ? 0
    : t < UNPEEK
      ? ease(span(t, FINGERS + 0.4, FINGERS + 0.75))
      : 1 - ease(span(t, UNPEEK, UNPEEK + 0.2));
  const snap = span(t, to - 0.14, to);
  const counting = hand < 0.05 && snap <= 0;
  const oneEye = round === 4 && t >= ONE_EYE;
  const peeking = oneEye || part > 0.4;
  const face: Face = {
    eyes: snap > 0 ? 'wide' : 'shut',
    right: peeking && snap <= 0 ? 'open' : undefined,
    look: peeking ? 0.9 : snap > 0 ? 0.6 : 0,
    brows: round === 2 ? -0.9 : oneEye ? 1.1 : 0.35,
    mouth: snap > 0 ? 'o' : counting && !oneEye && beatN % 2 === 0 ? 'o' : 'flat',
    turn: -0.45 + snap * 0.6,
    puff: counting && !oneEye ? ((t - from) / (beat * 2)) % 1 : -1,
  };
  ctx.save();
  ctx.translate(150, 96);
  ctx.scale(zoom, zoom);
  ctx.translate(-150 + snap * 6, -96);
  beyond(ctx, g);
  bark(ctx, g, -20, 112);
  // Her shoulders, and her arm up against the oak with her forehead resting on it.
  bust(ctx, 178, 98, 1.15, k);
  line(ctx, k(COAT), 26, [150, 200, 124, 74]);
  line(ctx, k(COAT_DARK), 8, [140, 200, 116, 76]);
  line(ctx, k(COAT_DARK), 27, [125, 80, 123.4, 74]);
  bigGlove(ctx, 116, 62, -0.35, 1.5, k);
  juneHead(ctx, 172, 98, 1.12, -0.14, face, k);
  if (hand > 0) {
    // Her other hand, up over her eyes; two fingers part for a look.
    const hy = lerp(200, 104, hand);
    line(ctx, k(COAT), 22, [250, 220, 196, hy + 40]);
    ctx.save();
    ctx.translate(172, 98);
    ctx.rotate(-0.14);
    ctx.translate(-172, -98);
    const c = k(GLOVE),
      hi = k('#3A4478');
    oval(ctx, 182, hy + 30, 24, 15, c);
    for (let i = 0; i < 4; i++) {
      const fx = 157 + i * 10.5;
      const a = i === 2 ? -0.32 * part : i === 3 ? 0.36 * part : 0;
      line(ctx, c, 9.4, [fx, hy + 24, fx + Math.sin(a) * 34, hy + 24 - Math.cos(a) * 34]);
      line(ctx, hi, 1, [
        fx - 2.4,
        hy + 20,
        fx - 2.4 + Math.sin(a) * 24,
        hy + 20 - Math.cos(a) * 24,
      ]);
    }
    line(ctx, c, 9, [204, hy + 32, 214, hy + 16]);
    ctx.restore();
  }
  ctx.restore();
  closeFinish(ctx, seconds);
}

/** Over her shoulder at the oak, looking out at the green: the reveals. */
function overShoulder(
  ctx: Ctx,
  t: number,
  seconds: number,
  spin: number,
  view: View,
  side: -1 | 1 = -1,
) {
  const g = gradeAt(t),
    { l, k } = g;
  scene(ctx, view, g, t, seconds, cast(ctx, t, g), { noOak: side < 0 });
  // Her plaits still swinging from the spin.
  const swing = Math.sin((t - spin) * 13) * Math.exp(-(t - spin) * 3.2) * 1.1;
  if (side < 0) {
    // The oak's edge, and the stub with her scarf on it, close in the left foreground.
    box(ctx, 0, 0, 12, H, l.oak);
    box(ctx, 9, 0, 3, H, l.oakDark);
    line(ctx, l.oak, 8, [0, 34, 26, 38]);
    line(ctx, l.roof, 2.2, [0, 29.5, 24, 33.5]);
    if (t < SPINS[2]) {
      poly(ctx, k(SCARF), [12, 30, 24, 32, 23, 40, 13, 38]);
      box(ctx, 13, 38, 6, 30, k(SCARF));
      box(ctx, 19, 38, 5, 24, k(SCARF_DARK));
      for (const y of [46, 56]) box(ctx, 13, y, 6, 2, k(SCARF_DARK));
    }
    juneBack(ctx, 36, 226, 5.4, { swing }, g);
  } else juneBack(ctx, 286, 226, 5.4, { swing: -swing, splat: 1 }, g);
}
/** Each reveal from where she stands; the third pushes in so the scarf reads. */
const REVEAL_VIEWS: readonly View[] = [
  { x: 228, y: 116, zoom: 1.3 },
  { x: 205, y: 116, zoom: 1.35 },
  { x: 200, y: 128, zoom: 1.8 },
  { x: 188, y: 124, zoom: 1.42 },
];

/** 24.8–26: she rubs her eyes with both fists. */
function rubShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G,
    { k } = g;
  const drop = ease(span(t, RUB + 0.7, RUB + 0.95));
  beyond(ctx, g, 122);
  bark(ctx, g, -40, 30);
  const x = 168,
    y = 92;
  bust(ctx, x, y, 1.05, k);
  juneHead(
    ctx,
    x,
    y,
    1.05,
    0.02,
    {
      eyes: drop > 0.5 ? 'wide' : 'shut',
      mouth: drop > 0.5 ? 'o' : 'flat',
      brows: 0.6,
      raise: drop,
      look: 0.2,
    },
    k,
  );
  // Two fists screwed into her eyes, rubbing; then down, and she stares.
  for (const side of [-1, 1]) {
    const a = (t - RUB) * 15 * side;
    const fx = x + side * 15 + Math.cos(a) * 2.5,
      fy = lerp(y + 12 + Math.sin(a) * 2, y + 74, drop);
    line(ctx, k(COAT), 19, [x + side * 50, 200, fx + side * 9, fy + 16]);
    line(ctx, k(COAT_DARK), 19.5, [fx + side * 7, fy + 12, fx + side * 9, fy + 16]);
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(side * (0.5 + Math.sin(a) * 0.12));
    const c = k(GLOVE),
      hi = k('#3E4A80');
    oval(ctx, 0, 1, 9.5, 8.5, c);
    for (let i = 0; i < 4; i++) disc(ctx, -6 + i * 4, -5.5, 2.6, c);
    for (let i = 0; i < 3; i++) line(ctx, hi, 0.9, [-4 + i * 4, -6.5, -4 + i * 4, -2.5]);
    oval(ctx, -side * 6.5, 2, 3, 4.5, c, -side * 0.5);
    line(ctx, hi, 0.9, [-6, 6, 5, 6]);
    ctx.restore();
  }
  closeFinish(ctx, seconds);
}

/** 30.5–34: she marches over, circles it, nose to its carrot, prods its tummy. Nothing. */
function inspectShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G;
  const view = track(t, [
    [30.5, 176, 124, 2.1],
    [PROD, 202, 122, 2.45],
    [BACK_AWAY, 202, 122, 2.45],
    [34, 168, 124, 2.15],
  ]);
  let x: number,
    y = 154,
    facing: 1 | -1,
    o: JuneO;
  if (t < 31.0) {
    x = lerp(140, 184, span(t, 30.5, 31.0));
    facing = 1;
    o = { step: seconds * 15, mouth: 'flat' };
  } else if (t < 31.55) {
    // Round the back of it, and out the other side.
    const u = span(t, 31.0, 31.55);
    x = lerp(184, 220, u);
    y = 154 - Math.sin(u * Math.PI) * 11;
    facing = 1;
    o = { step: seconds * 14, eyes: 'sleepy', mouth: 'flat' };
  } else if (t < BACK_AWAY) {
    const nose = hump(t, NOSE - 0.25, PROD - 0.1);
    const prod = hump(t, PROD - 0.15, PROD + 0.35);
    x = 216 - nose * 3 - prod;
    facing = -1;
    o =
      t < NOSE - 0.25
        ? { mouth: 'flat', arms: [0.1, 0.2] }
        : {
            lean: nose * 0.35,
            arms: [0.15, 0.2 + prod * 1.3],
            eyes: nose > 0.3 ? 'closed' : 'open',
            mouth: t > PROD + 0.2 ? 'flat' : 'o',
          };
  } else {
    const u = span(t, BACK_AWAY, 34);
    x = lerp(216, 160, u);
    y = lerp(154, 158, u);
    facing = 1;
    o = { step: seconds * 9, eyes: 'sleepy', mouth: 'flat', arms: [0.2, 0.2] };
  }
  scene(ctx, view, g, t, seconds, [
    ...cast(ctx, t, g),
    [y, () => june(ctx, x, y, { facing, ...o }, g)],
  ]);
}

/** 39.5–40.5: the stub of the branch. Bare. One yellow thread caught in the bark. */
function branchShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G;
  const view = track(t, [
    [39.5, STUB.x - 4, STUB.y + 2, 4.4],
    [40.5, STUB.x - 3, STUB.y + 2, 4.8],
  ]);
  scene(
    ctx,
    view,
    g,
    t,
    seconds,
    [
      [
        200,
        () =>
          line(ctx, g.k(SCARF), 0.35, [
            STUB.x - 2,
            STUB.y + 0.8,
            STUB.x - 1.4,
            STUB.y + 3,
            STUB.x - 2.2,
            STUB.y + 4.6,
          ]),
      ],
    ],
    { snow: 0.5 },
  );
}

/** 40.5–42: from the bare branch to the scarf on the little one. Her jaw drops. */
function jawShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G,
    { k } = g;
  beyond(ctx, g, 122);
  const drop = ease(span(t, JAW, JAW + 0.2));
  const look = t < 40.85 ? -1 : t < JAW - 0.05 ? 1 : 0.15;
  const x = 160,
    y = 90;
  const push = 1 + 0.05 * span(t, 40.5, 42);
  ctx.save();
  ctx.translate(160, 90);
  ctx.scale(push, push);
  ctx.translate(-160, -90);
  bust(ctx, x, y, 1.08, k);
  juneHead(
    ctx,
    x,
    y,
    1.08,
    0,
    {
      eyes: drop > 0.2 ? 'wide' : 'open',
      look,
      mouth: drop > 0.3 ? 'gape' : 'flat',
      brows: drop * 0.6,
      raise: drop,
      turn: look * 0.15,
    },
    k,
  );
  ctx.restore();
  closeFinish(ctx, seconds);
}

/** 45–47: her view between two gloved fingers. Everyone frozen mid-tiptoe; one says shh. */
function peekShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G,
    { k } = g;
  const drift = ease(span(t, PEEK, UNPEEK));
  scene(ctx, { x: 178, y: 128, zoom: 1.6 + drift * 0.08 }, g, t, seconds, cast(ctx, t, g), {
    noOak: true,
  });
  const shake = Math.sin(seconds * 7.3) * 0.7;
  const edge = (y: number, side: number) =>
    166 + shake + side * (16 + 46 * Math.sin(Math.PI * clamp((y + 30) / (H + 60))));
  const finger = (side: number, pull: number, color: string) => {
    const pts = [side < 0 ? -10 : W + 10, -10];
    for (let y = -10; y <= H + 10; y += 10) pts.push(edge(y, side) - side * pull, y);
    pts.push(side < 0 ? -10 : W + 10, H + 10);
    poly(ctx, color, pts);
  };
  const glove = k('#161A30');
  for (const side of [-1, 1]) {
    // A soft inner edge: out of focus, so close to her eye.
    finger(side, 5, alpha(glove, 0.35));
    finger(side, 1, alpha(glove, 0.65));
    finger(side, -3, glove);
    const rim: number[] = [];
    for (let y = -10; y <= H + 10; y += 10) rim.push(edge(y, side) + side * 4, y);
    line(ctx, alpha(k('#4A4470'), 0.8), 1.6, rim);
    // The knit.
    for (let r = 0; r < 9; r++) {
      const y = 12 + r * 19;
      const x0 = side < 0 ? 0 : edge(y, side) + 14,
        x1 = side < 0 ? edge(y, side) - 14 : W;
      if (x1 > x0) line(ctx, alpha(k('#2A3058'), 0.4), 1, [x0, y, x1, y + 2]);
    }
  }
}

/** 51–52: she laughs so hard she falls over backwards into the snow. */
function fallShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G;
  const view = track(t, [
    [51, 102, 132, 2.6],
    [52, 100, 134, 2.5],
  ]);
  const fall = easeIn(span(t, FALL + 0.3, FALL + 0.62));
  const landed = t >= FALL + 0.62;
  const x = 86,
    y = 154;
  scene(ctx, view, g, t, seconds, [
    [
      y,
      () => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-fall * 1.42);
        june(
          ctx,
          0,
          0,
          {
            facing: 1,
            lean: -0.08 - Math.sin(seconds * 30) * 0.03,
            arms: landed
              ? [2.2 + Math.sin(seconds * 20) * 0.3, 2.4 + Math.cos(seconds * 18) * 0.3]
              : [0.6 + fall, 0.9 + fall],
            eyes: 'happy',
            mouth: 'grin',
          },
          g,
        );
        ctx.restore();
        puff(ctx, x - 22, y - 4, span(t, FALL + 0.6, FALL + 1.0), 9, g.l.body);
      },
    ],
  ]);
}

/** 56.5–59.5: what she sees. Nobody. Round prints everywhere, and the snow coming down. */
function emptyShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G;
  const view = track(t, [
    [56.5, 150, 112, 1.25],
    [59.5, 330, 112, 1.25],
  ]);
  scene(ctx, view, g, t, seconds, cast(ctx, t, g), { snow: 0.9 });
}

/** 59.5–60.3: from behind her, a snowball bursts on her back. */
function thwumpShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G;
  const view = { x: 204, y: 120, zoom: 2.2 };
  const jolt = hump(t, THWUMP, THWUMP + 0.35);
  scene(ctx, view, g, t, seconds, [
    ...cast(ctx, t, g),
    [
      158,
      () => {
        juneBack(
          ctx,
          204,
          158,
          1.3,
          {
            jolt,
            arms: [0.15 + jolt * 1.3, 0.15 + jolt * 1.3],
            splat: easeOut(span(t, THWUMP, THWUMP + 0.1)),
          },
          g,
        );
        puff(ctx, 204, 142, span(t, THWUMP, THWUMP + 0.45), 7, WHITE);
      },
    ],
  ]);
}

/** 61.2–62: she grins. */
function grinShot(ctx: Ctx, t: number, seconds: number) {
  const g = MORNING_G,
    { k } = g;
  beyond(ctx, g, 122);
  const x = 160,
    y = 94;
  const push = 1 + 0.06 * span(t, GRIN, 62);
  ctx.save();
  ctx.translate(160, 94);
  ctx.scale(push, push);
  ctx.translate(-160, -94);
  bust(ctx, x, y, 1.08, k);
  juneHead(
    ctx,
    x,
    y,
    1.08,
    0.06,
    { eyes: 'narrow', look: -0.4, mouth: 'grin', brows: -0.7, turn: -0.15 },
    k,
  );
  ctx.restore();
  closeFinish(ctx, seconds);
}

/** A snowball in flight. */
function snowball(ctx: Ctx, x: number, y: number, l: Light) {
  disc(ctx, x, y, 2.4, l.rim);
  disc(ctx, x - 0.3, y - 0.3, 2, WHITE);
}

/** 62–64: she throws. It bursts on the big one's tummy. It does not budge. */
function throwShot(ctx: Ctx, t: number, seconds: number) {
  const g = FIGHT_G,
    { l } = g;
  const view = track(t, [
    [62, 150, 120, 1.6],
    [64, 146, 122, 1.68],
  ]);
  // Wind-up, swing, release: the snowball leaves her glove and arcs onto the big one's tummy.
  const wind = ease(span(t, THROW + 0.02, THROW + 0.16));
  const release = THROW + 0.13;
  const fly = span(t, release, SPLAT);
  const big = tableauAt(t).cast.find((c) => c.kind === 'big') ?? { x: 106 };
  const hands = ease(span(t, 63.1, 63.4));
  const arm = lerp(-2.3, 1.4, wind);
  const jx = 212,
    jy = 153,
    s = 1.25;
  const hand = (a: number) => ({
    x: jx - s * (1 + 7 * Math.sin(a)),
    y: jy + s * (-13 + 7 * Math.cos(a)),
  });
  const from = hand(lerp(-2.3, 1.4, ease(span(release, THROW + 0.02, THROW + 0.16))));
  scene(ctx, view, g, t, seconds, [
    ...cast(ctx, t, g),
    [
      153,
      () => {
        june(
          ctx,
          jx,
          jy,
          {
            facing: -1,
            arms: hands > 0 ? [0.5 * hands, 0.5 * hands] : [0.2, arm],
            lean: lerp(-0.15, 0.3, wind) * (1 - hands),
            eyes: hands > 0.5 ? 'sleepy' : 'open',
            mouth: hands > 0.5 ? 'flat' : 'grin',
            splat: true,
          },
          g,
        );
        if (t < release) {
          const h = hand(arm);
          snowball(ctx, h.x, h.y, l);
        }
      },
    ],
    [
      170,
      () => {
        if (fly > 0 && fly < 1)
          snowball(
            ctx,
            lerp(from.x, big.x - 3, fly),
            lerp(from.y, 137, fly) - Math.sin(fly * Math.PI) * 16,
            l,
          );
        puff(ctx, big.x - 3, 138, span(t, SPLAT, SPLAT + 0.45), 8, WHITE);
      },
    ],
  ]);
}

/** 64–65.2: bent to scoop more, and thwump: one on the backside, from behind. */
function scoopShot(ctx: Ctx, t: number, seconds: number) {
  const g = FIGHT_G,
    { l } = g;
  const view = { x: 214, y: 134, zoom: 2.6 };
  const jump = hump(t, HIT_2, HIT_2 + 0.4);
  const hit = t >= HIT_2;
  const turning = t >= 64.95;
  const fly = span(t, HIT_2 - 0.22, HIT_2);
  scene(ctx, view, g, t, seconds, [
    [
      154,
      () => {
        const y = 154 - jump * 6;
        june(
          ctx,
          212,
          y,
          {
            facing: turning ? 1 : -1,
            lean: hit ? -0.1 * jump : 0.62,
            arms: hit ? [1.6 + jump, 2.0 + jump] : [0.5 + Math.sin(seconds * 9) * 0.15, 0.7],
            eyes: hit ? 'wide' : 'open',
            mouth: hit ? 'o' : 'smile',
            splat: true,
          },
          g,
        );
        if (hit)
          for (const [dx, dy] of [
            [5, -9],
            [6.6, -8],
            [4.6, -7],
          ] as const)
            disc(ctx, 212 + (turning ? -dx : dx), y + dy, 1.2, WHITE);
        if (fly > 0 && fly < 1) snowball(ctx, lerp(262, 217, fly), lerp(128, 145, fly), l);
        puff(ctx, 217, y - 8, span(t, HIT_2, HIT_2 + 0.4), 6, WHITE);
      },
    ],
  ]);
}

/** 66.5–68.5: ducked behind the bench, giggling, arms over her hat. Two snowballs sail over. */
function benchShot(ctx: Ctx, t: number, seconds: number) {
  const g = FIGHT_G,
    { l } = g;
  const view = track(t, [
    [66.5, 142, 106, 2.55],
    [68.5, 140, 106, 2.7],
  ]);
  // She scurries in from the left and drops down behind it: only her hat, her eyes and her
  // elbows clear the backrest, and the seat, the slats and the banked snow hide the rest.
  const duck = easeOut(span(t, 66.5, 66.9));
  const down = duck > 0.75;
  const jx = lerp(106, 147, duck),
    jy = 125.5;
  scene(ctx, view, g, t, seconds, [
    [
      BENCH.y - 2,
      () =>
        june(
          ctx,
          jx,
          jy,
          {
            facing: 1,
            sitting: down,
            step: down ? undefined : seconds * 16,
            lean: down ? 0.05 + Math.sin(seconds * 26) * 0.05 : 0.2,
            arms: down ? [0, 0] : [1.2, 1.5],
            cover: down,
            eyes: 'happy',
            mouth: 'grin',
            splat: true,
          },
          g,
        ),
    ],
    [
      190,
      () =>
        // Lobbed from the snowmen off to the right, over the top of her hat, into the snow.
        ARCS.forEach((land, i) => {
          const u = span(t, land - 0.6, land);
          const lx = [112, 98][i],
            ly = [130, 132][i];
          if (u > 0 && u < 1)
            snowball(ctx, lerp(214, lx, u), lerp(120, ly, u) - Math.sin(u * Math.PI) * 50, l);
          puff(ctx, lx, ly, span(t, land, land + 0.45), 6, WHITE);
          if (t >= land) oval(ctx, lx, ly + 0.5, 3, 1.3, l.shadow);
        }),
    ],
  ]);
}

/** 69.6–70.5: she pops up, a snowball knocks her hat off, and she flops back laughing. */
function hatShot(ctx: Ctx, t: number, seconds: number) {
  const g = FIGHT_G,
    { l, k } = g;
  const view = { x: 148, y: 108, zoom: 2.5 };
  const x = 142,
    y = 121;
  const fly = span(t, HAT_OFF - 0.18, HAT_OFF);
  const off = span(t, HAT_OFF, HAT_OFF + 0.5);
  const flop = easeIn(span(t, HAT_OFF + 0.12, HAT_OFF + 0.45));
  scene(ctx, view, g, t, seconds, [
    [
      y,
      () => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-flop * 1.2);
        june(
          ctx,
          0,
          0,
          {
            facing: 1,
            bare: t >= HAT_OFF,
            arms: t < HAT_OFF ? [0.4, 1.5] : [1.4 + flop, 1.8 + flop],
            eyes: t < HAT_OFF ? 'open' : 'happy',
            mouth: 'grin',
            splat: true,
          },
          g,
        );
        ctx.restore();
        if (fly > 0 && fly < 1) snowball(ctx, lerp(206, x + 2, fly), lerp(80, y - 33, fly), l);
        puff(ctx, x + 1, y - 34, span(t, HAT_OFF, HAT_OFF + 0.4), 6, WHITE);
        // The hat tumbles off across the frame and drops out of the left side.
        if (off > 0 && off < 1) {
          ctx.save();
          ctx.translate(lerp(x, x - 66, off), y - 36 - Math.sin(off * Math.PI) * 8 + off * 20);
          ctx.rotate(-off * 5);
          bobbleHat(ctx, 5, k);
          ctx.restore();
        }
      },
    ],
  ]);
}

/** 70.5–72: from above, a snow angel; her hat lands upside down beside her. */
function angelShot(ctx: Ctx, t: number, seconds: number) {
  const g = FIGHT_G,
    { l, k } = g;
  const sweep = 0.5 - 0.5 * Math.cos(((t - (SWEEPS[0] - 0.35)) / 0.7) * TAU);
  const push = 1 + 0.08 * span(t, 70.5, 72);
  ctx.save();
  ctx.translate(160, 90);
  ctx.scale(push, push);
  ctx.translate(-160, -90);
  box(ctx, 0, 0, W, H, l.snow);
  for (let i = 0; i < 10; i++)
    oval(
      ctx,
      rand(i * 3.3) * W,
      rand(i * 5.1) * H,
      26 + rand(i + 0.5) * 40,
      3 + rand(i * 2.2) * 4,
      alpha(l.shadow, 0.3),
    );
  for (let i = 0; i < 16; i++)
    oval(ctx, rand(i * 7.7 + 1) * W, rand(i * 9.1 + 2) * H, 3, 2.4, l.shadow);
  const cx = 150,
    cy = 96,
    s = 2.3;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  // The angel she is making.
  const print = alpha(l.shadow, 0.85);
  const reach = 0.3 + 2.1 * clamp(span(t, 70.5, SWEEPS[0]) + 0.3);
  for (const side of [-1, 1]) {
    const pts = [side * 4, -9];
    for (let a = 0.3; a <= reach + 0.01; a += 0.25)
      pts.push(side * 4 + Math.sin(a) * 15 * side, -9 + Math.cos(a) * 15);
    poly(ctx, print, pts);
  }
  const skirt = [0, 2];
  for (let a = -0.7; a <= 0.71; a += 0.2) skirt.push(Math.sin(a) * 17, 4 + Math.cos(a) * 17);
  poly(ctx, print, skirt);
  // June, on her back.
  const leg = lerp(0.1, 0.6, sweep);
  for (const side of [-1, 1]) {
    const ex = side * 2.6 + Math.sin(leg) * 11 * side,
      ey = 5 + Math.cos(leg) * 11;
    line(ctx, k(LEGS), 3.4, [side * 2.6, 5, ex, ey]);
    oval(ctx, ex + side * 0.4, ey + 1.2, 2.1, 2.5, k(BOOT));
  }
  const arm = lerp(0.35, 2.35, sweep);
  for (const side of [-1, 1]) {
    const hx = side * 4.2 + Math.sin(arm) * 10 * side,
      hy = -9 + Math.cos(arm) * 10;
    line(ctx, k(COAT_DARK), 3.2, [side * 4.2, -9, hx, hy]);
    disc(ctx, hx, hy, 1.9, k(GLOVE));
  }
  poly(ctx, k(COAT), [-5, -11, 5, -11, 6.5, 6, -6.5, 6]);
  box(ctx, -0.5, -10, 1, 15, k(COAT_DARK));
  for (const side of [-1, 1]) {
    line(ctx, k(HAIR), 2.4, [side * 4.6, -17, side * 9, -14, side * 11, -10]);
    box(ctx, side * 11 - 1.2, -10.5, 2.4, 1.4, k(GLOVE));
  }
  disc(ctx, 0, -18, 6, k(SKIN));
  dome(ctx, 0, -20, 6.4, 4.6, k(HAIR));
  line(ctx, k(LID), 0.8, [-3.3, -17.4, -2.3, -18.5, -1.3, -17.4]);
  line(ctx, k(LID), 0.8, [1.3, -17.4, 2.3, -18.5, 3.3, -17.4]);
  poly(ctx, k(MOUTH), [-2.2, -15.6, 2.2, -15.6, 1.4, -13.8, -1.4, -13.8]);
  box(ctx, -1.8, -15.6, 3.6, 0.6, k(WHITE));
  oval(ctx, -4, -16.2, 1, 0.6, alpha(k(CHEEK), 0.8));
  oval(ctx, 4, -16.2, 1, 0.6, alpha(k(CHEEK), 0.8));
  ctx.restore();
  // Her hat, coming down beside her.
  const land = span(t, 70.5, 70.78);
  const hx = cx + 34,
    hy = cy - 40;
  const hs = lerp(1.9, 1, easeIn(land)) * 2.3;
  ctx.save();
  ctx.translate(hx + (1 - land) * 18, hy - (1 - land) * 14);
  ctx.scale(hs, hs);
  // Lying on its side, crown and pompom to the left: the way it lies till the end.
  ctx.rotate((1 - land) * 3 - 1.5);
  ctx.translate(0, 4);
  hatShape(ctx, g);
  ctx.restore();
  puff(ctx, hx, hy + 6, span(t, 70.78, 71.2), 8, WHITE);
  ctx.restore();
  snowfall(ctx, seconds, { amount: 0.5, speed: 6, color: WHITE, seed: 31 });
  vignette(ctx, 0.3, '#5A4A5E');
}

/** 72–74: dusk. She tucks the scarf snugly round the little one, and hugs the big one. */
function duskShot(ctx: Ctx, t: number, seconds: number) {
  const g = DUSK_G;
  const view = track(t, [
    [72, 299, 123, 2.2],
    [74, 294, 124, 2.36],
  ]);
  const tucking = t < 72.9;
  const x = tucking ? 300 : lerp(300, 294, span(t, 72.9, HUG));
  const hug = ease(span(t, HUG - 0.1, HUG + 0.2));
  scene(ctx, view, g, t, seconds, [
    ...cast(ctx, t, g),
    [
      162,
      () =>
        june(
          ctx,
          x,
          162,
          {
            bare: true,
            facing: tucking ? 1 : -1,
            arms: tucking
              ? [1.25 + Math.sin(seconds * 11) * 0.12, 1.45 + Math.cos(seconds * 11) * 0.12]
              : [lerp(0.3, 1.45, hug), lerp(0.3, 1.6, hug)],
            lean: tucking ? 0.12 : hug * 0.22,
            eyes: !tucking && hug > 0.5 ? 'happy' : 'open',
            mouth: 'smile',
          },
          g,
        ),
    ],
  ]);
}

/** 74–76: she waves to them all and runs home bareheaded. Her red hat lies in the snow. */
function goodbyeShot(ctx: Ctx, t: number, seconds: number) {
  const g = DUSK_G;
  const view = track(t, [
    [74, 296, 108, 1.22],
    [76, 306, 106, 1.26],
  ]);
  const run = span(t, WAVE + 0.85, DOOR_OPEN);
  // Past the front of them all, and off to the right toward home.
  const x = lerp(240, 452, easeIn(run) * 0.35 + run * 0.65),
    y = 167 + Math.sin(run * Math.PI) * 4 - run * 8;
  scene(
    ctx,
    view,
    g,
    t,
    seconds,
    [
      ...cast(ctx, t, g),
      [
        y,
        () =>
          june(
            ctx,
            x,
            y,
            {
              bare: true,
              facing: 1,
              step: run > 0 ? seconds * 16 : undefined,
              arms: run > 0 ? undefined : [0.2, 2.6 + Math.sin(seconds * 13) * 0.45],
              eyes: 'happy',
              mouth: 'grin',
            },
            g,
          ),
      ],
    ],
    { fort: true, hat: true },
  );
}

/** 76–79: home. Her door opens, she goes in, it shuts; we hold on them. Then the blink. */
function homeShot(ctx: Ctx, t: number, seconds: number) {
  const g = DUSK_G;
  const view = track(t, [
    [76, 352, 117, 1.6],
    [DOOR_SHUT, 354, 117, 1.6],
    [IRIS[0], 334, 128, 1.75],
    [IRIS[1], 334, 128, 1.8],
  ]);
  const door =
    ease(span(t, DOOR_OPEN, DOOR_OPEN + 0.3)) * (1 - ease(span(t, DOOR_SHUT - 0.3, DOOR_SHUT)));
  // She trots up to the open door, steps in (seen from behind, into the light), and the
  // closing door wipes her out of sight. No fades.
  const AT_DOOR = 76.55;
  const approach = span(t, DOOR_OPEN, AT_DOOR);
  const actors = cast(ctx, t, g);
  if (t < AT_DOOR)
    actors.push([
      104,
      () =>
        june(
          ctx,
          lerp(384, DOOR.x, approach),
          lerp(104, DOOR.y, approach),
          { bare: true, size: 0.75, facing: 1, step: seconds * 12 },
          g,
        ),
    ]);
  const inDoor = t >= AT_DOOR && door > 0 ? ease(span(t, AT_DOOR, DOOR_SHUT)) : -1;
  scene(ctx, view, g, t, seconds, actors, { fort: true, hat: true, door, inDoor });
  const close = ease(span(t, IRIS[0], IRIS[1]));
  if (close > 0) {
    const cx = (322 - view.x) * view.zoom + W / 2,
      cy = (140 - view.y) * view.zoom + H / 2;
    iris(ctx, cx, cy, lerp(220, 0, close));
  }
}

/** The final image: the class photo round a brand-new snow-June in June's red hat. */
const PHOTO: readonly SM[] = [
  // The back row, taller ones behind.
  { kind: 'tall', x: 54, y: 141, s: 1.8, arms: [1.0, 1.15] },
  { kind: 'big', x: 124, y: 142, s: 1.85, arms: [1.05, 1.2] },
  { kind: 'fat', x: 198, y: 141, s: 1.75, arms: [1.1, 1.0] },
  { kind: 'pot', x: 268, y: 142, s: 1.85, arms: [1.0, 1.15] },
  // The front row: the bow tie, snow-June in the middle, the Little One beside her.
  { kind: 'bow', x: 90, y: 170, s: 1.9, arms: [1.0, 1.1], look: 0.2 },
  { kind: 'june', x: 160, y: 171, s: 2.0, arms: [0.75, 0.85] },
  { kind: 'little', x: 226, y: 171, s: 2.05, arms: [1.1, 1.0], look: -0.2 },
];
const PHOTO_MARKS: Marks = { dent: true, splat: true, scarf: 2 };
function finalShot(ctx: Ctx, t: number, seconds: number) {
  const g = DUSK_G,
    { l } = g;
  sky(ctx, [l.skyTop, l.skyLow], 0, 100);
  starfield(ctx, seconds, { count: 16, seed: 9, bottom: 44, colors: ['#FFE9B8', '#C9C2F0'] });
  camera(
    ctx,
    { x: 300, y: 84, zoom: 1.45 },
    () => {
      houses(ctx, g, 0, seconds);
      ground(ctx, g);
    },
    WORLD,
  );
  for (const [x, y, rx] of [
    [40, 172, 60],
    [250, 176, 70],
    [170, 150, 50],
    [300, 156, 40],
  ] as const)
    oval(ctx, x, y, rx, 3, alpha(l.shadow, 0.4));
  for (const sm of PHOTO) snowman(ctx, sm, g, PHOTO_MARKS);
  snowfall(ctx, seconds, { amount: 0.7, speed: 10, color: '#E6E4FA', seed: 11 });
  vignette(ctx, 0.38, '#1A1838');
  const open = ease(span(t, IRIS[2], IRIS[3]));
  if (open < 1) iris(ctx, 160, 120, lerp(0, 230, open));
}

const SHOTS: readonly ShotFn[] = [
  openingShot,
  rollingShot,
  dressingShot,
  twoShot,
  gameShot,
  (ctx, t, s) => countShot(ctx, t, s, 0),
  (ctx, t, s) => overShoulder(ctx, t, s, SPINS[0], REVEAL_VIEWS[0]),
  rubShot,
  (ctx, t, s) => countShot(ctx, t, s, 1),
  (ctx, t, s) => overShoulder(ctx, t, s, SPINS[1], REVEAL_VIEWS[1]),
  inspectShot,
  (ctx, t, s) => countShot(ctx, t, s, 2),
  (ctx, t, s) => overShoulder(ctx, t, s, SPINS[2], REVEAL_VIEWS[2]),
  branchShot,
  jawShot,
  (ctx, t, s) => countShot(ctx, t, s, 3),
  peekShot,
  (ctx, t, s) => countShot(ctx, t, s, 3),
  (ctx, t, s) => overShoulder(ctx, t, s, SPINS[3], REVEAL_VIEWS[3]),
  fallShot,
  (ctx, t, s) => countShot(ctx, t, s, 4),
  emptyShot,
  thwumpShot,
  // Round the oak, then in on the Little One, its arm still out from the throw.
  (ctx, t, s) =>
    overShoulder(
      ctx,
      t,
      s,
      SPINS[5],
      track(t, [
        [SPINS[5], 96, 112, 1.25],
        [SPINS[5] + 0.35, 96, 112, 1.25],
        [GRIN, 122, 126, 1.55],
      ]),
      1,
    ),
  grinShot,
  throwShot,
  scoopShot,
  (ctx, t, s) => scene(ctx, { x: 345, y: 112, zoom: 1.25 }, FIGHT_G, t, s, cast(ctx, t, FIGHT_G)),
  benchShot,
  (ctx, t, s) =>
    scene(ctx, { x: 322, y: 116, zoom: 1.6 }, FIGHT_G, t, s, cast(ctx, t, FIGHT_G), {
      fort: true,
    }),
  hatShot,
  angelShot,
  duskShot,
  goodbyeShot,
  homeShot,
  (ctx) => box(ctx, 0, 0, W, H, '#07090C'),
  finalShot,
];

// ——— The score ———
type Effect = Parameters<Score['fx']>[0];
const ROOT = 62; // D
/** The tiptoe tune: the five-note motif creeping up, in sneaky eighths with rests. */
// prettier-ignore
const TIPTOE = [
  0, null, 3, null, 5, null, 6, 7, null, null, 7, 6, 5, null, 3, null,
  0, null, 3, null, 5, null, 6, 7, null, 10, null, 7, 6, null, 0, null,
] as const;
/** The same tune at a run, in D major, for the snowball fight. */
// prettier-ignore
const RUN = [
  12, null, 16, null, 17, null, 18, 19, null, 19, 18, 17, 16, null, 12, null,
  12, null, 16, null, 17, null, 18, 19, null, 23, null, 24, 19, null, 12, null,
] as const;
/** A walking bass under the counts, from the same motif. */
const WALK = [0, 3, 5, 6, 7, 6, 5, 3] as const;
/** A gentle tune for building, in F. */
// prettier-ignore
const BUILDING = [0, 4, 7, 4, 5, 9, 7, null, 4, 7, 12, 7, 9, 7, 4, null, 2, 5, 9, 5, 7, 4, 0, null] as const;

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const statuesScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: ROOT, voice: 'pluck', intro: [0, 3, 5, 6, 7], outro: [0, 4, 7, 12] },
    (s) => {
      const n = (sec: number, pitch: number, dur: number, voice: Voice, gain: number, pan = 0) =>
        s.note(P(sec), pitch, dur, voice, gain, pan);
      const fx = (kind: Effect, sec: number, dur: number, gain: number, pan = 0) =>
        s.fx(kind, P(sec), dur, gain, pan);
      const section = (from: number, to: number, o: Omit<Section, 'from' | 'to'>) =>
        s.section({ ...o, from: P(from), to: P(to) });

      // The bed: wind across the whole story, louder in the silences.
      const windAt = (sec: number) => (sec >= 52 && sec < 60 ? 0.09 : sec >= 76 ? 0.09 : 0.06);
      for (let a = 0; a < STORY; a += 4)
        fx('wind', a, 4.05, windAt(a + 2), (a / 4) % 2 ? 0.15 : -0.15);

      // Building: a gentle tune in F.
      section(0.5, 17.0, {
        bpm: 100,
        root: 65,
        chords: [0, 5, 7, 0],
        groove: 'none',
        melody: BUILDING,
        voice: 'keys',
        gain: 0.7,
        level: 0.55,
        fade: 1.2,
      });
      fx('crunch', 3.6, 0.12, 0.05, 0.2);
      fx('crunch', 3.95, 0.12, 0.05, 0.2);
      for (let sec = ROLL; sec <= 10.2; sec += 0.6)
        fx(
          'crunch',
          sec,
          0.12,
          0.07,
          sec < BODY_SET ? lerp(-0.25, 0.1, span(sec, ROLL, BODY_SET)) : 0.25,
        );
      fx('thud', BODY_SET, 0.4, 0.2, 0.05);
      fx('thud', HEAD_SET, 0.4, 0.22, 0.05);
      fx('gasp', HEAD_SET + 0.12, 0.35, 0.05, 0.15);
      COALS.forEach((sec, i) => fx('tick', sec, 0.06, 0.14, [-0.2, 0.2, 0][i]));
      fx('pop', CARROT, 0.18, 0.14, 0.15);
      STICKS.forEach((sec, i) => fx('rustle', sec, 0.22, 0.08, i ? 0.4 : -0.4));

      // The idea: three rising plucks on the point, the point and the mime.
      POINTS.forEach((sec, i) =>
        n(sec, ROOT + [5, 7, 12][i], 0.5, 'pluck', 0.11, [0.3, -0.3, 0][i]),
      );
      for (let sec = MARCH; sec < 19.75; sec += 0.17) fx('crunch', sec, 0.08, 0.045, -0.3);
      fx('rustle', SCARF_HUNG, 0.3, 0.06, -0.4);

      // The tiptoe tune, one section per count, a notch faster each round. It only plays while
      // June is not looking, and every section stops 0.2 s before its spin.
      const tiptoe = (from: number, to: number, bpm: number) => {
        section(from, to, {
          bpm,
          root: ROOT,
          minor: true,
          chords: [0, 0, 5, 7],
          melody: TIPTOE,
          step: 0.5,
          voice: 'pluck',
          groove: 'tick',
          bass: false,
          pad: false,
          fade: 0.05,
          level: 0.8,
          gain: 1,
        });
        const beat = 60 / bpm;
        // The section fades in from a quarter; this accent gives every count a real downbeat.
        n(from, ROOT, beat * 0.45, 'pluck', 0.09);
        for (let at = from, i = 0; at < to - 0.12; at += beat, i++)
          n(
            at,
            ROOT - 12 + WALK[i % WALK.length],
            Math.min(beat * 0.7, to + 0.15 - at),
            'bass',
            0.07,
          );
      };
      tiptoe(COUNTS[0][0], SPINS[0] - 0.2, COUNT_BPM[0]);
      tiptoe(COUNTS[1][0], SPINS[1] - 0.2, COUNT_BPM[1]);
      tiptoe(COUNTS[2][0], SPINS[2] - 0.2, COUNT_BPM[2]);
      tiptoe(COUNTS[3][0], PEEK - 0.2, COUNT_BPM[3]);
      tiptoe(UNPEEK, SPINS[3] - 0.2, COUNT_BPM[3]);
      fx('pop', UNPEEK, 0.12, 0.1, 0.2);
      // Every spin: a swish, then wind while she looks.
      SPINS.forEach((sec) => fx('swish', sec, 0.3, 0.12));

      // What we cannot see, louder every round, off to the right where they are.
      fx('crunch', 21.3, 0.14, 0.1, 0.5);
      fx('crunch', 22.4, 0.14, 0.1, 0.55);
      [27.0, 27.6, 28.2].forEach((sec, i) => fx('crunch', sec, 0.14, 0.11, 0.4 + i * 0.1));
      fx('swish', 28.6, 0.25, 0.08, 0.5);
      fx('rumble', 34.8, 1.0, 0.16, 0.45);
      fx('thud', 35.9, 0.35, 0.16, 0.5);
      fx('thud', 36.5, 0.35, 0.16, 0.4);
      fx('pop', 37.0, 0.15, 0.12, 0.45);
      for (let i = 0; i < 12; i++)
        fx('crunch', UNPEEK + (i * 2.2) / 11, 0.12, 0.09, Math.sin(i * 1.9) * 0.7);
      fx('boing', 48.0, 0.5, 0.12, 0.3);
      fx('thud', 48.6, 0.35, 0.16, -0.2);
      fx('squeak', 49.0, 0.25, 0.1, 0.45);

      // Reactions.
      fx('rustle', RUB, 0.6, 0.04);
      for (let sec = 30.55; sec < 31.55; sec += 0.2) fx('crunch', sec, 0.08, 0.045, -0.1);
      fx('crunch', PROD, 0.12, 0.08, 0.1);
      for (let sec = BACK_AWAY + 0.1; sec < 34; sec += 0.28) fx('crunch', sec, 0.08, 0.04, -0.2);
      n(JAW, 69, 0.4, 'keys', 0.12, -0.1);
      n(JAW + 0.3, 66, 0.8, 'keys', 0.12, 0.1);
      LAUGHS.forEach((sec, i) => fx('giggle', sec, 0.9, 0.08, i ? 0 : -0.2));
      fx('thud', FALL + 0.62, 0.3, 0.1, -0.2);
      fx('crunch', FALL + 0.62, 0.15, 0.1, -0.2);

      // Round five: nothing at all until the thwump.
      fx('thud', THWUMP, 0.4, 0.22);
      fx('crunch', THWUMP, 0.18, 0.14);

      // The snowball fight: the tiptoe tune at a run, in D major.
      section(THROW, 71.8, {
        bpm: 152,
        root: ROOT,
        chords: [0, 5, 7, 0],
        groove: 'drive',
        melody: RUN,
        step: 0.5,
        voice: 'pluck',
        gain: 0.95,
        level: 0.65,
        fade: 0.3,
      });
      [THROW, THROW_2].forEach((sec) => fx('swish', sec, 0.25, 0.12, 0.2));
      [SPLAT, HIT_2, ...ARCS, HAT_OFF].forEach((sec, i) =>
        fx('thud', sec, 0.3, 0.16, [-0.3, 0.1, -0.2, -0.1, 0.1][i]),
      );
      fx('pop', HAT_OFF + 0.02, 0.15, 0.12, -0.1);
      SWEEPS.forEach((sec) => fx('swish', sec, 0.35, 0.08));

      // Dusk: the tiptoe figure slowed into a lullaby; then her door, and silence while we watch.
      section(72.0, 75.9, {
        bpm: 72,
        root: ROOT,
        chords: [0, 5, 7, 0],
        groove: 'none',
        melody: [12, 16, 17, 18, 19, null],
        voice: 'keys',
        gain: 0.9,
        level: 0.6,
        fade: 0.5,
      });
      fx('rustle', TUCK + 0.1, 0.5, 0.05, 0.1);
      fx('rustle', HUG, 0.5, 0.05, -0.1);
      for (let sec = WAVE + 0.9; sec < DOOR_OPEN; sec += 0.15)
        fx('crunch', sec, 0.07, 0.05 * (1 - span(sec, WAVE + 0.9, DOOR_OPEN) * 0.6), 0.2);
      fx('creak', DOOR_OPEN, 0.6, 0.12, 0.35);
      fx('thud', DOOR_SHUT, 0.3, 0.1, 0.35);

      // The blink: in the black, three tiptoe notes and three crunches. Then only the wind.
      DARK_STEPS.forEach((sec, i) => {
        n(sec, ROOT + [0, 3, 5][i], 0.3, 'pluck', 0.11, [-0.3, 0, 0.3][i]);
        fx('crunch', sec + 0.1, 0.14, 0.12, [-0.3, 0, 0.3][i]);
      });
    },
  );

export const statues: FilmModule = {
  draw(ctx, p, seconds) {
    const t = p * STORY;
    const { index } = shot(t, CUTS);
    SHOTS[index](ctx, t, seconds);
  },
  score: statuesScore,
  look: {
    shade: '#2B2A40',
    ink: '#F6F1F4',
    accent: '#E0453A',
    dedication: 'for everyone who ever peeked',
  },
};
