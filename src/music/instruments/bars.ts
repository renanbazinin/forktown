// Struck bars and plucked tines: marimba, vibraphone, music box and kalimba, each a sum of
// decaying modes at the bar's own ratios (tuned 1:4:10 for marimba and vibes, a clamped tine's
// 1:6.27:17.55 for the music box). The mallet, pin or thumb is a contact time that softens the
// upper modes, so low notes keep some wood and high notes stay round rather than shrill. Pitch
// lives in the fundamental alone: overtones sit at exact ratios, a resonator tube blooms at the
// fundamental's own frequency, and a shimmer is a symmetric pair either side of it, so nothing
// drags the note sharp or flat. Every note is levelled to the same loudness, not the same peak.
import {
  clamp,
  damp,
  edges,
  frames,
  hz,
  mode,
  noise,
  onePole,
  register,
  type Rendered,
  sine,
  type Strike,
} from './dsp';

/**
 * A mode: ratio to the fundamental, level as a hard strike excites it, and decay as a share of
 * the fundamental's.
 */
type Mode = readonly [number, number, number];
type Bar = {
  modes: readonly Mode[];
  /** The fundamental's decay time constant at middle C, seconds. */
  tau: number;
  /** How quickly it shortens up the keyboard (per octave, as a power of two). */
  taper: number;
  /** The mallet's, pin's or thumb's contact time at middle C, seconds; shorter up the keyboard. */
  contact: number;
  /** Raised-cosine onset, seconds. */
  attack: number;
  /** A sine (struck: the bar starts moving) or cosine (plucked: the tine is let go) start. */
  plucked?: boolean;
  /**
   * A tuned tube under the bar: its level against the bar's fundamental and its Q (how fast it
   * fills); a motor's tremolo (rate in Hz, depth 0..1) opens and closes it.
   */
  resonator?: { level: number; q: number; tremolo?: readonly [number, number] };
  /** Two sidebands either side of the fundamental: cents away, level each, decay share. */
  shimmer?: readonly [number, number, number];
  /** A damper after the held time (vibes' pedal), seconds; otherwise it rings out. */
  damper?: number;
  /** The mallet, pin or thumb itself: filtered noise, its cutoff, level and decay in seconds. */
  knock?: readonly [number, number, number];
};

/** The spectrum of a half-sine contact pulse, smoothed over its nulls: 1 at low frequencies. */
const contactWeight = (frequency: number, contact: number) => {
  const x = 2 * frequency * contact;
  return 1 / (1 + 0.5 * x * x);
};
/** A gentle fade of partials from 7 kHz to 10.5 kHz, so nothing ever switches off at Nyquist. */
const air = (frequency: number) =>
  frequency <= 7000
    ? 1
    : frequency >= 10500
      ? 0
      : 0.5 + 0.5 * Math.cos((Math.PI * (frequency - 7000)) / 3500);

/**
 * The note's loudness: mean square of its first 0.4 s through a BS.1770-style K-weighting
 * (a +4 dB shelf above 1.7 kHz), so a bright note counts for more than a dull one of equal level.
 */
