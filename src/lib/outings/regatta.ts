// Paper-boat Regatta guests (agent C, SPEC §4.5): they stand on the Landing's river edge facing
// `se`, set their boat down on arrival, and `cheer` for 1.5 min from the moment their own boat
// comes to rest (regattaBoat in district-calendar.ts). Existing poses only.
// Import rule (SPEC §7.3): value-import only world, town-calendar, seasons, district-places and
// district-calendar; never resident-trips, events or anything under src/city/.
import type { OutingPose } from '../outings.ts';

/** A regatta guest's pose. Foundation stub: none, so they stand at their spot. */
export const regattaPose: OutingPose = () => undefined;
