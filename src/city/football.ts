import {
  BALL_TURN,
  CROSSBAR,
  GOAL_MOUTH,
  GROUND,
  PITCH,
  STRIDE_CYCLE,
  TEAMS,
  playerProfile,
  type FootballBall,
  type FootballPlayer,
  type FootballReferee,
  type FootballState,
  type HairStyle,
} from '../lib/football';
import { project, type Point } from '../lib/world';
import { fontReady } from './font-check';
import { drawGlow, LIGHT } from './glow';
import { tint } from './houses';
import { mixHex, pick, type Pair } from './season-palette';

type Ctx = CanvasRenderingContext2D;
type Layer = { depth: number; paint: () => void };
type V2 = readonly [number, number];

/**
 * Figures are pixel sprites about as tall as a town resident, and a head taller than the
 * crossbar, so the goals do not read as mini-goals.
 */
export const FIGURE_SCALE = 1.1;
/** Tiles run per full stride cycle (two steps): the feet keep pace with the ground. */
const STRIDE = STRIDE_CYCLE;
const MID = { x: (PITCH.left + PITCH.right) / 2, y: (GOAL_MOUTH.top + GOAL_MOUTH.bottom) / 2 };
const MOUTH = GOAL_MOUTH.bottom - GOAL_MOUTH.top;

const at = (x: number, y: number, h = 0): Point => {
  const p = project(x, y);
  return { x: p.x, y: p.y - h };
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const plate = (x0: number, y0: number, x1: number, y1: number, h = 0) => [
  at(x0, y0, h),
  at(x1, y0, h),
  at(x1, y1, h),
  at(x0, y1, h),
];
function trace(ctx: Ctx, points: readonly Point[], close = true) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (close) ctx.closePath();
}
function shape(ctx: Ctx, points: readonly Point[], color: string) {
  trace(ctx, points);
  ctx.fillStyle = color;
  ctx.fill();
}
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
/** A closed ring of tile points around (cx, cy), from angle a0 to a1. */
const ring = (cx: number, cy: number, rx: number, ry: number, n = 16, a0 = 0, a1 = Math.PI * 2) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return at(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  });

// ---------------------------------------------------------------------------------------------
// Palette: [day, night] pairs, muted like the rest of the town.

const P = {
  apron: ['#88B475', '#415F50'],
  kerb: ['#658C55', '#344F45'],
  concourse: ['#D8CFAC', '#687064'],
  pebble: ['#C3B994', '#5A6258'],
  stripe: ['#80AE6D', '#4A7160'],
  stripeAlt: ['#77A565', '#456B5B'],
  cross: ['rgba(255,252,220,0.07)', 'rgba(210,235,215,0.04)'],
  tuft: ['#6A9658', '#3E6151'],
  tuftLight: ['#93BD7E', '#557C69'],
  worn: ['#AAA878', '#5C6E58'],
  wornEdge: ['#94AA6F', '#51705B'],
  line: ['#F2F5E4', '#AEBFAE'],
  goalShadow: ['rgba(34,64,40,0.2)', 'rgba(10,30,24,0.3)'],
  post: ['#FBF8EE', '#C3CCC1'],
  postShade: ['#C8CCBD', '#87948B'],
  frame: ['#CDD2C4', '#86938A'],
  net: ['rgba(248,246,234,0.55)', 'rgba(188,204,194,0.38)'],
  pole: ['#EDEBDD', '#A2AFA6'],
  flag: ['#E07A5F', '#8E5C51'],
  flagLight: ['#F6D7A8', '#A8927A'],
  steel: ['#9AA096', '#56615B'],
  steelDark: ['#747B72', '#434D48'],
  lampOff: ['#D9DCCB', '#6E7870'],
  board: ['#274038', '#1F3430'],
  boardFace: ['#172822', '#131F1C'],
  boardTop: ['#3C5A4E', '#2B403A'],
  boardSide: ['#1E332C', '#18292A'],
  plate: ['#E8DDB8', '#8E8C78'],
  plateInk: ['#2F5B4B', '#2B403A'],
  interior: ['#40534A', '#27352F'],
  interiorSide: ['#51665B', '#2E3D37'],
  shell: ['#E6DEC3', '#7E847A'],
  shellShade: ['#CFC6A8', '#6C7269'],
  pad: ['#BDB59C', '#5D6660'],
  wood: ['#BD8E5E', '#7C6A55'],
  woodShade: ['#94704B', '#5F5446'],
  rail: ['#EEEAD9', '#95A399'],
  railShade: ['#A9AC9C', '#67736C'],
  cart: ['#E5C483', '#8A8466'],
  cartShade: ['#C9A568', '#716E57'],
  cartTop: ['#F3E4BA', '#9E9A80'],
  awning: ['#DE8D6A', '#8A6A5E'],
  awningLight: ['#F6E7C6', '#A69F8B'],
  wheel: ['#4A534C', '#323A36'],
} satisfies Record<string, Pair>;
const SHADOW = 'rgba(28,52,36,0.26)';
const EYE = '#2A332F';
const MOUTH_OPEN = '#6E3B35';

// ---------------------------------------------------------------------------------------------
// The pitch: grass, wear and markings. Static, so it is painted once per zoom into a cache.

const PITCH_W = PITCH.right - PITCH.left,
  PITCH_H = PITCH.bottom - PITCH.top;
const CONCOURSE = 27.78;
const GOALS = [
  { x: PITCH.left, d: 1 },
  { x: PITCH.right, d: -1 },
] as const;
const D_AREA = { rx: 1.3, ry: 0.95, spot: 0.95 };

// Deterministic speckle: a fixed scatter of tufts over the grass and pebbles on the concourse.
const scatter = (() => {
  let seed = 20240917;
  const next = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const tufts: { p: Point; w: number; light: boolean }[] = [];
  for (let i = 0; i < 150; i++) {
    const x = GROUND.left + 0.12 + next() * (GROUND.right - GROUND.left - 0.24),
      y = GROUND.top + 0.1 + next() * (CONCOURSE - GROUND.top - 0.2);
    tufts.push({ p: at(x, y), w: next() < 0.5 ? 2 : 1, light: next() < 0.42 });
  }
  const pebbles: Point[] = [];
  for (let i = 0; i < 34; i++)
    pebbles.push(
      at(
        GROUND.left + 0.1 + next() * (GROUND.right - GROUND.left - 0.2),
        CONCOURSE + 0.08 + next() * (GROUND.bottom - CONCOURSE - 0.16),
      ),
    );
  return { tufts, pebbles };
})();

function pitchArt(ctx: Ctx, night: boolean) {
  const n = night ? 1 : 0;
  shape(ctx, plate(GROUND.left, GROUND.top, GROUND.right, GROUND.bottom), P.apron[n]);
  shape(ctx, plate(GROUND.left, CONCOURSE, GROUND.right, GROUND.bottom), P.concourse[n]);
  for (const p of scatter.pebbles) rect(ctx, p.x, p.y, 2, 1, P.pebble[n]);
  // Mowing stripes across the pitch, then a fainter cross-cut along it.
  shape(ctx, plate(PITCH.left, PITCH.top, PITCH.right, PITCH.bottom), P.stripe[n]);
  for (let i = 1; i < 10; i += 2) {
    const x = PITCH.left + (i * PITCH_W) / 10;
    shape(ctx, plate(x, PITCH.top, x + PITCH_W / 10, PITCH.bottom), P.stripeAlt[n]);
  }
  for (let j = 1; j < 4; j += 2) {
    const y = PITCH.top + (j * PITCH_H) / 4;
    shape(ctx, plate(PITCH.left, y, PITCH.right, y + PITCH_H / 4), P.cross[n]);
  }
  for (const t of scatter.tufts)
    rect(ctx, t.p.x, t.p.y, t.w, 1, (t.light ? P.tuftLight : P.tuft)[n]);
  // Worn goalmouths and a scuffed centre spot.
  for (const g of GOALS) {
    shape(ctx, ring(g.x + g.d * 0.34, MID.y, 0.46, 0.72, 18), P.wornEdge[n]);
    shape(ctx, ring(g.x + g.d * 0.2, MID.y, 0.26, 0.5, 14), P.worn[n]);
    shape(ctx, ring(g.x + g.d * D_AREA.spot, MID.y, 0.13, 0.16, 8), P.wornEdge[n]);
  }
  shape(ctx, ring(MID.x, MID.y, 0.3, 0.26, 12), P.wornEdge[n]);
  shape(ctx, ring(MID.x, MID.y, 0.14, 0.12, 8), P.worn[n]);
  // Shade under each net.
  for (const g of GOALS)
    shape(ctx, plate(g.x, GOAL_MOUTH.top, g.x - g.d * 0.5, GOAL_MOUTH.bottom), P.goalShadow[n]);
  // Markings, one crisp weight.
  ctx.beginPath();
  const run = (points: readonly Point[], close = false) => {
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (close) ctx.closePath();
  };
  run(plate(PITCH.left, PITCH.top, PITCH.right, PITCH.bottom), true);
  run([at(MID.x, PITCH.top), at(MID.x, PITCH.bottom)]);
  run(ring(MID.x, MID.y, 0.8, 0.8, 28), true);
  for (const g of GOALS) {
    // A futsal D: quarter-ellipses round each post, joined in front of the goal.
    run([
      ...ring(g.x, GOAL_MOUTH.bottom, D_AREA.rx * g.d, D_AREA.ry, 9, Math.PI / 2, 0),
      ...ring(g.x, GOAL_MOUTH.top, D_AREA.rx * g.d, D_AREA.ry, 9, 0, -Math.PI / 2),
    ]);
  }
  for (const x of [PITCH.left, PITCH.right])
    for (const y of [PITCH.top, PITCH.bottom]) {
      const sx = x < MID.x ? 1 : -1,
        sy = y < MID.y ? 1 : -1;
      run(ring(x, y, 0.22 * sx, 0.22 * sy, 4, 0, Math.PI / 2));
    }
  // Substitution marks in front of the dugouts.
  for (const x of [13.35, 14.2, 16.8, 17.65])
    run([at(x, PITCH.top - 0.14), at(x, PITCH.top + 0.1)]);
  ctx.strokeStyle = P.line[n];
  ctx.lineWidth = 1.35;
  ctx.lineJoin = 'round';
  ctx.stroke();
  const line = P.line[n];
  const centre = at(MID.x, MID.y);
  oval(ctx, centre.x, centre.y, 2, 1, line);
  for (const g of GOALS) {
    const spot = at(g.x + g.d * D_AREA.spot, MID.y);
    oval(ctx, spot.x, spot.y, 1.6, 0.8, line);
  }
}

// The pitch and the sponsor boards are drawn from offscreen copies at the current device scale;
// canvases are made on first draw, never at module load, and node (no document) paints directly.
type Box = { left: number; top: number; width: number; height: number };
/** The screen box around some points, with a margin. */
function boxAround(points: Point[], margin: number): Box {
  const xs = points.map((c) => c.x),
    ys = points.map((c) => c.y);
  const left = Math.min(...xs) - margin,
    top = Math.min(...ys) - margin;
  return {
    left,
    top,
    width: Math.max(...xs) + margin - left,
    height: Math.max(...ys) + margin - top,
  };
}
const PITCH_BOX = boxAround(plate(GROUND.left, GROUND.top, GROUND.right, GROUND.bottom), 4);
type Cached = { canvas: HTMLCanvasElement; ctx: Ctx; key: string; want: string; since: number };
const layerCaches = new WeakMap<Ctx, Record<string, Cached>>();
/** Where a cached layer over `box` lands in device pixels, or null to paint directly. */
function layerFrame(ctx: Ctx, box: Box) {
  const t = typeof document === 'undefined' ? null : ctx.getTransform?.();
  const scale = t?.a ?? 0;
  const w = Math.ceil(box.width * scale),
    h = Math.ceil(box.height * scale);
  if (!t || t.b || t.c || t.d !== scale || scale <= 0 || w * h > 6_000_000) return null;
  const x = Math.round(t.e + box.left * scale),
    y = Math.round(t.f + box.top * scale);
  return { scale, w, h, x, y };
}
/**
 * The offscreen copy of a layer, or null to paint it directly this frame. A copy made once is
 * only redrawn after the new scale has held for a moment: a pinch or wheel zoom paints directly
 * instead of reallocating the layer on every frame.
 */
