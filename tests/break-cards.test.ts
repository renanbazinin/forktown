import { beforeAll, describe, expect, it, vi } from 'vitest';
import { drawBreakAd, drawBreakCard, loadReel, reelReady } from '../src/city/cinema-films';
import { CARDS } from '../src/films';
import { slateSeconds } from '../src/films/kit';
import { CARD_SCORES } from '../src/films/scores';
import {
  BREAK_CARDS,
  LIVE_BREAK_ADS,
  REEL_SEGMENTS,
  isCard,
  sentence,
  type BreakCard,
  type BreakCardData,
  type CardArtwork,
} from '../src/lib/break-cards';
import { CINEMA_ADS } from '../src/lib/cinema';
import type { Place } from '../src/lib/schema';
import { cinemaScore } from '../src/music/cinema-score';
import { renderCinemaPCM } from '../src/music/cinema-render';
import { readPlaces } from './full-town';
import { FROZEN_TOWN } from './district';
import { recordingContext } from './recording-context';
import { isSignFont, OFF_VOICE, withoutTheirWords, WORDY_HOUSES, writing } from './their-words';

const cards = Object.values(BREAK_CARDS);

/** A founder, a neighbor, and the longest name: from a town, the real one by default. */
function sampleOf(town: readonly Place[]): Place[] {
  const founder = town.find((place) => place.creator === 'forktown');
  const neighbor = town.find((place) => place.creator !== 'forktown');
  const longest = [...town].sort(
    (a, b) => b.name.length - a.name.length || (a.id < b.id ? -1 : 1),
  )[0];
  return [...new Set([founder, neighbor, longest].filter((place): place is Place => !!place))];
}
let sampled: Place[] | undefined;
const sampleHouses = () => (sampled ??= sampleOf(readPlaces()));
/**
 * Every house the voice is checked against: the real town's sample, the same from the frozen town
 * (tests/district.ts), and houses whose owners wrote "!" and apostrophes everywhere.
 */
const voiceHouses = () => [
  ...new Set([...sampleHouses(), ...sampleOf(FROZEN_TOWN), ...WORDY_HOUSES]),
];
const houseData = (place: Place): BreakCardData => ({
  now: Date.UTC(2026, 8, 29, 18, 30),
  house: {
    place,
    founder: place.creator === 'forktown',
    movedIn: place.creator === 'forktown' ? null : 'Spring 10, Year 1',
    lantern: place.creator === 'forktown' ? 'FOUNDING LANTERN' : 'LANTERN No. 12 OF 19',
  },
  comingUp: [
    {
      title: 'Lantern hour',
      place: 'The Lantern Fork',
      townTime: '20:00',
      startsAt: Date.UTC(2026, 8, 29, 18, 32),
    },
    {
      title: 'Films under the stars',
      place: 'The Starlight Cinema',
      townTime: '20:30',
      startsAt: Date.UTC(2026, 8, 29, 18, 32, 30),
    },
  ],
  calendar: { label: 'Autumn 3, Year 2', season: 'Autumn', moonName: 'Full moon', moonPhase: 0.5 },
});
const frame = (card: BreakCard, elapsed: number, data: BreakCardData) => {
  const recording = recordingContext(320, 180);
  drawBreakCard(recording.ctx, card, elapsed, data);
  return recording.calls;
};

