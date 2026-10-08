// Market Square's panel (agent B, SPEC §4.1): today's market and its copy, the hours, the
// neighbors browsing now (names only while they are there; nothing about a crowd when nobody is),
// and "Next market: tomorrow, 08:00." once it has closed for the day.
import { OUTING_TIMES } from '../../lib/district-calendar';
import { DISTRICT_COPY, PANEL_COPY } from '../../lib/district-copy';
import type { ResidentState } from '../../lib/simulation';
import { NeighborRow } from '../BrowseRows';
import type { DistrictPanelProps } from './cards';

/** The neighbors at the stalls right now, by name: the panel's only list of people. */
export const browsingNow = (residents: readonly ResidentState[]) =>
  residents
    .filter((resident) => resident.event?.id === 'market' && resident.event.phase === 'attending')
    .sort((a, b) => a.resident.name.localeCompare(b.resident.name) || a.id.localeCompare(b.id));

/** Where the market's day stands: before it opens, open, or closed until tomorrow. */
export function marketStatus(minutes: number, browsing: number) {
  const time = ((minutes % 1440) + 1440) % 1440;
  const { start, end } = OUTING_TIMES.market;
  // Early browsers start as they arrive, so the market is on once anyone is at a stall.
  if (browsing > 0 || (time >= start && time < end)) return 'open';
  return time < start ? 'later' : 'closed';
}

const EYEBROW = { later: 'LATER TODAY', open: 'HAPPENING NOW', closed: 'FINISHED TODAY' } as const;

export default function MarketInfo({ day, minutes, residents, onFollow }: DistrictPanelProps) {
  const browsing = browsingNow(residents);
  const status = marketStatus(minutes, browsing.length);
  const copy = DISTRICT_COPY.market;
  return (
    <div className="venue-info">
      <span className="quiet-label">{PANEL_COPY.market.eyebrow}</span>
      <div className="venue-program">
        <span className="eyebrow">{EYEBROW[status]}</span>
        <h3>{PANEL_COPY.market.heading}</h3>
        <p>
          {copy.name(day)}. {copy.description(day)}
        </p>
        <p className="muted-copy">{PANEL_COPY.market.hours}</p>
        {status === 'closed' && <p className="muted-copy">{PANEL_COPY.market.next}</p>}
      </div>
      {browsing.length > 0 && (
        <div className="venue-program">
          <span className="eyebrow">AT THE STALLS NOW</span>
          {browsing.map((resident) => (
            <NeighborRow
              key={resident.id}
              id={resident.id}
              resident={resident.resident}
              activity={copy.labels.attending}
              onFollow={onFollow}
            />
          ))}
        </div>
      )}
    </div>
  );
}
