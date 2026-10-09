import { describe, expect, it } from 'vitest';
import { HOUSE_PLOTS } from '../src/lib/events';
import { insideWater } from '../src/lib/millpond';
import {
  planResidentTrips,
  residentTrips,
  strollRuns,
  withPreview,
} from '../src/lib/resident-trips';
import {
  ERRAND_HOURS,
  ERRAND_MARGIN,
  ERRAND_MAX_MINUTES,
  ERRAND_PAUSE,
  ERRAND_TURN,
  errandState,
  residentErrands,
  seasonalRitual,
  type ErrandTrip,
} from '../src/lib/seasonal-errands';
import { placeSchema, type Place } from '../src/lib/schema';
import { residentGround } from '../src/lib/lanes';
import { simulateResidents } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { opposite, routeLength, WALK_SPEED } from '../src/lib/walking';
import { getPlot, isRoad, plotEntrance, type Point } from '../src/lib/world';
import { fullTown, readPlaces } from './full-town';
import { rosterTimeout } from './roster-timeout';

const real = readPlaces();
const full = fullTown(real);
const YEAR = Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + 224 + i);
const rounds = (homes: Place[], day: number) => [...residentErrands(homes, day).values()].flat();
// Attendance changes as neighbors move in: select a feasible day, never require one fixed date.
const seasonDays = (homes: Place[]) =>
  [0, 1, 2, 3].map((season) => {
    const day = YEAR.slice(season * 28, (season + 1) * 28).find((day) => rounds(homes, day).length);
    if (day === undefined) throw new Error(`No representative errand in season ${season}.`);
    return day;
  });
const SEASON_DAYS = seasonDays(real);
// A preview needs one free plot even in check:full-town's filled fixture. Remove a fixture house
// only when necessary; the published roster being compared is exactly this same base both ways.
const previewPlot =
  HOUSE_PLOTS.find((plot) => !real.some((home) => home.plot === plot.id)) ?? HOUSE_PLOTS[0];
const previewRoster = real.filter((home) => home.plot !== previewPlot.id);
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const copy = (homes: Place[]): Place[] => homes.map((home) => placeSchema.parse(home));
const carrierAt = (homes: Place[], trip: ErrandTrip, minute: number) =>
  simulateResidents(homes, minute, trip.day).find((resident) => resident.id === trip.residentId)!;

