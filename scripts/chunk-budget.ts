import type { Plugin } from 'vite';

/**
 * Vite warns about any chunk over 500 kB, and the town has two by design: the main chunk
 * (React, the whole town and every house file) and the films, which load only at the cinema
 * (about 1,020 kB). The warning looked like a failure to every newcomer running
 * `npm run check`, so the limit is sized for a full town instead. With 18 houses the main
 * chunk was about 930 kB, and each house adds about 2 kB. The 20 × 10 town's 141 house plots
 * measured 1,149 kB filled with copies of today's houses (1,204 kB with the largest house on
 * every plot), and the limit was 1,300 kB.
 *
 * The main chunk is all the JavaScript a page loads first (index.html and live/index.html each
 * have one script tag): the Riverside's panels are imported with the app, not split off, so
 * no side chunk loads beside it uncounted. The 20 × 15 town, with the Riverside landed,
 * measured 1,242 kB with today's 30 houses, 1,590 kB with all 230 house plots taken by
 * check:full-town's made-up houses (`npm run check:full-town -- --keep tests/publishing.test.ts`,
 * then `npx vite build` in the kept town) and 1,685 kB with the largest of today's houses
 * (`arts`, at two floors) on every free plot. The limit is the made-up full town's 1,590 kB and
 * 8% (1,718 kB): quiet as the town fills, even with the largest houses, and still speaking up
 * when the code grows.
 */
export const CHUNK_WARNING_KB = 1718;

export function chunkBudget(): Plugin {
  return {
    name: 'forktown-chunk-budget',
    config: () => ({ build: { chunkSizeWarningLimit: CHUNK_WARNING_KB } }),
  };
}
