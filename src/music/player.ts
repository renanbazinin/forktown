import type { TrackId } from './score';
import { renderTrack } from './synth';
import { renderFootballSound } from './football-sound';
import type { FootballSound } from '../lib/football';

export class TownPlayer {
  private context: AudioContext;
  private output: GainNode;
  private current?: { source: AudioBufferSourceNode; gain: GainNode; track: TrackId };
  private cache = new Map<TrackId, Promise<AudioBuffer>>();
  private revision = 0;
  private disposed = false;
  private active = new Map<AudioBufferSourceNode, GainNode>();
  private effects = new Map<AudioBufferSourceNode, { gain: GainNode; pan: StereoPannerNode }>();
  private effectBuffers = new Map<FootballSound['kind'], AudioBuffer>();
  constructor() {
    // Interactive mode starts from a gesture; the live route also attempts permitted autoplay.
    this.context = new AudioContext();
    this.output = this.context.createGain();
    this.output.gain.value = 0.55;
    this.output.connect(this.context.destination);
  }
  resume() {
    return this.context.resume();
  }
  suspend() {
    this.silenceEffects();
    return this.context.suspend();
  }
  effect(kind: FootballSound['kind'], volume: number, pan: number) {
    if (this.disposed || volume <= 0 || this.context.state !== 'running') return;
    let buffer = this.effectBuffers.get(kind);
    if (!buffer) {
      const data = renderFootballSound(kind, this.context.sampleRate);
      buffer = this.context.createBuffer(1, data.length, this.context.sampleRate);
      buffer.copyToChannel(data, 0);
      this.effectBuffers.set(kind, buffer);
    }
    const source = this.context.createBufferSource(),
      gain = this.context.createGain(),
      panner = this.context.createStereoPanner();
    source.buffer = buffer;
    gain.gain.value = Math.min(1, volume);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(gain).connect(panner).connect(this.output);
    this.effects.set(source, { gain, pan: panner });
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      panner.disconnect();
      this.effects.delete(source);
    };
    source.start();
  }
  silenceEffects() {
    for (const [source, nodes] of this.effects) {
      source.stop();
      source.disconnect();
      nodes.gain.disconnect();
      nodes.pan.disconnect();
    }
    this.effects.clear();
  }
  volume(value: number) {
    this.output.gain.setTargetAtTime(
      Math.max(0, Math.min(1, value)),
      this.context.currentTime,
      0.06,
    );
  }
  async play(track: TrackId) {
    if (this.disposed) return;
    const revision = ++this.revision;
    if (this.current?.track === track) return;
    let rendering = this.cache.get(track);
    if (!rendering) {
      rendering = renderTrack(track);
      this.cache.set(track, rendering);
      // At most three stereo loops retained (roughly 30 MB).
      if (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value!);
    }
    let buffer: AudioBuffer;
    try {
      buffer = await rendering;
    } catch (error) {
      this.cache.delete(track);
      throw error;
    }
    if (this.disposed || revision !== this.revision) return;
    const time = this.context.currentTime;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(1, time + 1.5);
    source.connect(gain).connect(this.output);
    const old = this.current;
    if (old) {
      old.gain.gain.cancelAndHoldAtTime(time);
      old.gain.gain.linearRampToValueAtTime(0, time + 1.5);
      old.source.stop(time + 1.6);
    }
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.active.delete(source);
    };
    this.active.set(source, gain);
    source.start(time);
    this.current = { source, gain, track };
  }
  stop() {
    this.silenceEffects();
    ++this.revision;
    this.current = undefined;
    const time = this.context.currentTime;
    // Mute both sides of an in-progress crossfade, including on a quick toggle.
    for (const [source, gain] of this.active) {
      gain.gain.cancelAndHoldAtTime(time);
      gain.gain.linearRampToValueAtTime(0, time + 0.18);
      source.stop(time + 0.2);
    }
  }
  dispose() {
    this.silenceEffects();
    this.effectBuffers.clear();
    this.disposed = true;
    ++this.revision;
    for (const source of this.active.keys()) {
      source.stop();
      source.disconnect();
    }
    this.active.clear();
    this.cache.clear();
    this.output.disconnect();
    void this.context.close();
  }
}
