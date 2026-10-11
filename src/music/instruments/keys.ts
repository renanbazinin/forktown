// Keys: a felt-muted upright piano and a tine electric piano. Both are sums of decaying partials
// (modal and additive synthesis), so nothing aliases at 24 kHz, and each note is levelled to the
// same loudness as heard at a quiet listening level rather than to the same peak: a bass note and
// a treble note at one gain sit together, and so do the two instruments.
import {
  clamp,
  damp,
  edges,
  frames,
  hz,
  mode,
  noise,
  register,
  type Rendered,
  sine,
  type Strike,
  svf,
  TAU,
} from './dsp';

/** A note's ear-weighted RMS over its first `WINDOW` seconds at unit gain (per mono channel). */
const LEVEL = 0.28;
const WINDOW = 0.3;
/** The longest a note may ring, seconds (dsp's `frames` stops at 12). */
const LONGEST = 11.5;

/** The ear at a quiet listening level (about 50–60 phon), as a power weight: bass counts less. */
function heard(f: number) {
  const r = (f * f) / (f * f + 150 * 150);
  return r * r;
}

/** Mean power over the loudness window of a partial a₁e^(−t/τ₁) + a₂e^(−t/τ₂) (in phase). */
function power(a1: number, tau1: number, a2 = 0, tau2 = 1) {
  const part = (a: number, b: number, tau: number) => a * b * tau * (1 - Math.exp(-WINDOW / tau));
  return (
    (part(a1, a1, tau1 / 2) +
      part(a2, a2, tau2 / 2) +
      2 * part(a1, a2, 1 / (1 / tau1 + 1 / tau2))) /
    (2 * WINDOW)
  );
}

/** Where the note ends and its damper falls: at `held`, or early enough to fade before the end. */
function span(held: number, natural: number, release: number) {
  const fade = release * 7; // −60 dB
  let end = Math.min(natural, held + fade),
    from = held;
  if (end > LONGEST) {
    end = LONGEST;
    from = Math.min(from, LONGEST - fade);
  }
  return { end, from };
}

/** A decaying partial: frequency, amplitude, decay time constant τ, starting phase. */
type Partial = readonly [number, number, number, number];

/**
 * Adds decaying partials a·e^(−t/τ)·sin(2πft + φ) to `out` in one pass (each by recurrence, as
 * dsp's `mode`), each stopping once it has faded below `floor`: cheaper than one pass a partial
 * when a piano note has forty of them. Partials near the Nyquist are left out, not aliased.
 */
function bank(out: Float32Array, partials: Partial[], floor: number, sampleRate: number) {
  const live = partials
    .filter(([f, amp]) => f > 0 && f < sampleRate * 0.45 && amp > floor)
    .map(([f, amp, tau, phase]) => {
      const w = (TAU * f) / sampleRate,
        r = Math.exp(-1 / (tau * sampleRate));
      const stop = Math.min(out.length, Math.ceil(tau * Math.log(amp / floor) * sampleRate));
      return {
        c: 2 * r * Math.cos(w),
        r2: r * r,
        now: amp * Math.sin(phase),
        before: (amp * Math.sin(phase - w)) / r,
        stop,
      };
    })
    .sort((a, b) => b.stop - a.stop);
  const count = live.length;
  const c = Float64Array.from(live, (p) => p.c),
    r2 = Float64Array.from(live, (p) => p.r2),
    now = Float64Array.from(live, (p) => p.now),
    before = Float64Array.from(live, (p) => p.before),
    stop = Int32Array.from(live, (p) => p.stop);
  let active = count;
  for (let i = 0; i < out.length && active > 0; i++) {
    while (active > 0 && stop[active - 1] <= i) active--;
    let sum = 0;
    for (let k = 0; k < active; k++) {
      const y = now[k];
      sum += y;
      now[k] = c[k] * y - r2[k] * before[k];
      before[k] = y;
    }
    out[i] += sum;
  }
}

/**
 * Scales a note to `target` from its measured loudness, never letting a peak pass 0.95; a note
 * with nothing pitched left (above the Nyquist) is silenced.
 */
function level(channels: Float32Array[], loudness: number, target: number) {
  if (loudness < 1e-12) {
    for (const channel of channels) channel.fill(0);
    return;
  }
  let top = 0;
  for (const channel of channels)
    for (let i = 0; i < channel.length; i++) top = Math.max(top, Math.abs(channel[i]));
  if (top < 1e-9) return;
  const scale = Math.min(target / loudness, 0.95 / top);
  for (const channel of channels) for (let i = 0; i < channel.length; i++) channel[i] *= scale;
}

