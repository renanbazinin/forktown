// Fountain Square (D8–E9, src/lib/square.ts): warm stone paving, a fountain, two benches and
// three round planters, across road x = 29 from the cinema.
//
// The paving is painted into the cached ground layer, so it reads only the night, the season's
// whole day and the zoom (the camera is in the layer's key): a kerb and a border course of rose
// brick soldiers, a field of square flags in two close tones, and round the fountain a rosette of
// sett rings. The stones' joints are dashed strokes, a row or a ring at a time, so the whole floor
// is about 80 canvas calls far out and under 250 close up, where the joints and odd stones come in
// (from zoom 0.45). Leaves gather on it in autumn, petals under the tree in spring, frost and
// drifts while the snow lies.
//
// The fountain, the benches and the planters are depth objects, each sorted at its own foot. The
// fountain is one object at its centre (nobody stands inside its rim): a round basin whose rim
// is a seat 9 px high, the height of a garden bench at the map's resident scale, a plinth and a
// baluster in the water, a dish spilling a ring of streams, and a little jet on top, 65 px in
// all. The water runs all year and all night; only its streams and ripples move, on the town
// minute. At night it keeps a faint cool glint, never amber. No Math.random or Date.now.
import { FOUNTAIN, SQUARE_BENCHES, SQUARE_GROUND, SQUARE_PLANTERS } from '../lib/square';
import {
  AUTUMN,
  WINTER,
  canopyAt,
  groundFraction,
  seedFraction,
  snowAt,
  treeKind,
  type TownSeason,
} from '../lib/seasons';
import { DAYS_PER_SEASON, DAYS_PER_YEAR } from '../lib/town-calendar';
import { hash, project, unproject, type Point } from '../lib/world';
import type { DepthObject, Visible } from './district-art';
import { at, PX, TAU } from './iso-paint';
import { BLOSSOM, FALLEN_LEAVES, mixHex, pick, SNOW, type Pair } from './season-palette';
import { drawTownTree, type Foliage } from './trees';

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------------------------------------
// Palette: [day, night] pairs. A warm, faintly rosy sandstone for the paving, so the square
// never reads as the market's cool setts or the cream roads; a paler limestone for the fountain
// and planters; oak slats on green iron for the benches. Nothing here is a light.

const C = {
  flag: ['#DCCBAE', '#848A7B'],
  flagAlt: ['#D5C3A5', '#7F8576'],
  flagLight: ['#E4D6BB', '#8C9282'],
  flagWorn: ['#CDBB9C', '#797F71'],
  joint: ['#C7B394', '#71776A'],
  kerb: ['#B2A085', '#5E665A'],
  kerbEdge: ['#9F8E74', '#535A50'],
  brick: ['#C5A08B', '#766C63'],
  brickJoint: ['#AE8873', '#665D56'],
  band: ['#E8DCC3', '#90958A'],
  corner: ['#BBA98E', '#676E61'],
  ringEdge: ['#B7A58A', '#646B5E'],
  settA: ['#CEB79A', '#7B7E71'],
  settB: ['#DECDB1', '#878C7E'],
  apron: ['#C3BCAB', '#767E74'],
  settJoint: ['#B9A487', '#6A7064'],
  shadow: ['#3C5A3C29', '#0C1B1C38'],
  stoneTop: ['#E5DDCC', '#959C90'],
  stoneLight: ['#F0E9DA', '#A2A99C'],
  stone: ['#D3C8B2', '#858C80'],
  stoneMid: ['#C4B9A3', '#7B8277'],
  stoneShade: ['#AEA38E', '#6C736A'],
  stoneDark: ['#9A917D', '#5D645C'],
  innerWall: ['#A39C89', '#58605A'],
  water: ['#8DBCBF', '#3F6673'],
  waterDeep: ['#7DAFB4', '#385D6A'],
  waterLight: ['#C3DFDC', '#6F96A2'],
  stream: ['#CFE6E3', '#7FA2AC'],
  spray: ['#F4FAF8', '#B2CDD2'],
  wood: ['#B08A5F', '#665D4E'],
  woodTop: ['#C59E6F', '#746A5A'],
  woodDark: ['#8D6C49', '#544D42'],
  iron: ['#4F6659', '#36463F'],
  ironLight: ['#6A8273', '#45564E'],
  soil: ['#6A5440', '#3E3A33'],
} satisfies Record<string, Pair>;

/** What grows in the two flower planters, season by season: never a yellow, so never amber. */
const BEDS: readonly { leaf: Pair; light: Pair; flowers: readonly Pair[] }[] = [
  // Spring: tulips, pink, white and a deeper rose.
  {
    leaf: ['#6E9A4A', '#3E5F4C'],
    light: ['#8DB563', '#4E6F55'],
    flowers: [BLOSSOM.pink, BLOSSOM.white, ['#C9607A', '#7E5662']],
  },
  // Summer: lavender, rose and white.
  {
    leaf: ['#5F8C4C', '#3A5A4A'],
    light: ['#7FA662', '#4A6A55'],
    flowers: [
      ['#A58BC4', '#6F6680'],
      ['#D9738A', '#7E5662'],
      ['#F4EFE6', '#B9B6AE'],
    ],
  },
  // Autumn: asters and heather, plum and russet.
  {
    leaf: ['#7F8A4E', '#4A5547'],
    light: ['#97A060', '#56604F'],
    flowers: [
      ['#8E6A9E', '#5E5468'],
      ['#B0603F', '#6E5245'],
      ['#C98BA5', '#7E6A75'],
    ],
  },
  // Winter: clipped box and holly berries.
  {
    leaf: ['#46705A', '#2F4D44'],
    light: ['#5A8468', '#3B5A4F'],
    flowers: [['#B5443E', '#6E3E3E']],
  },
];

// ---------------------------------------------------------------------------------------------
// Geometry. Plane units are screen px along a level face (PX to a tile), heights px up.

