import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SEASON_NOTES, seasonNote } from '../src/lib/season-copy';
import {
  AUTUMN,
  canopyAt,
  firefliesAt,
  pumpkinOut,
  snowAt,
  snowCoverAt,
  SPRING,
  SUMMER,
  WINTER,
  yearDayAt,
  type TreeKind,
} from '../src/lib/seasons';
import {
  CALENDAR_EPOCH_DAY,
  DAYS_PER_SEASON,
  DAYS_PER_YEAR,
  townCalendarAt,
} from '../src/lib/town-calendar';

const EPOCH = CALENDAR_EPOCH_DAY;
/** The year day of a calendar date: yearDayOf(AUTUMN, 12) is Autumn 12, 00:00. */
const yearDayOf = (season: number, date: number, minutes = 0) => season + date - 1 + minutes / 1440;
/** Every half town hour of one whole year. */
const HALF_HOURS = Array.from({ length: DAYS_PER_YEAR * 48 }, (_, i) => i / 48);
// seedFraction returns 0 up to 10006/10007, so the latest schedule is the last seed.
const LAST_SEED = 10006 / 10007;
const SEEDS = [...Array.from({ length: 50 }, (_, i) => i / 50), LAST_SEED];
const LEAFY: TreeKind[] = ['deciduous', 'blossom', 'larch'];
const firstFew = (wrong: string[]) => wrong.slice(0, 5);
const label = (yearDay: number) =>
  townCalendarAt(EPOCH + Math.floor(yearDay), (yearDay % 1) * 1440).label;

/** The share of seeded trees or doorsteps for which `test` holds. */
const share = (test: (s: number) => boolean) => SEEDS.filter(test).length / SEEDS.length;
const flowering = (d: number, s: number) => canopyAt(d, s, 'blossom');
const broadleaf = (d: number, s: number) => canopyAt(d, s, 'deciduous');
/** 22:00 on the same date. The line stands all day, so "after dark" means tonight. */
const tonight = (d: number) => firefliesAt(Math.floor(d) + 1320 / 1440, 1320);
/** The last moment of the same date, for things that happen during the day. */
const byMidnight = (d: number) => Math.floor(d) + 1 - 1e-9;

// What has to be true in town, at any moment of the day, for each line to stand.
const TRUE_TODAY: Record<string, (d: number) => boolean> = {
  // Leaf-out has begun but the latest trees are still bare twigs, and the middle flowering tree
  // has not opened.
  'The first green on bare branches.': (d) =>
    broadleaf(d, LAST_SEED).dormant > 0.5 && flowering(d, 0.5).blossom < 0.3,
  'Blossom on the branches.': (d) => share((s) => flowering(d, s).blossom > 0.3) >= 0.4,
  'Petals on the paths.': (d) => share((s) => flowering(d, s).petals > 0.3) >= 0.25,
  'Everything in leaf.': (d) =>
    SEEDS.every((s) =>
      LEAFY.every(
        (kind) => canopyAt(d, s, kind).dormant === 0 && canopyAt(d, s, kind).blossom === 0,
      ),
    ),
  'Long days ahead.': (d) => d >= SUMMER && tonight(d) < 0.5,
  'Fireflies after dark.': (d) => tonight(d) > 0.5,
  // Fewer fireflies each night and no tree has turned yet, into the first days of autumn.
  'The last warm nights.': (d) =>
    tonight(d) < 0.75 && SEEDS.every((s) => broadleaf(d, s).turn < 0.5),
  'The first leaves are turning.': (d) =>
    SEEDS.some((s) => broadleaf(d, s).turn > 0.3) && broadleaf(d, LAST_SEED).turn === 0,
  'Ochre trees and pumpkins on the steps.': (d) =>
    share((s) => broadleaf(d, s).turn > 0.5) >= 0.5 &&
    share((s) => broadleaf(d, s).deepen < 0.5) >= 1 / 3 &&
    share((s) => pumpkinOut(d, s)) >= 0.25,
  'Russet trees and pumpkins on the steps.': (d) =>
    share((s) => broadleaf(d, s).deepen > 0.5) >= 0.5 &&
    share((s) => broadleaf(d, s).dormant > 0.5) === 0 &&
    share((s) => pumpkinOut(d, s)) >= 0.9,
  'Leaves on the lawns.': (d) => share((s) => broadleaf(d, s).leaves > 0.5) >= 0.9,
  // The first snow falls on Winter 1 and lies by the end of Winter 2.
  'The first snow.': (d) => d < WINTER + 2 && snowCoverAt(byMidnight(d)) > 0.5,
  'Snow on the rooftops.': (d) => SEEDS.every((s) => snowAt(d, s) > 0.9),
  // By the end of the day, some roofs have cleared.
  'The thaw.': (d) => SEEDS.some((s) => snowAt(byMidnight(d), s) < 0.5),
};

