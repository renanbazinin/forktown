// A dish for the Long Table (agent D, SPEC §4.3), carried there only: a pie, a loaf or a jar by
// variant (hash(`dish:${day}:${id}`) % 3).
// No Math.random, Date.now or performance.now.
import type { CarrySprite } from '../carry-items';

/** Foundation stub: nothing drawn, no height. */
export const dishSprite: CarrySprite = {
  height: 0,
  grip: () => ({ anchor: { x: 0, y: 0 }, behind: false }),
  draw: () => {},
};
