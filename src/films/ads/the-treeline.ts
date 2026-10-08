import {
  stationTap,
  TUBE_LINE_NAME,
  TUBE_PARCEL_ROUTE,
  TUBE_SIGN_LINES,
  TUBE_SIGN_STATION,
  TUBE_STATIONS,
  tubeStation,
} from '../../lib/tubes';
import type { AdModule } from '../types';
import {
  alpha,
  backOut,
  box,
  camera,
  captions,
  disc,
  ease,
  easeOut,
  H,
  hump,
  lerp,
  line,
  oval,
  person,
  poly,
  presence,
  shade,
  shot,
  sky,
  span,
  TAU,
  track,
  vignette,
  W,
  write,
  type Ctx,
  type Figure,
} from '../kit';
import { composeAd } from '../score-kit';

// The Treeline, 20 s: why the brass bucket at Hedgerow Halt holds one plum umbrella. A neighbor
// meets the sign the hard way, rides the glass behind the trees and steps off at Willow Halt. On
// the ride, the strip at the top maps the whole line: seven halts round the edge of town, the
// stretch from Hedgerow to Willow lit and named, the rest of the loop waiting either side.
/** Shot starts: Hedgerow Halt, the ride behind the tree line, Willow Halt. */
export const CUTS = [0, 0.48, 0.635] as const;
/** The open umbrella meets the glass stack. */
export const BONK = 0.105;
/** The furled umbrella lands in the brass bucket, handle up. */
export const STOW = 0.25;
/** The crouch in the stack, then the fwoomp up into the hood: two air rings and grass puffs. */
export const CROUCH = 0.3;
export const FWOOMP = 0.335;
/** The umbrella strains after its owner, then flops back into the bucket. */
export const TUG = 0.352;
export const FLOP = 0.398;
/** The robin sitting on the glass gets whooshed. */
export const ROBIN = 0.56;
/** The drop at Willow Halt; the waiting neighbor’s boater takes off and comes back down. */
export const ARRIVE = 0.66;
export const HAT_LAND = 0.715;
/** The windswept tuft is patted flat, and springs straight back up. */
export const PAT = 0.722;
export const SPRING = 0.748;

const LINE = TUBE_LINE_NAME.toUpperCase();
// The sign's halt, where the umbrella is stowed, and Willow Halt, where the robin's ride ends:
// the parcels' own stretch of the line.
const [FROM, TO] = [TUBE_SIGN_STATION, TUBE_PARCEL_ROUTE[1]];
const HEDGEROW = tubeStation(FROM).name.toUpperCase();
const WILLOW = tubeStation(TO).name.toUpperCase();
/** On the line's strip a stop is its own name, "Halt" left off, as on a line map. */
export const stopName = (id: string) =>
  tubeStation(id)
    .name.replace(/ Halt$/, '')
    .toUpperCase();

// The Treeline’s own daytime colours (src/city/tubes.ts), at film scale.
const GLASS = '#B9D8CE',
  GLASS_HI = '#F3FAF2',
  GLASS_RIM = '#6F948C',
  GLASS_FRONT = '#D5E9E2';
const METAL = '#8E9A88',
  METAL_SIDE = '#6F7C6B';
const HOOD = '#748269',
  HOOD_TOP = '#8B9A7F',
  LAMP = '#EDE5C1';
const PAD = '#DDD3B3',
  PAD_EDGE = '#C3BD95';
const PLATE = { face: '#CFDDB9', border: '#6F8B66', ink: '#2F4A3B' };
const UMBRELLA = {
  cloth: '#7B5A78',
  rib: '#9C7C98',
  dark: '#5A4058',
  handle: '#6B4A2E',
  bucket: '#B39B63',
  rim: '#D8C288',
};
const PUFF = '#F1F5EA',
  GRASS = '#7E9C60';
const SKY = ['#8EC3D6', '#AAD2DC', '#CAE4DE', '#E6F0DA'];
const LAWN = '#8DB46E',
  LAWN_FAR = '#9CC07C';
const LEAF = ['#4E7A44', '#5A8A4E', '#6E9A58'];
const PAPER = '#F1F8F0',
  MINT = '#A8D8C4',
  BAND = '#16302C';
const STRAW = '#E3D3A4';

const GROUND = 140;
const STACK = { top: 58, half: 13 };
const HEDGEROW_X = 200,
  SIGN_X = 108,
  BUCKET_X = 164;
const WILLOW_X = 164,
  STEP_OFF = 196,
  WAITER_X = 230;
/** The lean of the umbrella in its bucket, handle up. */
const LEAN = -0.12;

const RIDER: Figure = {
  skin: '#E8C0A0',
  hair: '#6B4A34',
  coat: '#C8574A',
  legs: '#3C4744',
  build: 'adult',
  hairStyle: 'short',
  size: 1.25,
};
const WAITER: Figure = {
  skin: '#B8886A',
  hair: '#2A2230',
  coat: '#5A7AA8',
  legs: '#3A3F52',
  build: 'adult',
  hairStyle: 'bun',
  size: 1.25,
  facing: -1,
};

const wrap = (x: number, period: number) => ((x % period) + period) % period;

