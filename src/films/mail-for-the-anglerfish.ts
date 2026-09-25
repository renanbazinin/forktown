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
  hump,
  lerp,
  line,
  mix,
  oval,
  poly,
  rand,
  span,
  TAU,
  track,
  veil,
  vignette,
  W,
  within,
  write,
  type Ctx,
  type View,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * MAIL FOR THE ANGLERFISH
 * Pip, the deep-sea postman, delivers all the way down: a top hat for the crab, eight letters
 * for the octopus, a postcard for the whale. Nobody ever writes to the lonely anglerfish at
 * the bottom. When Pip's lamp dies in the trench, the anglerfish's light guides him through,
 * so Pip writes him the first letter he has ever received.
 *
 * The anglerfish's lure is his heart on a stalk: bright with hope, dim when the bag is empty,
 * blooming warm when the letter comes. The deliveries sit on one march grid (BEAT) that the
 * score shares, so the crab's clicks and the octopus's eight catches land on the music.
 */

const BEAT = 0.01; // One march beat in story units: 0.54 s of the 54 s story, about 111 bpm.

// ——— Timing (story units), read by both the pictures and the score ———
// The surface: check the bag, salute, dive.
const BAG = 0.012,
  FAN = 0.021,
  SALUTE = 0.03,
  DUCK = 0.048,
  SHUT = 0.056,
  DIVE = 0.06;
// The crab: a parcel, a hat, and a dance on the march's beats.
const REEF = 0.09,
  PARCEL = 0.1,
  CATCH = 0.114,
  OPEN = 0.12,
  HAT_ON = 0.131;
const CLICKS = [0.14, 0.145, 0.15, 0.16, 0.165] as const;
// The octopus: eight letters, one per half-beat, one for each arm.
const GARDEN = 0.17;
const LETTERS = Array.from({ length: 8 }, (_, i) => 0.175 + (i * BEAT) / 2);
const FLIGHT = 0.01;
const READING = 0.222;
const GIGGLES = [0.228, 0.24] as const;
// The whale.
const WHALE_AT = 0.25,
  BLINK = 0.257,
  POSTCARD = 0.285,
  READ_CARD = 0.3,
  SING = 0.314;
// The trench, where the lamp gives out.
const TRENCH_AT = 0.34,
  HOVER = 0.38,
  LAMP_DIM = 0.39,
  LAMP_OUT = 0.41,
  ALONE = 0.415,
  GLIMMER = 0.436;
// The anglerfish.
const DARK = 0.45,
  GASP = 0.468,
  FACE = 0.48,
  EYES_OPEN = 0.484,
  LEAD = 0.5,
  HOME = 0.54,
  CHECK = 0.565,
  EMPTY = 0.572,
  DROOP = 0.59,
  DIM_FROM = 0.594,
  DIM_TO = 0.612;
// The letter.
const LETTER_AT = 0.62,
  IDEA = 0.633,
  CARD_UP = 0.641;
const NOTE = 'THANK YOU FOR THE LIGHT';
// [first character, length, from, to] for each burst of writing.
const WORDS = [
  [0, 5, 0.649, 0.659],
  [6, 3, 0.662, 0.668],
  [10, 7, 0.672, 0.683],
  [18, 5, 0.686, 0.695],
] as const;
const STAMP = 0.7,
  SEND = 0.706,
  POST_AT = 0.715,
  FLAG_UP = 0.72,
  CHUTE = 0.727,
  ARRIVE = 0.753;
// The bloom, and the ride home.
const READ_AT = 0.76,
  BLOOM_FROM = 0.782,
  BLOOM_TO = 0.816,
  WIGGLE = 0.806,
  GATHER = 0.83,
  RISE = 0.89,
  FINAL = 0.95;

// ——— Palette ———
const YELLOW = '#F4C537',
  YELLOW_DARK = '#D39A25',
  YELLOW_LIGHT = '#FFE68C',
  BRASS = '#C98B2E',
  BRASS_DARK = '#7B5019',
  RED = '#D8423A',
  PAPER = '#FFF6E2';
const FUR = '#8A5A3A',
  FUR_DARK = '#63402A',
  MUZZLE = '#ECD6B2',
  INK = '#241815',
  CAP = '#2F5FAE',
  CAP_DARK = '#1D3566',
  GOLD = '#F2C23A';
const TEAL = '#8FF0DC',
  WARM = '#FFCF78',
  ABYSS = '#02050A',
  CABIN = '#F2C57C';

// ——— Little helpers the kit doesn't have ———
type World = { w: number; h: number };
const SET: World = { w: W, h: H };
/** A filled path with any paint (the kit's poly only takes colours). */
function fillPath(ctx: Ctx, paint: string | CanvasGradient, pts: readonly number[]) {
  ctx.fillStyle = paint;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2)
    if (i) ctx.lineTo(pts[i], pts[i + 1]);
    else ctx.moveTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}
/** The world rectangle a view really shows, with the kit camera's edge clamping. */
function seen(view: View, world: World) {
  const hw = W / 2 / view.zoom,
    hh = H / 2 / view.zoom;
  const x = world.w <= hw * 2 ? world.w / 2 : clamp(view.x, hw, world.w - hw);
  const y = world.h <= hh * 2 ? world.h / 2 : clamp(view.y, hh, world.h - hh);
  return { x0: x - hw, x1: x + hw, y0: y - hh, y1: y + hh, y, zoom: view.zoom };
}
type Seen = ReturnType<typeof seen>;
/** Dithered bands of water (or sky), drawn only where the camera looks. */
function bands(ctx: Ctx, colors: readonly string[], top: number, bottom: number, v: Seen) {
  const step = (bottom - top) / colors.length;
  const x0 = Math.floor(v.x0 / 6) * 6 - 6,
    x1 = v.x1 + 6;
  colors.forEach((color, i) => {
    const a = top + i * step;
    if (a + step >= v.y0 - 2 && a <= v.y1 + 2) box(ctx, x0, a, x1 - x0, Math.ceil(step) + 1, color);
  });
  for (let i = 1; i < colors.length; i++) {
    const y = Math.round(top + i * step);
    if (y < v.y0 - 3 || y > v.y1 + 3) continue;
    for (let x = x0; x < x1; x += 6) {
      box(ctx, x, y - 2, 3, 1, colors[i]);
      box(ctx, x + 3, y - 1, 3, 1, colors[i]);
      box(ctx, x + 3, y, 3, 1, colors[i - 1]);
    }
  }
}
/** Slanting sunbeams from the surface, fading with depth. */
function rays(
  ctx: Ctx,
  seconds: number,
  top: number,
  depth: number,
  xs: readonly number[],
  amount: number,
) {
  if (amount <= 0) return;
  const g = ctx.createLinearGradient(0, top, 0, top + depth);
  g.addColorStop(0, alpha('#EFFFF9', 0.17 * amount));
  g.addColorStop(1, alpha('#EFFFF9', 0));
  xs.forEach((x, i) => {
    const sway = Math.sin(seconds * 0.5 + i * 1.7) * 6,
      w = 9 + (i % 3) * 7,
      slant = depth * 0.35;
    fillPath(ctx, g, [
      x + sway,
      top,
      x + sway + w,
      top,
      x + w * 1.6 + slant,
      top + depth,
      x + slant - w * 0.3,
      top + depth,
    ]);
  });
}
function bubble(ctx: Ctx, x: number, y: number, r: number, a = 0.6) {
  disc(ctx, x, y, r, alpha('#D8F6FF', a * 0.42));
  box(ctx, x - r * 0.6, y - r * 0.7, 1, 1, alpha('#FFFFFF', a));
}
/** A looping column of rising bubbles. */
function bubbleStream(
  ctx: Ctx,
  seconds: number,
  x: number,
  y: number,
  height: number,
  count: number,
  seed: number,
  size = 1,
) {
  for (let i = 0; i < count; i++) {
    const t = (seconds * (0.3 + rand(seed + i) * 0.3) + rand(seed + i * 3)) % 1;
    bubble(
      ctx,
      x + Math.sin(t * 9 + i) * 2.5 + (rand(seed + i * 5) - 0.5) * 7,
      y - t * height,
      (0.7 + rand(seed + i * 11) * 1.4) * size,
      1 - t * t,
    );
  }
}
/** Marine snow, in screen space; `drift` scrolls it with a moving camera. */
function marineSnow(ctx: Ctx, seconds: number, amount: number, drift = 0) {
  for (let i = 0; i < 46; i++) {
    const y =
      ((((rand(i + 3) * (H + 10) + seconds * (3 + rand(i) * 4) - drift) % (H + 10)) + H + 10) %
        (H + 10)) -
      5;
    const x = rand(i * 7 + 1) * W + Math.sin(seconds * 0.6 + i) * 3;
    box(ctx, x, y, i % 6 ? 1 : 2, 1, alpha('#C9DCEB', (0.2 + rand(i * 3) * 0.4) * amount));
  }
}
/** Everything farther than `r` from the light sinks into the deep. */
function deep(ctx: Ctx, x: number, y: number, r: number, amount: number) {
  if (amount <= 0) return;
  const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
  g.addColorStop(0, alpha(ABYSS, 0));
  g.addColorStop(0.55, alpha(ABYSS, amount * 0.5));
  g.addColorStop(1, alpha(ABYSS, amount));
  ctx.fillStyle = g;
  ctx.fillRect(x - 1200, y - 1200, 2400, 2400);
}
/** Additive light: brightens and tints what it falls on instead of fogging it. */
function light(ctx: Ctx, x: number, y: number, r: number, color: string, strength: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, r, color, strength);
  ctx.restore();
}
function envelope(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  rot: number,
  tint = PAPER,
  stamp = RED,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  poly(ctx, tint, [-w / 2, -h / 2, w / 2, -h / 2, w / 2, h / 2, -w / 2, h / 2]);
  line(ctx, '#B9A98A', Math.max(0.25, h * 0.09), [-w / 2, -h / 2, 0, h * 0.12, w / 2, -h / 2]);
  poly(ctx, stamp, [
    w * 0.2,
    -h * 0.4,
    w * 0.42,
    -h * 0.4,
    w * 0.42,
    -h * 0.02,
    w * 0.2,
    -h * 0.02,
  ]);
  ctx.restore();
}

// ——— Pip, the otter postman ———
type Eyes = 'open' | 'happy' | 'wide' | 'sad' | 'worried' | 'closed' | 'down';
type Mouth = 'smile' | 'grin' | 'o' | 'flat' | 'frown' | 'tongue';
type Face = { eyes: Eyes; mouth: Mouth; look?: number; blush?: boolean };

/** Pip's head, face on, in his postman's cap. Units: the head is 14 wide at s = 1. */
function otterHead(ctx: Ctx, x: number, y: number, s: number, f: Face, dim = 0) {
  const c = (color: string) => mix(color, '#0A0F16', dim);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  for (const side of [-1, 1]) {
    disc(ctx, side * 5.9, -3.3, 2.2, c(FUR_DARK));
    disc(ctx, side * 5.9, -3.3, 1.1, c('#C48B78'));
  }
  oval(ctx, 0, 0, 7, 6.3, c(FUR));
  oval(ctx, 0, 2.5, 5.3, 3.5, c(MUZZLE));
  const lx = (f.look ?? 0) * 0.8,
    ly = f.eyes === 'down' ? 0.7 : 0;
  for (const side of [-1, 1]) {
    const ex = side * 2.8 + lx,
      ey = -1.1 + ly;
    if (f.eyes === 'happy')
      line(ctx, c(INK), 0.6, [ex - 1.1, ey + 0.5, ex, ey - 0.6, ex + 1.1, ey + 0.5]);
    else if (f.eyes === 'closed') line(ctx, c(INK), 0.5, [ex - 1, ey + 0.3, ex + 1, ey + 0.3]);
    else if (f.eyes === 'wide') {
      disc(ctx, ex, ey, 1.55, c('#FFFFFF'));
      disc(ctx, ex + lx * 0.25, ey + 0.1, 0.85, c(INK));
    } else {
      oval(ctx, ex, ey, 0.95, f.eyes === 'sad' ? 0.85 : 1.2, c(INK));
      disc(ctx, ex + 0.35, ey - 0.45, 0.33, alpha('#FFFFFF', 1 - dim));
      if (f.eyes === 'sad' || f.eyes === 'worried')
        line(ctx, c(INK), 0.45, [ex + side * 1.3, ey - 1.7, ex - side * 1, ey - 2.6]);
    }
  }
  if (f.blush)
    for (const side of [-1, 1])
      oval(ctx, side * 4.6, 1.8, 1.3, 0.7, alpha('#F08C8C', 0.75 * (1 - dim)));
  oval(ctx, 0, 1.2, 1.5, 1, c(INK));
  const m = f.mouth;
  if (m === 'grin') {
    oval(ctx, 0, 3.3, 1.9, 1.3, c('#5A2025'));
    oval(ctx, 0, 3.9, 1.1, 0.55, c('#E27B7B'));
  }
  if (m === 'o') oval(ctx, 0, 3.3, 0.9, 1.15, c('#4A1B1F'));
  if (m === 'smile' || m === 'tongue' || m === 'grin')
    line(ctx, c(INK), 0.45, [-1.7, 2.5, -0.85, 3.1, 0, 2.4, 0.85, 3.1, 1.7, 2.5]);
  if (m === 'tongue') oval(ctx, 1.3, 3.4, 0.65, 0.5, c('#E27B7B'));
  if (m === 'flat') line(ctx, c(INK), 0.45, [-1.2, 3.1, 1.2, 3.1]);
  if (m === 'frown') line(ctx, c(INK), 0.45, [-1.5, 3.6, 0, 2.9, 1.5, 3.6]);
  for (const side of [-1, 1]) {
    line(ctx, alpha('#FFF4E2', 0.7 * (1 - dim)), 0.25, [side * 3.6, 2.1, side * 8.3, 1.1]);
    line(ctx, alpha('#FFF4E2', 0.7 * (1 - dim)), 0.25, [side * 3.6, 2.8, side * 8.1, 3.3]);
  }
  // The postman's cap: crown, band, brim, and a brass badge.
  poly(ctx, c(CAP), [-6.5, -4.1, 6.5, -4.1, 7.7, -8.6, -7.7, -8.6]);
  poly(ctx, c('#4F86DA'), [-7.7, -8.6, 7.7, -8.6, 7.4, -7.6, -7.4, -7.6]);
  poly(ctx, c(CAP_DARK), [-6.6, -5.4, 6.6, -5.4, 6.5, -4.1, -6.5, -4.1]);
  poly(ctx, c('#13244A'), [-5.8, -4.3, 5.8, -4.3, 4.6, -2.8, -4.6, -2.8]);
  disc(ctx, 0, -6.9, 1.05, c(GOLD));
  ctx.restore();
}
function satchel(ctx: Ctx, x: number, y: number, s: number, open: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (open) {
    poly(ctx, '#9C7743', [-4.6, -3, 4.6, -3, 4.2, -5.6, -4.2, -5.6]);
    for (let i = 0; i < 3; i++) envelope(ctx, -2.4 + i * 2.4, -3.4, 3.6, 2.6, (i - 1) * 0.25);
  }
  poly(ctx, '#C9A266', [-4.6, -3, 4.6, -3, 4.1, 3.6, -4.1, 3.6]);
  if (!open) poly(ctx, '#A9834C', [-4.6, -3, 4.6, -3, 4.6, 0.6, 0, 1.9, -4.6, 0.6]);
  envelope(ctx, 0, open ? 0.8 : -0.8, 3.2, 2.2, 0);
  ctx.restore();
}

