import { ZOO_PLOTS } from '../src/lib/zoo';
import { FARM_PLOTS } from '../src/lib/farm';
import { MILLPOND_PLOTS } from '../src/lib/millpond';
import { describe, expect, it } from 'vitest';
import { draftSchema, placeSchema, validatePlaces, type Place } from '../src/lib/schema';
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
    expect(errors.join('\n')).toContain('existing plot from the town map');
  });
  it('rejects duplicate plot claims without silently replacing another place', () => {
    const { errors } = validatePlaces([
      { file: 'tiny-library.json', data: sample },
      { file: 'my-cafe.json', data: { ...sample, id: 'my-cafe', name: 'My Café' } },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Plot A1 belongs to "Tiny Library"');
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

describe('The world stays predictable as people contribute', () => {
  it('preserves building colors through the second shading pass at night', () => {
    expect(shade(shade('#C97878', -30), 14)).toBe('#b96868');
    expect(shade('#FFFFFF', 30)).toBe('#ffffff');
    expect(shade('#000000', -30)).toBe('#000000');
  });
  it('has 200 unique plots with public venues, football ground, cinema, zoo, farm, and millpond reserved', () => {
    expect(new Set(PLOTS.map((plot) => plot.id)).size).toBe(200);
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
