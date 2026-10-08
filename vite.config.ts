/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { localPlacesPlugin } from './scripts/local-places.ts';
import { arrivalDates, readArrivalOrder, readArrivals } from './scripts/town-arrivals.ts';
import { thirdPartyLicenses } from './scripts/third-party-licenses.ts';
import { sharePreview } from './scripts/share-preview.ts';
import { chunkBudget } from './scripts/chunk-budget.ts';
import { placeJsonErrors } from './scripts/place-files.ts';
import { buildManifest, readBuildInfo } from './scripts/build-manifest.ts';

// This build's identity, computed once: the live page and live/build.json share it.
const BUILD = readBuildInfo(process.cwd());

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const arrivals = readArrivals(process.cwd());
  return {
    plugins: [
      placeJsonErrors(),
      react(),
      localPlacesPlugin(),
      thirdPartyLicenses(),
      sharePreview(),
      chunkBudget(),
      buildManifest(
        BUILD,
        arrivals.map((arrival) => arrival.id),
      ),
    ],
    base: env.VITE_BASE_PATH || '/',
    define: {
      __TOWN_ARRIVALS__: JSON.stringify(readArrivalOrder(process.cwd())),
      __TOWN_ARRIVAL_DATES__: JSON.stringify(arrivalDates(arrivals)),
      __FORKTOWN_BUILD__: JSON.stringify(BUILD),
    },
    build: { rollupOptions: { input: { town: 'index.html', live: 'live/index.html' } } },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    test: {
      // Many tests sweep a whole town year, and the roster-wide ones grow with the town. With all
      // 141 house plots of the 20 × 10 town taken, the slowest without a timeout of their own took
      // 6–8 s alone on a busy desktop, and CI's shared runners are no faster, so Vitest's 5 s
      // default would fail them there. With the 230 house plots of the 20 × 15 town the limit is
      // 20 s, and the heaviest sweeps take rosterTimeout (tests/roster-timeout.ts). A hung test
      // still stops within 20 s.
      testTimeout: 20_000,
      // Worktrees under .claude/ and scratch copies under .shots/ carry tests of their own.
      exclude: [...configDefaults.exclude, '.claude/**', '.shots/**'],
    },
  };
});