// ---------------------------------------------------------------------------------------------
// Set pieces

/** The meadow behind both halts: far hills, the hedgerow, the lawn. */
function meadow(ctx: Ctx) {
  oval(ctx, 60, 118, 110, 22, '#B5D09A');
  oval(ctx, 250, 120, 130, 24, '#AACA8E');
  box(ctx, 0, 118, W, H - 118, LAWN_FAR);
  for (let i = 0; i < 12; i++)
    oval(ctx, i * 29 + 6, 121 - (i % 3), 18, 9, i % 2 ? '#5E8A4E' : '#6A9658');
  box(ctx, 0, 125, W, H - 125, LAWN);
  for (let i = 0; i < 16; i++) {
    const x = 8 + i * 20 + (i % 3) * 4,
      y = 150 + (i % 4) * 7;
    box(ctx, x, y, 1, 2, GRASS);
    box(ctx, x + 2, y - 1, 1, 3, GRASS);
    if (i % 3 === 1) disc(ctx, x + 6, y + 1, 1, i % 2 ? '#F4F2EC' : '#C8B4D8');
  }
}

function roundTree(ctx: Ctx, x: number, y: number, r: number, trunk: number) {
  box(ctx, x - 2, y, 4, trunk, '#6A5040');
  oval(ctx, x, y, r, r * 0.92, LEAF[0]);
  oval(ctx, x - r * 0.15, y - r * 0.12, r * 0.8, r * 0.72, LEAF[1]);
  oval(ctx, x - r * 0.35, y - r * 0.4, r * 0.35, r * 0.28, LEAF[2]);
}

/** Glass from the hood out along the spur, `dir` 1 to the right and -1 to the left. */
function spur(ctx: Ctx, x: number, dir: 1 | -1) {
  const y = STACK.top - 11,
    from = dir > 0 ? x + 10 : 0,
    to = dir > 0 ? W : x - 10;
  box(ctx, from, y, to - from, 8, alpha(GLASS, 0.45));
  box(ctx, from, y + 1, to - from, 2, alpha(GLASS_HI, 0.8));
  box(ctx, from, y + 7, to - from, 1, alpha(GLASS_RIM, 0.7));
}

function stackBack(ctx: Ctx, x: number) {
  const { top, half } = STACK;
  oval(ctx, x, GROUND + 1, 21, 5, PAD_EDGE);
  oval(ctx, x, GROUND, 19, 4, PAD);
  box(ctx, x - half, top, half * 2, GROUND - top, alpha(GLASS, 0.32));
  box(ctx, x - half, top, 2, GROUND - top, alpha(GLASS_RIM, 0.35));
  box(ctx, x + half - 2, top, 2, GROUND - top, alpha(GLASS_RIM, 0.35));
  oval(ctx, x, GROUND - 3, half, 2.5, alpha(GLASS_RIM, 0.3));
}

/** The front of the glass: one bright edge, a glint, the rim, the collars and the hood. */
function stackFront(ctx: Ctx, x: number) {
  const { top, half } = STACK;
  box(ctx, x - half, top, half * 2, GROUND - top, alpha(GLASS_FRONT, 0.2));
  box(ctx, x - half + 3, top + 5, 2, GROUND - top - 12, alpha(GLASS_HI, 0.7));
  box(ctx, x - half + 7, top + 9, 1, 12, alpha(GLASS_HI, 0.6));
  box(ctx, x + half - 1, top, 1, GROUND - top, alpha(GLASS_RIM, 0.7));
  box(ctx, x - half - 1, GROUND - 5, half * 2 + 2, 5, METAL);
  box(ctx, x - half - 1, GROUND - 1, half * 2 + 2, 1, METAL_SIDE);
  box(ctx, x - half - 1, top - 4, half * 2 + 2, 5, METAL);
  box(ctx, x - half - 3, top - 10, half * 2 + 6, 6, HOOD);
  box(ctx, x - half - 1, top - 12, half * 2 + 2, 2, HOOD_TOP);
  box(ctx, x - 4, top + 1, 8, 2, LAMP);
}

/** The enamel plate, word for word, on two short legs. */
function sign(ctx: Ctx, x: number) {
  shade(ctx, x - 19, GROUND, 9, 0.22);
  shade(ctx, x + 19, GROUND, 9, 0.22);
  box(ctx, x - 20, GROUND - 30, 2, 30, METAL_SIDE);
  box(ctx, x + 18, GROUND - 30, 2, 30, METAL_SIDE);
  box(ctx, x - 28, GROUND - 57, 56, 28, PLATE.border);
  box(ctx, x - 27, GROUND - 56, 54, 26, PLATE.face);
  box(ctx, x - 27, GROUND - 56, 54, 1, alpha('#FFFFFF', 0.4));
  for (const [dx, dy] of [
    [-25, -54],
    [24, -54],
    [-25, -33],
    [24, -33],
  ])
    box(ctx, x + dx, GROUND + dy, 1, 1, PLATE.border);
  TUBE_SIGN_LINES.forEach((text, i) =>
    write(ctx, text, x, GROUND - 47 + i * 7, { size: 4.5, color: PLATE.ink }),
  );
}

