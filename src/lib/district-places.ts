// The Riverside's places: the four district venues, their grounds, spots and ways in, the
// harvest props, the regatta course and the bandstand's furniture times. Frozen data for the
// bigger town (SPEC §2.2, §2.3, §7.0). The district venues are defined here, never in events.ts.
// Pure: it value-imports only the world, the town config and the district calendar.
import { MARKET_SITE } from './town-config.ts';
import type { Point } from './world.ts';
import {
  harvestDay,
  KINGFISHER_PIER,
  landingRowY,
  REGATTA_BOATS,
  REGATTA_COURSE,
  type OutingId,
} from './district-calendar.ts';

export { KINGFISHER_PIER, REGATTA_COURSE };

export type Spot = { x: number; y: number; facing: 'ne' | 'nw' | 'se' | 'sw' };
export type DistrictKind = 'market' | 'bandstand' | 'landing' | 'harvest';
export type DistrictVenue = {
  readonly id: DistrictKind;
  readonly plot: string;
  readonly name: string;
  readonly kind: DistrictKind;
};

export const MARKET_VENUE = {
  id: 'market',
  plot: 'D14',
  name: 'Market Square',
  kind: 'market',
} as const satisfies DistrictVenue;
export const BANDSTAND_VENUE = {
  id: 'bandstand',
  plot: 'K15',
  name: 'The Bandstand',
  kind: 'bandstand',
} as const satisfies DistrictVenue;
export const LANDING_VENUE = {
  id: 'landing',
  plot: 'J15',
  name: 'The Boat Landing',
  kind: 'landing',
} as const satisfies DistrictVenue;
/** The Harvest Fair and the Long Table use the farm's west end; its plots are reserved already. */
export const HARVEST_VENUE = {
  id: 'harvest',
  plot: 'S9',
  name: 'Moon Harvest Farm',
  kind: 'harvest',
} as const satisfies DistrictVenue;

/** D14–E15, one square (MARKET_SITE). */
export const MARKET_PLOTS = ['D14', 'D15', 'E14', 'E15'] as const;
const DISTRICT_PLOTS: readonly string[] = [
  ...MARKET_PLOTS,
  LANDING_VENUE.plot,
  BANDSTAND_VENUE.plot,
];
/** The plots the Riverside's venues hold: the market's four, the Landing and the Bandstand. */
export const isDistrictPlot = (id: string) => DISTRICT_PLOTS.includes(id);

/** Market Square's ground (tiles), inside its perimeter roads x 53 / 61 and y 13 / 21. */
export const MARKET_GROUND = {
  left: 2 + MARKET_SITE.col * 4,
  right: 1 + (MARKET_SITE.col + MARKET_SITE.columns) * 4,
  top: 2 + MARKET_SITE.row * 4,
  bottom: 1 + (MARKET_SITE.row + MARKET_SITE.rows) * 4,
} as const;
/** The farm's west end, where the Harvest Fair stands and the Long Table is laid. */
export const HARVEST_GROUND = { left: 14, right: 22, top: 74, bottom: 81 } as const;
/** The two existing gaps in the farm's west fence, on the road outside it. */
export const HARVEST_GATES = { north: { x: 13.5, y: 75.5 }, south: { x: 13.5, y: 79.5 } } as const;
/** The scarecrow's two west plots: fair spots and props keep this far from their centres. */
export const SCARECROW_KEEP_OUT = {
  points: [
    { x: 15.5, y: 75.5 },
    { x: 19.5, y: 75.5 },
    { x: 15.5, y: 79.5 },
    { x: 19.5, y: 79.5 },
  ],
  radius: 0.75,
} as const;

export type HarvestProp = { id: string; x: number; y: number; r: number; from: number; to: number };
/**
 * The fair's props on Autumn 23–25: centre (tiles), footprint radius (tiles) and the town minutes
 * each one is out. The press and the bales fade 17:10–17:15 as the table is laid; the table is laid
 * 17:15–17:45 and cleared 21:00–21:15 (its own fades are the painter's, inside these times).
 */
export const HARVEST_PROPS: readonly HarvestProp[] = [
  { id: 'cart', x: 14.6, y: 77.5, r: 0.3, from: 360, to: 1260 },
  { id: 'bunting', x: 14.0, y: 77.5, r: 2.0, from: 360, to: 1260 },
  { id: 'press', x: 19.5, y: 77.5, r: 0.3, from: 360, to: 1030 },
  { id: 'presser', x: 19.5, y: 77.5, r: 0.3, from: 780, to: 1020 },
  ...[
    [16.0, 77.1],
    [16.0, 77.9],
    [17.2, 77.5],
    [20.6, 77.1],
    [20.6, 77.9],
    [21.5, 77.5],
  ].map(([x, y], k) => ({ id: `bale-${k}`, x, y, r: 0.2, from: 360, to: 1030 })),
  { id: 'table', x: 18.0, y: 77.5, r: 3.0, from: 1035, to: 1275 },
  { id: 'fiddler', x: 21.45, y: 77.5, r: 0.3, from: 1080, to: 1230 },
];

