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
  font,
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
  shade,
  sky,
  span,
  track,
  veil,
  vignette,
  W,
  within,
  write,
  type Ctx,
  type Figure,
  type View,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * THE LAST DUCKLING
 * Mother Duck marches her four ducklings through Forktown to the pond. The last and littlest,
 * the one with the tuft, chases a blue butterfly through a garden gate and gets lost. It
 * mistakes a rubber duck, a weathervane, and a duck-shaped cloud for its mother. At dusk, alone
 * by a puddle, the butterfly comes back, lands on its tuft, and leads it home.
 *
 * Screen direction carries the geography: the family always heads right, toward the pond. The
 * duckling breaks left through the gate, and only turns right again when the butterfly leads.
 * The beat constants below are shared by the art and the score, so every waddle, squeak,
 * creak, and splash sounds on its frame.
 */

// ——— Story beats (p), read by both the pictures and the score ———
// One beat of the march is 1/108 of the story: 120 bpm in the one-minute cut.
const BEAT = 1 / 108;
const HOP = 0.022; // the littlest one skips to catch up every ~1.2 s
const BELL = 0.046; // the waiting cyclist rings a friendly bell
const KEEP_UP = 0.068; // Mum glances back and quacks
const PASS = 0.128; // the butterfly crosses the duckling's nose
const STOP = 0.15;
const GLANCES = [0.166, 0.172, 0.177, 0.181] as const; // line, butterfly, line, butterfly
const THROUGH = 0.212; // the garden gate creaks
const SPOT_POOL = 0.249;
const SPLASH_POOL = 0.259;
const CUDDLE = 0.281;
const SQUEAK = 0.291;
const LAUGH = 0.295;
const SPOT_VANE = 0.321;
const CRATES = [0.34, 0.347, 0.354] as const;
const GUST = 0.365;
const SPOT_CLOUD = 0.393;
const DRIFT = 0.42;
const SIGH = 0.446;
const PEEPS = [0.5, 0.532, 0.546] as const;
const LAND = 0.562;
const LIFT = 0.588;
const SQUEEZE = 0.646;
const COUNT = [0.676, 0.684, 0.692] as const;
const MISSING = 0.7;
const SET_OFF = 0.709;
const ARRIVE = 0.722;
const SHOUT = 0.731;
const TRIP = 0.754;
const SPLASH = 0.765;
const WHIRL = 0.786;
const SCOOP = 0.822;
const PILE = [0.842, 0.85, 0.858] as const;

// ——— Palette ———
const INK = '#2A2530';
const FLUFF = '#F7D458';
const FLUFF_DARK = '#E2AE3C';
const FLUFF_LIGHT = '#FFF0A8';
const BILL = '#F08A3A';
const BILL_DARK = '#C4652A';
const WEB = '#EE8C3C';
const MOUTH = '#8C3A34';
const BLUSH = '#F28C8C';
const MUM = '#F7F1E1';
const MUM_SHADE = '#D8CBAE';
const MUM_WING = '#E9DFC8';
const MUM_LINE = '#BFAF90';
const BLUE = '#5AAEEF';
const BLUE_DARK = '#2F6FC2';
const BLUE_EDGE = '#1D3F7E';
const HEART = '#F26D7D';

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
/** The view camera() will actually use inside a world of size w × h. */
function fit(view: View, w: number, h: number): View {
  const hw = W / 2 / view.zoom,
    hh = H / 2 / view.zoom;
  return {
    x: w <= hw * 2 ? w / 2 : clamp(view.x, hw, w - hw),
    y: h <= hh * 2 ? h / 2 : clamp(view.y, hh, h - hh),
    zoom: view.zoom,
  };
}
/** World point → screen point for a fitted view. */
const toScreen = (v: View, x: number, y: number) => ({
  x: (x - v.x) * v.zoom + W / 2,
  y: (y - v.y) * v.zoom + H / 2,
});
const blinking = (seconds: number, seed: number) => (seconds * 0.31 + seed) % 1 < 0.03;
/** A waddle phase: `rate` feet per beat of the march. */
const waddle = (p: number, rate = 1) => (p / BEAT) * Math.PI * rate;

// ——— Faces ———
type Eyes = 'open' | 'wide' | 'happy' | 'sad' | 'closed' | 'up' | 'stern' | 'worried';
function eye(ctx: Ctx, x: number, y: number, kind: Eyes) {
  if (kind === 'wide') {
    disc(ctx, x + 1, y, 2.3, '#FFFFFF');
    box(ctx, x + 1, y - 0.6, 1.6, 1.6, INK);
  } else if (kind === 'happy')
    line(ctx, INK, 1, [x - 0.8, y + 0.8, x + 1, y - 0.9, x + 2.8, y + 0.8]);
  else if (kind === 'closed') line(ctx, INK, 1, [x - 0.8, y + 0.4, x + 2.6, y + 0.8]);
  else if (kind === 'up') {
    box(ctx, x, y - 1.8, 2, 2.4, INK);
    box(ctx, x + 1, y - 1.8, 1, 1, '#FFFFFF');
  } else if (kind === 'sad') {
    box(ctx, x, y - 0.2, 2, 1.8, INK);
    line(ctx, INK, 0.8, [x - 1.2, y - 1.6, x + 2.6, y - 3]);
  } else {
    box(ctx, x, y - 1, 2, 2.6, INK);
    box(ctx, x + 1, y - 1, 1, 1, '#FFFFFF');
    // Stern brows slope down toward the bill; worried ones rise toward it.
    if (kind === 'stern') line(ctx, INK, 1.1, [x - 1.6, y - 3.4, x + 2.8, y - 2.2]);
    if (kind === 'worried') line(ctx, INK, 0.9, [x - 1.4, y - 2.2, x + 2.6, y - 3.6]);
  }
}

// ——— The ducklings ———
type Chick = {
  step?: number;
  eyes?: Eyes;
  bill?: number;
  tuft?: boolean;
  /** Wind pushing the tuft back (0..1), or sadness drooping it (negative). */
  blown?: number;
  swim?: boolean;
  sit?: boolean;
  lean?: number;
  look?: number;
  wing?: number;
  squash?: number;
};
/** A duckling about 23 px tall at s = 1; (x, y) is the ground (or waterline) under it. */
function duckling(ctx: Ctx, x: number, y: number, s: number, facing: number, o: Chick = {}) {
  const swing = o.step === undefined ? 0 : Math.sin(o.step);
  const bob = o.step === undefined ? 0 : Math.abs(Math.sin(o.step)) * 1.2;
  const squash = o.squash ?? 1;
  at(
    ctx,
    x,
    y,
    s,
    () => {
      if (o.swim) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-24, -40, 48, 40);
        ctx.clip();
        ctx.translate(0, 5);
      } else if (o.sit) ctx.translate(0, 3);
      else {
        box(ctx, -2 + swing * 2, -4, 1, 3, WEB);
        box(ctx, 1 - swing * 2, -4, 1, 3, WEB);
        box(ctx, -4 + swing * 2, -2 - Math.max(0, swing) * 1.5, 4, 2, WEB);
        box(ctx, -1 - swing * 2, -2 - Math.max(0, -swing) * 1.5, 4, 2, WEB);
      }
      ctx.translate(0, -bob);
      ctx.scale(2 - squash, squash);
      ctx.rotate(o.lean ?? 0);
      poly(ctx, FLUFF_DARK, [-6, -10, -11, -14, -10, -8, -6, -5]);
      oval(ctx, 0, -8, 8.5, 6.5, FLUFF_DARK);
      oval(ctx, 0.6, -8.8, 7.6, 5.7, FLUFF);
      oval(ctx, 3, -6.2, 4.4, 3.2, FLUFF_LIGHT);
      const wing = o.wing ?? 0;
      oval(ctx, -2.5, -9.5 - wing * 2.5, 4.6, 2.8, FLUFF_DARK, -0.2 - wing * 0.9);
      ctx.save();
      ctx.translate(3, -12);
      ctx.rotate(o.look ?? 0);
      disc(ctx, 1, -5, 5.8, FLUFF);
      box(ctx, -2, -9.5, 3, 2, FLUFF_LIGHT);
      if (o.tuft) {
        const lift = o.blown ?? 0;
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + (i - 1) * 0.5 - lift * 1.2;
          const len = 4.5 - Math.abs(i - 1);
          const bx = 0.5 + (i - 1) * 1.2,
            by = -10.4;
          line(ctx, FLUFF_DARK, 1.3, [
            bx,
            by,
            bx + Math.cos(a) * len * 0.6,
            by + Math.sin(a) * len * 0.6,
            bx + Math.cos(a + 0.9) * len,
            by + Math.sin(a + 0.9) * len,
          ]);
        }
      }
      const open = o.bill ?? 0;
      if (open > 0.05) {
        poly(ctx, MOUTH, [5.5, -3.8, 10.5, -4 - open * 1.4, 10, -1.6 + open * 1.6, 5.5, -2]);
        poly(ctx, BILL, [5.5, -5, 11, -4.6 - open * 1.6, 11, -3.4 - open * 1.6, 5.5, -3.4]);
        poly(ctx, BILL_DARK, [5.5, -2.4, 10, -1.6 + open * 1.6, 10, -0.6 + open * 1.6, 5.5, -1]);
      } else {
        poly(ctx, BILL, [5.5, -5, 11, -4, 11, -2.4, 5.5, -1.8]);
        box(ctx, 6, -3, 4, 1, BILL_DARK);
      }
      eye(ctx, 2.4, -7, o.eyes ?? 'open');
      box(ctx, 2, -3.6, 2, 1, alpha(BLUSH, 0.75));
      ctx.restore();
      if (o.swim) {
        ctx.restore();
        oval(ctx, 0, 0, 10, 1.4, alpha('#FFFFFF', 0.45));
      }
    },
    facing,
  );
}

// ——— Mother Duck ———
type Mum = {
  step?: number;
  eyes?: Eyes;
  bill?: number;
  swim?: boolean;
  look?: number;
  /** Turns her head back over her shoulder. */
  back?: boolean;
  wing?: number;
  lean?: number;
  ruffle?: number;
  /** Painted between her body and her wing, in her own coordinates. */
  tucked?: () => void;
};
/** Mother Duck, about 45 px tall on land at s = 1; (x, y) is the ground (or waterline). */
function mother(ctx: Ctx, x: number, y: number, s: number, facing: number, o: Mum = {}) {
  const swing = o.step === undefined ? 0 : Math.sin(o.step);
  const bob = o.step === undefined ? 0 : Math.abs(Math.sin(o.step)) * 1.6;
  at(
    ctx,
    x,
    y,
    s,
    () => {
      if (o.swim) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-40, -70, 80, 70);
        ctx.clip();
        ctx.translate(0, 8);
      } else {
        line(ctx, WEB, 2, [-4, -9, -4 + swing * 3, -1]);
        line(ctx, WEB, 2, [4, -9, 4 - swing * 3, -1]);
        box(ctx, -7 + swing * 3, -2 - Math.max(0, swing) * 2, 7, 2, WEB);
        box(ctx, 1 - swing * 3, -2 - Math.max(0, -swing) * 2, 7, 2, WEB);
      }
      ctx.translate(0, -bob - 16);
      ctx.rotate(o.lean ?? 0);
      ctx.translate(0, 16);
      poly(ctx, MUM_SHADE, [-12, -19, -22, -28, -19, -15, -12, -10]);
      poly(ctx, MUM, [-12, -19, -20, -26, -17, -17]);
      oval(ctx, 0, -16, 16, 10, MUM_SHADE);
      oval(ctx, 1, -17.6, 14.6, 8.4, MUM);
      box(ctx, -7, -25, 11, 1, alpha('#FFFFFF', 0.8));
      o.tucked?.();
      const ruffle = o.ruffle ?? 0;
      if (ruffle > 0)
        for (let k = 0; k < 4; k++) {
          const rx = -12 + k * 6,
            ry = -25 + Math.abs(k - 1.5) * 1.5;
          line(ctx, MUM_LINE, 1, [rx, ry, rx - 1 - k * 0.5, ry - 3 * ruffle]);
        }
      ctx.save();
      ctx.translate(6, -19);
      ctx.rotate((o.wing ?? 0) * 1.1);
      oval(ctx, -8.5, 1.5, 10.5, 5.6, MUM_WING, -0.12);
      line(ctx, MUM_LINE, 1, [-17, 3.5, -10, 5.5, -2, 4]);
      line(ctx, MUM_LINE, 1, [-16, 1, -12, 2.5]);
      ctx.restore();
      ctx.save();
      ctx.translate(9, -22);
      if (o.back) ctx.scale(-1, 1);
      ctx.rotate(o.look ?? 0);
      box(ctx, -3, -14, 8, 16, MUM);
      disc(ctx, 2, -17, 7.2, MUM);
      box(ctx, -2, -23, 4, 2, '#FFFFFF');
      const open = o.bill ?? 0;
      if (open > 0.05) {
        poly(ctx, MOUTH, [7.5, -16, 17, -17 - open * 2, 16, -12 + open * 2, 7.5, -13.6]);
        poly(ctx, BILL, [7.5, -18.5, 18, -17.4 - open * 2.4, 18, -15.2 - open * 2.4, 7.5, -15.4]);
        poly(ctx, BILL_DARK, [
          7.5,
          -14.2,
          16.5,
          -13 + open * 2.2,
          16.5,
          -11 + open * 2.2,
          7.5,
          -12,
        ]);
      } else {
        poly(ctx, BILL, [7.5, -18.5, 18, -16.6, 18, -13.8, 7.5, -13]);
        box(ctx, 8, -14.8, 9, 1, BILL_DARK);
      }
      box(ctx, 10, -17.4, 1, 1, BILL_DARK);
      eye(ctx, 3.4, -19.4, o.eyes ?? 'stern');
      box(ctx, 2.5, -15, 3, 1, alpha(BLUSH, 0.5));
      ctx.restore();
      if (o.swim) {
        ctx.restore();
        oval(ctx, 0, 0, 19, 2.2, alpha('#FFFFFF', 0.35));
      }
    },
    facing,
  );
}

