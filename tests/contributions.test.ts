import { ZOO_PLOTS } from '../src/lib/zoo';
import { FARM_PLOTS } from '../src/lib/farm';
import { MILLPOND_PLOTS } from '../src/lib/millpond';
import { TUBE_HALT_PLOTS } from '../src/lib/tubes';
import { MARKET_PLOTS } from '../src/lib/district-places';
import { describe, expect, it } from 'vitest';
import {
  draftSchema,
  openPlotsNear,
  placeSchema,
  validatePlaces,
  type Place,
} from '../src/lib/schema';
import { OPEN_PLOTS_COPY } from '../src/lib/open-plots';
import {
  PLOTS,
  findPlotAt,
  getPlot,
  plotCenter,
  plotEntrance,
  isRoad,
  ROAD_MIN,
  ROAD_MAX_X,
  ROAD_MAX_Y,
  project,
  unproject,
} from '../src/lib/world';
import { buildingHit, shade } from '../src/city/render';
import { HOUSE_PLOTS } from '../src/lib/events';
import { FOOTBALL_PLOTS } from '../src/lib/football';
import { CINEMA_PLOTS } from '../src/lib/cinema';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { placeJsonErrors, readPlaceFiles } from '../scripts/place-files';
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'vite';

const sample: Place = placeSchema.parse({
  id: 'tiny-library',
  name: 'Tiny Library',
  creator: 'new-neighbor',
  plot: 'A1',
  building: 'bookshop',
  color: '#759BAF',
  decoration: 'bench',
  story: 'A little library for very big ideas.',
});

