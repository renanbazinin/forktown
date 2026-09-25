import type { FilmModule } from './types';
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
  hump,
  lerp,
  line,
  mix,
  oval,
  poly,
  rainfall,
  rand,
  shade,
  shot,
  span,
  TAU,
  track,
  veil,
  vignette,
  W,
  within,
  type Ctx,
  type View,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * BOLT AND THE BLOOM
 * In a grey, abandoned city where nothing grows, a small sweeping robot finds a single sprout
 * in a crack and protects it through a storm at the cost of his own power. The flower it
 * becomes brings him, and then the whole city, back to life.
 *
 * Colour script: the first half is nearly monochrome (dusty greys and beige) with only Bolt's
 * rust and the sprout's green; the storm is blue-black; the dawn is clean and pale; then the
 * colour spreads outward from the flower until the street is a garden under a blue sky.
 *
 * Story beats (broom strokes, water drops, fence bolts, sparks, the revival) are shared
 * constants, so the drawing and the score land on the same moments.
 */

const STORY = 54; // 60 s film minus the opening and closing titles.
const CUTS = [
  0, 0.062, 0.105, 0.145, 0.19, 0.245, 0.295, 0.35, 0.4, 0.445, 0.48, 0.52, 0.56, 0.605, 0.68, 0.72,
  0.84, 0.905,
] as const;
const WORLD = { w: 480, h: 180 };
const PLANT = 262, // the crack in the pavement
  GROUND = 160,
  HOME = 246; // where Bolt kneels beside it

// Act one: a pointless sweep, one stroke every two beats of the music box (80 bpm).
const SWEEP = 1.5 / STORY;
const STROKES = [0, 1, 2, 3].map((k) => k * SWEEP);
const BONK = STROKES[3];
// The montage waltz (90 bpm): drops of water, then fence bolts, one per beat.
const WALTZ = 0.19,
  BEAT = 60 / 90 / STORY;
const DROPS = [5, 6, 7, 8].map((b) => WALTZ + b * BEAT);
const FENCE = [9, 10, 11, 12].map((b) => WALTZ + b * BEAT);
const FENCE_X = [-8, 7, -3, 3];
// Tally marks: one each dusk, then a long run of nights.
const TALLY = [0.238, 0.292, 0.345, ...Array.from({ length: 8 }, (_, i) => 0.357 + i * 0.0042)];
const BUD = 0.383;
// The storm.
const THUNDER = [0.408, 0.47];
const OPEN_UMBRELLA = 0.442,
  RIP = 0.462;
const LOW_BATTERY = 0.49;
const SPARKS = [0.498, 0.508, 0.519];
const POWER_DOWN = 0.532;
// The morning after.
const PETAL = 0.614,
  LANDS = 0.632,
  GLINT = 0.641;
const DOTS = [0.65, 0.655, 0.66],
  HEART = 0.667;
const SIT_UP = 0.684,
  SEEDS = 0.7;
const GROW_FROM = 0.735,
  GROW_TO = 0.84;
const RAKES = [0, 1].map((k) => 0.852 + k * (1.2 / STORY));
const PERCH = 0.925,
  LOVE = 0.935;

// ——— Bolt ———
const RUST = '#C4643A',
  RUST_LIT = '#DE8757',
  RUST_DIM = '#8C4428',
  STEEL = '#9A9C9E',
  STEEL_DIM = '#62666A',
  RUBBER = '#3A3636',
  VISOR = '#141A20',
  SCREEN = '#9EEFFF',
  AMBER = '#FFC65A',
  RED = '#E0543E',
  STEM = '#4E9A3E',
  LEAF = '#7ACC4E',
  LEAF_DIM = '#4F9A35';

/** Visor glyphs as tiny bitmaps: '#' is screen light, 'r' is red. */
const GLYPHS = {
  eyes: ['##....##', '##....##', '##....##'],
  blink: ['###..###'],
  bored: ['###..###', '##....##'],
  wide: ['###...###', '###...###', '###...###'],
  happy: ['.#....#.', '#.#..#.#'],
  brave: ['#......#', '.##..##.', '.##..##.'],
  q: ['.##.', '#..#', '...#', '..#.', '....', '..#.'],
  bang: ['##', '##', '##', '..', '##'],
  heart: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  battery: ['#########..', '#rr......##', '#rr......##', '#rr......##', '#########..'],
  smile: ['.#.....#.', '#.#...#.#', '.........', '.#.....#.', '..#####..'],
} as const;
type Glyph = keyof typeof GLYPHS | 'dots' | 'off';
/** Each glyph as runs of lit pixels [x, y, length, red], so a row is one rectangle. */
const RUNS = Object.fromEntries(
  Object.entries(GLYPHS).map(([name, rows]) => {
    const runs: [number, number, number, boolean][] = [];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        const c = row[x];
        let end = x;
        while (end < row.length && row[end] === c) end++;
        if (c !== '.') runs.push([x, y, end - x, c === 'r']);
        x = end;
      }
    });
    return [name, { runs, w: rows[0].length, h: rows.length }];
  }),
) as Record<
  keyof typeof GLYPHS,
  { runs: [number, number, number, boolean][]; w: number; h: number }
>;

type Pose = {
  facing?: 1 | -1;
  size?: number;
  /** 0 standing, 1 squatting low. */
  crouch?: number;
  /** Body tilt forward from the hips, radians. */
  lean?: number;
  /** Head nod forward, radians (negative looks up). */
  tilt?: number;
  /** Back and front arm angles from hanging straight down; positive swings forward. */
  arms?: readonly [number, number];
  step?: number;
  glyph?: Glyph;
  gaze?: readonly [number, number];
  /** Visor brightness 0..1, antenna light 0..1, and the chest battery meter 0..1. */
  screen?: number;
  light?: number;
  battery?: number;
  dots?: number;
  /** Sideways spring of the antenna, in pixels. */
  wobble?: number;
};
type Point = { x: number; y: number };
type Rig = { hand: Point; backHand: Point; panel: Point; tip: Point; visor: Point; neck: Point };

const rot = (x: number, y: number, a: number): [number, number] => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];
const hipOf = (pose: Pose) =>
  -9 + (pose.crouch ?? 0) * 5 - (pose.step === undefined ? 0 : Math.abs(Math.cos(pose.step)) * 0.6);

/** World positions of Bolt's hands, solar panel, antenna tip, and visor, for props and lights. */
function rig(x: number, y: number, pose: Pose): Rig {
  const s = pose.size ?? 1,
    f = pose.facing ?? 1,
    lean = pose.lean ?? 0,
    tilt = pose.tilt ?? 0,
    hip = hipOf(pose);
  const body = (bx: number, by: number) => {
    const [rx, ry] = rot(bx, by, lean);
    return { x: x + rx * s * f, y: y + (hip + ry) * s };
  };
  const head = (hx: number, hy: number) => {
    const [ax, ay] = rot(hx, hy, tilt);
    return body(1 + ax, -17 + ay);
  };
  const hand = (angle: number) => {
    const [ax, ay] = rot(0, 11, -angle);
    return body(1 + ax, -12 + ay);
  };
  const [back, front] = pose.arms ?? [0.15, 0.25];
  return {
    hand: hand(front),
    backHand: hand(back),
    panel: head(0.5, -19),
    tip: head(-7 + (pose.wobble ?? 0), -25),
    visor: head(4, -9),
    neck: body(1, -16),
  };
}

function arm(ctx: Ctx, angle: number, color: string) {
  ctx.save();
  ctx.translate(1, -12);
  ctx.rotate(-angle);
  box(ctx, -1, 0, 3, 6, color);
  box(ctx, -1, 5, 3, 1, STEEL_DIM);
  box(ctx, -1, 6, 3, 4, color);
  box(ctx, -2, 10, 2, 3, STEEL_DIM);
  box(ctx, 1, 10, 2, 3, STEEL_DIM);
  ctx.restore();
}

/**
 * Bolt: a boxy rust-orange sweeper with a round head and a wide visor that shows his
 * feelings as pixel glyphs. (x, y) is the ground between his feet. The 'body' layer is the
 * robot itself; the 'lights' layer is his visor, meter, and antenna bulb, drawn separately so
 * they stay bright after the night and storm grades. `prop` draws between his arms.
 */
function bolt(
  ctx: Ctx,
  x: number,
  y: number,
  pose: Pose,
  layer: 'body' | 'lights' | 'all' = 'all',
  prop?: () => void,
) {
  const s = pose.size ?? 1,
    f = pose.facing ?? 1;
  const hip = hipOf(pose);
  const [back, front] = pose.arms ?? [0.15, 0.25];
  const frame = (paint: () => void) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f * s, s);
    ctx.translate(0, hip);
    ctx.rotate(pose.lean ?? 0);
    paint();
    ctx.restore();
  };
  const head = (paint: () => void) => {
    ctx.save();
    ctx.translate(1, -17);
    ctx.rotate(pose.tilt ?? 0);
    paint();
    ctx.restore();
  };
  if (layer !== 'lights') {
    // Stubby legs and rubber feet, with a little shuffle when walking.
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f * s, s);
    const swing = pose.step === undefined ? 0 : Math.sin(pose.step) * 2;
    const lift = (sign: number) =>
      pose.step === undefined ? 0 : Math.max(0, Math.cos(pose.step) * sign);
    const leg = Math.max(1, -hip - 3);
    box(ctx, -5 - swing, hip, 3, leg, STEEL_DIM);
    box(ctx, -8 - swing, -3 - lift(1), 7, 3, RUBBER);
    box(ctx, 2 + swing, hip, 3, leg, STEEL);
    box(ctx, -1 + swing, -3 - lift(-1), 8, 3, RUBBER);
    box(ctx, -1 + swing, -3 - lift(-1), 8, 1, '#565050');
    ctx.restore();
    frame(() => {
      arm(ctx, back, STEEL_DIM);
      // The boxy body: rust with a lit top edge, a shaded back, rivets, and a chest meter.
      box(ctx, -8, -15, 16, 15, RUST);
      box(ctx, -8, -15, 16, 2, RUST_LIT);
      box(ctx, -8, -15, 3, 15, RUST_DIM);
      box(ctx, -8, -2, 16, 2, RUST_DIM);
      box(ctx, -2, -11, 9, 6, '#6E3420');
      for (const [rx, ry] of [
        [-4, -12],
        [6, -12],
        [-4, -4],
        [6, -4],
      ])
        box(ctx, rx, ry, 1, 1, RUST_LIT);
      box(ctx, -1, -17, 4, 2, STEEL_DIM);
      head(() => {
        // Antenna stalk, then the round head, the visor, and the solar panel on top.
        const tipX = -7 + (pose.wobble ?? 0);
        line(ctx, STEEL_DIM, 1, [-5, -15, (tipX - 5) / 2, -20, tipX, -25]);
        disc(ctx, tipX, -25, 1.7, '#4A3A30');
        oval(ctx, 1, -8, 11, 8.5, RUST_DIM);
        oval(ctx, 1, -8.8, 10.4, 7.7, RUST);
        box(ctx, -5, -16, 10, 1, RUST_LIT);
        disc(ctx, -8, -8, 2.2, STEEL);
        disc(ctx, -8, -8, 1, STEEL_DIM);
        box(ctx, -4, -13, 16, 9, VISOR);
        for (const [cx, cy] of [
          [-4, -13],
          [11, -13],
          [-4, -5],
          [11, -5],
        ])
          box(ctx, cx, cy, 1, 1, RUST);
        box(ctx, -3, -12, 3, 1, '#2E3842');
        box(ctx, 0, -17.5, 2, 1, STEEL_DIM);
        box(ctx, -6, -19, 13, 2, '#34506E');
        for (let i = 0; i < 4; i++) box(ctx, -5 + i * 3, -19, 2, 1, '#5E86AC');
      });
    });
    prop?.();
    frame(() => arm(ctx, front, STEEL));
  }
  if (layer !== 'body') {
    const screen = pose.screen ?? 1,
      light = pose.light ?? 0,
      battery = pose.battery ?? 1;
    frame(() => {
      // Three bars on the chest: pale when charged, one red bar when nearly empty.
      for (let i = 0; i < 3; i++) {
        const lit = battery > i / 3 + 0.02;
        const color = battery < 0.34 ? '#FF5A4A' : SCREEN;
        box(ctx, -1 + i * 3, -10, 2, 4, lit ? alpha(color, 0.85) : '#3A2A24');
      }
      head(() => {
        const tipX = -7 + (pose.wobble ?? 0);
        if (light > 0) disc(ctx, tipX, -25, 1.7, mix('#4A3A30', AMBER, light));
        const glyph = pose.glyph ?? 'eyes';
        if (screen <= 0 || glyph === 'off') return;
        const [gx, gy] = pose.gaze ?? [0, 0];
        faded(ctx, screen, () => {
          if (glyph === 'dots') {
            for (let i = 0; i < (pose.dots ?? 3); i++) box(ctx, i * 3 + gx, -9 + gy, 2, 2, SCREEN);
            return;
          }
          const { runs, w, h } = RUNS[glyph];
          const left = 4 - Math.floor(w / 2) + gx,
            top = -9 - Math.floor(h / 2) + gy;
          for (const [rx, ry, len, red] of runs)
            box(ctx, left + rx, top + ry, len, 1, red ? '#FF6B6B' : SCREEN);
        });
      });
    });
    const r = rig(x, y, pose);
    if (light > 0) glow(ctx, r.tip.x, r.tip.y, 16 * s, AMBER, 0.45 * light);
    if (screen > 0 && pose.glyph !== 'off')
      glow(ctx, r.visor.x, r.visor.y, 11 * s, SCREEN, 0.1 * screen);
  }
}

