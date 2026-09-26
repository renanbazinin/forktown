import type { CinemaAd, CinemaFilm } from '../lib/cinema';
import type { FilmCue, FilmEffect } from '../music/cinema-score';
import type { Voice } from '../music/score';

/**
 * A stretch of underscore between two story times. The music follows the story's acts:
 * each section can change tempo, key, harmony, instrument, and groove.
 */
export type Section = {
  from: number;
  to: number;
  bpm: number;
  /** MIDI root, e.g. 60 = middle C. */
  root: number;
  /** One chord root per bar, as semitones above `root`. */
  chords: readonly number[];
  minor?: boolean;
  /** Melody degrees above `root`, one per `step` beats; null rests. */
  melody?: readonly (number | null)[];
  step?: number;
  voice?: Voice;
  /** Scales the melody; accompaniment follows `level`. */
  gain?: number;
  level?: number;
  groove?: 'none' | 'tick' | 'pulse' | 'march' | 'drive' | 'waltz';
  bass?: boolean;
  pad?: boolean;
  /** Seconds of fade at either edge. */
  fade?: number;
};

export type Score = {
  /** Story time → film seconds (the story starts after the 3 s opening titles). */
  time: (p: number) => number;
  story: number;
  duration: number;
  note: (
    p: number,
    pitch: number,
    seconds: number,
    voice: Voice,
    gain?: number,
    pan?: number,
  ) => void;
  /** Like `note`, but at an absolute film second (for the titles). */
  noteAt: (
    at: number,
    pitch: number,
    seconds: number,
    voice: Voice,
    gain?: number,
    pan?: number,
  ) => void;
  fx: (kind: FilmEffect, p: number, seconds: number, gain?: number, pan?: number) => void;
  chord: (
    p: number,
    pitches: readonly number[],
    seconds: number,
    voice: Voice,
    gain?: number,
  ) => void;
  section: (section: Section) => void;
};

