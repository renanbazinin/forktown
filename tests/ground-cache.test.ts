import { afterEach, describe, expect, it, vi } from 'vitest';
import { paintGroundLayer, type GroundArea } from '../src/city/ground-cache';

function surface(width = 1280, height = 720) {
  const canvas = { width, height };
  const transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const ctx = {
    canvas,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    getTransform: () => ({ ...transform }),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, canvas, transform, mock: ctx };
}
function browser() {
  const font = { status: 'loaded', check: vi.fn(() => true) };
  const layers: ReturnType<typeof surface>[] = [];
  const createElement = vi.fn(() => {
    const layer = surface();
    layers.push(layer);
    return Object.assign(layer.canvas, { getContext: () => layer.ctx });
  });
  vi.stubGlobal('document', { createElement, fonts: font });
  return { createElement, font, layers };
}
afterEach(() => vi.unstubAllGlobals());

describe('Viewport ground caching', () => {
  it('reuses terrain across animation frames without growing the number of surfaces', () => {
    const { createElement } = browser();
    const { ctx } = surface();
    const paint = vi.fn();
    for (let frame = 0; frame < 100; frame++) paintGroundLayer(ctx, 'day:A1', paint);
    expect(paint).toHaveBeenCalledTimes(1);
    expect(createElement).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledTimes(100);
  });

  it('paints straight onto the map while the camera moves, and caches again once it rests', () => {
    const { createElement, layers } = browser();
    const { ctx, transform } = surface();
    const paint = vi.fn();
    paintGroundLayer(ctx, 'day:A1', paint);
    const layer = layers[0].ctx;
    expect(paint).toHaveBeenLastCalledWith(layer, expect.anything());
    // A pan: every frame lands the ground somewhere new, so the layer is not rebuilt.
    for (let frame = 1; frame <= 5; frame++) {
      transform.e = frame * 7.5;
      paintGroundLayer(ctx, 'day:A1', paint);
      expect(paint).toHaveBeenLastCalledWith(ctx);
    }
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    // At rest the layer is repainted once, then reused.
    paintGroundLayer(ctx, 'day:A1', paint);
    expect(paint).toHaveBeenLastCalledWith(layer, expect.anything());
    paintGroundLayer(ctx, 'day:A1', paint);
    expect(paint).toHaveBeenCalledTimes(7);
    // A zoom is a move too.
    transform.a = transform.d = 2;
    paintGroundLayer(ctx, 'day:A1', paint);
    expect(paint).toHaveBeenLastCalledWith(ctx);
    paintGroundLayer(ctx, 'day:A1', paint);
    expect(paint).toHaveBeenLastCalledWith(layer, expect.anything());
    expect(createElement).toHaveBeenCalledTimes(1);
  });

  it('refreshes pixels after resize, scene changes and font loading', () => {
    const { createElement, font } = browser();
    const { ctx, canvas } = surface();
    const paint = vi.fn();
    paintGroundLayer(ctx, 'day:A1', paint);
    canvas.width = 780;
    canvas.height = 1688;
    paintGroundLayer(ctx, 'day:A1', paint);
    paintGroundLayer(ctx, 'night:A1', paint);
    paintGroundLayer(ctx, 'night:A1,A2', paint);
    font.status = 'loading';
    paintGroundLayer(ctx, 'night:A1,A2', paint);
    font.status = 'loaded';
    paintGroundLayer(ctx, 'night:A1,A2', paint);
    expect(paint).toHaveBeenCalledTimes(6);
    expect(createElement).toHaveBeenCalledTimes(1);
    const cached = createElement.mock.results[0].value;
    expect([cached.width, cached.height]).toEqual([780, 1688]);
    paintGroundLayer(ctx, 'night:A1,A2', paint);
    expect(paint).toHaveBeenCalledTimes(6);
  });

  it('repaints only the plots the hover or selection leaves and reaches', () => {
    const { layers } = browser();
    const { ctx, transform } = surface();
    transform.a = transform.d = 0.5;
    transform.e = 300.25;
    transform.f = 40;
    const plots: Record<string, GroundArea> = {
      A1: { left: 100, right: 324, top: 50, bottom: 166 },
      B2: { left: 600, right: 824, top: 300, bottom: 416 },
    };
    const marks = (key: string) => ({
      key,
      areas: (k: string) =>
        k === 'tube' ? null : k.split(' ').flatMap((id) => (plots[id] ? [plots[id]] : [])),
    });
    const paint = vi.fn();
    paintGroundLayer(ctx, 'day', paint, marks(''));
    const layer = layers[0].mock;
    paint.mockClear();
    layer.clearRect.mockClear();
    // The pointer moves onto A1: only A1's box is cleared and painted again.
    paintGroundLayer(ctx, 'day', paint, marks('A1'));
    expect(paint).toHaveBeenCalledTimes(1);
    const [, area] = paint.mock.calls[0];
    expect(area.left).toBeLessThanOrEqual(100);
    expect(area.right).toBeGreaterThanOrEqual(324);
    expect(area.right - area.left).toBeLessThan(230);
    // The cleared box is snapped outward to whole device pixels, so no seam can show.
    expect(layer.clearRect).toHaveBeenCalledWith(350, 65, 113, 58);
    expect(layer.rect).toHaveBeenLastCalledWith(350, 65, 113, 58);
    // From A1 to B2: the plot it leaves and the plot it reaches.
    paint.mockClear();
    paintGroundLayer(ctx, 'day', paint, marks('B2'));
    expect(paint).toHaveBeenCalledTimes(2);
    // Holding still costs nothing more.
    paint.mockClear();
    paintGroundLayer(ctx, 'day', paint, marks('B2'));
    expect(paint).not.toHaveBeenCalled();
    // A mark that cannot say where it paints repaints the whole layer.
    paintGroundLayer(ctx, 'day', paint, marks('tube'));
    expect(paint).toHaveBeenCalledTimes(1);
    expect(paint.mock.calls[0][1].right - paint.mock.calls[0][1].left).toBe(1280 / 0.5);
  });

  it('caches a very large screen in bands no larger than a canvas may safely be', () => {
    const { createElement } = browser();
    // A 6K display at twice the pixel density.
    const { ctx, canvas } = surface(6016, 3384);
    const paint = vi.fn();
    paintGroundLayer(ctx, 'day', paint);
    paintGroundLayer(ctx, 'day', paint);
    expect(createElement).toHaveBeenCalledTimes(2);
    const bands = createElement.mock.results.map((result) => result.value);
    for (const band of bands) expect(band.width * band.height).toBeLessThanOrEqual(16_777_216);
    expect(bands.reduce((sum, band) => sum + band.height, 0)).toBe(3384);
    expect(paint).toHaveBeenCalledTimes(2);
    expect(ctx.drawImage).toHaveBeenCalledTimes(4);
    expect(ctx.drawImage).toHaveBeenLastCalledWith(bands[1], 0, bands[0].height);
    // A narrower window fits more rows in a band, so the seam moves down.
    canvas.width = 5000;
    paintGroundLayer(ctx, 'day', paint);
    expect(createElement).toHaveBeenCalledTimes(2);
    expect(bands[0].width * bands[0].height).toBeLessThanOrEqual(16_777_216);
    expect(bands[0].height + bands[1].height).toBe(3384);
    expect(ctx.drawImage).toHaveBeenLastCalledWith(bands[1], 0, bands[0].height);
  });

  it('isolates maps and draws oversized or translucent views directly', () => {
    const { createElement } = browser();
    const a = surface(),
      b = surface();
    const paint = vi.fn();
    paintGroundLayer(a.ctx, 'day', paint);
    paintGroundLayer(b.ctx, 'day', paint);
    expect(createElement).toHaveBeenCalledTimes(2);
    a.canvas.width = a.canvas.height = 8192;
    paintGroundLayer(a.ctx, 'day', paint);
    expect(paint).toHaveBeenLastCalledWith(a.ctx);
    b.ctx.globalAlpha = 0.5;
    paintGroundLayer(b.ctx, 'day', paint);
    expect(paint).toHaveBeenLastCalledWith(b.ctx);
    expect(createElement).toHaveBeenCalledTimes(2);
  });
});
