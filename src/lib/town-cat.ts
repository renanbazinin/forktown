import type { Place } from './schema';
import { getPlot, type Point } from './world';

export const TOWN_CAT_NAME = 'Miso';
export const TOWN_CAT_ID = '@town-cat'; // Cannot collide with a valid contributed home id.
export type TownCat = { position: Point; homePlot: string; left: boolean; stride: number };

/** An outdoor town animal, not an extra resident or a change to anyone's routine. */
export function townCatAt(places: Place[], minutes: number): TownCat {
  const stage = getPlot('B5')!;
  const home = [...places].sort((a, b) => {
    const distance = (place: Place) => {
      const plot = getPlot(place.plot)!;
      return Math.abs(plot.x - stage.x) + Math.abs(plot.y - stage.y);
    };
    return distance(a) - distance(b) || a.id.localeCompare(b.id);
  })[0];
  const plot = home ? getPlot(home.plot)! : stage;
  // A quiet out-and-back on the street in front of a home, never through a building.
  const phase = (((minutes % 120) + 120) % 120) / 120;
  const progress = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return {
    position: { x: plot.x - 0.5 + progress * 3, y: plot.y + 2.5 },
    homePlot: plot.id,
    left: phase >= 0.5,
    stride: Math.sin((minutes * Math.PI) / 1.5),
  };
}