function cachedLayer(
  ctx: Ctx,
  name: string,
  night: boolean,
  frame: NonNullable<ReturnType<typeof layerFrame>>,
  box: Box,
  paint: (ctx: Ctx, night: boolean) => void,
) {
  let all = layerCaches.get(ctx);
  if (!all) layerCaches.set(ctx, (all = {}));
  let cache = all[name];
  if (!cache) {
    const canvas = document.createElement('canvas');
    const layer = canvas.getContext('2d');
    if (!layer) return null;
    cache = all[name] = { canvas, ctx: layer, key: '', want: '', since: 0 };
  }
  const key = `${night}:${frame.scale}:${fontReady(FONT(5))}`;
  if (cache.key !== key) {
    const now = performance.now();
    if (cache.want !== key) {
      cache.want = key;
      cache.since = now;
    }
    if (cache.key && now - cache.since < 150) return null;
    cache.canvas.width = frame.w;
    cache.canvas.height = frame.h;
    const s = frame.scale;
    cache.ctx.setTransform(s, 0, 0, s, -box.left * s, -box.top * s);
    paint(cache.ctx, night);
    cache.key = key;
  }
  return cache.canvas;
}
function paintPitch(ctx: Ctx, night: boolean) {
  const frame = layerFrame(ctx, PITCH_BOX);
  const canvas = frame && cachedLayer(ctx, 'pitch', night, frame, PITCH_BOX, pitchArt);
  if (!frame || !canvas) return pitchArt(ctx, night);
  ctx.save();
  ctx.resetTransform();
  ctx.drawImage(canvas, frame.x, frame.y);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Goals: a white frame and a sagging net that bulges when the ball goes in.

const NET = { top: 0.28, base: 0.5, back: 19 };
function netAt(side: 0 | 1, u: number, w: number, h: number) {
  const g = GOALS[side];
  return at(g.x - g.d * w, GOAL_MOUTH.top + MOUTH * u, h);
}
/** Back-plane point: v runs from the top bar (0) to the ground (1). */
function backNet(side: 0 | 1, u: number, v: number, bulge: number) {
  const push = bulge * 0.22 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
  return netAt(side, u, NET.top + (NET.base - NET.top) * v + push, NET.back * (1 - v));
}
/** Roof point: r runs from the crossbar (0) to the top bar (1). */
function roofNet(side: 0 | 1, u: number, r: number, bulge: number) {
  const push = bulge * 0.06 * Math.sin(Math.PI * u) * Math.sin(Math.PI * r);
  return netAt(side, u, NET.top * r + push, CROSSBAR + (NET.back - CROSSBAR) * r);
}
const sideTop = (w: number) =>
  w <= NET.top
    ? CROSSBAR + ((NET.back - CROSSBAR) * w) / NET.top
    : NET.back * (1 - (w - NET.top) / (NET.base - NET.top));
const sideBack = (h: number) =>
  h <= NET.back
    ? NET.top + (NET.base - NET.top) * (1 - h / NET.back)
    : (NET.top * (CROSSBAR - h)) / (CROSSBAR - NET.back);
function netMesh(
  ctx: Ctx,
  side: 0 | 1,
  parts: ('back' | 'roof' | 'far' | 'near')[],
  bulge: number,
) {
  ctx.beginPath();
  const run = (points: Point[]) =>
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  const steps = bulge > 0.02 ? 4 : 1;
  const span = (f: (k: number) => Point, n: number) =>
    run(Array.from({ length: n + 1 }, (_, k) => f(k / n)));
  for (const part of parts) {
    if (part === 'back') {
      for (let i = 0; i <= 8; i++) span((v) => backNet(side, i / 8, v, bulge), steps);
      for (let j = 0; j <= 5; j++)
        span((u) => backNet(side, u, j / 5, bulge), bulge > 0.02 ? 8 : 1);
    } else if (part === 'roof') {
      for (let i = 1; i < 8; i++) span((r) => roofNet(side, i / 8, r, bulge), steps > 1 ? 2 : 1);
      for (let j = 1; j < 3; j++) span((u) => roofNet(side, u, j / 3, bulge), bulge > 0.02 ? 8 : 1);
    } else {
      const u = part === 'far' ? 0 : 1;
      for (let k = 1; k < 4; k++) {
        const w = (NET.base * k) / 4;
        run([netAt(side, u, w, 0), netAt(side, u, w, sideTop(w))]);
      }
      for (let k = 1; k < 4; k++) {
        const h = (CROSSBAR * k) / 4;
        run([netAt(side, u, 0, h), netAt(side, u, sideBack(h), h)]);
      }
    }
  }
  ctx.stroke();
}
function goalFrame(ctx: Ctx, side: 0 | 1, u: 0 | 1, night: boolean) {
  // The side stanchion: crossbar end, top bar, sloping back bar and the ground bar.
  ctx.beginPath();
  const a = netAt(side, u, 0, CROSSBAR),
    b = netAt(side, u, NET.top, NET.back),
    c = netAt(side, u, NET.base, 0),
    d = netAt(side, u, 0, 0);
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.strokeStyle = pick(P.frame, night);
  ctx.lineWidth = 1;
  ctx.stroke();
}
function goalPosts(ctx: Ctx, side: 0 | 1, night: boolean) {
  const far = netAt(side, 0, 0, 0),
    near = netAt(side, 1, 0, 0);
  const post = pick(P.post, night),
    shade = pick(P.postShade, night);
  const upright = (p: Point) => {
    rect(ctx, p.x - 1.3, p.y - CROSSBAR - 1, 2.6, CROSSBAR + 1, post);
    rect(ctx, p.x + 0.3, p.y - CROSSBAR, 1, CROSSBAR, shade);
    rect(ctx, p.x - 1.6, p.y - 1, 3.2, 1.6, shade);
  };
  upright(far);
  ctx.beginPath();
  ctx.moveTo(far.x, far.y - CROSSBAR + 0.8);
  ctx.lineTo(near.x, near.y - CROSSBAR + 0.8);
  ctx.strokeStyle = shade;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(far.x, far.y - CROSSBAR - 0.2);
  ctx.lineTo(near.x, near.y - CROSSBAR - 0.2);
  ctx.strokeStyle = post;
  ctx.lineWidth = 2;
  ctx.stroke();
  upright(near);
}
/**
 * Depth for anything inside a goal: behind the frame of the left goal (the camera looks into
 * it) and in front of the frame of the right goal (the camera looks through its net).
 */
function depthOf(x: number, y: number) {
  if (y > GOAL_MOUTH.top - 0.04 && y < GOAL_MOUTH.bottom + 0.04) {
    if (x < PITCH.left) return PITCH.left + GOAL_MOUTH.top - 0.25;
    if (x > PITCH.right) return PITCH.right + GOAL_MOUTH.bottom + 0.05;
  }
  return x + y;
}
function addGoals(
  add: (depth: number, paint: () => void) => void,
  ctx: Ctx,
  game: FootballState,
  night: boolean,
) {
  const net = pick(P.net, night);
  const mesh = (side: 0 | 1, parts: ('back' | 'roof' | 'far' | 'near')[]) => () => {
    ctx.strokeStyle = net;
    ctx.lineWidth = 0.6;
    netMesh(ctx, side, parts, clamp01(game.net[side] ?? 0));
  };
  // Left goal: the camera looks into the mouth, so the back of the net goes first.
  add(PITCH.left + GOAL_MOUTH.top - 0.5, () => {
    mesh(0, ['back', 'roof', 'far'])();
    goalFrame(ctx, 0, 0, night);
    const a = netAt(0, 0, NET.top, NET.back),
      b = netAt(0, 1, NET.top, NET.back),
      c = netAt(0, 0, NET.base, 0),
      d = netAt(0, 1, NET.base, 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  });
  add(PITCH.left + GOAL_MOUTH.top, () => {
    mesh(0, ['near'])();
    goalFrame(ctx, 0, 1, night);
    goalPosts(ctx, 0, night);
  });
  // Right goal: the camera looks at the back of the net.
  add(PITCH.right + GOAL_MOUTH.top, () => {
    mesh(1, ['far'])();
    goalFrame(ctx, 1, 0, night);
  });
  add(PITCH.right + GOAL_MOUTH.bottom, () => goalPosts(ctx, 1, night));
  add(PITCH.right + GOAL_MOUTH.bottom + 0.1, () => {
    mesh(1, ['back', 'roof', 'near'])();
    goalFrame(ctx, 1, 1, night);
    const a = netAt(1, 0, NET.top, NET.back),
      b = netAt(1, 1, NET.top, NET.back),
      c = netAt(1, 0, NET.base, 0),
      d = netAt(1, 1, NET.base, 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  });
}

// ---------------------------------------------------------------------------------------------
// Pixel glyphs: shirt numbers and the scoreboard's LED digits.

const GLYPHS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['01', '11', '01', '01', '01'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '-': ['000', '000', '111', '000', '000'],
  ':': ['0', '1', '0', '1', '0'],
};
const RUNS = Object.fromEntries(
  Object.entries(GLYPHS).map(([ch, rows]) => {
    const runs: [number, number, number][] = [];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== '1') continue;
        let w = 1;
        while (row[x + w] === '1') w++;
        runs.push([x, y, w]);
        x += w - 1;
      }
    });
    return [ch, { w: rows[0].length, runs }];
  }),
);
const glyphWidth = (text: string) =>
  [...text].reduce((sum, ch) => sum + (RUNS[ch]?.w ?? 3) + 1, -1);
/** Centred pixel text; `mirror` reads correctly inside a horizontally flipped sprite. */
function glyphs(
  ctx: Ctx,
  text: string,
  cx: number,
  y: number,
  px: number,
  color: string,
  mirror = false,
) {
  const width = glyphWidth(text) * px;
  const base = mirror ? Math.round(cx + width / 2) : Math.round(cx - width / 2);
  let gx = 0;
  ctx.fillStyle = color;
  for (const ch of text) {
    const glyph = RUNS[ch];
    if (glyph)
      for (const [x, row, w] of glyph.runs)
        ctx.fillRect(
          mirror ? base - (gx + x + w) * px : base + (gx + x) * px,
          y + row * px,
          w * px,
          px,
        );
    gx += (glyph?.w ?? 3) + 1;
  }
}

// ---------------------------------------------------------------------------------------------
// Figures: one small pixel rig for players, the referee, managers, supporters and the vendor.
// Local units, facing +x (front-right); feet at y = 0. Limbs are stepped 2 px strokes.

type Band = readonly [length: number, color: string];
type Hair = HairStyle | 'bald' | 'beanie' | 'flatcap';
type LookSpec = {
  skin: string;
  hair: string;
  style: Hair;
  hat?: string;
  shirt: string;
  trim: string;
  lower: string;
  /** Rows of shorts, or of a coat's skirt. */
  skirt?: number;
  leg: Band[];
  boot: string;
  arm: Band[];
  glove?: string;
  number?: number;
  ink?: string;
  crest?: boolean;
  scarf?: readonly [string, string];
};
type Look = LookSpec & {
  farLeg: Band[];
  farArm: Band[];
  shade: string;
  lowerShade: string;
  lit: string;
  hairLight: string;
  buzz: string;
  neck: string;
  lips: string;
  scalp: string;
  hatShade: string;
  bootFar: string;
  gloveFar: string;
};
const dim = (bands: Band[]) => bands.map(([l, c]) => [l, tint(c, -26)] as const);
const makeLook = (spec: LookSpec): Look => ({
  ...spec,
  farLeg: dim(spec.leg),
  farArm: dim(spec.arm),
  shade: tint(spec.shirt, -26),
  lowerShade: tint(spec.lower, -22),
  lit: tint(spec.shirt, 20),
  hairLight: tint(spec.hair, 24),
  buzz: mixHex(spec.hair, spec.skin, 0.25),
  neck: tint(spec.skin, -18),
  lips: tint(spec.skin, -30),
  scalp: tint(spec.skin, 16),
  hatShade: tint(spec.hat ?? spec.hair, -24),
  bootFar: tint(spec.boot, -12),
  gloveFar: tint(spec.glove ?? '#FFFFFF', -22),
});
type Pose = {
  hip: V2;
  neck: V2;
  /** Far foot, near foot. */
  feet: readonly [V2, V2];
  knees?: readonly [V2 | null, V2 | null];
  hands: readonly [V2, V2];
  elbows?: readonly [V2 | null, V2 | null];
  mouth?: boolean;
  /** Hands raised behind the head: seen from the front, the near arm passes behind it. */
  behind?: boolean;
};
type Stance = {
  x: number;
  y: number;
  back: boolean;
  left: boolean;
  /** Jump height, in sprite units. */
  lift?: number;
  shadow?: number;
  scale?: number;
};

function limb(ctx: Ctx, points: readonly V2[], bands: readonly Band[]) {
  let rx = 0,
    ry = 0,
    rw = 0,
    rh = 0,
    rc = '';
  const flush = () => rw && rect(ctx, rx, ry, rw, rh, rc);
  const put = (x: number, y: number, c: string) => {
    if (c === rc && x === rx && rw === 2 && y === ry + rh - 1) rh++;
    else if (c === rc && y === ry && rh === 2 && x === rx + rw - 1) rw++;
    else if (c === rc && x >= rx && x + 2 <= rx + rw && y >= ry && y + 2 <= ry + rh) return;
    else {
      flush();
      [rx, ry, rw, rh, rc] = [x, y, 2, 2, c];
    }
  };
  let travelled = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1],
      [bx, by] = points[i];
    const length = Math.hypot(bx - ax, by - ay),
      steps = Math.max(1, Math.ceil(length));
    for (let k = i === 1 ? 0 : 1; k <= steps; k++) {
      const f = k / steps,
        d = travelled + length * f;
      let band = 0,
        reach = bands[0][0];
      while (d >= reach && band < bands.length - 1) reach += bands[++band][0];
      put(Math.round(ax + (bx - ax) * f - 1), Math.round(ay + (by - ay) * f), bands[band][1]);
    }
    travelled += length;
  }
  flush();
}
const chain = (a: V2, b: V2 | null | undefined, c: V2): V2[] => (b ? [a, b, c] : [a, c]);
type Paint = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => void;
const fill: Paint = rect;