function loudness(samples: Float32Array, sampleRate: number) {
  const span = Math.round(0.4 * sampleRate);
  const n = Math.min(samples.length, span);
  // RBJ high shelf, +4 dB at 1681 Hz, Q 0.707.
  const A = 10 ** (4 / 40),
    w = (2 * Math.PI * 1681) / sampleRate,
    cs = Math.cos(w),
    s = 2 * Math.sqrt(A) * (Math.sin(w) / (2 * Math.SQRT1_2));
  const a0 = A + 1 - (A - 1) * cs + s;
  const b0 = (A * (A + 1 + (A - 1) * cs + s)) / a0,
    b1 = (-2 * A * (A - 1 + (A + 1) * cs)) / a0,
    b2 = (A * (A + 1 + (A - 1) * cs - s)) / a0,
    a1 = (2 * (A - 1 - (A + 1) * cs)) / a0,
    a2 = (A + 1 - (A - 1) * cs - s) / a0;
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0,
    sum = 0;
  for (let i = 0; i < n; i++) {
    const x = samples[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    sum += y * y;
  }
  return sum / span;
}

/** The family's loudness: K-weighted mean square over 0.4 s at unit gain (about −9 LUFS). */
const TARGET = 0.15;
const PEAK = 0.9;

function struck(strike: Strike, sampleRate: number, bar: Bar): Rendered {
  const f = hz(strike.pitch);
  const octave = register(strike.pitch);
  const tau = clamp(bar.tau * 2 ** (-octave * bar.taper), 0.08, 6);
  const contact = bar.contact * 2 ** (-octave * 0.5);
  const phase = bar.plucked ? Math.PI / 2 : 0;
  const weight = (frequency: number) => contactWeight(frequency, contact) * air(frequency);
  const w1 = Math.max(weight(f), 1e-6);
  // Ring until the slowest part is 50 dB down (a damper may stop it sooner).
  let slowest = 1;
  for (const [, , share] of bar.modes) slowest = Math.max(slowest, share);
  if (bar.shimmer) slowest = Math.max(slowest, bar.shimmer[2]);
  const natural = tau * slowest * 5.8 + 0.05;
  const length = bar.damper ? Math.min(natural, strike.held + bar.damper * 6) : natural;
  const out = new Float32Array(frames(length, sampleRate));

  for (const [ratio, amp, share] of bar.modes) {
    const g = weight(f * ratio) / w1;
    mode(out, f * ratio, amp * g, tau * share, sampleRate, phase);
  }
  if (bar.shimmer) {
    const [cents, level, share] = bar.shimmer;
    const spread = 2 ** (cents / 1200);
    mode(out, f * spread, level, tau * share, sampleRate, phase);
    mode(out, f / spread, level, tau * share, sampleRate, phase);
  }
  // The tube fills over Q/(πf) and then follows the bar: e^(−t/τ) − e^(−t/τ − t/rise), in phase.
  let tube: Float32Array | undefined;
  if (bar.resonator) {
    const { level, q } = bar.resonator;
    const rise = clamp(q / (Math.PI * f), 0.004, 0.06);
    tube = new Float32Array(out.length);
    mode(tube, f, level, tau, sampleRate, phase);
    mode(tube, f, -level, 1 / (1 / tau + 1 / rise), sampleRate, phase);
  }
  if (bar.knock) {
    const [cutoff, level, time] = bar.knock;
    const rand = noise(strike.seed),
      low1 = onePole(cutoff, sampleRate),
      low2 = onePole(cutoff, sampleRate);
    const span = Math.min(out.length, Math.round(time * 8 * sampleRate));
    const rise = Math.max(1, Math.round(0.0006 * sampleRate));
    for (let i = 0; i < span; i++) {
      const env = Math.exp(-i / (time * sampleRate)) * (i < rise ? i / rise : 1);
      out[i] += low2(low1(rand())) * env * level;
    }
  }
  // Level by loudness, measured with the tube at its average (the motor only ever takes some away).
  const average = bar.resonator?.tremolo ? 1 - bar.resonator.tremolo[1] / 2 : 1;
  if (tube) for (let i = 0; i < out.length; i++) out[i] += tube[i] * average;
  const gain = Math.sqrt(TARGET / Math.max(loudness(out, sampleRate), 1e-12));
  if (tube && bar.resonator?.tremolo) {
    // Motor discs in the tubes open and close them: only the tube's share swells and fades.
    const [rate, depth] = bar.resonator.tremolo;
    for (let i = 0; i < out.length; i++) {
      const open = 1 - depth * (0.5 + 0.5 * sine((strike.at + i / sampleRate) * rate));
      out[i] += tube[i] * (open - average);
    }
  }
  if (bar.damper) damp(out, sampleRate, strike.held, bar.damper);
  // A DC blocker at 12 Hz: sine-phase modes and noise leave a small offset on low, short notes.
  const r = Math.exp((-2 * Math.PI * 12) / sampleRate);
  let previous = 0,
    y = 0;
  for (let i = 0; i < out.length; i++) {
    const x = out[i];
    y = x - previous + r * y;
    previous = x;
    out[i] = y;
  }
  edges(out, sampleRate, bar.attack, 0.03);
  let top = 0;
  for (let i = 0; i < out.length; i++) top = Math.max(top, Math.abs(out[i]));
  const scale = Math.min(gain, top > 0 ? PEAK / top : gain);
  for (let i = 0; i < out.length; i++) out[i] *= scale;
  return { left: out };
}

/**
 * Rosewood bars over tuned tubes: overtones at two octaves and three octaves and a third, yarn
 * mallets, and a tube that blooms the fundamental a few tens of milliseconds after the knock.
 */
export const marimba = (strike: Strike, sampleRate: number) =>
  struck(strike, sampleRate, {
    modes: [
      [1, 1, 1],
      [4, 0.42, 0.22],
      [10, 0.55, 0.08],
    ],
    tau: 0.5,
    taper: 0.6,
    contact: 0.0013,
    attack: 0.0015,
    resonator: { level: 0.6, q: 28 },
    knock: [700, 0.16, 0.003],
  });
/**
 * Aluminium bars (1:4:10) with cord mallets, a long ring under the pedal and a felt damper after
 * the held time. The motor turns discs in the tubes, so the fundamental's tube share pulses while
 * the bar's own sound stays steady.
 */
export const vibes = (strike: Strike, sampleRate: number) =>
  struck(strike, sampleRate, {
    modes: [
      [1, 1, 1],
      [4, 0.5, 0.16],
      [10, 0.3, 0.05],
    ],
    tau: 2.4,
    taper: 0.45,
    contact: 0.0008,
    attack: 0.0012,
    resonator: { level: 0.9, q: 35, tremolo: [4.8, 0.7] },
    damper: 0.12,
    knock: [2600, 0.07, 0.0025],
  });
/** 0 above `top`, easing to 1 at `bottom` and below: how far into the bass a note is. */
const bass = (pitch: number, top: number, bottom: number) => {
  const x = clamp((top - pitch) / (top - bottom), 0, 1);
  return x * x * (3 - 2 * x);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * A steel comb plucked by pins: a clamped tine's modes (1 : 6.27 : 17.55) at the levels a pluck at
 * its tip drives into the comb, a quick sparkle over a long, pure ring, and a slow shimmer from a
 * symmetric pair around the fundamental. Bass tines carry lead under the tip, as real combs do:
 * a tip mass 0.0945 of the tine's lifts its second mode to 6.5 and weakens it, which also keeps
 * that mode from tugging the low notes sharp (at 6.27 an auditory pitch model heard C4 at +10
 * cents, C3 at +36).
 */
export const musicbox = (strike: Strike, sampleRate: number) => {
  const lead = bass(strike.pitch, 76, 63);
  return struck(strike, sampleRate, {
    modes: [
      [1, 1, 1],
      [mix(6.267, 6.5, lead), mix(0.17, 0.128, lead), 0.09],
      [mix(17.55, 18.61, lead), mix(0.06, 0.036, lead), 0.04],
    ],
    tau: 1.3,
    taper: 0.5,
    contact: 0.00015,
    attack: 0.0008,
    plucked: true,
    shimmer: [1.6, 0.11, 1.4],
    knock: [5200, 0.08, 0.0015],
  });
};
/**
 * Steel tines over a bridge on a hollow box, plucked by the thumb as it slips off the tip: a faint
 * second harmonic from the tine pressing the bridge (fading twice as fast as the fundamental), a
 * bent tine's inharmonic overtones, and the thumb's soft thud on the box. Real tines' first
 * overtone lands anywhere from about 5 to 7 times the fundamental; these are tuned to 5.5 and
 * 13.5, half-way between harmonics, where they colour the note without dragging its pitch (at
 * 5.65 an auditory pitch model heard C4 five cents flat).
 */
export const kalimba = (strike: Strike, sampleRate: number) =>
  struck(strike, sampleRate, {
    modes: [
      [1, 1, 1],
      [2, 0.064, 0.5],
      [5.5, 0.27, 0.14],
      [13.5, 0.23, 0.04],
    ],
    tau: 0.9,
    taper: 0.5,
    contact: 0.0006,
    attack: 0.0025,
    plucked: true,
    knock: [900, 0.12, 0.004],
  });
