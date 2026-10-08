import { describe, expect, it } from 'vitest';
import { createWorldLayout } from '../src/lib/world-layout';
import { PLOTS, plotEntrance, ROAD_MAX_X, ROAD_MAX_Y } from '../src/lib/world';
import { roadPath, simulateResidents } from '../src/lib/simulation';
import { placeSchema } from '../src/lib/schema';
import { readFileSync } from 'node:fs';
import { HOUSE_PLOTS } from '../src/lib/events';
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

  it('extends row addresses beyond Z without renaming old rows', () => {
    const future = createWorldLayout({ rows: 28, columns: 12 });
    expect(future.getPlot('Z12')).toMatchObject({ row: 25, col: 11 });
    expect(future.getPlot('AA1')).toMatchObject({ row: 26, col: 0 });
    expect(future.getPlot('AB12')).toMatchObject({ row: 27, col: 11 });
    for (const invalid of ['A0', 'A01', 'a1', 'A13', 'AC1', ' A1'])
      expect(future.getPlot(invalid)).toBeUndefined();
  });

  it.each([
    { rows: 0, columns: 5 },
    { rows: 5, columns: -1 },
    { rows: 2.5, columns: 5 },
  ])('rejects invalid dimensions: %j', (size) => expect(() => createWorldLayout(size)).toThrow());

  it('connects every current home to the expanded road network', () => {
    const destination = { x: ROAD_MAX_X + 0.5, y: ROAD_MAX_Y + 0.5 };
    for (const plot of HOUSE_PLOTS) {
      const entrance = plotEntrance(plot);
      const path = roadPath(entrance, destination);
      expect(path[0]).toEqual(entrance);
      expect(path.at(-1)).toEqual(destination);
      for (let i = 1; i < path.length; i++)
        expect(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y)).toBe(1);
    }
  });

  it('accepts and simulates a contribution on the new far edge', () => {
    const edge = `T${TOWN_SIZE.columns}`;
    const home = placeSchema.parse({
      ...JSON.parse(readFileSync('places/my-little-place.json', 'utf8')),
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