describe('One small seasonal errand', () => {
  it('finds real residents for all four rituals, including the winter walk to the shore', () => {
    expect(SEASON_DAYS.map((day) => seasonalRitual(day).kind)).toEqual([
      'seedlings',
      'lemonade',
      'harvest',
      'thermos',
    ]);
    for (const day of SEASON_DAYS) {
      const list = rounds(real, day);
      expect(list).toHaveLength(1);
      expect(real.some((home) => home.id === list[0].residentId)).toBe(true);
      expect(list[0].ritual).toEqual(seasonalRitual(day));
    }
    expect(seasonalRitual(SEASON_DAYS[2]).pickup.plot).toBe('C1');
    expect(seasonalRitual(SEASON_DAYS[3]).delivery.point.y).toBeGreaterThan(37);
  });

  it(
    'fits the entire round between existing outings and inside a daytime stroll run',
    () => {
      for (const homes of [real, full])
        for (const day of YEAR) {
          const outings = residentTrips(homes, day);
          const before = JSON.stringify([...outings]);
          const list = rounds(homes, day);
          expect(list.length).toBeLessThanOrEqual(1);
          for (const trip of list) {
            const home = homes.find((candidate) => candidate.id === trip.residentId)!;
            expect(trip.depart).toBeGreaterThanOrEqual(ERRAND_HOURS.from + ERRAND_MARGIN);
            expect(trip.homeBy - trip.depart).toBeLessThanOrEqual(ERRAND_MAX_MINUTES + 1e-9);
            expect(trip.homeBy).toBeLessThanOrEqual(ERRAND_HOURS.until - ERRAND_MARGIN + 1e-9);
            expect(
              strollRuns(home).some(
                (run) =>
                  trip.depart >= run.start + ERRAND_MARGIN &&
                  trip.homeBy <= run.end - ERRAND_MARGIN + 1e-9,
              ),
            ).toBe(true);
            for (const event of outings.get(home.id) ?? [])
              expect(
                trip.homeBy + ERRAND_MARGIN <= event.depart + 1e-9 ||
                  event.homeBy + ERRAND_MARGIN <= trip.depart + 1e-9,
              ).toBe(true);
            expect(trip.segments.map((segment) => segment.phase)).toEqual([
              'outbound',
              'pickup',
              'carrying',
              'dropoff',
              'returning',
            ]);
            expect(trip.segments[0].start).toBe(trip.depart);
            expect(trip.segments.at(-1)!.end).toBe(trip.homeBy);
            for (const [index, segment] of trip.segments.entries()) {
              if (index) expect(segment.start).toBe(trip.segments[index - 1].end);
              expect(segment.end - segment.start).toBeCloseTo(
                'route' in segment ? routeLength(segment.route) / WALK_SPEED : ERRAND_PAUSE,
                9,
              );
            }
          }
          expect(JSON.stringify([...outings])).toBe(before);
          expect([...residentTrips(homes, day)]).toEqual([...planResidentTrips(homes, day)]);
        }
    },
    rosterTimeout(250, 60_000),
  );

  it('skips a round when nobody has time, and a private preview never becomes its carrier', () => {
    const working = copy(previewRoster).map((home) => ({
      ...home,
      resident: {
        ...home.resident,
        routine: {
          morning: 'work' as const,
          afternoon: 'home' as const,
          evening: 'home' as const,
          night: 'stroll' as const,
        },
      },
    }));
    const draft = placeSchema.parse({
      ...real[0],
      id: 'errand-preview',
      plot: previewPlot.id,
      resident: {
        ...real[0].resident,
        routine: {
          morning: 'stroll',
          afternoon: 'stroll',
          evening: 'stroll',
          night: 'stroll',
        },
      },
    });
    for (const day of SEASON_DAYS) {
      expect(rounds(working, day)).toEqual([]);
      expect(rounds(withPreview(working, draft), day)).toEqual([]);
      expect(rounds(withPreview(previewRoster, draft), day)).toEqual(rounds(previewRoster, day));
    }
    expect(rounds([], SEASON_DAYS[0])).toEqual([]);
  });

  it('plans the same round after reloads, roster reorderings, and unrelated earlier questions', () => {
    for (const day of SEASON_DAYS) {
      const expected = rounds(real, day);
      const reordered = copy(real).reverse();
      for (const otherDay of [day + 6, day - 1, day + 112, day - 200]) rounds(reordered, otherDay);
      expect(rounds(reordered, day)).toEqual(expected);
      expect(rounds(copy(real), day)).toEqual(expected);
    }
  });

  it('walks physical road routes and the short kerb approaches, never onto the pond', () => {
    for (const day of SEASON_DAYS) {
      const trip = rounds(real, day)[0];
      const home = real.find((candidate) => candidate.id === trip.residentId)!;
      const entrance = plotEntrance(getPlot(home.plot)!);
      const first = trip.segments[0],
        last = trip.segments.at(-1)!;
      expect('route' in first && first.route[0]).toEqual(entrance);
      expect('route' in last && last.route.at(-1)).toEqual(entrance);
      for (const segment of trip.segments) {
        if (!('route' in segment)) {
          expect(insideWater(segment.position)).toBe(false);
          continue;
        }
        for (let index = 1; index < segment.route.length; index++) {
          const a = segment.route[index - 1],
            b = segment.route[index];
          expect(a.x === b.x || a.y === b.y).toBe(true);
          for (let f = 0; f <= 1; f += 0.1) {
            const point = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
            expect(insideWater(point)).toBe(false);
            expect(isRoad(Math.floor(point.x), Math.floor(point.y))).toBe(true);
          }
        }
      }
    }
  });

  it('keeps every handoff and home transition continuous, with a quarter turn before walking back', () => {
    const epsilon = 0.0001;
    for (const day of SEASON_DAYS) {
      const trip = rounds(real, day)[0];
      const boundaries = [trip.depart, ...trip.segments.map((segment) => segment.end)];
      for (const boundary of boundaries) {
        const before = carrierAt(real, trip, boundary - epsilon);
        const after = carrierAt(real, trip, boundary + epsilon);
        expect(distance(before.position, after.position)).toBeLessThan(0.001);
        expect(distance(residentGround(before), residentGround(after))).toBeLessThan(0.001);
        expect(opposite(before.facing, after.facing)).toBe(false);
      }
      for (const segment of trip.segments) {
        if ('route' in segment) {
          for (let minute = segment.start + 0.01; minute < segment.end - 0.1; minute += 2) {
            const before = errandState(trip, minute),
              after = errandState(trip, minute + 0.1);
            expect(distance(before.position!, after.position!)).toBeLessThanOrEqual(
              WALK_SPEED * 0.1 + 1e-9,
            );
            expect(before.errand?.phase).toBe(segment.phase);
          }
        } else {
          expect(errandState(trip, segment.start).errand?.progress).toBe(0);
          expect(errandState(trip, segment.start + ERRAND_TURN / 2).errand?.progress).toBe(0);
          expect(errandState(trip, segment.end - ERRAND_TURN / 2).errand?.progress).toBe(1);
          let previous = errandState(trip, segment.start);
          for (let minute = segment.start + 0.05; minute < segment.end; minute += 0.05) {
            const state = errandState(trip, minute);
            expect(opposite(previous.facing!, state.facing!)).toBe(false);
            expect(state.position).toEqual(segment.position);
            expect(state.errand!.progress).toBeGreaterThanOrEqual(previous.errand!.progress);
            previous = state;
          }
        }
      }
      expect(carrierAt(real, trip, trip.depart - epsilon).errand).toBeUndefined();
      expect(carrierAt(real, trip, trip.depart).errand?.phase).toBe('outbound');
      expect(carrierAt(real, trip, trip.homeBy).errand).toBeUndefined();
      for (const segment of trip.segments) {
        const state = carrierAt(real, trip, (segment.start + segment.end) / 2);
        expect(state.errand?.phase).toBe(segment.phase);
        expect(state.event).toBeUndefined();
        expect(state.transit).toBeUndefined();
        expect(state.greeting).toBe(false);
      }
    }
  }, 30_000);

  it('keeps the carrier and its lanes unchanged in a preview and in a reordered town', () => {
    const draft = placeSchema.parse({
      ...real[0],
      id: 'errand-lane-preview',
      plot: previewPlot.id,
    });
    const preview = withPreview(previewRoster, draft),
      reordered = copy(previewRoster).reverse();
    for (const day of seasonDays(previewRoster)) {
      const trip = rounds(previewRoster, day)[0];
      for (const segment of trip.segments) {
        const time = (segment.start + segment.end) / 2;
        const state = carrierAt(previewRoster, trip, time);
        expect(carrierAt(preview, trip, time)).toEqual(state);
        expect(carrierAt(reordered, trip, time)).toEqual(state);
      }
    }
  }, 30_000);
});
