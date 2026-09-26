import type { Plugin } from 'vite';

/**
 * Vite warns about any chunk over 500 kB, and the town has two by design: the main chunk
 * (React and the whole town, about 930 kB) and the films, which load only at the cinema
 * (about 950 kB). The warning looked like a failure to every newcomer running
 * `npm run check`, so it now speaks up only past 1 MB, when a chunk has really grown.
 */
export const CHUNK_WARNING_KB = 1000;

export function chunkBudget(): Plugin {
  return {
    name: 'forktown-chunk-budget',
    config: () => ({ build: { chunkSizeWarningLimit: CHUNK_WARNING_KB } }),
  };
}
