// Where a guest may stand while at an outing: inside its venue's own ground. One helper for every
// walking test (SPEC §6.5), so the Riverside's grounds (the square, the Bandstand's and the
// Landing's lawns, the farm's west end) count wherever today's venues do.
import { insideCinema } from '../src/lib/cinema';
import { insideDistrict } from '../src/lib/district-places';
import { insideVenue, isDistrictVenue, type TownEvent } from '../src/lib/events';
import { insideFootball } from '../src/lib/football';
import { insideMillpond } from '../src/lib/millpond';
import type { VisitEvent } from '../src/lib/resident-trips';
import type { Point } from '../src/lib/world';
import { insideZoo } from '../src/lib/zoo';

type AnyVenue = TownEvent['venue'] | VisitEvent['venue'];

/** Inside the ground of `venue`: its lawn, pitch, pond, park, square or stubble field. */
export function insideEventGround(venue: AnyVenue, p: Point): boolean {
  if (isDistrictVenue(venue)) return insideDistrict(venue.kind, p);
  if (venue.kind === 'football') return insideFootball(p);
  if (venue.kind === 'millpond') return insideMillpond(p);
  if (venue.kind === 'zoo') return insideZoo(p);
  if (venue.kind === 'cinema') return insideCinema(p);
  return insideVenue(venue, p);
}
