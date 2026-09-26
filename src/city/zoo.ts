import {
  ZOO_GROUND,
  ZOO_HABITATS,
  ZOO_CENTER,
  ZOO_GATE,
  ZOO_VENUE,
  zooAnimalsAt,
  zooPond,
  zooProps,
  zooTree,
  type ZooHabitat,
} from '../lib/zoo';
import { getPlot, project, TILE_W, type Point } from '../lib/world';
import {
  canopyAt,
  groundFraction,
  seedFraction,
  snowAt,
  WINTER,
  type TownSeason,
} from '../lib/seasons';
import { FORK_PLOT } from '../lib/lanterns';
import { tint } from './houses';
import { lampOn } from './lamplight';
import {
  BLOSSOM,
  FALLEN_LEAVES,
  ICE,
  mixHex,
  pick,
  POND,
  REED,
  SNOW,
  type Pair,
} from './season-palette';
import { AUTUMNS, leafTone, LIMB } from './trees';
import { drawVenueTitle } from './venue-title';
import { drawZooAnimal } from './zoo-animals';

type Ctx = CanvasRenderingContext2D;
/** A depth object; `part` tells the animals apart from the grounds for the tests. */
type Object = { depth: number; paint: () => void; part?: 'animal' };
type Visible = (point: Point, rx: number, above: number, below: number) => boolean;
type Rect = { left: number; top: number; width: number; height: number };

// The gate stands where the side path meets the north street: two stone pillars on zoo ground,
// either side of the path, with a timber beam between them and the plaque above it.
const GATE_Y = ZOO_GROUND.top + 0.2;
export const ZOO_GATE_PILLARS: readonly Point[] = [
  { x: ZOO_GROUND.left + 0.1, y: GATE_Y },
  { x: ZOO_GROUND.left + 2.9, y: GATE_Y },
];
export const ZOO_SIGN = {
  point: { x: ZOO_GROUND.left + 1.5, y: GATE_Y },
  width: 150,
  height: 34,
  rise: 80,
};
// Sort at the plaque's near end so a visitor at its foot never paints over the lettering.
export const ZOO_SIGN_DEPTH = ZOO_SIGN.point.x + ZOO_SIGN.point.y + ZOO_SIGN.width / TILE_W;
export function zooSignHit(point: Point) {
  const gate = project(ZOO_SIGN.point.x, ZOO_SIGN.point.y);
  const x = point.x - gate.x;
  const y = point.y - gate.y - x * 0.5;
  return (
    x >= -ZOO_SIGN.width / 2 &&
    x <= ZOO_SIGN.width / 2 &&
    y >= -ZOO_SIGN.rise &&
    y <= -ZOO_SIGN.rise + ZOO_SIGN.height
  );
}
// The ticket kiosk and the paved plaza under the gate, in town tiles. The kiosk stands against
// the east pillar, where nothing tall in the giraffe pen shares its column on screen.
export const ZOO_KIOSK: Rect = {
  left: ZOO_GROUND.left + 3.45,
  top: ZOO_GROUND.top + 0.1,
  width: 0.55,
  height: 0.55,
};
const PLAZA: Rect = { left: ZOO_GROUND.left, top: ZOO_GROUND.top, width: 5.1, height: 0.95 };

/** Each habitat's name board. The animal pens hang a low board on the fence along the
 * promenade: row 0 on its front fence towards the right, row 1 on its back fence towards the
 * left, so the pairs never meet and nothing stands between the visitors and the view. The future
 * pens keep a board on posts in the middle of the meadow. `point` is the board's foot. */
export const ZOO_HABITAT_SIGNS = ZOO_HABITATS.map((h, index) => {
  const front = index < 3;
  const future = !h.animal;
  return {
    id: h.id,
    title: h.name,
    subtitle: future ? 'ROOM TO GROW' : undefined,
    point: future
      ? { x: h.left + h.width / 2, y: h.top + h.height / 2 }
      : { x: h.left + (front ? 4.6 : 2.4), y: front ? h.top + h.height : h.top },
    width: future ? 150 : 124,
    height: future ? 44 : 28,
    rise: future ? 60 : 32,
    fontSize: future ? 14 : 12,
    // Fence boards follow the fence's slope along x; post signs face the viewer.
    slant: future ? 0 : 0.5,
    front,
    future,
  };
});
export type ZooSign = (typeof ZOO_HABITAT_SIGNS)[number];
/** A board's screen rectangle, slope included, for the overlap test. */
export function zooSignRect(sign: {
  point: Point;
  width: number;
  height: number;
  rise: number;
  slant: number;
}) {
  const p = project(sign.point.x, sign.point.y);
  const drop = (sign.width / 2) * sign.slant;
  return {
    left: p.x - sign.width / 2,
    right: p.x + sign.width / 2,
    top: p.y - sign.rise - drop,
    bottom: p.y - sign.rise + sign.height + drop,
  };
}
export const ZOO_GATE_RECT = zooSignRect({ ...ZOO_SIGN, slant: 0.5 });

// ---------------------------------------------------------------------------------------------
// Colours, as [day, night]. Muted, cool at night, and never a light: the only amber in the zoo
// is the gate's two lanterns once the lamps are lit.
const P = {
  grass: ['#A8C18C', '#405F53'],
  path: ['#DDD2AD', '#7D8976'],
  pathEdge: ['#CBBF98', '#6E7A69'],
  flag: ['#CFC39E', '#737F6D'],
  savanna: ['#CEC88F', '#6B7758'],
  tuft: ['#AFA86A', '#5B674D'],
  tuftLight: ['#DAD39E', '#7D8966'],
  trampled: ['#C4B587', '#646B53'],
  stone: ['#A5A08C', '#68706A'],
  stoneLight: ['#C8C3AE', '#848B7F'],
  stoneDark: ['#8A8676', '#575F59'],
  dust: ['#CEC29B', '#6E725A'],
  dustDark: ['#BBAC86', '#61674F'],
  mud: ['#978770', '#4D5449'],
  mudWet: ['#7F7260', '#434B44'],
  beach: ['#CAD6D3', '#7D9695'],
  beachFleck: ['#ACBAB8', '#6A8282'],
  meadow: ['#9DBB7F', '#4D715A'],
  meadowTuft: ['#86A86B', '#42654F'],
  bank: ['#9A9E7B', '#4A5D4F'],
  bankFace: ['#7F8467', '#3E4F46'],
  shallows: ['#A2CAC7', '#5A8A92'],
  water: ['#88B7BD', '#467580'],
  deep: ['#75A6B1', '#3C6977'],
  poolStone: ['#BAC5C2', '#71888A'],
  poolJoint: ['#9DA9A7', '#5D7173'],
  poolWall: ['#5B8C99', '#2F5563'],
  poolWater: ['#7AB6C4', '#437686'],
  poolDeep: ['#5F9DB0', '#365F71'],
  bark: ['#8B795C', '#5A5E50'],
  barkLight: ['#A48F6C', '#6C6F5E'],
  wood: ['#9C8261', '#626152'],
  woodLight: ['#B79D78', '#767462'],
  woodDark: ['#7A6549', '#4F5147'],
  hay: ['#C9B06E', '#76735A'],
  hayLight: ['#D8C489', '#86836A'],
  thatch: ['#B49E6B', '#6B6852'],
  thatchDark: ['#97835A', '#5B5A4A'],
  wall: ['#C3B89E', '#7A7F74'],
  wallShade: ['#A59C85', '#666D65'],
  wallMark: ['#AFA48B', '#6E746A'],
  doorway: ['#3E4541', '#252D2B'],
  roof: ['#7E8A7E', '#4C5A56'],
  roofDark: ['#687469', '#3F4B48'],
  pillar: ['#C7BEA5', '#7F8579'],
  pillarShade: ['#A89E87', '#6A7068'],
  pillarCap: ['#DCD3B8', '#949A8C'],
  glass: ['#B8C4BE', '#6E7E7C'],
  lit: ['#F1D68F', '#F1D68F'],
  awning: ['#6F8F6A', '#4B6556'],
  awningLight: ['#E4DCC0', '#9DA496'],
  flowerPink: ['#E3B7C0', '#9D8894'],
  flowerWhite: ['#F1EEE2', '#B7BCB0'],
  flowerBlue: ['#A9B4D6', '#7780A0'],
  flowerCream: ['#D6CF8E', '#8E8E72'],
  slide: ['#DCE9EA', '#8FA9AE'],
  fence: ['#9A8864', '#647C6D'],
  post: ['#A8916D', '#70816C'],
  postCap: ['#D0C09A', '#A3AF8A'],
} satisfies Record<string, Pair>;
const HALO = '#FFE2A016';

function quad(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  const a = project(x, y),
    b = project(x + w, y),
    c = project(x + w, y + h),
    d = project(x, y + h);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}
