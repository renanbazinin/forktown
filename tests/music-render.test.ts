import { describe, expect, it } from 'vitest';
import { renderPCM, SAMPLE_RATE } from '../src/music/render';
import { durationOf, TRACKS, type TrackId } from '../src/music/score';

describe('Rendered soundtrack audio', () => {
  it.each(Object.keys(TRACKS) as TrackId[])(
    '%s renders audible stereo without clipping or a large loop discontinuity',
    (track) => {
      const mix = renderPCM(track);
      expect(mix.left.length).toBe(Math.round(durationOf(track) * SAMPLE_RATE));
      expect(mix.right.length).toBe(mix.left.length);
      let peak = 0,
        sum = 0,
        difference = 0;
      for (let i = 0; i < mix.left.length; i++) {
        const left = mix.left[i],
          right = mix.right[i];
        peak = Math.max(peak, Math.abs(left), Math.abs(right));
        sum += left * left + right * right;
        difference += Math.abs(left - right);
      }
      expect(Number.isFinite(peak + sum)).toBe(true);
      expect(peak).toBeLessThan(0.98);
      expect(Math.sqrt(sum / (mix.left.length * 2))).toBeGreaterThan(0.005);
      expect(difference).toBeGreaterThan(1);
      for (const samples of [mix.left, mix.right])
        expect(Math.abs(samples[0] - samples[samples.length - 1])).toBeLessThan(0.03);
    },
    15000,
  );
});
