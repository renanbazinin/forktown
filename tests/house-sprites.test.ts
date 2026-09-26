import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawHouse, houseBounds, houseLook, type HouseLife } from '../src/city/houses';
import {
  housePainter,
  houseSpriteStats,
  MAX_SPRITES,
  PAINTS_PER_FRAME,
  QUICK_PAN,
  SPRITE_MARGIN,
  spriteBudget,
} from '../src/city/house-sprites';
import type { Place } from '../src/lib/schema';
import {
  AUTUMN,
  SUMMER,
  WINTER,
  seedFraction,
  snowAt,
  townSeasonAt,
  type TownSeason,
} from '../src/lib/seasons';
import { CALENDAR_EPOCH_DAY, DAYS_PER_YEAR } from '../src/lib/town-calendar';
import { matrixContext } from './matrix-context';
import { recordingContext } from './recording-context';
import { everyShape, places } from './house-variety';

vi.mock('../src/city/houses', async (original) => {
  const houses = await original<typeof import('../src/city/houses')>();
  return { ...houses, drawHouse: vi.fn(houses.drawHouse) };
});

// Each home keeps its still picture in a sprite: copied pixel for pixel while nothing about it
// changes, painted again when something does, and never allowed to grow without bound.

const cottage = places.find((place) => place.building === 'cottage')!;
const seasonOn = (yearDay: number, minutes = 720): TownSeason =>
  townSeasonAt(CALENDAR_EPOCH_DAY + Math.floor(yearDay), minutes);

function browser() {
  const sprites: { width: number; height: number }[] = [];
  vi.stubGlobal('document', {
    createElement: () => {
      const { ctx } = recordingContext();
      const canvas = { width: 300, height: 150, getContext: () => ctx };
      sprites.push(canvas);
      return canvas;
    },
  });
  return sprites;
}
/** A map canvas with a camera the test can move. */
function map(width = 1440, height = 900) {
  const recorder = recordingContext(width, height);
  const camera = { a: 0.7, b: 0, c: 0, d: 0.7, e: 700.25, f: 90.5 };
  const ctx = new Proxy(recorder.ctx, {
    get: (target, key) =>
      key === 'getTransform' ? () => ({ ...camera }) : Reflect.get(target, key),
    set: (target, key, value) => Reflect.set(target, key, value),
  });
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  return { ctx, calls: recorder.calls, camera };
}
type Map = ReturnType<typeof map>;
type Home = { place: Place; x: number; y: number; night?: boolean; life?: Partial<HouseLife> };
const row = (homes: Place[]): Home[] =>
  homes.map((place, i) => ({ place, x: (i % 12) * 150, y: Math.floor(i / 12) * 110 + 0.4 * i }));
/** Paints one frame of homes and says how each was drawn. */
function frame({ ctx, calls }: Map, homes: Home[], life: Partial<HouseLife> = {}) {
  const draws = vi.mocked(drawHouse);
  draws.mockClear();
  const before = calls.length;
  const paint = housePainter(ctx);
  for (const home of homes)
    paint(home.place, home.x, home.y, home.night ?? false, 1.12, {
      minutes: 720,
      ...life,
      ...home.life,
    });
  const drawn = calls.slice(before);
  return {
    direct: draws.mock.calls.filter(([target]) => target === ctx).length,
    painted: draws.mock.calls.filter(([target]) => target !== ctx).length,
    copies: drawn.filter((call) => call.name === 'drawImage'),
    drawn,
  };
}
afterEach(() => vi.unstubAllGlobals());

/** Every call, property and gradient stop of one still picture of a home, as text. */
function picture(place: Place, night: boolean, life: HouseLife) {
  const { ctx } = recordingContext();
  const trace: unknown[] = [];
  const traced = new Proxy(ctx, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        trace.push(key, args);
        const result = value(...args);
        return typeof key === 'string' && key.endsWith('Gradient')
          ? { addColorStop: (...stop: unknown[]) => trace.push('stop', stop) }
          : result;
      };
    },
    set(target, key, value) {
      trace.push('set', key, typeof value === 'object' ? 'gradient' : value);
      return Reflect.set(target, key, value);
    },
  });
  drawHouse(traced, place, 0, 0, night, 1, life, false);
  return JSON.stringify(trace);
}

