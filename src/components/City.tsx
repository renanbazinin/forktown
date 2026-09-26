import { isZooPlot, ZOO_FRAME } from '../lib/zoo';
import { FARM, FARM_FRAME, isFarmPlot } from '../lib/farm';
import { isMillpondPlot, MILLPOND_FRAME, MILLPOND_VENUE } from '../lib/millpond';
import { isTubePlot, tubeFrame, tubeStation, TUBE_LINE_NAME } from '../lib/tubes';
import { places as publishedPlaces } from '../lib/places';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Crosshair, Minus, Plus, MapPin } from 'lucide-react';
import { cityHit, renderCity, type Camera } from '../city/render';
import { findPlotAt, getPlot, plotCenter, unproject } from '../lib/world';
import type { Place } from '../lib/schema';
import type { ResidentState } from '../lib/simulation';
import { residentActivityLabel } from '../lib/simulation';
import { PLOT_COPY } from '../lib/brand';
import { VENUES, venueAt, type TownEvent } from '../lib/events';
import { CINEMA_FRAME, isCinemaPlot, cinemaAt, cinemaListening } from '../lib/cinema';
import { project, WORLD_BOUNDS } from '../lib/world';
import {
  clampZoom,
  pinchView,
  resizeView,
  zoomAround,
  type Point,
  type Size,
} from '../lib/map-view';
import {
  FOOTBALL_CENTER,
  FOOTBALL_VENUE,
  isFootballPlot,
  footballListening,
  type FootballState,
} from '../lib/football';

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
  day: number;
  football: FootballState;
  onListening: (listening: { gain: number; pan: number }) => void;
  onCinemaListening: (listening: { gain: number; pan: number }) => void;
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
    day,
    football,
    onListening,
    onCinemaListening,
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
  // Every pointer held on the map, in page coordinates. Two fingers pinch.
  const down = useRef(new Map<number, Point>());
  const pinch = useRef<{
    ids: [number, number];
    from: [Point, Point];
    start: Camera;
    view: Camera;
  } | null>(null);
  // The view the map chose for itself: the opening view, a selection, or the whole town. Until
  // the visitor moves the map, a resize frames the same thing again; after that, their view stays.
  const framing = useRef<((width: number, height: number) => Camera) | null>(null);
  const measured = useRef<Size | null>(null);
  const fit = useRef(0.57);
  const initialPlaces = useRef(places);
  const selectedRef = useRef(selectedPlot);
  selectedRef.current = selectedPlot;
  const cameraRef = useRef(camera);
  const tracked = residents.find((resident) => resident.id === followed);
  const trackedGround = tracked ? project(tracked.position.x, tracked.position.y) : null;
  // A neighbor on the tube is followed up the stack and along the glass. The lift is continuous
  // through boarding, riding and stepping off, so the map never jumps.
  const trackedPoint = trackedGround
    ? { x: trackedGround.x, y: trackedGround.y - (tracked?.transit?.altitude ?? 0) }
    : null;
  const renderedCamera = trackedPoint
    ? {
        ...camera,
        x: size.width / 2 - trackedPoint.x * camera.zoom,
        y: size.height / 2 - trackedPoint.y * camera.zoom,
      }
    : camera;
  cameraRef.current = renderedCamera;
  useEffect(() => {
    onListening(footballListening(renderedCamera, size.width, size.height));
    onCinemaListening(cinemaListening(renderedCamera, size.width, size.height));
  }, [
    renderedCamera.x,
    renderedCamera.y,
    renderedCamera.zoom,
    size.width,
    size.height,
    onListening,
    onCinemaListening,
  ]);
  const footballCamera = (width: number, height: number): Camera => {
    const pt = project(FOOTBALL_CENTER.x, FOOTBALL_CENTER.y);
    const mobile = width < 600;
    const usableWidth = mobile ? width - 20 : width - 400;
    const usableHeight = mobile ? height * 0.43 : height - 150;
    const zoom = Math.max(0.25, Math.min(1.45, usableWidth / 735, usableHeight / 445));
    return {
      x: (mobile ? width / 2 : (width - 370) / 2) - pt.x * zoom,
      y: (mobile ? height * 0.3 : height * 0.52) - pt.y * zoom,
      zoom,
    };
  };
  const cinemaCamera = (width: number, height: number): Camera => {
    const mobile = width < 600;
    const zoom = Math.max(
      0.1,
      Math.min(
        2.2,
        (width - (mobile ? 24 : 400)) / CINEMA_FRAME.width,
        (mobile ? height * 0.43 : height - 150) / CINEMA_FRAME.height,
      ),
    );
    return {
      x: (mobile ? width / 2 : (width - 370) / 2) - CINEMA_FRAME.center.x * zoom,
      y: (mobile ? height * 0.29 : height * 0.5) - CINEMA_FRAME.center.y * zoom,
      zoom,
    };
  };
  const zooCamera = (width: number, height: number): Camera => {
    const mobile = width < 600;
    const zoom = Math.max(
      0.05,
      Math.min(
        1.4,
        (width - (mobile ? 24 : 400)) / ZOO_FRAME.width,
        (mobile ? height * 0.43 : height - 150) / ZOO_FRAME.height,
      ),
    );
    return {
      x: (mobile ? width / 2 : (width - 370) / 2) - ZOO_FRAME.center.x * zoom,
      y: (mobile ? height * 0.29 : height * 0.5) - ZOO_FRAME.center.y * zoom,
      zoom,
    };
  };
  const millpondCamera = (width: number, height: number): Camera => {
    const mobile = width < 600;
    const zoom = Math.max(
      0.05,
      Math.min(
        1.4,
        (width - (mobile ? 24 : 400)) / MILLPOND_FRAME.width,
        (mobile ? height * 0.43 : height - 150) / MILLPOND_FRAME.height,
      ),
    );
    return {
      x: (mobile ? width / 2 : (width - 370) / 2) - MILLPOND_FRAME.center.x * zoom,
      y: (mobile ? height * 0.29 : height * 0.5) - MILLPOND_FRAME.center.y * zoom,
      zoom,
    };
  };
  // Frames one station, its spur and the stretch of trunk behind it.
  const tubeCamera = (width: number, height: number, id: string): Camera => {
    const frame = tubeFrame(id);
    const mobile = width < 600;
    const zoom = Math.max(
      0.05,
      Math.min(
        1.4,
        (width - (mobile ? 24 : 400)) / frame.width,
        (mobile ? height * 0.43 : height - 150) / frame.height,
      ),
    );
    return {
      x: (mobile ? width / 2 : (width - 370) / 2) - frame.center.x * zoom,
      y: (mobile ? height * 0.29 : height * 0.5) - frame.center.y * zoom,
      zoom,
    };
  };
  const farmCamera = (width: number, height: number): Camera => {
    const mobile = width < 600;
    const zoom = Math.max(
      0.05,
      Math.min(
        1.4,
        (width - (mobile ? 24 : 400)) / FARM_FRAME.width,
        (mobile ? height * 0.43 : height - 150) / FARM_FRAME.height,
      ),
    );
    return {
      x: (mobile ? width / 2 : (width - 370) / 2) - FARM_FRAME.center.x * zoom,
      y: (mobile ? height * 0.29 : height * 0.5) - (FARM_FRAME.center.y - 55) * zoom,
      zoom,
    };
  };
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
  // Frames one plot: a venue's own view, or a house near the middle at a readable zoom.
  const plotCamera = (id: string, width: number, height: number, zoomFloor = 0) => {
    if (isFarmPlot(id)) return farmCamera(width, height);
    if (isZooPlot(id)) return zooCamera(width, height);
    if (isMillpondPlot(id)) return millpondCamera(width, height);
    if (isTubePlot(id)) return tubeCamera(width, height, id);
    if (isCinemaPlot(id)) return cinemaCamera(width, height);
    if (isFootballPlot(id)) return footballCamera(width, height);
    const plot = getPlot(id);
    if (!plot) return null;
    const point = plotCenter(plot);
    const zoom = Math.max(fit.current, 0.85, zoomFloor);
    return {
      x: width / 2 - point.x * zoom,
      y: height * (width < 600 ? 0.33 : 0.5) - (point.y - 35) * zoom,
      zoom,
    };
  };
  useEffect(() => {
    if (followed) {
      framing.current = null;
      setHover(null);
      canvas.current?.focus({ preventScroll: true });
      setCamera((old) => ({ ...old, zoom: Math.max(old.zoom, 0.6, fit.current * 1.8) }));
    }
  }, [followed]);
  const reset = useCallback(() => {
    framing.current = defaultCamera;
    setCamera(defaultCamera(size.width, size.height));
  }, [defaultCamera, size]);
  const neighborhoodCamera = useCallback(
    (width: number, height: number): Camera => {
      const overview = defaultCamera(width, height);
      const all = [
        ...initialPlaces.current.map((place) => place.plot),
        ...VENUES.filter((venue) => venue.kind === 'green' || venue.kind === 'stage').map(
          (venue) => venue.plot,
        ),
      ].flatMap((id) => {
        const plot = getPlot(id);
        return plot ? [plotCenter(plot)] : [];
      });
      if (!all.length) return overview;
      // Frame where people live. A lone far-off house should not zoom the opening view back out.
      const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1];
      const mid = { x: median(all.map((p) => p.x)), y: median(all.map((p) => p.y)) };
      const distance = (p: { x: number; y: number }) => Math.hypot(p.x - mid.x, p.y - mid.y);
      const typical = median(all.map(distance));
      const points = all.filter((p) => distance(p) <= Math.max(typical * 2.2, 260));
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
    framing.current = null;
    setCamera(cameraRef.current);
    onStopFollowing();
  }, [onStopFollowing]);
  useImperativeHandle(
    ref,
    () => ({
      reset,
      stopFollowing,
      focus: (id) => {
        const zoomFloor = cameraRef.current.zoom;
        const view = plotCamera(id, size.width, size.height, zoomFloor);
        if (!view) return;
        framing.current = (width, height) => plotCamera(id, width, height, zoomFloor) ?? view;
        setCamera(view);
      },
    }),
    [reset, size, stopFollowing],
  );
  useEffect(() => {
    if (!wrapper.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      const last = measured.current;
      measured.current = next;
      setSize(next);
      const fitZoom = defaultCamera(next.width, next.height).zoom;
      if (last && !framing.current) {
        setCamera((old) => resizeView(old, last, next, fitZoom));
        return;
      }
      if (!framing.current) {
        const selected = selectedRef.current;
        framing.current = (width, height) =>
          (selected ? plotCamera(selected, width, height) : null) ??
          neighborhoodCamera(width, height);
      }
      setCamera(framing.current(next.width, next.height));
    });
    observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, [defaultCamera, neighborhoodCamera]);
  const zoomBy = useCallback(
    (factor: number, anchor?: Point) => {
      framing.current = null;
      setCamera((old) => {
        const pitch = project(FOOTBALL_CENTER.x, FOOTBALL_CENTER.y);
        const a =
          anchor ??
          (isFootballPlot(selectedRef.current ?? '')
            ? { x: pitch.x * old.zoom + old.x, y: pitch.y * old.zoom + old.y }
            : { x: size.width / 2, y: size.height / 2 });
        return zoomAround(old, clampZoom(old.zoom * factor, fit.current), a);
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
      ufoPlaces: publishedPlaces,
      selectedPlot,
      hoveredPlot: hover,
      night,
      showPlots,
      residents,
      events,
      minutes,
      day,
      football,
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
    day,
    football,
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
    const target = cityHit(world, places, residents, cinemaAt(minutes, day).screenReveal);
    return {
      id: target?.kind === 'place' ? target.id : (findPlotAt(ground.x, ground.y)?.id ?? null),
      residentId: target?.kind === 'resident' ? target.id : undefined,
      local,
    };
  };
  const local = (point: Point) => {
    const bounds = canvas.current!.getBoundingClientRect();
    return { x: point.x - bounds.left, y: point.y - bounds.top };
  };
  /** A pointer leaves the map. If it was half of a pinch, the other finger carries on dragging. */
  const lift = (id: number) => {
    const p = pinch.current;
    down.current.delete(id);
    if (!p?.ids.includes(id)) return false;
    const rest = p.ids[0] === id ? p.ids[1] : p.ids[0];
    const at = down.current.get(rest)!;
    pinch.current = null;
    pointer.current = { id: rest, x: at.x, y: at.y, cx: p.view.x, cy: p.view.y, moved: true };
    return true;
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
        aria-label={PLOT_COPY.map}
        onKeyDown={(event) => {
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [35, 0],
            ArrowRight: [-35, 0],
            ArrowUp: [0, 35],
            ArrowDown: [0, -35],
          };
          if (moves[event.key]) {
            onStopFollowing();
            framing.current = null;
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
          if (event.button !== 0) return;
          const at = { x: event.clientX, y: event.clientY };
          const first = pointer.current;
          if (first && !pinch.current) {
            // A second finger turns the drag into a pinch around the point between the two.
            const start = cameraRef.current;
            down.current.set(event.pointerId, at);
            pinch.current = {
              ids: [first.id, event.pointerId],
              from: [local(down.current.get(first.id) ?? first), local(at)],
              start,
              view: start,
            };
            first.moved = true;
            framing.current = null;
            setDragging(true);
            setHover(null);
            event.currentTarget.setPointerCapture(event.pointerId);
            return;
          }
          if (first) return;
          down.current.set(event.pointerId, at);
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
          const two = pinch.current;
          if (two?.ids.includes(event.pointerId)) {
            down.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const [a, b] = two.ids.map((id) => local(down.current.get(id)!));
            two.view = pinchView(two.start, two.from, [a, b], fit.current);
            setCamera(two.view);
          } else if (pointer.current && pointer.current.id === event.pointerId) {
            down.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const p = pointer.current,
              dx = event.clientX - p.x,
              dy = event.clientY - p.y;
            if (Math.abs(dx) + Math.abs(dy) > 5) p.moved = true;
            if (p.moved) {
              framing.current = null;
              setDragging(true);
              setHover(null);
              setCamera((old) => ({ ...old, x: p.cx + dx, y: p.cy + dy }));
            }
          } else if (!two) {
            const { id, local } = hit(event.clientX, event.clientY);
            setHover(id);
            setTip(local);
          }
        }}
        onPointerUp={(event) => {
          if (lift(event.pointerId)) return;
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
        onPointerCancel={(event) => {
          if (lift(event.pointerId) || pointer.current?.id !== event.pointerId) return;
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
            {hoveredPlace?.name ??
              venueAt(hover)?.name ??
              (isFarmPlot(hover)
                ? FARM.name
                : isFootballPlot(hover)
                  ? FOOTBALL_VENUE.name
                  : isMillpondPlot(hover)
                    ? MILLPOND_VENUE.name
                    : isTubePlot(hover)
                      ? `${tubeStation(hover).name} · ${TUBE_LINE_NAME}`
                      : PLOT_COPY.tooltip(hover))}
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
