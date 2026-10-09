// A small kit for writing the town's tunes (one file each in this folder). A tune is a list of
// Notes in beats from the loop's start, like the older scores in score.ts; this kit only makes
// the writing shorter: note names, chord spellings, phrases, strums, arpeggios and drum steps,
// with a light, repeatable human touch. No Math.random or Date: the same tune every time.
import type { Note, TrackInfo } from '../score';

export type { Note };
/** A tune's title line, tempo and room, as score.ts's TRACKS lists it. */
export type TuneInfo = TrackInfo & { beats: number };
type Voice = Note['voice'];

const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** MIDI pitch of a note name: 'C4' is 60 (middle C), 'F#3' 54, 'Bb5' 82. */
export function midi(name: string): number {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!match) throw new Error(`Not a note name: ${name}`);
  const [, letter, accidental, octave] = match;
  return (
    12 * (Number(octave) + 1) +
    LETTERS[letter] +
    (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0)
  );
}

// Intervals above the root for each chord quality.
const QUALITIES: Record<string, readonly number[]> = {
  '': [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  '7sus4': [0, 5, 7, 10],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  '9': [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  '69': [0, 4, 7, 9, 14],
  '11': [0, 7, 10, 14, 17],
  m11: [0, 3, 7, 10, 14, 17],
  '13': [0, 4, 10, 14, 21],
  maj13: [0, 4, 11, 14, 21],
};
/**
 * A chord's pitches from its symbol, root in the given octave: chord('Cmaj7', 3) is C3 E3 G3 B3,
 * chord('F#m7', 3) F#3 A3 C#4 E4. Slash chords put the bass under: chord('C/G', 3) is G2 C3 E3 G3.
 */
export function chord(symbol: string, octave = 3): number[] {
  const [name, slash] = symbol.split('/');
  const match = /^([A-G])(#|b)?(.*)$/.exec(name);
  if (!match || !(match[3] in QUALITIES)) throw new Error(`Not a chord: ${symbol}`);
  const root = midi(`${match[1]}${match[2] ?? ''}${octave}`);
  const pitches = QUALITIES[match[3]].map((interval) => root + interval);
  if (!slash) return pitches;
  let bass = midi(`${slash}${octave}`);
  while (bass >= root) bass -= 12;
  return [bass, ...pitches];
}

/** [beat offset, pitch, length in beats]: one note of a phrase. */
export type Step = readonly [offset: number, pitch: number, length: number];

/** A repeatable 0..1 from a few numbers (no Math.random). */
function hash(...values: number[]) {
  let h = 2166136261;
  for (const value of values) {
    h ^= Math.round(value * 1000);
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** A score being written. Every `at` is in beats from the loop's start. */
export class Score {
  private notes: Note[] = [];
  /**
   * @param beats The loop's length in beats; notes past it wrap to its start.
   * @param feel How human the playing is: timing drift in beats and loudness drift (share).
   */
  constructor(
    readonly beats: number,
    private feel = { timing: 0.012, loudness: 0.07 },
  ) {}
  /** One note. */
  note(at: number, pitch: number, length: number, voice: Voice, gain: number, pan = 0) {
    const n = this.notes.length;
    const drift = (hash(at, pitch, n, 1) - 0.5) * 2 * this.feel.timing;
    const level = 1 + (hash(at, pitch, n, 2) - 0.5) * 2 * this.feel.loudness;
    this.notes.push({
      beat: at + (at > 0 ? drift : Math.abs(drift)),
      length,
      pitch,
      voice,
      gain: gain * level,
      pan,
    });
    return this;
  }
  /** A melody or bass line: each step is [offset from `at`, pitch, length]. */
  line(at: number, steps: readonly Step[], voice: Voice, gain: number, pan = 0) {
    for (const [offset, pitch, length] of steps)
      this.note(at + offset, pitch, length, voice, gain, pan);
    return this;
  }
  /**
   * A chord held for `length` beats: its notes `strum` beats apart from the lowest up, and
   * spread `spread` either side of `pan`, low to high.
   */
  chord(
    at: number,
    pitches: readonly number[],
    length: number,
    voice: Voice,
    gain: number,
    { strum = 0, spread = 0, pan = 0 }: { strum?: number; spread?: number; pan?: number } = {},
  ) {
    const sorted = [...pitches].sort((a, b) => a - b);
    sorted.forEach((pitch, i) => {
      const side = sorted.length > 1 ? (i / (sorted.length - 1)) * 2 - 1 : 0;
      this.note(at + i * strum, pitch, length - i * strum, voice, gain, pan + side * spread);
    });
    return this;
  }
  /**
   * An arpeggio: `pattern` picks from `pitches` (by index, low to high) one every `step` beats,
   * for `count` steps, each ringing `length` beats.
   */
  arp(
    at: number,
    pitches: readonly number[],
    pattern: readonly number[],
    step: number,
    count: number,
    length: number,
    voice: Voice,
    gain: number,
    pan = 0,
  ) {
    const sorted = [...pitches].sort((a, b) => a - b);
    for (let i = 0; i < count; i++) {
      const pick = pattern[i % pattern.length];
      if (pick < 0) continue;
      this.note(at + i * step, sorted[pick % sorted.length], length, voice, gain, pan);
    }
    return this;
  }
  /**
   * A rhythm over steps of `step` beats (a sixteenth by default): 'x' a full hit, 'o' a soft one
   * (half), '-' a ghost (a quarter), any other character a rest. `swing` delays every second
   * step by that share of a step.
   */
  hits(
    at: number,
    pattern: string,
    voice: Voice,
    gain: number,
    {
      step = 0.25,
      pitch = 60,
      pan = 0,
      swing = 0,
      length = step,
    }: { step?: number; pitch?: number; pan?: number; swing?: number; length?: number } = {},
  ) {
    [...pattern].forEach((symbol, i) => {
      const weight = symbol === 'x' ? 1 : symbol === 'o' ? 0.5 : symbol === '-' ? 0.25 : 0;
      if (!weight) return;
      this.note(
        at + i * step + (i % 2 ? swing * step : 0),
        pitch,
        length,
        voice,
        gain * weight,
        pan,
      );
    });
    return this;
  }
  /**
   * The finished score: every note inside the loop, in time order, and `transpose` semitones up
   * or down (drums and ambience keep their own tuning).
   */
  done({ transpose = 0 }: { transpose?: number } = {}): Note[] {
    return this.notes
      .map((note) => ({
        ...note,
        beat: ((note.beat % this.beats) + this.beats) % this.beats,
        pitch: UNPITCHED.has(note.voice) ? note.pitch : note.pitch + transpose,
      }))
      .sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
  }
}

/** Voices whose pitch only nudges their tuning, left where they are by a transposition. */
const UNPITCHED: ReadonlySet<Voice> = new Set<Voice>([
  'kick',
  'snare',
  'hat',
  'softkick',
  'brush',
  'swish',
  'rim',
  'shaker',
  'ride',
  'tick',
  'vinyl',
  'crickets',
  'birds',
]);