// ——— The blue butterfly ———
/** `flap` is how open the wings are (0..1); about 15 px across at s = 1. */
function butterfly(ctx: Ctx, x: number, y: number, s: number, flap: number, turn = 0) {
  at(
    ctx,
    x,
    y,
    s,
    () => {
      const w = 0.2 + 0.8 * flap;
      for (const side of [-1, 1]) {
        oval(ctx, side * 2.4 * w, 2, 2.8 * w, 2.3, BLUE_EDGE, side * 0.5);
        oval(ctx, side * 2.3 * w, 1.8, 2.2 * w, 1.8, BLUE_DARK, side * 0.5);
        oval(ctx, side * 3.4 * w, -1.6, 3.9 * w, 3.1, BLUE_EDGE, side * -0.4);
        oval(ctx, side * 3.3 * w, -1.7, 3.3 * w, 2.6, BLUE, side * -0.4);
        box(ctx, side * 4.2 * w - 0.5, -2.6, 1, 1, '#E4F4FF');
      }
      box(ctx, -0.5, -3, 1, 6.5, '#2B2A3A');
      line(ctx, '#2B2A3A', 0.6, [-0.3, -3, -1.6, -6, -2.2, -6]);
      line(ctx, '#2B2A3A', 0.6, [0.3, -3, 1.6, -6, 2.2, -6]);
    },
    1,
    turn,
  );
}
/** Wings beat fast in flight and fan slowly at rest. */
const wingbeat = (seconds: number, resting = 0) =>
  lerp(Math.abs(Math.sin(seconds * 13)), 0.55 + Math.sin(seconds * 1.7) * 0.4, resting);
/** A butterfly's wandering wobble around its path. */
const flit = (seconds: number, seed = 0) => ({
  x: Math.sin(seconds * 1.9 + seed) * 3 + Math.sin(seconds * 4.3 + seed) * 1,
  y: Math.sin(seconds * 3.1 + seed * 2) * 2.5 + Math.abs(Math.sin(seconds * 13)) * -1.2,
});

// ——— Hearts, bubbles, and counting ———
function heart(ctx: Ctx, x: number, y: number, size: number, broken = 0) {
  const draw = (dx: number, dy: number) => {
    disc(ctx, x + dx - size * 0.48, y + dy, size * 0.55, HEART);
    disc(ctx, x + dx + size * 0.48, y + dy, size * 0.55, HEART);
    poly(ctx, HEART, [
      x + dx - size,
      y + dy + size * 0.15,
      x + dx + size,
      y + dy + size * 0.15,
      x + dx,
      y + dy + size * 1.2,
    ]);
    box(ctx, x + dx - size * 0.7, y + dy - size * 0.3, 1, 1, '#FFD8DD');
  };
  if (broken <= 0) return draw(0, 0);
  // Cracked down the middle, the halves sag apart.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(side < 0 ? x - size * 2 : x, y - size * 2, size * 2, size * 4);
    ctx.clip();
    draw(side * broken * 2, broken * 3);
    ctx.restore();
  }
}
/** A speech bubble in screen space that pops in with a little overshoot. */
function bubble(ctx: Ctx, text: string, x: number, y: number, amount: number, tailX: number) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(amount * 3);
  ctx.translate(x, y);
  const pop = backOut(amount);
  ctx.scale(pop, pop);
  ctx.font = font('mono', 8);
  const w = ctx.measureText(text).width + 12;
  poly(ctx, INK, [-4, 6, 4, 6, tailX - x, 14]);
  box(ctx, -w / 2 - 1, -9, w + 2, 16, INK);
  box(ctx, -w / 2 - 2, -8, w + 4, 14, INK);
  box(ctx, -w / 2, -8, w, 14, '#FFFFFF');
  box(ctx, -w / 2 - 1, -7, w + 2, 12, '#FFFFFF');
  poly(ctx, '#FFFFFF', [-3, 5, 3, 5, (tailX - x) * 0.8, 12]);
  write(ctx, text, 0, 2, { size: 8, color: INK });
  ctx.restore();
}
/** A counted number (or a question mark) that pops up over a duckling's head. */
function tally(ctx: Ctx, text: string, x: number, y: number, amount: number, color = INK) {
  if (amount <= 0) return;
  const pop = backOut(clamp(amount * 2));
  at(ctx, x, y - pop * 3, pop, () => {
    disc(ctx, 0, -3, 5, alpha('#FFFFFF', 0.92));
    write(ctx, text, 0, 0, { size: 8, color });
  });
}

// ——— Townsfolk ———
const GUARD: Figure = {
  skin: '#E8B48E',
  hair: '#7A5A48',
  coat: '#E3DE48',
  legs: '#2E3D66',
  shoes: '#2A2530',
  build: 'adult',
  hat: 'cap',
  hatColor: '#F4F1E6',
  hairStyle: 'bob',
  size: 1.2,
  facing: -1,
};
/** The crossing guard, holding her STOP sign up (raise 0..1). */
function guard(ctx: Ctx, x: number, y: number, raise: number, seconds: number) {
  const f: Figure = {
    ...GUARD,
    arms: [0.15, lerp(0.35, 2.75, raise)],
    eyes: blinking(seconds, 0.4) ? 'closed' : 'open',
  };
  person(ctx, x, y, f);
  // Hi-vis stripes across the coat.
  box(ctx, x - 5, y - 20, 10, 1.4, '#F4F1E6');
  box(ctx, x - 5, y - 25, 10, 1.4, '#F4F1E6');
  const hand = handOf(x, y, f);
  line(ctx, '#EDE7DA', 1.6, [hand.x, hand.y + 5, hand.x, hand.y - 16]);
  disc(ctx, hand.x, hand.y - 23, 8.5, '#FFFFFF');
  disc(ctx, hand.x, hand.y - 23, 7.3, '#D63B3B');
  write(ctx, 'STOP', hand.x, hand.y - 21, { size: 5, color: '#FFFFFF' });
}
/** A cyclist waiting up the road, seen from the front, with flowers in the basket. */
function cyclist(ctx: Ctx, x: number, y: number, s: number, ring: number) {
  at(ctx, x, y, s, () => {
    box(ctx, -1, -11, 2, 11, '#26262E');
    line(ctx, '#C8433C', 1.4, [0, -10, 0, -17]);
    box(ctx, 4, -21, 2, 21, '#3A3A48');
    box(ctx, -6, -21, 2, 8, '#3A3A48');
    box(ctx, -4, -19, 8, 5, '#B98A56');
    disc(ctx, -2, -20, 1.5, '#F28CA0');
    disc(ctx, 2, -20.5, 1.5, '#FFFFFF');
    line(ctx, '#3A3A48', 1.2, [-7, -22, 7, -22]);
    box(ctx, -5, -34, 10, 13, '#4B7FB8');
    line(ctx, '#4B7FB8', 2, [-4, -32, -7 + ring * 2, -23 - ring * 3]);
    line(ctx, '#4B7FB8', 2, [4, -32, 7, -23]);
    disc(ctx, 0, -39, 4.6, '#C98E6A');
    oval(ctx, 0, -42, 5.2, 3.2, '#F2C14E');
    box(ctx, -2, -39, 1, 1, INK);
    box(ctx, 1, -39, 1, 1, INK);
    box(ctx, -1, -36.5, 2, 1, INK);
  });
}
const KID: Figure = {
  skin: '#9A6A48',
  hair: '#2E2224',
  coat: '#E0564A',
  legs: '#9A6A48',
  shoes: '#9A6A48',
  build: 'kid',
  size: 1.8,
  facing: -1,
  hat: 'brim',
  hatColor: '#F2C14E',
  sitting: true,
};
function kid(ctx: Ctx, x: number, y: number, laugh: number, seconds: number) {
  const clap = Math.sin(seconds * 16) * 0.25;
  person(ctx, x, y, {
    ...KID,
    arms: laugh > 0 ? [0.9 + clap, 1.4 - clap] : [0.3, 0.6],
    eyes: laugh > 0 ? 'happy' : blinking(seconds, 0.7) ? 'closed' : 'open',
    mouth: laugh > 0 ? 'grin' : 'o',
    lean: laugh > 0 ? -0.12 + Math.sin(seconds * 16) * 0.04 : 0.05,
  });
}

// ——— Town pieces ———
type House = readonly [x: number, w: number, top: number, wall: string, roof: string];
function houses(ctx: Ctx, row: readonly House[], base: number, night = 0) {
  for (const [x, w, top, wall, roof] of row) {
    const walls = mix(wall, '#3A3552', night * 0.55),
      tiles = mix(roof, '#2A2440', night * 0.55);
    box(ctx, x + w * 0.64, top - w * 0.26, 5, 9, tiles);
    poly(ctx, tiles, [x - 3, top + 1, x + w / 2, top - w * 0.3, x + w + 3, top + 1]);
    box(ctx, x, top, w, base - top, walls);
    box(ctx, x, top, 3, base - top, alpha('#0B0E14', 0.12));
    for (let wy = top + 7; wy < base - 16; wy += 15)
      for (const wx of [x + 6, x + w - 14]) {
        box(ctx, wx - 1, wy - 1, 10, 10, mix('#F4EEDF', '#6C6478', night * 0.5));
        box(ctx, wx, wy, 8, 8, mix('#9CC3D4', '#FFC46A', night));
      }
    box(ctx, x + w / 2 - 4, base - 13, 8, 13, mix(roof, '#1A1622', 0.15 + night * 0.4));
  }
}
function tree(ctx: Ctx, x: number, y: number, r: number, leaf: string, dark: string) {
  box(ctx, x - 2, y - r, 4, r, '#6A4E3C');
  disc(ctx, x, y - r * 1.5, r, dark);
  disc(ctx, x - r * 0.45, y - r * 1.4, r * 0.7, leaf);
  disc(ctx, x + r * 0.3, y - r * 1.85, r * 0.62, leaf);
}
function lamppost(ctx: Ctx, x: number, y: number, lit: number) {
  box(ctx, x - 1, y - 44, 2, 44, '#3B3F4E');
  box(ctx, x - 3, y - 3, 6, 3, '#3B3F4E');
  box(ctx, x - 4, y - 50, 8, 7, mix('#5A6070', '#FFE3A0', lit));
  box(ctx, x - 5, y - 52, 10, 2, '#3B3F4E');
  if (lit > 0) glow(ctx, x, y - 46, 30, '#FFD78A', 0.4 * lit);
}
function flower(ctx: Ctx, x: number, y: number, h: number, petal: string, sway: number) {
  line(ctx, '#4E8A45', 1, [x, y, x + sway, y - h]);
  disc(ctx, x + sway, y - h, 2, petal);
  box(ctx, x + sway - 0.5, y - h - 0.5, 1, 1, '#FFE27A');
}
function reeds(ctx: Ctx, x: number, y: number, n: number, seconds: number, color: string) {
  for (let k = 0; k < n; k++) {
    const rx = x + k * 5,
      sway = Math.sin(seconds * 1.1 + k + x) * 1.5,
      top = y - 18 - (k % 3) * 7;
    line(ctx, color, 1.5, [rx, y, rx + sway, top]);
    if (k % 2 === 0) oval(ctx, rx + sway, top + 3, 1.6, 4, '#7A5236');
  }
}