function bucketBack(ctx: Ctx) {
  shade(ctx, BUCKET_X, GROUND, 18, 0.25);
  oval(ctx, BUCKET_X, GROUND - 11, 6, 2, '#6E5E3A');
}

function bucketFront(ctx: Ctx) {
  const x = BUCKET_X;
  poly(ctx, UMBRELLA.bucket, [
    x - 6,
    GROUND - 11,
    x + 6,
    GROUND - 11,
    x + 5,
    GROUND,
    x - 5,
    GROUND,
  ]);
  box(ctx, x - 6, GROUND - 12, 12, 2, UMBRELLA.rim);
  box(ctx, x - 5, GROUND - 6, 10, 1, alpha('#7A6A40', 0.6));
  box(ctx, x - 4, GROUND - 10, 1, 8, alpha('#FFFFFF', 0.28));
}

/**
 * The plum umbrella, drawn from its handle: `angle` 0 points the tip straight up, `open` 0 is
 * furled and 1 a full canopy; `squash` flattens the canopy’s leading side (the bonk).
 */
function umbrella(ctx: Ctx, x: number, y: number, angle: number, open: number, squash = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  line(ctx, UMBRELLA.handle, 2, [0, -1, 0, 2, -1.5, 4, -3.5, 3.5, -4, 2]);
  line(ctx, '#4A3A48', 1, [0, 0, 0, -37]);
  const r = lerp(2.6, 20, open),
    rim = lerp(-12, -20, open),
    apex = -34,
    notch = 2.5 * open;
  const sx = (px: number) => (px > 0 ? px * (1 - squash * 0.35) : px);
  const points: number[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    points.push(sx(Math.cos(a) * r), rim + Math.sin(a) * (rim - apex));
  }
  // A scalloped hem, rib end to rib end, back to the start.
  for (const [k, lift] of [
    [0.75, notch],
    [0.5, 0],
    [0.25, notch],
    [0, 0],
    [-0.25, notch],
    [-0.5, 0],
    [-0.75, notch],
  ])
    points.push(sx(k * r), rim - lift);
  poly(ctx, UMBRELLA.cloth, points);
  if (open > 0.3) {
    poly(ctx, alpha(UMBRELLA.dark, 0.5), [0, apex, sx(-r), rim, sx(-r * 0.5), rim]);
    for (const k of [-0.5, 0, 0.5]) line(ctx, UMBRELLA.rib, 1, [0, apex + 1, sx(k * r), rim]);
  } else box(ctx, -2, -17, 4, 1.5, alpha(UMBRELLA.dark, 1 - open / 0.3));
  box(ctx, -0.5, apex - 3, 1, 3, '#D8D0C0');
  ctx.restore();
}

/** A neighbor, squashed or stretched about the feet, with an optional windswept tuft. */
function figure(ctx: Ctx, x: number, y: number, f: Figure, sx = 1, sy = 1, tuft = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  person(ctx, 0, 0, f);
  if (tuft > 0) {
    const size = f.size ?? 1;
    const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step));
    const top = -36 - bob;
    ctx.scale((f.facing ?? 1) * size, size);
    poly(ctx, f.hair, [
      -5,
      top + 2,
      -4,
      top - 5 * tuft,
      -2,
      top,
      0,
      top - 8 * tuft,
      1.5,
      top,
      3.5,
      top - 6.5 * tuft,
      5,
      top + 2,
    ]);
  }
  ctx.restore();
}

/** The waiting neighbor’s straw boater, band and all. */
function boater(ctx: Ctx, x: number, y: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(-(WAITER.size ?? 1), WAITER.size ?? 1);
  box(ctx, -8, 0, 17, 2, STRAW);
  box(ctx, -8, 1, 17, 1, alpha('#8A7A50', 0.45));
  box(ctx, -4, -4, 9, 4, STRAW);
  box(ctx, -4, -2, 9, 1, UMBRELLA.cloth);
  ctx.restore();
}

/** The soft puff at a stack’s foot: two air rings and a scatter of grass, `age` 0..1. */
function puff(ctx: Ctx, x: number, age: number) {
  if (age <= 0 || age >= 1) return;
  ctx.save();
  ctx.globalAlpha = (1 - age) * 0.9;
  ctx.strokeStyle = PUFF;
  ctx.lineWidth = 1.5;
  for (const r of [16 + 26 * age, 9 + 36 * age]) {
    ctx.beginPath();
    ctx.ellipse(x, GROUND - 1, r, r / 3.4, 0, 0, TAU);
    ctx.stroke();
  }
  for (const [dx, up] of [
    [-1, 1],
    [1, 1.3],
    [-0.6, 1.7],
    [0.7, 0.9],
    [-0.3, 1.4],
    [0.4, 1.8],
  ])
    box(ctx, x + dx * 40 * age, GROUND - 3 - up * 44 * age * (1 - age), 2, 1, GRASS);
  ctx.restore();
}