describe('The contribution contract', () => {
  it('preserves unfinished text in a draft while requiring valid rendering options', () => {
    const unfinished = {
      ...sample,
      creator: '',
      name: '',
      story: 'Still thinking',
      id: 'UPPERCASE',
    };
    expect(draftSchema.safeParse(unfinished).success).toBe(true);
    expect(placeSchema.safeParse(unfinished).success).toBe(false);
    expect(draftSchema.safeParse({ ...unfinished, building: 'unknown' }).success).toBe(false);
  });
  it('accepts the file a first-time contributor can write', () => {
    expect(validatePlaces([{ file: 'tiny-library.json', data: sample }])).toEqual({
      places: [sample],
      errors: [],
    });
  });
  it('explains where a contributor needs to fix a mistake', () => {
    const { errors } = validatePlaces([
      {
        file: 'tiny-library.json',
        data: { ...sample, creator: '@new-neighbor', color: 'blue', plot: 'Z99' },
      },
    ]);
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).toContain('without the @');
    expect(errors.join('\n')).toContain('six-digit hex color');
    expect(errors.join('\n')).toContain('Plot "Z99" is not on the town map.');
  });
  it('names the public place on a plot no house may take, and open plots near it', () => {
    // A town of its own, so the suggestions hold however the real one grows.
    const errors = (plot: string) =>
      validatePlaces([
        { file: 'tiny-library.json', data: sample },
        { file: 'barley-house.json', data: { ...sample, id: 'barley-house', plot } },
      ]).errors;
    expect(errors('R1')).toEqual([
      'barley-house.json → plot: Plot R1 is reserved for Barley Halt on the Treeline, a public place. Pick an open plot such as Q1, R2 or S1.',
    ]);
    expect(errors('D7')).toEqual([
      'barley-house.json → plot: Plot D7 is reserved for the Starlight Cinema, a public place. Pick an open plot such as C7, D8 or C6.',
    ]);
    // Every plot that is no house plot names what stands there, in one sentence of its own.
    const houses = new Set(HOUSE_PLOTS.map((plot) => plot.id));
    for (const plot of PLOTS.filter((plot) => !houses.has(plot.id))) {
      const [error, ...more] = errors(plot.id);
      expect(more, plot.id).toEqual([]);
      expect(error, plot.id).toMatch(
        new RegExp(
          `^barley-house\\.json → plot: Plot ${plot.id} is reserved for [^.]+, a public place\\. Pick an open plot such as [A-T]\\d+, [A-T]\\d+ or [A-T]\\d+\\.$`,
        ),
      );
      expect(error, plot.id).not.toMatch(/undefined|The /);
    }
  });
  it('says how plots are named when a plot is not on the map', () => {
    const errors = (plot: string) =>
      validatePlaces([{ file: 'tiny-library.json', data: { ...sample, plot } }]).errors;
    const map =
      'is not on the town map. Plots are a row letter from A to T and a column number from 1 to 15, like A1 or T15.';
    expect(errors('r2')).toEqual([`tiny-library.json → plot: Plot "r2" ${map} Did you mean R2?`]);
    expect(errors('C16')).toEqual([`tiny-library.json → plot: Plot "C16" ${map}`]);
    expect(errors('U1')).toEqual([`tiny-library.json → plot: Plot "U1" ${map}`]);
  });
  it('says the town needs to grow when a public plot has no open plot near it', () => {
    const town = HOUSE_PLOTS.map((plot) => {
      const id = `home-${plot.id.toLowerCase()}`;
      return { file: `${id}.json`, data: { ...sample, id, plot: plot.id } };
    });
    const { errors } = validatePlaces([
      ...town,
      { file: 'barley-house.json', data: { ...sample, id: 'barley-house', plot: 'R1' } },
    ]);
    expect(errors).toEqual([
      `barley-house.json → plot: Plot R1 is reserved for Barley Halt on the Treeline, a public place. ${OPEN_PLOTS_COPY.full}`,
    ]);
  });
  it('rejects duplicate plot claims, naming both files and open plots nearby', () => {
    const { errors } = validatePlaces([
      { file: 'tiny-library.json', data: sample },
      { file: 'my-cafe.json', data: { ...sample, id: 'my-cafe', name: 'My Café' } },
    ]);
    expect(errors).toEqual([
      'Plot A1 is claimed by both "tiny-library.json" and "my-cafe.json". If yours is the new one, pick an open plot such as A2, B1 or B2.',
    ]);
  });
  it('never suggests a plot another file asks for, even one that is not valid yet', () => {
    const { errors } = validatePlaces([
      { file: 'tiny-library.json', data: sample },
      { file: 'my-cafe.json', data: { ...sample, id: 'my-cafe' } },
      { file: 'draft.json', data: { plot: 'A2' } },
    ]);
    expect(errors).toContain(
      'Plot A1 is claimed by both "tiny-library.json" and "my-cafe.json". If yours is the new one, pick an open plot such as B1, B2 or A3.',
    );
  });
  it('rejects duplicate ids even when the plots differ', () => {
    const { errors } = validatePlaces([
      { file: 'tiny-library.json', data: sample },
      { file: 'tiny-library.json', data: { ...sample, plot: 'A2' } },
    ]);
    expect(errors[0]).toContain('already used');
  });
  it('tells the contributor how to name their file', () => {
    const { errors } = validatePlaces([{ file: 'my-file.json', data: sample }]);
    expect(errors[0]).toContain('Rename this file to tiny-library.json');
  });
  it.each([
    'con',
    'prn',
    'aux',
    'nul',
    ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
    ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
  ])('rejects Windows device filenames before they reach any checkout: %s', (id) => {
    const result = validatePlaces([{ file: `${id}.json`, data: { ...sample, id } }]);
    expect(result.errors.join(' ')).toContain('reserved on Windows');
    expect(result.places).toEqual([]);
    expect(placeSchema.safeParse({ ...sample, id: `${id}-house` }).success).toBe(true);
  });
  it.each(['../escape', 'a/b', 'Upper-Case', 'two--hyphens', '-start', 'end-', ''])(
    'rejects unsafe or ambiguous ids: %s',
    (id) => {
      expect(placeSchema.safeParse({ ...sample, id }).success).toBe(false);
    },
  );
  it.each(['-bad', 'bad-', 'double--dash', 'has space', '<script>', '@name'])(
    'rejects invalid creator names: %s',
    (creator) => {
      expect(placeSchema.safeParse({ ...sample, creator }).success).toBe(false);
    },
  );
  it('accepts normal mixed-case GitHub usernames', () => {
    expect(placeSchema.safeParse({ ...sample, creator: 'A-New-Neighbor9' }).success).toBe(true);
  });
  it('rejects unknown executable fields and oversized content', () => {
    expect(placeSchema.safeParse({ ...sample, script: 'alert(1)' }).success).toBe(false);
    expect(placeSchema.safeParse({ ...sample, story: 'a'.repeat(181) }).success).toBe(false);
    expect(placeSchema.safeParse({ ...sample, building: 'anything-goes' }).success).toBe(false);
  });
  it('allows exactly one resident object per house, never a list or extra residents', () => {
    expect(
      placeSchema.safeParse({ ...sample, resident: [sample.resident, sample.resident] }).success,
    ).toBe(false);
    expect(placeSchema.safeParse({ ...sample, residents: [sample.resident] }).success).toBe(false);
    expect(
      placeSchema.safeParse({
        ...sample,
        resident: { ...sample.resident, roommate: sample.resident },
      }).success,
    ).toBe(false);
  });
  it('trims names and stories while retaining international characters', () => {
    const result = placeSchema.parse({
      ...sample,
      name: '  Café קטן  ',
      story: '  A tiny place for everyone.  ',
    });
    expect(result.name).toBe('Café קטן');
    expect(result.story).toBe('A tiny place for everyone.');
  });
});

