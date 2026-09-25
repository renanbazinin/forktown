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
  handOf,
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
  starfield,
  track,
  veil,
  vignette,
  W,
  within,
  type Ctx,
  type Figure,
  type View,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * HELLO, DOWNSTREAM
 * After the rain, Ivy folds a paper boat, pencils one word on its side, "HELLO?", and sets it
 * in the gutter. It rides the town canal with a frog for a captain, gets booped along by a
 * duckling, goes over the weir, and drifts out to sea. On a faraway beach Theo finds it, and
 * writes back.
 *
 * Screen direction carries the geography: the boat always travels left to right, and the
 * reply always flies right to left, home. The beat constants below are shared by the art and
 * the score, so every fold, scribble, croak, and splash sounds on its frame.
 */

// ——— Story beats (p), read by both the pictures and the score ———
const IDEA = 0.02;
const FOLDS = [0.047, 0.059] as const; // sheet → paper hat → boat
const LETTERS = [0, 1, 2, 3, 4, 5].map((i) => 0.069 + i * 0.0045); // H, E, L, L, O, ?
const SET = 0.112;
const LET_GO = 0.12;
const ZIP = 0.126;
const WAVE = 0.144;
const PEER = 0.162;
const FROG_ON = 0.25;
const CROAKS = [0.272, 0.294] as const;
const FROG_OFF = 0.314;
const QUACKS = [0.364, 0.404, 0.458] as const;
const PEEPS = [0.378, 0.39, 0.416] as const;
const WHAT = 0.43;
const BOOP = 0.442;
const LIP = 0.495;
const TIP = 0.508;
const PLUNGE = 0.536;
const SURFACE = 0.559;
const FIND = 0.768;
const SMILE = 0.816;
const TEAR = 0.832;
const REPLY = [0, 1, 2, 3, 4, 5].map((i) => 0.836 + i * 0.0025); // H, E, L, L, O, !
const PLANE_FOLDS = [0.853, 0.859] as const;
const THROW = 0.869;
const GUST = 0.874;
const ARRIVE = 0.912;
const LAND = 0.936;
const UNFOLD = 0.947;
const BEAM = 0.962;

// ——— Palette ———
const INK = '#2A2530';
const PAPER = '#F8F3E7';
const PAPER_SHADE = '#DAD1BF';
const PAPER_LINE = '#B8AD97';
const GRAPHITE = '#4B4757';
const SOGGY = '#D3C7A9';
const SOGGY_SHADE = '#AEA184';
const RAINCOAT = '#F2C14E';
const RAINCOAT_DARK = '#D39B32';
const IVY_SKIN = '#F1C6A0';
const THEO_SKIN = '#8A5A3C';
const THEO_SHIRT = '#3F78B8';
const STRIPE = '#E8EFF6';
const SHORTS = '#2E3D66';
const FROG = '#62A34A';
const FROG_DARK = '#3F7A34';
const FROG_BELLY = '#D6E3A0';
const WATER_HI = '#D4EAF2';

// ——— Little helpers ———
/** Paints in a local frame: origin (x, y), uniform scale, mirrored by `flip`, turned by `turn`. */
function at(ctx: Ctx, x: number, y: number, s: number, paint: () => void, flip = 1, turn = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.scale(s * flip, s);
  paint();
  ctx.restore();
}
/** Piecewise-linear keys [p, value], for steady travel (track() eases into every key). */
function lin(p: number, keys: readonly (readonly [number, number])[]) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, av] = keys[i],
      [b, bv] = keys[i + 1];
    if (p < b) return lerp(av, bv, (p - a) / (b - a));
  }
  return keys[keys.length - 1][1];
}
function twinkle(ctx: Ctx, x: number, y: number, size: number, color: string) {
  box(ctx, x - size, y, size * 2 + 1, 1, color);
  box(ctx, x, y - size, 1, size * 2 + 1, color);
}

/** Hand-lettered pencil capitals, 3 × 5 pixels each; `count` reveals them one at a time. */
const GLYPHS: Record<string, string> = {
  H: '101101111101101',
  E: '111100110100111',
  L: '100100100100111',
  O: '010101101101010',
  '?': '110001010000010',
  '!': '010010010000010',
};
function scrawl(ctx: Ctx, text: string, x: number, y: number, color: string, count = text.length) {
  for (let i = 0; i < Math.min(count, text.length); i++) {
    const glyph = GLYPHS[text[i]];
    for (let k = 0; k < 15; k++)
      if (glyph[k] === '1') box(ctx, x + i * 4 + (k % 3), y + Math.floor(k / 3), 1, 1, color);
  }
}

// ——— Paper ———
const HULL = [-16, -10, -12, -9, 9, -9, 11, -9, 13, -9, 16, -10, 11, 0, -11, 0];
// How far each hull point slumps once the boat is waterlogged: drooping horns and a torn notch.
const SLUMP = [2, 3, 0, 1, 0, 0.5, 1, 3.5, 0, 1, -2, 4, 0, 0, 0, 0];
type Grade = { tint?: string; amount?: number };
/**
 * The paper boat around its waterline centre, bow to the right. `sog` 0 is crisp; 1 is the
 * crumpled, waterlogged boat that came over the weir (it never dries out again).
 */
function paperBoat(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  {
    tilt = 0,
    sog = 0,
    letters = 6,
    tint = '#000000',
    amount = 0,
  }: Grade & {
    tilt?: number;
    sog?: number;
    letters?: number;
  } = {},
) {
  const tone = (c: string) => mix(c, tint, amount);
  const paper = tone(mix(PAPER, SOGGY, sog)),
    fold = tone(mix(PAPER_SHADE, SOGGY_SHADE, sog));
  at(
    ctx,
    x,
    y,
    s,
    () => {
      const tipX = sog * 6,
        tipY = -20 + sog * 6;
      poly(ctx, paper, [-8, -9, tipX, tipY, 8, -9]);
      poly(ctx, fold, [tipX, tipY, 8, -9, 1 + sog * 2, -9]);
      poly(
        ctx,
        paper,
        HULL.map((v, i) => v + SLUMP[i] * sog),
      );
      poly(ctx, fold, [-12.8, -3, 12.8, -3, 11, 0, -11, 0]);
      line(ctx, tone(PAPER_LINE), 0.5, [-12, -8.5, -9, -3]);
      line(ctx, tone(PAPER_LINE), 0.5, [12, -8.5, 9, -3]);
      if (sog > 0) {
        poly(ctx, alpha(tone('#8C7D5C'), 0.3 * sog), [-13.4, -5, 13.4, -5, 12.8, -3, -12.8, -3]);
        scrawl(ctx, 'HELLO?', -10, -7, alpha(tone(GRAPHITE), 0.25 * sog));
      }
      scrawl(ctx, 'HELLO?', -11, -8, alpha(tone(GRAPHITE), 1 - sog * 0.3), letters);
    },
    1,
    tilt,
  );
}
/** The reply side on, nose to the left: it always flies home right to left. */
function planeSide(ctx: Ctx, x: number, y: number, s: number, turn = 0) {
  at(
    ctx,
    x,
    y,
    s,
    () => {
      poly(ctx, PAPER_SHADE, [-12, 0, 7, 0, 8, 4]);
      poly(ctx, PAPER, [-12, 0, 10, -5, 7, 0]);
      line(ctx, PAPER_LINE, 0.5, [-12, 0, 9, -2]);
    },
    1,
    turn,
  );
}
/** The reply from above, nose up, as it sits in someone's hands. */
function planeTop(ctx: Ctx) {
  poly(ctx, PAPER, [0, -18, -15, 10, -2, 8]);
  poly(ctx, PAPER_SHADE, [0, -18, 15, 10, 2, 8]);
  poly(ctx, PAPER_LINE, [-2, 8, 0, -18, 2, 8, 0, 12]);
  line(ctx, '#A9C3DE', 0.3, [-11, 6, -3, -6]);
  line(ctx, '#A9C3DE', 0.3, [-7, 7, -2, 0]);
}
/** Theo's notebook page: ruled, a margin, a doodle of home, and (as he writes it) HELLO!. */
function replySheet(ctx: Ctx, letters: number, creased: boolean) {
  box(ctx, -16, -12, 32, 24, PAPER);
  for (let y = -8; y <= 10; y += 3) line(ctx, '#A9C3DE', 0.3, [-16, y, 16, y]);
  line(ctx, '#E59A9A', 0.3, [-12, -12, -12, 12]);
  for (let y = -11; y < 12; y += 3) box(ctx, -16, y, 1, 1, PAPER_SHADE);
  if (creased) {
    line(ctx, PAPER_LINE, 0.3, [0, -12, 0, 12]);
    line(ctx, PAPER_LINE, 0.3, [0, -12, -16, 3]);
    line(ctx, PAPER_LINE, 0.3, [0, -12, 16, 3]);
  }
  // A little palm tree over little waves.
  line(ctx, GRAPHITE, 0.5, [10, 10, 10.5, 6.5, 10, 4]);
  for (const [dx, dy] of [
    [-3, 1],
    [3, 1],
    [-2, -2],
    [2, -2],
  ])
    line(ctx, GRAPHITE, 0.4, [10, 4, 10 + dx, 4 + dy]);
  line(ctx, GRAPHITE, 0.4, [-10, 8, -8, 7, -6, 8, -4, 7, -2, 8]);
  scrawl(ctx, 'HELLO!', -10, -5, GRAPHITE, letters);
}
/** A folding stage of a sheet: 0 flat, 1 paper hat (or a plane's first point), 2 finished. */
function foldStage(ctx: Ctx, stage: number, letters: number) {
  if (stage === 0) {
    box(ctx, -16, -12, 32, 23, PAPER);
    box(ctx, -16, 9, 32, 2, PAPER_SHADE);
    box(ctx, 14, -12, 2, 21, PAPER_SHADE);
  } else if (stage === 1) {
    poly(ctx, PAPER, [-14, 3, 0, -16, 14, 3]);
    poly(ctx, PAPER_SHADE, [0, -16, 14, 3, 4, 3]);
    box(ctx, -16, 2, 32, 7, PAPER);
    box(ctx, -16, 2, 32, 1, PAPER_LINE);
    box(ctx, -16, 7, 32, 2, PAPER_SHADE);
  } else paperBoat(ctx, 0, 7, 1, { letters });
}
function planeFold(ctx: Ctx, stage: number, letters: number) {
  if (stage === 0) replySheet(ctx, letters, false);
  else if (stage === 1) {
    poly(ctx, PAPER, [-16, 12, -16, -2, 0, -16, 16, -2, 16, 12]);
    poly(ctx, PAPER_SHADE, [0, -16, -16, -2, -1, -2]);
    poly(ctx, PAPER_SHADE, [0, -16, 16, -2, 1, -2]);
    for (let y = 1; y <= 10; y += 3) line(ctx, '#A9C3DE', 0.3, [-16, y, 16, y]);
  } else planeTop(ctx);
}

