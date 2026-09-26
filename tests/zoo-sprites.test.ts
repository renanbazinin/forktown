import { describe, expect, it } from 'vitest';
import { drawZooAnimal } from '../src/city/zoo-animals';
import {
  ZOO_SLEEP,
  zooAnimalsAt,
  type ZooAction,
  type ZooAnimal,
  type ZooAnimalState,
} from '../src/lib/zoo';
import { recordingContext, type RecordedCall } from './recording-context';

const SPECIES: ZooAnimal[] = ['elephant', 'giraffe', 'zebra', 'penguin'];
const ANTICS: Record<ZooAnimal, ZooAction[]> = {
  elephant: ['approach', 'drink', 'raise-trunk', 'spray', 'lower-trunk', 'return'],
  giraffe: ['approach', 'stretch', 'nibble', 'return'],
  zebra: ['approach', 'run', 'skid', 'return'],
  penguin: ['approach', 'crouch', 'dive', 'splash', 'swim', 'hop-out', 'return'],
};
const state = (species: ZooAnimal, patch: Partial<ZooAnimalState> = {}): ZooAnimalState => ({
  id: `${species}-0`,
  species,
  position: { x: 20, y: 62 },
  facing: 1,
  step: 0,
  lift: 0,
  tilt: 0,
  stretch: 0,
  submerged: 0,
  sleeping: false,
  rest: 0,
  sleepPhase: 1.3,
  moving: false,
  graze: 0,
  look: 0,
  ear: 0,
  tail: 0,
  blink: false,
  swim: 0,
  ...patch,
});
const draw = (a: ZooAnimalState, night = false) => {
  const { ctx, calls } = recordingContext();
  drawZooAnimal(ctx, a, night);
  return calls;
};
// Every pose a sprite can be asked for, including the in-between ones.
const poses = (species: ZooAnimal) => [
  ...[-1, -0.4, 0, 0.6, 1].map((step) => state(species, { moving: true, step })),
  ...[0.5, 1].map((graze) => state(species, { graze })),
  ...[-1, -0.5, 0.5, 1].map((look) => state(species, { look })),
  state(species, { ear: 1, tail: -1, blink: true }),
  state(species, { tail: 1, facing: -1 }),
  state(species, { rest: 0.4, sleepPhase: 2 }),
  state(species, { rest: 1, sleeping: true, facing: -1 }),
  state(species, { swim: 0.5, submerged: 0.3 }),
  state(species, { swim: 1, submerged: 0.2 }),
  ...ANTICS[species].flatMap((phase) =>
    [0, 0.5, 1].map((progress) =>
      state(species, {
        action: { phase, elapsed: progress * 4, progress },
        stretch: phase === 'crouch' ? -4 : phase === 'nibble' ? 24 : 0,
        lift: phase === 'dive' ? 30 : phase === 'run' ? 4 : 0,
        tilt: phase === 'skid' ? -0.12 : 0,
        moving: phase === 'run' || phase === 'approach',
        step: 0.7,
      }),
    ),
  ),
];
const finite = (calls: RecordedCall[]) =>
  calls.every((call) => call.args.every((arg) => typeof arg !== 'number' || Number.isFinite(arg)));

