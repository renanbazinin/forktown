import type { Place } from '../lib/schema';
import type { ResidentState } from '../lib/simulation';
import { hasPorch, PORCH_CHAIR } from '../lib/home-life';
import { hash, type Point } from '../lib/world';
import { drawChimneySmoke } from './ambience';
import { drawSign } from './signs';
import { drawGlow } from './glow';
import { drawLanternPost, type HouseLantern } from './lantern-post';
import {
  AUTUMN,
  firstSnowAt,
  pumpkinOut,
  seedFraction,
  snowAt,
  type TownSeason,
} from '../lib/seasons';
import { PUMPKIN, SNOW, pick } from './season-palette';

type Ctx = CanvasRenderingContext2D;
export type HouseAppearance = Pick<
  Place,
  'id' | 'building' | 'color' | 'decoration' | 'design' | 'sign'
>;
// A town repeats the same few hundred colours every frame, so each shade is worked out once. The
// palette grows only with the neighbours, and the builder's colour pickers cannot grow it forever.
const tints = new Map<string, Map<number, string>>();
export function tint(color: string, delta: number) {
  let shades = tints.get(color);
  if (!shades) {
    if (tints.size >= 4096) tints.clear();
    tints.set(color, (shades = new Map()));
  }
  let shade = shades.get(delta);
  if (shade === undefined) {
    const n = parseInt(color.slice(1), 16);
    shade =
      '#' +
      [n >> 16, (n >> 8) & 255, n & 255]
        .map((value) =>
          Math.max(0, Math.min(255, value + delta))
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
    shades.set(delta, shade);
  }
  return shade;
}
function polygon(ctx: Ctx, points: readonly (readonly number[])[], fill: string) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}
/** A lean polygon for seasonal layers: fill() closes the path, so it skips closePath. */
function drift(ctx: Ctx, points: number[][], fill: string) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.fillStyle = fill;
  ctx.fill();
}
/** The walls fall 15px over their 29px width, a touch steeper than 2:1. */
const SLOPE = 15 / 29;
/** A point `out` px in front of the right wall, at wall position `x`, `z` px above the lawn. */
const onRight = (x: number, out: number, z: number) => [x + out, 18 - SLOPE * (x - out) - z];
/** The same for the left wall, whose front faces down and to the left. */
const onLeft = (x: number, out: number, z: number) => [x - out, 18 + SLOPE * (x + out) - z];
/** Houses stand a little larger than their plot art: the map draws them at this scale. */
export const HOUSE_SCALE = 1.12;
/**
 * A ground point on the lot, as an offset in world tiles from (plot.x, plot.y), in house-local
 * px at the map's house scale: where the map's houses paint it.
 */
export const lotToHouse = ({ x, y }: { x: number; y: number }) => ({
  x: ((x - y) * 38) / HOUSE_SCALE,
  y: ((x + y - 1) * 19) / HOUSE_SCALE,
});
/** A perched sitter's hips rest this far behind their feet, in world tiles (residents.ts). */
export const PERCH_HIPS_BEHIND = 0.088;
/**
 * The porch roof over the front door, in house-local px: along the street wall from `from` to
 * `to`, leaning out `out` px from `high` px up the wall to `low` at its front edge, where a 2px
 * fascia hangs and a post stands under each corner. Its underside clears a neighbour sitting on
 * the porch chair, and the ground floor's windows stay below it.
 */
const PORCH = { from: -31, to: 2, out: 6, high: 30, low: 26 } as const;
/** How high the porch chair's seat stands, in house-local px: lower than the bench's 7px. */
const PORCH_SEAT = 5;
/**
 * The porch chair on the street wall, centred under the hips of a neighbour perched at
 * PORCH_CHAIR: the ends of its seat along the wall, and how far out its back and front stand.
 */
const CHAIR = (() => {
  const hips = lotToHouse({ x: PORCH_CHAIR.feet.x, y: PORCH_CHAIR.feet.y - PERCH_HIPS_BEHIND });
  // Undo onLeft at z = 0: x - out = hips.x and 18 + SLOPE (x + out) = hips.y.
  const sum = (hips.y - 18) / SLOPE;
  const x = (hips.x + sum) / 2,
    out = (sum - hips.x) / 2;
  return { from: x - 3.5, to: x + 3.5, back: out - 2.25, front: out + 1.75 };
})();
/**
 * The tops of the two seats a neighbour perches on, in house-local px: the garden bench's, 7px
 * up, and the porch chair's, a low one under the porch roof. A perched sitter's lap rests on them.
 */
export const SEAT_TOPS = {
  bench: [
    [18, 7],
    [36, 16],
    [30, 19],
    [12, 10],
  ],
  porch: [
    onLeft(CHAIR.from, CHAIR.back, PORCH_SEAT),
    onLeft(CHAIR.to, CHAIR.back, PORCH_SEAT),
    onLeft(CHAIR.to, CHAIR.front, PORCH_SEAT),
    onLeft(CHAIR.from, CHAIR.front, PORCH_SEAT),
  ],
} as const;
/**
 * The stepping stones from the front door, in house-local px: the first just below the door,
 * each next one a step toward the street. At the map's house scale they run along world
 * x + 0.76 (home-life's STONE_X), and the map's ground carries them on past the lawn.
 */
