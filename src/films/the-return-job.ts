import type { FilmModule } from './types';
import type { FilmEffect } from '../music/cinema-score';
import type { Voice } from '../music/score';
import {
  alpha,
  box,
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
  person,
  poly,
  rand,
  span,
  starfield,
  TAU,
  veil,
  vignette,
  W,
  within,
  write,
  type Ctx,
  type Figure,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * THE RETURN JOB
 * A cat burglar gets into the River Museum past lasers, a sleeping guard and his dog. She is not
 * there for the famous blue gem: she is putting back the little gold wren her grandfather stole
 * fifty years ago. The guard who lost it on his watch finds it home the next morning, and the
 * dog knows exactly whose pocket the biscuits came from.
 *
 * Everything is timed in story seconds (144 between the title and the end card). Every hit point
 * below is shared by the pictures and the score, so the picks click, the lid creaks, the dog
 * sneezes and the wren's motif resolves on the frames where they happen. The laser web is one
 * list, BEAMS, in gallery coordinates: the descent, the floor web, the gem's cage and the torch
 * sweep all draw from it, so every angle of the room agrees.
 */

// ——— Time (story seconds; p = s / STORY) ———
export const STORY = 144;
const at = (s: number) => s / STORY;

// Prologue: the street and the car.
const CAR_IN = 2.0;
const PARKED = 4.3;
const ENGINE_OFF = 4.5;
const GUTTER = 5.5;
const PALM = 6.5;
const REACH = 7.5;
/** Abe's fingers close over the pouch, and the wren's motif is heard unresolved. */
export const CLOSE = 9.0;
const OPEN = 11.5;
/** Kit takes the pouch. */
export const TAKE = 12.5;
// In.
export const LATCH = 19.5;
const ROPE_CREAKS = [24.0, 27.0, 30.0] as const;
const BRIDGE = 39.5;
const HAND_PLANT = 42.5;
const DRIP_FALL = 45.7;
const DRIP_LAND = 46.7;
/** The push-in lands on the gem with the biggest chord in the film... */
export const GEM = 49.0;
const GLANCE = 50.5;
/** ...and she walks past it. */
export const PAST = 51.5;
// The put-back.
const LABEL_PAD = 55.0;
export const PICKS = [59.8, 60.8, 61.8] as const;
export const LID_CREAK = 62.8;
export const EYE = 63.8;
const EYE_SHUT = 65.6;
const POUCH_OPEN = 66.5;
const IN_PALM = 67.0;
/** The wren goes home, and its motif resolves. */
export const WREN_SET = 69.5;
export const GLINT = 70.2;
const LID_DOWN = 73.5;
export const SNEEZE = 77.4;
export const BARK = 78.4;
const WAKE = 79.0;
// Out.
export const TORCH = 80.5;
const WALT_STEPS = [81.0, 81.7, 82.4, 83.1, 83.8, 84.5, 85.2, 85.9] as const;
const NOSE = 87.5;
const BISCUIT = 89.5;
export const CRUNCH = 90.3;
const WAGS = [91.0, 91.4] as const;
export const WHISTLE = 92.3;
const TROT = 93.0;
const CLIMB = 94.0;
const SWING_UP = 97.2;
const GONE = 98.0;
export const LEAP = 101.5;
export const LAND = 103.0;
/** The gallery's windows light up behind her, one at a time. */
export const WINDOWS = [99.5, 100.7, 101.9, 103.1] as const;
export const COUGHS = [106.8, 107.8] as const;
const DOOR = 108.6;
export const CATCH = 109.6;
const SCRATCH = 112.0;
// Morning.
export const POUCH_BACK = 114.5;
const NOD = 116.0;
const LEAN_IN = 117.5;
const DRIFT = 126.0;
export const CLASP = 127.8;
const SMILE = 129.0;
const STOPS = 132.5;
const AT_ABE = 135.0;
const NUZZLE = 136.5;
/** Walt touches the peak of his cap, and the wren's motif plays whole for the second time. */
export const CAP = 139.5;
const ABE_NOD = 140.5;

/** The two snores in the room: Walt's every 2.2 s, the dog's 1.1 s behind. */
const SNORE_HZ = 0.45;
const WALT_SNORE = 32.0;
const DOG_SNORE = 33.1;
/** The caper's beat grid: 120 bpm from the wall, so the latch, the creaks and the gem sit on it. */
const CAPER_BPM = 120;
const CAPER_0 = 13.0;

const SHOTS = [
  [0, 'street'], // the River Museum at night; a little green car putters in
  [6, 'car'], // two-shot through the windscreen: the pouch
  [8.6, 'hands'], // his fingers close over it
  [10.3, 'abe'], // fifty years on his face
  [11.3, 'hands2'], // he lets go
  [13, 'wall'], // up the drainpipe, across the moon; his hands on the wheel
  [18, 'roof'], // the rope, the latch
  [20, 'skylight'], // looking down through the glass: the red web
  [23, 'descent'], // head first through the moonlight
  [32, 'desk'], // Walt and his dog, asleep
  [34.5, 'photo'], // insert: young Walt and the gold wren
  [37.5, 'pair'], // back to the sleepers
  [38, 'grid'], // the floor web: bridge, hand plant
  [43.5, 'held'], // her face, lit red
  [45.5, 'sweat'], // a bead of sweat
  [47, 'gem'], // the great blue gem
  [50.4, 'glance'], // she looks at it
  [51.5, 'past'], // and walks past it
  [53, 'alcove'], // a dusty case in a side alcove
  [54.5, 'label'], // insert: MISSING SINCE 1975
  [57.5, 'kneel'], // she kneels
  [59, 'lock'], // three picks and a creak
  [63.8, 'dogEye'], // an eye opens
  [66, 'pouch'], // the wren in her palm
  [68.8, 'set'], // down into its outline, and home
  [73, 'turn'], // lid down; her lamp sweeps the room
  [75, 'nose'], // the red dot on the dog's nose; it builds, and sneezes
  [77.9, 'sneeze'], // a bark
  [78.9, 'wake'], // Walt jolts awake
  [80, 'torch'], // the torch sweeps the gallery
  [87, 'noses'], // nose to nose; a biscuit
  [94, 'rope'], // up the rope; the torch is too late
  [98, 'squint'], // Walt squints at the ceiling
  [99, 'roofs'], // across the roofs; the windows light up
  [106, 'key'], // the car will not start
  [108.4, 'getaway'], // Walt on the steps; away at a crawl
  [111.6, 'scratch'], // he watches it go, and scratches his head
  [113, 'pouchBack'], // dawn: the empty pouch, back in his hand
  [115.8, 'dawn'], // her head on his shoulder
  [119, 'daylight'], // the gallery by day
  [124, 'glass'], // his hands drift toward the glass
  [127.6, 'clasp'], // and clasp behind his back
  [131, 'walt'], // Walt, end of shift, stops at the alcove
  [133.5, 'waltLooks'], // at the wren; at Abe
  [136.5, 'nuzzle'], // the dog knows that pocket
  [138, 'waltKnows'], // he touches his cap
  [140.3, 'abeNods'], // Abe nods
  [141.5, 'final'], // the wren in the sun, between two reflections
] as const;
type ShotName = (typeof SHOTS)[number][1];
function scene(t: number) {
  let i = 0;
  while (i + 1 < SHOTS.length && t >= SHOTS[i + 1][0]) i++;
  return { name: SHOTS[i][1] as ShotName, from: SHOTS[i][0] as number };
}

// ——— Palette: moonlit blue and black, laser red, one warm lamp; then a gold morning ———
type Tone = (c: string) => string;
const keep: Tone = (c) => c;
const toward =
  (to: string, k: number): Tone =>
  (c) =>
    mix(c, to, k);
const INK = '#17121A';
const BLACK = '#111318';
const BLACK_FAR = '#1C1F27';
const RIM = '#6A7EA4';
const PALE = '#F0D9C8';
const ROPE = '#F2F2EE';
const RED = '#FF3B30';
const BEAM = '#FF3424';
const MOON = '#ECE8D4';
const SHAFT = '#A9C3E0';
const LAMP = '#FFD28A';
const STONE = '#C9C4B8';
const NIGHT_STONE = mix(STONE, '#22304A', 0.52);
const CAR = '#4E8C5A';
const CAR_D = '#356645';
const CAR_HI = '#86BE8E';
const TWEED = '#6E5A44';
const CARDIGAN = '#8A8A88';
const SUNDAY = '#3E3C4A';
const NAVY = '#2E3A5A';
const WALT_COAT = '#59604E';
const KIT_COAT = '#B08A5E';
const DOG = '#8A6A4A';
const DOG_W = '#EDE6DA';
const DOG_D = '#5C4430';
const GOLD = '#E8C14A';
const GOLD_HI = '#FFF0B0';
const GOLD_D = '#A8822A';
const BLUE = '#3E7BE0';
const BLUE_HI = '#B4D6FF';
const BLUE_D = '#1D3C8C';
const VELVET = '#6E2034';
const DUST = '#9C9284';
const BRASS = '#C9A24A';
const PLUM = '#4A2448';
const PINK = '#F4B6A6';
const PINK_LT = '#F7D7C4';
const SUN = '#F6D58A';
const LAMP_GREEN = '#7FB06A';
const SKY_NIGHT = ['#0A0F18', '#10161F', '#1F2A3A'] as const;

function vgrad(ctx: Ctx, x: number, y0: number, w: number, y1: number, stops: readonly string[]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y0, w, y1 - y0);
}

// ——— Motion helpers ———
type Key = readonly number[];
/** Eases through keyframes [t, ...values]; holds at either end. */
function keyed(t: number, keys: readonly Key[]): number[] {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i],
      b = keys[i + 1];
    if (t < b[0]) {
      const k = ease((t - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((v, j) => lerp(v, b[j + 1], k));
    }
  }
  return keys[keys.length - 1].slice(1);
}
type View = { x: number; y: number; zoom: number };
/** A camera that keeps inside its set and lands on whole pixels, so the beams do not shimmer. */
function cam(
  ctx: Ctx,
  v: View,
  paint: () => void,
  world: { w: number; h: number } = { w: W, h: H },
) {
  const hw = W / 2 / v.zoom,
    hh = H / 2 / v.zoom;
  const x = world.w <= hw * 2 ? world.w / 2 : clamp(v.x, hw, world.w - hw);
  const y = world.h <= hh * 2 ? world.h / 2 : clamp(v.y, hh, world.h - hh);
  ctx.save();
  ctx.translate(Math.round(W / 2 - x * v.zoom), Math.round(H / 2 - y * v.zoom));
  ctx.scale(v.zoom, v.zoom);
  paint();
  ctx.restore();
}
const view = (k: readonly number[]): View => ({ x: k[0], y: k[1], zoom: k[2] });
const blink = (seconds: number, seed: number) =>
  (seconds + seed * 1.37) % (3.6 + seed * 0.4) < 0.12;
/** 0..1 breath of a snore stream started at `from`: rising while the snore sounds. */
function breath(t: number, from: number) {
  const phase = ((((t - from) * SNORE_HZ) % 1) + 1) % 1;
  return phase < 0.5 ? ease(phase * 2) : 1 - ease((phase - 0.5) * 2);
}
const dogSnoring = (t: number) =>
  (t >= DOG_SNORE && t < LID_CREAK) || (t >= EYE_SHUT && t < SNEEZE - 0.6);

// ——— The gallery: one set, many angles ———
const GW = 480,
  GH = 300;
const FLOOR = 268;
const ROPE_X = 336;
const PED = { x: 200, top: 214, half: 14 } as const;
const GEM_AT = { x: 200, y: 203 } as const;
const CASE = { x: 72, top: 215, w: 26, h: 13 } as const;
const DESK = { l: 372, r: 426, top: 236 } as const;
const CLOCK = { x: 458, y: 224, r: 6 } as const;
/** Where Walt sits, and where his dog sleeps under the desk. */
const CHAIR = 440;
const DOG_BED = 398;
const WINDOW_XS = [150, 250, 410] as const;

/**
 * The laser web, [x1, y1, x2, y2] in gallery coordinates (floor at y 268). The drop is a V of
 * two long beams from the ceiling to emitters on the wall, closing in on the rope; on the floor,
 * three low beams between stands, with two more crossing just over her head; a long beam down past
 * the gem, and the gem's own cage. Nothing she passes ever crosses her: she goes over, under, or
 * between (GRID_KEYS says how that was checked).
 */
export const BEAMS: readonly (readonly [number, number, number, number])[] = [
  [284, 40, 318, 214], // the drop, left
  [380, 40, 352, 214], // the drop, right
  [310, 263, 317, 263], // the bridge
  [284, 262, 292, 262], // the hand plant: right
  [260, 256, 268, 256], // the hand plant: left; the sweat misses its lens by a pixel
  [186, 40, 232, 202], // down past the gem
  [187, 189, 213, 207], // the cage
  [213, 189, 187, 207], // the cage
  [185, 196, 215, 196], // the cage's bar
  [302, 22, 246, 118], // up high
  [368, 22, 430, 98], // up high
  [118, 112, 172, 146], // over the way to the alcove
  [118, 146, 172, 112], // over the way to the alcove
  [250, 208, 314, 216], // the floor web's roof
  [252, 217, 312, 205], // the floor web's roof
];
const HURDLES = [2, 3, 4] as const;
const CAGE = [6, 7, 8] as const;

function emitter(ctx: Ctx, x: number, y: number, on: number) {
  box(ctx, x - 1.5, y - 1.5, 3, 3, '#26282F');
  if (on > 0) box(ctx, x - 0.5, y - 0.5, 1, 1, alpha(BEAM, on));
}
/** The beams, with their stands and emitters; `on` fades them, `only` picks some. */
function beams(ctx: Ctx, on: number, seconds: number, only?: readonly number[]) {
  BEAMS.forEach(([x1, y1, x2, y2], i) => {
    if (only && !only.includes(i)) return;
    const hurdle = (HURDLES as readonly number[]).includes(i);
    const cage = (CAGE as readonly number[]).includes(i);
    if (hurdle) {
      // Slim posts that fall back into the dark, and the beam's red light spilt on the floor.
      for (const x of [x1, x2]) {
        box(ctx, x - 0.5, y1, 1, FLOOR - y1, '#1F2128');
        box(ctx, x - 1.5, FLOOR - 1, 3, 1, '#1F2128');
      }
      if (on > 0) oval(ctx, (x1 + x2) / 2, FLOOR, (x2 - x1) / 2 + 4, 1.4, alpha(BEAM, 0.22 * on));
    }
    if (cage && i < 8)
      for (const x of [x1, x2])
        box(ctx, x - 0.6, Math.min(y1, y2), 1.2, PED.top - Math.min(y1, y2), '#2A2C33');
    emitter(ctx, x1, y1, on);
    emitter(ctx, x2, y2, on);
    if (on <= 0) return;
    const hum = on * (0.9 + 0.1 * Math.sin(seconds * 1.7 + i * 1.3));
    line(ctx, alpha(BEAM, 0.16 * hum), 4.2, [x1, y1, x2, y2]);
    line(ctx, alpha(BEAM, 0.92 * hum), 1.5, [x1, y1, x2, y2]);
    line(ctx, alpha('#FFC2B4', 0.6 * hum), 0.5, [x1, y1, x2, y2]);
  });
}

/** The room itself: walls, windows, floor, pedestal, alcove, desk. */
function room(ctx: Ctx, t: number, seconds: number, day: number) {
  const N = (night: string, sunny: string) => mix(night, sunny, day);
  // Wall and ceiling.
  vgrad(ctx, 0, 20, GW, 252, [N('#141A26', '#EFE6CE'), N('#1C2333', '#E6DABD')]);
  box(ctx, 0, 0, GW, 20, N('#0B0F17', '#D6C8A6'));
  for (let x = 6; x < GW; x += 40) box(ctx, x, 4, 28, 12, N('#0F141E', '#E2D6B6'));
  box(ctx, 0, 20, GW, 3, N('#232B3C', '#C9B892'));
  // The skylight in the ceiling.
  box(ctx, ROPE_X - 15, 0, 30, 21, N('#1F2A3A', '#CFE3F2'));
  if (day < 0.5)
    starfield(ctx, seconds, { count: 4, seed: 31, top: 2, bottom: 16, colors: [MOON] });
  for (const x of [ROPE_X - 15, ROPE_X - 1, ROPE_X + 14])
    box(ctx, x, 0, 1.5, 21, N('#2A3344', '#B8A888'));
  // Pilasters and rails.
  for (const x of [100, 200, 300, 470]) {
    box(ctx, x - 7, 23, 14, 229, N('#192030', '#E8DCC0'));
    box(ctx, x - 7, 23, 2, 229, N('#202839', '#F4ECD8'));
  }
  box(ctx, 0, 196, GW, 2, N('#252E40', '#D2C29E'));
  box(ctx, 0, 246, GW, 6, N('#10141D', '#B9A27A'));
  // Tall arched windows.
  for (const wx of WINDOW_XS) {
    const glass = N('#24324A', '#FBF1CF');
    box(ctx, wx - 17, 44, 34, 66, N('#10141D', '#CDBB94'));
    disc(ctx, wx, 44, 17, N('#10141D', '#CDBB94'));
    box(ctx, wx - 14, 44, 28, 63, glass);
    disc(ctx, wx, 44, 14, glass);
    glow(ctx, wx - 4, 52, 26, N(SHAFT, '#FFFFFF'), lerp(0.22, 0.4, day));
    box(ctx, wx - 0.75, 30, 1.5, 77, N('#10141D', '#BCA984'));
    box(ctx, wx - 14, 72, 28, 1.5, N('#10141D', '#BCA984'));
    box(ctx, wx - 18, 107, 36, 3, N('#2A3344', '#D8C8A2'));
  }
  // The alcove on the left, out of the lasers' reach.
  const niche = N('#0E121A', '#E0D2B2');
  box(ctx, 34, 166, 76, 86, niche);
  disc(ctx, 72, 166, 38, niche);
  box(ctx, 34, 166, 3, 86, N('#1E2636', '#F2EAD6'));
  // Floor.
  vgrad(ctx, 0, 252, GW, GH, [N('#141924', '#B08A60'), N('#1C2230', '#C49C70')]);
  for (const y of [262, 276, 292]) box(ctx, 0, y, GW, 1, N('#181D28', '#A88258'));
  // The pedestal and the great blue gem.
  pedestal(ctx, day);
  gem(ctx, GEM_AT.x, GEM_AT.y, 9, seconds, day);
  // The little case on its plinth.
  plinth(ctx, day);
  wrenCase(ctx, t, day);
  // Walt's desk at the far end, under a low green lamp.
  desk(ctx, t, day);
}

function pedestal(ctx: Ctx, day: number) {
  const N = (night: string, sunny: string) => mix(night, sunny, day);
  const { x, top, half } = PED;
  box(ctx, x - half - 2, top - 4, half * 2 + 4, 5, N('#3A4258', '#D8CFBC'));
  box(ctx, x - half, top + 1, half * 2, FLOOR - top - 6, N('#262D3E', '#C8BEA8'));
  box(ctx, x - half, top + 1, 4, FLOOR - top - 6, N('#323A50', '#DDD4C2'));
  box(ctx, x + half - 3, top + 1, 3, FLOOR - top - 6, N('#1C2230', '#B2A890'));
  box(ctx, x - half - 2, FLOOR - 6, half * 2 + 4, 6, N('#3A4258', '#D8CFBC'));
}

function gem(ctx: Ctx, x: number, y: number, s: number, seconds: number, day = 0) {
  glow(ctx, x, y, s * 3.2, BLUE, 0.4 - day * 0.15);
  const k = (a: number, b: number) => [x + a * s, y + b * s];
  poly(ctx, BLUE, [...k(-1, -0.15), ...k(-0.6, -0.7), ...k(0.6, -0.7), ...k(1, -0.15), ...k(0, 1)]);
  poly(ctx, BLUE_D, [...k(-1, -0.15), ...k(0, -0.15), ...k(0, 1)]);
  poly(ctx, '#6FA2F0', [...k(-0.6, -0.7), ...k(0.6, -0.7), ...k(0.3, -0.15), ...k(-0.3, -0.15)]);
  poly(ctx, BLUE_HI, [...k(-0.6, -0.7), ...k(-0.3, -0.7), ...k(-0.5, -0.15), ...k(-1, -0.15)]);
  line(ctx, alpha(BLUE_HI, 0.6), Math.max(0.5, s * 0.08), [...k(-1, -0.15), ...k(1, -0.15)]);
  // A slow sparkle that wanders between two facets: never a flash.
  const tw = Math.max(0, Math.sin(seconds * 1.4)) ** 3;
  const [sx, sy] = k(-0.35, -0.45);
  if (tw > 0.05) {
    const w = Math.max(0.5, s * 0.07);
    line(ctx, alpha('#FFFFFF', tw), w, [sx - s * 0.5, sy, sx + s * 0.5, sy]);
    line(ctx, alpha('#FFFFFF', tw), w, [sx, sy - s * 0.5, sx, sy + s * 0.5]);
  }
}

function plinth(ctx: Ctx, day: number) {
  const N = (night: string, sunny: string) => mix(night, sunny, day);
  const y = CASE.top + CASE.h + 3;
  box(ctx, CASE.x - 12, y, 24, FLOOR - y, N('#262D3E', '#C8BEA8'));
  box(ctx, CASE.x - 12, y, 3, FLOOR - y, N('#303850', '#DDD4C2'));
  box(ctx, CASE.x - 5, y + 6, 10, 4, N(mix(BRASS, '#22304A', 0.5), BRASS));
}

/** How far the lid of the wren's case is open, 0..1. */
function lidOpen(t: number) {
  if (t < LID_CREAK) return 0;
  if (t < LID_DOWN - 0.6) return easeOut(span(t, LID_CREAK, LID_CREAK + 1.1));
  return 1 - ease(span(t, LID_DOWN - 0.6, LID_DOWN));
}
const wrenHome = (t: number) => t >= WREN_SET;

/** The little case seen from the room: a glass box on a wooden base. */
function wrenCase(ctx: Ctx, t: number, day: number) {
  const N = (night: string, sunny: string) => mix(night, sunny, day);
  const { x, top, w, h } = CASE;
  box(ctx, x - w / 2 - 1, top + h, w + 2, 3, N('#3A2A20', '#7A5434'));
  box(ctx, x - 8, top + h - 3, 16, 3, N('#3E1622', VELVET));
  if (wrenHome(t)) wren(ctx, x, top + h - 5, 3.2, { T: toward('#22304A', 0.45 * (1 - day)) });
  box(ctx, x - w / 2, top, w, h, alpha(N('#5A7090', '#FFFFFF'), lerp(0.16, 0.2, day)));
  const lift = lidOpen(t) * 6;
  box(ctx, x - w / 2, top - lift, w, 1, N('#8A9AB0', '#FFFFFF'));
  box(ctx, x - w / 2, top, 1, h, N('#5C6A80', '#D8CCB0'));
  box(ctx, x + w / 2 - 1, top, 1, h, N('#5C6A80', '#D8CCB0'));
  line(ctx, alpha('#FFFFFF', 0.2), 0.8, [x - w / 2 + 3, top + h - 2, x - w / 2 + 9, top + 2]);
}

