// The regatta's paper boat (agent C, SPEC §4.5), carried to the Landing only: white, with a band in
// the guest's outfit colour (from `look`). Variant 0.
// No Math.random, Date.now or performance.now.
import type { CarrySprite } from '../carry-items';

/**
 * Foundation stub: nothing drawn, no height. The near hand hangs at its resting point, 4 px in
 * front and 5 px up from the feet (drawResident draws the arm to the anchor, then the sprite).
 */
export const paperBoatSprite: CarrySprite = {
  height: 0,
  grip: () => ({ anchor: { x: 4, y: -5 }, behind: false }),
  draw: () => {},
};
