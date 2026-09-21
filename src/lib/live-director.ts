import type { Camera } from '../city/render';
import { eventsForDay, VENUES } from './events';
import { FOOTBALL_CENTER } from './football';
import type { Place } from './schema';
import { simulateResidents, type ResidentState } from './simulation';
import { getPlot, plotCenter, project, type Point } from './world';

export type LiveShot = {
  id: string;
  kind: 'neighbor' | 'event' | 'home' | 'venue';
  label: string;
  center: Point;
  width: number;
  height: number;
  residentId?: string;
};
export type LiveProgram = ReturnType<typeof liveProgram>;
const cycle = (value: number, length: number) => ((value % length) + length) % length;

/** One feature per town day; the midnight feature belongs to the preceding evening. */
export function liveFeature(day: number) {
  const choice = cycle(day, 4);
  if (choice === 3)
    return {
      id: 'football',
      label: 'An afternoon at the Meadow Ground',
      start: 640,
      end: 780,
      center: project(FOOTBALL_CENTER.x, FOOTBALL_CENTER.y),
      width: 850,
      height: 540,
    };
  const event = eventsForDay(day)[choice];
  const center = plotCenter(getPlot(event.venue.plot)!);
  return {
    id: event.id,
    label: event.name,
    start: event.start,
    end: event.end,
    center: { x: center.x, y: center.y - 35 },
    width: 520,
    height: 370,
  };
}

export function liveProgram(places: Place[], day: number) {
  // Prefer a real walker over a seated football spectator. Keep this casting stable all day.
  const morning = simulateResidents(places, 450, day);
  const walkers = morning.filter((resident) => resident.activity === 'stroll' && !resident.event);
  const candidates = (
    walkers.length ? walkers : morning.filter((r) => r.activity === 'stroll')
  ).sort((a, b) => a.id.localeCompare(b.id));
  return {
    day,
    neighborId: candidates.length ? candidates[cycle(day, candidates.length)].id : undefined,
    feature: liveFeature(day),
    previousFeature: liveFeature(day - 1),
    homes: [...places].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function liveShotAt(
  program: LiveProgram,
  minutes: number,
  residents: ResidentState[],
): LiveShot {
  const time = cycle(minutes, 1440);
  const feature = time < 360 ? program.previousFeature : program.feature;
  const featureTime = time < 360 ? time + 1440 : time;
  if (featureTime >= feature.start && featureTime < feature.end)
    return {
      ...feature,
      id: `event:${time < 360 ? program.day - 1 : program.day}:${feature.id}`,
      kind: 'event',
    };

  const neighbor = residents.find((resident) => resident.id === program.neighborId);
  if (time >= 450 && time < 630 && neighbor?.activity === 'stroll') {
    const point = project(neighbor.position.x, neighbor.position.y);
    return {
      id: `neighbor:${program.day}:${neighbor.id}`,
      kind: 'neighbor',
      label: `A morning with ${neighbor.resident.name}`,
      residentId: neighbor.id,
      center: { x: point.x, y: point.y - 22 },
      width: 540,
      height: 380,
    };
  }

  // Every postcard is anchored to an occupied home, never empty land or a map edge.
  const beat = Math.floor(time / 90);
  const id = `postcard:${program.day}:${beat}`;
  const home = program.homes[cycle(program.day + beat, program.homes.length)];
  if (home) {
    const point = plotCenter(getPlot(home.plot)!);
    return {
      id,
      kind: 'home',
      label: home.name,
      center: { x: point.x, y: point.y - 40 },
      width: 460,
      height: 340,
    };
  }
  // A new town with no homes still has a real public landmark to film.
  const venue = VENUES[1];
  const point = plotCenter(getPlot(venue.plot)!);
  return {
    id,
    kind: 'venue',
    label: venue.name,
    center: { x: point.x, y: point.y - 35 },
    width: 520,
    height: 370,
  };
}

export function liveCamera(shot: LiveShot, width: number, height: number): Camera {
  const zoom = Math.max(
    0.01,
    Math.min(
      shot.kind === 'home' ? 2.4 : 1.8,
      (width * 0.9) / shot.width,
      (height * 0.86) / shot.height,
    ),
  );
  return { x: width / 2 - shot.center.x * zoom, y: height / 2 - shot.center.y * zoom, zoom };
}

export function easeLiveCamera(current: Camera, target: Camera, seconds: number): Camera {
  const amount = 1 - Math.exp(-Math.max(0, seconds) / 1.6);
  return {
    x: current.x + (target.x - current.x) * amount,
    y: current.y + (target.y - current.y) * amount,
    zoom: current.zoom + (target.zoom - current.zoom) * amount,
  };
}
