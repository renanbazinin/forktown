// Ambience: a record's surface, crickets and garden birds, to sit very quietly under a tune.
// Each plays for as long as its note is held, and notes written back to back join without a
// seam: vinyl and crickets ring on a moment past `held` and cross-fade into the next note, and
// the crickets and birds keep one timeline in loop time (Strike.at), so the same insects and the
// same blackbird carry on from note to note. All three are stereo, at an even loudness a gain.
import { clamp, hz, noise, type Rendered, reseed, sine, type Strike, TAU } from './dsp';

/** The longest note, in seconds (eight bars at 62 bpm), so a bed needs only a few notes. */
const LONGEST = 32;
/** Uniform 0..1 from a noise stream. */
const unit = (rand: () => number) => 0.5 + 0.5 * rand();
/** Seconds to the next event of a steady random process (`rate` a second). */
const wait = (rand: () => number, rate: number) => -Math.log(1 - unit(rand)) / rate;
/** The pitch moved by whole octaves into the twelve semitones from `low`. */
const fold = (pitch: number, low: number) => low + ((((Math.round(pitch) - low) % 12) + 12) % 12);

/**
 * A source placed across the stereo field by level alone (equal power, centre at full level):
 * no delay between the ears, which would comb-filter these near-pure tones in mono.
 */
type Place = { left: number; right: number };
function place(pan: number, level: number): Place {
  const angle = ((pan + 1) * Math.PI) / 4;
  return {
    left: Math.cos(angle) * Math.SQRT2 * level,
    right: Math.sin(angle) * Math.SQRT2 * level,
  };
}
/** Adds one sample of a placed source at frame `i`, if it falls in the buffers. */
function put(left: Float32Array, right: Float32Array, i: number, value: number, at: Place) {
  if (i < 0 || i >= left.length) return;
  left[i] += value * at.left;
  right[i] += value * at.right;
}

// ---------------------------------------------------------------------------------------------
// Vinyl

/** Seconds the record's noise rings on past `held`, fading into the next note's. */
const VINYL_FADE = 0.4;
/** Unit-gain level, matched to the crickets and birds. */
const VINYL_LEVEL = 2.2;
// Each layer's level: the fry of dust, ticks, pops and hiss.
const FRY = 2.5,
  TICKS = 1,
  POPS = 1,
  HISS = 0.012;

/**
 * A record's surface for as long as the note is held: a fine fry of dust, ticks (now and then in
 * a little cluster), the odd soft pop of a deeper scratch, and a dark hiss that swells a touch
 * once a turn. Stereo, as a record's noise is: partly different on each side. Pitch 60 is a
 * well-kept record; down to 48 it is older and duller, up to 72 brighter.
 */
