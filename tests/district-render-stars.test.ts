// Render checks for stargazing and the snowmen: the props and the snowmen within their call
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
  rugDrifts,
  TELESCOPE,
  TELESCOPE_HEIGHT,
} from '../src/city/district/stargazing';
import {
  builderSnow,
  buildersAt,
  GREEN_CENTER,
  SCARVES,
  SNOWMAN_SPOTS,
  snowTrack,
  TRACK_BENDS,
  TRACK_START,
  TRACK_TIMES,
} from '../src/city/district/snowmen';
import { drawResident } from '../src/city/residents';
import { pick, SNOW } from '../src/city/season-palette';
import { METEOR_COLOUR } from '../src/city/sky-extras';
import { BRAND } from '../src/lib/brand';
import { SNOWMAN_DAYS, starNight } from '../src/lib/district-calendar';
import { BANDSTAND_FURNITURE, DISTRICT_SPOTS } from '../src/lib/district-places';
import { SNOWMEN_LUNCH } from '../src/lib/district-copy';
import { EVENT_SPOTS } from '../src/lib/events';
import { residentTrips, tripState } from '../src/lib/resident-trips';
import type { ResidentState } from '../src/lib/simulation';
import { project } from '../src/lib/world';
import { townSeasonAt } from '../src/lib/seasons';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { SAMPLE, TOWNS, YEAR } from './district';
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
    const scene = evening(SUMMER_27, 1390);
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

  it('leaves the front row’s way in clear of the back row’s rugs', () => {
    // The front row (y 44.15) walk in from the river side down their own x, between the back
    // row's rugs (y 44.75): a body's half-width (0.1) and a little more clear either side.
    const spots = DISTRICT_SPOTS.bandstand;
    const front = spots.filter((spot) => spot.y < 44.5),
      back = spots.filter((spot) => spot.y > 44.5);
    expect(front).toHaveLength(4);
    for (const way of front)
      for (const rug of back)
        expect(Math.abs(way.x - rug.x) - RUG.x / 2, `${way.x} by ${rug.x}`).toBeGreaterThanOrEqual(
          0.13,
        );
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
  });
});

describe('The rugs on a snowy night', () => {
  it('lie among drifts and frosted tufts along their back edges, not in a frame', () => {
    const winter1 = STAR_NIGHTS.find((d) => d - CALENDAR_EPOCH_DAY === 84)!;
    const snowy = (scene: DistrictScene) =>
      paint(STARS, scene).calls.filter(
        (call) =>
          call.name === 'fillRect' &&
          [SNOW.top, SNOW.frost].some((pair) => pick(pair, true) === call.fillStyle),
      );
    const scene = evening(winter1, 1390);
    expect(scene.season.snow).toBeGreaterThan(0.3);
    const tufts = snowy(scene);
    expect(tufts).toHaveLength(8 * 4);
    // The lawn's own tuft shapes: 4 × 2 drifts and 2 × 2 frost, never a rug-sized rim.
    for (const call of tufts) {
      const [, , w, h] = call.args as number[];
      expect([4, 2]).toContain(w);
      expect(h).toBe(2);
    }
    expect(tufts.some((call) => (call.args as number[])[2] === 2)).toBe(true);
    // Each on the lawn beside its own rug: under no rug, its own or a neighbor's.
    const spots = DISTRICT_SPOTS.bandstand;
    for (const [k, spot] of spots.entries())
      for (const drift of rugDrifts(k)) {
        const at = { x: spot.x + drift.x, y: spot.y + drift.y };
        expect(Math.hypot(drift.x, drift.y)).toBeLessThan(0.45);
        for (const s of spots)
          expect(Math.abs(at.x - s.x) > RUG.x / 2 || Math.abs(at.y - s.y) > RUG.y / 2).toBe(true);
      }
    // None on a summer night.
    expect(snowy(evening(SUMMER_27, 1390))).toHaveLength(0);
  });
});