/** A cue sheet for one screening: `lead` seconds of titles, then `story` seconds of picture. */
function cueSheet(duration: number, lead: number, story: number) {
  const cues: FilmCue[] = [];
  const time = (p: number) => lead + p * story;
  const push = (cue: FilmCue) => {
    if (!(cue.at >= 0) || cue.at >= duration - 0.05) return;
    cues.push({ ...cue, duration: Math.min(cue.duration, duration - cue.at) });
  };
  const noteAt = (at: number, pitch: number, seconds: number, voice: Voice, gain = 0.08, pan = 0) =>
    push({ kind: 'note', at, pitch, duration: seconds, voice, gain, pan });
  const note = (p: number, pitch: number, seconds: number, voice: Voice, gain = 0.08, pan = 0) =>
    noteAt(time(p), pitch, seconds, voice, gain, pan);
  const fx = (kind: FilmEffect, p: number, seconds: number, gain = 0.24, pan = 0) =>
    push({ kind, at: time(p), duration: seconds, gain, pan });
  const chord = (
    p: number,
    pitches: readonly number[],
    seconds: number,
    voice: Voice,
    gain = 0.05,
  ) =>
    pitches.forEach((pitch, i) =>
      note(
        p,
        pitch,
        seconds,
        voice,
        gain,
        pitches.length > 1 ? (i / (pitches.length - 1) - 0.5) * 0.6 : 0,
      ),
    );
  const section = (s: Section) => {
    const beat = 60 / s.bpm,
      start = time(s.from),
      end = time(s.to);
    const fade = s.fade ?? 1.2,
      level = s.level ?? 1;
    const envelope = (t: number) =>
      Math.max(0, Math.min(1, (t - start) / fade + 0.25, (end - t) / fade));
    const third = s.minor ? 3 : 4;
    const waltz = s.groove === 'waltz';
    const bar = waltz ? 3 : 4;
    for (let t = start, i = 0; t < end - 0.08; t += beat, i++) {
      const g = envelope(t) * level;
      if (g <= 0.01) continue;
      const chordRoot = s.root + s.chords[Math.floor(i / bar) % s.chords.length];
      const downbeat = i % bar === 0;
      if (s.bass !== false && (downbeat || (!waltz && i % 2 === 0) || s.groove === 'drive'))
        noteAt(t, chordRoot - 12, beat * 0.85, 'bass', 0.085 * g);
      if (s.pad !== false && downbeat)
        for (const interval of [0, third, 7])
          noteAt(
            t,
            chordRoot + interval,
            beat * bar * 0.95,
            'pad',
            0.026 * g,
            interval ? 0.35 : -0.35,
          );
      if (waltz && !downbeat)
        for (const interval of [third, 7])
          noteAt(t, chordRoot + interval + 12, beat * 0.5, 'keys', 0.03 * g, 0.2);
      switch (s.groove) {
        case 'tick':
          noteAt(t + beat / 2, 80, 0.05, 'hat', 0.018 * g, 0.3);
          break;
        case 'pulse':
          if (downbeat || i % bar === 2) noteAt(t, 36, 0.2, 'kick', 0.05 * g);
          noteAt(t + beat / 2, 80, 0.05, 'hat', 0.022 * g, 0.3);
          break;
        case 'march':
          noteAt(t, 36, 0.12, i % 2 ? 'snare' : 'kick', 0.045 * g);
          if (i % bar === 3) noteAt(t + beat / 2, 36, 0.1, 'snare', 0.03 * g);
          break;
        case 'drive':
          noteAt(t, 36, 0.2, 'kick', 0.06 * g);
          if (i % 2) noteAt(t, 36, 0.15, 'snare', 0.05 * g);
          noteAt(t + beat / 2, 80, 0.05, 'hat', 0.025 * g, 0.3);
          break;
      }
    }
    if (s.melody?.length) {
      const step = beat * (s.step ?? 1);
      for (let t = start, i = 0; t < end - 0.08; t += step, i++) {
        const degree = s.melody[i % s.melody.length];
        const g = envelope(t) * (s.gain ?? 1);
        if (degree === null || g <= 0.01) continue;
        noteAt(
          t,
          s.root + degree,
          step * 0.9,
          s.voice ?? 'keys',
          0.08 * g,
          Math.sin(i * 0.7) * 0.3,
        );
      }
    }
  };
  const score: Score = { time, story, duration, note, noteAt, fx, chord, section };
  return { cues, score };
}

/**
 * Builds a deterministic film score. Every cue is kept inside the film, so the rendered
 * mix never runs past the end card, and the opening/closing motifs frame the titles.
 */
export function composeFilm(
  film: CinemaFilm,
  motif: { root: number; voice: Voice; intro: readonly number[]; outro: readonly number[] },
  write: (score: Score) => void,
): FilmCue[] {
  const { cues, score } = cueSheet(film.duration, 3, film.duration - 6);
  // The opening motif sits under the title card; the resolved chord sits under "The End".
  motif.intro.forEach((degree, i) =>
    score.noteAt(
      0.3 + i * 0.4,
      motif.root + degree,
      1.3,
      motif.voice,
      0.1,
      (i / Math.max(1, motif.intro.length - 1) - 0.5) * 0.4,
    ),
  );
  write(score);
  motif.outro.forEach((degree, i) =>
    score.noteAt(
      film.duration - 2.9 + i * 0.12,
      motif.root + degree,
      2.7 - i * 0.12,
      'bell',
      0.05,
      (i / Math.max(1, motif.outro.length - 1) - 0.5) * 0.5,
    ),
  );
  return cues.sort((a, b) => a.at - b.at);
}

/** An ad's jingle: no titles, so story time runs across the spot, inside a breath of silence. */
export function composeAd(ad: CinemaAd, write: (score: Score) => void): FilmCue[] {
  const { cues, score } = cueSheet(ad.duration, 0.1, ad.duration - 0.4);
  write(score);
  // Pads that would ring past the spot stop just short of it, so the next one starts clean.
  const end = ad.duration - 0.2;
  return cues
    .filter((cue) => cue.at < end)
    .map((cue) => ({ ...cue, duration: Math.min(cue.duration, end - cue.at) }))
    .sort((a, b) => a.at - b.at);
}
