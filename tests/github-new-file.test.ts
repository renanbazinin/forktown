import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StartOnGitHub from '../src/components/StartOnGitHub';
import pools from '../src/data/draft-names.json';
import { GUIDE_COPY, guideSteps } from '../src/lib/brand';
import { storyPrompt } from '../src/lib/builder-nudges';
import { HOUSE_PLOTS } from '../src/lib/events';
import {
  CREATOR_PLACEHOLDER,
  FIELD_GUIDE,
  blankHouseFileUrl,
  houseFile,
  isOpenPlot,
  newHouseFileUrl,
  readUsername,
  starterHouse,
  starterNames,
} from '../src/lib/github-new-file';
import { BUILDER_DEFAULT_STORY } from '../src/lib/lanterns';
import { places } from '../src/lib/places';
import { placeSchema, validatePlaces, type Place } from '../src/lib/schema';
import { PLOTS } from '../src/lib/world';

const REPOSITORY = 'https://github.com/neighbor/forktown';
const house = (id: string, name: string, plot: string, resident: string): Place => {
  const place = placeSchema.parse({
    id,
    name,
    creator: 'someone',
    plot,
    building: 'cottage',
    color: '#789B76',
    decoration: 'flowers',
    story: 'A made-up house, so no real one can change these tests.',
  });
  return { ...place, resident: { ...place.resident, name: resident } };
};
// A small made-up town: two houses and two neighbors whose names the pools also offer.
const town = [
  house('amber-cottage', 'Amber Cottage', 'A1', 'Ada'),
  house('birch-lodge', 'Birch Lodge', 'A2', 'Arlo'),
];
const OPEN = 'A4';
const example = JSON.parse(readFileSync('examples/my-little-place.json', 'utf8'));

/** What GitHub reads out of the link: the folder, the file name and the text. */
function readLink(url: string) {
  const link = new URL(url);
  return {
    folder: `${link.origin}${link.pathname}`,
    filename: link.searchParams.get('filename'),
    value: link.searchParams.get('value'),
    raw: decodeURIComponent(url.slice(url.indexOf('&value=') + '&value='.length)),
  };
}

