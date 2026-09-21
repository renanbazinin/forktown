import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Code2,
  Compass,
  ExternalLink,
  Music2,
  Pause,
  Play,
  Plus,
  Search,
  Share2,
  Sprout,
  Users,
  X,
} from 'lucide-react';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/fraunces/500.css';
import City, { type CityHandle } from './components/City';
import BuildingPreview from './components/BuildingPreview';
import ResidentPreview from './components/ResidentPreview';
import SignPreview from './components/SignPreview';
import Contribute from './components/Contribute';
import HouseFiles from './components/HouseFiles';
import Modal from './components/Modal';
import TownEvents from './components/TownEvents';
import { HOUSE_PLOTS, eventsForDay, venueAt, eventStatus } from './lib/events';
import { isFoundingPlace, places, repositoryUrl } from './lib/places';
import { TYPE_LABELS, type Place } from './lib/schema';
import { localSaveAvailable } from './lib/local-save';
import { useTownClock } from './lib/use-town-clock';
import { simulateResidents, residentActivityLabel, timeLabel } from './lib/simulation';

type Panel = 'places' | 'neighbors' | 'events';
function initialSelection() {
  return (
    places.find(
      (place) => place.id === new URLSearchParams(window.location.hash.slice(1)).get('place'),
    )?.plot ?? null
  );
}

