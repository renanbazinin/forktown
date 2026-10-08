import type { Plugin } from 'vite';

/**
 * Vite warns about any chunk over 500 kB, and the town has two by design: the main chunk
 * (React, the whole town and every house file) and the films, which load only at the cinema
 * (about 1,020 kB). The warning looked like a failure to every newcomer running
 * `npm run check`, so the limit is sized for a full town instead. With 18 houses the main
 * chunk was about 930 kB, and each house adds about 2 kB. The 20 × 10 town's 141 house plots
 * measured 1,149 kB filled with copies of today's houses (1,204 kB with the largest house on
 * every plot), and the limit was 1,300 kB. The 20 × 15 town, with the Riverside's art landed,
 * measured 1,055 kB with today's 30 houses, 1,403 kB with all 230 house plots taken by
 * check:full-town's made-up houses (`npm run check:full-town -- --keep`, then `npm run build`
 * in the kept town) and 1,499 kB with the largest of today's houses on every free plot. The
 * limit is the full town's 1,403 kB and 8% (1,516 kB): quiet as the town fills, even with the
 * largest houses, and still speaking up when the code grows.
 */
export const CHUNK_WARNING_KB = 1516;

export function chunkBudget(): Plugin {
  return {
    name: 'forktown-chunk-budget',
    config: () => ({ build: { chunkSizeWarningLimit: CHUNK_WARNING_KB } }),
  };
}
