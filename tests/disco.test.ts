import { describe, expect, it } from 'vitest';
import { marqueeBulb } from '../src/city/cinema-props';
import { DISCO_FLOOR, discoTile } from '../src/city/disco';
import { EVENT_SPOTS } from '../src/lib/events';

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('The Midnight Disco', () => {
  it('lays its floor under every dancing spot, on the lawn and in front of the platform', () => {
    const { x0, x1, y0, y1 } = DISCO_FLOOR;
    // The plot's lawn reaches 1.38 either side of its centre; the platform ends at y = 0.2.
    expect(Math.max(-x0, x1, y1)).toBeLessThanOrEqual(1.38);
    expect(y0).toBeGreaterThan(0.2);
    for (const spot of EVENT_SPOTS.stage) {
      expect(spot.x).toBeGreaterThan(x0 + 0.05);
      expect(spot.x).toBeLessThan(x1 - 0.05);
      expect(spot.y).toBeGreaterThan(y0 + 0.05);
      expect(spot.y).toBeLessThanOrEqual(y1);
    }
  });

  it('changes its lights gradually, never in a flash', () => {
    // The town repaints at 30 frames a second, and a town minute is a real second.
    const frame = 1 / 30;
    let largest = 0;
    for (let t = 1410; t < 1590; t += 0.37)
      for (let col = 0; col < DISCO_FLOOR.cols; col++)
        for (let row = 0; row < DISCO_FLOOR.rows; row++) {
          const before = channels(discoTile(t, col, row)),
            after = channels(discoTile(t + frame, col, row));
          largest = Math.max(largest, ...before.map((c, i) => Math.abs(c - after[i])));
        }
    expect(largest).toBeLessThanOrEqual(6);
  });

  it('keeps the popcorn cart’s marquee bulbs gliding too, never blinking', () => {
    let largest = 0;
    for (const night of [false, true])
      for (let t = 1170; t < 1500; t += 0.37)
        for (let i = 0; i < 8; i++) {
          const before = channels(marqueeBulb(t, i, true, night)),
            after = channels(marqueeBulb(t + 1 / 30, i, true, night));
          largest = Math.max(largest, ...before.map((c, k) => Math.abs(c - after[k])));
        }
    expect(largest).toBeLessThanOrEqual(6);
  });
});
