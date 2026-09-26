import type { Screening } from '../lib/cinema';
import { cinemaScore, type FilmEffect } from './cinema-score';
import { SAMPLE_RATE, voice, type Mix } from './render';

const tau = Math.PI * 2;
function effect(kind: FilmEffect, t: number, duration: number, noise: number, lowNoise: number) {
  const p = t / duration;
  switch (kind) {
    case 'pop':
      return (
        (Math.sin(tau * (130 * t + 3 * (1 - Math.exp(-t * 70)))) + noise * 0.6) * Math.exp(-t * 40)
      );
    case 'bounce':
      return Math.sin(tau * (260 * t - 240 * t * t)) * Math.exp(-t * 15);
    case 'rustle':
      return noise * (0.2 + 0.3 * Math.sin(t * 37) ** 2);
    case 'chime':
      return (Math.sin(tau * 880 * t) + Math.sin(tau * 1320 * t) * 0.45) * Math.exp(-t * 4);
    case 'meow':
      return (
        Math.sin(tau * (510 * t - 130 * t * t) + 1.7 * Math.sin(tau * (510 * t - 130 * t * t))) *
        Math.sin(Math.PI * p)
      );
    case 'quack':
      return (
        Math.sin(tau * (380 * t - 150 * t * t) + 2 * Math.sin(tau * 95 * t)) *
        Math.sin(Math.PI * p) *
        0.7
      );
    case 'flutter':
      return noise * Math.pow(Math.max(0, Math.sin(tau * 11 * t)), 5);
    case 'water':
      return lowNoise * 2 + Math.sin(tau * (690 * t + 0.5 * Math.sin(t * 5))) * 0.07;
    case 'engine':
      return (
        (Math.sin(tau * (65 * t + 8 * t * t)) * 0.4 +
          Math.sin(tau * (130 * t + 16 * t * t)) * 0.18 +
          lowNoise * 0.8) *
        (0.8 + 0.2 * Math.sin(t * 18))
      );
    case 'beep':
      return Math.sin(tau * (duration > 0.4 ? 1046 : 784) * t) * 0.6;
    case 'sweep':
      return (noise * 0.5 + lowNoise * 1.2) * (0.35 + 0.65 * Math.sin(Math.PI * p));
    case 'crowd':
      return (
        lowNoise * 1.8 +
        noise * Math.pow(Math.max(0, Math.sin(t * 29)), 16) * 0.5 +
        (Math.sin(t * 1470 + Math.sin(t * 7) * 8) + Math.sin(t * 1900 + Math.sin(t * 9) * 7)) * 0.09
      );
    case 'step':
      return (noise * 0.5 + Math.sin(tau * 120 * t)) * Math.exp(-t * 32);
    case 'swish':
      return (noise * 0.6 + lowNoise) * Math.sin(Math.PI * p) ** 2;
    case 'clash':
      return (
        (Math.sin(tau * 1480 * t) +
          Math.sin(tau * 2317 * t) * 0.65 +
          Math.sin(tau * 3419 * t) * 0.3) *
          Math.exp(-t * 8) *
          0.55 +
        noise * Math.exp(-t * 70) * 0.4
      );
    case 'wind':
      return lowNoise * (0.7 + 0.3 * Math.sin(t * 0.9));
    case 'hum':
      return (
        (Math.sin(tau * 73 * t) * 0.7 + Math.sin(tau * 110 * t + Math.sin(t * 3)) * 0.3) *
        (0.65 + Math.sin(t * 9) * 0.25)
      );
    case 'beam':
      return (
        Math.sin(tau * (220 * t + 34 * t * t) + Math.sin(tau * 43 * t) * 2) *
        (0.5 + 0.5 * Math.sin(t * 26) ** 2) *
        0.7
      );
    case 'gasp':
      return (noise * 0.4 + Math.sin(tau * (320 * t + 170 * t * t)) * 0.3) * Math.sin(Math.PI * p);
    case 'warp':
      return (Math.sin(tau * (100 * t + 70 * t * t)) * 0.7 + lowNoise) * Math.sin(Math.PI * p);
    // Starlight Reel effects.
    case 'rain':
      return (
        (noise - lowNoise) * 0.45 * (0.85 + 0.15 * Math.sin(t * 1.3)) +
        Math.pow(Math.max(0, noise), 24) * 1.6
      );
    case 'drip':
      return (
        Math.sin(tau * (900 * t + 2600 * t * t)) * Math.exp(-t * 32) +
        noise * Math.exp(-t * 160) * 0.3
      );
    case 'bubble':
      return Math.sin(tau * (280 * t + 2200 * t * t)) * Math.exp(-t * 22) * 0.8;
    case 'whale': {
      const f = 95 + 30 * Math.sin(Math.PI * p) + 6 * Math.sin(t * 2.3);
      return (
        (Math.sin(tau * f * t) * 0.7 + Math.sin(tau * f * 2.01 * t) * 0.2 + lowNoise * 0.5) *
        Math.sin(Math.PI * p) ** 1.5
      );
    }
    case 'chug': {
      const puff = Math.pow(Math.max(0, Math.sin(tau * 2.6 * t)), 8);
      return (
        lowNoise * 2.6 * puff +
        (noise - lowNoise) * 0.25 * Math.pow(Math.max(0, Math.sin(tau * 5.2 * t + 1)), 20)
      );
    }
    case 'whistle':
      return (
        (Math.sin(tau * 587 * t) * 0.45 +
          Math.sin(tau * 698 * t) * 0.35 +
          (noise - lowNoise) * 0.12) *
        Math.min(1, t / 0.12) *
        Math.sqrt(Math.max(0, Math.sin(Math.PI * p)))
      );
    case 'thunder':
      return (
        lowNoise *
        3.4 *
        Math.exp(-t * 1.1) *
        (1 - Math.exp(-t * 5)) *
        (0.75 + 0.25 * Math.sin(t * 7))
      );
    case 'wave':
      return (noise * 0.25 + lowNoise * 1.6) * Math.sin(Math.PI * p) ** 2;
    case 'crunch':
      return noise * Math.exp(-t * 26) * (0.55 + 0.45 * Math.sin(t * 1900));
    case 'boing':
      return Math.sin(tau * (190 * t + 5 * Math.sin(tau * 8 * t))) * Math.exp(-t * 5);
    case 'creak':
      return (
        Math.pow(Math.abs(Math.sin(tau * (70 * t + 4 * Math.sin(t * 5)))), 14) *
        1.3 *
        Math.sin(Math.PI * p)
      );
    case 'rumble':
      return (lowNoise * 2.6 + noise * 0.12) * Math.pow(Math.sin(Math.PI * p), 0.4);
    case 'whir':
      return (
        (Math.sin(tau * (420 * t + 15 * Math.sin(tau * 3 * t))) * 0.35 +
          Math.sin(tau * 840 * t) * 0.08) *
        Math.sin(Math.PI * p)
      );
    case 'splash':
      return (noise * 0.7 + lowNoise * 1.4) * Math.exp(-t * 7) * Math.min(1, t / 0.01);
    case 'knock':
      return Math.sin(tau * 180 * t) * Math.exp(-t * 38) + noise * Math.exp(-t * 90) * 0.3;
    case 'clatter': {
      const hit = (t * 9) % 1;
      return (
        (Math.sin(tau * 1230 * t) +
          Math.sin(tau * 1870 * t) * 0.7 +
          Math.sin(tau * 2710 * t) * 0.4) *
          Math.exp(-hit * 5) *
          Math.exp(-t * 2.5) *
          0.5 +
        noise * Math.exp(-hit * 18) * 0.35
      );
    }
    case 'woo':
      return (
        Math.sin(tau * (430 * t - (150 * t * t) / duration) + Math.sin(tau * 5.5 * t) * 1.2) *
        Math.sin(Math.PI * p) *
        0.7
      );
    case 'sneeze':
      return p < 0.65
        ? (noise - lowNoise) * 0.4 * (p / 0.65) ** 2 + Math.sin(tau * 300 * t) * 0.08 * (p / 0.65)
        : noise * Math.exp(-(t - duration * 0.65) * 14) * 0.9;
    case 'tweet': {
      const chirp = (t % 0.13) / 0.13;
      return t % 0.39 < 0.3 && chirp < 0.55
        ? Math.sin(tau * (2400 * t + 5200 * (t % 0.13) ** 2)) *
            Math.sin((Math.PI * chirp) / 0.55) *
            0.5
        : 0;
    }
    case 'bark':
      return (
        (Math.sin(tau * (330 * t - 700 * t * t)) * 0.6 +
          Math.sin(tau * (660 * t - 1400 * t * t)) * 0.25 +
          noise * 0.25) *
        Math.exp(-t * 11)
      );
    case 'click':
      return noise * Math.exp(-t * 300) + Math.sin(tau * 2200 * t) * Math.exp(-t * 120) * 0.5;
    case 'scribble':
      return (noise - lowNoise) * 0.6 * Math.pow(Math.abs(Math.sin(t * 38)), 2);
    case 'sparkle': {
      const step = Math.floor(t * 12);
      const f = [2093, 2637, 3136, 2349][step % 4];
      return Math.sin(tau * f * t) * Math.exp(-((t * 12) % 1) * 5) * 0.4 * (1 - p * 0.6);
    }
    case 'crackle':
      return Math.pow(noise, 13) * 3 + lowNoise * 0.4;
    case 'thud':
      return Math.sin(tau * 68 * t) * Math.exp(-t * 17) + lowNoise * Math.exp(-t * 9) * 1.5;
    case 'squeak':
      return Math.sin(tau * (1500 * t + 60 * Math.sin(tau * 7 * t))) * Math.sin(Math.PI * p) * 0.5;
    case 'applause':
      return (
        noise *
        (0.35 + 0.65 * Math.pow(Math.abs(Math.sin(t * 83) * Math.sin(t * 57.3)), 3)) *
        Math.min(1, t / 0.3, (duration - t) / 0.6)
      );
    case 'toll':
      return (
        (Math.sin(tau * 392 * t) +
          Math.sin(tau * 392 * 2.76 * t) * 0.45 +
          Math.sin(tau * 392 * 5.4 * t) * 0.2) *
        Math.exp(-t * 1.4) *
        0.6
      );
    case 'foghorn':
      return (
        (Math.sin(tau * 98 * t) * 0.6 +
          Math.sin(tau * 196 * t) * 0.25 +
          Math.sin(tau * 294 * t) * 0.12) *
        Math.min(1, t / 0.25) *
        Math.pow(Math.max(0, Math.sin(Math.PI * p)), 0.3)
      );
    case 'snore':
      return (
        (lowNoise * 1.4 + Math.sin(tau * 85 * t) * 0.25) *
        Math.pow(Math.max(0, Math.sin(tau * 0.45 * t)), 2)
      );
    case 'tick':
      return Math.sin(tau * 3100 * t) * Math.exp(-t * 180) + noise * Math.exp(-t * 400) * 0.3;
    case 'yawn':
      return (
        (Math.sin(tau * (330 * t - 90 * t * t)) * 0.35 + (noise - lowNoise) * 0.2) *
        Math.sin(Math.PI * p)
      );
    case 'croak':
      return (
        Math.sin(tau * 140 * t + 3 * Math.sin(tau * 35 * t)) *
        Math.pow(Math.max(0, Math.sin(tau * 9 * t)), 2) *
        Math.sin(Math.PI * p)
      );
    case 'gull':
      return (
        Math.sin(tau * (1100 * t - 500 * t * t) + Math.sin(tau * 23 * t) * 2) *
        Math.sin(Math.PI * p) *
        0.55
      );
    case 'giggle': {
      const burst = (t % 0.14) / 0.14;
      return burst < 0.6
        ? Math.sin(tau * (620 + 60 * Math.floor(t / 0.14)) * t + Math.sin(tau * 40 * t)) *
            Math.sin((Math.PI * burst) / 0.6) *
            0.45
        : 0;
    }
  }
}

