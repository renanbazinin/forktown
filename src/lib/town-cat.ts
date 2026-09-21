import type { Place } from './schema';
import { roadPath } from './simulation';
import { getPlot, hash, plotEntrance, type Point } from './world';

export const TOWN_CAT_NAME = 'Miso';
export const TOWN_CAT_ID = '@town-cat'; // Cannot collide with a valid contributed home id.
export type TownCat = {
  position: Point;
  homePlot: string;
  left: boolean;
  stride: number;
  outside: boolean;
};

const NIGHT_START = 1200;
const NIGHT_END = 360;
const SPEED = 0.065; // Tiles per town minute: 30% faster than the old street stroll.

/** An outdoor town animal, not an extra resident or a change to anyone's routine. */
export function townCatAt(places: Place[], minutes: number, day = 0): TownCat {
  const stage = getPlot('B5')!;
  const time = ((minutes % 1440) + 1440) % 1440;
  // The evening owns the entire outing, including the hours after midnight.
  const evening = day + Math.floor(minutes / 1440) - (time < NIGHT_START ? 1 : 0);
  const homes = places
    .filter((place) => getPlot(place.plot))
    .sort((a, b) => a.id.localeCompare(b.id));
  const home = homes[hash(`miso:${evening}`) % homes.length];
  const plot = home ? getPlot(home.plot)! : stage;
  const doorstep = plotEntrance(plot);
  const distance = (place: Place) => {
    const other = getPlot(place.plot)!;
    return Math.abs(other.x - plot.x) + Math.abs(other.y - plot.y);
  };
  const neighbors = homes
    .filter((place) => place.id !== home?.id && distance(place) <= 8)
    .sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id))
    .slice(0, 3)
    .sort((a, b) => hash(`miso:${evening}:${a.id}`) - hash(`miso:${evening}:${b.id}`));
  const route = [doorstep];
  for (const neighbor of neighbors) {
    route.push(...roadPath(route.at(-1)!, plotEntrance(getPlot(neighbor.plot)!)).slice(1));
  }
  if (route.length > 1) route.push(...roadPath(route.at(-1)!, doorstep).slice(1));
  else {
    // A sparse neighborhood still has a safe little street to explore.
    const end = { x: doorstep.x + 2, y: doorstep.y };
    const outward = roadPath(doorstep, end);
    route.push(...outward.slice(1), ...outward.slice(0, -1).reverse());
  }
  const outside = time >= NIGHT_START || time < NIGHT_END;
  const elapsed = (time - NIGHT_START + 1440) % 1440;
  const step = outside ? (elapsed * SPEED) % (route.length - 1) : 0;
  const index = Math.floor(step);
  const from = route[index],
    to = route[index + 1];
  const fraction = step - index;
  return {
    position: { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction },
    homePlot: plot.id,
    left: to.x - from.x - (to.y - from.y) < 0,
    stride: outside ? Math.sin((elapsed * Math.PI * 1.3) / 1.5) : 0,
    outside,
  };
}
