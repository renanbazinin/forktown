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
  shade,
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
 * THE RUNAWAY POPCORN
 * At the Starlight Cinema's popcorn stand every kernel pops except one. Tipped into the dud
 * dish, it runs away across the lawn looking for enough heat to pop: a stomping sandal, a
 * sneezing dog, a teacup that is too cool, a string light that only fizzles. Alone under the
 * projector table at nightfall, it finds its heat when the lamp comes on, and makes the
 * biggest entrance in Forktown's history: a giant fluffy shadow on the big screen. It ends
 * as the crown on a kid's bucket, glowing in the projector light.
 *
 * One timetable (T) and one pop list drive both the pictures and the score, so every pop,
 * sniff, sneeze and tick lands on its frame, and the kernels in the pot bounce on the beat.
 * Five sets: the cinema lawn, the stand's counter, the inside of the pot, the kernel's-eye
 * field (with the projector table at its far end), and the rug where it all ends.
 */

// ——— One timetable for the pictures and the score (story time, 0 → 1) ———
// A beat is 1/112 of the story: about 124 bpm in the one-minute cut.
const BEAT = 1 / 112;
const T = {
  pour: 0.049,
  poured: 0.066,
  heat: 0.072,
  strain: 0.132,
  pff: 0.156,
  peek: 0.168,
  tip: 0.19,
  plink: 0.197,
  lift: 0.212,
  resolve: 0.232,
  hop: 0.247,
  land: 0.275,
  stomp: 0.2935,
  hide: 0.314,
  sniffs: [0.3215, 0.327, 0.3298],
  sneeze: 0.335,
  flop: 0.343,
  shiver: 0.358,
  climb: 0.37,
  hug: 0.38,
  fizzle: 0.392,
  drop: 0.395,
  dark: 0.4,
  sit: 0.44,
  beam: 0.476,
  out: 0.497,
  idea: 0.511,
  run: 0.52,
  cord: 0.545,
  top: 0.576,
  perch: 0.59,
  still: 0.662,
  pop: 0.668,
  screen: 0.695,
  gasp: 0.705,
  cheer: 0.72,
  float: 0.75,
  crown: 0.806,
  laugh: 0.826,
  give: 0.862,
  gift: 0.898,
  heart: 0.93,
} as const;
/** The crowd pops faster and faster, like real popcorn: a crescendo of bursts. */
const POPS = [
  0.081, 0.088, 0.094, 0.099, 0.103, 0.1065, 0.1095, 0.112, 0.1142, 0.1162, 0.118, 0.1196, 0.1212,
] as const;
// The crowd in the pot: x, y (floor contact), size, and which pop is theirs. The hero sits
// front and centre; its two neighbours go last.
const CROWD = [
  [78, 124, 1.35, 3],
  [114, 121, 1.35, 7],
  [150, 120, 1.3, 0],
  [184, 121, 1.35, 5],
  [218, 123, 1.35, 10],
  [252, 125, 1.35, 1],
  [62, 140, 1.55, 9],
  [98, 139, 1.55, 2],
  [226, 139, 1.55, 8],
  [262, 141, 1.55, 4],
  [84, 159, 1.7, 6],
  [122, 157, 1.75, 11],
  [200, 157, 1.75, 12],
] as const;
const HERO_POT = { x: 160, y: 157, size: 1.8 } as const;
const POT_ORDER = [...CROWD.map((c, i) => ({ y: c[1], i })), { y: HERO_POT.y + 0.5, i: -1 }].sort(
  (a, b) => a.y - b.y,
);
const popperX = (i: number) => CROWD.find((c) => c[3] === i)?.[0] ?? 160;
/** Hand-over-hand pulls up the projector's cord; the score plays a rising note on each. */
const GRABS = 7;
const grabAt = (i: number) => T.cord + (i * (T.top - T.cord)) / GRABS;

// ——— Palette ———
const GOLD = '#F2C14E';
const INK = '#2A1A14';
const LIMB = '#5A3510';
const TIP = '#F6EACB';
const FLUFF = '#FFF7E4';
const FLUFF_SHADE = '#E9CD96';
const HULL = '#D9962E';
const RED = '#D8453C';
const CREAM = '#FFF1E0';
const BLUSH = '#F0806E';
const WARM = '#FFE3A6';
const SHADOW = '#3A2A30';
const BULBS = ['#FFD27A', '#FF9A7A', '#9AD0FF', '#B8F0A0'] as const;
const TINTS = ['#F2C14E', '#F6D06A', '#E8B143', '#F0C65A'] as const;
const DUSK = ['#3E2F5E', '#77457A', '#C4617A', '#EE9A6E'] as const;
const NIGHT = ['#0A0F24', '#111938', '#18224A', '#202C58'] as const;
const skyAt = (night: number) => DUSK.map((c, i) => mix(c, NIGHT[i], night));
const FIELD_DUSK = ['#4E3868', '#9A5478', '#E48A70'] as const;
const FIELD_NIGHT = ['#0A0F26', '#141C44', '#1E2A58'] as const;

// ——— Little helpers ———
/** An unrounded rectangle, for details inside scaled drawings. */
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function twinkle(ctx: Ctx, x: number, y: number, s: number, color: string) {
  const k = s * 0.28;
  poly(ctx, color, [
    x,
    y - s,
    x + k,
    y - k,
    x + s,
    y,
    x + k,
    y + k,
    x,
    y + s,
    x - k,
    y + k,
    x - s,
    y,
    x - k,
    y - k,
  ]);
}
function heart(ctx: Ctx, x: number, y: number, s: number, color: string) {
  disc(ctx, x - s * 0.5, y - s * 0.25, s * 0.56, color);
  disc(ctx, x + s * 0.5, y - s * 0.25, s * 0.56, color);
  poly(ctx, color, [x - s * 1.04, y - s * 0.1, x + s * 1.04, y - s * 0.1, x, y + s * 1.05]);
}
/** Rays that burst out of a pop; t runs 0 → 1. */
function burst(ctx: Ctx, x: number, y: number, r: number, t: number, color = '#FFF3C8') {
  if (t <= 0 || t >= 1) return;
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8 + 0.3;
    const r0 = r * (0.6 + t * 0.9),
      r1 = r * (0.9 + t * 1.5);
    line(ctx, alpha(color, 1 - t), Math.max(0.7, r * 0.09), [
      x + Math.cos(a) * r0,
      y + Math.sin(a) * r0,
      x + Math.cos(a) * r1,
      y + Math.sin(a) * r1,
    ]);
  }
}
/** A little cloud of steam that rises and fades; t runs 0 → 1. */
function steam(ctx: Ctx, x: number, y: number, s: number, t: number) {
  if (t <= 0 || t >= 1) return;
  for (let i = 0; i < 3; i++) {
    const k = clamp(t * 1.4 - i * 0.18);
    if (k <= 0 || k >= 1) continue;
    disc(
      ctx,
      x + Math.sin(k * 5 + i * 2) * s * 0.8,
      y - k * s * 4,
      s * (0.4 + k * 0.7),
      alpha('#F4F1EC', (1 - k) * 0.8),
    );
  }
}
/** Heat haze: wavy lines that rise and fade. */
function shimmer(
  ctx: Ctx,
  x0: number,
  x1: number,
  bottom: number,
  height: number,
  amount: number,
  seconds: number,
  count = 6,
) {
  if (amount <= 0) return;
  for (let i = 0; i < count; i++) {
    const x = lerp(x0, x1, (i + 0.5) / count);
    const phase = (seconds * 0.8 + i * 0.37) % 1;
    const pts: number[] = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      pts.push(
        x + Math.sin(seconds * 5 + i * 2 + t * 7) * 2.5,
        bottom - (phase + t * 0.4) * height,
      );
    }
    line(ctx, alpha('#FFE3B0', amount * (1 - phase) * 0.5), 1, pts);
  }
}
/** A soft cone of projector light, brightest at (x0, y0). */
function lightCone(
  ctx: Ctx,
  points: readonly number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  amount: number,
) {
  if (amount <= 0) return;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, alpha('#FFF1C8', 0.55 * amount));
  g.addColorStop(0.4, alpha('#FFE6A8', 0.26 * amount));
  g.addColorStop(1, alpha('#FFE0A0', 0.12 * amount));
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < points.length; i += 2)
    if (i) ctx.lineTo(points[i], points[i + 1]);
    else ctx.moveTo(points[i], points[i + 1]);
  ctx.closePath();
  ctx.fill();
}
/** Dust drifting through a beam. */
function motes(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  spread: number,
  amount: number,
  seconds: number,
) {
  if (amount <= 0) return;
  for (let i = 0; i < 14; i++) {
    const t = (rand(i * 3.7) + seconds * (0.015 + rand(i) * 0.02)) % 1;
    const x = lerp(x0, x1, t) + Math.sin(seconds * 0.7 + i) * 2;
    const y = lerp(y0, y1, t) + (rand(i * 7.1) - 0.5) * spread * t;
    rect(ctx, x, y, 1, 1, alpha('#FFF6DA', amount * 0.7 * Math.sin(t * Math.PI)));
  }
}

// ——— The hero ———
type Eyes = 'open' | 'wide' | 'shut' | 'happy' | 'sad' | 'closed' | 'dots';
type Mouth = 'smile' | 'grin' | 'o' | 'frown' | 'flat' | 'grit' | 'wobble';
type Face = {
  eyes?: Eyes;
  mouth?: Mouth;
  /** -1 worried … 1 determined. */
  brows?: number;
  look?: readonly [number, number];
  blush?: number;
};
/** Big cartoon eyes, brows and mouth, centred between the eyes; about 9 units wide. */
function face(ctx: Ctx, f: Face, skin: string) {
  const eyes = f.eyes ?? 'open';
  const [lx, ly] = f.look ?? [0, 0];
  const b = f.brows ?? 0;
  for (const side of [-1, 1]) {
    const ex = side * 2.5;
    if (eyes === 'dots') {
      oval(ctx, ex * 0.8, 0.3, 0.75, 1.05, INK);
      continue;
    }
    if (eyes === 'open' || eyes === 'wide' || eyes === 'sad') {
      const wide = eyes === 'wide';
      oval(ctx, ex, 0, wide ? 2.1 : 1.9, wide ? 2.7 : 2.3, '#FFFFFF');
      const px = ex + lx * 0.75,
        py = ly * 0.85 + (eyes === 'sad' ? 0.7 : 0);
      oval(ctx, px, py, wide ? 0.95 : 1.2, wide ? 1.15 : 1.5, INK);
      disc(ctx, px - 0.45, py - 0.55, 0.4, '#FFFFFF');
      if (eyes === 'sad') {
        const outer = ex + side * 2.4,
          inner = ex - side * 2.4;
        poly(ctx, skin, [outer, -3, inner, -3, inner, -1.6, outer, 0]);
      }
    } else if (eyes === 'shut')
      line(ctx, INK, 0.75, [ex + side * 1.6, -1.3, ex - side * 1.1, 0, ex + side * 1.6, 1.3]);
    else if (eyes === 'happy') line(ctx, INK, 0.75, [ex - 1.6, 0.7, ex, -0.9, ex + 1.6, 0.7]);
    else line(ctx, INK, 0.75, [ex - 1.6, 0, ex, 0.7, ex + 1.6, 0]);
    line(ctx, INK, 0.7, [ex + side * 2.2, -3.4 - b * 0.4, ex - side * 0.4, -3.2 + b * 0.9]);
  }
  const m = f.mouth ?? 'smile';
  if (m === 'smile') line(ctx, INK, 0.7, [-1.6, 3.7, 0, 4.7, 1.6, 3.7]);
  else if (m === 'grin') {
    poly(ctx, INK, [-2.5, 3.3, 2.5, 3.3, 1.7, 5.1, 0, 5.8, -1.7, 5.1]);
    rect(ctx, -1.9, 3.3, 3.8, 0.8, '#FFFFFF');
    oval(ctx, 0, 5.1, 1.1, 0.5, '#E5776A');
  } else if (m === 'o') oval(ctx, 0, 4.5, 1.1, 1.4, INK);
  else if (m === 'frown') line(ctx, INK, 0.7, [-1.6, 5, 0, 4, 1.6, 5]);
  else if (m === 'flat') line(ctx, INK, 0.7, [-1.4, 4.4, 1.4, 4.4]);
  else if (m === 'grit') {
    rect(ctx, -2.4, 3.4, 4.8, 2.4, INK);
    rect(ctx, -2, 3.8, 4, 1.6, '#FFFFFF');
    rect(ctx, -2, 4.5, 4, 0.25, INK);
  } else line(ctx, INK, 0.6, [-2, 4.6, -1, 4, 0, 4.8, 1, 4, 2, 4.6]);
  if (f.blush) {
    oval(ctx, -4, 2.3, 1.1, 0.6, alpha(BLUSH, f.blush));
    oval(ctx, 4, 2.3, 1.1, 0.6, alpha(BLUSH, f.blush));
  }
}

type Kern = Face & {
  size?: number;
  /** 0..1: glowing red-hot. */
  heat?: number;
  squash?: number;
  tilt?: number;
  spin?: number;
  shake?: number;
  /** [left, right] from hanging down; positive raises outward, negative hugs. null tucks. */
  arms?: readonly [number, number] | null;
  step?: number;
  tint?: string;
  /** Warm light from above. */
  lit?: number;
};
function kernelPath(ctx: Ctx) {
  ctx.beginPath();
  ctx.ellipse(0, -10, 6.5, 7, 0, 0, TAU);
  ctx.moveTo(-5.5, -8);
  ctx.lineTo(5.5, -8);
  ctx.lineTo(1.8, -0.5);
  ctx.lineTo(-1.8, -0.5);
  ctx.closePath();
}
/** A shiny golden kernel with a pale tip and big eyes. (x, y) is the tip, on the ground. */
function kernel(ctx: Ctx, x: number, y: number, k: Kern, seconds: number) {
  const heat = k.heat ?? 0;
  const base = mix(k.tint ?? GOLD, '#E8583A', heat * 0.85);
  const dark = mix(base, '#7A3E0E', 0.4);
  const edge = mix(base, '#3A1E08', 0.62);
  const sq = k.squash ?? 0;
  ctx.save();
  ctx.translate(x + (k.shake ?? 0) * Math.sin(seconds * 67), y);
  ctx.scale(k.size ?? 1, k.size ?? 1);
  ctx.rotate(k.tilt ?? 0);
  if (k.spin) {
    ctx.translate(0, -9);
    ctx.rotate(k.spin);
    ctx.translate(0, 9);
  }
  ctx.scale(1 + sq * 0.6, 1 - sq);
  if (k.arms !== null)
    for (const side of [-1, 1]) {
      const swing = k.step === undefined ? 0 : Math.sin(k.step) * side;
      oval(ctx, side * 2.3 + swing * 1.3, -0.5 - Math.max(0, swing) * 1.3, 1.8, 1, LIMB);
    }
  ctx.save();
  ctx.translate(0, -8);
  ctx.scale(1.13, 1.1);
  ctx.translate(0, 8);
  kernelPath(ctx);
  ctx.fillStyle = edge;
  ctx.fill();
  ctx.restore();
  kernelPath(ctx);
  ctx.fillStyle = base;
  ctx.fill();
  oval(ctx, 2.3, -10.3, 3.4, 4.8, dark);
  oval(ctx, 1.1, -11, 3.2, 4.6, base);
  oval(ctx, 0, -1.7, 1.9, 1.6, mix(TIP, base, heat * 0.4));
  oval(ctx, -3.3, -13, 1.2, 2, alpha('#FFF8D8', 0.9));
  disc(ctx, -2.4, -15.4, 0.55, '#FFFFFF');
  if (k.lit) oval(ctx, 0, -15.2, 4.4, 2, alpha(WARM, k.lit * 0.55));
  ctx.save();
  ctx.translate(0, -10.2);
  face(ctx, k, base);
  ctx.restore();
  if (k.arms)
    k.arms.forEach((a, i) => {
      const side = i ? 1 : -1;
      const sx = side * 5.9,
        sy = -8.3;
      const hx = sx + side * Math.sin(a) * 4.3,
        hy = sy + Math.cos(a) * 4.3;
      line(ctx, LIMB, 1.1, [sx, sy, hx, hy]);
      disc(ctx, hx, hy, 0.95, LIMB);
    });
  ctx.restore();
}

