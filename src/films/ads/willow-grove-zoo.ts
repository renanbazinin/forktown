import type { AdModule } from '../types';
import { box, H, W } from '../kit';
import { composeAd } from '../score-kit';

// A placeholder while the spot is in production.
export const zooAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    s.section({ from: 0, to: 1, bpm: 110, root: 60, chords: [0, 5] });
    s.fx('chime', 0.5, 1.2, 0.12);
  });

export const zooAd: AdModule = {
  draw(ctx) {
    box(ctx, 0, 0, W, H, '#1E2A18');
  },
  score: zooAdScore,
  look: { shade: '#1E2A18', ink: '#FFF8E6', accent: '#F29E4C' },
};
