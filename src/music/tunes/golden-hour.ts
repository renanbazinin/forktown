// "Sun on the Shutters": the town's tune for 17:00–19:00, the warm high point of the day. A
// felt-piano song over fingerpicked nylon guitar and upright bass, with brushes; the strings swell
// through the build to a climax that peaks on B and sighs down through D minor, then a quiet
// guitar verse as the sun goes. Written in A major (the names below) and played a tone lower, in
// G: so it shares D with teatime's B-flat before it and leads home into the concert's C after.
import { midi, Score, type Note, type TuneInfo } from './kit';

export const GOLDEN_HOUR: TuneInfo = {
  title: 'Sun on the Shutters',
  subtitle: 'Long shadows down the lanes',
  bpm: 86,
  beats: 128,
  bar: 4,
  hall: { wet: 0.26, size: 0.72, damp: 0.45 },
  instruments: 'Felt piano, strings, nylon guitar, upright bass, brushes, ride, birds',
};

export function composeGoldenHour(): Note[] {
  const score = new Score(GOLDEN_HOUR.beats);
  const pitches = (names: string) => names.split(' ').map(midi);

  // Writes `text` from `at`: 'pitch/beats' tokens one after another ('r' rests, a third field
  // scales the gain, '|' only marks the bars), each note held `legato` of its value, and each bar
  // `swell[bar]` louder or softer (bars counted from `at`).
  const play = (
    at: number,
    text: string,
    voice: Note['voice'],
    gain: number,
    {
      legato = 1,
      pan = 0,
      swell = [],
    }: { legato?: number; pan?: number; swell?: readonly number[] } = {},
  ) => {
    let t = at;
    for (const token of text.split(/\s+/)) {
      if (!token || token === '|') continue;
      const [name, value, scale = '1'] = token.split('/');
      const beats = Number(value);
      const level = gain * Number(scale) * (swell[Math.floor((t - at) / 4)] ?? 1);
      if (name !== 'r') score.note(t, midi(name), beats * legato, voice, level, pan);
      t += beats;
    }
  };

  // Each chord's guitar shape, low to high.
  const SHAPES: Record<string, string> = {
    A: 'E3 A3 C#4 E4',
    'E/G#': 'E3 G#3 B3 E4',
    'F#m7': 'F#3 A3 C#4 E4',
    'F#m7/E': 'E3 A3 C#4 F#4',
    Dmaj7: 'D3 A3 E4 F#4',
    'A/C#': 'E3 A3 C#4 E4',
    Bm7: 'B2 F#3 A3 D4',
    E7sus4: 'E3 A3 B3 D4',
    E: 'E3 G#3 B3 E4',
    'C#m7': 'G#3 B3 C#4 E4',
    'C#7': 'G#3 B3 C#4 E#4',
    Dm6: 'D3 A3 B3 F4',
    'D/A': 'A3 D4 F#4 A4',
  };
  // The 32 bars, a phrase of four a line ('X|Y' halves a bar).
  const HARMONY = [
    ...['A', 'E/G#', 'F#m7', 'F#m7/E'], // A: the song, the bass stepping down
    ...['Dmaj7', 'A/C#', 'Bm7', 'E7sus4|E'], // A': its answer, a half close and a breath
    ...['Bm7', 'C#m7', 'Dmaj7', 'C#7'], // B: a climbing sequence
    ...['F#m7', 'F#m7/E', 'Dmaj7', 'E7sus4|E'], // B': the build, strings swelling bar by bar
    ...['Dmaj7', 'E', 'C#m7', 'F#m7'], // C: the climax, strings and ride
    ...['Bm7', 'E', 'Dmaj7', 'Dm6'], // C': the peak on B, then its sigh through D minor
    ...['A', 'D/A', 'A', 'D/A'], // D: the guitar sings over an A pedal
    ...['F#m7', 'Dmaj7', 'Bm7', 'E7sus4|E'], // T: turnaround home
  ];
  const halves = (bar: number) => {
    const parts = HARMONY[bar].split('|');
    return parts.map((symbol, i) => ({
      start: bar * 4 + (i * 4) / parts.length,
      end: bar * 4 + ((i + 1) * 4) / parts.length,
      guitar: pitches(SHAPES[symbol]),
    }));
  };

  // Felt piano: the song. Its long-short-long motif opens the phrases; the rest walks in quarters
  // and halves, and breathes at the half close (bar 8) and before the peak (bar 20). The build
  // grows bar by bar, the peak leans on its B5 and the sigh falls away.
  const melody: [at: number, gain: number, text: string, swell?: number[]][] = [
    [0, 0.113, 'C#5/1.5 E5/.5 F#5/2 | E5/1.5 D5/.5 B4/2 | C#5/1 E5/1 A5/2 | F#5/1 E5/1 C#5/1.5'],
    [16, 0.117, 'A4/1.5 C#5/.5 F#5/2 | E5/2 F#5/.5 E5/.5 C#5/1 | D5/1 C#5/1 B4/1 D5/1 | E5/2'],
    [
      32,
      0.106,
      'r/.5 F#4/.5 B4/.5 C#5/.5 D5/2 | r/.5 G#4/.5 B4/.5 C#5/.5 E5/2 | r/.5 A4/.5 C#5/.5 D5/.5 F#5/1.5 E5/.5 | E#5/2 C#5/1.5',
    ],
    [
      48,
      0.117,
      'r/.5 C#5/.5 E5/.5 F#5/.5 A5/1.5 G#5/.5 | F#5/2 C#5/1 E5/1 | F#5/1.5 E5/.5 D5/1 C#5/1 | D5/1 E5/1 F#5/1 G#5/1',
      [0.86, 0.92, 0.97, 1],
    ],
    // C turns round the top notes and stops short; C' lands its one strong B5 (bar 21).
    [
      64,
      0.126,
      'A5/1.5 B5/.5 A5/1 F#5/1 | G#5/1.5 A5/.5 G#5/1 E5/1 | E5/2 F#5/.5 E5/.5 B4/1 | C#5/2 r/1.5 A5/.5',
      [1, 0.9, 1, 1],
    ],
    [
      80,
      0.126,
      'B5/2/1.06 A5/1 F#5/1 | G#5/3/1.04 E5/1 | F#5/1.5 E5/.5 D5/1 E5/1 | F5/2 E5/2',
      [1.02, 1.0, 0.86, 0.83],
    ],
    [112, 0.104, 'C#5/2 B4/1 G#4/1 | A4/1.5 C#5/.5 F#5/2 | D5/1 C#5/1 B4/2 | E5/2.5 D5/.5 B4/1'],
  ];
  for (const [at, gain, text, swell] of melody)
    play(at, text, 'felt', gain, { legato: 0.96, pan: 0.1, swell });
  // D: the guitar takes the tune, the piano answers high.
  play(
    96,
    'r/.5 E4/.5 A4/.5 B4/.5 C#5/1.5 B4/.5 | A4/2 F#4/1 A4/1 | r/.5 E4/.5 A4/.5 B4/.5 E5/1.5 C#5/.5 | D5/1 C#5/1 B4/2',
    'nylon',
    0.148,
    { legato: 0.96, pan: -0.15 },
  );
  play(102.5, 'C#6/.5 B5/.5 A5/1', 'felt', 0.06, { pan: 0.3 });
  play(110, 'A5/.5 F#5/.5 E5/1', 'felt', 0.055, { pan: 0.3 });

  // Upright: whole-bar roots stepping down in the song, a lilt under the build, a walk of halves
  // and quarters under the climax (so it never doubles the tune's long-short), then the pedal.
  play(
    0,
    'A2/3 E2/1/.7 | G#2/3 E2/1/.7 | F#2/3 C#2/1/.7 | E2/3 A1/1/.7 | D2/3 A1/1/.7 | C#2/3 A1/1/.7 | B1/3 F#2/1/.7 | E2/3 D2/1/.7',
    'upright',
    0.1,
    { legato: 0.92 },
  );
  const lilt = (root: string, fifth: string, approach: string) =>
    `${root}/1.5 ${root}/.5/.6 ${fifth}/1.5 ${approach}/.5/.7`;
  const walk = [
    lilt('B1', 'F#2', 'D2'),
    lilt('C#2', 'G#2', 'E2'),
    lilt('D2', 'A2', 'B1'),
    lilt('C#2', 'G#2', 'E#2'),
    lilt('F#2', 'C#2', 'D2'),
    lilt('E2', 'B1', 'C#2'),
    lilt('D2', 'A2', 'F#2'),
    lilt('E2', 'B1', 'C#2'),
  ];
  // A little softer under B than under the build.
  play(32, walk.join(' '), 'upright', 0.088, { legato: 0.9, swell: [0.92, 0.92, 0.92, 0.92] });
  play(
    64,
    'D2/2 A2/1/.8 F#2/1/.7 | E2/2 B1/1/.8 D2/1/.7 | C#2/2 G#2/1/.8 E2/1/.7 | F#2/2 E2/1/.8 C#2/1/.7 | B1/2 F#2/1/.8 D2/1/.7 | E2/2 B1/1/.8 C#2/1/.7 | D2/2 A1/1/.8 C#2/1/.7 | D2/4',
    'upright',
    0.1,
    { legato: 0.9, swell: [1, 1, 1, 1, 1, 1, 0.9, 0.85] },
  );
  play(96, 'A1/3 E2/1/.6 | A1/4 | A1/3 E2/1/.6 | A1/3 E2/1/.6', 'upright', 0.1, { legato: 0.92 });
  play(112, 'F#2/3 E2/1/.7 | D2/3 A1/1/.7 | B1/3 D2/1/.7 | E2/3 G#2/1/.7', 'upright', 0.1, {
    legato: 0.92,
  });

  // Nylon guitar: fingerpicked eighths, 3+3+2, every string damped at the chord change. It
  // rises through the build to the climax's level and picks sparely under the sigh.
  const PICK = [0, 2, 3, 1, 2, 3, 1, 2];
  const SPARE = [0, 2, 3, -1, 1, 3, -1, 2];
  const guitar = (bar: number, pattern: readonly number[], gain: number) =>
    pattern.forEach((pick, i) => {
      const at = bar * 4 + i / 2;
      const chord = halves(bar).find((half) => at < half.end)!;
      if (pick >= 0)
        score.note(
          at,
          chord.guitar[pick],
          Math.min(2, chord.end - at - 0.06),
          'nylon',
          gain * (i ? 1 : 1.15),
          -0.3,
        );
    });
  const guitarGain = [0.045, 0.043, 0.043, 0.05, 0.05, 0.048, 0, 0.042];
  // Per bar in the build (rising) and the sigh (falling).
  const SHAPE = [[], [], [], [0.8, 0.87, 0.93, 1], [], [1.04, 1, 0.88], [], []];
  for (let bar = 0; bar < 32; bar++) {
    const phrase = bar >> 2;
    if (bar === 23) guitar(bar, SPARE, 0.04);
    else if (guitarGain[phrase])
      guitar(
        bar,
        phrase === 7 || phrase === 0 ? SPARE : PICK,
        guitarGain[phrase] * (SHAPE[phrase][bar & 3] ?? 1),
      );
  }

  // Strings, above the guitar's shapes rather than doubling them: one voice in A' and B, two
  // re-bowed louder each bar of the build, a counter-melody rising to D over the peak, falling to
  // D minor's F while the section bows each bar softer, then quieter home.
  const strings: [at: number, gain: number, lines: string[], swell?: number[]][] = [
    [16, 0.052, ['A4/4 | A4/4 | B4/2 A4/2 | A4/2 G#4/2']],
    [32, 0.055, ['F#4/4 | G#4/4 | A4/4 | B4/4']],
    [
      48,
      0.05,
      ['C#5/4 | C#5/4 | A4/4 | B4/4', 'A4/4 | A4/4 | F#4/4 | A4/2 G#4/2'],
      [0.75, 0.85, 1, 1.15],
    ],
    [64, 0.05, ['A4/4 | E4/4 | E4/4 | F#4/4']],
    [64, 0.07, ['C#5/4 | B4/4 | B4/2 G#4/2 | A4/2 B4/1 C#5/1']],
    [80, 0.05, ['F#4/4 | G#4/4 | F#4/4 | A4/4'], [1.05, 0.92, 0.78, 0.65]],
    [80, 0.07, ['D5/2 C#5/2 | B4/4 | A4/4 | F4/4'], [1.05, 0.92, 0.78, 0.65]],
    [96, 0.042, ['C#4/4 | D4/4 | C#4/4 | D4/4', 'A3/16']],
    [112, 0.044, ['A4/4 | A4/4 | A4/4 | A4/2 G#4/2', 'F#4/4 | F#4/4 | F#4/4 | E4/4']],
  ];
  for (const [at, gain, lines, swell] of strings)
    for (const line of lines) play(at, line, 'strings', gain, { swell });
  // The swell into the climax: a cello E bowed twice, louder, under the build's last bar.
  play(60, 'E3/2/.8 E3/2/1.1', 'strings', 0.05);

  // Brushes and swish; a light kick from the build and the ride through the climax's first six
  // bars; none in the guitar verse.
  const BRUSH = [
    '..o...o.',
    '..o...o-',
    '..o...x-',
    '-.x...x-',
    '-.x.-.x-',
    '-.x.-.x-',
    '......o.',
    '..o...o.',
  ];
  const KICK = ['', '', '', 'o.......', 'o....-..', 'o....-..', '', '-.......'];
  const SWISH = [0.05, 0.055, 0.06, 0.06, 0.055, 0.055, 0.045, 0.05];
  for (let bar = 0; bar < 32; bar++) {
    const at = bar * 4,
      phrase = bar >> 2;
    const root = midi(`${/^[A-G][#b]?/.exec(HARMONY[bar])![0]}2`);
    score.note(at, 60, 3.9, 'swish', SWISH[phrase], 0.15);
    // The climax's last bar (D minor) thins out, so the guitar verse arrives softly.
    const last = bar === 23;
    score.hits(at, last ? '..o...o.' : BRUSH[phrase], 'brush', 0.15, { step: 0.5, pan: 0.25 });
    // The build's kick comes in as a ghost and firms up for its last two bars.
    const kick = bar === 12 || bar === 13 ? '-.......' : KICK[phrase];
    if (!last) score.hits(at, kick, 'softkick', 0.105, { step: 0.5, pitch: root });
    if (bar >= 16 && bar < 22)
      score.hits(at, 'xoxo', 'ride', bar === 16 ? 0.085 : 0.065, { step: 1, pan: 0.35 });
  }
  // Evening birds over the guitar verse and the way home.
  score.note(96, 69, 32, 'birds', 0.12);
  return score.done({ transpose: -2 });
}
