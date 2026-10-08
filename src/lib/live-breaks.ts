import {
  BREAK_CARDS,
  LIVE_BREAK_ADS,
  type BreakCard,
  type BreakCardData,
  type ComingUpItem,
  type SpotlightHouse,
} from './break-cards';
import type { CinemaAd } from './cinema';
import { lanternCaption } from './evening-copy';
import { districtEvents, eventsForDay, VENUES } from './events';
import { FOOTBALL_VENUE, MATCH, TEAMS } from './football';
import { FORK_NAME, LANTERN_HOUR, lanternRegister, type LanternRegister } from './lanterns';
import {
  LANTERN_SHOT,
  liveDistrictShots,
  liveHighlights,
  SCENERY_SECONDS,
  SCENERY_START,
  type LiveShot,
} from './live-director';
import type { Place } from './schema';
import { timeLabel } from './simulation';
import { townCalendarAt } from './town-calendar';
import { TOWN_DAY_MS, townDayAt, townMinutesAt, UTC_DAY_MS } from './town-time';
import { getPlot, hash, plotCenter } from './world';

// The live stream's breaks: one item every real half hour, deferred around the town's protected
// moments, plus the welcome for a new neighbor. Pure and deterministic, in UTC ms only: every
// viewer, reload and stream box computes the same schedule from the same clock.

export const DEFAULT_BREAK_MINUTES = 30;
/**
 * A page skips any scheduled break that starts this soon after it opened. A reloaded capture page
 * reaches the stream several seconds after it mounts, and should never join a break already running.
 */
export const BREAK_MOUNT_GRACE_MS = 15_000;
export type BreakItem = { kind: 'ad'; ad: CinemaAd } | { kind: 'card'; card: BreakCard };
export const itemKey = (item: BreakItem) =>
  item.kind === 'ad' ? `ad:${item.ad.artwork}` : `card:${item.card.card}`;
/** How long an item stays on air, in real seconds. */
export const breakSeconds = (item: BreakItem) =>
  item.kind === 'ad' ? item.ad.duration : item.card.duration;
export type ScheduledBreak = {
  key: string;
  slot: number;
  item: BreakItem;
  start: number;
  end: number;
};
export type MomentKind =
  | 'postcard'
  | 'lanterns'
  | 'ducks'
  | 'football'
  | 'green'
  | 'zoo'
  | 'evening'
  | 'night'
  | 'cinema'
  /** The Riverside's moment of the day: a festival's shot, or the market or the teatime set. */
  | 'district';
/** A stretch of the broadcast no break may cover, in UTC ms. `announceAt` is when it's billed. */
export type Moment = {
  kind: MomentKind;
  day: number;
  start: number;
  end: number;
  announceAt: number;
  title: string;
  place: string;
};
export type WelcomeStep = {
  kind: 'card' | 'hold';
  start: number;
  end: number;
  house: SpotlightHouse;
};
export type ActiveBreak = {
  key: string;
  item: BreakItem;
  start: number;
  end: number;
  data: BreakCardData;
  source: 'scheduled' | 'forced' | 'welcome';
};

const SECOND = 1000;
/** Clear air around every break and welcome: before it starts, and after it ends. */
const LEAD_MS = 2 * SECOND;
const TAIL_MS = 3 * SECOND;
/** Breaks and welcomes start on a 5 s grid. */
const STEP_MS = 5 * SECOND;
const MAX_DEFER_STEPS = 120;
const WELCOME_CARD_MS = BREAK_CARDS.welcome.duration * SECOND;
const WELCOME_HOLD_MS = 25 * SECOND;
const WELCOME_MS = WELCOME_CARD_MS + WELCOME_HOLD_MS;
const WELCOME_SEARCH_MS = 10 * 60 * SECOND;
const WELCOME_MAX = 3;
/** The duck walk and the one filmed match, as liveShotAt frames them (live-director.ts). */
const DUCKS_ON_AIR = { start: 600, end: 640 };
const FOOTBALL_ON_AIR = { start: 640, end: 640 + MATCH.length };
const DUCK_TITLE = 'The daily duck walk';
const LANTERN_TITLE = 'Lantern hour';
const POSTCARD_TITLE = 'The neighborhood waking up';
const FOUNDER = 'forktown';

