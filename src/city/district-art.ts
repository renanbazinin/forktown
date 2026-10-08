// The Riverside's painters: one per district feature, each in its own file under src/city/district/
// (SPEC §7.0, §7.3). render.ts calls every painter at four points of a frame, so a feature agent
// fills only their own painter and never edits render.ts:
//   ground   the cached ground layer, after drawFarmGround and before drawTubeGround
//   floor    floor paint (rugs, wakes, the stubble shadow), after drawTubeTraffic, before the sort
//   objects  depth objects, pushed before the residents; culled with `visible`, [] off-screen
//   sky      screen space, after drawSky
// The interface and this registry are frozen: no painter is added, removed or renamed here.
// No Math.random, Date.now or performance.now: everything runs on the town clock.
import type { Place } from '../lib/schema';
import type { ResidentState } from '../lib/simulation';
import type { ResidentTrip } from '../lib/resident-trips';
import type { TownSeason } from '../lib/seasons';
import type { Point } from '../lib/world';
import { marketPainter } from './district/market';
import { bandstandPainter } from './district/bandstand';
import { landingPainter } from './district/landing';
import { harvestPainter } from './district/harvest';
import { stargazingPainter } from './district/stargazing';
import { snowmenPainter } from './district/snowmen';

type Ctx = CanvasRenderingContext2D;
/** Whether a world-px point, reaching `rx` either side, `above` and `below`, is in view. */
export type Visible = (point: Point, rx: number, above: number, below: number) => boolean;
/** One thing to paint in depth order with the houses, trees and residents. */
export type DepthObject = { depth: number; paint: () => void };

export type DistrictGroundScene = {
  night: boolean;
  season: TownSeason;
  groundDay: number;
  visible: Visible;
};
export type DistrictScene = {
  day: number;
  minutes: number;
  night: boolean;
  season: TownSeason;
  zoom: number;
  visible: Visible;
  selected: string | null;
  hovered: string | null;
  places: readonly Place[];
  residents: readonly ResidentState[];
  /** Lazy: residentTrips(places, plan day). */
  plan: () => ReadonlyMap<string, readonly ResidentTrip[]>;
};
export type SkyScene = {
  day: number;
  minutes: number;
  night: boolean;
  width: number;
  height: number;
};
export type DistrictHit = { plot: string; depth: number };
export type DistrictPainter = {
  /** Cached ground layer, after drawFarmGround, before drawTubeGround. */
  ground?(ctx: Ctx, scene: DistrictGroundScene): void;
  /** Floor paint (rugs, wakes, the stubble shadow), after drawTubeTraffic, before the sort. */
  floor?(ctx: Ctx, scene: DistrictScene): void;
  /** Culls with scene.visible; [] off-screen; pushed before residents. */
  objects(ctx: Ctx, scene: DistrictScene): DepthObject[];
  /** Screen space, after drawSky. */
  sky?(ctx: Ctx, scene: SkyScene): void;
  hit?(point: Point, scene: DistrictScene): DistrictHit | undefined;
};
// Seat furniture (deckchairs, straw seats, rugs drawn as objects) sits at its guest's depth − 0.01,
// so the guest draws on top.

export type DistrictPainterId =
  'market' | 'bandstand' | 'landing' | 'harvest' | 'stargazing' | 'snowmen';
/** Every district painter, in the order render.ts calls them. */
export const DISTRICT_PAINTERS: Record<DistrictPainterId, DistrictPainter> = {
  market: marketPainter,
  bandstand: bandstandPainter,
  landing: landingPainter,
  harvest: harvestPainter,
  stargazing: stargazingPainter,
  snowmen: snowmenPainter,
};
