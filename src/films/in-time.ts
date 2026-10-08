import type { FilmModule } from './types';
import { box, H, line, sky, vignette, W } from './kit';
import { composeFilm } from './score-kit';

/*
 * IN TIME (placeholder): the river on regatta morning, and one old wooden pair. The finished
 * film replaces this module; it keeps the export names so the registries stay valid meanwhile.
 */
export const inTimeScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: 57, voice: 'keys', intro: [0, 3, 7], outro: [0, 4, 7, 12] }, (s) => {
    s.fx('water', 0, s.story, 0.08);
    s.section({ from: 0, to: 1, bpm: 84, root: 57, chords: [0, 5, 3, 7], minor: true, level: 0.6 });
  });

export const inTime: FilmModule = {
  draw(ctx, _p, seconds) {
    sky(ctx, ['#9FC2D6', '#C3D9E2', '#E6E4D2'], 0, 84);
    box(ctx, 0, 76, W, 10, '#5E7F4E');
    box(ctx, 0, 86, W, H - 86, '#3F6A80');
    for (let i = 0; i < 9; i++) {
      const x = ((i * 47 + seconds * 6) % (W + 40)) - 20;
      box(ctx, x, 96 + i * 9, 24, 1, '#7FA6B8');
    }
    // The skiff, low in the water, with both oars out.
    box(ctx, 120, 128, 80, 6, '#8A5A36');
    box(ctx, 124, 134, 72, 3, '#6B4A30');
    line(ctx, '#D8C49A', 2, [148, 130, 128, 146]);
    line(ctx, '#D8C49A', 2, [176, 130, 196, 146]);
    vignette(ctx, 0.35, '#1E3A4C');
  },
  score: inTimeScore,
  look: {
    shade: '#1E3A4C',
    ink: '#F4E6C4',
    accent: '#E0A043',
    dedication: 'for everyone who once slowed down for us',
  },
};
