// Plucked strings: nylon guitar, harp and upright bass (Karplus–Strong), and a fingered electric bass.
// The three Karplus–Strong strings share one model: a band-limited pluck (the bridge force of a
// string pulled aside at one point and let go, softened by the finger), two polarizations that
// decay at different rates (a quick bloom, then a long ring), a loss filter whose damping grows
// with the square of frequency (a low note keeps its warmth, a high note still rings), an
// all-pass that tunes each loop exactly at its fundamental, and a few body resonances.
// Every note is levelled by its loudness (K-weighted, over its first 200 ms, before any damper),
// so one gain plucks every pitch, and all four instruments, about equally loud, and a short note
// starts as loud as a long one. `held` is when the fingers damp the string; the harp rings on.
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
  reseed,
  type Rendered,
  sine,
  type Strike,
  svf,
  TAU,
} from './dsp';

/** A fall of 60 dB, in nepers. */
const T60 = Math.log(1000);
/** The window a note's loudness is measured over, before any damper (seconds). */
const MEASURE = 0.2;
/** The K-weighted RMS every note here is levelled to over that window (about −11 dBFS). */
const LOUDNESS = 0.28;
/** No note's peak goes over this. */
const CEILING = 0.94;

/**
 * BS.1770's K-weighting (a +4 dB shelf above ~1.7 kHz and a high-pass at 38 Hz) as two biquads,
 * then the RMS over a note's first `seconds`: how loud its pluck sounds, whatever its pitch.
 */
function loudness(x: Float32Array, sampleRate: number, seconds: number) {
  const biquad = (b0: number, b1: number, b2: number, a1: number, a2: number) => {
    let x1 = 0,
      x2 = 0,
      y1 = 0,
      y2 = 0;
    return (v: number) => {
      const y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = v;
      y2 = y1;
      y1 = y;
      return y;
    };
  };
  let K = Math.tan((Math.PI * 1681.97) / sampleRate);
  let Q = 0.70718;
  const Vh = 10 ** (4 / 20),
    Vb = Vh ** 0.49967;
  let a0 = 1 + K / Q + K * K;
  const shelf = biquad(
    (Vh + (Vb * K) / Q + K * K) / a0,
    (2 * (K * K - Vh)) / a0,
    (Vh - (Vb * K) / Q + K * K) / a0,
    (2 * (K * K - 1)) / a0,
    (1 - K / Q + K * K) / a0,
  );
  K = Math.tan((Math.PI * 38.135) / sampleRate);
  Q = 0.50033;
  a0 = 1 + K / Q + K * K;
  const high = biquad(1 / a0, -2 / a0, 1 / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0);
  const n = Math.min(x.length, Math.round(seconds * sampleRate));
  let sum = 0;
  for (let i = 0; i < n; i++) sum += high(shelf(x[i])) ** 2;
  return Math.sqrt(sum / Math.max(1, n));
}

/**
 * Takes out what offset the note's cut edges leave (a low note seldom ends on a whole cycle)
 * with one slow Hann-shaped bump across it, then scales it to the family's loudness, its peak
 * kept under the ceiling.
 */
function level(out: Float32Array, measured: number) {
  let mean = 0;
  for (let i = 0; i < out.length; i++) mean += out[i];
  mean /= out.length;
  // cos(step·i) by rotation.
  const cs = Math.cos(TAU / out.length),
    sn = Math.sin(TAU / out.length);
  let c = 1,
    s = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] -= mean * (1 - c);
    const next = c * cs - s * sn;
    s = s * cs + c * sn;
    c = next;
  }
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak < 1e-9 || measured < 1e-12) return;
  const scale = Math.min(LOUDNESS / measured, CEILING / peak);
  for (let i = 0; i < out.length; i++) out[i] *= scale;
}

/**
 * One polarization of a string: a delay line closed through a one-pole loss filter and a
 * first-order all-pass. The loss filter's damping rises with the square of frequency at
 * `damping` (nepers a second per Hz²), and its gain sets the fundamental's `t60`; the
 * all-pass takes up the fractional delay, both measured at the fundamental, so the loop rings
 * exactly at `f`. `shape` is one period of the pluck, added in at `weight`.
 */
