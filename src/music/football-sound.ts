import type { FootballSound, FootballState } from '../lib/football';

type Kind = FootballSound['kind'];
export const FOOTBALL_SOUND_KINDS: readonly Kind[] = [
  'kick',
  'whistle',
  'final-whistle',
  'cheer',
  'ooh',
  'applause',
  'post',
];
/** Takes rendered per effect; the player rotates through them so repeats never sound stamped. */
export const FOOTBALL_SOUND_TAKES: Readonly<Record<Kind, number>> = {
  kick: 4,
  whistle: 2,
  'final-whistle': 1,
  cheer: 2,
  ooh: 2,
  applause: 2,
  post: 2,
};
const DURATION: Record<Kind, number> = {
  kick: 0.26,
  whistle: 0.4,
  'final-whistle': 1.55,
  cheer: 2.2,
  ooh: 1.35,
  applause: 1.9,
  post: 0.7,
};
/** Loudest 50 ms RMS at strength 1, balanced so every cue sits on one scale. */
const LEVEL: Record<Kind, number> = {
  kick: 0.3,
  whistle: 0.116,
  'final-whistle': 0.116,
  cheer: 0.144,
  ooh: 0.15,
  applause: 0.103,
  post: 0.151,
};
const TAU = Math.PI * 2;
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const between = (random: () => number, a: number, b: number) => a + random() * (b - a);

/** Zero-delay state-variable filter: stable at any cutoff, even at low sample rates. */
class Filter {
  low = 0;
  band = 0;
  high = 0;
  k = 1;
  private s1 = 0;
  private s2 = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  constructor(
    private rate: number,
    frequency: number,
    q: number,
  ) {
    this.tune(frequency, q);
  }
  tune(frequency: number, q: number) {
    const g = Math.tan((Math.PI * Math.min(frequency, this.rate * 0.45)) / this.rate);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  run(x: number) {
    const v3 = x - this.s2,
      v1 = this.a1 * this.s1 + this.a2 * v3,
      v2 = this.s2 + this.a2 * this.s1 + this.a3 * v3;
    this.s1 = 2 * v1 - this.s1;
    this.s2 = 2 * v2 - this.s2;
    this.low = v2;
    this.band = v1;
    this.high = x - this.k * v1 - v2;
    return this;
  }
  /** Band-pass with unity gain at the centre. */
  peak(x: number) {
    return this.run(x).band * this.k;
  }
}

// A leather thud: a falling body tone, the ball's hollow ring, a leather scuff and a short boot slap.
function kick(out: Float32Array, rate: number, random: () => number) {
  const pitch = between(random, 0.93, 1.07);
  const slap = new Filter(rate, between(random, 1800, 2500), 1.1),
    leather = new Filter(rate, 480 * pitch, 0.8);
  let body = 0,
    hollow = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate,
      noise = random() * 2 - 1;
    body += (TAU * (92 + 100 * Math.exp(-t * 38)) * pitch) / rate;
    hollow += (TAU * (255 + 80 * Math.exp(-t * 60)) * pitch) / rate;
    const thud =
      Math.sin(body) * Math.exp(-t * 20) * 0.7 + Math.sin(hollow) * Math.exp(-t * 30) * 0.75;
    const x =
      thud +
      leather.peak(noise) * Math.exp(-t * 40) * 0.9 +
      slap.peak(noise) * Math.exp(-t * 280) * 1.8;
    out[i] = Math.tanh(x * 1.6 * Math.min(1, t / 0.001)) / 1.6;
  }
}

// A pea whistle: the pea spinning in the chamber warbles pitch and loudness about 30 times a second.
function whistle(
  out: Float32Array,
  rate: number,
  random: () => number,
  blasts: readonly (readonly [number, number])[],
) {
  const base = between(random, 2420, 2560),
    tilt = [random() * TAU, random() * TAU, random() * TAU];
  const air = new Filter(rate, base, 5),
    chiff = new Filter(rate, 4200, 0.8);
  let phase = 0,
    pea = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate,
      noise = random() * 2 - 1;
    let gate = 0,
      since = 1,
      sag = 1;
    for (const [start, end] of blasts) {
      if (t < start || t > end + 0.05) continue;
      gate = smooth((t - start) / 0.012) * (1 - smooth((t - end) / 0.035));
      since = t - start;
      // A long blast runs out of breath and sags a little at the end.
      if (end - start > 0.5) sag = 1 - 0.035 * smooth((t - end + 0.18) / 0.18);
    }
    pea +=
      (31 + 4 * Math.sin(TAU * 3.1 * t + tilt[0]) + 3 * Math.sin(TAU * 5.3 * t + tilt[1])) / rate;
    const spin = 0.5 + 0.5 * Math.sin(TAU * pea),
      bump = spin * spin,
      depth = 0.5 + 0.12 * Math.sin(TAU * 2.3 * t + tilt[2]);
    const frequency =
      base * sag * (1 - 0.045 * Math.exp(-since / 0.018)) * (1 + 0.03 * (bump - 0.4));
    phase += (TAU * frequency) / rate;
    const tone =
      Math.sin(phase) + (frequency * 2 < rate * 0.45 ? 0.16 * Math.sin(2 * phase + 0.4) : 0);
    out[i] =
      gate *
      (tone * (1 - depth * bump) +
        air.peak(noise) * 0.3 +
        chiff.peak(noise) * Math.exp(-since / 0.008) * 0.6);
  }
}

