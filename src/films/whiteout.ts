import type { FilmModule } from './types';
import { box, H, W, write } from './kit';
import { composeFilm } from './score-kit';

// A placeholder while the film is in production.
export const whiteoutScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: 57, voice: 'keys', intro: [0, 7, 12], outro: [0, 4, 7] }, (s) => {
    s.section({ from: 0, to: 1, bpm: 80, root: 57, chords: [0, 5, 7, 5], minor: true });
    s.fx('chime', 0.5, 1.2, 0.12);
  });

export const whiteout: FilmModule = {
  draw(ctx) {
    box(ctx, 0, 0, W, H, '#101820');
    write(ctx, 'IN PRODUCTION', W / 2, H / 2, { size: 8, color: '#E2583E' });
  },
  score: whiteoutScore,
  look: {
    shade: '#101820',
    ink: '#F4F8FC',
    accent: '#E2583E',
    dedication: 'for the ones who go up when others come down',
  },
};