export default function App() {
  const city = useRef<CityHandle>(null);
  const exploreButton = useRef<HTMLButtonElement>(null);
  const panelTitle = useRef<HTMLHeadingElement>(null);
  const [selectedPlot, setSelectedPlot] = useState<string | null>(initialSelection);
  const [panel, setPanel] = useState<Panel | null>(() => (initialSelection() ? 'places' : null));
  const [followed, setFollowed] = useState<string | null>(null);
  const [showPlots, setShowPlots] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'places' | 'empty'>('places');
  const [modal, setModal] = useState<'contribute' | 'guide' | 'files' | null>(null);
  const [sourceId, setSourceId] = useState<string>();
  const [buildPlot, setBuildPlot] = useState<string>();
  const [draft, setDraft] = useState<Place | null>(null);
  const [toast, setToast] = useState('');
  const [shared, setShared] = useState(false);
  const clock = useTownClock();
  const night = clock.minutes < 360 || clock.minutes >= 1200;
  const events = useMemo(() => eventsForDay(clock.day), [clock.day]);
  const displayPlaces = useMemo(
    () =>
      draft && !places.some((place) => place.id === draft.id || place.plot === draft.plot)
        ? [...places, draft]
        : places,
    [draft, places],
  );
  const residents = useMemo(
    () => simulateResidents(displayPlaces, clock.minutes, clock.day),
    [displayPlaces, clock.minutes, clock.day],
  );
  const selected = displayPlaces.find((place) => place.plot === selectedPlot);
  const selectedResident = residents.find((resident) => resident.id === selected?.id);
  const selectedVenue = selectedPlot ? venueAt(selectedPlot) : undefined;
  const selectedEvent = events.find((event) => event.venue.id === selectedVenue?.id);
  const available = HOUSE_PLOTS.filter(
    (plot) => !displayPlaces.some((place) => place.plot === plot.id),
  );
  const filteredPlaces = displayPlaces.filter((place) =>
    `${place.name} ${place.creator} ${place.resident.name} ${place.plot}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredPlots = available.filter((plot) =>
    plot.id.toLowerCase().includes(search.toLowerCase()),
  );
  const liveEvent = events.find(
    (event) => clock.minutes >= event.start && clock.minutes < event.end,
  );

  const select = useCallback((plotId: string | null, focus = false) => {
    city.current?.stopFollowing();
    setFollowed(null);
    setSelectedPlot(plotId);
    setShared(false);
    if (plotId) setPanel('places');
    const place = places.find((place) => place.plot === plotId);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${place ? `#place=${encodeURIComponent(place.id)}` : ''}`,
    );
    if (plotId && focus) city.current?.focus(plotId);
  }, []);
  const closePanel = useCallback(() => {
    setPanel(null);
    setSelectedPlot(null);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    exploreButton.current?.focus();
  }, []);
  useEffect(() => {
    const listener = () => {
      const selection = initialSelection();
      setSelectedPlot(selection);
      if (selection) setPanel('places');
    };
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  useEffect(() => {
    if (panel) panelTitle.current?.focus();
  }, [panel, selectedPlot]);
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panel && !modal) closePanel();
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [panel, modal, closePanel]);
  useEffect(() => {
    if (draft && places.some((place) => place.id === draft.id || place.plot === draft.plot))
      setDraft(null);
  }, [draft, places]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  function startBuilding(plot?: string) {
    if (!localSaveAvailable) {
      setModal('guide');
      return;
    }
    if (!available.length && !draft) {
      setToast('All house plots are taken.');
      return;
    }
    setBuildPlot(plot);
    setModal('contribute');
  }
  function follow(id: string) {
    setFollowed(id);
    setPanel(null);
    setSelectedPlot(null);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
  async function share() {
    if (!selected) return;
    const url = new URL(window.location.href);
    url.hash = `place=${encodeURIComponent(selected.id)}`;
    try {
      await navigator.clipboard.writeText(url.href);
      setShared(true);
      setToast('Link copied.');
    } catch {
      setToast('Copy the browser address to share this home.');
    }
  }
  const closeBuilder = useCallback(() => setModal(null), []);
  const preview = useCallback(
    (place: Place) => {
      setDraft(place);
      select(place.plot, true);
    },
    [select],
  );
  const heading =
    selected?.name ??
    selectedVenue?.name ??
    (selectedPlot
      ? `Plot ${selectedPlot}`
      : panel === 'neighbors'
        ? 'Neighbors'
        : panel === 'events'
          ? 'Today in town'
          : 'Explore');

  return (
    <main className={`town-app ${night ? 'town-app-night' : ''}`}>
      <h1 className="sr-only">Forktown — a town built together</h1>
      <City
        ref={city}
        places={displayPlaces}
        selectedPlot={selectedPlot}
        onSelect={(plot) => select(plot, true)}
        night={night}
        showPlots={showPlots}
        residents={residents}
        events={events}
        minutes={clock.minutes}
        followed={followed}
        onStopFollowing={() => setFollowed(null)}
        onResidentSelect={follow}
      />

      <header className="map-header">
        <button
          className="town-wordmark"
          aria-label="Forktown home"
          onClick={() => {
            select(null);
            setPanel(null);
            city.current?.reset();
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          forktown<span className="brand-dot">.</span>
        </button>
        <div className="map-clock" title="UTC-synced · One real minute is one town hour">
          <span className={clock.playing ? 'live-dot' : 'paused-dot'} />
          <time>{timeLabel(clock.minutes)}</time>
          <button
            aria-label={clock.playing ? 'Pause town' : 'Return to live town'}
            onClick={() => clock.setPlaying(!clock.playing)}
          >
            {clock.playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </div>
        <button className="way-in" onClick={() => setModal('guide')}>
          Find your way in <ArrowRight size={16} />
        </button>
      </header>

      <nav className="explore-dock" aria-label="Town tools">
        <button
          ref={exploreButton}
          aria-label="Explore places"
          title="Explore places"
          aria-expanded={panel === 'places'}
          aria-controls="town-panel"
          onClick={() => {
            if (panel === 'places') closePanel();
            else {
              select(null);
              setPanel('places');
            }
          }}
        >
          <Compass size={19} />
          <span>Explore</span>
        </button>
        <button
          aria-label="Meet the neighbors"
          title="Neighbors"
          aria-expanded={panel === 'neighbors'}
          aria-controls="town-panel"
          onClick={() => {
            if (panel === 'neighbors') closePanel();
            else {
              select(null);
              setPanel('neighbors');
            }
          }}
        >
          <Users size={19} />
        </button>
        <button
          aria-label="Town events"
          title="Events"
          aria-expanded={panel === 'events'}
          aria-controls="town-panel"
          onClick={() => {
            if (panel === 'events') closePanel();
            else {
              select(null);
              setPanel('events');
            }
          }}
        >
          <Music2 size={19} />
          {liveEvent && <i className="event-indicator" />}
        </button>
      </nav>

      {draft && (
        <div className="draft-chip">
          <span>Unsaved preview</span>
          <button onClick={() => startBuilding(draft.plot)}>Save</button>
          <button
            aria-label="Remove preview"
            onClick={() => {
              if (selectedPlot === draft.plot) closePanel();
              setDraft(null);
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {panel && (
        <section className="town-panel" id="town-panel" aria-labelledby="panel-title">
          <div className="town-panel-header">
            {selectedPlot && (
              <button
                className="icon-button"
                aria-label="Back to places"
                onClick={() => select(null)}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 id="panel-title" ref={panelTitle} tabIndex={-1}>
              {heading}
            </h2>
            <button className="icon-button" aria-label="Close panel" onClick={closePanel}>
              <X size={19} />
            </button>
          </div>
          <div className="town-panel-content">
            {selectedVenue && selectedEvent ? (
              <div className="venue-info">
                <span className="quiet-label">PUBLIC SPACE · {selectedVenue.plot}</span>
                <div className="venue-program">
                  <span className="eyebrow">{eventStatus(selectedEvent, clock.minutes)}</span>
                  <h3>{selectedEvent.name}</h3>
                  <p>{selectedEvent.description}</p>
                  <strong>
                    {timeLabel(selectedEvent.start)}–{timeLabel(selectedEvent.end)}
                  </strong>
                </div>
                <p className="muted-copy">Reserved for everyone. A new lineup each town day.</p>
              </div>
            ) : selected ? (
              <div className="home-info">
                <div className={`home-illustration ${night ? 'night' : ''}`}>
                  <BuildingPreview place={selected} size={145} night={night} />
                  <span>
                    {TYPE_LABELS[selected.building]} · {selected.plot}
                  </span>
                </div>
                <div className="home-info-body">
                  {isFoundingPlace(selected) ? (
                    <span className="muted-copy">Founding neighbor</span>
                  ) : (
                    <a
                      className="home-credit"
                      href={`https://github.com/${selected.creator}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      @{selected.creator} <ExternalLink size={12} />
                    </a>
                  )}
                  <p className="home-story">{selected.story}</p>
                  {selectedResident && (
                    <button className="resident-link" onClick={() => follow(selected.id)}>
                      <ResidentPreview resident={selected.resident} size={40} />
                      <span>
                        <strong>{selected.resident.name}</strong>
                        <small>{residentActivityLabel(selectedResident)}</small>
                      </span>
                      <ArrowRight size={15} />
                    </button>
                  )}
                  {selected.sign.mode !== 'none' && <SignPreview sign={selected.sign} />}
                  <div className="home-actions">
                    {draft?.id === selected.id ? (
                      <button
                        className="button button-primary"
                        onClick={() => startBuilding(selected.plot)}
                      >
                        Save my place
                      </button>
                    ) : (
                      <>
                        <button className="text-button" onClick={share}>
                          {shared ? <Check size={14} /> : <Share2 size={14} />} Share
                        </button>
                        <button
                          className="text-button"
                          onClick={() => {
                            setSourceId(selected.id);
                            setModal('files');
                          }}
                        >
                          <Code2 size={14} /> View JSON
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : selectedPlot ? (
              <div className="empty-corner">
                <Sprout size={36} strokeWidth={1.3} />
                <p>A little room for your idea.</p>
                <button
                  className="button button-primary"
                  onClick={() => startBuilding(selectedPlot)}
                >
                  <Plus size={15} />
                  {localSaveAvailable ? 'Build here' : 'How to contribute'}
                </button>
              </div>
            ) : panel === 'events' ? (
              <TownEvents
                events={events}
                minutes={clock.minutes}
                onVisit={(plot) => select(plot, true)}
              />
            ) : panel === 'neighbors' ? (
              <div className="resident-directory">
                {residents.map((resident) => (
                  <button
                    className="resident-link"
                    key={resident.id}
                    onClick={() => follow(resident.id)}
                  >
                    <ResidentPreview resident={resident.resident} size={42} />
                    <span>
                      <strong>{resident.resident.name}</strong>
                      <small>{residentActivityLabel(resident)}</small>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="browse-controls">
                  <label className="search-field">
                    <Search size={15} />
                    <input
                      aria-label="Search the town"
                      placeholder="Find a place or neighbor"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    {search && (
                      <button aria-label="Clear search" onClick={() => setSearch('')}>
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  <div className="directory-tabs">
                    <button
                      className={filter === 'places' ? 'active' : ''}
                      aria-pressed={filter === 'places'}
                      onClick={() => {
                        setFilter('places');
                        setSearch('');
                      }}
                    >
                      Places <span>{displayPlaces.length}</span>
                    </button>
                    <button
                      className={filter === 'empty' ? 'active' : ''}
                      aria-pressed={filter === 'empty'}
                      onClick={() => {
                        setFilter('empty');
                        setSearch('');
                        setShowPlots(true);
                      }}
                    >
                      Open plots <span>{available.length}</span>
                    </button>
                  </div>
                </div>
                <div className="browse-list">
                  {filter === 'places'
                    ? filteredPlaces.map((place) => (
                        <button
                          className="browse-row"
                          key={place.id}
                          onClick={() => select(place.plot, true)}
                        >
                          <BuildingPreview place={place} size={48} />
                          <span>
                            <strong>{place.name}</strong>
                            <small>
                              {place.plot} ·{' '}
                              {isFoundingPlace(place) ? place.resident.name : `@${place.creator}`}
                            </small>
                          </span>
                          <ArrowRight size={14} />
                        </button>
                      ))
                    : filteredPlots.map((plot) => (
                        <button
                          className="browse-row"
                          key={plot.id}
                          onClick={() => select(plot.id, true)}
                        >
                          <span className="plot-symbol">
                            <Plus size={19} />
                          </span>
                          <span>
                            <strong>Plot {plot.id}</strong>
                            <small>Available</small>
                          </span>
                          <ArrowRight size={14} />
                        </button>
                      ))}
                </div>
                {(filter === 'places' ? filteredPlaces.length : filteredPlots.length) === 0 && (
                  <p className="empty-search">No matches. Try another name.</p>
                )}
                <label className="map-label-setting">
                  <input
                    type="checkbox"
                    checked={showPlots}
                    onChange={(event) => setShowPlots(event.target.checked)}
                  />{' '}
                  Show plot labels
                </label>
              </>
            )}
          </div>
        </section>
      )}

      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {modal === 'contribute' && localSaveAvailable && (
        <Contribute plot={buildPlot} places={places} onClose={closeBuilder} onPreview={preview} />
      )}
      {modal === 'files' && (
        <Modal title="House files" onClose={() => setModal(null)} wide>
          <HouseFiles initialId={sourceId} />
        </Modal>
      )}
      {modal === 'guide' && (
        <Modal title="Make yourself at home." onClose={() => setModal(null)}>
          <div className="welcome-guide">
            <p>One house. One neighbor. Your first contribution.</p>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>Fork the town</strong>
                  <p>Clone your copy and run it locally.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Make a place</strong>
                  <p>Design your house. Save its JSON file.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Join the neighborhood</strong>
                  <p>
                    Commit, push, and open a pull request. After review and merge, your place joins
                    the town.
                  </p>
                </div>
              </li>
            </ol>
            {localSaveAvailable ? (
              <button className="button button-primary" onClick={() => startBuilding()}>
                Build a place <ArrowRight size={16} />
              </button>
            ) : repositoryUrl ? (
              <a
                className="button button-primary"
                href={`${repositoryUrl}/fork`}
                target="_blank"
                rel="noreferrer"
              >
                Fork on GitHub <ExternalLink size={15} />
              </a>
            ) : (
              <p className="muted-copy">Run your own local copy to start building.</p>
            )}
            <div className="welcome-links">
              <button
                className="text-button"
                onClick={() => {
                  setSourceId(undefined);
                  setModal('files');
                }}
              >
                <Code2 size={14} /> House files
              </button>
              {repositoryUrl && (
                <a
                  className="text-button"
                  href={`${repositoryUrl}/blob/HEAD/CONTRIBUTING.md`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Contributor guide <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
