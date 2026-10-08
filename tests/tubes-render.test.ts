import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { drawMeadow } from '../src/city/ambience';
import { lampOn, MAX_LAMP_DISTANCE, MIN_LAMP_DISTANCE } from '../src/city/lamplight';
import { housePainter } from '../src/city/house-sprites';
import { drawSproutStake } from '../src/city/lantern-post';
import { paintGroundLayer } from '../src/city/ground-cache';
import { renderCity } from '../src/city/render';
import { tint } from '../src/city/houses';
import { drawResident } from '../src/city/residents';
import {
  BLOSSOM,
  FALLEN_LEAVES,
  FIREFLY,
  FOLIAGE,
  ICE,
  POND,
  PUMPKIN,
  REED,
  SNOW,
} from '../src/city/season-palette';
import {
  TUBE_PALETTE,
  TUBE_PIECES,
  TUBE_TRUNK_POSTS,
  drawTubeGround,
  drawTubeTraffic,
  drawTubes,
  glassLod,
  tubeGlassEdges,
  tubeGlassRuns,
  tubeMarkArea,
  tubePainterFor,
  tubeStem,
  type TubeObject,
  type TubePainter,
  type TubeScene,
} from '../src/city/tubes';
import { FORK_PLOT } from '../src/lib/lanterns';
import { residentSchema } from '../src/lib/schema';
import { seedFraction, snowAt, townSeasonAt } from '../src/lib/seasons';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { tubeParcelsAt, tubeRides, type TubeParcelState } from '../src/lib/tube-traffic';
import { KINGFISHER_PIER } from '../src/lib/district-calendar';
import {
  TRUNK_ARCS,
  TUBE_ALIGHT,
  TUBE_ALIGHT_STEPS,
  TUBE_ALTITUDE,
  TUBE_BANK_X,
  TUBE_BOARD,
  TUBE_BOARD_STEPS,
  TUBE_SIGN_LINES,
  TUBE_SIGN_STATION,
  TUBE_STATIONS,
  TUBE_TRUNK_X,
  TUBE_TRUNK_Y,
  loopSpur,
  stationTap,
  trunkPoint,
  tubeAt,
  tubeLength,
  tubeRoute,
  tubeStation,
  type ResidentTransit,
} from '../src/lib/tubes';
import {
  WORLD_BOUNDS,
  WORLD_WIDTH,
  getPlot,
  plotCenter,
  project,
  unproject,
  type Point,
} from '../src/lib/world';
import { openingView } from '../src/lib/opening-view';
import { FROZEN_TOWN } from './district';
import { AFTER_HOURS, HELLO_WORLD } from './fixtures';
import { readPlaces } from './full-town';
import { matrixContext, type MatrixPoint } from './matrix-context';
import { recordingContext, type RecordedCall } from './recording-context';
import { rosterTimeout } from './roster-timeout';

// The meadow test spies on the ground paint; both mocks call straight through.
vi.mock('../src/city/ambience', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/city/ambience')>();
  return { ...actual, drawMeadow: vi.fn(actual.drawMeadow) };
});
vi.mock('../src/city/lantern-post', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/city/lantern-post')>();
  return { ...actual, drawSproutStake: vi.fn(actual.drawSproutStake) };
});
// The marks test reads the ground paint and the marks render.ts hands the ground cache.
vi.mock('../src/city/ground-cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/city/ground-cache')>();
  return { ...actual, paintGroundLayer: vi.fn(actual.paintGroundLayer) };
});

// The Treeline through the renderer's eyes: quiet in the opening view, within its call caps,
// low, with no snow on the glass and amber only in a lit lamp, the sign word for word, every
// rider drawn by exactly one painter and inside its glass, figures in a stack drawn once with no
// floating shadow, the depth order of docs/TUBES.md, glass built from every station, the meadow
// kept, and the same frame every time.

const places = readPlaces();
const C1 = tubeStation('C1'),
  N1 = tubeStation('N1');
// Year 3, so no sampled date touches the calendar's epoch.
const yearDay = (date: number) => CALENDAR_EPOCH_DAY + 224 + date;
const SUMMER = yearDay(42);
const WINTER = yearDay(98);
const isNight = (minutes: number) => minutes < 360 || minutes >= 1200;
const ROUTE = tubeRoute(C1.id, N1.id);
const LENGTH = tubeLength(C1.id, N1.id);

type Camera = { x: number; y: number; zoom: number };
type Visible = TubeScene['visible'];
const OPENING: Camera = { x: 720, y: 88, zoom: 0.7 };
/** The whole town at fit: 150 calls a station (docs/TUBES.md#performance). */
const WHOLE_CAP = 150 * 7;
const WHOLE: Camera = (() => {
  const zoom = Math.min(
    (1440 - 52) / (WORLD_BOUNDS.right - WORLD_BOUNDS.left + 36),
    (900 - 85) / (WORLD_BOUNDS.bottom + 98),
  );
  return {
    x: 720 - ((WORLD_BOUNDS.left + WORLD_BOUNDS.right) / 2) * zoom,
    y: (900 - WORLD_BOUNDS.bottom * zoom) / 2 + 28,
    zoom,
  };
})();
/** A close-up like the map's, `zoom` times around a plot. */
const closeUp = (plot: string, zoom = 3): Camera => {
  const c = plotCenter(getPlot(plot)!);
  return { x: 720 - c.x * zoom, y: 450 - (c.y - 30) * zoom, zoom };
};
/** render.ts's culling for a camera. */
function visibleFor(camera: Camera, width = 1440, height = 900): Visible {
  const view = {
    left: -camera.x / camera.zoom,
    right: (width - camera.x) / camera.zoom,
    top: -camera.y / camera.zoom,
    bottom: (height - camera.y) / camera.zoom,
  };
  return (point, rx, above, below) =>
    point.x + rx >= view.left &&
    point.x - rx <= view.right &&
    point.y + below >= view.top &&
    point.y - above <= view.bottom;
}
const everywhere: Visible = () => true;

function sceneOf(extra: Partial<TubeScene> = {}): TubeScene {
  const minutes = extra.minutes ?? 720,
    day = extra.day ?? SUMMER;
  return {
    minutes,
    day,
    night: isNight(minutes),
    season: townSeasonAt(day, minutes),
    zoom: 3,
    emphasis: 'none',
    station: null,
    visible: everywhere,
    residents: [],
    parcels: () => [],
    followed: null,
    ...extra,
  };
}
/** The real town at a moment, through a camera. */
function realScene(camera: Camera, minutes: number, day: number, extra: Partial<TubeScene> = {}) {
  return sceneOf({
    minutes,
    day,
    zoom: camera.zoom,
    visible: visibleFor(camera),
    residents: simulateResidents(places, minutes, day),
    parcels: () => tubeParcelsAt(places, minutes, day),
    ...extra,
  });
}

// ---------------------------------------------------------------------------------------------
// Synthetic neighbors in transit, independent of the planner's timing.

const base = simulateResidents([AFTER_HOURS], 402)[0];
const lerp = (a: Point, b: Point, k: number) => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
});
const riding = (from: string, to: string, s: number): ResidentTransit => ({
  stage: 'riding',
  from,
  to,
  progress: s / tubeLength(from, to),
  altitude: tubeAt(from, to, s).altitude,
  distance: s,
});
const boarding = (from: string, to: string, progress: number): ResidentTransit => ({
  stage: 'boarding',
  from,
  to,
  progress,
  altitude: 0,
  distance: 0,
});
const alighting = (from: string, to: string, progress: number): ResidentTransit => ({
  stage: 'alighting',
  from,
  to,
  progress,
  altitude: 0,
  distance: tubeLength(from, to),
});
function positionOf(transit: ResidentTransit): Point {
  if (transit.stage === 'riding')
    return tubeAt(transit.from, transit.to, transit.distance).position;
  if (transit.stage === 'boarding') {
    const st = tubeStation(transit.from);
    const t = transit.progress * TUBE_BOARD;
    return lerp(st.door, st.stack, Math.min(1, t / TUBE_BOARD_STEPS.walk));
  }
  const st = tubeStation(transit.to);
  const t = transit.progress * TUBE_ALIGHT,
    { settle } = TUBE_ALIGHT_STEPS;
  return lerp(st.stack, st.door, t < settle ? 0 : (t - settle) / (TUBE_ALIGHT - settle));
}
function person(
  id: string,
  outfit: string,
  transit: ResidentTransit,
  look: Partial<ResidentState['resident']> = {},
): ResidentState {
  const t = transit.progress * (transit.stage === 'boarding' ? TUBE_BOARD : TUBE_ALIGHT);
  const walking =
    transit.stage === 'boarding'
      ? t < TUBE_BOARD_STEPS.walk
      : transit.stage === 'alighting' && t >= TUBE_ALIGHT_STEPS.settle;
  return {
    ...base,
    id,
    resident: { ...base.resident, ...look, outfit },
    activity: 'stroll',
    position: positionOf(transit),
    moving: walking,
    facing: walking && transit.stage === 'boarding' ? 'ne' : 'sw',
    walkPhase: 0,
    greeting: false,
    event: { id: 'zoo', name: 'Zoo day', phase: 'going' },
    transit,
  };
}
const parcelAt = (
  stage: TubeParcelState['stage'],
  from: string,
  to: string,
  progress: number,
  s = 0,
): TubeParcelState => {
  const at = tubeAt(from, to, s);
  return {
    id: `parcel:test:${stage}:${s}`,
    from,
    to,
    depart: 700,
    arrive: 700 + tubeLength(from, to) / 10,
    stage,
    progress,
    position:
      stage === 'riding' ? at.position : { ...tubeStation(stage === 'sending' ? from : to).stack },
    altitude: stage === 'riding' ? at.altitude : 0,
    distance: stage === 'riding' ? s : stage === 'arrived' ? tubeLength(from, to) : 0,
  };
};

// ---------------------------------------------------------------------------------------------
// Painting, with every call's fill, alpha and font, and its world-pixel points.

