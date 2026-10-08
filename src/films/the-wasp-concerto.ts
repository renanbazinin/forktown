import type { FilmModule } from './types';
import { box, disc, H, poly, sky, vignette, W } from './kit';
import { composeFilm } from './score-kit';

/*
 * THE WASP CONCERTO (placeholder): the bandstand on a Sunday afternoon, and one wasp. The
 * finished film replaces this module; it keeps the export names so the registries stay valid
 * meanwhile.
 */
export const theWaspConcertoScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: 58, voice: 'lead', intro: [0, 4, 7], outro: [0, 4, 7, 12] }, (s) => {
    s.fx('hum', 0, s.story, 0.06);
    s.section({ from: 0, to: 1, bpm: 104, root: 58, chords: [0, 5, 7, 0], level: 0.6 });
  });

export const theWaspConcerto: FilmModule = {
  draw(ctx, _p, seconds) {
    sky(ctx, ['#8CC4E8', '#A9D4EE', '#CDE6F2'], 0, 110);
    box(ctx, 0, 110, W, H - 110, '#6FA04A');
    // The bandstand: a striped roof on white posts over a round deck.
    poly(ctx, '#B8262C', [100, 58, 160, 26, 220, 58]);
    for (let i = 0; i < 6; i++) poly(ctx, '#F6E7B8', [108 + i * 20, 58, 160, 26, 116 + i * 20, 58]);
    box(ctx, 98, 58, 124, 5, '#F2C230');
    for (const x of [104, 136, 182, 214]) box(ctx, x, 63, 3, 52, '#F6F1E4');
    box(ctx, 92, 114, 136, 10, '#E6DCC8');
    // One wasp, already circling.
    const wx = 250 + Math.sin(seconds * 2.1) * 14,
      wy = 80 + Math.cos(seconds * 3.3) * 8;
    disc(ctx, wx, wy, 2, '#F2C230');
    box(ctx, wx - 1, wy - 1, 1, 3, '#1A1A1A');
    vignette(ctx, 0.3, '#7A1E22');
  },
  score: theWaspConcertoScore,
  look: {
    shade: '#7A1E22',
    ink: '#F6E7B8',
    accent: '#F2C230',
    dedication: 'no wasps were harmed. one tuba was.',
  },
};