/** Where each outing's guests stand or sit, absolute tiles (SPEC §2.3). */
export const DISTRICT_SPOTS: Record<
  'market' | 'bandstand' | 'landing' | 'harvest-fair' | 'long-table',
  readonly Spot[]
> = {
  // Six at the north stalls facing them, six at the west stalls.
  market: [
    ...[55.6, 56.4, 57.5, 58.3, 59.4, 60.2].map((x): Spot => ({ x, y: 15.75, facing: 'ne' })),
    ...[16.55, 17.25, 18.15, 18.85, 19.75, 20.45].map((y): Spot => ({ x: 55.75, y, facing: 'nw' })),
  ],
  // Two rows of four deckchairs on the south lawn, all facing the stand.
  bandstand: [
    [58.45, 44.15],
    [59.15, 44.15],
    [59.85, 44.15],
    [60.55, 44.15],
    [58.8, 44.75],
    [59.5, 44.75],
    [60.2, 44.75],
    [60.9, 44.75],
  ].map(([x, y]): Spot => ({ x, y, facing: 'ne' })),
  // Ten rows down the lawn's river edge, alternating front and back.
  landing: Array.from({ length: REGATTA_BOATS }, (_, k): Spot => ({
    x: k % 2 ? 60.2 : 60.75,
    y: landingRowY(k),
    facing: 'se',
  })),
  // The two footpaths, clear of the scarecrow's west plots; each row faces the middle.
  'harvest-fair': Array.from({ length: 12 }, (_, k): Spot => {
    const north = k < 6;
    return {
      x: [16.35, 17.05, 17.75, 18.45, 20.55, 21.25][k % 6],
      y: north ? 75.4 : 79.6,
      facing: north ? 'sw' : 'ne',
    };
  }),
  // Eight a side along the table on y 77.5.
  'long-table': Array.from({ length: 16 }, (_, k): Spot => {
    const north = k < 8;
    return { x: 15.2 + 0.8 * (k % 8), y: north ? 77.0 : 78.0, facing: north ? 'sw' : 'ne' };
  }),
};
/** The spot list an outing seats its guests on. */
export function outingSpots(outingId: OutingId): readonly Spot[] {
  if (outingId === 'market') return DISTRICT_SPOTS.market;
  if (outingId === 'regatta') return DISTRICT_SPOTS.landing;
  if (outingId === 'harvest-fair') return DISTRICT_SPOTS['harvest-fair'];
  if (outingId === 'long-table') return DISTRICT_SPOTS['long-table'];
  // Both sets and the stargazers share the Bandstand lawn's eight spots.
  return DISTRICT_SPOTS.bandstand;
}

/** Drop a point that repeats the one before it. */
const squeeze = (points: Point[]) =>
  points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
/**
 * An outing's own way in for a seat, from a road-tile centre to the spot (SPEC §2.3). The first
 * point is the key for joinApproach and for the gate headway. The way home is its reverse.
 */
export function districtApproach(outingId: OutingId, seat: number): Point[] {
  const s = outingSpots(outingId)[seat];
  if (!s) throw new Error(`No ${outingId} seat ${seat}.`);
  const spot = { x: s.x, y: s.y };
  if (outingId === 'market')
    // North stalls: a lane behind the row from the riverside road. West stalls: from the south road.
    return seat < 6
      ? [{ x: 61.5, y: 15.5 }, { x: 61.5, y: 16.2 }, { x: s.x, y: 16.2 }, spot]
      : [{ x: 55.5, y: 21.5 }, { x: 56.4, y: 21.5 }, { x: 56.4, y: s.y }, spot];
  if (outingId === 'regatta')
    // In from the riverside road along the spot's own row.
    return [{ x: 61.5, y: Math.floor(s.y) + 0.5 }, { x: 61.5, y: s.y }, spot];
  if (outingId === 'harvest-fair' || outingId === 'long-table') {
    const north = seat < (outingId === 'long-table' ? 8 : 6);
    const gate = north ? HARVEST_GATES.north : HARVEST_GATES.south;
    // Through the fence gap, then a lane beside the row, so the last step faces the spot's way.
    const lane = outingId === 'long-table' ? (north ? 76.45 : 78.55) : north ? 74.9 : 80.1;
    return [{ ...gate }, { x: 14.5, y: gate.y }, { x: 14.5, y: lane }, { x: s.x, y: lane }, spot];
  }
  // The Bandstand: the west chairs from the south road, the rest from the riverside corner.
  return s.x < 59.6
    ? squeeze([{ x: 59.5, y: 45.5 }, { x: s.x, y: 45.5 }, spot])
    : [{ x: 61.5, y: 45.5 }, { x: 61.5, y: 45.25 }, { x: s.x, y: 45.25 }, spot];
}

