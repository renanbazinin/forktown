// "Blue Before Dawn": the town's tune for 04:15–06:00, while the sky turns from ink to blue. A
// glow pad holds the room, crickets sing in the dark and a harp climbs out of its low strings,
// finding the tune before a wooden flute sings it; the first birds wake for the dawn. A minor
// turning to C, 70 bpm, eight phrases of four bars: 109.7 s, a little longer than its 105 s on
// air, so the town hears it once, dark to dawn, and never the dark opening again before Kettle On.
//   1 Ink         (Am)  pad, low open fifths on the harp, crickets
//   2 Deep blue   (Am)  the harmony moves; the harp rises and falls in pairs of bars
//   3 First light (F–G) the harp finds the call, then climbs over a rising bass (E F# G)
//   4 A    (Am)  the flute's theme: a call that lifts to A, an answer that sinks to B over E7
//   5 A'   (Am)  the call again, reaching C6, its answer rising into G7
//   6 B    (C)   dawn: the call in C, up to D6, and the harp answers; the first birds
//   7 A''  (C)   the theme in the light, settling on G7
//   8 Coda (C)   G7 lands on C at last; the harp echoes the call as the light dims (F to Fm),
//                the birds fall quiet, and G7 falls back into A minor (and the dark) at the top
import { midi, Score, type Note, type TuneInfo } from './kit';

export const BEFORE_DAWN: TuneInfo = {
  title: 'Blue Before Dawn',
  subtitle: 'The last stars go out',
  bpm: 70,
  beats: 128,
  bar: 4,
  hall: { wet: 0.3, size: 0.8, damp: 0.45 },
  instruments: 'Glow pad, harp, wooden flute, crickets, first birds',
};

