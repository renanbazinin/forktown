// "Bicycle Bells": the town's tune for 07:45–09:45, D major at 104 bpm, 36 bars (A A' B B' A'' A'''
// C C' C''). Off to the bakery the long way round: a marimba sings a little tune that opens with a
// bicycle bell (a quick ring-ring a fifth up, then a breath), a nylon guitar chops the offbeats, an
// upright bounces under a soft kick and a shaker, and now and then a real bell (a music box) rings
// past. The bridge takes the long way, through the park (the drums rest, birds sing, the marimba
// and music box trade phrases), then gathers the band and turns on A7 back to the first bar.
import { midi, Score, type Note, type TuneInfo } from './kit';

export const MORNING: TuneInfo = {
  title: 'Bicycle Bells',
  subtitle: 'Off to the bakery, the long way round',
  bpm: 104,
  beats: 144,
  bar: 4,
  hall: { wet: 0.24, size: 0.6, damp: 0.4 },
  instruments: 'Marimba, nylon guitar, upright bass, shaker, soft kick, music box, birds',
};

/**
 * [beat in the phrase, note, length in beats, weight, how]: one note of a melody, struck once, as
 * a bell's quick ring-ring (two sixteenths), or rolled.
 */
type Tone = readonly [number, string, number, number, ('ring' | 'roll')?];