/** Pip up in the hatch, waist-deep. (0, 0) is his waist at the rim; units match the sub. */
type Upper = {
  face: Face;
  back: readonly [number, number];
  front: readonly [number, number];
  elbow?: readonly [number, number];
  bag: 'hip' | 'held';
  letters?: boolean;
};
function pipUp(ctx: Ctx, u: Upper) {
  const sleeve = '#2A549F';
  line(ctx, sleeve, 2.8, [-4, -9, u.back[0], u.back[1]]);
  disc(ctx, u.back[0], u.back[1], 1.7, FUR);
  oval(ctx, 0, -5.5, 5.6, 6.8, CAP);
  oval(ctx, 0.5, -6.5, 2.3, 4.2, MUZZLE);
  disc(ctx, 3.3, -7, 0.55, GOLD);
  disc(ctx, 3.5, -4, 0.55, GOLD);
  line(ctx, '#7E5B33', 1.1, [-4.4, -10.5, 5, -1.5]);
  if (u.bag === 'hip') satchel(ctx, 5.5, -1, 0.9, false);
  otterHead(ctx, 0, -16.5, 1, u.face);
  if (u.bag === 'held') satchel(ctx, 0.5, -3.5, 1.05, true);
  line(
    ctx,
    sleeve,
    2.8,
    u.elbow ? [4, -9, ...u.elbow, ...u.front] : [4, -9, u.front[0], u.front[1]],
  );
  if (u.letters)
    for (let i = 0; i < 4; i++)
      envelope(
        ctx,
        u.front[0] + (i - 1.5) * 1.6,
        u.front[1] - 3.4,
        5,
        3.4,
        (i - 1.5) * 0.3,
        PAPER,
        i % 2 ? CAP : RED,
      );
  disc(ctx, u.front[0], u.front[1], 1.7, FUR);
}

// ——— The mail submarine ———
type Sub = {
  s: number;
  facing?: 1 | -1;
  tilt?: number;
  /** Headlamp, 0..1. */
  lamp?: number;
  /** The red mail flag: up (1) means there's post aboard. */
  flag?: number;
  /** The warm cabin light behind the porthole, 0..1. */
  cabin?: number;
  face?: Face;
  up?: Upper;
  sink?: number;
  hatch?: number;
  seconds: number;
};
function beam(ctx: Ctx, amount: number) {
  const g = ctx.createLinearGradient(25, 0, 125, 0);
  g.addColorStop(0, alpha('#FFF1C4', 0.5 * amount));
  g.addColorStop(1, alpha('#FFF1C4', 0));
  fillPath(ctx, g, [25, -8.5, 125, -42, 125, 34, 25, -4.5]);
  glow(ctx, 26, -6.5, 12, '#FFF1C4', 0.7 * amount);
}
function subWindow(ctx: Ctx, face: Face | undefined, cabin: number, ring = 1) {
  disc(ctx, 5, -2, 11.5, mix(ABYSS, BRASS, ring));
  disc(ctx, 5, -2, 10.2, mix(ABYSS, BRASS_DARK, ring));
  ctx.save();
  ctx.beginPath();
  ctx.arc(5, -2, 9.4, 0, TAU);
  ctx.clip();
  disc(ctx, 5, -2, 9.4, mix('#141C26', CABIN, cabin * 0.85));
  if (face) {
    const dim = (1 - cabin) * 0.5;
    oval(ctx, 5, 11, 8, 4.5, mix(CAP, '#0A0F16', dim));
    otterHead(ctx, 5, 1, 0.92, face, dim);
  }
  line(ctx, alpha('#FFFFFF', 0.35), 1.2, [-1.5, -4.5, 0.5, -7.5, 4, -9]);
  ctx.restore();
  for (let i = 0; i < 6; i++)
    disc(
      ctx,
      5 + Math.cos(i * 1.047 + 0.5) * 10.85,
      -2 + Math.sin(i * 1.047 + 0.5) * 10.85,
      0.55,
      mix(ABYSS, '#F6D58E', ring),
    );
}
/** The round yellow mail sub, facing right: porthole, periscope, flag, lamp, chute. */
function sub(ctx: Ctx, x: number, y: number, o: Sub, only: 'all' | 'window' = 'all', ring = 1) {
  const lamp = o.lamp ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.tilt ?? 0);
  ctx.scale(o.s * (o.facing ?? 1), o.s);
  if (only === 'all') {
    if (lamp > 0) beam(ctx, lamp);
    box(ctx, -31, -1.5, 7, 3, '#6D675F');
    oval(ctx, -32, 0, 1.5, 1.5 + Math.abs(Math.sin(o.seconds * 17)) * 6.5, '#A79D8E');
    poly(ctx, CAP, [-19, -12, -29, -18, -27, -8]);
    poly(ctx, CAP, [-19, 12, -29, 18, -27, 8]);
    if (o.up) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-40, -80, 80, 55);
      ctx.clip();
      ctx.translate(-3, -25 + (o.sink ?? 0) * 26);
      pipUp(ctx, o.up);
      ctx.restore();
    }
    line(ctx, '#7D8894', 1.8, [4.5, -24, 4.5, -35, 9, -35]);
    box(ctx, 8, -37, 3, 3, '#56606B');
    box(ctx, -12, -25, 18, 12, YELLOW);
    box(ctx, -12, -25, 3, 12, YELLOW_DARK);
    if ((o.hatch ?? 0) > 0.5) box(ctx, -13, -26, 20, 1, BRASS_DARK);
    else box(ctx, -13, -27, 20, 2, BRASS);
    oval(ctx, 0, 0, 25, 18, YELLOW);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, 25, 18, 0, 0, TAU);
    ctx.clip();
    oval(ctx, 3, 15, 30, 10, YELLOW_DARK);
    // Airmail stripes round the belly.
    box(ctx, -26, 6, 52, 4, PAPER);
    for (let i = -7; i <= 7; i++)
      poly(ctx, i % 2 ? RED : CAP, [i * 4 - 1, 6, i * 4 + 1.5, 6, i * 4 + 0.5, 10, i * 4 - 2, 10]);
    oval(ctx, -9, -10, 10, 3.5, YELLOW_LIGHT, -0.2);
    ctx.restore();
    // The mail flag, on the hull's back: flat when empty, upright when there's post.
    ctx.save();
    ctx.translate(-15, -12);
    ctx.rotate(Math.PI * (1 + 0.5 * (o.flag ?? 0)));
    box(ctx, 0, -1, 11, 2, '#9E2F2A');
    box(ctx, 6, -5, 5, 5, RED);
    ctx.restore();
    disc(ctx, -15, -12, 1.3, BRASS);
    box(ctx, 15, 9, 8, 5, BRASS);
    box(ctx, 16, 10, 6, 2, '#3A2812');
    box(ctx, 20, -10, 5, 7, '#6D675F');
    disc(ctx, 25, -6.5, 2.6, mix('#4E545C', '#FFF6D0', lamp));
  }
  subWindow(ctx, o.up ? undefined : o.face, o.cabin ?? 1, ring);
  ctx.restore();
}
/** World positions of the sub's chute and porthole, for letters and light. */
const chuteOf = (x: number, y: number, s: number) => ({ x: x + 19 * s, y: y + 11 * s });
const windowOf = (x: number, y: number, s: number) => ({ x: x + 5 * s, y: y - 2 * s });

// ——— The anglerfish ———
const BODY = '#3F6784',
  BODY_DARK = '#294762',
  BELLY = '#7FA3BA',
  FIN = '#33587A',
  TOOTH = '#EFEADB',
  GUM = '#1B0F18';
type Fish = {
  s: number;
  facing: 1 | -1;
  seconds: number;
  /** Lure brightness: his mood, 0..1. */
  light: number;
  /** Lure colour, 0 cold teal → 1 warm gold. */
  warm: number;
  /** Eyelids, 0 shut → 1 open. */
  open: number;
  /** −1 sad … 1 happy: mouth corners, brows, lids. */
  mood: number;
  /** How much light reaches his body (0 = silhouette). */
  lit: number;
  happy?: boolean;
  look?: readonly [number, number];
  droop?: number;
  wiggle?: number;
  wave?: number;
  tear?: number;
};
const fishTilt = (a: Fish) =>
  (a.wiggle ?? 0) * Math.sin(a.seconds * 11) * 0.09 + (a.droop ?? 0) * 0.12;
function lureLocal(a: Fish) {
  const droop = a.droop ?? 0;
  return [44 - droop * 8, -31 + droop * 24 + Math.sin(a.seconds * 1.9) * 1.5] as const;
}
/** Where a local point on the fish lands in the world. */
function onFish(x: number, y: number, a: Fish, lx: number, ly: number) {
  const r = fishTilt(a);
  return {
    x: x + (lx * Math.cos(r) - ly * Math.sin(r)) * a.s * a.facing,
    y: y + (lx * Math.sin(r) + ly * Math.cos(r)) * a.s,
  };
}
const lureAt = (x: number, y: number, a: Fish) => onFish(x, y, a, ...lureLocal(a));

function fishEye(
  ctx: Ctx,
  ex: number,
  ey: number,
  r: number,
  a: Fish,
  t: (c: string, k?: number) => string,
) {
  if (a.happy) {
    disc(ctx, ex, ey, r * 0.9, t('#4E7A99'));
    line(ctx, t('#10161C', 1), r * 0.26, [
      ex - r * 0.7,
      ey + r * 0.25,
      ex,
      ey - r * 0.4,
      ex + r * 0.7,
      ey + r * 0.25,
    ]);
    return;
  }
  disc(ctx, ex, ey, r + 0.9, t(BODY_DARK));
  const lit = Math.max(a.lit, 0.3);
  const [lx, ly] = a.look ?? [0, 0];
  const px = ex + lx * r * 0.28,
    py = ey + ly * r * 0.28;
  disc(ctx, ex, ey, r, t('#F2EFE4', lit));
  disc(ctx, px, py, r * 0.7, t('#2F8A8C', lit));
  disc(ctx, px, py, r * 0.46, t('#08141A', lit));
  disc(ctx, px - r * 0.25, py - r * 0.3, r * 0.22, alpha('#FFFFFF', 0.95 * lit));
  disc(ctx, px + r * 0.22, py + r * 0.22, r * 0.1, alpha('#FFFFFF', 0.8 * lit));
  // Lids close the eyes in the dark and sag when he's sad.
  const lid = clamp(1 - a.open + Math.max(0, -a.mood) * 0.35);
  if (lid > 0.02) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ex, ey, r + 0.3, 0, TAU);
    ctx.clip();
    const edge = ey - r + lid * 2 * r;
    poly(ctx, t(BODY), [
      ex - r - 1,
      ey - r - 1,
      ex + r + 1,
      ey - r - 1,
      ex + r + 1,
      edge,
      ex - r - 1,
      edge,
    ]);
    line(ctx, t(BODY_DARK), 0.9, [ex - r, edge, ex + r, edge]);
    ctx.restore();
  }
}
/** Big, toothy, and fearsome at first glance; faces right unless `facing` is −1. */
function angler(ctx: Ctx, x: number, y: number, a: Fish) {
  const droop = a.droop ?? 0,
    wiggle = a.wiggle ?? 0;
  const t = (color: string, k = a.lit) => mix(ABYSS, color, k);
  const toothLit = Math.max(a.lit, a.light * 0.85);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(a.s * a.facing, a.s);
  ctx.rotate(fishTilt(a));
  const wag = Math.sin(a.seconds * (2.6 + wiggle * 8)) * (3 + wiggle * 4);
  poly(ctx, t(FIN), [-25, -4, -45, -19 + wag, -39, wag * 0.4, -45, 18 + wag, -25, 6]);
  line(ctx, t(BODY_DARK), 0.8, [-28, -2, -41, -14 + wag]);
  line(ctx, t(BODY_DARK), 0.8, [-28, 3, -41, 14 + wag]);
  poly(ctx, t(FIN), [-17, -19, -23, -29 + droop * 4, -12, -22, -9, -30 + droop * 4, -3, -23]);
  oval(ctx, 0, 0, 30, 24, t(BODY));
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 24, 0, 0, TAU);
  ctx.clip();
  oval(ctx, 6, 17, 28, 12, t(BELLY));
  oval(ctx, -8, -14, 16, 6, t('#5281A2'), -0.2);
  disc(ctx, -14, -8, 2.6, t(BODY_DARK));
  disc(ctx, -5, -16, 1.8, t(BODY_DARK));
  disc(ctx, -19, 3, 2, t(BODY_DARK));
  ctx.restore();
  // The lure's stalk arcs up from his forehead.
  const [lx, ly] = lureLocal(a);
  const cx = 30,
    cy = -48 + droop * 18;
  const stalk: number[] = [];
  for (let k = 0; k <= 6; k++) {
    const u = k / 6,
      v = 1 - u;
    stalk.push(v * v * 14 + 2 * v * u * cx + u * u * lx, v * v * -21 + 2 * v * u * cy + u * u * ly);
  }
  line(ctx, t('#5E86A6', Math.max(a.lit, a.light * 0.6)), 1.6, stalk);
  // A toothy underbite; the corner of the mouth lifts with his mood.
  const cy0 = 4 - a.mood * 4.5;
  poly(ctx, t(GUM), [7, cy0, 18, 0.5, 31, -2, 36, 4.5, 21, 9.5, 7, cy0 + 0.8]);
  const upper = (px: number) =>
    px < 18 ? lerp(cy0, 0.5, (px - 7) / 11) : lerp(0.5, -2, (px - 18) / 13);
  const lower = (px: number) =>
    px < 21 ? lerp(cy0 + 0.8, 9.5, (px - 7) / 14) : lerp(9.5, 4.5, (px - 21) / 15);
  for (const [px, h] of [
    [14, 2.6],
    [19, 3.6],
    [24, 2.6],
    [28.5, 3.4],
  ])
    poly(ctx, t(TOOTH, toothLit), [
      px - 1.1,
      upper(px) - 0.3,
      px + 1.1,
      upper(px) - 0.3,
      px,
      upper(px) + h,
    ]);
  poly(ctx, t(BODY), [7, cy0 + 0.8, 21, 9.5, 36, 4.5, 38, 8, 33, 15, 19, 19, 7, 14]);
  line(ctx, t('#6E97B5'), 0.9, [9, cy0 + 1.8, 21, 10.4, 36, 5.4]);
  if (a.mood > 0.2) line(ctx, t(BODY_DARK), 1, [6.4, cy0 - 2.6, 4.6, cy0 + 0.2, 6, cy0 + 2.6]);
  for (const [px, h] of [
    [12, 3],
    [16.5, 4.6],
    [21, 3.4],
    [25.5, 5.2],
    [30, 3.6],
    [34, 4.2],
  ])
    poly(ctx, t(TOOTH, toothLit), [
      px - 1.3,
      lower(px) + 0.3,
      px + 1.3,
      lower(px) + 0.3,
      px,
      lower(px) - h,
    ]);
  // Pectoral fin: waves hello, flutters with joy, sags when he's sad.
  const flap =
    Math.sin(a.seconds * (2 + wiggle * 6)) * 0.25 +
    (a.wave ?? 0) * (1.3 + Math.sin(a.seconds * 9) * 0.45);
  ctx.save();
  ctx.translate(2, 13);
  ctx.rotate(-0.35 - droop * 0.45 + flap);
  oval(ctx, -7, 0, 8, 3.6, t('#5A86A8'));
  line(ctx, t(BODY_DARK), 0.6, [-2, 0, -12, -1]);
  ctx.restore();
  // Eyes: huge, round, and kind.
  fishEye(ctx, 26, -9, 4.7, a, t);
  fishEye(ctx, 13.5, -11, 6.3, a, t);
  if (a.open > 0.3 && !a.happy) {
    const sad = Math.max(0, -a.mood),
      hope = Math.max(0, a.mood);
    line(ctx, t(BODY_DARK, Math.max(a.lit, 0.3)), 1.1, [
      8,
      -18.2 + sad * 1.4,
      13.5,
      -19.6 - hope * 0.8 + sad * 0.4,
      19,
      -18.6 - sad * 2.4 - hope * 0.2,
    ]);
    line(ctx, t(BODY_DARK, Math.max(a.lit, 0.3)), 0.9, [
      22.5,
      -15.2 - sad * 1.6,
      26,
      -15.8 - hope * 0.6,
      29.5,
      -14.6 + sad,
    ]);
  }
  if (a.mood > 0.4) oval(ctx, 18, -3.5, 3.2, 1.4, alpha('#F28C9C', (a.mood - 0.4) * 0.8 * a.lit));
  if ((a.tear ?? 0) > 0)
    disc(ctx, 11, -3 + (a.tear ?? 0) * 4, 1, alpha('#BFF4FF', 0.8 * hump(a.tear ?? 0, 0, 1)));
  ctx.restore();
}
/** The lure's bulb and its light, drawn over the darkness. */
function lure(ctx: Ctx, x: number, y: number, a: Fish) {
  const at = lureAt(x, y, a);
  const color = mix(TEAL, WARM, a.warm);
  light(ctx, at.x, at.y, (18 + 80 * a.light) * a.s, color, 0.12 + 0.3 * a.light);
  glow(ctx, at.x, at.y, (5 + 6 * a.light) * a.s, '#FFFFFF', 0.22 + 0.5 * a.light);
  disc(ctx, at.x, at.y, 3.1 * a.s, mix('#35504E', color, 0.35 + 0.65 * a.light));
  disc(ctx, at.x - 0.8 * a.s, at.y - 0.8 * a.s, 1.3 * a.s, alpha('#FFFFFF', 0.35 + 0.6 * a.light));
  return at;
}

