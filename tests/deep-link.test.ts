import { describe, expect, it } from 'vitest';
import { MISSING_LINK_COPY, readDeepLink } from '../src/lib/deep-link';
import { CINEMA_VENUE } from '../src/lib/cinema';
import { FORK_PLOT } from '../src/lib/lanterns';
import { places } from '../src/lib/places';

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
});
