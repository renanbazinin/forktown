import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { placeSchema, type Place } from '../src/lib/schema';
import { residentActivityLabel, simulateResidents } from '../src/lib/simulation';
import { getPlot, hash, isRoad, plotEntrance } from '../src/lib/world';

const places = readdirSync('places')
  .filter((file) => file.endsWith('.json'))
  .map((file) => placeSchema.parse(JSON.parse(readFileSync(`places/${file}`, 'utf8'))));
const owls: Place[] = places.map((home) => ({
  ...home,
  resident: { ...home.resident, routine: { ...home.resident.routine, night: 'stroll' } },
}));

describe('Optional moonlit walks', () => {
  it('defaults existing JSON to sleep and rejects unsupported night choices', () => {
    const home = structuredClone(places[0]);
    const { night: _night, ...routine } = home.resident.routine;
    const old = { ...home, resident: { ...home.resident, routine } };
    expect(placeSchema.parse(old).resident.routine.night).toBe('sleep');
    expect(
      placeSchema.safeParse({
        ...home,
        resident: { ...home.resident, routine: { ...routine, night: 'work' } },
      }).success,
    ).toBe(false);
    expect(simulateResidents([placeSchema.parse(old)], 60)[0].activity).toBe('sleep');
  });
  it('takes one staggered walk near home, only on roads, with no event attendance', () => {
    const departures = new Set<number>();
    for (const home of owls) {
      const departure = hash(`night:${home.id}`) % 240;
      departures.add(departure);
      const doorstep = plotEntrance(getPlot(home.plot)!);
      for (let minute = 0; minute < 480; minute += 2.5) {
        const state = simulateResidents([home], 1320 + minute)[0];
        const walking = minute >= departure && minute < departure + 180;
        expect(state.activity).toBe(walking ? 'stroll' : 'sleep');
        expect(state.event).toBeUndefined();
        expect(isRoad(Math.floor(state.position.x), Math.floor(state.position.y))).toBe(true);
        if (walking) {
          expect(residentActivityLabel(state)).toBe('Out for a moonlit stroll');
          expect(
            Math.abs(state.position.x - doorstep.x) + Math.abs(state.position.y - doorstep.y),
          ).toBeLessThanOrEqual(8.001);
        } else {
          expect(state.position).toEqual(doorstep);
          expect(state.moving).toBe(false);
          expect(state.greeting).toBe(false);
        }
      }
    }
    expect(departures.size).toBeGreaterThan(3);
  });
  it('leaves and returns at the doorstep without teleporting, and sleeps before dawn', () => {
    for (const home of owls) {
      const departure = (hash(`night:${home.id}`) % 240) + 1320;
      for (const boundary of [departure, departure + 180]) {
        const before = simulateResidents([home], boundary - 0.001)[0];
        const after = simulateResidents([home], boundary + 0.001)[0];
        expect(
          Math.hypot(before.position.x - after.position.x, before.position.y - after.position.y),
        ).toBeLessThan(0.001);
      }
      expect(simulateResidents([home], 300)[0].activity).toBe('sleep');
      expect(simulateResidents([home], 359.99)[0].activity).toBe('sleep');
    }
  });
  it('keeps routes continuous across midnight, day changes, and input order', () => {
    const before = simulateResidents(owls, 1439.999, 8);
    const after = simulateResidents(owls, 0.001, 9);
    before.forEach((state, index) => {
      expect(
        Math.hypot(
          state.position.x - after[index].position.x,
          state.position.y - after[index].position.y,
        ),
      ).toBeLessThan(0.001);
    });
    expect(simulateResidents(owls, 60, 9)).toEqual(
      simulateResidents([...owls].reverse(), 60, 9).reverse(),
    );
    expect(simulateResidents(owls, 60, 9)).toEqual(simulateResidents(owls, 60, 10));
  });
  it('supports opted-in night owls alongside sleeping neighbors', () => {
    const town = places.map((home) =>
      ['moonbeam-cafe', 'after-hours', 'stargazer'].includes(home.id)
        ? owls.find((owl) => owl.id === home.id)!
        : home,
    );
    const states = simulateResidents(town, 60);
    expect(states.some((state) => state.nightWalk && state.moving)).toBe(true);
    expect(states.some((state) => state.activity === 'sleep')).toBe(true);
  });
});