function hairAndFace(
  ctx: Ctx,
  lk: Look,
  x: number,
  y: number,
  back: boolean,
  sway: number,
  mouth: boolean,
  rect: Paint = fill,
) {
  const hair = lk.hair,
    hi = lk.hairLight,
    hat = lk.hat ?? hair;
  rect(ctx, x, y, 6, 6, lk.skin);
  rect(ctx, x + 2, y + 6, 2, 1, lk.neck);
  if (!back) {
    rect(ctx, x + 3, y + 3, 1, 1, EYE);
    rect(ctx, x + 5, y + 3, 1, 1, EYE);
    if (mouth) rect(ctx, x + 4, y + 5, 2, 1, MOUTH_OPEN);
    else rect(ctx, x + 4, y + 5, 1, 1, lk.lips);
  }
  const s = Math.round(sway);
  switch (lk.style) {
    case 'short':
      rect(ctx, x, y - 1, 6, back ? 5 : 2, hair);
      if (!back) rect(ctx, x, y + 1, 2, 2, hair);
      rect(ctx, x + 1, y - 1, 3, 1, hi);
      break;
    case 'buzz': {
      const buzz = lk.buzz;
      rect(ctx, x, y, 6, back ? 4 : 1, buzz);
      if (!back) rect(ctx, x, y + 1, 1, 2, buzz);
      break;
    }
    case 'curly':
      rect(ctx, x - 1, y - 1, 7, back ? 5 : 2, hair);
      rect(ctx, x - 1, y + 1, 2, 3, hair);
      if (back) rect(ctx, x + 5, y + 1, 2, 2, hair);
      rect(ctx, x, y - 2, 2, 1, hair);
      rect(ctx, x + 3, y - 2, 2, 1, hair);
      rect(ctx, x + 1, y - 1, 1, 1, hi);
      rect(ctx, x + 4, y - 1, 1, 1, hi);
      break;
    case 'ponytail':
      rect(ctx, x, y - 1, 6, back ? 5 : 2, hair);
      rect(ctx, x + 1, y - 1, 3, 1, hi);
      if (back) {
        rect(ctx, x + 2, y + 3, 2, 1, lk.trim);
        rect(ctx, x + 2 + s, y + 4, 2, 4, hair);
      } else {
        rect(ctx, x, y + 1, 1, 2, hair);
        rect(ctx, x - 1, y, 1, 2, lk.trim);
        rect(ctx, x - 3, y, 2, 2, hair);
        rect(ctx, x - 3 + Math.min(0, s), y + 2, 2, 2, hair);
        rect(ctx, x - 3 + s, y + 4, 2, 1, hair);
      }
      break;
    case 'bun':
      rect(ctx, x, y - 1, 6, back ? 5 : 2, hair);
      if (!back) rect(ctx, x, y + 1, 2, 2, hair);
      rect(ctx, back ? x + 2 : x - 1, y - 3, 3, 2, hair);
      rect(ctx, back ? x + 3 : x, y - 3, 1, 1, hi);
      break;
    case 'bob':
      rect(ctx, x - 1, y - 1, 7, 2, hair);
      rect(ctx, x - 1, y + 1, back ? 8 : 3, back ? 4 : 4, hair);
      if (!back) rect(ctx, x + 5, y, 1, 2, hair);
      rect(ctx, x + 1, y - 1, 3, 1, hi);
      break;
    case 'bald':
      rect(ctx, x, y + 1, 1, 2, hair);
      rect(ctx, x + 1, y, 3, 1, lk.scalp);
      break;
    case 'beanie':
      rect(ctx, x - 1, y - 2, 7, 3, hat);
      rect(ctx, x - 1, y + 1, 7, 1, lk.hatShade);
      rect(ctx, x + 1, y - 4, 2, 2, lk.trim);
      if (!back) rect(ctx, x, y + 2, 1, 2, hair);
      break;
    case 'flatcap':
      rect(ctx, x, y + 1, back ? 6 : 2, back ? 3 : 2, hair);
      rect(ctx, x - 1, y - 1, 7, 2, hat);
      if (!back) rect(ctx, x + 4, y + 1, 3, 1, lk.hatShade);
      break;
  }
}

function body(
  ctx: Ctx,
  lk: Look,
  ps: Pose,
  back: boolean,
  mirrored: boolean,
  sway: number,
  held?: (ctx: Ctx) => void,
  heldOver = false,
) {
  const [hx, hy] = ps.hip,
    [nx, ny] = ps.neck;
  const top = Math.round(ny),
    hip = Math.round(hy);
  const shoulderFar: V2 = [nx - 4.5, ny + 1],
    shoulderNear: V2 = [nx + 4.5, ny + 1];
  const [footFar, footNear] = ps.feet,
    [kneeFar, kneeNear] = ps.knees ?? [null, null];
  const [handFar, handNear] = ps.hands,
    [elbowFar, elbowNear] = ps.elbows ?? [null, null];
  const nearArm = () => {
    limb(ctx, chain(shoulderNear, elbowNear, handNear), lk.arm);
    if (lk.glove)
      rect(ctx, Math.round(handNear[0] - 1.5), Math.round(handNear[1] - 0.5), 3, 3, lk.glove);
  };
  // Seen from behind, a hand held in front of the chest is hidden by the back.
  const tucked = back && handNear[1] > ny + 2 && handNear[0] > shoulderNear[0] - 1.5;
  limb(ctx, chain(shoulderFar, elbowFar, handFar), lk.farArm);
  if (lk.glove)
    rect(ctx, Math.round(handFar[0] - 1.5), Math.round(handFar[1] - 0.5), 3, 3, lk.gloveFar);
  const leg = (h: V2, knee: V2 | null, foot: V2, bands: Band[], boot: string) => {
    limb(ctx, chain(h, knee, [foot[0], foot[1] - 2]), bands);
    rect(ctx, Math.round(foot[0] - 1), Math.round(foot[1] - 2), 3, 2, boot);
  };
  leg([hx - 1.5, hy + 2], kneeFar, footFar, lk.farLeg, lk.bootFar);
  leg([hx + 1.5, hy + 2], kneeNear, footNear, lk.leg, lk.boot);
  if (tucked) {
    held?.(ctx);
    nearArm();
  }
  const skirt = lk.skirt ?? 3;
  rect(ctx, Math.round(hx - 3.5), hip, 7, skirt, lk.lower);
  rect(ctx, Math.round(hx - 3.5), hip, 1, skirt, lk.lowerShade);
  // The torso, row by row, so a lean or a bend keeps its pixels.
  const rows = Math.max(1, hip - top);
  let start = 0,
    left = Math.round(nx - 3.5),
    middle = left;
  for (let r = 1; r <= rows; r++) {
    const next = r < rows ? Math.round(nx + ((hx - nx) * r) / rows - 3.5) : NaN;
    if (next === left) continue;
    rect(ctx, left, top + start, 7, r - start, lk.shirt);
    rect(ctx, left, top + start, 1, r - start, lk.shade);
    if (start <= rows / 2) middle = left;
    start = r;
    left = next;
  }
  const collar = Math.round(nx);
  if (back) {
    rect(ctx, collar - 2, top, 5, 1, lk.trim);
    if (lk.number !== undefined && rows >= 6)
      glyphs(ctx, String(lk.number), middle + 3.5, top + 1, 1, lk.ink ?? lk.trim, mirrored);
  } else {
    rect(ctx, collar - 1, top, 3, 1, lk.trim);
    rect(ctx, collar, top, 1, 1, lk.skin);
    rect(ctx, collar + 1, top, 2, 1, lk.lit);
    if (lk.crest) {
      rect(ctx, collar + 1, top + 2, 2, 2, lk.trim);
      rect(ctx, collar + 1, top + 3, 1, 1, lk.shade);
    }
  }
  if (lk.scarf) {
    const [a, b] = lk.scarf;
    rect(ctx, collar - 3, top - 1, 7, 2, a);
    rect(ctx, collar - 1, top - 1, 2, 2, b);
    const hang = back ? collar - 2 : collar + 1;
    rect(ctx, hang, top + 1, 2, 5, a);
    rect(ctx, hang, top + 2, 2, 1, b);
    rect(ctx, hang, top + 4, 2, 1, b);
  }
  const early = !back && ps.behind;
  if (early) nearArm();
  hairAndFace(ctx, lk, Math.round(nx - 2.5), top - 7, back, sway, !!ps.mouth);
  if (early) held?.(ctx);
  else if (!tucked) {
    if (!heldOver) held?.(ctx);
    nearArm();
    if (heldOver) held?.(ctx);
  }
}

/** Moves the origin onto the nearest device pixel, so a sprite's edges land the same way every frame. */
function snapOrigin(ctx: Ctx) {
  const t = ctx.getTransform?.();
  if (!t || t.b || t.c || !Number.isFinite(t.e) || !Number.isFinite(t.f)) return;
  ctx.setTransform(t.a, 0, 0, t.d, Math.round(t.e), Math.round(t.f));
}
function drawFigure(
  ctx: Ctx,
  lk: Look,
  ps: Pose,
  st: Stance,
  sway = 0,
  held?: (ctx: Ctx) => void,
  heldOver = false,
) {
  const scale = st.scale ?? FIGURE_SCALE,
    lift = st.lift ?? 0;
  ctx.save();
  ctx.translate(st.x, st.y);
  snapOrigin(ctx);
  const k = Math.max(0.4, 1 - lift / 16);
  oval(ctx, 0, 0.5, (st.shadow ?? 5.2) * k, 2 * k, SHADOW);
  ctx.scale(scale, scale);
  ctx.translate(0, -lift);
  if (st.left) ctx.scale(-1, 1);
  body(ctx, lk, ps, st.back, st.left, sway, held, heldOver);
  ctx.restore();
}

/**
 * A keeper at full stretch, lying along the goal line. Local u runs from the boots (-u) to the
 * gloves (+u), v across the body (up is negative). Columns step one pixel per two along u, so
 * the body follows the line's 2:1 slope in whole pixels rather than as a rotated sprite.
 * `s` = 1 dives up-right on screen, -1 down-left; `reach` 0..1 stretches the arms.
 */
