import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Crosshair, Minus, Plus, MapPin } from 'lucide-react';
import { cityHit, renderCity, type Camera } from '../city/render';
import { findPlotAt, getPlot, plotCenter, unproject } from '../lib/world';
import type { Place } from '../lib/schema';
import type { ResidentState } from '../lib/simulation';
import { residentActivityLabel } from '../lib/simulation';
import { VENUES, venueAt, type TownEvent } from '../lib/events';
import { project, WORLD_BOUNDS } from '../lib/world';

export type CityHandle = {
  focus: (plotId: string) => void;
  reset: () => void;
  stopFollowing: () => void;
};
type Props = {
  places: Place[];
  selectedPlot: string | null;
  onSelect: (plotId: string) => void;
  night: boolean;
  showPlots: boolean;
  residents: ResidentState[];
  events: TownEvent[];
  minutes: number;
  followed: string | null;
  onStopFollowing: () => void;
  onResidentSelect: (id: string) => void;
};

const City = forwardRef<CityHandle, Props>(function City(
  {
    places,
    selectedPlot,
    onSelect,
    night,
    showPlots,
    residents,
    events,
    minutes,
    followed,
    onStopFollowing,
    onResidentSelect,
  },
  ref,
) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 900, height: 580 });
  const [camera, setCamera] = useState<Camera>({ x: 450, y: 40, zoom: 0.57 });
  const [hover, setHover] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tip, setTip] = useState({ x: 0, y: 0 });
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    cx: number;
    cy: number;
    moved: boolean;
  } | null>(null);
  const fit = useRef(0.57);
  const initialPlaces = useRef(places);
  const selectedRef = useRef(selectedPlot);
  selectedRef.current = selectedPlot;
  const cameraRef = useRef(camera);
  const tracked = residents.find((resident) => resident.id === followed);
  const trackedPoint = tracked ? project(tracked.position.x, tracked.position.y) : null;
  const renderedCamera = trackedPoint
    ? {
        ...camera,
        x: size.width / 2 - trackedPoint.x * camera.zoom,
        y: size.height / 2 - trackedPoint.y * camera.zoom,
      }
    : camera;
  cameraRef.current = renderedCamera;
  const defaultCamera = useCallback((width: number, height: number): Camera => {
    const zoom = Math.max(
      0.01,
      Math.min(
        (width - 52) / (WORLD_BOUNDS.right - WORLD_BOUNDS.left + 36),
        (height - 85) / (WORLD_BOUNDS.bottom + 98),
      ),
    );
    fit.current = zoom;
    return {
      x: width / 2 - ((WORLD_BOUNDS.left + WORLD_BOUNDS.right) / 2) * zoom,
      y: (height - WORLD_BOUNDS.bottom * zoom) / 2 + 28,
      zoom,
    };
  }, []);
  useEffect(() => {
    if (followed) {
      setHover(null);
      canvas.current?.focus({ preventScroll: true });
      setCamera((old) => ({ ...old, zoom: Math.max(old.zoom, 0.6, fit.current * 1.8) }));
    }
  }, [followed]);
  const reset = useCallback(
    () => setCamera(defaultCamera(size.width, size.height)),
    [defaultCamera, size],
  );
  const neighborhoodCamera = useCallback(
    (width: number, height: number): Camera => {
      const overview = defaultCamera(width, height);
      const points = [
        ...initialPlaces.current.map((place) => place.plot),
        ...VENUES.map((venue) => venue.plot),
      ].flatMap((id) => {
        const plot = getPlot(id);
        return plot ? [plotCenter(plot)] : [];
      });
      if (!points.length) return overview;
      const left = Math.min(...points.map((point) => point.x)) - 110;
      const right = Math.max(...points.map((point) => point.x)) + 110;
      const top = Math.min(...points.map((point) => point.y)) - 145;
      const bottom = Math.max(...points.map((point) => point.y)) + 80;
      const zoom = Math.max(
        overview.zoom,
        Math.min(
          0.85,
          (width < 600 ? width * 1.6 : width - 150) / (right - left),
          (height - 160) / (bottom - top),
        ),
      );
      return {
        x: width / 2 - ((left + right) / 2) * zoom,
        y: height * (width < 600 ? 0.42 : 0.5) - ((top + bottom) / 2) * zoom,
        zoom,
      };
    },
    [defaultCamera],
  );
  const stopFollowing = useCallback(() => {
    setCamera(cameraRef.current);
    onStopFollowing();
  }, [onStopFollowing]);
  useImperativeHandle(
    ref,
    () => ({
      reset,
      stopFollowing,
      focus: (id) => {
        const plot = getPlot(id);
        if (!plot) return;
        const pt = plotCenter(plot);
        const zoom = Math.max(fit.current, 0.85, cameraRef.current.zoom);
        setCamera({
          x: size.width / 2 - pt.x * zoom,
          y: size.height * (size.width < 600 ? 0.33 : 0.5) - (pt.y - 35) * zoom,
          zoom,
        });
      },
    }),
    [reset, size, stopFollowing],
  );
  useEffect(() => {
    if (!wrapper.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width,
        height = entry.contentRect.height;
      setSize({ width, height });
      const initial = neighborhoodCamera(width, height);
      const selected = getPlot(selectedRef.current ?? '');
      if (selected) {
        const point = plotCenter(selected),
          zoom = Math.max(initial.zoom, 0.85);
        setCamera({
          x: width / 2 - point.x * zoom,
          y: height * (width < 600 ? 0.33 : 0.5) - (point.y - 35) * zoom,
          zoom,
        });
      } else setCamera(initial);
    });
    observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, [neighborhoodCamera]);
  const zoomBy = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      setCamera((old) => {
        const zoom = Math.max(
          fit.current * 0.65,
          Math.min(Math.max(1.2, fit.current * 3.5), old.zoom * factor),
        );
        const a = anchor ?? { x: size.width / 2, y: size.height / 2 };
        return {
          x: a.x - ((a.x - old.x) * zoom) / old.zoom,
          y: a.y - ((a.y - old.y) * zoom) / old.zoom,
          zoom,
        };
      });
    },
    [size],
  );
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = el.getBoundingClientRect();
      zoomBy(Math.exp(-event.deltaY * 0.0015), {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [zoomBy]);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (el.width !== Math.floor(size.width * ratio)) el.width = size.width * ratio;
    if (el.height !== Math.floor(size.height * ratio)) el.height = size.height * ratio;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    renderCity({
      ctx,
      width: size.width,
      height: size.height,
      camera: cameraRef.current,
      places,
      selectedPlot,
      hoveredPlot: hover,
      night,
      showPlots,
      residents,
      events,
      minutes,
      followed,
    });
  }, [
    size,
    camera,
    places,
    selectedPlot,
    hover,
    night,
    showPlots,
    residents,
    followed,
    events,
    minutes,
  ]);
  const hit = (clientX: number, clientY: number) => {
    const bounds = canvas.current!.getBoundingClientRect();
    const local = { x: clientX - bounds.left, y: clientY - bounds.top };
    const current = cameraRef.current;
    const world = {
      x: (local.x - current.x) / current.zoom,
      y: (local.y - current.y) / current.zoom,
    };
    const ground = unproject(world.x, world.y);
    const target = cityHit(world, places, residents);
    return {
      id: target?.kind === 'place' ? target.id : (findPlotAt(ground.x, ground.y)?.id ?? null),
      residentId: target?.kind === 'resident' ? target.id : undefined,
      local,
    };
  };
  const hoveredPlace = places.find((place) => place.plot === hover);
  return (
    <div
      ref={wrapper}
      className={`city-stage ${night ? 'is-night' : ''} ${dragging ? 'is-dragging' : ''}`}
    >
      <canvas
        ref={canvas}
        role="img"
        tabIndex={0}
        aria-label="Interactive Forktown map. Drag to pan, scroll or use plus and minus to zoom. Arrow keys move the map; Home shows the whole town. Use Explore places to select a house with a keyboard."
        onKeyDown={(event) => {
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [35, 0],
            ArrowRight: [-35, 0],
            ArrowUp: [0, 35],
            ArrowDown: [0, -35],
          };
          if (moves[event.key]) {
            onStopFollowing();
            event.preventDefault();
            const [x, y] = moves[event.key];
            const actual = cameraRef.current;
            setCamera({ ...actual, x: actual.x + x, y: actual.y + y });
          }
          if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            zoomBy(1.2);
          }
          if (event.key === '-') {
            event.preventDefault();
            zoomBy(1 / 1.2);
          }
          if (event.key === 'Home') {
            onStopFollowing();
            event.preventDefault();
            reset();
          }
        }}
        onPointerDown={(event) => {
          if (pointer.current || event.button !== 0) return;
          const actual = cameraRef.current;
          if (followed) {
            stopFollowing();
          }
          pointer.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            cx: actual.x,
            cy: actual.y,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (pointer.current && pointer.current.id === event.pointerId) {
            const p = pointer.current,
              dx = event.clientX - p.x,
              dy = event.clientY - p.y;
            if (Math.abs(dx) + Math.abs(dy) > 5) p.moved = true;
            if (p.moved) {
              setDragging(true);
              setHover(null);
              setCamera((old) => ({ ...old, x: p.cx + dx, y: p.cy + dy }));
            }
          } else {
            const { id, local } = hit(event.clientX, event.clientY);
            setHover(id);
            setTip(local);
          }
        }}
        onPointerUp={(event) => {
          const p = pointer.current;
          if (!p || p.id !== event.pointerId) return;
          if (!p.moved) {
            const { id, residentId } = hit(event.clientX, event.clientY);
            if (residentId) onResidentSelect(residentId);
            else if (id) onSelect(id);
          }
          pointer.current = null;
          setDragging(false);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          pointer.current = null;
          setDragging(false);
        }}
        onPointerLeave={() => setHover(null)}
      />
      {tracked && (
        <div className="follow-status">
          <span>
            <strong>{tracked.resident.name}</strong>
            {residentActivityLabel(tracked)}
          </span>
          <button onClick={stopFollowing}>Stop following</button>
        </div>
      )}
      {hover && !dragging && (
        <div
          className="map-tooltip"
          style={{
            left: Math.max(10, Math.min(size.width - 205, tip.x + 14)),
            top: Math.max(55, Math.min(size.height - 90, tip.y - 60)),
          }}
        >
          <MapPin size={13} />
          <span>
            {hoveredPlace?.name ?? venueAt(hover)?.name ?? `Plot ${hover} · Make it yours`}
          </span>
        </div>
      )}
      <div className="map-controls">
        <button aria-label="Zoom in" onClick={() => zoomBy(1.2)}>
          <Plus size={17} />
        </button>
        <span aria-label={`Zoom ${Math.round((camera.zoom / fit.current) * 100)} percent`}>
          {Math.round((camera.zoom / fit.current) * 100)}%
        </span>
        <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
          <Minus size={17} />
        </button>
        <span className="control-divider" />
        <button
          aria-label="Reset map view"
          onClick={() => {
            onStopFollowing();
            reset();
          }}
        >
          <Crosshair size={17} />
        </button>
      </div>
    </div>
  );
});
export default City;
