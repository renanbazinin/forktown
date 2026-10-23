// "Nothing to See Here": the flash mob's music at Fountain Square (src/lib/square.ts), on the
// stroke of five on every even date. It is not a loop like the town's tunes: it plays once, in
// step with the town clock (flash-mob-player.ts), and its sections are the dance's, beat for beat
// (src/lib/flash-mob-beat.ts, two beats to a town minute):
//
//   0–16    solo    one dancer alone: a felt kick, finger snaps, a fingered bass
//   16–40   join    a music-box note as each dancer leaves the crowd (beat 16 + 2(k − 1)), and a
//                   layer every two bars: offbeat electric piano and shaker (16), a marimba (24),
//                   claps, the kick on every beat and the strings' swell (32)
//   40–56   clap    the tune on flute, the whole mob clapping every beat
//   56–72   point   its answer, and a stab on every point: screen-left on even beats, right on odd
//   72–88   groove  side steps over an octave-bouncing bass, the flute calling, the marimba answering
//   88–104  wave    long lines at half time, a harp sweeping up across each bar, left to right
//   104–120 spin    a marimba whirling round once a bar (a quarter a beat), the tune again
//   120–136 jump    a big hit on every landing: even beats, then every beat of the last bar
//   136–168 finale  a lift up a tone into A, a ripple of harp and choir, then everyone clapping
//                   faster and faster, and a breath (167.5–168)
//   168     the hit one chord from everyone at once, then nothing: the pose held in silence
//
// Written in G (the town's tune at 17:00, "Sun on the Shutters", is in G too, and is ducked under
// it) and lifted to A for the finale. Nothing sounds after beat 168 but that chord's decay, so
// the render's loop wrap brings nothing round to the start. There is no clap voice: a clap is four
// brush taps 0–23 ms apart, spread across the stereo field like hands across the square, with a
// whisper of snare. The render worker reaches this file through score.ts, so it imports nothing
// but the kit and the beat. No Math.random or Date.
import { midi, Score, type Note, type TuneInfo } from './tunes/kit';
import { FLASH_MOB_BPM, FLASH_MOB_CUES, FLASH_MOB_TRACK_BEATS } from '../lib/flash-mob-beat';

export const FLASH_MOB_TRACK: TuneInfo = {
  title: 'Nothing to See Here',
  subtitle: 'Fountain Square, on the stroke of five',
  bpm: FLASH_MOB_BPM,
  beats: FLASH_MOB_TRACK_BEATS,
  bar: 4,
  hall: { wet: 0.2, size: 0.5, damp: 0.5 },
  // Measured over the whole track, the sparse solo and the silent end with it, so the routine
  // itself sits at the Bandstand's and the day's tunes' level.
  loudness: 0.048,
  instruments:
    'Flute, marimba, electric piano, fingered bass, strings, harp, choir, music box, felt kick, hand claps, shaker',
};

const PHRASE = 16;
const C = FLASH_MOB_CUES;
const CLAP = C.routine,
  POINT = CLAP + PHRASE,
  GROOVE = POINT + PHRASE,
  WAVE = GROOVE + PHRASE,
  SPIN = WAVE + PHRASE,
  JUMP = SPIN + PHRASE,
  BUILD = C.finale + PHRASE;

