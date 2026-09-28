import ZooInfo from './components/ZooInfo';
import FarmInfo from './components/FarmInfo';
import { FARM, isFarmPlot } from './lib/farm';
import MillpondInfo from './components/MillpondInfo';
import { isMillpondPlot, MILLPOND_VENUE } from './lib/millpond';
import { withPreview } from './lib/resident-trips';
import TubeInfo from './components/TubeInfo';
import { isTubePlot, TUBE_VENUE } from './lib/tubes';
import { tubeStatus } from './lib/tube-traffic';
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
import StartOnGitHub from './components/StartOnGitHub';
import Modal from './components/Modal';
import Toast from './components/Toast';
import FullTownNote from './components/FullTownNote';
import { NeighborRow, PlaceRow, PlotRow } from './components/BrowseRows';
import BrandMark, { LanternDot } from './components/BrandMark';
import WelcomeCard from './components/WelcomeCard';
import TownEvents from './components/TownEvents';
import ForkCard from './components/ForkCard';
import LanternProvenance from './components/LanternProvenance';
import Soundtrack from './components/Soundtrack';
import FootballMatch from './components/FootballMatch';
import CalendarClock from './components/CalendarClock';
import CinemaInfo from './components/CinemaInfo';
import { cinemaAt } from './lib/cinema';
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
import {
  ARRIVAL_COPY,
  GUIDE_COPY,
  PLOT_COPY,
  TITLE,
  WELCOME_KEY,
  guideSteps,
  shareTitle,
  shouldIntroduce,
  shouldWelcome,
} from './lib/brand';
import { TYPE_LABELS, type Place } from './lib/schema';
import { localSaveAvailable } from './lib/local-save';
import { useTownClock } from './lib/use-town-clock';
import { useLanternTown } from './lib/use-lantern-town';
import { FORK_PLOT } from './lib/lanterns';
import { linkHash, MISSING_LINK_COPY, readDeepLink, shareUrl } from './lib/deep-link';
import { OPEN_PLOTS_COPY } from './lib/open-plots';
import { simulateResidents, residentActivityLabel, timeLabel } from './lib/simulation';
import { useTownDayPrefetch } from './lib/idle-prefetch';

type Panel = 'places' | 'neighbors' | 'events';
// Keeps the welcome closed for this page load even when storage refuses the flag.
let welcomeDismissed = false;
function welcomeStorage() {
  try {
    return window.localStorage;
  } catch {
    // Blocked storage greets once per session.
    return null;
  }
}
function initialWelcome() {
  if (welcomeDismissed) return false;
  // A link to a house that isn't here greets a newcomer like a plain visit.
  return shouldWelcome(initialSelection() ? window.location.hash : '', welcomeStorage());
}
// The house a newcomer's shared link opened on, which introduces the town once instead.
function initialArrival() {
  if (welcomeDismissed) return null;
  const plot = initialSelection();
  const place = places.find((place) => place.plot === plot);
  return place && shouldIntroduce(window.location.hash, welcomeStorage()) ? place.id : null;
}
function rememberWelcome() {
  welcomeDismissed = true;
  try {
    localStorage.setItem(WELCOME_KEY, '1');
  } catch {
    // The module flag above still keeps it closed.
  }
}
function initialSelection() {
  const link = readDeepLink(window.location.hash, places);
  return link && 'plot' in link ? link.plot : null;
}

