import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cityHit } from '../src/city/render';
import { tubeHit } from '../src/city/tubes';
import { placeSchema } from '../src/lib/schema';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { getPlot, plotCenter, project, unproject } from '../src/lib/world';
import { ZOO_SIGN, ZOO_SIGN_DEPTH } from '../src/city/zoo';
import { FORK_PLOT } from '../src/lib/lanterns';
import { tubeAt, tubeLength, tubeRoute, tubeStation, type ResidentTransit } from '../src/lib/tubes';

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
  it('keeps the zoo gate’s plaque selectable in front of a resident behind it', () => {
    const sign = project(ZOO_SIGN.point.x, ZOO_SIGN.point.y);
    const plaque = { x: sign.x, y: sign.y - ZOO_SIGN.rise + ZOO_SIGN.height / 2 };
    // A walker on the north street, just behind the gate, whose figure the plaque covers.
    const behind = unproject(plaque.x, plaque.y + 14);
    const resident = {
      ...simulateResidents(places, 402)[0],
      activity: 'stroll' as const,
      position: behind,
    };
    expect(behind.y).toBeLessThan(ZOO_SIGN.point.y);
    expect(resident.position.x + resident.position.y).toBeLessThan(ZOO_SIGN_DEPTH);
    expect(cityHit(plaque, [], [{ ...resident, position: ZOO_SIGN.point }])).toEqual({
      kind: 'place',
      id: 'O6',
    });
    expect(cityHit(plaque, [], [resident])).toEqual({ kind: 'place', id: 'O6' });
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

  // The Treeline: a point `h` world px above the ground tile (x, y).
  const lifted = (x: number, y: number, h = 0) => {
    const p = project(x, y);
    return { x: p.x, y: p.y - h };
  };
  const C1 = { kind: 'place', id: 'C1' };

  it('leaves riders in the glass and in the stack to the tube, and keeps people walking to the stack clickable', () => {
    const seed = simulateResidents(places, 402)[0];
    const at = tubeAt('C1', 'N1', 27);
    const ride: ResidentTransit = {
      stage: 'riding',
      from: 'C1',
      to: 'N1',
      progress: 27 / tubeLength('C1', 'N1'),
      altitude: at.altitude,
      distance: 27,
    };
    const rider = {
      ...seed,
      id: 'rider',
      activity: 'stroll',
      position: at.position,
      moving: false,
      transit: ride,
    } satisfies ResidentState;
    for (const h of [0, at.altitude / 2, at.altitude, at.altitude + 10])
      expect(cityHit(lifted(at.position.x, at.position.y, h), [], [rider])?.kind).not.toBe(
        'resident',
      );
    const stack = tubeStation('C1').stack;
    const board: ResidentTransit = {
      stage: 'boarding',
      from: 'C1',
      to: 'N1',
      progress: 0.9,
      altitude: 0,
      distance: 0,
    };
    const inStack = {
      ...rider,
      id: 'in-stack',
      position: stack,
      transit: board,
    } satisfies ResidentState;
    expect(cityHit(lifted(stack.x, stack.y, 20), [], [inStack])).toEqual(C1);
    // Walking in from the door, 0.4 minutes into boarding: an ordinary walker.
    const walking = {
      ...inStack,
      id: 'walking',
      position: { x: 3.5, y: 13.325 },
      moving: true,
      facing: 'ne',
      transit: { ...board, progress: 0.2 },
    } satisfies ResidentState;
    expect(cityHit(lifted(3.5, 13.325, 14), [], [walking])).toEqual({
      kind: 'resident',
      id: 'walking',
    });
  });

  it('selects the line from its stacks, sign and glass, behind houses and walkers in front', () => {
    const { stack } = tubeStation('C1');
    expect(cityHit(lifted(stack.x, stack.y, 30), [], [])).toEqual(C1);
    // The sign's plate, 10 px right of its post and halfway up.
    const sign = lifted(4.4, 12.95);
    expect(cityHit({ x: sign.x + 10, y: sign.y + 5 - 16 }, [], [])).toEqual(C1);
    expect(cityHit(lifted(2.5, 11.5, 39), [], [])).toEqual(C1);
    expect(cityHit(lifted(2.5, 55.5, 39), [], [])).toEqual({ kind: 'place', id: 'N1' });
    // The trunk behind the trees selects the nearer station.
    expect(cityHit(lifted(-0.5, 33, 8), [], [])).toEqual(C1);
    expect(cityHit(lifted(-0.5, 34, 8), [], [])).toEqual({ kind: 'place', id: 'N1' });
    // A tall house on D1 stands in front of the C1 dip: its roof covers the glass band's lower
    // half over column 0.
    const dip = tubeRoute('C1', 'N1')[12];
    const point = lifted(dip.x, dip.y, dip.h - 4);
    expect(cityHit(point, [], [])).toEqual(C1);
    const home = {
      ...places[0],
      plot: 'D1',
      building: 'observatory' as const,
      design: { ...places[0].design, floors: 3 as const, roof: 'classic' as const },
    };
    expect(cityHit(point, [home], [])).toEqual({ kind: 'place', id: 'D1' });
    // A stroller in front of the spur keeps the click; one behind it is seen through the glass.
    const seed = { ...simulateResidents(places, 402)[0], activity: 'stroll' as const };
    const front = { ...seed, id: 'front', position: { x: 1.5, y: 11.95 } };
    expect(cityHit(lifted(1.5, 11.95, 20), [], [front])).toEqual({ kind: 'resident', id: 'front' });
    const back = { ...seed, id: 'back', position: { x: 1.5, y: 11.05 } };
    expect(cityHit(lifted(1.5, 11.05, 24), [], [back])).toEqual(C1);
    expect(cityHit(lifted(1.5, 11.05, 12), [], [back])).toEqual({ kind: 'resident', id: 'back' });
    // The glass is a 6-px band.
    const a = lifted(2.64, 11.5, 39),
      b = lifted(2.21, 11.5, 39);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const off = (d: number) => ({ x: mid.x + normal.x * d, y: mid.y + normal.y * d });
    expect(tubeHit(off(5))?.id).toBe('C1');
    expect(tubeHit(off(7))).toBeUndefined();
    expect(tubeHit(off(-7))).toBeUndefined();
  });
});