// ——— The mistaken mothers ———
function pool(ctx: Ctx, x: number, y: number, seconds: number) {
  oval(ctx, x, y + 3, 47, 12, '#2F6DB0');
  oval(ctx, x, y, 47, 11, '#5CA6E6');
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    box(ctx, x + Math.cos(a) * 44 - 1, y + Math.sin(a) * 10, 3, 1, '#FFFFFF');
  }
  oval(ctx, x, y + 1, 41, 8, '#86D4EC');
  oval(ctx, x - 8, y - 1, 26, 4, '#A9E6F4');
  for (let k = 0; k < 5; k++)
    box(ctx, x - 30 + ((k * 17 + seconds * 5) % 60), y - 2 + (k % 3) * 3, 5, 1, '#D8F4FA');
}
/** A yellow rubber duck; `squeeze` squashes it flat for the squeak. */
function rubberDuck(ctx: Ctx, x: number, y: number, s: number, squeeze: number, facing = -1) {
  oval(ctx, x, y + 1, 11 * s, 1.6 * s, alpha('#FFFFFF', 0.5));
  at(
    ctx,
    x,
    y,
    s,
    () => {
      ctx.scale(1 + squeeze * 0.22, 1 - squeeze * 0.3);
      poly(ctx, '#FFDC34', [-7, -7, -12, -12, -10, -4]);
      oval(ctx, 0, -4, 9.5, 5.5, '#E7B51C');
      oval(ctx, 0.5, -5, 8.5, 4.6, '#FFDC34');
      oval(ctx, -1.5, -5.5, 4.5, 2.2, '#F2C62A', -0.2);
      disc(ctx, 4, -12.5, 5.2, '#FFDC34');
      box(ctx, 1, -16, 2, 2, '#FFF7C4');
      poly(ctx, '#F4702C', [8.5, -13, 14, -12, 13.2, -9.6, 8.5, -10]);
      disc(ctx, 5.4, -14, 1.2, '#1E1E24');
      box(ctx, 5, -15, 1, 1, '#FFFFFF');
    },
    facing,
  );
}
function crate(ctx: Ctx, x: number, y: number, w: number, h: number) {
  box(ctx, x, y, w, h, '#B98A56');
  box(ctx, x, y, w, 2, '#D2A673');
  box(ctx, x + 1, y + h / 2 - 0.5, w - 2, 1, '#8E6438');
  box(ctx, x + 2, y + 2, 2, h - 3, '#9E7242');
  box(ctx, x + w - 4, y + 2, 2, h - 3, '#9E7242');
}
const IRON = '#3D3A48';
/** A duck-shaped weathervane on its rod; `spin` turns it about the pole. */
function vane(ctx: Ctx, x: number, y: number, s: number, spin: number) {
  line(ctx, IRON, 1.2, [x, y, x, y - 20 * s]);
  line(ctx, IRON, 1, [x - 7 * s, y - 9 * s, x + 7 * s, y - 9 * s]);
  disc(ctx, x, y - 20 * s, 1.5 * s, IRON);
  const turn = Math.cos(spin);
  at(ctx, x, y - 22 * s, s, () => {
    ctx.scale(Math.sign(turn || 1) * Math.max(0.06, Math.abs(turn)), 1);
    line(ctx, IRON, 1, [-13, 0, 13, 0]);
    poly(ctx, IRON, [13, 0, 10, -2, 10, 2]);
    poly(ctx, IRON, [-12, 0, -16, -4, -15, 0, -16, 4]);
    poly(ctx, IRON, [-6, -6, -12, -12, -9, -3]);
    oval(ctx, 0, -5, 8.5, 4.4, IRON);
    box(ctx, 4, -13, 3.5, 8, IRON);
    disc(ctx, 6, -14, 3.6, IRON);
    poly(ctx, IRON, [8.5, -15, 13.5, -14, 13.5, -12.4, 8.5, -12.4]);
    box(ctx, 6.5, -15.5, 1, 1, '#E7F2F6');
    oval(ctx, -1, -7.5, 5, 1, alpha('#FFFFFF', 0.22));
  });
}
// A cloud that looks exactly like Mum: [dx, dy, r, drift x, drift y].
const CLOUD_PUFFS = [
  [-34, -9, 6, -40, -6],
  [-28, -2, 8, -34, 2],
  [-17, 2, 10, -22, 8],
  [-3, 4, 12, -4, 14],
  [11, 3, 11, 14, 12],
  [23, 0, 8.5, 30, 6],
  [-13, -6, 9, -12, -4],
  [3, -7, 10, 6, -8],
  [17, -12, 6.5, 26, -18],
  [19, -22, 6, 34, -30],
  [22, -32, 8.5, 44, -44],
  [33, -32, 4.5, 66, -40],
  [38, -30.5, 3.5, 80, -32],
] as const;
function cloudMum(ctx: Ctx, x: number, y: number, apart: number, seconds: number) {
  const place = ([dx, dy, r, ax, ay]: (typeof CLOUD_PUFFS)[number]) => ({
    x: x + dx + ax * apart * 1.3 + Math.sin(seconds * 0.4 + dx) * 0.6,
    y: y + dy + ay * apart * 0.7,
    r: r * (1 - apart * 0.3),
  });
  for (const puff of CLOUD_PUFFS) {
    const c = place(puff);
    disc(ctx, c.x, c.y + 2.5, c.r, '#D3DFEC');
  }
  for (const puff of CLOUD_PUFFS) {
    const c = place(puff);
    disc(ctx, c.x, c.y, c.r, '#FFFFFF');
  }
  faded(ctx, 1 - apart * 4, () => disc(ctx, x + 24, y - 34, 1.4, '#9DCBE6'));
}
/** A front-facing garden fence with a gap under its boards. */
function fence(ctx: Ctx, x0: number, x1: number, top: number, gy: number, dusk: number) {
  const wood = mix('#B08A62', '#5E5468', dusk),
    edge = mix('#8C6A4A', '#463E54', dusk),
    cap = mix('#C9A57A', '#72677E', dusk);
  for (let x = x0; x < x1; x += 9) {
    const t = top + (Math.floor(x / 9) % 2);
    box(ctx, x, t, 8, gy - 4 - t, wood);
    poly(ctx, cap, [x, t, x + 4, t - 4, x + 8, t]);
    box(ctx, x + 7, t, 1, gy - 4 - t, edge);
  }
  box(ctx, x0, top + 10, x1 - x0, 3, edge);
  box(ctx, x0, gy - 16, x1 - x0, 3, edge);
}

// ——— The march ———
/** The littlest one falls behind, then skips to catch up: lag in px, lift, and hop progress. */
function straggle(p: number) {
  const f = (p / HOP) % 1;
  if (f < 0.72) return { lag: (f / 0.72) * 9, lift: 0, hop: 0 };
  const t = (f - 0.72) / 0.28;
  return { lag: 9 * (1 - ease(t)), lift: Math.sin(t * Math.PI) * 6, hop: t };
}
/** Mum and the three big siblings, in step, heading right. */
function marchers(ctx: Ctx, p: number, seconds: number, x: number, gy: number, s = 1) {
  const glance = p > KEEP_UP - 0.006 && p < KEEP_UP + 0.012;
  const quack = hump(p, KEEP_UP, KEEP_UP + 0.007);
  for (let i = 2; i >= 0; i--) {
    const cx = x - (27 + i * 21) * s;
    shade(ctx, cx, gy + 1, 16 * s, 0.2);
    duckling(ctx, cx, gy + 1, s, 1, {
      step: waddle(p, 2) + i * 1.4,
      eyes: blinking(seconds, i * 0.3) ? 'closed' : glance ? 'wide' : 'open',
      bill: hump(p, 0.03 + i * 0.012, 0.036 + i * 0.012),
    });
  }
  shade(ctx, x, gy, 30 * s, 0.22);
  mother(ctx, x, gy, s, 1, {
    step: waddle(p),
    back: glance,
    bill: quack,
    eyes: blinking(seconds, 0.9) ? 'closed' : 'stern',
    lean: -0.05,
  });
}
/** The littlest, with its tuft, skipping along behind. */
function straggler(ctx: Ctx, p: number, seconds: number, x: number, gy: number, s = 1) {
  const st = straggle(p);
  shade(ctx, x, gy + 1, 15 * s, 0.2 * (1 - st.lift / 12));
  duckling(ctx, x, gy + 1 - st.lift * s, s, 1, {
    step: st.hop ? undefined : waddle(p, 2.4),
    tuft: true,
    blown: st.hop ? -Math.sin(st.hop * Math.PI) * 0.5 : 0,
    eyes: st.hop ? 'happy' : blinking(seconds, 0.2) ? 'closed' : 'open',
    wing: st.hop ? Math.abs(Math.sin(st.hop * Math.PI * 3)) : 0,
    lean: st.hop ? -0.15 : 0,
    squash: 1 + Math.sin(st.hop * Math.PI) * 0.06,
  });
}

// ——— Act one: the crossing ———
const ROW_STREET: readonly House[] = [
  [-8, 48, 48, '#E3B7A0', '#8A5A58'],
  [40, 42, 56, '#A9C6B8', '#5E6E78'],
  [82, 50, 44, '#F0D59A', '#9A6A50'],
  [132, 44, 56, '#C9B2D6', '#6A5A7A'],
  [176, 34, 50, '#EDE0C4', '#7A6456'],
  [210, 46, 48, '#E8C0A6', '#7E5A4E'],
  [256, 40, 42, '#B5CFE0', '#5A6A80'],
  [296, 34, 54, '#F2DDB2', '#8A6A50'],
];
const BUNTING = ['#E0564A', '#F2C14E', '#5AAEEF', '#7FB05E'];
const roadL = (y: number) => 150 - ((y - 105) / 75) * 60;
const roadR = (y: number) => 196 + ((y - 105) / 75) * 70;
function beacon(ctx: Ctx, x: number, y: number, seconds: number) {
  for (let k = 0; k < 6; k++) box(ctx, x - 1, y - 30 + k * 5, 2, 5, k % 2 ? '#F4F1E6' : '#2A2530');
  const on = 0.6 + Math.sin(seconds * 2.2) * 0.3;
  disc(ctx, x, y - 33, 3.5, mix('#C9822E', '#FFB347', on));
  glow(ctx, x, y - 33, 12, '#FFB347', 0.35 * on);
}
function streetShot(ctx: Ctx, p: number, seconds: number) {
  const view = track(p, [
    [0, 160, 92, 1],
    [0.055, 170, 112, 1.24],
  ]);
  camera(ctx, view, () => {
    sky(ctx, ['#A6D6EA', '#CBE7EC', '#F2EFD6'], 0, 88);
    glow(ctx, 40, 14, 120, '#FFF4C8', 0.55);
    for (let i = 0; i < 3; i++)
      oval(ctx, ((i * 130 + seconds * 3) % 420) - 50, 16 + i * 8, 20, 4, alpha('#FFFFFF', 0.75));
    tree(ctx, 128, 94, 11, '#7FB05E', '#5E8E4A');
    tree(ctx, 250, 92, 9, '#8CBB66', '#5E8E4A');
    houses(ctx, ROW_STREET, 96);
    line(ctx, '#6B5A58', 0.7, [0, 46, 80, 56, 160, 50, 240, 58, 320, 48]);
    for (let k = 0; k < 16; k++) {
      const bx = 6 + k * 20,
        by = lin(bx, [
          [0, 46],
          [80, 56],
          [160, 50],
          [240, 58],
          [320, 48],
        ]);
      poly(ctx, BUNTING[k % 4], [
        bx - 3,
        by,
        bx + 3,
        by,
        bx,
        by + 5 + Math.sin(seconds * 3 + k) * 0.6,
      ]);
    }
    box(ctx, 0, 96, W, 4, '#D9D1BD');
    box(ctx, 0, 100, W, 5, '#7C808A');
    box(ctx, 0, 105, W, 75, '#D3CAB4');
    for (let y = 114; y < 180; y += 11) box(ctx, 0, y, W, 1, '#C4BAA2');
    poly(ctx, '#6E727C', [roadL(105), 105, roadR(105), 105, roadR(180), 180, roadL(180), 180]);
    line(ctx, '#EDE7D8', 1.6, [roadL(105), 105, roadL(180), 180]);
    line(ctx, '#EDE7D8', 1.6, [roadR(105), 105, roadR(180), 180]);
    for (let k = 0; k < 4; k++) {
      const y0 = 108 + k * 9;
      line(ctx, '#E8D27A', 1 + k * 0.3, [
        173 + (y0 - 105) * 0.07,
        y0,
        173 + (y0 + 4 - 105) * 0.07,
        y0 + 4,
      ]);
    }
    const z0 = 146,
      z1 = 174;
    for (let k = 0; k < 7; k++) {
      const a = k / 7 + 0.015,
        b = k / 7 + 0.1;
      poly(ctx, '#EEEBE2', [
        lerp(roadL(z0), roadR(z0), a),
        z0,
        lerp(roadL(z0), roadR(z0), b),
        z0,
        lerp(roadL(z1), roadR(z1), b),
        z1,
        lerp(roadL(z1), roadR(z1), a),
        z1,
      ]);
    }
    cyclist(ctx, 176, 124, 0.75, hump(p, BELL, BELL + 0.008));
    beacon(ctx, roadL(146) - 6, 146, seconds);
    beacon(ctx, roadR(146) + 6, 146, seconds + 1);
    guard(ctx, 236, 150, 1, seconds);
    const x = lerp(96, 216, p / 0.055);
    marchers(ctx, p, seconds, x, 164);
    straggler(ctx, p, seconds, x - 92 - straggle(p).lag, 164);
  });
  vignette(ctx, 0.3);
}