const mod = (value: number, length: number) => ((value % length) + length) % length;
const codeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const meets = (a: { start: number; end: number }, start: number, end: number) =>
  a.start < end && a.end > start;
/** Keeps a memo from growing without end: the oldest entries go first. */
function remember<K, V>(cache: Map<K, V>, key: K, value: V, limit: number): V {
  if (cache.size >= limit) cache.delete(cache.keys().next().value!);
  cache.set(key, value);
  return value;
}

// ---- The pick ---------------------------------------------------------------------------------

const POOL: readonly BreakItem[] = [
  ...LIVE_BREAK_ADS.map((ad): BreakItem => ({ kind: 'ad', ad })),
  { kind: 'card', card: BREAK_CARDS['coming-up'] },
  { kind: 'card', card: BREAK_CARDS.neighbors },
];

/** Everything a scheduled break can show: the live-break ads, "Coming up" and "Meet the neighbors". */
export function breakPool(): BreakItem[] {
  return [...POOL];
}

/** One cycle's order, sorted by a seeded hash of each key, so registry order never matters. */
function seededOrder(cycle: number, pool: readonly BreakItem[]): BreakItem[] {
  return pool
    .map((item) => ({ item, key: itemKey(item) }))
    .map((entry) => ({ ...entry, rank: hash(`live-breaks:${cycle}:${entry.key}`) }))
    .sort((a, b) => a.rank - b.rank || codeUnits(a.key, b.key))
    .map((entry) => entry.item);
}

const orders = new Map<number, BreakItem[]>();
/**
 * Cycle `cycle`'s running order: every item once. When it would open with the item the previous
 * cycle closed on, its first two swap. Only indices 0 and 1 ever move, so the previous cycle's last
 * item is its seeded one and nothing recurses.
 */
export function breakOrder(cycle: number, pool: readonly BreakItem[] = POOL): BreakItem[] {
  const cached = pool === POOL ? orders.get(cycle) : undefined;
  if (cached) return cached;
  const order = seededOrder(cycle, pool);
  const n = order.length;
  if (n > 2 && itemKey(order[0]) === itemKey(seededOrder(cycle - 1, pool)[n - 1]))
    [order[0], order[1]] = [order[1], order[0]];
  return pool === POOL ? remember(orders, cycle, order, 16) : order;
}

/** Slot `slot`'s item: each cycle of pool-size slots airs every item once, never twice in a row. */
export function breakItemForSlot(slot: number, pool: readonly BreakItem[] = POOL): BreakItem {
  const n = pool.length;
  return breakOrder(Math.floor(slot / n), pool)[mod(slot, n)];
}

// ---- Protected moments ------------------------------------------------------------------------

