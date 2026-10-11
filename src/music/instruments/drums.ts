// Drums and percussion for brushes-and-felt playing: kick, brush, swish, rim, shaker, ride, tick.
// Physically informed: a membrane's modes under a felt beater, wire bristles scattered over a
// snare head, beads rattling in a shell (after Cook's PhISEM), a cymbal's dense inharmonic
// partials blooming upward, and a wooden block whose partials die faster the higher they are.
// The kick and the woodblock are tuned to the note; the others only lean a little with it.
import {
  clamp,
  edges,
  frames,
  hz,
  mode,
  noise,
  normalize,
  onePole,
  type Rendered,
  reseed,
  sine,
  type Strike,
  svf,
  TAU,
} from './dsp';

/** The pitch moved by whole octaves into [low, low + 12): a drum tuned to the note's name. */
const fold = (pitch: number, low: number) => low + ((((pitch - low) % 12) + 12) % 12);
/** A light lean for the untuned drums: a pitch an octave either side of middle C moves them ±3. */
const lean = (pitch: number) => 2 ** (clamp(pitch - 60, -12, 12) / 48);
/** A raised-cosine rise over `span` seconds (a beater's or a hand's contact). */
const rise = (t: number, span: number) =>
  t >= span ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * t) / span);

/** Takes out any DC (a one-pole high-pass at `cutoff`), in place. */
function settle(samples: Float32Array, cutoff: number, sampleRate: number) {
  const a = Math.exp((-TAU * cutoff) / sampleRate);
  let x1 = 0,
    y = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    y = a * (y + x - x1);
    x1 = x;
    samples[i] = y;
  }
}

/** How much of a soft beater's push, in contact for `span` seconds, reaches `f` (half-sine). */
function contact(f: number, span: number) {
  const x = 2 * f * span;
  if (Math.abs(1 - x * x) < 1e-6) return Math.PI / 4;
  return Math.abs(Math.cos((Math.PI * x) / 2) / (1 - x * x));
}

// Peak levels, set so that at the same note gain the family sounds about equally loud at its
// sweet spot: the energy of the loudest 200 ms, weighted by an equal-loudness curve for quiet
// listening (between BS.1770's K-weighting and ISO 226's 60-phon contour). The kick at C2 sets
// the level, as its low boom needs the most peak for its loudness.
const LEVEL = {
  softkick: 0.94,
  brush: 0.55,
  swish: 0.26,
  rim: 0.72,
  shaker: 0.8,
  ride: 0.25,
  tick: 0.44,
};

// A kick drum's batter head, as an ideal circular membrane: [ratio, share, decay in seconds]. The
// beater lands a little off centre, so the modes with a nodal line through it speak only softly.
const MEMBRANE = [
  [1, 1, 0.14],
  [1.594, 0.16, 0.075],
  [2.136, 0.07, 0.05],
  [2.296, 0.22, 0.055],
  [2.653, 0.04, 0.035],
  [2.918, 0.05, 0.03],
  [3.6, 0.08, 0.025],
] as const;

/**
 * A felt-beater kick, tuned to the note's name between G1 and F#2 (C2 for both 36 and 60): a
 * round boom whose pitch settles as the head relaxes, and a soft thud of felt on skin.
 */
