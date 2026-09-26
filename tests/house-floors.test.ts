import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validatePlaces } from '../src/lib/schema';

const read = (id: string) => JSON.parse(readFileSync(`places/${id}.json`, 'utf8'));
const withFloors = (data: ReturnType<typeof read>, floors: number) => ({
  ...data,
  design: { ...data.design, floors },
});

describe('House floors', () => {
  it('keeps the third floor on homes that were built with it', () => {
    const arts = read('arts');
    expect(arts.design.floors).toBe(3);
    expect(validatePlaces([{ file: 'arts.json', data: arts }]).errors).toEqual([]);
  });

  it('gives new homes one or two floors', () => {
    const home = read('moss-nook');
    for (const floors of [1, 2])
      expect(
        validatePlaces([{ file: 'moss-nook.json', data: withFloors(home, floors) }]).errors,
      ).toEqual([]);
    expect(validatePlaces([{ file: 'moss-nook.json', data: withFloors(home, 3) }]).errors).toEqual([
      'moss-nook.json: New homes can have one or two floors. Set "floors" to 1 or 2.',
    ]);
  });
});
