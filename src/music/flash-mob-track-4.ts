// "Thin Moon Disco": the flash mob's record for the last week of each season (dates 22–28, the
// moon waning from its last quarter to new; src/lib/flash-mob-beat.ts FLASH_MOB_TRACKS). A gentle
// disco-funk: four on the floor, an open hat on every offbeat, an octave-jumping bass, a string
// section that sweeps and stabs, and a vibraphone glittering like a mirror ball. Like "Nothing to
// See Here" (flash-mob-track.ts) it plays once on the clock, and its sections are the dance's,
// beat for beat (two beats to a town minute):
//
//   0–16    solo    one dancer alone: the felt kick on one and three, finger snaps, the open hat
//                   on the offbeats, a syncopated octave bass and one soft electric-piano chord a bar
//   16–40   join    a vibraphone note as each dancer leaves the crowd (beat 16 + 2(k − 1)), climbing
//                   the key, and a layer every two bars: four on the floor, shaker and electric-piano
//                   chops (16), the rhythm guitar and the glow pad (24), claps on two and four, the
//                   octave bass and the strings' swell and rip up into the routine (32)
//   40–56   clap    the tune on the strings, the whole mob clapping every beat
//   56–72   point   a string-and-keys stab on every point, screen-left on even beats and right on
//                   odd ones, the flute answering the tune
//   72–88   groove  side steps over the bounciest bass line, the electric piano calling
//   88–104  wave    half time: the strings rush up across each bar, left to right, and sway on a
//                   long note, the ride washing over the glow pad
//   104–120 spin    the vibraphone whirling round once a bar (a quarter a beat), the tune again
//   120–136 jump    a big hit on every landing: even beats, then every beat of the last bar, and a
//                   string run lifting the key a tone
//   136–168 finale  in B minor: the tune on the strings, choir "ooh"s, vibraphone ripples across
//                   the square and back, then everyone clapping faster and faster, and a breath
//                   (167.5–168)
//   168     the hit one B minor ninth from everyone at once, then nothing: the pose held in silence
//
// Written in A minor with a dorian lean (the bright sixth, F#, over the D9), warm rather than sad,
// and lifted to B minor for the finale: the night getting darker toward the new moon, but still
// glittering. Nothing sounds after beat 168 but that chord's decay, so the render's loop wrap
// brings nothing round to the start. The open hat is the old synth's hat with a bright shaker
// stroke; a clap is four brush taps 0–23 ms apart across the stereo field, with a whisper of
// snare. The render worker reaches this file through score.ts, so it imports nothing but the kit
// and the beat. No Math.random or Date.
import { midi, Score, type Note, type TuneInfo } from './tunes/kit';
import { FLASH_MOB_BPM, FLASH_MOB_CUES, FLASH_MOB_TRACK_BEATS } from '../lib/flash-mob-beat';

export const FLASH_MOB_TRACK_4: TuneInfo = {
  title: 'Thin Moon Disco',
  subtitle: 'Fountain Square, on the stroke of five',
  bpm: FLASH_MOB_BPM,
  beats: FLASH_MOB_TRACK_BEATS,
  bar: 4,
  hall: { wet: 0.22, size: 0.5, damp: 0.45 },
  // Measured over the whole track, the sparse solo and the silent end with it, as the first record.
  loudness: 0.048,
  instruments:
    'Strings, vibraphone, electric piano, nylon guitar, flute, glow pad, choir, fingered bass, felt kick, open hi-hat, hand claps, shaker',
};

const PHRASE = 16;
const C = FLASH_MOB_CUES;
const CLAP = C.routine,
  POINT = CLAP + PHRASE,
  GROOVE = POINT + PHRASE,
  WAVE = GROOVE + PHRASE,
  SPIN = WAVE + PHRASE,
  JUMP = SPIN + PHRASE,
  RIPPLE = C.finale,
  BUILD = C.finale + PHRASE,
  HIT = C.freeze;

