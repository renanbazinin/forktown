// "Teacups and Tulips": the town's tune for 15:00–17:00, a garden waltz in B♭ (3/4, 64 bars).
// Oom-pah-pah under a singing flute; strings answer, then lead; harp and vibes at the turns.
// (Bars below count from 1; the code counts them from 0.)
//   A   (bars 1–16)  the flute's tune over bass and nylon pah-pahs; strings creep in at bar 9.
//   A'  (17–32)      the tune climbs to C6 over a strings counter-line; E°7 lifts the cadence.
//   B   (33–48)      E♭ and G minor: strings sing, the flute answers, guitar rolls in eighths;
//                    from bar 40 the strings climb over the guitar and fall back by semitones.
//   A'' (49–64)      the tune once more, fullest: harp pah-pahs, a new counter in sixths, a
//                    hemiola cadence, then a turnaround to A.
import { midi, Score, type Note, type TuneInfo } from './kit';

export const TEATIME: TuneInfo = {
  title: 'Teacups and Tulips',
  subtitle: 'A waltz for the garden tables',
  bpm: 138,
  beats: 192,
  bar: 3,
  hall: { wet: 0.24, size: 0.68, damp: 0.42 },
  instruments: 'Flute, strings, nylon guitar, upright bass, harp, vibraphone',
};

