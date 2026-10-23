/**
 * The flash mob's beat, shared by the dancers (src/lib/flash-mob.ts), the square's art and the
 * music (src/music/flash-mob-track.ts). It imports nothing, so the music worker can use it too.
 *
 * A town minute is one real second, so at 120 beats a minute the mob dances two beats to a town
 * minute: beat b falls at 17:00 + b / 2. Phrases are 16 beats (four bars, eight seconds), and the
 * dance and the music change on the same phrase lines.
 */
export const FLASH_MOB_START = 17 * 60;
export const FLASH_MOB_BPM = 120;
/** Where each part of the dance begins, in beats from 17:00. */
export const FLASH_MOB_CUES = {
  /** The first dancer starts alone. */
  solo: 0,
  /** The others join, seat k on beat 16 + 2(k − 1), each with a two-beat walk into their place. */
  join: 16,
  /** Everyone together, a new move every 16 beats. */
  routine: 40,
  /** The build to the end. */
  finale: 136,
  /** One last hit, then the final pose held in silence. */
  freeze: 168,
  /** Arms down, as if nothing happened. */
  end: 176,
} as const;
/** Beats in the track: the dance, then a silent tail so its loop seam never sounds. */
export const FLASH_MOB_TRACK_BEATS = 180;
/** The track's length in seconds, which are town minutes. */
export const FLASH_MOB_SECONDS = (FLASH_MOB_TRACK_BEATS * 60) / FLASH_MOB_BPM;
/** Fractional beats since 17:00 at a town minute (negative before it). */
export const flashMobBeat = (minutes: number) =>
  ((((minutes % 1440) + 1440) % 1440) - FLASH_MOB_START) * (FLASH_MOB_BPM / 60);
/** The town minute a beat falls on. */
export const minuteOfBeat = (beat: number) => FLASH_MOB_START + (beat * 60) / FLASH_MOB_BPM;

/**
 * The mob's four records, one for each week of a season, which is also a quarter of the moon
 * (the town's moon keeps to the dates): new moon to first quarter on dates 2–6, first quarter to
 * full on 8–14, full to last quarter on 16–20, and last quarter to new on 22–28. Every one keeps
 * the same beat and cues, so the one dance fits them all. TrackIds in src/music/score.ts.
 */
export const FLASH_MOB_TRACKS = ['flashmob', 'flashmob-2', 'flashmob-3', 'flashmob-4'] as const;
export type FlashMobTrack = (typeof FLASH_MOB_TRACKS)[number];
/** The record for a date of the season (1–28): its week's. */
export const flashMobTrackOn = (date: number): FlashMobTrack =>
  FLASH_MOB_TRACKS[Math.min(3, Math.max(0, Math.floor((date - 1) / 7)))];
