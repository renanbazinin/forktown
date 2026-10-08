import { KINGFISHER_PIER } from '../lib/district-calendar';
import { FORK_PLOT } from '../lib/lanterns';
import { seedFraction, snowAt, type TownSeason } from '../lib/seasons';
import type { ResidentState } from '../lib/simulation';
import type { TubeParcelState } from '../lib/tube-traffic';
import {
  TRUNK_ARCS,
  TUBE_ALIGHT_STEPS,
  TUBE_ALTITUDE,
  TUBE_BANK_X,
  TUBE_BOARD,
  TUBE_BOARD_STEPS,
  TUBE_CORNER,
  TUBE_PARCELS,
  TUBE_SIGN_LINES,
  TUBE_SIGN_STATION,
  TUBE_STATIONS,
  TUBE_TRUNK_X,
  TUBE_TRUNK_Y,
  loopSpur,
  stationTap,
  trunkPoint,
  trunkS,
  tubeAt,
  tubeInStack,
  tubeRoute,
  tubeStageTime,
  tubeStation,
  tubeTrunkBetween,
  type ResidentTransit,
  type TubePoint,
  type TubeStation,
} from '../lib/tubes';
import { PLOTS, TILE_H, WORLD_WIDTH, getPlot, plotCenter, project, type Point } from '../lib/world';
import type { GroundArea } from './ground-cache';
import { drawGlow } from './glow';
import { tint } from './houses';
import { lampOn, MAX_LAMP_DISTANCE, MIN_LAMP_DISTANCE } from './lamplight';
import { drawResident } from './residents';
import { SNOW, pick, type Pair } from './season-palette';

// The Treeline in three layers, like the Millpond:
//  1. drawTubeGround: the stations' stone pads, the trunk's posts, pilings and the glass behind
//     the tree lines and on the far bank (every elbow, both corners and the three runs), and
//     close up the still water under it (reflections, rings) and its shade on the far bank. It
//     is painted into the cached ground layer, so it reads only `night`, the zoom, the view and
//     the halt marked, whose own elbows and T light inside its tubeMarkArea.
//  2. drawTubeTraffic: per frame, straight after the ground: riders and parcels in that glass, so
//     every edge tree and far-bank willow stands in front of them.
//  3. drawTubes: depth objects: the spur pieces with whoever rides in them, the corner bubbles,
//     the spur posts and river piers, the stacks (with anyone boarding or stepping off inside),
//     the sign station's sign and umbrella stand, and the puffs of air.
// Model and art read the same routes (src/lib/tubes.ts), and a rider's straight sprite is cut
// where its glass turns, so a rider is always inside the glass.
// The line is quiet on purpose: 5-px glass (4 px down the far bank) that fades as the map zooms
// out, stations lower than a cottage, no snow on the glass, and amber only in a lit lamp. A hover
// or a selection marks one halt: its own spur, bubbles, post or pier and stack, and in the
// ground its elbows, its T and its plot. From zoom 1 (DETAIL) the bends keep their width, the
// piers stand on stone feet and the water carries reflections; below it the art stays plain.

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
  /** The halt the emphasis is on: the selected halt, else the hovered one. Only its own pieces
   *  light; the cached ground stays as it is outside tubeMarkArea(station). */
  station: string | null;
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
/** A run of glass: part of one station's spur, or a run of trunk. Pieces behind the tree lines
 * and on the far bank are painted before the sort; the rest are sorted. */
