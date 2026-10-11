// "Lemonade Stand": the town's tune for 11:10–13:15, a lazy bossa nova in F for the hottest hour.
// The flute's motif lands early, on the "and" of four, hangs there, and drifts down (E, D, C, A);
// its answer climbs a Gm7 arpeggio, leans on the sus and sighs onto the third. Forty bars, AA'BA'':
//   A    (1–8)   the motif and its answer over I–vi–ii–V, then a third higher over iii–VI–ii–V
//   A'   (9–16)  the motif again; the answer turns to Bb (Cm7, F9, Bbmaj7) and the backdoor Eb9
//   B    (17–24) D dorian: a rising question (D E F) answered a step higher, climbing to A over
//                Bbmaj7, then a late echo over Gm7 and a guitar turn home
//   A''  (25–32) the motif a third time, now climbing C D E to rest on F
//   Siesta (33–40) the flute rests: the guitar holds F6/9–Ebmaj9 and a second guitar answers;
//                then a low lead-in, a sus that resolves into bar 1, and round again.
// Every four-bar phrase ends with a breath before the next pickup. Upright in the bossa
// root–fifth pattern; nylon stabs on the 3–2 bossa clave, the rim's cross-stick on the same
// clave; a light felt kick; a shaker on the far side from the guitar that comes and goes.
import { midi, Score, type Note, type TuneInfo } from './kit';

export const MIDDAY: TuneInfo = {
  title: 'Lemonade Stand',
  subtitle: 'A lazy bossa for the hottest hour',
  bpm: 114,
  beats: 160,
  bar: 4,
  hall: { wet: 0.2, size: 0.6, damp: 0.45 },
  instruments: 'Flute, nylon guitar, upright bass, rim, shaker, soft kick',
};

type Line = readonly (readonly [at: number, name: string, length: number])[];

