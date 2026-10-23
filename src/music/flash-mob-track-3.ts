// "Moon in the Fountain": the flash mob's third record (FLASH_MOB_TRACKS in flash-mob-beat.ts),
// for the week the full moon wanes (dates 16, 18 and 20). A warm, swaying Latin dance, bossa
// meeting mambo, on the same beat and cues as "Nothing to See Here" (flash-mob-track.ts), so the
// one dance fits it beat for beat (two beats to a town minute):
//
//   0–16    solo    one dancer alone: the 3–2 clave, a conga tumbao, the bass anticipating each
//                   bar on four, a soft kick and a nylon chord a bar
//   16–40   join    a kalimba note as each dancer leaves the crowd (beat 16 + 2(k − 1)), climbing
//                   the scale, and a layer every two bars: the nylon guitar's comping and the
//                   shaker (16), a marimba montuno (24), claps on two and four, the kick on every
//                   beat, a samba bass and the strings' swell (32)
//   40–56   clap    the tune on flute, a tresillo, and the whole mob clapping every beat
//   56–72   point   its answer, and a stab on every point: screen-left on even beats, right on odd
//   72–88   groove  side steps over a bouncing bass on a IV–V vamp, the congas busier, the flute
//                   calling and the marimba answering
//   88–104  wave    long lines at half time, a harp rising across each bar in eighths (the arms,
//                   half a beat apart), left to right, and a brush circling under it
//   104–120 spin    a marimba spiralling up a quarter turn a beat, once round a bar, the tune again
//   120–136 jump    a big hit on every landing: even beats, then every beat of the last bar
//   136–168 finale  a lift up a tone into E: the tune again, a harp ripple across the square and
//                   back with each sweep of the arms, the choir, then everyone clapping faster
//                   and faster, and a breath (167.5–168)
//   168     the hit one E6/9 from everyone at once, then nothing: the pose held in silence
//
// Written in D and lifted to E for the finale. Nothing sounds after beat 168 but that chord's
// decay, so the render's loop wrap brings nothing round to the start. There are no conga, clave
// or clap voices: a conga is a woodblock tuned low to the key with a quiet second one at the
// membrane's 1.59 ratio above it (a slap is the rim's cross-stick over a high tick); the claves
// are a high tick; a clap is four brush taps 0–23 ms apart across the stereo field with a
// whisper of snare. The render worker reaches this file through score.ts, so it imports nothing
// but the kit and the beat. No Math.random or Date.
import { midi, Score, type Note, type TuneInfo } from './tunes/kit';
import { FLASH_MOB_BPM, FLASH_MOB_CUES, FLASH_MOB_TRACK_BEATS } from '../lib/flash-mob-beat';