// Lobes of a popped kernel in unit radius: [x, y, r].
const LOBES = [
  [0, 0.05, 0.6],
  [-0.5, -0.2, 0.46],
  [0.5, -0.24, 0.47],
  [-0.2, -0.56, 0.44],
  [0.3, -0.58, 0.42],
  [-0.6, 0.3, 0.4],
  [0.58, 0.3, 0.42],
  [0.02, 0.52, 0.44],
] as const;
type Puff = Face & { rot?: number; lobes?: number; hull?: boolean; squash?: number };
/** A popped kernel: a fluffy cloud of lobes around a face; r is roughly its radius. */
function puff(ctx: Ctx, x: number, y: number, r: number, f: Puff) {
  if (r < 0.4) return;
  const n = f.lobes ?? LOBES.length;
  const sq = f.squash ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(f.rot ?? 0);
  ctx.scale(r * (1 + sq * 0.5), r * (1 - sq));
  for (let i = 0; i < n; i++) {
    const [lx, ly, lr] = LOBES[i];
    disc(ctx, lx + 0.07, ly + 0.09, lr, FLUFF_SHADE);
  }
  for (let i = 0; i < n; i++) {
    const [lx, ly, lr] = LOBES[i];
    oval(ctx, lx - 0.02, ly - 0.04, lr * 0.9, lr * 0.86, FLUFF);
  }
  if (n > 5)
    for (const i of [1, 3, 4, 2]) {
      const [lx, ly, lr] = LOBES[i];
      oval(ctx, lx - lr * 0.3, ly - lr * 0.35, lr * 0.38, lr * 0.26, '#FFFFFF');
    }
  if (f.hull) {
    oval(ctx, 0.14, 0.66, 0.2, 0.08, HULL, 0.3);
    oval(ctx, -0.22, 0.62, 0.12, 0.06, HULL, -0.5);
  }
  if (f.eyes) {
    ctx.scale(0.1, 0.1);
    face(ctx, f, FLUFF);
  }
  ctx.restore();
}
/** The popcorn's shadow on a screen, eye holes and all. */
function shadowPuff(ctx: Ctx, x: number, y: number, r: number, light: string, grin: boolean) {
  for (const [lx, ly, lr] of LOBES) disc(ctx, x + lx * r, y + ly * r, lr * r * 1.02, SHADOW);
  oval(ctx, x - 0.25 * r, y, 0.17 * r, 0.21 * r, light);
  oval(ctx, x + 0.25 * r, y, 0.17 * r, 0.21 * r, light);
  if (grin)
    poly(ctx, light, [x - 0.22 * r, y + 0.33 * r, x + 0.22 * r, y + 0.33 * r, x, y + 0.52 * r]);
}

// ——— People, props and the dog ———
const VENDOR: Figure = {
  skin: '#E2A57E',
  hair: '#3E2A24',
  coat: '#F7F1E6',
  legs: '#3C4763',
  shoes: '#33282A',
  build: 'adult',
  hairStyle: 'short',
};
const KID: Figure = {
  skin: '#8D5A3C',
  hair: '#231A1E',
  coat: '#5DA0D0',
  legs: '#3A3550',
  hairStyle: 'pigtails',
};
/** The popcorn vendor: striped apron, paper hat, and a moustache that means business. */
function vendor(ctx: Ctx, x: number, y: number, over: Partial<Figure>) {
  const f: Figure = { ...VENDOR, ...over };
  person(ctx, x, y, f);
  const s = f.size ?? 1;
  const front = f.arms?.[1] ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((f.facing ?? 1) * s, s);
  ctx.translate(0, f.sitting ? -4 : -11 - (f.step === undefined ? 0 : Math.abs(Math.cos(f.step))));
  ctx.rotate(f.lean ?? 0);
  for (let c = -3; c < 4; c++) rect(ctx, c, -6, 1, 9, c % 2 ? RED : CREAM);
  for (let c = -2; c < 3; c++) rect(ctx, c, -11, 1, 5, c % 2 ? RED : CREAM);
  rect(ctx, -4, -6.5, 8, 1, '#A8322C');
  // The front arm goes back over the apron.
  ctx.save();
  ctx.translate(1, -11);
  ctx.rotate(-front);
  box(ctx, -1, 0, 2, 10, f.coat);
  box(ctx, -1, 9, 2, 2, f.skin);
  ctx.restore();
  poly(ctx, '#FFFFFF', [-6.5, -23.5, 6.5, -23.5, 5, -27.5, 0.5, -29.5, -5, -27.5]);
  rect(ctx, -6.5, -25, 13, 1.3, RED);
  rect(ctx, 0.5, -17.1, 6, 1, f.hair);
  ctx.restore();
}
const handsOf = (x: number, y: number, f: Figure) => {
  const a = handOf(x, y, f),
    b = handOf(x, y, f, 'back');
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
};

// A heap of popcorn, back to front: [x, y, r, has a face].
const HEAP = [
  [-2, -41, 3.4, 1],
  [5, -40, 3.2, 0],
  [1, -37, 3.9, 0],
  [-6, -36, 3.6, 1],
  [7, -35.5, 3.5, 1],
  [-10, -34, 3, 0],
  [12, -34, 2.8, 0],
  [-3, -32, 3.8, 1],
  [4, -31.5, 3.7, 0],
  [-9, -31, 3.6, 0],
  [10, -31, 3.4, 1],
] as const;
/** A red-and-white striped bucket; (x, y) is the middle of its base. */
function bucket(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  full: number,
  seconds: number,
  cheer = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  for (let i = 0; i < 6; i++) {
    const a = -10 + (20 * i) / 6,
      b = -10 + (20 * (i + 1)) / 6;
    const ta = -13 + (26 * i) / 6,
      tb = -13 + (26 * (i + 1)) / 6;
    poly(ctx, i % 2 ? CREAM : RED, [a, 0, b, 0, tb, -28, ta, -28]);
  }
  rect(ctx, -10, -1.5, 20, 1.5, '#A8322C');
  const count = Math.round(HEAP.length * full);
  for (let i = 0; i < count; i++) {
    const [hx, hy, hr, faced] = HEAP[i];
    const bob = cheer * Math.abs(Math.sin(seconds * 9 + i * 1.3)) * 2.2;
    if (s < 0.6) disc(ctx, hx, hy - bob, hr, i % 2 ? FLUFF : FLUFF_SHADE);
    else {
      const f: Puff = { lobes: 5, rot: i };
      if (faced) {
        f.eyes = cheer > 0.3 ? 'happy' : 'dots';
        f.mouth = cheer > 0.3 ? 'grin' : 'smile';
      }
      puff(ctx, hx, hy - bob, hr, f);
    }
  }
  rect(ctx, -14, -30, 28, 3, '#FFF6EA');
  rect(ctx, -14, -27.5, 28, 0.8, '#D9C7B0');
  ctx.restore();
}
function shadowBucket(ctx: Ctx, x: number, y: number, s: number) {
  poly(ctx, SHADOW, [x - 10 * s, y, x + 10 * s, y, x + 14 * s, y - 30 * s, x - 14 * s, y - 30 * s]);
  for (const [hx, hy, hr] of HEAP) disc(ctx, x + hx * s, y + hy * s, hr * s * 1.1, SHADOW);
}
/** The stand's steel popping pot, side on, around its middle (cx, cy). */
function pot(ctx: Ctx, cx: number, cy: number, s: number, tilt = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.scale(s, s);
  rect(ctx, -18, -5, 4, 2.4, '#2E2A2E');
  rect(ctx, 14, -5, 4, 2.4, '#2E2A2E');
  rect(ctx, -14, -8, 28, 16, '#8E9AA4');
  rect(ctx, -14, -8, 4, 16, '#B3BEC6');
  rect(ctx, 8, -8, 6, 16, '#6E7983');
  rect(ctx, -14, 6, 28, 2, '#5B656E');
  oval(ctx, 0, -8, 15, 2.8, '#C9D2D9');
  oval(ctx, 0, -8, 13, 1.8, '#2E3238');
  ctx.restore();
}
function reel(ctx: Ctx, x: number, y: number, r: number, turn: number) {
  disc(ctx, x, y, r, '#2B2F35');
  disc(ctx, x, y, r * 0.86, '#3D434B');
  for (let i = 0; i < 3; i++) {
    const a = turn + (i * TAU) / 3;
    disc(ctx, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.22, '#1C1F24');
  }
  disc(ctx, x, y, r * 0.16, '#A4ACB5');
}
/**
 * A boxy old projector with its lens to the right. (x, y) is the foot of the lamp housing;
 * the housing's chimney cap is 55 units up, the lens tip 111 across and 15 up.
 */
function projector(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  lamp: number,
  seconds: number,
  fever = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  line(ctx, '#23272C', 2.4, [48, -27, 46, -42]);
  line(ctx, '#23272C', 2.4, [80, -27, 78, -46]);
  line(ctx, '#15171A', 1, [46, -29, 60, -36, 78, -31]);
  const turn = seconds * 2.4 * lamp;
  reel(ctx, 46, -42, 13, turn);
  reel(ctx, 78, -46, 15, turn * 0.9);
  rect(ctx, 26, -28, 70, 28, '#3E5560');
  rect(ctx, 26, -28, 70, 3, '#5B7883');
  rect(ctx, 26, -3, 70, 3, '#2A3B42');
  rect(ctx, 52, -19, 22, 8, '#C9A36A');
  rect(ctx, 54, -17, 18, 4, '#8A6A3A');
  disc(ctx, 30, -24, 1, '#8FA6AE');
  disc(ctx, 92, -24, 1, '#8FA6AE');
  rect(ctx, 96, -21, 13, 12, '#26292E');
  rect(ctx, 96, -21, 13, 2, '#474C54');
  oval(ctx, 110, -15, 2.4, 5.5, mix('#56636E', '#FFF3CE', lamp));
  // The lamp housing at the back, with its chimney cap.
  rect(ctx, 0, -46, 26, 46, '#474C56');
  rect(ctx, 0, -46, 3, 46, '#5E6570');
  rect(ctx, 23, -46, 3, 46, '#353A42');
  const hot = lamp * (0.55 + fever * 0.45);
  for (let i = 0; i < 5; i++)
    rect(
      ctx,
      5,
      -40 + i * 7,
      16,
      2.4,
      mix('#1C1E24', '#FF9448', hot * (0.75 + Math.sin(seconds * 2 + i) * 0.25)),
    );
  rect(ctx, 4, -52, 18, 6, '#3A3F48');
  rect(ctx, 2, -55, 22, 3, mix('#5E6570', '#C9785A', hot * 0.6));
  ctx.restore();
}
/** A sagging strand of string lights. */
function lights(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sag: number,
  seconds: number,
  seed = 0,
) {
  const at = (t: number) => ({ x: lerp(x0, x1, t), y: lerp(y0, y1, t) + 4 * sag * t * (1 - t) });
  const pts: number[] = [];
  for (let i = 0; i <= 12; i++) pts.push(at(i / 12).x, at(i / 12).y);
  line(ctx, '#2A2230', 0.8, pts);
  const n = Math.max(2, Math.round(Math.abs(x1 - x0) / 9));
  for (let i = 1; i < n; i++) {
    const b = at(i / n);
    const color = BULBS[(i + seed) % BULBS.length];
    glow(ctx, b.x, b.y + 1.5, 6, color, 0.3 + Math.sin(seconds * 1.5 + i) * 0.06);
    disc(ctx, b.x, b.y + 1.5, 1.1, color);
  }
}
function smallDog(ctx: Ctx, x: number, y: number, s: number, seconds: number, up: boolean) {
  shade(ctx, x, y, 22 * s, 0.25);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-s, s);
  line(ctx, '#C9925E', 2, [-9, -6, -13, -10 + Math.sin(seconds * 10) * 2]);
  oval(ctx, -1, -5, 9, 5, '#C9925E');
  oval(ctx, 4, -6, 4, 4.5, '#EBC596');
  rect(ctx, -7, -2, 2.5, 2, '#8C5A36');
  rect(ctx, 3, -2, 2.5, 2, '#8C5A36');
  const hy = up ? -13 : -8;
  oval(ctx, 7, hy, 5, 4.5, '#C9925E');
  oval(ctx, 11.5, hy + 1, 3, 2.2, '#EBC596');
  disc(ctx, 14, hy + 0.5, 1, INK);
  oval(ctx, 4.5, hy + 1, 1.8, 3.6, '#8C5A36', 0.3);
  disc(ctx, 8.5, hy - 1, 0.8, INK);
  ctx.restore();
}
/** The dog up close: a huge snout, nose tip at (nx, ny), pointing right. */
function dogHead(ctx: Ctx, nx: number, ny: number, tilt: number, sniff: number, squint: boolean) {
  ctx.save();
  ctx.translate(nx, ny);
  ctx.rotate(tilt);
  oval(ctx, -130, -96, 62, 74, '#C9925E');
  oval(ctx, -78, -42, 48, 40, '#C9925E');
  oval(ctx, -36, -12, 34, 17, '#D29C68');
  oval(ctx, -32, -1, 26, 8, '#EBC596');
  oval(ctx, -104, -30, 15, 32, '#8C5A36', 0.35);
  const ex = -58,
    ey = -38;
  if (squint) line(ctx, INK, 2.2, [ex - 5, ey + 1, ex + 5, ey - 1]);
  else {
    oval(ctx, ex, ey, 5.5, 6, '#FFFFFF');
    disc(ctx, ex + 2, ey + 1, 3.2, INK);
    disc(ctx, ex + 1, ey - 1, 1, '#FFFFFF');
  }
  line(ctx, '#8C5A36', 2, [ex - 6, ey - 9, ex + 5, ey - 10 + (squint ? 3 : 0)]);
  const n = 1 + sniff * 0.18;
  oval(ctx, -7, -9, 8.5 * n, 6.5 * n, '#2A1E1C');
  oval(ctx, -9, -12.5, 3.2, 1.6, '#6E5E5A');
  oval(ctx, -2.5, -6.5, 1.8 * n, 1.2 * n, '#0E0808');
  line(ctx, '#6A4028', 1.4, [-6, -2, -16, 3, -30, 1]);
  for (let i = 0; i < 4; i++)
    disc(ctx, -22 - (i % 2) * 5, -12 + Math.floor(i / 2) * 4, 0.9, '#8C5A36');
  ctx.restore();
}
/** A foot in a sandal, toes to the right; y is the underside of the sole. */
function sandal(ctx: Ctx, x: number, y: number) {
  rect(ctx, x - 34, y - 300, 26, 270, '#E0A882');
  rect(ctx, x - 34, y - 300, 6, 270, '#C18762');
  poly(ctx, '#E0A882', [
    x - 36,
    y - 6,
    x - 34,
    y - 34,
    x - 8,
    y - 32,
    x + 16,
    y - 18,
    x + 34,
    y - 14,
    x + 38,
    y - 6,
  ]);
  for (let i = 0; i < 3; i++) disc(ctx, x + 26 + i * 4, y - 12 + i * 1.5, 4 - i, '#E8B292');
  rect(ctx, x - 38, y - 6, 78, 6, '#6B4632');
  disc(ctx, x - 38, y - 3, 3, '#6B4632');
  disc(ctx, x + 40, y - 3, 3, '#6B4632');
  poly(ctx, '#C8733F', [x - 6, y - 6, x + 2, y - 30, x + 8, y - 26, x + 2, y - 6]);
  rect(ctx, x - 36, y - 30, 28, 5, '#C8733F');
}
/** A crumpled picnic napkin; `flip` blows it away. */
function napkin(ctx: Ctx, x: number, y: number, flip: number) {
  if (flip >= 1) return;
  ctx.save();
  ctx.translate(x + flip * 100, y - flip * 120);
  ctx.rotate(-flip * 2.6);
  poly(ctx, '#F4EEE4', [-24, 0, -12, -28, 2, -36, 14, -24, 24, 0]);
  poly(ctx, '#D9D0C2', [2, -36, 6, 0, 24, 0, 14, -24]);
  for (let i = 0; i < 6; i++) rect(ctx, -22 + i * 8, -4, 4, 4, '#D8534A');
  rect(ctx, -9, -16, 4, 4, '#D8534A');
  if (flip === 0) poly(ctx, '#2A2530', [6, 0, 9, -13, 19, -12, 22, 0]);
  ctx.restore();
}
function peekEyes(ctx: Ctx, x: number, y: number, seconds: number) {
  const blink = Math.sin(seconds * 2.5) > 0.9;
  for (const side of [-1, 1]) {
    if (blink) rect(ctx, x + side * 3 - 2, y, 4, 0.8, '#FFFFFF');
    else {
      oval(ctx, x + side * 3, y, 2.2, 2.8, '#FFFFFF');
      disc(ctx, x + side * 3 - 0.9, y + 0.4, 1.1, INK);
    }
  }
}
/** A teacup on its saucer, around (x, y) on the ground. */
function teacup(ctx: Ctx, x: number, y: number, seconds: number) {
  shade(ctx, x, y + 1, 70, 0.3);
  oval(ctx, x, y - 2, 32, 4.5, '#E6DED0');
  oval(ctx, x, y - 3, 26, 3, '#F4EFE6');
  poly(ctx, '#F6F1E8', [
    x - 20,
    y - 32,
    x + 20,
    y - 32,
    x + 15,
    y - 8,
    x + 8,
    y - 4,
    x - 8,
    y - 4,
    x - 15,
    y - 8,
  ]);
  poly(ctx, '#DDD5C8', [x + 8, y - 32, x + 20, y - 32, x + 15, y - 8, x + 8, y - 4]);
  rect(ctx, x - 18.5, y - 26, 37, 4, '#6F95C6');
  line(ctx, '#F0EBE2', 3, [x + 19, y - 28, x + 27, y - 26, x + 27, y - 17, x + 14, y - 12]);
  oval(ctx, x, y - 32, 20, 3, '#FBF8F2');
  oval(ctx, x, y - 32, 17, 2, '#9A6A44');
  // Only the faintest steam: it has gone lukewarm.
  for (let i = 0; i < 2; i++) {
    const t = (seconds * 0.35 + i * 0.5) % 1;
    const pts: number[] = [];
    for (let k = 0; k <= 4; k++)
      pts.push(x - 5 + i * 9 + Math.sin(seconds * 2 + k + i) * 2.5, y - 36 - (t + k * 0.12) * 30);
    line(ctx, alpha('#FFFFFF', 0.3 * (1 - t)), 1.4, pts);
  }
}
/** Tapering grass blades rooted along `base`, only across [from, to]. */
function grass(
  ctx: Ctx,
  from: number,
  to: number,
  spacing: number,
  seed: number,
  base: number,
  low: number,
  high: number,
  colors: readonly string[],
  seconds: number,
  sway = 2.5,
) {
  for (let i = Math.floor(from / spacing); i <= Math.ceil(to / spacing); i++) {
    const x = i * spacing + (rand(seed + i * 2.1) - 0.5) * spacing;
    const h = lerp(low, high, rand(seed + i * 1.37));
    const w = 3 + rand(seed + i * 0.71) * 4;
    const lean = (rand(seed + i * 3.3) - 0.5) * 18 + Math.sin(seconds * 1.1 + i * 0.7) * sway;
    const color = colors[((i % colors.length) + colors.length) % colors.length];
    poly(ctx, color, [x - w / 2, base + 2, x + w / 2, base + 2, x + lean, base - h]);
  }
}

