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
  within,
  write,
  type Ctx,
  type Figure,
  type View,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * BOO, POLITELY
 * Wisp, a shy little ghost, has had the old house on the hill to herself for a hundred years.
 * When a new family moves in she tries to scare them away (a rattled chain, a BOO, a floating
 * chair) and fails every time, until the family's daughter is frightened by something else in
 * the dark, and what she needs is a friend.
 *
 * Timing lives in story time and is shared by the pictures and the score: every hammer knock,
 * squeak, sneeze, tick, and shutter click is drawn and heard on the same frame.
 */

// ——— Shots and beats ———
const CUTS = [
  0, // the house on the hill at dusk
  0.03, // checkers against herself
  0.075, // dusting great-aunt, alone in the parlour
  0.12, // morning: the moving van
  0.16, // Wisp at the curtain
  0.2, // scare one: a rattled chain...
  0.245, // ...of paperclips
  0.275, // scare two: the wind-up
  0.315, // boo.
  0.335, // achoo
  0.37, // scare three: the floating chair
  0.445, // the lick
  0.47, // night on the hill
  0.495, // a monster on the attic wall
  0.545, // Wisp in the doorway
  0.58, // shadow puppets
  0.655, // Juno peeks out
  0.68, // hi / boo?
  0.72, // hide and seek
  0.795, // tucked in
  0.86, // morning on the porch
  0.917, // the photo
  0.965, // on the mantel
] as const;

// Act one: alone.
const MOVES = [0.04, 0.066] as const; // checkers pieces land
const CROSS = [0.045, 0.056] as const; // Wisp floats round to the other side of the board
const DUSTS = [0.081, 0.089] as const;
// The family arrives.
const VAN_STOP = 0.134,
  DOORS = 0.138,
  GASP = 0.174,
  HIDE = 0.182;
// Three scares, three flops.
const HAMMER = [0.207, 0.214, 0.221, 0.236, 0.243] as const;
const RATTLE = [0.224, 0.252] as const;
const TINKLE = 0.25,
  FLOP_A = 0.264;
const WIND_UP = [0.29, 0.312] as const;
const BOO = 0.321,
  AH = [0.339, 0.344] as const,
  SNEEZE = 0.349,
  FLOP_B = 0.358;
const LIFT = [0.378, 0.392] as const;
const TURN = 0.396,
  SHRUG = [0.401, 0.41] as const,
  STEP_UP = [0.411, 0.419] as const,
  SHELVE = 0.428,
  HOP_DOWN = [0.432, 0.439] as const,
  CHAIR_DROP = 0.441;
const LICK = 0.452,
  FLOP_C = 0.459;
// Night.
const CREAKS = [0.478, 0.52] as const;
const COVER = [0.51, 0.519] as const,
  SOFTEN = 0.562;
const GLIDE = [0.58, 0.597] as const,
  BUNNY = [0.598, 0.622] as const,
  BIRD = [0.622, 0.652] as const;
const HOPS = [0.604, 0.611, 0.618] as const;
const GIGGLE = 0.66,
  SPOT = 0.672,
  HI = 0.684,
  SHY_BOO = 0.699,
  LAUGH = 0.711;
const SINK = [0.728, 0.745] as const,
  FOUND = 0.776;
const YAWN = 0.8,
  TUCK = [0.812, 0.826] as const,
  SETTLE = [0.83, 0.85] as const;
// Morning.
const PRESS = 0.866,
  RUN = [0.868, 0.883] as const,
  PULL_IN = [0.886, 0.897] as const,
  CLICK = 0.905;
const TICKS = Array.from({ length: 8 }, (_, i) => PRESS + 0.0045 * (i + 0.5));

// ——— Wisp ———
const INK = '#231C33';
const SHEET = '#F5F1FF',
  SHEET_SHADE = '#CFC5EC',
  BLUSH = '#F49AB8',
  WISP_GLOW = '#C8B6FF',
  WARM = '#FFD9A0',
  WARM_GLOW = '#FFE0B8';

type GhostEyes = 'open' | 'wide' | 'happy' | 'closed' | 'soft' | 'squint' | 'spooky' | 'sad';
type GhostMouth = 'none' | 'smile' | 'o' | 'open' | 'wobble' | 'grin';
type Ghost = {
  size?: number;
  eyes?: GhostEyes;
  mouth?: GhostMouth;
  /** Where she looks: -1 left to 1 right, and a little down with a positive lookY. */
  look?: number;
  lookY?: number;
  /** Nub angles from hanging (0) through straight out (PI / 2) to straight up (PI): [left, right]. */
  arms?: readonly [number, number];
  blush?: number;
  /** Wider and shorter above 1, taller and thinner below. */
  squash?: number;
  tilt?: number;
  /** Opacity of the sheet alone: her eyes stay behind when she melts into a wall. */
  body?: number;
  glow?: number;
  glowColor?: string;
};

/** A slow float for anything ghostly. */
const bob = (seconds: number, seed = 0) => Math.sin(seconds * 2.3 + seed) * 1.2;

