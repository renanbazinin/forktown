import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { localPlacesPlugin } from './scripts/local-places.ts';
import { readArrivalOrder } from './scripts/town-arrivals.ts';
import { thirdPartyLicenses } from './scripts/third-party-licenses.ts';
import { sharePreview } from './scripts/share-preview.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), localPlacesPlugin(), thirdPartyLicenses(), sharePreview()],
    base: env.VITE_BASE_PATH || '/',
    define: { __TOWN_ARRIVALS__: JSON.stringify(readArrivalOrder(process.cwd())) },
    build: { rollupOptions: { input: { town: 'index.html', live: 'live/index.html' } } },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  };
});