// ——— The cinema lawn, wide ———
const SCREEN = { x: 178, y: 16, w: 130, h: 74 } as const;
const LENS = { x: 125, y: 112 } as const;
const RUGS = [
  [150, 138, 34, 8, '#B8484A', '#EBC98A'],
  [196, 132, 40, 8, '#3E6E9A', '#F2E2B0'],
  [248, 136, 42, 8, '#C9A040', '#6A4A2A'],
  [172, 156, 46, 10, '#6A9A5A', '#F2E2B0'],
  [232, 160, 48, 10, '#9A5A8A', '#F2D0A0'],
  [288, 152, 32, 9, '#D07040', '#F6E6C0'],
] as const;
const SEATS = [
  [154, 140, '#E9A13B', '#3A2A24', 0],
  [200, 134, '#7FAF72', '#6B4A2A', 0],
  [212, 134, '#D86A5A', '#2A2226', 0],
  [224, 134, '#E8D6B0', '#8A6A4A', 1],
  [252, 138, '#9A7BC4', '#1E1A1E', 0],
  [266, 138, '#F0C85A', '#C9C4BD', 0],
  [178, 158, '#4F7A86', '#1E1A1E', 0],
  [192, 158, '#E98FA0', '#B6663E', 1],
  [206, 158, '#6B5AA0', '#3A2A24', 0],
  [238, 162, '#C8B08A', '#2B2026', 0],
  [252, 162, '#5E7A6A', '#6B3B2E', 1],
  [266, 162, '#D9694F', '#1E1A1E', 0],
  [292, 154, '#8E7F9C', '#3A2A24', 0],
  [304, 154, '#E7C47D', '#2B2026', 1],
] as const;
/** One of the audience, sitting with their back to us and facing the screen. */
function viewer(
  ctx: Ctx,
  x: number,
  y: number,
  coat: string,
  hair: string,
  kid: boolean,
  night: number,
  gasp: number,
  cheer: number,
  i: number,
  seconds: number,
) {
  const s = kid ? 0.78 : 1;
  const top = y - cheer * Math.abs(Math.sin(seconds * 7 + i * 1.7)) * 1.5 - gasp * (1 - cheer);
  const body = mix(coat, '#161A28', night * 0.75),
    head = mix(hair, '#0C0E16', night * 0.6);
  if (cheer > 0) {
    box(ctx, x - 4 * s, top - 15 * s, 1.5, 7 * s, body);
    box(ctx, x + 3.5 * s, top - 15 * s, 1.5, 7 * s, body);
  }
  box(ctx, x - 3 * s, top - 8 * s, 7 * s, 8 * s, body);
  disc(ctx, x + 0.5 * s, top - 11 * s, 3.2 * s, head);
  if (night) box(ctx, x + 3 * s, top - 13 * s, 1, 5 * s, alpha(WARM, 0.55));
}
function stand(ctx: Ctx, seconds: number, night: number) {
  box(ctx, 11, 62, 62, 52, '#5A2C2A');
  glow(ctx, 42, 84, 46, '#FFC98A', 0.5);
  box(ctx, 8, 56, 3, 76, '#6B3A34');
  box(ctx, 73, 56, 3, 76, '#6B3A34');
  box(ctx, 14, 34, 56, 16, '#2E1A1A');
  box(ctx, 16, 36, 52, 12, '#F6E3B8');
  write(ctx, 'POPCORN', 42, 45.5, { size: 7, color: RED });
  for (let i = 0; i < 9; i++)
    disc(ctx, 17 + i * 6.25, 34.5, 0.9, alpha('#FFE39A', 0.7 + Math.sin(seconds * 2 + i) * 0.3));
  for (let i = 0; i < 8; i++) {
    const c = i % 2 ? CREAM : RED;
    box(ctx, 5 + i * 9, 50, 9, 10, c);
    disc(ctx, 9.5 + i * 9, 60, 4.5, c);
  }
  if (!night)
    vendor(ctx, 40, 132, {
      size: 1.05,
      facing: 1,
      arms: [0.3, 1.2],
      eyes: 'happy',
      mouth: 'smile',
    });
  box(ctx, 5, 116, 72, 18, CREAM);
  for (let i = 0; i < 9; i++) box(ctx, 6 + i * 8, 116, 4, 18, RED);
  box(ctx, 3, 112, 76, 4, '#F2E2C4');
  pot(ctx, 24, 108, 0.5);
  if (!night) bucket(ctx, 60, 112, 0.36, 1, seconds);
}
function cinemaSet(ctx: Ctx, p: number, seconds: number, night: number) {
  sky(ctx, skyAt(night), 0, 116);
  glow(ctx, 30, 116, 160, '#FFB36E', 0.5 * (1 - night));
  starfield(ctx, seconds, { count: night ? 34 : 8, bottom: 92, seed: 5 });
  poly(
    ctx,
    mix('#3A2A48', '#0C1022', night),
    [
      0, 116, 0, 104, 18, 100, 34, 104, 52, 98, 70, 103, 92, 97, 118, 102, 140, 99, 164, 104, 190,
      100, 214, 103, 240, 98, 268, 102, 296, 99, 320, 103, 320, 116,
    ],
  );
  box(ctx, 0, 112, W, 68, mix('#4C6444', '#142020', night));
  box(ctx, 0, 112, W, 2, mix('#6A7A52', '#1E2C2A', night));
  box(ctx, 0, 146, W, 34, mix('#435A3C', '#101A1A', night));
  // The big screen: pale at dusk, lit by the film at night.
  const post = mix('#3A2E3A', '#12141E', night);
  box(ctx, SCREEN.x + 10, SCREEN.y + SCREEN.h, 4, 38, post);
  box(ctx, SCREEN.x + SCREEN.w - 14, SCREEN.y + SCREEN.h, 4, 38, post);
  box(ctx, SCREEN.x - 3, SCREEN.y - 3, SCREEN.w + 6, SCREEN.h + 6, '#231C28');
  const light = mix(mix('#DACDC4', '#5A617C', night), '#FFF0CE', night);
  box(ctx, SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, light);
  const drift = ease(span(p, T.cheer, T.float));
  if (night) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
    ctx.clip();
    glow(ctx, SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2, 80, '#FFFFFF', 0.35);
    // The biggest entrance in the town's history.
    shadowPuff(ctx, 243 - drift * 8, 50 + drift * 36, 31 - drift * 7, light, p > T.cheer);
    ctx.restore();
  }
  lights(ctx, 76, 50, SCREEN.x + 12, SCREEN.y - 3, 10, seconds, 0);
  lights(ctx, SCREEN.x + SCREEN.w - 12, SCREEN.y - 3, W + 10, 40, 6, seconds, 2);
  lights(ctx, -10, 36, 12, 52, 4, seconds, 1);
  stand(ctx, seconds, night);
  // The projector on its little table, just past the stand.
  box(ctx, 94, 116, 36, 2, '#6B4A36');
  box(ctx, 97, 118, 2, 12, '#4E3426');
  box(ctx, 126, 118, 2, 12, '#4E3426');
  projector(ctx, 98, 116, 0.24, night, seconds);
  RUGS.forEach(([x, y, w, h, c, stripe]) => {
    poly(ctx, mix(c, '#1A1E2A', night * 0.6), [x - 4, y, x + w, y, x + w - 4, y + h, x - 8, y + h]);
    box(ctx, x - 5, y + h / 2 - 0.5, w + 2, 1, mix(stripe, '#2A2E3A', night * 0.6));
  });
  const gasp = night ? span(p, T.gasp, T.gasp + 0.004) : 0;
  const cheer = night ? ease(span(p, T.cheer, T.cheer + 0.006)) : 0;
  SEATS.forEach(([x, y, coat, hair, kid], i) =>
    viewer(ctx, x, y, coat, hair, kid === 1, night, gasp, cheer, i, seconds),
  );
  person(ctx, 168, 141, {
    ...KID,
    size: 0.8,
    sitting: true,
    facing: 1,
    arms: cheer > 0 ? [2.8, 2.9] : [0.3, 0.6],
    eyes: gasp > 0 && cheer === 0 ? 'wide' : 'happy',
    mouth: gasp > 0 ? (cheer > 0 ? 'grin' : 'o') : 'smile',
  });
  smallDog(ctx, 146, 166, 0.8, seconds, night > 0);
  if (night) {
    lightCone(
      ctx,
      [
        LENS.x,
        LENS.y - 1.5,
        SCREEN.x,
        SCREEN.y,
        SCREEN.x + SCREEN.w,
        SCREEN.y,
        SCREEN.x + SCREEN.w,
        SCREEN.y + SCREEN.h,
        LENS.x,
        LENS.y + 1.5,
      ],
      LENS.x,
      LENS.y,
      SCREEN.x + SCREEN.w,
      SCREEN.y + SCREEN.h / 2,
      1,
    );
    motes(ctx, LENS.x, LENS.y, SCREEN.x + 60, SCREEN.y + 40, 60, 1, seconds);
    // Out on the lawn, the vendor looks up with the bucket.
    const f: Partial<Figure> = {
      size: 0.95,
      facing: 1,
      arms: [2.3, 2.5],
      eyes: cheer > 0 ? 'happy' : 'wide',
      mouth: cheer > 0 ? 'grin' : 'o',
    };
    vendor(ctx, 136, 178, f);
    const h = handsOf(136, 178, { ...VENDOR, ...f });
    bucket(ctx, h.x, h.y + 3, 0.36, 1, seconds, cheer);
    // Our hero, tiny and glowing in the beam.
    const px = lerp(134, 142, drift),
      py = lerp(104, 128, drift) + Math.sin(seconds * 2) * 1;
    glow(ctx, px, py, 18, WARM, 0.6);
    puff(ctx, px, py, 5.5, {});
  }
}
const CINEMA_CAMERA = [
  [0, 160, 90, 1],
  [0.012, 160, 90, 1],
  [0.045, 76, 100, 1.9],
  [0.695, 244, 56, 1.8],
  [0.707, 244, 56, 1.8],
  [0.735, 170, 92, 1],
  [0.75, 168, 92, 1],
] as const;
function cinemaScene(ctx: Ctx, p: number, seconds: number) {
  const night = p > 0.5 ? 1 : 0;
  camera(ctx, track(p, CINEMA_CAMERA), () => cinemaSet(ctx, p, seconds, night));
  vignette(ctx, 0.4);
}

