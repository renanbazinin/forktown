import type { ReactNode } from 'react';
import { harvestDay } from '../lib/district-calendar';
import { DISTRICT_COPY, PANEL_COPY } from '../lib/district-copy';
import { districtEvents, eventStatus, type TownEvent } from '../lib/events';
import { timeLabel, type ResidentState } from '../lib/simulation';
import type { DistrictPanelProps } from './district/cards';
import './harvest-panel.css';

// Moon Harvest Farm's panel. Its Harvest Fair section (agent D, SPEC §4.3) reads the props: the
// dates, today's program, guests by name only while they are there, and "Next: Autumn 23." out of
// season.

/** The farm's two outings, in the order of the day. */
const HARVEST_OUTINGS = ['harvest-fair', 'long-table'] as const;

/** "A", "A and B", "A, B and C". */
function listed(names: readonly ReactNode[]) {
  return names.flatMap((name, i) => [i === 0 ? '' : i === names.length - 1 ? ' and ' : ', ', name]);
}

/** Who is at an outing right now: at their spot, waiting for it or in it. */
const presentAt = (residents: readonly ResidentState[], id: string) =>
  residents
    .filter(
      (resident) =>
        resident.event?.id === id &&
        (resident.event.phase === 'waiting' || resident.event.phase === 'attending'),
    )
    .sort((a, b) => a.resident.name.localeCompare(b.resident.name));

function Outing({
  event,
  minutes,
  residents,
  onFollow,
}: {
  event: TownEvent;
  minutes: number;
  residents: readonly ResidentState[];
  onFollow: (id: string) => void;
}) {
  const copy = DISTRICT_COPY[event.outing!];
  const here = presentAt(residents, event.id);
  return (
    <div className="venue-program harvest-outing">
      <span className="eyebrow">{copy.panelEyebrow}</span>
      {/* The fair keeps the farm's own heading all year; the table is its event's name. */}
      <h3>{event.outing === 'harvest-fair' ? PANEL_COPY.harvest.heading : `${event.name}.`}</h3>
      <p>{event.description}</p>
      <strong>
        {timeLabel(event.start)}–{timeLabel(event.end)} · {eventStatus(event, minutes)}
      </strong>
      {here.length > 0 && (
        <p className="harvest-guests">
          {event.outing === 'long-table' ? 'At the table now: ' : 'At the fair now: '}
          {listed(
            here.map((resident) => (
              <button
                key={resident.id}
                className="text-button"
                onClick={() => onFollow(resident.id)}
              >
                {resident.resident.name}
              </button>
            )),
          )}
          .
        </p>
      )}
    </div>
  );
}

export default function FarmInfo({ day, minutes, residents, onFollow }: DistrictPanelProps) {
  const today = harvestDay(day);
  const program = today
    ? districtEvents(day, minutes).filter((event) =>
        (HARVEST_OUTINGS as readonly string[]).includes(event.outing ?? ''),
      )
    : [];
  // On the fair's last day, once supper is over, the next fair is next year's.
  const over = !today || (!harvestDay(day + 1) && minutes >= program.at(-1)!.end);
  return (
    <div className="venue-info">
      <span className="quiet-label">PUBLIC SPACE · S4–T9 · 12 PLOTS</span>
      {today ? (
        program.map((event) => (
          <Outing
            key={event.id}
            event={event}
            minutes={minutes}
            residents={residents}
            onFollow={onFollow}
          />
        ))
      ) : (
        <div className="venue-program">
          <span className="eyebrow">{DISTRICT_COPY['harvest-fair'].panelEyebrow}</span>
          <h3>{PANEL_COPY.harvest.heading}</h3>
          <p>{DISTRICT_COPY['harvest-fair'].description(day)}</p>
          <p>{DISTRICT_COPY['long-table'].description(day)}</p>
        </div>
      )}
      <p className="muted-copy">
        The fair and the Long Table: {PANEL_COPY.harvest.dates}
        {over && ` ${PANEL_COPY.harvest.next}`}
      </p>
    </div>
  );
}