export const STEPPING_STONES = { x: -13.5, y: 15.6, dx: -8, dy: 4, rx: 6, ry: 3 } as const;
/** Garden beds line the lawn's front edges, leaving a gap where the path runs from the door. */
const BEDS = [-39, -30, -9, 0, 9, 18, 27];
/** The beds a garden bench would stand on and behind: a bench home leaves them unplanted. */
const UNDER_BENCH = [5, 6];
/**
 * Where each bed's wildflower stem stands, in px from the bed's left edge: over the patch where
 * a watering can pours (home-life's watering spots), but the third bed's left of the porch post
 * and the last one's left of the mailbox, so neither hides behind them.
 */
const WILDFLOWER_X = [4, 4, 2, 4, 4, 4, 0];
const BASE_HEIGHT = {
  cottage: 32,
  cafe: 34,
  bookshop: 43,
  greenhouse: 32,
  studio: 36,
  observatory: 42,
};
// Each home's seasonal schedule is fixed by its id, so it is worked out once, not every frame.
const schedules = new Map<
  string,
  { seed: number; roof: number; doorstep: boolean; squash: number; beds: number[] }
>();
function scheduleOf(id: string) {
  let schedule = schedules.get(id);
  if (!schedule) {
    schedule = {
      seed: hash(id),
      roof: seedFraction(`roof:${id}`),
      doorstep: seedFraction(`pumpkin:${id}`) < 0.45,
      squash: hash(`squash:${id}`),
      beds: Array.from(BEDS, (_, bed) => seedFraction(`squash:${id}:${bed}`)),
    };
    schedules.set(id, schedule);
  }
  return schedule;
}
export function houseBounds(place: HouseAppearance) {
  const height = BASE_HEIGHT[place.building] + (place.design.floors - 1) * 23;
  const roof =
    place.design.roof === 'classic' && place.building === 'observatory'
      ? 45
      : place.design.roof === 'flat'
        ? 14
        : 34;
  return { height, top: height + roof + 8, bottom: 46, left: 72, right: 72 };
}
export type HouseLife = {
  minutes: number;
  activity?: ResidentState['activity'];
  lantern?: HouseLantern;
  /** Only the map passes a season: previews and the builder keep the neighbour's own colours. */
  season?: TownSeason;
  /**
   * How far the front door stands open, 0..1, while the neighbour steps in or out. Painted live
   * over the still picture by drawHouseDoor, like the smoke, so it never enters houseLook.
   */
  door?: number;
};
const CHIMNEYS = new Set(['cottage', 'cafe', 'bookshop', 'studio']);
/** Where the chimney stands in house-local px, or null for the homes built without one. */
function chimneyOf(place: HouseAppearance, h: number) {
  if (!CHIMNEYS.has(place.building)) return null;
  const d = place.design;
  const flat =
    d.roof === 'flat' || (d.roof === 'classic' && ['studio', 'cafe'].includes(place.building));
  return { x: -18, y: -h - (flat ? 2 : 16) };
}
/**
 * Everything a home paints, smoke included, in house-local px: the map skips a house when this
 * box is off screen. The plume climbs up to 57px above the chimney's top edge, and 2px more
 * leaves room for its soft edge.
 */