const dayMomentCache = new Map<string, readonly Moment[]>();
/** Everything liveShotAt puts on air for town day `day` that a break must never cover. */
function dayMoments(day: number, homes: boolean): readonly Moment[] {
  const id = `${day}:${homes}`;
  const cached = dayMomentCache.get(id);
  if (cached) return cached;
  const base = day * TOWN_DAY_MS;
  const at = (minute: number) => base + minute * SECOND;
  const moment = (
    kind: MomentKind,
    start: number,
    end: number,
    title: string,
    place: string,
    announce = start,
  ): Moment => ({
    kind,
    day,
    start: at(start),
    end: at(end),
    announceAt: at(announce),
    title,
    place,
  });
  const highlights = liveHighlights(day);
  const events = eventsForDay(day);
  const event = (id: string) => events.find((candidate) => candidate.id === id)!;
  const [afternoon, evening] = events;
  const moments: Moment[] = [
    moment('postcard', SCENERY_START, SCENERY_START + SCENERY_SECONDS, POSTCARD_TITLE, ''),
  ];
  // The Fork lights at 20:00; the shot opens two seconds early on the dark tree.
  if (homes)
    moments.push(
      moment(
        'lanterns',
        LANTERN_SHOT.start,
        LANTERN_SHOT.end,
        LANTERN_TITLE,
        FORK_NAME,
        LANTERN_HOUR.start,
      ),
    );
  if (highlights.includes('ducks'))
    moments.push(moment('ducks', DUCKS_ON_AIR.start, DUCKS_ON_AIR.end, DUCK_TITLE, VENUES[0].name));
  if (highlights.includes('football'))
    moments.push(
      moment(
        'football',
        FOOTBALL_ON_AIR.start,
        FOOTBALL_ON_AIR.end,
        `${TEAMS[0].name} v ${TEAMS[1].name}`,
        FOOTBALL_VENUE.name,
      ),
    );
  if (highlights.includes('afternoon')) {
    const zoo = event('zoo');
    moments.push(
      moment('green', afternoon.start, afternoon.end, afternoon.name, afternoon.venue.name),
      moment('zoo', zoo.start, zoo.end, zoo.name, zoo.venue.name),
    );
  }
  if (highlights.includes('evening'))
    moments.push(moment('evening', evening.start, evening.end, evening.name, evening.venue.name));
  // The disco runs past midnight on the evening's own clock (1410–1590).
  if (highlights.includes('night')) {
    const night = event('night-party');
    moments.push(moment('night', night.start, night.end, night.name, night.venue.name));
  }
  if (highlights.includes('cinema')) {
    const cinema = event('cinema');
    moments.push(moment('cinema', cinema.start, cinema.end, cinema.name, cinema.venue.name));
  }
  // The day's Riverside moment (live-director's district shots). A shot with nobody planned
  // there stays off air, but its window is held clear all the same: breaks never need the plan.
  // An empty town has nobody to film there.
  const district = districtEvents(day);
  for (const shot of homes ? liveDistrictShots(day) : []) {
    const outing = district.find((candidate) => candidate.id === shot.outing);
    moments.push(
      moment('district', shot.from, shot.to, shot.label, outing?.venue.name ?? '', shot.from),
    );
  }
  return remember(dayMomentCache, id, moments, 64);
}

/** Every protected moment that meets [from, to), in start order. */
export function protectedMoments(from: number, to: number, places: Place[]): Moment[] {
  if (!(to > from)) return [];
  const homes = places.length > 0;
  const found: Moment[] = [];
  // A day's disco spills into the next day, so start one day early.
  for (let day = townDayAt(from) - 1; day <= townDayAt(to); day++)
    for (const moment of dayMoments(day, homes)) if (meets(moment, from, to)) found.push(moment);
  return found.sort((a, b) => a.start - b.start || a.end - b.end);
}

// ---- The schedule -----------------------------------------------------------------------------

const scheduled = new Map<string, ScheduledBreak | null>();
/**
 * Slot `slot`'s break: its item at the slot's start, or deferred in 5 s steps until two seconds
 * before and three after it are clear of every protected moment. The deferral never lets a break
 * run into the next slot, so a break always ends inside its own. Null when it can't fit.
 */
export function scheduledBreak(
  slot: number,
  places: Place[],
  minutes = DEFAULT_BREAK_MINUTES,
): ScheduledBreak | null {
  if (!(minutes > 0) || !Number.isFinite(minutes)) return null;
  const id = `${places.length > 0}:${minutes}:${slot}`;
  const cached = scheduled.get(id);
  if (cached !== undefined) return cached;
  const slotMs = minutes * 60 * SECOND;
  const start = slot * slotMs;
  const item = breakItemForSlot(slot);
  const length = breakSeconds(item) * SECOND;
  const steps = Math.min(MAX_DEFER_STEPS, Math.floor((slotMs - length - STEP_MS) / STEP_MS));
  let found: ScheduledBreak | null = null;
  if (steps >= 0) {
    const moments = protectedMoments(
      start - LEAD_MS,
      start + steps * STEP_MS + length + TAIL_MS,
      places,
    );
    for (let k = 0; k <= steps && !found; k++) {
      const t = start + k * STEP_MS;
      if (!moments.some((moment) => meets(moment, t - LEAD_MS, t + length + TAIL_MS)))
        found = { key: `break:${slot}`, slot, item, start: t, end: t + length };
    }
  }
  return remember(scheduled, id, found, 512);
}

/** The scheduled break on air at `ms`, if any. Breaks end inside their slot, so one slot tells. */
export function breakAt(
  ms: number,
  places: Place[],
  minutes = DEFAULT_BREAK_MINUTES,
): ScheduledBreak | null {
  if (!(minutes > 0) || !Number.isFinite(minutes)) return null;
  const found = scheduledBreak(Math.floor(ms / (minutes * 60 * SECOND)), places, minutes);
  return found && ms >= found.start && ms < found.end ? found : null;
}