// ——— The neighbours ———
const CRAB = '#E0573B',
  CRAB_DARK = '#A93B2A',
  CRAB_LIGHT = '#F58866';
type CrabPose = {
  claws: readonly [number, number];
  open: number;
  bob: number;
  look: number;
  eyes: 'open' | 'happy' | 'wide';
  step: number;
  hat: boolean;
};
function topHat(ctx: Ctx, x: number, y: number) {
  poly(ctx, '#1E1A24', [x - 5, y, x + 5, y, x + 4.6, y - 1.4, x - 4.6, y - 1.4]);
  poly(ctx, '#2A2433', [x - 3, y - 1.3, x + 3, y - 1.3, x + 3.4, y - 8.5, x - 3.4, y - 8.5]);
  poly(ctx, '#C9414B', [x - 3.1, y - 2.3, x + 3.1, y - 2.3, x + 3.2, y - 3.9, x - 3.2, y - 3.9]);
  line(ctx, alpha('#FFFFFF', 0.3), 0.6, [x - 2.1, y - 5, x - 2.4, y - 7.8]);
}
function crab(ctx: Ctx, x: number, y: number, s: number, k: CrabPose) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const lift = k.bob / s;
  // The legs stay planted on the rock (y = 5) while the body bobs.
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const kx = side * (4.5 + i * 2.2);
      const up = Math.max(0, Math.sin(k.step + i * 1.4 + (side > 0 ? Math.PI : 0))) * 1.4;
      line(ctx, CRAB_DARK, 1.2, [
        kx,
        1 - lift,
        kx + side * 3,
        -2 - lift - up,
        kx + side * 4.6,
        5 - up,
      ]);
    }
  ctx.translate(0, -lift);
  k.claws.forEach((raise, i) => {
    const side = i ? 1 : -1;
    const cx = side * (11 + raise),
      cy = -2 - raise * 9;
    line(ctx, CRAB_DARK, 1.6, [side * 6, -1, side * 9.5, -3 - raise * 4, cx, cy + 2.4]);
    oval(ctx, cx, cy, 3.4, 2.5, CRAB, side * (-0.5 - raise * 0.6));
    ctx.save();
    ctx.translate(cx + side, cy - 1.6);
    ctx.rotate(-side * (0.15 + k.open * 0.6));
    oval(ctx, side * 1.8, -0.6, 2.6, 1.2, CRAB_LIGHT);
    ctx.restore();
  });
  oval(ctx, 0, 0, 9.5, 6.2, CRAB);
  oval(ctx, -1.5, -2.4, 5.8, 2.3, CRAB_LIGHT);
  disc(ctx, -4.5, 1.5, 0.8, CRAB_DARK);
  disc(ctx, 4, 2, 0.7, CRAB_DARK);
  line(ctx, CRAB_DARK, 0.6, [-1.6, 2.4, 0, 3.3, 1.6, 2.4]);
  if (k.hat) topHat(ctx, 0, -5.4);
  // Eyes on stalks, splayed wide so a hat fits between them.
  for (const side of [-1, 1]) {
    const ex = side * 6;
    line(ctx, CRAB_DARK, 1, [side * 3, -4.5, side * 4.6, -8, ex, -11]);
    disc(ctx, ex, -11.8, 1.9, '#FFFFFF');
    if (k.eyes === 'happy') line(ctx, INK, 0.55, [ex - 1, -11.4, ex, -12.5, ex + 1, -11.4]);
    else disc(ctx, ex + k.look * 0.7, -11.6, k.eyes === 'wide' ? 0.7 : 1, INK);
  }
  ctx.restore();
}
function parcel(ctx: Ctx, x: number, y: number, rot: number, lid: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  poly(ctx, '#C08A55', [-5, -3.5, 5, -3.5, 5, 4, -5, 4]);
  poly(ctx, '#A87444', [-5, 1.5, 5, 1.5, 5, 4, -5, 4]);
  poly(ctx, RED, [-0.9, -3.5, 0.9, -3.5, 0.9, 4, -0.9, 4]);
  if (lid < 1)
    faded(ctx, 1 - lid, () => {
      ctx.translate(lid * 3, -lid * 9);
      ctx.rotate(lid * 0.8);
      poly(ctx, '#D39B63', [-5.6, -3.5, 5.6, -3.5, 5.6, -5.4, -5.6, -5.4]);
      poly(ctx, RED, [-0.9, -3.5, 0.9, -3.5, 0.9, -5.4, -0.9, -5.4]);
      oval(ctx, -1.8, -6.3, 1.8, 1.1, RED, -0.4);
      oval(ctx, 1.8, -6.3, 1.8, 1.1, RED, 0.4);
    });
  ctx.restore();
}

const OCTO = '#C95C92',
  OCTO_DARK = '#9C3E70',
  OCTO_LIGHT = '#E891BC';
type OctoPose = {
  tips: readonly (readonly [number, number])[];
  eyes: 'open' | 'happy';
  look: number;
  mouth: 'smile' | 'grin' | 'o';
  squash: number;
  seconds: number;
};
/** (x, y) is the middle of the skirt, where the eight arms begin. */
function octopus(ctx: Ctx, x: number, y: number, s: number, o: OctoPose) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (1 + o.squash * 0.08), s * (1 - o.squash * 0.1));
  o.tips.forEach(([tx, ty], i) => {
    const bx = -7 + i * 2,
      by = 2;
    const mx = (bx + tx) / 2 + (i < 4 ? -6 : 6) + Math.sin(o.seconds * 2.2 + i) * 2.5,
      my = (by + ty) / 2 + 6;
    const at = (u: number) => {
      const v = 1 - u;
      return [v * v * bx + 2 * v * u * mx + u * u * tx, v * v * by + 2 * v * u * my + u * u * ty];
    };
    line(ctx, OCTO, 3.4, [...at(0), ...at(0.3), ...at(0.6)]);
    line(ctx, OCTO, 2, [...at(0.6), ...at(0.8), ...at(1)]);
  });
  oval(ctx, 0, 1, 11, 5, OCTO);
  oval(ctx, 0, -13, 12, 13, OCTO);
  oval(ctx, -4.5, -18, 4, 5.5, OCTO_LIGHT, -0.4);
  disc(ctx, 6, -18, 1.4, OCTO_DARK);
  disc(ctx, 8.5, -12, 1, OCTO_DARK);
  disc(ctx, -7.5, -10, 1.1, OCTO_DARK);
  for (const side of [-1, 1]) {
    const ex = side * 4.8,
      ey = -7;
    if (o.eyes === 'happy')
      line(ctx, INK, 0.9, [ex - 2.2, ey + 0.8, ex, ey - 1.4, ex + 2.2, ey + 0.8]);
    else {
      oval(ctx, ex, ey, 3.1, 3.5, '#FFFFFF');
      disc(ctx, ex + o.look * 1.3, ey + 0.5, 1.7, INK);
      disc(ctx, ex + o.look * 1.3 - 0.6, ey - 0.2, 0.55, '#FFFFFF');
    }
    oval(ctx, side * 8.2, -2.5, 1.8, 0.9, alpha('#FF9FB8', 0.8));
  }
  if (o.mouth === 'grin') {
    // A wide D-shaped smile.
    const d: number[] = [];
    for (let k = 0; k <= 6; k++)
      d.push(Math.cos((k / 6) * Math.PI) * 2.8, -2.8 + Math.sin((k / 6) * Math.PI) * 2.4);
    poly(ctx, '#5A1E36', d);
    oval(ctx, 0, -1, 1.4, 0.7, '#F08AA8');
  } else if (o.mouth === 'o') oval(ctx, 0, -1.5, 1.1, 1.3, '#5A1E36');
  else line(ctx, INK, 0.7, [-1.8, -2.4, 0, -1.2, 1.8, -2.4]);
  ctx.restore();
}

type Mailbox = {
  body: string;
  dark: string;
  flag: number;
  plate: string;
  name?: string;
  rust?: boolean;
};
function mailbox(ctx: Ctx, x: number, ground: number, b: Mailbox) {
  box(ctx, x - 1, ground - 30, 3, 30, '#5E4636');
  poly(ctx, b.plate, [
    x - 16,
    ground - 26,
    x + 16,
    ground - 26,
    x + 16,
    ground - 18,
    x - 16,
    ground - 18,
  ]);
  line(ctx, alpha('#000000', 0.25), 0.8, [x - 16, ground - 18, x + 16, ground - 18]);
  if (b.name) write(ctx, b.name, x, ground - 20, { size: 4.8, color: '#2A2530' });
  box(ctx, x - 10, ground - 40, 20, 10, b.body);
  oval(ctx, x, ground - 40, 10, 4, b.body);
  box(ctx, x - 10, ground - 33, 20, 3, b.dark);
  box(ctx, x + 8, ground - 42, 2, 12, b.dark);
  if (b.rust) {
    disc(ctx, x - 5, ground - 36, 2.2, '#6A3822');
    disc(ctx, x + 2, ground - 41, 1.6, '#A8703F');
    disc(ctx, x - 1, ground - 33, 1.4, '#5A2F1E');
    disc(ctx, x + 5, ground - 35, 1.1, '#A8703F');
  }
  ctx.save();
  ctx.translate(x - 6, ground - 35);
  ctx.rotate((-Math.PI / 2) * b.flag);
  const flag = b.rust ? '#8E3A30' : RED;
  box(ctx, 0, -1, 9, 2, flag);
  box(ctx, 5, -1, 4, 4, flag);
  ctx.restore();
}

function jelly(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  color: string,
  seconds: number,
  seed: number,
) {
  const pulse = Math.sin(seconds * 2.2 + seed * 1.9);
  const w = 6.5 * s * (1 + pulse * 0.08),
    h = 5.5 * s * (1 - pulse * 0.08);
  glow(ctx, x, y, 18 * s, color, 0.3);
  for (let i = 0; i < 4; i++) {
    const tx = x + (i - 1.5) * w * 0.42;
    const pts: number[] = [];
    for (let k = 0; k <= 3; k++)
      pts.push(
        tx + Math.sin(seconds * 2 + i * 1.3 + seed + k) * 1.4 * s * (k / 3),
        y + 1 + k * 4 * s,
      );
    line(ctx, alpha(color, 0.55), 0.7, pts);
  }
  const bell: number[] = [];
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI + (k / 8) * Math.PI;
    bell.push(x + Math.cos(a) * w, y + Math.sin(a) * h);
  }
  for (let k = 1; k < 4; k++) bell.push(x + w - (k / 4) * 2 * w, y + (k % 2 ? 1.6 : 0.4) * s);
  poly(ctx, alpha(color, 0.62), bell);
  oval(ctx, x - w * 0.2, y - h * 0.45, w * 0.45, h * 0.35, alpha('#FFFFFF', 0.4));
}
function lanternfish(ctx: Ctx, x: number, y: number, dir: number, seconds: number, seed: number) {
  const wag = Math.sin(seconds * 9 + seed) * 1.2;
  glow(ctx, x, y, 10, '#9FF6FF', 0.25);
  poly(ctx, '#1E3552', [
    x - dir * 4,
    y,
    x - dir * 7.5,
    y - 2.5 + wag,
    x - dir * 7.5,
    y + 2.5 + wag,
  ]);
  oval(ctx, x, y, 4.6, 2.2, '#2B4B70');
  disc(ctx, x + dir * 2.6, y - 0.6, 0.8, '#E8FFFF');
  for (let i = 0; i < 3; i++) box(ctx, x - dir * (2 - i * 1.6) - 0.5, y + 1, 1, 1, '#A9FBFF');
}
/** The escort and the gathering: jellyfish in five soft colours. */
const JELLIES = ['#FF9BD2', '#8FF0FF', '#C7A4FF', '#9DFFC8', '#FFC49B', '#FFE38F'] as const;