type Crowd = {
  voices: number;
  /** Male voice pitch range in Hz; every third voice is a woman's, about a sixth higher. */
  pitch: readonly [number, number];
  /** Latest onset and the voice length range, in seconds. */
  onset: number;
  length: readonly [number, number];
  /** Each voice's swell and fade, as fractions of its length. */
  attack: number;
  release: number;
  /** Pitch multiplier across one voice, u = 0..1. */
  contour: (u: number) => number;
  /** Male formants F1..F3 at time t; female formants run 15% higher. */
  vowel: (t: number) => readonly [number, number, number];
  gains: readonly [number, number, number];
  /** Breathy noise and the low roar of many chests under the voices. */
  breath: number;
  roar: number;
};
// Voices are band-limited saws with vibrato and a shared vowel, like a touchline of townsfolk.
function crowd(out: Float32Array, rate: number, random: () => number, spec: Crowd) {
  const voices = Array.from({ length: spec.voices }, (_, v) => {
    const female = v % 3 === 1;
    return {
      female,
      start: random() * spec.onset,
      length: between(random, spec.length[0], spec.length[1]),
      pitch: between(random, spec.pitch[0], spec.pitch[1]) * (female ? 1.7 : 1),
      amp: between(random, 0.55, 1),
      vibrato: between(random, 4.5, 6.5),
      depth: between(random, 0.012, 0.03),
      twist: random() * TAU,
      // Two slow, unrelated wobbles stand in for the unsteadiness of a shouting voice.
      drift: [between(random, 1.3, 2.9), random() * TAU, between(random, 7, 11), random() * TAU],
      phase: random(),
      level: 0,
      rise: 0,
      dt: 0,
      glide: 0,
    };
  });
  const male = [0, 1, 2].map(() => new Filter(rate, 1000, 5)),
    female = [0, 1, 2].map(() => new Filter(rate, 1000, 5));
  const breath = new Filter(rate, 900, 0.8),
    roar = new Filter(rate, 380, 0.7),
    tilt = Math.min(1, (TAU * 900) / rate);
  let low = 0,
    high = 0,
    level = 0,
    rise = 0;
  // Pitch, loudness and vowel move at a control rate and glide linearly between ticks.
  const step = 32;
  for (let i = 0; i < out.length; i++) {
    if (i % step === 0) {
      const t = (i + step) / rate,
        f = spec.vowel(i / rate);
      for (let n = 0; n < 3; n++) {
        male[n].tune(f[n], 4 + n * 2);
        female[n].tune(f[n] * 1.15, 4 + n * 2);
      }
      let target = 0;
      for (const v of voices) {
        const u = Math.max(0, Math.min(1, (t - v.start) / v.length));
        const [a, b, c, d] = v.drift,
          wobble = Math.sin(TAU * a * t + b) * Math.sin(TAU * c * t + d);
        const envelope =
            smooth(u / spec.attack) *
            (1 - smooth((u - 1 + spec.release) / spec.release)) *
            v.amp *
            (1 + 0.2 * wobble),
          frequency =
            v.pitch *
            spec.contour(u) *
            (1 + v.depth * Math.sin(TAU * v.vibrato * t + v.twist) + 0.012 * wobble);
        if (i === 0) v.dt = frequency / rate;
        v.rise = (envelope - v.level) / step;
        v.glide = (frequency / rate - v.dt) / step;
        target += envelope;
      }
      rise = (target / spec.voices - level) / step;
    }
    let m = 0,
      w = 0;
    for (const v of voices) {
      if (v.level > 0 || v.rise > 0) {
        v.phase += v.dt;
        if (v.phase >= 1) v.phase -= 1;
        // PolyBLEP keeps the saw's corner from aliasing into a fizz.
        let saw = 2 * v.phase - 1;
        if (v.phase < v.dt) {
          const x = v.phase / v.dt;
          saw -= x + x - x * x - 1;
        } else if (v.phase > 1 - v.dt) {
          const x = (v.phase - 1) / v.dt;
          saw -= x * x + x + x + 1;
        }
        if (v.female) w += saw * v.level;
        else m += saw * v.level;
      }
      v.level = Math.max(0, v.level + v.rise);
      v.dt += v.glide;
    }
    // A soft glottal tilt before the vowel.
    low += (m - low) * tilt;
    high += (w - high) * tilt;
    let x = 0;
    for (let n = 0; n < 3; n++) x += (male[n].peak(low) + female[n].peak(high)) * spec.gains[n];
    const noise = random() * 2 - 1;
    out[i] =
      x / Math.sqrt(spec.voices) +
      breath.peak(noise) * level * spec.breath +
      roar.run(noise).low * level * spec.roar;
    level = Math.max(0, level + rise);
  }
}

