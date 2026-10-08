import type { Plugin } from 'vite';

/**
 * Vite warns about any chunk over 500 kB, and the town has two by design: the main chunk
 * (React, the whole town and every house file) and the films, which load only at the cinema
 * (about 950 kB). The warning looked like a failure to every newcomer running
 * `npm run check`, so the limit is sized for a full town instead. With 18 houses the main
 * chunk is about 930 kB, and each house adds about 2 kB. Filling all 141 house plots of the
 * 20 × 10 town with copies of today's houses measured 1,149 kB, or 1,204 kB when every copy is
 * the largest house, so 1,300 kB stayed quiet as the town filled and still spoke up when the
 * code grew. The 20 × 15 town has 230 house plots; the limit is measured again on a full town
 * once the riverside's art has landed.
 */
export const CHUNK_WARNING_KB = 1300;

export function chunkBudget(): Plugin {
  return {
    name: 'forktown-chunk-budget',
    config: () => ({ build: { chunkSizeWarningLimit: CHUNK_WARNING_KB } }),
  };
}
