import type { FilmModule } from './types';
import { box, H, W, write } from './kit';
import { composeFilm } from './score-kit';

// A placeholder while the film is in production.
export const replyAllScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: 57, voice: 'keys', intro: [0, 7, 12], outro: [0, 4, 7] }, (s) => {
    s.section({ from: 0, to: 1, bpm: 80, root: 57, chords: [0, 5, 7, 5], minor: true });
    s.fx('chime', 0.5, 1.2, 0.12);
  });

export const replyAll: FilmModule = {
  draw(ctx) {
    box(ctx, 0, 0, W, H, '#16202A');
    write(ctx, 'IN PRODUCTION', W / 2, H / 2, { size: 8, color: '#5AB0E0' });
  },
  score: replyAllScore,
  look: {
    shade: '#16202A',
    ink: '#F6F3EA',
    accent: '#5AB0E0',
    dedication: 'please consider the environment before replying',
  },
};
