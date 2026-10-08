import { ZOO_FRAME } from './zoo';
import type { Camera } from '../city/render';
import { eventsForDay, isEventLive, type TownEvent } from './events';
import { ducksAt } from './ducks';
import { cinemaAt, CINEMA_FRAME, cinemaProgram } from './cinema';
import { FOOTBALL_CENTER, footballAt } from './football';
import { eveningDayAt, FORK_PLOT } from './lanterns';
import type { Place } from './schema';
import { simulateResidents, type ResidentState } from './simulation';
import { townCatAt, TOWN_CAT_NAME, TOWN_CAT_ID } from './town-cat';
import { getPlot, hash, plotCenter, project, type Point } from './world';
import { planResidentTrips, residentTrips, type ResidentTrip } from './resident-trips';
import {
  harvestDay,
  OUTING_IDS,
  OUTING_TIMES,
  regattaDay,
  starNight,
  type OutingId,
} from './district-calendar';
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
  /** The day before's district shots that run past midnight (a film night's stars), on this
   *  day's clock (`from` < 0), with someone planned there in what is left of their window. */
  previousDistrict: DistrictShot[];
  /** When guests of the day's five away from the stage are planned to be attending, judged from
   *  the plan as `district` is, in event and time order (districtShotAirs). */
  attending: readonly { event: string; from: number; to: number }[];
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
/**
 * On a night the lineup films the cinema, the bill holds the air from 20:30 until it ends
 * (1428–1434), and the director ranks it before a festival (SPEC §4.7). A festival moment it
 * would cover moves, so it airs whole: the Long Table to its supper before lantern hour, the
 * stars to the end of the bill until the rugs are rolled up at 00:15 (the outing's end).
 */
export const FILM_NIGHT_SHOTS = {
  'long-table': { from: LANTERN_SHOT.start - 20, to: LANTERN_SHOT.start },
  stargazing: { to: OUTING_TIMES.stargazing.end },
} as const;
const isOutingId = (id: string): id is OutingId => (OUTING_IDS as readonly string[]).includes(id);
/**
 * On a day with no festival, the Riverside's one daily highlight. The teatime set (16:00–16:40)
 * falls inside an afternoon's zoo (on air 16:00–17:00, after the Lunch Green), which ranks
 * first; so an afternoon day films the market (09:30, clear of every event) and any other day
 * the Bandstand, and neither is ever held off.
 */
export const liveDistrictHighlight = (day: number): 'market' | 'bandstand' =>
  liveHighlights(day).includes('afternoon') ? 'market' : 'bandstand';
/** Every district shot a day may film, before anyone is asked whether they will be there. */
export function liveDistrictShots(day: number): DistrictShot[] {
  const shot = (outing: keyof typeof DISTRICT_SHOTS, festival: boolean): DistrictShot => ({
    outing,
    ...DISTRICT_SHOTS[outing],
    festival,
    label: DISTRICT_COPY[outing].name(day),
  });
  const film = liveHighlights(day).includes('cinema');
  const festivals = [
    ...(regattaDay(day) ? [shot('regatta', true)] : []),
    ...(harvestDay(day)
      ? [
          shot('harvest-fair', true),
          { ...shot('long-table', true), ...(film ? FILM_NIGHT_SHOTS['long-table'] : {}) },
        ]
      : []),
    ...(starNight(day)
      ? [
          {
            ...shot('stargazing', true),
            ...(film ? { from: cinemaProgram(day).end, ...FILM_NIGHT_SHOTS.stargazing } : {}),
          },
        ]
      : []),
  ];
  if (festivals.length) return festivals;
  return [shot(liveDistrictHighlight(day) === 'market' ? 'market' : 'bandstand-tea', false)];
}
/** The district shot on air at a town minute of the program's day, if one is: the day's own,
 *  or before 06:00 one of the day before's still running past midnight. */
