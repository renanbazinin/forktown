import type { Camera } from '../city/render';
import { eventsForDay, HOUSE_PLOTS } from './events';
import { FOOTBALL_CENTER } from './football';
import type { Place } from './schema';
import { simulateResidents, type ResidentState } from './simulation';
import { getPlot, plotCenter, project, WORLD_WIDTH, WORLD_HEIGHT, type Point } from './world';

export type LiveShot = {
  id: string;
  kind: 'neighbor' | 'event' | 'home' | 'river' | 'meadow' | 'overview';
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

  // Unhurried 90-second postcards between the two longer stories.
  const beat = Math.floor(time / 90);
  const selection = cycle(beat + program.day, 5);
  const id = `postcard:${program.day}:${beat}`;
  const home = program.homes[cycle(program.day + beat, program.homes.length)];
  if ((selection === 0 || selection === 3) && home) {
    const point = plotCenter(getPlot(home.plot)!);
    return {
      id,
      kind: 'home',
      label: home.name,
      center: { x: point.x, y: point.y - 40 },
      width: 590,
      height: 420,
    };
  }
  if (selection === 1)
    return {
      id,
      kind: 'river',
      label: 'A moment by the river',
      center: project(WORLD_WIDTH - 3, WORLD_HEIGHT * 0.35),
      width: 750,
      height: 510,
    };
  const meadow = HOUSE_PLOTS.find((plot) => !program.homes.some((place) => place.plot === plot.id));
  if (selection === 2 && meadow)
    return {
      id,
      kind: 'meadow',
      label: 'Room to grow',
      center: plotCenter(meadow),
      width: 650,
      height: 440,
    };
  const points = program.homes.map((place) => plotCenter(getPlot(place.plot)!));
  if (!points.length) points.push(project(WORLD_WIDTH / 2, WORLD_HEIGHT / 2));
  const left = Math.min(...points.map((p) => p.x)) - 180;
  const right = Math.max(...points.map((p) => p.x)) + 180;
  const top = Math.min(...points.map((p) => p.y)) - 180;
  const bottom = Math.max(...points.map((p) => p.y)) + 100;
  return {
    id,
    kind: 'overview',
    label: 'The neighborhood',
    center: { x: (left + right) / 2, y: (top + bottom) / 2 },
    width: right - left,
    height: bottom - top,
  };
}

export function liveCamera(shot: LiveShot, width: number, height: number): Camera {
  const zoom = Math.max(
    0.01,
    Math.min(1.8, (width * 0.9) / shot.width, (height * 0.86) / shot.height),
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