export const FLASH_MOB_TRACK_3: TuneInfo = {
  title: 'Moon in the Fountain',
  subtitle: 'Fountain Square, on the stroke of five',
  bpm: FLASH_MOB_BPM,
  beats: FLASH_MOB_TRACK_BEATS,
  bar: 4,
  hall: { wet: 0.2, size: 0.55, damp: 0.5 },
  // Measured over the whole track, the sparse solo and the silent end with it, as the first
  // record's is, so the routine sits at its level.
  loudness: 0.048,
  instruments:
    'Flute, nylon guitar, marimba, kalimba, vibes, upright and fingered bass, strings, harp, choir, congas, claves, shaker, felt kick, hand claps',
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
/** Nothing starts in the breath before the hit. */
const BREATH = C.freeze - 0.5;

// A bar's chord ('X|Y' halves it), one a bar from 17:00; the finale is in E.
const HARMONY = [
  ...['Dmaj7', 'Bm7', 'Em7', 'A7'], // solo
  ...['Dmaj7', 'Bm7', 'Em7', 'A7', 'F#m7|Bm7', 'Em7|A7'], // join
  ...['Dmaj7', 'Bm7', 'Em7', 'A7'], // clap
  ...['Dmaj7', 'Bm7', 'Em7', 'A7sus4|A7'], // point
  ...['Gmaj7', 'A7', 'Gmaj7', 'A7'], // groove: the montuno vamp
  ...['Bm7', 'Gmaj7', 'Em7', 'A7sus4|A7'], // wave
  ...['Dmaj7', 'Bm7', 'Em7', 'A7'], // spin
  ...['Gmaj7', 'A', 'F#m7', 'B7sus4|B7'], // jump, and the lift
  ...['Emaj7', 'C#m7', 'F#m7', 'B7'], // finale: the ripple
  ...['Amaj7', 'B', 'G#m7|C#m7', 'F#m7|B7'], // finale: the build
];
// Each chord in the middle of the keyboard, mostly without its root (the bass has it): for the
// guitar, the marimba and the stabs.
const SHAPES: Record<string, string> = {
  Dmaj7: 'F#3 A3 C#4 E4',
  Bm7: 'F#3 A3 B3 D4',
  Em7: 'G3 B3 D4 F#4',
  A7: 'G3 B3 C#4 F#4',
  A7sus4: 'G3 B3 D4 E4',
  'F#m7': 'E3 A3 C#4 F#4',
  Gmaj7: 'F#3 B3 D4 E4',
  A: 'A3 C#4 E4 A4',
  B7sus4: 'A3 B3 E4 F#4',
  B7: 'A3 B3 D#4 F#4',
  Emaj7: 'G#3 B3 D#4 F#4',
  'C#m7': 'G#3 B3 C#4 E4',
  Amaj7: 'A3 C#4 E4 G#4',
  B: 'F#3 B3 D#4 F#4',
  'G#m7': 'F#3 B3 D#4 G#4',
};
const pitches = (names: string) => names.split(' ').map(midi);
/** The chord sounding at a beat. */
function chordAt(beat: number) {
  const bar = Math.floor(beat / 4);
  const parts = (HARMONY[bar] ?? 'Emaj7').split('|');
  return parts[Math.min(parts.length - 1, Math.floor(((beat - bar * 4) / 4) * parts.length))];
}
const shapeAt = (beat: number) => pitches(SHAPES[chordAt(beat)]);
/** The chord's root for the bass, A1–G#2. */
function rootAt(beat: number) {
  const root = midi(`${/^[A-G][#b]?/.exec(chordAt(beat))![0]}2`);
  return root > 44 ? root - 12 : root;
}
/** The fifth below a root, or above it when below would be lower than G1. */
const lowFifth = (root: number) => (root - 5 >= 31 ? root - 5 : root + 7);
// D major, then E major from the lift: the bass steps into each chord from a note of the key.
const D_MAJOR = [2, 4, 6, 7, 9, 11, 1],
  E_MAJOR = [4, 6, 8, 9, 11, 1, 3];
/** The nearest note of the key at `beat` past `pitch` in `direction` (±1). */
function neighbour(pitch: number, direction: 1 | -1, beat: number) {
  const key = beat >= C.finale ? E_MAJOR : D_MAJOR;
  let p = pitch + direction;
  while (!key.includes(((p % 12) + 12) % 12)) p += direction;
  return p;
}

export function composeFlashMob3(): Note[] {
  const beats = FLASH_MOB_TRACK_3.beats;
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
  const lifted = (beat: number) => beat >= C.finale;

  // ---- Percussion ---------------------------------------------------------------------------
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
  /** The felt kick, a deeper surdo-like boom on two and four. */
  const kick = (at: number, gain = 1, deep = false) =>
    kit.note(at, deep ? 36 : lifted(at) ? 40 : 38, 0.5, 'softkick', 0.085 * gain);
  const shaker = (at: number, pattern: string, gain = 1) =>
    kit.hits(at, pattern, 'shaker', 0.068 * gain, { pan: 0.34 });
  const crash = (at: number, gain = 1) => kit.note(at, 64, 4, 'ride', 0.1 * gain, -0.3);
  /** The claves: a high woodblock, on the key's fifth (A, then B after the lift). */
  const clave = (at: number, gain = 1) =>
    kit.note(at, lifted(at) ? midi('B6') : midi('A6'), 0.2, 'tick', 0.075 * gain, -0.28);
  /** The 3–2 son clave over two bars from an even bar: three, then two. */
  const CLAVE = [0, 1.5, 3, 5, 6];
  const claves = (at: number, gain = 1) => {
    if ((at / 4) % 2) return;
    for (const off of CLAVE) if (at + off < BREATH) clave(at + off, gain);
  };
  // Congas: the high drum on the key's tonic, the low one a fourth under it; a stroke is a tuned
  // woodblock with a quiet second at the membrane's 1.59 ratio (eight semitones) above it.
  const CONGA_PAN = 0.12;
  type Stroke = 'open' | 'low' | 'slap' | 'ghost';
  const conga = (at: number, stroke: Stroke, gain = 1, pan = CONGA_PAN) => {
    const high = lifted(at) ? midi('E4') : midi('D4');
    const g = 0.13 * gain;
    if (stroke === 'open' || stroke === 'low') {
      const p = stroke === 'open' ? high : high - 5;
      const side = stroke === 'open' ? pan : pan + 0.12;
      kit.note(at, p, 0.3, 'tick', g, side);
      kit.note(at, p + 8, 0.2, 'tick', g * 0.22, side);
    } else if (stroke === 'slap') {
      kit.note(at, 74, 0.2, 'rim', g * 0.62, pan);
      kit.note(at, high + 12, 0.15, 'tick', g * 0.3, pan);
    } else kit.note(at, high, 0.15, 'tick', g * 0.24, pan);
  };
  /** Strokes in a bar: [offset, stroke, gain]. */
  type Pattern = readonly (readonly [number, Stroke, number?])[];
  // The tumbao: a heel, the slap on two, a toe, then two open tones on four and its "and".
  const TUMBAO: Pattern[] = [
    [
      [0, 'ghost'],
      [1, 'slap'],
      [2.5, 'ghost'],
      [3, 'open'],
      [3.5, 'open', 0.9],
    ],
    [
      [0, 'ghost'],
      [1, 'slap'],
      [2.5, 'ghost'],
      [3, 'open'],
      [3.5, 'low', 0.9],
    ],
  ];
  // The groove's marcha: every eighth, the low drum answering on three.
  const MARCHA: Pattern[] = [
    [
      [0, 'ghost'],
      [0.5, 'ghost'],
      [1, 'slap'],
      [1.5, 'ghost'],
      [2, 'low', 0.8],
      [2.5, 'ghost'],
      [3, 'open'],
      [3.5, 'open', 0.9],
    ],
    [
      [0, 'ghost'],
      [0.5, 'open', 0.7],
      [1, 'slap'],
      [1.5, 'ghost'],
      [2, 'low', 0.8],
      [2.5, 'low', 0.7],
      [3, 'open'],
      [3.5, 'slap', 0.8],
    ],
  ];
  // The wave sways: the slap on two, the drums answering on four.
  const SWAY: Pattern = [
    [1, 'slap', 0.8],
    [3, 'open', 0.9],
    [3.5, 'low', 0.8],
  ];
  const congas = (at: number, patterns: Pattern[] | Pattern, gain = 1) => {
    const pattern = (
      typeof patterns[0][0] === 'number' ? patterns : (patterns as Pattern[])[(at / 4) % 2]
    ) as Pattern;
    for (const [off, stroke, scale = 1] of pattern)
      if (at + off < BREATH) conga(at + off, stroke, gain * scale);
  };
  /** A fill into the next phrase: four sixteenths down the drums, growing. */
  const fill = (at: number, gain = 1) =>
    (['open', 'open', 'low', 'low'] as const).forEach((stroke, i) =>
      conga(at + i * 0.25, stroke, gain * (0.75 + 0.1 * i)),
    );

  // Solo: the clave, the tumbao, a soft kick on one and three.
  each(0, 16, (at) => {
    claves(at);
    congas(at, TUMBAO, 1.2);
    kick(at, 1);
    kick(at + 2, 0.85);
  });
  fill(15, 0.95);
  // Join: the shaker with the first joiner, a little louder each two bars; claps with the ninth.
  each(16, 40, (at) => {
    claves(at);
    congas(at, TUMBAO);
    shaker(at, at < 24 ? 'x.o.x.o.x.o.x.o.' : 'o.-xo.-xo.-xo.-x', at < 24 ? 0.95 : 0.9);
    if (at < 32) {
      kick(at, 0.85);
      kick(at + 2, 0.75);
    } else {
      for (let b = 0; b < 4; b++) kick(at + b, b % 2 ? 0.8 : 0.72, b % 2 === 1);
      clap(at + 1, 0.7);
      clap(at + 3, 0.75);
    }
  });
  fill(39, 0.9);
  clap(39.5, 0.5);
  clap(39.75, 0.6);
  // The routine: four on the floor, deeper on two and four; in the clap phrase claps on every
  // beat, loudest on two and four; after it, claps on two and four. The wave sways at half time.
  each(CLAP, JUMP, (at) => {
    const wave = at >= WAVE && at < SPIN;
    const groove = at >= GROOVE && at < WAVE;
    for (let b = 0; b < 4; b++)
      if (!wave || b % 2 === 0) kick(at + b, b % 2 ? 0.85 : 0.95, b % 2 === 1);
    if (at < POINT) for (let b = 0; b < 4; b++) clap(at + b, b % 2 ? 1 : 0.62);
    else if (wave) clap(at + 2, 0.9);
    else {
      clap(at + 1, 0.95);
      clap(at + 3, 1);
    }
    claves(at, wave ? 0.85 : 1);
    congas(at, wave ? SWAY : groove ? MARCHA : TUMBAO);
    if (wave) shaker(at, 'x.o.x.o.x.o.x.o.', 0.8);
    else shaker(at, groove ? 'o-oxo-oxo-oxo-ox' : 'o.-xo.-xo.-xo.-x');
  });
  for (const at of [CLAP, POINT, GROOVE, SPIN]) crash(at, at === CLAP ? 1 : 0.8);
  crash(WAVE, 0.6);
  for (const at of [GROOVE - 1, WAVE - 1, SPIN - 1]) fill(at, 0.85);
  // A brush circling the head under each bar of the wave.
  each(WAVE, SPIN, (at) => kit.note(at, 60, 3.8, 'swish', 0.06, 0.2));

  // ---- Bass ---------------------------------------------------------------------------------
  // Solo and join: the tumbao bass, the fifth on the "and" of two and the next bar's root on
  // four, held over the bar line, so one only ever lands under the kick.
  band.note(0, rootAt(0), 1.3, 'upright', 0.115);
  each(0, 32, (at) => {
    const r = rootAt(at),
      next = rootAt(at + 4);
    band.note(at + 1.5, r + 7, 1.3, 'upright', 0.1);
    band.note(at + 3, next, at + 4 >= 32 ? 0.9 : 2.3, 'upright', 0.115);
  });
  // The samba bass: tum, ta-tum, the root and the fifth under it, and a step into the next bar.
  const samba = (at: number, gain = 0.1) => {
    const r = rootAt(at),
      late = rootAt(at + 2),
      next = rootAt(at + 4);
    const into = neighbour(next, next > late ? -1 : 1, at + 4);
    play(
      at,
      `${r}/.75 ${lowFifth(r)}/.25/.6 ${lowFifth(r)}/1/.85 ${late}/.75 ${lowFifth(late)}/.25/.6 ${lowFifth(late)}/.5/.85 ${into}/.5/.8`,
      'upright',
      gain,
      { legato: 0.85 },
    );
  };
  each(32, GROOVE, (at) => samba(at));
  // The groove: the bass bounces an octave and back, with a step into each chord.
  each(GROOVE, WAVE, (at) => {
    const r = rootAt(at),
      o = r + 12,
      next = rootAt(at + 4);
    const into = neighbour(next, next > r ? -1 : 1, at + 4);
    play(
      at,
      `${r}/.75 ${r}/.25/.6 ${r + 7}/.5/.8 ${o}/.5 r/.5 ${neighbour(o, -1, at)}/.25/.6 ${o}/.25/.85 ${r + 7}/.5/.85 ${into}/.5/.8`,
      'fingerbass',
      0.105,
      { legato: 0.75 },
    );
  });
  // The wave sways: a held root, then the fifth.
  each(WAVE, SPIN, (at) => play(at, `${rootAt(at)}/2 ${rootAt(at + 2) + 7}/2/.85`, 'upright', 0.1));
  each(SPIN, JUMP, (at) => samba(at));
  each(C.finale, BUILD, (at) => samba(at, 0.098));
  // The build: eighths on the root, climbing an octave in the last bar, which stops for a breath.
  each(BUILD, C.freeze, (at) => {
    const r = rootAt(at),
      late = rootAt(at + 2);
    play(
      at,
      at === C.freeze - 4
        ? `${r}/.5 ${r}/.5 ${r + 12}/.5 ${r + 12}/.5 ${late}/.5 ${late + 7}/.5 ${late + 12}/.5 r/.5`
        : `${r}/.5 ${r}/.5/.7 ${r + 12}/.5/.8 ${r}/.5/.7 ${late}/.5 ${late}/.5/.7 ${late + 12}/.5/.8 ${late}/.5/.7`,
      'upright',
      0.106,
      { legato: 0.8 },
    );
  });

  // ---- Nylon guitar ---------------------------------------------------------------------------
  const GUITAR = { pan: -0.3, spread: 0.12, strum: 0.012 };
  // The solo's one soft chord a bar.
  each(0, 16, (at) => band.chord(at, shapeAt(at), 2.5, 'nylon', 0.046, { ...GUITAR, strum: 0.03 }));
  // Comping in two-bar cells against the clave: the chord on one, chops on the "and" of two and
  // of three; then the "and" of one, three, and the next bar's chord struck early on the "and"
  // of four.
  const CELLS = [
    [
      [0, 0.9, true],
      [1.5, 0.4, false],
      [2.5, 0.4, false],
    ],
    [
      [0.5, 0.4, false],
      [2, 0.9, true],
      [3.5, 0.5, true],
    ],
  ] as const;
  const comp = (at: number, gain = 0.042) => {
    for (const [off, length, full] of CELLS[(at / 4) % 2]) {
      const beat = at + off;
      if (beat >= BREATH) continue;
      const shape = shapeAt(off === 3.5 ? beat + 0.5 : beat);
      band.chord(beat, full ? shape : shape.slice(1), length, 'nylon', gain * (full ? 1 : 0.85), {
        ...GUITAR,
      });
    }
  };
  each(16, POINT, (at) => comp(at, at < 24 ? 0.044 : 0.042));
  each(GROOVE, WAVE, (at) => comp(at));
  each(SPIN, JUMP, (at) => comp(at, 0.04));
  each(C.finale, C.freeze, (at) => comp(at, 0.04));
  // The wave: one chord a bar (two where it changes), rolled slowly, ringing.
  each(WAVE, SPIN, (at) => {
    const changes = chordAt(at) !== chordAt(at + 2);
    band.chord(at, shapeAt(at), changes ? 1.8 : 3.6, 'nylon', 0.036, { ...GUITAR, strum: 0.08 });
    if (changes)
      band.chord(at + 2, shapeAt(at + 2), 1.6, 'nylon', 0.034, { ...GUITAR, strum: 0.08 });
  });

  // ---- The dancers joining: a kalimba note as each one leaves the crowd, up the scale --------
  // Written for a full mob of twelve; with fewer dancers the later notes ring over those already
  // in place.
  'A4 B4 D5 E5 F#5 A5 B5 C#6 E6 F#6 A6'
    .split(' ')
    .forEach((name, k) =>
      kit.note(C.join + 2 * k, midi(name), 1.5, 'kalimba', 0.09, k % 2 ? 0.3 : -0.3),
    );

  // ---- Marimba montuno: from the third bar of the join through the clap phrase ----------------
  const MONTUNO = [
    [
      [0, 3],
      [1, 1],
      [1.5, 2],
      [2.5, 3],
      [3, 1],
      [3.5, 2],
    ],
    [
      [0.5, 3],
      [1, 2],
      [2, 0],
      [2.5, 1],
      [3.5, 3],
    ],
  ] as const;
  const montuno = (at: number, gain: number) => {
    for (const [off, pick] of MONTUNO[(at / 4) % 2]) {
      const beat = at + off;
      if (beat >= BREATH) continue;
      const shape = shapeAt(off === 3.5 ? beat + 0.5 : beat);
      band.note(beat, shape[pick] + 12, 0.35, 'marimba', gain * (off % 1 ? 1 : 0.82), 0.36);
    }
  };
  each(24, POINT, (at) => montuno(at, at < CLAP ? 0.05 : 0.044));
  each(C.finale, BUILD, (at) => montuno(at, 0.036));

  // ---- Strings: the swell into the routine ----------------------------------------------------
  play(32, 'C#5/2/.7 D5/2/.8 | B4/2/.85 C#5/1.5/1 r/.5', 'strings', 0.05, { legato: 1 });
  play(32, 'A4/2/.7 F#4/2/.8 | G4/2/.85 G4/1.5/1 r/.5', 'strings', 0.046, { legato: 1 });

  // ---- The tune -------------------------------------------------------------------------------
  // A tresillo (three, three, two eighths), its answer a step down, twice.
  const HOOK = [
    'A5/1.5 F#5/1.5 A5/1',
    'B5/.5 C#6/.5 B5/.5 A5/.5 F#5/2',
    'G5/1.5 E5/1.5 G5/1',
    'A5/.5 B5/.5 A5/.5 G5/.5 E5/1.5 r/.5',
  ].join(' | ');
  const ANSWER = [
    'A5/1.5 F#5/1.5 A5/1',
    'D6/.5 C#6/.5 B5/.5 A5/.5 F#5/2',
    'G5/1.5 B5/1.5 E6/1',
    'D6/.5 B5/.5 A5/.5 G5/.5 E5/.5 C#5/.5 A5/1',
  ].join(' | ');
  const FLUTE = 0.074;
  // A pickup into the routine, climbing to the tune's first note.
  play(38, 'r/.5 E5/.5 F#5/.5 G5/.5', 'flute', FLUTE * 0.85, { pan: 0.1 });
  play(CLAP, HOOK, 'flute', FLUTE, { pan: 0.1 });
  play(CLAP, HOOK, 'vibes', 0.036, { pan: -0.2 });
  play(POINT, ANSWER, 'flute', FLUTE, { pan: 0.1 });

  // Point: a stab on every beat, thrown to screen-left on even beats and right on odd ones.
  each(POINT, GROOVE, (at) => {
    for (let b = 0; b < 4; b++) {
      const beat = at + b,
        side = (beat - POINT) % 2 ? 1 : -1,
        shape = shapeAt(beat);
      kit.chord(beat, shape, 0.3, 'nylon', 0.05, { pan: side * 0.45, spread: 0.1 });
      kit.chord(
        beat,
        shape.slice(1).map((p) => p + 12),
        0.3,
        'strings',
        0.042,
        { pan: side * 0.6 },
      );
      kit.note(beat, shape[3] + 12, 0.3, 'marimba', 0.05, side * 0.75);
    }
  });

  // Groove: the flute calls, the marimba answers.
  const CALLS = [
    'B5/.5 A5/.5 B5/.5 D6/.5 r/2',
    'C#6/.5 B5/.5 C#6/.5 E6/.5 r/2',
    'D6/.5 B5/.5 A5/.5 F#5/.5 A5/1 B5/1',
    'A5/1.5 G5/.5 E5/1 r/1',
  ].join(' | ');
  play(GROOVE, CALLS, 'flute', FLUTE, { pan: 0.1 });
  play(GROOVE + 2, 'F#5/.5 G5/.5 B5/1', 'marimba', 0.06, { pan: 0.36 });
  play(GROOVE + 6, 'G5/.5 A5/.5 C#6/1', 'marimba', 0.06, { pan: 0.36 });
  play(GROOVE + 15, 'A5/.25 C#6/.25 D6/.5', 'marimba', 0.05, { pan: 0.36 });

  // Wave: long lines over strings, and a harp rising across each bar in eighths, left to right.
  play(WAVE, 'F#5/3 A5/1 | B5/3 D6/1 | B5/2 G5/2 | A5/2 G5/1 E5/1', 'flute', FLUTE * 0.95, {
    legato: 0.97,
    pan: 0.1,
  });
  play(WAVE, 'D5/4 | D5/4 | B4/4 | D5/2 C#5/2', 'strings', 0.05, { legato: 1 });
  play(WAVE, 'A4/4 | B4/4 | G4/4 | G4/4', 'strings', 0.045, { legato: 1 });
  each(WAVE, SPIN, (at) => {
    for (let i = 0; i < 8; i++) {
      const beat = at + i * 0.5,
        shape = shapeAt(beat);
      const p = shape[i % 4] + (i < 4 ? 12 : 24);
      band.note(beat, p, 1.5, 'harp', 0.05 * (0.8 + 0.04 * i), (i / 7) * 1.4 - 0.7);
    }
  });

  // Spin: the marimba spirals up a quarter turn a beat and comes round once a bar, panned round
  // the square; the tune again.
  each(SPIN, JUMP, (at) => {
    for (let i = 0; i < 16; i++) {
      const beat = at + i / 4;
      const shape = shapeAt(beat);
      const tones = [...shape.map((p) => p + 12), ...shape.slice(0, 3).map((p) => p + 24)];
      const turn = Math.floor(i / 4);
      band.note(
        beat,
        tones[turn + [0, 2, 1, 3][i % 4]],
        0.3,
        'marimba',
        0.043 * (i % 4 ? 0.8 : 1.15),
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
    conga(beat, 'open', 1.05 * gain);
    conga(beat, 'low', 0.9 * gain);
    kit.note(beat, r, 0.6, 'upright', 0.11 * gain);
    kit.note(beat, r + 12, 0.6, 'upright', 0.05 * gain);
    kit.chord(beat, shape, 0.45, 'nylon', 0.05 * gain, { spread: 0.35 });
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
    [0, 'B5'],
    [2, 'D6'],
    [4, 'C#6'],
    [6, 'E6'],
    [8, 'C#6'],
    [10, 'F#6'],
    [12, 'E6'],
    [13, 'F#6'],
    [14],
    [15],
  ];
  for (const [offset, top] of LANDINGS) {
    hit(JUMP + offset, top, offset >= 12 ? 0.85 + 0.05 * (offset - 12) : 1);
    if (offset < 12) {
      const shape = shapeAt(JUMP + offset + 1.5).map((p) => p + 12);
      band.note(JUMP + offset + 1.5, shape[2], 0.25, 'marimba', 0.045, 0.36);
      band.note(JUMP + offset + 1.75, shape[3], 0.25, 'marimba', 0.05, 0.36);
    }
  }
  crash(JUMP, 0.9);
  crash(JUMP + 8, 0.7);
  each(JUMP, C.finale, (at) => {
    shaker(at, 'o.-xo.-xo.-xo.-x', 0.9);
    claves(at, 0.9);
  });
  // The lift: a clap roll, and the flute running up into E.
  [135, 135.25, 135.5, 135.75].forEach((beat, i) => clap(beat, 0.55 + 0.12 * i));
  play(134.5, 'D#5/.25 E5/.25 F#5/.25 G#5/.25 A5/.25 A#5/.25', 'flute', FLUTE * 0.85, {
    pan: 0.1,
  });

  // ---- Finale -------------------------------------------------------------------------------
  // The ripple: the tune in E, strings under it, the choir, and a harp ripple with each sweep of
  // the arms, across the square (up, left to right) and back (down, right to left).
  each(C.finale, BUILD, (at, bar) => {
    for (let b = 0; b < 4; b++) kick(at + b, b % 2 ? 0.74 : 0.84, b % 2 === 1);
    for (let b = 0; b < 4; b++) clap(at + b, b % 2 ? 0.88 : 0.4);
    shaker(at, 'o.-xo.-xo.-xo.-x');
    claves(at);
    congas(at, TUMBAO);
    const back = (bar - C.finale / 4) % 2 === 1;
    const shape = shapeAt(at);
    const run = [...shape, ...shape.map((p) => p + 12), ...shape.map((p) => p + 24)];
    if (back) run.reverse();
    run.forEach((p, i) =>
      band.note(
        at + i * 0.25,
        p,
        1,
        'harp',
        0.038 * (0.75 + 0.03 * i),
        ((i / 11) * 1.4 - 0.7) * (back ? -1 : 1),
      ),
    );
    band.chord(
      at,
      shape.slice(1).map((p) => p + 12),
      3.8,
      'choir',
      0.026,
      { spread: 0.4 },
    );
  });
  crash(C.finale, 1.1);
  play(C.finale, HOOK, 'flute', FLUTE * 0.97, { pan: 0.1, shift: 2 });
  play(C.finale, HOOK, 'vibes', 0.03, { pan: -0.2, shift: 2 });
  play(C.finale, HOOK, 'strings', 0.036, { legato: 0.98, shift: -10 });

  // The build: everyone together, the claps doubling, the strings and choir climbing to the hit;
  // the congas land with the jumps (every other beat, then every beat).
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
      step < 2 ? 'o.-xo.-xo.-xo.-x' : step === 2 ? 'xoxoxoxoxoxoxoxo' : 'xoxoxoxoxoxoxo..',
      1 + 0.08 * step,
    );
    claves(at);
    const landings = step < 2 ? [0, 2] : step === 3 ? [0, 1, 2, 3] : [];
    for (const off of landings) {
      conga(at + off, 'open', 0.9 + 0.05 * step);
      conga(at + off, 'low', 0.75 + 0.05 * step);
    }
    if (step === 2) for (const off of [1, 3]) conga(at + off, 'slap', 0.9);
  });
  // A snare roll under the last two beats, growing, up to the breath.
  for (let i = 0; i < 8; i++) kit.note(165.5 + i * 0.25, 60, 0.12, 'snare', 0.02 + 0.007 * i, 0.1);
  crash(BUILD, 0.8);
  play(
    BUILD,
    [
      'C#6/.5 E6/.5 C#6/.5 A5/.5 E5/.5 A5/.5 C#6/1',
      'D#6/.5 F#6/.5 D#6/.5 B5/.5 F#5/.5 B5/.5 D#6/1',
      'D#6/.5 B5/.5 G#5/.5 B5/.5 E6/.5 C#6/.5 G#5/.5 C#6/.5',
      'F#6/.5 C#6/.5 A5/.5 C#6/.5 D#6/.5 B5/.5 A5/.5 r/.5',
    ].join(' | '),
    'flute',
    FLUTE * 1.05,
    { pan: 0.1 },
  );
  const rising = (text: string, voice: Note['voice'], gain: number) =>
    play(BUILD, text, voice, gain, { legato: 1 });
  rising('A4/4/.8 | B4/4/.9 | B4/2 C#5/2/1.05 | C#5/2/1.1 D#5/1.5/1.15 r/.5', 'strings', 0.05);
  rising('E4/4/.8 | F#4/4/.9 | G#4/2 G#4/2/1.05 | A4/2/1.1 A4/1.5/1.15 r/.5', 'strings', 0.046);
  rising('C#5/4/.8 | D#5/4/.9 | D#5/2 E5/2/1.05 | F#5/2/1.1 F#5/1.5/1.15 r/.5', 'choir', 0.032);

  // ---- The hit: everyone at once on beat 168, an E6/9, short; then nothing --------------------
  const H = C.freeze;
  kick(H, 1.4);
  clap(H, 1.3, 1.3);
  kit.note(H, 60, 0.12, 'snare', 0.05);
  crash(H, 1.2);
  conga(H, 'open', 1.2);
  conga(H, 'low', 1.1);
  kit.note(H, midi('E1'), 1, 'upright', 0.13);
  kit.note(H, midi('E2'), 1, 'upright', 0.07);
  kit.chord(H, pitches('E3 G#3 C#4 F#4 B4'), 1.2, 'nylon', 0.05, { spread: 0.4 });
  kit.chord(H, pitches('B3 E4 G#4 C#5'), 0.8, 'strings', 0.055, { spread: 0.3 });
  kit.chord(H, pitches('G#4 B4 E5'), 0.8, 'choir', 0.032, { spread: 0.4 });
  kit.chord(H, pitches('E5 G#5 B5'), 1, 'marimba', 0.055, { spread: 0.4 });
  kit.chord(H, pitches('F#4 B4 C#5'), 1.5, 'vibes', 0.045, { spread: 0.3 });
  kit.note(H, midi('E6'), 0.9, 'flute', FLUTE, 0.1);

  return [...band.done(), ...kit.done()].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
}
