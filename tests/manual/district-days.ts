// A helper for the district harness's button files: the absolute town day of a calendar date, so
// a moment reads as the date it shows. Kept apart from district.ts, which imports every button
// file: a value import from there would be read before it is set.
import {
  CALENDAR_EPOCH_DAY,
  DAYS_PER_SEASON,
  DAYS_PER_YEAR,
  SEASONS,
} from '../../src/lib/town-calendar';

/** The absolute town day of a season's date (1–28) in a calendar year (0 is Year 1). */
export const townDay = (season: (typeof SEASONS)[number], date: number, year = 0) =>
  CALENDAR_EPOCH_DAY + year * DAYS_PER_YEAR + SEASONS.indexOf(season) * DAYS_PER_SEASON + date - 1;
