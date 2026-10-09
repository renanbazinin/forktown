// The district painters' "never flashes" checks share this: two consecutive frames' draws, each
// with the fill, the stroke and the alpha it was made with, and the jumps between them. A frame is
// 1/30 of a town minute.
import { LIGHT } from '../src/city/glow';
import { BRAND } from '../src/lib/brand';

export type Draw = { name: string; fill: string; stroke?: string; alpha: number };

const LIT = new Set([LIGHT.lit, LIGHT.core, BRAND.lantern, BRAND.glow].map((c) => c.toUpperCase()));
/** A lamp's own light, or a bright warm colour: what the eye reads as lamplight. */
export function lamplight(colour: string) {
  if (LIT.has(colour.toUpperCase().slice(0, 7))) return true;
  if (!/^#[0-9A-F]{6}/i.test(colour)) return false;
  const n = parseInt(colour.slice(1, 7), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return r >= 0xe0 && g >= 0xb0 && g <= 0xea && b <= 0xb8 && r - b >= 0x40;
}

/** The calls that put colour down, and which colour they use. drawImage is left out: in node a
 *  glow paints nothing, and a sprite's colours are its own. */
const PAINTS: Record<string, 'fill' | 'stroke'> = {
  fill: 'fill',
  fillRect: 'fill',
  fillText: 'fill',
  stroke: 'stroke',
  strokeRect: 'stroke',
  strokeText: 'stroke',
};
/** A frame's lamplight: each paint call in a lamplight colour, by call and colour, in order. */
function lit(draws: readonly Draw[]) {
  return draws.flatMap((draw) => {
    const which = PAINTS[draw.name];
    const colour = which === 'fill' ? draw.fill : which === 'stroke' ? (draw.stroke ?? '') : '';
    return which && lamplight(colour)
      ? [{ key: `${draw.name}|${colour.toUpperCase()}`, alpha: draw.alpha }]
      : [];
  });
}

/**
 * The alpha jumps from one frame to the next, each more than `limit`. Frames that make the same
 * calls are compared call by call. That alone would miss a light that pops on from nothing, since
 * then the calls change, so each frame's lamplight is also aligned with the frame before's (a
 * longest common subsequence by call and colour): lamplight that stays may change by `limit` at
 * most, and lamplight that comes or goes does so at alpha `limit` or less.
 */
export function frameJumps(before: readonly Draw[], after: readonly Draw[], limit = 0.08) {
  const jumps: string[] = [];
  let compared = 0;
  const jumped = (a: number, b: number) => Math.abs(a - b) > limit + 1e-9;
  if (before.length === after.length && before.every((d, i) => d.name === after[i].name))
    after.forEach((draw, i) => {
      compared++;
      if (jumped(before[i].alpha, draw.alpha))
        jumps.push(`${draw.name} ${before[i].alpha} → ${draw.alpha}`);
    });
  const a = lit(before),
    b = lit(after);
  // The common subsequence's lengths of every pair of suffixes.
  const length = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      length[i][j] =
        a[i].key === b[j].key
          ? length[i + 1][j + 1] + 1
          : Math.max(length[i + 1][j], length[i][j + 1]);
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i].key === b[j].key) {
      compared++;
      if (jumped(a[i].alpha, b[j].alpha)) jumps.push(`${a[i].key} ${a[i].alpha} → ${b[j].alpha}`);
      i++;
      j++;
    } else if (j >= b.length || (i < a.length && length[i + 1][j] >= length[i][j + 1])) {
      compared++;
      if (jumped(a[i].alpha, 0)) jumps.push(`${a[i].key} went at ${a[i].alpha}`);
      i++;
    } else {
      compared++;
      if (jumped(0, b[j].alpha)) jumps.push(`${b[j].key} came at ${b[j].alpha}`);
      j++;
    }
  }
  return { compared, jumps };
}
