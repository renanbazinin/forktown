import type { Place } from './schema';
import { hash } from './world';

// A night owl's night out runs from 22:00 (or straight on from a strolling evening) until their
// bedtime. It is planned like any free window (src/lib/home-life.ts): moonlit loops round the
// blocks and night stays on their own bench, porch or front step, in through the door by bedtime.

/** Bedtimes belong to the evening: 1440 is midnight, 1740 is 05:00. */
export function nightBedtime(home: Place): number {
  return 1440 + (hash(home.id) % 3) * 120 + (hash(`bedtime-offset:${home.id}`) % 61);
}
