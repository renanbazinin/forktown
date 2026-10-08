import { describe, expect, it } from 'vitest';
import { HOUSE_PLOTS } from '../src/lib/events';
import { openPlotsNear, placeSchema, type Place } from '../src/lib/schema';
import { restoreSavedDraft } from '../src/lib/saved-draft';

// A town of its own, so the checks hold however full the real one gets.
const neighbor: Place = placeSchema.parse({
  id: 'moss-nook',
  name: 'Moss Nook',
  creator: 'neighbor',
  plot: 'Q1',
  building: 'cottage',
  color: '#789B76',
  decoration: 'flowers',
  story: 'A green door and a kettle that is always on.',
});
const town = [neighbor];
const taken = new Set(town.map((place) => place.plot));
const available = HOUSE_PLOTS.filter((plot) => !taken.has(plot.id));
// A draft saved before R1 became Barley Halt on the Treeline, as localStorage holds it.
const saved = {
  ...neighbor,
  id: 'barley-house',
  name: 'Barley House',
  creator: 'newcomer',
  plot: 'R1',
  story: 'Half finished, ',
  resident: { ...neighbor.resident, name: 'Wren', greeting: 'Mind the step!' },
  sign: { ...neighbor.sign, mode: 'text', text: 'BARLEY' },
};

describe('A draft saved on this device', () => {
  it('keeps its work when its plot became a public place, on the nearest open plot', () => {
    const restored = restoreSavedDraft(
      JSON.parse(JSON.stringify(saved)),
      undefined,
      town,
      available,
    );
    expect(restored).not.toBeNull();
    // Q1 is the nearest to R1, but a neighbor lives there.
    expect(restored!.plot).toBe(openPlotsNear('R1', taken, 1)[0]);
    expect(restored!.plot).not.toBe('Q1');
    expect(restored).toMatchObject({
      id: 'barley-house',
      name: 'Barley House',
      creator: 'newcomer',
      story: 'Half finished, ',
      resident: { name: 'Wren', greeting: 'Mind the step!' },
      sign: { mode: 'text', text: 'BARLEY' },
    });
  });

  it('moves to the open plot the builder was opened on', () => {
    const plot = available[5].id;
    expect(restoreSavedDraft(saved, plot, town, available)?.plot).toBe(plot);
  });

  it('keeps an open plot it already had', () => {
    const plot = available.at(-1)!.id;
    expect(restoreSavedDraft({ ...saved, plot }, undefined, town, available)?.plot).toBe(plot);
  });

  it('starts afresh from anything it cannot read', () => {
    for (const junk of [null, 'R1', [], 7, { ...saved, building: 'castle' }])
      expect(restoreSavedDraft(junk, undefined, town, available)).toBeNull();
  });
});