// ——— People ———
const ivy = (over: Partial<Figure> = {}): Figure => ({
  skin: IVY_SKIN,
  hair: '#2B2130',
  coat: RAINCOAT,
  legs: '#D6463B',
  shoes: '#A8332B',
  hairStyle: 'bob',
  hat: 'hood',
  size: 1.4,
  facing: 1,
  ...over,
});
const theo = (over: Partial<Figure> = {}): Figure => ({
  skin: THEO_SKIN,
  hair: '#17121A',
  coat: THEO_SHIRT,
  legs: THEO_SKIN,
  shoes: '#6A4230',
  size: 1.4,
  facing: 1,
  ...over,
});
const hipOf = (f: Figure) => (f.sitting ? -4 : -6);
/** Paints in a kid figure's upper-body space: origin at the hip, the head's top at y = -20. */
function upper(ctx: Ctx, x: number, y: number, f: Figure, paint: () => void) {
  const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((f.facing ?? 1) * (f.size ?? 1), f.size ?? 1);
  ctx.translate(0, hipOf(f) - bob);
  ctx.rotate(f.lean ?? 0);
  paint();
  ctx.restore();
}
/** The front shoulder of a standing or sitting kid, honouring lean (handOf ignores it). */
function shoulderOf(x: number, y: number, f: Figure) {
  const s = f.size ?? 1,
    lean = f.lean ?? 0;
  const sx = Math.cos(lean) + 7 * Math.sin(lean),
    sy = Math.sin(lean) - 7 * Math.cos(lean);
  return { x: x + sx * s * (f.facing ?? 1), y: y + (hipOf(f) + sy) * s };
}
/** The front-arm angle that points a kid's hand at (tx, ty). */
function aim(x: number, y: number, f: Figure, tx: number, ty: number) {
  const sh = shoulderOf(x, y, f),
    s = f.size ?? 1,
    lean = f.lean ?? 0;
  const dx = (tx - sh.x) / (s * (f.facing ?? 1)),
    dy = (ty - sh.y) / s;
  return Math.atan2(
    dx * Math.cos(lean) + dy * Math.sin(lean),
    -dx * Math.sin(lean) + dy * Math.cos(lean),
  );
}
/** Where the front hand ends up once aimed: `reach` in kid pixels (the kit's arm is 7). */
function reachTo(x: number, y: number, f: Figure, tx: number, ty: number, reach = 7) {
  const sh = shoulderOf(x, y, f),
    d = Math.hypot(tx - sh.x, ty - sh.y),
    r = Math.min(d, reach * (f.size ?? 1));
  return { x: sh.x + ((tx - sh.x) / (d || 1)) * r, y: sh.y + ((ty - sh.y) / (d || 1)) * r };
}
function drawIvy(ctx: Ctx, x: number, y: number, f: Figure, peer = false) {
  person(ctx, x, y, f);
  // Hood down in the evening: bunched at the back of her neck.
  if (f.hat === 'none') upper(ctx, x, y, f, () => box(ctx, -7, -12, 4, 5, RAINCOAT_DARK));
  // A flat hand at the brow for peering after the boat.
  if (peer) upper(ctx, x, y, f, () => box(ctx, 0, -19, 7, 2, IVY_SKIN));
}
const CURLS = [
  [-5, -21],
  [-2, -22],
  [1, -22],
  [4, -21],
  [-6, -18],
  [-6, -15],
  [6, -19],
] as const;
/** Theo: the kit's kid, plus curls, a striped shirt, and shorts. */
function drawTheo(ctx: Ctx, x: number, y: number, f: Figure) {
  person(ctx, x, y, f);
  upper(ctx, x, y, f, () => {
    box(ctx, -4, -1, 8, 4, SHORTS);
    for (const row of [-7, -5, -3]) box(ctx, -4, row, 8, 1, STRIPE);
    for (const [cx, cy] of CURLS) disc(ctx, cx, cy, 2, '#17121A');
  });
}
function bucket(ctx: Ctx, x: number, y: number, s: number) {
  at(ctx, x, y, s, () => {
    poly(ctx, '#E0503C', [-5, -8, 5, -8, 4, 0, -4, 0]);
    box(ctx, -5, -8, 10, 1, '#F07A62');
    line(ctx, '#8A8A8A', 0.6, [-5, -8, 0, -12, 5, -8]);
  });
}
/** A big close-up hand, fingers up from its wrist at (x, y); `flip` -1 makes a right hand. */
function hand(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  flip: 1 | -1,
  skin: string,
  sleeve: string,
  turn = 0,
  stripes = false,
) {
  const dark = mix(skin, INK, 0.25);
  at(
    ctx,
    x,
    y,
    s,
    () => {
      box(ctx, -6, 1, 12, 34, sleeve);
      box(ctx, -6, 1, 12, 2, mix(sleeve, '#FFFFFF', 0.3));
      if (stripes) for (let k = 6; k < 34; k += 4) box(ctx, -6, k, 12, 1, STRIPE);
      box(ctx, -4, -7, 8, 9, skin);
      box(ctx, -4, -10, 2, 4, skin);
      box(ctx, -2, -11, 2, 5, skin);
      box(ctx, 0, -11, 2, 5, skin);
      box(ctx, 2, -10, 2, 4, skin);
      box(ctx, -4, -7, 1, 9, dark);
      for (const fx of [-2, 0, 2]) box(ctx, fx, -8, 1, 2, dark);
      box(ctx, 4, -5, 2, 4, skin);
      box(ctx, 4, -2, 1, 2, dark);
    },
    flip,
    turn,
  );
}
function pencil(ctx: Ctx, x: number, y: number, s: number, turn: number) {
  at(
    ctx,
    x,
    y,
    s,
    () => {
      box(ctx, -1, -2, 2, 2, '#3A3640');
      poly(ctx, '#E9CFA2', [-1, -2, 1, -2, 2, -6, -2, -6]);
      box(ctx, -2, -22, 4, 16, '#4A78C0');
      box(ctx, -2, -22, 1, 16, '#3A5E9A');
      box(ctx, -2, -25, 4, 3, '#B9B8B0');
      box(ctx, -2, -29, 4, 4, '#E58C8C');
    },
    1,
    turn,
  );
}
/**
 * The pencil tip while writing letters that start at `times` (each `each` long): it swoops in,
 * scribbles across each letter as it appears, then lifts away.
 */
function pencilTip(
  p: number,
  seconds: number,
  times: readonly number[],
  each: number,
  letterAt: (k: number) => { x: number; y: number },
  S: number,
) {
  const first = times[0],
    last = times[times.length - 1] + each;
  if (p < first) {
    const t = easeOut(span(p, first - 0.006, first)),
      to = letterAt(0);
    return { x: lerp(330, to.x - S, t), y: lerp(10, to.y, t) };
  }
  if (p < last) {
    const k = Math.min(times.length - 1, Math.floor((p - first) / each));
    const u = clamp((p - times[k]) / each),
      to = letterAt(k);
    return {
      x: to.x + (u - 0.5) * 3 * S + Math.sin(seconds * 41) * 0.5 * S,
      y: to.y + Math.sin(seconds * 53) * 2.2 * S,
    };
  }
  const t = easeIn(span(p, last, last + 0.005)),
    from = letterAt(times.length - 1);
  return { x: from.x + S + t * 90, y: from.y - t * 70 };
}
/** A right hand writing: the pencil, then the fingers wrapped round it. */
function writingHand(
  ctx: Ctx,
  tip: { x: number; y: number },
  skin: string,
  sleeve: string,
  stripes = false,
) {
  pencil(ctx, tip.x, tip.y, 3, 0.5);
  hand(ctx, tip.x + 24, tip.y - 4, 3, -1, skin, sleeve, -0.25, stripes);
}

// ——— Creatures ———
type FrogPose = 'sit' | 'leap' | 'stand';
function frog(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  facing: 1 | -1,
  pose: FrogPose,
  {
    arm = 'none',
    croak = 0,
    look = 0,
    wag = 0,
  }: {
    arm?: 'none' | 'salute' | 'point' | 'wave';
    croak?: number;
    look?: number;
    wag?: number;
  } = {},
) {
  at(
    ctx,
    x,
    y,
    s,
    () => {
      const eyes = (ex: number, ey: number) => {
        for (const dx of [0, 4]) {
          disc(ctx, ex + dx, ey, 2.2, FROG);
          disc(ctx, ex + dx, ey, 1.4, '#F4F0D2');
          box(ctx, ex + dx + look, ey - 0.5, 1, 1, INK);
        }
      };
      if (pose === 'leap') {
        line(ctx, FROG_DARK, 1.6, [-3, -4, -9, -1, -13, 0]);
        oval(ctx, 0, -5, 7, 3.5, FROG, -0.35);
        oval(ctx, 1.5, -3.5, 4, 2, FROG_BELLY, -0.35);
        line(ctx, FROG, 1.2, [4, -5, 8, -2]);
        eyes(1, -10);
        return;
      }
      if (pose === 'stand') {
        // The captain: upright on the bow.
        box(ctx, -3, -4, 2, 4, FROG_DARK);
        box(ctx, 1, -4, 2, 4, FROG_DARK);
        box(ctx, -4, -1, 3, 1, FROG_DARK);
        box(ctx, 1, -1, 4, 1, FROG_DARK);
        oval(ctx, 0, -9, 4.5, 6, FROG);
        oval(ctx, 1, -8, 3, 4.5, FROG_BELLY);
        oval(ctx, 0.5, -15.5, 5, 3.5, FROG);
        if (croak > 0) disc(ctx, 2.5, -12, 2.8 * croak, '#EDE7B6');
        line(ctx, INK, 0.5, [-1, -14, 2, -13.4, 5, -14]);
        eyes(-1.5, -18.5);
        line(ctx, FROG, 1.3, [-3, -12, -6, -10, -3, -8]);
        if (arm === 'salute') line(ctx, FROG, 1.3, [3, -12, 7, -15, 4, -19]);
        else if (arm === 'point') line(ctx, FROG, 1.3, [3, -12, 10, -14]);
        return;
      }
      oval(ctx, -3, -3, 4, 3, FROG_DARK);
      box(ctx, -7, -1, 5, 1, FROG_DARK);
      oval(ctx, 0, -5, 6, 4.5, FROG);
      oval(ctx, 2, -3.5, 3.5, 2.5, FROG_BELLY);
      box(ctx, 3, -3, 1, 3, FROG_DARK);
      box(ctx, 3, -1, 3, 1, FROG_DARK);
      if (croak > 0) disc(ctx, 4.5, -5, 2.8 * croak, '#EDE7B6');
      line(ctx, INK, 0.5, [2, -7, 4, -6.5, 6.5, -7.2]);
      eyes(1, -9.5);
      if (arm === 'wave') line(ctx, FROG, 1.2, [3, -5, 5 + wag, -11]);
    },
    facing,
  );
}
const DUCK = { body: '#D2B17B', wing: '#A17D53', breast: '#EEE0B8' };
const DUCKLING = { body: '#F3D66D', wing: '#DDB652', breast: '#FFF0AC' };
/** Forktown's pond ducks, swimming, with a head that can cock, lunge, and quack. */
function duck(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  facing: 1 | -1,
  adult: boolean,
  { tilt = 0, reach = 0, open = 0, flap = 0 } = {},
) {
  const c = adult ? DUCK : DUCKLING;
  oval(ctx, x, y + 1, 14 * s, 2.2 * s, alpha(WATER_HI, 0.35));
  at(
    ctx,
    x,
    y + 2 * s,
    s,
    () => {
      box(ctx, -10, -10, 18, 8, c.body);
      box(ctx, -8, -12, 14, 4, c.body);
      box(ctx, -13, -13, 5, 5, c.body);
      box(ctx, -7, -9 - flap * 5, 9, 4, c.wing);
      box(ctx, -4, -5 - flap * 3, 6, 2, c.wing);
      ctx.save();
      ctx.translate(3 + reach, -9);
      ctx.rotate(tilt);
      ctx.translate(-3, 9);
      box(ctx, 3, -18, 9, 12, c.body);
      box(ctx, 5, -20, 6, 3, c.body);
      box(ctx, 5, -11, 5, 4, c.breast);
      box(ctx, 11, -14, 6, 2, '#DF9446');
      box(ctx, 11, -12 + open * 2, 6, 1, '#C77F3C');
      box(ctx, 9, -17, 2, 2, '#29392F');
      ctx.restore();
    },
    facing,
  );
}
function gull(ctx: Ctx, x: number, y: number, s: number, flap: number, color: string) {
  const w = Math.sin(flap) * 3;
  at(ctx, x, y, s, () => {
    line(ctx, color, 1.3, [-7, -1 - w, -3, -2 + w * 0.3, 0, 0, 3, -2 + w * 0.3, 7, -1 - w]);
    oval(ctx, 0, 0.5, 2, 1, color);
  });
}

// ——— Ivy's street ———
const DOOR = 124;
const STEP = 128; // top of the upper doorstep
const PAVE = 138;
const KERB = 150;
const GUTTER = 154;
const ROAD = 158;
const HOUSES = [
  { x: -8, w: 94, top: 54, color: '#B9826E', roof: '#6A4A48' },
  { x: 86, w: 82, top: 44, color: '#7C9EA3', roof: '#584656' },
  { x: 168, w: 80, top: 58, color: '#CDAA74', roof: '#744F45' },
  { x: 248, w: 80, top: 50, color: '#9384AA', roof: '#5B4859' },
] as const;
// Drips off the eaves after the rain: [x, eave y, period s, phase offset s].
const EAVES = [
  [28, 57, 1.7, 0.3],
  [102, 47, 1.3, 0.9],
  [158, 47, 1.9, 0.2],
  [226, 61, 1.5, 1.1],
  [272, 53, 1.6, 0.6],
] as const;
const NIGHT = ['#18203F', '#262F57', '#454271', '#7F5D78'];