type Claps = {
  clappers: number;
  start: readonly [number, number];
  stop: readonly [number, number];
  level: number;
  /** Loudness across the effect as hands tire and people stop. */
  fade: (t: number) => number;
};
// Each clap is a sharp noise burst rung through the cupped hands' small air cavity.
function claps(out: Float32Array, rate: number, random: () => number, spec: Claps) {
  for (let c = 0; c < spec.clappers; c++) {
    const hands = new Filter(rate, between(random, 800, 2000), between(random, 1.5, 3.5)),
      crack = new Filter(rate, 3500, 0.7);
    const period = 1 / between(random, 3.4, 5.2),
      start = between(random, spec.start[0], spec.start[1]),
      stop = between(random, spec.stop[0], spec.stop[1]),
      amp = spec.level * between(random, 0.4, 1),
      decay = Math.exp(-1 / (rate * between(random, 0.004, 0.008)));
    const times: number[] = [],
      amps: number[] = [];
    for (let at = start; at < stop; at += period * between(random, 0.82, 1.18)) {
      times.push(at);
      amps.push(amp * between(random, 0.65, 1) * spec.fade(at));
    }
    let next = 0,
      burst = 0;
    for (let i = Math.floor(start * rate); i < out.length; i++) {
      if (next < times.length && i / rate >= times[next]) burst = amps[next++];
      else if (next === times.length && burst < 1e-4) break;
      else burst *= decay;
      const noise = (random() * 2 - 1) * burst;
      out[i] += hands.peak(noise) + crack.run(noise).low * 0.35;
    }
  }
}

// A struck aluminium post: inharmonic free-bar modes, each split into a slowly beating pair.
function post(out: Float32Array, rate: number, random: () => number) {
  const base = between(random, 440, 530);
  const modes = [
    [1, 1, 5],
    [2.756, 0.75, 7.5],
    [5.404, 0.45, 12],
    [8.933, 0.25, 20],
  ]
    .filter(([ratio]) => base * ratio * 1.01 < rate * 0.45)
    .map(([ratio, amp, decay]) => ({
      amp,
      fade: Math.exp(-decay / rate),
      step: (TAU * base * ratio) / rate,
      split: between(random, 1.003, 1.008),
      a: random() * TAU,
      b: random() * TAU,
      level: 1,
    }));
  const strike = new Filter(rate, 3000, 0.7);
  let ball = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate,
      noise = random() * 2 - 1;
    let ring = 0;
    for (const mode of modes) {
      mode.a += mode.step;
      mode.b += mode.step * mode.split;
      ring += mode.amp * mode.level * (Math.sin(mode.a) + 0.6 * Math.sin(mode.b));
      mode.level *= mode.fade;
    }
    ball += (TAU * (80 + 90 * Math.exp(-t * 45))) / rate;
    out[i] =
      (ring * 0.5 +
        Math.sin(ball) * Math.exp(-t * 30) * 0.35 +
        strike.run(noise).high * Math.exp(-t * 240) * 0.7) *
      Math.min(1, t / 0.0008);
  }
}

