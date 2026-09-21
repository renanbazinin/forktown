import { isEventLive, type TownEvent } from '../lib/events';

export type TrackId = 'town' | 'night' | 'rock' | 'acoustic' | 'jazz' | 'party';
export type Voice = 'bell' | 'keys' | 'pluck' | 'lead' | 'pad' | 'bass' | 'kick' | 'snare' | 'hat';
export type Note = {
  beat: number;
  length: number;
  pitch: number;
  voice: Voice;
  gain: number;
  pan: number;
};
export const TRACKS: Record<TrackId, { title: string; subtitle: string; bpm: number }> = {
  town: { title: 'Little Windows, Big Sky', subtitle: 'A pocket-sized daydream', bpm: 92 },
  night: { title: 'Porch Lights', subtitle: 'The town, tucked in', bpm: 70 },
  rock: { title: 'One More Block', subtitle: 'Small stage. Big Saturday.', bpm: 116 },
  acoustic: { title: 'Honey on the Steps', subtitle: 'Sun-warmed strings', bpm: 86 },
  jazz: { title: 'After-hours Lemonade', subtitle: 'A little swing under the stars', bpm: 96 },
  party: { title: 'One More Little Dance', subtitle: 'Midnight at the Little Stage', bpm: 112 },
};
export const BEATS = 64;
export const durationOf = (track: TrackId) => (BEATS * 60) / TRACKS[track].bpm;
export function trackForTown(minutes: number, events: TownEvent[]): TrackId {
  const show = events.find((event) => event.venue.kind === 'stage' && isEventLive(event, minutes));
  if (show?.id === 'night-party') return 'party';
  if (show && (show.id === 'rock' || show.id === 'acoustic' || show.id === 'jazz')) return show.id;
  return minutes < 360 || minutes >= 1200 ? 'night' : 'town';
}