function desk(ctx: Ctx, t: number, day: number) {
  const N = (night: string, sunny: string) => mix(night, sunny, day);
  // The wall clock: time from the story, the second hand jumping with the tick.
  clock(ctx, t, day);
  // Lamp light.
  const lx = DESK.l + 10;
  if (day < 1) glow(ctx, lx, 236, 46, LAMP_GREEN, 0.3 * (1 - day));
  // Desk.
  box(ctx, DESK.l, DESK.top, DESK.r - DESK.l, 4, N('#4A3424', '#8A5E3A'));
  box(ctx, DESK.l + 2, DESK.top + 4, 3, FLOOR - DESK.top - 4, N('#33241A', '#6E4A2C'));
  box(ctx, DESK.r - 5, DESK.top + 4, 3, FLOOR - DESK.top - 4, N('#33241A', '#6E4A2C'));
  box(ctx, DESK.l + 2, DESK.top + 4, DESK.r - DESK.l - 4, 6, N('#3C2A1E', '#7C5434'));
  // The green-shaded lamp.
  box(ctx, lx - 1, 226, 1.5, 10, N('#222222', '#555555'));
  poly(ctx, N('#2E6A3A', '#3E8A4E'), [lx - 8, 228, lx + 8, 228, lx + 4, 221, lx - 4, 221]);
  box(ctx, lx - 4, 228, 8, 1.5, N('#E8F2C8', '#F4F0D8'));
  // The photo in its frame.
  const px = DESK.l + 34;
  box(ctx, px, 228, 9, 8, N('#8A8C90', '#B8B4AC'));
  box(ctx, px + 1, 229, 7, 6, N('#4A4038', '#B8A078'));
  disc(ctx, px + 5, 233, 0.9, GOLD);
  // A mug.
  box(ctx, DESK.l + 24, 231, 4, 5, N('#6A2A2A', '#B04A3A'));
}

function clock(ctx: Ctx, t: number, day: number) {
  const N = (night: string, sunny: string) => mix(night, sunny, day);
  const { x, y, r } = CLOCK;
  disc(ctx, x, y, r + 1, N('#3A2A20', '#6E4A2C'));
  disc(ctx, x, y, r, N('#9A9A90', '#F4EEDC'));
  // 3:12 a.m. when she drops in, and on through the night; ten past nine by day.
  const minutes = day > 0.5 ? 9 * 60 + 10 + (t - 119) / 60 : 3 * 60 + 12 + (t - 23) / 60;
  const ink = '#222222';
  const hand = (a: number, len: number, w: number, c = ink) =>
    line(ctx, c, w, [x, y, x + Math.sin(a) * len, y - Math.cos(a) * len]);
  hand(((minutes / 60) % 12) * (TAU / 12), r * 0.5, 1);
  hand((minutes % 60) * (TAU / 60), r * 0.8, 0.7);
  hand(Math.floor(t) * (TAU / 60), r * 0.85, 0.4, '#B03028');
}

/** Moonlight (or sunlight) falling slant through the windows and the skylight. */
function shafts(ctx: Ctx, seconds: number, day: number, amount = 1) {
  const drift = Math.sin(seconds * 0.05) * 3;
  const c = mix(SHAFT, SUN, day);
  const a = amount * lerp(0.1, 0.16, day);
  for (const wx of WINDOW_XS) {
    poly(ctx, alpha(c, a), [
      wx - 14,
      52,
      wx + 14,
      52,
      wx + 70 + drift,
      FLOOR + 22,
      wx + 42 + drift,
      FLOOR + 22,
    ]);
    poly(ctx, alpha(c, a * 1.4), [
      wx + 30 + drift,
      256,
      wx + 62 + drift,
      256,
      wx + 74 + drift,
      294,
      wx + 40 + drift,
      294,
    ]);
  }
  poly(ctx, alpha(c, a * 0.9), [
    ROPE_X - 14,
    20,
    ROPE_X + 14,
    20,
    ROPE_X + 64 + drift,
    FLOOR + 20,
    ROPE_X + 36 + drift,
    FLOOR + 20,
  ]);
}

// ——— Kit's body: a little rig for the acrobatics ———
/**
 * [hipX, hipY, torso, head, farUpper, farFore, nearUpper, nearFore, farThigh, farShin,
 * nearThigh, nearShin]. Angles point the way the limb goes: 0 is down, PI/2 forward (the way
 * she faces), PI up.
 */
type Rig = readonly number[];
const UP = Math.PI;
const dir = (a: number) => [Math.sin(a), Math.cos(a)] as const;
function joints(r: Rig) {
  const [, , tor, hd, fa1, fa2, na1, na2, fl1, fl2, nl1, nl2] = r;
  const [tx, ty] = dir(tor);
  const neck = [tx * 13, ty * 13] as const;
  const sh = [tx * 11, ty * 11] as const;
  const [hx, hy] = dir(tor + hd);
  const head = [neck[0] + hx * 5.5, neck[1] + hy * 5.5] as const;
  const limb = (o: readonly number[], a1: number, a2: number, l: number) => {
    const [ax, ay] = dir(a1),
      [bx, by] = dir(a2);
    const mx = o[0] + ax * l,
      my = o[1] + ay * l;
    return [o[0], o[1], mx, my, mx + bx * l, my + by * l];
  };
  return {
    neck,
    head,
    farArm: limb(sh, fa1, fa2, 7),
    nearArm: limb(sh, na1, na2, 7),
    farLeg: limb([0, 0], fl1, fl2, 8.5),
    nearLeg: limb([0, 0], nl1, nl2, 8.5),
  };
}
type RigO = {
  s?: number;
  face?: 1 | -1;
  spin?: number;
  lamp?: number;
  T?: Tone;
  rim?: number;
  coil?: boolean;
  eyes?: 'open' | 'closed' | 'wide';
};
function rigScale(o: RigO) {
  const c = Math.cos(o.spin ?? 0);
  return (o.face ?? 1) * (c < 0 ? -1 : 1) * Math.max(0.55, Math.abs(c));
}
function kit(ctx: Ctx, r: Rig, o: RigO = {}) {
  const T = o.T ?? keep;
  const s = o.s ?? 1;
  const sx = rigScale(o);
  const j = joints(r);
  const body = T(BLACK),
    far = T(BLACK_FAR);
  const torso = [0, 0, j.neck[0], j.neck[1]];
  const chains = [j.farLeg, j.farArm, torso, j.nearLeg, j.nearArm];
  const widths = [3.6, 3, 6.4, 3.6, 3];
  ctx.save();
  ctx.translate(r[0], r[1]);
  ctx.scale(s * sx, s);
  const rim = o.rim ?? 1;
  if (rim > 0) {
    // Moonlight on the edge of a black silhouette.
    ctx.save();
    ctx.translate(-0.55 / (s * sx), -0.65 / s);
    const c = alpha(T(RIM), rim);
    chains.forEach((chain, i) => line(ctx, c, widths[i] + 1.7, chain));
    disc(ctx, j.head[0], j.head[1], 5.9, c);
    ctx.restore();
  }
  line(ctx, far, widths[0], j.farLeg);
  line(ctx, far, widths[1], j.farArm);
  line(ctx, body, widths[2], torso);
  line(ctx, body, widths[3], j.nearLeg);
  if (o.coil ?? true) {
    ctx.save();
    ctx.rotate(Math.PI - r[2]);
    // The coil of rope, slung from her shoulder across her back.
    ctx.strokeStyle = alpha(T(ROPE), 0.85);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(-0.6, -6.5, 2.2, 6, -0.55, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  // The head: beanie, pale face, red headlamp.
  ctx.save();
  ctx.translate(j.head[0], j.head[1]);
  ctx.rotate(Math.PI - (r[2] + r[3]));
  disc(ctx, 0, 0, 5, body);
  oval(ctx, 2, 1.6, 3.2, 3.3, T(PALE));
  box(ctx, -1, -1.4, 6.4, 1.5, T('#1E2129'));
  const eyes = o.eyes ?? 'open';
  if (eyes === 'closed') box(ctx, 2.5, 1.2, 1.8, 0.6, T(INK));
  else box(ctx, 3, 0.4, 1, eyes === 'wide' ? 1.6 : 1.2, T(INK));
  const lamp = o.lamp ?? 1;
  if (lamp > 0) {
    disc(ctx, 3.6, -3, 1.1, alpha(RED, 0.4 + lamp * 0.6));
    glow(ctx, 3.6, -3, 7, RED, 0.45 * lamp);
  }
  ctx.restore();
  line(ctx, body, widths[4], j.nearArm);
  ctx.restore();
}
/** Standing tall, arms easy. */
const STAND: Rig = [0, FLOOR - 17, UP, 0, 0.12, 0.05, -0.1, 0, 0.05, 0, -0.05, 0];
function standAt(x: number, head = 0): Rig {
  const r = [...STAND];
  r[0] = x;
  r[3] = head;
  return r;
}
/** A walking (or running) pose, from a stride phase. */
function strideRig(x: number, y: number, phase: number, run = 0): Rig {
  const sw = Math.sin(phase),
    cw = Math.cos(phase);
  const reach = lerp(0.45, 0.9, run);
  return [
    x,
    y - Math.abs(cw) * lerp(0.6, 2, run),
    UP - lerp(0.06, 0.35, run),
    lerp(0.05, 0.25, run),
    -sw * reach,
    -sw * reach + lerp(0.3, 1.3, run),
    sw * reach,
    sw * reach + lerp(0.3, 1.3, run),
    sw * reach * 0.9,
    sw * reach * 0.9 - lerp(0.25, 0.9, run) * (1 + cw) * 0.5,
    -sw * reach * 0.9,
    -sw * reach * 0.9 - lerp(0.25, 0.9, run) * (1 - cw) * 0.5,
  ];
}

// ——— Townsfolk in the wides: the kit's figures, with caps and moustaches ———
/** Paints in a figure's head frame (head top at `top`, facing +x), following its lean. */
function over(ctx: Ctx, x: number, y: number, f: Figure, paint: (top: number) => void) {
  const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((f.facing ?? 1) * (f.size ?? 1), f.size ?? 1);
  ctx.translate(0, f.sitting ? -4 : -11 - bob);
  ctx.rotate(f.lean ?? 0);
  paint(-24);
  ctx.restore();
}
type FigO = {
  facing?: 1 | -1;
  sitting?: boolean;
  step?: number;
  arms?: readonly [number, number];
  eyes?: Figure['eyes'];
  mouth?: 'open' | 'flat' | 'o' | 'smile';
  lean?: number;
  T?: Tone;
  day?: boolean;
  size?: number;
  capOff?: number;
  /** In a chair: the seat at y, shins down to the floor 15 below it. */
  seated?: boolean;
};
function waltFig(ctx: Ctx, x: number, y: number, o: FigO) {
  const T = o.T ?? keep;
  const seated = o.seated ?? false;
  const f: Figure = {
    skin: T('#DCA88A'),
    hair: T('#C8C4BC'),
    coat: T(o.day ? WALT_COAT : NAVY),
    legs: T('#232B44'),
    // Seated, the kit's sitting figure ends at the knee, and the shins go down from there.
    shoes: T(seated ? '#232B44' : '#141519'),
    build: 'adult',
    facing: o.facing,
    sitting: o.sitting || seated,
    step: o.step,
    arms: o.arms,
    eyes: o.eyes ?? 'open',
    mouth: 'none',
    lean: o.lean,
    size: o.size,
    blush: false,
  };
  if (seated) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((o.facing ?? 1) * (o.size ?? 1), o.size ?? 1);
    box(ctx, 10, -3, 3, 16, T('#232B44'));
    box(ctx, 9.5, 13, 5.5, 2, T('#141519'));
    ctx.restore();
  }
  person(ctx, x, y, f);
  const off = o.capOff ?? 0;
  over(ctx, x, y, f, (top) => {
    if (o.day) box(ctx, 1, top + 12, 3, 3, T(NAVY));
    box(ctx, 1, top + 7, 6, 2, T('#BDB8B0'));
    if (o.mouth === 'open') box(ctx, 2, top + 8.5, 3.5, 3, T(INK));
    else if (o.mouth === 'o') box(ctx, 3, top + 9, 2, 2, T(INK));
    box(ctx, -6, top - 3 - off, 13, 4, T(NAVY));
    box(ctx, -6, top + 1 - off, 13, 1.5, T('#141826'));
    box(ctx, 3, top + 2 - off, 6, 1.5, T('#0C0D12'));
    box(ctx, 1.5, top - 2 - off, 2, 2, T(BRASS));
  });
}
function abeFig(ctx: Ctx, x: number, y: number, o: FigO) {
  const T = o.T ?? keep;
  person(ctx, x, y, {
    skin: T('#E2B496'),
    hair: T('#E6E2DA'),
    coat: T(o.day ? SUNDAY : CARDIGAN),
    legs: T('#3A3630'),
    shoes: T('#2A221E'),
    build: 'adult',
    facing: o.facing,
    step: o.step,
    arms: o.arms,
    eyes: o.eyes ?? 'open',
    mouth: o.mouth === 'open' ? 'open' : o.mouth === 'smile' ? 'smile' : 'flat',
    hat: 'cap',
    hatColor: T(TWEED),
    lean: o.lean,
    size: o.size,
    blush: false,
  });
}
function kitDayFig(ctx: Ctx, x: number, y: number, o: FigO) {
  const T = o.T ?? keep;
  person(ctx, x, y, {
    skin: T(PALE),
    hair: T('#2E221E'),
    hairStyle: 'bob',
    coat: T(KIT_COAT),
    legs: T('#2A2A30'),
    shoes: T('#1E1A1A'),
    build: 'adult',
    facing: o.facing,
    step: o.step,
    arms: o.arms,
    eyes: o.eyes ?? 'open',
    mouth: o.mouth === 'smile' ? 'smile' : o.mouth === 'o' ? 'o' : 'flat',
    lean: o.lean,
    size: o.size,
  });
}

// ——— The dog ———
type DogO = {
  lie?: number;
  step?: number;
  tail?: number;
  head?: number;
  ear?: number;
  eyes?: 'open' | 'closed' | 'half';
  mouth?: number;
  breath?: number;
  facing?: 1 | -1;
  T?: Tone;
  jerk?: number;
};
/** Old, shaggy, brown and white; (x, y) is the ground under its middle. */
function dog(ctx: Ctx, x: number, y: number, s: number, d: DogO) {
  const T = d.T ?? keep;
  const fur = T(DOG),
    white = T(DOG_W),
    dark = T(DOG_D),
    ink = T('#1A1414');
  const lie = d.lie ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (d.facing ?? 1), s);
  const by = lerp(-10, -4.2, lie);
  const br = (d.breath ?? 0) * 0.7;
  const swing = d.step === undefined ? 0 : Math.sin(d.step);
  // Tail: a wag is its best line.
  const wag = Math.sin(d.tail ?? 0);
  const tip = [-13 + wag * 3, by - 7 + lie * 5];
  line(ctx, fur, 2.6, [-9, by - 1, -12 - wag * 0.5, by - 4 + lie * 3, tip[0], tip[1]]);
  line(ctx, white, 1.4, [tip[0], tip[1], tip[0] - 0.5 + wag * 0.6, tip[1] - 1.5]);
  // Legs.
  if (lie < 0.5) {
    const legs = [
      [-6, swing],
      [-3, -swing],
      [5, -swing],
      [8, swing],
    ] as const;
    legs.forEach(([lx, k], i) => {
      box(ctx, lx + k * 1.4, by + 3, 2.4, -by - 3, i % 2 ? fur : dark);
      box(ctx, lx + k * 1.4 - 0.4, -1.4, 3, 1.4, white);
    });
  } else {
    oval(ctx, -6, by + 1.5, 4, 3, dark);
    box(ctx, 6, -1.6, 9, 1.6, white);
  }
  // Body, shaggy along the back.
  oval(ctx, 0, by, 10, 4.8 + br, fur);
  oval(ctx, 4, by + 2, 6, 2.6 + br * 0.5, white);
  for (let i = 0; i < 4; i++) oval(ctx, -6 + i * 4, by - 3.8 - br, 2.6, 1.6, fur);
  // Head.
  const jerk = d.jerk ?? 0;
  const hx = lerp(10.5, 12, lie) + jerk * 1.5,
    hy = by - lerp(5, 0.5, lie) - (d.head ?? 0) * 3 + jerk * 1.5;
  disc(ctx, hx, hy, 4.4, fur);
  oval(ctx, hx + 0.6, hy - 2, 1.3, 2.4, white);
  oval(ctx, hx + 3.6, hy + 1.3, 3.1, 2.2, white);
  disc(ctx, hx + 6.4, hy + 0.6, 1, ink);
  const mouth = d.mouth ?? 0;
  if (mouth > 0)
    poly(ctx, T('#5A2626'), [hx + 2.4, hy + 3, hx + 6.2, hy + 2.6, hx + 3.4, hy + 3 + mouth * 3]);
  // A floppy ear that lifts when it listens.
  const ear = d.ear ?? 0;
  oval(ctx, hx - 1.8, hy + 1.6 - ear * 2.6, 1.9, 3.8 - ear * 0.8, dark, 0.3 - ear * 0.9);
  const eyes = d.eyes ?? 'open';
  if (eyes === 'open') {
    disc(ctx, hx + 1.6, hy - 0.8, 0.85, ink);
    box(ctx, hx + 1.4, hy - 1.4, 0.5, 0.5, '#FFFFFF');
  } else if (eyes === 'half') box(ctx, hx + 0.9, hy - 0.8, 1.6, 0.8, ink);
  else box(ctx, hx + 0.8, hy - 0.5, 1.8, 0.5, ink);
  ctx.restore();
}

