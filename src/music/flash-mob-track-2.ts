// "Somebody Brought a Tuba": the flash mob's second record (src/lib/flash-mob-beat.ts
// FLASH_MOB_TRACKS), for the week the moon grows from its first quarter to full (dates 8, 10, 12
// and 14). A street brass band strikes up out of nowhere and grows with the crowd, like the moon.
// It keeps the beat and cues of "Nothing to See Here" (flash-mob-track.ts), so the one dance fits
// it beat for beat (src/lib/flash-mob-beat.ts, two beats to a town minute):
//
//   0–16    solo    the tuba alone, strutting, over the bass drum, its little cymbal and rim clicks
//   16–40   join    a glockenspiel note as each dancer leaves the crowd (beat 16 + 2(k − 1)),
//                   climbing to the top of the bells, and a layer every two bars: the snare's street
//                   beat (16), the trombones on two and four (24), the bass drum on every beat,
//                   claps and the whole band swelling (32), and a snare roll into the routine
//   40–56   clap    the tune on trumpets, the whole mob clapping every beat, the snare down to its
//                   ghosts so the claps carry the backbeat
//   56–72   point   a shout chorus: a brass stab on every point, screen-left on even beats, right on
//                   odd, its top line climbing by half steps
//   72–88   groove  side steps over the tuba's bouncing riff, trumpets calling, trombones answering
//   88–104  wave    half time: the band's chord blooming a player at a time, half a beat apart, left
//                   to right, under a long horn line, and the sway
//   104–120 spin    bells whirling round the square once a bar, a quarter turn a beat; the tune again
//   120–136 jump    a big hit and a cymbal on every landing: even beats, then every beat of the last
//                   bar, and a snare roll lifting the key
//   136–168 finale  the tune a tone up in G, bells rippling across the square and back, then jumps,
//                   the claps doubling and doubling again over a snare roll, and a breath (167.5–168)
//   168     the hit one chord from everyone at once, then nothing: the pose held in silence
//
// Written in F and lifted to G for the finale. The town's synth has no brass, so the band is built
// from its voices: a horn is the string section's bowed saws (a section's buzz, its filter opening
// as the note swells) over the older lead voice for the lips' attack, with a quick FM bark on the
// accents, and the short inner and low parts are the lead voice alone (the saws are the dearest
// voice to render); the tuba is a fingered bass with the saws at the same pitch for its brassy
// growl on the notes it leans on; the glockenspiel is the old pixel bell's strike over the music
// box's ring; the marching snare is the old snare's crack over a brush's wires; a cymbal is two
// rides at once. A clap is four brush taps 0–20 ms apart across the stereo field with a whisper of
// snare, as in the first record. Nothing sounds after beat 168 but the hit's decay, so the
// render's loop wrap brings nothing round. The render worker reaches this file through score.ts,
// so it imports nothing but the kit and the beat. No Math.random or Date.
import { midi, Score, type Note, type TuneInfo } from './tunes/kit';
import { FLASH_MOB_BPM, FLASH_MOB_CUES, FLASH_MOB_TRACK_BEATS } from '../lib/flash-mob-beat';

