import { beforeAll, describe, expect, it } from 'vitest';
import { drawCinemaFilm, loadReel } from '../src/city/cinema-films';
import { REEL } from '../src/films';
import { REEL_SCORES } from '../src/films/scores';
import { LAST_DROP, ROOM_DROPS, STREET_DROPS } from '../src/films/the-rain-orchestra';
import { CINEMA_FILMS, type ReelArtwork } from '../src/lib/cinema';
import { cinemaScore } from '../src/music/cinema-score';
import { recordingContext } from './recording-context';

const reel = CINEMA_FILMS.filter((film) => film.artwork in REEL);
const module = (artwork: string) => REEL[artwork as ReelArtwork];
const frame = (film: (typeof reel)[number], elapsed: number) => {
  const recording = recordingContext(320, 180);
  drawCinemaFilm(recording.ctx, film, elapsed);
  return recording.calls;
};

describe('The Starlight Reel', () => {
  beforeAll(() => loadReel());

  it('registers ten films, each with its own module and end-card dedication', () => {
    expect(reel).toHaveLength(10);
    expect(Object.keys(REEL).sort()).toEqual(reel.map((film) => film.artwork).sort());
    expect(Object.keys(REEL_SCORES).sort()).toEqual(Object.keys(REEL).sort());
    for (const film of reel) {
      const { look } = module(film.artwork);
      expect(look.dedication.length).toBeGreaterThan(8);
      for (const color of [look.shade, look.ink, look.accent])
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it.each(reel)('$title draws the same frame every time, within the canvas budget', (film) => {
    // Pure functions of story time: no randomness or hidden state, so every viewer agrees.
    for (let elapsed = 0; elapsed < film.duration; elapsed += 1.25) {
      const first = frame(film, elapsed);
      expect(first.length).toBeLessThan(4000);
      expect(JSON.stringify(frame(film, elapsed))).toBe(JSON.stringify(first));
    }
  });

  it.each(reel)('$title opens on its title card and closes on The End', (film) => {
    const text = (elapsed: number) =>
      frame(film, elapsed)
        .filter((call) => call.name === 'fillText')
        .map((call) => call.args[0]);
    expect(text(1)).toContain(film.title);
    expect(text(film.duration - 0.5)).toEqual(
      expect.arrayContaining(['The End', module(film.artwork).look.dedication]),
    );
    expect(text(film.duration / 2)).not.toContain('The End');
  });

  it.each(reel)('$title plays the same score from the reel and from the audio registry', (film) => {
    expect(module(film.artwork).score).toBe(REEL_SCORES[film.artwork as ReelArtwork]);
    expect(cinemaScore(film)).toEqual(module(film.artwork).score(film));
  });

  it('rings a bell as each drop lands in The Rain Orchestra, and saves the teacup for last', () => {
    const film = reel.find((candidate) => candidate.artwork === 'orchestra')!;
    const story = film.duration - 6;
    const bells = cinemaScore(film).filter((cue) => cue.kind === 'note' && cue.voice === 'bell');
    for (const drop of [...ROOM_DROPS, ...STREET_DROPS, LAST_DROP])
      expect(bells.some((cue) => Math.abs(cue.at - (3 + drop.p * story)) < 1e-9)).toBe(true);
    expect([...ROOM_DROPS, ...STREET_DROPS].some((drop) => drop.degree === 12)).toBe(false);
    expect(LAST_DROP.degree).toBe(12);
  });
});
