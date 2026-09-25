import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FOOTBALL_SOUND_KINDS,
  FOOTBALL_SOUND_TAKES,
  footballSoundsBetween,
  renderFootballSound,
} from '../src/music/football-sound';
import { footballAt, type FootballSound, type FootballState } from '../src/lib/football';
import { TownPlayer } from '../src/music/player';
import { renderFootballTakes } from '../src/music/synth';

vi.mock('../src/music/synth', () => ({
  renderTrack: vi.fn(),
  renderCinemaTrack: vi.fn(),
  renderFootballTakes: vi.fn(),
}));

type Kind = FootballSound['kind'];
const takes = FOOTBALL_SOUND_KINDS.flatMap((kind) =>
  Array.from({ length: FOOTBALL_SOUND_TAKES[kind] }, (_, take) => [kind, take] as const),
);
const seconds: Record<Kind, [number, number]> = {
  kick: [0.12, 0.35],
  whistle: [0.25, 0.6],
  'final-whistle': [1.3, 1.8],
  cheer: [1.7, 2.5],
  ooh: [1.1, 1.6],
  applause: [1.5, 2.1],
  post: [0.45, 0.8],
};
/** Loudest RMS over a sliding window. */
const loudest = (data: Float32Array, rate: number, window = 0.05) => {
  const size = Math.round(rate * window);
  let energy = 0,
    best = 0;
  for (let i = 0; i < data.length; i++) {
    energy += data[i] ** 2 - (i >= size ? data[i - size] ** 2 : 0);
    best = Math.max(best, energy);
  }
  return Math.sqrt(best / size);
};
/** Upward zero crossings per second between two times: a rough dominant pitch. */
const crossings = (data: Float32Array, rate: number, from: number, to: number) => {
  let count = 0;
  for (let i = Math.round(from * rate) + 1; i < to * rate; i++)
    if (data[i - 1] < 0 && data[i] >= 0) count++;
  return count / (to - from);
};
/** Runs of 10 ms frames whose peak clears a threshold: blasts, claps, bursts. */
const bursts = (data: Float32Array, rate: number, threshold: number) => {
  const frame = Math.round(rate * 0.01),
    runs: number[] = [];
  let run = 0;
  for (let i = 0; i < data.length; i += frame) {
    let peak = 0;
    for (let j = i; j < Math.min(data.length, i + frame); j++)
      peak = Math.max(peak, Math.abs(data[j]));
    if (peak >= threshold) run++;
    else if (run) {
      runs.push(run);
      run = 0;
    }
  }
  if (run) runs.push(run);
  return runs;
};

