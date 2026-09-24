import { drawZoo, zooSignHit, ZOO_SIGN_DEPTH } from './zoo';
import { drawSky } from './sky';
import { drawFarm, drawFarmGround, drawUfo } from './farm';
import { FARM, insideFarm, isFarmPlot } from '../lib/farm';
import { insideZoo, isZooPlot, ZOO_VENUE } from '../lib/zoo';
import { drawHouse, houseBounds } from './houses';
import { drawResident } from './residents';
import { drawVenue, venueBounds } from './venues';
import { drawBirds, drawMeadow } from './ambience';
import { paintGroundLayer } from './ground-cache';
import { drawFootball } from './football';
import { drawTownCat } from './cat';
import { drawDuck } from './ducks';
import { drawCinema, cinemaScreenHit } from './cinema';
import { insideCinema, isCinemaPlot, CINEMA_VENUE } from '../lib/cinema';
import { ducksAt } from '../lib/ducks';
import { townCatAt, TOWN_CAT_ID } from '../lib/town-cat';
import {
  footballAt,
  insideFootball,
  isFootballPlot,
  FOOTBALL_VENUE,
  type FootballState,
} from '../lib/football';
import { VENUES, venueAt, eventAtVenue, type TownEvent } from '../lib/events';
import {
  eveningDayAt,
  FORK_PLOT,
  lanternRegister,
  lanternsLit,
  taleOfTheEvening,
  type EveningTale,
  type LanternRegister,
} from '../lib/lanterns';
import { townArrivals } from '../lib/arrivals';
import { drawForkPlaza, drawLanternFork } from './lantern-fork';
import { drawSproutStake } from './lantern-post';
import { drawGlow } from './glow';
import { LAMPS, lampOn } from './lamplight';
import { drawCommitStone, drawFarFields, drawGoldenHour } from './horizon';
import type { ResidentState } from '../lib/simulation';
export { drawHouse as drawBuilding } from './houses';
import type { Place } from '../lib/schema';
import {
  PLOTS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  ROAD_MAX_X,
  ROAD_MAX_Y,
  BLOCK_SIZE,
  getPlot,
  hash,
  isRoad,
  plotCenter,
  project,
  unproject,
  type Plot,
  type Point,
} from '../lib/world';

type Ctx = CanvasRenderingContext2D;
type Palette = {
  grass: string;
  grassAlt: string;
  earth: string;
  edge: string;
  road: string;
  roadEdge: string;
  water: string;
  waterLight: string;
  leaf: string;
  leafLight: string;
  ink: string;
};
export type Camera = { x: number; y: number; zoom: number };
const houseDepth = (plot: Plot) => plot.x + plot.y + 0.8;
const venueDepth = (plot: Plot) => plot.x + plot.y + 0.1;
export const forkPlot = getPlot(FORK_PLOT)!;
const forkPt = plotCenter(forkPlot);
// Brass commit stones mark the four crossings around the Fork, the town's HEAD.
const FORK_CORNERS = new Set(
  [
    [-2, -2],
    [2, -2],
    [-2, 2],
    [2, 2],
  ].map(([dx, dy]) => `${forkPlot.x + dx},${forkPlot.y + dy}`),
);
// The register only changes with the published roster or the arrival order, never per frame.
const registers = new WeakMap<
  readonly Place[],
  { arrivals: readonly string[]; register: LanternRegister }
