// "Window Seat": the town's tune for 13:15–15:00. A slow afternoon with the radio on: lo-fi in
// Eb at a lazy swing, Rhodes chords in ninths and thirteenths, a short motif the electric piano
// and a kalimba pass between them, fingered bass, a felt kick and brushes, and a record's
// crackle under it all. 32 bars (A A' B A''), the last bar's Bb13 handing back to the first.
import { midi, Score, type Note, type TuneInfo } from './kit';

export const AFTERNOON: TuneInfo = {
  title: 'Window Seat',
  subtitle: 'A slow afternoon with the radio on',
  bpm: 80,
  beats: 128,
  bar: 4,
  hall: { wet: 0.2, size: 0.6, damp: 0.5 },
  instruments: 'Electric piano, kalimba, fingered bass, soft kick, brushes, vinyl crackle',
};

export function composeAfternoon(): Note[] {
  const score = new Score(AFTERNOON.beats, { timing: 0.01, loudness: 0.06 });
  // A lazy swing: the off-beat eighth lands at 0.62 of the beat.
  const SWING = 0.12;
  const swung = (beat: number) => (Math.abs((beat % 1) - 0.5) < 1e-6 ? beat + SWING : beat);
  /** Plays "beat:Note:length[:weight]" steps from `at`, off-beat eighths swung. */
  const play = (at: number, text: string, voice: Note['voice'], gain: number, pan = 0) => {
    for (const token of text.trim().split(/\s+/).filter(Boolean)) {
      const [beat, name, length, weight = '1'] = token.split(':');
      const pitch = midi(name);
      score.note(
        at + swung(Number(beat)),
        pitch,
        Number(length),
        voice,
        gain * Number(weight),
        pan,
      );
    }
  };

  // Rootless voicings around middle C (no minor second or ninth inside, none against the tune).
  // A restrike leaves out the voice in brackets, keeping the 3rd and 7th that name the chord,
  // so the second half of the bar still says the same chord over the bass's fifth. Eb13 and
  // Abm6 drop their Db and Cb instead: the bass and the tune are holding those just then.
  const VOICINGS: Record<string, string> = {
    Ebmaj9: 'G3 (Bb3) D4 F4',
    Cm11: '(G3) Bb3 Eb4 F4',
    Cm9: 'Eb3 (G3) Bb3 D4',
    Fm9: 'Ab3 (C4) Eb4 G4',
    Bb13: 'Ab3 (C4) D4 G4',
    Eb13: '(Db4) F4 G4 Bb4',
    Abmaj9: 'C4 (Eb4) G4 Bb4',
    Gm7: 'Bb3 (D4) F4 G4',
    Abm6: 'Ab3 (Cb4) Eb4 F4',
    C13: 'Bb3 (D4) E4 A4',
  };
  const voicing = (symbol: string, restrike: boolean) =>
    VOICINGS[symbol]
      .split(' ')
      .filter((name) => !(restrike && name.startsWith('(')))
      .map((name) => midi(name.replace(/[()]/g, '')));

  // The motif (two bars) and its answers (two bars).
  const CALL = '.5:Bb4:.35 1:G5:.6 1.5:G5:.33 2:F5:.45 2.5:D5:1.3 4.5:C5:.33 5:D5:.4 5.5:Bb4:1.6';
  const CALL_UP =
    '.5:Bb4:.35 1:G5:.6 1.5:G5:.33 2:F5:.45 2.5:D5:1.3 4.5:C5:.33 5:D5:.4 5.5:F5:.33 6:G5:1.3';
  const RISE =
    '.5:Bb4:.35 1:G5:.6 1.5:G5:.33 2:F5:.4 2.5:G5:.33 3:Bb5:1.2 4.5:G5:.33 5:F5:.45 5.5:D5:1.6';
  const OPEN =
    '8.5:C5:.33 9:F5:.6 9.5:F5:.33 10:Eb5:.45 10.5:C5:1.3 12.5:D5:.33 13:C5:.4 13.5:Bb4:.35 14:G4:1.6';
  const HOME = '8.5:C5:.33 9:F5:.6 9.5:G5:.33 10:F5:.45 10.5:Eb5:1.2 12:D5:.9 13:C5:.45 13.5:Bb4:2';
  const LIFT =
    '8.5:C5:.33 9:Eb5:.45 9.5:F5:.33 10:G5:1.4 11.5:F5:.33 12:D5:.9 13:F5:.4 13.5:D5:.33 14:C5:.45 14.5:Bb4:1.3';
  const TURN =
    '8.5:C5:.33 9:Eb5:.45 9.5:F5:.33 10:D5:.9 11:C5:.45 11.5:Bb4:.33 12.5:G4:.33 13:Bb4:.45 13.5:Db5:1.3 15:C5:.45 15.5:Bb4:.33';
  const AGAIN =
    '8.5:C5:.33 9:F5:.6 9.5:F5:.33 10:Eb5:.45 10.5:C5:1.2 12.5:D5:.33 13:F5:.4 13.5:G5:.33 14:F5:1.3';

  // Fingered bass: the root on one, a nudge on the and-of-two, then a step to the next bar.
  const GROOVE =
    '0:Eb2:1.4 1.5:Eb2:.3:.55 3:G2:.45:.75 3.5:D2:.33:.6 4:C2:1.4 5.5:C2:.3:.55 7:G2:.45:.75 7.5:E2:.33:.6 ' +
    '8:F2:1.4 9.5:F2:.3:.55 11:C2:.45:.75 11.5:A1:.33:.6 12:Bb1:1.4 13.5:Bb1:.3:.55 15:F2:.45:.75 15.5:D2:.33:.6';
  // Octave pops for A'', the root pushed an eighth early with the chords; the first phrase
  // pushes into the second too, and the second steps up from D into the loop's top.
  const POPS =
    '1.5:Eb3:.3:.5 3:Bb2:.45:.7 3.5:C2:1.9 5.5:C3:.3:.5 7:G2:.45:.75 7.5:F2:1.9 ' +
    '9.5:F3:.3:.5 11:C2:.45:.75 11.5:Bb1:1.9 13.5:Bb2:.3:.5 15:F2:.45:.75';
  const POPS_IN = '0:Eb2:1.4 ' + POPS + ' 15.5:Eb2:1.9';
  const POPS_OUT = POPS + ' 15.5:D2:.33:.6';

  // Eight phrases of four bars. `energy` shapes the band (chords, bass, drums) over the loop:
  // light at the top, building through A', a dip for the bridge, fullest in A''.
  type Comp = 'hold' | 'restrike' | 'push';
  type Phrase = {
    chords: string[];
    /** How the chords are played: one way for the phrase, or bar by bar. */
    comp: Comp | Comp[];
    energy: number;
    lead: string;
    /** Kalimba lines and their level (1: an echo, 2: the lead). */
    kalimba: [string, number][];
    bass: string;
    kick: string;
    brush: string;
  };
  const PHRASES: Phrase[] = [
    // A (bars 1–4): the call on the electric piano, an open answer; the chords simply held.
    {
      chords: ['Ebmaj9', 'Cm11', 'Fm9', 'Bb13'],
      comp: 'hold',
      energy: 0.82,
      lead: CALL + ' ' + OPEN,
      kalimba: [],
      bass: '0:Eb2:2.6 3:G2:.45:.75 3.5:D2:.33:.6 4:C2:2.6 7:G2:.45:.75 7.5:E2:.33:.6 8:F2:2.6 11:C2:.45:.75 11.5:A1:.33:.6 12:Bb1:2.6 15:F2:.45:.75 15.5:D2:.33:.6',
      kick: 'x..o....x..o....x..o....x..o..-.',
      brush: '..x...x...x...x...x...x...x...x-',
    },
    // A (5–8): the call again, a closing answer; the kalimba echoes from the left.
    {
      chords: ['Ebmaj9', 'Cm9', 'Fm9', 'Bb13'],
      comp: 'restrike',
      energy: 0.92,
      lead: CALL + ' ' + HOME,
      kalimba: [['6.5:G5:.33 7:F5:.4 7.5:D5:.8 14.5:G5:.33 15:F5:.4 15.5:D5:.6', 1]],
      bass: GROOVE,
      kick: 'x..o....x..o.-..x..o....x..o..o.',
      brush: '..x...x-..x...x-..x...x-..x...x-',
    },
    // A' (9–12): the kalimba asks, the piano answers higher.
    {
      chords: ['Ebmaj9', 'Cm11', 'Fm9', 'Bb13'],
      comp: 'restrike',
      energy: 1,
      lead: LIFT,
      kalimba: [[CALL, 2]],
      bass: GROOVE,
      kick: 'x..o.-..x..o....x..o.-..x..o....',
      brush: '.-x..-x-..x..-x-.-x..-x-..x..-x-',
    },
    // A' (13–16): the kalimba's call rises to Bb; Fm9–Bb13 then Eb13 turn towards Ab.
    {
      chords: ['Ebmaj9', 'Cm9', 'Fm9 Bb13', 'Eb13'],
      comp: 'restrike',
      energy: 1.06,
      lead: TURN,
      kalimba: [[RISE, 2]],
      bass:
        '0:Eb2:1.4 1.5:Eb2:.3:.55 3:G2:.45:.75 3.5:D2:.33:.6 4:C2:1.4 5.5:C2:.3:.55 7:G2:.45:.75 7.5:E2:.33:.6 ' +
        '8:F2:1.4 9.5:C2:.3:.55 10:Bb1:1.4 11.5:D2:.33:.6 12:Eb2:1.4 13.5:Eb2:.3:.55 14:Db2:.9:.8 15:Bb1:.45:.75 15.5:A1:.33:.6',
      kick: 'x..o.-..x..o....x..o....x..o.x..',
      brush: '.-x..-x-..x..-x-.-x..-x-..x.-ox-',
    },
    // B (17–20): the bridge; two long breaths, the kalimba's echo, then two bars with no tune
    // at all: the chords, a rim click and the bass walking down from Ab.
    {
      chords: ['Abmaj9', 'Gm7', 'Cm9', 'Cm9'],
      comp: ['hold', 'hold', 'restrike', 'restrike'],
      energy: 0.84,
      lead: '0:C5:.9 1:Eb5:.45 1.5:G5:2 4:F5:.9 5:D5:.45 5.5:Bb4:1.8',
      kalimba: [['6.5:F5:.33 7:D5:.33 7.5:Bb4:.6', 1]],
      bass:
        '0:Ab1:1.8 2:Eb2:1.3:.8 3.5:Bb1:.33:.55 4:G1:1.8 6:D2:1.3:.8 7.5:Bb1:.33:.55 8:C2:1.8 10:G2:1.3:.8 11.5:C2:.33:.55 ' +
        '12:Bb1:1.8 14:F2:.9:.8 15:Eb2:.45:.7 15.5:Bb1:.33:.55',
      kick: 'x.......x.......x...-...x.......',
      brush: '',
    },
    // B (21–24): up to the bridge's Bb, then the minor iv's sigh down through Cb; ii–V home.
    {
      chords: ['Abmaj9', 'Abm6', 'Gm7 C13', 'Fm9 Bb13'],
      comp: 'restrike',
      energy: 0.94,
      lead: '.5:C5:.33 1:Eb5:.45 1.5:G5:.33 2:Bb5:1.4 4:Ab5:.9 5:F5:.45 5.5:Eb5:.33 6:Cb5:1.6 8:Bb4:.9 9:D5:.45 9.5:Bb4:.3 10:E5:.9 11:D5:.45 11.5:C5:.33 12:C5:.9 13:Eb5:.45 13.5:F5:.33 14:D5:1.2',
      // The echo ends on F, which the Gm7 keeps (a ringing Eb would rub on its D).
      kalimba: [['6.5:Eb5:.33 7:F5:.8', 1]],
      bass:
        '0:Ab1:1.8 2:Eb2:1.3:.8 3.5:Ab1:.33:.55 4:Ab1:1.8 6:Cb2:1.3:.8 7.5:Ab1:.33:.55 8:G1:1.4 9.5:D2:.33:.55 10:C2:1.4 11.5:E2:.33:.55 ' +
        '12:F2:1.4 13.5:C2:.33:.55 14:Bb1:1.4 15.5:D2:.33:.6',
      kick: 'x...o...x...o...x..o....x..o..o.',
      brush: '..x...x-..x...x-.-x..-x-..x.-ox-',
    },
    // A'' (25–28): the call on both together; the chords lean in an eighth early.
    {
      chords: ['Ebmaj9', 'Cm11', 'Fm9', 'Bb13'],
      comp: 'push',
      energy: 1.12,
      lead: CALL + ' ' + OPEN,
      kalimba: [
        [CALL, 1.2],
        ['14.5:Bb4:.33 15:D5:.4 15.5:F5:.6', 1],
      ],
      bass: POPS_IN,
      kick: 'x..o.-..x..o....x..o.-..x..o....',
      brush: '.-x..-x-..x..-x-.-x..-x-..x..-x-',
    },
    // A'' (29–32): the call climbs to G, the answer hangs on F for the top of the loop.
    {
      chords: ['Ebmaj9', 'Cm9', 'Fm9', 'Bb13'],
      comp: 'push',
      energy: 1,
      lead: CALL_UP + ' ' + AGAIN,
      kalimba: [],
      bass: POPS_OUT,
      kick: 'x..o.-..x..o....x..o.-..x..o..o.',
      brush: '.-x..-x-..x..-x-.-x..-x-..x..-xo',
    },
  ];

  const COMP = 0.041,
    LEAD = 0.125,
    KALIMBA = 0.035,
    BASS = 0.097,
    KICK = 0.07,
    BRUSH = 0.13;
  PHRASES.forEach((phrase, index) => {
    const at = index * 16;
    const { energy } = phrase;
    // Chords: held a bar, or restruck on the swung and-of-three, or (A'') pushed an eighth
    // early and restruck on the and-of-two; a two-chord bar strikes each half. Held chords and
    // restrikes lift before the bass's approach note on the and-of-four.
    phrase.chords.forEach((symbols, i) => {
      const bar = at + i * 4;
      const strike = (
        from: number,
        symbol: string,
        length: number,
        weight: number,
        restrike = false,
      ) =>
        score.chord(from, voicing(symbol, restrike), length, 'epiano', COMP * energy * weight, {
          strum: 0.03,
          spread: 0.35,
          pan: -0.1,
        });
      const style = Array.isArray(phrase.comp) ? phrase.comp[i] : phrase.comp;
      const halves = symbols.split(' ');
      if (halves.length === 2) {
        strike(bar, halves[0], 1.85, 1);
        strike(bar + 2, halves[1], 1.85, 0.95);
      } else if (style === 'hold') {
        strike(bar, symbols, 3.55, 1);
      } else if (style === 'push') {
        const pushed = !(index === 6 && i === 0);
        strike(pushed ? bar - 0.5 + SWING : bar, symbols, pushed ? 1.85 : 1.4, 1);
        strike(bar + 1.5 + SWING, symbols, index === 7 && i === 3 ? 2.2 : 0.95, 0.5, true);
      } else {
        strike(bar, symbols, 2.35, 1);
        strike(bar + 2.5 + SWING, symbols, 0.95, 0.55, true);
      }
    });
    play(at, phrase.lead, 'epiano', LEAD, 0.15);
    for (const [text, level] of phrase.kalimba) play(at, text, 'kalimba', KALIMBA * level, -0.4);
    play(at, phrase.bass, 'fingerbass', BASS * energy);
    // Drums: a felt kick on one and the swung and-of-two, brushes on two and four a hair behind
    // the beat with ghost taps; in the bridge's first half a rim click instead.
    const drums = { step: 0.5, swing: SWING / 0.5 };
    score.hits(at, phrase.kick, 'softkick', KICK * energy, { ...drums, pitch: 39 });
    if (phrase.brush)
      score.hits(at + 0.03, phrase.brush, 'brush', BRUSH * energy, {
        ...drums,
        pitch: 63,
        pan: 0.2,
      });
    else
      score.hits(at + 0.03, '..x...x-..x...x-..x...x-..x...x-', 'rim', 0.1, { ...drums, pan: 0.1 });
    // Through the bridge, a brush circling the head, a sweep each half bar.
    for (let sweep = 0; sweep < 16 && (index === 4 || index === 5); sweep += 2)
      score.note(at + sweep, 60, 2, 'swish', 0.055, -0.2);
  });
  // The record's crackle, eight bars a side.
  for (let at = 0; at < AFTERNOON.beats; at += 32) score.note(at, 56, 32, 'vinyl', 0.12);
  return score.done();
}
