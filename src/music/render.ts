import { compose, durationOf, TRACKS, type Note, type TrackId } from './score';

export const SAMPLE_RATE = 24000;
export type Mix = { left: Float32Array; right: Float32Array; sampleRate: number };

// Additive/FM instruments rendered in a worker. The piano-roll score remains the
// editable source; no external samples, streaming, or runtime oscillator graphs.
function voice(note: Note, time: number, duration: number, random: number) {
  const f = 440 * 2 ** ((note.pitch - 69) / 12);
  const phase = 2 * Math.PI * f * time;
  const attack = Math.min(1, time / (note.voice === 'pad' ? 0.14 : 0.006));
  const release = Math.max(0, Math.min(1, (duration - time) / (note.voice === 'pad' ? 0.5 : 0.08)));
  let signal = 0,
    decay = 1;
  switch (note.voice) {
    case 'kick':
      signal = Math.sin(2 * Math.PI * (43 * time + 92 * 0.028 * (1 - Math.exp(-time / 0.028))));
      decay = Math.exp(-time * 22);
      break;
    case 'snare':
      signal = random * 0.72 + Math.sin(2 * Math.PI * 175 * time) * 0.28;
      decay = Math.exp(-time * 30);
      break;
    case 'hat':
      signal =
        random * 0.5 * (Math.sin(2 * Math.PI * 7300 * time) + Math.sin(2 * Math.PI * 9100 * time));
      decay = Math.exp(-time * 55);
      break;
    case 'bass':
      signal = Math.sin(phase) * 0.88 + Math.sin(phase * 2) * 0.12;
      decay = Math.exp(-time * 1.7);
      break;
    case 'pad':
      signal =
        0.56 * Math.sin(phase) + 0.28 * Math.sin(phase * 1.0015) + 0.08 * Math.sin(phase * 2);
      decay = 0.9;
      break;
    case 'lead':
      signal =
        0.74 * Math.sin(phase) +
        0.16 * Math.sin(phase * 3) * Math.exp(-time * 7) +
        0.08 * Math.sin(phase * 5) * Math.exp(-time * 14);
      decay = Math.exp(-time * 1.2);
      break;
    case 'pluck':
      signal =
        0.73 * Math.sin(phase) +
        0.19 * Math.sin(phase * 2.001) * Math.exp(-time * 5) +
        0.08 * Math.sin(phase * 3.002) * Math.exp(-time * 9);
      decay = Math.exp(-time * 3.8);
      break;
    case 'keys':
      signal = Math.sin(phase + 0.7 * Math.exp(-time * 7) * Math.sin(phase)) * 0.9;
      decay = Math.exp(-time * 2.2);
      break;
    case 'bell':
      signal = Math.sin(phase + 0.8 * Math.exp(-time * 5) * Math.sin(phase * 2)) * 0.85;
      decay = Math.exp(-time * 2.4);
      break;
  }
  return signal * decay * attack * release * note.gain;
}

export function renderPCM(track: TrackId): Mix {
  const frames = Math.round(durationOf(track) * SAMPLE_RATE);
  const left = new Float32Array(frames),
    right = new Float32Array(frames);
  const beat = 60 / TRACKS[track].bpm;
  for (const note of compose(track)) {
    const start = Math.round(note.beat * beat * SAMPLE_RATE);
    const duration = note.length * beat + (note.voice === 'pad' ? 0.65 : 0.16);
    const count = Math.ceil(duration * SAMPLE_RATE);
    const l = Math.cos(((note.pan + 1) * Math.PI) / 4),
      r = Math.sin(((note.pan + 1) * Math.PI) / 4);
    let seed = (Math.round(note.beat * 1000) + note.pitch * 7919) >>> 0;
    for (let i = 0; i < count; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const sample = voice(note, i / SAMPLE_RATE, duration, seed / 2147483648 - 1);
      const index = (start + i) % frames;
      // Wrap releases into the start of the loop rather than chopping them off.
      left[index] += sample * l;
      right[index] += sample * r;
    }
  }
  const outL = new Float32Array(frames),
    outR = new Float32Array(frames);
  const echo = Math.round(beat * 0.75 * SAMPLE_RATE);
  const room = [0.041, 0.067, 0.101, 0.149, 0.211].map((seconds) =>
    Math.round(seconds * SAMPLE_RATE),
  );
  const wet = track === 'night' ? 0.12 : 0.065;
  let smoothL = 0,
    smoothR = 0;
  // Warm the low-pass for a cycle; short stereo reflections are circular too.
  for (let i = 0; i < frames * 2; i++) {
    const index = i % frames;
    let l = left[index] + right[(index - echo + frames) % frames] * 0.1;
    let r = right[index] + left[(index - echo + frames) % frames] * 0.1;
    room.forEach((delay, tap) => {
      l += (right[(index - delay + frames) % frames] * wet) / (1 + tap * 0.45);
      r += (left[(index - delay - 173 + frames) % frames] * wet) / (1 + tap * 0.45);
    });
    smoothL += 0.72 * (l - smoothL);
    smoothR += 0.72 * (r - smoothR);
    if (i >= frames) {
      outL[index] = Math.tanh(smoothL * 1.3) * 0.82;
      outR[index] = Math.tanh(smoothR * 1.3) * 0.82;
    }
  }
  return { left: outL, right: outR, sampleRate: SAMPLE_RATE };
}