const BANDSTAND_CENTER = { x: 59.5, y: 43.5 };
const LANDING_CENTER = { x: 59.5, y: 39.5 };
const within = (p: Point, ground: { left: number; right: number; top: number; bottom: number }) =>
  p.x >= ground.left && p.x <= ground.right && p.y >= ground.top && p.y <= ground.bottom;
/** Whether a point is on a district venue's ground (single plots: ±1.5 round the centre). */
export function insideDistrict(kind: DistrictKind, p: Point) {
  if (kind === 'market') return within(p, MARKET_GROUND);
  if (kind === 'harvest') return within(p, HARVEST_GROUND);
  const c = kind === 'bandstand' ? BANDSTAND_CENTER : LANDING_CENTER;
  return Math.abs(p.x - c.x) <= 1.5 && Math.abs(p.y - c.y) <= 1.5;
}

export type DistrictFrame = { center: Point; width: number; height: number };
/** Live and panel camera frames, world px. Every frame is ≤ 850 × 540. */
export const DISTRICT_FRAMES: Record<
  'market' | 'bandstand' | 'regatta' | 'harvest',
  DistrictFrame
> = {
  market: { center: { x: 1520, y: 1395 }, width: 640, height: 420 },
  bandstand: { center: { x: 608, y: 1922 }, width: 520, height: 370 },
  // Nearer the far bank than the river's middle (575, 1955; was 600, 2000), so the flat country
  // beyond the bank is about a sixth of the frame, not a quarter, with the stage and the boom in.
  regatta: { center: { x: 575, y: 1955 }, width: 740, height: 450 },
  harvest: { center: { x: -2261, y: 1785 }, width: 640, height: 420 },
};
export const MARKET_FRAME = DISTRICT_FRAMES.market;
export const BANDSTAND_FRAME = DISTRICT_FRAMES.bandstand;
export const REGATTA_FRAME = DISTRICT_FRAMES.regatta;
export const HARVEST_FRAME = DISTRICT_FRAMES.harvest;
/**
 * The frame the farm's panel opens on: on a harvest day the fair and the Long Table at the west
 * end (HARVEST_FRAME), else nothing, and the farm opens on its own whole-farm frame.
 */
export const farmPanelFrame = (day: number) => (harvestDay(day) ? HARVEST_FRAME : undefined);

/**
 * When the Bandstand's furniture is out, town minutes on the evening's timeline: the deckchairs
 * every day (agent C's), the rugs and the telescope on star nights (agent E's). Never both.
 */
export const BANDSTAND_FURNITURE = {
  chairs: { from: 935, to: 1220 },
  rugs: { from: 1310, to: 1475 },
} as const;

/** Listen only when the Bandstand is on screen and the camera is close, like the cinema. */
export function bandstandListening(
  camera: { x: number; y: number; zoom: number },
  width: number,
  height: number,
): { gain: number; pan: number } {
  if (width <= 0 || height <= 0) return { gain: 0, pan: 0 };
  const x = BANDSTAND_FRAME.center.x * camera.zoom + camera.x;
  const y = BANDSTAND_FRAME.center.y * camera.zoom + camera.y;
  const distance = Math.hypot((x - width / 2) / (width / 2), (y - height / 2) / (height / 2));
  return {
    gain:
      x > 0 && x < width && y > 0 && y < height
        ? Math.max(0, Math.min(1, (camera.zoom - 0.4) / 0.8)) * Math.max(0, 1 - distance * 0.45)
        : 0,
    pan: Math.max(-1, Math.min(1, (x / width - 0.5) * 1.5)),
  };
}

/** The outings that use each district venue. */
export const DISTRICT_OUTINGS: Record<DistrictKind, readonly OutingId[]> = {
  market: ['market'],
  bandstand: ['bandstand-tea', 'bandstand-sundown', 'stargazing'],
  landing: ['regatta'],
  harvest: ['harvest-fair', 'long-table'],
};
