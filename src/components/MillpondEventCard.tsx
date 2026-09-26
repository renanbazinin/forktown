import { ArrowUpRight, Snowflake } from 'lucide-react';
import { MILLPOND_VENUE } from '../lib/millpond';
import { skatingCard } from '../lib/millpond-copy';

// Winter skating is not a scheduled event (it follows the ice), so it gets its own card in the
// generic event markup. It renders only on skating days and never counts a crowd it cannot see.
export default function MillpondEventCard({
  minutes,
  day,
  skaters = 0,
  onVisit,
}: {
  minutes: number;
  day: number;
  skaters?: number;
  onVisit: (plot: string, eventId: string) => void;
}) {
  const card = skatingCard(minutes, day, skaters);
  if (!card) return null;
  const onIce = `${card.skaters} ${card.skaters === 1 ? 'neighbor' : 'neighbors'} on the ice`;
  return (
    <button
      className={`event-card ${card.live ? 'is-live' : ''}`}
      onClick={() => onVisit(MILLPOND_VENUE.plot, MILLPOND_VENUE.id)}
      aria-label={`Visit ${MILLPOND_VENUE.name}: ${card.name}, ${card.status.toLowerCase()}, ${card.time.replace('–', ' to ')}${card.skaters > 0 ? `, ${onIce}` : ''}`}
    >
      <span className="event-symbol">
        <Snowflake size={20} />
      </span>
      <span className="event-copy">
        <span className="event-time">
          {card.live && <i className="live-dot" />} {card.status} · {card.time}
          {card.skaters > 0 && ` · ${card.skaters} on the ice`}
        </span>
        <strong>{card.name}</strong>
        <span>
          {MILLPOND_VENUE.name} <ArrowUpRight size={12} />
        </span>
      </span>
    </button>
  );
}