// ——— Props ———
/** A push broom (or, at the end, a rake with bolts for tines) whose handle runs through the hand. */
function broom(ctx: Ctx, tipX: number, tipY: number, hand: Point, rake = false) {
  const dx = hand.x - tipX,
    dy = hand.y - (tipY - 5);
  const len = Math.hypot(dx, dy) || 1;
  line(ctx, rake ? '#6E8A58' : '#7B6A58', 1.6, [
    tipX,
    tipY - 5,
    hand.x + (dx / len) * 9,
    hand.y + (dy / len) * 9,
  ]);
  if (rake) {
    box(ctx, tipX - 7, tipY - 6, 14, 2, STEEL_DIM);
    for (let i = 0; i < 5; i++) box(ctx, tipX - 7 + i * 3, tipY - 4, 1, 4, STEEL);
    // A flower tied to the handle.
    const fx = hand.x + (dx / len) * 5,
      fy = hand.y + (dy / len) * 5;
    disc(ctx, fx, fy, 1.8, '#F28AB2');
    box(ctx, fx, fy, 1, 1, '#F2C14E');
    return;
  }
  poly(ctx, '#B39A68', [tipX - 6, tipY, tipX + 6, tipY, tipX + 3, tipY - 6, tipX - 3, tipY - 6]);
  box(ctx, tipX - 4, tipY - 7, 8, 2, '#6C5C4A');
  for (let i = 0; i < 3; i++) box(ctx, tipX - 3 + i * 3, tipY - 4, 1, 4, '#8E784E');
}
function brush(ctx: Ctx) {
  // The broom laid down on the pavement behind him.
  line(ctx, '#7B6A58', 1.6, [206, 163, 230, 162]);
  box(ctx, 230, 159, 3, 5, '#6C5C4A');
  poly(ctx, '#B39A68', [233, 158, 239, 156, 239, 166, 233, 165]);
}
function bottle(ctx: Ctx, hand: Point, angle: number) {
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(angle);
  box(ctx, -2, -8, 5, 9, alpha('#D4E4EA', 0.9));
  box(ctx, -2, -4, 5, 5, '#7FB6CF');
  box(ctx, -1, -10, 3, 2, alpha('#D4E4EA', 0.9));
  box(ctx, -1, -11, 3, 1, '#4E7F98');
  ctx.restore();
}
const mouthOf = (hand: Point, angle: number) => {
  const [mx, my] = rot(0.5, -11, angle);
  return { x: hand.x + mx, y: hand.y + my };
};
function umbrella(ctx: Ctx, x: number, y: number, angle: number, open: number, inverted = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  line(ctx, '#2A2A2E', 1.2, [0, 0, 0, -22]);
  line(ctx, '#2A2A2E', 1.2, [0, 0, 0, 3, -3, 3]);
  const spread = 3 + 13 * open,
    dome = inverted ? 7 : -5 * open;
  poly(ctx, '#2B2E33', [
    -spread,
    -18,
    -spread * 0.6,
    -22 + dome * 0.8,
    0,
    -22 + dome,
    spread * 0.6,
    -22 + dome * 0.8,
    spread,
    -18,
  ]);
  if (open > 0.5) {
    line(ctx, '#4A4F57', 1, [0, -22 + dome, -spread * 0.5, -18]);
    line(ctx, '#4A4F57', 1, [0, -22 + dome, spread * 0.5, -18]);
  }
  ctx.restore();
}
/** A furled umbrella: tip at (x, y), hook up top, leaning by `angle`. */
function furled(ctx: Ctx, x: number, y: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  line(ctx, '#2A2A2E', 1.2, [0, 0, 0, -24, 2, -27, 4, -25]);
  poly(ctx, '#2B2E33', [0, -2, -2.5, -8, -2, -16, 0, -18, 2, -16, 2.5, -8]);
  box(ctx, -1, -12, 2, 1, '#4A4F57');
  ctx.restore();
}
function nut(ctx: Ctx, x: number, y: number) {
  box(ctx, x - 1, y - 4, 2, 4, STEEL);
  box(ctx, x - 2, y - 5, 4, 2, STEEL_DIM);
}

// ——— The plant ———
type Growth = {
  grow: number;
  open?: number;
  droop?: number;
  sway?: number;
  /** Where the stem's top leans to, and extra height, for the flower rising at dawn. */
  bend?: number;
  rise?: number;
  /** A dandelion puff on the flower's centre, and whether one petal has fallen. */
  puff?: number;
  missing?: boolean;
};
function plant(ctx: Ctx, x: number, y: number, g: Growth, s = 1) {
  const h = (4 + 16 * g.grow + (g.rise ?? 0)) * s;
  const lean = ((g.bend ?? 0) + (g.sway ?? 0)) * s;
  const at = (t: number) => ({ x: x + lean * t * t, y: y - h * t });
  const stem: number[] = [];
  for (let i = 0; i <= 5; i++) {
    const q = at(i / 5);
    stem.push(q.x, q.y);
  }
  line(ctx, STEM, Math.max(1, s * (0.8 + g.grow * 0.7)), stem);
  const pairs = g.grow < 0.2 ? 1 : (g.rise ?? 0) > 4 ? 3 : 2;
  const droop = g.droop ?? 0;
  for (let k = 0; k < pairs; k++) {
    const q = at(pairs === 1 ? 1 : 0.28 + k * 0.24);
    const size = (pairs === 1 ? 1 : 1.1 - k * 0.15) * s * (1 + g.grow * 0.1 + (g.rise ?? 0) / 40);
    const ang = -0.45 + droop * 1.2 + (pairs === 1 ? 0 : 0.25);
    for (const side of [-1, 1]) {
      const cx = q.x + side * Math.cos(ang) * 3.2 * size,
        cy = q.y + Math.sin(ang) * 3.2 * size;
      oval(ctx, cx, cy + 0.4 * s, 3.4 * size, 1.5 * size, LEAF_DIM, side * ang);
      oval(ctx, cx, cy, 3.2 * size, 1.2 * size, LEAF, side * ang);
    }
  }
  const top = at(1);
  const open = g.open ?? 0;
  if (g.grow > 0.55 && open < 0.4) {
    const b = span(g.grow, 0.55, 0.8) * (1 - open * 2.5);
    oval(ctx, top.x, top.y - 2.5 * s * b, 2.6 * s * b + 0.5, 3.6 * s * b + 0.5, '#5FA044');
    if (g.grow > 0.68) {
      // The bud's red shows through the split in its green.
      oval(ctx, top.x, top.y - 4.2 * s * b, 1.9 * s * b, 2.6 * s * b, RED);
      oval(ctx, top.x - 1.4 * s * b, top.y - 2.2 * s * b, 1, 2 * s * b, '#5FA044', -0.3);
      oval(ctx, top.x + 1.4 * s * b, top.y - 2.2 * s * b, 1, 2 * s * b, '#5FA044', 0.3);
    }
  }
  if (open > 0) {
    const r = 10 * s * easeOut(open);
    for (let i = 0; i < 8; i++) {
      if (g.missing && i === 1) continue;
      const a = (i / 8) * TAU + 0.2;
      oval(
        ctx,
        top.x + Math.cos(a) * r * 0.55,
        top.y + Math.sin(a) * r * 0.5,
        r * 0.55,
        r * 0.34,
        i % 2 ? '#C83E2E' : RED,
        a,
      );
    }
    disc(ctx, top.x, top.y, r * 0.3, '#6E2A1C');
    disc(ctx, top.x - r * 0.05, top.y - r * 0.05, r * 0.2, '#F2C14E');
    const puff = g.puff ?? 0;
    if (puff > 0) {
      disc(ctx, top.x, top.y - r * 0.1, r * 0.42 * puff, alpha('#F4F1E6', 0.9));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        box(
          ctx,
          top.x + Math.cos(a) * r * 0.45 * puff,
          top.y + Math.sin(a) * r * 0.45 * puff,
          1,
          1,
          '#FFFFFF',
        );
      }
    }
  }
}
/** One seed of dandelion fluff: a stalk and a little white parasol. */
function fluff(ctx: Ctx, x: number, y: number, s = 1) {
  box(ctx, x, y, 1, 2 * s, '#CFC8B0');
  box(ctx, x - 1.5 * s, y - 1, 4 * s, 1, '#FFFFFF');
  box(ctx, x - 0.5 * s, y - 2, 2 * s, 1, alpha('#FFFFFF', 0.8));
}

// ——— The street ———
/** The greening spreads outward from the flower: how late it reaches a given x. */
const reach = (x: number) => Math.min(1, Math.abs(x - PLANT) / 240) * 0.55;
const bloomAt = (green: number, x: number) => ease(span(green, reach(x), reach(x) + 0.45));

