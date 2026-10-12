// Builder drafts and older house files keep working.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { restoreDraftDesign, restoreDraftPlot } from '../src/lib/builder-nudges';
import { HOUSE_PLOTS } from '../src/lib/events';
import { FORK_PLOT } from '../src/lib/lanterns';
import {
  DEFAULT_DESIGN,
  DEFAULT_RESIDENT,
  draftSchema,
  openPlotsNear,
  placeSchema,
  residentSchema,
} from '../src/lib/schema';

const legacyPlace = JSON.parse(readFileSync('examples/my-little-place.json', 'utf8'));
const { figure: _figure, ...legacyResident } = DEFAULT_RESIDENT;

describe('Resident figure compatibility', () => {
  it('keeps the original figure for old places and browser drafts', () => {
    for (const schema of [placeSchema, draftSchema]) {
      expect(schema.parse(legacyPlace).resident.figure).toBe('male');
      expect(schema.parse({ ...legacyPlace, resident: legacyResident }).resident.figure).toBe(
        'male',
      );
    }
    expect(
      draftSchema.parse({ ...legacyPlace, resident: { ...legacyResident, name: '', greeting: '' } })
        .resident.figure,
    ).toBe('male');
  });

  it.each(['male', 'female'] as const)(
    'preserves %s through draft storage and JSON export',
    (figure) => {
      const input = { ...legacyPlace, resident: { ...DEFAULT_RESIDENT, figure } };
      const restored = draftSchema.parse(JSON.parse(JSON.stringify(input)));
      const exported = JSON.stringify(placeSchema.parse(restored));
      expect(placeSchema.parse(JSON.parse(exported)).resident).toEqual(input.resident);
    },
  );

  it.each(['unknown', '', null, 1, {}])('rejects unsupported figure values: %j', (figure) => {
    for (const schema of [placeSchema, draftSchema])
      expect(
        schema.safeParse({ ...legacyPlace, resident: { ...DEFAULT_RESIDENT, figure } }).success,
      ).toBe(false);
  });

  it('retains strict validation for unrelated fields', () => {
    expect(residentSchema.safeParse({ ...DEFAULT_RESIDENT, unexpected: true }).success).toBe(false);
  });
});

describe('Restoring a builder draft', () => {
  it('moves a restored draft off a taken or reserved plot', () => {
    // A small town of its own, so the check holds however full the real one gets.
    const taken = new Set(['C6', 'D4', 'E5']);
    const available = HOUSE_PLOTS.filter((plot) => !taken.has(plot.id));
    expect(restoreDraftPlot(available[3].id, available)).toBe(available[3].id);
    // It stays in the part of town it chose: the nearest open plot, as a plot clash suggests.
    for (const plot of [FORK_PLOT, 'C6', 'R1', 'A9', 'D14', 'T15'])
      expect(restoreDraftPlot(plot, available), plot).toBe(openPlotsNear(plot, taken, 1)[0]);
    expect(restoreDraftPlot('Z99', available)).toBe(available[0].id);
    expect(restoreDraftPlot('C6', [])).toBe('A1');
  });

  it('brings back a three-floor draft with two floors', () => {
    const tall = { ...DEFAULT_DESIGN, floors: 3 as const, feature: 'balcony' as const };
    expect(restoreDraftDesign(tall)).toEqual({ ...tall, floors: 2 });
    for (const floors of [1, 2] as const) {
      const design = { ...DEFAULT_DESIGN, floors };
      expect(restoreDraftDesign(design)).toBe(design);
    }
  });
});
