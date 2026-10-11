// Breath, bow and voice: flute, a string section, a warm pad and a soft choir.
// The bowed, sung and pad oscillators read single-cycle wavetables summed from harmonics below
// 0.45 of the sample rate (one table per pitch, kept), so no partial folds back however high the
// note, and each table already carries its fixed colour: a violin family's body for the strings,
// a voice's formants for the choir. The flute is additive. Every voice of an ensemble is tuned
// around the note, so each side of the stereo pair is in tune on its own. Notes are levelled by
// their sustained loudness rather than their peak, so equal gains sound alike across the family
// and a short note is a shorter swell, not a louder one.
import {
  clamp,
  edges,
  frames,
  hz,
  noise,
  register,
  type Rendered,
  reseed,
  sine,
  type Strike,
  svf,
  TAU,
} from './dsp';

// --- Shared helpers -------------------------------------------------------------------------

const POINTS = 2048;
const TABLES = new Map<string, Float32Array>();

/** A single cycle of harmonics 1..count with the given amplitudes (kept by key). */
function wavetable(key: string, count: number, amplitude: (k: number) => number) {
  const kept = TABLES.get(key);
  if (kept) return kept;
  const sum = new Float64Array(POINTS);
  for (let k = 1; k <= count; k++) {
    const a = amplitude(k);
    if (Math.abs(a) < 1e-6) continue;
    // a·sin(2πki/N) by recurrence.
    const w = (TAU * k) / POINTS,
      c = 2 * Math.cos(w);
    let s0 = 0,
      s1 = a * Math.sin(w);
    sum[1] += s1;
    for (let i = 2; i < POINTS; i++) {
      const s2 = c * s1 - s0;
      sum[i] += s2;
      s0 = s1;
      s1 = s2;
    }
  }
  const table = new Float32Array(POINTS + 1);
  for (let i = 0; i < POINTS; i++) table[i] = sum[i];
  table[POINTS] = table[0];
  if (TABLES.size >= 600) TABLES.clear();
  TABLES.set(key, table);
  return table;
}

/** Reads a wavetable at a phase in 0..1, interpolating. */
function read(table: Float32Array, phase: number) {
  const x = phase * POINTS;
  const i = x | 0;
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

/** Harmonics a band-limited table may hold for a note that bends up to `stretch` sharp. */
const harmonics = (f: number, sampleRate: number, stretch = 1.012) =>
  Math.max(1, Math.floor((sampleRate * 0.45) / (f * stretch)));

const cents = (c: number) => 2 ** (c / 1200);

/**
 * How an ensemble shares its harmonics. Equal voices a few cents apart fade in and out together
 * at the fundamental (a slow, deep wobble), so a centred lead, one player heard on both sides,
 * carries the low harmonics and half the upper ones (`solo`), and the detuned section players
 * a side carry the upper harmonics with their lowest thinned (`tutti`). The level stays steady,
 * the centre folds down to mono, and the shimmer and width live up high, where beats are quick.
 */
const solo = (k: number, second = 0.85) => (k === 1 ? 1 : k === 2 ? second : 0.5);
const tutti = (k: number, first: number, second: number) =>
  k === 1 ? first : k === 2 ? second : 1;

// Magnitudes of analogue filter sections, to colour a table's harmonics.
function resonance(f: number, centre: number, q: number) {
  const x = f / centre;
  return 1 / Math.sqrt((1 - x * x) ** 2 + (x / q) ** 2);
}
function bell(f: number, centre: number, q: number, db: number) {
  const a = 10 ** (db / 40),
    x = f / centre,
    re = (1 - x * x) ** 2;
  return Math.sqrt((re + ((x * a) / q) ** 2) / (re + (x / (a * q)) ** 2));
}

/**
 * Levels a note by its sustained loudness: the mean power of its signal (gently low-cut, as the
 * ear hears it), per unit of envelope power, is brought to `target`. Then a peak guard.
 */
function level(channels: Float32Array[], power: number, weight: number, target: number) {
  const rms = Math.sqrt(power / (channels.length * Math.max(weight, 1e-9)));
  let scale = rms > 1e-9 ? target / rms : 0;
  let top = 0;
  for (const channel of channels)
    for (let i = 0; i < channel.length; i++) top = Math.max(top, Math.abs(channel[i]));
  if (top * scale > 0.95) scale = 0.95 / top;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) channel[i] *= scale;
}
/** The ear's low cut for the loudness meter: a one-pole high-pass at 150 Hz. */
const meterPole = (sampleRate: number) => 1 - Math.exp((-TAU * 150) / sampleRate);