export function houseReach(place: HouseAppearance) {
  const bounds = houseBounds(place);
  const chimney = chimneyOf(place, bounds.height);
  return chimney ? { ...bounds, top: Math.max(bounds.top, 59 - chimney.y) } : bounds;
}
/** The convex outline round a set of points, in order (Andrew's monotone chain). */
function hull(points: number[][]) {
  const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: number[], p: number[], q: number[]) =>
    (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const half = (list: number[][]) => {
    const chain: number[][] = [];
    for (const point of list) {
      while (
        chain.length >= 2 &&
        cross(chain[chain.length - 2], chain[chain.length - 1], point) <= 0
      )
        chain.pop();
      chain.push(point);
    }
    chain.pop();
    return chain;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}
const corners = (x: number, y: number, w: number, h: number) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
// A home's outlines depend only on its appearance, so each is worked out once per design.
const outlines = new WeakMap<HouseAppearance, number[][][]>();
/**
 * What a home paints above its lawn, in house-local px, as convex outlines: the walls under the
 * roof, the chimney, the sign, a porch or balcony and the garden's bench, mailbox, tree or
 * flowers. Clicks select the home only on its art, so a neighbor walking past beside it stays
 * clickable; the lawn itself is the plot's, under the click.
 */
function houseOutlines(place: HouseAppearance) {
  const cached = outlines.get(place);
  if (cached) return cached;
  const d = place.design,
    { height: h } = houseBounds(place);
  const walls = [
    [-29, -h],
    [0, 15 - h],
    [29, -h],
    [29, 3],
    [0, 18],
    [-29, 3],
  ];
  const parts: number[][][] = [];
  const flat =
    d.roof === 'flat' || (d.roof === 'classic' && ['studio', 'cafe'].includes(place.building));
  if (flat)
    parts.push([
      ...walls,
      [-33, -h],
      [0, -h - 17],
      [33, -h],
      [33, 5 - h],
      [0, 22 - h],
      [-33, 5 - h],
    ]);
  else if (d.roof === 'classic' && place.building === 'observatory') {
    const dome = Array.from({ length: 9 }, (_, i) => [
      -25 * Math.cos((Math.PI * i) / 8),
      -h - 29 * Math.sin((Math.PI * i) / 8),
    ]);
    parts.push([...walls, [-30, -h], [0, 16 - h], [30, -h], ...dome]);
    parts.push([
      [8, -h - 25],
      [28, -h - 42],
      [33, -h - 35],
      [12, -h - 18],
    ]);
  } else parts.push([...walls, [-33, -h], [0, 17 - h], [-18, -h - 35], [15, -h - 18], [33, -h]]);
  const chimney = chimneyOf(place, h);
  if (chimney) parts.push(corners(chimney.x - 1, chimney.y - 16, 12, 17));
  if (place.sign.mode !== 'none')
    // The board hangs on the right wall under transform(1, -0.5, 0, 1, 1.5, 5 - h).
    parts.push(corners(-1, -1, 29, 16).map(([u, v]) => [u + 1.5, v - u / 2 + 5 - h]));
  if (hasPorch(place)) {
    const { from, to, out, high, low } = PORCH;
    const posts = [from, to].flatMap((x) => {
      const [px, py] = onLeft(x, out, 0);
      return corners(px - 1, py - low + 2, 2, low - 2);
    });
    parts.push([
      onLeft(from, 0, high + 1),
      onLeft(to, 0, high + 1),
      onLeft(to, out, low - 2),
      onLeft(from, out, low - 2),
      ...posts,
    ]);
  }
  if (d.feature === 'balcony') {
    const deck = d.floors === 1,
      out = deck ? 5 : 8,
      low = deck ? 0 : 21,
      high = deck ? 11.5 : 38.5;
    parts.push(
      [3, 26].flatMap((x) => [0, out].flatMap((o) => [onRight(x, o, low), onRight(x, o, high)])),
    );
  }
  if (place.decoration === 'bench')
    parts.push([
      [18, -4],
      [20, -4],
      [36, 4],
      [37, 23],
      [30, 26],
      [11, 17],
      [12, 10],
    ]);
  if (place.decoration === 'mailbox') parts.push(corners(30, 8, 9, 19));
  if (place.decoration === 'tree')
    parts.push([
      [40, -22],
      [52, -3],
      [55, 9],
      [42, 24],
      [39, 24],
      [26, 9],
      [28, -3],
    ]);
  if (place.decoration === 'flowers')
    parts.push([
      [28, 17],
      [43, 20],
      [43, 23],
      [42, 28],
      [29, 25],
      [28, 20],
    ]);
  const shapes = parts.map(hull);
  outlines.set(place, shapes);
  return shapes;
}
/** Whether a point, in house-local px from the house origin, lands on the home's painted art. */
export function houseHit(place: HouseAppearance, x: number, y: number) {
  return houseOutlines(place).some((shape) =>
    shape.every((p, i) => {
      const q = shape[(i + 1) % shape.length];
      return (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]) >= 0;
    }),
  );
}
/** What the clock and the calendar do to one home: its lit windows, its snow and its pumpkins. */
function houseMoment(place: HouseAppearance, night: boolean, life?: HouseLife) {
  const schedule = scheduleOf(place.id);
  const { roof: roofSeed, doorstep, squash, beds } = schedule;
  const season = life?.season;
  // The garden's pumpkins are picked when the first snow settles on this roof.
  const beforeSnow = !!season && season.yearDay >= AUTUMN && season.yearDay < firstSnowAt(roofSeed);
  // Two vegetable beds ripen into pumpkins through early autumn, each on its own day, and a
  // third where no pumpkin waits on the doorstep. One bit per bed.
  let ripe = 0;
  if (beforeSnow && place.design.garden === 'vegetables')
    for (let bed = 0; bed < BEDS.length; bed++)
      if (
        (place.decoration !== 'bench' || !UNDER_BENCH.includes(bed)) &&
        (bed === squash % 7 ||
          bed === (squash + 3) % 7 ||
          (!doorstep && squash & 8 && bed === (squash + 5) % 7)) &&
        season.yearDay >= AUTUMN + 2 + 5 * beds[bed]
      )
        ripe |= 1 << bed;
  return {
    seed: schedule.seed,
    awakeInside: life?.activity === 'home' || life?.activity === 'work',
    // On the map a home's windows wait for its lantern; previews without one keep the old glow.
    windowsLit: night && (life?.lantern?.lit ?? true),
    // The turning year rests on top of the neighbour's own colours and never repaints them.
    // Each roof keeps its own snow schedule, and its doorstep pumpkin goes in as that snow comes.
    snow: season ? snowAt(season.yearDay, roofSeed) : 0,
    onDoorstep: !!season && doorstep && pumpkinOut(season.yearDay, roofSeed),
    ripe,
  };
}
/**
 * One number for everything that changes a home's still picture, apart from its appearance and
 * where it is drawn: two frames with the same look paint the same pixels, smoke aside. Undefined
 * while its snow settles or thaws, which fades a little every frame.
 */
export function houseLook(place: HouseAppearance, night: boolean, life?: HouseLife) {
  const { awakeInside, windowsLit, snow, onDoorstep, ripe } = houseMoment(place, night, life);
  if (snow > 0 && snow < 1) return undefined;
  const lantern = life?.lantern;
  return (
    (night ? 1 : 0) |
    (windowsLit ? 2 : 0) |
    (windowsLit && awakeInside ? 4 : 0) |
    (lantern ? 8 : 0) |
    (lantern?.lit ? 16 : 0) |
    (lantern?.tale ? 32 : 0) |
    (lantern?.newest ? 64 : 0) |
    (snow ? 128 : 0) |
    (onDoorstep ? 256 : 0) |
    (ripe << 9)
  );
}
/** The chimney smoke on its own, exactly where drawHouse puts it: sprites leave it out. */
export function drawHouseSmoke(
  ctx: Ctx,
  place: HouseAppearance,
  x: number,
  y: number,
  night: boolean,
  scale: number,
  life: HouseLife,
) {
  if (life.activity !== 'home' && life.activity !== 'work') return;
  const chimney = chimneyOf(place, houseBounds(place).height);
  if (!chimney) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  drawChimneySmoke(
    ctx,
    chimney.x + 5,
    chimney.y - 17,
    life.minutes,
    scheduleOf(place.id).seed,
    night,
  );
  ctx.restore();
}
/** A door opened less than this still looks shut: the still picture's own door shows. */
export const DOOR_AJAR = 0.02;
/**
 * How far of a quarter turn a porch home's door swings: the chair stands left of the door, and
 * the leaf stops short of it, its edge clear of the chair's.
 */
