import { ArrowUpRight, Music2, Sun, Film, PawPrint } from 'lucide-react';
import { eventStatus, type TownEvent } from '../lib/events';
import { timeLabel } from '../lib/simulation';
import { FOOTBALL_VENUE, type FootballState } from '../lib/football';
import { FootballIcon } from './FootballMatch';
import EveningNote, { type Evening } from './EveningNote';
import MillpondEventCard from './MillpondEventCard';
import { skatingCard } from '../lib/millpond-copy';
import SeasonalErrandCard from './SeasonalErrandCard';
import type { Place } from '../lib/schema';
import { DISTRICT_CARDS } from './district/cards';

const LIVE = 'Happening now';
/**
 * The Riverside's cards, one per outing, both Bandstand sets on one card: the set that is on,
 * else the next one today, else the teatime set. In start order.
 */
export function districtCards(events: readonly TownEvent[], minutes: number): TownEvent[] {
  const cards: TownEvent[] = [];
  const groups = new Map<string, TownEvent[]>();
  for (const event of events) {
    if (!event.outing) continue;
    const group = DISTRICT_CARDS[event.outing].group;
    if (!group) cards.push(event);
    else groups.set(group, [...(groups.get(group) ?? []), event]);
  }
  for (const sets of groups.values()) {
    const byStart = [...sets].sort((a, b) => a.start - b.start);
    cards.push(
      byStart.find((set) => eventStatus(set, minutes) === LIVE) ??
        byStart.find((set) => eventStatus(set, minutes).startsWith('Later')) ??
        byStart[0],
    );
  }
  // A stable sort: outings that start together keep the events list's order.
  return cards.sort((a, b) => a.start - b.start);
}

export default function TownEvents({
  events,
  minutes,
  onVisit,
  football,
  evening,
  day,
  skaters,
  places,
  onFollow,
  attending,
}: {
  events: TownEvent[];
  minutes: number;
  onVisit: (plot: string, eventId: string) => void;
  football: FootballState;
  evening?: Evening;
  day?: number;
  skaters?: number;
  places?: Place[];
  onFollow?: (id: string) => void;
  /** Neighbors at each event right now, by event id: a live Riverside card counts them. */
  attending?: ReadonlyMap<string, number>;
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
  // Today's five first, as they come. Skating waits at the end of the list, and joins the live
  // cards while it is on; so does a live Riverside card, just after it. The rest of the Riverside
  // follows today's five, in start order.
  const today = events.filter((event) => !event.outing);
  const district = districtCards(events, minutes);
  const firstLater = today.findIndex((event) => eventStatus(event, minutes) !== LIVE);
  const splice = firstLater >= 0 ? firstLater : today.length;
  const liveDistrict = district.filter((event) => eventStatus(event, minutes) === LIVE);
  const skatingLive = day !== undefined && !!skatingCard(minutes, day)?.live && firstLater >= 0;
  const cards: (TownEvent | null)[] = [
    ...today.slice(0, splice),
    ...(skatingLive ? [null] : []),
    ...liveDistrict,
    ...today.slice(splice),
    ...district.filter((event) => !liveDistrict.includes(event)),
    ...(skatingLive ? [] : [null]),
  ];
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
      {places && day !== undefined && onFollow && (
        <SeasonalErrandCard
          places={places}
          minutes={minutes}
          day={day}
          onFollow={onFollow}
          onVisit={(plot) => onVisit(plot, 'seasonal-errand')}
        />
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
      {cards.map((event) => {
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
        const live = eventStatus(event, minutes) === LIVE;
        const Icon = event.outing
          ? DISTRICT_CARDS[event.outing].icon
          : event.venue.kind === 'zoo'
            ? PawPrint
            : event.venue.kind === 'cinema'
              ? Film
              : event.venue.kind === 'stage'
                ? Music2
                : Sun;
        // Who is at a live Riverside outing, only while someone is; never a promise of a crowd.
        const there = live && event.outing ? (attending?.get(event.id) ?? 0) : 0;
        const group = event.outing && DISTRICT_CARDS[event.outing].group;
        return (
          <button
            className={`event-card ${live ? 'is-live' : ''}`}
            key={group ?? event.id}
            onClick={() => onVisit(event.venue.plot, event.id)}
            aria-label={`Visit ${event.venue.name}: ${event.name}${there ? `, ${there} there` : ''}`}
          >
            <span className="event-symbol">
              <Icon size={20} />
            </span>
            <span className="event-copy">
              <span className="event-time">
                {live && <i className="live-dot" />} {eventStatus(event, minutes)} ·{' '}
                {timeLabel(event.start)}–{timeLabel(event.end)}
                {there > 0 && ` · ${there} there`}
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