export default function App() {
  const city = useRef<CityHandle>(null);
  const exploreButton = useRef<HTMLButtonElement>(null);
  const panelTitle = useRef<HTMLHeadingElement>(null);
  const [selectedPlot, setSelectedPlot] = useState<string | null>(initialSelection);
  // The plot on show, for the address bar when a shared link turns out to point at nothing.
  const shownPlot = useRef(selectedPlot);
  useEffect(() => {
    shownPlot.current = selectedPlot;
  }, [selectedPlot]);
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
  const [toast, setToast] = useState<{ text: string; note?: boolean; keep?: boolean } | null>(null);
  const [shared, setShared] = useState(false);
  // Typed on an open plot and kept while the visitor compares plots. It goes only into the link.
  const [githubUsername, setGithubUsername] = useState('');
  const [welcome, setWelcome] = useState(initialWelcome);
  const [arrival, setArrival] = useState(initialArrival);
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
        ? withPreview(places, draft)
        : places,
    [draft, places],
  );
  const residents = useMemo(
    () => simulateResidents(displayPlaces, clock.minutes, clock.day),
    [displayPlaces, clock.minutes, clock.day],
  );
  useTownDayPrefetch(displayPlaces, clock.minutes, clock.day);
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
  // No house plot is free. An unsaved preview can still be saved: it holds its own plot.
  const townFull = !available.length && !draft;
  // The published town saves nothing, so an open plot starts its house on GitHub instead.
  const startInBrowser = !localSaveAvailable && !!repositoryUrl && !townFull;
  const startPlot =
    !localSaveAvailable && repositoryUrl && available.some((plot) => plot.id === selectedPlot)
      ? selectedPlot
      : null;
  const liveEvent = events.find((event) => isEventLive(event, clock.minutes));

  const select = useCallback((plotId: string | null, focus = false) => {
    city.current?.stopFollowing();
    setFollowed(null);
    setSelectedPlot(plotId);
    setSelectedEventId(null);
    setShared(false);
    setArrival(null);
    if (plotId) setPanel('places');
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${linkHash(plotId, places)}`,
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
    // A link opened in this tab moves the map there, like a fresh visit. A link to something the
    // town doesn't have says so instead of doing nothing.
    const openLink = (fresh: boolean) => {
      const link = readDeepLink(window.location.hash, places);
      if (link && 'missing' in link) {
        setToast({ text: MISSING_LINK_COPY[link.missing], note: true });
        // The map stays where it was, and so does the address: never a link to nothing.
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}${linkHash(shownPlot.current, places)}`,
        );
      } else if (!fresh && link) select(link.plot, true);
      else if (!fresh) setSelectedPlot(null);
    };
    openLink(true);
    const listener = () => openLink(false);
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, [select]);
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
    if (arrival) rememberWelcome();
  }, [arrival]);
  useEffect(() => {
    // A link to copy by hand stays until it is dismissed.
    if (!toast || toast.keep) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  function startBuilding(plot?: string) {
    if (!localSaveAvailable) {
      setModal('guide');
      return;
    }
    if (townFull) {
      setToast({ text: OPEN_PLOTS_COPY.full, note: true });
      return;
    }
    setBuildPlot(plot);
    setModal('contribute');
  }
  function showOpenPlots() {
    setModal(null);
    select(null);
    setPanel('places');
    setFilter('empty');
    setSearch('');
    setShowPlots(true);
  }
  const follow = useCallback((id: string) => {
    setFollowed(id);
    setPanel(null);
    setSelectedPlot(null);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, []);
  async function share(title: string) {
    if (!selectedPlot) return;
    const url = shareUrl(selectedPlot, places, {
      href: window.location.href,
      base: import.meta.env.BASE_URL,
      pages: import.meta.env.PROD,
    });
    if (navigator.share)
      try {
        await navigator.share({ title, url });
        setShared(true);
        return;
      } catch (error) {
        // Closing the share sheet is not a failure; anything else falls back to copying.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setToast({ text: 'Link copied.' });
    } catch {
      // A house's own page isn't the address in the browser, so the note spells it out.
      const what = selected ? 'home' : 'place';
      setToast(
        url === window.location.href
          ? { text: `Copy the browser address to share this ${what}.`, note: true }
          : { text: `Copy this link to share this ${what}: ${url}`, note: true, keep: true },
      );
    }
  }
  const dismissWelcome = useCallback(() => {
    // The card is about to unmount; don't strand keyboard focus on <body>.
    if (document.activeElement?.closest('.welcome-card')) exploreButton.current?.focus();
    setWelcome(false);
    rememberWelcome();
  }, []);
  const closeBuilder = useCallback(() => setModal(null), []);
  const preview = useCallback(
    (place: Place) => {
      setDraft(place);
      select(place.plot, true);
    },
    [select],
  );
  // Every venue panel shares its #venue= link.
  const sharesVenue = !selected && linkHash(selectedPlot, places).startsWith('#venue=');
  const heading =
    selected?.name ??
    (selectedFarm ? FARM.name : undefined) ??
    (selectedMillpond ? MILLPOND_VENUE.name : undefined) ??
    (selectedTube ? TUBE_VENUE.name : undefined) ??
    (selectedFootball ? FOOTBALL_VENUE.name : undefined) ??
    selectedVenue?.name ??
    (selectedPlot
      ? startPlot
        ? `Plot ${selectedPlot} is open`
        : `Plot ${selectedPlot}`
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
                {arrival === selected.id && (
                  <p className="arrival-intro">
                    {ARRIVAL_COPY.body(isFoundingPlace(selected) ? null : selected.creator)}{' '}
                    <button className="text-button" onClick={() => setModal('guide')}>
                      {ARRIVAL_COPY.action} <ArrowRight size={14} />
                    </button>
                  </p>
                )}
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
                        <button
                          className="text-button"
                          onClick={() => share(shareTitle(selected.name, selected.creator))}
                        >
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
            ) : startPlot && repositoryUrl ? (
              <StartOnGitHub
                plot={startPlot}
                places={places}
                repositoryUrl={repositoryUrl}
                typed={githubUsername}
                onTyped={setGithubUsername}
                night={night}
              />
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
                  <NeighborRow
                    key={resident.id}
                    id={resident.id}
                    resident={resident.resident}
                    activity={residentActivityLabel(resident)}
                    onFollow={follow}
                  />
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
                        <PlaceRow key={place.id} place={place} onSelect={select} />
                      ))
                    : filteredPlots.map((plot) => (
                        <PlotRow key={plot.id} plot={plot.id} onSelect={select} />
                      ))}
                </div>
                {filter === 'empty' && !available.length ? (
                  <FullTownNote repositoryUrl={repositoryUrl} />
                ) : (
                  (filter === 'places' ? filteredPlaces.length : filteredPlots.length) === 0 && (
                    <p className="empty-search">{OPEN_PLOTS_COPY.noMatch}</p>
                  )
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
            {sharesVenue && (
              <div className="venue-actions">
                <button className="text-button" onClick={() => share(shareTitle(heading))}>
                  {shared ? <Check size={14} /> : <Share2 size={14} />} Share
                </button>
              </div>
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
              {guideSteps(startInBrowser).map(([title, detail], i) => (
                <li key={title}>
                  <span aria-hidden="true">{i + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            {townFull && <FullTownNote id="full-town-note" repositoryUrl={repositoryUrl} />}
            {localSaveAvailable ? (
              <button
                className="button button-primary"
                disabled={townFull}
                aria-describedby={townFull ? 'full-town-note' : undefined}
                onClick={() => startBuilding()}
              >
                Build a place <ArrowRight size={16} />
              </button>
            ) : repositoryUrl ? (
              <div className="guide-actions">
                {startInBrowser && (
                  <button className="button button-primary" onClick={showOpenPlots}>
                    {GUIDE_COPY.openPlots} <ArrowRight size={16} />
                  </button>
                )}
                <a
                  className={`button ${startInBrowser ? 'button-secondary' : 'button-primary'}`}
                  href={`${repositoryUrl}/fork`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Fork on GitHub <ExternalLink size={15} />
                </a>
              </div>
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