// ——— The counter ———
const COUNTER_TOP = 118;
const COUNTER_END = 282;
const DISH = { x: 176, y: 118 } as const;
const BUCKET_AT = { x: 232, y: 118 } as const;
function counterBack(ctx: Ctx, seconds: number) {
  // Past the end of the counter: the lawn at dusk, where the runaway is headed.
  sky(ctx, DUSK, 0, 150, COUNTER_END, W - COUNTER_END);
  box(ctx, COUNTER_END, 132, W - COUNTER_END, 48, '#4C6444');
  for (let i = 0; i < 3; i++) {
    glow(ctx, 296 + i * 10, 60 + i * 6, 8, BULBS[i], 0.5);
    disc(ctx, 296 + i * 10, 60 + i * 6, 1.3, BULBS[i]);
  }
  box(ctx, 0, 0, COUNTER_END, COUNTER_TOP, '#5A2C2A');
  for (let x = 8; x < COUNTER_END; x += 16) box(ctx, x, 0, 1, COUNTER_TOP, '#4A2322');
  glow(ctx, 160, 30, 190, '#FFC98A', 0.28);
  box(ctx, 10, 74, 52, 3, '#3A1E1C');
  for (let i = 0; i < 3; i++) bucket(ctx, 20 + i * 16, 74, 0.5, 0, seconds);
  box(ctx, 110, 18, 100, 26, '#2E1A1A');
  box(ctx, 113, 21, 94, 20, '#F6E3B8');
  write(ctx, 'POPCORN', 160, 36, { size: 13, type: 'serif', color: RED });
  for (let i = 0; i < 14; i++)
    disc(
      ctx,
      116 + (i % 7) * 14.5,
      i < 7 ? 19.5 : 42.5,
      1.3,
      alpha('#FFE39A', 0.65 + Math.sin(seconds * 2 + i) * 0.3),
    );
  for (let i = 0; i < 16; i++) {
    const c = i % 2 ? CREAM : RED;
    box(ctx, i * 18, 0, 18, 7, c);
    disc(ctx, i * 18 + 9, 7, 9, c);
  }
  box(ctx, COUNTER_END - 2, 0, 6, H, '#6B3A34');
}
function counterFront(ctx: Ctx) {
  box(ctx, 0, COUNTER_TOP + 6, COUNTER_END, H, CREAM);
  for (let x = 0; x < COUNTER_END; x += 24) box(ctx, x, COUNTER_TOP + 6, 12, H, RED);
  box(ctx, 0, COUNTER_TOP, COUNTER_END + 2, 6, '#F2E2C4');
  box(ctx, 0, COUNTER_TOP + 5, COUNTER_END + 2, 1, '#C9B494');
  box(ctx, 0, 172, COUNTER_END, 8, '#8A2E2A');
}
function dish(ctx: Ctx, front: boolean) {
  const { x, y } = DISH;
  if (front) {
    oval(ctx, x, y + 0.4, 14, 1.8, '#E1E8EC');
    return;
  }
  oval(ctx, x, y - 1, 14, 3.8, '#B9C4CB');
  oval(ctx, x, y - 1.4, 11.5, 2.4, '#9FAAB2');
  line(ctx, '#C9A36A', 0.8, [x + 11, y - 2, x + 13, y - 16]);
  rect(ctx, x + 13, y - 17, 15, 7, '#FFF8EA');
  write(ctx, 'DUDS', x + 20.5, y - 11.6, { size: 5, color: '#8A2E2A' });
}
/** The kernel on the counter: tipped out, left behind, and off. */
function counterHero(p: number, seconds: number): { x: number; y: number; k: Kern } | null {
  if (p < T.tip) return null;
  if (p < T.plink) {
    const t = span(p, T.tip, T.plink);
    return {
      x: lerp(182, DISH.x, t),
      y: lerp(100, DISH.y - 1, easeIn(t)),
      k: { spin: t * TAU, arms: [2.5, 2.5], eyes: 'wide', mouth: 'o', brows: -0.6 },
    };
  }
  const sit = { x: DISH.x, y: DISH.y - 1 };
  if (p < T.lift) {
    const land = hump(p, T.plink, T.plink + 0.004);
    return {
      x: sit.x,
      y: sit.y - land * 3,
      k: {
        squash: 0.08 + land * 0.12,
        eyes: p < 0.203 ? 'shut' : 'sad',
        mouth: 'frown',
        brows: -0.7,
        look: [0.9, -0.5],
        arms: [0.1, 0.1],
      },
    };
  }
  if (p < 0.226)
    return {
      ...sit,
      k: {
        squash: 0.06,
        eyes: 'open',
        mouth: 'o',
        brows: -0.8,
        look: [1, -1],
        arms: [0.1, 1.5 + Math.sin(seconds * 6) * 0.1],
      },
    };
  if (p < T.resolve)
    return {
      ...sit,
      k: {
        squash: 0.14,
        eyes: 'sad',
        mouth: 'frown',
        brows: -0.9,
        look: [0, 0.8],
        arms: [0.05, 0.05],
      },
    };
  if (p < T.hop) {
    const up = ease(span(p, T.resolve, T.resolve + 0.004));
    const go = p > 0.239;
    return {
      ...sit,
      k: {
        squash: 0.14 * (1 - up),
        eyes: 'open',
        mouth: go ? 'grin' : 'flat',
        brows: up,
        look: [up, 0],
        arms: go ? [2.1, 2.1] : [0.2, 0.2],
        tilt: go ? Math.sin(seconds * 10) * 0.05 : 0,
      },
    };
  }
  if (p < 0.25) {
    const t = span(p, T.hop, 0.25);
    return {
      x: lerp(DISH.x, 192, t),
      y: lerp(sit.y, COUNTER_TOP, t) - hump(t, 0, 1) * 12,
      k: { arms: [2.4, 2.4], eyes: 'open', mouth: 'grin', brows: 1, squash: -0.1 },
    };
  }
  if (p < 0.259) {
    const step = seconds * 26;
    return {
      x: lerp(192, 276, ease(span(p, 0.25, 0.259))),
      y: COUNTER_TOP - Math.abs(Math.sin(step)) * 1.5,
      k: {
        step,
        arms: [0.5 + Math.sin(step) * 0.5, 0.5 - Math.sin(step) * 0.5],
        eyes: 'open',
        mouth: 'grin',
        brows: 1,
        look: [1, 0],
        tilt: 0.1,
      },
    };
  }
  if (p < 0.264) {
    const wave = Math.sin(seconds * 25) * 0.4;
    const gulp = p < 0.2625;
    return {
      x: lerp(276, 279, easeOut(span(p, 0.259, 0.261))),
      y: COUNTER_TOP,
      k: {
        tilt: -0.3 * (1 - span(p, 0.261, 0.263)) + Math.sin(seconds * 20) * 0.05,
        arms: [2.3 + wave, 2.3 - wave],
        eyes: 'wide',
        mouth: gulp ? 'o' : 'wobble',
        brows: gulp ? -0.8 : 0.9,
        look: [0.6, 1],
      },
    };
  }
  const t = span(p, 0.264, 0.268);
  return {
    x: lerp(279, 290, t),
    y: lerp(COUNTER_TOP, 196, easeIn(t)) - hump(t, 0, 0.5) * 6,
    k: { spin: t * 2, arms: [2.6, 2.6], eyes: 'shut', mouth: 'grin', brows: 1 },
  };
}
const COUNTER_CAMERA = [
  [0.045, 130, 92, 1.5],
  [0.07, 104, 92, 2.3],
  [0.185, 168, 96, 2],
  [0.2, 174, 100, 2.2],
  [0.2, 204, 94, 2.6],
  [0.245, 206, 96, 2.6],
  [0.259, 250, 104, 2.4],
  [0.264, 253, 110, 2.4],
  [0.268, 253, 132, 2.4],
] as const;
function counterScene(ctx: Ctx, p: number, seconds: number) {
  camera(ctx, track(p, COUNTER_CAMERA), () => {
    counterBack(ctx, seconds);
    let potAt = { x: 96, y: 95.6, tilt: 0 };
    let held: { x: number; y: number } = { ...BUCKET_AT };
    let cheer = 0;
    if (p < 0.1) {
      // Pouring the kernels in.
      const f: Partial<Figure> = {
        size: 2.6,
        facing: -1,
        arms: [0.3, 2.3],
        eyes: 'happy',
        mouth: 'smile',
      };
      vendor(ctx, 128, 152, f);
    } else if (p < 0.2) {
      // Peering in, then tipping the last kernel out.
      const tip = ease(span(p, 0.186, T.tip));
      vendor(ctx, 150, 152, {
        size: 2.6,
        facing: 1,
        arms: [1.1, 1.35],
        eyes: p < T.plink ? 'open' : 'closed',
        mouth: p < T.plink ? 'flat' : 'smile',
      });
      potAt = { x: lerp(160, 169, tip), y: lerp(90, 94, tip), tilt: tip * 2 };
      cheer = 0.3;
    } else {
      // Off to the lawn with the full bucket.
      const lift = ease(span(p, T.lift, T.lift + 0.008));
      const away = easeIn(span(p, 0.222, 0.236));
      const f: Partial<Figure> = {
        size: 2.6,
        facing: 1,
        arms: [lerp(0.9, 2, lift), lerp(1, 2.1, lift)],
        step: away > 0 && away < 1 ? seconds * 12 : undefined,
        eyes: 'happy',
        mouth: 'grin',
      };
      const vx = 208 + away * 150;
      vendor(ctx, vx, 152, f);
      const h = handsOf(vx, 152, { ...VENDOR, ...f });
      held = { x: h.x + 1, y: h.y + 9.2 };
      cheer = 1;
    }
    counterFront(ctx);
    // The burner glows under the pot until the pot is lifted off.
    box(ctx, 78, 110, 36, 8, '#2E2A2E');
    if (p < 0.1) {
      glow(ctx, 96, 112, 26, '#FF8A3A', 0.55);
      shimmer(ctx, 80, 112, 80, 40, 0.6, seconds, 4);
    }
    dish(ctx, false);
    if (p < 0.2 || p < T.lift) pot(ctx, potAt.x, potAt.y, 1.8, potAt.tilt);
    else pot(ctx, 96, 95.6, 1.8);
    bucket(ctx, held.x, held.y, 1.35, p < 0.1 ? 0 : 1, seconds, cheer);
    if (within(p, T.pour, T.poured)) {
      // A stream of kernels from the scoop into the pot.
      const hand = handOf(128, 152, { ...VENDOR, size: 2.6, facing: -1, arms: [0.3, 2.3] });
      ctx.save();
      ctx.translate(hand.x, hand.y);
      ctx.rotate(-0.5);
      rect(ctx, -12, -3, 13, 6, '#A9B4BD');
      rect(ctx, -12, -3, 13, 1.5, '#D5DDE4');
      ctx.restore();
      for (let i = 0; i < 9; i++) {
        const t = (seconds * 2.2 + i / 9) % 1;
        const kx = lerp(hand.x - 11, 96, t) + Math.sin(i * 3.1) * 2,
          ky = lerp(hand.y + 6, 86, easeIn(t));
        oval(ctx, kx, ky, 1.3, 1.7, GOLD, t * 5);
      }
    }
    const hero = counterHero(p, seconds);
    if (hero) kernel(ctx, hero.x, hero.y, { size: 1.05, ...hero.k }, seconds);
    dish(ctx, true);
  });
  vignette(ctx, 0.42);
}

