import {
  Armchair,
  ArrowUpRight,
  BookOpen,
  Brush,
  BriefcaseBusiness,
  DoorOpen,
  Eye,
  Footprints,
  House,
  Moon,
  MoonStar,
  Sprout,
} from 'lucide-react';
import type { ResidentState } from '../lib/simulation';
import { residentActivityLabel } from '../lib/simulation';
import ResidentPreview from './ResidentPreview';
// One copy of the activity labels, kept with residentActivityLabel.
export { ACTIVITY_LABELS } from '../lib/simulation';
const icons = { stroll: Footprints, work: BriefcaseBusiness, home: House, sleep: Moon };
const spotIcons = {
  door: DoorOpen,
  bench: Armchair,
  porch: Armchair,
  step: Armchair,
  tree: BookOpen,
  flowers: Sprout,
  beds: Sprout,
  paving: Brush,
  gate: Eye,
  kerb: House,
};
/** The icon beside the label: what they are doing at home, or else the routine's own. */
function activityIcon(state: ResidentState) {
  if (state.lot?.stage === 'out' || state.lot?.stage === 'in') return DoorOpen;
  if (state.lot?.stage === 'from') return Footprints;
  if (state.lot) return state.nightPorch ? MoonStar : spotIcons[state.lot.spot];
  if (state.nightWalk) return MoonStar;
  return icons[state.activity];
}
export default function Neighbors({
  residents,
  followed,
  onFollow,
  onHome,
}: {
  residents: ResidentState[];
  followed: string | null;
  onFollow: (id: string | null) => void;
  onHome: (plot: string) => void;
}) {
  return (
    <section className="neighbors-section" aria-label="Meet the neighbors">
      <div className="neighbors-heading">
        <div>
          <span className="eyebrow">LITTLE LIVES, ALL AROUND YOU</span>
          <h2>Meet your neighbors.</h2>
        </div>
        <p>
          A morning at home. An afternoon wander.
          <br />A hello along the way.
        </p>
      </div>
      <div className="neighbor-grid">
        {residents.map((state) => {
          const Icon = activityIcon(state);
          return (
            <article
              className={`neighbor-card ${followed === state.id ? 'is-followed' : ''}`}
              key={state.id}
            >
              <div className="neighbor-identity">
                <div className="neighbor-portrait">
                  <ResidentPreview resident={state.resident} />
                </div>
                <div>
                  <h3>{state.resident.name}</h3>
                  <span>
                    {state.home.creator === 'forktown'
                      ? 'Founding neighbor'
                      : `@${state.home.creator}`}
                  </span>
                </div>
              </div>
              <p className="neighbor-activity">
                <Icon size={13} />
                {residentActivityLabel(state)}
              </p>
              <p className="neighbor-greeting">“{state.resident.greeting}”</p>
              <div className="neighbor-actions">
                <button
                  className="text-button"
                  aria-pressed={followed === state.id}
                  onClick={() => onFollow(followed === state.id ? null : state.id)}
                >
                  {followed === state.id ? 'Stop following' : 'Follow neighbor'}{' '}
                  <Footprints size={13} />
                </button>
                <button
                  className="text-button"
                  aria-label={`Visit ${state.resident.name}'s home`}
                  onClick={() => onHome(state.home.plot)}
                >
                  <House size={14} />
                  <ArrowUpRight size={12} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