describe('Football sound effects', () => {
  it.each(takes)(
    'synthesizes a finite, bounded, audible %s (take %i) with a quiet tail',
    (kind, take) => {
      for (const rate of [12000, 44100]) {
        const data = renderFootballSound(kind, rate, take);
        const duration = data.length / rate;
        expect(duration).toBeGreaterThanOrEqual(seconds[kind][0]);
        expect(duration).toBeLessThanOrEqual(seconds[kind][1]);
        expect(data.every((n) => Number.isFinite(n) && Math.abs(n) <= 1)).toBe(true);
        expect(data.some((n) => Math.abs(n) > 0.1)).toBe(true);
        expect(Math.abs(data.at(-1)!)).toBeLessThan(0.015);
        expect(loudest(data.subarray(-Math.round(rate * 0.01)), rate, 0.01)).toBeLessThan(0.015);
        // It starts at once: the cue lands on the frame that triggers it.
        expect(loudest(data.subarray(0, Math.round(rate * 0.12)), rate, 0.01)).toBeGreaterThan(
          0.01,
        );
        expect(renderFootballSound(kind, rate, take)).toEqual(data);
      }
    },
  );

  it('gives each take its own performance', () => {
    for (const kind of FOOTBALL_SOUND_KINDS) {
      const first = renderFootballSound(kind, 12000, 0);
      for (let take = 1; take < FOOTBALL_SOUND_TAKES[kind]; take++)
        expect(renderFootballSound(kind, 12000, take)).not.toEqual(first);
    }
    expect(renderFootballSound('kick', 12000)).toEqual(renderFootballSound('kick', 12000, 0));
  });

  it('keeps every effect on one strength scale, with the crowd never over the play', () => {
    const level = Object.fromEntries(
      takes.map(([kind, take]) => [
        `${kind}:${take}`,
        loudest(renderFootballSound(kind, 44100, take), 44100),
      ]),
    );
    for (const value of Object.values(level)) {
      expect(value).toBeGreaterThan(0.08);
      expect(value).toBeLessThan(0.35);
    }
    for (const crowd of ['cheer', 'ooh', 'applause'])
      for (let take = 0; take < FOOTBALL_SOUND_TAKES[crowd as Kind]; take++) {
        expect(level[`${crowd}:${take}`]).toBeLessThan(level['kick:0']);
        expect(level[`${crowd}:${take}`]).toBeLessThan(level['post:0']);
      }
    // The whistle is the brightest sound; it stays below the crowd in raw level.
    expect(level['whistle:0']).toBeLessThan(level['cheer:0']);
  });

  it('shapes each effect like the real thing', () => {
    const rate = 44100,
      sound = (kind: Kind) => renderFootballSound(kind, rate);
    // A pea whistle around 2.5 kHz whose pea warbles the level about 30 times a second.
    const whistle = sound('whistle');
    const pitch = crossings(whistle, rate, 0.05, 0.2);
    expect(pitch).toBeGreaterThan(2200);
    expect(pitch).toBeLessThan(2800);
    const frame = Math.round(rate * 0.002),
      envelope: number[] = [];
    for (let i = Math.round(rate * 0.04); i < rate * 0.2; i += frame)
      envelope.push(Math.max(...whistle.subarray(i, i + frame).map(Math.abs)));
    const dips = envelope.filter(
      (v, i) => i > 0 && i < envelope.length - 1 && v < envelope[i - 1] && v <= envelope[i + 1],
    ).length;
    expect(dips).toBeGreaterThanOrEqual(3);
    expect(Math.min(...envelope) / Math.max(...envelope)).toBeLessThan(0.7);
    // Peep, peep, peeeep.
    const blasts = bursts(sound('final-whistle'), rate, 0.03);
    expect(blasts).toHaveLength(3);
    expect(blasts[2]).toBeGreaterThan(blasts[0] * 2.5);
    expect(blasts[2]).toBeGreaterThan(blasts[1] * 2.5);
    // A low leather thud, not a click.
    expect(crossings(sound('kick'), rate, 0.005, 0.1)).toBeLessThan(600);
    // "Ooh" is darker than a cheer; both stay out of the piercing range.
    const ooh = crossings(sound('ooh'), rate, 0.2, 1),
      cheer = crossings(sound('cheer'), rate, 0.2, 1.5);
    expect(ooh).toBeLessThan(cheer);
    expect(ooh).toBeLessThan(900);
    expect(cheer).toBeLessThan(2000);
    // The cheer swells into its peak, then settles.
    const roar = sound('cheer'),
      part = (a: number, b: number) =>
        loudest(roar.subarray(Math.round(a * rate), Math.round(b * rate)), rate, 0.2);
    expect(part(0.3, 0.9)).toBeGreaterThan(part(0, 0.2));
    expect(part(0.3, 0.9)).toBeGreaterThan(part(1.6, 2.1) * 1.8);
    // Applause is many separate hands, thinning out as it fades.
    const applause = sound('applause');
    expect(bursts(applause, rate, 0.05).length).toBeGreaterThan(8);
    const early = loudest(applause.subarray(0, rate * 0.6), rate, 0.3),
      late = loudest(applause.subarray(Math.round(rate * 1.3)), rate, 0.3);
    expect(late).toBeLessThan(early * 0.6);
    // The post keeps ringing after a kick would have died away.
    const tail = (data: Float32Array) =>
      loudest(data.subarray(Math.round(rate * 0.2), Math.round(rate * 0.25)), rate, 0.05);
    expect(tail(sound('post'))).toBeGreaterThan(tail(sound('kick')) * 5);
  });
});

const cue = (at: number, kind: Kind = 'kick', strength = 0.6): FootballSound => ({
  at,
  kind,
  strength,
});
const state = (elapsed: number, sounds: FootballSound[], over: Partial<FootballState> = {}) =>
  ({ live: true, day: 3, match: 2, elapsed, sounds, ...over }) as FootballState;

