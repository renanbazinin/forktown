// Bandstand guests (agent C, SPEC §4.2): the teatime set takes `tea` and `perch`, the sundown set
// `perch` and `sip`, with `cheer` only in each set's last 5 minutes. Poses are held at least a
// minute. Existing poses only.
// Import rule (SPEC §7.3): value-import only world, town-calendar, seasons, district-places and
// district-calendar; never resident-trips, events or anything under src/city/.
import type { EventPose } from '../events.ts';
import type { OutingPose, PoseContext } from '../outings.ts';
import { hash } from '../world.ts';

/** Minutes a pose is held at least, and a guest takes to get up or sit back down (the planner's
 *  POSE_HOLD and SEAT_SETTLE, restated: this file may not import resident-trips). */
export const HOLD = 1;
export const SETTLE = 0.4;
/** The applause: only in a set's last five minutes. */
export const CHEER_WINDOW = 5;
/** Settled in their deckchair, a guest starts on its calm pose and keeps it this long. */
const CALM = 2;

/**
 * A listener's evening in runs of one pose each, 4 to 8 minutes long by their own hash, from
 * the moment they settle. A run between the perched poses and the low `sip` starts halfway down
 * (`crouch`), so nobody drops into the canvas in a single frame. The set's last five minutes may
 * bring them to their feet to applaud; once the band stops, they sit back down if they stay a
 * while, or stand until they go.
 */
function listen(c: PoseContext, poses: readonly EventPose[], calm: EventPose) {
  const { time, arrive, leave, home, day, trip } = c;
  const { start, end } = trip.event;
  // Sat waiting on the canvas when the band strikes up, a guest sits up: halfway first.
  const waited = arrive + SETTLE + HOLD <= start;
  if (waited && time >= start && time < start + SETTLE) return 'crouch';
  const from = Math.max(arrive, start) + SETTLE;
  // Getting up to applaud: a moment a few minutes before the end, by the guest's own hash.
  const seed = hash(`bandstand-cheer:${day}:${home.id}`);
  const up = end - CHEER_WINDOW + (seed % 26) / 10;
  const cheers = up - SETTLE >= from + CALM && Math.min(end, leave) - up >= HOLD;
  // After the set: back down for a last listen to the river if there is time, else on their feet.
  const after = cheers ? end : Infinity;
  const sitsBack = leave - end >= SETTLE + HOLD + SETTLE + 0.2;
  if (time >= after) {
    if (!sitsBack) return undefined;
    return time < end + SETTLE ? 'crouch' : calm;
  }
  if (cheers && time >= up - SETTLE) return time < up ? 'crouch' : 'cheer';
  // Runs of one pose: the first is calm, then each takes its own pose by hash.
  if (time < from + CALM) return calm;
  const length = 4 + (hash(`bandstand-run:${home.id}`) % 5);
  const run = Math.floor((time - from - CALM) / length);
  const at = from + CALM + run * length;
  const poseOf = (k: number) =>
    k < 0 ? calm : poses[hash(`bandstand-pose:${day}:${home.id}:${k}`) % poses.length];
  const pose = poseOf(run);
  const low = (p: EventPose) => p === 'sip';
  // A run that changes height shows its pose only after the crouch: hold it a minute from then.
  const shown = at + (low(pose) !== low(poseOf(run - 1)) ? SETTLE : 0);
  // The last run before getting up keeps the pose it had, so every pose is held a minute.
  if ((cheers && shown + HOLD > up - SETTLE) || shown + HOLD > leave - SETTLE)
    return poseOf(run - 1);
  if (low(pose) !== low(poseOf(run - 1)) && time < at + SETTLE) return 'crouch';
  return pose;
}

/** A teatime listener: a perch in the deckchair and a cup of tea, applause at the very end. */
export const teaPose: OutingPose = (c) => listen(c, ['tea', 'perch', 'tea'], 'perch');

/** A sundown listener: perched, now and then a cool drink, applause at the very end. */
export const sundownPose: OutingPose = (c) => listen(c, ['perch', 'sip', 'perch'], 'perch');
