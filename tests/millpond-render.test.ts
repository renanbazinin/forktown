import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIGHT } from '../src/city/glow';
import {
  GROUND_ORDER,
  LAMP_WATER,
  MILLPOND_GROUND_PARTS,
  MILLPOND_SIGN_DEPTH,
  MILLPOND_SURFACE_PARTS,
  MILL_DEPTH,
  MOON_WATER,
  SECRET_GLINT,
  SECRET_LURE,
  SURFACE_ORDER,
  WATER_LAMPS,
  drawBoat,
  drawHeron,
  drawMill,
  drawMillpond,
  drawMillpondGround,
  drawMillpondSurface,
  drawReeds,
  drawSceneSkater,
  drawWheel,
  millpondGroundState,
  millpondSignHit,
  millpondSurfaceState,
  lampColumns,
  moonReflectionAt,
  type Heron,
  type MillpondObject,
  type MillpondOptions,
  type MillpondPart,
} from '../src/city/millpond';
import { lampBlocksGoal } from '../src/city/football';
import { lampOn } from '../src/city/lamplight';
import { cityHit, DAY, NIGHT } from '../src/city/render';
import { drawResident } from '../src/city/residents';
import { BLOSSOM, FALLEN_LEAVES, ICE, POND, SNOW, type Pair } from '../src/city/season-palette';
import { drawFireflies, MILLPOND_SWARMS } from '../src/city/weather';
import { houseBounds } from '../src/city/houses';
import { lanternsLit } from '../src/lib/lanterns';
import {
  BOAT_MOORINGS,
  BOAT_STORE,
  MILLPOND_GROUND as G,
  MILLPOND_LEAVES,
  MILLPOND_MILL,
  MILLPOND_REEDS,
  MILLPOND_SIGN,
  MILLPOND_VENUE,
  SCENERY_SKATE_LOOPS,
  SIGHTLINE,
  SKATE_LOOPS,
  boatsAt,
  fishRisesAt,
  heronAt,
  iceOn,
  iceSecretAt,
  leafCountAt,
  lilyFlowersOn,
  lilyPadsOn,
  millpondRoute,
  mistAt,
  petalCountAt,
  shoreDistance,
  sightlineLimit,
  type PondBoat,
} from '../src/lib/millpond';
import { FOOTBALL_CENTER } from '../src/lib/football';
import { DEFAULT_RESIDENT, placeSchema } from '../src/lib/schema';
import { townSeasonAt } from '../src/lib/seasons';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { getPlot, plotCenter, project, unproject, type Point } from '../src/lib/world';
import type { ResidentState } from '../src/lib/simulation';
import { matrixContext, type MatrixPoint } from './matrix-context';
import { recordingContext, type RecordedCall } from './recording-context';

// The Millpond through the renderer's eyes: it keeps the football in view (spec §1 rules 1-3),
// stays inside its own ground, spends its calls within the caps, keeps the cached ground pure,
// paints the same frame twice, and keeps amber for reflected light only.

// Year 3, so no sampled date touches the calendar's epoch.
const dayOf = (season: number, date: number) => CALENDAR_EPOCH_DAY + 224 + 28 * season + date - 1;
const dateOf = (day: number) => ((day - CALENDAR_EPOCH_DAY) % 28) + 1;
const isNight = (minutes: number) => minutes < 360 || minutes >= 1200;
const STAGES = [
  { name: 'Spring 9', day: dayOf(0, 9) },
  { name: 'Spring 19', day: dayOf(0, 19) },
  { name: 'Summer 14', day: dayOf(1, 14) },
  { name: 'Autumn 7', day: dayOf(2, 7) },
  { name: 'Autumn 21', day: dayOf(2, 21) },
  { name: 'Winter 1', day: dayOf(3, 1) },
  { name: 'Winter 6, freezing', day: dayOf(3, 6) },
  { name: 'Winter 11, frozen', day: dayOf(3, 11) },
  { name: 'Winter 21, thawing', day: dayOf(3, 21) },
  { name: 'Winter 26', day: dayOf(3, 26) },
];
// Dawn mist, noon, afternoon, golden hour, the lanterns, the lamps, 21:00, 22:00 and 03:00.
const MINUTES = [375, 720, 900, 1165, 1210, 1225, 1260, 1320, 180];
const SUMMER = dayOf(1, 14);
const WINTER_15 = dayOf(3, 15);
/** The first minute in [from, to) that passes, if the model has one. */
function findMoment(from: number, to: number, test: (minutes: number) => boolean) {
  for (let minutes = from; minutes < to; minutes += 0.25) if (test(minutes)) return minutes;
}
const strike = findMoment(360, 480, (m) => {
  const heron = heronAt(m, SUMMER);
  return heron?.pose === 'strike' && heron.progress > 0.35;
});
const leap = findMoment(1080, 1290, (m) =>
  fishRisesAt(m, SUMMER).some((rise) => rise.leap && rise.progress < 0.2),
);
type Moment = { name: string; day: number; minutes: number };
const MOMENTS: Moment[] = [
  ...STAGES.flatMap(({ name, day }) =>
    MINUTES.map((minutes) => ({ name: `${name} ${minutes}`, day, minutes })),
  ),
  ...[180, 182, 200, 226, 269].map((minutes) => ({
    name: `Winter 15 ${minutes}`,
    day: WINTER_15,
    minutes,
  })),
  ...(strike === undefined
    ? []
    : [{ name: `heron strike ${strike}`, day: SUMMER, minutes: strike }]),
  ...(leap === undefined ? [] : [{ name: `fish leap ${leap}`, day: SUMMER, minutes: leap }]),
];

// The opening view's culling, as render.ts builds it (the render-smoke frame).
const CAMERA = { x: 720, y: 88, zoom: 0.7 };
const VIEW = {
  left: -CAMERA.x / CAMERA.zoom,
  right: (1440 - CAMERA.x) / CAMERA.zoom,
  top: -CAMERA.y / CAMERA.zoom,
  bottom: (900 - CAMERA.y) / CAMERA.zoom,
};
const opening = (point: Point, rx: number, above: number, below: number) =>
  point.x + rx >= VIEW.left &&
  point.x - rx <= VIEW.right &&
  point.y + below >= VIEW.top &&
  point.y - above <= VIEW.bottom;
const everywhere = () => true;

function options(day: number, minutes: number, extra: Partial<MillpondOptions> = {}) {
  const total = extra.total ?? 24;
  return {
    minutes,
    day,
    night: isNight(minutes),
    season: townSeasonAt(day, minutes),
    selected: false,
    litCount: lanternsLit(total, minutes),
    total,
    visible: everywhere,
    ...extra,
  } satisfies MillpondOptions;
}
type PaintedObject = { object: MillpondObject; points: MatrixPoint[]; calls: RecordedCall[] };
/** All three layers, each on its own world-pixel recorder, objects painted in depth order. */
function paint(opts: MillpondOptions) {
  const palette = opts.night ? NIGHT : DAY;
  const ground = matrixContext();
  drawMillpondGround(ground.ctx, opts.night, opts.season, palette.water, palette.waterLight);
  const surface = matrixContext();
  drawMillpondSurface(surface.ctx, opts);
  const upright = matrixContext();
  const objects: PaintedObject[] = drawMillpond(upright.ctx, opts)
    .sort((a, b) => a.depth - b.depth)
    .map((object) => {
      const calls = upright.calls.length,
        points = upright.points.length;
      object.paint();
      return {
        object,
        calls: upright.calls.slice(calls),
        points: upright.points.slice(points),
      };
    });
  return { ground, surface, upright, objects };
}
const trace = (calls: RecordedCall[]) =>
  calls.map(
    ({ name, args, fillStyle, offset }) =>
      `${name}(${args.map(String).join(',')}) ${String(fillStyle)} ${offset.x},${offset.y}`,
  );
