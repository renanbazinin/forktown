import type { Place } from './schema';
import { flashMobDancers } from './resident-trips';
import { flashMobDay } from './square';
import { FLASH_MOB_SECONDS, FLASH_MOB_START, flashMobTrackOn } from './flash-mob-beat';
import { townCalendarAt } from './town-calendar';

/** Town minutes before 17:00 the track starts rendering, so it is ready on the stream box too. */
const RENDER_AHEAD = 60;

/**
 * What the town's sound needs of the flash mob at a moment (Soundtrack's flashMob, flashMobSoon
 * and flashMobTrack): its playback from `preroll` seconds before 17:00 to the end of the track,
 * whether to render it ahead, and the day's record (its week's). A day with no dancers stays
 * silent, so the secret never plays to an empty square.
 */
export function flashMobSoundAt(places: Place[], minutes: number, day: number, preroll: number) {
  const elapsed = minutes - FLASH_MOB_START;
  if (
    !flashMobDay(day) ||
    elapsed < -RENDER_AHEAD ||
    elapsed >= FLASH_MOB_SECONDS ||
    !flashMobDancers(places, day).length
  )
    return { flashMob: null, flashMobSoon: false };
  const track = flashMobTrackOn(townCalendarAt(Math.floor(day)).date);
  return {
    flashMob: elapsed >= -preroll ? { elapsed, key: `flash-mob:${day}`, track } : null,
    flashMobSoon: elapsed < 0,
    flashMobTrack: track,
  };
}