const GREY_SKY = ['#ADA69A', '#BAB3A6', '#C7C0B2', '#D3CDBF'];
const DAWN_SKY = ['#B9B2C2', '#DCC1B5', '#EED0B1', '#F7E2C3'];
const BLUE_SKY = ['#4E9FE0', '#6CB3E8', '#8FC8EE', '#B7DDF2'];
function skyBands(p: number, green: number) {
  const blue = ease(span(green, 0.15, 0.85));
  return GREY_SKY.map((grey, i) => mix(p >= 0.56 ? DAWN_SKY[i] : grey, BLUE_SKY[i], blue));
}
/** A dithered sky, drawn only across the part of the world the camera can see. */
function backdrop(ctx: Ctx, bands: readonly string[], view: View, bottom = 132) {
  const half = W / 2 / view.zoom;
  const cx = clamp(view.x, half, WORLD.w - half);
  const left = Math.floor((cx - half) / 4) * 4 - 4,
    width = half * 2 + 12;
  const step = bottom / bands.length;
  bands.forEach((color, i) => box(ctx, left, i * step, width, Math.ceil(step) + 1, color));
  for (let i = 1; i < bands.length; i++) {
    const y = Math.round(i * step);
    for (let x = left; x < left + width; x += 4) {
      box(ctx, x, y - 1, 2, 1, bands[i]);
      box(ctx, x + 2, y, 2, 1, bands[i - 1]);
    }
  }
}
/** The sun's path over the empty lot for one fast montage day, t = 0..1. */
const sunPath = (t: number) => ({
  x: 266 - 66 * Math.cos(Math.PI * t),
  y: 118 - 58 * Math.sin(Math.PI * t),
});

const TOWERS = [
  [184, 30, 86],
  [212, 18, 97],
  [228, 30, 80],
  [256, 22, 93],
  [276, 34, 87],
  [308, 22, 98],
  [328, 26, 84],
] as const;
function skyline(ctx: Ctx, view: View, green: number, dawn: number) {
  // The far city drifts a little slower than the street.
  const ox = (clamp(view.x, W / 2 / view.zoom, WORLD.w - W / 2 / view.zoom) - 262) * 0.3;
  const k = bloomAt(green, 262);
  const face = mix(mix('#A9A296', '#C4AFA6', dawn), '#9DBCD2', k),
    lit = mix(face, '#FFFFFF', 0.12);
  for (const [x, w, top] of TOWERS) {
    box(ctx, x + ox, top, w, 140 - top, face);
    box(ctx, x + ox, top, 2, 140 - top, lit);
    for (let y = top + 5; y < 108; y += 7)
      box(ctx, x + ox + 4, y, w - 8, 2, mix(face, '#6E6A64', 0.25));
  }
}

const BLOCKS = [
  { x: 0, w: 122, top: 10, grey: '#8A8884', warm: '#E3C197', cols: 4 },
  { x: 122, w: 76, top: 60, grey: '#989189', warm: '#D98A68', cols: 2 },
  { x: 334, w: 146, top: 22, grey: '#83858A', warm: '#8DBDB1', cols: 5 },
] as const;
const PETALS = ['#F28AB2', '#F2C14E', '#FFFFFF', '#B58AE0', '#FF8F5A', '#7FC8F8', RED];
function block(ctx: Ctx, b: (typeof BLOCKS)[number], green: number) {
  const k = bloomAt(green, b.x + b.w / 2);
  const face = mix(b.grey, b.warm, k);
  box(ctx, b.x, b.top, b.w, 140 - b.top, face);
  box(ctx, b.x, b.top, b.w, 3, mix(face, '#FFFFFF', 0.18));
  box(ctx, b.x + b.w - 3, b.top, 3, 140 - b.top, mix(face, '#1C1E24', 0.18));
  const pane = mix('#56565A', '#5B4A44', k),
    sill = mix(face, '#FFFFFF', 0.25);
  const gap = (b.w - 14) / b.cols;
  for (let row = 0; row < 6; row++) {
    const wy = b.top + 12 + row * 18;
    if (wy + 12 > (b.x === 334 ? 100 : 128)) break;
    for (let col = 0; col < b.cols; col++) {
      const wx = b.x + 9 + col * gap;
      box(ctx, wx, wy, 12, 11, pane);
      box(ctx, wx - 1, wy + 11, 14, 1, sill);
      const seed = b.x + row * 7 + col;
      if (rand(seed) > 0.7) box(ctx, wx + 1, wy + 1, 4, 3, mix('#6E6E72', '#8FB8C8', k));
      // Window boxes of flowers, once the colour has arrived.
      if (k > 0.4 && rand(seed * 3.3) > 0.55) {
        box(ctx, wx - 1, wy + 9, 14, 3, '#8A5A3E');
        const bud = Math.round(3 * span(k, 0.4, 0.8));
        for (let f = 0; f < 3; f++)
          box(ctx, wx + 1 + f * 4, wy + 9 - bud, 3, bud, PETALS[(seed + f) % 7]);
      }
    }
  }
  if (b.x === 334) {
    // A shuttered shop under a faded awning.
    box(ctx, 352, 106, 62, 34, mix('#6F7074', '#7C8C94', k));
    for (let y = 108; y < 140; y += 3) box(ctx, 352, y, 62, 1, mix('#5E5F63', '#6A7880', k));
    for (let i = 0; i < 7; i++)
      box(
        ctx,
        348 + i * 10,
        99,
        10,
        6,
        i % 2 ? mix('#9A9690', '#FFFFFF', k) : mix('#7E7A74', RED, k),
      );
    box(ctx, 430, 106, 20, 34, mix('#4A4A4E', '#5B4A44', k));
  }
}
function billboard(ctx: Ctx, green: number) {
  // Faded long ago, it still shows a flower.
  const k = bloomAt(green, 160);
  box(ctx, 138, 48, 3, 12, '#5E5A55');
  box(ctx, 178, 48, 3, 12, '#5E5A55');
  box(ctx, 124, 18, 72, 32, '#6A665F');
  box(ctx, 126, 20, 68, 28, mix('#B5AE9F', '#8FCBEA', k));
  disc(ctx, 182, 27, 5, mix('#C2BBAC', '#F7D25A', k));
  box(ctx, 142, 31, 2, 16, mix('#A9A292', STEM, k));
  oval(ctx, 139, 41, 3, 1.4, mix('#A9A292', LEAF, k), -0.4);
  oval(ctx, 147, 38, 3, 1.4, mix('#A9A292', LEAF, k), 0.4);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    disc(ctx, 143 + Math.cos(a) * 4, 29 + Math.sin(a) * 4, 3, mix('#ABA394', RED, k));
  }
  disc(ctx, 143, 29, 2.5, mix('#9E9788', '#F2C14E', k));
  box(ctx, 156, 35, 30, 3, mix('#A59E8F', '#FFFFFF', k));
  box(ctx, 156, 41, 22, 2, mix('#A59E8F', '#FFFFFF', k));
  poly(ctx, '#8E887D', [184, 20, 194, 20, 194, 30]);
}
function wall(ctx: Ctx, green: number, tally: number) {
  const k = bloomAt(green, 266);
  const face = mix('#9D978D', '#CDB894', k),
    joint = mix(face, '#5E5A54', 0.3);
  box(ctx, 198, 112, 138, 28, face);
  box(ctx, 196, 110, 142, 3, mix('#B3ADA2', '#DCC9A6', k));
  for (let row = 0; row < 4; row++) {
    const y = 118 + row * 6;
    box(ctx, 198, y, 138, 1, joint);
    for (let x = 198 + (row % 2) * 9; x < 336; x += 18) box(ctx, x, y - 5, 1, 5, joint);
  }
  // Bolt's tally of days, scratched into the concrete.
  for (let i = 0; i < Math.ceil(tally); i++) {
    const len = clamp(tally - i),
      g = Math.floor(i / 5),
      x = 284 + g * 12;
    if (i % 5 < 4) box(ctx, x + (i % 5) * 2, 128 - 10 * len, 1, 10 * len, '#E2DDD2');
    else line(ctx, '#E2DDD2', 1, [x - 1, 127, x - 1 + 9 * len, 127 - 8 * len]);
  }
  if (k > 0)
    for (let i = 0; i < 14; i++)
      oval(ctx, 200 + i * 10, 111, 5 * k, 2 * k, alpha(i % 2 ? '#6FAE4A' : '#8CC45E', 0.9));
}

const CRACKS = [
  [236, 164, 244, 162, 250, 163, 256, 161, 262, 160, 268, 160, 275, 161, 284, 158],
  [30, 170, 42, 166, 50, 167, 62, 162],
  [138, 158, 148, 160, 156, 157, 168, 158],
  [370, 172, 380, 168, 392, 169, 398, 165],
  [436, 152, 444, 156, 456, 155],
] as const;
const PUDDLES = [
  [194, 170, 30],
  [306, 171, 24],
  [404, 160, 34],
  [92, 158, 26],
] as const;
function pavement(
  ctx: Ctx,
  green: number,
  wet: number,
  sky: string,
  seconds: number,
  rain: number,
) {
  const k = ease(span(green, 0.1, 0.7));
  const base = mix(mix('#8E897F', '#6E6C6C', wet * 0.6), '#BBAA8E', k),
    joint = mix(base, '#4E4A44', 0.25);
  box(ctx, 0, 140, WORLD.w, 40, base);
  box(ctx, 0, 140, WORLD.w, 2, mix(base, '#3E3A36', 0.3));
  box(ctx, 0, 151, WORLD.w, 1, joint);
  box(ctx, 0, 166, WORLD.w, 1, joint);
  for (let x = 14; x < WORLD.w; x += 38) {
    box(ctx, x, 142, 1, 9, joint);
    box(ctx, x + 19, 152, 1, 14, joint);
  }
  box(ctx, 0, 174, WORLD.w, 1, mix(base, '#FFFFFF', 0.2));
  box(ctx, 0, 175, WORLD.w, 5, mix(base, '#3E3A36', 0.3));
  for (const crack of CRACKS) line(ctx, mix('#57534C', '#6E5A44', k), 1, crack);
  for (const [x, y] of [
    [30, 148],
    [176, 171],
    [322, 147],
    [430, 170],
  ])
    poly(ctx, mix(base, '#5E5A54', 0.35), [x - 4, y + 2, x - 2, y - 2, x + 3, y - 3, x + 5, y + 2]);
  if (wet <= 0) return;
  for (const [x, y, w] of PUDDLES) {
    oval(ctx, x, y, (w / 2) * wet, 3 * wet, alpha(mix(sky, base, 0.25), 0.9));
    oval(ctx, x - w / 6, y - 1, (w / 5) * wet, wet, alpha('#FFFFFF', 0.35));
    if (rain > 0.05)
      for (let i = 0; i < 2; i++) {
        const t = (seconds * 1.3 + i * 0.5 + x) % 1;
        ctx.strokeStyle = alpha('#DCE6EE', (1 - t) * rain);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x - w / 4 + (i * w) / 2, y, 1 + t * 5, 0.5 + t * 1.2, 0, 0, TAU);
        ctx.stroke();
      }
  }
}
function lamp(ctx: Ctx, x: number, k: number) {
  const c = mix('#5C5C5E', '#4E6B5A', k);
  box(ctx, x - 1, 64, 3, 86, c);
  box(ctx, x - 3, 146, 7, 5, c);
  line(ctx, c, 2, [x, 66, x + 4, 61, x + 12, 61]);
  poly(ctx, c, [x + 8, 60, x + 19, 60, x + 17, 65, x + 10, 65]);
  box(ctx, x + 11, 65, 5, 1, '#77756F');
}