/** The first scheduled break that starts after `ms`, looking at most a real day ahead. */
export function nextBreakAfter(
  ms: number,
  places: Place[],
  minutes = DEFAULT_BREAK_MINUTES,
): ScheduledBreak | null {
  if (!(minutes > 0) || !Number.isFinite(minutes)) return null;
  const slotMs = minutes * 60 * SECOND;
  const first = Math.floor(ms / slotMs);
  const last = first + Math.ceil(UTC_DAY_MS / slotMs);
  for (let slot = first; slot <= last; slot++) {
    const found = scheduledBreak(slot, places, minutes);
    if (found && found.start > ms) return found;
  }
  return null;
}

/**
 * The next `seconds` are clear of protected moments and of the welcome. Scheduled breaks don't
 * count: the reel covers a reload during one, and the reloaded page skips a break in progress.
 */
export function quietFor(
  ms: number,
  seconds: number,
  places: Place[],
  welcome: WelcomeStep[] = [],
): boolean {
  const end = ms + Math.max(1, seconds * SECOND);
  return (
    protectedMoments(ms, end, places).length === 0 && !welcome.some((step) => meets(step, ms, end))
  );
}

// ---- Card data --------------------------------------------------------------------------------

/** The next `count` billed moments after `ms` (never the postcard), in the order they start. */
export function comingUpAt(ms: number, places: Place[], count = 3): ComingUpItem[] {
  if (count <= 0) return [];
  const homes = places.length > 0;
  const today = townDayAt(ms);
  const upcoming: Moment[] = [];
  // Every day bills at least three moments, so a few days always fill the rows.
  for (let day = today - 1; day <= today + count + 1; day++)
    for (const moment of dayMoments(day, homes))
      if (moment.kind !== 'postcard' && moment.announceAt > ms) upcoming.push(moment);
  return upcoming
    .sort((a, b) => a.announceAt - b.announceAt || a.start - b.start || a.end - b.end)
    .slice(0, count)
    .map((moment) => ({
      title: moment.title,
      place: moment.place,
      townTime: timeLabel(townMinutesAt(moment.announceAt)),
      startsAt: moment.announceAt,
    }));
}

export function calendarAt(ms: number): NonNullable<BreakCardData['calendar']> {
  const { label, season, moonName, moonPhase } = townCalendarAt(townDayAt(ms), townMinutesAt(ms));
  return { label, season, moonName, moonPhase };
}

const registers = new WeakMap<Place[], WeakMap<readonly string[], LanternRegister>>();
function registerFor(places: Place[], arrivals: readonly string[]): LanternRegister {
  let byArrivals = registers.get(places);
  if (!byArrivals) registers.set(places, (byArrivals = new WeakMap()));
  let register = byArrivals.get(arrivals);
  if (!register) byArrivals.set(arrivals, (register = lanternRegister(places, arrivals)));
  return register;
}

/** One house as the cards show it: founder or not, its move-in date and its lantern. */
export function spotlightHouse(
  id: string,
  places: Place[],
  arrivals: readonly string[],
  dates: Record<string, string>,
): SpotlightHouse | null {
  const place = places.find((candidate) => candidate.id === id);
  if (!place) return null;
  const founder = place.creator === FOUNDER;
  const movedAt = !founder && Object.hasOwn(dates, id) ? Date.parse(dates[id]) : NaN;
  const register = registerFor(places, arrivals);
  const caption = lanternCaption(
    register,
    id,
    (other) => places.find((candidate) => candidate.id === other)?.name ?? other,
  );
  return {
    place,
    founder,
    movedIn: Number.isFinite(movedAt) ? townCalendarAt(townDayAt(movedAt)).label : null,
    // Only a numbered lantern has a caption worth a card; unknown neighbors stay unnumbered.
    lantern: caption && register.byId.get(id)?.number !== undefined ? caption.label : null,
  };
}

