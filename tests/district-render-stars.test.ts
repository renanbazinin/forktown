// Agent E's render checks (SPEC §6.6): the stargazing props and the snowmen within their call
// caps at every moment they are out, nothing off-screen, the static art painted once by season day
// and night, their heights, their depths, no amber and no flashing.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DistrictPainter, DistrictScene } from '../src/city/district-art';
import { DISTRICT_PAINTERS } from '../src/city/district-art';
import {
  ASTRONOMER,
  astronomerAt,
  FLASKS,
  flaskAt,
  RUG,
  TELESCOPE,
  TELESCOPE_HEIGHT,
} from '../src/city/district/stargazing';
import { GREEN_CENTER, SCARVES, SNOWMAN_SPOTS } from '../src/city/district/snowmen';
import { METEOR_COLOUR } from '../src/city/sky-extras';
import { BRAND } from '../src/lib/brand';
import { SNOWMAN_DAYS, starNight } from '../src/lib/district-calendar';
import { BANDSTAND_FURNITURE, DISTRICT_SPOTS } from '../src/lib/district-places';
import { VENUES } from '../src/lib/events';
import { getPlot, project } from '../src/lib/world';
import { townSeasonAt } from '../src/lib/seasons';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { YEAR } from './district';
import { matrixContext } from './matrix-context';
import { recordingContext } from './recording-context';

const STARS = DISTRICT_PAINTERS.stargazing,
  SNOWMEN = DISTRICT_PAINTERS.snowmen;
const STAR_NIGHTS = YEAR.filter(starNight);
const SUMMER_27 = STAR_NIGHTS.find((day) => day - CALENDAR_EPOCH_DAY === 54)!;
const BUILD_DAYS = SNOWMAN_DAYS.map((d) => CALENDAR_EPOCH_DAY + d);
const isNight = (minutes: number) => minutes < 360 || minutes >= 1200;
const everywhere = () => true;
const nowhere = () => false;

/** A painter's scene at a moment. Neither painter reads the residents or the plan. */
function sceneAt(day: number, minutes: number, zoom = 1, visible = everywhere): DistrictScene {
  return {
    day,
    minutes,
    night: isNight(minutes),
    season: townSeasonAt(day, minutes),
    zoom,
    visible,
    selected: null,
    hovered: null,
    places: [],
    residents: [],
    plan: () => new Map(),
  };
}
/** A moment of a star night's evening: 00:20 is minute 1460 of the night before. */
const evening = (night: number, minute: number, zoom = 1) =>
  sceneAt(minute >= 1440 ? night + 1 : night, minute % 1440, zoom);
/** Floor and objects, every object painted in depth order. */
function paint(painter: DistrictPainter, scene: DistrictScene, ctx = recordingContext(1280, 720)) {
  painter.floor?.(ctx.ctx, scene);
  const objects = painter.objects(ctx.ctx, scene).sort((a, b) => a.depth - b.depth);
  for (const object of objects) object.paint();
  return { ...ctx, objects };
}

