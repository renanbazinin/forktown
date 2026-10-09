import { describe, expect, it } from 'vitest';
import { duckAwareWalk, DUCK_LOVE_SECONDS, DUCK_NOTICE_RADIUS } from '../src/lib/duck-reactions';
import { ducksAt, DUCK_STREET_Y, DUCK_WALK_START, DUCK_WALK_END } from '../src/lib/ducks';
import { residentActivityLabel, simulateResidents } from '../src/lib/simulation';
import { isRoad } from '../src/lib/world';
import type { Place } from '../src/lib/schema';
import { FROZEN_TOWN } from './district';
import { fullTownHouse, readPlaces } from './full-town';

const real = readPlaces();
/** The duck street's own plots, whose doors open onto it. */
const STREET = ['C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13', 'C14'];
/** A morning stroller on a street plot. */
const stroller = (plot: string): Place => {
  const house = fullTownHouse(plot);
  return {
    ...house,
    resident: {
      ...house.resident,
      routine: { morning: 'stroll', afternoon: 'home', evening: 'home', night: 'sleep' },
    },
  };
};
/**
 * The family walks the duck street from the river to x ≈ 21.6 and back, east of where today's
 * homes stand. So the real town is joined by morning strollers on the street plots it leaves free
 * (the full town fills them): whoever lives there, nobody spins round or is held mid-step.
 */
const places = [
  ...real,
  ...STREET.filter((plot) => !real.some((place) => place.plot === plot)).map(stroller),
];
/**
 * The frozen town (tests/district.ts) with every street plot a morning stroller's: the walkers
 * the ducks are counted on, so a contributor who moves onto the street and works mornings never
 * leaves the family unadmired.
 */
const duckTown = [
  ...FROZEN_TOWN.filter((place) => !STREET.includes(place.plot)),
  ...STREET.map(stroller),
];
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

  it('turns to ducklings ahead or beside, never spinning round in a frame, and not mid-step off a path', () => {
    const opposite = { se: 'nw', nw: 'se', sw: 'ne', ne: 'sw' } as const;
    const stops = new Map<Place[], number>();
    for (const homes of [places, duckTown])
      for (const day of [0, 42]) {
        let before = simulateResidents(homes, DUCK_WALK_START, day);
        for (let time = DUCK_WALK_START + 0.1; time < DUCK_WALK_END + 12; time += 0.1) {
          const now = simulateResidents(homes, time, day);
          now.forEach((state, i) => {
            const was = before[i];
            if (state.duckLove === was.duckLove) return;
            if (state.duckLove) stops.set(homes, (stops.get(homes) ?? 0) + 1);
            // Into the stop and out of it again: a quarter turn at most.
            expect(state.facing, `${state.id} on day ${day} at ${time}`).not.toBe(
              opposite[was.facing],
            );
          });
          before = now;
        }
      }
    expect(stops.get(duckTown)).toBeGreaterThan(0);
    // Right beside the family the moment a walk begins: they set off first, and look after.
    const start = DUCK_WALK_START + 60;
    const beside = () => ({
      position: { ...ducksAt(start)[0].position },
      moving: true,
      facing: 'se' as const,
      walkPhase: 0,
    });
    for (let t = start; t < start + 0.5; t += 0.05)
      expect(duckAwareWalk('test:setting-off', t, start, start + 60, beside).duckLove).toBeFalsy();
  }, 90_000);

  it('remembers every route’s encounters however many neighbors stroll at once', () => {
    let samples = 0;
    const counted = (time: number) => (samples++, walk(time));
    // Far more stroll windows than today's town holds, all live in the same frames.
    const routes = Array.from({ length: 600 }, (_, index) => `test:crowd:${index}`);
    for (const route of routes) duckAwareWalk(route, 540, 360, 720, counted);
    samples = 0;
    for (const route of routes) duckAwareWalk(route, 540.1, 360, 720, counted);
    // One sample per route for the next frame: no route's scan is done again.
    expect(samples).toBe(routes.length);
  });

  it('integrates with real residents, labels the reaction, and leaves event guests and indoor routines alone', () => {
    const seen = new Map<Place[], number>();
    for (const homes of [places, duckTown]) {
      // One reversed roster, so its day plan is made once rather than for every reaction.
      const reversed = [...homes].reverse();
      for (let time = DUCK_WALK_START; time < DUCK_WALK_END; time += 0.5) {
        const states = simulateResidents(homes, time, 0);
        for (const state of states) {
          if (state.event || state.activity !== 'stroll') expect(state.duckLove).toBeUndefined();
          if (!state.duckLove) continue;
          seen.set(homes, (seen.get(homes) ?? 0) + 1);
          expect(state.moving).toBe(false);
          expect(state.greeting).toBe(false);
          expect(residentActivityLabel(state)).toBe('Stopped to admire the ducklings');
          const replay = simulateResidents(reversed, time, 0).find((r) => r.id === state.id);
          expect(replay).toEqual(state);
          expect(simulateResidents(homes, time + 1440, 0).find((r) => r.id === state.id)).toEqual(
            state,
          );
        }
      }
    }
    expect(seen.get(duckTown)).toBeGreaterThan(0);
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
