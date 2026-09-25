import { describe, expect, it } from 'vitest';
import { CINEMA_FILMS, CINEMA_FRAME, cinemaListening } from '../src/lib/cinema';
import { cinemaScore } from '../src/music/cinema-score';
import { renderCinemaPCM } from '../src/music/cinema-render';

describe('Film soundtracks', () => {
  it.each(CINEMA_FILMS)(
    '$title has a full, finite stereo mix without clipping or cut-off edges',
    (film) => {
      const mix = renderCinemaPCM(film);
      expect(mix.left.length).toBe(film.duration * mix.sampleRate);
      expect(mix.right.length).toBe(mix.left.length);
      let peak = 0,
        energy = 0,
        stereo = 0;
      for (let i = 0; i < mix.left.length; i++) {
        const l = mix.left[i],
          r = mix.right[i];
        peak = Math.max(peak, Math.abs(l), Math.abs(r));
        energy += l * l + r * r;
        stereo += Math.abs(l - r);
      }
      expect(Number.isFinite(energy + peak)).toBe(true);
      expect(peak).toBeLessThan(0.98);
      expect(Math.sqrt(energy / (mix.left.length * 2))).toBeGreaterThan(0.015);
      expect(stereo).toBeGreaterThan(10);
      expect(mix.left[0]).toBe(0);
      expect(mix.left.at(-1)).toBe(0);
      // Every five-second story segment has intentional audible material.
      for (let second = 3; second < film.duration - 3; second += 5) {
        let sum = 0;
        const end = Math.min(mix.left.length, (second + 5) * mix.sampleRate);
        for (let i = second * mix.sampleRate; i < end; i++) sum += mix.left[i] ** 2;
        expect(sum).toBeGreaterThan(1);
      }
    },
    15000,
  );

  it('composes deterministically and keeps every cue inside its film', () => {
    for (const film of CINEMA_FILMS) {
      const score = cinemaScore(film);
      expect(cinemaScore({ ...film })).toEqual(score);
      expect(score.some((cue) => cue.kind !== 'note')).toBe(true);
      for (const cue of score) {
        expect(Number.isFinite(cue.at + cue.duration + cue.gain + cue.pan)).toBe(true);
        expect(cue.at).toBeGreaterThanOrEqual(0);
        expect(cue.at + cue.duration).toBeLessThanOrEqual(film.duration);
      }
    }
  });
});

describe('Cinema listening distance', () => {
  const camera = (zoom: number, width = 1000, height = 700) => ({
    zoom,
    x: width / 2 - CINEMA_FRAME.center.x * zoom,
    y: height / 2 - (CINEMA_FRAME.center.y - 60) * zoom,
  });
  it('is silent in the overview, grows with zoom, and stops offscreen', () => {
    expect(cinemaListening(camera(0.3), 1000, 700).gain).toBe(0);
    const close = cinemaListening(camera(1.2), 1000, 700);
    expect(close.gain).toBeCloseTo(1);
    expect(close.pan).toBe(0);
    expect(cinemaListening(camera(0.7), 1000, 700).gain).toBeLessThan(close.gain);
    expect(cinemaListening({ ...camera(1.2), x: 10000 }, 1000, 700).gain).toBe(0);
    expect(cinemaListening(camera(1), 0, 0).gain).toBe(0);
  });
  it('works on small screens and pans toward the projected cinema', () => {
    expect(cinemaListening(camera(0.65, 390, 844), 390, 844).gain).toBeGreaterThan(0.25);
    const center = camera(1.2);
    expect(cinemaListening({ ...center, x: center.x - 200 }, 1000, 700).pan).toBeLessThan(0);
    expect(cinemaListening({ ...center, x: center.x + 200 }, 1000, 700).pan).toBeGreaterThan(0);
  });
});