/** Per-sample rates for an envelope: rise τ, fall τ after `held`. */
function envelope(held: number, rise: number, fall: number, sampleRate: number) {
  return {
    from: Math.round(held * sampleRate),
    up: 1 - Math.exp(-1 / (rise * sampleRate)),
    down: Math.exp(-1 / (fall * sampleRate)),
  };
}

// Loudness: each note's meter RMS per channel at unit gain at G4, its rise in dB an octave, and
// the octaves (from G4) the rise spans. Set with a loudness model (critical bands, spreading,
// specific loudness) so equal gains sound equally loud across the family and up each range: a
// purer tone needs more level to sound as loud as a rich one, so the near-sine flute and the
// dark choir sit above the strings, and higher, purer notes rise. The choir turns pure quickly
// once its first formant locks onto the note (above G4). The mono flute is centred at −3 dB a side.
const LOUDNESS = {
  flute: [0.42, 1.4, -2.5, 2.5],
  strings: [0.129, 1.2, -2.5, 2.5],
  glow: [0.199, 1.9, -2.5, 2.5],
  choir: [0.366, 3.6, -1.5, 0.55],
} as const;
function loudness(instrument: keyof typeof LOUDNESS, pitch: number) {
  const [base, rise, low, high] = LOUDNESS[instrument];
  return base * 10 ** ((rise * clamp((pitch - 67) / 12, low, high)) / 20);
}

// --- Flute ----------------------------------------------------------------------------------

/**
 * A wooden flute, softly blown: a nearly pure tone whose low register carries a few more
 * partials, breath shaped by the bore and a little edge hiss riding the tone, a soft chiff and a
 * slight scoop at the start, and vibrato (mostly in the breath's strength) arriving late.
 */
export function flute(strike: Strike, sampleRate: number): Rendered {
  const f = hz(strike.pitch);
  const r = register(strike.pitch);
  const count = frames(strike.held + 0.3, sampleRate);
  const out = new Float32Array(count);
  const air = noise(strike.seed);
  const pick = noise(reseed(strike.seed, 0x46));
  // Partials 2–5 fall by `slope` dB each: fuller low down, almost a sine at the top.
  const slope = clamp(10 + 4.5 * r, 7, 22);
  const p = [2, 3, 4, 5].map((k) =>
    k * f < sampleRate * 0.42 ? 10 ** ((-(k - 1) * slope) / 20) : 0,
  );
  const bore = svf(f, 5, sampleRate);
  const edge = svf(clamp(f * 3.5, 1400, 4500), 0.9, sampleRate);
  const boreAmount = 0.065 * Math.sqrt(523 / f) * clamp(1 - 0.15 * r, 0.7, 1.2);
  const hissAmount = 0.035;
  const rate = 4.9 + 0.25 * (pick() + 1),
    lfo = 0.5 * (pick() + 1);
  const env = envelope(strike.held, 0.032, 0.06, sampleRate);
  const breathUp = 1 - Math.exp(-1 / (0.012 * sampleRate));
  const scoopFall = Math.exp(-1 / (0.03 * sampleRate)),
    onsetFall = Math.exp(-1 / (0.045 * sampleRate)),
    chiffFall = Math.exp(-1 / (0.02 * sampleRate)),
    chiffRise = Math.exp(-1 / (0.003 * sampleRate));
  const pole = meterPole(sampleRate);
  let rising = 0,
    breathing = 0,
    falling = 1,
    scoop = -0.006,
    onset = 1,
    chiffA = 1,
    chiffB = 1,
    phase = 0,
    vib = 0;
  let low = 0,
    power = 0,
    weight = 0;
  for (let i = 0; i < count; i++) {
    if ((i & 15) === 0) {
      const t = i / sampleRate;
      vib = clamp((t - 0.28) / 0.5, 0, 1) * sine((strike.at + t) * rate + lfo);
    }
    rising += (1 - rising) * env.up;
    breathing += (1 - breathing) * breathUp;
    if (i >= env.from) falling *= env.down;
    scoop *= scoopFall;
    onset *= onsetFall;
    chiffA *= chiffFall;
    chiffB *= chiffRise;
    phase += (f * (1 + scoop + 0.003 * vib)) / sampleRate;
    if (phase >= 1) phase -= 1;
    const s1 = sine(phase);
    const bright = (1 + 0.9 * onset) * (1 + 0.22 * vib);
    const tone =
      s1 +
      bright *
        (p[0] * sine(2 * phase) +
          p[1] * sine(3 * phase) +
          p[2] * sine(4 * phase) +
          p[3] * sine(5 * phase));
    const n = air();
    const hiss = edge.run(n).band;
    const lvl = rising * falling * (1 + 0.06 * vib);
    const body =
      lvl * tone +
      breathing * falling * (boreAmount * bore.run(n).band + hissAmount * (0.7 + 0.3 * s1) * hiss);
    low += pole * (body - low);
    power += (body - low) ** 2;
    weight += lvl * lvl;
    out[i] = body + 0.8 * (chiffA - chiffB) * hiss;
  }
  edges(out, sampleRate, 0.004, 0.03);
  level([out], power, weight, loudness('flute', strike.pitch));
  return { left: out };
}

