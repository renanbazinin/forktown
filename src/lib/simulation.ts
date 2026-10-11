import type { Place } from './schema';
import { getPlot, hash, plotEntrance, project, type Plot, type Point } from './world';
import type { EventPose } from './events';
import {
  chainTurn,
  dayTripWalks,
  previewNewcomers,
  residentTrips,
  strollRuns,
  tripState,
  type ResidentTrip,
} from './resident-trips';
import { tubeStation, type ResidentTransit } from './tubes';
import {
  BORROW_MAX,
  loopKey,
  planAt,
  plotDoor,
  windowPlan,
  type FreeWindow,
  type HomeLife,
  type HomePlan,
  type HomeMotion,
  type PlanPoint,
} from './home-life';
import { laneWalk, planLaneWalks, residentGround, type LanePath, type LaneWalk } from './lanes';
import { MAX_TRAVEL_SPEED_MULTIPLIER, WALK_SPEED } from './walking';
import {
  errandState,
  errandWalkPieces,
  residentErrands,
  type ErrandTrip,
  type ErrandVisual,
} from './seasonal-errands';
import { errandAction } from './errand-copy';
export { roadPath, facingAlong } from './walking';

export type ResidentState = {
  id: string;
  resident: Place['resident'];
  home: Place;
  position: Point;
  activity: 'stroll' | 'work' | 'home' | 'sleep';
  moving: boolean;
  facing: 'se' | 'sw' | 'ne' | 'nw';
  walkPhase: number;
  greeting: boolean;
  duckLove?: boolean;
  nightWalk?: boolean;
  nightPorch?: boolean;
  pose?: EventPose;
  /** A published neighbor's seasonal round, with the carried object and handoff progress. */
  errand?: ErrandVisual;
  /** `waiting` is at their spot, early for a show that hasn't started. */
  event?: { name: string; id: string; phase: 'going' | 'waiting' | 'attending' | 'returning' };
  /** Only while boarding, riding or stepping off the tube on the way to or from an event. */
  transit?: ResidentTransit;
  /** On their own lot: going out or in through the front door, or at a garden spot. */
  lot?: HomeLife;
  /** 0..1 while fading through the front door's threshold; absent means fully drawn. */
  fade?: number;
  /** How far their own front door stands open, 0..1, also just before and after they are drawn. */
  door?: number;
  /**
   * -1..1: the sideways lane while walking the road, edged across only to walk clear of someone,
   * and eased to 0 where a walk starts and ends.
   */
  lane?: number;
  /**
   * World tiles the figure is drawn off `position` for its lane: sideways of the way they walk,
   * turning with them round corners (see residentGround in lanes.ts). Absent when drawn right on
   * `position`; also set, easing across, while they turn round on the spot between two outings.
   */
  laneOffset?: Point;
};
export function timeLabel(minutes: number) {
  const value = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function periodAt(minutes: number) {
  const value = ((minutes % 1440) + 1440) % 1440;
  return value < 360 || value >= 1320
    ? 'night'
    : value < 720
      ? 'morning'
      : value < 1080
        ? 'afternoon'
        : 'evening';
}
// Where a tube ride is heading, and where it is coming home from.
const TUBE_PLACES: Record<string, readonly [to: string, from: string]> = {
  zoo: ['Willow Grove Zoo', 'the zoo'],
  cinema: ['the Starlight Cinema', 'the movies'],
  football: ['the football', 'the football'],
  millpond: ['the Millpond', 'the Millpond'],
};
function tubeLabel(transit: ResidentTransit, event: NonNullable<ResidentState['event']>) {
  if (transit.stage === 'alighting')
    return `Stepping off the tube at ${tubeStation(transit.to).name}`;
  const [to, from] = TUBE_PLACES[event.id] ?? [event.name, 'the event'];
  const verb = transit.stage === 'boarding' ? 'Boarding' : 'Riding';
  return event.phase === 'returning'
    ? `${verb} the tube home from ${from}`
    : `${verb} the tube to ${to}`;
}
export function residentActivityLabel(state: ResidentState): string {
  if (state.errand) return errandAction(state.errand.kind, state.errand.phase);
  if (state.duckLove) return 'Stopped to admire the ducklings';
  if (state.transit && state.event) return tubeLabel(state.transit, state.event);
  if (state.event?.phase === 'waiting')
    return `Waiting for ${state.event.id === 'cinema' ? 'the film to start' : state.event.name}`;
  if (state.event?.id === 'zoo')
    return state.event.phase === 'going'
      ? 'Walking to Willow Grove Zoo'
      : state.event.phase === 'returning'
        ? 'Walking home from the zoo'
        : 'Watching the animals at Willow Grove Zoo';
  if (state.event?.id === 'cinema')
    return state.event.phase === 'going'
      ? 'Walking to the Starlight Cinema'
      : state.event.phase === 'returning'
        ? 'Walking home from the movies'
        : 'Watching a film under the stars';
  if (state.event?.id === 'football')
    return state.event.phase === 'going'
      ? 'Walking to the football'
      : state.event.phase === 'returning'
        ? 'Walking home from the football'
        : 'Watching football at The Meadow Ground';
  if (state.event?.id === 'millpond')
    return state.event.phase === 'going'
      ? 'Walking to the Millpond'
      : state.event.phase === 'returning'
        ? 'Walking home from the Millpond'
        : 'Skating on the Millpond';
  if (state.event)
    return state.event.phase === 'going'
      ? `Walking to ${state.event.name}`
      : state.event.phase === 'returning'
        ? 'Walking home from the event'
        : `${state.pose === 'dance' ? 'Dancing' : state.pose === 'read' ? 'Reading' : state.pose === 'sip' ? 'Sipping lemonade' : state.pose === 'chat' ? 'Chatting' : state.pose === 'play' ? 'Playing' : state.pose === 'cheer' ? 'Cheering' : state.pose === 'sway' ? 'Swaying' : 'Relaxing'} at ${state.event.name}`;
  if (state.lot) return homeLifeLabel(state, state.lot);
  if (state.nightWalk) return 'Out for a moonlit stroll';
  if (state.nightPorch) return 'Enjoying the night on the doorstep';
  return ACTIVITY_LABELS[state.activity];
}

export const ACTIVITY_LABELS: Record<ResidentState['activity'], string> = {
  stroll: 'Out for a stroll',
  work: 'Working at home',
  home: 'Relaxing at home',
  sleep: 'Sleeping',
};
const DAY_SPOT_LABELS: Record<HomeLife['spot'], string> = {
  door: 'Stepping out the front door',
  bench: 'Resting on the garden bench',
  porch: 'Sitting on the porch',
  step: 'Sitting on the front step',
  tree: 'Reading under the tree',
  flowers: 'Watering the flowers',
  beds: 'Tending the vegetable patch',
  paving: 'Sweeping the front path',
  gate: 'Looking down the street',
  kerb: 'Home for a moment between outings',
};
const NIGHT_SPOT_LABELS: Partial<Record<HomeLife['spot'], string>> = {
  step: 'Enjoying the night on the doorstep',
  bench: 'Enjoying the night on the bench',
  porch: 'Enjoying the night on the porch',
};

/** What a neighbor on their own lot is up to: through the door, at a spot, or setting off. */
function homeLifeLabel(state: ResidentState, { spot, stage }: HomeLife): string {
  if (stage === 'out') return 'Stepping out the front door';
  if (stage === 'in') return 'Heading inside';
  if (stage === 'from') return 'Setting off';
  if (state.nightPorch) {
    if (spot === 'porch' && state.home.building === 'cafe') return 'Sipping tea on the porch';
    const night = NIGHT_SPOT_LABELS[spot];
    if (night) return night;
  }
  if (spot === 'beds' && state.home.design.garden === 'wildflowers')
    return 'Watering the wildflowers';
  return DAY_SPOT_LABELS[spot];
}

/** The minute of the town day, wrapped by 1440. A single `%` keeps every in-day minute bit-exact,
 *  so anything else that reads the day's plans at a minute (the tube panel) agrees with the town. */
export function townClock(minutes: number) {
  const wrapped = minutes % 1440;
  return wrapped < 0 ? wrapped + 1440 : wrapped;
}

export function simulateResidents(places: Place[], minutes: number, day = 0): ResidentState[] {
  const time = townClock(minutes);
  const eventDay = time < 360 ? day - 1 : day;
  const itinerary = residentTrips(places, eventDay);
  const errands = residentErrands(places, eventDay);
  const commitments = dayCommitments(itinerary, errands);
  const tripTime = time < 360 ? time + 1440 : time;
  // Tomorrow's plan, read only in the minutes before 06:00 when someone steps out for it.
  let tomorrow: ReadonlyMap<string, readonly Commitment[]> | undefined;
  const nextDay = () =>
    (tomorrow ??= dayCommitments(
      residentTrips(places, eventDay + 1),
      residentErrands(places, eventDay + 1),
    ));
  // The loops' lanes, planned once a day around everyone's walks, when a loop first asks.
  let loops: ReadonlyMap<string, LanePath> | undefined;
  const lanes = (key: string) => (loops ??= loopLanes(places, eventDay, itinerary)).get(key);
  /** A neighbor's state at trip-time minute `at` of this plan day. */
  const stateAt = (home: Place, plot: Plot, at: number): ResidentState => {
    const trips = itinerary.get(home.id) ?? [];
    const trip = trips.find((trip) => at >= trip.depart && at < trip.homeBy);
    if (trip)
      return {
        id: home.id,
        resident: home.resident,
        home,
        position: plotEntrance(plot),
        activity: 'stroll',
        moving: false,
        facing: 'se',
        walkPhase: 0,
        greeting: false,
        ...(chainTurn(home.id, trips, at) ?? tripState(home, trip, at, day)),
      };
    const errand = errands.get(home.id)?.find((trip) => at >= trip.depart && at < trip.homeBy);
    if (errand)
      return {
        id: home.id,
        resident: home.resident,
        home,
        position: plotEntrance(plot),
        activity: 'stroll',
        moving: false,
        facing: 'se',
        walkPhase: 0,
        greeting: false,
        ...errandState(errand, at, lanes),
      };
    return homeState(home, plot, at, eventDay, commitments.get(home.id) ?? [], nextDay, lanes);
  };
  const states = places.flatMap((home): ResidentState[] => {
    const plot = getPlot(home.plot);
    return plot ? [stateAt(home, plot, tripTime)] : [];
  });
  greet(states, time, {
    key: `${day}`,
    talks: talksFor(places),
    // The same beat never crosses 06:00, so it stays in this plan day.
    at: (state, minute) =>
      stateAt(state.home, getPlot(state.home.plot)!, minute < 360 ? minute + 1440 : minute),
  });
  return states;
}

/** A run of consecutive stroll periods: out and about from `start` until `end`. */
type Run = { start: number; end: number };
/** Event journeys and seasonal rounds reserve the same road-to-road part of a free window. */
type Commitment = { depart: number; homeBy: number };
const commitmentPlans = new WeakMap<
  ReadonlyMap<string, readonly ResidentTrip[]>,
  ReadonlyMap<string, readonly Commitment[]>
>();
function dayCommitments(
  trips: ReadonlyMap<string, readonly ResidentTrip[]>,
  errands: ReadonlyMap<string, readonly ErrandTrip[]>,
): ReadonlyMap<string, readonly Commitment[]> {
  const found = commitmentPlans.get(trips);
  if (found) return found;
  const plan = new Map<string, readonly Commitment[]>(trips);
  for (const [id, rounds] of errands)
    plan.set(
      id,
      [...(trips.get(id) ?? []), ...rounds].sort((a, b) => a.depart - b.depart),
    );
  commitmentPlans.set(trips, plan);
  return plan;
}
/**
 * Per home object: its runs, and the window plan it used last, so a steady frame builds no cache
 * key. Only a speed-up: every entry is derived from the home object alone (or checked against
 * the window it was made for), so answers never depend on what was asked before.
 */
const memos = new WeakMap<
  Place,
  { runs: Run[]; day: number; window?: FreeWindow; plan?: HomePlan }
>();
function memoFor(home: Place) {
  let memo = memos.get(home);
  if (!memo) memos.set(home, (memo = { runs: strollRuns(home), day: NaN }));
  return memo;
}
/** The plan for a window, from the home's last one when it is the same window of the same day. */
function planFor(home: Place, plot: Plot, day: number, window: FreeWindow): HomePlan {
  const memo = memoFor(home);
  const last = memo.window;
  if (
    memo.plan &&
    last &&
    memo.day === day &&
    last.ws === window.ws &&
    last.we === window.we &&
    last.start === window.start &&
    last.end === window.end
  )
    return memo.plan;
  const plan = windowPlan(home, plot, day, window);
  memo.day = day;
  memo.window = window;
  memo.plan = plan;
  return plan;
}
/** The free window of a run around `t`, between the trips either side of it. */
function windowAround(run: Run, trips: readonly Commitment[], t: number): FreeWindow {
  const window: FreeWindow = { ws: run.start, we: run.end, start: 'door', end: 'door' };
  for (const trip of trips) {
    if (trip.homeBy <= t && trip.homeBy >= window.ws) {
      window.ws = trip.homeBy;
      window.start = 'road';
    }
    if (trip.depart > t && trip.depart < window.we) {
      window.we = trip.depart;
      window.end = 'road';
    }
  }
  return window;
}
/** Every free window of a run with time in it: between the trips that fall within the run. */
function runWindows(run: Run, trips: readonly Commitment[]): FreeWindow[] {
  const windows: FreeWindow[] = [];
  let at = run.start;
  const free = (end: number) => {
    if (end > at) windows.push(windowAround(run, trips, (at + end) / 2));
  };
  for (const trip of [...trips].sort((a, b) => a.depart - b.depart)) {
    if (trip.homeBy <= run.start || trip.depart >= run.end) continue;
    free(trip.depart);
    at = Math.max(at, trip.homeBy);
  }
  free(run.end);
  return windows;
}

/** Each plan day's lanes for the loops round the blocks, by `${plan key}#${loop start}`. */
const loopLaneDays = new WeakMap<Place[], Map<number, ReadonlyMap<string, LanePath>>>();
/**
 * Lanes for every loop of the day, planned around the day's trips (which keep theirs) with
 * planLaneWalks, so neighbors out on the same loop at the same time walk it side by side. Pure
 * and cached by roster and plan day, like the trips.
 */
function loopLanes(
  places: Place[],
  planDay: number,
  itinerary: ReadonlyMap<string, ResidentTrip[]>,
): ReadonlyMap<string, LanePath> {
  const cached = loopLaneDays.get(places)?.get(planDay);
  if (cached) return cached;
  // The trips' walks, with the lanes they have, as fresh copies: the day's trip plan keeps its own.
  const walks: LaneWalk[] = dayTripWalks(itinerary).map((walk) => ({
    ...walk,
    fixed: true,
    near: [],
  }));
  const keys = new Map<LaneWalk, string>();
  const newcomers = previewNewcomers(places);
  const errands = residentErrands(places, planDay);
  const commitments = dayCommitments(itinerary, errands);
  for (const [id, rounds] of errands)
    for (const trip of rounds)
      for (const { key, piece } of errandWalkPieces(trip)) {
        const walk = laneWalk(
          id,
          walks.length,
          false,
          [piece],
          piece.start,
          piece.start + piece.minutes,
        );
        walks.push(walk);
        keys.set(walk, key);
      }
  for (const home of places) {
    const plot = getPlot(home.plot);
    if (!plot) continue;
    const trips = commitments.get(home.id) ?? [];
    for (const run of memoFor(home).runs)
      for (const window of runWindows(run, trips)) {
        const plan = windowPlan(home, plot, planDay, window);
        for (const seg of plan.segs) {
          if (seg.kind !== 'loop') continue;
          const walk = laneWalk(
            home.id,
            walks.length,
            newcomers.has(home.id),
            [
              {
                route: seg.loop.points,
                start: seg.t0,
                minutes: seg.t1 - seg.t0,
                // Plan the same duck pauses and catch-up motion that the town draws.
                ...(seg.loop.ducks
                  ? { sample: (minute: number) => planAt(plan, minute, () => 1) as HomeMotion }
                  : {}),
              },
            ],
            seg.t0,
            seg.t1,
          );
          walks.push(walk);
          keys.set(walk, loopKey(plan, seg.t0));
        }
      }
  }
  planLaneWalks(walks);
  const lanes = new Map<string, LanePath>();
  for (const [walk, key] of keys) lanes.set(key, walk.path!);
  let days = loopLaneDays.get(places);
  if (!days) loopLaneDays.set(places, (days = new Map()));
  if (days.size >= 3) days.delete(days.keys().next().value!);
  days.set(planDay, lanes);
  return lanes;
}

/**
 * Everything a town day's first frame plans ahead of its walkers: the trips, their lanes and the
 * loops' lanes (for planning while idle; the frame finds it all cached).
 */
export function planTownDay(places: Place[], planDay: number) {
  return loopLanes(places, planDay, residentTrips(places, planDay));
}

/** A run's first free window, which may be empty when a trip leaves the moment it begins. */
function firstWindow(run: Run, trips: readonly Commitment[]): FreeWindow {
  const window: FreeWindow = { ws: run.start, we: run.end, start: 'door', end: 'door' };
  for (const trip of trips)
    if (trip.depart >= run.start && trip.depart < window.we) {
      window.we = trip.depart;
      window.end = 'road';
    }
  return window;
}
/** A run's last free window, which may be empty when a trip gets home the moment it ends. */
function lastWindow(run: Run, trips: readonly Commitment[]): FreeWindow {
  const window: FreeWindow = { ws: run.start, we: run.end, start: 'door', end: 'door' };
  for (const trip of trips)
    if (trip.homeBy <= run.end && trip.homeBy >= window.ws && trip.depart >= run.start) {
      window.ws = trip.homeBy;
      window.start = 'road';
    }
  return window;
}

// Around a run's edges a door walk borrows indoor minutes, and the door swings just beyond it.
const LEAD = BORROW_MAX + 1;
const TAIL = BORROW_MAX + 1;

/** Indoors: the routine's activity, or asleep at night (and after a night owl's bedtime). */
function indoorActivity(home: Place, tripTime: number): ResidentState['activity'] {
  if (tripTime >= 1320) return 'sleep';
  const activity = home.resident.routine[periodAt(tripTime) as 'morning' | 'afternoon' | 'evening'];
  return activity === 'stroll' ? 'home' : activity;
}

/**
 * Everything but a trip: out on the lot or round a loop during a run's free windows, stepping out
 * or in through the front door at its edges, and otherwise indoors, standing at the door.
 */
function homeState(
  home: Place,
  plot: Plot,
  tripTime: number,
  planDay: number,
  trips: readonly Commitment[],
  nextDay: () => ReadonlyMap<string, readonly Commitment[]>,
  lanes: (key: string) => LanePath | undefined,
): ResidentState {
  const { runs } = memoFor(home);
  const run = runs.find((run) => tripTime >= run.start && tripTime < run.end);
  let point: PlanPoint | undefined;
  if (run)
    point = planAt(
      planFor(home, plot, planDay, windowAround(run, trips, tripTime)),
      tripTime,
      lanes,
    );
  else {
    const near = (next: PlanPoint) => {
      if (!point || point.indoors) point = !next.indoors || (next.door ?? 0) > 0 ? next : point;
    };
    for (const run of runs) {
      if (tripTime >= run.end && tripTime < run.end + TAIL)
        near(planAt(windowPlan(home, plot, planDay, lastWindow(run, trips)), tripTime));
      if (tripTime < run.start && run.start - tripTime <= LEAD)
        near(planAt(windowPlan(home, plot, planDay, firstWindow(run, trips)), tripTime));
    }
    // Stepping out just before 06:00 belongs to the next plan day.
    if (tripTime >= 1800 - LEAD && runs[0]?.start === 360) {
      const next = nextDay().get(home.id) ?? [];
      near(
        planAt(windowPlan(home, plot, planDay + 1, firstWindow(runs[0], next)), tripTime - 1440),
      );
    }
  }
  const base = { id: home.id, resident: home.resident, home, greeting: false };
  if (point && !point.indoors) {
    const { indoors: _indoors, ...motion } = point;
    return { ...base, activity: 'stroll', ...motion };
  }
  return {
    ...base,
    position: plotDoor(plot),
    activity: indoorActivity(home, tripTime),
    moving: false,
    facing: 'se',
    walkPhase: 0,
    ...(point?.door ? { door: point.door } : {}),
  };
}

// Greeting bubbles as drawResident draws them at the town's figure scale (1.25), in world pixels:
// 10px Space Mono plus padding, 20 px tall. Wider glyphs (emoji, CJK) come from fallback fonts.
const BUBBLE_HEIGHT = 20;
function bubbleWidth(text: string) {
  let width = 12;
  for (const char of text) width += char.codePointAt(0)! < 0x2000 ? 6.12 : 12;
  return width * 1.25;
}
const HEART_WIDTH = 30;
/** Where a figure, and so its bubble or heart, is drawn: lane shift included. */
const projectGround = (state: ResidentState) => {
  const ground = residentGround(state);
  return project(ground.x, ground.y);
};

/** Town minutes a greeting stays up at least: shorter meetings pass without a word. */
export const GREETING_MINUTES = 1.5;
/** Minutes between the looks at a pair that find how long they stay in greeting range. */
const TALK_SAMPLE = 0.1;
const TALK_CACHE = 2048;
/** Per roster: each pair's spells in greeting range within one beat, by `${pair}:${day}:${beat}`. */
const talkCaches = new WeakMap<Place[], Map<string, number[]>>();
function talksFor(places: Place[]) {
  let talks = talkCaches.get(places);
  if (!talks) talkCaches.set(places, (talks = new Map()));
  return talks;
}
/** Free to greet: out and about, not on an outing, not watching the ducklings, not in a doorway. */
const freeToTalk = (state: ResidentState) =>
  state.activity === 'stroll' &&
  !state.event &&
  !state.errand &&
  !state.duckLove &&
  state.fade === undefined;
/** Within `reach` tiles (1.4, greeting range): this runs for every pair of walkers, every frame. */
const inRange = (a: ResidentState, b: ResidentState, reach = 1.4) => {
  const dx = a.position.x - b.position.x,
    dy = a.position.y - b.position.y;
  return dx * dx + dy * dy < reach * reach;
};
/**
 * How close two walkers may be now and still be in a spell, which is looked at every TALK_SAMPLE
 * minutes: a little over greeting range, as far as two walkers close in between two looks.
 */
const SPELL_REACH = 1.55;
/** What greet needs beyond the frame: the pair's states at other minutes of the same beat. */
type Talks = {
  key: string;
  talks: Map<string, number[]>;
  at: (state: ResidentState, minute: number) => ResidentState;
};
/**
 * A pair's spells in range this beat (both free to talk), as [from, to) minutes one after the
 * other, looked at every TALK_SAMPLE minutes once per pair and beat.
 */
function beatSpells(
  first: ResidentState,
  second: ResidentState,
  pair: string,
  beat: number,
  { key, talks, at }: Talks,
) {
  const id = `${pair}:${key}:${beat}`;
  let spells = talks.get(id);
  if (!spells) {
    spells = [];
    let from = -1;
    const steps = Math.round(5 / TALK_SAMPLE);
    for (let k = 0; k <= steps; k++) {
      const minute = beat * 5 + k * TALK_SAMPLE;
      // A beat ends by itself; check just before its boundary to preserve a whole-beat spell.
      const endOfBeat = k === steps;
      const sample = endOfBeat ? minute - 1e-9 : minute;
      const a = at(first, sample),
        b = at(second, sample);
      const talking = freeToTalk(a) && freeToTalk(b) && inRange(a, b);
      if (talking && !endOfBeat && from < 0) from = minute;
      if ((!talking || endOfBeat) && from >= 0) {
        // The first unavailable sample can be almost TALK_SAMPLE minutes after an event or
        // doorway has already ended the meeting. Only promise the time confirmed in range,
        // otherwise a seemingly long-enough greeting disappears before GREETING_MINUTES.
        spells.push(from, talking ? minute : minute - TALK_SAMPLE);
        from = -1;
      }
    }
    if (talks.size >= TALK_CACHE) talks.delete(talks.keys().next().value!);
    talks.set(id, spells);
  }
  return spells;
}
/** A spell long enough to say a greeting in. */
const longEnough = (from: number, to: number) => to - from >= GREETING_MINUTES - 1e-9;
/**
 * The pair's spell around `time`, when it began and ended, if it lasts GREETING_MINUTES; else
 * undefined. So a greeting is either said properly or not at all, never flashed up as two
 * neighbors brush past.
 */
function talkSpell(
  first: ResidentState,
  second: ResidentState,
  pair: string,
  beat: number,
  time: number,
  talks: Talks,
) {
  const spells = beatSpells(first, second, pair, beat, talks);
  for (let s = 0; s < spells.length; s += 2)
    if (time >= spells[s] && time < spells[s + 1])
      return longEnough(spells[s], spells[s + 1])
        ? { since: spells[s], until: spells[s + 1] }
        : undefined;
  return undefined;
}

/** Tiles two walkers can draw apart in a minute, walking away from each other at their briskest. */
const PARTING_SPEED = 2 * WALK_SPEED * MAX_TRAVEL_SPEED_MULTIPLIER;
/**
 * Whether a pair's spell began with neither of them already in a conversation (a spell long
 * enough to greet in, begun before theirs) with someone else. Only such a spell has a bubble:
 * one that begins among others stays quiet to its end, so no bubble starts late, when an earlier
 * conversation ends, and flashes up for a moment. Pure, looked at once per spell: everyone who
 * could have been in range of either of them at `since` is asked where they were then.
 */
function freshSpell(
  first: ResidentState,
  second: ResidentState,
  pair: string,
  since: number,
  beat: number,
  time: number,
  states: readonly ResidentState[],
  talks: Talks,
) {
  const id = `fresh:${talks.key}:${pair}:${since}`;
  let verdict = talks.talks.get(id);
  if (!verdict) {
    let fresh = 1;
    // In range at `since` (or at the look before it), and apart at most this much by now.
    const reach = 1.4 + PARTING_SPEED * (time - since + TALK_SAMPLE) + 0.05;
    for (const member of [first, second])
      for (const other of states) {
        if (!fresh || other.id === first.id || other.id === second.id) continue;
        if (!other.transit && !inRange(member, other, reach)) continue;
        const [a, b] = member.id < other.id ? [member, other] : [other, member];
        const key = `${a.id}:${b.id}`;
        if (hash(`${key}:${beat}`) % 3) continue;
        const spells = beatSpells(a, b, key, beat, talks);
        for (let s = 0; fresh && s < spells.length; s += 2) {
          const from = spells[s],
            to = spells[s + 1];
          if (
            longEnough(from, to) &&
            to > since &&
            (from < since || (from === since && key < pair))
          )
            fresh = 0;
        }
      }
    if (talks.talks.size >= TALK_CACHE) talks.talks.delete(talks.talks.keys().next().value!);
    talks.talks.set(id, (verdict = [fresh]));
  }
  return verdict[0] === 1;
}

/** A bubble said this frame: whose, how wide, and the spell it is said for. */
type Said = { state: ResidentState; width: number; since: number; until: number };
/**
 * Whether a bubble said by `state` over the spell [since, until) would ever cover `other` while
 * both are up, looked at every TALK_SAMPLE minutes: settled once per pair of spells.
 */
function clash(
  state: ResidentState,
  width: number,
  since: number,
  until: number,
  other: Said,
  { key, talks, at }: Talks,
) {
  const id = `clash:${key}:${state.id}:${since}:${until}:${other.state.id}:${other.since}:${other.until}`;
  let verdict = talks.get(id);
  if (!verdict) {
    let hit = 0;
    const end = Math.min(until, other.until);
    for (let k = 0; !hit && since + k * TALK_SAMPLE < end - 1e-9; k++) {
      const minute = since + k * TALK_SAMPLE;
      const a = projectGround(at(state, minute)),
        b = projectGround(at(other.state, minute));
      if (Math.abs(a.x - b.x) < (width + other.width) / 2 && Math.abs(a.y - b.y) < BUBBLE_HEIGHT)
        hit = 1;
    }
    if (talks.size >= TALK_CACHE) talks.delete(talks.keys().next().value!);
    talks.set(id, (verdict = [hit]));
  }
  return verdict[0] === 1;
}

/**
 * Occasional greetings between free strollers who pass close by, with no named meetings or
 * shared mutable state. One of each pair speaks, taking turns every five-minute beat, only when
 * they stay close long enough to say it and neither was already talking with someone else when
 * they met (so the other listens, and a pair never shows two bubbles). A bubble that would at
 * any point of its spell cover one said before it is left unsaid, settled once for the spell, so
 * a greeting is never dropped halfway as another speaker drifts close; so is one that would cover
 * a heart for the ducklings.
 */
function greet(states: ResidentState[], time: number, talks: Talks) {
  const beat = Math.floor(time / 5);
  // Nobody greets while half through their own front door.
  const walkers = states.filter(freeToTalk);
  const pairs: {
    key: string;
    first: ResidentState;
    second: ResidentState;
    since: number;
    until: number;
  }[] = [];
  for (let i = 0; i < walkers.length; i++)
    for (let j = i + 1; j < walkers.length; j++) {
      const a = walkers[i],
        b = walkers[j];
      // Talking is the pair's spell, from its looks: not whether they are in range this frame.
      if (!inRange(a, b, SPELL_REACH)) continue;
      const [first, second] = a.id < b.id ? [a, b] : [b, a];
      const key = `${first.id}:${second.id}`;
      if (hash(`${key}:${beat}`) % 3) continue;
      const spell = talkSpell(first, second, key, beat, time, talks);
      if (spell && freshSpell(first, second, key, spell.since, beat, time, states, talks))
        pairs.push({ key, first, second, ...spell });
    }
  if (!pairs.length) return;
  const hearts = states
    .filter((state) => state.duckLove)
    .map((state) => ({ at: projectGround(state), width: HEART_WIDTH }));
  const said: Said[] = [];
  // A conversation already under way carries on before one just starting. (Two pairs talking
  // at once never share a walker: the later one would not be fresh.)
  pairs.sort((a, b) => a.since - b.since || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (const { first, second, since, until } of pairs) {
    if (first.greeting || second.greeting) continue;
    for (const speaker of beat % 2 ? [second, first] : [first, second]) {
      const width = bubbleWidth(speaker.resident.greeting);
      const at = projectGround(speaker);
      if (
        hearts.some(
          (heart) =>
            Math.abs(heart.at.x - at.x) < (heart.width + width) / 2 &&
            Math.abs(heart.at.y - at.y) < BUBBLE_HEIGHT,
        ) ||
        said.some((other) => clash(speaker, width, since, until, other, talks))
      )
        continue;
      speaker.greeting = true;
      said.push({ state: speaker, width, since, until });
      break;
    }
  }
}
