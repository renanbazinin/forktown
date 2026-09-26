// The opening view's canvas-call budget, which grows with the town a house at a time, so a new
// neighbor can never push `npm run check` over a fixed line while a real regression still fails.
//
// Measured with recordingContext at 1440 × 900, camera { x: 720, y: 88, zoom: 0.7 }, over the
// render-smoke minutes and season-render's eight stages:
// - no houses at all: 28,021–30,227 calls;
// - today's 18 houses: 31,497–33,461;
// - all 141 house plots taken (tests/full-town.ts): 53,945–58,780, about 180 calls a house;
// - all 141 plots holding the heaviest house the builder allows (a café with a gable roof,
//   shutters, a balcony, a bench and a three-run HTML sign): 70,967–77,452 with two floors, and
//   74,492–80,977 with three. That house costs at most about 370 calls at its busiest moment.
// So the budget covers the empty town with ~20% to spare and the heaviest possible house with
// room over, while a frame that doubled its calls fails at every size from 0 to 141 houses.
// Drawing fewer calls (culling, caching) always stays within it.

/** The town without a single house: scenery, venues, sky and weather. */
export const OPENING_VIEW_BASE = 36_000;
/** Each house, with its lawn, path, lantern and seasonal art, at its heaviest. */
export const OPENING_VIEW_PER_HOUSE = 400;

/** The most canvas calls the opening view may make with `houses` houses in town. */
export const openingViewBudget = (houses: number) =>
  OPENING_VIEW_BASE + OPENING_VIEW_PER_HOUSE * houses;
