import { FORK_PLOT, lampLit } from '../lib/lanterns';
import { getPlot, STREETLIGHTS } from '../lib/world';

const fork = getPlot(FORK_PLOT)!;

/** Streetlamps with their Manhattan distance in tiles from the Fork: the light walks outward. */
export const LAMPS = STREETLIGHTS.map(({ x, y }) => ({
  x,
  y,
  distance: Math.abs(x + 0.5 - (fork.x + 0.5)) + Math.abs(y + 0.5 - (fork.y + 0.5)),
}));
export const MIN_LAMP_DISTANCE = Math.min(...LAMPS.map((lamp) => lamp.distance));
export const MAX_LAMP_DISTANCE = Math.max(...LAMPS.map((lamp) => lamp.distance));

/** The wave starts at the nearest lamp at 20:20 and reaches the farthest at 20:30. */
export const lampOn = (distance: number, minutes: number) =>
  lampLit(distance - MIN_LAMP_DISTANCE, MAX_LAMP_DISTANCE - MIN_LAMP_DISTANCE, minutes);
