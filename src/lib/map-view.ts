// The visitor's view of the map as plain numbers, so pinch, resize and zoom rules run in node.
// A view maps a world point p to the screen at p * zoom + (x, y).

export type View = { x: number; y: number; zoom: number };
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

/** How far the map zooms at a given whole-town fit: a little past the whole town, up to a sign. */
export function zoomRange(fit: number) {
  return { min: fit * 0.65, max: Math.max(6, fit * 3.5) };
}

export function clampZoom(zoom: number, fit: number) {
  const { min, max } = zoomRange(fit);
  return Math.max(min, Math.min(max, zoom));
}

/** Changes the zoom while the map point under `anchor` stays where it is on screen. */
export function zoomAround(view: View, zoom: number, anchor: Point): View {
  return {
    x: anchor.x - ((anchor.x - view.x) * zoom) / view.zoom,
    y: anchor.y - ((anchor.y - view.y) * zoom) / view.zoom,
    zoom,
  };
}

/**
 * Keeps the visitor's view through a resize: the map point in the middle of the screen stays in
 * the middle, and the zoom only moves if the new size puts it out of range.
 */
export function resizeView(view: View, from: Size, to: Size, fit: number): View {
  const moved = {
    ...view,
    x: view.x + (to.width - from.width) / 2,
    y: view.y + (to.height - from.height) / 2,
  };
  return zoomAround(moved, clampZoom(view.zoom, fit), { x: to.width / 2, y: to.height / 2 });
}

const middle = ([a, b]: readonly [Point, Point]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const spread = ([a, b]: readonly [Point, Point]) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Two fingers on the map: it scales by how far apart they have moved, clamped like the wheel, and
 * the map point that was between them follows the point between them now.
 */
export function pinchView(
  start: View,
  from: readonly [Point, Point],
  to: readonly [Point, Point],
  fit: number,
): View {
  const before = middle(from),
    after = middle(to);
  const zoom = clampZoom((start.zoom * spread(to)) / Math.max(1, spread(from)), fit);
  return {
    x: after.x - ((before.x - start.x) * zoom) / start.zoom,
    y: after.y - ((before.y - start.y) * zoom) / start.zoom,
    zoom,
  };
}

export type Listening = { gain: number; pan: number };

/**
 * Keeps the last reading while the change is too small to hear (the players glide to each new
 * level anyway), so a camera following a walker does not re-render the whole app on every frame.
 * While it is silent the pan does not matter, and falling silent always gets through.
 */
export function steadyListening(old: Listening, next: Listening): Listening {
  if (old.gain === 0 && next.gain === 0) return old;
  if (old.gain === 0 || next.gain === 0) return next;
  return Math.abs(old.gain - next.gain) < 0.01 && Math.abs(old.pan - next.pan) < 0.02 ? old : next;
}
