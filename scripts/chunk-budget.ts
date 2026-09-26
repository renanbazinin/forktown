import type { Plugin } from 'vite';

/**
 * Vite warns about any chunk over 500 kB, and the town has two by design: the main chunk
 * (React, the whole town and every house file) and the films, which load only at the cinema
 * (about 950 kB). The warning looked like a failure to every newcomer running
 * `npm run check`, so the limit is sized for a full town instead. With 18 houses the main
 * chunk is about 930 kB, and each house adds about 2 kB. Filling all 141 house plots with
 * copies of today's houses measured 1,149 kB, or 1,204 kB when every copy is the largest
 * house, so 1,300 kB stays quiet as the town fills and still speaks up when the code grows.
 */
export const CHUNK_WARNING_KB = 1300;

export function chunkBudget(): Plugin {
  return {
    name: 'forktown-chunk-budget',
    config: () => ({ build: { chunkSizeWarningLimit: CHUNK_WARNING_KB } }),
  };
}