// A phrase each, every part a line of 'note/beats' steps that fills the phrase (a bare note is
// one beat, 'r' a rest, '+' joins notes struck together, '|' a bar line). The harp plays a bass,
// open arpeggios that keep clear of the flute's long notes, and in places a line of its own; the
// pad is two voices, each holding through common tones, at the phrase's level.
type Line = readonly [steps: string, gain: number];
const PHRASES: readonly {
  bass: string;
  pad: readonly [lower: string, upper: string, level: number];
  harp: Line;
  line?: Line;
  flute?: Line;
}[] = [
  {
    // 1 Ink: Am7 | Am7 | Fmaj7 | Fmaj7. Fifths low on the harp, each second bar an echo higher.
    bass: 'A1+A2/8 | F2/8',
    pad: ['G4/8 | A4/8', 'C5/16', 0.9],
    harp: ['r/1 E3 A3 E4 | r/0.5 A3 E4 A4/1.5 | r/1 A3 F4 C5 | r/0.5 C4 A4 E5/1.5', 0.064],
  },
  {
    // 2 Deep blue: Am7 | Fmaj7 | Dm9 | Esus4 Em7. Up, down, up, down, from different beats.
    bass: 'A2/4 | F2/4 | D2/4 | E2/4',
    pad: ['G4/4 | A4/10 | G4/2', 'C5/12 | B4/4', 0.9],
    harp: [
      'r/0.5 A3/0.5 E4/0.5 G4/0.5 C5/2 | r/1 C5/0.5 A4/0.5 E4/0.5 C4/1.5 | ' +
        'D4/0.5 F4/0.5 C5/0.5 E5/2.5 | r/0.5 B4/0.5 A4/0.5 E4/0.5 B3/1 G4/1',
      0.064,
    ],
  },
  {
    // 3 First light: Fmaj7 | C/E | D/F# | G7sus4 G7. The call's head over C4 and A4, then a climb.
    bass: 'F2/4 | E2/4 | F#2/4 | G2/4',
    pad: ['F4/4 | E4/4 | F#4/4 | F4/4', 'A4/4 | G4/4 | A4/4 | C5/2 B4/2', 0.88],
    harp: [
      'C4/1 A4/3 | r/1 C4/2 E4/1 | r/0.5 D4/0.5 A4/0.5 D5/0.5 F#5/2 | ' +
        'r/0.5 G3/0.5 D4/0.5 G4/0.5 B4/1 D5/1',
      0.062,
    ],
    line: ['r/0.5 E5/1.5 D5/0.5 E5/0.5 A5 | G5/1.5 E5/0.5 C5/2 | r/8', 0.088],
  },
  {
    // 4 A: Am7 | Fmaj7 | Dm7 | Esus4 E7. The flute's theme, the harp's spread kept under it.
    bass: 'A2/4 | F2/4 | D2/4 | E2/2 G#2/2',
    pad: ['E4/4 | F4/8 | E4/4', 'C5/4 | A4/10 G#4/2', 0.8],
    harp: [
      'A3/1 E4/0.5 A4/2.5 | r/0.5 A4/0.5 F4/1 A3/2 | A3/1.5 D4/1 A4/1.5 | r/0.5 B3/0.5 E4/2 D4/1',
      0.055,
    ],
    flute: [
      'r/0.5 E5/1.5 D5/0.5 E5/0.5 A5 | G5/1.5 E5/0.5 C5/2 | r/0.5 D5/0.5 F5 E5 D5/0.5 C5/0.5 | ' +
        'B4/1.5 A4/0.5 B4/2',
      0.034,
    ],
  },
  {
    // 5 A': Am7 | Fmaj7 | C/E | Dm7 G7. The call reaching higher; the harp's floor rises to C4.
    bass: 'A2/4 | F2/4 | E2/4 | D2/2 G2/2',
    pad: ['E4/12 | F4/4', 'A4/8 | G4/4 | A4/2 B4/2', 0.82],
    harp: [
      'C4/1 G4/0.5 A4/2.5 | A3/1 E4/1 C5/2 | C4/1 G4/1.5 C5/1.5 | r/0.5 A3/0.5 D4/1.5 G3/0.5 F4/1',
      0.055,
    ],
    flute: [
      'r/0.5 E5/1.5 D5/0.5 E5/0.5 A5 | C6/1.5 B5/0.5 A5/2 | r/0.5 G5 E5/0.5 G5 A5 | ' +
        'F5/1.5 E5/0.5 D5/2',
      0.036,
    ],
  },
  {
    // 6 B, dawn: Cadd9 | G/B | Am7 | Fmaj7. The call turned to C (5 4 5 1), up to D6, and the
    // harp's answer; no E under the flute's passing F.
    bass: 'C3/4 | B2/4 | A2/4 | F2/4',
    pad: ['G4/12 | A4/4', 'D5/8 | C5/8', 1],
    harp: ['C4/1 G4/0.5 D5/2.5 | r/0.5 D4/0.5 G4/1 D5/2 | r/0.5 A3/1 E4/2.5 | r/1 C4/3', 0.064],
    line: ['r/8 | r/2.5 C5/0.5 E5/0.5 G5/0.5 | A5/1.5 G5/0.5 E5/1.5 D5/0.5', 0.105],
    flute: ['r/0.5 G5/1.5 F5/0.5 G5/0.5 C6 | D6/2.5 C6/0.5 B5 | A5/2.5 r/1.5 | r/4', 0.038],
  },
  {
    // 7 A'': C/E | Fmaj7 | Dm7 | F/G G7. The theme in the light; its long C and B sung alone.
    bass: 'E2/4 | F2/4 | D2/4 | G2/4',
    pad: ['G4/4 | F4/12', 'C5/4 | A4/10 G4/2', 0.78],
    harp: [
      'G3/1 C4/0.5 G4/2.5 | r/0.5 A3/0.5 F4/3 | D4/1.5 A4/1 C5/1.5 | r/0.5 C4/0.5 F4/1.5 G3/1.5',
      0.05,
    ],
    flute: [
      'r/0.5 E5/1.5 D5/0.5 E5/0.5 A5 | G5/1.5 E5/0.5 C5/2 | r/0.5 F5/0.5 A5 G5 F5/0.5 E5/0.5 | ' +
        'D5/1.5 C5/0.5 B4/2',
      0.035,
    ],
  },
  {
    // 8 Coda: Cadd9 | F/C | Fm/C | G7sus4 G7, over a low C. The flute's B lands on C; the harp
    // echoes the call (its answer darkened by A flat) and falls through G7 to the top.
    bass: 'C2/8 | C2/4 | G2/4',
    pad: ['E4/4 | F4/8 | G4/4', 'G4/4 | A4/4 | Ab4/4 | C5/2 B4/2', 0.78],
    harp: ['r/1 G4/1 E5/2 | r/4 | r/4 | r/0.5 D4/0.5 F4/1 B4/0.5 G4/0.5 D4/0.5 G3/0.5', 0.05],
    line: ['r/4 | r/0.5 G5/1.5 F5/0.5 G5/0.5 C6 | Ab5/1.5 F5/0.5 C5/2 | r/4', 0.078],
    flute: ['C5/3 r/1 | r/12', 0.03],
  },
];
const PHRASE = 16;
const BASS = 0.08;