/** A small caption box in the corner: the line’s name, or a station’s. */
function label(ctx: Ctx, amount: number, big: string, small = '') {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = amount;
  box(ctx, 10, 10, 116, small ? 31 : 21, alpha(BAND, 0.75));
  write(ctx, big, 68, 24, { size: 9, color: PAPER });
  if (small) write(ctx, small, 68, 35, { size: 7, color: MINT });
  ctx.restore();
}

/** A pale rush of glass across the frame, covering it completely at t = 0.5. */
function whoosh(ctx: Ctx, t: number) {
  if (t <= 0 || t >= 1) return;
  const lead = lerp(0, W * 2 + 40, t),
    tail = lead - W - 40;
  box(ctx, tail, 0, W + 40, H, '#9CC8BC');
  box(ctx, tail, 34, W + 40, 3, '#E4F4EE');
  box(ctx, tail, 40, W + 40, 1, '#E4F4EE');
  box(ctx, tail, 146, W + 40, 2, '#C8E4DA');
  box(ctx, lead - 5, 0, 5, H, '#E4F4EE');
  for (let i = 0; i < 6; i++)
    box(ctx, lead - 40 - i * 30 - (i % 2) * 12, 60 + i * 14, 26, 1, alpha('#FFFFFF', 0.6));
}

// ---------------------------------------------------------------------------------------------
// Shot one: Hedgerow Halt

function hedgerowHalt(ctx: Ctx, p: number, seconds: number) {
  meadow(ctx);
  spur(ctx, HEDGEROW_X, 1);
  box(ctx, 236, STACK.top - 3, 3, GROUND - STACK.top - 12, METAL);
  // Just after the fwoomp, a small figure zips off along the spur into the trees.
  const zip = span(p, FWOOMP + 0.016, FWOOMP + 0.036);
  if (zip > 0 && zip < 1) {
    const zx = lerp(HEDGEROW_X + 8, 300, zip),
      zy = STACK.top - 7;
    box(ctx, zx - 14, zy - 1, 12, 1, alpha('#FFFFFF', 0.6));
    box(ctx, zx - 5, zy - 1, 7, 3, RIDER.coat);
    box(ctx, zx + 2, zy - 1, 3, 3, RIDER.skin);
    box(ctx, zx + 2, zy - 2, 3, 1, RIDER.hair);
  }
  roundTree(ctx, 268, 62, 24, 66);
  roundTree(ctx, 312, 56, 26, 72);
  sign(ctx, SIGN_X);
  bucketBack(ctx);
  // The umbrella in the bucket strains toward the glass after the fwoomp, then gives up.
  if (p >= STOW) {
    const pull = ease(span(p, TUG, TUG + 0.012)) - ease(span(p, FLOP, FLOP + 0.006));
    const wobble = span(p, FLOP, FLOP + 0.03);
    const settle = Math.sin(wobble * TAU) * (1 - wobble) * 0.12 + hump(p, STOW, STOW + 0.012) * 0.1;
    const strain = span(p, TUG + 0.012, FLOP);
    const lean = LEAN + pull * (0.58 + strain * 0.16) - settle,
      lift = pull * (8 + strain * 4 + Math.sin(seconds * 38) * 0.8);
    umbrella(
      ctx,
      BUCKET_X + Math.sin(lean) * 22,
      GROUND - 11 - lift - Math.cos(lean) * 22,
      Math.PI + lean,
      0,
    );
  }
  bucketFront(ctx);
  stackBack(ctx, HEDGEROW_X);
  // The neighbor: walk in, bonk, read, furl, stow, step in, crouch, fwoomp.
  const recoil = backOut(span(p, BONK + 0.004, BONK + 0.022));
  const enter = ease(span(p, STOW + 0.006, CROUCH - 0.008));
  const x = lerp(
    p < BONK ? lerp(-24, 155, span(p, 0, BONK)) : lerp(155, 148, recoil),
    HEDGEROW_X,
    enter,
  );
  const walking = p < BONK || (enter > 0 && enter < 1);
  const step = walking ? seconds * 10 : undefined;
  const facing = p > BONK + 0.012 && p < 0.235 ? -1 : 1;
  const bonked = hump(p, BONK - 0.003, BONK + 0.016);
  const throwing = span(p, 0.238, 0.246);
  let arms: readonly [number, number] | undefined;
  if (p < 0.238)
    arms = [walking ? -Math.sin(seconds * 10) * 0.6 : lerp(0.1, 2.3, hump(p, 0.2, 0.238)), 2.5];
  else if (p < STOW + 0.006) arms = [0.1, lerp(2.5, 1.2, throwing)];
  else if (p >= FWOOMP) arms = [2.9, 3.0];
  else if (p >= CROUCH) arms = [-0.7, -0.7];
  const face: Pick<Figure, 'eyes' | 'mouth'> =
    p < BONK
      ? { eyes: 'happy', mouth: 'smile' }
      : p < 0.2
        ? { eyes: 'wide', mouth: 'o' }
        : p < 0.238
          ? { eyes: 'closed', mouth: 'smile' }
          : p < CROUCH
            ? { eyes: 'happy', mouth: 'smile' }
            : p < FWOOMP
              ? { eyes: 'closed', mouth: 'flat' }
              : { eyes: 'happy', mouth: 'grin' };
  let sx = 1,
    sy = 1,
    lift = 0;
  if (p >= CROUCH) {
    const c = ease(span(p, CROUCH, CROUCH + 0.01));
    sx = lerp(1, 1.1, c);
    sy = lerp(1, 0.84, c);
  }
  if (p >= FWOOMP) {
    const k = span(p, FWOOMP, FWOOMP + 0.016);
    sx = 0.72;
    sy = 1.38;
    lift = 100 * k * k;
  }
  const f: Figure = { ...RIDER, facing, step, arms, ...face };
  const inside = p >= CROUCH - 0.01;
  if (inside) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(HEDGEROW_X - STACK.half, STACK.top, STACK.half * 2, GROUND - STACK.top + 6);
    ctx.clip();
  }
  if (lift < 120) figure(ctx, x, GROUND - lift, f, sx, sy);
  if (inside) ctx.restore();
  // The umbrella: carried open, bonked, furled, then tossed with a flip into the bucket.
  if (p < STOW) {
    const hand = {
      x: x + (1 + Math.sin(arms?.[1] ?? 0) * 10) * 1.25 * facing,
      y:
        GROUND +
        (-11 -
          (step === undefined ? 0 : Math.abs(Math.cos(step))) -
          13 +
          2 +
          Math.cos(arms?.[1] ?? 0) * 10) *
          1.25,
    };
    const open = 1 - ease(span(p, 0.205, 0.235));
    const toss = span(p, 0.238, STOW);
    if (toss <= 0)
      umbrella(
        ctx,
        hand.x,
        hand.y,
        (0.12 - bonked * 0.35) * facing * open + Math.sin(seconds * 10) * 0.03 * (walking ? 1 : 0),
        open,
        bonked,
      );
    else {
      const tx = BUCKET_X + Math.sin(LEAN) * 22,
        ty = GROUND - 11 - Math.cos(LEAN) * 22;
      umbrella(
        ctx,
        lerp(hand.x, tx, toss),
        lerp(hand.y, ty, toss) - Math.sin(toss * Math.PI) * 16,
        lerp(0, Math.PI + LEAN, easeOut(toss)),
        0,
      );
    }
    // Three little impact lines where the canopy meets the glass.
    if (bonked > 0.2) {
      const bx = HEDGEROW_X - STACK.half - 2,
        by = GROUND - 62;
      ctx.save();
      ctx.globalAlpha = bonked;
      line(ctx, PAPER, 1, [bx - 3, by - 8, bx - 7, by - 12]);
      line(ctx, PAPER, 1, [bx - 4, by, bx - 9, by]);
      line(ctx, PAPER, 1, [bx - 3, by + 8, bx - 7, by + 12]);
      ctx.restore();
    }
  }
  stackFront(ctx, HEDGEROW_X);
  puff(ctx, HEDGEROW_X, span(p, FWOOMP, FWOOMP + 0.07));
}

