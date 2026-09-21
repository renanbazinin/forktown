import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { duckAwareWalk, DUCK_LOVE_SECONDS, DUCK_NOTICE_RADIUS } from '../src/lib/duck-reactions';
import { ducksAt, DUCK_STREET_Y, DUCK_WALK_START, DUCK_WALK_END } from '../src/lib/ducks';
import { placeSchema } from '../src/lib/schema';
import { residentActivityLabel, simulateResidents } from '../src/lib/simulation';
import { isRoad } from '../src/lib/world';

const places = readdirSync('places')
  .filter((name) => name.endsWith('.json'))
  .map((name) => placeSchema.parse(JSON.parse(readFileSync(`places/${name}`, 'utf8'))));
// A walker crosses the real family's route head-on at 09:00.
const crossingX = ducksAt(540)[0].position.x;
const walk = (time: number) => ({
  position: { x: crossingX + (time - 540) * 0.15, y: DUCK_STREET_Y },
  moving: true,
  facing: 'se' as const,
  walkPhase: (time * 0.45) % 1,
});
const reaction = (time: number) => duckAwareWalk('test:crossing', time, 360, 720, walk);
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('Residents admiring the duck family', () => {
  it('actually stops for four seconds when ducks pass, then resumes without a jump', () => {
    let start = DUCK_WALK_START;
    while (start < 600 && !reaction(start).duckLove) start += 0.5;
    expect(start).toBeLessThan(600);
    const stopped = reaction(start);
    expect(
      Math.min(...ducksAt(start).map((duck) => distance(stopped.position, duck.position))),
    ).toBeLessThanOrEqual(DUCK_NOTICE_RADIUS);
    for (const offset of [0, 0.1, 1, 2, DUCK_LOVE_SECONDS - 0.001]) {
      const state = reaction(start + offset);
      expect(state.duckLove).toBe(true);
      expect(state.moving).toBe(false);
      expect(state.position).toEqual(stopped.position);
      expect(state.walkPhase).toBe(stopped.walkPhase);
      expect(isRoad(Math.floor(state.position.x), Math.floor(state.position.y))).toBe(true);
    }
    const resumed = reaction(start + DUCK_LOVE_SECONDS);
    expect(resumed.duckLove).toBeUndefined();
    expect(resumed.moving).toBe(true);
    expect(resumed.position).toEqual(stopped.position);
    expect(reaction(start + DUCK_LOVE_SECONDS + 1).position.x).toBeGreaterThan(stopped.position.x);
    for (const boundary of [start, start + DUCK_LOVE_SECONDS, start + DUCK_LOVE_SECONDS + 12])
      expect(
        distance(reaction(boundary - 0.0001).position, reaction(boundary + 0.0001).position),
      ).toBeLessThan(0.0001);
    expect(reaction(start + 20)).toEqual(walk(start + 20));
    // Rewinding or reconstructing the route gives the same encounter, without frame history.
    reaction(700);
    expect(reaction(start + 1)).toEqual(duckAwareWalk('test:reload', start + 1, 360, 720, walk));
  });

  it('ignores distant walkers, stationary people, and times without ducks', () => {
    const distant = (time: number) => ({ ...walk(time), position: { x: 5.5, y: 30.5 } });
    const stationary = (time: number) => ({ ...walk(time), moving: false });
    for (let time = DUCK_WALK_START; time < DUCK_WALK_END; time += 2) {
      expect(duckAwareWalk('test:distant', time, 360, 720, distant)).toEqual(distant(time));
      expect(duckAwareWalk('test:stationary', time, 360, 720, stationary)).toEqual(
        stationary(time),
      );
    }
    for (const time of [0, 360, 479.9, 780, 1200, 1439]) expect(reaction(time)).toEqual(walk(time));
  });

  it('integrates with real residents, labels the reaction, and leaves event guests and indoor routines alone', () => {
    let seen = 0;
    for (let time = DUCK_WALK_START; time < DUCK_WALK_END; time += 0.5) {
      const states = simulateResidents(places, time, 0);
      for (const state of states) {
        if (state.event || state.activity !== 'stroll') expect(state.duckLove).toBeUndefined();
        if (!state.duckLove) continue;
        seen++;
        expect(state.moving).toBe(false);
        expect(state.greeting).toBe(false);
        expect(residentActivityLabel(state)).toBe('Stopped to admire the ducklings');
        const replay = simulateResidents([...places].reverse(), time, 0).find(
          (r) => r.id === state.id,
        );
        expect(replay).toEqual(state);
        expect(simulateResidents(places, time + 1440, 0).find((r) => r.id === state.id)).toEqual(
          state,
        );
      }
    }
    expect(seen).toBeGreaterThan(0);
    const indoors = places.map((place) => ({
      ...place,
      resident: {
        ...place.resident,
        routine: { morning: 'home', afternoon: 'home', evening: 'home', night: 'sleep' } as const,
      },
    }));
    expect(simulateResidents(indoors, 540).every((state) => !state.duckLove && !state.moving)).toBe(
      true,
    );
  });
});
