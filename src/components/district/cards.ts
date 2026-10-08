// The Riverside in the town's UI: each outing's events-list card and each district venue's panel
// (docs/TOWN_EVENTS.md). TownEvents and App read these; each venue registers its own panel here.
// The keys here are frozen.
import type { ComponentType } from 'react';
import {
  Music4,
  Sailboat,
  ShoppingBasket,
  Telescope,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import type { OutingId } from '../../lib/district-calendar';
import type { DistrictKind } from '../../lib/district-places';
import type { Place } from '../../lib/schema';
import type { ResidentState } from '../../lib/simulation';
import FarmInfo from '../FarmInfo';
import BandstandInfo from './BandstandInfo';
import LandingInfo from './LandingInfo';
import MarketInfo from './MarketInfo';

/** Every district panel gets the moment, who is out and how to follow them. */
export type DistrictPanelProps = {
  day: number;
  minutes: number;
  residents: readonly ResidentState[];
  places: readonly Place[];
  onFollow: (id: string) => void;
  /** The outing the visitor chose from its event card, which the panel puts first. */
  selected?: string | null;
};
/** The stargazing note inside the Bandstand's panel on new-moon nights. */
export type StargazingNoteProps = {
  day: number;
  minutes: number;
  residents: readonly ResidentState[];
};
/** The snowmen line in the Lunch Green's panel. */
export type GreenNoteProps = { day: number; minutes: number };

/** Each outing's card icon; both Bandstand sets share one card. */
export const DISTRICT_CARDS: Record<OutingId, { icon: LucideIcon; group?: 'bandstand' }> = {
  market: { icon: ShoppingBasket },
  regatta: { icon: Sailboat },
  'harvest-fair': { icon: Wheat },
  'bandstand-tea': { icon: Music4, group: 'bandstand' },
  'long-table': { icon: UtensilsCrossed },
  'bandstand-sundown': { icon: Music4, group: 'bandstand' },
  stargazing: { icon: Telescope },
};

/**
 * Each district venue's panel; the harvest's is the farm's own panel. Imported with the app, not
 * lazily: the panels are a few kilobytes and share every module they use with the main chunk, so
 * splitting them saved no first-load bytes, added requests, and a chunk lost to a deploy or a
 * dropped connection took the whole app down with it. (Every import of this file from a panel is
 * type-only, so there is no cycle at run time.)
 */
export const DISTRICT_PANELS: Record<DistrictKind, ComponentType<DistrictPanelProps>> = {
  market: MarketInfo,
  bandstand: BandstandInfo,
  landing: LandingInfo,
  harvest: FarmInfo,
};
