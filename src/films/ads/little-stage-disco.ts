import type { AdModule } from '../types';
import { box, H, W } from '../kit';
import { composeAd } from '../score-kit';

// A placeholder while the spot is in production.
export const discoAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    s.section({ from: 0, to: 1, bpm: 110, root: 60, chords: [0, 5] });
    s.fx('chime', 0.5, 1.2, 0.12);
  });

export const discoAd: AdModule = {
  draw(ctx) {
    box(ctx, 0, 0, W, H, '#1A1030');
  },
  score: discoAdScore,
  look: { shade: '#1A1030', ink: '#FFF0FA', accent: '#FF7AC8' },
};