export function vinyl(strike: Strike, sampleRate: number): Rendered {
  const held = clamp(strike.held, 0.05, LONGEST);
  const fade = Math.min(VINYL_FADE, held / 2);
  const span = held + fade;
  const count = Math.ceil(span * sampleRate);
  const left = new Float32Array(count),
    right = new Float32Array(count);
  const tone = clamp(2 ** ((strike.pitch - 60) / 24), 0.7, 1.4);
  const rand = noise(reseed(strike.seed, 7));

  // One click: a damped sine from rest, either way up, so its spectrum is a soft hump round
  // `frequency` and it leaves no offset behind.
  const click = (time: number, amp: number, frequency: number, tau: number, pan: number) => {
    const from = Math.round(time * sampleRate);
    const length = Math.ceil(tau * 7 * sampleRate);
    const w = (TAU * frequency) / sampleRate,
      r = Math.exp(-1 / (tau * sampleRate));
    const angle = ((clamp(pan, -0.9, 0.9) + 1) * Math.PI) / 4;
    const sign = rand() < 0 ? -Math.SQRT2 : Math.SQRT2;
    const l = sign * amp * Math.cos(angle),
      rr = sign * amp * Math.sin(angle);
    let level = 1;
    for (let i = 1; i < length && from + i < count; i++) {
      level *= r;
      const value = level * Math.sin(w * i);
      left[from + i] += value * l;
      right[from + i] += value * rr;
    }
  };
  // The fry: a hundred-odd faint specks of dust a second.
  for (let t = wait(rand, 110); t < span; t += wait(rand, 110))
    click(
      t,
      FRY * (0.01 + 0.03 * unit(rand) ** 2),
      2700 * tone * 2 ** (0.7 * rand()),
      0.00009,
      rand(),
    );
  // Ticks, four or five a second, now and then a bigger one; some crackle on once or twice.
  for (let t = wait(rand, 4.5); t < span; t += wait(rand, 4.5)) {
    let size = TICKS * (0.05 + 0.3 * unit(rand) ** 5);
    const frequency = 1900 * tone * 2 ** (0.6 * rand()),
      pan = 0.6 * rand();
    click(t, size, frequency, 0.00016 + 0.00014 * unit(rand), pan);
    for (let echo = t; unit(rand) < 0.3;) {
      echo += 0.004 + 0.02 * unit(rand);
      size *= 0.35 + 0.35 * unit(rand);
      click(echo, size, frequency * 2 ** (0.3 * rand()), 0.00016, pan + 0.2 * rand());
    }
  }
  // Pops: a soft, low thump with a little tick on top, every few seconds.
  for (let t = wait(rand, 0.22); t < span; t += wait(rand, 0.22)) {
    const size = POPS * (0.18 + 0.18 * unit(rand)),
      pan = 0.5 * rand();
    click(t, size, 520 * tone * 2 ** (0.5 * rand()), 0.0011, pan);
    click(t, size * 0.3, 2400 * tone, 0.00015, pan);
  }

  // The hiss: half shared, half each side's own; pinkish from 260 Hz, rolled off above 1.8 kHz
  // and again (12 dB an octave, a state-variable low-pass) above 5 kHz, so it is a soft "ffff",
  // never a "ssss". The crackle is rounded off above 6.5 kHz and kept clear of the bass below
  // 180 Hz. All inlined, as it runs every sample: the three noise streams are dsp.ts's noise()
  // from the note's seed, written out.
  let common = strike.seed >>> 0 || 1,
    ownLeft = reseed(strike.seed, 3) || 1,
    ownRight = reseed(strike.seed, 5) || 1;
  const pole = (cutoff: number) => 1 - Math.exp((-TAU * cutoff) / sampleRate);
  const tilt = pole(1800 * tone),
    floor = pole(260),
    round = pole(6500 * tone),
    clear = pole(180);
  const g = Math.tan((Math.PI * 5000 * tone) / sampleRate),
    k = 1 / 0.6;
  const a1 = 1 / (1 + g * (g + k)),
    a2 = g * a1,
    a3 = g * a2;
  let tiltLeft = 0,
    tiltRight = 0,
    floorLeft = 0,
    floorRight = 0,
    roundLeft = 0,
    roundRight = 0,
    clearLeft = 0,
    clearRight = 0,
    bandLeft = 0,
    lowLeft = 0,
    bandRight = 0,
    lowRight = 0,
    hiss = 0;
  const fadeFrames = fade * sampleRate,
    heldFrames = held * sampleRate;
  for (let i = 0; i < count; i++) {
    // Once a turn at 33⅓, the hiss swells a little, in step with the loop.
    if (i % 64 === 0) hiss = HISS * (1 + 0.1 * sine((strike.at + i / sampleRate) / 1.8));
    common = (Math.imul(common, 1664525) + 1013904223) >>> 0;
    ownLeft = (Math.imul(ownLeft, 1664525) + 1013904223) >>> 0;
    ownRight = (Math.imul(ownRight, 1664525) + 1013904223) >>> 0;
    const c = common / 2147483648 - 1;
    tiltLeft += tilt * (c + ownLeft / 2147483648 - 1 - tiltLeft);
    tiltRight += tilt * (c + ownRight / 2147483648 - 1 - tiltRight);
    floorLeft += floor * (tiltLeft - floorLeft);
    floorRight += floor * (tiltRight - floorRight);
    let v3 = tiltLeft - floorLeft - lowLeft;
    let v1 = a1 * bandLeft + a2 * v3;
    let v2 = lowLeft + a2 * bandLeft + a3 * v3;
    bandLeft = 2 * v1 - bandLeft;
    lowLeft = 2 * v2 - lowLeft;
    const hissLeft = v2;
    v3 = tiltRight - floorRight - lowRight;
    v1 = a1 * bandRight + a2 * v3;
    v2 = lowRight + a2 * bandRight + a3 * v3;
    bandRight = 2 * v1 - bandRight;
    lowRight = 2 * v2 - lowRight;
    roundLeft += round * (left[i] - roundLeft);
    roundRight += round * (right[i] - roundRight);
    clearLeft += clear * (roundLeft - clearLeft);
    clearRight += clear * (roundRight - clearRight);
    // Equal-power fades, so a note cross-fades evenly into the next one's (independent) noise.
    let gain = VINYL_LEVEL;
    if (i < fadeFrames) gain *= Math.sin((Math.PI / 2) * (i / fadeFrames));
    if (i > heldFrames)
      gain *= Math.cos((Math.PI / 2) * Math.min(1, (i - heldFrames) / fadeFrames));
    left[i] = (roundLeft - clearLeft + hissLeft * hiss) * gain;
    right[i] = (roundRight - clearRight + v2 * hiss) * gain;
  }
  limit([left, right], 0.95);
  return { left, right };
}

