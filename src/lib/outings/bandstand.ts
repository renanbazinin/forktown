// Bandstand guests (agent C, SPEC §4.2): the teatime set takes `tea` and `perch`, the sundown set
// `perch` and `sip`, with `cheer` only in each set's last 5 minutes. Poses are held at least a
// minute. Existing poses only.
// Import rule (SPEC §7.3): value-import only world, town-calendar, seasons, district-places and
// district-calendar; never resident-trips, events or anything under src/city/.
import type { OutingPose } from '../outings.ts';

/** A teatime listener's pose. Foundation stub: sat in their deckchair. */
export const teaPose: OutingPose = () => 'sit';

/** A sundown listener's pose. Foundation stub: sat in their deckchair. */
export const sundownPose: OutingPose = () => 'sit';