function poly(ctx: Ctx, points: readonly Point[], color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
}
function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
const up = (p: Point, rise: number) => ({ x: p.x, y: p.y - rise });
const at = (x: number, y: number) => {
  const p = project(x, y);
  return { x: Math.round(p.x), y: Math.round(p.y) };
};
/** A rounded pond footprint: the rectangle with its corners cut, as screen points. */
function pondOutline(r: Rect, grow: number, cut: number) {
  const l = r.left - grow,
    t = r.top - grow,
    ri = r.left + r.width + grow,
    b = r.top + r.height + grow;
  const c = Math.max(0, Math.min(cut, (ri - l) / 2, (b - t) / 2));
  return [
    [l + c, t],
    [ri - c, t],
    [ri, t + c],
    [ri, b - c],
    [ri - c, b],
    [l + c, b],
    [l, b - c],
    [l, t + c],
  ].map(([x, y]) => project(x, y));
}
// Every object's snow keeps its own day, like the town's roofs.
const seeds = new Map<string, number>();
const seedOf = (key: string) => seeds.get(key) ?? seeds.set(key, seedFraction(key)).get(key)!;
/** A natural outline for water, mud, ice and snow: a rounded blob filling the footprint, its edge
 * wobbling by a seeded amount, as screen points. It starts at the left corner on screen and runs
 * over the top first, so the first half of the points is the far edge. Cached: the ground is the
 * same on every frame. */
const BLOB_POINTS = 16;
const blobs = new Map<string, Point[]>();
function blob(
  r: Rect,
  grow: number,
  seed: number,
  wobble = 0.16,
  dx = 0,
  dy = 0,
  count = BLOB_POINTS,
): Point[] {
  const key = `${r.left},${r.top},${r.width},${r.height},${grow},${seed},${wobble},${dx},${dy},${count}`;
  const cached = blobs.get(key);
  if (cached) return cached;
  const cx = r.left + r.width / 2 + dx,
    cy = r.top + r.height / 2 + dy;
  const rx = Math.max(0.03, r.width / 2 + grow),
    ry = Math.max(0.03, r.height / 2 + grow);
  const points: Point[] = [];
  for (let k = 0; k < count; k++) {
    const a = 0.75 * Math.PI + (k / count) * 2 * Math.PI;
    const c = Math.cos(a),
      s = Math.sin(a);
    // Squarer than an ellipse, so the water fills its footprint; one broad bulge and a ripple.
    const edge =
      1 + wobble * (0.6 * Math.sin(2 * a + seed * 6.28) + 0.4 * Math.sin(3 * a + seed * 17.3));
    points.push(
      project(
        cx + Math.sign(c) * Math.abs(c) ** 0.75 * rx * edge,
        cy + Math.sign(s) * Math.abs(s) ** 0.75 * ry * edge,
      ),
    );
  }
  blobs.set(key, points);
  return points;
}
const snowOn = (season: TownSeason | undefined, key: string) =>
  season ? snowAt(season.yearDay, seedOf(key)) : 0;

// ---------------------------------------------------------------------------------------------
// Ground texture, placed once: tufts, stones, dust and flowers at seeded spots, clear of the
// solid props and the water, the same on every frame.
type Mark = { x: number; y: number; tone: number; size: number };
type Patch = { x: number; y: number; w: number; h: number };
type Texture = { marks: Mark[]; snow: Patch[]; worn: Rect[] };
const clearOf = (h: ZooHabitat, x: number, y: number, pad: number) =>
  zooProps(h).every(
    (p) =>
      p.kind === 'floe' ||
      x < p.left - pad ||
      x > p.left + p.width + pad ||
      y < p.top - pad ||
      y > p.top + p.height + pad,
  );
function textureFor(h: ZooHabitat, index: number): Texture {
  const seed = 7919 * (index + 1);
  const count = h.animal === 'penguin' ? 40 : h.animal === 'elephant' ? 70 : h.animal ? 96 : 84;
  const marks: Mark[] = [];
  for (let k = 0; marks.length < count && k < count * 4; k++) {
    const u = 0.2 + groundFraction(seed, k) * (h.width - 0.4),
      v = 0.2 + groundFraction(seed, k + 1000) * (h.height - 0.4);
    const x = h.left + u,
      y = h.top + v;
    if (!clearOf(h, x, y, 0.2)) continue;
    // The future pens keep their middle clear for the board.
    if (!h.animal && Math.abs(u - h.width / 2) < 1.3 && Math.abs(v - h.height / 2) < 0.7) continue;
    const p = at(x, y);
    marks.push({
      ...p,
      tone: groundFraction(seed, k + 2000),
      size: groundFraction(seed, k + 3000),
    });
  }
  // Drifts lie long and thin, along the x lines like the wind-blown town snow.
  const snow = Array.from({ length: h.animal === 'penguin' ? 8 : 6 }, (_, k) => {
    const w = 0.35 + groundFraction(seed, k + 4000) * 0.4,
      d = 0.16 + groundFraction(seed, k + 5000) * 0.16;
    return {
      x: h.left + 0.15 + groundFraction(seed, k + 6000) * (h.width - w - 0.3),
      y: h.top + 0.15 + groundFraction(seed, k + 7000) * (h.height - d - 0.3),
      w,
      h: d,
    };
  }).filter((s) => clearOf(h, s.x + s.w / 2, s.y + s.h / 2, 0.3));
  // Patches of bare, trodden ground where the animals stand about.
  const worn: Rect[] = [];
  for (let k = 0; h.animal && h.animal !== 'penguin' && worn.length < 4 && k < 40; k++) {
    const w = 0.45 + groundFraction(seed, k + 8000) * 0.45,
      d = 0.3 + groundFraction(seed, k + 8500) * 0.3;
    const x = h.left + 0.3 + groundFraction(seed, k + 9000) * (h.width - w - 0.6),
      y = h.top + 0.3 + groundFraction(seed, k + 9500) * (h.height - d - 0.6);
    if (clearOf(h, x + w / 2, y + d / 2, Math.max(w, d) / 2 + 0.1))
      worn.push({ left: x, top: y, width: w, height: d });
  }
  return { marks, snow, worn };
}
const TEXTURES = ZOO_HABITATS.map(textureFor);
// Snow lying on the open zoo lawn and at the path edges, once the town's ground has turned.
const LAWN_SNOW = Array.from({ length: 26 }, (_, k) => {
  const x =
      ZOO_GROUND.left + 0.1 + groundFraction(4243, k) * (ZOO_GROUND.right - ZOO_GROUND.left - 0.6),
    y =
      ZOO_GROUND.top +
      0.1 +
      groundFraction(4243, k + 50) * (ZOO_GROUND.bottom - ZOO_GROUND.top - 0.5);
  return {
    x,
    y,
    w: 0.3 + groundFraction(4243, k + 100) * 0.4,
    h: 0.14 + groundFraction(4243, k + 150) * 0.16,
  };
}).filter(
  (s) =>
    !ZOO_HABITATS.some(
      (h) =>
        s.x + s.w > h.left - 0.1 &&
        s.x < h.left + h.width + 0.1 &&
        s.y + s.h > h.top - 0.1 &&
        s.y < h.top + h.height + 0.1,
    ),
);

const FLOWER_CLUMP = [
  [0, 0],
  [4, -2],
  [3, 3],
];
/** A thin patch of lying snow, see-through enough to let the ground show, with a shaded near
 * edge. */
