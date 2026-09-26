import { ZOO_FRAME } from './zoo';
import type { Camera } from '../city/render';
import { eventsForDay, isEventLive, type TownEvent } from './events';
import { ducksAt } from './ducks';
import { cinemaAt, CINEMA_FRAME } from './cinema';
import { FOOTBALL_CENTER, footballAt } from './football';
import { eveningDayAt, FORK_PLOT } from './lanterns';
import type { Place } from './schema';
import { simulateResidents, type ResidentState } from './simulation';
import { townCatAt, TOWN_CAT_NAME, TOWN_CAT_ID } from './town-cat';
import { getPlot, hash, plotCenter, project, type Point } from './world';

export type LiveShot = {
  id: string;
  kind: 'neighbor' | 'event' | 'home' | 'cat' | 'ducks' | 'lanterns';
  label: string;
  center: Point;
  width: number;
  height: number;
  residentId?: string;
};
const HIGHLIGHTS = ['ducks', 'football', 'afternoon', 'evening', 'night', 'cinema'] as const;
type Highlight = (typeof HIGHLIGHTS)[number];
export type LiveProgram = {
  day: number;
  homes: Place[];
  cast: string[][];
  events: TownEvent[];
  highlights: Highlight[];
  previousHighlights: Highlight[];
};
const cycle = (value: number, length: number) => ((value % length) + length) % length;
export const SCENERY_START = 300;
export const SCENERY_SECONDS = 60;
export const FOLLOW_SECONDS = 45;
/** The camera's easing time constant, in real seconds. */
export const LIVE_EASE_SECONDS = 1.6;
/** While the followed neighbor rides the tube (10 tiles a second), so the glass stays in frame. */
export const LIVE_RIDE_EASE_SECONDS = 0.12;
type Lifted = Pick<ResidentState, 'transit'> | undefined;
/** Easing time constant: short only while the followed neighbor rides (10 tiles a second). */
export const liveEaseSeconds = (state: Lifted) =>
  state?.transit?.stage === 'riding' ? LIVE_RIDE_EASE_SECONDS : LIVE_EASE_SECONDS;
/** World px above the ground point where the camera centres a followed neighbor. Continuous: a
 *  walker's 22 px until the tube lifts them higher, so boarding and stepping off never jump the shot. */
export const liveCenterLift = (state: Lifted) => Math.max(22, state?.transit?.altitude ?? 0);
/** World px above the ground point for the follow label. */
export const liveLabelLift = (state: Lifted) => Math.max(43, (state?.transit?.altitude ?? 0) + 14);
/** Lantern hour on air: two seconds of dark tree, the lanterns, then the first lamps. */
export const LANTERN_SHOT = { start: 1198, end: 1224 };
const FORK_CENTER = plotCenter(getPlot(FORK_PLOT)!);

function shuffled<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = hash(`${seed}:${i}`) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Three broadcast highlights; the town's actual activities continue every day. */
export function liveHighlights(day: number): Highlight[] {
  return shuffled(HIGHLIGHTS, `live-highlights:${day}`).slice(0, 3);
}

function features(program: LiveProgram, highlight: Highlight, time: number): boolean {
  // A selected disco remains selected until it ends, even when the town day rolls over.
  const selected =
    (highlight === 'night' || highlight === 'cinema') && time < 360
      ? program.previousHighlights
      : program.highlights;
  return selected.includes(highlight);
}

function followable(program: LiveProgram, residents: ResidentState[], time: number) {
  return residents.filter((resident) => {
    if (resident.activity !== 'stroll') return false;
    if (resident.event?.phase !== 'attending') return true;
    // A skater on the Millpond is no show the lineup could skip (the pond has no event shot, and a
    // selected afternoon is filmed at its own venues), so they stay followable out on the ice.
    if (resident.event.id === 'millpond') return true;
    const highlight =
      resident.event.id === 'football' || resident.event.id === 'cinema'
        ? resident.event.id
        : program.events.find((event) => event.id === resident.event?.id)?.period;
    // Don't turn a skipped show into the same show through an audience close-up.
    return highlight !== undefined && features(program, highlight, time);
  });
}

const programs = new WeakMap<Place[], Map<number, LiveProgram>>();
/** The day's program, planned once per roster and day (LiveStream prefetches tomorrow's). */
export function liveProgram(places: Place[], day: number): LiveProgram {
  const cached = programs.get(places)?.get(day);
  if (cached) return cached;
  const program = planLiveProgram(places, day);
  let byDay = programs.get(places);
  if (!byDay) programs.set(places, (byDay = new Map()));
  // Today's and tomorrow's: drop the oldest.
  if (byDay.size >= 2) byDay.delete(byDay.keys().next().value!);
  byDay.set(day, program);
  return program;
}