function drawDiver(
  ctx: Ctx,
  lk: Look,
  x: number,
  y: number,
  s: 1 | -1,
  lift: number,
  reach: number,
  back: boolean,
  ball: FootballBall | null,
) {
  const k = Math.max(0.5, 1 - lift / 18);
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(x, y + 0.5, 15 * k, 2.6 * k, -Math.atan2(1, 2), 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  snapOrigin(ctx);
  ctx.scale(FIGURE_SCALE, FIGURE_SCALE);
  // The body's centre line sits half a torso above the grass.
  ctx.translate(0, -4 - lift);
  const put = (u: number, v: number, w: number, h: number, c: string) => {
    for (let a = u; a < u + w;) {
      const b = Math.min(u + w, Math.floor(a / 2) * 2 + 2);
      // Each step overlaps the next a little, so no seam shows at fractional zooms.
      const over = b < u + w ? 0.4 : 0;
      rect(ctx, s > 0 ? a : -b - over, v - s * Math.floor(a / 2), b - a + over, h, c);
      a = b;
    }
  };
  // A limb along u from u0 (outward in direction d), coloured band by band.
  const along = (u0: number, d: 1 | -1, length: number, v: number, bands: readonly Band[]) => {
    let done = 0;
    for (const [l, c] of bands) {
      const n = Math.min(length - done, Math.max(1, Math.round(l)));
      if (n <= 0) break;
      put(d > 0 ? u0 + done : u0 - done - n, v, n, 2, c);
      done += n;
    }
  };
  // Sleeves out past the head to the gloves (or hands).
  const arm = Math.round(7 + 4 * reach);
  const sleeve = (bands: Band[]): Band[] => [[arm, bands[0][1]]];
  along(0, 1, arm, -6, sleeve(lk.farArm));
  put(arm, -7, 3, 3, lk.glove ? lk.gloveFar : lk.farArm.at(-1)![1]);
  along(-7, -1, 7, -3, lk.farLeg);
  put(-16, -4, 2, 3, lk.bootFar);
  put(-7, -4, 3, 7, lk.lower);
  put(-7, -4, 3, 1, lk.lowerShade);
  put(-4, -4, 7, 7, lk.shirt);
  put(-4, -4, 7, 1, lk.shade);
  if (!back && lk.crest) put(0, 0, 2, 2, lk.trim);
  put(2, -2, 1, 4, lk.trim);
  along(-7, -1, 7, 0, lk.leg);
  put(-16, 0, 2, 3, lk.boot);
  // The standing head, turned a quarter: row r of the sprite lands at u = 9 - r.
  hairAndFace(ctx, lk, 0, 0, back, 0, true, (_, hx, hy, w, h, c) =>
    put(10 - hy - h, hx - 3, h, w, c),
  );
  along(0, 1, arm, 3, sleeve(lk.arm));
  put(arm, 3, 3, 3, lk.glove ?? lk.arm.at(-1)![1]);
  if (ball) {
    const u = arm + 2;
    ballSprite(ctx, s * u - 2.5, -1.5 - s * Math.floor(u / 2) - 2, 5, ball.spin / BALL_TURN, 0, 1);
  }
  ctx.restore();
}

/** Front or back, right or left, from a facing vector on the ground (tile axes). */
const view = (f: Point) => ({ back: f.x + f.y < -1e-6, left: f.x - f.y < -1e-6 });
type View = ReturnType<typeof view>;
const steadyViews = new WeakMap<object, Map<number, View & { at: number }>>();
/**
 * The same with a little hysteresis: a figure keeps its side until its facing is clearly past
 * the diagonal, so a runner heading along a screen axis does not flip between front and back.
 * Remembered per canvas and figure; a jump in time starts afresh.
 */
function steadyView(ctx: Ctx, id: number, f: Point, at: number): View {
  let memo = steadyViews.get(ctx);
  if (!memo) steadyViews.set(ctx, (memo = new Map()));
  const raw = view(f),
    last = memo.get(id),
    length = Math.hypot(f.x, f.y) || 1;
  const v =
    last && at >= last.at && at - last.at < 0.5
      ? {
          back: Math.abs(f.x + f.y) / length < 0.4 ? last.back : raw.back,
          left: Math.abs(f.x - f.y) / length < 0.4 ? last.left : raw.left,
        }
      : raw;
  memo.set(id, { ...v, at });
  return v;
}

// Poses ------------------------------------------------------------------------------------------

const STAND: Pose = {
  hip: [0.5, -10],
  neck: [0.5, -17],
  feet: [
    [-1, 0],
    [2, 0],
  ],
  hands: [
    [-4, -10],
    [5, -10],
  ],
};
const mix = (a: V2, b: V2, f: number): V2 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
function runPose(phase: number, speed: number): Pose {
  const a = Math.min(1, Math.max(0.3, speed / 2.6));
  const s = Math.sin(phase * Math.PI * 2),
    c = Math.cos(phase * Math.PI * 2);
  const lean = speed > 2.3 ? 2 : speed > 0.9 ? 1 : 0;
  const bob = Math.abs(s) < 0.4 && a > 0.5 ? -1 : 0;
  const nearLift = Math.max(0, c) * 2.6 * a,
    farLift = Math.max(0, -c) * 2.6 * a;
  const near: V2 = [2 + s * 3.4 * a, -nearLift],
    far: V2 = [-1 - s * 3.4 * a, -farLift];
  const knee = (h: number, f: V2, lift: number): V2 => [
    (h + f[0]) / 2 + lift * 0.8,
    -4.5 - lift * 0.5 + bob,
  ];
  const nx = 0.5 + lean,
    sh = -16 + bob;
  const farElbow: V2 = [nx - 4.5 + s * 2.2 * a, sh + 3],
    nearElbow: V2 = [nx + 4.5 - s * 2.2 * a, sh + 3];
  return {
    hip: [0.5 + lean / 2, -10 + bob],
    neck: [nx, -17 + bob],
    feet: [far, near],
    knees: [knee(-1, far, farLift), knee(2, near, nearLift)],
    elbows: [farElbow, nearElbow],
    hands: [
      [farElbow[0] + 1.5, farElbow[1] - 2],
      [nearElbow[0] + 1.5, nearElbow[1] - 2],
    ],
  };
}
/**
 * The kick. The engine backdates it so the ball leaves the boot at t ≈ 0.375: from there the
 * leg is already out at the ball, sweeps up into the follow-through over a planted foot with the
 * body leaning back, then comes down.
 */
const KICK_KEYS: readonly (readonly [t: number, foot: V2, knee: V2, lean: number])[] = [
  [0, [-3.5, -3], [-0.5, -5.5], 1],
  [0.25, [-3.5, -3], [-0.5, -5.5], 1],
  [0.37, [6, -2], [3.5, -5.5], 0],
  [0.58, [8, -6.5], [5, -7], -1],
  [0.8, [4.5, -2], [3.5, -5], 0],
  [1, [2.5, 0], [2, -4.5], 0],
];
function kickPose(t: number): Pose {
  let i = 1;
  while (i < KICK_KEYS.length - 1 && t > KICK_KEYS[i][0]) i++;
  const [t0, foot0, knee0, lean0] = KICK_KEYS[i - 1],
    [t1, foot1, knee1, lean1] = KICK_KEYS[i];
  const f = clamp01((t - t0) / (t1 - t0));
  const lean = Math.round(lean0 + (lean1 - lean0) * f),
    wide = t > 0.3 && t < 0.85 ? 1 : 0;
  return {
    hip: [0.5, -10],
    neck: [0.5 + lean, -17],
    feet: [[-0.5, 0], mix(foot0, foot1, f)],
    knees: [[0, -5], mix(knee0, knee1, f)],
    elbows: [
      [-6 - wide, -14 - wide],
      [5.5, -13],
    ],
    hands: [
      [-8.5 - wide, -13 - wide * 2],
      [7, -10.5],
    ],
  };
}
const KNEEL: Pose = {
  hip: [0, -6],
  neck: [1, -13],
  feet: [
    [-4.5, 0],
    [3, 0],
  ],
  knees: [
    [-0.5, -1],
    [3.5, -5.5],
  ],
  elbows: [
    [-3, -9],
    [5.5, -9],
  ],
  hands: [
    [-0.5, -5.5],
    [4.5, -6],
  ],
};
const LAUNCH: Pose = {
  hip: [0.5, -9],
  neck: [3, -15],
  feet: [
    [-2.5, 0],
    [2.5, -1.5],
  ],
  knees: [
    [-1, -4.5],
    [3, -5.5],
  ],
  elbows: [
    [2, -19],
    [6.5, -18],
  ],
  hands: [
    [5, -22],
    [9, -20],
  ],
};
const mixOpt = (a: V2 | null | undefined, b: V2 | null | undefined, ma: V2, mb: V2, f: number) =>
  mix(a ?? ma, b ?? mb, f);
/** Blend two poses point by point (a missing knee or elbow sits halfway along its limb). */
function mixPose(a: Pose, b: Pose, f: number): Pose {
  const knee = (p: Pose, i: 0 | 1) => mix(p.hip, p.feet[i], 0.5);
  const elbow = (p: Pose, i: 0 | 1) =>
    mix([p.neck[0] + (i ? 4.5 : -4.5), p.neck[1] + 1], p.hands[i], 0.5);
  return {
    hip: mix(a.hip, b.hip, f),
    neck: mix(a.neck, b.neck, f),
    feet: [mix(a.feet[0], b.feet[0], f), mix(a.feet[1], b.feet[1], f)],
    knees: [
      mixOpt(a.knees?.[0], b.knees?.[0], knee(a, 0), knee(b, 0), f),
      mixOpt(a.knees?.[1], b.knees?.[1], knee(a, 1), knee(b, 1), f),
    ],
    hands: [mix(a.hands[0], b.hands[0], f), mix(a.hands[1], b.hands[1], f)],
    elbows: [
      mixOpt(a.elbows?.[0], b.elbows?.[0], elbow(a, 0), elbow(b, 0), f),
      mixOpt(a.elbows?.[1], b.elbows?.[1], elbow(a, 1), elbow(b, 1), f),
    ],
  };
}
const TACKLE: Pose = {
  hip: [-1.5, -5],
  neck: [-5, -11],
  feet: [
    [1.5, 0],
    [9, 0],
  ],
  knees: [
    [2, -5.5],
    [4, -3],
  ],
  elbows: [
    [-7.5, -7],
    [-2, -8],
  ],
  hands: [
    [-8, -3],
    [1, -10],
  ],
};
const SLIDE: Pose = {
  hip: [0, -6],
  neck: [-0.5, -13],
  feet: [
    [-5.5, 0],
    [-3, 0],
  ],
  knees: [
    [-1.5, -1.5],
    [2, -1.5],
  ],
  elbows: [
    [-6, -15],
    [6, -16],
  ],
  hands: [
    [-7.5, -19],
    [7.5, -20],
  ],
  mouth: true,
};
const REACH: Pose = {
  hip: [0.5, -10],
  neck: [0.5, -17],
  feet: [
    [-0.5, 0],
    [1.5, 0],
  ],
  elbows: [
    [-3.5, -21],
    [4.5, -21],
  ],
  hands: [
    [-2.5, -26],
    [3.5, -26],
  ],
};
const BENT: Pose = {
  hip: [0, -10],
  neck: [3, -14],
  feet: [
    [-1.5, 0],
    [2.5, 0],
  ],
  knees: [
    [-0.5, -5],
    [3, -5],
  ],
  elbows: [
    [1, -10],
    [4, -10],
  ],
  hands: [
    [2.5, -6],
    [5, -6],
  ],
};
const HEAD_IN_HANDS: Pose = {
  ...STAND,
  elbows: [
    [-5.5, -21],
    [6.5, -21],
  ],
  hands: [
    [-1.5, -24],
    [3, -24],
  ],
};
const CATCH: Pose = {
  ...STAND,
  elbows: [
    [1, -13],
    [4.5, -13],
  ],
  hands: [
    [3.5, -15],
    [5.5, -15],
  ],
};
const HANDSHAKE: Pose = {
  ...STAND,
  elbows: [null, [6.5, -14]],
  hands: [
    [-4, -10],
    [9.5, -14],
  ],
};
const WHISTLE: Pose = {
  ...STAND,
  elbows: [null, [5.5, -15]],
  hands: [
    [-4, -10],
    [3.5, -19.5],
  ],
};
const POINT: Pose = {
  ...STAND,
  elbows: [null, [8, -18]],
  hands: [
    [-4, -10],
    [11, -20],
  ],
};
const CARRY: Pose = {
  ...STAND,
  elbows: [null, [5.5, -13]],
  hands: [
    [-4, -10],
    [4.5, -11],
  ],
};
const SHOUT: Pose = {
  ...STAND,
  neck: [1, -17],
  elbows: [
    [0, -15],
    [5.5, -16],
  ],
  hands: [
    [2.5, -19.5],
    [4.5, -19.5],
  ],
  mouth: true,
};
const FOLDED: Pose = {
  ...STAND,
  elbows: [
    [-4, -12],
    [5, -12],
  ],
  hands: [
    [3, -13],
    [0, -13],
  ],
};
const throwPose = (t: number): Pose =>
  t < 0.5
    ? {
        ...STAND,
        neck: [-0.5, -17],
        feet: [
          [-2, 0],
          [2.5, 0],
        ],
        elbows: [
          [-3.5, -21],
          [1.5, -21],
        ],
        hands: [
          [-2, -25],
          [0.5, -25],
        ],
        behind: true,
      }
    : {
        ...STAND,
        neck: [1.5, -17],
        feet: [
          [-2, 0],
          [2.5, 0],
        ],
        elbows: [
          [0, -20],
          [5, -20],
        ],
        hands: [
          [3.5, -23],
          [6.5, -22],
        ],
      };
const cheer = (up: number, mouth = true): Pose => ({
  ...STAND,
  feet: [
    [-1, -up * 0.3],
    [2, -up * 0.4],
  ],
  elbows: [
    [-5, -20],
    [6, -20],
  ],
  hands: [
    [-6, -24.5],
    [7, -24.5],
  ],
  mouth,
});
const wavePose = (t: number): Pose => ({
  ...STAND,
  elbows: [null, [6.5, -20]],
  hands: [
    [-4, -10],
    [6.5 + Math.sin(t * 11) * 1.6, -25],
  ],
});
const DRINK: Pose = {
  ...STAND,
  neck: [0, -17],
  elbows: [null, [5.5, -15]],
  hands: [
    [-4, -10],
    [3.5, -20],
  ],
};
const clapPose = (t: number): Pose => {
  const open = Math.abs(Math.sin(t * 13)) * 2;
  return {
    ...STAND,
    elbows: [
      [-3, -12],
      [5.5, -12],
    ],
    hands: [
      [2.5 - open, -14],
      [4.5 + open * 0.5, -14],
    ],
  };
};

// Looks -----------------------------------------------------------------------------------------

const KITS = [
  {
    shirt: TEAMS[0].color,
    trim: TEAMS[0].light,
    shorts: '#F1EEE2',
    sock: TEAMS[0].color,
    ink: '#E6F4DD',
  },
  {
    shirt: TEAMS[1].color,
    trim: '#FFE7B8',
    shorts: '#3D3834',
    sock: TEAMS[1].color,
    ink: '#5A3517',
  },
] as const;
const KEEPER_KITS = [
  { shirt: '#A487C7', trim: '#EDE4F7', shorts: '#433D57', sock: '#A487C7', ink: '#3B3150' },
  { shirt: '#D9736B', trim: '#FFE6DA', shorts: '#3D3834', sock: '#D9736B', ink: '#FFF3EA' },
] as const;
const GLOVE = '#F2EEDA';
const PLAYER_LOOKS = Array.from({ length: 10 }, (_, id) => {
  const profile = playerProfile(id),
    keeper = id % 5 === 0,
    kit = (keeper ? KEEPER_KITS : KITS)[id < 5 ? 0 : 1];
  return makeLook({
    skin: profile.skin,
    hair: profile.hair,
    style: profile.hairStyle,
    shirt: kit.shirt,
    trim: kit.trim,
    lower: kit.shorts,
    leg: [
      [1, kit.shorts],
      [1.6, profile.skin],
      [1, kit.trim],
      [99, kit.sock],
    ],
    boot: '#2C312E',
    arm: keeper
      ? [
          [4.5, kit.shirt],
          [99, GLOVE],
        ]
      : [
          [2, kit.shirt],
          [1, kit.trim],
          [2.4, profile.skin],
          [99, tint(profile.skin, -10)],
        ],
    glove: keeper ? GLOVE : undefined,
    number: profile.number,
    ink: kit.ink,
    crest: true,
  });
});
const REFEREE_LOOK = makeLook({
  skin: '#C99A6E',
  hair: '#8E887D',
  style: 'short',
  shirt: '#2F3A38',
  trim: '#E9C84B',
  lower: '#20272A',
  leg: [
    [1, '#20272A'],
    [1.6, '#C99A6E'],
    [1, '#E9C84B'],
    [99, '#2B3432'],
  ],
  boot: '#1E2322',
  arm: [
    [2, '#2F3A38'],
    [1, '#E9C84B'],
    [99, '#C99A6E'],
  ],
  crest: true,
});
const casual = (
  skin: string,
  hair: string,
  style: Hair,
  jacket: string,
  trousers: string,
  extra: Partial<LookSpec> = {},
) =>
  makeLook({
    skin,
    hair,
    style,
    shirt: jacket,
    trim: tint(jacket, 30),
    lower: trousers,
    leg: [[99, trousers]],
    boot: '#3A3430',
    arm: [
      [4.5, jacket],
      [99, skin],
    ],
    ...extra,
  });
const MANAGERS = [
  {
    team: 0 as const,
    x: 12.25,
    look: casual('#E2BE95', '#A39D92', 'flatcap', '#3E5C4F', '#353A37', {
      hat: '#66634F',
      skirt: 5,
      lower: '#3E5C4F',
      scarf: [TEAMS[0].color, TEAMS[0].light],
    }),
  },
  {
    team: 1 as const,
    x: 18.75,
    look: casual('#8A5E44', '#241E1B', 'beanie', '#8A5230', '#2F3336', {
      hat: TEAMS[1].color,
      trim: TEAMS[1].light,
    }),
  },
];
type Prop = 'flag' | 'scarf' | 'hat' | 'shirt' | null;
// Two staggered rows well back from the rail (y >= 28.45, behind the residents' strip at
// 28.15), so the touchline stays in view. Meadow's end is the west corner, Sunset's the east.
const FANS = (
  [
    [10.8, 28.76, 0, 'flag', '#D9B68B', '#675A48', 'short', '#5E7F9A', '#3E4C5E'],
    [11.32, 28.47, 0, 'scarf', '#A57855', '#2E2622', 'curly', '#C98E62', '#44403C'],
    [11.86, 28.78, 0, 'hat', '#E8CBA4', '#CBC6A6', 'bob', '#8C6A9E', '#4B4A58'],
    [12.44, 28.49, 0, 'shirt', '#7E553B', '#1F1A18', 'buzz', '', '#3B4A55'],
    [17.12, 28.49, 1, 'shirt', '#EBC9A0', '#C9803F', 'ponytail', '', '#3E4C5E'],
    [17.68, 28.78, 1, 'hat', '#916447', '#2A2320', 'short', '#B5654A', '#44403C'],
    [18.24, 28.47, 1, 'scarf', '#E2BE95', '#8A5A36', 'bun', '#567F79', '#4B4A58'],
    [18.8, 28.76, 1, 'flag', '#B78259', '#342E2B', 'bald', '#D8C8A0', '#3E4C5E'],
  ] as const
).map(([x, y, team, prop, skin, hair, style, jacket, trousers]) => {
  const colours = TEAMS[team];
  const shirt = prop === 'shirt' ? colours.color : jacket;
  return {
    x,
    y,
    team,
    prop: prop as Prop,
    look: casual(skin, hair, prop === 'hat' ? 'beanie' : style, shirt, trousers, {
      hat: colours.color,
      trim: colours.light,
      scarf: prop === 'shirt' ? undefined : [colours.color, colours.light],
      crest: prop === 'shirt',
    }),
  };
});
const VENDOR = casual('#C99A6E', '#5C4336', 'flatcap', '#F3E7C8', '#E08A62', {
  hat: '#DE8D6A',
  trim: '#DE8D6A',
});

// Items held in the hands (sprite units) --------------------------------------------------------

const BALL = '#FFFDF4',
  BALL_PATCH = '#3C4842',
  BALL_RIM = mixHex(BALL, BALL_PATCH, 0.5);
/**
 * A 6 px (or 5 px) round ball whose dark panels roll through it along its main direction. A
 * soft dark outline and a grey lower-right rim part it from white shorts, lines and posts.
 */
function ballSprite(
  ctx: Ctx,
  x: number,
  y: number,
  size: 5 | 6,
  roll: number,
  dx: number,
  dy: number,
) {
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * 0.42;
  rect(ctx, x, y - 1, size, size + 2, BALL_PATCH);
  rect(ctx, x - 1, y, size + 2, size, BALL_PATCH);
  ctx.globalAlpha = alpha;
  rect(ctx, x + 1, y, size - 2, size, BALL);
  rect(ctx, x, y + 1, size, size - 2, BALL);
  rect(ctx, x + 1, y + size - 1, size - 2, 1, BALL_RIM);
  rect(ctx, x + size - 1, y + 1, 1, size - 2, BALL_RIM);
  const across = Math.abs(dx) > Math.abs(dy) * 1.2,
    forward = (across ? dx : dy) < 0 ? -1 : 1;
  const step = Math.floor((((roll % 1) + 1) % 1) * size);
  for (const [offset, lane, width] of [
    [0, 1, 2],
    [Math.floor(size / 2), size - 2, 1],
  ]) {
    let r = (step + offset) % size;
    if (forward < 0) r = size - 1 - r;
    const a = Math.max(r - 1, lane === 1 && (r === 0 || r === size - 1) ? 1 : 0),
      b = Math.min(r + 1, size - 1);
    if (across) rect(ctx, x + a, y + lane, b - a, width, BALL_PATCH);
    else rect(ctx, x + lane, y + a, width, b - a, BALL_PATCH);
  }
}
const heldBall =
  (hx: number, hy: number, spin: number) =>
  (ctx: Ctx): void =>
    ballSprite(ctx, Math.round(hx - 2.5), Math.round(hy - 2.5), 5, spin / BALL_TURN, 0, 1);

// ---------------------------------------------------------------------------------------------
// Players, referee and ball (exported for the sprite sheet).

/** `side`: which way the sprite shows (front or back, mirrored or not); by default from `facing`. */
export function drawFootballPlayer(
  ctx: Ctx,
  p: FootballPlayer,
  time: number,
  ball?: FootballBall,
  side: View = view(p.facing),
) {
  const lk = PLAYER_LOOKS[p.id] ?? PLAYER_LOOKS[p.team * 5 + 1];
  const pt = project(p.x, p.y);
  const { back, left } = side;
  const t = clamp01(p.actionT);
  const holding = !!ball && ball.held && ball.owner === p.id;
  let ps: Pose = STAND,
    lift = 0,
    shadow = 5.2,
    sway = Math.sin(time * 2.2 + p.id) * 0.6,
    held: ((ctx: Ctx) => void) | undefined,
    heldOver = false,
    dust = 0,
    puff = 0,
    diver: { s: 1 | -1; lift: number; reach: number } | null = null;
  const { x, y } = pt;
  const phase = p.stride / STRIDE;
  switch (p.action) {
    case 'run':
      ps = runPose(phase, p.speed);
      shadow = 5.2 + Math.min(2.6, p.speed * 0.8);
      sway = Math.sin(phase * Math.PI * 2) * 1.2;
      if (holding) held = heldBall(6, -14, ball!.spin);
      break;
    case 'kick':
      ps = kickPose(t);
      // A puff of grass where the boot meets the ball.
      if (t > 0.34 && t < 0.62) puff = (t - 0.34) / 0.28;
      break;
    case 'tackle':
      ps = TACKLE;
      shadow = 8;
      dust = 1 - t;
      break;
    case 'dive': {
      // Push off, fly, land (one small bounce), lie a beat, then get up via a kneel.
      const dir = Math.abs(p.dive) > 0.05 ? Math.sign(p.dive) : p.facing.y < 0 ? -1 : 1;
      const reach = clamp01(Math.abs(p.dive) * 1.3);
      if (t >= 0.1 && t < 0.78) {
        const air =
          t < 0.42
            ? Math.sin((Math.PI * (t - 0.1)) / 0.32) * (3 + 5 * reach)
            : t < 0.5
              ? Math.sin((Math.PI * (t - 0.42)) / 0.08) * 1.2
              : 0;
        // +y on the ground is down-left on screen: the body lies along the goal line.
        diver = { s: dir > 0 ? -1 : 1, lift: air, reach };
        if (t > 0.42 && t < 0.64) dust = (0.64 - t) / 0.22;
      } else {
        ps = t < 0.1 ? LAUNCH : t < 0.9 ? KNEEL : mixPose(KNEEL, STAND, (t - 0.9) / 0.1);
        if (holding) held = heldBall(t < 0.1 ? 7 : 3.5, t < 0.1 ? -21.5 : -7.5, ball!.spin);
      }
      break;
    }
    case 'catch': {
      // A high ball is taken above the head, anything lower is gathered into the chest.
      const high = !!ball && ball.height > 20 && t < 0.6;
      ps = high ? REACH : CATCH;
      if (holding) held = high ? heldBall(0.5, -28, ball!.spin) : heldBall(5, -15.5, ball!.spin);
      heldOver = high;
      break;
    }
    case 'throw':
      ps = throwPose(t);
      if (holding) {
        held = t < 0.5 ? heldBall(-0.5, -27.5, ball!.spin) : heldBall(5.5, -25.5, ball!.spin);
        heldOver = true;
      }
      break;
    case 'celebrate': {
      const up = Math.sin(Math.PI * t);
      ps = cheer(up);
      lift = up * 6;
      break;
    }
    case 'slide':
      ps = SLIDE;
      shadow = 7;
      dust = 1 - t;
      break;
    case 'dejected':
      ps = p.id % 2 ? BENT : HEAD_IN_HANDS;
      break;
    case 'wave':
      ps = wavePose(time + p.id);
      break;
    case 'drink':
      ps = DRINK;
      held = (ctx) => {
        rect(ctx, 3, -23, 2, 5, '#9FCFD6');
        rect(ctx, 3, -24, 2, 1, lk.trim);
      };
      heldOver = true;
      break;
    case 'handshake':
      ps = HANDSHAKE;
      break;
    default:
      if (holding) {
        ps = CATCH;
        held = heldBall(5, -15.5, ball!.spin);
      }
  }
  if (p.hasBall && !holding && p.action !== 'celebrate') {
    // The carrier's ring: a dark under-edge, then the team colour, readable on either stripe.
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(22,40,30,0.4)';
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y + 1.4, 8.8, 4.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = TEAMS[p.team].color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y + 0.5, 8.5, 4.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (diver) {
    // Grass sprays along the line where the keeper lands.
    if (dust > 0.05) {
      ctx.globalAlpha = dust * 0.8;
      for (const [u, h, c] of GRASS_SPRAY)
        rect(
          ctx,
          x + diver.s * u * (1.4 - dust * 0.4),
          y - (diver.s * u) / 2 - h * (1.2 - dust),
          2,
          1,
          c,
        );
      ctx.globalAlpha = 1;
    }
    return drawDiver(
      ctx,
      lk,
      x,
      y,
      diver.s,
      diver.lift,
      diver.reach,
      p.x > MID.x,
      holding ? ball! : null,
    );
  }
  if (dust > 0.05) {
    // Scuffed grass kicked up behind a slide.
    const d = left ? 1 : -1;
    ctx.globalAlpha = dust * 0.8;
    rect(ctx, x + d * 9, y - 3, 2, 2, '#D9D2A8');
    rect(ctx, x + d * 12, y - 5, 2, 1, '#B9C98F');
    rect(ctx, x + d * 14, y - 2, 1, 1, '#D9D2A8');
    ctx.globalAlpha = 1;
  }
  drawFigure(ctx, lk, ps, { x, y, back, left, lift, shadow }, sway, held, heldOver);
  if (puff > 0) {
    // Contact: a few blades and a dust mote burst from the boot, then settle.
    const d = left ? -1 : 1,
      f = FIGURE_SCALE;
    ctx.globalAlpha = 1 - puff;
    for (const [u, h, c] of KICK_PUFF)
      rect(ctx, x + d * (5 + u * (0.6 + puff)) * f, y - (1 + h * (0.5 + puff)) * f, 1.5, 1.5, c);
    ctx.globalAlpha = 1;
  }
}
const GRASS_SPRAY = [
  [-10, 2, '#B9C98F'],
  [-3, 4, '#D9D2A8'],
  [4, 3, '#B9C98F'],
  [11, 2, '#D9D2A8'],
  [15, 4, '#9DBB7E'],
] as const;
const KICK_PUFF = [
  [1, 2, '#E3DDB6'],
  [3, 1, '#B9C98F'],
  [2, 4, '#9DBB7E'],
  [-1, 3, '#E3DDB6'],
] as const;

export function drawFootballReferee(
  ctx: Ctx,
  r: FootballReferee,
  time: number,
  ball?: FootballBall,
  side: View = view(r.facing),
) {
  const pt = project(r.x, r.y);
  const { back, left } = side;
  let ps: Pose = STAND,
    held: ((ctx: Ctx) => void) | undefined,
    shadow = 5.2;
  if (r.action === 'run') {
    ps = runPose(r.stride / STRIDE, r.speed);
    shadow = 5.2 + Math.min(2.6, r.speed * 0.8);
  } else if (r.action === 'whistle') {
    ps = WHISTLE;
    held = (ctx) => rect(ctx, 4, -20, 2, 1, '#E9C84B');
  } else if (r.action === 'point') ps = POINT;
  else if (r.action === 'carry' || (ball?.held && ball.owner === -1)) {
    ps = CARRY;
    held = heldBall(4, -13, ball?.spin ?? 0);
  }
  drawFigure(
    ctx,
    REFEREE_LOOK,
    ps,
    { x: pt.x, y: pt.y, back, left, shadow },
    Math.sin(time * 2) * 0.5,
    held,
    r.action === 'whistle',
  );
}

/** `trailFrom`: ground speed (tiles/s) where the speed streak starts; lower for a shot. */
export function drawFootballBall(ctx: Ctx, ball: FootballBall, trailFrom = 4.2) {
  const p = project(ball.x, ball.y),
    h = Math.max(0, ball.height);
  const k = 1 / (1 + h / 14);
  oval(ctx, p.x, p.y + 0.5, 3 * k + 0.9, 1.3 * k + 0.4, `rgba(24,48,34,${(0.38 * k).toFixed(2)})`);
  const { dx, dy } = ballHeading(ball);
  const speed = Math.hypot(ball.vx, ball.vy),
    cy = p.y - 3 - h;
  if (speed > trailFrom) {
    const trail = Math.min(18, 3 + (speed - trailFrom) * 3.4);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,252,236,0.26)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(p.x - dx * 2, cy - dy * 2);
    ctx.lineTo(p.x - dx * trail, cy - dy * trail);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  ballSprite(ctx, p.x - 3, cy - 3, 6, ball.spin / BALL_TURN, dx, dy);
}
function ballHeading(ball: FootballBall) {
  const sx = (ball.vx - ball.vy) * 38,
    sy = (ball.vx + ball.vy) * 19,
    length = Math.hypot(sx, sy);
  return { dx: length ? sx / length : 0, dy: length ? sy / length : 1 };
}
/** The ball seen through whoever stands in front of it: faint, with a crisp outline. */
function ghostBall(ctx: Ctx, ball: FootballBall) {
  const p = project(ball.x, ball.y),
    { dx, dy } = ballHeading(ball);
  const x = p.x - 3,
    y = p.y - 6 - Math.max(0, ball.height);
  ctx.globalAlpha = 0.5;
  ballSprite(ctx, x, y, 6, ball.spin / BALL_TURN, dx, dy);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = BALL_PATCH;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 1, y - 0.5);
  ctx.lineTo(x + 5, y - 0.5);
  ctx.lineTo(x + 6.5, y + 1);
  ctx.lineTo(x + 6.5, y + 5);
  ctx.lineTo(x + 5, y + 6.5);
  ctx.lineTo(x + 1, y + 6.5);
  ctx.lineTo(x - 0.5, y + 5);
  ctx.lineTo(x - 0.5, y + 1);
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------------------------
// Around the pitch.

/** The scoreboard stands behind the far touchline, facing the pitch along the x axis. */
const BOARD = { x0: 14.05, x1: 16.95, y: 22.12, low: 27, high: 67 };
const BOARD_ORIGIN = project(BOARD.x0, BOARD.y);
const BOARD_W = project(BOARD.x1, BOARD.y).x - BOARD_ORIGIN.x;
export function scoreboardHit(point: Point) {
  const u = point.x - BOARD_ORIGIN.x,
    v = point.y - BOARD_ORIGIN.y - u / 2;
  return u >= -4 && u <= BOARD_W + 8 && v >= -BOARD.high - 11 && v <= -BOARD.low + 2;
}
/** True when `p` is inside the convex screen polygon `poly` (either winding). */
function inConvex(p: Point, poly: Point[]) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}
/**
 * The ground's tall furniture that rises out of its plan: dugout roofs, floodlight masts and
 * the scoreboard's legs. Returns the depth it is drawn at when `point` is on one, else -Infinity.
 */
export function footballFurnitureHit(point: Point) {
  let depth = -Infinity;
  const u = point.x - BOARD_ORIGIN.x,
    v = point.y - BOARD_ORIGIN.y - u / 2;
  if (v >= -BOARD.low - 1 && v <= 1 && [18, BOARD_W - 21].some((l) => u >= l - 1 && u <= l + 4))
    depth = 15.5 + BOARD.y;
  for (const d of DUGOUTS) {
    // An upright box's outline: top corners, then the near corners on the ground.
    const { back, front, high } = DUG;
    const box = [
      at(d.x0, back, high),
      at(d.x1, back, high),
      at(d.x1, back),
      at(d.x1, front),
      at(d.x0, front),
      at(d.x0, front, high),
    ];
    if (inConvex(point, box)) depth = Math.max(depth, d.x0 + back);
  }
  for (const m of MASTS) {
    const p = at(m.x, m.y),
      hx = p.x - 7 + (at(MID.x, MID.y).x > p.x ? 2 : -2),
      hy = p.y - m.high - 8;
    const pole = Math.abs(point.x - p.x) <= 3 && point.y >= hy && point.y <= p.y + 2;
    const head = point.x >= hx - 1 && point.x <= hx + 15 && point.y >= hy - 1 && point.y <= hy + 9;
    if (pole || head) depth = Math.max(depth, m.x + m.y);
  }
  return depth;
}
const FONT = (px: number) => `bold ${px}px "Space Mono", monospace`;
function goalLine(game: FootballState) {
  for (let i = game.events.length - 1; i >= 0; i--) {
    const e = game.events[i];
    if (e.kind !== 'goal') continue;
    // The engine books an own goal to nobody: it counts for the team, not the unlucky player.
    if (e.player === null) return `OWN GOAL · ${e.minute}'`;
    return `GOAL · ${playerProfile(e.player).name.toUpperCase()} ${e.minute}'`;
  }
  if (game.celebration)
    return `GOAL · ${playerProfile(game.celebration.player).name.toUpperCase()}`;
  return 'GOOOAL!';
}
function scoreboard(ctx: Ctx, game: FootballState, night: boolean, time: number, light: number) {
  const n = night ? 1 : 0,
    { x0, x1, y, low, high } = BOARD,
    W = BOARD_W;
  shape(
    ctx,
    [at(x0, y, high), at(x1, y, high), at(x1, y - 0.12, high), at(x0, y - 0.12, high)],
    P.boardTop[n],
  );
  shape(
    ctx,
    [at(x1, y, low), at(x1, y, high), at(x1, y - 0.12, high), at(x1, y - 0.12, low)],
    P.boardSide[n],
  );
  ctx.save();
  ctx.translate(BOARD_ORIGIN.x, BOARD_ORIGIN.y);
  ctx.transform(1, 0.5, 0, 1, 0, 0);
  for (const u of [18, W - 21]) {
    rect(ctx, u, -low, 3, low, pick(P.steel, night));
    rect(ctx, u + 2, -low, 1, low, pick(P.steelDark, night));
  }
  rect(ctx, -1, -high, W + 2, high - low, P.board[n]);
  rect(ctx, 2, -high + 3, W - 4, high - low - 6, P.boardFace[n]);
  rect(ctx, -1, -high, W + 2, 1, tint(P.board[n], 26));
  // Name plate.
  rect(ctx, W / 2 - 27, -high - 9, 54, 9, P.plate[n]);
  rect(ctx, W / 2 - 27, -high - 1, 54, 1, tint(P.plate[n], -30));
  ctx.textAlign = 'center';
  ctx.font = FONT(5);
  ctx.fillStyle = P.plateInk[n];
  ctx.fillText('MEADOW GROUND', W / 2, -high - 2.6);
  const flash = game.goal && Math.floor(time * 2.5) % 2 === 0;
  const off = (c: string) => (game.live ? c : mixHex(c, '#1B2B26', 0.55));
  for (const team of [0, 1] as const) {
    const colours = TEAMS[team],
      right = team === 1;
    const chip = right ? W - 9 : 6;
    rect(ctx, chip, -high + 6, 3, 14, off(colours.color));
    rect(ctx, chip, -high + 6, 3, 1, off(colours.light));
    ctx.textAlign = right ? 'right' : 'left';
    ctx.font = FONT(6);
    ctx.fillStyle = off(colours.light);
    ctx.fillText(colours.short, right ? W - 12 : 12, -high + 16);
    const scored = flash && game.celebration?.team === team;
    const digits = game.live ? String(game.score[team]) : '-';
    glyphs(
      ctx,
      digits,
      W / 2 + (right ? 13 : -13),
      -high + 5,
      3,
      scored ? colours.light : off('#FFD98A'),
    );
  }
  glyphs(ctx, ':', W / 2, -high + 5, 3, off('#FFD98A'));
  rect(ctx, 5, -high + 22, W - 10, 1, '#2F4A40');
  const status = !game.live
    ? 'SEE YOU AT SUNRISE'
    : game.goal
      ? goalLine(game)
      : game.phase === 'halftime'
        ? 'HALF-TIME'
        : game.phase === 'fulltime'
          ? 'FULL-TIME'
          : `${game.clock}  ${game.half === 1 ? '1ST' : '2ND'} HALF`;
  if (game.goal && game.celebration) {
    const colours = TEAMS[game.celebration.team];
    rect(ctx, 4, -high + 24, W - 8, 10, flash ? colours.light : colours.color);
    ctx.fillStyle = flash ? '#1D2B25' : colours.light;
  } else
    ctx.fillStyle = game.live
      ? '#F3E6BF'
      : night
        ? mixHex('#F3CB7A', '#5E6B62', 0.2)
        : mixHex('#F3CB7A', '#5E6B62', 0.45);
  ctx.textAlign = 'center';
  ctx.font = FONT(6);
  ctx.fillText(status, W / 2, -high + 31.5, W - 10);
  ctx.restore();
  // The board's own glow: with the floodlights, and faintly all night for the sunrise line.
  const glow = Math.max(0.12 * light, night ? 0.15 : 0);
  if (glow > 0)
    drawGlow(ctx, BOARD_ORIGIN.x + W / 2, BOARD_ORIGIN.y + W / 4 - (high + low) / 2, 42, glow);
}

/**
 * The board is long and thin across the depth sort: drawn at one depth, a resident on the road
 * behind its right end would stand in front of it, and one keyed at its right end would hide a
 * ball dropping onto the touchline. So it is drawn in vertical slices, each keyed by its own
 * right end and clipped to whole device pixels so the slices meet without a seam.
 */
function addScoreboard(
  add: (depth: number, paint: () => void) => void,
  ctx: Ctx,
  paint: () => void,
) {
  const n = 4,
    t = ctx.getTransform?.();
  if (!t || t.b || t.c) return add(15.5 + BOARD.y, paint);
  for (let i = 0; i < n; i++) {
    const x0 = BOARD.x0 + ((BOARD.x1 - BOARD.x0) * i) / n,
      x1 = BOARD.x0 + ((BOARD.x1 - BOARD.x0) * (i + 1)) / n;
    add(x1 + BOARD.y, () => {
      const now = ctx.getTransform();
      const edge = (x: number) => Math.round(now.a * project(x, BOARD.y).x + now.e);
      // The end slices reach out over the side face, the overhang and the glow.
      const left = i === 0 ? -1e5 : edge(x0),
        right = i === n - 1 ? 1e5 : edge(x1);
      ctx.save();
      ctx.resetTransform();
      ctx.beginPath();
      ctx.rect(left, -1e5, right - left, 2e5);
      ctx.clip();
      ctx.setTransform(now);
      paint();
      ctx.restore();
    });
  }
}

const DUGOUTS = [
  { team: 0 as const, x0: 11.6, x1: 12.9 },
  { team: 1 as const, x0: 18.1, x1: 19.4 },
];
const DUG = { back: 22.14, front: 22.5, high: 19, low: 17 };
/**
 * A dugout with a clear perspex roof and end: a neutral shell, the team's colour only on the
 * bucket seats and a thin fascia along the roof's front edge.
 */
function dugout(ctx: Ctx, d: (typeof DUGOUTS)[number], night: boolean, live: boolean) {
  const n = night ? 1 : 0,
    { x0, x1 } = d,
    { back, front, high, low } = DUG;
  const colours = TEAMS[d.team];
  const kit = mixHex(colours.color, night ? '#27383A' : '#B9B29A', night ? 0.6 : 0.18);
  const wall = (x: number, h0: number, h1: number) => [
    at(x, back, h0),
    at(x, front, h0),
    at(x, front, h1 - 2),
    at(x, back, h1),
  ];
  shape(ctx, plate(x0 - 0.06, back - 0.03, x1 + 0.06, front + 0.12), P.pad[n]);
  shape(ctx, [at(x0, back), at(x1, back), at(x1, back, high), at(x0, back, high)], P.interior[n]);
  shape(
    ctx,
    [at(x0, back, 11), at(x1, back, 11), at(x1, back, 12), at(x0, back, 12)],
    P.interiorSide[n],
  );
  shape(ctx, wall(x0, 0, high), P.interiorSide[n]);
  shape(ctx, plate(x0 + 0.05, back + 0.03, x1 - 0.05, back + 0.17, 5), P.wood[n]);
  shape(
    ctx,
    [
      at(x0 + 0.05, back + 0.17, 5),
      at(x1 - 0.05, back + 0.17, 5),
      at(x1 - 0.05, back + 0.17, 3),
      at(x0 + 0.05, back + 0.17, 3),
    ],
    P.woodShade[n],
  );
  // Bucket seats in the team colour.
  for (let i = 0; i < 5; i++) {
    const seat = at(x0 + 0.17 + i * 0.24, back + 0.1, 5);
    rect(ctx, seat.x - 3, seat.y - 6, 6, 6, kit);
    rect(ctx, seat.x - 3, seat.y - 6, 6, 1, tint(kit, 26));
  }
  if (live) {
    // A kit bag and a few bottles by the bench.
    const bag = at(x0 + 0.34, back + 0.28);
    rect(ctx, bag.x - 5, bag.y - 5, 10, 5, pick(P.woodShade, night));
    rect(ctx, bag.x - 5, bag.y - 5, 10, 1, pick(P.wood, night));
    for (let i = 0; i < 3; i++) {
      const b = at(x1 - 0.42 + i * 0.1, back + 0.3);
      rect(ctx, b.x - 1, b.y - 5, 2, 5, night ? '#6F8F92' : '#9FCFD6');
    }
  }
  // Clear perspex end and roof, framed in white.
  const glass = night ? 'rgba(170,196,190,0.16)' : 'rgba(255,255,255,0.25)';
  shape(ctx, wall(x1, 0, high), glass);
  const roof = [
    at(x0 - 0.06, back - 0.06, high + 1.5),
    at(x1 + 0.06, back - 0.06, high + 1.5),
    at(x1 + 0.06, front + 0.06, low + 1),
    at(x0 - 0.06, front + 0.06, low + 1),
  ];
  shape(ctx, roof, glass);
  trace(ctx, roof);
  const frame = wall(x1, 0, high);
  ctx.moveTo(frame[0].x, frame[0].y);
  ctx.lineTo(frame[3].x, frame[3].y);
  ctx.moveTo(frame[1].x, frame[1].y);
  ctx.lineTo(frame[2].x, frame[2].y);
  ctx.strokeStyle = pick(P.rail, night);
  ctx.lineWidth = 1;
  ctx.stroke();
  shape(
    ctx,
    [roof[3], roof[2], { x: roof[2].x, y: roof[2].y + 2.5 }, { x: roof[3].x, y: roof[3].y + 2.5 }],
    night ? mixHex(colours.color, '#27383A', 0.6) : colours.color,
  );
}

type Ad = {
  x: number;
  y0: number;
  y1: number;
  along: 'x' | 'y';
  text: string;
  bg: string;
  ink: string;
};
const ADS: Ad[] = (
  [
    [10.95, 11.5, 'ZOO', '#D9AE4E', '#3D3A2A'],
    [13.0, 14.1, 'BAKERY', '#C8775A', '#FBEBD0'],
    [14.2, 15.4, 'FORKTOWN', '#EFE6C8', '#2F6B57'],
    [15.6, 16.8, 'TEA ROOM', '#4F8A83', '#F4EDD6'],
    [16.9, 18.0, 'POPCORN', '#B85C57', '#FBEAD2'],
    [19.5, 20.05, 'DUCKS', '#8DB4B0', '#FFFFFF'],
  ] as const
)
  .map(([y0, y1, text, bg, ink]): Ad => ({ x: 22.5, y0, y1, along: 'x', text, bg, ink }))
  .concat(
    (
      [
        [22.95, 24.0, 'LANTERNS', '#35544E', '#F3CB7A'],
        [26.0, 27.05, 'FARM EGGS', '#F2E9D0', '#8A5A36'],
      ] as const
    ).map(([y0, y1, text, bg, ink]): Ad => ({ x: 10.3, y0, y1, along: 'y', text, bg, ink })),
  );
const AD_HIGH = 7;
function adBoard(ctx: Ctx, ad: Ad, night: boolean) {
  const shade = (c: string) => (night ? mixHex(c, '#23332F', 0.55) : c);
  // Boards along x (north side) run from x=y0 to x=y1 at y=ad.x; along y (west end) they
  // run from y=y1 to y=y0 at x=ad.x, reading left to right on screen.
  const a = ad.along === 'x' ? at(ad.y0, ad.x) : at(ad.x, ad.y1),
    b = ad.along === 'x' ? at(ad.y1, ad.x) : at(ad.x, ad.y0);
  const bg = shade(ad.bg);
  shape(ctx, [a, b, { x: b.x, y: b.y - AD_HIGH }, { x: a.x, y: a.y - AD_HIGH }], bg);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - AD_HIGH + 0.5);
  ctx.lineTo(b.x, b.y - AD_HIGH + 0.5);
  ctx.strokeStyle = tint(bg, 28);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - 0.5);
  ctx.lineTo(b.x, b.y - 0.5);
  ctx.strokeStyle = tint(bg, -40);
  ctx.stroke();
  const w = b.x - a.x;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.transform(1, (b.y - a.y) / w, 0, 1, 0, 0);
  ctx.font = FONT(5);
  ctx.textAlign = 'center';
  ctx.fillStyle = shade(ad.ink);
  ctx.fillText(ad.text, w / 2, -1.9, w - 3);
  ctx.restore();
}
/** Each board's own offscreen strip: just its face, outline and a margin. */
const AD_BOXES = ADS.map((ad) => {
  const ends =
    ad.along === 'x' ? [at(ad.y0, ad.x), at(ad.y1, ad.x)] : [at(ad.x, ad.y0), at(ad.x, ad.y1)];
  return boxAround([...ends, ...ends.map((p) => ({ x: p.x, y: p.y - AD_HIGH }))], 5);
});
/**
 * The boards take part in the depth sort, keyed by their nearer end, so a ball resting against
 * the front of one always draws over it. While a ball or a player is behind a board, that board
 * is cut into quarter-tile pieces and anything more than an eighth of a tile behind it loses its
 * feet to it. Each piece copies a whole-pixel strip of the board's cached layer, so pieces meet
 * without seams.
 */
