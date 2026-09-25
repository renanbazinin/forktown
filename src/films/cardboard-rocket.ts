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
  presence,
  rand,
  shade,
  shot,
  sky,
  span,
  starfield,
  TAU,
  track,
  veil,
  vignette,
  W,
  write,
  type Ctx,
  type Figure,
  type View,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * CARDBOARD ROCKET
 * Nova is flying her cardboard-box rocket to the Moon, but every call to dinner drags her
 * imagination back to her bedroom, until she runs out of "fuel" just short of the Moon.
 * Then her dad climbs into the box too, and two imaginations are enough to get there.
 *
 * Two worlds share one frame. During the interruptions the rocket holds still on screen
 * while space and the bedroom cross-dissolve around it: the bedroom's camera is solved from
 * the rocket's screen position (`matchRoom`), so the girl never moves while the world
 * changes. When the room falls away at liftoff, the wallpaper's printed stars peel off and
 * stay behind in the sky.
 */

// Story beats, shared by the pictures and the score.
const T = {
  press: 0.008,
  tape: 0.021,
  dial: 0.036,
  colander: 0.064,
  hop: 0.068,
  counts: [0.083, 0.092, 0.101],
  ignite: 0.112,
  bonk: 0.257,
  comet: 0.302,
  call1: 0.34,
  five: 0.362,
  call2: 0.444,
  sputter: 0.488,
  empty: 0.503,
  fade: 0.54,
  home: 0.568,
  door: 0.58,
  ladle: 0.654,
  pan: 0.666,
  climb: 0.672,
  squeeze: 0.69,
  beam: 0.708,
  refill: 0.728,
  counts2: [0.749, 0.757, 0.765],
  ignite2: 0.775,
  touchdown: 0.875,
  flag: 0.911,
  cloth: 0.925,
  bowls: [0.938, 0.943],
} as const;
const COUGHS = [0.4895, 0.4935, 0.4975] as const;
const CUTS = [
  0, 0.032, 0.058, 0.11, 0.14, 0.2, 0.245, 0.28, 0.34, 0.4, 0.5, 0.52, 0.605, 0.625, 0.64, 0.725,
  0.745, 0.775, 0.8, 0.845, 0.9, 0.925, 0.952,
] as const;

// ——— Palette ———
const SHADE = '#140F24';
const INK = '#2A2530';
const PAPER = '#FFF6E4';
const ACCENT = '#FF9A5C';
const CARD = '#C8935A',
  CARD_DARK = '#A5733F',
  CARD_LIGHT = '#E4B87C',
  CARD_INSIDE = '#6B4526',
  TAPE = '#EFE2B8',
  MARKER = '#2D3F8C';
const SKIN_N = '#8A5A3E',
  SKIN_D = '#6E4630',
  HAIR = '#2A1C19',
  SHIRT = '#F2C14E',
  DENIM = '#4E70AA',
  DENIM_DARK = '#3C5A8E',
  SNEAKER = '#E0584A';
const CARDIGAN = '#4F8A78',
  TROUSERS = '#5E4B45',
  APRON = '#EFE6D0',
  FRAMES = '#E0B45E';
const STEEL = '#BCC6CF',
  STEEL_DARK = '#8894A0',
  PAN = '#9AA5AE',
  PAN_DARK = '#6F7A84',
  HANDLE = '#3A3238';
const WALL = '#4A3F73',
  PRINT = alpha('#EBC46E', 0.7),
  TRIM = '#E6D6B8',
  FLOOR = '#7A4E36',
  FLOOR_LINE = '#6A4230',
  RUG = '#B9544A',
  RUG_IN = '#D9774F',
  LAMPLIGHT = '#FFC47A',
  NIGHT_VEIL = '#141A3A';
const SPACE_BANDS = ['#140F24', '#1C1433', '#27193F', '#321E4E'] as const;
const DUSK_BANDS = ['#2A2152', '#553A76', '#A55C7C', '#E08C6C'] as const;
const WINDOW_DUSK = ['#3A2F66', '#8A4F7A', '#E0886C'] as const;
const WINDOW_NIGHT = ['#0E1030', '#171B42', '#232752'] as const;

// ——— Little helpers ———
const wrap = (v: number, m: number) => ((v % m) + m) % m;
/** Linear keyframes [p, value], holding at both ends. */
function keyed(p: number, keys: readonly (readonly [number, number])[]) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++)
    if (p < keys[i][0]) {
      const [a, av] = keys[i - 1],
        [b, bv] = keys[i];
      return av + ((bv - av) * (p - a)) / (b - a);
    }
  return keys[keys.length - 1][1];
}
// How far the rocket has flown, for star parallax: steady cruising, a drifting stall, a warp.
const TRAVEL = [
  [0.13, 0],
  [0.2, 500],
  [0.488, 4300],
  [0.52, 4420],
  [0.56, 4440],
  [0.775, 4440],
  [0.8, 5000],
  [0.845, 9800],
  [0.9, 9900],
] as const;
/** The paper-plate fuel dial: full at the start, drained by each call to dinner, refilled by Dad. */
function fuelAt(p: number) {
  if (p >= T.refill) return backOut(span(p, T.refill, T.refill + 0.014));
  return clamp(
    1 -
      0.38 * ease(span(p, 0.35, 0.372)) -
      0.32 * ease(span(p, 0.452, 0.478)) -
      0.3 * easeIn(span(p, T.empty, T.empty + 0.01)),
  );
}
/** Needle angle, counter-clockwise from pointing right: E is on the left, F on the right. */
const needleAngle = (fuel: number) => Math.PI * (0.9 - 0.8 * fuel);
/** How many fingers are up during a countdown. */
const fingersUp = (p: number, counts: readonly number[]) => {
  const passed = counts.filter((c) => p >= c).length;
  return passed ? 4 - passed : 0;
};

// ——— People ———
/** Runs `paint` in a figure's upper-body frame, matching the kit's `person` transform. */
function frame(
  ctx: Ctx,
  x: number,
  y: number,
  f: Figure,
  paint: (top: number, torso: number) => void,
) {
  const adult = f.build === 'adult';
  const torso = adult ? 13 : 9;
  const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((f.facing ?? 1) * (f.size ?? 1), f.size ?? 1);
  if (f.sitting) ctx.translate(0, -1);
  ctx.translate(0, f.sitting ? -3 : -(adult ? 11 : 6) - bob);
  ctx.rotate(f.lean ?? 0);
  paint(-torso - 11, torso);
  ctx.restore();
}
/** Repaints the front arm so it sits over bibs and aprons drawn on the torso. */
function frontArm(ctx: Ctx, f: Figure, torso: number) {
  const adult = f.build === 'adult';
  const angle = f.arms ? f.arms[1] : f.step === undefined ? 0 : Math.sin(f.step) * 0.6;
  ctx.save();
  ctx.translate(1, -torso + 2);
  ctx.rotate(-angle);
  box(ctx, -1, 0, 2, adult ? 10 : 7, f.coat);
  box(ctx, -1, adult ? 9 : 6, 2, 2, f.skin);
  ctx.restore();
}
function fingers(ctx: Ctx, hand: { x: number; y: number }, count: number, size: number) {
  for (let i = 0; i < count; i++)
    box(ctx, hand.x - 2 * size + i * 2 * size, hand.y - 4 * size, size, 3 * size, SKIN_N);
}
/** The colander helmet; `tilt` knocks it askew, `lift` holds it above the head. */
function colander(ctx: Ctx, top: number, tilt: number, lift = 0) {
  ctx.save();
  ctx.translate(0.5, top + 2 - lift);
  ctx.rotate(tilt);
  ctx.fillStyle = STEEL;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7.5, 7, 0, Math.PI, TAU);
  ctx.fill();
  box(ctx, -4, -6, 3, 1, '#E8EEF2');
  for (const [hx, hy] of [
    [-4, -3],
    [-1, -4],
    [2, -4],
    [5, -2],
    [0, -1],
    [-6, -1],
    [3, -1],
  ])
    box(ctx, hx, hy, 1, 1, '#5E6873');
  box(ctx, -8, -1, 17, 2, STEEL_DARK);
  box(ctx, -11, -2, 3, 2, STEEL_DARK);
  box(ctx, 9, -2, 3, 2, STEEL_DARK);
  ctx.restore();
}
type Kid = Partial<Figure> & {
  colander?: number;
  lift?: number;
  fingers?: number;
  tear?: number;
  /** Points a finger from the front hand. */
  point?: boolean;
};
/** Nova: two hair puffs, a yellow tee, dungarees, and (usually) a colander. */
function nova(ctx: Ctx, x: number, y: number, o: Kid = {}) {
  const f: Figure = {
    skin: SKIN_N,
    hair: HAIR,
    coat: SHIRT,
    legs: DENIM,
    shoes: SNEAKER,
    hairStyle: 'short',
    ...o,
  };
  frame(ctx, x, y, f, (top) => {
    disc(ctx, -6.5, top + 2, 3.5, HAIR);
    disc(ctx, 7.5, top + 2, 3.5, HAIR);
  });
  person(ctx, x, y, f);
  frame(ctx, x, y, f, (top, torso) => {
    box(ctx, -3, -torso + 3, 7, torso - 3, DENIM);
    box(ctx, -3, -torso, 1, 3, DENIM);
    box(ctx, 3, -torso, 1, 3, DENIM);
    box(ctx, -1, -torso + 5, 3, 2, DENIM_DARK);
    frontArm(ctx, f, torso);
    if (o.tear) box(ctx, 4, top + 7, 1, 1 + Math.round(o.tear * 2), '#A8DDF5');
    if (o.colander !== undefined) colander(ctx, top, o.colander, o.lift ?? 0);
  });
  if (o.fingers) fingers(ctx, handOf(x, y, f), o.fingers, f.size ?? 1);
  if (o.point) {
    const h = handOf(x, y, f),
      size = f.size ?? 1;
    box(ctx, h.x + (f.facing === -1 ? -4 : 1) * size, h.y - size, 3 * size, size, SKIN_N);
  }
}
/** Round gold-rimmed glasses around the kit's eyes (at x 1 and 4). */
function glasses(ctx: Ctx, top: number) {
  const y = top + 4;
  box(ctx, 0, y, 3, 1, FRAMES);
  box(ctx, 3, y, 3, 1, FRAMES);
  box(ctx, 0, y + 3, 2, 1, FRAMES);
  box(ctx, 4, y + 3, 2, 1, FRAMES);
  box(ctx, 0, y + 1, 1, 2, FRAMES);
  box(ctx, 5, y + 1, 1, 2, FRAMES);
  box(ctx, -4, y + 1, 4, 1, FRAMES);
  box(ctx, 2, y + 1, 1, 1, alpha('#FFFFFF', 0.5));
}
/** An upside-down saucepan with its rim at `top` and the handle sticking out in front. */
function saucepan(ctx: Ctx, top: number) {
  box(ctx, -6, top - 5, 13, 5, PAN);
  box(ctx, -6, top - 5, 13, 1, '#C4CDD4');
  box(ctx, -7, top, 15, 2, PAN_DARK);
  box(ctx, 8, top, 9, 2, HANDLE);
}
function potAt(ctx: Ctx, x: number, y: number, size: number, turn: number, facing = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * size, size);
  ctx.rotate(turn);
  saucepan(ctx, 0);
  ctx.restore();
}
/** Dad's knees, folded up by his ears once he is squeezed into the box. */
function knees(ctx: Ctx, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  line(ctx, mix(TROUSERS, '#0B0E14', 0.3), 4, [3, -5, 10, -20, 14, -6]);
  line(ctx, TROUSERS, 4, [5, -4, 12, -21, 16, -5]);
  box(ctx, 11, -24, 3, 1, mix(TROUSERS, '#FFFFFF', 0.25));
  ctx.restore();
}
type Pa = Partial<Figure> & {
  pan?: boolean;
  knees?: boolean;
  ladle?: boolean;
  potInHand?: boolean;
  fingers?: number;
};
/** Dad: glasses, a green cardigan, a floury apron, and a ladle he never gets to wave. */
function dad(ctx: Ctx, x: number, y: number, o: Pa = {}) {
  const f: Figure = {
    skin: SKIN_D,
    hair: HAIR,
    coat: CARDIGAN,
    legs: TROUSERS,
    shoes: '#2B2630',
    build: 'adult',
    hairStyle: 'short',
    blush: false,
    ...o,
  };
  const size = f.size ?? 1,
    facing = f.facing ?? 1;
  person(ctx, x, y, f);
  frame(ctx, x, y, f, (top, torso) => {
    box(ctx, -3, -torso + 3, 7, torso - 3, APRON);
    box(ctx, -2, -torso, 1, 3, APRON);
    box(ctx, 3, -torso, 1, 3, APRON);
    if (!f.sitting) box(ctx, -3, 0, 7, 6, APRON);
    for (const [fx, fy] of [
      [0, -9],
      [2, -6],
      [-1, -4],
      [3, 2],
      [-3, -11],
    ])
      box(ctx, fx, fy, 1, 1, '#FFFFFF');
    glasses(ctx, top);
    if (o.pan) saucepan(ctx, top);
  });
  if (o.knees) knees(ctx, x, y, size * facing);
  frame(ctx, x, y, f, (_, torso) => frontArm(ctx, f, torso));
  if (o.ladle) {
    const h = handOf(x, y, f);
    const a = f.arms ? f.arms[1] : 0;
    const dx = Math.sin(a) * facing,
      dy = Math.cos(a);
    line(ctx, '#C7CDD3', 1.2 * size, [
      h.x - dx * 2 * size,
      h.y - dy * 2 * size,
      h.x + dx * 9 * size,
      h.y + dy * 9 * size,
    ]);
    oval(ctx, h.x + dx * 11 * size, h.y + dy * 11 * size, 3 * size, 2.2 * size, '#AEB6BE');
  }
  if (o.potInHand) {
    // Carried by the handle, the pot swinging behind him.
    const h = handOf(x, y, f, 'back');
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.scale(facing * size, size);
    box(ctx, -8, -1, 9, 2, HANDLE);
    box(ctx, -22, 0, 13, 6, PAN);
    box(ctx, -22, 4, 13, 2, PAN_DARK);
    box(ctx, -23, -2, 15, 2, PAN_DARK);
    box(ctx, -20, 1, 3, 1, '#C4CDD4');
    ctx.restore();
  }
  if (o.fingers) fingers(ctx, handOf(x, y, f), o.fingers, size);
}

