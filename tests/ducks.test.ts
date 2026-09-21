import { describe, expect, it } from 'vitest';
import {
  ducksAt,
  DUCK_COUNT,
  DUCK_RIVER_X,
  DUCK_STREET_Y,
  DUCK_TURN_X,
  DUCK_WALK_START,
  DUCK_WALK_END,
} from '../src/lib/ducks';
import { isRoad, WORLD_WIDTH } from '../src/lib/world';

describe('Daily river-to-neighborhood duck walk', () => {
  it('leaves and returns through the river once each day, including the last duckling', () => {
    expect(ducksAt(DUCK_WALK_START - 0.01)).toEqual([]);
    expect(ducksAt(DUCK_WALK_END)).toEqual([]);
    const first = ducksAt(DUCK_WALK_START);
    expect(first).toHaveLength(1);
    expect(first[0].position.x).toBe(DUCK_RIVER_X);
    expect(first[0].swimming).toBe(true);
    expect(first[0].opacity).toBe(0);
    const family = ducksAt(DUCK_WALK_START + 12);
    expect(family).toHaveLength(DUCK_COUNT);
    expect(family.filter((duck) => duck.adult)).toHaveLength(1);
    const last = ducksAt(DUCK_WALK_END - 0.01);
    expect(last).toHaveLength(1);
    expect(last[0].id).toBe(DUCK_COUNT - 1);
    expect(last[0].swimming).toBe(true);
    expect(last[0].position.x).toBeCloseTo(DUCK_RIVER_X, 2);
    expect(last[0].opacity).toBeLessThan(0.01);
  });

  it('follows the marked street, turns near the first homes, and moves continuously', () => {
    const nearest = Array(DUCK_COUNT).fill(Infinity) as number[];
    const directions = Array.from({ length: DUCK_COUNT }, () => new Set<boolean>());
    for (let time = DUCK_WALK_START; time < DUCK_WALK_END; time += 0.25) {
      for (const duck of ducksAt(time)) {
        const { x, y } = duck.position;
        expect(Math.abs(y - DUCK_STREET_Y)).toBeLessThanOrEqual(0.201);
        expect(x).toBeGreaterThanOrEqual(1.5);
        expect(x).toBeLessThanOrEqual(DUCK_RIVER_X);
        // The last tile is water; all other positions lie on the street.
        expect(isRoad(Math.floor(x), Math.floor(y)) || x >= WORLD_WIDTH - 2).toBe(true);
        nearest[duck.id] = Math.min(nearest[duck.id], x);
        directions[duck.id].add(duck.left);
        const next = ducksAt(time + 0.001).find((other) => other.id === duck.id);
        if (next) expect(Math.hypot(next.position.x - x, next.position.y - y)).toBeLessThan(0.0005);
      }
    }
    for (let id = 0; id < DUCK_COUNT; id++) {
      expect(nearest[id]).toBeLessThan(DUCK_TURN_X);
      expect(directions[id].size).toBe(2);
    }
  });

  it('lets the last duckling stop and catch up while keeping the family in order', () => {
    const lastAt = (elapsed: number) => ducksAt(DUCK_WALK_START + 10 + elapsed).at(-1)!;
    expect(lastAt(95).position).toEqual(lastAt(96).position);
    expect(lastAt(96).position).toEqual(lastAt(97).position);
    const gap = (elapsed: number) => {
      const family = ducksAt(DUCK_WALK_START + 10 + elapsed);
      return family[5].position.x - family[4].position.x;
    };
    expect(gap(97)).toBeGreaterThan(gap(94));
    expect(gap(103)).toBeCloseTo(gap(94));
    for (let elapsed = 90; elapsed <= 110; elapsed += 0.1) expect(gap(elapsed)).toBeGreaterThan(0);
  });

  it('reproduces the same scene after reload, pause, and day wrapping', () => {
    for (const time of [0, 479, 480, 550.5, 610, 749.9, 750, 1439]) {
      for (const offset of [-1440, 1440]) {
        const expected = ducksAt(time);
        const actual = ducksAt(time + offset);
        expect(actual.map((duck) => duck.id)).toEqual(expected.map((duck) => duck.id));
        actual.forEach((duck, index) => {
          expect(duck.position.x).toBeCloseTo(expected[index].position.x, 9);
          expect(duck.position.y).toBeCloseTo(expected[index].position.y, 9);
          expect(duck.stride).toBeCloseTo(expected[index].stride, 9);
          expect(duck.opacity).toBeCloseTo(expected[index].opacity, 9);
        });
      }
      expect(ducksAt(time)).toEqual(ducksAt(time));
    }
  });
});