export type TubePiece = {
  /** Its glass centreline: along the line for a run of trunk, along its own spur for the rest. */
  points: readonly TubePoint[];
  layer: 'ground' | 'spur';
  /** Mean x + y of the piece's points − 0.25 for a spur piece; −1 for the ground layer. */
  depth: number;
  station: string;
  /** A run of trunk from one tap to the next (owned by the halt it leaves); the rest belongs to
   *  its station's own spur, elbows included, and lights with it. */
  trunk?: true;
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
/** The streetlamp's hood: its face, its top, and the shade under its lip that frames the lamp. */
const HOOD = {
  face: ['#748269', '#4F6358'],
  top: ['#8B9A7F', '#5E7266'],
  lip: ['#5C6A55', '#3C4E47'],
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
  /** The hot middle of a lit lamp. */
  core: ['#FFF1C9', '#FFF1C9'],
} as const satisfies Record<string, Pair>;
/** A bank bridge's pier: a slim column on a stone foot, its dry top pale, its lit and shaded faces
 *  darker where the river wets them. */
const PIER = {
  top: ['#B4BDA9', '#62776F'],
  lit: ['#83917F', '#435853'],
  wet: ['#66766A', '#33474A'],
} as const satisfies Record<string, Pair>;
/** On open water: the glass's pale reflection, and the darker one under a pier or a piling. Only
 *  the head pool and the river under the bridges ever show them. */
const REFLECTION = {
  glass: ['#E9F5F17A', '#8BAEB266'],
  post: ['#5F726A4D', '#1E33375C'],
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
/** A pale ring where a pier or piling stands in the river, instead of a shadow. */
const RIPPLE: Pair = ['#D4E8E1', '#6F8D8D'];
const PUFF_GRASS: Pair = ['#7E9C60', '#6B8B73'];
const SHADOW: Pair = ['#23341B30', '#0B171540'];
/** The bank glass's own faint shade on the far bank's grass. */
const GLASS_SHADE: Pair = ['#23341B1A', '#0B171526'];
/** The follow diamond under a followed neighbor's feet, as in the resident loop. */
const FOLLOW: Pair = ['#FFF7D5', '#F0DBA575'];
/** drawResident's leg colour, for the riders' trousers. */
const TROUSERS = '#3C4744';
/** Riders are dimmed by this much at night, like the rest of the town's colours. */
const NIGHT_DIM = -40;

/** Every colour the Treeline paints, by name, for the tests. */
export const TUBE_PALETTE: Record<string, readonly [day: string, night: string]> = {
  ...Object.fromEntries(
    Object.entries({
      GLASS,
      METAL,
      HOOD,
      PAD,
      PLATE,
      LAMP,
      PIER,
      REFLECTION,
      KRAFT,
      UMBRELLA,
    }).flatMap(([group, pairs]) =>
      Object.entries(pairs).map(([name, pair]) => [`${group}.${name}`, pair]),
    ),
  ),
  PUFF,
  PUFF_GRASS,
  RIPPLE,
  SHADOW,
  GLASS_SHADE,
  FOLLOW,
  TROUSERS: [TROUSERS, tint(TROUSERS, NIGHT_DIM)],
};

// ---------------------------------------------------------------------------------------------
// Geometry: each station's spur and the trunk between them, cut into pieces
//
// TUBE_STATIONS runs in line order round the loop (west run north, north run east, bank run
// south), so a station's spur toward the station after it heads to larger arc length (+1) and
// toward the one before it to smaller (−1); tubeRoute picks the same way from the taps. The first
// and last stations have one spur each. A station between two others has both, and they share
// everything but the elbow. Every ride is its boarding station's spur, one run of trunk (round
// any corner between) and its alighting station's spur backwards, so any ride between any two
// stations maps onto these pieces. See docs/TUBES.md, "Growing the line".

type Heading = 1 | -1;
/** The halt with the sign and the umbrella stand. */
const SIGN_STATION = tubeStation(TUBE_SIGN_STATION);
/** Behind the west or north tree line, or on the far bank: painted in the ground layer. */
const behind = (p: Point) => p.x <= 0.001 || p.y <= 0.001 || p.x >= WORLD_WIDTH - 1.001;
const groundStep = (a: TubePoint, b: TubePoint) => Math.hypot(b.x - a.x, b.y - a.y);
const samePoint = (a: TubePoint, b: TubePoint) => a.x === b.x && a.y === b.y && a.h === b.h;
/** Where a west or bank spur's leg turns along its row (a north spur runs straight on). */
const isCorner = (p: TubePoint) =>
  TUBE_STATIONS.some(
    (s) => s.edge !== 'north' && Math.abs(s.dock.x - p.x) < 1e-9 && Math.abs(s.dock.y - p.y) < 1e-9,
  );
const indexOf = (id: string) => TUBE_STATIONS.findIndex((s) => s.id === id);
const headingOf = (from: string, to: string): Heading => (indexOf(to) > indexOf(from) ? 1 : -1);
/** The station whose tap is nearest arc length s. */
const nearestTap = (s: number) =>
  TUBE_STATIONS.reduce((best, station) =>
    Math.abs(stationTap(station.id) - s) < Math.abs(stationTap(best.id) - s) ? station : best,
  );
/** Arc length of the trunk point nearest a ground point near the trunk (for picking). */
function nearestTrunkS(p: Point) {
  const { S_N0, S_N1, S_E0 } = TRUNK_ARCS;
  const R = TUBE_CORNER;
  const top = TUBE_TRUNK_Y + R,
    west = TUBE_TRUNK_X + R,
    east = TUBE_BANK_X - R;
  const options: { s: number; d: number }[] = [];
  if (p.y >= top) options.push({ s: top - p.y, d: Math.abs(p.x - TUBE_TRUNK_X) });
  if (p.x >= west && p.x <= east)
    options.push({ s: S_N0 + p.x - west, d: Math.abs(p.y - TUBE_TRUNK_Y) });
  if (p.y >= top) options.push({ s: S_E0 + p.y - top, d: Math.abs(p.x - TUBE_BANK_X) });
  if (p.x <= west && p.y <= top) {
    const a = Math.atan2(p.y - top, p.x - west);
    options.push({ s: (a + Math.PI) * R, d: Math.abs(Math.hypot(p.x - west, p.y - top) - R) });
  }
  if (p.x >= east && p.y <= top) {
    const a = Math.atan2(p.y - top, p.x - east);
    options.push({
      s: S_N1 + (a + Math.PI / 2) * R,
      d: Math.abs(Math.hypot(p.x - east, p.y - top) - R),
    });
  }
  return options.reduce((best, option) => (option.d < best.d ? option : best)).s;
}

/** Where the trunk part of a ride starts and ends: route segments first..last run along it. */
const SPANS = new Map<string, { first: number; last: number }>();
function trunkSpan(from: string, to: string) {
  const key = `${from}>${to}`;
  let span = SPANS.get(key);
  if (!span) {
    const heading = headingOf(from, to);
    const there = loopSpur(tubeStation(from), heading).length,
      back = loopSpur(tubeStation(to), -heading as Heading).length;
    span = { first: there - 1, last: tubeRoute(from, to).length - back - 1 };
    SPANS.set(key, span);
  }
  return span;
}
/** A station's spur toward its neighbour that way: stack top first, ending on the trunk. */
function spurOf(station: TubeStation, heading: Heading): readonly TubePoint[] {
  if (!TUBE_STATIONS[TUBE_STATIONS.indexOf(station) + heading])
    throw new Error(
      `The Treeline has no station ${heading > 0 ? 'after' : 'before'} ${station.id}.`,
    );
  return loopSpur(station, heading);
}
const slotOf = (station: string, heading: Heading) => `${station}:${heading}`;

/**
 * Along the line from its first station: the first station's spur, then for each next station the
 * trunk round to it (to its tap, where a middle station's T stands, or to the last station's
 * elbow), and its spur (a middle station: its back elbow, then its spur onward). So the trunk is
 * one run between consecutive taps, corners included, from the first station's elbow to the
 * last's. Segment 0 of a spur is inside its stack's top. Segments with both ends behind the tree
 * lines or on the far bank are in the ground layer: one ground piece per elbow and one per run of
 * trunk. The rest are spur pieces of at most half a tile, never across a corner, each sorted at
 * its mean x + y − 0.25, so the edge pieces go behind the edge tree in front of them. `owners`
 * says which piece draws each segment of each station's spur either way.
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
  const trunk = (a: TubePoint, b: TubePoint, station: string) =>
    pieces.push({
      points: tubeTrunkBetween(a, b),
      layer: 'ground',
      depth: -1,
      station,
      trunk: true,
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
    const back = i > 0 ? spurOf(station, -1) : undefined;
    const on = i + 1 < TUBE_STATIONS.length ? spurOf(station, 1) : undefined;
    let shared = 0;
    const common = back && on ? Math.min(back.length, on.length) : 0;
    while (shared < common && samePoint(back![shared], on![shared])) shared++;
    if (back && on && shared < 2)
      throw new Error(`The Treeline's two spurs at ${id} should share all but the elbow.`);
    if (back) {
      own(id, -1, 0, -1);
      const end = on ? trunkPoint(stationTap(id)) : back.at(-1)!;
      trunk(trunkFrom!, end, TUBE_STATIONS[i - 1].id);
      trunkFrom = end;
      // Trunk first: the elbow alone at a middle station, the whole spur at the last.
      const track = back.slice(on ? shared - 1 : 0).reverse();
      const n = back.length - 1;
      cut(track, 0, track.length - (on ? 2 : 3), id, (t, piece) => own(id, -1, n - 1 - t, piece));
    }
    if (on) {
      own(id, 1, 0, -1);
      cut(on, 1, on.length - 2, id, (k, piece) => {
        own(id, 1, k, piece);
        if (back && k < shared - 1) own(id, -1, k, piece);
      });
      if (!back) trunkFrom = on.at(-1);
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
  const trunk = trunkSpan(from, to);
  if (index >= trunk.first && index <= trunk.last) return { kind: 'traffic' };
  const heading = headingOf(from, to);
  const piece =
    index < trunk.first
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

/** A post under the trunk: its ground point, its height to the glass's underside, which run it
 *  holds, and whether it stands in the river's head pool (a piling). */
export type TubePost = Point & { run: 'west' | 'north' | 'bank'; height: number; water: boolean };
/** The river as render.ts paints it: the column before the far bank, and the far bank's head. */
function isRiver(x: number, y: number) {
  const tx = Math.floor(x),
    ty = Math.floor(y);
  return tx === WORLD_WIDTH - 2 || (tx === WORLD_WIDTH - 1 && ty < 8);
}
/** The trunk the line actually uses: from the first station's elbow round to the last's. */
const TRUNK_ENDS = {
  from: trunkS(loopSpur(TUBE_STATIONS[0], 1).at(-1)!),
  to: trunkS(loopSpur(TUBE_STATIONS.at(-1)!, -1).at(-1)!),
};
const onLine = (s: number) => s > TRUNK_ENDS.from && s < TRUNK_ENDS.to;
const postHeight = (h: number, radius: number) => Math.round(h - radius);
/**
 * Posts under the trunk, in line order. The west run: the middle row of every block it passes
 * (3.5, 7.5, 15.5, …), 4 tiles apart. The north run: every second plot column (7.5, 15.5, …). The
 * bank run: every plot row, the first two as pilings in the river's head pool. Never on a
 * station's own row or column, where a station between two others has its T.
 */
export const TUBE_TRUNK_POSTS: readonly TubePost[] = (() => {
  const rows = [...new Set(PLOTS.map((plot) => plot.y + 0.5))].sort((a, b) => a - b);
  const halts = (edge: TubeStation['edge']) => TUBE_STATIONS.filter((s) => s.edge === edge);
  const { S_N0, S_E0 } = TRUNK_ARCS;
  const top = TUBE_TRUNK_Y + TUBE_CORNER,
    west = TUBE_TRUNK_X + TUBE_CORNER;
  const trunkPost = postHeight(TUBE_ALTITUDE.trunk, TUBE_ALTITUDE.radius),
    bankPost = postHeight(TUBE_ALTITUDE.bank, TUBE_ALTITUDE.bankRadius);
  const westPosts = rows
    .filter((y) => y > top && onLine(top - y) && !halts('west').some((s) => s.dock.y === y))
    .reverse()
    .map((y) => ({ x: TUBE_TRUNK_X, y, run: 'west' as const, height: trunkPost, water: false }));
  const northPosts: TubePost[] = [];
  for (let x = 7.5; x < TUBE_BANK_X - TUBE_CORNER; x += 8)
    if (onLine(S_N0 + x - west) && !halts('north').some((s) => s.dock.x === x))
      northPosts.push({ x, y: TUBE_TRUNK_Y, run: 'north', height: trunkPost, water: false });
  const bankPosts = rows
    .filter((y) => y > top && onLine(S_E0 + y - top) && !halts('bank').some((s) => s.dock.y === y))
    .map((y) => ({
      x: TUBE_BANK_X,
      y,
      run: 'bank' as const,
      height: bankPost,
      water: isRiver(TUBE_BANK_X, y),
    }));
  return [...westPosts, ...northPosts, ...bankPosts];
})();
/** Where each west spur's one post stands: in the tree-free column-0 tile of its row (a north
 *  spur's in the tree-free row-0 tile of its column). A bank bridge's one pier stands mid-river,
 *  mirroring it, at KINGFISHER_PIER.x. */
const SPUR_POST_AT = 0.62;
/** The glass centreline's lift over a station's own spur, `along` its crossing axis (x along a
 *  west or bank halt's row, y along a north halt's column). */
function spurLift(station: TubeStation, along: number) {
  const spur = loopSpur(station, 1);
  const north = station.edge === 'north';
  const axis = (p: Point) => (north ? p.y : p.x),
    fixed = (p: Point) => (north ? p.x : p.y);
  const at = fixed(station.dock);
  for (let i = 1; i < spur.length; i++) {
    const a = spur[i - 1],
      b = spur[i];
    if (fixed(a) !== at || fixed(b) !== at) continue;
    if (along <= Math.max(axis(a), axis(b)) && along >= Math.min(axis(a), axis(b)))
      return a.h + ((b.h - a.h) * (along - axis(a))) / (axis(b) - axis(a) || 1);
  }
  throw new Error(`${station.id}'s spur never passes ${along} on its own row or column.`);
}
const SPUR_POSTS = lazy(() =>
  TUBE_STATIONS.map((station) => {
    const along = station.edge === 'bank' ? KINGFISHER_PIER.x : SPUR_POST_AT;
    const ground =
      station.edge === 'north' ? { x: station.dock.x, y: along } : { x: along, y: station.dock.y };
    return {
      station,
      ground,
      height: postHeight(spurLift(station, along), TUBE_ALTITUDE.radius),
      water: station.edge === 'bank',
    };
  }),
);
/** The sign station's sign and umbrella stand, placed from its stack's foot: the sign east of
 * it, where walkers from the Fork pass it first, and the stand west of the walk in. */
const SIGN_FOOT = { x: SIGN_STATION.stack.x + 0.9, y: SIGN_STATION.stack.y + 0.15 };
const STAND_FOOT = { x: SIGN_STATION.stack.x - 0.3, y: SIGN_STATION.stack.y + 0.1 };
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

/** On the bank run: the far-bank glass is a 4-px hairline. */
const onBank = (p: TubePoint) => p.x >= TUBE_BANK_X - 1e-9;
/** Strictly inside one of the loop's two corners. */
const inCorner = (p: TubePoint) =>
  p.y < TUBE_TRUNK_Y + TUBE_CORNER - 1e-9 &&
  (p.x < TUBE_TRUNK_X + TUBE_CORNER - 1e-9 || p.x > TUBE_BANK_X - TUBE_CORNER + 1e-9);
/** On one of the trunk's three straight runs. */
const onRun = (p: TubePoint) => p.x === TUBE_TRUNK_X || p.y === TUBE_TRUNK_Y || p.x === TUBE_BANK_X;
/** Below this zoom the line is a few pixels across: fewer slices, no 1-px rows, plain posts. */
const FAR = 0.5;
/** From this zoom every pixel shows: the curves keep their width, the hood frames its lamp, the
 *  piers stand on their feet and the still water carries reflections. Below it the line keeps the
 *  plain art, so the opening view and the whole town cost what they did. */
const DETAIL = 1;
/**
 * A ground piece's points for painting at a zoom: below zoom 1 every other corner sample goes, so
 * a corner is four slices, not eight (its centreline moves under half a pixel); below FAR every
 * other elbow sample goes too (under a pixel). The ends and the straight runs always stay.
 */
const COARSE = new Map<string, WeakMap<TubePiece, readonly TubePoint[]>>();
function coarse(piece: TubePiece, zoom: number): readonly TubePoint[] {
  if (zoom >= 1 || piece.layer !== 'ground') return piece.points;
  const level = zoom < FAR ? 'far' : 'near';
  let cache = COARSE.get(level);
  if (!cache) COARSE.set(level, (cache = new WeakMap()));
  let points = cache.get(piece);
  if (!points) {
    const last = piece.points.length - 1;
    let k = 0;
    points = piece.points.filter((p, i) => {
      if (i === 0 || i === last || onRun(p)) return true;
      if (level === 'near' && !inCorner(p)) return true;
      return ++k % 2 === 0;
    });
    cache.set(piece, points);
  }
  return points;
}
/** Glass as vertical-slice parallelograms: consecutive runs share their end edges exactly, so
 * the translucent glass never doubles up. One canvas state for the whole piece, moving between
 * each run's origin and slope with relative transforms and undoing them with one more. 5 px,
 * 4 px down the bank run. Zoomed out, the 1-px rows go first: the rim below zoom 1, the
 * highlight below FAR, where they are a fraction of a pixel. */
function paintGlass(
  ctx: Ctx,
  piece: TubePiece,
  emphasis: TubeEmphasis,
  night: boolean,
  lod: number,
  zoom: number,
) {
  if (zoom >= DETAIL && steep(piece)) return paintBentGlass(ctx, piece, emphasis, night, lod);
  const ground = coarse(piece, zoom);
  const points = screenOf(ground);
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * lod;
  let origin = { x: 0, y: 0 },
    slope = 0;
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1],
      b = points[k];
    const dx = b.x - a.x;
    if (Math.abs(dx) < 0.01) continue;
    const nextSlope = (b.y - a.y) / dx,
      shiftX = a.x - origin.x;
    ctx.transform(1, nextSlope - slope, 0, 1, shiftX, a.y - origin.y - slope * shiftX);
    origin = a;
    slope = nextSlope;
    const half =
      onBank(ground[k - 1]) && onBank(ground[k]) ? TUBE_ALTITUDE.bankRadius : TUBE_ALTITUDE.radius;
    if (emphasis === 'selected') box(ctx, 0, -4, dx, 8, pick(GLASS.halo, night));
    box(ctx, 0, -half, dx, 2 * half, pick(GLASS.body, night));
    if (zoom >= FAR) box(ctx, 0, -half, dx, 1, highlight(emphasis, night));
    if (zoom >= 1) box(ctx, 0, half - 1, dx, 1, pick(GLASS.rim, night));
  }
  // Back to the caller's transform: the inverse of the run's origin and slope.
  if (origin.x || origin.y || slope)
    ctx.transform(1, -slope, 0, 1, -origin.x, slope * origin.x - origin.y);
  ctx.globalAlpha = alpha;
}