// ——— The rocket ———
type Ride = {
  x: number;
  y: number;
  k: number;
  tilt?: number;
  shake?: number;
  fuel?: number;
  /** How much of the needle has been drawn on the plate. */
  needle?: number;
  /** 0..1 the lower fin is pressed on, 1..2 it is taped. */
  fin?: number;
  /** Length of the real flames. */
  flame?: number;
  /** Opacity of the crayon flames drawn on the side, and how hard they wiggle. */
  crayon?: number;
  spark?: number;
  smoke?: number;
  bulge?: number;
  squash?: number;
};
const FLAME = [
  ['#E8453C', 1, 4.6],
  ['#FF8A3D', 0.8, 3.6],
  ['#FFD36A', 0.55, 2.5],
  ['#FFF6DA', 0.28, 1.4],
] as const;
function exhaust(ctx: Ctx, back: number, power: number, s: number) {
  if (power <= 0.02) return;
  glow(ctx, back - 8 - power * 10, -10, 20 + power * 24, ACCENT, 0.5);
  const fat = 0.8 + 0.2 * Math.min(power, 2.4);
  [-15, -10, -5].forEach((y, i) => {
    const flick = 1 + 0.14 * Math.sin(s * 19 + i * 2.3) + 0.07 * Math.sin(s * 41 + i);
    const len = 18 * power * (i === 1 ? 1 : 0.78) * flick;
    for (const [color, depth, h] of FLAME) {
      const wob = Math.sin(s * 15 + i * 2 + depth * 4) * Math.min(power, 1.5);
      const w = h * fat;
      poly(ctx, color, [
        back + 1,
        y - w,
        back - len * depth * 0.5,
        y - w * 0.8 + wob * 0.4,
        back - len * depth,
        y + wob,
        back - len * depth * 0.5,
        y + w * 0.8 + wob * 0.4,
        back + 1,
        y + w,
      ]);
    }
  });
}
/** Marker-and-crayon flames on the back of the box: the fuel of the imagination. */
function crayonFlames(ctx: Ctx, back: number, amount: number, spark: number, s: number) {
  if (amount <= 0) return;
  faded(ctx, amount, () => {
    const base = back + 12;
    for (const [y, len, color] of [
      [-14.5, 8, '#E8453C'],
      [-10, 10.5, '#FF8A3D'],
      [-5.5, 7.5, '#E8453C'],
    ] as const) {
      const w = spark * Math.sin(s * 26 + y) * 1.3;
      line(ctx, color, 1, [
        base,
        y - 2.5,
        base - len * 0.45,
        y - 2 + w,
        base - len * 0.35,
        y - 0.8,
        base - len,
        y + w,
        base - len * 0.35,
        y + 0.8,
        base - len * 0.45,
        y + 2 + w,
        base,
        y + 2.5,
      ]);
      line(ctx, '#F2C14E', 1, [base, y - 1, base - len * 0.55, y + w * 0.5, base, y + 1]);
    }
    if (spark > 0) glow(ctx, back + 6, -10, 8 + spark * 12, '#FFB070', 0.6 * spark);
  });
}
function plate(ctx: Ctx, x: number, y: number, fuel: number, drawn: number) {
  disc(ctx, x, y, 5.5, '#E2D8C2');
  disc(ctx, x, y, 4.5, '#F7F1E4');
  box(ctx, x - 4, y, 2, 1, '#D8453C');
  box(ctx, x + 2, y, 2, 1, '#4FA35A');
  if (drawn > 0) {
    const a = needleAngle(fuel);
    line(ctx, MARKER, 0.9, [x, y, x + Math.cos(a) * 3.8 * drawn, y - Math.sin(a) * 3.8 * drawn]);
  }
  disc(ctx, x, y, 0.8, MARKER);
}
function topFin(ctx: Ctx, back: number) {
  poly(ctx, CARD_DARK, [back + 8, -21, back - 4, -33, back - 9, -33, back, -21]);
  box(ctx, back - 3, -33, 5, 1, CARD);
  box(ctx, back + 1, -23, 3, 4, TAPE);
  box(ctx, back + 6, -23, 3, 4, TAPE);
}
/** The lower fin: 0..1 it is pressed into place (from Nova's hands), 1..2 it is taped. */
function lowerFin(ctx: Ctx, back: number, fin: number) {
  const e = backOut(clamp(fin)),
    tape = clamp(fin - 1);
  ctx.save();
  ctx.translate(back - (1 - e) * 4, -5 - (1 - e) * 6);
  ctx.rotate(-(1 - e) * 0.5);
  poly(ctx, CARD_DARK, [0, -6, -11, 5, 0, 5]);
  ctx.restore();
  faded(ctx, tape, () => {
    box(ctx, back - 1, -9, 3, 4, TAPE);
    box(ctx, back - 1, -3, 3, 3, TAPE);
  });
}
function partyHat(ctx: Ctx, front: number) {
  poly(ctx, '#5FB3D9', [front, -19, front + 15, -10, front, -1]);
  const h = (d: number) => 9 * (1 - d / 15);
  for (const d of [3.5, 8.5])
    poly(ctx, '#F7E27A', [
      front + d,
      -10 - h(d),
      front + d + 2,
      -10 - h(d + 2),
      front + d + 2,
      -10 + h(d + 2),
      front + d,
      -10 + h(d),
    ]);
  disc(ctx, front + 15.5, -10, 2.2, '#E65C7A');
  box(ctx, front - 2, -13, 3, 6, TAPE);
}
function smoke(ctx: Ctx, back: number, amount: number, s: number) {
  if (amount <= 0) return;
  for (let i = 0; i < 5; i++) {
    const age = (s * 0.5 + i / 5) % 1;
    faded(ctx, amount * (1 - age) * 0.75, () =>
      disc(
        ctx,
        back - 4 - age * 26,
        -12 - age * 8 + Math.sin(i * 2 + s) * 2,
        2 + age * 5,
        '#9A93A8',
      ),
    );
  }
}
/** The NOVA-1: a delivery box, cardboard fins, a party-hat nose cone, and a paper-plate dial. */
function rocket(ctx: Ctx, r: Ride, s: number, riders?: () => void) {
  const shake = r.shake ?? 0;
  ctx.save();
  ctx.translate(r.x + Math.sin(s * 57) * shake, r.y + Math.sin(s * 73 + 1) * shake * 0.6);
  ctx.rotate(r.tilt ?? 0);
  ctx.scale(r.k, r.k * (r.squash ?? 1));
  const b = r.bulge ?? 0,
    back = -25 - b * 3,
    front = 25 + b * 3;
  exhaust(ctx, back, r.flame ?? 0, s);
  box(ctx, back + 1, -23, front - back - 2, 3, CARD_INSIDE);
  box(ctx, back + 1, -24, front - back - 2, 1, CARD_LIGHT);
  topFin(ctx, back);
  riders?.();
  box(ctx, back, -20, front - back, 20, CARD);
  if (b > 0) {
    oval(ctx, back + 1, -10, b * 2.5, 10, CARD);
    oval(ctx, front - 1, -10, b * 2.5, 10, CARD);
  }
  box(ctx, back, -20, front - back, 1, CARD_LIGHT);
  box(ctx, back, -3, front - back, 3, CARD_DARK);
  lowerFin(ctx, back, r.fin ?? 2);
  partyHat(ctx, front);
  write(ctx, 'NOVA-1', 0, -6, { size: 6, color: MARKER });
  plate(ctx, front - 7, -11, r.fuel ?? 1, r.needle ?? 1);
  crayonFlames(ctx, back, r.crayon ?? 0, r.spark ?? 0, s);
  smoke(ctx, back, r.smoke ?? 0, s);
  ctx.restore();
}
// Rider seats, in the rocket's own units.
const NOVA_SOLO = 3,
  NOVA_DUO = 13,
  DAD_SEAT = -11;
const seatNova = (ctx: Ctx, x: number, o: Kid) =>
  nova(ctx, x, -11, { sitting: true, colander: 0, ...o });
const seatDad = (ctx: Ctx, o: Pa, sink = 0) =>
  dad(ctx, DAD_SEAT, -13 + sink, { sitting: true, knees: true, pan: true, ...o });

// ——— Speech bubbles ———
function bubble(
  ctx: Ctx,
  lines: readonly string[],
  x: number,
  y: number,
  amount: number,
  tail: readonly [number, number] | null,
  { size = 11, shout = false } = {},
) {
  if (amount <= 0) return;
  ctx.save();
  ctx.font = font('mono', size);
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const rx = width / 2 + (shout ? 14 : 9),
    ry = (lines.length * (size + 2)) / 2 + (shout ? 9 : 6);
  const grow = 0.4 + 0.6 * backOut(clamp(amount * 1.6));
  ctx.globalAlpha *= clamp(amount * 2);
  ctx.translate(x, y);
  ctx.scale(grow, grow);
  const shape = (pad: number, color: string) => {
    if (tail) {
      const tx = (tail[0] - x) / grow,
        ty = (tail[1] - y) / grow;
      const a = Math.atan2(ty, tx);
      const bx = Math.cos(a) * rx * 0.55,
        by = Math.sin(a) * ry * 0.55;
      const w = 6 + pad;
      poly(ctx, color, [
        bx - Math.sin(a) * w,
        by + Math.cos(a) * w,
        tx + Math.cos(a) * pad,
        ty + Math.sin(a) * pad,
        bx + Math.sin(a) * w,
        by - Math.cos(a) * w,
      ]);
    }
    if (shout) {
      const points: number[] = [];
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * TAU,
          k = i % 2 ? 1 : 1.18;
        points.push(Math.cos(a) * (rx + pad) * k, Math.sin(a) * (ry + pad) * k);
      }
      poly(ctx, color, points);
    } else oval(ctx, 0, 0, rx + pad, ry + pad, color);
  };
  shape(2, INK);
  shape(0, PAPER);
  lines.forEach((text, i) =>
    write(ctx, text, 0, (i - (lines.length - 1) / 2) * (size + 2) + size * 0.36, {
      size,
      color: INK,
    }),
  );
  ctx.restore();
}

