import { useEffect, useMemo, useRef, useState } from 'react';
import { renderCity, type Camera } from '../city/render';
import { eventsForDay } from '../lib/events';
import { footballAt, footballListening } from '../lib/football';
import { easeLiveCamera, liveCamera, liveProgram, liveShotAt } from '../lib/live-director';
import { places } from '../lib/places';
import { simulateResidents } from '../lib/simulation';
import { useTownClock } from '../lib/use-town-clock';
import { trackForTown } from '../music/score';
import Soundtrack from './Soundtrack';
import '../live.css';

export default function LiveStream() {
  const clock = useTownClock({ autoPlay: true });
  const canvas = useRef<HTMLCanvasElement>(null);
  const camera = useRef<Camera | null>(null);
  const lastPaint = useRef<number | null>(null);
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
    const target = liveCamera(shot, size.width, size.height);
    camera.current =
      camera.current === null || elapsed > 2
        ? target
        : easeLiveCamera(camera.current, target, elapsed);
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
    });
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