/** Fills a rectangle without the kit's pixel rounding, for detail inside scaled art. */
function dot(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Offsets a flat list of x, y pairs to (x, y), so shapes can be written as plain numbers. */
const at = (x: number, y: number, points: readonly number[]) =>
  points.map((v, i) => v + (i % 2 ? y : x));

/** The sheet: a round top and a hem that ripples as she floats. */
function sheetPath(ctx: Ctx, seconds: number) {
  ctx.beginPath();
  ctx.moveTo(-10, -4);
  ctx.arc(0, -4, 10, Math.PI, 0);
  ctx.quadraticCurveTo(10.5, 3, 12, 10);
  for (let i = 0; i < 4; i++) {
    const x0 = 12 - i * 6,
      x1 = x0 - 6,
      wave = Math.sin(seconds * 5 - i * 1.7);
    ctx.quadraticCurveTo((x0 + x1) / 2, 15 + wave * 1.4, x1, i < 3 ? 10 + wave * 0.5 : 10);
  }
  ctx.quadraticCurveTo(-10.5, 3, -10, -4);
  ctx.closePath();
}

const nub = (side: -1 | 1, angle: number) => {
  const dx = side * Math.sin(angle),
    dy = Math.cos(angle);
  return { x: side * 9 + dx * 5, y: -1 + dy * 5, rot: Math.atan2(dy, dx) };
};

/** Wisp, centred on (x, y): about 24 wide and 29 tall at size 1. */
function wisp(ctx: Ctx, x: number, y: number, seconds: number, g: Ghost = {}) {
  const s = g.size ?? 1,
    squash = g.squash ?? 1;
  const light = g.glow ?? 1;
  if (light > 0) glow(ctx, x, y, 32 * s, g.glowColor ?? WISP_GLOW, 0.32 * light);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(g.tilt ?? 0);
  ctx.scale(s * squash, s / squash);
  const [left, right] = g.arms ?? [0.35, 0.35];
  faded(ctx, g.body ?? 1, () => {
    for (const [side, angle] of [
      [-1, left],
      [1, right],
    ] as const) {
      const n = nub(side, angle);
      oval(ctx, n.x, n.y, 4.5, 2.8, SHEET, n.rot);
    }
    sheetPath(ctx, seconds);
    ctx.fillStyle = SHEET;
    ctx.fill();
    ctx.save();
    ctx.clip();
    oval(ctx, 3, 15, 17, 7, SHEET_SHADE);
    oval(ctx, -12, 4, 4, 14, alpha(SHEET_SHADE, 0.7));
    ctx.restore();
    oval(ctx, -4, -11, 3.5, 1.6, '#FFFFFF');
  });
  ghostFace(ctx, g);
  ctx.restore();
}

function ghostFace(ctx: Ctx, g: Ghost) {
  const lx = (g.look ?? 0) * 2,
    ly = g.lookY ?? 0;
  const eyes = g.eyes ?? 'open';
  for (const side of [-1, 1] as const) {
    const ex = side * 4.2 + lx,
      ey = -4 + ly;
    if (eyes === 'happy') line(ctx, INK, 1.3, [ex - 2, ey + 1, ex, ey - 1.4, ex + 2, ey + 1]);
    else if (eyes === 'closed') line(ctx, INK, 1.1, [ex - 2, ey, ex, ey + 1.3, ex + 2, ey]);
    else if (eyes === 'squint')
      line(ctx, INK, 1.1, [ex + side * 1.8, ey - 2, ex - side * 1.4, ey, ex + side * 1.8, ey + 2]);
    else if (eyes === 'soft') {
      // Welling up, kindly: glinting eyes under gently raised brows.
      oval(ctx, ex, ey + 0.3, 2.2, 2.9, INK);
      dot(ctx, ex - 1.5, ey - 1.5, 1.4, 1.4, '#FFFFFF');
      dot(ctx, ex + 0.5, ey + 1, 0.8, 0.8, '#FFFFFF');
      line(ctx, INK, 0.6, [ex + side * 2, ey - 4.4, ex - side * 1.4, ey - 5.3]);
    } else {
      const wide = eyes === 'wide';
      oval(ctx, ex, ey, wide ? 2.6 : 2.1, wide ? 3.7 : 3.1, INK);
      dot(ctx, ex - 1.3, ey - 1.9, 1.1, 1.1, '#FFFFFF');
      if (eyes === 'sad')
        line(ctx, INK, 0.9, [ex + side * 2.2, ey - 4.4, ex - side * 1.8, ey - 5.8]);
      if (eyes === 'spooky')
        line(ctx, INK, 1.1, [ex + side * 2.4, ey - 5.8, ex - side * 1.8, ey - 3.6]);
    }
  }
  const b = g.blush ?? 0;
  for (const side of [-1, 1])
    oval(ctx, side * 7.4 + lx * 0.6, 0.8 + ly, 2.2 + b, 1.2 + b * 0.3, alpha(BLUSH, 0.5 + b * 0.5));
  const mx = lx,
    my = 2.6 + ly;
  switch (g.mouth ?? 'none') {
    case 'smile':
      line(ctx, INK, 0.9, [mx - 1.8, my, mx, my + 1.3, mx + 1.8, my]);
      break;
    case 'o':
      oval(ctx, mx, my + 0.8, 1.2, 1.6, INK);
      break;
    case 'open':
      oval(ctx, mx, my + 1.6, 2.5, 3.4, INK);
      oval(ctx, mx, my + 3.6, 1.5, 1, '#E27A93');
      break;
    case 'wobble':
      line(ctx, INK, 0.8, at(mx, my, [-2.4, 0.8, -1.2, 0, 0, 0.8, 1.2, 0, 2.4, 0.8]));
      break;
    case 'grin':
      poly(ctx, INK, [mx - 2.6, my, mx + 2.6, my, mx + 1.5, my + 2.4, mx - 1.5, my + 2.4]);
      dot(ctx, mx - 1, my + 1.5, 2, 0.9, '#E27A93');
      break;
  }
}

/** Where the tip of one of Wisp's nubs is, for chains, dusters, and quilts. */
function wispHand(x: number, y: number, g: Ghost, side: -1 | 1) {
  const s = g.size ?? 1,
    squash = g.squash ?? 1;
  const angle = (g.arms ?? [0.35, 0.35])[side < 0 ? 0 : 1];
  return {
    x: x + (side * 9 + side * Math.sin(angle) * 9) * s * squash,
    y: y + (-1 + Math.cos(angle) * 9) * (s / squash),
  };
}

// ——— The family ———
const MUM: Figure = {
  skin: '#B7795A',
  hair: '#2B1D24',
  coat: '#F0C75E',
  legs: '#5577A8',
  shoes: '#4A3434',
  build: 'adult',
  hairStyle: 'short',
};
const DAD: Figure = {
  skin: '#EDBF9B',
  hair: '#8A4A2C',
  coat: '#B4553F',
  legs: '#3F3A4E',
  shoes: '#3A2A26',
  build: 'adult',
  hairStyle: 'short',
};
const JUNO: Figure = {
  skin: '#D59C74',
  hair: '#3A2420',
  coat: '#E98C6B',
  legs: '#6C83C4',
  shoes: '#F2F0F4',
  hairStyle: 'pigtails',
};
const PYJAMAS: Partial<Figure> = { coat: '#A9C4F0', legs: '#93B0E4', shoes: '#A9C4F0' };

/**
 * A townsperson plus costume details painted in their own torso space (after facing, size,
 * and lean), with the front arm laid back on top so the details sit under it.
 */
function dressed(
  ctx: Ctx,
  x: number,
  y: number,
  f: Figure,
  detail: (torso: number, top: number) => void,
) {
  person(ctx, x, y, f);
  const adult = f.build === 'adult';
  const leg = adult ? 11 : 6,
    torso = adult ? 13 : 9;
  const swing = f.step === undefined ? 0 : Math.sin(f.step);
  const lift = f.step === undefined ? 0 : Math.abs(Math.cos(f.step));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((f.facing ?? 1) * (f.size ?? 1), f.size ?? 1);
  if (f.sitting) ctx.translate(0, -1);
  ctx.translate(0, f.sitting ? -3 : -leg - lift);
  ctx.rotate(f.lean ?? 0);
  detail(torso, -torso - 11);
  ctx.translate(1, -torso + 2);
  ctx.rotate(-(f.arms ? f.arms[1] : swing * 0.6));
  box(ctx, -1, 0, 2, adult ? 10 : 7, f.coat);
  box(ctx, -1, adult ? 9 : 6, 2, 2, f.skin);
  ctx.restore();
}

/** Mum: short hair and dungarees over a mustard shirt. */
function mum(ctx: Ctx, x: number, y: number, over: Partial<Figure> = {}) {
  const f = { ...MUM, ...over };
  dressed(ctx, x, y, f, (torso) => {
    box(ctx, -4, -torso + 5, 8, torso - 5, f.legs);
    box(ctx, -3, -torso, 1, 5, f.legs);
    box(ctx, 2, -torso, 1, 5, f.legs);
    box(ctx, -1, -torso + 7, 3, 2, mix(f.legs, '#0B0E14', 0.25));
  });
}

/** Dad: a ginger beard and a cosy knitted jumper. */
function dad(ctx: Ctx, x: number, y: number, over: Partial<Figure> = {}) {
  const f = { ...DAD, ...over };
  dressed(ctx, x, y, f, (torso, top) => {
    box(ctx, -4, -torso + 4, 8, 2, '#EAD7B0');
    for (let i = -3; i < 4; i += 2) box(ctx, i, -torso + 4, 1, 1, f.coat);
    box(ctx, -4, -3, 8, 3, mix(f.coat, '#0B0E14', 0.25));
    box(ctx, -1, top + 4, 1, 4, f.hair);
    box(ctx, -1, top + 7, 7, 4, f.hair);
    box(ctx, 0, top + 11, 5, 1, f.hair);
    const mouth = f.mouth ?? 'smile',
      lip = '#5A2A22';
    if (mouth === 'grin') {
      box(ctx, 1, top + 8, 5, 2, lip);
      box(ctx, 2, top + 8, 3, 1, '#FFFFFF');
    } else if (mouth === 'open' || mouth === 'o')
      box(ctx, 2, top + 8, 2, mouth === 'o' ? 2 : 3, lip);
    else if (mouth === 'frown') {
      box(ctx, 2, top + 9, 1, 1, lip);
      box(ctx, 3, top + 8, 2, 1, lip);
    } else if (mouth !== 'none') box(ctx, 2, top + 9, 3, 1, lip);
  });
}

/** Juno: pigtails with pink ties; starry pyjamas at night. */
function juno(ctx: Ctx, x: number, y: number, over: Partial<Figure> = {}, pyjamas = false) {
  const f = { ...JUNO, ...(pyjamas ? PYJAMAS : {}), ...over };
  dressed(ctx, x, y, f, (torso, top) => {
    box(ctx, -8, top + 3, 3, 1, '#F27FA0');
    box(ctx, 5, top + 3, 3, 1, '#F27FA0');
    if (pyjamas)
      for (const [dx, dy] of [
        [-2, 2],
        [1, 5],
        [-1, 7],
        [2, 1],
      ])
        box(ctx, dx, -torso + dy, 1, 1, '#FFFFFF');
    else box(ctx, -2, -torso, 5, 2, '#FFFFFF');
  });
}
/** Moonlight cools skin a little. */
const moonlit = (skin: string, amount: number) => mix(skin, '#8C98C8', 0.3 * amount);

// ——— Biscuit, who can see ghosts ———
type Pup = {
  facing?: 1 | -1;
  pose?: 'stand' | 'sit' | 'jump';
  wag?: number;
  tongue?: boolean;
  size?: number;
  step?: number;
  eyes?: 'open' | 'happy' | 'closed';
};
const PUP = { coat: '#D9A35E', dark: '#A9713D', belly: '#F3D6A4' };
function biscuit(ctx: Ctx, x: number, y: number, seconds: number, d: Pup = {}) {
  const s = d.size ?? 1;
  shade(ctx, x, y, 24 * s, 0.25);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((d.facing ?? 1) * s, s);
  const wag = Math.sin(seconds * 16 * (d.wag ?? 1));
  const pose = d.pose ?? 'stand';
  const head = (hx: number, hy: number) => {
    oval(ctx, hx, hy, 5.5, 5, PUP.coat);
    box(ctx, hx + 3, hy - 1, 6, 4, PUP.belly);
    box(ctx, hx + 8, hy - 1, 2, 2, INK);
    const eyes = d.eyes ?? 'open';
    if (eyes === 'happy') line(ctx, INK, 1, [hx + 1, hy - 1, hx + 2, hy - 2.2, hx + 3, hy - 1]);
    else if (eyes === 'closed') box(ctx, hx + 1, hy - 2, 2, 1, INK);
    else box(ctx, hx + 2, hy - 3, 1, 2, INK);
    oval(ctx, hx - 2.5, hy + 1, 2.5, 5, PUP.dark, 0.25 + wag * 0.08);
    box(ctx, hx - 5, hy + 4, 5, 2, '#D65A5A');
    disc(ctx, hx - 2.5, hy + 6.5, 1, '#F2C94C');
    if (d.tongue) box(ctx, hx + 6, hy + 3, 2, 3 + (wag > 0 ? 1 : 0), '#E8707E');
  };
  if (pose === 'sit') {
    line(ctx, PUP.coat, 2.5, [-8, -2, -13, -3 - wag * 2]);
    oval(ctx, -3, -6, 7, 6, PUP.coat);
    box(ctx, 1, -9, 3, 9, PUP.dark);
    oval(ctx, 3, -12, 5.5, 7.5, PUP.coat);
    oval(ctx, 5, -9, 3, 4, PUP.belly);
    box(ctx, 5, -8, 3, 8, PUP.coat);
    head(6, -21);
  } else {
    if (pose === 'jump') {
      ctx.translate(-8, 0);
      ctx.rotate(-0.65);
      ctx.translate(8, 0);
    }
    const stride = d.step === undefined ? 0 : Math.sin(d.step) * 2;
    line(ctx, PUP.coat, 2.5, [-10, -12, -15, -17 - wag * 3]);
    box(ctx, -9 - stride, -8, 3, 8, PUP.dark);
    box(ctx, 5 + stride, -8, 3, 8, PUP.dark);
    oval(ctx, 0, -11, 11, 5.5, PUP.coat);
    oval(ctx, 1, -8.5, 8, 2.5, PUP.belly);
    box(ctx, -6 + stride, -8, 3, 8, PUP.coat);
    box(ctx, 8 - stride, -8, 3, 8, PUP.coat);
    head(10, -18);
  }
  ctx.restore();
}

// ——— The parlour ———
const FLOOR = 150;
type Room = {
  wall: string;
  stripe: string;
  panel: string;
  trim: string;
  floor: string;
  seam: string;
  rug: string;
  curtain: string;
  stone: string;
  wood: string;
};
const DUSK_ROOM: Room = {
  wall: '#40385C',
  stripe: '#474064',
  panel: '#322A48',
  trim: '#5C517A',
  floor: '#2C2436',
  seam: '#221C2C',
  rug: '#4A2E4C',
  curtain: '#58284A',
  stone: '#504664',
  wood: '#4A3642',
};
const DAY_ROOM: Room = {
  wall: '#A58CA0',
  stripe: '#AE96A8',
  panel: '#7C6276',
  trim: '#CDB9C2',
  floor: '#7C5C4E',
  seam: '#684A3E',
  rug: '#9E5A60',
  curtain: '#8C3C58',
  stone: '#A89CA2',
  wood: '#8A5E48',
};
const HOME_ROOM: Room = {
  wall: '#7C5068',
  stripe: '#86596F',
  panel: '#5C394E',
  trim: '#AE8284',
  floor: '#5A3A36',
  seam: '#48302C',
  rug: '#A4464E',
  curtain: '#8C3C58',
  stone: '#8E7478',
  wood: '#7C4E3C',
};
const darken = (color: string, amount = 0.25) => mix(color, '#0B0E14', amount);

type RoomOptions = {
  outside: (ctx: Ctx) => void;
  dusty?: boolean;
  boxes?: 'stack' | 'open';
  picture?: boolean;
  fire?: number;
  photo?: boolean;
  curtains?: boolean;
  /** The checkers table and chairs; the chair scene moves them out of the way. */
  table?: boolean;
  shelfBox?: boolean;
  board?: number;
};

function parlour(ctx: Ctx, seconds: number, r: Room, o: RoomOptions) {
  box(ctx, 0, 0, W, FLOOR, r.wall);
  for (let x = 4; x < W; x += 16) box(ctx, x, 8, 6, 96, r.stripe);
  for (let x = 12, k = 0; x < W; x += 16, k++)
    for (let y = 18 + (k % 2) * 8; y < 100; y += 16) box(ctx, x, y, 2, 2, r.stripe);
  box(ctx, 0, 0, W, 6, r.trim);
  box(ctx, 0, 6, W, 2, darken(r.wall));
  box(ctx, 0, 104, W, 3, r.trim);
  box(ctx, 0, 107, W, 43, r.panel);
  for (let x = 6; x < W; x += 38) {
    box(ctx, x, 113, 30, 1, darken(r.panel));
    box(ctx, x, 113, 1, 27, darken(r.panel));
    box(ctx, x, 140, 30, 1, mix(r.panel, r.trim, 0.4));
    box(ctx, x + 29, 113, 1, 28, mix(r.panel, r.trim, 0.4));
  }
  box(ctx, 0, 145, W, 5, r.trim);
  box(ctx, 0, FLOOR, W, H - FLOOR, r.floor);
  for (const y of [156, 163, 171]) box(ctx, 0, y, W, 1, r.seam);
  for (let i = 0; i < 14; i++)
    box(ctx, (i * 53 + (i % 3) * 19) % W, 151 + (i % 3) * 7, 1, 5, r.seam);
  oval(ctx, 178, 168, 96, 10, darken(r.rug));
  oval(ctx, 178, 168, 88, 8, r.rug);
  // The window, and whatever the day looks like through it.
  box(ctx, 22, 22, 52, 82, r.trim);
  ctx.save();
  ctx.beginPath();
  ctx.rect(26, 26, 44, 74);
  ctx.clip();
  o.outside(ctx);
  ctx.restore();
  box(ctx, 47, 26, 2, 74, r.trim);
  box(ctx, 26, 60, 44, 2, r.trim);
  box(ctx, 18, 100, 60, 4, r.trim);
  if (o.curtains !== false) curtains(ctx, r, seconds);
  if (o.picture) landscape(ctx, 100, 84);
  // The fireplace, its mantel, and great-aunt somebody in oils above it.
  box(ctx, 124, 95, 72, 55, r.stone);
  box(ctx, 124, 95, 3, 55, mix(r.stone, '#FFFFFF', 0.1));
  oval(ctx, 160, 114, 20, 9, '#1A1320');
  box(ctx, 140, 114, 40, 36, '#1A1320');
  box(ctx, 134, 146, 52, 4, darken(r.stone, 0.35));
  if (o.fire) fire(ctx, seconds, o.fire);
  box(ctx, 118, 90, 84, 5, r.wood);
  box(ctx, 121, 95, 78, 2, darken(r.wood, 0.35));
  candle(ctx, 127, 90, o.fire ?? 0, seconds);
  candle(ctx, 193, 90, o.fire ?? 0, seconds);
  box(ctx, 136, 79, 12, 11, r.wood);
  disc(ctx, 142, 84, 3.5, '#E9DFC8');
  box(ctx, 142, 82, 1, 3, INK);
  portrait(ctx, 160, 50, !!o.dusty);
  if (o.photo) framedPhoto(ctx, 170, 90);
  if (o.dusty) {
    cobweb(ctx, 0, 8, 1, alpha('#B8B0D0', 0.4));
    cobweb(ctx, W, 8, -1, alpha('#B8B0D0', 0.4));
    sheetedChair(ctx, 98, '#6E6690');
  }
  bookshelf(ctx, r, !!o.shelfBox);
  if (o.table !== false) {
    chair(ctx, 200, FLOOR, 1, r.wood);
    chair(ctx, 244, FLOOR, -1, r.wood);
    table(ctx, r);
    board(ctx, o.board ?? 1);
  }
  if (o.boxes === 'stack') {
    crate(ctx, 26, FLOOR, 26, 18);
    crate(ctx, 30, 132, 20, 14);
  } else if (o.boxes === 'open') crate(ctx, 26, FLOOR, 26, 18, true);
}

/**
 * The window's curtains. `edge` is the inner edge of the right-hand one, which Wisp holds
 * aside to peek; `bulge` is a ghost-shaped lump trembling behind it.
 */
function curtains(ctx: Ctx, r: Room, seconds: number, { tremble = 0, bulge = 0, edge = 68 } = {}) {
  const dark = darken(r.curtain, 0.3),
    lit = mix(r.curtain, '#FFFFFF', 0.12);
  poly(ctx, r.curtain, [8, 22, 30, 22, 26, 60, 22, 112, 6, 112]);
  box(ctx, 12, 30, 2, 80, dark);
  box(ctx, 19, 30, 1, 80, lit);
  const t = tremble * Math.sin(seconds * 40) * 0.8;
  poly(ctx, r.curtain, [edge - 4, 22, 92, 22, 94, 112, edge + 4 + t, 112, edge, 60]);
  if (bulge > 0) oval(ctx, 80 + t, 74, 14 * bulge, 17 * bulge, r.curtain);
  box(ctx, edge, 30, 2, 80, lit);
  box(ctx, 78 + t * bulge, 30, 2, 80, dark);
  box(ctx, 86, 30, 1, 80, lit);
  box(ctx, 4, 16, 92, 8, dark);
  for (let x = 4; x < 94; x += 10) oval(ctx, x + 5, 24, 5, 3, r.curtain);
  box(ctx, 2, 14, 96, 3, r.trim);
}
function landscape(ctx: Ctx, x: number, y: number) {
  box(ctx, x, y, 22, 16, '#C9A24E');
  box(ctx, x + 2, y + 2, 18, 12, '#A8CBE0');
  box(ctx, x + 2, y + 9, 18, 5, '#7FA86A');
  poly(ctx, '#6E9660', [x + 2, y + 10, x + 8, y + 6, x + 13, y + 10]);
  disc(ctx, x + 15, y + 5, 2, '#F6E3A0');
}
function fire(ctx: Ctx, seconds: number, amount: number) {
  glow(ctx, 160, 138, 70, '#FF9A4A', 0.4 * amount);
  box(ctx, 146, 142, 28, 4, '#4A2A22');
  for (let i = 0; i < 5; i++) {
    const x = 148 + i * 6,
      h = 10 + Math.sin(seconds * 7 + i * 1.9) * 3 + (i % 2) * 4;
    poly(ctx, i % 2 ? '#F2A13A' : '#E8663A', [x - 4, 144, x, 144 - h, x + 4, 144]);
    poly(ctx, '#FFD27A', [x - 2, 144, x, 144 - h * 0.5, x + 2, 144]);
  }
}
function candle(ctx: Ctx, x: number, y: number, lit: number, seconds: number) {
  box(ctx, x - 2, y - 3, 4, 3, '#B8904A');
  box(ctx, x - 1, y - 9, 2, 6, '#F4EEDC');
  if (lit > 0) {
    glow(ctx, x, y - 11, 14, '#FFD27A', 0.5 * lit);
    oval(ctx, x + Math.sin(seconds * 6 + x) * 0.3, y - 11, 1, 2, '#FFE9A8');
  }
}
function portrait(ctx: Ctx, x: number, y: number, dusty: boolean) {
  oval(ctx, x, y, 15, 19, '#B8904A');
  oval(ctx, x, y, 12.5, 16.5, '#34402F');
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, 12.5, 16.5, 0, 0, TAU);
  ctx.clip();
  oval(ctx, x, y - 9, 5.5, 5, '#A49CAA');
  disc(ctx, x, y - 15, 3, '#A49CAA');
  oval(ctx, x, y - 3, 4, 5, '#E6C6A6');
  poly(ctx, '#2E2436', [x - 12, y + 17, x - 8, y + 5, x + 8, y + 5, x + 12, y + 17]);
  box(ctx, x - 2, y + 2, 4, 4, '#EDE6DA');
  box(ctx, x - 2, y - 4, 1, 1, INK);
  box(ctx, x + 1, y - 4, 1, 1, INK);
  box(ctx, x - 1, y, 3, 1, '#8A4E50');
  if (dusty) oval(ctx, x, y, 12.5, 16.5, alpha('#B8B0C8', 0.35));
  ctx.restore();
}
function cobweb(ctx: Ctx, x: number, y: number, flip: number, color: string) {
  const at = (a: number, r: number) => [x + flip * Math.cos(a) * r, y + Math.sin(a) * r];
  for (const a of [0.15, 0.6, 1.05, 1.45]) line(ctx, color, 0.5, [x, y, ...at(a, 18)]);
  for (const r of [7, 13])
    line(ctx, color, 0.5, [
      ...at(0.15, r),
      ...at(0.6, r * 0.9),
      ...at(1.05, r),
      ...at(1.45, r * 0.9),
    ]);
}
/** An armchair under a dust sheet: the only other ghost in the house. */
function sheetedChair(ctx: Ctx, x: number, color: string) {
  poly(ctx, color, at(x, 0, [-16, 150, -18, 128, -13, 110, 7, 107, 13, 118, 18, 128, 17, 150]));
  line(ctx, darken(color, 0.2), 1, [x - 8, 116, x - 10, 148]);
  line(ctx, darken(color, 0.2), 1, [x + 5, 121, x + 8, 148]);
  line(ctx, mix(color, '#FFFFFF', 0.15), 1, [x - 12, 112, x + 6, 109]);
}
function chair(ctx: Ctx, x: number, y: number, facing: 1 | -1, wood: string, tilt = 0) {
  // (x, y) is where the legs meet the floor; the back rises on the side away from the table.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(facing, 1);
  const dark = darken(wood, 0.3);
  box(ctx, 5, -15, 2, 15, dark);
  box(ctx, -7, -34, 2, 34, wood);
  box(ctx, -8, -36, 4, 3, mix(wood, '#FFFFFF', 0.1));
  box(ctx, -6, -28, 2, 1, dark);
  box(ctx, -8, -17, 16, 3, wood);
  box(ctx, -8, -19, 16, 2, '#8E3B4E');
  box(ctx, 2, -15, 2, 15, wood);
  ctx.restore();
}
const TABLE_X = 222;
function table(ctx: Ctx, r: Room) {
  box(ctx, TABLE_X - 2, 123, 4, 24, r.wood);
  box(ctx, TABLE_X - 9, 146, 18, 3, r.wood);
  box(ctx, TABLE_X - 21, 121, 42, 3, darken(r.wood));
  oval(ctx, TABLE_X, 121, 21, 3, mix(r.wood, '#FFFFFF', 0.08));
}
type Piece = {
  col: number;
  row: number;
  red: boolean;
  to?: readonly [number, number];
  at?: number;
};
const PIECES: readonly Piece[] = [
  { col: 0, row: 0, red: true },
  { col: 2, row: 0, red: true },
  { col: 1, row: 1, red: true, to: [2, 1], at: MOVES[1] },
  { col: 5, row: 0, red: false },
  { col: 4, row: 0, red: false, to: [3, 1], at: MOVES[0] },
  { col: 5, row: 1, red: false },
];
/** The board, with each piece hopping to its new square as the game goes on. */
function board(ctx: Ctx, p: number) {
  const x0 = TABLE_X - 15,
    y0 = 114;
  for (let c = 0; c < 6; c++)
    for (let row = 0; row < 2; row++)
      box(ctx, x0 + c * 5, y0 + row * 3, 5, 3, (c + row) % 2 ? '#2E2638' : '#D9C8B0');
  for (const row of [0, 1])
    for (const piece of PIECES) {
      const t = piece.to && piece.at ? ease(span(p, piece.at - 0.005, piece.at)) : 0;
      const col = piece.to ? lerp(piece.col, piece.to[0], t) : piece.col;
      const r = piece.to ? lerp(piece.row, piece.to[1], t) : piece.row;
      if (Math.round(r) !== row) continue;
      const px = x0 + col * 5 + 2.5,
        py = y0 + r * 3 + 1.2 - Math.sin(t * Math.PI) * 5;
      oval(ctx, px, py + 0.7, 2, 1, '#1A1420');
      oval(ctx, px, py, 2, 1, piece.red ? '#D8505A' : '#5A4E6A');
    }
}
function bookshelf(ctx: Ctx, r: Room, boxOnTop: boolean) {
  box(ctx, 254, 42, 54, 108, r.wood);
  box(ctx, 258, 46, 46, 100, darken(r.wood, 0.4));
  const colors = ['#8E3B4E', '#3E5A7A', '#C9A24E', '#5E7A52', '#7A5A8E', '#B8664A'];
  [84, 106, 128, 146].forEach((base, s) => {
    let x = 259,
      i = s * 17;
    while (x < 300) {
      const w = 3 + Math.floor(rand(i) * 3),
        h = 12 + Math.floor(rand(i * 3 + 1) * 7);
      if (x + w > 303) break;
      box(ctx, x, base - h, w, h, mix(colors[i % colors.length], r.wall, 0.25));
      x += w + (rand(i * 7) < 0.2 ? 3 : 0);
      i++;
    }
  });
  for (const y of [62, 84, 106, 128]) box(ctx, 256, y, 50, 3, r.wood);
  box(ctx, 294, 52, 5, 10, '#7A9AB0');
  box(ctx, 295, 50, 3, 2, '#7A9AB0');
  if (boxOnTop) crate(ctx, 266, 62, 18, 13);
}
function crate(ctx: Ctx, x: number, bottom: number, w: number, h: number, open = false) {
  box(ctx, x, bottom - h, w, h, '#C99A62');
  box(ctx, x, bottom - h, w, 2, '#B08450');
  box(ctx, x + w / 2 - 2, bottom - h, 4, h, '#E4CFA0');
  if (open) {
    const top = bottom - h;
    poly(ctx, '#B08450', at(x, top, [0, 0, -6, -5, 3, -3]));
    poly(ctx, '#B08450', at(x + w, top, [0, 0, 6, -5, -3, -3]));
    box(ctx, x + 2, top, w - 4, 2, '#5A3E2A');
  }
}
function framedPhoto(ctx: Ctx, x: number, y: number) {
  // (x, y) is the middle of the frame's foot, standing on the mantel.
  box(ctx, x - 14, y - 21, 28, 21, '#C9A24E');
  box(ctx, x - 12, y - 19, 24, 17, '#E9D2B0');
  box(ctx, x - 12, y - 19, 24, 11, '#CDB0C8');
  box(ctx, x - 2, y - 17, 5, 9, '#A84A5A');
  box(ctx, x - 12, y - 8, 24, 6, '#B89A88');
  const figure = (fx: number, top: number, coat: string, skin: string, hair: string) => {
    box(ctx, fx - 1.5, top + 3, 3, y - 4 - top - 3, coat);
    box(ctx, fx - 1.5, top, 3, 3, skin);
    box(ctx, fx - 1.5, top - 1, 3, 1, hair);
  };
  figure(x - 8, y - 16, DAD.coat, DAD.skin, DAD.hair);
  figure(x - 4, y - 16, MUM.legs, MUM.skin, MUM.hair);
  figure(x + 1, y - 13, JUNO.coat, JUNO.skin, JUNO.hair);
  box(ctx, x - 3, y - 5, 4, 2, PUP.coat);
  // ...and a faint smudge beside Juno that nobody can explain.
  disc(ctx, x + 6, y - 11, 3, alpha('#FFFFFF', 0.7));
  box(ctx, x + 5, y - 12, 1, 1, alpha(INK, 0.5));
  box(ctx, x + 7, y - 12, 1, 1, alpha(INK, 0.5));
}
function sunbeam(ctx: Ctx, seconds: number) {
  poly(ctx, alpha('#FFF1CC', 0.12), [26, 26, 70, 26, 196, 150, 118, 150]);
  for (let i = 0; i < 14; i++) {
    const t = (seconds * 0.04 + rand(i + 3)) % 1;
    box(ctx, 40 + rand(i * 3) * 90 + t * 30, 36 + t * 100, 1, 1, alpha('#FFF4D6', 0.6));
  }
}