// ——— The bedroom set (world units; the box sits on the rug at BOX) ———
const BOX = { x: 160, y: 158 } as const;
const KB = 1.3;
const WALL_BASE = 126;
const DOOR = { x: 14, w: 36, top: 36 } as const;
const WINDOW = { x: 196, y: 40, w: 50, h: 54 } as const;
const WINDOW_MOON = { x: 233, y: 54 } as const;
const LAMP = { x: 271, y: 86 } as const;
// Wallpaper star prints; `d` is how far the room must fall before each one peels off.
const PRINTS = (() => {
  const holes = [
    [8, 30, 58, 128],
    [58, 48, 98, 82],
    [184, 32, 258, 104],
    [256, 70, 288, 128],
    [284, 76, 470, 128],
  ];
  const out: { x: number; y: number; d: number; i: number }[] = [];
  for (let row = 0; row < 7; row++)
    for (let col = -6; col < 26; col++) {
      const x = col * 18 + (row % 2) * 9 + 4,
        y = 10 + row * 16;
      if (holes.some(([a, b, c, d]) => x > a && x < c && y > b && y < d)) continue;
      const i = out.length;
      const lo = Math.max(3, 44 - y),
        hi = Math.max(lo + 10, 150 - y);
      out.push({ x, y, i, d: lo + (hi - lo) * rand(i * 3.7 + 11) });
    }
  return out;
})();
function printStar(ctx: Ctx, x: number, y: number, z = 1) {
  box(ctx, x - z, y, 1 + 2 * z, 1, PRINT);
  box(ctx, x, y - z, 1, 1 + 2 * z, PRINT);
}
function doorway(ctx: Ctx, open: number) {
  const { x, w, top } = DOOR;
  box(ctx, x - 3, top - 3, w + 6, WALL_BASE - top + 3, TRIM);
  box(ctx, x, top, w, WALL_BASE - top, '#3A2A2C');
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, top, w, WALL_BASE - top);
  ctx.clip();
  glow(ctx, x + w / 2, top + 36, 60, '#FFC56E', 0.22 + 0.4 * open);
  ctx.restore();
  const leaf = lerp(w, 5, ease(open));
  box(ctx, x + w - leaf, top, leaf, WALL_BASE - top, '#8A6450');
  if (leaf > 14) {
    box(ctx, x + w - leaf + 4, top + 6, leaf - 8, 34, '#7A5644');
    box(ctx, x + w - leaf + 4, top + 48, leaf - 8, 36, '#7A5644');
    disc(ctx, x + w - leaf + 4, 86, 1.5, '#E9C46A');
  }
  if (open < 1) box(ctx, x, WALL_BASE - 1, w - leaf + 1, 1, alpha('#FFC56E', 0.7));
}
function kidsDrawing(ctx: Ctx) {
  box(ctx, 64, 54, 28, 22, '#F4EFE4');
  box(ctx, 63, 53, 4, 2, TAPE);
  box(ctx, 89, 53, 4, 2, TAPE);
  disc(ctx, 85, 60, 3.5, '#F2C14E');
  for (let i = 0; i < 4; i++) box(ctx, 72 + i * 3, 65 - i * 1.5, 1, 1, MARKER);
  box(ctx, 68, 67, 8, 4, CARD);
  poly(ctx, '#5FB3D9', [76, 67, 79, 69, 76, 71]);
  box(ctx, 65, 68, 3, 2, '#FF8A3D');
}
function windowView(ctx: Ctx, s: number, night: number) {
  const { x, y, w, h } = WINDOW;
  box(ctx, x - 3, y - 3, w + 6, h + 6, TRIM);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  sky(
    ctx,
    WINDOW_DUSK.map((c, i) => mix(c, WINDOW_NIGHT[i], night)),
    y,
    y + h,
    x,
    w,
  );
  for (let i = 0; i < 7; i++)
    box(
      ctx,
      x + 3 + rand(i + 40) * (w - 6),
      y + 3 + rand(i + 60) * 26,
      1,
      1,
      alpha('#FFF3D6', 0.3 + 0.6 * night + 0.1 * Math.sin(s * 2 + i)),
    );
  glow(ctx, WINDOW_MOON.x, WINDOW_MOON.y, 12, '#FFF1CF', 0.35);
  disc(ctx, WINDOW_MOON.x, WINDOW_MOON.y, 4.5, '#F4EBD0');
  disc(ctx, WINDOW_MOON.x + 1.5, WINDOW_MOON.y + 1, 1, '#DCD0B0');
  const roof = mix('#3A2C4E', '#141528', night);
  box(ctx, x, y + h - 9, w, 9, roof);
  poly(ctx, roof, [x - 2, y + h - 9, x + 10, y + h - 17, x + 22, y + h - 9]);
  poly(ctx, roof, [x + 26, y + h - 9, x + 36, y + h - 15, x + 48, y + h - 9]);
  box(ctx, x + 8, y + h - 7, 2, 2, '#F4CF84');
  box(ctx, x + 36, y + h - 6, 2, 2, '#F4CF84');
  ctx.restore();
  box(ctx, x + w / 2 - 1, y, 2, h, TRIM);
  box(ctx, x, y + h / 2 - 1, w, 2, TRIM);
  box(ctx, x - 6, y + h + 2, w + 12, 4, '#D9C7A6');
  box(ctx, x - 14, y - 10, w + 28, 2, '#6B4A3A');
  poly(ctx, '#B4524C', [x - 12, y - 8, x + 3, y - 8, x - 3, y + h + 4, x - 12, y + h + 4]);
  poly(ctx, '#B4524C', [
    x + w + 12,
    y - 8,
    x + w - 3,
    y - 8,
    x + w + 3,
    y + h + 4,
    x + w + 12,
    y + h + 4,
  ]);
  box(ctx, x - 9, y - 8, 1, h + 12, '#9C4440');
  box(ctx, x + w + 8, y - 8, 1, h + 12, '#9C4440');
}
function lampAndBed(ctx: Ctx) {
  box(ctx, 260, 104, 22, 22, '#7B5647');
  box(ctx, 258, 102, 26, 3, '#946A58');
  box(ctx, 262, 111, 18, 1, '#6A4A3C');
  box(ctx, 270, 114, 3, 2, '#D9B36E');
  box(ctx, 269, 90, 4, 12, '#3F3432');
  poly(ctx, '#F4CD7E', [261, 91, 281, 91, 277, 76, 265, 76]);
  box(ctx, 263, 89, 16, 2, '#E5B45F');
  box(ctx, 290, 82, 7, 44, '#8A5A48');
  box(ctx, 290, 80, 7, 3, '#A06B55');
  box(ctx, 294, 104, 160, 20, '#9C6B55');
  box(ctx, 297, 98, 160, 8, '#EDE3D0');
  box(ctx, 312, 94, 150, 14, '#D96C5B');
  for (let i = 0; i < 12; i++) box(ctx, 316 + i * 12, 96 + (i % 2) * 5, 6, 5, '#E9A04E');
  oval(ctx, 305, 96, 8, 4, '#F4EFE4');
  // Teddy on the pillow.
  oval(ctx, 306, 96, 4, 3, '#B5824E');
  disc(ctx, 306, 90, 3.5, '#B5824E');
  disc(ctx, 303.5, 87.5, 1.3, '#B5824E');
  disc(ctx, 308.5, 87.5, 1.3, '#B5824E');
  box(ctx, 307, 90, 2, 1, INK);
}
function toys(ctx: Ctx) {
  shade(ctx, 92, 147, 18);
  box(ctx, 86, 138, 11, 9, '#5FA8D3');
  box(ctx, 88, 130, 8, 8, '#E0584A');
  box(ctx, 89, 124, 6, 6, '#F2C14E');
  box(ctx, 214, 169, 10, 6, '#3E7CC9');
  box(ctx, 214, 169, 10, 1, '#F2C14E');
  for (const [x, y, c] of [
    [228, 172, '#E0584A'],
    [232, 175, '#4FA35A'],
    [222, 177, '#F2C14E'],
  ] as const)
    box(ctx, x, y, 5, 1, c);
  oval(ctx, 110, 172, 4, 2.5, TAPE);
  oval(ctx, 110, 172, 2, 1.2, FLOOR);
}
/** Nova's bedroom. `night` darkens the window; `door` swings the door open onto the lit hall. */
function bedroom(
  ctx: Ctx,
  s: number,
  { night = 0, door = 0, prints = true }: { night?: number; door?: number; prints?: boolean } = {},
) {
  box(ctx, -140, -120, 620, WALL_BASE + 120, WALL);
  if (prints) for (const star of PRINTS) printStar(ctx, star.x, star.y);
  box(ctx, -140, WALL_BASE - 6, 620, 6, '#D9C7A6');
  doorway(ctx, door);
  kidsDrawing(ctx);
  windowView(ctx, s, night);
  lampAndBed(ctx);
  box(ctx, -140, WALL_BASE, 620, 180, FLOOR);
  for (let y = WALL_BASE + 5, gap = 5; y < 300; y += gap, gap += 1.5)
    box(ctx, -140, y, 620, 1, FLOOR_LINE);
  oval(ctx, 162, 164, 96, 16, RUG);
  oval(ctx, 162, 164, 84, 12, RUG_IN);
  ctx.strokeStyle = alpha('#F4D2A0', 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(162, 164, 90, 14, 0, 0, TAU);
  ctx.stroke();
  toys(ctx);
  if (door > 0)
    poly(ctx, alpha('#FFC56E', 0.16 * door), [
      DOOR.x,
      WALL_BASE,
      DOOR.x + DOOR.w,
      WALL_BASE,
      DOOR.x + DOOR.w + 70,
      200,
      DOOR.x + 6,
      200,
    ]);
  glow(ctx, LAMP.x, LAMP.y, 130, LAMPLIGHT, 0.3);
}
const toScreen = (v: View, x: number, y: number) => ({
  x: (x - v.x) * v.zoom + W / 2,
  y: (y - v.y) * v.zoom + H / 2,
});
/** The bedroom camera that puts the box exactly where the rocket is on screen. */
function matchRoom(sx: number, sy: number, k: number): View {
  const zoom = k / KB;
  return { x: BOX.x - (sx - W / 2) / zoom, y: BOX.y - (sy - H / 2) / zoom, zoom };
}
/** The bedroom and the box's shadow, framed to sit under a rocket drawn in screen space. */
function roomUnder(ctx: Ctx, view: View, s: number, night: number) {
  camera(
    ctx,
    view,
    () => {
      bedroom(ctx, s, { night });
      shade(ctx, BOX.x, BOX.y + 1, 76);
    },
    null,
  );
  nightGrade(ctx, view, night);
}
/** Evening cools to night, but the bedside lamp keeps its warm pool. */
function nightGrade(ctx: Ctx, view: View, night: number) {
  if (night <= 0) return;
  veil(ctx, NIGHT_VEIL, 0.34 * night);
  const lamp = toScreen(view, LAMP.x, LAMP.y);
  glow(ctx, lamp.x, lamp.y, 90 * view.zoom, LAMPLIGHT, 0.22 * night);
}

// ——— Space ———
const NEBULAE = [
  [80, 50, 110, '#D9609A'],
  [300, 130, 130, '#8B4FB8'],
  [470, 60, 100, '#E0709A'],
  [200, 16, 80, '#6A4FC0'],
] as const;
const STAR_LAYERS = [
  [50, 0.05, '#8F82C0', 1],
  [30, 0.2, '#FFE7C2', 1],
  [12, 0.6, '#FFFFFF', 2],
] as const;
function space(ctx: Ctx, s: number, travel: number, { dusk = 0, warp = 0 } = {}) {
  sky(
    ctx,
    SPACE_BANDS.map((c, i) => mix(c, DUSK_BANDS[i], dusk)),
  );
  for (const [x, y, r, c] of NEBULAE)
    glow(ctx, wrap(x - travel * 0.03, 560) - 120, y, r, c, 0.26 * (1 - dusk));
  STAR_LAYERS.forEach(([count, speed, color, size], layer) => {
    for (let i = 0; i < count; i++) {
      const seed = layer * 97 + i;
      const x = wrap(rand(seed) * (W + 40) - travel * speed, W + 40) - 20;
      const y = rand(seed + 0.5) * H;
      const tone = alpha(color, 1 - dusk * 0.7);
      const streak = warp * speed * 90;
      if (streak > 1) box(ctx, x, y, streak, size, tone);
      else {
        box(ctx, x, y, size, size, tone);
        if (i % 4 === 0 && Math.sin(s * (0.7 + rand(seed + 3)) + i) > 0.6) {
          box(ctx, x - 1, y, 2 + size, 1, alpha(color, 0.5));
          box(ctx, x, y - 1, 1, 2 + size, alpha(color, 0.5));
        }
      }
    }
  });
}
const CRATERS = [
  [-0.35, -0.25, 0.2],
  [0.3, 0.28, 0.16],
  [0.08, -0.5, 0.11],
  [-0.5, 0.3, 0.12],
  [0.5, -0.12, 0.1],
  [-0.05, 0.12, 0.08],
] as const;
function moonBall(ctx: Ctx, x: number, y: number, r: number) {
  glow(ctx, x, y, r * 1.9, '#FFF1CF', 0.3);
  disc(ctx, x, y, r, '#EFE6CF');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  oval(ctx, x + r * 0.75, y + r * 0.3, r * 0.75, r * 1.2, '#DCD0B2');
  for (const [cx, cy, cr] of CRATERS) {
    disc(ctx, x + cx * r, y + cy * r, cr * r, '#D4C8A8');
    disc(ctx, x + cx * r + cr * r * 0.2, y + cy * r + cr * r * 0.2, cr * r * 0.7, '#C8BA96');
  }
  ctx.restore();
}
function ringArc(ctx: Ctx, x: number, y: number, r: number, from: number, to: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.3);
  ctx.scale(1, 0.28);
  ctx.strokeStyle = '#F2DDB0';
  ctx.lineWidth = r * 0.3;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.75, from, to);
  ctx.stroke();
  ctx.restore();
}
function ringedPlanet(ctx: Ctx, x: number, y: number, r: number) {
  glow(ctx, x, y, r * 2.4, '#5FC4B8', 0.18);
  ringArc(ctx, x, y, r, Math.PI, TAU);
  disc(ctx, x, y, r, '#5FC4B8');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  box(ctx, x - r, y - r * 0.55, r * 2, r * 0.22, '#4AA79F');
  box(ctx, x - r, y + r * 0.15, r * 2, r * 0.18, '#86D9CB');
  box(ctx, x - r, y + r * 0.55, r * 2, r * 0.14, '#4AA79F');
  oval(ctx, x + r * 0.8, y + r * 0.5, r * 0.9, r * 1.1, alpha('#23505A', 0.45));
  ctx.restore();
  ringArc(ctx, x, y, r, 0, Math.PI);
}
function rock(ctx: Ctx, x: number, y: number, r: number, spin: number, seed: number) {
  const points: number[] = [];
  for (let i = 0; i < 9; i++) {
    const a = spin + (i / 9) * TAU,
      rr = r * (0.78 + 0.3 * rand(seed + i));
    points.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9);
  }
  poly(ctx, '#8C7B8E', points);
  disc(ctx, x + r * 0.2, y + r * 0.2, r * 0.55, '#76667A');
  disc(ctx, x - r * 0.3 + Math.cos(spin) * r * 0.2, y - r * 0.25, r * 0.18, '#5E5064');
  box(ctx, x - r * 0.5, y - r * 0.6, r * 0.4, 1, '#B4A4B4');
}
function comet(ctx: Ctx, x: number, y: number, dx: number, dy: number) {
  for (let i = 9; i > 0; i--)
    disc(ctx, x + dx * i * 8, y + dy * i * 8, 1.5 + i * 0.7, alpha('#BFE4FF', 0.5 * (1 - i / 10)));
  glow(ctx, x, y, 16, '#DDF2FF', 0.7);
  disc(ctx, x, y, 2.5, '#FFFFFF');
}
function cloud(ctx: Ctx, x: number, y: number, w: number, color: string) {
  oval(ctx, x, y, w / 2, w / 7, color);
  oval(ctx, x - w * 0.16, y - w / 9, w / 4, w / 6, color);
  oval(ctx, x + w * 0.14, y - w / 8, w / 5, w / 6, color);
}
/** Pink dusk clouds rushing down past the rising rocket. */
function clouds(ctx: Ctx, drop: number, front: boolean) {
  const list = front
    ? ([
        [36, 0.3],
        [292, 1.4],
      ] as const)
    : ([
        [70, 0],
        [236, 0.5],
        [150, 1],
        [30, 1.5],
        [276, 2],
      ] as const);
  for (const [x, lag] of list) {
    const y = -50 + (drop - 150 - lag * 40) * 1.8;
    if (y > -40 && y < H + 40) cloud(ctx, x, y, front ? 80 : 56, front ? '#E7A6B8' : '#A77AAE');
  }
}

