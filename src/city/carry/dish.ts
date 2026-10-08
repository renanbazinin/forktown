// A dish for the Long Table (agent D, SPEC §4.3), carried there only: a pie, a loaf or a jar by
// variant (hash(`dish:${day}:${id}`) % 3).
// No Math.random, Date.now or performance.now.
import type { CarrySprite } from '../carry-items';

/**
 * Foundation stub: nothing drawn, no height. The near hand hangs at its resting point, 4 px in
 * front and 5 px up from the feet (drawResident draws the arm to the anchor, then the sprite).
 */
export const dishSprite: CarrySprite = {
  height: 0,
  grip: () => ({ anchor: { x: 4, y: -5 }, behind: false }),
  draw: () => {},
};
