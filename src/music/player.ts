import { durationOf, isTownTune, phraseOf, type TrackId } from './score';
import { renderFootballTakes, renderTrack } from './synth';
import { FOOTBALL_SOUND_TAKES, renderFootballSound } from './football-sound';
import type { FootballSound } from '../lib/football';
import { CinemaPlayer, type CinemaPlayback } from './cinema-player';
import type { Playable } from '../lib/break-cards';

/** A looping track on air. */
type Playing = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  track: TrackId;
  /** The context time of the loop's first beat: still ahead while it waits for a phrase end. */
  startedAt: number;
};
/**
 * How one of the town's tunes gives way to the next: at the end of the playing tune's phrase of
 * four bars, so a melody is never cut off mid-line, or at once (the listening room's picks).
 */
export type Handoff = 'phrase' | 'now';
/** Seconds the outgoing tune fades over, ending as its phrase ends. */
const PHRASE_FADE = 0.9;

export class TownPlayer {
  private context: AudioContext;
  private output: GainNode;
  private music: GainNode;
  private cinema: CinemaPlayer;
  private current?: Playing;
  private cache = new Map<TrackId, Promise<AudioBuffer>>();
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
  private render(track: TrackId) {
    let rendering = this.cache.get(track);
    if (!rendering) {
      rendering = renderTrack(track);
      this.cache.set(track, rendering);
      // At most three stereo loops retained (up to about 60 MB with the longest tunes).
      if (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value!);
    }
    return rendering.catch((error: unknown) => {
      this.cache.delete(track);
      throw error;
    });
  }
  /** Renders a track ahead (the next tune of the hour), so its turn starts on time. */
  prepare(track: TrackId) {
    if (!this.disposed) this.render(track).catch(() => {});
  }
  /** Where the current loop is: seconds into it, of its whole length. */
  get position() {
    const playing = this.current;
    if (!playing) return undefined;
    const duration = playing.source.buffer?.duration || durationOf(playing.track);
    const seconds = Math.max(0, this.context.currentTime - playing.startedAt) % duration;
    return { track: playing.track, seconds, duration };
  }
  /** Seconds until a tune waiting for the end of a phrase comes in; 0 when none is waiting. */
  get handoff() {
    return this.current ? Math.max(0, this.current.startedAt - this.context.currentTime) : 0;
  }
  /**
   * Starts a looping track, fading in over 1.5 s. With `at`, it waits until then and comes in
   * quickly instead, as the tune before it fades.
   */
  private start(track: TrackId, buffer: AudioBuffer, at?: number): Playing {
    const time = this.context.currentTime;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0, time);
    if (at === undefined) gain.gain.linearRampToValueAtTime(1, time + 1.5);
    else {
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(1, at + 0.25);
    }
    source.connect(gain).connect(this.music);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.active.delete(source);
    };
    this.active.set(source, gain);
    source.start(at ?? time);
    return { source, gain, track, startedAt: at ?? time };
  }
  private fadeOut(playing: Playing) {
    const time = this.context.currentTime;
    // A tune still waiting for its turn is simply never started.
    if (playing.startedAt > time) {
      playing.source.stop(time);
      return;
    }
    playing.gain.gain.cancelAndHoldAtTime(time);
    playing.gain.gain.linearRampToValueAtTime(0, time + 1.5);
    playing.source.stop(time + 1.6);
  }
  /** Fades a tune out over the last PHRASE_FADE seconds before `end`, then stops it. */
  private fadeOutAt(playing: Playing, end: number) {
    const gain = playing.gain.gain;
    gain.cancelAndHoldAtTime(this.context.currentTime);
    gain.setTargetAtTime(0, end - PHRASE_FADE, PHRASE_FADE / 3);
    playing.source.stop(end + 1.5);
  }
  /**
   * When a playing tune's current phrase of four bars ends (its loop's end is a phrase end too),
   * leaving it time to fade first. A tune still waiting for its turn hands over where it would
   * have come in.
   */
  private phraseEnd(playing: Playing) {
    const now = this.context.currentTime;
    if (playing.startedAt > now) return playing.startedAt;
    const phrase = phraseOf(playing.track);
    const loop = playing.source.buffer?.duration || durationOf(playing.track);
    const into = (now - playing.startedAt) % loop;
    const lead = PHRASE_FADE + 0.1;
    let end = Math.ceil((into + lead) / phrase) * phrase;
    if (end > loop) end = loop - into >= lead ? loop : loop + phrase;
    return now + end - into;
  }
  /**
   * Plays a track, crossfading from what plays now. One of the town's own tunes gives way to the
   * next at the end of its phrase (`handoff`), so the hour's change never cuts a melody.
   */
  async play(track: TrackId, handoff: Handoff = 'phrase') {
    if (this.disposed) return;
    const revision = ++this.revision;
    if (this.current?.track === track) return;
    const buffer = await this.render(track);
    if (this.disposed || revision !== this.revision) return;
    const old = this.current;
    const at =
      handoff === 'phrase' && old && isTownTune(old.track) && isTownTune(track)
        ? this.phraseEnd(old)
        : undefined;
    if (old) {
      if (at !== undefined && old.startedAt <= this.context.currentTime) this.fadeOutAt(old, at);
      else this.fadeOut(old);
    }
    this.current = this.start(track, buffer, at);
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
