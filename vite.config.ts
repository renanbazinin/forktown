/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { localPlacesPlugin } from './scripts/local-places.ts';
import { readArrivalOrder } from './scripts/town-arrivals.ts';
import { thirdPartyLicenses } from './scripts/third-party-licenses.ts';
import { sharePreview } from './scripts/share-preview.ts';
import { chunkBudget } from './scripts/chunk-budget.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), localPlacesPlugin(), thirdPartyLicenses(), sharePreview(), chunkBudget()],
    base: env.VITE_BASE_PATH || '/',
    define: { __TOWN_ARRIVALS__: JSON.stringify(readArrivalOrder(process.cwd())) },
    build: { rollupOptions: { input: { town: 'index.html', live: 'live/index.html' } } },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    test: {
      // Many tests sweep a whole town year, and the roster-wide ones grow with the town. With all
      // 141 house plots taken, the slowest without a timeout of their own take 6–8 s alone on a
      // busy desktop, and CI's shared runners are no faster, so Vitest's 5 s default would fail
      // them there. A hung test still stops within 15 s.
      testTimeout: 15_000,
      // Worktrees under .claude/ and scratch copies under .shots/ carry tests of their own.
      exclude: [...configDefaults.exclude, '.claude/**', '.shots/**'],
    },
  };
});
