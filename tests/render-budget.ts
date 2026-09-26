// The opening view's canvas-call budget, which grows with the town a house at a time, so a new
// neighbor can never push `npm run check` over a fixed line while a real regression still fails.
//
// Measured with recordingContext at 1440 × 900, camera { x: 720, y: 88, zoom: 0.7 }, over the
// render-smoke moments and two deep-winter ones. Houses and walkers outside the view are culled,
// so only the houses the view can show cost anything:
// - no houses at all: 28,052–29,853 calls;
// - today's 18 houses: 31,598–32,936;
// - all 141 house plots taken (tests/full-town.ts): 39,864–42,718, with neighbors out 40,106–42,395;
// - the heaviest house the builder allows (a café with a gable roof, shutters, a balcony, a bench
//   and a three-run HTML sign) on the first 10, 30, 60, 90 and all 141 plots: 32,070, 38,374,
//   48,245, 52,346 and 52,844 at most. Each one in view costs about 300 calls, and past about 90
//   houses every plot the view can show is taken.
// So the budget covers the empty town with ~20% to spare and a town of the heaviest house at every
// size, while a frame that doubled its calls fails at every size from 0 to 141 houses, even with
// most houses out of view. Drawing fewer calls (caching) always stays within it.

/** The town without a single house: scenery, venues, sky and weather. */
export const OPENING_VIEW_BASE = 36_000;
/** Each house in view, with its lawn, path, lantern and seasonal art, at its heaviest. */
export const OPENING_VIEW_PER_HOUSE = 300;
/** The most houses the opening view shows; the rest are culled. */
export const OPENING_VIEW_HOUSES = 90;

/** The most canvas calls the opening view may make with `houses` houses in town. */
export const openingViewBudget = (houses: number) =>
  OPENING_VIEW_BASE + OPENING_VIEW_PER_HOUSE * Math.min(houses, OPENING_VIEW_HOUSES);