function drift(
  ctx: Ctx,
  s: { x: number; y: number; w: number; h: number },
  colour: string,
  shade: string,
) {
  const alpha = ctx.globalAlpha,
    seed = (s.x * 7.31 + s.y * 3.17) % 1,
    main = { left: s.x, top: s.y, width: s.w, height: s.h };
  ctx.globalAlpha = alpha * 0.7;
  poly(ctx, blob(main, 0, seed, 0.3, 0.03, 0.04, 10), shade);
  poly(ctx, blob(main, -0.02, seed, 0.3, 0, 0, 10), colour);
  ctx.globalAlpha = alpha;
}
// The zebras' racetrack: the loop their zoomies follow (src/lib/zoo.ts), worn into the grass.
export const ZOO_ZOOMIES_TRACK = { rx: 1.8, ry: 1.45, width: 0.13 };
const ovals = new Map<string, Point[]>();
function oval(cx: number, cy: number, rx: number, ry: number) {
  const key = `${cx},${cy},${rx},${ry}`;
  const cached = ovals.get(key);
  if (cached) return cached;
  const points = Array.from({ length: 28 }, (_, k) => {
    const a = (k / 28) * Math.PI * 2;
    return project(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  });
  ovals.set(key, points);
  return points;
}
/** Bare, trodden ground under the texture: a few worn patches, and the zebras' track. */
function paintWear(ctx: Ctx, h: ZooHabitat, texture: Texture, night: boolean, ground: string) {
  const worn = pick(h.animal === 'elephant' ? P.dustDark : P.trampled, night);
  if (h.animal === 'zebra') {
    const cx = h.left + h.width / 2,
      cy = h.top + h.height / 2,
      { rx, ry, width } = ZOO_ZOOMIES_TRACK;
    poly(ctx, oval(cx, cy, rx + width, ry + width), worn);
    poly(ctx, oval(cx, cy, rx - width, ry - width), ground);
  }
  for (const [k, r] of texture.worn.entries())
    poly(ctx, blob(r, 0, (k * 0.37 + h.left * 0.11) % 1, 0.3, 0, 0, 12), worn);
}
function paintTexture(ctx: Ctx, h: ZooHabitat, texture: Texture, night: boolean, snowy: boolean) {
  const { marks } = texture;
  const frost = pick(SNOW.frost, night);
  if (h.animal === 'giraffe' || h.animal === 'zebra') {
    // Dry-grass clumps: a low tussock with two taller blades, a pale tip on some; a few stones.
    ctx.fillStyle = snowy ? frost : pick(P.tuft, night);
    for (const m of marks)
      if (m.tone < 0.82) {
        const tall = m.size > 0.5 ? 1 : 0;
        ctx.fillRect(m.x - 2, m.y - 2, 5, 2);
        ctx.fillRect(m.x - 1, m.y - 4 - tall, 1, 3 + tall);
        ctx.fillRect(m.x + 1, m.y - 5 + tall, 1, 4 - tall);
      }
    ctx.fillStyle = snowy ? pick(SNOW.top, night) : pick(P.tuftLight, night);
    for (const m of marks)
      if (m.tone < 0.35) ctx.fillRect(m.x + 1, m.y - 5 + (m.size > 0.5 ? 1 : 0), 1, 1);
    for (const m of marks)
      if (m.tone >= 0.82) {
        const w = m.size > 0.6 ? 5 : 3;
        box(ctx, m.x - 1, m.y - 1, w, 2, pick(P.stoneDark, night));
        box(ctx, m.x - 1, m.y - 2, w - 1, 1, pick(snowy ? SNOW.top : P.stoneLight, night));
      }
  } else if (h.animal === 'elephant') {
    ctx.fillStyle = pick(P.dustDark, night);
    for (const m of marks) if (m.tone < 0.6) ctx.fillRect(m.x, m.y, m.size > 0.5 ? 3 : 2, 1);
    // Round footprints in the dust.
    ctx.fillStyle = pick(P.mud, night);
    for (const m of marks)
      if (m.tone >= 0.6 && m.tone < 0.8) {
        ctx.fillRect(m.x, m.y, 3, 2);
        ctx.fillRect(m.x + 5, m.y + 2, 3, 2);
      }
    ctx.fillStyle = snowy ? frost : pick(P.tuft, night);
    for (const m of marks) if (m.tone >= 0.8) ctx.fillRect(m.x, m.y - 3, 1, 3);
  } else if (h.animal === 'penguin') {
    ctx.fillStyle = pick(P.beachFleck, night);
    for (const m of marks) if (m.tone < 0.7) ctx.fillRect(m.x, m.y, m.size > 0.5 ? 3 : 2, 1);
    for (const m of marks)
      if (m.tone >= 0.7) {
        box(ctx, m.x - 1, m.y - 1, 4, 2, pick(P.stone, night));
        box(ctx, m.x - 1, m.y - 2, 3, 1, pick(P.stoneLight, night));
      }
  } else {
    // A young meadow: grass tufts and small flowers in drifts.
    ctx.fillStyle = snowy ? frost : pick(P.meadowTuft, night);
    for (const m of marks)
      if (m.tone < 0.55) {
        ctx.fillRect(m.x - 1, m.y - 2, 1, 2);
        ctx.fillRect(m.x + 1, m.y - 3, 1, 3);
      }
    if (!snowy) {
      // Each flower mark is a little clump: three stems, three heads of one colour.
      for (const m of marks)
        if (m.tone >= 0.55)
          for (const [dx, dy] of FLOWER_CLUMP) ctx.fillRect(m.x + dx, m.y + dy - 3, 1, 3);
      const flowers = [P.flowerPink, P.flowerWhite, P.flowerBlue, P.flowerCream];
      for (let f = 0; f < flowers.length; f++) {
        ctx.fillStyle = pick(flowers[f], night);
        for (const m of marks)
          if (m.tone >= 0.55 && Math.floor(m.size * 4) === f)
            for (const [dx, dy] of FLOWER_CLUMP) ctx.fillRect(m.x + dx - 1, m.y + dy - 5, 2, 2);
      }
    }
  }
}

// Wet puddles [u, v, width, depth] and footprints [u, v] in the wallow, in its own tiles.
const WALLOW_PUDDLES = [
  [0.2, 0.3, 0.5, 0.3],
  [0.85, 0.5, 0.42, 0.28],
  [0.45, 0.72, 0.32, 0.2],
];
const WALLOW_PRINTS = [
  [0.12, 0.18],
  [0.3, 0.92],
  [1.12, 0.28],
  [1.3, 0.82],
  [0.62, 0.12],
  [0.95, 0.98],
  [0.1, 0.62],
];

/** Water with a bank: trampled ground, the damp rim, lighter shallows, the deep middle, a lip
 * of shadow under the far bank, and a couple of cool glints. In deep winter it skins over. */
function paintPond(
  ctx: Ctx,
  h: ZooHabitat,
  pond: Rect,
  night: boolean,
  minutes: number,
  iced: boolean,
) {
  // Each pond has its own shape; the deeper water lies towards the far bank.
  const seed = seedOf(`zoo-pond:${h.id}`);
  if (h.animal === 'elephant') {
    // The mud wallow beside the watering hole, where the drinking elephant stands: a churned
    // blob of mud with wet puddles and footprints, not a basin.
    const wallow = { left: pond.left - 1.25, top: pond.top + 0.3, width: 1.5, height: 1.05 };
    poly(ctx, blob(wallow, 0.14, seed, 0.22), pick(P.dustDark, night));
    poly(ctx, blob(wallow, -0.04, 1 - seed, 0.24, 0.05, 0.02), pick(P.mud, night));
    for (const [u, v, w, d] of WALLOW_PUDDLES)
      poly(
        ctx,
        blob(
          { left: wallow.left + u, top: wallow.top + v, width: w, height: d },
          0,
          (seed + u) % 1,
          0.3,
          0,
          0,
          10,
        ),
        pick(P.mudWet, night),
      );
    ctx.fillStyle = pick(P.mudWet, night);
    for (const [u, v] of WALLOW_PRINTS) {
      const p = at(wallow.left + u, wallow.top + v);
      ctx.fillRect(p.x, p.y, 3, 1);
    }
  } else {
    // Ground worn bare on the side the animals come down to drink.
    poly(ctx, blob(pond, 0.4, 1 - seed, 0.22, -0.12, -0.04), pick(P.trampled, night));
  }
  poly(ctx, blob(pond, 0.14, seed), pick(P.bank, night));
  const water = blob(pond, 0, seed);
  poly(ctx, water, pick(iced ? ICE.sheet : P.shallows, night));
  if (!iced) poly(ctx, blob(pond, -0.15, seed, 0.2, -0.05, -0.05), pick(P.water, night));
  if (!iced && pond.width > 1.4)
    poly(ctx, blob(pond, -0.36, seed, 0.24, -0.12, -0.1), pick(P.deep, night));
  // The far bank's face, a lip of shade inside the rim.
  const far = water.slice(0, BLOB_POINTS / 2 + 1);
  poly(ctx, [...far, ...far.map((p) => up(p, -2)).reverse()], pick(P.bankFace, night));
  const c = project(pond.left + pond.width / 2, pond.top + pond.height / 2);
  if (iced) {
    box(ctx, Math.round(c.x) - 9, Math.round(c.y) - 1, 7, 1, pick(ICE.crack, night));
    box(ctx, Math.round(c.x) - 2, Math.round(c.y), 8, 1, pick(ICE.crack, night));
    box(ctx, Math.round(c.x) - 2, Math.round(c.y) - 1, 8, 1, pick(ICE.crackLight, night));
    return;
  }
  // Two glints that come and go every few seconds.
  const beat = Math.floor(minutes / 3);
  for (let i = 0; i < 2; i++) {
    if (groundFraction(beat + i * 101, h.left * 10) < 0.35) continue;
    const dx = (groundFraction(beat, i + 3) - 0.5) * pond.width * 30,
      dy = (groundFraction(beat, i + 7) - 0.5) * pond.height * 12;
    box(ctx, Math.round(c.x + dx), Math.round(c.y + dy), 4, 1, pick(POND.glint, night));
  }
}

/** The penguins' pool: a stone kerb, a deeper blue that never freezes, the island's ring. */
function paintPool(ctx: Ctx, h: ZooHabitat, pool: Rect, night: boolean, minutes: number) {
  quad(
    ctx,
    pool.left - 0.2,
    pool.top - 0.2,
    pool.width + 0.4,
    pool.height + 0.4,
    pick(P.poolStone, night),
  );
  quad(ctx, pool.left, pool.top, pool.width, pool.height, pick(P.poolWater, night));
  quad(
    ctx,
    pool.left + 0.45,
    pool.top + 0.4,
    pool.width - 0.9,
    pool.height - 0.8,
    pick(P.poolDeep, night),
  );
  // The far walls, in shadow below the kerb.
  const a = project(pool.left, pool.top + pool.height),
    b = project(pool.left, pool.top),
    c = project(pool.left + pool.width, pool.top);
  poly(ctx, [a, b, c, up(c, -5), up(b, -5), up(a, -5)], pick(P.poolWall, night));
  // Kerb joints along the near sides.
  ctx.fillStyle = pick(P.poolJoint, night);
  for (let i = 1; i < pool.width / 0.5; i++) {
    const p = at(pool.left + i * 0.5, pool.top + pool.height + 0.1);
    ctx.fillRect(p.x, p.y - 2, 1, 4);
  }
  for (let i = 1; i < pool.height / 0.5; i++) {
    const p = at(pool.left + pool.width + 0.1, pool.top + i * 0.5);
    ctx.fillRect(p.x, p.y - 2, 1, 4);
  }
  const island = zooProps(h).find((p) => p.kind === 'island');
  if (island) poly(ctx, blob(island, 0.14, 0.3, 0.2, 0, 0, 12), pick(P.shallows, night));
  const beat = Math.floor(minutes / 2);
  for (let i = 0; i < 3; i++) {
    if (groundFraction(beat + i * 57, 5) < 0.3) continue;
    const p = at(
      pool.left + 0.5 + groundFraction(beat, i + 11) * (pool.width - 1),
      pool.top + 0.4 + groundFraction(beat, i + 17) * (pool.height - 0.8),
    );
    box(ctx, p.x, p.y, 5, 1, pick(POND.glint, night));
  }
}
/** A flat patch of old ice on the beach, level with the ground: a shaded rim, a pale sheet and
 * a glint. */
function paintFloe(ctx: Ctx, f: Rect, night: boolean) {
  const seed = (f.left * 3.7 + f.top * 1.3) % 1;
  poly(ctx, blob(f, 0.03, seed, 0.26, 0.03, 0.03, 12), pick(SNOW.shade, night));
  poly(ctx, blob(f, -0.02, seed, 0.26, 0, 0, 12), pick(P.slide, night));
  poly(ctx, blob(f, -0.12, 1 - seed, 0.3, -0.05, -0.03, 10), pick(SNOW.top, night));
  const p = at(f.left + f.width * 0.55, f.top + f.height * 0.45);
  box(ctx, p.x, p.y, 4, 1, pick(ICE.crackLight, night));
}

// ---------------------------------------------------------------------------------------------
// Upright art. Each painter draws at its ground point; the caller sorts them with the animals.

function fence(ctx: Ctx, from: Point, to: Point, night: boolean, snowy: boolean) {
  const count = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 0.65);
  const a = project(from.x, from.y),
    b = project(to.x, to.y);
  ctx.strokeStyle = pick(P.fence, night);
  ctx.lineWidth = 2;
  for (const rise of [7, 17]) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - rise);
    ctx.lineTo(b.x, b.y - rise);
    ctx.stroke();
  }
  // The post at the segment's start belongs to the segment before it (a pen's fence is a loop).
  for (let i = 1; i <= count; i++) {
    const p = project(
      from.x + ((to.x - from.x) * i) / count,
      from.y + ((to.y - from.y) * i) / count,
    );
    box(ctx, p.x - 2, p.y - 22, 4, 23, pick(P.post, night));
    box(ctx, p.x - 2, p.y - 23, 4, 3, pick(snowy ? SNOW.top : P.postCap, night));
  }
}