function addBoards(
  add: (depth: number, paint: () => void) => void,
  ctx: Ctx,
  game: FootballState,
  night: boolean,
) {
  const movers: Point[] = [...game.players, game.ball, ...(game.referee ? [game.referee] : [])];
  ADS.forEach((ad, index) => {
    const box = AD_BOXES[index];
    const behind = movers.some((m) =>
      ad.along === 'x'
        ? m.y < ad.x && m.x > ad.y0 - 0.6 && m.x < ad.y1 + 0.6
        : m.x < ad.x && m.y > ad.y0 - 0.6 && m.y < ad.y1 + 0.6,
    );
    const n = behind ? Math.max(1, Math.round((ad.y1 - ad.y0) / 0.25)) : 1;
    const end = (s: number) => (ad.along === 'x' ? at(s, ad.x) : at(ad.x, s));
    const ends = [end(ad.y0), end(ad.y1)];
    const top = Math.min(ends[0].y, ends[1].y) - AD_HIGH - 2,
      bottom = Math.max(ends[0].y, ends[1].y) + 2;
    for (let i = 0; i < n; i++) {
      const s0 = ad.y0 + ((ad.y1 - ad.y0) * i) / n,
        s1 = ad.y0 + ((ad.y1 - ad.y0) * (i + 1)) / n;
      // Outer pieces reach past the board's ends to keep its outline.
      const xs = [end(s0).x, end(s1).x].sort((p, q) => p - q);
      const rightward = ad.along === 'x';
      if (i === (rightward ? 0 : n - 1)) xs[0] -= 3;
      if (i === (rightward ? n - 1 : 0)) xs[1] += 3;
      add(ad.x + s0, () => {
        const frame = layerFrame(ctx, box);
        const layer =
          frame &&
          cachedLayer(ctx, `ad:${index}`, night, frame, box, (c, dark) => adBoard(c, ad, dark));
        if (!frame || !layer) {
          if (i === 0) adBoard(ctx, ad, night);
          return;
        }
        const s = frame.scale,
          sx = Math.max(0, Math.round((xs[0] - box.left) * s)),
          sw = Math.min(frame.w, Math.round((xs[1] - box.left) * s)) - sx,
          sy = Math.max(0, Math.floor((top - box.top) * s)),
          sh = Math.min(frame.h, Math.ceil((bottom - box.top) * s)) - sy;
        if (sw <= 0 || sh <= 0) return;
        ctx.save();
        ctx.resetTransform();
        ctx.drawImage(layer, sx, sy, sw, sh, frame.x + sx, frame.y + sy, sw, sh);
        ctx.restore();
      });
    }
  });
}

