// The Harvest Fair and the Long Table (agent D, SPEC §4.3): the trodden-stubble patch over bed 1
// (ground, keyed by groundDay, from the last of the grain to spring), the props of HARVEST_PROPS, the table, the dishes, the four table
// lamps and the fiddler; and the scarecrow's ribboned hat. Render cap: 1,200 calls (SPEC §6.6).
// No Math.random, Date.now or performance.now: everything runs on the town clock.
//
// The day of the fair, Autumn 23–25:
//   06:00        the cart of pumpkins, the bunting on the west fence, the cider press, six round
//                bales and a straw seat at every fair spot are out (a five-minute fade at dawn)
//   13:00–17:00  the fair: a presser walks the press's bar round, a quarter at a time
//   17:04–17:10  two farmhands come to clear the press and the bales, which fade
//   17:15–17:42  one lays the trestles and boards east to west, the other follows with the
//                cloth, the jugs, a pumpkin, a bowl of apples and the four lamps
//   18:00–20:30  the fiddler plays at the table's east end; each guest's dish is on the table
//                at their place from the moment they arrive
//   20:20–20:30  the table lamps light in the streetlamp wave; 20:56 they go out over 2 minutes
//   21:00–21:15  the farmhands clear the table west to east; the cart and bunting are gone at 21:00
// Static pieces (bales, seats, the cart, the press, the bunting, each table segment, a lamp, a
// jug) are painted once into a sprite per kind, season day and night at the map's device scale
// and stamped from then on; without a document (node tests) or under a skew, they paint directly.
import { harvestDay, OUTING_TIMES } from '../../lib/district-calendar';
import { DISTRICT_SPOTS, HARVEST_PROPS, type HarvestProp } from '../../lib/district-places';
import type { EventPose } from '../../lib/events';
import { eveningMinutes, FORK_PLOT, lampLightsAt } from '../../lib/lanterns';
import { outingOf } from '../../lib/outings';
import type { ResidentTrip } from '../../lib/resident-trips';
import { DEFAULT_RESIDENT, type Resident } from '../../lib/schema';
import type { ResidentState } from '../../lib/simulation';
import { FARM_GROUND } from '../../lib/farm';
import { AUTUMN, snowAt, WINTER } from '../../lib/seasons';
import { facingToward } from '../../lib/walking';
import { getPlot, hash, project, type Point } from '../../lib/world';
import { drawDish, paintPixels } from '../carry/dish';
import type {
  DepthObject,
  DistrictGroundScene,
  DistrictPainter,
  DistrictScene,
} from '../district-art';
import { drawGlow, LIGHT } from '../glow';
import { MAX_LAMP_DISTANCE, MIN_LAMP_DISTANCE } from '../lamplight';
import { tint } from '../houses';
import { drawResident, NIGHT_DIM } from '../residents';
import { mixHex, pick, PUMPKIN, SNOW, type Pair } from '../season-palette';

type Ctx = CanvasRenderingContext2D;
type Facing = ResidentState['facing'];

// ---------------------------------------------------------------------------------------------
// The palette: [day, night]. Straw, wood, linen and faded cloth; nothing here is a light but the
// lit lamp (LIGHT.lit and LIGHT.core), so no colour is amber by day (docs/BRAND.md).

export const HARVEST_PALETTE = {
  field: ['#BDB787', '#68715A'] as Pair,
  path: ['#D6C69B', '#8B8870'] as Pair,
  soil: ['#A2805A', '#5B5245'] as Pair,
  furrow: ['#BC9A66', '#776449'] as Pair,
  stubble: ['#C6AD6A', '#8E865F'] as Pair,
  stalk: ['#9FA05E', '#6A6D50'] as Pair,
  wisp: ['#DBCB92', '#8F8C6C'] as Pair,
  straw: ['#CDB06A', '#7E7A58'] as Pair,
  strawTop: ['#D9C17E', '#8C8762'] as Pair,
  strawLight: ['#DACB92', '#949071'] as Pair,
  strawRing: ['#B5964F', '#6C674B'] as Pair,
  strawShade: ['#A58848', '#5E5A43'] as Pair,
  twine: ['#8C6F49', '#4F4A3C'] as Pair,
  wood: ['#A9845C', '#5F5848'] as Pair,
  woodLight: ['#C49D6E', '#6E6653'] as Pair,
  woodDark: ['#7D5F41', '#47433A'] as Pair,
  woodDeep: ['#5E4630', '#38362F'] as Pair,
  iron: ['#5B5F58', '#3A3E3A'] as Pair,
  linen: ['#E9E1CB', '#939884'] as Pair,
  linenShade: ['#D3C8AC', '#7D8475'] as Pair,
  runner: ['#B4685A', '#6E5650'] as Pair,
  juice: ['#B89A55', '#6E6849'] as Pair,
  shadow: ['#23341B30', '#0B171540'] as Pair,
  glassUnlit: ['#D6DCD0', '#7C8676'] as Pair,
  glassShine: ['#F1F3EC', '#97A08F'] as Pair,
  lampMetal: ['#4F5B53', '#323A36'] as Pair,
  lampBase: ['#8E7B52', '#57503F'] as Pair,
  stoneware: ['#946A49', '#58493B'] as Pair,
  stonewareLight: ['#B58A63', '#6A5A49'] as Pair,
  glaze: ['#E6DCC2', '#8E9186'] as Pair,
  apple: ['#B8483F', '#6C4440'] as Pair,
  appleLight: ['#D66F55', '#7F5148'] as Pair,
  leaf: ['#6F8F4E', '#43584A'] as Pair,
  pumpkinDark: ['#B9773D', '#7F5A40'] as Pair,
  note: ['#F3EFDF', '#B9C2B4'] as Pair,
  fiddle: ['#9A5536', '#5E4840'] as Pair,
  fiddleLight: ['#BE7448', '#6E5448'] as Pair,
  bow: ['#ECE6D3', '#A3A897'] as Pair,
  bunting: [
    ['#C99A8B', '#7A6560'],
    ['#A9B98F', '#66705F'],
    ['#E3DAC0', '#8E8E80'],
    ['#9EB1B7', '#5F6E72'],
    ['#C7AE7A', '#76705A'],
  ] as readonly Pair[],
  ribbon: ['#B4574A', '#74504A'] as Pair,
  ribbonLight: ['#CD7A66', '#87605A'] as Pair,
  wheat: ['#C9A856', '#7C7253'] as Pair,
} as const;
const P = HARVEST_PALETTE;

// ---------------------------------------------------------------------------------------------
// Where and when.

const prop = (id: string) => HARVEST_PROPS.find((p) => p.id === id)!;
const CART = prop('cart'),
  BUNTING = prop('bunting'),
  PRESS = prop('press'),
  PRESSER = prop('presser'),
  TABLE = prop('table'),
  FIDDLER = prop('fiddler');
const BALES: readonly HarvestProp[] = HARVEST_PROPS.filter((p) => p.id.startsWith('bale-'));
/** The last fair guest is home by then, so the last straw seat is long gone. */
const FAIR_HOME_BY = OUTING_TIMES['harvest-fair'].homeBy;
/** The table runs along y 77.5 from x 15 to 21, its top 7 px up; the lamps stand on it. */
export const TABLE_TOP = { left: 15.0, right: 21.0, near: 77.78, far: 77.22, rise: 7 } as const;
const TABLE_Y = 77.5;
/** The table's eight segments, one per pair of seats facing across it, west to east. */
const SEATS = DISTRICT_SPOTS['long-table'];
const SEGMENTS = Array.from({ length: 8 }, (_, k) => {
  const c = SEATS[k].x;
  return { k, c, a: k ? c - 0.4 : TABLE_TOP.left, b: k < 7 ? c + 0.4 : TABLE_TOP.right };
});
/** The trestles under the boards: one at each end and one where the two boards meet. */
const TRESTLES = [15.25, 17.95, 20.75];
/** Px the cloth hangs down the table's sides: nearly to the ground, the trestles' feet below. */
const CLOTH_DROP = 5;
type CenterItem = 'lamp' | 'jug' | 'pumpkin' | 'apples';
/** What stands down the middle of each segment: four lamps, two jugs, a pumpkin and apples. */
const CENTER: readonly CenterItem[] = [
  'lamp',
  'jug',
  'lamp',
  'pumpkin',
  'apples',
  'lamp',
  'jug',
  'lamp',
];
export const TABLE_LAMPS = SEGMENTS.filter(({ k }) => CENTER[k] === 'lamp').map(({ c }) => c);