describe('The stargazing props', () => {
  it('keep within 300 calls whenever they are out, and draw nothing else or off-screen', () => {
    let worst = 0;
    for (const night of STAR_NIGHTS)
      for (let minute = 1290; minute < 1490; minute += 2.5)
        for (const zoom of [0.3, 1, 2.4]) {
          const calls = paint(STARS, evening(night, minute, zoom)).calls.length;
          worst = Math.max(worst, calls);
          const { from, to } = BANDSTAND_FURNITURE.rugs;
          if (minute < from || minute >= to) expect(calls).toBe(0);
          expect(paint(STARS, { ...evening(night, minute), visible: nowhere }).calls).toHaveLength(
            0,
          );
        }
    expect(worst).toBeGreaterThan(50);
    expect(worst).toBeLessThanOrEqual(300);
    // Nothing on the other nights.
    for (const day of YEAR.slice(0, 40).filter((d) => !starNight(d) && !starNight(d - 1)))
      for (const minute of [1320, 1400, 1460])
        expect(paint(STARS, evening(day, minute)).calls).toHaveLength(0);
  });

  it('lays the rugs as floor paint and sorts the flasks, telescope and astronomer by their feet', () => {
    const scene = evening(SUMMER_27, 1393);
    const { objects } = paint(STARS, scene);
    const astronomer = astronomerAt(scene.day, scene.minutes)!;
    expect(objects.map((object) => object.depth).sort()).toEqual(
      [
        TELESCOPE.x + TELESCOPE.y,
        astronomer.at.x + astronomer.at.y,
        ...FLASKS.map((k) => flaskAt(k).x + flaskAt(k).y),
      ].sort(),
    );
    // Each flask stands at its own rug's back corner, behind the neighbor sat on it.
    for (const k of FLASKS) {
      const spot = DISTRICT_SPOTS.bandstand[k];
      expect(Math.abs(flaskAt(k).x - spot.x)).toBeLessThan(RUG.x / 2);
      expect(flaskAt(k).y).toBeLessThan(spot.y);
    }
    // At the eyepiece the astronomer stands just in front of the telescope.
    expect(astronomer.pose).toBe('peer');
    expect(astronomer.at.x + astronomer.at.y).toBeGreaterThan(TELESCOPE.x + TELESCOPE.y);
  });

  it('keeps the telescope under 24 px', () => {
    const recorder = matrixContext(1280, 720);
    const scene = evening(SUMMER_27, 1400);
    const telescope = STARS.objects(recorder.ctx, scene).find(
      (object) => object.depth === TELESCOPE.x + TELESCOPE.y,
    )!;
    telescope.paint();
    const foot = project(TELESCOPE.x, TELESCOPE.y);
    const top = Math.min(...recorder.points.map((point) => point.y));
    expect(foot.y - top).toBeLessThanOrEqual(TELESCOPE_HEIGHT);
    expect(foot.y - top).toBeGreaterThan(18);
  });

  it('fades the telescope and the astronomer in and out, never in a frame', () => {
    const FRAME = 1 / 30;
    for (const [from, to] of [
      [1308, 1323],
      [1466, 1477],
    ]) {
      let before: number[] | undefined;
      for (let minute = from; minute < to; minute += FRAME) {
        const recorder = recordingContext(1280, 720);
        const alphas: number[] = [];
        const ctx = new Proxy(recorder.ctx, {
          get(target, key) {
            const value = target[key as keyof typeof target];
            if (typeof value !== 'function') return value;
            return (...args: unknown[]) => {
              alphas.push(target.globalAlpha);
              return (value as (...a: unknown[]) => unknown)(...args);
            };
          },
        }) as CanvasRenderingContext2D;
        const scene = evening(SUMMER_27, minute);
        // The objects only: the rugs unroll rather than fade.
        for (const object of STARS.objects(ctx, scene).sort((a, b) => a.depth - b.depth))
          object.paint();
        if (before && before.length === alphas.length)
          alphas.forEach((alpha, i) =>
            expect(Math.abs(alpha - before![i]), `${minute.toFixed(3)}`).toBeLessThanOrEqual(
              0.08 + 1e-9,
            ),
          );
        // Whatever first appears, appears faint.
        if (before && !before.length && alphas.length)
          expect(Math.max(...alphas)).toBeLessThanOrEqual(0.08 + 1e-9);
        before = alphas;
      }
    }
  });
});

describe('The snowmen', () => {
  it('keep within 40 calls for all four, at every moment of the winter, and draw nothing off-screen', () => {
    let worst = 0;
    for (let day = BUILD_DAYS[0]; day < BUILD_DAYS[0] + 28; day++)
      for (let minute = 0; minute < 1440; minute += 30)
        for (const zoom of [0.3, 1, 2.4]) {
          const calls = paint(SNOWMEN, sceneAt(day, minute, zoom)).calls.length;
          worst = Math.max(worst, calls);
          expect(paint(SNOWMEN, sceneAt(day, minute, zoom, nowhere)).calls).toHaveLength(0);
        }
    expect(worst).toBeGreaterThan(20);
    expect(worst).toBeLessThanOrEqual(40);
    // None the rest of the year.
    for (const day of YEAR.slice(0, 84).filter((_, i) => i % 7 === 0))
      expect(paint(SNOWMEN, sceneAt(day, 720)).calls).toHaveLength(0);
  });

  it('stand about 22 px tall and no taller, on their own spots', () => {
    const recorder = matrixContext(1280, 720);
    const objects = SNOWMEN.objects(recorder.ctx, sceneAt(BUILD_DAYS[3] + 1, 720));
    expect(objects).toHaveLength(4);
    for (const [k, object] of objects.entries()) {
      const start = recorder.points.length;
      object.paint();
      const points = recorder.points.slice(start);
      const spot = SNOWMAN_SPOTS[k];
      const feet = project(GREEN_CENTER.x + spot.x, GREEN_CENTER.y + spot.y);
      const top = Math.min(...points.map((point) => point.y));
      expect(feet.y - top).toBeLessThanOrEqual(22.5);
      expect(feet.y - top).toBeGreaterThanOrEqual(19);
      // Sorted just ahead of its own ground point, so whatever stands in front of it covers it.
      expect(object.depth).toBeCloseTo(GREEN_CENTER.x + spot.x + GREEN_CENTER.y + spot.y - 0.02);
    }
    // The one behind the lemonade table sorts before the green, whose table stands in front of it.
    const green = getPlot(VENUES.find((venue) => venue.kind === 'green')!.plot)!;
    expect(objects[1].depth).toBeLessThan(green.x + green.y + 0.1);
  });
});