export const PORCH_DOOR_SWING = 0.8;
/**
 * The front door standing open, exactly where drawHouse paints it shut: the dark doorway (warm
 * when the windows are lit) and the leaf, hinged on the left jamb and swung out toward the
 * street, square to the wall when fully open. Sprites leave it out; it is painted live on top,
 * inside the door's own frame and the ground just in front of it, clear of the porch roof, the
 * right porch post, the pumpkin and the beds.
 */
export function drawHouseDoor(
  ctx: Ctx,
  place: HouseAppearance,
  x: number,
  y: number,
  night: boolean,
  scale: number,
  life: HouseLife,
) {
  const open = life.door ?? 0;
  if (!(open >= DOOR_AJAR)) return;
  const trim = tint(place.design.trim, night ? -25 : 0);
  const lit = night && (life.lantern?.lit ?? true);
  // 0 shut, flat against the wall, to 1 swung a quarter turn out toward +y (short of the chair
  // on a porch).
  const swing = hasPorch(place) ? PORCH_DOOR_SWING : 1;
  const angle = (Math.min(1, open) * swing * Math.PI) / 2;
  const a = Math.cos(angle) - Math.sin(angle),
    b = (Math.cos(angle) + Math.sin(angle)) / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, -13, 0);
  box(ctx, 1, -2, 6, 14, lit ? '#F1D68F' : night ? '#2E3431' : '#3B3128');
  ctx.restore();
  if (lit) {
    // Lamplight from the hall spills onto the path, and glows softly in the doorway.
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * 0.35 * Math.min(1, open);
    polygon(
      ctx,
      [
        [-12, 12.5],
        [-6, 15.5],
        [-14.5, 19.75],
        [-20.5, 16.75],
      ],
      '#F1D68F',
    );
    ctx.globalAlpha = alpha;
    drawGlow(ctx, -9, 6, 9, 0.3 * Math.min(1, open));
  }
  // The leaf: its outer face, shading as it turns from the light, then its inner face past
  // halfway, and its edge as a 1px line wherever it points. The knob keeps its place on it.
  const fx = -13 + 8 * a,
    fy = 8 * b;
  polygon(
    ctx,
    [
      [-13, -2],
      [fx, fy - 2],
      [fx, fy + 12],
      [-13, 12],
    ],
    a > 0 ? tint(trim, -Math.round(12 * (1 - a))) : tint(trim, 14),
  );
  box(ctx, a > 0 ? fx - 1 : fx, fy - 2, 1, 14, tint(trim, -30));
  box(ctx, -13.5 + 5.5 * a, 5.5 * b + 3, 1, 2, '#EFD8A4');
  ctx.restore();
}
/**
 * A little low chair on the porch, its back toward the wall, its seat PORCH_SEAT px up under the
 * hips of a neighbour perched at PORCH_CHAIR.
 */
function drawPorchChair(ctx: Ctx, trim: string) {
  const wood = tint(trim, 24),
    frame = tint(trim, -18);
  const { from, to, back, front } = CHAIR;
  const seat = PORCH_SEAT,
    edge = seat - 1.5;
  polygon(
    ctx,
    [
      onLeft(from - 0.5, back - 0.5, 0),
      onLeft(to + 0.5, back - 0.5, 0),
      onLeft(to + 0.5, front + 0.5, 0),
      onLeft(from - 0.5, front + 0.5, 0),
    ],
    '#23341B25',
  );
  // The back legs rise into the backrest; the seat and its front legs stand in front of them.
  for (const leg of [from + 0.5, to - 0.5]) {
    const [px, py] = onLeft(leg, back + 0.5, 0);
    box(ctx, px - 0.5, py - seat - 8, 1, seat + 8, frame);
  }
  for (const [top, bottom] of [
    [seat + 8, seat + 6],
    [seat + 4, seat + 2.5],
  ])
    polygon(
      ctx,
      [
        onLeft(from, back + 0.5, top),
        onLeft(to, back + 0.5, top),
        onLeft(to, back + 0.5, bottom),
        onLeft(from, back + 0.5, bottom),
      ],
      wood,
    );
  polygon(ctx, SEAT_TOPS.porch, wood);
  polygon(
    ctx,
    [
      onLeft(from, front, seat),
      onLeft(to, front, seat),
      onLeft(to, front, edge),
      onLeft(from, front, edge),
    ],
    trim,
  );
  polygon(
    ctx,
    [
      onLeft(to, back, seat),
      onLeft(to, front, seat),
      onLeft(to, front, edge),
      onLeft(to, back, edge),
    ],
    frame,
  );
  for (const leg of [from + 0.5, to - 0.5]) {
    const [px, py] = onLeft(leg, front - 0.5, 0);
    box(ctx, px - 0.5, py - edge, 1, edge, frame);
  }
}
/**
 * The porch roof with a post under each front corner, as the still picture has it; drawPorchEave
 * paints it again over a neighbour standing or sitting under it.
 */
