import { harvestDay } from '../lib/district-calendar';
import { DISTRICT_COPY, PANEL_COPY } from '../lib/district-copy';
import { districtEvents, eventStatus, type TownEvent } from '../lib/events';
import { timeLabel, type ResidentState } from '../lib/simulation';
import type { DistrictPanelProps } from './district/cards';
import NeighborList, { byNeighborName } from './district/NeighborList';
import './harvest-panel.css';

// Moon Harvest Farm's panel. Its Harvest Fair section (docs/HARVEST_FAIR.md) reads the props: the
// dates, today's program (the outing the visitor chose first, else the one on now, then the one to
// come, then the one over), who is there by name only while they are there, and out of season one
// forward-looking line with "Next: Autumn 23.".

/** The farm's two outings, in the order of the day. */
const HARVEST_OUTINGS = ['harvest-fair', 'long-table'] as const;
/** On now first, then later today, then finished: a stable sort keeps the day's order in a tie. */
const STATUS_ORDER: Record<string, number> = { 'Happening now': 0, 'Later today': 1 };
const statusRank = (event: TownEvent, minutes: number) =>
  STATUS_ORDER[eventStatus(event, minutes)] ?? 2;

/** Who is at an outing right now: at their spot, waiting for it or in it. */
const presentAt = (residents: readonly ResidentState[], id: string) =>
  residents
    .filter(
      (resident) =>
        resident.event?.id === id &&
        (resident.event.phase === 'waiting' || resident.event.phase === 'attending'),
    )
    .sort(byNeighborName);

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
  return (
    <>
      <div className="venue-program harvest-outing">
        <span className="eyebrow">{copy.panelEyebrow}</span>
        {/* The fair keeps the farm's own heading all year; the table is its event's name. */}
        <h3>{event.outing === 'harvest-fair' ? PANEL_COPY.harvest.heading : `${event.name}.`}</h3>
        <p>{event.description}</p>
        <strong>
          {timeLabel(event.start)}–{timeLabel(event.end)} · {eventStatus(event, minutes)}
        </strong>
      </div>
      <NeighborList
        eyebrow={
          event.outing === 'long-table' ? PANEL_COPY.harvest.tableHere : PANEL_COPY.harvest.fairHere
        }
        residents={presentAt(residents, event.id)}
        activity={(resident) => copy.labels[resident.event!.phase]}
        onFollow={onFollow}
      />
    </>
  );
}

export default function FarmInfo({
  day,
  minutes,
  residents,
  onFollow,
  selected,
}: DistrictPanelProps) {
  const today = harvestDay(day);
  const program = today
    ? districtEvents(day, minutes).filter((event) =>
        (HARVEST_OUTINGS as readonly string[]).includes(event.outing ?? ''),
      )
    : [];
  // On the fair's last day, once supper is over, the next fair is next year's.
  const over = !today || (!harvestDay(day + 1) && minutes >= program.at(-1)!.end);
  const shown = [...program].sort(
    (a, b) =>
      Number(b.id === selected) - Number(a.id === selected) ||
      statusRank(a, minutes) - statusRank(b, minutes),
  );
  return (
    <div className="venue-info">
      <span className="quiet-label">PUBLIC SPACE · S4–T9 · 12 PLOTS</span>
      {today ? (
        shown.map((event) => (
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
          <p>{PANEL_COPY.harvest.body}</p>
        </div>
      )}
      <p className="muted-copy">
        The fair and the Long Table: {PANEL_COPY.harvest.dates}
        {over && ` ${PANEL_COPY.harvest.next}`}
      </p>
    </div>
  );
}