// Views through the parlour window.
function duskView(ctx: Ctx) {
  box(ctx, 26, 26, 44, 24, '#3A2A58');
  box(ctx, 26, 50, 44, 20, '#5E3E72');
  box(ctx, 26, 70, 44, 30, '#8A527E');
  disc(ctx, 58, 40, 6, '#F4EEDC');
  poly(ctx, '#241B38', [26, 88, 40, 82, 58, 86, 70, 80, 70, 100, 26, 100]);
}
function dayView(ctx: Ctx) {
  box(ctx, 26, 26, 44, 34, '#B9D2E6');
  box(ctx, 26, 60, 44, 16, '#D5E0E6');
  poly(ctx, '#9DB592', [26, 78, 40, 72, 58, 76, 70, 70, 70, 100, 26, 100]);
  box(ctx, 26, 86, 44, 14, '#86A676');
}
function eveningView(ctx: Ctx) {
  box(ctx, 26, 26, 44, 40, '#1C2046');
  box(ctx, 26, 66, 44, 34, '#2A2C58');
  for (let i = 0; i < 8; i++) box(ctx, 28 + ((i * 17) % 40), 30 + ((i * 11) % 30), 1, 1, '#FFF3D6');
  poly(ctx, '#141632', [26, 88, 40, 82, 58, 86, 70, 80, 70, 100, 26, 100]);
}

// ——— The house on the hill ———
type Outside = {
  sky: readonly string[];
  far: string;
  hill: string;
  path: string;
  wall: string;
  side: string;
  roof: string;
  trim: string;
  glass: string;
  tree: string;
  night: boolean;
};
const DUSK_EXT: Outside = {
  sky: ['#2C2248', '#4E3468', '#7F4C7E', '#B46C86'],
  far: '#3B2B55',
  hill: '#241B38',
  path: '#3A2E4C',
  wall: '#56486E',
  side: '#453A5C',
  roof: '#2E2442',
  trim: '#7E6E9C',
  glass: '#231B36',
  tree: '#1C1428',
  night: true,
};
const DAY_EXT: Outside = {
  sky: ['#9CC0E0', '#B9D2E6', '#D9E2E6'],
  far: '#9DB592',
  hill: '#86A676',
  path: '#C2A986',
  wall: '#9C8DAE',
  side: '#86789A',
  roof: '#5C4C70',
  trim: '#DCD2E4',
  glass: '#56647E',
  tree: '#5E4E4E',
  night: false,
};
const NIGHT_EXT: Outside = {
  sky: ['#0C1030', '#161E48', '#22305E'],
  far: '#141A3A',
  hill: '#0D1228',
  path: '#1C2240',
  wall: '#2B3358',
  side: '#232A4A',
  roof: '#171B34',
  trim: '#46527E',
  glass: '#12162E',
  tree: '#090C1C',
  night: true,
};
const hillY = (x: number) => 128 + ((x - 186) / 140) ** 2 * 30;

function exterior(ctx: Ctx, seconds: number, e: Outside, { parlour = 0, sway = 1, peek = 0 } = {}) {
  sky(ctx, e.sky, 0, 134);
  if (e.night) {
    starfield(ctx, seconds, { count: 34, seed: 9, bottom: 96, colors: ['#FFF3D6', '#C8B6FF'] });
    glow(ctx, 262, 34, 70, '#F4E8FF', 0.3);
    disc(ctx, 262, 34, 13, '#F6F0E0');
    disc(ctx, 257, 30, 2.6, '#E2D9C6');
    disc(ctx, 266, 39, 1.8, '#E2D9C6');
  } else glow(ctx, 290, 6, 110, '#FFF4D8', 0.5);
  poly(
    ctx,
    e.far,
    [0, 118, 36, 106, 84, 112, 126, 102, 176, 110, 236, 98, 282, 106, 320, 100, 320, 140, 0, 140],
  );
  const ridge: number[] = [];
  for (let x = 0; x <= W; x += 16) ridge.push(x, hillY(x));
  poly(ctx, e.hill, [...ridge, W, H, 0, H]);
  poly(ctx, e.path, [180, 129, 192, 129, 206, 150, 196, 180, 160, 180, 180, 150]);
  tree(ctx, seconds, e.tree, sway);
  house(ctx, e, parlour, peek);
  const fence = e.night ? e.side : e.trim;
  for (let x = 228; x < W; x += 7) box(ctx, x, hillY(x) - 3, 2, 9, fence);
  line(ctx, fence, 1, [228, hillY(228) + 1, 274, hillY(274) + 1, 320, hillY(320) + 1]);
}
function tree(ctx: Ctx, seconds: number, color: string, sway: number) {
  const s = Math.sin(seconds * 1.3) * sway,
    s2 = Math.sin(seconds * 1.7 + 1) * sway;
  poly(ctx, color, [104, 140, 122, 140, 118, 104, 116, 76, 112, 76, 110, 104]);
  line(ctx, color, 4, [113, 98, 100, 82, 92 + s, 66]);
  line(ctx, color, 2, [100, 82, 86 + s, 78]);
  line(ctx, color, 2, [92 + s, 66, 86 + s, 58]);
  line(ctx, color, 3, [115, 80, 118 + s * 0.5, 58, 112 + s, 44]);
  line(ctx, color, 2, [118 + s * 0.5, 60, 128 + s, 48]);
  // The long branch that reaches for the attic window.
  line(ctx, color, 3, [116, 88, 136, 74, 154 + s2, 64, 170 + s2 * 1.5, 57]);
  line(ctx, color, 1.5, [170 + s2 * 1.5, 57, 177 + s2 * 2, 50]);
  line(ctx, color, 1.5, [170 + s2 * 1.5, 57, 178 + s2 * 2, 59]);
  line(ctx, color, 1.5, [154 + s2, 64, 158 + s2, 53]);
}
function house(ctx: Ctx, e: Outside, parlour: number, peek: number) {
  const cx = 186;
  // The tower.
  box(ctx, 226, 60, 24, 68, e.side);
  poly(ctx, e.roof, [222, 62, 238, 22, 254, 62]);
  box(ctx, 237, 14, 2, 10, e.trim);
  box(ctx, 232, 72, 12, 16, e.glass);
  box(ctx, 237, 72, 2, 16, e.trim);
  // Chimney, then the main block under its steep gable.
  box(ctx, 204, 40, 9, 24, e.side);
  box(ctx, 202, 38, 13, 3, e.trim);
  box(ctx, 146, 74, 82, 54, e.wall);
  for (let y = 78; y < 128; y += 5) box(ctx, 146, y, 82, 1, e.side);
  box(ctx, 146, 74, 5, 54, e.side);
  poly(ctx, e.roof, [138, 76, cx, 34, 236, 76]);
  line(ctx, e.trim, 2, [138, 76, cx, 34, 236, 76]);
  disc(ctx, cx, 56, 8, e.trim);
  disc(ctx, cx, 56, 6, e.glass);
  box(ctx, cx - 6, 55, 12, 1, e.trim);
  box(ctx, cx - 1, 50, 1, 12, e.trim);
  for (const x of [156, 202]) {
    box(ctx, x - 1, 81, 16, 14, e.trim);
    box(ctx, x + 1, 83, 12, 10, e.glass);
    box(ctx, x + 6, 83, 2, 10, e.trim);
  }
  poly(ctx, e.side, [216, 81, 221, 82, 220, 97, 215, 95]);
  // The porch.
  box(ctx, 150, 99, 74, 4, e.roof);
  box(ctx, 150, 103, 74, 1, e.trim);
  box(ctx, 154, 104, 3, 22, e.trim);
  box(ctx, 217, 104, 3, 22, e.trim);
  box(ctx, 181, 106, 12, 20, e.night ? '#2A1E2E' : '#6E3A48');
  box(ctx, 190, 116, 1, 1, '#E9C46A');
  box(ctx, 159, 107, 16, 14, e.trim);
  box(ctx, 161, 109, 12, 10, parlour ? mix(e.glass, '#CDBEFF', parlour * 0.7) : e.glass);
  if (parlour) {
    // A tiny someone at home, at the parlour window.
    disc(ctx, 166, 113, 2.6, SHEET);
    box(ctx, 163, 113, 6, 4, SHEET);
    box(ctx, 165, 112, 1, 1, INK);
    box(ctx, 167, 112, 1, 1, INK);
  }
  if (peek > 0) {
    // A curtain twitches: two dark eyes in a small pale face.
    disc(ctx, 170, 114, 3.5 * peek, alpha(SHEET, 0.9));
    box(ctx, 168, 113, 1, 2, INK);
    box(ctx, 171, 113, 1, 2, INK);
  }
  box(ctx, 199, 107, 16, 14, e.trim);
  box(ctx, 201, 109, 12, 10, e.glass);
  box(ctx, 148, 125, 78, 3, e.trim);
  box(ctx, 179, 128, 16, 2, e.trim);
  box(ctx, 177, 130, 20, 2, e.side);
  if (parlour) glow(ctx, 167, 114, 26, WISP_GLOW, 0.45 * parlour);
}
function van(ctx: Ctx, x: number, y: number, rolling: number, door = 0) {
  shade(ctx, x, y + 1, 76, 0.3);
  box(ctx, x - 36, y - 40, 48, 32, '#EEE6D6');
  box(ctx, x - 36, y - 40, 48, 2, '#FFFFFF');
  box(ctx, x - 36, y - 22, 48, 4, '#D8694A');
  // A little painted house on the side.
  poly(ctx, '#8C74A8', [x - 20, y - 30, x - 13, y - 36, x - 6, y - 30]);
  box(ctx, x - 18, y - 30, 10, 6, '#8C74A8');
  box(ctx, x - 14, y - 28, 2, 4, '#EEE6D6');
  poly(ctx, '#D8694A', at(x, y, [12, -30, 25, -30, 32, -20, 32, -8, 12, -8]));
  box(ctx, x + 16, y - 27, 10, 8, '#A8CDE0');
  const swing = 14 + door * 9;
  if (door > 0) poly(ctx, '#C75C40', at(x, y, [14, -29, swing, -31, swing, -9, 14, -9]));
  box(ctx, x - 38, y - 10, 72, 4, '#5A5060');
  box(ctx, x + 30, y - 17, 2, 3, '#FFF1B0');
  for (const wx of [x - 24, x + 20]) {
    disc(ctx, wx, y - 5, 6, '#2A2530');
    disc(ctx, wx, y - 5, 2.5, '#9A94A0');
    box(
      ctx,
      wx + Math.cos(rolling * 9) * 2 - 0.5,
      y - 5 + Math.sin(rolling * 9) * 2 - 0.5,
      1,
      1,
      '#2A2530',
    );
  }
}