// ---------------------------------------------------------------------------------------------
// Shot two: the ride behind the tree line

function robin(ctx: Ctx, x: number, y: number, facing: number, fluff: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * 1.3, 1.3);
  box(ctx, -1, -2, 1, 2, '#6A4A30');
  box(ctx, 1, -2, 1, 2, '#6A4A30');
  poly(ctx, '#6E5040', [-4, -6, -10, -9, -9, -4]);
  oval(ctx, 0, -6, 5 + fluff * 1.5, 4 + fluff * 1.5, '#8A6A50');
  oval(ctx, 2, -5, 3 + fluff, 3 + fluff, '#D8704E');
  disc(ctx, 3, -10, 3 + fluff * 0.5, '#8A6A50');
  box(ctx, 6, -10, 2, 1, '#B07A4A');
  box(ctx, 4, -11, 1, 1, '#1C1A20');
  ctx.restore();
}

/**
 * The whole line along a strip, each halt where it sits along the loop, the far bank's end on the
 * left so the ride runs left to right as the shot does: the stretch from Hedgerow to Willow lit,
 * its two stops named under them, and the rider's dot between them.
 */
const STRIP = { left: 22, right: W - 22, y: 14 };
const TAPS = TUBE_STATIONS.map((station) => stationTap(station.id));
const stripX = (id: string) =>
  lerp(
    STRIP.left,
    STRIP.right,
    (Math.max(...TAPS) - stationTap(id)) / (Math.max(...TAPS) - Math.min(...TAPS)),
  );
function route(ctx: Ctx, progress: number) {
  box(ctx, 8, 6, W - 16, 26, alpha(BAND, 0.75));
  const { y } = STRIP;
  const a = stripX(FROM),
    b = stripX(TO);
  box(ctx, STRIP.left, y - 0.5, STRIP.right - STRIP.left, 1, alpha(MINT, 0.4));
  box(ctx, a, y - 1, b - a, 2, alpha(MINT, 0.85));
  for (const station of TUBE_STATIONS) {
    const ride = station.id === FROM || station.id === TO;
    disc(ctx, stripX(station.id), y, ride ? 2.5 : 1.5, ride ? PAPER : alpha(MINT, 0.85));
  }
  write(ctx, LINE, STRIP.left - 3, y + 13, { size: 7, color: MINT, align: 'left' });
  write(ctx, stopName(FROM), a, y + 13, { size: 7, color: PAPER });
  write(ctx, stopName(TO), b, y + 13, { size: 7, color: PAPER });
  const x = lerp(a, b, progress);
  disc(ctx, x, y, 3.5, PAPER);
  disc(ctx, x, y, 2.5, RIDER.coat);
}

