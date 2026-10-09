// Render checks for the Bandstand and the Boat Landing, beyond the shared ones in
// district-render.test.ts. The stand is painted from two cached layers kept by the night and the
// season's day; it stands 40 px at most; the caps hold for every band and every hour; deckchairs sit
// under their guests with their backs over them; the peak lamp lights in the streetlamp wave and
// never on a star night; nothing but a lit lamp is amber; nothing flashes; and both venues answer a
// click on what rises over their neighbors.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DistrictPainter, DistrictScene } from '../src/city/district-art';
import {
  BAND_BPM,
  BANDSTAND_HEIGHT,
  bandstandPainter,
  chairOut,
  PEAK_LAMP_LIGHTS,
  peakLamp,
  PLAYERS,
  restingAt,
  sittersLow,
  STAND,
  STAND_DEPTH,
} from '../src/city/district/bandstand';
import { landingPainter } from '../src/city/district/landing';
import { MAX_LAMP_DISTANCE } from '../src/city/lamplight';
import { BANDSTAND_TRACKS } from '../src/music/bandstand-tracks';
import { bandOf, BANDS, starNight, type Band } from '../src/lib/district-calendar';
import {
  BANDSTAND_FURNITURE,
  BANDSTAND_VENUE,
  DISTRICT_SPOTS,
  LANDING_VENUE,
  REGATTA_COURSE,
} from '../src/lib/district-places';
import { residentTrips } from '../src/lib/resident-trips';
import { townSeasonAt } from '../src/lib/seasons';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY, townCalendarAt } from '../src/lib/town-calendar';
import { project } from '../src/lib/world';
import { TOWNS } from './district';
import { matrixContext } from './matrix-context';
import { recordingContext } from './recording-context';
import { rosterTimeout } from './roster-timeout';
import { frameJumps, type Draw } from './flash';

const town = TOWNS.full;
const dayOf = (season: string, date: number) =>
  Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + i).find((day) => {
    const calendar = townCalendarAt(day);
    return calendar.season === season && calendar.date === date;
  })!;
const PLAIN = dayOf('Spring', 9),
  REGATTA = dayOf('Summer', 10),
  STARS = dayOf('Summer', 27),
  WINTER = dayOf('Winter', 12);
/** A day of each band in spring, with a moon in the sky. */
const BAND_DAYS = Object.fromEntries(
  BANDS.map((band) => [
    band,
    Array.from({ length: 28 }, (_, i) => dayOf('Spring', i + 1)).find(
      (d) => bandOf(d) === band && !starNight(d),
    )!,
  ]),
) as Record<Band, number>;
const isNight = (minutes: number) => minutes < 360 || minutes >= 1200;
const everywhere = () => true;