/** Whether some of a piece's glass runs at least twice as far down the screen as across it: round
 *  the river's head, and through every elbow that turns toward the viewer. Vertical slices would
 *  pinch the glass there to a wire, so close up such a piece is drawn as one outline
 *  (paintBentGlass). The steepest dip over the river is about 1:1, and stays in slices. */
const STEEP = new WeakMap<TubePiece, boolean>();
function steep(piece: TubePiece) {
  let value = STEEP.get(piece);
  if (value === undefined) {
    const points = screenOf(piece.points);
    value = points.some(
      (b, k) => k > 0 && Math.abs(b.y - points[k - 1].y) > 2 * Math.abs(b.x - points[k - 1].x),
    );
    STEEP.set(piece, value);
  }
  return value;
}
/** A segment's shift to its left edge, `h` px off the centreline: straight up or down where the
 *  glass runs more across the screen than down it, sideways where it runs more down. Either way
 *  the glass keeps its full 2h px, as a vertical slice does on the straight. */
function edgeShift(a: Point, b: Point, h: number): Point {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  return Math.abs(dy) > Math.abs(dx)
    ? { x: h * Math.sign(dy), y: 0 }
    : { x: 0, y: -h * Math.sign(dx) };
}
/** A segment's shift toward the light, `h` px: the glass's upper edge, sliding in to the middle
 *  as the glass turns to run straight down the screen, where its top faces the viewer. */
