import { beforeAll, describe, expect, it } from 'vitest';
import { houseBounds } from '../src/city/houses';
import { drawBreakCard, loadReel } from '../src/city/cinema-films';
import { CARDS } from '../src/films';
import { rightBackCard, BARS, BREATH, DRIFT, LOOP } from '../src/films/cards/right-back';
import { SNORES } from '../src/films/cards/right-back-jingle';
import { BEATS, COLUMN, fitHouse, SAMPLE_HOUSE, STAGE } from '../src/films/cards/welcome';
import { WELCOME_CUES } from '../src/films/cards/welcome-jingle';
import { CURL, LOAF, miso } from '../src/films/miso-and-the-moon';
import { BREAK_CARDS, type BreakCardData, type SpotlightHouse } from '../src/lib/break-cards';
import { BRAND } from '../src/lib/brand';
import type { Place } from '../src/lib/schema';
import { cinemaScore } from '../src/music/cinema-score';
import { renderCinemaPCM } from '../src/music/cinema-render';
import { readPlaces } from './full-town';
import { everyShape } from './house-variety';
import { recordingContext } from './recording-context';
import { isSignFont, OFF_VOICE, withoutTheirWords, WORDY_HOUSES } from './their-words';

// "We’ll be right back" (Miso asleep on the test pattern, looping every 12 s) and "A new neighbor
// just moved in" (the newest house lands on its plot and lights its lantern).

const rightBack = BREAK_CARDS['right-back'];
const welcome = BREAK_CARDS.welcome;
const EYEBROW = /^[A-Z0-9 ·/’&–-]+$/;

/** Text as wide as its font says: Space Mono advances 0.6 em, the others about 0.55 em. */
function measure(text: string, font: string) {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 10);
  return text.length * size * (font.includes('Space Mono') ? 0.6 : 0.55);
}
type Written = {
  text: string;
  x: number;
  y: number;
  font: string;
  align: string;
  alpha: number;
  /** A drop shadow under the line that follows it. */
  shadow: boolean;
};
/** The recording context, with text measured by size and every line of text kept with its font. */
function measuringContext() {
  const recording = recordingContext(320, 180);
  const written: Written[] = [];
  const ctx = new Proxy(recording.ctx, {
    get(target, key) {
      if (key === 'measureText')
        return (text: string) => ({ width: measure(String(text), Reflect.get(target, 'font')) });
      if (key === 'fillText')
        return (text: string, x: number, y: number) => {
          written.push({
            text: String(text),
            x,
            y,
            font: Reflect.get(target, 'font'),
            align: Reflect.get(target, 'textAlign'),
            alpha: Reflect.get(target, 'globalAlpha'),
            shadow: String(Reflect.get(target, 'fillStyle')).startsWith('#000000'),
          });
          (Reflect.get(target, 'fillText') as CanvasRenderingContext2D['fillText'])(text, x, y);
        };
      return Reflect.get(target, key);
    },
    set: (target, key, value) => Reflect.set(target, key, value),
  });
  return { ctx, calls: recording.calls, written };
}
const draw = (card: typeof rightBack, elapsed: number, data: BreakCardData = { now: 0 }) => {
  const recording = measuringContext();
  drawBreakCard(recording.ctx, card, elapsed, data);
  return recording;
};
/** Rounded, so a sine that lands on -2e-16 instead of 0 still counts as the same pixel. */
const pixels = (calls: unknown) =>
  JSON.stringify(calls, (_, value) =>
    typeof value === 'number' ? Math.round(value * 1000) / 1000 : value,
  );

const spotlight = (place: Place, lantern: string | null = 'LANTERN No. 12 OF 19') =>
  ({
    place,
    founder: place.creator === 'forktown',
    movedIn: null,
    lantern,
  }) satisfies SpotlightHouse;
