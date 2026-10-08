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
import { residentTrips } from './resident-trips';
import { harvestDay, OUTING_IDS, regattaDay, starNight, type OutingId } from './district-calendar';
import { DISTRICT_COPY } from './district-copy';
import {
  BANDSTAND_FRAME,
  HARVEST_FRAME,
  MARKET_FRAME,
  REGATTA_FRAME,
  type DistrictFrame,
} from './district-places';

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
/** A Riverside moment on air: its outing, its window in town minutes and its frame. */
export type DistrictShot = {
  outing: OutingId;
  from: number;
  to: number;
  frame: DistrictFrame;
  /** A festival's shot ranks before the day's events; the daily highlight's after them. */
  festival: boolean;
  /** The outing's name that day, as the events list shows it. */
  label: string;
};
export type LiveProgram = {
  day: number;
  homes: Place[];
  cast: string[][];
  /** Today's five events; the Riverside's outings are filmed through `district`. */
  events: TownEvent[];
  highlights: Highlight[];
  previousHighlights: Highlight[];
  /** The day's district shots with someone planned there in their window (SPEC §4.7). */
  district: DistrictShot[];
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

/**
 * The Riverside's shot windows (SPEC §4.1–4.5, §4.7), in town minutes on the plan day's own
 * timeline: the festivals', and the two daily highlights' (the market, the teatime set).
 */
export const DISTRICT_SHOTS = {
  market: { from: 570, to: 610, frame: MARKET_FRAME },
  'bandstand-tea': { from: 960, to: 1000, frame: BANDSTAND_FRAME },
  regatta: { from: 880, to: 945, frame: REGATTA_FRAME },
  'harvest-fair': { from: 900, to: 940, frame: HARVEST_FRAME },
  'long-table': { from: 1224, to: 1244, frame: HARVEST_FRAME },
  stargazing: { from: 1380, to: 1425, frame: BANDSTAND_FRAME },
} as const satisfies Partial<Record<OutingId, { from: number; to: number; frame: DistrictFrame }>>;
const isOutingId = (id: string): id is OutingId => (OUTING_IDS as readonly string[]).includes(id);
/** On a day with no festival, the Riverside's one daily highlight. */
export const liveDistrictHighlight = (day: number) =>
  (['market', 'bandstand'] as const)[hash(`live-district:${day}`) % 2];
/** Every district shot a day may film, before anyone is asked whether they will be there. */
export function liveDistrictShots(day: number): DistrictShot[] {
  const shot = (outing: keyof typeof DISTRICT_SHOTS, festival: boolean): DistrictShot => ({
    outing,
    ...DISTRICT_SHOTS[outing],
    festival,
    label: DISTRICT_COPY[outing].name(day),
  });
  const festivals = [
    ...(regattaDay(day) ? [shot('regatta', true)] : []),
    ...(harvestDay(day) ? [shot('harvest-fair', true), shot('long-table', true)] : []),
    ...(starNight(day) ? [shot('stargazing', true)] : []),
  ];
  if (festivals.length) return festivals;
  return [shot(liveDistrictHighlight(day) === 'market' ? 'market' : 'bandstand-tea', false)];
}
/** The district shot on air at a town minute of the program's day, if one is. */
export function liveDistrictShot(program: LiveProgram, time: number): DistrictShot | undefined {
  return program.district.find((shot) => time >= shot.from && time < shot.to);
}
const districtLiveShot = (program: LiveProgram, shot: DistrictShot): LiveShot => ({
  id: `district:${program.day}:${shot.outing}`,
  kind: 'event',
  label: shot.label,
  center: shot.frame.center,
  width: shot.frame.width,
  height: shot.frame.height,
});

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
    // A Riverside guest is followed, except while their own outing's shot is on air: then the
    // shot itself films them. No district period ever reaches the lineup's highlights.
    if (isOutingId(resident.event.id))
      return liveDistrictShot(program, time)?.outing !== resident.event.id;
    const highlight =
      resident.event.id === 'football' || resident.event.id === 'cinema'
        ? resident.event.id
        : program.events.find((event) => event.id === resident.event?.id)?.period;
    // Don't turn a skipped show into the same show through an audience close-up.
    return highlight !== undefined && highlight !== 'morning' && features(program, highlight, time);
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
  // Only today's five: the Riverside's outings are filmed through their own district shots.
  const program: LiveProgram = {
    day,
    homes,
    cast: [],
    events: eventsForDay(day).filter((event) => !event.outing),
    highlights: liveHighlights(day),
    previousHighlights: liveHighlights(day - 1),
    district: [],
  };
  // A district shot goes on air only if someone is planned to be there in its window.
  const plan = [...residentTrips(places, day).values()].flat();
  program.district = liveDistrictShots(day).filter((shot) =>
    plan.some(
      (trip) => trip.event.id === shot.outing && trip.arrive < shot.to && trip.leave > shot.from,
    ),
  );
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
  // A festival on the Riverside comes next, before the day's own events.
  const district = liveDistrictShot(program, time);
  if (district?.festival) return districtLiveShot(program, district);
  const event = program.events.find(
    (event) =>
      event.id !== 'cinema' &&
      !event.outing &&
      event.period !== 'morning' &&
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

  // The day's Riverside highlight, after the day's events and before the ducks.
  if (district) return districtLiveShot(program, district);

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

  // By id, so the cast's lookup stays linear in a full town.
  const outdoors = new Map<string, ResidentState>();
  for (const resident of followable(program, residents, time))
    if (!outdoors.has(resident.id)) outdoors.set(resident.id, resident);
  const chapter = Math.floor(time / FOLLOW_SECONDS);
  const neighbor = program.cast[chapter]
    .map((id) => outdoors.get(id))
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

export function liveCamera(shot: LiveShot, width: number, height: number): Camera {
  const zoom = Math.max(
    0.01,
    Math.min(
      shot.kind === 'event' || shot.kind === 'home' || shot.kind === 'lanterns' ? 1.8 : 2.4,
      (width * 0.9) / shot.width,
      (height * 0.86) / shot.height,
    ),
  );
  return {
    x: width / 2 - shot.center.x * zoom,
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
