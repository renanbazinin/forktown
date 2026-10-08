// What a guest carries on one leg of an outing: a paper bag home from
// the market, a paper boat to the regatta, a dish to the Long Table. The kind and the leg come from
// the outing's spec (src/lib/outings.ts); residents.ts draws the sprite through the errand items'
// grip pipeline and adds its height to residentReach. Never drawn in the stack or the glass.
// The interface and this registry are frozen; each sprite is its own file under src/city/carry/.
// No Math.random, Date.now or performance.now.
import type { CarryKind } from '../lib/outings';
import type { Resident } from '../lib/schema';
import type { ResidentState } from '../lib/simulation';
import type { Point } from '../lib/world';
import { paperBagSprite } from './carry/paper-bag';
import { paperBoatSprite } from './carry/paper-boat';
import { dishSprite } from './carry/dish';

type Ctx = CanvasRenderingContext2D;

export type CarrySprite = {
  /** Px above the hand, added to residentReach. */
  height: number;
  /** Where the hand holds it, in the figure's own px, and whether the body hides it (like errandItemPose). */
  grip: (facing: ResidentState['facing'], walkPhase: number) => { anchor: Point; behind: boolean };
  /** Draws it with its bottom centre at (x, y), the figure's own px; `look` dresses it in their colours. */
  draw(ctx: Ctx, x: number, y: number, variant: number, look: Resident, night: boolean): void;
};

export const CARRY_SPRITES: Record<CarryKind, CarrySprite> = {
  'paper-bag': paperBagSprite,
  'paper-boat': paperBoatSprite,
  dish: dishSprite,
};
