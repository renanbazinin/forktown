// The Boat Landing's panel (agent C, SPEC §4.5): the lawn by the river, and in Regatta Week the
// day's regatta first, where the boats are now and the neighbors at the water (names only while
// they are there). It reports and never ranks: no winner, no times, no order.
import {
  OUTING_TIMES,
  REGATTA_BOATS,
  REGATTA_LAUNCH_EVERY,
  REGATTA_NETTING,
  regattaDay,
} from '../../lib/district-calendar';
import { DISTRICT_COPY, PANEL_COPY } from '../../lib/district-copy';
import type { ResidentState } from '../../lib/simulation';
import type { DistrictPanelProps } from './cards';
import NeighborList from './NeighborList';

const REGATTA = OUTING_TIMES.regatta;
const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
/** The last launch, 14:54, and the boats' rest at the boom, 15:30–15:40 (district-calendar.ts). */
const LAST_LAUNCH = REGATTA.start + REGATTA_LAUNCH_EVERY * (REGATTA_BOATS - 1);
const RESTING = { from: 930, to: 940 } as const;

/** Where the regatta is at a town minute of a regatta day: one short line. */
export function regattaNow(day: number, minutes: number) {
  const time = ((minutes % 1440) + 1440) % 1440;
  if (time < REGATTA.start) return 'Boats go in from 14:00, one every six minutes.';
  if (time < LAST_LAUNCH) return 'Boats are going in, one every six minutes.';
  if (time < RESTING.from) return 'The boats are drifting down to the boom.';
  if (time < RESTING.to) return 'The boats are coming to rest at the boom.';
  if (time < REGATTA_NETTING.from) return 'The boats are resting at the boom.';
  if (time < REGATTA_NETTING.to) return 'The boatman is netting the boats out.';
  return regattaDay(day + 1)
    ? 'The boats are netted and dry. More go in tomorrow at 14:00.'
    : 'The boats are netted and dry. Regatta Week is over until next summer.';
}

/** The neighbors at the water now. */
export const atTheWater = (residents: readonly ResidentState[]) =>
  residents.filter(
    (resident) =>
      resident.event?.id === 'regatta' &&
      (resident.event.phase === 'attending' || resident.event.phase === 'waiting'),
  );

export default function LandingInfo({ day, minutes, residents, onFollow }: DistrictPanelProps) {
  const regatta = regattaDay(day);
  const here = regatta ? atTheWater(residents) : [];
  const copy = DISTRICT_COPY.regatta;
  return (
    <div className="venue-info">
      <span className="quiet-label">{PANEL_COPY.landing.eyebrow}</span>
      {/* In Regatta Week the regatta leads all day: it is what the visitor came for. */}
      {regatta && (
        <div className="venue-program">
          <span className="eyebrow">{copy.panelEyebrow}</span>
          <h3>{copy.name(day)}.</h3>
          <p>{copy.description(day)}</p>
          <p>{regattaNow(day, minutes)}</p>
          <strong>
            {clock(REGATTA.start)}–{clock(REGATTA.end)}
          </strong>
        </div>
      )}
      <NeighborList
        eyebrow={PANEL_COPY.landing.here}
        residents={here}
        activity={(resident) => copy.labels[resident.event!.phase]}
        onFollow={onFollow}
      />
      <div className="venue-program">
        <h3>{PANEL_COPY.landing.heading}</h3>
        <p>{PANEL_COPY.landing.body}</p>
        {!regatta && <p className="muted-copy">{PANEL_COPY.landing.week}</p>}
      </div>
    </div>
  );
}
