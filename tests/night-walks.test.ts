import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { placeSchema, type Place } from '../src/lib/schema';
import {
  eventAtVenue,
  eventsForDay,
  eventStatus,
  HOUSE_PLOTS,
  insideVenue,
} from '../src/lib/events';
import { residentActivityLabel, simulateResidents } from '../src/lib/simulation';
import { getPlot, hash, isRoad, plotEntrance } from '../src/lib/world';

const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
const owls: Place[] = HOUSE_PLOTS.slice(0, 20).map((plot, index) => ({
  ...sample,
  id: `night-owl-${index}`,
  plot: plot.id,
  resident: { ...sample.resident, routine: { ...sample.resident.routine, night: 'stroll' } },
}));
// Use an actual day rollover, just like the live town clock.
const at = (minutes: number, homes = owls) =>
  simulateResidents(homes, minutes % 1440, 8 + Math.floor(minutes / 1440));
const party = eventsForDay(8).find((event) => event.period === 'night')!;
const guestIds = new Set(
  at(1500)
    .filter((state) => state.event)
    .map((state) => state.id),
);
const overflow = owls.filter((home) => !guestIds.has(home.id));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('Night owls and the midnight party', () => {
  it('defaults existing JSON to sleep and rejects unsupported night choices', () => {
    const { night: _night, ...routine } = sample.resident.routine;
    const old = { ...sample, resident: { ...sample.resident, routine } };
    expect(placeSchema.parse(old).resident.routine.night).toBe('sleep');
    expect(
      placeSchema.safeParse({
        ...sample,
        resident: { ...sample.resident, routine: { ...routine, night: 'work' } },
      }).success,
    ).toBe(false);
    expect(at(1500, [placeSchema.parse(old)])[0].activity).toBe('sleep');
  });
  it('gives overflow neighbors one staggered, local road walk and rest afterward', () => {
    expect(overflow.length).toBeGreaterThan(0);
    const departures = new Set<number>();
    for (const home of overflow) {
      const departure = hash(`night:${home.id}`) % 240;
      departures.add(departure);
      const doorstep = plotEntrance(getPlot(home.plot)!);
      for (let minute = 0; minute < 480; minute += 2.5) {
        const state = at(1320 + minute).find((state) => state.id === home.id)!;
        const walking = minute >= departure && minute < departure + 180;
        expect(state.activity).toBe(walking ? 'stroll' : 'sleep');
        expect(state.event).toBeUndefined();
        expect(isRoad(Math.floor(state.position.x), Math.floor(state.position.y))).toBe(true);
        if (walking) {
          expect(residentActivityLabel(state)).toBe('Out for a moonlit stroll');
          expect(
            Math.abs(state.position.x - doorstep.x) + Math.abs(state.position.y - doorstep.y),
            // A road detour can extend beyond the destination's eight-tile radius.
          ).toBeLessThanOrEqual(12.001);
        } else {
          expect(state.position).toEqual(doorstep);
          expect(state.moving).toBe(false);
          expect(state.greeting).toBe(false);
        }
      }
    }
    expect(departures.size).toBeGreaterThan(3);
  });
  it('keeps the same eight dancers in distinct spots on both sides of midnight', () => {
    const before = at(1439.999),
      after = at(1440.001);
    expect(guestIds.size).toBe(8);
    expect(
      new Set(after.filter((state) => state.event).map((state) => JSON.stringify(state.position)))
        .size,
    ).toBe(8);
    before.forEach((state, index) => {
      expect(distance(state.position, after[index].position)).toBeLessThan(0.001);
      expect(state.event).toEqual(after[index].event);
    });
    for (const state of after.filter((state) => state.event)) {
      expect(state).toMatchObject({
        activity: 'stroll',
        moving: false,
        pose: 'dance',
        event: { id: 'night-party', phase: 'attending' },
      });
      expect(residentActivityLabel(state)).toBe(`Dancing at ${party.name}`);
      expect(insideVenue(party.venue, state.position)).toBe(true);
      expect(state.nightWalk).toBeUndefined();
    }
    expect(at(1500)).toEqual(at(1500, [...owls].reverse()).reverse());
    expect(
      new Set(
        at(2940)
          .filter((state) => state.event)
          .map((state) => state.id),
      ),
    ).not.toEqual(guestIds);
  });
  it('walks guests along roads and the venue lawn, then sleeps at home by 04:30', () => {
    for (let minute = party.depart; minute < party.homeBy; minute += 2.7) {
      const now = at(minute),
        next = at(minute + 0.001);
      now.forEach((state, index) => {
        if (!guestIds.has(state.id)) return;
        expect(
          isRoad(Math.floor(state.position.x), Math.floor(state.position.y)) ||
            insideVenue(party.venue, state.position),
        ).toBe(true);
        expect(distance(state.position, next[index].position)).toBeLessThan(0.01);
        if (state.event?.phase !== 'attending') expect(state.pose).toBeUndefined();
        expect(state.greeting).toBe(false);
      });
    }
    for (const minute of [1320, party.depart - 0.001, party.homeBy, 1799.999])
      for (const state of at(minute).filter((state) => guestIds.has(state.id))) {
        expect(state).toMatchObject({
          activity: 'sleep',
          moving: false,
          position: plotEntrance(getPlot(state.home.plot)!),
        });
        expect(state.event).toBeUndefined();
        expect(state.pose).toBeUndefined();
      }
  });
  it('never teleports at event boundaries or moonlit departures and returns', () => {
    const boundaries = [party.depart, party.start, 1440, party.end, party.homeBy, 1800];
    for (const home of overflow) {
      const departure = 1320 + (hash(`night:${home.id}`) % 240);
      boundaries.push(departure, departure + 180);
    }
    for (const boundary of boundaries) {
      const before = at(boundary - 0.001),
        after = at(boundary + 0.001);
      before.forEach((state, index) =>
        expect(distance(state.position, after[index].position)).toBeLessThan(0.01),
      );
    }
  });
  it('keeps sleepers indoors and selects the right stage program across midnight', () => {
    const sleeper = { ...sample, id: 'sleeping-neighbor' };
    for (const minute of [1350, 1410, 1440, 1500, 1600, 1710]) {
      const state = at(minute, [...owls, sleeper]).at(-1)!;
      expect(state.activity).toBe('sleep');
      expect(state.event).toBeUndefined();
      expect(state.moving).toBe(false);
    }
    expect(eventStatus(party, 1409.999)).toBe('Later tonight');
    for (const minute of [1410, 1439.999, 0, 149.999]) {
      expect(eventStatus(party, minute)).toBe('Happening now');
      expect(eventAtVenue(eventsForDay(9), 'stage', minute)?.id).toBe('night-party');
    }
    expect(eventStatus(party, 150)).toBe('Finished today');
    expect(eventStatus(party, 360)).toBe('Later tonight');
    expect(eventAtVenue(eventsForDay(9), 'stage', 1200)?.period).toBe('evening');
  });
});