/** The glass on the ride, close up, and where the rider’s middle is across the shot. */
const RIDE_GLASS = { top: 52, bottom: 82 };
const rideMid = (local: number) => 100 + 120 * local;

function ride(ctx: Ctx, local: number, seconds: number) {
  sky(ctx, SKY, 0, H);
  for (let i = 0; i < 4; i++) {
    const x = wrap(i * 120 - local * 60, 480) - 80;
    oval(ctx, x, 116, 90, 24, i % 2 ? '#B5D09A' : '#AACA8E');
  }
  box(ctx, 0, 112, W, H - 112, LAWN_FAR);
  // A breath of wind in the sky.
  for (let i = 0; i < 4; i++)
    box(ctx, wrap(i * 97 - seconds * 420, 400) - 40, 30 + i * 6, 22, 1, alpha('#FFFFFF', 0.45));
  // Far trees behind the glass.
  for (let i = 0; i < 9; i++) {
    const x = wrap(i * 46 - local * 280, 414) - 47,
      r = 16 + (i % 3) * 4;
    oval(ctx, x, 100 - (i % 3) * 5, r, r * 0.9, i % 2 ? '#6E9A58' : '#628E50');
    oval(ctx, x - r * 0.3, 96 - (i % 3) * 5, r * 0.4, r * 0.3, '#7FA868');
  }
  // Posts under the glass, sliding past with it.
  const { top, bottom } = RIDE_GLASS,
    tall = bottom - top;
  const posts = [0, 1, 2, 3, 4].map((i) => wrap(i * 96 - local * 560, 480) - 80);
  for (const x of posts) {
    box(ctx, x - 2, bottom, 4, 64, METAL);
    box(ctx, x - 2, bottom, 1, 64, METAL_SIDE);
  }
  const mid = rideMid(local);
  box(ctx, 0, top, W, tall, alpha(GLASS, 0.42));
  for (let i = 0; i < 7; i++) {
    const x = mid - 40 - ((seconds * 260 + i * 41) % 130);
    box(ctx, x, top + 4 + ((i * 7) % (tall - 7)), 16 + (i % 3) * 8, 1, alpha('#FFFFFF', 0.6));
  }
  // The rider, lying head first along the glass, one arm out in front, grinning at the sky.
  ctx.save();
  ctx.translate(mid - 30, (top + bottom) / 2 + 1);
  ctx.rotate(Math.PI / 2);
  person(ctx, 0, 0, {
    ...RIDER,
    size: 1.7,
    facing: -1,
    arms: [0.1, 0.25],
    eyes: 'happy',
    mouth: 'grin',
  });
  ctx.restore();
  box(ctx, 0, top, W, tall, alpha(GLASS_FRONT, 0.2));
  box(ctx, 0, top + 1, W, 2, alpha(GLASS_HI, 0.8));
  box(ctx, 0, top + 5, W, 1, alpha(GLASS_HI, 0.35));
  box(ctx, 0, bottom - 4, W, 1, alpha(GLASS_HI, 0.25));
  box(ctx, 0, top, W, 1, alpha(GLASS_RIM, 0.6));
  box(ctx, 0, bottom - 1, W, 1, alpha(GLASS_RIM, 0.8));
  for (const x of posts) {
    box(ctx, x - 3, top - 1, 6, tall + 2, alpha(METAL, 0.85));
    box(ctx, x - 3, top - 1, 1, tall + 2, alpha('#FFFFFF', 0.3));
  }
  // Leaves tumbling in the wake.
  for (let i = 0; i < 6; i++) {
    const age = (seconds * 1.3 + i / 6) % 1;
    oval(
      ctx,
      mid - 50 - age * 110 - i * 4,
      bottom + 6 + i * 2 - Math.sin(age * Math.PI) * 14 + age * 10,
      2,
      1,
      LEAF[1 + (i % 2)],
    );
  }
  // The robin on the glass: the rider passes underneath, and it turns right round.
  const at = span(ROBIN, CUTS[1], CUTS[2]);
  const turn = span(local, at, at + 0.22);
  robin(
    ctx,
    rideMid(at) + 560 * (at - local),
    top - hump(local, at, at + 0.22) * 12,
    -Math.cos(turn * Math.PI),
    hump(local, at - 0.02, at + 0.34),
  );
  // Treetops in the foreground, rushing by.
  for (let i = 0; i < 7; i++) {
    const x = wrap(i * 64 - local * 900, 448) - 64,
      r = 30 + (i % 3) * 6,
      y = 170 - (i % 2) * 6;
    oval(ctx, x, y, r, r * 0.8, LEAF[i % 2]);
    oval(ctx, x - 6, y - 6, r * 0.6, r * 0.45, '#679858');
  }
  route(ctx, lerp(0.1, 0.9, local));
}

