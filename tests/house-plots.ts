// The house plots, derived the way a contributor meets them: every plot the shared schema lets a
// house stand on. Tests compare HOUSE_PLOTS with this instead of pinning a count, so the town can
// grow without touching them (tests/district-places.test.ts holds the one explicit pin).
import { readFileSync } from 'node:fs';
import { placeSchema } from '../src/lib/schema';
import { PLOTS } from '../src/lib/world';

let ids: string[] | undefined;
export function schemaHousePlots(): readonly string[] {
  if (!ids) {
    const sample = JSON.parse(readFileSync('places/my-little-place.json', 'utf8'));
    ids = PLOTS.filter((plot) => placeSchema.safeParse({ ...sample, plot: plot.id }).success).map(
      (plot) => plot.id,
    );
  }
  return ids;
}