// ——— 1. The surface ———
const SURFACE: World = { w: 320, h: 560 };
const SEA_LINE = 112;
const SEA = [
  '#5CD3CB',
  '#47BFC3',
  '#37A6B9',
  '#2B8BAC',
  '#23719C',
  '#1C598B',
  '#164377',
  '#113260',
  '#0D254C',
];
const SURFACE_CAM = [
  [0, 160, 94, 1.35],
  [BAG, 160, 94, 1.35],
  [SALUTE, 148, 80, 2.1],
  [DUCK, 148, 82, 2.0],
  [DIVE, 154, 110, 1.5],
  [REEF, 174, 340, 1.5],
] as const;
function pipOnDeck(p: number, seconds: number): Upper {
  const look = Math.sin(seconds * 1.1) * 0.7;
  if (p < BAG)
    return {
      face: { eyes: 'open', mouth: 'smile', look },
      back: [-6.5, -1.5],
      front: [6.5, -1.5],
      bag: 'hip',
    };
  if (p < FAN)
    return {
      face: { eyes: 'down', mouth: 'smile' },
      back: [-3, -5],
      front: [2.5, -7],
      bag: 'held',
    };
  if (p < SALUTE)
    return {
      face: { eyes: 'happy', mouth: 'grin', blush: true },
      back: [-3, -4.5],
      front: [8.5, -14],
      bag: 'held',
      letters: true,
    };
  if (p < DUCK)
    return {
      face: { eyes: 'open', mouth: 'smile' },
      back: [-6.5, -1.5],
      front: [5.4, -20],
      elbow: [10.5, -13],
      bag: 'hip',
    };
  return { face: { eyes: 'happy', mouth: 'grin' }, back: [-6, -8], front: [6, -8], bag: 'hip' };
}
function surfaceScene(ctx: Ctx, p: number, seconds: number, v: Seen) {
  if (v.y0 < SEA_LINE) {
    bands(ctx, ['#93C9E2', '#B3D7E4', '#D6E3DB', '#F1DBB5', '#F7C897'], 0, SEA_LINE, v);
    glow(ctx, 236, 70, 84, '#FFD890', 0.55);
    disc(ctx, 236, 70, 10, '#FFF4D2');
    for (let i = 0; i < 4; i++) {
      const x = ((i * 97 + seconds * 2.5) % 400) - 40,
        y = 24 + (i % 2) * 20;
      oval(ctx, x, y, 22, 5, alpha('#FFFFFF', 0.55));
      oval(ctx, x + 8, y - 3, 12, 4.5, alpha('#FFF8EC', 0.7));
    }
    // A far island, and the lighthouse where the Deep-Sea Post keeps its office.
    poly(ctx, '#86A7A6', [50, SEA_LINE, 66, 102, 84, 98, 102, 103, 124, SEA_LINE]);
    box(ctx, 80, 84, 5, 15, '#EFE8D8');
    box(ctx, 80, 89, 5, 3, RED);
    box(ctx, 79, 81, 7, 3, '#566C73');
    glow(ctx, 82, 82, 10, '#FFF1B8', 0.5);
    for (let i = 0; i < 2; i++) {
      const gx = 92 + i * 26 + Math.sin(seconds * 0.4 + i) * 8,
        gy = 40 + i * 9,
        flap = Math.sin(seconds * 5 + i * 2) * 1.5;
      line(ctx, '#5A6570', 1, [gx - 4, gy - flap, gx, gy, gx + 4, gy - flap]);
    }
  }
  bands(ctx, SEA, SEA_LINE, SURFACE.h, v);
  rays(ctx, seconds, SEA_LINE, 240, [30, 95, 165, 235, 300], 1);
  for (let i = 0; i < 9; i++) {
    const x = ((i * 37 + seconds * 14) % 380) - 30,
      y = 262 + (i % 3) * 7 + Math.sin(seconds * 1.3 + i) * 2;
    oval(ctx, x, y, 3.2, 1.4, '#A6E6E0');
    poly(ctx, '#A6E6E0', [x - 2.5, y, x - 5.5, y - 1.8, x - 5.5, y + 1.8]);
  }
  bubbleStream(ctx, seconds, 70, 320, 180, 5, 3);
  bubbleStream(ctx, seconds, 260, 380, 200, 5, 9);
  // Pip's boat, bobbing: bag, salute, hatch, dive.
  const bob = Math.sin(seconds * 1.7) * 1.4;
  const d = ease(span(p, DIVE, REEF));
  const sink = span(p, DUCK, SHUT - 0.002);
  const x = 150 + d * 24;
  const y = lerp(SEA_LINE + 3 + bob, 356, d) + easeIn(span(p, SHUT, DIVE)) * 5;
  const tilt =
    Math.sin(seconds * 1.3) * 0.04 * (1 - d) + ease(span(p, SHUT, DIVE + 0.008)) * 0.3 - d * 0.12;
  if (d > 0) bubbleStream(ctx, seconds, x - 30, y + 20, 70, 8, 17);
  sub(ctx, x, y, {
    s: 1.3,
    tilt,
    flag: 1,
    hatch: p < SHUT ? 1 : 0,
    sink,
    up: sink < 1 ? pipOnDeck(p, seconds) : undefined,
    face: { eyes: 'happy', mouth: 'grin' },
    cabin: 0.75,
    lamp: d * 0.6,
    seconds,
  });
  // Below the waterline everything takes a green-blue tint; then the bright surface line.
  if (v.y0 < SEA_LINE + 4) {
    box(ctx, v.x0 - 2, SEA_LINE, v.x1 - v.x0 + 4, v.y1 - SEA_LINE + 2, alpha('#35BFC4', 0.3));
    const pts: number[] = [];
    for (let px = Math.floor(v.x0 / 8) * 8 - 8; px <= v.x1 + 8; px += 8)
      pts.push(px, SEA_LINE + Math.sin(px * 0.09 + seconds * 2.2) * 1.1);
    line(ctx, alpha('#E8FFFA', 0.85), 1.4, pts);
    const splash = span(p, DIVE, DIVE + 0.016);
    if (splash > 0 && splash < 1) {
      oval(ctx, x + 12, SEA_LINE, 10 + splash * 26, 2 + splash * 2, alpha('#F2FFFD', 1 - splash));
      for (let i = 0; i < 7; i++) {
        const dx = (i - 3) * (3 + splash * 9);
        disc(
          ctx,
          x + 12 + dx,
          SEA_LINE - hump(splash, 0, 1) * (7 + (i % 3) * 5),
          1.3,
          alpha('#F2FFFD', 1 - splash * 0.7),
        );
      }
    }
  }
}

// ——— 2. The crab ———
const CRAB_AT = [216, 127] as const;
const REEF_CAM = [
  [REEF, 150, 94, 1.3],
  [0.104, 164, 100, 1.5],
  [0.118, 178, 98, 1.9],
  [GARDEN, 180, 98, 2.0],
] as const;
function reefScene(ctx: Ctx, p: number, seconds: number, v: Seen) {
  bands(ctx, ['#4CC3C4', '#3EAFBF', '#3399B5', '#2B84AA', '#2A7AA3'], 0, 180, v);
  rays(ctx, seconds, 0, 160, [30, 90, 150, 215, 280], 0.9);
  poly(
    ctx,
    '#3592AD',
    [
      0, 150, 0, 118, 30, 110, 62, 122, 96, 112, 130, 126, 170, 118, 210, 124, 250, 108, 290, 116,
      320, 104, 320, 150,
    ],
  );
  poly(ctx, '#2F86A2', [0, 150, 0, 132, 40, 126, 80, 136, 120, 130, 160, 140, 200, 150]);
  for (let i = 0; i < 6; i++) {
    const fx = ((((i * 53 - seconds * 9) % 360) + 360) % 360) - 20,
      fy = 58 + (i % 3) * 8;
    oval(ctx, fx, fy, 2.6, 1.2, '#F6D46A');
    poly(ctx, '#F6D46A', [fx + 2, fy, fx + 4.5, fy - 1.5, fx + 4.5, fy + 1.5]);
  }
  // Kelp and coral sway on either side.
  for (const [kx, tall, color] of [
    [22, 70, '#3E9E73'],
    [36, 52, '#2F7F5E'],
    [284, 64, '#3E9E73'],
    [300, 80, '#2F7F5E'],
  ] as const) {
    const pts: number[] = [];
    for (let k = 0; k <= 6; k++)
      pts.push(kx + Math.sin(seconds * 1.1 + kx + k * 0.8) * k * 0.9, 150 - (k / 6) * tall);
    line(ctx, color, 3, pts);
  }
  for (const [cx, color] of [
    [64, '#F08C8C'],
    [262, '#F2A65A'],
  ] as const) {
    line(ctx, color, 2.4, [cx, 150, cx, 136, cx - 6, 126]);
    line(ctx, color, 2.4, [cx, 138, cx + 7, 128, cx + 8, 120]);
    line(ctx, color, 2, [cx - 3, 131, cx - 10, 130]);
  }
  box(ctx, v.x0, 148, v.x1 - v.x0, 40, '#E6CF98');
  for (let i = 0; i < 14; i++) box(ctx, (i * 47) % 320, 154 + ((i * 7) % 22), 12, 1, '#D4B982');
  poly(
    ctx,
    '#F28C4A',
    [96, 162, 98, 158, 100, 162, 104, 162, 101, 164, 102, 168, 98, 166, 94, 168, 95, 164, 92, 162],
  );
  // The crab's rock.
  oval(ctx, 216, 150, 34, 4, alpha('#0B0E14', 0.18));
  poly(ctx, '#8A8CAB', [186, 150, 190, 140, 202, 134, 228, 133, 242, 139, 248, 150]);
  poly(ctx, '#A3A6C3', [193, 140, 203, 135, 228, 134, 238, 138, 222, 139, 204, 140]);
  // The sub glides in, the parcel pops out, and the crab puts on a show.
  const arrive = ease(span(p, REEF, 0.103));
  const sx = lerp(-40, 136, arrive),
    sy = lerp(30, 88, arrive) + Math.sin(seconds * 1.6) * 1.2;
  const beats = (p - DIVE) / BEAT;
  const dancing = p > 0.136;
  const snap = Math.min(...CLICKS.map((c) => (p >= c && p < c + 0.004 ? (p - c) / 0.004 : 1)));
  const side = dancing ? Math.sin((beats * Math.PI) / 2) : 0;
  const bob = dancing ? Math.abs(Math.sin(beats * Math.PI)) * 2.6 : 0;
  const catching = ease(span(p, PARCEL + 0.004, CATCH));
  const placing = span(p, 0.125, HAT_ON);
  const raise = dancing
    ? ([0.5 + Math.max(0, side) * 0.6, 0.5 + Math.max(0, -side) * 0.6] as const)
    : p < 0.125
      ? ([0.1 + catching * 0.9, 0.1 + catching * 0.9] as const)
      : ([1 - placing * 0.6, 1 - placing * 0.6] as const);
  const cx = CRAB_AT[0] + side * 5;
  crab(ctx, cx, CRAB_AT[1], 1.5, {
    claws: raise,
    open: dancing ? snap : 1,
    bob,
    look: p < PARCEL ? -1 : -0.5,
    eyes: dancing || within(p, OPEN, 0.136) ? 'happy' : p > PARCEL ? 'wide' : 'open',
    step: beats * Math.PI,
    hat: p >= HAT_ON,
  });
  // The parcel: out of the chute, into the claws, open, and the hat comes out.
  const chute = chuteOf(sx, sy, 0.85);
  if (p >= PARCEL && p < 0.136) {
    const fly = span(p, PARCEL, CATCH);
    const px =
      fly < 1 ? lerp(chute.x + 4, cx, easeOut(fly)) : cx + span(p, HAT_ON - 0.004, 0.136) * 26;
    const py =
      fly < 1
        ? lerp(chute.y, 107, ease(fly)) - hump(fly, 0, 1) * 16
        : 107 + easeIn(span(p, HAT_ON - 0.004, 0.136)) * 40;
    parcel(
      ctx,
      px,
      py,
      fly < 1 ? fly * TAU : span(p, HAT_ON - 0.004, 0.136) * 2,
      span(p, OPEN, OPEN + 0.006),
    );
  }
  if (p >= OPEN && p < HAT_ON) {
    const up = easeOut(span(p, OPEN, 0.125)),
      down = ease(placing);
    topHat(ctx, cx, lerp(106 - up * 10, CRAB_AT[1] - 5.4 * 1.5, down) + 0);
  }
  if (within(p, OPEN, OPEN + 0.012)) {
    const t = span(p, OPEN, OPEN + 0.012);
    for (let i = 0; i < 5; i++)
      box(
        ctx,
        cx + Math.cos(i * 1.26) * t * 14,
        100 + Math.sin(i * 1.26) * t * 10 - t * 6,
        1,
        1,
        alpha('#FFF6C0', 1 - t),
      );
  }
  sub(ctx, sx, sy, {
    s: 0.85,
    tilt: (1 - arrive) * 0.25,
    flag: p < CATCH ? 1 : 1 - span(p, CATCH, CATCH + 0.006),
    face:
      p < PARCEL
        ? { eyes: 'open', mouth: 'smile', look: 1 }
        : dancing
          ? { eyes: 'happy', mouth: 'grin', blush: true }
          : { eyes: 'open', mouth: 'grin', look: 1 },
    cabin: 0.8,
    seconds,
  });
  if (dancing)
    for (let i = 0; i < 3; i++) {
      const t = ((((beats + i * 0.66) % 2) + 2) % 2) / 2;
      box(ctx, cx - 18 + i * 18, 110 - t * 18, 2, 2, alpha('#FFF6C0', 1 - t));
    }
}

