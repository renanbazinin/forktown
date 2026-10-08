import type { TrackId } from './score';
import { renderFootballTakes, renderTrack } from './synth';
import { FOOTBALL_SOUND_TAKES, renderFootballSound } from './football-sound';
import type { FootballSound } from '../lib/football';
import { CinemaPlayer, type CinemaPlayback } from './cinema-player';
import type { Playable } from '../lib/break-cards';

export class TownPlayer {
  private context: AudioContext;
  private output: GainNode;
  private music: GainNode;
  private cinema: CinemaPlayer;
  private current?: { source: AudioBufferSourceNode; gain: GainNode; track: TrackId };
  private cache = new Map<TrackId, Promise<AudioBuffer>>();
  /** Each track's level below full: a Bandstand band, heard as far as the camera is from it. */
  private levels = new Map<TrackId, number>();
  private revision = 0;
  private disposed = false;
  private active = new Map<AudioBufferSourceNode, GainNode>();
  private effects = new Map<AudioBufferSourceNode, { gain: GainNode; pan: StereoPannerNode }>();
  private effectBuffers = new Map<string, AudioBuffer>();
  private effectTurns = new Map<FootballSound['kind'], number>();
  private warming?: Promise<void>;
  constructor() {
    // Interactive mode starts from a gesture; the live route also attempts permitted autoplay.
    this.context = new AudioContext();
    this.output = this.context.createGain();
    this.output.gain.value = 0.55;
    this.output.connect(this.context.destination);
    this.music = this.context.createGain();
    this.music.connect(this.output);
    this.cinema = new CinemaPlayer(this.context, this.output, (gain) => {
      this.music.gain.setTargetAtTime(
        1 - Math.min(1, gain * 2.5) * 0.94,
        this.context.currentTime,
        0.12,
      );
    });
  }
  resume() {
    return this.context.resume().then(() => this.warmEffects());
  }
  suspend() {
    this.silenceEffects();
    this.cinema.stop(true);
    return this.context.suspend();
  }
  cinemaSound(state?: CinemaPlayback) {
    this.cinema.sync(state);
  }
  /** Warms the render of a film, ad or break card that is about to play. */
  cinemaPrepare(film: Playable) {
    this.cinema.prepare(film);
  }
  get cinemaStatus() {
    return this.cinema.status;
  }
  effect(kind: FootballSound['kind'], volume: number, pan: number) {
    if (this.disposed || volume <= 0 || this.context.state !== 'running') return;
    // Rotate through the rendered takes so repeated kicks and cheers never sound stamped.
    const turn = this.effectTurns.get(kind) ?? 0;
    this.effectTurns.set(kind, turn + 1);
    const buffer = this.effectBuffer(kind, turn % FOOTBALL_SOUND_TAKES[kind]);
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
  private effectBuffer(kind: FootballSound['kind'], take: number) {
    const key = `${kind}:${take}`;
    let buffer = this.effectBuffers.get(key);
    if (!buffer) {
      const data = renderFootballSound(kind, this.context.sampleRate, take);
      buffer = this.context.createBuffer(1, data.length, this.context.sampleRate);
      buffer.copyToChannel(data, 0);
      this.effectBuffers.set(key, buffer);
    }
    return buffer;
  }
  /** Renders every take in a worker, so neither turning sound on nor the first goal stalls a frame. */
  private warmEffects() {
    if (this.disposed || this.warming) return;
    const rate = this.context.sampleRate;
    this.warming = renderFootballTakes(rate)
      .then((takes) => {
        if (this.disposed) return;
        for (const [key, data] of takes) {
          if (this.effectBuffers.has(key)) continue;
          const buffer = this.context.createBuffer(1, data.length, rate);
          buffer.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
          this.effectBuffers.set(key, buffer);
        }
      })
      // Without the worker, a take is still rendered the first time it plays.
      .catch(() => {});
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
  /**
   * How loud a track plays, 0..1 (full by default): a Bandstand band follows the camera's
   * distance from the stand. Eases there if that track is playing; otherwise its next start
   * fades in to it.
   */
  level(track: TrackId, value: number) {
    const level = Math.max(0, Math.min(1, value));
    if (this.levels.get(track) === level) return;
    this.levels.set(track, level);
    if (this.disposed || this.current?.track !== track) return;
    const time = this.context.currentTime;
    this.current.gain.gain.cancelAndHoldAtTime(time);
    this.current.gain.gain.setTargetAtTime(level, time, 0.25);
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
    gain.gain.linearRampToValueAtTime(this.levels.get(track) ?? 1, time + 1.5);
    source.connect(gain).connect(this.music);
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
    this.cinema.stop();
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
    this.cinema.dispose();
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
    this.music.disconnect();
    void this.context.close();
  }
}