describe('Break cards', () => {
  beforeAll(() => loadReel());

  it('are ready once the reel has arrived', () => {
    expect(reelReady()).toBe(true);
  });

  it('give every card its own module, draw-free jingle, and colours', () => {
    const artworks = Object.keys(BREAK_CARDS).sort();
    expect(Object.keys(CARDS).sort()).toEqual(artworks);
    expect(Object.keys(CARD_SCORES).sort()).toEqual(artworks);
    for (const card of cards) {
      expect(BREAK_CARDS[card.card]).toBe(card);
      expect(CARDS[card.card].score).toBe(CARD_SCORES[card.card]);
      expect(cinemaScore(card)).toEqual(CARD_SCORES[card.card](card));
      for (const color of Object.values(CARDS[card.card].look))
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(isCard(card)).toBe(true);
    }
    expect(CINEMA_ADS.some(isCard)).toBe(false);
  });

  it('have titles in the town’s voice', () => {
    for (const card of cards) {
      expect(card.id).toBe(`card-${card.card}`);
      expect(card.title).toMatch(/\.$/);
      expect(card.title).not.toMatch(/[!']/);
      expect(card.duration % 1).toBe(0);
    }
  });

  it.each(cards)('$title draws the same frame every time, within the canvas budget', (card) => {
    const samples: BreakCardData[] = [{ now: 0 }, ...sampleHouses().map(houseData)];
    for (const data of samples)
      for (let elapsed = 0; elapsed < card.duration; elapsed += 0.5) {
        const first = frame(card, elapsed, data);
        expect(first.length).toBeLessThan(4000);
        expect(JSON.stringify(frame(card, elapsed, data))).toBe(JSON.stringify(first));
      }
  });

  it('loops “We’ll be right back” without a seam: its first and last frames match', () => {
    const card = BREAK_CARDS['right-back'];
    // Rounded, so a sine that lands on -2e-16 instead of 0 still counts as the same pixel.
    const pixels = (elapsed: number) =>
      JSON.stringify(frame(card, elapsed, { now: 0 }), (_, value) =>
        typeof value === 'number' ? Math.round(value * 1000) / 1000 : value,
      );
    expect(pixels(card.duration)).toBe(pixels(0));
  });

  it.each(cards)('$title speaks in the town’s voice, whatever the house', (card) => {
    const samples: BreakCardData[] = [{ now: 0 }, ...voiceHouses().map(houseData)];
    let checked = 0;
    for (const data of samples)
      for (let elapsed = 0; elapsed < card.duration; elapsed += 1) {
        const recording = writing(recordingContext(320, 180).ctx);
        drawBreakCard(recording.ctx, card, elapsed, data);
        // A neighbor's own words, and their sign, are theirs to punctuate; only our copy is checked.
        for (const { text, font } of recording.written) {
          if (isSignFont(font)) continue;
          const ours = data.house ? withoutTheirWords(text, data.house.place) : text;
          expect(ours, `${data.house?.place.id}: ${text}`).not.toMatch(OFF_VOICE);
          checked++;
        }
      }
    expect(checked).toBeGreaterThan(0);
  });

  it.each(cards)('$title has a clean, repeatable jingle', (card) => {
    const mix = renderCinemaPCM(card);
    expect(mix.left.length).toBe(card.duration * mix.sampleRate);
    let peak = 0,
      energy = 0;
    for (let i = 0; i < mix.left.length; i++) {
      peak = Math.max(peak, Math.abs(mix.left[i]), Math.abs(mix.right[i]));
      energy += mix.left[i] ** 2 + mix.right[i] ** 2;
    }
    expect(Number.isFinite(energy + peak)).toBe(true);
    expect(peak).toBeLessThan(0.98);
    expect(energy).toBeGreaterThan(0);
    expect(mix.left[0]).toBe(0);
    expect(mix.right[0]).toBe(0);
    expect(mix.left.at(-1)).toBe(0);
    expect(mix.right.at(-1)).toBe(0);
    const again = renderCinemaPCM({ ...card });
    expect(again.left).toEqual(mix.left);
    expect(again.right).toEqual(mix.right);
    for (const cue of cinemaScore(card)) {
      expect(cue.at).toBeGreaterThanOrEqual(0);
      expect(cue.at + cue.duration).toBeLessThanOrEqual(card.duration);
    }
  });

  it('fall back to plain dusk and their title before the reel arrives', async () => {
    vi.resetModules();
    const fresh = await import('../src/city/cinema-films');
    expect(fresh.reelReady()).toBe(false);
    const recording = recordingContext(320, 180);
    fresh.drawBreakCard(recording.ctx, BREAK_CARDS['right-back'], 1, { now: 0 });
    const words = recording.calls.filter((call) => call.name === 'fillText').map((c) => c.args[0]);
    expect(words).toContain(BREAK_CARDS['right-back'].title);
  });
});

describe('Break ads', () => {
  beforeAll(() => loadReel());

  it('are every cinema ad except the ones about the cinema itself', () => {
    expect(LIVE_BREAK_ADS.map((ad) => ad.artwork)).toEqual(
      CINEMA_ADS.filter((ad) => ad.artwork !== 'phones' && ad.artwork !== 'snacks').map(
        (ad) => ad.artwork,
      ),
    );
    expect(LIVE_BREAK_ADS.map((ad) => ad.artwork)).not.toContain('phones');
    expect(LIVE_BREAK_ADS.map((ad) => ad.artwork)).not.toContain('snacks');
  });

  it.each(LIVE_BREAK_ADS)('$sponsor holds its sponsor slate to the very end', (ad) => {
    const text = (elapsed: number) => {
      const recording = recordingContext(320, 180);
      drawBreakAd(recording.ctx, ad, elapsed);
      return recording.calls.filter((call) => call.name === 'fillText').map((c) => c.args[0]);
    };
    const late = ad.duration - slateSeconds(ad) + 1.5;
    for (const elapsed of [late, ad.duration - 0.01, ad.duration + 1])
      expect(text(elapsed)).toEqual(expect.arrayContaining([ad.sponsor, ad.tagline]));
  });
});

describe('The gap reel', () => {
  it('opens with the right-back card, then every live-break ad once', () => {
    const [first, ...ads] = REEL_SEGMENTS;
    expect(first).toEqual({
      id: 'right-back',
      kind: 'card',
      duration: BREAK_CARDS['right-back'].duration,
      interruptibleAfter: 3,
    });
    expect(ads).toEqual(
      LIVE_BREAK_ADS.map((ad) => ({ id: `ad-${ad.artwork}`, kind: 'ad', duration: ad.duration })),
    );
    const ids = REEL_SEGMENTS.map((segment) => segment.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const segment of REEL_SEGMENTS) {
      // The stream box only accepts segment files named like this.
      expect(`${segment.id}.mp4`).toMatch(/^[a-z0-9-]+\.mp4$/);
      expect(segment.duration).toBeGreaterThan(0);
    }
  });
});

describe('Sentence-cased names', () => {
  it('end in a full stop unless the neighbor already ended them', () => {
    expect(sentence('Moss Nook')).toBe('Moss Nook.');
    expect(sentence('Hello, World!')).toBe('Hello, World!');
    expect(sentence('Why not?')).toBe('Why not?');
    expect(sentence('And then…')).toBe('And then…');
    expect(sentence('Sunday Morning.')).toBe('Sunday Morning.');
    const artworks: CardArtwork[] = ['right-back', 'coming-up', 'neighbors', 'welcome'];
    expect(Object.keys(BREAK_CARDS).sort()).toEqual([...artworks].sort());
  });
});
