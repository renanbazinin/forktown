// The Bandstand's panel (agent C, SPEC §4.2): tonight's band, the two sets and the deckchairs; on
// new-moon nights it holds the StargazingNote (agent E's). Foundation stub: the frozen lines only.
import { bandOf, starNight } from '../../lib/district-calendar';
import { BAND_COPY, PANEL_COPY } from '../../lib/district-copy';
import type { DistrictPanelProps } from './cards';
import StargazingNote from './StargazingNote';

export default function BandstandInfo({ day, minutes, residents }: DistrictPanelProps) {
  const band = BAND_COPY[bandOf(day)];
  // A star night belongs to its evening, like the film: before 06:00 it is still last night's.
  const evening = minutes < 360 ? day - 1 : day;
  return (
    <div className="venue-info">
      <span className="quiet-label">{PANEL_COPY.bandstand.eyebrow}</span>
      <div className="venue-program">
        <h3>{PANEL_COPY.bandstand.heading}</h3>
        <p>
          {band.name}. {band.description}
        </p>
        <p className="muted-copy">
          {PANEL_COPY.bandstand.sets} {PANEL_COPY.bandstand.chairs}
        </p>
      </div>
      {starNight(evening) && <StargazingNote day={day} minutes={minutes} residents={residents} />}
    </div>
  );
}
