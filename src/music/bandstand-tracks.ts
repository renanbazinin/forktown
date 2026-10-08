// The Bandstand's music (agent C, SPEC §4.2): one arrangement for each band, played only while the
// Bandstand is on screen and the camera is close (bandstandListening), scaled by its gain. score.ts
// adds the three ids to TrackId and reads both exports below; the music render worker reaches this
// file through score.ts, so it imports nothing but types.
// Each is an original 16-bar tune in the town's own form (a question, an answer, a contrasting
// bridge and a return) on the town's own synth voices: brass oom-pah, a folk reel and a slow air.
// No Math.random, Date.now or performance.now.
import type { Band } from '../lib/district-calendar';
import type { Note, Voice } from './score';

/** The Soundtrack's title line and tempo for each band's tune. The players on the stand keep
 *  the same tempo (city/district/bandstand.ts BAND_BPM). */
export const BANDSTAND_TRACKS: Record<Band, { title: string; subtitle: string; bpm: number }> = {
  brass: { title: 'Oom-pah on the Lawn', subtitle: 'Two cornets, a tuba and a drum', bpm: 96 },
  folk: { title: 'The Riverbank Reel', subtitle: 'Fiddle, squeezebox and guitar', bpm: 104 },
  strings: { title: 'Deckchairs at Dusk', subtitle: 'Violin, viola and cello', bpm: 84 },
};

/** [offset in the bar, MIDI note, length in beats]. Rests are intentional. */
type Phrase = readonly (readonly [number, number, number])[];
/** A bar's chord: its bass root, and three tones in the middle of the keyboard. */
type Chord = readonly [root: number, tones: readonly [number, number, number]];

// ---- Brass in B-flat: the cornet's tune, a second cornet under it, tuba oom and the drum.
const Bb: Chord = [34, [58, 62, 65]],
  Eb: Chord = [39, [58, 63, 67]],
  F: Chord = [41, [57, 60, 65]],
  Gm: Chord = [43, [58, 62, 67]],
  Cm: Chord = [36, [55, 60, 63]];
const BRASS_CHORDS: readonly Chord[] = [
  Bb,
  Bb,
  Eb,
  Bb,
  Bb,
  F,
  F,
  Bb,
  Eb,
  Eb,
  Bb,
  Gm,
  Cm,
  F,
  Bb,
  Bb,
];
const BRASS_TUNE: Phrase[] = [
  [
    [0, 70, 1],
    [1, 74, 0.75],
    [1.75, 72, 0.25],
    [2, 70, 1],
    [3, 65, 1],
  ],
  [
    [0, 74, 1.5],
    [1.5, 72, 0.5],
    [2, 70, 2],
  ],
  [
    [0, 67, 1],
    [1, 70, 0.75],
    [1.75, 75, 0.25],
    [2, 74, 1],
    [3, 72, 1],
  ],
  [[0, 70, 3]],
  [
    [0, 70, 1],
    [1, 74, 0.75],
    [1.75, 77, 0.25],
    [2, 77, 1],
    [3, 74, 1],
  ],
  [
    [0, 72, 1.5],
    [1.5, 69, 0.5],
    [2, 65, 2],
  ],
  [
    [0, 69, 1],
    [1, 72, 1],
    [2, 77, 1],
    [3, 76, 1],
  ],
  [[0, 74, 3]],
  [
    [0.5, 67, 0.5],
    [1, 70, 0.5],
    [1.5, 75, 1.5],
    [3, 74, 1],
  ],
  [
    [0, 72, 1],
    [1, 70, 1],
    [2, 67, 2],
  ],
  [
    [0.5, 65, 0.5],
    [1, 70, 0.5],
    [1.5, 74, 1.5],
    [3, 72, 1],
  ],
  [
    [0, 70, 1],
    [1, 67, 1],
    [2, 62, 2],
  ],
  [
    [0, 63, 1],
    [1, 67, 0.75],
    [1.75, 72, 0.25],
    [2, 75, 1],
    [3, 74, 1],
  ],
  [
    [0, 72, 1],
    [1, 69, 1],
    [2, 72, 1],
    [3, 76, 1],
  ],
  [
    [0, 77, 1],
    [1, 74, 0.75],
    [1.75, 72, 0.25],
    [2, 70, 1],
    [3, 72, 1],
  ],
  [[0, 70, 2.5]],
];

// ---- Folk in D: the fiddle's reel, squeezebox chords, a strummed guitar and a tapping foot.
const D: Chord = [38, [62, 66, 69]],
  G: Chord = [43, [62, 67, 71]],
  A: Chord = [45, [61, 64, 69]],
  Bm: Chord = [47, [62, 66, 71]];