// ---------------------------------------------------------------------------------------------
// Shot three: Willow Halt

function willow(ctx: Ctx, x: number, seconds: number) {
  line(ctx, '#6A5040', 6, [x + 2, GROUND - 12, x + 6, 62]);
  oval(ctx, x + 4, 56, 38, 24, '#7FA85A');
  oval(ctx, x - 6, 50, 22, 12, '#94BC6E');
  for (let i = 0; i < 15; i++) {
    const fx = x - 32 + i * 5,
      sway = Math.sin(seconds * 1.2 + i * 0.7) * 2;
    line(ctx, i % 2 ? '#8AB86A' : '#76A45A', 2, [
      fx,
      60 + (i % 3) * 3,
      fx + sway,
      100 + ((i * 7) % 5) * 4,
    ]);
  }
}

function willowHalt(ctx: Ctx, p: number, seconds: number) {
  meadow(ctx);
  spur(ctx, WILLOW_X, -1);
  box(ctx, 128, STACK.top - 3, 3, GROUND - STACK.top - 12, METAL);
  willow(ctx, 92, seconds);
  stackBack(ctx, WILLOW_X);
  // The rider drops out of the hood, lands, settles and steps off, windswept.
  const falling = p >= ARRIVE - 0.014 && p < ARRIVE;
  const out = ease(span(p, 0.676, 0.7));
  const x = lerp(WILLOW_X, STEP_OFF, out);
  const inside = p < 0.676;
  let sx = 1,
    sy = 1,
    lift = 0;
  if (falling) {
    const k = span(p, ARRIVE - 0.014, ARRIVE);
    sx = 0.75;
    sy = 1.32;
    lift = 100 * (1 - k) ** 2;
  } else if (p >= ARRIVE) {
    const c = ease(span(p, ARRIVE, ARRIVE + 0.016));
    sx = lerp(1.1, 1, c);
    sy = lerp(0.84, 1, c);
  }
  const patting = p >= PAT && p < SPRING;
  const tuft =
    p < PAT
      ? 1
      : p < SPRING
        ? 1 - 0.85 * ease(span(p, PAT, PAT + 0.01))
        : 0.15 + 0.85 * backOut(span(p, SPRING, SPRING + 0.012));
  const laughing = p > SPRING + 0.008;
  const riderLook: Figure = {
    ...RIDER,
    facing: 1,
    step: out > 0 && out < 1 ? seconds * 10 : undefined,
    arms: falling
      ? [2.9, 3.0]
      : patting
        ? [0.2, 2.9 + Math.sin(seconds * 24) * 0.15]
        : laughing
          ? [0.6, 0.6]
          : out > 0 && out < 1
            ? undefined
            : [0.15, 0.15],
    eyes: falling
      ? 'happy'
      : patting
        ? 'closed'
        : p < SPRING + 0.008 && p >= SPRING
          ? 'wide'
          : 'happy',
    mouth: falling ? 'grin' : patting ? 'smile' : laughing ? 'grin' : 'smile',
  };
  if (p >= ARRIVE - 0.014) {
    if (inside) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(WILLOW_X - STACK.half, STACK.top, STACK.half * 2, GROUND - STACK.top + 6);
      ctx.clip();
    }
    figure(ctx, x, GROUND - lift, riderLook, sx, sy, falling ? 0.6 : tuft);
    if (inside) ctx.restore();
  }
  stackFront(ctx, WILLOW_X);
  puff(ctx, WILLOW_X, span(p, ARRIVE, ARRIVE + 0.07));
  // The waiting neighbor, whose boater goes up with the whoosh and comes back down.
  const flight = span(p, ARRIVE + 0.002, HAT_LAND);
  const flying = flight > 0 && flight < 1;
  const shake = laughing ? Math.abs(Math.sin(seconds * 12)) * 1.2 : 0;
  shade(ctx, WAITER_X, GROUND, 22);
  figure(ctx, WAITER_X, GROUND - shake, {
    ...WAITER,
    arms: flying
      ? [0.2, lerp(0.2, 2.6, hump(p, ARRIVE + 0.004, HAT_LAND))]
      : laughing
        ? [0.4, 1.4]
        : [0.1, 0.1],
    eyes: flying ? 'wide' : laughing || p < ARRIVE ? 'happy' : 'open',
    mouth: flying ? 'o' : laughing ? 'grin' : 'smile',
  });
  const size = WAITER.size ?? 1;
  const up = Math.sin(flight * Math.PI) ** 0.8;
  boater(
    ctx,
    WAITER_X + Math.sin(flight * TAU) * 5,
    GROUND - shake - 35 * size - up * 32 + hump(p, HAT_LAND, HAT_LAND + 0.012) * 1.2,
    Math.sin(flight * Math.PI * 3) * 0.45 * (1 - flight),
  );
}

// ---------------------------------------------------------------------------------------------

