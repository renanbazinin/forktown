import type { FilmModule } from './types';
import { box, disc, glow, H, sky, starfield, vignette, W } from './kit';
import { composeFilm } from './score-kit';

/*
 * THE RETURN JOB (placeholder): the museum roof at night, its skylight, and one red headlamp.
 * The finished film replaces this module; it keeps the export names so the registries stay
 * valid meanwhile.
 */
export const theReturnJobScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: 50, voice: 'pluck', intro: [0, 3, 7], outro: [0, 3, 7, 12] }, (s) => {
    s.fx('tick', 0, s.story, 0.05);
    s.section({ from: 0, to: 1, bpm: 96, root: 50, chords: [0, 3, 5, 0], minor: true, level: 0.6 });
  });

export const theReturnJob: FilmModule = {
  draw(ctx, _p, seconds) {
    sky(ctx, ['#0A0F18', '#10161F', '#18222F'], 0, 110);
    starfield(ctx, seconds, { count: 24, seed: 7, bottom: 90 });
    disc(ctx, 262, 34, 10, '#E8D9B0');
    // The museum roof and its glass skylight.
    box(ctx, 0, 110, W, H - 110, '#1C2430');
    box(ctx, 120, 96, 80, 16, '#2A3442');
    box(ctx, 126, 99, 68, 10, '#3E5A72');
    for (let x = 136; x < 194; x += 12) box(ctx, x, 99, 1, 10, '#1C2430');
    // A red headlamp, waiting at the roof edge.
    glow(ctx, 70, 104, 10, '#FF3B30', 0.5);
    box(ctx, 69, 103, 2, 2, '#FF3B30');
    vignette(ctx, 0.5, '#05080C');
  },
  score: theReturnJobScore,
  look: {
    shade: '#10161F',
    ink: '#E8D9B0',
    accent: '#D4A93A',
    dedication: 'returned with thanks, fifty years late',
  },
};