// ——— Act two: the hedge lane and the butterfly ———
const LANE_W = 640;
const LANE_GY = 142;
const laneMum = (p: number) => 150 + (p - 0.055) * 1944;
const STOP_FROM = laneMum(PASS) - 92 - straggle(PASS).lag;
const STOP_X = STOP_FROM + 1944 * (STOP - PASS) * 0.5;
const GATE_X = Math.round(STOP_X - 30);
const LANE_WALLS = ['#E3B7A0', '#A9C6B8', '#F0D59A', '#C9B2D6', '#B5CFE0'];
const LANE_ROOFS = ['#8A5A58', '#5E6E78', '#9A6A50', '#6A5A7A'];
const LANE_ROW: readonly House[] = Array.from({ length: 11 }, (_, i) => [
  i * 50 - 20,
  42 + (i % 3) * 5,
  36 + ((i * 7) % 3) * 7,
  LANE_WALLS[i % 5],
  LANE_ROOFS[i % 4],
]);
/** Where the littlest is in the lane, and whether it has slipped behind the hedge. */
function laneLast(p: number) {
  if (p < PASS) {
    const st = straggle(p);
    return { x: laneMum(p) - 92 - st.lag, y: LANE_GY + 1, lift: st.lift, s: 1, inside: false };
  }
  if (p < STOP) {
    const t = span(p, PASS, STOP);
    return {
      x: lerp(STOP_FROM, STOP_X, 2 * t - t * t),
      y: LANE_GY + 1,
      lift: 0,
      s: 1,
      inside: false,
    };
  }
  if (p < 0.19) return { x: STOP_X, y: LANE_GY + 1, lift: 0, s: 1, inside: false };
  if (p < 0.205) {
    const t = span(p, 0.19, 0.205);
    return {
      x: lerp(STOP_X, GATE_X, ease(t)),
      y: LANE_GY + 1,
      lift: Math.sin(((t * 3) % 1) * Math.PI) * 5,
      s: 1,
      inside: false,
    };
  }
  const t = ease(span(p, 0.205, 0.218));
  const y = lerp(LANE_GY + 1, 125, t);
  return {
    x: GATE_X - easeIn(span(p, 0.216, 0.236)) * 40,
    y,
    lift: 0,
    s: lerp(1, 0.86, t),
    inside: y < 129,
  };
}
function laneButterfly(p: number, seconds: number) {
  const x = lin(p, [
    [0.108, GATE_X + 130],
    [0.122, GATE_X + 70],
    [PASS, STOP_FROM + 9],
    [0.142, GATE_X + 8],
    [0.15, GATE_X - 2],
    [0.198, GATE_X + 2],
    [0.208, GATE_X - 4],
    [0.224, GATE_X - 40],
  ]);
  const y = lin(p, [
    [0.108, 96],
    [0.122, 110],
    [PASS, 124],
    [0.142, 116],
    [0.15, 108],
    [0.198, 106],
    [0.208, 94],
    [0.224, 84],
  ]);
  const f = flit(seconds);
  return { x: x + f.x, y: y + f.y, inside: p > 0.205 };
}
function laneShot(ctx: Ctx, p: number, seconds: number, raw: View) {
  const v = fit(raw, LANE_W, H);
  sky(ctx, ['#A6D6EA', '#CBE7EC', '#F2EFD6'], 0, 110);
  glow(ctx, 30, 10, 120, '#FFF4C8', 0.4);
  const last = laneLast(p);
  const fly = laneButterfly(p, seconds);
  const drawLast = () => {
    const facing =
      p < 0.14 ? 1 : p < 0.19 ? (GLANCES.filter((g) => p >= g).length % 2 ? 1 : -1) : -1;
    const shocked = within(p, PASS - 0.004, 0.145);
    const walking = p < STOP - 0.002 || (p > 0.19 && p < 0.232);
    shade(ctx, last.x, last.y, 15 * last.s, 0.2);
    const looking = within(p, 0.146, 0.19) && facing < 0;
    duckling(ctx, last.x, last.y - last.lift, last.s, facing, {
      step: walking && !last.lift ? waddle(p, 2.4) : undefined,
      tuft: true,
      eyes: shocked ? 'wide' : looking ? 'happy' : facing > 0 && p > 0.16 ? 'worried' : 'open',
      look: shocked ? -0.35 : looking ? -0.2 : 0,
      bill: Math.max(...GLANCES.map((g) => hump(p, g, g + 0.004))),
      squash: 1 - hump(p, 0.184, 0.19) * 0.15,
      wing: last.lift ? 0.6 : 0,
    });
    if (within(p, 0.144, 0.162))
      for (let k = 0; k < 3; k++) {
        const tw = Math.sin(seconds * 6 + k * 2);
        if (tw > 0)
          box(ctx, last.x - 10 + k * 7, last.y - 28 - (k % 2) * 4, 1, 1 + tw * 2, '#FFFFFF');
      }
  };
  const drawFly = () =>
    butterfly(
      ctx,
      fly.x,
      fly.y,
      1,
      wingbeat(seconds, p > 0.15 && p < 0.198 ? 0.5 : 0),
      Math.sin(seconds * 2) * 0.2,
    );
  camera(
    ctx,
    v,
    () => {
      ctx.save();
      ctx.translate(v.x * 0.45, 0);
      houses(ctx, LANE_ROW, 84);
      ctx.restore();
      // The garden, glimpsed through the gateway.
      box(ctx, GATE_X - 14, 70, 28, 34, '#6FA35A');
      disc(ctx, GATE_X - 4, 86, 10, '#5E8E4A');
      box(ctx, GATE_X - 14, 104, 28, 24, '#8CC063');
      poly(ctx, '#D9CFB6', [GATE_X - 6, 128, GATE_X + 6, 128, GATE_X + 3, 104, GATE_X - 3, 104]);
      const swing = 0.8 + hump(p, THROUGH - 0.006, 0.26) * 0.45;
      const gw = 24 * Math.cos(swing);
      for (let k = 0; k < 4; k++) box(ctx, GATE_X + 12 - gw + k * (gw / 4), 100, 2, 26, '#F2EEE4');
      box(ctx, GATE_X + 12 - gw, 104, gw, 2, '#E2DCCC');
      box(ctx, GATE_X + 12 - gw, 118, gw, 2, '#E2DCCC');
      if (fly.inside) drawFly();
      if (last.inside) drawLast();
      // The hedge, with its gateway.
      for (const [a, b] of [
        [0, GATE_X - 14],
        [GATE_X + 14, LANE_W],
      ]) {
        box(ctx, a, 74, b - a, 54, '#4F8A4E');
        for (let x = a + 4; x < b; x += 10) disc(ctx, x, 75 + ((x * 7) % 3), 6.5, '#4F8A4E');
        for (let x = a + 6; x < b - 3; x += 13) box(ctx, x, 80 + ((x * 11) % 36), 3, 2, '#6BA560');
      }
      box(ctx, 0, 124, LANE_W, 4, '#3E7040');
      box(ctx, GATE_X - 16, 92, 4, 36, '#EDE7D8');
      box(ctx, GATE_X + 12, 92, 4, 36, '#EDE7D8');
      box(ctx, GATE_X - 17, 90, 6, 3, '#F8F4EA');
      box(ctx, GATE_X + 11, 90, 6, 3, '#F8F4EA');
      // Pavement, kerb, and road.
      box(ctx, 0, 128, LANE_W, 24, '#D6CDB8');
      box(ctx, 0, 140, LANE_W, 1, '#C8BEA6');
      for (let x = 8; x < LANE_W; x += 18) box(ctx, x + ((x / 18) % 2) * 9, 128, 1, 24, '#C8BEA6');
      box(ctx, 0, 152, LANE_W, 3, '#EDE7D8');
      box(ctx, 0, 155, LANE_W, 25, '#707480');
      for (let x = 0; x < LANE_W; x += 30) box(ctx, x, 168, 14, 1, '#C9C4B0');
      for (let x = 10; x < LANE_W; x += 17)
        if (Math.abs(x - GATE_X) > 18)
          flower(
            ctx,
            x,
            128,
            5 + (x % 4),
            ['#F28CA0', '#FFFFFF', '#F2C14E'][x % 3],
            Math.sin(seconds + x) * 0.8,
          );
      for (const lx of [70, 340, 600]) lamppost(ctx, lx, 132, 0);
      if (p < 0.24) {
        const x = laneMum(p);
        if (x < LANE_W + 40) marchers(ctx, p, seconds, x, LANE_GY);
      }
      if (!last.inside && p < 0.232) drawLast();
      if (!fly.inside && p < 0.23) drawFly();
    },
    null,
  );
  vignette(ctx, 0.32);
}
const laneView = (p: number): View => {
  if (p < 0.095) return { x: laneMum(p) - 48, y: 112, zoom: 1.75 };
  if (p < 0.125) return { x: laneLast(p).x + 12, y: 124, zoom: 3 };
  if (p < 0.16)
    return {
      x:
        laneLast(Math.min(p, STOP)).x -
        lin(p, [
          [0.13, -6],
          [0.15, 8],
        ]),
      y: 123,
      zoom: 3.3,
    };
  if (p < 0.19) return { x: STOP_X + 22, y: 116, zoom: 1.75 };
  return { x: GATE_X + 26, y: 108, zoom: 1.5 };
};

// ——— Act three: the garden of mistaken mothers ———
const GARDEN_W = 680;
const GARDEN_H = 240;
const GY = 206;
const POOL_X = 130,
  POOL_Y = 214;
const VANE_X = 402,
  VANE_Y = 140;
const CLOUD_X = 606,
  CLOUD_Y = 64;