// Blossom clumps on a flowering zoo tree, [x, y, pink]: the top first, then the lower leaves.
const ZOO_BUDS = [
  [-9, -55, 0],
  [-15, -46, 1],
  [4, -53, 1],
  [-4, -42, 0],
  [11, -45, 1],
];
/** The zoo's broadleaf trees keep the town's year: blossom, turn, fall bare, take snow. */
function treeColours(key: string, night: boolean, season: TownSeason | undefined) {
  const seed = seedOf(key);
  const c = season && canopyAt(season.yearDay, seed, seed < 0.5 ? 'blossom' : 'deciduous');
  let leaves = night ? '#4B7362' : '#6F965A',
    crown = night ? '#63876B' : '#91AC68',
    light = night ? '#76936D' : '#B0BF7F';
  if (c) {
    const autumn = AUTUMNS[Math.floor(seed * 30) % 3];
    leaves = leafTone(leaves, 'leaf', night, autumn, c);
    crown = leafTone(crown, 'light', night, autumn, c);
    // The sunlit patch stays a step brighter than the crown once it has turned or gone bare.
    light = mixHex(
      leafTone(light, 'light', night, autumn, c),
      tint(crown, 14),
      Math.max(c.turn, c.dormant),
    );
  }
  return { c, leaves, crown, light };
}
function tree(ctx: Ctx, point: Point, night: boolean, season?: TownSeason) {
  const p = at(point.x, point.y);
  const { c, leaves, crown, light } = treeColours(`zoo-tree:${point.x},${point.y}`, night, season);
  // Fallen leaves settle by the trunk.
  if (c && c.leaves > 0.3) {
    box(ctx, p.x - 11, p.y + 1, 2, 1, pick(FALLEN_LEAVES[0], night));
    box(ctx, p.x + 7, p.y + 3, 2, 1, pick(FALLEN_LEAVES[1], night));
  }
  box(ctx, p.x - 3, p.y - 38, 6, 38, pick(P.bark, night));
  box(ctx, p.x - 3, p.y - 38, 2, 38, pick(P.barkLight, night));
  // Bare like the town's trees: the limbs show through a thinned crown.
  const bare = c ? c.dormant : 0,
    alpha = ctx.globalAlpha;
  if (bare > 0) {
    const limb = pick(LIMB, night);
    box(ctx, p.x - 1, p.y - 52, 2, 16, limb);
    box(ctx, p.x - 9, p.y - 48, 8, 2, limb);
    box(ctx, p.x - 11, p.y - 55, 2, 7, limb);
    box(ctx, p.x + 1, p.y - 51, 8, 2, limb);
    box(ctx, p.x + 8, p.y - 57, 2, 6, limb);
    ctx.globalAlpha = alpha * (1 - 0.45 * bare);
  }
  box(ctx, p.x - 17, p.y - 49, 34, 16, leaves);
  box(ctx, p.x - 12, p.y - 58, 24, 15, crown);
  box(ctx, p.x - 13, p.y - 57, 18, 5, light);
  box(ctx, p.x - 17, p.y - 35, 34, 2, tint(leaves, -12));
  ctx.globalAlpha = alpha;
  if (c && c.blossom > 0) {
    // A few clumps of blossom open along the lit edges.
    for (const [bx, by, k] of ZOO_BUDS.slice(0, Math.round(c.blossom * ZOO_BUDS.length)))
      box(ctx, p.x + bx, p.y + by, 2, 2, pick(k ? BLOSSOM.pink : BLOSSOM.white, night));
  }
  if (c && c.snow > 0) {
    // A line of snow along the top, and on the ledges where the lower leaves stick out.
    ctx.globalAlpha = alpha * c.snow;
    box(ctx, p.x - 12, p.y - 58, 24, 2, pick(SNOW.top, night));
    box(ctx, p.x - 17, p.y - 49, 5, 2, pick(SNOW.top, night));
    box(ctx, p.x + 12, p.y - 49, 5, 2, pick(SNOW.shade, night));
    ctx.globalAlpha = alpha;
  }
}
/** A young tree in a future pen: a thin trunk tied to its stake, a small crown. */
function sapling(ctx: Ctx, point: Point, night: boolean, season?: TownSeason) {
  const p = at(point.x, point.y);
  const { c, leaves, crown, light } = treeColours(`zoo-young:${point.x},${point.y}`, night, season);
  poly(
    ctx,
    pondOutline({ left: point.x - 0.15, top: point.y - 0.15, width: 0.3, height: 0.3 }, 0, 0.12),
    pick(P.mud, night),
  );
  box(ctx, p.x + 3, p.y - 26, 2, 27, pick(P.woodLight, night));
  box(ctx, p.x - 1, p.y - 24, 2, 24, pick(P.bark, night));
  box(ctx, p.x - 1, p.y - 14, 6, 1, pick(P.woodDark, night));
  const alpha = ctx.globalAlpha;
  if (c && c.dormant > 0) {
    // Bare twigs show through what is left of the crown, like the town's young trees.
    const limb = pick(LIMB, night);
    box(ctx, p.x - 1, p.y - 36, 2, 12, limb);
    box(ctx, p.x - 6, p.y - 31, 5, 1, limb);
    box(ctx, p.x - 7, p.y - 35, 1, 4, limb);
    box(ctx, p.x + 1, p.y - 33, 5, 1, limb);
    box(ctx, p.x + 5, p.y - 37, 1, 4, limb);
    ctx.globalAlpha = alpha * (1 - 0.72 * c.dormant);
  }
  box(ctx, p.x - 8, p.y - 33, 16, 9, leaves);
  box(ctx, p.x - 10, p.y - 30, 20, 5, leaves);
  box(ctx, p.x - 6, p.y - 38, 12, 6, crown);
  box(ctx, p.x - 8, p.y - 35, 5, 3, crown);
  box(ctx, p.x - 5, p.y - 37, 6, 2, light);
  box(ctx, p.x - 9, p.y - 25, 18, 1, tint(leaves, -12));
  ctx.globalAlpha = alpha;
  if (c && c.blossom > 0.5) {
    box(ctx, p.x - 4, p.y - 37, 2, 2, pick(BLOSSOM.pink, night));
    box(ctx, p.x + 4, p.y - 31, 2, 2, pick(BLOSSOM.white, night));
  }
  if (c && c.snow > 0) {
    ctx.globalAlpha = alpha * c.snow;
    box(ctx, p.x - 6, p.y - 39, 12, 2, pick(SNOW.top, night));
    box(ctx, p.x - 9, p.y - 34, 3, 1, pick(SNOW.top, night));
    ctx.globalAlpha = alpha;
  }
}
/** The giraffes' acacia: a flat umbrella crown on a forked trunk. It stays green all year and
 * only takes the snow. */