// ——— Props ———
/** The wren's tail and beak, in its own units (body 0.64 wide, head 0.3 round at 0.48, -0.3). */
const WREN_TAIL = [-0.35, -0.1, -0.98, -0.8, -0.8, -0.94, -0.22, -0.42] as const;
const WREN_BEAK = [0.74, -0.37, 1.04, -0.29, 0.74, -0.22] as const;
function inside(points: readonly number[], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [points[i], points[i + 1], points[j], points[j + 1]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
/** Whether a point (in the wren's units) is inside its silhouette. */
function inWren(x: number, y: number) {
  return (
    (x / 0.64) ** 2 + (y / 0.44) ** 2 <= 1 ||
    (x - 0.48) ** 2 + (y + 0.3) ** 2 <= 0.09 ||
    inside(WREN_TAIL, x, y) ||
    inside(WREN_BEAK, x, y)
  );
}
/**
 * Points round the edge of the wren's silhouette at even steps, [x, y, ...] in its units: where
 * fifty years of dust stopped against it. Traced once, when the film loads.
 */
const WREN_EDGE: readonly number[] = (() => {
  const ring: (readonly [number, number])[] = [];
  for (let i = 0; i < 360; i++) {
    const a = (i / 360) * TAU;
    let r = 1.3;
    while (r > 0 && !inWren(Math.cos(a) * r, -0.1 + Math.sin(a) * r)) r -= 0.004;
    ring.push([Math.cos(a) * r, -0.1 + Math.sin(a) * r]);
  }
  const at = [0];
  ring.forEach(([x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length];
    at.push(at[i] + Math.hypot(nx - x, ny - y));
  });
  const out: number[] = [];
  const count = 84;
  for (let k = 0, j = 0; k < count; k++) {
    const d = (k / count) * at[ring.length];
    while (at[j + 1] < d) j++;
    const f = (d - at[j]) / (at[j + 1] - at[j] || 1);
    const [ax, ay] = ring[j],
      [bx, by] = ring[(j + 1) % ring.length];
    out.push(lerp(ax, bx, f), lerp(ay, by, f));
  }
  return out;
})();
type WrenO = { T?: Tone; glint?: number; facing?: 1 | -1 };
/** The gold wren, `s` px from its middle to its beak: about 3 in the wides, 30 close up. */
function wren(ctx: Ctx, x: number, y: number, s: number, o: WrenO = {}) {
  const T = o.T ?? keep;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (o.facing ?? 1), s);
  poly(ctx, T(GOLD_D), WREN_TAIL);
  oval(ctx, 0, 0, 0.64, 0.44, T(GOLD));
  disc(ctx, 0.48, -0.3, 0.3, T(GOLD));
  oval(ctx, -0.1, -0.06, 0.4, 0.22, T(GOLD_D), -0.25);
  if (s > 8) {
    const c = T(mix(GOLD_D, '#6A4A10', 0.4));
    line(ctx, c, 0.04, [-0.36, -0.1, -0.02, -0.02]);
    line(ctx, c, 0.04, [-0.3, 0.02, 0.0, 0.08]);
  }
  oval(ctx, 0.18, 0.14, 0.32, 0.15, alpha(T(GOLD_HI), 0.6));
  disc(ctx, 0.42, -0.42, 0.1, T(GOLD_HI));
  poly(ctx, T(GOLD_D), WREN_BEAK);
  if (s > 5) disc(ctx, 0.58, -0.34, 0.065, T('#3A2A10'));
  box(ctx, -0.12, 0.38, 0.05, 0.14, T(GOLD_D));
  box(ctx, 0.12, 0.38, 0.05, 0.14, T(GOLD_D));
  ctx.restore();
  const g = o.glint ?? 0;
  if (g > 0) {
    const gx = x + 0.42 * s * (o.facing ?? 1),
      gy = y - 0.42 * s;
    const w = Math.max(0.4, s * 0.06);
    glow(ctx, gx, gy, s * 1.2, GOLD_HI, 0.7 * g);
    line(ctx, alpha('#FFFFFF', g), w, [gx - s * 0.5 * g, gy, gx + s * 0.5 * g, gy]);
    line(ctx, alpha('#FFFFFF', g), w, [gx, gy - s * 0.5 * g, gx, gy + s * 0.5 * g]);
  }
}
/** The small dark velvet pouch; `full` is the wren inside it. */
function pouch(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  o: { full?: number; open?: number; T?: Tone } = {},
) {
  const T = o.T ?? keep;
  const full = o.full ?? 1,
    open = o.open ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  oval(ctx, 0, 1, 7.5, lerp(2.4, 5.6, full), T(PLUM));
  oval(ctx, -2, lerp(0.4, -0.8, full), 3.4, lerp(1, 2.6, full), T(mix(PLUM, '#9A6A9A', 0.35)));
  poly(ctx, T(PLUM), [
    -3 - open * 2,
    -4 - full,
    3 + open * 2,
    -4 - full,
    2,
    lerp(-1, -2, full),
    -2,
    lerp(-1, -2, full),
  ]);
  if (open > 0.3) oval(ctx, 0, -4 - full, 2 + open * 2, 0.9 + open * 0.6, T('#1E0E1E'));
  line(ctx, T(BRASS), 0.6, [-2.6, -2.2, 0, -1.6, 2.6, -2.2]);
  line(ctx, T(BRASS), 0.6, [2.6, -2.2, 4.2, 0.8 + open * 2]);
  disc(ctx, 4.2, 1.2 + open * 2, 0.8, T(BRASS));
  ctx.restore();
}
function biscuit(ctx: Ctx, x: number, y: number, s: number, bitten = 0) {
  if (bitten >= 1) return;
  const c = '#C89A5A';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  box(ctx, -3, -0.9, 6 - bitten * 3, 1.8, c);
  disc(ctx, -3, -1, 1.1, c);
  disc(ctx, -3, 1, 1.1, c);
  if (bitten < 0.5) {
    disc(ctx, 3, -1, 1.1, c);
    disc(ctx, 3, 1, 1.1, c);
  }
  ctx.restore();
}

// ——— Close-ups: faces ———
type Who = 'kit' | 'abe' | 'walt' | 'young';
const SKIN: Record<Who, readonly [string, string]> = {
  kit: [PALE, '#C4A090'],
  abe: ['#E2B496', '#B5826A'],
  walt: ['#DCA88A', '#AA7A60'],
  young: ['#E6B696', '#B4846A'],
};
type Face = {
  eyes?: 'open' | 'closed' | 'wide' | 'half' | 'down' | 'squint';
  look?: readonly [number, number];
  /** Positive knits the inner brows up (worry), negative pulls them down (focus). */
  brows?: number;
  raise?: number;
  mouth?: 'flat' | 'soft' | 'smile' | 'sad' | 'part' | 'open' | 'tight' | 'o' | 'grin';
  turn?: number;
  tilt?: number;
  key?: string;
  keyX?: number;
  keyY?: number;
  keyAmount?: number;
  T?: Tone;
  wear?: 'night' | 'dawn' | 'day';
  lamp?: number;
  wet?: number;
  coil?: boolean;
  /** Walt's cap, pushed down over his eyes (positive) or up off his brow (negative). */
  capY?: number;
};
const STUBBLE = Array.from({ length: 34 }, (_, i) => {
  const a = rand(i * 3.1 + 2) * Math.PI,
    r = 15 + rand(i * 5.3 + 1) * 6;
  return [Math.cos(a) * r * 0.9, 6 + Math.sin(a) * r * 0.75] as const;
})
  .filter(([, y]) => y > 10)
  .flat();
const TWEED_FLECKS = Array.from({ length: 16 }, (_, i) => [
  -16 + rand(i * 2.7 + 9) * 32,
  -25 + rand(i * 4.1 + 3) * 13,
]).flat();

function portrait(ctx: Ctx, who: Who, x: number, y: number, s: number, f: Face = {}) {
  const T = f.T ?? keep;
  const u = (f.turn ?? 0) * 6;
  const [skin0, shade0] = SKIN[who];
  const skin = T(skin0),
    shade = T(shade0),
    ink = T(INK);
  const wear = f.wear ?? 'night';
  const rx = who === 'kit' ? 17 : 19;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  clothes(ctx, who, wear, u, T, f.coil ?? false);
  ctx.translate(0, 20);
  ctx.rotate(f.tilt ?? 0);
  ctx.translate(0, -20);
  // Ears.
  const big = who === 'abe' ? 1.25 : 1;
  if (u < 5) oval(ctx, -rx - 0.5 + u * 0.35, 3, 3.8 * big, 6.4 * big, skin);
  if (u > -5) oval(ctx, rx + 0.5 + u * 0.35, 3, 3.8 * big, 6.4 * big, skin);
  // The head, with its far cheek in shadow and a key light.
  oval(ctx, u * 0.15, 0, rx, 23, skin);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(u * 0.15, 0, rx, 23, 0, 0, TAU);
  ctx.clip();
  oval(ctx, -u * 2.6 + (u >= 0 ? -21 : 21), 4, 12, 26, alpha(shade, 0.5));
  if (f.key && (f.keyAmount ?? 0) > 0) glow(ctx, f.keyX ?? 0, f.keyY ?? 0, 44, f.key, f.keyAmount);
  ctx.restore();
  // Years.
  const heavy = who === 'abe' || who === 'walt';
  if (heavy) {
    line(ctx, alpha(shade, 0.85), 0.9, [u - 9, -13.5, u - 2, -14.5, u + 8, -13.5]);
    line(ctx, alpha(shade, 0.75), 0.9, [u - 7, -16.8, u + 6, -16.8]);
    line(ctx, shade, 1.1, [u - 5.5, 7.5, u - 8.5, 12.5, u - 8, 17]);
    line(ctx, shade, 1.1, [u + 5.5, 7.5, u + 8.5, 12.5, u + 8, 17]);
    for (const sd of [-1, 1]) {
      const ex = sd * 8 + u;
      line(ctx, alpha(shade, 0.9), 0.8, [ex + sd * 5.5, -3.5, ex + sd * 8.5, -5]);
      line(ctx, alpha(shade, 0.9), 0.8, [ex + sd * 5.5, -1, ex + sd * 8.5, -0.5]);
      line(ctx, alpha(shade, 0.9), 1, [ex - 3.5, 4.2, ex, 5.8, ex + 3.5, 4.2]);
    }
  }
  if (who === 'abe')
    for (let i = 0; i < STUBBLE.length; i += 2)
      box(ctx, STUBBLE[i] + u * 0.6, STUBBLE[i + 1], 0.6, 0.6, alpha(T('#F2EEE6'), 0.55));
  // Eyes.
  const eyes = f.eyes ?? 'open';
  const [lx, ly] = f.look ?? [0, 0];
  const iris = who === 'abe' ? '#6A8AA6' : who === 'kit' ? '#3A3020' : '#5A4632';
  for (const sd of [-1, 1]) {
    const ex = sd * 8 + u,
      ey = -2;
    if (eyes === 'closed') {
      line(ctx, ink, 1.3, [ex - 4.2, ey + 0.6, ex, ey + 2.4, ex + 4.2, ey + 0.6]);
      continue;
    }
    const wide = eyes === 'wide' ? 1.15 : 1;
    const px = ex + lx * 1.7,
      py = ey + ly * 1.5 + (eyes === 'down' ? 1.6 : 0);
    oval(ctx, ex, ey, 4.5 * wide, 4.7 * wide, T('#F8F4EE'));
    disc(ctx, px, py + 0.4, 2.7, T(iris));
    disc(ctx, px, py + 0.4, 1.3, ink);
    disc(ctx, px - 0.9, py - 0.5, 0.8, '#FFFFFF');
    const lid =
      eyes === 'half'
        ? 0.55
        : eyes === 'down'
          ? 0.62
          : eyes === 'squint'
            ? 0.7
            : eyes === 'wide'
              ? 0
              : heavy
                ? 0.3
                : 0.14;
    const top = ey - 5.4,
      cut = ey - 5.4 + lid * 9.4;
    poly(ctx, skin, [ex - 5.4, top - 1, ex + 5.4, top - 1, ex + 5.4, cut, ex - 5.4, cut]);
    line(ctx, ink, 1.2, [ex - 4.6, cut + 0.6, ex, cut - 0.2, ex + 4.6, cut + 0.6]);
    if (eyes === 'squint')
      poly(ctx, skin, [ex - 5, ey + 5.5, ex + 5, ey + 5.5, ex + 5, ey + 2.6, ex - 5, ey + 2.6]);
    const wet = f.wet ?? 0;
    if (wet > 0) {
      disc(ctx, px + 1.1, py + 1.6, 0.7 * wet, alpha('#FFFFFF', 0.9));
      line(ctx, alpha('#CFEAF5', wet), 1.1, [ex - 3.6, ey + 4.4, ex + 3.6, ey + 4.4]);
    }
  }
  // Brows.
  const browC = T(
    who === 'kit' ? '#2A201C' : who === 'young' ? '#3A2618' : who === 'abe' ? '#EAE6DE' : '#B4AEA4',
  );
  const b = f.brows ?? 0;
  const thick = heavy ? 3 : 2;
  for (const sd of [-1, 1]) {
    const ex = sd * 8 + u;
    const base =
      (who === 'kit' ? -9.6 : -10.5) - (f.raise ?? 0) * 3.5 + (eyes === 'squint' ? 1.5 : 0);
    line(ctx, browC, thick, [ex + sd * 5.2, base + b * 0.8, ex - sd * 4, base - b * 2.4]);
  }
  // Nose.
  oval(ctx, u * 1.15, 7.5, heavy ? 3 : 2.4, 3.2, shade);
  oval(ctx, u * 1.15 - 0.7, 6.3, 1.1, 1.3, alpha('#FFFFFF', 0.25));
  // Moustache.
  if (who === 'walt' || who === 'young')
    poly(ctx, T(who === 'walt' ? '#C4BEB4' : '#3A2A1E'), [
      u - 11,
      13,
      u - 6,
      9.6,
      u,
      10.6,
      u + 6,
      9.6,
      u + 11,
      13,
      u + 8,
      14.6,
      u,
      13,
      u - 8,
      14.6,
    ]);
  // Mouth.
  const mx = u,
    my = who === 'walt' || who === 'young' ? 16.6 : 15.5;
  const lip = T(who === 'kit' ? '#7A3A34' : INK);
  switch (f.mouth ?? 'flat') {
    case 'flat':
      line(ctx, lip, 1.4, [mx - 5, my + 1, mx + 5, my + 1]);
      break;
    case 'tight':
      line(ctx, lip, 1.7, [mx - 3.5, my + 1, mx + 3.5, my + 1]);
      break;
    case 'soft':
      line(ctx, lip, 1.4, [
        mx - 5.5,
        my + 0.2,
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
        my - 0.6,
        mx - 2.5,
        my + 2.4,
        mx + 2.5,
        my + 2.4,
        mx + 6,
        my - 0.6,
      ]);
      break;
    case 'grin':
      oval(ctx, mx, my + 1.4, 5.6, 2.6, lip);
      box(ctx, mx - 4, my + 0.2, 8, 1.4, '#FFFFFF');
      break;
    case 'sad':
      line(ctx, lip, 1.4, [
        mx - 5.5,
        my + 2.6,
        mx - 2,
        my + 0.8,
        mx + 2,
        my + 0.8,
        mx + 5.5,
        my + 2.6,
      ]);
      break;
    case 'part':
      oval(ctx, mx, my + 1.4, 3.6, 1.6, lip);
      break;
    case 'o':
      oval(ctx, mx, my + 1.6, 2.4, 2.8, lip);
      break;
    case 'open':
      oval(ctx, mx, my + 2, 4, 3.6, lip);
      oval(ctx, mx, my + 3.6, 2.4, 1.2, T('#B8605A'));
      break;
  }
  // Hats and hair.
  const h = (points: number[], color: string) =>
    poly(
      ctx,
      color,
      points.map((v, i) => (i % 2 ? v : v + u * 0.3)),
    );
  if (who === 'kit') {
    if (wear === 'night') {
      h([-19.5, -12, -19, -20, -11, -27.5, 0, -29.5, 11, -27.5, 19, -20, 19.5, -12], T(BLACK));
      h([-20, -18, 20, -18, 20, -12, -20, -12], T('#1F222A'));
      for (let i = -16; i <= 16; i += 4)
        h([i, -18, i + 0.8, -18, i + 0.8, -12, i, -12], T('#181A20'));
      line(ctx, alpha(T(RIM), 0.5), 1, [
        -19 + u * 0.3,
        -20.5,
        -8 + u * 0.3,
        -27.5,
        6 + u * 0.3,
        -28.5,
      ]);
      h([-18, -12, -14.5, -12, -15.5, 4, -18.5, 2], T('#2A201C'));
      h([14.5, -12, 18, -12, 18.5, 2, 15.5, 4], T('#2A201C'));
      const lamp = f.lamp ?? 1;
      h([-4.5, -22.5, 4.5, -22.5, 4.5, -17, -4.5, -17], T('#2A2C33'));
      disc(ctx, u * 0.3, -19.8, 2.2, alpha(RED, 0.5 + lamp * 0.5));
      if (lamp > 0) glow(ctx, u * 0.3, -19.8, 20, RED, 0.5 * lamp);
    } else {
      h(
        [
          -19, 3, -20.5, -10, -15, -21, -5, -26, 7, -25.5, 16, -20, 20.5, -9, 19.5, 3, 16.5, -7, 10,
          -13, 1, -15, -8, -13, -14.5, -7,
        ],
        T('#2E221E'),
      );
      line(ctx, T('#45342C'), 1, [-6 + u * 0.3, -22, 4 + u * 0.3, -21, 12 + u * 0.3, -16]);
    }
  } else if (who === 'abe') {
    oval(ctx, -18 + u * 0.3, -4, 4, 6, T('#E6E2DA'));
    oval(ctx, 18 + u * 0.3, -4, 4, 6, T('#E6E2DA'));
    h([-21, -7, -19.5, -20, -9, -27, 8, -27.5, 19.5, -21, 22, -9, 12, -10, -10, -10], T(TWEED));
    for (let i = 0; i < TWEED_FLECKS.length; i += 2)
      box(ctx, TWEED_FLECKS[i] + u * 0.3, TWEED_FLECKS[i + 1], 1, 1, T('#8A7458'));
    h([-17, -11.5, 18, -11.5, 23, -5.5, -15, -5.5], T('#5A4836'));
    line(ctx, T('#7E6850'), 0.8, [-15 + u * 0.3, -6.2, 22 + u * 0.3, -6.2]);
  } else {
    const side = T(who === 'young' ? '#3A2618' : '#C8C4BC');
    oval(ctx, -18.5 + u * 0.3, -3, 4, 7, side);
    oval(ctx, 18.5 + u * 0.3, -3, 4, 7, side);
    const cy = f.capY ?? 0;
    const c = (points: number[], color: string) =>
      h(
        points.map((v, i) => (i % 2 ? v + cy : v)),
        color,
      );
    c([-24, -11, -22, -24, -12, -31, 12, -31, 22, -24, 24, -11], T(NAVY));
    c([-23, -15.5, 23, -15.5, 23, -10.5, -23, -10.5], T('#151A28'));
    c([-21, -11, 21, -11, 17, -5, -17, -5], T('#0C0D12'));
    line(ctx, alpha('#FFFFFF', 0.22), 1, [-15 + u * 0.3, -9.5 + cy, 15 + u * 0.3, -9.5 + cy]);
    c([-3, -25, 3, -25, 3, -20, 0, -17.5, -3, -20], T(BRASS));
  }
  ctx.restore();
}

function clothes(
  ctx: Ctx,
  who: Who,
  wear: 'night' | 'dawn' | 'day',
  u: number,
  T: Tone,
  coil: boolean,
) {
  const shoulders = [-46, 100, -42, 46, -17, 30, 17, 30, 42, 46, 46, 100];
  box(ctx, -7.5 + u * 0.25, 12, 15, 21, T(SKIN[who][1]));
  if (who === 'kit') {
    const coat = wear === 'day' ? KIT_COAT : BLACK;
    poly(ctx, T(coat), shoulders);
    if (wear === 'day') {
      poly(ctx, T('#3E5A48'), [-14, 24, 14, 24, 16, 40, 0, 48, -16, 40]);
      poly(ctx, T(mix(KIT_COAT, '#000000', 0.2)), [-30, 100, -18, 44, -10, 100]);
    } else {
      line(ctx, alpha(T(RIM), 0.6), 1.5, [-42, 47, -17, 31, 17, 31, 42, 47]);
      poly(ctx, T('#1C1F26'), [-12, 12, 12, 12, 14, 32, -14, 32]);
      line(ctx, T('#2A2D35'), 1, [-12, 19, 12, 19]);
      line(ctx, T('#2A2D35'), 1, [-13, 25, 13, 25]);
      if (coil) {
        // The coil of white rope over her shoulder: three loose loops.
        ctx.strokeStyle = alpha(T(ROPE), 0.9);
        ctx.lineWidth = 1.6;
        for (const [dx, dy, a] of [
          [0, 0, 0.42],
          [2.5, 1.5, 0.32],
          [5, 3, 0.52],
        ] as const) {
          ctx.beginPath();
          ctx.ellipse(-29 + dx, 60 + dy, 7, 24, a, 0, TAU);
          ctx.stroke();
        }
      }
    }
    return;
  }
  if (who === 'abe') {
    const coat = wear === 'day' ? SUNDAY : CARDIGAN;
    poly(ctx, T(coat), shoulders);
    poly(ctx, T('#DCD6C8'), [-10, 28, 0, 44, 10, 28, 6, 26, -6, 26]);
    if (wear === 'day') {
      poly(ctx, T('#6A2A2A'), [-2.5, 34, 2.5, 34, 4, 70, 0, 76, -4, 70]);
      poly(ctx, T(mix(SUNDAY, '#000000', 0.25)), [-17, 30, -4, 60, -10, 100, -30, 100]);
      poly(ctx, T(mix(SUNDAY, '#000000', 0.25)), [17, 30, 4, 60, 10, 100, 30, 100]);
    } else {
      poly(
        ctx,
        T(mix(CARDIGAN, '#000000', 0.18)),
        [-18, 31, 0, 70, 18, 31, 22, 34, 0, 80, -22, 34],
      );
      for (const by of [74, 86, 98]) disc(ctx, 0, by, 1.4, T('#5A5A58'));
    }
    return;
  }
  // Walt (or the young man in the photo): the navy uniform, a coat over it by day.
  poly(ctx, T(NAVY), shoulders);
  poly(ctx, T('#D8D8D0'), [-9, 28, 0, 40, 9, 28]);
  poly(ctx, T('#141826'), [-2, 32, 2, 32, 3, 64, 0, 70, -3, 64]);
  for (const sx of [-22, 22]) box(ctx, sx - 6, 38, 12, 3, T('#3E4A6E'));
  disc(ctx, -14, 58, 1.3, T('#C8C8C0'));
  disc(ctx, 14, 58, 1.3, T('#C8C8C0'));
  if (wear === 'day') {
    poly(ctx, T(WALT_COAT), [-46, 100, -42, 46, -17, 30, -8, 46, -14, 100]);
    poly(ctx, T(WALT_COAT), [46, 100, 42, 46, 17, 30, 8, 46, 14, 100]);
    poly(ctx, T(mix(WALT_COAT, '#FFFFFF', 0.12)), [-17, 30, -8, 46, -12, 52, -22, 34]);
  }
}

// ——— Close-ups: hands ———
type HandO = {
  kind: 'abe' | 'kit' | 'bare';
  palm?: boolean;
  curl?: number;
  grip?: number;
  T?: Tone;
  sleeve?: string;
  /** Painted on the palm, under the fingers (a pouch, a wren). */
  hold?: () => void;
};
/**
 * A hand seen from above, fingers pointing right from the knuckles at (x, y), thumb on the upper
 * side (on the lower side for a palm turned up). About 55 px from wrist to fingertip at s = 1.
 * A palm turned up closes by folding its fingers back over whatever it holds.
 */
function hand(ctx: Ctx, x: number, y: number, s: number, rot: number, o: HandO) {
  const T = o.T ?? keep;
  const glove = o.kind === 'kit';
  const old = o.kind === 'abe';
  const base = glove ? '#1A1C22' : old ? '#E0AE8E' : PALE;
  const back = T(base);
  const skin = T(o.palm && !glove ? mix(base, '#F4C8B4', 0.4) : base),
    shade = T(glove ? '#33373F' : old ? '#B07C62' : '#C4A090'),
    nail = T(glove ? '#2A2D35' : mix(base, '#FFFFFF', 0.4));
  const curl = o.curl ?? 0.2;
  const frame = () => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, o.palm ? -s : s);
  };
  frame();
  if (o.sleeve) poly(ctx, T(o.sleeve), [-110, -17, -30, -14, -28, 15, -110, 19]);
  poly(ctx, skin, [-30, -9.5, -14, -11.5, 0, -12.5, 3, -11, 3, 12, 0, 13.5, -14, 11.5, -30, 9.5]);
  if (o.palm && !glove) {
    line(ctx, alpha(shade, 0.6), 0.8, [-22, -4, -10, -1, -2, -6]);
    line(ctx, alpha(shade, 0.6), 0.8, [-20, 3, -8, 5, 0, 2]);
  }
  if (o.hold) {
    ctx.restore();
    o.hold();
    frame();
  }
  const fold = o.palm ? clamp((curl - 0.3) / 0.7) : 0;
  const fingers: readonly (readonly [number, number, number])[] = [
    [-8.3, 21, 5.4],
    [-2.7, 23, 5.5],
    [2.9, 21, 5.2],
    [8.2, 16.5, 4.6],
  ];
  for (const [fy, len, w] of fingers) {
    if (fold > 0) {
      // Folding back over the palm: the open part shortens, the backs of the fingers lie down.
      const L = len * (1 - fold);
      if (L > 1) line(ctx, skin, w, [0, fy, L, fy]);
      const b = len * 0.6 * fold;
      line(ctx, back, w * 1.05, [1.5, fy, 1.5 - b, fy + 0.4]);
      line(ctx, alpha(shade, 0.75), 0.8, [
        1.5 - b * 0.45,
        fy - w * 0.42,
        1.5 - b * 0.45,
        fy + w * 0.42,
      ]);
      line(ctx, alpha(shade, 0.6), 0.8, [1.5, fy - w * 0.45, 1.5, fy + w * 0.45]);
      continue;
    }
    const L = len * (1 - curl * 0.62);
    const drop = curl * 2.4;
    line(ctx, skin, w, [0, fy, L, fy + drop]);
    if (curl > 0.45)
      line(ctx, shade, w * 0.86, [L - 2.2, fy + drop + 0.2, L + 0.3, fy + drop + 0.8]);
    else if (!glove) oval(ctx, L - 0.2, fy + drop, 1.9, w * 0.3, nail);
    for (const k of [0.36, 0.7])
      line(ctx, alpha(shade, 0.7), 0.7, [
        L * k,
        fy - w * 0.28 + drop * k,
        L * k + 0.4,
        fy + w * 0.28 + drop * k,
      ]);
    if (old) oval(ctx, 0.6, fy, 2.4, w * 0.4, alpha('#C88472', 0.4 + (o.grip ?? 0) * 0.3));
  }
  // Thumb.
  const tc = o.palm ? curl : 0;
  line(ctx, fold > 0 ? back : skin, 6.2, [-24, -8, -9, -14.5, 1 - tc * 9, -16.5 + tc * 11]);
  if (!glove) oval(ctx, 2.4 - tc * 9, -16.6 + tc * 11, 1.8, 1.5, nail);
  if (!o.palm && old) {
    line(ctx, alpha('#8A98C4', 0.5), 1.1, [-29, 1.5, -20, -1.5, -10, 1, -4, -1]);
    line(ctx, alpha('#8A98C4', 0.42), 1, [-27, 6.5, -16, 4.8, -6, 6]);
    disc(ctx, -17, -6, 1.5, alpha(shade, 0.65));
    disc(ctx, -22, 3.5, 1.1, alpha(shade, 0.55));
  }
  if (glove) line(ctx, alpha('#5A6070', 0.5), 1, [-26, -8, -6, -11, 2, -10]);
  ctx.restore();
}

// ——— The car ———
type CarO = {
  facing?: 1 | -1;
  lights?: number;
  shake?: number;
  T?: Tone;
  puff?: number;
  seconds?: number;
  people?: boolean;
};
/** A tiny round green bubble car; (x, y) is the road under its middle. */
function bubbleCar(ctx: Ctx, x: number, y: number, s: number, o: CarO = {}) {
  const T = o.T ?? keep;
  const lights = o.lights ?? 0;
  ctx.save();
  ctx.translate(x, y + (o.shake ?? 0));
  ctx.scale(s * (o.facing ?? 1), s);
  oval(ctx, 0, 0, 18, 2.2, alpha('#05070B', 0.5));
  // Exhaust.
  const puff = o.puff ?? 0;
  if (puff > 0)
    for (let i = 0; i < 3; i++) {
      const k = ((((o.seconds ?? 0) * 1.6 + i / 3) % 1) + 1) % 1;
      disc(ctx, -18 - k * 14, -3 - k * 6, 1.5 + k * 3, alpha('#B8C0CC', (1 - k) * 0.35 * puff));
    }
  oval(ctx, 0, -11, 17, 11.5, T(CAR));
  oval(ctx, -2, -14, 13, 7, T(CAR_HI));
  oval(ctx, 0, -9, 17, 8, T(CAR));
  box(ctx, -15, -5, 30, 3, T(CAR_D));
  oval(ctx, 3, -14.5, 10, 6, T('#1A2632'));
  oval(ctx, 0.5, -16, 4, 2, alpha('#FFFFFF', 0.18));
  if (o.people ?? true) {
    disc(ctx, 0, -14, 3, T('#2A2A28'));
    box(ctx, -3, -17.6, 6, 2, T(TWEED));
    disc(ctx, 8, -14, 2.8, T(BLACK));
  }
  line(ctx, T('#C8CCD0'), 0.8, [-16, -4, 16, -4]);
  disc(ctx, 15.5, -8, 2.4, T(lights > 0 ? mix('#D8D4C0', '#FFF4C8', lights) : '#B8B4A0'));
  if (lights > 0) glow(ctx, 17, -8, 16, LAMP, 0.5 * lights);
  disc(ctx, -15.8, -8, 1.3, T('#B03028'));
  for (const wx of [-10, 10]) {
    disc(ctx, wx, -2.5, 3.6, T('#16181C'));
    disc(ctx, wx, -2.5, 1.5, T('#9A9EA4'));
  }
  ctx.restore();
}

