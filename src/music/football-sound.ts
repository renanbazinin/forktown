import type { FootballSound, FootballState } from '../lib/football';

// Short original effects, synthesized locally. No recording or network request.
export function renderFootballSound(kind: FootballSound['kind'], sampleRate: number) {
  const duration = kind === 'kick' ? 0.16 : kind === 'whistle' ? 0.42 : 1.15;
  const data = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = 7193,
    phase = 0,
    lowNoise = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    lowNoise = lowNoise * 0.88 + noise * 0.12;
    if (kind === 'kick') {
      phase += (Math.PI * 2 * (90 + 105 * Math.exp(-t * 55))) / sampleRate;
      data[i] =
        (Math.sin(phase) * Math.exp(-t * 28) * 0.85 + noise * Math.exp(-t * 110) * 0.25) *
        Math.min(1, t / 0.002);
    } else if (kind === 'whistle') {
      const envelope = Math.min(1, t / 0.025, Math.max(0, (duration - t) / 0.07));
      phase += (Math.PI * 2 * (2050 + 90 * Math.sin(t * 48))) / sampleRate;
      data[i] = Math.sin(phase) * envelope * 0.14 * (0.8 + Math.sin(t * 21) * 0.2);
    } else {
      const envelope = Math.min(1, t / 0.12) * Math.max(0, 1 - t / duration);
      const voices =
        (Math.sin(t * 1900 + Math.sin(t * 7) * 5) + Math.sin(t * 1450 + Math.sin(t * 9) * 7)) *
        0.035;
      const claps = noise * Math.pow(Math.max(0, Math.sin(t * 31)), 18) * 0.12;
      data[i] = (lowNoise * 0.6 + voices + claps) * envelope;
    }
  }
  return data;
}
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
  return current.sounds.filter(
    (sound) => sound.at > previous.elapsed && sound.at <= current.elapsed,
  );
}
