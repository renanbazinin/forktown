// Who is at a Riverside outing now, in the one row shape every district panel uses (the market's
// first): an eyebrow, then a NeighborRow each, the neighbor's figure, name and what they are doing,
// a link that follows them. Never folded: two neighbors who share a name are two people to follow,
// and their figures tell them apart.
import type { ResidentState } from '../../lib/simulation';
import { NeighborRow } from '../BrowseRows';

const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/**
 * By name, in English collation whatever the viewer's language (so every visitor reads the same
 * order, and lowercase names sit among the rest), then by id in code-unit order.
 */
export const byNeighborName = (a: ResidentState, b: ResidentState) =>
  a.resident.name.localeCompare(b.resident.name, 'en') || byCodeUnit(a.id, b.id);

export default function NeighborList({
  eyebrow,
  residents,
  activity,
  onFollow,
}: {
  eyebrow: string;
  residents: readonly ResidentState[];
  /** What a neighbor is doing there, by their outing's phase. */
  activity: (resident: ResidentState) => string;
  onFollow: (id: string) => void;
}) {
  if (!residents.length) return null;
  return (
    <div className="venue-program">
      <span className="eyebrow">{eyebrow}</span>
      {[...residents].sort(byNeighborName).map((resident) => (
        <NeighborRow
          key={resident.id}
          id={resident.id}
          resident={resident.resident}
          activity={activity(resident)}
          onFollow={onFollow}
        />
      ))}
    </div>
  );
}