// ——— Inside the pot ———
const POT_CAMERA = [
  [0.07, 160, 100, 1.1],
  [0.1, 160, 118, 1.4],
  [0.1, 160, 126, 2.1],
  [0.123, 160, 130, 2.3],
  [0.123, 160, 138, 3.1],
  [0.156, 160, 138, 3.3],
  [0.165, 160, 136, 3.1],
  [0.165, 160, 90, 1],
  [0.185, 160, 92, 1.06],
] as const;
function potHero(p: number, seconds: number): { dy: number; k: Kern } {
  const size = HERO_POT.size;
  let last = -1;
  POPS.forEach((at, i) => {
    if (p >= at) last = i;
  });
  if (p < 0.123) {
    const hop = p > T.heat ? Math.abs(Math.sin(((p - T.heat) / BEAT + 0.6) * Math.PI)) * 2 : 0;
    if (last < 0)
      return {
        dy: -hop,
        k: {
          size,
          eyes: 'open',
          mouth: 'smile',
          brows: 0.1,
          arms: [0.9, 0.9],
          look: [Math.sin(seconds * 2) * 0.6, 0],
        },
      };
    const flinch = hump(p, POPS[last], POPS[last] + 0.004);
    return {
      dy: -hop * 0.5,
      k: {
        size,
        eyes: flinch > 0.3 ? 'wide' : 'open',
        mouth: flinch > 0.3 ? 'o' : 'wobble',
        brows: -0.4 - span(p, 0.081, 0.12) * 0.6,
        look: [clamp((popperX(last) - 160) / 60, -1, 1), -0.3],
        squash: flinch * 0.14,
        arms: flinch > 0.3 ? [1.8, 1.8] : [0.3, 0.3],
      },
    };
  }
  if (p < T.strain)
    return {
      dy: 0,
      k: {
        size,
        eyes: 'open',
        mouth: 'flat',
        brows: -0.5,
        look: [Math.sin(seconds * 3), 0],
        arms: [0.1, 0.1],
      },
    };
  if (p < T.pff) {
    const s = span(p, T.strain, T.pff);
    return {
      dy: 0,
      k: {
        size,
        eyes: 'shut',
        mouth: 'grit',
        brows: 1,
        heat: s * 0.9,
        shake: 0.25 + s * 1.2,
        squash: -0.04 * s + Math.sin(seconds * 30) * 0.03 * s,
        arms: [2, 2],
        blush: s,
      },
    };
  }
  if (p < 0.165)
    return {
      dy: 0,
      k: {
        size,
        eyes: 'sad',
        mouth: 'frown',
        brows: -0.8,
        heat: 0.9 * (1 - span(p, T.pff, T.pff + 0.006)),
        squash: 0.12,
        arms: [0.05, 0.05],
      },
    };
  const wave = within(p, 0.174, 0.182);
  return {
    dy: 0,
    k: {
      size,
      eyes: within(p, 0.168, 0.173) ? 'wide' : 'open',
      mouth: p < 0.173 ? 'o' : 'smile',
      brows: -0.6,
      look: [-0.1, -1],
      arms: wave ? [0.2, 2.5 + Math.sin(seconds * 14) * 0.35] : [0.2, 0.2],
      blush: 0.6,
    },
  };
}
function potScene(ctx: Ctx, p: number, seconds: number) {
  const heat = ease(span(p, T.heat, 0.1));
  camera(ctx, track(p, POT_CAMERA), () => {
    // Above the rim: the underside of the striped awning.
    for (let x = 0; x < W; x += 24) {
      box(ctx, x, 0, 12, 64, '#B23E38');
      box(ctx, x + 12, 0, 12, 64, '#E6D2BC');
    }
    box(ctx, 0, 0, W, 64, alpha('#1A0C10', 0.35));
    glow(ctx, 70, 14, 60, '#FFD89A', 0.5);
    glow(ctx, 250, 12, 60, '#FFD89A', 0.5);
    const peek = ease(span(p, T.peek - 0.004, T.peek + 0.002));
    if (peek > 0)
      vendor(ctx, 150, 146 + (1 - peek) * 70, {
        size: 4,
        facing: 1,
        arms: [0.1, 0.1],
        lean: 0.1,
        eyes: p < 0.173 ? 'wide' : 'open',
        mouth: p < 0.176 ? 'o' : 'smile',
      });
    // The pot: rim, inner wall, and a floor that glows as it heats.
    oval(ctx, 160, 124, 196, 80, '#B7C1C9');
    const wall = ctx.createLinearGradient(0, 50, 0, 150);
    wall.addColorStop(0, '#2A2D34');
    wall.addColorStop(1, mix('#565B64', '#9A5A3A', heat * 0.8));
    ctx.fillStyle = wall;
    ctx.beginPath();
    ctx.ellipse(160, 126, 188, 75, 0, 0, TAU);
    ctx.fill();
    for (const [x, w] of [
      [64, 5],
      [88, 2],
      [240, 4],
      [266, 2],
    ] as const)
      oval(ctx, x, 88, w, 28, alpha('#D5DDE4', 0.22));
    oval(ctx, 160, 150, 152, 36, mix('#454A53', '#5E4A40', heat));
    oval(ctx, 138, 145, 92, 17, alpha(mix('#6A6660', '#D08A48', heat), 0.45));
    glow(ctx, 160, 168, 180, '#FF7A2A', 0.06 + heat * (p < 0.165 ? 0.3 : 0.18));
    shimmer(ctx, 30, 290, 150, 110, heat * 0.8, seconds, 7);
    // The crowd, back to front; popped ones fly up to the bucket, cheering.
    const flying: (() => void)[] = [];
    for (const { i } of POT_ORDER) {
      if (i < 0) {
        const hero = potHero(p, seconds);
        kernel(ctx, HERO_POT.x, HERO_POT.y + hero.dy, hero.k, seconds);
        continue;
      }
      const [x, y, size, order] = CROWD[i];
      const at = POPS[order];
      if (p < at) {
        const hop =
          p > T.heat
            ? Math.abs(Math.sin(((p - T.heat) / BEAT + i * 0.37) * Math.PI)) * (1.5 + heat * 4)
            : 0;
        const nerves = span(p, at - 0.005, at);
        kernel(
          ctx,
          x,
          y - hop,
          {
            size,
            tint: TINTS[i % TINTS.length],
            eyes: 'dots',
            mouth: nerves > 0 ? 'o' : 'smile',
            arms: null,
            squash: -nerves * 0.14,
            shake: nerves * 0.7,
            heat: nerves * 0.25,
          },
          seconds,
        );
      } else if (p < at + 0.024)
        flying.push(() => {
          const t = span(p, at, at + 0.024);
          const bloom = backOut(span(p, at, at + 0.0045));
          const rise = easeIn(span(p, at + 0.003, at + 0.024));
          burst(ctx, x, y - 9 * size, 9 * size, span(p, at, at + 0.007));
          puff(
            ctx,
            x + (x - 160) * 0.3 * rise + Math.sin(t * 8 + i) * 3,
            y - 9 * size - rise * 200,
            8 * size * bloom,
            {
              lobes: 5,
              eyes: 'happy',
              mouth: 'grin',
              rot: rise * (i % 2 ? 1.5 : -1.5),
            },
          );
        });
    }
    flying.forEach((paint) => paint());
    steam(ctx, HERO_POT.x, HERO_POT.y - 30, 3, span(p, T.pff, T.pff + 0.008));
  });
  vignette(ctx, 0.45);
}