// --- Strings --------------------------------------------------------------------------------

/** A violin family's body, as gains on a bowed string's harmonics: warm wood, no nasal or fizz. */
function body(f: number) {
  const x = f / 70;
  return (
    ((x * x) / Math.sqrt((1 - x * x) ** 2 + (x / 0.7) ** 2)) *
    bell(f, 275, 2, 4) *
    bell(f, 500, 1.6, 2.5) *
    bell(f, 1300, 1.2, -3.5) *
    bell(f, 2600, 1.2, 1.5) *
    resonance(f, 5000, 0.7)
  );
}
// Players 0–2 left, 3–5 right: a lead and two section players a side (cents) and vibrato (Hz).
// The two leads are one player heard on both sides: same tuning, same vibrato, same phase.
const BOW_CENTS = [0, -7, 7, 0, -5.5, 5.5];
const BOW_RATES = [5.3, 5.75, 4.8, 5.3, 4.95, 5.9];

/**
 * A string section: a lead and two section players a side bowing a band-limited sawtooth through
 * a violin body, a little bite and rosin at the start, a filter that brightens with the bow's
 * weight, and vibrato each player starts in their own time. Short notes are bowed quicker.
 */
export function strings(strike: Strike, sampleRate: number): Rendered {
  const f = hz(strike.pitch);
  const top = harmonics(f, sampleRate);
  const tone = (k: number) => body(k * f) / k;
  const lead = wavetable(`strings:${strike.pitch}:${sampleRate}`, top, (k) => tone(k) * solo(k));
  const section = wavetable(
    `strings-section:${strike.pitch}:${sampleRate}`,
    top,
    (k) => tone(k) * tutti(k, 0.22, 0.6),
  );
  const count = frames(strike.held + 0.95, sampleRate);
  const left = new Float32Array(count),
    right = new Float32Array(count);
  const rand = noise(strike.seed),
    rosin = noise(reseed(strike.seed, 0x5b));
  const phases = new Float64Array(6).map(() => 0.5 * (rand() + 1));
  const lfos = new Float64Array(6).map(() => 0.5 * (rand() + 1));
  // The lead, in phase on both sides: a solid centre that folds down to mono.
  phases[3] = phases[0];
  lfos[3] = lfos[0];
  const base = BOW_CENTS.map((c) => (f * cents(c)) / sampleRate);
  const steps = new Float64Array(base);
  const filters = [svf(1000, 0.6, sampleRate), svf(1000, 0.6, sampleRate)];
  const env = envelope(strike.held, clamp(strike.held * 0.35, 0.035, 0.13), 0.24, sampleRate);
  const biteFall = Math.exp(-1 / (0.03 * sampleRate));
  const bright = 1100 + 3.2 * f;
  const pole = meterPole(sampleRate);
  let rising = 0,
    falling = 1,
    bite = 1;
  let lowL = 0,
    lowR = 0,
    power = 0,
    weight = 0;
  for (let i = 0; i < count; i++) {
    if ((i & 15) === 0) {
      const t = i / sampleRate;
      const depth = 0.0035 * clamp((t - 0.22) / 0.5, 0, 1);
      for (let v = 0; v < 6; v++)
        steps[v] = base[v] * (1 + depth * sine((strike.at + t) * BOW_RATES[v] + lfos[v]));
      const cutoff = clamp(bright * (0.6 + 0.4 * rising), 300, 7000);
      filters[0].tune(cutoff);
      filters[1].tune(cutoff * 1.03);
    }
    rising += (1 - rising) * env.up;
    if (i >= env.from) falling *= env.down;
    bite *= biteFall;
    for (let v = 0; v < 6; v++) {
      const ph = phases[v] + steps[v];
      phases[v] = ph >= 1 ? ph - 1 : ph;
    }
    const scrape = 0.012 + 0.3 * bite;
    const lvl = rising * falling;
    let l = read(lead, phases[0]) + read(section, phases[1]) + read(section, phases[2]);
    let r = read(lead, phases[3]) + read(section, phases[4]) + read(section, phases[5]);
    l = filters[0].run(l + scrape * rosin()).low * lvl;
    r = filters[1].run(r + scrape * rosin()).low * lvl;
    lowL += pole * (l - lowL);
    lowR += pole * (r - lowR);
    power += (l - lowL) ** 2 + (r - lowR) ** 2;
    weight += lvl * lvl;
    left[i] = l;
    right[i] = r;
  }
  edges(left, sampleRate, 0.006, 0.05);
  edges(right, sampleRate, 0.006, 0.05);
  level([left, right], power, weight, loudness('strings', strike.pitch));
  return { left, right };
}