describe('Football sound cues between frames', () => {
  const sounds = [
    cue(1),
    cue(2, 'whistle', 0.5),
    cue(2.3),
    cue(2.3, 'ooh', 0.7),
    cue(4, 'cheer', 0.8),
  ];

  it('plays the cues after the previous frame up to and including this one', () => {
    expect(footballSoundsBetween(state(0.9, sounds), state(1, sounds))).toEqual([cue(1)]);
    expect(footballSoundsBetween(state(1, sounds), state(1.1, sounds))).toEqual([]);
    expect(footballSoundsBetween(state(1.9, sounds), state(2.3, sounds))).toEqual([
      cue(2, 'whistle', 0.5),
      cue(2.3),
      cue(2.3, 'ooh', 0.7),
    ]);
  });

  it('never replays after a seek, a rejoin, a pause, or a new match or day', () => {
    const now = state(2.1, sounds);
    expect(footballSoundsBetween(null, now)).toEqual([]);
    expect(footballSoundsBetween(now, now)).toEqual([]);
    expect(footballSoundsBetween(state(2.2, sounds), now)).toEqual([]);
    expect(footballSoundsBetween(state(1.5, sounds), now)).toEqual([]);
    expect(footballSoundsBetween(state(1.6, sounds), now)).toHaveLength(1);
    expect(footballSoundsBetween(state(1.9, sounds, { match: 1 }), now)).toEqual([]);
    expect(footballSoundsBetween(state(1.9, sounds, { day: 2 }), now)).toEqual([]);
    expect(footballSoundsBetween(state(1.9, sounds), state(2.1, sounds, { live: false }))).toEqual(
      [],
    );
    // The last cues of one match never spill into the next kickoff.
    const end = [cue(139.95, 'applause')];
    expect(
      footballSoundsBetween(state(139.9, end, { match: 1 }), state(0.02, [cue(0.01, 'whistle')])),
    ).toEqual([]);
  });

  it('plays a burst of same-kind cues once, at the loudest strength', () => {
    const burst = [cue(5, 'kick', 0.4), cue(5.03, 'kick', 0.9), cue(5.03, 'cheer', 0.7)];
    const due = footballSoundsBetween(state(4.9, burst), state(5.1, burst));
    expect(due).toEqual([cue(5, 'kick', 0.9), cue(5.03, 'cheer', 0.7)]);
    expect(burst[0].strength).toBe(0.4);
    // Split across two frames, the follower still does not sound a second time.
    expect(footballSoundsBetween(state(4.99, burst), state(5.01, burst))).toEqual([
      cue(5, 'kick', 0.4),
    ]);
    expect(footballSoundsBetween(state(5.01, burst), state(5.04, burst))).toEqual([
      cue(5.03, 'cheer', 0.7),
    ]);
    // Cues far enough apart are separate touches, even in a long run.
    const run = [cue(7), cue(7.05), cue(7.1), cue(7.2)];
    expect(footballSoundsBetween(state(6.9, run), state(7.3, run)).map((s) => s.at)).toEqual([
      7, 7.1, 7.2,
    ]);
  });

  it('hears the same cues whatever the frame rate', () => {
    const busy = Array.from({ length: 80 }, (_, i) =>
      cue(
        0.3 + i * 0.37 + (i % 4 === 0 ? 0 : (i % 7) * 0.013),
        (['kick', 'kick', 'ooh', 'post', 'cheer'] as const)[i % 5],
        0.3 + (i % 5) * 0.1,
      ),
    ).sort((a, b) => a.at - b.at);
    const heard = (step: number) => {
      const out: FootballSound[] = [];
      for (let t = 0; t + step <= 32; t += step)
        out.push(...footballSoundsBetween(state(t, busy), state(t + step, busy)));
      return out.map((s) => `${s.kind}@${s.at.toFixed(3)}`);
    };
    const reference = heard(1 / 60);
    expect(reference.length).toBeGreaterThan(50);
    expect(heard(1 / 24)).toEqual(reference);
    expect(heard(0.25)).toEqual(reference);
    expect(new Set(reference).size).toBe(reference.length);
  });

  it('plays each cue of a live match at most once from frame to frame', () => {
    const start = 360 + 140;
    const heard: FootballSound[] = [];
    let previous: FootballState | null = null;
    for (let t = 0; t < 140; t += 0.4) {
      const now = footballAt(start + t);
      heard.push(...footballSoundsBetween(previous, now));
      previous = now;
    }
    const final = footballAt(start + 139.9);
    const keys = heard.map((s) => `${s.kind}@${s.at}`);
    expect(new Set(keys).size).toBe(keys.length);
    const cue = (s: FootballSound) => `${s.kind}@${s.at}`;
    const match = new Set(final.sounds.map(cue));
    expect(heard.every((s) => match.has(cue(s)))).toBe(true);
    // Every cue of the match up to the last frame is heard, unless it rode on a cue of the
    // same kind a moment before it (a burst plays once).
    const until = previous!.elapsed;
    const missed = final.sounds.filter(
      (s) =>
        s.at > 0.1 &&
        s.at <= until &&
        !heard.some((h) => h.kind === s.kind && s.at - h.at >= 0 && s.at - h.at < 0.06),
    );
    expect(missed).toEqual([]);
    expect(heard.length).toBeGreaterThan(final.sounds.length / 2);
    expect(heard.some((s) => s.kind === 'kick')).toBe(true);
    // Rolling into the next match carries nothing over.
    expect(footballSoundsBetween(final, footballAt(start + 140.1))).toEqual([]);
  });
});