export const theTreelineAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    // Picture beats are spot time; this lands each cue on its frame.
    const at = (p: number) => (p * s.duration - s.time(0)) / s.story;
    s.section({
      from: 0,
      to: at(CUTS[1]),
      bpm: 112,
      root: 62,
      chords: [0, 5, 0, 7],
      melody: [7, null, 4, 7, 9, null, 7, 4, 5, null, 2, 5, 7, null, null, null],
      step: 0.5,
      voice: 'pluck',
      groove: 'tick',
      gain: 0.6,
      fade: 0.3,
    });
    s.section({
      from: at(CUTS[1]),
      to: 0.84,
      bpm: 112,
      root: 62,
      chords: [0, 7, 5, 7, 0],
      melody: [12, 11, 12, 14, 16, null, 14, 12, 11, null, 7, 9, 11, 12, null, null],
      step: 0.5,
      voice: 'keys',
      groove: 'drive',
      gain: 0.5,
      level: 0.8,
      fade: 0.5,
    });
    for (let i = 0; i < 8; i++) s.fx('step', at(0.008 + i * 0.012), 0.08, 0.05, -0.7 + i * 0.1);
    s.fx('boing', at(BONK), 0.5, 0.18, 0.1);
    s.fx('gasp', at(BONK + 0.014), 0.4, 0.05, -0.1);
    s.fx('rustle', at(0.205), 0.6, 0.08);
    s.fx('knock', at(STOW), 0.12, 0.12, 0.1);
    s.fx('chime', at(STOW), 1, 0.07, 0.1);
    for (let i = 0; i < 3; i++) s.fx('step', at(0.262 + i * 0.012), 0.08, 0.05, 0.2 + i * 0.1);
    s.fx('squeak', at(CROUCH), 0.2, 0.05, 0.3);
    s.fx('sweep', at(FWOOMP - 0.004), 0.7, 0.2, 0.3);
    s.fx('thud', at(FWOOMP), 0.3, 0.14, 0.3);
    s.fx('swish', at(FWOOMP + 0.016), 0.5, 0.12, 0.7);
    s.fx('whir', at(TUG), (FLOP - TUG) * s.duration, 0.08, 0.1);
    s.fx('creak', at(TUG + 0.01), 0.6, 0.06, 0.1);
    s.fx('knock', at(FLOP + 0.004), 0.12, 0.1, 0.1);
    s.fx('swish', at(CUTS[1] - 0.012), 0.55, 0.14, -0.5);
    s.fx('wind', at(CUTS[1]), (CUTS[2] - CUTS[1]) * s.duration, 0.1);
    s.fx('whir', at(CUTS[1] + 0.01), 2.6, 0.035, 0.3);
    s.fx('tweet', at(ROBIN), 0.6, 0.08, 0.2);
    s.fx('flutter', at(ROBIN + 0.004), 0.6, 0.06, 0.2);
    s.fx('swish', at(CUTS[2] - 0.012), 0.55, 0.14, 0.5);
    s.fx('sweep', at(ARRIVE - 0.014), 0.5, 0.16, -0.1);
    s.fx('thud', at(ARRIVE), 0.3, 0.14, -0.1);
    s.fx('flutter', at(ARRIVE + 0.006), 1, 0.05, 0.5);
    s.fx('pop', at(HAT_LAND), 0.15, 0.1, 0.5);
    s.fx('boing', at(SPRING), 0.5, 0.16, 0.2);
    s.fx('giggle', at(SPRING + 0.008), 0.8, 0.06, 0.5);
    s.chord(at(0.8), [50, 57, 62, 66, 69], 3, 'pad', 0.05);
  });

const HEDGEROW_VIEW = [
  [0, 150, 100, 1.25],
  [BONK + 0.01, 150, 100, 1.25],
  [BONK + 0.035, 118, 97, 2.6],
  [0.205, 120, 97, 2.6],
  [0.235, 168, 100, 1.6],
  [FWOOMP, 170, 100, 1.6],
  [FWOOMP + 0.01, 172, 98, 1.72],
  [CUTS[1], 168, 100, 1.62],
] as const;
const WILLOW_VIEW = [
  [CUTS[2], 168, 100, 1.45],
  [ARRIVE, 172, 100, 1.5],
  [0.8, 184, 104, 1.7],
] as const;

export const theTreelineAd: AdModule = {
  draw(ctx, p, seconds) {
    const { index, local } = shot(p, CUTS);
    if (index === 1) ride(ctx, local, seconds);
    else {
      sky(ctx, SKY, 0, H);
      if (index === 0) camera(ctx, track(p, HEDGEROW_VIEW), () => hedgerowHalt(ctx, p, seconds));
      else camera(ctx, track(p, WILLOW_VIEW), () => willowHalt(ctx, p, seconds));
    }
    for (const cut of CUTS.slice(1)) whoosh(ctx, span(p, cut - 0.014, cut + 0.014));
    label(ctx, presence(p, 0.01, 0.1, 0.01), LINE, HEDGEROW);
    label(ctx, presence(p, CUTS[2] + 0.012, 0.715, 0.01), WILLOW);
    captions(ctx, p, [[FLOP + 0.004, 0.5, 'Now with less suction.']], {}, 0.012);
    vignette(ctx, 0.28);
  },
  score: theTreelineAdScore,
  look: { shade: '#1A302C', ink: '#F1F8F0', accent: '#A8D8C4' },
};