export function composeTeatime(): Note[] {
  const score = new Score(TEATIME.beats);
  const BAR = 3;
  /** 'pitch:beats' tokens ('-' rests) from bar `from`; '|' marks a barline and must fall on one. */
  const parse = (from: number, text: string) => {
    const steps: { at: number; beats: number; name: string }[] = [];
    let at = from * BAR;
    for (const token of text.trim().split(/\s+/)) {
      if (token === '|') {
        if (at % BAR) throw new Error(`Teatime: a bar of the wrong length before beat ${at}`);
        continue;
      }
      const [name, value] = token.split(':');
      steps.push({ at, beats: Number(value), name });
      at += Number(value);
    }
    return steps;
  };
  /** Plays a parsed line, each note `legato` of its value (a whole bar's a little less). */
  const play = (
    from: number,
    text: string,
    voice: Note['voice'],
    gain: number,
    pan: number,
    legato = 0.94,
  ) => {
    for (const { at, beats, name } of parse(from, text)) {
      const hold = beats * (beats >= BAR ? Math.min(legato, 0.88) : legato);
      if (name !== '-') score.note(at, midi(name), hold, voice, gain, pan);
    }
  };
  const pitches = (names: string) => names.split(' ').map(midi);

  // Pah-pah voicings (beats 2 and 3) and the B section's rolling guitar, by chord.
  const PAH: Record<string, string> = {
    Bb: 'D4 F4 Bb4',
    Gm: 'D4 G4 Bb4',
    Cm7: 'Eb4 G4 Bb4',
    F7: 'Eb4 F4 A4',
    Eb: 'Eb4 G4 Bb4',
    Ebmaj7: 'D4 G4 Bb4',
    Edim7: 'Db4 G4 Bb4',
    Bb7: 'D4 F4 Ab4',
  };
  const ROLL: Record<string, string> = {
    Ebmaj7: 'Bb3 D4 G4',
    Dm7: 'A3 C4 F4',
    Gm7: 'Bb3 D4 F4',
    Cm7: 'Bb3 Eb4 G4',
    F7: 'A3 Eb4 F4',
    Bbmaj7: 'A3 D4 F4',
    Bb7: 'Ab3 D4 F4',
    Ebm6: 'Bb3 C4 Gb4',
    Bb: 'Bb3 D4 F4',
    G7: 'B3 D4 F4',
    F7sus4: 'Bb3 Eb4 F4',
  };
  // The A tune's sixteen bars of harmony (slash chords keep the pah-pah of their chord). In A''
  // bar 59's chord leaves its D to the counter-line.
  const A = 'Bb Gm Cm7 F7 Bb Eb F7 Bb Gm Gm Ebmaj7 Cm7 Bb F7 Bb F7'.split(' ');
  const A2 = [...A.slice(0, 11), 'Edim7', 'Bb', 'F7', 'Bb', 'Bb7'];
  const A3 = [...A.slice(0, 10), 'Eb', ...A.slice(11)];
  const B = 'Ebmaj7 Ebmaj7 Dm7 Gm7 Cm7 F7 Bbmaj7 Bb7 Ebmaj7 Ebm6 Bb G7 Cm7 F7sus4 F7 F7';

  // Oom: the upright on each downbeat, walking up at the turnarounds; lighter and shorter in B.
  const oom = ' Bb2:3 | G2:3 | C3:3 | F2:3 | D2:3 | Eb2:3 | F2:3 | Bb2:3 | G2:3 | F2:3 | Eb2:3 |';
  play(0, `${oom} C2:3 | F2:3 | F2:3 | Bb1:3 | F2:2 A2:1`, 'upright', 0.116, 0, 0.55);
  play(16, `${oom} E2:3 | F2:3 | F2:3 | Bb1:3`, 'upright', 0.12, 0, 0.55);
  play(31, 'Bb1:1 C2:1 D2:1', 'upright', 0.09, 0, 0.6);
  play(
    32,
    'Eb2:3 | Bb1:3 | D2:3 | G2:3 | C2:3 | F2:3 | Bb1:3 | Bb1:2 D2:1 |' +
      ' Eb2:3 | Eb2:3 | D2:3 | G2:3 | C2:3 | F2:3 | F2:3 | F2:2 A2:1',
    'upright',
    0.105,
    0,
    0.6,
  );
  play(48, `${oom} C2:3 | D2:2 Eb2:2 F2:2 | Bb1:3 | F2:2 A2:1`, 'upright', 0.12, 0, 0.55);

  // Pah-pah: nylon chords on 2 (a touch early, as a Viennese waltz leans) and 3. In A'' the
  // harp takes bars 49–56 and the hemiola has its own chords, so the nylon rests there.
  const pah = { strum: 0.012, spread: 0.14, pan: 0.16 };
  const sections: [from: number, chords: string[], level: number][] = [
    [0, A, 0.95],
    [16, A2, 1],
    [48, A3, 1.04],
  ];
  for (const [from, chords, level] of sections)
    chords.forEach((symbol, i) => {
      const bar = from + i;
      if ((bar >= 48 && bar < 56) || bar === 60 || bar === 61) return;
      const at = bar * BAR;
      const chord = pitches(PAH[symbol]);
      score.chord(at + 0.97, chord, 0.55, 'nylon', 0.066 * level, pah);
      score.chord(at + 2, chord, 0.5, 'nylon', 0.056 * level, pah);
    });
  // The hemiola (bars 61–62): three half-bar chords across two bars, B♭/D, Cm7/E♭, F7.
  ['D4 F4 Bb4', 'C4 G4 Bb4', 'Eb4 F4 A4'].forEach((names, i) =>
    score.chord(60 * BAR + 1 + 2 * i, pitches(names), 0.8, 'nylon', 0.064, pah),
  );
  // Harp pah-pahs in A'' (bar 49 is its opening sweep). A harp rings on, so the second chord of
  // each bar leaves out any string a semitone from the next bar's chord.
  [
    'G4 Bb4 / G4 Bb4',
    'Eb4 G4 Bb4 / Eb4 G4',
    'Eb4 F4 A4 / F4 C5',
    'F4 Bb4 / F4 Bb4',
    'Eb4 G4 Bb4 / Eb4 G4',
    'Eb4 F4 A4 / F4 C5',
    'D4 F4 Bb4 / D4 F4 Bb4',
  ].forEach((pair, i) => {
    const at = (49 + i) * BAR;
    const [first, second] = pair.split(' / ').map(pitches);
    score.chord(at + 0.97, first, 0.9, 'harp', 0.04, { strum: 0.02, spread: 0.1, pan: -0.3 });
    score.chord(at + 2, second, 0.9, 'harp', 0.034, { strum: 0.02, spread: 0.1, pan: -0.3 });
  });

  // B's strings. The tune starts a bar early, as A' closes, leading the flute's breath into E♭;
  // from bar 40 it climbs over the guitar (F5 A♭5, then G5 G♭5 F5) as a second voice falls
  // by semitones beneath it.
  const bTune =
    'D5:2 C5:1 | Bb4:2 C5:1 | D5:3 | C5:2 A4:1 | Bb4:3 | G4:1 C5:1 Eb5:1 | F5:2 Eb5:1 | D5:3 |' +
    ' F5:2 Ab5:1 | G5:3 | Gb5:3 | F5:2 D5:1 | D5:2 B4:1 | C5:1 Eb5:1 G5:1 | F5:2 C5:1 |' +
    ' A4:3 | -:3';
  const bBelow = 'Ab4:3 | G4:3 | Gb4:3 | F4:3 | F4:3 | Eb4:3 | Eb4:3 | Eb4:3';
  play(31, bTune, 'strings', 0.165, 0.04, 0.97);
  play(39, bBelow, 'strings', 0.062, 0.04);
  const held = [...parse(31, bTune), ...parse(39, bBelow)].filter((s) => s.name !== '-');
  // The guitar rolls in eighths after the bass, letting each string ring; where the strings
  // sing the roll's top note it rocks on its lower two, leaving that note to them.
  B.split(' ').forEach((symbol, i) => {
    const at = (32 + i) * BAR;
    const roll = pitches(ROLL[symbol]);
    const shared = held.some(
      (s) => midi(s.name) === roll[2] && s.at < at + BAR && s.at + s.beats > at,
    );
    const level = i < 8 ? 0.036 : 0.042;
    // Each string rings to the end of its bar, so no chord smears into the next.
    (shared ? [0, 1, 0, 1, 0] : [0, 1, 2, 1, 0]).forEach((pick, k) =>
      score.note(at + 0.5 + k * 0.5, roll[pick], 2.45 - k * 0.5, 'nylon', level, 0.22),
    );
  });

  // The flute's tune: A, A' (higher), the answers in B, A'' (fuller, with the hemiola).
  const flute = (from: number, text: string, gain: number) =>
    play(from, text, 'flute', gain, -0.08);
  flute(
    0,
    'D5:1 F5:2 | Bb5:2 A5:1 | G5:2 Eb5:1 | F5:3 | Bb4:1 D5:1 F5:1 | G5:2 Bb5:1 |' +
      ' A5:1 G5:1 Eb5:1 | D5:3 | D5:2 G5:1 | Bb5:1.5 A5:0.5 G5:1 | Bb5:1 G5:1 F5:1 | Eb5:3 |' +
      ' F5:2 D5:1 | Eb5:1 C5:1 A4:1 | Bb4:3 | -:2 C5:1',
    0.06,
  );
  flute(
    16,
    'D5:1 F5:2 | Bb5:2 A5:1 | G5:2 Eb5:1 | F5:1 G5:1 A5:1 | Bb5:3 | C6:1 Bb5:1 G5:1 |' +
      ' A5:1 F5:1 Eb5:1 | D5:3 | D5:2 G5:1 | Bb5:1.5 A5:0.5 Bb5:1 | C6:1.5 Bb5:0.5 G5:1 |' +
      ' Bb5:1 G5:1 E5:1 | F5:2 D5:1 | Eb5:1 C5:1 A4:1 | Bb4:3 | -:3',
    0.064,
  );
  // B: the flute answers where the strings hold, a different reply each time.
  flute(
    32,
    '-:3 | -:1 Bb5:1 G5:1 | -:3 | -:1 D5:1 F5:1 | -:3 | -:3 | -:1 A5:2 | -:3 |' +
      ' -:3 | -:1 Bb5:1 C6:1 | -:3 | -:3 | -:3 | -:3 | -:1 C5:1 F5:1 | A5:1 G5:1 Eb5:1',
    0.06,
  );
  flute(
    48,
    'D5:1 F5:2 | Bb5:2 A5:1 | G5:2 Eb5:1 | F5:1 G5:1 A5:1 | Bb5:3 |' +
      ' C6:1 Bb5:0.5 A5:0.5 G5:1 | A5:1.5 G5:0.5 Eb5:1 | D5:3 | D5:1 G5:1 Bb5:1 |' +
      ' Bb5:1.5 A5:0.5 Bb5:1 | C6:2 Bb5:1 | G5:2 Eb5:1 | F5:2 Eb5:2 C5:2 | Bb4:3 | -:2 C5:1',
    0.068,
  );

  // Strings elsewhere: a soft bed in A's second half, a counter-line in A', and in A'' a new
  // counter in sixths and thirds under the flute, moving where the flute holds.
  ['Bb4 D5', 'Bb4 D5', 'Bb4 D5', 'G4 C5', 'F4 Bb4', 'F4 A4', 'F4 D5', 'F4 A4'].forEach((names, i) =>
    score.chord((8 + i) * BAR, pitches(names), BAR - 0.1, 'strings', 0.04),
  );
  play(
    16,
    'F4:3 | G4:3 | G4:2 Bb4:1 | A4:2 C5:1 | D5:2 C5:1 | Bb4:3 | A4:3 | Bb4:2 C5:1 |' +
      ' Bb4:3 | D5:3 | C5:2 Bb4:1 | Db5:3 | D5:3 | C5:3 | D5:3',
    'strings',
    0.056,
    0.06,
    0.98,
  );
  play(
    48,
    'Bb4:1 D5:2 | D5:2 C5:1 | Eb5:2 C5:1 | C5:2 Eb5:1 | D5:2 F5:1 | Eb5:1 D5:1 Bb4:1 |' +
      ' C5:2 A4:1 | Bb4:2 C5:1 | Bb4:2 D5:1 | D5:3 | Eb5:2 D5:1 | Eb5:1 D5:1 C5:1 |' +
      ' D5:2 G5:2 A5:2 | Bb5:3 | F5:2 -:1',
    'strings',
    0.062,
    0.06,
    0.98,
  );

  // Harp: a rising B♭ sweep as A, A'' open and as A' closes into B.
  const sweep = (at: number, names: string, gain: number) =>
    pitches(names).forEach((pitch, i) =>
      score.note(at + i * 0.25, pitch, 2, 'harp', gain * (0.8 + i * 0.04), -0.35),
    );
  sweep(0 * BAR + 1, 'Bb3 D4 F4 Bb4 D5 F5', 0.06);
  sweep(30 * BAR + 0.5, 'F3 Bb3 D4 F4 Bb4 D5 F5 Bb5', 0.062);
  sweep(48 * BAR + 1, 'F3 Bb3 D4 F4 Bb4 D5 F5', 0.062);
  // In B, a slow rolled chord where a harmony holds (E♭maj7 for two bars) or the swell begins.
  score.chord(32 * BAR, pitches('Eb3 Bb3 G4 D5'), 2, 'harp', 0.05, { strum: 0.09, pan: -0.35 });
  score.chord(44 * BAR, pitches('C3 G3 Eb4 G4'), 2, 'harp', 0.052, { strum: 0.09, pan: -0.35 });

  // Vibes: a little sparkle where the tune holds or breathes, damped before the next bar.
  const sparkle = (bar: number, text: string, gain = 0.027) => {
    for (const token of text.split(' ')) {
      const [name, offset] = token.split('@');
      const at = bar * BAR + Number(offset);
      score.note(at, midi(name), Math.max(0.5, bar * BAR + 2.9 - at), 'vibes', gain, -0.18);
    }
  };
  sparkle(7, 'F5@1 Bb5@1.5 D6@2');
  sparkle(11, 'G5@1 Bb5@1.5 C6@2', 0.024);
  sparkle(15, 'C6@0 A5@0.5 F5@1 Eb5@1.5', 0.022);
  sparkle(23, 'D6@1 Bb5@1.5 F5@2');
  sparkle(55, 'F5@1 Bb5@1.5 D6@2', 0.025);
  sparkle(62, 'F5@1 Bb5@1.5 D6@2');
  sparkle(63, 'C6@0 A5@0.5 F5@1 Eb5@1.5', 0.022);

  // The loop's arc, bar by bar: A settles in, A' lifts and breathes out, B swells back,
  // A'' is the fullest and eases off into A again.
  const ARC: [bar: number, level: number][] = [
    [0, 0.97],
    [12, 1],
    [16, 0.95],
    [20, 1],
    [26, 1.04],
    [30, 0.96],
    [32, 1.02],
    [40, 1.03],
    [46, 1.07],
    [48, 1.04],
    [56, 1.06],
    [59, 1.03],
    [61, 0.98],
    [63, 0.95],
    [64, 0.97],
  ];
  const arc = (beat: number) => {
    const bar = beat / BAR;
    const next = ARC.findIndex(([at]) => at > bar);
    const [from, low] = ARC[next - 1],
      [to, high] = ARC[next];
    return low + ((high - low) * (bar - from)) / (to - from);
  };
  return score.done().map((note) => ({ ...note, gain: note.gain * arc(note.beat) }));
}
