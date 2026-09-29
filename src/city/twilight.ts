import { townNightShare } from '../lib/town-calendar';
import { releaseFootballLayers, shareFootballFacing } from './football';
import { releaseGroundLayer } from './ground-cache';
import { releaseHouseSprites } from './house-sprites';
import { renderCity, type RenderOptions } from './render';

type Ctx = CanvasRenderingContext2D;
type Twin = { canvas: HTMLCanvasElement; ctx: Ctx };

// Dusk and dawn. The town has two hand-picked looks, and every renderer paints one or the other.
// Through the fades the map is painted in both, each exactly as it is by day or by night, and the
// look it is turning to is laid over the other at the town's night share. That second look has a
// canvas of its own, so each canvas keeps one look for the whole fade and its ground layer, house
// sprites and pitch layers stay warm. Everything is painted for the same minute, so nothing that
// moves is ever doubled.
const twins = new WeakMap<Ctx, Twin>();

function twinFor(ctx: Ctx) {
  let twin = twins.get(ctx);
  if (!twin) {
    const canvas = document.createElement('canvas');
    const layer = canvas.getContext('2d');
    if (!layer) return null;
    twins.set(ctx, (twin = { canvas, ctx: layer }));
    // The pitch's runners must turn the same way in both looks.
    shareFootballFacing(layer, ctx);
  }
  return twin;
}
/** Gives a finished fade's canvas and its caches back straight away. */
function releaseTwin(ctx: Ctx) {
  const twin = twins.get(ctx);
  if (!twin) return;
  releaseGroundLayer(twin.ctx);
  releaseHouseSprites(twin.ctx);
  releaseFootballLayers(twin.ctx);
  twin.canvas.width = twin.canvas.height = 0;
  twins.delete(ctx);
}

/**
 * A weight that moves no 8-bit channel by as much as half a step: for the first and last two
 * seconds of each fade the second look would change nothing, so it is not painted.
 */
const UNSEEN = 1 / 510;

/**
 * renderCity for the map and the live broadcast. Outside dusk and dawn it is one plain paint with
 * the caller's `night`. Inside them the look the map had before the fade is painted as usual and
 * the one it is turning to goes over it, so the whole town turns with the sky instead of in a
 * single frame. Lights and events still keep their own minutes: a lamp lit only in the night
 * look swells in with it. The plot outlines and labels take the caller's `night` in both looks.
 * Without a document (node tests) it is always the one plain paint.
 */
export function renderTwilight(options: RenderOptions) {
  const { ctx, minutes = 0 } = options;
  const { width, height } = ctx.canvas;
  const evening = ((minutes % 1440) + 1440) % 1440 >= 720;
  const share = townNightShare(minutes);
  const weight = evening ? share : 1 - share;
  const twin =
    weight > UNSEEN && weight < 1 - UNSEEN && width && height && typeof document !== 'undefined'
      ? twinFor(ctx)
      : null;
  if (!twin) {
    releaseTwin(ctx);
    renderCity(options);
    return;
  }
  const transform = ctx.getTransform();
  const smoothing = ctx.imageSmoothingEnabled;
  const marksNight = options.marksNight ?? options.night;
  renderCity({ ...options, night: !evening, marksNight });
  if (twin.canvas.width !== width) twin.canvas.width = width;
  if (twin.canvas.height !== height) twin.canvas.height = height;
  twin.ctx.setTransform(transform);
  twin.ctx.imageSmoothingEnabled = smoothing;
  renderCity({ ...options, ctx: twin.ctx, night: evening, marksNight });
  // Device pixel onto device pixel, so the pixel art stays crisp.
  ctx.save();
  ctx.resetTransform();
  ctx.globalAlpha = weight;
  ctx.drawImage(twin.canvas, 0, 0);
  ctx.restore();
}
