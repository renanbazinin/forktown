// Market Square (agent B, SPEC §4.1): six stalls, three per edge, with sage, rose or slate awnings
// by the day's market (never amber), crates on the farm's calendar, the handcart and the low pump,
// six scenery stallholders behind the counters, snow on the awnings in winter, and folded frames
// under roped canvas once it shuts. Render cap: 1,100 calls at 10:00 with 12 browsers, floor and
// objects (SPEC §6.6). No Math.random, Date.now or performance.now: everything runs on the clock.
//
// The square is paved in the cached ground layer (by night and the season's whole day), with a
// compass rose in its middle, the stones worn along the browsers' lanes, and the shadows of
// everything that never moves. While it trades, a little litter gathers in front of the stalls
// in the floor layer and is swept at noon. The stalls stand on its two back edges, the north and
// the west, their fronts to the camera. Each stall is one depth object, painted back to front: the
// frame, the striped awning over the back of the stall, the stallholder in front of it, then the
// counter and the day's display. The awning sits behind the stallholder on purpose: with a stall
// no taller than 28 px and a figure 31 px tall, an awning over their head would hide them.
//
// The day, by the town clock (one stall after another, in an order of the day's own):
//   07:10–07:30  the stallholders arrive, fold back the canvas and put up the frames
//   07:15–07:45  the awnings unroll, one at a time, two minutes each
//   07:32–07:58  the crates come off the handcart and onto the counters
//   08:00–11:30  open; the browsers come and go at their own hours
//   11:30–12:00  everything goes back on the cart, the awnings roll up, the frames fold under canvas
// Every change is a fade or a roll, slow enough that nothing flashes.
//
// What depends only on the day's market, the season's day and the night is worked out once and
// kept (`marketArt`): colours, each stall's display, the stallholders, the snow. A frame only
// places it and runs the clock.
import { DISTRICT_SPOTS, MARKET_GROUND, MARKET_PLOTS } from '../../lib/district-places';
import { marketKind, type MarketKind } from '../../lib/district-calendar';
import { stallOfSeat } from '../../lib/outings/market';
import type { Resident } from '../../lib/schema';
import { AUTUMN, SPRING, SUMMER, WINTER, snowAt, seedFraction } from '../../lib/seasons';
import { DAYS_PER_SEASON } from '../../lib/town-calendar';
import { hash, unproject, type Point } from '../../lib/world';
import type { DepthObject, DistrictPainter, DistrictScene } from '../district-art';
import { tint } from '../houses';
import { at, PX, TAU } from '../iso-paint';
import { drawResident } from '../residents';
import { FALLEN_LEAVES, mixHex, pick, PUMPKIN, SNOW, type Pair } from '../season-palette';

type Ctx = CanvasRenderingContext2D;
type Row = 'north' | 'west';
/** One rect in a painter's own frame. */
type Paint = (x: number, y: number, w: number, h: number, color: string) => void;

// ---------------------------------------------------------------------------------------------
// Palette: [day, night] pairs, muted like the rest of the town. Nothing here is a light, so none
// of it is amber; the awnings are sage, rose or slate on cream (SPEC §4.1).

const C = {
  sett: ['#DCD5BF', '#7F8B7D'],
  settAlt: ['#D3CBB2', '#788475'],
  settLight: ['#E3DDCA', '#859181'],
  joint: ['#C8BFA3', '#6E7A69'],
  worn: ['#CDC5AB', '#76826F'],
  kerb: ['#B9B195', '#5F6B5C'],
  kerbLight: ['#CEC7AE', '#6F7B6C'],
  ring: ['#CAC2A6', '#717D6E'],
  post: ['#86694B', '#4C4A40'],
  postLight: ['#A2825D', '#5A584C'],
  board: ['#B88D60', '#6B604F'],
  boardShade: ['#9A7550', '#5A5246'],
  boardTop: ['#CCA676', '#7A6F5A'],
  plank: ['#A07A52', '#5F5648'],
  // Oat canvas, a good shade under the paving so a shut stall never reads as a kerb or a bench.
  canvas: ['#B9AC8A', '#7D7B66'],
  canvasShade: ['#A69878', '#6E6C59'],
  canvasTop: ['#CFC3A2', '#8F8E78'],
  fold: ['#9C8F6E', '#636150'],
  hem: ['#85785A', '#555242'],
  rope: ['#94805E', '#57534A'],
  shadow: ['#3C5A3C29', '#0C1B1C38'],
  iron: ['#4F6659', '#36463F'],
  ironLight: ['#6F887A', '#4A5C54'],
  stone: ['#BDB6A0', '#6E786F'],
  stoneShade: ['#A39C86', '#5E675F'],
  stoneTop: ['#D0CAB5', '#7D877D'],
  water: ['#8FBBBC', '#3E6371'],
  waterLight: ['#B9D6D4', '#5D8590'],
  wheel: ['#5A4A3A', '#38352F'],
  cart: ['#A9824F', '#615848'],
  cartShade: ['#8C6A42', '#544C40'],
  cartTop: ['#C49C68', '#6F6553'],
  cartInside: ['#7C5E3C', '#4A443A'],
  tub: ['#9C7852', '#5A5246'],
  tubShade: ['#7E5F40', '#4A443B'],
  hoop: ['#5E5A50', '#3C3D37'],
  soil: ['#6A5440', '#3E3A33'],
  slate: ['#3D4A44', '#2A3532'],
  chalk: ['#E6E8DF', '#A9B0A8'],
} satisfies Record<string, Pair>;

/** Each market's awning: the stripe and the cream between. */
const AWNINGS: Record<MarketKind, { stripe: Pair; cream: Pair }> = {
  farmers: { stripe: ['#86A56E', '#4F6A57'], cream: ['#F1EBD6', '#9FA595'] },
  flowers: { stripe: ['#D08A94', '#7E5E66'], cream: ['#F3E9DD', '#A39D94'] },
  books: { stripe: ['#6E8396', '#45525E'], cream: ['#EEEADD', '#9C9F98'] },
};

// ---------------------------------------------------------------------------------------------
// Geometry. A stall runs along its row's axis `s` (x on the north edge, y on the west edge) and
// reaches toward the camera along `q`, tiles in from the square's edge (y 14 or x 54). Heights
// are px above the paving.

const G = MARKET_GROUND;
/** Tiles in from the edge: the back posts, the awning's front, the stallholder, the counter. */
const Q = { back: 0.08, awning: 0.34, holder: 0.47, counter: 0.58, front: 0.9, ground: 1.06 };
/** Px: the top rail, the awning's front edge, its hem, the counter top. */
const H = { rail: 26, edge: 23, hem: 3.5, counter: 12 };
const LEN = 1.5;
export type MarketStall = { k: number; row: Row; s0: number; s1: number };
/** Counter centres from the spots: two browsers to a stall (SPEC §2.3). */
export const MARKET_STALL_GEOMETRY: readonly MarketStall[] = [0, 1, 2, 3, 4, 5].map((k) => {
  const [a, b] = [DISTRICT_SPOTS.market[2 * k], DISTRICT_SPOTS.market[2 * k + 1]];
  const row: Row = k < 3 ? 'north' : 'west';
  const mid = row === 'north' ? (a.x + b.x) / 2 : (a.y + b.y) / 2;
  return { k, row, s0: mid - LEN / 2, s1: mid + LEN / 2 };
});
/** The counters' front line (SPEC §2.3: y 14.9 north, x 54.9 west). */
export const COUNTER_FRONT = { north: G.top + Q.front, west: G.left + Q.front } as const;
/** How high each piece stands, px: the stalls' awnings, the pump (SPEC §2.4). */
export const MARKET_HEIGHTS = { stall: H.rail + 1.5, pump: 23 } as const;

/** A point of a row's stall, `h` px up. */
const spot = (row: Row, s: number, q: number, h = 0) =>
  row === 'north' ? at(s, G.top + q, h) : at(G.left + q, s, h);
const tile = (row: Row, s: number, q: number): Point =>
  row === 'north' ? { x: s, y: G.top + q } : { x: G.left + q, y: s };
