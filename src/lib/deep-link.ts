import { CINEMA_VENUE, isCinemaPlot } from './cinema';
import { VENUES } from './events';
import { FARM, isFarmPlot } from './farm';
import { FOOTBALL_VENUE, isFootballPlot } from './football';
import { FORK_PLOT } from './lanterns';
import { isMillpondPlot, MILLPOND_VENUE } from './millpond';
import { isTubePlot, TUBE_VENUE } from './tubes';
import { isZooPlot, ZOO_VENUE } from './zoo';
import { BANDSTAND_VENUE, LANDING_VENUE, MARKET_PLOTS, MARKET_VENUE } from './district-places';

// The Lunch Green and the Little Stage, where the Midnight Disco plays, are one plot each.
const GREEN_PLOT = VENUES.find((venue) => venue.id === 'green')!.plot;
const STAGE_PLOT = VENUES.find((venue) => venue.id === 'stage')!.plot;

const VENUE_LINKS = new Map<string, string>([
  ['fork', FORK_PLOT],
  ['stage', STAGE_PLOT],
  ['green', GREEN_PLOT],
  ['farm', FARM.plot],
  ['millpond', MILLPOND_VENUE.plot],
  ['tube', TUBE_VENUE.plot],
  ['zoo', ZOO_VENUE.plot],
  ['cinema', CINEMA_VENUE.plot],
  ['football', FOOTBALL_VENUE.plot],
  // The Riverside: Market Square, the Bandstand and the Boat Landing. Stargazing is on the
  // Bandstand's lawn and the regatta at the Landing, so their links are aliases (SPEC §4.7).
  ['market', MARKET_VENUE.plot],
  ['bandstand', BANDSTAND_VENUE.plot],
  ['landing', LANDING_VENUE.plot],
  ['regatta', LANDING_VENUE.plot],
  ['stars', BANDSTAND_VENUE.plot],
]);

export const MISSING_LINK_COPY = {
  place: 'That house isn’t in town yet.',
  venue: 'That spot isn’t on the map.',
};

export type DeepLink = { plot: string } | { missing: keyof typeof MISSING_LINK_COPY } | null;

/**
 * Where a shared link (#place=… or #venue=…) points: a plot on the map, something the town does
 * not have, or nothing at all. `#venue=tube` chooses Hedgerow Halt, and `#venue=tube&halt=<plot>`
 * another halt; an unknown halt falls back to Hedgerow Halt.
 */
export function readDeepLink(
  hash: string,
  places: readonly { id: string; plot: string }[],
): DeepLink {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const venue = params.get('venue'),
    id = params.get('place');
  if (venue === 'tube') {
    const halt = params.get('halt');
    return { plot: halt !== null && isTubePlot(halt) ? halt : TUBE_VENUE.plot };
  }
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
  ['stage', (plot) => plot === STAGE_PLOT],
  ['green', (plot) => plot === GREEN_PLOT],
  ['market', (plot) => (MARKET_PLOTS as readonly string[]).includes(plot)],
  ['bandstand', (plot) => plot === BANDSTAND_VENUE.plot],
  ['landing', (plot) => plot === LANDING_VENUE.plot],
];

/**
 * The shared link (#place=… or #venue=…) for a selected plot, or '' for none. Each halt of the
 * Treeline opens its own panel, so a halt other than Hedgerow Halt names its plot.
 */
export function linkHash(
  plot: string | null,
  places: readonly { id: string; plot: string }[],
): string {
  if (!plot) return '';
  const place = places.find((place) => place.plot === plot);
  if (place) return `#place=${encodeURIComponent(place.id)}`;
  if (isTubePlot(plot))
    return plot === TUBE_VENUE.plot ? '#venue=tube' : `#venue=tube&halt=${plot}`;
  const venue = VENUE_OF.find(([, holds]) => holds(plot));
  return venue ? `#venue=${venue[0]}` : '';
}

/**
 * The address Share hands on for a plot. A built town gives every published house a page of its
 * own that link previews can read (scripts/share-preview.ts). The dev server has no such pages and
 * venues never do, so they share the #place= or #venue= link instead. A draft isn't published: its
 * panel offers Save my place rather than Share.
 */
export function shareUrl(
  plot: string | null,
  places: readonly { id: string; plot: string }[],
  { href, base, pages }: { href: string; base: string; pages: boolean },
): string {
  const place = pages ? places.find((place) => place.plot === plot) : undefined;
  if (place) return new URL(`${base}house/${encodeURIComponent(place.id)}/`, href).href;
  const url = new URL(href);
  url.hash = linkHash(plot, places);
  return url.href;
}