const spotlightOrders = new WeakMap<Place[], Place[]>();
/** Neighbors by id; founders only fill in while fewer than three neighbors live here. */
function spotlightOrder(places: Place[]): Place[] {
  const cached = spotlightOrders.get(places);
  if (cached) return cached;
  const byId = (a: Place, b: Place) => codeUnits(a.id, b.id);
  const neighbors = places.filter((place) => place.creator !== FOUNDER).sort(byId);
  const order =
    neighbors.length >= 3
      ? neighbors
      : [...neighbors, ...places.filter((place) => place.creator === FOUNDER).sort(byId)];
  spotlightOrders.set(places, order);
  return order;
}

/** "Meet the neighbors" airs once a cycle, and each airing walks on to the next house. */
export function spotlightFor(
  slot: number,
  places: Place[],
  arrivals: readonly string[],
  dates: Record<string, string>,
): SpotlightHouse | null {
  const order = spotlightOrder(places);
  if (!order.length) return null;
  const house = order[mod(Math.floor(slot / POOL.length), order.length)];
  return spotlightHouse(house.id, places, arrivals, dates);
}

// ---- The welcome ------------------------------------------------------------------------------

/**
 * The welcome for up to three new neighbors, in the order given: each a 10 s card, then 25 s on
 * the house. Each house takes the first 5 s step from `earliest` (and after the one before) whose
 * 35 s, with two seconds before and three after, meets no protected moment and no scheduled
 * break (when breaks are on). A house that can't start within ten minutes is left out.
 */
export function welcomeTimeline(
  ids: string[],
  earliest: number,
  places: Place[],
  arrivals: readonly string[],
  dates: Record<string, string>,
  minutes: number | null,
  /** When the page opened: it skips breaks starting within BREAK_MOUNT_GRACE_MS, so they don't block. */
  mountedAt = -Infinity,
): WelcomeStep[] {
  const houses = [...new Set(ids)]
    .map((id) => places.find((place) => place.id === id))
    .filter((place): place is Place => !!place && place.creator !== FOUNDER)
    .slice(0, WELCOME_MAX)
    .map((place) => spotlightHouse(place.id, places, arrivals, dates)!);
  if (!houses.length) return [];
  const latest = earliest + WELCOME_SEARCH_MS;
  const moments = protectedMoments(earliest - LEAD_MS, latest + WELCOME_MS + TAIL_MS, places);
  const slotMs = minutes !== null && minutes > 0 ? minutes * 60 * SECOND : null;
  const clear = (from: number, to: number) => {
    if (moments.some((moment) => meets(moment, from, to))) return false;
    if (slotMs === null) return true;
    for (let slot = Math.floor(from / slotMs); slot <= Math.floor(to / slotMs); slot++) {
      const found = scheduledBreak(slot, places, minutes!);
      if (found && found.start >= mountedAt + BREAK_MOUNT_GRACE_MS && meets(found, from, to))
        return false;
    }
    return true;
  };
  const steps: WelcomeStep[] = [];
  let from = earliest;
  for (const house of houses)
    for (let t = from; t <= latest; t += STEP_MS)
      if (clear(t - LEAD_MS, t + WELCOME_MS + TAIL_MS)) {
        steps.push(
          { kind: 'card', start: t, end: t + WELCOME_CARD_MS, house },
          { kind: 'hold', start: t + WELCOME_CARD_MS, end: t + WELCOME_MS, house },
        );
        from = t + WELCOME_MS;
        break;
      }
  return steps;
}

const welcomeShots = new WeakMap<SpotlightHouse, LiveShot>();
/** The camera on the new house, for the card (it settles underneath) and the hold alike. */
export function welcomeShotAt(step: WelcomeStep): LiveShot {
  const cached = welcomeShots.get(step.house);
  if (cached) return cached;
  const { place } = step.house;
  const plot = getPlot(place.plot);
  const center = plot ? plotCenter(plot) : { x: 0, y: 0 };
  const shot: LiveShot = {
    id: `welcome:${place.id}`,
    kind: 'home',
    label: `Welcome to ${place.name}`,
    center: { x: center.x, y: center.y - 40 },
    width: 430,
    height: 320,
  };
  welcomeShots.set(step.house, shot);
  return shot;
}

// ---- On air -----------------------------------------------------------------------------------