export function softkick(strike: Strike, sampleRate: number): Rendered {
  const out = new Float32Array(frames(0.8, sampleRate));
  const f0 = hz(fold(strike.pitch, 31));
  const press = 0.0045; // the felt stays on the head about 4.5 ms
  const shares = MEMBRANE.map(([ratio, share]) => share * contact(ratio * f0 * 1.2, press));
  const fades = MEMBRANE.map(([, , tau]) => Math.exp(-1 / (tau * sampleRate)));
  const levels = MEMBRANE.map(() => 1);
  const phases = MEMBRANE.map(() => 0);
  // Tension modulation: struck hard, the head stretches and sounds higher, then relaxes.
  const bend = Math.exp(-1 / (0.018 * sampleRate));
  let lift = 0.35;
  const rand = noise(strike.seed);
  const thud = svf(1000, 0.7, sampleRate);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const step = (f0 * (1 + lift)) / sampleRate;
    lift *= bend;
    let body = 0;
    for (let m = 0; m < MEMBRANE.length; m++) {
      phases[m] += MEMBRANE[m][0] * step;
      body += sine(phases[m]) * shares[m] * levels[m];
      levels[m] *= fades[m];
    }
    const touch = rise(t, press);
    // A little give in the head (soft saturation) lends the boom harmonics small speakers can play.
    out[i] =
      Math.tanh(1.5 * body * touch) + thud.run(rand()).band * 0.5 * touch * Math.exp(-t / 0.007);
  }
  edges(out, sampleRate, 0.0005, 0.06);
  settle(out, 18, sampleRate);
  // The ear hears a higher boom as louder: ease it down above C2 (below, it is as loud as it gets).
  normalize([out], Math.min(0.95, LEVEL.softkick * (f0 / hz(36)) ** -1.5));
  return { left: out };
}

/**
 * A brush tapped on a snare: wire bristles landing over a few milliseconds, the head's low
 * modes (tuned to the note's name between F3 and E4), and the snare wires' papery hiss.
 */
export function brush(strike: Strike, sampleRate: number): Rendered {
  const out = new Float32Array(frames(0.45, sampleRate));
  const head = hz(fold(strike.pitch, 53));
  mode(out, head, 0.07, 0.05, sampleRate, Math.PI / 2);
  mode(out, head * 1.594, 0.035, 0.03, sampleRate, Math.PI / 2);
  mode(out, head * 2.136, 0.02, 0.02, sampleRate, Math.PI / 2);
  const rand = noise(strike.seed),
    scatter = noise(reseed(strike.seed, 5));
  const wires = svf(2900, 0.75, sampleRate),
    soft = onePole(6500, sampleRate);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    // The bristles land one by one over the first few ms, thinning out.
    const landing = Math.exp(-t / 0.005);
    const bristle = (scatter() + 1) / 2 < 0.12 * landing ? rand() * 1.2 : 0;
    const hiss = rand() * rise(t, 0.003) * (Math.exp(-t / 0.022) + 0.22 * Math.exp(-t / 0.09));
    out[i] = out[i] * rise(t, 0.002) + soft(wires.run(hiss + bristle * landing).band);
  }
  edges(out, sampleRate, 0.0008, 0.05);
  settle(out, 30, sampleRate);
  normalize([out], LEVEL.brush);
  return { left: out };
}

/**
 * A brush swept round the head for as long as the note is held: friction noise that swells in,
 * presses a little harder through the middle of each circle (about one every 0.8 s), and fades.
 */
export function swish(strike: Strike, sampleRate: number): Rendered {
  const span = Math.max(0.06, strike.held);
  const out = new Float32Array(frames(span, sampleRate));
  const rand = noise(strike.seed),
    drift = noise(reseed(strike.seed, 11));
  const filter = svf(2000, 0.6, sampleRate),
    soft = onePole(5200, sampleRate),
    grain = onePole(28, sampleRate);
  const circles = Math.max(1, Math.round(span / 0.8));
  const tone = lean(strike.pitch);
  const swell = Math.min(0.3, 0.25 * span),
    fade = Math.min(0.35, 0.3 * span);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const shape = Math.min(rise(t, swell), rise(span - t, fade));
    const press = 0.5 - 0.5 * Math.cos(TAU * (t / span) * circles - Math.PI * 0.3);
    if (i % 16 === 0) filter.tune((1500 + 1300 * press) * tone);
    // The bristles catch and slip: a slow, uneven texture on the level.
    const texture = Math.max(0, 1 + 7 * grain(drift()));
    out[i] = soft(filter.run(rand()).band) * shape * (0.65 + 0.35 * press) * texture;
  }
  edges(out, sampleRate, 0.005, 0.02);
  normalize([out], LEVEL.swish);
  return { left: out };
}

