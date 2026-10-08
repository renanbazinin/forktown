// The Boat Landing (agent C, SPEC §4.5): the slim stage, the paper boats from regattaBoat, the cork
// boom, the boatwright and the boatman, and the cream and sage bunting all Regatta Week. Render
// cap: 600 calls with 10 boats and the boom (SPEC §6.6).
// No Math.random, Date.now or performance.now: everything runs on the town clock.
import type { DistrictPainter } from '../district-art';

/** Foundation stub: nothing drawn yet; the lawn shows as plain ground. */
export const landingPainter: DistrictPainter = {
  objects: () => [],
};