export function composeMorning(): Note[] {
  const score = new Score(MORNING.beats, { timing: 0.01, loudness: 0.05 });

  // The guitar's three-string chop for each chord, a lower string for when it picks, and the
  // bass's second note when it is not the fifth above the bass.
  const VOICING: Record<string, { chop: string[]; low: string; alt?: string }> = {
    D: { chop: ['D4', 'F#4', 'A4'], low: 'A3' },
    Bm7: { chop: ['D4', 'F#4', 'B4'], low: 'F#3' },
    Em7: { chop: ['D4', 'G4', 'B4'], low: 'E3' },
    A7sus4: { chop: ['D4', 'E4', 'A4'], low: 'A3' },
    A7: { chop: ['C#4', 'E4', 'G4'], low: 'A3' },
    G: { chop: ['D4', 'G4', 'B4'], low: 'G3' },
    A: { chop: ['C#4', 'E4', 'A4'], low: 'A3' },
    'F#m7': { chop: ['C#4', 'F#4', 'A4'], low: 'F#3' },
    Gmaj7: { chop: ['D4', 'F#4', 'B4'], low: 'G3' },
    'F#7': { chop: ['C#4', 'E4', 'A#4'], low: 'F#3' },
    'D/F#': { chop: ['D4', 'F#4', 'A4'], low: 'F#3', alt: 'A2' },
  };

  // The bell tune: a pickup, a quick ring-ring a fifth up and a breath, a skip down to the tonic,
  // then a run round the relative minor (bars 1–2 of every A).
  const CALL: Tone[] = [
    [0.5, 'D5', 0.5, 0.82],
    [1, 'A5', 0.5, 1, 'ring'],
    [2, 'E5', 0.75, 0.9],
    [2.75, 'F#5', 0.25, 0.78],
    [3, 'D5', 1, 0.9],
    [4.5, 'F#5', 0.5, 0.88],
    [5, 'E5', 0.5, 0.8],
    [5.5, 'D5', 0.5, 0.82],
    [6, 'B4', 0.5, 0.8],
    [6.5, 'D5', 1.5, 0.9],
  ];
  // A'': the tune brighter, from the third, its skip leaping to the sixth.
  const CALL_BRIGHT: Tone[] = [
    [0.5, 'F#5', 0.5, 0.84],
    [1, 'A5', 0.5, 1, 'ring'],
    [2, 'B5', 0.75, 0.94],
    [2.75, 'A5', 0.25, 0.78],
    [3, 'F#5', 0.5, 0.86],
    [3.5, 'A5', 0.5, 0.84],
    ...CALL.filter(([beat]) => beat >= 4),
  ];
  // A''': the tune once more, its last note running up into the answer.
  const CALL_RUN: Tone[] = [
    ...CALL.slice(0, -1),
    [6.5, 'D5', 0.5, 0.88],
    [7, 'E5', 0.5, 0.8],
    [7.5, 'F#5', 0.5, 0.84],
  ];
  // Its question in the same rhythm, the rings a step lower, coming to rest on the dominant.
  const ASK: Tone[] = [
    [8.5, 'D5', 0.5, 0.8],
    [9, 'G5', 0.5, 0.98, 'ring'],
    [10, 'D5', 0.75, 0.88],
    [10.75, 'E5', 0.25, 0.76],
    [11, 'B4', 1, 0.88],
    [12.5, 'E5', 0.5, 0.86],
    [13, 'D5', 0.5, 0.8],
    [13.5, 'A4', 0.5, 0.8],
    [14, 'C#5', 0.5, 0.84],
    [14.5, 'E5', 1.5, 0.88],
  ];
  // The question at its brightest: the rings leap a fifth to B.
  const ASK_HIGH: Tone[] = [
    [8.5, 'E5', 0.5, 0.82],
    [9, 'B5', 0.5, 1, 'ring'],
    [10, 'G5', 0.75, 0.92],
    [10.75, 'F#5', 0.25, 0.76],
    [11, 'E5', 0.5, 0.86],
    [11.5, 'G5', 0.5, 0.82],
    [12, 'A5', 1, 0.95],
    [13.5, 'G5', 0.5, 0.8],
    [14, 'E5', 2, 0.88],
  ];
  // The answer: down from G, the rings once more on the dominant, the seventh falling home.
  const HOME: Tone[] = [
    [8.5, 'G5', 0.5, 0.86],
    [9, 'F#5', 0.5, 0.84],
    [9.5, 'E5', 0.5, 0.82],
    [10, 'A5', 0.5, 1, 'ring'],
    [11, 'G5', 0.5, 0.9],
    [11.5, 'E5', 0.5, 0.8],
    [12, 'F#5', 1, 1],
    [13.5, 'E5', 0.5, 0.8],
    [14, 'D5', 1.5, 0.92],
  ];
  // B: up the hill over IV V iii vi, the long notes rolled so they hold.
  const HILL: Tone[] = [
    [0, 'B4', 0.5, 0.8],
    [0.5, 'D5', 0.5, 0.85],
    [1, 'G5', 2, 1, 'roll'],
    [3, 'F#5', 0.5, 0.8],
    [3.5, 'G5', 0.5, 0.85],
    [4, 'A5', 1.5, 1, 'roll'],
    [5.5, 'G5', 0.5, 0.8],
    [6, 'E5', 2, 0.9, 'roll'],
    [8.5, 'C#5', 0.5, 0.8],
    [9, 'E5', 0.5, 0.85],
    [9.5, 'A5', 1.5, 1, 'roll'],
    [11, 'F#5', 1, 0.9],
    [12, 'D5', 2.5, 0.95],
  ];
  // B': the same climb a step lower, coasting down to the dominant and stepping up into A''.
  const COAST: Tone[] = [
    [0, 'B4', 0.5, 0.8],
    [0.5, 'E5', 0.5, 0.85],
    [1, 'G5', 2, 1, 'roll'],
    [3, 'F#5', 0.5, 0.8],
    [3.5, 'E5', 0.5, 0.85],
    [4, 'F#5', 1.5, 0.95, 'roll'],
    [5.5, 'E5', 0.5, 0.8],
    [6, 'C#5', 2, 0.9, 'roll'],
    [8.5, 'B4', 0.5, 0.8],
    [9, 'D5', 0.5, 0.85],
    [9.5, 'G5', 1, 0.95],
    [10.5, 'F#5', 0.5, 0.85],
    [11, 'E5', 1, 0.9],
    [12, 'D5', 2, 0.9, 'roll'],
    [14, 'C#5', 1, 0.85],
    [15, 'E5', 1, 0.82],
  ];
  // C: through the park, lower and slower; the music box answers in bar two.
  const PARK: Tone[] = [
    [0, 'F#5', 1.5, 0.95],
    [1.5, 'E5', 0.5, 0.8],
    [2, 'D5', 1, 0.9],
    [3, 'B4', 1, 0.85],
    [4, 'D5', 2, 0.9],
    [8, 'E5', 1.5, 0.95],
    [9.5, 'G5', 0.5, 0.85],
    [10, 'F#5', 1, 0.9],
    [11, 'E5', 0.5, 0.8],
    [11.5, 'D5', 0.5, 0.8],
    [12, 'C#5', 1, 0.9],
    [13, 'A#4', 0.5, 0.8],
    [13.5, 'C#5', 0.5, 0.82],
    [14, 'E5', 1.5, 0.9],
  ];
  // C': by the pond the music box leads; the marimba answers, once with the bell tune's run.
  const POND: Tone[] = [
    [4.5, 'D5', 0.5, 0.78],
    [5, 'E5', 0.5, 0.82],
    [5.5, 'F#5', 0.5, 0.86],
    [6, 'A5', 1, 0.92],
    [7, 'F#5', 1, 0.82],
    [12.5, 'A#4', 0.5, 0.76],
    [13, 'C#5', 0.5, 0.8],
    [13.5, 'E5', 0.5, 0.84],
    [14, 'F#5', 1, 0.9],
    [15, 'E5', 0.5, 0.78],
    [15.5, 'C#5', 0.5, 0.8],
  ];
  // C'': back on the road, climbing to the loop's high B, then down the dominant to the top.
  const ROAD: Tone[] = [
    [0, 'D5', 1.5, 0.9],
    [1.5, 'B4', 0.5, 0.8],
    [2, 'D5', 0.5, 0.85],
    [2.5, 'G5', 1.5, 0.95],
    [4, 'F#5', 1.5, 0.95],
    [5.5, 'E5', 0.5, 0.8],
    [6, 'D5', 1.5, 0.85],
    [7.5, 'E5', 0.5, 0.8],
    [8, 'G5', 1, 0.95],
    [9, 'E5', 0.5, 0.85],
    [9.5, 'G5', 0.5, 0.9],
    [10, 'B5', 1.5, 1],
    [11.5, 'A5', 0.5, 0.85],
    [12, 'A5', 1, 0.95],
    [13, 'G5', 0.5, 0.85],
    [13.5, 'E5', 0.5, 0.82],
    [14, 'C#5', 1.25, 0.85],
  ];

  type Band = 'chop' | 'pick' | 'drift';
  type Phrase = {
    chords: string; // a bar each; 'X+Y' changes chord at beat 2
    bass: string; // the bass's root for each chord
    melody: Tone[];
    guitar: Band | Band[]; // per phrase, or per bar
    groove: 'bounce' | 'two' | 'still' | ('bounce' | 'two' | 'still')[];
    kick: string | string[]; // sixteenths, one bar (or one per bar); '' rests
    shaker: string | string[];
    box?: Tone[]; // music-box notes (weight × 0.075); its rings double the marimba's
    bells?: readonly (readonly [number, number])[]; // bicycle bells: [beat, pan]
    lift?: number; // how hard the marimba plays this pass (1 by default)
  };
  // The shaker: a backbeat with a pickup into 3 and 1, and the offbeats too in the brightest pass.
  const PEDAL = '....x..o....x..o';
  const SPIN = '..o.x..o..o.x..o';
  const FORM: Phrase[] = [
    // A: the bell tune and its question.
    {
      chords: 'D Bm7 Em7 A7sus4+A7',
      bass: 'D2 B1 E2 A1+A1',
      melody: [...CALL, ...ASK],
      guitar: 'chop',
      groove: 'bounce',
      kick: 'x.....-.o.......',
      shaker: PEDAL,
    },
    // A': the tune answered home; a bicycle rings past on the right.
    {
      chords: 'D Bm7 G+A7 D',
      bass: 'D2 B1 G2+A2 D2',
      melody: [...CALL, ...HOME],
      guitar: 'chop',
      groove: 'bounce',
      kick: 'x.....-.o.......',
      shaker: PEDAL,
      bells: [[14, 0.5]],
      lift: 0.97,
    },
    // B: up the hill; the guitar picks, the bass walks in two.
    {
      chords: 'G A F#m7 Bm7',
      bass: 'G2 A2 F#2 B1',
      melody: HILL,
      guitar: 'pick',
      groove: 'two',
      kick: 'x.......o.......',
      shaker: '..o...x...o...x.',
      bells: [[14.5, -0.5]],
    },
    // B': a step lower, the bass rising to the dominant; the kick nudges into A''.
    {
      chords: 'Em7 F#m7 G A7sus4+A7',
      bass: 'E2 F#2 G2 A2+A2',
      melody: COAST,
      guitar: 'pick',
      groove: 'two',
      kick: ['x.......o.......', 'x.......o.......', 'x.......o.......', 'x.......o...-.o.'],
      shaker: ['..o...x...o...x.', '..o...x...o...x.', '..o...x...o...x.', 'o.x.o.x.o.x.o.x.'],
    },
    // A'': the brightest pass: the tune from the third, the shaker spinning, a music box ringing too.
    {
      chords: 'D Bm7 Em7 A7sus4+A7',
      bass: 'D2 B1 E2 A1+A1',
      melody: [...CALL_BRIGHT, ...ASK_HIGH],
      guitar: 'chop',
      groove: 'bounce',
      kick: 'x.....o.o.....-.',
      shaker: SPIN,
      box: [
        [1, 'A5', 0.5, 0.55, 'ring'],
        [9, 'B5', 0.5, 0.55, 'ring'],
      ],
      lift: 1.06,
    },
    // A''': home again, and another bell, this time on the left.
    {
      chords: 'D Bm7 G+A7 D',
      bass: 'D2 B1 G2+A2 D2',
      melody: [...CALL_RUN, ...HOME],
      guitar: 'chop',
      groove: 'bounce',
      kick: ['x.....o.o.....-.', 'x.....o.o.....-.', 'x.....o.o.....-.', 'x.......o.......'],
      shaker: [SPIN, SPIN, SPIN, '..o.x.....o.x...'],
      box: [
        [1, 'A5', 0.5, 0.55, 'ring'],
        [10, 'A5', 0.5, 0.55, 'ring'],
      ],
      bells: [[14, -0.5]],
    },
    // C: the long way round through the park: no drums, birds, the music box answers.
    {
      chords: 'Bm7 Gmaj7 Em7 F#7',
      bass: 'B2 G2 E2 F#2',
      melody: PARK,
      guitar: 'drift',
      groove: 'still',
      kick: '',
      shaker: '',
      box: [
        [6, 'F#6', 0.5, 1],
        [6.5, 'D6', 0.5, 1],
        [7, 'B5', 1, 1],
      ],
    },
    // C': round the pond on the same chords: the music box sings, the bass walks, a shaker whispers.
    {
      chords: 'Bm7 Gmaj7 Em7 F#7',
      bass: 'B2 G2 E2 F#2',
      melody: POND,
      guitar: 'drift',
      groove: 'two',
      kick: '',
      shaker: '..o...o...o...o.',
      box: [
        [0, 'B5', 1.5, 1.3],
        [1.5, 'A5', 0.5, 1.1],
        [2, 'F#5', 2, 1.2],
        [8, 'G5', 1, 1.25],
        [9, 'B5', 1, 1.2],
        [10, 'E6', 2, 1.3],
      ],
    },
    // C'': back on the road; guitar chop, shaker and kick gather in turn; A7 turns to the top.
    {
      chords: 'G D/F# Em7 A7sus4+A7',
      bass: 'G2 F#2 E2 A1+A1',
      melody: ROAD,
      guitar: ['drift', 'chop', 'chop', 'chop'],
      groove: 'two',
      kick: ['', '', 'x.......o.......', 'x.......o...-.o.'],
      shaker: ['..o...o...o...o.', '..o...o...o...o.', '..o.o..o..o.o..o', 'o.x.o.x.o.x.o.x.'],
    },
  ];

  const DIATONIC = [1, 2, 4, 6, 7, 9, 11]; // D major's pitch classes
  const inKey = (pitch: number) => DIATONIC.includes(((pitch % 12) + 12) % 12);
  // A bass step into the next root: a scale step below or above, not a note the bar just played.
  const approach = (played: number[], next: number) =>
    [next - 1, next + 2, next + 1, next - 2].find((p) => inKey(p) && !played.includes(p)) ??
    next + 7;
  const pick = <T>(value: T | T[], bar: number) => (Array.isArray(value) ? value[bar] : value);

  // Every bar's chords, with the bass root, in loop order (for approach notes across phrases).
  const bars = FORM.flatMap((phrase) => {
    const chords = phrase.chords.split(' ');
    const roots = phrase.bass.split(' ');
    return chords.map((cell, bar) =>
      cell.split('+').map((symbol, half, all) => ({
        symbol,
        root: midi(roots[bar].split('+')[half]),
        start: all.length > 1 ? half * 2 : 0,
        end: all.length > 1 ? half * 2 + 2 : 4,
      })),
    );
  });

  // A ring-ring is struck on the grid, the second stroke nudged (by under a millisecond) to a
  // whole number of the note's cycles after the first: struck against the bar's swing it would
  // all but silence it. In step, a lighter stroke (`again`, as the first still rings) sounds as
  // loud as the first. Samples per beat at render.ts's 24 kHz.
  const exact = new Score(MORNING.beats, { timing: 0, loudness: 0.05 });
  const SAMPLES = (24000 * 60) / MORNING.bpm;
  const ringRing = (at: number, pitch: number, voice: Note['voice'], gain: number, pan: number) => {
    const cycle = 24000 / (440 * 2 ** ((pitch - 69) / 12));
    const gap = Math.round(Math.round((0.25 * SAMPLES) / cycle) * cycle);
    const again = voice === 'musicbox' ? 0.22 : 0.4;
    exact.note(at, pitch, 0.25, voice, gain, pan);
    exact.note((Math.round(at * SAMPLES) + gap) / SAMPLES, pitch, 0.25, voice, gain * again, pan);
  };

  const MARIMBA = 0.094;
  FORM.forEach((phrase, p) => {
    const at = p * 16;
    // The marimba carries the tune, a touch left of centre. A rolled note is struck again every
    // sixteenth, softly, by alternate mallets, until a sixteenth before it ends.
    const marimba = MARIMBA * (phrase.lift ?? 1);
    for (const [beat, name, length, weight, how] of phrase.melody) {
      if (how === 'ring') {
        ringRing(at + beat, midi(name), 'marimba', marimba * weight, -0.1);
        continue;
      }
      score.note(at + beat, midi(name), length, 'marimba', marimba * weight, -0.1);
      if (how === 'roll')
        for (let k = 1; k * 0.25 <= length - 0.25; k++)
          score.note(
            at + beat + k * 0.25,
            midi(name),
            0.25,
            'marimba',
            marimba * weight * (k % 2 ? 0.45 : 0.4),
            k % 2 ? -0.16 : -0.04,
          );
    }

    for (let bar = 0; bar < 4; bar++) {
      const index = p * 4 + bar;
      const start = at + bar * 4;
      const cells = bars[index];
      const next = bars[(index + 1) % bars.length][0].root;
      const chordAt = (beat: number) => cells.find((c) => beat >= c.start && beat < c.end)!;

      // Guitar: an upstroke chop on every offbeat (the lowest string only on 2 and 4, for a lilt
      // toward them), or picked eighths that ring to the chord's end.
      const guitar = pick(phrase.guitar, bar);
      if (guitar === 'chop') {
        [0.5, 1.5, 2.5, 3.5].forEach((beat, k) => {
          const notes = VOICING[chordAt(beat).symbol].chop.map(midi).reverse();
          const accent = [0.9, 1, 0.85, 1][k];
          (k % 2 ? notes : notes.slice(0, -1)).forEach((pitch, s) =>
            score.note(
              start + beat + s * 0.02,
              pitch,
              [0.4, 0.5, 0.4, 0.42][k],
              'nylon',
              0.07 * accent * (s === 0 ? 1 : 0.85),
              0.48 - s * 0.12,
            ),
          );
        });
      } else {
        // Picking rolls through every eighth; drifting lilts, one-and-two, three-and-four.
        const order = guitar === 'pick' ? [0, 1, 2, 3, 2, 1, 2, 3] : [0, 2, 3, -1, 1, 2, 3, -1];
        const gain = guitar === 'pick' ? 0.065 : 0.06;
        order.forEach((which, k) => {
          if (which < 0) return;
          const beat = k * 0.5;
          const chord = chordAt(beat);
          const { chop, low } = VOICING[chord.symbol];
          const strings = [low, ...chop].map(midi);
          score.note(
            start + beat,
            strings[which],
            Math.min(guitar === 'pick' ? 1.5 : 2, chord.end - beat),
            'nylon',
            gain * (k % 2 ? 0.85 : 1),
            0.42 - which * 0.08,
          );
        });
      }

      // Bass: a bouncing root–root–fifth–step, a walk in two, or long roots in the park.
      const groove = pick(phrase.groove, bar);
      const [first, second] = [cells[0], cells[cells.length - 1]];
      const fifth = (root: number) => (root + 7 <= 50 ? root + 7 : root - 5);
      const alt = VOICING[first.symbol].alt;
      const other = second.root !== first.root ? second.root : alt ? midi(alt) : fifth(first.root);
      const lead = approach([first.root, other], next);
      const steps: [number, number, number, number][] =
        groove === 'bounce'
          ? [
              [0, first.root, 1.4, 0.92],
              [1.5, first.root, 0.4, 0.64],
              [2, other, 0.9, 0.8],
              [3, lead, 0.9, 0.74],
            ]
          : groove === 'two'
            ? [
                [0, first.root, 1.8, 1],
                [2, other, 1.4, 0.9],
                [3.5, lead, 0.45, 0.72],
              ]
            : [
                [0, first.root, 2.8, 1],
                [3, fifth(first.root), 0.9, 0.8],
              ];
      for (const [beat, pitch, length, weight] of steps)
        score.note(start + beat, pitch, length, 'upright', 0.115 * weight, 0);

      // Drums: a soft kick on the tonic, felt more than heard, and a shaker a little to the left.
      const kick = pick(phrase.kick, bar);
      if (kick) score.hits(start, kick, 'softkick', 0.077, { pitch: 38 });
      const shaker = pick(phrase.shaker, bar);
      if (shaker) score.hits(start, shaker, 'shaker', 0.09, { pan: -0.42 });
    }

    for (const [beat, name, length, weight, how] of phrase.box ?? [])
      if (how === 'ring') ringRing(at + beat, midi(name), 'musicbox', 0.075 * weight, -0.3);
      else score.note(at + beat, midi(name), length, 'musicbox', 0.075 * weight, -0.3);
    // Bicycle bells: two quick rings, each a grace from D6 up to F#6.
    for (const [beat, pan] of phrase.bells ?? [])
      for (const ring of [0, 0.5]) {
        score.note(at + beat + ring, midi('D6'), 0.25, 'musicbox', 0.035, pan);
        score.note(at + beat + ring + 0.125, midi('F#6'), 0.25, 'musicbox', 0.05, pan);
      }
  });

  // Birds in the park and by the pond, until the road gathers the band (just under the gain cap
  // after the score's loudness drift).
  score.note(96, midi('D4'), 40, 'birds', 0.238, 0);
  return [...score.done(), ...exact.done()].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
}
