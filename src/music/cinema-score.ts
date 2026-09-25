import type { CinemaFilm, ClassicArtwork, ReelArtwork } from '../lib/cinema';
import { REEL_SCORES } from '../films/scores';
import type { Voice } from './score';

export type FilmEffect =
  | 'pop'
  | 'bounce'
  | 'rustle'
  | 'chime'
  | 'meow'
  | 'quack'
  | 'flutter'
  | 'water'
  | 'engine'
  | 'beep'
  | 'sweep'
  | 'crowd'
  | 'step'
  | 'swish'
  | 'clash'
  | 'wind'
  | 'hum'
  | 'beam'
  | 'gasp'
  | 'warp'
  | 'rain'
  | 'drip'
  | 'bubble'
  | 'whale'
  | 'chug'
  | 'whistle'
  | 'thunder'
  | 'wave'
  | 'crunch'
  | 'boing'
  | 'creak'
  | 'rumble'
  | 'whir'
  | 'splash'
  | 'knock'
  | 'clatter'
  | 'woo'
  | 'sneeze'
  | 'tweet'
  | 'bark'
  | 'click'
  | 'scribble'
  | 'sparkle'
  | 'crackle'
  | 'thud'
  | 'squeak'
  | 'applause'
  | 'toll'
  | 'foghorn'
  | 'snore'
  | 'tick'
  | 'yawn'
  | 'croak'
  | 'gull'
  | 'giggle';
export type FilmCue = { at: number; duration: number; gain: number; pan: number } & (
  { kind: 'note'; voice: Voice; pitch: number } | { kind: FilmEffect }
);

// Original melodies and arrangements. All cue positions use the same normalized
// story timeline as the artwork, including the three-second opening/end titles.
const themes: Record<
  ClassicArtwork,
  { bpm: number; root: number; voice: Voice; melody: number[]; chords: number[] }
> = {
  popcorn: {
    bpm: 112,
    root: 60,
    voice: 'pluck',
    melody: [12, 16, 19, 16, 14, 17, 21, 19, 16, 12, 14, 19, 17, 16, 14, 12],
    chords: [0, 5, 7, 0],
  },
  moon: {
    bpm: 72,
    root: 60,
    voice: 'bell',
    melody: [19, 24, 23, 19, 16, 14, 12, 16, 17, 21, 19, 16, 14, 11, 14, 12],
    chords: [0, 9, 5, 7],
  },
  duckling: {
    bpm: 104,
    root: 62,
    voice: 'keys',
    melody: [12, 14, 16, 19, 16, 14, 12, 7, 9, 12, 14, 17, 16, 14, 12, 12],
    chords: [0, 5, 0, 7],
  },
  race: {
    bpm: 144,
    root: 57,
    voice: 'lead',
    melody: [12, 12, 15, 19, 22, 19, 15, 12, 17, 17, 20, 24, 23, 19, 15, 12],
    chords: [0, 0, 5, 7],
  },
  duel: {
    bpm: 116,
    root: 62,
    voice: 'pluck',
    melody: [12, 19, 15, 14, 12, 10, 7, 10, 12, 15, 17, 19, 22, 19, 14, 12],
    chords: [0, 10, 5, 7],
  },
  ufo: {
    bpm: 84,
    root: 57,
    voice: 'bell',
    melody: [12, 13, 19, 22, 20, 19, 13, 12, 24, 22, 19, 13, 12, 7, 10, 12],
    chords: [0, 1, 6, 0],
  },
};