/** A complete, non-looping stereo film mix; seeking never depends on earlier playback. */
export function renderCinemaPCM(film: Screening): Mix {
  const frames = Math.round(film.duration * SAMPLE_RATE);
  const left = new Float32Array(frames),
    right = new Float32Array(frames);
  for (const cue of cinemaScore(film)) {
    const start = Math.round(cue.at * SAMPLE_RATE);
    const count = Math.min(Math.ceil(cue.duration * SAMPLE_RATE), frames - start);
    const l = Math.cos(((cue.pan + 1) * Math.PI) / 4),
      r = Math.sin(((cue.pan + 1) * Math.PI) / 4);
    let seed = (start + 7193) >>> 0,
      low = 0;
    for (let i = 0; i < count; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2147483648 - 1;
      low += (noise - low) * 0.06;
      const t = i / SAMPLE_RATE;
      const sample =
        cue.kind === 'note'
          ? voice(
              {
                beat: 0,
                length: cue.duration,
                pitch: cue.pitch,
                voice: cue.voice,
                gain: cue.gain,
                pan: cue.pan,
              },
              t,
              cue.duration,
              noise,
            )
          : effect(cue.kind, t, cue.duration, noise, low) *
            cue.gain *
            Math.min(1, t / 0.006, Math.max(0, (cue.duration - t) / 0.045));
      left[start + i] += sample * l;
      right[start + i] += sample * r;
    }
  }
  // Short stereo room reflections, with no wrap into the opening title.
  const dryL = left.slice(),
    dryR = right.slice();
  const delay = Math.round(0.087 * SAMPLE_RATE);
  for (let i = 0; i < frames; i++) {
    const fade = Math.min(1, i / (SAMPLE_RATE * 0.025), (frames - 1 - i) / (SAMPLE_RATE * 0.18));
    left[i] = Math.tanh((dryL[i] + (i >= delay ? dryR[i - delay] * 0.12 : 0)) * 1.7) * 0.88 * fade;
    right[i] = Math.tanh((dryR[i] + (i >= delay ? dryL[i - delay] * 0.12 : 0)) * 1.7) * 0.88 * fade;
  }
  return { left, right, sampleRate: SAMPLE_RATE };
}