function paintPorchRoof(ctx: Ctx, roof: string, trim: string, snow: number, snowTop: string) {
  const { from, to, out, high, low } = PORCH;
  polygon(
    ctx,
    [onLeft(from, 0, high), onLeft(to, 0, high), onLeft(to, out, low), onLeft(from, out, low)],
    roof,
  );
  polygon(
    ctx,
    [
      onLeft(from, out, low),
      onLeft(to, out, low),
      onLeft(to, out, low - 2),
      onLeft(from, out, low - 2),
    ],
    tint(roof, -24),
  );
  if (snow) {
    // Snow banks against the wall on the upper part of the porch roof.
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * snow;
    const [a, b] = [onLeft(from, 0, high + 1), onLeft(to, 0, high + 1)];
    drift(
      ctx,
      [a, b, onLeft(to, out / 2, (high + low) / 2), onLeft(from, out / 2, (high + low) / 2)],
      snowTop,
    );
    ctx.globalAlpha = alpha;
  }
  for (const x of [from, to]) {
    const [px, py] = onLeft(x, out, 0);
    box(ctx, px - 1, py - low + 2, 2, low - 2, trim);
  }
}
/**
 * Whether a neighbour whose body stands at `body` (an offset from the plot in world tiles: the
 * feet, or a perched sitter's hips) is under this home's porch roof, between the wall and the
 * roof's front edge, where the edge hangs in front of their head.
 */
export function underPorchRoof(place: Pick<Place, 'building' | 'design'>, body: Point) {
  if (!hasPorch(place)) return false;
  const at = lotToHouse(body);
  // Undo onLeft at z = 0, as CHAIR does: x - out = at.x and 18 + SLOPE (x + out) = at.y.
  const sum = (at.y - 18) / SLOPE;
  const x = (at.x + sum) / 2,
    out = (sum - at.x) / 2;
  return out >= 0 && out <= PORCH.out && x >= PORCH.from && x <= PORCH.to;
}
/**
 * The porch roof and its posts again, exactly where and as drawHouse paints them, over a
 * neighbour under it: the house is one picture sorted behind whoever stands on its lot, but the
 * roof's front edge hangs in front of anyone in the doorway or on the porch chair.
 */