// ——— The street ———
function street(ctx: Ctx, seconds: number, door: number) {
  vgrad(ctx, 0, 0, W, 130, SKY_NIGHT);
  starfield(ctx, seconds, { count: 26, seed: 5, bottom: 80, colors: ['#E8E0C8', '#A9B8D8'] });
  // The moon.
  glow(ctx, 262, 38, 70, SHAFT, 0.26);
  disc(ctx, 262, 38, 19, MOON);
  disc(ctx, 256, 34, 4, '#DAD4BC');
  disc(ctx, 268, 44, 3, '#DAD4BC');
  // Far roofs.
  poly(ctx, '#121925', [0, 130, 0, 96, 24, 96, 24, 88, 46, 88, 46, 100, 60, 100, 60, 130]);
  poly(ctx, '#121925', [262, 130, 262, 104, 286, 92, 310, 104, 320, 104, 320, 130]);
  // The River Museum.
  const st = NIGHT_STONE,
    lit = mix(STONE, '#4A5A78', 0.3),
    dark = mix(STONE, '#0E1420', 0.7);
  box(ctx, 66, 76, 188, 62, '#141B28');
  poly(ctx, st, [60, 62, 160, 30, 260, 62]);
  poly(ctx, dark, [76, 58, 160, 36, 244, 58]);
  box(ctx, 58, 60, 204, 3, lit);
  box(ctx, 62, 63, 196, 15, st);
  write(ctx, 'RIVER MUSEUM', 160.7, 75.2, { size: 11, color: mix(STONE, '#FFFFFF', 0.1) });
  write(ctx, 'RIVER MUSEUM', 160, 74.5, { size: 11, color: mix(STONE, '#0E1420', 0.88) });
  box(ctx, 60, 77, 200, 2, lit);
  // The door, which opens later.
  const dx = 148,
    dw = 24;
  box(ctx, dx, 96, dw, 40, '#2A1E18');
  if (door > 0) {
    box(ctx, dx, 96, dw * door, 40, LAMP);
    glow(ctx, dx + dw / 2, 120, 50, LAMP, 0.35 * door);
  }
  box(ctx, dx + dw * door, 96, 1, 40, '#120C0A');
  // Columns: lit on the moon's side.
  for (let i = 0; i < 6; i++) {
    const cx = 80 + i * 32;
    box(ctx, cx - 6, 80, 12, 56, st);
    box(ctx, cx + 2, 80, 4, 56, lit);
    box(ctx, cx - 6, 80, 2, 56, dark);
    box(ctx, cx - 8, 78, 16, 4, lit);
    box(ctx, cx - 8, 132, 16, 4, st);
  }
  for (let k = 0; k < 3; k++)
    box(ctx, 62 - k * 6, 136 + k * 5, 196 + k * 12, 5, k % 2 ? st : mix(st, lit, 0.4));
  // The street lamp.
  box(ctx, 290, 92, 2, 60, '#1A1E26');
  poly(ctx, '#1A1E26', [284, 84, 298, 84, 296, 81, 286, 81]);
  box(ctx, 286, 84, 10, 9, LAMP);
  glow(ctx, 291, 89, 60, LAMP, 0.42);
  // Wet cobbles.
  vgrad(ctx, 0, 151, W, H, ['#1A202B', '#10141C']);
  for (let row = 0; row < 4; row++)
    for (let i = 0; i < 22; i++) {
      const cx = ((i * 15 + row * 7) % 330) - 5,
        cy = 155 + row * 7 + row * row;
      box(ctx, cx, cy, 9 + row, 1, alpha('#3A4458', 0.5 - row * 0.08));
    }
  // Reflections: the lamp and the moon in the wet.
  for (let i = 0; i < 6; i++) {
    const k = Math.sin(seconds * 2.2 + i * 1.7) * 1.5;
    box(ctx, 288 + k, 156 + i * 4, 6 - i * 0.6, 2, alpha(LAMP, 0.45 - i * 0.06));
    box(ctx, 259 - k, 158 + i * 4, 5, 1.5, alpha(MOON, 0.25 - i * 0.03));
  }
}

/** How much night sky the opening shot starts on, above the street, before it tilts down. */
const SKY_ABOVE = 66;
function streetShot(ctx: Ctx, t: number, seconds: number) {
  // It opens high, with the carving low in frame (clear of the title card's words), and tilts
  // down to the street before the car comes.
  const v = keyed(t, [
    [0.2, 160, 90, 1],
    [1.8, 160, SKY_ABOVE + 90, 1],
    [6, 168, SKY_ABOVE + 100, 1.08],
  ]);
  cam(
    ctx,
    view(v),
    () => {
      vgrad(ctx, 0, 0, W, SKY_ABOVE, ['#070B12', SKY_NIGHT[0]]);
      starfield(ctx, seconds, { count: 14, seed: 23, top: 4, bottom: SKY_ABOVE, colors: [MOON] });
      ctx.translate(0, SKY_ABOVE);
      streetScene(ctx, t, seconds);
    },
    { w: W, h: H + SKY_ABOVE },
  );
}
function streetScene(ctx: Ctx, t: number, seconds: number) {
  street(ctx, seconds, 0);
  const running = t >= CAR_IN && t < ENGINE_OFF;
  const x = lerp(-30, 168, easeOut(span(t, CAR_IN, PARKED)));
  const cough = hump(t, ENGINE_OFF, ENGINE_OFF + 0.3);
  bubbleCar(ctx, x, 172, 1.35, {
    facing: 1,
    lights: t < ENGINE_OFF ? 1 : 1 - span(t, ENGINE_OFF + 0.2, ENGINE_OFF + 0.8),
    shake: running ? Math.sin(seconds * 40) * 0.35 : cough * Math.sin(seconds * 60) * 0.8,
    puff: running ? 1 : cough,
    seconds,
  });
  // A gutter drip, catching the lamp.
  const drip = span(t, GUTTER - 0.4, GUTTER);
  if (drip > 0 && drip < 1) box(ctx, 304, 140 + drip * 18, 1, 2, alpha(LAMP, 0.7));
}

