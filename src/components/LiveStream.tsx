import { useEffect, useMemo, useRef, useState } from 'react';
import { renderCity, type Camera } from '../city/render';
import { eventsForDay } from '../lib/events';
import { footballAt, footballListening } from '../lib/football';
import { easeLiveCamera, liveCamera, liveProgram, liveShotAt } from '../lib/live-director';
import { latestArrival, places } from '../lib/places';
import { project } from '../lib/world';
import { townCatAt, TOWN_CAT_NAME } from '../lib/town-cat';
import { simulateResidents } from '../lib/simulation';
import { useTownClock } from '../lib/use-town-clock';
import { trackForTown } from '../music/score';
import Soundtrack from './Soundtrack';
import ResidentPreview from './ResidentPreview';
import '../live.css';

export default function LiveStream() {
  const clock = useTownClock({ autoPlay: true });
  const canvas = useRef<HTMLCanvasElement>(null);
  const followLabel = useRef<HTMLDivElement>(null);
  const camera = useRef<Camera | null>(null);
  const lastPaint = useRef<number | null>(null);
  const lastShot = useRef<string | null>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [listening, setListening] = useState({ gain: 0, pan: 0 });
  const program = useMemo(() => liveProgram(places, clock.day), [clock.day]);
  const events = useMemo(() => eventsForDay(clock.day), [clock.day]);
  const residents = useMemo(
    () => simulateResidents(places, clock.minutes, clock.day),
    [clock.minutes, clock.day],
  );
  const football = useMemo(() => footballAt(clock.minutes, clock.day), [clock.minutes, clock.day]);
  const shot = liveShotAt(program, clock.minutes, residents);
  const followedResident = residents.find((resident) => resident.id === shot.residentId);
  const cat = townCatAt(places, clock.minutes);
  const followPosition =
    followedResident?.position ?? (shot.kind === 'cat' ? cat.position : undefined);
  const followName =
    followedResident?.resident.name ?? (shot.kind === 'cat' ? TOWN_CAT_NAME : undefined);
  const night = clock.minutes < 360 || clock.minutes >= 1200;

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
    const target = liveCamera(shot, size.width, size.height, clock.minutes);
    const old = camera.current;
    const subjectX = old ? shot.center.x * old.zoom + old.x : 0;
    const subjectY = old ? shot.center.y * old.zoom + old.y : 0;
    const distantCut =
      lastShot.current !== shot.id &&
      (subjectX < 60 || subjectX > size.width - 60 || subjectY < 80 || subjectY > size.height - 60);
    camera.current =
      camera.current === null || elapsed > 2 || distantCut
        ? target
        : easeLiveCamera(camera.current, target, elapsed);
    lastShot.current = shot.id;
    lastPaint.current = now;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    renderCity({
      ctx,
      ...size,
      camera: camera.current,
      places,
      residents,
      events,
      football,
      minutes: clock.minutes,
      night,
      selectedPlot: null,
      hoveredPlot: null,
      showPlots: false,
      followed: shot.residentId,
    });
    if (followLabel.current && followPosition) {
      const point = project(followPosition.x, followPosition.y);
      const x = point.x * camera.current.zoom + camera.current.x;
      const y =
        (point.y - (shot.kind === 'cat' ? 24 : 43)) * camera.current.zoom + camera.current.y;
      const halfLabel = followLabel.current.offsetWidth / 2 + 12;
      followLabel.current.style.left = `${Math.max(halfLabel, Math.min(size.width - halfLabel, x))}px`;
      followLabel.current.style.top = `${Math.max(90, Math.min(size.height - 30, y))}px`;
      followLabel.current.style.visibility =
        x >= 0 && x <= size.width && y >= 0 && y <= size.height ? 'visible' : 'hidden';
    }
    const field = footballListening(camera.current, size.width, size.height);
    setListening((old) =>
      Math.abs(old.gain - field.gain) < 0.002 && Math.abs(old.pan - field.pan) < 0.002
        ? old
        : field,
    );
  }, [
    size,
    residents,
    events,
    football,
    clock.minutes,
    night,
    shot.center.x,
    shot.center.y,
    shot.width,
    shot.height,
    shot.residentId,
    followedResident,
    followPosition?.x,
    followPosition?.y,
    shot.id,
    shot.kind,
  ]);

  return (
    <main className={`live-stream ${night ? 'live-stream-night' : ''}`}>
      <h1 className="sr-only">Forktown live stream</h1>
      <canvas ref={canvas} role="img" aria-label={`Forktown live: ${shot.label}`} />
      <div className="live-watermark" role="img" aria-label="Forktown">
        <span className="brand-mark" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
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
            <span className="live-arrival-home">
              {latestArrival?.name ?? 'A little town, growing together'}
            </span>
          </div>
        </div>
      </aside>
      {followName && (
        <div ref={followLabel} className="live-follow-label live-glass" role="status">
          <span className="live-caption">
            <i aria-hidden="true" />
            Following
          </span>
          <strong>{followName}</strong>
        </div>
      )}
      <Soundtrack
        track={trackForTown(clock.minutes, events)}
        playing={clock.playing}
        football={football}
        listening={listening}
        autoStart
        hideControls
      />
    </main>
  );
}