// Original 16-bar arrangements, in MIDI pitches. Each phrase has a question,
// an answer, a contrasting bridge, and a return; rests are intentional.
// [offset in bar, MIDI note, duration in beats]. No recordings or samples.
type Phrase = readonly (readonly [number, number, number])[];
const daylight: Phrase[] = [
  [
    [0.5, 76, 0.5],
    [1.25, 79, 0.5],
    [2, 81, 0.75],
    [3, 79, 0.5],
  ],
  [
    [0, 74, 0.75],
    [1, 72, 0.5],
    [2, 71, 1.25],
  ],
  [
    [0.5, 69, 0.5],
    [1.25, 72, 0.5],
    [2, 76, 1],
    [3.5, 74, 0.35],
  ],
  [
    [0, 72, 0.75],
    [1.5, 69, 0.5],
    [2.5, 67, 0.8],
  ],
  [
    [0.5, 76, 0.5],
    [1.25, 79, 0.5],
    [2, 83, 0.75],
    [3, 81, 0.5],
  ],
  [
    [0, 79, 0.8],
    [1.25, 74, 0.5],
    [2, 76, 1.3],
  ],
  [
    [0, 74, 0.5],
    [0.75, 72, 0.5],
    [1.5, 69, 0.75],
    [2.75, 71, 0.5],
  ],
  [
    [0, 74, 1],
    [2, 71, 0.5],
    [3, 67, 0.7],
  ],
  [
    [0, 77, 0.8],
    [1.25, 81, 0.5],
    [2, 84, 1],
    [3.5, 83, 0.35],
  ],
  [
    [0, 81, 0.8],
    [1.5, 79, 0.75],
    [3, 76, 0.6],
  ],
  [
    [0.5, 74, 0.5],
    [1.25, 77, 0.5],
    [2, 81, 0.75],
    [3, 79, 0.6],
  ],
  [
    [0, 74, 0.75],
    [1.25, 71, 0.5],
    [2.5, 74, 0.9],
  ],
  [
    [0.5, 76, 0.5],
    [1.25, 79, 0.5],
    [2, 81, 0.75],
    [3, 79, 0.5],
  ],
  [
    [0, 76, 0.75],
    [1, 74, 0.5],
    [2, 72, 1.25],
  ],
  [
    [0, 69, 0.75],
    [1, 72, 0.5],
    [2, 74, 0.5],
    [3, 71, 0.5],
  ],
  [[0, 72, 2.4]],
];
const rockMelody: Phrase[] = [
  [
    [0, 76, 0.6],
    [1, 76, 0.3],
    [1.5, 79, 0.4],
    [2.5, 81, 0.5],
    [3.5, 79, 0.35],
  ],
  [
    [0, 74, 1.2],
    [2, 71, 0.5],
    [3, 74, 0.5],
  ],
  [
    [0, 72, 0.5],
    [0.75, 76, 0.5],
    [1.5, 79, 1],
    [3, 76, 0.5],
  ],
  [
    [0, 69, 1.2],
    [2, 72, 0.5],
    [3, 74, 0.5],
  ],
  [
    [0, 76, 0.6],
    [1, 76, 0.3],
    [1.5, 79, 0.4],
    [2.5, 83, 0.5],
    [3.5, 81, 0.35],
  ],
  [
    [0, 79, 1.1],
    [1.5, 74, 0.4],
    [2.5, 76, 0.9],
  ],
  [
    [0, 77, 0.65],
    [1, 76, 0.4],
    [2, 74, 0.7],
    [3, 72, 0.4],
  ],
  [
    [0, 71, 1],
    [1.5, 74, 0.5],
    [2.5, 79, 1],
  ],
  [
    [0, 81, 1.2],
    [2, 84, 0.6],
    [3, 83, 0.5],
  ],
  [
    [0, 79, 0.7],
    [1, 76, 0.5],
    [2, 79, 1.4],
  ],
  [
    [0, 77, 0.7],
    [1, 81, 0.5],
    [2, 79, 0.7],
    [3, 77, 0.5],
  ],
  [
    [0, 74, 0.6],
    [1, 71, 0.6],
    [2, 74, 0.5],
    [3, 79, 0.5],
  ],
  [
    [0, 76, 0.6],
    [1, 76, 0.3],
    [1.5, 79, 0.4],
    [2.5, 81, 0.5],
    [3.5, 79, 0.35],
  ],
  [
    [0, 74, 0.7],
    [1, 76, 0.5],
    [2, 79, 1],
  ],
  [
    [0, 77, 0.7],
    [1, 76, 0.4],
    [2, 74, 0.6],
    [3, 71, 0.5],
  ],
  [
    [0, 72, 2.5],
    [3.5, 74, 0.3],
  ],
];
const jazzMelody: Phrase[] = [
  [
    [0.66, 76, 0.45],
    [1.66, 79, 0.35],
    [2, 83, 0.7],
    [3.66, 81, 0.25],
  ],
  [
    [0, 79, 0.8],
    [1.66, 76, 0.4],
    [2.66, 74, 0.8],
  ],
  [
    [0.66, 77, 0.4],
    [1, 81, 0.8],
    [2.66, 84, 0.4],
    [3.33, 83, 0.5],
  ],
  [
    [0, 81, 0.7],
    [1.66, 77, 0.4],
    [2.66, 74, 0.8],
  ],
  [
    [0.66, 76, 0.4],
    [1, 79, 0.7],
    [2.66, 83, 0.5],
    [3.33, 86, 0.4],
  ],
  [
    [0, 84, 1],
    [1.66, 81, 0.4],
    [2.66, 79, 0.8],
  ],
  [
    [0.66, 77, 0.4],
    [1.66, 76, 0.4],
    [2, 74, 0.6],
    [3, 72, 0.4],
  ],
  [
    [0, 71, 0.8],
    [1.66, 74, 0.4],
    [2.66, 77, 0.75],
  ],
  [
    [0, 81, 0.7],
    [1.66, 84, 0.4],
    [2.66, 88, 0.8],
  ],
  [
    [0.66, 86, 0.4],
    [1.66, 84, 0.4],
    [2, 81, 1.3],
  ],
  [
    [0.66, 77, 0.4],
    [1, 79, 0.8],
    [2.66, 81, 0.7],
  ],
  [
    [0, 80, 0.5],
    [0.66, 79, 0.5],
    [1.66, 77, 0.4],
    [2.66, 74, 0.8],
  ],
  [
    [0.66, 76, 0.45],
    [1.66, 79, 0.35],
    [2, 83, 0.7],
    [3.66, 81, 0.25],
  ],
  [
    [0, 79, 0.8],
    [1.66, 76, 0.4],
    [2.66, 74, 0.8],
  ],
  [
    [0, 77, 0.7],
    [1.66, 74, 0.5],
    [2.66, 71, 0.8],
  ],
  [
    [0, 72, 2.2],
    [3.66, 74, 0.25],
  ],
];
// Root and close upper voicings: Cmaj9, G6, Am9, Fmaj9, Dm9, G13.
const harmony = [
  [36, 60, 64, 67, 71],
  [43, 59, 62, 67, 69],
  [33, 60, 64, 67, 71],
  [41, 60, 64, 67, 69],
  [36, 60, 64, 67, 71],
  [40, 59, 62, 64, 67],
  [38, 60, 65, 69, 72],
  [43, 59, 64, 65, 69],
  [41, 60, 64, 67, 69],
  [33, 60, 64, 67, 71],
  [38, 60, 65, 69, 72],
  [43, 59, 64, 65, 69],
  [36, 60, 64, 67, 71],
  [33, 60, 64, 67, 71],
  [43, 59, 62, 65, 69],
  [36, 60, 64, 67, 74],
];

