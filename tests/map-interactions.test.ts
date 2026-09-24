import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cityHit } from '../src/city/render';
import { placeSchema } from '../src/lib/schema';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { getPlot, plotCenter, project } from '../src/lib/world';
import { ZOO_SIGN, ZOO_SIGN_DEPTH } from '../src/city/zoo';
import { FORK_PLOT } from '../src/lib/lanterns';

const places = readdirSync('places')
  .filter((file) => file.endsWith('.json'))
  .map((file) => placeSchema.parse(JSON.parse(readFileSync(`places/${file}`, 'utf8'))));

describe('Map selection follows visible depth', () => {
  it.each(['S5', 'S6', 'S7', 'S8', 'S9', 'P10', 'Q10', 'R10'])(
    'selects the visible roof on %s instead of the zoo ground behind it',
    (plot) => {
      const home = { ...places[0], plot, design: { ...places[0].design, floors: 3 as const } };
      const center = plotCenter(getPlot(plot)!);
      expect(cityHit({ x: center.x, y: center.y - 100 }, [home], [])).toEqual({
        kind: 'place',
        id: plot,
      });
    },
  );
  it('keeps the raised zoo sign selectable in front of a resident', () => {
    const sign = project(ZOO_SIGN.point.x, ZOO_SIGN.point.y);
    const resident = {
      ...simulateResidents(places, 402)[0],
      activity: 'stroll' as const,
      position: ZOO_SIGN.point,
    };
    expect(resident.position.x + resident.position.y).toBeLessThan(ZOO_SIGN_DEPTH);
    expect(cityHit({ x: sign.x, y: sign.y - 24 }, [], [resident])).toEqual({
      kind: 'place',
      id: 'O6',
    });
  });
  it('selects the studio wall covering Milo at 06:42 instead of the resident behind it', () => {
    // Captured overlap from the original 5-by-5 town; keep it independent of route changes.
    const residents = simulateResidents(places, 402).map((resident) =>
      resident.id === 'moonbeam-cafe'
        ? { ...resident, position: { x: 13.5, y: 10.266666666666666 } }
        : resident,
    );
    const milo = residents.find((resident) => resident.id === 'moonbeam-cafe')!;
    const point = project(milo.position.x, milo.position.y);
    expect(milo.activity).toBe('stroll');
    expect(cityHit(point, places, residents)).toEqual({ kind: 'place', id: 'C4' });
  });

  it('keeps a resident in front of a building selectable', () => {
    const home = places.find((place) => place.id === 'after-hours')!;
    const plot = getPlot(home.plot)!;
    const resident = {
      ...simulateResidents([home], 402)[0],
      activity: 'stroll',
      position: { x: plot.x + 0.5, y: plot.y + 0.5 },
    } satisfies ResidentState;
    const point = plotCenter(plot);
    expect(cityHit(point, [home], [resident])).toEqual({ kind: 'resident', id: home.id });
  });

  it('selects the frontmost of overlapping residents regardless of input order', () => {
    const seed = simulateResidents(places, 402)[0];
    const back = {
      ...seed,
      id: 'back',
      activity: 'stroll',
      position: { x: 5, y: 5 },
    } satisfies ResidentState;
    const front = { ...back, id: 'front', position: { x: 5.1, y: 5.1 } };
    const point = { x: 0, y: 180 };
    for (const residents of [
      [back, front],
      [front, back],
    ])
      expect(cityHit(point, [], residents)).toEqual({ kind: 'resident', id: 'front' });
    expect(cityHit(point, [], [back, { ...back, id: 'last' }])).toEqual({
      kind: 'resident',
      id: 'last',
    });
  });

  it("selects the Lantern Fork without stealing its neighbours' fronts", () => {
    const fork = plotCenter(getPlot(FORK_PLOT)!);
    for (const [dx, dy] of [
      [0, -100],
      [-40, 30],
    ])
      expect(cityHit({ x: fork.x + dx, y: fork.y + dy }, places, [])).toEqual({
        kind: 'place',
        id: FORK_PLOT,
      });
    for (const plot of ['C2', 'C3', 'D2']) {
      const front = plotCenter(getPlot(plot)!);
      expect(cityHit({ x: front.x, y: front.y - 30 }, places, [])).toEqual({
        kind: 'place',
        id: plot,
      });
    }
  });

  it.each(['work', 'home', 'sleep'] as const)('ignores residents indoors during %s', (activity) => {
    const resident = { ...simulateResidents(places, 402)[0], activity };
    expect(
      cityHit(project(resident.position.x, resident.position.y), [], [resident]),
    ).toBeUndefined();
  });
});
