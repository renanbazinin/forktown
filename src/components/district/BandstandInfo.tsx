// The Bandstand's panel (agent C, SPEC §4.2): tonight's band, the two sets and the deckchairs, what
// the band is doing now, and the neighbors in the deckchairs (names only while they are there; the
// scenery players are never counted). On new-moon nights it holds the StargazingNote (agent E's).
import { bandOf, OUTING_TIMES, starNight } from '../../lib/district-calendar';
import { BAND_COPY, DISTRICT_COPY, PANEL_COPY } from '../../lib/district-copy';
import type { ResidentState } from '../../lib/simulation';
import { ArrowRight } from 'lucide-react';
import type { DistrictPanelProps } from './cards';
import StargazingNote from './StargazingNote';

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
      eyebrow: 'Later today',
      line: 'The band is tuning up. The teatime set starts at 16:00.',
    };
  if (time >= TEA.start && time < TEA.end)
    return { eyebrow: 'Happening now', line: 'The teatime set is playing.' };
  if (time >= TEA.end && time < SUNDOWN.start)
    return { eyebrow: 'Later today', line: 'Tea on the steps. The sundown set starts at 18:15.' };
  if (time >= SUNDOWN.start && time < SUNDOWN.end)
    return { eyebrow: 'Happening now', line: 'The sundown set is playing.' };
  if (time >= SUNDOWN.end && time < GONE)
    return {
      eyebrow: 'Finished today',
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

export default function BandstandInfo({ day, minutes, residents, onFollow }: DistrictPanelProps) {
  const band = BAND_COPY[bandOf(day)];
  // A star night belongs to its evening, like the film: before 06:00 it is still last night's.
  const evening = minutes < 360 ? day - 1 : day;
  const now = bandstandNow(minutes);
  const here = listening(residents);
  return (
    <div className="venue-info">
      <span className="quiet-label">{PANEL_COPY.bandstand.eyebrow}</span>
      <div className="venue-program">
        {now && <span className="eyebrow">{now.eyebrow}</span>}
        <h3>{PANEL_COPY.bandstand.heading}</h3>
        <p>
          {band.name}. {band.description}
        </p>
        {now && <p>{now.line}</p>}
        <p className="muted-copy">
          {PANEL_COPY.bandstand.sets} {PANEL_COPY.bandstand.chairs}
        </p>
      </div>
      {here.map((resident) => (
        <button key={resident.id} className="resident-link" onClick={() => onFollow(resident.id)}>
          <span>
            <strong>{resident.resident.name}</strong>
            <small>{DISTRICT_COPY['bandstand-tea'].labels[resident.event!.phase]}</small>
          </span>
          <ArrowRight size={14} />
        </button>
      ))}
      {starNight(evening) && <StargazingNote day={day} minutes={minutes} residents={residents} />}
    </div>
  );
}
