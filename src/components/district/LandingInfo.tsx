// The Boat Landing's panel (agent C, SPEC §4.5). Foundation stub: the frozen lines only.
import { PANEL_COPY } from '../../lib/district-copy';
import type { DistrictPanelProps } from './cards';

export default function LandingInfo(_props: DistrictPanelProps) {
  return (
    <div className="venue-info">
      <span className="quiet-label">{PANEL_COPY.landing.eyebrow}</span>
      <div className="venue-program">
        <h3>{PANEL_COPY.landing.heading}</h3>
        <p>{PANEL_COPY.landing.body}</p>
        <p className="muted-copy">{PANEL_COPY.landing.week}</p>
      </div>
    </div>
  );
}
