import { describe, expect, it } from 'vitest';
import {
  ZOO_HABITATS,
  ZOO_QUIRKS,
  zooAnimalsAt,
  zooMomentAt,
  zooPond,
  zooProps,
  zooTree,
  type ZooAnimal,
  type ZooAnimalState,
} from '../src/lib/zoo';

const species = Object.keys(ZOO_QUIRKS) as ZooAnimal[];
const GAP: Record<ZooAnimal, number> = { elephant: 1.25, giraffe: 0.95, zebra: 0.95, penguin: 0.5 };
const habitatOf = (kind: ZooAnimal) => ZOO_HABITATS.find((h) => h.animal === kind)!;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
// Idle: no antic, awake, and (for zebras) not stepping aside for the zoomies.
const idle = (a: ZooAnimalState, time: number) =>
  !a.action && a.rest === 0 && !(a.species === 'zebra' && zooMomentAt('zebra', time).active);
const startFor = (kind: ZooAnimal, time = 720) => {
  const moment = zooMomentAt(kind, time);
  return moment.start + moment.interval;
};

describe('Zoo motion', () => {
  it('keeps every animal clear of its neighbours at all times, antics and bedtime included', () => {
    let worst = Infinity;
    for (let time = 0; time < 2880; time += 0.25) {
      const animals = zooAnimalsAt(time);
      for (let i = 0; i < animals.length; i++)
        for (let j = i + 1; j < animals.length; j++) {
          const a = animals[i],
            b = animals[j];
          if (a.species !== b.species) continue;
          const ratio = distance(a.position, b.position) / GAP[a.species];
          worst = Math.min(worst, ratio);
          if (ratio < 1) throw new Error(`${a.id} and ${b.id} touch at ${time}`);
        }
    }
    expect(worst).toBeGreaterThanOrEqual(1);
    // Densely through one of each antic, where the actor crosses the habitat.
    for (const kind of species) {
      const start = startFor(kind);
      for (let t = -1; t < 31; t += 0.05) {
        const herd = zooAnimalsAt(start + t).filter((a) => a.species === kind);
        for (let i = 0; i < herd.length; i++)
          for (let j = i + 1; j < herd.length; j++)
            expect(distance(herd[i].position, herd[j].position)).toBeGreaterThanOrEqual(GAP[kind]);
      }
    }
  });

  it('never stands or walks inside a solid prop when not performing', () => {
    const solids = Object.fromEntries(
      species.map((kind) => [kind, zooProps(habitatOf(kind)).filter((p) => p.solid)]),
    );
    expect(Object.values(solids).every((list) => list.length > 0)).toBe(true);
    for (let time = 0; time < 2880; time += 0.25)
      for (const a of zooAnimalsAt(time)) {
        if (a.action) continue;
        for (const p of solids[a.species]) {
          const inside =
            a.position.x > p.left &&
            a.position.x < p.left + p.width &&
            a.position.y > p.top &&
            a.position.y < p.top + p.height;
          if (inside) throw new Error(`${a.id} is inside the ${p.kind} at ${time}`);
        }
      }
  });

  it('walks at a natural pace with legs that only swing while walking', () => {
    const speeds: Record<ZooAnimal, number[]> = {
      elephant: [],
      giraffe: [],
      zebra: [],
      penguin: [],
    };
    for (let time = 0; time < 1440; time += 0.25) {
      const now = zooAnimalsAt(time),
        later = zooAnimalsAt(time + 0.05);
      now.forEach((a, index) => {
        if (!a.moving) expect(a.step).toBe(0);
        const next = later[index];
        if (!idle(a, time) || !idle(next, time + 0.05)) return;
        const speed = distance(a.position, next.position) / 0.05;
        // No gliding: standing animals stay put, walking ones move.
        if (!a.moving && !next.moving) expect(speed).toBe(0);
        if (a.moving && next.moving) {
          expect(speed).toBeGreaterThan(0);
          speeds[a.species].push(speed);
        }
      });
    }
    for (const kind of species) {
      const list = speeds[kind].sort((a, b) => a - b);
      expect(list.length).toBeGreaterThan(20);
      // Mostly a steady pace, easing in and out at the ends of each walk.
      const median = list[Math.floor(list.length / 2)];
      expect(median).toBeGreaterThanOrEqual(0.18);
      expect(median).toBeLessThanOrEqual(0.36);
      expect(list[list.length - 1]).toBeLessThanOrEqual(0.5);
    }
    // Some of the day is spent walking, most of it standing, grazing or looking about.
    const day = zooAnimalsAt(900);
    let walking = 0,
      samples = 0;
    for (let time = 600; time < 1200; time += 1)
      for (const a of zooAnimalsAt(time)) {
        samples++;
        if (a.moving) walking++;
      }
    expect(walking / samples).toBeGreaterThan(0.08);
    expect(walking / samples).toBeLessThan(0.5);
    expect(day.some((a) => a.graze > 0.5 || Math.abs(a.look) > 0.5 || a.stretch > 0)).toBe(true);
  });

  it('walks at a natural pace everywhere, antics and bedtime included, with smooth legs', () => {
    // Every walk that is not part of a trick: idle, antic walks, watchers and the walks to bed.
    const tricks = ['run', 'skid', 'dive', 'splash', 'swim', 'hop-out'];
    const walking = (a: ZooAnimalState) =>
      a.moving && !tricks.includes(a.action?.phase ?? 'approach');
    const dt = 0.05,
      frames = Array.from({ length: 1440 / dt }, (_, n) => zooAnimalsAt(n * dt, 2));
    const fastest: Record<ZooAnimal, number> = { elephant: 0, giraffe: 0, zebra: 0, penguin: 0 };
    let slowest = Infinity;
    for (let n = 12; n < frames.length - 13; n++) {
      const minute = n * dt;
      frames[n].forEach((a, index) => {
        const next = frames[n + 1][index];
        if (!walking(a) || !walking(next)) return;
        const speed = distance(a.position, next.position) / dt;
        fastest[a.species] = Math.max(fastest[a.species], speed);
        // No stopping dead partway through a walk: the only slow parts are the first and last
        // 0.6 s. The walks to bed share one pace across the herd, so a short one may creep.
        const around = [frames[n - 12][index], frames[n + 13][index]];
        if (around.every(walking) && (minute < 95 || minute > 265))
          slowest = Math.min(slowest, speed);
      });
    }
    expect(fastest.elephant).toBeLessThanOrEqual(0.6);
    expect(fastest.giraffe).toBeLessThanOrEqual(0.6);
    expect(fastest.zebra).toBeLessThanOrEqual(0.6);
    expect(fastest.penguin).toBeLessThanOrEqual(0.5);
    expect(slowest).toBeGreaterThanOrEqual(0.05);
    // Legs move a little each frame (1/60 s) as antics start and end and at bedtime.
    const frame = 1 / 60;
    let jump = 0;
    const probe = (time: number) => {
      const a = zooAnimalsAt(time),
        b = zooAnimalsAt(time + frame);
      a.forEach((x, index) => {
        if (x.moving && b[index].moving) jump = Math.max(jump, Math.abs(x.step - b[index].step));
        if (!x.moving) expect(x.step).toBe(0);
      });
    };
    for (const kind of species) {
      const start = startFor(kind);
      for (let t = -14; t < 44; t += frame) probe(start + t);
    }
    for (const edge of [100, 112, 248, 260])
      for (let t = -1; t < 13; t += frame) probe(1440 + edge + t);
    expect(jump).toBeLessThanOrEqual(0.35);
  });

  it('spreads each animal over its patch, brings elephants to the front, and rarely parks at the feeder', () => {
    const boxes = new Map<string, { left: number; right: number; top: number; bottom: number }>();
    let browsing = 0,
      giraffes = 0;
    const elephant = habitatOf('elephant');
    let front = false;
    for (let time = 0; time < 4320; time += 0.5)
      for (const a of zooAnimalsAt(time, 1)) {
        if (!idle(a, 1440 + time) || !(time % 1440 >= 360)) continue;
        const b = boxes.get(a.id) ?? { left: 1e9, right: -1e9, top: 1e9, bottom: -1e9 };
        b.left = Math.min(b.left, a.position.x);
        b.right = Math.max(b.right, a.position.x);
        b.top = Math.min(b.top, a.position.y);
        b.bottom = Math.max(b.bottom, a.position.y);
        boxes.set(a.id, b);
        if (a.species === 'giraffe') {
          giraffes++;
          if (a.stretch > 0.5) browsing++;
        }
        if (a.species === 'elephant' && a.position.y > elephant.top + 4.5) front = true;
      }
    expect(boxes.size).toBe(14);
    for (const [id, b] of boxes)
      expect((b.right - b.left) * (b.bottom - b.top), id).toBeGreaterThanOrEqual(0.5);
    expect(front).toBe(true);
    expect(browsing / giraffes).toBeGreaterThan(0.01);
    expect(browsing / giraffes).toBeLessThan(0.12);
  });

  it('keeps the zoomies watchers off the loop, beside their own patches', () => {
    const h = habitatOf('zebra');
    const center = { x: h.left + h.width / 2, y: h.top + h.height / 2 };
    for (let turn = 0; turn < 3; turn++) {
      const start = startFor('zebra') + turn * ZOO_QUIRKS.zebra.interval;
      const herd = zooAnimalsAt(start + 14).filter((a) => a.species === 'zebra');
      const watchers = herd.filter((a) => !a.action);
      expect(watchers).toHaveLength(2);
      for (const w of watchers) {
        expect(w.moving).toBe(false);
        // Nowhere on the 1.8 × 1.45 loop comes within a zebra's gap.
        for (let angle = 0; angle < Math.PI * 2; angle += 0.02) {
          const p = { x: center.x + Math.cos(angle) * 1.8, y: center.y + Math.sin(angle) * 1.45 };
          expect(distance(w.position, p)).toBeGreaterThan(GAP.zebra);
        }
      }
    }
  });

  it('keeps small life going: tails, ears, flippers and blinks, all seeded per animal', () => {
    const tails = new Map<string, number[]>();
    let blinks = 0,
      flaps = 0,
      grazes = 0,
      looks = 0;
    for (let time = 600; time < 720; time += 0.05)
      for (const a of zooAnimalsAt(time)) {
        tails.set(a.id, [...(tails.get(a.id) ?? []), a.tail]);
        if (a.blink) blinks++;
        if (a.ear > 0.9) flaps++;
        if (a.graze > 0.9) grazes++;
        if (Math.abs(a.look) > 0.9) looks++;
        for (const key of ['graze', 'ear'] as const) {
          expect(a[key]).toBeGreaterThanOrEqual(0);
          expect(a[key]).toBeLessThanOrEqual(1);
        }
        for (const key of ['look', 'tail'] as const) {
          expect(a[key]).toBeGreaterThanOrEqual(-1);
          expect(a[key]).toBeLessThanOrEqual(1);
        }
      }
    expect(blinks).toBeGreaterThan(0);
    expect(flaps).toBeGreaterThan(0);
    expect(grazes).toBeGreaterThan(0);
    expect(looks).toBeGreaterThan(0);
    // Every tail sways, and no two sway in step.
    const series = [...tails.values()];
    for (const tail of series) expect(Math.max(...tail) - Math.min(...tail)).toBeGreaterThan(0.3);
    expect(new Set(series.map((tail) => tail[0].toFixed(4))).size).toBe(series.length);
    // Blinks are short and every few seconds for each animal.
    for (const id of ['giraffe-0', 'penguin-3']) {
      const shut: number[] = [];
      for (let time = 600; time < 660; time += 0.01) {
        const a = zooAnimalsAt(time).find((a) => a.id === id)!;
        if (a.blink && !shut.some((t) => time - t < 0.2)) shut.push(time);
      }
      for (let i = 1; i < shut.length; i++) {
        expect(shut[i] - shut[i - 1]).toBeGreaterThanOrEqual(2.9);
        expect(shut[i] - shut[i - 1]).toBeLessThanOrEqual(7.2);
      }
    }
  });

  it('changes every field smoothly, with no flicker in which way an animal faces', () => {
    // Largest change per 0.01 minute (0.01 real seconds) over half a day across midnight, antics
    // and bedtime included.
    const most = { position: 0, graze: 0, look: 0, swim: 0, ear: 0, tail: 0, stretch: 0, lift: 0 };
    let before = zooAnimalsAt(1100, 3),
      quickestTurn = Infinity;
    const flips = new Map<string, number>();
    for (let time = 1100.01; time < 1820; time += 0.01) {
      const now = zooAnimalsAt(time, 3);
      for (let index = 0; index < now.length; index++) {
        const a = now[index],
          was = before[index];
        most.position = Math.max(most.position, distance(a.position, was.position));
        for (const key of ['graze', 'look', 'swim', 'ear', 'tail', 'stretch', 'lift'] as const)
          most[key] = Math.max(most[key], Math.abs(a[key] - was[key]));
        if (a.facing !== was.facing && idle(a, time + 3 * 1440) && idle(was, time + 3 * 1440)) {
          const last = flips.get(a.id);
          if (last !== undefined) quickestTurn = Math.min(quickestTurn, time - last);
          flips.set(a.id, time);
        }
      }
      before = now;
    }
    expect(most.position).toBeLessThan(0.05);
    expect(most.graze).toBeLessThan(0.05);
    expect(most.look).toBeLessThan(0.05);
    expect(most.swim).toBeLessThan(0.05);
    expect(most.ear).toBeLessThan(0.1);
    expect(most.tail).toBeLessThan(0.1);
    expect(most.stretch).toBeLessThan(0.2);
    // The penguin's short, high hop out of the pool is the quickest rise.
    expect(most.lift).toBeLessThan(1.5);
    expect(flips.size).toBeGreaterThan(10);
    expect(quickestTurn).toBeGreaterThan(1.5);
  });

  it('lays penguins flat to swim and lets idle ones roam the whole dry beach', () => {
    const h = habitatOf('penguin'),
      pool = zooPond(h);
    const start = startFor('penguin');
    const diver = (t: number) =>
      zooAnimalsAt(start + t).find((a) => a.species === 'penguin' && a.action)!;
    expect(diver(9).swim).toBe(0);
    expect(diver(10.2).swim).toBeLessThan(0.1);
    expect(diver(11.99).swim).toBeGreaterThan(0.95);
    for (let t = 12; t < 20; t += 0.1) {
      const a = diver(t);
      if (a.action?.phase === 'swim') expect(a.swim).toBe(1);
    }
    expect(diver(21.9).swim).toBe(0);
    expect(diver(24).swim).toBe(0);
    const spots: { x: number; y: number }[] = [];
    for (let time = 0; time < 2880; time += 1)
      for (const a of zooAnimalsAt(time))
        if (a.species === 'penguin' && idle(a, time)) {
          expect(a.swim).toBe(0);
          spots.push({ x: a.position.x - h.left, y: a.position.y - h.top });
        }
    const pondBottom = pool.top + pool.height - h.top;
    // The front beach from end to end, and the bank beside the ledge.
    expect(Math.min(...spots.map((p) => p.x))).toBeLessThan(0.8);
    expect(Math.max(...spots.map((p) => p.x))).toBeGreaterThan(5.3);
    expect(spots.some((p) => p.y < pondBottom - 0.5)).toBe(true);
    expect(spots.some((p) => p.y > pondBottom + 1.8)).toBe(true);
  });

  it('sleeps in spaced beds in sheltered spots', () => {
    const beds = zooAnimalsAt(180, 5);
    const near = (
      p: { x: number; y: number },
      box: { left: number; top: number; width: number; height: number },
    ) =>
      Math.hypot(
        Math.max(0, box.left - p.x, p.x - box.left - box.width),
        Math.max(0, box.top - p.y, p.y - box.top - box.height),
      );
    for (const kind of species) {
      const herd = beds.filter((a) => a.species === kind),
        h = habitatOf(kind),
        props = zooProps(h);
      for (let i = 0; i < herd.length; i++)
        for (let j = i + 1; j < herd.length; j++)
          expect(distance(herd[i].position, herd[j].position)).toBeGreaterThanOrEqual(
            kind === 'penguin' ? 0.45 : GAP[kind],
          );
      const house = props.find((p) => p.kind === 'house'),
        shade = props.find((p) => p.kind === 'shade');
      for (const a of herd) {
        if (house) expect(near(a.position, house)).toBeLessThan(2);
        if (shade) expect(near(a.position, shade)).toBeLessThan(1);
        // Giraffes along the back fence by the acacia, none in front of its trunk.
        if (kind === 'giraffe') expect(a.position.y - h.top).toBeLessThan(0.8);
      }
      if (kind === 'giraffe') {
        const tree = zooTree(h);
        expect(herd.some((a) => distance(a.position, tree) < 0.7)).toBe(true);
        expect(herd.every((a) => distance(a.position, tree) < 2.2)).toBe(true);
        for (const a of herd)
          expect(Math.abs(a.position.x - a.position.y - (tree.x - tree.y))).toBeGreaterThan(0.5);
      }
      // Two elephants sleep at the house door.
      if (house) expect(herd.filter((a) => near(a.position, house) < 0.7)).toHaveLength(2);
      if (kind === 'penguin') {
        const middle = {
          x: herd.reduce((sum, a) => sum + a.position.x, 0) / herd.length,
          y: herd.reduce((sum, a) => sum + a.position.y, 0) / herd.length,
        };
        for (const a of herd) expect(distance(a.position, middle)).toBeLessThan(1);
      }
    }
  });

  it('stays cheap enough to run every frame', () => {
    const begin = performance.now();
    for (let n = 0; n < 2000; n++) zooAnimalsAt(n * 0.73, 7);
    // Generous: a few microseconds per call today, so this only catches runaway loops.
    expect(performance.now() - begin).toBeLessThan(1500);
  });
});