// ——— 3. The octopus ———
const OCTO_AT = [206, 138] as const;
const OCTO_S = 1.3;
const REST_TIPS = [
  [-15, 7],
  [-12, 9],
  [-8, 10],
  [-3, 10.5],
  [3, 10.5],
  [8, 10],
  [12, 9],
  [15, 7],
] as const;
const FAN_TIPS = REST_TIPS.map((_, i) => {
  const a = Math.PI + ((i + 0.5) / 8) * Math.PI;
  return [Math.cos(a) * 25, -13 + Math.sin(a) * 21] as const;
});
const LETTER_TINTS = [
  '#FFF6E2',
  '#FFE3EC',
  '#E6F3FF',
  '#FFF1C9',
  '#E9FFE6',
  '#F4E8FF',
  '#FFE9D6',
  '#E2FBFF',
];
const GARDEN_CAM = [
  [GARDEN, 150, 98, 1.25],
  [0.185, 162, 104, 1.45],
  [READING, 164, 104, 1.5],
  [READING, 194, 116, 2.25],
  [WHALE_AT, 196, 114, 2.45],
] as const;
function shellHouse(ctx: Ctx, x: number, ground: number, seconds: number) {
  oval(ctx, x + 4, ground, 40, 4, alpha('#0B0E14', 0.2));
  oval(ctx, x, ground - 26, 36, 27, '#F2CDB4');
  oval(ctx, x + 14, ground - 44, 20, 14, '#F6D9C4');
  oval(ctx, x + 24, ground - 56, 11, 8, '#F2CDB4');
  oval(ctx, x + 30, ground - 63, 5, 4, '#F6D9C4');
  for (let i = 0; i < 4; i++)
    line(ctx, '#E3A58A', 2, [
      x - 32 + i * 3,
      ground - 30 - i * 6,
      x - 18 + i * 8,
      ground - 46 - i * 3,
      x + 2 + i * 10,
      ground - 50 - i * 2,
    ]);
  line(ctx, '#E3A58A', 1.6, [x + 6, ground - 52, x + 20, ground - 58, x + 28, ground - 60]);
  box(ctx, x - 22, ground - 62, 6, 12, '#B98A74');
  box(ctx, x - 23, ground - 63, 8, 2, '#A07360');
  bubbleStream(ctx, seconds, x - 19, ground - 64, 60, 5, 41, 0.8);
  disc(ctx, x - 8, ground - 13, 10.5, '#C98F72');
  box(ctx, x - 18, ground - 13, 21, 13, '#C98F72');
  disc(ctx, x - 8, ground - 13, 8.5, '#5E3548');
  box(ctx, x - 16, ground - 13, 17, 13, '#5E3548');
  disc(ctx, x + 14, ground - 31, 5.5, '#C98F72');
  disc(ctx, x + 14, ground - 31, 4.4, '#FFE39A');
  glow(ctx, x + 14, ground - 31, 16, '#FFE39A', 0.35);
  box(ctx, x + 13, ground - 35, 2, 8, '#C98F72');
  box(ctx, x + 10, ground - 32, 8, 2, '#C98F72');
}
function gardenScene(ctx: Ctx, p: number, seconds: number, v: Seen) {
  bands(ctx, ['#2E9AB6', '#2888AD', '#2276A2', '#1D6596', '#1A5B8C'], 0, 180, v);
  rays(ctx, seconds, 0, 150, [50, 130, 200, 270], 0.6);
  poly(
    ctx,
    '#1F6C92',
    [
      0, 152, 0, 112, 24, 104, 60, 118, 110, 108, 150, 124, 190, 112, 240, 116, 290, 100, 320, 108,
      320, 152,
    ],
  );
  box(ctx, v.x0, 150, v.x1 - v.x0, 40, '#BDB08A');
  for (let i = 0; i < 12; i++) box(ctx, (i * 53) % 320, 156 + ((i * 9) % 20), 10, 1, '#A89C78');
  for (let i = 0; i < 7; i++) {
    const a = 0.35 + i * 0.4;
    line(ctx, '#9A6FC6', 1.6, [40, 150, 40 + Math.cos(a) * 22, 150 - Math.sin(a) * 28]);
  }
  line(ctx, '#E0655A', 2.4, [80, 150, 80, 132, 72, 122]);
  line(ctx, '#E0655A', 2.2, [80, 136, 88, 126, 88, 118]);
  for (let i = 0; i < 6; i++)
    line(ctx, '#F29BB5', 1.3, [104 + i * 2, 151, 102 + i * 3 + Math.sin(seconds * 2 + i) * 2, 142]);
  shellHouse(ctx, 250, 150, seconds);
  const caught = LETTERS.filter((at) => p >= at + FLIGHT).length;
  mailbox(ctx, 150, 151, {
    body: '#3E72C0',
    dark: '#2A5292',
    flag: 0,
    plate: '#F3EEDC',
    name: 'OCTO',
  });
  // The sub glides in; eight letters fly; eight arms catch.
  const arrive = ease(span(p, GARDEN, 0.178));
  const sx = lerp(-40, 96, arrive),
    sy = lerp(46, 82, arrive) + Math.sin(seconds * 1.6) * 1.2;
  const out = easeOut(span(p, 0.171, 0.18));
  const ox = lerp(238, OCTO_AT[0], out),
    oy = OCTO_AT[1] - hump(span(p, 0.171, 0.18), 0, 1) * 6;
  const reading = p >= READING;
  const giggle = Math.max(...GIGGLES.map((g) => hump(p, g - 0.004, g + 0.008)));
  const tips = REST_TIPS.map((rest, i) => {
    const up = reading ? 1 : ease(span(p, LETTERS[i] + 0.002, LETTERS[i] + FLIGHT));
    const wave = reading ? Math.sin(seconds * 3 + i) * 1.2 : 0;
    return [
      lerp(rest[0], FAN_TIPS[i][0], up) + wave,
      lerp(rest[1], FAN_TIPS[i][1], up) + wave * 0.5,
    ] as const;
  });
  if (p > 0.171)
    octopus(ctx, ox, oy, OCTO_S * (0.6 + out * 0.4), {
      tips,
      eyes: giggle > 0.3 ? 'happy' : 'open',
      look: reading ? Math.sin(seconds * 7) : -0.8,
      mouth: reading ? 'grin' : caught > 0 ? 'grin' : 'o',
      squash: giggle * Math.abs(Math.sin(seconds * 20)),
      seconds,
    });
  const chute = chuteOf(sx, sy, 0.85);
  LETTERS.forEach((at, i) => {
    if (p < at) return;
    const tip = { x: ox + tips[i][0] * OCTO_S, y: oy + tips[i][1] * OCTO_S };
    const fly = span(p, at, at + FLIGHT);
    const x = lerp(chute.x + 3, tip.x, ease(fly)),
      y = lerp(chute.y, tip.y, ease(fly)) - hump(fly, 0, 1) * 14;
    const rot = fly < 1 ? fly * 5 : (i - 3.5) * 0.18 + Math.sin(seconds * 3 + i) * 0.08;
    envelope(ctx, x, y - 2, 6.4, 4.4, rot, LETTER_TINTS[i], i % 2 ? CAP : RED);
  });
  if (reading)
    for (let i = 0; i < 3; i++) {
      const t = (seconds * 0.5 + i / 3) % 1;
      const hx = OCTO_AT[0] - 6 + i * 6 + Math.sin(t * 8 + i) * 2,
        hy = OCTO_AT[1] - 38 - t * 18;
      faded(ctx, 1 - t, () => {
        disc(ctx, hx - 0.9, hy, 1.1, '#FF7FA8');
        disc(ctx, hx + 0.9, hy, 1.1, '#FF7FA8');
        poly(ctx, '#FF7FA8', [hx - 2, hy + 0.3, hx + 2, hy + 0.3, hx, hy + 2.5]);
      });
    }
  sub(ctx, sx, sy, {
    s: 0.85,
    tilt: (1 - arrive) * 0.25,
    flag: 1 - span(p, 0.21, 0.216),
    face: caught > 3 ? { eyes: 'happy', mouth: 'grin' } : { eyes: 'open', mouth: 'smile', look: 1 },
    cabin: 0.8,
    seconds,
  });
}

// ——— 4. The whale ———
const OPEN_SEA: World = { w: 640, h: 360 };
const EYE = [250, 196] as const;
const WHALE_SUB = [194, 190] as const;
const WHALE_CAM = [
  [WHALE_AT, EYE[0], EYE[1], 5.2],
  [0.265, EYE[0], EYE[1], 5],
  [0.29, 262, 176, 0.72],
  [0.302, 226, 190, 1.9],
  [0.316, 226, 188, 1.9],
  [TRENCH_AT, 236, 170, 1.3],
] as const;
function whale(ctx: Ctx, p: number, seconds: number) {
  const sing = ease(span(p, SING, SING + 0.01));
  // The long pectoral fin, then the vast head that runs on past the frame.
  poly(ctx, '#8FA9BF', [330, 250, 362, 258, 476, 342, 458, 352, 398, 330]);
  oval(ctx, 430, 190, 380, 112, '#4A6C8F');
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(430, 190, 380, 112, 0, 0, TAU);
  ctx.clip();
  oval(ctx, 400, 286 + sing * 3, 360, 68 + sing * 6, '#B9CCD9');
  for (let i = 0; i < 7; i++)
    line(ctx, '#90A9BC', 1.5, [70 + i * 8, 234 + i * 8, 640, 256 + i * 9]);
  oval(ctx, 380, 108, 300, 26, '#5A7FA3');
  ctx.restore();
  line(ctx, '#243C57', 2.2, [60, 210, 140, 224, 220, 226, 268, 216 + sing * 5]);
  for (const [bx, by, r] of [
    [78, 170, 3.6],
    [96, 152, 3.2],
    [120, 138, 3.4],
    [148, 126, 3],
    [90, 198, 3],
    [116, 202, 2.8],
    [142, 206, 2.6],
  ] as const) {
    disc(ctx, bx, by, r, '#3A5878');
    disc(ctx, bx - r * 0.3, by - r * 0.3, r * 0.4, '#5C80A4');
  }
  for (const [bx, by] of [
    [70, 214],
    [76, 219],
    [84, 216],
  ] as const)
    disc(ctx, bx, by, 1.8, '#D6D9CF');
  line(ctx, '#34506E', 2, [300, 84, 316, 83]);
  // The eye: the whole frame, at first.
  const [ex, ey] = EYE;
  oval(ctx, ex, ey, 17, 12, '#3D5B7B');
  arc(ctx, ex, ey + 2, 19, 15, 3.5, 5.9, '#34506E', 1.2);
  arc(ctx, ex, ey - 1, 22, 17, 3.7, 5.6, '#3A5878', 0.9);
  arc(ctx, ex, ey - 2, 14, 15, 0.7, 2.4, '#34506E', 1);
  const happy = p > SING - 0.003;
  if (happy) {
    arc(ctx, ex, ey + 4, 8, 7, 3.6, 5.8, '#1B2A3C', 2.4);
    arc(ctx, ex, ey + 2, 11, 7, 0.9, 2.2, '#34506E', 1);
  } else {
    const look = within(p, READ_CARD, SING) ? -0.6 + Math.sin(seconds * 6) * 0.4 : -0.5;
    oval(ctx, ex, ey, 9, 7.5, '#EEF2F0');
    disc(ctx, ex + look * 3, ey, 5.8, '#3A2A22');
    disc(ctx, ex + look * 3, ey, 3.4, '#0E0B0A');
    disc(ctx, ex + look * 3 - 2, ey - 2.4, 1.6, '#FFFFFF');
    disc(ctx, ex + look * 3 + 1.4, ey + 1.8, 0.7, '#FFFFFF');
    const lid = hump(p, BLINK - 0.004, BLINK + 0.006);
    if (lid > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ex, ey, 9.5, 8, 0, 0, TAU);
      ctx.clip();
      box(ctx, ex - 10, ey - 9, 20, 17 * lid, '#46688B');
      ctx.restore();
    }
  }
  // Song: rings through the water, and bubbles rising.
  if (sing > 0) {
    for (let i = 0; i < 3; i++) {
      const t = (seconds * 0.4 + i / 3) % 1;
      const r = 20 + t * 170;
      arc(ctx, 170, 200, r, r * 0.8, 0, TAU, alpha('#DDF3FF', (1 - t) * 0.3 * sing), 1.5);
    }
    bubbleStream(ctx, seconds, 308, 82, 120, 10, 61, 1.6);
    bubbleStream(ctx, seconds, 262, 214, 150, 9, 71, 1.4);
    for (let i = 0; i < 3; i++) {
      const t = (seconds * 0.3 + i / 3) % 1;
      faded(ctx, sing * hump(t, 0, 1), () =>
        quaver(ctx, 274 + i * 12 + Math.sin(t * 7 + i) * 4, 222 - t * 90, '#E8F6FF'),
      );
    }
  }
}
/** A stroked elliptical arc. */
function arc(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
  color: string,
  width: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, from, to);
  ctx.stroke();
}
/** A little pixel note floating up from a singer. */
function quaver(ctx: Ctx, x: number, y: number, color: string) {
  oval(ctx, x, y, 2.2, 1.6, color, -0.4);
  box(ctx, x + 1.4, y - 8, 1, 8, color);
  poly(ctx, color, [x + 2.4, y - 8, x + 5, y - 5.5, x + 4.4, y - 4.6, x + 2.4, y - 6.4]);
}
function whaleScene(ctx: Ctx, p: number, seconds: number, v: Seen) {
  bands(ctx, ['#2A6FA3', '#235E93', '#1D4F82', '#184271'], 0, 360, v);
  rays(ctx, seconds, 0, 260, [80, 200, 330, 460, 560], 0.8);
  for (let i = 0; i < 10; i++) {
    const fx = ((i * 71 + seconds * 6) % 700) - 30,
      fy = 40 + (i % 4) * 16;
    oval(ctx, fx, fy, 3, 1.2, alpha('#9CC8E6', 0.5));
  }
  whale(ctx, p, seconds);
  const [sx, sy0] = WHALE_SUB;
  const sy = sy0 + Math.sin(seconds * 1.5) * 1.2;
  if (p >= POSTCARD) {
    const chute = chuteOf(sx, sy, 0.55);
    const fly = span(p, POSTCARD, READ_CARD);
    const x =
        lerp(chute.x + 2, EYE[0] - 16, ease(fly)) + (fly >= 1 ? Math.sin(seconds * 1.4) * 0.6 : 0),
      y =
        lerp(chute.y, EYE[1] - 2, ease(fly)) -
        hump(fly, 0, 1) * 8 -
        span(p, SING + 0.004, TRENCH_AT) * 30;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(fly < 1 ? (1 - fly) * 3 : Math.sin(seconds * 1.4) * 0.1);
    ctx.scale(0.9, 0.9);
    poly(ctx, PAPER, [-5, -3.5, 5, -3.5, 5, 3.5, -5, 3.5]);
    poly(ctx, '#8FD3E8', [-4.3, -2.8, 0.6, -2.8, 0.6, 2.8, -4.3, 2.8]);
    poly(ctx, '#3FB5C0', [-4.3, 0.8, 0.6, 0.8, 0.6, 2.8, -4.3, 2.8]);
    disc(ctx, -1.5, -1, 0.9, '#FFD35A');
    line(ctx, '#B9A98A', 0.35, [1.6, 0, 4.2, 0]);
    line(ctx, '#B9A98A', 0.35, [1.6, 1.4, 4.2, 1.4]);
    poly(ctx, RED, [2.8, -2.8, 4.3, -2.8, 4.3, -1.2, 2.8, -1.2]);
    ctx.restore();
  }
  sub(ctx, sx, sy, {
    s: 0.55,
    flag: 1 - span(p, POSTCARD, POSTCARD + 0.006),
    lamp: 0.25,
    face:
      p < POSTCARD
        ? { eyes: 'wide', mouth: 'o', look: 1 }
        : p < SING
          ? { eyes: 'open', mouth: 'smile', look: 1 }
          : { eyes: 'happy', mouth: 'grin', blush: true },
    cabin: 0.85,
    seconds,
  });
}

