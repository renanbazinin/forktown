import {
  TOWN_SIZE,
  FOOTBALL_SITE,
  CINEMA_SITE,
  ZOO_SITE,
  FARM_SITE,
  MILLPOND_SITE,
} from './town-config.ts';
import { createWorldLayout, type Point, type Plot } from './world-layout.ts';
export { BLOCK_SIZE, ROAD_MIN } from './world-layout.ts';
export type { Point, Plot } from './world-layout.ts';
export const TILE_W = 76;
export const TILE_H = 38;
export const WORLD = createWorldLayout(TOWN_SIZE, [
  FOOTBALL_SITE,
  CINEMA_SITE,
  ZOO_SITE,
  FARM_SITE,
  MILLPOND_SITE,
]);
export const PLOTS = WORLD.plots;
export const STREETLIGHTS = WORLD.streetlights;
export const ROAD_MAX_X = WORLD.roadMaxX;
export const ROAD_MAX_Y = WORLD.roadMaxY;
export const WORLD_WIDTH = WORLD.width;
export const WORLD_HEIGHT = WORLD.height;
export const getPlot = WORLD.getPlot;
export const isRoad = WORLD.isRoad;
export const findPlotAt = WORLD.findPlotAt;
export const WORLD_BOUNDS = {
  left: (-WORLD_HEIGHT * TILE_W) / 2,
  right: (WORLD_WIDTH * TILE_W) / 2,
  bottom: ((WORLD_WIDTH + WORLD_HEIGHT) * TILE_H) / 2,
};
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
export function hash(value: string): number {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}