const GARDEN_ROW: readonly House[] = Array.from({ length: 8 }, (_, i) => [
  i * 96 - 30,
  56,
  138 + (i % 3) * 6,
  LANE_WALLS[(i + 2) % 5],
  LANE_ROOFS[(i + 1) % 4],
]);
const roofY = (x: number) => 140 + ((x - 396) / 90) * 15;
function shed(ctx: Ctx) {
  poly(ctx, '#7E9A7A', [398, roofY(398), 484, roofY(484), 484, GY, 398, GY]);
  for (let x = 405; x < 484; x += 8) box(ctx, x, roofY(x) + 2, 1, GY - roofY(x) - 2, '#6C8868');
  box(ctx, 452, 168, 22, GY - 168, '#627C60');
  box(ctx, 469, 186, 2, 2, '#E8D27A');
  box(ctx, 408, 158, 18, 14, '#F4EEDF');
  box(ctx, 409, 159, 16, 12, '#BFE0EA');
  box(ctx, 416, 159, 1, 12, '#F4EEDF');
  box(ctx, 406, 172, 22, 3, '#F4EEDF');
  poly(ctx, '#5A4A52', [392, 137, 490, 153, 490, 158, 392, 142]);
  box(ctx, 392, 137, 98, 1, '#7A6874');
}
function gardenSet(ctx: Ctx, p: number, seconds: number, v: View) {
  for (let i = 0; i < 4; i++)
    oval(
      ctx,
      ((i * 190 + seconds * 2.5) % 760) - 40,
      30 + (i % 2) * 26,
      18,
      5,
      alpha('#FFFFFF', 0.85),
    );
  cloudMum(ctx, CLOUD_X + (p - 0.39) * 60, CLOUD_Y, easeOut(span(p, DRIFT, 0.445)) * 0.9, seconds);
  ctx.save();
  ctx.translate(v.x * 0.3, 0);
  houses(ctx, GARDEN_ROW, 164);
  ctx.restore();
  for (let x = 20; x < GARDEN_W; x += 150) tree(ctx, x, 160, 12, '#7FB05E', '#5E8E4A');
  box(ctx, 0, 156, GARDEN_W, 34, '#B08A62');
  box(ctx, 0, 156, GARDEN_W, 2, '#C9A57A');
  for (let x = 0; x < GARDEN_W; x += 12) box(ctx, x, 158, 1, 32, '#9A7650');
  box(ctx, 0, 186, GARDEN_W, 6, '#7A5A40');
  for (let x = 6; x < GARDEN_W; x += 11)
    flower(
      ctx,
      x,
      188,
      6 + (x % 5),
      ['#F28CA0', '#FFFFFF', '#F2C14E', '#B48CE0'][x % 4],
      Math.sin(seconds * 1.3 + x) * 0.8,
    );
  box(ctx, 0, 191, GARDEN_W, GARDEN_H - 191, '#8CC063');
  for (let x = 0; x < GARDEN_W; x += 40) box(ctx, x, 191, 20, GARDEN_H - 191, '#95C86B');
  // A washing line of little shirts, flapping.
  box(ctx, 222, 140, 2, 52, '#8E8A80');
  box(ctx, 302, 140, 2, 52, '#8E8A80');
  line(ctx, '#EDE7D8', 0.6, [223, 142, 263, 147, 303, 142]);
  for (let k = 0; k < 4; k++) {
    const sx = 232 + k * 18,
      flap = Math.sin(seconds * 3 + k) * 1.5;
    box(
      ctx,
      sx,
      144 + Math.abs(k - 1.5),
      10,
      11 + flap * 0.5,
      ['#F28CA0', '#5AAEEF', '#FFFFFF', '#F2C14E'][k],
    );
  }
  shed(ctx);
  crate(ctx, 340, 190, 20, 16);
  crate(ctx, 360, 190, 20, 16);
  crate(ctx, 360, 174, 20, 16);
  crate(ctx, 380, 190, 18, 16);
  crate(ctx, 380, 174, 18, 16);
  crate(ctx, 380, 158, 18, 16);
  vane(ctx, VANE_X, VANE_Y, 1.3, gustSpin(p) + Math.sin(seconds * 0.7) * 0.25);
  kid(ctx, 178, 205, p > LAUGH && p < 0.34 ? 1 : 0, seconds);
  pool(ctx, POOL_X, POOL_Y, seconds);
}
/** The weathervane idles until the gust whips it round and round. */
const gustSpin = (p: number) => easeIn(span(p, GUST, 0.39)) * 26 + Math.max(0, p - 0.39) * 400;
/** The littlest's route through the garden, shot by shot. */
function gardenChick(p: number) {
  if (p < SPOT_POOL)
    return { x: lerp(44, 84, span(p, 0.24, SPOT_POOL)), y: POOL_Y, lift: 0, swim: false };
  if (p < SPLASH_POOL) {
    const t = span(p, SPOT_POOL + 0.004, SPLASH_POOL);
    return {
      x: lerp(84, 100, t),
      y: lerp(POOL_Y, POOL_Y + 1, t),
      lift: Math.sin(t * Math.PI) * 10,
      swim: false,
    };
  }
  if (p < 0.31) {
    const x = lerp(100, 121, easeOut(span(p, SPLASH_POOL, CUDDLE)));
    return { x, y: POOL_Y + 1, lift: hump(p, SQUEAK, SQUEAK + 0.009) * 9, swim: true };
  }
  if (p < 0.36) {
    const hopAt = CRATES.findIndex((c) => p >= c && p < c + 0.006);
    const done = CRATES.filter((c) => p >= c + 0.006).length;
    const tops: readonly (readonly [number, number])[] = [
      [336, GY],
      [350, 190],
      [370, 174],
      [389, 158],
    ];
    if (hopAt >= 0) {
      const t = span(p, CRATES[hopAt], CRATES[hopAt] + 0.006);
      const [ax, ay] = tops[hopAt],
        [bx, by] = tops[hopAt + 1];
      return {
        x: lerp(ax, bx, t),
        y: lerp(ay, by, t),
        lift: Math.sin(t * Math.PI) * 10,
        swim: false,
      };
    }
    if (done) return { x: tops[done][0], y: tops[done][1], lift: 0, swim: false };
    return {
      x: lerp(296, 330, span(p, 0.31, 0.319)) + span(p, 0.334, 0.339) * 6,
      y: GY,
      lift: 0,
      swim: false,
    };
  }
  if (p < 0.385) return { x: 389, y: 158, lift: 0, swim: false };
  return { x: 590, y: 214, lift: 0, swim: false };
}
function gardenShot(ctx: Ctx, p: number, seconds: number, raw: View) {
  const v = fit(raw, GARDEN_W, GARDEN_H);
  sky(ctx, ['#7CC0E6', '#A5D4EC', '#D2EAF0'], 0, H);
  const c = gardenChick(p);
  camera(
    ctx,
    v,
    () => {
      gardenSet(ctx, p, seconds, v);
      // The rubber duck, and the littlest's hopeful cuddle.
      const squeeze = hump(p, SQUEAK, SQUEAK + 0.008);
      const rx = POOL_X + 2 + easeOut(span(p, 0.3, 0.34)) * 8;
      rubberDuck(ctx, rx, POOL_Y + 1 + Math.sin(seconds * 2) * 0.6, 1, squeeze);
      if (p > SPLASH_POOL && p < SPLASH_POOL + 0.012) {
        const t = span(p, SPLASH_POOL, SPLASH_POOL + 0.012);
        oval(ctx, 100, POOL_Y + 1, 4 + t * 14, 1 + t * 3, alpha('#FFFFFF', 0.8 * (1 - t)));
        for (let k = 0; k < 5; k++)
          box(
            ctx,
            100 + (k - 2) * 4 * (0.4 + t),
            POOL_Y - Math.sin(t * Math.PI) * (6 + (k % 2) * 4),
            1,
            2,
            '#DDF4FA',
          );
      }
      const cuddling = within(p, CUDDLE, SQUEAK);
      const startled = within(p, SQUEAK, 0.301);
      const crushed = p >= 0.301 && p < 0.31;
      const climbing = within(p, 0.334, 0.36);
      const reaching = within(p, 0.355, GUST);
      const blown = within(p, GUST, 0.385);
      let eyes: Eyes = blinking(seconds, 0.2) ? 'closed' : 'open';
      if (within(p, SPOT_POOL, SPLASH_POOL) || startled) eyes = 'wide';
      else if (cuddling || reaching) eyes = 'happy';
      else if (within(p, 0.318, 0.334)) eyes = 'up';
      else if (blown) eyes = p < 0.376 ? 'closed' : 'sad';
      else if (crushed) eyes = 'sad';
      if (c.x < 560) {
        if (!c.swim) shade(ctx, c.x, c.y, 15, 0.2);
        duckling(ctx, c.x, c.y - c.lift, 1, 1, {
          step:
            (p < SPOT_POOL || within(p, 0.31, 0.319) || within(p, 0.334, 0.339)) && !c.lift
              ? waddle(p, 2.4)
              : undefined,
          swim: c.swim && !c.lift,
          tuft: true,
          eyes,
          look: within(p, 0.318, 0.334) ? -0.55 : reaching ? -0.5 : cuddling ? 0.15 : 0,
          lean: cuddling
            ? 0.18
            : reaching
              ? 0.12
              : blown
                ? -0.28 + Math.sin(seconds * 9) * 0.08
                : 0,
          wing: startled
            ? 1
            : blown
              ? Math.abs(Math.sin(seconds * 14))
              : climbing && c.lift
                ? 0.7
                : 0,
          bill: Math.max(hump(p, SQUEAK, SQUEAK + 0.006), hump(p, 0.304, 0.308) * 0.5),
          blown: startled ? 1 : blown ? 1 : crushed ? -0.6 : 0,
          squash: reaching ? 1.12 : 1,
        });
      }
      // Hope, and hope dashed.
      if (within(p, SPOT_POOL, SPLASH_POOL))
        heart(ctx, 84, 186 - span(p, SPOT_POOL, SPLASH_POOL) * 6, 3);
      if (within(p, CUDDLE + 0.002, SQUEAK))
        for (let k = 0; k < 2; k++) {
          const t = (span(p, CUDDLE + 0.002, SQUEAK) * 1.6 + k * 0.5) % 1;
          heart(ctx, 124 + k * 6, 198 - t * 14, 2);
        }
      if (within(p, 0.3, 0.31)) heart(ctx, 121, 186, 3, easeOut(span(p, 0.3, 0.306)));
      if (within(p, 0.326, 0.338)) heart(ctx, 392, 132 - span(p, 0.326, 0.338) * 6, 3.5);
      if (within(p, 0.376, 0.385)) heart(ctx, 392, 126, 3, easeOut(span(p, 0.376, 0.38)));
      // Water drips off the littlest after its swim.
      if (within(p, 0.31, 0.334))
        for (let k = 0; k < 3; k++) {
          const t = (seconds * 1.5 + k * 0.33) % 1;
          box(ctx, c.x - 4 + k * 4, c.y - 6 + t * 6, 1, 2, alpha('#8FD3EC', 1 - t));
        }
      if (c.x > 560) {
        const sad = p > SIGH - 0.004;
        const up = within(p, SPOT_CLOUD, SIGH - 0.004);
        duckling(ctx, c.x, c.y, 1, 1, {
          sit: true,
          tuft: true,
          eyes: up ? 'up' : sad ? 'sad' : 'open',
          look: up ? -0.6 : sad ? 0.25 : 0.1,
          blown: sad ? -0.8 : 0,
          bill: hump(p, SIGH, SIGH + 0.006) * 0.6,
        });
        if (within(p, SPOT_CLOUD, 0.41))
          heart(ctx, c.x + 6, c.y - 30 - span(p, SPOT_CLOUD, 0.41) * 8, 3);
      }
    },
    null,
  );
  if (within(p, GUST, 0.385)) {
    const gust = hump(p, GUST, 0.385);
    for (let k = 0; k < 9; k++) {
      const y = 20 + rand(k * 3.3) * 140,
        x = ((rand(k) * 400 + seconds * 520) % 420) - 60;
      box(ctx, x, y, 22 + rand(k * 5) * 20, 1, alpha('#FFFFFF', 0.6 * gust));
      disc(ctx, x + 40, y + Math.sin(seconds * 8 + k) * 3, 1.6, alpha('#7FB05E', gust));
    }
  }
  vignette(ctx, 0.28);
}
const GARDEN_CAMERA = [
  [0.24, 132, 190, 2],
  [0.275, 132, 190, 2],
  [0.275, 132, 194, 3.2],
  [0.31, 136, 194, 3.3],
  [0.31, 314, 194, 2.6],
  [0.318, 330, 194, 2.6],
  [0.322, 330, 194, 2.6],
  [0.33, 402, 118, 2.6],
  [0.334, 402, 118, 2.6],
  [0.34, 368, 168, 1.8],
  [0.36, 376, 160, 1.9],
  [0.36, 398, 124, 2.4],
  [0.385, 398, 122, 2.5],
  [0.385, 596, 200, 2.8],
  [0.396, 596, 200, 2.8],
  [0.412, CLOUD_X + 6, 54, 1.9],
  [0.44, CLOUD_X + 12, 52, 2],
  [0.44, 592, 202, 3.4],
  [0.464, 592, 204, 3.5],
] as const;

// ——— Acts four and five: the puddle at dusk, and the way home ———
const DUSK_W = 480;
const DGY = 152;
const PUDDLE_X = 118,
  PUDDLE_Y = 159;