function windowPane(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  dusk: number,
  lit: boolean,
) {
  box(ctx, x - 2, y - 2, w + 4, h + 4, '#E4DACA');
  box(ctx, x, y, w, h, mix('#A3B3C1', lit ? '#FFCF78' : '#2E3452', dusk));
  box(ctx, x + w / 2 - 1, y, 2, h, '#E4DACA');
  if (dusk < 0.5) box(ctx, x + 2, y + 2, 2, h / 2, alpha('#FFFFFF', 0.4));
  else if (lit) glow(ctx, x + w / 2, y + h / 2, 26, '#FFC46A', 0.28 * dusk);
  box(ctx, x - 3, y + h + 2, w + 6, 2, '#CFC4B0');
}
function eavesDrips(ctx: Ctx, seconds: number, amount: number) {
  if (amount <= 0) return;
  const color = alpha('#D4EAF2', amount);
  for (const [x, top, period, offset] of EAVES) {
    const phase = ((seconds + offset) / period) % 1;
    if (phase < 0.62) box(ctx, x - 1, top, 2, 1 + (phase / 0.62) * 2, color);
    else {
      const t = (phase - 0.62) / 0.38;
      box(ctx, x - 1, top + 2 + t * t * (PAVE - top - 4), 2, 3, color);
    }
    if (phase < 0.12) {
      const t = phase / 0.12,
        rise = Math.sin(t * Math.PI) * 3;
      box(ctx, x - 2 - t * 4, PAVE - 1 - rise, 1, 1, color);
      box(ctx, x + 1 + t * 4, PAVE - 1 - rise, 1, 1, color);
    }
  }
}
/** The street: `clear` parts the rain clouds; `dusk` turns it to evening with the door open. */
function street(ctx: Ctx, seconds: number, clear: number, dusk: number) {
  const grey = ['#8494A8', '#9AA9BA', '#B2BFC8', '#C9D1CF'];
  const blue = ['#7DAFD6', '#97C1DF', '#B5D3E4', '#D3E2E4'];
  sky(
    ctx,
    grey.map((c, i) => mix(mix(c, blue[i], clear), NIGHT[i], dusk)),
    0,
    100,
  );
  if (dusk > 0)
    faded(ctx, dusk, () => {
      starfield(ctx, seconds, { count: 26, seed: 4, top: 2, bottom: 46 });
      disc(ctx, 178, 38, 5, '#F3EACB');
      disc(ctx, 180.5, 36, 5, NIGHT[1]);
    });
  if (dusk < 1) {
    glow(ctx, 214, 16, 120, '#FFE7AE', 0.45 * clear * (1 - dusk));
    faded(ctx, 1 - dusk, () => {
      for (let i = 0; i < 6; i++) {
        const x = 16 + i * 60 + (i % 2 ? 1 : -1) * clear * 60 + Math.sin(seconds * 0.15 + i) * 3;
        const y = 12 + (i % 3) * 9;
        oval(ctx, x, y, 36 - clear * 8, 9, mix('#76839A', '#E6EBEE', clear));
        oval(ctx, x + 14, y - 6, 20 - clear * 4, 8, mix('#8390A5', '#F4F6F7', clear));
      }
    });
  }
  const wet = 1 - dusk;
  HOUSES.forEach((h, i) => {
    const face = mix(mix(h.color, '#4F5B72', 0.3 * wet), '#232845', dusk * 0.5);
    box(ctx, h.x + h.w - 24, h.top - 22, 8, 16, mix(h.roof, INK, 0.3));
    poly(ctx, mix(h.roof, '#1B1F36', dusk * 0.45), [
      h.x - 5,
      h.top + 1,
      h.x + h.w / 2,
      h.top - 24,
      h.x + h.w + 5,
      h.top + 1,
    ]);
    box(ctx, h.x, h.top, h.w, PAVE - h.top, face);
    box(ctx, h.x, h.top, 2, PAVE - h.top, mix(face, INK, 0.25));
    box(ctx, h.x - 5, h.top, h.w + 10, 3, mix('#5A5E66', '#2A2C3E', dusk));
    for (const wx of [h.x + 14, h.x + h.w - 32])
      windowPane(ctx, wx, h.top + 12, 18, 20, dusk, (i + Math.round(wx)) % 3 !== 0);
    if (i !== 1) {
      box(
        ctx,
        h.x + 12,
        100,
        18,
        PAVE - 100,
        mix(mix('#5D4A4E', h.roof, 0.3), '#1C1E30', dusk * 0.5),
      );
      box(ctx, h.x + 26, 118, 2, 2, '#E9C46A');
      windowPane(ctx, h.x + h.w - 34, 98, 20, 18, dusk, i !== 2);
    }
  });
  // Ivy's front door, its fanlight, and a window box of geraniums.
  const dx = DOOR - 13;
  box(ctx, dx - 4, 72, 34, STEP - 72, '#E4DACA');
  box(ctx, dx, 75, 26, 7, mix('#9FB0BD', '#FFD27A', Math.max(dusk, 0.3)));
  box(ctx, DOOR - 1, 75, 2, 7, '#E4DACA');
  if (dusk > 0.5) {
    box(ctx, dx, 84, 26, STEP - 84, '#FFD48A');
    box(ctx, dx + 15, 90, 7, 10, '#E8A857');
    box(ctx, dx, 84, 5, STEP - 84, '#7E3029');
  } else {
    box(ctx, dx, 84, 26, STEP - 84, '#B24A3E');
    for (const [px, py, ph] of [
      [3, 88, 14],
      [15, 88, 14],
      [3, 106, 17],
      [15, 106, 17],
    ])
      box(ctx, dx + px, py, 8, ph, '#9C3F35');
    box(ctx, dx + 21, 104, 2, 2, '#E9C46A');
  }
  windowPane(ctx, 146, 92, 18, 18, dusk, true);
  box(ctx, 143, 112, 24, 4, '#7A5642');
  for (let k = 0; k < 5; k++) disc(ctx, 146 + k * 4.5, 111, 2, k % 2 ? '#D84A4A' : '#E86A5A');
  // A street lamp.
  box(ctx, 243, 72, 3, PAVE - 72, '#3B3E48');
  poly(ctx, '#3B3E48', [237, 62, 244.5, 55, 252, 62]);
  box(ctx, 238, 62, 13, 12, '#3B3E48');
  box(ctx, 240, 64, 9, 8, mix('#C9CFD4', '#FFE09A', dusk));
  // Doorsteps, pavement, kerb.
  box(ctx, DOOR - 19, STEP, 38, 5, mix('#A9A59B', '#6D6A78', dusk));
  box(ctx, DOOR - 19, STEP, 38, 1, mix('#C4C0B5', '#8A869A', dusk));
  box(ctx, DOOR - 23, STEP + 5, 46, 5, mix('#99958B', '#605E6E', dusk));
  box(ctx, DOOR - 23, STEP + 5, 46, 1, mix('#B5B1A6', '#7A788C', dusk));
  box(ctx, 0, PAVE, W, KERB - PAVE, mix('#878A93', '#474A62', dusk));
  for (let x = 12; x < W; x += 28)
    box(ctx, x, PAVE, 1, KERB - PAVE, mix('#767982', '#3C3F56', dusk));
  if (wet > 0)
    for (const x of [18, 104, 150, 188, 232, 290])
      box(ctx, x, PAVE + 2, 10, 9, alpha('#DDE5EA', 0.16 * wet));
  box(ctx, 0, KERB, W, 4, mix('#B1AEA4', '#67677C', dusk));
  for (let x = 30; x < W; x += 40) box(ctx, x, KERB, 1, 4, mix('#98958C', '#55556A', dusk));
  // The gutter stream, always running to the right: downstream.
  box(ctx, 0, GUTTER, W, 4, mix('#5F7E96', '#2A385A', dusk));
  for (let i = 0; i < 16; i++)
    box(
      ctx,
      ((i * 23 + seconds * 34) % 340) - 10,
      GUTTER + 1 + (i % 2),
      3 + (i % 3),
      1,
      alpha(WATER_HI, 0.75 - dusk * 0.4),
    );
  box(ctx, 0, ROAD, W, H - ROAD, mix('#66646D', '#32334A', dusk));
  for (let r = 0; r < 4; r++)
    for (let c = -1; c < 23; c++)
      box(ctx, c * 14 + (r % 2) * 7, ROAD + 3 + r * 5, 11, 3, mix('#716F78', '#3A3B51', dusk));
  for (const [px, py, pw] of [
    [64, 171, 22],
    [236, 174, 30],
  ] as const)
    oval(ctx, px, py, pw, 3, mix(mix('#9CAFC2', '#BCD6E6', clear), '#4B5280', dusk));
  if (dusk > 0) {
    glow(ctx, 244.5, 68, 64, '#FFD27A', 0.5 * dusk);
    // Warm light spills out of the open door and down the steps.
    poly(ctx, alpha('#FFD48A', 0.3 * dusk), [
      dx,
      STEP,
      dx + 26,
      STEP,
      dx + 42,
      KERB,
      dx - 16,
      KERB,
    ]);
    glow(ctx, DOOR, 110, 80, '#FFC870', 0.4 * dusk);
  }
  eavesDrips(ctx, seconds, 1 - dusk);
}
const clearing = (p: number) => 0.3 + span(p, 0, 0.18) * 0.7;

/** Ivy's lap, seen from above: raincoat knees over the wet stone step. */
function lap(ctx: Ctx, evening: number) {
  box(ctx, 0, 0, W, H, mix('#7A8591', '#3B3850', evening));
  const joint = mix('#6B7682', '#312E46', evening);
  for (let y = 18; y < 130; y += 24) box(ctx, 0, y, W, 1, joint);
  for (let i = 0; i < 6; i++)
    box(ctx, (i * 67 + (i % 2) * 30) % W, 18 + (i % 4) * 24, 1, 24, joint);
  for (const kx of [72, 248]) {
    oval(ctx, kx, 204, 104, 76, mix(RAINCOAT_DARK, '#A8662E', evening));
    oval(ctx, kx, 200, 98, 70, mix(RAINCOAT, '#E0A04A', evening));
    box(ctx, kx - 30, 146, 60, 2, alpha('#FFFFFF', 0.2));
  }
  if (evening > 0) glow(ctx, 30, 10, 260, '#FFC870', 0.32 * evening);
}
function sandInsert(ctx: Ctx, seconds: number) {
  box(ctx, 0, 0, W, 50, '#63B9C2');
  box(ctx, 0, 30, W, 20, '#58ADB9');
  for (let i = 0; i < 8; i++)
    box(ctx, ((i * 53 + seconds * 10) % 340) - 10, 10 + ((i * 13) % 34), 14, 2, '#BFE6E6');
  box(ctx, 0, 50, W, H - 50, '#E6C99B');
  for (let x = 0; x < W; x += 8)
    box(ctx, x, 48 + Math.sin(x * 0.07 + seconds * 1.4) * 2, 8, 4, '#F4FAF6');
  for (let i = 0; i < 26; i++) box(ctx, (i * 71) % W, 62 + ((i * 29) % 110), 2, 1, '#D3B383');
}

// ——— Shots ———
function doorstep(ctx: Ctx, p: number, seconds: number) {
  camera(
    ctx,
    track(p, [
      [0, 160, 90, 1],
      [0.035, DOOR + 6, 110, 1.55],
    ]),
    () => {
      street(ctx, seconds, clearing(p), 0);
      const idea = p >= IDEA;
      const f = ivy({
        sitting: true,
        arms: [0.5, 1.1],
        eyes: idea ? 'wide' : Math.sin(seconds * 1.3) > 0.93 ? 'closed' : 'open',
        mouth: idea ? 'grin' : 'flat',
        lean: idea ? 0 : 0.1,
      });
      drawIvy(ctx, DOOR - 2, STEP + 1, f);
      const h = handOf(DOOR - 2, STEP + 1, f);
      box(ctx, h.x - 4, h.y - 5, 10, 7, PAPER);
      box(ctx, h.x - 4, h.y + 1, 10, 1, PAPER_SHADE);
      const spark = hump(p, IDEA, IDEA + 0.014);
      if (spark > 0) twinkle(ctx, DOOR + 8, 86 - spark * 4, 1 + Math.round(spark * 2), '#FFF1B8');
    },
  );
  vignette(ctx, 0.35);
}
function foldAndWrite(ctx: Ctx, p: number, seconds: number) {
  lap(ctx, 0);
  const S = 3.4,
    cx = 160,
    cy = 86 - ease(span(p, 0.096, 0.1)) * 5;
  const stage = p < FOLDS[0] ? 0 : p < FOLDS[1] ? 1 : 2;
  const squash = Math.max(...FOLDS.map((f) => hump(p, f - 0.005, f + 0.003)));
  const letters = LETTERS.filter((l) => p >= l + 0.0035).length;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(S * (1 - squash * 0.55), S * (1 + squash * 0.1));
  foldStage(ctx, stage, letters);
  ctx.restore();
  if (squash > 0.2)
    for (const side of [-1, 1])
      line(ctx, alpha('#FFFFFF', squash * 0.7), 1.5, [
        cx + side * 72,
        cy - 18,
        cx + side * 80,
        cy,
        cx + side * 72,
        cy + 18,
      ]);
  const grip = squash * 24;
  hand(ctx, cx - 64 + grip, cy + 34, 3, 1, IVY_SKIN, RAINCOAT, 0.45);
  if (p < 0.062) hand(ctx, cx + 64 - grip, cy + 34, 3, -1, IVY_SKIN, RAINCOAT, -0.45);
  else
    writingHand(
      ctx,
      pencilTip(
        p,
        seconds,
        LETTERS,
        0.0045,
        (k) => ({ x: cx + (-10 + 4 * k) * S, y: cy + 1.5 * S }),
        S,
      ),
      IVY_SKIN,
      RAINCOAT,
    );
  vignette(ctx, 0.3);
}
function curb(ctx: Ctx, p: number, seconds: number) {
  camera(
    ctx,
    track(p, [
      [0.1, 162, 136, 2.6],
      [ZIP, 168, 136, 2.6],
      [0.14, 190, 124, 1.6],
      [0.148, 178, 124, 2.2],
      [0.18, 184, 122, 2.1],
    ]),
    () => {
      street(ctx, seconds, clearing(p), 0);
      const ix = 150;
      const zip = easeIn(span(p, ZIP, 0.145));
      const bx = 168 + Math.max(0, p - LET_GO) * 260 + zip * 190;
      const by = lerp(146, GUTTER + 3, ease(span(p, 0.1, SET))) + Math.sin(seconds * 3) * 0.4;
      if (zip > 0.05)
        for (let k = 0; k < 3; k++)
          box(
            ctx,
            bx - 14 - k * 6 - zip * 12,
            by - 2 - k * 2,
            5 + zip * 8,
            1,
            alpha(WATER_HI, 0.8),
          );
      paperBoat(ctx, bx, by, 0.55, { tilt: Math.sin(seconds * 2.5) * 0.05 });
      if (p < 0.136) {
        // Crouched at the kerb: lower it in, hold it a moment, let go.
        const holding = p < LET_GO;
        const base = ivy({
          sitting: true,
          lean: holding ? 0.32 : 0.15,
          eyes: 'open',
          mouth: p > LET_GO ? 'o' : 'smile',
        });
        const grip = { x: bx - 4, y: by - 6 };
        const f = {
          ...base,
          arms: [0.3, holding ? aim(ix, KERB - 1, base, grip.x, grip.y) : 0.9] as const,
        };
        drawIvy(ctx, ix, KERB - 1, f);
        if (holding) {
          const h = reachTo(ix, KERB - 1, f, grip.x, grip.y, 14);
          const sh = shoulderOf(ix, KERB - 1, f);
          line(ctx, RAINCOAT, 2.8, [sh.x, sh.y, h.x, h.y]);
          disc(ctx, h.x, h.y, 1.6, IVY_SKIN);
        }
      } else {
        const waving = within(p, WAVE, PEER),
          peering = p >= PEER;
        drawIvy(
          ctx,
          ix,
          KERB - 1,
          ivy({
            arms: waving
              ? [0.2, 2.65 + Math.sin(seconds * 13) * 0.45]
              : peering
                ? [0.2, 2.95]
                : [0.3, 0.4],
            eyes: peering ? 'open' : 'happy',
            mouth: peering ? 'smile' : 'grin',
            lean: peering ? 0.1 : 0,
          }),
          peering,
        );
      }
    },
  );
  vignette(ctx, 0.35);
}

