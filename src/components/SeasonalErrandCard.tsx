import {
  ArrowUpRight,
  CupSoda,
  Footprints,
  ShoppingBasket,
  Sprout,
  ThermometerSnowflake,
} from 'lucide-react';
import { seasonalErrandCard } from '../lib/errand-copy';
import type { Place } from '../lib/schema';
import '../errands.css';

const icons = {
  seedlings: Sprout,
  lemonade: CupSoda,
  harvest: ShoppingBasket,
  thermos: ThermometerSnowflake,
};

/** A quiet daily round beside the other Events cards, with separate keyboard actions for the
 * actual carrier and the destination. The planner supplies every name, time and live state. */
export default function SeasonalErrandCard({
  places,
  minutes,
  day,
  onFollow,
  onVisit,
}: {
  places: Place[];
  minutes: number;
  day: number;
  onFollow: (id: string) => void;
  onVisit: (plot: string) => void;
}) {
  const card = seasonalErrandCard(places, minutes, day);
  const Icon = icons[card.ritual.kind];
  const description = `${card.ritual.name}. ${card.status}${card.time ? `, ${card.time.replace('–', ' to ')} town time` : ''}. ${card.body}`;
  return (
    <article
      className={`event-card seasonal-errand-card${card.live ? ' is-live' : ''}`}
      aria-label={card.ritual.name}
    >
      <span className="event-symbol" aria-hidden="true">
        <Icon size={20} />
      </span>
      <div className="event-copy">
        <span className="event-time">
          {card.live && <i className="live-dot" aria-hidden="true" />} {card.status}
          {card.time && <> · {card.time}</>}
        </span>
        <strong>{card.ritual.name}</strong>
        <p className="errand-route">{card.route}</p>
        <p className="errand-body">{card.body}</p>
        <div className="errand-actions">
          {card.canFollow && card.residentId && (
            <button
              className="text-button"
              onClick={() => onFollow(card.residentId!)}
              aria-label={`Follow ${card.residentName}: ${description}`}
            >
              <Footprints size={13} aria-hidden="true" /> Follow {card.residentName}
            </button>
          )}
          <button
            className="text-button"
            onClick={() => onVisit(card.ritual.delivery.plot)}
            aria-label={`Visit ${card.ritual.delivery.name}: ${description}`}
          >
            Visit {card.ritual.delivery.name} <ArrowUpRight size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