describe('Football effect playback', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const stub = () => {
    const buffers: number[] = [];
    vi.stubGlobal(
      'AudioContext',
      class {
        currentTime = 0;
        state = 'running';
        sampleRate = 12000;
        destination = {};
        resume = vi.fn().mockResolvedValue(undefined);
        close = vi.fn().mockResolvedValue(undefined);
        createBuffer(_: number, length: number) {
          buffers.push(length);
          return { copyToChannel: vi.fn() };
        }
        createGain() {
          return {
            gain: { value: 0, setTargetAtTime: vi.fn() },
            connect: vi.fn().mockReturnThis(),
            disconnect: vi.fn(),
          };
        }
        createStereoPanner() {
          return { pan: { value: 0 }, connect: vi.fn().mockReturnThis(), disconnect: vi.fn() };
        }
        createBufferSource() {
          return {
            start: vi.fn(),
            stop: vi.fn(),
            connect: vi.fn().mockReturnThis(),
            disconnect: vi.fn(),
          };
        }
      },
    );
    return buffers;
  };

  it('rotates through the rendered takes and caches every one of any length', () => {
    const buffers = stub(),
      player = new TownPlayer();
    for (let i = 0; i < 6; i++) player.effect('kick', 0.5, 0);
    expect(buffers).toHaveLength(FOOTBALL_SOUND_TAKES.kick);
    player.effect('final-whistle', 0.5, 0);
    player.effect('final-whistle', 0.5, 0);
    expect(buffers).toHaveLength(FOOTBALL_SOUND_TAKES.kick + 1);
    expect(buffers.at(-1)).toBe(renderFootballSound('final-whistle', 12000).length);
    player.dispose();
  });

  it('prepares every take in a worker once sound is on, and keeps nothing after disposal', async () => {
    const rendered = new Map(
      takes.map(([kind, take]) => [`${kind}:${take}`, renderFootballSound(kind, 12000, take)]),
    );
    let finish!: (value: Map<string, Float32Array>) => void;
    vi.mocked(renderFootballTakes).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const buffers = stub(),
      player = new TownPlayer(),
      late = new TownPlayer();
    await player.resume();
    await late.resume();
    // One worker per player; nothing is synthesized on the main thread while it works.
    expect(renderFootballTakes).toHaveBeenCalledTimes(2);
    expect(renderFootballTakes).toHaveBeenLastCalledWith(12000);
    expect(buffers).toHaveLength(0);
    late.dispose();
    finish(rendered);
    await vi.waitFor(() => expect(buffers).toHaveLength(takes.length));
    await player.resume();
    expect(renderFootballTakes).toHaveBeenCalledTimes(2);
    player.effect('cheer', 0.5, 0);
    expect(buffers).toHaveLength(takes.length);
    player.dispose();
  });

  it('still plays a take on demand when the worker cannot help', async () => {
    vi.mocked(renderFootballTakes).mockRejectedValue(new Error('no worker'));
    const buffers = stub(),
      player = new TownPlayer();
    await player.resume();
    await Promise.resolve();
    expect(buffers).toHaveLength(0);
    player.effect('post', 0.5, 0);
    expect(buffers).toEqual([renderFootballSound('post', 12000).length]);
    player.dispose();
  });
});