describe('Starting a house on GitHub', () => {
  it('opens a new file in places/, named after its id and filled with the whole house', () => {
    const start = starterHouse(OPEN, town, 'new-neighbor')!;
    const link = readLink(newHouseFileUrl(REPOSITORY, start));
    expect(link.folder).toBe(`${REPOSITORY}/new/main/places`);
    expect(blankHouseFileUrl(REPOSITORY)).toBe(`${REPOSITORY}/new/main/places`);
    expect(link.filename).toBe(`${start.id}.json`);
    expect(link.value).toBe(houseFile(start));
    expect(JSON.parse(link.value!)).toEqual(start);
  });

  it("keeps the colors' # and the file's newlines inside the link", () => {
    const start = starterHouse(OPEN, town, 'new-neighbor')!;
    const url = newHouseFileUrl(REPOSITORY, start);
    // A bare # would end the address there; a bare newline or space would break it.
    expect(url).not.toMatch(/[#\s]/);
    const { value, raw } = readLink(url);
    expect(raw).toBe(houseFile(start));
    expect(value).toContain('"color": "#789B76"');
    expect(value).toContain('"wall": "#F0E5C8"');
    expect(value!.split('\n').length).toBeGreaterThan(20);
  });

  it('is written like the examples, with every field in view', () => {
    const start = starterHouse(OPEN, town, 'new-neighbor')!;
    const file = houseFile(start);
    expect(file.endsWith('}\n')).toBe(true);
    expect(file).not.toContain('\r');
    expect(file.split('\n')[1]).toBe(`  "id": "${start.id}",`);
    expect(Object.keys(start)).toEqual([...Object.keys(example), 'design', 'resident', 'sign']);
    // The example's house and story: the Fork tells no tale for it until the newcomer writes
    // their own.
    for (const key of ['building', 'color', 'decoration', 'story'] as const)
      expect(start[key]).toBe(example[key]);
    expect(start.story).toBe(BUILDER_DEFAULT_STORY);
    expect(start.design.floors).toBe(1);
    expect(Object.keys(start.resident.routine)).toEqual([
      'morning',
      'afternoon',
      'evening',
      'night',
    ]);
  });

  it('builds on the plot the visitor selected', () => {
    for (const plot of ['A4', 'B7', 'T2']) {
      expect(isOpenPlot(plot, town)).toBe(true);
      expect(starterHouse(plot, town)!.plot).toBe(plot);
    }
  });

  it('never offers a venue, a taken plot or one that does not exist', () => {
    const houses = new Set(HOUSE_PLOTS.map((plot) => plot.id));
    const reserved = PLOTS.filter((plot) => !houses.has(plot.id));
    expect(reserved.length).toBeGreaterThan(40);
    for (const plot of reserved) expect(starterHouse(plot.id, [], 'someone'), plot.id).toBeNull();
    for (const plot of ['A1', 'A2', 'Z99', '', 'a4'])
      expect(starterHouse(plot, town, 'someone'), plot).toBeNull();
  });

  it('gives the house an id no house in town has, and names the file after it', () => {
    const names = { placeName: 'Amber Cottage', residentName: 'Ada' };
    const start = starterHouse(OPEN, town, 'someone', names)!;
    expect(start.id).toBe('amber-cottage-2');
    expect(start.name).toBe('Amber Cottage');
    expect(readLink(newHouseFileUrl(REPOSITORY, start)).filename).toBe('amber-cottage-2.json');
    const busier = [...town, house('amber-cottage-2', 'Amber Two', 'A3', 'Bea')];
    expect(starterHouse(OPEN, busier, '', names)!.id).toBe('amber-cottage-3');
  });

  it('suggests the same names for a plot every time, and none that someone in town has', () => {
    expect(starterNames(OPEN, town)).toEqual(starterNames(OPEN, town));
    for (const { id } of HOUSE_PLOTS) {
      const { placeName, residentName } = starterNames(id, town);
      expect(['Amber Cottage', 'Birch Lodge']).not.toContain(placeName);
      expect(['Ada', 'Arlo']).not.toContain(residentName);
    }
    const suggested = new Set(HOUSE_PLOTS.map(({ id }) => starterNames(id, []).placeName));
    expect(suggested.size).toBeGreaterThan(20);
  });

  it('turns every name in the pools into a valid house', () => {
    pools.houses.forEach((placeName, index) => {
      const residentName = pools.neighbors[index % pools.neighbors.length];
      const start = starterHouse(OPEN, [], 'someone', { placeName, residentName })!;
      expect(validatePlaces([{ file: `${start.id}.json`, data: start }]).errors, placeName).toEqual(
        [],
      );
    });
  });

  it('credits the username the visitor types', () => {
    expect(starterHouse(OPEN, town, 'octo-cat')!.creator).toBe('octo-cat');
    expect(starterHouse(OPEN, town, '  @Octo-Cat ')!.creator).toBe('Octo-Cat');
    expect(readUsername(' @Octo-Cat ')).toEqual({ username: 'Octo-Cat' });
  });

  it('keeps the examples placeholder until a username is typed', () => {
    expect(CREATOR_PLACEHOLDER).toBe(example.creator);
    expect(readUsername('')).toEqual({ username: '' });
    expect(starterHouse(OPEN, town)!.creator).toBe(CREATOR_PLACEHOLDER);
    expect(starterHouse(OPEN, town, '   ')!.creator).toBe(CREATOR_PLACEHOLDER);
  });

  it.each([
    '-bad',
    'bad-',
    'double--dash',
    'has space',
    '<script>',
    'name!',
    'dot.name',
    'under_score',
    'émile',
    'a'.repeat(40),
    '@@name',
  ])('rejects %s, which GitHub never gives out', (name) => {
    expect(readUsername(name).problem).toBeTruthy();
    expect(starterHouse(OPEN, town, name)).toBeNull();
    // The build's own check would refuse it as a creator too.
    expect(placeSchema.shape.creator.safeParse(readUsername(name).username).success).toBe(false);
  });

  it.each(['forktown', 'ForkTown'])('keeps the starter credit %s for starter places', (name) => {
    expect(readUsername(name).problem).toContain('reserved');
    expect(starterHouse(OPEN, town, name)).toBeNull();
  });

  it.each(['a', 'A-New-Neighbor9', 'x'.repeat(39), '0day'])('accepts %s', (name) => {
    expect(readUsername(name).problem).toBeUndefined();
    const start = starterHouse(OPEN, town, name)!;
    expect(start.creator).toBe(name);
    expect(placeSchema.safeParse(start).success).toBe(true);
  });

  it('passes the build validation against the current town, on every open plot', () => {
    const open = HOUSE_PLOTS.filter(({ id }) => isOpenPlot(id, places)).map(({ id }) => id);
    // A full town has no open plot, so there the test frees one.
    for (const plot of open.length ? open : [HOUSE_PLOTS[0].id]) {
      const current = places.filter((place) => place.plot !== plot);
      for (const username of ['new-neighbor', '']) {
        const start = starterHouse(plot, current, username)!;
        const link = readLink(newHouseFileUrl(REPOSITORY, start));
        expect(current.map((place) => place.id)).not.toContain(start.id);
        const files = [
          ...current.map((place) => ({ file: `${place.id}.json`, data: place })),
          { file: link.filename!, data: JSON.parse(link.value!) },
        ];
        expect(validatePlaces(files).errors, plot).toEqual([]);
      }
    }
  });

  it('links to the part of CONTRIBUTING.md that explains every field', () => {
    const [file, anchor] = FIELD_GUIDE.split('#');
    const headings = readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => /^#{1,6} /.test(line))
      .map((line) =>
        line
          .replace(/^#+ /, '')
          .toLowerCase()
          .replace(/[^\p{L}\p{N} -]/gu, '')
          .replace(/ /g, '-'),
      );
    expect(headings).toContain(anchor);
  });
});

describe('The open-plot panel on the published town', () => {
  const render = (plot: string, typed = '') =>
    renderToStaticMarkup(
      createElement(StartOnGitHub, {
        plot,
        places: town,
        repositoryUrl: REPOSITORY,
        typed,
        onTyped: () => {},
      }),
    );

  it('offers the filled-in file, a copy of it and a blank file to paste into', () => {
    const markup = render(OPEN);
    const start = starterHouse(OPEN, town)!;
    expect(markup).toContain('Create my house file on GitHub');
    expect(markup).toContain(`href="${newHouseFileUrl(REPOSITORY, start).replace(/&/g, '&amp;')}"`);
    expect(markup).toContain(`href="${REPOSITORY}/new/main/places"`);
    expect(markup).toContain(`href="${REPOSITORY}/blob/HEAD/${FIELD_GUIDE}"`);
    expect(markup.match(/target="_blank" rel="noreferrer"/g)).toHaveLength(3);
    expect(markup).toContain('Copy JSON');
    expect(markup).toContain(`places/${start.id}.json`);
    expect(markup).toContain(start.name);
    expect(markup).toContain(start.resident.name);
  });

  it('asks for a username while the file still has the placeholder', () => {
    const markup = render(OPEN);
    expect(markup).toContain('Your GitHub username');
    expect(markup).toContain('Fill this in');
    expect(markup).toContain(CREATOR_PLACEHOLDER);
  });

  it('links a typed username into the file it credits', () => {
    const markup = render(OPEN, '@Octo-Cat');
    const start = starterHouse(OPEN, town, 'Octo-Cat')!;
    expect(markup).toContain(`href="${newHouseFileUrl(REPOSITORY, start).replace(/&/g, '&amp;')}"`);
    expect(markup).not.toContain('Fill this in');
  });

  it('walks through the steps on GitHub', () => {
    const markup = render(OPEN);
    for (const step of ['fork', 'Commit changes', 'Propose changes', 'Create pull request'])
      expect(markup).toContain(step);
  });

  it('asks for a story of their own, since the Fork never tells the one filled in', () => {
    const markup = render(OPEN);
    const start = starterHouse(OPEN, town)!;
    expect(markup).toContain('Replace the placeholder <code>story</code> with your own');
    expect(markup).toContain('Tonight’s tale');
    expect(markup).toContain(`Try answering “${storyPrompt(start.id)}”`);
  });

  it('shows nothing for a plot that is taken or reserved', () => {
    expect(render('A1')).toBe('');
    expect(render('D3')).toBe('');
  });

  it('is what the published town shows for an open plot, never the builder', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('!localSaveAvailable && repositoryUrl && available.some(');
    expect(app).toContain('`Plot ${selectedPlot} is open`');
    // The town keeps the typed username, so comparing plots never asks for it again.
    expect(app).toContain('typed={githubUsername}');
    // After every venue's panel, before the empty-plot card that offers "Build here".
    expect(app.indexOf('<StartOnGitHub')).toBeGreaterThan(app.indexOf('<TubeInfo'));
    expect(app.indexOf('<StartOnGitHub')).toBeLessThan(app.indexOf("'Build here'"));
  });
});

describe('The Find your way in guide', () => {
  it('offers the browser only where an open plot can start a house on GitHub', () => {
    expect(guideSteps(false)).toBe(GUIDE_COPY.steps);
    for (const [, detail] of GUIDE_COPY.steps) expect(detail).not.toMatch(/browser/i);
    const [first, ...rest] = guideSteps(true);
    expect(first).toEqual([GUIDE_COPY.steps[0][0], GUIDE_COPY.forkInBrowser]);
    expect(first[1]).toContain('Start right in your browser from an open plot');
    expect(rest).toEqual(GUIDE_COPY.steps.slice(1));
    // The same condition as the guide's Pick an open plot button: published, with a
    // repository to link to and a plot free. Localhost keeps the builder's steps.
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain(
      'const startInBrowser = !localSaveAvailable && !!repositoryUrl && !townFull;',
    );
    expect(app).toContain('guideSteps(startInBrowser).map(');
    expect(app).toContain('{startInBrowser && (');
  });
});
