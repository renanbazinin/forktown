import { FLASH_MOB_SECONDS, type FlashMobTrack } from '../lib/flash-mob-beat';
import { renderTrack } from './synth';

/** What the camera hears of Fountain Square's flash mob at this moment. */
export type FlashMobPlayback = {
  /**
   * Town minutes since 17:00, which are seconds into the track. Negative a moment before it
   * (down to −FLASH_MOB_PREROLL), so the first downbeat can be scheduled to land exactly.
   */
  elapsed: number;
  /** One mob: a new key (another day) starts the track afresh. */
  key: string;
  /** The day's record: its week's (flashMobTrackOn). */
  track: FlashMobTrack;
  /** How loud, 0..1 (squareListening). */
  gain: number;
  /** Where the square sits on screen, −1..1. */
  pan: number;
};

/** Seconds before 17:00 from which a sync schedules the track's start instead of waiting. */
export const FLASH_MOB_PREROLL = 2;
/** How far the music may drift from the clock before it is put back in step: under a 16th. */
const TOLERANCE = 0.08;
/** A drift this large (a stall, a jump of the clock) is followed at once. */
const LEAP = 0.5;
/** The stretch of syncs a drift must hold over before the music is moved for it. */
const WINDOW = 0.5;
/** A fade on every start or restart past the very beginning, and on every stop: no clicks. */
const FADE_IN = 0.012,
  FADE_OUT = 0.03;

/**
 * Plays the flash mob's music (the day's record, FLASH_MOB_TRACKS) in step with the town clock, like
 * the cinema's films: one non-looping buffer, started at the clock's offset (mid-way too) and
 * moved back in step when it drifts, at the camera's gain and pan. While it plays it asks the
 * town's music to duck under it (`duck`), as the cinema does. Shares the town's AudioContext.
 */
