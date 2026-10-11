// "Lamplighter's Round": the town's tune for 21:00–22:15, straight after the evening concert. A
// late jazz ballad, swung: the vibes sing a little climb (up a fourth, up a fourth, lean,
// settle) like a lamplighter up a ladder, the electric piano comps rootless voicings, the
// upright walks through the bridge, brushes circle and the crickets keep on outside. Written in
// Db (the names below) and played a semitone lower, in C, so its closing ii–V leads straight into
// Porch Lights' C. Six phrases of four bars, one long breath that comes back round to its start:
//   1 A    (Db)  the climb on Db, a falling answer, the climb a step higher on Ebm; I–vi–ii–V
//   2 A'   (Db)  the answer bends out to Bb7's b13 and steps home to Db; the piano lights a lamp
//   3 B    (Gb)  the bridge: ii–V to Gb, then the backdoor (Gbm, Cb7) round to Fm and Bb7
//   4 B'   (Ebm) the peak in thirds (Bb5), down a chromatic stair (Ab G Gb F), then a climb
//                (A Bb C Eb) over the V that hands the round its first lamp
//   5 A''  (Db)  the round: the vibes sing the climb, the piano echoes it a bar later, lower
//   6 C    (Db)  the answer once more, home on Db, and a ii–V that leads back to the top
import { midi, Score, type Note, type TuneInfo } from './kit';

export const LAMPLIGHT: TuneInfo = {
  title: "Lamplighter's Round",
  subtitle: 'The lamps come on, one by one',
  bpm: 68,
  beats: 96,
  bar: 4,
  hall: { wet: 0.3, size: 0.72, damp: 0.5 },
  instruments: 'Vibraphone, electric piano, upright bass, brushes, crickets',
};