// ——— In the car ———
type CabinO = {
  dawn?: number;
  shake?: number;
  abe: Face;
  kit: Face;
  abeX?: number;
  kitX?: number;
  kitY?: number;
  kitTilt?: number;
  front?: () => void;
};
/** The two of them through the round windscreen: Abe at the wheel, Kit beside him. */
function cabin(ctx: Ctx, o: CabinO) {
  const dawn = o.dawn ?? 0;
  const T: Tone = dawn > 0 ? toward(PINK, 0.25 * dawn) : keep;
  ctx.save();
  ctx.translate(0, o.shake ?? 0);
  // Inside: dark, with the rear window glowing.
  box(ctx, 0, 0, W, H, mix('#0C1118', '#5A4048', dawn));
  oval(ctx, 160, 46, 80, 26, mix('#1A2434', PINK_LT, dawn));
  glow(ctx, 160, 46, 90, dawn > 0 ? PINK : SHAFT, 0.25);
  // Seat backs.
  oval(ctx, 96, 120, 46, 40, mix('#3A2A22', '#6A4A44', dawn));
  oval(ctx, 228, 120, 46, 40, mix('#3A2A22', '#6A4A44', dawn));
  const key = dawn > 0 ? PINK : LAMP;
  portrait(ctx, 'abe', o.abeX ?? 98, 80, 0.95, {
    key,
    keyX: 30,
    keyY: -6,
    keyAmount: 0.3 + dawn * 0.1,
    T,
    ...o.abe,
  });
  ctx.save();
  ctx.translate(o.kitX ?? 224, o.kitY ?? 84);
  ctx.rotate(o.kitTilt ?? 0);
  portrait(ctx, 'kit', 0, 0, 0.92, {
    key,
    keyX: 26,
    keyY: -8,
    keyAmount: 0.35 + dawn * 0.1,
    T,
    ...o.kit,
  });
  ctx.restore();
  o.front?.();
  // The dashboard and the wheel.
  box(ctx, 0, 148, W, 32, mix('#14181E', '#3A2E30', dawn));
  ctx.strokeStyle = mix('#0A0A0C', '#2A2224', dawn);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(98, 160, 44, 20, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.restore();
  // The glass: a lamp's reflection, and the round green frame of the windscreen.
  line(ctx, alpha('#FFFFFF', 0.06 + dawn * 0.04), 10, [210, 20, 250, 150]);
  line(ctx, alpha('#FFFFFF', 0.04), 5, [236, 20, 270, 140]);
  windscreen(ctx, dawn);
}
/** The round green frame of the windscreen: night-dark, or pink with the dawn on it. */
function windscreen(ctx: Ctx, dawn: number) {
  const body = mix(mix(CAR, '#0A1220', 0.72), mix(CAR, '#B07A80', 0.45), dawn);
  const hi = mix(mix(CAR_HI, '#0A1220', 0.35), mix(CAR_HI, PINK_LT, 0.4), dawn);
  const lo = mix(mix(CAR_D, '#05080C', 0.5), mix(CAR_D, '#3A2830', 0.3), dawn);
  ctx.save();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.moveTo(300, 90);
  ctx.ellipse(160, 90, 140, 74, 0, 0, TAU, true);
  ctx.fill('evenodd');
  ctx.strokeStyle = hi;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(160, 90, 141, 75, 0, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
  ctx.strokeStyle = lo;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(160, 90, 142, 76, 0, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
  ctx.restore();
  // Wipers resting.
  line(ctx, '#1A1C20', 2, [70, 160, 150, 152]);
  line(ctx, '#1A1C20', 2, [180, 160, 260, 152]);
}
const kitBlink = (seconds: number) => (blink(seconds, 1) ? 'closed' : 'open');

function carShot(ctx: Ctx, t: number, seconds: number) {
  const reach = easeOut(span(t, REACH, REACH + 0.6));
  const v = keyed(t, [
    [6, 160, 90, 1],
    [8.6, 160, 96, 1.06],
  ]);
  cam(ctx, view(v), () =>
    cabin(ctx, {
      abe: { eyes: 'down', look: [0.4, 1], brows: 0.6, mouth: 'flat', turn: 0.2 },
      kit: {
        eyes: t < PALM + 0.3 ? kitBlink(seconds) : 'down',
        look: [-0.8, 0.8],
        brows: 0.2,
        mouth: 'soft',
        turn: -0.35,
      },
      front: () => {
        // His palm, held up between them, the pouch on it; her hand comes to meet it.
        hand(ctx, 134, 122, 0.66, -0.75, {
          kind: 'abe',
          palm: true,
          curl: 0.12,
          sleeve: CARDIGAN,
          hold: () => pouch(ctx, 128, 128, 0.95, {}),
        });
        hand(ctx, lerp(262, 200, reach), lerp(162, 132, reach), 0.6, Math.PI + 0.6, {
          kind: 'kit',
          palm: true,
          curl: 0.1,
          sleeve: BLACK,
        });
      },
    }),
  );
}

/** The hands insert: his palm and the pouch; her open glove waiting; then he lets it go. */
function handsShot(ctx: Ctx, t: number, second: boolean) {
  const curl = second
    ? 1 - easeOut(span(t, OPEN, OPEN + 0.5))
    : easeIn(span(t, CLOSE - 0.15, CLOSE + 0.55));
  // He opens his hand; her glove comes under the edge of it; he tips the pouch into it.
  const come = second ? ease(span(t, 11.7, 12.1)) : 0;
  const tip = second ? easeIn(span(t, 12.05, TAKE - 0.05)) : 0;
  const shut = second ? easeOut(span(t, TAKE - 0.05, TAKE + 0.3)) : 0;
  const away = second ? ease(span(t, TAKE + 0.25, 13)) : 0;
  const z = second ? lerp(1.0, 1.05, span(t, 11.3, 13)) : lerp(1.0, 1.06, span(t, 8.6, 10.3));
  const gx = lerp(292, 214, come) + away * 110,
    gy = lerp(118, 108, come) - away * 6;
  const tilt = hump(t, 11.95, TAKE + 0.2) * 0.22;
  const slide = () =>
    pouch(ctx, lerp(120, gx + 26, tip), lerp(100, gy, tip) - Math.sin(tip * Math.PI) * 6, 2.3, {});
  cam(ctx, { x: 160, y: 92, zoom: z }, () => {
    box(ctx, 0, 0, W, H, '#14181F');
    glow(ctx, 250, 40, 160, LAMP, 0.22);
    oval(ctx, 140, 168, 170, 40, '#2A2C30');
    // Abe's cardigan sleeve and his big palm; the pouch on it, his fingers closing over it.
    hand(ctx, 150, 100, 2.1, -0.08 + tilt, {
      kind: 'abe',
      palm: true,
      curl: Math.max(curl, 0.05),
      sleeve: CARDIGAN,
      grip: curl,
      hold: () => {
        if (tip < 0.5) slide();
      },
    });
    hand(ctx, gx, gy, 1.7, Math.PI + 0.12, {
      kind: 'kit',
      palm: true,
      curl: lerp(0.1, 0.9, shut),
      sleeve: BLACK,
      hold: () => {
        if (tip >= 0.5) slide();
      },
    });
  });
}

function abeClose(ctx: Ctx, t: number) {
  cam(ctx, { x: 160, y: 90, zoom: lerp(1, 1.04, span(t, 10.3, 11.3)) }, () => {
    box(ctx, 0, 0, W, H, '#0E131A');
    glow(ctx, 240, 50, 120, SHAFT, 0.15);
    oval(ctx, 140, 150, 80, 60, '#3A2A22');
    portrait(ctx, 'abe', 150, 92, 1.55, {
      eyes: t < 10.75 ? 'closed' : 'down',
      look: [0.5, 1],
      brows: 0.9,
      raise: 0.2,
      mouth: 'tight',
      turn: 0.25,
      key: LAMP,
      keyX: 26,
      keyY: -10,
      keyAmount: 0.3,
      wet: 0.5,
    });
  });
}

// ——— The wall, from the driver's seat ———
function wallShot(ctx: Ctx, t: number, seconds: number) {
  const k = span(t, 13, 18);
  vgrad(ctx, 0, 0, W, H, ['#0A0F18', '#141C2A', '#1F2A3A']);
  starfield(ctx, seconds, { count: 20, seed: 9, bottom: 120 });
  const mx = 150,
    my = 62;
  glow(ctx, mx, my, 110, SHAFT, 0.3);
  disc(ctx, mx, my, 40, MOON);
  disc(ctx, mx - 12, my - 8, 7, '#DCD6C0');
  disc(ctx, mx + 14, my + 12, 5, '#DCD6C0');
  // The museum's side wall and its drainpipe.
  poly(ctx, '#0E131C', [168, 180, 168, 26, 186, 20, 320, 20, 320, 180]);
  box(ctx, 168, 26, 3, 154, '#1C2433');
  box(ctx, 160, 14, 160, 8, '#121822');
  for (let y = 40; y < 180; y += 14) box(ctx, 171, y, 149, 1, '#121822');
  box(ctx, 162, 22, 3, 158, '#2A3242');
  for (let y = 36; y < 180; y += 26) box(ctx, 160, y, 7, 2, '#2A3242');
  // Kit climbing, a black shape crossing the moon.
  const cy = lerp(168, 30, ease(k));
  const ph = (t - 13) * 3.4;
  const climb: Rig = [
    157,
    cy,
    UP + 0.15,
    -0.1,
    UP - 0.25 + Math.sin(ph) * 0.35,
    UP - 0.1 + Math.sin(ph) * 0.3,
    UP - 0.2 - Math.sin(ph) * 0.35,
    UP + Math.sin(ph) * 0.3,
    1.3 + Math.sin(ph) * 0.4,
    -0.3,
    0.9 - Math.sin(ph) * 0.4,
    -0.5,
  ];
  kit(ctx, climb, { s: 1.15, face: 1, lamp: 0.6, rim: 0.4 });
  // Foreground: the windscreen frame, the wheel, and his two big hands gripping it.
  ctx.save();
  ctx.fillStyle = '#06080C';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.moveTo(312, 84);
  ctx.ellipse(160, 84, 152, 78, 0, 0, TAU, true);
  ctx.fill('evenodd');
  ctx.restore();
  box(ctx, 0, 150, W, 30, '#0A0C10');
  ctx.strokeStyle = '#141418';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(160, 196, 120, 48, 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  const grip = 0.5 + 0.5 * Math.sin(seconds * 2.4);
  const T = toward('#1A2434', 0.35);
  hand(ctx, 66, 168, 1.25, -0.95, {
    kind: 'abe',
    curl: 0.75 + grip * 0.15,
    sleeve: CARDIGAN,
    grip,
    T,
  });
  hand(ctx, 254, 168, 1.25, Math.PI + 0.95, {
    kind: 'abe',
    palm: true,
    curl: 0.75 + (1 - grip) * 0.15,
    sleeve: CARDIGAN,
    grip,
    T,
  });
}

// ——— The roof ———
function roofShot(ctx: Ctx, t: number, seconds: number) {
  vgrad(ctx, 0, 0, W, 130, SKY_NIGHT);
  starfield(ctx, seconds, { count: 28, seed: 13, bottom: 100 });
  glow(ctx, 70, 40, 70, SHAFT, 0.25);
  disc(ctx, 70, 40, 18, MOON);
  poly(
    ctx,
    '#121925',
    [0, 130, 0, 112, 40, 104, 80, 112, 120, 106, 160, 114, 200, 102, 260, 110, 320, 104, 320, 130],
  );
  // The roof deck.
  box(ctx, 0, 128, W, 52, '#1A202C');
  for (let x = 0; x < W; x += 12) box(ctx, x, 128, 1, 52, '#151A24');
  box(ctx, 0, 126, W, 3, '#2A3242');
  // The chimney.
  box(ctx, 76, 82, 26, 48, '#2A2226');
  box(ctx, 76, 82, 4, 48, '#3A3036');
  box(ctx, 72, 78, 34, 6, '#3A3036');
  // The skylight: a glass hatch whose pane lifts at the latch.
  const lift = easeOut(span(t, LATCH, LATCH + 0.45));
  box(ctx, 190, 112, 96, 18, '#2A3242');
  box(ctx, 194, 115, 88, 12, '#0A0E14');
  glow(ctx, 238, 121, 40, BEAM, 0.18 + lift * 0.12);
  poly(ctx, alpha('#5A7090', 0.75), [
    194,
    115,
    282,
    115,
    282 - lift * 6,
    115 - lift * 22,
    194 + lift * 6,
    115 - lift * 22,
  ]);
  line(ctx, '#3A4458', 1.5, [
    194,
    115,
    194 + lift * 6,
    115 - lift * 22,
    282 - lift * 6,
    115 - lift * 22,
    282,
    115,
  ]);
  line(ctx, alpha('#FFFFFF', 0.25), 1, [204, 114 - lift * 18, 230, 114 - lift * 4]);
  // The rope, clipped to the chimney and coiled at her feet.
  line(ctx, ROPE, 1.4, [102, 108, 92, 110, 82, 108]);
  line(ctx, ROPE, 1.2, [102, 108, 140, 124, 160, 126]);
  ctx.strokeStyle = ROPE;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(168, 126, 9, 2.6, 0, 0, TAU);
  ctx.stroke();
  // Kit: clipping on, then reaching for the latch.
  const reach = ease(span(t, 18.9, LATCH));
  const r: Rig = [
    lerp(150, 176, reach),
    120,
    UP - 0.7,
    0.4,
    lerp(1.7, 1.2, reach),
    lerp(2.2, 0.8, reach),
    lerp(2.3, 1.1, reach),
    lerp(2.6, 0.6, reach),
    1.5,
    -0.3,
    -1.4,
    0.2,
  ];
  kit(ctx, r, { s: 1.7, face: 1, coil: false });
  vignette(ctx, 0.5, '#05080C');
}

// ——— Looking down through the skylight ———
function skylightShot(ctx: Ctx, t: number, seconds: number) {
  // Straight down the well of the gallery: walls falling away to the floor and its red web.
  const z = lerp(1, 1.1, span(t, 20, 23));
  const O = { l: 22, r: 298, t: 10, b: 170 };
  const F = { l: 116, r: 204, t: 60, b: 120 };
  const cx = 160,
    cy = 90;
  /** A point in the room (gallery x, height above the floor, depth 0..1) seen from above. */
  const plan = (x: number, h: number, d: number) => {
    const k = 1 + h * 0.0045;
    const fx = lerp(F.l, F.r, (x - 100) / 340),
      fy = lerp(F.t, F.b, d);
    return [cx + (fx - cx) * k, cy + (fy - cy) * k];
  };
  /** A wall of the well, lit near the top and falling into the dark. */
  const wall = (pts: number[], x0: number, y0: number, x1: number, y1: number, top: string) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, top);
    g.addColorStop(1, '#0A0E16');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  };
  cam(ctx, { x: 160, y: 90, zoom: z }, () => {
    box(ctx, 0, 0, W, H, '#06080C');
    wall([O.l, O.t, O.r, O.t, F.r, F.t, F.l, F.t], 0, O.t, 0, F.t, '#2A3448');
    wall([O.l, O.b, O.r, O.b, F.r, F.b, F.l, F.b], 0, O.b, 0, F.b, '#1E2636');
    wall([O.l, O.t, F.l, F.t, F.l, F.b, O.l, O.b], O.l, 0, F.l, 0, '#222A3C');
    wall([O.r, O.t, F.r, F.t, F.r, F.b, O.r, O.b], O.r, 0, F.r, 0, '#2E3A50');
    // Tall windows on the far walls, falling away in perspective.
    for (const k of [0.3, 0.55, 0.8]) {
      const x = lerp(O.l, O.r, k),
        fx = lerp(F.l, F.r, k);
      poly(ctx, alpha(SHAFT, 0.16), [x - 10, O.t, x + 10, O.t, fx + 4, F.t - 14, fx - 4, F.t - 14]);
    }
    box(ctx, F.l, F.t, F.r - F.l, F.b - F.t, '#1A2232');
    for (const [x, d] of [
      [170, 0.15],
      [290, 0.4],
    ] as const) {
      const [ax, ay] = plan(x, 0, d),
        [bx, by] = plan(x + 34, 0, d + 0.45);
      poly(ctx, alpha(SHAFT, 0.22), [ax, ay, ax + 10, ay, bx + 10, by, bx, by]);
    }
    // The pedestal and the gem, rising toward us.
    const [p1x, p1y] = plan(186, 56, 0.4),
      [p2x, p2y] = plan(214, 56, 0.6);
    box(ctx, p1x, p1y, p2x - p1x, p2y - p1y, '#3A4458');
    const [gx, gy] = plan(200, 66, 0.5);
    gem(ctx, gx, gy, 5, seconds);
    // The web: the same beams, seen from above.
    BEAMS.forEach(([x1, y1, x2, y2], i) => {
      const d = 0.12 + rand(i * 3.3 + 1) * 0.76;
      const [ax, ay] = plan(x1, FLOOR - y1, d),
        [bx, by] = plan(x2, FLOOR - y2, d + (rand(i * 7.7) - 0.5) * 0.3);
      line(ctx, alpha(BEAM, 0.22), 3.6, [ax, ay, bx, by]);
      line(ctx, alpha(BEAM, 0.95), 1.3, [ax, ay, bx, by]);
    });
    // The skylight: one pane of glass left on the hinge side, the rest open; the frame.
    ctx.save();
    ctx.fillStyle = alpha('#6A82A8', 0.22);
    ctx.fillRect(O.l, O.t, 70, O.b - O.t);
    ctx.restore();
    line(ctx, alpha('#FFFFFF', 0.16), 6, [30, 120, 84, 20]);
    box(ctx, O.l + 70, O.t, 5, O.b - O.t, '#2A3242');
    box(ctx, 0, 0, W, O.t, '#1A202C');
    box(ctx, 0, O.b, W, H - O.b, '#1A202C');
    box(ctx, 0, 0, O.l, H, '#1A202C');
    box(ctx, O.r, 0, W - O.r, H, '#1A202C');
    line(ctx, '#3A4458', 1.5, [O.l, O.b, O.r, O.b]);
    // The rope pays out, down into the dark toward the floor.
    const pay = easeOut(span(t, 20.8, 22.6));
    if (pay > 0) {
      const ex = lerp(236, 182, pay),
        ey = lerp(170, 100, pay);
      line(ctx, ROPE, lerp(2.2, 1, pay), [240, 178, ex + Math.sin(seconds * 3) * 1.5, ey]);
    }
    // Her gloves on the frame.
    hand(ctx, 200, 188, 0.6, -1.45, { kind: 'kit', curl: 0.75, sleeve: BLACK });
    hand(ctx, 272, 188, 0.6, -1.75, { kind: 'kit', curl: 0.75, sleeve: BLACK });
  });
  vignette(ctx, 0.55, '#05080C');
}

// ——— The gallery shots ———
function galleryNight(ctx: Ctx, t: number, seconds: number, cast: () => void, shaftAmount = 1) {
  room(ctx, t, seconds, 0);
  beams(ctx, 1, seconds);
  cast();
  shafts(ctx, seconds, 0, shaftAmount);
}
type Sleep = {
  jolt?: number;
  dogHead?: number;
  dogEyes?: 'open' | 'closed' | 'half';
  dogMouth?: number;
  dogJerk?: number;
  ear?: number;
  awake?: boolean;
};
/** The top of Walt's chair seat. */
const SEAT = 253;
/** Walt's wooden chair, side on: the seat, a front leg, and a back post up behind his shoulders. */
function chair(ctx: Ctx) {
  const wood = '#2A1E16',
    lit = mix(wood, RIM, 0.45);
  box(ctx, CHAIR + 5, 226, 3, FLOOR - 226, wood);
  box(ctx, CHAIR + 5, 226, 1, FLOOR - 226, lit);
  box(ctx, CHAIR + 2, 226, 8, 2, wood);
  box(ctx, CHAIR - 9, SEAT, 18, 3, wood);
  box(ctx, CHAIR - 9, SEAT, 18, 1, lit);
  box(ctx, CHAIR - 8, SEAT + 3, 2, FLOOR - SEAT - 3, wood);
}
/** Walt asleep in his chair, the dog asleep beneath the desk. */
function sleepers(ctx: Ctx, t: number, o: Sleep = {}) {
  const b = breath(t, WALT_SNORE);
  const jolt = o.jolt ?? 0;
  chair(ctx);
  // Asleep in his chair: leaning back, cap tipped over his eyes, mouth open, arms folded.
  waltFig(ctx, CHAIR, SEAT - jolt * 4, {
    facing: -1,
    seated: true,
    eyes: o.awake ? 'wide' : 'closed',
    mouth: o.awake ? 'o' : b > 0.25 ? 'open' : 'flat',
    lean: o.awake ? 0.05 : -0.18 - b * 0.05,
    arms: o.awake ? [0.9, 1.4] : [0.4, 0.6],
    capOff: o.awake ? 1 + jolt * 2 : -2.5,
  });
  dog(ctx, DOG_BED, 268, 1, {
    lie: 1,
    facing: -1,
    breath: dogSnoring(t) ? breath(t, t >= EYE_SHUT ? EYE_SHUT : DOG_SNORE) : 0,
    eyes: o.dogEyes ?? 'closed',
    head: o.dogHead ?? 0,
    mouth: o.dogMouth ?? 0,
    jerk: o.dogJerk ?? 0,
    ear: o.ear ?? 0,
  });
}

function descentPose(t: number): { r: Rig; spin: number } {
  const k = span(t, 23, 31.6);
  const y = lerp(4, 216, 1 - (1 - k) ** 1.6);
  const jerk = ROPE_CREAKS.reduce((a, c) => a + hump(t, c, c + 0.35) * 1.5, 0);
  const tuck = span(t, 29.5, 31.6);
  const r: Rig = [
    ROPE_X,
    y + jerk,
    0.06,
    0.15,
    lerp(0.4, 0.12, tuck) + Math.sin(t * 0.8) * 0.05,
    lerp(0.15, 0.02, tuck),
    lerp(-0.45, -0.15, tuck),
    lerp(-0.2, -0.05, tuck),
    UP - 0.12,
    UP - 0.1,
    UP + 0.35,
    UP - 0.7,
  ];
  return { r, spin: 0.3 + (t - 23) * 0.36 };
}
/** Where a point in a rig's own frame (as joints() gives it) lands in the scene, as kit() draws it. */
function rigPoint(r: Rig, o: RigO, x: number, y: number) {
  const s = o.s ?? 1;
  return [r[0] + x * s * rigScale(o), r[1] + y * s] as const;
}
function descentShot(ctx: Ctx, t: number, seconds: number) {
  const { r, spin } = descentPose(t);
  // Framed on her hips, so the rope above her feet is always in the shot.
  cam(
    ctx,
    { x: ROPE_X, y: r[1] + 4, zoom: 2.3 },
    () =>
      galleryNight(ctx, t, seconds, () => {
        const sway = Math.sin(seconds * 0.9) * 0.6;
        const o: RigO = { s: 1.25, face: 1, spin };
        const rig: Rig = [r[0] + sway, ...r.slice(1)];
        kit(ctx, rig, o);
        // The white rope, locked round her straight leg's ankle, running up to the skylight.
        const leg = joints(rig).farLeg;
        const [ax, ay] = rigPoint(rig, o, leg[4], leg[5]);
        line(ctx, ROPE, 1, [ax + 1.5, ay + 1, ax + 1.5, ay - 2, ROPE_X + 1.5, 0]);
        ctx.strokeStyle = ROPE;
        ctx.lineWidth = 0.8;
        for (const dy of [0.5, 2.6]) {
          ctx.beginPath();
          ctx.ellipse(ax + 0.6, ay + dy, 2.3, 0.9, -0.2, 0, TAU);
          ctx.stroke();
        }
      }),
    { w: GW, h: GH },
  );
  vignette(ctx, 0.55, '#05080C');
}

function deskShot(ctx: Ctx, t: number, seconds: number) {
  const z = lerp(2.8, 2.95, span(t, 32, 38));
  cam(
    ctx,
    { x: 418, y: 244, zoom: z },
    () => galleryNight(ctx, t, seconds, () => sleepers(ctx, t)),
    { w: GW, h: GH },
  );
  vignette(ctx, 0.5, '#05080C');
}

function photoShot(ctx: Ctx, t: number) {
  const z = lerp(1, 1.08, span(t, 34.5, 37.5));
  const T = toward('#4A5A3A', 0.12);
  cam(ctx, { x: 160, y: 90, zoom: z }, () => {
    box(ctx, 0, 0, W, H, '#1A1814');
    glow(ctx, 60, 10, 160, LAMP_GREEN, 0.35);
    // The silver frame.
    box(ctx, 50, 14, 220, 152, '#8A8C90');
    box(ctx, 54, 18, 212, 144, '#5A5C60');
    box(ctx, 60, 24, 200, 132, '#B9AC8C');
    // The photo, faded warm: a young guard, proud, beside the wren in its case.
    vgrad(ctx, 62, 26, 196, 154, ['#C9B48C', '#A8946C']);
    box(ctx, 62, 118, 196, 36, '#8A7656');
    box(ctx, 190, 96, 52, 46, '#7A6446');
    box(ctx, 192, 62, 48, 34, alpha('#F4ECD8', 0.4));
    box(ctx, 198, 88, 36, 8, '#6A2A2A');
    wren(ctx, 216, 80, 11, { T: toward('#C9A050', 0.1) });
    box(ctx, 192, 62, 48, 1.5, '#E8E0C8');
    box(ctx, 192, 62, 1.5, 34, '#E8E0C8');
    portrait(ctx, 'young', 124, 74, 1.12, {
      T,
      mouth: 'smile',
      eyes: 'open',
      turn: 0.25,
      raise: 0.2,
    });
    // A crease and the photo's soft sheen.
    line(ctx, alpha('#FFFFFF', 0.18), 1, [62, 120, 258, 104]);
    glow(ctx, 90, 40, 80, '#FFFFFF', 0.12);
  });
  vignette(ctx, 0.45, '#050605');
}

/**
 * Kit's path through the floor web, facing left: [t, ...rig]. She crouches short of the low
 * bridge beam, reaches over it, plants her hands beyond it (BRIDGE) and hops her feet over; then
 * she dives over the next beam into a handstand between two (HAND_PLANT), and turns round in it.
 * Every key was checked against BEAMS at 1/50 s with her outline and their glow: nothing she
 * does crosses a beam. The angles carry whole turns (TAU) where a limb goes all the way round in
 * the dive and the cartwheel, so every move takes the short way from key to key.
 */
const GRID_KEYS: readonly Key[] = [
  [38, 341, 257, 2.62, 0.35, 6.536, 6.564, 6.355, 6.384, 7.735, 6.231, 7.534, 5.644],
  [38.8, 334, 253, 1.651, 0.45, 7.985, 7.957, 7.876, 7.848, 7.123, 5.881, 6.775, 5.497],
  [BRIDGE, 317, 255, 1.571, 0.6, 7.15, 6.378, 7.058, 6.664, 5.265, 5.688, 5.386, 5.414],
  [39.75, 313, 247, 1.071, 0.3, 6.528, 6.5, 6.625, 6.597, 5.883, 4.683, 5.683, 4.583],
  [39.98, 309, 241, 0.675, 0.2, 6.423, 6.394, 6.509, 6.48, 7.183, 5.683, 7.283, 5.783],
  [40.35, 308, 258, 1.816, 0.5, 5.439, 6.657, 5.539, 6.819, 7.767, 5.863, 7.708, 5.738],
  [40.9, 309, 257, 2.62, 0.3, 6.373, 6.401, 6.238, 6.266, 7.71, 6.056, 7.655, 5.88],
  [41.55, 306.5, 258.5, 2.747, 0.35, 4.373, 5.898, 4.592, 6.243, 7.764, 5.73, 7.641, 5.531],
  [41.8, 302, 252, 2.182, 0.1, 3.752, 7.848, 4.174, 7.869, 6.797, 5.7, 6.68, 5.613],
  [41.93, 296, 248.5, 1.944, 0, 3.433, 8.112, 3.783, 7.98, 5.833, 4.383, 5.683, 4.183],
  [42.05, 291, 244, 1.138, -0.8, 6, 7.463, 5.818, 7.222, 4.383, 4.183, 4.583, 3.883],
  [HAND_PLANT, 275.5, 239, 0, -0.35, 6.239, 6.267, 6.33, 6.358, 2.41, 2.382, 3.904, 3.876],
];
/** A rig seen from the other side: the same pose, facing the other way. */
const mirror = (r: Rig): Rig => [r[0], r[1], ...r.slice(2).map((a) => -a)];
/**
 * Crouched just past the left-hand hurdle, facing back toward it, her chin over its lens: the
 * pose she holds, not breathing, while the bead of sweat falls.
 */
const HOLD: Key = [43.5, 245, 259, UP - 0.75, 0.75, 0.25, 0, 0.1, -0.1, 1.6, -0.2, 1.3, -0.4];
/** Her chin, where the bead leaves her, in gallery coordinates: just short of the lens. */
const CHIN = { x: 257.8, y: 248.4 } as const;
/**
 * After she turns round in the handstand (the last of GRID_KEYS), facing right: her legs come
 * down beyond the last beam, her arms sweep up and back, and she sinks into HOLD.
 */
const LANDING: readonly Key[] = [
  [42.78, 268.5, 244, 0.644, -0.6, -6.414, -6.021, -6.53, -6.124, -1.816, -1.788, -2.294, -2.265],
  [42.92, 262, 247, 1.571, -0.4, -6.083, -3.483, -6.183, -3.683, -1.96, -0.254, -2.609, -0.732],
  [43.08, 255, 251, 2.575, -0.1, -3.383, -3.283, -3.583, -3.433, -0.596, 0.091, -2.104, 0.533],
  [43.28, 249, 255, 2.467, 0.2, -0.5, -0.3, -0.6, -0.4, 0.911, -0.738, 0.738, -0.911],
];
const FLIP = GRID_KEYS[GRID_KEYS.length - 1][0];
/** Kit in the floor web, and which way she faces: left, until the cartwheel turns her round. */
function gridRig(t: number): { r: Rig; face: 1 | -1 } {
  if (t < FLIP) return { r: keyed(t, GRID_KEYS), face: -1 };
  const turned: Key = [FLIP, ...mirror(GRID_KEYS[GRID_KEYS.length - 1].slice(1))];
  return { r: keyed(t, [turned, ...LANDING, HOLD]), face: 1 };
}

function gridShot(ctx: Ctx, t: number, seconds: number) {
  // Wide enough to show the low beams she threads and the two crossing over her head.
  const v = keyed(t, [
    [38, 330, 236, 2.8],
    [BRIDGE, 316, 236, 2.8],
    [40.9, 304, 236, 2.8],
    [41.6, 300, 236, 2.8],
    [HAND_PLANT, 280, 236, 2.8],
    [43.5, 262, 236, 2.8],
  ]);
  cam(
    ctx,
    view(v),
    () =>
      galleryNight(ctx, t, seconds, () => {
        const { r, face } = gridRig(t);
        kit(ctx, r, { face });
      }),
    { w: GW, h: GH },
  );
  vignette(ctx, 0.5, '#05080C');
}

function heldShot(ctx: Ctx, t: number) {
  const z = lerp(1, 1.06, span(t, 43.5, 45.5));
  cam(ctx, { x: 160, y: 90, zoom: z }, () => {
    box(ctx, 0, 0, W, H, '#0A0C12');
    glow(ctx, 260, 140, 160, BEAM, 0.35);
    // Beams behind her, one passing a hair from her cheek.
    for (const [x1, y1, x2, y2] of [
      [214, 0, 252, 180],
      [0, 120, 120, 30],
    ])
      faded(ctx, 0.85, () => {
        line(ctx, alpha(BEAM, 0.18), 9, [x1, y1, x2, y2]);
        line(ctx, alpha(BEAM, 0.95), 3, [x1, y1, x2, y2]);
        line(ctx, alpha('#FFC2B4', 0.7), 1, [x1, y1, x2, y2]);
      });
    portrait(ctx, 'kit', 150, 92, 1.75, {
      eyes: 'open',
      look: [1, 0.6],
      brows: -0.6,
      mouth: 'tight',
      turn: 0.45,
      key: BEAM,
      keyX: 30,
      keyY: 18,
      keyAmount: 0.55,
      lamp: 0.5,
    });
    // A bead of sweat gathering at her temple.
    const bead = span(t, 44.2, 45.5);
    if (bead > 0) disc(ctx, 182, 70 + bead * 8, 1.4 + bead, alpha('#E8F4FF', 0.85));
  });
  vignette(ctx, 0.45, '#05080C');
}

/** The bead of sweat falls past the hurdle's lens and misses it by a pixel. */
function sweatShot(ctx: Ctx, t: number, seconds: number) {
  cam(
    ctx,
    { x: 268, y: 256.5, zoom: 7.5 },
    () =>
      galleryNight(
        ctx,
        t,
        seconds,
        () => {
          kit(ctx, keyed(t, [HOLD]), { face: 1, lamp: 0.7, coil: false, rim: 0.7 });
          // The bead gathers at her chin, falls, and passes the lens a pixel away.
          const grow = span(t, 45.5, DRIP_FALL);
          const fall = easeIn(span(t, DRIP_FALL, DRIP_LAND));
          if (t < DRIP_LAND) {
            const by = lerp(CHIN.y, FLOOR - 0.5, fall);
            const r = 0.3 + grow * 0.25;
            oval(ctx, CHIN.x, by, r, r * (1 + fall * 0.3), alpha('#DDEEFF', 0.95));
            disc(ctx, CHIN.x - r * 0.35, by - r * 0.35, r * 0.3, '#FFFFFF');
            // Through the beam's soft halo, a pixel short of its core: it blushes red, and on.
            const near = 1 - Math.min(1, Math.abs(by - BEAMS[4][1]) / 3);
            glow(ctx, CHIN.x, by, 2.4, BEAM, 0.2 * fall + 0.5 * near);
          } else {
            const k = span(t, DRIP_LAND, DRIP_LAND + 0.3);
            oval(ctx, CHIN.x, FLOOR + 0.2, 0.5 + k, 0.2, alpha('#C8DCF0', 0.85 - k * 0.4));
            disc(
              ctx,
              CHIN.x - 0.6 - k,
              FLOOR - 0.4 - Math.sin(k * Math.PI),
              0.15,
              alpha('#DDEEFF', 1 - k),
            );
            disc(
              ctx,
              CHIN.x + 0.6 + k,
              FLOOR - 0.4 - Math.sin(k * Math.PI) * 1.2,
              0.15,
              alpha('#DDEEFF', 1 - k),
            );
          }
        },
        0.6,
      ),
    { w: GW, h: GH },
  );
  vignette(ctx, 0.5, '#05080C');
}

/**
 * Kit at the gem: she holds still in her crouch while the camera pushes in past her to the gem,
 * then (out of frame) rises, turns from the lens, looks at the gem, and walks on.
 */
const RISE: Key = [48.9, 246, 255, UP - 0.1, 0, 0.15, 0.05, -0.15, -0.05, 0.6, -0.5, -0.4, -0.3];
function gemRig(t: number): { r: Rig; face: 1 | -1 } {
  if (t < RISE[0]) return { r: keyed(t, [[48.4, ...HOLD.slice(1)], RISE]), face: 1 };
  if (t < 49.7)
    return {
      r: keyed(t, [RISE, [49.7, 232, 251, UP - 0.05, 0.1, 0.12, 0.05, -0.1, 0, 0.05, 0, -0.05, 0]]),
      face: -1,
    };
  if (t < PAST) return { r: standAt(232, t > GLANCE ? 0.35 : 0.1), face: -1 };
  const k = span(t, PAST, 53.5);
  return { r: strideRig(lerp(232, 150, k), FLOOR - 17, (t - PAST) * 7.5), face: -1 };
}
function gemKit(ctx: Ctx, t: number) {
  const { r, face } = gemRig(t);
  kit(ctx, r, { face });
}
function gemShot(ctx: Ctx, t: number, seconds: number) {
  // The prize alone in its cage: framed tight enough that Kit, crouched at the hurdle just
  // below and to the right, stays out of the shot until we cut to her face.
  const v = keyed(t, [
    [47, GEM_AT.x, GEM_AT.y + 2, 2.9],
    [GEM - 0.2, GEM_AT.x, GEM_AT.y, 5],
    [50.4, GEM_AT.x + 2, GEM_AT.y, 5.3],
  ]);
  cam(ctx, view(v), () => galleryNight(ctx, t, seconds, () => gemKit(ctx, t)), { w: GW, h: GH });
  vignette(ctx, 0.5, '#05080C');
}
function glanceShot(ctx: Ctx, t: number, seconds: number) {
  const z = lerp(1, 1.05, span(t, 50.4, 51.5));
  cam(ctx, { x: 160, y: 90, zoom: z }, () => {
    box(ctx, 0, 0, W, H, '#080B12');
    glow(ctx, 40, 60, 150, BLUE, 0.45);
    // The gem at the edge of frame, enormous and blue.
    gem(ctx, 30, 70, 30, seconds);
    portrait(ctx, 'kit', 196, 98, 1.7, {
      eyes: kitBlink(seconds),
      look: t < GLANCE + 0.15 ? [0.3, 0] : [-1, -0.3],
      brows: t < GLANCE + 0.15 ? -0.3 : 0,
      mouth: 'flat',
      turn: -0.3,
      key: BLUE,
      keyX: -30,
      keyY: -10,
      keyAmount: 0.55,
      lamp: 0.6,
    });
  });
  vignette(ctx, 0.45, '#05080C');
}
function pastShot(ctx: Ctx, t: number, seconds: number) {
  cam(
    ctx,
    { x: lerp(196, 186, span(t, PAST, 53)), y: 226, zoom: 2.2 },
    () => galleryNight(ctx, t, seconds, () => gemKit(ctx, t)),
    { w: GW, h: GH },
  );
  vignette(ctx, 0.5, '#05080C');
}

// ——— The alcove ———
const KNEEL: Key = [58.4, 92, 259, UP - 0.25, 0.2, 1.0, 0.6, 1.2, 0.8, 1.5, 0, -0.1, -1.55];
function alcoveRig(t: number): Rig {
  if (t < 54.5) {
    const k = span(t, 53, 54.5);
    return strideRig(lerp(150, 96, k), FLOOR - 17, (t - 53) * 7.5);
  }
  // Kneeling by the case.
  return keyed(t, [[57.5, 96, 251, UP, 0.1, 0.1, 0, -0.1, 0, 0.05, 0, -0.05, 0], KNEEL]);
}
function alcoveShot(ctx: Ctx, t: number, seconds: number) {
  cam(
    ctx,
    { x: lerp(104, 90, span(t, 53, 54.5)), y: 222, zoom: 2.1 },
    () => galleryNight(ctx, t, seconds, () => kit(ctx, alcoveRig(t), { face: -1 })),
    { w: GW, h: GH },
  );
  vignette(ctx, 0.5, '#05080C');
}
function kneelShot(ctx: Ctx, t: number, seconds: number) {
  cam(
    ctx,
    { x: 84, y: 236, zoom: 3.3 },
    () =>
      galleryNight(ctx, t, seconds, () => {
        kit(ctx, alcoveRig(t), { face: -1 });
        glow(ctx, CASE.x, CASE.top + 6, 14, RED, 0.25);
      }),
    { w: GW, h: GH },
  );
  vignette(ctx, 0.5, '#05080C');
}

type CaseO = {
  label?: boolean;
  wren?: number;
  lift?: number;
  glint?: number;
  T?: Tone;
  day?: boolean;
};
/** The case close up, front on: velvet cushion, dust, glass, lid. */
function caseClose(ctx: Ctx, o: CaseO = {}) {
  const T = o.T ?? keep;
  const day = o.day ?? false;
  // The back of the alcove.
  box(ctx, 0, 0, W, H, T(day ? '#E0D2B2' : '#0E121A'));
  // The wooden base and the plinth.
  box(ctx, 30, 128, 260, 14, T(day ? '#7A5434' : '#3A2A20'));
  box(ctx, 44, 142, 232, 60, T(day ? '#C8BEA8' : '#262D3E'));
  box(ctx, 44, 142, 10, 60, T(day ? '#DDD4C2' : '#303850'));
  if (o.label) {
    box(ctx, 96, 150, 128, 22, T(mix(BRASS, '#5A4418', 0.2)));
    box(ctx, 98, 152, 124, 18, T(BRASS));
    box(ctx, 98, 152, 124, 2, T('#E8CC80'));
    write(ctx, 'MISSING SINCE 1975', 160.5, 165.5, { size: 10, color: T('#6A4E18') });
    write(ctx, 'MISSING SINCE 1975', 160, 165, { size: 10, color: T('#3A2A0A') });
  }
  // The velvet cushion, furred with fifty years of dust.
  oval(ctx, 160, 116, 92, 16, T(VELVET));
  oval(ctx, 160, 110, 88, 12, T(mix(VELVET, '#000000', 0.1)));
  oval(ctx, 160, 108, 84, 10, T(day ? mix(VELVET, '#FFFFFF', 0.08) : mix(VELVET, DUST, 0.55)));
  const w = o.wren ?? 0;
  if (!day) {
    // Specks of dust everywhere but where the bird stood.
    const speck = T(mix(DUST, '#FFFFFF', 0.3));
    for (let i = 0; i < 70; i++) {
      const x = 82 + rand(i * 2.3) * 156,
        y = 100 + rand(i * 4.1) * 15;
      if (!inWren((x - 160) / 30, (y - 98) / 30)) box(ctx, x, y, 1, 1, speck);
    }
    // The absence: a clean velvet footprint, and the bird's outline in the dust that settled
    // round it, with nothing inside. The gold wren fills it exactly when it goes home.
    oval(ctx, 160, 112.5, 8, 2.2, T(mix(VELVET, '#000000', 0.3)));
    if (w < 1) {
      const ghost = T(mix(DUST, '#FFFFFF', 0.45));
      for (let i = 0; i < WREN_EDGE.length; i += 2) {
        if (rand(i * 1.7 + 11) < 0.12) continue;
        const jx = (rand(i * 3.1 + 5) - 0.5) * 0.8,
          jy = (rand(i * 4.3 + 7) - 0.5) * 0.8;
        box(ctx, 160 + WREN_EDGE[i] * 30 + jx, 98 + WREN_EDGE[i + 1] * 30 + jy, 1, 1, ghost);
      }
    }
  }
  if (w > 0) wren(ctx, 160, 98 - (1 - w) * 40, 30, { T, glint: o.glint ?? 0 });
  // Glass walls and the lid.
  ctx.save();
  ctx.fillStyle = alpha(T(day ? '#FFFFFF' : '#6A82A8'), day ? 0.1 : 0.12);
  ctx.fillRect(30, 30, 260, 98);
  ctx.restore();
  box(ctx, 30, 30, 3, 98, T(day ? '#C8B890' : '#5C6A80'));
  box(ctx, 287, 30, 3, 98, T(day ? '#C8B890' : '#5C6A80'));
  const lift = (o.lift ?? 0) * 26;
  box(ctx, 30, 28 - lift, 260, 3, T(day ? '#D8C8A0' : '#8A9AB0'));
  line(ctx, alpha('#FFFFFF', day ? 0.28 : 0.16), 8, [70, 124, 120, 36]);
  line(ctx, alpha('#FFFFFF', day ? 0.2 : 0.1), 4, [96, 124, 140, 46]);
}

function labelShot(ctx: Ctx, t: number) {
  const v = keyed(t, [
    [54.5, 160, 150, 1.25],
    [57.5, 160, 112, 1.45],
  ]);
  cam(ctx, view(v), () => {
    caseClose(ctx, { label: true });
    // Moonlight on the cushion, and her red lamp grazing the glass.
    poly(ctx, alpha(SHAFT, 0.12), [120, 20, 170, 20, 240, 140, 190, 140]);
    glow(ctx, lerp(90, 210, span(t, 54.5, 57.5)), 100, 60, RED, 0.18);
  });
  vignette(ctx, 0.5, '#05080C');
}

function lockShot(ctx: Ctx, t: number) {
  const lift = easeOut(span(t, LID_CREAK, LID_CREAK + 1));
  const up = lift * 26;
  // Close on the lock, the cushion below out of frame until the lid lifts.
  cam(ctx, { x: 160, y: lerp(39, 70, lift), zoom: lerp(2.3, 1.5, lift) }, () => {
    caseClose(ctx, { lift });
    // The little lock on the lid's edge: a keyhole, and a slot along its top where three pins
    // drop, one at each pick, and stay down.
    box(ctx, 149, 25 - up, 22, 13, BRASS);
    box(ctx, 149, 25 - up, 22, 1, '#E8CC80');
    box(ctx, 151.5, 27 - up, 17, 4.5, '#2A1A0A');
    PICKS.forEach((p, i) => {
      const set = easeOut(span(t, p - 0.02, p + 0.1));
      box(ctx, 153 + i * 5, 27 - up + set * 2.5, 3, 2, set >= 1 ? '#F0D890' : BRASS);
    });
    box(ctx, 159, 33 - up, 2, 4, '#2A1A0A');
    // Her gloves and two picks. At each pin the rake turns a few degrees about the keyhole.
    const turn = PICKS.reduce((a, p) => a + hump(t, p - 0.1, p + 0.25), 0);
    const done = t > LID_CREAK - 0.3 ? ease(span(t, LID_CREAK - 0.3, LID_CREAK)) : 0;
    const px = 159.5,
      py = 35 - up;
    const a = -0.24 * turn;
    const vx = -25 - done * 40,
      vy = 15;
    const gx = px + vx * Math.cos(a) - vy * Math.sin(a),
      gy = py + vx * Math.sin(a) + vy * Math.cos(a);
    hand(
      ctx,
      gx - 14 * Math.cos(a) - 4 * Math.sin(a),
      gy + 4 * Math.cos(a) - 14 * Math.sin(a),
      1.1,
      0.35 + a,
      {
        kind: 'kit',
        curl: 0.65,
        sleeve: BLACK,
      },
    );
    line(ctx, '#C8CCD4', 1.2, [gx, gy, px, py, px + 2 * Math.cos(a), py + 2 * Math.sin(a) - 1]);
    hand(ctx, 214 + done * 40, 54, 1.1, Math.PI - 0.35, {
      kind: 'kit',
      curl: 0.65,
      sleeve: BLACK,
      palm: true,
    });
    line(ctx, '#C8CCD4', 1.2, [200 + done * 40, 48, 161, 36 - up]);
    for (const p of PICKS) {
      const k = hump(t, p, p + 0.3);
      if (k > 0) glow(ctx, px, py - 1, 6, '#FFFFFF', 0.35 * k);
    }
    glow(ctx, 160, 30, 40, RED, 0.2);
  });
  vignette(ctx, 0.5, '#05080C');
}

type DogFaceO = {
  eye?: number;
  ear?: number;
  scrunch?: number;
  mouth?: number;
  look?: readonly [number, number];
  T?: Tone;
  facing?: 1 | -1;
  tilt?: number;
};
/** The dog's face, close: old, shaggy, one floppy ear, a big black nose. */
function dogFace(ctx: Ctx, x: number, y: number, s: number, o: DogFaceO = {}) {
  const T = o.T ?? keep;
  const fur = T(DOG),
    white = T(DOG_W),
    dark = T(DOG_D),
    ink = T('#161012');
  const sc = o.scrunch ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (o.facing ?? 1), s);
  ctx.rotate(o.tilt ?? 0);
  // The far ear and the head.
  oval(ctx, -16, -2, 8, 18, dark, 0.3);
  oval(ctx, 0, 0, 24, 21, fur);
  // Shaggy: soft tufts round the crown and cheek.
  for (let i = 0; i < 6; i++) {
    const a = -2.7 + i * 0.42;
    oval(ctx, Math.cos(a) * 21, Math.sin(a) * 18, 7, 4.5, fur, a);
  }
  oval(ctx, -6, 16, 9, 6, fur, 0.4);
  oval(ctx, -14, 10, 6, 7, fur, 0.2);
  // White blaze and muzzle.
  poly(ctx, white, [-3, -20, 4, -20, 8, 0, 4, 10, -6, 6]);
  oval(ctx, 14, 9, 17, 12 - sc * 1.5, white);
  for (let i = 0; i < 3; i++)
    line(ctx, alpha(T('#B8A898'), 0.6), 1, [8 + i * 5, 3 + sc * 2, 10 + i * 5, 1 + sc * 2]);
  // The nose, twitching.
  oval(ctx, 28, 4 - sc * 1.5, 6.5 + sc, 5 - sc * 0.5, ink);
  oval(ctx, 26.5, 2.4 - sc * 1.5, 2, 1.2, alpha('#FFFFFF', 0.3));
  const mouth = o.mouth ?? 0;
  if (mouth > 0) {
    poly(ctx, T('#4A1E20'), [10, 16, 28, 12, 26, 14 + mouth * 12, 14, 16 + mouth * 8]);
    oval(ctx, 20, 15 + mouth * 8, 5, 2.5 * mouth, T('#C8606A'));
  }
  line(ctx, ink, 1.6, [12, 15, 20, 17, 28, 12]);
  // The eye: shut, or open and shining.
  const eye = o.eye ?? 0;
  const [lx, ly] = o.look ?? [0, 0];
  if (eye > 0.05) {
    oval(ctx, 6, -6, 5, 4.4 * eye, ink);
    disc(ctx, 6 + lx * 1.2 - 1.2, -6.8 + ly, 1.3 * eye, '#FFFFFF');
    oval(ctx, 6, -6 - 4.4 * eye, 6, 1.5, fur);
  } else line(ctx, ink, 1.5, [1, -5 + sc, 6, -3.6 + sc, 11, -5 + sc]);
  line(ctx, dark, 2.4, [0, -12 - sc, 10, -13 - sc]);
  // The near ear: it lifts when it listens.
  const ear = o.ear ?? 0;
  oval(ctx, -12 + ear * 4, 4 - ear * 14, 9, 20 - ear * 6, dark, 0.35 - ear * 1.1);
  ctx.restore();
}

function dogEyeShot(ctx: Ctx, t: number) {
  const ear = Math.min(1, span(t, 63.5, 63.8) * 1.2) * (1 - span(t, EYE_SHUT - 0.3, EYE_SHUT));
  const eye = easeOut(span(t, EYE, EYE + 0.25)) * (1 - ease(span(t, EYE_SHUT - 0.35, EYE_SHUT)));
  const b = t >= EYE_SHUT ? breath(t, EYE_SHUT) : 0;
  cam(ctx, { x: 160, y: 90, zoom: 1 + b * 0.01 }, () => {
    box(ctx, 0, 0, W, H, '#0A0C10');
    glow(ctx, 260, -10, 170, LAMP_GREEN, 0.25);
    box(ctx, 0, 0, W, 30, '#1A140E');
    box(ctx, 0, 150, W, 30, '#12161E');
    dogFace(ctx, 168, 104 + b * 2, 2.6, { eye, ear, look: [-1, 0], facing: -1, tilt: 0.12 });
    oval(ctx, 300, 160, 70, 26, DOG);
  });
  vignette(ctx, 0.55, '#05080C');
}

/** Where the wren comes to rest in her palm, in the pouch shot. */
const IN_HAND = { x: 138, y: 114 } as const;
function pouchShot(ctx: Ctx, t: number) {
  const open = ease(span(t, POUCH_OPEN - 0.2, POUCH_OPEN + 0.4));
  const tip = ease(span(t, 66.75, IN_PALM));
  const k0 = ease(span(t, IN_PALM, 68.8));
  // Push in on the bird in her palm.
  cam(
    ctx,
    { x: lerp(160, IN_HAND.x + 8, k0), y: lerp(96, IN_HAND.y - 6, k0), zoom: lerp(1.15, 2.1, k0) },
    () => {
      box(ctx, 0, 0, W, H, '#0B0E14');
      // The open case's velvet below, catching the moon: the black gloves read against it.
      oval(ctx, 160, 196, 220, 80, '#3A1420');
      glow(ctx, 150, 120, 150, SHAFT, 0.28);
      glow(ctx, 190, 40, 90, RED, 0.18);
      // Her left glove, palm up, waits; her right holds the pouch by its neck and tips it.
      hand(ctx, 150, 124, 1.7, -0.02, { kind: 'kit', palm: true, curl: 0.18, sleeve: BLACK });
      const nx = 210,
        ny = 61;
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(-1.05 * tip);
      pouch(ctx, 0, 11, 2.2, { open, full: 1 - tip });
      ctx.restore();
      hand(ctx, 226, 52, 1.4, Math.PI - 0.5, { kind: 'kit', curl: 0.7, sleeve: BLACK });
      // Out of the pouch's mouth, and down into her palm.
      if (tip > 0.3) {
        const k = ease(span(t, 66.88, IN_PALM + 0.12));
        const x = lerp(nx - 10, IN_HAND.x, k),
          y = lerp(ny + 2, IN_HAND.y, k) - Math.sin(k * Math.PI) * 10;
        wren(ctx, x, y, lerp(6, 14, k), { glint: hump(t, IN_PALM, IN_PALM + 1.2) * 0.8 });
      }
    },
  );
  vignette(ctx, 0.5, '#05080C');
}

function setShot(ctx: Ctx, t: number) {
  // Lowered into its outline in the dust, it fits exactly on WREN_SET.
  const down = ease(span(t, 68.85, WREN_SET));
  const away = ease(span(t, WREN_SET + 0.3, 70.6));
  const rest = ease(span(t, 71.0, 71.6));
  const shaft = ease(span(t, 69.7, GLINT));
  const glint = hump(t, GLINT - 0.1, GLINT + 1.4);
  cam(ctx, { x: 160, y: 86, zoom: lerp(1.25, 1.35, span(t, 68.8, 73)) }, () => {
    caseClose(ctx, { wren: 0.4 + down * 0.6, lift: 1, glint });
    // A sliver of moonlight finds it.
    poly(ctx, alpha(SHAFT, 0.18 * shaft), [140, 0, 156, 0, 182, 120, 166, 120]);
    // Her glove lowering it, letting go; then resting on the case's edge.
    // Her glove lowers it by its back, lets go, and lifts away; then rests on the case's edge.
    const wy = 98 - (1 - (0.4 + down * 0.6)) * 40;
    if (away < 1)
      hand(ctx, 196 + away * 70, wy - 34 - away * 40, 1.25, Math.PI * 0.72, {
        kind: 'kit',
        curl: lerp(0.55, 0.2, away),
        sleeve: BLACK,
      });
    if (rest > 0)
      hand(ctx, lerp(330, 286, rest), 134, 1.15, Math.PI + 0.05, {
        kind: 'kit',
        curl: 0.35,
        sleeve: BLACK,
      });
  });
  vignette(ctx, 0.5, '#05080C');
}

/** Where her red headlamp's spot falls as she turns: from the case to the dog's nose. */
function lampSpot(t: number) {
  const k = ease(span(t, 74.0, 75.0));
  return { x: lerp(90, DOG_BED - 20, k), y: lerp(236, 262, k) };
}
function turnShot(ctx: Ctx, t: number, seconds: number) {
  cam(
    ctx,
    { x: 240, y: 168, zoom: 0.68 },
    () =>
      galleryNight(ctx, t, seconds, () => {
        sleepers(ctx, t);
        const turn = ease(span(t, 73.7, 74.5));
        const rig = keyed(t, [
          [73.0, ...KNEEL.slice(1)],
          [74.2, 92, 251, UP, 0.1, 0.1, 0, -0.1, 0, 0.05, 0, -0.05, 0],
        ]);
        const o: RigO = { face: turn > 0.5 ? 1 : -1 };
        kit(ctx, rig, o);
        if (t > 74.0) {
          // Her headlamp's faint red beam across the room, and the spot it lands on the dog.
          const { x, y } = lampSpot(t);
          const head = joints(rig).head;
          const [hx, hy] = rigPoint(rig, o, head[0], head[1] - 2);
          const a = Math.atan2(y - hy, x - hx);
          const [nx, ny] = [-Math.sin(a) * 7, Math.cos(a) * 7];
          poly(ctx, alpha(RED, 0.12), [hx, hy, x + nx, y + ny, x - nx, y - ny]);
          glow(ctx, x, y, 14, RED, 0.7);
          disc(ctx, x, y, 2.5, RED);
        }
      }),
    { w: GW, h: GH },
  );
  vignette(ctx, 0.5, '#05080C');
}

function noseShot(ctx: Ctx, t: number) {
  // The dot slides onto the nose and sits there; the nose twitches; the head tips back as the
  // sneeze builds (its sound starts at 76.8), then snaps forward on SNEEZE and the dot jumps off.
  const k = span(t, 75.0, 76.3);
  const twitch =
    t > 76.0 && t < 76.8 ? Math.max(0, Math.sin((t - 76) * 22)) * span(t, 76, 76.6) : 0;
  const build = ease(span(t, 76.8, SNEEZE));
  const burst = easeOut(span(t, SNEEZE, SNEEZE + 0.12));
  const back = build * (1 - burst);
  const forward = burst * (1 - ease(span(t, SNEEZE + 0.15, 77.9)) * 0.5);
  const tilt = -0.08 - back * 0.25 + forward * 0.15;
  const hx = 120 + forward * 8,
    hy = 96 - back * 3 + forward * 4;
  cam(ctx, { x: 160, y: 90, zoom: 1 + build * 0.04 * (1 - burst) }, () => {
    box(ctx, 0, 0, W, H, '#0A0C10');
    glow(ctx, 230, -20, 160, LAMP_GREEN, 0.2);
    dogFace(ctx, hx, hy, 3.2, {
      eye: 0,
      ear: back * 0.7,
      scrunch: twitch * 0.5 + back * 1.6 + forward * 0.5,
      facing: 1,
      tilt,
    });
    // A soft puff of dust off the floor in front of the nose: no brighter than the room.
    const puff = span(t, SNEEZE, SNEEZE + 0.5);
    if (puff > 0 && puff < 1) {
      const nx = hx + 3.2 * (28 * Math.cos(tilt) - 4 * Math.sin(tilt)),
        ny = hy + 3.2 * (28 * Math.sin(tilt) + 4 * Math.cos(tilt));
      for (let i = 0; i < 3; i++)
        glow(
          ctx,
          nx + 14 + puff * (18 + i * 10),
          ny + (i - 1) * (4 + puff * 8),
          8 + puff * (12 + i * 3),
          '#C8C0B0',
          0.35 * (1 - puff),
        );
    }
    // The red dot: slides across the nose, sits on it, and jumps away at the sneeze.
    const off = easeIn(span(t, SNEEZE + 0.04, SNEEZE + 0.3));
    const dx = lerp(150, 208, ease(k)) + off * 140,
      dy = lerp(98, 99, k) - off * 30;
    if (dx < W + 20) {
      glow(ctx, dx, dy, 22, RED, 0.55);
      disc(ctx, dx, dy, 3, alpha(RED, 0.95));
    }
  });
  vignette(ctx, 0.55, '#05080C');
}

function sneezeShot(ctx: Ctx, t: number, seconds: number) {
  const jerk = hump(t, SNEEZE, SNEEZE + 0.35);
  // The bark: head right up, mouth wide, held for half a second.
  const bark = ease(span(t, BARK - 0.12, BARK)) * (1 - ease(span(t, BARK + 0.45, BARK + 0.6)));
  const jolt = easeOut(span(t, WAKE, WAKE + 0.25)) - span(t, WAKE + 0.4, WAKE + 1) * 0.6;
  cam(
    ctx,
    { x: 408, y: 248, zoom: 3.3 },
    () =>
      galleryNight(ctx, t, seconds, () => {
        sleepers(ctx, t, {
          jolt: Math.max(0, jolt),
          awake: t >= WAKE,
          dogHead: t > BARK - 0.3 ? 1 + bark * 0.6 : 0.4 + jerk * 0.5,
          dogEyes: t > SNEEZE + 0.2 ? 'open' : 'closed',
          dogMouth: bark,
          dogJerk: jerk,
          ear: t > SNEEZE ? 0.6 : 0,
        });
        // A puff of dust from the sneeze.
        const puff = span(t, SNEEZE, SNEEZE + 0.8);
        if (puff > 0 && puff < 1)
          glow(
            ctx,
            DOG_BED - 20 - puff * 8,
            262 - puff * 3,
            4 + puff * 6,
            '#C8C0B0',
            0.3 * (1 - puff),
          );
      }),
    { w: GW, h: GH },
  );
  vignette(ctx, 0.5, '#05080C');
}

/** Walt, close: asleep under his cap, then wide awake. */
function wakeShot(ctx: Ctx, t: number, seconds: number) {
  const up = easeOut(span(t, WAKE, WAKE + 0.2));
  const settle = span(t, WAKE + 0.2, 80);
  cam(ctx, { x: 160, y: 90 - up * 4 + settle * 3, zoom: 1.05 }, () => {
    box(ctx, 0, 0, W, H, '#0E121A');
    glow(ctx, 40, 150, 170, LAMP_GREEN, 0.3);
    glow(ctx, 280, 30, 120, SHAFT, 0.12);
    portrait(ctx, 'walt', 168, 104 - up * 6, 1.55, {
      eyes: up > 0.2 ? 'wide' : 'closed',
      look: [-0.6, 0],
      brows: up > 0.2 ? 0.6 : 0,
      raise: up,
      mouth: up > 0.2 ? 'o' : 'open',
      tilt: lerp(-0.12, 0.04, up),
      capY: lerp(7, -3, up),
      key: LAMP_GREEN,
      keyX: -30,
      keyY: 20,
      keyAmount: 0.25,
    });
  });
  vignette(ctx, 0.5, '#05080C');
  void seconds;
}

/** The torch: Walt stands, clicks it on, and sweeps the gallery, walking slowly in. */
function waltWalk(t: number) {
  const k = span(t, WALT_STEPS[0] - 0.2, WALT_STEPS[WALT_STEPS.length - 1] + 0.5);
  const walking = t > WALT_STEPS[0] - 0.2 && t < 86.4;
  return { x: lerp(CHAIR - 2, 372, k), step: walking ? (t - 80.8) * (Math.PI / 0.7) : undefined };
}
/** Radians below straight left. */
function torchAngle(t: number) {
  return keyed(t, [
    [TORCH, 0.55],
    [82.5, 0.3],
    [84.5, 0.05],
    [86.0, 0.18],
    [87.0, 0.12],
  ])[0];
}
function cone(
  ctx: Ctx,
  x: number,
  y: number,
  a: number,
  spread: number,
  len: number,
  amount: number,
) {
  if (amount <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, len);
  g.addColorStop(0, alpha('#FFF4D0', 0.42 * amount));
  g.addColorStop(0.6, alpha('#FFE8B0', 0.16 * amount));
  g.addColorStop(1, alpha('#FFE8B0', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a - spread) * len, y + Math.sin(a - spread) * len);
  ctx.lineTo(x + Math.cos(a + spread) * len, y + Math.sin(a + spread) * len);
  ctx.closePath();
  ctx.fill();
}
function torchShot(ctx: Ctx, t: number, seconds: number) {
  const { x, step } = waltWalk(t);
  const stand = ease(span(t, 79.8, 80.4));
  const on = easeOut(span(t, TORCH, TORCH + 0.3));
  const a = Math.PI - torchAngle(t);
  const dogOut = span(t, 84.0, 87.0);
  cam(
    ctx,
    { x: 312, y: 214, zoom: 1.06 },
    () => {
      room(ctx, t, seconds, 0);
      beams(ctx, 1, seconds);
      // Kit, flat against the far side of the pedestal.
      kit(ctx, [176, 259, UP - 0.25, 0.3, 1.6, 2.4, 1.2, 2.2, 1.9, -0.4, 1.7, -0.6], {
        face: 1,
        lamp: 0.25,
        rim: 0.5,
      });
      // The dog sets off along the front of the floor.
      if (dogOut > 0)
        dog(ctx, lerp(DOG_BED + 6, 236, dogOut), 290, 1, {
          step: t * 9,
          tail: t * 6,
          facing: -1,
          head: -0.3,
        });
      else dog(ctx, DOG_BED, 268, 1, { lie: 1, facing: -1, eyes: 'open', head: 0.6, ear: 0.5 });
      const wx = stand < 1 ? CHAIR : x;
      chair(ctx);
      waltFig(ctx, wx, stand < 0.5 ? SEAT : FLOOR, {
        facing: -1,
        seated: stand < 0.5,
        step,
        eyes: 'open',
        mouth: 'flat',
        arms: [0.2, 1.5 + torchAngle(t) * 0.5],
      });
      // The cone, from his hand into the room; the pedestal throws Kit's side into shadow.
      const hx = wx - 10,
        hy = 249;
      box(ctx, hx - 3, hy - 1.5, 5, 3, '#2A2A2E');
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, GW, GH);
      const cx1 = PED.x - PED.half - 2,
        cy1 = PED.top - 4;
      const far = 400;
      const ang1 = Math.atan2(cy1 - hy, cx1 - hx);
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx1 + Math.cos(ang1) * far, cy1 + Math.sin(ang1) * far);
      ctx.lineTo(cx1 - far, FLOOR + 40);
      ctx.lineTo(PED.x + PED.half, FLOOR + 40);
      ctx.lineTo(PED.x + PED.half, cy1);
      ctx.closePath();
      ctx.clip('evenodd');
      cone(ctx, hx, hy, a, 0.2, 300, on);
      ctx.restore();
      if (on > 0) glow(ctx, hx - 2, hy, 6, '#FFF4D0', 0.6 * on);
      shafts(ctx, seconds, 0, 0.8);
    },
    { w: GW, h: GH },
  );
  vignette(ctx, 0.5, '#05080C');
}

