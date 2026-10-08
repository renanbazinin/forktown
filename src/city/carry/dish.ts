// A dish for the Long Table (agent D, SPEC §4.3), carried there only: a pie, a loaf or a jar by
// variant (hash(`dish:${day}:${id}`) % 3). The same pixels stand on the table at the guest's
// place from the moment they arrive (district/harvest.ts).
// No Math.random, Date.now or performance.now.
import type { CarrySprite } from '../carry-items';
import type { ResidentState } from '../../lib/simulation';
import { tint } from '../houses';

type Ctx = CanvasRenderingContext2D;
/** How much the dishes darken at night: as much as the figure that carries them. */
const NIGHT_DIM = -35;

/**
 * Each dish as a pixel map, its base centre on the bottom row's middle: column 0 is x = −4 and
 * the last row sits at y = −1. A '.' is left clear. Each is as wide as a figure's shoulders and
 * no taller than its chest, so the carrier still reads as a person.
 */
type Dish = { rows: readonly string[]; colors: Readonly<Record<string, string>> };
export const DISHES: readonly Dish[] = [
  // A deep fruit pie in a tin: a golden lid with three steam slits and a crimped rim.
  {
    colors: {
      o: '#7A4B2C',
      c: '#C98B4A',
      C: '#DDA35E',
      s: '#8E3B4B',
      t: '#AEB8B5',
      T: '#D5DCD8',
      d: '#7E8A88',
    },
    rows: [
      '..ooooo..',
      '.oCCCCCo.',
      'oCsCCsCCo',
      'occcsccco',
      'TTTTTTTTT',
      '.ttdttdt.',
      '..ddddd..',
    ],
  },
  // A round cottage loaf, its top bun scored, on a folded check cloth.
  {
    colors: {
      o: '#6B4527',
      b: '#A9703F',
      B: '#C7925A',
      h: '#D9AE73',
      w: '#EFE7D3',
      r: '#B4574A',
    },
    rows: [
      '...ooo...',
      '..oBhBo..',
      '..obBbo..',
      '.oBhBBBo.',
      'oBBbobBbo',
      'obbbbbbbo',
      'wrwrwrwrw',
    ],
  },
  // A jar of bramble jam under a gingham cap tied with string.
  {
    colors: {
      r: '#B4574A',
      w: '#EFE7D3',
      s: '#8A7354',
      g: '#7E9C93',
      G: '#D9E7E1',
      j: '#6E2B3E',
      J: '#93405A',
    },
    rows: [
      '..rwrwr..',
      '.rwrwrwr.',
      '..sssss..',
      '..gGjjg..',
      '..gGJjg..',
      '..gjjjg..',
      '...ggg...',
    ],
  },
];
/** Rows of the tallest dish: how far one rises over the hand that holds it. */
export const DISH_HEIGHT = Math.max(...DISHES.map((dish) => dish.rows.length));

type Run = { key: string; from: number; to: number };
const rowRuns = new Map<string, { base?: Run; runs: Run[] }>();
/**
 * A row's runs of one colour, and, when the row is solid from its first pixel to its last, the
 * colour most of it is: painted as one rect under the others, it saves a call or several.
 */
function plan(row: string) {
  const known = rowRuns.get(row);
  if (known) return known;
  const runs: Run[] = [];
  for (let from = 0; from < row.length;) {
    let to = from + 1;
    while (row[to] === row[from]) to++;
    if (row[from] !== '.') runs.push({ key: row[from], from, to });
    from = to;
  }
  const solid = runs.length > 2 && runs.every((run, i) => !i || run.from === runs[i - 1].to);
  let best: Run | undefined;
  if (solid) {
    const count = new Map<string, number>();
    for (const run of runs) count.set(run.key, (count.get(run.key) ?? 0) + run.to - run.from);
    const key = [...count].sort((a, b) => b[1] - a[1])[0][0];
    best = { key, from: runs[0].from, to: runs.at(-1)!.to };
  }
  const planned = best
    ? { base: best, runs: runs.filter((run) => run.key !== best.key) }
    : { runs };
  rowRuns.set(row, planned);
  return planned;
}
/**
 * Paints a pixel map with its bottom row's middle at (x, y): a row solid from end to end is one
 * rect in its main colour with the other colours over it; any other row is one rect a run.
 */
export function paintPixels(
  ctx: Ctx,
  rows: readonly string[],
  colorOf: (key: string) => string,
  x: number,
  y: number,
) {
  const half = Math.floor(rows[0].length / 2);
  rows.forEach((row, index) => {
    const top = y - rows.length + index;
    const { base, runs } = plan(row);
    for (const run of base ? [base, ...runs] : runs) {
      ctx.fillStyle = colorOf(run.key);
      ctx.fillRect(x - half + run.from, top, run.to - run.from, 1);
    }
  });
}

/** Paints a dish with its base centre at (x, y). */
export function drawDish(ctx: Ctx, x: number, y: number, variant: number, night: boolean) {
  const { rows, colors } = DISHES[((variant % DISHES.length) + DISHES.length) % DISHES.length];
  paintPixels(ctx, rows, (key) => (night ? tint(colors[key], NIGHT_DIM) : colors[key]), x, y);
}

/**
 * Held level on the near hand at the waist, the way a dish is carried to a table: in front of
 * the body facing us, and out past the near shoulder walking away, so the back never hides it.
 * It rides with the body's walking bob.
 */
const grip = (facing: ResidentState['facing'], walkPhase: number) => {
  const bob = -Math.round(Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 0.8);
  const back = facing === 'ne' || facing === 'nw';
  return { anchor: { x: back ? 7 : 6, y: -8 + bob }, behind: back };
};

export const dishSprite: CarrySprite = {
  height: DISH_HEIGHT,
  grip,
  draw: (ctx, x, y, variant, _look, night) => drawDish(ctx, x, y, variant, night),
};
