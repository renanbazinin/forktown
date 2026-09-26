import { describe, expect, it } from 'vitest';
import {
  ZOO_HABITATS,
  ZOO_QUIRKS,
  zooAnimalsAt,
  zooMomentAt,
  zooPond,
  type ZooAnimal,
} from '../src/lib/zoo';

const species = Object.keys(ZOO_QUIRKS) as ZooAnimal[];
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const startFor = (kind: ZooAnimal, time = 720) => {
  const moment = zooMomentAt(kind, time);
  return moment.start + moment.interval;
};
const actorAt = (kind: ZooAnimal, time: number) =>
  zooAnimalsAt(time).find((a) => a.species === kind && a.action)!;

describe('Zoo bedtime', () => {
  it('sleeps from 2 AM until 4 AM every town day, without walking or antics', () => {
    for (const day of [-1, 0, 1, 9, 100]) {
      const beds = zooAnimalsAt(120, day);
      expect(beds).toHaveLength(14);
      for (const minute of [119.999, 240, 240.001])
        expect(zooAnimalsAt(minute, day).every((a) => !a.sleeping)).toBe(true);
      for (let minute = 120; minute < 240; minute += 0.7) {
        const animals = zooAnimalsAt(minute, day);
        animals.forEach((a, index) => {
          expect(a.sleeping).toBe(true);
          expect(a.rest).toBe(1);
          expect(a.position).toEqual(beds[index].position);
          expect(a.facing).toBe(beds[index].facing);
          expect(a.step).toBe(0);
          expect(a.lift).toBe(0);
          expect(a.submerged).toBe(0);
          expect(a.action).toBeUndefined();
          expect(zooMomentAt(a.species, minute, day).active).toBe(false);
        });
      }
      expect(zooAnimalsAt(1620, day)).toEqual(zooAnimalsAt(180, day + 1));
      expect(zooAnimalsAt(180, day)[0].sleepPhase).not.toBe(beds[0].sleepPhase);
    }
  });

  it('settles and wakes smoothly and skips entire antics that overlap bedtime', () => {
    for (let day = 0; day < 20; day++) {
      for (const minute of [112, 120, 240, 248]) {
        const before = zooAnimalsAt(minute - 0.0001, day);
        const after = zooAnimalsAt(minute + 0.0001, day);
        before.forEach((a, index) => {
          expect(distance(a.position, after[index].position)).toBeLessThan(0.002);
          expect(Math.abs(a.rest - after[index].rest)).toBeLessThan(0.002);
          if (minute === 120 || minute === 240) {
            expect(a.action).toBeUndefined();
            expect(after[index].action).toBeUndefined();
          }
        });
      }
      for (const kind of species) {
        for (let minute = 82; minute < 248; minute++) {
          const moment = zooMomentAt(kind, minute, day);
          const localStart = moment.start - day * 1440;
          if (localStart < 248 && localStart + moment.duration > 112)
            expect(moment.active).toBe(false);
        }
        expect(
          Array.from({ length: 200 }, (_, i) => zooMomentAt(kind, 248 + i, day).active).some(
            Boolean,
          ),
        ).toBe(true);
      }
    }
  });
});

