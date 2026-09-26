import { FORK_PLOT } from '../lib/lanterns';
import { seedFraction, snowAt, type TownSeason } from '../lib/seasons';
import type { ResidentState } from '../lib/simulation';
import type { TubeParcelState } from '../lib/tube-traffic';
import {
  TUBE_ALIGHT_STEPS,
  TUBE_ALTITUDE,
  TUBE_BOARD,
  TUBE_BOARD_STEPS,
  TUBE_PARCELS,
  TUBE_SIGN_LINES,
  TUBE_STATIONS,
  TUBE_TRUNK_X,
  tubeAt,
  tubeInStack,
  tubeRoute,
  tubeStageTime,
  type ResidentTransit,
  type TubePoint,
  type TubeStation,
} from '../lib/tubes';
import { PLOTS, getPlot, project, type Point } from '../lib/world';
import { drawGlow } from './glow';
import { tint } from './houses';
import { lampOn, MAX_LAMP_DISTANCE, MIN_LAMP_DISTANCE } from './lamplight';
import { drawResident } from './residents';
import { SNOW, pick, type Pair } from './season-palette';

// The Treeline in three layers, like the Millpond:
//  1. drawTubeGround: the stations' stone pads, the trunk's posts and the glass behind the tree
//     line (both elbows and the trunk). It is painted into the cached ground layer, so it reads
//     only `night`, the zoom, the emphasis and the view.
//  2. drawTubeTraffic: per frame, straight after the ground: riders and parcels in that glass, so
//     every edge tree stands in front of them.
//  3. drawTubes: depth objects: the spur pieces with whoever rides in them, the corner bubbles,
//     the spur posts, the stacks (with anyone boarding or stepping off inside), the first
//     station's sign and umbrella stand, and the puffs of air.
// Model and art read the same routes (src/lib/tubes.ts), and a rider's straight sprite is cut
// where its glass turns, so a rider is always inside the glass.
// The line is quiet on purpose: 5-px glass that fades as the map zooms out, stations lower than a
// cottage, no snow on the glass, and amber only in a lit lamp.

type Ctx = CanvasRenderingContext2D;
type Visible = (point: Point, rx: number, above: number, below: number) => boolean;
type Look = ResidentState['resident'];

export type TubeEmphasis = 'none' | 'hover' | 'selected';
export type TubeScene = {
  minutes: number;
  day: number;
  night: boolean;
  season: TownSeason;
  /** camera.zoom: the glass fades as the map zooms out. */
  zoom: number;
  /** Selected if a station plot is selected, else hover if one is hovered. */
  emphasis: TubeEmphasis;
  /** render.ts's own culling. */
  visible: Visible;
  residents: readonly ResidentState[];
  /** Lazy: evaluated at most once per frame, and only if some tube art is in view. */
  parcels: () => readonly TubeParcelState[];
  followed?: string | null;
};
export type TubePart = 'spur' | 'bubble' | 'post' | 'stack' | 'sign' | 'stand' | 'puff';
/** A depth object, tagged for the tests: `ground` is its contact point (tiles) and `slope` the
 * screen slope of its footprint through it (±0.5 along a spur piece, 0.5 for the sign's plate). */
export type TubeObject = {
  depth: number;
  paint: () => void;
  part: TubePart;
  station: string;
  ground: Point;
  slope: number;
};
/** A run of glass: part of one station's spur, or a run of trunk. Pieces behind the tree line
 * are painted before the sort; the rest are sorted. */
export type TubePiece = {
  /** Its glass centreline, in the order a ride from the line's north end meets it. */
  points: readonly TubePoint[];
  layer: 'ground' | 'spur';
  /** Mean x + y of the piece's points − 0.25 for a spur piece; −1 for the ground layer. */
  depth: number;
  station: string;
};
export type TubePainter =
  { kind: 'traffic' } | { kind: 'spur'; piece: number } | { kind: 'stack'; station: string };

