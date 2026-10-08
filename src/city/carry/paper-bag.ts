// The market's paper bag (agent B, SPEC §4.1), carried home only. Its top shows greens, stems or a
// book corner by variant (MARKET_KINDS index: farmers, flowers, books).
// No Math.random, Date.now or performance.now.
import type { CarrySprite } from '../carry-items';

/** Foundation stub: nothing drawn, no height. */
export const paperBagSprite: CarrySprite = {
  height: 0,
  grip: () => ({ anchor: { x: 0, y: 0 }, behind: false }),
  draw: () => {},
};
