// The Riverside's shared render checks (SPEC §6.6), with every cap final: each district painter
// draws nothing off-screen and keeps to its call cap at its year's busiest moments, the cached
// ground never reads the minute, nothing is amber by day, no light or awning flashes, a boat under
// the Kingfisher bridge stays in sight, and the frames that matter (the test camera box, the real
// opening frame, the whole town, the east live frames) stay within their budgets with every
// feature on, and the Bandstand lawn's two features (the bands' deckchairs, the stargazers' rugs
// and telescope) keep out of each other's way. Each feature agent adds its own checks in
// tests/district-render-<agent>.test.ts; none edits this file.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  DISTRICT_PAINTERS,
  type DepthObject,
  type DistrictGroundScene,
  type DistrictPainter,
  type DistrictScene,
} from '../src/city/district-art';
import { renderCity } from '../src/city/render';
import { chairOut, STACK as CHAIR_STACK, STAND } from '../src/city/district/bandstand';
import { astronomerAt, rugOut, TELESCOPE } from '../src/city/district/stargazing';
import { drawTubeGround, drawTubes, drawTubeTraffic, type TubeScene } from '../src/city/tubes';
import { regattaBoat, REGATTA_BOATS, starNight } from '../src/lib/district-calendar';
import { DISTRICT_FRAMES } from '../src/lib/district-places';
import { eventsForDay, VENUES } from '../src/lib/events';
import { liveCamera } from '../src/lib/live-director';
import { fitView, neighborhoodView } from '../src/lib/map-view';
import { residentTrips, tripState } from '../src/lib/resident-trips';
import type { Place } from '../src/lib/schema';
import { townSeasonAt } from '../src/lib/seasons';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { BRAND } from '../src/lib/brand';
import { CALENDAR_EPOCH_DAY, townCalendarAt } from '../src/lib/town-calendar';
import { TUBE_PALETTE } from '../src/city/tubes';
import { getPlot, plotCenter, project, WORLD_BOUNDS, type Point } from '../src/lib/world';
import { TOWNS } from './district';
import { FULL_TOWN_CREATOR, readPlaces } from './full-town';
import { matrixContext, type MatrixPoint } from './matrix-context';
import { recordingContext } from './recording-context';
import { openingViewBudget } from './render-budget';
import { rosterTimeout } from './roster-timeout';

const town: Place[] = TOWNS.full;
const published = readPlaces().filter((place) => place.creator !== FULL_TOWN_CREATOR);
const dayOf = (season: string, date: number) =>
  Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + i).find((day) => {
    const calendar = townCalendarAt(day);
    return calendar.season === season && calendar.date === date;
  })!;
const PLAIN = dayOf('Spring', 9),
  REGATTA = dayOf('Summer', 10),
  STARS = dayOf('Summer', 27),
  HARVEST = dayOf('Autumn', 23),
  SNOWMEN = dayOf('Winter', 11),
  BUILT = dayOf('Winter', 16);
// The busiest moments a sweep of the merged town's year found (every 2.5–5 minutes of each
// feature's days, at zoom 1 and 2.4): the farmers' autumn market (also a star night), a winter
// teatime set, the regatta's second day, the fair's second, the first winter star night and the
// last snowman's build.
const AUTUMN_1 = dayOf('Autumn', 1),
  WINTER_1 = dayOf('Winter', 1),
  WINTER_3 = dayOf('Winter', 3),
  WINTER_15 = dayOf('Winter', 15);
const isNight = (minutes: number) => minutes < 360 || minutes >= 1200;
const everywhere = () => true;
const nowhere = () => false;

/** What a painter sees at a moment of the full town, all of it in view at full detail. */
function sceneAt(day: number, minutes: number, visible = everywhere, zoom = 1): DistrictScene {
  return {
    day,
    minutes,
    night: isNight(minutes),
    season: townSeasonAt(day, minutes),
    zoom,
    visible,
    selected: null,
    hovered: null,
    places: town,
    residents: simulateResidents(town, minutes, day),
    plan: () => residentTrips(town, minutes < 360 ? day - 1 : day),
  };
}
const groundOf = (day: number, minutes: number, visible = everywhere): DistrictGroundScene => ({
  night: isNight(minutes),
  season: townSeasonAt(day, minutes),
  groundDay: townSeasonAt(day, minutes).groundDay,
  visible,
});