// ——— 5. The trench ———
const TRENCH: World = { w: 320, h: 440 };
const TRENCH_CAM = [
  [TRENCH_AT, 160, 60, 1.6],
  [HOVER, 164, 330, 1.6],
  [HOVER, 172, 350, 2.3],
  [ALONE, 170, 354, 2.5],
] as const;
function wall(side: -1 | 1) {
  const pts: number[] = side < 0 ? [-40, -40] : [360, -40];
  for (let i = -1; i <= 21; i++) {
    const y = i * 22;
    const base = side < 0 ? 62 + y * 0.1 : 258 - y * 0.1;
    pts.push(
      base +
        side * Math.sin(y * 0.02 + (side > 0 ? 2 : 0)) * 14 +
        (rand(i * 3.7 + side * 11) - 0.5) * 18,
      y,
    );
  }
  pts.push(side < 0 ? -40 : 360, 480);
  return pts;
}
const WALLS = [wall(-1), wall(1)] as const;
function trenchSub(p: number, seconds: number) {
  const down = ease(span(p, TRENCH_AT, HOVER));
  return {
    x: 150 + down * 18 + Math.sin(seconds * 0.9) * 2,
    y: lerp(40, 346, down) + Math.sin(seconds * 1.4) * 1.2,
    tilt: 0.3 * (1 - span(p, 0.37, HOVER + 0.006)),
  };
}
function trenchScene(ctx: Ctx, p: number, seconds: number, v: Seen) {
  bands(ctx, ['#0F2446', '#0C1D3A', '#09172F', '#061124', '#040C1A', '#03080F'], 0, 440, v);
  poly(
    ctx,
    '#0A1830',
    [120, 480, 132, 300, 140, 250, 150, 320, 164, 200, 176, 300, 188, 260, 200, 480],
  );
  for (const pts of WALLS) {
    poly(ctx, '#1A2F4C', pts);
    line(ctx, '#2F4E76', 2.5, pts.slice(2, -2));
  }
  // Ledges and cracks, so the walls read as rock.
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1,
      y = 16 + i * 30;
    const x = side < 0 ? 40 + y * 0.1 : 280 - y * 0.1;
    line(ctx, '#243E62', 1.5, [x - side * 26, y, x, y + 6, x + side * 4, y + 16]);
  }
  const s = trenchSub(p, seconds);
  const lamp = 1 - ease(span(p, LAMP_DIM, LAMP_OUT));
  const worried = p > 0.37;
  const o: Sub = {
    s: 1,
    tilt: s.tilt,
    lamp,
    flag: 0,
    cabin: 0.55,
    face: worried
      ? {
          eyes: p > LAMP_OUT ? 'wide' : 'worried',
          mouth: p > LAMP_OUT ? 'o' : 'flat',
          look: Math.sin(seconds * 2),
        }
      : { eyes: 'open', mouth: 'smile', look: 1 },
    seconds,
  };
  sub(ctx, s.x, s.y, o);
  // When the lamp fades, the dark closes in until only the porthole glows.
  const dark = 0.6 + 0.36 * ease(span(p, LAMP_DIM, LAMP_OUT + 0.004));
  const win = windowOf(s.x, s.y, 1);
  deep(ctx, win.x + lamp * 50, win.y + lamp * 12, 26 + lamp * 120, dark);
  sub(ctx, s.x, s.y, o, 'window', 0.35);
  glow(ctx, win.x, win.y, 22, CABIN, 0.3);
}
function trenchFore(ctx: Ctx, v: Seen) {
  // Near rocks slide past faster than the walls: parallax for the long way down.
  const off = v.y * v.zoom * 1.4;
  for (let i = 0; i < 4; i++) {
    const y = ((((i * 120 - off) % 480) + 480) % 480) - 120;
    const side = i % 2 ? 1 : -1;
    const x = side < 0 ? 0 : W;
    poly(ctx, '#03070E', [
      x,
      y,
      x - side * (24 + (i % 3) * 10),
      y + 30,
      x - side * 12,
      y + 70,
      x - side * 30,
      y + 96,
      x,
      y + 120,
    ]);
  }
}

// ——— The porthole, close ———
const PX = 160,
  PY = 94;
type Close = { face: Face; cabin: number; hull: number; outside: number };
function closeUp(ctx: Ctx, o: Close, props?: () => void) {
  box(ctx, 0, 0, W, H, mix(ABYSS, YELLOW_DARK, o.hull));
  oval(ctx, 40, 10, 90, 36, alpha(YELLOW_LIGHT, o.hull * 0.4));
  for (let i = 0; i < 5; i++) {
    disc(ctx, 22, 18 + i * 36, 2.2, mix(ABYSS, BRASS, o.hull + 0.1));
    disc(ctx, 298, 18 + i * 36, 2.2, mix(ABYSS, BRASS, o.hull + 0.1));
  }
  glow(ctx, W + 30, PY, 180, TEAL, 0.45 * o.outside);
  const ring = Math.max(o.hull, o.cabin * 0.35);
  disc(ctx, PX, PY, 90, mix(ABYSS, BRASS, ring));
  disc(ctx, PX, PY, 81, mix(ABYSS, BRASS_DARK, ring));
  for (let i = 0; i < 12; i++)
    disc(
      ctx,
      PX + Math.cos((i * TAU) / 12) * 85.5,
      PY + Math.sin((i * TAU) / 12) * 85.5,
      2.2,
      mix(ABYSS, '#F6D58E', ring),
    );
  ctx.save();
  ctx.beginPath();
  ctx.arc(PX, PY, 78, 0, TAU);
  ctx.clip();
  box(ctx, 0, 0, W, H, mix('#0D131B', '#6E4A36', o.cabin));
  // The cabin: pigeonholes full of post, and a little lamp.
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      box(ctx, 86 + c * 15, 30 + r * 13, 13, 11, mix('#0D131B', '#4A2E22', o.cabin));
      if ((r + c) % 2 === 0)
        box(ctx, 88 + c * 15, 35 + r * 13, 9, 5, mix('#0D131B', PAPER, o.cabin * 0.9));
    }
  glow(ctx, 222, 36, 70, '#FFD49A', 0.5 * o.cabin);
  disc(ctx, 222, 36, 5, mix('#2A2A2A', '#FFF1C8', o.cabin));
  const dim = (1 - o.cabin) * 0.5;
  oval(ctx, PX, 176, 62, 38, mix(CAP, '#0A0F16', dim));
  oval(ctx, PX, 170, 16, 30, mix(MUZZLE, '#0A0F16', dim));
  disc(ctx, PX + 20, 152, 2.6, mix(GOLD, '#0A0F16', dim));
  disc(ctx, PX + 21, 166, 2.6, mix(GOLD, '#0A0F16', dim));
  otterHead(ctx, PX, 76, 5, o.face, dim);
  props?.();
  glow(ctx, 250, PY, 80, TEAL, 0.3 * o.outside);
  line(ctx, alpha('#FFFFFF', 0.16), 6, [100, 72, 112, 46, 136, 28]);
  line(ctx, alpha('#FFFFFF', 0.1), 3, [108, 86, 118, 62]);
  ctx.restore();
}
const paw = (ctx: Ctx, x: number, y: number, dim = 0) =>
  disc(ctx, x, y, 7, mix(FUR, '#0A0F16', dim));
function worriedClose(ctx: Ctx, p: number, seconds: number) {
  const glimmer = ease(span(p, GLIMMER, DARK));
  const look = p < 0.426 ? -1 : 1;
  closeUp(
    ctx,
    {
      face:
        p < GLIMMER
          ? { eyes: 'worried', mouth: p < 0.426 ? 'frown' : 'flat', look }
          : { eyes: 'wide', mouth: 'o', look: 1 },
      cabin: 0.3,
      hull: 0.06,
      outside: glimmer * 0.7,
    },
    () => {
      // Paws to his cheeks: oh no.
      const shiver = Math.sin(seconds * 24) * 0.6;
      paw(ctx, 128 + shiver, 92, 0.35);
      paw(ctx, 192 - shiver, 92, 0.35);
    },
  );
}
function bagClose(ctx: Ctx, p: number, seconds: number) {
  const flip = ease(span(p, EMPTY + 0.004, EMPTY + 0.01));
  const shake = within(p, EMPTY + 0.01, DROOP - 0.002) ? Math.sin(seconds * 40) * 3 : 0;
  closeUp(
    ctx,
    {
      face:
        p < EMPTY + 0.008
          ? { eyes: 'down', mouth: 'flat' }
          : { eyes: 'sad', mouth: 'frown', look: p < 0.583 ? 0 : 1 },
      cabin: 0.6,
      hull: 0.1,
      outside: 0.6,
    },
    () => {
      const bx = PX + shake,
        by = 132 - flip * 4;
      // The mailbag, open to show there's nothing inside; then upside down, shaken.
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.PI * flip);
      poly(ctx, '#C9A266', [-26, -12, 26, -12, 32, 24, -32, 24]);
      poly(ctx, '#B08A52', [-32, 16, 32, 16, 32, 24, -32, 24]);
      oval(ctx, 0, -12, 26, 7, '#8C6A3E');
      oval(ctx, 0, -12, 22, 5, '#2A1A10');
      poly(ctx, RED, [-32, 4, 32, 4, 32, 9, -32, 9]);
      ctx.restore();
      paw(ctx, bx - 30, by + 2, 0.2);
      paw(ctx, bx + 30, by + 2, 0.2);
      // Nothing falls out but a puff of lint.
      const fall = span(p, EMPTY + 0.011, DROOP);
      if (fall > 0)
        for (let i = 0; i < 3; i++)
          disc(ctx, bx - 6 + i * 6, by + 20 + fall * (20 + i * 8), 1.6, alpha('#C9BCA6', 1 - fall));
    },
  );
}
function written(p: number) {
  let n = 0;
  for (const [start, length, from, to] of WORDS)
    if (p >= from) n = start + Math.round(span(p, from, to) * length);
  return n;
}
/** The card in close-up: written in pencil, stamped, and slipped into the chute. */
function letterClose(ctx: Ctx, p: number, seconds: number) {
  const writing = within(p, WORDS[0][2], WORDS[3][3]);
  const face: Face =
    p < IDEA
      ? { eyes: 'sad', mouth: 'frown', look: 1 }
      : p < CARD_UP
        ? { eyes: 'wide', mouth: 'o' }
        : p < WORDS[0][2]
          ? { eyes: 'down', mouth: 'smile' }
          : p < STAMP - 0.003
            ? { eyes: 'down', mouth: 'tongue' }
            : { eyes: 'happy', mouth: 'grin', blush: true };
  closeUp(ctx, { face, cabin: 0.95, hull: 0.18, outside: 0.3 }, () => {
    const spark = hump(p, IDEA, IDEA + 0.01);
    if (spark > 0) {
      line(ctx, alpha('#FFF1B0', spark), 2, [212, 22, 212, 44]);
      line(ctx, alpha('#FFF1B0', spark), 2, [201, 33, 223, 33]);
      glow(ctx, 212, 33, 16, '#FFF1B0', spark * 0.6);
    }
    if (p < CARD_UP - 0.006) {
      paw(ctx, 138, 150);
      paw(ctx, 182, 150);
      return;
    }
    const cx = PX,
      cy =
        131 +
        (1 - easeOut(span(p, CARD_UP - 0.006, CARD_UP))) * 60 +
        easeIn(span(p, SEND, POST_AT - 0.001)) * 80;
    poly(ctx, PAPER, [cx - 46, cy - 21, cx + 46, cy - 21, cx + 46, cy + 21, cx - 46, cy + 21]);
    line(ctx, '#E2CFA6', 1, [
      cx - 43,
      cy - 18,
      cx + 43,
      cy - 18,
      cx + 43,
      cy + 18,
      cx - 43,
      cy + 18,
      cx - 43,
      cy - 18,
    ]);
    const n = written(p);
    ctx.font = font('mono', 9);
    const w1 = ctx.measureText('THANK YOU').width,
      w2 = ctx.measureText('FOR THE LIGHT').width;
    const l1 = NOTE.slice(0, Math.min(n, 9)),
      l2 = n > 10 ? NOTE.slice(10, n) : '';
    write(ctx, l1, cx - w1 / 2, cy - 3, { size: 9, color: '#34305A', align: 'left' });
    write(ctx, l2, cx - w2 / 2, cy + 11, { size: 9, color: '#34305A', align: 'left' });
    ctx.font = font('mono', 9);
    const tip =
      n <= 9
        ? { x: cx - w1 / 2 + ctx.measureText(l1).width, y: cy - 5 }
        : { x: cx - w2 / 2 + ctx.measureText(l2).width, y: cy + 9 };
    // The stamp drops onto the corner.
    const press = span(p, STAMP - 0.005, STAMP);
    if (press > 0) {
      const sy = cy - 12 - (1 - easeIn(press)) * 50;
      faded(ctx, Math.min(1, press * 3), () => {
        poly(ctx, '#FFFFFF', [cx + 27, sy - 9, cx + 42, sy - 9, cx + 42, sy + 8, cx + 27, sy + 8]);
        poly(ctx, RED, [
          cx + 28.5,
          sy - 7.5,
          cx + 40.5,
          sy - 7.5,
          cx + 40.5,
          sy + 6.5,
          cx + 28.5,
          sy + 6.5,
        ]);
        disc(ctx, cx + 34.5, sy - 1, 3, '#FFD27A');
        glow(ctx, cx + 34.5, sy - 1, 6, '#FFF1B0', 0.6);
      });
    }
    paw(ctx, cx - 46, cy + 6);
    if (p < STAMP + 0.002) {
      const wob = writing ? Math.sin(seconds * 30) * 1.2 : 0;
      const px = (p < WORDS[0][2] ? cx - 20 : tip.x) + wob,
        py = p < WORDS[0][2] ? cy + 14 : tip.y;
      line(ctx, '#F2C23A', 3.4, [px + 2, py - 3, px + 16, py - 22]);
      line(ctx, '#E88A9A', 3.4, [px + 16, py - 22, px + 18, py - 25]);
      line(ctx, '#3A3036', 1.6, [px, py, px + 2, py - 3]);
      paw(ctx, px + 12, py - 14);
    } else paw(ctx, cx + 46, cy + 6);
  });
}

// ——— 6. The deep: the anglerfish appears ———
const DEEP_CAM = [
  [DARK, 170, 92, 1.35],
  [FACE, 180, 94, 1.5],
  [FACE, 206, 86, 2.9],
  [LEAD, 206, 86, 3.1],
] as const;
const DEEP_SUB = [92, 96] as const;
function deepBack(ctx: Ctx, v: Seen) {
  bands(ctx, ['#060D18', '#050B14', '#040810', '#03060C'], 0, 180, v);
  poly(
    ctx,
    '#0B1624',
    [
      0, 180, 0, 132, 40, 124, 70, 136, 120, 120, 170, 134, 220, 116, 262, 128, 300, 112, 320, 118,
      320, 180,
    ],
  );
  box(ctx, v.x0, 164, v.x1 - v.x0, 30, '#101824');
}
function deepScene(ctx: Ctx, p: number, seconds: number, v: Seen) {
  deepBack(ctx, v);
  const come = easeOut(span(p, DARK, 0.476));
  const close = p >= FACE;
  const a: Fish = {
    s: 1.1,
    facing: -1,
    seconds,
    light: 0.55,
    warm: 0,
    open: ease(span(p, EYES_OPEN, EYES_OPEN + 0.007)),
    mood: close ? 0.55 * ease(span(p, 0.488, 0.494)) : 0,
    lit: close ? 0.25 + 0.4 * ease(span(p, FACE, EYES_OPEN)) : 0.14,
    look: [1, 0.1],
    wave: ease(span(p, 0.491, 0.497)),
  };
  const fx = lerp(380, 232, come),
    fy = 98 + Math.sin(seconds * 1.2) * 2;
  const [sx, sy0] = DEEP_SUB;
  const sy = sy0 + Math.sin(seconds * 1.4) * 1.2;
  const o: Sub = {
    s: 0.95,
    flag: 0,
    cabin: 0.5,
    face:
      p < GASP
        ? { eyes: 'worried', mouth: 'flat', look: 1 }
        : { eyes: 'wide', mouth: 'o', look: 1 },
    seconds,
  };
  sub(ctx, sx, sy, o);
  angler(ctx, fx, fy, a);
  const at = lureAt(fx, fy, a);
  deep(ctx, at.x, at.y + 12, close ? 110 : 76, 0.95);
  sub(ctx, sx, sy, o, 'window', 0.25);
  const win = windowOf(sx, sy, 0.95);
  glow(ctx, win.x, win.y, 18, CABIN, 0.3);
  lure(ctx, fx, fy, a);
}

