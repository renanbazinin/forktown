// Stargazers (agent E, SPEC §4.4): they `sit` on rugs facing `ne`, and `chat` now and then. No
// lying pose. Existing poses only.
// Import rule (SPEC §7.3): value-import only world, town-calendar, seasons, district-places and
// district-calendar; never resident-trips, events or anything under src/city/.
import type { OutingPose } from '../outings.ts';

/** A stargazer's pose. Foundation stub: sat on their rug. */
export const starPose: OutingPose = () => 'sit';
