import TownClock from './components/TownClock';
import Neighbors, { ACTIVITY_LABELS } from './components/Neighbors';
import ResidentPreview from './components/ResidentPreview';
import SignPreview from './components/SignPreview';
import { useTownClock } from './lib/use-town-clock';
import { simulateResidents } from './lib/simulation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  ExternalLink,
  FileJson,
  Flower2,
  GitFork,
  Heart,
  MapPin,
  Plus,
  Search,
  Share2,
  Sparkles,
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
import '@fontsource/fraunces/500-italic.css';
import City, { type CityHandle } from './components/City';
import BuildingPreview from './components/BuildingPreview';
import Contribute from './components/Contribute';
import Modal from './components/Modal';
import { isFoundingPlace, places, repositoryUrl } from './lib/places';
import { PLOTS } from './lib/world';
import { TYPE_LABELS, type Place } from './lib/schema';
import { localSaveAvailable } from './lib/local-save';

function initialSelection() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return places.find((place) => place.id === params.get('place'))?.plot ?? null;
}

export default function App() {
  const city = useRef<CityHandle>(null);
  const [selectedPlot, setSelectedPlot] = useState<string | null>(initialSelection);
  const clock = useTownClock();
  const night = clock.minutes < 360 || clock.minutes >= 1200;
  const [followed, setFollowed] = useState<string | null>(null);
  const [showPlots, setShowPlots] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'places' | 'empty'>('places');
  const [modal, setModal] = useState<'contribute' | 'guide' | 'about' | null>(null);
  const [buildPlot, setBuildPlot] = useState<string | undefined>();
  const [draft, setDraft] = useState<Place | null>(null);
  const [toast, setToast] = useState('');
  const [shared, setShared] = useState(false);
  const displayPlaces = useMemo(
    () =>
      draft && !places.some((place) => place.id === draft.id || place.plot === draft.plot)
        ? [...places, draft]
        : places,
    [draft, places],
  );
  const residents = useMemo(
    () => simulateResidents(displayPlaces, clock.minutes),
    [displayPlaces, clock.minutes],
  );
  const starterCount = places.filter(isFoundingPlace).length;
  const communityCount = places.length - starterCount;
  const selected = displayPlaces.find((place) => place.plot === selectedPlot);
  const available = PLOTS.filter((plot) => !places.some((place) => place.plot === plot.id));
  const filteredPlaces = displayPlaces.filter((place) =>
    `${place.name} ${place.creator} ${place.resident.name} ${TYPE_LABELS[place.building]} ${place.plot}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredPlots = available.filter((plot) =>
    `${plot.id} empty plot`.toLowerCase().includes(search.toLowerCase()),
  );
  function select(plotId: string | null, focus = false) {
    setFollowed(null);
    setSelectedPlot(plotId);
    setShared(false);
    const place = places.find((p) => p.plot === plotId);
    const hash = place ? `#place=${encodeURIComponent(place.id)}` : '';
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${hash}`,
    );
    if (plotId && focus) city.current?.focus(plotId);
  }
  useEffect(() => {
    const listener = () => setSelectedPlot(initialSelection());
    if (window.location.hash.startsWith('#place=')) listener();
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, [places]);
  useEffect(() => {
    if (draft && places.some((place) => place.id === draft.id || place.plot === draft.plot))
      setDraft(null);
  }, [draft, places]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function startBuilding(plot?: string) {
    if (!available.length) {
      setToast('This neighborhood is full. A new district can be added to the world.');
      return;
    }
    setBuildPlot(plot);
    setModal('contribute');
  }
  async function share() {
    if (!selected) return;
    const url = new URL(window.location.href);
    url.hash = `place=${encodeURIComponent(selected.id)}`;
    try {
      await navigator.clipboard.writeText(url.href);
      setShared(true);
      setToast('Link copied. A little place worth sharing.');
    } catch {
      setToast('Copy the address from your browser to share this place.');
    }
  }
  function preview(place: Place) {
    setDraft(place);
    select(place.plot, true);
    setToast(
      localSaveAvailable
        ? 'Your place is in the preview. Return to the builder to save it to your project.'
        : 'Your place is now in the local preview. Export its JSON when you’re ready.',
    );
  }
  const founding = selected && isFoundingPlace(selected);
  return (
    <>
      <a className="skip-link" href="#neighborhood">
        Skip to the neighborhood
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            aria-label="Forktown home"
            onClick={() => {
              select(null);
              city.current?.reset();
              setSearch('');
              setFilter('places');
            }}
          >
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>
              forktown<span className="brand-dot">.</span>
            </span>
          </button>
          <nav aria-label="Main navigation">
            <a className="nav-link active" href="#neighborhood">
              Explore the town
            </a>
            <button className="nav-link" onClick={() => setModal('guide')}>
              How it works
            </button>
            <button className="nav-link" onClick={() => setModal('about')}>
              Our story
            </button>
          </nav>
          <div className="header-right">
            {repositoryUrl ? (
              <a
                className="github-link"
                href={repositoryUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Forktown source on GitHub"
              >
                <Code2 size={19} />
                <span>Open source</span>
                <ExternalLink size={12} />
              </a>
            ) : (
              <span className="open-source-label">
                <GitFork size={17} /> Open by nature
              </span>
            )}
            <button className="button button-primary header-build" onClick={() => startBuilding()}>
              <Plus size={16} />
              <span>Build a place</span>
            </button>
          </div>
        </div>
      </header>
      <main className="page-shell">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-star">✳</span> A LIVING TOWN, BUILT TOGETHER
            </span>
            <h1 id="hero-title">
              Small town.
              <br />
              <em>Little lives. Big stories.</em>
            </h1>
            <p>
              A home of your own. A neighbor with a life. A town we make together.
              <br className="desktop-break" /> Design a place, give someone a daily rhythm, and let
              them wander.
            </p>
          </div>
          <div className="hero-invitation">
            <div className="hero-sprites" aria-hidden="true">
              <BuildingPreview place={places[0]} size={83} />
              <BuildingPreview place={places[4]} size={94} />
              <BuildingPreview place={places[2]} size={80} />
            </div>
            <p>
              Your first contribution
              <br />
              could be <strong>someone’s favorite place.</strong>
            </p>
            <button className="text-button" onClick={() => setModal('guide')}>
              Find your way in <ArrowDown size={15} />
            </button>
          </div>
        </section>
        <section className="town-section" id="neighborhood" aria-label="Explore Forktown">
          <div className="town-toolbar">
            <div className="town-title">
              <span className="tiny-town-icon" aria-hidden="true">
                <MapPin size={18} />
              </span>
              <h2>The neighborhood</h2>
              <span className="edition-tag">LIVING EDITION</span>
            </div>
            <div className="town-settings">
              <label className="plot-toggle">
                <input
                  type="checkbox"
                  checked={showPlots}
                  onChange={(event) => setShowPlots(event.target.checked)}
                />
                <span className="toggle-track" />
                <span>Plot labels</span>
              </label>
            </div>
          </div>
          <TownClock clock={clock} />
          {draft && (
            <div className="preview-banner">
              <Sparkles size={15} />
              <span>
                <strong>Your local preview.</strong> Your place joins the public city after its pull
                request is merged.
              </span>
              <button onClick={() => startBuilding(draft.plot)}>
                {localSaveAvailable ? 'Save my place' : 'Get the file'} <ArrowRight size={13} />
              </button>
              <button
                aria-label="Remove local preview"
                onClick={() => {
                  if (selectedPlot === draft.plot) select(null);
                  setDraft(null);
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <div className="town-layout">
            <City
              ref={city}
              places={displayPlaces}
              selectedPlot={selectedPlot}
              onSelect={(plot) => select(plot)}
              night={night}
              showPlots={showPlots}
              residents={residents}
              followed={followed}
              onStopFollowing={() => setFollowed(null)}
              onResidentSelect={(id) => {
                setSelectedPlot(null);
                setFollowed(id);
              }}
            />
            <aside
              className="neighborhood-panel"
              aria-label="Neighborhood directory and place details"
            >
              {selectedPlot ? (
                <div className="place-detail" key={selectedPlot}>
                  <button className="back-button" onClick={() => select(null)}>
                    <ArrowLeft size={14} /> Back to the neighborhood
                  </button>
                  {selected ? (
                    <>
                      <div className={`detail-illustration ${night ? 'night' : ''}`}>
                        <span className="plot-chip">
                          <MapPin size={11} /> PLOT {selected.plot}
                        </span>
                        <BuildingPreview place={selected} size={182} night={night} />
                        <span className="detail-type">{TYPE_LABELS[selected.building]}</span>
                      </div>
                      <div className="detail-body">
                        <h3>{selected.name}</h3>
                        <div className="creator-line">
                          <span className="creator-avatar">
                            {founding ? (
                              <Sprout size={13} />
                            ) : (
                              selected.creator.slice(0, 2).toUpperCase()
                            )}
                          </span>
                          {founding ? (
                            <span>Made for the founding neighborhood</span>
                          ) : (
                            <a
                              href={`https://github.com/${selected.creator}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              @{selected.creator}
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                        <p className="place-story">“{selected.story}”</p>
                        <div className="detail-resident">
                          <ResidentPreview resident={selected.resident} size={48} />
                          <div>
                            <strong>{selected.resident.name} lives here</strong>
                            <span>
                              {
                                ACTIVITY_LABELS[
                                  residents.find((r) => r.id === selected.id)?.activity ?? 'home'
                                ]
                              }
                            </span>
                          </div>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => {
                            setFollowed(selected.id);
                            setSelectedPlot(null);
                          }}
                        >
                          Follow {selected.resident.name} <ArrowRight size={13} />
                        </button>
                        <div className="detail-sign">
                          <SignPreview sign={selected.sign} />
                        </div>
                        <div className="detail-divider" />
                        <div className="place-facts">
                          <span>Little home, big personality</span>
                          <span>
                            {selected.decoration[0].toUpperCase() + selected.decoration.slice(1)}
                          </span>
                        </div>
                        {founding && (
                          <p className="seed-note">
                            A starter place built to welcome the first neighbors. Yours could be
                            next.
                          </p>
                        )}
                        {draft?.id === selected.id ? (
                          <button
                            className="button button-primary full-width"
                            onClick={() => startBuilding(selected.plot)}
                          >
                            {localSaveAvailable ? 'Save my place' : 'Get my contribution file'}{' '}
                            <ArrowRight size={15} />
                          </button>
                        ) : (
                          <button className="button button-secondary full-width" onClick={share}>
                            {shared ? <Check size={15} /> : <Share2 size={15} />}{' '}
                            {shared ? 'Link copied' : 'Share this little place'}
                          </button>
                        )}
                        {repositoryUrl && draft?.id !== selected.id && (
                          <a
                            className="detail-source"
                            href={`${repositoryUrl}/blob/main/places/${selected.id}.json`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Code2 size={13} /> See the little file behind it{' '}
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="empty-plot-detail">
                      <div className="empty-plot-art">
                        <Sprout size={43} strokeWidth={1.25} />
                        <span>PLOT {selectedPlot}</span>
                      </div>
                      <span className="eyebrow">ROOM FOR SOMETHING NEW</span>
                      <h3>
                        This corner
                        <br />
                        could be yours.
                      </h3>
                      <p>
                        A cottage, a café, a place that only you could imagine. Start small and make
                        it personal.
                      </p>
                      <button
                        className="button button-primary full-width"
                        onClick={() => startBuilding(selectedPlot)}
                      >
                        <Plus size={15} /> Build on plot {selectedPlot}
                      </button>
                      <span className="small-reassurance">One JSON file is all it takes.</span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="panel-heading">
                    <div className="panel-heading-top">
                      <span className="eyebrow">GOOD TO HAVE YOU HERE</span>
                      <Flower2 size={19} />
                    </div>
                    <h3>Every place has a story.</h3>
                    <p>Meet the places that make us, us.</p>
                    <div className="town-counts">
                      <span>
                        <b>{places.length}</b> little places
                      </span>
                      <i />
                      <span>
                        <b>{available.length}</b> open plots
                      </span>
                    </div>
                  </div>
                  <div className="directory-controls">
                    <label className="search-field">
                      <Search size={15} />
                      <input
                        aria-label="Search places and plots"
                        placeholder={
                          filter === 'places' ? 'Find a little place…' : 'Find an open plot…'
                        }
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                      {search && (
                        <button aria-label="Clear search" onClick={() => setSearch('')}>
                          <X size={13} />
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
                  <div
                    className="place-list"
                    aria-label={filter === 'places' ? 'Places' : 'Available plots'}
                  >
                    {filter === 'places' ? (
                      filteredPlaces.length ? (
                        filteredPlaces.map((place) => (
                          <button
                            className="place-row"
                            key={place.id}
                            onClick={() => select(place.plot, true)}
                          >
                            <span className="place-thumbnail">
                              <BuildingPreview place={place} size={53} />
                            </span>
                            <span className="place-row-copy">
                              <strong>{place.name}</strong>
                              <span>
                                {isFoundingPlace(place) ? 'Founding neighbor' : `@${place.creator}`}{' '}
                                <i>·</i> {place.plot}
                              </span>
                            </span>
                            <ChevronRight size={14} />
                          </button>
                        ))
                      ) : (
                        <div className="no-results">
                          <Search size={22} />
                          <p>No places found.</p>
                          <button onClick={() => setSearch('')}>Try another search</button>
                        </div>
                      )
                    ) : filteredPlots.length ? (
                      filteredPlots.map((plot) => (
                        <button
                          className="place-row empty-row"
                          key={plot.id}
                          onClick={() => select(plot.id, true)}
                        >
                          <span className="empty-thumbnail">
                            <Plus size={20} />
                          </span>
                          <span className="place-row-copy">
                            <strong>Plot {plot.id}</strong>
                            <span>A fresh start, just for you</span>
                          </span>
                          <ChevronRight size={14} />
                        </button>
                      ))
                    ) : (
                      <div className="no-results">
                        <p>No matching open plots.</p>
                        <button onClick={() => setSearch('')}>Clear search</button>
                      </div>
                    )}
                  </div>
                  <div className="panel-invitation">
                    <span>
                      <span className="live-dot" /> There’s room for you here.
                    </span>
                    <button aria-label="Build your place" onClick={() => startBuilding()}>
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </>
              )}
            </aside>
          </div>
          <div className="town-bottom">
            <span>
              <Sprout size={13} /> A small beginning. A growing world.
            </span>
            <span>
              {starterCount} starter places <span className="dot-separator">·</span>{' '}
              {communityCount
                ? `${communityCount} community ${communityCount === 1 ? 'place' : 'places'}`
                : 'Made for our future neighbors'}{' '}
              <Heart size={12} />
            </span>
          </div>
        </section>
        <Neighbors
          residents={residents}
          followed={followed}
          onFollow={(id) => {
            setFollowed(id);
            setSelectedPlot(null);
            document.getElementById('neighborhood')?.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
              block: 'start',
            });
          }}
          onHome={(plot) => {
            select(plot, true);
            document.getElementById('neighborhood')?.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
              block: 'start',
            });
          }}
        />
        <section className="welcome-strip" aria-label="Your first contribution">
          <div className="welcome-title">
            <span className="eyebrow">YOU DON’T HAVE TO BE AN EXPERT</span>
            <h2>Just a little curious.</h2>
            <button className="text-button" onClick={() => setModal('guide')}>
              Your first contribution starts here <ArrowRight size={15} />
            </button>
          </div>
          <div className="welcome-step">
            <span className="step-icon">
              <GitFork size={20} />
            </span>
            <div>
              <span className="step-number">01 / MAKE IT YOURS</span>
              <p>
                Fork the project.
                <br />
                Find your little corner.
              </p>
            </div>
          </div>
          <div className="welcome-step">
            <span className="step-icon">
              <FileJson size={20} />
            </span>
            <div>
              <span className="step-number">02 / ADD YOUR SPARK</span>
              <p>
                One simple JSON file.
                <br />A place full of personality.
              </p>
            </div>
          </div>
          <div className="welcome-step">
            <span className="step-icon">
              <Users size={20} />
            </span>
            <div>
              <span className="step-number">03 / COME ON IN</span>
              <p>
                Open a pull request.
                <br />
                Become part of the town.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <span className="footer-brand">forktown.</span>
        <span>Built with small contributions and a lot of heart.</span>
        <div>
          <button onClick={() => setModal('guide')}>Contributor guide</button>
          <span>
            Everyone starts somewhere. <Sprout size={13} />
          </span>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={14} />
          </button>
        </div>
      )}
      {modal === 'contribute' && (
        <Contribute
          plot={buildPlot}
          places={places}
          onClose={() => setModal(null)}
          onPreview={preview}
        />
      )}
      {modal === 'guide' && (
        <Modal title="Big welcome. Small first step." onClose={() => setModal(null)}>
          <div className="guide-content">
            <p className="modal-intro">
              You don’t need to know how to build a city. You just need an idea for one little
              place.
            </p>
            <ol className="contribution-steps">
              <li>
                <span>1</span>
                <div>
                  <h3>Design your place</h3>
                  <p>
                    Choose an empty plot, a building, a color, and a few words that make it yours.
                    The builder creates the JSON file for you.
                  </p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <h3>{localSaveAvailable ? 'Save to your project' : 'Make your own copy'}</h3>
                  <p>
                    {localSaveAvailable ? (
                      <>
                        Click <strong>Save to my project</strong> in the builder. It creates your
                        JSON file in <code>places/</code> and updates the local city. Commit and
                        push the file on your branch.
                      </>
                    ) : (
                      <>
                        Fork the project on GitHub, then add your downloaded file to the{' '}
                        <code>places/</code> folder. No terminal needed.
                      </>
                    )}
                  </p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <h3>Send a pull request</h3>
                  <p>
                    A pull request asks to add your change to the shared city. Automatic checks
                    point out missing details and plot conflicts.
                  </p>
                </div>
              </li>
              <li>
                <span>4</span>
                <div>
                  <h3>See yourself in the city</h3>
                  <p>
                    After a maintainer reviews and merges your change, your place appears with your
                    name and a link you can share.
                  </p>
                </div>
              </li>
            </ol>
            <div className="guide-aside">
              <Sprout size={20} />
              <p>
                Already know your way around? Help create a new building style, improve
                accessibility, write a guide, or fix a bug. There are many ways to belong.
              </p>
            </div>
            <button className="button button-primary" onClick={() => startBuilding()}>
              Let’s build my place <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal === 'about' && (
        <Modal title="The internet could use a little town." onClose={() => setModal(null)}>
          <div className="guide-content about-content">
            <div className="about-art">
              <BuildingPreview place={places[2]} size={140} />
              <BuildingPreview place={places[0]} size={150} />
              <BuildingPreview place={places[5]} size={145} />
            </div>
            <p>
              Forktown is an open-source experiment in building something together. A place where
              your first pull request becomes a café, a cottage, a bookshop—a little piece of a
              world everyone can explore.
            </p>
            <p>
              We’re starting with a founding neighborhood and a handful of example places. What it
              becomes is up to the people who show up.
            </p>
            <blockquote>
              Small contributions.
              <br />A world of possibility.
            </blockquote>
            <p>
              Everyone is welcome. Be kind, stay curious, and help the next person find their way
              in.
            </p>
            <button className="button button-primary" onClick={() => startBuilding()}>
              Leave your little mark <Plus size={15} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