// ——— The journey through town ———
const WL = 120; // the waterline all the way through town
const BRIDGE = 330;
const ARCH = 26;
const POST = 572;
const PADS = [
  [700, -1, 6, false],
  [744, 3, 8, true],
  [780, -1, 7, false],
  [800, 5, 9, false],
  [840, 2, 6, true],
  [872, -1, 8, false],
] as const;
const FROG_PAD = 800;
const journeyX = (p: number) =>
  lin(p, [
    [0.18, 16],
    [0.235, 470],
    [FROG_ON, 560],
    [FROG_OFF, 770],
    [0.34, 852],
  ]);
const FRONTS = [
  { w: 50, h: 58, color: '#C98B6B', roof: '#6E4A44' },
  { w: 42, h: 70, color: '#8FB0A4', roof: '#56505E' },
  { w: 56, h: 52, color: '#E0B874', roof: '#7A5446' },
  { w: 46, h: 64, color: '#A58FB8', roof: '#5B4859' },
  { w: 54, h: 56, color: '#D98E7E', roof: '#6A4448' },
  { w: 40, h: 72, color: '#7FA3BD', roof: '#4E5266' },
] as const;
function facade(
  ctx: Ctx,
  x: number,
  top: number,
  w: number,
  h: number,
  color: string,
  roof: string,
) {
  poly(ctx, roof, [x - 2, top + 1, x + w / 2, top - 13, x + w + 2, top + 1]);
  box(ctx, x, top, w, h, color);
  box(ctx, x, top, 2, h, mix(color, INK, 0.2));
  for (let wy = top + 7; wy < top + h - 14; wy += 16)
    for (let wx = x + 7; wx < x + w - 10; wx += 16) {
      box(ctx, wx, wy, 8, 10, '#E9E1CF');
      box(ctx, wx + 1, wy + 1, 6, 8, '#7F95A6');
    }
}
/** Parallax layers repeat along the journey; `f` is how fast a layer moves with the camera. */
function layer(
  camX: number,
  left: number,
  right: number,
  f: number,
  period: number,
  paint: (x: number, k: number) => void,
) {
  const shift = camX * (1 - f);
  for (let k = Math.floor((left - shift) / period) - 1; k * period + shift < right; k++)
    paint(k * period + shift, k);
}
function journey(ctx: Ctx, p: number, seconds: number, view: View) {
  const jx = journeyX(p);
  sky(ctx, ['#86BCDD', '#A3CCE6', '#C3DDEB'], 0, H);
  for (let i = 0; i < 4; i++) {
    const x = ((((i * 110 - jx * 0.05) % 440) + 440) % 440) - 60;
    oval(ctx, x, 16 + (i % 2) * 12, 26, 7, '#F2F6F8');
    oval(ctx, x + 12, 12 + (i % 2) * 12, 14, 6, '#FFFFFF');
  }
  camera(
    ctx,
    view,
    () => {
      const hw = W / 2 / view.zoom,
        left = view.x - hw - 4,
        right = view.x + hw + 4;
      layer(view.x, left, right, 0.3, 64, (x, k) => {
        const h = 16 + rand(k) * 18;
        poly(ctx, '#AFC2CF', [x, 94, x, 92 - h, x + 15, 80 - h, x + 30, 92 - h, x + 30, 94]);
        box(ctx, x + 34, 94 - h * 0.7, 26, h * 0.7, '#B8C9D4');
        box(ctx, x + 20, 80 - h, 4, 8, '#AFC2CF');
      });
      layer(view.x, left, right, 0.6, 288, (x) => {
        let u = x;
        for (const h of FRONTS) {
          facade(ctx, u, 102 - h.h, h.w, h.h, h.color, h.roof);
          u += h.w;
        }
      });
      // Near: the street gutter up to the bridge, the town canal after it.
      if (left < BRIDGE) {
        const r = Math.min(right, BRIDGE),
          w = r - left;
        box(ctx, left, 100, w, 8, '#9C9EA5');
        box(ctx, left, 100, w, 1, '#B8BAC0');
        box(ctx, left, 108, w, 8, '#B2AFA6');
        for (let x = Math.ceil(left / 30) * 30; x < r; x += 30) box(ctx, x, 108, 1, 8, '#96938A');
        for (let x = Math.ceil((left - 60) / 150) * 150 + 60; x < r; x += 150) {
          box(ctx, x, 52, 2, 48, '#3B3E48');
          box(ctx, x - 4, 44, 10, 9, '#3B3E48');
          box(ctx, x - 2, 46, 6, 5, '#D7DEE2');
        }
        box(ctx, left, 116, w, 6, '#5F87A0');
        for (let x = Math.floor(left / 18) * 18; x < r; x += 18)
          box(ctx, x + ((seconds * 40) % 18), 117 + (Math.abs(x / 18) % 2), 4, 1, WATER_HI);
        box(ctx, left, 122, w, 80, '#6C6A72');
        for (let row = 0; row < 6; row++)
          for (let x = Math.floor(left / 14) * 14 - 7; x < r; x += 14)
            box(ctx, x + (row % 2) * 7, 125 + row * 6, 11, 3, '#77757D');
      }
      if (right > BRIDGE) {
        const l = Math.max(left, BRIDGE),
          w = right - l;
        box(ctx, l, 77, w, 1, '#3E4048');
        for (let x = Math.ceil(l / 14) * 14; x < right; x += 14) box(ctx, x, 77, 1, 9, '#3E4048');
        box(ctx, l, 86, w, 6, '#A9A59C');
        box(ctx, l, 86, w, 1, '#C4C0B6');
        box(ctx, l, 92, w, WL - 92, '#94604F');
        for (let y = 95; y < WL - 1; y += 4) {
          box(ctx, l, y, w, 1, '#7E5042');
          for (let x = Math.floor(l / 12) * 12 + ((y / 4) % 2) * 6; x < right; x += 12)
            box(ctx, x, y - 3, 1, 3, '#7E5042');
        }
        box(ctx, l, WL - 2, w, 90, '#4E7C92');
        box(ctx, l, WL - 2, w, 3, '#6E6A6E');
        box(ctx, l, WL + 12, w, 80, '#47738A');
        box(ctx, l, WL + 30, w, 60, '#406A80');
        for (let x = Math.floor(l / 22) * 22; x < right; x += 22) {
          const k = Math.abs(Math.round(x / 22)) % 3;
          box(ctx, x + ((seconds * 12) % 22), WL + 3 + k * 7, 6 + k * 2, 1, alpha(WATER_HI, 0.6));
        }
      }
      // Under the bridge it is dark.
      ctx.fillStyle = '#34323A';
      ctx.beginPath();
      ctx.arc(BRIDGE, WL + 2, ARCH, Math.PI, 0);
      ctx.fill();
      box(ctx, BRIDGE - ARCH, WL - 3, ARCH * 2, 5, '#3E5566');
      // The frog's mooring post, and the lily pads behind the boat's path.
      box(ctx, POST - 3, 104, 6, WL - 106, '#6B4E36');
      box(ctx, POST - 4, 103, 8, 2, '#86664A');
      box(ctx, POST - 3, 110, 6, 2, '#C9B48A');
      oval(ctx, POST, WL - 2, 7, 1.2, alpha(WATER_HI, 0.6));
      for (const [x, dy, r, flower] of PADS) if (dy < 0) lilyPad(ctx, x, WL + dy, r, flower);
      // The boat, dipping under the frog's weight.
      const kick = (from: number) => {
        const t = p - from;
        return t > 0 && t < 0.03 ? Math.sin(t * 900) * Math.exp(-t * 160) : 0;
      };
      const loaded = within(p, FROG_ON, FROG_OFF) ? 1 : 0;
      const dip = loaded * 2 + kick(FROG_ON) * 2.5 - kick(FROG_OFF) * 2;
      const by = WL + dip + Math.sin(seconds * 2.4) * 0.5;
      const under = clamp(1 - Math.abs(jx - BRIDGE) / 30);
      paperBoat(ctx, jx, by, 1, {
        tilt: loaded * 0.05 + kick(FROG_ON) * 0.12 + Math.sin(seconds * 1.9) * 0.03,
        tint: '#1E1C26',
        amount: under * 0.55,
      });
      frogAboard(ctx, p, seconds, jx, by);
      for (const [x, dy, r, flower] of PADS) if (dy >= 0) lilyPad(ctx, x, WL + dy, r, flower);
      if (p >= FROG_OFF + 0.007) frogOnPad(ctx, p, seconds);
      box(ctx, jx - 13, WL - 1, 26, 2, alpha(WATER_HI, 0.35));
      bridgeFront(ctx);
    },
    null,
  );
}
function lilyPad(ctx: Ctx, x: number, y: number, r: number, flower: boolean) {
  oval(ctx, x, y, r, r * 0.3, '#4F8E3E');
  oval(ctx, x - r * 0.1, y - 0.5, r * 0.85, r * 0.22, '#65A84E');
  poly(ctx, '#4E7C92', [x, y, x + r + 1, y - r * 0.12, x + r + 1, y + r * 0.2]);
  if (flower) {
    disc(ctx, x - r * 0.3, y - 2, 2, '#F2A7C0');
    disc(ctx, x - r * 0.3, y - 3, 1.2, '#FFE4EE');
  }
}
function bridgeFront(ctx: Ctx) {
  ctx.fillStyle = '#A59C8E';
  ctx.beginPath();
  ctx.rect(BRIDGE - 46, 82, 92, 120);
  ctx.moveTo(BRIDGE + ARCH, WL + 2);
  ctx.arc(BRIDGE, WL + 2, ARCH, 0, Math.PI, true);
  ctx.closePath();
  ctx.fill('evenodd');
  ctx.strokeStyle = '#8B8274';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(BRIDGE, WL + 2, ARCH + 2, Math.PI, 0);
  ctx.stroke();
  for (const y of [89, 97, 105, 113, 130, 142]) {
    const half = y < WL + 2 ? Math.sqrt(Math.max(0, (ARCH + 4) ** 2 - (WL + 2 - y) ** 2)) : 0;
    box(ctx, BRIDGE - 46, y, 46 - half, 1, '#8E8577');
    box(ctx, BRIDGE + half, y, 46 - half, 1, '#8E8577');
  }
  box(ctx, BRIDGE - 48, 74, 96, 8, '#B5AC9E');
  box(ctx, BRIDGE - 48, 74, 96, 2, '#CBC3B6');
  box(ctx, BRIDGE - 46, WL + 3, 92, 2, alpha(INK, 0.25));
}
function frogAboard(ctx: Ctx, p: number, seconds: number, jx: number, by: number) {
  const deck = { x: jx + 10, y: by - 9 };
  const croak = Math.max(...CROAKS.map((c) => hump(p, c, c + 0.009)));
  if (p < FROG_ON - 0.007) {
    // On his post, watching the boat come.
    frog(ctx, POST, 103, 1.1, -1, 'sit', { look: -0.5 });
  } else if (p < FROG_ON) {
    const t = span(p, FROG_ON - 0.007, FROG_ON);
    frog(ctx, lerp(POST, deck.x, t), lerp(103, deck.y, t) - hump(t, 0, 1) * 12, 1.1, -1, 'leap');
  } else if (p < FROG_OFF) {
    const standing = within(p, 0.262, 0.306);
    const facing: 1 | -1 = within(p, 0.278, 0.286) ? -1 : 1;
    frog(ctx, deck.x, deck.y, 1.1, facing, standing ? 'stand' : 'sit', {
      arm: p < 0.288 ? 'salute' : 'point',
      croak,
      look: Math.sin(seconds * 1.7) * 0.5,
    });
  } else if (p < FROG_OFF + 0.007) {
    const t = span(p, FROG_OFF, FROG_OFF + 0.007);
    frog(
      ctx,
      lerp(deck.x, FROG_PAD, t),
      lerp(deck.y, WL + 4, t) - hump(t, 0, 1) * 14,
      1.1,
      1,
      'leap',
    );
  }
}
function frogOnPad(ctx: Ctx, p: number, seconds: number) {
  frog(ctx, FROG_PAD, WL + 4, 1.1, 1, 'sit', {
    arm: p > 0.322 ? 'wave' : 'none',
    wag: Math.sin(seconds * 9) * 2,
    croak: hump(p, 0.326, 0.334),
  });
}
function gutterRun(ctx: Ctx, p: number, seconds: number) {
  journey(ctx, p, seconds, { x: journeyX(p) + 30, y: 100, zoom: 1.6 });
  vignette(ctx, 0.3);
}
function frogRide(ctx: Ctx, p: number, seconds: number) {
  const v = track(p, [
    [0.235, 12, 104, 2.8],
    [0.3, 12, 104, 2.8],
    [0.318, 4, 102, 2.1],
    [0.34, -30, 100, 1.75],
  ]);
  journey(ctx, p, seconds, { ...v, x: journeyX(p) + v.x });
  vignette(ctx, 0.3);
}

