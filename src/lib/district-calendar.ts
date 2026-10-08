// The riverside's calendar: which outings run on which town days, their times, and the scenery
// that is a pure function of the day and the minute (the regatta's paper boats, the snowmen).
// Frozen data for the bigger town (SPEC §4, §7.0). Pure: it reads only the town calendar, the
// seasons and the world's hash, so the planner, the art and the copy all agree without a cache.
import { CALENDAR_EPOCH_DAY, DAYS_PER_YEAR, townCalendarAt } from './town-calendar.ts';
import { seedFraction, WINTER, yearDayAt } from './seasons.ts';
import { hash } from './world.ts';

export type OutingId =
  | 'market'
  | 'regatta'
  | 'harvest-fair'
  | 'bandstand-tea'
  | 'long-table'
  | 'bandstand-sundown'
  | 'stargazing';
export const OUTING_IDS: readonly OutingId[] = [
  'market',
  'regatta',
  'harvest-fair',
  'bandstand-tea',
  'long-table',
  'bandstand-sundown',
  'stargazing',
];
export type OutingTimes = { depart: number; start: number; end: number; homeBy: number };
/** Town minutes. Stargazing runs on the evening's timeline: 00:15 is minute 1455. */
export const OUTING_TIMES: Record<OutingId, OutingTimes> = {
  market: { depart: 360, start: 480, end: 690, homeBy: 720 },
  regatta: { depart: 720, start: 840, end: 990, homeBy: 1080 },
  'harvest-fair': { depart: 720, start: 780, end: 1020, homeBy: 1080 },
  'bandstand-tea': { depart: 720, start: 960, end: 1050, homeBy: 1080 },
  'long-table': { depart: 1080, start: 1110, end: 1230, homeBy: 1320 },
  'bandstand-sundown': { depart: 1080, start: 1095, end: 1200, homeBy: 1320 },
  stargazing: { depart: 1320, start: 1335, end: 1455, homeBy: 1560 },
};

export type MarketKind = 'farmers' | 'flowers' | 'books';
export const MARKET_KINDS: readonly MarketKind[] = ['farmers', 'flowers', 'books'];
/** Today's market: the same all day, for every visitor. */
export const marketKind = (day: number): MarketKind =>
  MARKET_KINDS[hash(`market:${Math.floor(day)}`) % MARKET_KINDS.length];

export type Band = 'brass' | 'folk' | 'strings';
export const BANDS: readonly Band[] = ['brass', 'folk', 'strings'];
/** Today's band, the same for the teatime and the sundown set. */
export const bandOf = (day: number): Band =>
  BANDS[hash(`bandstand:${Math.floor(day)}`) % BANDS.length];

const calendar = (day: number) => townCalendarAt(Math.floor(day));
/** Regatta Week: Summer 10–16. */
export function regattaDay(day: number) {
  const { season, date } = calendar(day);
  return season === 'Summer' && date >= 10 && date <= 16;
}
/** The Harvest Fair and the Long Table: Autumn 23–25, after the grain is cut. */
export function harvestDay(day: number) {
  const { season, date } = calendar(day);
  return season === 'Autumn' && date >= 23 && date <= 25;
}
/** A new-moon night (dates 27, 28 and 1 of each season), judged at 22:00 like the sky. */
export const starNight = (day: number) =>
  townCalendarAt(Math.floor(day), 1320).moonName === 'New moon';

/** Whether an outing runs on a town day. */
export function outingOn(id: OutingId, day: number) {
  if (id === 'regatta') return regattaDay(day);
  if (id === 'harvest-fair' || id === 'long-table') return harvestDay(day);
  if (id === 'stargazing') return starNight(day);
  return true;
}
/** The first town day from `day` on (today included) when the outing runs. */
export function nextOutingDay(id: OutingId, day: number): number | undefined {
  const from = Math.floor(day);
  for (let d = from; d <= from + DAYS_PER_YEAR; d++) if (outingOn(id, d)) return d;
  return undefined;
}

/**
 * The outing's active days counted from the calendar's epoch: the day number for the daily
 * outings, and the count of earlier festival days (or star nights) for the rest. Turn tickets
 * deal their blocks over these, so a festival year is one run of its own days. Its only home.
 */
