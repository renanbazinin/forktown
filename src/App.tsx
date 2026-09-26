import ZooInfo from './components/ZooInfo';
import FarmInfo from './components/FarmInfo';
import { FARM, isFarmPlot } from './lib/farm';
import MillpondInfo from './components/MillpondInfo';
import { isMillpondPlot, MILLPOND_VENUE } from './lib/millpond';
import TubeInfo from './components/TubeInfo';
import { isTubePlot, TUBE_VENUE } from './lib/tubes';
import { tubeStatus } from './lib/tube-traffic';
import { isZooPlot, ZOO_VENUE } from './lib/zoo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Code2,
  Compass,
  ExternalLink,
  Info,
  Music2,
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
import '@fontsource/space-mono/700.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/500-italic.css';
import City, { type CityHandle } from './components/City';
import BuildingPreview from './components/BuildingPreview';
import ResidentPreview from './components/ResidentPreview';
import SignPreview from './components/SignPreview';
import Contribute from './components/Contribute';
import HouseFiles from './components/HouseFiles';
import Modal from './components/Modal';
import Toast from './components/Toast';
import BrandMark, { LanternDot } from './components/BrandMark';
import WelcomeCard from './components/WelcomeCard';
import TownEvents from './components/TownEvents';
import ForkCard from './components/ForkCard';
import LanternProvenance from './components/LanternProvenance';
import Soundtrack from './components/Soundtrack';
import FootballMatch from './components/FootballMatch';
import CalendarClock from './components/CalendarClock';
import CinemaInfo from './components/CinemaInfo';
import { CINEMA_VENUE, isCinemaPlot, cinemaAt } from './lib/cinema';
import { footballAt, isFootballPlot, FOOTBALL_VENUE } from './lib/football';
import { trackForTown } from './music/score';
import {
  HOUSE_PLOTS,
  eventsForDay,
  venueAt,
  eventStatus,
  eventAtVenue,
  isEventLive,
} from './lib/events';
import { isFoundingPlace, latestArrival, places, repositoryUrl } from './lib/places';
import { GUIDE_COPY, PLOT_COPY, TITLE, WELCOME_KEY, shouldWelcome } from './lib/brand';
import { TYPE_LABELS, type Place } from './lib/schema';
import { localSaveAvailable } from './lib/local-save';
import { useTownClock } from './lib/use-town-clock';
import { useLanternTown } from './lib/use-lantern-town';
import { FORK_PLOT } from './lib/lanterns';
import { simulateResidents, residentActivityLabel, timeLabel } from './lib/simulation';