function lightShift(a: Point, b: Point, h: number): Point {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  return Math.abs(dy) > Math.abs(dx) ? { x: (h * dx) / dy, y: 0 } : { x: 0, y: -h };
}
/** A screen polyline moved off itself by each segment's own shift. Where two shifts differ the
 *  moved segments meet at their miter, or step across where the glass runs straight on. Its two
 *  ends move by `ends` instead: straight up or down, so they meet the vertical slice that ends
 *  the next piece along. */
function offsetLine(
  points: readonly Point[],
  shifts: readonly Point[],
  ends: readonly [Point, Point],
): Point[] {
  const out: Point[] = [];
  points.forEach((p, i) => {
    const before = i === points.length - 1 ? ends[1] : shifts[i - 1],
      after = i === 0 ? ends[0] : shifts[i];
    if (!before || !after || (before.x === after.x && before.y === after.y)) {
      const s = before ?? after;
      out.push({ x: p.x + s.x, y: p.y + s.y });
      return;
    }
    const a = { x: p.x - points[i - 1].x, y: p.y - points[i - 1].y },
      b = { x: points[i + 1].x - p.x, y: points[i + 1].y - p.y };
    const cross = a.x * b.y - a.y * b.x;
    const t = ((after.x - before.x) * b.y - (after.y - before.y) * b.x) / cross;
    if (Number.isFinite(t) && Math.abs(t) * Math.hypot(a.x, a.y) <= 4)
      out.push({ x: p.x + before.x + t * a.x, y: p.y + before.y + t * a.y });
    else out.push({ x: p.x + before.x, y: p.y + before.y }, { x: p.x + after.x, y: p.y + after.y });
  });
  return out;
}
type Bent = {
  body: Point[];
  halo: Point[];
  light: Point[];
  rim: Point[];
  /** The glass's two edges, each along the line, for the tests. */
  edges: readonly [Point[], Point[]];
};
/** A bent piece's outlines on screen: its glass, its halo, and its highlight and rim lines. */
const BENT = new WeakMap<TubePiece, Bent>();
function bentOf(piece: TubePiece): Bent {
  let bent = BENT.get(piece);
  if (bent) return bent;
  // Repeated points (an elbow meeting its run) have no direction of their own.
  const keep = screenOf(piece.points).flatMap((p, i, all) =>
    i > 0 && Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y) < 0.01 ? [] : [i],
  );
  const screen = keep.map((i) => screenOf(piece.points)[i]),
    ground = keep.map((i) => piece.points[i]);
  const segments = screen.slice(1).map((b, k) => ({
    a: screen[k],
    b,
    half:
      onBank(ground[k]) && onBank(ground[k + 1]) ? TUBE_ALTITUDE.bankRadius : TUBE_ALTITUDE.radius,
  }));
  type Segment = (typeof segments)[number];
  const first = segments[0],
    last = segments.at(-1)!;
  /** A vertical cut through an end: up on the left edge, or down where the glass runs leftward. */
  const cut = (s: Segment, h: number): Point => ({ x: 0, y: -h * (Math.sign(s.b.x - s.a.x) || 1) });
  const edge = (half: (s: Segment) => number, side: 1 | -1) =>
    offsetLine(
      screen,
      segments.map((s) => edgeShift(s.a, s.b, side * half(s))),
      [cut(first, side * half(first)), cut(last, side * half(last))],
    );
  const band = (half: (s: Segment) => number) => [...edge(half, 1), ...edge(half, -1).reverse()];
  const line = (side: 1 | -1) =>
    offsetLine(
      screen,
      segments.map((s) => lightShift(s.a, s.b, side * (s.half - 0.5))),
      [
        { x: 0, y: -side * (first.half - 0.5) },
        { x: 0, y: -side * (last.half - 0.5) },
      ],
    );
  const left = edge((s) => s.half, 1),
    right = edge((s) => s.half, -1);
  bent = {
    body: [...left, ...[...right].reverse()],
    halo: band(() => 4),
    light: line(1),
    rim: line(-1),
    edges: [left, right],
  };
  BENT.set(piece, bent);
  return bent;
}
function trace(ctx: Ctx, points: readonly Point[]) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}
/** Close up, a piece that bends toward the viewer: its glass filled as one outline, so it keeps
 *  its width all the way round and the translucent glass never doubles up, then its highlight
 *  and rim as 1-px lines along it. */
