import { ArrowUpRight, BookOpen } from 'lucide-react';
import {
  FORK_PLOT,
  type EveningTale,
  type LanternHour,
  type LanternRegister,
} from '../lib/lanterns';
import { EVENING_COPY, lanternHourStatus } from '../lib/evening-copy';
import type { Place } from '../lib/schema';
import LanternGlyph from './LanternGlyph';
import '../stories.css';

export type Evening = {
  hour: LanternHour;
  tale?: EveningTale;
  register: LanternRegister;
  places: readonly Place[];
};

/** "This evening" in the Events panel: Lantern hour, then tonight's tale. */
export default function EveningNote({
  hour,
  tale,
  register,
  places,
  onVisit,
}: Evening & { onVisit: (plot: string, id: string) => void }) {
  const status = lanternHourStatus(hour);
  const lighting = hour.phase === 'lighting';
  const told = tale && places.find((place) => place.id === tale.placeId);
  return (
    <>
      <p className="eyebrow evening-eyebrow">{EVENING_COPY.eyebrow}</p>
      <button
        className={`event-card evening-card ${lighting ? 'is-live' : ''}`}
        onClick={() => onVisit(FORK_PLOT, 'lantern-hour')}
        aria-label={`${EVENING_COPY.visitFork}: ${[status.sentence, status.detail].filter(Boolean).join(' ')}`}
      >
        <span className="event-symbol">
          <LanternGlyph lit={hour.phase !== 'waiting' && hour.total > 0} />
        </span>
        <span className="event-copy">
          <span className="event-time">
            {lighting ? (
              <>
                <i className="live-dot" /> Happening now
              </>
            ) : (
              status.detail || status.sentence
            )}
          </span>
          <strong>{EVENING_COPY.lanternTitle}</strong>
          <span className="evening-body">
            {register.total ? EVENING_COPY.lanternBody(register.total) : status.sentence}
          </span>
          <span>
            {EVENING_COPY.visitFork} <ArrowUpRight size={12} />
          </span>
        </span>
      </button>
      {told && (
        <div className="event-card evening-card tale-card">
          <span className="event-symbol">
            <BookOpen size={18} />
          </span>
          <div className="event-copy">
            <strong>{EVENING_COPY.taleTitle(told.name)}</strong>
            <blockquote className="tale-quote">{told.story.trim()}</blockquote>
            <button className="text-button" onClick={() => onVisit(told.plot, 'tale')}>
              {EVENING_COPY.visitPlace(told.name)} <ArrowUpRight size={12} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
