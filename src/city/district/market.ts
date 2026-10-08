// Market Square (agent B, SPEC §4.1): six stalls, three per edge, with sage, rose or slate awnings
// by the day's market (never amber), crates on the farm's calendar, the handcart and the low pump,
// six scenery stallholders behind the counters, snow on the awnings in winter, and folded frames
// under pale canvas at night. Render cap: 1,100 calls at 10:00 with 12 browsers (SPEC §6.6).
// No Math.random, Date.now or performance.now: everything runs on the town clock.
import type { DistrictPainter } from '../district-art';

/** Foundation stub: nothing drawn yet; the square shows as plain ground. */
export const marketPainter: DistrictPainter = {
  objects: () => [],
};
