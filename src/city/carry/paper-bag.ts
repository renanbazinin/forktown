// The market's paper bag (docs/MARKET.md), carried home only. Its top shows greens, stems or a
// book corner by variant (MARKET_KINDS index: farmers, flowers, books).
// No Math.random, Date.now or performance.now.
//
// A brown paper bag with its top rolled down, carried in the crook of the near arm the way a bag
// without handles is carried: the hand under its bottom, the bag against the hip. Walking away
// from the camera the body hides most of it, so it rides a little further out and peeks past the
// near side. It bobs with the walker's own step, like the errand items.
import type { CarrySprite } from '../carry-items';
import { tint } from '../houses';

type Ctx = CanvasRenderingContext2D;

/** How much the bag darkens at night: as much as the figure carrying it (residents.ts). */
const NIGHT_DIM = -35;
/** The bag's size, the figure's own px. */
export const PAPER_BAG = { width: 6, height: 7, top: 4 } as const;

const KRAFT = '#C9A774';
const KRAFT_SHADE = '#AD8B5C';
const KRAFT_RIM = '#DDC394';
const KRAFT_FOLD = '#B8965F';
/** What shows over the rim, by MARKET_KINDS index: greens, stems in flower, a book's corner. */
const TOPS: readonly (readonly [x: number, y: number, w: number, h: number, color: string][])[] = [
  [
    [-2, -3, 2, 3, '#6E9A4A'],
    [0, -4, 2, 4, '#93B866'],
    [2, -2, 1, 2, '#4E7438'],
    [-1, -1, 1, 1, '#D45A78'],
  ],
  [
    [-2, -3, 1, 3, '#5E8A43'],
    [0, -4, 1, 4, '#5E8A43'],
    [2, -2, 1, 2, '#5E8A43'],
    [-3, -5, 2, 2, '#E58FA6'],
    [0, -6, 2, 2, '#F4EFE6'],
    [2, -4, 2, 2, '#B08ECF'],
  ],
  [
    [-2, -2, 4, 2, '#4E6A8A'],
    [0, -4, 3, 2, '#4E6A8A'],
    [2, -4, 1, 2, '#F1EADB'],
    [-2, -1, 1, 1, '#F1EADB'],
  ],
];

export const paperBagSprite: CarrySprite = {
  /** The tallest top (the flowers) reaches this far above the hand. */
  height: PAPER_BAG.height + 6,
  grip: (facing, walkPhase) => {
    const back = facing === 'ne' || facing === 'nw';
    // The body bobs a px on each step; the bag in the crook of the arm goes with it.
    const bob = -Math.round(Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 0.8);
    return { anchor: { x: back ? 6 : 5, y: -4 + bob }, behind: back };
  },
  draw(ctx: Ctx, x, y, variant, _look, night) {
    const ink = (color: string) => (night ? tint(color, NIGHT_DIM) : color);
    const rect = (rx: number, ry: number, w: number, h: number, color: string) => {
      ctx.fillStyle = ink(color);
      ctx.fillRect(rx, ry, w, h);
    };
    const { width, height, top } = PAPER_BAG;
    const left = x - width / 2,
      rim = y - height;
    // What the bag holds shows over the rolled rim, then the bag in front of it.
    for (const [dx, dy, w, h, color] of TOPS[variant] ?? TOPS[0])
      rect(x + dx, rim + dy, w, h, color);
    rect(left, rim, width, height, KRAFT);
    rect(left + width - 2, rim, 2, height, KRAFT_SHADE);
    rect(left, rim, width, 1, KRAFT_RIM);
    rect(left, rim + top - 2, width, 1, KRAFT_FOLD);
  },
};