const G = SQUARE_GROUND;
/** The paving's side, in plane units: seven tiles. */
const SIDE = (G.right - G.left) * PX;
/** The fountain's centre in the paving's plane. */
const FC = { u: (FOUNTAIN.x - G.left) * PX, w: (FOUNTAIN.y - G.top) * PX };
/** The rim's outer radius in tiles: a sitter's hips (0.09 behind the feet) rest on it. */
export const RIM_OUT = FOUNTAIN.basin + 0.27;
/** The rim's height, px: a seat, as high as a garden bench at the map's resident scale. */
const RIM_H = 9;
/** The water stands this high in the basin, px. */
const WATER_H = 5;
/** The dish on the baluster: its radius in tiles, and the top of its lip, px. */
const DISH = { r: 0.48, top: 44, band: 3 };
/** How high the fountain's jet reaches, px above the paving. */
export const FOUNTAIN_HEIGHT = 65;
/** The plinth the baluster stands on, in the water: its radius in tiles and its top, px. */
const PLINTH = { r: 0.24, top: 10 };
/** The fountain sorts as one object at its centre. */
export const FOUNTAIN_DEPTH = FOUNTAIN.x + FOUNTAIN.y;
/**
 * The rosette round the fountain, radii in plane units: an edging ring, three rings of setts
 * 6 units deep, and a granite apron out from the rim.
 */
const ROSETTE = { edge: 79, rings: [76, 70, 64], apron: 58 };
/** The border: the kerb, the brick soldiers and the light course inside them, plane units. */
const BORDER = { kerb: 4, brick: 10, band: 2 };
/** A flag of the field: half a tile square. */
const FLAG = PX / 2;
const FLAGS = Math.round(SIDE / FLAG);

/** A level circle of `r` tiles on screen: its half width and half height. */
const radii = (r: number) => ({ rx: r * PX * Math.SQRT2, ry: (r * PX) / Math.SQRT2 });
const FOOT = project(FOUNTAIN.x, FOUNTAIN.y);
/**
 * The ten streams the dish spills round its lip, px from the fountain's foot: where each falls
 * (x), from under the lip (top) to the basin's water (land), and whether it falls in front of
 * the baluster or behind it.
 */
const STREAM_FALLS = Array.from({ length: 10 }, (_, k) => {
  const t = ((k + 0.5) * TAU) / 10;
  const dish = radii(DISH.r);
  const top = -DISH.top + DISH.band + Math.sin(t) * dish.ry;
  return {
    x: Math.round(Math.cos(t) * (dish.rx - 1)),
    top,
    land: top + DISH.top - DISH.band - WATER_H,
    front: Math.sin(t) >= 0,
  };
});

/** The planter tree: a flowering broadleaf whose leaves turn ochre, then russet. */
const TREE_VARIANT = hash('square-tree:3');
const TREE_KIND = treeKind(TREE_VARIANT);
const TREE_S = seedFraction(`tree:${TREE_VARIANT}`);
/** How many days into a season a planter is given the season's flowers. */
const replant = (p: Point) => 1 + seedFraction(`square-planter:${p.x},${p.y}`) * 2;
const PLANTER = {
  tree: { r: 0.4, h: 11, soil: 0.33 },
  flowers: { r: 0.34, h: 10, soil: 0.27 },
} as const;
/** The bench's parts, along its normal from the line it is set on (tiles) and up (px). */
const BENCH = { back: -0.06, seatBack: -0.04, seatFront: 0.17, seat: 9, rail: 19 } as const;

/** The square's screen box, for culling: its four corners, and the fountain and tree above. */
const BOX = (() => {
  const corners = [
    project(G.left, G.top),
    project(G.right, G.top),
    project(G.right, G.bottom),
    project(G.left, G.bottom),
  ];
  const xs = corners.map((p) => p.x),
    ys = corners.map((p) => p.y);
  const l = Math.min(...xs),
    r = Math.max(...xs),
    t = Math.min(...ys),
    b = Math.max(...ys);
  return {
    corners,
    foot: { x: (l + r) / 2, y: b },
    rx: (r - l) / 2 + 4,
    ground: b - t + 4,
    // The tree in the back corner reaches about 45 px over the paving.
    above: b - t + 56,
    below: 4,
  };
})();
export const squareInView = (visible: Visible) => visible(BOX.foot, BOX.rx, BOX.above, BOX.below);

// ---------------------------------------------------------------------------------------------
// Litter and drifts, placed once: leaves blown against the kerbs and the furniture, and a few
// across the flags; drifts along the kerbs while the snow lies.

/** A plane point (u, w) on screen. */
const onPaving = (u: number, w: number) => project(G.left + u / PX, G.top + w / PX);
const clearOfFountain = (u: number, w: number) => Math.hypot(u - FC.u, w - FC.w) > RIM_OUT * PX + 3;
const LEAVES = Array.from({ length: 52 }, (_, k) => {
  const h = hash(`square-leaf:${k}`);
  const f = (salt: number) => groundFraction(h, salt);
  const inner = BORDER.kerb + BORDER.brick + BORDER.band;
  let u = inner + f(1) * (SIDE - 2 * inner),
    w = inner + f(2) * (SIDE - 2 * inner);
  // Two in three end up against an edge of the paving, a little in from its kerb.
  const edge = Math.floor(f(3) * 6);
  if (edge === 0) u = inner + f(4) * 6;
  else if (edge === 1) w = inner + f(4) * 6;
  else if (edge === 2) u = SIDE - inner - f(4) * 6;
  else if (edge === 3) w = SIDE - inner - f(4) * 6;
  const p = onPaving(u, w);
  return {
    x: Math.round(p.x),
    y: Math.round(p.y),
    when: f(5),
    colour: FALLEN_LEAVES[Math.floor(f(6) * 9) % FALLEN_LEAVES.length],
    w: f(7) > 0.7 ? 3 : 2,
    h: f(7) > 0.88 ? 2 : 1,
    shown: clearOfFountain(u, w),
  };
}).filter((leaf) => leaf.shown);
/** Where the planter tree's own leaves and petals settle, round its planter, px from its foot. */
const UNDER_TREE = [
  [-24, 4],
  [20, 6],
  [-6, 12],
  [27, -2],
  [-18, 10],
  [8, 14],
  [-30, -1],
  [16, 11],
] as const;
/**
 * Snow while it lies, in plane rects: small stepped piles against the kerbs (deepest on the
 * two far sides, where the wind drives it), and a light dusting caught in the flags' joints.
 */