// ——— The field: a kernel's-eye lawn, with the projector table at the far end ———
const GROUND = 150;
const SIZE = 1.2;
const SANDAL_X = 182;
const NAPKIN_X = 256;
const CUP_X = 458;
const WIRE = { x0: 520, y0: GROUND, x1: 620, y1: -40 } as const;
const BULB = { x: 548, y: 110 } as const;
const CAP = { x: 707, y: 0 } as const;
const PROJ_LENS = { x: 805, y: 40 } as const;
const CORD = { x0: 646, y0: GROUND, cx: 650, cy: 26, x1: 694, y1: 20 } as const;
const wireAt = (u: number) => ({
  x: lerp(WIRE.x0, WIRE.x1, u),
  y: lerp(WIRE.y0, WIRE.y1, u),
});
const cordAt = (u: number) => {
  const a = (1 - u) ** 2,
    b = 2 * (1 - u) * u,
    c = u * u;
  return {
    x: a * CORD.x0 + b * CORD.cx + c * CORD.x1,
    y: a * CORD.y0 + b * CORD.cy + c * CORD.y1,
    angle: Math.atan2(
      2 * (1 - u) * (CORD.cy - CORD.y0) + 2 * u * (CORD.y1 - CORD.cy),
      2 * (1 - u) * (CORD.cx - CORD.x0) + 2 * u * (CORD.x1 - CORD.cx),
    ),
  };
};
/** Where the kernel stands on the cord: hugging its outer side. */
const onCord = (u: number) => {
  const c = cordAt(u);
  return {
    x: c.x + Math.sin(c.angle) * 7,
    y: c.y - Math.cos(c.angle) * 7,
    tilt: c.angle + Math.PI / 2,
  };
};
function footY(p: number) {
  if (p < T.stomp) return GROUND - (1 - easeIn(span(p, 0.29, T.stomp))) * 160;
  if (p < 0.3) return GROUND;
  return GROUND - easeIn(span(p, 0.3, 0.306)) * 180;
}
function dogPose(p: number, seconds: number) {
  const sniff = Math.max(...T.sniffs.map((s) => hump(p, s, s + 0.0025)));
  if (p < 0.321) {
    const t = ease(span(p, 0.314, 0.321));
    return { nx: lerp(150, 238, t), ny: lerp(30, 134, t), tilt: 0.3, sniff, squint: false };
  }
  if (p < 0.323)
    return { nx: 238 + span(p, 0.321, 0.323) * 4, ny: 134, tilt: 0.3, sniff, squint: false };
  if (p < 0.327) {
    const t = ease(span(p, 0.323, 0.327));
    return {
      nx: lerp(242, 250, t),
      ny: 138 - hump(t, 0, 1) * 8,
      tilt: 0.3 - hump(t, 0, 1) * 0.2,
      sniff,
      squint: false,
    };
  }
  if (p < T.sneeze) {
    const ah = span(p, 0.331, T.sneeze);
    return {
      nx: 250,
      ny: 139 - ah * 5,
      tilt: 0.3 - ah * 0.15 + (ah > 0 ? Math.sin(seconds * 40) * 0.03 : 0),
      sniff: Math.max(sniff, ah),
      squint: ah > 0,
    };
  }
  const t = span(p, T.sneeze, 0.343);
  return {
    nx: lerp(250, 150, easeIn(t)) - hump(t, 0, 0.2) * 10,
    ny: lerp(134, 20, easeIn(t)),
    tilt: 0.3 - hump(t, 0, 0.3) * 0.3,
    sniff: 0,
    squint: t < 0.4,
  };
}
/** The hero's journey across the lawn, as a position and a pose. */
function fieldHero(p: number, seconds: number): { x: number; y: number; k: Kern } | null {
  const at = (x: number, y: number, k: Kern) => ({ x, y, k: { size: SIZE, ...k } });
  const walking = (from: number, to: number, a: number, b: number, speed = 18) => {
    const step = seconds * speed;
    return {
      x: lerp(from, to, ease(span(p, a, b))),
      y: GROUND - Math.abs(Math.sin(step)) * 1.5,
      step,
    };
  };
  if (p < T.land) {
    const t = span(p, 0.268, T.land);
    return at(66, lerp(-40, GROUND, easeIn(t)), {
      spin: t * TAU,
      arms: [2.6, 2.6],
      eyes: 'wide',
      mouth: 'o',
      brows: -0.6,
    });
  }
  if (p < 0.283) {
    const hop = hump(p, T.land, 0.2795) * 16 + hump(p, 0.2795, 0.283) * 5;
    const squash =
      0.28 *
      Math.max(hump(p, T.land, T.land + 0.002), hump(p, 0.279, 0.2805), hump(p, 0.2825, 0.2835));
    return at(lerp(66, 76, span(p, T.land, 0.283)), GROUND - hop, {
      squash,
      arms: null,
      eyes: 'shut',
      mouth: 'wobble',
    });
  }
  if (p < 0.2875)
    return at(76, GROUND, {
      eyes: 'open',
      mouth: 'flat',
      brows: 0.3,
      look: [p < 0.2855 ? -1 : 1, 0],
      arms: [0.3, 0.3],
    });
  if (p < T.stomp) {
    const w = walking(76, 128, 0.2875, T.stomp);
    return at(w.x, w.y, {
      step: w.step,
      arms: [0.3 + Math.sin(w.step) * 0.4, 0.3 - Math.sin(w.step) * 0.4],
      eyes: 'open',
      mouth: 'flat',
      brows: 0.7,
      look: [1, 0],
    });
  }
  if (p < 0.297) {
    const t = span(p, T.stomp, 0.297);
    return at(lerp(128, 114, easeOut(t)), GROUND - hump(t, 0, 1) * 10, {
      arms: [2.7, 2.7],
      eyes: 'wide',
      mouth: 'o',
      brows: -1,
      squash: -0.15,
      shake: 0.6,
    });
  }
  if (p < 0.302)
    return at(114, GROUND, {
      arms: [2.2, 2.2],
      eyes: 'wide',
      mouth: 'wobble',
      brows: -1,
      look: [1, -0.6],
      shake: 0.4,
    });
  if (p < 0.306)
    return at(114, GROUND, {
      arms: [0.2, 2.6],
      eyes: 'closed',
      mouth: 'flat',
      brows: -0.3,
      squash: 0.06,
    });
  if (p < T.hide) {
    const w = walking(114, 226, 0.306, 0.3125);
    const glance = p > 0.3115;
    return at(w.x, w.y, {
      step: w.step,
      arms: [0.3, 0.3],
      eyes: glance ? 'wide' : 'open',
      mouth: glance ? 'o' : 'smile',
      brows: glance ? -0.8 : 0.4,
      look: glance ? [-1, -1] : [1, 0],
    });
  }
  if (p < 0.317) {
    const t = span(p, T.hide, 0.317);
    return at(lerp(226, NAPKIN_X + 6, t), GROUND - hump(t, 0, 1) * 8, {
      arms: [2.4, 2.4],
      eyes: 'wide',
      mouth: 'o',
      brows: -1,
    });
  }
  // Under the napkin, only its eyes show until the dog flips it away.
  if (p < 0.323) return null;
  if (p < T.sneeze)
    return at(NAPKIN_X + 6, GROUND, {
      arms: [-1.1, -1.1],
      eyes: 'wide',
      mouth: 'wobble',
      brows: -1,
      look: [-1, -0.3],
      squash: 0.12,
      shake: 0.5,
    });
  if (p < T.flop) {
    const t = span(p, T.sneeze, T.flop);
    return at(lerp(NAPKIN_X + 6, 400, easeOut(t)), GROUND - hump(t, 0, 1) * 56, {
      spin: t * TAU * 2,
      arms: [2.6, 2.6],
      eyes: 'wide',
      mouth: 'o',
      brows: -0.8,
    });
  }
  if (p < 0.348)
    return at(400, GROUND, {
      squash: hump(p, T.flop, T.flop + 0.003) * 0.3,
      eyes: 'shut',
      mouth: 'wobble',
      tilt: Math.sin(seconds * 9) * 0.15,
      arms: [0.6, 0.6],
    });
  if (p < 0.3515) {
    const w = walking(400, 428, 0.349, 0.3515);
    return at(w.x, GROUND, {
      step: w.step,
      eyes: 'wide',
      mouth: 'smile',
      brows: 0.5,
      look: [1, -0.6],
      arms: [1.2, 1.2],
    });
  }
  if (p < T.shiver)
    return at(430, GROUND - 2, {
      tilt: 0.22,
      eyes: 'closed',
      mouth: 'smile',
      blush: 0.6,
      arms: [0.4, 1.9],
      heat: span(p, 0.3515, T.shiver) * 0.12,
      lit: 0.3,
    });
  if (p < 0.361)
    return at(430, GROUND - 2, {
      eyes: 'open',
      look: [0.6, -0.6],
      mouth: 'flat',
      shake: 0.7,
      brows: -0.4,
      arms: [0.3, 0.3],
      heat: 0.12 * (1 - span(p, T.shiver, 0.361)),
    });
  if (p < 0.365)
    return at(430, GROUND - 2, { arms: [2.2, 2.2], eyes: 'closed', mouth: 'flat', brows: -0.6 });
  if (p < T.climb) {
    const w = walking(430, 516, 0.365, T.climb);
    return at(w.x, w.y, {
      step: w.step,
      eyes: 'open',
      mouth: 'smile',
      brows: 0.6,
      look: [1, -0.5],
      arms: [0.4, 0.4],
    });
  }
  if (p < T.hug) {
    const w = wireAt(lerp(0.03, 0.22, ease(span(p, T.climb, T.hug))));
    const pull = Math.sin(seconds * 16) * 0.35;
    return at(w.x - 6.2, w.y - 3.3, {
      tilt: 0.48,
      arms: [2.5 + pull, 2.5 - pull],
      eyes: 'open',
      mouth: 'grit',
      brows: 1,
      look: [0, -1],
    });
  }
  const cling = { x: BULB.x - 11, y: BULB.y + 14 };
  if (p < T.fizzle) {
    const warm = span(p, T.hug, T.fizzle);
    return at(cling.x, cling.y, {
      tilt: 0.35,
      arms: [0.3, 1.8],
      eyes: 'closed',
      mouth: 'smile',
      blush: 0.8,
      heat: warm * 0.45,
      shake: 0.2 + warm * 0.3,
      lit: 0.8,
    });
  }
  if (p < T.drop)
    return at(cling.x, cling.y, {
      tilt: 0.35,
      arms: [0.3, 1.8],
      eyes: p < 0.3935 ? 'open' : 'sad',
      look: [0, -1],
      mouth: 'frown',
      heat: 0.45 * (1 - span(p, T.fizzle, T.drop)),
      lit: 0.8,
      brows: -0.6,
    });
  if (p < 0.398) {
    const t = span(p, T.drop, 0.398);
    return at(cling.x, lerp(cling.y, GROUND, easeIn(t)), {
      arms: [2.4, 2.4],
      eyes: 'sad',
      mouth: 'o',
      tilt: 0.35 * (1 - t),
    });
  }
  if (p < 0.402)
    return at(cling.x, GROUND, {
      squash: 0.28 - span(p, 0.398, 0.402) * 0.1,
      eyes: 'sad',
      mouth: 'frown',
      brows: -0.8,
      arms: null,
    });
  if (p < T.sit) {
    const step = seconds * 8;
    return at(lerp(cling.x, 736, span(p, 0.402, T.sit)), GROUND - Math.abs(Math.sin(step)) * 0.6, {
      step,
      arms: [0.05, 0.05],
      eyes: 'sad',
      mouth: 'frown',
      brows: -0.8,
      tilt: 0.06,
      look: [0.4, 0.6],
    });
  }
  if (p < T.beam) {
    const shiver = Math.max(0, Math.sin(seconds * 2.1)) ** 8;
    return at(736, GROUND, {
      squash: 0.14,
      arms: [-1.1, -1.1],
      eyes: Math.sin(seconds * 1.3) > 0.97 ? 'closed' : 'sad',
      mouth: 'frown',
      brows: -0.9,
      look: [0, 0.6],
      shake: shiver * 0.6,
    });
  }
  if (p < T.out) {
    const up = ease(span(p, 0.487, 0.494));
    const noticed = p > 0.481;
    return at(736, GROUND, {
      squash: 0.14 * (1 - up),
      arms: up > 0 ? [0.2, 0.2] : [-1.1, -1.1],
      eyes: noticed ? 'wide' : 'sad',
      mouth: noticed ? 'o' : 'frown',
      brows: noticed ? 0 : -0.9,
      look: [0.9, -0.9],
      lit: 0.5 * span(p, T.beam, T.out),
    });
  }
  if (p < 0.506) {
    const w = walking(736, 812, T.out, 0.5055, 16);
    return at(w.x, GROUND, {
      step: w.step,
      arms: [0.3, 0.3],
      eyes: 'open',
      mouth: 'smile',
      brows: 0.2,
      look: [0.3, -1],
      lit: 0.8,
    });
  }
  if (p < T.run) {
    const bright = p > T.idea,
      go = p > 0.515;
    return at(812, GROUND, {
      arms: go ? [0.3, 2.8] : [0.3, 0.3],
      eyes: bright && !go ? 'wide' : 'open',
      mouth: bright ? 'grin' : 'o',
      brows: go ? 1 : bright ? -0.5 : 0,
      look: go ? [-1, -0.4] : [-0.7, -1],
      lit: 1,
      squash: bright && !go ? -0.1 : 0,
    });
  }
  if (p < T.cord) {
    const w = walking(812, 650, T.run, 0.543, 26);
    return at(w.x, w.y, {
      step: w.step,
      arms: [0.8 + Math.sin(w.step) * 0.6, 0.8 - Math.sin(w.step) * 0.6],
      eyes: 'open',
      mouth: 'grin',
      brows: 1,
      look: [-1, 0],
      tilt: -0.16,
      lit: 0.6,
    });
  }
  if (p < T.top) {
    const g = span(p, T.cord, T.top) * GRABS;
    const k = Math.min(GRABS - 1, Math.floor(g));
    const c = onCord((k + ease(g - k)) / GRABS);
    const reach = (k % 2 ? 1 : -1) * 0.4;
    return at(c.x, c.y, {
      tilt: c.tilt,
      arms: [2.5 + reach, 2.5 - reach],
      eyes: 'open',
      mouth: 'grit',
      brows: 1,
      look: [0, -1],
      lit: 0.7,
    });
  }
  if (p < 0.582) {
    const t = span(p, T.top, 0.582);
    const c = onCord(1);
    return at(lerp(c.x, CAP.x, t), lerp(c.y, CAP.y, t) - hump(t, 0, 1) * 12, {
      tilt: lerp(c.tilt, 0, ease(t)),
      arms: [2.4, 2.4],
      eyes: 'open',
      mouth: 'grin',
      brows: 1,
      lit: 0.8,
    });
  }
  if (p < T.perch) {
    const step = seconds * 30;
    return at(CAP.x, CAP.y - Math.abs(Math.sin(seconds * 15)) * 2.5, {
      step,
      arms: [1.4 + Math.sin(step) * 0.6, 1.4 - Math.sin(step) * 0.6],
      eyes: 'wide',
      mouth: 'o',
      brows: -0.5,
      heat: 0.15,
      lit: 0.8,
    });
  }
  if (p < T.still) {
    const f = span(p, T.perch, T.still);
    return at(CAP.x, CAP.y, {
      size: SIZE * (1 + 0.1 * easeIn(f)),
      eyes: 'shut',
      mouth: 'grit',
      brows: 1,
      heat: 0.15 + f * 0.8,
      shake: 0.15 + f * 1.1,
      squash: Math.sin(seconds * 30) * 0.035 * f,
      arms: [2.1, 2.1],
      blush: f,
      lit: 0.8,
    });
  }
  if (p < T.pop)
    return at(CAP.x, CAP.y, {
      size: SIZE * 1.12,
      eyes: 'wide',
      mouth: 'o',
      brows: -0.5,
      heat: 0.95,
      arms: [0.4, 0.4],
      lit: 0.8,
    });
  return null;
}
function projectorTable(ctx: Ctx, night: number, lamp: number, fever: number, seconds: number) {
  const wood = mix('#6B4A36', '#241A18', night * 0.8),
    dark = mix('#4E3426', '#140E0E', night * 0.8);
  box(ctx, 686, 62, 10, 90, dark);
  box(ctx, 784, 62, 10, 90, dark);
  box(ctx, 686, 62, 3, 90, wood);
  box(ctx, 678, 55, 124, 8, wood);
  box(ctx, 678, 55, 124, 2, mix('#8C6448', '#3A2C26', night * 0.7));
  ctx.strokeStyle = '#1C1A1E';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(CORD.x0, CORD.y0 + 1);
  ctx.quadraticCurveTo(CORD.cx, CORD.cy, CORD.x1, CORD.y1);
  ctx.stroke();
  line(ctx, '#1C1A1E', 2.4, [CORD.x0, CORD.y0 + 1, 620, GROUND + 2]);
  projector(ctx, 694, 55, 1, lamp, seconds, fever);
}
function fieldSet(
  ctx: Ctx,
  p: number,
  seconds: number,
  view: View,
  night: number,
  lamp: number,
  fever: number,
) {
  const hw = W / 2 / view.zoom + 24;
  const x0 = view.x - hw,
    x1 = view.x + hw;
  const tone = (day: string, dark: string) => mix(day, dark, night);
  // Far grass drifts slower than the rest.
  ctx.save();
  ctx.translate(view.x * 0.4, 0);
  grass(
    ctx,
    x0 - view.x * 0.4,
    x1 - view.x * 0.4,
    9,
    3,
    GROUND - 6,
    16,
    44,
    [tone('#8C7466', '#1B2340'), tone('#7C6A62', '#172038')],
    seconds,
    1.5,
  );
  ctx.restore();
  box(ctx, x0, GROUND, x1 - x0, 400, tone('#3E4A2C', '#10181A'));
  box(ctx, x0, GROUND, x1 - x0, 2, tone('#56643A', '#18242A'));
  grass(
    ctx,
    x0,
    x1,
    6,
    7,
    GROUND,
    24,
    62,
    [tone('#5E7A3E', '#1C2E30'), tone('#4E6A36', '#16262A'), tone('#6E8A46', '#223838')],
    seconds,
  );
  glow(ctx, 860, 110, 150, WARM, 0.2 * lamp);
  // Landmarks along the way.
  if (x0 < 60) {
    box(ctx, 14, -300, 20, 452, tone('#6B4A36', '#221A18'));
    box(ctx, 14, -300, 4, 452, tone('#8A6448', '#2A201C'));
    for (let y = -290; y < GROUND; y += 22) box(ctx, 20, y, 8, 1, tone('#5A3C2C', '#1A1412'));
  }
  if (x1 > 620) {
    projectorTable(ctx, night, lamp, fever, seconds);
    lightCone(
      ctx,
      [PROJ_LENS.x, PROJ_LENS.y - 4, 1500, -180, 1500, 120, PROJ_LENS.x, PROJ_LENS.y + 4],
      PROJ_LENS.x,
      PROJ_LENS.y,
      1100,
      20,
      lamp,
    );
    motes(ctx, PROJ_LENS.x, PROJ_LENS.y, 1000, 10, 90, lamp, seconds);
    shimmer(ctx, 680, 734, CAP.y + 4, 50, lamp * (0.15 + fever * 0.35), seconds, 6);
    glow(ctx, CAP.x, CAP.y + 6, 40, '#FF8A3A', lamp * (0.15 + fever * 0.35));
  }
  if (x0 < 620 && x1 > 480) {
    // A strand of string lights pegged down in the grass, one bulb glowing low.
    line(ctx, '#2A2A2E', 1.4, [WIRE.x0, WIRE.y0, WIRE.x1, WIRE.y1]);
    box(ctx, WIRE.x0 - 2, GROUND - 12, 5, 14, tone('#7A5A40', '#2A2020'));
    box(ctx, BULB.x - 4, 96, 8, 7, '#2E2E34');
    glow(ctx, BULB.x, BULB.y, 60, '#FFD27A', 0.45);
    oval(ctx, BULB.x, BULB.y, 6.5, 8.5, '#FFE9A8');
    oval(ctx, BULB.x - 2, BULB.y - 3, 1.8, 3, '#FFFBEA');
    line(ctx, '#E0A040', 0.8, [BULB.x - 2, BULB.y + 1, BULB.x, BULB.y - 2, BULB.x + 2, BULB.y + 1]);
  }
  if (x0 < CUP_X + 40 && x1 > CUP_X - 40) teacup(ctx, CUP_X, GROUND, seconds);
  if (within(p, 0.286, 0.306)) sandal(ctx, SANDAL_X, footY(p));
  // The dog's shadow falls, then its nose arrives.
  if (within(p, 0.312, 0.343)) {
    const shadow = hump(p, 0.312, 0.343);
    oval(ctx, 210, GROUND + 1, 90 * shadow, 7, alpha('#0B0E14', 0.35 * shadow));
  }
  const hero = fieldHero(p, seconds);
  if (hero) kernel(ctx, hero.x, hero.y, hero.k, seconds);
  if (p < 0.34) napkin(ctx, NAPKIN_X, GROUND, ease(span(p, 0.323, 0.33)));
  if (within(p, 0.317, 0.323)) peekEyes(ctx, NAPKIN_X + 14, GROUND - 6, seconds);
  if (within(p, 0.314, 0.343)) {
    const d = dogPose(p, seconds);
    dogHead(ctx, d.nx, d.ny, d.tilt, d.sniff, d.squint);
    if (d.sniff > 0.2)
      for (let i = 0; i < 3; i++) {
        const k = (seconds * 3 + i / 3) % 1;
        line(ctx, alpha('#FFFFFF', 0.5 * (1 - k)), 0.8, [
          d.nx + 18 - k * 14,
          d.ny - 12 + i * 5,
          d.nx + 12 - k * 14,
          d.ny - 12 + i * 5,
        ]);
      }
    const achoo = span(p, T.sneeze, T.sneeze + 0.006);
    if (achoo > 0 && achoo < 1)
      for (let i = 0; i < 6; i++)
        line(ctx, alpha('#F4F6FA', 0.8 * (1 - achoo)), 1.2, [
          250 + achoo * 40,
          128 + i * 5,
          250 + achoo * 110 + i * 6,
          120 + i * 7,
        ]);
  }
  // Warm hope, then disappointment, at the bulb.
  steam(ctx, BULB.x - 11, BULB.y - 8, 2.4, span(p, T.fizzle, T.fizzle + 0.008));
  if (within(p, T.fizzle, T.fizzle + 0.003))
    for (let i = 0; i < 3; i++)
      twinkle(ctx, BULB.x - 14 + i * 4, BULB.y - 10 - i * 2, 1.5, '#FFE39A');
  // The idea strikes.
  const spark = span(p, T.idea, T.idea + 0.006);
  if (spark > 0 && spark < 1)
    for (let i = 0; i < 3; i++)
      twinkle(
        ctx,
        812 - 8 + i * 8,
        GROUND - 30 - hump(spark, 0, 1) * 6 - (i % 2) * 4,
        2.4 * hump(spark, 0, 1),
        '#FFF1C0',
      );
  // Breath puffs in the cold.
  if (within(p, T.sit, T.beam)) {
    const t = (seconds * 0.8) % 1;
    disc(ctx, 736 + 2 + t * 4, GROUND - 7 - t * 8, 1 + t * 2, alpha('#E8EEF6', 0.5 * (1 - t)));
  }
  // Tension on the lamp: little jets of steam.
  if (within(p, T.perch, T.still))
    for (let i = 0; i < 2; i++)
      steam(ctx, CAP.x + (i ? 5 : -5), CAP.y - 20, 1.6, (seconds * 1.3 + i * 0.5) % 1);
  // POP!
  if (p >= T.pop) {
    const bloom = backOut(span(p, T.pop, T.pop + 0.009));
    const drift = ease(span(p, 0.679, T.screen));
    const cx = lerp(CAP.x, 830, drift),
      cy = lerp(-26, 34, drift) - hump(drift, 0, 1) * 14 + Math.sin(seconds * 2) * 1.5 * drift;
    const r = 34 * bloom;
    if (drift > 0.3)
      // The popcorn blocks the beam: its shadow heads for the screen.
      poly(ctx, alpha('#1A1420', 0.4 * drift), [
        cx + r * 0.5,
        cy - r * 0.8,
        1500,
        -180,
        1500,
        120,
        cx + r * 0.5,
        cy + r * 0.8,
      ]);
    glow(ctx, cx, cy, r * 2.4 + 10, WARM, 0.35);
    burst(ctx, CAP.x, -10, 40, span(p, T.pop, T.pop + 0.008));
    const flakes = span(p, T.pop, T.pop + 0.02);
    if (flakes < 1)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.4;
        oval(
          ctx,
          CAP.x + Math.cos(a) * flakes * 60,
          -10 + Math.sin(a) * flakes * 40 + flakes * flakes * 80,
          2.6,
          1.3,
          HULL,
          a + flakes * 6,
        );
      }
    const surprised = p < 0.679;
    puff(ctx, cx, cy, r, {
      hull: true,
      eyes: surprised ? 'wide' : 'happy',
      mouth: surprised ? 'o' : 'grin',
      brows: surprised ? -0.4 : 0.3,
      blush: surprised ? 0 : 0.6,
      rot: Math.sin(seconds * 1.5) * 0.05,
    });
  }
  // Near grass sweeps past in front.
  ctx.save();
  ctx.translate(-view.x * 0.3, 0);
  grass(
    ctx,
    x0 + view.x * 0.3,
    x1 + view.x * 0.3,
    30,
    11,
    GROUND + 34,
    18,
    40,
    [tone('#2A3E20', '#081012'), tone('#22361C', '#0A1416')],
    seconds,
    3,
  );
  ctx.restore();
}
const FIELD_CAMERA = [
  [0.268, 70, 112, 2.3],
  [0.283, 78, 118, 2.3],
  [0.2935, 140, 110, 2],
  [0.305, 160, 112, 2],
  [0.314, 236, 116, 2.2],
  [0.321, 240, 112, 2],
  [0.335, 244, 112, 2],
  [0.337, 330, 106, 2],
  [0.343, 400, 122, 2.2],
  [0.35, 432, 124, 2.7],
  [0.365, 440, 122, 2.6],
  [0.372, 520, 114, 2.2],
  [0.382, 538, 108, 2.4],
  [0.4, 540, 116, 2.3],
  [0.4, 640, 106, 1.25],
  [0.44, 736, 118, 1.6],
  [0.47, 736, 128, 2.4],
  [0.477, 736, 128, 2.4],
  [0.494, 780, 90, 1.1],
  [0.497, 780, 90, 1.1],
  [0.497, 790, 98, 1.5],
  [0.506, 812, 98, 1.6],
  [0.506, 812, 134, 3.6],
  [0.52, 812, 134, 3.8],
  [0.52, 740, 72, 1.05],
  [0.545, 720, 76, 1.1],
  [0.545, 650, 118, 2.2],
  [0.556, 650, 72, 2.2],
  [0.566, 668, 32, 2.2],
  [0.576, 688, 12, 2.3],
  [0.59, 707, -2, 2.5],
  [0.64, 707, -6, 3.2],
  [0.668, 707, -10, 4.2],
  [0.668, 722, -12, 1.7],
  [0.695, 790, 14, 1.45],
] as const;
function fieldScene(ctx: Ctx, p: number, seconds: number) {
  const v = track(p, FIELD_CAMERA);
  const jolt =
    (within(p, T.stomp, T.stomp + 0.006) ? 1 - span(p, T.stomp, T.stomp + 0.006) : 0) +
    (within(p, T.pop, T.pop + 0.006) ? 1 - span(p, T.pop, T.pop + 0.006) : 0);
  const view = { ...v, y: v.y + (Math.sin(seconds * 70) * jolt * 2) / v.zoom };
  const night = ease(span(p, T.dark, T.sit));
  const lamp = ease(span(p, T.beam, T.beam + 0.021));
  const fever = span(p, T.perch, T.still);
  sky(
    ctx,
    FIELD_DUSK.map((c, i) => mix(c, FIELD_NIGHT[i], night)),
    0,
    H,
  );
  faded(ctx, night, () => starfield(ctx, seconds, { count: 40, bottom: 120, seed: 9 }));
  // Far-off string lights, blurred by distance.
  for (let i = 0; i < 9; i++) {
    const x = ((((i * 61 + 23 - view.x * 0.18) % (W + 40)) + W + 40) % (W + 40)) - 20;
    const y = 36 + ((i * 37) % 48) - (view.y - 110) * 0.15;
    glow(ctx, x, y, 10, BULBS[i % 4], 0.3);
    disc(ctx, x, y, 1.2, BULBS[i % 4]);
  }
  camera(ctx, view, () => fieldSet(ctx, p, seconds, view, night, lamp, fever), null);
  vignette(ctx, 0.35 + night * 0.3 - lamp * 0.12);
}