const FOLK_CHORDS: readonly Chord[] = [D, D, G, A, D, D, G, A, Bm, Bm, G, A, D, G, A, D];
const FOLK_TUNE: Phrase[] = [
  [
    [0, 74, 0.5],
    [0.5, 76, 0.5],
    [1, 78, 0.5],
    [1.5, 76, 0.5],
    [2, 74, 0.5],
    [2.5, 69, 0.5],
    [3, 66, 1],
  ],
  [
    [0, 69, 0.5],
    [0.5, 71, 0.5],
    [1, 74, 1],
    [2, 71, 0.5],
    [2.5, 69, 0.5],
    [3, 66, 1],
  ],
  [
    [0, 67, 0.5],
    [0.5, 71, 0.5],
    [1, 74, 0.5],
    [1.5, 79, 0.5],
    [2, 78, 1],
    [3, 76, 1],
  ],
  [
    [0, 76, 0.5],
    [0.5, 74, 0.5],
    [1, 73, 1],
    [2, 69, 1.5],
  ],
  [
    [0, 74, 0.5],
    [0.5, 76, 0.5],
    [1, 78, 0.5],
    [1.5, 79, 0.5],
    [2, 81, 1],
    [3, 78, 1],
  ],
  [
    [0, 81, 0.5],
    [0.5, 78, 0.5],
    [1, 74, 1],
    [2, 76, 0.5],
    [2.5, 74, 0.5],
    [3, 71, 1],
  ],
  [
    [0, 71, 0.5],
    [0.5, 74, 0.5],
    [1, 79, 1],
    [2, 78, 0.5],
    [2.5, 76, 0.5],
    [3, 74, 1],
  ],
  [
    [0, 73, 1],
    [1, 76, 1],
    [2, 74, 2],
  ],
  [
    [0.5, 71, 0.5],
    [1, 74, 0.5],
    [1.5, 78, 1.5],
    [3, 76, 1],
  ],
  [
    [0, 74, 1],
    [1, 73, 0.5],
    [1.5, 71, 0.5],
    [2, 66, 2],
  ],
  [
    [0.5, 67, 0.5],
    [1, 71, 0.5],
    [1.5, 74, 1.5],
    [3, 79, 1],
  ],
  [
    [0, 76, 1],
    [1, 73, 1],
    [2, 69, 2],
  ],
  [
    [0, 74, 0.5],
    [0.5, 76, 0.5],
    [1, 78, 0.5],
    [1.5, 76, 0.5],
    [2, 74, 0.5],
    [2.5, 69, 0.5],
    [3, 66, 1],
  ],
  [
    [0, 67, 0.5],
    [0.5, 71, 0.5],
    [1, 74, 0.5],
    [1.5, 79, 0.5],
    [2, 78, 1],
    [3, 76, 1],
  ],
  [
    [0, 76, 0.5],
    [0.5, 78, 0.5],
    [1, 76, 0.5],
    [1.5, 73, 0.5],
    [2, 69, 1],
    [3, 73, 1],
  ],
  [[0, 74, 2.5]],
];

// ---- Strings in G: the violin's slow air over the viola's held chords and the cello's roots;
// the bridge goes pizzicato.
const Gs: Chord = [43, [59, 62, 67]],
  Em: Chord = [40, [59, 64, 67]],
  C: Chord = [36, [60, 64, 67]],
  Ds: Chord = [38, [57, 62, 66]],
  Am: Chord = [45, [57, 60, 64]];
const STRING_CHORDS: readonly Chord[] = [
  Gs,
  Em,
  C,
  Ds,
  Gs,
  Em,
  Am,
  Ds,
  C,
  Gs,
  Am,
  Em,
  C,
  Ds,
  Gs,
  Gs,
];
const STRING_TUNE: Phrase[] = [
  [
    [0, 74, 1.5],
    [1.5, 76, 0.5],
    [2, 74, 1],
    [3, 71, 1],
  ],
  [
    [0, 71, 2],
    [2, 67, 1],
    [3, 69, 1],
  ],
  [
    [0, 72, 1.5],
    [1.5, 74, 0.5],
    [2, 76, 2],
  ],
  [[0, 74, 3]],
  [
    [0, 74, 1.5],
    [1.5, 76, 0.5],
    [2, 79, 1],
    [3, 78, 1],
  ],
  [
    [0, 76, 2],
    [2, 71, 2],
  ],
  [
    [0, 72, 1],
    [1, 76, 1],
    [2, 74, 1],
    [3, 72, 1],
  ],
  [[0, 69, 3]],
  [
    [0.5, 64, 0.5],
    [1, 67, 1],
    [2, 72, 2],
  ],
  [
    [0, 71, 1],
    [1, 74, 1],
    [2, 79, 2],
  ],
  [
    [0, 76, 1.5],
    [1.5, 74, 0.5],
    [2, 72, 2],
  ],
  [[0, 71, 3]],
  [
    [0, 72, 1.5],
    [1.5, 74, 0.5],
    [2, 76, 1],
    [3, 79, 1],
  ],
  [
    [0, 78, 1],
    [1, 76, 1],
    [2, 74, 1],
    [3, 72, 1],
  ],
  [
    [0, 71, 2],
    [2, 74, 1],
    [3, 69, 1],
  ],
  [[0, 67, 3]],
];

