// Snowmen on the Lunch Green (agent E, SPEC §4.6): on a build day (variant `snowmen`) lunch seats 0
// and 1 alternate `crouch` and `play` (each held at least a minute) from 14:00 to 15:45; seats 2–5
// only `sit`, `chat` or `cheer`. The planner's attendingPose calls these on that variant only.
// Import rule (SPEC §7.3): value-import only world, town-calendar, seasons, district-places and
// district-calendar; never resident-trips, events or anything under src/city/.
import type { EventPose } from '../events.ts';

/** A builder's pose (lunch seats 0 and 1). Foundation stub: undefined keeps today's lunch pose. */
export function snowmenBuilderPose(
  _seat: number,
  _time: number,
  _day: number,
): EventPose | undefined {
  return undefined;
}

/** A watcher's pose (lunch seats 2–5). Foundation stub: undefined keeps today's lunch pose. */
export function snowmenWatcherPose(
  _seat: number,
  _time: number,
  _day: number,
): EventPose | undefined {
  return undefined;
}
