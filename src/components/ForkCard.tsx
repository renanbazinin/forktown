import { ArrowRight } from 'lucide-react';
import type { EveningTale, LanternEntry, LanternHour, LanternRegister } from '../lib/lanterns';
import { FORK_COPY, lanternHourStatus } from '../lib/evening-copy';
import type { Place } from '../lib/schema';
import LanternGlyph from './LanternGlyph';
import '../stories.css';

export default function ForkCard({
  register,
  hour,
  tale,
  places,
  onVisit,
  onFindWayIn,
}: {
  register: LanternRegister;
  hour: LanternHour;
  tale?: EveningTale;
  places: readonly Place[];
  onVisit: (plot: string) => void;
  onFindWayIn: () => void;
}) {
  const status = lanternHourStatus(hour);
  const placeOf = (id: string) => places.find((place) => place.id === id);
  const told = tale && placeOf(tale.placeId);
  const founders = register.entries.filter((entry) => entry.founding);
  const neighbors = register.entries.filter((entry) => !entry.founding);
  const row = (entry: LanternEntry) => {
    const place = placeOf(entry.id);
    if (!place) return null;
    return (
      <li key={entry.id}>
        <button
          className="lantern-row"
          onClick={() => onVisit(place.plot)}
          aria-label={`Visit ${place.name}${entry.number ? `, lantern No. ${entry.number}` : ''}`}
        >
          <LanternGlyph lit={entry.index < hour.lit} />
          <span>
            <strong>{place.name}</strong>
            <small>{entry.founding ? place.resident.name : `@${place.creator}`}</small>
          </span>
          {entry.id === register.newest && <span className="lantern-badge is-newest">Newest</span>}
          {entry.number !== undefined && <span className="lantern-number">{entry.number}</span>}
        </button>
      </li>
    );
  };
  return (
    <div className="fork-card">
      <p className="eyebrow">{FORK_COPY.eyebrow}</p>
      <p className="fork-lede">{FORK_COPY.lede(register.total)}</p>
      <div className={`fork-hour is-${hour.phase}`}>
        <LanternGlyph lit={hour.phase !== 'waiting' && hour.total > 0} scale={3} />
        <div>
          <p role="status">{status.sentence}</p>
          {status.detail && <p className="fork-hour-detail">{status.detail}</p>}
        </div>
      </div>
      {told && (
        <section className="fork-tale" aria-labelledby="fork-tale-title">
          <p className="eyebrow">{FORK_COPY.taleEyebrow}</p>
          <h3 id="fork-tale-title">
            <button className="text-button" onClick={() => onVisit(told.plot)}>
              {told.name}
            </button>
          </h3>
          <blockquote className="tale-quote">{told.story.trim()}</blockquote>
          <p className="tale-credit">
            — {told.resident.name},{' '}
            {register.byId.get(told.id)?.founding ? 'a founding neighbor' : `@${told.creator}`}
          </p>
        </section>
      )}
      {founders.length > 0 && (
        <>
          <h3 className="lantern-heading">{FORK_COPY.foundersHeading}</h3>
          <ul className="lantern-list">{founders.map(row)}</ul>
        </>
      )}
      {neighbors.length > 0 && (
        <>
          <h3 className="lantern-heading">{FORK_COPY.neighborsHeading(register.ordered)}</h3>
          {register.ordered ? (
            <ol className="lantern-list" start={register.founders + 1}>
              {neighbors.map(row)}
            </ol>
          ) : (
            <>
              <ul className="lantern-list">{neighbors.map(row)}</ul>
              <p className="fork-note">{FORK_COPY.shallowNote}</p>
            </>
          )}
        </>
      )}
      <p className="fork-footer">{FORK_COPY.footer}</p>
      <button className="button button-primary" onClick={onFindWayIn}>
        {FORK_COPY.cta} <ArrowRight size={16} />
      </button>
    </div>
  );
}