// ——— Greenery: every blade, flower, vine, and tree waits for the wave to reach it ———
const TUFTS = Array.from({ length: 34 }, (_, i) => ({
  x: 4 + rand(i * 3.1 + 1) * 472,
  y: i % 2 ? 141 : 167 + rand(i * 5.3) * 8,
  h: 3 + rand(i * 7.7) * 4,
  lag: rand(i * 1.9) * 0.08,
}));
const FLORA = Array.from({ length: 34 }, (_, i) => ({
  x: 6 + rand(i * 4.3 + 2) * 468,
  y: i % 3 === 0 ? 142 + rand(i) * 3 : 163 + rand(i * 2.1) * 13,
  h: 4 + rand(i * 6.1) * 5,
  color: PETALS[i % 7],
  lag: 0.05 + rand(i * 3.7) * 0.1,
})).filter((f) => Math.abs(f.x - 254) > 20 || f.y < 150);
const VINES = [
  [14, 24],
  [64, 16],
  [116, 40],
  [127, 64],
  [194, 66],
  [340, 30],
  [398, 40],
  [470, 28],
  [206, 112],
  [328, 112],
] as const;
const LAMPS = [108, 352] as const;
function tuft(ctx: Ctx, x: number, y: number, h: number, g: number) {
  if (g <= 0) return;
  const c = mix('#4F9A35', '#7ACC4E', rand(x));
  // Three blades as one zig-zag stroke.
  line(ctx, c, 1, [x - 3, y - h * g, x - 1, y, x, y - h * 1.3 * g, x + 1, y, x + 3, y - h * g]);
}
function flower(
  ctx: Ctx,
  x: number,
  y: number,
  h: number,
  color: string,
  g: number,
  seconds: number,
) {
  if (g <= 0) return;
  const sway = Math.sin(seconds * 1.4 + x) * 0.8;
  line(ctx, STEM, 1, [x, y, x + sway, y - h * g]);
  disc(ctx, x + sway, y - h * g, 2 * easeOut(span(g, 0.5, 1)), color);
  if (g > 0.8) box(ctx, x + sway, y - h * g, 1, 1, color === '#F2C14E' ? '#B8581E' : '#F7E08A');
}
function vine(ctx: Ctx, x: number, top: number, g: number) {
  if (g <= 0) return;
  const len = (140 - top) * g;
  const n = Math.max(1, Math.floor(len / 7));
  const pts: number[] = [];
  for (let k = 0; k <= n; k++)
    pts.push(x + Math.sin(k * 1.3 + x) * 2.5, 140 - Math.min(len, k * 7));
  line(ctx, '#3F7A36', 1.2, pts);
  for (let k = 1; k <= n; k++) {
    const side = k % 2 ? 1 : -1;
    oval(
      ctx,
      pts[k * 2] + side * 2.5,
      pts[k * 2 + 1],
      3,
      1.5,
      k % 3 ? LEAF : '#5DB04A',
      side * -0.4,
    );
    if (g > 0.6 && k % 3 === 2)
      disc(ctx, pts[k * 2] - side * 2, pts[k * 2 + 1] - 1, 1.5, PETALS[(k + x) % 7]);
  }
}
function tree(ctx: Ctx, x: number, base: number, size: number, g: number) {
  if (g <= 0) return;
  const s = size * easeOut(g),
    h = 40 * s;
  box(ctx, x - 2 * s, base - h, 4 * s + 1, h, '#7A5A3E');
  const cy = base - h;
  for (const [dx, dy, r, c] of [
    [-9, 3, 11, '#4E9A3E'],
    [9, 4, 10, '#4E9A3E'],
    [0, -6, 13, '#62B04A'],
    [-4, -2, 8, '#7ACC4E'],
  ] as const)
    oval(ctx, x + dx * s, cy + dy * s, r * s, r * 0.85 * s, c);
  if (g > 0.8)
    for (let i = 0; i < 5; i++)
      disc(
        ctx,
        x + (rand(x + i) - 0.5) * 22 * s,
        cy + (rand(x * 2 + i) - 0.5) * 14 * s,
        1.3,
        '#F7C6D9',
      );
}

function bird(
  ctx: Ctx,
  x: number,
  y: number,
  flap: number,
  facing: 1 | -1,
  color: string,
  perched = false,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  const dark = mix(color, '#1C1E26', 0.3);
  box(ctx, -5, -1, 3, 1, dark);
  oval(ctx, 0, 0, 3.2, 2.2, color);
  oval(ctx, 0.8, 0.9, 2, 1.1, '#F4D7B0');
  disc(ctx, 2.6, -1.8, 1.8, color);
  box(ctx, 4, -2, 2, 1, '#F2A93B');
  box(ctx, 3, -3, 1, 1, '#1C1A1E');
  if (perched) {
    oval(ctx, -0.5, -0.4, 2.4, 1.3, dark, 0.2);
    box(ctx, -1, 2, 1, 2, '#6A5040');
    box(ctx, 1, 2, 1, 2, '#6A5040');
  } else poly(ctx, dark, [-2, -0.5, 2, -0.5, -1, -0.5 - 5 * Math.sin(flap)]);
  ctx.restore();
}
function butterfly(ctx: Ctx, x: number, y: number, seconds: number, color: string) {
  const open = Math.abs(Math.sin(seconds * 9 + x));
  oval(ctx, x - 1.5 * open, y, 1.6 * open + 0.3, 1.4, color);
  oval(ctx, x + 1.5 * open, y, 1.6 * open + 0.3, 1.4, color);
  box(ctx, x, y - 1, 1, 2, '#3A3030');
}

/** Dust motes adrift in screen space. */
function motes(ctx: Ctx, seconds: number, amount: number, color = '#DCD2BC') {
  if (amount <= 0) return;
  for (let i = 0; i < 26; i++) {
    const x = (rand(i * 3.3) * W + seconds * (5 + rand(i) * 9)) % W;
    const y = 24 + rand(i * 5.1) * 150 + Math.sin(seconds * 0.9 + i) * 4;
    box(ctx, x, y, i % 5 ? 1 : 2, 1, alpha(color, amount * (0.3 + rand(i * 2.2) * 0.4)));
  }
}
/** Wind-driven streaks of grit for the storm. */
function streaks(ctx: Ctx, seconds: number, amount: number) {
  if (amount <= 0) return;
  for (let i = 0; i < 34; i++) {
    const x = ((rand(i * 2.7) * (W + 80) + seconds * (220 + rand(i) * 120)) % (W + 80)) - 40;
    const y = rand(i * 6.1) * H + Math.sin(seconds * 3 + i) * 3;
    box(ctx, x, y, 5 + rand(i * 9.1) * 8, 1, alpha('#A9B6C6', amount * 0.35));
  }
}

// ——— Light: the montage's fast days, the storm, the blackout, and the dawn ———
const DAYS = [
  [0.19, 0.245],
  [0.245, 0.295],
  [0.295, 0.35],
] as const;
function nightAt(p: number) {
  if (p < 0.19 || p >= 0.4) return 0;
  // The long watch: deep night, easing towards a grey morning before the storm.
  if (p >= 0.35)
    return lerp(0.5, 0.62, ease(span(p, 0.35, 0.358))) * (1 - ease(span(p, 0.387, 0.399)));
  const day = p < 0.245 ? 0 : p < 0.295 ? 1 : 2;
  const t = span(p, DAYS[day][0], DAYS[day][1]);
  return Math.max(day ? 0.42 * (1 - ease(t / 0.2)) : 0, 0.42 * ease((t - 0.8) / 0.2));
}
const stormAt = (p: number) => (p >= 0.4 && p < 0.56 ? ease(span(p, 0.4, 0.426)) : 0);
const windAt = (p: number) => (p >= 0.4 && p < 0.56 ? ease(span(p, 0.405, 0.43)) : 0);
const rainAt = (p: number) => (p >= 0.4 && p < 0.56 ? ease(span(p, 0.414, 0.434)) : 0);
const wetAt = (p: number) => ease(span(p, 0.43, 0.47)) * (1 - ease(span(p, 0.74, 0.8)));
const blackout = (p: number) =>
  p < 0.56 ? ease(span(p, 0.542, 0.558)) : 1 - ease(span(p, 0.56, 0.578));
const tallyAt = (p: number) => TALLY.reduce((n, t) => n + ease(span(p, t, t + 0.003)), 0);
const greenAt = (p: number) => span(p, GROW_FROM, GROW_TO);
function sunAt(p: number): Point | null {
  if (p < 0.19) return { x: 300, y: 42 };
  if (p < 0.35) {
    const day = p < 0.245 ? 0 : p < 0.295 ? 1 : 2;
    return sunPath(span(span(p, DAYS[day][0], DAYS[day][1]), 0.06, 0.86));
  }
  if (p < 0.56) return p < 0.4 ? null : { x: 300, y: 42 };
  if (p < 0.74) return { x: 318, y: 104 - 30 * span(p, 0.56, 0.74) };
  return { x: 318 - 40 * span(p, 0.74, 0.84), y: 74 - 40 * ease(span(p, 0.74, 0.84)) };
}

// ——— Performance: where Bolt is and what he does at every moment ———
type Take = { x: number; lift: number; pose: Pose; prop?: () => void };
const blinking = (seconds: number) => (seconds + 0.7) % 3.1 < 0.13;
function batteryAt(p: number) {
  if (p < 0.455) return 1;
  if (p < 0.645) return 1 - span(p, 0.455, POWER_DOWN);
  return span(p, 0.645, 0.72);
}
/** Powered down, folded over the bud: held from the end of the storm until his heart. */
const SLUMP = { crouch: 1, lean: 0.65, tilt: 0.5, arms: [0.7, 1.0] } as const;
/** The bottle's tilt while watering: upright, tipped over the sprout, upright again. */
const pourAt = (p: number) =>
  0.4 + 2.3 * ease(span(p, 0.247, 0.253)) * (1 - ease(span(p, 0.29, 0.294)));
/** How far the fence-building arm reaches out towards a post, and whether it holds a bolt. */
function fenceReach(p: number) {
  for (const b of FENCE)
    if (within(p, b - 0.009, b + 0.006))
      return {
        reach: ease(span(p, b - 0.005, b - 0.001)) * (1 - ease(span(p, b + 0.002, b + 0.006))),
        carrying: within(p, b - 0.006, b),
      };
  return { reach: 0, carrying: false };
}