/** Screen px per px along a row's axis: down-right on the north edge, down-left on the west. */
const sx = (row: Row) => (row === 'north' ? 1 : -1);
/** An upright face along a row at depth q: `u` px along the row from `s`, `v` px down. */
function frame(ctx: Ctx, row: Row, s: number, q: number, h: number, paint: () => void) {
  const o = spot(row, s, q, h);
  ctx.save();
  ctx.transform(sx(row), 0.5, 0, 1, o.x, o.y);
  paint();
  ctx.restore();
}
/** A sheet reaching toward the camera from (s, q): `u` along the row, `w` along q, climbing `rise` px a px. */
function sheet(
  ctx: Ctx,
  row: Row,
  s: number,
  q: number,
  h: number,
  rise: number,
  paint: () => void,
) {
  const o = spot(row, s, q, h);
  const d = sx(row);
  ctx.save();
  ctx.transform(d, 0.5, -d, 0.5 - rise, o.x, o.y);
  paint();
  ctx.restore();
}
/** The face across a row at `s` (a stall's near end), `u` px toward the camera from `q`. */
function end(ctx: Ctx, row: Row, s: number, q: number, h: number, paint: () => void) {
  const o = spot(row, s, q, h);
  ctx.save();
  ctx.transform(-sx(row), 0.5, 0, 1, o.x, o.y);
  paint();
  ctx.restore();
}
const painter =
  (ctx: Ctx): Paint =>
  (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
/** Paints with the context's alpha scaled by `alpha`, and puts it back. */
function faded(ctx: Ctx, alpha: number, paint: () => void) {
  if (alpha <= 0) return;
  const before = ctx.globalAlpha;
  ctx.globalAlpha = before * Math.min(1, alpha);
  paint();
  ctx.globalAlpha = before;
}

/**
 * Where a stall sorts: behind the browsers at its counter and anyone on the lanes in front, in
 * front of the duck street and the west road behind it. A stall's screen box can only meet a
 * walker on the street behind with depth below s0 + 0.6 + front, and a browser or a lane walker
 * in front with depth above it, so the stall sorts at exactly that line.
 */
export const stallDepth = (stall: MarketStall) =>
  stall.s0 + 0.6 + (stall.row === 'north' ? COUNTER_FRONT.north : COUNTER_FRONT.west);

/** The handcart in the north-west corner (SPEC §4.1): along y, its wheel to the east. */
export const MARKET_CART = { x0: 54.18, x1: 54.74, y0: 14.3, y1: 15.12, handle: 15.82 } as const;
/** The low pump in the open south-east corner, its trough on the camera's side. */
export const MARKET_PUMP = { x: 59.85, y: 19.55 } as const;
/** Two half-barrel tubs at the open corners, and the chalk board by the north-east way in. */
export const MARKET_TUBS: readonly Point[] = [
  { x: 60.72, y: 20.62 },
  { x: 57.3, y: 20.72 },
];
export const MARKET_BOARD = { x: 60.82, y: 15.12 } as const;
/** The rose of setts in the paving, in the middle of the open square, and its radius. */
export const MARKET_ROSE = { x: 58.05, y: 17.95, r: 1.05 } as const;

// ---------------------------------------------------------------------------------------------
// The clock: who is where at a town minute. Everything here is a pure function of the day and
// the minute.

/** Each stall's place in the day's order, 0..5: who arrives, unrolls and packs first. */
function dayOrder(day: number) {
  const ranked = [0, 1, 2, 3, 4, 5].sort(
    (a, b) => hash(`market-awning:${day}:${a}`) - hash(`market-awning:${day}:${b}`) || a - b,
  );
  const order: number[] = [];
  ranked.forEach((k, i) => (order[k] = i));
  return order;
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
/** 0 before `from`, 1 after `from + length`, eased between. */
const rise = (t: number, from: number, length: number) => ease((t - from) / length);

/** Minutes of each step, from the stall's place in the day's order. */
export function stallTimes(day: number, k: number) {
  const whole = Math.floor(day);
  const n = dayOrder(whole)[k];
  const jitter = (hash(`market-awning:${whole}:${k}`) % 3) * 0.5;
  return {
    /** The stallholder fades in over 3 minutes and puts the frame up. */
    arrive: 430 + n * 3.2,
    /** The awning unrolls over 2 minutes; its roll fades in the minute before. */
    unroll: 435 + n * 5 + jitter,
    /** The first crate goes on the counter; the rest follow 2.3 minutes apart. */
    stock: 452 + n * 2,
    /** The first crate goes back on the cart; the rest follow 1.6 minutes apart. */
    pack: 690 + n * 1.5,
    /** The awning rolls up over 2 minutes, then the frame folds and the stallholder leaves. */
    rollUp: 694 + n * 4,
  };
}
export const MARKET_FADE = { holder: 3, cover: 2, roll: 1, awning: 2, item: 1 } as const;

export type StallMoment = {
  /** The stallholder's opacity. */
  holder: number;
  /** The canvas cover's opacity; the frame stands while it is off. */
  cover: number;
  /** The rolled awning's opacity, and how far it has unrolled. */
  roll: number;
  unrolled: number;
  /** Each display item's opacity, by its index in the stall's display. */
  item: (i: number) => number;
};
/** One stall at a town minute. */
export function stallAt(day: number, minutes: number, k: number): StallMoment {
  const t = minutes;
  const s = stallTimes(day, k);
  const F = MARKET_FADE;
  const done = s.rollUp + F.awning;
  return {
    holder: rise(t, s.arrive, F.holder) * (1 - rise(t, done + 1, F.holder)),
    cover: 1 - rise(t, s.arrive + 1.5, F.cover) * (1 - rise(t, done, F.cover)),
    roll: rise(t, s.unroll - F.roll, F.roll) * (1 - rise(t, done, F.roll)),
    unrolled: rise(t, s.unroll, F.awning) * (1 - rise(t, s.rollUp, F.awning)),
    item: (i) => rise(t, s.stock + i * 2.3, F.item) * (1 - rise(t, s.pack + i * 1.6, F.item)),
  };
}

// ---------------------------------------------------------------------------------------------
// The day's wares. Every item is drawn in a counter row's own frame, u px along the counter and
// standing on v = 0, and all are day colours: the display is only ever out by day.

type Item = { w: number; paint: (r: Paint, u: number) => void };
const W = {
  crate: '#9E774E',
  crateDark: '#765639',
  crateLight: '#BA9062',
  wicker: '#B48850',
  wickerDark: '#8E6A3C',
  zinc: '#9BA4A1',
  zincLight: '#C6CDC9',
  zincDark: '#7E8784',
  tray: '#4A433A',
  kraft: '#C4A274',
  kraftLight: '#D8BD90',
  kraftDark: '#A68658',
  stem: '#5E8A43',
  leaf: '#6E9A4A',
  leafLight: '#93B866',
  leafDark: '#4E7438',
  lid: '#F1EADB',
  lidShade: '#CFC8B8',
  gingham: '#C9545A',
  card: '#C9AE82',
  cardDark: '#A88D62',
  egg: '#F0E8D8',
  eggBrown: '#D7B28A',
  rib: '#B9773A',
  terracotta: '#BF714E',
  terracottaDark: '#9C5A3E',
  straw: '#C6AE78',
  bulb: '#DDCDAC',
  holly: '#3F6B46',
  berry: '#C23A3A',
  fir: '#46705A',
  firDark: '#33584A',
  ivy: '#5C8A50',
  twine: '#B7976A',
  pages: '#F1EADB',
  china: '#F4F1EA',
  chinaBlue: '#6A8AB4',
  horn: '#B49453',
  hornLight: '#D2B57A',
  hornDark: '#7E6638',
  record: '#34302D',
  frame: '#A9824F',
  spines: ['#7A4A3E', '#4E6A8A', '#6E8A5A', '#B38C55', '#8A5A7A', '#3F5A6A', '#C9B691'],
} as const;
/** Produce colours: body and highlight. */
const F: Record<string, readonly [string, string]> = {
  apple: ['#C8463C', '#E07A66'],
  greenApple: ['#9DB858', '#C0D47E'],
  pear: ['#B7BE66', '#D3D88E'],
  tomato: ['#D2503E', '#EC8170'],
  strawberry: ['#C8364A', '#E26A7C'],
  cherry: ['#A8283E', '#D0566A'],
  plum: ['#6A3F6E', '#9A6C9E'],
  potato: ['#CDB284', '#DCC79E'],
  onion: ['#C48A4E', '#D9A86C'],
  squash: ['#D58F3E', '#E3A95E'],
  pumpkin: [PUMPKIN.body[0], '#D9A066'],
  cabbage: ['#8FB07E', '#B4CE9F'],
  redCabbage: ['#7A5A8E', '#A58AB8'],
  lettuce: ['#86B35E', '#A9CC7C'],
  radish: ['#D45A78', '#EE95A8'],
  carrot: ['#D97A3A', '#E99A5C'],
  beet: ['#7E3452', '#A65A7A'],
  parsnip: ['#E2D6B0', '#EFE7CF'],
  leek: ['#E6E3CF', '#5F8F4A'],
  rhubarb: ['#C2506A', '#6E9A4A'],
  courgette: ['#4E7E3E', '#7FA35A'],
  bean: ['#6E9A4A', '#93B866'],
};
/** Bloom colours for the flower stall's buckets. */
const B = {
  tulip: '#D4505A',
  pink: '#E58FA6',
  white: '#F4EFE6',
  purple: '#8E6AAE',
  daffodil: '#F2EE9E',
  mustard: '#D3B84E',
  iris: '#6A7FC4',
  sweetPea: '#D49CC6',
  lilac: '#B08ECF',
  rose: '#C9485E',
  cornflower: '#5E7FD0',
  lavender: '#9C8BB8',
  statice: '#C79EB4',
  hydrangea: '#B39FBC',
  geranium: '#C9485E',
} as const;

/**
 * A box in a counter's frame, `h` px tall and `d` deep: its end in shade, its top stepping back
 * a px at a time (in a counter's frame "back" is up and along), then its front.
 */
function box(
  r: Paint,
  u: number,
  w: number,
  h: number,
  d: number,
  [front, top, side]: readonly [string, string, string],
) {
  r(u + w, -h - d + 1, d, h + d - 1, side);
  for (let i = 1; i <= d; i++) r(u + i, -h - i, w, 1, top);
  r(u, -h, w, h, front);
}
/** A wooden crate heaped with round produce. */
const crate = ([fruit, light]: readonly [string, string], w = 14): Item => ({
  w,
  paint: (r, u) => {
    // The open top full of fruit, heaped a px higher toward the back, a glint here and there.
    box(r, u, w, 4, 3, [W.crate, fruit, W.crateDark]);
    r(u, -4, w, 1, W.crateLight);
    r(u + 3, -8, w - 4, 1, fruit);
    r(u + 2, -5, 2, 1, light);
    r(u + w - 4, -6, 2, 1, light);
    r(u + w / 2, -8, 1, 1, light);
  },
});
/** A wicker basket of produce, lower than a crate. */
const basket = ([fruit, light]: readonly [string, string], w = 12): Item => ({
  w,
  paint: (r, u) => {
    box(r, u, w, 4, 3, [W.wicker, fruit, W.wickerDark]);
    r(u + 1, -2, w - 2, 1, W.wickerDark);
    r(u + 3, -8, w - 5, 1, fruit);
    r(u + 2, -5, 2, 1, light);
    r(u + 6, -7, 2, 1, light);
  },
});
/** Bunches laid with their leafy tops: radishes, carrots, beets, parsnips. */
const bunch = ([root, light]: readonly [string, string], w = 12): Item => ({
  w,
  paint: (r, u) => {
    r(u, -3, w - 3, 3, root);
    r(u + 1, -3, 2, 1, light);
    r(u + w - 5, -6, 5, 4, W.leaf);
    r(u + w - 4, -7, 3, 1, W.leafLight);
  },
});
/** Heads of lettuce or cabbage, side by side. */
const heads = ([body, light]: readonly [string, string], w = 13): Item => ({
  w,
  paint: (r, u) => {
    // Two round heads: a darker cup of outer leaves round the foot, a pale heart on top.
    r(u, -4, 6, 4, body);
    r(u + 1, -5, 4, 1, body);
    r(u + 6, -5, 7, 5, body);
    r(u + 7, -6, 5, 1, body);
    r(u, -1, 13, 1, tint(body, -22));
    r(u + 1, -5, 3, 2, light);
    r(u + 8, -6, 3, 2, light);
  },
});
/** Long things laid in a row: leeks, rhubarb, courgettes, beans. */
const sticks = ([body, tip]: readonly [string, string], w = 12): Item => ({
  w,
  paint: (r, u) => {
    r(u, -3, w - 3, 3, body);
    r(u + 1, -4, w - 5, 1, body);
    r(u + w - 4, -5, 4, 3, tip);
  },
});
/** Punnets of berries. */
const punnets = ([fruit, light]: readonly [string, string], w = 11): Item => ({
  w,
  paint: (r, u) => {
    box(r, u, w, 3, 2, [W.lid, fruit, W.lidShade]);
    r(u + 2, -6, 3, 1, fruit);
    r(u + 7, -6, 3, 1, fruit);
    r(u + 3, -5, 1, 1, light);
    r(u + 5, -3, 1, 3, W.leaf);
  },
});
/** Squash or pumpkins, round and ribbed. */
const gourds = ([body, light]: readonly [string, string], w = 14): Item => ({
  w,
  paint: (r, u) => {
    // Two round squashes, side by side: shade round the foot, a rib down the bigger, a glint on
    // each and a stalk.
    const shade = tint(body, -26);
    r(u, -4, 7, 4, body);
    r(u + 1, -5, 5, 1, body);
    r(u + 7, -6, 7, 6, body);
    r(u + 8, -7, 5, 1, body);
    r(u, -1, 14, 1, shade);
    r(u + 10, -6, 1, 5, shade);
    r(u + 1, -4, 2, 1, light);
    r(u + 8, -6, 2, 1, light);
    r(u + 10, -8, 1, 1, W.stem);
  },
});
const eggs = (w = 11): Item => ({
  w,
  paint: (r, u) => {
    box(r, u, w, 3, 3, [W.card, W.egg, W.cardDark]);
    r(u + 3, -5, 2, 1, W.eggBrown);
    r(u + 7, -6, 2, 1, W.eggBrown);
    r(u + 4, -6, 2, 1, W.egg);
  },
});
const tray = (w = 12): Item => ({
  w,
  paint: (r, u) => {
    box(r, u, w, 3, 3, [W.tray, W.leaf, W.tray]);
    r(u + 2, -6, 2, 1, W.leafLight);
    r(u + 6, -7, 2, 1, W.leafLight);
    r(u + 10, -6, 2, 1, W.leafLight);
  },
});
/** Jars of jam, chutney and plum with cloth lids. */
const jars = (w = 12): Item => ({
  w,
  paint: (r, u) => {
    r(u, -5, 3, 5, '#A8364A');
    r(u + 4, -6, 4, 6, '#8A7A3A');
    r(u + 9, -5, 3, 5, '#6A3F6E');
    r(u, -6, 3, 1, W.gingham);
    r(u + 4, -7, 4, 1, W.lid);
    r(u + 9, -6, 3, 1, W.gingham);
  },
});
/** A zinc bucket of cut stems, blooms in three colours. */
const bucket = (blooms: readonly string[], w = 10): Item => ({
  w,
  paint: (r, u) => {
    r(u + 1, -6, w - 2, 6, W.zinc);
    r(u + 1, -6, w - 2, 1, W.zincLight);
    r(u + 1, -2, w - 2, 1, W.zincDark);
    r(u + 1, -10, w - 2, 4, W.stem);
    blooms.forEach((bloom, i) => r(u + i * 3, -12 + (i % 2), 4, 2, bloom));
  },
});
/** A clay pot with a plant, flowering or not. */
const pot = (green: string, flower?: string, w = 8): Item => ({
  w,
  paint: (r, u) => {
    r(u + 1, -5, w - 2, 5, W.terracotta);
    r(u, -6, w, 1, W.terracottaDark);
    r(u, -10, w, 4, green);
    if (flower) r(u + 2, -11, 4, 2, flower);
  },
});
/** A little fir in a pot. */
const fir = (w = 10): Item => ({
  w,
  paint: (r, u) => {
    r(u + 3, -4, 4, 4, W.terracotta);
    r(u, -8, w, 4, W.fir);
    r(u + 2, -12, w - 4, 4, W.fir);
    r(u + 4, -14, 2, 2, W.firDark);
  },
});
/** Paper bags of bulbs, a bulb's tip showing from each. */
const bulbs = (w = 12): Item => ({
  w,
  paint: (r, u) => {
    r(u, -6, 5, 6, W.kraft);
    r(u + 6, -5, 6, 5, W.kraftDark);
    r(u, -6, 5, 1, W.kraftLight);
    r(u + 1, -7, 3, 1, W.bulb);
    r(u + 8, -6, 2, 1, W.bulb);
  },
});
/** Bunches of dried flowers laid on the counter. */
const dried = (head: string, w = 12): Item => ({
  w,
  paint: (r, u) => {
    r(u, -3, w - 4, 2, W.straw);
    r(u + w - 5, -5, 5, 4, head);
    r(u + 2, -4, 3, 2, B.statice);
  },
});
/** A wreath lying on the counter: green round, berries and a bow. */
const wreath = (green: string, w = 11): Item => ({
  w,
  paint: (r, u) => {
    r(u, -4, w, 4, green);
    r(u + 2, -5, w - 4, 1, green);
    r(u + 3, -3, w - 6, 2, W.crateDark);
    r(u + 1, -4, 1, 1, W.berry);
    r(u + w - 3, -5, 2, 1, W.berry);
  },
});
/** Bundles of fir tied with twine. */
const bundles = (w = 13): Item => ({
  w,
  paint: (r, u) => {
    r(u, -4, w, 4, W.fir);
    r(u + 1, -5, w - 3, 1, W.firDark);
    r(u + 3, -4, 1, 4, W.twine);
    r(u + 9, -4, 1, 4, W.twine);
  },
});
/** A box of paperbacks, spines up. */
const paperbacks = (seed: number, w = 14): Item => ({
  w,
  paint: (r, u) => {
    box(r, u, w, 5, 2, [W.card, W.cardDark, W.cardDark]);
    r(u, -2, w, 1, W.cardDark);
    for (let i = 0; i < 4; i++)
      r(
        u + 1 + i * 3.2,
        -8 - ((seed >>> i) & 1),
        3,
        3 + ((seed >>> i) & 1),
        W.spines[(seed + i) % 7],
      );
  },
});
/** A stack of hardbacks, page edges out. */
const stack = (seed: number, w = 11): Item => ({
  w,
  paint: (r, u) => {
    r(u, -3, w, 3, W.spines[seed % 7]);
    r(u + 1, -5, w - 1, 2, W.spines[(seed + 3) % 7]);
    r(u, -8, w - 2, 3, W.spines[(seed + 5) % 7]);
    r(u + w - 2, -3, 1, 3, W.pages);
    r(u + w - 3, -8, 1, 3, W.pages);
  },
});
/** Teacups on saucers, and a teapot. */
const teacups = (w = 14): Item => ({
  w,
  paint: (r, u) => {
    r(u, -1, 5, 1, W.china);
    r(u + 1, -4, 3, 3, W.china);
    r(u + 1, -3, 3, 1, W.chinaBlue);
    r(u + 7, -6, 6, 6, W.china);
    r(u + 8, -7, 4, 1, W.chinaBlue);
    r(u + 13, -5, 1, 2, W.china);
  },
});
/** The gramophone: a little box and its flared horn (SPEC §4.1). */
const gramophone = (w = 17): Item => ({
  w,
  paint: (r, u) => {
    // The case and its turntable, the arm rising to the horn, the bell flaring open.
    r(u, -5, 9, 5, W.crateDark);
    r(u, -6, 9, 1, W.crate);
    r(u + 1, -7, 6, 1, W.record);
    r(u + 7, -10, 2, 4, W.hornDark);
    r(u + 8, -12, 3, 2, W.horn);
    r(u + 9, -14, 5, 2, W.horn);
    r(u + 10, -18, 7, 4, W.hornLight);
    r(u + 12, -17, 4, 2, W.hornDark);
  },
});
const records = (w = 12): Item => ({
  w,
  paint: (r, u) => {
    // Records on their edges in a crate, a sleeve or two standing out.
    box(r, u, w, 5, 3, [W.crate, W.record, W.crateDark]);
    r(u + 1, -8, w - 2, 2, W.record);
    r(u + 3, -8, 2, 2, F.apple[1]);
    r(u + 7, -9, 2, 2, W.chinaBlue);
    r(u, -5, w, 1, W.crateLight);
  },
});
const picture = (w = 9): Item => ({
  w,
  paint: (r, u) => {
    r(u, -11, w, 11, W.frame);
    r(u + 1, -10, w - 2, 9, '#B4CE9F');
    r(u + 2, -6, w - 4, 4, W.leaf);
  },
});

/** The item behind each name of a display spec (books take a seed from their place). */
export function item(name: string, seed: number): Item {
  const stems: Record<string, readonly string[]> = {
    tulips: [B.tulip, B.pink, B.tulip],
    daffodils: [B.daffodil, B.mustard, B.daffodil],
    whites: [B.white, B.purple, B.white],
    irises: [B.iris, B.white, B.iris],
    sweetpeas: [B.sweetPea, B.lilac, B.pink],
    roses: [B.rose, B.white, B.rose],
    cornflowers: [B.cornflower, B.white, B.cornflower],
    pinks: [B.pink, B.sweetPea, B.white],
    holly: [W.berry, W.holly, W.berry],
    winterwhite: [B.white, W.fir, W.berry],
  };
  if (stems[name]) return bucket(stems[name]);
  const [kind, produce] = name.split(':');
  if (produce) {
    const colours = F[produce];
    if (kind === 'crate') return crate(colours);
    if (kind === 'basket') return basket(colours);
    if (kind === 'bunch') return bunch(colours);
    if (kind === 'heads') return heads(colours);
    if (kind === 'sticks') return sticks(colours);
    if (kind === 'punnets') return punnets(colours);
    if (kind === 'gourds') return gourds(colours);
    if (kind === 'pot') return pot(W.leaf, B[produce as keyof typeof B]);
    if (kind === 'dried') return dried(B[produce as keyof typeof B]);
    if (kind === 'wreath') return wreath(W[produce as 'fir' | 'holly' | 'ivy']);
  }
  const plain: Record<string, () => Item> = {
    eggs,
    tray,
    jars,
    herbs: () => pot(W.leafLight),
    bulbs,
    bundles,
    fir,
    teacups,
    gramophone,
    records,
    picture,
    paperbacks: () => paperbacks(seed),
    stack: () => stack(seed),
  };
  return plain[name]();
}

/**
 * Each market's six stalls, by season, in the farm's own order through the year: a back row on
 * the counter, a front row, and anything stood on the paving in front ("back | front | ground").
 * The farmers' stalls change at the middle of each season, as the rows of the farm ripen.
 */
const WARES: Record<string, readonly string[]> = {
  'farmers:0:early': [
    'tray, tray, sticks:rhubarb | eggs, herbs | basket:potato',
    'heads:lettuce, sticks:rhubarb, tray | eggs, tray',
    'crate:potato, tray, heads:lettuce | herbs, eggs',
    'tray, heads:cabbage, tray | sticks:leek, herbs | crate:onion',
    'sticks:rhubarb, tray, crate:onion | eggs, tray',
    'heads:lettuce, crate:potato, tray | eggs, sticks:leek',
  ],
  'farmers:0:late': [
    'bunch:radish, heads:lettuce, bunch:radish | sticks:leek, eggs | basket:potato',
    'heads:lettuce, tray, heads:cabbage | bunch:radish, tray',
    'crate:potato, bunch:radish, sticks:rhubarb | eggs, sticks:leek',
    'tray, tray, heads:lettuce | herbs, herbs | crate:potato',
    'bunch:radish, sticks:leek, heads:lettuce | eggs, bunch:radish',
    'heads:cabbage, crate:potato, bunch:radish | sticks:rhubarb, eggs',
  ],
  'farmers:1:early': [
    'punnets:strawberry, punnets:strawberry, heads:lettuce | punnets:cherry, sticks:bean | basket:strawberry',
    'sticks:bean, heads:lettuce, punnets:strawberry | punnets:strawberry, eggs',
    'crate:potato, punnets:strawberry, sticks:bean | punnets:cherry, eggs | crate:potato',
    'heads:lettuce, heads:cabbage, bunch:carrot | sticks:bean, punnets:strawberry',
    'punnets:strawberry, crate:potato, punnets:strawberry | eggs, punnets:cherry',
    'bunch:carrot, sticks:bean, heads:lettuce | punnets:strawberry, eggs',
  ],
  'farmers:1:late': [
    'crate:tomato, crate:tomato, sticks:courgette | sticks:bean, punnets:plum | basket:tomato',
    'sticks:courgette, heads:lettuce, crate:tomato | punnets:plum, sticks:bean',
    'crate:potato, crate:tomato, heads:lettuce | sticks:courgette, eggs | crate:greenApple',
    'crate:tomato, sticks:bean, crate:pear | punnets:plum, eggs',
    'heads:lettuce, crate:tomato, sticks:courgette | sticks:bean, punnets:cherry',
    'crate:tomato, crate:potato, crate:tomato | eggs, sticks:bean',
  ],
  'farmers:2:early': [
    'crate:apple, crate:greenApple, crate:pear | gourds:squash | basket:apple',
    'gourds:squash, crate:apple, sticks:courgette | punnets:plum, jars',
    'crate:pear, crate:apple, crate:potato | bunch:carrot, gourds:squash | gourds:pumpkin',
    'crate:greenApple, gourds:squash, crate:tomato | jars, punnets:plum',
    'crate:apple, crate:onion, crate:greenApple | bunch:beet, jars | basket:pear',
    'gourds:squash, crate:pear, crate:apple | bunch:carrot, jars',
  ],
  'farmers:2:late': [
    'gourds:pumpkin, crate:potato, crate:onion | heads:cabbage, bunch:carrot | gourds:pumpkin',
    'crate:apple, gourds:squash, heads:redCabbage | bunch:beet, bunch:carrot',
    'crate:onion, heads:cabbage, crate:potato | gourds:squash | basket:apple',
    'gourds:pumpkin, crate:greenApple, crate:apple | bunch:carrot, jars',
    'crate:potato, heads:redCabbage, gourds:squash | bunch:beet, jars | gourds:pumpkin',
    'crate:apple, crate:onion, heads:cabbage | jars, bunch:carrot',
  ],
  'farmers:3:early': [
    'bunch:carrot, bunch:parsnip, bunch:beet | jars, heads:cabbage | crate:apple',
    'crate:apple, crate:greenApple, jars | bunch:carrot, jars',
    'crate:potato, bunch:beet, crate:onion | jars, bunch:parsnip | basket:potato',
    'heads:redCabbage, crate:apple, bunch:carrot | jars, sticks:leek',
    'jars, bunch:parsnip, crate:greenApple | bunch:beet, jars | crate:apple',
    'crate:apple, heads:cabbage, bunch:carrot | jars, bunch:parsnip',
  ],
  'farmers:3:late': [
    'jars, crate:apple, jars | bunch:parsnip, sticks:leek | crate:potato',
    'heads:redCabbage, crate:potato, bunch:beet | jars, sticks:leek',
    'crate:greenApple, jars, crate:onion | bunch:carrot, bunch:parsnip | basket:apple',
    'sticks:leek, heads:cabbage, jars | bunch:beet, jars',
    'crate:potato, crate:apple, heads:redCabbage | jars, bunch:carrot | crate:onion',
    'jars, bunch:parsnip, crate:apple | sticks:leek, jars',
  ],
  'flowers:0': [
    'tulips, daffodils, whites | tray, pot:tulip | irises',
    'daffodils, tray, irises | herbs, pot:pink',
    'whites, tulips, tray | tray, herbs | daffodils',
    'tray, irises, daffodils | pot:white, tray',
    'tulips, whites, irises | tray, herbs | tulips',
    'irises, tray, tulips | pot:pink, herbs',
  ],
  'flowers:1': [
    'sweetpeas, roses, cornflowers | tray, pot:geranium | pinks',
    'roses, tray, pinks | herbs, pot:geranium',
    'cornflowers, sweetpeas, tray | tray, herbs | roses',
    'tray, pinks, roses | pot:geranium, tray',
    'sweetpeas, cornflowers, pinks | tray, herbs | sweetpeas',
    'pinks, tray, sweetpeas | pot:geranium, herbs',
  ],
  'flowers:2': [
    'bulbs, bulbs, dried:lavender | dried:hydrangea, bulbs',
    'dried:statice, bulbs, dried:lavender | bulbs, dried:hydrangea',
    'bulbs, dried:hydrangea, bulbs | dried:lavender, bulbs | gourds:pumpkin',
    'dried:lavender, dried:statice, bulbs | bulbs, dried:statice',
    'bulbs, bulbs, dried:statice | dried:hydrangea, bulbs',
    'dried:hydrangea, bulbs, dried:lavender | bulbs, dried:hydrangea',
  ],
  'flowers:3': [
    'wreath:fir, wreath:holly, bundles | wreath:ivy, bundles | fir',
    'holly, bundles, wreath:fir | bundles, wreath:holly',
    'wreath:holly, winterwhite, wreath:fir | bundles, wreath:ivy | fir, fir',
    'bundles, wreath:fir, holly | wreath:holly, bundles',
    'wreath:ivy, wreath:fir, bundles | wreath:holly, bundles | fir',
    'winterwhite, wreath:holly, bundles | bundles, wreath:fir',
  ],
  books: [
    'paperbacks, paperbacks, stack | stack, teacups',
    'gramophone, records, stack | teacups, stack',
    'paperbacks, picture, paperbacks | stack, stack | records',
    'stack, paperbacks, records | teacups, stack',
    'paperbacks, paperbacks, records | stack, teacups | picture',
    'stack, records, paperbacks | stack, stack',
  ],
};
/** The cart's three loads, by the same keys. */
const LOADS: Record<string, string> = {
  'farmers:0': 'crate:potato, tray, crate:onion',
  'farmers:1': 'crate:tomato, punnets:strawberry, crate:potato',
  'farmers:2': 'crate:apple, gourds:pumpkin, crate:greenApple',
  'farmers:3': 'crate:apple, crate:potato, crate:onion',
  'flowers:0': 'tulips, tray, irises',
  'flowers:1': 'roses, tray, sweetpeas',
  'flowers:2': 'bulbs, bulbs, dried:lavender',
  'flowers:3': 'bundles, wreath:fir, bundles',
  books: 'paperbacks, paperbacks, records',
};
const seasonOf = (groundDay: number) =>
  groundDay >= WINTER ? 3 : groundDay >= AUTUMN ? 2 : groundDay >= SUMMER ? 1 : 0;
/** The wares' key for a market on a season's day. */
export function waresKey(kind: MarketKind, groundDay: number) {
  if (kind === 'books') return 'books';
  const season = seasonOf(groundDay);
  if (kind === 'flowers') return `flowers:${season}`;
  return `farmers:${season}:${groundDay % DAYS_PER_SEASON >= 14 ? 'late' : 'early'}`;
}
const parse = (spec: string, seed: number) =>
  spec
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, i) => item(name, hash(`market-ware:${seed}:${i}`)));