// ——— The Moon ———
function earth(ctx: Ctx, x: number, y: number, r: number) {
  glow(ctx, x, y, r * 2.6, '#7FB8FF', 0.32);
  disc(ctx, x, y, r, '#3E7CC9');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  oval(ctx, x - r * 0.35, y - r * 0.2, r * 0.4, r * 0.55, '#5FAE6A', 0.4);
  oval(ctx, x + r * 0.35, y + r * 0.3, r * 0.3, r * 0.35, '#5FAE6A');
  oval(ctx, x + r * 0.1, y - r * 0.6, r * 0.5, r * 0.12, '#F4F7FB');
  oval(ctx, x - r * 0.2, y + r * 0.55, r * 0.55, r * 0.1, '#F4F7FB');
  oval(ctx, x - r * 0.9, y + r * 0.1, r * 0.6, r * 1.2, alpha('#0B1030', 0.45));
  ctx.restore();
}
function lunarGround(ctx: Ctx, s: number, earthY: number) {
  sky(ctx, ['#05040A', '#0A0816', '#120E22'], 0, 130);
  starfield(ctx, s, { count: 44, seed: 5, bottom: 125, colors: ['#FFF3D6', '#A9B8D8'] });
  earth(ctx, 172, earthY, 24);
  poly(
    ctx,
    '#6E6A72',
    [0, 124, 30, 119, 70, 122, 120, 117, 170, 121, 220, 116, 270, 121, 320, 117, 320, 140, 0, 140],
  );
  poly(ctx, '#A7A197', [0, 132, 60, 128, 130, 131, 200, 127, 260, 130, 320, 127, 320, 180, 0, 180]);
  poly(ctx, '#C4BEB1', [0, 160, 80, 155, 160, 158, 240, 154, 320, 157, 320, 180, 0, 180]);
  for (const [x, y, w] of [
    [40, 140, 22],
    [236, 139, 16],
    [296, 168, 26],
    [28, 172, 18],
    [110, 136, 10],
  ] as const) {
    oval(ctx, x, y, w / 2, w / 9, '#8E887E');
    oval(ctx, x, y + 0.5, w / 2 - 2, w / 12, '#B5AFA2');
  }
  glow(ctx, 172, earthY + 30, 110, '#7FB8FF', 0.08);
}
function picnicCloth(ctx: Ctx, settle: number, s: number) {
  const lift = (1 - settle) * 16,
    ripple = Math.sin(s * 7) * (1 - settle) * 3;
  const corner = (u: number, v: number) => {
    const far = 1 - v;
    return [
      lerp(lerp(136, 208, u), lerp(126, 218, u), v),
      lerp(152, 168, v) - far * lift + Math.sin(u * 6 + s * 7) * ripple * far,
    ];
  };
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 8; col++) {
      const [ax, ay] = corner(col / 8, row / 3),
        [bx, by] = corner((col + 1) / 8, row / 3),
        [cx, cy] = corner((col + 1) / 8, (row + 1) / 3),
        [dx, dy] = corner(col / 8, (row + 1) / 3);
      poly(ctx, (row + col) % 2 ? '#F4EFE4' : '#D9463E', [ax, ay, bx, by, cx, cy, dx, dy]);
    }
}
function spaghetti(ctx: Ctx, x: number, y: number, pop: number) {
  if (pop <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  const k = backOut(pop);
  ctx.scale(k, k);
  ctx.fillStyle = '#F4EFE4';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI);
  ctx.fill();
  oval(ctx, 0, 0, 7, 1.6, '#E3DACB');
  oval(ctx, 0, -1, 5.5, 2.6, '#F2CF74');
  line(ctx, '#E2B85A', 0.6, [-4, -1, -1, -2.5, 2, -0.5, 4, -2]);
  disc(ctx, -0.5, -2.5, 2.2, '#C94A33');
  disc(ctx, 1, -3.5, 1.4, '#7A3B2A');
  ctx.restore();
}
function spoonFlag(ctx: Ctx, x: number, y: number, s: number, raise = 0) {
  const top = y - 30 - raise;
  line(ctx, '#C7CDD3', 1.4, [x, y - raise, x, top]);
  oval(ctx, x, top - 3, 2.4, 3.6, '#D5DBE0');
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 4; col++) {
      const wave = (c: number) => Math.sin(s * 4 + c * 1.2) * 1.2 * (c / 4);
      const ax = x + 1 + col * 3.5,
        ay = top + 2 + row * 4.5;
      poly(ctx, (row + col) % 2 ? '#F4EFE4' : '#D9463E', [
        ax,
        ay + wave(col),
        ax + 3.5,
        ay + wave(col + 1),
        ax + 3.5,
        ay + 4.5 + wave(col + 1),
        ax,
        ay + 4.5 + wave(col),
      ]);
    }
}
function dust(ctx: Ctx, x: number, y: number, t: number) {
  if (t <= 0 || t >= 1) return;
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 1 : -1,
      reach = 0.5 + rand(i + 7);
    faded(ctx, (1 - t) * 0.85, () =>
      oval(
        ctx,
        x + side * easeOut(t) * 64 * reach,
        y - easeOut(t) * 12 * rand(i + 3) - 2,
        4 + t * 13 * reach,
        3 + t * 6,
        '#DCD6C8',
      ),
    );
  }
}

// ——— The paper-plate dial, in close-up ———
function dialInsert(
  ctx: Ctx,
  s: number,
  fuel: number,
  { drawn = 1, lamp = 1, quiver = 0, sparkle = 0, marker = 1 } = {},
) {
  box(ctx, 0, 0, W, H, CARD);
  for (let x = 3; x < W; x += 7) box(ctx, x, 0, 2, H, alpha(CARD_DARK, 0.25));
  poly(ctx, alpha(TAPE, 0.9), [236, -6, 262, -6, 250, 44, 224, 44]);
  const cx = 168,
    cy = 92;
  oval(ctx, cx + 6, cy + 7, 66, 64, alpha('#3A2414', 0.35));
  disc(ctx, cx, cy, 66, '#E4D9C2');
  disc(ctx, cx, cy, 57, '#F6F0E3');
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU;
    box(ctx, cx + Math.cos(a) * 61.5, cy + Math.sin(a) * 61.5, 2, 2, '#D6CAB0');
  }
  // Crayon gauge: red near E, amber, green near F.
  const gy = cy + 12;
  for (const [from, to, color] of [
    [1.1, 1.3, '#D8453C'],
    [1.3, 1.6, '#F2A93B'],
    [1.6, 1.9, '#4FA35A'],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.arc(cx, gy, 42, from * Math.PI, to * Math.PI);
    ctx.stroke();
  }
  write(ctx, 'E', cx - 44, gy + 16, { size: 16, color: '#C23A32' });
  write(ctx, 'F', cx + 44, gy + 16, { size: 16, color: '#3E8A48' });
  write(ctx, 'FUEL', cx, gy + 34, { size: 12, color: MARKER });
  const a = needleAngle(fuel) + Math.sin(s * 38) * 0.035 * quiver;
  const tipX = cx + Math.cos(a) * 36 * drawn,
    tipY = gy - Math.sin(a) * 36 * drawn;
  if (drawn > 0) line(ctx, MARKER, 4, [cx, gy, tipX, tipY]);
  disc(ctx, cx, gy, 5, MARKER);
  if (sparkle > 0)
    for (let i = 0; i < 6; i++) {
      const t = (s * 1.3 + i / 6) % 1,
        r = 10 + t * 30,
        b = (i / 6) * TAU + s;
      faded(ctx, sparkle * (1 - t), () => {
        box(ctx, tipX + Math.cos(b) * r - 2, tipY + Math.sin(b) * r, 5, 1, '#FFF3C4');
        box(ctx, tipX + Math.cos(b) * r, tipY + Math.sin(b) * r - 2, 1, 5, '#FFF3C4');
      });
    }
  // Nova's hand with the marker, drawing the needle and then lifting away.
  if (marker < 1) {
    const hx = tipX + easeIn(marker) * 140,
      hy = tipY + easeIn(marker) * 90;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(-0.65);
    box(ctx, -3, 0, 7, 34, '#3553B0');
    box(ctx, -3, 26, 7, 12, '#1E2E66');
    poly(ctx, '#1E2E66', [-3, 0, 4, 0, 0.5, -5]);
    disc(ctx, 1, 16, 9, SKIN_N);
    box(ctx, -8, 22, 18, 40, SHIRT);
    ctx.restore();
  }
  if (lamp > 0) glow(ctx, 40, 10, 240, LAMPLIGHT, 0.28 * lamp);
  if (lamp < 1) {
    veil(ctx, '#2A1846', 0.45 * (1 - lamp));
    glow(ctx, 300, 20, 200, '#D9609A', 0.25 * (1 - lamp));
  }
  vignette(ctx, 0.5, SHADE);
}