/** The tallest home the builder can make: the one that has to shrink most to fit the stage. */
const tallest = [...everyShape].sort(
  (a, b) => houseBounds(b).top - houseBounds(a).top || (a.id < b.id ? -1 : 1),
)[0];
/** A name at the schema’s 32-character limit, and a handle at GitHub’s 39. */
const longest: Place = {
  ...tallest,
  id: 'longest-name',
  name: 'The Very Long Lantern Fork House',
  creator: 'a-neighbor-with-a-very-long-handle-39ch',
  resident: { ...tallest.resident, greeting: 'Forty characters of greeting, just so...' },
};

describe('Miso, borrowed from the film', () => {
  it('is exported in place, sleeping poses and all', () => {
    expect(typeof miso).toBe('function');
    expect(CURL.tilt).toBeGreaterThan(LOAF.tilt);
    expect(CURL.kx).toBe(LOAF.kx);
  });
});

describe('We’ll be right back', () => {
  beforeAll(() => loadReel());

  it('is the card the registry and the live stream draw', () => {
    expect(CARDS['right-back']).toBe(rightBackCard);
  });

  it('loops without a seam: every frame of the reel comes round again 12 s later', () => {
    expect(rightBack.duration).toBe(LOOP);
    expect(LOOP % BREATH).toBe(0);
    expect(LOOP % DRIFT).toBe(0);
    expect(pixels(draw(rightBack, LOOP).calls)).toBe(pixels(draw(rightBack, 0).calls));
    // The reel renders frames k/15 for k = 0..179; the card's own clock runs on past 12 s.
    for (let k = 0; k < 180; k += 7) {
      const at = (seconds: number) => {
        const recording = measuringContext();
        rightBackCard.draw(recording.ctx, seconds / LOOP, seconds, { now: 0 });
        return pixels(recording.calls);
      };
      expect(at(k / 15 + LOOP)).toBe(at(k / 15));
    }
    // And it is alive in between: Miso breathes and the z’s drift.
    expect(pixels(draw(rightBack, 1.5).calls)).not.toBe(pixels(draw(rightBack, 0).calls));
  });

  it('draws the same frame every time, within the canvas budget', () => {
    for (let k = 0; k < 180; k += 3) {
      const first = draw(rightBack, k / 15).calls;
      expect(first.length).toBeLessThan(4000);
      expect(pixels(draw(rightBack, k / 15).calls)).toBe(pixels(first));
    }
  });

  it('paints its test pattern in the town’s colours, with no lantern amber', () => {
    expect([...BARS].sort()).toEqual(
      [
        BRAND.paper,
        BRAND.leaf,
        BRAND.green,
        BRAND.greenDeep,
        BRAND.timber,
        BRAND.duskLink,
        BRAND.dusk,
        BRAND.ink,
      ].sort(),
    );
    const amber = [BRAND.lantern, BRAND.glow, BRAND.lanternInk].map((c) => c.toLowerCase());
    for (let seconds = 0; seconds < LOOP; seconds += 0.75)
      for (const call of draw(rightBack, seconds).calls)
        expect(amber).not.toContain(String(call.fillStyle).toLowerCase());
  });

  it('says so in the town’s voice', () => {
    const text = draw(rightBack, 4).written.map((w) => w.text);
    expect(text).toEqual(
      expect.arrayContaining([
        'FORKTOWN',
        'We’ll be right back.',
        'The projectionist is changing the reel.',
      ]),
    );
    expect('FORKTOWN').toMatch(EYEBROW);
    for (const line of text) {
      if (line === 'z') continue;
      expect(line).toMatch(/\.$|^[A-Z]+$/);
      expect(line).not.toMatch(/!|'|\b(?:repo|commit|branch|SHA|merged)\b/i);
    }
    // Every line fits the frame.
    for (const w of draw(rightBack, 4).written)
      expect(measure(w.text, w.font) / 2).toBeLessThanOrEqual(160 - 8);
  });

  it('snores as each z sets off, and its lullaby is quiet at both ends so it loops cleanly', () => {
    const snores = cinemaScore(rightBack).filter((cue) => cue.kind === 'snore');
    expect(snores).toHaveLength(SNORES.length);
    for (const cue of snores) {
      // A z sets off every BREATH seconds; the snore swells into the in-breath just after.
      expect(cue.at % BREATH).toBeGreaterThan(0);
      expect(cue.at % BREATH).toBeLessThan(0.5);
    }
    const mix = renderCinemaPCM(rightBack);
    const rms = (from: number, to: number) => {
      let sum = 0;
      const a = Math.round(from * mix.sampleRate),
        b = Math.round(to * mix.sampleRate);
      for (let i = a; i < b; i++) sum += mix.left[i] ** 2 + mix.right[i] ** 2;
      return Math.sqrt(sum / ((b - a) * 2));
    };
    expect(mix.left[0]).toBe(0);
    expect(mix.right[0]).toBe(0);
    expect(mix.left.at(-1)).toBe(0);
    expect(mix.right.at(-1)).toBe(0);
    expect(rms(0, 0.1)).toBeLessThan(0.001);
    expect(rms(LOOP - 0.25, LOOP)).toBeLessThan(0.005);
    expect(rms(1, LOOP - 1)).toBeGreaterThan(0.01);
    for (let second = 0; second < LOOP; second += 3)
      expect(rms(second, second + 3), `bar at ${second} s`).toBeGreaterThan(0.004);
    for (const cue of cinemaScore(rightBack))
      expect(cue.at + cue.duration).toBeLessThanOrEqual(LOOP - 0.2);
  });
});

describe('A new neighbor just moved in', () => {
  beforeAll(() => loadReel());
  const data = (place: Place, lantern?: string | null): BreakCardData => ({
    now: 0,
    house: spotlight(place, lantern),
  });
  /**
   * The card’s own words, with the neighbor’s taken out: their name, greeting and handle, whole
   * or as the column wraps them, and their house’s sign (tests/their-words.ts).
   */
  const ours = (written: Written[], place: Place) =>
    written
      .filter((w) => w.x >= COLUMN.x && !w.shadow && !isSignFont(w.font))
      .map((w) => withoutTheirWords(w.text, place));

  it('is the card the registry and the live stream draw', () => {
    expect(CARDS.welcome.draw).toBeTypeOf('function');
    expect(welcome.duration).toBe(10);
  });

  it('shows its sample house when it has none of its own', () => {
    const { written } = draw(welcome, 9.5);
    const column = written.filter((w) => w.x >= COLUMN.x && !w.shadow).map((w) => w.text);
    expect(column.join(' ')).toContain('My Little Place just moved in.');
    expect(column).toEqual(
      expect.arrayContaining([
        'A NEW NEIGHBOR',
        'BUILT BY',
        '@renanbazinin',
        'LANTERN No. 9 OF 19',
      ]),
    );
    expect(SAMPLE_HOUSE.founder).toBe(false);
  });

  it('draws the same frame every time, within the canvas budget, whatever the house', () => {
    for (const place of [SAMPLE_HOUSE.place, tallest, longest])
      for (let elapsed = 0; elapsed <= welcome.duration; elapsed += 0.25) {
        const first = draw(welcome, elapsed, data(place)).calls;
        expect(first.length).toBeLessThan(4000);
        expect(pixels(draw(welcome, elapsed, data(place)).calls)).toBe(pixels(first));
      }
  });

  it('fits the tallest house on its stage and the longest name in its column', () => {
    for (const place of [tallest, longest, SAMPLE_HOUSE.place, ...everyShape]) {
      const fit = fitHouse(place);
      const { top, bottom, left, right } = houseBounds(place);
      expect(fit.y - top * fit.scale).toBeGreaterThanOrEqual(STAGE.y - 0.5);
      expect(fit.y + bottom * fit.scale).toBeLessThanOrEqual(STAGE.y + STAGE.h + 0.5);
      expect(fit.x - left * fit.scale).toBeGreaterThanOrEqual(0);
      expect(fit.x + right * fit.scale).toBeLessThanOrEqual(COLUMN.x);
    }
    expect(longest.name).toHaveLength(32);
    const { written } = draw(welcome, 9.5, data(longest));
    const column = written.filter((w) => w.x >= COLUMN.x && !w.shadow);
    expect(column.map((w) => w.text).join(' ')).toContain(`${longest.name} just moved in.`);
    expect(column.map((w) => w.text)).toContain(`@${longest.creator}`);
    for (const w of column) {
      expect(w.align).toBe('left');
      expect(w.x + measure(w.text, w.font), w.text).toBeLessThanOrEqual(COLUMN.x + COLUMN.w);
      expect(w.y).toBeGreaterThan(8);
      expect(w.y).toBeLessThan(178);
    }
    // Lines never overlap: each baseline sits below the last.
    const ys = column.map((w) => w.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  it('keeps the name on one line and “just moved in.” on the next when it can', () => {
    const lines = (place: Place) =>
      draw(welcome, 9.5, data(place))
        .written.filter((w) => w.x >= COLUMN.x && !w.shadow && w.font.includes('Fraunces'))
        .filter((w) => !w.font.startsWith('italic'))
        .map((w) => w.text);
    expect(lines({ ...SAMPLE_HOUSE.place, name: 'funky fun' })).toEqual([
      'funky fun',
      'just moved in.',
    ]);
    expect(lines({ ...SAMPLE_HOUSE.place, name: 'Hello, World!' })).toEqual([
      'Hello, World!',
      'just moved in.',
    ]);
  });

  it('speaks in the town’s voice for every house in town, and keeps handles as they are', () => {
    for (const place of [...readPlaces(), longest, ...WORDY_HOUSES]) {
      const { written } = draw(welcome, 9.5, data(place));
      const words = ours(written, place);
      for (const text of words) expect(text, place.id).not.toMatch(OFF_VOICE);
      // Taking a wordy neighbor's words out still leaves the card's own to check.
      if (WORDY_HOUSES.includes(place))
        for (const line of ['A NEW NEIGHBOR', 'BUILT BY', 'LANTERN No. 12 OF 19'])
          expect(words, place.id).toContain(line);
      for (const eyebrow of ['A NEW NEIGHBOR', 'BUILT BY']) {
        expect(eyebrow).toMatch(EYEBROW);
        expect(written.map((w) => w.text)).toContain(eyebrow);
      }
      // The handle is drawn exactly as GitHub has it, never uppercased.
      expect(written.map((w) => w.text)).toContain(`@${place.creator}`);
    }
  });

  it('lights the lantern near the end, and names it only once it is lit', () => {
    const label = (elapsed: number, lantern?: string | null) =>
      draw(welcome, elapsed, data(SAMPLE_HOUSE.place, lantern)).written.find(
        (w) => w.text === 'LANTERN No. 12 OF 19',
      );
    expect(label(5)?.alpha ?? 0).toBe(0);
    expect(label(9.5)?.alpha).toBe(1);
    expect(label(9.5, null)).toBeUndefined();
    expect(BEATS.light[0]).toBeGreaterThan(0.6);
  });

  it('times its sounds to its pictures', () => {
    const second = (p: number) => Math.round(p * welcome.duration * 1000) / 1000;
    expect(WELCOME_CUES.land).toBe(second(BEATS.land[1]));
    expect(WELCOME_CUES.door).toBe(second(BEATS.door[0]));
    expect(WELCOME_CUES.walk).toEqual([second(BEATS.walk[0]), second(BEATS.walk[1])]);
    expect(WELCOME_CUES.light).toBe(second(BEATS.light[0]));
    const score = cinemaScore(welcome);
    const near = (kind: string, at: number) =>
      score.some((cue) => cue.kind === kind && Math.abs(cue.at - at) < 0.05);
    expect(near('thud', WELCOME_CUES.land)).toBe(true);
    expect(near('sparkle', WELCOME_CUES.light)).toBe(true);
    expect(score.filter((cue) => cue.kind === 'step').length).toBeGreaterThanOrEqual(3);
    const mix = renderCinemaPCM(welcome);
    expect(mix.left[0]).toBe(0);
    expect(mix.left.at(-1)).toBe(0);
  });
});
