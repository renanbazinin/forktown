import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Connect, ViteDevServer } from 'vite';
import { listeningRoom } from '../scripts/listening-room';

/** The URL a request ends up with after the listening room's middleware, under a base path. */
function rewrite(url: string, base = '/') {
  let handler!: Connect.NextHandleFunction;
  const server = {
    config: { base },
    middlewares: { use: (fn: Connect.NextHandleFunction) => (handler = fn) },
  } as unknown as ViteDevServer;
  (listeningRoom().configureServer as (server: ViteDevServer) => void)(server);
  const request = { url } as Connect.IncomingMessage;
  handler(request, {} as never, () => {});
  return request.url;
}

describe('The listening room', () => {
  it('opens at /music on the development server only', () => {
    expect(listeningRoom().apply).toBe('serve');
    expect(rewrite('/music')).toBe('/tests/manual/music.html');
    expect(rewrite('/music/')).toBe('/tests/manual/music.html');
    expect(rewrite('/music?track=sunrise')).toBe('/tests/manual/music.html?track=sunrise');
    expect(rewrite('/forktown/music', '/forktown/')).toBe('/forktown/tests/manual/music.html');
    for (const other of ['/', '/musical', '/music/extra', '/live/', '/tests/manual/music.html'])
      expect(rewrite(other)).toBe(other);
  });
  it('is never part of the production build', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toMatch(/plugins: \[[^\]]*listeningRoom\(\)/);
    expect(config).toMatch(/input: \{ town: 'index.html', live: 'live\/index.html' \}/);
  });
});
