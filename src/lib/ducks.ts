import { getPlot, WORLD_WIDTH, type Point } from './world';

export const DUCK_WALK_START = 8 * 60;
export const DUCK_WALK_END = 12 * 60 + 30;
export const DUCK_COUNT = 6;
// The street in front of the Lunch Green runs from the first homes to the river.
export const DUCK_STREET_Y = getPlot('C5')!.y + 2.5;
export const DUCK_RIVER_X = WORLD_WIDTH - 1.5;
export const DUCK_TURN_X = 1.8;
const TURN_RADIUS = 0.2;
const FOLLOW_DELAY = 2;
const LEG_LENGTH = DUCK_RIVER_X - DUCK_TURN_X;
const TURN_LENGTH = Math.PI * TURN_RADIUS;
const ROUTE_LENGTH = LEG_LENGTH * 2 + TURN_LENGTH;
const LEADER_DURATION = DUCK_WALK_END - DUCK_WALK_START - (DUCK_COUNT - 1) * FOLLOW_DELAY;

export type TownDuck = {
  id: number;
  position: Point;
  adult: boolean;
  left: boolean;
  stride: number;
  swimming: boolean;
  opacity: number;
};

function routeAt(distance: number): { position: Point; direction: Point } {
  if (distance < LEG_LENGTH)
    return {
      position: { x: DUCK_RIVER_X - distance, y: DUCK_STREET_Y - TURN_RADIUS },
      direction: { x: -1, y: 0 },
    };
  if (distance < LEG_LENGTH + TURN_LENGTH) {
    // A small U-turn stays inside the street; returning ducks use the other side.
    const angle = (distance - LEG_LENGTH) / TURN_RADIUS;
    return {
      position: {
        x: DUCK_TURN_X - Math.sin(angle) * TURN_RADIUS,
        y: DUCK_STREET_Y - Math.cos(angle) * TURN_RADIUS,
      },
      direction: { x: -Math.cos(angle), y: Math.sin(angle) },
    };
  }
  return {
    position: {
      x: DUCK_TURN_X + distance - LEG_LENGTH - TURN_LENGTH,
      y: DUCK_STREET_Y + TURN_RADIUS,
    },
    direction: { x: 1, y: 0 },
  };
}

/** Shared-clock animation: joining midway or pausing needs no accumulated state. */
export function ducksAt(minutes: number): TownDuck[] {
  const time = ((minutes % 1440) + 1440) % 1440;
  if (time < DUCK_WALK_START || time >= DUCK_WALK_END) return [];
  return Array.from({ length: DUCK_COUNT }, (_, id) => {
    const elapsed = time - DUCK_WALK_START - id * FOLLOW_DELAY;
    if (elapsed < 0 || elapsed >= LEADER_DURATION) return undefined;
    // The last duckling pauses to look around, then catches up without teleporting.
    const distraction = elapsed - 95;
    const lag =
      id === DUCK_COUNT - 1
        ? distraction >= 0 && distraction < 2
          ? distraction
          : distraction >= 2 && distraction < 8
            ? 2 * (1 - (distraction - 2) / 6)
            : 0
        : 0;
    const distance = ((elapsed - lag) / LEADER_DURATION) * ROUTE_LENGTH;
    const { position, direction } = routeAt(distance);
    return {
      id,
      position,
      adult: id === 0,
      left: direction.x - direction.y < 0,
      stride: Math.sin(distance * Math.PI * 5),
      swimming: position.x >= WORLD_WIDTH - 2,
      // Emerge and disappear in the water, never pop into existence on the street.
      opacity: Math.min(1, elapsed / 1.2, (LEADER_DURATION - elapsed) / 1.2),
    };
  }).filter((duck): duck is TownDuck => duck !== undefined);
}
