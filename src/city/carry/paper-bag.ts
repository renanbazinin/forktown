// The market's paper bag (agent B, SPEC §4.1), carried home only. Its top shows greens, stems or a
// book corner by variant (MARKET_KINDS index: farmers, flowers, books).
// No Math.random, Date.now or performance.now.
import type { CarrySprite } from '../carry-items';

/**
 * Foundation stub: nothing drawn, no height. The near hand hangs at its resting point, 4 px in
 * front and 5 px up from the feet (drawResident draws the arm to the anchor, then the sprite).
 */
export const paperBagSprite: CarrySprite = {
  height: 0,
  grip: () => ({ anchor: { x: 4, y: -5 }, behind: false }),
  draw: () => {},
};