/** Scales a note down only if its loudest sample passes `peak` (a guard, not a normalizer). */
function limit(channels: Float32Array[], peak: number) {
  let top = 0;
  for (const channel of channels)
    for (let i = 0; i < channel.length; i++) top = Math.max(top, Math.abs(channel[i]));
  if (top <= peak) return;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) channel[i] *= peak / top;
}

// ---------------------------------------------------------------------------------------------
// Crickets

/** Seconds the crickets ring on past `held`, fading into the next note's (the same insects). */
const CRICKET_FADE = 0.5;
/** Unit-gain level, matched to the vinyl and birds. */
const CRICKET_LEVEL = 0.064;

type Insect = {
  /** The lowest MIDI pitch of the octave the insect sings in. */
  low: number;
  /** Semitones above the note it sings (folded into its octave). */
  interval: number;
  detune: number;
  /** Seconds from one chirp to the next. */
  period: number;
  pulses: number;
  /** Seconds a pulse sounds, and from one pulse's start to the next. */
  pulse: number;
  spacing: number;
  level: number;
  pan: number;
  /** Share of runs of chirps it sits out. */
  rests: number;
  salt: number;
};
const INSECTS: readonly Insect[] = [
  // A field cricket close by on the left: chirps of three pulses (now and then four).
  {
    low: 97,
    interval: 0,
    detune: 1,
    period: 0.66,
    pulses: 3,
    pulse: 0.017,
    spacing: 0.036,
    level: 1,
    pan: -0.6,
    rests: 0.12,
    salt: 101,
  },
  // A tree cricket further off on the right, on the fifth: quick, soft chirps of six pulses.
  {
    low: 94,
    interval: 7,
    detune: 1,
    period: 0.53,
    pulses: 6,
    pulse: 0.0095,
    spacing: 0.0195,
    level: 0.4,
    pan: 0.55,
    rests: 0.2,
    salt: 202,
  },
  // Another field cricket, far off near the middle, a hair apart from the first.
  {
    low: 97,
    interval: 0,
    detune: 2 ** (2 / 1200),
    period: 0.81,
    pulses: 3,
    pulse: 0.016,
    spacing: 0.035,
    level: 0.22,
    pan: 0.15,
    rests: 0.25,
    salt: 303,
  },
];

/**
 * Crickets for as long as the note is held: a field cricket near on the left, a tree cricket
 * further off on the right and another field cricket far away. They sing the note's pitch class
 * (and the tree cricket its fifth) high up, at 2.2–4.4 kHz, so they are in key with the tune.
 */