const fork = getPlot(FORK_PLOT)!;
/** The minute each table lamp lights: the streetlamp wave, by its distance from the Fork. */
export const TABLE_LAMP_LIGHTS = TABLE_LAMPS.map((x) => {
  const distance = Math.abs(x - (fork.x + 0.5)) + Math.abs(TABLE_Y - (fork.y + 0.5));
  return lampLightsAt(
    Math.max(0, distance - MIN_LAMP_DISTANCE),
    MAX_LAMP_DISTANCE - MIN_LAMP_DISTANCE,
  );
});
/** How far (in depth) after its own segment a lit lamp's light is drawn: after the next segment
 * east (+0.8) and its own south guest (+0.5), before the next south guest (+1.3). */
export const LAMP_DEPTH = 0.81;
/** The radius of a lit table lamp's pool of light, world px. */
export const LAMP_GLOW = 28;
/** Minutes a table lamp takes to come up, and to go out at LAMPS_OUT. */
export const LAMP_RISE = 0.75;
export const LAMPS_OUT = 1256;
export const LAMP_FADE = 2;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
/** 0 before `from`, 1 after `to`, linear between. */
const ramp = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));
/** Fades in over `fadeIn` minutes from `from` and out over `fadeOut` minutes before `to`. */
const span = (t: number, from: number, to: number, fadeIn: number, fadeOut = fadeIn) =>
  Math.min(ramp(t, from, from + fadeIn), 1 - ramp(t, to - fadeOut, to));

/** How lit a table lamp is, 0..1, at a minute of a fair day's night. */
export function lampLight(index: number, minutes: number, night: boolean) {
  if (!night) return 0;
  const t = eveningMinutes(minutes);
  return (
    ramp(t, TABLE_LAMP_LIGHTS[index], TABLE_LAMP_LIGHTS[index] + LAMP_RISE) *
    (1 - ramp(t, LAMPS_OUT, LAMPS_OUT + LAMP_FADE))
  );
}

// Laying: farmhand A walks the north side east to west putting down trestles and boards, one
// segment every LAY_STEP minutes; farmhand B follows six minutes behind on the south side with
// the cloth and what stands on it. Clearing runs west to east: B takes the things and the cloth,
// A two minutes behind takes the boards and trestles.
const LAY_STEP = 2.8,
  LAY_CROUCH = 0.8,
  CLEAR_PACE = 0.5;
const layA = (k: number) => 1035 + (7 - k) * LAY_STEP;
const layB = (k: number) => 1041 + (7 - k) * LAY_STEP;
const clearB = (c: number) => 1260 + (c - TABLE_TOP.left) / CLEAR_PACE;
const clearA = (c: number) => 1262 + (c - TABLE_TOP.left) / CLEAR_PACE;
/** How much of each part of segment k is on the table at minute t of a fair day. */
export function segmentParts(k: number, t: number) {
  const { c } = SEGMENTS[k];
  const goneA = 1 - ramp(t, clearA(c), clearA(c) + 0.6),
    goneB = 1 - ramp(t, clearB(c) + 0.2, clearB(c) + 0.8);
  return {
    legs: Math.min(ramp(t, layA(k), layA(k) + 0.5), goneA),
    board: Math.min(ramp(t, layA(k) + 0.3, layA(k) + LAY_CROUCH), goneA),
    cloth: Math.min(ramp(t, layB(k), layB(k) + 0.5), goneB),
    things: Math.min(
      ramp(t, layB(k) + 0.3, layB(k) + LAY_CROUCH),
      1 - ramp(t, clearB(c), clearB(c) + 0.5),
    ),
  };
}
/** How much of a fair prop is out at minute t of a fair day: fades of five minutes at its ends. */
export function propOut(item: HarvestProp, t: number) {
  if (item.id === 'presser' || item.id === 'fiddler') return span(t, item.from, item.to, 1);
  if (item.id === 'table') return t >= item.from && t < item.to ? 1 : 0;
  return span(t, item.from, item.to, 5);
}
/** Minutes a straw seat takes to go once its own guest has walked off. */
export const SEAT_FADE = 3;
/**
 * How much of a fair spot's straw seat is out at minute t: it comes at dawn and goes with the
 * bales, but never from under a guest still at the spot. With `leave`, the last minute a fair
 * guest is at that spot that day, it stays until half a minute after they have gone.
 */
export function seatOut(t: number, leave?: number) {
  const bales = propOut(PRESS, t);
  if (leave === undefined || t < PRESS.from + 5) return bales;
  return Math.max(bales, 1 - ramp(t, leave + 0.5, leave + 0.5 + SEAT_FADE));
}

// ---------------------------------------------------------------------------------------------
// Scenery figures: the presser, the fiddler and the two farmhands. None is counted anywhere.

const look = (outfit: string, hair: string, skin: string, hat = true): Resident => ({
  ...DEFAULT_RESIDENT,
  name: 'Farmhand',
  outfit,
  hair,
  skin,
  accessory: hat ? 'hat' : 'none',
});
const PRESSER_LOOK = look('#8A6A4E', '#5B4A3A', '#D2A47F');
const FIDDLER_LOOK = { ...look('#6F5868', '#B8B1A4', '#C99B7A'), figure: 'female' as const };
const HAND_LOOKS = [
  look('#6F7F5E', '#4E3F33', '#B98763'),
  look('#8E7A58', '#2F2A26', '#D6AD8A', false),
];

type Step = { t: number; x: number; y: number; pose?: EventPose; facing?: Facing };
type Figure = {
  position: Point;
  moving: boolean;
  facing: Facing;
  walkPhase: number;
  pose?: EventPose;
  alpha: number;
};
/** The steps of a walk at `pace` tiles a minute through `points`, setting off at minute t. */
function walk(t: number, points: readonly Point[], pace: number): Step[] {
  const steps: Step[] = [];
  for (let i = 1; i < points.length; i++) {
    t += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y) / pace;
    steps.push({ t, ...points[i] });
  }
  return steps;
}
/** Working at a spot: a crouch and a stand each minute or so. */
const working = (t: number, to: number, at: Point, facing: Facing) =>
  Array.from({ length: Math.floor(to - t) }, (_, i): Step => ({
    t: t + i,
    ...at,
    facing,
    pose: i % 2 ? undefined : 'crouch',
  }));
function layScript(north: boolean): Step[] {
  const y = north ? 76.75 : 78.25,
    gate = north ? 75.5 : 79.5,
    facing: Facing = north ? 'sw' : 'ne';
  const start = north ? { x: 19.05, y: 76.85 } : { x: 16.6, y: 78.3 };
  const lay = north ? layA : layB;
  const steps: Step[] = [
    { t: 1024, ...start, facing: north ? 'sw' : 'ne' },
    ...working(1025, 1030, start, north ? 'sw' : 'ne'),
    { t: 1030, ...start },
  ];
  for (let k = 7; k >= 0; k--)
    steps.push(
      { t: lay(k), x: SEGMENTS[k].c, y, pose: 'crouch', facing },
      { t: lay(k) + LAY_CROUCH, x: SEGMENTS[k].c, y },
    );
  const last = steps.at(-1)!;
  return [
    ...steps,
    ...walk(last.t, [last, { x: 14.5, y }, { x: 14.5, y: gate }, { x: 13.5, y: gate }], 0.4),
  ];
}
function clearScript(north: boolean): Step[] {
  const y = north ? 76.75 : 78.25,
    from = north ? 1262 : 1260;
  return [
    { t: 1258, x: TABLE_TOP.left, y, facing: 'se' },
    { t: from, x: TABLE_TOP.left, y, facing: 'se' },
    ...walk(
      from,
      [
        { x: TABLE_TOP.left, y },
        { x: TABLE_TOP.right + 0.3, y },
      ],
      CLEAR_PACE,
    ),
  ];
}
const FARMHANDS = [
  [layScript(true), clearScript(true)],
  [layScript(false), clearScript(false)],
] as const;

