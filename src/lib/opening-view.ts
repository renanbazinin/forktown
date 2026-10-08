// The map's opening view of a town, as City.tsx opens it, for the app, the tests and the manual
// harnesses alike: the homes, the green and the stage framed by map-view's neighborhoodView, with
// the Lantern Fork's crown kept below the header when a full town opens at the zoom floor.
import { VENUES } from './events';
import { FORK_BOUNDS, FORK_PLOT } from './lanterns';
import { fitView, neighborhoodView, type View } from './map-view';
import { getPlot, plotCenter, WORLD_BOUNDS, type Point } from './world';

/** The centres (world px) the opening view frames: each home's plot, the green and the stage. */
export function openingPoints(plots: readonly string[]): Point[] {
  return [
    ...plots,
    ...VENUES.filter((venue) => venue.kind === 'green' || venue.kind === 'stage').map(
      (venue) => venue.plot,
    ),
  ].flatMap((id) => {
    const plot = getPlot(id);
    return plot ? [plotCenter(plot)] : [];
  });
}

/** The top of the Lantern Fork's crown, world px, with a little sky above it. */
export const FORK_CROWN = (() => {
  const centre = plotCenter(getPlot(FORK_PLOT)!);
  return { x: centre.x, y: centre.y + FORK_BOUNDS.top - 10 };
})();

/** The view the map opens on for homes on these plots, at a canvas of width × height. */
export function openingView(plots: readonly string[], width: number, height: number): View {
  return neighborhoodView(
    openingPoints(plots),
    width,
    height,
    fitView(width, height, WORLD_BOUNDS),
    FORK_CROWN,
  );
}