function nosesShot(ctx: Ctx, t: number, seconds: number) {
  const inn = easeOut(span(t, 87.0, NOSE));
  const sniff = t > NOSE && t < BISCUIT ? Math.max(0, Math.sin((t - NOSE) * 14)) * 0.3 : 0;
  const offer = ease(span(t, BISCUIT - 0.4, BISCUIT + 0.3));
  const chomp = span(t, CRUNCH - 0.1, CRUNCH + 0.15);
  const wag =
    WAGS.reduce((a, w) => a + hump(t, w - 0.2, w + 0.2), 0) + (t > 90.6 && t < TROT ? 0.4 : 0);
  const turn = ease(span(t, WHISTLE, WHISTLE + 0.4));
  const away = easeIn(span(t, TROT, 94));
  const frozen = t > NOSE && t < 91;
  cam(ctx, { x: 160, y: 90, zoom: 1 }, () => {
    box(ctx, 0, 0, W, H, '#0A0D14');
    // The gallery beyond, the torch somewhere out there; the floor.
    glow(ctx, 300, 60, 150, '#FFF4D0', 0.14);
    line(ctx, alpha(BEAM, 0.5), 1.5, [200, 0, 250, 150]);
    box(ctx, 0, 150, W, 30, '#141924');
    // The pedestal's stone side, at her back.
    box(ctx, 0, 0, 58, H, '#262D3E');
    box(ctx, 52, 0, 6, H, '#323A50');
    // Kit, crouched with her back to the stone, her face turned to the dog.
    portrait(ctx, 'kit', 98, 94, 1.22, {
      eyes: frozen ? 'wide' : kitBlink(seconds),
      look: [1, 0.2],
      brows: frozen ? 0.6 : 0.2,
      raise: frozen ? 0.4 : 0,
      mouth: t > 91.2 ? 'soft' : 'tight',
      turn: 0.5,
      key: '#FFF4D0',
      keyX: 30,
      keyY: 0,
      keyAmount: 0.12,
      lamp: 0.2,
      coil: true,
    });
    // The dog: it comes round to her, nose to nose; eats; wags; turns at the whistle; goes.
    const dx = lerp(340, 172, inn) + away * 220 + sniff * 2,
      dy = 96 + chomp * 4;
    const tw = Math.sin(t * 26) * wag;
    oval(ctx, dx + 64, dy + 40, 46, 22, DOG);
    oval(ctx, dx + 56, dy + 50, 30, 10, DOG_W);
    line(ctx, DOG, 6, [dx + 104, dy + 32, dx + 116 + tw * 4, dy + 12, dx + 112 + tw * 10, dy - 6]);
    line(ctx, DOG_W, 4, [dx + 113 + tw * 9, dy - 2, dx + 112 + tw * 10, dy - 7]);
    dogFace(ctx, dx, dy, 1.5, {
      eye: 1,
      ear: turn * 0.8,
      mouth: hump(t, CRUNCH - 0.15, CRUNCH + 0.3) * 0.5,
      look: turn > 0.5 ? [1, 0] : [-1, 0],
      facing: -1,
      tilt: turn * -0.25,
      scrunch: sniff,
    });
    // Her glove with the biscuit, out of her pocket and up to that nose.
    if (offer > 0 && chomp < 1) {
      const hx = lerp(96, 112, offer),
        hy = lerp(186, 128, offer);
      hand(ctx, hx, hy, 0.85, -0.25, { kind: 'kit', curl: 0.55, sleeve: BLACK });
      biscuit(ctx, hx + 20, hy - 2, 2, chomp);
    }
  });
  vignette(ctx, 0.5, '#05080C');
}

