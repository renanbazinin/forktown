import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { drawMeadow } from '../src/city/ambience';
import { lampOn, MAX_LAMP_DISTANCE, MIN_LAMP_DISTANCE } from '../src/city/lamplight';
import { drawSproutStake } from '../src/city/lantern-post';
import { renderCity } from '../src/city/render';
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
  tubePainterFor,
  type TubeObject,
  type TubePainter,
  type TubeScene,
} from '../src/city/tubes';
import { FORK_PLOT } from '../src/lib/lanterns';
import { placeSchema, residentSchema } from '../src/lib/schema';
import { seedFraction, snowAt, townSeasonAt } from '../src/lib/seasons';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { tubeParcelsAt, tubeRides, type TubeParcelState } from '../src/lib/tube-traffic';
import {
  TUBE_ALIGHT,
  TUBE_ALIGHT_STEPS,
  TUBE_ALTITUDE,
  TUBE_BOARD,
  TUBE_BOARD_STEPS,
  TUBE_SIGN_LINES,
  TUBE_STATIONS,
  TUBE_TRUNK_X,
  tubeAt,
  tubeLength,
  tubeRoute,
  tubeStation,
  type ResidentTransit,
} from '../src/lib/tubes';
import { WORLD_BOUNDS, getPlot, plotCenter, project, type Point } from '../src/lib/world';
import { matrixContext, type MatrixPoint } from './matrix-context';
import { recordingContext, type RecordedCall } from './recording-context';

// The meadow test spies on the ground paint; both mocks call straight through.
vi.mock('../src/city/ambience', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/city/ambience')>();
  return { ...actual, drawMeadow: vi.fn(actual.drawMeadow) };
});
vi.mock('../src/city/lantern-post', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/city/lantern-post')>();
  return { ...actual, drawSproutStake: vi.fn(actual.drawSproutStake) };
});

// The Treeline through the renderer's eyes: quiet in the opening view, within its call caps,
// low, with no snow on the glass and amber only in a lit lamp, the sign word for word, every
// rider drawn by exactly one painter and inside its glass, figures in a stack drawn once with no
// floating shadow, the depth order of docs/TUBES.md, glass built from every station, the meadow
// kept, and the same frame every time.

const places = readdirSync('places')
  .filter((file) => file.endsWith('.json'))
  .map((file) => placeSchema.parse(JSON.parse(readFileSync(`places/${file}`, 'utf8'))));
const [C1, N1] = TUBE_STATIONS;
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

const base = simulateResidents(places, 402)[0];
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

type Logged = { name: string; args: unknown[]; fill: string; alpha: number; font: string };
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
    expect(none.ground.calls.length).toBeLessThanOrEqual(60);
    const selected = paint(realScene(OPENING, 720, 3, { emphasis: 'selected' }));
    expect(selected.total).toBeLessThanOrEqual(290);
    expect(selected.total).toBeGreaterThan(none.total);
    const hover = paint(realScene(OPENING, 720, 3, { emphasis: 'hover' }));
    expect(hover.total).toBe(none.total);
    const whole = paint(realScene(WHOLE, 720, 3));
    expect(WHOLE.zoom).toBeCloseTo(0.28, 2);
    expect(parts(whole, 'stack')).toHaveLength(2);
    expect(whole.total).toBeLessThanOrEqual(420);
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
            expect(painted.total, `${minutes}`).toBeLessThanOrEqual(camera === WHOLE ? 420 : 250);
            expect(painted.alpha).toBe(1);
          }
        }
      expect(most).toBeGreaterThan(0);
    },
  );
});

