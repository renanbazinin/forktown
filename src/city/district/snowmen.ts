// Snowmen on the Lunch Green (agent E, SPEC §4.6): four snowmen from snowmanState, about 22 px tall,
// leaning and shrinking as they melt, then a carrot and a scarf on the grass. Render cap: 40 calls
// for all four (SPEC §6.6).
// No Math.random, Date.now or performance.now: everything runs on the town clock.
import type { DistrictPainter } from '../district-art';

/** Foundation stub: nothing drawn yet. */
export const snowmenPainter: DistrictPainter = {
  objects: () => [],
};
