import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NeighborRow, PlaceRow, PlotRow } from '../src/components/BrowseRows';
import { paintWhenNear } from '../src/components/BuildingPreview';
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

  it('paints a full town’s house previews only as their rows come near the view', () => {
    // A stand-in observer: the test says which rows are in view.
    const watching = new Map<Element, (entries: IntersectionObserverEntry[]) => void>();
    let margin = '';
    class Watch {
      constructor(
        private readonly report: (entries: IntersectionObserverEntry[]) => void,
        options: IntersectionObserverInit,
      ) {
        margin = options.rootMargin ?? '';
      }
      observe(element: Element) {
        watching.set(element, this.report);
      }
      disconnect() {
        for (const [element, report] of watching)
          if (report === this.report) watching.delete(element);
      }
    }
    const rows = Array.from({ length: 230 }, (_, i) => ({ row: i }) as unknown as Element);
    const painted: number[] = [];
    const cleanups = rows.map((row, i) =>
      paintWhenNear(row, () => painted.push(i), Watch as unknown as typeof IntersectionObserver),
    );
    expect(margin).toBe('200px');
    expect(painted).toEqual([]);
    // The first nine rows are in view; one more scrolls near later, and an out-of-view report
    // paints nothing.
    const report = (i: number, isIntersecting: boolean) =>
      watching.get(rows[i])?.([{ isIntersecting } as IntersectionObserverEntry]);
    for (let i = 0; i < 9; i++) report(i, true);
    report(40, false);
    report(12, true);
    expect(painted).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 12]);
    // Each paints once, then stops watching; unmounting stops the rest.
    report(0, true);
    expect(painted).toHaveLength(10);
    expect(watching.size).toBe(220);
    for (const cleanup of cleanups) cleanup();
    expect(watching.size).toBe(0);
    // Without an observer (server rendering), it paints at once.
    paintWhenNear(rows[0], () => painted.push(-1), undefined);
    expect(painted.at(-1)).toBe(-1);
    // Only the directory's rows wait; the home's own picture paints at once.
    expect(readFileSync('src/components/BrowseRows.tsx', 'utf8')).toContain(
      '<BuildingPreview place={place} size={48} lazy />',
    );
  });
});
