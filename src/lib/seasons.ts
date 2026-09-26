import {
  CALENDAR_EPOCH_DAY,
  DAYS_PER_SEASON,
  DAYS_PER_YEAR,
  townCalendarAt,
} from './town-calendar.ts';
import { hash } from './world.ts';

// The turning year: what the calendar's seasons do to the scenery. Everything here is a pure
// function of the town day and minute, like the sky and the moon, so every visitor sees the same
// blossom, the same first snow and the same fireflies. Nothing is saved and nothing is random.
//
// Things change gradually. Each tree, roof and doorstep keeps its own seeded schedule, so a
// season arrives over a few town days (an hour or two of real time), never all at once at midnight.

export const SPRING = 0;
export const SUMMER = DAYS_PER_SEASON;
export const AUTUMN = DAYS_PER_SEASON * 2;
export const WINTER = DAYS_PER_SEASON * 3;

const mod = (value: number, length: number) => ((value % length) + length) % length;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
/** 0 before `start`, easing to 1 over `length` days. */
const ramp = (day: number, start: number, length: number) => smooth((day - start) / length);
/** 0 at both ends of a 0..1 progress, 1 in the middle: how busy a falling phase is. */
const bell = (progress: number) => 4 * progress * (1 - progress);

/** The fractional day of the town year: 0 at Spring 1, 00:00, wrapping after Winter 28. */
export function yearDayAt(day: number, minutes = 0) {
  return mod(day - CALENDAR_EPOCH_DAY + minutes / 1440, DAYS_PER_YEAR);
}

/** A stable 0..1 fraction for anything with a name: a tree, a roof, a doorstep. */
export const seedFraction = (key: string) => (hash(key) % 10007) / 10007;

/** A stable 0..1 fraction from an integer seed and a salt. Integer mixing, not string hashing,
 * for the few thousand grass tufts and crops the ground layer paints on every pan and zoom. */