describe('The almanac line', () => {
  it('speaks in the town voice', () => {
    for (const { note } of SEASON_NOTES) {
      // One plain roman sentence: a capital, a single full stop, no markup, no exclamation.
      expect(note).toMatch(/^[A-Z][a-z ]+\.$/);
      expect(note.split(' ').length).toBeLessThanOrEqual(7);
      // Amber is for light: leaves are ochre and russet, and nothing here glows.
      expect(note).not.toMatch(/amber|gold|glow|lantern|little/i);
    }
    expect(new Set(SEASON_NOTES.map((stage) => stage.note)).size).toBe(SEASON_NOTES.length);
  });

  it('covers the whole year in order, one stage after another', () => {
    expect(SEASON_NOTES[0].from).toBe(SPRING);
    expect(SEASON_NOTES.at(-1)!.to).toBe(DAYS_PER_YEAR);
    SEASON_NOTES.forEach((stage, i) => {
      expect(Number.isInteger(stage.from) && Number.isInteger(stage.to)).toBe(true);
      expect(stage.to).toBeGreaterThan(stage.from);
      if (i) expect(stage.from).toBe(SEASON_NOTES[i - 1].to);
    });
    for (const d of HALF_HOURS) {
      const note = seasonNote(d);
      expect(note.length).toBeGreaterThan(0);
      expect(SEASON_NOTES.find((stage) => d >= stage.from && d < stage.to)?.note).toBe(note);
    }
  });

  it('turns at midnight with the date, never during a day', () => {
    const wrong = HALF_HOURS.filter((d) => seasonNote(d) !== seasonNote(Math.floor(d))).map(label);
    expect(firstFew(wrong)).toEqual([]);
    expect(seasonNote(yearDayOf(SPRING, 4, 1439.999))).toBe('The first green on bare branches.');
    expect(seasonNote(yearDayOf(SPRING, 5))).toBe('Blossom on the branches.');
  });

  it('follows the calendar through the year', () => {
    const almanac: [number, number, string][] = [
      [SPRING, 1, 'The first green on bare branches.'],
      [SPRING, 5, 'Blossom on the branches.'],
      [SPRING, 19, 'Blossom on the branches.'],
      [SPRING, 20, 'Petals on the paths.'],
      [SPRING, 27, 'Everything in leaf.'],
      [SUMMER, 1, 'Long days ahead.'],
      [SUMMER, 3, 'Fireflies after dark.'],
      [SUMMER, 25, 'Fireflies after dark.'],
      [SUMMER, 26, 'The last warm nights.'],
      [AUTUMN, 2, 'The last warm nights.'],
      [AUTUMN, 3, 'The first leaves are turning.'],
      [AUTUMN, 7, 'Ochre trees and pumpkins on the steps.'],
      [AUTUMN, 16, 'Russet trees and pumpkins on the steps.'],
      [AUTUMN, 23, 'Leaves on the lawns.'],
      [AUTUMN, 28, 'Leaves on the lawns.'],
      [WINTER, 1, 'The first snow.'],
      [WINTER, 3, 'Snow on the rooftops.'],
      [WINTER, 23, 'Snow on the rooftops.'],
      [WINTER, 24, 'The thaw.'],
      [WINTER, 28, 'The thaw.'],
    ];
    for (const [season, date, note] of almanac) {
      expect(seasonNote(yearDayOf(season, date)), label(yearDayOf(season, date))).toBe(note);
      expect(seasonNote(yearDayOf(season, date, 1320))).toBe(note);
    }
  });

  it('keeps each line inside its season, except the last warm nights of summer', () => {
    for (const { from, to, note } of SEASON_NOTES) {
      const season = Math.floor(from / DAYS_PER_SEASON);
      if (note === 'The last warm nights.') expect(to).toBe(AUTUMN + 2);
      else expect(Math.floor((to - 1) / DAYS_PER_SEASON), note).toBe(season);
    }
  });

  it('wraps like the town year, so callers never need to mod', () => {
    expect(seasonNote(DAYS_PER_YEAR)).toBe(seasonNote(0));
    expect(seasonNote(DAYS_PER_YEAR * 3 + 30.5)).toBe(seasonNote(30.5));
    expect(seasonNote(-0.25)).toBe('The thaw.');
    expect(seasonNote(-DAYS_PER_YEAR + 90)).toBe('Snow on the rooftops.');
    // The same line for the same day of any year, before or after the epoch.
    for (const year of [-3, 0, 1, 7])
      for (const d of [0, 12, 40, 70, 95])
        expect(seasonNote(yearDayAt(EPOCH + year * DAYS_PER_YEAR + d, 600))).toBe(seasonNote(d));
  });

  it('is a pure function of the year day', () => {
    expect(HALF_HOURS.map(seasonNote)).toEqual(HALF_HOURS.map(seasonNote));
    expect(readFileSync('src/lib/season-copy.ts', 'utf8')).not.toMatch(/Date|Math\.random/);
  });
});