const FENCE_X = 344;
const COOL = ['#3E4868', '#5E6284', '#8E84A0'];
const WARM = ['#7E6490', '#CF8E80', '#F2C48E'];
/** The corner warms a little as hope returns. */
const warmth = (p: number) => ease(span(p, 0.575, 0.665)) * 0.6;
function duskChick(p: number) {
  if (p < 0.49)
    return {
      x: lerp(20, 94, span(p, 0.464, 0.49)),
      y: DGY + 5,
      walking: true,
      sit: false,
      squash: 1,
    };
  if (p < 0.594) return { x: 94, y: DGY + 5, walking: false, sit: p > 0.505, squash: 1 };
  if (p < 0.625)
    return {
      x: lerp(94, 236, span(p, 0.594, 0.625)),
      y: DGY + 5,
      walking: true,
      sit: false,
      squash: 1,
    };
  if (p < 0.64) {
    const t = span(p, 0.625, 0.64);
    return {
      x: lerp(312, 392, t),
      y: lerp(DGY + 16, DGY + 2, t),
      walking: true,
      sit: false,
      squash: 1,
    };
  }
  const t = span(p, 0.64, 0.656);
  return {
    x: 392 + t * 4 + Math.sin(t * 40) * t,
    y: lerp(DGY + 2, DGY - 4, easeIn(t)),
    walking: false,
    sit: false,
    squash: lerp(1, 0.5, ease(span(p, 0.638, 0.646))),
  };
}
function duskButterfly(p: number, seconds: number, chickX: number) {
  const f = flit(seconds, 2);
  if (p < LAND) {
    const t = easeOut(span(p, 0.546, LAND));
    return {
      x: lerp(190, chickX - 1, t) + f.x * (1 - t),
      y: lerp(86, 132, t) + f.y * (1 - t),
      rest: t > 0.98,
      s: 1,
    };
  }
  if (p < LIFT) return { x: chickX - 1, y: 132 + Math.sin(seconds * 1.4) * 0.3, rest: true, s: 1 };
  if (p < 0.625) {
    const t = span(p, LIFT, 0.602);
    return {
      x: lerp(chickX - 1, chickX + 30, ease(t)) + f.x * t,
      y: lerp(132, 120, ease(t)) + f.y * t,
      rest: false,
      s: 1,
    };
  }
  // Over the fence and away.
  const t = span(p, 0.628, 0.648);
  return {
    x: lerp(372, 404, t) + f.x,
    y: lerp(118, 84, easeOut(t)) + easeIn(span(p, 0.648, 0.664)) * 30 + f.y,
    rest: false,
    s: lerp(1, 0.7, span(p, 0.64, 0.66)),
  };
}
function duskShot(ctx: Ctx, p: number, seconds: number, raw: View) {
  const v = fit(raw, DUSK_W, H);
  const w = warmth(p);
  const tint = (c: string) => mix(c, '#E9A06A', w * 0.18);
  sky(
    ctx,
    COOL.map((c, i) => mix(c, WARM[i], w)),
    0,
    H,
  );
  const c = duskChick(p);
  const fly = duskButterfly(p, seconds, c.x);
  const drawChick = () => {
    shade(ctx, c.x, c.y, 15 * (2 - c.squash), 0.25);
    const lookDown = within(p, 0.49, LAND + 0.002);
    duckling(ctx, c.x, c.y, 1, 1, {
      step: c.walking ? waddle(p, p < 0.49 ? 1 : 2.4) : undefined,
      sit: c.sit,
      tuft: true,
      eyes: within(p, LAND - 0.004, 0.572)
        ? 'up'
        : p >= 0.572
          ? p < 0.594 || blinking(seconds, 0.5)
            ? 'happy'
            : 'open'
          : blinking(seconds, 0.1)
            ? 'closed'
            : 'sad',
      look: lookDown ? 0.35 : within(p, LAND, 0.594) ? -0.3 : p < 0.49 ? 0.25 : 0,
      blown: p < 0.572 ? -0.7 : 0.2,
      bill: Math.max(...PEEPS.map((q) => hump(p, q, q + 0.007))) * 0.7,
      squash: c.squash,
      lean: p > 0.64 ? Math.sin(seconds * 20) * 0.08 : 0,
    });
  };
  camera(
    ctx,
    v,
    () => {
      ctx.save();
      ctx.translate(v.x * 0.4, 0);
      houses(ctx, GARDEN_ROW, 104, 0.85);
      ctx.restore();
      for (let x = 0; x < DUSK_W; x += 60)
        tree(ctx, x + 20, 116, 13, tint('#324A4A'), tint('#27393C'));
      box(ctx, 0, 104, DUSK_W, 24, tint('#2E4040'));
      for (let x = 4; x < DUSK_W; x += 10) disc(ctx, x, 105 + ((x * 3) % 4), 6, tint('#2E4040'));
      lamppost(ctx, 420, 128, 1);
      box(ctx, 0, 126, DUSK_W, 54, tint('#3E5A4E'));
      for (let x = 0; x < DUSK_W; x += 36) box(ctx, x, 126, 18, 54, tint('#43604F'));
      // The flowerbed, closed up for the night.
      for (let x = 160; x < 330; x += 7)
        flower(
          ctx,
          x,
          132,
          10 + ((x * 7) % 9),
          tint(['#B48CE0', '#E6D8F2', '#D98CA8'][x % 3]),
          Math.sin(seconds + x) * 0.6,
        );
      // The puddle, holding a little of the sky and the littlest's reflection.
      oval(ctx, PUDDLE_X, PUDDLE_Y, 25, 5.5, tint('#34504A'));
      oval(ctx, PUDDLE_X, PUDDLE_Y, 23, 4.6, COOL.map((col, i) => mix(col, WARM[i], w))[2]);
      oval(ctx, PUDDLE_X - 4, PUDDLE_Y - 1, 12, 1.4, alpha('#FFFFFF', 0.25));
      if (c.x < 150) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(PUDDLE_X, PUDDLE_Y, 23, 4.6, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalAlpha = 0.4;
        at(ctx, c.x + 9 + Math.sin(seconds * 3) * 0.8, PUDDLE_Y - 3, 1, () => {
          ctx.scale(1, -0.5);
          duckling(ctx, 0, 0, 1, 1, {
            sit: c.sit,
            tuft: true,
            eyes: 'sad',
            look: 0.35,
            blown: -0.7,
          });
        });
        ctx.restore();
      }
      for (const [at0, x0] of [
        [0.542, PUDDLE_X - 14],
        [LAND, PUDDLE_X - 8],
      ] as const)
        if (within(p, at0, at0 + 0.02)) {
          const t = span(p, at0, at0 + 0.02);
          oval(ctx, x0, PUDDLE_Y, 2 + t * 10, 0.6 + t * 2, alpha('#FFFFFF', 0.5 * (1 - t)));
        }
      // One tear.
      if (within(p, 0.536, 0.542)) {
        const t = easeIn(span(p, 0.536, 0.542));
        box(ctx, c.x + 5 + t * 1, 141 + t * 17, 1, 2, '#BFE6F5');
      }
      const behind = p > 0.646;
      if (fly.s < 0.95 && p > 0.646) butterfly(ctx, fly.x, fly.y, fly.s, wingbeat(seconds));
      if (behind) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, DGY - 6, DUSK_W, 20);
        ctx.clip();
        drawChick();
        ctx.restore();
      }
      fence(ctx, FENCE_X, DUSK_W, 92, DGY, 0.6 - w * 0.4);
      if (!behind) drawChick();
      if (!(fly.s < 0.95 && p > 0.646) && p > 0.546) {
        glow(ctx, fly.x, fly.y, 16, '#9FD4FF', 0.35);
        butterfly(
          ctx,
          fly.x,
          fly.y,
          fly.s,
          wingbeat(seconds, fly.rest ? 1 : 0),
          fly.rest ? 0 : Math.sin(seconds * 2) * 0.25,
        );
      }
      // Foreground grass sweeps past while we follow.
      ctx.save();
      ctx.translate(-v.x * 0.35, 0);
      for (let x = 0; x < DUSK_W * 1.4; x += 23)
        line(ctx, tint('#26382F'), 2, [
          x,
          184,
          x + 3 + Math.sin(seconds + x) * 1.5,
          164 + ((x * 5) % 9),
        ]);
      ctx.restore();
    },
    null,
  );
  vignette(ctx, 0.5 - w * 0.2);
}
const DUSK_CAMERA = [
  [0.464, 116, 108, 1.15],
  [0.52, 108, 122, 1.5],
  [0.52, 104, 144, 3.2],
  [0.585, 106, 140, 3.4],
] as const;
const duskView = (p: number): View => {
  if (p < 0.585) return track(p, DUSK_CAMERA);
  if (p < 0.625) return { x: duskChick(p).x + 22, y: 132, zoom: 2.2 };
  return track(p, [
    [0.625, 386, 128, 2.2],
    [0.665, 398, 132, 2.5],
  ]);
};

// ——— Acts five to seven: the town pond ———
const POND_W = 480;
const WL = 147; // the waterline the family swims on
const SPLASH_X = 176;
const HUG = 204; // where Mum stops to scoop up the littlest
const EVENING = ['#E49C6E', '#F0C28C', '#F8E2B4'];
const SUNSET = ['#5E4A7E', '#CF7A6C', '#F4B46E'];
const bankY = (x: number) =>
  lin(x, [
    [0, 97],
    [40, 97],
    [70, 104],
    [110, 120],
    [150, 138],
    [178, 152],
  ]);
const SKYLINE: readonly House[] = [
  [96, 30, 72, '#9C8A7A', '#6A5A58'],
  [128, 26, 76, '#A89480', '#6A5058'],
  [206, 34, 70, '#948674', '#5E5060'],
  [244, 28, 74, '#A08E7E', '#6A5A58'],
  [330, 32, 72, '#9A8878', '#624E56'],
];
function pondSet(ctx: Ctx, seconds: number, sunset: number) {
  const sx = lerp(420, 312, sunset),
    sy = lerp(36, 71, sunset);
  glow(ctx, sx, sy, 110, '#FFE0A0', 0.55);
  disc(ctx, sx, sy, 11, mix('#FFF4D6', '#FFD98A', sunset));
  const far = mix('#8C8A74', '#4E3E5E', sunset);
  for (let x = 0; x < POND_W; x += 26)
    disc(ctx, x + 8, 84 + ((x * 7) % 5), 11 + ((x * 3) % 5), far);
  houses(ctx, SKYLINE, 92, 0.3 + sunset * 0.5);
  box(ctx, 168, 46, 8, 46, mix('#8C7C70', '#4E3E5E', sunset));
  poly(ctx, mix('#6A5A58', '#3E3050', sunset), [166, 47, 172, 30, 178, 47]);
  box(ctx, 0, 90, POND_W, 5, mix('#6E8A5A', '#3E4050', sunset));
  const water = [
    mix('#D8C0A0', '#E3A67E', sunset),
    mix('#9AAFB4', '#D69A78', sunset),
    mix('#6E8FA0', '#8E6A82', sunset),
  ];
  box(ctx, 0, 95, POND_W, 85, water[2]);
  box(ctx, 0, 95, POND_W, 30, water[0]);
  box(ctx, 0, 125, POND_W, 24, water[1]);
  for (let x = 0; x < POND_W; x += 4) {
    box(ctx, x, 123 + (x % 8 ? 0 : 1), 2, 2, water[0]);
    box(ctx, x + 2, 147 + (x % 8 ? 0 : 1), 2, 2, water[1]);
  }
  // The sun's path across the water.
  for (let k = 0; k < 14; k++) {
    const y = 97 + k * 6,
      wv = 6 + k * 1.6 + Math.sin(seconds * 2 + k) * 3;
    box(
      ctx,
      sx - wv / 2 + Math.sin(seconds * 1.3 + k * 2) * 2,
      y,
      wv,
      1,
      alpha('#FFE6A8', 0.7 - k * 0.03),
    );
  }
  for (let k = 0; k < 14; k++)
    box(
      ctx,
      ((k * 67 + seconds * 5) % 500) - 10,
      100 + ((k * 23) % 76),
      6,
      1,
      alpha('#FFFFFF', 0.35),
    );
  for (const [x, y, r] of [
    [236, 112, 6],
    [420, 162, 9],
    [300, 170, 7],
  ] as const) {
    oval(ctx, x, y, r, r * 0.3, mix('#4F8E3E', '#3E5048', sunset));
    disc(ctx, x - 2, y - 1.5, 1.6, '#F2A7C0');
  }
  reeds(ctx, 440, 128, 7, seconds, mix('#4F7F3A', '#3A4A40', sunset));
}
function nearBank(ctx: Ctx, seconds: number, sunset: number) {
  const grass = mix('#7A9A52', '#4E5A48', sunset);
  poly(ctx, grass, [0, 97, 40, 97, 70, 104, 110, 120, 150, 138, 178, 152, 196, 180, 0, 180]);
  poly(
    ctx,
    mix('#8CAC5E', '#5E6650', sunset),
    [0, 97, 40, 97, 70, 104, 110, 120, 104, 122, 60, 108, 0, 102],
  );
  for (let x = 6; x < 176; x += 12)
    line(ctx, mix('#5E823E', '#3E4A3E', sunset), 1, [x, bankY(x) + 2, x + 1, bankY(x) - 3]);
  reeds(ctx, 124, 170, 6, seconds, mix('#4F7F3A', '#384438', sunset));
}
const pondMumX = (p: number) => {
  if (p < SET_OFF) return 300;
  if (p < WHIRL + 0.004) return 300 + (p - SET_OFF) * 1620;
  if (p < 0.81)
    return lerp(
      300 + (WHIRL + 0.004 - SET_OFF) * 1620,
      HUG + 12,
      easeIn(span(p, WHIRL + 0.004, 0.81)),
    );
  if (p < 0.88) return lerp(HUG + 12, HUG, easeOut(span(p, 0.81, 0.817)));
  return lerp(250, 330, span(p, 0.88, 1));
};
const pondMumFacing = (p: number) =>
  p < SET_OFF ? (within(p, 0.702, 0.705) ? 1 : -1) : p < WHIRL || p >= 0.88 ? 1 : -1;
