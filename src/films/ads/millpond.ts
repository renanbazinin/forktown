import type { AdModule } from '../types';
import { box, H, W } from '../kit';
import { composeAd } from '../score-kit';

// A placeholder while the spot is in production.
export const millpondAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    s.section({ from: 0, to: 1, bpm: 110, root: 60, chords: [0, 5] });
    s.fx('chime', 0.5, 1.2, 0.12);
  });

export const millpondAd: AdModule = {
  draw(ctx) {
    box(ctx, 0, 0, W, H, '#16303A');
  },
  score: millpondAdScore,
  look: { shade: '#16303A', ink: '#EEF8F6', accent: '#9FD8C8' },
};