/**
 * A felt-muted upright piano, partial by partial after the struck string: the hammer meets the
 * string an eighth of the way along (so partials near the 8th and 16th are weak), its felt is a
 * soft low-pass that opens up the keyboard, the soundboard radiates the deepest fundamentals
 * weakly, and stiffness stretches partial n to n·f·√(1 + B·n²) (tuned back so the note's pitch is
 * true). Two strings a note give the two-stage decay: their in-phase motion fades fast (the
 * prompt sound) while a slight mistuning lets a quieter aftersound sing on; higher partials die
 * sooner, so the tone mellows as it rings. A soft thump of hammer and key at the start, a felt
 * damper when the key is let go; from F6 up there are no dampers and the strings ring free.
 */
export function felt(strike: Strike, sampleRate: number): Rendered {
  const f = hz(strike.pitch);
  const octave = register(strike.pitch);
  const stiffness = 0.00028 * 2 ** (0.9 * octave) + 0.00008 * 2 ** (-0.5 * (octave + 2));
  const corner = 140 + (0.75 * f) / (1 + f / 2500);
  // The fundamental's prompt decay rate (1/τ); each partial loses more the higher it is.
  const loss = 1 / clamp((261.6 / f) ** 0.6, 0.2, 3);
  const partials: { n: number; stretch: number; amp: number; tau: number }[] = [];
  let strongest = 0;
  for (let n = 1; n <= 32; n++) {
    const stretch = Math.sqrt(1 + stiffness * n * n);
    const fn = n * f * stretch;
    if (fn > sampleRate * 0.44) break;
    const amp =
      (Math.abs(Math.sin(Math.PI * n * 0.118)) * (1 + (fn / corner) ** 2) ** -1.5 * fn) /
      Math.hypot(fn, 120);
    strongest = Math.max(strongest, amp);
    if (amp > strongest * 0.003)
      partials.push({ n, stretch, amp, tau: 1 / (loss + 6e-7 * fn * fn) });
  }
  // Above the top of the keyboard nothing is left below the Nyquist: a silent note.
  if (!partials.length) return { left: new Float32Array(frames(0.01, sampleRate)) };
  // The pitch heard is a weighted mean of the stretched partials: tune it back to the note.
  let num = 0,
    den = 0,
    loudness = 0;
  for (const { n, stretch, amp, tau } of partials) {
    const w = power(amp, tau) * n * n;
    num += w * stretch * stretch;
    den += w * stretch;
    loudness += heard(n * f * stretch) * power(amp * 0.75, tau, amp * 0.25, tau * 3);
  }
  const fundamental = (f * den) / num;
  const scale = LEVEL / Math.sqrt(loudness);
  const rand = noise(strike.seed);
  // Cents between the two strings, a little different on every note.
  const drift = 0.8 + 0.3 * rand();
  const damper = strike.pitch < 89 ? clamp(0.085 - 0.02 * octave, 0.055, 0.13) : 0;
  const natural = partials[0].tau * 3 * 5.2; // the aftersound down by 57 dB
  const { end, from } = damper ? span(strike.held, natural, damper) : span(LONGEST, natural, 0.1);
  const out = new Float32Array(frames(end, sampleRate));
  const strings: Partial[] = [];
  for (const { n, stretch, amp, tau } of partials) {
    const fn = n * fundamental * stretch;
    const phase = (Math.PI * n * n) / 7; // spread so the partials don't pile into one peak
    if (n <= 12) {
      strings.push([fn * 2 ** ((-0.25 * drift) / 1200), amp * 0.75 * scale, tau, phase]);
      strings.push([fn * 2 ** ((0.75 * drift) / 1200), amp * 0.25 * scale, tau * 3, phase]);
    } else strings.push([fn, amp * scale, tau * 1.2, phase]);
  }
  bank(out, strings, strongest * scale * 1e-4, sampleRate);
  // The felt meets the string over a few milliseconds: longer in the bass.
  edges(out, sampleRate, clamp(0.005 - 0.0012 * octave, 0.0025, 0.008));
  // Hammer and key: a short knock of band-passed noise and the soundboard's lowest modes,
  // the same on every key.
  const knock = svf(420 + 0.15 * f, 0.8, sampleRate);
  const thump = Math.min(out.length, Math.round(0.04 * sampleRate));
  for (let i = 0; i < thump; i++) {
    const t = i / sampleRate;
    out[i] +=
      knock.run(rand()).band * (1 - Math.exp(-t / 0.0007)) * Math.exp(-t / 0.009) * 2 * LEVEL;
  }
  const board = new Float32Array(thump);
  bank(
    board,
    [
      [98, 0.175 * LEVEL, 0.045, 0],
      [171, 0.13 * LEVEL, 0.03, 0],
      [283, 0.09 * LEVEL, 0.02, 0],
    ],
    1e-6,
    sampleRate,
  );
  for (let i = 0; i < thump; i++) out[i] += board[i] * (1 - Math.exp(-i / (0.0015 * sampleRate)));
  if (damper) damp(out, sampleRate, from, damper);
  edges(out, sampleRate, 0.0005);
  level([out], LEVEL, LEVEL); // already at LEVEL: this only keeps the peak under 0.95
  return { left: out };
}

