import { describe, expect, it } from 'vitest';
import { createWorldLayout } from '../src/lib/world-layout';
import { PLOTS, plotEntrance } from '../src/lib/world';
import { simulateResidents } from '../src/lib/simulation';
import { placeSchema } from '../src/lib/schema';
import { readFileSync } from 'node:fs';
import { plotDoor } from '../src/lib/home-life';
import { TOWN_SIZE } from '../src/lib/town-config';

describe('Growing the town without moving contributions', () => {
  it('doubles the capacity while preserving every original address and coordinate', () => {
    const original = createWorldLayout({ rows: 10, columns: 10 });
    const expanded = createWorldLayout({ rows: 20, columns: 10 });
    expect(expanded.plots).toHaveLength(original.plots.length * 2);
    for (const plot of original.plots) expect(expanded.getPlot(plot.id)).toEqual(plot);
    expect(expanded.getPlot('A10')).toMatchObject({ x: 39, y: 3 });
    expect(expanded.getPlot('E10')).toMatchObject({ x: 39, y: 19 });
  });

  it.each([
    { rows: TOWN_SIZE.rows + 2, columns: TOWN_SIZE.columns + 1 },
    { rows: TOWN_SIZE.rows + 8, columns: TOWN_SIZE.columns + 3 },
  ])('supports later growth to $rows rows and $columns columns', (size) => {
    const future = createWorldLayout(size);
    for (const plot of PLOTS) expect(future.getPlot(plot.id)).toEqual(plot);
    expect(new Set(future.plots.map((plot) => plot.id)).size).toBe(size.rows * size.columns);
    for (const plot of future.plots) {
      expect(future.findPlotAt(plot.x + 0.5, plot.y + 0.5)).toEqual(plot);
      const entrance = plotEntrance(plot);
      expect(future.isRoad(Math.floor(entrance.x), Math.floor(entrance.y))).toBe(true);
      expect(future.findPlotAt(entrance.x, entrance.y)).toBeUndefined();
    }
  });

  it('accepts and simulates a contribution on the new far edge', () => {
    const edge = `T${TOWN_SIZE.columns}`;
    const home = placeSchema.parse({
      ...JSON.parse(readFileSync('examples/my-little-place.json', 'utf8')),
      id: 'new-edge',
      plot: edge,
    });
    const state = simulateResidents([home], 0)[0];
    expect(state.home.plot).toBe(edge);
    // Asleep at midnight, just inside the new home's front door.
    expect(state.position).toEqual(plotDoor(PLOTS.find((plot) => plot.id === edge)!));
    expect(placeSchema.safeParse({ ...home, plot: `T${TOWN_SIZE.columns + 1}` }).success).toBe(
      false,
    );
  });
});
