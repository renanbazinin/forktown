import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as library from '../src/films';
import { CINEMA_FILMS } from '../src/lib/cinema';
import { recordingContext } from './recording-context';

const origin = 'https://town.test';
const chunk = `${origin}/assets/films-C3aCSOMP.js`;
const film = CINEMA_FILMS[0];

/** A fresh copy of the reel loader, with nothing loaded yet. */
async function freshReel() {
  vi.resetModules();
  const films = await import('../src/city/cinema-films');
  const { default: CinemaInfo } = await import('../src/components/CinemaInfo');
  const screen = () => {
    const recording = recordingContext(320, 180);
    films.drawCinemaFilm(recording.ctx, film, 30);
    return recording.calls.filter((call) => call.name === 'fillText').map((call) => call.args[0]);
  };
  // 21:00 on day 0, when the films are on.
  const panel = () => renderToStaticMarkup(createElement(CinemaInfo, { minutes: 1260, day: 0 }));
  return { ...films, screen, panel };
}

describe('A film reel that fails to arrive', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { origin });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 8, 20, 12));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks for a refresh on the screen and in the cinema panel', async () => {
    const reel = await freshReel();
    const open = () =>
      Promise.reject(new TypeError(`Failed to fetch dynamically imported module: ${chunk}`));
    await expect(reel.loadReel(open)).rejects.toThrow(/Failed to fetch/);
    expect(reel.reelMissing()).toBe(true);
    expect(reel.screen()).toContain('REFRESH FOR TONIGHT’S FILMS');
    expect(reel.panel()).toContain('Refresh the page to watch them.');
  });

  it('tries again later under a fresh address, and the films come back', async () => {
    const reel = await freshReel();
    const asked: (string | undefined)[] = [];
    const open = (address?: string) => {
      asked.push(address);
      return asked.length === 1
        ? Promise.reject(new TypeError(`Failed to fetch dynamically imported module: ${chunk}`))
        : Promise.resolve(library);
    };
    await expect(reel.loadReel(open)).rejects.toThrow();
    // Every frame asks; nothing goes out again until the wait is over.
    for (let frame = 0; frame < 30; frame++) void reel.loadReel(open);
    vi.setSystemTime(Date.now() + reel.REEL_RETRY_MS - 1);
    void reel.loadReel(open);
    expect(asked).toEqual([undefined]);
    vi.setSystemTime(Date.now() + 1);
    await expect(reel.loadReel(open)).resolves.toBe(library.REEL);
    expect(asked).toEqual([undefined, `${chunk}?retry=1`]);
    expect(reel.reelMissing()).toBe(false);
    expect(reel.screen()).not.toContain('REFRESH FOR TONIGHT’S FILMS');
    expect(reel.panel()).not.toContain('Refresh the page');
  });

  it('does not hammer an address it cannot change, and keeps the hint', async () => {
    const reel = await freshReel();
    let asked = 0;
    const open = () => {
      asked++;
      return Promise.reject(new TypeError('Importing a module script failed.'));
    };
    await expect(reel.loadReel(open)).rejects.toThrow();
    vi.setSystemTime(Date.now() + 10 * reel.REEL_RETRY_MS);
    await expect(reel.loadReel(open)).rejects.toThrow();
    expect(asked).toBe(1);
    expect(reel.screen()).toContain('REFRESH FOR TONIGHT’S FILMS');
  });

  it('only retries its own scripts', async () => {
    const { reelRetryAddress } = await freshReel();
    const failed = (url: string) =>
      new TypeError(`Failed to fetch dynamically imported module: ${url}`);
    expect(reelRetryAddress(failed(chunk), origin, 2)).toBe(`${chunk}?retry=2`);
    expect(reelRetryAddress(failed('https://elsewhere.test/films.js'), origin, 1)).toBeUndefined();
    expect(reelRetryAddress(failed(chunk), undefined, 1)).toBeUndefined();
    expect(
      reelRetryAddress(
        failed('http://127.0.0.1:5173/src/films/index.ts'),
        'http://127.0.0.1:5173',
        1,
      ),
    ).toBe('http://127.0.0.1:5173/src/films/index.ts?retry=1');
    expect(
      reelRetryAddress(
        failed('https://my.tsite.test/assets/films-x.js'),
        'https://my.tsite.test',
        3,
      ),
    ).toBe('https://my.tsite.test/assets/films-x.js?retry=3');
  });
});