/**
 * Corner masts. The near pair stays short, so a lamp head never hangs over the pitch (a head at
 * (20.8, 28.8) clears the touchline below 52 px) and the four read in perspective.
 */
const MASTS = [
  { x: 10.2, y: 22.2, high: 78 },
  { x: 20.8, y: 22.2, high: 78 },
  { x: 10.2, y: 28.8, high: 36 },
  { x: 20.8, y: 28.8, high: 36 },
];
function mast(ctx: Ctx, m: (typeof MASTS)[number], night: boolean, light: number) {
  const p = at(m.x, m.y),
    high = m.high,
    toward = at(MID.x, MID.y).x > p.x ? 1 : -1;
  rect(ctx, p.x - 3, p.y - 2, 6, 3, pick(P.pad, night));
  rect(ctx, p.x - 1, p.y - high, 2, high - 1, pick(P.steel, night));
  rect(ctx, p.x, p.y - high, 1, high - 1, pick(P.steelDark, night));
  // Access rungs.
  for (let h = 12; h < high - 12; h += 6)
    rect(ctx, p.x - 2, p.y - h, 1, 1, pick(P.steelDark, night));
  const hx = p.x - 7 + toward * 2,
    hy = p.y - high - 8;
  rect(ctx, p.x - 1, hy + 7, 2, 2, pick(P.steelDark, night));
  rect(ctx, hx, hy, 14, 8, pick(P.steelDark, night));
  const lamp = light > 0 ? mixHex('#E9E2C6', '#FFF6D8', light) : pick(P.lampOff, night);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) rect(ctx, hx + 1 + i * 4, hy + 1 + j * 3.5, 4 - 1, 3, lamp);
  if (light > 0) {
    drawGlow(ctx, hx + 7, hy + 4, 18, 0.75 * light);
    drawGlow(ctx, hx + 7, hy + 4, 7, 0.9 * light);
  }
}
/**
 * Floodlights come on for the last match of the day, from 18:30, after a short warm-up, and
 * stay on over the empty pitch while the crowd drifts home: out by 20:08.
 */
