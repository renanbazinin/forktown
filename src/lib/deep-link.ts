import { CINEMA_VENUE, isCinemaPlot } from './cinema';
import { FARM, isFarmPlot } from './farm';
import { FOOTBALL_VENUE, isFootballPlot } from './football';
import { FORK_PLOT } from './lanterns';
import { isMillpondPlot, MILLPOND_VENUE } from './millpond';
import { isTubePlot, TUBE_VENUE } from './tubes';
import { isZooPlot, ZOO_VENUE } from './zoo';

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

// Every plot of a venue shares its link.
const VENUE_OF: [string, (plot: string) => boolean][] = [
  ['farm', isFarmPlot],
  ['millpond', isMillpondPlot],
  ['tube', isTubePlot],
  ['football', isFootballPlot],
  ['cinema', isCinemaPlot],
  ['zoo', isZooPlot],
  ['fork', (plot) => plot === FORK_PLOT],
];

/** The shared link (#place=… or #venue=…) for a selected plot, or '' for none. */
export function linkHash(
  plot: string | null,
  places: readonly { id: string; plot: string }[],
): string {
  if (!plot) return '';
  const place = places.find((place) => place.plot === plot);
  if (place) return `#place=${encodeURIComponent(place.id)}`;
  const venue = VENUE_OF.find(([, holds]) => holds(plot));
  return venue ? `#venue=${venue[0]}` : '';
}