function paintBentGlass(
  ctx: Ctx,
  piece: TubePiece,
  emphasis: TubeEmphasis,
  night: boolean,
  lod: number,
) {
  const bent = bentOf(piece);
  const alpha = ctx.globalAlpha,
    join = ctx.lineJoin;
  ctx.globalAlpha = alpha * lod;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  const fill = (points: readonly Point[], colour: string) => {
    ctx.fillStyle = colour;
    trace(ctx, points);
    ctx.fill();
  };
  const stroke = (points: readonly Point[], colour: string) => {
    ctx.strokeStyle = colour;
    trace(ctx, points);
    ctx.stroke();
  };
  if (emphasis === 'selected') fill(bent.halo, pick(GLASS.halo, night));
  fill(bent.body, pick(GLASS.body, night));
  stroke(bent.rim, pick(GLASS.rim, night));
  stroke(bent.light, highlight(emphasis, night));
  ctx.lineJoin = join;
  ctx.globalAlpha = alpha;
}
/** Close up (zoom ≥ DETAIL), the two edges of a piece's glass on screen where it is drawn as one
 *  outline, or undefined where it is drawn in vertical slices. For the tests. */
export const tubeGlassEdges = (piece: TubePiece, zoom: number) =>
  zoom >= DETAIL && steep(piece) ? bentOf(piece).edges : undefined;
/** A box between two screen points along their line, from v0 to v1 px below it. */
function slab(ctx: Ctx, a: Point, b: Point, v0: number, v1: number, colour: string) {
  const slope = (b.y - a.y) / (b.x - a.x);
  ctx.transform(1, slope, 0, 1, a.x, a.y);
  box(ctx, 0, v0, b.x - a.x, v1 - v0, colour);
  ctx.transform(1, -slope, 0, 1, -a.x, slope * a.x - a.y);
}
/** A flat ring on the water round something standing in it. */
function ring(ctx: Ctx, x: number, y: number, rx: number, night: boolean) {
  ctx.strokeStyle = pick(RIPPLE, night);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x + 0.5, y + 0.5, rx, rx / 2.5, 0, 0, Math.PI * 2);
  ctx.stroke();
}
/** The glass ball where a spur's leg turns along its row, or where a middle station's elbows meet
 * the trunk (its tap). It hides the joint of the runs. */
function paintBubble(
  ctx: Ctx,
  at: Point,
  emphasis: TubeEmphasis,
  night: boolean,
  lod: number,
  zoom: number,
) {
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
  if (zoom >= FAR) {
    box(ctx, x - 2, y - 3, 2, 1, highlight(emphasis, night));
    box(ctx, x - 2, y + 3, 4, 1, pick(GLASS.rim, night));
  }
  ctx.globalAlpha = alpha;
}
/** A slim post up to the glass's underside: a lit side, a shade side and a shadow; zoomed out, one
 * plain stroke. A piling in the river's head pool stands in a pale ripple instead, and close up
 * in a ring, a pile's foot below the waterline and its dark reflection. */
