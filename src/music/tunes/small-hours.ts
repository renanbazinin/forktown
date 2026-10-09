// "Small Hours": the town's tune for 02:30–04:15, when everyone is asleep. A lullaby in D: a music
// box sings it, a small choir hums under it, a low harp marks the bars and crickets keep on
// outside. Six phrases of four bars, one long breath that comes back round to its start:
//   1 A    (D)  the music box's tune: up to the fifth and down, a half close on A
//   2 A'   (D)  the tune again, reaching to B, home on D
//   3 B    (Bm) the choir sings a minor middle over a falling bass, felt piano under it
//   4 B'   (G)  the music box climbs to its high B, the choir rising too: the swell of the loop
//   5 A''  (D)  the tune comes home, the harp rocking under it
//   6 C    (Bm) almost nothing: long notes, then up through A to the tune's first note
import { midi, Score, type Note, type TuneInfo } from './kit';

export const SMALL_HOURS: TuneInfo = {
  title: 'Small Hours',
  subtitle: 'Everyone asleep but the crickets',
  bpm: 62,
  beats: 96,
  bar: 4,
  hall: { wet: 0.32, size: 0.82, damp: 0.45 },
  instruments: 'Music box, choir, harp, felt piano, crickets',
};

export function composeSmallHours(): Note[] {
  const PHRASE = 16;
  const score = new Score(SMALL_HOURS.beats, { timing: 0.015, loudness: 0.06 });
  // Each phrase's level: a slow swell to the fourth, then settling back for the quiet sixth.
  const lift = [0.88, 0.94, 0.9, 1.15, 0.95, 0.92];

  // A phrase written as "pitch/beats" steps ('r' a rest, '|' a bar line, chords joined by '.').
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
  // A line in one phrase; notes on the beat a little fuller than those between.
  const sing = (phrase: number, text: string, voice: Note['voice'], gain: number, pan = 0) => {
    for (const { at, names, length } of read(text)) {
      const weight = at % 2 === 0 ? 1 : at % 1 === 0 ? 0.92 : 0.8;
      const level = gain * weight * lift[phrase];
      score.note(phrase * PHRASE + at, midi(names[0]), length - 0.06, voice, level, pan);
    }
  };
  // A held bed in one phrase: each part tied over while it keeps its note.
  const hum = (phrase: number, text: string, voice: Note['voice'], gain: number, spread = 0.2) => {
    const chords = read(text);
    const parts = chords[0].names.length;
    for (let part = 0; part < parts; part++) {
      const pan = (part / (parts - 1)) * 2 * spread - spread;
      const tied: { at: number; pitch: number; length: number }[] = [];
      for (const { at, names, length } of chords) {
        const pitch = midi(names[part]),
          last = tied[tied.length - 1];
        if (last && last.pitch === pitch && last.at + last.length === at) last.length += length;
        else tied.push({ at, pitch, length });
      }
      for (const { at, pitch, length } of tied)
        score.note(phrase * PHRASE + at, pitch, length - 0.1, voice, gain * lift[phrase], pan);
    }
  };

  // The music box: the tune (phrases 1, 2, 4, 5, 6) and two small answers to the choir (3).
  const box = 0.1;
  sing(
    0,
    'F#5/1 A5/1.5 F#5/.5 E5/1 | D5/2 B4/1.5 r/.5 | B4/1 D5/1 G5/1.5 F#5/.5 | E5/2 A4/1.5 r/.5',
    'musicbox',
    box,
    0.15,
  );
  sing(
    1,
    'F#5/1 A5/1.5 B5/.5 A5/1 | F#5/2 D5/1.5 r/.5 | B4/1 E5/1 G5/1.5 E5/.5 | D5/3 r/1',
    'musicbox',
    box,
    0.15,
  );
  sing(2, 'r/4 | r/2.5 A5/.5 F#5/1 | r/4 | r/3 F#5/1', 'musicbox', box * 0.5, 0.35);
  sing(
    3,
    'D5/1 G5/1 B5/1.5 A5/2.5 F#5/1 E5/1 | G5/1.5 F#5/.5 E5/1 B4/1 | E5/1 A5/2.5 r/.5',
    'musicbox',
    box,
    0.15,
  );
  sing(
    4,
    'F#5/1 A5/1.5 F#5/.5 E5/1 | D5/2 B4/1.5 r/.5 | D5/1 F#5/1 A5/1.5 F#5/.5 | E5/1.5 G5/.5 E5/1 C#5/1',
    'musicbox',
    box,
    0.15,
  );
  sing(5, 'F#5/3 r/1 | r/1 E5/1 D5/2 | r/1 B4/1 E5/2 | r/1 A4/1 C#5/1 E5/1', 'musicbox', box, 0.15);

  // The choir: a soft "ooh" under the tune, and the minor middle sung out (3).
  const pad = 0.019;
  hum(0, 'A3.D4.F#4/4 | B3.D4.G4/4 | B3.E4.G4/4 | A3.D4.E4/2 A3.C#4.E4/2', 'choir', pad);
  hum(1, 'A3.D4.F#4/4 | B3.D4.G4/4 | B3.E4.G4/2 A3.C#4.G4/2 | A3.D4.F#4/4', 'choir', pad);
  sing(
    2,
    'B4/1.5 C#5/.5 D5/2 | C#5/1 B4/1 A4/2 | B4/1 D5/1 F#5/2 | E5/2 C#5/2',
    'choir',
    0.05,
    -0.05,
  );
  hum(3, 'D4.G4.B4/4 | C#4.E4.A4/4 | B3.E4.G4/4 | A3.D4.E4/2 A3.C#4.E4/2', 'choir', pad);
  hum(4, 'A3.D4.F#4/4 | B3.D4.G4/4 | B3.D4.F#4/4 | B3.E4.G4/2 A3.C#4.G4/2', 'choir', pad);
  hum(5, 'A3.D4.F#4/4 | B3.D4.F#4/4 | B3.D4.F#4/4 | A3.D4.G4/2 A3.C#4.G4/2', 'choir', pad);

  // The felt piano under the choir's middle: soft dyads twice a bar, falling with the bass (3).
  const dyads = 'D4.F#4/2 D4.F#4/2 | C#4.E4/2 C#4.E4/2 | B3.D4/2 B3.D4/2 | B3.C#4/2 A#3.C#4/2';
  for (const { at, names } of read(dyads))
    score.chord(2 * PHRASE + at, names.map(midi), 2, 'felt', at % 4 ? 0.035 : 0.045, {
      strum: 0.06,
      spread: 0.2,
      pan: -0.2,
    });

  // The low harp: a root at each change of chord, ringing on (felt for the quiet sixth phrase).
  const harp = 0.125;
  sing(0, 'D2/4 | D2/4 | E2/4 | A2/4', 'harp', harp, -0.05);
  sing(1, 'D2/4 | D2/4 | E2/2 A2/2 | D2/4', 'harp', harp, -0.05);
  sing(2, 'B2/4 | A2/4 | G2/4 | F#2/4', 'harp', harp, -0.05);
  sing(3, 'G2/4 | F#2/4 | E2/4 | A2/4', 'harp', harp, -0.05);
  sing(4, 'D2/4 | D2/4 | B2/4 | E2/2 A2/2', 'harp', harp, -0.05);
  sing(5, 'B2/4 | G2/4 | E2/4 | A2/4', 'felt', 0.085, -0.05);

  // Higher up, the harp answers the close on D with the tune's first notes (2), and rocks down
  // through each chord under the tune's homecoming (5).
  sing(1, 'r/4 | r/4 | r/4 | r/2.5 F#4/.5 A4/.5 F#4/.5', 'harp', 0.07, -0.3);
  sing(
    4,
    'r/1 F#4/1 D4/1 A3/1 | r/1 G4/1 D4/1 B3/1 | r/1 F#4/1 D4/1 B3/1 | r/1 G4/1 C#4/1 E4/1',
    'harp',
    0.042,
    -0.3,
  );

  // Crickets outside, the whole night through (three long notes, one insect chorus).
  for (let at = 0; at < SMALL_HOURS.beats; at += 32)
    score.note(at, midi('D4'), 32, 'crickets', 0.09);

  return score.done();
}