export function crickets(strike: Strike, sampleRate: number): Rendered {
  const held = clamp(strike.held, 0.05, LONGEST);
  const fade = Math.min(CRICKET_FADE, held / 2);
  const count = Math.ceil((held + fade) * sampleRate);
  const left = new Float32Array(count),
    right = new Float32Array(count);
  // The note's first frame in loop time: every chirp is placed, and its phase set, in loop time.
  const first = Math.round(strike.at * sampleRate);
  const t0 = first / sampleRate,
    t1 = (first + count) / sampleRate;
  for (const insect of INSECTS) {
    const sung = fold(strike.pitch + insect.interval, insect.low);
    const frequency = hz(sung) * insect.detune;
    const at = place(insect.pan, insect.level * CRICKET_LEVEL);
    const salt = insect.salt + 977 * sung;
    const length = Math.round(insect.pulse * sampleRate);
    for (let k = Math.floor(t0 / insect.period) - 1; k * insect.period < t1; k++) {
      // Runs of eleven chirps; now and then one is sat out.
      if (unit(noise(reseed(salt + 1, Math.floor(k / 11)))) < insect.rests) continue;
      const rand = noise(reseed(salt, k));
      const start = (k + 0.04 * rand()) * insect.period;
      const loud = 0.85 + 0.15 * unit(rand);
      const pulses = insect.pulses + (unit(rand) < 0.25 ? 1 : 0);
      for (let p = 0; p < pulses; p++) {
        const onset = Math.round((start + p * insect.spacing) * sampleRate);
        const from = onset - first;
        if (from + length + 32 < 0 || from >= count) continue;
        // The first pulse a little softer, the last falling away.
        const amp = loud * (p === 0 ? 0.8 : p === pulses - 1 ? 0.88 : 1);
        let phase = (frequency * onset) / sampleRate;
        for (let j = 0; j < length; j++) {
          const u = j / length;
          // A quick rise, a slower fall, and a slight droop in pitch through the pulse, true
          // to the note where it is loudest.
          phase += (frequency * (1 + 0.006 * (0.35 - u))) / sampleRate;
          const envelope = Math.sin(Math.PI * u ** 0.65) ** 2;
          put(left, right, from + j, sine(phase) * envelope * amp, at);
        }
      }
    }
  }
  // Raised-cosine fades that sum to one, as the next note carries on with the same chirps.
  const fadeFrames = fade * sampleRate,
    heldFrames = held * sampleRate;
  for (let i = 0; i < count; i++) {
    const gain =
      (i < fadeFrames ? Math.sin((Math.PI / 2) * (i / fadeFrames)) ** 2 : 1) *
      (i > heldFrames
        ? Math.cos((Math.PI / 2) * Math.min(1, (i - heldFrames) / fadeFrames)) ** 2
        : 1);
    left[i] *= gain;
    right[i] *= gain;
  }
  limit([left, right], 0.95);
  return { left, right };
}

// ---------------------------------------------------------------------------------------------
// Birds

/** Unit-gain level, matched to the vinyl and crickets. */
const BIRD_LEVEL = 0.034;

/** One whistled note: its pitch contour (MIDI), length and loudness. */
type Part = {
  /** Seconds from the phrase's start. */
  at: number;
  length: number;
  /** A glide from `from` to `to`, an arch over the top, an onset bend and a fall at the end. */
  from: number;
  to: number;
  arch: number;
  bend: number;
  droop: number;
  /** A fast flutter, in semitones. */
  flutter: number;
  amp: number;
};
type Phrase = { start: number; end: number; parts: Part[]; harmonics: number };
type Bird = {
  /** Seconds from one possible phrase to the next, the latest a phrase starts after its slot. */
  period: number;
  spread: number;
  /** Share of slots it stays quiet. */
  quiet: number;
  pan: number;
  level: number;
  harmonics: number;
  salt: number;
  sing: (rand: () => number, home: number) => Part[];
};

const part = (at: number, length: number, from: number, to = from, more: Partial<Part> = {}) => ({
  at,
  length,
  from,
  to,
  arch: 0,
  bend: 0,
  droop: 0,
  flutter: 0,
  amp: 1,
  ...more,
});

// The blackbird's notes, in semitones about the home note: a major pentatonic.
const DEGREES = [-3, 0, 2, 4, 7, 9];