function paintPost(
  ctx: Ctx,
  ground: Point,
  height: number,
  night: boolean,
  water: boolean,
  zoom: number,
) {
  const { x, y } = rounded(ground);
  if (zoom < FAR) return box(ctx, x - 1, y - height, 2, height, pick(METAL.post, night));
  if (water && zoom >= DETAIL) {
    box(ctx, x - 1, y + 2, 2, 3, pick(REFLECTION.post, night));
    ring(ctx, x, y, 4, night);
    box(ctx, x - 1, y - height, 1, height + 1, pick(METAL.post, night));
    box(ctx, x, y - height, 1, height + 1, pick(METAL.side, night));
    return box(ctx, x - 1, y, 2, 1, pick(PIER.wet, night));
  }
  if (water) box(ctx, x - 3, y, 7, 1, pick(RIPPLE, night));
  else box(ctx, x - 2, y, 5, 1, pick(SHADOW, night));
  box(ctx, x - 1, y - height, 1, height, pick(METAL.post, night));
  box(ctx, x, y - height, 1, height, pick(METAL.side, night));
}
/** Where a pier's foot meets the river, close up: the foot's stone top this far up, px. */
const PIER_FOOT = 4;
/** A bank bridge's pier mid-river: one slim column on a stone foot, wet below its dry top, under
 *  the glass's underside. Its ring and reflection lie on the water in the ground layer; zoomed
 *  out, the column alone. */