export function composeLamplight(): Note[] {
  const PHRASE = 16;
  const score = new Score(LAMPLIGHT.beats, { timing: 0.015, loudness: 0.07 });
  // Swung eighths: an off-beat falls nearly a triplet late.
  const swing = (beat: number) => {
    const whole = Math.floor(beat + 1e-6);
    return Math.abs(beat - whole - 0.5) < 1e-6 ? whole + 0.64 : beat;
  };
  // Each phrase's level, eased into the next: up to the bridge's peak, back down for the round.
  const lift = [0.93, 0.97, 1.03, 1.08, 1.04, 0.92];
  const level = (beat: number) => {
    const phrase = Math.floor(beat / PHRASE),
      through = (beat % PHRASE) / PHRASE;
    return lift[phrase] + (lift[(phrase + 1) % lift.length] - lift[phrase]) * through;
  };
  // A phrase written as 'name/beats' steps ('r' a rest, 'F5.Db5' a double stop; '|' marks bars,
  // and a note may ring over one), each laid on the straight beat and swung.
  const read = (text: string) => {
    const steps: { at: number; names: string[]; length: number }[] = [];
    let at = 0;
    for (const token of text.split(' ')) {
      if (token === '|' || !token) continue;
      const [names, beats] = token.split('/');
      if (names !== 'r') steps.push({ at, names: names.split('.'), length: Number(beats) });
      at += Number(beats);
    }
    if (at !== PHRASE) throw new Error(`A phrase of ${at} beats: ${text}`);
    return steps;
  };
  // Plays one phrase on a voice: `trim` shortens each note by beats, `scale` by share; a double
  // stop's lower notes are softer.
  const sing = (
    phrase: number,
    text: string,
    voice: Note['voice'],
    gain: number,
    pan: number,
    { trim = 0, scale = 1 } = {},
  ) => {
    for (const { at, names, length } of read(text)) {
      const from = phrase * PHRASE + at,
        start = swing(from),
        end = swing(from + length);
      names.forEach((name, i) =>
        score.note(
          start,
          midi(name),
          (end - start) * scale - trim,
          voice,
          gain * level(from) * (i ? 0.55 : 1),
          pan,
        ),
      );
    }
  };

  // The vibes' tune. Its pedal is the written length; the damper's short fall joins the notes up.
  const vibes = (phrase: number, text: string) =>
    sing(phrase, text, 'vibes', 0.084, 0.2, { trim: 0.02 });
  vibes(0, 'Ab4/.5 Db5/.5 Gb5/1 F5/2.75 | r/.75 Eb5/.5 Db5/1 C5/1 | Bb4/.5 Eb5/.5 Ab5/1 Gb5/2.75 | r/.75 F5/.5 Eb5/.5 C5/1.5'); // prettier-ignore
  vibes(1, 'Ab4/.5 C5/.5 F5/1 Ab5/1.5 Gb5/.5 | F5/2.5 Eb5/.5 Db5/1 | Eb5/1 Db5/1 C5/2 | Db5/2 r/2'); // prettier-ignore
  vibes(2, 'r/.5 Eb5/.5 Gb5/1 F5/1.5 Eb5/.5 | Db5/1.5 F5/.5 Ab5/2 | A5/1.5 Ab5/.5 Gb5/1 Eb5/1 | C5/1.5 Eb5/.5 D5/1.5 r/.5'); // prettier-ignore
  vibes(3, 'F5/1 Gb5/.5 Bb5.Gb5/2.5 | Ab5.F5/1.5 Gb5/.5 G5.E5/1.5 Gb5/.5 | F5.Db5/1.5 Eb5/.5 Db5/1 A4/1 | Bb4/.5 C5/1 Eb5/2 r/.5'); // prettier-ignore
  vibes(4, 'Ab4/.5 Db5/.5 Gb5/1 F5/2.75 | r/3.25 | Bb4/.5 Eb5/.5 Ab5/1 Gb5/2.75 | r/3.25');
  vibes(5, 'Ab4/.5 C5/.5 F5/1 Ab5/1.5 Gb5/.5 | F5/1.5 Gb5/.5 F5/1 Eb5/1 | Db5/2 F5/1.5 Eb5/.5 | Db5/1.5 r/1 Eb5/.5 C5/1'); // prettier-ignore

  // The piano's answers: a lamp lit at the end of the first A, and the round in the last.
  const answer = (phrase: number, text: string) =>
    sing(phrase, text, 'epiano', 0.09, -0.15, { trim: 0.05 });
  answer(1, 'r/14 F4/.5 Ab4/.5 Bb4/1');
  answer(4, 'r/4 Ab3/.5 Db4/.5 Gb4/1 F4/2 | r/4 Bb3/.5 Eb4/.5 Ab4/1 Gb4/2');

  // Rootless voicings, kept a minor ninth clear of the tune and of the piano's own echo: a 6/9
  // where it sings Db, an Ebm7 without its ninth where it sings Gb, and bare shells under the
  // round.
  const VOICINGS: Record<string, readonly string[]> = {
    Db69: ['F3', 'Ab3', 'Bb3', 'Eb4'],
    Bbm11: ['F3', 'Ab3', 'Db4', 'Eb4'],
    Ebm9: ['Gb3', 'Bb3', 'Db4', 'F4'],
    Ebm7: ['Gb3', 'Bb3', 'Db4'],
    Ab9: ['Gb3', 'Bb3', 'C4'],
    Ab13: ['Gb3', 'C4', 'F4'],
    Fm7: ['Ab3', 'C4', 'Eb4'],
    Bb7b13: ['Ab3', 'D4', 'Gb4'],
    Bb13: ['Ab3', 'D4', 'G4'],
    Abm7: ['Gb3', 'Cb4', 'Eb4'],
    Db9: ['F3', 'Cb4', 'Eb4'],
    Gbmaj9: ['Bb3', 'Db4', 'F4', 'Ab4'],
    Gbm7: ['A3', 'Db4', 'E4'],
    Cb13: ['A3', 'Eb4', 'Ab4'],
    Edim7: ['Bb3', 'Db4', 'E4'],
    Gbm6: ['A3', 'Db4', 'Eb4'],
    Db: ['F3', 'Ab3'],
    Ab: ['Gb3', 'C4'],
  };
  // Each phrase's comping, a voicing per step; a '-' re-strikes softly. Notes roll up a little.
  // A phrase's first bar is struck on the one; after that the piano mostly keeps off it, coming
  // in on the swung and of one under a note the vibes hold, pushing a change on the and of four
  // (often with the vibes' own push) or filling a gap the tune leaves.
  const comp = (phrase: number, text: string) => {
    for (const { at, names, length } of read(text)) {
      const soft = names[0].startsWith('-'),
        voicing = VOICINGS[names[0].replace('-', '')];
      const from = phrase * PHRASE + at,
        start = swing(from),
        end = swing(from + length) - 0.15;
      const gain = (voicing.length > 3 ? 0.045 : 0.051) * (soft ? 0.75 : 1) * level(from);
      voicing.forEach((name, i) =>
        score.note(start + i * 0.02, midi(name), end - start - i * 0.02, 'epiano', gain, -0.2),
      );
    }
  };
  comp(0, 'Db69/4 | r/.5 Bbm11/2 -Bbm11/1.5 | Ebm7/3.5 Ab9/3 -Ab13/1.5');
  comp(1, 'Fm7/2 Bb7b13/2 | r/.5 Ebm9/3 -Ebm9/2.5 Ab13/2 | r/.5 Db69/1.5 r/2');
  comp(2, 'Abm7/2 Db9/1.5 Gbmaj9/2 -Gbmaj9/2.5 | Gbm7/1.5 Cb13/2.5 | Fm7/2 Bb13/2');
  comp(3, 'Ebm7/1.5 -Ebm7/2.5 | Fm7/2 Edim7/1.5 Ebm7/2.5 Gbm6/2 | r/.5 Ab9/2 -Ab13/1.5');
  // The round: the echo climbs alone, and each shell comes in under the note it lands on.
  comp(4, 'Db69/4 | r/2 Db/2 | Ebm7/4 | r/2 Ab/2');
  comp(5, 'Fm7/1.5 Bb7b13/2.5 | r/.5 Ebm7/1.5 Ab13/2 | Db69/1.5 Bbm11/2 Ebm9/2 Ab13/2.5');

  // The upright: a two-feel in the A sections with a chromatic step into some bars, walking
  // quarters through the bridge; the last bar's C leads back to the top's Db.
  const bass = (phrase: number, text: string) =>
    sing(phrase, text, 'upright', 0.109, 0, { scale: 0.9 });
  bass(0, 'Db2/2 Ab1/1.5 A1/.5 | Bb1/2 F2/2 | Eb2/2 Bb1/2 | Ab1/2 Eb2/1.5 E2/.5');
  bass(1, 'F2/2 Bb1/2 | Eb2/2 Bb1/1.5 A1/.5 | Ab1/2 Eb2/1.5 C2/.5 | Db2/2 F2/1 G2/1');
  bass(2, 'Ab2/1 Eb2/1 Db2/1 F2/1 | Gb2/1 Ab2/1 Bb2/1 Ab2/1 | Gb2/1 A2/1 Cb3/1 Gb2/1 | F2/1 C2/1 Bb1/1 D2/1'); // prettier-ignore
  bass(3, 'Eb2/1 Bb1/1 Db2/1 E2/1 | F2/1 Ab2/1 E2/1 Db2/1 | Eb2/1 Bb1/1 Gb2/1 A1/1 | Ab1/1 C2/1 Eb2/1 C2/1'); // prettier-ignore
  bass(4, 'Db2/2 Ab1/1.5 A1/.5 | Bb1/2 F2/2 | Eb2/2 Bb1/2 | Ab1/2 Eb2/1.5 E2/.5');
  bass(5, 'F2/2 Bb1/2 | Eb2/2 Ab1/1.5 C2/.5 | Db2/2 Bb1/2 | Eb2/2 Ab1/1.5 C2/.5');

  // Brushes, lit one by one like the lamps: the first A only circles, taps on two and four come
  // in with A' (a ghost before each bar), the bridge adds a ghost after two and B' lets its last
  // bar go quiet; the round circles alone again under the echo, and the taps come back for C.
  // A soft tap on the last and of A, A' and the round leads the next phrase in.
  const TAP = [0, 0.1, 0.12, 0.12, 0, 0.1],
    SWEEP = [0.05, 0.06, 0.065, 0.065, 0.05, 0.06];
  for (let bar = 0; bar < LAMPLIGHT.beats / 4; bar++) {
    const at = bar * 4,
      phrase = Math.floor(at / PHRASE),
      tap = TAP[phrase],
      sweep = SWEEP[phrase],
      bridge = phrase === 2 || phrase === 3,
      breath = bar === 15,
      pickup = bar === 3 || bar === 7 || bar === 19;
    const hit = (beat: number, voice: Note['voice'], length: number, gain: number, pan: number) =>
      score.note(swing(at + beat), 60, length, voice, gain * level(at + beat), pan);
    hit(0, 'swish', 2, sweep, -0.15);
    hit(2, 'swish', 2, sweep, -0.15);
    if (tap) hit(1, 'brush', 0.25, tap, 0.15);
    if (tap && !breath) hit(3, 'brush', 0.25, tap, 0.15);
    if (tap && bridge) hit(1.5, 'brush', 0.25, 0.035, 0.15);
    const ghost = pickup ? 0.06 : breath ? 0 : tap / 3;
    if (ghost) hit(3.5, 'brush', 0.25, ghost, 0.15);
  }

  // Crickets outside, a note a phrase, singing the key's fifth (Ab): a touch nearer in the open
  // phrases, a touch further off under the bridge.
  const CRICKETS = [0.19, 0.18, 0.165, 0.165, 0.19, 0.18];
  for (let phrase = 0; phrase < 6; phrase++)
    score.note(phrase * PHRASE, midi('Ab4'), PHRASE, 'crickets', CRICKETS[phrase], 0);

  return score.done({ transpose: -1 });
}
