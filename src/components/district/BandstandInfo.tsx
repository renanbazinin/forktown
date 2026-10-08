// The Bandstand's panel (agent C, SPEC §4.2): tonight's band, the two sets and the deckchairs, what
// the band is doing now, and the neighbors in the deckchairs (names only while they are there; the
// scenery players are never counted). On new-moon nights it holds the StargazingNote (agent E's),
// first once the players are gone or when the visitor chose the stars; on any other night it says
// when the next one is.
import { bandOf, OUTING_TIMES, starNight } from '../../lib/district-calendar';
import { BAND_COPY, DISTRICT_COPY, PANEL_COPY, STATUS_EYEBROW } from '../../lib/district-copy';
import type { ResidentState } from '../../lib/simulation';
import type { DistrictPanelProps } from './cards';
import NeighborList from './NeighborList';
import StargazingNote, { nextStarNight } from './StargazingNote';

const TEA = OUTING_TIMES['bandstand-tea'],
  SUNDOWN = OUTING_TIMES['bandstand-sundown'];
/** The players fade in at 15:45 and are gone by 20:15 (city/district/bandstand.ts). */
const TUNING = 945,
  GONE = 1215;

/** What the band is doing at a town minute: one short line, or nothing out of hours. */
export function bandstandNow(minutes: number): { eyebrow: string; line: string } | undefined {
  const time = ((minutes % 1440) + 1440) % 1440;
  if (time >= TUNING && time < TEA.start)
    return {
      eyebrow: STATUS_EYEBROW.later,
      line: 'The band is tuning up. The teatime set starts at 16:00.',
    };
  if (time >= TEA.start && time < TEA.end)
    return { eyebrow: STATUS_EYEBROW.open, line: 'The teatime set is playing.' };
  if (time >= TEA.end && time < SUNDOWN.start)
    return {
      eyebrow: STATUS_EYEBROW.later,
      line: 'Tea on the steps. The sundown set starts at 18:15.',
    };
  if (time >= SUNDOWN.start && time < SUNDOWN.end)
    return { eyebrow: STATUS_EYEBROW.open, line: 'The sundown set is playing.' };
  if (time >= SUNDOWN.end && time < GONE)
    return {
      eyebrow: STATUS_EYEBROW.closed,
      line: 'The band is packing up. The chairs come in at 20:20.',
    };
  return undefined;
}

/** The neighbors in the deckchairs now, waiting for a set or listening to it. */
export const listening = (residents: readonly ResidentState[]) =>
  residents.filter(
    (resident) =>
      (resident.event?.id === 'bandstand-tea' || resident.event?.id === 'bandstand-sundown') &&
      (resident.event.phase === 'attending' || resident.event.phase === 'waiting'),
  );

export default function BandstandInfo({
  day,
  minutes,
  residents,
  onFollow,
  selected,
}: DistrictPanelProps) {
  const band = BAND_COPY[bandOf(day)];
  // A star night belongs to its evening, like the film: before 06:00 it is still last night's.
  const evening = minutes < 360 ? day - 1 : day;
  const stars = starNight(evening);
  // The stars lead when the visitor chose them, or once the players are gone for the night.
  const starsFirst = stars && (selected === 'stargazing' || minutes >= GONE || minutes < 360);
  const now = bandstandNow(minutes);
  // Under the stars the band's copy is the day's, over: never read as live.
  const eyebrow = now?.eyebrow ?? (starsFirst ? STATUS_EYEBROW.closed : undefined);
  const here = listening(residents);
  const note = stars && <StargazingNote day={day} minutes={minutes} residents={residents} />;
  return (
    <div className="venue-info">
      <span className="quiet-label">{PANEL_COPY.bandstand.eyebrow}</span>
      {starsFirst && note}
      <div className="venue-program">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h3>{PANEL_COPY.bandstand.heading}</h3>
        <p>
          {band.name}. {band.description}
        </p>
        {now && <p>{now.line}</p>}
        {now?.eyebrow === STATUS_EYEBROW.open && (
          <p className="muted-copy">{PANEL_COPY.bandstand.listen}</p>
        )}
        <p className="muted-copy">
          {PANEL_COPY.bandstand.sets} {PANEL_COPY.bandstand.chairs}
        </p>
        {!stars && (
          <p className="muted-copy">{PANEL_COPY.stars.next(nextStarNight(day, minutes))}</p>
        )}
      </div>
      <NeighborList
        eyebrow={PANEL_COPY.bandstand.here}
        residents={here}
        activity={(resident) => DISTRICT_COPY['bandstand-tea'].labels[resident.event!.phase]}
        onFollow={onFollow}
      />
      {!starsFirst && note}
    </div>
  );
}