describe('Occasional zoo antics', () => {
  it('gives each habitat a quiet majority, a different cadence, and every animal a turn', () => {
    expect(new Set(species.map((s) => ZOO_QUIRKS[s].interval)).size).toBe(4);
    for (const kind of species) {
      const config = ZOO_QUIRKS[kind],
        start = startFor(kind);
      expect(config.interval).toBeGreaterThanOrEqual(90);
      expect(config.interval).toBeLessThanOrEqual(180);
      expect(config.duration / config.interval).toBeLessThan(0.3);
      const count = kind === 'penguin' ? 5 : 3;
      const actors = new Set<string>();
      for (let turn = 0; turn < count; turn++) {
        const current = start + turn * config.interval;
        const active = zooAnimalsAt(current + 16).filter((a) => a.species === kind && a.action);
        expect(active).toHaveLength(1);
        actors.add(active[0].id);
        expect(
          zooAnimalsAt(current + 60).filter((a) => a.species === kind && a.action),
        ).toHaveLength(0);
      }
      expect(actors.size).toBe(count);
    }
  });

  it('drinks at the watering hole before raising the trunk and spraying', () => {
    const h = ZOO_HABITATS.find((h) => h.animal === 'elephant')!,
      pond = zooPond(h);
    const start = startFor('elephant');
    const drinking = actorAt('elephant', start + 10);
    expect(drinking.action?.phase).toBe('drink');
    expect(drinking.position.x).toBeLessThan(pond.left);
    expect(
      distance(drinking.position, { x: pond.left, y: pond.top + pond.height / 2 }),
    ).toBeLessThan(0.6);
    expect(actorAt('elephant', start + 13).action?.phase).toBe('raise-trunk');
    const spray = actorAt('elephant', start + 17);
    expect(spray.id).toBe(drinking.id);
    expect(spray.action?.phase).toBe('spray');
    expect(spray.position).toEqual(drinking.position);
    expect(actorAt('elephant', start + 21).action?.phase).toBe('lower-trunk');
  });

  it('keeps idle penguins dry, jumps into the real pool, swims, and hops back out', () => {
    const h = ZOO_HABITATS.find((h) => h.animal === 'penguin')!,
      pond = zooPond(h);
    const inPool = (p: { x: number; y: number }) =>
      p.x >= pond.left &&
      p.x <= pond.left + pond.width &&
      p.y >= pond.top &&
      p.y <= pond.top + pond.height;
    const start = startFor('penguin');
    expect(actorAt('penguin', start + 9).action?.phase).toBe('crouch');
    const jump = actorAt('penguin', start + 11);
    expect(jump.action?.phase).toBe('dive');
    expect(jump.lift).toBeGreaterThan(35);
    expect(actorAt('penguin', start + 13).action?.phase).toBe('splash');
    for (let sample = 0; sample < 30; sample++) {
      const swimmer = actorAt('penguin', start + 14 + sample * 0.2);
      expect(swimmer.action?.phase).toBe('swim');
      expect(inPool(swimmer.position)).toBe(true);
    }
    // It swims flat to the kerb by the rock, then hops out.
    expect(actorAt('penguin', start + 20.8).action?.phase).toBe('swim');
    expect(actorAt('penguin', start + 20.8).swim).toBe(1);
    expect(actorAt('penguin', start + 21.6).action?.phase).toBe('hop-out');
    for (let time = 0; time < 1440; time += 0.7)
      for (const penguin of zooAnimalsAt(time).filter((a) => a.species === 'penguin' && !a.action))
        expect(inPool(penguin.position)).toBe(false);
  });

  it('runs zebras faster than a normal walk and stretches giraffes for a wobbly snack', () => {
    const start = startFor('zebra'),
      runner = actorAt('zebra', start + 14);
    const next = actorAt('zebra', start + 14.01);
    expect(runner.action?.phase).toBe('run');
    const zoomies = distance(runner.position, next.position) / 0.01;
    expect(zoomies).toBeGreaterThan(1);
    // The zoomies are at least three times the fastest idle walk of the day.
    let fastest = 0;
    for (let time = 0; time < 1440; time += 0.5) {
      // The other two step aside during the zoomies; that is not an idle walk.
      if (zooMomentAt('zebra', time).active || zooMomentAt('zebra', time + 0.05).active) continue;
      const now = zooAnimalsAt(time),
        later = zooAnimalsAt(time + 0.05);
      now.forEach((a, index) => {
        if (a.species === 'zebra' && a.moving && !a.action && a.rest === 0 && !later[index].action)
          fastest = Math.max(fastest, distance(a.position, later[index].position) / 0.05);
      });
    }
    expect(fastest).toBeGreaterThan(0);
    expect(zoomies).toBeGreaterThan(3 * fastest);
    expect(actorAt('zebra', start + 21).action?.phase).toBe('skid');
    const giraffeStart = startFor('giraffe');
    expect(actorAt('giraffe', giraffeStart + 10).action?.phase).toBe('stretch');
    const snack = actorAt('giraffe', giraffeStart + 14);
    expect(snack.action?.phase).toBe('nibble');
    expect(snack.stretch).toBeGreaterThan(20);
    expect(actorAt('giraffe', giraffeStart + 21.99).stretch).toBeLessThan(0.01);
  });

  it('never teleports at choreography boundaries or midnight, stays fenced in, and replays exactly', () => {
    for (const kind of species) {
      const start = startFor(kind);
      for (const offset of [0, 8, 10, 12, 14, 15, 18, 20, 22, 30]) {
        const before = zooAnimalsAt(start + offset - 0.0001),
          after = zooAnimalsAt(start + offset + 0.0001);
        before.forEach((a, index) => {
          expect(distance(a.position, after[index].position)).toBeLessThan(0.002);
          expect(Math.abs(a.lift - after[index].lift)).toBeLessThan(0.02);
          expect(Math.abs(a.stretch - after[index].stretch)).toBeLessThan(0.02);
          expect(Math.abs(a.submerged - after[index].submerged)).toBeLessThan(0.002);
          for (const key of ['graze', 'look', 'ear', 'tail', 'swim'] as const)
            expect(Math.abs(a[key] - after[index][key])).toBeLessThan(0.01);
        });
      }
    }
    for (let time = 0; time < 2880; time += 0.7)
      for (const a of zooAnimalsAt(time)) {
        const h = ZOO_HABITATS.find((h) => h.animal === a.species)!;
        expect(a.position.x).toBeGreaterThan(h.left);
        expect(a.position.x).toBeLessThan(h.left + h.width);
        expect(a.position.y).toBeGreaterThan(h.top);
        expect(a.position.y).toBeLessThan(h.top + h.height);
      }
    const before = zooAnimalsAt(1439.999, 9),
      after = zooAnimalsAt(0.001, 10);
    before.forEach((a, index) => {
      expect(distance(a.position, after[index].position)).toBeLessThan(0.02);
      for (const key of ['graze', 'look', 'ear', 'tail', 'swim'] as const)
        expect(Math.abs(a[key] - after[index][key])).toBeLessThan(0.02);
    });
    expect(zooAnimalsAt(1441, 9)).toEqual(zooAnimalsAt(1, 10));
    const first = zooAnimalsAt(816.2, 100);
    zooAnimalsAt(20, 250);
    expect(zooAnimalsAt(816.2, 100)).toEqual(first);
  });
});
