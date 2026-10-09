import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bedLevel, TownPlayer } from '../src/music/player';
import { durationOf, phraseOf } from '../src/music/score';
import { renderTrack, renderCinemaTrack } from '../src/music/synth';
import { CINEMA_FILMS } from '../src/lib/cinema';
vi.mock('../src/music/synth', () => ({
  renderTrack: vi.fn(),
  renderCinemaTrack: vi.fn(),
  renderFootballTakes: vi.fn(() => new Promise(() => {})),
}));

const parameter = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
  cancelAndHoldAtTime: vi.fn(),
});
const sources: {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}[] = [];
/** The gain node a source plays through (its first connection). */
const gainOf = (source: (typeof sources)[number]) =>
  source.connect.mock.calls[0][0] as { gain: ReturnType<typeof parameter> };
/** The last level a gain was eased or ramped to, whichever came last. */
const lastTarget = (gain: { gain: ReturnType<typeof parameter> }) => {
  const last = (mock: ReturnType<typeof vi.fn>) => ({
    order: mock.mock.invocationCallOrder.at(-1) ?? -1,
    value: mock.mock.calls.at(-1)?.[0] as number,
  });
  const eased = last(gain.gain.setTargetAtTime),
    ramped = last(gain.gain.linearRampToValueAtTime);
  return eased.order > ramped.order ? eased.value : ramped.value;
};
const close = vi.fn();
/** Every mocked AudioContext, so a test can move its clock. */
const contexts: { currentTime: number }[] = [];
beforeEach(() => {
  sources.length = 0;
  contexts.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        contexts.push(this);
      }
      currentTime = 10;
      state = 'running';
      sampleRate = 12000;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      suspend = vi.fn().mockResolvedValue(undefined);
      close = close.mockResolvedValue(undefined);
      createBuffer() {
        return { copyToChannel: vi.fn() };
      }
      createStereoPanner() {
        return { pan: parameter(), connect: vi.fn().mockReturnThis(), disconnect: vi.fn() };
      }
      createGain() {
        return { gain: parameter(), connect: vi.fn().mockReturnThis(), disconnect: vi.fn() };
      }
      createBufferSource() {
        const source = {
          start: vi.fn(),
          stop: vi.fn(),
          connect: vi.fn().mockReturnThis(),
          disconnect: vi.fn(),
        };
        sources.push(source);
        return source;
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
const buffer = {} as AudioBuffer;

describe('Soundtrack playback lifecycle', () => {
  it.each(['suspend', 'stop', 'dispose'] as const)(
    'stops the film soundtrack when the town player calls %s',
    async (action) => {
      vi.mocked(renderCinemaTrack).mockResolvedValue(buffer);
      const player = new TownPlayer();
      player.cinemaSound({
        film: CINEMA_FILMS[0],
        key: 'night:popcorn',
        elapsed: 18,
        gain: 0.8,
        pan: 0,
      });
      await Promise.resolve();
      expect(sources[0].start).toHaveBeenCalledWith(10, 18);
      expect(player.cinemaStatus).toBe('playing');
      await player[action]();
      expect(sources[0].stop).toHaveBeenCalled();
      expect(player.cinemaStatus).toBe('silent');
      if (action !== 'dispose') player.dispose();
    },
  );
  it('stops nearby football sounds on pause, mute, and disposal without replaying them', async () => {
    const player = new TownPlayer();
    player.effect('kick', 0, 0);
    expect(sources).toHaveLength(0);
    player.effect('kick', 0.7, 0);
    expect(sources).toHaveLength(1);
    expect(sources[0].start).toHaveBeenCalledOnce();
    await player.suspend();
    expect(sources[0].stop).toHaveBeenCalledOnce();
    expect(sources[0].disconnect).toHaveBeenCalledOnce();
    await player.resume();
    expect(sources).toHaveLength(1);
    player.effect('cheer', 0.5, 0.4);
    player.stop();
    expect(sources[1].stop).toHaveBeenCalledOnce();
    player.effect('whistle', 0.5, 0);
    player.dispose();
    expect(sources[2].disconnect).toHaveBeenCalledOnce();
    player.effect('kick', 0.7, 0);
    expect(sources).toHaveLength(3);
  });
  it('does not start a late render after the user mutes', async () => {
    let finish!: (buffer: AudioBuffer) => void;
    vi.mocked(renderTrack).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const player = new TownPlayer();
    const pending = player.play('town');
    player.stop();
    finish(buffer);
    await pending;
    expect(sources).toHaveLength(0);
    player.dispose();
    expect(close).toHaveBeenCalledOnce();
  });
  it('keeps the current song when a pending change is superseded', async () => {
    let finish!: (buffer: AudioBuffer) => void;
    vi.mocked(renderTrack)
      .mockResolvedValueOnce(buffer)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
    const player = new TownPlayer();
    await player.play('town');
    const pending = player.play('rock');
    await player.play('town');
    finish(buffer);
    await pending;
    expect(sources).toHaveLength(1);
    player.dispose();
  });
  it('mutes every source during a crossfade and closes its context on disposal', async () => {
    vi.mocked(renderTrack).mockResolvedValue(buffer);
    const player = new TownPlayer();
    await player.play('town');
    await player.play('jazz');
    player.stop();
    expect(sources).toHaveLength(2);
    for (const source of sources) expect(source.stop).toHaveBeenLastCalledWith(10.2);
    player.dispose();
    for (const source of sources) expect(source.disconnect).toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
  it('never starts a render that completes after disposal', async () => {
    let finish!: (buffer: AudioBuffer) => void;
    vi.mocked(renderTrack).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const player = new TownPlayer();
    const pending = player.play('night');
    player.dispose();
    finish(buffer);
    await pending;
    expect(sources).toHaveLength(0);
  });
});

describe('A band at the Bandstand', () => {
  it('plays over the town’s tune, which a band heard from afar barely touches', async () => {
    vi.mocked(renderTrack).mockResolvedValue(buffer);
    const player = new TownPlayer();
    await player.play('town');
    const town = sources[0];
    // The whole town at fit on a big screen hears the band at about 0.04.
    player.level('folk', 0.04, 0.3);
    await player.play('folk', 'town');
    expect(sources).toHaveLength(2);
    const band = sources[1];
    expect(lastTarget(gainOf(band))).toBeCloseTo(0.04);
    expect(lastTarget(gainOf(town))).toBeGreaterThanOrEqual(0.9);
    expect(lastTarget(gainOf(town))).toBeCloseTo(bedLevel(0.04));
    expect(town.stop).not.toHaveBeenCalled();
    // Panned toward the stand (the mock's connect returns the source, so the chain's second link
    // is the panner).
    const panner = band.connect.mock.calls[1][0] as { pan: { value: number } };
    expect(panner.pan.value).toBeCloseTo(0.3);
    // At the stand the band is almost all there is.
    player.level('folk', 1, 0);
    expect(lastTarget(gainOf(band))).toBe(1);
    expect(lastTarget(gainOf(town))).toBeLessThanOrEqual(0.1);
    // The set ends: the band fades and the same tune comes back up, never restarted.
    await player.play('town');
    expect(sources).toHaveLength(2);
    expect(band.stop).toHaveBeenCalled();
    expect(town.stop).not.toHaveBeenCalled();
    expect(lastTarget(gainOf(town))).toBe(1);
    player.dispose();
  });

  it('starts the town’s tune under a band when sound is turned on during a set', async () => {
    vi.mocked(renderTrack).mockResolvedValue(buffer);
    const player = new TownPlayer();
    player.level('brass', 0.05);
    await player.play('brass', 'night');
    expect(sources).toHaveLength(2);
    expect(
      vi
        .mocked(renderTrack)
        .mock.calls.map(([track]) => track)
        .sort(),
    ).toEqual(['brass', 'night']);
    const [night, band] = [sources[0], sources[1]];
    expect(lastTarget(gainOf(band))).toBeCloseTo(0.05);
    expect(lastTarget(gainOf(night))).toBeGreaterThanOrEqual(0.88);
    // A stage show takes over from both.
    await player.play('party');
    expect(night.stop).toHaveBeenCalled();
    expect(band.stop).toHaveBeenCalled();
    player.stop();
    player.dispose();
  });
});

describe('The town’s tunes through the day', () => {
  it('hands one tune to the next at the end of a phrase, never mid-line', async () => {
    vi.mocked(renderTrack).mockResolvedValue(buffer);
    const player = new TownPlayer();
    await player.play('sunrise');
    const sunrise = sources[0];
    expect(sunrise.start).toHaveBeenCalledWith(10);
    // Three seconds in, the clock reaches the next tune's hour.
    contexts[0].currentTime = 13;
    await player.play('morning');
    const morning = sources[1];
    const end = 10 + phraseOf('sunrise');
    expect(morning.start.mock.calls[0][0]).toBeCloseTo(end);
    expect(player.handoff).toBeCloseTo(end - 13);
    expect(player.position?.track).toBe('morning');
    // The outgoing tune fades over the phrase's last moments; the next comes in as it ends.
    const [target, from] = gainOf(sunrise).gain.setTargetAtTime.mock.calls.at(-1)!;
    expect(target).toBe(0);
    expect(from).toBeCloseTo(end - 0.9);
    expect(sunrise.stop.mock.calls.at(-1)![0]).toBeCloseTo(end + 1.5);
    expect(gainOf(morning).gain.linearRampToValueAtTime.mock.calls.at(-1)![1]).toBeCloseTo(
      end + 0.25,
    );
    // Another change before then replaces the waiting tune, which never starts, at the same end.
    await player.play('town');
    expect(morning.stop).toHaveBeenCalledWith(13);
    expect(sources[2].start.mock.calls[0][0]).toBeCloseTo(end);
    // The listening room's picks switch at once.
    await player.play('midday', undefined, 'now');
    expect(sources[3].start).toHaveBeenCalledWith(13);
    expect(player.handoff).toBe(0);
    player.dispose();
  });
  it('switches at once for a stage show, and knows where in its loop a tune is', async () => {
    vi.mocked(renderTrack).mockResolvedValue(buffer);
    const player = new TownPlayer();
    await player.play('goldenhour');
    contexts[0].currentTime = 10 + durationOf('goldenhour') + 2;
    expect(player.position?.seconds).toBeCloseTo(2);
    await player.play('jazz');
    expect(sources[1].start).toHaveBeenCalledWith(contexts[0].currentTime);
    expect(player.handoff).toBe(0);
    player.dispose();
  });
  it('renders the next tune ahead of its turn', () => {
    vi.mocked(renderTrack).mockResolvedValue(buffer);
    const player = new TownPlayer();
    player.prepare('teatime');
    expect(renderTrack).toHaveBeenCalledWith('teatime');
    player.dispose();
  });
});