export function activeIndex(kind: string, day: number): number {
  const d = Math.floor(day) - CALENDAR_EPOCH_DAY,
    year = Math.floor(d / DAYS_PER_YEAR),
    yd = d - year * DAYS_PER_YEAR;
  const season = Math.floor(yd / 28),
    date = (yd % 28) + 1;
  if (kind === 'regatta') return year * 7 + (date - 10); // Summer 10..16
  if (kind === 'harvest-fair' || kind === 'long-table') return year * 3 + (date - 23);
  if (kind === 'stargazing') return year * 12 + season * 3 + (date === 1 ? 0 : date - 26);
  return d; // daily kinds
}

export type OutingRow = {
  /** Attending starts on arrival (a browse, a walk round), not at the start time. */
  underway: boolean;
  /** Guests sit at their spot. */
  seated: boolean;
  /** Spots, and the ticket line's CAP. */
  cap: number;
  rule: 'all' | 'half';
  /** The hash-line key that newcomers (and the line's rest) sort on. */
  newcomerKey: (day: number) => string;
};
export const OUTING_TABLE: Record<OutingId, OutingRow> = {
  market: {
    underway: true,
    seated: false,
    cap: 12,
    rule: 'half',
    newcomerKey: (d) => `market:${d}`,
  },
  regatta: {
    underway: true,
    seated: false,
    cap: 10,
    rule: 'half',
    newcomerKey: (d) => `regatta:${d}`,
  },
  'harvest-fair': {
    underway: true,
    seated: false,
    cap: 12,
    rule: 'half',
    newcomerKey: (d) => `harvest-fair:${d}`,
  },
  'bandstand-tea': {
    underway: false,
    seated: true,
    cap: 8,
    rule: 'all',
    newcomerKey: (d) => `bandstand-tea:${d}`,
  },
  'long-table': {
    underway: true,
    seated: true,
    cap: 16,
    rule: 'all',
    newcomerKey: (d) => `long-table:${d}`,
  },
  'bandstand-sundown': {
    underway: false,
    seated: true,
    cap: 8,
    rule: 'all',
    newcomerKey: (d) => `bandstand-sundown:${d}`,
  },
  stargazing: {
    underway: false,
    seated: true,
    cap: 8,
    rule: 'half',
    newcomerKey: (d) => `stargazing:${d}`,
  },
};

// ---- The Paper-boat Regatta (SPEC §2.3, §4.5) ----

/** The course on the near half of the river, by the Boat Landing (J15). district-places
 * re-exports it; it lives here because the boats below are pure in the day and the minute. */
export const REGATTA_COURSE = {
  stage: { left: 62.0, right: 62.35, top: 37.6, bottom: 39.5 }, // the slim landing stage, north of the launch
  launch: { x: 62.125, y: 39.5 }, // the stage's south tip
  laneX: 62.125,
  sway: 0.04, // boats keep to x 62.085–62.165
  boomY: 51,
  restGap: 0.14, // the cork boom, and the spacing of boats at rest
  // Where a guest sets their boat down, at their own feet: a step toward the river from their
  // spot, on their own row. The even rows' (the front column, on the gravel's edge) and the odd
  // rows' (0.55 tiles further in, among the guests).
  handoverX: [60.95, 60.4],
} as const;
/** The Kingfisher bridge's mid-river pier; 0.215 clear of the course. */
export const KINGFISHER_PIER = { x: 62.38, y: 47.5 } as const;
/** Minutes between launches: seat k's boat goes in at 14:00 + 6k. */
export const REGATTA_LAUNCH_EVERY = 6;
/** Boats at the Landing: one per regatta spot. */
export const REGATTA_BOATS = 10;
/** The y of landing row k (its spot, and where its guest sets the boat down). */
export const landingRowY = (k: number) => 38.15 + 0.31 * k;
/** Where guest k sets their boat down on arrival: its row's handover point, by their feet. */
export const regattaHandover = (k: number) => ({
  x: REGATTA_COURSE.handoverX[k % 2],
  y: landingRowY(k),
});
/** The scenery boatman nets the boats out, one every three minutes, 16:40–17:10. */
export const REGATTA_NETTING = { from: 1000, every: 3, to: 1030 } as const;
/** Minutes in one slow sway across the lane. */
const SWAY_PERIOD = 3.2;