/** How tall an item stands, in its own px. */
export function itemHeight(ware: Item) {
  let top = 0;
  ware.paint((_x, y) => (top = Math.min(top, y)), 0);
  return -top;
}
/**
 * The back row with its lowest piece in the middle, where the stallholder stands behind it: the
 * taller crates, buckets and the gramophone's horn keep to the ends, clear of their face.
 */
function middleLow(list: Item[]) {
  if (list.length < 3) return list;
  const low = list.reduce((a, b) => (itemHeight(b) < itemHeight(a) ? b : a));
  const rest = list.filter((ware) => ware !== low);
  return [rest[0], low, ...rest.slice(1)];
}

type Display = { back: Item[]; front: Item[]; ground: Item[] };
type Holder = { look: Resident; apron: string; offset: number };
export type MarketArt = {
  key: string;
  kind: MarketKind;
  wares: string;
  stripe: string;
  cream: string;
  stripeShade: string;
  creamShade: string;
  /** Snow on each stall's awning or cover (0–5), the cart (6) and the pump (7). */
  snow: number[];
  displays: Display[];
  holders: Holder[];
  cart: Item[];
};

/** The stallholders: scenery, never residents. Dressed for the day's trade. */
const SKINS = ['#E6C4AC', '#C99A78', '#8D5A3F', '#F1D0B5', '#B07A55', '#6F4632'];
const HAIRS = ['#3B2A22', '#7A4E2D', '#B9AE98', '#2D2A28', '#A4532F', '#D8CDB4'];
const OUTFITS: Record<MarketKind, readonly string[]> = {
  farmers: ['#6F8A5E', '#9A6B4E', '#5E7A99', '#8C8A5A', '#7D6A8A', '#4F6F68'],
  flowers: ['#9C6F86', '#6F8A9C', '#8E9A6A', '#B07A6A', '#6A7D6F', '#8A7AA0'],
  books: ['#5D6E80', '#7A5A4E', '#6B7A5A', '#8A6A80', '#4F5F5A', '#9A7F5E'],
};
function holdersFor(kind: MarketKind, groundDay: number): Holder[] {
  return [0, 1, 2, 3, 4, 5].map((k) => {
    const h = hash(`stallholder:${kind}:${groundDay % 7}:${k}`);
    const accessory: Resident['accessory'] =
      kind === 'books' && (h >>> 12) % 2 ? 'glasses' : (h >>> 13) % 3 === 0 ? 'hat' : 'none';
    return {
      look: {
        name: 'Stallholder',
        figure: h % 2 ? 'female' : 'male',
        skin: SKINS[(h >>> 3) % SKINS.length],
        hair: HAIRS[(h >>> 6) % HAIRS.length],
        outfit: OUTFITS[kind][(k + (h >>> 9)) % 6],
        accessory,
        greeting: 'Morning.',
        routine: { morning: 'work', afternoon: 'home', evening: 'home', night: 'sleep' },
      },
      apron: (h >>> 15) % 2 ? '#EDE6D2' : AWNINGS[kind].stripe[0],
      offset: (((h >>> 17) % 3) - 1) * 0.05,
    };
  });
}

