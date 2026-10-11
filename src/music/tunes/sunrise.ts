// "Kettle On": the town's tune for 06:00–07:45, G major at 76 bpm, 32 bars (A A' B A'').
// A felt piano sings a small call (D–E–G, up to the light) and its answer, at first alone; the
// upright bass wakes in the second phrase, nylon guitar arpeggios join in A', the bridge dips
// into long, tied notes and then climbs on a rising bass to the loop's one high B, and A''
// brings a whisper of shaker before the last bars settle on D and lead back to the quiet
// start. Birds sing under it all.
import { midi, Score, type Note, type Step, type TuneInfo } from './kit';

export const SUNRISE: TuneInfo = {
  title: 'Kettle On',
  subtitle: 'The first curtains open',
  bpm: 76,
  beats: 128,
  bar: 4,
  hall: { wet: 0.24, size: 0.65, damp: 0.42 },
  instruments: 'Felt piano, nylon guitar, upright bass, birds, shaker',
};

export function composeSunrise(): Note[] {
  const score = new Score(SUNRISE.beats, { timing: 0.012, loudness: 0.06 });

  // A bar a cell; a second chord takes the bar's second half.
  const chart = [
    ...['G', 'C/G', 'Em7', 'Dsus4 D', 'G/B', 'Cadd9', 'Am7 D/F#', 'G'], // A: call and answer
    ...['G', 'C/G', 'Em7', 'Dsus4 D', 'G/B', 'Cadd9', 'Am7 D7', 'G G7'], // A': the guitar joins
    ...['Cmaj7', 'D/C', 'Bm7', 'Em7', 'Am7', 'Bm7', 'Cmaj7', 'D7sus4 D7'], // B: the bass climbs
    ...['G', 'C/G', 'Em7', 'Dsus4 D', 'G/B', 'Cadd9', 'Am7', 'D7sus4 D'], // A'': home, then D
  ];
  // Voicings: the piano's open left hand (low), its middle chord (mid), the guitar (low to high).
  const voicing: Record<string, { low: number[]; mid: number[]; guitar: number[] }> = {
    G: { low: [43, 50], mid: [59, 62, 67], guitar: [55, 62, 67, 71] },
    'C/G': { low: [43, 55], mid: [60, 64], guitar: [55, 60, 64, 67] },
    Em7: { low: [40, 47], mid: [55, 59, 62], guitar: [52, 59, 62, 67] },
    Dsus4: { low: [38, 45], mid: [55, 57, 62], guitar: [50, 57, 62, 67] },
    D: { low: [38, 45], mid: [54, 57, 62], guitar: [50, 57, 62, 66] },
    'G/B': { low: [35, 47], mid: [55, 62, 67], guitar: [47, 55, 62, 67] },
    Cadd9: { low: [36, 43], mid: [55, 62, 64], guitar: [48, 55, 62, 64] },
    Am7: { low: [45, 52], mid: [55, 60, 64], guitar: [45, 52, 55, 60] },
    'D/F#': { low: [42, 50], mid: [57, 62, 66], guitar: [42, 50, 57, 62] },
    D7: { low: [38, 45], mid: [54, 57, 60], guitar: [50, 57, 60, 66] },
    G7: { low: [43, 50], mid: [53, 59, 62], guitar: [55, 62, 65, 71] },
    Cmaj7: { low: [36, 43], mid: [52, 55, 59], guitar: [48, 55, 59, 64] },
    'D/C': { low: [36, 48], mid: [54, 57, 62], guitar: [48, 54, 57, 62] },
    Bm7: { low: [35, 42], mid: [54, 57, 62], guitar: [47, 54, 57, 62] },
    D7sus4: { low: [38, 45], mid: [55, 57, 60], guitar: [50, 57, 60, 67] },
  };
  // The bridge's second half: the piano's pulse as a dyad above the guitar, under the tune.
  const pulse: Record<string, number[]> = {
    Am7: [64, 67],
    Bm7: [69, 74],
    Cmaj7: [67, 71],
    D7sus4: [62, 69],
    D7: [62, 66],
  };

  // A line in note names, one after another: 'D5:.5' is D5 for half a beat, '_:1' a beat's rest.
  const line = (text: string): Step[] => {
    const steps: Step[] = [];
    let at = 0;
    for (const token of text.split(/[\s|]+/).filter(Boolean)) {
      const [name, length] = token.split(':');
      if (name !== '_') steps.push([at, midi(name), Number(length)]);
      at += Number(length);
    }
    return steps;
  };

  // The felt piano's tune, a phrase (four bars) a line.
  const call =
    '_:1 D5:.5 E5:.5 G5:1.5 F#5:.5 | E5:2.5 _:1.5 | _:1 B4:.5 D5:.5 E5:1 D5:.5 B4:.5 | A4:3 _:1';
  const tune = [
    call,
    '_:1 D5:.5 E5:.5 G5:1 A5:1 | G5:1.5 E5:.5 D5:2 | E5:1 C5:1 D5:1.5 C5:.5 | B4:2.5 _:1.5',
    '_:1 D5:.5 E5:.5 G5:1.5 A5:.5 | G5:1 E5:1.5 _:1.5 | _:1 B4:.5 D5:.5 E5:1 G5:.5 E5:.5 | D5:2 A4:1.5 _:.5',
    '_:1 D5:.5 E5:.5 G5:1 A5:1 | G5:1.5 E5:.5 D5:1 E5:1 | C5:1.5 B4:.5 A4:1 C5:1 | B4:2 _:2',
    // B: first a dip, on the downbeat, in long notes tied over the bar...
    'E5:2 D5:1 B4:1 | A4:2 D5:1 F#5:3 | E5:1 D5:1 | B4:3 _:1',
    // ...then the call's own cell climbs to the high B and falls by step to the dominant.
    '_:1 C5:.5 E5:.5 G5:2 | F#5:1 G5:.5 A5:.5 B5:2 | A5:1 G5:1 E5:1.5 D5:2 | C5:.5 A4:2',
    call,
    '_:1 D5:.5 E5:.5 G5:1 A5:1 | G5:1.5 E5:.5 D5:2 | E5:1.5 D5:.5 C5:1 B4:1 | A4:3 _:1',
  ];
  // The upright's line, from the second phrase on.
  const bass = [
    '',
    'B1:2 D2:2 | C2:2 E2:2 | A1:2 F#2:2 | G2:2 D2:1.5 F#2:.5',
    'G2:2 D2:2 | G2:2 C2:2 | E2:2 B1:2 | D2:2 A1:2',
    'B1:2 D2:2 | C2:2 E2:2 | A1:2 D2:2 | G2:2 A2:1 B2:1',
    'C3:2 G2:2 | C3:2 D3:1 C3:1 | B2:2 F#2:2 | E2:2 F#2:1 G2:1',
    'A2:2 E2:2 | B2:2 F#2:2 | C3:2 G2:2 | D3:2 A2:1.5 F#2:.5',
    'G2:2 D2:2 | G2:2 C2:2 | E2:2 B1:2 | D2:2 A1:2',
    'B1:2 D2:2 | C2:2 E2:2 | A1:2 E2:2 | D2:3.5 _:.5',
  ];
  // A gentle arc over the loop: quiet start, the bridge's climb at the top, a settling last
  // phrase. The band (piano chords, guitar, bass) follows it, but at the peak only the tune lifts.
  const swell = [0.92, 0.96, 1, 0.98, 1, 1.08, 0.98, 0.9];
  const band = [0.92, 0.96, 1, 0.96, 1, 1, 0.98, 0.9];

  for (let phrase = 0; phrase < 8; phrase++) {
    const at = phrase * 16;
    const lift = swell[phrase];
    const melody = line(tune[phrase]).map(([o, p, l]) => [o, p, l - 0.04] as const);
    score.line(at, melody, 'felt', 0.125 * lift, 0.12);
    if (bass[phrase]) {
      const steps = line(bass[phrase]).map(([o, p, l]) => [o, p, l * 0.9] as const);
      score.line(at, steps, 'upright', 0.105 * band[phrase], -0.02);
    }
  }
  // The answer to the first call: the piano's own echo, down an octave.
  score.line(4, line('_:2.5 G4:.5 E4:.5 D4:.5'), 'felt', 0.06, -0.1);

  chart.forEach((cell, bar) => {
    const phrase = Math.floor(bar / 4);
    const lift = band[phrase];
    const chords = cell.split(' ');
    chords.forEach((symbol, half) => {
      const { low, mid, guitar } = voicing[symbol];
      const span = chords.length === 1 ? 4 : 2;
      const at = bar * 4 + half * 2;
      const end = at + span;
      // Piano: alone, a rolled open chord; later it leaves the low end to the bass.
      if (phrase === 0 || bar === 31) {
        if (half === 0) score.chord(at, low, span - 0.15, 'felt', 0.056 * lift, { strum: 0.06 });
        score.chord(at + 0.12, mid, span - 0.3, 'felt', 0.035 * lift, {
          strum: 0.05,
          spread: 0.25,
          pan: 0.06,
        });
      } else if (phrase === 1) {
        score.chord(at, mid, Math.min(2, span) - 0.15, 'felt', 0.045 * lift, {
          spread: 0.25,
          pan: 0.06,
        });
        if (span === 4)
          score.chord(at + 2, mid, 1.85, 'felt', 0.032 * lift, { spread: 0.25, pan: 0.06 });
      } else if (phrase === 5) {
        // The bridge's climb: a lifted pulse, on the beat and just after the second. (In its
        // dip, the four bars before, the piano leaves the chords to the guitar.)
        const dyad = pulse[symbol];
        score.chord(at, dyad, 1.4, 'felt', 0.042 * lift, { spread: 0.2, pan: 0.06 });
        if (span === 4)
          score.chord(at + 1.5, dyad, 2.3, 'felt', 0.03 * lift, { spread: 0.2, pan: 0.06 });
      } else if (phrase !== 4) {
        score.chord(at, mid, span - 0.2, 'felt', 0.034 * lift, {
          strum: 0.04,
          spread: 0.25,
          pan: 0.06,
        });
      }
      // Guitar: from A' on, rolling eighths; quarters at the start of the bridge. In the bridge it
      // leaves its lowest string to the climbing bass, which it would only double.
      if (phrase < 2) return;
      const quarters = phrase === 4;
      const bridge = phrase === 4 || phrase === 5;
      const pattern = bridge
        ? quarters
          ? [0, 1, 2, 1]
          : [0, 1, 2, 1, 0, 1, 2, 1]
        : [0, 2, 3, 2, 1, 2, 3, 2];
      const step = quarters ? 1 : 0.5;
      // The loop's last half bar is one slow roll, a breath before the quiet start.
      if (bar === 31 && half === 1) {
        score.chord(at, guitar, 1.9, 'nylon', 0.05, { strum: 0.12, pan: -0.38, spread: 0.1 });
        return;
      }
      const sorted = [...guitar].sort((a, b) => a - b).slice(bridge ? 1 : 0);
      for (let i = 0; i * step < span; i++) {
        const t = at + i * step;
        const pitch = sorted[pattern[(half * (span / step) + i) % pattern.length]];
        // It comes in a shade softer in its first bar, and carries the bridge's dip alone.
        const accent =
          (i === 0 ? 1.15 : i % 2 ? 0.88 : 1) * (bar === 8 ? 0.85 : quarters ? 1.25 : 1);
        const ring = Math.min(quarters ? 2 : 1.5, end - t - 0.05);
        score.note(t, pitch, ring, 'nylon', 0.06 * lift * accent, -0.38);
      }
    });
  });

  // A very light shaker through A'' (bars 25–31), fading in.
  for (let bar = 24; bar < 31; bar++) {
    const fade = Math.min(1, 0.55 + (bar - 24) * 0.15);
    score.hits(bar * 4, 'oxoxoxox', 'shaker', 0.075 * fade, { step: 0.5, pitch: 57, pan: 0.38 });
  }
  // Birds outside, a long note a phrase: G major's own pentatonic, then D's (all in G) for the
  // last two, where the blackbird's G-home phrases fall quiet.
  for (let at = 0; at < SUNRISE.beats; at += 16)
    score.note(at, at >= 96 ? 74 : 67, 16, 'birds', 0.12);

  return score.done();
}