describe('Agent E’s colours', () => {
  /** A bright warm colour: what the eye reads as lamplight (district-render.test's rule). */
  const AMBER = new Set([BRAND.lantern, BRAND.glow, BRAND.lanternInk].map((c) => c.toUpperCase()));
  const amberLike = (colour: string) => {
    if (AMBER.has(colour.toUpperCase().slice(0, 7))) return true;
    if (!/^#[0-9A-F]{6}/i.test(colour)) return false;
    const n = parseInt(colour.slice(1, 7), 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
    return r >= 0xe0 && g >= 0xb0 && g <= 0xea && b <= 0xb8 && r - b >= 0x40;
  };

  it('are never amber: rugs, brass, the astronomer, snow, scarves and meteors', () => {
    const colours = new Set<string>([METEOR_COLOUR, ...SCARVES.flat()]);
    for (const value of Object.values(ASTRONOMER))
      if (typeof value === 'string' && value.startsWith('#')) colours.add(value);
    const collect = (scene: DistrictScene) => {
      const recorder = recordingContext(1280, 720);
      const seen: string[] = [];
      const ctx = new Proxy(recorder.ctx, {
        set(target, key, value) {
          if (key === 'fillStyle' || key === 'strokeStyle' || key === 'shadowColor')
            seen.push(String(value));
          (target as unknown as Record<string, unknown>)[key as string] = value;
          return true;
        },
      }) as CanvasRenderingContext2D;
      paint(STARS, scene, { ...recorder, ctx });
      paint(SNOWMEN, scene, { ...recorder, ctx });
      return seen;
    };
    for (const scene of [
      evening(SUMMER_27, 1312),
      evening(SUMMER_27, 1388.5),
      evening(SUMMER_27, 1393),
      evening(
        STAR_NIGHTS.find((d) => d - CALENDAR_EPOCH_DAY === 84)!,
        1390,
      ),
      sceneAt(BUILD_DAYS[0], 870),
      sceneAt(BUILD_DAYS[3] + 1, 720),
      sceneAt(BUILD_DAYS[3] + 1, 1320),
      sceneAt(BUILD_DAYS[0] + 25, 720),
    ])
      for (const colour of collect(scene)) colours.add(colour);
    expect(colours.size).toBeGreaterThan(20);
    expect([...colours].filter(amberLike)).toEqual([]);
  });
});

describe('Static art', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is painted once by kind, season day and night, and copied after that', () => {
    const made: ReturnType<typeof recordingContext>[] = [];
    vi.stubGlobal('document', {
      createElement: () => {
        const layer = recordingContext(64, 64);
        made.push(layer);
        return { width: 0, height: 0, getContext: () => layer.ctx };
      },
    });
    const main = recordingContext(1280, 720);
    const frame = (scene: DistrictScene) => {
      const start = main.calls.length;
      paint(STARS, scene, main);
      return main.calls.slice(start);
    };
    const painted = () => made.reduce((sum, layer) => sum + layer.calls.length, 0);
    // The first full night frame makes a sprite of the rugs and one of the telescope.
    const first = frame(evening(SUMMER_27, 1393));
    expect(made).toHaveLength(2);
    expect(first.filter((call) => call.name === 'drawImage')).toHaveLength(2);
    const once = painted();
    expect(once).toBeGreaterThan(60);
    // The rest of the night copies them: no new sprite, no repaint, two copies and the astronomer.
    for (const minute of [1400, 1420, 1450]) {
      const calls = frame(evening(SUMMER_27, minute));
      expect(calls.filter((call) => call.name === 'drawImage')).toHaveLength(2);
      expect(calls.length).toBeLessThan(80);
    }
    expect(made).toHaveLength(2);
    expect(painted()).toBe(once);
    // The next night looks the same, so it copies them too; a snowy winter night paints the rugs
    // afresh, into the same sprite.
    frame(evening(SUMMER_27 + 1, 1393));
    expect(painted()).toBe(once);
    frame(
      evening(
        STAR_NIGHTS.find((d) => d - CALENDAR_EPOCH_DAY === 84)!,
        1393,
      ),
    );
    expect(made).toHaveLength(2);
    expect(painted()).toBeGreaterThan(once);
    // While the rugs unroll, they are painted directly.
    const unrolling = frame(evening(SUMMER_27, 1312));
    expect(unrolling.filter((call) => call.name === 'fillRect').length).toBeGreaterThan(10);
  });
});