/** Where a scripted figure is at minute t, if it is out; it fades in a minute and out in 0.6. */
export function scripted(steps: readonly Step[], t: number): Figure | undefined {
  const first = steps[0],
    last = steps.at(-1)!;
  if (t < first.t || t >= last.t) return undefined;
  let walked = 0,
    facing: Facing = first.facing ?? 'sw';
  for (let i = 0; i + 1 < steps.length; i++) {
    const a = steps[i],
      b = steps[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length) facing = facingToward(a, b);
    else facing = a.facing ?? facing;
    if (t >= b.t) {
      walked += length;
      continue;
    }
    const u = (t - a.t) / (b.t - a.t);
    return {
      position: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u },
      moving: length > 0,
      facing,
      walkPhase: length ? ((walked + length * u) * 3) % 1 : 0,
      pose: length ? undefined : a.pose,
      alpha: Math.min(ramp(t, first.t, first.t + 1), 1 - ramp(t, last.t - 0.6, last.t)),
    };
  }
  return undefined;
}

/** The presser walks the bar round a quarter at a time (2 minutes), rests a minute between, and
 * after each whole turn crouches a minute at the spout. One turn takes 12 minutes. */
const PRESS_RADIUS = 0.5;
export function presserAt(t: number) {
  const alpha = propOut(PRESSER, t);
  const since = t - PRESSER.from,
    turn = Math.floor(since / 12),
    c = since - turn * 12;
  const quarter = Math.floor(c / 3),
    u = c - quarter * 3;
  const angle = Math.PI / 2 + (quarter + Math.min(1, u / 2)) * (Math.PI / 2);
  const moving = u < 2;
  const position = {
    x: PRESS.x + Math.cos(angle) * PRESS_RADIUS,
    y: PRESS.y + Math.sin(angle) * PRESS_RADIUS,
  };
  // Walking, they face along the arc; resting, they face the press.
  const facing = moving
    ? facingToward(position, { x: position.x - Math.sin(angle), y: position.y + Math.cos(angle) })
    : facingToward(position, PRESS);
  const pose: EventPose | undefined = !moving && quarter === 3 ? 'crouch' : undefined;
  const walkPhase = moving ? (angle * PRESS_RADIUS * 3) % 1 : 0;
  return { alpha, angle, figure: { position, moving, facing, walkPhase, pose, alpha } };
}
/** The press bar's angle with nobody at it: pointing south, at the spout. */
const BAR_REST = Math.PI / 2;

// ---------------------------------------------------------------------------------------------
// Sprites: static art painted once per kind, season day and night at the map's device scale.

type Box = { left: number; top: number; width: number; height: number };
type Sprite = { canvas: HTMLCanvasElement; used: number };
/** One canvas's sprites, least recently stamped first; `pixels` is the device pixels they hold. */
type Layer = {
  scale: number;
  held: boolean;
  frame: number;
  pixels: number;
  sprites: Map<string, Sprite>;
};
const layers = new WeakMap<Ctx, Layer>();
/** Device pixels the sprites of one canvas may hold (16 MB), as the house sprites' smallest
 * budget, and one sprite at most (2 MB): a piece bigger than that, close up on a dense screen,
 * is painted directly. */
export const SPRITE_BUDGET = 4 * 1024 * 1024;
export const SPRITE_MAX = 512 * 1024;
/** How many sprites a canvas keeps at most (kinds × days × looks). */
const SPRITE_LIMIT = 96;
/** A sprite not stamped for this many frames, a few seconds, gives its memory back: the laying
 * and clearing pieces once the table is laid or gone, everything once the fair is out of view. */
export const SPRITE_IDLE = 300;

/** The sprite store for this canvas, or undefined to paint directly (node, or a skewed transform).
 * Called once a frame: a new device scale (a zoom under way) paints directly until it holds. */
function layerFor(ctx: Ctx): Layer | undefined {
  if (typeof document === 'undefined' || typeof ctx.getTransform !== 'function') return undefined;
  const t = ctx.getTransform();
  if (t.b || t.c || t.a <= 0 || t.d !== t.a) return undefined;
  let layer = layers.get(ctx);
  if (!layer)
    layers.set(ctx, (layer = { scale: t.a, held: false, frame: 0, pixels: 0, sprites: new Map() }));
  else if (layer.scale !== t.a) {
    releaseSprites(layer);
    layer.scale = t.a;
    layer.held = false;
  } else layer.held = true;
  tick(layer);
  return layer;
}
/** A frame of this canvas's: the sprites left idle too long are freed. */
function tick(layer: Layer) {
  layer.frame++;
  for (const [key, sprite] of layer.sprites) {
    if (sprite.used >= layer.frame - SPRITE_IDLE) break;
    free(layer, key, sprite);
  }
}
/** A frame with nothing of the fair's to draw on this canvas: its sprites only age. */
function idle(ctx: Ctx) {
  const layer = layers.get(ctx);
  if (layer?.sprites.size) tick(layer);
}
function free(layer: Layer, key: string, sprite: Sprite) {
  layer.pixels -= sprite.canvas.width * sprite.canvas.height;
  // A zero-sized canvas hands its backing store back straight away.
  sprite.canvas.width = sprite.canvas.height = 0;
  layer.sprites.delete(key);
}
function releaseSprites(layer: Layer) {
  for (const [key, sprite] of layer.sprites) free(layer, key, sprite);
  layer.pixels = 0;
}
/** Frees the sprites stamped least recently until `need` more pixels fit; never one stamped this
 * frame or the last (on screen), so when those fill the budget the rest are painted directly. */
function makeRoom(layer: Layer, need: number) {
  const fits = () => layer.pixels + need <= SPRITE_BUDGET && layer.sprites.size < SPRITE_LIMIT;
  if (need > SPRITE_MAX) return false;
  for (const [key, sprite] of layer.sprites) {
    if (fits() || sprite.used >= layer.frame - 1) break;
    free(layer, key, sprite);
  }
  return fits();
}
/** How many sprites a canvas holds, and the device pixels they take (for the tests). */
export function harvestSpriteStats(ctx: Ctx) {
  const layer = layers.get(ctx);
  return { sprites: layer?.sprites.size ?? 0, pixels: layer?.pixels ?? 0 };
}
/**
 * Paints `paint` (drawing round its own origin) at world px (x, y): from the sprite `key` when
 * the layer holds and it fits the budget, else straight onto the canvas.
 */
function stamp(
  ctx: Ctx,
  layer: Layer | undefined,
  key: string,
  box: Box,
  x: number,
  y: number,
  paint: (ctx: Ctx) => void,
) {
  let sprite = layer?.held ? layer.sprites.get(key) : undefined;
  if (layer?.held && !sprite) {
    const s = layer.scale;
    const width = Math.max(1, Math.ceil(box.width * s)),
      height = Math.max(1, Math.ceil(box.height * s));
    if (makeRoom(layer, width * height)) {
      const made = document.createElement('canvas');
      made.width = width;
      made.height = height;
      const c = made.getContext('2d');
      if (c) {
        c.setTransform(s, 0, 0, s, -box.left * s, -box.top * s);
        paint(c);
        layer.pixels += width * height;
        layer.sprites.set(key, (sprite = { canvas: made, used: layer.frame }));
      }
    }
  }
  if (!sprite || !layer) {
    ctx.save();
    ctx.translate(x, y);
    paint(ctx);
    ctx.restore();
    return;
  }
  // Stamped now: to the back of the queue for freeing.
  if (sprite.used !== layer.frame) {
    sprite.used = layer.frame;
    layer.sprites.delete(key);
    layer.sprites.set(key, sprite);
  }
  const t = ctx.getTransform();
  ctx.save();
  ctx.resetTransform();
  ctx.drawImage(
    sprite.canvas,
    Math.round(t.e + (x + box.left) * layer.scale),
    Math.round(t.f + (y + box.top) * layer.scale),
  );
  ctx.restore();
}
/** A sprite's key: its kind, the season's day and the look. */
const keyOf = (kind: string, groundDay: number, night: boolean) =>
  `${kind}:${groundDay}:${night ? 'n' : 'd'}`;

// ---------------------------------------------------------------------------------------------
// Drawing helpers, round a local origin (world px).

