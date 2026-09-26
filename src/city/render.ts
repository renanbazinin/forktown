import { drawZoo, zooSignHit, ZOO_SIGN_DEPTH } from './zoo';
import { drawSky } from './sky';
import { drawFarm, drawFarmGround, drawUfo } from './farm';
import { FARM, insideFarm, isFarmPlot } from '../lib/farm';
import { insideZoo, isZooPlot, ZOO_VENUE } from '../lib/zoo';
import { insideMillpond, isMillpondPlot, MILLPOND_VENUE } from '../lib/millpond';
import {
  drawMillpond,
  drawMillpondGround,
  drawMillpondSurface,
  millpondSignHit,
  MILLPOND_SIGN_DEPTH,
} from './millpond';
import { houseBounds, houseReach } from './houses';
import { housePainter } from './house-sprites';
import { drawResident, residentReach } from './residents';
import { drawVenue, venueBounds } from './venues';
import { drawBirds, drawMeadow } from './ambience';
import { drawTownTree } from './trees';
import { drawFireflies, drawSeasonLight, drawSnowfall } from './weather';
import { groundTuft, riverGlint } from './season-ground';
import { SNOW, pick } from './season-palette';
import { seedFraction, snowAt, townSeasonAt } from '../lib/seasons';
import { paintGroundLayer, type GroundArea } from './ground-cache';
import {
  drawFootball,
  footballFurnitureHit,
  lampBlocksGoal,
  scoreboardHit,
  spectatorAlpha,
} from './football';
import { drawTownCat } from './cat';
import { drawDuck } from './ducks';
import { drawCinema, cinemaScreenHit } from './cinema';
import {
  drawTubeGround,
  drawTubeTraffic,
  drawTubes,
  inTubeGlass,
  tubeHit,
  tubeCrowdOffsets,
} from './tubes';
import { isTubePlot } from '../lib/tubes';
import { tubeParcelsAt, type TubeParcelState } from '../lib/tube-traffic';
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
  night: boolean;
};
export type Camera = { x: number; y: number; zoom: number };
const houseDepth = (plot: Plot) => plot.x + plot.y + 0.8;
/** Houses stand a little larger than their plot art. */
const HOUSE_SCALE = 1.12;
/** Walkers are drawn at 1.25 times their preview size. */
const RESIDENT_SCALE = 1.25;
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
/** Each streetlamp's snow schedule, fixed by where it stands. */
const LAMP_SNOW = LAMPS.map(({ x, y }) => seedFraction(`lamp:${x},${y}`));
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
    !insideMillpond({ x, y }) &&
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
  night: false,
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
  night: true,
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
  // The turning year: one snapshot per frame, from the same day and minute as the sky.
  const season = townSeasonAt(day, minutes);
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
  const paintHouse = housePainter(ctx);
  const view = {
    left: -camera.x / camera.zoom,
    right: (width - camera.x) / camera.zoom,
    top: -camera.y / camera.zoom,
    bottom: (height - camera.y) / camera.zoom,
  };
  const within = (area: GroundArea) => (point: Point, rx: number, above: number, below: number) =>
    point.x + rx >= area.left &&
    point.x - rx <= area.right &&
    point.y + below >= area.top &&
    point.y - above <= area.bottom;
  const visible = within(view);
  const groundKey = [
    night,
    showPlots,
    width,
    height,
    [...byPlot.keys()].sort().join(','),
    // Seasonal ground art reads the whole day of the year, so the layer repaints once a town day.
    season.groundDay,
  ].join(':');
  // The hover and selection marks stay out of the key: moving the pointer to another plot
  // repaints just the plots it leaves and reaches. A station lights the whole Treeline, so it
  // repaints the layer; the venues with their own art mark themselves outside it.
  const mark = (id: string | null) => {
    const plot = getPlot(id ?? '');
    if (
      !plot ||
      isFootballPlot(plot.id) ||
      isCinemaPlot(plot.id) ||
      isZooPlot(plot.id) ||
      isFarmPlot(plot.id) ||
      isMillpondPlot(plot.id)
    )
      return '';
    return isTubePlot(plot.id) ? 'tube' : plot.id;
  };
  const marks = {
    key: `${mark(selectedPlot)} ${mark(hoveredPlot)}`,
    areas: (key: string) => {
      const ids = key.split(' ').filter(Boolean);
      if (ids.includes('tube')) return null;
      return ids.map((id) => {
        const pt = plotCenter(getPlot(id)!);
        return { left: pt.x - 112, right: pt.x + 112, top: pt.y - 58, bottom: pt.y + 58 };
      });
    },
  };
  // The Treeline: both station plots light up together, and its parcels are read at most once a
  // frame, only if some of the line is in view.
  const emphasis = isTubePlot(selectedPlot ?? '')
    ? 'selected'
    : isTubePlot(hoveredPlot ?? '')
      ? 'hover'
      : 'none';
  let parcels: TubeParcelState[] | undefined;
  const tube = {
    minutes,
    day,
    night,
    season,
    zoom: camera.zoom,
    emphasis,
    visible,
    residents,
    followed,
    parcels: () => (parcels ??= tubeParcelsAt(places, minutes, day)),
  } as const;
  const paintGround = (ctx: Ctx, area?: GroundArea) => {
    // A partial repaint culls tiles and plots to its own area; the canvas clips the rest.
    const near = area ? within(area) : visible;
    drawFarFields(ctx, night, season);
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
      if (!near(pt, 60, 24, 24)) continue;
      if (insideMillpond({ x, y })) continue;
      if (seed % 4 === 0) diamond(ctx, pt.x, pt.y, 38, 19, p.grassAlt);
      if (x === WORLD_WIDTH - 2 || (x === WORLD_WIDTH - 1 && y < 8)) {
        diamond(ctx, pt.x, pt.y, 38, 19, p.water);
        const glint = riverGlint(p.waterLight, night, season, seed);
        rect(ctx, pt.x - 12 + (seed % 16), pt.y, 12, 1, glint);
        if (y % 3 === 0) rect(ctx, pt.x + 3, pt.y + 6, 7, 1, glint);
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
          const tuft = groundTuft(seed, k, night, season);
          rect(ctx, gx, gy, tuft.w, tuft.h, tuft.fill);
        }
      }
    }
    // Stable plot IDs keep existing contributions in place as the town grows.
    for (const plot of PLOTS) {
      if (
        isFootballPlot(plot.id) ||
        isCinemaPlot(plot.id) ||
        isZooPlot(plot.id) ||
        isFarmPlot(plot.id) ||
        isMillpondPlot(plot.id)
      )
        continue;
      const pt = plotCenter(plot);
      if (!near(pt, 110, 60, 60)) continue;
      const occupied = byPlot.has(plot.id) || !!venueAt(plot.id);
      // A tube station keeps its meadow and loses only the stake, label and outline.
      const tubePlot = isTubePlot(plot.id);
      const active = tubePlot ? isTubePlot(selectedPlot ?? '') : selectedPlot === plot.id;
      const hover = tubePlot ? isTubePlot(hoveredPlot ?? '') : hoveredPlot === plot.id;
      if (occupied) {
        diamond(ctx, pt.x, pt.y, 105, 52.5, night ? '#577468' : '#BFD5A4');
        if (plot.id === FORK_PLOT) drawForkPlaza(ctx, pt.x, pt.y, night);
        // A short footpath connects the front of the lawn to the street.
        for (let step = 0; step < 5; step++) {
          const stone = project(plot.x + 0.5, plot.y + 1.02 + step * 0.25);
          diamond(ctx, stone.x, stone.y, 7, 3.5, night ? '#899483' : '#E3DABF');
        }
      }
      if (!occupied) drawMeadow(ctx, plot, night, season);
      if (active || hover) diamond(ctx, pt.x, pt.y, 108, 54, night ? '#B5C59B40' : '#F4EDCD80');
      if (!occupied && !tubePlot && (showPlots || hover || active)) {
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
      if (!occupied && !tubePlot) drawSproutStake(ctx, pt.x, pt.y, night, hash(`stake:${plot.id}`));
    }
    drawFarmGround(ctx, night, season);
    drawMillpondGround(ctx, night, season, p.water, p.waterLight);
    drawTubeGround(ctx, tube);
  };
  paintGroundLayer(ctx, groundKey, paintGround, marks);
  // Riders in the glass behind the tree line: every edge tree stands in front of them.
  drawTubeTraffic(ctx, tube);
  const objects = drawFootball(
    ctx,
    football,
    night,
    isFootballPlot(selectedPlot ?? '') || isFootballPlot(hoveredPlot ?? ''),
    minutes,
  );
  objects.push(...drawFarm(ctx, minutes, day, night));
  objects.push(
    ...drawZoo(ctx, {
      minutes,
      day,
      night,
      season,
      selected: isZooPlot(selectedPlot ?? '') || isZooPlot(hoveredPlot ?? ''),
      visible,
    }),
  );
  // Rugs are floor paint: they must never be drawn over seated guests.
  objects.push(
    ...drawCinema(
      ctx,
      minutes,
      day,
      night,
      isCinemaPlot(selectedPlot ?? '') || isCinemaPlot(hoveredPlot ?? ''),
      season,
    ),
  );
  // The Millpond: flat water art now, under everyone on its banks; its uprights join the sort.
  const pond = {
    minutes,
    day,
    night,
    season,
    visible,
    litCount,
    total: register.total,
    selected: isMillpondPlot(selectedPlot ?? '') || isMillpondPlot(hoveredPlot ?? ''),
  };
  drawMillpondSurface(ctx, pond);
  objects.push(...drawMillpond(ctx, pond));
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
    objects.push({
      depth,
      paint: () => drawTownTree(ctx, point.x, point.y, scale, p, seed, season),
    });
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
        season,
      }),
    );
  for (const place of places) {
    const plot = getPlot(place.plot);
    if (!plot) continue;
    const pt = plotCenter(plot);
    // Like the trees, a house off screen is skipped: its box holds the roof, the sign, the
    // lantern post and the chimney smoke.
    const reach = houseReach(place);
    if (
      !visible(pt, reach.right * HOUSE_SCALE, reach.top * HOUSE_SCALE, reach.bottom * HOUSE_SCALE)
    )
      continue;
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
        paintHouse(place, pt.x, pt.y, night, HOUSE_SCALE, {
          minutes,
          activity: residentsByHome.get(place.id)?.activity,
          lantern,
          season,
        }),
    });
  }
  // After the lanterns, the lamps carry the light outward from the Fork.
  LAMPS.forEach(({ x, y, distance }, i) => {
    const pt = project(x + 0.5, y + 0.5);
    if (!visible(pt, 26, 57, 2) || lampBlocksGoal(x + 0.5, y + 0.5)) return;
    const lit = night && lampOn(distance, minutes);
    const snow = snowAt(season.yearDay, LAMP_SNOW[i]);
    objects.push({
      depth: x + y,
      paint: () => {
        rect(ctx, pt.x, pt.y - 29, 2, 30, night ? '#637266' : '#8B9073');
        rect(ctx, pt.x - 3, pt.y - 33, 8, 6, lit ? '#F4D79A' : night ? '#7C8272' : '#EDE5C1');
        rect(ctx, pt.x - 4, pt.y - 35, 10, 2, night ? '#7A8C7D' : '#748269');
        if (snow > 0) {
          // A line of snow on the hood, settling and thawing with the roofs around it.
          const alpha = ctx.globalAlpha;
          ctx.globalAlpha = alpha * snow;
          rect(ctx, pt.x - 3, pt.y - 36, 8, 1, pick(SNOW.top, night));
          ctx.globalAlpha = alpha;
        }
        if (lit) drawGlow(ctx, pt.x + 1, pt.y - 30, 24, 0.19);
      },
    });
  });
  // The line's glass, stacks and sign, pushed before the residents so walkers win ties.
  objects.push(...drawTubes(ctx, tube));
  // Neighbors walking in lockstep to or from a stack stand side by side.
  const offsets = tubeCrowdOffsets(residents);
  for (const resident of residents) {
    if (resident.activity !== 'stroll') continue;
    // Riders in the glass and figures in a stack are the tube's to draw.
    if (inTubeGlass(resident.transit)) continue;
    const ground = project(resident.position.x, resident.position.y);
    const pt = { x: ground.x + (offsets.get(resident.id) ?? 0), y: ground.y };
    // Walkers off screen are skipped too. The ring round a followed one, 10px either way and 7px
    // below the feet, gets the same 2px to spare.
    const reach = residentReach(ctx, resident.resident, resident);
    if (
      !visible(
        pt,
        Math.max(reach.x * RESIDENT_SCALE, 12),
        reach.above * RESIDENT_SCALE,
        Math.max(reach.below * RESIDENT_SCALE, 9),
      )
    )
      continue;
    objects.push({
      depth: residentDepth(resident),
      paint: () => {
        if (followed === resident.id)
          diamond(ctx, pt.x, pt.y + 2, 10, 5, night ? '#F0DBA575' : '#FFF7D5');
        // Spectators at the football fade while play near the touchline is behind them.
        const alpha = ctx.globalAlpha;
        if (resident.event?.id === 'football')
          ctx.globalAlpha = alpha * spectatorAlpha(football, pt);
        drawResident(ctx, resident.resident, pt.x, pt.y, RESIDENT_SCALE, resident);
        ctx.globalAlpha = alpha;
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
  // Summer fireflies hover among the houses and trees, so they take part in the depth sort.
  objects.push(...drawFireflies(ctx, season, night, visible));
  objects.sort((a, b) => a.depth - b.depth).forEach((object) => object.paint());
  drawBirds(ctx, minutes, night);
  drawUfo(ctx, minutes, day, ufoPlaces);
  ctx.restore();
  drawSnowfall(ctx, width, height, season, night);
  drawGoldenHour(ctx, width, height, minutes);
  drawSeasonLight(ctx, width, height, season, night);
}

export function buildingHit(point: Point, places: Place[]): string | undefined {
  // Frontmost buildings win when their silhouettes overlap.
  const ordered = places
    .map((place) => ({ place, plot: PLOTS.find((p) => p.id === place.plot)! }))
    .filter((v) => v.plot)
    .sort((a, b) => b.plot.x + b.plot.y - (a.plot.x + a.plot.y));
  for (const { place, plot } of ordered) {
    const p = plotCenter(plot);
    const tall = houseBounds(place).top * HOUSE_SCALE;
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
  // The pond and its mill, under any roof in front; the gate sign rises over the south road.
  if (insideMillpond(unproject(point.x, point.y)) && depth < 0) {
    target = { kind: 'place', id: MILLPOND_VENUE.plot };
    depth = -1;
  }
  if (millpondSignHit(point) && MILLPOND_SIGN_DEPTH >= depth) {
    target = { kind: 'place', id: MILLPOND_VENUE.plot };
    depth = MILLPOND_SIGN_DEPTH;
  }
  const hitsZooSign = zooSignHit(point);
  if (insideZoo(unproject(point.x, point.y)) || hitsZooSign) {
    const zooDepth = hitsZooSign ? ZOO_SIGN_DEPTH : -1;
    if (zooDepth >= depth) {
      depth = zooDepth;
      target = { kind: 'place', id: ZOO_VENUE.plot };
    }
  }
  const hitsBoard = scoreboardHit(point);
  if (insideFootball(unproject(point.x, point.y)) || hitsBoard) {
    depth = -1;
    target = { kind: 'place', id: FOOTBALL_VENUE.plot };
  } else {
    // Dugout roofs, masts and the scoreboard's legs rise over the roads and houses behind.
    const furniture = footballFurnitureHit(point);
    if (furniture > -Infinity && furniture >= depth) {
      depth = furniture;
      target = { kind: 'place', id: FOOTBALL_VENUE.plot };
    }
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
  // The Treeline's stacks, sign and glass select the line; its glass behind the tree line is at
  // depth -1, under everything else.
  const tube = tubeHit(point);
  if (tube && tube.depth >= depth) {
    depth = tube.depth;
    target = { kind: 'place', id: tube.id };
  }
  // the last resident in the input wins ties (the drawing sort is stable). Riders in the glass
  // and figures in a stack are never hit: clicking them selects the line.
  for (const resident of residents) {
    if (
      resident.activity !== 'stroll' ||
      residentDepth(resident) < depth ||
      inTubeGlass(resident.transit)
    )
      continue;
    const p = project(resident.position.x, resident.position.y);
    if (Math.abs(point.x - p.x) < 9 && point.y > p.y - 28 && point.y < p.y + 5) {
      target = { kind: 'resident', id: resident.id };
      depth = residentDepth(resident);
    }
  }
  return target;
}