// ——— The duck pond ———
const pondDrift = (q: number) => Math.sin((q - 0.388) * 80) * 1.5;
function pondBoat(p: number) {
  if (p < 0.388) {
    const t = ease(span(p, 0.34, 0.388));
    return { x: lerp(18, 150, t), y: lerp(106, 128, t) };
  }
  const glide =
    58 * easeOut(span(p, BOOP, BOOP + 0.014)) + 118 * easeIn(span(p, BOOP + 0.01, 0.48));
  return { x: 150 + pondDrift(Math.min(p, BOOP)) + glide, y: 128 + 4 * span(p, BOOP, 0.48) };
}
// Where each of the family settles once the circling stops: mother first, the booper last.
const SETTLE = [
  [34, -7, -1],
  [17, -12, -1],
  [-16, -11, 1],
  [-30, 3, 1],
] as const;
function family(p: number) {
  return SETTLE.map(([hx, hy, hf], i) => {
    const circle = (q: number) => {
      const a = ((q - 0.388) / 0.034) * Math.PI * 1.6 - i * 0.62;
      return {
        x: 150 + 38 * Math.cos(a),
        y: 126 + 11 * Math.sin(a),
        facing: (Math.sin(a) > 0 ? -1 : 1) as 1 | -1,
      };
    };
    if (p < 0.388) {
      const end = circle(0.388),
        t = ease(span(p, 0.342, 0.388));
      return {
        x: lerp(300 + i * 18, end.x, t),
        y: lerp(122 + (i % 2) * 3, end.y, t),
        facing: -1 as const,
      };
    }
    if (p < 0.422) return circle(p);
    const from = circle(0.422),
      t = ease(span(p, 0.422, 0.43));
    const watching = p > BOOP + 0.006;
    return {
      x: lerp(from.x, 150 + hx, t) + (i === 3 ? easeOut(span(p, BOOP, 0.47)) * 14 : 0),
      y: lerp(from.y, 128 + hy, t),
      facing: (watching ? 1 : t > 0.5 ? hf : from.facing) as 1 | -1,
    };
  });
}
function pond(ctx: Ctx, p: number, seconds: number) {
  sky(ctx, ['#76B3DA', '#93C5E2', '#B4D8E8'], 0, 72);
  for (let i = 0; i < 4; i++) {
    const x = ((i * 97 + seconds * 2) % 380) - 30;
    oval(ctx, x, 14 + (i % 2) * 10, 22, 6, '#F4F7F8');
    oval(ctx, x + 10, 10 + (i % 2) * 10, 12, 5, '#FFFFFF');
  }
  for (let i = 0; i < 10; i++) {
    const x = i * 34 + 8,
      y = 60 + (i % 3) * 5;
    box(ctx, x - 2, y, 4, 22, '#5E4A3A');
    oval(ctx, x, y - 4, 20, 15, i % 2 ? '#4E7F4A' : '#5B8F52');
    oval(ctx, x - 5, y - 9, 10, 7, '#6FA35E');
  }
  box(ctx, 40, 44, 6, 42, '#5E4A3A');
  oval(ctx, 44, 44, 30, 16, '#7BAA5C');
  for (let k = 0; k < 12; k++) {
    const x = 18 + k * 5;
    line(ctx, '#6E9E50', 2, [x, 46, x + Math.sin(seconds * 0.8 + k) * 2, 76 + (k % 3) * 4]);
  }
  box(ctx, 0, 78, W, 10, '#78A856');
  box(ctx, 0, 86, W, 2, '#5B8645');
  box(ctx, 0, 88, W, 92, '#5B97AA');
  box(ctx, 0, 88, W, 8, '#80B6C4');
  for (let i = 0; i < 10; i++) oval(ctx, i * 34 + 8, 98, 16, 3, alpha('#3F6F4A', 0.3));
  box(ctx, 0, 136, W, 44, '#508B9F');
  box(ctx, 0, 158, W, 22, '#47819A');
  for (let i = 0; i < 12; i++)
    box(
      ctx,
      ((i * 53 + seconds * 6) % 340) - 10,
      100 + ((i * 23) % 70),
      5,
      1,
      alpha(WATER_HI, 0.55),
    );
  // The canal comes in through a stone mouth; the pond spills out through a gap on the right.
  box(ctx, 0, 92, 24, 16, '#8D8A80');
  box(ctx, 0, 96, 17, 9, '#3F4B52');
  oval(ctx, 306, 124, 14, 7, '#8A887E');
  oval(ctx, 314, 144, 16, 8, '#7E7C73');
  box(ctx, 296, 130, 24, 8, '#5B97AA');
  for (let k = 0; k < 4; k++)
    box(ctx, 294 + ((seconds * 30 + k * 7) % 26), 131 + k * 2, 5, 1, '#E8F2F2');
  for (const [x, y, r, fl] of [
    [60, 150, 8, true],
    [232, 104, 6, false],
    [262, 160, 9, false],
    [96, 112, 5, false],
  ] as const) {
    oval(ctx, x, y, r, r * 0.3, '#4F8E3E');
    oval(ctx, x - r * 0.1, y - 0.5, r * 0.85, r * 0.22, '#65A84E');
    if (fl) disc(ctx, x - 2, y - 2, 2, '#F2A7C0');
  }
  // The boat and the family, drawn back to front.
  const boat = pondBoat(p);
  const ducks = family(p);
  const items: { y: number; paint: () => void }[] = [
    {
      y: boat.y,
      paint: () =>
        paperBoat(ctx, boat.x, boat.y + Math.sin(seconds * 2.2) * 0.5, 1, {
          tilt: Math.sin(seconds * 1.6) * 0.04 + hump(p, BOOP, BOOP + 0.01) * 0.12,
        }),
    },
  ];
  ducks.forEach((d, i) => {
    const adult = i === 0;
    const quack = adult ? Math.max(...QUACKS.map((q) => hump(p, q, q + 0.007))) : 0;
    const peep = !adult ? hump(p, PEEPS[i - 1], PEEPS[i - 1] + 0.006) : 0;
    const booper = i === 3;
    items.push({
      y: d.y,
      paint: () => {
        duck(ctx, d.x, d.y + Math.sin(seconds * 3 + i) * 0.4, adult ? 1.2 : 0.7, d.facing, adult, {
          tilt: booper ? hump(p, WHAT - 0.004, BOOP - 0.002) * 0.4 : 0,
          reach: booper ? hump(p, BOOP - 0.004, BOOP + 0.004) * 6 : 0,
          open: Math.max(quack, peep),
          flap: booper ? hump(p, 0.452, 0.464) * Math.abs(Math.sin(seconds * 18)) : 0,
        });
        if (booper) wonder(ctx, d.x + 5, d.y - 22, span(p, WHAT, WHAT + 0.004), p < BOOP);
      },
    });
  });
  items.sort((a, b) => a.y - b.y).forEach((item) => item.paint());
  // Reeds in the foreground.
  for (let k = 0; k < 10; k++) {
    const x = k < 5 ? 4 + k * 7 : 250 + k * 6,
      sway = Math.sin(seconds * 1.1 + k) * 1.5,
      top = 146 - (k % 3) * 7;
    line(ctx, '#4F7F3A', 1.5, [x, 184, x + sway, top]);
    if (k % 2 === 0) oval(ctx, x + sway, top + 3, 1.6, 4, '#7A5236');
  }
}
/** A duckling's "?" in a little thought bubble. */
function wonder(ctx: Ctx, x: number, y: number, pop: number, showing: boolean) {
  if (pop <= 0 || !showing) return;
  at(ctx, x, y, backOut(pop), () => {
    disc(ctx, 0, 0, 5, '#FFFFFF');
    poly(ctx, '#FFFFFF', [-3, 3, -5, 7, 0, 4]);
    scrawl(ctx, '?', -1, -2, INK);
  });
}
function pondWide(ctx: Ctx, p: number, seconds: number) {
  camera(
    ctx,
    track(p, [
      [0.34, 150, 104, 1.2],
      [0.395, 156, 112, 1.5],
    ]),
    () => pond(ctx, p, seconds),
  );
  vignette(ctx, 0.3);
}
function pondClose(ctx: Ctx, p: number, seconds: number) {
  camera(
    ctx,
    track(p, [
      [0.395, 150, 120, 2.8],
      [BOOP, 146, 120, 2.8],
      [0.466, 236, 124, 2.3],
      [0.48, 250, 124, 2.3],
    ]),
    () => pond(ctx, p, seconds),
  );
  vignette(ctx, 0.3);
}

// ——— The weir ———
const UP = 110; // the upper river's surface
const LIP_X = 206;
const POOL = 262;
function weirBoat(p: number) {
  if (p < LIP) return { x: lerp(40, LIP_X - 12, easeOut(span(p, 0.48, LIP))), y: UP + 5, turn: 0 };
  if (p < TIP) {
    // It teeters on the lip, bow dipping over the drop.
    const t = span(p, LIP, TIP);
    return {
      x: LIP_X - 12 + t * 3,
      y: UP + 5,
      turn: 0.05 + t * 0.12 + Math.max(0, Math.sin(t * 15)) * 0.16,
    };
  }
  if (p < 0.512) {
    const t = easeIn(span(p, TIP, 0.512));
    return { x: LIP_X - 9 + t * 10, y: UP + 5 + t * 3, turn: 0.2 + t * 0.6 };
  }
  const t = span(p, 0.512, PLUNGE);
  return {
    x: lerp(LIP_X + 1, LIP_X + 24, easeOut(t)),
    y: lerp(UP + 6, POOL, t * t * 0.5 + t * 0.5),
    turn: 0.8 + t * 1.6,
  };
}
/** The weir: `slow` stretches the water's motion for the slow-motion fall. */
function weir(ctx: Ctx, seconds: number, slow: number, relief: number) {
  sky(
    ctx,
    ['#5B6D78', '#6B7C85', '#7E8E93', '#92A09F'].map((c) => mix(c, '#A9C4C6', relief * 0.4)),
    0,
    120,
  );
  for (let i = 0; i < 12; i++)
    oval(ctx, i * 30 + 6, 104 - (i % 3) * 4, 20, 12, i % 2 ? '#40554E' : '#4A5F55');
  poly(ctx, '#3F4C47', [LIP_X + 16, 116, 250, 104, 320, 110, 320, 300, LIP_X + 16, 300]);
  for (let k = 0; k < 6; k++)
    line(ctx, '#56714F', 1.5, [262 + k * 9, 170 + (k % 3) * 20, 258 + k * 9, 160 + (k % 3) * 20]);
  box(ctx, 0, UP, LIP_X + 2, 12, '#55797F');
  poly(ctx, '#39463F', [0, UP + 10, LIP_X + 4, UP + 8, LIP_X + 6, 300, 0, 300]);
  // Mossy boulders stacked into the drop.
  for (let y = UP + 20, row = 0; y < POOL + 6; y += 15, row++)
    for (let x = (row % 2) * 13, k = 0; x < LIP_X + 6; x += 26, k++) {
      const r = rand(row * 31 + k * 7);
      oval(ctx, x, y, 12 + r * 6, 7 + r * 2, r > 0.5 ? '#44534B' : '#4B5B50');
      box(ctx, x - 6, y - 6 - r * 2, 8 + r * 4, 1, '#5E7462');
    }
  for (const [mx, my] of [
    [40, 140],
    [120, 170],
    [180, 210],
    [70, 230],
  ])
    oval(ctx, mx, my, 14, 5, '#4E6A48');
  for (let i = 0; i < 14; i++) {
    const u = (i * 37 + seconds * 18 * slow) % 210;
    box(ctx, u, UP + 2 + (i % 3) * 3, 4 + (u / 210) * 6, 1, '#9DBEC2');
  }
  box(ctx, LIP_X - 10, UP + 6, 14, 5, '#6B736E');
  // The fall: a curved sheet streaming down into the pool.
  poly(ctx, '#8DB7BF', [
    LIP_X,
    UP,
    LIP_X + 8,
    UP + 1,
    LIP_X + 15,
    UP + 10,
    LIP_X + 19,
    POOL + 4,
    LIP_X + 5,
    POOL + 4,
    LIP_X + 3,
    UP + 12,
  ]);
  for (let i = 0; i < 18; i++) {
    const y = UP + 8 + ((i * 29 + seconds * 60 * slow) % (POOL - UP - 8));
    box(ctx, LIP_X + 6 + (i % 4) * 3, y, 1, 6, '#E4F1F2');
  }
  box(ctx, 0, POOL, W, 40, '#3D6671');
  box(ctx, 0, POOL, W, 2, '#6C98A0');
  for (let i = 0; i < 9; i++) {
    const t = (seconds * 0.8 * slow + i / 9) % 1;
    oval(
      ctx,
      LIP_X + 12 + (i % 3) * 7 - 6 + t * 10,
      POOL + 1 - t * 2,
      4 + t * 3,
      2,
      alpha('#EEF6F6', 1 - t),
    );
  }
  glow(ctx, LIP_X + 12, POOL - 6, 50, '#E6F0F0', 0.4);
}
function weirLip(ctx: Ctx, p: number, seconds: number) {
  camera(
    ctx,
    track(p, [
      [0.48, 120, 112, 2.2],
      [LIP, 182, 122, 2.4],
      [TIP, 198, 124, 2.6],
      [0.512, 200, 126, 2.6],
    ]),
    () => {
      weir(ctx, seconds, 1, 0);
      const b = weirBoat(p);
      paperBoat(ctx, b.x, b.y, 1, { tilt: b.turn + Math.sin(seconds * 2) * 0.02 });
      if (p < TIP) box(ctx, b.x - 12, UP + 4, 24, 2, alpha('#9DBEC2', 0.5));
    },
    { w: W, h: 300 },
  );
  vignette(ctx, 0.55);
}
function weirFall(ctx: Ctx, p: number, seconds: number) {
  const b = weirBoat(p);
  camera(
    ctx,
    { x: 214, y: b.y + 6, zoom: 1.8 },
    () => {
      weir(ctx, seconds, 0.25, 0);
      // Slow motion: spray hangs in the air around the falling boat.
      for (let i = 0; i < 14; i++) {
        const x = LIP_X + 4 + rand(i * 2.3) * 40 + (p - 0.512) * 200 * (rand(i) - 0.3);
        const y = UP + 10 + rand(i * 5.1) * (POOL - UP) - (p - 0.512) * 300;
        box(ctx, x, y, 1, 2, alpha('#E4F1F2', 0.8));
      }
      paperBoat(ctx, b.x, b.y, 1, { tilt: b.turn });
      const splash = span(p, PLUNGE - 0.002, 0.538);
      if (splash > 0)
        for (let k = 0; k < 8; k++) {
          const a = (k / 7 - 0.5) * 2.4;
          box(
            ctx,
            b.x + Math.sin(a) * splash * 22,
            POOL - Math.cos(a) * splash * 18,
            2,
            2,
            '#EEF6F6',
          );
        }
    },
    { w: W, h: 300 },
  );
  vignette(ctx, 0.55);
}
function underwater(ctx: Ctx, p: number, seconds: number) {
  sky(ctx, ['#2E6F7C', '#225866', '#174352'], 0, H);
  box(ctx, 0, 0, W, 6, '#7FB9BF');
  for (let x = 0; x < W; x += 8)
    box(ctx, x, 6 + Math.sin(x * 0.1 + seconds * 3) * 1.5, 8, 2, '#5E9FA8');
  for (let i = 0; i < 4; i++) {
    const x = 30 + i * 80 + Math.sin(seconds * 0.5 + i) * 8;
    poly(ctx, alpha('#9FD3D6', 0.1), [x, 6, x + 20, 6, x + 70, H, x + 34, H]);
  }
  for (let i = 0; i < 8; i++) oval(ctx, i * 46 + 10, H + 4, 26, 14, '#10303D');
  const t = span(p, 0.538, 0.556);
  const y = t < 0.45 ? lerp(10, 92, easeOut(t / 0.45)) : lerp(92, -14, easeIn((t - 0.45) / 0.55));
  const turn = t < 0.45 ? 2.4 + t * 2 : lerp(3.3, Math.PI * 2, ease((t - 0.45) / 0.4));
  const bx = 160 + Math.sin(t * 6) * 10;
  for (let i = 0; i < 36; i++) {
    const rise = (seconds * (22 + rand(i) * 30) + rand(i * 1.3) * 190) % 190;
    const x = 40 + rand(i * 3.7) * 240 + Math.sin(seconds * 2 + i) * 3,
      size = 1 + (i % 3);
    disc(ctx, x, H + 5 - rise, size, alpha('#CFEFF2', 0.55));
    box(ctx, x - size * 0.5, H + 4 - rise - size * 0.5, 1, 1, '#FFFFFF');
  }
  // A trail of bubbles from the tumbling boat.
  for (let k = 0; k < 8; k++) {
    const age = (seconds * 1.6 + k / 8) % 1;
    disc(
      ctx,
      bx + Math.sin(k * 2.1 + seconds * 3) * 6,
      y - 10 - age * 50,
      1.5 + (k % 2),
      alpha('#E4F7F8', 1 - age),
    );
  }
  paperBoat(ctx, bx, y, 2.6, { tilt: turn, sog: 1, tint: '#1E5664', amount: 0.45 });
  vignette(ctx, 0.5, '#07202A');
}
function stillFloating(ctx: Ctx, p: number, seconds: number) {
  const relief = ease(span(p, 0.566, 0.59));
  camera(
    ctx,
    track(p, [
      [0.556, 270, 250, 3.2],
      [0.605, 262, 246, 2.7],
    ]),
    () => {
      weir(ctx, seconds, 1, relief);
      const x = 280;
      if (p < SURFACE)
        for (let k = 0; k < 5; k++) {
          const age = (seconds * 2 + k / 5) % 1;
          disc(ctx, x - 6 + k * 3, POOL - age * 3, 1 + age, alpha('#E4F7F8', 1 - age));
        }
      else {
        const pop = span(p, SURFACE, SURFACE + 0.008);
        const y = POOL + 16 * (1 - backOut(pop)) + Math.sin(seconds * 2) * 0.5;
        const ring = span(p, SURFACE, SURFACE + 0.02);
        ctx.strokeStyle = alpha('#E4F1F2', 1 - ring);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, POOL + 1, 8 + ring * 26, 1.5 + ring * 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        paperBoat(ctx, x, y, 1, { sog: 1, tilt: Math.sin(seconds * 1.4) * 0.06 - (1 - pop) * 0.3 });
        // It drains, a drop at a time.
        for (let k = 0; k < 2; k++) {
          const d = (seconds * 1.1 + k * 0.5) % 1;
          box(ctx, x - 9 + k * 17, y - 3 + d * 5, 1, 2, alpha('#D4EAF2', 1 - d));
        }
      }
    },
    { w: W, h: 300 },
  );
  glow(ctx, 320, -10, 220, '#FFE2A0', 0.4 * relief);
  vignette(ctx, 0.45 - relief * 0.15);
}