function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function poly(ctx: Ctx, points: readonly Point[], color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
}
function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
/** Tile coordinates to px round the origin `o` (a tile point), `rise` px up. */
const near =
  (ox: number, oy: number) =>
  (x: number, y: number, rise = 0): Point => ({
    x: (x - ox - (y - oy)) * 38,
    y: (x - ox + (y - oy)) * 19 - rise,
  });
/** An upright face, flat: u along it in px, v up (negative). 'x' runs down-right with town x
 * from its left end; 'y' runs up-right from its front corner (iso-paint's face). */
function face(ctx: Ctx, origin: Point, along: 'x' | 'y', paint: () => void) {
  ctx.save();
  ctx.transform(1, along === 'x' ? 0.5 : -0.5, 0, 1, origin.x, origin.y);
  paint();
  ctx.restore();
}
/** A level surface from its far corner: u along town x, w along town y, 38 px a tile. */
function flat(ctx: Ctx, origin: Point, paint: () => void) {
  ctx.save();
  ctx.transform(1, 0.5, -1, 0.5, origin.x, origin.y);
  paint();
  ctx.restore();
}
/** A pixel map with its bottom row's middle at (x, y) (dish.ts's painter, cheap on calls). */
const pixels = (
  ctx: Ctx,
  rows: readonly string[],
  colors: Readonly<Record<string, string>>,
  x: number,
  y: number,
) => paintPixels(ctx, rows, (key) => colors[key], x, y);

// ---------------------------------------------------------------------------------------------
// The ground: bed 1's greens are picked for the fair, and the bed is trodden stubble.

/** Bed 1 of the farm (leafy greens all year), and the patch laid over it once it is picked. */
export const STUBBLE_PATCH = { left: 18.2, right: 21.5, top: 74.3, bottom: 81.0 } as const;
/**
 * The ground days bed 1 lies as stubble: from the day the farm cuts the last of its grain (row by
 * row over Autumn 15–22, farm.ts `grain`), as its greens are picked for the fair, until the year
 * is out, as the grain's own stubble stands through the winter. Nothing grows there again until
 * spring, when the farm sows its beds afresh.
 */
export const STUBBLE_FROM = AUTUMN + 21;
export const isStubbleGroundDay = (groundDay: number) => groundDay >= STUBBLE_FROM;
/** The fair's three days, Autumn 23–25: the loose straw lies from the first to the autumn's end. */
const FAIR_DAYS = [AUTUMN + 22, AUTUMN + 23, AUTUMN + 24];
export const isFairGroundDay = (groundDay: number) => FAIR_DAYS.includes(groundDay);
const strawLies = (groundDay: number) => groundDay >= FAIR_DAYS[0] && groundDay < WINTER;
/** The bed's four strips of soil, as the farm lays them (its tops from FARM_GROUND.top). */
const BED_ROWS = [0.35, 2.1, 3.9, 5.9].map((top) => FARM_GROUND.top + top);
/** Whether the snow lies in a furrow of bed 1, on the farm's own schedule for that row. */
const snowyFurrow = (groundDay: number, top: number, line: number) =>
  snowAt(groundDay, (hash(`row:1:${top}:${line}`) % 1000) / 1000) > 0.5;
const PATCH_MID = project(
  (STUBBLE_PATCH.left + STUBBLE_PATCH.right) / 2,
  (STUBBLE_PATCH.top + STUBBLE_PATCH.bottom) / 2,
);
function tile(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string) {
  poly(ctx, [project(x0, y0), project(x1, y0), project(x1, y1), project(x0, y1)], color);
}
function drawStubble(ctx: Ctx, { night, groundDay, visible }: DistrictGroundScene) {
  if (!isStubbleGroundDay(groundDay) || !visible(PATCH_MID, 200, 110, 110)) return;
  const { left, right, top, bottom } = STUBBLE_PATCH;
  // The farm's frost while the snow lies, the same over the patch as over the field round it.
  const frost = snowAt(groundDay) > 0.5;
  const frosted = (pair: Pair, amount: number) =>
    frost ? mixHex(pick(pair, night), pick(SNOW.frost, night), amount) : pick(pair, night);
  tile(ctx, left, top, right, bottom, frosted(P.field, 0.3));
  // The footpaths run on through it, as the farm lays them.
  for (const y of [75.5, 79.5]) tile(ctx, left, y - 0.35, right, y + 0.35, pick(P.path, night));
  // The bed's rows, flattened by the fair, with the picked stalks left in them.
  for (const row of BED_ROWS) {
    const h = row > 79.5 ? 0.7 : 1.05;
    tile(ctx, 18.3, row, 21.4, row + h, frosted(P.soil, 0.15));
    for (let line = 0; line < 2; line++) {
      const y = row + line * 0.36 + 0.13;
      const furrow = snowyFurrow(groundDay, row, line) ? SNOW.shade : P.furrow;
      tile(ctx, 18.42, y, 21.28, y + 0.08, pick(furrow, night));
      for (let plant = 0; plant < 8; plant++) {
        const seed = hash(`stubble:${row}:${line}:${plant}`);
        const p = project(18.54 + plant * 0.36, row + line * 0.36 + 0.2);
        box(ctx, p.x - 1, p.y - 2, 3, 2, pick(seed % 3 ? P.stubble : P.stalk, night));
        if (seed % 4 === 0) box(ctx, p.x + 2, p.y - 1, 2, 1, pick(P.stalk, night));
      }
    }
  }
  // Loose straw from the bales, scattered where the fair stood, until the autumn is out.
  if (!strawLies(groundDay)) return;
  for (let k = 0; k < 18; k++) {
    const seed = hash(`wisp:${k}`);
    const p = project(
      left + 0.2 + ((seed % 97) / 97) * 3.0,
      76.2 + (((seed >> 8) % 89) / 89) * 2.6,
    );
    box(ctx, p.x, p.y, 3 + (seed % 3), 1, pick(P.wisp, night));
  }
}

// ---------------------------------------------------------------------------------------------
// Props.

const BALE_BOX: Box = { left: -12, top: -18, width: 24, height: 24 };
/** A round bale stood on end, 11 px tall: a straw drum with its rolled spiral on top. */
function paintBale(ctx: Ctx, night: boolean, seed: number) {
  oval(ctx, 0, 0, 10, 5, pick(P.strawShade, night));
  box(ctx, -10, -11, 20, 11, pick(P.straw, night));
  box(ctx, -10, -11, 3, 11, pick(P.strawLight, night));
  box(ctx, 6, -11, 4, 11, pick(P.strawShade, night));
  for (const x of [-5, -1, 3]) box(ctx, x + (seed % 2), -9, 1, 8, pick(P.strawRing, night));
  box(ctx, -10, -6, 20, 1, pick(P.twine, night));
  oval(ctx, 0, -11, 10, 5, pick(P.strawTop, night));
  oval(ctx, 0, -11, 7, 3.4, pick(P.strawRing, night));
  oval(ctx, 0, -11, 5.4, 2.5, pick(P.strawTop, night));
  oval(ctx, 0.5, -11, 2.6, 1.2, pick(P.strawRing, night));
  box(ctx, -6, -14, 4, 1, pick(P.strawLight, night));
}
/** How far behind its spot a straw seat stands, tiles: under a sitter's hips. */
const SEAT_BACK = 0.03;
const SEAT_BOX: Box = { left: -11, top: -12, width: 22, height: 18 };
/** A small square straw seat, 5 px tall, tied twice with twine. */
function paintSeat(ctx: Ctx, night: boolean) {
  const o = near(0, 0);
  const r = 0.12,
    side = 2 * r * 38;
  flat(ctx, o(-r, -r, 5), () => {
    box(ctx, 0, 0, side, side, pick(P.strawTop, night));
    box(ctx, 0, side / 2 - 0.5, side, 1, pick(P.strawRing, night));
  });
  face(ctx, o(-r, r), 'x', () => {
    box(ctx, 0, -5, side, 5, pick(P.straw, night));
    box(ctx, 0, -5, side, 1, pick(P.strawLight, night));
    box(ctx, 3, -5, 1, 5, pick(P.twine, night));
    box(ctx, side - 4, -5, 1, 5, pick(P.twine, night));
  });
  face(ctx, o(r, r), 'y', () => box(ctx, 0, -5, side, 5, pick(P.strawShade, night)));
}

