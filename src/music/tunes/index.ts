// The town's tunes for each hour (score.ts TOWN_ROTATION), one file each. A file exports its
// TuneInfo (title, tempo, length, room) and a compose function; this index gives each its
// volume in the rotation and lets compose() find it. The render worker reaches the notes through
// score.ts; the town's page reads only the TuneInfo, so the notes stay out of its bundle.
import type { Note, TrackInfo } from '../score';
import { BEFORE_DAWN, composeBeforeDawn } from './before-dawn';
import { GOLDEN_HOUR, composeGoldenHour } from './golden-hour';
import { LAMPLIGHT, composeLamplight } from './lamplight';
import { MIDDAY, composeMidday } from './midday';
import { MORNING, composeMorning } from './morning';
import { SMALL_HOURS, composeSmallHours } from './small-hours';
import { SUNRISE, composeSunrise } from './sunrise';
import { TEATIME, composeTeatime } from './teatime';
import { AFTERNOON, composeAfternoon } from './afternoon';

export type TuneId =
  | 'smallhours'
  | 'beforedawn'
  | 'sunrise'
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'teatime'
  | 'goldenhour'
  | 'lamplight';

// RMS levels: the day theme ('town') settles at 0.052 and 'night' at 0.035 (score.ts). The tunes
// of the day sit at about the theme's level, the night's well under, dawn and dusk between.
const DAY = 0.05,
  EDGE = 0.042,
  NIGHT = 0.034;
export const TOWN_TUNES: Record<TuneId, TrackInfo> = {
  smallhours: { ...SMALL_HOURS, loudness: NIGHT * 0.94 },
  beforedawn: { ...BEFORE_DAWN, loudness: NIGHT },
  sunrise: { ...SUNRISE, loudness: EDGE },
  morning: { ...MORNING, loudness: DAY },
  midday: { ...MIDDAY, loudness: DAY },
  afternoon: { ...AFTERNOON, loudness: DAY * 0.96 },
  // The brightest mix of the day, so a little under the others to sound as loud.
  teatime: { ...TEATIME, loudness: DAY * 0.95 },
  goldenhour: { ...GOLDEN_HOUR, loudness: EDGE * 1.08 },
  lamplight: { ...LAMPLIGHT, loudness: NIGHT * 1.1 },
};
export const isTune = (track: string): track is TuneId => track in TOWN_TUNES;

export function composeTune(id: TuneId): Note[] {
  switch (id) {
    case 'smallhours':
      return composeSmallHours();
    case 'beforedawn':
      return composeBeforeDawn();
    case 'sunrise':
      return composeSunrise();
    case 'morning':
      return composeMorning();
    case 'midday':
      return composeMidday();
    case 'afternoon':
      return composeAfternoon();
    case 'teatime':
      return composeTeatime();
    case 'goldenhour':
      return composeGoldenHour();
    case 'lamplight':
      return composeLamplight();
  }
}