/**
 * A cross-stick: the stick laid across the head and knocked on the rim. A woody "tok" from the
 * shell and head, the stick's own free-free modes, and a whisper of snare wires.
 */
export function rim(strike: Strike, sampleRate: number): Rendered {
  const out = new Float32Array(frames(0.16, sampleRate));
  const lift = lean(strike.pitch);
  const cos = Math.PI / 2;
  mode(out, 460 * lift, 0.8, 0.026, sampleRate, cos);
  mode(out, 460 * 1.594 * lift, 0.25, 0.016, sampleRate, cos);
  mode(out, 1620 * lift, 0.7, 0.01, sampleRate, cos);
  mode(out, 1620 * 2.756 * lift, 0.12, 0.0035, sampleRate, cos);
  const rand = noise(strike.seed);
  const knock = svf(2200 * lift, 0.9, sampleRate),
    wires = svf(3300, 0.9, sampleRate);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const n = rand();
    out[i] +=
      knock.run(n * Math.exp(-t / 0.0007)).band * 0.8 +
      wires.run(n * rise(t, 0.002) * Math.exp(-t / 0.028)).band * 0.05;
  }
  edges(out, sampleRate, 0.0004, 0.03);
  settle(out, 40, sampleRate);
  normalize([out], LEVEL.rim);
  return { left: out };
}

/**
 * A shaker stroke, after Cook's PhISEM: beads hit the shell at a rate that follows the energy of
 * the shake, and the shell rings each collision through its two resonances.
 */
export function shaker(strike: Strike, sampleRate: number): Rendered {
  const out = new Float32Array(frames(0.17, sampleRate));
  const rand = noise(strike.seed),
    chance = noise(reseed(strike.seed, 3));
  const lift = lean(strike.pitch);
  const shell = svf(3700 * lift, 1.5, sampleRate),
    upper = svf(6100 * lift, 1.3, sampleRate),
    soft = onePole(8000, sampleRate);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const energy = rise(t, 0.008) * Math.exp(-t / 0.038);
    const hit = (chance() + 1) / 2 < 0.15 * energy ? rand() * energy : 0;
    out[i] = soft(shell.run(hit).band + 0.6 * upper.run(hit).band);
  }
  edges(out, sampleRate, 0.001, 0.03);
  settle(out, 200, sampleRate);
  normalize([out], LEVEL.shaker);
  return { left: out };
}

// A ride cymbal's partials over its lowest (fixed: the same cymbal every hit), dense and
// inharmonic, from ~400 Hz to ~10 kHz.
const RIDE = (() => {
  const rand = noise(0x51de);
  const count = 40,
    span = Math.log2(26);
  return Array.from({ length: count }, (_, n) => 2 ** ((span * (n + 0.5 + 0.42 * rand())) / count));
})();
// A ride's ringing wash for each tuning: the same cymbal every hit, so it is rendered once and
// reused (each hit brings its own ping, hiss and level). Pure, so a tune still renders the same.
const WASHES = new Map<string, Float32Array>();
function wash(base: number, length: number, sampleRate: number) {
  const key = `${base}:${length}:${sampleRate}`;
  const known = WASHES.get(key);
  if (known) return known;
  const out = new Float32Array(length);
  const rand = noise(0x3a17);
  for (const ratio of RIDE) {
    const f = base * ratio;
    const octaves = Math.log2(f / 4000);
    const amp =
      (Math.exp(-(octaves * octaves) / (2 * 1.4 * 1.4)) / (1 + (f / 9500) ** 4)) *
      (0.8 + 0.4 * ((rand() + 1) / 2));
    const tau = 0.68 * (1000 / f) ** 0.3;
    // The metal's energy spreads upward: the higher partials bloom over a few ms.
    const bloom = 0.002 + 0.0015 * (f / 1000);
    const phase = TAU * rand();
    // Each runs until it is 60 dB down.
    const end = Math.min(length, Math.ceil(tau * Math.log(amp / 1e-3) * sampleRate));
    if (end <= 0) continue;
    mode(out.subarray(0, end), f, amp, tau, sampleRate, phase);
    mode(out, f, -amp, bloom, sampleRate, phase);
  }
  if (WASHES.size >= 12) WASHES.clear();
  WASHES.set(key, out);
  return out;
}