describe('House sprites', () => {
  it('copies each home from its sprite once painted, instead of drawing it again', () => {
    browser();
    const view = map();
    const homes = row(places.slice(0, 6));
    // The first frame cannot know whether the camera is resting, so it draws directly.
    expect(frame(view, homes)).toMatchObject({ direct: 6, painted: 0, copies: [] });
    const second = frame(view, homes);
    expect(second).toMatchObject({ direct: 0, painted: 6 });
    expect(second.copies).toHaveLength(6);
    for (let i = 0; i < 20; i++) {
      const next = frame(view, homes, { minutes: 720 + i / 30 });
      expect(next).toMatchObject({ direct: 0, painted: 0 });
      expect(next.copies).toHaveLength(6);
      // Copies land on whole device pixels, one to one, with no resampling.
      for (const copy of next.copies) {
        expect(copy.args).toHaveLength(3);
        expect(Number.isInteger(copy.args[1]) && Number.isInteger(copy.args[2])).toBe(true);
      }
    }
    expect(houseSpriteStats(view.ctx).sprites).toBe(6);
  });

  it('paints the chimney smoke live over the cached picture', () => {
    browser();
    const view = map();
    const homes = row([cottage]);
    frame(view, homes);
    frame(view, homes, { activity: 'home' });
    const smoke = (minutes: number) =>
      frame(view, homes, { activity: 'home', minutes })
        .drawn.filter((call) => call.name === 'rect')
        .map((call) => call.args.join(','));
    const early = smoke(730),
      later = smoke(733);
    expect(early).toHaveLength(8);
    expect(later).toHaveLength(8);
    expect(later).not.toEqual(early);
    expect(frame(view, homes, { activity: 'home' }).painted).toBe(0);
  });

  it('paints a new sprite when the season, the night, the lantern or the design changes', () => {
    browser();
    const view = map();
    const garden = { ...cottage, design: { ...cottage.design, garden: 'vegetables' as const } };
    const homes = row([garden]);
    const summer = { season: seasonOn(SUMMER + 5), lantern: { lit: false } };
    frame(view, homes, summer);
    expect(frame(view, homes, summer).painted).toBe(1);
    const autumn = { season: seasonOn(AUTUMN + 20), lantern: { lit: false } };
    const winter = { season: seasonOn(WINTER + 10), lantern: { lit: false } };
    const changes: [string, Partial<HouseLife>, boolean?][] = [
      ['pumpkins ripen in the beds', autumn],
      ['snow lies on the roof', winter],
      ['night falls', winter, true],
      ['the lantern lights', { ...winter, lantern: { lit: true } }, true],
      ['a neighbour comes home', { ...winter, lantern: { lit: true }, activity: 'home' }, true],
      ['the tale moves in', { ...winter, lantern: { lit: true, tale: true } }, true],
      ['the newest neighbour arrives', { ...winter, lantern: { lit: false, newest: true } }, true],
    ];
    for (const [change, life, night = false] of changes) {
      const changed = homes.map((home) => ({ ...home, night }));
      expect(frame(view, changed, life), change).toMatchObject({ painted: 1, direct: 0 });
      expect(frame(view, changed, life), change).toMatchObject({ painted: 0, direct: 0 });
    }
    // A new design is a new place object: it gets a sprite of its own.
    const repainted = { ...garden, color: '#AA3344' };
    expect(frame(view, [{ ...homes[0], place: repainted }], winter).painted).toBe(1);
    expect(houseSpriteStats(view.ctx).sprites).toBe(2);
  });

  it('paints a new sprite when only the line joins or caps change', () => {
    browser();
    const view = map();
    const homes = row([cottage]);
    frame(view, homes);
    expect(frame(view, homes).painted).toBe(1);
    view.ctx.lineJoin = 'round';
    expect(frame(view, homes)).toMatchObject({ painted: 1, direct: 0 });
    expect(frame(view, homes)).toMatchObject({ painted: 0, direct: 0 });
    view.ctx.lineCap = 'square';
    expect(frame(view, homes)).toMatchObject({ painted: 1, direct: 0 });
    expect(frame(view, homes)).toMatchObject({ painted: 0, direct: 0 });
  });

  // Everything that changes a home's still picture must be in its look, or a sprite would keep a
  // stale roof, bed or lantern: two moments with the same look draw exactly the same, every call,
  // colour and gradient stop, smoke aside. Each home and moment gets one of the night, lantern
  // and activity combinations in turn, so every combination comes round in several seasons.
  it('draws the same picture for the same look, all year', () => {
    const homes = [...places.slice(0, 18), ...everyShape.filter((_, i) => i % 9 === 0)];
    const lanterns = [
      undefined,
      { lit: false },
      { lit: true },
      { lit: true, tale: true },
      { lit: false, newest: true },
    ];
    const activities = [undefined, 'home', 'stroll'] as const;
    const combos = [false, true].flatMap((night) =>
      lanterns.flatMap((lantern) => activities.map((activity) => ({ night, lantern, activity }))),
    );
    // Every noon, and every six hours through the pumpkins, the first snow and the thaw.
    const moments: [number, number][] = [];
    for (let day = 0; day < DAYS_PER_YEAR; day++) {
      moments.push([day, 720]);
      const busy =
        (day >= AUTUMN && day < AUTUMN + 20) ||
        (day >= WINTER && day < WINTER + 3) ||
        day >= WINTER + 22;
      if (busy) for (const minutes of [0, 360, 1080]) moments.push([day, minutes]);
    }
    const pictures = new Map<string, { picture: string; at: string }>();
    const clashes: string[] = [];
    let compared = 0;
    homes.forEach((place, h) =>
      moments.forEach(([day, minutes], m) => {
        const { night, lantern, activity } = combos[(h * 7 + m) % combos.length];
        const life: HouseLife = { minutes, lantern, activity, season: seasonOn(day, minutes) };
        const look = houseLook(place, night, life);
        if (look === undefined) return;
        const key = `${h}:${look}`,
          drawn = picture(place, night, life),
          at = `day ${day} ${minutes} ${JSON.stringify({ night, lantern, activity })}`;
        const before = pictures.get(key);
        if (!before) return void pictures.set(key, { picture: drawn, at });
        compared++;
        if (before.picture !== drawn)
          clashes.push(`${place.id} look ${look}: ${before.at} vs ${at}`);
      }),
    );
    expect(clashes.slice(0, 5)).toEqual([]);
    // Most moments meet an earlier one with the same look, so a missing bit would show.
    expect(compared).toBeGreaterThan(pictures.size * 3);
  });

  it('draws a roof directly while its snow settles or thaws, as it fades every frame', () => {
    browser();
    const view = map();
    const homes = row(places);
    // Winter 1, 14:24: some roofs are still bare, some settling, some already white.
    const life = { season: seasonOn(WINTER, 864) };
    const fading = places.filter((place) => {
      const snow = snowAt(life.season.yearDay, seedFraction(`roof:${place.id}`));
      return snow > 0 && snow < 1;
    }).length;
    expect(fading).toBeGreaterThan(0);
    frame(view, homes, life);
    // The rest get their pictures a few a frame, however many homes the town has.
    for (let i = 0; i < Math.ceil(homes.length / PAINTS_PER_FRAME); i++) frame(view, homes, life);
    expect(frame(view, homes, life)).toMatchObject({ direct: fading, painted: 0 });
  });

  it('draws directly while zooming or gliding slowly, and repaints once the camera rests', () => {
    browser();
    const view = map();
    const homes = row(places.slice(0, 8));
    frame(view, homes);
    frame(view, homes);
    // A zoom changes every sprite's scale: houses are drawn directly until it settles.
    view.camera.a = view.camera.d = 0.8;
    expect(frame(view, homes)).toMatchObject({ direct: 8, painted: 0 });
    expect(frame(view, homes)).toMatchObject({ direct: 0, painted: 8 });
    // A slow glide lands every house on a new sub-pixel: drawn directly, exactly.
    view.camera.e += 1.3;
    expect(frame(view, homes)).toMatchObject({ direct: 8, painted: 0 });
    expect(frame(view, homes)).toMatchObject({ direct: 0, painted: 8 });
    // A quick pan copies the sprites to the nearest whole pixel, and a rest makes them exact.
    view.camera.e += QUICK_PAN + 0.37;
    const pan = frame(view, homes);
    expect(pan).toMatchObject({ direct: 0, painted: 0 });
    expect(pan.copies).toHaveLength(8);
    expect(frame(view, homes)).toMatchObject({ direct: 0, painted: 8 });
    // A pan by whole device pixels keeps every sub-pixel, so nothing is painted at all.
    view.camera.e += 3;
    view.camera.f -= 2;
    expect(frame(view, homes)).toMatchObject({ direct: 0, painted: 0 });
  });

  it('spreads new pictures over frames, drawing the rest directly meanwhile', () => {
    browser();
    const view = map();
    const homes = row(Array.from({ length: 80 }, (_, i) => ({ ...places[i % places.length] })));
    frame(view, homes);
    for (let painted = 0; painted < 80;) {
      const expected = Math.min(PAINTS_PER_FRAME, 80 - painted);
      expect(frame(view, homes)).toMatchObject({
        painted: expected,
        direct: 80 - painted - expected,
      });
      painted += expected;
    }
    expect(frame(view, homes)).toMatchObject({ direct: 0, painted: 0 });
  });

  it('keeps sprite memory within its budget without repainting the same homes every frame', () => {
    browser();
    const view = map(390, 844);
    view.camera.a = view.camera.d = 2.2;
    const homes = row(Array.from({ length: 60 }, (_, i) => ({ ...places[i % places.length] })));
    for (let i = 0; i < 8; i++) frame(view, homes);
    const { pixels, sprites } = houseSpriteStats(view.ctx);
    expect(pixels).toBeLessThanOrEqual(spriteBudget(390, 844));
    expect(sprites).toBeLessThan(60);
    // Homes beyond the budget are drawn directly, and the cached ones stay cached, whichever
    // order the frame draws them in: nothing on screen is evicted to make room.
    expect(frame(view, homes)).toMatchObject({ painted: 0, direct: 60 - sprites });
    expect(frame(view, [...homes].reverse())).toMatchObject({ painted: 0, direct: 60 - sprites });
    expect(houseSpriteStats(view.ctx).sprites).toBe(sprites);
  });

  it('never holds more than its cap of sprites, and lets idle ones go', () => {
    browser();
    const view = map();
    view.camera.a = view.camera.d = 0.1;
    const many = row(Array.from({ length: 600 }, (_, i) => ({ ...places[i % places.length] })));
    for (let i = 0; i < 30; i++) frame(view, many);
    expect(houseSpriteStats(view.ctx).sprites).toBe(MAX_SPRITES);
    expect(frame(view, [...many].reverse())).toMatchObject({
      painted: 0,
      direct: 600 - MAX_SPRITES,
    });
    // Homes that leave the screen give their memory back after a while.
    const few = many.slice(0, 5);
    for (let i = 0; i < 400; i++) frame(view, few);
    expect(houseSpriteStats(view.ctx).sprites).toBe(5);
  });

  it("keeps every mark of a home's still picture inside its sprite", () => {
    browser();
    const lives: [boolean, Partial<HouseLife>][] = [
      [true, { season: seasonOn(WINTER + 10), lantern: { lit: true, tale: true, newest: true } }],
      [false, { season: seasonOn(AUTUMN + 6), activity: 'work' }],
    ];
    for (const place of everyShape)
      for (const [night, life] of lives) {
        const recorder = matrixContext();
        drawHouse(recorder.ctx, place, 0, 0, night, 1, { minutes: 720, ...life }, false);
        const { left, right, top, bottom } = houseBounds(place);
        for (const p of recorder.points)
          if (
            p.x < -left - SPRITE_MARGIN ||
            p.x > right + SPRITE_MARGIN ||
            p.y < -top - SPRITE_MARGIN ||
            p.y > bottom + SPRITE_MARGIN
          )
            expect.fail(`${place.id}: ${p.call} at ${p.x},${p.y}`);
      }
  });

  it('draws directly without a document, or on a canvas it cannot copy onto exactly', () => {
    const view = map();
    const homes = row(places.slice(0, 3));
    frame(view, homes);
    expect(frame(view, homes)).toMatchObject({ direct: 3, painted: 0 });
    browser();
    const tilted = map();
    tilted.camera.b = 0.1;
    frame(tilted, homes);
    expect(frame(tilted, homes)).toMatchObject({ direct: 3, painted: 0 });
    const faded = map();
    faded.ctx.globalAlpha = 0.5;
    frame(faded, homes);
    expect(frame(faded, homes)).toMatchObject({ direct: 3, painted: 0 });
  });
});