export class FlashMobPlayer {
  private gain: GainNode;
  private pan: StereoPannerNode;
  /** The record rendered (or rendering), and its render: one at a time, the day's. */
  private track?: FlashMobTrack;
  private rendering?: Promise<AudioBuffer>;
  private buffer?: AudioBuffer;
  private latest?: FlashMobPlayback & { sampledAt: number };
  private current?: {
    source: AudioBufferSourceNode;
    envelope: GainNode;
    key: string;
    /** The context time the track's first sample plays at (in the future before 17:00). */
    origin: number;
  };
  /** The music's distance from the clock at recent syncs: [context time, seconds ahead]. */
  private drift: [number, number][] = [];
  private pending?: string;
  private failedKey?: string;
  private disposed = false;
  private sources = new Map<AudioBufferSourceNode, GainNode>();
  constructor(
    private context: AudioContext,
    output: AudioNode,
    private duck: (gain: number) => void,
  ) {
    this.gain = context.createGain();
    this.pan = context.createStereoPanner();
    this.gain.gain.value = 0;
    this.gain.connect(this.pan).connect(output);
  }
  /**
   * Seconds between scheduling a sample and hearing it, so the music is heard with the picture:
   * the context's own and the device's latency where the browser reports them (0 where not),
   * and never more than a third of a second.
   */
  private get latency() {
    const { baseLatency, outputLatency } = this.context as AudioContext & {
      outputLatency?: number;
    };
    const total = (baseLatency || 0) + (outputLatency || 0);
    return Number.isFinite(total) ? Math.max(0, Math.min(0.3, total)) : 0;
  }
  sync(state?: FlashMobPlayback) {
    if (this.disposed) return;
    if (
      !state ||
      state.gain < 0.005 ||
      state.elapsed < -FLASH_MOB_PREROLL ||
      state.elapsed >= FLASH_MOB_SECONDS ||
      this.context.state !== 'running'
    ) {
      this.stop(this.context.state !== 'running');
      return;
    }
    if (this.failedKey === state.key) return;
    const now = this.context.currentTime;
    this.latest = { ...state, sampledAt: now };
    this.gain.gain.setTargetAtTime(Math.min(1, state.gain), now, 0.08);
    this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, state.pan)), now, 0.08);
    if (this.current?.key === state.key && this.inStep(now)) {
      // The town's music ducks once the track is under way, not while its start is scheduled.
      this.duck(now >= this.current.origin ? state.gain : 0);
      return;
    }
    if (this.buffer && this.track === state.track) {
      this.start(this.buffer, now);
      return;
    }
    this.release();
    this.duck(0);
    if (this.pending === state.key) return;
    const key = state.key;
    this.pending = key;
    this.render(state.track)
      .then((buffer) => {
        if (this.pending !== key) return;
        this.pending = undefined;
        if (this.disposed || this.latest?.key !== key || this.context.state !== 'running') return;
        this.start(buffer, this.context.currentTime);
      })
      .catch(() => {
        if (this.pending === key) this.pending = undefined;
        // Leave the town's music as it is; turning sound off and on again retries.
        if (this.latest?.key === key) {
          this.stop();
          this.failedKey = key;
        }
      });
  }
  /**
   * Whether the playing track is in step with the clock. The clock's minute is read a little
   * before each sync runs (a frame's work, more on a slow machine), so a reading only ever makes
   * the track look further ahead than it is: its true distance is about the least of the last
   * WINDOW of readings. It is moved when that is TOLERANCE or more either way, or at once for a
   * leap.
   */
  private inStep(now: number) {
    const { current, latest } = this;
    if (!current || !latest) return false;
    const ahead = now - current.origin - (latest.elapsed + this.latency);
    if (Math.abs(ahead) >= LEAP) return false;
    this.drift.push([now, ahead]);
    // By time, but never fewer than four readings, so a slow page is still judged (over longer).
    while (this.drift.length > 4 && this.drift[0][0] < now - WINDOW) this.drift.shift();
    if (this.drift.length < 4) return true;
    let least = Infinity;
    for (const [, value] of this.drift) least = Math.min(least, value);
    return Math.abs(least) < TOLERANCE;
  }
  /** Starts the track where the clock is now (or schedules its first sample, before 17:00). */
  private start(buffer: AudioBuffer, now: number) {
    const latest = this.latest;
    if (!latest) return;
    const offset = latest.elapsed + (now - latest.sampledAt) + this.latency;
    this.release();
    if (offset >= buffer.duration - 0.05) {
      this.duck(0);
      return;
    }
    const source = this.context.createBufferSource(),
      envelope = this.context.createGain();
    source.buffer = buffer;
    source.loop = false;
    const origin = now - offset;
    const at = Math.max(now, origin);
    // From its first sample the track starts as written; joined mid-way it fades in a hair.
    if (offset > 0.004) {
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(1, at + FADE_IN);
    }
    source.connect(envelope).connect(this.gain);
    this.sources.set(source, envelope);
    source.onended = () => {
      source.disconnect();
      envelope.disconnect();
      this.sources.delete(source);
      if (this.current?.source === source) {
        this.current = undefined;
        this.duck(0);
      }
    };
    source.start(at, Math.max(0, offset));
    this.current = { source, envelope, key: latest.key, origin };
    this.drift = [];
    this.duck(now >= origin ? latest.gain : 0);
  }
  /**
   * Renders the day's record ahead (it takes a few seconds), so it is ready at 17:00. One render,
   * kept until another record is asked for; a failed one is forgotten, so a later call tries again.
   */
  prepare(track: FlashMobTrack) {
    if (!this.disposed) this.render(track).catch(() => {});
  }
  private render(track: FlashMobTrack) {
    if (this.track !== track) {
      this.track = track;
      this.rendering = undefined;
      this.buffer = undefined;
    }
    if (!this.rendering) {
      const rendering = renderTrack(track);
      this.rendering = rendering;
      rendering.then(
        (buffer) => {
          if (this.rendering === rendering && !this.disposed) this.buffer = buffer;
        },
        () => {
          if (this.rendering === rendering) this.rendering = undefined;
        },
      );
    }
    return this.rendering;
  }
  private release() {
    if (!this.current) return;
    const now = this.context.currentTime;
    const { source, envelope } = this.current;
    envelope.gain.cancelAndHoldAtTime(now);
    envelope.gain.linearRampToValueAtTime(0, now + FADE_OUT);
    source.stop(now + FADE_OUT + 0.01);
    this.current = undefined;
  }
  stop(immediate = false) {
    this.latest = undefined;
    this.pending = undefined;
    this.failedKey = undefined;
    this.drift = [];
    if (immediate) {
      for (const [source, envelope] of this.sources) {
        source.stop();
        source.disconnect();
        envelope.disconnect();
      }
      this.sources.clear();
      this.current = undefined;
    } else this.release();
    this.duck(0);
  }
  get status() {
    return this.failedKey
      ? 'error'
      : this.current
        ? 'playing'
        : this.pending
          ? 'preparing'
          : 'silent';
  }
  dispose() {
    this.disposed = true;
    this.stop(true);
    this.rendering = undefined;
    this.buffer = undefined;
    this.gain.disconnect();
    this.pan.disconnect();
  }
}
