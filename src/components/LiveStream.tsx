import { useEffect, useMemo, useRef, useState } from 'react';
import type { Camera } from '../city/render';
import { renderTwilight } from '../city/twilight';
import { eventsForDay } from '../lib/events';
import { footballAt, footballListening } from '../lib/football';
import { steadyListening } from '../lib/map-view';
import {
  easeLiveCamera,
  liveCamera,
  liveEaseSeconds,
  liveLabelLift,
  liveProgram,
  liveShotAt,
} from '../lib/live-director';
import { isFoundingPlace, latestArrival, places } from '../lib/places';
import { getPlot, plotEntrance, project } from '../lib/world';
import { townCatAt, TOWN_CAT_NAME } from '../lib/town-cat';
import { simulateResidents } from '../lib/simulation';
import { residentTrips } from '../lib/resident-trips';
import { useTownDayPrefetch, whenIdle } from '../lib/idle-prefetch';
import { useTownClock } from '../lib/use-town-clock';
import { townTuneAt, trackForTown } from '../music/score';
import { cinemaAt, cinemaListening } from '../lib/cinema';
import { bandstandListening } from '../lib/district-places';
import { townArrivalDates, townArrivals } from '../lib/arrivals';
import { TOWN_DAY_MS } from '../lib/town-time';
import { readLiveParams } from '../lib/live-params';
import {
  activeBreak,
  breakOpacity,
  itemKey,
  quietFor,
  welcomeShotAt,
  welcomeTimeline,
  type WelcomeStep,
} from '../lib/live-breaks';
import {
  forcedStart,
  forktownBuild,
  installLiveHarness,
  playableOf,
  upcomingPlayable,
  welcomeEarliest,
  welcomeFallback,
  welcomePhase,
  type ForktownLive,
} from '../lib/live-harness';
import Soundtrack from './Soundtrack';
import BreakOverlay, { useBreakFilms } from './BreakOverlay';
import ResidentPreview from './ResidentPreview';
import BrandMark from './BrandMark';
import { TAGLINE } from '../lib/brand';
import '../live.css';

// One shared object each, so the break engine's memos keep hitting frame after frame.
const arrivalDates = townArrivalDates as Record<string, string>;
const NO_WELCOME: WelcomeStep[] = [];