const DRIFTS = Array.from({ length: 30 }, (_, k) => {
  const h = hash(`square-drift:${k}`);
  const f = (salt: number) => groundFraction(h, salt);
  const inner = BORDER.kerb + BORDER.brick + BORDER.band;
  if (k >= 18) {
    // A dusting: a short streak along a joint somewhere on the field.
    const u = inner + f(1) * (SIDE - 2 * inner - 12),
      j = Math.floor(f(2) * FLAGS);
    const rects = f(3) < 0.5 ? [[u, j * FLAG, 6 + f(4) * 8, 2]] : [[j * FLAG, u, 2, 6 + f(4) * 8]];
    return { rects, s: f(5) };
  }
  const side = k % 6 < 2 ? 0 : k % 6 < 4 ? 1 : k % 6 === 4 ? 2 : 3;
  const along = 14 + f(1) * (SIDE - 50),
    length = 8 + f(2) * 14,
    deep = side < 2 ? 4 : 3;
  const step = 2 + f(3) * (length / 3);
  // [along the kerb, out from it, length, depth] for the pile and the smaller heap on it.
  const pile = [
    [along, 0, length, deep],
    [along + step, deep, length - 2 * step, 2],
  ];
  const rects = pile.map(([a, q, l, d]) =>
    side === 0
      ? [a, inner + q, l, d]
      : side === 1
        ? [inner + q, a, d, l]
        : side === 2
          ? [a, SIDE - inner - q - d, l, d]
          : [SIDE - inner - q - d, a, d, l],
  );
  return { rects, s: f(4) };
});

// ---------------------------------------------------------------------------------------------
// The ground, in the cached layer.

/**
 * Paints the paving, its static shadows and the season's litter. Reads only the night, the
 * season's whole day and the zoom, which are all in the ground layer's key.
 */
