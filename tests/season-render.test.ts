import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIGHT } from '../src/city/glow';
import { drawFarFields, horizonY } from '../src/city/horizon';
import { drawHouse, houseBounds, type HouseAppearance } from '../src/city/houses';
import { drawLanternFork } from '../src/city/lantern-fork';
import { DAY, NIGHT, forkPlot, renderCity } from '../src/city/render';
import {
  BLOSSOM,
  FALLEN_LEAVES,
  FIREFLY,
  FOLIAGE,
  ICE,
  PUMPKIN,
  SNOW,
  type Pair,
} from '../src/city/season-palette';
import { drawSky } from '../src/city/sky';
import { drawFireflies, drawSeasonLight, drawSnowfall } from '../src/city/weather';
import { FORK_BOUNDS, lanternRegister, lanternsLit } from '../src/lib/lanterns';
import { BUILDING_TYPES, DECORATIONS, designSchema, placeSchema } from '../src/lib/schema';
import {
  AUTUMN,
  SUMMER,
  WINTER,
  seedFraction,
  snowCoverAt,
  townSeasonAt,
  yearDayAt,
  type TownSeason,
} from '../src/lib/seasons';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { hash, type Point } from '../src/lib/world';
import { recordingContext, type RecordedCall } from './recording-context';

// The turning year, seen through the renderer: every season stays inside the town's budgets and
// bounds, paints the same frame for the same moment, and shows its colours only in its season.

const places = readdirSync('places')
  .filter((file) => file.endsWith('.json'))
  .map((file) => placeSchema.parse(JSON.parse(readFileSync(`places/${file}`, 'utf8'))));
const isNight = (minutes: number) => minutes < 360 || minutes >= 1200;

// Year 1. The moon repeats every 28 days, so the same date in every season has the same sky.
const dayOf = (season: number, date: number) => CALENDAR_EPOCH_DAY + 28 * season + date - 1;
const dateOf = (day: number) => ((day - CALENDAR_EPOCH_DAY) % 28) + 1;
/** Eight moments of the year; `minutes` is the stage's own hour for the single-object checks. */
const STAGES = [
  { name: 'Spring 9, in bloom', day: dayOf(0, 9), minutes: 720 },
  { name: 'Spring 19, petals falling', day: dayOf(0, 19), minutes: 720 },
  { name: 'Summer 14', day: dayOf(1, 14), minutes: 720 },
  { name: 'Autumn 7, turning', day: dayOf(2, 7), minutes: 720 },
  { name: 'Autumn 21, late', day: dayOf(2, 21), minutes: 720 },
  { name: 'Winter 1, the first snow', day: dayOf(3, 1), minutes: 1165 },
  { name: 'Winter 11, deep snow', day: dayOf(3, 11), minutes: 720 },
  { name: 'Winter 26, the thaw', day: dayOf(3, 26), minutes: 720 },
];
// Noon, golden hour, 21:00, 22:00 and 03:00.
const MINUTES = [720, 1165, 1260, 1320, 180];
const both = (...pairs: readonly Pair[]) => pairs.flatMap((pair) => [...pair]);

// ---------------------------------------------------------------------------------------------
// The opening view (render-smoke's frame), rendered once per moment and shared by the tests.

const VIEW = { width: 1440, height: 900, camera: { x: 720, y: 88, zoom: 0.7 } };
function paintFrame(day: number, minutes: number, recorder = recordingContext(1440, 900)) {
  renderCity({
    ctx: recorder.ctx,
    ...VIEW,
    places,
    selectedPlot: null,
    hoveredPlot: null,
    night: isNight(minutes),
    showPlots: false,
    minutes,
    day,
  });
  return recorder;
}
const frames = new Map<string, RecordedCall[]>();
function frame(day: number, minutes: number) {
  const key = `${day}:${minutes}`;
  if (!frames.has(key)) frames.set(key, paintFrame(day, minutes).calls);
  return frames.get(key)!;
}
const trace = (calls: RecordedCall[]) =>
  calls.map(
    ({ name, args, fillStyle, offset }) =>
      `${name}(${args.map(String).join(',')}) ${String(fillStyle)} ${offset.x},${offset.y}`,
  );