function polarization(
  out: Float32Array,
  shape: Float64Array,
  f: number,
  t60: number,
  damping: number,
  weight: number,
  sampleRate: number,
) {
  const period = sampleRate / f;
  const w = (TAU * f) / sampleRate;
  const sigma = T60 / t60;
  // The f² loss can't be more than most of the fundamental's own decay (the filter's DC gain
  // would pass 1), and its delay must leave the loop a few samples.
  const b = Math.min(damping, (0.8 * sigma) / (f * f));
  // A one-pole low-pass with its pole at u loses ½·u/(1−u)²·ω² more per trip at ω than at DC;
  // the string loses b·φ²/f more per trip at φ Hz. Matching the two at low frequency gives u.
  const kappa = (b * sampleRate * sampleRate) / (2 * TAU * Math.PI * f);
  let u = kappa > 1e-9 ? (4 * kappa + 1 - Math.sqrt(8 * kappa + 1)) / (4 * kappa) : 0;
  u = Math.max(0, Math.min(u, 0.9, (period - 3) / (period - 2)));
  const a = -u;
  const lossDelay = -Math.atan2(a * Math.sin(w), 1 + a * Math.cos(w)) / w;
  const target = Math.exp(-sigma / f);
  const g = Math.min(0.99995, (target * Math.sqrt(1 + 2 * a * Math.cos(w) + a * a)) / (1 + a));
  const b0 = g * (1 + a);
  // Delay = N (buffer) + the loss filter's + Δ (all-pass), Δ kept in 0.1..1.1.
  const N = Math.max(2, Math.floor(period - lossDelay - 0.1));
  const delta = period - lossDelay - N;
  const C = Math.sin(((1 - delta) * w) / 2) / Math.sin(((1 + delta) * w) / 2);
  // The buffer holds N of the period's samples, which needn't sum to zero: take out their mean,
  // or the loop (whose DC gain is g, a hair under 1) would carry an offset for the whole note.
  const buffer = new Float64Array(N);
  let mean = 0;
  for (let i = 0; i < N; i++) mean += shape[i] / N;
  for (let i = 0; i < N; i++) buffer[i] = weight * (shape[i] - mean);
  let index = 0,
    low = 0,
    apIn = 0,
    apOut = 0;
  // Warm the filters on the period, as if the string had been ringing, so the first trip round
  // the loop doesn't start them from rest (a small click one period in).
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < N; i++) {
      low = b0 * buffer[i] - a * low;
      const y = C * low + apIn - C * apOut;
      apIn = low;
      apOut = y;
    }
  for (let i = 0; i < out.length; i++) {
    const x = buffer[index];
    out[i] += x;
    low = b0 * x - a * low;
    const y = C * low + apIn - C * apOut;
    apIn = low;
    apOut = y;
    buffer[index] = y;
    if (++index === N) index = 0;
  }
}

/** Adds `gain` × a resonance at `at` Hz (a state-variable band-pass, peak gain Q) of `x` to `out`. */
function resonate(
  x: Float32Array,
  out: Float32Array,
  at: number,
  q: number,
  gain: number,
  sampleRate: number,
) {
  const g = Math.tan((Math.PI * at) / sampleRate),
    k = 1 / q;
  const a1 = 1 / (1 + g * (g + k)),
    a2 = g * a1,
    a3 = g * a2;
  let ic1 = 0,
    ic2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v3 = x[i] - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    out[i] += gain * v1;
  }
}

type PluckShape = {
  /** Seconds for the fundamental to fall 60 dB at middle C… */
  t60: number;
  /** …and how that changes an octave up (×2^−slope), clamped to `ring`. */
  slope: number;
  ring: readonly [number, number];
  /** Extra damping that grows with frequency², in nepers a second per Hz²: higher is mellower. */
  damping: number;
  /** Where on the string it is plucked, 0..0.5 from the bridge: the comb in the pluck's partials. */
  position: number;
  /** The finger's softness: the pluck's partials roll off above this (Hz)… */
  finger: number;
  /** …on a slope of 1/k^tilt below it (1 is the bare bridge force; the body radiates its highs). */
  tilt: number;
  /** Seconds to fall 60 dB once let go; Infinity lets it ring. */
  letGo: number;
  /** Body resonances: [Hz, Q, gain] each, added to the string's sound. */
  body: readonly (readonly [number, number, number])[];
  /** The finger's own sound: [centre Hz, decay s, level] of a short burst of noise. */
  touch: readonly [number, number, number];
  /** Output low-pass, Hz. */
  tone: number;
  /** Fade-in, seconds. */
  attack: number;
};

