import { ducksAt, DUCK_STREET_Y, DUCK_WALK_START, DUCK_WALK_END } from './ducks';
import type { ResidentState } from './simulation';
import { facingToward, opposite } from './walking';
import type { Point } from './world';

export const DUCK_NOTICE_RADIUS = 1.4;
export const DUCK_LOVE_SECONDS = 4; // One town minute is one real second.
const RECOVERY_SECONDS = 12;
const COOLDOWN_SECONDS = 30;
type WalkMotion = Pick<ResidentState, 'position' | 'moving' | 'facing' | 'walkPhase' | 'duckLove'>;
// One entry per stroll window. Past the cap (far beyond one per home, even in a much bigger
// town) the least recently used goes first, so a busy morning never rebuilds them all.
const encounters = new Map<string, number[]>();
const ENCOUNTER_CACHE = 2048;

function nearestDuck(position: Point, time: number) {
  return ducksAt(time)
    .filter((duck) => !duck.swimming && duck.opacity > 0.5)
    .sort(
      (a, b) =>
        Math.hypot(a.position.x - position.x, a.position.y - position.y) -
        Math.hypot(b.position.x - position.x, b.position.y - position.y),
    )[0];
}

/** Pause the actual route clock, then gently catch up; never slide beneath a stopped sprite. */
export function duckAwareWalk(
  routeKey: string,
  time: number,
  start: number,
  end: number,
  sample: (routeTime: number, laneTime: number) => WalkMotion,
): WalkMotion {
  if (time < DUCK_WALK_START || time >= DUCK_WALK_END + RECOVERY_SECONDS) return sample(time, time);
  let pauses = encounters.get(routeKey);
  if (pauses) {
    encounters.delete(routeKey);
    encounters.set(routeKey, pauses);
  } else {
    pauses = [];
    // A fixed half-second scan makes encounters independent of frame rate, reloads and visit order.
    // Each pause has finished recovering before another can begin or the routine changes.
    const lastStart = Math.min(
      end - DUCK_LOVE_SECONDS - RECOVERY_SECONDS,
      DUCK_WALK_END - DUCK_LOVE_SECONDS,
    );
    for (let at = Math.max(start, DUCK_WALK_START); at < lastStart; at += 0.5) {
      // Just setting off (off a garden path onto the road), a walker looks where they are going.
      if (at < start + 0.5) continue;
      const motion = sample(at, at);
      if (!motion.moving || Math.abs(motion.position.y - DUCK_STREET_Y) > DUCK_NOTICE_RADIUS)
        continue;
      const duck = nearestDuck(motion.position, at);
      if (
        duck &&
        Math.hypot(duck.position.x - motion.position.x, duck.position.y - motion.position.y) <=
          DUCK_NOTICE_RADIUS &&
        // A walker notices the ducklings ahead or beside them, never by spinning round in a frame.
        !opposite(facingToward(motion.position, duck.position), motion.facing)
      ) {
        pauses.push(at);
        at += COOLDOWN_SECONDS - 0.5;
      }
    }
    // Local house previews can introduce new routes; keep this derived cache bounded.
    if (encounters.size >= ENCOUNTER_CACHE) encounters.delete(encounters.keys().next().value!);
    encounters.set(routeKey, pauses);
  }
  const pause = pauses.find((at) => time >= at && time < at + DUCK_LOVE_SECONDS + RECOVERY_SECONDS);
  if (pause === undefined) return sample(time, time);
  const elapsed = time - pause;
  if (elapsed < DUCK_LOVE_SECONDS) {
    const motion = sample(pause, pause);
    // Turn to the duckling that caught their eye and keep looking that way for the whole stop,
    // rather than snapping round after whichever duck is nearest from frame to frame.
    const duck = nearestDuck(motion.position, pause);
    return {
      ...motion,
      moving: false,
      duckLove: true,
      facing: duck ? facingToward(motion.position, duck.position) : motion.facing,
    };
  }
  const delay = DUCK_LOVE_SECONDS * (1 - (elapsed - DUCK_LOVE_SECONDS) / RECOVERY_SECONDS);
  // Catch up along the route while keeping the lane planned for the current town minute.
  return sample(time - delay, time);
}
