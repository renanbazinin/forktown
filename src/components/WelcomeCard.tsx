import { ArrowRight, X } from 'lucide-react';
import BrandMark from './BrandMark';
import { WELCOME_COPY } from '../lib/brand';

// A quiet first-visit note. It never takes focus; every action also dismisses it.
export default function WelcomeCard({
  neighbors,
  newest,
  onFindWayIn,
  onVisitFork,
  onDismiss,
}: {
  neighbors: number;
  newest?: string;
  onFindWayIn: () => void;
  onVisitFork?: () => void;
  onDismiss: () => void;
}) {
  return (
    <aside className="welcome-card" aria-labelledby="welcome-title">
      <div className="welcome-card-heading">
        <BrandMark size={32} tile />
        <span className="eyebrow">{WELCOME_COPY.eyebrow}</span>
      </div>
      <h2 id="welcome-title">{WELCOME_COPY.title}</h2>
      <p>{WELCOME_COPY.body(neighbors, newest)}</p>
      <small>{WELCOME_COPY.note}</small>
      <div className="welcome-card-actions">
        <button
          className="button button-primary"
          onClick={() => {
            onFindWayIn();
            onDismiss();
          }}
        >
          {WELCOME_COPY.findWayIn} <ArrowRight size={15} />
        </button>
        {onVisitFork && (
          <button
            className="text-button"
            onClick={() => {
              onVisitFork();
              onDismiss();
            }}
          >
            {WELCOME_COPY.visitFork}
          </button>
        )}
        {/* Last in tab order, drawn in the top corner. */}
        <button className="icon-button" aria-label={WELCOME_COPY.close} onClick={onDismiss}>
          <X size={17} />
        </button>
      </div>
    </aside>
  );
}