const arts = new Map<string, MarketArt>();
/**
 * The market's art for a day: the same object for every minute of the day's market, by the
 * market's kind, the season's whole day and the night. A few days are kept, then made again.
 */
export function marketArt(day: number, groundDay: number, night: boolean): MarketArt {
  const kind = marketKind(day);
  const key = `${kind}:${groundDay}:${night}`;
  const kept = arts.get(key);
  if (kept) return kept;
  const awning = AWNINGS[kind];
  const wares = waresKey(kind, groundDay);
  // Stalls swap places from day to day.
  const shift = hash(`market-day:${groundDay}`) % 6;
  const specs = WARES[wares];
  const displays = specs.map((_, k) => {
    const [back = '', front = '', ground = ''] = specs[(k + shift) % 6].split('|');
    const seed = hash(`market-stall:${groundDay}:${k}`);
    return {
      back: middleLow(parse(back, seed)),
      front: parse(front, seed + 1),
      ground: parse(ground, seed + 2),
    };
  });
  // Snow settles by the season's day: the art changes once a day, like the ground.
  const snowDay = groundDay + 0.5;
  const art: MarketArt = {
    key,
    kind,
    wares,
    stripe: pick(awning.stripe, night),
    cream: pick(awning.cream, night),
    stripeShade: tint(pick(awning.stripe, night), -16),
    creamShade: tint(pick(awning.cream, night), -18),
    snow: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => snowAt(snowDay, seedFraction(`market-snow:${k}`))),
    displays,
    holders: holdersFor(kind, groundDay),
    cart: parse(LOADS[wares.split(':').slice(0, 2).join(':')], 7),
  };
  if (arts.size >= 8) arts.delete(arts.keys().next().value!);
  arts.set(key, art);
  return art;
}

