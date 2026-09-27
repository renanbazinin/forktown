import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { placeSchema } from '../src/lib/schema';
import { townCatAt } from '../src/lib/town-cat';
import { getPlot, isRoad, plotEntrance } from '../src/lib/world';
import { fullTown, readPlaces } from './full-town';

const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
const homes = ['A1', 'A2', 'B1', 'B2', 'D4'].map((plot) => ({
  ...sample,
  id: `cat-${plot}`,
  plot,
}));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('Miso’s nightly neighborhood walks', () => {
  it('starts at a chosen home each evening, varies homes, and sleeps during daylight', () => {
    const chosen = new Set<string>();
    for (let day = 0; day < 30; day++) {
      const cat = townCatAt(homes, 1200, day);
      expect(cat.outside).toBe(true);
      expect(homes.some((home) => home.plot === cat.homePlot)).toBe(true);
      expect(cat.position).toEqual(plotEntrance(getPlot(cat.homePlot)!));
      expect(townCatAt(homes, 1199.99, day).outside).toBe(false);
      expect(townCatAt(homes, 359.99, day + 1).outside).toBe(true);
      expect(townCatAt(homes, 360, day + 1).outside).toBe(false);
      chosen.add(cat.homePlot);
    }
    expect(chosen.size).toBeGreaterThan(1);
  });

  it('is reproducible regardless of input order, clock wrapping, or midnight', () => {
    for (let day = 0; day < 5; day++) {
      for (const minute of [1200, 1350, 1439.99, 1500, 1799.99]) {
        const cat = townCatAt(homes, minute, day);
        expect(townCatAt([...homes].reverse(), minute, day)).toEqual(cat);
        expect(townCatAt(homes, minute % 1440, day + Math.floor(minute / 1440))).toEqual(cat);
      }
      const before = townCatAt(homes, 1439.999, day);
      const after = townCatAt(homes, 0, day + 1);
      expect(after.homePlot).toBe(before.homePlot);
      expect(distance(before.position, after.position)).toBeLessThan(0.0001);
    }
  });

  it('walks faster along connected local streets and visits nearby houses', () => {
    for (const places of [homes, [homes[0]], []]) {
      for (let day = 0; day < 5; day++) {
        const start = townCatAt(places, 1200, day);
        const doorstep = plotEntrance(getPlot(start.homePlot)!);
        const visited = new Set<string>();
        // One even pace all night, as near his usual 0.065 tiles a minute as whole laps allow.
        const pace = distance(start.position, townCatAt(places, 1200.001, day).position) / 0.001;
        expect(pace).toBeGreaterThan(0.065 * 0.7);
        expect(pace).toBeLessThan(0.065 * 1.3);
        for (let time = 1200; time < 1800; time += 0.5) {
          const cat = townCatAt(places, time, day);
          expect(isRoad(Math.floor(cat.position.x), Math.floor(cat.position.y))).toBe(true);
          expect(distance(cat.position, doorstep)).toBeLessThanOrEqual(10);
          const next = townCatAt(places, time + 0.001, day);
          expect(distance(cat.position, next.position)).toBeCloseTo(pace * 0.001, 5);
          for (const home of places) {
            if (distance(cat.position, plotEntrance(getPlot(home.plot)!)) < 0.04)
              visited.add(home.plot);
          }
        }
        if (places.length > 1 && start.homePlot !== 'D4') expect(visited.size).toBeGreaterThan(1);
      }
    }
  });

  it('is back on his own step when the night ends, never out in the street at 06:00', () => {
    const town = readPlaces();
    for (const places of [homes, [homes[0]], town, fullTown(town)])
      for (let day = 0; day < 40; day++) {
        const { homePlot } = townCatAt(places, 1200, day);
        const doorstep = plotEntrance(getPlot(homePlot)!);
        const dawn = townCatAt(places, 359.999, day + 1);
        expect(dawn.homePlot).toBe(homePlot);
        expect(dawn.outside).toBe(true);
        // Within a hundredth of a second's walk of his own doorstep, then indoors.
        expect(distance(dawn.position, doorstep)).toBeLessThan(0.0001);
        expect(townCatAt(places, 360, day + 1).outside).toBe(false);
      }
  });
});
