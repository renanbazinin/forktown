// Harvest Fair and Long Table guests (agent D, SPEC §4.3): the fair takes `sip` (cider), `chat`
// and `sit` on the straw seat at their spot; the table takes `sit`, `sip` and `chat`. Existing
// poses only.
// Import rule (SPEC §7.3): value-import only world, town-calendar, seasons, district-places and
// district-calendar; never resident-trips, events or anything under src/city/.
import type { OutingPose } from '../outings.ts';

/** A fair guest's pose. Foundation stub: none, so they stand at their spot. */
export const fairPose: OutingPose = () => undefined;

/** A Long Table guest's pose. Foundation stub: sat at the table. */
export const tablePose: OutingPose = () => 'sit';