// ---------------------------------------------------------------------------------------------
// Painting a stall.

/** Every figure in town is drawn at this scale (render.ts). */
const RESIDENT_SCALE = 1.25;
/** Wares are drawn a little larger than a figure's own px, so a stall reads at a glance. */
const WARE_SCALE = 1.3;

function paintStall(
  ctx: Ctx,
  stall: MarketStall,
  art: MarketArt,
  m: StallMoment,
  night: boolean,
  turned: boolean,
  detail: boolean,
) {
  const { row, s0, k } = stall;
  const r = painter(ctx);
  const n = night ? 1 : 0;
  const len = LEN * PX;
  const snow = art.snow[k];
  // The +y faces take the light and the +x faces the shade, as on every prop in town.
  const frontLit = row === 'north';
  // The frame stands while the canvas is off: two posts at the back carry the rail, two shorter
  // ones the awning's front edge.
  faded(ctx, 1 - m.cover, () => {
    for (const [s, q, h] of [
      [s0 + 0.04, Q.back, H.rail],
      [s0 + LEN - 0.04, Q.back, H.rail],
      [s0 + 0.04, Q.awning, H.edge],
      [s0 + LEN - 0.04, Q.awning, H.edge],
    ]) {
      const p = spot(row, s, q);
      r(p.x - 1, p.y - h, 2, h, C.post[n]);
    }
    if (m.unrolled < 1)
      frame(ctx, row, s0, Q.back, H.rail, () => r(0, -1.5, len, 1.5, C.postLight[n]));
  });
  // The awning, unrolled from the rail toward the camera: stripes across it, a scalloped hem.
  if (m.roll > 0)
    faded(ctx, m.roll, () => {
      const reach = Q.back + (Q.awning - Q.back) * m.unrolled;
      const edge = H.rail + (H.edge - H.rail) * m.unrolled;
      const deep = (reach - Q.back) * PX;
      const stripe = snow > 0 ? mixHex(art.stripe, SNOW.top[n], snow * 0.75) : art.stripe;
      const cream = snow > 0 ? mixHex(art.cream, SNOW.top[n], snow * 0.75) : art.cream;
      const bands = 10,
        band = len / bands;
      if (deep > 0.5)
        sheet(ctx, row, s0, Q.back, H.rail, (edge - H.rail) / deep, () => {
          r(-1, 0, len + 2, deep, cream);
          for (let i = 0; i < bands; i += 2) r(i * band, 0, band, deep, stripe);
        });
      // The hem hangs from the front edge; while it is still rolled, it is the roll.
      const hem = H.hem * m.unrolled + 2.5 * (1 - m.unrolled);
      frame(ctx, row, s0, reach, edge, () => {
        r(-1, 0, len + 2, hem, art.creamShade);
        for (let i = 0; i < bands; i += 2) r(i * band, 0, band, hem, art.stripeShade);
        if (detail && m.unrolled > 0.6)
          for (let i = 0; i < bands; i++)
            r(i * band + 1, hem, band - 2, 1, i % 2 ? art.creamShade : art.stripeShade);
        if (snow > 0) r(-1, -0.5, len + 2, 1, SNOW.top[n]);
      });
    });
  // The stallholder, behind the counter, facing the browsers, or turned a quarter along the
  // counter to the stock: still facing the camera, never their back to it.
  if (m.holder > 0)
    faded(ctx, m.holder, () => {
      const holder = art.holders[k];
      const p = spot(row, (s0 + stall.s1) / 2 + holder.offset, Q.holder);
      const facing = holderFacing(row, turned);
      drawResident(
        ctx,
        holder.look,
        p.x,
        p.y,
        RESIDENT_SCALE,
        { moving: false, facing, walkPhase: 0, greeting: false },
        { shadow: false, night },
      );
      // An apron over the front, its strap round the neck, mirrored with the figure.
      const left = facing === 'sw' ? -1 : 0;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(RESIDENT_SCALE, RESIDENT_SCALE);
      r(-2 + left, -11, 5, 7, night ? tint(holder.apron, -35) : holder.apron);
      r(-1 + left, -13, 3, 1, tint(holder.apron, night ? -55 : -22));
      ctx.restore();
    });
  // The counter: planks, a cloth runner in the awning's stripe, the top and the near end. The
  // slate of prices hangs on the front while the stall is stocked.
  const stocked = m.item(0);
  frame(ctx, row, s0, Q.front, 0, () => {
    r(0, -H.counter, len, H.counter, frontLit ? C.board[n] : C.boardShade[n]);
    r(0, -H.counter, len, 3, art.stripe);
    r(0, -H.counter + 3, len, 1, art.stripeShade);
    r(0, -4, len, 1, C.plank[n]);
    if (detail) r(len / 2 - 0.5, -8, 1, 4, C.plank[n]);
    if (detail && stocked > 0)
      faded(ctx, stocked, () => {
        r(len - 14, -8, 10, 6, C.slate[n]);
        r(len - 12, -6, 6, 1, C.chalk[n]);
        r(len - 12, -4, 4, 1, C.chalk[n]);
      });
  });
  end(ctx, row, s0 + LEN, Q.counter, 0, () =>
    r(
      0,
      -H.counter,
      (Q.front - Q.counter) * PX,
      H.counter,
      frontLit ? C.boardShade[n] : C.board[n],
    ),
  );
  sheet(ctx, row, s0, Q.counter, H.counter, 0, () =>
    r(0, 0, len, (Q.front - Q.counter) * PX, C.boardTop[n]),
  );
  // The day's display: a row at the back of the counter, a row at the front, and the paving.
  const display = art.displays[k];
  if (
    m.item(display.back.length + display.front.length + display.ground.length - 1) > 0 ||
    stocked > 0
  ) {
    let index = 0;
    const rowOf = (list: Item[], q: number, h: number, margin: number) => {
      if (!list.length) return;
      frame(ctx, row, s0, q, h, () => {
        ctx.scale(WARE_SCALE, WARE_SCALE);
        const room = len / WARE_SCALE - margin * 2;
        const used = list.reduce((sum, ware) => sum + ware.w, 0);
        const gap = list.length > 1 ? Math.max(0.5, (room - used) / (list.length - 1)) : 0;
        let u = margin + (list.length > 1 ? 0 : (room - used) / 2);
        for (const ware of list) {
          const a = m.item(index++);
          if (a > 0)
            faded(ctx, a, () => {
              // On the paving, a piece casts its own small shadow.
              if (!h) r(u - 1, -1, ware.w + 3, 2, C.shadow[n]);
              ware.paint(r, u);
            });
          u += ware.w + gap;
        }
      });
    };
    rowOf(display.back, Q.counter + 0.07, H.counter, 1.5);
    rowOf(display.front, Q.front - 0.07, H.counter, 7);
    rowOf(display.ground, Q.ground, 0, 6);
  }
  // Shut: the frame folded on the counter under oat canvas, which tents over the poles in a low
  // ridge and is roped down over it. Snow settles on the top, never more than 0.7 of it, so the
  // cover stays canvas.
  if (m.cover > 0)
    faded(ctx, m.cover, () => {
      const snowy = (color: string) => (snow > 0 ? mixHex(color, SNOW.top[n], snow * 0.7) : color);
      const deep = (Q.front - Q.counter + 0.08) * PX;
      const face = frontLit ? C.canvas[n] : C.canvasShade[n];
      // The back slope up to the ridge, 40% of the way in, and the front slope down from it.
      const q0 = Q.counter - 0.04,
        ridge = deep * 0.4,
        peak = 3;
      const ties = [3, len / 2 - 0.5, len - 2];
      sheet(ctx, row, s0 - 0.04, q0, H.counter + 2, peak / ridge, () => {
        r(0, 0, len + 3, ridge, snowy(C.canvasTop[n]));
        for (const u of ties) r(u, 0, 1.5, ridge, C.rope[n]);
      });
      sheet(
        ctx,
        row,
        s0 - 0.04,
        q0 + ridge / PX,
        H.counter + 2 + peak,
        -peak / (deep - ridge),
        () => {
          r(0, 0, len + 3, deep - ridge, snowy(tint(C.canvasTop[n], -8)));
          r(0, 0, len + 3, 1, snowy(tint(C.canvasTop[n], 10)));
          for (const u of ties) r(u, 0, 1.5, deep - ridge, C.rope[n]);
        },
      );
      frame(ctx, row, s0 - 0.04, Q.front + 0.04, 0, () => {
        r(0, -H.counter - 2, len + 3, H.counter - 1, face);
        // The hem sags between the ties, a darker seam along it, and the cloth falls in folds.
        r(2, -3, len / 2 - 3, 1.5, face);
        r(len / 2 + 2, -3, len / 2 - 3, 1.5, face);
        r(0, -4, len + 3, 1, C.hem[n]);
        r(2, -2, len / 2 - 3, 1, C.hem[n]);
        r(len / 2 + 2, -2, len / 2 - 3, 1, C.hem[n]);
        r(9, -H.counter, 1, H.counter - 4, C.fold[n]);
        r(len - 10, -H.counter, 1, H.counter - 4, C.fold[n]);
        r(len / 2 - 0.5, -H.counter - 2, 1.5, H.counter - 1, C.rope[n]);
        r(3, -H.counter - 2, 1.5, H.counter - 2, C.rope[n]);
        r(len - 2, -H.counter - 2, 1.5, H.counter - 2, C.rope[n]);
      });
      // The near end, up to the ridge.
      end(ctx, row, s0 + LEN + 0.04, q0, 0, () => {
        const side = frontLit ? C.canvasShade[n] : C.canvas[n];
        r(0, -H.counter - 2, deep, H.counter - 1, side);
        ctx.fillStyle = side;
        ctx.beginPath();
        ctx.moveTo(0, -H.counter - 2);
        ctx.lineTo(ridge, -H.counter - 2 - peak);
        ctx.lineTo(deep, -H.counter - 2);
        ctx.fill();
        r(0, -4, deep, 1, C.hem[n]);
      });
      // The folded poles' ends, out past the canvas under the ridge.
      sheet(ctx, row, s0 - 0.04, q0 + ridge / PX - 0.03, H.counter + 1 + peak, 0, () => {
        r(len + 3, 0, 4, 1.5, C.post[n]);
        r(len + 3, 2, 4, 1.5, C.postLight[n]);
      });
    });
}