/** Colours actually painted with. */
const fills = (calls: RecordedCall[]) =>
  calls
    .filter((call) => ['fillRect', 'fill', 'fillText'].includes(call.name))
    .map((call) => String(call.fillStyle));
const both = (...pairs: readonly Pair[]) => pairs.flatMap((pair) => [...pair]);

// The three view rules (spec §1), in world pixels.
const belowNorthLine = (p: Point) => p.y >= 1102 + p.x / 2 - 1e-6;
const belowWestLine = (p: Point) => p.y >= 342 - p.x / 2 - 1e-6;
/** How tall an object stands above its own footprint (a point, or a line along x or y). */
function heightOf({ object, points }: { object: MillpondObject; points: MatrixPoint[] }) {
  const anchor = project(object.ground.x, object.ground.y);
  return Math.max(0, ...points.map((p) => anchor.y + object.slope * (p.x - anchor.x) - p.y));
}
const insideGround = (p: Point, margin = 0.05) => {
  const tile = unproject(p.x, p.y);
  return (
    tile.x >= G.left - margin &&
    tile.x <= G.right + margin &&
    tile.y >= G.top - margin &&
    tile.y <= G.bottom + margin
  );
};
function convexHull(points: readonly Point[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [],
    upper: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
/** Strictly inside a convex polygon, by at least `margin` px from every edge. */
function insideHull(p: Point, hull: readonly Point[], margin = 0.5) {
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i],
      b = hull[(i + 1) % hull.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const side = ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / length;
    // The hull runs clockwise on screen (y down), so the inside is the positive side.
    if (side < margin) return false;
  }
  return true;
}

/** Points every 0.05 tile along a route. */
function alongRoute(route: readonly Point[]) {
  const points: Point[] = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.05));
    for (let k = 0; k <= steps; k++)
      points.push({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps });
  }
  return points;
}
/** A sprite's real painted extent from its ground point: px left (negative) and right, and up. */
type Extent = { left: number; right: number; up: number; half: number };
type Sample = [ground: Point, draw: (ctx: CanvasRenderingContext2D) => void];
function extentOf(samples: Sample[]): Extent {
  let left = 0,
    right = 0,
    up = 0;
  for (const [ground, draw] of samples) {
    const record = matrixContext();
    draw(record.ctx);
    expect(record.unknown).toEqual([]);
    for (const p of record.points) {
      left = Math.min(left, p.x - ground.x);
      right = Math.max(right, p.x - ground.x);
      up = Math.max(up, ground.y - p.y);
    }
  }
  return { left, right, up, half: Math.max(-left, right) };
}
function once<T>(build: () => T) {
  let value: T | undefined;
  return () => (value ??= build());
}
const FACINGS = ['ne', 'nw', 'se', 'sw'] as const;
const PHASES = Array.from({ length: 8 }, (_, i) => i / 8);
const FIGURES = (['male', 'female'] as const).flatMap((figure) =>
  (['hat', 'glasses'] as const).map((accessory) => ({ ...DEFAULT_RESIDENT, figure, accessory })),
);
const ORIGIN = { x: 0, y: 0 };
const HERON_POSES = [
  'stand',
  'preen',
  'walk',
  'stalk',
  'freeze',
  'strike',
  'swallow',
  'sleep',
] as const;
/** The recorded extents of everything that moves on and around the pond. */
const SPRITES = {
  // A walker on their way to an event never stops to greet anyone (simulation.ts), so no
  // greeting bubble: the figure itself.
  walker: once(() =>
    extentOf(
      FIGURES.flatMap((resident) =>
        FACINGS.flatMap((facing) =>
          PHASES.map((walkPhase): Sample => [
            ORIGIN,
            (ctx) =>
              drawResident(ctx, resident, 0, 0, 1.25, {
                moving: true,
                facing,
                walkPhase,
                greeting: false,
              }),
          ]),
        ),
      ),
    ),
  ),
  skater: once(() =>
    extentOf(
      FIGURES.flatMap((resident) =>
        FACINGS.flatMap((facing) =>
          PHASES.map((walkPhase): Sample => [
            ORIGIN,
            (ctx) =>
              drawResident(ctx, resident, 0, 0, 1.25, {
                moving: false,
                facing,
                walkPhase,
                greeting: false,
                pose: 'skate',
              }),
          ]),
        ),
      ),
    ),
  ),
  heron: once(() => {
    const position = { x: 21, y: 35.8 };
    const extras = [{}, { fish: true }, { look: 0.8 }, { look: -0.8 }, { wade: 1, wading: true }];
    return extentOf(
      HERON_POSES.flatMap((pose) =>
        [false, true].flatMap((left) =>
          [0, 0.15, 0.3, 0.6, 1].flatMap((progress) =>
            extras.map((extra): Sample => [
              project(position.x, position.y),
              (ctx) =>
                drawHeron(
                  ctx,
                  {
                    position,
                    left,
                    pose,
                    progress,
                    stride: progress,
                    fish: false,
                    wading: false,
                    wade: 0,
                    look: 0,
                    opacity: 1,
                    ...extra,
                  },
                  false,
                ),
            ]),
          ),
        ),
      ),
    );
  }),
  boat: once(() => {
    const position = { x: 16.2, y: 33.1 };
    return extentOf(
      Array.from({ length: 16 }, (_, h) => (h / 16) * Math.PI * 2).flatMap((heading) =>
        PHASES.map((oar): Sample => {
          const boat: PondBoat = {
            id: 0,
            position,
            heading,
            state: 'out',
            oar,
            rower: true,
            opacity: 1,
            rowerOpacity: 1,
          };
          return [project(position.x, position.y), (ctx) => drawBoat(ctx, boat, false)];
        }),
      ),
    );
  }),
};

afterEach(() => vi.unstubAllGlobals());

