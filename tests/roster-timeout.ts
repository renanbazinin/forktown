// Timeouts for the tests that sweep the whole roster. Their work grows with the town (in the full
// town check every house plot is taken), so their limit grows with the plot count too, and never
// falls below a floor measured on a busy desktop at 230 house plots.
import { HOUSE_PLOTS } from '../src/lib/events';

/** max(floor, perHome × house plots), in milliseconds. */
export const rosterTimeout = (perHomeMs: number, floorMs: number) =>
  Math.max(floorMs, perHomeMs * HOUSE_PLOTS.length);