export type RegattaBoat = {
  x: number;
  y: number;
  state: 'ashore' | 'drifting' | 'resting' | 'netted';
  /** When the boat comes to rest against the boom or the boat ahead. */
  restAt: number;
};
/**
 * Boat k on a regatta day, at a town minute. Ashore at its row's handover point until its launch
 * at 14:00 + 6k (whether its guest has set it down yet is the painter's to read from the plan),
 * then drifting south down the lane to rest at y 51 − 0.14k at 15:30–15:40, never overtaking the
 * boat ahead, until the boatman nets it out. Undefined off regatta days, before noon and after 17:10.
 */
export function regattaBoat(k: number, day: number, minutes: number): RegattaBoat | undefined {
  if (!Number.isInteger(k) || k < 0 || k >= REGATTA_BOATS || !regattaDay(day)) return undefined;
  const d = Math.floor(day);
  const launch = OUTING_TIMES.regatta.start + REGATTA_LAUNCH_EVERY * k;
  const restAt = 930 + k + 0.5 * (hash(`boat:${d}:${k}`) % 2);
  const restY = REGATTA_COURSE.boomY - REGATTA_COURSE.restGap * k;
  if (minutes < OUTING_TIMES.regatta.depart || minutes >= REGATTA_NETTING.to) return undefined;
  if (minutes < launch) return { ...regattaHandover(k), state: 'ashore', restAt };
  const phase = seedFraction(`boat-sway:${d}:${k}`);
  const x =
    REGATTA_COURSE.laneX +
    REGATTA_COURSE.sway * Math.sin(2 * Math.PI * ((minutes - launch) / SWAY_PERIOD + phase));
  if (minutes < restAt) {
    const progress = (minutes - launch) / (restAt - launch);
    return {
      x,
      y: REGATTA_COURSE.launch.y + (restY - REGATTA_COURSE.launch.y) * progress,
      state: 'drifting',
      restAt,
    };
  }
  const netted = minutes >= REGATTA_NETTING.from + REGATTA_NETTING.every * k;
  return { x, y: restY, state: netted ? 'netted' : 'resting', restAt };
}

// ---- Snowmen on the Lunch Green (SPEC §4.6) ----

/** Year days of the four build days: Winter 3, 7, 11 and 15. Snowman k is built on day k. */
export const SNOWMAN_DAYS = [86, 90, 94, 98] as const;
/** Town minutes on a build day: base 14:00, body 14:40, head 15:15, eyes, carrot and scarf 15:45. */
export const SNOWMAN_STAGES = { base: 840, body: 880, head: 915, dressed: 945 } as const;
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
/** Days a snowman takes to melt, and the half day its carrot and scarf lie on the grass after. */
const MELT_DAYS = 1.2;
const LEFTOVERS_DAYS = 0.5;
/**
 * Snowman k at a town day and minute: its stage (1 base, 2 body, 3 head, 4 dressed; 0 before the
 * base starts on its build day) and how far it has melted (0 to 1; at 1 only the carrot and the
 * scarf are left). Undefined before its build day and once the leftovers are gone. Pure in the
 * year day and minute: no roster, no storage.
 */
export function snowmanState(
  k: number,
  day: number,
  minutes: number,
): { stage: 0 | 1 | 2 | 3 | 4; melt: number } | undefined {
  const built = SNOWMAN_DAYS[k];
  if (built === undefined) return undefined;
  // Whole days and the minute of the day in integers, so 14:00 is never a hair early.
  const spill = Math.floor(minutes / 1440);
  const yearDay = yearDayAt(Math.floor(day) + spill);
  const minute = minutes - spill * 1440;
  if (yearDay < built) return undefined;
  const t = yearDayAt(day, minutes);
  const meltFrom = WINTER + 23 + 3 * seedFraction(`snowman:${k}`);
  if (t >= meltFrom + MELT_DAYS + LEFTOVERS_DAYS) return undefined;
  const stage =
    yearDay > built || minute >= SNOWMAN_STAGES.dressed
      ? 4
      : minute >= SNOWMAN_STAGES.head
        ? 3
        : minute >= SNOWMAN_STAGES.body
          ? 2
          : minute >= SNOWMAN_STAGES.base
            ? 1
            : 0;
  return { stage, melt: smooth((t - meltFrom) / MELT_DAYS) };
}
