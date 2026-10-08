import type { DistrictPanelProps } from './district/cards';

// Moon Harvest Farm's panel. Its Harvest Fair section (agent D, SPEC §4.3) reads the props: the
// dates, today's program, guests by name only while they are there, and "Next: Autumn 23." out of
// season.
export default function FarmInfo(_props: DistrictPanelProps) {
  return (
    <div className="venue-info">
      <span className="quiet-label">PUBLIC SPACE · S4–T9 · 12 PLOTS</span>
    </div>
  );
}