// A bar's chord ('X|Y' halves it), one a bar from 17:00; the finale is in A.
const HARMONY = [
  ...['G', 'Em7', 'Cmaj7', 'D'], // solo
  ...['G', 'Em7', 'Cmaj7', 'D', 'Am7', 'D7sus4|D7'], // join
  ...['G', 'Em7', 'Cmaj7', 'D'], // clap
  ...['G', 'Em7', 'Cmaj7', 'D'], // point
  ...['Cmaj7', 'D', 'Bm7', 'Em7'], // groove
  ...['Am7', 'Bm7', 'Cmaj7', 'D7sus4|D7'], // wave
  ...['G', 'Em7', 'Cmaj7', 'D'], // spin
  ...['Cmaj7', 'D', 'Bm7', 'E7sus4|E7'], // jump, and the lift
  ...['A', 'F#m7', 'Dmaj7', 'E'], // finale: the ripple
  ...['Dmaj7', 'E', 'C#m7|F#m7', 'Bm7|E7'], // finale: the build
];
// Each chord in the middle of the keyboard, for the electric piano, strings and arpeggios.
const SHAPES: Record<string, string> = {
  G: 'G3 B3 D4 G4',
  Em7: 'G3 B3 D4 E4',
  Cmaj7: 'G3 B3 C4 E4',
  D: 'F#3 A3 D4 F#4',
  Am7: 'G3 A3 C4 E4',
  D7sus4: 'G3 A3 C4 D4',
  D7: 'F#3 A3 C4 D4',
  Bm7: 'F#3 A3 B3 D4',
  E7sus4: 'E3 A3 B3 D4',
  E7: 'E3 G#3 B3 D4',
  A: 'A3 C#4 E4 A4',
  'F#m7': 'A3 C#4 E4 F#4',
  Dmaj7: 'A3 C#4 D4 F#4',
  E: 'G#3 B3 E4 G#4',
  'C#m7': 'G#3 B3 C#4 E4',
};
const pitches = (names: string) => names.split(' ').map(midi);
/** The chord sounding at a beat. */
function chordAt(beat: number) {
  const bar = Math.floor(beat / 4);
  const parts = (HARMONY[bar] ?? 'A').split('|');
  return parts[Math.min(parts.length - 1, Math.floor(((beat - bar * 4) / 4) * parts.length))];
}
const shapeAt = (beat: number) => pitches(SHAPES[chordAt(beat)]);
/** The chord's root for the bass, A1–G#2. */
function rootAt(beat: number) {
  const root = midi(`${/^[A-G][#b]?/.exec(chordAt(beat))![0]}2`);
  return root > 44 ? root - 12 : root;
}
// G major, then A major from the lift: the bass steps into each chord from a note of the key.
const G_MAJOR = [7, 9, 11, 0, 2, 4, 6],
  A_MAJOR = [9, 11, 1, 2, 4, 6, 8];
/** The nearest note of the key at `beat` past `pitch` in `direction` (±1). */
function neighbour(pitch: number, direction: 1 | -1, beat: number) {
  const key = beat >= C.finale ? A_MAJOR : G_MAJOR;
  let p = pitch + direction;
  while (!key.includes(((p % 12) + 12) % 12)) p += direction;
  return p;
}

