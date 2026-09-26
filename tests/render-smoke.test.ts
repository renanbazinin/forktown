import { describe, expect, it } from 'vitest';
import { renderCity } from '../src/city/render';
import { eventsForDay, HOUSE_PLOTS } from '../src/lib/events';
import { placeSchema, type Place } from '../src/lib/schema';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { fullTown, fullTownHouse, readPlaces } from './full-town';
import { recordingContext } from './recording-context';
import { openingViewBudget } from './render-budget';

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

// A node frame of the opening view at noon, golden hour, mid Lantern hour and deep night.
// The budget keeps the lanterns, posts and stakes from quietly multiplying the draw calls, and
// grows with the town a house at a time (see render-budget.ts).
const MOMENTS = [720, 1165, 1205, 180];

describe('Rendering the opening view in node', () => {
  it.each(MOMENTS)('draws minute %s within the call budget', (minutes) => {
    const calls = openingView(places, minutes);
    expect(calls).toBeGreaterThan(1000);
    expect(calls).toBeLessThan(openingViewBudget(places.length));
  });
});

// The heaviest house the builder allows: every choice that draws the most, and a sign of three
// full runs. Measured over every design, sign and season in render-budget.ts.
const FULL_SIGN = `<div style="background-color: #35554A; color: #FFF4D4; text-align: center">
  <strong style="font-size: 24px">WELCOME TO THE BIG HOUSE</strong>
  <p style="font-size: 12px">PLEASE MIND THE DUCKLING</p>
  <span style="font-size: 16px">OPEN EVERY SINGLE NIGHT!</span>
</div>`;
const heaviest = (plot: string) => {
  const house = fullTownHouse(plot);
  return placeSchema.parse({
    ...house,
    building: 'cafe',
    decoration: 'bench',
    design: {
      ...house.design,
      floors: 2,
      roof: 'gable',
      windows: 'shutters',
      garden: 'wildflowers',
      feature: 'balcony',
    },
    sign: { ...house.sign, mode: 'html', html: FULL_SIGN },
  });
};
// The busiest winter noon and night measured for the houses' own snow and lanterns.
const DEEP_WINTER = [
  { day: CALENDAR_EPOCH_DAY + 87, minutes: 720 },
  { day: CALENDAR_EPOCH_DAY + 86, minutes: 1320 },
];

describe('Rendering a full town in node', () => {
  // Today's neighbors where they live, and a made-up house on every plot still free.
  const town = fullTown(places);

  it('takes every house plot', () => {
    expect(town).toHaveLength(HOUSE_PLOTS.length);
    expect(new Set(town.map((place) => place.plot)).size).toBe(HOUSE_PLOTS.length);
  });

  it.each(MOMENTS)(
    'draws minute %s, neighbors out and about, within the call budget',
    (minutes) => {
      const residents = simulateResidents(town, minutes, 3);
      expect(residents).toHaveLength(town.length);
      expect(openingView(town, minutes, 3, residents)).toBeLessThan(openingViewBudget(town.length));
    },
  );

  it('fits a town of the heaviest house at every size, so no house can outgrow the budget', () => {
    const heavy = HOUSE_PLOTS.map((plot) => heaviest(plot.id));
    for (const size of [10, 30, 60, 90, heavy.length])
      for (const { day, minutes } of [
        ...MOMENTS.map((minutes) => ({ day: 3, minutes })),
        ...DEEP_WINTER,
      ])
        expect(
          openingView(heavy.slice(0, size), minutes, day),
          `${size} ${day} ${minutes}`,
        ).toBeLessThan(openingViewBudget(size));
  }, 30_000);

  it('fails a frame that doubled its calls, even with most houses out of view', () => {
    // The plots run north to south, so the reversed town fills the far side first.
    for (const order of [town, [...town].reverse()])
      for (const size of [0, 18, 60, 90, town.length])
        for (const minutes of MOMENTS)
          expect(
            2 * openingView(order.slice(0, size), minutes),
            `${size} ${minutes}`,
          ).toBeGreaterThan(openingViewBudget(size));
  }, 30_000);
});
