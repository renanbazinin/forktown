import { durationOf, isBandTrack, isTownTune, phraseOf, type TrackId } from './score';
import { renderFootballTakes, renderTrack } from './synth';
import { FOOTBALL_SOUND_TAKES, renderFootballSound } from './football-sound';
import type { FootballSound } from '../lib/football';
import { CinemaPlayer, type CinemaPlayback } from './cinema-player';
import type { Playable } from '../lib/break-cards';

/** A looping track on air: its own gain, and for a band a pan toward the stand. */
type Playing = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  track: TrackId;
  panner?: StereoPannerNode;
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
/**
 * The town's tune under a band at the gain the band is heard at: barely touched by a band heard
 * from afar, almost gone when the camera is at the stand (the cinema's curve on `music`).
 */
export const bedLevel = (band: number) => 1 - Math.min(1, Math.max(0, band) * 2.5) * 0.94;

export class TownPlayer {
  private context: AudioContext;
  private output: GainNode;
  private music: GainNode;
  private cinema: CinemaPlayer;
  private current?: Playing;
  /** The town's own tune, kept playing under a Bandstand band (and never restarted for it). */
  private bed?: Playing;
  private cache = new Map<TrackId, Promise<AudioBuffer>>();
  /** Each track's level below full: a Bandstand band, heard as far as the camera is from it. */
  private levels = new Map<TrackId, number>();
  /** Each band's pan toward the stand, -1..1. */
  private pans = new Map<TrackId, number>();
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
   * How loud a track plays, 0..1 (full by default), and where (pan, -1..1): a Bandstand band
   * follows the camera's distance from the stand and where the stand sits on screen. Eases there
   * if that track is playing, and the town's tune under it with it; otherwise its next start
   * fades in to it.
   */
  level(track: TrackId, value: number, pan = 0) {
    const level = Math.max(0, Math.min(1, value));
    const toward = Math.max(-1, Math.min(1, pan));
    if (this.levels.get(track) === level && (this.pans.get(track) ?? 0) === toward) return;
    this.levels.set(track, level);
    this.pans.set(track, toward);
    if (this.disposed || this.current?.track !== track) return;
    const time = this.context.currentTime;
    this.current.gain.gain.cancelAndHoldAtTime(time);
    this.current.gain.gain.setTargetAtTime(level, time, 0.25);
    this.current.panner?.pan.setTargetAtTime(toward, time, 0.25);
    this.duck();
  }
  /** Eases the tune under a band to the band's gain (bedLevel). */
  private duck() {
    if (!this.bed || !this.current) return;
    const time = this.context.currentTime;
    this.bed.gain.gain.cancelAndHoldAtTime(time);
    this.bed.gain.gain.setTargetAtTime(
      bedLevel(this.levels.get(this.current.track) ?? 1),
      time,
      0.25,
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
   * Starts a looping track, fading in over 1.5 s to `level`; a band through its own pan. With
   * `at`, it waits until then and comes in quickly instead, as the tune before it fades.
   */
  private start(track: TrackId, buffer: AudioBuffer, level: number, at?: number): Playing {
    const time = this.context.currentTime;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0, time);
    if (at === undefined) gain.gain.linearRampToValueAtTime(level, time + 1.5);
    else {
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(level, at + 0.25);
    }
    const panner = isBandTrack(track) ? this.context.createStereoPanner() : undefined;
    if (panner) {
      panner.pan.value = this.pans.get(track) ?? 0;
      source.connect(gain).connect(panner).connect(this.music);
    } else source.connect(gain).connect(this.music);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
      this.active.delete(source);
    };
    this.active.set(source, gain);
    source.start(at ?? time);
    return { source, gain, track, panner, startedAt: at ?? time };
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
   * Plays a track, crossfading from what plays now. A Bandstand band plays over `bed`, the town's
   * own tune (trackForTown without the band), which keeps playing under it at bedLevel: a band
   * heard faintly from afar never leaves the town near silent. Going back to that tune fades the
   * band and brings the tune back up without restarting it. One of the town's own tunes gives way
   * to the next at the end of its phrase (`handoff`), so the hour's change never cuts a melody.
   */
  async play(track: TrackId, bed?: TrackId, handoff: Handoff = 'phrase') {
    if (this.disposed) return;
    const revision = ++this.revision;
    const under = isBandTrack(track) && bed !== undefined && bed !== track ? bed : undefined;
    if (this.current?.track === track && this.bed?.track === under) return;
    // Leaving a set for the tune under it.
    if (this.bed && this.bed.track === track) {
      if (this.current) this.fadeOut(this.current);
      const tune = this.bed;
      this.current = tune;
      this.bed = undefined;
      const time = this.context.currentTime;
      tune.gain.gain.cancelAndHoldAtTime(time);
      tune.gain.gain.setTargetAtTime(this.levels.get(track) ?? 1, time, 0.25);
      return;
    }
    // Only what is not already playing needs rendering.
    const playing = (id: TrackId | undefined) =>
      [this.current, this.bed].find(
        (candidate) => candidate !== undefined && candidate.track === id,
      );
    const [buffer, bedBuffer] = await Promise.all([
      playing(track) ? undefined : this.render(track),
      under !== undefined && !playing(under) ? this.render(under) : undefined,
    ]);
    if (this.disposed || revision !== this.revision) return;
    const keepBed = under !== undefined ? playing(under) : undefined;
    const keepBand = playing(track);
    const outgoing = this.current;
    const at =
      handoff === 'phrase' &&
      outgoing &&
      !keepBand &&
      under === undefined &&
      this.bed === undefined &&
      isTownTune(outgoing.track) &&
      isTownTune(track)
        ? this.phraseEnd(outgoing)
        : undefined;
    for (const old of [this.current, this.bed])
      if (old && old !== keepBed && old !== keepBand) {
        if (at !== undefined && old === outgoing && old.startedAt <= this.context.currentTime)
          this.fadeOutAt(old, at);
        else this.fadeOut(old);
      }
    this.bed = under !== undefined ? (keepBed ?? this.start(under, bedBuffer!, 1)) : undefined;
    this.current = keepBand ?? this.start(track, buffer!, this.levels.get(track) ?? 1, at);
    this.duck();
  }
  stop() {
    this.silenceEffects();
    this.cinema.stop();
    ++this.revision;
    this.current = undefined;
    this.bed = undefined;
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
    this.current = undefined;
    this.bed = undefined;
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
