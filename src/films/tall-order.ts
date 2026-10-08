import type { FilmModule } from './types';
import { box, disc, H, sky, vignette, W, type Ctx } from './kit';
import { composeFilm } from './score-kit';

/*
 * TALL ORDER (placeholder): the Morning Market aisle, with the melon stall on the left and the
 * orange stall on the right. The finished film replaces this module; it keeps the export names
 * so the registries stay valid meanwhile.
 */
export const tallOrderScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: 65, voice: 'pluck', intro: [0, 4, 7], outro: [0, 4, 7, 12] }, (s) => {
    s.fx('crowd', 0, s.story, 0.08);
    s.section({ from: 0, to: 1, bpm: 112, root: 65, chords: [0, 5, 7, 0], level: 0.6 });
  });

function stall(ctx: Ctx, x: number, canopy: string, fruit: string) {
  box(ctx, x, 70, 96, 10, canopy);
  for (let i = 0; i < 96; i += 16) box(ctx, x + i, 70, 8, 10, '#FFF3D6');
  box(ctx, x + 4, 80, 3, 50, '#6B4A30');
  box(ctx, x + 89, 80, 3, 50, '#6B4A30');
  box(ctx, x, 112, 96, 22, '#8A5A36');
  for (let i = 0; i < 6; i++) disc(ctx, x + 13 + i * 14, 107, 6, fruit);
}

export const tallOrder: FilmModule = {
  draw(ctx) {
    sky(ctx, ['#F7E2B0', '#F2CF94', '#E8B57A'], 0, 96);
    box(ctx, 0, 96, W, H - 96, '#B9A88A');
    box(ctx, 140, 96, 40, H - 96, '#CDBD9C');
    stall(ctx, 24, '#5FA24B', '#7DBA5A');
    stall(ctx, 200, '#E8892B', '#F28C28');
    vignette(ctx, 0.3, '#2F3A1F');
  },
  score: tallOrderScore,
  look: {
    shade: '#2F3A1F',
    ink: '#FFF3D6',
    accent: '#F28C28',
    dedication: 'please do not climb the displays',
  },
};