function acacia(ctx: Ctx, point: Point, night: boolean, season?: TownSeason) {
  const p = at(point.x, point.y);
  const c =
    season && canopyAt(season.yearDay, seedOf(`zoo-acacia:${point.x},${point.y}`), 'evergreen');
  const bark = pick(P.bark, night),
    barkLight = pick(P.barkLight, night);
  box(ctx, p.x - 3, p.y - 40, 6, 40, bark);
  box(ctx, p.x - 3, p.y - 40, 2, 40, barkLight);
  // The trunk forks into two limbs that climb outwards in steps.
  for (const [x, y, w, hgt] of [
    [-6, -47, 4, 8],
    [-10, -54, 4, 8],
    [-14, -60, 4, 7],
    [2, -46, 4, 7],
    [5, -52, 4, 7],
    [9, -59, 4, 8],
  ])
    box(ctx, p.x + x, p.y + y, w, hgt, bark);
  box(ctx, p.x - 12, p.y - 57, 2, 3, barkLight);
  const leaves = night ? '#4B7362' : '#6F965A',
    crown = night ? '#5E8468' : '#86A563',
    light = night ? '#70906C' : '#A5BB77';
  box(ctx, p.x - 34, p.y - 64, 68, 6, leaves);
  box(ctx, p.x - 30, p.y - 69, 60, 6, crown);
  box(ctx, p.x - 22, p.y - 72, 42, 4, crown);
  box(ctx, p.x - 18, p.y - 72, 22, 3, light);
  box(ctx, p.x - 28, p.y - 68, 14, 2, light);
  box(ctx, p.x - 33, p.y - 59, 66, 2, tint(leaves, -14));
  if (c && c.snow > 0) {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * c.snow;
    box(ctx, p.x - 22, p.y - 72, 42, 2, pick(SNOW.top, night));
    box(ctx, p.x - 30, p.y - 69, 8, 2, pick(SNOW.top, night));
    box(ctx, p.x + 20, p.y - 69, 10, 2, pick(SNOW.shade, night));
    box(ctx, p.x - 34, p.y - 64, 4, 1, pick(SNOW.top, night));
    ctx.globalAlpha = alpha;
  }
}
/** A tall pole with a hay basket at giraffe height. */
function feeder(ctx: Ctx, f: Rect, night: boolean, snow: number) {
  const p = at(f.left + f.width / 2, f.top + f.height / 2);
  box(ctx, p.x - 6, p.y - 7, 2, 7, pick(P.woodDark, night));
  box(ctx, p.x + 4, p.y - 7, 2, 7, pick(P.woodDark, night));
  box(ctx, p.x - 2, p.y - 60, 4, 60, pick(P.wood, night));
  box(ctx, p.x - 2, p.y - 60, 1, 60, pick(P.woodLight, night));
  // The basket: hay heaped over a slatted frame, a few stalks hanging below.
  const hay = mixHex(pick(P.hay, night), pick(SNOW.top, night), snow);
  box(ctx, p.x - 11, p.y - 72, 22, 6, hay);
  box(ctx, p.x - 8, p.y - 75, 15, 3, mixHex(pick(P.hayLight, night), pick(SNOW.top, night), snow));
  box(ctx, p.x - 10, p.y - 67, 20, 9, pick(P.woodDark, night));
  ctx.fillStyle = pick(P.hay, night);
  for (let i = 0; i < 5; i++) ctx.fillRect(p.x - 8 + i * 4, p.y - 66, 2, 7);
  box(ctx, p.x - 10, p.y - 59, 20, 2, pick(P.wood, night));
  box(ctx, p.x - 6, p.y - 57, 1, 3, pick(P.hay, night));
  box(ctx, p.x + 5, p.y - 57, 1, 2, pick(P.hay, night));
}
/** The elephant house: stone walls, timber corners, a slate roof and a big arched doorway. */
function elephantHouse(ctx: Ctx, f: Rect, night: boolean, snow: number) {
  const H = 32,
    R = 15;
  const L = f.left,
    T = f.top,
    Ri = f.left + f.width,
    B = f.top + f.height;
  const right = project(Ri, T),
    front = project(Ri, B),
    left = project(L, B);
  poly(ctx, [left, front, up(front, H), up(left, H)], pick(P.wall, night));
  poly(ctx, [front, right, up(right, H), up(front, H)], pick(P.wallShade, night));
  // Stone courses on the long wall.
  ctx.fillStyle = pick(P.wallMark, night);
  for (let i = 0; i < 9; i++) {
    const q = 0.08 + ((i * 0.37) % 0.84),
      rise = 6 + (i % 3) * 9;
    const s = project(L + f.width * q, B);
    ctx.fillRect(Math.round(s.x), Math.round(s.y - rise), 5, 2);
  }
  // Gable end, then the roof.
  const apex = up(project(Ri, T + f.height / 2), H + R);
  poly(ctx, [up(front, H), up(right, H), apex], pick(P.wallShade, night));
  const roof = mixHex(pick(P.roof, night), pick(SNOW.top, night), snow * 0.9);
  const ridgeL = up(project(L - 0.12, T + f.height / 2), H + R),
    ridgeR = up(project(Ri + 0.12, T + f.height / 2), H + R);
  poly(
    ctx,
    [ridgeL, ridgeR, up(project(Ri + 0.12, T - 0.1), H - 2), up(project(L - 0.12, T - 0.1), H - 2)],
    pick(P.roofDark, night),
  );
  poly(
    ctx,
    [
      ridgeL,
      ridgeR,
      up(project(Ri + 0.12, B + 0.14), H - 3),
      up(project(L - 0.12, B + 0.14), H - 3),
    ],
    roof,
  );
  poly(
    ctx,
    [
      up(project(L - 0.12, B + 0.14), H - 3),
      up(project(Ri + 0.12, B + 0.14), H - 3),
      up(project(Ri + 0.12, B + 0.14), H - 6),
      up(project(L - 0.12, B + 0.14), H - 6),
    ],
    pick(P.woodDark, night),
  );
  // Timber corner posts.
  for (const s of [left, front, right])
    box(ctx, Math.round(s.x) - 2, Math.round(s.y - H + 2), 3, H - 2, pick(P.woodDark, night));
  // The big arched doorway, dark inside, with straw on the floor.
  const door = (grow: number) => {
    const points: Point[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const s = project(
        L + f.width * (0.5 - 0.23 - grow / 38) + f.width * (0.46 + (2 * grow) / 38) * (1 - t),
        B,
      );
      points.push(up(s, 17 + grow + 8 * Math.sin(t * Math.PI)));
    }
    const a = project(L + f.width * (0.27 - grow / 38), B),
      b = project(L + f.width * (0.73 + grow / 38), B);
    return [a, b, ...points];
  };
  poly(ctx, door(3), pick(P.wallShade, night));
  poly(ctx, door(0), pick(P.doorway, night));
  // Straw spilling over the sill, lying along the wall's line.
  const s0 = project(L + f.width * 0.34, B),
    s1 = project(L + f.width * 0.66, B);
  poly(ctx, [s0, s1, up(s1, 2), up(s0, 2)], pick(P.hay, night));
  ctx.fillStyle = pick(P.hayLight, night);
  for (const t of [0.15, 0.4, 0.7, 0.9]) {
    const x = s0.x + (s1.x - s0.x) * t,
      y = s0.y + (s1.y - s0.y) * t;
    ctx.fillRect(Math.round(x), Math.round(y) - 3 - (Math.round(t * 3) % 2), 1, 2);
  }
  // A small window high on the gable side.
  const win = project(Ri, T + f.height * 0.5);
  box(ctx, Math.round(win.x) + 2, Math.round(win.y) - 26, 7, 7, pick(P.woodDark, night));
  box(ctx, Math.round(win.x) + 3, Math.round(win.y) - 25, 5, 5, pick(P.doorway, night));
}
/** The zebras' shade: a low thatched roof on four poles, in two halves so an animal lying
 * under it sits between the back poles and the roof. */