/** The three big siblings, as they line up, follow, turn back, and pile on. */
function pondSibling(p: number, i: number) {
  const home = 270 - i * 18;
  const mum = pondMumX(p);
  if (p < SET_OFF + 0.003) return { x: home, y: WL + 1, facing: 1, lift: 0 };
  if (p < 0.792)
    return {
      x: Math.min(home + (p - SET_OFF - 0.003) * 1620, mum - 26 - 21 * i),
      y: WL + 1,
      facing: 1,
      lift: 0,
    };
  if (p < 0.88) {
    const turnAt = Math.min(
      home + (0.789 - SET_OFF) * 1620,
      300 + (WHIRL - SET_OFF) * 1620 - 26 - 21 * i,
    );
    const target = [
      [17, 131],
      [26, 135],
      [15, 117],
    ][i];
    const hop = span(p, PILE[i] - 0.006, PILE[i]);
    const swim = lin(p, [
      [0.792, turnAt],
      [PILE[i] - 0.006, HUG + 26 + i * 8],
    ]);
    if (hop <= 0) return { x: swim, y: WL + 1, facing: -1, lift: 0 };
    return {
      x: lerp(swim, HUG + target[0], hop),
      y: lerp(WL + 1, target[1], hop),
      facing: -1,
      lift: Math.sin(hop * Math.PI) * 10,
    };
  }
  return { x: mum - [28, 72, 94][i], y: WL + 1, facing: 1, lift: 0 };
}
/** The littlest: over the crest, down the bank, tumble, splash, and home. */
function pondLast(p: number) {
  if (p < ARRIVE) return { x: lerp(-6, 44, span(p, 0.715, ARRIVE)), y: 97, spin: 0, swim: false };
  if (p < 0.733) return { x: 44, y: 97, spin: 0, swim: false };
  if (p < TRIP) {
    const x = lerp(44, 120, easeIn(span(p, 0.733, TRIP)) * 0.4 + span(p, 0.733, TRIP) * 0.6);
    return { x, y: bankY(x), spin: 0, swim: false };
  }
  if (p < SPLASH) {
    const t = span(p, TRIP, SPLASH);
    const x = lerp(120, SPLASH_X, t);
    return {
      x,
      y: lerp(bankY(120), WL, t) - Math.sin(t * Math.PI) * 8,
      spin: t * Math.PI * 4,
      swim: false,
    };
  }
  if (p < 0.88)
    return {
      x: SPLASH_X + easeOut(span(p, 0.775, 0.81)) * 4,
      y: WL + (p < 0.772 ? 12 * hump(p, SPLASH, 0.776) : 0),
      spin: 0,
      swim: true,
    };
  return { x: 330 - 50, y: WL + 1, spin: 0, swim: true };
}
function pondShot(ctx: Ctx, p: number, seconds: number, raw: View) {
  const v = fit(raw, POND_W, H);
  const sunset = ease(span(p, 0.86, 0.9));
  sky(
    ctx,
    EVENING.map((c, i) => mix(c, SUNSET[i], sunset)),
    0,
    98,
  );
  const last = pondLast(p);
  camera(
    ctx,
    v,
    () => {
      pondSet(ctx, seconds, sunset);
      const mx = pondMumX(p),
        mf = pondMumFacing(p);
      const reunion = p > 0.81 && p < 0.88;
      const tuck = span(p, SCOOP - 0.002, SCOOP + 0.004);
      const bob = (i: number) => Math.sin(seconds * 3 + i) * 0.5;
      const lastPose = (): Chick => ({
        swim: last.swim,
        tuft: true,
        eyes:
          p < ARRIVE
            ? 'open'
            : p < TRIP
              ? 'wide'
              : p < 0.776
                ? 'closed'
                : p < 0.814
                  ? 'wide'
                  : 'happy',
        bill: Math.max(hump(p, SHOUT, SHOUT + 0.03) * 0.9, hump(p, 0.746, 0.752) * 0.6),
        wing: within(p, SHOUT, TRIP) ? Math.abs(Math.sin(seconds * 16)) : 0,
        step: within(p, 0.715, ARRIVE)
          ? waddle(p, 2.4)
          : within(p, 0.733, TRIP)
            ? waddle(p, 6)
            : undefined,
        lean: within(p, 0.733, TRIP) ? 0.3 : 0,
        blown: within(p, 0.733, SPLASH) ? 0.8 : p > SPLASH && p < 0.8 ? -0.5 : 0,
      });
      const reflect = (paint: () => void) => {
        if (p < 0.88) return;
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.translate(Math.sin(seconds * 2) * 0.6, WL * 1.75 + 1);
        ctx.scale(1, -0.75);
        paint();
        ctx.restore();
      };
      // Siblings.
      for (let i = 2; i >= 0; i--) {
        const sib = pondSibling(p, i);
        const counted = p >= COUNT[i] && p < SET_OFF;
        const paint = () =>
          duckling(ctx, sib.x, sib.y - sib.lift + bob(i), 1, sib.facing, {
            swim: !sib.lift && sib.y >= WL,
            sit: sib.y < WL,
            eyes: reunion && p > PILE[i] ? 'happy' : blinking(seconds, i * 0.3) ? 'closed' : 'open',
            bill: counted ? hump(p, COUNT[i], COUNT[i] + 0.006) * 0.6 : 0,
            wing: sib.lift ? 1 : 0,
          });
        reflect(paint);
        if (!(reunion && p > PILE[i])) paint();
      }
      const counting = COUNT.reduce((a, c) => a + hump(p, c - 0.002, c + 0.005), 0);
      const frantic = within(p, MISSING, SET_OFF + 0.004);
      const zooming = within(p, WHIRL + 0.004, 0.812);
      const mumPose: Mum = {
        swim: true,
        eyes:
          frantic || within(p, WHIRL, WHIRL + 0.006)
            ? 'wide'
            : p < MISSING
              ? 'stern'
              : reunion && p > SCOOP
                ? 'happy'
                : p > WHIRL
                  ? 'wide'
                  : 'worried',
        look: counting * 0.35 + (zooming ? -0.15 : 0),
        bill: Math.max(
          hump(p, 0.701, 0.704),
          hump(p, 0.704, 0.707),
          hump(p, 0.707, 0.71),
          hump(p, WHIRL, WHIRL + 0.006),
          hump(p, 0.87, 0.876) * 0.5,
        ),
        ruffle: frantic ? 1 : within(p, WHIRL, 0.81) ? 0.6 : 0,
        wing: hump(p, SCOOP - 0.008, SCOOP + 0.008),
        back: reunion && p > SCOOP + 0.006,
        lean: zooming ? -0.12 : 0,
        tucked:
          reunion && p > SCOOP - 0.002
            ? () =>
                duckling(
                  ctx,
                  lerp(HUG - SPLASH_X - 4, -7, tuck),
                  lerp(-8, -14, tuck),
                  1,
                  tuck > 0.5 ? 1 : -1,
                  {
                    sit: tuck > 0.5,
                    swim: tuck <= 0.5,
                    tuft: true,
                    eyes: 'happy',
                  },
                )
            : undefined,
      };
      reflect(() => mother(ctx, mx, WL + bob(3), 1, mf, { ...mumPose, tucked: undefined }));
      if (zooming) {
        for (let k = 0; k < 4; k++) {
          const wx = mx + 18 + k * 9;
          line(ctx, alpha('#FFFFFF', 0.7 - k * 0.15), 1, [
            wx,
            WL - 1 - k * 2,
            wx + 8,
            WL - 2 - k * 3,
          ]);
          line(ctx, alpha('#FFFFFF', 0.7 - k * 0.15), 1, [
            wx,
            WL + 2 + k * 2,
            wx + 8,
            WL + 3 + k * 3,
          ]);
        }
      }
      mother(ctx, mx, WL + bob(3), 1, mf, mumPose);
      // The pile-on.
      if (reunion)
        for (let i = 0; i < 3; i++)
          if (p > PILE[i]) {
            const sib = pondSibling(p, i);
            duckling(ctx, sib.x, sib.y + bob(3), 1, -1, {
              sit: true,
              eyes: 'happy',
              bill: hump(p, PILE[i], PILE[i] + 0.006),
            });
          }
      // The littlest.
      if (p < 0.88 && !(reunion && p > SCOOP - 0.002)) {
        if (!last.swim) shade(ctx, last.x, last.y, 15, 0.22);
        at(
          ctx,
          last.x,
          last.y - 9,
          1,
          () => duckling(ctx, 0, 9 + bob(5) * (last.swim ? 1 : 0), 1, 1, lastPose()),
          1,
          last.spin,
        );
      }
      if (within(p, SPLASH, SPLASH + 0.016)) {
        const t = span(p, SPLASH, SPLASH + 0.016);
        oval(ctx, SPLASH_X, WL, 5 + t * 20, 1.5 + t * 4, alpha('#FFFFFF', 0.8 * (1 - t)));
        for (let k = 0; k < 7; k++)
          box(
            ctx,
            SPLASH_X + (k - 3) * 5 * (0.3 + t),
            WL - Math.sin(t * Math.PI) * (8 + (k % 3) * 5),
            1.5,
            2,
            '#E8F6FA',
          );
      }
      // The finale line: Mum, a sibling, the littlest safe in the middle, two more.
      if (p >= 0.88) {
        const lx = mx - 50,
          lift = bob(7);
        const paint = () =>
          duckling(ctx, lx, WL + 1 + lift, 1, 1, {
            swim: true,
            tuft: true,
            eyes: blinking(seconds, 0.6) ? 'closed' : 'happy',
          });
        reflect(paint);
        paint();
        butterfly(ctx, lx + 3, WL - 25 + lift, 0.9, wingbeat(seconds, 1));
      }
      if (p > 0.84 && p < 0.88)
        for (let k = 0; k < 3; k++) {
          const t = (span(p, 0.84, 0.88) * 1.5 + k * 0.33) % 1;
          faded(ctx, hump(t, 0, 1), () =>
            heart(ctx, HUG - 12 + k * 10 + Math.sin(t * 6 + k) * 3, 112 - t * 22, 2.5),
          );
        }
      // The butterfly leads, hovers, and watches.
      if (p < 0.88) {
        const f = flit(seconds, 4);
        const bx =
          p < 0.78
            ? lerp(last.x + 10, SPLASH_X - 12, span(p, SPLASH - 0.01, SPLASH + 0.01))
            : HUG - 14;
        const by = p < 0.78 ? (p < SPLASH ? last.y - 30 : 118) : 104;
        butterfly(ctx, bx + f.x, by + f.y, 1, wingbeat(seconds));
      }
      nearBank(ctx, seconds, sunset);
      // Counting heads: one, two, three... and a gap.
      COUNT.forEach((c, i) =>
        tally(
          ctx,
          `${i + 1}`,
          270 - i * 18,
          124,
          within(p, c, SET_OFF) ? span(p, c, c + 0.006) : 0,
        ),
      );
      tally(
        ctx,
        '?',
        216,
        124,
        within(p, MISSING, SET_OFF + 0.004) ? span(p, MISSING, MISSING + 0.006) : 0,
        '#D63B3B',
      );
      if (within(p, MISSING, SET_OFF))
        faded(ctx, 0.5, () => oval(ctx, 216, WL + 1, 8, 1.5, '#FFFFFF'));
    },
    null,
  );
  if (within(p, SHOUT, 0.765)) {
    const s = toScreen(v, last.x, last.y - 26);
    bubble(
      ctx,
      'WAIT FOR ME!',
      clamp(s.x + 30, 50, W - 50),
      clamp(s.y - 16, 18, 150),
      span(p, SHOUT, SHOUT + 0.006),
      s.x,
    );
  }
  vignette(ctx, 0.3 + sunset * 0.1);
}
const POND_CAMERA = [
  [0.665, 262, 128, 2.1],
  [0.69, 256, 130, 2.2],
  [0.699, 262, 130, 2.8],
  [0.715, 272, 128, 2.7],
  [0.715, 184, 104, 1.1],
  [0.745, 188, 108, 1.1],
  [0.765, 168, 124, 1.6],
  [0.78, 170, 126, 1.7],
] as const;
const pondView = (p: number): View => {
  if (p < 0.78) return track(p, POND_CAMERA);
  if (p < 0.81) return { x: pondMumX(p) - 14, y: 132, zoom: 2.2 };
  if (p < 0.88)
    return track(p, [
      [0.81, HUG - 6, 132, 2.5],
      [0.88, HUG - 4, 128, 2.9],
    ]);
  return track(p, [
    [0.88, 268, 118, 1.45],
    [1, 290, 122, 1.75],
  ]);
};

