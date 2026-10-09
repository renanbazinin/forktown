import type { Plugin } from 'vite';

/** Where the development server serves the listening room. */
export const LISTENING_ROOM_PATH = '/music';
const PAGE = '/tests/manual/music.html';

/**
 * The listening room (tests/manual/music.html) at /music on the development server: every tune,
 * the day's turns from one to the next, and the mix checks, without touching the town's clock.
 * It is a development page only: the production build never includes it.
 */
export function listeningRoom(): Plugin {
  return {
    name: 'forktown-listening-room',
    apply: 'serve',
    configureServer(server) {
      const base = server.config.base.replace(/\/$/, '');
      const route = `${base}${LISTENING_ROOM_PATH}`;
      server.middlewares.use((request, _response, next) => {
        const url = request.url ?? '';
        const cut = url.search(/[?#]/);
        const path = cut < 0 ? url : url.slice(0, cut);
        if (path === route || path === `${route}/`)
          request.url = `${base}${PAGE}${cut < 0 ? '' : url.slice(cut)}`;
        next();
      });
    },
  };
}
