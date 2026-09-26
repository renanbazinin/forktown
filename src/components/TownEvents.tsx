import { ArrowUpRight, Music2, Sun, Film, PawPrint } from 'lucide-react';
import { eventStatus, type TownEvent } from '../lib/events';
import { timeLabel } from '../lib/simulation';
import { FOOTBALL_VENUE, type FootballState } from '../lib/football';
import { FootballIcon } from './FootballMatch';
import EveningNote, { type Evening } from './EveningNote';
import MillpondEventCard from './MillpondEventCard';
import { skatingCard } from '../lib/millpond-copy';

export default function TownEvents({
  events,
  minutes,
  onVisit,
  football,
  evening,
  day,
  skaters,
}: {
  events: TownEvent[];
  minutes: number;
  onVisit: (plot: string, eventId: string) => void;
  football: FootballState;
  evening?: Evening;
  day?: number;
  skaters?: number;
}) {
  const minute = Math.min(10, Number(football.clock.slice(0, 2)) + 1);
  const phase =
    football.phase === 'halftime'
      ? 'Half-time'
      : football.phase === 'fulltime'
        ? 'Full-time'
        : `LIVE · ${minute}'`;
  const match = football.live
    ? `Meadow ${football.score[0]} : ${football.score[1]} Sunset`
    : 'Meadow FC v Sunset United';
  const scored = football.goal ? (football.celebration?.team ?? null) : null;
  const spoken = football.live
    ? `${phase.startsWith('LIVE') ? `live, minute ${minute}` : phase.toLowerCase()}: Meadow FC ${football.score[0]}, Sunset United ${football.score[1]}`
    : 'back at sunrise';
  // Skating waits at the end of the list, and joins the live cards while it is on.
  const firstLater = events.findIndex((event) => eventStatus(event, minutes) !== 'Happening now');
  const skatingAt =
    day !== undefined && skatingCard(minutes, day)?.live && firstLater >= 0
      ? firstLater
      : events.length;
  return (
    <section className="town-events" aria-label="Today’s town events">
      <div className="events-intro">
        <span className="eyebrow">A LITTLE SOMETHING TO LOOK FORWARD TO</span>
        <h3>Today, together.</h3>
        <p>A new lineup every town day.</p>
      </div>
      {evening && (
        <>
          <EveningNote {...evening} onVisit={onVisit} />
          <p className="eyebrow evening-eyebrow">AROUND TOWN TODAY</p>
        </>
      )}
      <button
        className={`event-card football-event ${football.live ? 'is-live' : ''}`}
        onClick={() => onVisit(FOOTBALL_VENUE.plot, 'football')}
        aria-label={`Watch football at ${FOOTBALL_VENUE.name}, ${spoken}`}
      >
        <span className="event-symbol">
          <FootballIcon />
        </span>
        <span className="event-copy">
          <span className="event-time">
            {football.live && <i className="live-dot" />}{' '}
            {football.live ? phase : 'Back at sunrise · 06:00–20:00'}
            {scored !== null && (
              <b className={`football-card-goal team-${scored}`}>
                Goal · {scored ? 'Sunset' : 'Meadow'}
              </b>
            )}
          </span>
          <strong className="football-card-score">
            <i className="football-chip team-0" aria-hidden="true" />
            {match}
            <i className="football-chip team-1" aria-hidden="true" />
          </strong>
          <span>
            {FOOTBALL_VENUE.name} <ArrowUpRight size={12} />
          </span>
        </span>
      </button>
      {[...events.slice(0, skatingAt), null, ...events.slice(skatingAt)].map((event) => {
        if (!event)
          return day === undefined ? null : (
            <MillpondEventCard
              key="millpond"
              minutes={minutes}
              day={day}
              skaters={skaters}
              onVisit={onVisit}
            />
          );
        const live = eventStatus(event, minutes) === 'Happening now';
        const Icon =
          event.venue.kind === 'zoo'
            ? PawPrint
            : event.venue.kind === 'cinema'
              ? Film
              : event.venue.kind === 'stage'
                ? Music2
                : Sun;
        return (
          <button
            className={`event-card ${live ? 'is-live' : ''}`}
            key={event.id}
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