export function drawSquareGround(
  ctx: Ctx,
  night: boolean,
  groundDay: number,
  zoom: number,
  visible: Visible,
) {
  if (!visible(BOX.foot, BOX.rx, BOX.ground, BOX.below)) return;
  const n = night ? 1 : 0;
  const snowy = snowAt(groundDay, 0.5) > 0.5;
  const frost = (pair: Pair, amount = 0.35) =>
    snowy ? mixHex(pair[n], SNOW.frost[n], amount) : pair[n];
  // The joints and odd stones only where they can be seen; far out the tones carry the pattern.
  const fine = zoom >= 0.45;
  const origin = at(G.left, G.top);
  ctx.save();
  // u along x and w along y, a px a px: a rect here is a rect on the paving.
  ctx.transform(1, 0.5, -1, 0.5, origin.x, origin.y);
  const r = (u: number, w: number, a: number, b: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(u, w, a, b);
  };
  const disc = (radius: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(FC.u, FC.w, radius, 0, TAU);
    ctx.fill();
  };
  r(0, 0, SIDE, SIDE, frost(C.flag));
  // The field: half-tile flags in two close tones, laid like a chequer, each row a dashed
  // stroke a flag wide.
  ctx.lineWidth = FLAG;
  ctx.strokeStyle = frost(C.flagAlt);
  for (const odd of [0, 1]) {
    ctx.setLineDash([FLAG, FLAG]);
    ctx.lineDashOffset = odd ? FLAG : 0;
    ctx.beginPath();
    for (let j = odd; j < FLAGS; j += 2) {
      ctx.moveTo(0, (j + 0.5) * FLAG);
      ctx.lineTo(SIDE, (j + 0.5) * FLAG);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (fine) {
    // A few flags a shade lighter or worn darker, and the joints between them all.
    for (let k = 0; k < 22; k++) {
      const h = hash(`square-flag:${k}`);
      const i = h % FLAGS,
        j = (h >>> 5) % FLAGS;
      if (Math.hypot((i + 0.5) * FLAG - FC.u, (j + 0.5) * FLAG - FC.w) < ROSETTE.edge + FLAG)
        continue;
      r(i * FLAG, j * FLAG, FLAG, FLAG, frost(h % 3 ? C.flagLight : C.flagWorn));
    }
    ctx.strokeStyle = frost(C.joint);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < FLAGS; k++) {
      ctx.moveTo(k * FLAG, 0);
      ctx.lineTo(k * FLAG, SIDE);
      ctx.moveTo(0, k * FLAG);
      ctx.lineTo(SIDE, k * FLAG);
    }
    ctx.stroke();
  }
  // The rosette: an edging ring of darker stone, then rings of setts, rosy and light by turns,
  // and a granite apron right round the rim.
  disc(ROSETTE.edge, frost(C.ringEdge));
  ROSETTE.rings.forEach((radius, k) => disc(radius, frost(k % 2 ? C.settB : C.settA)));
  disc(ROSETTE.apron, frost(C.apron));
  if (fine) {
    // Each ring's setts: a dashed stroke as wide as the ring, one joint every sett, every other
    // ring half a sett round so the joints break bond.
    const bounds = [...ROSETTE.rings, ROSETTE.apron, RIM_OUT * PX];
    ctx.strokeStyle = frost(C.settJoint);
    for (let k = 0; k < bounds.length - 1; k++) {
      const outer = bounds[k],
        inner = bounds[k + 1];
      const mid = (outer + inner) / 2;
      const count = Math.round((TAU * mid) / 6.5);
      const step = (TAU * mid) / count;
      ctx.lineWidth = outer - inner;
      ctx.setLineDash([1, step - 1]);
      ctx.lineDashOffset = k % 2 ? step / 2 : 0;
      ctx.beginPath();
      ctx.arc(FC.u, FC.w, mid, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const radius of bounds.slice(0, -1)) {
      ctx.moveTo(FC.u + radius, FC.w);
      ctx.arc(FC.u, FC.w, radius, 0, TAU);
    }
    ctx.stroke();
  }
  // The border: a kerb, a course of rose brick soldiers, a light band, and a stone at each
  // corner of the course.
  const { kerb: K, brick: B, band: L } = BORDER;
  const kerb = frost(C.kerb);
  r(0, 0, SIDE, K, kerb);
  r(0, SIDE - K, SIDE, K, kerb);
  r(0, K, K, SIDE - 2 * K, kerb);
  r(SIDE - K, K, K, SIDE - 2 * K, kerb);
  const brick = frost(C.brick);
  r(K, K, SIDE - 2 * K, B, brick);
  r(K, SIDE - K - B, SIDE - 2 * K, B, brick);
  r(K, K + B, B, SIDE - 2 * K - 2 * B, brick);
  r(SIDE - K - B, K + B, B, SIDE - 2 * K - 2 * B, brick);
  const band = frost(C.band);
  const I = K + B;
  r(I, I, SIDE - 2 * I, L, band);
  r(I, SIDE - I - L, SIDE - 2 * I, L, band);
  r(I, I + L, L, SIDE - 2 * I - 2 * L, band);
  r(SIDE - I - L, I + L, L, SIDE - 2 * I - 2 * L, band);
  if (fine) {
    // The soldiers' joints, one every 5 units along each side; the kerb's outer arris.
    ctx.strokeStyle = frost(C.brickJoint);
    ctx.lineWidth = B;
    ctx.setLineDash([1, 4]);
    ctx.lineDashOffset = 0;
    ctx.beginPath();
    const m = K + B / 2;
    ctx.moveTo(I, m);
    ctx.lineTo(SIDE - I, m);
    ctx.moveTo(I, SIDE - m);
    ctx.lineTo(SIDE - I, SIDE - m);
    ctx.moveTo(m, I);
    ctx.lineTo(m, SIDE - I);
    ctx.moveTo(SIDE - m, I);
    ctx.lineTo(SIDE - m, SIDE - I);
    ctx.stroke();
    ctx.setLineDash([]);
    r(0, SIDE - 1, SIDE, 1, frost(C.kerbEdge));
    r(SIDE - 1, 0, 1, SIDE, frost(C.kerbEdge));
  }
  const corner = frost(C.corner);
  for (const [u, w] of [
    [K, K],
    [SIDE - I, K],
    [K, SIDE - I],
    [SIDE - I, SIDE - I],
  ])
    r(u, w, B, B, corner);
  // The shadows of everything that stays: the fountain, the benches and the planters.
  const shadow = C.shadow[n];
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(FC.u + 3, FC.w + 3, RIM_OUT * PX + 1, 0, TAU);
  for (const planter of SQUARE_PLANTERS) {
    const { r: radius } = PLANTER[planter.kind];
    const u = (planter.x - G.left) * PX + 2,
      w = (planter.y - G.top) * PX + 2;
    ctx.moveTo(u + radius * PX + 1, w);
    ctx.arc(u, w, radius * PX + 1, 0, TAU);
  }
  ctx.fill();
  for (const bench of SQUARE_BENCHES) {
    const a = bench.along === 'x' ? bench.x : bench.y;
    const s0 = (a - (bench.along === 'x' ? G.left : G.top)) * PX;
    const n0 =
      ((bench.along === 'x' ? bench.y : bench.x) - (bench.along === 'x' ? G.top : G.left)) * PX;
    const from = n0 + BENCH.back * PX,
      depth = (BENCH.seatFront - BENCH.back) * PX + 3;
    if (bench.along === 'x') r(s0 + 1, from + 1, bench.length * PX + 2, depth, shadow);
    else r(from + 1, s0 + 1, depth, bench.length * PX + 2, shadow);
  }
  if (snowy) {
    // Drifts against the kerbs, settling and thawing each on its own day.
    const top = SNOW.top[n];
    for (const drift of DRIFTS) {
      if (snowAt(groundDay, drift.s) <= 0.5) continue;
      for (const [u, w, a, b] of drift.rects)
        if (a > 0 && b > 0 && clearOfFountain(u, w)) r(u, w, a, b, top);
    }
  }
  ctx.restore();
  // Litter, square to the screen like the lawns' tufts: the town's leaves, blown in through the
  // second half of autumn until the snow covers them, and the planter tree's own.
  const tree = SQUARE_PLANTERS.find((planter) => planter.kind === 'tree');
  const canopy = canopyAt(groundDay, TREE_S, TREE_KIND);
  const fill = (x: number, y: number, w: number, h: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  };
  for (const leaf of LEAVES)
    if (
      groundDay >= AUTUMN + 12 + Math.floor(leaf.when * 12) &&
      groundDay < WINTER + 2 &&
      snowAt(groundDay, leaf.when) <= 0.5
    )
      fill(leaf.x, leaf.y, leaf.w, leaf.h, pick(leaf.colour, night));
  if (tree) {
    const foot = project(tree.x, tree.y);
    const leaves = Math.round(canopy.leaves * (1 - canopy.snow) * UNDER_TREE.length);
    const petals = Math.round(canopy.petals * UNDER_TREE.length);
    for (let k = 0; k < Math.max(leaves, petals); k++) {
      const [dx, dy] = UNDER_TREE[k];
      const colour =
        petals > leaves
          ? k % 3
            ? BLOSSOM.pink
            : BLOSSOM.deep
          : FALLEN_LEAVES[(k + 1) % FALLEN_LEAVES.length];
      fill(Math.round(foot.x + dx), Math.round(foot.y + dy), 2, 1, pick(colour, night));
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Upright stone: cylinders lit from the left, as the houses' walls are.

/** The front of an upright cylinder, between `h0` and `h1` px up, in three tones. */
function cylinder(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  h0: number,
  h1: number,
  [lit, mid, shade]: readonly [string, string, string],
  bands: 2 | 3 = 3,
) {
  const band = (t0: number, t1: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(x, y - h1, rx, ry, 0, t0, t1);
    ctx.ellipse(x, y - h0, rx, ry, 0, t1, t0, true);
    ctx.fill();
  };
  if (bands === 2) {
    // A small one: lit and shaded halves, a little right of the middle.
    const turn = Math.acos(0.2);
    band(0, turn, shade);
    band(turn, Math.PI, lit);
    return;
  }
  const right = Math.acos(0.35),
    left = Math.acos(-0.45);
  band(0, right, shade);
  band(right, left, mid);
  band(left, Math.PI, lit);
}
function ellipseFill(ctx: Ctx, x: number, y: number, rx: number, ry: number, colour: string) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}
/** A ring's opacity through its life: in over its first fifth, out over the rest, no pop. */
const swell = (age: number) => Math.min(1, age * 5) * (1 - age);
const tones = (n: 0 | 1, snow = 0) =>
  [C.stone[n], C.stoneMid[n], C.stoneShade[n]].map((colour) =>
    snow > 0 ? mixHex(colour, SNOW.shade[n], snow * 0.15) : colour,
  ) as [string, string, string];

// ---------------------------------------------------------------------------------------------
// The fountain.

function paintFountain(ctx: Ctx, minutes: number, night: boolean, snow: number) {
  const n = night ? 1 : 0;
  const x = FOOT.x,
    y = Math.round(FOOT.y);
  const out = radii(RIM_OUT),
    basin = radii(FOUNTAIN.basin),
    dish = radii(DISH.r),
    plinth = radii(PLINTH.r);
  const capped = (pair: Pair) => (snow > 0 ? mixHex(pair[n], SNOW.top[n], snow * 0.9) : pair[n]);
  // The basin's wall, its coping, and the far inside wall down to the water.
  cylinder(ctx, x, y, out.rx, out.ry, 0, RIM_H, tones(n, snow));
  ctx.strokeStyle = C.stoneDark[n];
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y - 3, out.rx, out.ry, 0, 0.12, Math.PI - 0.12);
  ctx.stroke();
  ellipseFill(ctx, x, y - RIM_H, out.rx, out.ry, capped(C.stoneTop));
  // The coping stones' joints, sixteen round the rim, and their faces' joints down the wall.
  ctx.save();
  ctx.transform(1, 0.5, -1, 0.5, x, y - RIM_H);
  const mid = ((RIM_OUT + FOUNTAIN.basin) / 2) * PX;
  ctx.strokeStyle = snow > 0.5 ? SNOW.shade[n] : C.stoneShade[n];
  ctx.lineWidth = (RIM_OUT - FOUNTAIN.basin) * PX;
  ctx.setLineDash([1, (TAU * mid) / 16 - 1]);
  ctx.lineDashOffset = 0;
  ctx.beginPath();
  ctx.arc(0, 0, mid, Math.PI / 4, Math.PI / 4 + TAU);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = C.stoneDark[n];
  for (let k = 0; k < 16; k++) {
    const t = Math.PI / 4 + (k * TAU) / 16;
    // The joint's outer end, from the plane's angle to the screen's.
    const sx = Math.cos(t) - Math.sin(t),
      sy = (Math.cos(t) + Math.sin(t)) / 2;
    if (sy <= 0.15) continue;
    const px = x + (sx * out.rx) / Math.SQRT2,
      py = y + (sy * out.ry * 2) / Math.SQRT2;
    ctx.fillRect(Math.round(px), Math.round(py - RIM_H + 1), 1, RIM_H - 1);
  }
  // The lit front edge of the coping.
  ctx.strokeStyle = capped(C.stoneLight);
  ctx.beginPath();
  ctx.ellipse(x, y - RIM_H, out.rx - 0.5, out.ry - 0.5, 0, Math.PI * 0.55, Math.PI * 0.98);
  ctx.stroke();
  ellipseFill(ctx, x, y - RIM_H, basin.rx, basin.ry, C.innerWall[n]);
  // The water: the basin's far wall shows above it, the rim's inner edge hides its front.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y - RIM_H, basin.rx, basin.ry, 0, 0, TAU);
  ctx.clip();
  const surface = y - WATER_H;
  ellipseFill(ctx, x, surface, basin.rx, basin.ry, C.water[n]);
  ellipseFill(ctx, x, surface + 1, basin.rx * 0.72, basin.ry * 0.72, C.waterDeep[n]);
  // The sky in the water along the far side, and a few still glints.
  ctx.fillStyle = C.waterLight[n];
  ctx.fillRect(Math.round(x - 30), Math.round(surface - basin.ry + 4), 16, 1);
  ctx.fillRect(Math.round(x + 12), Math.round(surface - basin.ry + 6), 10, 1);
  ctx.fillRect(Math.round(x - 44), Math.round(surface + 3), 6, 1);
  ctx.fillRect(Math.round(x + 38), Math.round(surface + 8), 8, 1);
  // Rings spreading from where the spill lands to the rim, two at a time, fading as they go.
  ctx.strokeStyle = C.waterLight[n];
  ctx.lineWidth = 1;
  const alpha = ctx.globalAlpha;
  for (let k = 0; k < 2; k++) {
    const age = (((minutes / 2.6 + k / 2) % 1) + 1) % 1;
    const r = radii(DISH.r + 0.08 + age * (FOUNTAIN.basin - DISH.r - 0.12));
    ctx.globalAlpha = alpha * 0.55 * swell(age);
    ctx.beginPath();
    ctx.ellipse(x, surface, r.rx, r.ry, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;
  ctx.restore();
  // The streams the dish spills: those behind the baluster first, those in front after it.
  const streams = (front: boolean) => {
    const list = STREAM_FALLS.filter((fall) => fall.front === front);
    // Pale glassy threads, and brighter beads running down them on the town minute.
    ctx.globalAlpha = alpha * 0.75;
    ctx.fillStyle = C.stream[n];
    for (const fall of list) ctx.fillRect(x + fall.x - 1, y + fall.top, 2, fall.land - fall.top);
    ctx.globalAlpha = alpha;
    beads(2, () => {
      for (const fall of list) {
        ctx.moveTo(x + fall.x, y + fall.top);
        ctx.lineTo(x + fall.x, y + fall.land);
      }
    });
    // A little splash where each lands, and in front a ring opening from it, by turns.
    ctx.fillStyle = C.spray[n];
    for (const fall of list) ctx.fillRect(x + fall.x - 2, Math.round(y + fall.land) - 1, 4, 1);
    if (!front) return;
    ctx.strokeStyle = C.waterLight[n];
    ctx.lineWidth = 1;
    for (const phase of [0, 1]) {
      const age = (((minutes / 1.3 + phase / 2) % 1) + 1) % 1;
      ctx.globalAlpha = alpha * 0.5 * swell(age);
      ctx.beginPath();
      list.forEach((fall, k) => {
        if (k % 2 !== phase) return;
        ctx.moveTo(x + fall.x + 2 + age * 6, y + fall.land);
        ctx.ellipse(x + fall.x, y + fall.land, 2 + age * 6, 1 + age * 3, 0, 0, TAU);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;
  };
  /** Bright beads, 2 px on and 5 off, running along a path at 26 px a town minute. */
  const beads = (width: number, path: () => void) => {
    ctx.save();
    ctx.strokeStyle = C.spray[n];
    ctx.lineWidth = width;
    ctx.setLineDash([2, 5]);
    ctx.lineDashOffset = -((minutes * 26) % 7);
    ctx.beginPath();
    path();
    ctx.stroke();
    ctx.restore();
  };
  streams(false);
  // The plinth in the water, the baluster, and the dish.
  cylinder(ctx, x, y, plinth.rx, plinth.ry, WATER_H - 1, PLINTH.top, tones(n), 2);
  ellipseFill(ctx, x, y - PLINTH.top, plinth.rx, plinth.ry, capped(C.stoneTop));
  const [lit, mid2, shade] = tones(n);
  const shaft = (top: number, bottom: number, half: number) => {
    ctx.fillStyle = lit;
    ctx.fillRect(x - half, y - top, half * 2, top - bottom);
    ctx.fillStyle = mid2;
    ctx.fillRect(x, y - top, 2, top - bottom);
    ctx.fillStyle = shade;
    ctx.fillRect(x + 2, y - top, half - 2, top - bottom);
  };
  // The baluster: a foot, a swell and a neck under the dish.
  shaft(31, PLINTH.top, 3);
  shaft(13, PLINTH.top, 5);
  shaft(22, 15, 5);
  shaft(21, 16, 6);
  ctx.fillStyle = capped(C.stoneTop);
  ctx.fillRect(x - 5, y - 14, 10, 1);
  ctx.fillRect(x - 6, y - 22, 12, 1);
  ctx.fillStyle = C.stoneDark[n];
  ctx.fillRect(x - 3, y - 26, 6, 1);
  // The dish's underside, its lip, its stone top and the water in it.
  const lip = y - DISH.top + DISH.band;
  ctx.fillStyle = C.stoneShade[n];
  ctx.beginPath();
  ctx.ellipse(x, lip, dish.rx, dish.ry, 0, 0, Math.PI);
  ctx.ellipse(x, lip - 2, dish.rx * 0.7, dish.ry * 0.7, 0, Math.PI, 0, true);
  ctx.fill();
  cylinder(ctx, x, y, dish.rx, dish.ry, DISH.top - DISH.band, DISH.top, tones(n, snow), 2);
  ellipseFill(ctx, x, y - DISH.top, dish.rx, dish.ry, capped(C.stoneTop));
  const pool = radii(DISH.r - 0.08);
  ellipseFill(ctx, x, y - DISH.top + 1, pool.rx, pool.ry, C.water[n]);
  ctx.fillStyle = C.waterLight[n];
  ctx.fillRect(x - 14, y - DISH.top - 3, 8, 1);
  ctx.fillRect(x + 6, y - DISH.top + 4, 6, 1);
  // The finial: a short stem and a knob, the jet rising from it and falling back into the dish.
  const knob = DISH.top + 8;
  ctx.fillStyle = lit;
  ctx.fillRect(x - 2, y - knob, 4, knob - DISH.top + 1);
  ctx.fillRect(x - 3, y - knob - 4, 6, 4);
  ctx.fillStyle = shade;
  ctx.fillRect(x + 1, y - knob, 1, knob - DISH.top + 1);
  ctx.fillRect(x + 1, y - knob - 4, 2, 4);
  ctx.fillStyle = capped(C.stoneTop);
  ctx.fillRect(x - 1, y - knob - 6, 2, 2);
  const crown = y - FOUNTAIN_HEIGHT + 1;
  const arcs = () => {
    for (const side of [-1, 1]) {
      ctx.moveTo(x + side, crown);
      ctx.quadraticCurveTo(x + side * 10, crown - 2, x + side * 15, y - DISH.top);
    }
  };
  ctx.globalAlpha = alpha * 0.75;
  ctx.fillStyle = C.stream[n];
  ctx.fillRect(x - 1, crown, 2, knob + 6 - FOUNTAIN_HEIGHT + 1);
  ctx.strokeStyle = C.stream[n];
  ctx.lineWidth = 1;
  ctx.beginPath();
  arcs();
  ctx.stroke();
  ctx.globalAlpha = alpha;
  beads(2, () => {
    ctx.moveTo(x, y - knob - 6);
    ctx.lineTo(x, crown);
  });
  beads(1, arcs);
  streams(true);
}

// ---------------------------------------------------------------------------------------------
// The benches: oak slats on two green iron ends and a middle frame, seat 9 px up, facing the
// square and the viewer.

function paintBench(
  ctx: Ctx,
  bench: (typeof SQUARE_BENCHES)[number],
  night: boolean,
  snow: number,
) {
  const n = night ? 1 : 0;
  // Each part is painted flat in its own frame: u px along the bench, from its first end, and
  // up (an upright face `q` tiles out toward the sitters) or out (the level seat).
  const sx = bench.along === 'x' ? 1 : -1;
  const out = bench.facing === 'se' || bench.facing === 'sw' ? 1 : -1;
  const base = (q: number, h: number) =>
    bench.along === 'x' ? at(bench.x, bench.y + out * q, h) : at(bench.x + out * q, bench.y, h);
  const upright = (q: number, paint: () => void) => {
    const o = base(q, 0);
    ctx.save();
    ctx.transform(sx, 0.5, 0, 1, o.x, o.y);
    paint();
    ctx.restore();
  };
  const r = (u: number, v: number, w: number, h: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(u, v, w, h);
  };
  const L = bench.length * PX;
  const frames = [3, L / 2 - 1, L - 5];
  const alpha = ctx.globalAlpha;
  // The back: three iron uprights and two oak slats, the top one catching the light.
  upright(BENCH.back, () => {
    for (const u of frames) r(u, -BENCH.rail, 2, BENCH.rail, C.iron[n]);
    r(0, -14.5, L, 2.5, C.wood[n]);
    r(0, -18, L, 2.5, C.wood[n]);
    r(0, -18, L, 1, C.woodTop[n]);
    if (snow > 0) {
      ctx.globalAlpha = alpha * snow;
      r(0, -19.5, L, 1.5, SNOW.top[n]);
      ctx.globalAlpha = alpha;
    }
  });
  // The seat in two slats, level, BENCH.seat px up.
  const seat = base(BENCH.seatBack, BENCH.seat);
  const depth = (BENCH.seatFront - BENCH.seatBack) * PX;
  ctx.save();
  ctx.transform(sx, 0.5, -sx * out, 0.5 * out, seat.x, seat.y);
  r(0, 0, L, depth, C.woodTop[n]);
  r(0, depth / 2 - 0.5, L, 1, C.woodDark[n]);
  if (snow > 0) {
    ctx.globalAlpha = alpha * snow;
    r(2, 1, L - 4, depth - 2, SNOW.top[n]);
    ctx.globalAlpha = alpha;
  }
  ctx.restore();
  // The seat's front edge, and the front legs with a lit edge.
  upright(BENCH.seatFront, () => {
    r(0, -BENCH.seat, L, 2, C.wood[n]);
    for (const u of frames) {
      r(u, -BENCH.seat + 2, 2, BENCH.seat - 2, C.iron[n]);
      r(u, -BENCH.seat + 2, 1, 2, C.ironLight[n]);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// The planters: round stone tubs, a tree in the back corner, flowers at the sides.

function paintPlanter(
  ctx: Ctx,
  planter: (typeof SQUARE_PLANTERS)[number],
  night: boolean,
  season: TownSeason,
  foliage: Foliage,
  snow: number,
) {
  const n = night ? 1 : 0;
  const size = PLANTER[planter.kind];
  const foot = project(planter.x, planter.y);
  const { rx, ry } = radii(size.r);
  const soil = radii(size.soil);
  cylinder(ctx, foot.x, foot.y, rx, ry, 0, size.h, tones(n, snow));
  // A moulded course near the foot and a lit lip.
  ctx.strokeStyle = C.stoneDark[n];
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(foot.x, foot.y - 3, rx, ry, 0, 0.15, Math.PI - 0.15);
  ctx.stroke();
  const capped = snow > 0 ? mixHex(C.stoneTop[n], SNOW.top[n], snow * 0.9) : C.stoneTop[n];
  ellipseFill(ctx, foot.x, foot.y - size.h, rx, ry, capped);
  ellipseFill(ctx, foot.x, foot.y - size.h + 0.5, soil.rx, soil.ry, C.soil[n]);
  const top = { x: foot.x, y: foot.y - size.h };
  if (planter.kind === 'tree') {
    drawTownTree(ctx, top.x, top.y + 1, 1, foliage, TREE_VARIANT, season);
    return;
  }
  // Each planter is replanted for the new season on a day of its own, a day or two in.
  const replanted = season.yearDay - replant(planter);
  const quarter = Math.floor((replanted + DAYS_PER_YEAR) / DAYS_PER_SEASON) % 4;
  const bed = BEDS[quarter];
  const r = (x: number, y: number, w: number, h: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(Math.round(top.x + x), Math.round(top.y + y), w, h);
  };
  ellipseFill(ctx, top.x, top.y - 1, soil.rx - 1, soil.ry, bed.leaf[n]);
  r(-11, -6, 22, 5, bed.leaf[n]);
  r(-8, -9, 16, 3, bed.leaf[n]);
  r(-4, -11, 8, 2, bed.leaf[n]);
  r(-10, -6, 6, 2, bed.light[n]);
  r(-7, -9, 5, 2, bed.light[n]);
  r(-3, -11, 3, 1, bed.light[n]);
  const spots = [
    [-9, -7],
    [-5, -10],
    [-1, -8],
    [3, -11],
    [6, -7],
    [-3, -5],
    [9, -5],
    [1, -4],
    [-12, -3],
  ];
  const flowers = quarter === 3 ? spots.slice(0, 4) : spots;
  flowers.forEach(([x, y], k) => {
    const colour = bed.flowers[k % bed.flowers.length];
    r(x + 1, y + 1, 2, 1, pick(colour, true));
    r(x, y, 2, 2, colour[n]);
  });
  if (snow > 0) {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * snow;
    r(-8, -10, 16, 2, SNOW.top[n]);
    r(-4, -12, 8, 1, SNOW.top[n]);
    r(-11, -7, 5, 1, SNOW.top[n]);
    r(6, -7, 5, 1, SNOW.top[n]);
    ctx.globalAlpha = alpha;
  }
}

// ---------------------------------------------------------------------------------------------
// The frame: the selection outline as floor paint, and the depth objects.

export type SquareScene = {
  minutes: number;
  night: boolean;
  season: TownSeason;
  /** Whether the square is selected or hovered: its ground is outlined, as the cinema's is. */
  selected: boolean;
  visible: Visible;
  /** The town's leaf tones for the planter tree, by day or night (render.ts's palette). */
  foliage: Foliage;
};

/** Paints the square's outline now, under everything, and returns its uprights for the sort. */
export function drawSquare(ctx: Ctx, scene: SquareScene): DepthObject[] {
  const { minutes, night, season, selected, visible, foliage } = scene;
  if (!squareInView(visible)) return [];
  if (selected) {
    ctx.save();
    ctx.strokeStyle = '#E6D398';
    ctx.lineWidth = 2;
    ctx.beginPath();
    BOX.corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  const objects: DepthObject[] = [];
  if (visible(FOOT, radii(RIM_OUT).rx + 2, FOUNTAIN_HEIGHT + 3, radii(RIM_OUT).ry + 2))
    objects.push({
      depth: FOUNTAIN_DEPTH,
      paint: () => paintFountain(ctx, minutes, night, snowAt(season.yearDay, 0.45)),
    });
  SQUARE_BENCHES.forEach((bench, k) => {
    const end =
      bench.along === 'y'
        ? at(bench.x, bench.y + bench.length)
        : at(bench.x + bench.length, bench.y);
    const start = at(bench.x, bench.y);
    if (!visible({ x: (start.x + end.x) / 2, y: Math.max(start.y, end.y) + 6 }, 48, 54, 4)) return;
    // Sorted at its back corner, so every sitter on it and every walker in front of it is drawn
    // over it; the road behind it is a whole tile away.
    const depth =
      bench.along === 'y' ? bench.x + BENCH.back + bench.y : bench.x + bench.y + BENCH.back;
    objects.push({
      depth,
      paint: () => paintBench(ctx, bench, night, snowAt(season.yearDay, 0.3 + k * 0.2)),
    });
  });
  SQUARE_PLANTERS.forEach((planter, k) => {
    const foot = project(planter.x, planter.y);
    const tall = planter.kind === 'tree' ? 50 : 24;
    if (!visible(foot, 24, tall, 10)) return;
    objects.push({
      depth: planter.x + planter.y,
      paint: () =>
        paintPlanter(ctx, planter, night, season, foliage, snowAt(season.yearDay, 0.4 + k * 0.15)),
    });
  });
  return objects;
}

// ---------------------------------------------------------------------------------------------
// Hits.

/** Whether a world-px point lands on something standing on a footprint, `from` to `to` px up. */
function standsOn(point: Point, to: number, inside: (ground: Point) => boolean, from = 0) {
  for (let h = from; h <= to; h += 2) if (inside(unproject(point.x, point.y + h))) return true;
  return false;
}
const within = (x: number, y: number, r: number) => (p: Point) => Math.hypot(p.x - x, p.y - y) <= r;
/** The jet's two falling arcs as drawn (paintFountain), sampled once, in px from the foot. */
const JET_ARCS: readonly Point[] = (() => {
  const crown = -FOUNTAIN_HEIGHT + 1,
    points: Point[] = [];
  for (const side of [-1, 1])
    for (let k = 0; k <= 12; k++) {
      const t = k / 12,
        u = 1 - t;
      points.push({
        x: u * u * side + 2 * u * t * side * 10 + t * t * side * 15,
        y: u * u * crown + 2 * u * t * (crown - 2) + t * t * -DISH.top,
      });
    }
  return points;
})();
/** Whether a world-px point is on the jet: its stem and knob, or within 2 px of a falling arc. */
function onJet(point: Point) {
  const dx = point.x - FOOT.x,
    dy = point.y - FOOT.y;
  if (Math.abs(dx) <= 3 && dy >= -FOUNTAIN_HEIGHT - 1 && dy <= -DISH.top) return true;
  return JET_ARCS.some((arc) => Math.hypot(dx - arc.x, dy - arc.y) <= 2);
}

/**
 * The depth of the frontmost of the square's uprights under a world-px point (the fountain, a
 * bench or a planter and its tree), or undefined. The paving itself is insideSquare's.
 */
export function squareObjectHit(point: Point): number | undefined {
  let depth: number | undefined;
  const take = (d: number) => (depth = depth === undefined ? d : Math.max(depth, d));
  if (
    standsOn(point, RIM_H, within(FOUNTAIN.x, FOUNTAIN.y, RIM_OUT)) ||
    standsOn(point, DISH.top, within(FOUNTAIN.x, FOUNTAIN.y, 0.16)) ||
    standsOn(point, DISH.top, within(FOUNTAIN.x, FOUNTAIN.y, DISH.r), DISH.top - DISH.band) ||
    onJet(point)
  )
    take(FOUNTAIN_DEPTH);
  for (const bench of SQUARE_BENCHES) {
    const along = bench.along === 'y';
    const lo = (along ? bench.x : bench.y) + BENCH.back,
      hi = (along ? bench.x : bench.y) + BENCH.seatFront;
    const a0 = along ? bench.y : bench.x,
      a1 = a0 + bench.length;
    const inside = (p: Point) => {
      const q = along ? p.x : p.y,
        s = along ? p.y : p.x;
      return q >= lo && q <= hi && s >= a0 && s <= a1;
    };
    if (standsOn(point, BENCH.rail, inside))
      take(along ? bench.x + BENCH.back + bench.y : bench.x + bench.y + BENCH.back);
  }
  // A planter's tub, then what grows in it as drawn: the tree's crown, or the bed of flowers.
  for (const planter of SQUARE_PLANTERS) {
    const size = PLANTER[planter.kind];
    const foot = project(planter.x, planter.y);
    const dx = Math.abs(point.x - foot.x);
    const growing =
      planter.kind === 'tree'
        ? dx <= 19 && point.y >= foot.y - 49 && point.y <= foot.y - 10
        : dx <= 12 && point.y >= foot.y - size.h - 12 && point.y <= foot.y - size.h;
    if (growing || standsOn(point, size.h, within(planter.x, planter.y, size.r)))
      take(planter.x + planter.y);
  }
  return depth;
}
