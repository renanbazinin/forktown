import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderOptions } from '../src/city/render';
import { townNightShare } from '../src/lib/town-calendar';
import { recordingContext } from './recording-context';

// Every paint, as renderCity was asked for it.
const paints: RenderOptions[] = [];
vi.mock('../src/city/render', () => ({
  renderCity: (options: RenderOptions) => paints.push(options),
}));
// Which canvas each cache was handed back for.
const released: [string, object][] = [];
const shared: object[][] = [];
vi.mock('../src/city/football', () => ({
  releaseFootballLayers: (ctx: object) => released.push(['football', ctx]),
  shareFootballFacing: (twin: object, ctx: object) => shared.push([twin, ctx]),
}));
vi.mock('../src/city/ground-cache', () => ({
  releaseGroundLayer: (ctx: object) => released.push(['ground', ctx]),
}));
vi.mock('../src/city/house-sprites', () => ({
  releaseHouseSprites: (ctx: object) => released.push(['sprites', ctx]),
}));
const { renderTwilight } = await import('../src/city/twilight');

// Dusk and dawn paint the town in both of its looks and lay the one it is turning to over the
// other, so nightfall takes eighty seconds instead of one frame.

type Canvas = { width: number; height: number; ctx: ReturnType<typeof recordingContext> };
let canvases: Canvas[] = [];
beforeEach(() => {
  canvases = [];
  vi.stubGlobal('document', {
    createElement: () => {
      const recorder = recordingContext();
      const canvas: Canvas & { getContext: () => CanvasRenderingContext2D } = {
        width: 300,
        height: 150,
        ctx: recorder,
        getContext: () => recorder.ctx,
      };
      canvases.push(canvas);
      return canvas;
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  paints.length = released.length = shared.length = 0;
});

/** The map canvas: 1440x900 CSS px at a device ratio of 2, or another size. */
function map(width = 2880, height = 1800) {
  const recorder = recordingContext(width, height);
  const ratio = { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 };
  // The alpha each copy onto the map is laid down with.
  const alphas: number[] = [];
  const ctx = new Proxy(recorder.ctx, {
    get: (target, key) => {
      if (key === 'getTransform') return () => ratio;
      const value = Reflect.get(target, key);
      if (key !== 'drawImage') return value;
      return (...args: never[]) => {
        alphas.push(target.globalAlpha);
        return (value as (...args: never[]) => unknown)(...args);
      };
    },
    set: (target, key, value) => Reflect.set(target, key, value),
  });
  ctx.imageSmoothingEnabled = false;
  return { ctx, calls: recorder.calls, alphas };
}
const paint = (ctx: CanvasRenderingContext2D, minutes: number) =>
  renderTwilight({
    ctx,
    width: 1440,
    height: 900,
    camera: { x: 12.5, y: -40, zoom: 0.8 },
    places: [],
    selectedPlot: 'C3',
    hoveredPlot: 'D4',
    night: minutes < 360 || minutes >= 1200,
    showPlots: true,
    residents: [],
    followed: 'someone',
    minutes,
    day: 20_000,
  });
const looks = () => paints.map(({ ctx, night, marksNight }) => ({ ctx, night, marksNight }));

describe('The town between day and night', () => {
  it('is one plain paint outside the fades and in their unseen first and last seconds', () => {
    const { ctx, calls } = map();
    for (const minutes of [720, 1100, 1151, 1229.5, 1250, 180, 330.5, 409.5, 420])
      paint(ctx, minutes);
    expect(paints.map((p) => [p.ctx === ctx, p.night, p.marksNight])).toEqual([
      [true, false, undefined],
      [true, false, undefined],
      [true, false, undefined],
      [true, true, undefined],
      [true, true, undefined],
      [true, true, undefined],
      [true, true, undefined],
      [true, false, undefined],
      [true, false, undefined],
    ]);
    expect(canvases).toHaveLength(0);
    expect(calls.some((call) => call.name === 'drawImage')).toBe(false);
  });

  it('lays the night look over the day one at dusk, weighted by the night share', () => {
    const { ctx, calls, alphas } = map();
    paint(ctx, 1170);
    const [twin] = canvases;
    // Before the lights, the plot marks keep their day ink in both looks.
    expect(looks()).toEqual([
      { ctx, night: false, marksNight: false },
      { ctx: twin.ctx.ctx, night: true, marksNight: false },
    ]);
    // Both looks are the same moment, seen the same way.
    const [base, over] = paints.map(({ ctx: _, night: __, ...rest }) => rest);
    expect(over).toEqual(base);
    expect(base).toMatchObject({ minutes: 1170, selectedPlot: 'C3', followed: 'someone' });
    // The twin matches the map pixel for pixel and draws at the same device scale.
    expect(twin).toMatchObject({ width: 2880, height: 1800 });
    expect(twin.ctx.calls.find((call) => call.name === 'setTransform')?.args).toEqual([
      { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 },
    ]);
    expect(twin.ctx.ctx.imageSmoothingEnabled).toBe(false);
    const names = calls.map((call) => call.name);
    expect(names.slice(-4)).toEqual(['save', 'resetTransform', 'drawImage', 'restore']);
    expect(calls.at(-2)?.args).toEqual([twin, 0, 0]);
    // A sixth of the way into the fade, the night look is laid down at a sixth.
    expect(alphas).toEqual([townNightShare(1170)]);
    expect(alphas[0]).toBeCloseTo(0.156, 3);
    // The pitch's runners face the same way in both looks.
    expect(shared).toEqual([[twin.ctx.ctx, ctx]]);
  });

  it('keeps one look per canvas through the whole fade, and the marks turn at 20:00', () => {
    const { ctx, alphas } = map();
    for (let minutes = 1153; minutes < 1228; minutes += 5) paint(ctx, minutes);
    expect(canvases).toHaveLength(1);
    const [twin] = canvases;
    for (const { ctx: canvas, night, marksNight, minutes = 0 } of paints) {
      expect(night).toBe(canvas === twin.ctx.ctx);
      expect(marksNight).toBe(minutes >= 1200);
    }
    // Darker every frame.
    expect(alphas).toEqual([...alphas].sort((a, b) => a - b));
    expect(alphas.at(-1)).toBeGreaterThan(0.97);
  });

  it('lays the day look over the night one at dawn', () => {
    const { ctx, alphas } = map();
    paint(ctx, 345);
    paint(ctx, 395);
    const [twin] = canvases;
    expect(looks()).toEqual([
      { ctx, night: true, marksNight: true },
      { ctx: twin.ctx.ctx, night: false, marksNight: true },
      { ctx, night: true, marksNight: false },
      { ctx: twin.ctx.ctx, night: false, marksNight: false },
    ]);
    // Nearly night at 05:45, nearly day at 06:35.
    expect(alphas).toEqual([1 - townNightShare(345), 1 - townNightShare(395)]);
    expect(alphas[0]).toBeCloseTo(0.092, 3);
    expect(alphas[1]).toBeCloseTo(0.908, 3);
  });

  it("gives the twin and its caches back as soon as the fade is over, never the map's", () => {
    const { ctx } = map();
    paint(ctx, 1200);
    expect(released).toEqual([]);
    const twin = canvases[0].ctx.ctx;
    paint(ctx, 1240);
    expect(released.map(([name]) => name).sort()).toEqual(['football', 'ground', 'sprites']);
    for (const [, canvas] of released) expect(canvas).toBe(twin);
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 });
    // The next dusk makes a new one.
    paint(ctx, 1160 + 1440);
    expect(canvases).toHaveLength(2);
  });

  it('paints once on a map with no pixels yet', () => {
    const { ctx } = map(0, 0);
    paint(ctx, 1200);
    expect(looks()).toEqual([{ ctx, night: true, marksNight: undefined }]);
    expect(canvases).toHaveLength(0);
  });

  it('paints once in node, with no canvas to lay a second look on', () => {
    vi.unstubAllGlobals();
    const { ctx } = map();
    paint(ctx, 1200);
    expect(looks()).toEqual([{ ctx, night: true, marksNight: undefined }]);
  });
});