export function groundFraction(seed: number, salt: number) {
  let h = Math.imul(seed ^ Math.imul(salt + 1, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** When the first snow starts to settle on an object with schedule seed `s`: during the first
 * snowfall, between Winter 1 03:36 and 20:24. Pumpkins and gardens are taken in by then. */
export const firstSnowAt = (s: number) => WINTER + 0.15 + 1.2 * s;

/** Snow on one object with schedule seed `s`. The first snowfall settles over Winter 1–2 and the
 * thaw clears roofs one by one over Winter 24–28, so Spring 1 always starts clean. */
export function snowAt(yearDay: number, s = 0.5) {
  if (yearDay < WINTER) return 0;
  return ramp(yearDay, firstSnowAt(s), 0.25) * (1 - ramp(yearDay, WINTER + 23 + 4 * s, 0.6));
}

/** Town-wide snow cover: the average of every object's schedule, for washes and far hills. */
export function snowCoverAt(yearDay: number) {
  if (yearDay < WINTER) return 0;
  return ramp(yearDay, WINTER + 0.15, 1.45) * (1 - ramp(yearDay, WINTER + 23, 4.6));
}

export type Canopy = {
  /** New spring leaves, a little lighter than summer's: 1 at leaf-out, settling by Spring 15. */
  fresh: number;
  /** 0 in summer green, 1 in full autumn colour. */
  turn: number;
  /** Autumn colour moves from ochre (0) to russet (1) as the season deepens. */
  deepen: number;
  /** 0 in leaf, 1 dormant: bare twigs from late autumn to the first days of spring. */
  dormant: number;
  /** Open blossom on the branches, for the trees that flower. */
  blossom: number;
  /** How busy the petal fall is, for drifting petals. */
  petalFall: number;
  /** Petals lying under the tree. */
  petals: number;
  /** How busy the leaf fall is, for drifting leaves. */
  leafFall: number;
  /** Fallen leaves lying under the tree. */
  leaves: number;
  /** Snow resting on the crown. */
  snow: number;
};

export type TreeKind = 'evergreen' | 'deciduous' | 'blossom' | 'larch';

/** Which kind of tree a town tree is, from its placement seed. Round crowns (even seeds) are
 * broadleaves, a little under half of them flowering; about one conifer in four is a larch,
 * which turns gold and drops its needles, so autumn reaches the inner streets too. */
export function treeKind(seed: number): TreeKind {
  const roll = (seed >>> 11) % 20;
  if (seed % 2) return roll % 4 === 0 ? 'larch' : 'evergreen';
  return roll < 9 ? 'blossom' : 'deciduous';
}

/** Where one tree is in its year. Evergreens only ever carry snow. */
export function canopyAt(yearDay: number, s: number, kind: TreeKind): Canopy {
  const d = yearDay;
  const snow = snowAt(d, s);
  const none = {
    fresh: 0,
    turn: 0,
    deepen: 0,
    dormant: 0,
    blossom: 0,
    petalFall: 0,
    petals: 0,
    leafFall: 0,
    leaves: 0,
    snow,
  };
  if (kind === 'evergreen') return none;
  if (d < SUMMER) {
    // Leaf-out through the first days of spring; the flowering trees then bloom and shed.
    const dormant = 1 - ramp(d, 0.6 + 2.5 * s, 2);
    const fresh = 1 - ramp(d, 6, 8);
    if (kind !== 'blossom') return { ...none, fresh, dormant };
    const open = ramp(d, 1.5 + 4 * s, 1.5),
      drop = ramp(d, 14 + 6 * s, 4);
    return {
      ...none,
      fresh,
      dormant,
      blossom: open * (1 - drop),
      petalFall: open * bell(drop),
      petals: drop * (1 - ramp(d, 22 + 3 * s, 3)),
    };
  }
  if (d < AUTUMN) return none;
  // Autumn: the trees turn one by one, deepen from ochre to russet, then let go. Deep in winter,
  // while every crown is bare, the fresh tone comes back so leaf-out starts from it without a jump.
  const fall = ramp(d, 68 + 6 * s, 10);
  return {
    ...none,
    fresh: ramp(d, WINTER + 6, 4),
    turn: ramp(d, 57 + 7 * s, 2.5),
    deepen: ramp(d, 64 + 5 * s, 8),
    dormant: ramp(d, 79 + 4 * s, 3),
    leafFall: d < WINTER ? bell(fall) : 0,
    // The carpet gathers as the leaves come down, then the first snow covers it.
    leaves: ramp(d, 69 + 6 * s, 6) * (1 - ramp(d, WINTER + 0.4, 1.6)),
  };
}

/** A doorstep pumpkin: out from Autumn 5 through the second week, taken in when the first snow comes. */
export function pumpkinOut(yearDay: number, s: number) {
  return yearDay >= AUTUMN + 4 + 7 * s && yearDay < firstSnowAt(s);
}

/** Fireflies on summer nights, after the lamps are lit and until the sky starts to pale. */
export function firefliesAt(yearDay: number, minutes: number) {
  const season = ramp(yearDay, SUMMER + 0.5, 3) * (1 - ramp(yearDay, AUTUMN - 3.5, 3));
  if (season <= 0) return 0;
  const t = mod(minutes, 1440);
  const dark = t >= 1200 ? ramp(t, 1212, 30) : t < 360 ? 1 - ramp(t, 270, 50) : 0;
  return season * dark;
}

/** Falling snow, 0..1. The first snow falls over Winter 1; after that, about one winter day in
 * four has a quiet flurry of a few town hours. Seeded by the absolute day, so years differ. */
export function flurryAt(day: number, minutes: number) {
  const yearDay = yearDayAt(day, minutes);
  if (yearDay < WINTER) return 0;
  const first = yearDay < WINTER + 2 ? bell(clamp((yearDay - WINTER) / 1.6)) : 0;
  const whole = Math.floor(yearDay);
  if (whole < WINTER + 2 || whole > WINTER + 21) return first;
  // seedFraction mixes every bit of the day; a plain hash % 4 keeps a four-day beat.
  const key = `flurry:${Math.floor(day + minutes / 1440)}`;
  if (seedFraction(key) >= 0.25) return first;
  const start = 360 + ((hash(key) >>> 4) % 660),
    t = mod(minutes, 1440);
  return Math.max(first, smooth((t - start) / 40) * (1 - smooth((t - start - 260) / 40)) * 0.7);
}

export type TownSeason = {
  /** The absolute town day, for seeds that should differ between years. */
  day: number;
  /** The town minute, for anything that drifts or blinks. */
  minutes: number;
  /** The fractional day of the town year, 0..112. */
  yearDay: number;
  /** The whole day of the year. Cached ground art reads this, so it changes once a town day. */
  groundDay: number;
  /** 0 Spring, 1 Summer, 2 Autumn, 3 Winter: the almanac's season. */
  index: number;
  /** Town-wide snow cover. */
  snow: number;
  fireflies: number;
  flurry: number;
};

export function townSeasonAt(day: number, minutes: number): TownSeason {
  const yearDay = yearDayAt(day, minutes);
  // The whole day and season come from the almanac itself, so the two can never disagree,
  // not even a floating-point hair before midnight.
  const almanac = townCalendarAt(day, minutes);
  return {
    day,
    minutes,
    yearDay,
    groundDay: almanac.seasonIndex * DAYS_PER_SEASON + almanac.date - 1,
    index: almanac.seasonIndex,
    snow: snowCoverAt(yearDay),
    fireflies: firefliesAt(yearDay, minutes),
    flurry: flurryAt(day, minutes),
  };
}
