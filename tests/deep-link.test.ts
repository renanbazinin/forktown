import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { linkHash, MISSING_LINK_COPY, readDeepLink } from '../src/lib/deep-link';
import { CINEMA_PLOTS, CINEMA_VENUE } from '../src/lib/cinema';
import { HOUSE_PLOTS } from '../src/lib/events';
import { FARM, FARM_PLOTS } from '../src/lib/farm';
import { FOOTBALL_VENUE } from '../src/lib/football';
import { FORK_PLOT } from '../src/lib/lanterns';
import { MILLPOND_VENUE } from '../src/lib/millpond';
import { places } from '../src/lib/places';
import { TUBE_VENUE } from '../src/lib/tubes';
import { ZOO_PLOTS, ZOO_VENUE } from '../src/lib/zoo';

describe('Shared links', () => {
  const home = places[0];

  it('finds a house by its id and a venue by its name', () => {
    expect(readDeepLink(`#place=${home.id}`, places)).toEqual({ plot: home.plot });
    expect(readDeepLink('#venue=cinema', places)).toEqual({ plot: CINEMA_VENUE.plot });
    expect(readDeepLink('#venue=fork', places)).toEqual({ plot: FORK_PLOT });
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

  it('puts the address back to what the map shows when a link points at nothing', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const missing = app.slice(app.indexOf("'missing' in link"));
    expect(missing.slice(0, missing.indexOf('} else'))).toContain(
      'linkHash(shownPlot.current, places)',
    );
  });
});