describe('Zoo animal sprites', () => {
  it('stay within the canvas-call budget across two town days', () => {
    let total = 0,
      animals = 0,
      most = 0;
    for (const day of [0, 1])
      for (let minute = 0; minute < 1440; minute += 3.7) {
        for (const a of zooAnimalsAt(minute, day)) {
          const count = draw(a, minute < 360).length;
          total += count;
          most = Math.max(most, count);
          animals++;
        }
      }
    expect(total / animals).toBeLessThanOrEqual(45);
    expect(most).toBeLessThan(120);
  });

  it('draws every pose with finite numbers, day and night', () => {
    for (const species of SPECIES)
      for (const a of poses(species))
        for (const night of [false, true]) {
          const calls = draw(a, night);
          expect(finite(calls)).toBe(true);
          expect(calls.filter((call) => call.name === 'fillRect').length).toBeGreaterThan(9);
        }
  });

  it('paints the same picture for the same state', () => {
    for (const species of SPECIES)
      for (const a of poses(species)) expect(draw(a)).toEqual(draw(structuredClone(a)));
  });

  it('keeps the legs planted while the animal stands', () => {
    for (const species of SPECIES) {
      const still = draw(state(species));
      for (const step of [-1, -0.3, 0.8]) expect(draw(state(species, { step }))).toEqual(still);
      expect(draw(state(species, { moving: true, step: 1 }))).not.toEqual(still);
    }
  });

  it('writes the sleepy z letters the right way round whichever way the sleeper faces', () => {
    for (const species of SPECIES)
      for (const facing of [1, -1]) {
        const calls = draw(state(species, { rest: 1, sleeping: true, facing }));
        const stack: number[] = [];
        let sign = 1;
        const letters: number[] = [];
        for (const call of calls) {
          if (call.name === 'save') stack.push(sign);
          if (call.name === 'restore') sign = stack.pop() ?? 1;
          if (call.name === 'scale') sign *= Math.sign(call.args[0] as number);
          if (call.name === 'fillText') letters.push(sign);
        }
        expect(letters.length).toBeGreaterThan(0);
        expect(letters.every((s) => s === 1)).toBe(true);
      }
  });

  it('lies down and gets up through opaque key poses, never a see-through double exposure', () => {
    for (const species of SPECIES)
      for (const rest of [0.1, 0.3, 0.4, 0.55, 0.69, 0.7, 0.85, 0.99]) {
        const { ctx, calls } = recordingContext();
        const alphas: number[] = [];
        const watched = new Proxy(ctx, {
          get(target, key) {
            const value = Reflect.get(target, key);
            if (key !== 'fillRect') return value;
            return (...args: number[]) => {
              alphas.push(target.globalAlpha);
              return (value as (...a: number[]) => void)(...args);
            };
          },
          set: (target, key, value) => Reflect.set(target, key, value),
        });
        drawZooAnimal(watched, state(species, { rest, sleepPhase: 2 }), false);
        expect(alphas.length).toBeGreaterThan(9);
        expect(alphas.every((alpha) => alpha === 1)).toBe(true);
        // No sleepy letters until the animal is actually asleep.
        expect(calls.some((call) => call.name === 'fillText')).toBe(false);
      }
  });

  it('fades the z letters in once the zoo drops off and keeps a huddle to a few', () => {
    const letters = (minute: number) =>
      zooAnimalsAt(minute, 2).map((a) => draw(a, true).filter((c) => c.name === 'fillText').length);
    expect(letters(119.9).every((n) => n === 0)).toBe(true);
    expect(letters(ZOO_SLEEP.start).every((n) => n === 0)).toBe(true);
    const asleep = zooAnimalsAt(180, 2);
    const counts = letters(180);
    const penguins = counts.filter((_, i) => asleep[i].species === 'penguin');
    expect(penguins.filter((n) => n > 0).length).toBeLessThanOrEqual(2);
    expect(counts.filter((n) => n > 0).length).toBeGreaterThanOrEqual(8);
    expect(letters(ZOO_SLEEP.end).every((n) => n === 0)).toBe(true);
  });

  it('only rings the water once a diving penguin has come down', () => {
    const rings = (a: ZooAnimalState) => draw(a).filter((c) => c.name === 'stroke').length;
    const clips = (a: ZooAnimalState) => draw(a).filter((c) => c.name === 'clip').length;
    const flying = state('penguin', {
      swim: 0.6,
      lift: 30,
      tilt: 0.4,
      action: { phase: 'dive', elapsed: 1.7, progress: 0.85 },
    });
    expect(rings(flying)).toBe(0);
    expect(clips(flying)).toBe(0);
    expect(draw(flying).some((c) => c.name === 'ellipse')).toBe(true);
    const landed = { ...flying, lift: 0 };
    expect(rings(landed)).toBeGreaterThan(0);
    expect(clips(landed)).toBe(1);
  });

  it('turns the elephant face on when it looks at the viewer', () => {
    const eyes = (look: number) =>
      draw(state('elephant', { look })).filter(
        (c) => c.name === 'fillRect' && c.fillStyle === '#26332E',
      ).length;
    expect(eyes(0)).toBe(1);
    expect(eyes(1)).toBe(2);
  });

  it('keeps the moonlit palette cool: no amber at night', () => {
    const warm = (color: unknown) => {
      const hex = typeof color === 'string' ? /^#([0-9a-f]{6})/i.exec(color)?.[1] : undefined;
      if (!hex) return false;
      const [r, , b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return r - b > 40;
    };
    for (const species of SPECIES)
      for (const a of poses(species)) {
        const fills = draw(a, true)
          .filter((call) => call.name === 'fillRect')
          .map((call) => call.fillStyle);
        expect(fills.filter(warm)).toEqual([]);
      }
  });
});
