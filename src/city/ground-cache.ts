import { fontReady } from './font-check';

type Ctx = CanvasRenderingContext2D;
/** A rectangle of the world, in world px, that a paint may cull to. */
export type GroundArea = { left: number; right: number; top: number; bottom: number };
/** Paints the ground; given an area, it may skip whatever lies wholly outside it. */
export type GroundPaint = (ctx: Ctx, area?: GroundArea) => void;
/**
 * The hover and selection marks painted into the ground. `areas` says where a given `key` paints
 * them, or returns null when it cannot say, which repaints the whole layer.
 */
export type GroundEmphasis = { key: string; areas: (key: string) => GroundArea[] | null };
type Band = { canvas: HTMLCanvasElement; ctx: Ctx; top: number };
type GroundLayer = {
  bands: Band[];
  key: string;
  emphasis: string;
  /** The canvas transform of the previous frame, to tell a moving camera from a resting one. */
  camera: number[];
};

// One viewport-sized surface per map, released with its context. Never allocate a
// world-sized texture: the town can grow without growing this cache's footprint. A canvas over
// MAX_CACHE_PIXELS, a 6K or 8K screen, is cached in horizontal bands of at most that size, as
// Safari will not allocate a larger canvas; one larger still is painted directly.
const layers = new WeakMap<Ctx, GroundLayer>();
const MAX_CACHE_PIXELS = 16_777_216;
const MAX_BANDS = 2;

function bandTops(width: number, height: number) {
  const rows = Math.max(1, Math.floor(MAX_CACHE_PIXELS / width));
  const tops: number[] = [];
  for (let top = 0; top < height; top += rows) tops.push(top);
  return { rows, tops };
}
/**
 * Paints the ground straight onto the map. The settings it leaves behind stay with it, as they do
 * in the layer, so nothing the map draws next, like the stage's notes, inherits the plot labels'
 * centred text.
 */
function paintDirectly(ctx: Ctx, paint: GroundPaint) {
  ctx.save();
  paint(ctx);
  ctx.restore();
}
/** The world area under a band of device rows, for culling that band's paint. */
function areaOf(t: DOMMatrix, left: number, top: number, right: number, bottom: number) {
  return {
    left: (left - t.e) / t.a,
    right: (right - t.e) / t.a,
    top: (top - t.f) / t.d,
    bottom: (bottom - t.f) / t.d,
  };
}

export function paintGroundLayer(
  ctx: Ctx,
  sceneKey: string,
  paint: GroundPaint,
  emphasis: GroundEmphasis = { key: '', areas: () => [] },
) {
  const { width, height } = ctx.canvas;
  if (
    typeof document === 'undefined' ||
    !width ||
    !height ||
    width * height > MAX_CACHE_PIXELS * MAX_BANDS ||
    ctx.globalAlpha !== 1 ||
    ctx.globalCompositeOperation !== 'source-over'
  ) {
    paintDirectly(ctx, paint);
    return;
  }
  const transform = ctx.getTransform();
  const camera = [transform.a, transform.b, transform.c, transform.d, transform.e, transform.f];
  const key = [
    sceneKey,
    width,
    height,
    ...camera,
    document.fonts?.status,
    fontReady('10px "Space Mono"'),
  ].join('|');
  let layer = layers.get(ctx);
  if (!layer) {
    layer = { bands: [], key: '', emphasis: '', camera: [] };
    layers.set(ctx, layer);
  }
  const moving = !camera.every((value, i) => value === layer.camera[i]);
  layer.camera = camera;
  if (layer.key !== key && moving && layer.key) {
    // A camera on the move invalidates the layer every frame, so the ground is painted straight
    // onto the map, saving a clear and a full-screen copy; the layer is rebuilt once it rests.
    paintDirectly(ctx, paint);
    return;
  }
  const { rows, tops } = bandTops(width, height);
  if (layer.bands.length !== tops.length) {
    for (const band of layer.bands) band.canvas.width = band.canvas.height = 0;
    layer.bands = [];
    for (const top of tops) {
      const canvas = document.createElement('canvas');
      const cachedContext = canvas.getContext('2d');
      if (!cachedContext) {
        layer.bands = [];
        paintDirectly(ctx, paint);
        return;
      }
      layer.bands.push({ canvas, ctx: cachedContext, top });
    }
    layer.key = '';
  }
  const repaint = (band: Band, clip?: { x: number; y: number; w: number; h: number }) => {
    const bottom = Math.min(height, band.top + rows);
    const target = band.ctx;
    target.resetTransform();
    if (clip) {
      target.save();
      target.beginPath();
      target.rect(clip.x, clip.y - band.top, clip.w, clip.h);
      target.clip();
      target.clearRect(clip.x, clip.y - band.top, clip.w, clip.h);
    } else target.clearRect(0, 0, width, bottom - band.top);
    target.setTransform(
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f - band.top,
    );
    target.imageSmoothingEnabled = false;
    const box = clip ?? { x: 0, y: band.top, w: width, h: bottom - band.top };
    paint(
      target,
      transform.b || transform.c
        ? undefined
        : areaOf(transform, box.x, box.y, box.x + box.w, box.y + box.h),
    );
    if (clip) target.restore();
  };
  if (layer.key !== key) {
    for (const [i, band] of layer.bands.entries()) {
      // A resize can move the seam between bands.
      band.top = tops[i];
      const bottom = Math.min(height, band.top + rows);
      if (band.canvas.width !== width) band.canvas.width = width;
      if (band.canvas.height !== bottom - band.top) band.canvas.height = bottom - band.top;
      repaint(band);
    }
    layer.key = key;
    layer.emphasis = emphasis.key;
  } else if (layer.emphasis !== emphasis.key) {
    // Only the hover or selection moved: repaint just the plots it leaves and reaches.
    const before = emphasis.areas(layer.emphasis),
      after = emphasis.areas(emphasis.key);
    const areas = before && after && !transform.b && !transform.c ? [...before, ...after] : null;
    for (const band of layer.bands) {
      const bottom = Math.min(height, band.top + rows);
      if (!areas) {
        repaint(band);
        continue;
      }
      for (const area of areas) {
        const x0 = Math.max(0, Math.floor(transform.a * area.left + transform.e)),
          x1 = Math.min(width, Math.ceil(transform.a * area.right + transform.e)),
          y0 = Math.max(band.top, Math.floor(transform.d * area.top + transform.f)),
          y1 = Math.min(bottom, Math.ceil(transform.d * area.bottom + transform.f));
        if (x1 > x0 && y1 > y0) repaint(band, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
    }
    layer.emphasis = emphasis.key;
  }
  // The layer already contains the caller's device-pixel and camera transforms.
  ctx.save();
  ctx.resetTransform();
  for (const band of layer.bands) ctx.drawImage(band.canvas, 0, band.top);
  ctx.restore();
}