export function drawPorchEave(
  ctx: Ctx,
  place: HouseAppearance,
  x: number,
  y: number,
  night: boolean,
  scale: number,
  life?: HouseLife,
) {
  if (!hasPorch(place)) return;
  const { snow } = houseMoment(place, night, life);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  paintPorchRoof(
    ctx,
    tint(place.color, night ? -35 : 0),
    tint(place.design.trim, night ? -25 : 0),
    snow,
    pick(SNOW.top, night),
  );
  ctx.restore();
}
/** `smoke: false` paints the still picture a sprite keeps; drawHouseSmoke adds the plume. */
export function drawHouse(
  ctx: Ctx,
  place: HouseAppearance,
  x: number,
  y: number,
  night = false,
  scale = 1,
  life?: HouseLife,
  smoke = true,
) {
  const d = place.design,
    { height: h } = houseBounds(place);
  const roof = tint(place.color, night ? -35 : 0),
    wall = tint(d.wall, night ? -55 : 0),
    trim = tint(d.trim, night ? -25 : 0);
  const { seed, awakeInside, windowsLit, snow, onDoorstep, ripe } = houseMoment(place, night, life);
  const snowTop = pick(SNOW.top, night),
    snowShade = pick(SNOW.shade, night);
  /** Snow settles and thaws by fading, one roof at a time; the rest of the winter it is opaque. */
  const frosted = (paint: () => void) => {
    if (!snow) return;
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * snow;
    paint();
    ctx.globalAlpha = alpha;
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  polygon(
    ctx,
    [
      [-70, 7],
      [0, -28],
      [70, 7],
      [0, 42],
    ],
    night ? '#5A7667' : '#BFD5A4',
  );
  polygon(
    ctx,
    [
      [-42, 7],
      [0, -14],
      [43, 8],
      [0, 29],
    ],
    d.garden === 'paving' ? (night ? '#808477' : '#CFC9B3') : night ? '#567253' : '#BBD395',
  );
  // Garden beds stay within the plot; all artwork is drawn locally.
  const bed = (i: number) => {
    const gx = BEDS[i],
      gy = 24 - Math.abs(gx) * 0.35;
    if (d.garden === 'vegetables') {
      box(ctx, gx, gy, 7, 4, '#957453');
      if ((ripe >> i) & 1) {
        box(ctx, gx + 1, gy - 2, 5, 4, pick(PUMPKIN.body, night));
        box(ctx, gx + 3, gy - 4, 1, 2, pick(PUMPKIN.stem, night));
      } else box(ctx, gx + 2, gy - 4, 3, 6, '#567B44');
    }
    if (d.garden === 'wildflowers') {
      const stem = gx + WILDFLOWER_X[i];
      box(ctx, stem, gy - 3, 1, 5, '#668654');
      box(ctx, stem - 1, gy - 4, 3, 2, ['#EDC88B', '#D18F87', '#B3A5CD'][i % 3]);
    }
  };
  for (let i = 0; i < BEDS.length; i++)
    if (place.decoration !== 'bench' || !UNDER_BENCH.includes(i)) bed(i);
  // Stepping stones cross the lawn from the front door toward the street.
  for (let step = 0; step < 3; step++) {
    const { x, y, dx, dy, rx, ry } = STEPPING_STONES;
    const sx = x + step * dx,
      sy = y + step * dy;
    polygon(
      ctx,
      [
        [sx, sy - ry],
        [sx + rx, sy],
        [sx, sy + ry],
        [sx - rx, sy],
      ],
      night ? '#899483' : '#E3DABF',
    );
  }
  if (life?.lantern) drawLanternPost(ctx, life.lantern, night, snow);
  polygon(
    ctx,
    [
      [-29, -h],
      [0, 15 - h],
      [0, 18],
      [-29, 3],
    ],
    wall,
  );
  polygon(
    ctx,
    [
      [0, 15 - h],
      [29, -h],
      [29, 3],
      [0, 18],
    ],
    tint(wall, -24),
  );
  if (place.building === 'greenhouse') {
    polygon(
      ctx,
      [
        [-27, 2],
        [-27, 6 - h],
        [-2, 19 - h],
        [-2, 15],
      ],
      night ? '#598178' : '#A7C5B2',
    );
    polygon(
      ctx,
      [
        [2, 15],
        [2, 19 - h],
        [27, 6 - h],
        [27, 2],
      ],
      night ? '#456D67' : '#8AB4A8',
    );
  }
  // A balcony serves the first floor up; a one-floor home's stands low as a deck.
  const balconyFloor = d.feature === 'balcony' ? Math.max(0, d.floors - 2) : -1;
  for (let floor = 0; floor < d.floors; floor++) {
    const yy = -h + 12 + floor * 23;
    if (floor > 0) {
      polygon(
        ctx,
        [
          [-29, yy - 7],
          [0, yy + 8],
          [29, yy - 7],
          [29, yy - 5],
          [0, yy + 10],
          [-29, yy - 5],
        ],
        trim,
      );
    }
    for (const side of [-1, 1]) {
      ctx.save();
      // Both walls hang their windows at the same height, a sill 8px above each floor.
      ctx.transform(
        1,
        side === -1 ? 0.5 : -0.5,
        0,
        1,
        side === -1 ? -25 : 8,
        yy + (side === -1 ? 5 : 14),
      );
      const silhouette = (dx = 0, dy = 0) => {
        if (!windowsLit || !awakeInside || floor !== 0 || side !== (seed % 2 ? -1 : 1)) return;
        // One neighbor behind one pane, with the window frame painted in front.
        box(ctx, 5 + dx, 3 + dy, 3, 3, '#83744D');
        box(ctx, 4 + dx, 6 + dy, 5, 4, '#83744D');
        box(ctx, 3 + dx, 9 + dy, 7, 1, '#83744D');
      };
      const glass = windowsLit ? '#F1D68F' : night ? '#4E6461' : '#90B6BA';
      if (side === 1 && floor === balconyFloor) {
        // The balcony's glazed double door takes this window's place, its sill on the boards.
        const bottom = d.floors === 1 ? 16 : 13,
          top = bottom - 15;
        if (d.windows === 'round') {
          ctx.beginPath();
          ctx.moveTo(1, bottom);
          ctx.arc(6, top + 5, 5, Math.PI, 0);
          ctx.lineTo(11, bottom);
          ctx.closePath();
          ctx.fillStyle = glass;
          ctx.fill();
          silhouette(-2, top + 3);
          ctx.strokeStyle = trim;
          ctx.lineWidth = 2;
          ctx.stroke();
          box(ctx, 5.5, top + 1, 1, bottom - top - 1, trim);
        } else {
          box(ctx, 0, top, 12, 15, trim);
          box(ctx, 1, top + 1, 10, 14, glass);
          silhouette(-2, top + 3);
          box(ctx, 5, top, 2, 15, trim);
          if (d.windows === 'cross') box(ctx, 0, top + 5, 12, 1, trim);
          else {
            box(ctx, -4, top - 1, 3, 17, roof);
            box(ctx, 13, top - 1, 3, 17, roof);
          }
        }
      } else if (d.windows === 'round') {
        ctx.beginPath();
        ctx.arc(6, 6, 6, 0, Math.PI * 2);
        ctx.fillStyle = windowsLit ? '#F1D68F' : night ? '#4E6461' : '#8EBCBF';
        ctx.fill();
        silhouette();
        ctx.strokeStyle = trim;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        box(ctx, 0, 0, 12, 12, trim);
        box(ctx, 1, 1, 10, 10, glass);
        silhouette();
        box(ctx, 5, 0, 2, 12, trim);
        if (d.windows === 'cross') box(ctx, 0, 5, 12, 2, trim);
        else {
          box(ctx, -4, -1, 3, 14, roof);
          box(ctx, 13, -1, 3, 14, roof);
        }
      }
      ctx.restore();
    }
  }
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, -13, 0);
  box(ctx, 0, -4, 8, 16, trim);
  box(ctx, 5, 3, 1, 2, '#EFD8A4');
  ctx.restore();
  if (onDoorstep) {
    // A doorstep pumpkin at the corner right of the door, clear of the porch post and the beds.
    // Pumpkins never glow.
    box(ctx, -3, 14, 7, 4, pick(PUMPKIN.body, night));
    box(ctx, -2, 13, 5, 6, pick(PUMPKIN.body, night));
    box(ctx, 0, 14, 1, 4, pick(PUMPKIN.rib, night));
    box(ctx, 0, 11, 2, 2, pick(PUMPKIN.stem, night));
  }
  const flat =
    d.roof === 'flat' || (d.roof === 'classic' && ['studio', 'cafe'].includes(place.building));
  if (flat) {
    polygon(
      ctx,
      [
        [-33, -h],
        [0, -h - 17],
        [33, -h],
        [0, 17 - h],
      ],
      tint(roof, 12),
    );
    polygon(
      ctx,
      [
        [-33, -h],
        [0, 17 - h],
        [33, -h],
        [33, 5 - h],
        [0, 22 - h],
        [-33, 5 - h],
      ],
      roof,
    );
    // Snow lies inside a rim of roof colour; a studio's skylight is painted over it, swept clear.
    frosted(() =>
      drift(
        ctx,
        [
          [-28, -h],
          [0, -h - 14.5],
          [28, -h],
          [0, 14.5 - h],
        ],
        snowTop,
      ),
    );
    if (place.building === 'studio') {
      polygon(
        ctx,
        [
          [-15, -h],
          [0, -h - 8],
          [15, -h],
          [0, 8 - h],
        ],
        '#9AC3C1',
      );
    }
  } else if (d.roof === 'classic' && place.building === 'observatory') {
    polygon(
      ctx,
      [
        [-30, -h],
        [0, 16 - h],
        [30, -h],
        [0, -16 - h],
      ],
      roof,
    );
    ctx.fillStyle = tint(roof, 12);
    ctx.beginPath();
    ctx.ellipse(0, -h, 25, 29, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    frosted(() => {
      // A cap on the crown of the dome, its lower edge curving round the front, and snow on the
      // deck in front of it. The telescope is painted over the cap.
      ctx.fillStyle = snowTop;
      ctx.beginPath();
      ctx.ellipse(0, -h, 25, 29, 0, Math.PI + 0.86, Math.PI * 2 - 0.86);
      ctx.ellipse(0, -h - 22, 16.3, 2.5, 0, 0, Math.PI);
      ctx.fill();
      drift(
        ctx,
        [
          [-27, -h],
          [0, 14 - h],
          [27, -h],
        ],
        snowTop,
      );
    });
    polygon(
      ctx,
      [
        [8, -h - 25],
        [28, -h - 42],
        [33, -h - 35],
        [12, -h - 18],
      ],
      '#B9C6BB',
    );
  } else {
    polygon(
      ctx,
      [
        [-33, -h],
        [0, 17 - h],
        [15, -h - 18],
        [-18, -h - 35],
      ],
      tint(roof, 14),
    );
    polygon(
      ctx,
      [
        [-18, -h - 35],
        [15, -h - 18],
        [33, -h],
        [0, -17 - h],
      ],
      tint(roof, -16),
    );
    polygon(
      ctx,
      [
        [0, 17 - h],
        [33, -h],
        [15, -h - 18],
      ],
      roof,
    );
    for (let i = 1; i < 5; i++) {
      ctx.strokeStyle = tint(roof, -9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-33 + 3 * i, -h - 7 * i);
      ctx.lineTo(3 * i, 17 - h - 7 * i);
      ctx.stroke();
    }
    frosted(() => {
      // Snow on the top two courses and the far slope. The shaded layer reaches 1px lower as the
      // snow's thickness; the lower courses and the gable end keep the neighbour's roof colour.
      drift(
        ctx,
        [
          [-18, -h - 35],
          [-24.4, -h - 20],
          [-8.2, -h - 10.2],
          [8.6, -h - 3],
          [15, -h - 18],
        ],
        snowShade,
      );
      drift(
        ctx,
        [
          [-18, -h - 35],
          [-24, -h - 21],
          [-8, -h - 11.2],
          [9, -h - 4],
          [12, -h - 11],
          [0, -h - 17],
        ],
        snowTop,
      );
    });
  }
  const chimney = chimneyOf(place, h);
  if (chimney) {
    const { x: chimneyX, y: chimneyY } = chimney;
    const brick = night ? '#827E6C' : '#B3977F';
    box(ctx, chimneyX, chimneyY - 13, 7, 14, brick);
    polygon(
      ctx,
      [
        [chimneyX + 7, chimneyY - 13],
        [chimneyX + 10, chimneyY - 15],
        [chimneyX + 10, chimneyY - 1],
        [chimneyX + 7, chimneyY + 1],
      ],
      tint(brick, -22),
    );
    box(ctx, chimneyX - 1, chimneyY - 15, 12, 3, tint(brick, 12));
    box(ctx, chimneyX + 2, chimneyY - 15, 6, 1, tint(brick, -35));
    box(ctx, chimneyX, chimneyY - 7, 7, 1, tint(brick, -12));
    frosted(() => {
      // Snow on the cap either side of the warm flue; on a gable the left side sits against the
      // snowy slope, so only a flat roof needs it.
      if (flat) box(ctx, chimneyX - 1, chimneyY - 16, 3, 1, snowTop);
      box(ctx, chimneyX + 8, chimneyY - 16, 3, 1, snowTop);
    });
    if (smoke && awakeInside && life)
      drawChimneySmoke(ctx, chimneyX + 5, chimneyY - 17, life.minutes, seed, night);
  }
  if (d.feature === 'balcony') {
    // A slab on the right wall's first floor line, railed on its three open sides, outside the
    // door that takes that floor's window. A one-floor home's stands a step up, as a deck.
    const deck = d.floors === 1,
      floorZ = deck ? 4 : 30,
      underZ = deck ? 0 : 28,
      railZ = floorZ + (deck ? 6 : 7),
      [from, to, out] = [3, 26, deck ? 5 : 8];
    const at = (x: number, o: number, z = floorZ) => onRight(x, o, z),
      boards = [at(from, 0), at(to, 0), at(to, out), at(from, out)],
      edge = tint(trim, -18);
    if (!deck)
      // Two knee braces carry the slab from the wall.
      for (const x of [from + 4, to - 4])
        polygon(ctx, [at(x, 0, underZ), at(x, out - 3, underZ), at(x, 0, underZ - 7)], edge);
    polygon(ctx, boards, tint(trim, 30));
    polygon(ctx, [at(from, out), at(to, out), at(to, out, underZ), at(from, out, underZ)], trim);
    polygon(ctx, [at(from, 0), at(from, out), at(from, out, underZ), at(from, 0, underZ)], edge);
    frosted(() => drift(ctx, boards, snowTop));
    // Balusters stand on the boards under a handrail: the far side, the front, then the near side.
    const baluster = ([x, y]: number[]) =>
      box(ctx, x - 0.5, y - railZ + floorZ, 1, railZ - floorZ, tint(trim, -8));
    const handrail = (a: number[], b: number[]) =>
      polygon(ctx, [a, b, [b[0], b[1] + 1.5], [a[0], a[1] + 1.5]], trim);
    const side = (x: number) => {
      for (let o = 3.5; o < out; o += 3.5) baluster(at(x, o));
      handrail(at(x, 0, railZ), at(x, out, railZ));
    };
    side(to);
    for (let i = 0; i <= 7; i++) baluster(at(from + ((to - from) * i) / 7, out));
    handrail(at(from, out, railZ), at(to, out, railZ));
    side(from);
    frosted(() => {
      const [a, b] = [at(from, out, railZ), at(to, out, railZ)];
      drift(ctx, [a, b, [b[0], b[1] - 1], [a[0], a[1] - 1]], snowTop);
    });
  }
  if (hasPorch(place)) {
    // A chair waits left of the door, under the roof, where the neighbour sits out. The porch
    // roof leans out from above the front door, so the door stays in sight beneath it.
    drawPorchChair(ctx, trim);
    paintPorchRoof(ctx, roof, trim, snow, snowTop);
  }
  if (place.decoration === 'bench') {
    const wood = tint(trim, 24),
      frame = tint(trim, -18);
    // Keep the feet and shadow inside the lawn's front-right edge.
    polygon(
      ctx,
      [
        [18, 14],
        [37, 23],
        [30, 26],
        [11, 17],
      ],
      '#23341B25',
    );
    box(ctx, 18, -4, 2, 18, frame);
    box(ctx, 34, 4, 2, 18, frame);
    box(ctx, 13, 10, 2, 7, frame);
    box(ctx, 29, 18, 2, 7, frame);
    // A raised seat with a visible front edge and two backrest slats.
    polygon(ctx, SEAT_TOPS.bench, wood);
    polygon(
      ctx,
      [
        [12, 10],
        [30, 19],
        [30, 21],
        [12, 12],
      ],
      trim,
    );
    polygon(
      ctx,
      [
        [30, 19],
        [36, 16],
        [36, 18],
        [30, 21],
      ],
      frame,
    );
    polygon(
      ctx,
      [
        [18, -4],
        [36, 5],
        [36, 8],
        [18, -1],
      ],
      wood,
    );
    polygon(
      ctx,
      [
        [18, 1],
        [36, 10],
        [36, 13],
        [18, 4],
      ],
      wood,
    );
  }
  if (place.decoration === 'mailbox') {
    box(ctx, 34, 13, 2, 14, trim);
    box(ctx, 30, 10, 9, 6, roof);
    box(ctx, 38, 8, 1, 6, '#C57B65');
    frosted(() => box(ctx, 30, 9, 8, 1, snowTop));
  }
  if (place.decoration === 'tree') {
    box(ctx, 39, 1, 3, 23, trim);
    polygon(
      ctx,
      [
        [40, -22],
        [52, -3],
        [48, -3],
        [55, 9],
        [26, 9],
        [32, -3],
        [28, -3],
      ],
      night ? '#41644E' : '#719455',
    );
    // A stepped cap on the tip, then snow resting just inside each tier's upper slopes.
    frosted(() => {
      box(ctx, 39, -21, 2, 1, snowTop);
      box(ctx, 38, -20, 4, 2, snowTop);
      for (const [left, right, top] of [
        [36, 42, -17],
        [32, 46, -10],
        [31, 47, -2],
        [28, 50, 4],
      ]) {
        box(ctx, left, top, 2, 2, snowTop);
        box(ctx, right, top, 2, 2, snowShade);
      }
    });
  }
  if (place.decoration === 'flowers')
    for (let i = 0; i < 4; i++) {
      box(ctx, 29 + i * 4, 19 + i, 1, 6, '#6C915B');
      box(ctx, 28 + i * 4, 17 + i, 3, 3, '#EABD8A');
    }
  if (place.sign.mode !== 'none') {
    ctx.save();
    ctx.transform(1, -0.5, 0, 1, 1.5, 5 - h);
    ctx.fillStyle = '#263B3540';
    ctx.fillRect(-1, 0, 29, 15);
    ctx.fillStyle = trim;
    ctx.fillRect(-1, -1, 28, 14);
    drawSign(ctx, place.sign, 26, 12);
    ctx.restore();
  }
  ctx.restore();
  // Painted last, as a sprite has it painted over its copy: nothing after the door touches it.
  if (smoke && life) drawHouseDoor(ctx, place, x, y, night, scale, life);
}