/**
 * The scene's residents with all twelve of the day's browsers at their stalls: each browses at
 * their own hour, so at any one minute only some are there (6.7 on average at 09:30–10:10).
 */
function withEveryBrowser(scene: DistrictScene) {
  const browsing = new Map<string, ResidentState>();
  for (const [id, trips] of scene.plan())
    for (const trip of trips)
      if (trip.event.outing === 'market') {
        const home = town.find((place) => place.id === id)!;
        const state = scene.residents.find((resident) => resident.id === id)!;
        browsing.set(id, {
          ...state,
          ...tripState(home, trip, Math.max(trip.arrive, trip.event.start) + 1, scene.day),
        });
      }
  expect(browsing.size).toBe(12);
  return scene.residents.map((resident) => browsing.get(resident.id) ?? resident);
}

type Draw = { name: string; fill: string; stroke: string; alpha: number };
/** A recorder that also notes the fill, the stroke and the alpha each call is made with. */
function capture() {
  const base = recordingContext(1280, 720);
  const target = base.ctx as unknown as Record<string, unknown>;
  const draws: Draw[] = [];
  const ctx = new Proxy(target, {
    get(object, key) {
      const value = object[key as string];
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        draws.push({
          name: String(key),
          fill: String(object.fillStyle),
          stroke: String(object.strokeStyle),
          alpha: Number(object.globalAlpha),
        });
        return (value as (...a: unknown[]) => unknown)(...args);
      };
    },
    set(object, key, value) {
      object[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls: base.calls, draws };
}
/** One painter's floor and objects at a scene, every object painted in depth order. */
function paintPainter(painter: DistrictPainter, scene: DistrictScene) {
  const recorder = capture();
  painter.floor?.(recorder.ctx, scene);
  const objects = painter.objects(recorder.ctx, scene).sort((a, b) => a.depth - b.depth);
  for (const object of objects) object.paint();
  return recorder;
}

describe('Each district painter', () => {
  it('draws nothing off-screen, and nothing in the ground that the minute could change', () => {
    for (const [id, painter] of Object.entries(DISTRICT_PAINTERS))
      for (const [day, minutes] of [
        [PLAIN, 600],
        [REGATTA, 930],
        [HARVEST, 1150],
        [STARS, 1380],
        [BUILT, 720],
      ]) {
        const off = paintPainter(painter, sceneAt(day, minutes, nowhere));
        expect(off.calls, `${id} on ${day} at ${minutes}`).toHaveLength(0);
        if (!painter.ground) continue;
        const hidden = capture();
        painter.ground(hidden.ctx, groundOf(day, minutes, nowhere));
        expect(hidden.calls, `${id}'s ground off-screen`).toHaveLength(0);
        // The ground layer is cached by the day: it is painted the same whenever it is asked.
        const [a, b] = [capture(), capture()];
        painter.ground(a.ctx, groundOf(day, minutes));
        painter.ground(b.ctx, groundOf(day, minutes));
        expect(a.calls, `${id}'s ground`).toEqual(b.calls);
      }
    // The ground's scene carries no minute at all.
    expectTypeOf<DistrictGroundScene>().not.toHaveProperty('minutes');
  });

  it(
    'keeps each feature’s art within its call cap, at full detail and in view',
    () => {
      const caps: [keyof typeof DISTRICT_PAINTERS, number, number, number][] = [
        // The market at 10:00, browsers at every stall.
        ['market', PLAIN, 600, 1_100],
        // The Bandstand with its players, at both sets.
        ['bandstand', PLAIN, 990, 500],
        ['bandstand', PLAIN, 1140, 500],
        // The rugs and the telescope under the stars.
        ['stargazing', STARS, 1380, 300],
        // The landing with all ten boats at the boom.
        ['landing', REGATTA, 945, 600],
        ['landing', REGATTA, 905, 600],
        // The fair, and the Long Table with its lamps lit.
        ['harvest', HARVEST, 900, 1_200],
        ['harvest', HARVEST, 1235, 1_200],
        // Four snowmen.
        ['snowmen', BUILT, 720, 40],
        // The busiest moment of each over the year, with the day's own guests where they are
        // (measured 1,039 and 1,042; 437; 246; 874; 204; 38).
        ['market', AUTUMN_1, 600, 1_100],
        ['market', AUTUMN_1, 685, 1_100],
        ['bandstand', WINTER_3, 960, 500],
        ['landing', REGATTA, 995, 600],
        ['harvest', HARVEST, 1195, 1_200],
        ['stargazing', WINTER_1, 1342.5, 300],
        ['snowmen', WINTER_15, 900, 40],
      ];
      for (const [id, day, minutes, cap] of caps)
        for (const zoom of [1, 2.4]) {
          const scene = sceneAt(day, minutes, everywhere, zoom);
          const calls = paintPainter(
            DISTRICT_PAINTERS[id],
            id === 'market' && minutes === 600
              ? { ...scene, residents: withEveryBrowser(scene) }
              : scene,
          ).calls.length;
          expect(calls, `${id} on ${day} at ${minutes}, zoom ${zoom}`).toBeLessThanOrEqual(cap);
        }
    },
    rosterTimeout(0.2, 30_000),
  );

  it('keeps amber for lit lamps: nothing glows by day, nor on a star night', () => {
    const AMBER = new Set(
      [BRAND.lantern, BRAND.glow, BRAND.lanternInk, ...TUBE_PALETTE['LAMP.lit']].map((colour) =>
        colour.toUpperCase(),
      ),
    );
    /** A bright warm colour: what the eye reads as lamplight. */
    const amberLike = (colour: string) => {
      if (AMBER.has(colour.toUpperCase().slice(0, 7))) return true;
      if (!/^#[0-9A-F]{6}/i.test(colour)) return false;
      const n = parseInt(colour.slice(1, 7), 16);
      const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
      return r >= 0xe0 && g >= 0xb0 && g <= 0xea && b <= 0xb8 && r - b >= 0x40;
    };
    const glowing: string[] = [];
    for (const [day, minutes] of [
      [PLAIN, 600],
      [PLAIN, 990],
      [REGATTA, 930],
      [HARVEST, 900],
      [BUILT, 720],
      // The Bandstand's lamp stays dark for the stargazers, and the stars bring no amber.
      [STARS, 1380],
    ])
      for (const [id, painter] of Object.entries(DISTRICT_PAINTERS)) {
        const recorder = paintPainter(painter, sceneAt(day, minutes));
        painter.ground?.(recorder.ctx, groundOf(day, minutes));
        painter.sky?.(recorder.ctx, {
          day,
          minutes,
          night: isNight(minutes),
          width: 1280,
          height: 720,
        });
        for (const draw of recorder.draws)
          for (const colour of [draw.fill, draw.stroke])
            if (amberLike(colour)) glowing.push(`${id} on ${day} at ${minutes}: ${colour}`);
      }
    expect(glowing.slice(0, 5)).toEqual([]);
  });

  it(
    'never flashes: lamps, awnings and meteors change their alpha at most 0.08 a frame',
    () => {
      // One real second is one town minute; a frame is 1/30 of it.
      const FRAME = 1 / 30;
      const windows: [keyof typeof DISTRICT_PAINTERS, number, number, number][] = [
        ['market', PLAIN, 430, 460], // the awnings unroll
        ['market', PLAIN, 690, 720], // and pack away
        ['bandstand', PLAIN, 1170, 1230], // the peak lamp lights in the streetlamp wave
        ['harvest', HARVEST, 1215, 1240], // the table lamps light
        ['harvest', HARVEST, 1250, 1265], // and go out
      ];
      let compared = 0;
      const jumps: string[] = [];
      for (const [id, day, from, to] of windows) {
        const painter = DISTRICT_PAINTERS[id];
        let before: Draw[] | undefined;
        for (let minutes = from; minutes < to; minutes += FRAME) {
          const scene = { ...sceneAt(day, minutes), residents: [] };
          const { draws } = paintPainter(painter, scene);
          if (
            before &&
            before.length === draws.length &&
            before.every((d, i) => d.name === draws[i].name)
          )
            draws.forEach((draw, i) => {
              compared++;
              if (Math.abs(draw.alpha - before![i].alpha) > 0.08 + 1e-9)
                jumps.push(`${id} at ${minutes.toFixed(3)}: ${before![i].alpha} → ${draw.alpha}`);
            });
          before = draws;
        }
      }
      // The summer meteors, across a whole star night, in the sky.
      for (const painter of Object.values(DISTRICT_PAINTERS)) {
        if (!painter.sky) continue;
        let before: Draw[] | undefined;
        for (let minutes = 1260; minutes < 1800; minutes += FRAME) {
          const recorder = capture();
          painter.sky(recorder.ctx, {
            day: STARS + Math.floor(minutes / 1440),
            minutes: minutes % 1440,
            night: true,
            width: 1280,
            height: 720,
          });
          const draws = recorder.draws;
          if (before && before.length === draws.length)
            draws.forEach((draw, i) => {
              compared++;
              if (Math.abs(draw.alpha - before![i].alpha) > 0.08 + 1e-9)
                jumps.push(`sky at ${minutes.toFixed(3)}: ${before![i].alpha} → ${draw.alpha}`);
            });
          before = draws;
        }
      }
      expect(jumps.slice(0, 5)).toEqual([]);
      // With every feature's art in, these windows compare millions of draws; none would mean the
      // check had gone quiet.
      expect(compared).toBeGreaterThan(0);
    },
    rosterTimeout(0.3, 60_000),
  );
});

describe('A paper boat under the Kingfisher bridge', () => {
  it('is never covered by anything drawn after it', () => {
    // Every depth object the frame sorts near the bridge: the Riverside's and the Treeline's.
    const recorder = matrixContext(1280, 720);
    let checked = 0;
    for (let minutes = 900; minutes <= 932; minutes += 0.5) {
      const under = Array.from({ length: REGATTA_BOATS }, (_, k) =>
        regattaBoat(k, REGATTA, minutes),
      ).filter((boat) => boat && boat.y >= 47 && boat.y <= 48);
      if (!under.length) continue;
      const scene = sceneAt(REGATTA, minutes);
      const tube: TubeScene = {
        minutes,
        day: REGATTA,
        night: false,
        season: scene.season,
        zoom: 1,
        emphasis: 'none',
        station: null,
        visible: everywhere,
        residents: scene.residents,
        parcels: () => [],
      };
      const tagged: { object: DepthObject; landing: boolean }[] = [
        ...drawTubes(recorder.ctx, tube).map((object) => ({ object, landing: false })),
        ...Object.entries(DISTRICT_PAINTERS).flatMap(([id, painter]) =>
          painter
            .objects(recorder.ctx, scene)
            .map((object) => ({ object, landing: id === 'landing' })),
        ),
      ].sort((a, b) => a.object.depth - b.object.depth);
      // What each object paints, in world px.
      const painted = tagged.map(({ object, landing }) => {
        const start = recorder.points.length;
        object.paint();
        return { landing, points: recorder.points.slice(start) as MatrixPoint[] };
      });
      for (const boat of under) {
        const at = project(boat!.x, boat!.y);
        painted.forEach(({ landing, points }, index) => {
          // The boat's own object: the landing's, painting at the boat.
          if (!landing || !points.some((p) => Math.hypot(p.x - at.x, p.y - at.y) < 4)) return;
          const near = points.filter((p) => Math.hypot(p.x - at.x, p.y - at.y) < 6);
          const box = {
            left: Math.min(...near.map((p) => p.x)),
            right: Math.max(...near.map((p) => p.x)),
            top: Math.min(...near.map((p) => p.y)),
            bottom: Math.max(...near.map((p) => p.y)),
          };
          checked++;
          for (const later of painted.slice(index + 1))
            expect(
              later.points.some(
                (p) => p.x > box.left && p.x < box.right && p.y > box.top && p.y < box.bottom,
              ),
              `a boat at ${boat!.y.toFixed(2)} at ${minutes}`,
            ).toBe(false);
        });
      }
    }
    // The landing draws its boats under the bridge (122 checks in all), so some must be checked.
    expect(checked).toBeGreaterThan(0);
  });
});

/**
 * The real opening frame shows more of the town than the test camera box (1440 × 900 at zoom
 * 0.7) that openingViewBudget is measured on: about 2.2 times the world area at 1120 × 640 and
 * 2.1 times on a phone, so 58,000 calls before any Riverside art. Its budget is the opening
 * view's, grown by that area.
 */
const openingFrameBudget = (
  houses: number,
  camera: { zoom: number },
  width: number,
  height: number,
) =>
  (openingViewBudget(houses) * ((width / camera.zoom) * (height / camera.zoom))) /
  ((1440 / 0.7) * (900 / 0.7));
/** Canvas calls of a whole frame of the town. */
function frameCalls(options: {
  width: number;
  height: number;
  camera: { x: number; y: number; zoom: number };
  homes: Place[];
  day: number;
  minutes: number;
}) {
  const { ctx, calls } = recordingContext(options.width, options.height);
  renderCity({
    ctx,
    width: options.width,
    height: options.height,
    camera: options.camera,
    places: options.homes,
    selectedPlot: null,
    hoveredPlot: null,
    night: isNight(options.minutes),
    showPlots: false,
    residents: simulateResidents(options.homes, options.minutes, options.day),
    events: eventsForDay(options.day, options.minutes),
    minutes: options.minutes,
    day: options.day,
  });
  return calls.length;
}
/** The Treeline's calls in a camera's view, as render.ts paints them. */
function tubeCalls(
  camera: { x: number; y: number; zoom: number },
  width: number,
  height: number,
  homes: Place[],
  day: number,
  minutes: number,
) {
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
  const { ctx, calls } = recordingContext(width, height);
  const scene: TubeScene = {
    minutes,
    day,
    night: isNight(minutes),
    season: townSeasonAt(day, minutes),
    zoom: camera.zoom,
    emphasis: 'none',
    station: null,
    visible,
    residents: simulateResidents(homes, minutes, day),
    parcels: () => [],
  };
  drawTubeGround(ctx, scene);
  drawTubeTraffic(ctx, scene);
  for (const object of drawTubes(ctx, scene).sort((a, b) => a.depth - b.depth)) object.paint();
  return calls.length;
}

describe('The frames that matter, with every feature on', () => {
  it(
    'keeps the test camera box within the opening budget, summer and winter',
    () => {
      for (const [day, minutes] of [
        [REGATTA, 900],
        [REGATTA, 1205],
        [SNOWMEN, 870],
        [SNOWMEN, 1205],
      ])
        expect(
          frameCalls({
            width: 1440,
            height: 900,
            camera: { x: 720, y: 88, zoom: 0.7 },
            homes: town,
            day,
            minutes,
          }),
          `${day} at ${minutes}`,
        ).toBeLessThan(openingViewBudget(town.length));
    },
    rosterTimeout(0.3, 60_000),
  );

  it(
    'keeps the real opening frame within budget, on a desktop and on a phone',
    () => {
      // The published homes, the green and the stage, framed as City.tsx frames them (§2.4).
      const points = [
        ...published.map((place) => place.plot),
        ...VENUES.filter((venue) => venue.kind === 'green' || venue.kind === 'stage').map(
          (venue) => venue.plot,
        ),
      ].map((id) => plotCenter(getPlot(id)!));
      for (const [width, height] of [
        [1120, 640],
        [390, 440],
      ]) {
        const camera = neighborhoodView(
          points,
          width,
          height,
          fitView(width, height, WORLD_BOUNDS),
        );
        // The market live at 10:00; the hood lamps lit at 20:10.
        for (const minutes of [600, 1210]) {
          const where = `${width} × ${height} at ${minutes}`;
          expect(
            frameCalls({ width, height, camera, homes: published, day: PLAIN, minutes }),
            where,
          ).toBeLessThan(openingFrameBudget(published.length, camera, width, height));
          expect(
            tubeCalls(camera, width, height, published, PLAIN, minutes),
            where,
          ).toBeLessThanOrEqual(250);
        }
      }
    },
    rosterTimeout(0.3, 60_000),
  );

  it(
    'keeps the whole full town at fit, and every east live frame, within budget',
    () => {
      const whole = fitView(1440, 900, WORLD_BOUNDS);
      // Spring noon and evening; the busiest found, snow on the ground with all four snowmen
      // (measured 142,653) and the Long Table with every dish out (136,796).
      for (const [day, minutes] of [
        [PLAIN, 720],
        [PLAIN, 1205],
        [BUILT, 720],
        [HARVEST, 1195],
      ])
        expect(
          frameCalls({ width: 1440, height: 900, camera: whole, homes: town, day, minutes }),
          `whole town on ${day} at ${minutes}`,
        ).toBeLessThanOrEqual(150_000);
      // One moment of each shot, then each shot's busiest over its days, every 2.5 minutes of
      // its window (measured 17,068; 14,601; 15,100; 14,725; 13,941; 12,977).
      for (const [name, day, minutes] of [
        ['market', PLAIN, 600],
        ['bandstand', PLAIN, 980],
        ['bandstand', STARS, 1400],
        ['regatta', REGATTA, 920],
        ['harvest', HARVEST, 920],
        ['harvest', HARVEST, 1234],
        ['market', AUTUMN_1, 595],
        ['bandstand', REGATTA, 997.5],
        ['regatta', REGATTA + 1, 935],
        ['harvest', HARVEST + 1, 927.5],
        ['harvest', HARVEST + 1, 1224],
        ['bandstand', AUTUMN_1, 1415],
      ] as const) {
        const frame = DISTRICT_FRAMES[name];
        expect(frame.width).toBeLessThanOrEqual(850);
        expect(frame.height).toBeLessThanOrEqual(540);
        const camera = liveCamera({ id: name, kind: 'event', label: name, ...frame }, 1280, 720);
        expect(
          frameCalls({ width: 1280, height: 720, camera, homes: town, day, minutes }),
          `${name} live at ${minutes}`,
        ).toBeLessThanOrEqual(20_000);
      }
    },
    rosterTimeout(0.5, 120_000),
  );
});

describe('The Bandstand lawn, shared by the bands and the stargazers', () => {
  const nights = Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + i).filter(starNight);

  it('keeps the telescope and the astronomer clear of the stand and the stacked deckchairs', () => {
    expect(nights).toHaveLength(12);
    // The stack is about 0.3 tiles across and the stand's plinth 0.72 round its centre.
    const clear = (point: Point, what: string) => {
      expect(
        Math.hypot(point.x - CHAIR_STACK.x, point.y - CHAIR_STACK.y),
        `${what}, from the stack`,
      ).toBeGreaterThanOrEqual(0.6);
      expect(
        Math.hypot(point.x - STAND.x, point.y - STAND.y),
        `${what}, from the stand`,
      ).toBeGreaterThanOrEqual(1);
    };
    clear(TELESCOPE, 'the telescope');
    let seen = 0;
    for (const night of nights)
      for (let evening = 1300; evening < 1500; evening += 0.1) {
        const now = astronomerAt(evening >= 1440 ? night + 1 : night, evening % 1440);
        if (!now) continue;
        seen++;
        clear(now.at, `the astronomer on ${night} at ${evening.toFixed(1)}`);
      }
    expect(seen).toBeGreaterThan(0);
  });

  it('never has a deckchair and a rug out on one spot at once', () => {
    for (const night of nights)
      for (let evening = 900; evening < 1500; evening += 0.25)
        for (let k = 0; k < 8; k++)
          expect(
            chairOut(k, evening % 1440) > 0 && rugOut(k, evening) > 0,
            `spot ${k} on ${night} at ${evening}`,
          ).toBe(false);
  });
});

describe('The Riverside’s code', () => {
  /** Every new src file of the Riverside (SPEC §6.6). */
  const files = [
    ...readdirSync('src/lib')
      .filter((file) => /^district-.*\.ts$/.test(file))
      .map((file) => `src/lib/${file}`),
    'src/lib/outings.ts',
    ...readdirSync('src/lib/outings').map((file) => `src/lib/outings/${file}`),
    'src/city/district-art.ts',
    ...readdirSync('src/city/district').map((file) => `src/city/district/${file}`),
    'src/city/carry-items.ts',
    ...readdirSync('src/city/carry').map((file) => `src/city/carry/${file}`),
    'src/city/sky-extras.ts',
    'src/music/bandstand-tracks.ts',
  ];

  it('runs on the town clock: no Math.random, Date or performance.now', () => {
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      // Code only: the headers say what is not allowed.
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/Math\.random|Date\.now|new Date\b|performance\.now/);
    }
  });
});
