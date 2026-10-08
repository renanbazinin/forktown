// Stargazers (agent E, SPEC §4.4): they `sit` on rugs facing `ne`, and `chat` now and then. No
// lying pose. Existing poses only.
// Import rule (SPEC §7.3): value-import only world, town-calendar, seasons, district-places and
// district-calendar; never resident-trips, events or anything under src/city/.
import type { OutingPose } from '../outings.ts';
import { hash } from '../world.ts';

/**
 * Minutes a stargazer spends halfway down on reaching their rug, and again before getting up: the
 * planner's own SEAT_SETTLE (resident-trips.ts, which this file may not import). The calm minute
 * that follows the settle, and the one before getting up, is always a plain `sit`.
 */
export const STAR_SETTLE = 0.4;
/** Minutes every pose is held at least: the first and the last of a visit, and every chat. */
export const STAR_HOLD = 1;
/** Minutes in a chat beat. Neighbors on one rug pair share their beats. */
export const STAR_BEAT = 9;
/** Minutes of a chat, from the start of its beat. */
export const STAR_CHAT = 3;

/**
 * A stargazer's pose: sat on their rug looking up at the sky over the stand. Now and then the two
 * neighbors on a pair of rugs (seats 0 and 1, 2 and 3, 4 and 5, 6 and 7) talk for three minutes,
 * on one beat in three of their own. A chat is only taken up when all of it fits between the calm
 * first minute and the calm last one, so no pose lasts less than a minute.
 */
export const starPose: OutingPose = ({ trip, time, seat, arrive, leave }) => {
  const from = Math.max(arrive, trip.event.start) + STAR_SETTLE + STAR_HOLD;
  const to = leave - STAR_SETTLE - STAR_HOLD;
  const pair = Math.floor(seat / 2);
  const offset = hash(`stars-chat:${Math.floor(trip.event.start)}:${pair}`) % STAR_BEAT;
  const beat = Math.floor((time + offset) / STAR_BEAT);
  const start = beat * STAR_BEAT - offset;
  const chatting =
    (beat + pair) % 3 === 0 && time < start + STAR_CHAT && start >= from && start + STAR_CHAT <= to;
  return chatting ? 'chat' : 'sit';
};