describe('The open plots a plot clash suggests', () => {
  const houses = HOUSE_PLOTS.map((plot) => plot.id);
  const distance = (a: string, b: string) =>
    (getPlot(a)!.col - getPlot(b)!.col) ** 2 + (getPlot(a)!.row - getPlot(b)!.row) ** 2;

  it('are the nearest open house plots, never a taken or public one', () => {
    const problems: string[] = [];
    // Towns from empty to nearly full, the same on every run: every nth house plot stays free.
    for (const n of [1, 2, 3, 7, 50]) {
      const town = houses.filter((_, i) => i % n !== 0);
      for (const plot of houses) {
        const taken = new Set([...town, plot]);
        const open = openPlotsNear(plot, taken);
        const free = houses.filter((id) => !taken.has(id));
        const farthest = Math.max(...open.map((id) => distance(plot, id)));
        if (
          open.length !== Math.min(3, free.length) ||
          new Set(open).size !== open.length ||
          open.some(
            (id) => taken.has(id) || !placeSchema.safeParse({ ...sample, plot: id }).success,
          ) ||
          free.some((id) => !open.includes(id) && distance(plot, id) < farthest)
        )
          problems.push(`${plot} in a town of ${taken.size}: ${open.join(', ')}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('says the town needs to grow when every house plot is taken', () => {
    const town = houses.map((plot) => {
      const id = `home-${plot.toLowerCase()}`;
      return { file: `${id}.json`, data: { ...sample, id, plot } };
    });
    const late = { file: 'late.json', data: { ...sample, id: 'late', plot: 'A1' } };
    expect(validatePlaces([...town, late]).errors).toEqual([
      `Plot A1 is claimed by both "home-a1.json" and "late.json". ${OPEN_PLOTS_COPY.full}`,
    ]);
  });
});

describe('The world stays predictable as people contribute', () => {
  it('preserves building colors through the second shading pass at night', () => {
    expect(shade(shade('#C97878', -30), 14)).toBe('#b96868');
    expect(shade('#FFFFFF', 30)).toBe('#ffffff');
    expect(shade('#000000', -30)).toBe('#000000');
  });
  it('has 300 unique plots with public venues, football ground, cinema, zoo, farm, millpond, the Riverside and tube halts reserved', () => {
    expect(new Set(PLOTS.map((plot) => plot.id)).size).toBe(300);
    for (const plot of PLOTS)
      expect(placeSchema.safeParse({ ...sample, plot: plot.id }).success).toBe(
        ![
          'B5',
          'C5',
          'D3',
          ...FOOTBALL_PLOTS,
          ...CINEMA_PLOTS,
          ...ZOO_PLOTS,
          ...FARM_PLOTS,
          ...MILLPOND_PLOTS,
          ...TUBE_HALT_PLOTS,
          ...MARKET_PLOTS,
          'J15',
          'K15',
        ].includes(plot.id),
      );
  });
  it('keeps the same coordinates for an existing plot regardless of other places', () => {
    expect(getPlot('B2')).toEqual({ id: 'B2', col: 1, row: 1, x: 7, y: 7 });
    expect(getPlot('E5')).toEqual({ id: 'E5', col: 4, row: 4, x: 19, y: 19 });
  });
  it('round-trips projected coordinates, including negative positions', () => {
    for (const [x, y] of [
      [0, 0],
      [5, 9],
      [-2, 8],
      [3.25, 7.75],
    ]) {
      const pixel = project(x, y),
        world = unproject(pixel.x, pixel.y);
      expect(world.x).toBeCloseTo(x);
      expect(world.y).toBeCloseTo(y);
    }
  });
  it('makes every ground plot selectable while leaving roads unclaimed', () => {
    for (const plot of PLOTS) expect(findPlotAt(plot.x + 0.5, plot.y + 0.5)?.id).toBe(plot.id);
    expect(findPlotAt(1, 1)).toBeUndefined();
    expect(findPlotAt(-10, 500)).toBeUndefined();
  });
  it('gives every home a selectable three-by-three grass plot bounded by streets', () => {
    for (const plot of HOUSE_PLOTS) {
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          expect(isRoad(plot.x + dx, plot.y + dy)).toBe(false);
          expect(findPlotAt(plot.x + dx + 0.5, plot.y + dy + 0.5)?.id).toBe(plot.id);
        }
      const entrance = plotEntrance(plot);
      expect(isRoad(Math.floor(entrance.x), Math.floor(entrance.y))).toBe(true);
      expect(findPlotAt(entrance.x, entrance.y)).toBeUndefined();
    }
    for (let x = ROAD_MIN; x <= ROAD_MAX_X; x++)
      for (let y = ROAD_MIN; y <= ROAD_MAX_Y; y++) {
        if (isRoad(x, y)) expect(findPlotAt(x + 0.5, y + 0.5)).toBeUndefined();
      }
  });
  it('selects a tall building by its roof, above the ground tile', () => {
    const center = plotCenter(getPlot(sample.plot)!);
    expect(buildingHit({ x: center.x, y: center.y - 75 }, [sample])).toBe('A1');
    expect(buildingHit({ x: center.x + 200, y: center.y - 75 }, [sample])).toBeUndefined();
  });
});

describe('Place files on disk', () => {
  const folder = async () => {
    const root = await mkdtemp(join(tmpdir(), 'forktown-place-files-'));
    await mkdir(join(root, 'places'));
    await mkdir(join(root, 'docs'));
    await writeFile(join(root, 'places', 'tiny-library.json'), JSON.stringify(sample));
    await writeFile(join(root, 'docs', 'real.json'), JSON.stringify({ ...sample, plot: 'A3' }));
    return root;
  };
  const read = (root: string, name = 'places') =>
    readPlaceFiles(pathToFileURL(join(root, name) + '/'));

  it('reads plain JSON files and skips other plain files', async () => {
    const root = await folder();
    try {
      await writeFile(join(root, 'places', '.DS_Store'), '');
      expect(await read(root)).toEqual({
        files: 1,
        entries: [{ file: 'tiny-library.json', data: sample }],
        errors: [],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reads a house saved as UTF-8 with a byte-order mark, as some Windows editors save it', async () => {
    const root = await folder();
    try {
      const house = { ...sample, id: 'bom-house', plot: 'A3' };
      await writeFile(join(root, 'places', 'bom-house.json'), `\uFEFF${JSON.stringify(house)}`);
      expect(await read(root)).toEqual({
        files: 2,
        entries: [
          { file: 'bom-house.json', data: house },
          { file: 'tiny-library.json', data: sample },
        ],
        errors: [],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects links and folders, which the build would follow somewhere else', async () => {
    const root = await folder();
    try {
      await mkdir(join(root, 'places', 'folder.json'));
      // A folder link works without extra rights on Windows; a file link may not.
      await symlink(
        join(root, 'docs'),
        join(root, 'places', 'linked-folder'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      let fileLink = true;
      try {
        await symlink(join(root, 'docs', 'real.json'), join(root, 'places', 'linked.json'));
      } catch {
        fileLink = false;
      }
      const result = await read(root);
      expect(result.entries.map((entry) => entry.file)).toEqual(['tiny-library.json']);
      expect(result.errors.map((error) => error.split(':')[0])).toEqual(
        ['folder.json', 'linked-folder', ...(fileLink ? ['linked.json'] : [])].sort(),
      );
      expect(result.errors[0]).toContain('Keep only plain files in places/');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('names a broken house file when Vite loads it, never "[object Object]"', async () => {
    const root = await folder();
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [placeJsonErrors()],
      server: { middlewareMode: true, hmr: false, watch: null },
    });
    try {
      const broken = join(root, 'places', 'broken.json');
      await writeFile(broken, '{\n  "id": "broken",\n}\n');
      const error = await server.environments.ssr
        .transformRequest('/places/broken.json')
        .catch((error: { message: string; id: unknown }) => error);
      expect(error).toMatchObject({
        message: expect.stringContaining('broken.json: This is not valid JSON.'),
        // Vite names a file by its real path, which differs where the temp folder sits behind a
        // link, as it does on macOS.
        id: (await realpath(broken)).replaceAll('\\', '/'),
      });
      expect(await server.environments.ssr.transformRequest('/places/tiny-library.json')).toEqual(
        expect.objectContaining({ code: expect.stringContaining('Tiny Library') }),
      );
      // Saved as "UTF-8 with BOM", as some Windows editors do: Vite loads it like any other.
      await writeFile(join(root, 'places', 'bom-house.json'), `\uFEFF${JSON.stringify(sample)}`);
      expect(await server.environments.ssr.transformRequest('/places/bom-house.json')).toEqual(
        expect.objectContaining({ code: expect.stringContaining('Tiny Library') }),
      );
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a places folder that is itself a link', async () => {
    const root = await folder();
    try {
      await symlink(
        join(root, 'places'),
        join(root, 'linked-places'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      expect((await read(root, 'linked-places')).errors).toEqual([
        'places/ must be a plain folder, not a link.',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('The examples a newcomer copies', () => {
  it.each(['examples/my-little-place.json', 'examples/living-place.json'])(
    '%s is a valid house on a house plot, with a placeholder id',
    (file) => {
      const example = placeSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
      expect(HOUSE_PLOTS.map((plot) => plot.id)).toContain(example.plot);
      // It matches the documented copy target, places/your-unique-id.json.
      expect(example.id).toBe('your-unique-id');
      // A copy that keeps it fails the quick check, not only the tests.
      expect(validatePlaces([{ file: 'your-unique-id.json', data: example }]).errors).toEqual([
        'your-unique-id.json: "your-unique-id" is the example\'s id. Choose your own id and rename the file to match.',
      ]);
    },
  );
});

describe('The buttons the guides tell newcomers to click', () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? sources(join(dir, entry.name))
        : /\.tsx?$/.test(entry.name)
          ? [readFileSync(join(dir, entry.name), 'utf8')]
          : [],
    );
  const app = sources('src').join('\n');
  // GitHub's own buttons, which the guides walk through too.
  const github = new Set([
    'Create fork',
    'Compare & pull request',
    'Commit changes',
    'Propose changes',
    'Create pull request',
    'Update branch',
  ]);

  it.each(['README.md', 'CONTRIBUTING.md'])(
    '%s names only labels the town really shows',
    (file) => {
      const labels = [
        ...readFileSync(file, 'utf8').matchAll(
          /\b(?:click|choose|select|press|says|see|opens?|in the) \*\*([^*]+)\*\*/gi,
        ),
      ].flatMap(([, label]) => label.split('→').map((part) => part.trim()));
      expect(labels.length).toBeGreaterThan(5);
      for (const label of labels)
        if (!github.has(label)) expect(app.includes(label), label).toBe(true);
    },
  );
});
