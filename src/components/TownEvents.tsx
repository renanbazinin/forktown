import { ArrowUpRight, Music2, Sun } from 'lucide-react';
import { eventStatus, type TownEvent } from '../lib/events';
import { timeLabel } from '../lib/simulation';

export default function TownEvents({
  events,
  minutes,
  onVisit,
}: {
  events: TownEvent[];
  minutes: number;
  onVisit: (plot: string) => void;
}) {
  return (
    <section className="town-events" aria-label="Today’s town events">
      <div className="events-intro">
        <span className="eyebrow">A LITTLE SOMETHING TO LOOK FORWARD TO</span>
        <h3>Today, together.</h3>
        <p>A new lineup every town day.</p>
      </div>
      {events.map((event) => {
        const live = eventStatus(event, minutes) === 'Happening now';
        const Icon = event.venue.kind === 'stage' ? Music2 : Sun;
        return (
          <button
            className={`event-card ${live ? 'is-live' : ''}`}
            key={event.period}
            onClick={() => onVisit(event.venue.plot)}
            aria-label={`Visit ${event.venue.name}: ${event.name}`}
          >
            <span className="event-symbol">
              <Icon size={20} />
            </span>
            <span className="event-copy">
              <span className="event-time">
                {live && <i className="live-dot" />} {eventStatus(event, minutes)} ·{' '}
                {timeLabel(event.start)}–{timeLabel(event.end)}
              </span>
              <strong>{event.name}</strong>
              <span>
                {event.venue.name} <ArrowUpRight size={12} />
              </span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