/** Fades in over the first 400 ms of a break and out over its last 400 ms. */
export function breakOpacity(b: { start: number; end: number }, ms: number): number {
  return Math.max(0, Math.min(1, (ms - b.start) / 400, (b.end - ms) / 400));
}

type Airing = Omit<ActiveBreak, 'data'>;
type Town = { places: Place[]; arrivals: readonly string[]; dates: Record<string, string> };
const airings: { id: string; town: Town; value: ActiveBreak }[] = [];

/** The newest neighbor with a house, for a forced welcome card. */
function newestHouse({ places, arrivals, dates }: Town): SpotlightHouse | null {
  const id = arrivals.find((candidate) =>
    places.some((place) => place.id === candidate && place.creator !== FOUNDER),
  );
  return id ? spotlightHouse(id, places, arrivals, dates) : null;
}

function cardData(airing: Airing, town: Town, minutes: number, house?: SpotlightHouse) {
  const data: BreakCardData = { now: airing.start };
  if (airing.item.kind !== 'card') return data;
  const { places, arrivals, dates } = town;
  const slot = Math.floor(airing.start / (minutes * 60 * SECOND));
  switch (airing.item.card.card) {
    case 'coming-up':
      data.comingUp = comingUpAt(airing.start, places);
      data.calendar = calendarAt(airing.start);
      break;
    case 'neighbors':
      data.house = spotlightFor(slot, places, arrivals, dates) ?? undefined;
      break;
    case 'welcome':
      data.house =
        house ?? newestHouse(town) ?? spotlightFor(slot, places, arrivals, dates) ?? undefined;
      break;
  }
  return data;
}

/** One object per airing, so a 30 Hz caller gets the same break (and card data) every frame. */
function air(airing: Airing, town: Town, minutes: number, house?: SpotlightHouse): ActiveBreak {
  const id = `${airing.source}|${airing.key}|${airing.start}|${airing.end}`;
  const hit = airings.find(
    (entry) =>
      entry.id === id &&
      entry.town.places === town.places &&
      entry.town.arrivals === town.arrivals &&
      entry.town.dates === town.dates,
  );
  if (hit) return hit.value;
  const value = { ...airing, data: cardData(airing, town, minutes, house) };
  airings.unshift({ id, town, value });
  airings.length = Math.min(airings.length, 4);
  return value;
}

/**
 * What covers the town at `ms`: a forced item (from `break=`), else a welcome card, else the
 * scheduled break. A scheduled break yields to any welcome step it would meet, and one that began
 * before the page (plus a second) is skipped, so a reload never opens mid-break.
 */
export function activeBreak(o: {
  ms: number;
  places: Place[];
  minutes: number | null;
  forced: { item: BreakItem; start: number } | null;
  welcome: WelcomeStep[];
  mountedAt: number;
  arrivals: readonly string[];
  dates: Record<string, string>;
}): ActiveBreak | null {
  const { ms, minutes, forced, welcome } = o;
  const town: Town = { places: o.places, arrivals: o.arrivals, dates: o.dates };
  const every = minutes ?? DEFAULT_BREAK_MINUTES;
  if (forced) {
    const end = forced.start + breakSeconds(forced.item) * SECOND;
    if (ms >= forced.start && ms < end)
      return air(
        {
          key: `forced:${itemKey(forced.item)}`,
          item: forced.item,
          start: forced.start,
          end,
          source: 'forced',
        },
        town,
        every,
      );
  }
  const card = welcome.find((step) => step.kind === 'card' && ms >= step.start && ms < step.end);
  if (card)
    return air(
      {
        key: `welcome:${card.house.place.id}:${card.start}`,
        item: { kind: 'card', card: BREAK_CARDS.welcome },
        start: card.start,
        end: card.end,
        source: 'welcome',
      },
      town,
      every,
      card.house,
    );
  if (minutes === null) return null;
  const found = breakAt(ms, o.places, minutes);
  if (
    !found ||
    found.start < o.mountedAt + BREAK_MOUNT_GRACE_MS ||
    welcome.some((step) => meets(step, found.start, found.end))
  )
    return null;
  return air(
    { key: found.key, item: found.item, start: found.start, end: found.end, source: 'scheduled' },
    town,
    minutes,
  );
}
