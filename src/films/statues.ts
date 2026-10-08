import type { FilmModule } from './types';
import { box, disc, H, oval, sky, snowfall, vignette, W } from './kit';
import { composeFilm } from './score-kit';

/*
 * STATUES (placeholder): the snowy green at dusk, the oak, and one snowman. The finished film
 * replaces this module; it keeps the export names so the registries stay valid meanwhile.
 */
export const statuesScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: 62, voice: 'pluck', intro: [0, 3, 7], outro: [0, 4, 7, 12] }, (s) => {
    s.fx('wind', 0, s.story, 0.1);
    s.section({ from: 0, to: 1, bpm: 90, root: 62, chords: [0, 5], level: 0.6 });
  });

export const statues: FilmModule = {
  draw(ctx, _p, seconds) {
    sky(ctx, ['#2B2A40', '#4A4766', '#7A7090', '#B79FB0'], 0, 120);
    box(ctx, 0, 116, W, H - 116, '#E8ECF4');
    box(ctx, 0, 116, W, 3, '#C9D0E0');
    // The oak June counts against.
    box(ctx, 52, 40, 22, 82, '#4A3A34');
    oval(ctx, 63, 34, 46, 30, '#3A3350');
    // Her snowman, alone on the green.
    disc(ctx, 210, 128, 16, '#F6F7FB');
    disc(ctx, 210, 104, 11, '#F6F7FB');
    box(ctx, 206, 101, 2, 2, '#2B2A40');
    box(ctx, 212, 101, 2, 2, '#2B2A40');
    box(ctx, 210, 105, 6, 2, '#E0453A');
    snowfall(ctx, seconds, { amount: 0.6, speed: 10 });
    vignette(ctx, 0.4, '#1A1828');
  },
  score: statuesScore,
  look: {
    shade: '#2B2A40',
    ink: '#F6F1F4',
    accent: '#E0453A',
    dedication: 'for everyone who ever peeked',
  },
};
