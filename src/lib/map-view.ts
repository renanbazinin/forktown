// The visitor's view of the map as plain numbers, so pinch, resize and zoom rules run in node.
// A view maps a world point p to the screen at p * zoom + (x, y).

export type View = { x: number; y: number; zoom: number };
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

/**
 * A venue's panel view of a frame (`{ center, width, height }`, world px): beside the desktop
 * panel (370 px on the right), or above the phone's sheet (the top 29%), as large as fits up to
 * zoom 1.4.
 */
export function frameView(
  frame: { center: Point; width: number; height: number },
  width: number,
  height: number,
): View {
  const mobile = width < 600;
  const zoom = Math.max(
    0.05,
    Math.min(
      1.4,
      (width - (mobile ? 24 : 400)) / frame.width,
      (mobile ? height * 0.43 : height - 150) / frame.height,
    ),
  );
  return {
    x: (mobile ? width / 2 : (width - 370) / 2) - frame.center.x * zoom,
    y: (mobile ? height * 0.29 : height * 0.5) - frame.center.y * zoom,
    zoom,
  };
}

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

/** The world's extent in world px (WORLD_BOUNDS): its left and right tips and its bottom tip. */
export type Bounds = { left: number; right: number; bottom: number };

/** The whole town at its fit zoom, centred, with room for the controls. */
export function fitView(width: number, height: number, bounds: Bounds): View {
  const zoom = Math.max(
    0.01,
    Math.min(
      (width - 52) / (bounds.right - bounds.left + 36),
      (height - 85) / (bounds.bottom + 98),
    ),
  );
  return {
    x: width / 2 - ((bounds.left + bounds.right) / 2) * zoom,
    y: (height - bounds.bottom * zoom) / 2 + 28,
    zoom,
  };
}

/** Screen px under the top of the map that the header and the clock cover. */
export const MAP_HEADER = 96;

/**
 * The map's opening view: where people live, from the centres (world px) of the homes and the
 * town's green and stage. A lone far-off house does not zoom it back out, and a town with every
 * plot taken opens no further out than 0.35 (0.15 on a phone) rather than at whole-town fit,
 * every house tiny; Reset still shows it all. Then the homes no longer fit, and the view moves
 * down far enough to keep `keep` (the Lantern Fork's crown) below the header. With no points,
 * the overview.
 */
export function neighborhoodView(
  points: readonly Point[],
  width: number,
  height: number,
  overview: View,
  keep?: Point,
): View {
  if (!points.length) return overview;
  const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1];
  const mid = { x: median(points.map((p) => p.x)), y: median(points.map((p) => p.y)) };
  const distance = (p: Point) => Math.hypot(p.x - mid.x, p.y - mid.y);
  const typical = median(points.map(distance));
  const near = points.filter((p) => distance(p) <= Math.max(typical * 2.2, 260));
  const left = Math.min(...near.map((point) => point.x)) - 110;
  const right = Math.max(...near.map((point) => point.x)) + 110;
  const top = Math.min(...near.map((point) => point.y)) - 145;
  const bottom = Math.max(...near.map((point) => point.y)) + 80;
  const floor = Math.max(overview.zoom, width < 600 ? 0.15 : 0.35);
  const fitted = Math.min(
    0.85,
    (width < 600 ? width * 1.6 : width - 150) / (right - left),
    (height - 160) / (bottom - top),
  );
  const zoom = Math.max(floor, fitted);
  const y = height * (width < 600 ? 0.42 : 0.5) - ((top + bottom) / 2) * zoom;
  return {
    x: width / 2 - ((left + right) / 2) * zoom,
    y: keep && floor > fitted ? Math.max(y, MAP_HEADER - keep.y * zoom) : y,
    zoom,
  };
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
