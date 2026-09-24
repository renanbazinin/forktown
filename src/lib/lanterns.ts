import { hash } from './world.ts';
// Type-only: schema.ts imports events.ts, which imports this file.
import type { Place } from './schema.ts';

// The Lantern Fork: one lantern for every house, hung in the order the houses moved in.
// Every fact behind it lives here, so the tree, the houses, the DOM and /live agree.

/** The free plot at the visual centre of the opening camera (anchor 11,15; centre -152,513). */
export const FORK_PLOT = 'D3';
export const FORK_ID = 'fork';
export const FORK_NAME = 'The Lantern Fork';
/** The founders' lobe holds eight lanterns; neighbours start after it, whatever founders remain. */
export const FOUNDER_SLOTS = 8;
/** Hit area around the plot centre in world px. The Fork's art stays inside it, clear of C2, C3 and D2. */
export const FORK_BOUNDS = { left: -80, right: 86, top: -131, bottom: 44 };
export const DAWN = 360;
export const NIGHTFALL = 1200;
/** The Fork lights over the first 20 town minutes of the night, then the lamps over 10 more. */
export const LANTERN_HOUR = { start: 1200, span: 20, lampsStart: 1220, lampsSpan: 10 };
/** The builder's old example story. Houses still carrying it have no tale of their own to tell. */
export const BUILDER_DEFAULT_STORY =
  'A small corner of the internet, made with curiosity and a little courage.';

export type LanternEntry = {
  id: string;
  /** 0-based lighting order: founders, then neighbours in arrival order, then unknown ones. */
  index: number;
  /** A stable position on the tree; removing a founder never moves a neighbour's lantern. */
  slot: number;
  founding: boolean;
  /** Only claimed when history backs it: founders and neighbours with a known arrival. */
  number?: number;
  /** The id of the known neighbour who moved in just before this one. */
  after?: string;
};
export type LanternRegister = {
  entries: readonly LanternEntry[];
  byId: ReadonlyMap<string, LanternEntry>;
  total: number;
  founders: number;
  neighbors: number;
  /** True when every neighbour's place in the arrival order is known. */
  ordered: boolean;
  /** The most recent known neighbour, the same house as places.ts latestArrival. */
  newest?: string;
};

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en');
const mod = (value: number, length: number) => ((value % length) + length) % length;

/** Arrivals are newest first, as townArrivals provides them. Pass published places only. */
export function lanternRegister(
  places: readonly Pick<Place, 'id' | 'creator'>[],
  arrivals: readonly string[],
): LanternRegister {
  const founders = places.filter((place) => place.creator === 'forktown').sort(byId);
  const community = new Map(
    places.filter((place) => place.creator !== 'forktown').map((place) => [place.id, place]),
  );
  const known = [...new Set(arrivals)].reverse().filter((id) => community.has(id));
  const knownIds = new Set(known);
  const unknown = [...community.values()].filter((place) => !knownIds.has(place.id)).sort(byId);
  // Starter ids are fixed by the schema, so founders never outgrow their eight slots.
  const entries: LanternEntry[] = [
    ...founders.map((place, k) => ({
      id: place.id,
      index: k,
      slot: k,
      founding: true,
      number: k + 1,
    })),
    ...[...known, ...unknown.map((place) => place.id)].map((id, j) => {
      const entry: LanternEntry = {
        id,
        index: founders.length + j,
        slot: FOUNDER_SLOTS + j,
        founding: false,
      };
      // Unknown neighbours stay unnumbered: never claim history we don't have.
      if (j < known.length) entry.number = entry.index + 1;
      if (j > 0 && j < known.length) entry.after = known[j - 1];
      return entry;
    }),
  ];
  const neighbors = community.size;
  return {
    entries,
    byId: new Map(entries.map((entry) => [entry.id, entry])),
    total: entries.length,
    founders: founders.length,
    neighbors,
    ordered: unknown.length === 0 && (neighbors === 0 || known.length > 0),
    newest: known.at(-1),
  };
}

// The evening runs 06:00 to 06:00: the hours after midnight read as minutes 1440..1799.
export function eveningMinutes(minutes: number) {
  const time = mod(minutes, 1440);
  return time < DAWN ? time + 1440 : time;
}
/** The town day whose evening is under way, so 02:00 still belongs to the night before. */
export function eveningDayAt(minutes: number, day: number) {
  return day + Math.floor(minutes / 1440) - (mod(minutes, 1440) < DAWN ? 1 : 0);
}

/** Town minutes between lanterns: one per real second, squeezed so any town lights in 20. */
export const lanternStep = (total: number) =>
  total > 1 ? Math.min(1, LANTERN_HOUR.span / total) : 1;

export function lanternsLit(total: number, minutes: number) {
  const time = eveningMinutes(minutes);
  if (total <= 0 || time < NIGHTFALL) return 0;
  // The epsilon keeps exact multiples of a fractional step from landing a lantern late.
  return Math.min(total, Math.floor((time - NIGHTFALL) / lanternStep(total) + 1e-9) + 1);
}
/** Defined through the count, so a single lantern and the tally never disagree. */
export const lanternLit = (index: number, total: number, minutes: number) =>
  index < lanternsLit(total, minutes);

export type LanternHour = {
  phase: 'waiting' | 'lighting' | 'lit';
  lit: number;
  total: number;
  /** Town minutes until nightfall, which are also real seconds. */
  startsIn: number;
  lastLightsAt: number;
};
export function lanternHourAt(total: number, minutes: number): LanternHour {
  const time = eveningMinutes(minutes);
  const lampsOut = LANTERN_HOUR.lampsStart + LANTERN_HOUR.lampsSpan;
  return {
    phase: time < NIGHTFALL ? 'waiting' : time < lampsOut ? 'lighting' : 'lit',
    lit: lanternsLit(total, minutes),
    total,
    startsIn: time < NIGHTFALL ? NIGHTFALL - time : 0,
    lastLightsAt: NIGHTFALL + Math.max(0, total - 1) * lanternStep(total),
  };
}

/** Streetlamps follow the lanterns, carrying the light outward from the Fork. */
export const lampLightsAt = (distance: number, maxDistance: number) =>
  LANTERN_HOUR.lampsStart +
  LANTERN_HOUR.lampsSpan * (maxDistance > 0 ? Math.min(1, distance / maxDistance) : 0);
export const lampLit = (distance: number, maxDistance: number, minutes: number) =>
  eveningMinutes(minutes) >= lampLightsAt(distance, maxDistance);

export const hasOwnStory = (place: Pick<Place, 'story'>) => {
  const story = place.story.trim();
  return story.length >= 10 && story !== BUILDER_DEFAULT_STORY;
};
export type EveningTale = {
  placeId: string;
  eveningDay: number;
  // Porch and town tales will join this union without changing callers.
  source: 'story';
};
/**
 * One storied house per evening. The candidates are shuffled once by hash and consecutive
 * evenings walk the list, so every house gets an evening before any repeats. Published only.
 */
export function taleOfTheEvening(
  places: readonly Pick<Place, 'id' | 'story'>[],
  eveningDay: number,
): EveningTale | undefined {
  const candidates = places
    .filter(hasOwnStory)
    .map((place) => ({ id: place.id, order: hash(`tale-order:${place.id}`) }))
    .sort((a, b) => a.order - b.order || byId(a, b));
  if (!candidates.length) return undefined;
  return {
    placeId: candidates[mod(eveningDay, candidates.length)].id,
    eveningDay,
    source: 'story',
  };
}