// ——— Liftoff: the room falls away, its printed stars stay ———
const LIFT_VIEW: View = { x: 160, y: 108, zoom: 1.3 };
function wallpaperStars(ctx: Ctx, s: number, drop: number) {
  const z = LIFT_VIEW.zoom;
  for (const star of PRINTS) {
    const sx = (star.x - LIFT_VIEW.x) * z + W / 2;
    if (sx < -4 || sx > W + 4) continue;
    const sy = (star.y + Math.min(drop, star.d) - LIFT_VIEW.y) * z + H / 2;
    if (sy < -4 || sy > H + 4) continue;
    const age = clamp((drop - star.d) / 50);
    if (age <= 0) {
      printStar(ctx, sx, sy, 2);
      continue;
    }
    const color = mix('#EBC46E', '#FFF6E0', age);
    if (star.i % 3 === 0) glow(ctx, sx, sy, 6 + age * 6, '#FFE9B8', 0.4 * age);
    const twinkle = Math.sin(s * (1 + rand(star.i)) + star.i) > 0.3 ? 1 : 0;
    box(ctx, sx - 2 - twinkle, sy, 5 + twinkle * 2, 1, alpha(color, 0.7 + 0.3 * age));
    box(ctx, sx, sy - 2 - twinkle, 1, 5 + twinkle * 2, alpha(color, 0.7 + 0.3 * age));
  }
}
function liftoff(
  ctx: Ctx,
  p: number,
  s: number,
  from: number,
  to: number,
  power: number,
  duo: boolean,
) {
  const t = span(p, from, to);
  // The second launch ignites on screen, easing up over ~0.35 s (no flash).
  const light = duo ? ease(span(t, 0, 0.26)) : 1;
  const drop = 340 * easeIn(span(t, duo ? 0.12 : 0.15, 0.95));
  const rise = ease(span(t, duo ? 0.1 : 0.08, 0.6));
  space(ctx, s, keyed(p, TRAVEL), { dusk: 1 - ease(span(t, 0.3, 0.9)) });
  clouds(ctx, drop, false);
  camera(
    ctx,
    LIFT_VIEW,
    () => {
      ctx.translate(0, drop);
      bedroom(ctx, s, { night: duo ? 0.6 : 0.15, door: duo ? 1 : 0, prints: false });
      shade(ctx, BOX.x, BOX.y + 1, 76);
    },
    null,
  );
  wallpaperStars(ctx, s, drop);
  const x = lerp(160, 150, rise),
    y = lerp(155, 118, rise) + Math.sin(s * 3) * 2 * rise;
  glow(ctx, x - 50, y - 12, 80 + 40 * power, ACCENT, 0.3 * light * (1 - span(drop, 100, 300)));
  rocket(
    ctx,
    {
      x,
      y,
      k: lerp(KB * LIFT_VIEW.zoom, 2.05, rise),
      tilt: -0.32 * rise,
      shake: (duo ? 1.6 : 1.1) * (1 - rise * 0.6),
      flame: power * light * (1 + 0.08 * Math.sin(s * 9)),
      crayon: duo ? 1 - light : 0,
      fuel: 1,
      bulge: duo ? 1 : 0,
    },
    s,
    duo
      ? () => {
          seatDad(ctx, { arms: [2.7, 2.8], eyes: 'happy', mouth: 'grin' });
          seatNova(ctx, NOVA_DUO, { arms: [2.8, 2.9], eyes: 'happy', mouth: 'grin' });
        }
      : () =>
          seatNova(ctx, NOVA_SOLO, {
            arms: [0.9, 2.8],
            eyes: t < 0.4 ? 'wide' : 'happy',
            mouth: t < 0.4 ? 'o' : 'grin',
          }),
  );
  clouds(ctx, drop, true);
  vignette(ctx, 0.45, SHADE);
}

