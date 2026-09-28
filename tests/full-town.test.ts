import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOUSE_PLOTS } from '../src/lib/events';
import {
  ACTIVITIES,
  BUILDING_TYPES,
  DECORATIONS,
  designSchema,
  validatePlaces,
} from '../src/lib/schema';
import { compileSign } from '../src/lib/sign';
import { AFTER_HOURS } from './fixtures';
import {
  FULL_TOWN_CREATOR,
  fullTown,
  fullTownHouse,
  fullTownId,
  fullTownNewcomers,
  readPlaces,
} from './full-town';

// The made-up full town that the growth checks and `npm run check:full-town` lean on.

const places = readPlaces();
const everyone = fullTown([]);
const kinds = <T>(pick: (place: (typeof everyone)[number]) => T) => new Set(everyone.map(pick));

describe('A full town', () => {
  it('keeps every real neighbor and fills every other house plot', () => {
    const town = fullTown(places);
    expect(town.slice(0, places.length)).toEqual(places);
    expect(town).toHaveLength(HOUSE_PLOTS.length);
    expect(new Set(town.map((place) => place.plot))).toEqual(
      new Set(HOUSE_PLOTS.map((plot) => plot.id)),
    );
    expect(fullTown(town)).toEqual(town);
  });

  it('passes the validator exactly as check:full-town writes the files', () => {
    const files = fullTown(places).map((place) => ({
      file: `${place.id}.json`,
      data: JSON.parse(JSON.stringify(place)),
    }));
    const { errors, places: valid } = validatePlaces(files);
    expect(errors).toEqual([]);
    expect(valid).toHaveLength(HOUSE_PLOTS.length);
  });

  it('puts the same house on a plot however many real neighbors there are', () => {
    const alone = new Map(everyone.map((place) => [place.plot, place]));
    for (const roster of [places.slice(0, 1), places])
      for (const place of fullTownNewcomers(roster)) expect(place).toEqual(alone.get(place.plot));
    for (const [plot, place] of alone) {
      expect(fullTownHouse(plot)).toEqual(place);
      expect(place).toMatchObject({ id: fullTownId(plot), creator: FULL_TOWN_CREATOR });
    }
    expect(() => fullTownHouse('Z99')).toThrow();
  });

  it('puts its made-up houses first when read, then the real ones by file name', () => {
    // So in check:full-town, a test that leans on "the first house in places/" meets a made-up
    // one, and most likely fails there rather than in a newcomer's pull request.
    const folder = mkdtempSync(join(tmpdir(), 'forktown-read-places-'));
    try {
      for (const place of [
        { ...AFTER_HOURS, id: 'zz-top' },
        fullTownHouse('Q10'),
        AFTER_HOURS,
        { ...AFTER_HOURS, id: '0-first' },
        fullTownHouse('A4'),
      ])
        writeFileSync(join(folder, `${place.id}.json`), JSON.stringify(place));
      expect(readPlaces(folder).map((place) => place.id)).toEqual([
        fullTownId('A4'),
        fullTownId('Q10'),
        '0-first',
        'after-hours',
        'zz-top',
      ]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it('leaves reading places/ to readPlaces(), so every test meets the made-up houses first', () => {
    // A test with a loader of its own would meet the real houses first, and check:full-town could
    // not catch it leaning on the first of them.
    const loaders = readdirSync('tests')
      .filter((file) => /\.(ts|tsx|js)$/.test(file) && file !== 'full-town.ts')
      .filter((file) =>
        /readdir(?:Sync)?\(\s*['"`](?:\.\/)?places\b/.test(readFileSync(`tests/${file}`, 'utf8')),
      );
    expect(loaders, 'Read the town with readPlaces() from tests/full-town.ts').toEqual([]);
  });

  it('shows everything the builder offers, with at most two floors', () => {
    expect(kinds((place) => place.building)).toEqual(new Set(BUILDING_TYPES));
    expect(kinds((place) => place.decoration)).toEqual(new Set(DECORATIONS));
    expect(kinds((place) => place.design.floors)).toEqual(new Set([1, 2]));
    for (const choice of ['roof', 'windows', 'garden', 'feature'] as const)
      expect(kinds((place) => place.design[choice])).toEqual(
        new Set(designSchema.shape[choice].options),
      );
    expect(kinds((place) => place.sign.mode)).toEqual(new Set(['text', 'html', 'none']));
    // HTML signs of one, two and three runs of text.
    const runs = (html: string) => (html ? compileSign(html).lines.length : 0);
    expect(kinds((place) => runs(place.sign.html))).toEqual(new Set([0, 1, 2, 3]));
    expect(kinds((place) => place.resident.figure)).toEqual(new Set(['male', 'female']));
    expect(kinds((place) => place.resident.accessory)).toEqual(new Set(['none', 'hat', 'glasses']));
    // All 54 routines, night owls included.
    expect(kinds((place) => JSON.stringify(place.resident.routine)).size).toBe(
      ACTIVITIES.length ** 3 * 2,
    );
  });
});
