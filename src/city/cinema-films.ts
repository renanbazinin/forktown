import type { AdArtwork, CinemaAd, CinemaFilm, CinemaSlot, FilmArtwork } from '../lib/cinema';
import { slate, titles } from '../films/kit';
import type { AdModule, FilmModule } from '../films/types';

type Ctx = CanvasRenderingContext2D;
const W = 320,
  H = 180;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
function words(ctx: Ctx, text: string, y: number, size = 10, color = '#FFF2D0') {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px "Space Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, y);
}
function star(ctx: Ctx, x: number, y: number, color = '#FFE4A0', size = 2) {
  box(ctx, x - size, y, size * 2 + 1, 1, color);
  box(ctx, x, y - size, 1, size * 2 + 1, color);
}
function nightSky(ctx: Ctx, seconds: number) {
  box(ctx, 0, 0, W, H, '#202D48');
  for (let i = 0; i < 28; i++)
    star(
      ctx,
      (i * 73 + 17) % W,
      (i * 31 + 9) % 100,
      i % 3 ? '#8B9AAE' : '#FFE5AC',
      1 + Math.round((Math.sin(seconds * 0.4 + i) + 1) / 2),
    );
}
type ReelModule = typeof import('../films');
let reel: Record<FilmArtwork, FilmModule> | undefined;
let ads: Record<AdArtwork, AdModule> | undefined;
let reeling: Promise<Record<FilmArtwork, FilmModule>> | undefined;
/** After a failed load: when it failed, how many tries so far, and where a retry can ask. */
let trouble: { since: number; tries: number; retry?: string } | undefined;
/** How long a failed reel waits before it asks again (real milliseconds). */
export const REEL_RETRY_MS = 30_000;

/**
 * Browsers remember a failed module fetch for its address, so asking again for the same chunk
 * fails straight away. A retry can only work under a fresh address: the chunk's own, as the
 * browser names it in the error, with a query. Only a same-origin script address qualifies.
 */
export function reelRetryAddress(error: unknown, origin: string | undefined, tries: number) {
  const named = /https?:\/\/[^\s'"<>]+?\.(?:js|ts)(?=$|[\s'"<>?#])/.exec(
    error instanceof Error ? error.message : String(error),
  )?.[0];
  if (!named || !origin) return undefined;
  const url = new URL(named);
  if (url.origin !== origin) return undefined;
  url.searchParams.set('retry', String(tries));
  return url.href;
}

const openReel = (address?: string): Promise<ReelModule> =>
  address ? import(/* @vite-ignore */ address) : import('../films');

/**
 * The film library's pictures (and the ads') are their own chunk, fetched as the screen starts
 * to rise (or when a reel film is first asked for), so a daytime visit never downloads them.
 * If the chunk fails (offline for a moment, or a new deploy renamed it under an open tab), the
 * screen asks for a refresh, and a fresh try goes out every REEL_RETRY_MS where one can work.
 */
export function loadReel(open = openReel) {
  if (reeling && !(trouble?.retry && Date.now() - trouble.since >= REEL_RETRY_MS)) return reeling;
  const tries = trouble?.tries ?? 0;
  reeling = open(trouble?.retry).then(
    (module) => {
      ads = module.ADS;
      trouble = undefined;
      return (reel = module.REEL);
    },
    (error: unknown) => {
      const retry = reelRetryAddress(error, globalThis.location?.origin, tries + 1);
      trouble = { since: Date.now(), tries: tries + 1, retry: retry ?? trouble?.retry };
      throw error;
    },
  );
  // Every frame asks for the reel. The screen shows the trouble; the promise needn't shout it.
  reeling.catch(() => {});
  return reeling;
}

/** True while the reel has failed to arrive, so the screen and the cinema panel can say so. */
export const reelMissing = () => trouble !== undefined;

/** Shown for the moment it takes the reel to arrive, if someone sits down mid-film. */
function threading(ctx: Ctx, film: CinemaFilm, seconds: number) {
  nightSky(ctx, seconds);
  words(ctx, 'forktown.', 86, 21);
  words(ctx, film.title.toUpperCase(), 112, 9, '#DBBF89');
  words(
    ctx,
    reelMissing() ? 'REFRESH FOR TONIGHT’S FILMS' : 'THREADING THE PROJECTOR...',
    130,
    7,
    '#ADBFBA',
  );
}

/** Every film draws itself at any point in its own timeline, from its reel module. */
export function drawCinemaFilm(ctx: Ctx, film: CinemaFilm, elapsed: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  const p = clamp((elapsed - 3) / (film.duration - 6));
  const module = reel?.[film.artwork];
  if (module) {
    module.draw(ctx, p, elapsed);
    titles(ctx, film, elapsed, module.look);
  } else {
    void loadReel();
    threading(ctx, film, elapsed);
  }
  ctx.restore();
}

/** An ad from around town, closing on its sponsor slate. */
export function drawCinemaAd(ctx: Ctx, ad: CinemaAd, elapsed: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  const module = ads?.[ad.artwork];
  if (module) {
    module.draw(ctx, clamp(elapsed / ad.duration), elapsed);
    slate(ctx, ad, elapsed, module.look);
  } else {
    void loadReel();
    nightSky(ctx, elapsed);
    words(ctx, ad.sponsor.toUpperCase(), 96, 9, '#DBBF89');
    words(ctx, ad.tagline, 114, 7, '#ADBFBA');
  }
  ctx.restore();
}

export function drawCinemaCard(ctx: Ctx, slot?: CinemaSlot, seconds = 0) {
  nightSky(ctx, seconds);
  for (let i = 0; i < 4; i++)
    box(
      ctx,
      146 - i * 5,
      51 + i * 7,
      28 + i * 10,
      6,
      ['#92AD8D', '#ABC29B', '#789D80', '#567E6C'][i],
    );
  box(ctx, 157, 77, 6, 12, '#C7B68C');
  words(ctx, 'forktown.', 111, 21);
  words(ctx, 'STARLIGHT CINEMA', 128, 8, '#DBBF89');
  words(
    ctx,
    !slot
      ? 'FILMS UNDER THE STARS · TONIGHT 20:30'
      : slot.kind === 'closing'
        ? 'THANK YOU. GET HOME UNDER THE STARS.'
        : slot.kind === 'opening'
          ? 'SETTLE IN. THE SHOW IS ABOUT TO BEGIN.'
          : 'A LITTLE BREATHER. ONE MORE STORY.',
    151,
    7,
    '#ADBFBA',
  );
  if (slot?.nextFilm) words(ctx, `NEXT: ${slot.nextFilm.title}`, 167, 8);
}