>();
function registerFor(roster: readonly Place[], arrivals: readonly string[]) {
  const cached = registers.get(roster);
  if (cached?.arrivals === arrivals) return cached.register;
  const register = lanternRegister(roster, arrivals);
  registers.set(roster, { arrivals, register });
  return register;
}
const tales = new WeakMap<readonly Place[], { eveningDay: number; tale?: EveningTale }>();
function taleFor(roster: readonly Place[], eveningDay: number) {
  const cached = tales.get(roster);
  if (cached?.eveningDay === eveningDay) return cached.tale;
  const tale = taleOfTheEvening(roster, eveningDay);
  tales.set(roster, { eveningDay, tale });
  return tale;
}
const residentDepth = (resident: ResidentState) => resident.position.x + resident.position.y;
// World geometry and seeds are fixed between builds; only their palette changes.
const terrain = Array.from({ length: WORLD_WIDTH * WORLD_HEIGHT }, (_, i) => {
  const x = Math.floor(i / WORLD_HEIGHT),
    y = i % WORLD_HEIGHT;
  return { x, y, point: project(x + 0.5, y + 0.5), seed: hash(`${x},${y}`), road: isRoad(x, y) };
});
const venuePlots = VENUES.map((venue) => PLOTS.find((plot) => plot.id === venue.plot)!);
const trees = terrain.flatMap(({ x, y, point }) => {
  const seed = hash(`tree${x},${y}`);
  const result: { point: Point; depth: number; scale: number; seed: number }[] = [];
  if (
    (x === 0 || y === 0 || y >= WORLD_HEIGHT - 2 || (x === WORLD_WIDTH - 1 && y >= 9)) &&
    seed % 3 !== 0
  )
    result.push({
      point: { x: point.x + (seed % 15) - 7, y: point.y },
      depth: x + y,
      scale: 1 + (seed % 5) * 0.12,
      seed,
    });
  if (
    x < ROAD_MAX_X &&
    y < ROAD_MAX_Y &&
    !isRoad(x, y) &&
    !insideFootball({ x, y }) &&
    !insideCinema({ x, y }) &&
    !insideZoo({ x, y }) &&
    !insideFarm({ x, y }) &&
    !venuePlots.some((plot) => Math.abs(plot.x - x) <= 1 && Math.abs(plot.y - y) <= 1) &&
    x % BLOCK_SIZE === 0 &&
    y % BLOCK_SIZE === 2 &&
    seed % 2
  )
    result.push({ point, depth: x + y, scale: 0.65, seed });
  return result;
});
export const DAY: Palette = {
  grass: '#B9CF9B',
  grassAlt: '#B4CA94',
  earth: '#A99C70',
  edge: '#879B68',
  road: '#E4D9B9',
  roadEdge: '#C3BD95',
  water: '#A1C9C9',
  waterLight: '#C1DCDC',
  leaf: '#688F59',
  leafLight: '#87A66A',
  ink: '#4C6445',
};
export const NIGHT: Palette = {
  grass: '#526E63',
  grassAlt: '#4D685E',
  earth: '#3B514B',
  edge: '#344C43',
  road: '#829080',
  roadEdge: '#596F63',
  water: '#466E7B',
  waterLight: '#668F9B',
  leaf: '#365A4F',
  leafLight: '#507569',
  ink: '#C3D4C2',
};