// ——— The rug: the finale ———
const FIN_SCREEN = { x: 150, y: 10, w: 162, h: 84 } as const;
const FIN_LENS = { x: -40, y: 46 } as const;
const VENDOR_AT = { x: 60, y: 178 } as const;
const KID_AT = { x: 150, y: 170 } as const;
const RAISED = [1.9, 2.1] as const;
const REACH = [1.6, 1.8] as const;
const CROWN_R = 15;
const CROWN_UP = 48;
const kidPose = (arms: readonly [number, number], facing: 1 | -1): Figure => ({
  ...KID,
  size: 2.4,
  sitting: true,
  facing,
  arms,
});
// She reaches back for the bucket, then turns to hold it out toward the screen.
const REACH_HANDS = handsOf(KID_AT.x, KID_AT.y, kidPose(REACH, -1));
const FINAL_HANDS = handsOf(KID_AT.x, KID_AT.y, kidPose(RAISED, 1));
const FINAL_BASE = { x: FINAL_HANDS.x + 8, y: FINAL_HANDS.y + 6 };
const FINAL_CROWN = { x: FINAL_BASE.x, y: FINAL_BASE.y - CROWN_UP };
/** The star's path down through the beam, t from 0 to 1, ending on the bucket. */
const fallAt = (t: number, end: { x: number; y: number }) => ({
  x: lerp(128, end.x, ease(t)) + Math.sin(t * TAU * 1.25) * 14 * (1 - t),
  y: lerp(4, end.y, 1 - (1 - t) ** 1.6),
});
/** Where something held up in the beam casts its shadow on the screen. */
const onScreen = (x: number, y: number) => ({
  x: 214 + (x - FINAL_CROWN.x) * 0.6,
  y: 40 + (y - FINAL_CROWN.y) * 1.6,
});
function finaleSet(ctx: Ctx, p: number, seconds: number) {
  sky(ctx, NIGHT.slice(0, 3), 0, 112);
  starfield(ctx, seconds, { count: 30, bottom: 100, seed: 21 });
  poly(
    ctx,
    '#0C1022',
    [0, 112, 0, 98, 30, 94, 64, 99, 100, 92, 140, 97, 180, 93, 230, 98, 280, 94, 320, 97, 320, 112],
  );
  box(ctx, 0, 104, W, 76, '#142020');
  // The vendor, the kid and the bucket move through the story first; the shadows follow.
  const give = ease(span(p, T.give, 0.884));
  const raise = ease(span(p, 0.884, T.gift));
  const laughing = within(p, T.laugh, T.give);
  const hearts = ease(span(p, T.heart - 0.012, T.heart));
  const vx = VENDOR_AT.x + give * 18;
  const vf: Partial<Figure> = {
    size: 2.4,
    facing: 1,
    arms:
      hearts > 0
        ? [lerp(1.2, 2.95, hearts), lerp(1.4, 2.95, hearts)]
        : [lerp(1.4, 1.2, give), lerp(1.6, 1.4, give)],
    lean: laughing ? -0.1 + Math.sin(seconds * 16) * 0.03 : 0.3 * hump(give, 0, 1.4),
    eyes: p < T.laugh ? 'wide' : 'happy',
    mouth: p < T.laugh ? 'o' : 'grin',
    step: within(p, T.give, 0.876) ? seconds * 10 : undefined,
  };
  const vh = handsOf(vx, VENDOR_AT.y, { ...VENDOR, ...vf });
  const clap = within(p, T.crown, T.give) ? Math.abs(Math.sin(seconds * 12)) * 0.3 : 0;
  const turned = raise > 0.3;
  const kf = kidPose(
    p < T.give
      ? p < T.crown
        ? [0.3, 0.4]
        : [1.2 + clap, 1.3 + clap]
      : give < 1
        ? [lerp(1.2, REACH[0], give), lerp(1.3, REACH[1], give)]
        : turned
          ? [lerp(REACH[0], RAISED[0], raise), lerp(REACH[1], RAISED[1], raise)]
          : REACH,
    turned ? 1 : -1,
  );
  kf.eyes = p < T.crown || within(p, T.give, 0.884) ? 'wide' : 'happy';
  kf.mouth = p < T.crown || within(p, T.give, 0.884) ? 'o' : 'grin';
  const base =
    give < 1
      ? { x: lerp(vh.x, REACH_HANDS.x, give), y: lerp(vh.y, REACH_HANDS.y, give) + 6 }
      : {
          x: lerp(REACH_HANDS.x, FINAL_BASE.x, raise),
          y: lerp(REACH_HANDS.y + 6, FINAL_BASE.y, raise) - hump(raise, 0, 1) * 10,
        };
  const landing = { x: base.x, y: base.y - CROWN_UP };
  const crown = p < T.crown ? fallAt(span(p, T.float, T.crown), landing) : landing;
  // The big screen, and what it shows.
  box(ctx, 160, 94, 5, 40, '#12141E');
  box(ctx, 296, 94, 5, 40, '#12141E');
  box(ctx, FIN_SCREEN.x - 3, FIN_SCREEN.y - 3, FIN_SCREEN.w + 6, FIN_SCREEN.h + 6, '#231C28');
  const light = '#FFF0CE';
  box(ctx, FIN_SCREEN.x, FIN_SCREEN.y, FIN_SCREEN.w, FIN_SCREEN.h, light);
  ctx.save();
  ctx.beginPath();
  ctx.rect(FIN_SCREEN.x, FIN_SCREEN.y, FIN_SCREEN.w, FIN_SCREEN.h);
  ctx.clip();
  glow(ctx, FIN_SCREEN.x + FIN_SCREEN.w / 2, FIN_SCREEN.y + FIN_SCREEN.h / 2, 100, '#FFFFFF', 0.4);
  const cs = onScreen(crown.x, crown.y);
  if (p >= T.crown) {
    const bs = onScreen(base.x, base.y);
    shadowBucket(ctx, bs.x, bs.y, 1.6);
  }
  shadowPuff(ctx, cs.x, cs.y, CROWN_R * 1.6, light, true);
  const love = backOut(span(p, T.heart, T.heart + 0.012));
  if (love > 0) heart(ctx, 284, 30, 11 * love, SHADOW);
  ctx.restore();
  // The audience, silhouetted against the screen.
  for (let i = 0; i < 10; i++) {
    const hx = 158 + i * 17 + (i % 3) * 3,
      hy = 116 + (i % 2) * 5;
    const up = p > T.crown && i % 3 === 1 ? Math.abs(Math.sin(seconds * 6 + i)) * 2 : 0;
    if (up > 0) {
      box(ctx, hx - 8, hy - 16 - up, 2, 12, '#0C0F18');
      box(ctx, hx + 6, hy - 16 - up, 2, 12, '#0C0F18');
    }
    box(ctx, hx - 7, hy - 2, 14, 34, '#0C0F18');
    disc(ctx, hx, hy - 6, 6, '#0C0F18');
    box(ctx, hx + 4, hy - 10, 1, 5, alpha(WARM, 0.4));
  }
  // The projector's light, from behind us.
  lightCone(
    ctx,
    [
      FIN_LENS.x,
      FIN_LENS.y - 8,
      FIN_SCREEN.x,
      FIN_SCREEN.y,
      FIN_SCREEN.x + FIN_SCREEN.w,
      FIN_SCREEN.y,
      FIN_SCREEN.x + FIN_SCREEN.w,
      FIN_SCREEN.y + FIN_SCREEN.h,
      FIN_SCREEN.x,
      FIN_SCREEN.y + FIN_SCREEN.h,
      FIN_LENS.x,
      FIN_LENS.y + 8,
    ],
    FIN_LENS.x,
    FIN_LENS.y,
    FIN_SCREEN.x + FIN_SCREEN.w,
    FIN_SCREEN.y + FIN_SCREEN.h / 2,
    0.9,
  );
  motes(ctx, FIN_LENS.x, FIN_LENS.y, FIN_SCREEN.x, 50, 70, 1, seconds);
  // The rug, with the teacup and the dog from the journey.
  poly(ctx, '#A8403E', [0, 148, 290, 142, 320, 180, 0, 180]);
  for (const y of [152, 162, 173]) box(ctx, 0, y, W, 2, alpha('#F2D6A8', 0.5));
  for (let x = 20; x < W; x += 34)
    poly(ctx, alpha('#F2D6A8', 0.35), [x, 146, x + 2, 146, x + 8, 180, x + 6, 180]);
  ctx.save();
  ctx.translate(222, 168);
  ctx.scale(0.22, 0.22);
  teacup(ctx, 0, 0, seconds);
  ctx.restore();
  smallDog(ctx, 268, 172, 1.8, seconds, true);
  vendor(ctx, vx, VENDOR_AT.y, vf);
  if (hearts > 0) heart(ctx, vh.x, vh.y - 10 - hearts * 4, 4 * hearts, '#F08A9A');
  person(ctx, KID_AT.x, KID_AT.y, kf);
  // The bucket, crowned.
  const crowned = p >= T.crown;
  if (crowned || p > 0.77) bucket(ctx, base.x, base.y, 1, 1, seconds, crowned ? 1 : 0);
  else bucket(ctx, base.x, base.y, 1, 1, seconds);
  glow(ctx, crown.x, crown.y, 46, WARM, 0.38 + Math.sin(seconds * 2) * 0.05);
  const bump = hump(p, T.crown, T.crown + 0.008);
  puff(ctx, crown.x, crown.y, CROWN_R, {
    hull: true,
    squash: bump * 0.2,
    eyes: bump > 0.2 ? 'shut' : 'happy',
    mouth: 'grin',
    blush: 0.7,
    brows: 0.2,
    rot: Math.sin(seconds * 1.5) * 0.05,
  });
  // Sparkles: a trail while it falls like a star, then a slow halo.
  if (p < T.crown) {
    const t = span(p, T.float, T.crown);
    for (let i = 1; i <= 6; i++) {
      const trail = fallAt(clamp(t - i * 0.035), landing);
      twinkle(
        ctx,
        trail.x + (i % 2 ? 6 : -6),
        trail.y - 6,
        2.6 - i * 0.3,
        alpha('#FFF1C0', 1 - i / 7),
      );
    }
  } else
    for (let i = 0; i < 3; i++) {
      const a = seconds * 0.9 + (i * TAU) / 3;
      twinkle(
        ctx,
        crown.x + Math.cos(a) * 22,
        crown.y + Math.sin(a) * 9 - 4,
        1.6 + Math.sin(seconds * 3 + i) * 0.6,
        '#FFF1C0',
      );
    }
}
const FINALE_CAMERA = [
  [0.75, 110, 60, 1.5],
  [0.8, 100, 90, 1.6],
  [0.8, 96, 98, 2.4],
  [0.86, 96, 100, 2.3],
  [0.86, 116, 118, 1.7],
  [0.9, 124, 112, 1.7],
  [0.925, 128, 104, 1.5],
  [0.98, 172, 96, 1.1],
  [1, 172, 96, 1.1],
] as const;
function finaleScene(ctx: Ctx, p: number, seconds: number) {
  camera(ctx, track(p, FINALE_CAMERA), () => finaleSet(ctx, p, seconds));
  vignette(ctx, 0.45);
}

const CAPTIONS = [
  [0.074, 0.122, 'Everyone was popping.'],
  [0.17, 0.222, 'Well. Almost everyone.'],
  [0.414, 0.466, 'Night fell. Still no pop.'],
  [0.872, 0.93, 'Some of us pop a little later.'],
] as const;