// ——— The attic bedroom ———
const MOONLIGHT = '#A9BCF0';
const SHADOW = '#0E1128';
function attic(ctx: Ctx, seconds: number, moon: number, warm: number) {
  const wall = mix('#283058', '#5E4C72', warm * 0.7);
  const slope = mix('#1E2448', '#4A3A5E', warm * 0.6);
  const beam = mix('#171B36', '#3A2A40', warm * 0.5);
  const trim = mix('#4A5484', '#9A86A8', warm * 0.5);
  box(ctx, 0, 0, W, 150, wall);
  for (let i = 0; i < 40; i++) {
    const x = 6 + ((i * 47) % 308),
      y = 10 + ((i * 29) % 128);
    box(ctx, x, y, 1, 1, alpha('#E8E0FF', 0.3));
    if (i % 5 === 0) {
      box(ctx, x - 1, y, 3, 1, alpha('#E8E0FF', 0.16));
      box(ctx, x, y - 1, 1, 3, alpha('#E8E0FF', 0.16));
    }
  }
  poly(ctx, slope, [0, 0, 114, 0, 0, 58]);
  poly(ctx, slope, [206, 0, W, 0, W, 58]);
  line(ctx, beam, 3, [0, 58, 114, 0]);
  line(ctx, beam, 3, [206, 0, W, 58]);
  box(ctx, 0, 146, W, 4, beam);
  box(ctx, 0, 150, W, 30, mix('#2A2438', '#4A3440', warm * 0.6));
  for (const y of [157, 165, 174]) box(ctx, 0, y, W, 1, mix('#211C2E', '#3A2832', warm * 0.6));
  oval(ctx, 168, 168, 62, 7, mix('#3C3458', '#8C5A6A', warm * 0.7));
  // The round window, the moon, and the branch that does all the scaring.
  disc(ctx, 80, 60, 18, trim);
  ctx.save();
  ctx.beginPath();
  ctx.arc(80, 60, 15, 0, TAU);
  ctx.clip();
  box(ctx, 64, 44, 32, 32, '#101638');
  box(ctx, 64, 64, 32, 12, '#18204A');
  glow(ctx, 88, 52, 14, '#F4EEDC', 0.5);
  disc(ctx, 88, 52, 5, '#F2EEDC');
  for (let i = 0; i < 5; i++) box(ctx, 67 + i * 6, 47 + ((i * 7) % 12), 1, 1, '#FFF3D6');
  const sway = Math.sin(seconds * 0.9) * 2;
  line(ctx, '#070916', 3, [60, 76, 74, 67, 86 + sway, 59, 97 + sway, 53]);
  line(ctx, '#070916', 1.5, [86 + sway, 59, 90 + sway, 48]);
  line(ctx, '#070916', 1.5, [97 + sway, 53, 99 + sway, 60]);
  ctx.restore();
  box(ctx, 79, 42, 2, 36, trim);
  box(ctx, 62, 59, 36, 2, trim);
  // Moonlight through it lands on the back wall, cross and all.
  faded(ctx, moon, () => {
    oval(ctx, 162, 70, 46, 38, alpha(MOONLIGHT, 0.16));
    box(ctx, 160, 34, 3, 72, alpha(wall, 0.5));
    box(ctx, 118, 69, 88, 3, alpha(wall, 0.5));
  });
  // The door, ajar onto a dark landing.
  box(ctx, 4, 70, 38, 80, trim);
  box(ctx, 8, 74, 30, 76, '#0E0C1A');
  poly(ctx, mix('#3A3A64', '#6A5070', warm * 0.5), [38, 74, 48, 79, 48, 145, 38, 150]);
  disc(ctx, 45, 112, 1.2, '#C9A24E');
}
/**
 * The branch's moon shadow: a limb, a knot with two holes like eyes, and long twiggy claws.
 * `shift` slides it left as warm light floods the wall; `flee` sends it off for good.
 */
function monster(ctx: Ctx, seconds: number, reach: number, flee: number, shift = 0) {
  if (flee >= 1) return;
  const holes = mix('#283058', MOONLIGHT, 0.2);
  const twitch = Math.sin(seconds * 3) * 1;
  faded(ctx, 0.78 * (1 - flee), () => {
    ctx.save();
    ctx.translate(118 - shift - flee * 60, 96 + flee * 14);
    ctx.rotate(Math.sin(seconds * 0.9) * 0.05 - reach * 0.08 + flee * 0.4);
    const grow = 1 + reach * 0.15 - flee * 0.4;
    ctx.scale(grow, grow);
    line(ctx, SHADOW, 7, [-6, 4, 18, -6, 36, -18, 50, -27]);
    line(ctx, SHADOW, 3, [22, -8, 30, -30, 26, -42]);
    line(ctx, SHADOW, 2, [30, -30, 38, -38]);
    oval(ctx, 48, -28, 9, 7, SHADOW);
    line(ctx, SHADOW, 2, [54, -31, 64 + twitch, -46, 69 + twitch, -44]);
    line(ctx, SHADOW, 2, [56, -29, 72 + twitch, -34]);
    line(ctx, SHADOW, 2, [56, -25, 71 + twitch, -18]);
    line(ctx, SHADOW, 2, [52, -22, 59 + twitch, -9]);
    disc(ctx, 45, -30, 1.7, holes);
    disc(ctx, 51, -30, 1.7, holes);
    ctx.restore();
  });
}
/** Shadow puppets on the lit wall: a bunny that hops up to the monster, facing left. */
function bunnyShadow(ctx: Ctx, p: number, color: string) {
  const t = span(p, BUNNY[0], BUNNY[1]);
  const hopAt = HOPS.reduce((best, h) => (p >= h - 0.006 ? h : best), HOPS[0]);
  const hop = Math.sin(clamp((p - hopAt + 0.006) / 0.006) * Math.PI);
  ctx.save();
  ctx.translate(214 - t * 30, 92 - hop * 9);
  ctx.scale(-1.4, 1.4);
  const wiggle = Math.sin(p * 900) * 0.15;
  oval(ctx, 0, 0, 9, 6.5, color);
  disc(ctx, 8, -6, 5, color);
  oval(ctx, 6, -16, 1.8, 7, color, -0.2 + wiggle);
  oval(ctx, 10, -15, 1.8, 7, color, 0.25 - wiggle);
  disc(ctx, -9, -2, 3, color);
  box(ctx, 12, -5, 2, 1, color);
  ctx.restore();
}
/** ...then a bird that flaps straight at it and chases it off the wall. */
function birdShadow(ctx: Ctx, p: number, color: string) {
  const t = ease(span(p, BIRD[0], BIRD[1]));
  const flap = Math.sin(p * 1400);
  ctx.save();
  ctx.translate(198 - t * 92, 76 - Math.sin(t * Math.PI) * 12);
  ctx.scale(1.4, 1.4);
  oval(ctx, 0, 0, 9, 3.5, color);
  disc(ctx, -8, -2, 3.5, color);
  poly(ctx, color, [-11, -3, -16, -1, -11, 0]);
  poly(ctx, color, [7, 0, 16, -5, 15, 3]);
  poly(ctx, color, [-3, -1, 2, -1 - flap * 14, 7, -1]);
  ctx.restore();
}
function bed(ctx: Ctx, dim: number) {
  const wood = mix('#7A5A7E', '#2E3056', dim * 0.5);
  box(ctx, 294, 88, 9, 62, wood);
  disc(ctx, 298, 86, 4, mix(wood, '#FFFFFF', 0.15));
  box(ctx, 210, 114, 7, 36, wood);
  disc(ctx, 213, 112, 3.5, mix(wood, '#FFFFFF', 0.15));
  box(ctx, 216, 128, 80, 10, mix('#E6E0F0', '#8A94C8', dim * 0.4));
  box(ctx, 219, 138, 3, 12, wood);
  box(ctx, 290, 138, 3, 12, wood);
  oval(ctx, 282, 121, 12, 6, mix('#F2EEFA', '#9AA4D8', dim * 0.4));
}
const quiltColor = (dim: number) => mix('#6C58A8', '#2E3466', dim * 0.45);
function quilt(ctx: Ctx, top: number, dim: number, head = 294) {
  box(ctx, 214, top, head - 214, 146 - top, quiltColor(dim));
  for (let i = 0; i < 6; i++)
    box(
      ctx,
      216 + i * 13,
      top + 5 + (i % 2) * 5,
      11,
      8,
      mix(i % 2 ? '#E7A07A' : '#8C78C6', '#2E3466', dim * 0.45),
    );
  box(ctx, 214, top, head - 214, 3, mix('#F0E8F6', '#9AA4D8', dim * 0.4));
}
/** The quilt pulled up to the eyes in two small fists. */
function blanketUp(ctx: Ctx, x: number, top: number, dim: number, tremble = 0) {
  const t = tremble;
  poly(ctx, quiltColor(dim), [x - 24, 130, x - 16 + t, top, x + 14 + t, top, x + 20, 130]);
  box(ctx, x - 16 + t, top, 30, 3, mix('#F0E8F6', '#9AA4D8', dim * 0.4));
  box(ctx, x - 20, top + 10, 11, 8, mix('#E7A07A', '#2E3466', dim * 0.45));
  const skin = moonlit(JUNO.skin, dim);
  box(ctx, x - 11 + t, top - 1, 4, 4, skin);
  box(ctx, x + 3 + t, top - 1, 4, 4, skin);
}
/** Juno asleep, face up on the pillow. */
function sleepingJuno(ctx: Ctx, x: number, y: number, s: number, yawn: number, sleepy: boolean) {
  const skin = moonlit(JUNO.skin, 0.4);
  oval(ctx, x - 8 * s, y - 1 * s, 2.6 * s, 4 * s, JUNO.hair, 0.5);
  oval(ctx, x + 8 * s, y - 1 * s, 2.6 * s, 4 * s, JUNO.hair, -0.5);
  dot(ctx, x - 8 * s, y - 4 * s, 2 * s, 1.2 * s, '#F27FA0');
  dot(ctx, x + 6 * s, y - 4 * s, 2 * s, 1.2 * s, '#F27FA0');
  oval(ctx, x, y - 1 * s, 6.6 * s, 6.4 * s, JUNO.hair);
  oval(ctx, x, y + 1.2 * s, 5.6 * s, 4.8 * s, skin);
  const eye = sleepy ? 1.3 : 0.7;
  dot(ctx, x - 4 * s, y + 0.6 * s, 2.6 * s, eye * s, INK);
  dot(ctx, x + 1.4 * s, y + 0.6 * s, 2.6 * s, eye * s, INK);
  dot(ctx, x - 5 * s, y + 2.4 * s, 2 * s, 1 * s, alpha('#E58A86', 0.7));
  dot(ctx, x + 3 * s, y + 2.4 * s, 2 * s, 1 * s, alpha('#E58A86', 0.7));
  if (yawn > 0.05) oval(ctx, x, y + 3.8 * s, 1.2 * s, 1.7 * s * yawn, INK);
  else dot(ctx, x - 1 * s, y + 3.6 * s, 2 * s, 0.7 * s, INK);
}

