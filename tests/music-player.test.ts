import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TownPlayer } from '../src/music/player';
import { renderTrack } from '../src/music/synth';
vi.mock('../src/music/synth', () => ({ renderTrack: vi.fn() }));

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
  disconnect: ReturnType<typeof vi.fn>;
}[] = [];
const close = vi.fn();
beforeEach(() => {
  sources.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal(
    'AudioContext',
    class {
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
