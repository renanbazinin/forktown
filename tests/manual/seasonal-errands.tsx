import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/space-mono/400.css';
import '../../src/styles.css';
import '../../src/explore.css';
import './seasonal-errands.css';
import City, { type CityHandle } from '../../src/components/City';
import SeasonalErrandCard from '../../src/components/SeasonalErrandCard';
import BrandMark from '../../src/components/BrandMark';
import { drawResident } from '../../src/city/residents';
import { places } from '../../src/lib/places';
import { eventsForDay } from '../../src/lib/events';
import { footballAt } from '../../src/lib/football';
import { simulateResidents, timeLabel } from '../../src/lib/simulation';
import { residentErrands, type ErrandKind, type ErrandPhase } from '../../src/lib/seasonal-errands';
import { CALENDAR_EPOCH_DAY, SEASONS, townCalendarAt } from '../../src/lib/town-calendar';

const YEAR = CALENDAR_EPOCH_DAY + 224;
const kinds: ErrandKind[] = ['seedlings', 'lemonade', 'harvest', 'thermos'];
const phases: ErrandPhase[] = ['outbound', 'pickup', 'carrying', 'dropoff', 'returning'];
const phaseNames = ['Walk there', 'Pick up', 'Carry', 'Set down', 'Walk home'];
const noListening = () => {};
const firstTrip = (day: number) => [...residentErrands(places, day).values()].flat()[0];
// Real published residents only. Search inside this season for the first feasible round.
const scenes = SEASONS.map((_, season) => {
  for (let offset = 0; offset < 28; offset++) {
    const day = YEAR + season * 28 + ((7 + offset) % 28);
    const trip = firstTrip(day);
    if (trip) return { day, trip };
  }
  return { day: YEAR + season * 28, trip: undefined };
});
const query = new URLSearchParams(location.search);
const bounded = (value: string | null, low: number, high: number, fallback: number) => {
  const n = value === null ? NaN : Number(value);
  return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback;
};
const initialSeason = Math.floor(bounded(query.get('season'), 0, 3, 0));
const initialDay =
  YEAR + Math.floor(bounded(query.get('day'), 0, 111, scenes[initialSeason].day - YEAR));
const initialTrip = firstTrip(initialDay);
const initialPhase = phases.includes(query.get('phase') as ErrandPhase)
  ? (query.get('phase') as ErrandPhase)
  : 'carrying';
const middle = (day: number, phase: ErrandPhase) => {
  const seg = firstTrip(day)?.segments.find((segment) => segment.phase === phase);
  return seg ? (seg.start + seg.end) / 2 : 720;
};

function Figures({
  phase,
  progress,
  night,
}: {
  phase: ErrandPhase;
  progress: number;
  night: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!;
    ctx.clearRect(0, 0, 1000, 560);
    ctx.fillStyle = night ? '#213836' : '#e5ead8';
    ctx.fillRect(0, 0, 1000, 560);
    const facings = ['se', 'sw', 'ne', 'nw'] as const;
    ctx.fillStyle = night ? '#f7edce' : '#385244';
    ctx.font = '13px "Space Mono"';
    facings.forEach((facing, col) => ctx.fillText(facing.toUpperCase(), 246 + col * 206, 26));
    kinds.forEach((kind, row) => {
      const y = 133 + row * 132;
      ctx.fillStyle = night ? '#f7edce' : '#385244';
      ctx.fillText(SEASONS[row], 22, y - 38);
      ctx.font = '11px "Space Mono"';
      ctx.fillText(kind, 22, y - 18);
      ctx.font = '13px "Space Mono"';
      facings.forEach((facing, col) => {
        for (const [index, figure] of (['female', 'male'] as const).entries())
          drawResident(
            ctx,
            { ...places[0].resident, figure, outfit: row % 2 ? '#789B76' : '#AD88AE' },
            224 + col * 206 + index * 77,
            y,
            2.6,
            {
              facing,
              moving: phase === 'outbound' || phase === 'carrying' || phase === 'returning',
              walkPhase: progress * 2,
              greeting: false,
              errand: { kind, phase, progress },
            },
            { night },
          );
      });
    });
  }, [phase, progress, night]);
  return (
    <canvas
      ref={canvas}
      width={1000}
      height={560}
      aria-label="Seasonal props on both resident figures, facing all four directions"
    />
  );
}