function ropeShot(ctx: Ctx, t: number, seconds: number) {
  const climb = ease(span(t, CLIMB, 97.0));
  const tail = easeIn(span(t, SWING_UP - 0.4, GONE));
  const swing = ease(span(t, SWING_UP, GONE));
  cam(
    ctx,
    { x: ROPE_X, y: 62, zoom: 1.55 },
    () => {
      room(ctx, t, seconds, 0);
      beams(ctx, 1, seconds);
      // The rope, and Kit going up it hand over hand.
      const ky = lerp(118, 6, climb);
      const end = lerp(ky + 22, -4, tail);
      if (end > 0)
        line(ctx, ROPE, 1.1, [ROPE_X, 0, ROPE_X + Math.sin(seconds * 4 + t) * 2 * tail, end]);
      if (climb < 1) {
        const ph = t * 9;
        kit(
          ctx,
          [
            ROPE_X - 2,
            ky,
            UP,
            0.1,
            UP - 0.1 + Math.sin(ph) * 0.3,
            UP,
            UP + 0.1 - Math.sin(ph) * 0.3,
            UP,
            0.9 + Math.sin(ph) * 0.4,
            -0.3,
            0.5 - Math.sin(ph) * 0.4,
            -0.5,
          ],
          { face: 1 },
        );
      }
      // The torch hunts low across the room, and swings up a moment too late.
      const hunt = Math.PI + 0.95 + Math.sin(t * 1.3) * 0.12;
      cone(ctx, 372, 250, lerp(hunt, Math.PI + 1.46, swing), 0.15, 320, 1);
      shafts(ctx, seconds, 0, 0.8);
    },
    { w: GW, h: GH },
  );
  vignette(ctx, 0.5, '#05080C');
}

function squintShot(ctx: Ctx, t: number) {
  cam(ctx, { x: 160, y: 90, zoom: lerp(1, 1.04, span(t, 98, 99)) }, () => {
    box(ctx, 0, 0, W, H, '#0B0E14');
    glow(ctx, 160, 200, 150, '#FFF4D0', 0.25);
    portrait(ctx, 'walt', 160, 100, 1.6, {
      eyes: 'squint',
      look: [0.3, -1],
      brows: -0.5,
      mouth: 'part',
      tilt: -0.12,
      key: '#FFF4D0',
      keyX: 0,
      keyY: 30,
      keyAmount: 0.4,
    });
  });
  vignette(ctx, 0.5, '#05080C');
}

// ——— The roofs ———
const ROOF_W = 640;
const RIDGE = 92;
const NEXT_ROOF = 110;
const GAP = [404, 458] as const;
const PIPE_X = 528;
/** The gallery's windows along the museum's side, in the order they light. */
const WINDOW_AT = [230, 290, 345, 392] as const;
function roofRig(t: number): Rig {
  if (t < LEAP) return strideRig(lerp(150, 396, span(t, 99, LEAP)), RIDGE - 17, (t - 99) * 11, 1);
  if (t < LAND) {
    // The leap, eased so it hangs at the top.
    const u = span(t, LEAP, LAND);
    const w = 0.5 + 4 * (u - 0.5) ** 3;
    const x = lerp(396, 470, w),
      y = lerp(RIDGE - 17, NEXT_ROOF - 12, w) - Math.sin(w * Math.PI) * 24;
    return [x, y, UP - 0.5, 0.3, 1.9, 2.4, 1.6, 2.2, 1.5 - w * 0.6, 0.2, -0.5 + w * 1.6, -0.3];
  }
  if (t < 103.8) {
    // The roll.
    const r = span(t, LAND, 103.8);
    return [
      lerp(470, 498, r),
      NEXT_ROOF - 9,
      UP - 0.6 - r * TAU,
      0.6,
      1.4,
      2.2,
      1.2,
      2.0,
      2.0,
      -0.6,
      1.8,
      -0.7,
    ];
  }
  if (t < 104.2)
    return strideRig(lerp(498, PIPE_X - 6, span(t, 103.8, 104.2)), NEXT_ROOF - 17, t * 11, 0.8);
  // Down the drainpipe.
  const d = ease(span(t, 104.2, 106));
  return [
    PIPE_X - 5,
    lerp(NEXT_ROOF - 14, 210, d),
    UP,
    0,
    UP - 0.3,
    UP - 0.1,
    UP - 0.1,
    UP,
    1.2,
    -0.3,
    0.8,
    -0.5,
  ];
}
function roofsShot(ctx: Ctx, t: number, seconds: number) {
  const r = roofRig(t);
  const cx = r[0] - 10;
  cam(
    ctx,
    { x: cx, y: 102, zoom: 1.4 },
    () => {
      vgrad(ctx, 0, 0, ROOF_W, H, ['#0A0F18', '#141C2A', '#2A3850', '#33445E']);
      starfield(ctx, seconds, { count: 30, seed: 17, bottom: 70 });
      // The moon rides with the camera (it is far away).
      const mx = cx + 80;
      glow(ctx, mx, 40, 60, SHAFT, 0.35);
      disc(ctx, mx, 40, 13, MOON);
      // Far town, a few windows still lit.
      for (let i = 0; i < 12; i++) {
        const top = 82 + rand(i * 3) * 20;
        box(ctx, i * 56, top, 50, 90, '#161E2C');
        if (rand(i * 5.1) > 0.4)
          box(ctx, i * 56 + 10 + rand(i * 7) * 28, top + 8, 3, 4, alpha(LAMP, 0.7));
      }
      // The museum: its long roof, the ridge she runs along, the skylight she came out of.
      poly(ctx, '#33405A', [0, RIDGE, GAP[0], RIDGE, GAP[0] + 4, 120, 0, 120]);
      for (const y of [99, 106, 113]) box(ctx, 0, y, GAP[0], 1, '#28324A');
      box(ctx, 0, RIDGE - 2, GAP[0], 3, '#4A5872');
      box(ctx, 0, RIDGE - 2, GAP[0], 1, '#9AAED0');
      box(ctx, 104, 100, 30, 8, '#2A3242');
      poly(ctx, alpha('#5A7090', 0.7), [106, 100, 132, 100, 128, 90, 110, 90]);
      line(ctx, ROPE, 0.8, [119, 100, 119, 92, 122, 96]);
      // Its side wall, where the gallery's windows light up one by one.
      box(ctx, 0, 120, GAP[0] + 4, 60, '#1C2434');
      box(ctx, 0, 119, GAP[0] + 4, 3, '#3A4458');
      WINDOWS.forEach((w, i) => {
        const wx = WINDOW_AT[i];
        const on = easeOut(span(t, w, w + 0.5));
        const c = mix('#0E141E', '#FFD88A', on);
        box(ctx, wx - 8, 134, 16, 26, c);
        disc(ctx, wx, 134, 8, c);
        box(ctx, wx - 0.5, 126, 1, 34, '#1C2434');
        if (on > 0) glow(ctx, wx, 146, 34, LAMP, 0.4 * on);
      });
      // The gap, and the next roof.
      vgrad(ctx, GAP[0] + 4, RIDGE + 6, GAP[1] - GAP[0] - 4, H, ['#0E1420', '#06080C']);
      glow(ctx, (GAP[0] + GAP[1]) / 2, H, 30, LAMP, 0.2);
      poly(ctx, '#33405A', [
        GAP[1],
        NEXT_ROOF,
        PIPE_X + 2,
        NEXT_ROOF,
        PIPE_X + 2,
        126,
        GAP[1] - 3,
        126,
      ]);
      box(ctx, GAP[1], NEXT_ROOF - 2, PIPE_X + 2 - GAP[1], 3, '#4A5872');
      box(ctx, GAP[1], NEXT_ROOF - 2, PIPE_X + 2 - GAP[1], 1, '#9AAED0');
      box(ctx, GAP[1] - 3, 126, PIPE_X + 5 - GAP[1], 54, '#1C2434');
      box(ctx, 478, NEXT_ROOF - 16, 8, 14, '#2A2226');
      box(ctx, 476, NEXT_ROOF - 18, 12, 3, '#3A3036');
      box(ctx, PIPE_X, NEXT_ROOF, 3, 70, '#3A4458');
      kit(ctx, r, { face: 1 });
    },
    { w: ROOF_W, h: H },
  );
  vignette(ctx, 0.5, '#05080C');
}

// ——— The getaway ———
function keyShot(ctx: Ctx, t: number, seconds: number) {
  const shake = COUGHS.reduce((a, c) => a + hump(t, c, c + 0.3) * Math.sin(seconds * 70) * 1.6, 0);
  const strain = COUGHS.some((c) => within(t, c, c + 0.5));
  cabin(ctx, {
    shake,
    abe: {
      eyes: strain ? 'closed' : 'down',
      look: [0.6, 1],
      brows: 0.8,
      mouth: 'tight',
      turn: 0.15,
    },
    kit: { eyes: 'wide', look: [1, 0], brows: 0.5, raise: 0.3, mouth: 'part', turn: 0.6, lamp: 0 },
    front: () => {
      const twist = COUGHS.reduce((a, c) => a + hump(t, c - 0.3, c + 0.2), 0);
      hand(ctx, 150, 146, 0.7, -1.3 + twist * 0.4, { kind: 'abe', curl: 0.7, sleeve: CARDIGAN });
    },
  });
}
function getawayShot(ctx: Ctx, t: number, seconds: number) {
  const door = ease(span(t, DOOR, DOOR + 0.6));
  const running = t >= CATCH;
  const go = Math.max(0, t - CATCH - 0.5);
  const x = 168 + (go < 1.5 ? go * go * 4 : 9 + (go - 1.5) * 26);
  const scratch = span(t, SCRATCH, SCRATCH + 1);
  const scratching = scratch > 0 && scratch < 1;
  cam(ctx, { x: 176, y: 104, zoom: 1.12 }, () => {
    street(ctx, seconds, door);
    if (door > 0.4) {
      const k = span(t, DOOR + 0.3, 109.6);
      waltFig(ctx, 160, lerp(136, 140, k), {
        facing: 1,
        step: k < 1 ? t * 8 : undefined,
        arms: scratching ? [0.2, 2.8 + Math.sin(t * 20) * 0.2] : [0.1, 1.3],
        mouth: 'o',
      });
      if (!scratching) cone(ctx, 172, 122, 0.55, 0.16, 140, 0.8);
    }
    const cough = COUGHS.reduce((a, c) => a + hump(t, c, c + 0.3), 0) + hump(t, CATCH, CATCH + 0.4);
    bubbleCar(ctx, x, 172, 1.35, {
      facing: 1,
      lights: running ? 1 : 0,
      shake: running ? Math.sin(seconds * 40) * 0.35 : cough * Math.sin(seconds * 60) * 0.9,
      puff: running ? 1 : cough,
      seconds,
    });
  });
  vignette(ctx, 0.5, '#05080C');
}

/** Close on Walt on the museum steps, the lit door behind him: torch lowered, he scratches his head. */
function scratchShot(ctx: Ctx, t: number) {
  const k = span(t, 111.6, 113);
  const up = ease(span(t, 111.62, SCRATCH));
  const rub = t > SCRATCH && t < 112.8 ? Math.sin((t - SCRATCH) * 26) * span(t, SCRATCH, 112.1) : 0;
  const T = toward('#2A2030', 0.18);
  cam(ctx, { x: 160, y: 90, zoom: lerp(1, 1.04, k) }, () => {
    // The night, the warm doorway behind him, the stone either side.
    box(ctx, 0, 0, W, H, '#0E131C');
    box(ctx, 92, 0, 136, H, mix(LAMP, '#5A3E28', 0.45));
    glow(ctx, 160, 70, 150, LAMP, 0.4);
    box(ctx, 52, 0, 40, H, NIGHT_STONE);
    box(ctx, 228, 0, 40, H, NIGHT_STONE);
    box(ctx, 86, 0, 6, H, mix(STONE, '#0E1420', 0.7));
    box(ctx, 228, 0, 6, H, mix(STONE, '#4A5A78', 0.3));
    // The lowered torch: a pool of light on the steps.
    glow(ctx, 92, 176, 46, '#FFF4D0', 0.35);
    portrait(ctx, 'walt', 160, 102, 1.45, {
      eyes: 'open',
      look: [1, 0.1],
      brows: 0.7,
      raise: 0.4,
      mouth: 'part',
      turn: 0.3,
      capY: -2 * up,
      key: LAMP,
      keyX: 30,
      keyY: -10,
      keyAmount: 0.25,
      T,
    });
    // His hand comes up and rubs under the side of his cap.
    if (up > 0)
      hand(
        ctx,
        lerp(86, 121, up) + rub * 1.4,
        lerp(200, 93, up) - rub * 1.8,
        0.95,
        -1.0 + rub * 0.08,
        {
          kind: 'abe',
          curl: 0.7,
          sleeve: NAVY,
          T,
        },
      );
  });
  vignette(ctx, 0.45, '#05080C');
}

// ——— Dawn ———
function pouchBackShot(ctx: Ctx, t: number) {
  const drop = ease(span(t, 113.6, POUCH_BACK));
  const close = ease(span(t, POUCH_BACK + 0.4, 115.4));
  const T = toward(PINK, 0.15);
  cam(ctx, { x: 160, y: 92, zoom: lerp(1, 1.06, span(t, 113, 115.8)) }, () => {
    box(ctx, 0, 0, W, H, '#5A4048');
    glow(ctx, 260, 30, 180, PINK_LT, 0.4);
    oval(ctx, 150, 170, 170, 40, '#4A3438');
    // His open palm; the empty pouch drops into it, and his fingers close.
    hand(ctx, 156, 104, 2.1, -0.08, {
      kind: 'abe',
      palm: true,
      curl: 0.05 + close * 0.95,
      sleeve: CARDIGAN,
      T,
      hold: () => pouch(ctx, lerp(230, 128, drop), lerp(48, 100, drop), 2.1, { full: 0, T }),
    });
    // Her bare hand lowers it by the cord, lets go, and draws back.
    const kx = lerp(262, 160, drop) + close * 80,
      ky = lerp(20, 72, drop) - close * 36;
    hand(ctx, kx, ky, 1.5, Math.PI - 0.6, {
      kind: 'bare',
      curl: lerp(0.55, 0.15, drop),
      sleeve: BLACK,
      T,
    });
  });
  vignette(ctx, 0.35, '#2A1820');
}
function dawnShot(ctx: Ctx, t: number) {
  const nod = hump(t, NOD, NOD + 0.8);
  const lean = ease(span(t, LEAN_IN, LEAN_IN + 1.2));
  cam(ctx, { x: 160, y: 92, zoom: lerp(1.0, 1.08, span(t, 115.8, 119)) }, () =>
    cabin(ctx, {
      dawn: 1,
      abe: {
        eyes: 'closed',
        brows: 0.5,
        mouth: t > LEAN_IN + 0.6 ? 'soft' : 'tight',
        turn: 0.15,
        tilt: nod * 0.12 + lean * -0.05,
        wet: 0.3,
      },
      kit: {
        eyes: lean > 0.5 ? 'closed' : 'down',
        look: [-1, 0.5],
        brows: 0.3,
        mouth: 'soft',
        turn: -0.4,
        wear: 'dawn',
      },
      kitX: lerp(224, 168, lean),
      kitY: lerp(84, 98, lean),
      kitTilt: lean * -0.32,
    }),
  );
  vignette(ctx, 0.3, '#2A1820');
}

