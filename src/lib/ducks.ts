import { getPlot, WORLD_WIDTH, type Point } from './world';

export const DUCK_WALK_START = 8 * 60;
export const DUCK_WALK_END = 12 * 60 + 30;
export const DUCK_COUNT = 6;
// The street in front of the Lunch Green runs from the first homes to the river.
export const DUCK_STREET_Y = getPlot('C5')!.y + 2.5;
export const DUCK_RIVER_X = WORLD_WIDTH - 1.5;
/** Tiles of street the family walks each way: the whole street of the ten-column town. */
export const DUCK_WALK_LENGTH = 40.7;
/** Where the family turns back: at the first homes today, and after the same walk in a wider
 *  town, so their fixed walk time never turns into a faster pace. */
export const duckTurnX = (worldWidth: number) => Math.max(1.8, worldWidth - 1.5 - DUCK_WALK_LENGTH);
export const DUCK_TURN_X = duckTurnX(WORLD_WIDTH);
const TURN_RADIUS = 0.2;
const FOLLOW_DELAY = 2;
export const DUCK_DAWDLE_START = DUCK_WALK_START + (DUCK_COUNT - 1) * FOLLOW_DELAY + 95;
const DAWDLE_PAUSE = 4;
const CATCH_UP = 6;
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
  antic?: { kind: 'peck' | 'notice' | 'hop' | 'scurry' | 'proud'; progress: number };
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
    // Peck, notice the gap, hop in surprise, then hurry back with a smooth burst of speed.
    const distraction = time - DUCK_DAWDLE_START;
    let lag = 0;
    let antic: TownDuck['antic'];
    if (id === DUCK_COUNT - 1 && distraction >= 0) {
      if (distraction < DAWDLE_PAUSE) {
        lag = distraction;
        antic =
          distraction < 2
            ? { kind: 'peck', progress: distraction / 2 }
            : distraction < 3
              ? { kind: 'notice', progress: distraction - 2 }
              : { kind: 'hop', progress: distraction - 3 };
      } else if (distraction < DAWDLE_PAUSE + CATCH_UP) {
        const progress = (distraction - DAWDLE_PAUSE) / CATCH_UP;
        lag = DAWDLE_PAUSE * (1 - progress * progress * (3 - 2 * progress));
        antic = { kind: 'scurry', progress };
      } else if (distraction < DAWDLE_PAUSE + CATCH_UP + 1.5) {
        antic = { kind: 'proud', progress: (distraction - DAWDLE_PAUSE - CATCH_UP) / 1.5 };
      }
    }
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
      ...(antic ? { antic } : {}),
    };
  }).filter((duck): duck is TownDuck => duck !== undefined);
}