function boltAt(ctx: Ctx, p: number, seconds: number): Take {
  const idle = Math.sin(seconds * 4) * 0.4;
  const battery = batteryAt(p);
  if (p < 0.163) {
    // Sweeping, the bump, and a long, puzzled look.
    const stopped = p >= BONK;
    const phase = p / SWEEP;
    const push = stopped
      ? 1 - 0.6 * ease(span(p, BONK + 0.01, BONK + 0.018))
      : 0.5 + 0.5 * Math.cos(phase * TAU);
    const x = 206 + 33 * Math.min(1, p / BONK);
    const peer = ease(span(p, 0.094, 0.1)) * (1 - ease(span(p, 0.146, 0.15)));
    const hop = hump(p, 0.15, 0.156);
    let glyph: Glyph = blinking(seconds) || within(p, 0.044, 0.05) ? 'blink' : 'bored';
    if (stopped) glyph = p < 0.089 ? 'wide' : p < 0.15 ? 'q' : p < 0.157 ? 'bang' : 'wide';
    const jolt = stopped ? Math.sin((p - BONK) * 900) * 1.5 * (1 - span(p, BONK, BONK + 0.01)) : 0;
    const pose: Pose = {
      arms: [0.5 + 0.25 * push, 0.85 + 0.35 * push - peer * 0.3],
      step: stopped ? undefined : phase * Math.PI,
      lean: 0.08 + push * 0.05 + peer * 0.18 - hop * 0.1,
      tilt: peer * 0.35 - hop * 0.25,
      glyph,
      gaze: within(p, 0.036, 0.056) ? [-3, 0] : peer > 0 && p < 0.15 ? [1, 1] : [0, 0],
      wobble: idle + hop * 2 + jolt,
      battery,
    };
    const lift = hop * 3;
    return {
      x,
      lift,
      pose,
      prop: () => broom(ctx, x + 15 + 6 * push, GROUND, rig(x, GROUND - lift, pose).hand),
    };
  }
  if (p < 0.19) {
    // He lays the broom down, shuffles closer, and kneels beside it.
    const walk = span(p, 0.163, 0.174);
    const down = ease(span(p, 0.172, 0.184));
    return {
      x: lerp(239, HOME, ease(walk)),
      lift: 0,
      pose: {
        crouch: down,
        lean: down * 0.3,
        tilt: 0.2 + down * 0.15,
        arms: [0.2 + down * 0.1, 0.3 + down * 0.6],
        step: walk > 0 && walk < 1 ? seconds * 12 : undefined,
        glyph: 'happy',
        wobble: idle,
        battery,
      },
    };
  }
  if (p < 0.245) {
    // Day one: the sun is harsh, so he holds his hand over the sprout all day.
    const raise = ease(span(p, 0.206, 0.213)) * (1 - ease(span(p, 0.236, 0.243)));
    const glyph: Glyph =
      p < 0.203 ? 'eyes' : p < 0.208 ? 'bang' : p < 0.216 ? 'eyes' : p < 0.238 ? 'happy' : 'blink';
    return {
      x: HOME,
      lift: 0,
      pose: {
        crouch: 0.2,
        lean: 0.1,
        tilt: 0.15,
        arms: [0.2, lerp(0.3, 1.6, raise)],
        glyph,
        gaze: glyph === 'eyes' ? [1, 1] : [0, 0],
        wobble: idle,
        battery,
      },
    };
  }
  if (p < 0.295) {
    // Day two: water, drop by drop.
    const fresh = DROPS.some((d) => within(p, d, d + 0.006));
    const pose: Pose = {
      crouch: 0.1,
      lean: 0.12,
      tilt: 0.3,
      arms: [0.3, 2.2],
      glyph: fresh ? 'happy' : 'eyes',
      gaze: fresh ? [0, 0] : [1, 2],
      wobble: idle,
      battery,
    };
    return {
      x: HOME,
      lift: 0,
      pose,
      prop: () => bottle(ctx, rig(HOME, GROUND, pose).hand, pourAt(p)),
    };
  }
  if (p < 0.35) {
    // Day three: a little fence of bolts, one post at a time.
    const { reach, carrying } = fenceReach(p);
    const pose: Pose = {
      crouch: 1,
      lean: 0.35,
      tilt: 0.3,
      arms: [0.2, lerp(0.25, 1.3, reach)],
      glyph: p > FENCE[3] + 0.003 ? 'happy' : 'eyes',
      gaze: [1, 2],
      wobble: idle,
      battery,
    };
    return {
      x: HOME,
      lift: 0,
      pose,
      prop: carrying
        ? () => {
            const hand = rig(HOME, GROUND, pose).hand;
            nut(ctx, hand.x, hand.y + 3);
          }
        : undefined,
    };
  }
  if (p < 0.4) {
    // The long watch, with his antenna for a night light. He nods off once.
    const doze = ease(span(p, 0.36, 0.368)) * (1 - ease(span(p, 0.3705, 0.3725)));
    const jolt = hump(p, 0.3705, 0.376);
    const glyph: Glyph =
      p < 0.36 ? 'eyes' : p < 0.3705 ? 'blink' : p < 0.377 ? 'wide' : p < BUD ? 'eyes' : 'happy';
    return {
      x: HOME,
      lift: 0,
      pose: {
        crouch: 1,
        lean: 0.08 + doze * 0.2,
        tilt: 0.1 + doze * 0.4 - jolt * 0.2,
        arms: [0.1, 0.35],
        glyph,
        gaze: glyph === 'eyes' ? [1, 1] : [0, 0],
        light: 1 - doze * 0.6,
        wobble: idle + jolt * 3,
        battery,
      },
    };
  }
  if (p < 0.445) {
    // The storm comes: he fetches the old umbrella from the wall and opens it over the bud.
    const rise = ease(span(p, 0.4, 0.407));
    const out = span(p, 0.413, 0.425),
      back = span(p, 0.429, 0.439);
    const x = p < 0.429 ? lerp(HOME, 203, ease(out)) : lerp(203, HOME, ease(back));
    const walking = (out > 0 && out < 1) || (back > 0 && back < 1);
    const grab = hump(p, 0.424, 0.429);
    const lookUp = within(p, 0.408, 0.416);
    const hold = p >= 0.427;
    const raise = ease(span(p, 0.437, OPEN_UMBRELLA));
    const pose: Pose = {
      facing: p >= 0.413 && p < 0.429 ? -1 : 1,
      crouch: 1 - rise,
      lean: grab * 0.35,
      tilt: lookUp ? -0.35 : 0,
      arms: [0.2, hold ? lerp(0.8, 2.0, raise) : 0.3 + grab * 0.5],
      step: walking ? seconds * 12 : undefined,
      glyph: p < 0.408 ? 'eyes' : p < 0.413 ? 'bang' : p < 0.416 ? 'wide' : 'brave',
      gaze: lookUp ? [1, -2] : [0, 0],
      wobble: idle + Math.sin(seconds * 9) * windAt(p),
      battery,
    };
    return {
      x,
      lift: 0,
      pose,
      prop: hold
        ? () => {
            const hand = rig(x, GROUND, pose).hand;
            const open = ease(span(p, 0.439, OPEN_UMBRELLA));
            // Carried by its hook, then raised and snapped open over the bud.
            if (open <= 0) furled(ctx, hand.x - 3, hand.y + 25, 0.08 * Math.sin(seconds * 9));
            else umbrella(ctx, hand.x, hand.y, lerp(0.1, 0.35, raise), open);
          }
        : undefined,
    };
  }
  if (p < 0.48) {
    // The wind takes the umbrella. He looks after it, then down at the bud.
    const ripped = p >= RIP;
    const curl = ease(span(p, 0.47, 0.48));
    const startled = within(p, RIP, 0.471);
    const pose: Pose = {
      crouch: 0.5 + curl * 0.5,
      lean: 0.15 + curl * 0.25,
      tilt: startled ? -0.3 : curl * 0.55,
      arms: ripped ? [lerp(0.4, 1.1, curl), lerp(2.2, 1.55, curl)] : [0.4, 2.0],
      glyph: !ripped ? 'brave' : p < 0.467 ? 'bang' : startled ? 'wide' : 'brave',
      gaze: startled ? [2, -2] : [1, 1],
      wobble: Math.sin(seconds * 9) * 1.5,
      battery,
    };
    const strain = ease(span(p, 0.452, RIP));
    return {
      x: HOME,
      lift: 0,
      pose,
      prop: ripped
        ? undefined
        : () => {
            const hand = rig(HOME, GROUND, pose).hand;
            umbrella(ctx, hand.x, hand.y, 0.35 + Math.sin(seconds * 5) * 0.08 + strain * 0.5, 1);
          },
    };
  }
  if (p < 0.56) {
    // Curled around the bud, running down. Then he powers off and slumps.
    const slump = ease(span(p, 0.54, 0.55));
    const off = ease(span(p, POWER_DOWN, POWER_DOWN + 0.008));
    const shiver = p < POWER_DOWN ? Math.sin(seconds * 23) * 0.25 : 0;
    const glyph: Glyph = p < LOW_BATTERY ? 'brave' : 'battery';
    return {
      x: HOME + shiver,
      lift: 0,
      pose: {
        crouch: 1,
        lean: lerp(0.4, SLUMP.lean, slump),
        tilt: lerp(0.55, SLUMP.tilt, slump),
        arms: [lerp(1.1, SLUMP.arms[0], slump), lerp(1.55, SLUMP.arms[1], slump)],
        glyph,
        gaze: glyph === 'brave' ? [1, 1] : [0, 0],
        screen: (0.88 + 0.12 * Math.sin(seconds * 2.4)) * (1 - off),
        light:
          (0.55 + 0.25 * Math.sin(seconds * 1.9)) *
          ease(span(p, 0.48, 0.49)) *
          (1 - ease(span(p, 0.534, 0.545))),
        battery,
        wobble: Math.sin(seconds * 8) * 1.2 * (1 - slump),
      },
    };
  }
  if (p < 0.68) {
    // Dawn. Nothing, then a petal, a glint of sun, three dots, and a heart.
    const lift = ease(span(p, HEART, HEART + 0.01));
    const shown = DOTS.filter((d) => p >= d).length;
    return {
      x: HOME,
      lift: 0,
      pose: {
        ...SLUMP,
        tilt: SLUMP.tilt - lift * 0.25,
        glyph: p >= HEART ? 'heart' : shown ? 'dots' : 'off',
        dots: shown,
        screen: p >= HEART ? 1 : ease(span(p, DOTS[0], DOTS[0] + 0.004)),
        light: ease(span(p, HEART, HEART + 0.01)) * 0.7,
        battery,
        wobble: lift * idle,
      },
    };
  }
  if (p < 0.84) {
    // He sits up to see his flower, and watches its seeds carry the colour away.
    const up = ease(span(p, SIT_UP, SIT_UP + 0.012));
    const amazed = within(p, 0.785, 0.805);
    return {
      x: HOME,
      lift: 0,
      pose: {
        crouch: 1,
        lean: lerp(SLUMP.lean, 0, up),
        tilt: lerp(0.25, p < 0.72 ? -0.3 : -0.1, up),
        arms: [lerp(0.7, 0.2, up), lerp(1.0, 0.5, up)],
        glyph: p < 0.69 ? 'heart' : within(p, SEEDS, SEEDS + 0.008) || amazed ? 'wide' : 'happy',
        gaze:
          p < SEEDS ? [0, -1] : p < 0.72 ? [-1, -2] : [Math.round(Math.sin(seconds * 0.6) * 2), -1],
        light: 0.6,
        battery,
        wobble: idle + hump(p, SIT_UP, SIT_UP + 0.012) * 2,
      },
    };
  }
  if (p < 0.905) {
    // Gardening now: the same strokes as the sweeping, but they finally mean something.
    const sit = ease(span(p, 0.89, 0.9));
    const push = 0.5 + 0.5 * Math.cos(((p - RAKES[0]) / (1.2 / STORY)) * TAU);
    const x = HOME - 8 + sit * 8;
    const pose: Pose = {
      crouch: sit,
      lean: 0.1 * (1 - sit),
      tilt: 0.1,
      arms: [lerp(0.5 + 0.25 * push, 0.3, sit), lerp(0.85 + 0.35 * push, 1.0, sit)],
      glyph: 'happy',
      light: 0.5,
      battery,
      wobble: idle,
    };
    return {
      x,
      lift: 0,
      pose,
      prop: () =>
        broom(ctx, lerp(x + 15 + 6 * push, x + 14, sit), GROUND, rig(x, GROUND, pose).hand, true),
    };
  }
  // A bird lands on his antenna. He looks up, fills with love, and smiles.
  const lookUp = within(p, 0.918, LOVE);
  const glyph: Glyph = p < 0.918 ? 'happy' : lookUp ? 'eyes' : p < 0.958 ? 'heart' : 'smile';
  const pose: Pose = {
    crouch: 1,
    lean: 0.05,
    tilt: lookUp ? -0.3 : 0,
    arms: [0.3, 1.0],
    glyph,
    gaze: lookUp ? [0, -2] : [0, 0],
    light: 0.5,
    battery,
    wobble:
      p < PERCH ? idle : Math.sin((p - PERCH) * 700) * 2 * (1 - span(p, PERCH, PERCH + 0.012)),
  };
  return {
    x: HOME,
    lift: 0,
    pose,
    prop: () => broom(ctx, HOME + 14, GROUND, rig(HOME, GROUND, pose).hand, true),
  };
}

