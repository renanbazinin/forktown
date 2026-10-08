// Market Square's panel (agent B, SPEC §4.1): today's market and its copy, the hours, the
// neighbors browsing now (names only while they are there; nothing about a crowd when nobody is),
// and "Next market: tomorrow, 08:00." out of hours. Foundation stub: the frozen lines only.
import { DISTRICT_COPY, PANEL_COPY } from '../../lib/district-copy';
import type { DistrictPanelProps } from './cards';

export default function MarketInfo({ day }: DistrictPanelProps) {
  return (
    <div className="venue-info">
      <span className="quiet-label">{PANEL_COPY.market.eyebrow}</span>
      <div className="venue-program">
        <h3>{PANEL_COPY.market.heading}</h3>
        <p>
          {DISTRICT_COPY.market.name(day)}. {DISTRICT_COPY.market.description(day)}
        </p>
        <p className="muted-copy">{PANEL_COPY.market.hours}</p>
      </div>
    </div>
  );
}