function sceneAt(day: number, minutes: number, zoom = 1, residents = true): DistrictScene {
  return {
    day,
    minutes,
    night: isNight(minutes),
    season: townSeasonAt(day, minutes),
    zoom,
    visible: everywhere,
    selected: null,
    hovered: null,
    places: town,
    residents: residents ? simulateResidents(town, minutes, day) : [],
    plan: () => residentTrips(town, minutes < 360 ? day - 1 : day),
  };
}
/** A recorder that also notes the fill and the alpha each call is made with. */
function capture(ctx = recordingContext(1280, 720)) {
  const target = ctx.ctx as unknown as Record<string, unknown>;
  const draws: Draw[] = [];
  const proxy = new Proxy(target, {
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
  return { ctx: proxy, calls: ctx.calls, draws };
}
function paint(painter: DistrictPainter, scene: DistrictScene, ctx = capture()) {
  painter.floor?.(ctx.ctx, scene);
  for (const object of painter.objects(ctx.ctx, scene).sort((a, b) => a.depth - b.depth))
    object.paint();
  return ctx;
}

describe('The Bandstand’s art', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('paints the stand from two cached layers, kept by the night and the season’s day', () => {
    // A document whose canvases record what is painted on them.
    const layers: { calls: unknown[] }[] = [];
    vi.stubGlobal('document', {
      createElement: () => {
        const offscreen = recordingContext(1, 1);
        layers.push(offscreen);
        return { width: 0, height: 0, getContext: () => offscreen.ctx };
      },
    });
    let scale = 2;
    const base = recordingContext(1280, 720);
    const map = new Proxy(base.ctx as object, {
      get: (target, key) =>
        key === 'getTransform'
          ? () => ({ a: scale, b: 0, c: 0, d: scale, e: 10, f: 20 })
          : Reflect.get(target, key),
      set: (target, key, value) => Reflect.set(target, key, value),
    }) as CanvasRenderingContext2D;
    const stand = (day: number, minutes: number) => {
      for (const object of bandstandPainter.objects(map, sceneAt(day, minutes, 1, false)))
        if (object.depth === STAND_DEPTH) object.paint();
    };
    const painted = () => layers.map((layer) => layer.calls.length);
    const images = () => base.calls.filter((call) => call.name === 'drawImage').length;

    stand(PLAIN, 600);
    expect(layers).toHaveLength(2);
    const first = painted();
    expect(first.every((calls) => calls > 20)).toBe(true);
    expect(images()).toBe(2);
    // Another minute of the same day, with the band playing: the copies are only drawn.
    stand(PLAIN, 980);
    stand(PLAIN, 1100);
    expect(painted()).toEqual(first);
    expect(images()).toBe(6);
    // Night repaints both; the next day repaints the cap (its petals and leaves), not the deck.
    stand(PLAIN, 1300);
    const night = painted();
    expect(night[0]).toBeGreaterThan(first[0]);
    expect(night[1]).toBeGreaterThan(first[1]);
    stand(PLAIN + 1, 1300);
    expect(painted()[0]).toBe(night[0]);
    expect(painted()[1]).toBeGreaterThan(night[1]);
    // A new zoom paints straight onto the map until it has held for three frames.
    const settled = painted();
    scale = 2.5;
    stand(PLAIN + 1, 1301);
    stand(PLAIN + 1, 1302);
    expect(painted()).toEqual(settled);
    stand(PLAIN + 1, 1303);
    expect(painted()[0]).toBeGreaterThan(settled[0]);
  });

  it('stands 40 px tall at most, its cap and peak lamp included', () => {
    expect(BANDSTAND_HEIGHT).toBeLessThanOrEqual(40);
    const ground = project(STAND.x, STAND.y);
    // The top of the stand is its peak lamp, over the centre: by day, lit at night, and with snow.
    for (const [day, minutes] of [
      [PLAIN, 600],
      [PLAIN, 1300],
      [WINTER, 700],
    ]) {
      const { ctx, points } = matrixContext(1280, 720);
      for (const object of bandstandPainter.objects(ctx, sceneAt(day, minutes, 1, false)))
        if (object.depth === STAND_DEPTH) object.paint();
      const centre = points.filter((p) => p.call !== 'drawImage' && Math.abs(p.x - ground.x) < 4);
      expect(centre.length).toBeGreaterThan(5);
      expect(Math.min(...centre.map((p) => p.y))).toBeGreaterThanOrEqual(ground.y - 40 - 1e-9);
    }
  });

  it(
    'keeps to its call caps for every band, at both sets, at tea and after dark',
    () => {
      for (const band of BANDS)
        for (const minutes of [950, 980, 1070, 1140, 1206, 1240])
          for (const zoom of [1, 2.4]) {
            const calls = paint(bandstandPainter, sceneAt(BAND_DAYS[band], minutes, zoom)).calls
              .length;
            expect(calls, `${band} at ${minutes}, zoom ${zoom}`).toBeLessThanOrEqual(500);
          }
      for (const minutes of [980, 1140])
        expect(paint(bandstandPainter, sceneAt(WINTER, minutes)).calls.length).toBeLessThan(500);
      for (let minutes = 820; minutes <= 1035; minutes += 5)
        expect(
          paint(landingPainter, sceneAt(REGATTA, minutes, 2.4)).calls.length,
          `landing at ${minutes}`,
        ).toBeLessThanOrEqual(600);
    },
    rosterTimeout(0.3, 60_000),
  );

  it('sets each deckchair just under its guest, its striped back just over them', () => {
    const objects = bandstandPainter.objects(recordingContext().ctx, sceneAt(PLAIN, 980));
    const depths = objects.map((object) => object.depth);
    for (const spot of DISTRICT_SPOTS.bandstand) {
      const guest = spot.x + spot.y;
      expect(depths.some((depth) => Math.abs(depth - (guest - 0.01)) < 1e-9)).toBe(true);
      expect(depths.some((depth) => Math.abs(depth - (guest + 0.01)) < 1e-9)).toBe(true);
    }
    // Out by 15:35 and still out at 20:20, for every chair; stacked by the stand otherwise.
    const { from, to } = BANDSTAND_FURNITURE.chairs;
    DISTRICT_SPOTS.bandstand.forEach((_, k) => {
      expect(chairOut(k, from)).toBe(1);
      expect(chairOut(k, to)).toBe(1);
      expect(chairOut(k, from - 9)).toBe(0);
      expect(chairOut(k, to + 9)).toBe(0);
    });
    // One chair on the move at a time.
    for (let minutes = from - 10; minutes < to + 10; minutes += 0.05) {
      const moving = DISTRICT_SPOTS.bandstand.filter((_, k) => {
        const out = chairOut(k, minutes);
        return out > 0 && out < 1;
      });
      expect(moving.length).toBeLessThanOrEqual(1);
    }
  });

  it('lets a deckchair’s back down for a guest low in the canvas, at no cost in calls', () => {
    const [first, second, third, fourth] = DISTRICT_SPOTS.bandstand;
    const guest = (
      spot: { x: number; y: number },
      pose: ResidentState['pose'],
      phase: 'waiting' | 'attending' | 'returning' = 'attending',
      id = 'bandstand-sundown',
    ) =>
      ({
        position: { x: spot.x, y: spot.y },
        pose,
        event: { id, name: '', phase },
      }) as ResidentState;
    const drops = sittersLow([
      guest(first, 'sip'),
      guest(second, 'perch'),
      guest(third, 'crouch', 'attending', 'bandstand-tea'),
      guest(fourth, 'sit', 'returning'),
    ]);
    // Sunk low with a drink: let down a notch. Perched: the back meets the shoulders. Halfway
    // down: between. On the way home, or an empty chair: as it stands.
    expect(drops.slice(0, 4)).toEqual([5, 0, 2, 0]);
    expect(drops.slice(4).every((drop) => drop === 0)).toBe(true);
    // The guests' poses move the backs, never add to the calls.
    for (const minutes of [980, 1170]) {
      const day = BAND_DAYS.folk;
      const withGuests = paint(bandstandPainter, sceneAt(day, minutes)).calls.length;
      const empty = paint(bandstandPainter, sceneAt(day, minutes, 1, false)).calls.length;
      expect(withGuests).toBe(empty);
    }
  });

  it('sets the instruments down in sight at tea, gently, and takes them up again', () => {
    const { teaFrom, teaTo } = PLAYERS;
    expect(restingAt(teaFrom)).toBe(0);
    expect(restingAt(teaFrom + 0.2)).toBe(0);
    expect(restingAt(teaFrom + 0.75)).toBe(1);
    expect(restingAt((teaFrom + teaTo) / 2)).toBe(1);
    expect(restingAt(teaTo - 0.2)).toBe(0);
    expect(restingAt(teaTo + 5)).toBe(0);
    let before = 0;
    for (let minutes = teaFrom - 1; minutes < teaTo + 1; minutes += 1 / 30) {
      const shown = restingAt(minutes);
      expect(Math.abs(shown - before)).toBeLessThanOrEqual(0.08);
      before = shown;
    }
  });

  it('hangs the Regatta Week bunting as one unbroken line, and none out of the week', () => {
    const rope = (day: number) => {
      const { ctx, calls } = recordingContext(1280, 720);
      for (const object of landingPainter.objects(ctx, sceneAt(day, 600, 1, false))) object.paint();
      return calls
        .filter((call) => call.name === 'fillRect' && String(call.fillStyle) === '#8C7A5E')
        .map((call) => {
          const [x, , w] = call.args as number[];
          return [x + call.offset.x, x + call.offset.x + w] as const;
        })
        .sort((a, b) => a[0] - b[0]);
    };
    const runs = rope(REGATTA);
    expect(runs.length).toBeGreaterThan(5);
    // Each run of the line picks up where the last left off: no gaps, no dots.
    for (let i = 1; i < runs.length; i++) expect(runs[i][0]).toBeLessThanOrEqual(runs[i - 1][1]);
    expect(runs.at(-1)![1] - runs[0][0]).toBeGreaterThan(40);
    expect(rope(PLAIN)).toEqual([]);
  });

  it('lights the peak lamp in the streetlamp wave until 06:00, never on a star night', () => {
    expect(PEAK_LAMP_LIGHTS).toBeGreaterThanOrEqual(1220);
    expect(PEAK_LAMP_LIGHTS).toBeLessThanOrEqual(1230);
    expect(MAX_LAMP_DISTANCE).toBeGreaterThan(0);
    const plain = BAND_DAYS.brass;
    expect(starNight(plain)).toBe(false);
    expect(peakLamp(plain, 1210, true)).toBe(0);
    expect(peakLamp(plain, PEAK_LAMP_LIGHTS + 1, true)).toBe(1);
    // After midnight it still belongs to the evening before, until 06:00.
    expect(peakLamp(plain + 1, 300, true)).toBe(1);
    // By day, and in the day look of the dusk fade, never.
    expect(peakLamp(plain, 1250, false)).toBe(0);
    expect(peakLamp(plain, 720, false)).toBe(0);
    // Dark for the stargazers, all night long.
    for (const minutes of [1230, 1300, 1380, 1439])
      expect(peakLamp(STARS, minutes, true), `${minutes}`).toBe(0);
    expect(peakLamp(STARS + 1, 120, true)).toBe(0);
    // It warms up over a minute: never more than 0.08 a frame.
    let before = 0;
    for (let minutes = 1215; minutes < 1235; minutes += 1 / 30) {
      const lit = peakLamp(plain, minutes, true);
      expect(Math.abs(lit - before)).toBeLessThanOrEqual(0.08);
      before = lit;
    }
  });

  it(
    'keeps amber for its lit lamp alone, day and night, in every season',
    () => {
      const LIT = new Set(['#F4D79A', '#FFF6D8']);
      const amberLike = (colour: string) => {
        if (!/^#[0-9A-F]{6}/i.test(colour)) return false;
        const n = parseInt(colour.slice(1, 7), 16);
        const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
        return r >= 0xe0 && g >= 0xb0 && g <= 0xea && b <= 0xb8 && r - b >= 0x40;
      };
      const found: string[] = [];
      for (const day of [
        BAND_DAYS.brass,
        BAND_DAYS.folk,
        BAND_DAYS.strings,
        REGATTA,
        STARS,
        WINTER,
      ])
        for (let minutes = 0; minutes < 1440; minutes += 30) {
          // One scene a moment for both painters: the full town is simulated once, not twice.
          const scene = sceneAt(day, minutes);
          for (const [id, painter] of [
            ['bandstand', bandstandPainter],
            ['landing', landingPainter],
          ] as const) {
            const { draws } = paint(painter, scene);
            const lit = id === 'bandstand' && peakLamp(day, minutes, scene.night) > 0;
            for (const draw of draws)
              if (amberLike(draw.fill) && !(lit && LIT.has(draw.fill.toUpperCase())))
                found.push(`${id} on ${day} at ${minutes}: ${draw.fill}`);
          }
        }
      expect(found.slice(0, 5)).toEqual([]);
    },
    rosterTimeout(0.3, 60_000),
  );

  it(
    'never flashes: the chairs, the players, the lamp, the notes and the crew fade gently',
    () => {
      const FRAME = 1 / 30;
      const jumps: string[] = [];
      let compared = 0;
      for (const [painter, day, from, to] of [
        [bandstandPainter, PLAIN, 925, 965],
        [bandstandPainter, PLAIN, 1045, 1100],
        [bandstandPainter, PLAIN, 1195, 1235],
        [landingPainter, REGATTA, 822, 832],
        [landingPainter, REGATTA, 990, 1035],
      ] as const) {
        let before: Draw[] | undefined;
        for (let minutes = from; minutes < to; minutes += FRAME) {
          const { draws } = paint(painter, { ...sceneAt(day, minutes, 1, false) });
          // Frame by frame, and lamplight that comes or goes between frames that differ too.
          if (before) {
            const step = frameJumps(before, draws);
            compared += step.compared;
            for (const jump of step.jumps) jumps.push(`${minutes.toFixed(3)}: ${jump}`);
          }
          before = draws;
        }
      }
      expect(jumps.slice(0, 5)).toEqual([]);
      expect(compared).toBeGreaterThan(1000);
    },
    rosterTimeout(0.3, 60_000),
  );

  it('answers a click on the stand with K15, and on the landing stage with J15', () => {
    const scene = sceneAt(PLAIN, 980);
    const stand = project(STAND.x, STAND.y);
    expect(bandstandPainter.hit!({ x: stand.x, y: stand.y - 30 }, scene)).toEqual({
      plot: BANDSTAND_VENUE.plot,
      depth: STAND_DEPTH,
    });
    expect(bandstandPainter.hit!({ x: stand.x + 200, y: stand.y }, scene)).toBeUndefined();
    const { left, right, top, bottom } = REGATTA_COURSE.stage;
    const middle = project((left + right) / 2, (top + bottom) / 2);
    expect(landingPainter.hit!(middle, scene)?.plot).toBe(LANDING_VENUE.plot);
    expect(landingPainter.hit!({ x: middle.x - 300, y: middle.y }, scene)).toBeUndefined();
  });

  it('plays each band at its own arrangement’s tempo', () => {
    for (const band of BANDS) expect(BAND_BPM[band]).toBe(BANDSTAND_TRACKS[band].bpm);
  });
});