function poly(ctx: Ctx, points: number[][], fill: string, stroke?: string) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}
export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  // Keep the result in hex: night colors receive another shading pass on roof faces.
  return (
    '#' +
    [n >> 16, (n >> 8) & 255, n & 255]
      .map((v) =>
        Math.max(0, Math.min(255, v + amount))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function diamond(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  poly(
    ctx,
    [
      [x, y - ry],
      [x + rx, y],
      [x, y + ry],
      [x - rx, y],
    ],
    fill,
  );
}
function tree(ctx: Ctx, x: number, y: number, s: number, p: Palette, variant = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  diamond(ctx, 4, 3, 16, 7, '#23341B20');
  rect(ctx, -2, -12, 4, 15, '#867459');
  if (variant % 2) {
    poly(
      ctx,
      [
        [0, -43],
        [10, -28],
        [6, -28],
        [15, -15],
        [10, -15],
        [18, -4],
        [-18, -4],
        [-10, -15],
        [-15, -15],
        [-6, -28],
        [-10, -28],
      ],
      p.leaf,
    );
    poly(
      ctx,
      [
        [0, -43],
        [0, -4],
        [-18, -4],
        [-10, -15],
        [-15, -15],
        [-6, -28],
        [-10, -28],
      ],
      p.leafLight,
    );
  } else {
    poly(
      ctx,
      [
        [-5, -39],
        [7, -39],
        [7, -35],
        [14, -35],
        [14, -29],
        [19, -29],
        [19, -16],
        [14, -16],
        [14, -10],
        [-12, -10],
        [-12, -14],
        [-18, -14],
        [-18, -29],
        [-13, -29],
        [-13, -35],
        [-5, -35],
      ],
      p.leaf,
    );
    poly(
      ctx,
      [
        [-5, -39],
        [7, -39],
        [7, -35],
        [4, -35],
        [4, -28],
        [-3, -28],
        [-3, -19],
        [-13, -19],
        [-13, -24],
        [-18, -24],
        [-18, -29],
        [-13, -29],
        [-13, -35],
        [-5, -35],
      ],
      p.leafLight,
    );
    rect(ctx, -7, -31, 5, 4, shade(p.leafLight, 14));
  }
  ctx.restore();
}
type RenderOptions = {
  ctx: Ctx;
  width: number;
  height: number;
  camera: Camera;
  places: Place[];
  /** The published roster: lanterns, tales and UFO visits never include a local draft. */
  ufoPlaces?: readonly Place[];
  /** Arrival order, newest first; the build's Git history by default. */
  arrivals?: readonly string[];
  selectedPlot: string | null;
  hoveredPlot: string | null;
  night: boolean;
  showPlots: boolean;
  residents?: ResidentState[];
  followed?: string | null;
  events?: TownEvent[];
  minutes?: number;
  day?: number;
  football?: FootballState;
};
export function renderCity({
  ctx,
  width,
  height,
  camera,
  places,
  ufoPlaces = places,
  arrivals = townArrivals,
  selectedPlot,
  hoveredPlot,
  night,
  showPlots,
  residents = [],
  followed,
  events = [],
  minutes = 0,
  day = 0,
  football = footballAt(minutes, day),
}: RenderOptions) {
  ctx.clearRect(0, 0, width, height);
  drawSky(ctx, width, height, day, minutes);
  const p = night ? NIGHT : DAY;
  // Every light on the map reads the same lantern-hour clock, so the Fork, the windows, the
  // posts and the lamps can never disagree.
  const register = registerFor(ufoPlaces, arrivals);
  const tale = taleFor(ufoPlaces, eveningDayAt(minutes, day));
  const litCount = lanternsLit(register.total, minutes);
  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);
  const byPlot = new Map(places.map((place) => [place.plot, place]));
  const residentsByHome = new Map(residents.map((resident) => [resident.id, resident]));
  const view = {
    left: -camera.x / camera.zoom,
    right: (width - camera.x) / camera.zoom,
    top: -camera.y / camera.zoom,
    bottom: (height - camera.y) / camera.zoom,
  };
  const visible = (point: Point, rx: number, above: number, below: number) =>
    point.x + rx >= view.left &&
    point.x - rx <= view.right &&
    point.y + below >= view.top &&
    point.y - above <= view.bottom;
  const groundKey = [
    night,
    showPlots,
    selectedPlot,
    hoveredPlot,
    width,
    height,
    [...byPlot.keys()].sort().join(','),
  ].join(':');
  paintGroundLayer(ctx, groundKey, (ctx) => {
    drawFarFields(ctx, night);
    const terrainPoint = (x: number, y: number) => project(x, y);
    const b = terrainPoint(WORLD_WIDTH, 0),
      c = terrainPoint(WORLD_WIDTH, WORLD_HEIGHT),
      d = terrainPoint(0, WORLD_HEIGHT);
    poly(
      ctx,
      [
        [d.x, d.y],
        [c.x, c.y],
        [c.x, c.y + 16],
        [d.x, d.y + 16],
      ],
      p.earth,
    );
    poly(
      ctx,
      [
        [b.x, b.y],
        [c.x, c.y],
        [c.x, c.y + 16],
        [b.x, b.y + 16],
      ],
      p.edge,
    );
    poly(
      ctx,
      [
        [0, 0],
        [b.x, b.y],
        [c.x, c.y],
        [d.x, d.y],
      ],
      p.grass,
    );
    for (const { x, y, point: pt, seed, road } of terrain) {
      if (!visible(pt, 60, 24, 24)) continue;
      if (seed % 4 === 0) diamond(ctx, pt.x, pt.y, 38, 19, p.grassAlt);
      if (x === WORLD_WIDTH - 2 || (x === WORLD_WIDTH - 1 && y < 8)) {
        diamond(ctx, pt.x, pt.y, 38, 19, p.water);
        rect(ctx, pt.x - 12 + (seed % 16), pt.y, 12, 1, p.waterLight);
        if (y % 3 === 0) rect(ctx, pt.x + 3, pt.y + 6, 7, 1, p.waterLight);
      } else if (road) {
        diamond(ctx, pt.x, pt.y, 38, 19, p.roadEdge);
        diamond(ctx, pt.x, pt.y - 1, 36, 18, p.road);
        if (seed % 3 === 0) rect(ctx, pt.x + (seed % 10) - 5, pt.y + 4, 2, 1, p.roadEdge);
        if (x % BLOCK_SIZE === 1 && y % BLOCK_SIZE === 1)
          drawCommitStone(ctx, pt.x, pt.y, night, FORK_CORNERS.has(`${x},${y}`));
      } else if (seed % 2) {
        for (let k = 0; k < 3; k++) {
          const gx = pt.x - 19 + ((seed >> (k * 3)) % 35),
            gy = pt.y - 5 + ((seed >> (k * 2)) % 10);
          rect(ctx, gx, gy, 2, 2, night ? '#638171' : '#A4BE81');
        }
      }
    }
    // Stable plot IDs keep existing contributions in place as the town grows.
    for (const plot of PLOTS) {
      if (
        isFootballPlot(plot.id) ||
        isCinemaPlot(plot.id) ||
        isZooPlot(plot.id) ||
        isFarmPlot(plot.id)
      )
        continue;
      const pt = plotCenter(plot);
      if (!visible(pt, 110, 60, 60)) continue;
      const occupied = byPlot.has(plot.id) || !!venueAt(plot.id);
      const active = selectedPlot === plot.id;
      const hover = hoveredPlot === plot.id;
      if (occupied) {
        diamond(ctx, pt.x, pt.y, 105, 52.5, night ? '#577468' : '#BFD5A4');
        if (plot.id === FORK_PLOT) drawForkPlaza(ctx, pt.x, pt.y, night);
        // A short footpath connects the front of the lawn to the street.
        for (let step = 0; step < 5; step++) {
          const stone = project(plot.x + 0.5, plot.y + 1.02 + step * 0.25);
          diamond(ctx, stone.x, stone.y, 7, 3.5, night ? '#899483' : '#E3DABF');
        }
      }
      if (!occupied) drawMeadow(ctx, plot, night);
      if (active || hover) diamond(ctx, pt.x, pt.y, 108, 54, night ? '#B5C59B40' : '#F4EDCD80');
      if (!occupied && (showPlots || hover || active)) {
        const corners = [
          [pt.x, pt.y - 49],
          [pt.x + 98, pt.y],
          [pt.x, pt.y + 49],
          [pt.x - 98, pt.y],
        ];
        ctx.save();
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = active || hover ? p.ink : night ? '#ABC6B850' : '#69885A55';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = p.ink;
        ctx.font = '10px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(plot.id, pt.x, pt.y + 4);
      }
      // An empty plot waits for its lantern: the stake stands where the post will go.
      if (!occupied) drawSproutStake(ctx, pt.x, pt.y, night, hash(`stake:${plot.id}`));
    }
    drawFarmGround(ctx, night);
  });
  const objects = drawFootball(
    ctx,
    football,
    night,
    isFootballPlot(selectedPlot ?? '') || isFootballPlot(hoveredPlot ?? ''),
  );
  objects.push(...drawFarm(ctx, minutes, day, night));
  objects.push(
    ...drawZoo(
      ctx,
      minutes,
      night,
      isZooPlot(selectedPlot ?? '') || isZooPlot(hoveredPlot ?? ''),
      day,
    ),
  );
  // Rugs are floor paint: they must never be drawn over seated guests.
  objects.push(
    ...drawCinema(
      ctx,
      minutes,
      day,
      night,
      isCinemaPlot(selectedPlot ?? '') || isCinemaPlot(hoveredPlot ?? ''),
    ),
  );
  for (const venue of VENUES) {
    if (venue.kind === 'cinema' || venue.kind === 'zoo' || venue.kind === 'fork') continue;
    const plot = PLOTS.find((plot) => plot.id === venue.plot)!;
    const point = plotCenter(plot);
    drawVenue(
      ctx,
      venue,
      point.x,
      point.y,
      night,
      eventAtVenue(events, venue.id, minutes),
      minutes,
      'ground',
    );
  }
  for (const { point, depth, scale, seed } of trees) {
    if (!visible(point, 38, 80, 18)) continue;
    objects.push({ depth, paint: () => tree(ctx, point.x, point.y, scale, p, seed) });
  }
  for (const venue of VENUES) {
    if (venue.kind === 'cinema' || venue.kind === 'zoo' || venue.kind === 'fork') continue;
    const plot = PLOTS.find((plot) => plot.id === venue.plot)!;
    const pt = plotCenter(plot);
    objects.push({
      depth: venueDepth(plot),
      paint: () =>
        drawVenue(ctx, venue, pt.x, pt.y, night, eventAtVenue(events, venue.id, minutes), minutes),
    });
  }
  if (visible(forkPt, 90, 140, 50))
    objects.push(
      ...drawLanternFork(ctx, {
        x: forkPt.x,
        y: forkPt.y,
        depth: forkPlot.x + forkPlot.y,
        register,
        lit: litCount,
        taleId: tale?.placeId,
        night,
        leaf: p.leaf,
        leafLight: p.leafLight,
      }),
    );
  for (const place of places) {
    const plot = PLOTS.find((v) => v.id === place.plot);
    if (!plot) continue;
    const pt = plotCenter(plot);
    // Drafts are not on the register, so a local preview gets no lantern post.
    const entry = register.byId.get(place.id);
    const lantern = entry && {
      lit: entry.index < litCount,
      tale: tale?.placeId === place.id,
      newest: register.newest === place.id,
    };
    objects.push({
      depth: houseDepth(plot),
      paint: () =>
        drawHouse(ctx, place, pt.x, pt.y, night, 1.12, {
          minutes,
          activity: residentsByHome.get(place.id)?.activity,
          lantern,
        }),
    });
  }
  // After the lanterns, the lamps carry the light outward from the Fork.
  for (const { x, y, distance } of LAMPS) {
    const pt = project(x + 0.5, y + 0.5);
    if (!visible(pt, 26, 57, 2)) continue;
    const lit = night && lampOn(distance, minutes);
    objects.push({
      depth: x + y,
      paint: () => {
        rect(ctx, pt.x, pt.y - 29, 2, 30, night ? '#637266' : '#8B9073');
        rect(ctx, pt.x - 3, pt.y - 33, 8, 6, lit ? '#F4D79A' : night ? '#7C8272' : '#EDE5C1');
        rect(ctx, pt.x - 4, pt.y - 35, 10, 2, night ? '#7A8C7D' : '#748269');
        if (lit) drawGlow(ctx, pt.x + 1, pt.y - 30, 24, 0.19);
      },
    });
  }
  for (const resident of residents) {
    if (resident.activity !== 'stroll') continue;
    const pt = project(resident.position.x, resident.position.y);
    objects.push({
      depth: residentDepth(resident),
      paint: () => {
        if (followed === resident.id)
          diamond(ctx, pt.x, pt.y + 2, 10, 5, night ? '#F0DBA575' : '#FFF7D5');
        drawResident(ctx, resident.resident, pt.x, pt.y, 1.25, resident);
      },
    });
  }
  const cat = townCatAt(places, minutes, day);
  for (const duck of ducksAt(minutes))
    objects.push({
      depth: duck.position.x + duck.position.y,
      paint: () => drawDuck(ctx, duck, night),
    });
  if (cat.outside)
    objects.push({
      depth: cat.position.x + cat.position.y,
      paint: () => drawTownCat(ctx, cat, night, followed === TOWN_CAT_ID),
    });
  objects.sort((a, b) => a.depth - b.depth).forEach((object) => object.paint());
  drawBirds(ctx, minutes, night);
  drawUfo(ctx, minutes, day, ufoPlaces);
  ctx.restore();
  drawGoldenHour(ctx, width, height, minutes);
}

export function buildingHit(point: Point, places: Place[]): string | undefined {
  // Frontmost buildings win when their silhouettes overlap.
  const ordered = places
    .map((place) => ({ place, plot: PLOTS.find((p) => p.id === place.plot)! }))
    .filter((v) => v.plot)
    .sort((a, b) => b.plot.x + b.plot.y - (a.plot.x + a.plot.y));
  for (const { place, plot } of ordered) {
    const p = plotCenter(plot);
    const tall = houseBounds(place).top * 1.12;
    if (point.x >= p.x - 55 && point.x <= p.x + 55 && point.y >= p.y - tall && point.y <= p.y + 20)
      return plot.id;
  }
}

type CityHit = { kind: 'place' | 'resident'; id: string };

export function cityHit(
  point: Point,
  places: Place[],
  residents: ResidentState[],
  cinemaScreenReveal = 1,
): CityHit | undefined {
  const plotId = buildingHit(point, places);
  const plot = PLOTS.find((plot) => plot.id === plotId);
  let depth = plot ? houseDepth(plot) : -Infinity;
  let target: CityHit | undefined = plot ? { kind: 'place', id: plot.id } : undefined;
  if (insideFarm(unproject(point.x, point.y)) && depth < 0) {
    target = { kind: 'place', id: FARM.plot };
    depth = -1;
  }
  const hitsZooSign = zooSignHit(point);
  if (insideZoo(unproject(point.x, point.y)) || hitsZooSign) {
    const zooDepth = hitsZooSign ? ZOO_SIGN_DEPTH : -1;
    if (zooDepth >= depth) {
      depth = zooDepth;
      target = { kind: 'place', id: ZOO_VENUE.plot };
    }
  }
  const board = project(15.5, 22.2);
  const hitsBoard =
    point.x >= board.x - 92 &&
    point.x <= board.x + 92 &&
    point.y >= board.y - 93 &&
    point.y <= board.y - 33;
  if (insideFootball(unproject(point.x, point.y)) || hitsBoard) {
    depth = -1;
    target = { kind: 'place', id: FOOTBALL_VENUE.plot };
  }
  for (const venue of VENUES) {
    if (venue.kind === 'cinema' || venue.kind === 'zoo') continue;
    const plot = PLOTS.find((plot) => plot.id === venue.plot)!;
    const p = plotCenter(plot),
      bounds = venueBounds(venue);
    if (
      venueDepth(plot) >= depth &&
      point.x >= p.x + bounds.left &&
      point.x <= p.x + bounds.right &&
      point.y >= p.y + bounds.top &&
      point.y <= p.y + bounds.bottom
    ) {
      depth = venueDepth(plot);
      target = { kind: 'place', id: plot.id };
    }
  }
  // Match the painter's order: residents follow houses at equal depth, and
  const hitsCinemaScreen = cinemaScreenHit(point, cinemaScreenReveal);
  if (insideCinema(unproject(point.x, point.y)) || hitsCinemaScreen) {
    const cinemaDepth = hitsCinemaScreen ? 40.2 : -1;
    if (cinemaDepth >= depth || !target) {
      depth = cinemaDepth;
      target = { kind: 'place', id: CINEMA_VENUE.plot };
    }
  }
  // the last resident in the input wins ties (the drawing sort is stable).
  for (const resident of residents) {
    if (resident.activity !== 'stroll' || residentDepth(resident) < depth) continue;
    const p = project(resident.position.x, resident.position.y);
    if (Math.abs(point.x - p.x) < 9 && point.y > p.y - 28 && point.y < p.y + 5) {
      target = { kind: 'resident', id: resident.id };
      depth = residentDepth(resident);
    }
  }
  return target;
}