function growthAt(p: number, seconds: number): Growth {
  if (p < 0.56) {
    const wind = windAt(p) * (1 - span(p, 0.47, 0.48) * 0.8);
    let grow = 0.06;
    if (p >= 0.245) grow = 0.1 + DROPS.reduce((g, d) => g + 0.05 * ease(span(p, d, d + 0.004)), 0);
    if (p >= 0.295) grow = 0.3 + 0.15 * span(p, 0.295, 0.35);
    if (p >= 0.35) grow = 0.45 + 0.35 * ease(span(p, 0.355, BUD));
    if (p >= 0.4) grow = 0.8 + 0.04 * span(p, 0.4, 0.52);
    const wilt = within(p, 0.19, 0.245)
      ? ease(span(p, 0.195, 0.203)) * (1 - ease(span(p, 0.212, 0.22)))
      : 0;
    return {
      grow,
      droop: wilt,
      sway:
        hump(p, BONK, BONK + 0.006) * 2 +
        Math.sin(seconds * (wind > 0 ? 6 : 1.3)) * (0.3 + wind * 2) +
        wind * 1.5,
    };
  }
  const rise = ease(span(p, 0.572, 0.6));
  return {
    grow: 0.84 + 0.16 * rise,
    open: ease(span(p, 0.578, 0.602)),
    rise: 24 * rise,
    bend: 22 * rise,
    sway: Math.sin(seconds * 1.1) * 1.2 * rise,
    puff: p < SEEDS ? ease(span(p, 0.69, 0.698)) : 1 - ease(span(p, SEEDS, SEEDS + 0.004)),
    missing: p >= PETAL,
  };
}

// ——— Little things that happen around him ———
function waterDrop(ctx: Ctx, x: number, y: number, swell = 1) {
  const s = Math.max(0.4, swell);
  box(ctx, x - 1, y - 2 * s, 2, 2 * s, '#BFE6F5');
  box(ctx, x - 1.5 * s, y - 1, 3 * s, 3, '#8FC3DA');
  box(ctx, x - 1, y, 1, 1, '#FFFFFF');
}
function drops(ctx: Ctx, p: number, take: Take, growth: Growth) {
  if (!within(p, 0.245, 0.295)) return;
  const mouth = mouthOf(rig(HOME, GROUND, take.pose).hand, pourAt(p));
  const top = GROUND - 4 - 16 * growth.grow;
  for (const d of DROPS) {
    if (!within(p, d - 0.009, d + 0.005)) continue;
    if (p < d - 0.004) waterDrop(ctx, mouth.x, mouth.y + 1, span(p, d - 0.009, d - 0.004));
    else if (p < d) waterDrop(ctx, mouth.x, lerp(mouth.y + 1, top, easeIn(span(p, d - 0.004, d))));
    else {
      const t = span(p, d, d + 0.005);
      box(ctx, PLANT - 2 - t * 6, top - hump(t, 0, 1) * 5, 1, 1, '#CFEFFA');
      box(ctx, PLANT + 2 + t * 6, top - hump(t, 0, 1) * 5, 1, 1, '#CFEFFA');
    }
  }
}
function fence(ctx: Ctx, p: number) {
  FENCE.forEach((b, i) => {
    if (p < b) return;
    const pop = backOut(span(p, b, b + 0.004));
    ctx.save();
    ctx.translate(PLANT + FENCE_X[i], GROUND + 1);
    ctx.scale(1, pop);
    nut(ctx, 0, 0);
    ctx.restore();
  });
  // Once the last post is in, he strings a wire between them.
  const wire = span(p, FENCE[3] + 0.002, FENCE[3] + 0.006);
  if (wire > 0) line(ctx, '#C9C3B6', 1, [PLANT - 8, GROUND - 3, PLANT - 8 + 15 * wire, GROUND - 3]);
}
function pile(ctx: Ctx, p: number) {
  // Spare bolts beside him; one fewer after each post.
  const left = 4 - FENCE.filter((b) => p >= b - 0.006).length;
  for (let i = 0; i < left + 1; i++)
    nut(ctx, 247 + (i % 3) * 3, GROUND + 3 - Math.floor(i / 3) * 2);
}
function gust(ctx: Ctx, p: number) {
  // The wind blows the swept dust straight back over the pavement.
  const t = span(p, 0.028, 0.06);
  if (t <= 0 || t >= 1) return;
  const front = 110 + t * 250,
    amount = hump(t, 0, 1);
  for (let j = 0; j < 10; j++) {
    const x = front - j * 15;
    oval(ctx, x, 148 + (j % 3) * 6, 22, 8, alpha('#D8CDB6', 0.5 * (1 - j / 10) * amount));
  }
}
const SEED_PATHS = Array.from({ length: 18 }, (_, i) => ({
  delay: i * 0.0016,
  x: 20 + rand(i * 7.3 + 4) * 440,
  y: 26 + rand(i * 3.9 + 1) * 96,
}));
function seeds(ctx: Ctx, p: number, seconds: number) {
  if (!within(p, SEEDS, 0.84)) return;
  for (const s of SEED_PATHS) {
    const t = span(p, SEEDS + s.delay, SEEDS + s.delay + 0.1);
    if (t <= 0 || t >= 1) continue;
    const x = lerp(284, s.x, ease(t)) + Math.sin(seconds * 2 + s.x) * 5 * t;
    const y = lerp(112, s.y, easeOut(t)) - Math.sin(Math.PI * t) * 26;
    faded(ctx, 1 - ease(span(t, 0.85, 1)), () => fluff(ctx, x, y, p < 0.72 ? 1 : 1.6));
  }
}
function petal(ctx: Ctx, p: number, take: Take) {
  if (p < PETAL) return;
  const panel = rig(take.x, GROUND - take.lift, take.pose).panel;
  const t = span(p, PETAL, LANDS);
  const settled = (take.pose.lean ?? 0) + (take.pose.tilt ?? 0);
  const x = lerp(287, panel.x, t) + Math.sin(t * 9) * 4 * (1 - t);
  const y = lerp(120, panel.y - 1.5, t);
  oval(ctx, x, y, 3.6, 1.8, RED, t < 1 ? Math.sin(t * 9) * 0.8 : settled);
  oval(ctx, x, y - 0.4, 2.2, 0.8, '#F07A60', t < 1 ? Math.sin(t * 9) * 0.8 : settled);
}
const FLOCK = [
  [0.846, '#4A90D9'],
  [0.856, '#F2C14E'],
] as const;
function birds(ctx: Ctx, p: number, seconds: number, take: Take) {
  if (p < 0.84) return;
  // One settles on the wall; two more circle over the rooftops.
  const settle = span(p, FLOCK[0][0], FLOCK[0][0] + 0.025);
  if (settle > 0)
    bird(
      ctx,
      lerp(430, 302, easeOut(settle)),
      lerp(50, 107, ease(settle)) - hump(settle, 0, 1) * 8,
      seconds * 20,
      -1,
      FLOCK[0][1],
      settle >= 1,
    );
  for (let i = 0; i < 2; i++) {
    const t = ((p - FLOCK[1][0]) * STORY * 36 + i * 170) % 560;
    if (p < FLOCK[1][0] && i === 0) continue;
    bird(
      ctx,
      500 - t,
      34 + i * 16 + Math.sin(seconds * 2 + i) * 5,
      seconds * 18 + i,
      -1,
      i ? '#E57A5A' : FLOCK[1][1],
    );
  }
  // And one lands on his antenna.
  if (p < 0.905) return;
  const tip = rig(take.x, GROUND - take.lift, take.pose).tip;
  const t = span(p, 0.905, PERCH);
  if (t < 1)
    bird(
      ctx,
      lerp(tip.x + 70, tip.x, easeOut(t)),
      lerp(tip.y - 46, tip.y - 3, ease(t)),
      seconds * 22,
      -1,
      '#E57A5A',
    );
  else bird(ctx, tip.x, tip.y - 3, 0, -1, '#E57A5A', true);
}

function world(ctx: Ctx, p: number, seconds: number, view: View, take: Take, growth: Growth) {
  const green = greenAt(p);
  const bands = skyBands(p, green);
  const blue = ease(span(green, 0.15, 0.85));
  backdrop(ctx, bands, view);
  const sun = sunAt(p);
  const harsh = p >= 0.19 && p < 0.35;
  if (sun) {
    glow(ctx, sun.x, sun.y, harsh ? 50 : 38, p >= 0.56 ? '#FFE2A8' : '#FFF8E6', harsh ? 0.55 : 0.4);
    disc(
      ctx,
      sun.x,
      sun.y,
      harsh ? 6 : 5,
      p >= 0.56 ? '#FFF1C8' : alpha('#FBF6EA', harsh ? 1 : 0.7),
    );
  }
  clouds(ctx, p, seconds, blue);
  skyline(ctx, view, green, p >= 0.56 ? 1 - blue : 0);
  const grown = (x: number, lag: number) => ease(span(green, reach(x) + lag, reach(x) + lag + 0.3));
  tree(ctx, 222, 140, 1, grown(222, 0.05));
  tree(ctx, 316, 140, 0.85, grown(316, 0.08));
  for (const b of BLOCKS) block(ctx, b, green);
  billboard(ctx, green);
  for (const [x, top] of VINES) if (top < 100) vine(ctx, x, top, grown(x, 0.02));
  wall(ctx, green, tallyAt(p));
  for (const [x, top] of VINES) if (top >= 100) vine(ctx, x, top, grown(x, 0));
  pavement(ctx, green, wetAt(p), bands[3], seconds, rainAt(p));
  for (const x of LAMPS) {
    lamp(ctx, x, bloomAt(green, x));
    vine(ctx, x, 70, grown(x, 0.1));
  }
  tree(ctx, 150, 150, 0.8, grown(150, 0.1));
  tree(ctx, 446, 150, 0.9, grown(446, 0.05));
  for (const t of TUFTS) if (t.y < 150) tuft(ctx, t.x, t.y, t.h, grown(t.x, t.lag));
  for (const f of FLORA)
    if (f.y < 150) flower(ctx, f.x, f.y, f.h, f.color, grown(f.x, f.lag), seconds);
  // Props on the pavement.
  if (p >= 0.163 && p < 0.84) brush(ctx);
  if (p < 0.427) furled(ctx, 193, 149, 0.2);
  if (within(p, 0.295, 0.35)) pile(ctx, p);
  if (harsh && within(p, 0.19, 0.245) && sun) {
    // Day one's glare: it beats down on the sprout until his hand takes it instead.
    const hand = rig(take.x, GROUND, take.pose).hand;
    const shaded = (take.pose.arms?.[1] ?? 0) > 1;
    const tx = shaded ? hand.x : PLANT,
      ty = shaded ? hand.y : GROUND - 4;
    poly(ctx, alpha('#FFF6D8', 0.2 * (1 - nightAt(p) * 2)), [
      sun.x - 4,
      sun.y,
      sun.x + 4,
      sun.y,
      tx + 5,
      ty,
      tx - 5,
      ty,
    ]);
    if (shaded) oval(ctx, PLANT, GROUND - 3, 9, 6, alpha('#3A3530', 0.25));
  }
  const cast = sun && p < 0.56 ? clamp((take.x - sun.x) * 0.12, -9, 9) : 0;
  shade(ctx, take.x + 2 + cast, GROUND + 1, 26, 0.28);
  plant(ctx, PLANT, GROUND, growth);
  if (p >= FENCE[0]) fence(ctx, p);
  bolt(ctx, take.x, GROUND - take.lift, take.pose, 'body', take.prop);
  drops(ctx, p, take, growth);
  petal(ctx, p, take);
  if (within(p, RIP, RIP + 0.02)) {
    const t = span(p, RIP, RIP + 0.02);
    umbrella(
      ctx,
      262 + easeIn(t) * 160,
      134 - easeOut(t) * 70 + Math.sin(t * 10) * 4,
      0.9 + t * 8,
      1,
      true,
    );
  }
  for (const t of TUFTS) if (t.y >= 150) tuft(ctx, t.x, t.y, t.h, grown(t.x, t.lag));
  for (const f of FLORA)
    if (f.y >= 150) flower(ctx, f.x, f.y, f.h, f.color, grown(f.x, f.lag), seconds);
  if (green > 0.6)
    for (let i = 0; i < 3; i++)
      butterfly(
        ctx,
        [168, 302, 356][i] + Math.sin(seconds * 0.7 + i * 2) * 22,
        158 - Math.abs(Math.sin(seconds * 1.3 + i)) * 10,
        seconds,
        ['#F2C14E', '#F28AB2', '#FFFFFF'][i],
      );
  gust(ctx, p);
  seeds(ctx, p, seconds);
}
function clouds(ctx: Ctx, p: number, seconds: number, blue: number) {
  if (p < 0.4 || p >= 0.56) {
    // Haze in the grey city; fair-weather clouds racing through the time-lapse, then drifting.
    const race = span(p, GROW_FROM, GROW_TO) * 260 + seconds * 2;
    for (let i = 0; i < 6; i++) {
      const x = ((i * 97 + race) % 560) - 40;
      oval(
        ctx,
        x,
        16 + (i % 3) * 9,
        30,
        7,
        alpha(mix('#D8D2C6', '#FFFFFF', blue), 0.35 + blue * 0.5),
      );
      oval(
        ctx,
        x + 12,
        12 + (i % 3) * 9,
        16,
        6,
        alpha(mix('#DDD8CC', '#FFFFFF', blue), 0.35 + blue * 0.5),
      );
    }
    return;
  }
  // The storm bank rolls in from the left and swallows the sky.
  const roll = easeOut(span(p, 0.398, 0.432));
  for (let i = 0; i < 12; i++) {
    const x = i * 44 - 30 - (1 - roll) * 560 + Math.sin(seconds * 0.4 + i) * 4;
    oval(ctx, x, 14 + (i % 3) * 16, 40, 20, i % 2 ? '#3E4652' : '#343B46');
    oval(ctx, x + 20, 58 + (i % 2) * 12, 34, 16, '#474F5B');
  }
}