type Logged = {
  name: string;
  args: unknown[];
  fill: string;
  stroke: string;
  alpha: number;
  font: string;
};
function tracked() {
  const matrix = matrixContext();
  const log: Logged[] = [];
  const target = matrix.ctx as unknown as Record<string, unknown>;
  const ctx = new Proxy(target, {
    get(object, key) {
      const value = object[key as string];
      if (typeof key !== 'string' || typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        log.push({
          name: key,
          args,
          fill: String(object.fillStyle),
          stroke: String(object.strokeStyle),
          alpha: Number(object.globalAlpha),
          font: String(object.font),
        });
        return (value as (...args: unknown[]) => unknown)(...args);
      };
    },
    set(object, key, value) {
      object[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ...matrix, ctx, log };
}
type Slice = { calls: RecordedCall[]; points: MatrixPoint[]; log: Logged[] };
type Painted = Slice & { object: TubeObject };
/** All three layers on one recorder: the ground, the traffic, then each object in depth order. */
function paint(scene: TubeScene) {
  const t = tracked();
  const mark = () => ({ calls: t.calls.length, points: t.points.length, log: t.log.length });
  const since = (m: ReturnType<typeof mark>): Slice => ({
    calls: t.calls.slice(m.calls),
    points: t.points.slice(m.points),
    log: t.log.slice(m.log),
  });
  let m = mark();
  drawTubeGround(t.ctx, scene);
  const ground = since(m);
  m = mark();
  drawTubeTraffic(t.ctx, scene);
  const traffic = since(m);
  const objects: Painted[] = drawTubes(t.ctx, scene)
    .sort((a, b) => a.depth - b.depth)
    .map((object) => {
      const m = mark();
      object.paint();
      return { object, ...since(m) };
    });
  return { ground, traffic, objects, total: t.calls.length, all: t.log, alpha: t.ctx.globalAlpha };
}
const parts = (painted: ReturnType<typeof paint>, part: TubeObject['part'], station?: string) =>
  painted.objects.filter(
    (o) => o.object.part === part && (station === undefined || o.object.station === station),
  );
const callsOf = (list: readonly Painted[]) => list.reduce((sum, o) => sum + o.calls.length, 0);
/** How far a point lies from a polyline. */
function offLine(p: Point, line: readonly Point[]) {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
}
const trace = (calls: readonly RecordedCall[]) =>
  calls.map(
    ({ name, args, fillStyle, offset }) =>
      `${name}(${args.map(String).join(',')}) ${String(fillStyle)} ${offset.x},${offset.y}`,
  );
/** How tall an object stands above its own footprint (a point, or a line of slope `slope`). */
function heightOf({ object, points }: { object: TubeObject; points: MatrixPoint[] }) {
  const anchor = project(object.ground.x, object.ground.y);
  return Math.max(0, ...points.map((p) => anchor.y + object.slope * (p.x - anchor.x) - p.y));
}
const GLASS_COLOURS = new Set(
  Object.entries(TUBE_PALETTE)
    .filter(([name]) => name.startsWith('GLASS.'))
    .flatMap(([, pair]) => pair),
);
const SNOW_TOP = new Set<string>(SNOW.top);
const AMBER = TUBE_PALETTE['LAMP.lit'][0];
/** drawResident's calls for one figure standing in a stack, as the stack draws it. */
function figureCalls(look: ResidentState['resident']) {
  const recorder = recordingContext();
  const standing = { moving: false, facing: 'sw', walkPhase: 0, greeting: false } as const;
  drawResident(recorder.ctx, look, 0, 0, 1.25, standing, { shadow: false });
  return recorder.calls.length;
}
/**
 * The heaviest figure a neighbor could have, over every figure and accessory the schema allows
 * rather than today's roster, so a new home can never push a stack past its cap.
 */
const HEAVIEST_LOOK = residentSchema.shape.figure
  .unwrap()
  .options.flatMap((figure) =>
    residentSchema.shape.accessory.options.map((accessory) => ({
      ...base.resident,
      figure,
      accessory,
    })),
  )
  .map((look) => ({ look, calls: figureCalls(look) }))
  .sort((a, b) => b.calls - a.calls)[0].look;
const HEAVIEST = [HEAVIEST_LOOK, HEAVIEST_LOOK];

describe('The Treeline in the opening view', () => {
  it('paints the line quietly: within the frame budgets, and hovering costs nothing', () => {
    const none = paint(realScene(OPENING, 720, 3));
    expect(none.total).toBeGreaterThan(100);
    expect(none.total).toBeLessThanOrEqual(250);
    expect(none.ground.calls.length).toBeLessThanOrEqual(100);
    const selected = paint(realScene(OPENING, 720, 3, { emphasis: 'selected', station: 'C1' }));
    expect(selected.total).toBeLessThanOrEqual(290);
    expect(selected.total).toBeGreaterThan(none.total);
    const hover = paint(realScene(OPENING, 720, 3, { emphasis: 'hover', station: 'C1' }));
    expect(hover.total).toBe(none.total);
    const whole = paint(realScene(WHOLE, 720, 3));
    // The whole-town fit: the width term wins, 1388 / ((W + H) × 38 + 36) at 1440 × 900.
    expect(WHOLE.zoom).toBeCloseTo(1388 / (WORLD_BOUNDS.right - WORLD_BOUNDS.left + 36), 9);
    expect(WHOLE.zoom).toBeCloseTo(0.245, 3);
    expect(parts(whole, 'stack')).toHaveLength(TUBE_STATIONS.length);
    expect(TUBE_STATIONS).toHaveLength(7);
    expect(whole.total).toBeLessThanOrEqual(WHOLE_CAP);
    expect(none.alpha).toBe(1);
  });

  it(
    'stays within budget through a real day of rides, and leaves the alpha as it found it',
    {
      timeout: 20_000,
    },
    () => {
      const rides = tubeRides(places, SUMMER);
      expect(rides.length).toBeGreaterThan(0);
      let most = 0;
      for (const ride of rides)
        for (const minutes of [
          ride.board + 1.7,
          ride.board + 1.95,
          ride.depart + 0.3,
          ride.off - 1.9,
        ]) {
          for (const camera of [OPENING, WHOLE]) {
            const painted = paint(realScene(camera, minutes, SUMMER));
            most = Math.max(most, painted.total);
            expect(painted.total, `${minutes}`).toBeLessThanOrEqual(
              camera === WHOLE ? WHOLE_CAP : 250,
            );
            expect(painted.alpha).toBe(1);
          }
        }
      expect(most).toBeGreaterThan(0);
    },
  );

  it('keeps simultaneous boarding and alighting within the whole-town budget', () => {
    // A busy frame independent of the roster: one neighbor boards while two step off together.
    // Saving canvas state for every glass segment made this ordinary frame cost 429 calls.
    const painted = paint(
      sceneOf({
        zoom: WHOLE.zoom,
        visible: visibleFor(WHOLE),
        residents: [
          person('boarding', '#789B76', boarding(C1.id, N1.id, 0.89), {
            figure: 'male',
            accessory: 'none',
          }),
          person('first-off', '#789B76', alighting(C1.id, N1.id, 0.05), {
            figure: 'male',
            accessory: 'glasses',
          }),
          person('second-off', '#789B76', alighting(C1.id, N1.id, 0.05), {
            figure: 'male',
            accessory: 'none',
          }),
        ],
      }),
    );
    expect(painted.total).toBeLessThanOrEqual(WHOLE_CAP);
    expect(painted.alpha).toBe(1);
  });

  it(
    'keeps the busiest test-box moment within budget, whoever lives in town',
    { timeout: 20_000 },
    () => {
      // The test box's peak is a sum of parts, so it is pinned here rather than left to how a
      // roster's ids happen to time their rides: two of the heaviest figures in Hedgerow Halt's
      // stack, one at the fwoomp and one settling after the drop (a puff each), and three
      // riders on its spur and the trunk, on a winter night with the lamps lit and snow on the
      // hood, the sign and the bucket.
      const riders = [
        ['#A1233D', 0.5],
        ['#789B76', 1.6],
        ['#8392B1', 4],
      ] as const;
      const painted = paint(
        sceneOf({
          day: WINTER,
          minutes: 1290,
          zoom: OPENING.zoom,
          visible: visibleFor(OPENING),
          residents: [
            person('fwoomp', HEAVIEST_LOOK.outfit, boarding(C1.id, N1.id, 0.97), HEAVIEST[0]),
            person('settling', HEAVIEST_LOOK.outfit, alighting(N1.id, C1.id, 0.1), HEAVIEST[1]),
            ...riders.map(([outfit, s], i) =>
              person(`rider-${i}`, outfit, riding(C1.id, N1.id, s), HEAVIEST_LOOK),
            ),
          ],
        }),
      );
      // Everyone is in view and drawn: both figures, their puffs (and the riders' who have just
      // left) and every rider.
      expect(parts(painted, 'puff', C1.id).length).toBeGreaterThanOrEqual(2);
      for (const [outfit] of riders) {
        // Dimmed at night, as every walker is.
        const dimmed = tint(outfit, -40);
        expect(
          painted.all.some((call) => call.name === 'fillRect' && call.fill === dimmed),
          outfit,
        ).toBe(true);
      }
      // Measured 232: the quiet frame's 175, then 18 more in the stack for its two figures, 12
      // for four puffs and 27 for the riders on the spur.
      expect(painted.total).toBeLessThanOrEqual(250);
      expect(painted.alpha).toBe(1);
    },
  );

  /** Five days across the year: spring, the regatta, high summer, the Harvest Fair, deep winter. */
  const OPENING_DAYS = [yearDay(9), yearDay(37), SUMMER, yearDay(78), WINTER];
  it(
    'keeps the real opening frame within budget, on a desktop and on a phone, through the year',
    { timeout: rosterTimeout(0.4, 60_000) },
    () => {
      // The view a visitor first sees, framed by opening-view.ts as City.tsx frames it: today's
      // frozen 30 homes, the same frame whoever moves in; and the roster
      // as it is, which in check:full-town is every house plot taken, opening at the zoom floor
      // (0.35 on a laptop, 0.15 on a phone with the whole loop in view). Each at every ride's
      // busiest moments on five days.
      for (const [name, homes] of [
        ['frozen', FROZEN_TOWN],
        ['live', places],
      ] as const) {
        const cameras = (
          [
            [1120, 640],
            [390, 440],
          ] as const
        ).map(([width, height]) => ({
          width,
          height,
          camera: openingView(
            homes.map((place) => place.plot),
            width,
            height,
          ),
          most: 0,
        }));
        for (const day of OPENING_DAYS) {
          const moments = [
            600,
            720,
            1210,
            ...tubeRides(homes, day).flatMap((ride) => [
              ride.board + 1.7,
              ride.board + 1.95,
              ride.depart + 0.3,
              ride.off - 1.9,
            ]),
          ];
          for (const minutes of moments) {
            const residents = simulateResidents(homes, minutes, day);
            for (const view of cameras) {
              const painted = paint(
                sceneOf({
                  minutes,
                  day,
                  zoom: view.camera.zoom,
                  visible: visibleFor(view.camera, view.width, view.height),
                  residents,
                  parcels: () => tubeParcelsAt(homes, minutes, day),
                }),
              );
              view.most = Math.max(view.most, painted.total);
              expect(
                painted.total,
                `${name} ${view.width}×${view.height} on ${day} at ${minutes}`,
              ).toBeLessThanOrEqual(250);
            }
          }
        }
        for (const view of cameras)
          expect(view.most, `${name} ${view.width}×${view.height}`).toBeGreaterThan(100);
      }
    },
  );

  it('keeps each bank halt within its own budget, and draws nothing of it off-screen', () => {
    for (const id of ['C15', 'L15', 'R15']) {
      const own = (scene: TubeScene) =>
        callsOf(paint(scene).objects.filter((o) => o.object.station === id));
      for (const zoom of [1, 3]) {
        const camera = closeUp(id, zoom);
        for (const emphasis of ['none', 'selected'] as const) {
          const calls = own(sceneOf({ zoom, visible: visibleFor(camera), emphasis, station: id }));
          expect(calls, `${id} ${zoom} ${emphasis}`).toBeGreaterThan(0);
          expect(calls, `${id} ${zoom} ${emphasis}`).toBeLessThanOrEqual(150);
        }
      }
      expect(own(sceneOf({ zoom: 3, visible: visibleFor(closeUp('C1')) }))).toBe(0);
    }
  });
});

describe('The Treeline’s parts', () => {
  it('keeps every part within its call cap', { timeout: 20_000 }, () => {
    for (const emphasis of ['none', 'selected'] as const)
      for (const station of TUBE_STATIONS) {
        const painted = paint(sceneOf({ emphasis, station: station.id }));
        const glass = callsOf(parts(painted, 'spur', station.id));
        expect(glass).toBeGreaterThan(0);
        expect(glass).toBeLessThanOrEqual(emphasis === 'none' ? 90 : 110);
        for (const bubble of parts(painted, 'bubble', station.id))
          expect(bubble.calls.length).toBeLessThanOrEqual(8);
        // A post is a shadow and two sides; a bank pier, two sides on a two-sided foot with a
        // dry top (its ring and reflection lie in the ground).
        for (const post of parts(painted, 'post', station.id))
          expect(post.calls.length).toBeLessThanOrEqual(station.edge === 'bank' ? 5 : 3);
      }
    // A winter night with the lamp lit: snow on the hood, the sign and the bucket.
    const winterNight = sceneOf({ day: WINTER, minutes: 1290 });
    expect(snowAt(winterNight.season.yearDay, seedFraction(`tube:${C1.id}`))).toBeGreaterThan(0);
    const empty = paint(winterNight);
    for (const stack of parts(empty, 'stack')) expect(stack.calls.length).toBeLessThanOrEqual(14);
    expect(parts(empty, 'sign')[0].calls.length).toBeLessThanOrEqual(12);
    expect(parts(empty, 'stand')[0].calls.length).toBeLessThanOrEqual(8);
    // One and two figures in the stack, at the crouch and the fwoomp. The figures are
    // drawResident's; the stack's own share stays small: at most 14 empty, plus the clip, the
    // pane over the figures and each figure's pose (21 for two on a lit winter night).
    const figure = figureCalls(HEAVIEST_LOOK);
    for (const progress of [0.92, 0.97]) {
      const one = paint(
        sceneOf({
          ...winterNight,
          residents: [person('a', '#A1233D', boarding(C1.id, N1.id, progress), HEAVIEST[0])],
        }),
      );
      expect(parts(one, 'stack', C1.id)[0].calls.length - figure).toBeLessThanOrEqual(24);
      const two = paint(
        sceneOf({
          ...winterNight,
          residents: HEAVIEST.map((look, i) =>
            person(`p${i}`, look.outfit, boarding(C1.id, N1.id, progress), look),
          ),
        }),
      );
      expect(parts(two, 'stack', C1.id)[0].calls.length - 2 * figure).toBeLessThanOrEqual(24);
      for (const puff of parts(two, 'puff')) expect(puff.calls.length).toBeLessThanOrEqual(12);
    }
    // One rider and one parcel on the trunk: the sprites alone.
    const rider = paint(sceneOf({ residents: [person('r', '#A1233D', riding(C1.id, N1.id, 20))] }));
    expect(rider.traffic.calls.length).toBeGreaterThan(0);
    expect(rider.traffic.calls.length).toBeLessThanOrEqual(11);
    const parcel = paint(sceneOf({ parcels: () => [parcelAt('riding', N1.id, C1.id, 0.5, 30)] }));
    expect(parcel.traffic.calls.length).toBeGreaterThan(0);
    expect(parcel.traffic.calls.length).toBeLessThanOrEqual(9);
  });

  it('draws each spur as strokes and each bubble as a square with the whole loop in view', () => {
    // A phone's opening view (0.15 with every plot taken) holds the whole loop: a spur is a few
    // pixels, so each halt's run of spur glass is one stroke and a bubble one square.
    const HALO = TUBE_PALETTE['GLASS.halo'];
    for (const emphasis of ['none', 'selected'] as const) {
      const painted = paint(sceneOf({ zoom: 0.15, emphasis, station: C1.id }));
      for (const station of TUBE_STATIONS) {
        const log = parts(painted, 'spur', station.id).flatMap((o) => o.log);
        expect(
          log.filter((call) => call.name === 'fillRect'),
          station.id,
        ).toEqual([]);
        const strokes = log.filter((call) => call.name === 'stroke');
        const halos = strokes.filter((call) => HALO.includes(call.stroke));
        expect(strokes.length - halos.length, station.id).toBeGreaterThan(0);
        expect(halos.length, station.id).toBe(
          emphasis === 'selected' && station === C1 ? strokes.length / 2 : 0,
        );
        for (const bubble of parts(painted, 'bubble', station.id))
          expect(bubble.log.some((call) => call.name === 'arc')).toBe(
            emphasis === 'selected' && station === C1,
          );
      }
      expect(painted.total).toBeLessThanOrEqual(WHOLE_CAP);
      expect(painted.alpha).toBe(1);
    }
  });

  it('stays low: stations under 50 px, the spur at 36.5–41.5 px and the trunk under 11 px', () => {
    const winter = paint(sceneOf({ day: WINTER, minutes: 720 }));
    const deep = townSeasonAt(WINTER, 720).yearDay;
    for (const station of TUBE_STATIONS)
      expect(snowAt(deep, seedFraction(`tube:${station.id}`))).toBeGreaterThan(0);
    for (const stack of parts(winter, 'stack')) expect(heightOf(stack)).toBeLessThanOrEqual(50);
    expect(heightOf(parts(winter, 'sign')[0])).toBeLessThanOrEqual(25);
    expect(heightOf(parts(winter, 'stand')[0])).toBeLessThanOrEqual(18);
    const spurs = parts(winter, 'spur');
    expect(spurs.length).toBe(TUBE_PIECES.filter((piece) => piece.layer === 'spur').length);
    for (const spur of spurs) expect(heightOf(spur)).toBeLessThanOrEqual(42);
    // The trunk's glass, between its two elbows, above its own footprint.
    const start = project(TUBE_TRUNK_X, C1.dock.y + 0.5),
      end = project(TUBE_TRUNK_X, N1.dock.y - 0.5);
    // (A junction's clip rectangle paints nothing.)
    const trunk = winter.ground.points.filter(
      (p) => p.call !== 'rect' && p.x < start.x - 1 && p.x > end.x + 1,
    );
    expect(trunk.length).toBeGreaterThan(0);
    for (const p of trunk) expect(start.y - 0.5 * (p.x - start.x) - p.y).toBeLessThanOrEqual(11);
    // Every glass fillRect is the 5-px tube (4 px down the far bank), or its 8-px halo when
    // selected.
    for (const emphasis of ['none', 'selected'] as const) {
      const painted = paint(sceneOf({ emphasis, station: 'C1' }));
      const glass = [
        ...painted.ground.log,
        ...parts(painted, 'spur').flatMap((o) => o.log),
        ...parts(painted, 'bubble').flatMap((o) => o.log),
      ].filter((call) => call.name === 'fillRect' && GLASS_COLOURS.has(call.fill));
      expect(glass.length).toBeGreaterThan(0);
      for (const call of glass)
        expect(Math.abs(call.args[3] as number)).toBeLessThanOrEqual(emphasis === 'none' ? 5 : 8);
    }
    // Walkers on the lane (x = 1.5, 31 px tall) or the riverside road (x = 61.5) pass under the
    // glass: the whole straight, from the corner to the lane's or the road's far edge, is at full
    // height; so is a north spur's leg, from its stack to the y = 1 lane's far edge.
    expect(TUBE_ALTITUDE.spur - TUBE_ALTITUDE.radius - 31).toBeGreaterThanOrEqual(5.5);
    for (const station of TUBE_STATIONS) {
      const { edge, dock, stack } = station;
      const straight = loopSpur(station, 1).filter((p) =>
        edge === 'west'
          ? p.y === dock.y && p.x >= 1.35 - 1e-9 && p.x <= dock.x
          : edge === 'north'
            ? p.x === dock.x && p.y >= 1.35 - 1e-9 && p.y <= stack.y
            : p.y === dock.y && p.x >= dock.x && p.x <= WORLD_WIDTH - 2.35 + 1e-9,
      );
      expect(straight.length, station.id).toBeGreaterThan(2);
      for (const p of straight) expect(p.h).toBe(TUBE_ALTITUDE.spur);
    }
    for (const from of [C1.id, N1.id])
      for (let s = 0; s <= LENGTH; s += 0.01) {
        const at = tubeAt(from, from === C1.id ? N1.id : C1.id, s);
        if (at.position.x >= 1.1 && at.position.x <= 1.9)
          expect(at.altitude - TUBE_ALTITUDE.radius, `${s}`).toBeGreaterThanOrEqual(34);
      }
  });

  it('stands its trunk posts every 4 tiles and none on the plots', () => {
    const rows = (from: number, to: number, skip: number[]) =>
      Array.from({ length: (to - from) / 4 + 1 }, (_, k) => from + 4 * k).filter(
        (y) => !skip.includes(y),
      );
    const run = (name: string) => TUBE_TRUNK_POSTS.filter((post) => post.run === name);
    // The west run: the middle row of every block from the north-west corner down to Barley Halt,
    // never on a halt's own row (C1 11.5, N1 55.5).
    expect(run('west').every((post) => post.x === TUBE_TRUNK_X)).toBe(true);
    expect(run('west').map((post) => post.y)).toEqual(rows(3.5, 67.5, [11.5, 55.5]).reverse());
    // The north run: every second plot column, which misses Hawthorn Halt's 35.5.
    expect(run('north').every((post) => post.y === TUBE_TRUNK_Y)).toBe(true);
    expect(run('north').map((post) => post.x)).toEqual([7.5, 15.5, 23.5, 31.5, 39.5, 47.5, 55.5]);
    // The bank run: every plot row down to Bulrush Halt, the first two as pilings in the head pool.
    expect(run('bank').every((post) => post.x === TUBE_BANK_X)).toBe(true);
    expect(run('bank').map((post) => post.y)).toEqual(rows(3.5, 67.5, [11.5, 47.5]));
    expect(
      run('bank')
        .filter((post) => post.water)
        .map((post) => post.y),
    ).toEqual([3.5, 7.5]);
    expect(TUBE_TRUNK_POSTS).toHaveLength(37);
    for (const post of TUBE_TRUNK_POSTS) {
      expect((post[post.run === 'north' ? 'x' : 'y'] - 3.5) % 4).toBe(0);
      const halts = TUBE_STATIONS.filter((s) => s.edge === post.run);
      expect(
        halts.some((s) => (post.run === 'north' ? s.dock.x === post.x : s.dock.y === post.y)),
      ).toBe(false);
      expect(post.height).toBe(post.run === 'bank' ? 3 : 6);
    }
    // One post or pier for each spur: in the tree-free edge tile of its row or column, or mid-river
    // under a bank bridge.
    const posts = parts(paint(sceneOf()), 'post');
    expect(posts).toHaveLength(TUBE_STATIONS.length);
    for (const post of posts) {
      const { edge, dock } = tubeStation(post.object.station);
      const ground = post.object.ground;
      if (edge === 'west') expect(ground).toEqual({ x: 0.62, y: dock.y });
      if (edge === 'north') expect(ground).toEqual({ x: dock.x, y: 0.62 });
      if (edge === 'bank') expect(ground).toEqual({ x: KINGFISHER_PIER.x, y: dock.y });
    }
    // A bank pier stands about 27 px tall, to the bridge's underside over the water.
    for (const pier of posts.filter((o) => tubeStation(o.object.station).edge === 'bank'))
      expect(Math.abs(heightOf(pier) - 27)).toBeLessThanOrEqual(2);
  });

  it('keeps the glass discoverable and never fades a rider', () => {
    expect(glassLod(0.7, 'none')).toBeCloseTo(0.4, 9);
    expect(glassLod(0.28, 'none')).toBe(0.35);
    expect(glassLod(1.3, 'none')).toBe(1);
    expect(glassLod(0.5, 'hover')).toBe(1);
    expect(glassLod(0.5, 'selected')).toBe(1);
    const hi = TUBE_PALETTE['GLASS.hi'][0];
    const channel = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
    const contrast = [0, 1, 2].reduce(
      (sum, i) => sum + Math.abs(channel(hi, i) - channel('#B5C79E', i)),
      0,
    );
    expect(((contrast * channel(hi, 3)) / 255) * glassLod(0.7, 'none')).toBeGreaterThanOrEqual(40);
    // Riders and parcels at full alpha on the spur and the trunk; only their glass is faded.
    const painted = paint(
      sceneOf({
        zoom: 0.7,
        residents: [
          person('spur', '#A1233D', riding(C1.id, N1.id, 2)),
          person('trunk', '#23A13D', riding(C1.id, N1.id, 20)),
        ],
        parcels: () => [parcelAt('riding', N1.id, C1.id, 0.5, 30)],
      }),
    );
    const sprites = painted.all.filter(
      (call) =>
        call.name === 'fillRect' &&
        ['#A1233D', '#23A13D', TUBE_PALETTE['KRAFT.box'][0]].includes(call.fill),
    );
    expect(sprites.length).toBe(3);
    for (const call of sprites) expect(call.alpha).toBe(1);
    const washes = painted.all.filter(
      (call) => call.name === 'fillRect' && call.fill === TUBE_PALETTE['GLASS.wash'][0],
    );
    expect(washes.length).toBe(3);
    for (const call of washes) expect(call.alpha).toBeCloseTo(0.4, 9);
  });
});

describe('The Treeline close up', () => {
  /** Which of a piece's points lies at a screen point of its glass. */
  const screenIndex = (piece: (typeof TUBE_PIECES)[number], p: Point) =>
    piece.points.findIndex((q) => {
      const g = project(q.x, q.y);
      return g.x === p.x && g.y - q.h === p.y;
    });
  it('keeps the glass its width round every bend, and never lets it cross itself', () => {
    // From zoom 1 a piece that runs more than 2:1 down the screen (the river head's corner and the
    // two bank elbows turning toward the viewer) is drawn as one outline. A piece that folds back
    // across the screen (the west halts' north elbows and Hawthorn's west one) is drawn as its two
    // legs, the nearer first, each in slices. The rest are slices, whose thickness across the glass
    // is 2h / √(1 + slope²). No sliced run ever turns back across the screen.
    const across = (p: Point, line: readonly Point[]) => offLine(p, line);
    let bent = 0,
      folded = 0;
    for (const piece of TUBE_PIECES) {
      expect(tubeGlassEdges(piece, 0.7)).toBeUndefined();
      const runs = tubeGlassRuns(piece);
      expect(runs.length).toBeGreaterThan(0);
      expect(runs.length).toBeLessThanOrEqual(2);
      if (runs.length === 2) {
        folded++;
        // The legs meet at the fold, and the nearer one goes first.
        const [near, far] = runs;
        const tip = near.points.find((p) => far.points.some((q) => q.x === p.x && q.y === p.y));
        expect(tip, piece.station).toBeDefined();
        expect(near.points.length + far.points.length).toBe(piece.points.length + 1);
        // The nearer leg by the mean x + y of its own ground points.
        const depth = (run: (typeof runs)[number]) =>
          run.points.reduce((sum, p) => {
            const at = piece.points[screenIndex(piece, p)];
            return sum + at.x + at.y;
          }, 0) / run.points.length;
        expect(depth(near), piece.station).toBeGreaterThan(depth(far));
      }
      for (const run of runs) {
        if (run.edges) {
          bent++;
          expect(tubeGlassEdges(piece, 3)).toBe(run.edges);
          for (const p of run.points)
            for (const edge of run.edges) {
              expect(across(p, edge), piece.station).toBeGreaterThanOrEqual(1.4);
              expect(across(p, edge), piece.station).toBeLessThanOrEqual(2.6);
            }
          continue;
        }
        let way = 0;
        for (let k = 1; k < run.points.length; k++) {
          const dx = run.points[k].x - run.points[k - 1].x,
            dy = run.points[k].y - run.points[k - 1].y;
          if (Math.hypot(dx, dy) < 0.01) continue;
          if (Math.abs(dx) >= 0.05) {
            if (way) expect(Math.sign(dx), `${piece.station} ${k} turns back`).toBe(way);
            way = Math.sign(dx);
          }
          const i = screenIndex(piece, run.points[k]);
          const half =
            piece.points[i].x === TUBE_BANK_X && piece.points[i - 1]?.x === TUBE_BANK_X
              ? TUBE_ALTITUDE.bankRadius
              : TUBE_ALTITUDE.radius;
          expect(Math.abs(dy), `${piece.station} ${k}`).toBeLessThanOrEqual(2 * Math.abs(dx));
          expect((2 * half) / Math.hypot(1, dy / dx), `${piece.station} ${k}`).toBeGreaterThan(2.8);
        }
      }
    }
    // The corner round the river's head, and the two bank elbows that turn south toward the
    // viewer as they drop to the far bank (C15's and L15's).
    expect(bent).toBe(1 + 2);
    // R1's, N1's and C1's north elbows and A9's west elbow.
    expect(folded).toBe(4);
  });

  it('runs each middle halt’s dip on into its T, and keeps its own glass off the trunk', () => {
    const BODY = TUBE_PALETTE['GLASS.body'][0];
    const t = tracked();
    drawTubeGround(t.ctx, sceneOf({ zoom: 3 }));
    const quads = new Map<number, MatrixPoint[]>();
    t.points.forEach((p) => {
      if (t.log[p.index]?.name === 'fillRect' && t.log[p.index].fill === BODY)
        quads.set(p.index, [...(quads.get(p.index) ?? []), p]);
    });
    /** Whether a point lies in a fillRect's parallelogram (its corners: TL, TR, BL, BR). */
    const inside = (p: Point, [o, u, v]: MatrixPoint[]) => {
      const ux = u.x - o.x,
        uy = u.y - o.y,
        vx = v.x - o.x,
        vy = v.y - o.y;
      const det = ux * vy - uy * vx;
      const s = ((p.x - o.x) * vy - (p.y - o.y) * vx) / det,
        r = (ux * (p.y - o.y) - uy * (p.x - o.x)) / det;
      return s >= -1e-6 && s <= 1 + 1e-6 && r >= -1e-6 && r <= 1 + 1e-6;
    };
    for (const station of TUBE_STATIONS) {
      const stem = tubeStem(station.id);
      const middle = station !== TUBE_STATIONS[0] && station !== TUBE_STATIONS.at(-1);
      // A stem where the elbows open round the T on screen (the bank halts'); at the west and
      // north halts the elbow toward the viewer already runs the dip past the bubble.
      expect(!!stem, station.id).toBe(middle && station.edge === 'bank');
      if (!middle) continue;
      // From where its dip splits (the last point both spurs share) to its tap on the trunk.
      const on = loopSpur(station, 1),
        back = loopSpur(station, -1);
      let shared = 0;
      while (on[shared].x === back[shared].x && on[shared].y === back[shared].y) shared++;
      const split = on[shared - 1],
        tap = trunkPoint(stationTap(station.id));
      if (stem) expect(stem).toEqual([split, tap]);
      const a = project(split.x, split.y),
        b = project(tap.x, tap.y);
      const middlePoint = { x: (a.x + b.x) / 2, y: (a.y - split.h + b.y - tap.h) / 2 };
      expect(
        [...quads.values()].some((quad) => inside(middlePoint, quad)),
        station.id,
      ).toBe(true);
    }
    // Each middle halt's glass is clipped clear of the trunk between its elbows, and of every run
    // of its own already painted; the canvas state comes back as it was.
    const clips = t.log.filter((call) => call.name === 'clip');
    expect(clips.length).toBeGreaterThanOrEqual(5);
    for (const clip of clips) expect(clip.args[0]).toBe('evenodd');
    expect(t.log.filter((call) => call.name === 'save').length).toBe(
      t.log.filter((call) => call.name === 'restore').length,
    );
    expect(t.ctx.globalAlpha).toBe(1);
    expect(t.matrix()).toEqual([1, 0, 0, 1, 0, 0]);
    // A halt's junction is painted once into the ground cache: at most 150 calls, selected too,
    // counted inside its own canvas states, with only its own rectangle in view.
    for (const station of TUBE_STATIONS) {
      const area = tubeMarkArea(station.id);
      const marked = tracked();
      drawTubeGround(
        marked.ctx,
        sceneOf({
          zoom: 3,
          emphasis: 'selected',
          station: station.id,
          visible: (p, rx, above, below) =>
            p.x + rx >= area.left &&
            p.x - rx <= area.right &&
            p.y + below >= area.top &&
            p.y - above <= area.bottom,
        }),
      );
      let depth = 0,
        start = 0,
        calls = 0;
      marked.log.forEach((call, i) => {
        if (call.name === 'save' && depth++ === 0) start = i;
        if (call.name === 'restore' && --depth === 0) calls += i - start + 1;
      });
      expect(calls, station.id).toBeLessThanOrEqual(150);
    }
    // Below zoom 1 the halts keep the plain art: no stems and no clips.
    for (const zoom of [0.7, 0.3]) {
      const plain = tracked();
      drawTubeGround(plain.ctx, sceneOf({ zoom }));
      expect(plain.log.some((call) => call.name === 'clip')).toBe(false);
    }
  });

  it('lays reflections and rings only on the river, and only close up', () => {
    const marks = new Set([
      ...TUBE_PALETTE['REFLECTION.glass'],
      ...TUBE_PALETTE['REFLECTION.post'],
      ...TUBE_PALETTE.RIPPLE,
    ]);
    const onWater = (p: Point) => {
      const w = unproject(p.x, p.y);
      const tx = Math.floor(w.x),
        ty = Math.floor(w.y);
      return tx === WORLD_WIDTH - 2 || (tx === WORLD_WIDTH - 1 && ty < 8);
    };
    for (const minutes of [720, 1290]) {
      const t = tracked();
      drawTubeGround(t.ctx, sceneOf({ minutes }));
      // Every reflection lands on the water, and so does every ring and the pool's line: each
      // fillRect in their colours, and each path filled or stroked in them.
      const byCall = new Map<number, Point[]>();
      for (const p of t.points) byCall.set(p.index, [...(byCall.get(p.index) ?? []), p]);
      const water: Point[] = [];
      let path: number[] = [];
      t.log.forEach((call, i) => {
        if (call.name === 'beginPath') path = [];
        else if (['moveTo', 'lineTo', 'ellipse', 'arc'].includes(call.name)) path.push(i);
        else if (
          (call.name === 'stroke' && marks.has(call.stroke)) ||
          (call.name === 'fill' && marks.has(call.fill))
        )
          water.push(...path.flatMap((k) => byCall.get(k) ?? []));
        else if (call.name === 'fillRect' && marks.has(call.fill))
          water.push(...(byCall.get(i) ?? []));
      });
      expect(water.length).toBeGreaterThan(0);
      for (const p of water) expect(onWater(p), `${p.x},${p.y}`).toBe(true);
      // The reflection down the head pool, two pilings and three piers.
      const reflections = t.log.filter(
        (call) => call.name === 'fillRect' && TUBE_PALETTE['REFLECTION.post'].includes(call.fill),
      );
      expect(reflections.length).toBe(2 + 3 * 2);
      // The bank glass's own, in the river's hand: short flat ticks, 1 px high and 3–9 long,
      // broken at the pilings.
      const ticks = t.log.filter(
        (call) => call.name === 'fillRect' && TUBE_PALETTE['REFLECTION.glass'].includes(call.fill),
      );
      expect(ticks.length).toBeGreaterThanOrEqual(20);
      for (const tick of ticks) {
        const [, , w, h] = tick.args as number[];
        expect(h).toBe(1);
        expect(w).toBeGreaterThanOrEqual(3);
        expect(w).toBeLessThanOrEqual(9);
      }
      expect(t.log.some((call) => call.name === 'setLineDash')).toBe(false);
      expect(t.log.filter((call) => call.name === 'ellipse').length).toBe(2 + 3 + 7 * 2);
    }
    // Zoomed out the river keeps only the piers' plain ripples, and from FAR nothing at all.
    const near = tracked();
    drawTubeGround(near.ctx, sceneOf({ zoom: 0.7 }));
    expect(near.log.some((call) => TUBE_PALETTE['REFLECTION.glass'].includes(call.fill))).toBe(
      false,
    );
    expect(
      near.log.filter((call) => call.name === 'fillRect' && call.fill === TUBE_PALETTE.RIPPLE[0]),
    ).toHaveLength(3 + 2);
    const far = tracked();
    drawTubeGround(far.ctx, sceneOf({ zoom: 0.3 }));
    expect(far.log.some((call) => TUBE_PALETTE.RIPPLE.includes(call.fill))).toBe(false);
  });

  it('hangs each lamp under its hood, with a hot middle only while it is lit', () => {
    const CORE = TUBE_PALETTE['LAMP.core'][0];
    for (const minutes of [720, 1205, 1290])
      for (const zoom of [3, 0.7, 0.3]) {
        const painted = paint(sceneOf({ minutes, zoom }));
        for (const stack of parts(painted, 'stack')) {
          const lit = stack.log.some((call) => call.fill === AMBER);
          const core = stack.log.filter((call) => call.name === 'fillRect' && call.fill === CORE);
          expect(core.length, `${stack.object.station} ${minutes} ${zoom}`).toBe(
            lit && zoom >= 0.5 ? 1 : 0,
          );
          // The lamp hangs under the hood's lip, never above the 48-px hood.
          expect(heightOf(stack)).toBeLessThanOrEqual(48);
        }
      }
  });
});

describe('The Treeline through the year', () => {
  it('lays snow only on the hood, the sign and the bucket, never on the glass', () => {
    for (const minutes of [720, 1290]) {
      const painted = paint(sceneOf({ day: WINTER, minutes }));
      const snowy = (log: readonly Logged[]) =>
        log.filter((call) => call.name === 'fillRect' && SNOW_TOP.has(call.fill)).length;
      expect(snowy(painted.ground.log)).toBe(0);
      expect(snowy(painted.traffic.log)).toBe(0);
      for (const { object, log } of painted.objects)
        if (!['stack', 'sign', 'stand'].includes(object.part)) expect(snowy(log)).toBe(0);
      for (const station of TUBE_STATIONS) {
        const count = painted.objects
          .filter((o) => o.object.station === station.id)
          .reduce((sum, o) => sum + snowy(o.log), 0);
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThanOrEqual(3);
      }
    }
    // Nothing white in summer.
    const summer = paint(sceneOf({ day: SUMMER }));
    expect(summer.all.some((call) => SNOW_TOP.has(call.fill))).toBe(false);
  });

  it('turns amber only in a lit lamp, and never in the cached ground', () => {
    const fork = getPlot(FORK_PLOT)!;
    const distance = (station: (typeof TUBE_STATIONS)[number]) =>
      Math.min(
        MAX_LAMP_DISTANCE,
        Math.max(
          MIN_LAMP_DISTANCE,
          Math.abs(station.stack.x - fork.x - 0.5) + Math.abs(station.stack.y - fork.y - 0.5),
        ),
      );
    expect(distance(C1)).toBeCloseTo(10.7, 9);
    const minutes = [180, 720, 1190, 1205, 1290, ...Array.from({ length: 16 }, (_, i) => 1216 + i)];
    let lit = 0;
    for (const m of minutes) {
      const painted = paint(sceneOf({ minutes: m }));
      expect(painted.ground.log.some((call) => call.fill === AMBER)).toBe(false);
      expect(painted.ground.log.some((call) => call.name === 'drawImage')).toBe(false);
      for (const station of TUBE_STATIONS) {
        const amber = painted.objects
          .filter((o) => o.object.station === station.id)
          .flatMap((o) => o.log)
          .filter((call) => call.name === 'fillRect' && call.fill === AMBER);
        const on = isNight(m) && lampOn(distance(station), m);
        expect(amber.length, `${station.id} ${m}`).toBe(on ? 1 : 0);
        if (on) lit++;
      }
    }
    expect(lit).toBeGreaterThan(0);
  });

  it('paints the same ground whatever the minute or the town is doing', () => {
    const ground = (scene: TubeScene) => {
      const recorder = recordingContext();
      drawTubeGround(recorder.ctx, scene);
      return trace(recorder.calls);
    };
    const quiet = ground(sceneOf({ minutes: 380 }));
    expect(ground(sceneOf({ minutes: 1190 }))).toEqual(quiet);
    expect(
      ground(
        sceneOf({
          minutes: 1190,
          residents: [person('r', '#A1233D', riding(C1.id, N1.id, 20))],
          parcels: () => [parcelAt('riding', N1.id, C1.id, 0.5, 30)],
        }),
      ),
    ).toEqual(quiet);
    expect(ground(sceneOf({ minutes: 1290 }))).not.toEqual(quiet);
  });

  it('keeps clear of every season’s signature colours', () => {
    const swatches = new Set<string>();
    const collect = (value: unknown): void => {
      if (typeof value === 'string' && /^#[0-9a-f]{6}/i.test(value))
        swatches.add(value.slice(0, 7).toUpperCase());
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    collect([SNOW, ICE, FIREFLY, BLOSSOM, FOLIAGE, FALLEN_LEAVES, PUMPKIN, POND, REED]);
    expect(swatches.size).toBeGreaterThan(20);
    const clashes = Object.entries(TUBE_PALETTE).flatMap(([name, pair]) =>
      pair
        .filter((colour) => swatches.has(colour.slice(0, 7).toUpperCase()))
        .map((colour) => `${name} ${colour}`),
    );
    expect(clashes).toEqual([]);
  });
});

describe('The station sign', () => {
  it('says it word for word at Hedgerow Halt only, in the same ink lit or not', () => {
    for (const minutes of [720, 1205, 1290]) {
      const painted = paint(sceneOf({ minutes }));
      const signs = parts(painted, 'sign');
      expect(signs).toHaveLength(1);
      expect(signs[0].object.station).toBe(TUBE_SIGN_STATION);
      const text = signs[0].log.filter((call) => call.name === 'fillText');
      expect(text.map((call) => call.args[0])).toEqual([...TUBE_SIGN_LINES]);
      for (const call of text) expect(call.font).toBe('bold 4px "Space Mono", monospace');
      expect(new Set(text.map((call) => call.fill))).toEqual(
        new Set([TUBE_PALETTE['PLATE.ink'][isNight(minutes) ? 1 : 0]]),
      );
      const others = painted.objects.filter((o) => o.object.station !== C1.id);
      expect(others.flatMap((o) => o.log).some((call) => call.name === 'fillText')).toBe(false);
    }
    expect(TUBE_SIGN_LINES.join(' ')).toBe('People & parcels. Please remove umbrella.');
    expect(TUBE_PALETTE['PLATE.face']).toEqual(['#CFDDB9', '#6F8676']);
    expect(TUBE_PALETTE['PLATE.border']).toEqual(['#6F8B66', '#3F5750']);
    expect(TUBE_PALETTE['PLATE.ink']).toEqual(['#2F4A3B', '#1F302A']);
    // The C1 lamp is unlit at 20:05 and lit at 21:30; the sign does not change.
    const sign = (minutes: number) => trace(parts(paint(sceneOf({ minutes })), 'sign')[0].calls);
    expect(sign(1290)).toEqual(sign(1205));
  });
});

describe('Riders and parcels in the glass', () => {
  const key = (painter: TubePainter) =>
    painter.kind === 'spur'
      ? `spur ${painter.piece}`
      : painter.kind === 'stack'
        ? `stack ${painter.station}`
        : 'traffic';
  it('hands every point of every ride to exactly one painter, in order along the line', () => {
    // Hedgerow to Willow: Hedgerow's spur from its stack, the glass behind the trees, Willow's
    // spur back to its stack, each piece once and in order.
    const own = (station: string, reverse: boolean) => {
      const list = TUBE_PIECES.flatMap((piece, i) =>
        piece.layer === 'spur' && piece.station === station ? [`spur ${i}`] : [],
      );
      return reverse ? list.reverse() : list;
    };
    const expected = [
      `stack ${C1.id}`,
      ...own(C1.id, false),
      'traffic',
      ...own(N1.id, true),
      `stack ${N1.id}`,
    ];
    const seenOf = (from: string, to: string) => {
      const seen: string[] = [];
      for (let s = 0; s <= tubeLength(from, to) + 1e-9; s += 0.01) {
        const k = key(tubePainterFor(from, to, s));
        if (seen.at(-1) !== k) seen.push(k);
      }
      return seen;
    };
    expect(seenOf(C1.id, N1.id)).toEqual(expected);
    expect(seenOf(N1.id, C1.id)).toEqual([...expected].reverse());
    // Every ride: its own stack, its own spur pieces, the glass behind the trees once, the other
    // halt's spur pieces, its stack; never a piece twice.
    const sorted = (list: string[]) => [...list].sort();
    for (const a of TUBE_STATIONS)
      for (const b of TUBE_STATIONS) {
        if (a === b) continue;
        const seen = seenOf(a.id, b.id);
        expect(new Set(seen).size, `${a.id}>${b.id}`).toBe(seen.length);
        const middle = seen.indexOf('traffic');
        expect(seen[0]).toBe(`stack ${a.id}`);
        expect(seen.at(-1)).toBe(`stack ${b.id}`);
        expect(sorted(seen.slice(1, middle)), `${a.id}>${b.id}`).toEqual(sorted(own(a.id, false)));
        expect(sorted(seen.slice(middle + 1, -1)), `${a.id}>${b.id}`).toEqual(
          sorted(own(b.id, false)),
        );
      }
  });

  it('draws each rider once: on a spur inside its piece, on the trunk before the sort', () => {
    const outfits = ['#A1233D', '#23A13D', '#3D23A1'];
    const riders = [2, 20, 53].map((s, i) => person(`r${i}`, outfits[i], riding(C1.id, N1.id, s)));
    const painted = paint(sceneOf({ residents: riders }));
    const count = (log: readonly Logged[], outfit: string) =>
      log.filter((call) => call.name === 'fillRect' && call.fill === outfit).length;
    outfits.forEach((outfit) => expect(count(painted.all, outfit), outfit).toBe(1));
    expect(count(painted.traffic.log, outfits[1])).toBe(1);
    for (const [i, s] of [
      [0, 2],
      [2, 53],
    ]) {
      const painter = tubePainterFor(C1.id, N1.id, s);
      expect(painter.kind).toBe('spur');
      const piece = TUBE_PIECES[(painter as { piece: number }).piece];
      const owner = painted.objects.find(
        (o) => o.object.part === 'spur' && o.object.depth === piece.depth,
      )!;
      expect(count(owner.log, outfits[i])).toBe(1);
    }
    // Two riders nose to tail are drawn 4 px apart; a followed rider's glass glows gold.
    const pair = paint(
      sceneOf({
        residents: [
          person('a', outfits[0], riding(C1.id, N1.id, 20.2)),
          person('b', outfits[1], riding(C1.id, N1.id, 20)),
        ],
        followed: 'a',
      }),
    );
    expect(count(pair.traffic.log, outfits[0])).toBe(1);
    expect(count(pair.traffic.log, outfits[1])).toBe(1);
    expect(pair.traffic.log.some((call) => call.fill === TUBE_PALETTE['GLASS.followWash'][0])).toBe(
      true,
    );
  });

  it('keeps every rider and parcel inside its glass, round corners, bends and stack tops', () => {
    // The sprite's boxes (not the highlight row, which is the glass's own colour) against the
    // ride's glass centreline: never further than the glass's half height, 2.5 px, plus the
    // half-pixel bend a straight sprite may take off a curve. Unclipped, the tail stood 13 px
    // out in the air past a corner and 7 px out of a stack's side.
    const outfit = '#A1233D';
    const { skin, hair } = person('r', outfit, riding(C1.id, N1.id, 0)).resident;
    const sprite = new Set<string>([
      outfit,
      `${outfit}40`,
      `${outfit}80`,
      skin,
      hair,
      TUBE_PALETTE.TROUSERS[0],
      TUBE_PALETTE['GLASS.wash'][0],
      TUBE_PALETTE['KRAFT.box'][0],
      `${TUBE_PALETTE['KRAFT.box'][0]}50`,
      TUBE_PALETTE['KRAFT.cap'][0],
      TUBE_PALETTE['KRAFT.string'][0],
    ]);
    const line = ROUTE.map((p) => {
      const g = project(p.x, p.y);
      return { x: g.x, y: g.y - p.h };
    });
    let furthest = 0,
      boxes = 0;
    // Both spurs (the stack tops, the legs, the corners, the dips and the elbows) and a stretch
    // of trunk, a rider one way and a parcel the other.
    for (let s = 0; s <= LENGTH; s += 0.01) {
      if (s > 7 && s < LENGTH - 7 && Math.round(s * 100) % 50 !== 0) continue;
      const m = matrixContext();
      const scene = sceneOf({
        residents: [person('r', outfit, riding(C1.id, N1.id, s))],
        parcels: () => [parcelAt('riding', N1.id, C1.id, 0.5, s)],
      });
      drawTubeTraffic(m.ctx, scene);
      // The sprites' painters only: the umbrella stand's rim shares the parcel cap's brass.
      for (const object of drawTubes(m.ctx, scene))
        if (object.part === 'spur' || object.part === 'stack') object.paint();
      for (const p of m.points) {
        if (p.call !== 'fillRect' || !sprite.has(String(m.calls[p.index].fillStyle))) continue;
        boxes++;
        const off = offLine(p, line);
        furthest = Math.max(furthest, off);
        expect(off, `${s.toFixed(2)} ${String(m.calls[p.index].fillStyle)}`).toBeLessThanOrEqual(
          3 + 1e-9,
        );
      }
    }
    expect(boxes).toBeGreaterThan(1000);
    expect(furthest).toBeGreaterThan(2);
    // Hedgerow to Kingfisher: round the north-west corner, along the north run, round the river's
    // head (where the glass doubles back on screen) and over the river on the bridge.
    const far = tubeRoute(C1.id, 'L15');
    const farLine = far.map((p) => {
      const g = project(p.x, p.y);
      return { x: g.x, y: g.y - p.h };
    });
    const farLength = tubeLength(C1.id, 'L15');
    const near = (s: number) => {
      const p = tubeAt(C1.id, 'L15', s).position;
      return (
        s < 7 ||
        s > farLength - 7 ||
        (p.y < 2 && (p.x < 2 || p.x > WORLD_WIDTH - 3)) ||
        Math.round(s * 100) % 100 === 0
      );
    };
    let checked = 0;
    for (let s = 0; s <= farLength; s += 0.02) {
      if (!near(s)) continue;
      const m = matrixContext();
      const scene = sceneOf({
        residents: [person('r', outfit, riding(C1.id, 'L15', s))],
        parcels: () => [],
      });
      drawTubeTraffic(m.ctx, scene);
      for (const object of drawTubes(m.ctx, scene))
        if (object.part === 'spur' || object.part === 'stack') object.paint();
      for (const p of m.points) {
        if (p.call !== 'fillRect' || !sprite.has(String(m.calls[p.index].fillStyle))) continue;
        checked++;
        const off = offLine(p, farLine);
        expect(off, `${s.toFixed(2)} ${String(m.calls[p.index].fillStyle)}`).toBeLessThanOrEqual(
          3 + 1e-9,
        );
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('keeps parcels on the pad, rising and dropping inside the stack', () => {
    for (const [stage, progress, station] of [
      ['sending', 0.3, C1],
      ['sending', 0.9, C1],
      ['arrived', 0.1, N1],
      ['arrived', 0.6, N1],
    ] as const) {
      const painted = paint(sceneOf({ parcels: () => [parcelAt(stage, C1.id, N1.id, progress)] }));
      const stack = parts(painted, 'stack', station.id)[0];
      const boxes = stack.log.filter(
        (call) => call.name === 'fillRect' && call.fill === TUBE_PALETTE['KRAFT.box'][0],
      );
      expect(boxes).toHaveLength(1);
      expect(stack.log.some((call) => call.name === 'clip')).toBe(true);
      expect(parts(painted, 'puff')).toHaveLength(0);
    }
    // A parcel on the pad stays there with neighbours boarding beside it, although the timetable
    // never puts them in one stack at once.
    const foot = project(C1.stack.x, C1.stack.y);
    const x = Math.round(foot.x),
      y = Math.round(foot.y);
    for (const count of [0, 1, 2]) {
      const m = matrixContext();
      const scene = sceneOf({
        residents: HEAVIEST.slice(0, count).map((look, i) =>
          person(`p${i}`, look.outfit, boarding(C1.id, N1.id, 0.97), look),
        ),
        parcels: () => [parcelAt('sending', C1.id, N1.id, 0.3)],
      });
      const stack = drawTubes(m.ctx, scene).find((o) => o.part === 'stack' && o.station === C1.id)!;
      const from = m.calls.length;
      stack.paint();
      const kraft = m.points.filter(
        (p) =>
          p.index >= from &&
          p.call === 'fillRect' &&
          m.calls[p.index].fillStyle === TUBE_PALETTE['KRAFT.box'][0],
      );
      expect(kraft, `${count}`).toHaveLength(4);
      for (const p of kraft) {
        expect(p.x, `${count}`).toBeGreaterThanOrEqual(x - 2);
        expect(p.x, `${count}`).toBeLessThanOrEqual(x + 3);
        expect(p.y, `${count}`).toBeGreaterThanOrEqual(y - 6);
        expect(p.y, `${count}`).toBeLessThanOrEqual(y - 3);
      }
    }
  });
});

describe('Boarding and stepping off', () => {
  const CLOSE = closeUp(C1.plot);
  const frame = (residents: ResidentState[]) => {
    const recorder = recordingContext();
    renderCity({
      ctx: recorder.ctx,
      width: 1440,
      height: 900,
      camera: CLOSE,
      places: [],
      selectedPlot: null,
      hoveredPlot: null,
      night: false,
      showPlots: false,
      residents,
      minutes: 720,
      day: SUMMER,
    });
    return recorder.calls;
  };
  const shadows = (calls: readonly RecordedCall[]) =>
    calls.filter(
      (call) =>
        call.name === 'ellipse' && call.args[0] === 0 && call.args[1] === 1 && call.args[3] === 2,
    ).length;
  const fills = (calls: readonly RecordedCall[], outfit: string) =>
    calls.filter((call) => call.fillStyle === outfit && call.name === 'fillRect').length;
  const alone = (look: ResidentState['resident']) => {
    const recorder = recordingContext();
    drawResident(recorder.ctx, look, 0, 0, 1.25, undefined, { shadow: false });
    return fills(recorder.calls, look.outfit);
  };

  it(
    'draws a figure in the stack once, from the stack, with no floating shadow',
    { timeout: 20_000 },
    () => {
      const empty = frame([]);
      for (const transit of [
        boarding(C1.id, N1.id, 0.85),
        boarding(C1.id, N1.id, 0.97),
        alighting(N1.id, C1.id, 0.03),
        alighting(N1.id, C1.id, 0.1),
      ]) {
        const figure = person('in-stack', '#A1233D', transit);
        const calls = frame([figure]);
        expect(fills(calls, '#A1233D'), `${transit.stage} ${transit.progress}`).toBe(
          alone(figure.resident),
        );
        expect(shadows(calls)).toBe(shadows(empty));
        const stack = parts(paint(sceneOf({ residents: [figure] })), 'stack', C1.id)[0];
        expect(fills(stack.calls, '#A1233D')).toBe(alone(figure.resident));
      }
      // Walking in, the ordinary resident loop draws them, shadow and all.
      const walker = person('walking', '#A1233D', boarding(C1.id, N1.id, 0.5));
      const calls = frame([walker]);
      expect(fills(calls, '#A1233D')).toBeGreaterThan(0);
      expect(shadows(calls)).toBe(shadows(empty) + 1);
      const stack = parts(paint(sceneOf({ residents: [walker] })), 'stack', C1.id)[0];
      expect(fills(stack.calls, '#A1233D')).toBe(0);
    },
  );

  it('stands two figures side by side, 3 px apart', () => {
    const figures = ['b', 'a'].map((id) => person(id, '#A1233D', boarding(C1.id, N1.id, 0.85)));
    const stack = parts(paint(sceneOf({ residents: figures })), 'stack', C1.id)[0];
    const x = Math.round(project(C1.stack.x, C1.stack.y).x);
    const offsets = stack.calls
      .filter((call) => call.name === 'transform')
      .map((call) => (call.args[4] as number) - x);
    expect(offsets).toEqual([-1.5, 1.5]);
    // A puff at the fwoomp, one for the two of them.
    const fwoomp = figures.map((f) => ({ ...f, transit: boarding(C1.id, N1.id, 0.97) }));
    expect(parts(paint(sceneOf({ residents: fwoomp })), 'puff')).toHaveLength(1);
  });
});

describe('Depth', () => {
  it('sorts the spur, the stacks, the sign and the stand in the documented order', () => {
    const spurs = TUBE_PIECES.filter((piece) => piece.layer === 'spur');
    const c1 = spurs.filter((piece) => piece.station === C1.id).map((piece) => piece.depth);
    const n1 = spurs.filter((piece) => piece.station === N1.id).map((piece) => piece.depth);
    const list = [
      15.708, 15.325, 14.942, 14.535, 14.105, 13.675, 13.245, 12.815, 12.375, 11.925, 11.475,
    ];
    expect(c1).toHaveLength(list.length);
    c1.forEach((depth, i) => expect(depth).toBeCloseTo(list[i], 3));
    // Willow Halt's spur, the same 44 rows further down the west run.
    expect(n1).toHaveLength(list.length);
    n1.forEach((depth, i) => expect(depth).toBeCloseTo(list[i] + 44, 3));
    // Hawthorn's I-spur runs north at 35.5 + y; the bank bridges east along their rows, the river
    // pieces behind the far-bank tree in front of them.
    const a9 = spurs.filter((piece) => piece.station === 'A9').map((piece) => piece.depth);
    expect(a9.length).toBeGreaterThan(0);
    for (const depth of a9) expect(depth).toBeLessThan(35.5 + 4.8);
    expect(Math.min(...a9)).toBeLessThan(35.5 + 1);
    for (const id of ['C15', 'L15', 'R15']) {
      const { dock } = tubeStation(id);
      const bridge = spurs.filter((piece) => piece.station === id);
      expect(bridge.length).toBeGreaterThan(0);
      for (const piece of bridge.filter((piece) => piece.points[0].x > WORLD_WIDTH - 2))
        expect(piece.depth).toBeLessThan(WORLD_WIDTH - 1 + dock.y + 1);
      // Walkers on the riverside road (x 61.5) sort in front of the glass over them from the
      // bridge's own row on, and behind it north of the row, as lane walkers do under a west spur.
      const road = bridge.find((piece) =>
        piece.points.some((p, i) => i > 0 && (piece.points[i - 1].x - 61.5) * (p.x - 61.5) <= 0),
      )!;
      expect([-0.45, 0, 0.45].map((dy) => 61.5 + dock.y + dy > road.depth)).toEqual([
        false,
        true,
        true,
      ]);
    }
    // The column-0 pieces go behind the row-12 edge tree; lane walkers sort around 12.815.
    for (const piece of spurs.filter((piece) => piece.points[0].x < 1 && piece.station === C1.id))
      expect(piece.depth).toBeLessThan(12);
    const straight = c1[7];
    expect([11.05, 11.5, 11.95].map((y) => 1.5 + y > straight)).toEqual([false, true, true]);
    const painted = paint(sceneOf());
    const depth = (part: TubeObject['part']) => parts(painted, part, C1.id)[0].object.depth;
    expect(depth('stack')).toBeCloseTo(16.3, 9);
    expect(depth('sign')).toBeCloseTo(17.35, 9);
    expect(depth('stand')).toBeCloseTo(16.1, 9);
    expect(depth('bubble')).toBeCloseTo(14.8, 9);
    expect(depth('post')).toBeCloseTo(11.87, 9);
    // Nothing behind the tree lines or on the far bank is ever a depth object.
    for (const piece of TUBE_PIECES)
      expect(piece.layer === 'ground').toBe(
        piece.points.every((p) => p.x <= 0.001 || p.y <= 0.001 || p.x >= WORLD_WIDTH - 1.001),
      );
    expect(parts(painted, 'spur')).toHaveLength(spurs.length);
    expect(painted.objects.every((o) => o.object.depth > 0)).toBe(true);
    // Pushed before the residents, so walkers win ties.
    const source = readFileSync('src/city/render.ts', 'utf8');
    const render = source.slice(source.indexOf('export function renderCity'));
    expect(render.indexOf('drawTubes(ctx, tube)')).toBeGreaterThan(0);
    expect(render.indexOf('drawTubes(ctx, tube)')).toBeLessThan(
      render.indexOf('for (const resident of residents)'),
    );
  });
});

describe('Marking one halt', () => {
  it('lights only the hovered or selected halt, and repaints only its rectangle', () => {
    const frame = (selectedPlot: string | null, hoveredPlot: string | null) => {
      vi.mocked(paintGroundLayer).mockClear();
      renderCity({
        ctx: recordingContext().ctx,
        width: 1440,
        height: 900,
        camera: WHOLE,
        places,
        selectedPlot,
        hoveredPlot,
        night: false,
        showPlots: false,
        minutes: 720,
        day: SUMMER,
      });
      const [, , paintGround, marks] = vi.mocked(paintGroundLayer).mock.lastCall!;
      const m = matrixContext();
      paintGround(m.ctx);
      // Each ground call with where it lands, in world px. A fill or a stroke lands where its
      // path does, and only the calls that paint carry their colour (a path is built under
      // whatever colour the plot before it left).
      const landing = m.calls.map((): MatrixPoint[] => []);
      for (const point of m.points) landing[point.index]?.push(point);
      const PAINTS = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText']);
      let path: MatrixPoint[] = [];
      const calls = m.calls.map(({ name, args, fillStyle }, index) => {
        if (name === 'beginPath') path = [];
        path.push(...landing[index]);
        const points = name === 'fill' || name === 'stroke' ? [...path] : landing[index];
        const colour = PAINTS.has(name) ? ` ${String(fillStyle)}` : '';
        return { call: `${name}(${args.map(String).join(',')})${colour}`, points };
      });
      return { calls, marks: marks! };
    };
    const quiet = frame(null, null);
    for (const [selected, hovered, id] of [
      [null, 'C15', 'C15'],
      ['A9', null, 'A9'],
      ['R1', 'N1', 'R1'],
    ] as const) {
      const marked = frame(selected, hovered);
      expect(marked.marks.key.trim().split(' ')).toContain(`tube:${id}`);
      // The halt's own plot, as render.ts repaints any plot, widened over its own glass in the
      // ground (see "lights the marked halt’s own glass").
      const area = tubeMarkArea(id);
      const c = plotCenter(getPlot(id)!);
      expect(area.left).toBeLessThanOrEqual(c.x - 112);
      expect(area.right).toBeGreaterThanOrEqual(c.x + 112);
      expect(area.top).toBeLessThanOrEqual(c.y - 58);
      expect(area.bottom).toBeGreaterThanOrEqual(c.y + 58);
      expect(marked.marks.areas(marked.marks.key)).toContainEqual(area);
      // The ground differs from the quiet one only inside the marked rectangles.
      const areas = marked.marks.areas(marked.marks.key)!;
      const outside = (list: typeof quiet.calls) =>
        list
          .filter(({ points }) =>
            points.some(
              (p) =>
                !areas.some(
                  (a) => p.x >= a.left && p.x <= a.right && p.y >= a.top && p.y <= a.bottom,
                ),
            ),
          )
          .map(({ call }) => call);
      expect(outside(marked.calls)).toEqual(outside(quiet.calls));
      expect(marked.calls.map(({ call }) => call)).not.toEqual(quiet.calls.map(({ call }) => call));
    }
    // A plain plot keeps its own rectangle; nothing marked, nothing to repaint.
    const plain = frame('B1', null);
    expect(plain.marks.areas(plain.marks.key)).toHaveLength(1);
    expect(quiet.marks.areas(quiet.marks.key)).toEqual([]);
  });

  it('lights the marked halt’s own glass and stack, never another’s', () => {
    const HALO = TUBE_PALETTE['GLASS.halo'][0];
    for (const zoom of [3, 0.7, 0.3])
      for (const station of TUBE_STATIONS) {
        const painted = paint(sceneOf({ zoom, emphasis: 'selected', station: station.id }));
        const halo = (o: Painted) => o.log.some((call) => call.fill === HALO);
        expect(painted.objects.filter(halo).every((o) => o.object.station === station.id)).toBe(
          true,
        );
        expect(parts(painted, 'spur', station.id).some(halo)).toBe(true);
        expect(parts(painted, 'stack', station.id).some(halo)).toBe(true);
        // Of the cached ground, only the halt's own elbows and T light, all inside the rectangle
        // the ground repaints for it; never a run of trunk.
        const area = tubeMarkArea(station.id);
        const lit = painted.ground.points.filter(
          (p) => painted.ground.calls[p.index]?.fillStyle === HALO,
        );
        expect(lit.length, `${station.id} ${zoom}`).toBeGreaterThan(0);
        for (const p of lit) {
          expect(p.x, station.id).toBeGreaterThanOrEqual(area.left);
          expect(p.x, station.id).toBeLessThanOrEqual(area.right);
          expect(p.y, station.id).toBeGreaterThanOrEqual(area.top);
          expect(p.y, station.id).toBeLessThanOrEqual(area.bottom);
        }
        const hovered = paint(sceneOf({ zoom, emphasis: 'hover', station: station.id }));
        expect(hovered.ground.calls.length).toBe(paint(sceneOf({ zoom })).ground.calls.length);
      }
    // The rectangle is no larger than it needs to be: its own plot, glass and T, and a margin.
    for (const station of TUBE_STATIONS) {
      const area = tubeMarkArea(station.id);
      expect(area.right - area.left, station.id).toBeLessThanOrEqual(400);
      expect(area.bottom - area.top, station.id).toBeLessThanOrEqual(220);
    }
  });
});

describe('The station plots', () => {
  it('keep their meadow and lose only the stake, the label and the outline', () => {
    // B1 stands empty for comparison, even once someone lives there.
    const town = places.filter((place) => place.plot !== 'B1');
    const paintGround = (showPlots: boolean) => {
      vi.mocked(drawMeadow).mockClear();
      vi.mocked(drawSproutStake).mockClear();
      const recorder = recordingContext();
      renderCity({
        ctx: recorder.ctx,
        width: 1440,
        height: 900,
        camera: WHOLE,
        places: town,
        selectedPlot: null,
        hoveredPlot: null,
        night: false,
        showPlots,
        minutes: 720,
        day: SUMMER,
      });
      return recorder.calls;
    };
    paintGround(false);
    const meadows = vi.mocked(drawMeadow).mock.calls.map((call) => call[1].id);
    for (const station of TUBE_STATIONS) expect(meadows).toContain(station.plot);
    const stakes = vi.mocked(drawSproutStake).mock.calls.map(([, x, y]) => `${x},${y}`);
    for (const station of TUBE_STATIONS) {
      const c = plotCenter(getPlot(station.plot)!);
      expect(stakes).not.toContain(`${c.x},${c.y}`);
    }
    const b1 = plotCenter(getPlot('B1')!);
    expect(stakes).toContain(`${b1.x},${b1.y}`);
    const labels = paintGround(true)
      .filter((call) => call.name === 'fillText')
      .map((call) => call.args[0]);
    for (const station of TUBE_STATIONS) expect(labels).not.toContain(station.plot);
    expect(labels).toContain('B1');
    const source = readFileSync('src/city/render.ts', 'utf8');
    expect(source).not.toMatch(/getImageData/);
  });
});

describe('Growing the line', () => {
  // Stations join TUBE_STATIONS in order north to south; the art is cut from each station's own
  // spur and the trunk between them, so any ride between any two lands in its own glass.
  const owner = (painter: TubePainter) =>
    painter.kind === 'stack'
      ? painter.station
      : painter.kind === 'spur'
        ? TUBE_PIECES[painter.piece].station
        : 'behind the trees';

  it('gives every station its own spur glass, and every ride its own stations’ glass', () => {
    for (const station of TUBE_STATIONS) {
      const own = TUBE_PIECES.filter((piece) => piece.station === station.id);
      expect(own.filter((piece) => piece.layer === 'spur').length, station.id).toBeGreaterThan(0);
      expect(own.filter((piece) => piece.layer === 'ground').length, station.id).toBeGreaterThan(0);
    }
    for (const a of TUBE_STATIONS)
      for (const b of TUBE_STATIONS) {
        if (a === b) continue;
        const ride = `${a.id}>${b.id}`;
        const length = tubeLength(a.id, b.id);
        expect(owner(tubePainterFor(a.id, b.id, 0.1)), ride).toBe(a.id);
        expect(owner(tubePainterFor(a.id, b.id, 0.3)), ride).toBe(a.id);
        expect(owner(tubePainterFor(a.id, b.id, length - 0.3)), ride).toBe(b.id);
        // A capsule a spur piece draws lies on that piece's own glass.
        for (let s = 0; s <= length; s += 0.02) {
          const painter = tubePainterFor(a.id, b.id, s);
          if (painter.kind !== 'spur') continue;
          const { position } = tubeAt(a.id, b.id, s);
          expect(offLine(position, TUBE_PIECES[painter.piece].points), `${ride} ${s}`).toBeLessThan(
            1e-9,
          );
        }
      }
  });

  it('runs one unbroken trunk from the first station’s elbow to the last’s', () => {
    const { S_N0, S_N1, S_E0 } = TRUNK_ARCS;
    const onRun = (p: Point) => p.x === TUBE_TRUNK_X || p.y === TUBE_TRUNK_Y || p.x === TUBE_BANK_X;
    const inCorner = (p: Point) =>
      (p.x < TUBE_TRUNK_X + 1 && p.y < TUBE_TRUNK_Y + 1) ||
      (p.x > TUBE_BANK_X - 1 && p.y < TUBE_TRUNK_Y + 1);
    const trunk = TUBE_PIECES.filter(
      (piece) => piece.points.length > 1 && piece.points.every((p) => onRun(p) || inCorner(p)),
    ).filter((piece) => onRun(piece.points[0]) && onRun(piece.points.at(-1)!));
    // One run between each two consecutive taps, corners included; the ends at the first and
    // last stations' elbows.
    expect(trunk).toHaveLength(TUBE_STATIONS.length - 1);
    expect(trunk.every((piece) => piece.layer === 'ground')).toBe(true);
    trunk.slice(1).forEach((piece, i) => expect(piece.points[0]).toEqual(trunk[i].points.at(-1)));
    TUBE_STATIONS.slice(1, -1).forEach((station, i) => {
      const at = trunkPoint(stationTap(station.id));
      expect(trunk[i].points.at(-1)!.x).toBeCloseTo(at.x, 9);
      expect(trunk[i].points.at(-1)!.y).toBeCloseTo(at.y, 9);
    });
    const first = TUBE_STATIONS[0],
      last = TUBE_STATIONS.at(-1)!;
    const elbowEnd = (from: string, to: string) => tubeRoute(from, to).find(onRun)!;
    expect(trunk[0].points[0]).toEqual(elbowEnd(first.id, last.id));
    expect(trunk.at(-1)!.points.at(-1)).toEqual(elbowEnd(last.id, first.id));
    // Round both corners, which only the C1–A9 and A9–C15 runs pass.
    const corners = trunk.filter((piece) => piece.points.some(inCorner));
    expect(corners.map((piece) => piece.station)).toEqual(['C1', 'A9']);
    for (const piece of corners) expect(piece.points.filter(inCorner)).toHaveLength(7);
    expect([S_N0, S_N1, S_E0].every((s) => trunkPoint(s).h > 0)).toBe(true);
    // Every segment of every ride, outside the stack tops, lies on some piece.
    for (const a of TUBE_STATIONS)
      for (const b of TUBE_STATIONS) {
        if (a === b) continue;
        const route = tubeRoute(a.id, b.id);
        for (let i = 1; i < route.length - 2; i++) {
          const mid = {
            x: (route[i].x + route[i + 1].x) / 2,
            y: (route[i].y + route[i + 1].y) / 2,
          };
          const off = Math.min(...TUBE_PIECES.map((piece) => offLine(mid, piece.points)));
          expect(off, `${a.id}>${b.id} ${i}`).toBeLessThan(1e-9);
        }
      }
  });
});

describe('Determinism', () => {
  it('paints the same frame for the same moment, from pure code', () => {
    const rides = tubeRides(places, SUMMER);
    for (const minutes of [720, rides[0].board + 1.95, rides[0].depart + 2.5, 1290]) {
      const a = paint(realScene(closeUp(C1.plot, 1), minutes, SUMMER));
      const b = paint(realScene(closeUp(C1.plot, 1), minutes, SUMMER));
      expect(trace(b.objects.flatMap((o) => o.calls))).toEqual(
        trace(a.objects.flatMap((o) => o.calls)),
      );
      expect(trace(b.traffic.calls)).toEqual(trace(a.traffic.calls));
    }
    const source = readFileSync('src/city/tubes.ts', 'utf8');
    expect(source).not.toMatch(/\bDate\b|Math\.random|localStorage|sessionStorage/);
  });

  it(
    'draws a real ride: into the stack, through the glass and out again',
    { timeout: 20_000 },
    () => {
      const ride = tubeRides(places, SUMMER)[0];
      const rider = (minutes: number) =>
        simulateResidents(places, minutes, SUMMER).find((r) => r.id === ride.residentId)!;
      const outfit = places.find((place) => place.id === ride.residentId)!.resident.outfit;
      const moments = [ride.board + 1.7, ride.depart + 0.3, ride.depart + 2.5, ride.off - 1.95];
      for (const minutes of moments) {
        const state = rider(minutes);
        expect(state.transit, `${minutes}`).toBeDefined();
        const painted = paint(realScene(WHOLE, minutes, SUMMER, { zoom: 3, visible: everywhere }));
        const drawn = painted.all.filter(
          (call) => call.name === 'fillRect' && call.fill === outfit,
        );
        expect(drawn.length, `${minutes}`).toBeGreaterThan(0);
      }
    },
  );
});

describe('The canvas transform', () => {
  it('comes back bit for bit after every part of the line, in a float32 matrix', () => {
    // Chrome keeps the 2D matrix in float32. Glass slices undone by an arithmetic inverse left it
    // a hair off (b about 1e-9, e and f about 5e-6 px), and every house after the glass then
    // missed its sprite (house-sprites.ts asks for the frame's exact matrix) and the football
    // and the district caches theirs (they ask for b = c = 0). Every object of the line must
    // hand the next one the frame's matrix exactly.
    const ride = tubeRides(places, SUMMER)[0];
    const residents = [
      ...simulateResidents(places, ride.depart + 0.3, SUMMER),
      person('fwoomp', '#A1233D', boarding(C1.id, N1.id, 0.97)),
      person('settling', '#789B76', alighting(N1.id, C1.id, 0.1)),
      person('riding', '#8392B1', riding(C1.id, N1.id, 1.6)),
    ];
    const cameras: [string, Camera, number, number][] = [
      ['whole town', WHOLE, 1440, 900],
      [
        'opening',
        openingView(
          places.map((place) => place.plot),
          1120,
          640,
        ),
        1120,
        640,
      ],
      ['west close-up', closeUp(C1.plot, 4), 1440, 900],
      ['bank close-up', closeUp('C15', 1.5), 1440, 900],
    ];
    let checked = 0;
    for (const [name, camera, width, height] of cameras)
      for (const emphasis of ['none', 'selected'] as const) {
        const m = matrixContext(width, height, { float32: true });
        m.ctx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.x, camera.y);
        const frame = m.matrix();
        const scene = sceneOf({
          minutes: ride.depart + 0.3,
          zoom: camera.zoom,
          visible: visibleFor(camera, width, height),
          emphasis,
          station: C1.id,
          residents,
          parcels: () => tubeParcelsAt(places, ride.depart + 0.3, SUMMER),
        });
        drawTubeGround(m.ctx, scene);
        expect(m.matrix(), `${name}: the ground`).toEqual(frame);
        drawTubeTraffic(m.ctx, scene);
        expect(m.matrix(), `${name}: the traffic`).toEqual(frame);
        for (const object of drawTubes(m.ctx, scene).sort((a, b) => a.depth - b.depth)) {
          object.paint();
          checked++;
          expect(m.matrix(), `${name} ${emphasis}: ${object.part} ${object.station}`).toEqual(
            frame,
          );
        }
      }
    expect(checked).toBeGreaterThan(100);
  });

  it('lets a house painted after the glass keep its sprite', () => {
    vi.stubGlobal('document', {
      createElement: () => ({ width: 300, height: 150, getContext: () => recordingContext().ctx }),
    });
    try {
      const camera = openingView(
        places.map((place) => place.plot),
        1120,
        640,
      );
      const m = matrixContext(1120, 640, { float32: true });
      m.ctx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.x, camera.y);
      const scene = sceneOf({ zoom: camera.zoom, visible: visibleFor(camera, 1120, 640) });
      const home = plotCenter(getPlot(HELLO_WORLD.plot)!);
      const frame = () => {
        const house = housePainter(m.ctx);
        for (const object of drawTubes(m.ctx, scene).sort((a, b) => a.depth - b.depth))
          object.paint();
        const before = m.calls.length;
        house(HELLO_WORLD, home.x, home.y, false, 1, { minutes: 720 });
        return m.calls.slice(before);
      };
      // The first frame cannot know the camera is resting and draws the house; from the second
      // the house is its sprite, copied whole after every spur, stack and sign of the line.
      expect(frame().some((call) => call.name === 'drawImage')).toBe(false);
      for (let k = 0; k < 3; k++) {
        const calls = frame();
        expect(
          calls.filter((call) => call.name === 'drawImage'),
          `frame ${k + 2}`,
        ).toHaveLength(1);
        expect(calls.map((call) => call.name)).toEqual([
          'getTransform',
          'save',
          'setTransform',
          'drawImage',
          'restore',
        ]);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