// A bar's chord ('X|Y' halves it), one a bar from 17:00; the finale is in B minor.
const HARMONY = [
  ...['Am7', 'D9', 'Am7', 'D9'], // solo
  ...['Am7', 'D9', 'Am7', 'D9', 'Fmaj7', 'E7sus4|E7'], // join
  ...['Am9', 'D9', 'Fmaj7', 'G6'], // clap
  ...['Am9', 'D9', 'Fmaj7', 'G6'], // point
  ...['Am7', 'D9', 'Am7', 'D9'], // groove
  ...['Fmaj7', 'G6', 'Em7', 'Fmaj7|E7sus4'], // wave
  ...['Am9', 'D9', 'Fmaj7', 'G6'], // spin
  ...['Fmaj7', 'G6', 'Em7', 'F#7sus4|F#7'], // jump, and the lift
  ...['Bm9', 'E9', 'Gmaj7', 'A6'], // finale: the ripple
  ...['Gmaj7', 'A6', 'F#m7|Bm7', 'Em7|F#7sus4'], // finale: the build
  'Bm9', // the hit
];
// Each chord in the middle of the keyboard, for the keys, guitar, strings and pad.
const SHAPES: Record<string, string> = {
  Am7: 'G3 A3 C4 E4',
  Am9: 'G3 B3 C4 E4',
  D9: 'F#3 A3 C4 E4',
  Fmaj7: 'F3 A3 C4 E4',
  G6: 'G3 B3 D4 E4',
  Em7: 'E3 G3 B3 D4',
  E7sus4: 'E3 A3 B3 D4',
  E7: 'E3 G#3 B3 D4',
  'F#7sus4': 'F#3 B3 C#4 E4',
  'F#7': 'F#3 A#3 C#4 E4',
  Bm9: 'A3 C#4 D4 F#4',
  Bm7: 'F#3 A3 B3 D4',
  E9: 'G#3 B3 D4 F#4',
  Gmaj7: 'G3 B3 D4 F#4',
  A6: 'A3 C#4 E4 F#4',
  'F#m7': 'F#3 A3 C#4 E4',
};
const pitches = (names: string) => names.split(' ').map(midi);
/** The chord sounding at a beat. */
function chordAt(beat: number) {
  const bar = Math.floor(beat / 4);
  const parts = (HARMONY[bar] ?? 'Bm9').split('|');
  return parts[Math.min(parts.length - 1, Math.floor(((beat - bar * 4) / 4) * parts.length))];
}
const shapeAt = (beat: number) => pitches(SHAPES[chordAt(beat)]);
/** The chord's root for the bass, A1–G#2. */
function rootAt(beat: number) {
  const root = midi(`${/^[A-G][#b]?/.exec(chordAt(beat))![0]}2`);
  return root > 44 ? root - 12 : root;
}
/** The chord's third above its root (the fourth for a sus chord), for the bass's walk-ups. */
function thirdAt(beat: number) {
  const name = chordAt(beat);
  return /sus4/.test(name) ? 5 : /m(?!aj)/.test(name) ? 3 : 4;
}