describe('The almanac never lies', () => {
  it('names only what a visitor can find in town that day', () => {
    expect(Object.keys(TRUE_TODAY).sort()).toEqual(SEASON_NOTES.map((stage) => stage.note).sort());
    const wrong = HALF_HOURS.filter((d) => !TRUE_TODAY[seasonNote(d)](d)).map(
      (d) => `${label(d)}: ${seasonNote(d)}`,
    );
    expect(firstFew(wrong)).toEqual([]);
  });

  it('mentions snow only in winter, blossom only in spring and fireflies only on warm nights', () => {
    for (const d of HALF_HOURS) {
      const note = seasonNote(d);
      if (/snow|thaw/i.test(note)) expect(d, note).toBeGreaterThanOrEqual(WINTER);
      if (/bud|blossom|petal/i.test(note)) expect(d, note).toBeLessThan(SUMMER);
      if (/firefl/i.test(note)) expect(tonight(d), label(d)).toBeGreaterThan(0.5);
      if (/snow on/i.test(note)) expect(snowCoverAt(d), label(d)).toBeGreaterThan(0);
    }
  });

  it('does not miss the best of the year', () => {
    const wrong: string[] = [];
    for (const d of HALF_HOURS) {
      const note = seasonNote(d);
      const miss = (what: string) => wrong.push(`${label(d)}: ${what}, but "${note}"`);
      if (share((s) => flowering(d, s).blossom > 0.9) >= 0.9 && note !== 'Blossom on the branches.')
        miss('in full flower');
      if (tonight(d) >= 0.95 && note !== 'Fireflies after dark.') miss('fireflies tonight');
      // The line stands all day, so it only owes the snow to a day that keeps it until midnight.
      const allDay = [Math.floor(d), byMidnight(d)];
      if (
        SEEDS.every((s) => allDay.every((t) => snowAt(t, s) > 0.99)) &&
        !['The first snow.', 'Snow on the rooftops.'].includes(note)
      )
        miss('snow on every roof');
    }
    expect(firstFew(wrong)).toEqual([]);
  });
});
