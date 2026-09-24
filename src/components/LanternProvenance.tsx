import type { EveningTale, LanternRegister } from '../lib/lanterns';
import { lanternCaption } from '../lib/evening-copy';
import type { Place } from '../lib/schema';
import '../stories.css';

/** A house's place in the town's history, on its place card. Drafts have none. */
export default function LanternProvenance({
  register,
  placeId,
  tale,
  places,
}: {
  register: LanternRegister;
  placeId: string;
  tale?: EveningTale;
  places: readonly Place[];
}) {
  const caption = lanternCaption(
    register,
    placeId,
    (id) => places.find((place) => place.id === id)?.name ?? id,
  );
  if (!caption) return null;
  const told = tale?.placeId === placeId;
  return (
    <>
      <p className="lantern-provenance">
        <span className="eyebrow">{caption.label}</span>
        {caption.detail && (
          <>
            {' '}
            <span aria-hidden="true">·</span> {caption.detail}
          </>
        )}
      </p>
      {(caption.newest || told) && (
        <p className="lantern-badges">
          {caption.newest && (
            <span className="lantern-badge is-newest" title={caption.newestDetail}>
              Newest neighbor
            </span>
          )}
          {told && <span className="lantern-badge is-tale">Tonight's tale</span>}
        </p>
      )}
    </>
  );
}