export function cinemaScore(film: CinemaFilm): FilmCue[] {
  if (film.artwork in REEL_SCORES) return REEL_SCORES[film.artwork as ReelArtwork](film);
  const cues: FilmCue[] = [];
  const theme = themes[film.artwork as ClassicArtwork],
    beat = 60 / theme.bpm;
  const story = film.duration - 6;
  const at = (p: number) => 3 + p * story;
  const note = (
    time: number,
    pitch: number,
    duration: number,
    voice: Voice,
    gain: number,
    pan = 0,
  ) => {
    cues.push({ kind: 'note', at: time, pitch, duration, voice, gain, pan });
  };
  const fx = (kind: FilmEffect, p: number, duration: number, gain = 0.24, pan = 0) => {
    cues.push({ kind, at: at(p), duration, gain, pan });
  };
  // Intro motif, evolving accompaniment, and a resolved closing chord.
  for (let i = 0; i < 3; i++)
    note(0.3 + i * 0.42, theme.root + [12, 19, 24][i], 1.2, theme.voice, 0.1, (i - 1) * 0.2);
  for (let t = 3, i = 0; t < film.duration - 3.4; t += beat, i++) {
    const p = (t - 3) / story;
    const chord = theme.root + theme.chords[Math.floor(i / 8) % 4];
    const dramatic = (film.artwork === 'race' || film.artwork === 'duel') && p > 0.25 && p < 0.8;
    note(t, chord - 12, beat * 0.8, 'bass', 0.09);
    if (i % 4 === 0) {
      const minor = ['race', 'duel', 'ufo'].includes(film.artwork);
      for (const interval of [0, minor ? 3 : 4, 7])
        note(t, chord + interval, beat * 3.8, 'pad', 0.027, interval === 0 ? -0.35 : 0.35);
    }
    if (i % 4 !== 3 || dramatic)
      note(
        t,
        theme.root + theme.melody[i % theme.melody.length],
        beat * 0.7,
        theme.voice,
        0.085,
        Math.sin(i * 0.7) * 0.3,
      );
    if (dramatic) {
      note(t, 40, 0.15, i % 2 ? 'snare' : 'kick', 0.065);
      note(
        t + beat * 0.5,
        theme.root + theme.melody[(i + 3) % 16],
        beat * 0.3,
        'pluck',
        0.045,
        -0.25,
      );
    }
  }
  for (const interval of [0, 7, 12, 16])
    note(film.duration - 2.8, theme.root + interval, 2.5, 'bell', 0.055, (interval - 8) / 24);

  switch (film.artwork) {
    case 'popcorn':
      fx('rustle', 0, story * 0.2, 0.1, -0.6);
      for (let i = 0; i < 7; i++) fx('pop', 0.045 + i * 0.024, 0.14, 0.3, -0.65);
      for (let i = 1; i <= 4; i++) fx('bounce', 0.2 + i / 8, 0.24, 0.25, -0.5 + i * 0.25);
      fx('rustle', 0.84, 0.7, 0.26, 0.6);
      fx('chime', 0.87, 1.5, 0.18, 0.6);
      break;
    case 'moon':
      fx('wind', 0, story, 0.06);
      fx('meow', 0.08, 0.8, 0.2, -0.6);
      fx('swish', 0.16, 1.2, 0.13, -0.25);
      for (let i = 0; i < 8; i++) fx('chime', 0.56 + i * 0.03, 1, 0.12, 0.6 - i * 0.12);
      fx('meow', 0.88, 0.8, 0.13, -0.6);
      break;
    case 'duckling':
      fx('water', 0, story, 0.13);
      for (let i = 0; i < 6; i++) fx('quack', i * 0.035, 0.25, 0.13, 0.5 - i * 0.18);
      fx('flutter', 0.2, story * 0.49, 0.07, -0.45);
      fx('quack', 0.58, 0.45, 0.27, -0.7);
      for (let i = 0; i < 8; i++) fx('step', 0.6 + i * 0.032, 0.1, 0.15, -0.6 + i * 0.12);
      fx('quack', 0.91, 0.25, 0.18, 0.4);
      fx('chime', 0.94, 1.1, 0.12);
      break;
    case 'race':
      for (let i = 0; i < 3; i++) fx('beep', i * 0.06, 0.26, 0.22);
      fx('beep', 0.18, 0.6, 0.3);
      fx('engine', 0.18, story * 0.7, 0.2, -0.2);
      fx('sweep', 0.57, story * 0.23, 0.22, 0.3);
      fx('crowd', 0.8, story * 0.15, 0.18);
      fx('chime', 0.88, 1.5, 0.2);
      break;
    case 'duel':
      fx('wind', 0, story, 0.07);
      for (let i = 0; i < 6; i++) fx('step', 0.1 + i * 0.022, 0.15, 0.2, i % 2 ? 0.45 : -0.45);
      for (let i = 0; i < 6; i++) {
        fx('swish', 0.27 + i * 0.075, 0.65, 0.25, i % 2 ? 0.4 : -0.4);
        fx('clash', 0.27 + (i + 0.5) * 0.075, 0.9, 0.34);
      }
      fx('flutter', 0.72, story * 0.15, 0.12, 0.3);
      fx('chime', 0.87, 1.3, 0.18);
      break;
    case 'ufo':
      fx('wind', 0, story, 0.07);
      fx('hum', 0, story * 0.83, 0.18);
      for (let i = 0; i < 3; i++) {
        fx('beam', 0.23 + (i + 0.25) * 0.18, story * 0.18 * 0.7, 0.25, (i - 1) * 0.5);
        fx('gasp', 0.23 + (i + 0.3) * 0.18, 0.5, 0.2, (i - 1) * 0.5);
        fx('beep', 0.23 + (i + 0.88) * 0.18, 0.18, 0.14);
      }
      fx('warp', 0.83, story * 0.17, 0.27, 0.4);
      break;
  }
  return cues.sort((a, b) => a.at - b.at);
}