/**
 * Which way a stallholder faces: toward their browsers (south-west on the north row, south-east
 * on the west row), or a quarter turn along the counter to the stock, the other of the two ways
 * that face the camera. Never their back: the two are a quarter turn apart, never opposite.
 */
export const holderFacing = (row: Row, turned: boolean) =>
  (row === 'north') === turned ? 'se' : 'sw';
/**
 * Whether a stallholder has turned along the counter to the stock: now and then while stocking
 * and packing, and for about a minute every nine through the morning; never while chatting.
 */
export function holderTurned(day: number, minutes: number, k: number, chatting: boolean) {
  if (chatting) return false;
  const s = stallTimes(day, k);
  const busy =
    (minutes >= s.stock && minutes < s.stock + 16) || (minutes >= s.pack && minutes < s.pack + 8);
  if (busy) return Math.floor((minutes - s.arrive) / 1.25) % 3 === 1;
  const lag = hash(`stallholder-turn:${k}`) % 9;
  const beat = Math.floor((minutes + lag) / 9);
  return (
    hash(`stallholder-turn:${Math.floor(day)}:${k}:${beat}`) % 2 === 0 && (minutes + lag) % 9 < 1.2
  );
}

// ---------------------------------------------------------------------------------------------
// The handcart, the pump, the tubs and the chalk board.

