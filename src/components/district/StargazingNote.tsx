// The stargazing note in the Bandstand's panel on new-moon nights (agent E, SPEC §4.4). Foundation
// stub: the frozen lines only.
import { DISTRICT_COPY, PANEL_COPY } from '../../lib/district-copy';
import type { StargazingNoteProps } from './cards';

export default function StargazingNote({ day }: StargazingNoteProps) {
  return (
    <div className="venue-program">
      <span className="eyebrow">{PANEL_COPY.stars.eyebrow}</span>
      <h3>{PANEL_COPY.stars.heading}</h3>
      <p>{DISTRICT_COPY.stargazing.description(day)}</p>
    </div>
  );
}