// ——— The porch, next morning ———
const MORNING = ['#9ECAE8', '#BFDBEA', '#EEDDC2', '#F6CB9C'];
const TRIPOD_X = 268;
function porch(ctx: Ctx) {
  sky(ctx, MORNING, 0, 162, 0, 44);
  sky(ctx, MORNING, 0, 162, 276, 44);
  oval(ctx, 14, 150, 22, 16, '#5E9A5A');
  oval(ctx, 306, 150, 22, 16, '#5E9A5A');
  box(ctx, 40, 0, 240, 140, '#CDBADC');
  for (let y = 4; y < 140; y += 6) box(ctx, 40, y, 240, 1, '#BCA8CE');
  for (const x of [66, 208]) {
    box(ctx, x - 9, 44, 7, 56, '#8C74A8');
    box(ctx, x + 48, 44, 7, 56, '#8C74A8');
    box(ctx, x - 2, 42, 50, 60, '#F6F0F8');
    box(ctx, x + 2, 46, 42, 52, '#8FB4D0');
    box(ctx, x + 2, 46, 42, 10, '#B8D2E4');
    box(ctx, x + 22, 46, 2, 52, '#F6F0F8');
    box(ctx, x + 2, 71, 42, 2, '#F6F0F8');
    box(ctx, x - 4, 100, 54, 8, '#A0604A');
    for (let i = 0; i < 7; i++) {
      disc(ctx, x + 2 + i * 7, 99 - (i % 2) * 2, 3, ['#F2D06B', '#E8707E', '#F4A0C0'][i % 3]);
      box(ctx, x + 4 + i * 7, 99, 2, 2, '#5E9A5A');
    }
  }
  // The front door, now painted a cheerful red.
  box(ctx, 142, 58, 36, 82, '#F6F0F8');
  box(ctx, 146, 62, 28, 78, '#A84A5A');
  box(ctx, 150, 66, 20, 12, '#F6D9A8');
  for (const [dx, dy, h] of [
    [150, 84, 22],
    [161, 84, 22],
    [150, 110, 24],
    [161, 110, 24],
  ])
    box(ctx, dx, dy, 9, h, '#963E4E');
  disc(ctx, 169, 104, 1.5, '#E9C46A');
  box(ctx, 28, 0, 264, 14, '#6E5A86');
  box(ctx, 28, 14, 264, 3, '#F6F0F8');
  for (const x of [40, 274]) box(ctx, x, 17, 6, 123, '#F6F0F8');
  box(ctx, 30, 138, 260, 6, '#B89A88');
  box(ctx, 30, 138, 260, 1, '#D8C0AE');
  // Lattice under the porch.
  box(ctx, 30, 144, 260, 16, '#8E7486');
  for (let x = 34; x < 290; x += 7) box(ctx, x, 146, 1, 13, '#B49AAC');
  box(ctx, 30, 151, 260, 1, '#B49AAC');
  for (const [x0, x1] of [
    [46, 116],
    [204, 274],
  ]) {
    box(ctx, x0, 112, x1 - x0, 3, '#F6F0F8');
    for (let x = x0 + 4; x < x1; x += 8) box(ctx, x, 115, 2, 23, '#F6F0F8');
  }
  box(ctx, 118, 144, 84, 7, '#A88A78');
  box(ctx, 110, 151, 100, 9, '#98796A');
  box(ctx, 0, 160, W, 20, '#7DB26A');
  for (let i = 0; i < 16; i++) box(ctx, (i * 41) % W, 164 + ((i * 7) % 14), 2, 3, '#6A9E58');
  box(ctx, 144, 136, 32, 2, '#C98A4A');
  glow(ctx, 300, 20, 170, '#FFE2B0', 0.2);
}
function tripod(ctx: Ctx, x: number, y: number, light: number) {
  line(ctx, '#3A3240', 1.5, [x, y - 30, x - 11, y]);
  line(ctx, '#3A3240', 1.5, [x, y - 30, x + 9, y]);
  line(ctx, '#3A3240', 1.5, [x, y - 30, x - 1, y + 2]);
  box(ctx, x - 9, y - 44, 18, 14, '#3A3240');
  box(ctx, x - 15, y - 41, 6, 8, '#2A2530');
  disc(ctx, x - 15, y - 37, 3, '#5A6A80');
  box(ctx, x - 4, y - 47, 7, 3, '#2A2530');
  glow(ctx, x + 5, y - 40, 5, '#FF6A5A', 0.6 * light);
  disc(ctx, x + 5, y - 40, 1.5, mix('#6A2A2A', '#FF7A6A', light));
}
/** The new-home photo: live on the porch, or frozen and developed (where Wisp is a smudge). */
function porchFamily(ctx: Ctx, p: number, seconds: number, photo: boolean) {
  const smile = photo || p > 0.897;
  const face = smile
    ? ({ eyes: 'happy', mouth: 'grin' } as const)
    : ({ eyes: 'open', mouth: 'smile' } as const);
  const run = ease(span(p, RUN[0], RUN[1]));
  if (photo || p >= RUN[1])
    dad(ctx, 124, 140, { size: 1.35, facing: 1, arms: [0.2, 0.6], ...face });
  const pull = photo ? 1 : ease(span(p, PULL_IN[0], PULL_IN[1]));
  const wx = lerp(216, 190, pull),
    wy = lerp(106, 114, pull);
  const g: Ghost = {
    size: 1.05,
    look: pull < 0.5 ? -1 : 0.3,
    eyes: pull < 1 ? 'soft' : 'happy',
    mouth: pull < 1 ? 'none' : 'smile',
    blush: 0.4 + pull * 0.5,
    glow: photo ? 0 : 0.7,
  };
  if (photo) {
    // Ghosts never quite come out in photos: a soft, doubled smudge.
    faded(ctx, 0.22, () => wisp(ctx, wx - 1.2, wy + 0.6, 0.4, g));
    faded(ctx, 0.22, () => wisp(ctx, wx + 1.2, wy - 0.4, 0.4, g));
    faded(ctx, 0.3, () => wisp(ctx, wx, wy, 0.4, g));
  } else wisp(ctx, wx, wy + bob(seconds), seconds, g);
  mum(ctx, 148, 140, { size: 1.35, facing: 1, arms: [0.2, 0.5], ...face });
  juno(ctx, 170, 142, {
    size: 1.45,
    facing: 1,
    arms: [0.3, lerp(0.3, 2.05, pull)],
    ...(smile ? face : { eyes: 'open', mouth: pull > 0 ? 'grin' : 'smile' }),
  });
  biscuit(ctx, 160, 154, photo ? 0.3 : seconds, {
    pose: 'sit',
    size: 1.2,
    tongue: true,
    eyes: smile ? 'happy' : 'open',
    wag: photo ? 0 : 1,
  });
  if (photo) return;
  // Dad sets the timer, then sprints for his place.
  const behind = TRIPOD_X + 16;
  if (p < RUN[0])
    dad(ctx, behind, 176, {
      size: 1.35,
      facing: -1,
      lean: 0.35,
      arms: [1.4, 1.6],
      eyes: 'closed',
      mouth: 'flat',
    });
  else if (p < RUN[1])
    dad(ctx, lerp(behind, 124, run), lerp(176, 140, run), {
      size: 1.35,
      facing: -1,
      step: seconds * 20,
      arms: [2.4 + Math.sin(seconds * 20), 2.4 - Math.sin(seconds * 20)],
      eyes: 'wide',
      mouth: 'open',
    });
}

// ——— Screen-space extras ———
/** Where a world point lands on screen under `view` (the same clamping as the kit's camera). */
function screenOf(view: View, x: number, y: number) {
  const hw = W / 2 / view.zoom,
    hh = H / 2 / view.zoom;
  const cx = clamp(view.x, hw, W - hw),
    cy = clamp(view.y, hh, H - hh);
  return { x: W / 2 + (x - cx) * view.zoom, y: H / 2 + (y - cy) * view.zoom };
}
/** A small speech bubble whose tail points down at (x, y). */
function say(ctx: Ctx, text: string, x: number, y: number, amount: number, size = 9) {
  if (amount <= 0) return;
  faded(ctx, amount, () => {
    ctx.font = font('italic', size);
    const w = Math.ceil(ctx.measureText(text).width) + 10,
      h = size + 6;
    const left = Math.round(x - w / 2),
      top = Math.round(y - h - 5);
    box(ctx, left + 2, top, w - 4, h, '#FFF8EE');
    box(ctx, left, top + 2, w, h - 4, '#FFF8EE');
    poly(ctx, '#FFF8EE', [x - 3, top + h - 1, x + 3, top + h - 1, x, y]);
    write(ctx, text, x, top + h - 4, { size, type: 'italic', color: INK });
  });
}

// ——— Shots ———
type Scene = (ctx: Ctx, p: number, seconds: number) => void;
const DUSK_VIGNETTE = '#120E20',
  NIGHT_VIGNETTE = '#05060F';

const duskHouse: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0, 172, 92, 1.04],
      [0.03, 168, 108, 1.5],
    ]),
    () => exterior(ctx, seconds, DUSK_EXT, { parlour: 1 }),
  );
  vignette(ctx, 0.5, DUSK_VIGNETTE);
};

const checkersShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.03, 222, 116, 2.4],
      [0.075, 222, 114, 2.55],
    ]),
    () => {
      parlour(ctx, seconds, DUSK_ROOM, { outside: duskView, dusty: true, table: false });
      chair(ctx, 200, FLOOR, 1, DUSK_ROOM.wood);
      chair(ctx, 244, FLOOR, -1, DUSK_ROOM.wood);
      const cross = span(p, CROSS[0], CROSS[1]);
      const x = lerp(246, 198, ease(cross)),
        y = 118 - Math.sin(cross * Math.PI) * 22 + bob(seconds);
      const reach = (at: number) => hump(p, at - 0.008, at + 0.002) * 1.3;
      let g: Ghost;
      if (p < CROSS[0])
        g =
          p < MOVES[0]
            ? { look: -1, lookY: 1.5, arms: [0.35 + reach(MOVES[0]), 0.35] }
            : { look: -1, eyes: 'happy', mouth: 'grin', arms: [0.35, 0.9] };
      else if (p < CROSS[1])
        g = { look: -1, mouth: 'o', tilt: -Math.sin(cross * Math.PI) * 0.4, arms: [1.3, 1.3] };
      else if (p < 0.06) g = { look: 1, lookY: 1, eyes: 'wide', mouth: 'o', blush: 0.4 };
      else if (p < MOVES[1]) g = { look: 1, lookY: 1.5, arms: [0.35, 0.35 + reach(MOVES[1])] };
      else g = { look: 1, eyes: 'happy', mouth: 'grin', arms: [0.9, 0.35] };
      wisp(ctx, x, y, seconds, g);
      table(ctx, DUSK_ROOM);
      board(ctx, p);
    },
  );
  vignette(ctx, 0.55, DUSK_VIGNETTE);
};

const portraitShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.075, 168, 60, 2.7],
      [0.094, 166, 62, 2.7],
      [0.11, 172, 98, 1.08],
    ]),
    () => {
      parlour(ctx, seconds, DUSK_ROOM, { outside: duskView, dusty: p < 0.09 });
      const dusting = p < 0.093;
      const drift = ease(span(p, 0.097, 0.11));
      const x = lerp(188, 180, drift),
        y = lerp(58, 82, drift) + bob(seconds);
      const swish = Math.sin(((p - 0.079) / 0.008) * TAU);
      const g: Ghost = dusting
        ? { look: -1, eyes: 'happy', mouth: 'smile', arms: [2.1 + swish * 0.35, 0.4] }
        : p < 0.097
          ? { look: -0.4, lookY: 0.5, eyes: 'soft', arms: [0.3, 0.3] }
          : { look: -0.6, lookY: 1, eyes: 'sad', arms: [0.15, 0.15] };
      wisp(ctx, x, y, seconds, g);
      if (dusting) featherDuster(ctx, wispHand(x, y, g, -1), swish);
      for (const d of DUSTS) {
        const t = span(p, d, d + 0.012);
        if (t > 0 && t < 1)
          for (let i = 0; i < 5; i++)
            box(
              ctx,
              162 + (rand(i + d * 100) - 0.5) * 24 - t * 6,
              48 + (rand(i * 3 + d * 100) - 0.5) * 20 - t * 8 * (1 + i * 0.3),
              1,
              1,
              alpha('#D8D0E8', 1 - t),
            );
      }
    },
  );
  vignette(ctx, 0.55, DUSK_VIGNETTE);
};
function featherDuster(ctx: Ctx, hand: { x: number; y: number }, swish: number) {
  const a = -2.6 + swish * 0.3,
    ex = hand.x + Math.cos(a) * 9,
    ey = hand.y + Math.sin(a) * 9;
  line(ctx, '#8A5E48', 1.2, [hand.x, hand.y, ex, ey]);
  for (let i = 0; i < 5; i++) {
    const f = a + (i - 2) * 0.35;
    oval(ctx, ex + Math.cos(f) * 3, ey + Math.sin(f) * 3, 3, 1.4, i % 2 ? '#E9A6C4' : '#B7A6E8', f);
  }
}

const LANE = 158;
const vanShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.12, 166, 120, 1.5],
      [0.16, 176, 120, 1.55],
    ]),
    () => {
      exterior(ctx, seconds, DAY_EXT, { peek: hump(p, 0.146, 0.16) });
      box(ctx, 0, LANE - 10, W, 16, '#B8A084');
      box(ctx, 0, LANE - 10, W, 2, '#A48C70');
      box(ctx, 0, LANE - 3, W, 1, '#A48C70');
      box(ctx, 0, LANE + 4, W, 2, '#9C8468');
      const arrive = span(p, 0.12, VAN_STOP);
      const vx = lerp(-40, 106, easeOut(arrive));
      // They hop out of the cab and head up to the house, spread out along the lane.
      const walked = (start: number, speed: number) => Math.max(0, p - start) * speed;
      if (p > DOORS + 0.002) {
        const f: Partial<Figure> = { size: 1.3, facing: 1, step: seconds * 11, arms: [1.6, 1.6] };
        const x = 144 + walked(DOORS + 0.002, 2600);
        dad(ctx, x, LANE, f);
        const hand = handOf(x, LANE, { ...DAD, ...f });
        crate(ctx, hand.x - 10, hand.y + 4, 18, 13);
      }
      if (p > 0.143) {
        const f: Partial<Figure> = {
          size: 1.3,
          facing: 1,
          step: seconds * 11 + 1,
          arms: [0.3, 1.4],
        };
        const x = 140 + walked(0.143, 2000);
        mum(ctx, x, LANE, f);
        const hand = handOf(x, LANE, { ...MUM, ...f });
        box(ctx, hand.x - 1, hand.y - 14, 2, 14, '#6A5A60');
        poly(ctx, '#F2D06B', at(hand.x, hand.y, [-6, -14, 6, -14, 4, -21, -4, -21]));
      }
      if (p > 0.148) {
        const f: Partial<Figure> = { size: 1.4, facing: 1, step: seconds * 13, arms: [0.3, 1.2] };
        const x = 138 + walked(0.148, 1500);
        juno(ctx, x, LANE + 1, { ...f, mouth: 'grin' });
        const hand = handOf(x, LANE + 1, { ...JUNO, ...f });
        disc(ctx, hand.x + 2, hand.y - 2, 3.5, '#B07A52');
        disc(ctx, hand.x + 2, hand.y - 7, 2.8, '#B07A52');
        disc(ctx, hand.x, hand.y - 9, 1.2, '#B07A52');
        disc(ctx, hand.x + 4, hand.y - 9, 1.2, '#B07A52');
      }
      if (p > 0.141)
        biscuit(ctx, 140 + walked(0.141, 4400), LANE + 2, seconds, {
          step: seconds * 18,
          tongue: true,
          size: 1.2,
        });
      van(ctx, vx, LANE + 2, arrive < 1 ? p * 300 : VAN_STOP * 300, span(p, DOORS, DOORS + 0.004));
      if (arrive < 1)
        for (let i = 0; i < 3; i++)
          disc(ctx, vx - 40 - i * 7, LANE - 5 - i * 2, 2 + i, alpha('#E8E2DA', 0.5 - i * 0.12));
    },
  );
  vignette(ctx, 0.3);
};

/** The yard through the window: the van parked and the first boxes going in. */
function yard(ctx: Ctx, p: number, seconds: number) {
  dayView(ctx);
  ctx.save();
  ctx.translate(38, 94);
  ctx.scale(0.4, 0.4);
  van(ctx, 0, 0, 0);
  ctx.restore();
  const t = span(p, 0.16, 0.2);
  dad(ctx, 26 + t * 10, 99, { size: 0.5, facing: 1, step: seconds * 10, arms: [1.6, 1.6] });
  crate(ctx, 27 + t * 10, 88, 7, 5);
  juno(ctx, 36 + t * 8, 99, { size: 0.5, facing: 1, step: seconds * 12 });
}

const peekShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.16, 66, 66, 2.3],
      [0.2, 64, 68, 2.4],
    ]),
    () => {
      parlour(ctx, seconds, DAY_ROOM, {
        outside: (c) => yard(c, p, seconds),
        curtains: false,
        boxes: 'stack',
      });
      // She holds the curtain aside to peek, gasps, and whips back behind it.
      const slide = easeOut(span(p, 0.161, 0.169)),
        hide = easeIn(span(p, HIDE, HIDE + 0.004));
      const x = lerp(lerp(80, 58, slide), 80, hide);
      const jolt = hump(p, GASP - 0.002, GASP + 0.006) * 5;
      const gasped = p >= GASP;
      if (p < HIDE + 0.004)
        wisp(ctx, x, 72 - jolt + bob(seconds), seconds, {
          size: 1.1,
          look: -1,
          lookY: gasped ? 0 : 0.5,
          eyes: gasped ? 'wide' : 'open',
          mouth: gasped ? 'o' : 'none',
          blush: gasped ? 1 : 0.2,
          arms: [0.4, 1.3],
          squash: 1 - hide * 0.15,
        });
      curtains(ctx, DAY_ROOM, seconds, {
        tremble: span(p, HIDE + 0.004, HIDE + 0.006),
        bulge: ease(span(p, HIDE + 0.002, HIDE + 0.005)),
        edge: Math.min(68, x + 7),
      });
      sunbeam(ctx, seconds);
    },
  );
  vignette(ctx, 0.35);
};