// ——— Out to sea ———
const HORIZON = 110;
function seaShot(ctx: Ctx, p: number, seconds: number) {
  const sunset = span(p, 0.605, 0.675);
  const night = ease(span(p, 0.668, 0.69));
  camera(
    ctx,
    track(p, [
      [0.605, 104, 138, 2.6],
      [0.655, 160, 90, 1],
      [0.69, 160, 90, 1],
      [0.74, 150, 112, 1.3],
    ]),
    () => {
      const early = ['#584F86', '#9A6390', '#E08470', '#F6B26C'];
      const late = ['#3E3A6E', '#7A4E80', '#C4665E', '#E88E5A'];
      const dark = ['#0C1230', '#131C44', '#1B2858', '#263768'];
      sky(
        ctx,
        early.map((c, i) => mix(mix(c, late[i], sunset), dark[i], night)),
        0,
        HORIZON + 1,
      );
      if (night > 0)
        faded(ctx, night, () => {
          starfield(ctx, seconds, { count: 50, seed: 9, top: 0, bottom: HORIZON - 12 });
          glow(ctx, 250, 50, 70, '#DCE6FF', 0.35);
          disc(ctx, 250, 50, 10, '#F4EFD9');
          disc(ctx, 247, 48, 2, '#DCD5BC');
          disc(ctx, 253, 53, 1.5, '#DCD5BC');
        });
      const sunY = lerp(100, 114, sunset);
      if (night < 1)
        faded(ctx, 1 - night, () => {
          glow(ctx, 228, sunY, 170, '#FFB070', 0.6);
          disc(ctx, 228, sunY, 38, '#FFB86E');
          disc(ctx, 228, sunY, 32, '#FFD48A');
        });
      // Gulls going home.
      if (night < 1)
        faded(ctx, 1 - night, () => {
          for (let i = 0; i < 3; i++) {
            const t = span(p, 0.61 + i * 0.012, 0.67 + i * 0.012);
            if (t > 0 && t < 1)
              gull(
                ctx,
                40 + t * 240 + i * 16,
                58 + i * 9 - t * 12,
                1,
                seconds * 7 + i * 2,
                '#3A2E4A',
              );
          }
        });
      // The river's far bank runs out in a spit; beyond is open sea.
      const land = mix('#3A3450', '#0C1026', night);
      poly(ctx, land, [
        0,
        HORIZON - 7,
        34,
        HORIZON - 9,
        58,
        HORIZON - 4,
        84,
        HORIZON + 1,
        0,
        HORIZON + 1,
      ]);
      oval(ctx, 12, HORIZON - 9, 10, 5, land);
      oval(ctx, 30, HORIZON - 10, 8, 4, land);
      const seaTop = mix(mix('#6C5A86', '#4D3F6E', sunset), '#121A3C', night);
      const seaDeep = mix(mix('#4A416A', '#342C55', sunset), '#0B1230', night);
      box(ctx, 0, HORIZON, W, H - HORIZON, seaTop);
      box(ctx, 0, HORIZON + 24, W, H, mix(seaTop, seaDeep, 0.5));
      box(ctx, 0, HORIZON + 46, W, H, seaDeep);
      // A path of light on the water: the sun's, then the moon's.
      const pathX = lerp(228, 250, night),
        glint = mix('#FFD08A', '#E8EEFF', night);
      for (let i = 0; i < 22; i++) {
        const w = lerp(34 - i * 0.8, 10 + i * 0.3, night);
        const x = pathX + Math.sin(seconds * 0.9 + i * 1.9) * (3 + i * 0.5);
        box(ctx, x - w / 2, HORIZON + 2 + i * 3.1, w, 1, alpha(glint, 0.6 - i * 0.02));
      }
      // Long swells rolling in.
      const crest = mix('#F6C79A', '#8FA3D6', night);
      for (let k = 0; k < 6; k++) {
        const ph = (seconds * 0.06 + k / 6) % 1,
          y = HORIZON + 3 + ph * ph * 68;
        for (let x = -((seconds * 4) % 40); x < W; x += 40)
          box(ctx, x + (k % 2) * 20, y, 24, 1, alpha(crest, 0.1 + ph * 0.3));
      }
      // The near bank of the river mouth, reeds and all.
      const near = mix('#2B2740', '#070A1A', night);
      poly(ctx, near, [0, 150, 26, 146, 52, 156, 70, 180, 0, 180]);
      for (let k = 0; k < 7; k++)
        line(ctx, near, 1.2, [
          6 + k * 6,
          152,
          5 + k * 6 + Math.sin(seconds + k) * 1.5,
          132 + (k % 3) * 5,
        ]);
      const bx = lerp(100, 150, span(p, 0.605, 0.74));
      paperBoat(ctx, bx, 140 + Math.sin(seconds * 1.1) * 1.4, 0.55, {
        sog: 1,
        tilt: Math.sin(seconds * 0.9) * 0.08,
        tint: mix('#E0906A', '#18244E', night),
        amount: lerp(0.22, 0.5, night),
      });
    },
  );
  vignette(ctx, 0.45 + night * 0.1);
}