// ——— The reel ———
type Shot = (ctx: Ctx, p: number, seconds: number) => void;
const SHOTS: readonly (readonly [number, Shot])[] = [
  [0, streetShot],
  [0.055, (ctx, p, seconds) => laneShot(ctx, p, seconds, laneView(p))],
  [0.24, (ctx, p, seconds) => gardenShot(ctx, p, seconds, track(p, GARDEN_CAMERA))],
  [0.464, (ctx, p, seconds) => duskShot(ctx, p, seconds, duskView(p))],
  [0.665, (ctx, p, seconds) => pondShot(ctx, p, seconds, pondView(p))],
];

// ——— Music ———
const ROOT = 62; // D, as in the original
// The original's duck theme: up the arpeggio, and home.
const THEME = [12, 14, 16, 19, 16, 14, 12, 7, 9, 12, 14, 17, 16, 14, 12, 12];
// The butterfly's waltz: it floats up and never quite lands.
const WALTZ = [19, null, 23, 21, null, 19, 16, null, 14, 12, null, null];

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const theLastDucklingScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: ROOT, voice: 'keys', intro: [12, 14, 16, 19], outro: [0, 7, 12, 16] },
    (s) => {
      const bpm = 60 / (BEAT * s.story); // 120 in the one-minute cut
      const hopeful = (p: number) =>
        [12, 16, 19].forEach((d, i) => s.note(p + i * 0.004, ROOT + d, 0.6, 'bell', 0.08, 0.2));
      const wahWah = (p: number) =>
        [7, 6, 5, 4].forEach((d, i) =>
          s.note(p + i * 0.0065, ROOT + d, i === 3 ? 1.1 : 0.32, 'lead', 0.07, -0.1),
        );
      // ——— Act one: the march.
      s.section({
        from: 0,
        to: 0.128,
        bpm,
        root: ROOT,
        chords: [0, 5, 0, 7],
        melody: THEME,
        voice: 'keys',
        groove: 'march',
        gain: 0.85,
        level: 0.75,
        fade: 0.6,
      });
      s.fx('tweet', 0.004, 1.2, 0.05, 0.6);
      for (let b = 0; b * BEAT < 0.16; b++) {
        const p = b * BEAT;
        s.fx('step', p, 0.08, 0.06, 0.1);
        s.fx('step', p + BEAT / 2, 0.05, 0.03, -0.1);
      }
      for (let n = 0; (n + 0.72) * HOP < PASS; n++)
        s.fx('bounce', (n + 0.72) * HOP, 0.22, 0.045, -0.3);
      for (let i = 0; i < 3; i++) s.fx('squeak', 0.03 + i * 0.012, 0.07, 0.035, (i - 1) * 0.3);
      s.fx('chime', BELL, 0.7, 0.06, 0.1);
      s.fx('chime', BELL + 0.006, 0.9, 0.05, 0.1);
      s.fx('quack', KEEP_UP, 0.3, 0.2, 0.2);
      // ——— Act two: the butterfly's waltz.
      s.section({
        from: 0.128,
        to: 0.24,
        bpm,
        root: ROOT + 5,
        chords: [0, 5, 7, 5],
        groove: 'waltz',
        melody: WALTZ,
        voice: 'bell',
        gain: 0.7,
        level: 0.55,
      });
      s.fx('flutter', 0.112, s.story * 0.045, 0.06, 0.3);
      s.fx('flutter', 0.19, s.story * 0.035, 0.05, -0.2);
      GLANCES.forEach((g, i) => s.fx('squeak', g, 0.07, 0.05, i % 2 ? -0.2 : 0.3));
      s.fx('creak', THROUGH, 0.9, 0.12, -0.2);
      // ——— Act three: mistaken mothers, each a hopeful rise and a sad trombone.
      s.section({
        from: 0.24,
        to: 0.462,
        bpm,
        root: ROOT,
        chords: [0, 5, 7, 5],
        melody: [12, null, 16, null, 19, null, 16, null, 14, null, 17, null, 16, null, 12, null],
        step: 0.5,
        voice: 'pluck',
        groove: 'tick',
        gain: 0.5,
        level: 0.5,
      });
      s.fx('water', 0.24, s.story * 0.07, 0.05, -0.1);
      hopeful(SPOT_POOL);
      s.fx('splash', SPLASH_POOL, 0.35, 0.1, -0.2);
      s.fx('squeak', SQUEAK, 0.35, 0.16, 0.1);
      s.fx('giggle', LAUGH, 1.3, 0.11, 0.5);
      wahWah(SQUEAK + 0.012);
      hopeful(SPOT_VANE);
      CRATES.forEach((c, i) => s.fx('knock', c + 0.006, 0.18, 0.1, 0.1 + i * 0.1));
      s.fx('wind', GUST - 0.003, s.story * 0.028, 0.16, 0.3);
      s.fx('swish', GUST, 0.6, 0.12, 0.3);
      s.fx('creak', GUST + 0.002, 1.3, 0.15, 0.2);
      wahWah(0.376);
      hopeful(SPOT_CLOUD);
      s.fx('wind', 0.41, s.story * 0.05, 0.06, -0.2);
      wahWah(DRIFT + 0.012);
      s.fx('squeak', SIGH, 0.12, 0.04, 0);
      // ——— Act four: alone at the puddle.
      s.section({
        from: 0.464,
        to: 0.578,
        bpm: bpm / 2,
        root: ROOT,
        minor: true,
        chords: [0, -4, -7, -5],
        melody: [15, null, 14, 12, null, null, 10, null],
        voice: 'keys',
        gain: 0.5,
        level: 0.45,
        fade: 1.6,
      });
      s.fx('wind', 0.464, s.story * 0.11, 0.05, 0.2);
      PEEPS.forEach((q) => s.fx('squeak', q, 0.14, 0.035, -0.1));
      s.fx('drip', 0.542, 0.2, 0.08, -0.1);
      s.fx('flutter', 0.546, 0.9, 0.05, 0.3);
      s.note(LAND, ROOT + 24, 2, 'bell', 0.09, 0.1);
      s.chord(LAND, [ROOT + 12, ROOT + 16, ROOT + 19], 3, 'pad', 0.035);
      // ——— Act five: following the butterfly home; the waltz returns and grows.
      s.section({
        from: 0.582,
        to: 0.665,
        bpm,
        root: ROOT + 5,
        chords: [0, 5, 7, 9],
        groove: 'waltz',
        melody: WALTZ,
        voice: 'bell',
        gain: 0.8,
        level: 0.65,
      });
      s.fx('flutter', LIFT, s.story * 0.06, 0.05, 0.2);
      for (let k = 0; k < 14; k++) s.fx('step', 0.594 + k * 0.0022, 0.04, 0.03, -0.2 + k * 0.03);
      s.fx('rustle', 0.64, 0.8, 0.1, 0.2);
      s.fx('pop', SQUEEZE + 0.01, 0.2, 0.12, 0.2);
      // The pond: Mum counting, fretful.
      s.section({
        from: 0.665,
        to: 0.715,
        bpm,
        root: ROOT,
        minor: true,
        chords: [0, 0, -2, -1],
        melody: [12, 15, 12, 15, 12, 15, 17, 15],
        step: 0.5,
        voice: 'pluck',
        groove: 'tick',
        gain: 0.5,
        level: 0.5,
      });
      s.fx('water', 0.665, s.story * 0.33, 0.05, 0.1);
      s.fx('croak', 0.668, 0.5, 0.05, 0.6);
      COUNT.forEach((c) => s.fx('quack', c, 0.18, 0.1, 0.2));
      s.note(MISSING, ROOT + 13, 0.9, 'lead', 0.07, 0.2);
      [0.701, 0.704, 0.707].forEach((q, i) => s.fx('quack', q, 0.18, 0.18, (i - 1) * 0.4));
      // ——— Act six: the run, the splash, the reunion.
      s.section({
        from: 0.715,
        to: 0.786,
        bpm: bpm * 1.2,
        root: ROOT,
        chords: [0, 5, 7, 7],
        melody: THEME,
        step: 0.5,
        voice: 'pluck',
        groove: 'drive',
        gain: 0.6,
        level: 0.7,
        fade: 0.4,
      });
      [0, 0.004, 0.008, 0.013].forEach((d, i) =>
        s.fx('squeak', SHOUT + d, i === 3 ? 0.22 : 0.09, 0.08, -0.3),
      );
      for (let k = 0; k < 10; k++) s.fx('step', 0.734 + k * 0.002, 0.04, 0.05, -0.4 + k * 0.05);
      s.fx('boing', TRIP, 0.6, 0.1, -0.1);
      s.fx('splash', SPLASH, 0.7, 0.22, -0.1);
      s.fx('quack', WHIRL, 0.3, 0.22, 0.3);
      s.fx('swish', WHIRL + 0.004, 1.1, 0.14, 0.1);
      s.section({
        from: 0.8,
        to: 0.88,
        bpm: bpm * 0.75,
        root: ROOT,
        chords: [0, 5, 0, 7],
        melody: THEME,
        voice: 'keys',
        gain: 0.85,
        level: 0.8,
      });
      s.chord(SCOOP, [ROOT + 12, ROOT + 16, ROOT + 19, ROOT + 24], 3, 'pad', 0.04);
      s.fx('sparkle', SCOOP, 1.2, 0.07, 0.2);
      PILE.forEach((q, i) => {
        s.fx('bounce', q - 0.006, 0.2, 0.05, 0.2 + i * 0.1);
        s.fx('squeak', q, 0.08, 0.05, 0.2 + i * 0.1);
      });
      s.fx('quack', 0.87, 0.25, 0.1, 0);
      // ——— The sunset: the theme, slow and gentle, home at last.
      s.section({
        from: 0.88,
        to: 1,
        bpm: bpm * 0.75,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: [12, 14, 16, 19, 16, 14, 12, null, 7, 9, 12, null],
        voice: 'bell',
        groove: 'waltz',
        gain: 0.7,
        level: 0.55,
        fade: 2,
      });
      s.fx('tweet', 0.9, 1.2, 0.04, 0.6);
      s.fx('quack', 0.93, 0.25, 0.08, 0.2);
      s.fx('chime', 0.965, 1.4, 0.07, 0);
    },
  );

export const theLastDuckling: FilmModule = {
  draw(ctx, p, seconds) {
    let paint = SHOTS[0][1];
    for (const [from, shotPaint] of SHOTS) if (p >= from) paint = shotPaint;
    paint(ctx, p, seconds);
    // Soft dips where the light changes most: into dusk, out to the pond, into the sunset.
    veil(
      ctx,
      '#07090C',
      Math.max(hump(p, 0.452, 0.476), hump(p, 0.656, 0.674) * 0.6, hump(p, 0.866, 0.894) * 0.8),
    );
    captions(ctx, p, [
      [0.016, 0.072, 'Keep up, little ones.'],
      [0.415, 0.462, "That's not Mum."],
      [0.83, 0.878, 'Together is better.'],
    ]);
  },
  score: theLastDucklingScore,
  look: {
    shade: '#12211E',
    ink: '#FFF6DE',
    accent: '#F4D078',
    dedication: 'for anyone who ever wandered off',
  },
};