/** A pumpkin 6 px wide with its base's middle at (x, y): body, two grooves and a stem. */
function pumpkin(ctx: Ctx, x: number, y: number, night: boolean) {
  box(ctx, x - 2, y - 4, 4, 1, pick(PUMPKIN.body, night));
  box(ctx, x - 3, y - 3, 6, 2, pick(PUMPKIN.body, night));
  box(ctx, x - 2, y - 1, 4, 1, pick(PUMPKIN.body, night));
  box(ctx, x - 1, y - 4, 1, 4, pick(P.pumpkinDark, night));
  box(ctx, x + 1, y - 3, 1, 3, pick(P.pumpkinDark, night));
  box(ctx, x - 1, y - 5, 1, 1, pick(PUMPKIN.stem, night));
}
const CART_BOX: Box = { left: -22, top: -24, width: 44, height: 34 };
/** A two-wheeled handcart against the fence, heaped with the farm's pumpkins (≤ 18 px). */
function paintCart(ctx: Ctx, night: boolean) {
  const o = near(CART.x, CART.y);
  const [x0, x1, y0, y1] = [14.4, 14.8, 77.22, 77.72];
  // The handles reach south to a prop on the ground.
  ctx.strokeStyle = pick(P.woodDark, night);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const x of [14.46, 14.74]) {
    const a = o(x, 77.6, 6),
      b = o(x, 77.86, 3);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  // The bed: sides 5 px deep over the axle.
  face(ctx, o(x0, y1, 4), 'x', () => {
    box(ctx, 0, -6, (x1 - x0) * 38, 6, pick(P.wood, night));
    box(ctx, 0, -6, (x1 - x0) * 38, 1, pick(P.woodLight, night));
    box(ctx, 0, -3, (x1 - x0) * 38, 1, pick(P.woodDark, night));
  });
  face(ctx, o(x1, y1, 4), 'y', () => {
    box(ctx, 0, -6, (y1 - y0) * 38, 6, pick(P.woodDark, night));
    box(ctx, 0, -6, (y1 - y0) * 38, 1, pick(P.wood, night));
  });
  flat(ctx, o(x0, y0, 10), () =>
    box(ctx, 0, 0, (x1 - x0) * 38, (y1 - y0) * 38, pick(P.woodDeep, night)),
  );
  // The heap: six in two rows, and two on top.
  for (const [x, y, rise] of [
    [14.48, 77.3, 9],
    [14.7, 77.3, 9],
    [14.5, 77.48, 9],
    [14.72, 77.5, 9],
    [14.52, 77.66, 9],
    [14.74, 77.66, 9],
    [14.58, 77.4, 13],
    [14.66, 77.58, 13],
  ])
    pumpkin(ctx, Math.round(o(x, y).x), Math.round(o(x, y, rise).y), night);
  // The wheel on the near side, and its hub.
  face(ctx, o(x1, 77.62, 4), 'y', () => {
    ctx.fillStyle = pick(P.woodDeep, night);
    ctx.beginPath();
    ctx.arc(7, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pick(P.wood, night);
    ctx.beginPath();
    ctx.arc(7, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    box(ctx, 6, -1, 2, 2, pick(P.iron, night));
  });
}

const BUNTING_SPANS = [
  [76, 77],
  [77, 78],
  [78, 78.95],
] as const;
const BUNTING_BOX: Box = { left: -24, top: -32, width: 48, height: 40 };
/** One span of bunting between fence posts: a sagging string of faded cloth pennants. */
function paintBunting(ctx: Ctx, night: boolean, span: number) {
  const [from, to] = BUNTING_SPANS[span];
  const mid = (from + to) / 2;
  const o = near(14, mid);
  const at = (u: number) =>
    o(14, from + (to - from) * u, 14 - 3.5 * Math.sin(Math.PI * u) - (u === 1 && to % 1 ? 2 : 0));
  ctx.strokeStyle = pick(P.twine, night);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const p = at(i / 6);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const p = at((i + 0.6) / 4.2);
    const color = pick(P.bunting[(span * 4 + i) % P.bunting.length], night);
    const x = Math.round(p.x) - 1,
      y = Math.round(p.y);
    box(ctx, x - 1, y, 5, 2, color);
    box(ctx, x, y + 2, 3, 2, color);
    box(ctx, x + 1, y + 4, 1, 2, color);
  }
}

const PRESS_BOX: Box = { left: -22, top: -30, width: 44, height: 40 };
/** The cider press: a timber base, a slatted tub under the follower, two posts and a beam with
 * the screw through it, and a spout over a bucket (≤ 24 px). The bar is drawn live. */
function paintPress(ctx: Ctx, night: boolean) {
  const o = near(PRESS.x, PRESS.y);
  const [x0, x1, y0, y1] = [19.27, 19.73, 77.27, 77.73];
  // The base.
  face(ctx, o(x0, y1), 'x', () => box(ctx, 0, -3, (x1 - x0) * 38, 3, pick(P.woodDark, night)));
  face(ctx, o(x1, y1), 'y', () => box(ctx, 0, -3, (y1 - y0) * 38, 3, pick(P.woodDeep, night)));
  flat(ctx, o(x0, y0, 3), () => {
    box(ctx, 0, 0, (x1 - x0) * 38, (y1 - y0) * 38, pick(P.wood, night));
    box(ctx, 0, 6, (x1 - x0) * 38, 1, pick(P.juice, night));
  });
  // The far post, behind the tub.
  const post = (y: number, color: string) => {
    const p = o(PRESS.x, y, 3);
    box(ctx, Math.round(p.x) - 1, Math.round(p.y) - 19, 3, 19, color);
  };
  post(77.3, pick(P.woodDark, night));
  // The tub: slats and two iron hoops.
  const tub = o(PRESS.x, PRESS.y, 3);
  const tx = Math.round(tub.x),
    ty = Math.round(tub.y);
  oval(ctx, tx, ty, 8, 4, pick(P.woodDark, night));
  box(ctx, tx - 8, ty - 9, 16, 9, pick(P.wood, night));
  for (const x of [-6, -3, 0, 3, 6]) box(ctx, tx + x, ty - 9, 1, 9, pick(P.woodDark, night));
  box(ctx, tx - 8, ty - 9, 2, 9, pick(P.woodLight, night));
  box(ctx, tx - 8, ty - 8, 16, 1, pick(P.iron, night));
  box(ctx, tx - 8, ty - 3, 16, 1, pick(P.iron, night));
  oval(ctx, tx, ty - 9, 8, 4, pick(P.juice, night));
  // Crushed apples round the follower.
  for (const [x, y, color] of [
    [-7, -10, P.apple],
    [-5, -12, P.appleLight],
    [4, -12, P.apple],
    [5, -10, P.appleLight],
    [-2, -8, P.apple],
  ] as const)
    box(ctx, tx + x, ty + y, 2, 2, pick(color, night));
  // The follower block pressing the apples down.
  box(ctx, tx - 5, ty - 13, 10, 4, pick(P.woodLight, night));
  box(ctx, tx - 5, ty - 10, 10, 1, pick(P.woodDark, night));
  // The screw up to the beam.
  box(ctx, tx - 1, ty - 19, 2, 6, pick(P.iron, night));
  // The near post and the beam across the two.
  post(77.7, pick(P.wood, night));
  const a = o(PRESS.x, 77.73, 3 + 18),
    b = o(PRESS.x, 77.27, 3 + 18);
  poly(
    ctx,
    [
      { x: a.x - 1, y: a.y },
      { x: b.x + 2, y: b.y },
      { x: b.x + 2, y: b.y - 3 },
      { x: a.x - 1, y: a.y - 3 },
    ],
    pick(P.woodDark, night),
  );
  box(
    ctx,
    Math.round((a.x + b.x) / 2) - 2,
    Math.round((a.y + b.y) / 2) - 4,
    4,
    2,
    pick(P.woodLight, night),
  );
  // The spout and the bucket under it.
  const spout = o(PRESS.x, 77.76, 2);
  box(ctx, Math.round(spout.x) - 1, Math.round(spout.y) - 1, 2, 2, pick(P.woodDeep, night));
  const pail = o(PRESS.x, 77.84);
  const px = Math.round(pail.x),
    py = Math.round(pail.y);
  box(ctx, px - 3, py - 5, 6, 5, pick(P.woodDark, night));
  box(ctx, px - 3, py - 4, 6, 1, pick(P.iron, night));
  box(ctx, px - 2, py - 5, 4, 1, pick(P.juice, night));
}
/** The bar through the screw, out to where the presser holds it. */
function paintBar(ctx: Ctx, angle: number, night: boolean) {
  const o = near(0, 0);
  const hub = project(PRESS.x, PRESS.y),
    end = o(Math.cos(angle) * 0.42, Math.sin(angle) * 0.42, 13);
  ctx.strokeStyle = pick(P.woodDark, night);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hub.x, hub.y - 16);
  ctx.lineTo(hub.x + end.x, hub.y + end.y);
  ctx.stroke();
}