/** Karplus–Strong with a band-limited pluck, two polarizations and a body. */
function pluck(strike: Strike, sampleRate: number, shape: PluckShape): Rendered {
  const f = hz(strike.pitch);
  const octave = register(strike.pitch);
  const t60 = clamp(shape.t60 * 2 ** (-octave * shape.slope), shape.ring[0], shape.ring[1]);
  const lets = Number.isFinite(shape.letGo);
  const ringFor = t60 * 1.12;
  const length = (lets ? Math.min(strike.held, ringFor) + shape.letGo : ringFor) + 0.02;
  const count = frames(length, sampleRate);
  // Render at least the loudness window, so a short note is levelled like a long one.
  const raw = new Float32Array(Math.max(count, Math.ceil(MEASURE * sampleRate)));
  const rand = noise(strike.seed);
  // The pluck: one period of the bridge force of a string pulled aside at `position` and let go,
  // a pulse whose k-th partial is sin(πk·position)/k (here 1/k^tilt, for the body's radiation),
  // softened by the finger and band-limited below 0.42 of the sample rate, so no pitch aliases
  // and no seed plucks a lopsided tone; the position and partials wander a little note to note.
  const period = sampleRate / f;
  const position = shape.position * (1 + 0.06 * rand());
  const partials = Math.max(1, Math.floor((0.42 * sampleRate) / f));
  const pulse = new Float64Array(Math.ceil(period) + 2);
  for (let k = 1; k <= partials; k++) {
    const roll = 1 / (1 + ((k * f) / shape.finger) ** 2);
    const amp = (Math.sin(Math.PI * k * position) / k ** shape.tilt) * roll * (1 + 0.08 * rand());
    if (Math.abs(amp) < 1e-5) continue;
    const step = k / period,
      phase = 0.25 - (k * position) / 2;
    for (let i = 0; i < pulse.length; i++) pulse[i] += amp * sine(step * i + phase);
  }
  // Two polarizations: one couples to the bridge and fades first, the other sings on, a hair
  // sharp of it, so the note blooms and then settles into a long, gently moving ring.
  polarization(raw, pulse, f * 2 ** (-0.25 / 1200), t60 * 0.7, shape.damping, 0.66, sampleRate);
  polarization(raw, pulse, f * 2 ** (0.25 / 1200), t60 * 1.3, shape.damping, 0.34, sampleRate);
  // The finger's touch on the string.
  const [touchHz, touchDecay, touchLevel] = shape.touch;
  if (touchLevel > 0) {
    let top = 0;
    for (let i = 0; i < pulse.length; i++) top = Math.max(top, Math.abs(pulse[i]));
    const band = svf(touchHz, 0.9, sampleRate);
    const touch = noise(reseed(strike.seed, 0x7a11));
    const span = Math.min(raw.length, Math.ceil(touchDecay * 7 * sampleRate));
    const fall = Math.exp(-1 / (touchDecay * sampleRate));
    let env = top * touchLevel;
    for (let i = 0; i < span; i++) {
      raw[i] += band.run(touch()).band * env;
      env *= fall;
    }
  }
  // The body's resonances, then the radiation's gentle top roll-off.
  const voiced = Float32Array.from(raw);
  for (const [at, q, gain] of shape.body) resonate(raw, voiced, at, q, gain, sampleRate);
  const smooth = 1 - Math.exp((-TAU * shape.tone) / sampleRate);
  let y = 0;
  for (let i = 0; i < raw.length; i++) raw[i] = y += smooth * (voiced[i] - y);
  const measured = loudness(raw, sampleRate, MEASURE);
  const out = raw.length === count ? raw : raw.slice(0, count);
  if (lets) damp(out, sampleRate, Math.min(strike.held, ringFor), shape.letGo / T60);
  edges(out, sampleRate, shape.attack, 0.02);
  level(out, measured);
  return { left: out };
}

/**
 * A classical guitar: nylon strings, fingertip and a little nail, a warm cedar-topped body.
 * E2–B5 (40–83), sweetest B2–E5. Rings until `held` (at most ~7 s low, 3.5 s at E4, 2 s at B5),
 * then is damped within 0.2 s.
 */
export const nylon = (strike: Strike, sampleRate: number) =>
  pluck(strike, sampleRate, {
    t60: 3.6,
    slope: 0.5,
    ring: [1, 7],
    damping: 3e-6,
    position: 0.19,
    finger: 2200,
    tilt: 0.6,
    letGo: 0.2,
    body: [
      [98, 1.6, 0.32],
      [205, 2.4, 0.16],
      [410, 2.5, 0.06],
    ],
    touch: [2400, 0.003, 0.05],
    tone: 5500,
    attack: 0.0015,
  });

/**
 * A concert harp: gut strings plucked near their middle with the finger pads. C1–G7 (24–103),
 * sweetest C3–C6. Ignores `held` and rings on: ~6.7 s low, 4.9 s at C4, 2.1 s at C6, 1.1 s top.
 */
export const harp = (strike: Strike, sampleRate: number) =>
  pluck(strike, sampleRate, {
    t60: 4.4,
    slope: 0.6,
    ring: [1, 6],
    damping: 3e-6,
    position: 0.4,
    finger: 1700,
    tilt: 0.7,
    letGo: Infinity,
    body: [[170, 0.9, 0.18]],
    touch: [1800, 0.003, 0.03],
    tone: 6500,
    attack: 0.0015,
  });

/**
 * A double bass, pizzicato: a big soft finger, a round bloom and the body's low wood. E1–D4
 * (28–62), sweetest A1–D3. Rings until `held` (at most ~4 s at E1, 2.2 s at C3), then is
 * damped within 0.13 s.
 */
