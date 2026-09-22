import { FARM_SITE } from './town-config.ts';
import { BLOCK_SIZE, PLOTS, getPlot, project, type Point } from './world.ts';
import type { Place } from './schema.ts';

export const FARM = { name: 'Moon Harvest Farm', plot: 'S9' } as const;
export const FARM_PLOTS = PLOTS.filter(
  (p) =>
    p.row >= FARM_SITE.row &&
    p.row < FARM_SITE.row + FARM_SITE.rows &&
    p.col >= FARM_SITE.col &&
    p.col < FARM_SITE.col + FARM_SITE.columns,
).map((p) => p.id);
export const isFarmPlot = (id: string) => FARM_PLOTS.includes(id);
export const FARM_GROUND = {
  left: 2 + FARM_SITE.col * BLOCK_SIZE,
  right: 1 + (FARM_SITE.col + FARM_SITE.columns) * BLOCK_SIZE,
  top: 2 + FARM_SITE.row * BLOCK_SIZE,
  bottom: 1 + (FARM_SITE.row + FARM_SITE.rows) * BLOCK_SIZE,
};
export const FARM_CENTER = {
  x: (FARM_GROUND.left + FARM_GROUND.right) / 2,
  y: (FARM_GROUND.top + FARM_GROUND.bottom) / 2,
};
export const FARM_FRAME = {
  center: project(FARM_CENTER.x, FARM_CENTER.y),
  width: (FARM_GROUND.right - FARM_GROUND.left + FARM_GROUND.bottom - FARM_GROUND.top) * 38 + 100,
  height: (FARM_GROUND.right - FARM_GROUND.left + FARM_GROUND.bottom - FARM_GROUND.top) * 19 + 220,
};
export const insideFarm = (point: Point) =>
  point.x >= FARM_GROUND.left &&
  point.x <= FARM_GROUND.right &&
  point.y >= FARM_GROUND.top &&
  point.y <= FARM_GROUND.bottom;

// Adjacent plots all the way around: no teleport back across the field.
export const SCARECROW_ROUTE = [
  'S9',
  'S8',
  'S7',
  'S6',
  'S5',
  'S4',
  'T4',
  'T5',
  'T6',
  'T7',
  'T8',
  'T9',
] as const;
export const SCARECROW_HOP = { start: 60, duration: 8 } as const;
const mod = (n: number, divisor: number) => ((n % divisor) + divisor) % divisor;
const smooth = (t: number) => t * t * (3 - 2 * t);
const positionAt = (index: number) => {
  const plot = getPlot(SCARECROW_ROUTE[mod(index, SCARECROW_ROUTE.length)])!;
  return { x: plot.x + 0.5, y: plot.y + 0.5 };
};

// Pure UTC town-time functions: no timers, session counters, or random seeds.
// The epoch fixes the route phase for every browser, including localhost.
export function scarecrowAt(minutes: number, day: number) {
  const absolute = day * 1440 + minutes;
  const step = Math.floor((absolute - SCARECROW_HOP.start) / 1440);
  const elapsed = absolute - (step * 1440 + SCARECROW_HOP.start);
  const progress = Math.min(1, elapsed / SCARECROW_HOP.duration);
  const from = positionAt(step),
    to = positionAt(step + 1);
  const travel = smooth(progress);
  return {
    plot: SCARECROW_ROUTE[mod(step + (progress >= 1 ? 1 : 0), SCARECROW_ROUTE.length)],
    destination: SCARECROW_ROUTE[mod(step + 1, SCARECROW_ROUTE.length)],
    position: { x: from.x + (to.x - from.x) * travel, y: from.y + (to.y - from.y) * travel },
    hopping: progress < 1,
    lift: progress < 1 ? Math.sin(progress * Math.PI) * 14 : 0,
    tilt: progress < 1 ? Math.sin(progress * Math.PI * 2) * 0.12 : 0,
  };
}

// 01:30–03:00, once per ten town nights (four real hours).
// There are 60 town days per UTC date, so the schedule never drifts by date.
export const UFO_VISIT = { every: 10, start: 90, duration: 90 } as const;
export function ufoAt(minutes: number, day: number, houses: readonly Pick<Place, 'id' | 'plot'>[]) {
  const absolute = day * 1440 + minutes;
  const currentDay = Math.floor(absolute / 1440);
  const elapsed = mod(absolute, 1440) - UFO_VISIT.start;
  if (mod(currentDay, UFO_VISIT.every) !== 0 || elapsed < 0 || elapsed >= UFO_VISIT.duration)
    return null;
  // Stable ID order is independent of file enumeration, locale, and array order.
  // The visit number advances even when nobody is watching. Each house gets a
  // turn before the rotation repeats; use the published roster, never a draft.
  const candidates = houses
    .filter((house) => getPlot(house.plot))
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!candidates.length) return null;
  const target = candidates[mod(Math.floor(currentDay / UFO_VISIT.every), candidates.length)];
  const plot = getPlot(target.plot)!;
  const enter = smooth(Math.min(1, elapsed / 20));
  const leave = smooth(Math.max(0, (elapsed - 65) / 25));
  const scan = Math.sin((Math.max(0, elapsed - 20) / 45) * Math.PI * 2);
  return {
    targetId: target.id,
    targetPlot: target.plot,
    position: {
      x: plot.x + 0.5 - 22 * (1 - enter) + 22 * leave + scan * 0.25 * (1 - leave) * enter,
      y: plot.y + 0.5 - 4 * (1 - enter) - 10 * leave,
    },
    altitude: 112 + Math.sin(elapsed * 0.6) * 3 + leave * 85,
    opacity: Math.min(1, elapsed / 5, (UFO_VISIT.duration - elapsed) / 5),
    beam: Math.max(0, Math.min(1, (elapsed - 18) / 6, (68 - elapsed) / 6)),
    phase: elapsed,
  };
}