describe('The Treeline’s parts', () => {
  it('keeps every part within its call cap', { timeout: 20_000 }, () => {
    for (const emphasis of ['none', 'selected'] as const) {
      const painted = paint(sceneOf({ emphasis }));
      for (const station of TUBE_STATIONS) {
        const glass = callsOf(parts(painted, 'spur', station.id));
        expect(glass).toBeGreaterThan(0);
        expect(glass).toBeLessThanOrEqual(emphasis === 'none' ? 90 : 110);
        for (const bubble of parts(painted, 'bubble', station.id))
          expect(bubble.calls.length).toBeLessThanOrEqual(8);
        for (const post of parts(painted, 'post', station.id))
          expect(post.calls.length).toBeLessThanOrEqual(3);
      }
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
    const trunk = winter.ground.points.filter((p) => p.x < start.x - 1 && p.x > end.x + 1);
    expect(trunk.length).toBeGreaterThan(0);
    for (const p of trunk) expect(start.y - 0.5 * (p.x - start.x) - p.y).toBeLessThanOrEqual(11);
    // Every glass fillRect is the 5-px tube, or its 8-px halo when selected.
    for (const emphasis of ['none', 'selected'] as const) {
      const painted = paint(sceneOf({ emphasis }));
      const glass = [
        ...painted.ground.log,
        ...parts(painted, 'spur').flatMap((o) => o.log),
        ...parts(painted, 'bubble').flatMap((o) => o.log),
      ].filter((call) => call.name === 'fillRect' && GLASS_COLOURS.has(call.fill));
      expect(glass.length).toBeGreaterThan(0);
      for (const call of glass)
        expect(Math.abs(call.args[3] as number)).toBeLessThanOrEqual(emphasis === 'none' ? 5 : 8);
    }
    // Walkers on the lane (x = 1.5, 31 px tall) pass under the glass: the whole straight, from
    // the corner to the lane's west edge, is at full height.
    expect(TUBE_ALTITUDE.spur - TUBE_ALTITUDE.radius - 31).toBeGreaterThanOrEqual(5.5);
    for (const station of TUBE_STATIONS) {
      const straight = ROUTE.filter(
        (p) => p.y === station.dock.y && p.x >= 1.35 - 1e-9 && p.x <= station.dock.x,
      );
      expect(straight.length).toBeGreaterThan(2);
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
    expect(TUBE_TRUNK_POSTS.map((post) => post.y)).toEqual(
      Array.from({ length: 10 }, (_, k) => 15.5 + 4 * k),
    );
    expect(TUBE_TRUNK_POSTS.every((post) => post.x === TUBE_TRUNK_X)).toBe(true);
    // Mid-block, on the rows where a station between two others would put its T, and never on
    // a station's own row.
    for (const post of TUBE_TRUNK_POSTS) {
      expect((post.y - 3.5) % 4).toBe(0);
      expect(TUBE_STATIONS.some((station) => station.dock.y === post.y)).toBe(false);
    }
    const posts = parts(paint(sceneOf()), 'post');
    expect(posts).toHaveLength(TUBE_STATIONS.length);
    for (const post of posts) expect(post.object.ground.x).toBeLessThan(1);
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
  it('says it word for word at the first station only, in the same ink lit or not', () => {
    for (const minutes of [720, 1205, 1290]) {
      const painted = paint(sceneOf({ minutes }));
      const signs = parts(painted, 'sign');
      expect(signs).toHaveLength(1);
      expect(signs[0].object.station).toBe(C1.id);
      const text = signs[0].log.filter((call) => call.name === 'fillText');
      expect(text.map((call) => call.args[0])).toEqual([...TUBE_SIGN_LINES]);
      for (const call of text) expect(call.font).toBe('bold 4px "Space Mono", monospace');
      expect(new Set(text.map((call) => call.fill))).toEqual(
        new Set([TUBE_PALETTE['PLATE.ink'][isNight(minutes) ? 1 : 0]]),
      );
      const others = painted.objects.filter((o) => o.object.station === N1.id);
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
    const expected = [
      `stack ${C1.id}`,
      ...TUBE_PIECES.map((piece, i) => (piece.layer === 'spur' ? `spur ${i}` : 'traffic')),
      `stack ${N1.id}`,
    ].filter((k, i, list) => i === 0 || k !== list[i - 1]);
    for (const [from, to] of [
      [C1.id, N1.id],
      [N1.id, C1.id],
    ]) {
      const seen: string[] = [];
      for (let s = 0; s <= LENGTH + 1e-9; s += 0.01) {
        const k = key(tubePainterFor(from, to, s));
        if (seen.at(-1) !== k) seen.push(k);
      }
      expect(seen).toEqual(from === C1.id ? expected : [...expected].reverse());
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
    const south = [
      55.475, 55.925, 56.375, 56.815, 57.245, 57.675, 58.105, 58.535, 58.942, 59.325, 59.708,
    ];
    n1.forEach((depth, i) => expect(depth).toBeCloseTo(south[i], 3));
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
    // Nothing behind the tree line is ever a depth object.
    for (const piece of TUBE_PIECES)
      expect(piece.layer === 'ground').toBe(piece.points.every((p) => p.x <= 0.001));
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

describe('The station plots', () => {
  it('keep their meadow and lose only the stake, the label and the outline', () => {
    const paintGround = (showPlots: boolean) => {
      vi.mocked(drawMeadow).mockClear();
      vi.mocked(drawSproutStake).mockClear();
      const recorder = recordingContext();
      renderCity({
        ctx: recorder.ctx,
        width: 1440,
        height: 900,
        camera: WHOLE,
        places,
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
    const trunk = TUBE_PIECES.filter((piece) => piece.points.every((p) => p.x === TUBE_TRUNK_X));
    // One run between each two stations, and one between a middle station's two elbows.
    expect(trunk).toHaveLength(2 * TUBE_STATIONS.length - 3);
    expect(trunk.every((piece) => piece.layer === 'ground')).toBe(true);
    trunk.slice(1).forEach((piece, i) => expect(piece.points[0]).toEqual(trunk[i].points.at(-1)));
    const onTrunk = (from: string, to: string) =>
      tubeRoute(from, to).find((p) => p.x === TUBE_TRUNK_X)!;
    const last = TUBE_STATIONS.at(-1)!;
    expect(trunk[0].points[0]).toEqual(onTrunk(C1.id, last.id));
    expect(trunk.at(-1)!.points.at(-1)).toEqual(onTrunk(last.id, C1.id));
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