// The table, a segment at a time: trestle legs, the board, and the cloth with its runner.
const segmentBox = (k: number): Box => ({
  left: -32,
  top: -26,
  width: 64,
  height: k === 7 ? 46 : 42,
});
function paintLegs(ctx: Ctx, k: number, night: boolean) {
  const { a, b, c } = SEGMENTS[k];
  const o = near(c, TABLE_Y);
  for (const x of TRESTLES) {
    if (x < a || x >= b) continue;
    for (const [y, color] of [
      [77.3, pick(P.woodDeep, night)],
      [77.7, pick(P.woodDark, night)],
    ] as const) {
      const p = o(x, y);
      box(ctx, Math.round(p.x) - 1, Math.round(p.y) - 6, 2, 6, color);
    }
    const p = o(x, 77.5, 3);
    box(ctx, Math.round(p.x) - 4, Math.round(p.y), 8, 1, pick(P.woodDeep, night));
  }
}
function paintBoard(ctx: Ctx, k: number, night: boolean) {
  const { a, b, c } = SEGMENTS[k];
  const o = near(c, TABLE_Y);
  const { near: y1, far: y0, rise } = TABLE_TOP;
  face(ctx, o(a, y1, rise - 1), 'x', () =>
    box(ctx, 0, 0, (b - a) * 38, 1, pick(P.woodDark, night)),
  );
  if (k === 7)
    face(ctx, o(b, y1, rise - 1), 'y', () =>
      box(ctx, 0, 0, (y1 - y0) * 38, 1, pick(P.woodDeep, night)),
    );
  flat(ctx, o(a, y0, rise), () => {
    box(ctx, 0, 0, (b - a) * 38, (y1 - y0) * 38, pick(P.wood, night));
    box(ctx, 0, 10.5, (b - a) * 38, 0.6, pick(P.woodDark, night));
  });
}
function paintCloth(ctx: Ctx, k: number, night: boolean) {
  const { a, b, c } = SEGMENTS[k];
  const o = near(c, TABLE_Y);
  const { near: y1, far: y0, rise } = TABLE_TOP;
  // Each piece reaches a little under the one west of it, so the cloth runs on without a seam.
  const from = a - 0.03,
    to = b + (k === 7 ? 0.03 : 0);
  const hem = (along: number) => {
    box(ctx, 0, 0, along, CLOTH_DROP, pick(P.linenShade, night));
    box(ctx, 0, CLOTH_DROP - 2, along, 1, pick(P.runner, night));
  };
  face(ctx, o(from, y1 + 0.03, rise), 'x', () => hem((to - from) * 38));
  if (k === 7) face(ctx, o(to, y1 + 0.03, rise), 'y', () => hem((y1 - y0 + 0.06) * 38));
  flat(ctx, o(from, y0 - 0.03, rise + 0.5), () => {
    const u = (to - from) * 38;
    box(ctx, 0, 0, u, (y1 - y0 + 0.06) * 38, pick(P.linen, night));
    box(ctx, 0, 9.4, u, 4.4, pick(P.runner, night));
    box(ctx, 0, 10.4, u, 0.8, pick(P.linen, night));
    box(ctx, 0, 12.2, u, 0.8, pick(P.linen, night));
  });
}

// Small things on the table, as pixel maps standing on the cloth.
const LAMP_ROWS = ['..h..', '.hhh.', '.gGg.', '.gfg.', '.ggg.', '.mmm.', 'bbbbb', '.bbb.'];
const JUG_ROWS = ['.ccc.', '..d..', '.dDdh', 'dDddh', 'dDdd.', '.ddd.'];
const APPLE_ROWS = ['.a.l...', 'aAaAa.a', 'AaAaAaA', 'wwwwwww', '.wwwww.'];
const lampColors = (night: boolean) => ({
  h: pick(P.lampMetal, night),
  g: pick(P.glassUnlit, night),
  G: pick(P.glassShine, night),
  f: pick(P.lampMetal, night),
  m: pick(P.lampMetal, night),
  b: pick(P.lampBase, night),
});
const LIT = { g: LIGHT.lit, G: LIGHT.core, f: LIGHT.core };
const LIT_ROWS = ['.....', '.....', '.gGg.', '.gfg.', '.ggg.', '.....', '.....', '.....'];

// ---------------------------------------------------------------------------------------------
// Who has arrived: each Long Table guest's dish, at their place, from their arrival.

type Dish = { seat: number; arrive: number; variant: number };
const dishCache = new WeakMap<ReadonlyMap<string, readonly ResidentTrip[]>, Dish[]>();
function dishesOf(scene: DistrictScene): Dish[] {
  const plan = scene.plan();
  const known = dishCache.get(plan);
  if (known) return known;
  const carry = outingOf('long-table')?.carry;
  const dishes: Dish[] = [];
  for (const [id, trips] of plan)
    for (const trip of trips)
      if (trip.event.outing === 'long-table')
        dishes.push({
          seat: trip.seat,
          arrive: trip.arrive,
          variant: carry?.variant(scene.day, id) ?? 0,
        });
  dishCache.set(plan, dishes);
  return dishes;
}

/** The dishes on the table at the scene's minute: each Long Table guest's, from their arrival. */
export function dishesOnTable(scene: DistrictScene): readonly Dish[] {
  return dishesOf(scene).filter((dish) => scene.minutes >= dish.arrive);
}

const leaveCache = new WeakMap<ReadonlyMap<string, readonly ResidentTrip[]>, number[]>();
/** The last minute a fair guest is at each fair spot today (undefined for a spot nobody took). */
export function fairLeaves(scene: DistrictScene): readonly (number | undefined)[] {
  const plan = scene.plan();
  const known = leaveCache.get(plan);
  if (known) return known;
  const leaves: number[] = [];
  for (const trips of plan.values())
    for (const trip of trips)
      if (trip.event.outing === 'harvest-fair')
        leaves[trip.seat] = Math.max(leaves[trip.seat] ?? -Infinity, trip.leave);
  leaveCache.set(plan, leaves);
  return leaves;
}

// ---------------------------------------------------------------------------------------------
// The fiddler: standing at the table's east end facing the guests, bow going, a note now and then.

function paintFiddler(ctx: Ctx, x: number, y: number, t: number, night: boolean) {
  drawResident(
    ctx,
    FIDDLER_LOOK,
    x,
    y,
    1.25,
    { moving: false, facing: 'sw', walkPhase: 0, greeting: false },
    { night },
  );
  // In the figure's own px, facing out (+x) toward the guests, mirrored as it is drawn (sw).
  const ink = (colour: string) => (night ? tint(colour, NIGHT_DIM) : colour);
  const outfit = ink(FIDDLER_LOOK.outfit),
    skin = ink(FIDDLER_LOOK.skin);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-1.25, 1.25);
  // The near arm comes up off her skirt, the elbow bent, to hold the fiddle's neck out in front.
  box(ctx, 3, -7, 2, 3, outfit);
  box(ctx, 4, -10, 2, 2, outfit);
  box(ctx, 5, -11, 2, 2, outfit);
  box(ctx, 7, -12, 2, 2, skin);
  // The fiddle, tucked under her chin and pointing out, rising a little to the scroll.
  box(ctx, 0, -13, 5, 1, pick(P.fiddle, night));
  box(ctx, -1, -12, 7, 1, pick(P.fiddle, night));
  box(ctx, 0, -11, 5, 1, pick(P.fiddle, night));
  box(ctx, 0, -13, 3, 1, pick(P.fiddleLight, night));
  box(ctx, -1, -12, 1, 1, pick(P.woodDeep, night));
  box(ctx, 5, -13, 2, 1, pick(P.woodDeep, night));
  box(ctx, 7, -14, 3, 1, pick(P.woodDeep, night));
  box(ctx, 10, -15, 1, 2, pick(P.woodDeep, night));
  // The bow across the strings by the bridge, a pixel a row from her hip to past her chin,
  // drawn back and forth along itself.
  const stroke = Math.round(Math.sin(t * Math.PI * 2 * 1.2) * 2);
  for (let row = 0; row < 9; row++)
    box(ctx, Math.round((row + stroke) * 0.7), -8 - row - stroke, 1, 2, pick(P.bow, night));
  ctx.restore();
  // A note drifts up from the strings for a moment every few minutes.
  const phase = (t / 2.5) % 1;
  if (phase < 0.45) {
    const rise = Math.round(phase * 20);
    const nx = Math.round(x + 9 + phase * 6),
      ny = Math.round(y - 34 - rise);
    box(ctx, nx, ny, 1, 5, pick(P.note, night));
    box(ctx, nx - 2, ny + 4, 3, 2, pick(P.note, night));
  }
}