// --- Glow pad -------------------------------------------------------------------------------

/**
 * A warm analogue pad: a centre sawtooth with a sine at the note for body, a detuned pair a side
 * (band-limited, their lowest harmonics thinned so the pad does not wobble), and a softly
 * resonant filter that blooms open and then breathes with the loop.
 */
export function glow(strike: Strike, sampleRate: number): Rendered {
  const f = hz(strike.pitch);
  const top = harmonics(f, sampleRate);
  const saw = wavetable(`glow:${strike.pitch}:${sampleRate}`, top, (k) => solo(k) / k);
  const pair = wavetable(
    `glow-pair:${strike.pitch}:${sampleRate}`,
    top,
    (k) => tutti(k, 0.18, 0.6) / k,
  );
  const count = frames(strike.held + 2.4, sampleRate);
  const left = new Float32Array(count),
    right = new Float32Array(count);
  const rand = noise(strike.seed);
  // Centre, left pair, right pair: tuned around the note so each side is in tune on its own.
  const detune = [0, -7, 7, -10, 10];
  const phases = new Float64Array(5).map(() => 0.5 * (rand() + 1));
  const base = detune.map((c) => (f * cents(c)) / sampleRate);
  const steps = new Float64Array(base);
  const drift = 0.5 * (rand() + 1);
  const filters = [svf(800, 1.15, sampleRate), svf(800, 1.15, sampleRate)];
  const env = envelope(strike.held, clamp(strike.held * 0.5, 0.06, 0.35), 0.6, sampleRate);
  const bloomUp = 1 - Math.exp(-1 / (0.5 * sampleRate));
  const open = 550 + 1.25 * f;
  const pole = meterPole(sampleRate);
  let rising = 0,
    falling = 1,
    bloom = 0;
  let lowL = 0,
    lowR = 0,
    power = 0,
    weight = 0;
  for (let i = 0; i < count; i++) {
    if ((i & 15) === 0) {
      const t = strike.at + i / sampleRate;
      // A slow wander, opposite in each pair, so the beating never settles.
      const wander = 0.0012 * sine(t * 0.23 + drift);
      steps[1] = base[1] * (1 + wander);
      steps[2] = base[2] * (1 - wander);
      steps[3] = base[3] * (1 - wander);
      steps[4] = base[4] * (1 + wander);
      const swept = open * (0.5 + 0.5 * bloom);
      filters[0].tune(clamp(swept * (1 + 0.28 * sine(t * 0.11)), 150, 8000));
      filters[1].tune(clamp(swept * (1 + 0.28 * sine(t * 0.11 + 0.2)), 150, 8000));
    }
    rising += (1 - rising) * env.up;
    if (i >= env.from) falling *= env.down;
    bloom += (1 - bloom) * bloomUp;
    for (let v = 0; v < 5; v++) {
      const ph = phases[v] + steps[v];
      phases[v] = ph >= 1 ? ph - 1 : ph;
    }
    const middle = 0.8 * read(saw, phases[0]) + sine(phases[0]);
    const lvl = rising * falling;
    const l = filters[0].run(middle + read(pair, phases[1]) + read(pair, phases[2])).low * lvl;
    const r = filters[1].run(middle + read(pair, phases[3]) + read(pair, phases[4])).low * lvl;
    lowL += pole * (l - lowL);
    lowR += pole * (r - lowR);
    power += (l - lowL) ** 2 + (r - lowR) ** 2;
    weight += lvl * lvl;
    left[i] = l;
    right[i] = r;
  }
  edges(left, sampleRate, 0.02, 0.08);
  edges(right, sampleRate, 0.02, 0.08);
  level([left, right], power, weight, loudness('glow', strike.pitch));
  return { left, right };
}