export const upright = (strike: Strike, sampleRate: number) =>
  pluck(strike, sampleRate, {
    t60: 1.4,
    slope: 0.5,
    ring: [0.8, 4.5],
    damping: 2e-5,
    position: 0.27,
    finger: 900,
    tilt: 0.8,
    letGo: 0.13,
    body: [
      [68, 1.3, 0.3],
      [135, 1.8, 0.18],
    ],
    touch: [350, 0.006, 0.1],
    tone: 3000,
    attack: 0.0025,
  });

/**
 * A fingered electric bass, flatwound strings and the tone rolled back: string modes (the pluck's
 * and the pickup's combs, damping rising with frequency², a little stiffness), a soft thump
 * under the finger and a touch of the amp's warmth. E1–C4 (28–60), sweetest E1–E3. Rings until
 * `held` (at most ~5 s at E1, 3 s at C3), then the fingers mute it within 0.3 s.
 */
export function fingerbass(strike: Strike, sampleRate: number): Rendered {
  const f = hz(strike.pitch);
  const octave = register(strike.pitch);
  // Fretting higher shortens the string: stiffer, and a shorter sustain.
  const above = Math.max(0, strike.pitch - 28) / 12;
  const stiffness = Math.min(2e-4, 3e-5 * 2 ** above);
  const stretch = Math.sqrt(1 + stiffness);
  const t60 = clamp(4.2 * 2 ** (-(octave + 2) * 0.45), 1.2, 5);
  const length = Math.min(strike.held, t60) + 0.32;
  const count = frames(length, sampleRate);
  const raw = new Float32Array(Math.max(count, Math.ceil(MEASURE * sampleRate)));
  const rand = noise(strike.seed);
  // Plucked between the pickups, heard through the neck one: their combs leave a strong second
  // to fourth partial (the bass's punch on small speakers) and hollow out the fifth.
  const pluckAt = 0.18 * (1 + 0.05 * rand()),
    pickupAt = 0.21;
  const damping = 1.2e-5;
  for (let k = 1; k <= 24; k++) {
    const fk = (k * f * Math.sqrt(1 + stiffness * k * k)) / stretch;
    if (fk > 0.42 * sampleRate || (k > 1 && fk > 5000)) break;
    const amp =
      ((Math.sin(Math.PI * k * pluckAt) * Math.sin(Math.PI * k * pickupAt)) / k) *
      (1 / (1 + (fk / 1100) ** 2));
    if (Math.abs(amp) < 2e-4) continue;
    const sigma = T60 / t60 + damping * (fk * fk - f * f);
    // The string's first, quick fall (the attack's brightness) and its long settle; above the
    // third partial one mode in between does.
    if (k <= 3) {
      mode(raw, fk, amp * 0.55, 1 / (sigma * 2.2), sampleRate, 0);
      mode(raw, fk, amp * 0.45, 1 / sigma, sampleRate, 0);
    } else mode(raw, fk, amp, 1 / (sigma * 1.5), sampleRate, 0);
  }
  // The finger leaving the string: a soft, low thump.
  const thump = noise(reseed(strike.seed, 0x51b)),
    low = svf(160, 0.8, sampleRate);
  let top = 0;
  for (let i = 0; i < Math.min(raw.length, 2400); i++) top = Math.max(top, Math.abs(raw[i]));
  const span = Math.min(raw.length, Math.round(0.04 * sampleRate));
  for (let i = 0; i < span; i++)
    raw[i] += low.run(thump()).band * top * 0.25 * Math.exp(-i / (0.008 * sampleRate));
  // The amp: a soft saturation, then a DC blocker and its speaker's gentle top.
  let peak = 0;
  for (let i = 0; i < raw.length; i++) peak = Math.max(peak, Math.abs(raw[i]));
  const drive = 1.1 / Math.max(peak, 1e-9);
  const block = Math.exp((-TAU * 18) / sampleRate);
  const speaker = onePole(2600, sampleRate);
  let lastIn = 0,
    lastOut = 0;
  for (let i = 0; i < raw.length; i++) {
    // tanh, near enough below 1.1 (its Padé approximant).
    const v = raw[i] * drive;
    const x = (v * (27 + v * v)) / (27 + 9 * v * v);
    lastOut = x - lastIn + block * lastOut;
    lastIn = x;
    raw[i] = speaker(lastOut);
  }
  const measured = loudness(raw, sampleRate, MEASURE);
  const out = raw.length === count ? raw : raw.slice(0, count);
  damp(out, sampleRate, Math.min(strike.held, t60), 0.045);
  edges(out, sampleRate, 0.003, 0.02);
  level(out, measured);
  return { left: out };
}