/** A blackbird's song: three to six low, fluting whistles, and often a soft twitter after. */
function blackbird(rand: () => number, home: number): Part[] {
  const parts: Part[] = [];
  let t = 0,
    degree = 1 + Math.floor(unit(rand) * 3);
  const notes = 3 + Math.floor(unit(rand) * 4);
  for (let n = 0; n < notes; n++) {
    degree = clamp(degree + [-2, -1, 1, 2][Math.floor(unit(rand) * 4)], 0, DEGREES.length - 1);
    const target = home + DEGREES[degree];
    const kind = unit(rand);
    let note: Part;
    if (kind < 0.45)
      // A held whistle, bent in from a little below or above, falling off at the end.
      note = part(t, 0.12 + 0.14 * unit(rand), target, target, {
        bend: rand() < 0 ? -1.6 : 1.2,
        droop: -0.6,
        flutter: 0.12 * unit(rand),
      });
    else if (kind < 0.65)
      note = part(t, 0.09 + 0.09 * unit(rand), target - 3 - 2 * unit(rand), target);
    else if (kind < 0.85)
      note = part(t, 0.09 + 0.09 * unit(rand), Math.min(105, target + 3 + 2 * unit(rand)), target);
    else note = part(t, 0.1 + 0.06 * unit(rand), target - 1, target - 2, { arch: 4 });
    note.amp = 0.85 + 0.15 * unit(rand);
    parts.push(note);
    t += note.length + 0.035 + 0.06 * unit(rand);
  }
  if (unit(rand) < 0.55) {
    // The twitter: quick, quiet sweeps down from up high.
    t += 0.04;
    const top = 98 + 8 * unit(rand);
    for (let n = 3 + Math.floor(unit(rand) * 4); n > 0; n--) {
      const length = 0.028 + 0.017 * unit(rand);
      const high = top + 1.5 * rand();
      parts.push(part(t, length, high, high - 6 - 3 * unit(rand), { arch: 1.2, amp: 0.34 }));
      t += length + 0.02 + 0.015 * unit(rand);
    }
  }
  return parts;
}

/** A tit's see-saw call far off: two notes, high then lower, three to five times. */
function tit(rand: () => number, home: number): Part[] {
  const [high, low] = [
    [7, 4],
    [9, 4],
    [12, 7],
  ][Math.floor(unit(rand) * 3)];
  const shift = fold(home + high, 95) - (home + high);
  const pairs = 3 + Math.floor(unit(rand) * 3),
    every = 0.23 + 0.04 * unit(rand);
  const parts: Part[] = [];
  for (let p = 0; p < pairs; p++) {
    const amp = p === 0 ? 0.8 : p === pairs - 1 ? 0.85 : 1;
    parts.push(part(p * every, 0.085, home + high + shift + 0.7, home + high + shift, { amp }));
    parts.push(part(p * every + 0.11, 0.07, home + low + shift - 0.4, home + low + shift, { amp }));
  }
  return parts;
}

const BIRDS: readonly Bird[] = [
  // The blackbird, close by on the left, singing every five seconds or so.
  {
    period: 4.8,
    spread: 0.9,
    quiet: 0.22,
    pan: -0.35,
    level: 1,
    harmonics: 1,
    salt: 401,
    sing: blackbird,
  },
  // A tit further off on the right, now and then.
  {
    period: 7.3,
    spread: 3,
    quiet: 0.5,
    pan: 0.55,
    level: 0.36,
    harmonics: 0.4,
    salt: 509,
    sing: tit,
  },
];

/** The phrase a bird sings in slot `k` of its timeline (seconds in loop time), if any. */
function phrase(bird: Bird, k: number, home: number, start?: number): Phrase | undefined {
  const rand = noise(reseed(bird.salt + 1009 * home, k));
  if (start === undefined && unit(rand) < bird.quiet) return undefined;
  const begin = start ?? k * bird.period + bird.spread * unit(rand);
  const loud = 0.8 + 0.2 * unit(rand);
  const parts = bird.sing(rand, home).map((p) => ({ ...p, amp: p.amp * loud }));
  const last = parts[parts.length - 1];
  return { start: begin, end: begin + last.at + last.length, parts, harmonics: bird.harmonics };
}