function Review() {
  const [day, setDay] = useState(initialDay);
  const [minutes, setMinutes] = useState(() =>
    bounded(query.get('time'), 0, 1439.99, middle(initialDay, initialPhase)),
  );
  const [playing, setPlaying] = useState(false);
  const [followed, setFollowed] = useState<string | null>(initialTrip?.residentId ?? null);
  const [selected, setSelected] = useState<string | null>(initialTrip?.ritual.pickup.plot ?? null);
  const [view, setView] = useState(query.get('view') === 'figures' ? 'figures' : 'town');
  const [figurePhase, setFigurePhase] = useState<ErrandPhase>(initialPhase);
  const [figureProgress, setFigureProgress] = useState(0.5);
  const [night, setNight] = useState(false);
  const city = useRef<CityHandle>(null);
  const trip = useMemo(() => firstTrip(day), [day]);
  const calendar = townCalendarAt(day, minutes);
  const residents = useMemo(() => simulateResidents(places, minutes, day), [minutes, day]);
  const active = trip?.segments.find(
    (segment) => minutes >= segment.start && minutes < segment.end,
  );

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last >= 1000 / 30) {
        const elapsed = Math.min(0.2, (now - last) / 1000);
        last = now;
        if (view === 'figures') setFigureProgress((value) => (value + elapsed / 6) % 1);
        else
          setMinutes((value) => {
            const end = Math.min(1439, (trip?.homeBy ?? 1190) + 10);
            if (value + elapsed >= end) {
              setPlaying(false);
              return end;
            }
            return value + elapsed;
          });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, view, trip]);

  useEffect(() => {
    if (playing) return;
    const params = new URLSearchParams({ day: String(day - YEAR), time: minutes.toFixed(3), view });
    history.replaceState(null, '', `${location.pathname}?${params}`);
  }, [day, minutes, playing, view]);

  const showPhase = (phase: ErrandPhase) => {
    setPlaying(false);
    setFigurePhase(phase);
    setFigureProgress(0.5);
    setMinutes(middle(day, phase));
    setFollowed(trip?.residentId ?? null);
    setSelected(null);
  };
  const visit = (plot: string) => {
    setSelected(plot);
    setFollowed(null);
    city.current?.focus(plot);
  };
  return (
    <main className="errand-review">
      <header className="review-heading">
        <a href="/" aria-label="Open the live town">
          <BrandMark />
          <span>forktown.</span>
        </a>
        <div>
          <h1>Four small ways to help.</h1>
          <p>Seasonal errands · a replay of the real town</p>
        </div>
        <span className="review-date">
          {calendar.label}
          <b>{timeLabel(minutes)}</b>
        </span>
      </header>
      <nav className="review-seasons" aria-label="Season">
        {scenes.map((scene, index) => (
          <button
            key={index}
            aria-pressed={calendar.seasonIndex === index}
            onClick={() => {
              setPlaying(false);
              setDay(scene.day);
              setMinutes(middle(scene.day, 'carrying'));
              setFollowed(scene.trip?.residentId ?? null);
              setSelected(null);
            }}
          >
            {SEASONS[index]}
          </button>
        ))}
        <span />
        <button aria-pressed={view === 'town'} onClick={() => setView('town')}>
          Town view
        </button>
        <button aria-pressed={view === 'figures'} onClick={() => setView('figures')}>
          Animation studio
        </button>
      </nav>
      {view === 'town' ? (
        <div className="review-world">
          <City
            ref={city}
            places={places}
            residents={residents}
            selectedPlot={selected}
            onSelect={visit}
            night={minutes < 360 || minutes >= 1200}
            showPlots={false}
            events={eventsForDay(day, minutes)}
            minutes={minutes}
            day={day}
            football={footballAt(minutes, day)}
            onListening={noListening}
            onCinemaListening={noListening}
            followed={followed}
            onStopFollowing={() => setFollowed(null)}
            onResidentSelect={setFollowed}
          />
          <aside>
            <span className="eyebrow">A LITTLE HELP, IN SEASON</span>
            <SeasonalErrandCard
              places={places}
              minutes={minutes}
              day={day}
              onVisit={visit}
              onFollow={setFollowed}
            />
            <div className="review-details">
              <p>One neighbor. One useful round. Home in time for the rest of the day.</p>
              <p>
                Preview controls below replay the same journey. The public town keeps its shared
                clock.
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <section className="review-studio" aria-label="Animation studio">
          <Figures phase={figurePhase} progress={figureProgress} night={night} />
          <label>
            <input
              type="checkbox"
              checked={night}
              onChange={(event) => setNight(event.target.checked)}
            />{' '}
            Night palette
          </label>
          <label>
            Handoff progress
            <input
              aria-label="Handoff progress"
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={figureProgress}
              onChange={(event) => {
                setPlaying(false);
                setFigureProgress(Number(event.target.value));
              }}
            />
          </label>
        </section>
      )}
      <footer className="review-controls">
        <div role="group" aria-label="Journey stages">
          {phases.map((phase, index) => (
            <button
              key={phase}
              aria-pressed={view === 'town' ? active?.phase === phase : figurePhase === phase}
              onClick={() => showPhase(phase)}
            >
              {phaseNames[index]}
            </button>
          ))}
        </div>
        <button className="review-play" onClick={() => setPlaying(!playing)}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <label>
          Town time
          <input
            aria-label="Town time"
            type="range"
            min={Math.max(360, (trip?.depart ?? 480) - 10)}
            max={Math.min(1200, (trip?.homeBy ?? 1080) + 10)}
            step="0.05"
            value={minutes}
            onChange={(event) => {
              setPlaying(false);
              setMinutes(Number(event.target.value));
            }}
          />
        </label>
      </footer>
    </main>
  );
}
const root = createRoot(document.getElementById('root')!);
root.render(<Review />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
