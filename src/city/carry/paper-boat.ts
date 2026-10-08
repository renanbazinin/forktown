// The regatta's paper boat (agent C, SPEC §4.5), carried to the Landing only: white, with a band in
// the guest's outfit colour (from `look`). Variant 0.
// No Math.random, Date.now or performance.now.
import type { CarrySprite } from '../carry-items';

/** Foundation stub: nothing drawn, no height. */
export const paperBoatSprite: CarrySprite = {
  height: 0,
  grip: () => ({ anchor: { x: 0, y: 0 }, behind: false }),
  draw: () => {},
};