// ——— The score ———
const RAG = [
  16,
  15,
  16,
  19,
  null,
  16,
  12,
  null,
  13,
  12,
  13,
  16,
  null,
  13,
  9,
  null,
  18,
  17,
  18,
  21,
  null,
  18,
  14,
  null,
  19,
  17,
  14,
  11,
  7,
  null,
  null,
  null,
];
const POT_TUNE = [
  12,
  16,
  19,
  24,
  19,
  16,
  12,
  16,
  17,
  21,
  24,
  29,
  24,
  21,
  17,
  21,
  19,
  23,
  26,
  31,
  26,
  23,
  19,
  23,
  24,
  19,
  16,
  19,
  24,
  null,
  24,
  null,
];
const CAPER = [0, null, 3, null, 7, null, 6, 7, null, null, 3, null, 0, null, -1, null];
const FANFARE = [
  12,
  null,
  12,
  16,
  19,
  null,
  24,
  null,
  21,
  null,
  19,
  16,
  19,
  null,
  null,
  null,
  17,
  null,
  17,
  21,
  24,
  null,
  28,
  null,
  26,
  null,
  24,
  23,
  24,
  null,
  null,
  null,
];
const WALTZ = [
  16,
  19,
  24,
  21,
  17,
  21,
  19,
  14,
  17,
  16,
  null,
  null,
  16,
  19,
  24,
  21,
  18,
  21,
  18,
  21,
  14,
  11,
  null,
  null,
];

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const theRunawayPopcornScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: 60, voice: 'pluck', intro: [0, 4, 7, 12], outro: [0, 7, 12, 16] },
    (s) => {
      const bpm = 60 / (BEAT * s.story);
      const C = 60;
      const sec = (from: number, to: number) => (to - from) * s.story;
      const pan = (x: number) => (x / W - 0.5) * 1.2;
      // Dusk at the stand: a ragtime shuffle over the murmur of the lawn.
      s.fx('crowd', 0, sec(0, 0.07), 0.05, 0.3);
      s.section({
        from: 0,
        to: 0.072,
        bpm,
        root: C,
        chords: [0, 9, 2, 7],
        melody: RAG,
        step: 0.5,
        voice: 'keys',
        gain: 0.75,
        groove: 'tick',
        level: 0.65,
        fade: 0.8,
      });
      s.fx('rustle', T.pour, sec(T.pour, T.poured), 0.12, -0.3);
      for (let i = 0; i < 6; i++)
        s.fx('bounce', T.pour + 0.003 + i * 0.0026, 0.1, 0.05, -0.35 + i * 0.05);
      // In the pot the heat rises, the kernels bounce on the beat, and every pop sings.
      s.section({
        from: 0.07,
        to: 0.123,
        bpm,
        root: C,
        chords: [0, 5, 7, 0],
        melody: POT_TUNE,
        step: 0.5,
        voice: 'pluck',
        gain: 0.55,
        groove: 'pulse',
        level: 0.8,
        fade: 0.3,
      });
      s.fx('crackle', T.heat, sec(T.heat, 0.165), 0.05);
      for (let t = T.heat; t < 0.1; t += BEAT)
        s.fx('bounce', t, 0.1, 0.05, Math.sin(t * 900) * 0.4);
      const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21];
      POPS.forEach((at, i) => {
        s.fx('pop', at, 0.16, 0.16 + i * 0.012, pan(popperX(i)));
        s.note(at, C + 12 + SCALE[i], 0.4, 'bell', 0.045, pan(popperX(i)));
      });
      // Straining: an uneasy chord and a nervous clock... then a very small "pff".
      s.chord(T.strain - 0.003, [C - 5, C + 1, C + 6], sec(T.strain, T.pff), 'pad', 0.035);
      for (let i = 0; i < 10; i++) s.fx('tick', T.strain + i * 0.0024, 0.05, 0.05 + i * 0.006, 0.1);
      s.fx('pop', T.pff, 0.08, 0.05);
      [7, 6, 5].forEach((d, i) => s.note(T.pff + 0.003 + i * 0.006, C + d, 0.3, 'lead', 0.07));
      s.note(T.pff + 0.021, C + 4, 1.1, 'lead', 0.07);
      // Left behind: a deflated little tune in C minor.
      s.section({
        from: 0.168,
        to: 0.244,
        bpm: 70,
        root: C,
        minor: true,
        chords: [0, 5, 0, 7],
        melody: [15, null, 14, 12, 10, null, null, null, 12, null, 8, 7, null, null, null, null],
        voice: 'keys',
        gain: 0.5,
        level: 0.5,
        fade: 0.8,
      });
      s.fx('swish', T.tip - 0.002, 0.35, 0.08, 0.2);
      s.fx('click', T.plink, 0.1, 0.22, 0.25);
      s.note(T.plink, C + 24, 0.9, 'bell', 0.05, 0.25);
      s.fx('rustle', T.lift, 0.8, 0.08, 0.5);
      s.fx('woo', T.lift + 0.006, 0.8, 0.05, 0.5);
      s.fx('step', 0.224, 0.12, 0.06, 0.6);
      s.fx('step', 0.229, 0.12, 0.04, 0.7);
      [0, 3, 7, 12].forEach((d, i) =>
        s.note(T.resolve + 0.008 + i * BEAT * 0.5, C + d, 0.3, 'pluck', 0.09, -0.1),
      );
      // THE RUNAWAY: sneaky pizzicato, with stop-time for every scare.
      const caper = (from: number, to: number, level = 0.6) =>
        s.section({
          from,
          to,
          bpm,
          root: C,
          minor: true,
          chords: [0, 0, 5, 7],
          melody: CAPER,
          step: 0.5,
          voice: 'pluck',
          gain: 0.75,
          groove: 'tick',
          level,
          fade: 0.25,
        });
      caper(0.244, T.stomp);
      s.fx('bounce', T.hop + 0.003, 0.1, 0.08, 0.1);
      for (let i = 0; i < 5; i++) s.fx('step', 0.25 + i * 0.0018, 0.06, 0.05, 0.2 + i * 0.1);
      s.fx('squeak', 0.259, 0.18, 0.05, 0.6);
      s.fx('swish', 0.264, 0.4, 0.1, 0.5);
      s.fx('bounce', T.land, 0.14, 0.14, -0.4);
      s.fx('bounce', 0.2795, 0.1, 0.07, -0.35);
      s.fx('rustle', T.land, 0.4, 0.06, -0.4);
      s.fx('thud', T.stomp, 0.8, 0.34, 0.2);
      s.fx('gasp', T.stomp + 0.002, 0.3, 0.05, -0.1);
      s.fx('swish', 0.3, 0.4, 0.07, 0.3);
      caper(0.303, 0.318);
      s.fx('rustle', T.hide, 0.25, 0.08, 0.1);
      // The dog: the band holds its breath.
      s.note(0.316, C - 12, sec(0.316, T.sneeze), 'pad', 0.05, -0.3);
      s.note(0.316, C - 6, sec(0.316, T.sneeze), 'pad', 0.03, 0.3);
      for (const sn of T.sniffs) {
        s.fx('squeak', sn, 0.16, 0.07, -0.3);
        s.fx('rustle', sn, 0.14, 0.05, -0.3);
      }
      s.fx('swish', 0.323, 0.3, 0.07, 0.2);
      s.fx('sneeze', T.sneeze - 0.52 / s.story, 0.8, 0.26, -0.3);
      s.fx('swish', T.sneeze + 0.001, 0.5, 0.12, 0.3);
      s.fx('bounce', T.flop, 0.14, 0.1, 0.2);
      s.fx('tweet', T.flop + 0.001, 0.8, 0.04, 0.2);
      caper(T.flop + 0.004, T.climb, 0.5);
      // The teacup: a hopeful lean, a shiver, a shrug.
      s.fx('click', 0.3515, 0.08, 0.06, 0.4);
      s.fx('rustle', T.shiver, 0.2, 0.04, 0.4);
      s.note(0.361, C + 7, 0.3, 'pluck', 0.08, 0.3);
      s.note(0.3635, C + 3, 0.5, 'pluck', 0.08, 0.3);
      // Up the wire to the bulb: hope climbs the scale, and fizzles.
      [0, 2, 3, 5, 7].forEach((d, i) =>
        s.note(T.climb + i * 0.002, C + 12 + d, 0.25, 'pluck', 0.08, 0.3),
      );
      s.chord(T.hug, [C + 3, C + 7, C + 12], sec(T.hug, T.fizzle), 'pad', 0.035);
      s.fx('whir', T.hug, sec(T.hug, T.fizzle), 0.025, 0.4);
      s.fx('crackle', T.fizzle, 0.35, 0.12, 0.4);
      s.fx('pop', T.fizzle, 0.08, 0.04, 0.4);
      [7, 5, 3, 0].forEach((d, i) =>
        s.note(T.fizzle + 0.003 + i * 0.003, C + 12 + d, 0.3, 'pluck', 0.07, 0.3),
      );
      s.fx('thud', 0.398, 0.3, 0.12, 0.4);
      // Night: cold wind, a far-off crowd, and a lonely bell.
      s.fx('wind', T.dark, sec(T.dark, T.beam), 0.06);
      s.fx('crowd', 0.41, sec(0.41, T.beam), 0.025, 0.6);
      s.section({
        from: 0.4,
        to: T.beam + 0.004,
        bpm: 56,
        root: 57,
        minor: true,
        chords: [0, 5, 0, 7],
        melody: [12, null, 15, null, 14, 12, null, null, 10, null, 7, null, null, null, null, null],
        voice: 'bell',
        gain: 0.45,
        level: 0.45,
        bass: false,
        fade: 1.2,
      });
      // The projector wakes: a click, a hum, the sprockets, and a warm chord.
      s.fx('click', T.beam - 0.002, 0.1, 0.15, -0.4);
      s.fx('hum', T.beam, sec(T.beam, 0.8), 0.07, -0.3);
      s.chord(T.beam + 0.002, [C, C + 4, C + 7, C + 14], 3, 'pad', 0.04);
      for (let t = T.beam + 0.006; t < T.perch; t += BEAT / 2) s.fx('tick', t, 0.04, 0.03, -0.35);
      s.section({
        from: T.beam,
        to: T.run,
        bpm: 64,
        root: C,
        chords: [0, 5],
        level: 0.4,
        bass: false,
        fade: 1,
      });
      s.fx('sparkle', T.idea, 1.2, 0.1, 0.3);
      [0, 4, 7, 12, 16].forEach((d, i) =>
        s.note(T.idea + i * 0.0018, C + 12 + d, 0.6, 'bell', 0.07, 0.3),
      );
      // The run and the climb: a note up the scale for every pull on the cord.
      s.section({
        from: T.run,
        to: T.cord,
        bpm,
        root: C,
        chords: [0, 5, 7, 5],
        melody: [0, 7, 12, 7, 2, 7, 14, 7, 4, 7, 16, 7, 5, 9, 17, 9],
        step: 0.5,
        voice: 'pluck',
        gain: 0.65,
        groove: 'march',
        level: 0.7,
        fade: 0.3,
      });
      for (let t = T.run + 0.002; t < T.cord; t += 0.0034) s.fx('step', t, 0.05, 0.04, -0.2);
      s.section({
        from: T.cord,
        to: T.perch,
        bpm,
        root: C,
        chords: [0, 2, 4, 5],
        groove: 'tick',
        level: 0.55,
        fade: 0.3,
      });
      for (let i = 0; i < GRABS; i++)
        s.note(grabAt(i), C + 12 + [0, 2, 4, 5, 7, 9, 11][i], 0.3, 'pluck', 0.1, -0.2);
      s.fx('boing', T.top + 0.002, 0.5, 0.08, -0.1);
      for (let i = 0; i < 4; i++) s.fx('squeak', 0.583 + i * 0.0018, 0.08, 0.05, -0.1);
      // Tension: a creeping chromatic pad, crackling heat, a clock that keeps speeding up.
      for (let k = 0; k < 4; k++) {
        s.chord(T.perch + k * 0.018, [55 + k, 60 + k, 63 + k], sec(0, 0.019), 'pad', 0.04);
        s.fx('crackle', T.perch + k * 0.018, sec(0, 0.02), 0.04 + k * 0.03, -0.1);
      }
      for (let t = T.perch, gap = 0.012; t < T.still; t += gap, gap = Math.max(0.0018, gap * 0.9))
        s.fx('tick', t, 0.05, 0.08, 0.1);
      for (let t = T.perch; t < T.still; t += BEAT) s.note(t, 36, 0.2, 'kick', 0.05);
      for (let t = 0.65; t < T.still; t += 0.001)
        s.note(t, 38, 0.06, 'snare', 0.03 + (t - 0.65) * 4);
      // POP! A fanfare for the biggest entrance in the town's history.
      s.fx('pop', T.pop, 0.35, 0.5);
      s.fx('thud', T.pop, 0.8, 0.3);
      s.fx('boing', T.pop + 0.001, 0.8, 0.12, 0.2);
      s.fx('sparkle', T.pop + 0.004, 1.6, 0.14, 0.3);
      s.chord(T.pop, [C, C + 4, C + 7, C + 12], 1.4, 'lead', 0.05);
      s.section({
        from: T.pop + 0.004,
        to: T.float,
        bpm,
        root: C,
        chords: [0, 5, 7, 0],
        melody: FANFARE,
        step: 0.5,
        voice: 'lead',
        gain: 0.75,
        groove: 'drive',
        level: 0.9,
        fade: 0.25,
      });
      s.fx('gasp', T.gasp, 0.7, 0.22, 0.2);
      s.fx('crowd', T.gasp, 1.5, 0.08, 0.2);
      s.fx('applause', T.cheer, sec(T.cheer, 0.8), 0.2, 0.2);
      s.fx('woo', T.cheer + 0.003, 0.8, 0.06, 0.4);
      // Floating down like a star.
      s.section({
        from: T.float,
        to: T.crown,
        bpm,
        root: C,
        chords: [5, 0],
        melody: [24, 19, 16, 12, 21, 17, 14, 9],
        step: 0.5,
        voice: 'bell',
        gain: 0.5,
        level: 0.45,
        bass: false,
        fade: 0.6,
      });
      for (let i = 0; i < 4; i++)
        s.fx('sparkle', T.float + 0.004 + i * 0.012, 1, 0.07, -0.3 + i * 0.2);
      // Crowned: a warm waltz that remembers the ragtime.
      s.fx('chime', T.crown, 1.6, 0.16, -0.2);
      s.fx('bounce', T.crown, 0.14, 0.08, -0.2);
      s.fx('giggle', T.laugh, 1.2, 0.12, -0.3);
      s.fx('giggle', T.laugh + 0.02, 0.8, 0.08, -0.3);
      s.section({
        from: T.crown,
        to: 1,
        bpm,
        root: C,
        chords: [0, 5, 7, 0, 0, 9, 2, 7],
        melody: WALTZ,
        voice: 'keys',
        gain: 0.75,
        groove: 'waltz',
        level: 0.8,
        fade: 1.5,
      });
      s.fx('rustle', T.give, 0.8, 0.06, 0);
      s.fx('giggle', T.gift, 0.9, 0.08, 0.1);
      s.fx('applause', T.gift, 3, 0.08, 0.3);
      s.fx('sparkle', T.heart, 1.6, 0.1, 0.4);
      s.fx('chime', T.heart + 0.003, 1.4, 0.08, 0.4);
    },
  );

export const theRunawayPopcorn: FilmModule = {
  draw(ctx, p, seconds) {
    if (p < 0.045 || within(p, T.screen, T.float)) cinemaScene(ctx, p, seconds);
    else if (p < 0.07 || within(p, 0.185, 0.268)) counterScene(ctx, p, seconds);
    else if (p < 0.185) potScene(ctx, p, seconds);
    else if (p < T.screen) fieldScene(ctx, p, seconds);
    else finaleScene(ctx, p, seconds);
    // Dips: into the night, and from the lawn to the rug.
    veil(ctx, '#05070C', Math.max(hump(p, 0.395, 0.405) * 0.85, hump(p, 0.745, 0.755) * 0.55));
    captions(ctx, p, CAPTIONS);
  },
  score: theRunawayPopcornScore,
  look: {
    shade: '#1E1418',
    ink: '#FFF3DA',
    accent: '#F2C14E',
    dedication: 'for every late bloomer',
  },
};
