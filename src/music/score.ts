import { isEventLive, type TownEvent } from '../lib/events';
import { BANDS, type Band } from '../lib/district-calendar';
import { BAND_COPY } from '../lib/district-copy';
import { BANDSTAND_TRACKS, composeBandstand } from './bandstand-tracks';
import type { Instrument } from './instruments';
import { composeTune, isTune, TOWN_TUNES, type TuneId } from './tunes';

/**
 * The town's own tunes (the day and night theme and the tunes of each hour, tunes/), the stage's
 * shows, and the Bandstand's three bands (bandstand-tracks.ts).
 */
export type TrackId = 'town' | 'night' | 'rock' | 'acoustic' | 'jazz' | 'party' | Band | TuneId;
export type Voice = 'bell' | 'keys' | 'pluck' | 'lead' | 'pad' | 'bass' | 'kick' | 'snare' | 'hat';
export type Note = {
  beat: number;
  length: number;
  pitch: number;
  /** One of render.ts's voices, or one of the instruments the newer tunes are written for. */
  voice: Voice | Instrument;
  gain: number;
  pan: number;
};
/** A tune's room: how much reverb (wet), how large (size, 0..1) and how dark (damp, 0..1). */
export type Hall = { wet: number; size: number; damp: number };
export type TrackInfo = {
  title: string;
  subtitle: string;
  bpm: number;
  /** Beats in the loop: BEATS (16 bars of four) unless the tune says otherwise. */
  beats?: number;
  /** Beats in a bar, four unless the tune says otherwise; a phrase is four bars. */
  bar?: number;
  /** A reverb under the mix; without one, the town's short reflections only. */
  hall?: Hall;
  /** The RMS level the render settles the mix at, so the tunes of the day sit at one volume. */
  loudness?: number;
  /** What plays it, for the listening room. */
  instruments?: string;
};
export const TRACKS: Record<TrackId, TrackInfo> = {
  // The day and night themes take turns with the tunes of the hour, so they settle at levels
  // beside them (tunes/index.ts).
  town: {
    title: 'Little Windows, Big Sky',
    subtitle: 'A pocket-sized daydream',
    bpm: 92,
    loudness: 0.052,
    instruments: 'Pixel bells, soft pad, plucks, bass, light drums',
  },
  night: {
    title: 'Porch Lights',
    subtitle: 'The town, tucked in',
    bpm: 70,
    loudness: 0.035,
    instruments: 'Pixel bells, soft pad, slow bass',
  },
  rock: {
    title: 'One More Block',
    subtitle: 'Small stage. Big Saturday.',
    bpm: 116,
    instruments: 'Lead synth, power chords, bass, drums',
  },
  acoustic: {
    title: 'Honey on the Steps',
    subtitle: 'Sun-warmed strings',
    bpm: 86,
    instruments: 'Fingerpicked plucks, bass, light drums',
  },
  jazz: {
    title: 'After-hours Lemonade',
    subtitle: 'A little swing under the stars',
    bpm: 96,
    instruments: 'Keys, walking bass, swung drums',
  },
  party: {
    title: 'One More Little Dance',
    subtitle: 'Midnight at the Little Stage',
    bpm: 112,
    instruments: 'Plucked lead, offbeat keys, octave bass, four-on-the-floor kick',
  },
  ...BANDSTAND_TRACKS,
  ...TOWN_TUNES,
};
export const BEATS = 64;
/** Beats in a track's loop. */
export const beatsOf = (track: TrackId) => TRACKS[track].beats ?? BEATS;
export const durationOf = (track: TrackId) => (beatsOf(track) * 60) / TRACKS[track].bpm;
/** Seconds in a phrase of four bars: where one of the town's tunes hands over to the next. */
export const phraseOf = (track: TrackId) => (4 * (TRACKS[track].bar ?? 4) * 60) / TRACKS[track].bpm;
/** Whether a track is one of the Bandstand's bands, heard only near it and scaled by its gain. */
export const isBandTrack = (track: TrackId): track is Band =>
  (BANDS as readonly string[]).includes(track);
/**
 * The town's own tunes through the day, in town minutes (one is a real second): each plays from
 * its `from` until the next one's. The midnight party (23:30–02:30) and the evening concert
 * (19:00–21:00) play over them, and a Bandstand set near the stand; see trackForTown.
 */
export const TOWN_ROTATION: readonly { from: number; track: TrackId }[] = [
  { from: 0, track: 'night' },
  { from: 150, track: 'smallhours' },
  { from: 255, track: 'beforedawn' },
  { from: 360, track: 'sunrise' },
  { from: 465, track: 'morning' },
  { from: 585, track: 'town' },
  { from: 670, track: 'midday' },
  { from: 795, track: 'afternoon' },
  { from: 900, track: 'teatime' },
  { from: 1020, track: 'goldenhour' },
  { from: 1260, track: 'lamplight' },
  { from: 1335, track: 'night' },
];
/** Whether a track is one of the town's own tunes, which take turns through the day. */
export const isTownTune = (track: TrackId) => TOWN_ROTATION.some((slot) => slot.track === track);
/** The town's own tune at a town minute (any day: wrapped to 0..1440). */
export function townTuneAt(minutes: number): TrackId {
  const minute = ((minutes % 1440) + 1440) % 1440;
  let track = TOWN_ROTATION[0].track;
  for (const slot of TOWN_ROTATION) if (minute >= slot.from) track = slot.track;
  return track;
}
/**
 * What the town plays: a live show on the stage first (the concert, the disco); then a live
 * Bandstand set, only while the Bandstand is heard (`bandstand.gain` ≥ 0.005, local like the
 * cinema); then the town's own tune for the hour (townTuneAt).
 */
export function trackForTown(
  minutes: number,
  events: TownEvent[],
  bandstand: { gain: number } = { gain: 0 },
): TrackId {
  const show = events.find((event) => event.venue.kind === 'stage' && isEventLive(event, minutes));
  if (show?.id === 'night-party') return 'party';
  if (show && (show.id === 'rock' || show.id === 'acoustic' || show.id === 'jazz')) return show.id;
  if (bandstand.gain >= 0.005) {
    const set = events.find(
      (event) =>
        (event.outing === 'bandstand-tea' || event.outing === 'bandstand-sundown') &&
        isEventLive(event, minutes),
    );
    // Both sets play the day's band, named in the set's own title.
    const band = set && BANDS.find((band) => BAND_COPY[band].name === set.name);
    if (band) return band;
  }
  return townTuneAt(minutes);
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
// Root and close upper voicings: Cmaj9, G6, Am9, Fmaj9, Dm9, G9.
const harmony = [
  [36, 60, 64, 67, 71],
  [43, 59, 62, 67, 69],
  [33, 60, 64, 67, 71],
  [41, 60, 64, 67, 69],
  [36, 60, 64, 67, 71],
  [40, 59, 62, 64, 67],
  [38, 60, 65, 69, 72],
  [43, 59, 62, 65, 69],
  [41, 60, 64, 67, 69],
  [33, 60, 64, 67, 71],
  [38, 60, 65, 69, 72],
  [43, 59, 62, 65, 69],
  [36, 60, 64, 67, 71],
  [33, 60, 64, 67, 71],
  [43, 59, 62, 65, 69],
  [36, 60, 64, 67, 74],
];

export function compose(track: TrackId): Note[] {
  // A band plays its own arrangement; until it has one, today's acoustic notes.
  if (isBandTrack(track)) return composeBandstand(track) ?? compose('acoustic');
  if (isTune(track)) return composeTune(track);
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
