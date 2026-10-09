// The regatta's paper boat (docs/REGATTA.md), carried to the Landing only: white, with a band in
// the guest's outfit colour (from `look`). Variant 0. The boatwright carries the same boat from the
// lawn to the water (landing.ts).
// No Math.random, Date.now or performance.now.
import type { Resident } from '../../lib/schema';
import type { CarrySprite } from '../carry-items';
import { tint } from '../houses';

type Ctx = CanvasRenderingContext2D;
type Facing = 'se' | 'sw' | 'ne' | 'nw';

/**
 * A folded paper boat seen side on, in the carrier's own px: its peaked fold over a shallow hull,
 * the hull's two rows in the folder's colour under the rim. Column 0 is x = −3 and the last row
 * sits at the hand (y = −1). `B` is the band; '.' stays clear. At the town's 1.25 it is 9 px
 * across, the size the Landing draws it on the grass and on the river (landing.ts), so a boat
 * keeps its size from the hand to the water.
 */
export const PAPER_BOAT = [
  '...w...',
  '..wWs..',
  '.wWWss.',
  'rrrrrrr',
  '.BBBBB.',
  '..BBB..',
] as const;
const PAPER: Record<string, string> = {
  w: '#FFFFFB',
  W: '#F6F5EE',
  s: '#DADDD5',
  r: '#FBFBF6',
};
/** Paper dims at night like the figures that carry it, a touch less: it is white. */
const NIGHT_DIM = -30;

/**
 * Paints the boat with its bottom centre at (x, y), one fillRect per run of a colour, through any
 * rect painter (the figure's own mirrored frame, or the map's).
 */
export function paintPaperBoat(
  rect: (x: number, y: number, w: number, h: number, color: string) => void,
  x: number,
  y: number,
  band: string,
  night: boolean,
) {
  PAPER_BOAT.forEach((row, index) => {
    const top = y - PAPER_BOAT.length + index;
    for (let start = 0; start < row.length;) {
      const key = row[start];
      let end = start + 1;
      while (row[end] === key) end++;
      if (key !== '.') {
        const color = key === 'B' ? band : PAPER[key];
        rect(x - 3 + start, top, end - start, 1, night ? tint(color, NIGHT_DIM) : color);
      }
      start = end;
    }
  });
}

/** A bright warm colour, that the eye would take for lamplight (the render tests' own test). */
const warm = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return r >= 0xe0 && g >= 0xb0 && g <= 0xea && b <= 0xb8 && r - b >= 0x40;
};
/** The band: the folder's own outfit, so a boat can be told from its neighbors'. A bright
 *  mustard or amber outfit is taken a shade darker: on the river, only lamps are amber. */
export const boatBand = (look: Pick<Resident, 'outfit'>) =>
  /^#[0-9a-f]{6}$/i.test(look.outfit) && warm(look.outfit) ? tint(look.outfit, -28) : look.outfit;

/**
 * Held in the near hand in front of the waist, riding with the body's step. Walking away it rides
 * out past the near shoulder, behind the body, so the back hides only its stern.
 */
export const paperBoatSprite: CarrySprite = {
  height: PAPER_BOAT.length,
  grip: (facing: Facing, walkPhase: number) => {
    const bob = -Math.round(Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 0.8);
    const back = facing === 'ne' || facing === 'nw';
    return { anchor: { x: back ? 7 : 6, y: -7 + bob }, behind: back };
  },
  draw: (ctx: Ctx, x: number, y: number, _variant: number, look: Resident, night: boolean) =>
    paintPaperBoat(
      (rx, ry, w, h, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(rx, ry, w, h);
      },
      x,
      y,
      boatBand(look),
      night,
    ),
};
