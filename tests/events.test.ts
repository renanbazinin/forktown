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
    expect(HOUSE_PLOTS).toHaveLength(48);
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
    const entrance = plotEntrance(getPlot(walker.plot)!);
    for (const event of eventsForDay(4)) {
      expect(simulateResidents([walker], event.depart, 4)[0].position).toEqual(entrance);
      expect(simulateResidents([walker], event.start + 1, 4)[0]).toMatchObject({
        moving: false,
        facing: eventSpot(event.venue, 0).facing,
        event: { id: event.id, phase: 'attending' },
      });
      for (const boundary of [event.start, event.end, event.homeBy]) {
        const before = simulateResidents([walker], boundary - 0.001, 4)[0];
        const after = simulateResidents([walker], boundary, 4)[0];
        expect(
          Math.hypot(before.position.x - after.position.x, before.position.y - after.position.y),
        ).toBeLessThan(0.01);
      }
      for (let minute = event.depart; minute < event.homeBy; minute += 0.7) {
        const state = simulateResidents([walker], minute, 4)[0];
        expect(
          isRoad(Math.floor(state.position.x), Math.floor(state.position.y)) ||
            insideVenue(event.venue, state.position),
        ).toBe(true);
      }
      expect(simulateResidents([walker], event.homeBy, 4)[0].position).toEqual(entrance);
      expect(simulateResidents([walker], event.homeBy, 4)[0].event).toBeUndefined();
    }
  });
  it('caps the audience, assigns distinct spots, and does not depend on JSON ordering', () => {
    const crowd = HOUSE_PLOTS.slice(0, 20).map((plot, i) => ({
      ...walker,
      id: `neighbor-${i}`,
      plot: plot.id,
    }));
    for (const [minute, capacity] of [
      [850, 6],
      [1200, 8],
    ]) {
      const first = simulateResidents(crowd, minute, 19);
      expect(simulateResidents([...crowd].reverse(), minute, 19).reverse()).toEqual(first);
      const attending = first.filter((state) => state.event?.phase === 'attending');
      expect(attending).toHaveLength(capacity);
      expect(new Set(attending.map((state) => JSON.stringify(state.position))).size).toBe(capacity);
      expect(attending.every((state) => !state.greeting)).toBe(true);
      const overflow = first.filter((state) => !state.event);
      expect(overflow).toHaveLength(crowd.length - capacity);
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
      for (const minute of [800, 815, 832, 854, 1160, 1175, 1190, 1210]) {
        const state = simulateResidents([walker], minute, day)[0];
        if (state.pose) poses.add(state.pose);
      }
    expect([...poses].sort()).toEqual(['chat', 'cheer', 'play', 'read', 'sip', 'sit', 'sway']);
    for (const minute of [740, 1000, 1100, 1300, 1320])
      expect(simulateResidents([walker], minute)[0].pose).toBeUndefined();
  });
  it('keeps all slots continuous on staggered departures and returns, without entering houses', () => {
    const crowd = HOUSE_PLOTS.slice(0, 12).map((plot, i) => ({
      ...walker,
      id: `crowd-${i}`,
      plot: plot.id,
    }));
    for (const event of eventsForDay(2)) {
      for (let minute = event.depart; minute <= event.homeBy; minute += 1.3) {
        const now = simulateResidents(crowd, minute, 2),
          next = simulateResidents(crowd, minute + 0.001, 2);
        now.forEach((state, index) => {
          if (!state.event) return;
          expect(state.greeting).toBe(false);
          expect(
            Math.hypot(
              state.position.x - next[index].position.x,
              state.position.y - next[index].position.y,
            ),
          ).toBeLessThan(0.01);
          expect(
            isRoad(Math.floor(state.position.x), Math.floor(state.position.y)) ||
              insideVenue(event.venue, state.position),
          ).toBe(true);
        });
      }
      for (const state of simulateResidents(crowd, event.homeBy, 2))
        if (!state.moving) expect(state.pose).toBeUndefined();
    }
  });
  it('labels the exact event boundaries without running the event overnight', () => {
    for (const event of eventsForDay(1)) {
      expect(eventStatus(event, event.start - 1)).toBe('Later today');
      expect(eventStatus(event, event.start)).toBe('Happening now');
      expect(eventStatus(event, event.end)).toBe('Finished today');
    }
    expect(simulateResidents([walker], 0, 1)[0].event).toBeUndefined();
  });
});