/**
 * A tine electric piano, after the Rhodes. The tine rings a near-pure tone; the pickup's lopsided
 * field turns it into harmonics that grow as powers of the tine's swing (the k-th as Aᵏ), so the
 * bark of the attack mellows into a round sine as the note fades or is damped, and low keys growl
 * more than high ones. A quick bright overtone on the 7th harmonic (as the classic FM tine) adds
 * the bell at the attack, the hammer a tiny tick; a suitcase tremolo sways it across the stereo
 * field.
 */
export function epiano(strike: Strike, sampleRate: number): Rendered {
  const f = hz(strike.pitch);
  const octave = register(strike.pitch);
  const tau = clamp(1.6 * 2 ** (-octave * 0.8), 0.35, 4.5);
  const slow = tau * 3.2;
  const release = 0.09;
  const { end, from } = span(strike.held, slow * 5, release); // down by 57 dB
  const count = frames(end, sampleRate);
  // The pickup: harmonic k at weight·driveᵏ⁻¹·Aᵏ, fading out before it nears the Nyquist.
  const drive = clamp(0.34 * 2 ** (-0.6 * octave), 0.08, 0.72);
  const harmonics = [1, 1, 0.75, 0.45, 0.25].map(
    (weight, k) =>
      weight *
      drive ** k *
      clamp((10500 - (k + 1) * f) / 2500, 0, 1) *
      // The suitcase speaker gives the lowest fundamentals a little less.
      (k === 0 ? f / Math.hypot(f, 70) : 1),
  );
  const bellHz = f * 7;
  // Softer as it climbs past 6 kHz, so the top octaves chime rather than glint.
  const bell = clamp(0.1 + 0.04 * octave, 0.04, 0.16) * clamp((9000 - bellHz) / 3000, 0, 1);
  const bellTau = clamp(0.15 * 2 ** (-0.6 * octave), 0.03, 0.45);
  const extra = new Float32Array(count);
  mode(extra, bellHz, bell, bellTau, sampleRate);
  const rand = noise(strike.seed);
  const tick = svf(clamp(4 * f, 2000, 5000), 1, sampleRate);
  for (let i = 0; i < Math.min(count, Math.round(0.01 * sampleRate)); i++)
    extra[i] += tick.run(rand()).band * Math.exp(-i / (0.0012 * sampleRate)) * 0.9;
  // Loudness, from the swing's envelope: harmonic k's power follows A²ᵏ.
  let loudness = heard(bellHz) * power(bell, bellTau);
  const steps = 60;
  harmonics.forEach((h, k) => {
    let mean = 0;
    for (let s = 0; s < steps; s++) {
      const t = ((s + 0.5) / steps) * WINDOW;
      mean += (0.78 * Math.exp(-t / tau) + 0.22 * Math.exp(-t / slow)) ** (2 * k + 2);
    }
    loudness += (heard((k + 1) * f) * h * h * mean) / steps / 2;
  });
  const left = new Float32Array(count),
    right = new Float32Array(count);
  const step = f / sampleRate;
  const fastRate = Math.exp(-1 / (tau * sampleRate)),
    slowRate = Math.exp(-1 / (slow * sampleRate)),
    releaseRate = Math.exp(-1 / (release * sampleRate));
  const releaseFrom = Math.round(from * sampleRate);
  const [h1, h2, h3, h4, h5] = harmonics;
  let fast = 0.78,
    lasting = 0.22,
    damper = 1;
  for (let i = 0; i < count; i++) {
    if (i >= releaseFrom) damper *= releaseRate;
    const a = (fast + lasting) * damper;
    fast *= fastRate;
    lasting *= slowRate;
    const phase = step * i;
    const a2 = a * a;
    const value =
      h1 * a * sine(phase + 0.25) +
      h2 * a2 * sine(2 * phase + 0.1) +
      h3 * a2 * a * sine(3 * phase + 0.3) +
      (h4 || h5 ? a2 * a2 * (h4 * sine(4 * phase + 0.6) + h5 * a * sine(5 * phase + 0.9)) : 0) +
      extra[i] * damper;
    // A suitcase-style tremolo, in step with the loop's clock across every note.
    const swing = 0.2 * sine((strike.at + i / sampleRate) * 4.4);
    left[i] = value * (1 + swing);
    right[i] = value * (1 - swing);
  }
  edges(left, sampleRate, 0.0015);
  edges(right, sampleRate, 0.0015);
  // Balanced, not panned: both sides play at full level, so each carries half the power.
  level([left, right], Math.sqrt(loudness), LEVEL * Math.SQRT1_2);
  return { left, right };
}