export function composeFlashMob4(): Note[] {
  const beats = FLASH_MOB_TRACK_4.beats;
  // The band plays with a little human drift; the drums, the claps, the dancers' cues, the stabs
  // and the hits sit exactly on the grid the dancers move to.
  const band = new Score(beats, { timing: 0.008, loudness: 0.06 });
  const kit = new Score(beats, { timing: 0, loudness: 0.05 });

  // Writes `text` from `at`: 'pitch/beats' tokens one after another (a note name or a MIDI
  // number; 'r' rests; a third field scales the gain; '|' only marks the bars), each note held
  // `legato` of its value and moved `shift` semitones; notes shorter than `min` beats are left out.
  const play = (
    at: number,
    text: string,
    voice: Note['voice'],
    gain: number,
    {
      legato = 0.92,
      pan = 0,
      shift = 0,
      score = band,
      min = 0,
    }: { legato?: number; pan?: number; shift?: number; score?: Score; min?: number } = {},
  ) => {
    let t = at;
    for (const token of text.split(/\s+/)) {
      if (!token || token === '|') continue;
      const [name, value, scale = '1'] = token.split('/');
      const length = Number(value);
      if (name !== 'r' && length >= min) {
        const pitch = /^\d+$/.test(name) ? Number(name) : midi(name);
        score.note(t, pitch + shift, length * legato, voice, gain * Number(scale), pan);
      }
      t += length;
    }
  };
  /** Calls `write` for each bar from `from` up to `to`. */
  const each = (from: number, to: number, write: (at: number, bar: number) => void) => {
    for (let at = from; at < to; at += 4) write(at, at / 4);
  };

  // ---- Drums --------------------------------------------------------------------------------
  /** A hand clap: four brush taps 0–23 ms apart across the stereo field, and a little snare. */
  const FLAM = [
    [0, 62, 0.55, -0.3],
    [0.016, 65, 0.75, 0.28],
    [0.03, 63, 0.6, -0.08],
    [0.046, 64, 1, 0.12],
  ] as const;
  const clap = (at: number, gain: number, width = 1) => {
    for (const [offset, pitch, share, pan] of FLAM)
      kit.note(at + offset, pitch, 0.25, 'brush', 0.15 * gain * share, pan * width);
    kit.note(at + 0.03, 60, 0.12, 'snare', 0.026 * gain);
  };
  // The felt kick tuned to the key's fifth: E2 in A minor, F#2 in B minor.
  const kick = (at: number, gain = 1, pitch = at >= RIPPLE ? 42 : 40) =>
    kit.note(at, pitch, 0.5, 'softkick', 0.085 * gain);
  /** The open hat on an offbeat: a burst of the old synth's hat and a bright shaker stroke. */
  const openHat = (at: number, gain = 1) => {
    kit.note(at, 42, 0.35, 'hat', 0.025 * gain, 0.3);
    kit.note(at, 72, 0.3, 'shaker', 0.055 * gain, 0.3);
  };
  /** The open hat on each offbeat of a bar, up to `until`. */
  const hats = (at: number, gain = 1, until = at + 4) => {
    for (const off of [0.5, 1.5, 2.5, 3.5])
      if (at + off < until) openHat(at + off, gain * (off === 3.5 ? 1.1 : 1));
  };
  /** The closed sixteenths between the open hats, on the shaker. */
  const shaker = (at: number, gain = 1, pattern = 'o-..o-..o-..o-..') =>
    kit.hits(at, pattern, 'shaker', 0.06 * gain, { pan: at >= POINT && at < GROOVE ? 0 : -0.3 });
  const crash = (at: number, gain = 1) => kit.note(at, 64, 4, 'ride', 0.1 * gain, -0.25);

  // Solo: the kick on one and three, finger snaps on two and four, the open hat on the offbeats.
  each(0, 16, (at) => {
    kick(at, 0.8);
    kick(at + 2, 0.7);
    hats(at, 0.7);
  });
  // Join: four on the floor and the shaker with the first joiner; claps with the ninth.
  each(16, 32, (at) => {
    for (let b = 0; b < 4; b++) kick(at + b, b % 2 ? 0.72 : 0.82);
    hats(at, 0.85);
    shaker(at, 0.85);
  });
  each(0, 32, (at) => kit.hits(at, '....x.......x...', 'rim', 0.095, { pan: 0.2 }));
  kit.hits(12, '..............xo', 'rim', 0.09, { pan: 0.2 });
  each(32, CLAP, (at) => {
    for (let b = 0; b < 4; b++) kick(at + b, b % 2 ? 0.8 : 0.92);
    clap(at + 1, 0.75);
    clap(at + 3, 0.8);
    hats(at, 0.95);
    shaker(at, 0.95);
  });
  clap(39.5, 0.5);
  clap(39.75, 0.62);
  // The routine: four on the floor and the open hat; in the clap phrase claps on every beat, after
  // it on two and four. The wave sways at half time under the ride.
  each(CLAP, JUMP, (at) => {
    const wave = at >= WAVE && at < SPIN;
    for (let b = 0; b < 4; b++) if (!wave || b % 2 === 0) kick(at + b, b % 2 ? 0.82 : 1);
    if (at < POINT) for (let b = 0; b < 4; b++) clap(at + b, b % 2 ? 1 : 0.85);
    else if (wave) clap(at + 2, 0.9);
    else {
      clap(at + 1, 0.95);
      clap(at + 3, 1);
    }
    if (wave) {
      kit.hits(at, 'x.o.x.o.', 'ride', 0.045, { step: 0.5, pan: 0.3 });
      hats(at, 0.7);
    } else {
      hats(at);
      shaker(at, 1, at >= GROOVE && at < WAVE ? 'o-..o-.oo-..o-.o' : undefined);
    }
  });
  for (const at of [CLAP, POINT, GROOVE, SPIN]) crash(at, at === CLAP ? 1 : 0.8);
  crash(WAVE, 0.6);

  // ---- Bass ---------------------------------------------------------------------------------
  /** A step into the next chord's root from a semitone below (or its octave, on the same chord). */
  const into = (from: number, beat: number) => {
    const next = rootAt(beat);
    return next === from ? from + 12 : next - 1;
  };
  // Solo and join: a syncopated octave figure, room left for the dancer.
  each(0, 32, (at) => {
    const r = rootAt(at);
    play(
      at,
      `${r}/.75 ${r}/.25/.6 ${r + 12}/.5/.85 r/1 ${r}/.25/.7 ${r + 12}/.25/.8 ${r + 10}/.5/.8 ${into(r, at + 4)}/.5/.85`,
      'fingerbass',
      0.105,
      { legato: 0.85 },
    );
  });
  /** The disco octaves: root and octave on every eighth, a sixteenth kick into the next bar. */
  const octaves = (at: number, gain = 0.1, last = false) => {
    const r = rootAt(at),
      l = rootAt(at + 2);
    play(
      at,
      last
        ? `${r}/.5 ${r + 12}/.5/.8 ${r}/.5/.9 ${r + 12}/.5/.8 ${l}/.5 ${l + 12}/.5/.85 ${l + 12}/.5/.9 r/.5`
        : `${r}/.5 ${r + 12}/.5/.8 ${r}/.5/.9 ${r + 12}/.5/.8 ${l}/.5 ${l + 12}/.5/.8 ${l + 12}/.25/.6 ${l + 7}/.25/.7 ${into(l, at + 4)}/.5/.85`,
      'fingerbass',
      gain,
      { legato: 0.75 },
    );
  };
  each(32, GROOVE, (at) => octaves(at));
  // The groove: the bounciest line, sixteenths jumping the octave and walking up into each bar.
  each(GROOVE, WAVE, (at) => {
    const r = rootAt(at),
      o = r + 12;
    play(
      at,
      `${r}/.5 ${o}/.25/.85 ${o}/.25/.55 r/.25 ${r}/.25/.75 ${o}/.5/.9 ${r}/.5 ${o}/.25/.8 ${r + 7}/.25/.75 ${r + 10}/.25/.8 ${o}/.25/.85 ${r + thirdAt(at)}/.25/.7 ${into(r, at + 4)}/.25/.8`,
      'fingerbass',
      0.114,
      { legato: 0.7 },
    );
  });
  // The wave sways: a held root, then the fifth (or the second chord's root).
  each(WAVE, SPIN, (at) => {
    const r = rootAt(at),
      l = rootAt(at + 2);
    play(at, `${r}/2 ${l === r ? r + 7 : l}/1.5/.85 ${l + 12}/.5/.7`, 'fingerbass', 0.11);
  });
  each(SPIN, JUMP, (at) => octaves(at));
  each(RIPPLE, BUILD, (at) => octaves(at, 0.104));
  // The build: eighths on the root climbing the octave, the last bar stopping for a breath.
  each(BUILD, HIT, (at) => octaves(at, 0.106, at === HIT - 4));

  // ---- Electric piano -------------------------------------------------------------------------
  // The solo's one soft chord a bar; offbeat chops from the first joiner.
  each(0, 16, (at) =>
    band.chord(at, shapeAt(at), 1.4, 'epiano', 0.026, { strum: 0.02, spread: 0.3 }),
  );
  const chops = (at: number, gain = 0.028) => {
    for (const off of [0.5, 1.5, 2.5, 3.5]) {
      const beat = at + off;
      if (beat >= HIT - 0.5) continue;
      band.chord(beat, shapeAt(beat).slice(1), 0.3, 'epiano', gain * (off % 2 === 1.5 ? 1 : 0.85), {
        spread: 0.25,
        pan: -0.25,
      });
    }
  };
  each(16, POINT, (at) => chops(at, at < 32 ? 0.026 : 0.028));
  each(SPIN, JUMP, (at) => chops(at, 0.026));
  each(BUILD, HIT, (at) => chops(at, 0.027));

  // ---- Rhythm guitar: a two-note scratch on the sixteenths either side of each offbeat ---------
  const scratch = (at: number, gain = 0.034) => {
    for (let b = 0; b < 4; b++)
      for (const [off, accent] of b % 2
        ? ([
            [0.25, 0.55],
            [0.75, 1],
          ] as const)
        : ([[0.75, 1]] as const)) {
        const beat = at + b + off;
        if (beat >= HIT - 0.5) continue;
        const shape = shapeAt(beat);
        band.chord(beat, [shape[1] + 12, shape[3] + 12], 0.12, 'nylon', gain * accent, {
          strum: 0.008,
          pan: 0.4,
        });
      }
  };
  each(24, WAVE, (at) => scratch(at, at < CLAP ? 0.03 : 0.034));
  each(SPIN, JUMP, (at) => scratch(at));
  each(RIPPLE, BUILD, (at) => scratch(at, 0.032));

  // ---- Glow pad: the chord held a bar, in the join, the groove and the wave ---------------------
  const pad = (at: number, gain: number) => {
    const half = chordAt(at) !== chordAt(at + 2);
    for (const [from, length] of half
      ? [[0, 1.9] as const, [2, 1.9] as const]
      : [[0, 3.9] as const])
      band.chord(at + from, shapeAt(at + from).slice(1), length, 'glow', gain, { spread: 0.35 });
  };
  each(24, CLAP, (at) => pad(at, at < 32 ? 0.016 : 0.018));
  each(GROOVE, SPIN, (at) => pad(at, at < WAVE ? 0.019 : 0.032));

  // ---- The dancers joining: a vibraphone note as each one leaves the crowd, up the key ---------
  // Written for a full mob of twelve; with fewer dancers the later notes ring out over the
  // dancers already in place.
  'A4 C5 D5 E5 G5 A5 C6 D6 E6 G6 A6'
    .split(' ')
    .forEach((name, k) =>
      kit.note(C.join + 2 * k, midi(name), 1.5, 'vibes', 0.085, k % 2 ? 0.3 : -0.3),
    );

  // ---- Strings: the swell into the routine, and a rip up to its first beat ---------------------
  play(32, 'E5/4/.7 | E5/2/.85 E5/1.5/1 r/.5', 'strings', 0.045, { legato: 1 });
  play(32, 'C5/4/.7 | B4/2/.85 B4/1.5/1 r/.5', 'strings', 0.045, { legato: 1 });
  play(32, 'A4/4/.7 | A4/2/.85 G#4/1.5/1 r/.5', 'strings', 0.045, { legato: 1 });
  play(38.5, 'E4/.25/.6 G#4/.25/.7 B4/.25/.8 D5/.25/.9 E5/.25 G#5/.25/1.1', 'strings', 0.05, {
    legato: 1.2,
  });

  // ---- The tune -------------------------------------------------------------------------------
  const HOOK = [
    'r/.5 E5/.5 A5/.5 B5/.5 C6/1 B5/.5 A5/.5',
    'F#5/1.5 E5/.5 D5/.5 E5/.5 F#5/1',
    'r/.5 C5/.5 F5/.5 A5/.5 C6/1 A5/.5 G5/.5',
    'B5/1 A5/.5 G5/.5 E5/1.5 r/.5',
  ].join(' | ');
  const ANSWER = [
    'r/.5 E5/.5 A5/.5 B5/.5 C6/1 D6/.5 E6/.5',
    'D6/1.5 C6/.5 A5/.5 B5/.5 A5/1',
    'r/.5 A5/.5 C6/.5 E6/.5 D6/1 C6/.5 A5/.5',
    'B5/1 D6/.5 B5/.5 A5/1.5 r/.5',
  ].join(' | ');
  const LEAD = 0.07;
  /** The tune on the strings, its long notes an octave below too, and the vibraphone glinting. */
  const tune = (at: number, text: string, shift = 0, glint = 0.03) => {
    play(at, text, 'strings', LEAD, { legato: 0.9, shift });
    play(at, text, 'strings', LEAD * 0.55, { legato: 0.9, shift: shift - 12, min: 1 });
    if (glint) play(at, text, 'vibes', glint, { legato: 0.6, shift, pan: -0.2 });
  };
  tune(CLAP, HOOK);
  play(POINT, ANSWER, 'flute', 0.07, { pan: 0.1 });

  // Point: a stab on every beat, thrown to screen-left on even beats and right on odd ones.
  each(POINT, GROOVE, (at) => {
    for (let b = 0; b < 4; b++) {
      const beat = at + b,
        side = (beat - POINT) % 2 ? 1 : -1,
        shape = shapeAt(beat);
      const upper = shape.slice(1).map((p) => p + 12);
      kit.chord(beat, upper, 0.22, 'strings', 0.038, { pan: side * 0.85, spread: 0.1 });
      kit.chord(beat, upper, 0.2, 'nylon', 0.032, { pan: side * 0.9 });
      kit.chord(beat, shape, 0.22, 'epiano', 0.026, { pan: side * 0.7 });
      kit.note(beat, shape[3] + 12, 0.3, 'vibes', 0.04, side * 0.95);
    }
  });

  // Groove: the electric piano calls in the gaps the bass leaves, the strings fall in reply.
  const CALLS = [
    'r/2 A5/.25 C6/.25 r/.25 A5/.25 G5/.5 E5/.5',
    'r/2 F#5/.25 A5/.25 r/.25 F#5/.25 E5/.5 D5/.5',
    'r/2 A5/.25 C6/.25 r/.25 D6/.25 E6/.5 C6/.5',
    'D6/.5 C6/.25 A5/.25 r/.5 F#5/.5 A5/.5 r/1.5',
  ].join(' | ');
  play(GROOVE, CALLS, 'epiano', 0.056, { legato: 0.8, pan: -0.1 });
  play(GROOVE + 6.5, 'E6/.25 C6/.25 A5/.5', 'strings', 0.04, { legato: 0.9 });
  play(GROOVE + 14.5, 'G5/.25 A5/.25 C6/.25 E6/.25 G6/.5', 'strings', 0.04, { legato: 0.9 });

  // Wave: in each bar the strings rush up across the field, left to right, and sway on a long
  // note over the pad; the vibraphone doubles the rush at the top.
  const LANDINGS = ['A5', 'B5', 'G5', 'A5'];
  each(WAVE, SPIN, (at, bar) => {
    const shape = shapeAt(at);
    const run = [...shape, ...shape.map((p) => p + 12)];
    run.forEach((p, i) => {
      const pan = (i / 7) * 1.4 - 0.7;
      band.note(at + i * 0.25, p + 12, 0.4, 'strings', 0.05 * (0.7 + 0.05 * i), pan);
      if (i >= 4) band.note(at + i * 0.25, p + 12, 0.3, 'vibes', 0.024, pan);
    });
    const land = midi(LANDINGS[bar - WAVE / 4]);
    // The sway: a soft electric-piano chord on each half of the bar.
    for (const half of [0, 2])
      band.chord(at + half, shapeAt(at + half), 1.6, 'epiano', 0.036, { strum: 0.03, spread: 0.3 });
    band.note(at + 2, land, 1.9, 'strings', 0.08, 0.15);
    band.note(at + 2, land - 12, 1.9, 'strings', 0.055, -0.15);
  });
  // Spin: the vibraphone whirls round each bar (a turn a bar, a quarter a beat), the tune again.
  each(SPIN, JUMP, (at) => {
    for (let i = 0; i < 16; i++) {
      const beat = at + i / 4;
      const shape = shapeAt(beat);
      const tones = [...shape.map((p) => p + 12), shape[0] + 24];
      band.note(
        beat,
        tones[[0, 1, 2, 3, 4, 3, 2, 1][i % 8]],
        0.25,
        'vibes',
        0.036 * (i % 4 ? 0.8 : 1.15),
        Math.sin((i / 16) * 2 * Math.PI) * 0.65,
      );
    }
  });
  tune(SPIN, HOOK, 0, 0);

  // Jump: a big hit on every landing (every other beat, every beat in the last bar), and the
  // vibraphone springing up into each.
  const hit = (beat: number, top: string | undefined, gain = 1) => {
    const shape = shapeAt(beat),
      r = rootAt(beat);
    kick(beat, 1.1 * gain);
    clap(beat, 1.05 * gain, 1.2);
    kit.note(beat, r, 0.6, 'fingerbass', 0.11 * gain);
    kit.note(beat, r + 12, 0.6, 'fingerbass', 0.05 * gain);
    kit.chord(beat, shape, 0.45, 'epiano', 0.04 * gain, { spread: 0.35 });
    kit.chord(
      beat,
      shape.slice(1).map((p) => p + 12),
      0.45,
      'strings',
      0.05 * gain,
      { spread: 0.25 },
    );
    if (top) kit.note(beat, midi(top), 0.5, 'vibes', 0.06 * gain, -0.1);
  };
  const JUMPS: [offset: number, top?: string][] = [
    [0, 'A5'],
    [2, 'C6'],
    [4, 'B5'],
    [6, 'D6'],
    [8, 'B5'],
    [10, 'E6'],
    [12, 'C#6'],
    [13, 'E6'],
    [14],
    [15],
  ];
  for (const [offset, top] of JUMPS) {
    hit(JUMP + offset, top, offset >= 12 ? 0.85 + 0.05 * (offset - 12) : 1);
    if (offset < 12) {
      const shape = shapeAt(JUMP + offset + 1.5).map((p) => p + 12);
      band.note(JUMP + offset + 1.5, shape[2], 0.25, 'vibes', 0.04, 0.35);
      band.note(JUMP + offset + 1.75, shape[3], 0.25, 'vibes', 0.045, 0.35);
    }
  }
  crash(JUMP, 0.9);
  crash(JUMP + 8, 0.7);
  each(JUMP, RIPPLE, (at) => {
    hats(at, 0.9);
    shaker(at, 0.9);
  });
  // The lift: a clap roll, and the strings running up into B minor.
  [135, 135.25, 135.5, 135.75].forEach((beat, i) => clap(beat, 0.55 + 0.12 * i));
  play(134.5, 'F#4/.25 G#4/.25 A#4/.25 B4/.25 C#5/.25 E5/.25', 'strings', 0.052, {
    legato: 1.2,
  });

  // ---- Finale -------------------------------------------------------------------------------
  // The ripple: the tune a tone up, the choir, and vibraphone ripples across the square and back.
  /** Eight vibraphone notes in sixteenths up (or down) two octaves of the chord, crossing the field. */
  const ripple = (at: number, up: boolean, gain: number) => {
    const shape = shapeAt(at);
    const run = [...shape.map((p) => p + 12), ...shape.map((p) => p + 24)];
    if (!up) run.reverse();
    run.forEach((p, i) =>
      band.note(
        at + i * 0.25,
        p,
        0.3,
        'vibes',
        gain * (0.75 + 0.05 * i),
        ((i / 7) * 1.4 - 0.7) * (up ? 1 : -1),
      ),
    );
  };
  each(RIPPLE, BUILD, (at) => {
    for (let b = 0; b < 4; b++) kick(at + b, b % 2 ? 0.85 : 1.05);
    clap(at + 1, 1.05);
    clap(at + 3, 1.1);
    hats(at);
    shaker(at);
    ripple(at, true, 0.034);
    ripple(at + 2, false, 0.03);
    band.chord(
      at,
      shapeAt(at)
        .slice(1)
        .map((p) => p + 12),
      3.8,
      'choir',
      0.03,
      { spread: 0.4 },
    );
  });
  crash(RIPPLE, 1.1);
  tune(RIPPLE, HOOK, 2, 0);

  // The build: everyone together, the claps doubling, the strings and choir climbing to the hit.
  each(BUILD, HIT, (at, bar) => {
    const step = bar - BUILD / 4;
    for (let b = 0; b < 4; b++)
      kick(at + b, (step < 2 ? (b % 2 ? 0.82 : 1.05) : step === 2 ? 0.92 : 1.05) + 0.03 * step);
    const claps = [
      [0, 1, 2, 3],
      [0, 1, 2, 3, 3.5],
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
      [0, 0.5, 1, 1.5, 2, 2.25, 2.5, 2.75, 3, 3.25],
    ][step];
    claps.forEach((off, i) => clap(at + off, 0.75 + 0.07 * step + (step === 3 ? i * 0.03 : 0)));
    hats(at, 0.9 + 0.05 * step, Math.min(at + 4, HIT - 0.5));
    shaker(at, 1 + 0.08 * step, step < 3 ? 'x-o-x-o-x-o-x-o-' : 'xoxoxoxoxoxoxo..');
  });
  // A snare roll under the last two beats, growing, up to the breath.
  for (let i = 0; i < 8; i++) kit.note(165.5 + i * 0.25, 60, 0.12, 'snare', 0.02 + 0.007 * i, 0.1);
  crash(BUILD, 0.8);
  const CLIMB = [
    'D5/.5 F#5/.5 B5/1 F#5/.5 D5/.5 F#5/1',
    'E5/.5 A5/.5 C#6/1 A5/.5 E5/.5 A5/1',
    'F#5/.5 A5/.5 C#6/1 D6/.5 F#5/.5 B5/1',
    'E5/.5 G5/.5 B5/.5 E6/.5 F#6/.5 E6/.5 C#6/.5 r/.5',
  ].join(' | ');
  play(BUILD, CLIMB, 'flute', 0.062, { pan: 0.1 });
  play(BUILD, CLIMB, 'vibes', 0.03, { legato: 0.6, pan: -0.2 });
  const rising = (text: string, voice: Note['voice'], gain: number) =>
    play(BUILD, text, voice, gain, { legato: 1 });
  rising('B4/4/.8 | C#5/4/.9 | C#5/2 D5/2/1.05 | E5/2/1.1 E5/1.5/1.15 r/.5', 'strings', 0.044);
  rising('F#4/4/.8 | A4/4/.9 | A4/2 B4/2/1.05 | B4/2/1.1 C#5/1.5/1.15 r/.5', 'strings', 0.04);
  rising('D5/4/.8 | E5/4/.9 | E5/2 F#5/2/1.05 | G5/2/1.1 B5/1.5/1.15 r/.5', 'choir', 0.026);

  // ---- The hit: everyone at once on beat 168, short; then nothing --------------------------------
  kick(HIT, 1.4, 35);
  clap(HIT, 1.3, 1.3);
  kit.note(HIT, 60, 0.12, 'snare', 0.05);
  crash(HIT, 1.2);
  kit.note(HIT, midi('B1'), 1, 'fingerbass', 0.13);
  kit.note(HIT, midi('B2'), 1, 'fingerbass', 0.07);
  kit.chord(HIT, pitches('B3 D4 F#4 A4 C#5'), 1.2, 'epiano', 0.042, { spread: 0.4 });
  kit.chord(HIT, pitches('B3 F#4 A4 D5'), 0.8, 'strings', 0.058, { spread: 0.3 });
  kit.chord(HIT, pitches('B4 D5 F#5'), 0.8, 'choir', 0.032, { spread: 0.4 });
  kit.chord(HIT, pitches('D5 F#5 A5 C#6'), 1.5, 'vibes', 0.045, { spread: 0.35 });
  kit.note(HIT, midi('B5'), 0.9, 'flute', 0.07, 0.1);

  return [...band.done(), ...kit.done()].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
}
