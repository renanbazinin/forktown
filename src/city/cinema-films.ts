import type { CinemaFilm, CinemaSlot, FilmArtwork } from '../lib/cinema';
import { titles } from '../films/kit';
import type { FilmModule } from '../films/types';

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
let reel: Record<FilmArtwork, FilmModule> | undefined;
let reeling: Promise<Record<FilmArtwork, FilmModule>> | undefined;
/**
 * The film library's pictures are their own chunk, fetched as the screen starts to rise (or
 * when a reel film is first asked for), so a daytime visit never downloads them.
 */
export function loadReel() {
  reeling ??= import('../films').then((module) => (reel = module.REEL));
  return reeling;
}

/** Shown for the moment it takes the reel to arrive, if someone sits down mid-film. */
function threading(ctx: Ctx, film: CinemaFilm, seconds: number) {
  nightSky(ctx, seconds);
  words(ctx, 'forktown.', 86, 21);
  words(ctx, film.title.toUpperCase(), 112, 9, '#DBBF89');
  words(ctx, 'THREADING THE PROJECTOR...', 130, 7, '#ADBFBA');
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
      ? 'THREE LITTLE FILMS · TONIGHT 20:30'
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