// ——— 7. Following the light ———
const PATH: World = { w: 640, h: 240 };
const PATH_CAM = [
  [LEAD, 152, 74, 1.55],
  [HOME, 514, 172, 1.55],
] as const;
const PILLARS = [
  [70, 0, 30, 110],
  [210, 240, 40, 120],
  [300, 0, 26, 130],
  [440, 240, 36, 90],
  [560, 0, 30, 150],
  [610, 240, 44, 70],
] as const;
function spire(
  ctx: Ctx,
  x: number,
  root: number,
  w: number,
  reach: number,
  color: string,
  seed: number,
) {
  const dir = root > 100 ? -1 : 1;
  const pts = [x - w, root];
  for (let k = 1; k <= 4; k++)
    pts.push(x - w * (1 - k / 5) + (rand(seed + k) - 0.5) * 8, root + dir * reach * (k / 4.4));
  pts.push(x + (rand(seed) - 0.5) * 6, root + dir * reach);
  for (let k = 4; k >= 1; k--)
    pts.push(x + w * (1 - k / 5) + (rand(seed + k * 3) - 0.5) * 8, root + dir * reach * (k / 4.4));
  pts.push(x + w, root);
  poly(ctx, color, pts);
}
function pathScene(ctx: Ctx, p: number, seconds: number, v: Seen) {
  bands(ctx, ['#060D18', '#050B14', '#040810', '#03060C'], 0, 240, v);
  PILLARS.forEach(([x, root, w, reach], i) => spire(ctx, x, root, w, reach, '#132136', i * 13));
  const t = ease(span(p, LEAD, HOME));
  const a: Fish = {
    s: 1,
    facing: 1,
    seconds,
    light: 0.62,
    warm: 0,
    open: 1,
    mood: 0.5,
    lit: 0.55,
    look: [-1, 0.2],
  };
  const fx = lerp(200, 560, t),
    fy = lerp(78, 178, t) + Math.sin(seconds * 1.6) * 2;
  const sx = fx - 96,
    sy = fy - 8 + Math.sin(seconds * 1.3) * 1.5;
  const o: Sub = {
    s: 0.85,
    tilt: 0.12,
    flag: 0,
    cabin: 0.55,
    face: { eyes: 'open', mouth: 'smile', look: 1 },
    seconds,
  };
  sub(ctx, sx, sy, o);
  angler(ctx, fx, fy, a);
  spire(ctx, 350, 240, 34, 150, '#0A1320', 71);
  spire(ctx, 150, 0, 28, 80, '#0A1320', 83);
  const at = lureAt(fx, fy, a);
  deep(ctx, at.x - 30, at.y + 10, 150, 0.94);
  sub(ctx, sx, sy, o, 'window', 0.3);
  const win = windowOf(sx, sy, 0.85);
  glow(ctx, win.x, win.y, 16, CABIN, 0.28);
  lure(ctx, fx, fy, a);
}

// ——— 8. Home: the rock, the rusty mailbox, and everything after ———
const HOME_SUB = [112, 96] as const;
const MAILBOX_X = 250;
const HOME_CAM = [
  [HOME, 200, 102, 1.5],
  [CHECK, 180, 100, 1.75],
  [DROOP, 188, 104, 2.3],
  [LETTER_AT, 190, 106, 2.45],
  [POST_AT, 160, 102, 1.6],
  [READ_AT, 162, 104, 1.65],
  [READ_AT, 182, 100, 2.6],
  [GATHER, 186, 100, 2.25],
  [GATHER, 176, 96, 1.15],
  [RISE, 176, 94, 1.22],
  [RISE, 228, 106, 1.8],
  [1, 230, 105, 1.88],
] as const;
/** Where he holds his letter, on the fish. */
const HELD = [48, -4] as const;
type Home = {
  fish: Fish;
  fx: number;
  fy: number;
  pip: Face;
  flag: number;
  cabin: number;
  light: { x: number; y: number; r: number; amount: number };
  card?: { x: number; y: number; rot: number; s: number };
  jellies: number;
  final: boolean;
};
function homeState(p: number, seconds: number): Home {
  const bob = Math.sin(seconds * 1.2) * 2;
  const base = { s: 1, facing: -1 as const, seconds, warm: 0, open: 1 };
  if (p < CHECK) {
    const t = ease(span(p, HOME, 0.556));
    const fish: Fish = { ...base, light: 0.62, mood: 0.45 + t * 0.2, lit: 0.62, look: [1, 0.15] };
    const fx = lerp(262, 194, t),
      fy = lerp(84, 96, t) + bob;
    const at = lureAt(fx, fy, fish);
    return {
      fish,
      fx,
      fy,
      pip: { eyes: 'open', mouth: 'flat', look: 1 },
      flag: 0,
      cabin: 0.6,
      light: { x: at.x, y: at.y + 20, r: 160, amount: 0.92 },
      jellies: 0,
      final: false,
    };
  }
  if (p < LETTER_AT) {
    const dim = ease(span(p, DIM_FROM, DIM_TO));
    const sag = ease(span(p, DIM_FROM, DIM_TO + 0.006));
    const fish: Fish = {
      ...base,
      light: lerp(0.62, 0.1, dim),
      mood: lerp(0.2, -1, sag),
      lit: lerp(0.62, 0.32, dim),
      look: [lerp(1, 0.2, sag), lerp(0.1, 0.9, sag)],
      droop: sag,
    };
    const fx = 192,
      fy = 98 + sag * 10 + bob * (1 - sag * 0.6);
    const at = lureAt(fx, fy, fish);
    return {
      fish,
      fx,
      fy,
      pip: { eyes: 'sad', mouth: 'frown', look: 1 },
      flag: 0,
      cabin: 0.6,
      light: { x: at.x, y: at.y + 20, r: lerp(160, 100, dim), amount: 0.92 },
      jellies: 0,
      final: false,
    };
  }
  if (p < READ_AT) {
    const notice = ease(span(p, 0.743, ARRIVE));
    const fish: Fish = {
      ...base,
      light: 0.1,
      mood: lerp(-1, -0.2, notice),
      lit: 0.34,
      look: [lerp(0.2, 1, notice), lerp(0.9, 0.2, notice)],
      droop: 1 - notice * 0.4,
    };
    const fx = 196,
      fy = 108 + bob * 0.4;
    const fly = span(p, CHUTE, ARRIVE);
    const chute = chuteOf(HOME_SUB[0], HOME_SUB[1], 0.8);
    const to = onFish(fx, fy, fish, ...HELD);
    return {
      fish,
      fx,
      fy,
      pip: { eyes: 'happy', mouth: 'smile', look: 1 },
      flag: backOut(span(p, FLAG_UP, FLAG_UP + 0.006)) * (1 - ease(span(p, 0.738, 0.744))),
      cabin: 0.95,
      light: { x: 160, y: 104, r: 130, amount: 0.86 },
      card:
        p >= CHUTE
          ? {
              x: lerp(chute.x + 2, to.x, ease(fly)),
              y:
                lerp(chute.y, to.y, ease(fly)) -
                hump(fly, 0, 1) * 10 +
                Math.sin(seconds * 1.7) * (1 - fly),
              rot: Math.sin(seconds * 1.7) * 0.2 * (1 - fly),
              s: lerp(0.35, 1, easeOut(fly)),
            }
          : undefined,
      jellies: 0,
      final: false,
    };
  }
  if (p < FINAL) {
    const bloom = ease(span(p, BLOOM_FROM, BLOOM_TO));
    const lift = ease(span(p, 0.77, 0.8));
    const joy = ease(span(p, WIGGLE, WIGGLE + 0.012));
    const reading = p < 0.797;
    const fish: Fish = {
      ...base,
      light: lerp(0.1, 1, bloom),
      warm: ease(span(p, 0.786, GATHER)),
      mood: lerp(-0.2, 1, ease(span(p, 0.772, 0.8))),
      lit: lerp(0.4, 0.95, bloom),
      happy: !reading,
      look: [0.75 + (p < 0.79 ? Math.sin(seconds * 3) * 0.25 : 0), 0.45],
      droop: 0.6 * (1 - lift),
      wiggle: joy,
      tear: span(p, 0.772, 0.8),
    };
    const fx = 196,
      fy = 108 - lift * 6 + bob * 0.4;
    const at = lureAt(fx, fy, fish);
    const held = onFish(fx, fy, fish, ...HELD);
    return {
      fish,
      fx,
      fy,
      pip: { eyes: 'happy', mouth: 'grin', blush: true },
      flag: 0,
      cabin: 0.95,
      light: {
        x: at.x,
        y: at.y + 20,
        r: lerp(110, 280, bloom),
        amount: lerp(0.9, 0.55, fish.warm),
      },
      card: {
        x: held.x,
        y: held.y + Math.sin(seconds * 2) * 0.6,
        rot: -0.12 + joy * Math.sin(seconds * 11) * 0.1,
        s: 1,
      },
      jellies: span(p, GATHER - 0.01, 0.875),
      final: false,
    };
  }
  // Home, facing his own mailbox, his light on his own name.
  const fish: Fish = {
    ...base,
    facing: 1,
    light: 0.88,
    warm: 1,
    mood: 0.9,
    lit: 0.95,
    look: [0.6, 0.6],
    wiggle: 0.15,
  };
  const fx = 186,
    fy = 98 + bob;
  const at = lureAt(fx, fy, fish);
  return {
    fish,
    fx,
    fy,
    pip: { eyes: 'happy', mouth: 'grin' },
    flag: 0,
    cabin: 0.9,
    light: { x: at.x, y: at.y + 24, r: 240, amount: 0.6 },
    jellies: 0.7,
    final: true,
  };
}
/** A floating card: THANK YOU FOR THE LIGHT, stamped with a little lamp. */
function card(ctx: Ctx, x: number, y: number, rot: number, s: number) {
  glow(ctx, x, y, 18 * s, '#FFF4D6', 0.25);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  poly(ctx, PAPER, [-15, -8, 15, -8, 15, 8, -15, 8]);
  poly(ctx, RED, [9.5, -6.5, 13.5, -6.5, 13.5, -1.5, 9.5, -1.5]);
  disc(ctx, 11.5, -4, 1, '#FFD27A');
  write(ctx, 'THANK YOU', -1.5, -1.2, { size: 3.4, color: '#34305A' });
  write(ctx, 'FOR THE LIGHT', 0, 4.6, { size: 3.4, color: '#34305A' });
  ctx.restore();
}
function homeScene(ctx: Ctx, p: number, seconds: number, v: Seen) {
  const h = homeState(p, seconds);
  bands(ctx, ['#08111E', '#060D18', '#050A13', '#04080F'], 0, 180, v);
  poly(
    ctx,
    '#0C1726',
    [
      0, 160, 0, 118, 36, 110, 70, 124, 110, 112, 150, 126, 200, 108, 240, 120, 280, 104, 320, 112,
      320, 160,
    ],
  );
  // His rock, sea pens and tube worms, and the mailbox nobody ever writes to.
  poly(ctx, '#1C2738', [200, 158, 212, 134, 236, 118, 270, 112, 300, 120, 316, 138, 322, 158]);
  poly(ctx, '#27354A', [214, 132, 236, 119, 270, 113, 296, 121, 272, 120, 240, 124]);
  box(ctx, v.x0, 156, v.x1 - v.x0, 30, '#141C28');
  for (let i = 0; i < 10; i++)
    oval(ctx, (i * 67) % 320, 162 + ((i * 7) % 14), 3 + (i % 3), 1.2, '#1C2636');
  for (const [tx, th] of [
    [36, 12],
    [44, 16],
    [52, 10],
    [292, 14],
    [302, 10],
  ] as const) {
    box(ctx, tx - 1, 157 - th, 3, th, '#BDB6A6');
    disc(ctx, tx + 0.5, 156 - th, 2.4, '#D9504A');
  }
  for (const sx of [150, 166]) {
    line(ctx, '#C9A36A', 1, [sx, 158, sx + Math.sin(seconds + sx) * 1.5, 138]);
    for (let k = 0; k < 4; k++)
      oval(ctx, sx + Math.sin(seconds + sx) * 1.5 * (k / 4), 142 + k * 4, 3, 1, '#E8C388');
  }
  mailbox(ctx, MAILBOX_X, 157, {
    body: '#8C5B3F',
    dark: '#6A3F2A',
    flag: 0,
    plate: h.final ? '#EFE3BF' : '#57564F',
    name: h.final ? 'ANGLERFISH' : undefined,
    rust: true,
  });
  if (h.final) {
    // Pinned beside it, where everyone can see.
    card(ctx, 290, 130, 0.12, 0.8);
    disc(ctx, 290, 124.5, 1.2, RED);
  }
  const sub0: Sub = {
    s: 0.8,
    flag: h.flag,
    cabin: h.cabin,
    face: h.pip,
    seconds,
  };
  const [sx, sy0] = HOME_SUB;
  const sy = sy0 + Math.sin(seconds * 1.4) * 1.2;
  if (!h.final) sub(ctx, sx, sy, sub0);
  angler(ctx, h.fx, h.fy, h.fish);
  deep(ctx, h.light.x, h.light.y, h.light.r, h.light.amount);
  if (h.fish.warm > 0) light(ctx, h.light.x, h.light.y, 180, WARM, 0.1 * h.fish.warm);
  if (!h.final) {
    sub(ctx, sx, sy, sub0, 'window', 0.3 + h.fish.warm * 0.5);
    const win = windowOf(sx, sy, 0.8);
    glow(ctx, win.x, win.y, 16, CABIN, 0.2 + h.cabin * 0.15);
  }
  if (h.card) card(ctx, h.card.x, h.card.y, h.card.rot, h.card.s);
  lure(ctx, h.fx, h.fy, h.fish);
  // The glowing neighbours come to see.
  if (h.jellies > 0) {
    const spots = h.final
      ? [
          [300, 92],
          [158, 142],
          [270, 74],
        ]
      : [
          [120, 50],
          [176, 36],
          [240, 44],
          [292, 70],
          [58, 88],
          [270, 130],
        ];
    spots.forEach(([jx, jy], i) => {
      const come = h.final ? 1 : easeOut(span(h.jellies, i * 0.1, i * 0.1 + 0.5));
      if (come <= 0) return;
      const from = i % 2 ? 360 : -40;
      jelly(
        ctx,
        lerp(from, jx, come) + Math.sin(seconds * 0.7 + i) * 4,
        lerp(jy + 60, jy, come) + Math.sin(seconds * 1.1 + i * 2) * 3,
        0.9 + (i % 3) * 0.15,
        JELLIES[i % JELLIES.length],
        seconds,
        i,
      );
    });
    if (!h.final)
      for (let i = 0; i < 3; i++) {
        const t = span(h.jellies, 0.2 + i * 0.15, 1);
        if (t <= 0) continue;
        const ang = seconds * 0.8 + i * 2.1;
        lanternfish(
          ctx,
          190 + Math.cos(ang) * 60,
          100 + Math.sin(ang) * 30,
          Math.sin(ang) > 0 ? -1 : 1,
          seconds,
          i,
        );
      }
  }
}