/** Sings one whistled note into the buffers from frame `from`. */
function whistle(
  left: Float32Array,
  right: Float32Array,
  from: number,
  note: Part,
  harmonics: number,
  at: Place,
  sampleRate: number,
) {
  const length = Math.round(note.length * sampleRate);
  const attack = Math.min(0.012, note.length * 0.3) * sampleRate,
    release = Math.min(0.022, note.length * 0.4) * sampleRate;
  const rate = 26 + 10 * ((note.from * 7) % 1);
  let phase = 0;
  for (let j = 0; j < length; j++) {
    const t = j / sampleRate,
      u = j / length;
    const pitch =
      note.from +
      (note.to - note.from) * (0.5 - 0.5 * Math.cos(Math.PI * u)) +
      note.arch * Math.sin(Math.PI * u) +
      note.bend * Math.exp(-t / 0.014) +
      note.droop * Math.max(0, (u - 0.75) * 4) ** 2 +
      note.flutter * sine(rate * t);
    const f = 440 * 2 ** ((pitch - 69) / 12);
    phase += f / sampleRate;
    const envelope =
      (j < attack ? Math.sin((Math.PI / 2) * (j / attack)) ** 2 : 1) *
      (j > length - release
        ? Math.cos((Math.PI / 2) * ((j - length + release) / release)) ** 2
        : 1) *
      (0.85 + 0.15 * Math.sin(Math.PI * u));
    // A blackbird's whistle carries a little of its octave and twelfth, kept clear of the top.
    const second = 0.12 * harmonics * clamp((9000 - 2 * f) / 1500, 0, 1),
      third = 0.035 * harmonics * clamp((9000 - 3 * f) / 1500, 0, 1);
    const value = sine(phase) + second * sine(2 * phase + 0.2) + third * sine(3 * phase + 0.5);
    put(left, right, from + j, value * envelope * note.amp, at);
  }
}

/**
 * Garden birds for as long as the note is held: a blackbird close by on the left, fluting short
 * phrases on the major pentatonic of the note's pitch (high up, round 1–3.5 kHz), with a soft
 * twitter after some, and a tit's see-saw call further off on the right. Each phrase starts
 * while the note is held and is sung to its end. For a minor key, give the relative major.
 */
export function birds(strike: Strike, sampleRate: number): Rendered {
  const held = clamp(strike.held, 0.05, LONGEST);
  const home = fold(strike.pitch, 86);
  const t0 = Math.round(strike.at * sampleRate) / sampleRate,
    t1 = t0 + held;
  const sung: { bird: Bird; phrase: Phrase }[] = [];
  for (const bird of BIRDS) {
    let before: Phrase | undefined;
    for (let k = Math.floor(t0 / bird.period) - 1; k * bird.period < t1; k++) {
      const next = phrase(bird, k, home);
      if (!next) continue;
      if (next.start < t0) before = next;
      else if (next.start < t1) sung.push({ bird, phrase: next });
    }
    // A short note that falls in a pause still gets a phrase from the blackbird, cut to end
    // within the note, so the next short note's phrase never sings over it.
    if (bird === BIRDS[0] && held < bird.period && !sung.some((s) => s.bird === bird)) {
      const start = Math.max(t0 + 0.12, (before?.end ?? 0) + 0.4);
      const extra = phrase(bird, -1 - Math.round(t0 * 10), home, start);
      if (extra && start < t1) {
        const parts = extra.parts.filter((p, n) => n === 0 || start + p.at + p.length <= t1);
        const last = parts[parts.length - 1];
        sung.push({ bird, phrase: { ...extra, parts, end: start + last.at + last.length } });
      }
    }
  }
  const end = sung.reduce((latest, s) => Math.max(latest, s.phrase.end - t0), 0);
  const count = Math.max(1, Math.ceil((end + 0.01) * sampleRate) + 16);
  const left = new Float32Array(count),
    right = new Float32Array(count);
  for (const { bird, phrase: song } of sung) {
    const at = place(bird.pan, bird.level * BIRD_LEVEL);
    for (const note of song.parts) {
      const from = Math.round((song.start - t0 + note.at) * sampleRate);
      whistle(left, right, from, note, song.harmonics, at, sampleRate);
    }
  }
  limit([left, right], 0.95);
  return { left, right };
}