export default function LiveStream() {
  const clock = useTownClock({ autoPlay: true });
  const canvas = useRef<HTMLCanvasElement>(null);
  const followLabel = useRef<HTMLDivElement>(null);
  const camera = useRef<Camera | null>(null);
  const lastPaint = useRef<number | null>(null);
  const lastShot = useRef<string | null>(null);
  // What the address asks for (breaks, a forced item, a welcome), read once as the page opens.
  const [mountedAt] = useState(() => Date.now());
  const [params] = useState(() => readLiveParams(window.location.search, mountedAt));
  const welcomeIds = useMemo(
    () =>
      params.welcome.filter((id) =>
        places.some((place) => place.id === id && !isFoundingPlace(place)),
      ),
    [params],
  );
  const films = useBreakFilms(
    params.breakMinutes !== null || params.forced !== null || welcomeIds.length > 0,
  );
  const [welcomeCalledAt, setWelcomeCalledAt] = useState<number | null>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [listening, setListening] = useState({ gain: 0, pan: 0 });
  const [cinemaField, setCinemaField] = useState({ gain: 0, pan: 0 });
  const [bandstandField, setBandstandField] = useState({ gain: 0, pan: 0 });
  const cinema = useMemo(() => cinemaAt(clock.minutes, clock.day), [clock.minutes, clock.day]);
  const program = useMemo(() => liveProgram(places, clock.day), [clock.day]);
  // Tomorrow's program while idle in the last town hour (its plan first), so midnight never waits.
  useEffect(() => {
    if (clock.minutes < 1380) return;
    whenIdle(places, `trips:${clock.day + 1}`, () => residentTrips(places, clock.day + 1));
    whenIdle(places, `live:${clock.day + 1}`, () => liveProgram(places, clock.day + 1));
  }, [clock.minutes, clock.day]);
  useTownDayPrefetch(places, clock.minutes, clock.day);
  const cinemaEvening = clock.minutes < 360;
  const events = useMemo(
    () => eventsForDay(clock.day, cinemaEvening ? 0 : 720),
    [clock.day, cinemaEvening],
  );
  const residents = useMemo(
    () => simulateResidents(places, clock.minutes, clock.day),
    [clock.minutes, clock.day],
  );
  const football = useMemo(() => footballAt(clock.minutes, clock.day), [clock.minutes, clock.day]);

  // Breaks and the welcome run on the same UTC clock as the town, in epoch ms.
  const ms = clock.day * TOWN_DAY_MS + clock.minutes * 1000;
  const filmsReady = films.state === 'ready';
  const welcomeTrigger = welcomeIds.length
    ? (welcomeCalledAt ?? welcomeFallback(mountedAt, params.welcomeWait))
    : null;
  const earliest =
    welcomeTrigger === null ? null : welcomeEarliest(welcomeTrigger, films.settledAt, ms);
  const welcome = useMemo(
    () =>
      earliest === null
        ? NO_WELCOME
        : welcomeTimeline(
            welcomeIds,
            earliest,
            places,
            townArrivals,
            arrivalDates,
            params.breakMinutes,
            mountedAt,
          ),
    [earliest, welcomeIds, params.breakMinutes, mountedAt],
  );
  const forcedAt = params.forced ? forcedStart(mountedAt, films.readyAt) : null;
  const forced = useMemo(
    () => (params.forced && forcedAt !== null ? { item: params.forced, start: forcedAt } : null),
    [params.forced, forcedAt],
  );
  const active = activeBreak({
    ms,
    places,
    minutes: params.breakMinutes,
    forced,
    welcome,
    mountedAt,
    arrivals: townArrivals,
    dates: arrivalDates,
  });
  // A break covers the town only once its pictures can draw; until then the town carries on.
  const shown = filmsReady ? active : null;
  const opacity = shown ? breakOpacity(shown, ms) : 0;
  const covered = opacity === 1;
  const breakTitle = shown
    ? shown.item.kind === 'ad'
      ? shown.item.ad.sponsor
      : shown.item.card.title
    : null;
  const breakSound = useMemo(
    () =>
      shown
        ? { film: playableOf(shown.item), elapsed: (ms - shown.start) / 1000, key: shown.key }
        : null,
    [shown, ms],
  );
  // Render the next card's or ad's sound ahead, so its first note lands with its first frame. A
  // requested welcome warms its card from the start: its first card begins the moment it's placed.
  const second = Math.floor(ms / 1000);
  const welcomeArmed = welcomeIds.length > 0 && earliest === null;
  const prepare = useMemo(
    () =>
      upcomingPlayable({
        ms: second * 1000,
        places,
        minutes: params.breakMinutes,
        forced,
        welcome,
        mountedAt,
        welcomeArmed,
      }),
    [second, params.breakMinutes, forced, welcome, mountedAt, welcomeArmed],
  );

  const welcomeStep = welcome.find((step) => ms >= step.start && ms < step.end);
  // The camera moves to the new house once the welcome card covers the town, and settles there.
  const welcomeShot =
    welcomeStep && (welcomeStep.kind === 'hold' || !shown || ms >= welcomeStep.start + 400)
      ? welcomeShotAt(welcomeStep)
      : null;
  const shot = welcomeShot ?? liveShotAt(program, clock.minutes, residents);
  const followedResident = residents.find((resident) => resident.id === shot.residentId);
  const cat = townCatAt(places, clock.minutes, clock.day);
  const welcomeHold = welcomeStep?.kind === 'hold' ? welcomeStep.house.place : null;
  const welcomePlot = welcomeHold ? getPlot(welcomeHold.plot) : undefined;
  // The label sits at the new house's front path, in tiles: the paint below projects it once.
  const followPosition = welcomeHold
    ? welcomePlot
      ? plotEntrance(welcomePlot)
      : undefined
    : (followedResident?.position ?? (shot.kind === 'cat' ? cat.position : undefined));
  const followName = welcomeHold
    ? welcomeHold.name
    : (followedResident?.resident.name ?? (shot.kind === 'cat' ? TOWN_CAT_NAME : undefined));
  const followCaption = welcomeHold ? 'New neighbor' : 'Following';
  const night = clock.minutes < 360 || clock.minutes >= 1200;

  // window.forktownLive reads the latest render through this ref, installed once below.
  const harness = useRef<ForktownLive | null>(null);
  useEffect(() => {
    harness.current = {
      version: 1,
      build: forktownBuild,
      quietFor: (seconds) => quietFor(Date.now(), seconds, places, welcome),
      startWelcome: () => {
        const phase = welcomePhase(welcomeIds.length > 0, earliest, welcome, Date.now());
        if (phase === 'none' || phase === 'done') return false;
        // Idempotent: the first call (or the fallback, if it came first) fixes the start.
        const now = Date.now();
        if (welcomeCalledAt === null && now < welcomeTrigger!)
          setWelcomeCalledAt((old) => old ?? now);
        return true;
      },
      state: () => ({
        shot: shot.id,
        label: shot.label,
        break: shown ? { key: shown.key, item: itemKey(shown.item), endsAt: shown.end } : null,
        welcome: welcomePhase(welcomeIds.length > 0, earliest, welcome, Date.now()),
        films: films.state,
        build: forktownBuild,
      }),
    };
  });
  useEffect(() => installLiveHarness(() => harness.current!), []);

  useEffect(() => {
    document.title = 'Forktown Live';
    const element = canvas.current!;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      camera.current = null;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx || !size.width || !size.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(size.width * ratio),
      height = Math.floor(size.height * ratio);
    if (element.width !== width) element.width = width;
    if (element.height !== height) element.height = height;
    const now = performance.now();
    const elapsed = lastPaint.current === null ? 0 : (now - lastPaint.current) / 1000;
    // One town minute is one real second.
    const target = liveCamera(shot, size.width, size.height);
    const old = camera.current;
    const subjectX = old ? shot.center.x * old.zoom + old.x : 0;
    const subjectY = old ? shot.center.y * old.zoom + old.y : 0;
    const distantCut =
      lastShot.current !== shot.id &&
      (subjectX < 60 || subjectX > size.width - 60 || subjectY < 80 || subjectY > size.height - 60);
    camera.current =
      camera.current === null || elapsed > 2 || distantCut
        ? target
        : easeLiveCamera(camera.current, target, elapsed, liveEaseSeconds(followedResident));
    lastShot.current = shot.id;
    lastPaint.current = now;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // Under a fully opaque break the town needn't paint; the camera above keeps easing.
    if (!covered)
      renderTwilight({
        ctx,
        ...size,
        camera: camera.current,
        places,
        residents,
        events,
        football,
        minutes: clock.minutes,
        day: clock.day,
        night,
        selectedPlot: null,
        hoveredPlot: null,
        showPlots: false,
        followed: shot.residentId,
      });
    if (followLabel.current && followPosition) {
      const point = project(followPosition.x, followPosition.y);
      const x = point.x * camera.current.zoom + camera.current.x;
      // A neighbor on the tube carries the label up the stack and along the glass.
      const y =
        (point.y - (shot.kind === 'cat' ? 24 : liveLabelLift(followedResident))) *
          camera.current.zoom +
        camera.current.y;
      const halfLabel = followLabel.current.offsetWidth / 2 + 12;
      followLabel.current.style.left = `${Math.max(halfLabel, Math.min(size.width - halfLabel, x))}px`;
      followLabel.current.style.top = `${Math.max(90, Math.min(size.height - 30, y))}px`;
      followLabel.current.style.visibility =
        x >= 0 && x <= size.width && y >= 0 && y <= size.height ? 'visible' : 'hidden';
    }
    const field = footballListening(camera.current, size.width, size.height);
    const screen = cinemaListening(camera.current, size.width, size.height);
    // The Bandstand's frame is a shot of its own (live-director's district frames); its band is
    // heard like the cinema, by how close and central the camera holds it.
    const band = bandstandListening(camera.current, size.width, size.height);
    // The same steps the town's own view hears in, so both sound alike.
    setCinemaField((old) => steadyListening(old, screen));
    setBandstandField((old) => steadyListening(old, band));
    setListening((old) => steadyListening(old, field));
  }, [
    size,
    residents,
    events,
    football,
    clock.minutes,
    clock.day,
    night,
    shot.center.x,
    shot.center.y,
    shot.width,
    shot.height,
    shot.residentId,
    followedResident,
    followedResident?.transit?.altitude,
    followedResident?.transit?.stage,
    followPosition?.x,
    followPosition?.y,
    shot.id,
    shot.kind,
    covered,
  ]);

  return (
    <main className={`live-stream ${night ? 'live-stream-night' : ''}`} data-break={shown?.key}>
      <h1 className="sr-only">Forktown live stream</h1>
      <canvas ref={canvas} role="img" aria-label={`Forktown live: ${breakTitle ?? shot.label}`} />
      <div className="live-watermark" role="img" aria-label="Forktown">
        <BrandMark size={40} night={night} />
      </div>
      <aside className="live-community live-glass" aria-label="Town population and latest arrival">
        <div className="live-population">
          <div>
            <span className="live-caption">Population</span>
            <strong>
              {places.length}
              <span>neighbors</span>
            </strong>
          </div>
          <span className="live-community-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="live-arrival">
          {latestArrival && (
            <div className="live-avatar">
              <ResidentPreview resident={latestArrival.resident} size={34} />
            </div>
          )}
          <div className="live-arrival-copy">
            <span className="live-caption">Latest arrival</span>
            <strong>{latestArrival ? `@${latestArrival.creator}` : 'Welcome, neighbor'}</strong>
            <span className="live-arrival-home">{latestArrival?.name ?? TAGLINE.slice(0, -1)}</span>
          </div>
        </div>
      </aside>
      {followName && (
        <div ref={followLabel} className="live-follow-label live-glass" role="status">
          <span className="live-caption">
            <i aria-hidden="true" />
            {followCaption}
          </span>
          <strong>{followName}</strong>
        </div>
      )}
      <BreakOverlay active={shown} ms={ms} />
      <Soundtrack
        track={trackForTown(clock.minutes, events, bandstandField)}
        bed={trackForTown(clock.minutes, events)}
        upcoming={townTuneAt(clock.minutes + 30)}
        playing={clock.playing}
        football={football}
        listening={listening}
        cinema={cinema}
        cinemaListening={cinemaField}
        bandstand={bandstandField}
        breakSound={breakSound}
        prepare={prepare}
        autoStart
        hideControls
      />
    </main>
  );
}
