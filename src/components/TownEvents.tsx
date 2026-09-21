import { ArrowUpRight, Music2, Sun } from 'lucide-react';
import { eventStatus, type TownEvent } from '../lib/events';
import { timeLabel } from '../lib/simulation';
import { FOOTBALL_VENUE, type FootballState } from '../lib/football';

export default function TownEvents({
  events,
  minutes,
  onVisit,
  football,
}: {
  events: TownEvent[];
  minutes: number;
  onVisit: (plot: string, eventId: string) => void;
  football: FootballState;
}) {
  return (
    <section className="town-events" aria-label="Today’s town events">
      <div className="events-intro">
        <span className="eyebrow">A LITTLE SOMETHING TO LOOK FORWARD TO</span>
        <h3>Today, together.</h3>
        <p>A new lineup every town day.</p>
      </div>
      <button
        className={`event-card football-event ${football.live ? 'is-live' : ''}`}
        onClick={() => onVisit(FOOTBALL_VENUE.plot, 'football')}
        aria-label="Watch football at The Meadow Ground"
      >
        <span className="event-symbol" aria-hidden="true">
          ⚽
        </span>
        <span className="event-copy">
          <span className="event-time">
            {football.live && <i className="live-dot" />}{' '}
            {football.live ? 'On the pitch now' : 'Back at sunrise'} · 06:00–20:00
          </span>
          <strong>
            Meadow {football.score[0]} : {football.score[1]} Sunset
          </strong>
          <span>
            A little football, all day <ArrowUpRight size={12} />
          </span>
        </span>
      </button>
      {events.map((event) => {
        const live = eventStatus(event, minutes) === 'Happening now';
        const Icon = event.venue.kind === 'stage' ? Music2 : Sun;
        return (
          <button
            className={`event-card ${live ? 'is-live' : ''}`}
            key={event.period}
            onClick={() => onVisit(event.venue.plot, event.id)}
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
