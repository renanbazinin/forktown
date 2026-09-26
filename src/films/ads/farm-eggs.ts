import type { AdModule } from '../types';
import { box, H, W } from '../kit';
import { composeAd } from '../score-kit';

// A placeholder while the spot is in production.
export const farmEggsAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    s.section({ from: 0, to: 1, bpm: 110, root: 60, chords: [0, 5] });
    s.fx('chime', 0.5, 1.2, 0.12);
  });

export const farmEggsAd: AdModule = {
  draw(ctx) {
    box(ctx, 0, 0, W, H, '#243020');
  },
  score: farmEggsAdScore,
  look: { shade: '#243020', ink: '#FFF6E2', accent: '#F2B84E' },
};
