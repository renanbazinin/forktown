// Paper-boat Regatta guests (agent C, SPEC §4.5): they stand on the Landing's river edge facing
// `se`, set their boat down on arrival, and `cheer` for 1.5 min from the moment their own boat
// comes to rest (regattaBoat in district-calendar.ts). Existing poses only.
// Import rule (SPEC §7.3): value-import only world, town-calendar, seasons, district-places and
// district-calendar; never resident-trips, events or anything under src/city/.
import { regattaBoat } from '../district-calendar.ts';
import type { OutingPose } from '../outings.ts';

/** Minutes of the cheer when a guest's own boat comes to rest at the boom (SPEC §4.5). */
export const REGATTA_CHEER = 1.5;
/** A pose is held a minute at least (the planner's POSE_HOLD). */
const HOLD = 1;

/** When this guest's cheer runs, or undefined when there is none to give (no boat, or they
 *  have gone before it could last a minute). */
export function regattaCheer(seat: number, day: number, arrive: number, leave: number) {
  const boat = regattaBoat(seat, day, 840);
  if (!boat) return undefined;
  const from = Math.max(boat.restAt, arrive);
  const to = Math.min(boat.restAt + REGATTA_CHEER, leave);
  return to - from >= HOLD ? { from, to } : undefined;
}

/**
 * A regatta guest stands at the water and watches; for a minute and a half from the moment their
 * own boat comes to rest against the boom (or the boat ahead), they cheer.
 */
export const regattaPose: OutingPose = ({ seat, day, time, arrive, leave }) => {
  const cheer = regattaCheer(seat, day, arrive, leave);
  return cheer && time >= cheer.from && time < cheer.to ? 'cheer' : undefined;
};