// --- Choir ----------------------------------------------------------------------------------

// A rounded "ooh" between oo and oh (Hz) and the ensemble's broad formant bandwidths.
const FORMANTS = [360, 780, 2450, 3300];
const BANDWIDTHS = [110, 140, 220, 380];

/**
 * A voice's harmonics: a soft glottal source (−9 dB/octave) through four formant resonances in
 * cascade, with the usual lift above them for the higher ones, so the voice keeps some presence.
 * `shade` darkens (below 1) or rounds (above 1) the vowel; `w` is the start, lips still rounded
 * in; a lead and a `section` voice share the harmonics as `solo` and `tutti` say.
 */
function voiceTable(pitch: number, sampleRate: number, shade: number, w: boolean, section = false) {
  const f = hz(pitch);
  // Higher voices have higher formants; a soprano lifts her first formant to the note.
  const kind = 1 + 0.15 * clamp((pitch - 50) / 24, 0, 1);
  const f1 = Math.max(FORMANTS[0] * kind * shade * (w ? 0.82 : 1), f * 1.12);
  const f2 = Math.max(FORMANTS[1] * kind * shade * (w ? 0.72 : 1), f1 * 1.45);
  const centres = [f1, f2, FORMANTS[2] * kind, FORMANTS[3] * kind];
  return wavetable(
    `choir:${pitch}:${sampleRate}:${shade}:${w}:${section}`,
    harmonics(f, sampleRate),
    (k) => {
      let a = k ** -1.5 * (section ? tutti(k, 0.2, 0.75) : solo(k, 0.55));
      for (let n = 0; n < 4; n++) a *= resonance(k * f, centres[n], centres[n] / BANDWIDTHS[n]);
      return a * bell(k * f, 2800 * kind, 1.2, 6);
    },
  );
}
// Singers 0–2 left, 3–5 right: a lead and two section voices a side (cents), their vibrato
// rates and their slow wanders in pitch (Hz). The lead is one singer heard on both sides.
const SING_CENTS = [0, -6, 6, 0, -4.5, 4.5];
const SING_RATES = [5.2, 4.7, 5.9, 5.2, 5.6, 4.85];
const SING_WANDER = [0.21, 0.33, 0.27, 0.21, 0.19, 0.37];