export function floodlightLevel(game: FootballState, minutes: number) {
  const m = (((minutes % 1440) + 1440) % 1440) - 1110;
  if (!game.live) return m >= 90 && m < 98 ? Math.min(1, (98 - m) / 6) : 0;
  if (m < 0) return 0;
  const warm = Math.min(1, m / 20);
  const flicker = m < 4 && Math.floor(m * 6) % 3 === 1 ? 0.3 : 1;
  return (0.35 + 0.65 * warm) * flicker;
}
const POOLS = [
  [12.9, 23.9],
  [18.1, 23.9],
  [12.9, 26.1],
  [18.1, 26.1],
] as const;
function floodPools(ctx: Ctx, light: number) {
  if (light <= 0) return;
  POOLS.forEach(([x, y], i) => {
    const p = at(x, y),
      m = MASTS[i],
      head = at(m.x, m.y, m.high + 4);
    // A faint beam from the lamp head, then the warm pool it throws on the grass.
    ctx.globalAlpha = 0.07 * light;
    shape(ctx, [head, { x: p.x - 60, y: p.y }, { x: p.x + 60, y: p.y }], '#FFF1C8');
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(1.25, 0.62);
    drawGlow(ctx, 0, 0, 100, 0.34 * light);
    ctx.restore();
  });
}

function cornerFlag(ctx: Ctx, x: number, y: number, night: boolean, time: number, seed: number) {
  const p = at(x, y);
  oval(ctx, p.x + 1, p.y + 0.5, 2, 0.8, SHADOW);
  rect(ctx, p.x - 0.5, p.y - 16, 1.2, 16, pick(P.pole, night));
  for (let i = 0; i < 3; i++) {
    const wave = Math.round(Math.sin(time * 6.5 + seed - i * 1.2) * i * 0.6);
    rect(ctx, p.x + 0.7 + i * 2, p.y - 16 + wave, 2, 4 - (i === 2 ? 1 : 0), pick(P.flag, night));
    rect(ctx, p.x + 0.7 + i * 2, p.y - 16 + wave + 1.5, 2, 1, pick(P.flagLight, night));
  }
}

const RAIL = { y: 27.62, from: 10.35, to: 20.45, high: 7 };
function railSegment(ctx: Ctx, x0: number, x1: number, night: boolean) {
  const a = at(x0, RAIL.y),
    b = at(x1, RAIL.y);
  rect(ctx, a.x - 0.5, a.y - RAIL.high, 1.2, RAIL.high, pick(P.railShade, night));
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - RAIL.high);
  ctx.lineTo(b.x, b.y - RAIL.high);
  ctx.moveTo(a.x, a.y - 3);
  ctx.lineTo(b.x, b.y - 3);
  ctx.strokeStyle = pick(P.rail, night);
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