function lights(ctx: Ctx, p: number, seconds: number, take: Take, night: number, storm: number) {
  if (night > 0.05) {
    for (let i = 0; i < 22; i++) {
      const twinkle = 0.55 + 0.45 * Math.sin(seconds * (0.8 + rand(i) * 1.2) + i * 2.1);
      box(
        ctx,
        200 + rand(i * 4.1) * 136,
        8 + rand(i * 6.7) * 88,
        1,
        1,
        alpha('#E8ECF4', night * twinkle),
      );
    }
    if (within(p, 0.35, 0.4)) {
      // During the long watch the moon wheels over again and again.
      const moon = sunPath((((p - 0.35) / 0.05) * 2.2) % 1);
      if (moon.y < 96) {
        glow(ctx, moon.x, moon.y, 24, '#DDE4F2', 0.3 * night);
        disc(ctx, moon.x, moon.y, 4, '#EDEBDD');
        box(ctx, moon.x - 1, moon.y - 1, 2, 1, '#CFCBBE');
      }
    }
  }
  for (const t of THUNDER) {
    const k = hump(p, t, t + 0.025);
    if (k > 0) glow(ctx, 180, 36, 110, '#9FB4D6', 0.22 * k);
  }
  const r = rig(take.x, GROUND - take.lift, take.pose);
  bolt(ctx, take.x, GROUND - take.lift, take.pose, 'lights');
  const light = take.pose.light ?? 0;
  if (light > 0 && (night > 0 || storm > 0)) glow(ctx, PLANT, GROUND - 8, 30, AMBER, 0.2 * light);
  for (const s of SPARKS) {
    const t = span(p, s, s + 0.008);
    if (t <= 0 || t >= 1) continue;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (rand(s * 100 + i) - 0.5) * 2.4,
        v = 6 + rand(i + s * 50) * 6;
      box(
        ctx,
        r.neck.x + Math.cos(a) * v * t,
        r.neck.y + Math.sin(a) * v * t + 14 * t * t,
        1,
        1,
        alpha('#FFD36A', 1 - t),
      );
    }
    glow(ctx, r.neck.x, r.neck.y, 8, '#FFD36A', 0.25 * (1 - t));
  }
  if (within(p, 0.56, 0.84)) glow(ctx, 330, 96, 190, '#FFD9A0', 0.2 * (1 - greenAt(p)));
  if (within(p, LANDS, 0.7)) {
    // A sunbeam finds the solar panel, it glints, and the panel starts to charge.
    const beam = ease(span(p, LANDS, LANDS + 0.012)) * (1 - ease(span(p, 0.68, 0.7)));
    const { x, y } = r.panel;
    poly(ctx, alpha('#FFF1C4', 0.22 * beam), [
      x + 50,
      y - 90,
      x + 64,
      y - 90,
      x + 4,
      y + 2,
      x - 4,
      y,
    ]);
    const glint = hump(p, GLINT - 0.004, GLINT + 0.012);
    if (glint > 0) {
      glow(ctx, x, y, 10, '#FFF6D0', 0.5 * glint);
      box(ctx, x - 5 * glint, y - 0.5, 10 * glint, 1, '#FFFFFF');
      box(ctx, x - 0.5, y - 5 * glint, 1, 10 * glint, '#FFFFFF');
    }
    glow(ctx, x, y, 9, SCREEN, 0.3 * ease(span(p, GLINT, GLINT + 0.01)) * beam);
  }
  birds(ctx, p, seconds, take);
}

// ——— The close-up: what the broom bumped into ———
const CRACK = [
  0, 124, 34, 121, 66, 127, 98, 123, 128, 128, 150, 125, 168, 129, 196, 124, 226, 128, 258, 123,
  290, 126, 320, 122,
];
const LIP = CRACK.map((v, i) => (i % 2 ? v + 6 + rand(i) * 4 : v));
function macro(ctx: Ctx, p: number, seconds: number) {
  const t = span(p, CUTS[2], CUTS[3]);
  camera(ctx, { x: 160 + t * 3, y: 96 + t * 8, zoom: 1 + t * 0.22 }, () => {
    // Out of focus behind: the grey city as soft shapes under a hazy sun.
    box(ctx, 0, 0, W, 90, '#9E988C');
    box(ctx, 0, 0, W, 34, '#AAA498');
    for (let i = 0; i < 6; i++)
      oval(ctx, 10 + i * 62, 44 + (i % 2) * 8, 34, 30, alpha('#7E796F', 0.35));
    glow(ctx, 250, 20, 70, '#FFF6E0', 0.35);
    // The pavement, close enough to see its grit.
    poly(ctx, '#938D83', [0, 80, W, 72, W, H, 0, H]);
    poly(ctx, '#A09A8F', [0, 80, W, 72, W, 78, 0, 86]);
    for (let i = 0; i < 46; i++)
      box(
        ctx,
        rand(i * 2.3) * W,
        86 + rand(i * 4.7) * 94,
        1 + (i % 3),
        1,
        i % 2 ? '#827C72' : '#A7A195',
      );
    const lip: number[] = [];
    for (let i = LIP.length - 2; i >= 0; i -= 2) lip.push(LIP[i], LIP[i + 1]);
    poly(ctx, '#3A3632', [...CRACK, ...lip]);
    line(ctx, '#B3ADA2', 1, LIP);
    glow(ctx, 162, 112, 58, '#EEF8D0', 0.24);
    plant(ctx, 162, 129, { grow: 0.06, sway: Math.sin(seconds * 1.4) * 0.25 }, 5);
    for (const [x, y] of [
      [140, 131],
      [186, 130],
      [118, 150],
      [214, 146],
    ])
      oval(ctx, x, y, 3, 2, '#7C766C');
    // His broom, pulled back at the edge of frame.
    poly(ctx, '#B39A68', [-12, 142, 40, 148, 34, 106, -12, 100]);
    for (let i = 0; i < 5; i++) line(ctx, '#8E784E', 1, [i * 9 - 6, 104 + i, i * 10 - 4, 145 + i]);
    box(ctx, -12, 90, 46, 14, '#6C5C4A');
    // Bolt leans in: his shadow slides over the top of the frame.
    const lean = ease(span(p, 0.12, 0.14));
    oval(ctx, 110, 20 - 40 * (1 - lean), 150, 70, alpha('#2A2622', 0.22 * lean));
    for (let i = 0; i < 10; i++) {
      const x = 120 + rand(i * 3) * 90 + Math.sin(seconds * 0.7 + i) * 6;
      const y = 60 + ((rand(i * 5) * 80 + seconds * 4) % 80);
      box(ctx, x, y, 1, 1, alpha('#F4F0DC', 0.6));
    }
  });
  vignette(ctx, 0.55);
}

// Camera keyframes: [p, x, y, zoom]. Two keys at one p are a hard cut.
const CAMERA = [
  [0, 236, 90, 1],
  [0.02, 236, 90, 1],
  [0.062, 226, 118, 1.5],
  [0.062, 246, 140, 2.5],
  [0.105, 250, 140, 2.8],
  [0.145, 244, 124, 3.2],
  [0.163, 244, 125, 3.3],
  [0.19, 254, 138, 2.4],
  [0.19, 262, 116, 1.45],
  [0.245, 258, 118, 1.5],
  [0.245, 258, 136, 2.6],
  [0.295, 258, 138, 2.8],
  [0.295, 270, 134, 2.2],
  [0.35, 268, 134, 2.3],
  [0.35, 262, 112, 1.35],
  [0.4, 258, 114, 1.45],
  [0.4, 250, 98, 1.1],
  [0.445, 246, 108, 1.3],
  [0.445, 258, 128, 2.2],
  [0.48, 256, 130, 2.3],
  [0.48, 258, 142, 3.0],
  [0.52, 258, 142, 3.3],
  [0.52, 262, 146, 3.6],
  [0.535, 262, 146, 3.6],
  [0.56, 254, 128, 1.8],
  [0.56, 258, 108, 1.15],
  [0.575, 258, 108, 1.15],
  [0.605, 266, 132, 2.4],
  [0.605, 274, 132, 3.4],
  [0.68, 272, 132, 3.8],
  [0.68, 262, 126, 2.3],
  [0.7, 262, 124, 2.3],
  [0.72, 262, 96, 2.0],
  [0.72, 262, 90, 1],
  [0.77, 170, 90, 1],
  [0.84, 320, 90, 1],
  [0.84, 250, 128, 2.0],
  [0.905, 252, 130, 2.1],
  [0.905, 252, 124, 3.2],
  [0.95, 252, 124, 3.4],
  [1, 256, 104, 1.2],
] as const;

