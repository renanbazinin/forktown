import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { localPlacesPlugin } from './scripts/local-places.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), localPlacesPlugin()],
    base: env.VITE_BASE_PATH || '/',
    build: { rollupOptions: { input: { town: 'index.html', live: 'live/index.html' } } },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  };
});
