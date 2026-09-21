import type { Camera } from '../city/render';
import { eventsForDay, isEventLive } from './events';
import { FOOTBALL_CENTER, footballAt } from './football';
import type { Place } from './schema';
import { simulateResidents, type ResidentState } from './simulation';
import { townCatAt, TOWN_CAT_NAME, TOWN_CAT_ID } from './town-cat';
import { getPlot, plotCenter, project, type Point } from './world';

export type LiveShot = {
  id: string;
  kind: 'neighbor' | 'event' | 'home' | 'cat';
  label: string;
  center: Point;
  width: number;
  height: number;
  residentId?: string;
};
export type LiveProgram = ReturnType<typeof liveProgram>;
const cycle = (value: number, length: number) => ((value % length) + length) % length;
export const SCENERY_START = 300;
export const SCENERY_SECONDS = 60;
export const FOLLOW_SECONDS = 45;

export function liveProgram(places: Place[], day: number) {
  const homes = [...places].sort((a, b) => a.id.localeCompare(b.id));
  const order = homes.map((_, index) => homes[cycle(index + day, homes.length)].id);
  const lastFeatured = new Map<string, number>();
  // Hold short, steady clips and give less recently featured neighbors the next turn.
  // Keep the entire ranked cast so an indoor subject never falls back to the same first home.
  const cast = Array.from({ length: 1440 / FOLLOW_SECONDS }, (_, chapter) => {
    const outdoors = simulateResidents(homes, chapter * FOLLOW_SECONDS, day).filter(
      (resident) => resident.activity === 'stroll',
    );
    const walkers = new Set(
      outdoors
        .filter((resident) => resident.event?.phase !== 'attending')
        .map((resident) => resident.id),
    );
    const ranked = [...order].sort(
      (a, b) =>
        (lastFeatured.get(a) ?? -1) - (lastFeatured.get(b) ?? -1) ||
        Number(walkers.has(b)) - Number(walkers.has(a)),
    );
    const next = ranked.find((id) => outdoors.some((resident) => resident.id === id));
    if (next) lastFeatured.set(next, chapter);
    return ranked;
  });
  return { day, homes, cast, events: eventsForDay(day) };
}

export function liveShotAt(
  program: LiveProgram,
  minutes: number,
  residents: ResidentState[],
): LiveShot {
  const time = cycle(minutes, 1440);
  const cat = townCatAt(program.homes, time, program.day);
  // Exactly one real minute per town day for context, with the cat still outside in the frame.
  if (time >= SCENERY_START && time < SCENERY_START + SCENERY_SECONDS) {
    const point = project(cat.position.x, cat.position.y);
    return {
      id: `postcard:${program.day}`,
      kind: 'home',
      label: 'The neighborhood waking up',
      center: { x: point.x, y: point.y - 40 },
      width: 600,
      height: 420,
    };
  }

  const event = program.events.find(
    (event) =>
      isEventLive(event, time) &&
      (event.venue.kind === 'stage' ||
        residents.some(
          (r) =>
            r.activity === 'stroll' && r.event?.id === event.id && r.event.phase === 'attending',
        )),
  );
  if (event) {
    const point = plotCenter(getPlot(event.venue.plot)!);
    return {
      id: `event:${event.period === 'night' && time < 360 ? program.day - 1 : program.day}:${event.id}`,
      kind: 'event',
      label: event.name,
      center: { x: point.x, y: point.y - 35 },
      width: 520,
      height: 370,
    };
  }

  const football = footballAt(time, program.day);
  const matchShot = (): LiveShot => ({
    id: `football:${program.day}:${football.match}`,
    kind: 'event',
    label: 'Live at the Meadow Ground',
    center: project(FOOTBALL_CENTER.x, FOOTBALL_CENTER.y),
    width: 850,
    height: 540,
  });
  // Stay for one full match each day; other matches fill gaps when everyone is indoors/seated.
  if (football.live && time >= 640 && time < 780) return matchShot();

  const outdoors = residents.filter((resident) => resident.activity === 'stroll');
  const walking = outdoors.filter((resident) => resident.event?.phase !== 'attending');
  const chapter = Math.floor(time / FOLLOW_SECONDS);
  const neighbor = program.cast[chapter]
    .map((id) => outdoors.find((resident) => resident.id === id))
    .find((resident) => resident !== undefined);
  if (neighbor && (walking.length || !football.live)) {
    const point = project(neighbor.position.x, neighbor.position.y);
    return {
      id: `neighbor:${program.day}:${neighbor.id}`,
      kind: 'neighbor',
      label: `Following ${neighbor.resident.name}`,
      residentId: neighbor.id,
      center: { x: point.x, y: point.y - 22 },
      width: 430,
      height: 320,
    };
  }
  if (football.live) return matchShot();

  if (!cat.outside) {
    const home = plotCenter(getPlot(cat.homePlot)!);
    return {
      id: `quiet-home:${program.day}:${cat.homePlot}`,
      kind: 'home',
      label: 'A quiet moment in the neighborhood',
      center: { x: home.x, y: home.y - 40 },
      width: 600,
      height: 420,
    };
  }

  const point = project(cat.position.x, cat.position.y);
  return {
    id: 'town-cat',
    kind: 'cat',
    label: `Following ${TOWN_CAT_NAME}, the town cat`,
    residentId: TOWN_CAT_ID,
    center: { x: point.x, y: point.y - 16 },
    width: 340,
    height: 260,
  };
}

export function liveCamera(shot: LiveShot, width: number, height: number, seconds = 0): Camera {
  const baseZoom = Math.max(
    0.01,
    Math.min(
      shot.kind === 'event' || shot.kind === 'home' ? 1.8 : 2.4,
      (width * 0.9) / shot.width,
      (height * 0.86) / shot.height,
    ),
  );
  // Shared-clock cycles divide the town day, so the motion survives midnight and reloads.
  const moving = shot.kind !== 'neighbor' && shot.kind !== 'cat';
  const sway = moving ? Math.sin((cycle(seconds, 90) / 90) * Math.PI * 2) : 0;
  const breath = moving ? (1 - Math.cos((cycle(seconds, 120) / 120) * Math.PI * 2)) / 2 : 0;
  const zoom = baseZoom * (1 + breath * 0.04);
  return {
    x: width / 2 - shot.center.x * zoom + sway * Math.min(28, width * 0.018),
    y: height / 2 - shot.center.y * zoom,
    zoom,
  };
}

export function easeLiveCamera(current: Camera, target: Camera, seconds: number): Camera {
  const amount = 1 - Math.exp(-Math.max(0, seconds) / 1.6);
  return {
    x: current.x + (target.x - current.x) * amount,
    y: current.y + (target.y - current.y) * amount,
    zoom: current.zoom + (target.zoom - current.zoom) * amount,
  };
}
