// The Bandstand (agent C, SPEC §4.2): the octagonal stand (≤ 40 px), the players by band, the
// deckchairs per BANDSTAND_FURNITURE, and the peak lamp, dark on star nights. Render cap: 500
// calls with the players (SPEC §6.6).
// No Math.random, Date.now or performance.now: everything runs on the town clock.
import type { DistrictPainter } from '../district-art';

/** Foundation stub: nothing drawn yet; the lawn shows as plain ground. */
export const bandstandPainter: DistrictPainter = {
  objects: () => [],
};
