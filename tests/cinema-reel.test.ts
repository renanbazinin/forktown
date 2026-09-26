import { beforeAll, describe, expect, it } from 'vitest';
import { drawCinemaAd, drawCinemaFilm, loadReel } from '../src/city/cinema-films';
import { ADS, REEL } from '../src/films';
import { slateSeconds } from '../src/films/kit';
import { CLASHES } from '../src/films/duel-at-dusk';
import { AD_SCORES, REEL_SCORES } from '../src/films/scores';
import { LAST_DROP, ROOM_DROPS, STREET_DROPS } from '../src/films/the-rain-orchestra';
import { CINEMA_ADS, CINEMA_FILMS, type FilmArtwork } from '../src/lib/cinema';
import { cinemaScore } from '../src/music/cinema-score';
import { recordingContext } from './recording-context';

const reel = CINEMA_FILMS;
const module = (artwork: string) => REEL[artwork as FilmArtwork];
const frame = (film: (typeof reel)[number], elapsed: number) => {
  const recording = recordingContext(320, 180);
  drawCinemaFilm(recording.ctx, film, elapsed);
  return recording.calls;
};

describe('The film library', () => {
  beforeAll(() => loadReel());

  it('gives every film its own module and end-card dedication', () => {
    expect(reel).toHaveLength(22);
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
    // Grown-up films wear their 14+ badge and genre on the title card; family films do not.
    if (film.rating) expect(text(1)).toEqual(expect.arrayContaining([film.rating]));
    else expect(text(1)).not.toContain('14+');
    expect(text(1)).toContain(
      film.genre === 'action'
        ? 'a forktown action picture'
        : film.genre
          ? `a forktown ${film.genre}`
          : 'a forktown original',
    );
  });

  it.each(reel)('$title plays the same score from the reel and from the audio registry', (film) => {
    expect(module(film.artwork).score).toBe(REEL_SCORES[film.artwork as FilmArtwork]);
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

  it('lands every sword clash in Duel at Dusk on a blade contact the picture sparks', () => {
    const film = reel.find((candidate) => candidate.artwork === 'duel')!;
    const story = film.duration - 6;
    const clashes = cinemaScore(film).filter((cue) => cue.kind === 'clash');
    expect(clashes).toHaveLength(CLASHES.length);
    for (const contact of CLASHES)
      expect(clashes.some((cue) => Math.abs(cue.at - (3 + contact.p * story)) < 1e-9)).toBe(true);
  });
});

describe('The ads between films', () => {
  beforeAll(() => loadReel());
  const spot = (ad: (typeof CINEMA_ADS)[number], elapsed: number) => {
    const recording = recordingContext(320, 180);
    drawCinemaAd(recording.ctx, ad, elapsed);
    return recording.calls;
  };
  const text = (ad: (typeof CINEMA_ADS)[number], elapsed: number) =>
    spot(ad, elapsed)
      .filter((call) => call.name === 'fillText')
      .map((call) => call.args[0]);

  it('gives every ad its own module, jingle, and slate colours', () => {
    expect(Object.keys(ADS).sort()).toEqual(CINEMA_ADS.map((ad) => ad.artwork).sort());
    expect(Object.keys(AD_SCORES).sort()).toEqual(Object.keys(ADS).sort());
    for (const ad of CINEMA_ADS) {
      expect(ADS[ad.artwork].score).toBe(AD_SCORES[ad.artwork]);
      expect(cinemaScore(ad)).toEqual(ADS[ad.artwork].score(ad));
      for (const color of Object.values(ADS[ad.artwork].look))
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it.each(CINEMA_ADS)(
    '$sponsor draws the same frame every time, within the canvas budget',
    (ad) => {
      for (let elapsed = 0; elapsed < ad.duration; elapsed += 0.5) {
        const first = spot(ad, elapsed);
        expect(first.length).toBeLessThan(4000);
        expect(JSON.stringify(spot(ad, elapsed))).toBe(JSON.stringify(first));
      }
    },
  );

  it.each(CINEMA_ADS)('$sponsor ends on its sponsor slate', (ad) => {
    const late = ad.duration - slateSeconds(ad) + 1.5;
    expect(text(ad, late)).toEqual(expect.arrayContaining([ad.sponsor, ad.tagline]));
    expect(text(ad, 1)).not.toContain(ad.tagline);
  });
});
