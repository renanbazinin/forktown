// Morning Market browsers (agent B, SPEC §4.1): what a guest does at their stall. They stand
// facing it, glance to the next stall every 6–10 min (`market-look:${id}:${k}`, written here, not
// zooGlance) and chat one beat in three. Existing poses only.
// Import rule (SPEC §7.3): value-import only world, town-calendar, seasons, district-places and
// district-calendar; never resident-trips, events or anything under src/city/.
import type { OutingFacing, OutingPose } from '../outings.ts';

/** A browser's pose. Foundation stub: none, so they stand at their spot. */
export const marketPose: OutingPose = () => undefined;

/** Where a browser looks. Foundation stub: undefined, so they face their spot's own way. */
export const marketFacing: OutingFacing = () => undefined;
