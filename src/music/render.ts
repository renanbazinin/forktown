import { compose, durationOf, TRACKS, type Hall, type Note, type TrackId } from './score';
import { isInstrument, playInstrument, type Instrument } from './instruments';

export const SAMPLE_RATE = 24000;
export type Mix = { left: Float32Array; right: Float32Array; sampleRate: number };

// Additive/FM instruments rendered in a worker, and for the town's newer tunes the instruments
// of instruments.ts, which render a whole note at a time. The piano-roll score remains the
// editable source; no external samples, streaming, or runtime oscillator graphs.
export function voice(note: Note, time: number, duration: number, random: number) {
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
    if (isInstrument(note.voice)) {
      addInstrument(note, note.voice, start, beat, left, right);
      continue;
    }
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
  const { hall: space, loudness } = TRACKS[track];
  const [hallL, hallR] = space ? hall(left, right, space) : [];
  // The mix before its soft clip, kept for a tune that settles at its own level.
  const levelled = loudness ? [new Float64Array(frames), new Float64Array(frames)] : undefined;
  // A tune with a hall keeps a little more air at the top than the older, softer loops.
  const smooth = space ? 0.86 : 0.72;
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
    if (hallL && hallR) {
      l += hallL[index];
      r += hallR[index];
    }
    smoothL += smooth * (l - smoothL);
    smoothR += smooth * (r - smoothR);
    if (i < frames) continue;
    if (levelled) {
      levelled[0][index] = smoothL;
      levelled[1][index] = smoothR;
    } else {
      outL[index] = Math.tanh(smoothL * 1.3) * 0.82;
      outR[index] = Math.tanh(smoothR * 1.3) * 0.82;
    }
  }
  if (levelled && loudness) {
    // Settle the mix at the tune's level; twice, as the soft clip bends the first guess a little.
    let gain = 1;
    for (let pass = 0; pass < 2; pass++) {
      const level = softRms(levelled[0], levelled[1], gain);
      if (level > 1e-9) gain *= loudness / level;
    }
    for (let i = 0; i < frames; i++) {
      outL[i] = Math.tanh(levelled[0][i] * gain * 1.3) * 0.82;
      outR[i] = Math.tanh(levelled[1][i] * gain * 1.3) * 0.82;
    }
  }
  return { left: outL, right: outR, sampleRate: SAMPLE_RATE };
}

/** The RMS of a mix once soft-clipped as renderPCM does, at a trial gain. */
function softRms(left: Float64Array, right: Float64Array, gain: number) {
  let sum = 0;
  for (let i = 0; i < left.length; i++) {
    const l = Math.tanh(left[i] * gain * 1.3) * 0.82,
      r = Math.tanh(right[i] * gain * 1.3) * 0.82;
    sum += l * l + r * r;
  }
  return Math.sqrt(sum / (left.length * 2));
}

/** Adds one note on a newer instrument, wrapping its ring into the loop's start. */
function addInstrument(
  note: Note,
  instrument: Instrument,
  start: number,
  beat: number,
  left: Float32Array,
  right: Float32Array,
) {
  const frames = left.length;
  const seed =
    (Math.round(note.beat * 1000) + note.pitch * 7919 + instrument.charCodeAt(0) * 104729) >>> 0;
  const sound = playInstrument(
    instrument,
    { pitch: note.pitch, held: note.length * beat, at: note.beat * beat, seed },
    SAMPLE_RATE,
  );
  const angle = ((Math.max(-1, Math.min(1, note.pan)) + 1) * Math.PI) / 4;
  // A stereo instrument is balanced rather than panned: centred, both sides at full level.
  const stereo = sound.right !== undefined;
  const l = (stereo ? Math.min(1, Math.cos(angle) * Math.SQRT2) : Math.cos(angle)) * note.gain,
    r = (stereo ? Math.min(1, Math.sin(angle) * Math.SQRT2) : Math.sin(angle)) * note.gain;
  const other = sound.right ?? sound.left;
  for (let i = 0; i < sound.left.length; i++) {
    const index = (start + i) % frames;
    left[index] += sound.left[i] * l;
    right[index] += other[i] * r;
  }
}

/**
 * A stereo hall after Freeverb (eight damped combs and four all-passes a side), run twice round
 * the loop like the rest of the mix, so its tail wraps into the start without a seam.
 */
function hall(left: Float32Array, right: Float32Array, space: Hall): [Float32Array, Float32Array] {
  const frames = left.length;
  const scale = SAMPLE_RATE / 44100;
  const feedback = 0.7 + 0.28 * Math.max(0, Math.min(1, space.size));
  const damp = Math.max(0, Math.min(0.95, space.damp));
  const predelay = Math.round(0.024 * SAMPLE_RATE);
  const side = (spread: number) => ({
    combs: [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((length) => ({
      buffer: new Float32Array(Math.round((length + spread) * scale)),
      index: 0,
      store: 0,
    })),
    passes: [556, 441, 341, 225].map((length) => ({
      buffer: new Float32Array(Math.round((length + spread) * scale)),
      index: 0,
    })),
    out: new Float32Array(frames),
  });
  const sides = [side(0), side(23)];
  // Keep the bass out of the hall, so the low end stays clear.
  const cut = Math.exp((-2 * Math.PI * 170) / SAMPLE_RATE);
  let low = 0;
  const level = space.wet * 0.05;
  for (let i = 0; i < frames * 2; i++) {
    const index = i % frames;
    const from = (index - predelay + frames) % frames;
    const dry = (left[from] + right[from]) * 0.5;
    low = dry + cut * (low - dry);
    const input = (dry - low) * level;
    for (const { combs, passes, out } of sides) {
      let sum = 0;
      for (const comb of combs) {
        const y = comb.buffer[comb.index];
        comb.store = y * (1 - damp) + comb.store * damp;
        comb.buffer[comb.index] = input + comb.store * feedback;
        if (++comb.index === comb.buffer.length) comb.index = 0;
        sum += y;
      }
      for (const pass of passes) {
        const y = pass.buffer[pass.index];
        pass.buffer[pass.index] = sum + y * 0.5;
        if (++pass.index === pass.buffer.length) pass.index = 0;
        sum = y - sum;
      }
      if (i >= frames) out[index] = sum;
    }
  }
  return [sides[0].out, sides[1].out];
}