describe('The Millpond keeps the football in view', () => {
  it('keeps every pixel under the north and west lines, and only the mill above 40 px left of the football frame', () => {
    const violations: string[] = [];
    for (const moment of MOMENTS) {
      const painted = paint(
        options(moment.day, moment.minutes, { selected: moment.minutes === 720 }),
      );
      for (const [layer, record] of [
        ['ground', painted.ground],
        ['surface', painted.surface],
        ['objects', painted.upright],
      ] as const) {
        expect(record.unknown, `${moment.name} ${layer}`).toEqual([]);
        for (const p of record.points)
          if (!belowNorthLine(p) || !belowWestLine(p))
            violations.push(
              `${moment.name} ${layer} ${p.call} at ${p.x.toFixed(1)},${p.y.toFixed(1)}`,
            );
      }
      for (const painted_ of painted.objects) {
        const height = heightOf(painted_);
        const right = Math.max(...painted_.points.map((p) => p.x));
        if (height > SIGHTLINE.frameHeight && right > SIGHTLINE.frameX)
          violations.push(
            `${moment.name} ${painted_.object.part} ${height.toFixed(1)} px tall reaches x ${right.toFixed(1)}`,
          );
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  }, 30_000);

  it('keeps the mill left of the football frame and clear of the west lamp', () => {
    const record = matrixContext();
    drawMill(record.ctx, false, dayOf(3, 12) - CALENDAR_EPOCH_DAY - 224);
    const xs = record.points.map((p) => p.x),
      ys = record.points.map((p) => p.y);
    expect(record.unknown).toEqual([]);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-900);
    expect(Math.max(...xs)).toBeLessThanOrEqual(-770);
    // The ridge stays at or under 88 px above the mill's front corner.
    const front = project(MILLPOND_MILL.right, MILLPOND_MILL.bottom);
    const back = project(MILLPOND_MILL.left, MILLPOND_MILL.top);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(back.y - MILLPOND_MILL.height - 1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(front.y + 1);
  });

  it('keeps the wheel, the sign, the posts and the reeds low', () => {
    const painted = paint(options(SUMMER, 720));
    const tallest = (part: MillpondPart) =>
      Math.max(0, ...painted.objects.filter((o) => o.object.part === part).map(heightOf));
    expect(tallest('wheel')).toBeLessThanOrEqual(40);
    expect(tallest('sign')).toBeLessThanOrEqual(28);
    expect(tallest('posts')).toBeLessThanOrEqual(8);
    for (const reed of MILLPOND_REEDS)
      for (const yearDay of [20, 45, 70, 100]) {
        const record = matrixContext();
        drawReeds(record.ctx, reed, false, yearDay);
        for (const p of record.points)
          expect(belowNorthLine(p) && belowWestLine(p), `${reed.x},${reed.y}`).toBe(true);
        // Each stalk is one 1-px rect standing on its own foot near the bed.
        for (const call of record.calls.filter((c) => c.name === 'fillRect' && c.args[2] === 1)) {
          const [x, top, , height] = call.args as number[];
          if (height < 3) continue;
          const foot = unproject(x, top + height);
          expect(height, `${reed.x},${reed.y}`).toBeLessThanOrEqual(reed.size);
          // Beside the north road, walkers' feet stay clear.
          expect(height, `${reed.x},${reed.y}`).toBeLessThanOrEqual(38 * (foot.y - 29.6) + 1e-9);
        }
      }
  });

  it('keeps the reed fireflies over the pond and under both lines', () => {
    expect(MILLPOND_SWARMS.length).toBeGreaterThanOrEqual(3);
    expect(MILLPOND_SWARMS.length).toBeLessThanOrEqual(5);
    const pond = new Set(MILLPOND_SWARMS.map((swarm) => swarm.point));
    let lit = 0;
    for (const minutes of [1260, 1320, 180]) {
      const record = matrixContext();
      drawFireflies(record.ctx, townSeasonAt(SUMMER, minutes), true, (point) =>
        pond.has(point),
      ).forEach((object) => object.paint());
      lit += record.points.length;
      for (const p of record.points)
        expect(belowNorthLine(p) && belowWestLine(p), `${minutes} ${p.x},${p.y}`).toBe(true);
    }
    expect(lit).toBeGreaterThan(0);
    for (const swarm of MILLPOND_SWARMS)
      for (const fly of swarm.flies) expect(insideGround(fly.ground, 0)).toBe(true);
  });

  it('lets nothing move behind the mill', () => {
    const mill = paint(options(SUMMER, 720)).objects.find((o) => o.object.part === 'mill')!;
    const hull = convexHull(mill.points);
    const movers: MillpondPart[] = ['heron', 'boats', 'fisher', 'skaters', 'fish'];
    const violations: string[] = [];
    for (const moment of MOMENTS) {
      const painted = paint(options(moment.day, moment.minutes));
      for (const { object, points } of painted.objects) {
        if (!movers.includes(object.part) || object.depth >= MILL_DEPTH) continue;
        if (points.some((p) => insideHull(p, hull)))
          violations.push(`${moment.name} ${object.part} at ${object.ground.x},${object.ground.y}`);
      }
      // Flat art the mill would cover: the moon in the water and the lamp columns.
      for (const p of painted.surface.points) {
        const colour = painted.surface.calls[p.index]?.fillStyle;
        if ((colour === MOON_WATER || colour === LAMP_WATER) && insideHull(p, hull, 1))
          violations.push(`${moment.name} ${String(colour)} at ${p.x},${p.y}`);
      }
    }
    // Skaters on every resident and scenery loop, and every seat's walk in and out along its
    // route, each with the sprite's real recorded extent.
    const skater = SPRITES.skater(),
      walker = SPRITES.walker();
    const boxAt = (at: Point, extent: Extent) => {
      const s = project(at.x, at.y);
      return [
        { x: s.x + extent.left, y: s.y - extent.up },
        { x: s.x + extent.right, y: s.y - extent.up },
        { x: s.x + extent.left, y: s.y },
        { x: s.x + extent.right, y: s.y },
      ];
    };
    for (const loop of [...SKATE_LOOPS, ...SCENERY_SKATE_LOOPS])
      for (let k = 0; k < 96; k++) {
        const a = (k / 96) * Math.PI * 2;
        const at = { x: loop.x + loop.rx * Math.cos(a), y: loop.y + loop.ry * Math.sin(a) };
        if (at.x + at.y >= MILL_DEPTH) continue;
        if (boxAt(at, skater).some((p) => insideHull(p, hull)))
          violations.push(
            `skate loop ${loop.x},${loop.y} at ${at.x.toFixed(2)},${at.y.toFixed(2)}`,
          );
      }
    let walked = 0;
    for (let seat = 0; seat < 6; seat++)
      for (const at of alongRoute(millpondRoute(seat))) {
        walked++;
        if (at.x + at.y >= MILL_DEPTH) continue;
        if (boxAt(at, walker).some((p) => insideHull(p, hull)))
          violations.push(`seat ${seat} walking at ${at.x.toFixed(2)},${at.y.toFixed(2)}`);
      }
    expect(walked).toBeGreaterThan(300);
    expect(violations.slice(0, 10)).toEqual([]);
  }, 30_000);

  it('keeps every moving sprite’s real extent under both lines wherever it goes', () => {
    // The lib's analytic sightline test assumes these extents; the painted sprites keep to them.
    const assumed = {
      heron: { half: 21, up: 32 },
      boat: { half: 40, up: 30 },
      skater: { half: 16, up: 33 },
      walker: { half: 9, up: 33 },
    };
    for (const [name, limit] of Object.entries(assumed)) {
      const extent = SPRITES[name as keyof typeof SPRITES]();
      expect(extent.half, name).toBeLessThanOrEqual(limit.half);
      expect(extent.up, name).toBeLessThanOrEqual(limit.up);
    }
    const violations: string[] = [];
    const check = (name: keyof typeof SPRITES, at: Point) => {
      const extent = SPRITES[name]();
      if (sightlineLimit(at, extent.half) < extent.up)
        violations.push(`${name} at ${at.x.toFixed(2)},${at.y.toFixed(2)}`);
    };
    let herons = 0;
    for (const day of [dayOf(0, 19), SUMMER, dayOf(2, 7), dayOf(3, 6), dayOf(3, 21)])
      for (let minutes = 0; minutes < 1440; minutes += 1) {
        const heron = heronAt(minutes, day);
        if (heron) {
          herons++;
          check('heron', heron.position);
        }
        for (const boat of boatsAt(minutes, day)) check('boat', boat.position);
      }
    expect(herons).toBeGreaterThan(5000);
    for (const at of [...BOAT_MOORINGS, ...BOAT_STORE]) check('boat', at);
    for (const loop of [...SKATE_LOOPS, ...SCENERY_SKATE_LOOPS])
      for (let k = 0; k < 96; k++) {
        const a = (k / 96) * Math.PI * 2;
        check('skater', { x: loop.x + loop.rx * Math.cos(a), y: loop.y + loop.ry * Math.sin(a) });
      }
    for (let seat = 0; seat < 6; seat++)
      for (const at of alongRoute(millpondRoute(seat))) check('walker', at);
    expect(violations.slice(0, 10)).toEqual([]);
  }, 30_000);

  it('keeps the whole pond under the north line at 1920×1080 too, the mill in the corner', () => {
    // City.tsx's footballCamera, restated. Rule 3 is a 1440×900 guarantee; a wider screen shows
    // more of the west bank, so here what matters is that nothing crosses the north line and
    // that the mill, the one tall thing, sits in the frame's lower-left corner.
    const width = 1920,
      height = 1080;
    const centre = project(FOOTBALL_CENTER.x, FOOTBALL_CENTER.y);
    const zoom = Math.max(0.25, Math.min(1.45, (width - 400) / 735, (height - 150) / 445));
    const camera = { x: (width - 370) / 2 - centre.x * zoom, y: height * 0.52 - centre.y * zoom };
    const view = {
      left: -camera.x / zoom,
      right: (width - camera.x) / zoom,
      top: -camera.y / zoom,
      bottom: (height - camera.y) / zoom,
    };
    const inView = (p: Point) =>
      p.x >= view.left && p.x <= view.right && p.y >= view.top && p.y <= view.bottom;
    const football = (point: Point, rx: number, above: number, below: number) =>
      point.x + rx >= view.left &&
      point.x - rx <= view.right &&
      point.y + below >= view.top &&
      point.y - above <= view.bottom;
    const violations: string[] = [];
    let seen = 0,
      mill = 0;
    for (const moment of MOMENTS) {
      const painted = paint(options(moment.day, moment.minutes, { visible: football }));
      for (const record of [painted.ground, painted.surface, painted.upright])
        for (const p of record.points) {
          if (!inView(p)) continue;
          seen++;
          if (!belowNorthLine(p) || !belowWestLine(p))
            violations.push(`${moment.name} ${p.call} at ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
        }
      for (const object of painted.objects) {
        const shown = object.points.filter(inView);
        if (!shown.length || heightOf(object) <= SIGHTLINE.frameHeight) continue;
        if (object.object.part !== 'mill') violations.push(`${moment.name} ${object.object.part}`);
        for (const p of shown) {
          mill++;
          const screen = { x: p.x * zoom + camera.x, y: p.y * zoom + camera.y };
          if (screen.x > width * 0.15 || screen.y < height * 0.55)
            violations.push(`${moment.name} mill at ${screen.x.toFixed(0)},${screen.y.toFixed(0)}`);
        }
      }
    }
    expect(seen).toBeGreaterThan(1000);
    expect(mill).toBeGreaterThan(0);
    expect(violations.slice(0, 10)).toEqual([]);
  }, 30_000);
});

describe('The Millpond stays on its own ground', () => {
  it('paints its flat layers inside the site, the gate lane reaching the south road', () => {
    const violations: string[] = [];
    for (const moment of MOMENTS) {
      const painted = paint(options(moment.day, moment.minutes));
      for (const [layer, record] of [
        ['ground', painted.ground],
        ['surface', painted.surface],
      ] as const)
        for (const p of record.points)
          if (!insideGround(p))
            violations.push(
              `${moment.name} ${layer} ${p.call} at ${p.x.toFixed(1)},${p.y.toFixed(1)}`,
            );
    }
    expect(violations.slice(0, 10)).toEqual([]);
  }, 30_000);

  it('outlines the whole site when selected, like the zoo', () => {
    const plain = paint(options(SUMMER, 720)).surface.calls.length;
    const record = recordingContext();
    const state = millpondSurfaceState(options(SUMMER, 720, { selected: true }));
    MILLPOND_SURFACE_PARTS.selection(record.ctx, state);
    expect(record.calls.length).toBeGreaterThan(0);
    expect(record.calls.length).toBeLessThanOrEqual(8);
    expect(paint(options(SUMMER, 720, { selected: true })).surface.calls.length).toBe(
      plain + record.calls.length,
    );
  });
});

describe('The Millpond’s call budget', () => {
  const GROUND_CAPS: Record<(typeof GROUND_ORDER)[number], number> = {
    bank: 120,
    water: 100,
    lilies: 120,
    ice: 120,
    snow: 60,
    jetty: 40,
  };
  const SURFACE_CAPS: Record<(typeof SURFACE_ORDER)[number], number> = {
    glints: 40,
    moon: 60,
    lamps: 30,
    lanterns: 24,
    petals: 28,
    leaves: 40,
    fish: 40,
    wakes: 24,
    secret: 60,
    mist: 80,
    selection: 8,
  };
  const OBJECT_CAPS: Record<string, [parts: MillpondPart[], cap: number]> = {
    reeds: [['reeds'], 200],
    posts: [['posts'], 16],
    boats: [['boats'], 160],
    fisher: [['fisher'], 60],
    heron: [['heron'], 70],
    fish: [['fish'], 20],
    skaters: [['skaters'], 90],
    'mill, wheel and sign': [['mill', 'wheel', 'sign'], 300],
  };

  it.each(GROUND_ORDER)('keeps the ground’s %s within its cap', (part) => {
    let most = 0;
    for (const { day } of STAGES)
      for (const night of [false, true]) {
        const palette = night ? NIGHT : DAY;
        const state = millpondGroundState(
          night,
          townSeasonAt(day, night ? 1320 : 720),
          palette.water,
          palette.waterLight,
        );
        const record = recordingContext();
        MILLPOND_GROUND_PARTS[part](record.ctx, state);
        most = Math.max(most, record.calls.length);
      }
    expect(most).toBeLessThanOrEqual(GROUND_CAPS[part]);
  });

  it.each(SURFACE_ORDER)('keeps the surface’s %s within its cap', (part) => {
    let most = 0;
    for (const moment of MOMENTS)
      for (const total of [24, 7, 0, 60]) {
        const state = millpondSurfaceState(
          options(moment.day, moment.minutes, { total, selected: true }),
        );
        const record = recordingContext();
        MILLPOND_SURFACE_PARTS[part](record.ctx, state);
        most = Math.max(most, record.calls.length);
      }
    expect(most).toBeLessThanOrEqual(SURFACE_CAPS[part]);
  });

  it.each(Object.keys(OBJECT_CAPS))('keeps the %s within its cap', (name) => {
    const [parts, cap] = OBJECT_CAPS[name];
    let most = 0;
    for (const moment of MOMENTS) {
      const painted = paint(options(moment.day, moment.minutes));
      const calls = painted.objects
        .filter((o) => parts.includes(o.object.part))
        .reduce((sum, o) => sum + o.calls.length, 0);
      most = Math.max(most, calls);
    }
    expect(most).toBeLessThanOrEqual(cap);
  });

  const pondCalls = (day: number, minutes: number) => {
    const painted = paint(options(day, minutes, { visible: opening }));
    return (
      painted.ground.calls.length + painted.surface.calls.length + painted.upright.calls.length
    );
  };
  const pondFireflyCalls = (day: number, minutes: number) => {
    const pond = new Set(MILLPOND_SWARMS.map((swarm) => swarm.point));
    const record = recordingContext();
    drawFireflies(record.ctx, townSeasonAt(day, minutes), isNight(minutes), (point, ...rest) =>
      pond.has(point) ? opening(point, ...rest) : false,
    ).forEach((object) => object.paint());
    return record.calls.length;
  };

  it('stays within 2,200 calls in the opening view at every sampled moment', () => {
    let most = 0;
    for (const moment of MOMENTS) most = Math.max(most, pondCalls(moment.day, moment.minutes));
    expect(most).toBeGreaterThan(300);
    expect(most).toBeLessThanOrEqual(2_200);
  });

  it.each(STAGES.filter(({ day }) => day !== SUMMER))(
    '$name swings at most -450..+350 calls from the same date in summer',
    ({ day }) => {
      const summer = dayOf(1, dateOf(day));
      for (const minutes of MINUTES) {
        const swing = pondCalls(day, minutes) - pondCalls(summer, minutes);
        expect(swing, `${minutes}`).toBeGreaterThanOrEqual(-450);
        expect(swing, `${minutes}`).toBeLessThanOrEqual(350);
        if (!isNight(minutes)) continue;
        const flies = pondFireflyCalls(day, minutes) - pondFireflyCalls(summer, minutes);
        expect(swing + flies, `${minutes} with the reed fireflies`).toBeGreaterThanOrEqual(-550);
      }
    },
  );
});

describe('The Millpond’s cached ground', () => {
  it.each(STAGES)(
    '$name paints the same ground all day, from night and the day alone',
    ({ day }) => {
      const groundAt = (minutes: number, season = townSeasonAt(day, minutes)) => {
        const record = recordingContext();
        const night = isNight(minutes),
          palette = night ? NIGHT : DAY;
        drawMillpondGround(record.ctx, night, season, palette.water, palette.waterLight);
        expect(record.ctx.globalAlpha).toBe(1);
        expect(record.ctx.globalCompositeOperation).toBe('source-over');
        return trace(record.calls);
      };
      expect(groundAt(380)).toEqual(groundAt(1190));
      expect(groundAt(5)).toEqual(groundAt(1435));
      // A season that answers only the whole day and the season index.
      const strict = new Proxy(townSeasonAt(day, 720), {
        get(target, key) {
          if (key !== 'groundDay' && key !== 'index')
            throw new Error(`the ground read season.${String(key)}`);
          return target[key as keyof typeof target];
        },
      });
      expect(groundAt(720, strict)).toEqual(groundAt(720));
    },
  );

  it('draws a plain summer pond without a season', () => {
    const record = recordingContext();
    drawMillpondGround(record.ctx, false, undefined, DAY.water, DAY.waterLight);
    expect(record.calls.length).toBeGreaterThan(50);
    expect(record.ctx.globalAlpha).toBe(1);
  });
});

describe('The Millpond is deterministic', () => {
  it('paints the same three layers twice for the same moment', () => {
    for (const moment of MOMENTS.filter((m) => [375, 1165, 1320, 200].includes(m.minutes))) {
      const a = paint(options(moment.day, moment.minutes)),
        b = paint(options(moment.day, moment.minutes));
      for (const layer of ['ground', 'surface', 'upright'] as const)
        expect(trace(b[layer].calls), `${moment.name} ${layer}`).toEqual(trace(a[layer].calls));
    }
  });

  it('never reads the clock, randomness or storage, and never paints a glow', () => {
    const source = readFileSync('src/city/millpond.ts', 'utf8');
    expect(source).not.toMatch(/\bDate\b|Math\.random|localStorage|sessionStorage/);
    expect(source).not.toMatch(/drawGlow/);
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => recordingContext().ctx }),
    });
    const painted = paint(options(SUMMER, 1320));
    for (const record of [painted.ground, painted.surface, painted.upright])
      expect(record.calls.filter((call) => call.name === 'drawImage')).toEqual([]);
  });
});

describe('The Millpond’s light', () => {
  const AMBER = new Set<string>([
    LIGHT.lit,
    LIGHT.core,
    LAMP_WATER,
    '#F1D68F',
    '#F4D99B',
    '#FFE2A016',
    '#FFE9B9',
    '#E0B768',
  ]);
  /** A bright warm colour: what the eye reads as lamplight. */
  const amberLike = (colour: string) => {
    if (!/^#[0-9A-F]{6}$/i.test(colour)) return false;
    const n = parseInt(colour.slice(1), 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
    return r >= 0xe0 && g >= 0xb0 && g <= 0xea && b <= 0xb8 && r - b >= 0x40;
  };
  /** Every bar of every water lamp lit at that minute. */
  const litBars = (minutes: number) =>
    WATER_LAMPS.reduce(
      (bars, lamp, i) =>
        isNight(minutes) &&
        lampOn(lamp.distance, minutes) &&
        !lampBlocksGoal(lamp.x + 0.5, lamp.y + 0.5)
          ? bars + lampColumns()[i].length
          : bars,
      0,
    );

  it('shows amber only for light lit at that instant', () => {
    const violations: string[] = [];
    for (const moment of MOMENTS)
      for (const total of [24, 7]) {
        const opts = options(moment.day, moment.minutes, { total });
        const painted = paint(opts);
        const colours = [painted.ground, painted.surface, painted.upright].flatMap((record) =>
          fills(record.calls),
        );
        const iced = iceOn(opts.season.groundDay).stage !== 'open';
        const count = (colour: string) => colours.filter((c) => c === colour).length;
        const where = `${moment.name} total ${total}`;
        if (count(LAMP_WATER) !== litBars(moment.minutes))
          violations.push(`${where}: ${count(LAMP_WATER)} lamp bars`);
        if (count(LIGHT.lit) !== (iced ? 0 : Math.min(opts.litCount, total, 24)))
          violations.push(`${where}: ${count(LIGHT.lit)} lantern glints`);
        for (const pin of ['#FFE2A016', '#FFE9B9'])
          if (count(pin) && !opts.night) violations.push(`${where}: the sign's ${pin} by day`);
        for (const colour of new Set(colours)) {
          const allowed = [LAMP_WATER, LIGHT.lit, '#FFE2A016', '#FFE9B9'].includes(colour);
          if ((AMBER.has(colour) || amberLike(colour)) && !allowed)
            violations.push(`${where}: ${colour}`);
          if (!opts.night && (AMBER.has(colour) || amberLike(colour)))
            violations.push(`${where}: ${colour} by day`);
        }
      }
    expect(violations.slice(0, 10)).toEqual([]);
  }, 30_000);

  it('glimmers one glint per lit lantern across the lantern hour, and none on ice', () => {
    for (const day of [SUMMER, dayOf(3, 11), dayOf(3, 6)])
      for (const total of [24, 7, 0, 60])
        for (let minutes = 1195; minutes <= 1240; minutes += 0.25) {
          const opts = options(day, minutes, { total });
          const record = recordingContext();
          MILLPOND_SURFACE_PARTS.lanterns(record.ctx, millpondSurfaceState(opts));
          const glints = record.calls.filter(
            (call) => call.name === 'fillRect' && call.fillStyle === LIGHT.lit,
          ).length;
          const iced = iceOn(opts.season.groundDay).stage !== 'open';
          expect(glints, `${day} ${total} ${minutes}`).toBe(
            iced ? 0 : Math.min(opts.litCount, total, 24),
          );
        }
  });

  it('scatters the glimmers over the far water as they light, clear of the north lamp’s column', () => {
    const painted = paint(options(SUMMER, 1320, { total: 60 }));
    const glints = painted.surface.calls
      .filter((call) => call.name === 'fillRect' && call.fillStyle === LIGHT.lit)
      .map((call) => ({ x: Number(call.args[0]) + 1, y: Number(call.args[1]) + 0.5 }));
    expect(glints).toHaveLength(24);
    for (const [i, glint] of glints.entries()) {
      // A 2x1 fleck on still water, out from the far shore and apart from every other.
      const call = painted.surface.calls.filter((c) => c.fillStyle === LIGHT.lit)[i];
      expect(call.args.slice(2)).toEqual([2, 1]);
      const tile = unproject(glint.x, glint.y);
      expect(tile.x < 17.8 || tile.x > 18.8).toBe(true);
      expect(shoreDistance(tile)).toBeGreaterThanOrEqual(0.25);
      for (const other of glints.slice(i + 1))
        expect(Math.hypot(glint.x - other.x, glint.y - other.y)).toBeGreaterThanOrEqual(4);
    }
    // They light here and there, not in a sweep along the bank: the first eight are not in
    // order from west to east.
    const first = glints.slice(0, 8).map((g) => g.x);
    expect(first).not.toEqual([...first].sort((a, b) => a - b));
  });

  it('hangs each lamp’s light as 1-px bars below it, fading, and never over the shallows', () => {
    for (const [i, lamp] of WATER_LAMPS.entries()) {
      const foot = project(lamp.x + 0.5, lamp.y + 0.5);
      const bars = lampColumns()[i];
      expect(bars.length, `${lamp.x},${lamp.y}`).toBeGreaterThanOrEqual(5);
      expect(bars.length).toBeLessThanOrEqual(9);
      for (const [k, bar] of bars.entries()) {
        expect(bar.y).toBeGreaterThanOrEqual(foot.y + 34);
        if (k) expect(bar.y - bars[k - 1].y).toBe(2);
        if (k) expect(bar.alpha).toBeLessThan(bars[k - 1].alpha);
        expect(shoreDistance(unproject(bar.x + bar.w / 2, bar.y))).toBeGreaterThanOrEqual(0.1);
      }
    }
    // At 22:00 on open water every bar is a 1-px row.
    const painted = paint(options(SUMMER, 1320));
    const rows = painted.surface.calls.filter((call) => call.fillStyle === LAMP_WATER);
    expect(rows.length).toBe(litBars(1320));
    for (const row of rows) expect(row.args[3]).toBe(1);
  });

  it('shows the moon in the water as 1-px slices of light with dark water between', () => {
    let seen = 0;
    for (const day of [SUMMER, dayOf(1, 20), dayOf(2, 7)])
      for (const minutes of [1260, 1320, 1380, 60, 180]) {
        const record = recordingContext();
        MILLPOND_SURFACE_PARTS.moon(record.ctx, millpondSurfaceState(options(day, minutes)));
        const rows = record.calls.filter((call) => call.fillStyle === MOON_WATER);
        // No disc under the slices: every call is a 1-px row, and no two rows touch.
        for (const call of record.calls) expect(call.name).not.toBe('fill');
        const ys = new Set<number>();
        for (const row of rows) {
          expect(row.name).toBe('fillRect');
          expect(row.args[3]).toBe(1);
          ys.add(Number(row.args[1]));
        }
        for (const y of ys) expect(ys.has(y + 1)).toBe(false);
        seen += rows.length;
      }
    expect(seen).toBeGreaterThan(0);
  });

  it('puts the moon in the water only while the moon is up, and the secret’s glint only in its window', () => {
    for (const moment of MOMENTS) {
      const painted = paint(options(moment.day, moment.minutes));
      const colours = new Set(fills(painted.surface.calls));
      const minute = ((moment.minutes % 1440) + 1440) % 1440;
      if (colours.has(MOON_WATER)) expect(isNight(minute), moment.name).toBe(true);
      const secret = iceSecretAt(moment.minutes, moment.day);
      if (colours.has(SECRET_GLINT)) expect(secret, moment.name).not.toBeNull();
      if (secret && secret.glint > 0 && secret.opacity > 0)
        expect(colours.has(SECRET_GLINT), moment.name).toBe(true);
    }
    // The secret's lure lies two tiles and more from the moon's path while it glints.
    for (const day of [dayOf(3, 14), WINTER_15, dayOf(3, 16)])
      for (let minutes = 180; minutes < 270; minutes += 2) {
        const moon = moonReflectionAt(minutes, day);
        if (!moon) continue;
        expect(
          Math.hypot(moon.tile.x - SECRET_LURE.x, moon.tile.y - SECRET_LURE.y),
        ).toBeGreaterThanOrEqual(2);
      }
  });

  it('keeps the mist its own colour, and the ice and blossom to their seasons', () => {
    const reserved = new Set([
      ...both(SNOW.top, SNOW.shade, SNOW.frost, SNOW.ice, SNOW.flake),
      ...both(ICE.sheet, ICE.crack, ICE.crackLight),
      SECRET_GLINT,
      MOON_WATER,
      ...both(POND.glint, POND.ring),
    ]);
    for (const colour of POND.mist) expect(reserved.has(colour)).toBe(false);
    const ice = new Set(both(ICE.sheet, ICE.crack, ICE.crackLight));
    const blossom = new Set(both(BLOSSOM.pink, BLOSSOM.white, BLOSSOM.deep));
    const leaves = new Set(both(...FALLEN_LEAVES));
    for (const moment of MOMENTS) {
      const opts = options(moment.day, moment.minutes);
      const painted = paint(opts);
      const colours = new Set(
        [painted.ground, painted.surface, painted.upright].flatMap((r) => fills(r.calls)),
      );
      const d = opts.season.yearDay;
      if ([...colours].some((c) => ice.has(c))) expect(opts.season.index, moment.name).toBe(3);
      if ([...colours].some((c) => blossom.has(c))) expect(d, moment.name).toBeLessThan(30);
      if ([...colours].some((c) => leaves.has(c)))
        expect(d, moment.name).toBeGreaterThanOrEqual(56);
      if (mistAt(moment.minutes, moment.day) > 0)
        expect(colours.has(POND.mist[opts.night ? 1 : 0]), moment.name).toBe(true);
    }
  }, 30_000);
});

describe('Picking the Millpond on the map', () => {
  const H4 = { kind: 'place', id: MILLPOND_VENUE.plot };
  const stroller = (id: string, position: Point) =>
    ({
      id,
      resident: DEFAULT_RESIDENT,
      position,
      activity: 'stroll',
      moving: true,
      facing: 'se',
      walkPhase: 0,
      greeting: false,
    }) as unknown as ResidentState;

  it('selects the pond across the water, the former roads and the mill', () => {
    for (const tile of [
      { x: 13.5, y: 33.5 },
      { x: 17.5, y: 30.5 },
      { x: 24, y: 36 },
      { x: 17, y: 33.2 },
    ])
      expect(cityHit(project(tile.x, tile.y), [], []), `${tile.x},${tile.y}`).toEqual(H4);
    const roof = project(13.9, 35.8);
    expect(cityHit({ x: roof.x, y: roof.y - 70 }, [], [])).toEqual(H4);
  });

  it('selects the pond from its gate sign', () => {
    const sign = project(MILLPOND_SIGN.x, MILLPOND_SIGN.y);
    const plaque = { x: sign.x + 20, y: sign.y + 10 - 22 };
    expect(millpondSignHit(plaque)).toBe(true);
    expect(millpondSignHit({ x: sign.x, y: sign.y + 5 })).toBe(false);
    expect(cityHit(plaque, [], [])).toEqual(H4);
  });

  it('lets a roof in front keep its own clicks', () => {
    const [first] = placeSchema
      .array()
      .parse([JSON.parse(readFileSync('places/after-hours.json', 'utf8'))]);
    let checked = 0;
    for (const id of ['J3', 'J4', 'J5', 'J6']) {
      const house = { ...first, plot: id, design: { ...first.design, floors: 3 as const } };
      const centre = plotCenter(getPlot(id)!);
      const top = { x: centre.x, y: centre.y - houseBounds(house).top * 1.12 + 8 };
      const tile = unproject(top.x, top.y);
      if (tile.x < G.left || tile.x >= G.right || tile.y < G.top || tile.y >= G.bottom) continue;
      expect(cityHit(top, [house], []), id).toEqual({ kind: 'place', id });
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('lets strollers on the banks’ roads keep their clicks', () => {
    for (const position of [
      { x: 20, y: 37.5 },
      { x: 17, y: 37.5 },
      { x: 15.5, y: 29.5 },
    ]) {
      const s = project(position.x, position.y);
      const body = { x: s.x, y: s.y - 12 };
      expect(
        cityHit(body, [], [stroller('walker', position)]),
        `${position.x},${position.y}`,
      ).toEqual({
        kind: 'resident',
        id: 'walker',
      });
    }
  });

  it('lets strollers in front of the gate sign keep the click, and hidden ones never steal it', () => {
    const walker = { kind: 'resident', id: 'walker' };
    // In front: walkers anywhere across the south road's width, wherever they overlap it.
    let front = 0;
    for (let x = MILLPOND_SIGN.x - 2; x <= MILLPOND_SIGN.x + 2; x += 0.1)
      for (const y of [37.02, 37.1, 37.25, 37.5, 37.75]) {
        const s = project(x, y);
        for (let dy = -27; dy < 5; dy++)
          for (const dx of [-8, -4, 0, 4, 8]) {
            const point = { x: s.x + dx, y: s.y + dy };
            if (!millpondSignHit(point)) continue;
            expect(cityHit(point, [], [stroller('walker', { x, y })]), `${x},${y}`).toEqual(walker);
            expect(cityHit(point, [], [])).toEqual(H4);
            front++;
          }
      }
    expect(front).toBeGreaterThan(20);
    // Behind: a skater walking up the easternmost column is painted under the plaque, so the
    // plaque keeps the click wherever it covers them.
    let behind = 0;
    for (let seat = 0; seat < 6; seat++)
      for (const at of alongRoute(millpondRoute(seat))) {
        const s = project(at.x, at.y);
        for (let dy = -27; dy < 5; dy++)
          for (const dx of [-8, -4, 0, 4, 8]) {
            const point = { x: s.x + dx, y: s.y + dy };
            if (!millpondSignHit(point)) continue;
            expect(at.x + at.y).toBeLessThan(MILLPOND_SIGN_DEPTH);
            expect(cityHit(point, [], [stroller('walker', at)]), `${at.x},${at.y}`).toEqual(H4);
            behind++;
          }
      }
    expect(behind).toBeGreaterThan(0);
  });

  it('paints the gate sign over what stands behind it and under what stands in front', () => {
    const sign = paint(options(SUMMER, 720)).objects.find((o) => o.object.part === 'sign')!;
    const hull = convexHull(sign.points);
    // Whether a sprite standing at `at` overlaps the painted sign on screen.
    const overlaps = (at: Point, extent: Extent) => {
      const s = project(at.x, at.y);
      for (let x = Math.floor(extent.left); x <= extent.right; x += 1)
        for (let y = -Math.ceil(extent.up); y <= 0; y += 1)
          if (insideHull({ x: s.x + x, y: s.y + y }, hull, 0)) return true;
      return false;
    };
    const walker = SPRITES.walker(),
      heron = SPRITES.heron();
    const wrong: string[] = [];
    let infront = 0,
      behind = 0;
    for (let x = MILLPOND_SIGN.x - 2.5; x <= MILLPOND_SIGN.x + 2.5; x += 0.05)
      for (const y of [37.02, 37.25, 37.5, 37.75])
        if (overlaps({ x, y }, walker)) {
          infront++;
          if (x + y <= MILLPOND_SIGN_DEPTH) wrong.push(`road ${x.toFixed(2)},${y}`);
        }
    for (let seat = 0; seat < 6; seat++)
      for (const at of alongRoute(millpondRoute(seat)))
        if (overlaps(at, walker)) {
          behind++;
          if (at.x + at.y >= MILLPOND_SIGN_DEPTH) wrong.push(`seat ${seat} ${at.x},${at.y}`);
        }
    // The heron never reaches it, at its spots, its roost or on its walks between them.
    for (const day of [dayOf(0, 19), SUMMER, dayOf(2, 7), dayOf(3, 6), dayOf(3, 21)])
      for (let minutes = 0; minutes < 1440; minutes += 2) {
        const bird = heronAt(minutes, day);
        if (bird && overlaps(bird.position, heron))
          wrong.push(`heron ${bird.position.x.toFixed(2)},${bird.position.y.toFixed(2)}`);
      }
    expect(infront).toBeGreaterThan(0);
    expect(behind).toBeLessThan(40);
    expect(wrong.slice(0, 10)).toEqual([]);
    // Small and low: 28 px at most above its footprint.
    expect(heightOf(sign)).toBeLessThanOrEqual(28);
  });
});

describe('The Millpond draws what the model says', () => {
  // Year 3's whole days: the ground's day of the year is the offset from Spring 1.
  const dayOfYear = (groundDay: number) => dayOf(0, 1) + groundDay;

  it('floats exactly the model’s lily pads and flowers, every day of the year', () => {
    let pads = 0;
    for (let groundDay = 0; groundDay < 112; groundDay++) {
      const season = townSeasonAt(dayOfYear(groundDay), 720);
      expect(season.groundDay).toBe(groundDay);
      const record = recordingContext();
      MILLPOND_GROUND_PARTS.lilies(
        record.ctx,
        millpondGroundState(false, season, DAY.water, DAY.waterLight),
      );
      const count = (colour: string) => record.calls.filter((c) => c.fillStyle === colour).length;
      expect(count(POND.lily[0]), `${groundDay}`).toBe(lilyPadsOn(groundDay).length);
      expect(count(POND.lilyFlower[0]), `${groundDay}`).toBe(lilyFlowersOn(groundDay).length);
      pads += count(POND.lily[0]);
    }
    expect(pads).toBeGreaterThan(100);
  });

  it('floats exactly the model’s petals and leaves', () => {
    const petalColours = new Set(both(BLOSSOM.pink, BLOSSOM.white));
    const leafColours = new Set(both(...FALLEN_LEAVES));
    let petals = 0,
      leaves = 0;
    for (const [from, to] of [
      [12, 30],
      [66, 88],
    ])
      for (let groundDay = from; groundDay < to; groundDay++)
        for (const minutes of [0, 300, 720, 1100]) {
          const state = millpondSurfaceState(options(dayOfYear(groundDay), minutes));
          const d = state.season.yearDay;
          for (const [part, colours, expected] of [
            ['petals', petalColours, petalCountAt(d)],
            ['leaves', leafColours, leafCountAt(d)],
          ] as const) {
            const record = recordingContext();
            MILLPOND_SURFACE_PARTS[part](record.ctx, state);
            const drawn = record.calls.filter((c) => colours.has(String(c.fillStyle))).length / 2;
            expect(drawn, `${part} ${d.toFixed(2)}`).toBe(expected);
            if (part === 'petals') petals = Math.max(petals, drawn);
            else leaves = Math.max(leaves, drawn);
          }
        }
    expect(petals).toBe(14);
    expect(leaves).toBe(MILLPOND_LEAVES.length);
  });

  it('drops a leaping fish into its own landing ring', () => {
    let seen = 0;
    for (let minutes = 1080; minutes < 1290 && seen < 3; minutes += 0.05) {
      const state = millpondSurfaceState(options(SUMMER, minutes));
      const rise = state.scene.rises.find((r) => r.leap && r.progress > 0.34 && r.progress < 0.5);
      if (!rise) continue;
      const record = recordingContext();
      MILLPOND_SURFACE_PARTS.fish(record.ctx, state);
      const landing = project(rise.landing.x, rise.landing.y);
      const rings = record.calls.filter(
        (c) =>
          c.name === 'ellipse' &&
          Math.abs(Number(c.args[0]) - landing.x) < 1e-6 &&
          Math.abs(Number(c.args[1]) - landing.y) < 1e-6,
      );
      expect(rings.length, `${minutes}`).toBe(1);
      seen++;
      minutes += 2;
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('The Millpond’s sprites', () => {
  const heron = (extra: Partial<Heron>): Heron => ({
    position: { x: 21, y: 35.8 },
    left: false,
    pose: 'stand',
    progress: 0.5,
    stride: 0.25,
    fish: false,
    wading: false,
    wade: 0,
    look: 0,
    opacity: 1,
    ...extra,
  });
  const POSES = [
    'stand',
    'preen',
    'walk',
    'stalk',
    'freeze',
    'strike',
    'swallow',
    'sleep',
  ] as const;

  it('draws a heron of at most 32 px in every pose, within 70 calls, bill never amber', () => {
    for (const pose of POSES)
      for (const left of [false, true])
        for (const progress of [0, 0.15, 0.3, 0.6, 1])
          for (const extra of [{}, { fish: true }, { look: 0.8 }, { look: -0.8 }]) {
            const record = matrixContext();
            const bird = heron({ pose, left, progress, ...extra });
            drawHeron(record.ctx, bird, false);
            drawHeron(record.ctx, { ...bird, wading: true }, true);
            expect(record.unknown).toEqual([]);
            const ground = project(bird.position.x, bird.position.y);
            const top = Math.min(...record.points.map((p) => p.y));
            expect(
              ground.y - top,
              `${pose} ${left} ${progress} ${JSON.stringify(extra)}`,
            ).toBeLessThanOrEqual(32);
            const calls = record.calls.length / 2;
            expect(calls, pose).toBeLessThanOrEqual(70);
            for (const colour of fills(record.calls))
              expect(colour, pose).not.toMatch(/^#(FFE0A0|F4D79A|FFF6D8|F1D68F)$/i);
          }
  });

  it('keeps two scenery skaters within 90 calls, blades and all', () => {
    const record = recordingContext();
    for (const id of [0, 1])
      drawSceneSkater(record.ctx, {
        id,
        position: { x: 22.6, y: 33.6 },
        facing: 'se',
        phase: 0.3,
        opacity: 1,
      });
    expect(record.calls.length).toBeLessThanOrEqual(90);
    expect(record.fills).toContain('#DCE4E2');
  });

  it('turns the wheel on open water and holds it still in the ice', () => {
    const at = (angle: number | null) => {
      const record = recordingContext();
      drawWheel(record.ctx, false, angle);
      return trace(record.calls);
    };
    expect(at(0.3)).not.toEqual(at(1.1));
    expect(at(null)).toEqual(at(null));
    expect(at(null)).not.toEqual(at(0.3));
  });

  it('leans a skating resident and gives them blades, leaving other poses alone', () => {
    const pose = (state: Parameters<typeof drawResident>[5]) => {
      const record = recordingContext();
      drawResident(record.ctx, DEFAULT_RESIDENT, 0, 0, 1.25, state);
      return record;
    };
    const skate = pose({
      moving: false,
      facing: 'se',
      walkPhase: 0.25,
      greeting: false,
      pose: 'skate',
    });
    expect(skate.calls.some((call) => call.name === 'transform')).toBe(true);
    expect(skate.fills).toContain('#DCE4E2');
    const walk = pose({ moving: true, facing: 'se', walkPhase: 0.25, greeting: false });
    expect(walk.calls.some((call) => call.name === 'transform')).toBe(false);
    expect(walk.fills).not.toContain('#DCE4E2');
  });
});
