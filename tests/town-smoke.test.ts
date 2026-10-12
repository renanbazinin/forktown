import { describe, expect, it } from 'vitest';
import { renderCity } from '../src/city/render';
import { eventsForDay } from '../src/lib/events';
import type { Place } from '../src/lib/schema';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY, DAYS_PER_SEASON, DAYS_PER_YEAR } from '../src/lib/town-calendar';
import { fullTown, readPlaces } from './full-town';
import { recordingContext } from './recording-context';

// A crash check for the town: the real town and the town with every house plot taken render
// their opening view, and the full town's neighbors live through days across the whole year,
// without throwing. A new house must never break the town. Nothing here checks how many canvas
// calls a frame makes, or where, how fast or when the neighbors walk.

const places = readPlaces();

/** The opening view's canvas calls for a town at a moment. */
function openingView(town: Place[], minutes: number, day = 3, residents: ResidentState[] = []) {
  const { ctx, calls } = recordingContext(1440, 900);
  expect(() =>
    renderCity({
      ctx,
      width: 1440,
      height: 900,
      camera: { x: 720, y: 88, zoom: 0.7 },
      places: town,
      selectedPlot: null,
      hoveredPlot: null,
      night: minutes < 360 || minutes >= 1200,
      showPlots: false,
      residents,
      events: residents.length ? eventsForDay(day) : [],
      minutes,
      day,
    }),
  ).not.toThrow();
  return calls.length;
}

// Noon, golden hour, mid Lantern hour and deep night.
const MOMENTS = [720, 1165, 1205, 180];
// A winter noon in the snow and a winter night with every lantern lit.
const DEEP_WINTER = [
  { day: CALENDAR_EPOCH_DAY + 87, minutes: 720 },
  { day: CALENDAR_EPOCH_DAY + 86, minutes: 1320 },
];

describe('Rendering the opening view in node', () => {
  it.each(MOMENTS)('draws minute %s', (minutes) => {
    // Only a sign that the town was drawn at all; there is no upper limit.
    expect(openingView(places, minutes)).toBeGreaterThan(1000);
  });
});

describe('The full town', () => {
  // Today's neighbors where they live, and a made-up house on every plot still free.
  const town = fullTown(places);

  it.each(MOMENTS)('draws minute %s with the neighbors out and about', (minutes) => {
    const residents = simulateResidents(town, minutes, 3);
    expect(residents).toHaveLength(town.length);
    expect(openingView(town, minutes, 3, residents)).toBeGreaterThan(1000);
  });

  it.each(DEEP_WINTER)('draws day $day, minute $minutes, in deep winter', ({ day, minutes }) => {
    const residents = simulateResidents(town, minutes, day);
    expect(residents).toHaveLength(town.length);
    expect(openingView(town, minutes, day, residents)).toBeGreaterThan(1000);
  });

  // Five days, every half hour: the first of spring, whose small hours still run on the plan for
  // the last night of winter; a summer and an autumn day; a winter day with the Millpond frozen
  // over for skating (from the 9th to the 19th of winter, iceOn in millpond.ts); and day 3, the
  // day the frames above draw. Every day has its afternoon gathering, concert, film, disco and zoo trip.
  const DAYS = [
    CALENDAR_EPOCH_DAY + DAYS_PER_YEAR,
    CALENDAR_EPOCH_DAY + DAYS_PER_SEASON + 10,
    CALENDAR_EPOCH_DAY + 2 * DAYS_PER_SEASON + 10,
    CALENDAR_EPOCH_DAY + 3 * DAYS_PER_SEASON + 11,
    3,
  ];
  it('simulates days across the whole year without losing a neighbor', () => {
    const lost: string[] = [];
    for (const day of DAYS)
      for (let minutes = 0; minutes < 1440; minutes += 30) {
        const residents = simulateResidents(town, minutes, day);
        expect(residents, `day ${day}, minute ${minutes}`).toHaveLength(town.length);
        for (const { id, position } of residents)
          if (!Number.isFinite(position.x) || !Number.isFinite(position.y))
            lost.push(`${id} on day ${day} at minute ${minutes}`);
      }
    expect(lost).toEqual([]);
    // About 2 s on a laptop with every plot taken; the slack is for slower CI machines.
  }, 20_000);
});