function paintPier(ctx: Ctx, ground: Point, height: number, night: boolean, zoom: number) {
  const { x, y } = rounded(ground);
  if (zoom < FAR) return box(ctx, x - 1, y - height, 2, height, pick(METAL.post, night));
  if (zoom < DETAIL) {
    box(ctx, x - 1, y - height, 1, height, pick(METAL.post, night));
    return box(ctx, x, y - height, 1, height, pick(METAL.side, night));
  }
  box(ctx, x - 1, y - height, 1, height - PIER_FOOT, pick(METAL.post, night));
  box(ctx, x, y - height, 1, height - PIER_FOOT, pick(METAL.side, night));
  box(ctx, x - 2, y - PIER_FOOT, 2, PIER_FOOT + 1, pick(PIER.lit, night));
  box(ctx, x, y - PIER_FOOT, 2, PIER_FOOT + 1, pick(PIER.wet, night));
  box(ctx, x - 2, y - PIER_FOOT, 4, 1, pick(PIER.top, night));
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
function paintCapsule(
  ctx: Ctx,
  capsule: Capsule,
  scene: TubeScene,
  lod: number,
  emphasis: TubeEmphasis,
) {
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
  part(tail, head, -2.5, -1.5, highlight(emphasis, night));
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
/** The glass stack: collar, glass, anyone and anything inside, and the hood with its lamp, which
 * hangs under the hood's lip like a streetlamp's head and lights in the streetlamps' wave. 12
 * calls empty; selected, a pale gold glow stands behind the glass. */
function paintStack(ctx: Ctx, station: TubeStation, scene: TubeScene, inside: Inside) {
  const { night } = scene;
  const { x, y } = rounded(station.stack);
  const { figures, parcels } = inside;
  const far = scene.zoom < FAR;
  const emphasis = emphasisOf(scene, station.id);
  if (scene.followed && figures.some((figure) => figure.id === scene.followed))
    diamond(ctx, x, y + 2, 10, 5, pick(FOLLOW, night));
  box(ctx, x - 7, y - 3, 14, 3, pick(METAL.post, night));
  if (!far) box(ctx, x + 2, y - 3, 5, 3, pick(METAL.side, night));
  if (emphasis === 'selected') box(ctx, x - 7, y - 42, 14, 40, pick(GLASS.halo, night));
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
      // Dimmed at night like the walker who stepped in.
      drawResident(ctx, figure.resident, 0, 0, 1.25, STANDING, { shadow: false, night });
      if (!last) ctx.restore();
    });
    ctx.restore();
    box(ctx, x - 6, y - 41, 12, 38, pick(GLASS.front, night));
  }
  // Anyone just leaving or reaching the stack's top (the first and last 0.15 tiles of a ride),
  // cut at the middle of the top and behind the front of the glass, the collar and the hood.
  const lod = glassLod(scene.zoom, emphasis);
  for (const capsule of inside.capsules) paintCapsule(ctx, capsule, scene, lod, emphasis);
  // The front of the glass: one bright edge (pale gold while hovered, like the glass), one glint
  // and the rim (zoomed out, a fraction of a pixel each, so the stack is its collar, glass, hood
  // and lamp).
  if (!far) {
    box(ctx, x - 5, y - 40, 1, 36, highlight(emphasis, night));
    box(ctx, x - 3, y - 35, 1, 5, pick(GLASS.hi, night));
    box(ctx, x + 5, y - 41, 1, 38, pick(GLASS.rim, night));
    box(ctx, x - 7, y - 44, 14, 3, pick(METAL.post, night));
  }
  // The hood: its face, its top, and the shade under its lip, where the lamp hangs in a dark
  // frame, pale by day, grey at night until the wave reaches it, then amber with a hot middle.
  box(ctx, x - 8, y - 47, 16, 3, pick(HOOD.face, night));
  const lit = night && lampOn(lampDistance(station), scene.minutes);
  const lamp = pick(lit ? LAMP.lit : LAMP.face, night);
  if (far) box(ctx, x - 2, y - 43, 4, 1, lamp);
  else {
    box(ctx, x - 7, y - 48, 14, 1, pick(HOOD.top, night));
    box(ctx, x - 8, y - 45, 16, 1, pick(HOOD.lip, night));
    box(ctx, x - 3, y - 45, 6, 4, pick(HOOD.lip, night));
    box(ctx, x - 2, y - 44, 4, 2, lamp);
    if (lit) box(ctx, x - 1, y - 44, 2, 1, pick(LAMP.core, night));
  }
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
/** The sign station's sign: a small enamel plate on one post, turned to face the road. */
function paintSign(ctx: Ctx, scene: TubeScene) {
  const { night } = scene;
  const { x, y } = rounded(SIGN_FOOT);
  if (scene.zoom >= FAR) box(ctx, x - 2, y, 5, 1, pick(SHADOW, night));
  box(ctx, x - 1, y - 9, 2, 9, pick(METAL.side, night));
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, x, y);
  box(ctx, -22, -24, 44, 15, pick(PLATE.border, night));
  box(ctx, -21, -23, 42, 13, pick(PLATE.face, night));
  const snow = snowAt(scene.season.yearDay, seedFraction(`tube:${SIGN_STATION.id}`));
  if (snow > 0) {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * snow;
    box(ctx, -22, -25, 44, 1, pick(SNOW.top, night));
    ctx.globalAlpha = alpha;
  }
  // Zoomed out the 4-px words are under two pixels high: the plate alone.
  if (scene.zoom >= FAR) {
    ctx.fillStyle = pick(PLATE.ink, night);
    ctx.font = 'bold 4px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(TUBE_SIGN_LINES[0], 0, -19.1, 41);
    ctx.fillText(TUBE_SIGN_LINES[1], 0, -14.8, 41);
    ctx.fillText(TUBE_SIGN_LINES[2], 0, -10.5, 41);
  }
  ctx.restore();
}
/** A brass bucket by the walk in, with one furled plum umbrella that somebody did remove. */
function paintStand(ctx: Ctx, scene: TubeScene) {
  const { night } = scene;
  const { x, y } = rounded(STAND_FOOT);
  // Zoomed out, the bucket and the furled umbrella alone.
  const far = scene.zoom < FAR;
  if (!far) box(ctx, x - 3, y, 7, 1, pick(SHADOW, night));
  box(ctx, x - 1, y - 15, 2, 10, pick(UMBRELLA.cloth, night));
  if (!far) {
    box(ctx, x - 1, y - 17, 3, 1, pick(UMBRELLA.handle, night));
    ctx.fillRect(x + 1, y - 16, 1, 1);
  }
  box(ctx, x - 3, y - 6, 6, 6, pick(UMBRELLA.bucket, night));
  if (!far) box(ctx, x - 3, y - 6, 6, 1, pick(UMBRELLA.rim, night));
  const snow = snowAt(scene.season.yearDay, seedFraction(`tube:${SIGN_STATION.id}`));
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
function paintPuff(ctx: Ctx, station: TubeStation, age: number, night: boolean, zoom: number) {
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
  // Zoomed out, the rings alone: the grass bits are under a pixel.
  if (zoom >= FAR)
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

/** The emphasis on one halt's own art: the scene's, if it is the halt hovered or selected. */
const emphasisOf = (scene: Pick<TubeScene, 'emphasis' | 'station'>, station: string) =>
  scene.station === station ? scene.emphasis : 'none';
/** A halt's own glass in the cached ground: its elbows onto the trunk, never a run of trunk. */
const ownGround = (piece: TubePiece, station: string | null | undefined) =>
  piece.layer === 'ground' && !piece.trunk && piece.station === station;
/** The T bubble where a station between two others meets the trunk, on screen. */
const tapBubble = (station: TubeStation) =>
  station === TUBE_STATIONS[0] || station === TUBE_STATIONS.at(-1)
    ? undefined
    : lifted(trunkPoint(stationTap(station.id)));
/** Px round anything that lights in the ground: the 8-px halo is 4 px off the centreline, a
 *  bubble's 5.5. */
const MARK_MARGIN = 8;
const MARK_AREAS = new Map<string, GroundArea>();
/**
 * The ground layer a hover or a selection of one halt may repaint: its own plot (the rectangle
 * render.ts repaints for any plot), widened over the halt's own glass in the ground, its elbows
 * onto the trunk and its T bubble, which light with it. Nothing else of the line lights in the
 * cached ground, so moving the pointer repaints only the halts it leaves and reaches.
 */
export function tubeMarkArea(id: string): GroundArea {
  let area = MARK_AREAS.get(id);
  if (area) return area;
  const station = tubeStation(id);
  const c = plotCenter(getPlot(station.plot)!);
  const points = [
    ...TUBE_PIECES.filter((piece) => ownGround(piece, id)).flatMap((piece) =>
      screenOf(piece.points),
    ),
    ...[tapBubble(station)].filter((p): p is Point => !!p),
  ];
  area = {
    left: Math.min(c.x - 112, ...points.map((p) => p.x - MARK_MARGIN)),
    right: Math.max(c.x + 112, ...points.map((p) => p.x + MARK_MARGIN)),
    top: Math.min(c.y - 58, ...points.map((p) => p.y - MARK_MARGIN)),
    bottom: Math.max(c.y + 58, ...points.map((p) => p.y + MARK_MARGIN)),
  };
  MARK_AREAS.set(id, area);
  return area;
}

/** The bank glass's reflection, px: long and unbroken where the pool is still, with a few short
 *  breaks where it ripples. */
const REFLECTION_DASHES = [41, 3, 23, 5, 32, 2, 14, 4];
/** Where the river's head pool ends down the far bank: the bank glass runs over open water above
 *  it, and on the far bank's grass below. */
const POOL_END = (() => {
  let y = 0;
  while (isRiver(TUBE_BANK_X, y)) y++;
  return y;
})();
/**
 * Close up, still water under the line, in the ground layer: the bank glass's pale reflection
 * down the head pool, and each bank pier's dark reflection and the ring round its foot (a plain
 * ripple from FAR). The pilings carry their own (paintPost).
 */
function paintStillWater(ctx: Ctx, night: boolean, zoom: number, visible: Visible) {
  if (zoom < FAR) return;
  if (zoom >= DETAIL) {
    // The glass is TUBE_ALTITUDE.bank px over the water, so its reflection lies as far below:
    // twice that under its centreline, a hair thinner, and only where it still lands in the pool.
    const h = TUBE_ALTITUDE.bank;
    const a = project(TUBE_BANK_X, TUBE_TRUNK_Y + TUBE_CORNER),
      b = project(TUBE_BANK_X, POOL_END - h / TILE_H - 0.05);
    if (
      visible({ x: (a.x + b.x) / 2, y: b.y }, Math.abs(b.x - a.x) / 2 + 2, b.y - a.y + 2, h + 4)
    ) {
      // Broken by the ripples into long and short dashes, the same every day.
      ctx.setLineDash(REFLECTION_DASHES);
      ctx.strokeStyle = pick(REFLECTION.glass, night);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + h + 0.5);
      ctx.lineTo(b.x, b.y + h + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (zoom >= DETAIL) {
    // Down the far bank's grass the glass's own faint shade lies under it.
    const a = project(TUBE_BANK_X, POOL_END),
      b = project(TUBE_BANK_X, trunkPoint(TRUNK_ENDS.to).y);
    if (visible({ x: (a.x + b.x) / 2, y: b.y }, Math.abs(b.x - a.x) / 2 + 2, b.y - a.y + 2, 2))
      slab(ctx, a, b, 0, 1, pick(GLASS_SHADE, night));
  }
  for (const pier of SPUR_POSTS()) {
    if (!pier.water) continue;
    const { x, y } = rounded(pier.ground);
    if (!visible({ x, y }, 8, 4, 12)) continue;
    if (zoom < DETAIL) {
      box(ctx, x - 3, y, 7, 1, pick(RIPPLE, night));
      continue;
    }
    box(ctx, x - 2, y + 2, 4, 2, pick(REFLECTION.post, night));
    box(ctx, x - 1, y + 5, 2, 4, pick(REFLECTION.post, night));
    ring(ctx, x - 0.5, y, 6, night);
  }
}

/** The Treeline's share of the cached ground layer: pads, trunk posts and pilings, the still water
 * under the bank glass and the piers, the glass behind the tree lines and on the far bank, and the
 * T bubbles. Its type admits only what the cache key and the marks cover (night, the transform,
 * and the halt hovered or selected, which repaints only its own tubeMarkArea): of the ground,
 * only a marked halt's elbows and T light, never a run of trunk. */
export function drawTubeGround(
  ctx: Ctx,
  scene: Pick<TubeScene, 'night' | 'zoom' | 'visible'> &
    Partial<Pick<TubeScene, 'emphasis' | 'station'>>,
) {
  const { night, visible } = scene;
  const marked = (id: string) => (scene.station === id ? (scene.emphasis ?? 'none') : 'none');
  for (const station of TUBE_STATIONS) {
    const { x, y } = rounded(station.stack);
    if (!visible({ x, y }, 16, 8, 8)) continue;
    // Zoomed out, the stone alone: its edge is half a pixel.
    if (scene.zoom >= FAR) {
      ctx.fillStyle = pick(PAD.edge, night);
      ctx.beginPath();
      ctx.ellipse(x, y + 0.5, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = pick(PAD.stone, night);
    ctx.beginPath();
    ctx.ellipse(x, y, 11, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  paintStillWater(ctx, night, scene.zoom, visible);
  for (const post of TUBE_TRUNK_POSTS)
    if (visible(project(post.x, post.y), 6, post.height + 1, 6))
      paintPost(ctx, post, post.height, night, post.water, scene.zoom);
  for (const piece of TUBE_PIECES)
    if (piece.layer === 'ground' && pieceVisible(piece, visible)) {
      const emphasis = piece.trunk ? 'none' : marked(piece.station);
      paintGlass(ctx, piece, emphasis, night, glassLod(scene.zoom, emphasis), scene.zoom);
    }
  // A station between two others joins the trunk with both elbows; a bubble at its tap hides the
  // T, where a trunk post would otherwise stand.
  for (const station of TUBE_STATIONS) {
    const at = tapBubble(station);
    const emphasis = marked(station.id);
    if (at && visible(at, 6, 6, 6))
      paintBubble(ctx, at, emphasis, night, glassLod(scene.zoom, emphasis), scene.zoom);
  }
}

/** Riders and parcels in the glass behind the tree lines and on the far bank, per frame, before
 * the depth sort. */
export function drawTubeTraffic(ctx: Ctx, scene: TubeScene) {
  if (!TUBE_PIECES.some((piece) => piece.layer === 'ground' && pieceVisible(piece, scene.visible)))
    return;
  const lod = glassLod(scene.zoom, 'none');
  for (const capsule of capsulesOf(scene))
    if (capsule.painter.kind === 'traffic' && scene.visible(capsule.at, 20, 6, 6))
      paintCapsule(ctx, capsule, scene, lod, 'none');
}

/** The Treeline's depth objects. Push them before the residents, so walkers win ties. */
export function drawTubes(ctx: Ctx, scene: TubeScene): TubeObject[] {
  const { night, visible } = scene;
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
    const emphasis = emphasisOf(scene, piece.station);
    const lod = glassLod(scene.zoom, emphasis);
    out.push({
      depth: piece.depth,
      part: 'spur',
      station: piece.station,
      ground: { x: a.x, y: a.y },
      slope: (gb.y - ga.y) / (gb.x - ga.x),
      paint: () => {
        paintGlass(ctx, piece, emphasis, night, lod, scene.zoom);
        for (const capsule of riding) paintCapsule(ctx, capsule, scene, lod, emphasis);
      },
    });
  });
  const puffs = puffsAt(scene.residents);
  for (const station of TUBE_STATIONS) {
    const id = station.id;
    const emphasis = emphasisOf(scene, id);
    const lod = glassLod(scene.zoom, emphasis);
    // A west or bank spur turns at its dock; a north spur runs straight on, with no bubble.
    const dock = lifted({ ...station.dock, h: TUBE_ALTITUDE.spur });
    if (station.edge !== 'north' && visible(dock, 6, 6, 6))
      out.push({
        depth: station.dock.x + station.dock.y - 0.2,
        part: 'bubble',
        station: id,
        ground: station.dock,
        slope: 0,
        paint: () => paintBubble(ctx, dock, emphasis, night, lod, scene.zoom),
      });
    const post = SPUR_POSTS().find((p) => p.station === station)!;
    if (visible(project(post.ground.x, post.ground.y), 4, post.height + 1, 2))
      out.push({
        depth: post.ground.x + post.ground.y - 0.25,
        part: 'post',
        station: id,
        ground: post.ground,
        slope: 0,
        paint: () =>
          post.water
            ? paintPier(ctx, post.ground, post.height, night, scene.zoom)
            : paintPost(ctx, post.ground, post.height, night, false, scene.zoom),
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
    if (station === SIGN_STATION) {
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
          paint: () => paintPuff(ctx, station, age, night, scene.zoom),
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
 * a 6-px band around the glass. Glass behind the tree lines and on the far bank is at depth −1,
 * under everything, and selects the station whose tap is nearest along the loop. */
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
  if (Math.abs(u) <= 22 && v >= -25 && v <= 0) offer(SIGN_STATION.id, SIGN_DEPTH);
  const stand = rounded(STAND_FOOT);
  if (Math.abs(point.x - stand.x) <= 4 && point.y >= stand.y - 18 && point.y <= stand.y + 1)
    offer(SIGN_STATION.id, STAND_DEPTH);
  for (const piece of TUBE_PIECES) {
    const screen = screenOf(piece.points);
    for (let k = 1; k < screen.length; k++) {
      const { distance, t } = toSegment(point, screen[k - 1], screen[k]);
      if (distance > 6) continue;
      if (piece.layer === 'spur') offer(piece.station, piece.depth);
      else {
        const a = piece.points[k - 1],
          b = piece.points[k];
        const ground = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        offer(nearestTap(nearestTrunkS(ground)).id, -1);
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
