import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  resizeView,
  zoomAround,
  zoomRange,
  type Point,
  type View,
} from '../src/lib/map-view';

/** Where a world point lands on screen. */
const screen = (view: View, world: Point) => ({
  x: world.x * view.zoom + view.x,
  y: world.y * view.zoom + view.y,
});
/** Which world point sits under a screen point. */
const world = (view: View, at: Point) => ({
  x: (at.x - view.x) / view.zoom,
  y: (at.y - view.y) / view.zoom,
});
const near = (a: Point, b: Point) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};

describe('The map keeps the visitor’s view', () => {
  const fit = 0.3;
  const zoomedIn: View = { x: -2400, y: -900, zoom: 1.7 };

  it('keeps the middle of the screen and the zoom through a resize', () => {
    const from = { width: 1280, height: 800 },
      to = { width: 1280, height: 760 };
    const middle = world(zoomedIn, { x: 640, y: 400 });
    const after = resizeView(zoomedIn, from, to, fit);
    expect(after.zoom).toBe(1.7);
    near(screen(after, middle), { x: 640, y: 380 });
  });

  it('keeps the view when a phone turns sideways', () => {
    const middle = world(zoomedIn, { x: 195, y: 422 });
    const after = resizeView(
      zoomedIn,
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      fit,
    );
    expect(after.zoom).toBe(1.7);
    near(screen(after, middle), { x: 422, y: 195 });
  });

  it('only moves the zoom when the new size puts it out of range', () => {
    const far: View = { x: 600, y: 300, zoom: 0.2 };
    const after = resizeView(far, { width: 800, height: 600 }, { width: 1600, height: 1000 }, 0.5);
    expect(after.zoom).toBe(zoomRange(0.5).min);
    const middle = world({ ...far, x: far.x + 400, y: far.y + 200 }, { x: 800, y: 500 });
    near(screen(after, middle), { x: 800, y: 500 });
  });

  it('zooms around a point that stays put, within the wheel’s range', () => {
    const anchor = { x: 300, y: 200 };
    const under = world(zoomedIn, anchor);
    const after = zoomAround(zoomedIn, clampZoom(zoomedIn.zoom * 1.2, fit), anchor);
    near(screen(after, under), anchor);
    expect(clampZoom(100, fit)).toBe(6);
    expect(clampZoom(0.01, fit)).toBeCloseTo(0.195, 6);
  });
});