// ——— The faraway beach ———
const TIDE = 144;
function palm(ctx: Ctx, x: number, y: number, h: number) {
  line(ctx, '#8A6A48', 2, [x, y, x + 2, y - h * 0.5, x + 1, y - h]);
  for (const [dx, dy] of [
    [-10, 4],
    [-7, -3],
    [0, -6],
    [7, -3],
    [10, 4],
  ])
    line(ctx, '#3F8A4E', 2, [
      x + 1,
      y - h,
      x + 1 + dx * 0.6,
      y - h + dy - 3,
      x + 1 + dx,
      y - h + dy,
    ]);
}
function dome(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, wall: string) {
  disc(ctx, x + w / 2, y, r, '#3E7CC0');
  box(ctx, x + w / 2 - 0.5, y - r - 3, 1, 3, '#E9C46A');
  box(ctx, x, y, w, h, wall);
  box(ctx, x + w / 2 - 2, y + h - 8, 4, 8, '#3E7CC0');
  disc(ctx, x + w / 2, y + h - 8, 2, '#3E7CC0');
}
/** A different town: domes, flat roofs, and a lighthouse, above a morning beach. */
function beach(ctx: Ctx, seconds: number) {
  sky(ctx, ['#93CBE0', '#BFE0E6', '#F2DCCB'], 0, 96, 0, 400);
  glow(ctx, 64, 70, 80, '#FFF0C0', 0.5);
  disc(ctx, 64, 70, 9, '#FFF6DA');
  for (let i = 0; i < 3; i++) {
    const x = 120 + i * 110 + Math.sin(seconds * 0.1 + i) * 4;
    oval(ctx, x, 24 + i * 9, 26, 5, '#FBF1EA');
    oval(ctx, x + 10, 21 + i * 9, 13, 4, '#FFFFFF');
  }
  box(ctx, 0, 94, 400, 40, '#5DB7C0');
  box(ctx, 0, 94, 400, 2, '#8FD0D2');
  box(ctx, 0, 108, 400, 26, '#4FA7B6');
  box(ctx, 0, 122, 400, 12, '#469BAC');
  for (let i = 0; i < 18; i++)
    box(ctx, ((i * 47 + seconds * 8) % 420) - 10, 99 + ((i * 7) % 30), 7, 1, '#D8F0EE');
  // The headland and its town.
  poly(ctx, '#D2AC7E', [256, 134, 268, 104, 290, 90, 330, 86, 400, 84, 400, 134]);
  poly(ctx, '#BE956A', [256, 134, 268, 104, 280, 114, 276, 134]);
  for (const y of [100, 112, 124]) box(ctx, 282, y, 118, 1, '#C49D70');
  poly(ctx, '#F4EFE6', [287, 90, 297, 90, 295, 62, 289, 62]);
  for (const y of [66, 76]) box(ctx, 288, y, 8, 4, '#D5503F');
  box(ctx, 288, 55, 8, 7, '#3B3E48');
  box(ctx, 289, 56, 6, 5, '#FFE9A0');
  poly(ctx, '#D5503F', [287, 55, 292, 49, 297, 55]);
  dome(ctx, 304, 72, 20, 16, 7, '#F6F2EA');
  box(ctx, 328, 56, 15, 32, '#F2A7A0');
  box(ctx, 327, 54, 17, 3, '#E48C84');
  disc(ctx, 335.5, 66, 3, '#FBE9D8');
  box(ctx, 333, 78, 5, 10, '#B45E58');
  dome(ctx, 348, 70, 22, 18, 8, '#F6F2EA');
  box(ctx, 374, 50, 14, 38, '#9FD6C0');
  box(ctx, 373, 48, 16, 3, '#86C2AA');
  for (const wy of [56, 68]) box(ctx, 379, wy, 4, 6, '#F4FBF8');
  box(ctx, 390, 64, 12, 24, '#F4D58A');
  palm(ctx, 266, 106, 24);
  palm(ctx, 318, 86, 18);
  // Wet sand, the lapping edge of the sea, dry sand.
  box(ctx, 0, 132, 400, 12, '#C9A77B');
  for (let i = 0; i < 8; i++) box(ctx, i * 52 + 10, 137 + (i % 3), 22, 1, '#D8BC94');
  const wash = Math.sin(seconds * 0.7) * 2;
  for (let x = 0; x < 400; x += 5)
    box(ctx, x, 131 + Math.sin(x * 0.06 + seconds * 1.2) * 1.5 + wash, 5, 2, '#F4FAF6');
  box(ctx, 0, 144, 400, 36, '#EACFA1');
  for (let i = 0; i < 30; i++) box(ctx, (i * 53) % 400, 148 + ((i * 17) % 30), 1, 1, '#D2B384');
  for (const [sx, sy] of [
    [90, 150],
    [180, 162],
    [300, 156],
  ]) {
    oval(ctx, sx, sy, 2.5, 1.5, '#F6E6E0');
    box(ctx, sx - 1, sy - 1, 1, 2, '#E3C7BE');
  }
  poly(
    ctx,
    '#E98A74',
    [
      150, 168, 152, 163, 154, 168, 158, 168, 155, 171, 156, 175, 152, 172, 148, 175, 149, 171, 146,
      168,
    ],
  );
}
function footprints(ctx: Ctx, to: number) {
  for (let x = 40, k = 0; x < to - 6; x += 8, k++)
    box(ctx, x, TIDE + 1 + (k % 2) * 2, 3, 1, '#B89468');
}
function beachFind(ctx: Ctx, p: number, seconds: number) {
  camera(
    ctx,
    track(p, [
      [0.74, 170, 100, 1.1],
      [0.762, 214, 112, 1.3],
      [0.772, 242, 124, 2.3],
      [0.79, 242, 122, 2.4],
    ]),
    () => {
      beach(ctx, seconds);
      const walk = span(p, 0.74, 0.764);
      const x = lerp(128, 230, walk) + ease(span(p, 0.771, 0.776)) * 6;
      footprints(ctx, x);
      const bending = hump(p, 0.772, 0.786);
      const lifted = p >= 0.779;
      const base = theo({
        step: walk < 1 ? seconds * 11 : undefined,
        lean: 0.08 + bending * 0.55,
        eyes: p >= FIND ? 'wide' : 'open',
        mouth: p >= FIND ? 'o' : 'smile',
      });
      const boatAt = { x: 252, y: TIDE - 1 };
      const f: Figure =
        walk < 1
          ? base
          : {
              ...base,
              arms: [
                0.1,
                lifted ? 1.7 : bending > 0.2 ? aim(x, TIDE, base, boatAt.x, boatAt.y) : 0.4,
              ],
            };
      drawTheo(ctx, x, TIDE, f);
      const back = handOf(x, TIDE, f, 'back');
      bucket(ctx, back.x, back.y + 9, 1);
      if (!lifted) paperBoat(ctx, boatAt.x, boatAt.y, 0.55, { sog: 1, tilt: 0.25 });
      else {
        const h = handOf(x, TIDE, f);
        paperBoat(ctx, h.x + 3, h.y + 1, 0.55, { sog: 1, tilt: -0.05 });
      }
    },
    { w: 400, h: H },
  );
  vignette(ctx, 0.3);
}
function readInsert(ctx: Ctx, p: number, seconds: number) {
  sandInsert(ctx, seconds);
  const cx = 160,
    cy = 100 + Math.sin(seconds * 1.3) + (1 - easeOut(span(p, 0.79, 0.796))) * 20;
  paperBoat(ctx, cx, cy, 3.6, { sog: 1, tilt: -0.04 });
  hand(ctx, cx - 62, cy + 30, 3, 1, THEO_SKIN, THEO_SHIRT, 0.5, true);
  hand(ctx, cx + 62, cy + 30, 3, -1, THEO_SKIN, THEO_SHIRT, -0.5, true);
  const d = (seconds * 0.9) % 1;
  box(ctx, cx + 22, cy + 3 + d * 60, 2, 4, alpha('#D4EAF2', 1 - d));
  vignette(ctx, 0.35);
}
function theoSmile(ctx: Ctx, p: number, seconds: number) {
  camera(
    ctx,
    track(p, [
      [0.81, 241, 117, 4.2],
      [0.828, 241, 116, 4.6],
    ]),
    () => {
      beach(ctx, seconds);
      const f = theo({
        arms: [0.1, 1.7],
        eyes: p < SMILE ? 'open' : 'happy',
        mouth: p < SMILE ? 'o' : p < 0.821 ? 'smile' : 'grin',
      });
      drawTheo(ctx, 236, TIDE, f);
      const h = handOf(236, TIDE, f);
      paperBoat(ctx, h.x + 3, h.y + 1, 0.55, { sog: 1, tilt: -0.05 });
    },
    { w: 400, h: H },
  );
  vignette(ctx, 0.35);
}
function replyInsert(ctx: Ctx, p: number, seconds: number) {
  sandInsert(ctx, seconds);
  const S = 3.3,
    cx = 160,
    cy = 92;
  // The notebook: he tears a page out, and the pad slides away.
  const tear = ease(span(p, 0.828, TEAR));
  const nx = 70 - easeIn(span(p, TEAR, TEAR + 0.004)) * 140;
  box(ctx, nx - 30, cy - 38, 62, 78, '#3F6FB0');
  box(ctx, nx - 27, cy - 36, 56, 72, '#F4EFE2');
  for (let k = 0; k < 8; k++) box(ctx, nx - 33, cy - 32 + k * 9, 6, 3, '#C9C9C9');
  const stage = p < PLANE_FOLDS[0] ? 0 : p < PLANE_FOLDS[1] ? 1 : 2;
  const squash = Math.max(...PLANE_FOLDS.map((f) => hump(p, f - 0.004, f + 0.003)));
  const letters = REPLY.filter((r) => p >= r + 0.0018).length;
  const px = lerp(nx + 12, cx, tear);
  ctx.save();
  ctx.translate(px, cy + (1 - tear) * 4);
  ctx.rotate((1 - tear) * -0.12);
  ctx.scale(S * (1 - squash * 0.5), S * (1 + squash * 0.1));
  planeFold(ctx, stage, letters);
  ctx.restore();
  hand(ctx, px - 60 + squash * 20, cy + 36, 3, 1, THEO_SKIN, THEO_SHIRT, 0.45, true);
  if (within(p, REPLY[0] - 0.006, REPLY[5] + 0.0075))
    writingHand(
      ctx,
      pencilTip(p, seconds, REPLY, 0.0025, (k) => ({ x: cx + (-9 + 4 * k) * S, y: cy - 3 * S }), S),
      THEO_SKIN,
      THEO_SHIRT,
      true,
    );
  else hand(ctx, px + 60 - squash * 20, cy + 36, 3, -1, THEO_SKIN, THEO_SHIRT, -0.45, true);
  vignette(ctx, 0.35);
}
function throwShot(ctx: Ctx, p: number, seconds: number) {
  camera(
    ctx,
    track(p, [
      [0.864, 196, 112, 1.6],
      [0.888, 160, 92, 1.3],
    ]),
    () => {
      beach(ctx, seconds);
      footprints(ctx, 236);
      bucket(ctx, 252, TIDE, 1.3);
      paperBoat(ctx, 252, TIDE - 9, 0.45, { sog: 1, tilt: 0.1 });
      const windup = within(p, 0.864, THROW),
        after = p >= THROW;
      const f = theo({
        facing: -1,
        arms: [0.2, windup ? -1.3 : p < GUST + 0.004 ? 2.4 : 2.6 + Math.sin(seconds * 12) * 0.35],
        eyes: after ? 'happy' : 'open',
        mouth: after ? 'grin' : 'smile',
        lean: windup ? -0.12 : after ? 0.08 : 0,
      });
      drawTheo(ctx, 236, TIDE, f);
      const h = handOf(236, TIDE, f);
      if (!after) planeSide(ctx, h.x, h.y - 1, 0.6, windup ? -0.3 : 0);
      else {
        // Off it goes: a gust catches it and lifts it away over the sea.
        const t = span(p, THROW, 0.888),
          lift = easeIn(span(p, GUST, 0.888));
        planeSide(ctx, h.x - t * 250, h.y - t * 24 - lift * 70, 0.6 - t * 0.35, 0.18 + lift * 0.25);
      }
      const gust = span(p, GUST - 0.004, 0.888);
      if (gust > 0 && gust < 1)
        for (let i = 0; i < 5; i++) {
          const x = 300 - gust * 360 + i * 26,
            y = 60 + i * 11;
          line(ctx, alpha('#FFFFFF', 0.7 * Math.sin(gust * Math.PI)), 1, [
            x,
            y,
            x + 18,
            y - 2,
            x + 30,
            y + 1,
          ]);
        }
    },
    { w: 400, h: H },
  );
  vignette(ctx, 0.3);
}

// ——— Home again ———
/** The reply's glide home: a swoop in from the right that lands at Ivy's boots. */
function glide(t: number) {
  const pts = [
    [340, 36],
    [236, 18],
    [214, 132],
    [DOOR + 26, STEP + 3],
  ];
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  const dw = [-3 * u * u, 3 * u * u - 6 * u * t, 6 * u * t - 3 * t * t, 3 * t * t];
  const x = w.reduce((s, c, i) => s + c * pts[i][0], 0),
    y = w.reduce((s, c, i) => s + c * pts[i][1], 0);
  const vx = dw.reduce((s, c, i) => s + c * pts[i][0], 0),
    vy = dw.reduce((s, c, i) => s + c * pts[i][1], 0);
  return { x, y, turn: clamp(Math.atan2(-vy, -vx), -0.8, 0.8) };
}
function eveningWait(ctx: Ctx, p: number, seconds: number) {
  camera(
    ctx,
    track(p, [
      [0.888, DOOR + 20, 114, 1.9],
      [ARRIVE, DOOR + 26, 110, 1.75],
      [ARRIVE + 0.01, 176, 100, 1.3],
      [LAND - 0.006, 166, 112, 1.5],
      [0.94, DOOR + 16, 124, 2.3],
    ]),
    () => {
      street(ctx, seconds, 1, 1);
      const noticed = p >= ARRIVE + 0.006;
      const f = ivy({
        sitting: true,
        hat: 'none',
        arms: noticed ? [0.4, 1.0] : [2.2, 2.3],
        lean: noticed ? 0 : 0.22,
        eyes: noticed ? 'wide' : 'sad',
        mouth: noticed ? 'o' : 'flat',
      });
      drawIvy(ctx, DOOR - 2, STEP + 1, f);
      if (p >= ARRIVE) {
        const t = 1 - (1 - span(p, ARRIVE, LAND)) ** 2;
        const g = glide(t);
        const skid = easeOut(span(p, LAND, LAND + 0.004)) * 3;
        planeSide(
          ctx,
          g.x - skid,
          g.y,
          0.55,
          p < LAND ? g.turn + Math.sin(seconds * 6) * 0.05 : 0.03,
        );
        const spark = hump(p, LAND, LAND + 0.01);
        if (spark > 0)
          for (let k = 0; k < 4; k++)
            twinkle(
              ctx,
              g.x - 8 + k * 6,
              g.y - 6 - (k % 2) * 4 - spark * 3,
              1,
              alpha('#FFF1B8', spark),
            );
      }
    },
  );
  vignette(ctx, 0.45);
}
function unfoldInsert(ctx: Ctx, p: number, seconds: number) {
  lap(ctx, 1);
  const S = 3.3,
    cx = 160,
    cy = 88 + Math.sin(seconds * 1.2);
  const open = p >= UNFOLD;
  const squash = hump(p, UNFOLD - 0.004, UNFOLD + 0.004);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(S * (1 - squash * 0.5) * (open ? 1 : 0.85), S * (1 + squash * 0.1) * (open ? 1 : 0.85));
  if (open) replySheet(ctx, 6, true);
  else planeTop(ctx);
  ctx.restore();
  const spread = open ? 0 : 14;
  hand(ctx, cx - 62 + spread + squash * 14, cy + 34, 3, 1, IVY_SKIN, RAINCOAT, 0.45);
  hand(ctx, cx + 62 - spread - squash * 14, cy + 34, 3, -1, IVY_SKIN, RAINCOAT, -0.45);
  vignette(ctx, 0.4);
}
function ivyGrin(ctx: Ctx, p: number, seconds: number) {
  camera(
    ctx,
    track(p, [
      [BEAM, DOOR + 3, 106, 4.2],
      [0.975, DOOR + 3, 106, 4.6],
    ]),
    () => {
      street(ctx, seconds, 1, 1);
      const f = ivy({ sitting: true, hat: 'none', arms: [1.3, 1.8], eyes: 'happy', mouth: 'grin' });
      drawIvy(ctx, DOOR - 2, STEP + 1, f);
      const h = handOf(DOOR - 2, STEP + 1, f);
      at(ctx, h.x + 5, h.y - 3, 0.45, () => replySheet(ctx, 6, true));
    },
  );
  glow(ctx, 60, 60, 200, '#FFC870', 0.25);
  vignette(ctx, 0.4);
}
function finale(ctx: Ctx, p: number, seconds: number) {
  camera(
    ctx,
    track(p, [
      [0.975, DOOR + 10, 110, 2.1],
      [1, DOOR + 18, 98, 1.45],
    ]),
    () => {
      street(ctx, seconds, 1, 1);
      // The reply keeps her company on the step while she folds the next boat.
      planeSide(ctx, DOOR - 21, STEP - 2, 0.6, 0.04);
      const f = ivy({
        sitting: true,
        hat: 'none',
        arms: [0.9, 1.25],
        eyes: 'happy',
        mouth: 'smile',
      });
      drawIvy(ctx, DOOR - 2, STEP + 1, f);
      const h = handOf(DOOR - 2, STEP + 1, f);
      const squash = hump(p, 0.986, 0.992);
      ctx.save();
      ctx.translate(h.x + 3, h.y - 3);
      ctx.scale(0.46 * (1 - squash * 0.5), 0.46);
      foldStage(ctx, p < 0.989 ? 0 : 1, 0);
      ctx.restore();
    },
  );
  vignette(ctx, 0.4);
}

// ——— The cut list ———
type Shot = (ctx: Ctx, p: number, seconds: number) => void;
const SHOTS: readonly (readonly [number, Shot])[] = [
  [0, doorstep],
  [0.035, foldAndWrite],
  [0.1, curb],
  [0.18, gutterRun],
  [0.235, frogRide],
  [0.34, pondWide],
  [0.395, pondClose],
  [0.48, weirLip],
  [0.512, weirFall],
  [0.538, underwater],
  [0.556, stillFloating],
  [0.605, seaShot],
  [0.74, beachFind],
  [0.79, readInsert],
  [0.81, theoSmile],
  [0.828, replyInsert],
  [0.864, throwShot],
  [0.888, eveningWait],
  [0.94, unfoldInsert],
  [BEAM, ivyGrin],
  [0.975, finale],
];