// ---------------------------------------------------------------------------------------------
// The painter.

/** The fair ground's middle, and how far round it (px either side, above, below) the objects and
 * the shadows may reach, with room to spare: measured 250, 153 and 107 (a farmhand at either gate,
 * the bunting's top, the south row's straw seats) and 146, 70 and 74 for the shadows. */
export const GROUND_MID = project(18, 77.5);
export const GROUND_REACH = [300, 200, 160] as const;
export const FLOOR_REACH = [260, 90, 90] as const;

/** Whether a tile point, reaching `rx` px either side, `above` and `below`, is in view. */
type Seen = (x: number, y: number, rx: number, above: number, below: number) => boolean;

function harvestObjects(ctx: Ctx, scene: DistrictScene): DepthObject[] {
  const { day, minutes, night, season, visible } = scene;
  // The whole fair ground at once first: nothing to do when the farm's west end is out of view.
  if (
    !harvestDay(day) ||
    minutes < 360 ||
    minutes >= TABLE.to ||
    !visible(GROUND_MID, ...GROUND_REACH)
  ) {
    idle(ctx);
    return [];
  }
  const seen: Seen = (x, y, rx, above, below) => visible(project(x, y), rx, above, below);
  const objects: DepthObject[] = [];
  let layer: Layer | undefined;
  let checked = false;
  /** The sprite store, looked up once a frame and only when something is drawn. */
  const store = () => {
    if (!checked) {
      checked = true;
      layer = layerFor(ctx);
    }
    return layer;
  };
  const day0 = season.groundDay;
  const fade = (alpha: number, paint: () => void) => {
    if (alpha <= 0) return;
    if (alpha >= 1) return paint();
    const before = ctx.globalAlpha;
    ctx.globalAlpha = before * alpha;
    paint();
    ctx.globalAlpha = before;
  };
  const push = (depth: number, paint: () => void) => objects.push({ depth, paint });

  // The cart of pumpkins and the bunting on the west fence, out all day.
  const cartOut = propOut(CART, minutes);
  if (cartOut > 0 && seen(CART.x, CART.y, 24, 26, 12)) {
    const p = project(CART.x, CART.y);
    push(CART.x + CART.y, () =>
      fade(cartOut, () =>
        stamp(ctx, store(), keyOf('cart', day0, night), CART_BOX, p.x, p.y, (c) =>
          paintCart(c, night),
        ),
      ),
    );
  }
  const buntingOut = propOut(BUNTING, minutes);
  if (buntingOut > 0)
    BUNTING_SPANS.forEach(([from, to], span) => {
      const mid = (from + to) / 2;
      if (!seen(14, mid, 26, 32, 10)) return;
      const p = project(14, mid);
      // Just after the fence span it hangs from (farm.ts sorts each span by its middle).
      push(14 + mid + 0.005, () =>
        fade(buntingOut, () =>
          stamp(ctx, store(), keyOf(`bunting-${span}`, day0, night), BUNTING_BOX, p.x, p.y, (c) =>
            paintBunting(c, night, span),
          ),
        ),
      );
    });

  // The fair: the press, its presser, the bales and the straw seats.
  const pressOut = propOut(PRESS, minutes);
  if (pressOut > 0) {
    const presser =
      minutes >= PRESSER.from && minutes < PRESSER.to ? presserAt(minutes) : undefined;
    const angle = presser && presser.alpha > 0 ? presser.angle : BAR_REST;
    if (seen(PRESS.x, PRESS.y, 26, 32, 12)) {
      const p = project(PRESS.x, PRESS.y);
      // The bar is behind the press while it points away from us, in front of it otherwise.
      const away = Math.cos(angle) + Math.sin(angle) < 0;
      push(PRESS.x + PRESS.y, () =>
        fade(pressOut, () => {
          if (away) paintBar(ctx, angle, night);
          stamp(ctx, store(), keyOf('press', day0, night), PRESS_BOX, p.x, p.y, (c) =>
            paintPress(c, night),
          );
          if (!away) paintBar(ctx, angle, night);
        }),
      );
    }
    if (presser && presser.alpha > 0) {
      const { position } = presser.figure;
      if (seen(position.x, position.y, 24, 62, 8)) {
        const p = project(position.x, position.y);
        push(position.x + position.y, () =>
          fade(presser.alpha, () =>
            drawResident(
              ctx,
              PRESSER_LOOK,
              p.x,
              p.y,
              1.25,
              { ...presser.figure, greeting: false },
              { night },
            ),
          ),
        );
      }
    }
    BALES.forEach((bale, k) => {
      if (!seen(bale.x, bale.y, 14, 20, 8)) return;
      const p = project(bale.x, bale.y);
      push(bale.x + bale.y, () =>
        fade(pressOut, () =>
          stamp(ctx, store(), keyOf(`bale-${k % 2}`, day0, night), BALE_BOX, p.x, p.y, (c) =>
            paintBale(c, night, k),
          ),
        ),
      );
    });
  }
  // The straw seats go with the bales, but each waits for its own guest to leave first.
  if (minutes < FAIR_HOME_BY) {
    const leaves = minutes >= PRESS.to - 5 ? fairLeaves(scene) : undefined;
    DISTRICT_SPOTS['harvest-fair'].forEach((spot, k) => {
      const out = seatOut(minutes, leaves?.[k]);
      // Just behind the spot, so a guest standing at it stands in front of their seat.
      const y = spot.y + (spot.facing === 'sw' ? -SEAT_BACK : SEAT_BACK);
      if (out <= 0 || !seen(spot.x, y, 10, 12, 6)) return;
      const p = project(spot.x, y);
      push(spot.x + spot.y - 0.01, () =>
        fade(out, () =>
          stamp(ctx, store(), keyOf('seat', day0, night), SEAT_BOX, p.x, p.y, (c) =>
            paintSeat(c, night),
          ),
        ),
      );
    });
  }

  // The farmhands, clearing the fair and laying the table, then clearing the table at night.
  HAND_LOOKS.forEach((hand, i) => {
    for (const steps of FARMHANDS[i]) {
      const figure = scripted(steps, minutes);
      if (!figure || !seen(figure.position.x, figure.position.y, 24, 62, 8)) continue;
      const p = project(figure.position.x, figure.position.y);
      push(figure.position.x + figure.position.y, () =>
        fade(figure.alpha, () =>
          drawResident(ctx, hand, p.x, p.y, 1.25, { ...figure, greeting: false }, { night }),
        ),
      );
    }
  });

  // The Long Table.
  if (minutes >= TABLE.from) {
    let dishes: readonly Dish[] | undefined;
    const lamps = TABLE_LAMPS.map((_, i) => lampLight(i, minutes, night));
    SEGMENTS.forEach(({ k, c }) => {
      const parts = segmentParts(k, minutes);
      if (parts.legs <= 0 && parts.board <= 0 && parts.cloth <= 0) return;
      if (!seen(c, TABLE_Y, 34, 40, 20)) return;
      const p = project(c, TABLE_Y);
      const whole = parts.legs >= 1 && parts.board >= 1 && parts.cloth >= 1;
      dishes ??= minutes >= 1080 ? dishesOnTable(scene) : [];
      const mine = parts.things > 0 ? dishes.filter((dish) => dish.seat % 8 === k) : [];
      const item = CENTER[k];
      const lamp = item === 'lamp' ? lamps[TABLE_LAMPS.indexOf(c)] : 0;
      // A lit lamp's glass and its pool of light come after the segment east of it, whose cloth
      // would otherwise cut the pool off in a straight line, and before the next guest along the
      // south side, who sits in front of the light.
      if (lamp > 0 && parts.things > 0)
        push(c + TABLE_Y + LAMP_DEPTH, () =>
          fade(parts.things * lamp, () => {
            const x = Math.round(p.x),
              y = Math.round(p.y - TABLE_TOP.rise - 1);
            pixels(ctx, LIT_ROWS, LIT, x, y);
            drawGlow(ctx, x, y - 5, LAMP_GLOW, 0.42);
          }),
        );
      push(c + TABLE_Y, () => {
        const sprite = (part: string, paint: (c: Ctx) => void) =>
          stamp(
            ctx,
            store(),
            keyOf(`table-${k}-${part}`, day0, night),
            segmentBox(k),
            p.x,
            p.y,
            paint,
          );
        if (whole)
          sprite('laid', (c) => {
            // The board is under the cloth, all but a pixel of it.
            paintLegs(c, k, night);
            paintCloth(c, k, night);
          });
        else {
          fade(parts.legs, () => sprite('legs', (c) => paintLegs(c, k, night)));
          if (parts.cloth < 1)
            fade(parts.board, () => sprite('board', (c) => paintBoard(c, k, night)));
          fade(parts.cloth, () => sprite('cloth', (c) => paintCloth(c, k, night)));
        }
        fade(parts.things, () => {
          const o = near(c, TABLE_Y);
          const top = TABLE_TOP.rise + 1;
          const at = (y: number, rise = top) => {
            const q = o(c, y, rise);
            return { x: Math.round(p.x + q.x), y: Math.round(p.y + q.y) };
          };
          for (const dish of mine.filter((d) => d.seat < 8)) {
            const q = at(77.34);
            drawDish(ctx, q.x, q.y, dish.variant, night);
          }
          const mid = at(TABLE_Y);
          if (item === 'lamp') {
            stamp(
              ctx,
              store(),
              keyOf('lamp', day0, night),
              { left: -4, top: -10, width: 8, height: 12 },
              mid.x,
              mid.y,
              (c) => pixels(c, LAMP_ROWS, lampColors(night), 0, 0),
            );
          } else if (item === 'jug')
            stamp(
              ctx,
              store(),
              keyOf('jug', day0, night),
              { left: -4, top: -8, width: 8, height: 10 },
              mid.x,
              mid.y,
              (c) =>
                pixels(
                  c,
                  JUG_ROWS,
                  {
                    c: pick(P.glaze, night),
                    d: pick(P.stoneware, night),
                    D: pick(P.stonewareLight, night),
                    h: pick(P.woodDeep, night),
                  },
                  0,
                  0,
                ),
            );
          else if (item === 'pumpkin') pumpkin(ctx, mid.x, mid.y, night);
          else
            pixels(
              ctx,
              APPLE_ROWS,
              {
                a: pick(P.apple, night),
                A: pick(P.appleLight, night),
                l: pick(P.leaf, night),
                w: pick(P.woodDark, night),
              },
              mid.x,
              mid.y,
            );
          for (const dish of mine.filter((d) => d.seat >= 8)) {
            const q = at(77.66);
            drawDish(ctx, q.x, q.y, dish.variant, night);
          }
        });
      });
    });
  }

  // The fiddler at the table's east end.
  const fiddler = propOut(FIDDLER, minutes);
  if (fiddler > 0 && seen(FIDDLER.x, FIDDLER.y, 26, 64, 8)) {
    const p = project(FIDDLER.x, FIDDLER.y);
    push(FIDDLER.x + FIDDLER.y, () =>
      fade(fiddler, () => paintFiddler(ctx, p.x, p.y, minutes, night)),
    );
  }
  return objects;
}

