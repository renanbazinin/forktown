import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DUCK_WALK_END, DUCK_WALK_START } from '../src/lib/ducks';
import { HOUSE_PLOTS } from '../src/lib/events';
import { placeSchema, type Place } from '../src/lib/schema';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { roadNodes, roadPath, WALK_SPEED } from '../src/lib/walking';
import { getPlot, PLOTS, plotEntrance, ROAD_MAX_X, ROAD_MAX_Y, type Point } from '../src/lib/world';

const places = readdirSync('places')
  .filter((name) => name.endsWith('.json'))
  .map((name) => placeSchema.parse(JSON.parse(readFileSync(`places/${name}`, 'utf8'))));
const ROUTINES = ['stroll', 'work', 'home'] as const;
/** Every house plot taken: the published homes, and neighbors modelled on them on the rest. */
const fullTown: Place[] = [
  ...places,
  ...HOUSE_PLOTS.filter((plot) => !places.some((place) => place.plot === plot.id)).map(
    (plot, index) => {
      const model = places[index % places.length];
      return placeSchema.parse({
        ...model,
        id: `full-town-${plot.id.toLowerCase()}`,
        plot: plot.id,
        resident: {
          ...model.resident,
          routine: {
            morning: ROUTINES[index % 3],
            afternoon: ROUTINES[Math.floor(index / 3) % 3],
            evening: ROUTINES[Math.floor(index / 9) % 3],
            night: index % 2 ? 'stroll' : 'sleep',
          },
        },
      });
    },
  ),
];
const DAYS = [CALENDAR_EPOCH_DAY + 90, CALENDAR_EPOCH_DAY + 91];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/** Out on a daytime stroll of their own: no event, no night walk. */
const strolling = (state: ResidentState) =>
  state.activity === 'stroll' && !state.event && !state.nightWalk && !state.nightPorch;

/** Every daytime minute of a town day, and a tenth of a minute later, for pace. */
const samples = new Map<
  string,
  { minute: number; now: ResidentState[]; next: ResidentState[] }[]
>();
function daytime(homes: Place[], day: number) {
  const key = `${homes === fullTown ? 'full' : 'real'}:${day}`;
  let list = samples.get(key);
  if (!list) {
    list = [];
    for (let minute = 360; minute < 1320; minute++)
      list.push({
        minute,
        now: simulateResidents(homes, minute, day),
        next: simulateResidents(homes, minute + 0.1, day),
      });
    samples.set(key, list);
  }
  return list;
}

/** A small seeded generator: the same samples on every run. */
function sequence(seed: number) {
  return () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32;
}

/** The first road search, keyed by strings: roadPath must find exactly its routes. */
const key = (point: Point) => `${point.x},${point.y}`;
const graph = new Map(roadNodes.map((point) => [key(point), point]));
function referenceRoadPath(from: Point, to: Point): Point[] {
  const queue = [from],
    previous = new Map<string, Point | null>([[key(from), null]]);
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (key(current) === key(to)) break;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = graph.get(key({ x: current.x + dx, y: current.y + dy }));
      if (next && !previous.has(key(next))) {
        previous.set(key(next), current);
        queue.push(next);
      }
    }
  }
  if (!previous.has(key(to))) return [from];
  const path: Point[] = [];
  for (let current: Point | null = to; current; current = previous.get(key(current)) ?? null)
    path.unshift(current);
  return path;
}

describe('The town simulation at any size', () => {
  // Routes are part of the shared town: a faster search must not move anyone.
  it('finds exactly the routes of the original road search', () => {
    const random = sequence(7);
    const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];
    // Doorsteps, plot centres off the road, points beyond the edges and between tiles.
    const odd: Point[] = [
      ...HOUSE_PLOTS.map(plotEntrance),
      ...PLOTS.map((plot) => ({ x: plot.x + 0.5, y: plot.y + 0.5 })),
      { x: -0.5, y: 1.5 },
      { x: 0.5, y: 0.5 },
      { x: ROAD_MAX_X + 1.5, y: 1.5 },
      { x: ROAD_MAX_X + 0.5, y: ROAD_MAX_Y + 0.5 },
      { x: 3.2, y: 5.5 },
      { x: 1.4999999999999998, y: 1.5 },
    ];
    const pairs = [
      ...Array.from({ length: 500 }, () => [pick(roadNodes), pick(roadNodes)]),
      ...Array.from({ length: 300 }, () => [pick(odd), pick(roadNodes)]),
      ...Array.from({ length: 100 }, () => [pick(roadNodes), pick(odd)]),
      ...Array.from({ length: 100 }, () => [pick(odd), pick(odd)]),
      [roadNodes[0], roadNodes[0]],
    ];
    for (const [from, to] of pairs) expect(roadPath(from, to)).toEqual(referenceRoadPath(from, to));
  }, 20_000);

  it('strolls at walking pace in every free window, however short', () => {
    for (const homes of [places, fullTown])
      for (const day of DAYS) {
        let fastest = 0,
          fastestWithDucks = 0,
          walked = 0;
        for (const { minute, now, next } of daytime(homes, day))
          now.forEach((state, index) => {
            const later = next[index];
            expect(later.id).toBe(state.id);
            if (!strolling(state) || !strolling(later)) return;
            const pace = distance(state.position, later.position) / 0.1;
            if (pace > 0) walked++;
            // Catching up after stopping for the ducklings is the one brisker walk (4/3 pace).
            if (minute >= DUCK_WALK_START && minute < DUCK_WALK_END + 16)
              fastestWithDucks = Math.max(fastestWithDucks, pace);
            else fastest = Math.max(fastest, pace);
          });
        expect(walked).toBeGreaterThan(100);
        expect(fastest).toBeLessThanOrEqual(WALK_SPEED + 1e-9);
        expect(fastestWithDucks).toBeLessThanOrEqual((WALK_SPEED * 4) / 3 + 1e-9);
      }
  }, 20_000);

  it('rests on the doorstep in each neighbor’s own rhythm, never all at once', () => {
    for (const day of DAYS) {
      let still = 0,
        out = 0;
      for (const { minute, now } of daytime(fullTown, day)) {
        const walkers = now.filter((state) => strolling(state) && !state.duckLove);
        // A town full of strollers never stands still together.
        if (walkers.length >= 10) expect(walkers.some((state) => state.moving)).toBe(true);
        // Nor in the last twenty minutes before 12:00, 18:00 and 22:00.
        if ([720, 1080, 1320].some((end) => minute >= end - 20)) {
          still += walkers.filter((state) => !state.moving).length;
          out += walkers.length;
        }
      }
      expect(out).toBeGreaterThan(0);
      expect(still / out).toBeLessThan(0.5);
      // Every stroll is back on the doorstep by the end of its period.
      for (const end of [720, 1080, 1320])
        for (const state of simulateResidents(fullTown, end - 0.001, day))
          if (strolling(state))
            expect(
              distance(state.position, plotEntrance(getPlot(state.home.plot)!)),
            ).toBeLessThanOrEqual(0.001);
    }
  }, 20_000);
});
