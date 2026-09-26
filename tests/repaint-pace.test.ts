import { describe, expect, it } from 'vitest';
import { PAINT_INTERVAL, paintBeat } from '../src/lib/use-town-clock';

/** A seeded wobble, so every run replays the same frames. */
function wobble(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32 - 0.5;
  };
}

/** Frame timestamps like a browser gives them: a steady display, jitter, rounded to 0.1 ms. */
function frames(hz: number, seconds: number, jitter = 0.3, seed = 7) {
  const next = wobble(seed);
  return Array.from(
    { length: Math.round(hz * seconds) },
    (_, i) => Math.round((1000 + (i * 1000) / hz + next() * 2 * jitter) * 10) / 10,
  );
}

/** Which frames repaint under the town clock's rule. */
function replay(times: number[]) {
  const painted: number[] = [];
  let beat = -Infinity;
  times.forEach((now, i) => {
    const next = paintBeat(now, beat);
    if (next === null) return;
    beat = next;
    painted.push(i);
  });
  return painted;
}

const rate = (painted: number[], times: number[]) =>
  (painted.length - 1) / ((times[painted.at(-1)!] - times[painted[0]]) / 1000);
const gaps = (painted: number[]) => new Set(painted.slice(1).map((i, n) => i - painted[n]));

describe('The town repaints thirty times a second', () => {
  it('paints every second frame on a 60 Hz display, even with rounded, jittery timestamps', () => {
    const times = frames(60, 10);
    const painted = replay(times);
    expect(rate(painted, times)).toBeCloseTo(30, 0);
    expect(gaps(painted)).toEqual(new Set([2]));
  });

  it('keeps the beat on displays that run a little fast or slow', () => {
    for (const hz of [59.94, 60.5]) {
      const times = frames(hz, 10);
      expect(gaps(replay(times))).toEqual(new Set([2]));
    }
  });

  it('paints every fourth frame at 120 Hz', () => {
    const times = frames(120, 10);
    const painted = replay(times);
    expect(rate(painted, times)).toBeCloseTo(30, 0);
    expect(gaps(painted)).toEqual(new Set([4]));
  });

  it('stays close to thirty at 144 Hz, four or five frames apart', () => {
    const times = frames(144, 10);
    const painted = replay(times);
    expect(rate(painted, times)).toBeGreaterThan(29.5);
    expect(rate(painted, times)).toBeLessThan(30.2);
    expect(gaps(painted)).toEqual(new Set([4, 5]));
  });

  it('paints every frame when the display itself is slower', () => {
    for (const hz of [30, 24]) {
      const times = frames(hz, 5, 0.3, 3);
      expect(gaps(replay(times))).toEqual(new Set([1]));
    }
  });

  it('starts afresh after a stall instead of painting a burst to catch up', () => {
    const times = frames(60, 3);
    const stalled = times.map((t, i) => (i >= 60 ? t + 480 : t));
    const painted = replay(stalled);
    const after = painted.filter((i) => i >= 60);
    expect(after[0]).toBe(60);
    expect(gaps(after)).toEqual(new Set([2]));
    expect(PAINT_INTERVAL).toBeCloseTo(33.33, 2);
  });
});