function shadePoles(ctx: Ctx, f: Rect, night: boolean, which: 'back' | 'front') {
  const corners =
    which === 'back'
      ? [
          [f.left + 0.12, f.top + 0.12],
          [f.left + f.width - 0.12, f.top + 0.12],
          [f.left + 0.12, f.top + f.height - 0.12],
        ]
      : [[f.left + f.width - 0.12, f.top + f.height - 0.12]];
  for (const [x, y] of corners) {
    const p = at(x, y);
    box(ctx, p.x - 1, p.y - 24, 3, 24, pick(P.wood, night));
    box(ctx, p.x - 1, p.y - 24, 1, 24, pick(P.woodLight, night));
  }
}
function shadeRoof(ctx: Ctx, f: Rect, night: boolean, snow: number) {
  // A hipped thatch: four eaves at pole height, rising to a point over the middle.
  const g = 0.2,
    eave = 22;
  const a = up(project(f.left - g, f.top - g), eave),
    b = up(project(f.left + f.width + g, f.top - g), eave),
    c = up(project(f.left + f.width + g, f.top + f.height + g), eave),
    d = up(project(f.left - g, f.top + f.height + g), eave),
    apex = up(project(f.left + f.width / 2, f.top + f.height / 2), eave + 17);
  const thatch = pick(P.thatch, night),
    dark = pick(P.thatchDark, night),
    white = pick(SNOW.top, night);
  poly(ctx, [a, b, apex], mixHex(dark, white, snow * 0.8));
  poly(ctx, [a, d, apex], mixHex(dark, white, snow * 0.8));
  poly(ctx, [d, c, apex], mixHex(tint(thatch, 8), white, snow * 0.9));
  poly(ctx, [c, b, apex], mixHex(thatch, white, snow * 0.85));
  // Rows of straw on the two near faces, and a ragged fringe along the eaves.
  ctx.fillStyle = mixHex(dark, white, snow * 0.6);
  for (const t of [0.35, 0.65]) {
    for (const [from, to] of [
      [d, c],
      [c, b],
    ]) {
      const p = { x: from.x + (apex.x - from.x) * t, y: from.y + (apex.y - from.y) * t },
        q = { x: to.x + (apex.x - to.x) * t, y: to.y + (apex.y - to.y) * t };
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.lineTo(q.x, q.y + 1);
      ctx.lineTo(p.x, p.y + 1);
      ctx.fill();
    }
  }
  ctx.fillStyle = dark;
  for (const [from, to] of [
    [d, c],
    [c, b],
  ])
    for (let i = 0; i < 7; i++) {
      const x = from.x + ((to.x - from.x) * (i + 0.5)) / 7,
        y = from.y + ((to.y - from.y) * (i + 0.5)) / 7;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 2 + (i % 2) * 2);
    }
  box(ctx, Math.round(apex.x) - 1, Math.round(apex.y) - 3, 3, 4, pick(P.woodDark, night));
}
function rock(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  hgt: number,
  night: boolean,
  snow: number,
) {
  box(ctx, x - w / 2, y - hgt, w, hgt, pick(P.stone, night));
  box(ctx, x - w / 2 + 2, y - hgt - 2, w - 4, 2, pick(P.stone, night));
  box(ctx, x + w / 2 - 3, y - hgt + 1, 3, hgt - 1, pick(P.stoneDark, night));
  box(ctx, x - w / 2 + 2, y - hgt - 2, w - 7, 2, pick(snow > 0.5 ? SNOW.top : P.stoneLight, night));
  box(ctx, x - w / 2, y - 2, w, 2, pick(P.stoneDark, night));
}
function boulders(ctx: Ctx, f: Rect, night: boolean, snow: number) {
  const p = at(f.left + f.width / 2, f.top + f.height / 2);
  rock(ctx, p.x - 4, p.y - 3, 18, 12, night, snow);
  rock(ctx, p.x + 10, p.y + 1, 12, 8, night, snow);
  rock(ctx, p.x - 12, p.y + 4, 10, 6, night, snow);
}
function logs(ctx: Ctx, f: Rect, night: boolean, snow: number) {
  // Two logs lying along x, one resting on the other, their cut ends turned to the viewer.
  for (const [dv, lift, trim] of [
    [0.4, 0, 0],
    [0.22, 9, 0.3],
  ]) {
    const a = project(f.left + trim, f.top + dv),
      b = project(f.left + f.width - 0.1, f.top + dv);
    poly(ctx, [up(a, lift), up(b, lift), up(b, lift + 11), up(a, lift + 11)], pick(P.bark, night));
    poly(
      ctx,
      [up(a, lift), up(b, lift), up(b, lift + 3), up(a, lift + 3)],
      pick(P.woodDark, night),
    );
    poly(
      ctx,
      [up(a, lift + 8), up(b, lift + 8), up(b, lift + 11), up(a, lift + 11)],
      pick(snow > 0.5 ? SNOW.top : P.barkLight, night),
    );
    ctx.fillStyle = pick(P.woodDark, night);
    for (const t of [0.3, 0.62]) {
      const x = a.x + (b.x - a.x) * t,
        y = a.y + (b.y - a.y) * t;
      ctx.fillRect(Math.round(x), Math.round(y - lift - 7), 3, 1);
    }
    const x = Math.round(b.x),
      y = Math.round(b.y - lift);
    box(ctx, x - 2, y - 10, 8, 9, pick(P.woodLight, night));
    box(ctx, x - 1, y - 11, 6, 11, pick(P.woodLight, night));
    box(ctx, x, y - 8, 4, 5, pick(P.hayLight, night));
    box(ctx, x + 1, y - 7, 2, 2, pick(P.woodDark, night));
  }
}
/** The penguins' rock ledge, two steps high, with a little ice slide down to the pool. */
function ledge(ctx: Ctx, h: ZooHabitat, f: Rect, night: boolean) {
  const block = (r: Rect, base: number, H: number, top: Pair) => {
    const back = project(r.left, r.top),
      right = project(r.left + r.width, r.top),
      front = project(r.left + r.width, r.top + r.height),
      left = project(r.left, r.top + r.height);
    poly(ctx, [up(left, base), up(front, base), up(front, H), up(left, H)], pick(P.stone, night));
    poly(
      ctx,
      [up(front, base), up(right, base), up(right, H), up(front, H)],
      pick(P.stoneDark, night),
    );
    poly(ctx, [up(back, H), up(right, H), up(front, H), up(left, H)], pick(top, night));
  };
  block(f, 0, 9, P.stoneLight);
  block(
    { left: f.left + 0.4, top: f.top + 0.05, width: f.width - 0.45, height: f.height - 0.45 },
    9,
    17,
    SNOW.top,
  );
  // Cracks in the rock face.
  const face = project(f.left + f.width * 0.4, f.top + f.height);
  box(ctx, Math.round(face.x), Math.round(face.y) - 7, 1, 4, pick(P.stoneDark, night));
  box(ctx, Math.round(face.x) + 9, Math.round(face.y) - 4, 1, 3, pick(P.stoneDark, night));
  // The slide: from the lower step down over the kerb into the pool.
  const pool = zooPond(h);
  const end = pool.left + pool.width - 0.2;
  const s0 = up(project(f.left + 0.1, f.top + 0.3), 9),
    s1 = up(project(f.left + 0.1, f.top + 0.6), 9),
    e1 = up(project(end, f.top + 0.55), -1),
    e0 = up(project(end, f.top + 0.25), -1);
  poly(ctx, [s1, e1, up(e1, -3), up(s1, -3)], pick(P.poolWall, night));
  poly(ctx, [s0, s1, e1, e0], pick(P.slide, night));
  poly(ctx, [s0, e0, up(e0, 2), up(s0, 2)], pick(P.poolJoint, night));
}
function island(ctx: Ctx, f: Rect, night: boolean, snow: number) {
  const p = at(f.left + f.width / 2, f.top + f.height / 2);
  box(ctx, p.x - 11, p.y - 7, 22, 8, pick(P.stone, night));
  box(ctx, p.x - 8, p.y - 11, 15, 4, pick(P.stone, night));
  box(ctx, p.x + 5, p.y - 9, 6, 9, pick(P.stoneDark, night));
  box(ctx, p.x - 7, p.y - 11, 9, 2, pick(snow > 0.3 ? SNOW.top : P.stoneLight, night));
  box(ctx, p.x - 11, p.y, 22, 1, pick(POND.glint, night));
}
function reeds(ctx: Ctx, p: Point, night: boolean, season: TownSeason | undefined, seed: number) {
  const day = season?.groundDay ?? 30;
  const colour = day >= WINTER ? REED.pale : day >= 2 * 28 + 10 ? REED.straw : REED.green;
  const x = Math.round(p.x),
    y = Math.round(p.y);
  ctx.fillStyle = pick(colour, night);
  for (let i = 0; i < 5; i++)
    ctx.fillRect(
      x - 5 + i * 2 + (seed % 2),
      y - 5 - ((i * 7 + seed) % 5),
      1,
      6 + ((i * 7 + seed) % 5),
    );
  if (day < WINTER) {
    ctx.fillStyle = pick(REED.greenLight, night);
    ctx.fillRect(x - 3, y - 3, 1, 3);
    ctx.fillRect(x + 1, y - 4, 1, 4);
  }
  box(ctx, x - 1, y - 11 - (seed % 3), 2, 3, pick(P.woodDark, night));
}
/** The ticket kiosk beside the gate: a timber booth with a striped awning. */
function kiosk(ctx: Ctx, night: boolean, snow: number) {
  const f = ZOO_KIOSK,
    H = 24;
  const right = project(f.left + f.width, f.top),
    front = project(f.left + f.width, f.top + f.height),
    left = project(f.left, f.top + f.height);
  poly(ctx, [left, front, up(front, H), up(left, H)], pick(P.woodLight, night));
  poly(ctx, [front, right, up(right, H), up(front, H)], pick(P.wood, night));
  // The service window with its counter.
  const w0 = project(f.left + 0.15, f.top + f.height),
    w1 = project(f.left + 0.55, f.top + f.height);
  poly(ctx, [up(w0, 9), up(w1, 9), up(w1, 19), up(w0, 19)], pick(P.doorway, night));
  poly(ctx, [up(w0, 7), up(w1, 7), up(w1, 9), up(w0, 9)], pick(P.woodDark, night));
  // Awning over the window, then the roof.
  poly(
    ctx,
    [
      up(project(f.left - 0.05, f.top + f.height + 0.25), H - 4),
      up(project(f.left + f.width + 0.1, f.top + f.height + 0.25), H - 4),
      up(front, H),
      up(left, H),
    ],
    pick(P.awningLight, night),
  );
  ctx.fillStyle = pick(P.awning, night);
  for (let i = 0; i < 4; i++) {
    const a = project(f.left + i * 0.2, f.top + f.height),
      b = project(f.left - 0.05 + i * 0.2, f.top + f.height + 0.25);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - H);
    ctx.lineTo(a.x + 3.8, a.y - H + 1.9);
    ctx.lineTo(b.x + 3.8, b.y - H + 5.9);
    ctx.lineTo(b.x, b.y - H + 4);
    ctx.fill();
  }
  const roof = mixHex(pick(P.roof, night), pick(SNOW.top, night), snow * 0.9);
  poly(
    ctx,
    [
      up(project(f.left - 0.1, f.top - 0.1), H + 4),
      up(project(f.left + f.width + 0.1, f.top - 0.1), H + 4),
      up(project(f.left + f.width + 0.1, f.top + f.height + 0.1), H + 1),
      up(project(f.left - 0.1, f.top + f.height + 0.1), H + 1),
    ],
    roof,
  );
}
function pillar(ctx: Ctx, point: Point, night: boolean, lit: boolean, snow: number) {
  const p = at(point.x, point.y);
  const stone = pick(P.pillar, night),
    shade = pick(P.pillarShade, night),
    cap = pick(snow > 0.5 ? SNOW.top : P.pillarCap, night);
  box(ctx, p.x - 9, p.y - 7, 18, 8, shade);
  box(ctx, p.x - 9, p.y - 8, 13, 2, cap);
  box(ctx, p.x - 7, p.y - 88, 14, 81, stone);
  box(ctx, p.x + 2, p.y - 88, 5, 81, shade);
  // Stone courses, staggered.
  ctx.fillStyle = shade;
  for (let i = 1; i < 6; i++) {
    ctx.fillRect(p.x - 7, p.y - 7 - i * 14, 9, 1);
    ctx.fillRect(p.x - 3 + (i % 2) * 3, p.y - 14 - i * 14, 1, 7);
  }
  box(ctx, p.x - 9, p.y - 94, 18, 6, cap);
  box(ctx, p.x - 9, p.y - 89, 18, 1, shade);
  box(ctx, p.x + 4, p.y - 93, 5, 5, shade);
  // A small lantern on the cap: glass by day, amber only once the town's lamps are lit.
  box(ctx, p.x - 4, p.y - 104, 8, 10, pick(P.woodDark, night));
  box(ctx, p.x - 2, p.y - 102, 4, 7, lit ? pick(P.lit, night) : pick(P.glass, night));
  box(ctx, p.x - 5, p.y - 106, 10, 2, pick(snow > 0.5 ? SNOW.top : P.woodDark, night));
  if (lit) {
    box(ctx, p.x - 9, p.y - 104, 18, 10, HALO);
    box(ctx, p.x - 5, p.y - 108, 10, 18, HALO);
  }
}
function gateTop(ctx: Ctx, night: boolean) {
  const [a, b] = ZOO_GATE_PILLARS.map((p) => project(p.x, p.y));
  // The beam between the pillars, with a darker underside; the plaque rests on it.
  const beam = ZOO_SIGN.rise - ZOO_SIGN.height;
  poly(ctx, [up(a, beam), up(b, beam), up(b, beam - 8), up(a, beam - 8)], pick(P.wood, night));
  poly(
    ctx,
    [up(a, beam - 6), up(b, beam - 6), up(b, beam - 8), up(a, beam - 8)],
    pick(P.woodDark, night),
  );
  poly(ctx, [up(a, beam), up(b, beam), up(b, beam - 1), up(a, beam - 1)], pick(P.woodLight, night));
  const s = project(ZOO_SIGN.point.x, ZOO_SIGN.point.y);
  ctx.save();
  // The plaque follows the gate's line, like the fences.
  ctx.transform(1, 0.5, 0, 1, s.x, s.y);
  drawVenueTitle(ctx, {
    x: 0,
    y: -ZOO_SIGN.rise,
    width: ZOO_SIGN.width,
    height: ZOO_SIGN.height,
    title: ZOO_VENUE.name,
    fontSize: 16,
    night,
  });
  ctx.restore();
}
function habitatSign(ctx: Ctx, sign: ZooSign, night: boolean) {
  const p = at(sign.point.x, sign.point.y);
  ctx.save();
  if (sign.slant) {
    ctx.transform(1, sign.slant, 0, 1, p.x, p.y);
    p.x = 0;
    p.y = 0;
  }
  // Two posts carry the board: short on a fence, taller in a meadow.
  const bottom = sign.rise - sign.height;
  for (const side of [-1, 1]) {
    const x = p.x + side * (sign.width / 2 - 16);
    box(ctx, x - 2, p.y - bottom - 2, 5, bottom + 2, pick(P.wood, night));
    box(ctx, x - 2, p.y - bottom - 2, 2, bottom + 2, pick(P.woodLight, night));
  }
  drawVenueTitle(ctx, {
    x: p.x,
    y: p.y - sign.rise,
    width: sign.width,
    height: sign.height,
    title: sign.title,
    subtitle: sign.subtitle,
    // Big and bright enough to read across the whole zoo.
    subtitleFont: sign.subtitle ? '700 10px "Space Mono", monospace' : undefined,
    subtitleColour: sign.subtitle ? (night ? '#D3D8C0' : '#E6E4C4') : undefined,
    fontSize: sign.fontSize,
    night,
  });
  ctx.restore();
}

