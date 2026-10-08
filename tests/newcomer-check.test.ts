import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOUSE_PLOTS } from '../src/lib/events';
import { houseFileLink, HOUSE_LINK_LIMIT } from '../src/lib/github-new-file';
import { BUILDER_DEFAULT_STORY } from '../src/lib/lanterns';
import { DEFAULT_SIGN, openPlotsNear, placeSchema, type Place } from '../src/lib/schema';
import {
  builderDefaultHouse,
  contributorLike,
  CONTRIBUTOR_EVERY,
  LONGEST,
  longestHouse,
  longestSignHtml,
} from '../scripts/newcomer-houses';
import {
  newcomerHouse,
  reportFailures,
  rosterTests,
  SAMPLE_ANCHORS,
  samplePlots,
} from '../scripts/newcomer-check';
import { fullTownHouse, fullTownNewcomers } from './full-town';

const houses = new Set(HOUSE_PLOTS.map((plot) => plot.id));
const REPOSITORY = 'https://github.com/example/forktown';

describe('The houses the town checks newcomers with', () => {
  it('keep the builder defaults, valid on every house plot, in a file that sorts first', () => {
    for (const plot of houses) {
      const house = newcomerHouse(plot);
      expect(placeSchema.parse(house)).toEqual(house);
      expect(house).toMatchObject({
        id: 'a-new-home',
        name: 'My Little Place',
        plot,
        story: BUILDER_DEFAULT_STORY,
        resident: {
          name: 'New neighbor',
          routine: { morning: 'stroll', afternoon: 'stroll', evening: 'stroll', night: 'stroll' },
        },
        sign: DEFAULT_SIGN,
      });
    }
    // Before every id a contributor can choose, but "a".
    expect(['a-new-home', 'aa', 'after-hours', 'a0'].sort()[0]).toBe('a-new-home');
    expect(builderDefaultHouse('A1', 'quiet-home', 'neighbor', false).resident.routine).toEqual({
      morning: 'work',
      afternoon: 'stroll',
      evening: 'home',
      night: 'sleep',
    });
  });

  it('move a contributor’s own house to each plot checked', () => {
    const own = fullTownHouse('K12');
    expect(newcomerHouse('B2', own)).toEqual({ ...own, plot: 'B2' });
  });

  it('use every character the schema allows, apostrophes and quotes included', () => {
    const made = fullTownHouse('K12');
    for (const mode of ['html', 'text'] as const) {
      const long = longestHouse(made, mode);
      expect(long.sign.mode).toBe(mode);
      const longer = [
        { ...long, name: `${long.name}x` },
        { ...long, story: `${long.story}x` },
        { ...long, resident: { ...long.resident, name: `${long.resident.name}x` } },
        { ...long, resident: { ...long.resident, greeting: `${long.resident.greeting}x` } },
        { ...long, sign: { ...long.sign, text: `${long.sign.text}x` } },
        { ...long, sign: { ...long.sign, html: `${longestSignHtml()}x` } },
      ];
      for (const house of longer) expect(placeSchema.safeParse(house).success).toBe(false);
      // The builder still hands the longest house to GitHub in one link.
      expect(houseFileLink(REPOSITORY, long)!.length).toBeLessThanOrEqual(HOUSE_LINK_LIMIT);
    }
    for (const text of Object.values(LONGEST)) expect(text).toMatch(/'/);
    expect(longestSignHtml()).toHaveLength(2000);
  });

  it('swap a few made-up houses for contributor-like ones, the same on every run', () => {
    const madeUp = fullTownNewcomers([]);
    const town = contributorLike(madeUp);
    expect(contributorLike(madeUp)).toEqual(town);
    expect(town.map((place) => [place.id, place.plot, place.creator])).toEqual(
      madeUp.map((place) => [place.id, place.plot, place.creator]),
    );
    const kinds = (test: (place: Place) => boolean) => town.filter(test).length;
    const expected = Math.ceil(madeUp.length / CONTRIBUTOR_EVERY);
    expect(kinds((place) => place.name === 'My Little Place')).toBe(expected);
    expect(kinds((place) => place.name === LONGEST.name)).toBeGreaterThanOrEqual(expected - 1);
    expect(kinds((place) => place.sign.html.length === 2000)).toBeGreaterThan(0);
    expect(kinds((place) => place.resident.routine.night === 'stroll')).toBeGreaterThan(0);
  });
});

describe('The plots the newcomer check tries', () => {
  it('are free house plots spread over the map, one near each anchor', () => {
    expect(samplePlots(new Set())).toEqual([...SAMPLE_ANCHORS]);
    for (const anchor of SAMPLE_ANCHORS) expect(houses.has(anchor), anchor).toBe(true);
    // A town of its own, so the check holds however the real one grows.
    const taken = new Set(['R2', 'D13', 'D12', 'T1']);
    const sample = samplePlots(taken);
    expect(sample).toHaveLength(SAMPLE_ANCHORS.length);
    expect(new Set(sample).size).toBe(sample.length);
    for (const plot of sample) expect(houses.has(plot) && !taken.has(plot), plot).toBe(true);
    expect(sample[0]).toBe(openPlotsNear('R2', taken, 1)[0]);
  });

  it('stop when the town has no free plot left', () => {
    expect(samplePlots(houses)).toEqual([]);
  });
});

describe('The tests the newcomer check runs', () => {
  it('are every test file that reads the town, itself or through what it imports', () => {
    const tests = rosterTests(process.cwd());
    // Reads places/ through its imports, and the arrival order itself.
    expect(tests).toContain('tests/tube-travel.test.ts');
    expect(tests).toContain('tests/town-arrivals.test.ts');
    expect(tests).toContain('tests/contributions.test.ts');
    // Reads no house at all.
    expect(tests).not.toContain('tests/brand.test.ts');
    expect(tests.every((file) => /^tests\/[^/]+\.test\.(ts|tsx|js)$/.test(file))).toBe(true);
  });

  it('report each failed test by file, and a file that never ran', () => {
    const folder = mkdtempSync(join(tmpdir(), 'forktown-newcomer-report-'));
    try {
      const report = join(folder, 'report.json');
      writeFileSync(
        report,
        JSON.stringify({
          testResults: [
            {
              name: 'C:/town/tests/a.test.ts',
              assertionResults: [
                { fullName: 'passes', status: 'passed' },
                { fullName: 'fails', status: 'failed' },
              ],
            },
            { name: '/town/tests/b.test.ts', assertionResults: [] },
          ],
        }),
      );
      expect(reportFailures(report)).toEqual([
        { file: 'tests/a.test.ts', test: 'fails' },
        { file: 'tests/b.test.ts', test: '(the file did not run)' },
      ]);
      expect(reportFailures(join(folder, 'missing.json'))).toEqual([
        { file: '-', test: 'Vitest wrote no report' },
      ]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
