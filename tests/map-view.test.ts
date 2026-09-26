import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  pinchView,
  resizeView,
  steadyListening,
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

describe('Two fingers pinch the map', () => {
  const fit = 0.3;
  const start: View = { x: 100, y: 50, zoom: 1 };

  it('scales by how far the fingers spread, around the point between them', () => {
    const from = [
      { x: 170, y: 400 },
      { x: 230, y: 400 },
    ] as const;
    const to = [
      { x: 80, y: 400 },
      { x: 320, y: 400 },
    ] as const;
    const between = world(start, { x: 200, y: 400 });
    const after = pinchView(start, from, to, fit);
    expect(after.zoom).toBeCloseTo(4, 6);
    near(screen(after, between), { x: 200, y: 400 });
  });

  it('pans with the fingers when they move together', () => {
    const from = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ] as const;
    const to = [
      { x: 140, y: 160 },
      { x: 240, y: 160 },
    ] as const;
    const after = pinchView(start, from, to, fit);
    expect(after).toEqual({ x: 140, y: 110, zoom: 1 });
  });

  it('stops at the same limits as the wheel', () => {
    const from = [
      { x: 190, y: 100 },
      { x: 210, y: 100 },
    ] as const;
    const wide = [
      { x: 0, y: 100 },
      { x: 1000, y: 100 },
    ] as const;
    expect(pinchView(start, from, wide, fit).zoom).toBe(6);
    expect(pinchView(start, wide, from, fit).zoom).toBeCloseTo(zoomRange(fit).min, 6);
  });

  it('never divides by fingers that start on the same spot', () => {
    const same = [
      { x: 50, y: 50 },
      { x: 50, y: 50 },
    ] as const;
    const after = pinchView(start, same, same, fit);
    expect(Number.isFinite(after.x) && Number.isFinite(after.y)).toBe(true);
  });
});

describe('What the camera hears', () => {
  it('holds back changes too small to hear', () => {
    const old = { gain: 0.4, pan: 0.2 };
    expect(steadyListening(old, { gain: 0.405, pan: 0.21 })).toBe(old);
    const louder = { gain: 0.42, pan: 0.2 };
    expect(steadyListening(old, louder)).toBe(louder);
    const across = { gain: 0.4, pan: 0.25 };
    expect(steadyListening(old, across)).toBe(across);
  });

  it('always lets the sound fall silent, however quiet it was', () => {
    const faint = { gain: 0.004, pan: 0.1 };
    const silent = { gain: 0, pan: 0.1 };
    expect(steadyListening(faint, silent)).toBe(silent);
  });

  it('ignores the pan while it is silent, so a followed walk far away re-renders nothing', () => {
    const silent = { gain: 0, pan: -0.4 };
    expect(steadyListening(silent, { gain: 0, pan: 0.9 })).toBe(silent);
    const heard = { gain: 0.05, pan: 0.9 };
    expect(steadyListening(silent, heard)).toBe(heard);
  });
});