function synthesize(kind: Kind, out: Float32Array, rate: number, random: () => number) {
  const length = DURATION[kind];
  if (kind === 'kick') kick(out, rate, random);
  else if (kind === 'whistle') whistle(out, rate, random, [[0, between(random, 0.22, 0.3)]]);
  else if (kind === 'final-whistle')
    whistle(out, rate, random, [
      [0, 0.19],
      [0.32, 0.51],
      [0.65, 1.42],
    ]);
  else if (kind === 'post') post(out, rate, random);
  else if (kind === 'applause')
    claps(out, rate, random, {
      clappers: 16,
      start: [0, 0.3],
      stop: [1.05, 1.85],
      level: 1,
      fade: (t) => 1 - 0.65 * smooth((t - 0.4) / 1.4),
    });
  else if (kind === 'ooh')
    crowd(out, rate, random, {
      voices: 12,
      pitch: [125, 185],
      onset: 0.1,
      length: [length - 0.3, length - 0.12],
      attack: 0.24,
      release: 0.58,
      // Rising with the chance, then sinking as it goes by: "oooOOOooh".
      contour: (u) => 0.95 + 0.24 * smooth(u / 0.38) - 0.4 * smooth((u - 0.4) / 0.6),
      vowel: (t) => [
        340 + 70 * Math.sin(Math.PI * Math.min(1, t / length)),
        780 + 110 * Math.sin(Math.PI * Math.min(1, t / length)),
        2300,
      ],
      gains: [1, 0.4, 0.08],
      breath: 0.08,
      roar: 0.25,
    });
  else {
    crowd(out, rate, random, {
      voices: 14,
      pitch: [165, 240],
      onset: 0.32,
      length: [0.9, length - 0.35],
      attack: 0.08,
      release: 0.5,
      // "Yeeah!": up into the shout, holding, then easing off.
      contour: (u) => 0.9 + 0.28 * smooth(u / 0.2) - 0.3 * smooth((u - 0.55) / 0.45),
      vowel: (t) => {
        const a = smooth(t / 0.45),
          o = smooth((t - 1) / 1.1);
        return [600 + 160 * a - 120 * o, 1850 - 600 * a - 200 * o, 2600 - 150 * a];
      },
      gains: [1, 0.55, 0.18],
      breath: 0.16,
      roar: 0.5,
    });
    claps(out, rate, random, {
      clappers: 6,
      start: [0.35, 0.75],
      stop: [1.3, 2],
      level: 0.35,
      fade: (t) => 1 - 0.6 * smooth((t - 0.8) / 1.2),
    });
  }
}

/**
 * Short original effects, synthesized locally from a seeded generator: no recordings, no network,
 * and the same samples on every call. `take` picks one of `FOOTBALL_SOUND_TAKES[kind]` variations.
 */
export function renderFootballSound(kind: Kind, sampleRate: number, take = 0) {
  const data = new Float32Array(Math.ceil(sampleRate * DURATION[kind]));
  let seed = (7193 + FOOTBALL_SOUND_KINDS.indexOf(kind) * 7919 + take * 104729) >>> 0;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  synthesize(kind, data, sampleRate, random);
  // Balance on the loudest 50 ms so a kick, a whistle and a roar share one strength scale.
  const window = Math.max(1, Math.round(sampleRate * 0.05));
  let energy = 0,
    loudest = 0;
  for (let i = 0; i < data.length; i++) {
    energy += data[i] * data[i] - (i >= window ? data[i - window] * data[i - window] : 0);
    loudest = Math.max(loudest, energy);
  }
  const gain = loudest > 0 ? LEVEL[kind] / Math.sqrt(loudest / window) : 0,
    fade = Math.round(sampleRate * 0.03);
  for (let i = 0; i < data.length; i++) {
    const x = data[i] * gain * Math.min(1, (data.length - 1 - i) / fade),
      size = Math.abs(x);
    // A soft knee above 0.9 keeps the rare peak inside the -1..1 range.
    data[i] = size > 0.9 ? Math.sign(x) * (0.9 + 0.1 * Math.tanh((size - 0.9) / 0.1)) : x;
  }
  return data;
}

/** Cues of one kind closer together than this play once, at the loudest strength. */
const MERGE = 0.06;
export function footballSoundsBetween(previous: FootballState | null, current: FootballState) {
  if (
    !previous ||
    !current.live ||
    previous.day !== current.day ||
    previous.match !== current.match
  )
    return [];
  const delta = current.elapsed - previous.elapsed;
  // Returning from a hidden tab, seeking, or resuming never replays missed sounds.
  if (delta <= 0 || delta > 0.5) return [];
  const leaders = new Map<Kind, FootballSound>(),
    due: FootballSound[] = [];
  for (const sound of current.sounds) {
    if (sound.at > current.elapsed) break;
    const leader = leaders.get(sound.kind);
    if (leader && sound.at - leader.at < MERGE) {
      const index = due.findIndex((cue) => cue.at === leader.at && cue.kind === sound.kind);
      if (index >= 0 && sound.strength > due[index].strength)
        due[index] = { ...due[index], strength: sound.strength };
      continue;
    }
    leaders.set(sound.kind, sound);
    if (sound.at > previous.elapsed) due.push(sound);
  }
  return due;
}