/**
 * A soft "ooh" choir: a lead and two section voices a side on a voice's wavetable (a darker vowel
 * on the left, a rounder one on the right), the leads opening from a "w", each singer with their
 * own vibrato and a little wander in pitch, and breath in the air above.
 */
export function choir(strike: Strike, sampleRate: number): Rendered {
  const f = hz(strike.pitch);
  const leads = [
    voiceTable(strike.pitch, sampleRate, 0.97, false),
    voiceTable(strike.pitch, sampleRate, 1.03, false),
  ];
  const onset = voiceTable(strike.pitch, sampleRate, 1, true);
  const section = voiceTable(strike.pitch, sampleRate, 1, false, true);
  const count = frames(strike.held + 0.85, sampleRate);
  const left = new Float32Array(count),
    right = new Float32Array(count);
  const rand = noise(strike.seed),
    breathL = noise(reseed(strike.seed, 0x31)),
    breathR = noise(reseed(strike.seed, 0x32));
  const phases = new Float64Array(6).map(() => 0.5 * (rand() + 1));
  const lfos = new Float64Array(6).map(() => 0.5 * (rand() + 1));
  phases[3] = phases[0];
  lfos[3] = lfos[0];
  const base = SING_CENTS.map((c) => (f * cents(c)) / sampleRate);
  const steps = new Float64Array(base);
  const kind = 1 + 0.15 * clamp((strike.pitch - 50) / 24, 0, 1);
  const airs = [svf(2500 * kind, 1.2, sampleRate), svf(2700 * kind, 1.2, sampleRate)];
  const env = envelope(strike.held, clamp(strike.held * 0.4, 0.05, 0.16), 0.2, sampleRate);
  const vowelFall = Math.exp(-1 / (0.05 * sampleRate));
  const glide = Math.round(0.4 * sampleRate);
  const pole = meterPole(sampleRate);
  let rising = 0,
    falling = 1,
    w = 1;
  let lowL = 0,
    lowR = 0,
    power = 0,
    weight = 0;
  for (let i = 0; i < count; i++) {
    if ((i & 15) === 0) {
      const t = i / sampleRate,
        at = strike.at + t;
      const depth = 0.0032 * clamp((t - 0.25) / 0.5, 0, 1);
      for (let v = 0; v < 6; v++)
        steps[v] =
          base[v] *
          (1 +
            depth * sine(at * SING_RATES[v] + lfos[v]) +
            (v % 3 ? 0.0012 : 0.0006) * sine(at * SING_WANDER[v] + lfos[v] * 3.7));
    }
    rising += (1 - rising) * env.up;
    if (i >= env.from) falling *= env.down;
    w *= vowelFall;
    for (let v = 0; v < 6; v++) {
      const ph = phases[v] + steps[v];
      phases[v] = ph >= 1 ? ph - 1 : ph;
    }
    let leadL = read(leads[0], phases[0]),
      leadR = read(leads[1], phases[3]);
    if (i < glide) {
      leadL += w * (read(onset, phases[0]) - leadL);
      leadR += w * (read(onset, phases[3]) - leadR);
    }
    const lvl = rising * falling;
    const breath = 0.05 * (0.6 + 0.4 * sine(phases[0]));
    const l =
      (leadL +
        0.8 * (read(section, phases[1]) + read(section, phases[2])) +
        breath * airs[0].run(breathL()).band) *
      lvl;
    const r =
      (leadR +
        0.8 * (read(section, phases[4]) + read(section, phases[5])) +
        breath * airs[1].run(breathR()).band) *
      lvl;
    lowL += pole * (l - lowL);
    lowR += pole * (r - lowR);
    power += (l - lowL) ** 2 + (r - lowR) ** 2;
    weight += lvl * lvl;
    left[i] = l;
    right[i] = r;
  }
  edges(left, sampleRate, 0.01, 0.05);
  edges(right, sampleRate, 0.01, 0.05);
  level([left, right], power, weight, loudness('choir', strike.pitch));
  return { left, right };
}