/** The nearest tone of the chord a third or so under a melody note, for a second voice. */
function under(pitch: number, tones: readonly number[]) {
  let best = pitch - 4;
  for (const tone of tones)
    for (let octave = -24; octave <= 24; octave += 12) {
      const candidate = tone + octave;
      if (pitch - candidate >= 3 && pitch - candidate <= 5) best = candidate;
    }
  return best;
}

function compose(band: Band): Note[] {
  const notes: Note[] = [];
  const add = (beat: number, pitch: number, length: number, voice: Voice, gain: number, pan = 0) =>
    notes.push({ beat, pitch, length, voice, gain, pan });
  for (let bar = 0; bar < 16; bar++) {
    const base = bar * 4;
    const bridge = bar >= 8 && bar < 12;
    const cadence = bar % 4 === 3;
    if (band === 'brass') {
      const [root, tones] = BRASS_CHORDS[bar];
      // The first cornet, and the second a third under it on the longer notes.
      for (const [offset, pitch, length] of BRASS_TUNE[bar]) {
        add(base + offset, pitch, length, 'lead', 0.15, -0.15);
        if (length >= 1) add(base + offset + 0.01, under(pitch, tones), length, 'lead', 0.07, 0.2);
      }
      // Oom on the beat from the tuba, pah off it from the horns.
      add(base, root, 0.8, 'bass', 0.17, 0.05);
      add(base + 2, root + 7, 0.8, 'bass', 0.14, 0.05);
      for (const offset of [1, 3])
        tones.forEach((pitch, i) => add(base + offset + i * 0.01, pitch, 0.35, 'lead', 0.03, 0.35));
      // The bass drum on one and three, a light snare, and a roll into each phrase.
      for (const offset of [0, 2]) add(base + offset, 36, 0.22, 'kick', 0.13);
      for (const offset of [1, 3]) add(base + offset, 38, 0.15, 'snare', 0.04);
      if (cadence)
        [3.25, 3.5, 3.75].forEach((offset, i) =>
          add(base + offset, 38, 0.12, 'snare', 0.04 + i * 0.012),
        );
    } else if (band === 'folk') {
      const [root, tones] = FOLK_CHORDS[bar];
      for (const [offset, pitch, length] of FOLK_TUNE[bar])
        add(base + offset, pitch, length * 0.9, 'lead', 0.13, -0.2);
      // The squeezebox: its bass on one and three, a chord on two and four.
      add(base, root, 0.7, 'bass', 0.14, 0.25);
      add(base + 2, root + 7, 0.7, 'bass', 0.11, 0.25);
      for (const offset of [1, 3])
        tones.forEach((pitch, i) =>
          add(base + offset + i * 0.008, pitch, 0.5, 'keys', 0.032, 0.25),
        );
      // The guitar strums, rolled from the lowest string.
      for (const offset of bridge ? [0, 2] : [0, 1.5, 2, 3])
        tones.forEach((pitch, i) =>
          add(base + offset + i * 0.02, pitch - 12, 0.6, 'pluck', 0.034, -0.35),
        );
      // A foot tapping on the boards.
      for (const offset of [0, 1, 2, 3])
        add(base + offset, 36, 0.18, 'kick', offset % 2 ? 0.05 : 0.08);
    } else {
      const [root, tones] = STRING_CHORDS[bar];
      for (const [offset, pitch, length] of STRING_TUNE[bar])
        add(base + offset, pitch, length, 'lead', 0.13, -0.25);
      if (bridge) {
        // Pizzicato: the viola and the cello pluck the chord on the beat.
        add(base, root, 0.5, 'pluck', 0.09, 0.3);
        add(base + 2, root + 7, 0.5, 'pluck', 0.08, 0.3);
        for (const offset of [1, 3])
          tones.forEach((pitch, i) =>
            add(base + offset + i * 0.015, pitch, 0.4, 'pluck', 0.04, 0.1),
          );
      } else {
        // The cello holds the root; the viola holds the chord and moves on the half bar.
        add(base, root, 3.7, 'bass', 0.12, 0.3);
        tones.forEach((pitch, i) => add(base + i * 0.02, pitch, 1.9, 'pad', 0.03, (i - 1) * 0.2));
        tones.forEach((pitch, i) =>
          add(base + 2 + i * 0.02, i === 2 ? pitch + 2 : pitch, 1.8, 'pad', 0.026, (i - 1) * 0.2),
        );
      }
      // A soft bell where each phrase turns, the river answering.
      if (cadence) add(base + 3, tones[2] + 12, 1, 'bell', 0.04, 0.5);
    }
  }
  return notes.sort((a, b) => a.beat - b.beat);
}

/** A band's 16-bar arrangement (BEATS beats, like every track). */
export function composeBandstand(band: Band): Note[] | undefined {
  return compose(band);
}
