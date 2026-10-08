// The stargazing note in the Bandstand's panel on new-moon nights (agent E, SPEC §4.4): the night's
// words, its hours, who is out on the rugs (names only while they are there, never a promise of a
// crowd), the summer meteors on their three nights, and the next new moon once the rugs are rolled.
import { nextOutingDay, OUTING_TIMES } from '../../lib/district-calendar';
import { DISTRICT_COPY, PANEL_COPY } from '../../lib/district-copy';
import { timeLabel, type ResidentState } from '../../lib/simulation';
import { townCalendarAt } from '../../lib/town-calendar';
import { meteorNight } from '../../city/sky-extras';
import type { StargazingNoteProps } from './cards';

const { start, end } = OUTING_TIMES.stargazing;
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

/** The note's lines for a moment of a star night's day (the evening it belongs to). */
export function stargazingLines(day: number, minutes: number, residents: readonly ResidentState[]) {
  // A star night belongs to its evening, like the film: before 06:00 it is still last night's.
  const evening = minutes < 360 ? Math.floor(day) - 1 : Math.floor(day);
  const time = minutes < 360 ? minutes + 1440 : minutes;
  const hours = `Rugs out on the lawn from ${timeLabel(start)} to ${timeLabel(end)}.`;
  let status: string;
  if (time < start) status = `${hours} An astronomer brings a brass telescope.`;
  else if (time < end) status = rugsLine(onTheRugs(residents)) ?? `${hours} The sky is dark.`;
  else {
    const next = nextOutingDay('stargazing', evening + 1);
    const when =
      next === evening + 1
        ? 'tomorrow night'
        : next === undefined
          ? 'at the next new moon'
          : `on ${townCalendarAt(next).season} ${townCalendarAt(next).date}`;
    status = `The rugs are rolled up for tonight. They come out again ${when}.`;
  }
  return {
    eyebrow: PANEL_COPY.stars.eyebrow,
    heading: PANEL_COPY.stars.heading,
    body: DISTRICT_COPY.stargazing.description(evening),
    status,
    meteors: meteorNight(evening)
      ? 'On a summer new moon a few slow meteors cross the sky. Keep looking up.'
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
