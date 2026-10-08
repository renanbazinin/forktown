// The Riverside in the town's UI (SPEC §4.7, §7.0): each outing's events-list card and each
// district venue's panel. TownEvents and App read these; a feature agent fills only its own panel
// file. The keys and the imports here are frozen.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
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

/** Every district panel gets the moment, who is out and how to follow them. */
export type DistrictPanelProps = {
  day: number;
  minutes: number;
  residents: readonly ResidentState[];
  places: readonly Place[];
  onFollow: (id: string) => void;
};
/** The stargazing note inside the Bandstand's panel on new-moon nights (agent E). */
export type StargazingNoteProps = {
  day: number;
  minutes: number;
  residents: readonly ResidentState[];
};
/** The snowmen line in the Lunch Green's panel (agent E). */
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

type PanelModule = { default: ComponentType<DistrictPanelProps> };
/** Where each district venue's panel lives: the harvest's is the farm's own panel. */
export const DISTRICT_PANEL_FILES: Record<DistrictKind, () => Promise<PanelModule>> = {
  market: () => import('./MarketInfo'),
  bandstand: () => import('./BandstandInfo'),
  landing: () => import('./LandingInfo'),
  harvest: () => import('../FarmInfo'),
};
/** Each district venue's panel, loaded when it is first opened. */
export const DISTRICT_PANELS: Record<
  DistrictKind,
  LazyExoticComponent<ComponentType<DistrictPanelProps>>
> = {
  market: lazy(DISTRICT_PANEL_FILES.market),
  bandstand: lazy(DISTRICT_PANEL_FILES.bandstand),
  landing: lazy(DISTRICT_PANEL_FILES.landing),
  harvest: lazy(DISTRICT_PANEL_FILES.harvest),
};