type Panel = 'places' | 'neighbors' | 'events';
// Keeps the welcome closed for this page load even when storage refuses the flag.
let welcomeDismissed = false;
function initialWelcome() {
  if (welcomeDismissed) return false;
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    // Blocked storage greets once per session.
  }
  return shouldWelcome(window.location.hash, storage);
}
function initialSelection() {
  if (new URLSearchParams(window.location.hash.slice(1)).get('venue') === 'fork') return FORK_PLOT;
  if (new URLSearchParams(window.location.hash.slice(1)).get('venue') === 'farm') return FARM.plot;
  if (new URLSearchParams(window.location.hash.slice(1)).get('venue') === 'millpond')
    return MILLPOND_VENUE.plot;
  if (new URLSearchParams(window.location.hash.slice(1)).get('venue') === 'tube')
    return TUBE_VENUE.plot;
  if (new URLSearchParams(window.location.hash.slice(1)).get('venue') === 'zoo')
    return ZOO_VENUE.plot;
  if (new URLSearchParams(window.location.hash.slice(1)).get('venue') === 'cinema')
    return CINEMA_VENUE.plot;
  if (new URLSearchParams(window.location.hash.slice(1)).get('venue') === 'football')
    return FOOTBALL_VENUE.plot;
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(() => (initialSelection() ? 'places' : null));
  const [followed, setFollowed] = useState<string | null>(null);
  const [showPlots, setShowPlots] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'places' | 'empty'>('places');
  const [modal, setModal] = useState<'contribute' | 'guide' | 'files' | null>(null);
  const [sourceId, setSourceId] = useState<string>();
  const [buildPlot, setBuildPlot] = useState<string>();
  const [draft, setDraft] = useState<Place | null>(null);
  const [toast, setToast] = useState<{ text: string; note?: boolean } | null>(null);
  const [shared, setShared] = useState(false);
  const [welcome, setWelcome] = useState(initialWelcome);
  const clock = useTownClock();
  const football = useMemo(() => footballAt(clock.minutes, clock.day), [clock.minutes, clock.day]);
  const [listening, setListening] = useState({ gain: 0, pan: 0 });
  const [cinemaListening, setCinemaListening] = useState({ gain: 0, pan: 0 });
  const cinema = useMemo(() => cinemaAt(clock.minutes, clock.day), [clock.minutes, clock.day]);
  const selectedFootball = isFootballPlot(selectedPlot ?? '');
  const selectedFarm = isFarmPlot(selectedPlot ?? '');
  const selectedMillpond = isMillpondPlot(selectedPlot ?? '');
  const selectedTube = isTubePlot(selectedPlot ?? '');
  const night = clock.minutes < 360 || clock.minutes >= 1200;
  const cinemaEvening = clock.minutes < 360;
  const events = useMemo(
    () => eventsForDay(clock.day, cinemaEvening ? 0 : 720),
    [clock.day, cinemaEvening],
  );
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
  const lanternTown = useLanternTown(places, clock.minutes, clock.day);
  const skaters = residents
    .filter((r) => r.event?.id === 'millpond' && r.event.phase === 'attending')
    .map((r) => r.resident.name);
  const selected = displayPlaces.find((place) => place.plot === selectedPlot);
  const selectedResident = residents.find((resident) => resident.id === selected?.id);
  const selectedVenue = selectedPlot ? venueAt(selectedPlot) : undefined;
  const selectedEvent = selectedVenue
    ? (events.find(
        (event) => event.venue.id === selectedVenue.id && event.id === selectedEventId,
      ) ?? eventAtVenue(events, selectedVenue.id, clock.minutes))
    : undefined;
  const selectedProgram = selectedEvent
    ? [
        selectedEvent,
        ...events.filter(
          (event) => event.venue.id === selectedVenue?.id && event !== selectedEvent,
        ),
      ]
    : [];
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
  const liveEvent = events.find((event) => isEventLive(event, clock.minutes));

  const select = useCallback((plotId: string | null, focus = false) => {
    city.current?.stopFollowing();
    setFollowed(null);
    setSelectedPlot(plotId);
    setSelectedEventId(null);
    setShared(false);
    if (plotId) setPanel('places');
    const place = places.find((place) => place.plot === plotId);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${place ? `#place=${encodeURIComponent(place.id)}` : isFarmPlot(plotId ?? '') ? '#venue=farm' : isMillpondPlot(plotId ?? '') ? '#venue=millpond' : isTubePlot(plotId ?? '') ? '#venue=tube' : isFootballPlot(plotId ?? '') ? '#venue=football' : isCinemaPlot(plotId ?? '') ? '#venue=cinema' : isZooPlot(plotId ?? '') ? '#venue=zoo' : plotId === FORK_PLOT ? '#venue=fork' : ''}`,
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
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  function startBuilding(plot?: string) {
    if (!localSaveAvailable) {
      setModal('guide');
      return;
    }
    if (!available.length && !draft) {
      setToast({ text: 'All house plots are taken.', note: true });
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
      setToast({ text: 'Link copied.' });
    } catch {
      setToast({ text: 'Copy the browser address to share this home.', note: true });
    }
  }
  const dismissWelcome = useCallback(() => {
    welcomeDismissed = true;
    // The card is about to unmount; don't strand keyboard focus on <body>.
    if (document.activeElement?.closest('.welcome-card')) exploreButton.current?.focus();
    setWelcome(false);
    try {
      localStorage.setItem(WELCOME_KEY, '1');
    } catch {
      // The module flag above still keeps it closed.
    }
  }, []);
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
    (selectedFarm ? FARM.name : undefined) ??
    (selectedMillpond ? MILLPOND_VENUE.name : undefined) ??
    (selectedTube ? TUBE_VENUE.name : undefined) ??
    (selectedFootball ? FOOTBALL_VENUE.name : undefined) ??
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
      <h1 className="sr-only">{TITLE}</h1>
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
        day={clock.day}
        football={football}
        onListening={setListening}
        onCinemaListening={setCinemaListening}
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
          <BrandMark size={26} night={night} />
          <span className="wordmark-text">forktown</span>
          <LanternDot />
        </button>
        <CalendarClock
          clock={clock}
          evening={{ hour: lanternTown.hour, tale: lanternTown.tale, places }}
          onVisitPlace={(plot) => select(plot, true)}
        />
        <button className="way-in" onClick={() => setModal('guide')}>
          Find your way in <ArrowRight size={16} />
        </button>
      </header>
      {welcome && !panel && !draft && (
        <WelcomeCard
          neighbors={places.length}
          newest={latestArrival?.name}
          onFindWayIn={() => setModal('guide')}
          onVisitFork={() => {
            dismissWelcome();
            select(FORK_PLOT, true);
          }}
          onDismiss={dismissWelcome}
        />
      )}

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
          aria-label={liveEvent || football.live ? 'Town events, happening now' : 'Town events'}
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
          {(liveEvent || football.live) && <i className="event-indicator" />}
        </button>
        <Soundtrack
          track={trackForTown(clock.minutes, events)}
          playing={clock.playing}
          football={football}
          listening={listening}
          cinema={cinema}
          cinemaListening={cinemaListening}
        />
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
            {selectedFarm ? (
              <FarmInfo />
            ) : selectedMillpond ? (
              <MillpondInfo minutes={clock.minutes} day={clock.day} skaters={skaters} />
            ) : selectedTube ? (
              <TubeInfo status={tubeStatus(displayPlaces, clock.minutes, clock.day)} />
            ) : selectedVenue?.kind === 'zoo' ? (
              <ZooInfo
                minutes={clock.minutes}
                watching={
                  residents.filter((r) => r.event?.id === 'zoo' && r.event.phase === 'attending')
                    .length
                }
              />
            ) : selectedVenue?.kind === 'cinema' ? (
              <CinemaInfo minutes={clock.minutes} day={clock.day} />
            ) : selectedFootball ? (
              <FootballMatch
                game={football}
                minutes={clock.minutes}
                watching={
                  residents.filter(
                    (r) => r.event?.id === 'football' && r.event.phase === 'attending',
                  ).length
                }
              />
            ) : selectedVenue?.kind === 'fork' ? (
              <ForkCard
                register={lanternTown.register}
                hour={lanternTown.hour}
                tale={lanternTown.tale}
                places={places}
                onVisit={(plot) => select(plot, true)}
                onFindWayIn={() => setModal('guide')}
              />
            ) : selectedVenue && selectedEvent ? (
              <div className="venue-info">
                <span className="quiet-label">PUBLIC SPACE · {selectedVenue.plot}</span>
                {selectedProgram.map((event) => (
                  <div className="venue-program" key={event.id}>
                    <span className="eyebrow">{eventStatus(event, clock.minutes)}</span>
                    <h3>{event.name}</h3>
                    <p>{event.description}</p>
                    <strong>
                      {timeLabel(event.start)}–{timeLabel(event.end)}
                    </strong>
                  </div>
                ))}
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
                  <LanternProvenance
                    register={lanternTown.register}
                    placeId={selected.id}
                    tale={lanternTown.tale}
                    places={places}
                  />
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
                  {selected.sign.mode !== 'none' && (
                    <figure className="home-sign">
                      <figcaption className="quiet-label">OUTDOOR SIGN</figcaption>
                      <SignPreview sign={selected.sign} />
                    </figure>
                  )}
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
                <p>{PLOT_COPY.title}</p>
                <small>{PLOT_COPY.hint}</small>
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
                football={football}
                events={events}
                minutes={clock.minutes}
                day={clock.day}
                skaters={skaters.length}
                evening={{
                  hour: lanternTown.hour,
                  tale: lanternTown.tale,
                  register: lanternTown.register,
                  places,
                }}
                onVisit={(plot, eventId) => {
                  select(plot, true);
                  setSelectedEventId(eventId);
                }}
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
                            <small>{PLOT_COPY.row}</small>
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

      {modal === 'contribute' && localSaveAvailable && (
        <Contribute plot={buildPlot} places={places} onClose={closeBuilder} onPreview={preview} />
      )}
      {modal === 'files' && (
        <Modal title="House files" onClose={() => setModal(null)} wide>
          <HouseFiles initialId={sourceId} />
        </Modal>
      )}
      {modal === 'guide' && (
        <Modal
          title="Make yourself at home."
          eyebrow={GUIDE_COPY.eyebrow}
          onClose={() => setModal(null)}
        >
          <div className="welcome-guide">
            <p>{GUIDE_COPY.intro}</p>
            <ol>
              {GUIDE_COPY.steps.map(([title, detail], i) => (
                <li key={title}>
                  <span aria-hidden="true">{i + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{detail}</p>
                  </div>
                </li>
              ))}
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
      {toast && (
        <Toast
          icon={toast.note ? <Info size={15} /> : <Check size={15} />}
          onDismiss={() => setToast(null)}
        >
          {toast.text}
        </Toast>
      )}
    </main>
  );
}