export const FLASH_MOB_TRACK_2: TuneInfo = {
  title: 'Somebody Brought a Tuba',
  subtitle: 'Fountain Square, on the stroke of five',
  bpm: FLASH_MOB_BPM,
  beats: FLASH_MOB_TRACK_BEATS,
  bar: 4,
  // An open square between houses: a little less room than the first record's.
  hall: { wet: 0.17, size: 0.45, damp: 0.5 },
  // Measured over the whole track, the sparse solo and the silent end with it, as the first record.
  loudness: 0.048,
  instruments:
    'Trumpets, trombones, tuba, glockenspiel, snare drum, bass drum, cymbals, hand claps',
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
  BUILD = RIPPLE + PHRASE,
  HIT = C.freeze;

// A bar's chord ('X|Y' halves it), one a bar from 17:00; the finale is in G.
const HARMONY = [
  ...['F', 'Dm7', 'Gm7', 'C7'], // solo
  ...['F', 'Dm7', 'Bb', 'C7', 'Gm7', 'C7sus4|C7'], // join
  ...['F', 'Dm7', 'Gm7', 'C7'], // clap
  ...['F', 'A7', 'Dm7', 'G7|C7'], // point
  ...['Bb', 'F', 'Bb', 'C7'], // groove: side to side
  ...['Dm7', 'Bb', 'Gm7', 'C7'], // wave
  ...['F', 'Dm7', 'Gm7', 'C7'], // spin
  ...['Bb', 'C', 'Am7', 'D7'], // jump, and the lift
  ...['G', 'Em7', 'Am7', 'D7'], // finale: the ripple
  ...['C', 'D', 'Bm7|Em7', 'Am7|D7'], // finale: the build
];
// Each chord in the middle of the band, for the trombones' chords and the bells' arpeggios.
const SHAPES: Record<string, string> = {
  F: 'A3 C4 F4 A4',
  Dm7: 'A3 C4 D4 F4',
  Gm7: 'Bb3 D4 F4 G4',
  C7: 'Bb3 C4 E4 G4',
  C7sus4: 'Bb3 C4 F4 G4',
  Bb: 'Bb3 D4 F4 Bb4',
  C: 'G3 C4 E4 G4',
  A7: 'G3 A3 C#4 E4',
  G7: 'G3 B3 D4 F4',
  Am7: 'G3 A3 C4 E4',
  D7: 'F#3 A3 C4 D4',
  G: 'G3 B3 D4 G4',
  Em7: 'G3 B3 D4 E4',
  D: 'F#3 A3 D4 F#4',
  Bm7: 'F#3 A3 B3 D4',
};
const pitches = (names: string) => names.split(' ').map(midi);
const pitchClass = (pitch: number) => ((pitch % 12) + 12) % 12;
/** The chord sounding at a beat. */
function chordAt(beat: number) {
  const bar = Math.floor(beat / 4);
  const parts = (HARMONY[bar] ?? 'G').split('|');
  return parts[Math.min(parts.length - 1, Math.floor(((beat - bar * 4) / 4) * parts.length))];
}
const shapeAt = (beat: number) => pitches(SHAPES[chordAt(beat)]);
/** The chord's root for the tuba, Bb1–A2. */
function rootAt(beat: number) {
  const root = midi(`${/^[A-G][#b]?/.exec(chordAt(beat))![0]}2`);
  return root > 45 ? root - 12 : root;
}
/** A degree of the chord at `beat` above its root: 1, 3, 5, 6, b7 (the street's blue one) or 8. */
function degree(name: string, beat: number) {
  const chord = chordAt(beat);
  const third = /sus4/.test(chord) ? 5 : /^[A-G][#b]?m(?!aj)/.test(chord) ? 3 : 4;
  const steps: Record<string, number> = { '1': 0, '3': third, '5': 7, '6': 9, b7: 10, '8': 12 };
  return rootAt(beat) + steps[name];
}
// F major, then G major from the lift.
const F_MAJOR = [5, 7, 9, 10, 0, 2, 4],
  G_MAJOR = [7, 9, 11, 0, 2, 4, 6];
/** The nearest note of the key at `beat` past `pitch` in `direction` (±1). */
function neighbour(pitch: number, direction: 1 | -1, beat: number) {
  const key = beat >= RIPPLE ? G_MAJOR : F_MAJOR;
  let p = pitch + direction;
  while (!key.includes(pitchClass(p))) p += direction;
  return p;
}
/** The chord's tones under `top`, nearest first: a close brass voicing down from a lead note. */
function under(top: number, beat: number, count: number) {
  const classes = shapeAt(beat).map(pitchClass);
  const out: number[] = [];
  for (let p = top - 1; out.length < count; p--) if (classes.includes(pitchClass(p))) out.push(p);
  return out;
}

export function composeFlashMob2(): Note[] {
  const beats = FLASH_MOB_TRACK_2.beats;
  // The band plays with a little human drift; the drums, the claps, the dancers' cues, the stabs,
  // the landings and the final hit sit exactly on the grid the dancers move to.
  const band = new Score(beats, { timing: 0.006, loudness: 0.06 });
  const kit = new Score(beats, { timing: 0, loudness: 0.05 });

  type Writer = (at: number, pitch: number, length: number, scale: number) => void;
  // Reads `text` from `at`: 'pitch/beats' tokens one after another (a note name or a MIDI number;
  // 'r' rests; a third field scales the gain; '|' only marks the bars), calling `write` for each
  // note, held `legato` of its value and moved `shift` semitones.
  const phrase = (
    at: number,
    text: string,
    write: Writer,
    { legato = 0.9, shift = 0 }: { legato?: number; shift?: number } = {},
  ) => {
    let t = at;
    for (const token of text.split(/\s+/)) {
      if (!token || token === '|') continue;
      const [name, value, scale = '1'] = token.split('/');
      const length = Number(value);
      if (name !== 'r')
        write(t, (/^\d+$/.test(name) ? Number(name) : midi(name)) + shift, length * legato, +scale);
      t += length;
    }
  };
  /** Calls `write` for each bar from `from` up to `to`. */
  const each = (from: number, to: number, write: (at: number, bar: number) => void) => {
    for (let at = from; at < to; at += 4) write(at, at / 4);
  };

  // ---- The band, built from the town's voices ------------------------------------------------
  // The bass drum's and the tuba's levels; the brass is written against them.
  const KICK = 0.076,
    TUBA = 0.094;
  /**
   * A brass player: the bowed saws for the section's buzz (their filter opens as the note
   * swells), the old lead voice under them for the lips' attack, and on accents (`bite`) a quick
   * FM bark. An inner or low voice may go without the saws (`buzz`): the lead voice's odd
   * harmonics carry it while it lasts. The saws are the dearest voice to render, so they go only
   * where a line needs to be heard as brass: the lead trumpet, the shout's top, the long lines.
   */
  const horn = (
    score: Score,
    at: number,
    pitch: number,
    length: number,
    gain: number,
    pan: number,
    bite = 0,
    buzz = true,
  ) => {
    if (buzz) score.note(at, pitch, length, 'strings', gain, pan);
    score.note(at, pitch, length, 'lead', gain * (buzz ? 0.45 : 0.8), pan);
    if (bite) score.note(at, pitch, Math.min(length, 0.25), 'keys', gain * bite, pan);
  };
  /**
   * The tuba: a round fingered bass, with the saws at the same pitch for its brassy growl on the
   * notes it leans on (`growl`).
   */
  const tuba = (
    at: number,
    pitch: number,
    length: number,
    gain: number,
    score = band,
    growl = true,
  ) => {
    score.note(at, pitch, length, 'fingerbass', gain, 0.05);
    if (growl) score.note(at, pitch, length, 'strings', gain * 0.42, 0.05);
  };
  /** The glockenspiel: the old pixel bell's strike, over the music box's ring unless `dry`. */
  const glock = (
    score: Score,
    at: number,
    pitch: number,
    gain: number,
    pan: number,
    dry = false,
  ) => {
    score.note(at, pitch, 0.5, 'bell', gain * 0.5, pan);
    if (!dry) score.note(at, pitch, 1.5, 'musicbox', gain, pan);
  };

  // Trumpets left of centre, trombones right, the tuba in the middle.
  const TRUMPET = 0.1;
  /**
   * The trumpets on a tune: the lead, barking `bite` on each note, and on longer notes the second
   * a third or so under it, an inner voice without the saws.
   */
  const trumpets =
    (gain = TRUMPET, second = true, bite = 0.22): Writer =>
    (t, p, length, scale) => {
      horn(band, t, p, length, gain * scale, -0.2, bite, length >= 0.3);
      if (!second || length < 0.85) return;
      const harmony = under(p, t, 3).find((q) => p - q >= 3 && p - q <= 5) ?? p - 5;
      horn(band, t + 0.01, harmony, length, gain * 0.55 * scale, -0.32, 0, false);
    };
  /** The trombones doubling a line an octave down. */
  const trombones =
    (gain: number): Writer =>
    (t, p, length, scale) =>
      horn(band, t, p - 12, length, gain * scale, 0.28, 0, false);
  /**
   * The trombones' short chord on a beat, the "pah" after the tuba's "oom", on the old lead voice
   * as the Bandstand's brass plays it.
   */
  const pah = (at: number, gain: number) =>
    shapeAt(at)
      .slice(0, 3)
      .forEach((p, i) => band.note(at + i * 0.008, p, 0.3, 'lead', gain * 0.95, 0.3));

  // ---- The tuba's lines -----------------------------------------------------------------------
  // 'degree/beats' tokens (1, 3, 5, 6, b7, 8 of the chord sounding; 'a' steps into the next bar's
  // root from the key's note under it, 'c' from a half step under; 'r' rests; a third field
  // scales the gain), each held `legato` of its value.
  const tubaLine = (at: number, text: string, gain: number, legato = 0.7) => {
    let t = at;
    for (const token of text.split(/\s+/)) {
      if (!token || token === '|') continue;
      const [name, value, scale = '1'] = token.split('/');
      const length = Number(value);
      if (name !== 'r') {
        const next = Math.floor(t / 4) * 4 + 4;
        const pitch =
          name === 'a'
            ? neighbour(rootAt(next), -1, next)
            : name === 'c'
              ? rootAt(next) - 1
              : degree(name, t);
        tuba(t, pitch, length * legato, gain * +scale, band, t % 4 === 0 || length >= 1);
      }
      t += length;
    }
  };
  const STRUT = '1/.75 1/.25/.6 r/1 5/.75 5/.25/.6 8/.5/.8 a/.5/.85';
  const MARCH = '1/.75 1/.25/.6 r/.5 1/.5/.7 5/.75 5/.25/.6 8/.5/.8 a/.5/.85';
  const DRIVE = '1/.5 1/.25/.6 r/.25 5/.5/.8 1/.5/.9 8/.5/.8 5/.25/.7 r/.25 3/.5/.8 a/.5/.85';
  // Alone in the solo, the tuba plays out a little, and it leads the join; in the routine it sits
  // back into the band.
  each(0, 24, (at) => tubaLine(at, at < 16 ? STRUT : MARCH, at < 16 ? TUBA * 1.15 : TUBA * 1.1));
  each(24, 40, (at) => tubaLine(at, DRIVE, TUBA * 1.1));
  each(CLAP, GROOVE, (at) => tubaLine(at, DRIVE, TUBA));
  // The groove: the tuba's own riff, bouncing up the chord to its blue seventh and back.
  each(GROOVE, WAVE, (at) =>
    tubaLine(
      at,
      at < WAVE - 4
        ? '1/.5 r/.25 1/.25/.7 3/.5/.85 5/.25/.8 6/.25/.8 b7/.5/.9 6/.25/.75 5/.25/.75 3/.5/.8 a/.5/.85'
        : '1/.5 r/.25 1/.25/.7 3/.5/.85 5/.5/.85 b7/.5/.9 8/.25/.8 b7/.25/.75 5/.5/.8 c/.5/.9',
      TUBA * 1.05,
      0.62,
    ),
  );
  // The wave sways: the root, then the fifth.
  each(WAVE, SPIN, (at) => tubaLine(at, '1/2 5/2/.85', TUBA, 0.95));
  each(SPIN, JUMP, (at) => tubaLine(at, DRIVE, TUBA));
  each(RIPPLE, BUILD, (at) => tubaLine(at, DRIVE, TUBA * 1.04));
  // The build: eighths, root and octave; in the last bar the landings (below) take the roots and
  // the tuba bounces up an octave between them, stopping for the breath.
  each(BUILD, HIT - 4, (at) =>
    tubaLine(at, '1/.5 1/.5/.7 8/.5/.8 1/.5/.7 1/.5 1/.5/.7 8/.5/.8 5/.5/.8', TUBA * 1.05, 0.75),
  );
  tubaLine(HIT - 4, 'r/.5 8/.5/.8 r/.5 8/.5/.85 r/.5 8/.5/.9 r/1', TUBA * 1.05, 0.75);

  // ---- Drums ----------------------------------------------------------------------------------
  /** The bass drum: a big felt beater, tuned low (to the key's fifth in the finale). */
  const drum = (at: number, gain = 1, pitch = at >= RIPPLE ? 38 : 36) =>
    kit.note(at, pitch, 0.5, 'softkick', KICK * gain);
  /** The little cymbal on the bass drum, tapped on the off-beats. */
  const tink = (at: number, gain = 1) => kit.note(at, 72, 0.1, 'hat', 0.022 * gain, -0.25);
  /** The marching snare: the old snare's crack over a brush's wires. */
  const snare = (at: number, gain = 1) => {
    kit.note(at, 60, 0.1, 'snare', 0.075 * gain, 0.15);
    kit.note(at, 62, 0.2, 'brush', 0.13 * gain, 0.15);
  };
  const ghost = (at: number, gain = 1) => kit.note(at, 60, 0.08, 'snare', 0.018 * gain, 0.15);
  /**
   * The snare's street beat, a step a sixteenth from `at`: 'x' a stroke, 'o' a softer one, '-' a
   * ghost; the off sixteenths a little late, for the strut (the beats stay on the grid).
   */
  const street = (at: number, pattern: string, gain = 1) =>
    [...pattern].forEach((symbol, i) => {
      const t = at + i * 0.25 + (i % 2 ? 0.03 : 0);
      if (symbol === 'x') snare(t, gain);
      else if (symbol === 'o') snare(t, 0.6 * gain);
      else if (symbol === '-') ghost(t, gain);
    });
  /** A snare roll from `from` up to `to`, `step` apart, growing from `low` to `high`. */
  const roll = (from: number, to: number, low: number, high: number, step = 0.125) => {
    const count = Math.round((to - from) / step);
    for (let i = 0; i < count; i++)
      kit.note(from + i * step, 60, 0.1, 'snare', low + ((high - low) * i) / count, 0.15);
  };
  /** A cymbal clash: two rides at once, either side. */
  const crash = (at: number, gain = 1) => {
    kit.note(at, 66, 4, 'ride', 0.1 * gain, -0.35);
    kit.note(at, 71, 4, 'ride', 0.08 * gain, 0.35);
  };
  /** A hand clap: four brush taps 0–20 ms apart across the stereo field, and a little snare. */
  const HANDS = [
    [0, 63, 0.6, -0.32],
    [0.012, 66, 0.8, 0.3],
    [0.026, 61, 0.65, -0.1],
    [0.04, 65, 1, 0.14],
  ] as const;
  const clap = (at: number, gain: number, width = 1) => {
    for (const [offset, pitch, share, pan] of HANDS)
      kit.note(at + offset, pitch, 0.25, 'brush', 0.15 * gain * share, pan * width);
    kit.note(at + 0.02, 61, 0.12, 'snare', 0.024 * gain);
  };

  // Solo: the bass drum's strut and its cymbal on the off-beats; rim clicks on two and four.
  each(0, 16, (at) => {
    kit.hits(at, 'x.....o.x.......', 'softkick', KICK * 0.8, { pitch: 36, length: 0.5 });
    kit.hits(at, '....x.......x...', 'rim', 0.075, { pan: 0.15 });
    for (const off of [0.5, 1.5, 2.5, 3.5]) tink(at + off, off === 1.5 ? 0.7 : 1);
  });
  kit.hits(12, '..............xo', 'rim', 0.075, { pan: 0.15 });
  // Join: the snare's street beat with the first joiner, the trombones (below) with the fifth,
  // and with the ninth the bass drum on every beat and claps on two and four.
  const STREET = '..-.x..-..-.x.-o';
  each(16, 32, (at) => {
    kit.hits(at, 'x.....o.x.....o.', 'softkick', KICK * 0.92, { pitch: 36, length: 0.5 });
    street(at, STREET, 0.9);
    for (const off of [0.5, 1.5, 2.5, 3.5]) tink(at + off);
  });
  each(32, 40, (at) => {
    for (let b = 0; b < 4; b++) drum(at + b, b % 2 ? 0.75 : 0.9);
    clap(at + 1, 0.75);
    clap(at + 3, 0.8);
    street(at, at < 36 ? STREET : '..-.x..-........', 0.9);
  });
  // A snare roll into the routine, leaving the downbeat clear for the crash.
  roll(38, 39.875, 0.012, 0.06);
  // The routine: the bass drum on every beat (half time in the wave); the clap phrase claps on
  // every beat, after it two and four; the snare's street beat all through, down to its ghosts in
  // the clap phrase.
  each(CLAP, JUMP, (at) => {
    const wave = at >= WAVE && at < SPIN,
      groove = at >= GROOVE && at < WAVE;
    if (wave) {
      drum(at, 0.95);
      drum(at + 2, 0.7);
      clap(at + 2, 0.9);
      snare(at + 2, 0.7);
      kit.hits(at, 'x.o.x.o.', 'ride', 0.036, { step: 0.5, pan: -0.1, pitch: 64 });
      kit.note(at, 60, 3.8, 'swish', 0.05, 0.2);
      return;
    }
    if (groove)
      kit.hits(at, at % 8 ? 'x..x..x.x.....x.' : 'x.....x.x..o..x.', 'softkick', KICK, {
        pitch: 36,
        length: 0.5,
      });
    else for (let b = 0; b < 4; b++) drum(at + b, b % 2 ? 0.8 : 1);
    if (at < POINT) for (let b = 0; b < 4; b++) clap(at + b, b % 2 ? 1.2 : 0.85);
    else {
      clap(at + 1, 0.95);
      clap(at + 3, 1);
    }
    street(at, groove ? '-..-x.-..-.-x.-o' : at < POINT ? '..-.....-.-.....' : STREET);
    if (groove) for (const off of [0.5, 1.5, 2.5, 3.5]) tink(at + off);
  });
  for (const at of [CLAP, POINT, GROOVE, SPIN]) crash(at, at === CLAP ? 1 : 0.8);
  crash(WAVE, 0.6);

  // ---- The dancers joining: a glockenspiel note as each one leaves the crowd, up the bells ------
  // Written for a full mob of twelve; with fewer dancers the later notes ring out over the ones
  // already in place.
  'F5 G5 A5 C6 D6 F6 G6 A6 C7 D7 F7'
    .split(' ')
    .forEach((name, k) =>
      glock(kit, C.join + 2 * k, midi(name), 0.07 + 0.002 * k, k % 2 ? 0.3 : -0.3),
    );

  // ---- The trombones on two and four, from the fifth joiner ------------------------------------
  each(24, POINT, (at) => {
    pah(at + 1, 0.041);
    pah(at + 3, 0.043);
  });

  // ---- The swell into the routine: the whole band, growing, and the trumpets' pickup ------------
  // A swell is the saws alone, their filter opening as the chord grows: no lips' attack.
  const swell = (at: number, length: number, gain: number, pad = 0) =>
    shapeAt(at).forEach((p, i) => {
      if (pad) band.note(at, p, length, 'glow', pad, (i - 1.5) * 0.2);
      band.note(at, p, length, 'strings', gain, (i - 1.5) * 0.2);
    });
  swell(32, 3.9, 0.034, 0.018);
  swell(36, 1.9, 0.039, 0.022);
  swell(38, 1.5, 0.048, 0.026);
  phrase(38, 'r/.5 C5/.5 D5/.5 E5/.5', trumpets(TRUMPET * 0.85, false));

  // ---- The tune --------------------------------------------------------------------------------
  const TUNE = [
    'F5/.75 G5/.25 A5/.5 C6/.5 r/.5 A5/.5 C6/1',
    'D6/.75 C6/.25 A5/.5 F5/.5 r/.5 D5/.5 F5/1',
    'G5/.75 A5/.25 Bb5/.5 D6/.5 F6/.5 D6/.5 Bb5/.5 G5/.5',
    'A5/.5 G5/.5 E5/.5 C5/.5 E5/.5 G5/.5 Bb5/1',
  ].join(' | ');
  // Under the clap phrase the trumpets bark a little less, leaving the claps' crack clear; the
  // bells double the tune an octave up.
  phrase(CLAP, TUNE, trumpets(TRUMPET, true, 0.14));
  phrase(CLAP, TUNE, (t, p, _, scale) => glock(band, t, p + 12, 0.018 * scale, 0.35, true));

  // Point: the shout chorus, a stab on every beat thrown to screen-left on even beats and right on
  // odd ones; three trumpets on the line and the chord close under it, two trombones below.
  const SHOUT = ['C6 C6 A5 D6', 'C#6 C#6 A5 E6', 'D6 D6 A5 F6', 'D6 B5 C6 E6'];
  each(POINT, GROOVE, (at, bar) => {
    pitches(SHOUT[bar - POINT / 4]).forEach((top, b) => {
      const beat = at + b,
        side = (beat - POINT) % 2 ? 1 : -1;
      const tones = under(top, beat, 5);
      [top, tones[0], tones[1]].forEach((p, i) =>
        horn(kit, beat, p, 0.28, 0.075 * (i ? 0.75 : 1), side * 0.7, i ? 0 : 0.35, !i),
      );
      tones.slice(2, 4).forEach((p) => horn(kit, beat, p - 12, 0.28, 0.066, side * 0.5, 0, false));
    });
  });

  // Groove: the trumpets call at the top of each bar, the trombones answer low on its back half.
  const CALLS = [
    'F5/.25 G5/.25 Bb5/.5 D6/.5 r/2.5',
    'A5/.25 C6/.25 D6/.5 C6/.5 r/2.5',
    'F5/.25 G5/.25 Bb5/.5 D6/.5 r/2.5',
    'G5/.25 Bb5/.25 C6/.5 E6/.5 r/2.5',
  ].join(' | ');
  const ANSWERS = [
    'r/2.5 F4/.25 Ab4/.25 Bb4/.5 r/.5',
    'r/2.5 C4/.25 Eb4/.25 F4/.5 r/.5',
    'r/2.5 F4/.25 Ab4/.25 Bb4/.5 r/.5',
    'r/2 Bb4/.5 G4/.5 E4/.5 C4/.5',
  ].join(' | ');
  phrase(GROOVE, CALLS, trumpets(TRUMPET, false), { legato: 0.75 });
  phrase(GROOVE, ANSWERS, (t, p, length, scale) => horn(band, t, p, length, 0.088 * scale, 0.28), {
    legato: 0.75,
  });

  // Wave: the band's chord blooms a player at a time, half a beat apart from left to right, and
  // holds through the sway, a bell with each player and the bells going on up the chord to the
  // right-hand end; a long horn line over it.
  each(WAVE, SPIN, (at) => {
    const shape = shapeAt(at);
    shape.forEach((p, i) =>
      band.note(at + i * 0.5, p, 3.85 - i * 0.5, 'strings', 0.057, -0.85 + 0.567 * i),
    );
    [...shape, shape[2] + 12, shape[3] + 12].forEach((p, i) =>
      glock(band, at + i * 0.5, p + 24, 0.05, -0.85 + 0.34 * i),
    );
  });
  phrase(
    WAVE,
    'A5/3 G5/1 | F5/3 D5/1 | Bb5/2 A5/1 G5/1 | G5/2 E5/2',
    (t, p, length, scale) => horn(band, t, p, length, 0.094 * scale, 0),
    { legato: 0.97 },
  );

  // Spin: bells whirling round the square once a bar, a four-note turn on every beat (up the
  // chord, and back down on the last), with the tune again.
  each(SPIN, JUMP, (at) => {
    for (let i = 0; i < 16; i++) {
      const beat = at + i / 4;
      const shape = shapeAt(beat);
      const tones = [...shape.map((p) => p + 12), ...shape.map((p) => p + 24)];
      const pick = [0, 1, 2, 3, 2, 3, 4, 5, 4, 5, 6, 7, 6, 5, 4, 3][i];
      const pan = Math.sin((i / 16) * 2 * Math.PI) * 0.85;
      glock(band, beat, tones[pick], i % 4 ? 0.031 : 0.047, pan, i % 4 !== 0);
    }
  });
  phrase(SPIN, TUNE, trumpets());

  // Jump: a big hit and a cymbal on every landing (every other beat, then every beat of the last
  // bar), the trombones springing into each.
  const landing = (beat: number, top: number, gain = 1, cymbal = 0.8) => {
    drum(beat, 1.15 * gain);
    kit.note(beat, 36, 0.3, 'kick', 0.09 * gain);
    snare(beat, 1.1 * gain);
    clap(beat, 0.95 * gain, 1.2);
    if (cymbal) crash(beat, cymbal * gain);
    // Short in the last bar, so the breath before the hit stays clear.
    const hold = beat >= HIT - 4 ? 0.4 : 0.55;
    // On a landing the tuba and trombones go without the saws, which keeps the render light; the
    // drums and the cymbal give the landing its edge.
    tuba(beat, rootAt(beat), hold, TUBA * 1.15 * gain, kit, false);
    const tones = under(top, beat, 4);
    [top, tones[0], tones[1]].forEach((p, i) =>
      horn(kit, beat, p, hold, 0.077 * gain * (i ? 0.75 : 1), -0.25 + 0.12 * i, i ? 0 : 0.35, !i),
    );
    tones
      .slice(2)
      .forEach((p, i) => horn(kit, beat, p - 12, hold, 0.048 * gain, 0.35 - 0.1 * i, 0, false));
    glock(kit, beat, top + 12, 0.035 * gain, 0.35, true);
  };
  const LANDINGS: [offset: number, top: string][] = [
    [0, 'D6'],
    [2, 'Bb5'],
    [4, 'E6'],
    [6, 'C6'],
    [8, 'E6'],
    [10, 'C6'],
    [12, 'F#5'],
    [13, 'A5'],
    [14, 'C6'],
    [15, 'D6'],
  ];
  for (const [offset, top] of LANDINGS) {
    const beat = JUMP + offset;
    landing(
      beat,
      midi(top),
      offset >= 12 ? 0.82 + 0.06 * (offset - 12) : 1,
      offset >= 12 ? (offset === 12 ? 0.6 : 0) : offset % 4 ? 0.55 : 0.85,
    );
    if (offset < 12) {
      // The springboard: two trombone notes into the next landing, and the bass drum's ghost.
      const next = under(midi(LANDINGS[(offset >> 1) + 1][1]), beat + 2, 4);
      horn(band, beat + 1.5, next[3] - 12, 0.2, 0.06, 0.3, 0, false);
      horn(band, beat + 1.75, next[2] - 12, 0.2, 0.066, 0.3, 0, false);
      ghost(beat + 1, 1.5);
      ghost(beat + 1.5, 1.2);
    }
  }
  // The lift: a snare roll growing under the last landings, into G.
  roll(134, 136, 0.016, 0.07);

  // ---- Finale ---------------------------------------------------------------------------------
  // The ripple: the tune up a tone, the trombones under it, and the bells rippling across the
  // square and back in every bar.
  each(RIPPLE, BUILD, (at) => {
    for (let b = 0; b < 4; b++) drum(at + b, b % 2 ? 0.85 : 1.05);
    clap(at + 1, 1.05);
    clap(at + 3, 1.1);
    street(at, '..-.x.-...-.x.-o');
    pah(at + 1, 0.034);
    pah(at + 3, 0.036);
    const shape = shapeAt(at);
    const run = [...shape.map((p) => p + 12), ...shape.map((p) => p + 24)];
    run.forEach((p, i) => {
      kit.note(at + i * 0.25, p, 1, 'musicbox', 0.038 * (0.8 + 0.04 * i), -0.8 + 0.23 * i);
      glock(kit, at + 2 + i * 0.25, run[7 - i], 0.044 * (0.8 + 0.04 * i), 0.8 - 0.23 * i, true);
    });
  });
  crash(RIPPLE, 1.1);
  phrase(RIPPLE, TUNE, trumpets(TRUMPET * 1.04), { shift: 2 });
  phrase(RIPPLE, TUNE, trombones(0.04), { shift: 2 });

  // The build: landings on every other beat, then the band driving eighths over the claps, then a
  // landing on every beat; the claps go from every beat to every half, then every quarter, over a
  // snare roll, and stop for a breath.
  const BUILD_LANDINGS: [beat: number, top: string][] = [
    [152, 'E6'],
    [154, 'G5'],
    [156, 'F#6'],
    [158, 'A5'],
    [164, 'C6'],
    [165, 'E6'],
    [166, 'D6'],
    [167, 'F#6'],
  ];
  BUILD_LANDINGS.forEach(([beat, top], i) =>
    landing(beat, midi(top), 0.85 + 0.03 * i, beat === BUILD ? 1 : 0),
  );
  const landed = new Set(BUILD_LANDINGS.map(([beat]) => beat));
  for (let beat = BUILD; beat < 160; beat++) if (!landed.has(beat)) clap(beat, 0.85);
  for (let beat = 160; beat < 164; beat += 0.5) clap(beat, 0.85 + 0.02 * (beat - 160));
  for (let beat = 164; beat < 167.5; beat += 0.25)
    if (!landed.has(beat)) clap(beat, 0.75 + 0.04 * (beat - 164));
  each(BUILD, 160, (at) => {
    for (let b = 0; b < 4; b++) if (!landed.has(at + b)) drum(at + b, 0.95);
    street(at, '..-.o...-.-.o...');
  });
  each(160, 164, (at) => {
    for (let b = 0; b < 4; b++) drum(at + b, 1);
    street(at, 'o.o.x.o.o.o.x.o.');
  });
  roll(164, 167.5, 0.02, 0.07, 0.25);
  // Between the first landings the trumpets spring up to the next; then they drive eighths.
  phrase(153, 'r/.5 G5/.25 A5/.25 r/1.5 A5/.25 B5/.25 r/.5', trumpets(TRUMPET * 0.9, false));
  phrase(157, 'r/.5 A5/.25 B5/.25 r/1.5 B5/.25 C#6/.25', trumpets(TRUMPET * 0.9, false));
  phrase(
    160,
    'D6/.5 D6/.5/.8 D6/.5/.9 F#6/.5 E6/.5 E6/.5/.85 E6/.5/.95 G6/.5',
    trumpets(TRUMPET * 0.95, false),
    { legato: 0.7 },
  );
  phrase(160, 'B3/.5 D4/.5 F#4/.5 B4/.5 E4/.5 G4/.5 B4/.5 D5/.5', (t, p, length, scale) =>
    horn(band, t, p, length, 0.066 * scale, 0.28, 0, false),
  );
  swell(160, 1.9, 0.035);
  swell(162, 1.9, 0.04);
  // Under the last landings the band holds on and swells, up to the breath.
  swell(164, 1.9, 0.043);
  swell(166, 1.45, 0.049);
  crash(160, 0.6);

  // ---- The hit: everyone at once on beat 168, short; then nothing ------------------------------
  drum(HIT, 1.5, 31);
  kit.note(HIT, 36, 0.3, 'kick', 0.12);
  snare(HIT, 1.3);
  clap(HIT, 1.3, 1.3);
  crash(HIT, 1.3);
  tuba(HIT, midi('G1'), 1, TUBA * 1.35, kit);
  tuba(HIT, midi('G2'), 1, TUBA * 0.75, kit);
  pitches('G3 B3 D4 G4').forEach((p, i) => horn(kit, HIT, p, 1, 0.072, 0.1 + 0.08 * i));
  pitches('G4 B4 D5 G5').forEach((p, i) => horn(kit, HIT, p, 1, 0.072, -0.3 + 0.1 * i, 0.3));
  horn(kit, HIT, midi('B5'), 1, 0.064, -0.15, 0.3);
  kit.chord(HIT, pitches('G6 B6 D7'), 1, 'vibes', 0.05, { spread: 0.3, pan: 0.3 });
  kit.note(HIT, midi('G6'), 0.5, 'bell', 0.03, 0.35);

  return [...band.done(), ...kit.done()].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
}
