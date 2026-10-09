// Shared building blocks for the town's instruments (one family a file in this folder):
// oscillators, filters, modal partials, envelopes and seeded noise. No Math.random or Date.

/** One note to play: its pitch, how long it is held, and where it starts in the loop. */
export type Strike = {
  /** MIDI pitch; drums and ambiences use it only to nudge their tuning. */
  pitch: number;
  /** Seconds the note is held: a damper, bow or breath stops after it; struck bars ring on. */
  held: number;
  /** Seconds into the loop the note starts, so tremolos and slow sweeps stay in step. */
  at: number;
  /** The note's own noise seed. */
  seed: number;
};
/** A rendered note at unit gain: mono, panned by the caller, or a stereo pair. */
export type Rendered = { left: Float32Array; right?: Float32Array };

export const TAU = Math.PI * 2;
export const hz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);
export const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
/** Octaves above middle C (negative below). */
export const register = (pitch: number) => (pitch - 60) / 12;

// A sine table for oscillators whose phase moves (FM, vibrato): sin(2π·cycles).
const TABLE_SIZE = 4096;
const TABLE = new Float64Array(TABLE_SIZE + 1);
for (let i = 0; i <= TABLE_SIZE; i++) TABLE[i] = Math.sin((TAU * i) / TABLE_SIZE);
export function sine(cycles: number) {
  const x = (cycles - Math.floor(cycles)) * TABLE_SIZE;
  const i = x | 0;
  return TABLE[i] + (TABLE[i + 1] - TABLE[i]) * (x - i);
}

/** White noise in -1..1 from a seed (the render's own LCG). */
export function noise(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2147483648 - 1;
  };
}
/** A second, independent stream from the same note. */
export const reseed = (seed: number, salt: number) =>
  (Math.imul(seed ^ salt, 2654435761) + salt) >>> 0;

/** A topology-preserving state-variable filter (stable at every cutoff). */
export function svf(cutoff: number, q: number, sampleRate: number) {
  let g = Math.tan((Math.PI * clamp(cutoff, 20, sampleRate * 0.45)) / sampleRate);
  const k = 1 / q;
  let a1 = 1 / (1 + g * (g + k)),
    a2 = g * a1,
    a3 = g * a2;
  let ic1 = 0,
    ic2 = 0;
  const state = { low: 0, band: 0, high: 0 };
  return {
    state,
    /** Retunes the cutoff (for sweeps). */
    tune(next: number) {
      g = Math.tan((Math.PI * clamp(next, 20, sampleRate * 0.45)) / sampleRate);
      a1 = 1 / (1 + g * (g + k));
      a2 = g * a1;
      a3 = g * a2;
    },
    run(input: number) {
      const v3 = input - ic2;
      const v1 = a1 * ic1 + a2 * v3;
      const v2 = ic2 + a2 * ic1 + a3 * v3;
      ic1 = 2 * v1 - ic1;
      ic2 = 2 * v2 - ic2;
      state.low = v2;
      state.band = v1;
      state.high = input - k * v1 - v2;
      return state;
    },
  };
}

/** A one-pole low-pass: y += a·(x − y). */
export function onePole(cutoff: number, sampleRate: number) {
  const a = 1 - Math.exp((-TAU * clamp(cutoff, 5, sampleRate * 0.45)) / sampleRate);
  let y = 0;
  return (x: number) => (y += a * (x - y));
}

/** A band-limited sawtooth (PolyBLEP), -1..1, whose frequency may change every sample. */
export function saw(phase0 = 0) {
  let phase = phase0 - Math.floor(phase0);
  return (step: number) => {
    phase += step;
    if (phase >= 1) phase -= Math.floor(phase);
    let value = 2 * phase - 1;
    if (phase < step) {
      const t = phase / step;
      value -= t + t - t * t - 1;
    } else if (phase > 1 - step) {
      const t = (phase - 1) / step;
      value -= t * t + t + t + 1;
    }
    return value;
  };
}

/**
 * Adds a decaying partial, amp·e^(−t/τ)·sin(2πft + φ), from sample `from` on, by recurrence.
 * Partials above 0.45 of the sample rate are left out rather than aliased.
 */
export function mode(
  out: Float32Array,
  frequency: number,
  amp: number,
  tau: number,
  sampleRate: number,
  phase = 0,
  from = 0,
) {
  if (frequency <= 0 || frequency >= sampleRate * 0.45 || amp === 0) return;
  const w = (TAU * frequency) / sampleRate;
  const r = Math.exp(-1 / (tau * sampleRate));
  const c = 2 * r * Math.cos(w),
    r2 = r * r;
  let y1 = amp * r * Math.sin(w + phase),
    y2 = amp * Math.sin(phase);
  const end = Math.min(out.length, from + Math.ceil(tau * sampleRate * 9.2));
  if (from < end) out[from] += y2;
  for (let i = from + 1; i < end; i++) {
    out[i] += y1;
    const next = c * y1 - r2 * y2;
    y2 = y1;
    y1 = next;
  }
}

/** Fades the first `attack` and last `tail` seconds so no note starts or ends on a click. */
export function edges(samples: Float32Array, sampleRate: number, attack: number, tail = 0.012) {
  const a = Math.max(1, Math.round(attack * sampleRate));
  for (let i = 0; i < Math.min(a, samples.length); i++)
    samples[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / a);
  const t = Math.max(1, Math.round(tail * sampleRate));
  for (let i = 0; i < Math.min(t, samples.length); i++)
    samples[samples.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / t);
}

/** After `held` seconds, a damper: e^(−(t − held)/τ). */
export function damp(samples: Float32Array, sampleRate: number, held: number, tau: number) {
  const from = Math.round(held * sampleRate);
  const r = Math.exp(-1 / (tau * sampleRate));
  let level = 1;
  for (let i = Math.max(0, from); i < samples.length; i++) {
    samples[i] *= level;
    level *= r;
  }
}

export const frames = (seconds: number, sampleRate: number) =>
  Math.max(1, Math.ceil(clamp(seconds, 0.01, 12) * sampleRate));

/** Scales a note so its loudest sample is `peak`. */
export function normalize(samples: Float32Array[], peak: number) {
  let top = 0;
  for (const channel of samples)
    for (let i = 0; i < channel.length; i++) top = Math.max(top, Math.abs(channel[i]));
  if (top < 1e-9) return;
  const scale = peak / top;
  for (const channel of samples) for (let i = 0; i < channel.length; i++) channel[i] *= scale;
}

/** Rises over `rise` seconds, holds, then falls with τ `fall` after `held`. */
export const swell = (t: number, held: number, rise: number, fall: number) =>
  (1 - Math.exp(-t / rise)) * (t < held ? 1 : Math.exp(-(t - held) / fall));
