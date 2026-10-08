// The stargazing note in the Bandstand's panel on new-moon nights (docs/STARGAZING.md): the night's
// words, its hours, who is out on the rugs (names only while they are there, never a promise of a
// crowd), the summer meteors on their three nights, and once the rugs are rolled up, when they come
// out again, counted from the reader's own calendar day.
import { nextOutingDay, OUTING_TIMES } from '../../lib/district-calendar';
import { BANDSTAND_FURNITURE } from '../../lib/district-places';
import { DISTRICT_COPY, PANEL_COPY } from '../../lib/district-copy';
import { timeLabel, type ResidentState } from '../../lib/simulation';
import { townCalendarAt } from '../../lib/town-calendar';
import { meteorNight } from '../../city/sky-extras';
import type { StargazingNoteProps } from './cards';

const { start, end } = OUTING_TIMES.stargazing;
/** When the last rug is rolled up (00:35), on the evening's timeline. */
const RUGS_UP = BANDSTAND_FURNITURE.rugs.to;
/** Who is out on the rugs: the stargazers at their spots, waiting for the dark or looking up. */
export const onTheRugs = (residents: readonly ResidentState[]) =>
  residents
    .filter(
      (resident) =>
        resident.event?.id === 'stargazing' &&
        (resident.event.phase === 'attending' || resident.event.phase === 'waiting'),
    )
    .map((resident) => resident.resident.name.trim());
/** "Ada is out on the rugs.", "Ada and Sol are…", "3 neighbors are…"; nothing for nobody. */
export function rugsLine(names: readonly string[]) {
  if (!names.length) return undefined;
  if (names.some((name) => !name) || names.length > 2)
    return names.length === 1
      ? '1 neighbor is out on the rugs.'
      : `${names.length} neighbors are out on the rugs.`;
  return names.length === 1
    ? `${names[0]} is out on the rugs.`
    : `${names[0]} and ${names[1]} are out on the rugs.`;
}

/**
 * When the rugs come out next, after the evening a moment belongs to, counted from the reader's
 * own calendar day: past midnight the coming evening is tonight's, the next one tomorrow night's.
 * "tonight", "tomorrow night", "on Autumn 27", or "at the next new moon".
 */
export function nextStarNight(day: number, minutes: number) {
  // A star night belongs to its evening, like the film: before 06:00 it is still last night's.
  const evening = minutes < 360 ? Math.floor(day) - 1 : Math.floor(day);
  const today = Math.floor(day);
  const next = nextOutingDay('stargazing', evening + 1);
  return next === today
    ? 'tonight'
    : next === today + 1
      ? 'tomorrow night'
      : next === undefined
        ? 'at the next new moon'
        : `on ${townCalendarAt(next).season} ${townCalendarAt(next).date}`;
}

/** The note's lines for a moment of a star night's day (the evening it belongs to). */
export function stargazingLines(day: number, minutes: number, residents: readonly ResidentState[]) {
  // A star night belongs to its evening, like the film: before 06:00 it is still last night's.
  const evening = minutes < 360 ? Math.floor(day) - 1 : Math.floor(day);
  const time = minutes < 360 ? minutes + 1440 : minutes;
  // The outing's own hours; the rugs go down a little before and come up a little after.
  const hours = `Stargazing on the lawn from ${timeLabel(start)} to ${timeLabel(end)}.`;
  let status: string;
  if (time < start) status = `${hours} An astronomer brings a brass telescope.`;
  else if (time < end) status = rugsLine(onTheRugs(residents)) ?? `${hours} The sky is dark.`;
  else if (time < RUGS_UP)
    status = `Stargazing is over for tonight. The rugs come up by ${timeLabel(RUGS_UP)}.`;
  else status = `The rugs are rolled up. They come out again ${nextStarNight(day, minutes)}.`;
  return {
    eyebrow: PANEL_COPY.stars.eyebrow,
    heading: PANEL_COPY.stars.heading,
    body: DISTRICT_COPY.stargazing.description(evening),
    status,
    // The meteors cross the sky band above the town, which the panel's own framing of the lawn
    // leaves out: the line says where to see them.
    meteors: meteorNight(evening)
      ? 'On a summer new moon a few slow meteors cross the sky over the town. Zoom out to watch for them.'
      : undefined,
  };
}

export default function StargazingNote({ day, minutes, residents }: StargazingNoteProps) {
  const lines = stargazingLines(day, minutes, residents);
  return (
    <div className="venue-program">
      <span className="eyebrow">{lines.eyebrow}</span>
      <h3>{lines.heading}</h3>
      <p>{lines.body}</p>
      <p className="muted-copy">{lines.status}</p>
      {lines.meteors && <p className="muted-copy">{lines.meteors}</p>}
    </div>
  );
}