function paintCart(
  ctx: Ctx,
  art: MarketArt,
  night: boolean,
  load: number[],
  cover: number,
  folded: number,
) {
  const r = painter(ctx);
  const n = night ? 1 : 0;
  const { x0, x1, y0, y1, handle } = MARKET_CART;
  const row: Row = 'west';
  const qa = x0 - G.left,
    qb = x1 - G.left;
  const long = (y1 - y0) * PX,
    wide = (qb - qa) * PX;
  const low = 6,
    high = 12;
  // The handles reach down to the paving from the bed's south end.
  ctx.strokeStyle = C.cartShade[n];
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const q of [qa + 0.07, qb - 0.07]) {
    const a = spot(row, y1, q, high - 1),
      b = spot(row, handle, q, 1);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  // The bed is a shallow box: its floor and the inside of its far side and end first, then the
  // load sitting in it, then the near side and end over the load's feet.
  sheet(ctx, row, y0, qa, low + 1, 0, () => r(0, 0, long, wide, C.cartInside[n]));
  frame(ctx, row, y0, qa, low + 1, () => r(0, low + 1 - high, long, high - low - 1, C.cartTop[n]));
  end(ctx, row, y0, qa, low + 1, () => r(0, low + 1 - high, wide, high - low - 1, C.cart[n]));
  // The stalls' canvas covers, folded into the cart while the market is open.
  faded(ctx, folded, () =>
    frame(ctx, row, y0 + 0.06, (qa + qb) / 2 + 0.06, low + 1, () => {
      r(0, -5, long - 6, 5, C.canvasShade[n]);
      r(2, -7, long - 10, 2, C.canvasTop[n]);
      r(1, -3, long - 8, 1, C.fold[n]);
    }),
  );
  // The load, three pieces, each going out to a stall or back from one.
  frame(ctx, row, y0 + 0.04, (qa + qb) / 2, low + 1, () => {
    ctx.scale(WARE_SCALE, WARE_SCALE);
    art.cart.forEach((ware, i) =>
      faded(ctx, load[i], () => ware.paint(r, (i * (long - 3)) / 3 / WARE_SCALE)),
    );
  });
  frame(ctx, row, y0, qb, 0, () => {
    r(0, -high, long, high - low, C.cartShade[n]);
    r(0, -high, long, 1.5, C.cartTop[n]);
    r(0, -low - 1, long, 1, C.cart[n]);
  });
  end(ctx, row, y1, qa, 0, () => {
    r(0, -high, wide, high - low, C.cart[n]);
    r(0, -high, wide, 1.5, C.cartTop[n]);
  });
  faded(ctx, cover, () => {
    const top = art.snow[6] > 0 ? mixHex(C.canvasTop[n], SNOW.top[n], art.snow[6]) : C.canvasTop[n];
    sheet(ctx, row, y0 - 0.03, qa - 0.03, high + 7, 0, () => r(0, 0, long + 2, wide + 2, top));
    frame(ctx, row, y0 - 0.03, qb + 0.03, high, () => {
      r(0, -7, long + 2, 8, C.canvasShade[n]);
      r(long / 2, -7, 1.5, 8, C.rope[n]);
    });
    end(ctx, row, y1 + 0.03, qa - 0.03, high, () => r(0, -7, wide + 2, 8, C.canvas[n]));
  });
  // A spoked wheel on the near side.
  frame(ctx, row, (y0 + y1) / 2 + 0.06, qb + 0.04, 0, () => {
    ctx.fillStyle = C.wheel[n];
    ctx.beginPath();
    ctx.arc(0, -6, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.cart[n];
    ctx.beginPath();
    ctx.arc(0, -6, 4.5, 0, TAU);
    ctx.fill();
    r(-0.5, -11, 1, 10, C.wheel[n]);
    r(-5, -6.5, 10, 1, C.wheel[n]);
    r(-1, -7, 2, 2, C.wheel[n]);
  });
}

/** A stone block: its +y face lit, its +x face in shade, its top. */
function block(
  ctx: Ctx,
  n: 0 | 1,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  h: number,
  top: string,
) {
  const shape = (points: Point[], color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.fill();
  };
  shape([at(x0, y1), at(x1, y1), at(x1, y1, h), at(x0, y1, h)], C.stone[n]);
  shape([at(x1, y1), at(x1, y0), at(x1, y0, h), at(x1, y1, h)], C.stoneShade[n]);
  shape([at(x0, y0, h), at(x1, y0, h), at(x1, y1, h), at(x0, y1, h)], top);
}

function paintPump(ctx: Ctx, night: boolean, snow: number) {
  const r = painter(ctx);
  const n = night ? 1 : 0;
  const { x, y } = MARKET_PUMP;
  const snowy = (pair: Pair) => (snow > 0 ? mixHex(pair[n], SNOW.top[n], snow) : pair[n]);
  // The plinth, the iron column and its domed cap, the handle and the spout.
  block(ctx, n, x - 0.2, y - 0.2, x + 0.2, y + 0.2, 3, snowy(C.stoneTop));
  const base = at(x, y, 3);
  r(base.x - 2, base.y - 15, 4, 15, C.iron[n]);
  r(base.x - 2, base.y - 15, 1, 15, C.ironLight[n]);
  r(base.x - 3, base.y - 17, 6, 2, C.iron[n]);
  r(base.x - 2, base.y - 18, 4, 1, snowy(C.ironLight));
  ctx.strokeStyle = C.iron[n];
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(base.x + 1, base.y - 15);
  ctx.quadraticCurveTo(base.x + 6, base.y - 20, base.x + 10, base.y - 16);
  ctx.stroke();
  r(base.x - 6, base.y - 11, 5, 2, C.iron[n]);
  r(base.x - 6, base.y - 9, 2, 2, C.iron[n]);
  // The trough below the spout, a little water in it, or ice while the snow lies.
  block(ctx, n, x - 0.42, y + 0.24, x + 0.02, y + 0.5, 5, snowy(C.stoneTop));
  const pool = at(x - 0.2, y + 0.37, 5);
  r(pool.x - 7, pool.y - 1, 12, 2, snow > 0.5 ? SNOW.ice[n] : C.water[n]);
  r(pool.x - 4, pool.y - 1, 4, 1, snow > 0.5 ? SNOW.top[n] : C.waterLight[n]);
}

/** What grows in the tubs: a season's colour, never a light. */
const TUB_PLANTS: readonly (readonly [Pair, Pair])[] = [
  [
    ['#6E9A4A', '#3E5F4C'],
    ['#D4505A', '#7E4F55'],
  ],
  [
    ['#6E9A4A', '#3E5F4C'],
    ['#C9485E', '#7A4C55'],
  ],
  [
    ['#7F8A4E', '#4A5547'],
    ['#B8693E', '#6E5245'],
  ],
  [
    ['#46705A', '#2F4D44'],
    ['#C23A3A', '#6E3E3E'],
  ],
];
function paintTub(ctx: Ctx, p: Point, night: boolean, season: number, snow: number) {
  const r = painter(ctx);
  const n = night ? 1 : 0;
  const foot = at(p.x, p.y);
  const [green, flower] = TUB_PLANTS[season];
  // A half barrel: staves, two iron hoops, its rim and the soil.
  r(foot.x - 9, foot.y - 11, 18, 11, C.tub[n]);
  r(foot.x + 3, foot.y - 11, 6, 11, C.tubShade[n]);
  r(foot.x - 3, foot.y - 10, 1, 9, C.tubShade[n]);
  r(foot.x - 9, foot.y - 8, 18, 1.5, C.hoop[n]);
  r(foot.x - 9, foot.y - 3, 18, 1.5, C.hoop[n]);
  ctx.fillStyle = C.soil[n];
  ctx.beginPath();
  ctx.ellipse(foot.x, foot.y - 11, 9, 4, 0, 0, TAU);
  ctx.fill();
  // The plants, and their flowers or berries.
  r(foot.x - 8, foot.y - 17, 16, 6, green[n]);
  r(foot.x - 6, foot.y - 21, 12, 4, green[n]);
  r(foot.x - 3, foot.y - 23, 6, 2, green[n]);
  r(foot.x - 6, foot.y - 19, 3, 2, flower[n]);
  r(foot.x + 1, foot.y - 22, 3, 2, flower[n]);
  r(foot.x + 4, foot.y - 16, 3, 2, flower[n]);
  r(foot.x - 2, foot.y - 15, 2, 2, flower[n]);
  if (snow > 0) faded(ctx, snow, () => r(foot.x - 5, foot.y - 24, 10, 2, SNOW.top[n]));
}

/** The chalk board by the way in, with the day's market drawn on it: an apple, a flower, a book. */
function paintBoard(ctx: Ctx, kind: MarketKind, night: boolean) {
  const r = painter(ctx);
  const n = night ? 1 : 0;
  const o = at(MARKET_BOARD.x - 0.13, MARKET_BOARD.y);
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, o.x, o.y);
  r(1, -14, 1.5, 14, C.post[n]);
  r(8.5, -14, 1.5, 14, C.post[n]);
  r(0, -15, 11, 11, C.post[n]);
  r(1, -14, 9, 9, C.slate[n]);
  const ink = C.chalk[n];
  if (kind === 'farmers') {
    r(3, -11, 5, 4, night ? '#7E4F55' : '#C8463C');
    r(5, -13, 1, 2, night ? '#4A5547' : '#6E9A4A');
  } else if (kind === 'flowers') {
    r(4, -12, 3, 3, night ? '#7E5E66' : '#E58FA6');
    r(5, -9, 1, 3, night ? '#4A5547' : '#6E9A4A');
  } else {
    r(3, -12, 5, 5, night ? '#45525E' : '#6E8396');
    r(4, -11, 3, 3, ink);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// The ground: the square's paving and the shadows of everything that stays, painted into the
// cached layer by the night and the season's whole day only.

const SQUARE_MIDDLE = at((G.left + G.right) / 2, (G.top + G.bottom) / 2);
const SQUARE_REACH = {
  x: (G.right - G.left) * PX + 10,
  above: (G.bottom - G.top) * 19 + 60,
  below: (G.bottom - G.top) * 19 + 10,
};
const inSquare = (p: Point) => p.x >= G.left && p.x <= G.right && p.y >= G.top && p.y <= G.bottom;

function paintGround(ctx: Ctx, night: boolean, groundDay: number) {
  const n = night ? 1 : 0;
  const side = (G.right - G.left) * PX;
  const course = PX / 2;
  const courses = Math.round(side / course);
  // The square frosts and drifts while the snow lies on the lawns; leaves gather in autumn.
  const snowy = snowAt(groundDay, 0.5) > 0.5;
  const frost = (pair: Pair, amount = 0.35) =>
    snowy ? mixHex(pair[n], SNOW.frost[n], amount) : pair[n];
  const origin = at(G.left, G.top);
  ctx.save();
  // u along x and w along y, a px a px: a rect here is a rect on the paving.
  ctx.transform(1, 0.5, -1, 0.5, origin.x, origin.y);
  const r = painter(ctx);
  r(0, 0, side, side, frost(C.sett));
  // Long flagstones in courses, every other course half a stone along; a few a shade apart.
  for (let k = 0; k < 40; k++) {
    const h = hash(`market-flag:${k}`);
    const j = h % courses,
      i = (h >>> 6) % (courses / 2);
    const u = i * PX + (j % 2 ? course : 0);
    r(u, j * course, PX, course, frost(h % 3 ? C.settAlt : C.settLight));
  }
  // Feet have worn the stones a shade darker in front of the counters and along the browsers'
  // two lanes (SPEC §2.3: y 16.2 behind the north spots, x 56.4 beside the west ones), most of
  // them near the middle of the way and fewer toward its edges.
  const worn = [
    frost(C.worn),
    frost([mixHex(C.sett[0], C.worn[0], 0.5), mixHex(C.sett[1], C.worn[1], 0.5)]),
  ];
  for (let j = 0; j < courses; j++)
    for (let u = j % 2 ? -course : 0; u < side; u += PX) {
      const x = G.left + (u + PX / 2) / PX,
        y = G.top + ((j + 0.5) * course) / PX;
      const lane = Math.min(
        x > G.left + 1.1 ? Math.abs(y - 16) : 9,
        y > G.top + 1.8 ? Math.abs(x - 56.1) : 9,
      );
      const h = hash(`market-worn:${j}:${u}`) % 100;
      const shade = lane < 0.3 && h < 80 ? 0 : lane < 0.6 && h < 45 ? 1 : -1;
      if (shade < 0) continue;
      const from = Math.max(0, u);
      r(from, j * course, Math.min(side, u + PX) - from, course, worn[shade]);
    }
  const joint = frost(C.joint);
  for (let j = 1; j < courses; j++) r(0, j * course - 0.5, side, 1, joint);
  for (let j = 0; j < courses; j++)
    for (let u = j % 2 ? course : PX; u < side - 1; u += PX)
      r(u - 0.5, j * course, 1, course, joint);
  // A kerb of long stones round the edge.
  const kerb = frost(C.kerb);
  r(0, 0, side, 4, kerb);
  r(0, side - 4, side, 4, kerb);
  r(0, 4, 4, side - 8, kerb);
  r(side - 4, 4, 4, side - 8, kerb);
  r(4, 4, side - 8, 1, frost(C.kerbLight));
  r(4, 5, 1, side - 9, frost(C.kerbLight));
  // A round of setts about the pump.
  const pump = { u: (MARKET_PUMP.x - G.left) * PX, w: (MARKET_PUMP.y - G.top) * PX };
  ctx.fillStyle = frost(C.ring);
  ctx.beginPath();
  ctx.ellipse(pump.u, pump.w, course * 1.8, course * 1.8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = frost(C.settLight);
  ctx.beginPath();
  ctx.ellipse(pump.u, pump.w, course * 1.45, course * 1.45, 0, 0, TAU);
  ctx.fill();
  // In the middle of the open square a compass rose is set in the paving: four long points to
  // the square's sides and four short ones between, each point half in shade, in a thin ring.
  const rose = { u: (MARKET_ROSE.x - G.left) * PX, w: (MARKET_ROSE.y - G.top) * PX };
  const R = MARKET_ROSE.r * PX;
  ctx.strokeStyle = frost(C.ring);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(rose.u, rose.w, R * 0.72, R * 0.72, 0, 0, TAU);
  ctx.stroke();
  const point = (angle: number, length: number, half: 1 | -1, color: string) => {
    const side = angle + (half * Math.PI) / 4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(rose.u, rose.w);
    ctx.lineTo(rose.u + Math.cos(angle) * length, rose.w + Math.sin(angle) * length);
    ctx.lineTo(rose.u + Math.cos(side) * R * 0.16, rose.w + Math.sin(side) * R * 0.16);
    ctx.fill();
  };
  for (let k = 0; k < 8; k++) {
    const angle = (k * Math.PI) / 4;
    const length = k % 2 ? R * 0.6 : R;
    point(angle, length, 1, frost(C.ring));
    point(angle, length, -1, frost(C.kerb));
  }
  // The shadows of the counters, the cart, the pump and the tubs, which never move.
  const shadow = C.shadow[n];
  for (const stall of MARKET_STALL_GEOMETRY) {
    const a = tile(stall.row, stall.s0 - 0.04, Q.counter - 0.06),
      b = tile(stall.row, stall.s1 + 0.1, Q.front + 0.12);
    const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)],
      [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
    r((x0 - G.left) * PX, (y0 - G.top) * PX, (x1 - x0) * PX, (y1 - y0) * PX, shadow);
  }
  const cart = MARKET_CART;
  r(
    (cart.x0 - G.left) * PX,
    (cart.y0 - G.top) * PX,
    (cart.x1 - cart.x0 + 0.12) * PX,
    (cart.y1 - cart.y0 + 0.08) * PX,
    shadow,
  );
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(pump.u + 2, pump.w + 4, 13, 13, 0, 0, TAU);
  for (const tub of MARKET_TUBS) {
    const u = (tub.x - G.left) * PX + 2,
      w = (tub.y - G.top) * PX + 2;
    ctx.moveTo(u + 9, w);
    ctx.ellipse(u, w, 9, 9, 0, 0, TAU);
  }
  ctx.fill();
  const season = seasonOf(groundDay);
  if (snowy) {
    // Drifts along the open edges, against the kerb.
    ctx.fillStyle = SNOW.top[n];
    ctx.beginPath();
    for (let k = 0; k < 14; k++) {
      const h = hash(`market-drift:${k}`);
      const along = 24 + (h % (side - 48));
      const [u, w] = k % 2 ? [side - 7, along] : [along, side - 7];
      const [ru, rw] =
        k % 2
          ? [2.5 + ((h >>> 12) % 2), 12 + ((h >>> 8) % 14)]
          : [12 + ((h >>> 8) % 14), 2.5 + ((h >>> 12) % 2)];
      ctx.moveTo(u + ru, w);
      ctx.ellipse(u, w, ru, rw, 0, 0, TAU);
    }
    ctx.fill();
  } else if (season === 2) {
    // Leaves blown against the kerb, more as the autumn goes on.
    const count = Math.min(26, 6 + (groundDay - AUTUMN));
    for (let k = 0; k < count; k++) {
      const h = hash(`market-leaf:${k}`);
      const along = 6 + (h % (side - 12));
      const off = 6 + ((h >>> 4) % 12);
      const edge = (h >>> 9) % 4;
      const [u, w] =
        edge === 0
          ? [off, along]
          : edge === 1
            ? [side - off, along]
            : edge === 2
              ? [along, off]
              : [along, side - off];
      r(u, w, 3, 2, FALLEN_LEAVES[h % FALLEN_LEAVES.length][n]);
    }
  } else if (season === 0 && groundDay >= SPRING + 3) {
    // Daisies in the joints along the kerb.
    for (let k = 0; k < 14; k++) {
      const h = hash(`market-daisy:${k}`);
      const along = 8 + (h % (side - 16));
      const [u, w] = (h >>> 9) % 2 ? [side - 7, along] : [along, side - 7];
      r(u, w, 2, 2, night ? '#5E7262' : '#7FA35A');
      r(u + 1, w - 1, 1, 1, night ? '#A9B3A6' : '#F3F0E2');
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// The painter.

/**
 * What the trading drops on the paving in front of each stall, by the market and the season:
 * straw and a leaf at the farmers' stalls, petals and stems at the flowers, fir needles and a
 * berry in winter, a paper scrap at the books.
 */
const LITTER: Record<string, readonly string[]> = {
  'farmers:0': [W.straw, W.leaf, W.leafLight],
  'farmers:1': [W.straw, W.leaf, F.strawberry[0]],
  'farmers:2': [W.straw, '#B8693E', W.leafDark],
  'farmers:3': [W.straw, W.leafDark, F.beet[0]],
  'flowers:0': [B.tulip, B.white, W.stem],
  'flowers:1': [B.sweetPea, B.rose, W.stem],
  'flowers:2': [B.statice, B.lavender, W.straw],
  'flowers:3': [W.fir, W.firDark, W.berry],
  books: [W.pages, W.card],
};
/** Bits dropped in front of each stall over a morning; the books drop fewer. */
export const MARKET_LITTER = { bits: 5, books: 2, first: 485, every: 24, fade: 2 } as const;
/**
 * The litter, in the floor layer under everyone: it builds up a bit at a time through the
 * morning, each bit fading in over two minutes, and is swept up with the first crate packed.
 */
function paintLitter(ctx: Ctx, scene: DistrictScene) {
  const { day, minutes, season } = scene;
  if (minutes < MARKET_LITTER.first || minutes > 760) return;
  const kind = marketKind(day);
  const key = waresKey(kind, season.groundDay).split(':').slice(0, 2).join(':');
  const colours = LITTER[key];
  const count = kind === 'books' ? MARKET_LITTER.books : MARKET_LITTER.bits;
  const origin = at(G.left, G.top);
  let started = false;
  for (const stall of MARKET_STALL_GEOMETRY) {
    const swept = stallAt(day, minutes, stall.k).item(0);
    if (swept <= 0) continue;
    for (let i = 0; i < count; i++) {
      const h = hash(`market-litter:${Math.floor(day)}:${stall.k}:${i}`);
      const from = MARKET_LITTER.first + i * MARKET_LITTER.every + (h % 12);
      const alpha = Math.min(swept, rise(minutes, from, MARKET_LITTER.fade));
      if (alpha <= 0) continue;
      if (!started) {
        ctx.save();
        // u along x and w along y, a px a px, as in the ground.
        ctx.transform(1, 0.5, -1, 0.5, origin.x, origin.y);
        started = true;
      }
      const s = stall.s0 + 0.12 + ((h >>> 4) % 100) * 0.0126;
      const q = Q.front + 0.16 + ((h >>> 11) % 100) * 0.0032;
      const p = tile(stall.row, s, q);
      const [u, w] = [(p.x - G.left) * PX, (p.y - G.top) * PX];
      const colour = colours[(h >>> 18) % colours.length];
      // A wisp of straw lies along or across the way; anything else is a small flake.
      const long = colour === W.straw;
      const across = (h >>> 22) % 2 === 1;
      faded(ctx, alpha, () =>
        painter(ctx)(u, w, long && !across ? 4 : 2, long && across ? 4 : long ? 1 : 2, colour),
      );
    }
  }
  if (started) ctx.restore();
}

const isMarketPlot = (id: string | null) =>
  !!id && (MARKET_PLOTS as readonly string[]).includes(id);
/** The plot of the square under a ground point. */
const plotUnder = (p: Point) =>
  (p.y < (G.top + G.bottom) / 2 ? 'D' : 'E') + (p.x < (G.left + G.right) / 2 ? '14' : '15');

/** The stalls whose browser is chatting with the stallholder this minute (pose `chat`). */
function chattingStalls(scene: DistrictScene) {
  const stalls = new Set<number>();
  const chatting = scene.residents.filter(
    (resident) =>
      resident.event?.id === 'market' &&
      resident.event.phase === 'attending' &&
      resident.pose === 'chat',
  );
  if (!chatting.length) return stalls;
  const plan = scene.plan();
  for (const resident of chatting) {
    const trip = plan.get(resident.id)?.find((t) => t.event.outing === 'market');
    if (trip) stalls.add(stallOfSeat(trip.seat));
  }
  return stalls;
}

/** The screen box of a stall, for clicks. */
function stallBox(stall: MarketStall) {
  const corners = [
    spot(stall.row, stall.s0, Q.back, H.rail),
    spot(stall.row, stall.s1, Q.back, H.rail),
    spot(stall.row, stall.s0, Q.ground, 0),
    spot(stall.row, stall.s1, Q.ground, 0),
  ];
  const xs = corners.map((p) => p.x),
    ys = corners.map((p) => p.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}
const STALL_BOXES = MARKET_STALL_GEOMETRY.map(stallBox);

/**
 * How high a stall stands, px, at `q` tiles in from its row's edge this minute, or -1 where it
 * has nothing: open, the posts, the awning and the stallholder at the back, the counter with its
 * wares, and whatever stands on the paving in front; shut, only the covered counter.
 */
function stallHeight(q: number, m: StallMoment, display: Display) {
  if (m.cover >= 0.5) return q >= Q.counter - 0.06 && q <= Q.front + 0.06 ? H.counter + 2 : -1;
  const stocked = m.item(0) >= 0.5;
  if (q >= Q.back - 0.04 && q < Q.counter) return MARKET_HEIGHTS.stall;
  if (q >= Q.counter && q <= Q.front) return H.counter + (stocked ? 14 : 0);
  if (q > Q.front && q <= Q.ground + 0.08 && stocked && display.ground.length) return 14;
  return -1;
}
/**
 * Whether a screen point lands on a stall's own shape, not its screen box: each height up the
 * stall is unprojected to the paving under it, and the point is on the stall where something
 * stands that high there. A head on the street behind, over the rail, is not.
 */
function onStall(point: Point, stall: MarketStall, m: StallMoment, display: Display) {
  const box = STALL_BOXES[stall.k];
  if (point.x < box.left || point.x > box.right || point.y < box.top || point.y > box.bottom)
    return false;
  // A shut stall's folded poles reach a little past its near end.
  const reach = m.cover >= 0.5 ? 0.2 : 0.04;
  for (let h = 0; h <= MARKET_HEIGHTS.stall; h += 0.5) {
    const g = unproject(point.x, point.y + h);
    const [s, q] = stall.row === 'north' ? [g.x, g.y - G.top] : [g.y, g.x - G.left];
    if (s < stall.s0 - 0.05 || s > stall.s1 + reach) continue;
    if (h <= stallHeight(q, m, display)) return true;
  }
  return false;
}

export const marketPainter: DistrictPainter = {
  ground(ctx, { night, groundDay, visible }) {
    if (!visible(SQUARE_MIDDLE, SQUARE_REACH.x, SQUARE_REACH.above, SQUARE_REACH.below)) return;
    paintGround(ctx, night, groundDay);
  },
  floor(ctx, scene) {
    const { selected, hovered, visible } = scene;
    if (!visible(SQUARE_MIDDLE, SQUARE_REACH.x, SQUARE_REACH.above, SQUARE_REACH.below)) return;
    paintLitter(ctx, scene);
    if (!isMarketPlot(selected) && !isMarketPlot(hovered)) return;
    // The square's outline, like the zoo's and the Millpond's.
    ctx.save();
    ctx.strokeStyle = '#F2E2A1';
    ctx.globalAlpha *= isMarketPlot(selected) ? 1 : 0.6;
    ctx.lineWidth = 3;
    ctx.beginPath();
    [at(G.left, G.top), at(G.right, G.top), at(G.right, G.bottom), at(G.left, G.bottom)].forEach(
      (p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)),
    );
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  },
  objects(ctx, scene) {
    const { day, minutes, night, season, visible, zoom } = scene;
    if (!visible(SQUARE_MIDDLE, SQUARE_REACH.x, SQUARE_REACH.above, SQUARE_REACH.below)) return [];
    const art = marketArt(day, season.groundDay, night);
    const detail = zoom >= 0.6;
    const objects: DepthObject[] = [];
    const chats = chattingStalls(scene);
    const moments = MARKET_STALL_GEOMETRY.map((stall) => stallAt(day, minutes, stall.k));
    for (const stall of MARKET_STALL_GEOMETRY) {
      // The box of its corners, and the awning's and the wares' few px past them.
      const box = STALL_BOXES[stall.k];
      const middle = { x: (box.left + box.right) / 2, y: box.bottom };
      if (!visible(middle, (box.right - box.left) / 2 + 4, box.bottom - box.top + 4, 4)) continue;
      const m = moments[stall.k];
      const turned = holderTurned(day, minutes, stall.k, chats.has(stall.k));
      objects.push({
        depth: stallDepth(stall),
        paint: () => paintStall(ctx, stall, art, m, night, turned, detail),
      });
    }
    // The cart's three loads go out as the stalls are stocked and come back at noon.
    const cartFoot = at(MARKET_CART.x1, MARKET_CART.y1);
    // The handles reach 46 px west of the wheel's corner.
    if (visible(cartFoot, 49, 52, 20)) {
      const load = [0, 1, 2].map(
        (i) => 1 - Math.max(moments[2 * i].item(0), moments[2 * i + 1].item(0)),
      );
      const cover = Math.min(...moments.map((m) => m.cover));
      const folded = 1 - moments.reduce((sum, m) => sum + m.cover, 0) / moments.length;
      objects.push({
        depth: MARKET_CART.x0 + MARKET_CART.y1,
        paint: () => paintCart(ctx, art, night, load, cover, folded),
      });
    }
    // The trough reaches 35 px west of the pump's foot.
    const pumpFoot = at(MARKET_PUMP.x, MARKET_PUMP.y);
    if (visible(pumpFoot, 38, 30, 14))
      objects.push({
        depth: MARKET_PUMP.x + MARKET_PUMP.y + 0.2,
        paint: () => paintPump(ctx, night, art.snow[7]),
      });
    const seasonIndex = seasonOf(season.groundDay);
    MARKET_TUBS.forEach((tub, i) => {
      // The plants stand 23 px, a cap of snow 24.
      if (visible(at(tub.x, tub.y), 10, 26, 2))
        objects.push({
          depth: tub.x + tub.y,
          paint: () => paintTub(ctx, tub, night, seasonIndex, art.snow[i]),
        });
    });
    if (visible(at(MARKET_BOARD.x, MARKET_BOARD.y), 12, 20, 8))
      objects.push({
        depth: MARKET_BOARD.x + MARKET_BOARD.y,
        paint: () => paintBoard(ctx, art.kind, night),
      });
    return objects;
  },
  hit(point, scene) {
    // The stalls stand up over whatever lies behind them, by their own shape this minute; the
    // paving is under everything.
    const { day, minutes, night, season } = scene;
    const art = marketArt(day, season.groundDay, night);
    let best: { plot: string; depth: number } | undefined;
    for (const stall of MARKET_STALL_GEOMETRY) {
      if (!onStall(point, stall, stallAt(day, minutes, stall.k), art.displays[stall.k])) continue;
      const depth = stallDepth(stall);
      if (!best || depth > best.depth)
        best = { plot: plotUnder(tile(stall.row, (stall.s0 + stall.s1) / 2, 0.5)), depth };
    }
    if (best) return best;
    const ground = unproject(point.x, point.y);
    return inSquare(ground) ? { plot: plotUnder(ground), depth: -1 } : undefined;
  },
};
