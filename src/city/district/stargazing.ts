// Stargazing on the Bandstand lawn (agent E, SPEC §4.4): the rugs per BANDSTAND_FURNITURE, the
// brass telescope (≤ 24 px) and the scenery astronomer; the summer meteors are in sky-extras.ts.
// Nothing amber. Render cap: 300 calls (SPEC §6.6).
// No Math.random, Date.now or performance.now: everything runs on the town clock.
import type { DistrictPainter } from '../district-art';
import { drawSkyExtras } from '../sky-extras';

/** Foundation stub: nothing drawn yet. */
export const stargazingPainter: DistrictPainter = {
  objects: () => [],
  sky: drawSkyExtras,
};