/** A chain of paperclips, held between two nubs. */
function paperclips(
  ctx: Ctx,
  a: { x: number; y: number },
  b: { x: number; y: number },
  sag: number,
  jitter: number,
) {
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const at = (u: number) => ({
      x: lerp(a.x, b.x, u),
      y:
        lerp(a.y, b.y, u) + Math.sin(u * Math.PI) * sag + Math.sin(i * 2.1 + jitter) * jitter * 0.4,
    });
    const here = at(t),
      next = at(t + 0.02);
    ctx.save();
    ctx.translate(here.x, here.y);
    ctx.rotate(Math.atan2(next.y - here.y, next.x - here.x) + (i % 2 ? 0.25 : -0.25));
    const color = i % 4 === 1 ? '#F29BB8' : i % 4 === 3 ? '#8FC7E8' : '#DAD8E6';
    line(
      ctx,
      color,
      0.7,
      [1.2, -0.3, -2, -0.3, -2, 0.9, 2.6, 0.9, 2.6, -1.1, -2.8, -1.1, -2.8, 0.6],
    );
    ctx.restore();
  }
}

const chainShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.2, 96, 106, 1.9],
      [0.245, 92, 104, 2.05],
    ]),
    () => {
      parlour(ctx, seconds, DAY_ROOM, { outside: dayView, picture: true });
      // Dad hangs a picture, whistling, and hears nothing at all.
      const hit = Math.max(...HAMMER.map((h) => 1 - Math.min(1, Math.abs(p - h) / 0.003)));
      const swing = 2.6 - hit * 0.9;
      const f: Partial<Figure> = {
        size: 1.7,
        facing: 1,
        arms: [2.1, swing],
        eyes: 'happy',
        mouth: p > 0.243 ? 'grin' : 'smile',
      };
      dad(ctx, 86, FLOOR, f);
      const hand = handOf(86, FLOOR, { ...DAD, ...f });
      const hx = hand.x + Math.sin(swing) * 8,
        hy = hand.y + Math.cos(swing) * 8;
      line(ctx, '#8A5E48', 1.5, [hand.x, hand.y, hx, hy]);
      box(ctx, hx - 2, hy - 2, 4, 4, '#5A5A66');
      // Wisp rises from behind the boxes, rattling her chain.
      const rise = easeOut(span(p, 0.203, 0.218));
      const rattling = within(p, RATTLE[0], RATTLE[1]);
      const jitter = rattling ? Math.sin(seconds * 60) * 1.2 : 0;
      const wx = 40 + jitter,
        wy = lerp(136, 96, rise) + bob(seconds);
      const g: Ghost = {
        size: 1.2,
        look: 1,
        eyes: 'spooky',
        mouth: rattling ? 'open' : 'grin',
        arms: [2.3, 2.3],
      };
      wisp(ctx, wx, wy, seconds, g);
      paperclips(ctx, wispHand(wx, wy, g, -1), wispHand(wx, wy, g, 1), 12, jitter);
      crate(ctx, 20, FLOOR, 30, 20);
      crate(ctx, 24, 130, 22, 14);
      sunbeam(ctx, seconds);
    },
  );
  vignette(ctx, 0.35);
};

const clipsShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.245, 40, 96, 4.2],
      [0.275, 40, 97, 4.4],
    ]),
    () => {
      parlour(ctx, seconds, DAY_ROOM, { outside: dayView, picture: true });
      const droop = ease(span(p, FLOP_A - 0.003, FLOP_A + 0.004));
      const rattling = p < RATTLE[1];
      const jitter = rattling ? Math.sin(seconds * 60) * 1.2 : 0;
      const looked = p > 0.254;
      const g: Ghost = {
        size: 1.2,
        look: looked ? 0 : 1,
        lookY: looked ? 2.5 : 0,
        eyes: !looked ? 'spooky' : p < 0.259 ? 'open' : 'sad',
        mouth: rattling ? 'open' : p < 0.259 ? 'o' : 'wobble',
        arms: [2.3 - droop * 1.5, 2.3 - droop * 1.5],
        blush: p > 0.259 ? 0.7 : 0,
      };
      const wx = 40 + jitter,
        wy = 96 + bob(seconds) + droop * 2;
      wisp(ctx, wx, wy, seconds, g);
      const a = wispHand(wx, wy, g, -1),
        b = wispHand(wx, wy, g, 1);
      paperclips(ctx, a, b, 10 + droop * 5, jitter);
      // The jingle: a few glints run along the clips.
      const glint = hump(p, TINKLE - 0.002, TINKLE + 0.008);
      if (glint > 0)
        for (let i = 0; i < 3; i++) {
          const t = (i + 1) / 4;
          const gx = lerp(a.x, b.x, t),
            gy = lerp(a.y, b.y, t) + Math.sin(t * Math.PI) * 10 - 2;
          dot(ctx, gx - 1.5, gy, 3, 0.6, alpha('#FFFFFF', glint));
          dot(ctx, gx - 0.3, gy - 1.2, 0.6, 3, alpha('#FFFFFF', glint));
        }
    },
  );
  vignette(ctx, 0.45);
};

const windUpShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.275, 72, 108, 1.95],
      [0.315, 86, 102, 2.4],
    ]),
    () => {
      parlour(ctx, seconds, DAY_ROOM, { outside: dayView, picture: true, boxes: 'open' });
      // Biscuit watches the ghost with great interest.
      biscuit(ctx, 138, FLOOR + 2, seconds, {
        pose: 'sit',
        facing: -1,
        size: 1.3,
        tongue: true,
        wag: 1.4,
      });
      mum(ctx, 60, FLOOR, {
        size: 1.6,
        facing: -1,
        lean: 0.4,
        arms: [1.1, 1.4 + Math.sin(seconds * 5) * 0.1],
        eyes: 'open',
        mouth: 'smile',
      });
      for (let i = 0; i < 4; i++) {
        const t = (seconds * 0.5 + i / 4) % 1;
        disc(ctx, 38 + i * 4 + t * 4, 128 - t * 26, 2 + t * 3, alpha('#E8DED0', 0.4 * (1 - t)));
      }
      const rise = easeOut(span(p, 0.277, 0.29));
      const wind = ease(span(p, WIND_UP[0], WIND_UP[1]));
      const shake = wind * Math.sin(seconds * 50) * 0.8;
      wisp(ctx, 98 + shake, lerp(152, 98, rise) + bob(seconds), seconds, {
        size: lerp(1.2, 1.55, wind),
        squash: lerp(1, 0.88, wind),
        look: -1,
        eyes: 'spooky',
        mouth: wind > 0.5 ? 'open' : 'grin',
        arms: [lerp(0.6, 2.4, wind), lerp(0.6, 2.4, wind)],
      });
      sunbeam(ctx, seconds);
    },
  );
  vignette(ctx, 0.35);
};

const booShot: Scene = (ctx, p, seconds) => {
  const view = track(p, [
    [0.315, 98, 94, 4.0],
    [0.335, 98, 95, 4.1],
  ]);
  const deflate = ease(span(p, BOO + 0.004, BOO + 0.01));
  const size = lerp(1.55, 1.38, deflate);
  camera(ctx, view, () => {
    parlour(ctx, seconds, DAY_ROOM, { outside: dayView, picture: true, boxes: 'open' });
    const after = p > BOO + 0.005;
    wisp(ctx, 98, 98 + bob(seconds), seconds, {
      size,
      squash: lerp(0.88, 1, deflate),
      eyes: after ? 'open' : 'closed',
      mouth: after ? 'o' : 'open',
      arms: [lerp(2.4, 1.6, deflate), lerp(2.4, 1.6, deflate)],
    });
  });
  // The most frightening word in the world, very small, from the corner of her mouth.
  if (p >= BOO) {
    const at = screenOf(view, 98 + 4 * size, 98 + bob(seconds) + 5 * size);
    const t = span(p, BOO, BOO + 0.012);
    faded(ctx, 1 - span(p, 0.33, 0.335), () =>
      write(ctx, 'boo.', at.x + 8 + t * 6, at.y - t * 5, { size: 7, type: 'italic', color: INK }),
    );
  }
  vignette(ctx, 0.45);
};

const sneezeShot: Scene = (ctx, p, seconds) => {
  const view = track(p, [
    [0.335, 82, 108, 1.9],
    [0.37, 92, 110, 1.85],
  ]);
  camera(ctx, view, () => {
    parlour(ctx, seconds, DAY_ROOM, { outside: dayView, picture: true, boxes: 'open' });
    const build = ease(span(p, 0.338, SNEEZE));
    const recoil = 1 - ease(span(p, SNEEZE + 0.003, 0.357));
    const wipe = within(p, 0.357, 0.365);
    mum(ctx, 60, FLOOR, {
      size: 1.6,
      facing: p < 0.365 ? 1 : -1,
      lean: p < SNEEZE ? -0.25 * build : p < 0.357 ? 0.4 * recoil : 0,
      eyes: p < 0.357 ? 'closed' : 'open',
      mouth: p < SNEEZE ? 'o' : p < 0.357 ? 'open' : 'flat',
      arms: wipe ? [0.3, 2.7] : [0.8, 1.0],
    });
    // Wisp is blown clean across the room and lands in a heap.
    const fly = easeOut(span(p, SNEEZE, 0.356));
    const landed = p >= 0.356;
    const wx = lerp(98, 148, fly),
      wy = landed ? 139 : lerp(98, 139, fly) - Math.sin(fly * Math.PI) * 16;
    const recover = ease(span(p, 0.36, 0.37));
    wisp(ctx, wx, wy + (landed ? 0 : bob(seconds)), seconds, {
      size: 1.3,
      tilt: landed ? 0 : fly * TAU,
      squash: landed ? lerp(1.8, 1.25, recover) : 1,
      eyes: p < SNEEZE ? (p > 0.338 ? 'wide' : 'open') : 'squint',
      mouth: p < SNEEZE ? 'none' : 'wobble',
      arms: p < SNEEZE ? [1.4, 1.4] : [2.6, 2.6],
      look: -1,
    });
    if (within(p, SNEEZE, 0.356)) {
      const t = span(p, SNEEZE, 0.356);
      for (const dy of [-8, -2, 4])
        line(ctx, alpha('#FFFFFF', 0.7 * (1 - t)), 1, [
          72 + t * 30,
          100 + dy,
          90 + t * 40,
          100 + dy * 1.3,
        ]);
    }
  });
  // Ah... ah... ACHOO!
  const nose = screenOf(view, 66, 88);
  if (within(p, AH[0], SNEEZE))
    write(ctx, p < AH[1] ? 'ah...' : 'ah... ah...', nose.x + 4, nose.y - 6, {
      size: 8,
      type: 'italic',
      color: '#4A3050',
      align: 'left',
    });
  if (within(p, SNEEZE, 0.364)) {
    const pop = backOut(span(p, SNEEZE, SNEEZE + 0.004));
    const shake = (1 - span(p, SNEEZE, SNEEZE + 0.01)) * Math.sin(seconds * 70) * 1.5;
    faded(ctx, 1 - span(p, 0.358, 0.364), () =>
      write(ctx, 'ACHOO!', nose.x + 22 + shake, nose.y, {
        size: Math.round(10 + pop * 8),
        color: '#FFF3D6',
        shadow: '#6A2E4A',
      }),
    );
  }
  vignette(ctx, 0.35);
};

const chairShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.37, 226, 98, 1.55],
      [0.445, 228, 96, 1.62],
    ]),
    () => {
      parlour(ctx, seconds, DAY_ROOM, {
        outside: dayView,
        picture: true,
        table: false,
        shelfBox: p >= SHELVE,
      });
      crate(ctx, 184, FLOOR, 26, 18);
      crate(ctx, 188, 132, 18, 13);
      // The chair rises high, dips under Dad, and drops when he gets off.
      const lift = ease(span(p, LIFT[0], LIFT[1]));
      const load =
        ease(span(p, STEP_UP[0] + 0.004, STEP_UP[1])) *
        (1 - ease(span(p, HOP_DOWN[0], HOP_DOWN[0] + 0.004)));
      const drop = easeIn(span(p, CHAIR_DROP - 0.003, CHAIR_DROP));
      const floating = lift > 0 && drop < 1;
      const cx = 234 + lift * 6,
        cy = lerp(FLOOR - 30 * lift + 5 * load, FLOOR, drop);
      if (floating) {
        glow(ctx, cx, cy - 18, 34, WISP_GLOW, 0.5 * lift);
        for (let i = 0; i < 4; i++) {
          const t = (seconds * 0.8 + i / 4) % 1;
          box(ctx, cx - 10 + i * 6, cy + 4 - t * 40, 1, 1, alpha(SHEET, lift * (1 - t)));
        }
      }
      chair(ctx, cx, cy, -1, DAY_ROOM.wood, floating ? Math.sin(seconds * 7) * 0.06 : 0);
      // Dad: stretch, turn, shrug, hop up, shelve, hop down.
      const up = ease(span(p, STEP_UP[0], STEP_UP[1])),
        down = ease(span(p, HOP_DOWN[0], HOP_DOWN[1]));
      const seat = cy - 17;
      let dx = lerp(lerp(274, 238, up), 280, down);
      let dy = lerp(lerp(FLOOR, seat, up), FLOOR, down);
      dy -= Math.sin(up * Math.PI) * 10 + Math.sin(down * Math.PI) * 8;
      if (p < TURN) {
        dx = 274;
        dy -= 1 + Math.abs(Math.sin(seconds * 6)) * 2;
      }
      const f: Partial<Figure> = { size: 1.6, facing: 1 };
      if (p < TURN) Object.assign(f, { arms: [2.9, 2.9], eyes: 'closed', mouth: 'flat' });
      else if (p < SHRUG[0])
        Object.assign(f, { facing: -1, arms: [0.3, 0.3], eyes: 'wide', mouth: 'o' });
      else if (p < STEP_UP[0])
        Object.assign(f, {
          facing: -1,
          arms: [-1.1, 1.1],
          lean: -0.08,
          eyes: 'open',
          mouth: 'flat',
        });
      else if (p < STEP_UP[1]) Object.assign(f, { facing: -1, arms: [0.6, 1.0], eyes: 'open' });
      else if (p < SHELVE) Object.assign(f, { arms: [2.9, 2.9], eyes: 'open', mouth: 'flat' });
      else
        Object.assign(f, {
          arms: p < HOP_DOWN[1] ? [2.4, 2.4] : [1.3, 1.5],
          eyes: 'happy',
          mouth: 'grin',
        });
      dad(ctx, dx, dy, f);
      // The box: held high, then balanced on his head while he shrugs, then onto the shelf.
      if (p < SHELVE) {
        const full = { ...DAD, ...f };
        const front = handOf(dx, dy, full),
          back = handOf(dx, dy, full, 'back');
        const head = { x: dx, y: dy - 37 * 1.6 };
        const held = { x: (front.x + back.x) / 2, y: Math.min(front.y, back.y) };
        const lifted = ease(span(p, STEP_UP[1], SHELVE - 0.002));
        const at =
          p < TURN
            ? held
            : p < STEP_UP[1]
              ? head
              : { x: lerp(head.x, 275, lifted), y: lerp(head.y, 62, lifted) };
        crate(ctx, at.x - 9, at.y, 18, 13);
      }
      // Wisp, holding the whole thing up.
      const straining = within(p, STEP_UP[0], HOP_DOWN[1]);
      const spent = p >= HOP_DOWN[1];
      const shake = straining ? Math.sin(seconds * 45) * 0.8 : 0;
      const armsUp = lerp(0.8, 2.3, ease(span(p, LIFT[0] - 0.004, LIFT[0] + 0.004)));
      const g: Ghost = spent
        ? { size: 1.2, eyes: 'closed', mouth: 'open', arms: [0.3, 0.3], squash: 1.15, blush: 0.5 }
        : straining
          ? { size: 1.2, eyes: 'squint', mouth: 'wobble', arms: [2.3, 2.3], blush: 1, squash: 1.08 }
          : p >= TURN
            ? {
                size: 1.2,
                look: 1,
                eyes: 'wide',
                mouth: p < SHRUG[1] ? 'o' : 'none',
                arms: [2.3, 2.3],
              }
            : { size: 1.2, look: 1, eyes: 'spooky', mouth: 'grin', arms: [armsUp, armsUp] };
      wisp(ctx, 198 + shake, (spent ? 110 : 100) + bob(seconds), seconds, g);
    },
  );
  vignette(ctx, 0.35);
};

const lickShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.445, 190, 114, 2.9],
      [0.47, 192, 112, 3.1],
    ]),
    () => {
      parlour(ctx, seconds, DAY_ROOM, {
        outside: dayView,
        picture: true,
        shelfBox: true,
        table: false,
      });
      crate(ctx, 184, FLOOR, 26, 18);
      chair(ctx, 240, FLOOR, -1, DAY_ROOM.wood, 0.2);
      const licked = p >= LICK;
      const g: Ghost = {
        size: 1.2,
        look: licked ? 0.5 : -1,
        eyes: p < 0.449 ? 'closed' : licked ? 'squint' : 'wide',
        mouth: p < 0.449 ? 'open' : licked ? 'wobble' : 'o',
        blush: licked ? 1 : 0.3,
        arms: licked ? [2.8, 2.8] : [0.4, 0.4],
        tilt: licked ? 0.12 : 0,
        squash: licked ? 0.95 : 1.1,
      };
      wisp(ctx, 202, 114 + bob(seconds), seconds, g);
      if (licked)
        line(
          ctx,
          alpha('#A8DCF4', 0.85 * (1 - span(p, 0.462, 0.47))),
          1.4,
          [192, 118, 196, 110, 200, 104],
        );
      const run = span(p, 0.445, 0.449);
      const jumping = p >= 0.449;
      biscuit(ctx, jumping ? 186 : lerp(146, 184, run), FLOOR + 2, seconds, {
        pose: jumping ? 'jump' : 'stand',
        step: jumping ? undefined : seconds * 16,
        tongue: true,
        wag: 2,
        eyes: 'happy',
        size: 1.3,
      });
      if (licked) {
        // A little heart, from the only one in the house who can see her.
        const t = span(p, LICK, LICK + 0.012);
        const hx = 180,
          hy = 100 - t * 8;
        faded(ctx, 1 - t, () => {
          disc(ctx, hx - 1.5, hy, 2, '#F27FA0');
          disc(ctx, hx + 1.5, hy, 2, '#F27FA0');
          poly(ctx, '#F27FA0', [hx - 3.4, hy + 0.6, hx + 3.4, hy + 0.6, hx, hy + 4.5]);
        });
      }
    },
  );
  vignette(ctx, 0.4);
};

const nightHouse: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.47, 178, 86, 1.3],
      [0.495, 186, 62, 2.1],
    ]),
    () => exterior(ctx, seconds, NIGHT_EXT, { sway: 2.5 }),
  );
  vignette(ctx, 0.6, NIGHT_VIGNETTE);
};

/** Juno sitting up in bed, facing the wall, in moonlight or Wisp's warm light. */
function junoInBed(ctx: Ctx, dim: number, over: Partial<Figure>, bounce = 0) {
  juno(
    ctx,
    268,
    136 - bounce,
    { sitting: true, facing: -1, size: 1.9, skin: moonlit(JUNO.skin, dim), ...over },
    true,
  );
  quilt(ctx, 127, dim);
}
/** The frightened child and the monster on her wall, as the scared and doorway shots see them. */
function fright(ctx: Ctx, p: number, seconds: number) {
  attic(ctx, seconds, 1, 0);
  const reach = ease(span(p, 0.5, 0.54)) + hump(p, CREAKS[1] - 0.002, CREAKS[1] + 0.012) * 0.3;
  monster(ctx, seconds, reach, 0);
  bed(ctx, 1);
  junoInBed(ctx, 1, { eyes: 'wide', mouth: 'frown', arms: [1.2, 1.2] });
  const cover = ease(span(p, COVER[0], COVER[1]));
  if (cover > 0) blanketUp(ctx, 268, lerp(127, 102, cover), 1, Math.sin(seconds * 30) * 0.6);
}

const scaredShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.495, 186, 94, 1.18],
      [0.545, 232, 100, 2.0],
    ]),
    () => fright(ctx, p, seconds),
  );
  vignette(ctx, 0.6, NIGHT_VIGNETTE);
};

const doorwayShot: Scene = (ctx, p, seconds) => {
  // Over her shoulder: the room she is looking into, and Wisp big in the doorway.
  camera(
    ctx,
    track(p, [
      [0.545, 196, 96, 1.3],
      [0.58, 200, 96, 1.38],
    ]),
    () => fright(ctx, p, seconds),
  );
  veil(ctx, '#05060F', 0.2);
  const soft = p >= SOFTEN;
  wisp(ctx, 56, 112 + bob(seconds), seconds, {
    size: 2.2,
    look: 1,
    eyes: soft ? 'soft' : 'sad',
    mouth: p > 0.57 ? 'smile' : 'none',
    blush: soft ? 0.7 : 0.2,
    tilt: 0.1,
    glow: 0.6,
    arms: [0.4, 0.5],
  });
  box(ctx, 0, 0, 36, H, '#0E0C1A');
  box(ctx, 34, 0, 5, H, '#3A4270');
  box(ctx, 38, 0, 1, H, '#5A649A');
  vignette(ctx, 0.6, NIGHT_VIGNETTE);
};

const puppetShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.58, 160, 98, 1.18],
      [0.597, 182, 86, 1.55],
      [0.655, 184, 84, 1.6],
    ]),
    () => {
      const warm = ease(span(p, 0.588, 0.602));
      attic(ctx, seconds, 1, warm * 0.6);
      // Wisp's glow turns the wall into a little cinema screen, and the monster shrinks from it.
      glow(ctx, 186, 76, 70, WARM, 0.45 * warm);
      oval(ctx, 186, 76, 40, 32, alpha('#FFE6B8', 0.18 * warm));
      const flee = ease(span(p, 0.63, 0.652));
      const recoil = hump(p, BUNNY[1] - 0.012, BUNNY[1] + 0.004) * 0.3;
      monster(ctx, seconds, 1 - warm * 0.5 - recoil, flee, 26 * warm + recoil * 20);
      const puppet = '#2E2030';
      if (within(p, BUNNY[0], BUNNY[1]))
        faded(ctx, presence(p, BUNNY[0], BUNNY[1], 0.004), () => bunnyShadow(ctx, p, puppet));
      if (within(p, BIRD[0], BIRD[1] + 0.003))
        faded(ctx, presence(p, BIRD[0], BIRD[1] + 0.003, 0.004), () => birdShadow(ctx, p, puppet));
      bed(ctx, 1 - warm * 0.5);
      junoInBed(ctx, 1 - warm * 0.5, { eyes: 'wide', mouth: 'frown', arms: [1.2, 1.2] });
      blanketUp(ctx, 268, 102, 1 - warm * 0.5);
      const glide = ease(span(p, GLIDE[0], GLIDE[1]));
      const x = lerp(28, 200, glide),
        y = lerp(104, 124, glide) - Math.sin(glide * Math.PI) * 14;
      const playing = p >= BUNNY[0];
      const wiggle = Math.sin(seconds * 8) * 0.15;
      wisp(ctx, x, y + bob(seconds), seconds, {
        size: 1.15,
        look: playing ? -0.6 : glide < 1 ? 1 : 0,
        lookY: playing ? -1 : 0,
        eyes: playing ? 'happy' : 'soft',
        mouth: playing ? 'smile' : 'none',
        tilt: glide < 1 ? Math.sin(glide * Math.PI) * 0.2 : 0,
        arms: playing ? [2.6 + wiggle, 2.3 - wiggle] : [0.6, 0.6],
        glow: 1 + warm * 0.8,
        glowColor: warm > 0.5 ? WARM_GLOW : WISP_GLOW,
      });
    },
  );
  vignette(ctx, 0.55, NIGHT_VIGNETTE);
};

const peekOutShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.655, 262, 106, 3.2],
      [0.68, 262, 106, 3.3],
    ]),
    () => {
      attic(ctx, seconds, 0.6, 0.6);
      glow(ctx, 210, 100, 80, WARM, 0.3);
      bed(ctx, 0.4);
      const giggling = within(p, GIGGLE, SPOT);
      junoInBed(
        ctx,
        0.4,
        {
          eyes: p < GIGGLE ? 'open' : p < SPOT ? 'happy' : 'wide',
          mouth: p < GIGGLE ? 'smile' : p < SPOT ? 'grin' : 'o',
          arms: [1.2, 1.2],
        },
        giggling ? Math.abs(Math.sin(seconds * 14)) * 1.5 : 0,
      );
      blanketUp(ctx, 268, lerp(102, 120, ease(span(p, 0.656, 0.663))), 0.4);
    },
  );
  vignette(ctx, 0.5, NIGHT_VIGNETTE);
};

const hiShot: Scene = (ctx, p, seconds) => {
  const view = track(p, [
    [0.68, 240, 108, 2.3],
    [0.72, 242, 106, 2.4],
  ]);
  const waving = within(p, HI - 0.002, HI + 0.014);
  const laughing = p >= LAUGH;
  camera(ctx, view, () => {
    attic(ctx, seconds, 0.6, 0.6);
    glow(ctx, 222, 112, 60, WARM, 0.3);
    bed(ctx, 0.4);
    junoInBed(
      ctx,
      0.4,
      {
        eyes: laughing ? 'happy' : 'open',
        mouth: laughing ? 'grin' : 'smile',
        arms: [1.2, waving ? 2.6 + Math.sin(seconds * 12) * 0.3 : 1.2],
        lean: laughing ? -0.1 : 0,
      },
      laughing ? Math.abs(Math.sin(seconds * 12)) * 1.5 : 0,
    );
    blanketUp(ctx, 268, 120, 0.4);
    const shy = p >= SHY_BOO;
    wisp(ctx, 220, 112 + bob(seconds), seconds, {
      size: 1.15,
      look: laughing ? 1 : 0.6,
      lookY: shy && !laughing ? 1.5 : 0,
      eyes: laughing ? 'happy' : 'soft',
      mouth: laughing ? 'smile' : shy ? 'o' : 'none',
      blush: shy ? 1 : 0.6,
      arms: [0.7, 0.7],
      glow: 1.4,
      glowColor: WARM_GLOW,
    });
  });
  const girl = screenOf(view, 262, 88),
    ghost = screenOf(view, 220, 94);
  say(ctx, 'Hi.', girl.x, girl.y, presence(p, HI, HI + 0.02, 0.003));
  say(ctx, '...boo?', ghost.x, ghost.y, presence(p, SHY_BOO, SHY_BOO + 0.018, 0.003), 7);
  vignette(ctx, 0.5, NIGHT_VIGNETTE);
};

const hideShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.72, 186, 104, 1.75],
      [0.795, 180, 104, 1.85],
    ]),
    () => {
      attic(ctx, seconds, 0.4, 0.8);
      bed(ctx, 0.2);
      quilt(ctx, 127, 0.2);
      // Wisp melts into the wallpaper until only her eyes are left.
      const sink = ease(span(p, SINK[0], SINK[1]));
      const pop = backOut(span(p, FOUND + 0.002, FOUND + 0.008));
      const found = p >= FOUND + 0.002;
      const body = found ? pop : 1 - sink;
      const jx = p < 0.75 ? 236 : lerp(236, 196, ease(span(p, 0.75, 0.766)));
      const hidden = sink > 0.9 && !found;
      if (within(p, SINK[0], SINK[1] + 0.006))
        for (const k of [0, 1]) {
          const t = (span(p, SINK[0], SINK[1] + 0.006) * 2 + k * 0.5) % 1;
          ctx.strokeStyle = alpha('#FFE6B8', 0.5 * (1 - t));
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(140, 94, 14 + t * 14, 16 + t * 14, 0, 0, TAU);
          ctx.stroke();
        }
      wisp(ctx, 140, 94 + (hidden ? 0 : bob(seconds)), seconds, {
        size: 1.2 * (found ? 1 : 1 - sink * 0.1),
        body: clamp(body),
        look: hidden ? clamp((jx - 140) / 60, -1, 1) : 0.5,
        eyes: found || p < SINK[0] + 0.004 ? 'happy' : 'open',
        mouth: found ? 'grin' : p < SINK[0] + 0.004 ? 'smile' : 'none',
        glow: 1.2 * Math.max(0.15, body),
        glowColor: WARM_GLOW,
      });
      // Juno counts, turns, searches, and finds her.
      const f: Partial<Figure> = { size: 1.9, skin: moonlit(JUNO.skin, 0.3) };
      if (p < 0.748)
        Object.assign(f, { facing: 1, arms: [2.7, 2.7], eyes: 'closed', mouth: 'smile' });
      else if (p < 0.766)
        Object.assign(f, {
          facing: -1,
          step: seconds * 12,
          arms: [0.3, 0.3],
          eyes: 'open',
          mouth: 'flat',
          lean: Math.sin(seconds * 3) * 0.08,
        });
      else if (p < FOUND)
        Object.assign(f, { facing: -1, arms: [0.3, 0.3], eyes: 'open', mouth: 'flat' });
      else if (!found) Object.assign(f, { facing: -1, arms: [0.3, 1.7], eyes: 'wide', mouth: 'o' });
      else
        Object.assign(f, {
          facing: -1,
          arms: [2.6, 2.6],
          eyes: 'happy',
          mouth: 'grin',
          lean: -0.1,
        });
      juno(ctx, jx, FLOOR - (found ? Math.abs(Math.sin(seconds * 12)) * 2 : 0), f, true);
    },
  );
  vignette(ctx, 0.5, NIGHT_VIGNETTE);
};

const tuckShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.795, 250, 118, 2.2],
      [0.86, 246, 118, 2.5],
    ]),
    () => {
      attic(ctx, seconds, 0.5, 0.5);
      bed(ctx, 0.5);
      sleepingJuno(ctx, 282, 111, 1.9, hump(p, YAWN - 0.004, YAWN + 0.008), p < 0.808);
      const tuck = ease(span(p, TUCK[0], TUCK[1]));
      const top = lerp(130, 122, tuck);
      quilt(ctx, top, 0.5, 296);
      // She pulls the quilt up to Juno's chin, then settles down to glow by the bed.
      const settle = ease(span(p, SETTLE[0], SETTLE[1]));
      const x = lerp(lerp(246, 258, tuck), 202, settle),
        y = lerp(top - 13, 130, settle);
      const sleepy = settle > 0.6;
      wisp(ctx, x, y + bob(seconds) * (1 - settle * 0.6), seconds, {
        size: 1.1,
        look: sleepy ? 0 : 1,
        lookY: sleepy ? 0 : 1,
        eyes: sleepy ? 'closed' : 'soft',
        mouth: 'smile',
        blush: 0.6,
        arms: settle > 0 ? [0.4, 0.4] : [1.1, 1.1],
        squash: lerp(1, 1.2, settle),
        glow: lerp(1.2, 1.7, settle),
        glowColor: '#FFE2B0',
      });
    },
  );
  vignette(ctx, 0.55, NIGHT_VIGNETTE);
};

const porchShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.86, 196, 114, 1.45],
      [0.9, 190, 114, 1.55],
      [0.915, 190, 114, 1.57],
    ]),
    () => {
      porch(ctx);
      porchFamily(ctx, p, seconds, false);
      const blink = TICKS.reduce(
        (m, t) => Math.max(m, 1 - Math.min(1, Math.abs(p - t) / 0.0016)),
        0,
      );
      tripod(ctx, TRIPOD_X, 178, p > PRESS && p < CLICK ? 0.3 + blink * 0.7 : 0);
    },
  );
  vignette(ctx, 0.25, '#3A2A1A');
};

const photoShot: Scene = (ctx, p) => {
  // A clean, well-lit close-up of the developed print, lying on a warm tabletop.
  camera(
    ctx,
    track(p, [
      [CUTS[21], 160, 90, 1],
      [CUTS[22], 160, 88, 1.05],
    ]),
    () => {
      box(ctx, 0, 0, W, H, '#9A6A4A');
      for (let y = 6; y < H; y += 9) box(ctx, 0, y, W, 1, '#8C5E40');
      glow(ctx, 160, 80, 200, '#FFF1D8', 0.25);
      ctx.save();
      ctx.translate(160, 84);
      ctx.rotate(-0.02);
      box(ctx, -115, -72, 236, 152, alpha('#2A1A10', 0.3));
      box(ctx, -118, -76, 236, 152, '#FBF7EE');
      // The family fills the frame; the porch is cropped to them.
      ctx.save();
      ctx.beginPath();
      ctx.rect(-110, -68, 220, 120);
      ctx.clip();
      ctx.translate(-110, -68);
      ctx.scale(220 / 140, 220 / 140);
      ctx.translate(-92, -82);
      porch(ctx);
      porchFamily(ctx, 1, 0.5, true);
      ctx.restore();
      box(ctx, -110, -68, 220, 120, alpha('#F3B86A', 0.12));
      ctx.restore();
    },
  );
  vignette(ctx, 0.3, '#2A1A10');
};

const mantelShot: Scene = (ctx, p, seconds) => {
  camera(
    ctx,
    track(p, [
      [0.965, 178, 82, 2.6],
      [1, 176, 94, 2.05],
    ]),
    () => {
      parlour(ctx, seconds, HOME_ROOM, {
        outside: eveningView,
        fire: 1,
        photo: true,
        picture: true,
        shelfBox: true,
      });
      wisp(ctx, 204, 72 + bob(seconds), seconds, {
        size: 1.0,
        look: -0.7,
        eyes: 'happy',
        mouth: 'smile',
        blush: 0.8,
        arms: [0.6, 0.35],
        glow: 1.1,
        glowColor: '#FFE0C8',
      });
    },
  );
  vignette(ctx, 0.45, '#1A0E14');
};

const SCENES: readonly Scene[] = [
  duskHouse,
  checkersShot,
  portraitShot,
  vanShot,
  peekShot,
  chainShot,
  clipsShot,
  windUpShot,
  booShot,
  sneezeShot,
  chairShot,
  lickShot,
  nightHouse,
  scaredShot,
  doorwayShot,
  puppetShot,
  peekOutShot,
  hiShot,
  hideShot,
  tuckShot,
  porchShot,
  photoShot,
  mantelShot,
];
/** Dissolves into these shots, by index: how early the next shot starts to show through. */
const DISSOLVES: Partial<Record<number, number>> = { 1: 0.008, 19: 0.012 };

const CAPTIONS = [
  [0.03, 0.105, 'Wisp had the house to herself.'],
  [0.124, 0.172, 'A hundred quiet years. Until today.'],
  [0.2, 0.248, 'Time for a proper haunting.'],
  [0.917, 0.964, 'Everyone made it into the photo.'],
] as const;

// Music: Wisp's waltz is minor while she haunts, and turns major once she belongs.
/** Melody shorthand: degrees above the root, '-' for a rest, bars split with '|'. */
const tune = (text: string) =>
  text
    .split(/[\s|]+/)
    .filter(Boolean)
    .map((t) => (t === '-' ? null : Number(t)));
const MINOR_THEME = tune('0 3 7 | 6 7 - | 12 10 8 | 7 - - | 0 3 7 | 6 7 - | 5 3 2 | 0 - -');
const MAJOR_THEME = tune('0 4 7 | 9 7 - | 12 9 5 | 7 - - | 0 4 7 | 9 7 - | 5 4 2 | 0 - -');
const LULLABY = tune('4 - 0 | 5 - 0 | 4 2 0 | 2 - - | 4 - 0 | 5 4 2 | 2 -1 -5 | 0 - -');
const WALTZ_CHORDS = [0, 0, 5, 7, 0, 0, 5, 0];
const LULLABY_CHORDS = [0, 5, 0, 7, 0, 5, 7, 0];

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const booPolitelyScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: 62, voice: 'bell', intro: [0, 3, 7, 6, 7], outro: [3, 7, 10, 15] },
    (s) => {
      const sec = (seconds: number) => seconds / s.story;
      // A comic stinger for every failed scare: four drooping notes.
      const womp = (at: number) =>
        [7, 6, 5, 4].forEach((d, i) =>
          s.note(at + i * sec(0.24), 50 + d, i === 3 ? 1.1 : 0.26, 'lead', 0.12, 0),
        );
      const scare = { bpm: 150, root: 62, minor: true, chords: WALTZ_CHORDS };
      const waltz = { groove: 'waltz', voice: 'pluck', gain: 0.6, fade: 0.3 } as const;
      // Act one: a music box plays to an empty house.
      s.fx('wind', 0, s.story * 0.12, 0.05);
      s.section({
        ...scare,
        from: 0,
        to: 0.12,
        bpm: 112,
        melody: MINOR_THEME,
        voice: 'bell',
        gain: 0.6,
        level: 0.45,
        groove: 'waltz',
      });
      s.fx('creak', 0.012, 0.8, 0.07, 0.3);
      for (const m of MOVES) s.fx('knock', m, 0.12, 0.1, 0.4);
      s.fx('woo', CROSS[0], 0.9, 0.07, 0);
      for (const d of DUSTS) s.fx('swish', d, 0.35, 0.07, -0.2);
      // Morning: the family arrives in brisk four-four.
      s.section({
        from: 0.12,
        to: 0.162,
        bpm: 132,
        root: 65,
        chords: [0, 5, 7, 0],
        melody: [0, 4, 7, 12, 9, 7, 4, 7],
        step: 0.5,
        voice: 'pluck',
        gain: 0.55,
        level: 0.6,
        groove: 'pulse',
        fade: 0.4,
      });
      s.fx('tweet', 0.123, 1, 0.06, 0.6);
      s.fx('engine', 0.118, 1.1, 0.12, -0.5);
      s.fx('creak', VAN_STOP, 0.6, 0.12, -0.2);
      s.fx('knock', DOORS, 0.2, 0.12, 0);
      s.fx('bark', 0.142, 0.3, 0.12, 0.3);
      s.fx('bark', 0.148, 0.3, 0.1, 0.4);
      // Wisp at the curtain: sneaking pizzicato, a gasp, a swish.
      s.section({
        ...scare,
        ...waltz,
        from: 0.16,
        to: 0.2,
        bpm: 112,
        chords: [0, 7],
        melody: tune('0 - 3 - 7 - | 6 - 7 - - -'),
        step: 0.5,
        gain: 0.5,
        level: 0.35,
        fade: 0.4,
      });
      s.fx('gasp', GASP, 0.45, 0.14, -0.3);
      s.fx('swish', HIDE, 0.3, 0.12, 0.2);
      // Scare one: the chain.
      s.section({ ...scare, ...waltz, from: 0.2, to: FLOP_A, melody: MINOR_THEME, level: 0.7 });
      s.fx('woo', 0.203, 0.9, 0.08, -0.4);
      for (const h of HAMMER) s.fx('knock', h, 0.15, 0.13, 0.3);
      s.fx('clatter', RATTLE[0], 0.7, 0.03, -0.4);
      s.fx('sparkle', TINKLE, 0.6, 0.12, -0.3);
      womp(FLOP_A);
      // Scare two: the wind-up, then silence, then the squeak, then the sneeze.
      s.section({
        ...scare,
        ...waltz,
        from: 0.275,
        to: WIND_UP[1],
        melody: MINOR_THEME,
        level: 0.7,
      });
      for (let i = 0; i < 6; i++)
        s.note(WIND_UP[0] + i * sec(0.2), 62 + i * 2, 0.3, 'pluck', 0.05 + i * 0.012, 0.2);
      s.fx('woo', 0.279, 0.8, 0.08, 0.3);
      s.fx('squeak', BOO, 0.18, 0.1, 0.1);
      s.fx('sneeze', SNEEZE - sec(0.9 * 0.65), 0.9, 0.22, -0.2);
      s.fx('swish', SNEEZE, 0.5, 0.14, 0.4);
      s.fx('thud', 0.356, 0.3, 0.1, 0.5);
      womp(FLOP_B);
      // Scare three: the chair.
      s.section({ ...scare, ...waltz, from: 0.37, to: 0.444, melody: MINOR_THEME, level: 0.65 });
      s.fx('hum', LIFT[0], (CHAIR_DROP - LIFT[0]) * s.story, 0.05, 0);
      s.fx('creak', STEP_UP[1], 0.6, 0.14, 0.3);
      s.fx('thud', SHELVE, 0.3, 0.12, 0.5);
      s.fx('thud', CHAIR_DROP, 0.35, 0.14, 0.2);
      s.fx('bark', 0.448, 0.3, 0.14, -0.3);
      s.fx('bubble', LICK, 0.3, 0.1, -0.1);
      womp(FLOP_C);
      // Night: wind, a creaking branch, and cold chords.
      s.fx('wind', 0.462, 6.5, 0.1);
      s.section({
        ...scare,
        from: 0.47,
        to: 0.58,
        bpm: 56,
        chords: [0, -4, 5, 7],
        level: 0.55,
        fade: 1.2,
      });
      s.fx('creak', CREAKS[0], 0.9, 0.12, -0.4);
      s.fx('creak', CREAKS[1], 0.9, 0.14, -0.5);
      s.fx('gasp', COVER[0], 0.4, 0.07, 0.4);
      // Wisp softens: the lullaby's key, as three gentle bells.
      [65, 69, 72].forEach((n, i) => s.note(SOFTEN + i * sec(0.35), n, 1.8, 'bell', 0.07, -0.3));
      // The lullaby: shadow puppets, a giggle, hello.
      const lullaby = {
        root: 65,
        chords: LULLABY_CHORDS,
        melody: LULLABY,
        groove: 'waltz',
      } as const;
      s.section({
        ...lullaby,
        from: 0.58,
        to: 0.72,
        bpm: 88,
        voice: 'bell',
        gain: 0.7,
        level: 0.55,
        fade: 1,
      });
      s.fx('woo', GLIDE[0], 1, 0.08, -0.4);
      s.fx('sparkle', 0.592, 0.8, 0.07, 0);
      for (const h of HOPS) s.fx('bounce', h, 0.25, 0.07, -0.1);
      s.fx('flutter', BIRD[0], 1.5, 0.08, -0.2);
      s.fx('giggle', GIGGLE, 0.7, 0.1, 0.5);
      s.fx('squeak', SHY_BOO, 0.14, 0.06, 0);
      s.fx('giggle', LAUGH, 0.9, 0.12, 0.4);
      // Hide and seek: the lullaby, played for fun.
      s.section({
        ...lullaby,
        from: 0.72,
        to: 0.795,
        bpm: 104,
        voice: 'pluck',
        gain: 0.55,
        level: 0.5,
      });
      s.fx('woo', SINK[0], 0.9, 0.06, -0.2);
      for (let i = 0; i < 4; i++) s.fx('step', 0.751 + i * 0.004, 0.1, 0.05, 0.3 - i * 0.1);
      s.fx('giggle', FOUND + 0.003, 0.9, 0.11, -0.2);
      s.fx('giggle', FOUND + 0.01, 0.8, 0.09, 0.3);
      // Goodnight.
      s.section({
        ...lullaby,
        from: 0.795,
        to: 0.86,
        bpm: 72,
        voice: 'bell',
        gain: 0.45,
        level: 0.4,
        fade: 1.5,
      });
      s.fx('yawn', YAWN - sec(0.3), 1.2, 0.1, 0.4);
      s.fx('rustle', TUCK[0], 0.7, 0.05, 0.3);
      s.fx('sparkle', SETTLE[0], 0.8, 0.05, -0.2);
      // Morning: birds, a held chord, and the self-timer counting down.
      s.fx('tweet', 0.862, 1.2, 0.07, -0.6);
      s.fx('tweet', 0.885, 1, 0.06, 0.6);
      s.section({
        from: 0.86,
        to: CLICK,
        bpm: 100,
        root: 65,
        chords: [0],
        level: 0.4,
        bass: false,
        fade: 0.8,
      });
      s.fx('click', PRESS, 0.1, 0.1, 0.7);
      for (let i = 0; i < 6; i++) s.fx('step', RUN[0] + i * 0.0025, 0.1, 0.08, 0.6 - i * 0.2);
      for (const t of TICKS) s.fx('tick', t, 0.08, 0.1, 0.7);
      s.fx('click', CLICK, 0.15, 0.22, 0.7);
      s.chord(CLICK, [65, 69, 72, 77], 3, 'pad', 0.04);
      s.fx('sparkle', CLICK + 0.004, 1, 0.08, 0.3);
      // Finale: Wisp's waltz, in a major key at last.
      s.section({
        ...scare,
        ...waltz,
        from: 0.912,
        to: 1,
        root: 65,
        minor: false,
        melody: MAJOR_THEME,
        voice: 'bell',
        gain: 0.85,
        level: 0.85,
        fade: 0.6,
      });
      s.fx('chime', CUTS[22] + 0.004, 1.2, 0.07, 0.3);
    },
  );

export const booPolitely: FilmModule = {
  draw(ctx, p, seconds) {
    const { index } = shot(p, CUTS);
    SCENES[index](ctx, p, seconds);
    const next = index + 1,
      width = DISSOLVES[next];
    if (width && p > CUTS[next] - width)
      faded(ctx, ease((p - CUTS[next] + width) / width), () => SCENES[next](ctx, p, seconds));
    // Dips to black as a night passes, a morning comes, and the photo finds its place.
    const dips = [0.114, 0.462, 0.85, 0.959].map((d, i) =>
      hump(p, d, d + (i === 2 ? 0.02 : 0.012)),
    );
    veil(ctx, '#0A0814', Math.max(...dips));
    // The shutter: a brief, gentle warm bloom rather than a flash, then a cut to the print.
    const bloom = CLICK + 0.006;
    veil(
      ctx,
      '#FFF1D8',
      0.5 * Math.min(ease(span(p, CLICK, bloom)), 1 - ease(span(p, bloom, CUTS[21]))),
    );
    captions(ctx, p, CAPTIONS, { color: '#F3ECFF', band: '#18142A' });
  },
  score: booPolitelyScore,
  look: {
    shade: '#18142A',
    ink: '#F3ECFF',
    accent: '#B9A6F2',
    dedication: 'home is who you haunt it with',
  },
};