/** Shadows under the props and the table: floor paint, under every guest. */
function harvestFloor(ctx: Ctx, scene: DistrictScene) {
  const { day, minutes, night, visible } = scene;
  if (!harvestDay(day) || minutes < 360 || minutes >= TABLE.to) return;
  if (!visible(GROUND_MID, ...FLOOR_REACH)) return;
  const shade = pick(P.shadow, night);
  const out = propOut(PRESS, minutes);
  const before = ctx.globalAlpha;
  if (out > 0) {
    ctx.globalAlpha = before * out;
    for (const bale of BALES) {
      const p = project(bale.x + 0.05, bale.y + 0.05);
      oval(ctx, p.x, p.y, 12, 5, shade);
    }
    const p = project(PRESS.x + 0.04, PRESS.y + 0.04);
    oval(ctx, p.x, p.y, 15, 7, shade);
  }
  const cart = propOut(CART, minutes);
  if (cart > 0) {
    ctx.globalAlpha = before * cart;
    const p = project(CART.x + 0.04, CART.y + 0.06);
    oval(ctx, p.x, p.y, 14, 6, shade);
  }
  // Under each segment of the table as its board goes down, and until it is taken up.
  for (const { k, a, b } of SEGMENTS) {
    const board = segmentParts(k, minutes).board;
    if (board <= 0) continue;
    ctx.globalAlpha = before * board;
    tile(ctx, a, TABLE_TOP.far + 0.06, b + (k === 7 ? 0.08 : 0), TABLE_TOP.near + 0.1, shade);
  }
  ctx.globalAlpha = before;
}

export const harvestPainter: DistrictPainter = {
  ground: drawStubble,
  floor: harvestFloor,
  objects: harvestObjects,
};

/**
 * The scarecrow's festival dress, drawn by farm.ts's scarecrow at its feet (x, y), world px. The
 * scarecrow calls it inside its own frame, so (x, y) is (0, 0) there and the dress lifts and tilts
 * with it (its hat's brim is at y −48, the crown's top at y −56). On the three fair days it wears
 * a ribbon round its hat, tied in a bow with two tails, and a sprig of wheat in the band.
 */
export const drawScarecrowExtras: (
  ctx: Ctx,
  x: number,
  y: number,
  day: number,
  night: boolean,
) => void = (ctx, x, y, day, night) => {
  if (!harvestDay(day)) return;
  const ribbon = pick(P.ribbon, night),
    light = pick(P.ribbonLight, night);
  box(ctx, x - 7, y - 51, 14, 3, ribbon);
  box(ctx, x - 7, y - 51, 14, 1, light);
  // The bow on the right of the band, and its tails over the brim.
  box(ctx, x + 4, y - 53, 3, 2, ribbon);
  box(ctx, x + 7, y - 52, 2, 3, light);
  box(ctx, x + 8, y - 49, 1, 5, ribbon);
  box(ctx, x + 10, y - 49, 1, 4, light);
  // A sprig of wheat tucked in on the left.
  box(ctx, x - 6, y - 58, 1, 7, pick(P.wheat, night));
  box(ctx, x - 7, y - 60, 2, 3, pick(P.wheat, night));
  box(ctx, x - 4, y - 57, 1, 6, pick(P.wheat, night));
  box(ctx, x - 4, y - 59, 2, 2, pick(P.wheat, night));
};

/** Each prop's own paint round its ground point, for the tests' height checks. */
export const HARVEST_PIECES: Record<string, (ctx: Ctx, night: boolean) => void> = {
  bale: (ctx, night) => paintBale(ctx, night, 0),
  seat: paintSeat,
  cart: paintCart,
  press: paintPress,
  // A lamp where it stands on the table, round the table's middle line.
  lamp: (ctx, night) => pixels(ctx, LAMP_ROWS, lampColors(night), 0, -(TABLE_TOP.rise + 1)),
};

/** Every [day, night] pair this file paints with, for the palette tests. */
export const HARVEST_PAIRS: readonly Pair[] = [
  ...Object.values(P).flatMap((value) =>
    typeof value[0] === 'string' ? [value as Pair] : (value as readonly Pair[]),
  ),
  PUMPKIN.body,
  PUMPKIN.stem,
];
