import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { linkHash, MISSING_LINK_COPY, readDeepLink, shareUrl } from '../src/lib/deep-link';
import { CINEMA_PLOTS, CINEMA_VENUE } from '../src/lib/cinema';
import { HOUSE_PLOTS, VENUES } from '../src/lib/events';
import { FARM, FARM_PLOTS } from '../src/lib/farm';
import { FOOTBALL_VENUE } from '../src/lib/football';
import { FORK_PLOT } from '../src/lib/lanterns';
import { MILLPOND_VENUE } from '../src/lib/millpond';
import { places } from '../src/lib/places';
import { TUBE_VENUE } from '../src/lib/tubes';
import { ZOO_PLOTS, ZOO_VENUE } from '../src/lib/zoo';

const venuePlot = (id: string) => VENUES.find((venue) => venue.id === id)!.plot;

describe('Shared links', () => {
  const home = places[0];

  it('finds a house by its id and a venue by its name', () => {
    expect(readDeepLink(`#place=${home.id}`, places)).toEqual({ plot: home.plot });
    expect(readDeepLink('#venue=cinema', places)).toEqual({ plot: CINEMA_VENUE.plot });
    expect(readDeepLink('#venue=fork', places)).toEqual({ plot: FORK_PLOT });
  });

  it('links the Little Stage, where the Midnight Disco plays, and the Lunch Green', () => {
    expect(venuePlot('stage')).toBe('B5');
    expect(venuePlot('green')).toBe('C5');
    expect(readDeepLink('#venue=stage', places)).toEqual({ plot: 'B5' });
    expect(readDeepLink('#venue=green', places)).toEqual({ plot: 'C5' });
    expect(linkHash('B5', places)).toBe('#venue=stage');
    expect(linkHash('C5', places)).toBe('#venue=green');
  });

  it('says when a link points at something the town does not have', () => {
    expect(readDeepLink('#place=no-such-house', places)).toEqual({ missing: 'place' });
    expect(readDeepLink('#place=', places)).toEqual({ missing: 'place' });
    expect(readDeepLink('#venue=moon', places)).toEqual({ missing: 'venue' });
    expect(readDeepLink('#venue=toString', places)).toEqual({ missing: 'venue' });
    expect(MISSING_LINK_COPY.place).toMatch(/isn’t in town yet/);
  });

  it('prefers a house over an unknown venue, and ignores other hashes', () => {
    expect(readDeepLink(`#venue=moon&place=${home.id}`, places)).toEqual({ plot: home.plot });
    expect(readDeepLink('', places)).toBeNull();
    expect(readDeepLink('#welcome=1', places)).toBeNull();
  });

  it('writes the link for every house and venue that reads back to the same plot', () => {
    for (const place of places) expect(linkHash(place.plot, places)).toBe(`#place=${place.id}`);
    for (const plot of [
      FARM.plot,
      MILLPOND_VENUE.plot,
      TUBE_VENUE.plot,
      FOOTBALL_VENUE.plot,
      CINEMA_VENUE.plot,
      ZOO_VENUE.plot,
      FORK_PLOT,
      venuePlot('stage'),
      venuePlot('green'),
    ]) {
      const hash = linkHash(plot, places);
      expect(hash, plot).toMatch(/^#venue=/);
      expect(readDeepLink(hash, places), plot).toEqual({ plot });
    }
    // Any plot of a venue links to the venue.
    for (const plot of [...FARM_PLOTS, ...CINEMA_PLOTS, ...ZOO_PLOTS])
      expect(readDeepLink(linkHash(plot, places), places)).not.toBeNull();
    const empty = HOUSE_PLOTS.find(({ id }) => !places.some((place) => place.plot === id));
    if (empty) expect(linkHash(empty.id, places)).toBe('');
    expect(linkHash(null, places)).toBe('');
  });

  it('shares a published house’s own page from a built town, and a hash link otherwise', () => {
    // Made-up houses, so no real one can change the answer.
    const town = [
      { id: 'moon-cafe', plot: 'A1' },
      { id: 'quiet-corner', plot: 'A2' },
    ];
    const built = {
      href: 'https://neighbor.github.io/forktown/#place=quiet-corner',
      base: '/forktown/',
      pages: true,
    };
    expect(shareUrl('A1', town, built)).toBe(
      'https://neighbor.github.io/forktown/house/moon-cafe/',
    );
    expect(
      shareUrl('A1', town, { href: 'https://town.example/?x=1', base: '/', pages: true }),
    ).toBe('https://town.example/house/moon-cafe/');
    // The dev server has no house pages; the address keeps its path and query.
    expect(
      shareUrl('A1', town, {
        href: 'http://127.0.0.1:5173/?x=1#venue=fork',
        base: '/',
        pages: false,
      }),
    ).toBe('http://127.0.0.1:5173/?x=1#place=moon-cafe');
    // Venues never have pages.
    expect(shareUrl(venuePlot('stage'), town, built)).toBe(
      'https://neighbor.github.io/forktown/#venue=stage',
    );
    expect(shareUrl(FORK_PLOT, town, built)).toBe(
      'https://neighbor.github.io/forktown/#venue=fork',
    );
    // A plot with nothing published on it has nothing to link to, so it names the town itself. (A
    // draft there has no Share button: its panel offers Save my place.)
    expect(shareUrl('A3', town, built)).toBe('https://neighbor.github.io/forktown/');
  });

  it('puts the address back to what the map shows when a link points at nothing', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const missing = app.slice(app.indexOf("'missing' in link"));
    expect(missing.slice(0, missing.indexOf('} else'))).toContain(
      'linkHash(shownPlot.current, places)',
    );
  });
});
