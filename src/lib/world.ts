export type Point = { x: number; y: number };
export type Plot = { id: string; col: number; row: number; x: number; y: number };
export const TILE_W = 76;
export const TILE_H = 38;
export const BLOCK_SIZE = 4;
export const ROAD_MIN = 1;
export const ROAD_MAX = ROAD_MIN + 5 * BLOCK_SIZE;
export const WORLD_SIZE = ROAD_MAX + 3;
export const PLOTS: Plot[] = Array.from({ length: 25 }, (_, i) => ({
  id: `${String.fromCharCode(65 + Math.floor(i / 5))}${(i % 5) + 1}`,
  col: i % 5,
  row: Math.floor(i / 5),
  x: 3 + (i % 5) * BLOCK_SIZE,
  y: 3 + Math.floor(i / 5) * BLOCK_SIZE,
}));
export const getPlot = (id: string) => PLOTS.find((plot) => plot.id === id);
export const project = (x: number, y: number): Point => ({
  x: ((x - y) * TILE_W) / 2,
  y: ((x + y) * TILE_H) / 2,
});
export const unproject = (x: number, y: number): Point => ({
  x: x / TILE_W + y / TILE_H,
  y: y / TILE_H - x / TILE_W,
});
export const plotCenter = (plot: Plot): Point => project(plot.x + 0.5, plot.y + 0.5);
export const plotEntrance = (plot: Plot): Point => ({ x: plot.x + 0.5, y: plot.y + 2.5 });
export const isRoad = (x: number, y: number) =>
  x >= ROAD_MIN &&
  x <= ROAD_MAX &&
  y >= ROAD_MIN &&
  y <= ROAD_MAX &&
  (x % BLOCK_SIZE === ROAD_MIN || y % BLOCK_SIZE === ROAD_MIN);
export function findPlotAt(x: number, y: number): Plot | undefined {
  return PLOTS.find(
    (plot) => x >= plot.x - 1 && x < plot.x + 2 && y >= plot.y - 1 && y < plot.y + 2,
  );
}
export function hash(value: string): number {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}