// ——— 9. The ride home ———
const RISE_WORLD: World = { w: 320, h: 480 };
const RISE_CAM = [
  [RISE, 160, 400, 1.35],
  [FINAL, 160, 150, 1.35],
] as const;
function riseScene(ctx: Ctx, p: number, seconds: number, v: Seen) {
  bands(
    ctx,
    [
      '#48BFC6',
      '#35A2BA',
      '#2A84AB',
      '#216799',
      '#1A4E84',
      '#143A6C',
      '#0E2850',
      '#091A36',
      '#060F22',
    ],
    0,
    480,
    v,
  );
  rays(ctx, seconds, 0, 280, [40, 100, 170, 230, 290], 1.2);
  glow(ctx, 170, -30, 240, '#E8FFF6', 0.3);
  const t = ease(span(p, RISE, FINAL));
  const sy = lerp(430, 170, t);
  const a: Fish = {
    s: 0.8,
    facing: -1,
    seconds,
    light: 0.9,
    warm: 1,
    open: 1,
    mood: 0.9,
    lit: 0.85,
    happy: true,
    wave: 1,
  };
  angler(ctx, 212, 462, a);
  lure(ctx, 212, 462, a);
  const escort = [
    [-42, -22],
    [46, -34],
    [-58, 22],
    [54, 26],
    [4, -56],
    [-18, 52],
  ];
  escort.forEach(([dx, dy], i) => {
    const lag = (1 - t) * (10 + i * 6);
    jelly(
      ctx,
      152 + dx + Math.sin(seconds * 0.8 + i) * 4,
      sy + dy + lag + Math.sin(seconds * 1.3 + i) * 3,
      0.9,
      JELLIES[i],
      seconds,
      i,
    );
  });
  for (let i = 0; i < 3; i++)
    lanternfish(
      ctx,
      150 + Math.sin(seconds * 1.4 + i * 2) * 70,
      sy + 10 + i * 14,
      Math.cos(seconds * 1.4 + i * 2) > 0 ? 1 : -1,
      seconds,
      i,
    );
  bubbleStream(ctx, seconds, 120, sy + 20, 120, 8, 91);
  sub(ctx, 150 + Math.sin(seconds * 0.9) * 4, sy, {
    s: 1,
    tilt: -0.26,
    flag: 0,
    cabin: 0.9,
    face: { eyes: 'happy', mouth: 'grin', blush: true },
    seconds,
  });
}

/** Paints one shot through a camera; returns what it saw. */
function film(
  ctx: Ctx,
  world: World,
  keys: readonly (readonly [number, number, number, number])[],
  p: number,
  paint: (v: Seen) => void,
) {
  const view = track(p, keys);
  const v = seen(view, world);
  camera(ctx, view, () => paint(v), world);
  return v;
}

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const mailForTheAnglerfishScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: 67, voice: 'bell', intro: [0, 4, 7, 12], outro: [0, 7, 12, 16] },
    (s) => {
      // The march tempo comes from the story length, so every beat lands on BEAT.
      const bpm = 60 / (BEAT * s.story);
      // Morning on the surface: waves and gulls, a bag of letters, a salute, a splash.
      s.fx('wave', 0, 3.2, 0.14, -0.3);
      s.fx('wave', 0.035, 2.4, 0.1, 0.3);
      s.fx('gull', 0.006, 0.8, 0.07, 0.55);
      s.fx('gull', 0.034, 0.7, 0.05, 0.65);
      s.fx('rustle', BAG, 0.45, 0.1, 0.1);
      s.fx('rustle', FAN, 0.35, 0.12, 0.15);
      s.fx('knock', SHUT, 0.2, 0.16);
      s.fx('splash', DIVE, 1.3, 0.24);
      s.fx('hum', DIVE + 0.004, 1.6, 0.08);
      s.section({
        from: 0,
        to: DIVE,
        bpm,
        root: 60,
        chords: [0, 5],
        melody: [7, null, 12, null, 11, null, 7, null],
        voice: 'keys',
        gain: 0.5,
        level: 0.55,
        groove: 'tick',
        fade: 0.4,
      });
      // The postman march; a step higher for the octopus, whose letters rest the tune.
      const THEME = [
        7,
        12,
        7,
        4,
        7,
        12,
        16,
        null,
        17,
        16,
        14,
        12,
        9,
        12,
        9,
        5,
        7,
        11,
        14,
        11,
        7,
        11,
        14,
        17,
        16,
        null,
        12,
        null,
        7,
        4,
        0,
        null,
      ];
      s.section({
        from: DIVE,
        to: GARDEN,
        bpm,
        root: 60,
        chords: [0, 5, 7, 0],
        melody: THEME,
        step: 0.5,
        voice: 'pluck',
        gain: 0.75,
        groove: 'march',
        fade: 0.3,
      });
      s.section({
        from: GARDEN,
        to: WHALE_AT,
        bpm,
        root: 62,
        chords: [0, 5, 7, 0],
        melody: [...Array(10).fill(null), 12, 16, 19, 16, 21, 19, 16, null],
        step: 0.5,
        voice: 'pluck',
        gain: 0.7,
        groove: 'march',
        fade: 0.3,
      });
      // The crab: a parcel, a lid, a hat, and a clicking dance.
      s.fx('hum', REEF, 0.9, 0.08, -0.4);
      s.fx('pop', PARCEL, 0.15, 0.16, -0.2);
      s.fx('bubble', PARCEL + 0.003, 0.25, 0.08, -0.1);
      s.fx('knock', CATCH, 0.15, 0.1, 0.3);
      s.fx('pop', OPEN, 0.15, 0.14, 0.3);
      s.fx('sparkle', OPEN + 0.002, 0.7, 0.06, 0.3);
      s.fx('boing', HAT_ON, 0.4, 0.07, 0.3);
      for (const at of CLICKS) s.fx('click', at, 0.08, 0.24, 0.35);
      // The octopus: eight letters, eight notes up the scale, and a giggle.
      s.fx('hum', GARDEN, 0.8, 0.08, -0.4);
      LETTERS.forEach((at, i) => {
        s.fx('pop', at, 0.12, 0.1, -0.4);
        s.note(
          at + FLIGHT,
          74 + [0, 2, 4, 5, 7, 9, 11, 12][i],
          0.5,
          'pluck',
          0.11,
          -0.2 + i * 0.08,
        );
      });
      for (const g of GIGGLES) s.fx('giggle', g, 0.7, 0.14, 0.25);
      // The whale: wide and slow; the postcard; the song.
      s.section({
        from: WHALE_AT,
        to: TRENCH_AT,
        bpm: 66,
        root: 55,
        chords: [0, 5, 0, 7],
        melody: [12, null, 16, null, 19, null, 16, 14, 12, null, null, null],
        voice: 'bell',
        gain: 0.5,
        level: 0.7,
        fade: 0.8,
      });
      s.fx('whale', WHALE_AT + 0.004, 1.8, 0.1, -0.2);
      s.fx('sweep', 0.265, 1.4, 0.05);
      s.fx('pop', POSTCARD, 0.12, 0.12, -0.3);
      s.fx('whale', SING, 2.8, 0.34, 0.1);
      for (let i = 0; i < 6; i++)
        s.fx('bubble', SING + 0.005 + i * 0.005, 0.25, 0.06, 0.2 + i * 0.06);
      // The trench: eerie, sparse minor pads; the lamp gives out with two soft beeps.
      s.section({
        from: TRENCH_AT,
        to: FACE,
        bpm: 54,
        root: 57,
        minor: true,
        chords: [0, -4, 0, -2],
        melody: [null, null, 12, null, null, 11, null, null, 8, null, 7, null],
        voice: 'keys',
        gain: 0.35,
        level: 0.5,
        fade: 1,
      });
      s.fx('rumble', TRENCH_AT, 3.2, 0.12);
      s.fx('hum', TRENCH_AT, 2.2, 0.07);
      s.fx('beep', LAMP_DIM, 0.12, 0.06, 0.2);
      s.fx('beep', LAMP_OUT - 0.004, 0.12, 0.045, 0.2);
      s.note(LAMP_OUT, 45, 2.5, 'pad', 0.05);
      // The anglerfish: a light in the dark, a gasp, and then the kindest eyes.
      s.fx('sweep', DARK + 0.002, 1.6, 0.05, 0.4);
      s.fx('gasp', GASP, 0.6, 0.14, -0.3);
      s.chord(EYES_OPEN, [60, 64, 67, 72], 2.5, 'pad', 0.035);
      s.fx('chime', EYES_OPEN + 0.004, 1.2, 0.08, 0.3);
      s.section({
        from: FACE,
        to: DROOP,
        bpm: 72,
        root: 60,
        chords: [0, 5, 7, 5],
        melody: [7, null, 9, 7, 4, null, 2, null, 4, 7, 9, 12, 11, null, 7, null],
        voice: 'keys',
        gain: 0.5,
        level: 0.6,
        fade: 0.8,
      });
      s.fx('hum', LEAD, 2.2, 0.06, -0.3);
      s.fx('rustle', EMPTY + 0.01, 0.5, 0.12);
      // Nothing for him: the tune sinks with the lure.
      s.section({
        from: DROOP,
        to: LETTER_AT + 0.005,
        bpm: 60,
        root: 57,
        minor: true,
        chords: [0, -4],
        melody: [7, 5, 3, 2],
        voice: 'keys',
        gain: 0.45,
        level: 0.5,
        fade: 0.6,
      });
      // The letter: tender keys under pencil, stamp, and chute.
      s.section({
        from: LETTER_AT,
        to: READ_AT + 0.01,
        bpm: 76,
        root: 65,
        chords: [0, 5, 0, 7],
        melody: [12, null, 9, 10, 12, null, 7, null, 9, null, 5, 7, 9, null, null, null],
        voice: 'keys',
        gain: 0.45,
        level: 0.6,
        fade: 0.8,
      });
      s.fx('sparkle', IDEA, 0.6, 0.06);
      s.fx('rustle', CARD_UP - 0.004, 0.4, 0.08);
      for (const [, , from, to] of WORDS) s.fx('scribble', from, (to - from) * s.story, 0.12, 0.15);
      s.fx('thud', STAMP, 0.3, 0.16);
      s.fx('swish', SEND, 0.4, 0.08);
      s.fx('squeak', FLAG_UP, 0.25, 0.06, -0.3);
      s.fx('pop', CHUTE, 0.15, 0.14, -0.3);
      s.fx('bubble', CHUTE + 0.004, 0.25, 0.07, -0.2);
      // The bloom: a slow warm swell, sparkles, and joy.
      s.chord(BLOOM_FROM, [65, 69, 72, 77], 3.5, 'pad', 0.05);
      s.fx('sparkle', BLOOM_FROM + 0.002, 1.8, 0.12, 0.2);
      s.fx('chime', BLOOM_TO, 1.4, 0.1, -0.2);
      s.section({
        from: READ_AT,
        to: RISE,
        bpm: 84,
        root: 65,
        chords: [0, 5, 7, 0],
        melody: [
          null,
          null,
          null,
          null,
          12,
          14,
          16,
          19,
          17,
          16,
          14,
          12,
          16,
          null,
          19,
          null,
          24,
          null,
          null,
          null,
        ],
        voice: 'bell',
        gain: 0.6,
        groove: 'pulse',
        level: 0.8,
        fade: 1.2,
      });
      s.fx('chime', GATHER + 0.01, 1.2, 0.08, 0.4);
      s.fx('sparkle', GATHER + 0.02, 1.2, 0.06, -0.4);
      // Home: the march theme again, broad and warm.
      s.section({
        from: RISE - 0.004,
        to: 1,
        bpm: 92,
        root: 65,
        chords: [0, 5, 7, 0],
        melody: THEME,
        step: 0.5,
        voice: 'lead',
        gain: 0.6,
        groove: 'pulse',
        level: 0.85,
        fade: 1,
      });
      s.fx('hum', RISE, 3, 0.06);
      s.fx('sweep', RISE + 0.004, 2.5, 0.05);
      // Bubbles, all the way down.
      for (let q = DIVE + 0.02; q < 1; q += 0.028)
        s.fx(
          'bubble',
          q + rand(q * 100) * 0.01,
          0.22,
          0.03 + rand(q * 50) * 0.03,
          rand(q * 70) * 1.4 - 0.7,
        );
    },
  );

export const mailForTheAnglerfish: FilmModule = {
  draw(ctx, p, seconds) {
    let dark = 0;
    if (p < REEF) {
      film(ctx, SURFACE, SURFACE_CAM, p, (v) => surfaceScene(ctx, p, seconds, v));
      vignette(ctx, 0.3);
    } else if (p < GARDEN) {
      film(ctx, SET, REEF_CAM, p, (v) => reefScene(ctx, p, seconds, v));
      vignette(ctx, 0.35);
    } else if (p < WHALE_AT) {
      film(ctx, SET, GARDEN_CAM, p, (v) => gardenScene(ctx, p, seconds, v));
      vignette(ctx, 0.4);
    } else if (p < TRENCH_AT) {
      film(ctx, OPEN_SEA, WHALE_CAM, p, (v) => whaleScene(ctx, p, seconds, v));
      vignette(ctx, 0.45);
    } else if (p < ALONE) {
      const v = film(ctx, TRENCH, TRENCH_CAM, p, (sv) => trenchScene(ctx, p, seconds, sv));
      trenchFore(ctx, v);
      dark = 0.8;
      marineSnow(ctx, seconds, 0.8, v.y * v.zoom * 0.6);
      vignette(ctx, 0.6);
    } else if (p < DARK) {
      worriedClose(ctx, p, seconds);
      vignette(ctx, 0.6);
    } else if (p < LEAD) {
      film(ctx, SET, DEEP_CAM, p, (v) => deepScene(ctx, p, seconds, v));
      dark = 1;
    } else if (p < HOME) {
      film(ctx, PATH, PATH_CAM, p, (v) => pathScene(ctx, p, seconds, v));
      dark = 1;
    } else if (p < CHECK || within(p, DROOP, LETTER_AT) || within(p, POST_AT, RISE)) {
      film(ctx, SET, HOME_CAM, p, (v) => homeScene(ctx, p, seconds, v));
      dark = 1;
    } else if (p < DROOP) {
      bagClose(ctx, p, seconds);
      vignette(ctx, 0.55);
    } else if (p < POST_AT) {
      letterClose(ctx, p, seconds);
      vignette(ctx, 0.5);
    } else {
      film(ctx, RISE_WORLD, RISE_CAM, p, (v) => riseScene(ctx, p, seconds, v));
      vignette(ctx, 0.35);
      // Dissolve home for the last look.
      const back = ease(span(p, FINAL - 0.012, FINAL + 0.004));
      faded(ctx, back, () => {
        film(ctx, SET, HOME_CAM, p, (v) => homeScene(ctx, Math.max(p, FINAL), seconds, v));
        marineSnow(ctx, seconds, 0.5);
        vignette(ctx, 0.5);
      });
    }
    if (dark > 0) {
      if (p >= DARK) marineSnow(ctx, seconds, dark);
      vignette(ctx, 0.55);
    }
    // Dips to black: into the deep, and up out of it.
    veil(
      ctx,
      '#02050A',
      Math.max(
        hump(p, TRENCH_AT - 0.007, TRENCH_AT + 0.007),
        hump(p, RISE - 0.006, RISE + 0.006) * 0.6,
      ),
    );
    captions(ctx, p, [
      [0.008, 0.075, 'The deep-sea post. Every single day.'],
      [0.346, 0.405, 'Deeper than ever. Darker than ever.'],
      [0.586, 0.632, 'Nothing for him. There never is.'],
      [0.836, 0.886, 'The first letter he ever got.'],
    ]);
  },
  score: mailForTheAnglerfishScore,
  look: {
    shade: '#07131F',
    ink: '#EAF6F2',
    accent: '#7FE0D0',
    dedication: 'everyone deserves a letter',
  },
};