export function composeBeforeDawn(): Note[] {
  const score = new Score(BEFORE_DAWN.beats, { timing: 0.015, loudness: 0.06 });
  // A line's notes, [beat in the phrase, pitch, beats], checked to fill its phrase.
  const read = (text: string) => {
    const notes: [number, number, number][] = [];
    let at = 0;
    for (const token of text.split(/\s+/)) {
      if (token === '|') continue;
      const [name, beats = '1'] = token.split('/');
      if (name !== 'r')
        for (const pitch of name.split('+')) notes.push([at, midi(pitch), Number(beats)]);
      at += Number(beats);
    }
    if (at !== PHRASE) throw new Error(`A line of ${at} beats: ${text}`);
    return notes;
  };
  const harpPan = (pitch: number) => Math.max(-0.3, Math.min(0.45, (pitch - 62) / 40));

  PHRASES.forEach(({ bass, pad, harp, line, flute }, p) => {
    const start = p * PHRASE;
    // The harp's bass, a little left of centre.
    for (const [at, pitch, length] of read(bass))
      score.note(start + at, pitch, length, 'harp', BASS, -0.05);
    // The pad's two voices, each breathing in again at the phrase's start.
    const [lower, upper, level] = pad;
    for (const voice of [lower, upper])
      for (const [at, pitch, length] of read(voice))
        score.note(start + at, pitch, length - 0.1, 'glow', 0.036 * level);
    // The harp's arpeggios and its own line, spread by pitch as the strings are.
    for (const [steps, gain] of line ? [harp, line] : [harp])
      for (const [at, pitch, length] of read(steps))
        score.note(start + at, pitch, length, 'harp', gain, harpPan(pitch));
    // The flute, a little left of the harp, each note tongued a touch short of the next; the
    // theme's last bar in the light eases off.
    if (flute)
      for (const [at, pitch, length] of read(flute[0])) {
        const easing = p === 6 && at >= 12 ? 0.85 : 1;
        score.note(start + at, pitch, length - 0.08, 'flute', flute[1] * easing, -0.15);
      }
  });
  // The loop's first beat answers the coda's last B with a soft C5 over the low A.
  score.note(0, midi('C5'), 2, 'harp', 0.05, 0.2);

  // Crickets in the dark, fading as the sky pales (in key: they sing A and its fifth).
  score.note(0.5, midi('A4'), 15.5, 'crickets', 0.2);
  score.note(16, midi('A4'), 16, 'crickets', 0.16);
  score.note(32, midi('A4'), 8, 'crickets', 0.11);
  // The first birds (on C's pentatonic): a distant one in the dawn's second bar, nearer through
  // the theme in the light and the coda's C. They are quiet by the time the light dims (bar 31,
  // 7 s before the top), so the loop starts in the dark again.
  score.note(84, midi('C4'), 12, 'birds', 0.15);
  score.note(96, midi('C4'), 16, 'birds', 0.19);
  score.note(112, midi('C4'), 7, 'birds', 0.2);
  return score.done();
}