// The gate's lanterns join the town's lamp wave at their distance from the Fork.
const fork = getPlot(FORK_PLOT)!;
const GATE_LAMP_DISTANCE =
  Math.abs(ZOO_GATE.x - (fork.x + 0.5)) + Math.abs(ZOO_GATE.y - (fork.y + 0.5));

// Young trees in the future pens, in habitat tiles, clear of the board in the middle.
const SAPLINGS = [
  [0.9, 1.0],
  [2.6, 0.8],
  [4.9, 1.2],
  [1.2, 4.2],
  [5.2, 4.3],
];
// Reeds at two corners of each pond, as fractions of its footprint.
const REED_SPOTS = [
  [-0.05, 0.75],
  [0.8, -0.1],
];

export type ZooDrawOptions = {
  minutes: number;
  day: number;
  night: boolean;
  season?: TownSeason;
  selected?: boolean;
  /** The renderer's view test; the whole zoo is skipped when its frame is out of view. */
  visible?: Visible;
};
const ZOO_MIDDLE = project(ZOO_CENTER.x, ZOO_CENTER.y);
const ZOO_REACH = {
  x: ((ZOO_GROUND.right - ZOO_GROUND.left + ZOO_GROUND.bottom - ZOO_GROUND.top) * TILE_W) / 4 + 90,
  above: ZOO_MIDDLE.y - project(ZOO_GROUND.left, ZOO_GROUND.top).y + 130,
  below: project(ZOO_GROUND.right, ZOO_GROUND.bottom).y - ZOO_MIDDLE.y + 20,
};