export function composeMidday(): Note[] {
  const score = new Score(MIDDAY.beats);
  // Guitar voicings (low to high; the bass plays the roots), the bass root, and a shorter chop.
  const CHORDS: Record<string, { voicing: number[]; chop: number[]; root: number }> = {
    Fmaj9: { voicing: [57, 60, 64, 67], chop: [60, 64, 67], root: 41 },
    F69: { voicing: [57, 60, 62, 67], chop: [60, 62, 67], root: 41 },
    Dm9: { voicing: [53, 57, 60, 64], chop: [57, 60, 64], root: 38 },
    Gm7: { voicing: [55, 58, 62, 65], chop: [58, 62, 65], root: 43 },
    Gm9: { voicing: [53, 58, 62, 69], chop: [58, 62, 69], root: 43 },
    C9sus: { voicing: [53, 58, 62, 67], chop: [58, 62, 67], root: 48 },
    C9: { voicing: [52, 58, 62, 67], chop: [58, 62, 67], root: 48 },
    Am7: { voicing: [55, 60, 64, 69], chop: [60, 64, 69], root: 45 },
    D9: { voicing: [54, 60, 64, 69], chop: [54, 60, 64], root: 50 },
    Cm7: { voicing: [55, 58, 63, 67], chop: [58, 63, 67], root: 48 },
    F9: { voicing: [57, 60, 63, 67], chop: [60, 63, 67], root: 41 },
    Bbmaj7: { voicing: [58, 62, 65, 69], chop: [62, 65, 69], root: 46 },
    Eb9: { voicing: [55, 61, 65, 70], chop: [61, 65, 70], root: 39 },
    // B's Dm with the eleventh on top and no ninth, so the flute's F never sits a ninth above E.
    Dm11: { voicing: [53, 60, 62, 67], chop: [60, 62, 67], root: 38 },
    // A brighter Dm9 for the siesta, the fifth on top.
    Dm9hi: { voicing: [53, 60, 64, 69], chop: [60, 64, 69], root: 38 },
    G9: { voicing: [53, 59, 62, 69], chop: [59, 65, 69], root: 43 },
    Ebmaj9: { voicing: [55, 58, 62, 65], chop: [58, 62, 65], root: 39 },
  };
  // One entry per bar; two names split the bar at beat 3.
  const BARS = [
    ...['Fmaj9', 'Dm9', 'Gm7', 'C9sus C9', 'Am7', 'D9', 'Gm9', 'C9sus C9'], // A
    ...['Fmaj9', 'Dm9', 'Gm7', 'C9sus C9', 'Cm7', 'F9', 'Bbmaj7', 'Eb9'], // A'
    ...['Dm11', 'G9', 'Dm11', 'G9', 'Bbmaj7', 'Am7', 'Gm7', 'C9'], // B
    ...['Fmaj9', 'Dm9', 'Gm7', 'C9sus C9', 'Am7', 'D9', 'Gm9', 'C9'], // A''
    ...['F69', 'Ebmaj9', 'F69', 'Ebmaj9', 'Dm9hi', 'G9', 'Gm7', 'C9sus'], // Siesta
  ];
  const chordAt = (bar: number, beat: number) => {
    const names = BARS[(bar + BARS.length) % BARS.length].split(' ');
    return CHORDS[beat < 2 ? names[0] : names[names.length - 1]];
  };
  // How full each bar plays: the B section a little brighter, the siesta softer.
  const lift = (bar: number) => (bar >= 16 && bar < 24 ? 1.1 : bar >= 32 ? 0.92 : 1);
  const siesta = (bar: number) => bar >= 32;

  // Nylon guitar: two-bar cells on the 3–2 bossa clave (eighths 3 and 6, then 10 and 13), the
  // first bar's chord struck early on the "and" of four.
  const GUITAR = { pan: -0.28, spread: 0.12, strum: 0.012 };
  const stab = (bar: number, beat: number, length: number, full: boolean, gain: number) => {
    const chord = chordAt(bar, Math.max(0, beat));
    score.chord(bar * 4 + beat, full ? chord.voicing : chord.chop, length, 'nylon', gain, GUITAR);
  };
  for (let bar = 0; bar < BARS.length; bar += 2) {
    const g = 0.054 * lift(bar);
    // The siesta's first two cells: one chord a bar, struck early and left to ring.
    if (bar === 32 || bar === 34) {
      stab(bar, -0.5, 3.6, true, g * 0.9);
      stab(bar + 1, -0.5, 3.6, true, g * 0.8);
      continue;
    }
    stab(bar, -0.5, 1.8, true, g * 1.08);
    stab(bar, 1.5, 1.2, false, g * 0.85);
    stab(bar, 3, 0.8, false, g * 0.8);
    const end = bar + 1;
    if (end === 7 || end === 15 || end === 31) {
      // The last bar of A, A' and A'': a ghosted push on three, then the chord rolled slowly.
      stab(end, 1, 0.9, true, g * 0.95);
      stab(end, 2, 0.4, false, g * 0.5);
      const roll = chordAt(end, 2.5).voicing;
      score.chord(end * 4 + 2.5, roll, 0.95, 'nylon', g * 1.05, { ...GUITAR, strum: 0.06 });
    } else if (end === 23) {
      // The end of B: the guitar turns home alone in the flute's breath (Bb, G, E of C9).
      stab(end, 1, 1.3, true, g);
      for (const [beat, name] of [
        [2, 'Bb4'],
        [2.5, 'G4'],
        [3, 'E4'],
      ] as const)
        score.note(end * 4 + beat, midi(name), 0.6, 'nylon', 0.12, GUITAR.pan);
    } else {
      stab(end, 1, 1.3, true, g);
      // A chord that changes at beat 3 is struck whole again.
      const changes = BARS[end].includes(' ');
      stab(end, 2.5, 0.9, changes, g * (changes ? 0.95 : 0.8));
    }
  }

  // Upright: root on one, the fifth below on the "and" of two and on three; the last bar of each
  // cell anticipates the next root with the guitar.
  BARS.forEach((_, bar) => {
    const at = bar * 4;
    const { root } = chordAt(bar, 0);
    const late = chordAt(bar, 2).root;
    const next = chordAt(bar + 1, 0).root;
    if (siesta(bar)) {
      score.note(at, root, 1.8, 'upright', 0.094);
      score.note(at + 2, late - 5, 1.4, 'upright', 0.076);
    } else {
      score.note(at, root, 1.4, 'upright', 0.098);
      score.note(at + 1.5, late - 5, 0.45, 'upright', 0.068);
      score.note(at + 2, late - 5, 1.35, 'upright', 0.086);
    }
    if (bar % 2) score.note(at + 3.5, next, 0.4, 'upright', 0.068);
  });

  // Felt kick, felt more than heard: on one, a second on three only in B, and in the siesta
  // just the first bar of each cell.
  BARS.forEach((_, bar) => {
    const at = bar * 4;
    if (siesta(bar) && bar % 2) return;
    score.note(at, chordAt(bar, 0).root, 0.5, 'softkick', siesta(bar) ? 0.05 : 0.068);
    if (bar >= 16 && bar < 24) score.note(at + 2, chordAt(bar, 2).root - 5, 0.5, 'softkick', 0.045);
  });

  // Rim: the cross-stick on the guitar's clave, the one soft under the anticipated chord; only
  // the three side in the siesta.
  for (let bar = 0; bar < BARS.length; bar += 2) {
    const g = siesta(bar) ? 0.08 : 0.1;
    score.hits(bar * 4, 'o..x..x.', 'rim', g, { step: 0.5, pan: 0.15 });
    if (!siesta(bar)) score.hits(bar * 4 + 4, '..x..x..', 'rim', g, { step: 0.5, pan: 0.15 });
  }

  // Shaker, across from the guitar: joins for the end of A', sixteenths through B, eighths
  // through A''.
  const SHAKER = { pan: 0.34 };
  for (let bar = 14; bar < 16; bar++)
    score.hits(bar * 4, 'oxoxoxox', 'shaker', 0.055, { ...SHAKER, step: 0.5 });
  for (let bar = 16; bar < 24; bar++)
    score.hits(bar * 4, 'o.x-o.x-o.x-o.x-', 'shaker', 0.064, SHAKER);
  for (let bar = 24; bar < 32; bar++)
    score.hits(bar * 4, 'oxoxoxox', 'shaker', 0.058, { ...SHAKER, step: 0.5 });

  // Flute: [beat, note, length]. X is the motif, Y its answer, which sighs F to E on the C9 and
  // breathes before the next pickup.
  const X: Line = [
    [-0.5, 'E5', 3],
    [2.5, 'D5', 0.5],
    [3, 'C5', 0.5],
    [3.5, 'A4', 2],
  ];
  const Y: Line = [
    [8.5, 'Bb4', 0.5],
    [9, 'D5', 0.5],
    [9.5, 'F5', 4.5],
    [14, 'E5', 0.55],
  ];
  // X a third higher over iii–VI.
  const X2: Line = [
    [15.5, 'G5', 3],
    [18.5, 'E5', 0.5],
    [19, 'D5', 0.5],
    [19.5, 'C5', 2],
  ];
  const A_END: Line = [
    [24.5, 'D5', 0.5],
    [25, 'F5', 0.5],
    [25.5, 'A5', 2],
    [27.5, 'G5', 0.5],
    [28, 'F5', 1],
    [29, 'D5', 0.5],
    [29.5, 'C5', 1],
  ];
  // A': X with the third lowered (Cm7–F9), then down to Bbmaj7 and the backdoor Eb9.
  const A2_END: Line = [
    [15.5, 'G5', 3],
    [18.5, 'Eb5', 0.5],
    [19, 'D5', 0.5],
    [19.5, 'C5', 2],
    [23, 'Eb5', 0.5],
    [23.5, 'D5', 2.5],
    [26, 'C5', 0.5],
    [26.5, 'D5', 0.5],
    [27.5, 'G5', 2.5],
    [30, 'F5', 1],
  ];
  // B: its own idea, a rising question in long-short-held (D E F) and a falling answer, each
  // pair a step higher; the third climbs to the A over Bbmaj7, the fourth comes late.
  const B: Line = [
    [0, 'D5', 1], // question (Dm11)
    [1, 'E5', 0.5],
    [1.5, 'F5', 2.5],
    [4.5, 'E5', 0.5], // answer, onto G9's B natural
    [5, 'D5', 0.5],
    [5.5, 'B4', 2.5],
    [8, 'D5', 1], // question a step higher
    [9, 'E5', 0.5],
    [9.5, 'G5', 2.5],
    [12.5, 'F5', 0.5],
    [13, 'E5', 0.5],
    [13.5, 'D5', 1.5],
    [16, 'F5', 1], // the peak (Bbmaj7)
    [17, 'G5', 0.5],
    [17.5, 'A5', 2.5],
    [20.5, 'G5', 0.5], // down the Am7
    [21, 'E5', 0.5],
    [21.5, 'C5', 2],
    [24.5, 'D5', 0.5], // the question once more, late (Gm7), F to E on the C9
    [25, 'E5', 0.5],
    [25.5, 'F5', 2.5],
    [28.5, 'E5', 0.5],
    [29, 'G5', 1],
  ];
  // A'' ends home: the answer climbs C D E to F, held into the siesta.
  const A3_END: Line = [
    [24.5, 'D5', 0.5],
    [25, 'F5', 0.5],
    [25.5, 'A5', 2],
    [27.5, 'G5', 0.5],
    [28, 'F5', 1],
    [29, 'E5', 1],
    [30, 'C5', 0.5],
    [30.5, 'D5', 0.5],
    [31, 'E5', 0.5],
    [31.5, 'F5', 3],
  ];
  // Siesta: the flute's low lead-in (B natural, then B flat), a sus held over C, and round.
  const LEAD_IN: Line = [
    [16.5, 'D5', 0.5],
    [17, 'C5', 0.5],
    [17.5, 'A4', 2.5],
    [20.5, 'B4', 0.5],
    [21, 'D5', 2.5],
    [24.5, 'Bb4', 0.5],
    [25, 'C5', 0.5],
    [25.5, 'D5', 2.5],
    [28.5, 'F5', 2.5],
  ];
  // The flute sits a hair behind the beat, lazily, and breathes between notes so the line never
  // overlaps itself; long notes sing a little louder.
  const flute = (at: number, line: Line, gain = 0.064) => {
    for (const [beat, name, length] of line) {
      const level = length >= 2 ? gain * 1.06 : gain;
      score.note(at + beat + 0.03, midi(name), length - 0.06, 'flute', level, 0.1);
    }
  };
  for (const at of [0, 32, 96]) flute(at, [...X, ...Y]);
  flute(0, [...X2, ...A_END]);
  flute(32, A2_END);
  flute(64, B, 0.066);
  flute(96, [...X2, ...A3_END]);
  flute(128, LEAD_IN, 0.06);

  // Siesta: a second guitar across the stage answers in the gaps of the held chords.
  const FILL: Line = [
    [5, 'G4', 0.5],
    [5.5, 'Bb4', 0.5],
    [6, 'D5', 1.5],
    [8.5, 'C5', 0.5],
    [9, 'D5', 0.5],
    [9.5, 'A4', 2],
    [13, 'Bb4', 0.5],
    [13.5, 'G4', 0.5],
    [14, 'F4', 1.5],
  ];
  for (const [beat, name, length] of FILL)
    score.note(128 + beat, midi(name), length, 'nylon', 0.15, 0.22);

  return score.done();
}
