import { residentTrips } from '../src/lib/resident-trips';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  EVENT_SPOTS,
  eventSpot,
  eventsForDay,
  eventStatus,
  HOUSE_PLOTS,
  insideVenue,
  VENUES,
} from '../src/lib/events';
import { placeSchema, validatePlaces } from '../src/lib/schema';
import { simulateResidents } from '../src/lib/simulation';
import { getPlot, isRoad, plotEntrance } from '../src/lib/world';
import { townDayAt, townMinutesAt, TOWN_DAY_MS } from '../src/lib/town-time';
import { onRoadOrTube, stepBound } from './tube-riders';

const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
const walker = {
  ...sample,
  resident: {
    ...sample.resident,
    routine: { morning: 'stroll', afternoon: 'stroll', evening: 'stroll', night: 'sleep' } as const,
  },
};

describe('Shared town events', () => {
  it('selects a stable, varied lineup from the same UTC cycle across reloads and midnight', () => {
    const stamp = Date.parse('2026-09-21T12:00:00Z');
    expect(eventsForDay(townDayAt(stamp))).toEqual(eventsForDay(townDayAt(stamp + 1000)));
    const end = (townDayAt(stamp) + 1) * TOWN_DAY_MS;
    expect(townMinutesAt(end)).toBe(0);
    expect(townDayAt(end)).toBe(townDayAt(end - 1) + 1);
    for (const slot of [0, 1])
      expect(new Set(Array.from({ length: 50 }, (_, day) => eventsForDay(day)[slot].id)).size).toBe(
        3,
      );
    expect(eventsForDay(7)).toEqual(eventsForDay(7));
  });
  it('reserves venues in both builder options and shared save/CI validation', () => {
    expect(HOUSE_PLOTS).toHaveLength(141);
    for (const venue of VENUES) {
      expect(HOUSE_PLOTS.some((plot) => plot.id === venue.plot)).toBe(false);
      expect(
        validatePlaces([
          { file: `${sample.id}.json`, data: { ...sample, plot: venue.plot } },
        ]).errors.join(' '),
      ).toContain('reserved');
    }
  });
  it('keeps work, home and sleeping neighbors indoors during events', () => {
    for (const activity of ['work', 'home'] as const) {
      const home = {
        ...sample,
        resident: {
          ...sample.resident,
          routine: {
            morning: activity,
            afternoon: activity,
            evening: activity,
            night: 'sleep' as const,
          },
        },
      };
      for (const minute of [720, 850, 1080, 1200, 1319, 1320]) {
        const state = simulateResidents([home], minute, 9)[0];
        expect(state.event).toBeUndefined();
        expect(state.moving).toBe(false);
        expect(state.activity).toBe(minute === 1320 ? 'sleep' : activity);
      }
    }
  });
  it('walks continuously to a venue, attends, returns home, and sleeps without teleporting', () => {
    const homes = [
      {
        ...walker,
        resident: {
          ...walker.resident,
          routine: { ...walker.resident.routine, morning: 'home' as const },
        },
      },
    ];
    const entrance = plotEntrance(getPlot(walker.plot)!);
    for (const trip of residentTrips(homes, 4).get(walker.id)!) {
      const { event } = trip;
      if (event.venue.kind === 'football')
        throw new Error('Home routine must exclude morning football');
      if (event.venue.kind === 'millpond') throw new Error('Day 4 is spring: nobody skates');
      const stateAt = (t: number) => simulateResidents(homes, t, 4)[0];
      expect(
        Math.hypot(
          stateAt(trip.depart).position.x - entrance.x,
          stateAt(trip.depart).position.y - entrance.y,
        ),
      ).toBeLessThan(1e-8);
      expect(stateAt(Math.max(event.start, trip.arrive) + 1)).toMatchObject({
        moving: false,
        event: { id: event.id, phase: 'attending' },
      });
      for (const boundary of [trip.depart, trip.arrive, event.start, trip.leave, trip.homeBy]) {
        const before = stateAt(boundary - 0.001),
          after = stateAt(boundary);
        expect(
          Math.hypot(before.position.x - after.position.x, before.position.y - after.position.y),
        ).toBeLessThan(0.01);
      }
      for (let minute = trip.depart; minute < trip.homeBy; minute += 0.7) {
        const state = stateAt(minute);
        expect(
          isRoad(Math.floor(state.position.x), Math.floor(state.position.y)) ||
            insideVenue(event.venue, state.position),
        ).toBe(true);
      }
      expect(
        Math.hypot(
          stateAt(trip.homeBy).position.x - entrance.x,
          stateAt(trip.homeBy).position.y - entrance.y,
        ),
      ).toBeLessThan(1e-8);
      expect(stateAt(trip.homeBy).event?.id).not.toBe(event.id);
    }
  });
  it('caps the audience, assigns distinct spots, and does not depend on JSON ordering', () => {
    const crowd = HOUSE_PLOTS.slice(0, 20).map((plot, i) => ({
      ...walker,
      id: `neighbor-${i}`,
      plot: plot.id,
    }));
    for (const [minute, capacity] of [
      [930, 6],
      [1200, 8],
    ]) {
      const isolated = crowd.map((home) => ({
        ...home,
        resident: {
          ...home.resident,
          routine: {
            morning: 'home' as const,
            afternoon: minute < 1080 ? ('stroll' as const) : ('home' as const),
            evening: minute >= 1080 ? ('stroll' as const) : ('home' as const),
            night: 'sleep' as const,
          },
        },
      }));
      const first = simulateResidents(isolated, minute, 19);
      expect(simulateResidents([...isolated].reverse(), minute, 19).reverse()).toEqual(first);
      const attending = first.filter(
        (state) =>
          state.event?.phase === 'attending' &&
          state.event.id !== 'football' &&
          state.event.id !== 'zoo',
      );
      expect(attending).toHaveLength(capacity);
      expect(new Set(attending.map((state) => JSON.stringify(state.position))).size).toBe(capacity);
      expect(attending.every((state) => !state.greeting)).toBe(true);
      const overflow = first.filter((state) => !state.event);
      expect(overflow.length + first.filter((state) => state.event).length).toBe(crowd.length);
      expect(
        overflow.every(
          (state) =>
            state.activity === 'stroll' &&
            !state.pose &&
            isRoad(Math.floor(state.position.x), Math.floor(state.position.y)),
        ),
      ).toBe(true);
    }
  });
  it('keeps every physical spot within the venue and the audience clear of the platform', () => {
    for (const venue of VENUES) {
      const positions = EVENT_SPOTS[venue.kind].map((_, index) => eventSpot(venue, index).position);
      positions.forEach((position, index) => {
        expect(insideVenue(venue, position)).toBe(true);
        if (venue.kind === 'stage')
          expect(position.y - getPlot(venue.plot)!.y - 0.5).toBeGreaterThan(0.2);
        positions
          .slice(index + 1)
          .forEach((other) =>
            expect(Math.hypot(position.x - other.x, position.y - other.y)).toBeGreaterThan(0.6),
          );
      });
    }
  });
  it('uses varied event gestures, with no gestures while traveling or indoors', () => {
    const poses = new Set<string>();
    for (let day = 0; day < 10; day++)
      for (const minute of [880, 895, 912, 934, 1160, 1175, 1190, 1210]) {
        const state = simulateResidents([walker], minute, day)[0];
        if (state.pose) poses.add(state.pose);
      }
    expect([...poses].sort()).toEqual(['chat', 'cheer', 'play', 'read', 'sip', 'sit', 'sway']);
    for (let minute = 360; minute < 1440; minute += 7.7) {
      const state = simulateResidents([walker], minute)[0];
      if (state.moving || !state.event) expect(state.pose).toBeUndefined();
    }
  });
  it('keeps all slots continuous on staggered departures and returns, without entering houses', () => {
    const crowd = HOUSE_PLOTS.slice(0, 12).map((plot, i) => ({
      ...walker,
      id: `crowd-${i}`,
      plot: plot.id,
    }));
    for (const event of eventsForDay(2).filter((event) => event.period !== 'night')) {
      for (let minute = event.depart; minute <= event.homeBy; minute += 1.3) {
        const now = simulateResidents(crowd, minute, 2),
          next = simulateResidents(crowd, minute + 0.001, 2);
        now.forEach((state, index) => {
          if (!state.event || state.event.id !== event.id) return;
          expect(state.greeting).toBe(false);
          expect(
            Math.hypot(
              state.position.x - next[index].position.x,
              state.position.y - next[index].position.y,
            ),
          ).toBeLessThan(stepBound(state, next[index], 0.001, 0.01));
          expect(onRoadOrTube(state) || insideVenue(event.venue, state.position)).toBe(true);
        });
      }
      for (const state of simulateResidents(crowd, event.homeBy, 2))
        if (!state.event) expect(state.pose).toBeUndefined();
    }
  });
  it('labels exact event boundaries and keeps sleeping residents out of the party', () => {
    for (const event of eventsForDay(1)) {
      expect(eventStatus(event, event.start - 1)).toBe(
        event.period === 'night' ? 'Later tonight' : 'Later today',
      );
      expect(eventStatus(event, event.start)).toBe('Happening now');
      expect(eventStatus(event, event.end)).toBe('Finished today');
    }
    expect(simulateResidents([walker], 0, 1)[0].event).toBeUndefined();
  });
});
