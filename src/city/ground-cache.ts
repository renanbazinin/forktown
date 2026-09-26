import { fontReady } from './font-check';

type Ctx = CanvasRenderingContext2D;
type GroundLayer = { canvas: HTMLCanvasElement; ctx: Ctx; key: string };

// One viewport-sized surface per map, released with its context. Never allocate a
// world-sized texture: the town can grow without growing this cache's footprint.
const layers = new WeakMap<Ctx, GroundLayer>();
const MAX_CACHE_PIXELS = 16_777_216;

export function paintGroundLayer(ctx: Ctx, sceneKey: string, paint: (ctx: Ctx) => void) {
  const { width, height } = ctx.canvas;
  if (
    typeof document === 'undefined' ||
    !width ||
    !height ||
    width * height > MAX_CACHE_PIXELS ||
    ctx.globalAlpha !== 1 ||
    ctx.globalCompositeOperation !== 'source-over'
  ) {
    paint(ctx);
    return;
  }
  const transform = ctx.getTransform();
  const key = [
    sceneKey,
    width,
    height,
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f,
    document.fonts?.status,
    fontReady('10px "Space Mono"'),
  ].join('|');
  let layer = layers.get(ctx);
  if (!layer) {
    const canvas = document.createElement('canvas');
    const cachedContext = canvas.getContext('2d');
    if (!cachedContext) {
      paint(ctx);
      return;
    }
    layer = { canvas, ctx: cachedContext, key: '' };
    layers.set(ctx, layer);
  }
  if (layer.key !== key) {
    if (layer.canvas.width !== width) layer.canvas.width = width;
    if (layer.canvas.height !== height) layer.canvas.height = height;
    layer.ctx.resetTransform();
    layer.ctx.clearRect(0, 0, width, height);
    layer.ctx.setTransform(transform);
    layer.ctx.imageSmoothingEnabled = false;
    paint(layer.ctx);
    layer.key = key;
  }
  // The layer already contains the caller's device-pixel and camera transforms.
  ctx.save();
  ctx.resetTransform();
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.restore();
}