export function liveDistrictShot(program: LiveProgram, time: number): DistrictShot | undefined {
  const on = (shot: DistrictShot) => time >= shot.from && time < shot.to;
  return program.district.find(on) ?? (time < 360 ? program.previousDistrict.find(on) : undefined);
}
const districtLiveShot = (program: LiveProgram, shot: DistrictShot): LiveShot => ({
  // A shot that runs past midnight keeps its evening's id, so the stream never cuts at 00:00.
  id: `district:${program.previousDistrict.includes(shot) ? program.day - 1 : program.day}:${shot.outing}`,
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

/** When a trip's guest attends, as tripState puts it: from their arrival where the event is
 *  already underway (the zoo, the football, the Millpond), else from its start, until they leave. */
const attendance = (trip: ResidentTrip) => {
  const kind = trip.event.venue.kind;
  const underway = kind === 'zoo' || kind === 'football' || kind === 'millpond';
  return {
    event: trip.event.id,
    from: underway ? trip.arrive : Math.max(trip.arrive, trip.event.start),
    to: trip.leave,
  };
};
/** The shots with someone planned to be there in their window. */
const present = (shots: DistrictShot[], trips: readonly ResidentTrip[]) =>
  shots.filter((shot) =>
    trips.some(
      (trip) => trip.event.id === shot.outing && trip.arrive < shot.to && trip.leave > shot.from,
    ),
  );
/** The day before's shots that run past midnight, on this day's clock, with someone there: the
 *  day before is planned only when it has one. */
function overnight(day: number, tripsOf: (day: number) => readonly ResidentTrip[]) {
  const late = liveDistrictShots(day - 1).filter((shot) => shot.to > 1440);
  if (!late.length) return [];
  return present(late, tripsOf(day - 1)).map((shot) => ({
    ...shot,
    from: shot.from - 1440,
    to: shot.to - 1440,
  }));
}
/** A day's program before its cast: the day's five, its highlights and its district shots. */
function programOf(
  places: Place[],
  day: number,
  trips: readonly ResidentTrip[],
  previousDistrict: DistrictShot[],
): LiveProgram {
  // Only today's five: the Riverside's outings are filmed through their own district shots.
  const events = eventsForDay(day).filter((event) => !event.outing);
  const away = new Set(
    events.filter((event) => event.venue.kind !== 'stage').map((event) => event.id),
  );
  return {
    day,
    // Code-unit order, never the viewer's language: every visitor casts the same neighbors.
    homes: [...places].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    cast: [],
    events,
    highlights: liveHighlights(day),
    previousHighlights: liveHighlights(day - 1),
    // A district shot goes on air only if someone is planned to be there in its window.
    district: present(liveDistrictShots(day), trips),
    previousDistrict,
    attending: trips
      .filter((trip) => away.has(trip.event.id))
      .map(attendance)
      .filter(({ from, to }) => to > from)
      .sort((a, b) =>
        a.event < b.event ? -1 : a.event > b.event ? 1 : a.from - b.from || a.to - b.to,
      ),
  };
}

/** The step a district shot's window is scanned in, in town minutes. */
const AIR_STEP = 0.25;
/**
 * The first minute of a district shot's window (on a quarter-minute grid) that liveShotAt gives
 * the air, or undefined when it never does: nobody is planned there in its window (it is not in
 * `program.district`), or for all of it something the director ranks higher holds the air. That
 * is the postcard, lantern hour or the selected cinema; and over a daily highlight, also a
 * selected event of the day's five that is live with its venue busy (a stage always, elsewhere
 * someone planned to be attending), as the zoo can hold the teatime set. Judged from the day's
 * plan, as `program.district` is, so the break cards bill a moment only when it will air, and
 * from the minute it does.
 */
export function districtShotAirs(program: LiveProgram, shot: DistrictShot): number | undefined {
  if (!program.district.some((candidate) => candidate.outing === shot.outing)) return undefined;
  for (let k = 0; shot.from + k * AIR_STEP < shot.to; k++) {
    const time = shot.from + k * AIR_STEP;
    if (liveDistrictShot(program, time)?.outing !== shot.outing) continue;
    if (time >= SCENERY_START && time < SCENERY_START + SCENERY_SECONDS) continue;
    if (program.homes.length && time >= LANTERN_SHOT.start && time < LANTERN_SHOT.end) continue;
    if (cinemaAt(time, program.day).live && features(program, 'cinema', time)) continue;
    const held =
      !shot.festival &&
      program.events.some(
        (event) =>
          event.id !== 'cinema' &&
          event.period !== 'morning' &&
          features(program, event.period, time) &&
          isEventLive(event, time) &&
          (event.venue.kind === 'stage' ||
            program.attending.some(
              (guest) => guest.event === event.id && time >= guest.from && time < guest.to,
            )),
      );
    if (!held) return time;
  }
  return undefined;
}
/**
 * districtShotAirs for a roster's day without planning its cast or evicting a program the stream
 * holds: the day's program when it is already planned, else one judged from the day's trips
 * planned afresh, which touches no cache.
 */
export function districtAiring(
  places: Place[],
  day: number,
  shot: DistrictShot,
): number | undefined {
  // The day's own shots never need the day before's: an empty previousDistrict judges them.
  const program =
    programs.get(places)?.get(day) ??
    programOf(places, day, [...planResidentTrips(places, day).values()].flat(), []);
  return districtShotAirs(program, shot);
}

function planLiveProgram(places: Place[], day: number): LiveProgram {
  const tripsOf = (day: number) => [...residentTrips(places, day).values()].flat();
  const program = programOf(places, day, tripsOf(day), overnight(day, tripsOf));
  const { homes } = program;
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