// ——— Music ———
const ROOT = 67; // G: the question climbs D → G; the answer falls G → D.
const THEME = [
  7,
  null,
  12,
  11,
  9,
  7,
  9,
  7,
  9,
  7,
  null,
  null,
  7,
  null,
  12,
  14,
  12,
  11,
  12,
  9,
  7,
  12,
  null,
  null,
];
const THEME_CHORDS = [0, 7, 5, 7, 0, 7, 5, 0];
// The pond's version: the same tune, skipping in quavers.
const SKIP = [
  7,
  9,
  12,
  null,
  12,
  null,
  11,
  9,
  7,
  null,
  2,
  null,
  9,
  null,
  5,
  null,
  9,
  null,
  7,
  null,
  11,
  null,
  14,
  null,
  16,
  null,
  12,
  null,
  7,
  null,
  14,
  12,
  11,
  null,
  7,
  null,
  9,
  12,
  9,
  null,
  5,
  null,
  12,
  null,
  null,
  null,
  null,
  null,
];
const ANSWER = [12, null, 7, 9, 11, 14, 12, null, null];

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const helloDownstreamScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: ROOT, voice: 'keys', intro: [7, 12, 14], outro: [0, 7, 12, 16] },
    (s) => {
      const beat = (bpm: number) => 60 / bpm / s.story;
      // ——— The doorstep: drips off the eaves (landing as they do on screen), a gutter trickle.
      for (const [x, , period, offset] of EAVES)
        for (let t = period - offset; t < s.time(0.18); t += period)
          s.fx('drip', (t - 3) / s.story, 0.18, 0.05, (x / W - 0.5) * 1.2);
      s.fx('water', 0, s.story * 0.1, 0.04, 0.2);
      s.fx('tweet', 0.008, 1.1, 0.05, 0.7);
      s.fx('chime', IDEA, 1.2, 0.09, 0.1);
      s.fx('rustle', 0.036, 0.35, 0.1);
      for (const f of FOLDS) s.fx('rustle', f - 0.004, 0.4, 0.16);
      for (const l of LETTERS) s.fx('scribble', l, 0.2, 0.14, 0.25);
      s.section({
        from: 0,
        to: 0.07,
        bpm: 108,
        root: ROOT,
        chords: [0, 5, 0, 7],
        groove: 'waltz',
        melody: [7, null, 12, null, null, null, 11, 9, 7, null, null, null],
        voice: 'keys',
        gain: 0.7,
        level: 0.4,
      });
      s.section({
        from: 0.07,
        to: 0.1,
        bpm: 108,
        root: ROOT,
        chords: [5, 7],
        groove: 'waltz',
        level: 0.35,
        fade: 0.3,
      });
      // The question, as the "?" goes on: D up to G, left hanging on A.
      [7, 12, 14].forEach((d, i) =>
        s.note(LETTERS[5] + 0.004 + i * 0.0035, ROOT + d, i === 2 ? 1.2 : 0.5, 'pluck', 0.1),
      );
      // ——— The curb: set it down, let it go.
      s.fx('splash', SET, 0.3, 0.07, 0.2);
      s.fx('water', 0.1, s.story * 0.24, 0.06, 0.3);
      s.fx('swish', ZIP, 0.5, 0.12, 0.6);
      s.section({
        from: 0.1,
        to: 0.18,
        bpm: 120,
        root: ROOT,
        chords: [0, 5, 7, 0],
        groove: 'waltz',
        melody: THEME.slice(0, 12),
        voice: 'pluck',
        gain: 0.75,
        level: 0.55,
      });
      // ——— Through town: a folk waltz. A plink under the bridge; the frog's ride.
      s.section({
        from: 0.18,
        to: 0.34,
        bpm: 138,
        root: ROOT,
        chords: THEME_CHORDS,
        groove: 'waltz',
        melody: THEME,
        voice: 'pluck',
        gain: 0.95,
        level: 0.8,
        fade: 0.4,
      });
      s.fx('drip', 0.216, 0.2, 0.07, -0.2);
      s.fx('drip', 0.2195, 0.2, 0.05, 0.2);
      s.fx('bounce', FROG_ON - 0.007, 0.3, 0.12, 0.2);
      s.fx('splash', FROG_ON, 0.35, 0.1, 0.1);
      for (const c of CROAKS) s.fx('croak', c, 0.55, 0.2, 0.15);
      s.fx('bounce', FROG_OFF, 0.3, 0.1, 0.3);
      s.fx('croak', 0.326, 0.45, 0.13, -0.2);
      // ——— The pond: the tune goes up a fourth and skips.
      s.section({
        from: 0.34,
        to: 0.48,
        bpm: 138,
        root: ROOT + 5,
        chords: THEME_CHORDS,
        groove: 'waltz',
        melody: SKIP,
        step: 0.5,
        voice: 'keys',
        gain: 0.75,
        level: 0.7,
        fade: 0.5,
      });
      s.fx('water', 0.34, s.story * 0.14, 0.04, -0.2);
      for (const q of QUACKS) s.fx('quack', q, 0.35, 0.16, 0.3);
      for (const q of PEEPS) s.fx('tweet', q, 0.4, 0.06, 0.2);
      s.fx('pop', WHAT, 0.15, 0.14);
      s.fx('boing', BOOP, 0.45, 0.12, -0.1);
      // ——— The weir: minor and ticking, then a held breath on the lip.
      s.fx('rumble', 0.48, (PLUNGE - 0.48) * s.story, 0.12, 0.2);
      s.section({
        from: 0.48,
        to: TIP,
        bpm: 84,
        root: 64,
        minor: true,
        chords: [0, 0, -4, -5],
        groove: 'tick',
        melody: [7, null, 5, null, 3, null, 2, null],
        voice: 'pluck',
        gain: 0.6,
        level: 0.6,
        fade: 0.3,
      });
      s.fx('creak', LIP + 0.003, 0.5, 0.1, 0.3);
      s.fx('creak', LIP + 0.009, 0.4, 0.1, 0.3);
      s.note(TIP - 0.002, 83, (PLUNGE - TIP) * s.story, 'pad', 0.035);
      s.note(TIP - 0.002, 76, (PLUNGE - TIP) * s.story, 'pad', 0.03);
      s.fx('swish', 0.512, (PLUNGE - 0.512) * s.story, 0.12, 0.3);
      s.fx('splash', PLUNGE, 1, 0.3, 0.2);
      // Under: muffled and bubbling.
      s.section({
        from: PLUNGE,
        to: 0.556,
        bpm: 60,
        root: 52,
        minor: true,
        chords: [0],
        level: 0.55,
        bass: false,
        fade: 0.3,
      });
      for (let i = 0; i < 8; i++)
        s.fx('bubble', 0.539 + i * 0.0022, 0.3, 0.1 + (i % 3) * 0.03, Math.sin(i * 2) * 0.5);
      s.fx('rumble', PLUNGE, (SURFACE - PLUNGE) * s.story, 0.05);
      // Up again: relief.
      s.fx('pop', SURFACE, 0.2, 0.15, 0.3);
      s.fx('splash', SURFACE, 0.4, 0.08, 0.3);
      s.fx('rumble', SURFACE, (0.605 - SURFACE) * s.story, 0.06, -0.4);
      s.chord(SURFACE, [55, 62, 67, 71], 3.2, 'pad', 0.045);
      [74, 79, 83, 86].forEach((n, i) => s.note(SURFACE + 0.004 + i * 0.004, n, 1.4, 'bell', 0.07));
      s.section({
        from: 0.562,
        to: 0.605,
        bpm: 90,
        root: ROOT,
        chords: [0, 5],
        melody: [null, null, 12, 14, 16, null, null, null],
        voice: 'keys',
        gain: 0.6,
        level: 0.45,
        fade: 0.6,
      });
      // ——— The sea: wide and slow, then alone under the moon.
      for (let q = 0.61; q < 0.74; q += 0.045)
        s.fx('wave', q, 3.2, q < 0.675 ? 0.12 : 0.08, Math.sin(q * 50) * 0.4);
      for (const [q, pan] of [
        [0.618, -0.4],
        [0.632, 0.2],
        [0.648, 0.5],
      ])
        s.fx('gull', q, 0.6, 0.09, pan);
      s.section({
        from: 0.605,
        to: 0.68,
        bpm: 56,
        root: 62,
        chords: [0, 5, -2, 5],
        melody: [12, null, null, 14, null, 9, null, null],
        voice: 'bell',
        gain: 0.55,
        level: 0.65,
        fade: 1.5,
      });
      s.section({
        from: 0.675,
        to: 0.74,
        bpm: 50,
        root: 62,
        minor: true,
        chords: [0, 5],
        level: 0.5,
        bass: false,
        fade: 1.5,
      });
      s.fx('wind', 0.68, 0.06 * s.story, 0.05);
      // The question again, and nobody to answer it.
      [69, 74, 76].forEach((n, i) =>
        s.note(0.7 + i * 0.007, n, i === 2 ? 2.4 : 1.6, 'bell', 0.08, 0.3),
      );
      // ——— The faraway beach: morning, and the tune in a new key.
      s.section({
        from: 0.74,
        to: 0.864,
        bpm: 126,
        root: 69,
        chords: THEME_CHORDS,
        groove: 'waltz',
        melody: THEME,
        voice: 'keys',
        gain: 0.6,
        level: 0.5,
        fade: 0.5,
      });
      for (const q of [0.742, 0.786, 0.83, 0.874]) s.fx('wave', q, 2.8, 0.08, -0.3);
      s.fx('gull', 0.75, 0.6, 0.07, -0.6);
      s.fx('chime', FIND, 1, 0.1, 0.3);
      s.fx('rustle', 0.778, 0.3, 0.08, 0.3);
      s.fx('giggle', SMILE + 0.003, 0.5, 0.1);
      s.fx('rustle', 0.828, 0.3, 0.12, -0.3);
      s.fx('crunch', TEAR - 0.001, 0.15, 0.1);
      for (const r of REPLY) s.fx('scribble', r, 0.13, 0.13, 0.2);
      // The answer: the question turned round, G down to D.
      s.note(REPLY[5] + 0.003, ROOT + 14, 0.5, 'pluck', 0.1);
      s.note(REPLY[5] + 0.0065, ROOT + 9, 1, 'pluck', 0.1);
      for (const f of PLANE_FOLDS) s.fx('rustle', f - 0.003, 0.3, 0.14);
      s.fx('swish', THROW, 0.5, 0.16, -0.4);
      s.fx('wind', GUST - 0.003, 2.4, 0.14, -0.5);
      [69, 73, 76, 81, 85, 88].forEach((n, i) =>
        s.note(GUST + i * 0.0022, n, 0.8, 'pluck', 0.07, -0.3 - i * 0.08),
      );
      // ——— Home: an evening of waiting, then the reply comes in to land.
      s.section({
        from: 0.888,
        to: UNFOLD,
        bpm: 66,
        root: ROOT,
        chords: [5, 0],
        melody: [null, 7, null, 4, null, null],
        voice: 'keys',
        gain: 0.45,
        level: 0.45,
        fade: 0.6,
      });
      s.fx('wind', ARRIVE, (LAND - ARRIVE) * s.story + 0.3, 0.08, 0.5);
      [86, 83, 79, 74].forEach((n, i) =>
        s.note(ARRIVE + i * 0.006, n, 0.9, 'pluck', 0.07, 0.6 - i * 0.2),
      );
      s.fx('sparkle', LAND, 1.2, 0.12, 0.1);
      s.fx('rustle', UNFOLD - 0.004, 0.45, 0.15);
      // HELLO! on the bells, over the main theme's warm return.
      s.note(UNFOLD, ROOT + 12, 0.8, 'bell', 0.1);
      s.note(UNFOLD + 2 * beat(132), ROOT + 7, 1.6, 'bell', 0.1);
      s.fx('giggle', BEAM + 0.002, 0.5, 0.1, 0.1);
      s.section({
        from: UNFOLD,
        to: 1,
        bpm: 132,
        root: ROOT,
        chords: [0, 7, 5, 0],
        groove: 'waltz',
        melody: ANSWER,
        voice: 'keys',
        gain: 1,
        level: 0.8,
        fade: 0.3,
      });
      s.chord(0.985, [55, 62, 67, 71], 3.4, 'pad', 0.035);
      s.fx('rustle', 0.987, 0.35, 0.1);
    },
  );

export const helloDownstream: FilmModule = {
  draw(ctx, p, seconds) {
    let paint = SHOTS[0][1];
    for (const [from, shotPaint] of SHOTS) if (p >= from) paint = shotPaint;
    paint(ctx, p, seconds);
    // Soft dips through black where the light changes most: night to morning, beach to dusk.
    const dip = (at: number, out: number, back: number) =>
      p < at ? ease(span(p, at - out, at)) : 1 - ease(span(p, at, at + back));
    veil(ctx, '#07090C', Math.max(dip(0.74, 0.012, 0.009), dip(0.888, 0.01, 0.008)));
    captions(ctx, p, [
      [0.114, 0.172, 'To anyone out there.'],
      [0.558, 0.604, 'Still floating.'],
      [0.688, 0.738, 'Some letters take the long way.'],
      [0.742, 0.79, 'Far away, another morning.'],
    ]);
  },
  score: helloDownstreamScore,
  look: {
    shade: '#12202A',
    ink: '#FFF3D6',
    accent: '#F2C14E',
    dedication: 'for everyone who ever wrote back',
  },
};
