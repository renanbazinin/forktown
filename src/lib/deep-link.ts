import { CINEMA_VENUE } from './cinema';
import { FARM } from './farm';
import { FOOTBALL_VENUE } from './football';
import { FORK_PLOT } from './lanterns';
import { MILLPOND_VENUE } from './millpond';
import { TUBE_VENUE } from './tubes';
import { ZOO_VENUE } from './zoo';

const VENUE_LINKS = new Map<string, string>([
  ['fork', FORK_PLOT],
  ['farm', FARM.plot],
  ['millpond', MILLPOND_VENUE.plot],
  ['tube', TUBE_VENUE.plot],
  ['zoo', ZOO_VENUE.plot],
  ['cinema', CINEMA_VENUE.plot],
  ['football', FOOTBALL_VENUE.plot],
]);

export const MISSING_LINK_COPY = {
  place: 'That house isn’t in town yet.',
  venue: 'That spot isn’t on the map.',
};

export type DeepLink = { plot: string } | { missing: keyof typeof MISSING_LINK_COPY } | null;

/**
 * Where a shared link (#place=… or #venue=…) points: a plot on the map, something the town does
 * not have, or nothing at all.
 */
export function readDeepLink(
  hash: string,
  places: readonly { id: string; plot: string }[],
): DeepLink {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const venue = params.get('venue'),
    id = params.get('place');
  const venuePlot = venue === null ? undefined : VENUE_LINKS.get(venue);
  if (venuePlot) return { plot: venuePlot };
  const place = id === null ? undefined : places.find((place) => place.id === id);
  if (place) return { plot: place.plot };
  if (id !== null) return { missing: 'place' };
  if (venue !== null) return { missing: 'venue' };
  return null;
}
