// Honest exemptions for tube riders in the walking tests: a traveller leaves the road only while
// on the tube (the glass, or the short walk between a station door and its stack), and then only
// along the line; nobody in the tube goes faster than the tube.
import type { ResidentState } from '../src/lib/simulation';
import { TUBE_SPEED, TUBE_STATIONS, tubeInStack, tubeRoute } from '../src/lib/tubes';
import { isRoad, type Point } from '../src/lib/world';

type Traveller = Pick<ResidentState, 'position' | 'transit'>;
/** Every ground stretch of the line: each station's door → stack walk, and the glass's ground
 *  trace between every pair of stations (a ride and its way back share one trace). */
const LINE: [Point, Point][] = [
  ...TUBE_STATIONS.map((s): [Point, Point] => [s.door, s.stack]),
  ...TUBE_STATIONS.flatMap((a, i) =>
    TUBE_STATIONS.slice(i + 1).flatMap((b) => {
      const route = tubeRoute(a.id, b.id);
      return route.slice(1).map((p, j): [Point, Point] => [route[j], p]);
    }),
  ),
];
/** On the line's ground trace, ± tolerance. */
export function onTubeLine(point: Point, tolerance = 1e-9): boolean {
  return LINE.some(([a, b]) => {
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const u = Math.max(
      0,
      Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
    );
    return Math.hypot(point.x - a.x - u * dx, point.y - a.y - u * dy) <= tolerance;
  });
}
export const riding = (state: Pick<ResidentState, 'transit'>) => state.transit?.stage === 'riding';
/** On a road tile, or in transit and exactly on the tube's ground trace (door → stack walks included). */
export const onRoadOrTube = (state: Traveller) =>
  isRoad(Math.floor(state.position.x), Math.floor(state.position.y)) ||
  (!!state.transit && onTubeLine(state.position));
/** A step's bound: the test's own walking bound, or the tube's speed while either end rides. */
export const stepBound = (
  a: Pick<ResidentState, 'transit'>,
  b: Pick<ResidentState, 'transit'>,
  minutes: number,
  walkingBound: number,
) => (riding(a) || riding(b) ? TUBE_SPEED * minutes + 1e-9 : walkingBound);
/** On the short walk between a station door and its stack (inside the fixed boarding/stepping-off minutes). */
export const stationWalk = (state: Pick<ResidentState, 'transit'>) =>
  !!state.transit && state.transit.stage !== 'riding' && !tubeInStack(state.transit);