const CART = { x0: 19.55, x1: 20.1, y0: 28.38, y1: 28.62, high: 12 };
function cart(ctx: Ctx, night: boolean, live: boolean, time: number) {
  const n = night ? 1 : 0,
    { x0, x1, y0, y1, high } = CART;
  shape(ctx, plate(x0 - 0.05, y0, x1 + 0.08, y1 + 0.08), 'rgba(28,52,36,0.18)');
  shape(ctx, [at(x0, y1), at(x1, y1), at(x1, y1, high), at(x0, y1, high)], P.cart[n]);
  shape(ctx, [at(x1, y1), at(x1, y0), at(x1, y0, high), at(x1, y1, high)], P.cartShade[n]);
  shape(ctx, plate(x0 - 0.03, y0 - 0.03, x1 + 0.03, y1 + 0.03, high), P.cartTop[n]);
  ctx.save();
  ctx.translate(at(x0, y1).x, at(x0, y1).y);
  ctx.transform(1, 0.5, 0, 1, 0, 0);
  const w = at(x1, y1).x - at(x0, y1).x;
  if (live) {
    rect(ctx, 2, -high + 2, w - 4, 5, night ? '#6E6A58' : '#FBF1D6');
    ctx.font = FONT(4.5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9A5B3E';
    ctx.fillText('TEA · PIES', w / 2, -high + 5.8, w - 5);
  } else for (let i = 0; i < 4; i++) rect(ctx, 1, -high + 2 + i * 2.5, w - 2, 1, P.cartShade[n]);
  ctx.restore();
  if (!live && night) {
    // A small lantern left burning on the shuttered cart.
    const lamp = at(x1 - 0.04, y1, high);
    rect(ctx, lamp.x - 0.5, lamp.y - 5, 1, 5, P.steelDark[n]);
    rect(ctx, lamp.x - 1.5, lamp.y - 9, 3, 4, LIGHT.lit);
    rect(ctx, lamp.x - 2, lamp.y - 10, 4, 1, LIGHT.capNight);
    drawGlow(ctx, lamp.x, lamp.y - 7, 16, 0.5);
    drawGlow(ctx, lamp.x, lamp.y - 7, 5, 0.8);
  }
  for (const x of [x0 + 0.12, x1 - 0.08]) {
    const wheel = at(x, y1 + 0.01);
    oval(ctx, wheel.x, wheel.y - 2, 2.6, 2.6, P.wheel[n]);
    oval(ctx, wheel.x, wheel.y - 2, 0.9, 0.9, P.cartTop[n]);
  }
  if (live) {
    // An urn with a curl of steam, cups on the counter.
    const urn = at(x0 + 0.15, (y0 + y1) / 2, high);
    rect(ctx, urn.x - 2, urn.y - 7, 5, 7, '#B8BCB0');
    rect(ctx, urn.x - 2, urn.y - 7, 5, 1, '#DADCD2');
    for (let i = 0; i < 3; i++) {
      const rise = (time * 0.7 + i / 3) % 1;
      ctx.globalAlpha = 0.5 * (1 - rise);
      rect(
        ctx,
        urn.x + Math.round(Math.sin(rise * 6 + i) * 1.5),
        urn.y - 9 - rise * 10,
        2,
        2,
        '#FFFFFF',
      );
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const cup = at(x1 - 0.2 + i * 0.06, y1 - 0.06, high);
      rect(ctx, cup.x - 1, cup.y - 3, 2, 3, i === 1 ? '#DE8D6A' : '#F6F0DE');
    }
    // A striped awning on two poles.
    for (const x of [x0 + 0.02, x1 - 0.02]) {
      const pole = at(x, y1 - 0.02, high);
      rect(ctx, pole.x - 0.5, pole.y - 14, 1, 14, P.steelDark[n]);
    }
    const top = high + 15,
      edge = high + 12;
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      const a = x0 - 0.08 + ((x1 - x0 + 0.16) * i) / stripes,
        b = x0 - 0.08 + ((x1 - x0 + 0.16) * (i + 1)) / stripes;
      const c = i % 2 ? P.awningLight[n] : P.awning[n];
      shape(
        ctx,
        [
          at(a, y0 - 0.04, top),
          at(b, y0 - 0.04, top),
          at(b, y1 + 0.12, edge),
          at(a, y1 + 0.12, edge),
        ],
        c,
      );
      shape(
        ctx,
        [
          at(a, y1 + 0.12, edge),
          at(b, y1 + 0.12, edge),
          at(b, y1 + 0.12, edge - 3),
          at(a, y1 + 0.12, edge - 3),
        ],
        tint(c, -18),
      );
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The crowd, managers and vendor: pure functions of the match state.

function fanFigure(
  ctx: Ctx,
  fan: (typeof FANS)[number],
  i: number,
  game: FootballState,
  time: number,
) {
  const pt = project(fan.x, fan.y);
  const t = game.elapsed + i * 0.37;
  const mine = game.celebration?.team === fan.team,
    theirs = !!game.celebration && !mine;
  const attacking = game.attacking === fan.team;
  let ps: Pose = STAND,
    lift = 0,
    back = true,
    left = false,
    sway = Math.sin(time * 2 + i) * 0.8;
  if (mine || (game.goal && !game.celebration)) {
    const hop = Math.abs(Math.sin(t * 8.5));
    lift = hop * 5;
    ps = cheer(hop);
  } else if (theirs) {
    ps = i % 3 === 1 ? BENT : HEAD_IN_HANDS;
  } else if (game.phase === 'fulltime') {
    const won = game.score[fan.team] > game.score[1 - fan.team];
    ps = won ? clapPose(t) : game.score[0] === game.score[1] ? clapPose(t * 0.6) : FOLDED;
  } else if (game.excitement > 0.55) {
    const lean: Pose = { ...STAND, neck: [1.5, -17], hip: [0.8, -10] };
    ps = attacking
      ? {
          ...lean,
          elbows: [
            [-4, -19],
            [6, -19],
          ],
          hands: [
            [-3.5, -23],
            [6.5, -23],
          ],
          mouth: true,
        }
      : {
          ...lean,
          elbows: [
            [-3, -13],
            [5, -13],
          ],
          hands: [
            [2, -15],
            [4, -15],
          ],
        };
  } else {
    const beat = Math.floor(t / 4.5 + i * 0.71) % 7;
    if (beat === 0) ps = clapPose(t);
    else if (beat === 3 && game.phase !== 'halftime') {
      // Turning to a neighbour for a word.
      back = false;
      left = i % 2 === 0;
    } else if (game.phase === 'halftime') ps = FOLDED;
  }
  let held: ((ctx: Ctx) => void) | undefined;
  const colours = TEAMS[fan.team];
  if (fan.prop === 'flag') {
    const hand = ps.hands[1];
    const wave = (k: number) =>
      Math.round(Math.sin(time * (mine ? 9 : 4) + k * 1.1 + i) * (0.5 + k * 0.35));
    held = (ctx) => {
      const hx = Math.round(hand[0]),
        hy = Math.round(hand[1]);
      rect(ctx, hx, hy - 17, 1, 18, '#8E8466');
      for (let k = 0; k < 4; k++) {
        rect(ctx, hx - 3 - k * 3, hy - 17 + wave(k), 3, 7, colours.color);
        rect(ctx, hx - 3 - k * 3, hy - 14 + wave(k), 3, 1, colours.light);
      }
    };
  } else if (fan.prop === 'scarf' && (mine || game.phase === 'fulltime') && ps.hands[1][1] < -20) {
    held = (ctx) => {
      const [a, b] = ps.hands;
      const x = Math.round(Math.min(a[0], b[0])),
        w = Math.round(Math.abs(b[0] - a[0])) + 2;
      rect(ctx, x, Math.round(a[1]) - 2, w, 2, colours.color);
      for (let k = x + 1; k < x + w; k += 3)
        rect(ctx, k, Math.round(a[1]) - 2, 1, 2, colours.light);
    };
  }
  // A supporter in front of play near the touchline turns see-through.
  ctx.globalAlpha = hidesPlay(game, pt) ? 0.55 : 1;
  drawFigure(ctx, fan.look, ps, { x: pt.x, y: pt.y, back, left, lift }, sway, held, true);
  ctx.globalAlpha = 1;
}
/**
 * A town resident watching from the south strip turns see-through, like the fans, while play
 * near the touchline is behind them on screen. `pt` is their projected ground point.
 */
export const spectatorAlpha = (game: FootballState, pt: Point) =>
  game.live && hidesPlay(game, pt) ? 0.55 : 1;
/** Streetlamps that would stand in front of a goal: the road just behind either end. */
export const lampBlocksGoal = (x: number, y: number) =>
  y > GOAL_MOUTH.top - 1.5 &&
  y < GOAL_MOUTH.bottom + 1.5 &&
  (Math.abs(x - GROUND.right) < 1 || Math.abs(x - GROUND.left) < 1);
/** True when a player or the ball near the south touchline is behind this spot on screen. */
function hidesPlay(game: FootballState, pt: Point) {
  const covers = (x: number, y: number) => y < pt.y && y > pt.y - 36 && Math.abs(x - pt.x) < 13;
  for (const p of game.players) {
    const q = project(p.x, p.y);
    if (p.y > 26.6 && covers(q.x, q.y)) return true;
  }
  const b = game.ball,
    q = project(b.x, b.y);
  return b.y > 26.6 && covers(q.x, q.y - Math.max(0, b.height));
}

/** A manager paces the technical area on the match clock (still at the break), reacting as they go. */
function managerAt(m: (typeof MANAGERS)[number], game: FootballState) {
  const t = game.elapsed,
    y = 22.66;
  const clock = Math.min(t, 60) + Math.max(0, Math.min(t, 128) - 68);
  const swing = Math.sin(clock * 0.42 + m.team * 2.4);
  const x = m.x + Math.max(-1, Math.min(1, swing * 1.7)) * 0.42;
  const playing = game.phase === 'first' || game.phase === 'second';
  const moving = playing && Math.abs(swing * 1.7) < 1;
  const own = game.celebration?.team === m.team,
    other = !!game.celebration && !own;
  let ps: Pose = FOLDED,
    lift = 0,
    facing: Point = { x: 0, y: 1 };
  if (own) {
    const hop = Math.abs(Math.sin(t * 7));
    ps = cheer(hop);
    lift = hop * 4;
  } else if (other) ps = HEAD_IN_HANDS;
  else if (game.phase === 'fulltime')
    ps = game.score[m.team] >= game.score[1 - m.team] ? clapPose(t) : FOLDED;
  else if (playing && game.excitement > 0.5 && game.attacking === m.team) ps = POINT;
  else if (playing && game.excitement > 0.7) ps = SHOUT;
  if (moving && !own) {
    // Walking legs under whatever the arms are doing, so the feet never slide.
    const legs = runPose((x * 1.6) % 1, 0.6);
    ps = { ...ps, hip: legs.hip, feet: legs.feet, knees: legs.knees };
    facing = { x: Math.cos(clock * 0.42 + m.team * 2.4) > 0 ? 1 : -1, y: 0 };
  }
  return { x, y, ps, facing, lift };
}
function managerFigure(ctx: Ctx, m: (typeof MANAGERS)[number], game: FootballState) {
  const { x, y, ps, facing, lift } = managerAt(m, game);
  const pt = project(x, y);
  drawFigure(ctx, m.look, ps, { x: pt.x, y: pt.y, ...view(facing), lift }, 0);
}

function confetti(ctx: Ctx, game: FootballState) {
  const c = game.celebration;
  if (!c) return;
  const age = game.elapsed - c.since;
  if (age < 0 || age > 2.4) return;
  const group = FANS.filter((f) => f.team === c.team);
  const origin = at(group.reduce((s, f) => s + f.x, 0) / group.length, 28.6);
  const colours = [TEAMS[c.team].color, TEAMS[c.team].light, '#FFF8E6'];
  ctx.globalAlpha = age > 1.8 ? (2.4 - age) / 0.6 : 1;
  for (let i = 0; i < 18; i++) {
    const a = ((i * 7919) % 97) / 97,
      b = ((i * 104729) % 89) / 89;
    const x = origin.x + (a - 0.5) * 50 + (a - 0.5) * 30 * age + Math.sin(age * 7 + i) * 2;
    const y = origin.y - 28 - (46 + b * 30) * age + 38 * age * age;
    const flip = Math.sin(age * 12 + i) > 0;
    rect(ctx, x, y, flip ? 2 : 1, flip ? 1 : 2, colours[i % 3]);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------------------------

export function drawFootball(
  ctx: Ctx,
  game: FootballState,
  night: boolean,
  selected: boolean,
  minutes = game.elapsed,
): Layer[] {
  const time = minutes;
  const light = floodlightLevel(game, minutes);
  paintPitch(ctx, night);
  floodPools(ctx, light);
  if (selected) {
    trace(ctx, plate(GROUND.left, GROUND.top, GROUND.right, GROUND.bottom));
    ctx.strokeStyle = '#FFF1B3';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const objects: Layer[] = [];
  const add = (depth: number, paint: () => void) => objects.push({ depth, paint });
  addGoals(add, ctx, game, night);
  addBoards(add, ctx, game, night);
  // Sorted by the back corner: the managers and throw-in takers in front always draw over it.
  for (const d of DUGOUTS) add(d.x0 + DUG.back, () => dugout(ctx, d, night, game.live));
  addScoreboard(add, ctx, () => scoreboard(ctx, game, night, time, light));
  MASTS.forEach((m) => add(m.x + m.y, () => mast(ctx, m, night, light)));
  let seed = 0;
  for (const x of [PITCH.left, PITCH.right])
    for (const y of [PITCH.top, PITCH.bottom]) {
      const s = seed++;
      add(x + y + 0.01, () => cornerFlag(ctx, x, y, night, time, s));
    }
  for (let x = RAIL.from; x < RAIL.to - 0.01; x += 0.5) {
    const x1 = Math.min(RAIL.to, x + 0.5);
    add(x + 0.25 + RAIL.y, () => railSegment(ctx, x, x1, night));
  }
  add(CART.x1 + CART.y1, () => cart(ctx, night, game.live, time));
  if (game.live) {
    add(19.36 + 28.5, () => {
      const p = project(19.36, 28.5);
      drawFigure(
        ctx,
        VENDOR,
        Math.sin(time * 0.9) > 0.7 ? wavePose(time) : FOLDED,
        { x: p.x, y: p.y, back: false, left: false },
        0,
      );
    });
    for (const m of MANAGERS) add(managerAt(m, game).x + 22.66, () => managerFigure(ctx, m, game));
    FANS.forEach((fan, i) => add(fan.x + fan.y, () => fanFigure(ctx, fan, i, game, time)));
    const c = game.celebration;
    if (c) add((c.team ? 18.9 : 12.5) + 28.8, () => confetti(ctx, game));
  }
  const ball = game.ball;
  const holder = ball.held && ball.owner !== null;
  const marker = viewZoom(ctx) < 1.3;
  for (const p of game.players) {
    const side = steadyView(ctx, p.id, p.facing, game.elapsed);
    add(depthOf(p.x, p.y), () => drawFootballPlayer(ctx, p, game.elapsed, ball, side));
    if (marker && p.hasBall && p.action !== 'celebrate')
      add(depthOf(p.x, p.y) + 0.001, () => carrierMarker(ctx, p));
  }
  const referee = game.referee;
  if (referee) {
    const side = steadyView(ctx, -1, referee.facing, game.elapsed);
    add(depthOf(referee.x, referee.y), () =>
      drawFootballReferee(ctx, referee, game.elapsed, ball, side),
    );
  }
  const heldBy = holder
    ? ball.owner === -1
      ? referee
      : game.players.find((p) => p.id === ball.owner)
    : null;
  if (game.live && !heldBy) {
    const depth = depthOf(ball.x, ball.y) + 0.02;
    let shooting = false;
    for (let i = game.events.length - 1; i >= 0 && game.elapsed - game.events[i].at < 1.4; i--)
      if (game.events[i].kind === 'shot') shooting = ball.owner === null;
    add(depth, () => drawFootballBall(ctx, ball, shooting ? 3 : undefined));
    // X-ray: a ball hidden behind a figure is redrawn faintly over the one in front.
    const b = project(ball.x, ball.y),
      by = b.y - 3 - Math.max(0, ball.height);
    let cover = -Infinity;
    for (const f of [...game.players, ...(referee ? [referee] : [])]) {
      const d = depthOf(f.x, f.y);
      if (d <= depth) continue;
      const q = project(f.x, f.y);
      if (Math.abs(q.x - b.x) < 8 && by > q.y - 32 && by < q.y + 2) cover = Math.max(cover, d);
    }
    if (cover > -Infinity) add(cover + 0.002, () => ghostBall(ctx, ball));
  }
  return objects;
}
/** Canvas zoom without the device pixel ratio: how big the town looks right now. */
function viewZoom(ctx: Ctx) {
  const t = ctx.getTransform?.();
  const ratio = typeof window === 'undefined' ? 1 : Math.min(globalThis.devicePixelRatio || 1, 2);
  return t ? Math.hypot(t.a, t.b) / ratio : 1;
}
/** A small team-coloured pip over the ball carrier, for zoomed-out views. */
function carrierMarker(ctx: Ctx, p: FootballPlayer) {
  const pt = project(p.x, p.y),
    colours = TEAMS[p.team];
  const x = Math.round(pt.x),
    y = Math.round(pt.y - 38);
  rect(ctx, x - 3, y - 1, 7, 2, '#1F2C26');
  rect(ctx, x - 2, y + 1, 5, 1, '#1F2C26');
  rect(ctx, x - 1, y + 2, 3, 1, '#1F2C26');
  rect(ctx, x - 2, y, 5, 1, colours.color);
  rect(ctx, x - 1, y + 1, 3, 1, colours.color);
  rect(ctx, x, y + 2, 1, 1, colours.light);
}