/**
 * A ride cymbal played softly with a stick tip: a short ping on the bow, then a warm wash of
 * dense metal partials that bloom upward over the first few ms and ring out over about two seconds.
 */
export function ride(strike: Strike, sampleRate: number): Rendered {
  const base = 400 * lean(strike.pitch);
  const rand = noise(strike.seed);
  const out = wash(base, frames(2.3, sampleRate), sampleRate).slice();
  const level = 0.85 + 0.3 * ((rand() + 1) / 2);
  for (let i = 0; i < out.length; i++) out[i] *= level;
  // The stick's ping: the bow's middle partials, struck directly, a little different every hit.
  for (let n = 0; n < RIDE.length; n += 2) {
    const f = base * RIDE[n];
    if (f < 1800 || f > 5200) continue;
    const octaves = Math.log2(f / 4000);
    const amp = Math.exp(-(octaves * octaves) / (2 * 1.4 * 1.4)) * (0.7 + 0.8 * ((rand() + 1) / 2));
    mode(out, f, amp, 0.07, sampleRate, Math.PI / 2);
  }
  // The countless high modes between the partials: a band of noise that blooms and rings with them.
  const hiss = svf(4800, 0.6, sampleRate),
    soft = onePole(8500, sampleRate);
  const fade = Math.exp(-1 / (0.45 * sampleRate));
  let ring = 9;
  for (let i = 0; i < out.length; i++) {
    out[i] += soft(hiss.run(rand()).band) * ring * rise(i / sampleRate, 0.012);
    ring *= fade;
  }
  edges(out, sampleRate, 0.0005, 0.3);
  settle(out, 60, sampleRate);
  normalize([out], LEVEL.ride);
  return { left: out };
}

/**
 * A woodblock, in tune at the written pitch (folded into G3–E7): one clear main mode over the
 * fast-dying partials of a wooden bar (1 : 2.756 : 5.404). Wood's damping makes low blocks ring
 * longer ("tock") and high ones shorter ("tick").
 */
export function tick(strike: Strike, sampleRate: number): Rendered {
  let pitch = strike.pitch;
  while (pitch < 55) pitch += 12;
  while (pitch > 100) pitch -= 12;
  const f = hz(pitch);
  const tau = 70 / (Math.PI * f);
  const out = new Float32Array(frames(Math.min(0.7, 7.5 * tau + 0.03), sampleRate));
  const cos = Math.PI / 2;
  mode(out, f, 1, tau, sampleRate, cos);
  mode(out, f * 2.756, 0.3, 50 / (Math.PI * f * 2.756), sampleRate, cos);
  mode(out, f * 5.404, 0.1, 36 / (Math.PI * f * 5.404), sampleRate, cos);
  const rand = noise(strike.seed);
  const click = svf(2600, 0.8, sampleRate);
  const span = Math.min(out.length, Math.round(0.006 * sampleRate));
  for (let i = 0; i < span; i++)
    out[i] += click.run(rand() * Math.exp(-i / (0.0005 * sampleRate))).band * 0.25;
  edges(out, sampleRate, 0.0004, Math.min(0.02, out.length / sampleRate / 4));
  settle(out, 30, sampleRate);
  // A higher block dies sooner: lift it a little to keep it as present.
  normalize([out], LEVEL.tick * 2 ** ((0.3 * (pitch - 72)) / 12));
  return { left: out };
}
