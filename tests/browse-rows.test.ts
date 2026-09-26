import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NeighborRow, PlaceRow, PlotRow } from '../src/components/BrowseRows';
import { places } from '../src/lib/places';

describe('The directory rows', () => {
  const select = () => {};
  it('are memoized, so a clock tick skips rows that did not change', () => {
    for (const row of [PlaceRow, PlotRow, NeighborRow])
      expect((row as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
  });

  it('show a house, an open plot and a neighbor as before', () => {
    const place = places[0];
    expect(renderToStaticMarkup(createElement(PlaceRow, { place, onSelect: select }))).toContain(
      `<strong>${place.name}</strong>`,
    );
    expect(
      renderToStaticMarkup(createElement(PlotRow, { plot: 'A1', onSelect: select })),
    ).toContain('<strong>Plot A1</strong>');
    const neighbor = renderToStaticMarkup(
      createElement(NeighborRow, {
        id: place.id,
        resident: place.resident,
        activity: 'Out for a stroll',
        onFollow: select,
      }),
    );
    expect(neighbor).toContain('<small>Out for a stroll</small>');
  });
});