export function compose(track: TrackId): Note[] {
  const notes: Note[] = [];
  const add = (
    beat: number,
    pitch: number,
    length: number,
    voice: Voice,
    gain: number,
    pan = 0,
  ) => {
    notes.push({ beat, pitch, length, voice, gain, pan });
  };
  const quiet = track === 'night';
  const rock = track === 'rock';
  const jazz = track === 'jazz';
  const acoustic = track === 'acoustic';
  const party = track === 'party';
  for (let bar = 0; bar < 16; bar++) {
    const base = bar * 4;
    const [root, ...chord] = harmony[bar];
    const bridge = bar >= 8 && bar < 12;
    const phrase = (rock ? rockMelody : jazz ? jazzMelody : daylight)[bar];
    phrase.forEach(([offset, pitch, length], index) => {
      if (quiet && index % 2) return;
      add(
        base + offset,
        pitch - (quiet || acoustic ? 12 : 0),
        quiet ? length * 1.6 : length,
        rock ? 'lead' : jazz ? 'keys' : acoustic || party ? 'pluck' : 'bell',
        quiet ? 0.11 : rock ? 0.16 : 0.14,
        -0.12,
      );
    });
    // Warm chord bed; acoustic rolls its voicing like a fingerpicked instrument.
    if (party) {
      // Offbeat keys and a soft four-on-the-floor beat for the midnight dancers.
      [0.5, 1.5, 2.5, 3.5].forEach((offset) =>
        chord.forEach((pitch, index) =>
          add(base + offset, pitch, 0.3, 'keys', 0.036, (index - 1.5) * 0.2),
        ),
      );
    } else if (acoustic) {
      [0, 2, 1, 3, 0, 2, 1, 3].forEach((degree, step) =>
        add(
          base + step * 0.5 + degree * 0.012,
          chord[degree],
          0.85,
          'pluck',
          step % 2 ? 0.047 : 0.065,
          0.32,
        ),
      );
    } else if (jazz) {
      [0, 1.66, 3.33].forEach((offset, hit) =>
        chord.forEach((pitch, index) =>
          add(base + offset + index * 0.008, pitch, hit === 0 ? 0.9 : 0.45, 'keys', 0.031, 0.32),
        ),
      );
    } else if (rock) {
      [0, 0.75, 1.5, 2, 2.75, 3.5].forEach((offset) =>
        [root + 12, root + 19].forEach((pitch) =>
          add(base + offset, pitch, 0.36, 'lead', 0.038, 0.38),
        ),
      );
    } else {
      chord.forEach((pitch, index) =>
        add(base + index * 0.025, pitch, 3.8, 'pad', quiet ? 0.021 : 0.027, (index - 1.5) * 0.27),
      );
      if (!quiet)
        [0, 1.5, 2.5, 3.5].forEach((offset, index) =>
          add(base + offset, chord[index], 0.7, 'pluck', 0.05, 0.42),
        );
    }
    // Bass anticipations give the tunes a little bounce; jazz walks to the next root.
    if (party) {
      [0, 1.5, 2, 3.5].forEach((offset, index) =>
        add(base + offset, root + (index % 2 ? 12 : 0), 0.4, 'bass', 0.13),
      );
    } else if (jazz) {
      [root, root + 7, root + 12, harmony[(bar + 1) % 16][0] + (bar % 2 ? 1 : -1)].forEach(
        (pitch, i) => add(base + i, pitch, 0.8, 'bass', 0.13),
      );
    } else {
      add(base, root, quiet ? 3.6 : 1.3, 'bass', quiet ? 0.1 : 0.16);
      if (!quiet) {
        add(base + 2, root + (rock ? 0 : 7), 1.1, 'bass', 0.13);
        if (bar % 2) add(base + 3.5, harmony[(bar + 1) % 16][0], 0.35, 'bass', 0.095);
      }
    }
    if (!quiet) {
      const gentle = acoustic ? 0.5 : jazz ? 0.55 : rock ? 1 : party ? 0.75 : 0.6;
      (party ? [0, 1, 2, 3] : [0, 2, ...(rock && bar % 2 ? [2.75] : [])]).forEach((offset) =>
        add(base + offset, 36, 0.22, 'kick', 0.23 * gentle),
      );
      [1, 3].forEach((offset) => add(base + offset, 38, 0.15, 'snare', 0.095 * gentle));
      for (let i = 0; i < 8; i++) {
        const offset = Math.floor(i / 2) + (i % 2 ? (jazz ? 0.66 : 0.5) : 0);
        add(
          base + offset,
          42,
          i === 7 && rock ? 0.22 : 0.065,
          'hat',
          (i % 2 ? 0.021 : 0.035) * gentle,
          -0.4,
        );
      }
      if (rock && bar % 4 === 3)
        [3.25, 3.5, 3.75].forEach((offset, i) =>
          add(base + offset, 38, 0.12, 'snare', 0.05 + i * 0.014),
        );
    }
    // Sparse answering glints in the bridge and cadences, instead of constant arpeggios.
    if (bridge || bar % 4 === 3) {
      add(base + 2.5, chord[2] + 12, 1, 'bell', quiet ? 0.035 : 0.045, 0.55);
      if (!quiet) add(base + 3.25, chord[1] + 12, 0.6, 'bell', 0.035, 0.48);
    }
  }
  return notes.sort((a, b) => a.beat - b.beat);
}