export function drawZoo(ctx: Ctx, options: ZooDrawOptions): Object[] {
  const { minutes, day, night, season, selected = false } = options;
  const visible = options.visible ?? (() => true);
  const objects: Object[] = [];
  if (!visible(ZOO_MIDDLE, ZOO_REACH.x, ZOO_REACH.above, ZOO_REACH.below)) return objects;
  const add = (
    ground: Point,
    depth: number,
    reach: [number, number, number],
    paint: () => void,
    part?: 'animal',
  ) => {
    if (visible(project(ground.x, ground.y), ...reach)) objects.push({ depth, paint, part });
  };
  const { left, right, top, bottom } = ZOO_GROUND;
  // The ground takes the snow with the town's lawns, the morning after the roofs.
  const snowy = !!season && snowAt(season.groundDay, 0.5) > 0.5;
  const iced = !!season && season.groundDay >= WINTER + 4 && season.groundDay < WINTER + 22;
  const frosted = (pair: Pair, amount = 0.3) =>
    snowy ? mixHex(pick(pair, night), pick(SNOW.frost, night), amount) : pick(pair, night);

  quad(ctx, left, top, right - left, bottom - top, frosted(P.grass));
  if (snowy)
    for (const s of LAWN_SNOW) drift(ctx, s, pick(SNOW.top, night), pick(SNOW.shade, night));
  // Broad, connected paths keep visitors outside the enclosures: the side path from the gate,
  // the promenade between the rows, and a paved plaza under the gate.
  const path = frosted(P.path, 0.2),
    edge = pick(P.pathEdge, night);
  quad(ctx, left + 0.05, top, 0.85, bottom - top, path);
  quad(ctx, left, ZOO_CENTER.y - 0.75, right - left, 1.5, path);
  quad(ctx, PLAZA.left, PLAZA.top, PLAZA.width, PLAZA.height, path);
  quad(
    ctx,
    left + 0.9,
    PLAZA.top + PLAZA.height,
    0.05,
    ZOO_CENTER.y - 0.75 - PLAZA.height - top,
    edge,
  );
  quad(ctx, left + 0.9, ZOO_CENTER.y - 0.8, right - left - 0.9, 0.05, edge);
  quad(ctx, left + 0.9, ZOO_CENTER.y + 0.75, right - left - 0.9, 0.05, edge);
  quad(ctx, left + 0.9, PLAZA.top + PLAZA.height - 0.05, PLAZA.width - 0.9, 0.05, edge);
  // Flagstone joints on the plaza.
  ctx.fillStyle = pick(P.flag, night);
  for (let i = 0; i < 8; i++) {
    const p = at(left + 0.35 + i * 0.52, top + 0.3 + (i % 2) * 0.35);
    ctx.fillRect(p.x - 4, p.y, 9, 1);
  }

  for (const [index, h] of ZOO_HABITATS.entries()) {
    const corner = project(h.left + h.width / 2, h.top + h.height / 2);
    if (!visible(corner, 170, 190, 90)) continue;
    const texture = TEXTURES[index];
    const ground =
      h.animal === 'penguin'
        ? P.beach
        : h.animal === 'elephant'
          ? P.dust
          : h.animal
            ? P.savanna
            : P.meadow;
    const floor = frosted(ground, h.animal === 'penguin' ? 0.15 : 0.5);
    quad(ctx, h.left, h.top, h.width, h.height, floor);
    if (!snowy) paintWear(ctx, h, texture, night, floor);
    // The penguins keep a few patches of snow on their beach all year.
    if (snowy || h.animal === 'penguin')
      for (const s of texture.snow.slice(0, snowy ? undefined : 4))
        drift(ctx, s, pick(SNOW.top, night), pick(SNOW.shade, night));
    const pond = zooPond(h);
    if (h.animal === 'penguin') paintPool(ctx, h, pond, night, minutes);
    else if (h.animal) paintPond(ctx, h, pond, night, minutes, iced);
    paintTexture(ctx, h, texture, night, snowy);
    for (const p of zooProps(h)) if (p.kind === 'floe') paintFloe(ctx, p, night);
  }

  // Uprights, sorted with the animals by the town's painter.
  for (const [index, h] of ZOO_HABITATS.entries()) {
    const signs = ZOO_HABITAT_SIGNS[index];
    for (const p of zooProps(h)) {
      const mid = { x: p.left + p.width / 2, y: p.top + p.height / 2 };
      const depth = mid.x + mid.y;
      const key = `zoo:${h.id}:${p.kind}`;
      const snow = snowOn(season, key);
      if (p.kind === 'acacia') {
        const point = zooTree(h);
        add(point, point.x + point.y, [40, 80, 6], () => acacia(ctx, point, night, season));
      } else if (p.kind === 'tree') {
        const point = zooTree(h);
        add(point, point.x + point.y, [20, 62, 6], () => tree(ctx, point, night, season));
      } else if (p.kind === 'feeder')
        add(mid, depth, [14, 80, 4], () => feeder(ctx, p, night, snow));
      else if (p.kind === 'house')
        add(mid, depth, [60, 80, 40], () => elephantHouse(ctx, p, night, snow));
      else if (p.kind === 'shade') {
        add(mid, depth - 0.6, [45, 50, 30], () => shadePoles(ctx, p, night, 'back'));
        add(mid, depth + 0.3, [45, 50, 30], () => {
          shadePoles(ctx, p, night, 'front');
          shadeRoof(ctx, p, night, snow);
        });
      } else if (p.kind === 'boulders')
        add(mid, depth, [30, 20, 12], () => boulders(ctx, p, night, snow));
      else if (p.kind === 'logs') add(mid, depth, [40, 24, 16], () => logs(ctx, p, night, snow));
      else if (p.kind === 'ledge') add(mid, depth, [40, 30, 24], () => ledge(ctx, h, p, night));
      else if (p.kind === 'island') add(mid, depth, [14, 14, 4], () => island(ctx, p, night, snow));
      else if (p.kind === 'pond')
        for (const [fx, fy] of REED_SPOTS) {
          const spot = { x: p.left + p.width * fx, y: p.top + p.height * fy };
          add(spot, spot.x + spot.y, [8, 16, 2], () =>
            reeds(ctx, project(spot.x, spot.y), night, season, Math.round(fx * 10 + h.left)),
          );
        }
    }
    if (!h.animal)
      for (const [u, v] of SAPLINGS) {
        const point = { x: h.left + u, y: h.top + v };
        add(point, point.x + point.y, [12, 42, 3], () => sapling(ctx, point, night, season));
      }
    // Fences in segments, to share the painter's depth order with the animals. The back edges
    // sort at their far end and the front edges at their near end, so an animal close to a fence
    // is always on the right side of it, and a board hung on a fence always covers its rails.
    const corners = [
      { x: h.left, y: h.top },
      { x: h.left + h.width, y: h.top },
      { x: h.left + h.width, y: h.top + h.height },
      { x: h.left, y: h.top + h.height },
    ];
    const board = signs.future ? null : signs;
    const boardDepth = !board
      ? 0
      : board.front
        ? board.point.x + board.point.y + board.width / TILE_W / 2 + 0.95
        : board.point.x + board.point.y - board.width / TILE_W / 2;
    for (const [side, [from, to]] of [
      [corners[0], corners[1]],
      [corners[1], corners[2]],
      [corners[2], corners[3]],
      [corners[3], corners[0]],
    ].entries()) {
      const backEdge = side === 0 || side === 3;
      const length = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y));
      for (let i = 0; i < length; i++) {
        const p = {
          x: from.x + ((to.x - from.x) * i) / length,
          y: from.y + ((to.y - from.y) * i) / length,
        };
        const q = {
          x: from.x + ((to.x - from.x) * (i + 1)) / length,
          y: from.y + ((to.y - from.y) * (i + 1)) / length,
        };
        let depth = backEdge ? Math.min(p.x + p.y, q.x + q.y) : Math.max(p.x + p.y, q.x + q.y);
        // The row-1 boards hang on the back fence: the rails under them go first.
        if (board && !board.front && side === 0) {
          const reach = board.width / TILE_W / 2 + 0.1;
          if (
            Math.max(p.x, q.x) > board.point.x - reach &&
            Math.min(p.x, q.x) < board.point.x + reach
          )
            depth = Math.min(depth, boardDepth - 0.01);
        }
        add(p, depth, [45, 26, 22], () => fence(ctx, p, q, night, snowy));
      }
    }
    add(
      signs.point,
      board ? boardDepth : signs.point.x + signs.point.y,
      [signs.width / 2 + 4, signs.rise + signs.width * 0.25 + 4, signs.width * 0.25 + 4],
      () => habitatSign(ctx, signs, night),
    );
  }
  for (const a of zooAnimalsAt(minutes, day))
    add(
      a.position,
      a.position.x + a.position.y,
      [45, 120, 12],
      () => drawZooAnimal(ctx, a, night),
      'animal',
    );

  // The gate: each pillar sorts at its own foot, the beam and plaque at the plaque's near end.
  const lit = night && lampOn(GATE_LAMP_DISTANCE, minutes);
  const gateSnow = snowOn(season, 'zoo:gate');
  for (const point of ZOO_GATE_PILLARS)
    add(point, point.x + point.y, [12, 112, 4], () => pillar(ctx, point, night, lit, gateSnow));
  add(ZOO_SIGN.point, ZOO_SIGN_DEPTH, [ZOO_SIGN.width / 2 + 4, ZOO_SIGN.rise + 45, 45], () =>
    gateTop(ctx, night),
  );
  const kioskMid = {
    x: ZOO_KIOSK.left + ZOO_KIOSK.width / 2,
    y: ZOO_KIOSK.top + ZOO_KIOSK.height / 2,
  };
  add(kioskMid, kioskMid.x + kioskMid.y, [24, 40, 16], () => kiosk(ctx, night, gateSnow));

  if (selected) {
    ctx.strokeStyle = '#F2E2A1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    [
      project(left, top),
      project(right, top),
      project(right, bottom),
      project(left, bottom),
    ].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
  }
  return objects;
}
