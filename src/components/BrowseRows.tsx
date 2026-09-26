import { memo } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import BuildingPreview from './BuildingPreview';
import ResidentPreview from './ResidentPreview';
import { PLOT_COPY } from '../lib/brand';
import { isFoundingPlace } from '../lib/places';
import type { Place, Resident } from '../lib/schema';

// The directory's rows take only what they show, so a clock tick that changes nothing in a row
// skips it: an open list of a full town stays cheap while the map animates behind it.

export const PlaceRow = memo(function PlaceRow({
  place,
  onSelect,
}: {
  place: Place;
  onSelect: (plot: string, focus: boolean) => void;
}) {
  return (
    <button className="browse-row" onClick={() => onSelect(place.plot, true)}>
      <BuildingPreview place={place} size={48} />
      <span>
        <strong>{place.name}</strong>
        <small>
          {place.plot} · {isFoundingPlace(place) ? place.resident.name : `@${place.creator}`}
        </small>
      </span>
      <ArrowRight size={14} />
    </button>
  );
});

export const PlotRow = memo(function PlotRow({
  plot,
  onSelect,
}: {
  plot: string;
  onSelect: (plot: string, focus: boolean) => void;
}) {
  return (
    <button className="browse-row" onClick={() => onSelect(plot, true)}>
      <span className="plot-symbol">
        <Plus size={19} />
      </span>
      <span>
        <strong>Plot {plot}</strong>
        <small>{PLOT_COPY.row}</small>
      </span>
      <ArrowRight size={14} />
    </button>
  );
});

export const NeighborRow = memo(function NeighborRow({
  id,
  resident,
  activity,
  onFollow,
}: {
  id: string;
  resident: Resident;
  activity: string;
  onFollow: (id: string) => void;
}) {
  return (
    <button className="resident-link" onClick={() => onFollow(id)}>
      <ResidentPreview resident={resident} size={42} />
      <span>
        <strong>{resident.name}</strong>
        <small>{activity}</small>
      </span>
      <ArrowRight size={14} />
    </button>
  );
});