// ——— The shots ———
function finShot(ctx: Ctx, p: number, s: number) {
  const press = span(p, T.press, T.press + 0.011),
    tape = span(p, T.tape, T.tape + 0.008);
  camera(
    ctx,
    track(p, [
      [0, 156, 102, 1.2],
      [0.032, 140, 124, 1.75],
    ]),
    () => {
      bedroom(ctx, s);
      shade(ctx, BOX.x, BOX.y + 1, 76);
      // The colander waits on the rug for its big moment.
      shade(ctx, 84, 172, 18);
      ctx.save();
      ctx.translate(84, 165);
      colander(ctx, 0, 0);
      ctx.restore();
      // Nova, at the back of the box, presses on the last fin and tapes it.
      nova(ctx, 101, 163, {
        size: KB,
        arms:
          press < 1
            ? [1.3, 1.75 - press * 0.3]
            : tape < 1
              ? [1.2, 1.45 + Math.sin(s * 14) * 0.25]
              : [0.3, 2.7],
        eyes: tape >= 1 ? 'happy' : 'open',
        mouth: tape >= 1 ? 'grin' : 'flat',
        lean: tape >= 1 ? 0 : 0.18,
      });
      rocket(ctx, { x: BOX.x, y: BOX.y, k: KB, fin: press + tape, needle: 0 }, s);
    },
    null,
  );
  vignette(ctx, 0.45, SHADE);
}
function dialDrawShot(ctx: Ctx, p: number, s: number) {
  dialInsert(ctx, s, 1, {
    drawn: ease(span(p, T.dial, T.dial + 0.016)),
    marker: span(p, T.dial + 0.017, T.dial + 0.022),
  });
}
function countdownShot(ctx: Ctx, p: number, s: number) {
  const on = span(p, 0.058, T.colander),
    hop = span(p, T.hop, T.hop + 0.01);
  camera(
    ctx,
    track(p, [
      [0.058, 160, 128, 2.1],
      [0.078, 162, 126, 2.2],
      [0.082, 166, 124, 2.5],
      [0.11, 168, 122, 2.9],
    ]),
    () => {
      bedroom(ctx, s, { night: 0.1 });
      shade(ctx, BOX.x, BOX.y + 1, 76);
      if (hop < 1) {
        // Behind the box: colander on, then a hop up and in.
        const e = ease(hop);
        const x = lerp(BOX.x + 1, BOX.x + NOVA_SOLO * KB, e),
          y = lerp(BOX.y - 14, BOX.y - 8 * KB, e) - hump(hop, 0, 1) * 12;
        nova(ctx, x, y, {
          size: KB,
          arms: on < 1 ? [2.9, 2.9] : hop > 0 ? [2.6, 2.7] : [0.4, 0.5],
          eyes: on < 1 ? 'open' : 'happy',
          mouth: on < 1 ? 'smile' : 'grin',
          colander: on < 1 ? 0.2 * (1 - on) : 0,
          lift: (1 - easeIn(on)) * 9,
        });
        rocket(ctx, { x: BOX.x, y: BOX.y, k: KB }, s);
      } else {
        const n = fingersUp(p, T.counts);
        rocket(ctx, { x: BOX.x, y: BOX.y, k: KB }, s, () =>
          seatNova(ctx, NOVA_SOLO, {
            arms: n ? [0.9, 1.75] : [0.9, 1.1],
            fingers: n,
            eyes: n === 1 ? 'wide' : 'open',
            mouth: n === 1 ? 'grin' : n ? 'flat' : 'smile',
          }),
        );
      }
    },
    null,
  );
  vignette(ctx, 0.45, SHADE);
}
function igniteShot(ctx: Ctx, p: number, s: number) {
  const ign = span(p, T.ignite, T.ignite + 0.022);
  const view = track(p, [
    [0.11, 142, 134, 2.8],
    [0.14, 136, 130, 2.4],
  ]);
  camera(
    ctx,
    view,
    () => {
      bedroom(ctx, s, { night: 0.15 });
      shade(ctx, BOX.x, BOX.y + 1, 76);
      rocket(
        ctx,
        {
          x: BOX.x,
          y: BOX.y,
          k: KB,
          shake: 0.3 + ign * 0.9,
          flame: easeOut(span(ign, 0.35, 1)),
          crayon: 1 - span(ign, 0.55, 1),
          spark: ign,
        },
        s,
        () =>
          seatNova(ctx, NOVA_SOLO, {
            arms: [0.9, 1.1],
            eyes: ign > 0.5 ? 'wide' : 'happy',
            mouth: 'grin',
          }),
      );
    },
    null,
  );
  const back = toScreen(view, BOX.x - 40, BOX.y - 12);
  glow(ctx, back.x, back.y, 170, ACCENT, 0.32 * ease(span(ign, 0.3, 1)));
  vignette(ctx, 0.45, SHADE);
}
function asteroidShot(ctx: Ctx, p: number, s: number) {
  const t = span(p, 0.2, 0.245);
  const rideY = (u: number) => 104 + Math.sin(u * TAU * 1.5) * 14;
  space(ctx, s, keyed(p, TRAVEL));
  // [pass time, above?, radius, depth]: each rock passes the rocket where it is not.
  const rocks = [
    [0.1, 1, 13, 1],
    [0.28, 0, 16, 1],
    [0.42, 1, 8, 0.55],
    [0.52, 0, 12, 1],
    [0.68, 1, 18, 1],
    [0.84, 0, 10, 0.7],
    [0.97, 1, 14, 1],
    [0.22, 0, 6, 0.35],
    [0.6, 1, 7, 0.4],
    [0.9, 1, 5, 0.3],
  ] as const;
  const at = (i: number) => {
    const [pass, above, r, depth] = rocks[i];
    const y = above ? rideY(pass) - 88 - r * 0.5 : rideY(pass) + 10 + r;
    return { x: 124 + (pass - t) * 760 * depth, y: lerp(90, y, 0.4 + depth * 0.6), r, depth };
  };
  rocks.forEach((_, i) => {
    const a = at(i);
    if (a.depth < 0.8) faded(ctx, 0.75, () => rock(ctx, a.x, a.y, a.r, s * 0.4 + i, i * 11));
  });
  rocket(
    ctx,
    {
      x: 124,
      y: rideY(t),
      k: 2,
      tilt: -0.04 - Math.cos(t * TAU * 1.5) * 0.14,
      flame: 1,
      fuel: 1,
    },
    s,
    () =>
      seatNova(ctx, NOVA_SOLO, {
        arms: [0.9, 1.2],
        eyes: 'wide',
        mouth: t > 0.5 ? 'grin' : 'o',
        lean: Math.cos(t * TAU * 1.5) * -0.12,
      }),
  );
  rocks.forEach((_, i) => {
    const a = at(i);
    if (a.depth >= 0.8) rock(ctx, a.x, a.y, a.r, s * 0.5 + i, i * 11);
  });
  vignette(ctx, 0.5, SHADE);
}
function bonkShot(ctx: Ctx, p: number, s: number) {
  const since = p - T.bonk;
  const wob = since > 0 ? Math.sin(since * 700) * Math.exp(-since * 140) : 0;
  space(ctx, s, keyed(p, TRAVEL) * 0.7);
  const R = { x: 150, y: 170, k: 3.2 };
  const head = { x: R.x + 3.5 * R.k, y: R.y - 40 * R.k };
  // The rock drifts in, bonks the colander, and tumbles away.
  const come = span(p, 0.245, T.bonk),
    go = span(p, T.bonk, T.bonk + 0.02);
  const rx = since < 0 ? lerp(330, head.x + 14, come) : head.x + 14 - go * 150,
    ry = since < 0 ? lerp(-6, head.y - 8, come) : head.y - 8 - go * 90 + go * go * 30;
  rocket(ctx, { ...R, tilt: -0.03 + wob * 0.04, flame: 1.1, fuel: 1 }, s, () =>
    seatNova(ctx, NOVA_SOLO, {
      arms: [0.9, since > 0.006 ? 2.6 : 1.1],
      eyes: since < -0.007 ? 'open' : since < 0 ? 'wide' : since < 0.005 ? 'closed' : 'happy',
      mouth: since < -0.007 ? 'smile' : since < 0 ? 'o' : since < 0.005 ? 'flat' : 'grin',
      colander: wob * 0.5,
      lean: wob * 0.25,
    }),
  );
  rock(ctx, rx, ry, 10, s * 3 + go * 12, 5);
  if (since > 0 && since < 0.018) {
    for (let i = 0; i < 3; i++) {
      const a = s * 7 + (i / 3) * TAU;
      const sx = head.x + Math.cos(a) * 26,
        sy = head.y + 4 + Math.sin(a) * 7;
      box(ctx, sx - 2, sy, 5, 1, '#FFE08A');
      box(ctx, sx, sy - 2, 1, 5, '#FFE08A');
    }
    bubble(
      ctx,
      ['BONK!'],
      head.x + 62,
      head.y - 6,
      presence(p, T.bonk, T.bonk + 0.016, 0.003),
      null,
      {
        size: 12,
        shout: true,
      },
    );
  }
  vignette(ctx, 0.5, SHADE);
}
function planetShot(ctx: Ctx, p: number, s: number) {
  const t = span(p, 0.28, 0.34);
  space(ctx, s, keyed(p, TRAVEL));
  const px = 250 - t * 60;
  ringedPlanet(ctx, px, 62, 30);
  const orbit = s * 0.9;
  disc(ctx, px + Math.cos(orbit) * 50, 62 + Math.sin(orbit) * 14, 4, '#E8D8C0');
  const c = span(p, T.comet, T.comet + 0.02);
  if (c > 0 && c < 1) comet(ctx, lerp(360, -60, c), lerp(4, 70, c), 0.95, -0.15);
  const waving = p > 0.288 && p < T.comet;
  const look = p >= T.comet + 0.002 && p < T.comet + 0.014;
  rocket(ctx, { x: 96 + t * 22, y: 124, k: 2.1, tilt: -0.05, flame: 1, fuel: 1 }, s, () =>
    seatNova(ctx, NOVA_SOLO, {
      arms: [0.9, waving ? 2.55 + Math.sin(s * 10) * 0.4 : 1.1],
      eyes: look ? 'wide' : 'happy',
      mouth: look ? 'o' : 'grin',
      lean: look ? -0.1 : 0,
    }),
  );
  vignette(ctx, 0.5, SHADE);
}
function callShot(ctx: Ctx, p: number, s: number) {
  const real = Math.min(ease(span(p, 0.344, 0.356)), 1 - ease(span(p, 0.372, 0.386)));
  const R = { x: 156, y: 136, k: 2.4 };
  space(ctx, s, keyed(p, TRAVEL));
  faded(ctx, real, () => roomUnder(ctx, matchRoom(R.x, R.y, R.k), s, 0.25));
  const startled = p < 0.347,
    turned = p >= 0.347 && p < 0.374,
    shouting = p >= T.five && p < 0.38;
  rocket(
    ctx,
    {
      ...R,
      y: R.y + Math.sin(s * 2) * 1.5 * (1 - real),
      tilt: -0.05 * (1 - real),
      flame: (1 - real) * (p > 0.374 ? 1.35 : 1),
      crayon: real,
      fuel: fuelAt(p),
    },
    s,
    () =>
      seatNova(ctx, NOVA_SOLO, {
        facing: turned ? -1 : 1,
        arms: shouting ? [0.9, 2.5] : [0.9, 1.1],
        eyes: startled ? 'wide' : turned ? 'sad' : 'open',
        mouth: startled ? 'o' : shouting ? 'open' : turned ? 'flat' : 'grin',
        lean: startled ? -0.12 : p > 0.374 ? 0.2 : 0,
      }),
  );
  bubble(ctx, ['NOVA!', 'DINNER!'], 74, 38, presence(p, T.call1, 0.366, 0.004), [-20, 12], {
    size: 14,
    shout: true,
  });
  bubble(
    ctx,
    ['FIVE MORE', 'MINUTES!'],
    82,
    44,
    presence(p, T.five, 0.39, 0.004),
    [R.x - 4, R.y - 30 * R.k],
    { size: 11 },
  );
  vignette(ctx, 0.5, SHADE);
}
function coldShot(ctx: Ctx, p: number, s: number) {
  const real = Math.min(ease(span(p, 0.448, 0.462)), 1 - ease(span(p, 0.476, 0.488)));
  const R = { x: 118, y: 136, k: 2.2 };
  const near = ease(span(p, 0.4, 0.45));
  space(ctx, s, keyed(p, TRAVEL));
  moonBall(
    ctx,
    332 - 64 * near - 14 * span(p, 0.45, 0.5),
    76,
    14 + 34 * near + 8 * span(p, 0.45, 0.5),
  );
  faded(ctx, real, () => roomUnder(ctx, matchRoom(R.x, R.y, R.k), s, 0.45));
  const cough = Math.max(...COUGHS.map((c) => hump(p, c - 0.0025, c + 0.0025)));
  const dying = 1 - ease(span(p, T.sputter, 0.5));
  const startled = p >= T.call2 && p < 0.45,
    trying = p >= 0.45 && p < 0.478,
    sputtering = p >= T.sputter;
  rocket(
    ctx,
    {
      ...R,
      y: R.y + Math.sin(s * 2) * 1.5 * (1 - real),
      tilt: (sputtering ? 0.06 : -0.05) * (1 - real),
      flame: (1 - real) * dying * (1 - 0.85 * cough),
      crayon: real,
      fuel: fuelAt(p),
      smoke: span(p, T.sputter, 0.5),
      shake: cough * 1.5,
    },
    s,
    () =>
      seatNova(ctx, NOVA_SOLO, {
        arms: p > 0.405 && p < 0.44 ? [0.9, 2.05] : [0.9, 1.1],
        point: p > 0.405 && p < 0.44,
        eyes: startled || sputtering ? 'wide' : trying ? 'closed' : p > 0.405 ? 'happy' : 'open',
        mouth: startled || sputtering ? 'o' : trying ? 'flat' : p > 0.478 ? 'smile' : 'grin',
        lean: trying ? 0.2 : sputtering ? -0.1 : 0,
      }),
  );
  bubble(
    ctx,
    ['NOVA!', "IT'S GETTING COLD!"],
    118,
    26,
    presence(p, T.call2, 0.476, 0.004),
    [-20, 8],
    { size: 11, shout: true },
  );
  vignette(ctx, 0.5, SHADE);
}
function emptyShot(ctx: Ctx, p: number, s: number) {
  dialInsert(ctx, s, fuelAt(p), { lamp: 0, quiver: span(p, T.empty + 0.01, 0.52) });
}
function lowShot(ctx: Ctx, p: number, s: number) {
  const real = ease(span(p, T.fade, T.home));
  const drift = span(p, 0.52, T.home);
  const home = matchRoom(126, 150, 1.45);
  const sad: Kid = {
    arms: [0.2, 0.3],
    eyes: 'sad',
    mouth: 'frown',
    colander: 0.45 * ease(span(p, 0.52, 0.55)),
    lean: 0.22,
  };
  if (p < T.home) {
    space(ctx, s, keyed(p, TRAVEL));
    faded(ctx, real, () => roomUnder(ctx, home, s, 1));
    // The Moon recedes into the little Moon outside her window.
    const wm = toScreen(home, WINDOW_MOON.x, WINDOW_MOON.y);
    const e = easeIn(real);
    faded(ctx, 1 - span(real, 0.75, 1), () =>
      moonBall(ctx, lerp(262, wm.x, e), lerp(84, wm.y, e), lerp(74, 4.5 * home.zoom, e)),
    );
    rocket(
      ctx,
      {
        x: lerp(140, 126, drift),
        y: lerp(144, 150, drift),
        k: 1.45,
        tilt: Math.sin(drift * 3) * 0.1 * (1 - real),
        crayon: real,
        fuel: 0,
        smoke: (1 - real) * 0.6,
      },
      s,
      () => seatNova(ctx, NOVA_SOLO, sad),
    );
  } else {
    const view = track(p, [
      [T.home, home.x, home.y, home.zoom],
      [0.592, 112, 108, 1.5],
    ]);
    const enter = span(p, 0.584, 0.595);
    camera(
      ctx,
      view,
      () => {
        bedroom(ctx, s, { night: 1, door: ease(span(p, T.door, T.door + 0.008)) });
        shade(ctx, BOX.x, BOX.y + 1, 76);
        rocket(ctx, { x: BOX.x, y: BOX.y, k: KB, crayon: 1, fuel: 0 }, s, () =>
          seatNova(ctx, NOVA_SOLO, sad),
        );
        if (p > 0.584)
          dad(ctx, lerp(20, 34, ease(enter)), 128, {
            size: 1.35,
            step: enter < 1 ? s * 12 : undefined,
            arms: [0.35, enter < 1 ? 0.6 : 2.4],
            eyes: 'open',
            mouth: p > 0.595 ? 'open' : 'flat',
            ladle: true,
            potInHand: true,
          });
      },
      null,
    );
    nightGrade(ctx, view, 1);
    // The scolding gets one word out before he sees her face.
    const mouth = toScreen(view, 40, 84);
    bubble(ctx, ['NOVA—'], mouth.x + 44, mouth.y - 22, presence(p, 0.595, 0.61, 0.003), [
      mouth.x + 4,
      mouth.y,
    ]);
  }
  vignette(ctx, 0.55, SHADE);
}
function faceShot(ctx: Ctx, p: number, s: number) {
  const view = track(p, [
    [0.605, 164, 121, 4],
    [0.625, 162, 120, 4.4],
  ]);
  camera(
    ctx,
    view,
    () => {
      bedroom(ctx, s, { night: 1, door: 1 });
      rocket(ctx, { x: BOX.x, y: BOX.y, k: KB, crayon: 1, fuel: 0 }, s, () =>
        seatNova(ctx, NOVA_SOLO, {
          facing: -1,
          arms: [0.2, 0.3],
          eyes: 'sad',
          mouth: 'frown',
          colander: 0.45,
          lean: 0.05,
          tear: span(p, 0.61, 0.62),
        }),
      );
    },
    null,
  );
  nightGrade(ctx, view, 1);
  glow(ctx, -20, 90, 220, '#FFC56E', 0.22);
  vignette(ctx, 0.6, SHADE);
}
function softenShot(ctx: Ctx, p: number, s: number) {
  const view = track(p, [
    [0.625, 44, 92, 3.2],
    [0.64, 44, 94, 3.4],
  ]);
  const soft = p > 0.629;
  camera(
    ctx,
    view,
    () => {
      bedroom(ctx, s, { night: 1, door: 1 });
      dad(ctx, 34, 128, {
        size: 1.35,
        arms: [0.35, lerp(2.4, 0.5, ease(span(p, 0.63, 0.638)))],
        eyes: soft ? 'sad' : 'open',
        mouth: p > 0.634 ? 'smile' : soft ? 'flat' : 'open',
        lean: soft ? 0.08 : 0,
        ladle: true,
        potInHand: true,
      });
    },
    null,
  );
  nightGrade(ctx, view, 1);
  vignette(ctx, 0.6, SHADE);
}
function squeezeShot(ctx: Ctx, p: number, s: number) {
  const view = track(p, [
    [0.64, 148, 120, 1.75],
    [0.672, 150, 120, 1.75],
    [0.7, 156, 124, 2.1],
    [0.725, 158, 124, 2.2],
  ]);
  const night = 1 - 0.7 * ease(span(p, 0.67, 0.72));
  const DX = 112,
    DY = 151;
  const placed = p >= T.ladle,
    lifting = span(p, 0.657, T.pan),
    hatted = p >= T.pan;
  const climb = span(p, T.climb, T.squeeze);
  const squeeze = span(p, T.squeeze, 0.712);
  const beaming = p >= T.beam;
  const scoot = ease(span(p, 0.678, 0.688));
  camera(
    ctx,
    view,
    () => {
      bedroom(ctx, s, { night, door: 1 });
      shade(ctx, BOX.x, BOX.y + 1, 76);
      if (placed) {
        line(ctx, '#C7CDD3', 1.5, [90, 162, 104, 160]);
        oval(ctx, 88, 162, 3.5, 2, '#AEB6BE');
      }
      const novaPose = (): Kid => ({
        facing: p > 0.645 && p < 0.676 ? -1 : 1,
        arms: beaming ? [0.9, 2.7] : [0.3, 0.4],
        eyes: beaming ? 'happy' : hatted ? 'wide' : p > 0.645 ? 'open' : 'sad',
        mouth: beaming ? 'grin' : hatted ? (p > 0.672 ? 'smile' : 'o') : 'frown',
        colander: 0.45 * (1 - ease(span(p, 0.672, 0.682))),
        lean: p < 0.645 ? 0.22 : 0,
        blush: beaming,
      });
      if (climb <= 0) {
        // Dad by the box: a look, the ladle set down, the saucepan lifted on.
        const bend = hump(p, 0.646, 0.662);
        const f: Pa = {
          size: KB,
          arms:
            lifting > 0 && !hatted
              ? [lerp(0.3, 2.9, lifting), lerp(0.4, 2.9, lifting)]
              : [0.3, placed ? 0.3 : 0.8],
          eyes: hatted ? 'happy' : 'open',
          mouth: hatted ? 'grin' : 'flat',
          lean: p < 0.648 ? 0.25 : bend * 0.55,
          ladle: !placed,
          potInHand: lifting <= 0,
          pan: hatted,
        };
        dad(ctx, DX, DY, f);
        if (lifting > 0 && !hatted) {
          const hand = handOf(
            DX,
            DY,
            { skin: '', hair: '', coat: '', legs: '', build: 'adult', size: KB, arms: f.arms },
            'back',
          );
          const headTop = DY - 35 * KB;
          potAt(
            ctx,
            lerp(hand.x - 15.5 * KB, DX, ease(lifting)),
            lerp(hand.y, headTop, ease(lifting)) - hump(lifting, 0, 1) * 8,
            KB,
            Math.PI * (1 - ease(lifting)),
          );
        }
        rocket(ctx, { x: BOX.x, y: BOX.y, k: KB, crayon: 1, fuel: 0 }, s, () =>
          seatNova(ctx, NOVA_SOLO, novaPose()),
        );
      } else if (climb < 1) {
        // Up and over, into a box made for one.
        const e = ease(climb);
        rocket(ctx, { x: BOX.x, y: BOX.y, k: KB, crayon: 1, fuel: 0 }, s, () =>
          seatNova(ctx, lerp(NOVA_SOLO, NOVA_DUO, scoot), novaPose()),
        );
        dad(
          ctx,
          lerp(DX, BOX.x + DAD_SEAT * KB, e),
          lerp(DY, BOX.y - 20 * KB, e) - hump(climb, 0, 1) * 16,
          {
            size: KB,
            arms: [2.6, 2.6],
            eyes: 'wide',
            mouth: 'o',
            pan: true,
          },
        );
      } else {
        // The squeeze: three wiggles down, the box bulging, knees by his ears.
        const sink = -7 * (1 - ease(squeeze)) + Math.sin(squeeze * 3 * TAU) * 1.2 * (1 - squeeze);
        rocket(
          ctx,
          {
            x: BOX.x,
            y: BOX.y,
            k: KB,
            crayon: 1,
            fuel: 0,
            bulge: ease(squeeze) + Math.sin(squeeze * 3 * TAU) * 0.2 * (1 - squeeze),
          },
          s,
          () => {
            seatDad(
              ctx,
              {
                arms: [1.2, 1.1],
                eyes: squeeze < 1 ? 'closed' : 'happy',
                mouth: squeeze < 1 ? 'flat' : 'smile',
              },
              sink,
            );
            seatNova(ctx, NOVA_DUO, novaPose());
          },
        );
      }
    },
    null,
  );
  nightGrade(ctx, view, night);
  vignette(ctx, 0.5, SHADE);
}
function refillShot(ctx: Ctx, p: number, s: number) {
  dialInsert(ctx, s, fuelAt(p), { sparkle: span(p, T.refill + 0.004, 0.74) });
}
function countdownTwoShot(ctx: Ctx, p: number, s: number) {
  const view = track(p, [
    [0.745, 161, 126, 2.7],
    [0.775, 162, 124, 3.1],
  ]);
  const n = fingersUp(p, T.counts2);
  camera(
    ctx,
    view,
    () => {
      bedroom(ctx, s, { night: 0.3, door: 1 });
      shade(ctx, BOX.x, BOX.y + 1, 80);
      rocket(
        ctx,
        {
          x: BOX.x,
          y: BOX.y,
          k: KB,
          crayon: 1,
          fuel: 1,
          bulge: 1,
          shake: span(p, 0.766, 0.775) * 0.8,
        },
        s,
        () => {
          seatDad(ctx, {
            arms: [1.2, n ? 1.75 : 1.1],
            fingers: n,
            eyes: 'open',
            mouth: n === 1 ? 'grin' : 'smile',
          });
          seatNova(ctx, NOVA_DUO, {
            arms: [0.9, n ? 1.75 : 1.1],
            fingers: n,
            eyes: n === 1 ? 'wide' : 'open',
            mouth: n === 1 ? 'grin' : 'flat',
          });
        },
      );
    },
    null,
  );
  nightGrade(ctx, view, 0.3);
  vignette(ctx, 0.5, SHADE);
}
function warpShot(ctx: Ctx, p: number, s: number) {
  space(ctx, s, keyed(p, TRAVEL), { warp: 1 - 0.6 * span(p, 0.832, 0.845) });
  const zip = span(p, 0.804, 0.822);
  if (zip > 0 && zip < 1) ringedPlanet(ctx, lerp(440, -120, zip), 44, 24);
  const c = span(p, 0.814, 0.826);
  if (c > 0 && c < 1) comet(ctx, lerp(380, -80, c), lerp(150, 120, c), 1, 0.1);
  const m = easeIn(span(p, 0.826, 0.845));
  if (m > 0) moonBall(ctx, 290 - m * 40, 84, 6 + m * 110);
  // Speed lines streaming off the rocket.
  for (let i = 0; i < 7; i++) {
    const y = 70 + i * 9 + Math.sin(i * 3) * 4,
      x = wrap(200 - s * 520 - i * 53, 260) - 40;
    box(ctx, x, y, 30 + (i % 3) * 12, 1, alpha('#FFE7C2', 0.35));
  }
  rocket(
    ctx,
    {
      x: 150 + Math.sin(s * 4) * 2,
      y: 122 + Math.sin(s * 3) * 2,
      k: 2.3,
      tilt: -0.05,
      flame: 2.3 + Math.sin(s * 11) * 0.15,
      fuel: 1,
      bulge: 1,
      shake: 0.6,
    },
    s,
    () => {
      seatDad(ctx, { arms: [2.8, 2.7], eyes: 'happy', mouth: 'grin' });
      seatNova(ctx, NOVA_DUO, { arms: [2.9, 2.8], eyes: 'happy', mouth: 'grin' });
    },
  );
  vignette(ctx, 0.5, SHADE);
}
function landingShot(ctx: Ctx, p: number, s: number) {
  const d = span(p, 0.845, T.touchdown);
  const after = p - T.touchdown;
  const thump = after > 0 ? Math.exp(-after * 300) * Math.sin(after * 900) : 0;
  ctx.save();
  ctx.translate(0, thump * 1.5);
  lunarGround(ctx, s, 132);
  rocket(
    ctx,
    {
      x: lerp(-20, 150, easeOut(d)),
      y: lerp(30, 152, ease(d)),
      k: 1.9,
      tilt: lerp(-0.35, 0, ease(d)),
      flame: d < 1 ? lerp(1.6, 0.4, d) : 0,
      fuel: 1,
      bulge: 1,
      squash: 1 - 0.1 * hump(p, T.touchdown, T.touchdown + 0.008),
    },
    s,
    () => {
      const awe = after > 0 && after < 0.014;
      seatDad(ctx, {
        arms: awe ? [1.2, 1.1] : [2.4, 2.5],
        eyes: awe ? 'wide' : 'happy',
        mouth: awe ? 'o' : 'grin',
      });
      seatNova(ctx, NOVA_DUO, {
        arms: awe ? [0.9, 1.1] : [2.6, 2.8],
        eyes: awe ? 'wide' : 'happy',
        mouth: awe ? 'o' : 'grin',
      });
    },
  );
  dust(ctx, 150, 152, span(p, T.touchdown, T.touchdown + 0.022));
  ctx.restore();
  vignette(ctx, 0.5, SHADE);
}
// The picnic's geography on the Moon: rocket parked left, flag on the ridge, Earth between.
const PARK = { x: 96, y: 146 } as const;
const FLAG = { x: 238, y: 150 } as const;
const earthRise = (p: number) => lerp(128, 97, easeOut(span(p, 0.88, 1)));
function parkedRocket(ctx: Ctx, s: number) {
  shade(ctx, PARK.x, PARK.y + 1, 60);
  rocket(ctx, { x: PARK.x, y: PARK.y, k: 1.05, fuel: 1, bulge: 0.6, crayon: 0.35 }, s);
}
function flagSparkle(ctx: Ctx, p: number, s: number) {
  for (let i = 0; i < 5; i++) {
    const t = (s * 0.8 + i / 5) % 1,
      a = (i / 5) * TAU;
    faded(ctx, (1 - t) * span(p, T.flag, T.flag + 0.006), () => {
      const x = FLAG.x + 6 + Math.cos(a) * (6 + t * 12),
        y = FLAG.y - 30 + Math.sin(a) * (6 + t * 12);
      box(ctx, x - 1, y, 3, 1, '#FFF3C4');
      box(ctx, x, y - 1, 1, 3, '#FFF3C4');
    });
  }
}
function flagShot(ctx: Ctx, p: number, s: number) {
  const walk = span(p, 0.9, 0.907),
    plant = span(p, 0.907, T.flag);
  const cheer = p > T.flag + 0.002;
  camera(
    ctx,
    track(p, [
      [0.9, 204, 118, 1.9],
      [0.925, 208, 116, 2],
    ]),
    () => {
      lunarGround(ctx, s, earthRise(p));
      const x = lerp(180, 228, easeOut(walk)),
        y = 152;
      const f: Figure = {
        skin: SKIN_N,
        hair: HAIR,
        coat: SHIRT,
        legs: DENIM,
        size: 1.4,
        arms: plant < 1 ? [0.4, 2.8 - plant * 1.2] : cheer ? [2.9, 2.9] : [0.4, 1.4],
      };
      if (plant >= 1) {
        spoonFlag(ctx, FLAG.x, FLAG.y, s);
        flagSparkle(ctx, p, s);
      }
      nova(ctx, x, y, {
        size: 1.4,
        step: walk > 0 && walk < 1 ? s * 13 : undefined,
        arms: f.arms,
        eyes: 'happy',
        mouth: cheer ? 'grin' : 'smile',
        lean: plant > 0 && plant < 1 ? 0.2 : 0,
        colander: 0,
      });
      if (plant < 1) {
        // The spoon flag rides in her raised hand, then goes in with a push.
        const h = handOf(x, y, f);
        spoonFlag(ctx, lerp(h.x + 1, FLAG.x, plant), lerp(h.y + 12, FLAG.y, easeIn(plant)), s);
      }
    },
  );
  vignette(ctx, 0.5, SHADE);
}
function clothShot(ctx: Ctx, p: number, s: number) {
  const settle = easeOut(span(p, 0.925, 0.935));
  const setting = hump(p, 0.935, 0.947);
  const skip = span(p, 0.936, 0.952);
  camera(
    ctx,
    track(p, [
      [0.925, 170, 118, 1.35],
      [0.952, 172, 120, 1.45],
    ]),
    () => {
      lunarGround(ctx, s, earthRise(p));
      parkedRocket(ctx, s);
      spoonFlag(ctx, FLAG.x, FLAG.y, s);
      // Dad shakes out the checked cloth and sets down two bowls of spaghetti.
      dad(ctx, 172, 150, {
        size: 1.4,
        arms: settle < 1 ? [1.5, 1.7] : [0.5 + setting, 0.6 + setting],
        eyes: 'happy',
        mouth: 'smile',
        lean: setting * 0.45,
        pan: true,
      });
      picnicCloth(ctx, settle, s);
      T.bowls.forEach((at, i) => spaghetti(ctx, 163 + i * 21, 160, span(p, at, at + 0.006)));
      nova(ctx, lerp(226, 150, ease(skip)), lerp(154, 170, ease(skip)), {
        size: 1.4,
        facing: -1,
        step: skip > 0 && skip < 1 ? s * 13 : undefined,
        eyes: 'happy',
        mouth: 'grin',
        colander: 0,
      });
    },
  );
  vignette(ctx, 0.5, SHADE);
}
function supperShot(ctx: Ctx, p: number, s: number) {
  camera(
    ctx,
    track(p, [
      [0.952, 177, 120, 1.7],
      [1, 177, 119, 1.82],
    ]),
    () => {
      lunarGround(ctx, s, earthRise(p));
      parkedRocket(ctx, s);
      spoonFlag(ctx, FLAG.x, FLAG.y, s);
      picnicCloth(ctx, 1, s);
      // The same warm pool of light as the bedroom lamp, 384,000 km from home.
      glow(ctx, 176, 150, 70, LAMPLIGHT, 0.16);
      // Slurp: Nova's fork rises from the bowl with one very long noodle.
      const cycle = (s * 0.42) % 1,
        up = hump(cycle, 0.05, 0.85);
      const nf: Figure = {
        skin: SKIN_N,
        hair: HAIR,
        coat: SHIRT,
        legs: DENIM,
        size: 1.8,
        sitting: true,
        arms: [0.5, 1.2 + up * 1.1],
      };
      nova(ctx, 144, 166, {
        size: 1.8,
        sitting: true,
        arms: nf.arms,
        eyes: up > 0.6 ? 'closed' : 'happy',
        mouth: up > 0.6 ? 'o' : 'grin',
        colander: 0.05,
      });
      spaghetti(ctx, 163, 160, 1);
      spaghetti(ctx, 184, 160, 1);
      const fork = handOf(144, 166, nf);
      line(ctx, '#C7CDD3', 1, [fork.x, fork.y, fork.x + 2, fork.y - 5]);
      line(ctx, '#F2CF74', 0.8, [
        fork.x + 2,
        fork.y - 4,
        lerp(fork.x + 4, 163, 0.5),
        lerp(fork.y, 158, 0.5) + 5 * (1 - up),
        163,
        158,
      ]);
      // Dad twirls his fork and laughs, saucepan and all.
      const df: Figure = {
        skin: SKIN_D,
        hair: HAIR,
        coat: CARDIGAN,
        legs: TROUSERS,
        build: 'adult',
        size: 1.75,
        facing: -1,
        sitting: true,
        arms: [0.4, 1.35 + Math.sin(s * 5) * 0.12],
      };
      dad(ctx, 213, 166, {
        ...df,
        eyes: 'happy',
        mouth: Math.sin(s * 1.3) > 0.2 ? 'grin' : 'smile',
        pan: true,
      });
      const twirl = handOf(213, 166, df);
      line(ctx, '#C7CDD3', 1, [twirl.x, twirl.y, 186, 157]);
      oval(ctx, 186 + Math.sin(s * 9), 157, 2.5, 1.5, '#F2CF74');
    },
  );
  vignette(ctx, 0.45, SHADE);
}
const SHOTS = [
  finShot,
  dialDrawShot,
  countdownShot,
  igniteShot,
  (ctx: Ctx, p: number, s: number) => liftoff(ctx, p, s, 0.14, 0.2, 1.1, false),
  asteroidShot,
  bonkShot,
  planetShot,
  callShot,
  coldShot,
  emptyShot,
  lowShot,
  faceShot,
  softenShot,
  squeezeShot,
  refillShot,
  countdownTwoShot,
  (ctx: Ctx, p: number, s: number) => liftoff(ctx, p, s, T.ignite2, 0.8, 2.3, true),
  warpShot,
  landingShot,
  flagShot,
  clothShot,
  supperShot,
];

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const cardboardRocketScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: 60, voice: 'bell', intro: [0, 7, 12], outro: [0, 7, 12, 16] }, (s) => {
    const beep = (p: number, high = false) => {
      s.fx('beep', p, high ? 0.5 : 0.14, 0.12);
      s.note(p, high ? 84 : 79, high ? 0.6 : 0.2, 'bell', 0.07);
    };
    // Act one: a busy little march while the rocket is built.
    s.section({
      from: 0,
      to: 0.11,
      bpm: 120,
      root: 60,
      chords: [0, 5, 7, 0],
      melody: [7, 9, 12, 9, 7, 4, 5, 7],
      step: 0.5,
      voice: 'pluck',
      gain: 0.55,
      level: 0.55,
      groove: 'march',
      fade: 0.4,
    });
    s.fx('rustle', T.press, 0.9, 0.14, -0.3);
    s.fx('click', T.press + 0.011, 0.1, 0.16, -0.3);
    s.fx('rustle', T.tape, 0.4, 0.12, -0.3);
    s.fx('scribble', T.dial, 0.9, 0.18, 0.1);
    s.fx('clash', T.colander, 0.5, 0.05, -0.1);
    s.fx('knock', T.colander, 0.2, 0.12);
    s.fx('thud', T.hop + 0.01, 0.4, 0.2);
    T.counts.forEach((c) => beep(c));
    beep(T.ignite, true);
    // Liftoff: the crayon flames catch, and the room falls away.
    s.section({
      from: 0.11,
      to: 0.2,
      bpm: 132,
      root: 62,
      chords: [0, 0, 5, 7],
      melody: [0, 7, 12, null, 11, 12, 14, 16],
      step: 0.5,
      voice: 'lead',
      gain: 0.6,
      level: 0.85,
      groove: 'drive',
      fade: 0.3,
    });
    s.fx('crackle', T.ignite + 0.004, 1.2, 0.12, -0.3);
    s.fx('rumble', T.ignite + 0.01, 5, 0.26);
    s.fx('engine', 0.13, 3.4, 0.1);
    s.fx('warp', 0.15, 2.6, 0.16);
    s.fx('swish', 0.176, 0.7, 0.1, -0.4);
    s.fx('swish', 0.188, 0.7, 0.1, 0.4);
    // Space: a waltz full of wonder (the lydian lift of G major over F).
    s.section({
      from: 0.2,
      to: 0.34,
      bpm: 96,
      root: 65,
      chords: [0, 2, 0, -5],
      melody: [12, 16, 19, 14, 18, 21, 19, 16, 12, 7, 11, 14],
      voice: 'bell',
      gain: 0.7,
      level: 0.7,
      groove: 'waltz',
      fade: 0.8,
    });
    for (const [at, pan] of [
      [0.207, 0.6],
      [0.222, -0.4],
      [0.236, 0.5],
    ] as const)
      s.fx('swish', at, 0.4, 0.08, pan);
    s.fx('boing', T.bonk, 0.9, 0.2, 0.2);
    s.fx('giggle', T.bonk + 0.006, 0.8, 0.14, 0.1);
    s.fx('sweep', T.comet, 1.2, 0.1, 0.5);
    s.fx('sparkle', T.comet + 0.006, 1, 0.08, -0.3);
    // Interruption one: the music thins to a woozy pad while the bedroom leaks in.
    const woozy = (from: number, seconds: number) => {
      s.note(from, 65 + 4.3, seconds, 'pad', 0.028, -0.3);
      s.note(from, 65 + 11.7, seconds, 'pad', 0.022, 0.3);
      s.fx('crackle', from, 1.1, 0.07, 0);
    };
    s.section({
      from: 0.34,
      to: 0.388,
      bpm: 60,
      root: 65,
      chords: [0],
      level: 0.4,
      bass: false,
      fade: 0.6,
    });
    woozy(0.344, 2.4);
    // "NO-VA! DIN-NER!" and "FIVE MORE MI-NUTES!"
    [79, 76, 79, 76].forEach((pitch, i) =>
      s.note(T.call1 + i * 0.0045, pitch, 0.24, 'lead', 0.11, -0.6),
    );
    [72, 74, 76, 77, 79].forEach((pitch, i) =>
      s.note(T.five + i * 0.003, pitch, 0.16, 'pluck', 0.11, 0.3),
    );
    s.fx('rumble', 0.374, 1.6, 0.14);
    s.section({
      from: 0.384,
      to: 0.446,
      bpm: 96,
      root: 65,
      chords: [0, 2, 0, -5],
      melody: [12, 16, 19, 14, 18, 21, 19, 21, 24, 19, 16, 12],
      voice: 'bell',
      gain: 0.65,
      level: 0.65,
      groove: 'waltz',
      fade: 0.6,
    });
    // Interruption two: longer, colder; then the engine coughs out.
    s.section({
      from: 0.444,
      to: 0.5,
      bpm: 60,
      root: 65,
      chords: [0, -2],
      minor: true,
      level: 0.38,
      bass: false,
      fade: 0.6,
    });
    woozy(0.448, 2.8);
    [79, 76, 74, 72, 74].forEach((pitch, i) =>
      s.note(T.call2 + i * 0.004, pitch, 0.2, 'lead', 0.1, -0.6),
    );
    s.fx('wind', 0.45, 2.2, 0.08);
    COUGHS.forEach((c, i) => {
      s.fx('pop', c, 0.2, 0.2, -0.4);
      s.fx('chug', c, 0.3, 0.1 - i * 0.02, -0.3);
    });
    // The needle falls to E: a sad slide down.
    [76, 74, 72, 71, 69].forEach((pitch, i) =>
      s.note(T.empty + i * 0.0025, pitch, 0.5, 'lead', 0.09),
    );
    s.fx('tick', T.empty + 0.01, 0.1, 0.18);
    // The low point: deflated A minor, a lonely clock, the imagination gone.
    s.section({
      from: 0.5,
      to: 0.63,
      bpm: 64,
      root: 57,
      minor: true,
      chords: [0, 5, 0, 7],
      melody: [7, null, 5, 3, 2, null, 0, null],
      voice: 'keys',
      gain: 0.45,
      level: 0.5,
      fade: 1,
    });
    s.fx('wind', 0.52, 2.5, 0.05);
    s.fx('crackle', T.fade, 1.4, 0.06);
    for (let i = 0; i < 5; i++) s.fx('tick', 0.566 + i * 0.0045, 0.06, 0.08, 0.5);
    s.fx('creak', T.door, 0.8, 0.12, -0.6);
    s.fx('step', 0.586, 0.2, 0.12, -0.6);
    s.fx('step', 0.592, 0.2, 0.12, -0.5);
    s.note(0.595, 79, 0.2, 'lead', 0.1, -0.5);
    // Dad softens: warmth creeps back in.
    s.chord(0.63, [60, 64, 67, 72], 3, 'pad', 0.035);
    s.section({
      from: 0.63,
      to: 0.692,
      bpm: 84,
      root: 60,
      chords: [0, 5, 7, 0],
      melody: [4, 7, 12, 11, 9, 7, null, null],
      voice: 'keys',
      gain: 0.5,
      level: 0.55,
      groove: 'tick',
      fade: 1,
    });
    s.fx('knock', T.ladle, 0.2, 0.14, -0.3);
    s.fx('clatter', T.ladle + 0.001, 0.3, 0.05, -0.3);
    s.fx('clash', T.pan, 0.9, 0.08, -0.2);
    s.fx('creak', T.squeeze, 1.2, 0.14);
    s.fx('squeak', T.squeeze + 0.008, 0.4, 0.1, 0.2);
    s.fx('rustle', T.squeeze, 1, 0.1);
    s.fx('thud', 0.711, 0.4, 0.16);
    s.fx('giggle', T.beam + 0.002, 0.8, 0.15, 0.3);
    s.section({
      from: 0.69,
      to: 0.748,
      bpm: 84,
      root: 60,
      chords: [0, 5, 7, 0],
      melody: [0, 4, 7, 12, 16, 14, 12, 7],
      step: 0.5,
      voice: 'bell',
      gain: 0.55,
      level: 0.72,
      groove: 'pulse',
      fade: 0.6,
    });
    // The needle swings back to F.
    [60, 64, 67, 72, 76, 79].forEach((pitch, i) =>
      s.note(T.refill + i * 0.0022, pitch, 0.6, 'bell', 0.08),
    );
    s.fx('sparkle', T.refill + 0.004, 1, 0.1, 0.2);
    // Countdown together, then the double liftoff.
    s.section({
      from: 0.745,
      to: 0.776,
      bpm: 120,
      root: 67,
      chords: [0],
      level: 0.55,
      groove: 'tick',
      fade: 0.3,
    });
    T.counts2.forEach((c) => {
      beep(c);
      s.note(c, 67, 0.2, 'bell', 0.05, -0.3);
    });
    beep(T.ignite2, true);
    s.section({
      from: 0.775,
      to: 0.848,
      bpm: 138,
      root: 62,
      chords: [0, 5, 7, 5],
      melody: [0, 4, 7, 12, 11, 12, 14, 16, 19, 16, 14, 12, 14, 16, 19, 24],
      step: 0.5,
      voice: 'lead',
      gain: 0.65,
      level: 1,
      groove: 'drive',
      fade: 0.3,
    });
    s.fx('rumble', T.ignite2, 4.5, 0.3);
    s.fx('thunder', T.ignite2 + 0.003, 3, 0.16);
    s.fx('warp', 0.79, 2, 0.16);
    s.fx('warp', 0.806, 2.4, 0.18);
    s.fx('swish', 0.81, 0.6, 0.12, -0.6);
    s.fx('sweep', 0.815, 0.8, 0.1, 0.5);
    // The landing: easing down onto the Moon.
    s.section({
      from: 0.845,
      to: 0.902,
      bpm: 92,
      root: 62,
      chords: [5, 7, 0],
      melody: [19, 16, 12, 7, 12, 16],
      voice: 'bell',
      gain: 0.55,
      level: 0.6,
      groove: 'pulse',
      fade: 0.5,
    });
    s.fx('sweep', 0.848, 1.5, 0.1);
    s.fx('thud', T.touchdown, 0.6, 0.3);
    s.fx('crunch', T.touchdown + 0.001, 0.3, 0.12);
    s.fx('wind', T.touchdown, 1.6, 0.05);
    // A cosy supper on the Moon.
    s.section({
      from: 0.9,
      to: 1,
      bpm: 90,
      root: 60,
      chords: [0, 5, 7, 0],
      melody: [12, 16, 19, 17, 16, 14, 12, 16, 19, 24, 19, 16],
      voice: 'bell',
      gain: 0.6,
      level: 0.7,
      groove: 'waltz',
      fade: 1.5,
    });
    s.fx('flutter', T.cloth, 0.8, 0.12, 0.2);
    T.bowls.forEach((b, i) => s.fx('pop', b, 0.2, 0.16, 0.1 + i * 0.1));
    s.fx('knock', T.flag, 0.2, 0.16, 0.6);
    s.fx('sparkle', T.flag + 0.001, 1.2, 0.1, 0.6);
    s.fx('giggle', 0.965, 0.8, 0.12, -0.2);
  });

export const cardboardRocket: FilmModule = {
  draw(ctx, p, seconds) {
    SHOTS[shot(p, CUTS).index](ctx, p, seconds);
    // A soft dip between the landing and the picnic.
    veil(ctx, SHADE, hump(p, 0.894, 0.906) * 0.7);
    captions(ctx, p, [
      [0.004, 0.056, "Tonight's destination: the Moon."],
      [0.066, 0.112, '3... 2... 1...'],
      [0.528, 0.578, 'Out of fuel.'],
      [0.695, 0.745, 'Room for two?'],
      [0.936, 0.986, 'Dinner, served 384,000 km away.'],
    ]);
  },
  score: cardboardRocketScore,
  look: {
    shade: SHADE,
    ink: '#FFF0DA',
    accent: ACCENT,
    dedication: 'for every grown-up who climbed back into the box',
  },
};