function planLiveProgram(places: Place[], day: number): LiveProgram {
  // Code-unit order, never the viewer's language: every visitor casts the same neighbors.
  const homes = [...places].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const program: LiveProgram = {
    day,
    homes,
    cast: [],
    events: eventsForDay(day),
    highlights: liveHighlights(day),
    previousHighlights: liveHighlights(day - 1),
  };
  const appearances = new Map<string, number>();
  let previous: string | undefined;
  // Shuffle every clip, favor less-seen people, and avoid consecutive follows when possible.
  // Keep replacements ranked too, so an indoor subject never means falling back to one home.
  for (let chapter = 0; chapter < 1440 / FOLLOW_SECONDS; chapter++) {
    const time = chapter * FOLLOW_SECONDS;
    // The caller's own roster, so the day's plan comes from the town's cache.
    const residents = simulateResidents(places, time, day);
    const ranked = shuffled(
      homes.map((home) => home.id),
      `live-cast:${day}:${chapter}`,
    ).sort(
      (a, b) =>
        Number(a === previous) - Number(b === previous) ||
        (appearances.get(a) ?? 0) - (appearances.get(b) ?? 0),
    );
    program.cast.push(ranked);
    // Only charge screen time for a follow, not a clip covered by an event or scenery.
    const shot = liveShotAt(program, time, residents);
    if (shot.kind === 'neighbor' && shot.residentId) {
      previous = shot.residentId;
      appearances.set(previous, (appearances.get(previous) ?? 0) + 1);
    }
  }
  return program;
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
  // Every evening the town lights itself; an empty town has no lanterns to film.
  if (program.homes.length && time >= LANTERN_SHOT.start && time < LANTERN_SHOT.end)
    return {
      id: `lanterns:${eveningDayAt(time, program.day)}`,
      kind: 'lanterns',
      label: 'Lantern hour at the Lantern Fork',
      center: { x: FORK_CENTER.x + 4, y: FORK_CENTER.y - 58 },
      width: 620,
      height: 440,
    };

  const cinema = cinemaAt(time, program.day);
  if (cinema.live && features(program, 'cinema', time))
    return {
      id: `event:${cinema.program.day}:cinema`,
      kind: 'event',
      label:
        cinema.slot?.film?.title ??
        (cinema.slot?.ad ? 'Ads at the Starlight Cinema' : 'Intermission at the Starlight Cinema'),
      ...CINEMA_FRAME,
    };
  const event = program.events.find(
    (event) =>
      event.id !== 'cinema' &&
      features(program, event.period, time) &&
      isEventLive(event, time) &&
      (event.venue.kind === 'stage' ||
        residents.some(
          (r) =>
            r.activity === 'stroll' && r.event?.id === event.id && r.event.phase === 'attending',
        )),
  );
  if (event?.venue.kind === 'zoo')
    return { id: `event:${program.day}:zoo`, kind: 'event', label: event.name, ...ZOO_FRAME };
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
  // Only visit the duck family on days when their walk makes the broadcast lineup.
  const ducks = features(program, 'ducks', time) && time >= 600 && time < 640 ? ducksAt(time) : [];
  if (ducks.length) {
    const points = ducks.map((duck) => project(duck.position.x, duck.position.y));
    return {
      id: `ducks:${program.day}`,
      kind: 'ducks',
      label: 'The daily duck walk',
      center: {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length - 12,
      },
      width: 360,
      height: 260,
    };
  }
  const matchShot = (): LiveShot => ({
    id: `football:${program.day}:${football.match}`,
    kind: 'event',
    label: 'Live at the Meadow Ground',
    center: project(FOOTBALL_CENTER.x, FOOTBALL_CENTER.y),
    width: 850,
    height: 540,
  });
  // A selected football day gets one full match, never an automatic all-day fallback.
  if (features(program, 'football', time) && football.live && time >= 640 && time < 780)
    return matchShot();

  const outdoors = followable(program, residents, time);
  const chapter = Math.floor(time / FOLLOW_SECONDS);
  const neighbor = program.cast[chapter]
    .map((id) => outdoors.find((resident) => resident.id === id))
    .find((resident) => resident !== undefined);
  if (neighbor) {
    const point = project(neighbor.position.x, neighbor.position.y);
    // A rider is centred on the glass, not on the ground beneath it.
    const lift = liveCenterLift(neighbor);
    return {
      id: `neighbor:${program.day}:${neighbor.id}`,
      kind: 'neighbor',
      label: `Following ${neighbor.resident.name}`,
      residentId: neighbor.id,
      center: { x: point.x, y: point.y - lift },
      width: 430,
      height: 320,
    };
  }

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
      shot.kind === 'event' || shot.kind === 'home' || shot.kind === 'lanterns' ? 1.8 : 2.4,
      (width * 0.9) / shot.width,
      (height * 0.86) / shot.height,
    ),
  );
  // Shared-clock cycles divide the town day, so the motion survives midnight and reloads.
  const moving = shot.kind !== 'neighbor' && shot.kind !== 'cat' && shot.kind !== 'ducks';
  const sway = moving ? Math.sin((cycle(seconds, 90) / 90) * Math.PI * 2) : 0;
  const breath = moving ? (1 - Math.cos((cycle(seconds, 120) / 120) * Math.PI * 2)) / 2 : 0;
  const zoom = baseZoom * (1 + breath * 0.04);
  return {
    x: width / 2 - shot.center.x * zoom + sway * Math.min(28, width * 0.018),
    y: height / 2 - shot.center.y * zoom,
    zoom,
  };
}

export function easeLiveCamera(
  current: Camera,
  target: Camera,
  seconds: number,
  tau = LIVE_EASE_SECONDS,
): Camera {
  const amount = 1 - Math.exp(-Math.max(0, seconds) / tau);
  return {
    x: current.x + (target.x - current.x) * amount,
    y: current.y + (target.y - current.y) * amount,
    zoom: current.zoom + (target.zoom - current.zoom) * amount,
  };
}