// ——— Morning in the gallery ———
function galleryDay(ctx: Ctx, t: number, seconds: number, cast: () => void) {
  room(ctx, t, seconds, 1);
  cast();
  shafts(ctx, seconds, 1, 1);
}
const KIDS = [
  ['#F0C8A8', '#3A2418', '#3E7AB8'],
  ['#C88A62', '#1A1212', '#C84A4A'],
  ['#E8B898', '#8A5A2A', '#4A9A6A'],
  ['#9A6444', '#1A1212', '#E08A2A'],
  ['#F4D0B4', '#C8962E', '#7A5AB8'],
  ['#D4A07C', '#4A2A1A', '#3A8A9A'],
] as const;
function schoolGroup(ctx: Ctx, t: number, x0: number) {
  const x = x0 + (t - 119) * 18;
  person(ctx, x + 40, 288, {
    skin: '#D9A588',
    hair: '#6A4A3A',
    coat: '#7A5A8A',
    legs: '#3A3040',
    build: 'adult',
    facing: 1,
    step: t * 7,
    hairStyle: 'bun',
  });
  KIDS.forEach(([skin, hair, coat], i) =>
    person(ctx, x - i * 13, 286 + (i % 2) * 2, {
      skin,
      hair,
      coat,
      legs: '#2E3444',
      build: 'kid',
      facing: 1,
      step: t * 9 + i,
      hat: 'cap',
      hatColor: '#F2C230',
      mouth: i === 2 && within(t, 120.3, 121.2) ? 'grin' : 'smile',
    }),
  );
}
function daylightShot(ctx: Ctx, t: number, seconds: number) {
  const k = span(t, 119, 124);
  cam(
    ctx,
    { x: lerp(296, 170, k), y: 236, zoom: 1.6 },
    () =>
      galleryDay(ctx, t, seconds, () => {
        const ax = lerp(310, 160, k);
        abeFig(ctx, ax, FLOOR, { facing: -1, step: t * 6, day: true, arms: [0.1, 0.9] });
        box(ctx, ax - 12, 248, 4, 3, '#F4EEDC');
        kitDayFig(ctx, ax + 18, FLOOR + 2, { facing: -1, step: t * 6 + 1, day: true });
        schoolGroup(ctx, t, 150);
      }),
    { w: GW, h: GH },
  );
  vignette(ctx, 0.25, '#4A3A20');
}
/** The case from Abe's side, by day: the wren in the sun, his face in the glass. */
function glassShot(ctx: Ctx, t: number, seconds: number) {
  const drift = ease(span(t, DRIFT, 126.9));
  const back = ease(span(t, 127.1, 127.6));
  const reach = drift * (1 - back);
  cam(ctx, { x: 160, y: 92, zoom: lerp(1.05, 1.12, span(t, 124, 127.6)) }, () => {
    caseClose(ctx, { wren: 1, day: true, glint: 0.15 + 0.1 * Math.sin(seconds * 1.2) });
    poly(ctx, alpha(SUN, 0.22), [110, 0, 170, 0, 230, 128, 170, 128]);
    // His reflection in the glass, over the wren.
    faded(ctx, 0.2, () =>
      portrait(ctx, 'abe', 168, 70, 1.25, {
        eyes: reach > 0.6 ? 'down' : 'open',
        look: [0, reach > 0.6 ? 1 : 0.6],
        brows: 0.5,
        mouth: 'soft',
        wear: 'day',
      }),
    );
    // From old habit, his hands drift toward the glass, and stop.
    if (reach > 0) {
      hand(ctx, lerp(50, 112, reach), lerp(270, 158, reach), 2.1, -1.25, {
        kind: 'abe',
        curl: 0.1,
        sleeve: SUNDAY,
      });
      hand(ctx, lerp(270, 208, reach), lerp(270, 158, reach), 2.1, Math.PI + 1.25, {
        kind: 'abe',
        curl: 0.1,
        sleeve: SUNDAY,
        palm: true,
      });
    }
  });
  vignette(ctx, 0.25, '#4A3A20');
}
/** From behind: his hands clasped behind his back; Kit beside him hides a smile. */
function claspShot(ctx: Ctx, t: number) {
  const meet = easeOut(span(t, 127.6, CLASP));
  const smile = ease(span(t, SMILE, SMILE + 0.5));
  cam(ctx, { x: 160, y: 92, zoom: lerp(1, 1.05, span(t, 127.6, 131)) }, () => {
    box(ctx, 0, 0, W, H, '#E6DAC0');
    glow(ctx, 60, 30, 140, SUN, 0.4);
    // The alcove and the little case beyond them.
    box(ctx, 30, 40, 140, 140, '#DCCDAA');
    box(ctx, 60, 110, 70, 70, '#C8BEA8');
    box(ctx, 64, 84, 62, 26, alpha('#FFFFFF', 0.25));
    box(ctx, 64, 106, 62, 4, '#7A5434');
    wren(ctx, 95, 100, 6, { glint: 0.3 });
    // Abe from behind: Sunday coat, flat cap; his arms come round and his hands find each other.
    poly(ctx, SUNDAY, [70, 180, 78, 108, 104, 92, 140, 92, 166, 108, 174, 180]);
    // The back of his head, a little turned toward Kit: short white hair combed down under the
    // cap, ears out at the sides, a sliver of stubbled cheek past the near one, and the Sunday
    // coat's collar turned up round his neck.
    box(ctx, 113, 74, 19, 22, '#C8967A');
    oval(ctx, 147, 74, 3, 8, '#D8A88A');
    for (let i = 0; i < 5; i++) box(ctx, 146 + (i % 2), 72 + i * 2.6, 1, 1, '#F2EEE6');
    oval(ctx, 101, 67, 3, 6, '#C8967A', -0.2);
    oval(ctx, 144, 68, 4.5, 7.5, '#D8A88A', 0.2);
    line(ctx, '#B07C62', 1, [145.5, 63, 146.5, 67.5, 145, 72]);
    poly(ctx, '#E2DED6', [102, 70, 143, 70, 142, 78, 134, 80.5, 122, 81.5, 110, 80.5, 103, 78]);
    for (const y of [73, 75.5, 78]) line(ctx, '#BCB6AC', 0.8, [106, y, 122, y + 0.6, 139, y]);
    const collar = mix(SUNDAY, '#000000', 0.3);
    poly(ctx, collar, [98, 104, 103, 84, 113, 89, 132, 89, 142, 84, 147, 104, 122, 99]);
    line(ctx, mix(SUNDAY, '#FFFFFF', 0.15), 1, [103, 84, 113, 89, 132, 89, 142, 84]);
    poly(ctx, TWEED, [99, 70, 103, 52, 122, 46, 141, 52, 146, 70]);
    box(ctx, 98, 68, 49, 5, '#5A4836');
    const sleeve = mix(SUNDAY, '#000000', 0.22);
    const lw = [lerp(80, 112, meet), lerp(178, 152, meet)],
      rw = [lerp(164, 134, meet), lerp(178, 154, meet)];
    line(ctx, sleeve, 13, [84, 112, 78, 142, lw[0], lw[1]]);
    line(ctx, sleeve, 13, [160, 112, 166, 142, rw[0], rw[1]]);
    hand(ctx, lw[0] + 4, lw[1] + 2, 0.55, lerp(1.2, -0.1, meet), { kind: 'abe', curl: 0.55 });
    hand(ctx, rw[0] - 4, rw[1], 0.55, lerp(Math.PI - 1.2, Math.PI + 0.1, meet), {
      kind: 'abe',
      curl: 0.7,
    });
    // Kit beside him, looking at his hands, then hiding a smile.
    portrait(ctx, 'kit', 248, 90, 1.2, {
      wear: 'day',
      eyes: smile > 0.4 ? 'half' : 'down',
      look: [-1, 0.8],
      brows: smile > 0.4 ? 0.3 : 0,
      mouth: smile > 0.3 ? 'smile' : 'flat',
      turn: -0.4,
      key: SUN,
      keyX: -20,
      keyY: -20,
      keyAmount: 0.25,
    });
    if (smile > 0)
      hand(ctx, lerp(300, 250, smile), lerp(190, 120, smile), 0.85, -1.4, {
        kind: 'bare',
        curl: 0.5,
        sleeve: KIT_COAT,
      });
  });
  vignette(ctx, 0.25, '#4A3A20');
}
function waltShot(ctx: Ctx, t: number, seconds: number) {
  const k = span(t, 131, STOPS);
  const wx = lerp(210, 126, ease(k));
  cam(
    ctx,
    { x: 116, y: 250, zoom: 2.3 },
    () =>
      galleryDay(ctx, t, seconds, () => {
        abeFig(ctx, 74, FLOOR + 6, { facing: -1, day: true, arms: [-0.5, -0.45] });
        kitDayFig(ctx, 96, FLOOR + 8, { facing: -1, day: true });
        waltFig(ctx, wx, FLOOR + 14, {
          facing: -1,
          day: true,
          step: k < 1 ? t * 6.5 : undefined,
          arms: [0.1, 0.6],
        });
        dog(ctx, wx - 26, FLOOR + 16, 0.9, {
          step: k < 1 ? t * 9 : undefined,
          tail: t * 5,
          facing: -1,
        });
        line(ctx, '#7A2A2A', 0.8, [wx - 6, FLOOR - 4, wx - 16, FLOOR + 3]);
      }),
    { w: GW, h: GH },
  );
  vignette(ctx, 0.25, '#4A3A20');
}
function waltLooksShot(ctx: Ctx, t: number, seconds: number) {
  const atAbe = t >= AT_ABE;
  cam(ctx, { x: 160, y: 90, zoom: lerp(1, 1.1, span(t, 133.5, 136.5)) }, () => {
    box(ctx, 0, 0, W, H, '#E2D4B6');
    glow(ctx, 260, 20, 150, SUN, 0.35);
    portrait(ctx, 'walt', 168, 96, 1.6, {
      wear: 'day',
      eyes: blink(seconds, 2) ? 'closed' : atAbe ? 'open' : 'down',
      look: atAbe ? [-1, -0.1] : [-0.7, 1],
      brows: atAbe ? 0.2 : 0.5,
      raise: atAbe ? 0.5 : 0.7,
      mouth: atAbe ? 'flat' : 'part',
      turn: -0.3,
      key: SUN,
      keyX: 30,
      keyY: -20,
      keyAmount: 0.3,
    });
  });
  vignette(ctx, 0.25, '#4A3A20');
}
function nuzzleShot(ctx: Ctx, t: number) {
  const nose = easeOut(span(t, NUZZLE - 0.1, NUZZLE + 0.4));
  const push = Math.max(0, Math.sin((t - NUZZLE) * 9)) * 0.5 * nose;
  cam(ctx, { x: 160, y: 90, zoom: 1 }, () => {
    box(ctx, 0, 0, W, H, '#E6DAC0');
    glow(ctx, 80, 20, 140, SUN, 0.35);
    portrait(ctx, 'kit', 150, 70, 1.25, {
      wear: 'day',
      eyes: 'wide',
      look: [0.4, 1],
      brows: 0.6,
      raise: 0.5,
      mouth: 'tight',
      turn: 0.1,
    });
    // Her coat pocket, a biscuit's end showing, and the dog's nose working into it.
    biscuit(ctx, 186, 146, 2.2);
    box(ctx, 160, 148, 46, 24, mix(KIT_COAT, '#000000', 0.18));
    line(ctx, mix(KIT_COAT, '#FFFFFF', 0.15), 1.5, [160, 148, 206, 148]);
    dogFace(ctx, lerp(330, 250, nose) - push * 4, 142 - push * 3, 1.5, {
      eye: 0.8,
      ear: 0.3,
      look: [-1, -0.5],
      facing: -1,
      tilt: 0.15 + push * 0.1,
      scrunch: push,
    });
  });
  vignette(ctx, 0.25, '#4A3A20');
}
/** Where Walt's fingertips meet the front of his cap's peak, and how his hand lies there. */
const CAP_TOUCH = { x: 214, y: 92, rot: -2.55 } as const;
function waltKnowsShot(ctx: Ctx, t: number) {
  const look: readonly [number, number] = t < 138.5 ? [1, 1] : t < 139.0 ? [0.8, 0.2] : [-1, -0.1];
  // His hand rises and lands on the peak with the motif's first bell, and stays there.
  const touch = ease(span(t, CAP - 0.5, CAP));
  const settled = t > CAP + 0.4;
  cam(ctx, { x: 160, y: 90, zoom: lerp(1.08, 1.16, span(t, 138, 140.3)) }, () => {
    box(ctx, 0, 0, W, H, '#E2D4B6');
    glow(ctx, 260, 20, 150, SUN, 0.35);
    portrait(ctx, 'walt', 168, 96, 1.6, {
      wear: 'day',
      eyes: settled ? 'down' : 'open',
      look: settled ? [-0.6, 0.6] : look,
      brows: t < CAP ? 0.1 : -0.1,
      raise: t < 139.0 ? 0.3 : 0.1,
      mouth: t > CAP + 0.2 ? 'soft' : 'flat',
      turn: -0.3,
      key: SUN,
      keyX: 30,
      keyY: -20,
      keyAmount: 0.3,
    });
    if (touch > 0)
      hand(
        ctx,
        lerp(262, CAP_TOUCH.x, touch),
        lerp(236, CAP_TOUCH.y, touch),
        1.3,
        lerp(-2.0, CAP_TOUCH.rot, touch),
        {
          kind: 'abe',
          curl: lerp(0.5, 0.3, touch),
          sleeve: WALT_COAT,
          T: toward('#DCA88A', 0.1),
        },
      );
  });
  vignette(ctx, 0.25, '#4A3A20');
}
function abeNodsShot(ctx: Ctx, t: number) {
  const nod = hump(t, ABE_NOD, ABE_NOD + 0.8);
  cam(ctx, { x: 160, y: 90, zoom: 1.12 }, () => {
    box(ctx, 0, 0, W, H, '#E6DAC0');
    glow(ctx, 60, 20, 150, SUN, 0.4);
    portrait(ctx, 'abe', 150, 94 + nod * 4, 1.6, {
      wear: 'day',
      eyes: nod > 0.3 ? 'down' : 'open',
      look: [1, 0],
      brows: 0.4,
      mouth: 'soft',
      turn: 0.3,
      tilt: nod * 0.08,
      wet: 0.6,
      key: SUN,
      keyX: -30,
      keyY: -20,
      keyAmount: 0.3,
    });
  });
  vignette(ctx, 0.25, '#4A3A20');
}
function finalShot(ctx: Ctx, t: number, seconds: number) {
  cam(ctx, { x: 160, y: 92, zoom: lerp(1.15, 1.22, span(t, 141.5, 144)) }, () => {
    caseClose(ctx, {
      wren: 1,
      day: true,
      glint: 0.2 + 0.15 * Math.max(0, Math.sin(seconds * 0.8)),
    });
    poly(ctx, alpha(SUN, 0.26), [124, 0, 176, 0, 214, 128, 162, 128]);
    // Two old men in the glass, one either side of it.
    faded(ctx, 0.12, () => {
      portrait(ctx, 'abe', 82, 60, 1.05, {
        eyes: 'down',
        look: [1, 1],
        mouth: 'soft',
        wear: 'day',
        turn: 0.4,
      });
      portrait(ctx, 'walt', 240, 58, 1.05, {
        eyes: 'down',
        look: [-1, 1],
        mouth: 'soft',
        wear: 'day',
        turn: -0.4,
      });
    });
  });
  vignette(ctx, 0.3, '#4A3A20');
}

function drawShot(ctx: Ctx, name: ShotName, t: number, seconds: number) {
  switch (name) {
    case 'street':
      return streetShot(ctx, t, seconds);
    case 'car':
      return carShot(ctx, t, seconds);
    case 'hands':
      return handsShot(ctx, t, false);
    case 'abe':
      return abeClose(ctx, t);
    case 'hands2':
      return handsShot(ctx, t, true);
    case 'wall':
      return wallShot(ctx, t, seconds);
    case 'roof':
      return roofShot(ctx, t, seconds);
    case 'skylight':
      return skylightShot(ctx, t, seconds);
    case 'descent':
      return descentShot(ctx, t, seconds);
    case 'desk':
    case 'pair':
      return deskShot(ctx, t, seconds);
    case 'photo':
      return photoShot(ctx, t);
    case 'grid':
      return gridShot(ctx, t, seconds);
    case 'held':
      return heldShot(ctx, t);
    case 'sweat':
      return sweatShot(ctx, t, seconds);
    case 'gem':
      return gemShot(ctx, t, seconds);
    case 'glance':
      return glanceShot(ctx, t, seconds);
    case 'past':
      return pastShot(ctx, t, seconds);
    case 'alcove':
      return alcoveShot(ctx, t, seconds);
    case 'label':
      return labelShot(ctx, t);
    case 'kneel':
      return kneelShot(ctx, t, seconds);
    case 'lock':
      return lockShot(ctx, t);
    case 'dogEye':
      return dogEyeShot(ctx, t);
    case 'pouch':
      return pouchShot(ctx, t);
    case 'set':
      return setShot(ctx, t);
    case 'turn':
      return turnShot(ctx, t, seconds);
    case 'nose':
      return noseShot(ctx, t);
    case 'sneeze':
      return sneezeShot(ctx, t, seconds);
    case 'wake':
      return wakeShot(ctx, t, seconds);
    case 'torch':
      return torchShot(ctx, t, seconds);
    case 'noses':
      return nosesShot(ctx, t, seconds);
    case 'rope':
      return ropeShot(ctx, t, seconds);
    case 'squint':
      return squintShot(ctx, t);
    case 'roofs':
      return roofsShot(ctx, t, seconds);
    case 'key':
      return keyShot(ctx, t, seconds);
    case 'getaway':
      return getawayShot(ctx, t, seconds);
    case 'scratch':
      return scratchShot(ctx, t);
    case 'pouchBack':
      return pouchBackShot(ctx, t);
    case 'dawn':
      return dawnShot(ctx, t);
    case 'daylight':
      return daylightShot(ctx, t, seconds);
    case 'glass':
      return glassShot(ctx, t, seconds);
    case 'clasp':
      return claspShot(ctx, t);
    case 'walt':
      return waltShot(ctx, t, seconds);
    case 'waltLooks':
      return waltLooksShot(ctx, t, seconds);
    case 'nuzzle':
      return nuzzleShot(ctx, t);
    case 'waltKnows':
      return waltKnowsShot(ctx, t);
    case 'abeNods':
      return abeNodsShot(ctx, t);
    default:
      return finalShot(ctx, t, seconds);
  }
}

// ——— The score ———
/** The caper: four bars in D minor (Dm, Dm, Gm, A), staccato, in eighths. */
const CAPER: readonly (number | null)[] = [
  0,
  null,
  3,
  null,
  7,
  6,
  7,
  null,
  10,
  null,
  8,
  7,
  null,
  5,
  3,
  null,
  5,
  null,
  8,
  null,
  12,
  11,
  12,
  null,
  14,
  13,
  11,
  null,
  7,
  null,
  -1,
  null,
];
/** A walking bass under it, a quarter note a beat. */
const WALK: readonly number[] = [0, 3, 7, 3, 0, 3, 5, 6, 5, 8, 12, 8, 7, 4, 7, 11];
/** The same tune at dawn, in D major and slow. */
const DAWN_LINE: readonly (number | null)[] = [
  0,
  null,
  4,
  null,
  7,
  null,
  9,
  null,
  12,
  null,
  null,
  null,
  9,
  null,
  7,
  null,
  7,
  null,
  9,
  null,
  12,
  null,
  14,
  null,
  12,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];
/** The wren's motif: A B D, and when it is home, E D. */
const WREN_MOTIF = [69, 71, 74, 76, 74] as const;

export const theReturnJobScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: 62, voice: 'bell', intro: [7, 9, 12], outro: [0, 4, 7, 12] }, (s) => {
    const sec = (x: number) => (x * s.story) / STORY;
    /** The whole mix sits at the late show's level. */
    const LOUD = 1.4;
    const fx = (kind: FilmEffect, t: number, dur: number, gain: number, pan = 0) =>
      s.fx(kind, at(t), sec(dur), gain * LOUD, pan);
    const note = (t: number, pitch: number, dur: number, voice: Voice, gain: number, pan = 0) =>
      s.note(at(t), pitch, sec(dur), voice, gain * LOUD, pan);
    const beat = 60 / CAPER_BPM;
    /** The caper on its grid from the wall: melody, walking bass, and a tick on the off-beats. */
    const caper = (from: number, to: number, level: number, melody = true) => {
      for (let n = Math.ceil((from - CAPER_0) / beat - 1e-6); CAPER_0 + n * beat < to - 0.05; n++) {
        const t = CAPER_0 + n * beat;
        note(t, 38 + WALK[n % 16], beat * 0.8, 'bass', 0.1 * level);
        note(t + beat / 2, 80, 0.05, 'hat', 0.02 * level, 0.3);
        if (melody)
          for (const half of [0, 1]) {
            const d = CAPER[(n * 2 + half) % 32];
            if (d !== null)
              note(
                t + (half * beat) / 2,
                62 + d,
                beat * 0.4,
                'pluck',
                0.075 * level,
                Math.sin(n * 0.7) * 0.3,
              );
          }
      }
    };
    const motif = (from: number, count: number, gain: number) =>
      WREN_MOTIF.slice(0, count).forEach((pitch, i) =>
        note(
          from + i * (count === 3 ? 0.6 : 0.4),
          pitch,
          i === count - 1 ? 2.4 : 0.9,
          'bell',
          gain,
          (i - 2) * 0.12,
        ),
      );

    // The street: wind, a far bell, the little car puttering in and coughing off.
    fx('wind', 0, 13, 0.05);
    fx('water', 0, 6.2, 0.025, 0.35);
    fx('toll', 1.0, 2.4, 0.06, -0.4);
    for (let t = CAR_IN; t < PARKED; t += 0.55)
      fx('engine', t, 0.5, 0.08, lerp(-0.6, 0, (t - CAR_IN) / 2.3));
    fx('engine', ENGINE_OFF, 0.25, 0.1);
    fx('drip', GUTTER, 0.2, 0.05, 0.5);
    // The car: no score under the hand but the wren's motif, unresolved.
    motif(CLOSE, 3, 0.07);
    fx('rustle', TAKE - 0.1, 0.4, 0.04, 0.3);
    for (const p of [50, 53, 57]) note(TAKE, p, 2.5, 'pad', 0.02);
    // The caper, from the wall to the gem.
    caper(CAPER_0, 32, 0.7);
    caper(32, 47, 0.45);
    fx('click', LATCH, 0.06, 0.1, 0.2);
    // The floor web: her feet landing over the bridge beam, the dive, her hands planting, her
    // feet coming down out of the cartwheel; then the bead of sweat hitting the floor.
    fx('step', 40.3, 0.08, 0.03, 0.15);
    fx('swish', 41.85, 0.35, 0.04, 0.05);
    fx('step', HAND_PLANT - 0.03, 0.08, 0.03, -0.05);
    fx('step', 43.05, 0.08, 0.035, -0.15);
    fx('drip', DRIP_LAND, 0.2, 0.06, 0.1);
    for (const c of ROPE_CREAKS) fx('creak', c, 0.6, 0.06, 0.15);
    // The lasers' hum, closer as the beams close in.
    fx('hum', 23, 9, 0.02);
    fx('hum', 32, 6, 0.03);
    fx('hum', 38, 9, 0.045);
    fx('hum', 47, 6, 0.05);
    fx('hum', 53, 46, 0.025);
    // The room: the gallery clock, two snores out of step. In every angle on the room the dog
    // lies screen left under the desk and Walt sits screen right, and the pans agree.
    for (let t = 32; t < WAKE; t += 1) fx('tick', t, 0.05, 0.03, 0.5);
    fx('snore', WALT_SNORE, WAKE - WALT_SNORE, 0.06, 0.4);
    fx('snore', DOG_SNORE, LID_CREAK - DOG_SNORE, 0.04, -0.4);
    fx('snore', EYE_SHUT, SNEEZE - 0.6 - EYE_SHUT, 0.04, -0.4);
    // The fakeout: a swell into the biggest chord in the film, and then one plucked D.
    fx('sweep', 47.0, 2.0, 0.05);
    [62, 64, 65, 67, 69, 70, 73, 74].forEach((p, i) =>
      note(47.0 + i * 0.25, p, 0.3, 'pluck', 0.04 + i * 0.007),
    );
    [45, 50, 53, 57].forEach((p, i) =>
      note(47.0 + i * 0.5, p, 2.0 - i * 0.5, 'pad', 0.012 + i * 0.003),
    );
    s.chord(at(GEM), [50, 57, 62, 65, 69, 72, 76], sec(PAST - GEM), 'pad', 0.03 * LOUD);
    s.chord(at(GEM), [74, 81], sec(PAST - GEM), 'lead', 0.05 * LOUD);
    note(GEM, 38, PAST - GEM, 'bass', 0.12);
    note(PAST, 62, 1.0, 'pluck', 0.09);
    // The alcove and the lock.
    for (const p of [50, 53, 57]) note(LABEL_PAD, p, 4, 'pad', 0.018);
    for (const p of PICKS) fx('click', p, 0.06, 0.12, 0.1);
    fx('creak', LID_CREAK, 1.2, 0.09, 0.1);
    // The wren goes home.
    fx('rustle', POUCH_OPEN, 0.5, 0.05);
    fx('sparkle', IN_PALM, 0.8, 0.05);
    motif(WREN_SET, 5, 0.08);
    for (const p of [50, 54, 57, 62]) note(WREN_SET, p, 3.5, 'pad', 0.02);
    fx('sparkle', GLINT, 0.8, 0.06, 0.2);
    // The sneeze, the bark, the gasp.
    fx('click', LID_DOWN, 0.06, 0.06);
    fx('sneeze', SNEEZE - 0.6, 0.9, 0.14, -0.3);
    fx('bark', BARK, 0.3, 0.16, -0.3);
    fx('gasp', WAKE, 0.5, 0.1, 0.3);
    // The torch, his steps, and the caper's bass alone.
    fx('click', TORCH, 0.08, 0.1, 0.3);
    WALT_STEPS.forEach((w, i) =>
      fx('step', w, 0.12, 0.05, lerp(0.4, -0.1, i / (WALT_STEPS.length - 1))),
    );
    caper(TORCH, NOSE, 0.5, false);
    // Nose to nose: nothing but the hum. Then a biscuit.
    fx('rustle', BISCUIT, 0.4, 0.05, 0.1);
    fx('crunch', CRUNCH, 0.3, 0.16, 0.1);
    for (const w of WAGS) fx('swish', w, 0.15, 0.04, 0.2);
    fx('whistle', WHISTLE, 0.6, 0.08, 0.3);
    for (const st of [TROT, TROT + 0.3, TROT + 0.6, TROT + 0.9]) fx('step', st, 0.08, 0.035, 0.3);
    caper(BISCUIT, CLIMB, 0.4, false);
    // The rope.
    for (const c of [94.2, 95.2, 96.2]) fx('creak', c, 0.5, 0.05);
    fx('swish', SWING_UP, 0.4, 0.07, 0.3);
    note(GONE, 86, 0.8, 'pluck', 0.07);
    // The roofs: the caper at a run.
    s.section({
      from: at(99),
      to: at(105.7),
      bpm: 140,
      root: 62,
      minor: true,
      chords: [0, 0, 5, 7],
      melody: CAPER,
      step: 0.5,
      voice: 'pluck',
      groove: 'drive',
      pad: false,
      level: 0.6 * LOUD,
      gain: 0.85 * LOUD,
      fade: 0.3,
    });
    for (let st = 99.2; st < LEAP; st += 0.22) fx('step', st, 0.06, 0.03);
    fx('swish', LEAP, 0.5, 0.07);
    fx('thud', LAND, 0.3, 0.12);
    for (const st of [103.9, 104.1]) fx('step', st, 0.06, 0.03);
    for (const w of WINDOWS) fx('click', w, 0.05, 0.04, -0.5);
    // The getaway.
    fx('wind', 104, 10, 0.04);
    fx('water', 108.4, 4.6, 0.022, 0.35);
    for (const c of COUGHS) fx('engine', c, 0.25, 0.1);
    fx('creak', DOOR, 0.8, 0.06, -0.4);
    for (const st of [109.0, 109.5, 110.0]) fx('step', st, 0.08, 0.04, -0.4);
    fx('engine', CATCH, 2.5, 0.09);
    fx('engine', 112.2, 0.5, 0.05, 0.3);
    fx('engine', 112.8, 0.4, 0.03, 0.5);
    note(SCRATCH, 69, 0.4, 'pluck', 0.05);
    note(SCRATCH + 0.3, 65, 0.6, 'pluck', 0.05);
    // Dawn, and the morning: the caper again, in D major on the keys.
    s.section({
      from: at(113),
      to: at(131),
      bpm: 72,
      root: 62,
      chords: [0, 5, 7, 0],
      melody: DAWN_LINE,
      step: 0.5,
      voice: 'keys',
      groove: 'none',
      level: 0.7 * LOUD,
      gain: 0.75 * LOUD,
      fade: 1.5,
    });
    fx('tweet', 114, 0.4, 0.04, 0.5);
    fx('crowd', 119, 22, 0.04);
    fx('tweet', 120, 0.4, 0.035, 0.6);
    fx('giggle', 120.5, 0.6, 0.04, 0.3);
    fx('tweet', 125, 0.4, 0.035, -0.5);
    note(CLASP, 74, 0.6, 'pluck', 0.05);
    // The look: a thin pad, and the wren's motif whole for the second time.
    for (const p of [50, 57, 62]) note(131, p, 8.5, 'pad', 0.014);
    motif(CAP, 5, 0.08);
    for (const p of [50, 54, 57, 62]) note(CAP, p, 4.5, 'pad', 0.018);
  });

export const theReturnJob: FilmModule = {
  draw(ctx, p, seconds) {
    const t = p * STORY;
    drawShot(ctx, scene(t).name, t, seconds);
    // Under the end card, let the last frame sink back so the words read.
    veil(ctx, '#0B0E14', ease((seconds - STORY - 3) / 0.9) * 0.3);
  },
  score: theReturnJobScore,
  look: {
    shade: '#10161F',
    ink: '#E8D9B0',
    accent: '#D4A93A',
    dedication: 'returned with thanks, fifty years late',
  },
};