/** The first entry where two logs part, so a failure names the call rather than a whole frame. */
function firstDifference(a: readonly string[], b: readonly string[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if (a[i] !== b[i]) return `#${i}: ${a[i]} <> ${b[i]}`;
}
/** Colours that were actually painted with, not merely current when something else happened. */
const painted = (calls: RecordedCall[]) =>
  new Set(
    calls
      .filter((call) => call.name === 'fillRect' || call.name === 'fill')
      .map((call) => String(call.fillStyle)),
  );
const SIGNATURE = {
  /** Snow lying on roofs, crowns, tufts and furrows. */
  settled: both(SNOW.top, SNOW.shade, SNOW.frost),
  /** Snow, and the Millpond's ice: winter's alone. */
  snow: both(
    SNOW.top,
    SNOW.shade,
    SNOW.frost,
    SNOW.ice,
    SNOW.flake,
    ICE.sheet,
    ICE.crack,
    ICE.crackLight,
  ),
  roofSnow: both(SNOW.top),
  flakes: both(SNOW.flake),
  fireflies: [FIREFLY.core, FIREFLY.halo],
  blossom: both(BLOSSOM.pink, BLOSSOM.deep, BLOSSOM.white),
  fallen: both(...FALLEN_LEAVES),
  /** The full autumn swatches: a crown shows one exactly once it has turned all the way. */
  autumn: both(
    FOLIAGE.ochre.leaf,
    FOLIAGE.ochre.light,
    FOLIAGE.russet.leaf,
    FOLIAGE.russet.light,
    FOLIAGE.rust.leaf,
    FOLIAGE.rust.light,
    FOLIAGE.larch.leaf,
    FOLIAGE.larch.light,
  ),
};
type Signature = keyof typeof SIGNATURE;
const shows = (colours: Set<string>, signature: Signature) =>
  SIGNATURE[signature].some((colour) => colours.has(colour));

describe('The opening view through the year', () => {
  it.each(STAGES)('$name stays within the frame budget of the same date in summer', ({ day }) => {
    const summer = dayOf(1, dateOf(day));
    for (const minutes of MINUTES) {
      const calls = frame(day, minutes).length,
        base = frame(summer, minutes).length;
      expect(calls, `${minutes}`).toBeGreaterThan(1000);
      expect(calls, `${minutes}`).toBeLessThan(40_000);
      // Measured: -754 to +287 over these moments (with the Millpond, whose ice, boats and lily
      // pads follow the year). A season only rests on top of the town;
      // it never adds a layer, and never loses one (the houses alone are ~3,000 calls).
      expect(calls - base, `${minutes}`).toBeLessThanOrEqual(1_000);
      expect(calls - base, `${minutes}`).toBeGreaterThanOrEqual(-1_500);
    }
  });

  it.each(STAGES)('$name paints the same frame for the same moment', ({ day }) => {
    // Golden hour and 22:00 carry every moving part: washes, flakes, fireflies and lanterns.
    for (const minutes of [1165, 1320]) {
      const again = trace(paintFrame(day, minutes).calls);
      expect(firstDifference(trace(frame(day, minutes)), again), `${minutes}`).toBeUndefined();
    }
  });

  it('shows each season’s signature colours at its own stages', () => {
    const at = (stage: number, minutes: number) => painted(frame(STAGES[stage].day, minutes));
    for (const minutes of MINUTES) {
      const night = isNight(minutes);
      // Blossom and petals in spring, and nowhere else among the stages.
      for (const stage of [0, 1]) expect(shows(at(stage, minutes), 'blossom')).toBe(true);
      for (const stage of [2, 3, 4, 5, 6, 7])
        expect(shows(at(stage, minutes), 'blossom'), `${stage} ${minutes}`).toBe(false);
      // Fireflies only on the summer stage's nights, and never at noon or golden hour.
      expect(shows(at(2, minutes), 'fireflies'), `${minutes}`).toBe(night);
      for (const stage of [0, 1, 3, 4, 5, 6, 7])
        expect(shows(at(stage, minutes), 'fireflies'), `${stage} ${minutes}`).toBe(false);
      // Turned crowns in autumn, fallen leaves from the second week of autumn.
      for (const stage of [3, 4]) expect(shows(at(stage, minutes), 'autumn')).toBe(true);
      expect(shows(at(4, minutes), 'fallen')).toBe(true);
      for (const stage of [0, 1, 2, 5, 6, 7])
        expect(shows(at(stage, minutes), 'autumn'), `${stage} ${minutes}`).toBe(false);
      for (const stage of [0, 1, 2, 6, 7])
        expect(shows(at(stage, minutes), 'fallen'), `${stage} ${minutes}`).toBe(false);
      // Snow from the first snow's evening through the thaw; none before winter.
      for (const stage of [6, 7]) expect(shows(at(stage, minutes), 'roofSnow')).toBe(true);
      for (const stage of [0, 1, 2, 3, 4])
        expect(shows(at(stage, minutes), 'snow'), `${stage} ${minutes}`).toBe(false);
    }
    for (const minutes of [1165, 1260, 1320]) {
      expect(shows(at(5, minutes), 'roofSnow')).toBe(true);
      expect(shows(at(5, minutes), 'flakes')).toBe(true);
    }
  });

  it('keeps summer noon free of fireflies and snowfall', () => {
    const noon = frame(dayOf(1, 14), 720);
    const colours = painted(noon);
    expect(shows(colours, 'fireflies')).toBe(false);
    expect(shows(colours, 'snow')).toBe(false);
    expect(noon.filter((call) => call.fillStyle === FIREFLY.core)).toHaveLength(0);
  });

  it('keeps every signature colour inside its season, all year', () => {
    // Every town day, alternating noon and 22:00, so both palettes are swept.
    const violations: string[] = [];
    for (let date = 0; date < 112; date++) {
      const day = CALENDAR_EPOCH_DAY + date,
        minutes = date % 2 ? 1320 : 720;
      const season = townSeasonAt(day, minutes),
        d = season.yearDay,
        night = isNight(minutes);
      const colours = painted(paintFrame(day, minutes).calls);
      const expectations: [Signature, boolean, boolean][] = [
        // [signature, allowed, required]
        ['snow', season.index === 3, false],
        ['roofSnow', season.index === 3, season.snow >= 0.1],
        ['flakes', season.flurry > 0, season.flurry >= 0.05],
        ['fireflies', night && season.fireflies > 0, night && season.fireflies >= 0.5],
        // The meadow's spring flowers linger into the first two days of summer.
        ['blossom', d < SUMMER + 2, false],
        ['fallen', d >= AUTUMN && d < WINTER + 2, false],
        ['autumn', d >= AUTUMN && d < WINTER, false],
      ];
      for (const [signature, allowed, required] of expectations) {
        const shown = shows(colours, signature);
        if (shown && !allowed) violations.push(`${signature} out of season on year day ${date}`);
        if (required && !shown) violations.push(`${signature} missing on year day ${date}`);
      }
    }
    expect(violations).toEqual([]);
  });

  // The cached ground reads snow at the day's first minute, so on Winter 1 at 00:00, before any
  // flake has fallen, the lawns, meadows and furrows are still bare; they whiten from Winter 2.
  it('lays no snow on the ground before the first flake falls', () => {
    const day = dayOf(3, 1);
    const season = townSeasonAt(day, 0);
    expect(season.flurry).toBe(0);
    expect(season.snow).toBe(0);
    expect(shows(painted(frame(day, 0)), 'settled')).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Sky and horizon, in the style of far-side.test.ts.

// Records every method call and style change; gradients answer with inert stops.
// Path building is logged too, but budgets count only the calls that do the work.
function recorder() {
  const log: string[] = [];
  const state: Record<string, unknown> = { globalAlpha: 1, fillStyle: '#000', lineWidth: 1 };
  const gradient = {
    addColorStop: (offset: number, color: string) => log.push(`stop ${offset} ${color}`),
  };
  const ctx = new Proxy(state, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        log.push(`${key}(${args.join(',')})`);
        if (key.startsWith('create')) return gradient;
      };
    },
    set(target, key: string, value) {
      target[key] = value;
      log.push(`${key}=${String(value)}`);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  const calls = () => log.filter((entry) => entry.includes('(') && !entry.startsWith('stop'));
  const vertices = () => calls().filter((call) => /^(moveTo|lineTo)\(/.test(call));
  const drawCalls = () => calls().filter((call) => !/^(beginPath|moveTo|lineTo)\(/.test(call));
  return { ctx, log, calls, vertices, drawCalls };
}
/** Where two sky logs part, ignoring floating-point noise: the same moon a season later is
 * computed from a larger day count, so its alpha can differ in the 15th digit. */
function skyDifference(a: readonly string[], b: readonly string[]) {
  const numbers = /-?\d+(\.\d+)?(e-?\d+)?/g;
  const close = (x: string, y: string) => {
    const [p, q] = [x.match(numbers) ?? [], y.match(numbers) ?? []].map((list) => list.map(Number));
    return (
      x.replace(numbers, '0') === y.replace(numbers, '0') &&
      p.every((value, k) => Math.abs(value - q[k]) <= 1e-9 * Math.max(1, Math.abs(value)))
    );
  };
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if (a[i] !== b[i] && !(a[i] !== undefined && b[i] !== undefined && close(a[i], b[i])))
      return `#${i}: ${a[i]} <> ${b[i]}`;
}
function sky(day: number, minutes: number) {
  const record = recorder();
  drawSky(record.ctx, 1440, 900, day, minutes);
  return record;
}
/** Every fill with the alpha it was painted at, keeping a save/restore stack like a canvas. */
function skyDraws(day: number, minutes: number) {
  const draws: { call: string; style: unknown; alpha: number; args: number[] }[] = [];
  const stack: { globalAlpha: number; fillStyle: unknown }[] = [];
  let state: { globalAlpha: number; fillStyle: unknown } = { globalAlpha: 1, fillStyle: '#000' };
  const gradient = { addColorStop() {} };
  const ctx = new Proxy(
    {},
    {
      get(_, key: string) {
        if (key in state) return state[key as keyof typeof state];
        return (...args: number[]) => {
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') state = stack.pop() ?? state;
          if (key === 'fill' || key === 'fillRect')
            draws.push({ call: key, style: state.fillStyle, alpha: state.globalAlpha, args });
          if (key.startsWith('create')) return gradient;
        };
      },
      set(_, key: string, value) {
        (state as Record<string, unknown>)[key] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  drawSky(ctx, 1440, 900, day, minutes);
  return draws;
}

describe('The sky through the year', () => {
  it.each(STAGES)('$name paints the sky within budget, identically every call', ({ day }) => {
    for (const minutes of [...MINUTES, 1205, 1225]) {
      const first = sky(day, minutes),
        second = sky(day, minutes);
      // Measured at most 218 draw calls and 656 vertices (golden hour), in winter.
      expect(first.drawCalls().length, `${minutes}`).toBeLessThanOrEqual(400);
      expect(first.vertices().length, `${minutes}`).toBeLessThanOrEqual(800);
      expect(first.log).toEqual(second.log);
    }
  });

  it.each(STAGES)(
    '$name keeps the ridges last and opaque, snow resting on the far ridge',
    ({ day }) => {
      for (const minutes of [720, 1165, 1225, 180]) {
        const draws = skyDraws(day, minutes);
        const fills = draws.filter((draw) => draw.call === 'fill');
        // The far and near ridges are the last two path fills.
        expect(fills.slice(-2).map((fill) => fill.alpha)).toEqual([1, 1]);
        const after = draws.slice(draws.lastIndexOf(fills.at(-2)!) + 1);
        // The sister forks' bodies are the first rgb() style after the far ridge; any ridge snow
        // comes before them.
        const first = after.findIndex((draw) => String(draw.style).startsWith('rgb('));
        const body = after[first].style;
        for (const draw of after.filter((draw) => draw.style === body)) expect(draw.alpha).toBe(1);
        const snow = after.slice(0, first);
        const cover = snowCoverAt(yearDayAt(day, minutes));
        expect(snow.length > 0, `${minutes}`).toBe(cover > 0);
        // Opaque hex rects standing on the ridge line: they fade by colour, never by alpha.
        for (const { call, style, alpha, args } of snow) {
          const [x, y, w, h] = args;
          expect(call).toBe('fillRect');
          expect(alpha).toBe(1);
          expect(style).toMatch(/^#[0-9A-F]{6}$/);
          expect(h).toBeGreaterThanOrEqual(2);
          for (let step = x; step < x + w; step += 4) expect(y).toBe(horizonY(step / 1440, 900, 0));
        }
        // Snow on the forks' roofs is opaque too, and never one of their lights.
        for (const draw of after.slice(first)) {
          const style = String(draw.style);
          if (style === '#FFE0A0' || style === '#E9DDB8' || !/^#[0-9A-F]{6}$/.test(style)) continue;
          expect(draw.alpha).toBe(1);
        }
      }
    },
  );

  it.each(STAGES)('$name lights exactly three sister forks at nightfall', ({ day }) => {
    const dusk = sky(day, 1199).log,
      night = sky(day, 1201).log;
    expect(dusk.filter((entry) => entry === 'fillStyle=#FFE0A0')).toHaveLength(0);
    expect(dusk.filter((entry) => entry === 'fillStyle=#E9DDB8')).toHaveLength(3);
    expect(night.filter((entry) => entry === 'fillStyle=#FFE0A0')).toHaveLength(3);
    expect(night.filter((entry) => entry === 'fillStyle=#E9DDB8')).toHaveLength(0);
  });

  it('changes the sky only where winter snow lies on the far ridge', () => {
    for (const date of [1, 9, 14, 19, 26, 28])
      for (const minutes of [720, 1165, 1205, 1320, 180]) {
        const [spring, summer, autumn, winter] = [0, 1, 2, 3].map(
          (season) => sky(dayOf(season, date), minutes).log,
        );
        const where = `date ${date} at ${minutes}`;
        expect(skyDifference(summer, spring), where).toBeUndefined();
        expect(skyDifference(autumn, spring), where).toBeUndefined();
        const snow = snowCoverAt(yearDayAt(dayOf(3, date), minutes));
        // Winter 1 at 03:00 and Winter 28 at 22:00 carry no snow, and match the other seasons.
        if (snow > 0) expect(skyDifference(winter, spring), where).toBeDefined();
        else expect(skyDifference(winter, spring), where).toBeUndefined();
      }
    expect(snowCoverAt(yearDayAt(dayOf(3, 1), 180))).toBe(0);
  });
});

describe('Far fields through the year', () => {
  it('only recolours the far trees: same calls, strips and alphas in every season', () => {
    for (const night of [false, true]) {
      const plain = recorder();
      drawFarFields(plain.ctx, night);
      const strips = plain.log.slice(0, plain.log.indexOf('restore()') + 1);
      const alphas = plain.log.filter((entry) => entry.startsWith('globalAlpha='));
      for (const { name, day, minutes } of STAGES) {
        const season = townSeasonAt(day, minutes);
        const first = recorder(),
          second = recorder();
        drawFarFields(first.ctx, night, season);
        drawFarFields(second.ctx, night, season);
        expect(first.calls().length, name).toBeLessThanOrEqual(60);
        expect(first.calls(), name).toEqual(plain.calls());
        expect(first.log.slice(0, strips.length), name).toEqual(strips);
        expect(
          first.log.filter((entry) => entry.startsWith('globalAlpha=')),
          name,
        ).toEqual(alphas);
        expect(first.log, name).toEqual(second.log);
        // Summer is today's far fields exactly.
        if (season.index === 1) expect(first.log, name).toEqual(plain.log);
      }
      // Autumn and winter do change the trees.
      for (const stage of [4, 6]) {
        const seasonal = recorder();
        drawFarFields(seasonal.ctx, night, townSeasonAt(STAGES[stage].day, 720));
        expect(seasonal.log).not.toEqual(plain.log);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Houses: every design the schema allows, in every season, day and night.

/** A recorder that follows the full transform, so points are checked in house-local pixels. */
function houseRecorder() {
  type Matrix = [number, number, number, number, number, number];
  type State = { fillStyle: unknown; strokeStyle: unknown; globalAlpha: number; m: Matrix };
  const log: string[] = [];
  const points: Point[] = [];
  let state: State = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1,
    m: [1, 0, 0, 1, 0, 0],
  };
  const stack: State[] = [];
  const other: Record<string, unknown> = {};
  const multiply = ([a2, b2, c2, d2, e2, f2]: number[]) => {
    const [a, b, c, d, e, f] = state.m;
    state.m = [
      a * a2 + c * b2,
      b * a2 + d * b2,
      a * c2 + c * d2,
      b * c2 + d * d2,
      a * e2 + c * f2 + e,
      b * e2 + d * f2 + f,
    ];
  };
  const at = (x: number, y: number) => {
    const [a, b, c, d, e, f] = state.m;
    points.push({ x: a * x + c * y + e, y: b * x + d * y + f });
  };
  const box = (x: number, y: number, w: number, h: number) => {
    at(x, y);
    at(x + w, y);
    at(x, y + h);
    at(x + w, y + h);
  };
  const ctx = new Proxy(
    {},
    {
      get(_, key) {
        if (typeof key !== 'string') return undefined;
        if (key === 'fillStyle' || key === 'strokeStyle' || key === 'globalAlpha')
          return state[key];
        if (key in other) return other[key];
        return (...args: number[]) => {
          const [x, y, w, h] = args;
          if (key === 'save') stack.push({ ...state });
          else if (key === 'restore') state = stack.pop() ?? state;
          else if (key === 'translate') multiply([1, 0, 0, 1, x, y]);
          else if (key === 'scale') multiply([x, 0, 0, y, 0, 0]);
          else if (key === 'transform') multiply(args);
          else if (key === 'fillRect' || key === 'rect') box(x, y, w, h);
          else if (key === 'moveTo' || key === 'lineTo') at(x, y);
          else if (key === 'ellipse') box(x - w, y - h, 2 * w, 2 * h);
          else if (key === 'arc') box(x - w, y - w, 2 * w, 2 * w);
          // Only painting calls carry the paint, so an inserted layer cannot shift the others.
          const paint =
            key === 'fill' || key === 'fillRect' || key === 'fillText'
              ? ` ${String(state.fillStyle)}@${state.globalAlpha}`
              : key === 'stroke'
                ? ` ${String(state.strokeStyle)}@${state.globalAlpha}`
                : '';
          log.push(`${key}(${args.join(',')})${paint}`);
          if (key === 'measureText') return { width: String(args[0]).length * 6 };
        };
      },
      set(_, key, value) {
        if (key === 'fillStyle' || key === 'strokeStyle' || key === 'globalAlpha')
          state = { ...state, [key]: value };
        else if (typeof key === 'string') other[key] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, log, points };
}

const ROOFS = designSchema.shape.roof.options;
const FEATURES = designSchema.shape.feature.options;
const WINDOWS = designSchema.shape.windows.options;
const GARDENS = designSchema.shape.garden.options;
const FLOORS = [1, 2, 3] as const;
const ids = places.map((place) => place.id);
// One neighbour who puts a pumpkin on the doorstep, and one who grows a third bed instead.
const DOORSTEP = ids.find((id) => seedFraction(`pumpkin:${id}`) < 0.45)!;
const THIRD_BED =
  ids.find((id) => seedFraction(`pumpkin:${id}`) >= 0.45 && hash(`squash:${id}`) & 8) ??
  ids.find((id) => seedFraction(`pumpkin:${id}`) >= 0.45)!;
const DESIGNS: HouseAppearance[] = BUILDING_TYPES.flatMap((building) =>
  ROOFS.flatMap((roof) =>
    FLOORS.flatMap((floors) =>
      DECORATIONS.flatMap((decoration) =>
        FEATURES.map((feature) => ({ building, roof, floors, decoration, feature })),
      ),
    ),
  ),
).map(({ building, roof, floors, decoration, feature }, n) => ({
  ...places[0],
  // Both neighbours, every window and every garden turn up in each building, roof and height.
  id: n % 2 ? DOORSTEP : THIRD_BED,
  building,
  decoration,
  design: {
    ...places[0].design,
    roof,
    floors,
    feature,
    windows: WINDOWS[Math.floor(n / 4) % WINDOWS.length],
    // Vegetable beds carry the garden pumpkins, so half the designs grow them.
    garden: Math.floor(n / 2) % 2 ? 'vegetables' : GARDENS[Math.floor(n / 12) % GARDENS.length],
  },
}));
const SEASONAL_ART = both(SNOW.top, SNOW.shade, PUMPKIN.body, PUMPKIN.rib, PUMPKIN.stem);
const LIGHTS = new Set<string>([...Object.values(LIGHT).flat(), '#C57B65', '#FBF3DE']);
const paintHouse = (place: HouseAppearance, night: boolean, season?: TownSeason) => {
  const record = houseRecorder();
  drawHouse(record.ctx, place, 0, 0, night, 1, { minutes: 720, lantern: { lit: night }, season });
  return record;
};
/** A ripe bed's pumpkin replaces its sprout; everything else in the base must still be drawn. */
const withoutSprouts = (log: string[]) => log.filter((entry) => !entry.includes('#567B44'));
/** The entries a season adds, if the plain house is still drawn, in order, underneath them. */
function added(seasonal: string[], plain: string[]) {
  const extra: string[] = [];
  let j = 0;
  for (const entry of seasonal)
    if (j < plain.length && entry === plain[j]) j++;
    else extra.push(entry);
  return j === plain.length ? extra : undefined;
}

describe('Houses through the year', () => {
  it('covers every design the schema allows', () => {
    expect(DESIGNS).toHaveLength(6 * 3 * 3 * 4 * 3);
    expect(DOORSTEP).toBeDefined();
    expect(THIRD_BED).toBeDefined();
    expect(new Set(DESIGNS.map((design) => design.design.garden))).toEqual(new Set(GARDENS));
    expect(new Set(DESIGNS.map((design) => design.design.windows))).toEqual(new Set(WINDOWS));
  });

  it('keeps all seasonal art inside houseBounds and rests it on top of the house', () => {
    const outside: string[] = [];
    const repainted: string[] = [];
    const colours = new Set<string>();
    let most = 0;
    const seasons = STAGES.map((stage) => townSeasonAt(stage.day, stage.minutes));
    for (const place of DESIGNS) {
      const { top, bottom, left, right } = houseBounds(place);
      const what = `${place.building}/${place.design.roof}/${place.design.floors}/${place.decoration}/${place.design.feature}`;
      for (const night of [false, true]) {
        const whole = paintHouse(place, night).log;
        const plain = withoutSprouts(whole);
        seasons.forEach((season, stage) => {
          const { log, points } = paintHouse(place, night, season);
          most = Math.max(most, log.length - whole.length);
          for (const { x, y } of points)
            if (x < -left || x > right || y < -top || y > bottom)
              outside.push(`${what} ${STAGES[stage].name} ${night}: ${x},${y}`);
          const extra = added(withoutSprouts(log), plain);
          if (!extra) repainted.push(`${what} ${STAGES[stage].name} ${night}`);
          // A bed that stands in front of a doorstep pumpkin is drawn again in its own colours;
          // anything new must be snow or a pumpkin.
          const own = new Set(
            plain.map((entry) => entry.slice(entry.lastIndexOf(' ') + 1).split('@')[0]),
          );
          for (const entry of extra ?? []) {
            const colour = entry.slice(entry.lastIndexOf(' ') + 1).split('@')[0];
            if (entry.startsWith('fill') && !own.has(colour)) colours.add(colour);
          }
        });
      }
    }
    expect(outside.slice(0, 5)).toEqual([]);
    expect(repainted.slice(0, 5)).toEqual([]);
    // Measured at most +45 calls on one house: a gable-roofed cafe with a pine, whose awning and
    // balcony both hold the first snow. Spring and summer add nothing, autumn at most 6.
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(55);
    // Every added paint is snow or a pumpkin, and never a lantern's light.
    expect([...colours].filter((colour) => !SEASONAL_ART.includes(colour))).toEqual([]);
    expect([...colours].filter((colour) => LIGHTS.has(colour))).toEqual([]);
    expect(colours.size).toBeGreaterThan(0);
  }, 20_000);

  it('keeps previews, spring and summer houses exactly as their neighbours made them', () => {
    const quiet = STAGES.filter((stage) => stage.day < dayOf(2, 1));
    for (const place of DESIGNS.filter((_, i) => i % 3 === 0))
      for (const night of [false, true]) {
        const preview = houseRecorder();
        drawHouse(preview.ctx, place, 0, 0, night, 1);
        const plain = paintHouse(place, night).log;
        for (const { name, day, minutes } of quiet) {
          const season = townSeasonAt(day, minutes);
          const map = houseRecorder();
          drawHouse(map.ctx, place, 0, 0, night, 1, { minutes, season });
          expect(map.log, name).toEqual(preview.log);
          expect(paintHouse(place, night, season).log, name).toEqual(plain);
        }
      }
  });

  it('puts snow on every roof in deep winter and pumpkins out only in autumn', () => {
    const at = (stage: number, place: HouseAppearance, night = false) =>
      paintHouse(place, night, townSeasonAt(STAGES[stage].day, STAGES[stage].minutes)).log;
    const uses = (log: string[], colours: readonly string[]) =>
      log.some((entry) => colours.some((colour) => entry.includes(` ${colour}@`)));
    for (const place of DESIGNS.filter((_, i) => i % 5 === 0))
      for (const night of [false, true]) {
        expect(uses(at(6, place, night), both(SNOW.top))).toBe(true);
        for (const stage of [0, 1, 2, 3, 4])
          expect(uses(at(stage, place, night), both(SNOW.top, SNOW.shade))).toBe(false);
        for (const stage of [0, 1, 2, 6, 7])
          expect(uses(at(stage, place, night), both(PUMPKIN.body))).toBe(false);
      }
    // Late autumn: two beds ripen, the doorstep pumpkin is out, and a neighbour without one may
    // grow a third bed instead. By deep winter every pumpkin has gone in.
    const vegetables = (id: string) =>
      DESIGNS.find((place) => place.id === id && place.design.garden === 'vegetables')!;
    const beds = (log: string[]) =>
      log.filter((entry) => /^fillRect\([^)]*,5,4\) /.test(entry) && uses([entry], PUMPKIN.body))
        .length;
    const step = (log: string[]) => log.some((entry) => entry.startsWith('fillRect(-3,14,7,4) '));
    const third = hash(`squash:${THIRD_BED}`) & 8 ? 3 : 2;
    for (const night of [false, true]) {
      expect(beds(at(4, vegetables(DOORSTEP), night))).toBe(2);
      expect(step(at(4, vegetables(DOORSTEP), night))).toBe(true);
      expect(beds(at(4, vegetables(THIRD_BED), night))).toBe(third);
      expect(step(at(4, vegetables(THIRD_BED), night))).toBe(false);
      for (const id of [DOORSTEP, THIRD_BED]) {
        expect(beds(at(6, vegetables(id), night))).toBe(0);
        expect(step(at(6, vegetables(id), night))).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// The Lantern Fork, every quarter of every town day.

const ARRIVALS = places.map((place) => place.id).reverse();
const register = lanternRegister(places, ARRIVALS);
const inFork = (x: number, y: number) =>
  x >= FORK_BOUNDS.left &&
  x <= FORK_BOUNDS.right &&
  y >= FORK_BOUNDS.top &&
  y <= FORK_BOUNDS.bottom;
function paintFork(night: boolean, lit: number, season?: TownSeason) {
  const record = recordingContext();
  const palette = night ? NIGHT : DAY;
  drawLanternFork(record.ctx, {
    x: 0,
    y: 0,
    depth: forkPlot.x + forkPlot.y,
    register,
    lit,
    night,
    leaf: palette.leaf,
    leafLight: palette.leafLight,
    season,
  }).forEach((object) => object.paint());
  return record;
}
const forkPoints = (calls: RecordedCall[]) =>
  calls.flatMap(({ name, args, offset }) => {
    const [x, y, a, b] = args as number[];
    if (name === 'fillRect')
      return [
        [offset.x + x, offset.y + y],
        [offset.x + x + a, offset.y + y + b],
      ];
    if (name === 'moveTo' || name === 'lineTo') return [[offset.x + x, offset.y + y]];
    if (name === 'ellipse')
      return [
        [offset.x + x - a, offset.y + y - b],
        [offset.x + x + a, offset.y + y + b],
      ];
    return [];
  });

function stubDocument() {
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => recordingContext().ctx }),
  });
}
afterEach(() => vi.unstubAllGlobals());

describe('The Lantern Fork through the year', () => {
  it('stays inside FORK_BOUNDS and glows once per lit lantern, every quarter day', () => {
    stubDocument();
    const violations: string[] = [];
    for (let quarter = 0; quarter < 112 * 4; quarter++) {
      const day = CALENDAR_EPOCH_DAY + Math.floor(quarter / 4),
        minutes = (quarter % 4) * 360;
      const season = townSeasonAt(day, minutes);
      // The natural hour, then the other palette with a different number of lanterns lit.
      for (const [night, lit] of [
        [isNight(minutes), lanternsLit(register.total, minutes)],
        [!isNight(minutes), quarter % (register.total + 1)],
      ] as const) {
        const { calls } = paintFork(night, lit, season);
        for (const [x, y] of forkPoints(calls))
          if (!inFork(x, y)) violations.push(`${quarter / 4} ${night}: ${x},${y}`);
        const glows = calls.filter((call) => call.name === 'drawImage').length;
        if (glows !== lit) violations.push(`${quarter / 4} ${night}: ${glows} glows for ${lit}`);
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
  });

  it('is today’s Fork in summer, and never borrows a lantern’s colours', () => {
    for (const night of [false, true]) {
      const plain = paintFork(night, 5);
      const summer = paintFork(night, 5, townSeasonAt(dayOf(1, 14), 720));
      expect(trace(summer.calls)).toEqual(trace(plain.calls));
      const base = new Set(plain.fills.map(String));
      for (const { name, day, minutes } of STAGES) {
        const seasonal = paintFork(night, 5, townSeasonAt(day, minutes));
        // Measured at most +49 calls: snow along the lobes' tops, blossom or turned dapples.
        expect(seasonal.calls.length - plain.calls.length, name).toBeLessThanOrEqual(80);
        const added = seasonal.fills.map(String).filter((colour) => !base.has(colour));
        expect(
          added.filter((colour) => LIGHTS.has(colour)),
          name,
        ).toEqual([]);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Weather: fireflies, snowfall and the season's light.

const { camera } = VIEW;
const view = {
  left: -camera.x / camera.zoom,
  right: (VIEW.width - camera.x) / camera.zoom,
  top: -camera.y / camera.zoom,
  bottom: (VIEW.height - camera.y) / camera.zoom,
};
// The opening view's culling, as render.ts builds it.
const visible = (point: Point, rx: number, above: number, below: number) =>
  point.x + rx >= view.left &&
  point.x - rx <= view.right &&
  point.y + below >= view.top &&
  point.y - above <= view.bottom;

describe('Weather through the year', () => {
  it('keeps fireflies to summer nights, within budget, restoring alpha', () => {
    let most = 0;
    for (let date = 0; date < 112; date += 2)
      for (const minutes of [720, 1165, 1210, 1260, 1320, 1439, 60, 180, 300]) {
        const day = CALENDAR_EPOCH_DAY + date;
        const season = townSeasonAt(day, minutes);
        const record = recordingContext();
        record.ctx.globalAlpha = 0.9;
        const objects = drawFireflies(record.ctx, season, isNight(minutes), visible);
        objects.forEach((object) => object.paint());
        if (!isNight(minutes) || season.index !== 1) expect(objects).toEqual([]);
        expect(record.ctx.globalAlpha).toBe(0.9);
        most = Math.max(most, record.calls.length);
      }
    // Measured at most 290 calls (145 lit flies, two rects each) in the opening view.
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(400);
  });

  it('keeps fireflies blinking and drifting straight through midnight', () => {
    // Paint the lit flies of a midsummer night a moment apart and count the ones that stayed put.
    const lit = (day: number, minutes: number) => {
      const record = recordingContext();
      drawFireflies(record.ctx, townSeasonAt(day, minutes), true, () => true).forEach((object) =>
        object.paint(),
      );
      return new Set(
        record.calls.filter((call) => call.name === 'fillRect').map((call) => call.args.join(',')),
      );
    };
    const steady = (a: Set<string>, b: Set<string>) =>
      [...a].filter((rect) => b.has(rect)).length / a.size;
    const night = dayOf(1, 14);
    const ordinary = steady(lit(night, 1439.9), lit(night, 1439.95));
    const midnight = steady(lit(night, 1439.95), lit(night + 1, 0));
    expect(ordinary).toBeGreaterThan(0.6);
    expect(midnight).toBeGreaterThan(ordinary - 0.15);
  });

  it('lets snow fall only on winter flurries, in a light budget', () => {
    const summer = recordingContext();
    drawSnowfall(summer.ctx, 1440, 900, townSeasonAt(dayOf(1, 14), 720), false);
    expect(summer.calls).toEqual([]);
    for (const [width, height, budget] of [
      [1440, 900, 62],
      [390, 844, 20],
      [3840, 2160, 112],
    ])
      for (let minutes = 0; minutes < 1440; minutes += 45) {
        const season = townSeasonAt(dayOf(3, 1), minutes);
        const record = recordingContext(width, height);
        drawSnowfall(record.ctx, width, height, season, isNight(minutes));
        expect(record.calls.length).toBeLessThanOrEqual(budget);
        if (season.flurry === 0) expect(record.calls).toEqual([]);
        if (!record.calls.length) continue;
        // Alpha is restored for the golden-hour and season washes painted after the flakes.
        expect(record.calls[0].name).toBe('save');
        expect(record.calls.at(-1)!.name).toBe('restore');
        for (const { args } of record.calls.filter((call) => call.name === 'fillRect')) {
          const [x, y, w] = args as number[];
          expect(x).toBeGreaterThanOrEqual(-8 - 3);
          expect(x).toBeLessThanOrEqual(width + 8 + 3);
          expect(y).toBeGreaterThanOrEqual(-8);
          expect(y).toBeLessThanOrEqual(height + 8);
          expect([1, 2]).toContain(w);
        }
      }
  });

  it('washes the frame at most once, faintly, and only in autumn and winter', () => {
    for (let date = 0; date < 112; date++)
      for (const minutes of [720, 1320]) {
        const season = townSeasonAt(CALENDAR_EPOCH_DAY + date, minutes);
        const record = recorder();
        drawSeasonLight(record.ctx, 1440, 900, season, isNight(minutes));
        const rects = record.calls().filter((call) => call.startsWith('fillRect'));
        if (season.yearDay < AUTUMN) expect(record.log).toEqual([]);
        expect(rects.length).toBeLessThanOrEqual(1);
        if (rects.length) expect(rects[0]).toBe('fillRect(0,0,1440,900)');
        for (const alpha of record.log.filter((entry) => entry.startsWith('globalAlpha=')))
          expect(Number(alpha.split('=')[1])).toBeLessThanOrEqual(0.055);
        if (season.snow > 0.1) expect(rects).toHaveLength(1);
      }
  });
});

// ---------------------------------------------------------------------------------------------
// The ground cache follows the town day, not the minute.

function browser() {
  const layers: ReturnType<typeof recordingContext>[] = [];
  vi.stubGlobal('document', {
    createElement: () => {
      const layer = recordingContext();
      layers.push(layer);
      return Object.assign(layer.ctx.canvas, { getContext: () => layer.ctx });
    },
  });
  // The ground layer is the surface the cache resets before every repaint.
  const ground = () =>
    layers.find((layer) => layer.calls.some((call) => call.name === 'resetTransform'));
  return { ground };
}

describe('The seasonal ground cache', () => {
  it('repaints the ground once a town day, not every minute', () => {
    const { ground } = browser();
    const main = recordingContext(1440, 900);
    const day = dayOf(2, 12);
    const repaints = () => ground()!.calls.filter((call) => call.name === 'clearRect').length;
    const steps: [number, number, number][] = [
      // [day, minutes, repaints so far]
      [day, 400, 1],
      [day, 720, 1],
      [day, 1100, 1],
      [day + 1, 400, 2],
      [day + 1, 1000, 2],
      [day + 1, 1200, 3], // nightfall changes the palette
      [day + 1, 1439, 3],
      [day + 2, 0, 4], // a new town day
      [day + 2, 300, 4],
    ];
    for (const [d, minutes, expected] of steps) {
      paintFrame(d, minutes, main);
      expect(repaints(), `${d - day}:${minutes}`).toBe(expected);
    }
    // The layer is blitted into every frame.
    expect(main.calls.filter((call) => call.args[0] === ground()!.ctx.canvas)).toHaveLength(
      steps.length,
    );
  });

  it('paints the same ground all day long, so the day is all the key needs', () => {
    const groundAt = (day: number, minutes: number) => {
      const { ground } = browser();
      paintFrame(day, minutes);
      const layer = ground()!;
      vi.unstubAllGlobals();
      return trace(layer.calls);
    };
    for (const { name, day } of STAGES) {
      const morning = groundAt(day, 380);
      // The whole terrain went into the layer, not just the cache's own bookkeeping.
      expect(morning.length, name).toBeGreaterThan(5_000);
      expect(firstDifference(morning, groundAt(day, 1190)), name).toBeUndefined();
      expect(firstDifference(groundAt(day, 5), groundAt(day, 1435)), name).toBeUndefined();
    }
    // The leaf fall: the lawn changes from one town day to the next.
    expect(groundAt(dayOf(2, 12), 720)).not.toEqual(groundAt(dayOf(2, 13), 720));
  });
});