function street(ctx: Ctx, p: number, seconds: number) {
  const view = track(p, CAMERA);
  const take = boltAt(ctx, p, seconds);
  const growth = growthAt(p, seconds);
  const night = nightAt(p),
    storm = stormAt(p);
  camera(ctx, view, () => world(ctx, p, seconds, view, take, growth), WORLD);
  veil(ctx, '#0C1428', night);
  veil(ctx, '#081120', storm * 0.6);
  camera(ctx, view, () => lights(ctx, p, seconds, take, night, storm), WORLD);
  motes(ctx, seconds, p < 0.4 ? 1 - night : 0);
  motes(ctx, seconds, greenAt(p) * 0.8, '#FFF3B0');
  streaks(ctx, seconds, windAt(p) * (1 - span(p, 0.47, 0.5) * 0.5));
  const rain = rainAt(p);
  if (rain > 0)
    rainfall(ctx, seconds, {
      amount: rain * 1.1,
      slant: 0.45,
      speed: 240,
      color: '#8FA4BC',
      length: 8,
    });
  vignette(ctx, 0.3 + storm * 0.25 + (within(p, 0.56, 0.68) ? 0.15 : 0) - greenAt(p) * 0.12);
}

const CAPTIONS = [
  [0.008, 0.06, 'Nothing grew here anymore.'],
  [0.11, 0.158, 'Well... almost nothing.'],
  [0.196, 0.244, 'Bolt had a new job.'],
  [0.492, 0.54, 'He held on as long as he could.'],
  [0.755, 0.83, 'And then, everything grew.'],
] as const;

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const boltAndTheBloomScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: 57, voice: 'bell', intro: [19, 24, 22], outro: [0, 7, 12, 16] },
    (s) => {
      const beat = (i: number) => WALTZ + i * BEAT;
      // Act one: a lonely music box over dusty wind; every stroke of the broom squeaks.
      s.fx('wind', 0, s.story * 0.4, 0.07);
      s.section({
        from: 0,
        to: 0.105,
        bpm: 80,
        root: 57,
        minor: true,
        chords: [0, 5, 0, 7],
        melody: [19, null, 24, 22, 19, null, null, null, 17, null, 19, 15, 12, null, null, null],
        voice: 'bell',
        gain: 0.8,
        level: 0.45,
        bass: false,
      });
      for (const t of STROKES) s.fx('squeak', t, 0.25, 0.07, -0.1);
      s.fx('swish', 0.028, 1.8, 0.12, -0.5);
      s.fx('knock', BONK, 0.15, 0.1);
      s.fx('boing', BONK + 0.002, 0.35, 0.05, 0.2);
      // "?": a questioning lilt.
      s.fx('beep', 0.089, 0.1, 0.05);
      s.note(0.089, 76, 0.15, 'pluck', 0.07);
      s.note(0.092, 81, 0.3, 'pluck', 0.07);
      // The close-up: a held breath of wonder.
      s.chord(0.105, [60, 64, 67, 72], s.story * 0.045, 'pad', 0.05);
      s.fx('chime', 0.108, 1.6, 0.08, 0.2);
      s.fx('sparkle', 0.114, 1.2, 0.05, -0.2);
      // "!", a hop, and down he kneels.
      s.fx('beep', 0.15, 0.45, 0.07);
      s.fx('whir', 0.172, 0.6, 0.08);
      s.section({
        from: 0.145,
        to: 0.19,
        bpm: 90,
        root: 60,
        chords: [0],
        level: 0.35,
        bass: false,
      });
      // The montage: a tender waltz; the water drops and the fence bolts play its tune.
      s.section({
        from: 0.19,
        to: 0.4,
        bpm: 90,
        root: 60,
        chords: [0, 5, 7, 0, 5, 0, 7, 7],
        groove: 'waltz',
        level: 0.6,
        fade: 0.6,
      });
      [7, 12, 11, 7, 4].forEach((d, i) => s.note(beat(i), 72 + d, 0.6, 'keys', 0.1));
      DROPS.forEach((d, i) => {
        s.note(d, 72 + [5, 4, 2, 0][i], 1.2, 'bell', 0.11, 0.2);
        s.fx('drip', d, 0.2, 0.08, 0.2);
      });
      FENCE.forEach((b, i) => {
        s.note(b, 72 + [12, 14, 16, 19][i], 0.5, 'pluck', 0.1, (FENCE_X[i] / 10) * 0.5);
        s.fx('click', b, 0.08, 0.1, 0.2);
      });
      [16, null, 12, 7].forEach(
        (d, i) => d !== null && s.note(beat(13 + i), 72 + d, 1.2, 'bell', 0.07),
      );
      s.fx('beep', 0.203, 0.1, 0.04);
      s.fx('rustle', 0.212, 0.5, 0.05, 0.2);
      for (const t of TALLY) s.fx('scribble', t, 0.25, 0.07, 0.4);
      s.fx('hum', 0.35, s.story * 0.05, 0.025);
      s.fx('yawn', 0.36, 0.7, 0.07);
      s.fx('boing', 0.3705, 0.4, 0.07);
      s.fx('chime', BUD, 1.4, 0.09, 0.2);
      // The storm: wind, rain, thunder with no flash, and a minor drive.
      s.fx('whir', 0.4, 0.5, 0.07);
      s.fx('wind', 0.4, s.story * 0.16, 0.16, -0.2);
      for (const t of THUNDER) s.fx('thunder', t, 3.5, 0.22, -0.3);
      s.fx('rain', 0.414, s.story * 0.146, 0.14);
      for (let i = 0; i < 4; i++) {
        s.fx('step', 0.414 + i * 0.0028, 0.1, 0.07, -0.3);
        s.fx('step', 0.43 + i * 0.0024, 0.1, 0.07, -0.1);
      }
      s.fx('pop', OPEN_UMBRELLA, 0.2, 0.12);
      s.fx('creak', 0.452, 0.8, 0.08);
      s.fx('swish', RIP, 0.6, 0.18, 0.4);
      s.fx('flutter', RIP, 0.8, 0.1, 0.6);
      s.section({
        from: 0.405,
        to: 0.52,
        bpm: 120,
        root: 57,
        minor: true,
        chords: [0, 0, 5, 7],
        melody: [12, null, 12, 15, 14, null, 10, null, 12, null, 7, null, 8, 7, 3, null],
        step: 0.5,
        voice: 'lead',
        gain: 0.55,
        groove: 'drive',
        level: 0.75,
      });
      s.fx('whir', 0.472, 0.5, 0.06);
      s.fx('beep', LOW_BATTERY, 0.12, 0.06);
      s.fx('beep', LOW_BATTERY + 0.006, 0.12, 0.05);
      for (const t of SPARKS) s.fx('crackle', t, 0.35, 0.12, 0.2);
      s.section({
        from: 0.52,
        to: 0.56,
        bpm: 60,
        root: 57,
        minor: true,
        chords: [5, 0],
        level: 0.4,
        bass: false,
        fade: 1,
      });
      // Power down: a descending beep, a soft slump, then almost silence.
      [84, 79, 76, 72, 67].forEach((pitch, i) =>
        s.note(POWER_DOWN + i * 0.0028, pitch, 0.2, 'lead', 0.08 - i * 0.01),
      );
      s.fx('thud', 0.545, 0.4, 0.08);
      s.fx('wind', 0.545, s.story * 0.12, 0.05);
      s.note(0.55, 45, s.story * 0.06, 'pad', 0.03);
      // Dawn: clean light, dripping ledges, a flower opening.
      s.section({
        from: 0.575,
        to: 0.68,
        bpm: 60,
        root: 60,
        chords: [0, 5],
        level: 0.4,
        bass: false,
        fade: 1.5,
      });
      for (const [t, pan] of [
        [0.585, -0.4],
        [0.597, 0.5],
        [0.61, -0.1],
      ])
        s.fx('drip', t, 0.2, 0.05, pan);
      s.fx('rustle', 0.58, 1.2, 0.05);
      [60, 64, 67, 72].forEach((pitch, i) => s.note(0.585 + i * 0.004, pitch, 2, 'bell', 0.06));
      s.note(LANDS, 84, 1.2, 'bell', 0.07, 0.3);
      s.fx('chime', GLINT, 1.5, 0.1, 0.3);
      s.fx('sparkle', GLINT, 1.2, 0.08, 0.3);
      DOTS.forEach((d, i) => {
        s.fx('tick', d, 0.05, 0.08);
        s.note(d, 72 + i * 4, 0.25, 'pluck', 0.06);
      });
      s.chord(HEART, [60, 64, 67, 72], 2.5, 'bell', 0.07);
      s.fx('sparkle', HEART, 1, 0.1);
      // The colour comes back: seeds on the wind and a tune that swells as the city blooms.
      s.fx('whir', SIT_UP, 0.7, 0.08);
      s.fx('swish', SEEDS - 0.004, 1, 0.08);
      s.fx('sparkle', SEEDS, 1.6, 0.08, -0.3);
      s.section({
        from: 0.68,
        to: GROW_FROM,
        bpm: 100,
        root: 60,
        chords: [0, 5],
        melody: [12, null, 16, null, 19, null, 24, null],
        step: 0.5,
        voice: 'bell',
        gain: 0.6,
        level: 0.5,
        bass: false,
      });
      s.section({
        from: GROW_FROM,
        to: 0.79,
        bpm: 100,
        root: 60,
        chords: [0, 5, 7, 0],
        melody: [7, 12, 11, 7, 5, 7, 4, 0],
        voice: 'keys',
        gain: 0.8,
        groove: 'tick',
        level: 0.65,
        fade: 0.4,
      });
      s.section({
        from: 0.79,
        to: 0.84,
        bpm: 100,
        root: 60,
        chords: [5, 7, 5, 7],
        melody: [7, 12, 11, 7, 9, 11, 12, 14],
        voice: 'bell',
        groove: 'pulse',
        level: 0.85,
        fade: 0.4,
      });
      for (let i = 0; i < 8; i++)
        s.fx('pop', GROW_FROM + 0.01 + i * 0.012, 0.15, 0.05, rand(i * 3.7) - 0.5);
      s.fx('rustle', 0.74, 2, 0.05);
      // The garden, in A major: the opening's lonely tune, now happy.
      s.section({
        from: 0.84,
        to: 1,
        bpm: 100,
        root: 57,
        chords: [0, 5, 7, 0],
        melody: [19, 24, 23, 19, 17, 19, 16, 12, 19, 24, 23, 19, 21, 19, 24, null],
        voice: 'bell',
        gain: 0.9,
        groove: 'pulse',
        level: 0.8,
        fade: 0.4,
      });
      for (const t of RAKES) s.fx('rustle', t, 0.4, 0.05, -0.2);
      s.fx('tweet', 0.848, 1.2, 0.08, 0.6);
      s.fx('flutter', 0.868, 0.5, 0.06, 0.4);
      s.fx('tweet', 0.878, 1.2, 0.07, -0.3);
      s.fx('flutter', PERCH - 0.004, 0.5, 0.08);
      s.fx('tweet', PERCH + 0.004, 1, 0.09, 0.2);
      s.chord(LOVE, [69, 73, 76], 1.5, 'bell', 0.05);
      s.fx('tweet', 0.965, 1.2, 0.07, 0.5);
    },
  );

export const boltAndTheBloom: FilmModule = {
  draw(ctx, p, seconds) {
    if (shot(p, CUTS).index === 2) macro(ctx, p, seconds);
    else street(ctx, p, seconds);
    veil(ctx, '#050709', blackout(p));
    captions(ctx, p, CAPTIONS);
  },
  score: boltAndTheBloomScore,
  look: {
    shade: '#16181A',
    ink: '#F1F5E8',
    accent: '#E0543E',
    dedication: 'somebody has to go first',
  },
};