// ---------------------------------------------------------------------------------------------
// Small helpers

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
/** A table built on first use, so importing the renderer costs nothing. */
function lazy<T>(build: () => T) {
  let value: T | undefined;
  return () => (value ??= build());
}
function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function diamond(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.beginPath();
  ctx.moveTo(x, y - ry);
  ctx.lineTo(x + rx, y);
  ctx.lineTo(x, y + ry);
  ctx.lineTo(x - rx, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
/** A route point on screen: its ground point, lifted by the glass centreline's height. */
const lifted = (p: TubePoint): Point => {
  const g = project(p.x, p.y);
  return { x: g.x, y: g.y - p.h };
};
const rounded = (p: Point) => {
  const g = project(p.x, p.y);
  return { x: Math.round(g.x), y: Math.round(g.y) };
};

// ---------------------------------------------------------------------------------------------
// Palette: [day, night]. The glass stays cool at night; amber is only the lit lamp and its glow.

const GLASS = {
  body: ['#B9D8CE3A', '#4F71743A'],
  hi: ['#F3FAF28C', '#8FAEA873'],
  rim: ['#6F948C73', '#2C454699'],
  bubble: ['#C3DED53A', '#58797C3A'],
  /** A faint pane over anyone standing in a stack, so they read as behind glass. */
  front: ['#D5E9E233', '#6C8C8C33'],
  /** Over a rider or a parcel in the glass, so it reads as inside. */
  wash: ['#B9D8CE47', '#4F717447'],
  /** Selected: the Millpond's pale gold, 3 px wider than the glass. */
  halo: ['#F2E2A1CC', '#B5C59BA0'],
  /** Hovered: the highlight row turns pale gold along the whole line, at no extra calls. */
  hoverHi: ['#F2E2A1E6', '#B5C59BCC'],
  /** A followed rider's glass glows faintly gold. */
  followWash: ['#F2E2A166', '#B5C59B66'],
} as const satisfies Record<string, Pair>;
const METAL = {
  post: ['#8E9A88', '#46605A'],
  side: ['#6F7C6B', '#34494A'],
} as const satisfies Record<string, Pair>;
/** The streetlamp's hood. */
const HOOD = {
  face: ['#748269', '#4F6358'],
  top: ['#8B9A7F', '#5E7266'],
} as const satisfies Record<string, Pair>;
const PAD = {
  stone: ['#DDD3B3', '#7F8A79'],
  edge: ['#C3BD95', '#5E6E63'],
} as const satisfies Record<string, Pair>;
/** Lawn-green enamel. The ink is never brightened at night: the plate is not lit. */
const PLATE = {
  face: ['#CFDDB9', '#6F8676'],
  border: ['#6F8B66', '#3F5750'],
  ink: ['#2F4A3B', '#1F302A'],
} as const satisfies Record<string, Pair>;
/** The streetlamp's own face: pale by day, grey at night until the wave reaches it. */
const LAMP = {
  face: ['#EDE5C1', '#7C8272'],
  lit: ['#F4D79A', '#F4D79A'],
} as const satisfies Record<string, Pair>;
const KRAFT = {
  box: ['#C4A57A', '#6E6250'],
  string: ['#8B6A48', '#4A4034'],
  cap: ['#D8C288', '#9A8E6A'],
} as const satisfies Record<string, Pair>;
const UMBRELLA = {
  cloth: ['#7B5A78', '#4B3E4C'],
  handle: ['#6B4A2E', '#3D3129'],
  bucket: ['#B39B63', '#766C52'],
  rim: ['#D8C288', '#9A8E6A'],
} as const satisfies Record<string, Pair>;
const PUFF: Pair = ['#F1F5EAB0', '#9DB0AA90'];
const PUFF_GRASS: Pair = ['#7E9C60', '#6B8B73'];
const SHADOW: Pair = ['#23341B30', '#0B171540'];
/** The follow diamond under a followed neighbor's feet, as in the resident loop. */
const FOLLOW: Pair = ['#FFF7D5', '#F0DBA575'];
/** drawResident's leg colour, for the riders' trousers. */
const TROUSERS = '#3C4744';
/** Riders are dimmed by this much at night, like the rest of the town's colours. */
const NIGHT_DIM = -40;

/** Every colour the Treeline paints, by name, for the tests. */
export const TUBE_PALETTE: Record<string, readonly [day: string, night: string]> = {
  ...Object.fromEntries(
    Object.entries({ GLASS, METAL, HOOD, PAD, PLATE, LAMP, KRAFT, UMBRELLA }).flatMap(
      ([group, pairs]) => Object.entries(pairs).map(([name, pair]) => [`${group}.${name}`, pair]),
    ),
  ),
  PUFF,
  PUFF_GRASS,
  SHADOW,
  FOLLOW,
  TROUSERS: [TROUSERS, tint(TROUSERS, NIGHT_DIM)],
};

// ---------------------------------------------------------------------------------------------
// Geometry: each station's spur and the trunk between them, cut into pieces
//
// TUBE_STATIONS runs north to south, so a station's spur toward the station after it heads
// south (+1) and toward the one before it north (−1); tubeRoute picks the same way from the
// docks. The first and last stations have one spur each. A station between two others has both,
// and they share everything but the elbow. Every ride is its boarding station's spur, one run of
// trunk and its alighting station's spur backwards, so any ride between any two stations maps
// onto these pieces. See docs/TUBES.md, "Growing the line".

type Heading = 1 | -1;
const FIRST = TUBE_STATIONS[0];
TUBE_STATIONS.forEach((station, i) => {
  if (i > 0 && !(station.dock.y > TUBE_STATIONS[i - 1].dock.y))
    throw new Error(`The Treeline runs north to south, but ${station.id} is out of order.`);
});
const behind = (p: TubePoint) => p.x <= 0.001;
const onTrunk = (a: TubePoint, b: TubePoint) => a.x === TUBE_TRUNK_X && b.x === TUBE_TRUNK_X;
const groundStep = (a: TubePoint, b: TubePoint) => Math.hypot(b.x - a.x, b.y - a.y);
const samePoint = (a: TubePoint, b: TubePoint) => a.x === b.x && a.y === b.y && a.h === b.h;
const isCorner = (p: TubePoint) =>
  TUBE_STATIONS.some((s) => Math.abs(s.dock.x - p.x) < 1e-9 && Math.abs(s.dock.y - p.y) < 1e-9);
const nearestStation = (y: number) =>
  TUBE_STATIONS.reduce((best, s) =>
    Math.abs(s.dock.y - y) < Math.abs(best.dock.y - y) ? s : best,
  );
const headingOf = (from: string, to: string): Heading =>
  TUBE_STATIONS.findIndex((s) => s.id === to) > TUBE_STATIONS.findIndex((s) => s.id === from)
    ? 1
    : -1;

/** The one segment of a route that runs along the trunk. Memoised by route. */
const TRUNK_SEGMENT = new WeakMap<readonly TubePoint[], number>();
function trunkSegment(route: readonly TubePoint[]) {
  let k = TRUNK_SEGMENT.get(route);
  if (k === undefined) {
    k = route.findIndex((p, i) => i + 1 < route.length && onTrunk(p, route[i + 1]));
    if (k < 0) throw new Error('A Treeline route that never reaches the trunk.');
    TRUNK_SEGMENT.set(route, k);
  }
  return k;
}
/** A station's spur toward its neighbour that way: stack top first, ending on the trunk. */
function spurOf(station: TubeStation, heading: Heading): readonly TubePoint[] {
  const next = TUBE_STATIONS[TUBE_STATIONS.indexOf(station) + heading];
  if (!next)
    throw new Error(
      `The Treeline has no station ${heading > 0 ? 'south' : 'north'} of ${station.id}.`,
    );
  const route = tubeRoute(station.id, next.id);
  return route.slice(0, trunkSegment(route) + 1);
}
const slotOf = (station: string, heading: Heading) => `${station}:${heading}`;

/**
 * Along the line from its north end: the first station's spur, then for each next station the
 * trunk down to it, its spur (a middle station: its north elbow, the trunk between its two
 * elbows, where its T will stand, then its spur south). Segment 0 of a spur is inside its stack's
 * top. Segments with both ends at x ≤ 0 are behind the tree line: one ground piece per elbow and
 * one per run of trunk. The rest are spur pieces of at most half a tile, never across a corner,
 * each sorted at its mean x + y − 0.25, so the column-0 pieces go behind the edge tree in front
 * of them. `owners` says which piece draws each segment of each station's spur either way.
 */
const PLAN = (() => {
  const pieces: TubePiece[] = [];
  const owners = new Map<string, number[]>();
  const own = (station: string, heading: Heading, segment: number, piece: number) => {
    const slot = slotOf(station, heading);
    const list = owners.get(slot) ?? [];
    list[segment] = piece;
    owners.set(slot, list);
  };
  const trunk = (a: TubePoint, b: TubePoint) =>
    pieces.push({
      points: [a, b],
      layer: 'ground',
      depth: -1,
      station: nearestStation((a.y + b.y) / 2).id,
    });
  /** Cuts segments first..last of a polyline into pieces, telling `serve` who owns each. */
  const cut = (
    points: readonly TubePoint[],
    first: number,
    last: number,
    station: string,
    serve: (segment: number, piece: number) => void,
  ) => {
    let run: number[] = [];
    const close = () => {
      if (!run.length) return;
      const slice = points.slice(run[0], run.at(-1)! + 2);
      const ground = slice.every(behind);
      const mean = slice.reduce((sum, p) => sum + p.x + p.y, 0) / slice.length;
      const index =
        pieces.push({
          points: slice,
          layer: ground ? 'ground' : 'spur',
          depth: ground ? -1 : mean - 0.25,
          station,
        }) - 1;
      for (const k of run) serve(k, index);
      run = [];
    };
    for (let j = first; j <= last; j++) {
      const a = points[j],
        b = points[j + 1];
      const ground = behind(a) && behind(b);
      if (run.length) {
        const p = points[run[0]],
          q = points[run[0] + 1];
        const length = run.reduce((sum, k) => sum + groundStep(points[k], points[k + 1]), 0);
        if (
          ground !== (behind(p) && behind(q)) ||
          (!ground && length + groundStep(a, b) > 0.5 + 1e-9)
        )
          close();
      }
      run.push(j);
      if (isCorner(b)) close();
    }
    close();
  };
  let trunkFrom: TubePoint | undefined;
  TUBE_STATIONS.forEach((station, i) => {
    const id = station.id;
    const north = i > 0 ? spurOf(station, -1) : undefined;
    const south = i + 1 < TUBE_STATIONS.length ? spurOf(station, 1) : undefined;
    let shared = 0;
    const common = north && south ? Math.min(north.length, south.length) : 0;
    while (shared < common && samePoint(north![shared], south![shared])) shared++;
    if (north && south && shared < 2)
      throw new Error(`The Treeline's two spurs at ${id} should share all but the elbow.`);
    if (north) {
      own(id, -1, 0, -1);
      trunk(trunkFrom!, north.at(-1)!);
      // Trunk first: the elbow alone at a middle station, the whole spur at the last.
      const track = north.slice(south ? shared - 1 : 0).reverse();
      const n = north.length - 1;
      cut(track, 0, track.length - (south ? 2 : 3), id, (t, piece) =>
        own(id, -1, n - 1 - t, piece),
      );
      trunkFrom = north.at(-1);
    }
    if (south) {
      own(id, 1, 0, -1);
      if (north) trunk(trunkFrom!, south.at(-1)!);
      cut(south, 1, south.length - 2, id, (k, piece) => {
        own(id, 1, k, piece);
        if (north && k < shared - 1) own(id, -1, k, piece);
      });
      trunkFrom = south.at(-1);
    }
  });
  return { pieces, owners };
})();
export const TUBE_PIECES: readonly TubePiece[] = PLAN.pieces;
/** A piece's glass centreline on screen. */
const SCREEN = new WeakMap<object, readonly Point[]>();
const screenOf = (points: readonly TubePoint[]) => {
  let screen = SCREEN.get(points);
  if (!screen) SCREEN.set(points, (screen = points.map(lifted)));
  return screen;
};

/** Who draws segment `index` of the route from → to. Throws for a segment the art cannot place,
 * so a station added without its art fails loudly instead of drawing riders in the wrong glass. */
function painterOf(from: string, to: string, index: number): TubePainter {
  const route = tubeRoute(from, to);
  const last = route.length - 2;
  if (index <= 0) return { kind: 'stack', station: from };
  if (index >= last) return { kind: 'stack', station: to };
  const trunk = trunkSegment(route);
  if (index === trunk) return { kind: 'traffic' };
  const heading = headingOf(from, to);
  const piece =
    index < trunk
      ? PLAN.owners.get(slotOf(from, heading))?.[index]
      : PLAN.owners.get(slotOf(to, -heading as Heading))?.[last - index];
  if (piece === undefined || piece < 0)
    throw new Error(`The Treeline has no glass for segment ${index} of ${from} → ${to}.`);
  return TUBE_PIECES[piece].layer === 'ground' ? { kind: 'traffic' } : { kind: 'spur', piece };
}
/** Who draws a capsule `distance` tiles along from → to: the pre-sort traffic pass (elbows and
 * trunk), one spur piece, or a stack (the first and last 0.15 tiles, inside its top). */
export function tubePainterFor(from: string, to: string, distance: number): TubePainter {
  return painterOf(from, to, tubeAt(from, to, distance).index);
}

/** Trunk posts on the middle row of every block the trunk passes (15.5, 19.5, …): 4 tiles apart,
 * mid-block and never beside a road end. None on a station's own row, where a station between
 * two others has its T. */
export const TUBE_TRUNK_POSTS: readonly Point[] = (() => {
  const trunk = TUBE_PIECES.filter((piece) => piece.points.every((p) => p.x === TUBE_TRUNK_X));
  const top = Math.min(...trunk.map((piece) => piece.points[0].y)),
    bottom = Math.max(...trunk.map((piece) => piece.points.at(-1)!.y));
  const rows = [...new Set(PLOTS.map((plot) => plot.y + 0.5))].sort((a, b) => a - b);
  return rows
    .filter((y) => y > top && y < bottom && !TUBE_STATIONS.some((s) => s.dock.y === y))
    .map((y) => ({ x: TUBE_TRUNK_X, y }));
})();
const TRUNK_POST_HEIGHT = Math.round(TUBE_ALTITUDE.trunk - TUBE_ALTITUDE.radius);
/** Where each spur's one post stands: in the tree-free column-0 tile of its row. */
const SPUR_POST_X = 0.62;
/** The glass centreline's lift over ground x along a station's own spur row. */
function spurLift(station: TubeStation, x: number) {
  const spur = spurOf(station, station === FIRST ? 1 : -1);
  for (let i = 1; i < spur.length; i++) {
    const a = spur[i - 1],
      b = spur[i];
    if (a.y !== station.dock.y || b.y !== station.dock.y) continue;
    if (x <= Math.max(a.x, b.x) && x >= Math.min(a.x, b.x))
      return a.h + ((b.h - a.h) * (x - a.x)) / (b.x - a.x || 1);
  }
  throw new Error(`${station.id}'s spur never passes x = ${x} on its own row.`);
}
const SPUR_POSTS = lazy(() =>
  TUBE_STATIONS.map((station) => ({
    station,
    ground: { x: SPUR_POST_X, y: station.dock.y },
    height: Math.round(spurLift(station, SPUR_POST_X) - TUBE_ALTITUDE.radius),
  })),
);
/** The first station's sign and umbrella stand, placed from its stack's foot: the sign east of
 * it, where walkers from the Fork pass it first, and the stand west of the walk in. */
const SIGN_FOOT = { x: FIRST.stack.x + 0.9, y: FIRST.stack.y + 0.15 };
const STAND_FOOT = { x: FIRST.stack.x - 0.3, y: FIRST.stack.y + 0.1 };
const SIGN_DEPTH = SIGN_FOOT.x + SIGN_FOOT.y;
const STAND_DEPTH = STAND_FOOT.x + STAND_FOOT.y;
const stackDepth = (station: TubeStation) => station.stack.x + station.stack.y;

// The lamp in each hood lights in the streetlamps' wave, by its distance from the Fork.
const FORK = getPlot(FORK_PLOT)!;
const lampDistance = (station: TubeStation) =>
  Math.min(
    MAX_LAMP_DISTANCE,
    Math.max(
      MIN_LAMP_DISTANCE,
      Math.abs(station.stack.x - (FORK.x + 0.5)) + Math.abs(station.stack.y - (FORK.y + 0.5)),
    ),
  );

/** Level of detail: the glass fades to about a third of its strength when the map is zoomed out
 * (0.40 in the opening view, 0.35 for the whole town) and is full strength from zoom 1.3, or
 * whenever a station is hovered or selected. Stations, posts and sprites never fade. */
export function glassLod(zoom: number, emphasis: TubeEmphasis): number {
  return emphasis !== 'none' ? 1 : Math.max(0.35, Math.min(1, (zoom - 0.3) / 1.0));
}
const highlight = (emphasis: TubeEmphasis, night: boolean) =>
  pick(emphasis === 'hover' ? GLASS.hoverHi : GLASS.hi, night);

/** Whether any of a piece's glass (with its halo) is in view. */
function pieceVisible(piece: TubePiece, visible: Visible) {
  const points = screenOf(piece.points);
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  return visible({ x: (left + right) / 2, y: bottom }, (right - left) / 2 + 6, bottom - top + 6, 6);
}

// ---------------------------------------------------------------------------------------------
// Glass

/** One straight run of glass as a vertical-slice parallelogram: consecutive runs share their end
 * edges exactly, so the translucent glass never doubles up. 6 calls, 7 when selected. */
function slice(ctx: Ctx, a: Point, b: Point, emphasis: TubeEmphasis, night: boolean) {
  const dx = b.x - a.x;
  if (Math.abs(dx) < 0.01) return;
  ctx.save();
  ctx.transform(1, (b.y - a.y) / dx, 0, 1, a.x, a.y);
  if (emphasis === 'selected') box(ctx, 0, -4, dx, 8, pick(GLASS.halo, night));
  box(ctx, 0, -2.5, dx, 5, pick(GLASS.body, night));
  box(ctx, 0, -2.5, dx, 1, highlight(emphasis, night));
  box(ctx, 0, 1.5, dx, 1, pick(GLASS.rim, night));
  ctx.restore();
}
function paintGlass(
  ctx: Ctx,
  piece: TubePiece,
  emphasis: TubeEmphasis,
  night: boolean,
  lod: number,
) {
  const points = screenOf(piece.points);
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * lod;
  for (let k = 1; k < points.length; k++) slice(ctx, points[k - 1], points[k], emphasis, night);
  ctx.globalAlpha = alpha;
}
/** The glass ball where a spur's leg turns west, or where a middle station's elbows meet the
 * trunk. It hides the joint of the runs. */
function paintBubble(ctx: Ctx, at: Point, emphasis: TubeEmphasis, night: boolean, lod: number) {
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * lod;
  if (emphasis === 'selected') {
    ctx.fillStyle = pick(GLASS.halo, night);
    ctx.beginPath();
    ctx.arc(at.x, at.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = pick(GLASS.bubble, night);
  ctx.beginPath();
  ctx.arc(at.x, at.y, 4, 0, Math.PI * 2);
  ctx.fill();
  const x = Math.round(at.x),
    y = Math.round(at.y);
  box(ctx, x - 2, y - 3, 2, 1, highlight(emphasis, night));
  box(ctx, x - 2, y + 3, 4, 1, pick(GLASS.rim, night));
  ctx.globalAlpha = alpha;
}
/** A slim post up to the glass's underside: a lit side, a shade side and a shadow. */
function paintPost(ctx: Ctx, ground: Point, height: number, night: boolean) {
  const { x, y } = rounded(ground);
  box(ctx, x - 2, y, 5, 1, pick(SHADOW, night));
  box(ctx, x - 1, y - height, 1, height, pick(METAL.post, night));
  box(ctx, x, y - height, 1, height, pick(METAL.side, night));
}

// ---------------------------------------------------------------------------------------------
// Riders and parcels in the glass

type Capsule = {
  id: string;
  kind: 'rider' | 'parcel';
  look?: Look;
  from: string;
  to: string;
  distance: number;
  /** Screen point of the centreline, the owning segment's slope, and which way is forward. */
  at: Point;
  slope: number;
  forward: number;
  /** The ride's glass centreline on screen, and the segment the capsule is on. */
  screen: readonly Point[];
  index: number;
  /** Px drawn behind along the glass, when two riders are this close together. */
  back: number;
  painter: TubePainter;
};
function placeCapsule(capsule: Pick<Capsule, 'id' | 'kind' | 'look' | 'from' | 'to' | 'distance'>) {
  const where = tubeAt(capsule.from, capsule.to, capsule.distance);
  const screen = screenOf(tubeRoute(capsule.from, capsule.to));
  const a = screen[where.index],
    b = screen[where.index + 1];
  const g = project(where.position.x, where.position.y);
  const dx = b.x - a.x;
  return {
    ...capsule,
    at: { x: g.x, y: g.y - where.altitude },
    slope: Math.abs(dx) < 0.01 ? 0 : (b.y - a.y) / dx,
    forward: Math.sign(dx) || 1,
    screen,
    index: where.index,
    back: 0,
    painter: painterOf(capsule.from, capsule.to, where.index),
  } satisfies Capsule;
}
/** Everyone and everything in the glass this frame, each with the one painter that draws it. */
function capsulesOf(scene: TubeScene): Capsule[] {
  const list: Capsule[] = [];
  for (const resident of scene.residents) {
    const transit = resident.transit;
    if (transit?.stage !== 'riding') continue;
    list.push(
      placeCapsule({
        id: resident.id,
        kind: 'rider',
        look: resident.resident,
        from: transit.from,
        to: transit.to,
        distance: transit.distance,
      }),
    );
  }
  for (const parcel of scene.parcels())
    if (parcel.stage === 'riding')
      list.push(
        placeCapsule({
          id: parcel.id,
          kind: 'parcel',
          from: parcel.from,
          to: parcel.to,
          distance: parcel.distance,
        }),
      );
  // Two riders this close on the same ride travel nose to tail, in id order.
  for (const capsule of list) {
    if (capsule.kind !== 'rider') continue;
    const ahead = list.filter(
      (other) =>
        other.kind === 'rider' &&
        other.from === capsule.from &&
        other.to === capsule.to &&
        Math.abs(other.distance - capsule.distance) <= 0.45 &&
        other.id < capsule.id,
    ).length;
    capsule.back = 4 * ahead;
  }
  return list;
}
/** How far a capsule's straight sprite may reach along u from its centre, back (−1) or ahead
 * (+1), before its glass turns away: the middle of a stack's top at either end of the ride, a
 * corner where the glass doubles back on screen, or where a dip or an elbow curves more than
 * BEND px off the sprite's line. At most `cap`. */
const BEND = 0.5;
function reach(capsule: Capsule, way: 1 | -1, cap: number) {
  const { screen, index, at, slope, forward } = capsule;
  // `along` is u from the sprite's pixel-rounded origin; `gap` is how far the glass has bent away
  // from the sprite's line, which runs through the capsule itself.
  const x0 = Math.round(at.x);
  const gapOf = (p: Point) => p.y - at.y - slope * (p.x - at.x);
  let along = way * forward * (at.x - x0),
    gap = 0;
  for (let k = way > 0 ? index + 1 : index; k >= 0 && k < screen.length; k += way) {
    const next = way * forward * (screen[k].x - x0),
      nextGap = gapOf(screen[k]);
    if (next < along) break;
    if (Math.abs(nextGap) > BEND) {
      const edge = Math.sign(nextGap) * BEND;
      return Math.min(cap, along + ((next - along) * (edge - gap)) / (nextGap - gap));
    }
    if (next >= cap) return cap;
    along = next;
    gap = nextGap;
  }
  return Math.min(cap, along);
}
/** A capsule lying along its glass segment, head first, in local u (forward) and v (down); then
 * a pane of glass and the highlight row over it at the glass's own strength, so it reads as
 * inside. Every box is cut where the glass turns away (`reach`), so nothing pokes out at a
 * corner, a bend or a stack's top. A rider is at most 11 calls, a parcel 9. */
function paintCapsule(ctx: Ctx, capsule: Capsule, scene: TubeScene, lod: number) {
  const { night } = scene;
  const look = capsule.look;
  const [tail, head] = look ? [-13, 4] : [-9, 3];
  const f = capsule.forward,
    shift = -capsule.back;
  const low = -reach(capsule, -1, -tail - shift),
    high = reach(capsule, 1, head);
  ctx.save();
  // On whole pixel columns, and on the glass's own centreline at that column.
  const x0 = Math.round(capsule.at.x);
  ctx.transform(1, capsule.slope, 0, 1, x0, capsule.at.y + capsule.slope * (x0 - capsule.at.x));
  const part = (u0: number, u1: number, v0: number, v1: number, color: string) => {
    const a = Math.max(u0 + shift, low),
      b = Math.min(u1 + shift, high);
    if (b > a) box(ctx, f > 0 ? a : -b, v0, b - a, v1 - v0, color);
  };
  if (look) {
    const dim = (color: string) => (night ? tint(color, NIGHT_DIM) : color);
    part(-13, -6, 0, 1, dim(look.outfit) + '40');
    part(-6, -3, -0.5, 1.5, dim(look.outfit) + '80');
    part(-3, -1, 0, 1.5, dim(TROUSERS));
    part(-1, 2, -1, 1.5, dim(look.outfit));
    part(2, 4, -1, 1, dim(look.skin));
    part(1, 4, -1.5, -0.5, dim(look.hair));
  } else {
    // A string-tied kraft parcel between two end caps: one cap-coloured bar under the box.
    part(-9, -3, 0, 1, pick(KRAFT.box, night) + '50');
    part(-3, 3, -1.5, 1.5, pick(KRAFT.cap, night));
    part(-2, 2, -1.5, 1.5, pick(KRAFT.box, night));
    part(-0.5, 0.5, -1.5, 1.5, pick(KRAFT.string, night));
  }
  ctx.globalAlpha *= lod;
  part(
    tail,
    head,
    -2.5,
    2.5,
    pick(scene.followed === capsule.id ? GLASS.followWash : GLASS.wash, night),
  );
  part(tail, head, -2.5, -1.5, highlight(scene.emphasis, night));
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Stations

/** Whether the Treeline draws this neighbour (riding in the glass, or inside a stack) instead of
 * the resident loop. Such a neighbour is never hit either: clicking them selects the line. */
export const inTubeGlass = (transit: ResidentTransit | undefined) =>
  !!transit && (transit.stage === 'riding' || tubeInStack(transit));
const stationOf = (transit: ResidentTransit) =>
  transit.stage === 'boarding' ? transit.from : transit.to;
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const STANDING = { moving: false, facing: 'sw', walkPhase: 0, greeting: false } as const;

/** A figure's pose in the stack: the turn, the crouch and the fwoomp up into the hood when
 * boarding; the drop and the settle when stepping off. The i-th of several goes 0.04 min later.
 * Undefined while it is still above the hood. */
function stackPose(transit: ResidentTransit, i: number) {
  const t = tubeStageTime(transit),
    lag = 0.04 * i;
  if (transit.stage === 'boarding') {
    if (t < TUBE_BOARD_STEPS.turn + lag) return { lift: 0, sx: 1, sy: 1 };
    const crouch = TUBE_BOARD_STEPS.crouch + lag;
    if (t < crouch) return { lift: 0, sx: 1.08, sy: 0.86 };
    const k = clamp01((t - crouch) / (TUBE_BOARD - crouch));
    return { lift: 50 * k * k, sx: 0.72, sy: 1.38 };
  }
  const { drop, settle } = TUBE_ALIGHT_STEPS;
  if (t < lag) return undefined;
  if (t < drop) {
    const k = 1 - (t - lag) / (drop - lag);
    return { lift: 46 * k * k, sx: 0.75, sy: 1.32 };
  }
  const k = clamp01((t - drop) / (settle - drop));
  return { lift: 0, sx: 1.08 - 0.08 * k, sy: 0.86 + 0.14 * k };
}
/** How high a parcel sits in the stack: on the pad, rising into the hood, or dropping out of it. */
function parcelLift(parcel: TubeParcelState) {
  const t = parcel.progress * TUBE_PARCELS.wait;
  if (parcel.stage === 'sending') return t < 0.4 ? 3 : 3 + (36 * (t - 0.4)) / 0.1;
  return t < 0.1 ? 39 - (36 * t) / 0.1 : 3;
}
type Traveller = ResidentState & { transit: ResidentTransit };
type Inside = {
  figures: Traveller[];
  parcels: TubeParcelState[];
  capsules: Capsule[];
};
/** The glass stack: collar, glass, anyone and anything inside, hood with the lamp. 10 calls
 * empty. */
function paintStack(ctx: Ctx, station: TubeStation, scene: TubeScene, inside: Inside) {
  const { night } = scene;
  const { x, y } = rounded(station.stack);
  const { figures, parcels } = inside;
  if (scene.followed && figures.some((figure) => figure.id === scene.followed))
    diamond(ctx, x, y + 2, 10, 5, pick(FOLLOW, night));
  box(ctx, x - 7, y - 3, 14, 3, pick(METAL.post, night));
  box(ctx, x + 2, y - 3, 5, 3, pick(METAL.side, night));
  box(ctx, x - 6, y - 41, 12, 38, pick(GLASS.body, night));
  if (figures.length || parcels.length) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 6, y - 41, 12, 41);
    ctx.clip();
    // Parcels first: the figures below leave their transforms to the clip's restore.
    for (const parcel of parcels) {
      const top = Math.round(y - 3 - parcelLift(parcel));
      box(ctx, x - 2, top, 5, 3, pick(KRAFT.box, night));
      box(ctx, x, top, 1, 3, pick(KRAFT.string, night));
    }
    figures.forEach((figure, i) => {
      const pose = stackPose(figure.transit, i);
      if (!pose) return;
      // Stretched or squashed about the feet. The clip's restore undoes the last figure's
      // transform, so only the others save their own.
      const last = i === figures.length - 1;
      if (!last) ctx.save();
      const offset = (i - (figures.length - 1) / 2) * 3;
      ctx.transform(pose.sx, 0, 0, pose.sy, x + offset, y - 2 - pose.lift);
      drawResident(ctx, figure.resident, 0, 0, 1.25, STANDING, { shadow: false });
      if (!last) ctx.restore();
    });
    ctx.restore();
    box(ctx, x - 6, y - 41, 12, 38, pick(GLASS.front, night));
  }
  // Anyone just leaving or reaching the stack's top (the first and last 0.15 tiles of a ride),
  // cut at the middle of the top and behind the front of the glass, the collar and the hood.
  const lod = glassLod(scene.zoom, scene.emphasis);
  for (const capsule of inside.capsules) paintCapsule(ctx, capsule, scene, lod);
  // The front of the glass: one bright edge, one glint and the rim.
  box(ctx, x - 5, y - 40, 1, 36, pick(GLASS.hi, night));
  ctx.fillRect(x - 3, y - 35, 1, 5);
  box(ctx, x + 5, y - 41, 1, 38, pick(GLASS.rim, night));
  box(ctx, x - 7, y - 44, 14, 3, pick(METAL.post, night));
  box(ctx, x - 8, y - 47, 16, 3, pick(HOOD.face, night));
  box(ctx, x - 7, y - 48, 14, 1, pick(HOOD.top, night));
  const lit = night && lampOn(lampDistance(station), scene.minutes);
  box(ctx, x - 2, y - 43, 4, 1, pick(lit ? LAMP.lit : LAMP.face, night));
  const snow = snowAt(scene.season.yearDay, seedFraction(`tube:${station.id}`));
  if (snow > 0) {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * snow;
    box(ctx, x - 7, y - 49, 14, 2, pick(SNOW.top, night));
    ctx.globalAlpha = alpha;
  }
  if (lit) {
    drawGlow(ctx, x, y - 42, 16, 0.24);
    drawGlow(ctx, x, y - 2, 12, 0.1);
  }
}
/** The first station's sign: a small enamel plate on one post, turned to face the road. */
function paintSign(ctx: Ctx, scene: TubeScene) {
  const { night } = scene;
  const { x, y } = rounded(SIGN_FOOT);
  box(ctx, x - 2, y, 5, 1, pick(SHADOW, night));
  box(ctx, x - 1, y - 9, 2, 9, pick(METAL.side, night));
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, x, y);
  box(ctx, -22, -24, 44, 15, pick(PLATE.border, night));
  box(ctx, -21, -23, 42, 13, pick(PLATE.face, night));
  const snow = snowAt(scene.season.yearDay, seedFraction(`tube:${FIRST.id}`));
  if (snow > 0) {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * snow;
    box(ctx, -22, -25, 44, 1, pick(SNOW.top, night));
    ctx.globalAlpha = alpha;
  }
  ctx.fillStyle = pick(PLATE.ink, night);
  ctx.font = 'bold 4px "Space Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(TUBE_SIGN_LINES[0], 0, -19.1, 41);
  ctx.fillText(TUBE_SIGN_LINES[1], 0, -14.8, 41);
  ctx.fillText(TUBE_SIGN_LINES[2], 0, -10.5, 41);
  ctx.restore();
}
/** A brass bucket by the walk in, with one furled plum umbrella that somebody did remove. */
function paintStand(ctx: Ctx, scene: TubeScene) {
  const { night } = scene;
  const { x, y } = rounded(STAND_FOOT);
  box(ctx, x - 3, y, 7, 1, pick(SHADOW, night));
  box(ctx, x - 1, y - 15, 2, 10, pick(UMBRELLA.cloth, night));
  box(ctx, x - 1, y - 17, 3, 1, pick(UMBRELLA.handle, night));
  ctx.fillRect(x + 1, y - 16, 1, 1);
  box(ctx, x - 3, y - 6, 6, 6, pick(UMBRELLA.bucket, night));
  box(ctx, x - 3, y - 6, 6, 1, pick(UMBRELLA.rim, night));
  const snow = snowAt(scene.season.yearDay, seedFraction(`tube:${FIRST.id}`));
  if (snow > 0) {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * snow;
    box(ctx, x - 3, y - 7, 6, 1, pick(SNOW.top, night));
    ctx.globalAlpha = alpha;
  }
}
/** A puff lasts half a minute; the one at the drop starts 0.08 min into stepping off. */
const PUFF_TIMES = { minutes: 0.5, drop: 0.08 } as const;
/** A soft puff of air at the stack's foot, `age` minutes old: two rings and four grass bits. */
function paintPuff(ctx: Ctx, station: TubeStation, age: number, night: boolean) {
  const c = project(station.stack.x, station.stack.y);
  const k = clamp01(age / PUFF_TIMES.minutes);
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * (1 - k);
  ctx.strokeStyle = pick(PUFF, night);
  ctx.lineWidth = 1;
  for (const r of [9 + 12 * k, 5 + 16 * k]) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 1, r, r / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = pick(PUFF_GRASS, night);
  for (const [dx, lift] of [
    [-1, 1],
    [1, 1.3],
    [-0.6, 1.6],
    [0.7, 0.8],
  ])
    ctx.fillRect(
      Math.round(c.x + dx * 16 * k),
      Math.round(c.y - 3 - lift * 22 * k * (1 - k)),
      1,
      1,
    );
  ctx.globalAlpha = alpha;
}
/** The puffs at each station: at the fwoomp (boarding 1.88 on into the ride) and at the drop
 * (stepping off 0.08 on), each half a minute. Figures in lockstep share one. */
function puffsAt(residents: readonly ResidentState[]) {
  const ages = new Map<string, number[]>();
  for (const { transit } of residents) {
    if (!transit) continue;
    const t = tubeStageTime(transit);
    const station = transit.stage === 'alighting' ? transit.to : transit.from;
    const age =
      transit.stage === 'boarding'
        ? t - TUBE_BOARD_STEPS.crouch
        : transit.stage === 'riding'
          ? TUBE_BOARD - TUBE_BOARD_STEPS.crouch + t
          : t - PUFF_TIMES.drop;
    if (age < 0 || age > PUFF_TIMES.minutes) continue;
    const list = ages.get(station) ?? [];
    if (!list.some((other) => Math.abs(other - age) < 0.02)) list.push(age);
    ages.set(station, list);
  }
  return ages;
}

// ---------------------------------------------------------------------------------------------
// The three layers

/** The Treeline's share of the cached ground layer: pads, trunk posts and the glass behind the
 * tree line. Its type admits only what the cache key covers (night, selection, transform). */
export function drawTubeGround(
  ctx: Ctx,
  scene: Pick<TubeScene, 'night' | 'zoom' | 'emphasis' | 'visible'>,
) {
  const { night, emphasis, visible } = scene;
  for (const station of TUBE_STATIONS) {
    const { x, y } = rounded(station.stack);
    if (!visible({ x, y }, 16, 8, 8)) continue;
    ctx.fillStyle = pick(PAD.edge, night);
    ctx.beginPath();
    ctx.ellipse(x, y + 0.5, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pick(PAD.stone, night);
    ctx.beginPath();
    ctx.ellipse(x, y, 11, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const post of TUBE_TRUNK_POSTS)
    if (visible(project(post.x, post.y), 3, TRUNK_POST_HEIGHT + 1, 2))
      paintPost(ctx, post, TRUNK_POST_HEIGHT, night);
  const lod = glassLod(scene.zoom, emphasis);
  for (const piece of TUBE_PIECES)
    if (piece.layer === 'ground' && pieceVisible(piece, visible))
      paintGlass(ctx, piece, emphasis, night, lod);
  // A station between two others joins the trunk with both elbows; a bubble on its row hides the
  // T, where a trunk post would otherwise stand.
  for (const station of TUBE_STATIONS.slice(1, -1)) {
    const at = lifted({ x: TUBE_TRUNK_X, y: station.dock.y, h: TUBE_ALTITUDE.trunk });
    if (visible(at, 6, 6, 6)) paintBubble(ctx, at, emphasis, night, lod);
  }
}

/** Riders and parcels in the glass behind the tree line, per frame, before the depth sort. */
export function drawTubeTraffic(ctx: Ctx, scene: TubeScene) {
  if (!TUBE_PIECES.some((piece) => piece.layer === 'ground' && pieceVisible(piece, scene.visible)))
    return;
  const lod = glassLod(scene.zoom, scene.emphasis);
  for (const capsule of capsulesOf(scene))
    if (capsule.painter.kind === 'traffic' && scene.visible(capsule.at, 20, 6, 6))
      paintCapsule(ctx, capsule, scene, lod);
}

/** The Treeline's depth objects. Push them before the residents, so walkers win ties. */
export function drawTubes(ctx: Ctx, scene: TubeScene): TubeObject[] {
  const { night, visible, emphasis } = scene;
  const lod = glassLod(scene.zoom, emphasis);
  const out: TubeObject[] = [];
  let traffic: Capsule[] | undefined;
  const capsules = () => (traffic ??= capsulesOf(scene));
  TUBE_PIECES.forEach((piece, index) => {
    if (piece.layer !== 'spur' || !pieceVisible(piece, visible)) return;
    const riding = capsules().filter(
      (capsule) =>
        capsule.painter.kind === 'spur' &&
        capsule.painter.piece === index &&
        visible(capsule.at, 20, 6, 6),
    );
    const a = piece.points[0],
      b = piece.points.at(-1)!;
    const ga = project(a.x, a.y),
      gb = project(b.x, b.y);
    out.push({
      depth: piece.depth,
      part: 'spur',
      station: piece.station,
      ground: { x: a.x, y: a.y },
      slope: (gb.y - ga.y) / (gb.x - ga.x),
      paint: () => {
        paintGlass(ctx, piece, emphasis, night, lod);
        for (const capsule of riding) paintCapsule(ctx, capsule, scene, lod);
      },
    });
  });
  const puffs = puffsAt(scene.residents);
  for (const station of TUBE_STATIONS) {
    const id = station.id;
    const dock = lifted({ ...station.dock, h: TUBE_ALTITUDE.spur });
    if (visible(dock, 6, 6, 6))
      out.push({
        depth: station.dock.x + station.dock.y - 0.2,
        part: 'bubble',
        station: id,
        ground: station.dock,
        slope: 0,
        paint: () => paintBubble(ctx, dock, emphasis, night, lod),
      });
    const post = SPUR_POSTS().find((p) => p.station === station)!;
    if (visible(project(post.ground.x, post.ground.y), 3, post.height + 1, 2))
      out.push({
        depth: post.ground.x + post.ground.y - 0.25,
        part: 'post',
        station: id,
        ground: post.ground,
        slope: 0,
        paint: () => paintPost(ctx, post.ground, post.height, night),
      });
    const foot = project(station.stack.x, station.stack.y);
    if (visible(foot, 10, 52, 6)) {
      const inside: Inside = {
        figures: scene.residents
          .filter(
            (r): r is Traveller =>
              !!r.transit && tubeInStack(r.transit) && stationOf(r.transit) === id,
          )
          .sort(byId),
        parcels: scene
          .parcels()
          .filter(
            (p) =>
              (p.stage === 'sending' && p.from === id) || (p.stage === 'arrived' && p.to === id),
          ),
        capsules: capsules().filter(
          (capsule) => capsule.painter.kind === 'stack' && capsule.painter.station === id,
        ),
      };
      out.push({
        depth: stackDepth(station),
        part: 'stack',
        station: id,
        ground: station.stack,
        slope: 0,
        paint: () => paintStack(ctx, station, scene, inside),
      });
    }
    if (station === FIRST) {
      if (visible(project(SIGN_FOOT.x, SIGN_FOOT.y), 24, 38, 14))
        out.push({
          depth: SIGN_DEPTH,
          part: 'sign',
          station: id,
          ground: SIGN_FOOT,
          slope: 0.5,
          paint: () => paintSign(ctx, scene),
        });
      if (visible(project(STAND_FOOT.x, STAND_FOOT.y), 4, 18, 2))
        out.push({
          depth: STAND_DEPTH,
          part: 'stand',
          station: id,
          ground: STAND_FOOT,
          slope: 0,
          paint: () => paintStand(ctx, scene),
        });
    }
    if (visible(foot, 32, 30, 16))
      for (const age of puffs.get(id) ?? [])
        out.push({
          depth: stackDepth(station) + 0.05,
          part: 'puff',
          station: id,
          ground: station.stack,
          slope: 0,
          paint: () => paintPuff(ctx, station, age, night),
        });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Picking

/** Distance from p to the segment ab, and how far along it the nearest point lies. */
function toSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = clamp01(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1));
  return { distance: Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy), t };
}
/** The frontmost part of the line under a world point: a stack, the sign, the umbrella stand or
 * a 6-px band around the glass. Glass behind the tree line is at depth −1, under everything. */
export function tubeHit(point: Point): { id: string; depth: number } | undefined {
  let best: { id: string; depth: number } | undefined;
  const offer = (id: string, depth: number) => {
    if (!best || depth > best.depth) best = { id, depth };
  };
  for (const station of TUBE_STATIONS) {
    const { x, y } = rounded(station.stack);
    if (Math.abs(point.x - x) <= 8 && point.y >= y - 50 && point.y <= y + 6)
      offer(station.id, stackDepth(station));
  }
  const sign = rounded(SIGN_FOOT);
  const u = point.x - sign.x,
    v = point.y - sign.y - 0.5 * u;
  if (Math.abs(u) <= 22 && v >= -25 && v <= 0) offer(FIRST.id, SIGN_DEPTH);
  const stand = rounded(STAND_FOOT);
  if (Math.abs(point.x - stand.x) <= 4 && point.y >= stand.y - 18 && point.y <= stand.y + 1)
    offer(FIRST.id, STAND_DEPTH);
  for (const piece of TUBE_PIECES) {
    const screen = screenOf(piece.points);
    for (let k = 1; k < screen.length; k++) {
      const { distance, t } = toSegment(point, screen[k - 1], screen[k]);
      if (distance > 6) continue;
      if (piece.layer === 'spur') offer(piece.station, piece.depth);
      else {
        const a = piece.points[k - 1],
          b = piece.points[k];
        offer(nearestStation(a.y + (b.y - a.y) * t).id, -1);
      }
    }
  }
  return best;
}

/** Walkers in lockstep to or from a stack (the same station, within 0.05 tile) side by side, 3 px
 * apart in id order. Paint offsets only: picking is unchanged, ±3 px is inside the hit box. */
export function tubeCrowdOffsets(residents: readonly ResidentState[]): Map<string, number> {
  const walking = residents
    .filter((r): r is Traveller => !!r.transit && !inTubeGlass(r.transit))
    .sort(byId);
  const offsets = new Map<string, number>();
  for (const resident of walking) {
    const here = stationOf(resident.transit);
    const group = walking.filter(
      (other) =>
        stationOf(other.transit) === here &&
        Math.hypot(
          other.position.x - resident.position.x,
          other.position.y - resident.position.y,
        ) <= 0.05,
    );
    if (group.length > 1)
      offsets.set(resident.id, (group.indexOf(resident) - (group.length - 1) / 2) * 3);
  }
  return offsets;
}