/** The six at a snowman build day's lunch, as the planner places them at a minute. */
function lunchGuests(day: number) {
  const plans = residentTrips(TOWNS.full, day);
  const guests = [...plans].flatMap(([id, trips]) =>
    trips
      .filter((trip) => trip.event.variant === 'snowmen')
      .map((trip) => ({ home: TOWNS.full.find((place) => place.id === id)!, trip })),
  );
  return (minutes: number) =>
    guests.map(
      ({ home, trip }) =>
        ({
          id: home.id,
          home,
          resident: home.resident,
          ...tripState(home, trip, minutes, day),
        }) as ResidentState,
    );
}
/** Point t along the trail's whole curve, in tiles from the green's centre. */
const trailAt = (k: number, t: number) => {
  const [a, b, c] = [TRACK_START, TRACK_BENDS[k], SNOWMAN_SPOTS[k]];
  return {
    x: (1 - t) ** 2 * a.x + 2 * t * (1 - t) * b.x + t * t * c.x,
    y: (1 - t) ** 2 * a.y + 2 * t * (1 - t) * b.y + t * t * c.y,
  };
};

describe('A snowman build day', () => {
  it('leaves a trail of rolled snow from the builders to the snowball, off the picnic rug', () => {
    for (const [k, day] of BUILD_DAYS.entries()) {
      expect(snowTrack(day, 840)).toBeUndefined();
      expect(snowTrack(day, TRACK_TIMES.fade[1])).toBeUndefined();
      expect(snowTrack(day + 1, 870)).toBeUndefined();
      expect(snowTrack(day, 870)?.k).toBe(k);
      // It lengthens back from the ball as the base is rolled, then fades as the head goes on.
      let before = { from: 1, alpha: 0 };
      for (let minute = 840 + 1 / 30; minute < TRACK_TIMES.fade[1]; minute += 1 / 30) {
        const now = snowTrack(day, minute)!;
        expect(now.from).toBeLessThanOrEqual(before.from + 1e-9);
        expect(Math.abs(now.alpha - before.alpha), `${minute}`).toBeLessThanOrEqual(0.08);
        before = now;
      }
      expect(snowTrack(day, 890)).toMatchObject({ from: 0 });
      // From between the two builders to its snowman, never across the picnic rug (local x
      // −0.55..0.89, y −0.08..1.08) and never through a watcher's place.
      expect(trailAt(k, 1)).toEqual(SNOWMAN_SPOTS[k]);
      for (let t = 0; t <= 1; t += 0.01) {
        const p = trailAt(k, t);
        const onRug = p.x > -0.6 && p.x < 0.94 && p.y > -0.13 && p.y < 1.13;
        expect(onRug, `snowman ${k} at ${t}`).toBe(false);
        for (const spot of EVENT_SPOTS.green.slice(2))
          expect(Math.hypot(p.x - spot.x, p.y - spot.y)).toBeGreaterThan(0.3);
      }
    }
    // Nothing on the lawn on any other day.
    for (const day of YEAR.filter((d) => !BUILD_DAYS.includes(d)).slice(80, 100))
      for (const minute of [850, 900])
        expect(paint(SNOWMEN, sceneAt(day, minute)).calls.some((c) => c.name === 'stroke')).toBe(
          false,
        );
  });

  it('puts snow at the builders’ knees and in their hands, and keeps within 40 calls', () => {
    let heaps = 0,
      balls = 0,
      worst = 0;
    for (const day of BUILD_DAYS) {
      const guests = lunchGuests(day);
      expect(guests(900)).toHaveLength(6);
      for (let minute = 830; minute < 960; minute += 2.5) {
        const residents = guests(minute);
        const builders = buildersAt(residents, minute);
        if (minute < 840 || minute >= 945) expect(builders).toEqual([]);
        for (const builder of builders) {
          expect(builder.seat).toBeLessThanOrEqual(1);
          expect(builder.pose).toBe('crouch');
          heaps++;
        }
        // Up on their feet packing snow: the figure's own ball, drawn as snow (residents.ts).
        if (minute >= 840 && minute < 945)
          balls += residents.filter((resident) => resident.pose === 'play').length;
        for (const zoom of [1, 2.4]) {
          const calls = paint(SNOWMEN, { ...sceneAt(day, minute, zoom), residents }).calls.length;
          worst = Math.max(worst, calls);
          expect(calls, `${day} at ${minute}`).toBeLessThanOrEqual(40);
        }
      }
    }
    expect(heaps).toBeGreaterThan(20);
    expect(balls).toBeGreaterThan(20);
    expect(worst).toBeGreaterThan(30);
  });

  it('packs a snowball, not the lawn games’ ball, and heaps the snow by the toes', () => {
    const spot = EVENT_SPOTS.green[1];
    const builder = (
      pose: 'play' | 'crouch',
      walkPhase: number,
      facing: 'sw' | 'ne',
      name: string = SNOWMEN_LUNCH.name,
    ) =>
      ({
        id: 'builder',
        resident: SAMPLE.resident,
        position: { x: GREEN_CENTER.x + spot.x, y: GREEN_CENTER.y + spot.y },
        facing,
        walkPhase,
        pose,
        moving: false,
        greeting: false,
        event: { id: 'books', name, phase: 'attending' },
      }) as ResidentState;
    const GOLD = ['#D7AA63', '#F5DFA4'];
    /** The fills of the figure's ball: a 4-px square at x 7, at its bounce, and its 1-px edge. */
    const ballOf = (state: ResidentState, night = false) => {
      const { ctx, calls } = recordingContext();
      drawResident(ctx, state.resident, 0, 0, 1, state, { night });
      return calls.filter(
        (call) =>
          call.name === 'fillRect' &&
          [7, 9].includes((call.args as number[])[0]) &&
          (call.args as number[])[1] <= 0 &&
          ((call.args as number[])[2] === 4 || (call.args as number[])[3] === 1),
      );
    };
    for (let phase = 0; phase < 1; phase += 0.05)
      for (const night of [false, true]) {
        const fills = ballOf(builder('play', phase, 'sw'), night).map((call) => call.fillStyle);
        expect(fills).toEqual([pick(SNOW.top, night), pick(SNOW.shade, night)]);
        // Any other lunch keeps its gold ball.
        const games = ballOf(builder('play', phase, 'sw', 'Lawn games club'));
        expect(games.map((call) => call.fillStyle)).toEqual(GOLD);
      }
    // The heap lies on the lawn just past the toes, the way they face.
    const feet = project(GREEN_CENTER.x + spot.x, GREEN_CENTER.y + spot.y);
    for (const facing of ['sw', 'ne'] as const) {
      const heap = builderSnow(buildersAt([builder('crouch', 0, facing)], 870)[0]);
      expect(heap.y + heap.h).toBeLessThanOrEqual(feet.y + 1);
      expect(heap.y).toBeGreaterThanOrEqual(feet.y - 4);
      if (facing === 'sw') expect(heap.x + heap.w).toBeLessThanOrEqual(feet.x - 8);
      else expect(heap.x).toBeGreaterThanOrEqual(feet.x + 8);
    }
    // Nobody else's: a builder on their feet, a watcher, or a builder at another lunch.
    expect(buildersAt([builder('play', 0, 'sw')], 870)).toEqual([]);
    expect(buildersAt([{ ...builder('crouch', 0, 'sw'), event: undefined }], 870)).toEqual([]);
    expect(
      buildersAt(
        [
          {
            ...builder('crouch', 0, 'sw'),
            position: { x: GREEN_CENTER.x - 0.55, y: GREEN_CENTER.y + 0.85 },
          },
        ],
        870,
      ),
    ).toEqual([]);
  });
});

describe('The stargazing and snowmen colours', () => {
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
      evening(SUMMER_27, 1385),
      evening(SUMMER_27, 1390),
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
