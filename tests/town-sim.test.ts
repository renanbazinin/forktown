import { describe, expect, it } from 'vitest';
import { HOUSE_PLOTS } from '../src/lib/events';
import { roadNodes, roadPath } from '../src/lib/walking';
import { PLOTS, plotEntrance, ROAD_MAX_X, ROAD_MAX_Y, type Point } from '../src/lib/world';

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
});