export function composeFlashMob(): Note[] {
  const beats = FLASH_MOB_TRACK.beats;
  // The band plays with a little human drift; the drums, the claps, the dancers' cues and the
  // final hit sit exactly on the grid the dancers move to.
  const band = new Score(beats, { timing: 0.008, loudness: 0.06 });
  const kit = new Score(beats, { timing: 0, loudness: 0.05 });

  // Writes `text` from `at`: 'pitch/beats' tokens one after another (a note name or a MIDI
  // number; 'r' rests; a third field scales the gain; '|' only marks the bars), each note held
  // `legato` of its value and moved `shift` semitones.
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
    }: { legato?: number; pan?: number; shift?: number; score?: Score } = {},
  ) => {
    let t = at;
    for (const token of text.split(/\s+/)) {
      if (!token || token === '|') continue;
      const [name, value, scale = '1'] = token.split('/');
      const length = Number(value);
      if (name !== 'r') {
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
  const kick = (at: number, gain = 1, pitch = at >= C.finale ? 40 : 38) =>
    kit.note(at, pitch, 0.5, 'softkick', 0.085 * gain);
  const shaker = (at: number, pattern: string, gain = 1) =>
    kit.hits(at, pattern, 'shaker', 0.07 * gain, { pan: 0.35 });
  const crash = (at: number, gain = 1) => kit.note(at, 64, 4, 'ride', 0.1 * gain, -0.3);

  // Solo: the felt kick on one and three, finger snaps on two and four.
  each(0, 32, (at) => {
    kick(at, 0.8);
    kick(at + 2, 0.7);
    kit.hits(at, '....x.......x...', 'rim', 0.1, { pan: 0.2 });
  });
  kit.hits(12, '..............xo', 'rim', 0.1, { pan: 0.2 });
  // Join: the shaker with the first joiner; claps with the ninth, and the kick on every beat.
  each(16, 32, (at) => shaker(at, at < 24 ? 'x.o.x.o.x.o.x.o.' : 'x-o-x-o-x-o-x-o-', 0.85));
  each(32, 40, (at) => {
    for (let b = 0; b < 4; b++) kick(at + b, b % 2 ? 0.75 : 0.9);
    clap(at + 1, 0.7);
    clap(at + 3, 0.75);
    shaker(at, 'x-o-x-o-x-o-x-o-', 0.9);
  });
  clap(39.5, 0.5);
  clap(39.75, 0.6);
  // The routine: four on the floor, and in the clap phrase claps on every beat, loudest on two
  // and four; after it, claps on two and four. The wave sways at half time.
  each(CLAP, JUMP, (at) => {
    const wave = at >= WAVE && at < SPIN;
    for (let b = 0; b < 4; b++) if (!wave || b % 2 === 0) kick(at + b, b % 2 ? 0.8 : 1);
    if (at < POINT) for (let b = 0; b < 4; b++) clap(at + b, b % 2 ? 1 : 0.62);
    else if (wave) clap(at + 2, 0.9);
    else {
      clap(at + 1, 0.95);
      clap(at + 3, 1);
    }
    if (wave) kit.hits(at, 'x.o.x.o.', 'ride', 0.05, { step: 0.5, pan: -0.3 });
    else shaker(at, at >= GROOVE && at < WAVE ? 'x-o-x-ooxx-ox-oo' : 'x-o-x-o-x-o-x-o-');
  });
  for (const at of [CLAP, POINT, GROOVE, SPIN]) crash(at, at === CLAP ? 1 : 0.8);
  crash(WAVE, 0.6);
  // A brush circling the head under each bar of the wave.
  each(WAVE, SPIN, (at) => kit.note(at, 60, 3.8, 'swish', 0.06, 0.2));

  // ---- Bass ---------------------------------------------------------------------------------
  each(0, 32, (at) => {
    const r = rootAt(at);
    const into = neighbour(rootAt(at + 4), -1, at + 4);
    play(
      at,
      `${r}/.75 r/.75 ${r}/.5 r/.5 ${r + 7}/.5 ${r + 12}/.5 ${into}/.5`,
      'fingerbass',
      0.105,
    );
  });
  // Driving eighths: the root, its octave, the fifth, and a step into the next bar.
  const drive = (at: number, gain = 0.1) => {
    const r = rootAt(at),
      late = rootAt(at + 2),
      next = rootAt(at + 4);
    const into = neighbour(next, next > late ? -1 : 1, at + 4);
    play(
      at,
      `${r}/.5 ${r}/.5/.6 ${r + 12}/.5/.8 ${r}/.5/.7 ${late + 7}/.5 ${late + 7}/.5/.6 ${late + 12}/.5/.8 ${into}/.5/.8`,
      'fingerbass',
      gain,
      { legato: 0.8 },
    );
  };
  each(32, GROOVE, (at) => drive(at));
  // The groove: an octave bounce on every eighth, up to the fifth at the end of each bar.
  each(GROOVE, WAVE, (at) => {
    const r = rootAt(at);
    play(
      at,
      `${r}/.5 ${r + 12}/.5/.75 ${r}/.5 ${r + 12}/.5/.75 ${r}/.5 ${r + 12}/.5/.75 ${r + 7}/.5/.8 ${r + 12}/.5/.85`,
      'fingerbass',
      0.105,
      { legato: 0.72 },
    );
  });
  // The wave sways: a held root, then the fifth.
  each(WAVE, SPIN, (at) =>
    play(at, `${rootAt(at)}/2 ${rootAt(at + 2) + 7}/2/.85`, 'fingerbass', 0.105),
  );
  each(SPIN, JUMP, (at) => drive(at));
  each(C.finale, BUILD, (at) => drive(at, 0.108));
  // The build: eighths on the root, climbing an octave in the last bar, which stops for a breath.
  each(BUILD, C.freeze, (at) => {
    const r = rootAt(at),
      late = rootAt(at + 2);
    play(
      at,
      at === C.freeze - 4
        ? `${r}/.5 ${r}/.5 ${r + 12}/.5 ${r + 12}/.5 ${late}/.5 ${late + 7}/.5 ${late + 12}/.5 r/.5`
        : `${r}/.5 ${r}/.5/.7 ${r + 12}/.5/.8 ${r}/.5/.7 ${late}/.5 ${late}/.5/.7 ${late + 12}/.5/.8 ${late}/.5/.7`,
      'fingerbass',
      0.11,
      { legato: 0.8 },
    );
  });

  // ---- Electric piano -------------------------------------------------------------------------
  // The solo's one soft chord a bar; offbeat chops from the first joiner.
  each(0, 16, (at) =>
    band.chord(at, shapeAt(at), 0.9, 'epiano', 0.024, { strum: 0.02, spread: 0.3 }),
  );
  const chops = (at: number, gain = 0.033) => {
    for (const off of [0.5, 1.5, 2.5, 3.5]) {
      const beat = at + off;
      if (beat >= C.freeze - 0.5) continue;
      band.chord(beat, shapeAt(beat), 0.32, 'epiano', gain * (off % 2 === 1.5 ? 1 : 0.8), {
        spread: 0.3,
        pan: -0.1,
      });
    }
  };
  each(16, POINT, (at) => chops(at, at < 32 ? 0.03 : 0.033));
  each(GROOVE, WAVE, (at) => chops(at));
  each(SPIN, JUMP, (at) => chops(at, 0.03));
  each(C.finale, C.freeze, (at) => chops(at, 0.031));

  // ---- The dancers joining: a music-box note as each one leaves the crowd, up the scale -------
  // Written for a full mob of twelve, which the town has had on every even date so far; with
  // fewer dancers the later notes ring out over the dancers already in place.
  'G4 A4 B4 D5 E5 G5 A5 B5 D6 E6 G6'
    .split(' ')
    .forEach((name, k) =>
      kit.note(C.join + 2 * k, midi(name), 1.5, 'musicbox', 0.075, k % 2 ? 0.3 : -0.3),
    );

  // ---- Marimba ostinato: from the third bar of the join through the clap phrase ----------------
  const ostinato = (at: number, gain: number) =>
    [0, 2, 1, 2, 0, 3, 1, 2].forEach((pick, i) => {
      const beat = at + i / 2;
      band.note(beat, shapeAt(beat)[pick] + 12, 0.4, 'marimba', gain * (i % 2 ? 0.8 : 1), -0.35);
    });
  each(24, POINT, (at) => ostinato(at, at < CLAP ? 0.05 : 0.04));
  each(C.finale, BUILD, (at) => ostinato(at, 0.035));

  // ---- Strings: the swell into the routine ----------------------------------------------------
  play(32, 'E4/4/.7 | D4/2/.85 D4/1.5/1 r/.5', 'strings', 0.05, { legato: 1 });
  play(32, 'C5/4/.7 | C5/2/.85 C5/1.5/1 r/.5', 'strings', 0.05, { legato: 1 });

  // ---- The tune -------------------------------------------------------------------------------
  const HOOK = [
    'B4/.5 D5/.5 G5/1 F#5/.5 G5/.5 A5/1',
    'B5/1.5 A5/.5 G5/1 E5/1',
    'r/.5 E5/.5 G5/.5 E5/.5 C6/1 B5/.5 A5/.5',
    'A5/1.5 G5/.5 F#5/1 r/1',
  ].join(' | ');
  const ANSWER = [
    'B4/.5 D5/.5 G5/1 F#5/.5 G5/.5 A5/1',
    'B5/1 D6/1 B5/.5 A5/.5 G5/1',
    'r/.5 E5/.5 G5/.5 C6/.5 E6/1 D6/.5 C6/.5',
    'B5/1 A5/.5 G5/.5 A5/1.5 r/.5',
  ].join(' | ');
  const FLUTE = 0.074;
  // A pickup into the routine, stepping down to the tune's first note.
  play(38, 'r/1 D5/.5 C5/.25 A4/.25', 'flute', FLUTE * 0.85, { pan: 0.1 });
  play(CLAP, HOOK, 'flute', FLUTE, { pan: 0.1 });
  play(CLAP, HOOK, 'vibes', 0.038, { pan: -0.2 });
  play(POINT, ANSWER, 'flute', FLUTE, { pan: 0.1 });

  // Point: a stab on every beat, thrown to screen-left on even beats and right on odd ones.
  each(POINT, GROOVE, (at) => {
    for (let b = 0; b < 4; b++) {
      const beat = at + b,
        side = (beat - POINT) % 2 ? 1 : -1,
        shape = shapeAt(beat);
      kit.chord(beat, shape, 0.28, 'epiano', 0.04, { pan: side * 0.35 });
      kit.chord(
        beat,
        shape.slice(1).map((p) => p + 12),
        0.3,
        'strings',
        0.042,
        { pan: side * 0.55 },
      );
      kit.note(beat, shape[3] + 12, 0.3, 'marimba', 0.05, side * 0.7);
    }
  });

  // Groove: the flute calls, the marimba answers.
  const CALLS = [
    'G5/.5 E5/.5 G5/.5 A5/.5 r/2',
    'A5/.5 F#5/.5 A5/.5 B5/.5 r/2',
    'B5/.5 A5/.5 F#5/.5 D5/.5 F#5/1 A5/1',
    'G5/1.5 F#5/.5 E5/1 r/1',
  ].join(' | ');
  play(GROOVE, CALLS, 'flute', FLUTE, { pan: 0.1 });
  play(GROOVE + 2, 'C6/.5 B5/.5 G5/1', 'marimba', 0.06, { pan: -0.35 });
  play(GROOVE + 6, 'D6/.5 C6/.5 A5/1', 'marimba', 0.06, { pan: -0.35 });
  play(GROOVE + 15, 'B5/.25 D6/.25 E6/.5', 'marimba', 0.05, { pan: -0.35 });

  // Wave: long lines over strings, and a harp sweeping up across each bar, left to right.
  play(WAVE, 'E5/3 G5/1 | F#5/3 A5/1 | G5/2 B5/2 | A5/2 G5/1 F#5/1', 'flute', FLUTE * 0.95, {
    legato: 0.97,
    pan: 0.1,
  });
  play(WAVE, 'C5/4 | D5/4 | E5/4 | D5/2 C5/2', 'strings', 0.05, { legato: 1 });
  play(WAVE, 'A4/4 | B4/4 | C5/4 | A4/4', 'strings', 0.045, { legato: 1 });
  /** Eight harp notes in sixteenths up (or down) two octaves of the chord, crossing the field. */
  const sweep = (at: number, up: boolean, gain: number) => {
    const shape = shapeAt(at);
    const run = [...shape.map((p) => p + 12), ...shape.map((p) => p + 24)];
    if (!up) run.reverse();
    run.forEach((p, i) =>
      band.note(
        at + i * 0.25,
        p,
        1,
        'harp',
        gain * (0.75 + 0.05 * i),
        ((i / 7) * 1.2 - 0.6) * (up ? 1 : -1),
      ),
    );
  };
  each(WAVE, SPIN, (at) => sweep(at, true, 0.05));

  // Spin: the marimba whirls round each bar (a turn a bar, a quarter a beat), the tune again.
  each(SPIN, JUMP, (at) => {
    for (let i = 0; i < 16; i++) {
      const beat = at + i / 4;
      const shape = shapeAt(beat);
      const tones = [...shape.map((p) => p + 12), shape[0] + 24];
      band.note(
        beat,
        tones[[0, 1, 2, 3, 4, 3, 2, 1][i % 8]],
        0.3,
        'marimba',
        0.044 * (i % 4 ? 0.8 : 1.15),
        Math.sin((i / 16) * 2 * Math.PI) * 0.6,
      );
    }
  });
  play(SPIN, HOOK, 'flute', FLUTE, { pan: 0.1 });
  play(SPIN, HOOK, 'vibes', 0.032, { pan: -0.2 });

  // Jump: a big hit on every landing (every other beat, every beat in the last bar), and a
  // marimba springboard into each.
  const hit = (beat: number, top: string | undefined, gain = 1) => {
    const shape = shapeAt(beat),
      r = rootAt(beat);
    kick(beat, 1.1 * gain);
    clap(beat, 1.05 * gain, 1.2);
    kit.note(beat, r, 0.6, 'fingerbass', 0.11 * gain);
    kit.note(beat, r + 12, 0.6, 'fingerbass', 0.05 * gain);
    kit.chord(beat, shape, 0.45, 'epiano', 0.042 * gain, { spread: 0.35 });
    kit.chord(
      beat,
      shape.slice(1).map((p) => p + 12),
      0.5,
      'strings',
      0.045 * gain,
      { spread: 0.2 },
    );
    if (top) kit.note(beat, midi(top), 0.5, 'flute', FLUTE * 0.9 * gain, 0.1);
  };
  const LANDINGS: [offset: number, top?: string][] = [
    [0, 'E5'],
    [2, 'G5'],
    [4, 'F#5'],
    [6, 'A5'],
    [8, 'F#5'],
    [10, 'B5'],
    [12, 'A5'],
    [13, 'B5'],
    [14],
    [15],
  ];
  for (const [offset, top] of LANDINGS) {
    hit(JUMP + offset, top, offset >= 12 ? 0.85 + 0.05 * (offset - 12) : 1);
    if (offset < 12) {
      const shape = shapeAt(JUMP + offset + 1.5).map((p) => p + 12);
      band.note(JUMP + offset + 1.5, shape[2], 0.25, 'marimba', 0.045, -0.35);
      band.note(JUMP + offset + 1.75, shape[3], 0.25, 'marimba', 0.05, -0.35);
    }
  }
  crash(JUMP, 0.9);
  crash(JUMP + 8, 0.7);
  each(JUMP, C.finale, (at) => shaker(at, 'x-o-x-o-x-o-x-o-', 0.9));
  // The lift: a clap roll, and the flute running up into A.
  [135, 135.25, 135.5, 135.75].forEach((beat, i) => clap(beat, 0.55 + 0.12 * i));
  play(134.5, 'G#4/.25 A4/.25 B4/.25 C#5/.25 D5/.25 E5/.25', 'flute', FLUTE * 0.85, {
    pan: 0.1,
  });

  // ---- Finale -------------------------------------------------------------------------------
  // The ripple: the tune in A, strings under it, the choir, and harp ripples crossing the square.
  each(C.finale, BUILD, (at) => {
    for (let b = 0; b < 4; b++) kick(at + b, b % 2 ? 0.85 : 1.05);
    clap(at + 1, 1.05);
    clap(at + 3, 1.1);
    shaker(at, 'x-o-x-o-x-o-x-o-');
    sweep(at, true, 0.038);
    sweep(at + 2, false, 0.034);
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
  crash(C.finale, 1.1);
  const LIFTED = [
    'C#5/.5 E5/.5 A5/1 G#5/.5 A5/.5 B5/1',
    'C#6/1.5 B5/.5 A5/1 F#5/1',
    'r/.5 F#5/.5 A5/.5 F#5/.5 D6/1 C#6/.5 B5/.5',
    'B5/1.5 A5/.5 G#5/1 r/1',
  ].join(' | ');
  play(C.finale, LIFTED, 'flute', FLUTE * 1.05, { pan: 0.1 });
  play(C.finale, LIFTED, 'vibes', 0.036, { pan: -0.2 });
  play(C.finale, LIFTED, 'strings', 0.04, { legato: 0.98, shift: -12 });

  // The build: everyone together, the claps doubling, the strings and choir climbing to the hit.
  each(BUILD, C.freeze, (at, bar) => {
    const step = bar - BUILD / 4;
    for (let b = 0; b < 4; b++) kick(at + b, 1 + 0.04 * step);
    const claps = [
      [0, 1, 2, 3],
      [0, 1, 2, 3, 3.5],
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
      [0, 0.5, 1, 1.5, 2, 2.25, 2.5, 2.75, 3, 3.25],
    ][step];
    claps.forEach((off, i) => clap(at + off, 0.75 + 0.07 * step + (step === 3 ? i * 0.03 : 0)));
    shaker(
      at,
      step < 2 ? 'x-o-x-o-x-o-x-o-' : step === 2 ? 'xoxoxoxoxoxoxoxo' : 'xoxoxoxoxoxoxo..',
      1 + 0.08 * step,
    );
  });
  // A snare roll under the last two beats, growing, up to the breath.
  for (let i = 0; i < 8; i++) kit.note(165.5 + i * 0.25, 60, 0.12, 'snare', 0.02 + 0.007 * i, 0.1);
  crash(BUILD, 0.8);
  play(
    BUILD,
    [
      'F#5/.5 A5/.5 C#6/1 A5/.5 F#5/.5 A5/1',
      'G#5/.5 B5/.5 E6/1 B5/.5 G#5/.5 B5/1',
      'G#5/.5 B5/.5 E6/1 A5/.5 C#6/.5 F#6/1',
      'D6/.5 B5/.5 F#5/.5 B5/.5 G#5/.5 B5/.5 D6/.5 r/.5',
    ].join(' | '),
    'flute',
    FLUTE * 1.05,
    { pan: 0.1 },
  );
  const rising = (text: string, voice: Note['voice'], gain: number) =>
    play(BUILD, text, voice, gain, { legato: 1 });
  rising('A4/4/.8 | B4/4/.9 | C#5/2 C#5/2/1.05 | D5/2/1.1 D5/1.5/1.15 r/.5', 'strings', 0.05);
  rising('F#4/4/.8 | G#4/4/.9 | G#4/2 A4/2/1.05 | B4/2/1.1 B4/1.5/1.15 r/.5', 'strings', 0.046);
  rising('C#5/4/.8 | E5/4/.9 | E5/2 F#5/2/1.05 | F#5/2/1.1 G#5/1.5/1.15 r/.5', 'choir', 0.032);

  // ---- The hit: everyone at once on beat 168, short; then nothing --------------------------------
  const H = C.freeze;
  kick(H, 1.4, 33);
  clap(H, 1.3, 1.3);
  kit.note(H, 60, 0.12, 'snare', 0.05);
  crash(H, 1.2);
  kit.note(H, midi('A1'), 1, 'fingerbass', 0.13);
  kit.note(H, midi('A2'), 1, 'fingerbass', 0.07);
  kit.chord(H, pitches('A3 C#4 E4 A4'), 1.2, 'epiano', 0.046, { spread: 0.4 });
  kit.chord(H, pitches('A3 E4 A4 C#5'), 0.8, 'strings', 0.06, { spread: 0.3 });
  kit.chord(H, pitches('A4 C#5 E5'), 0.8, 'choir', 0.032, { spread: 0.4 });
  kit.chord(H, pitches('A5 C#6 E6'), 1, 'marimba', 0.055, { spread: 0.4 });
  kit.chord(H, pitches('A4 C#5 E5'), 1.5, 'vibes', 0.045, { spread: 0.3 });
  kit.note(H, midi('A5'), 0.9, 'flute', FLUTE, 0.1);

  return [...band.done(), ...kit.done()].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
}
