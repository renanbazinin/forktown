// Snowmen on the Lunch Green (docs/STARGAZING.md): on a build day (variant `snowmen`) lunch seats 0
// and 1 alternate `crouch` and `play` (each held at least a minute) from 14:00 to 15:45; seats 2–5
// only `sit`, `chat` or `cheer` until the last cheer. The planner's attendingPose calls these on
// that variant only, with the guest's visit and the lunch's own pose at any minute (`lunch`).
// Either side of the building the lunch keeps its own poses: the one a guest has a minute before
// 14:00 holds until the building starts, and the one they will have a minute after it is done
// starts as it ends, so no pose either side is held under a minute. A guest who sits down or gets
// up in the middle of it all (a late arrival from a far plot, an early leave) settles into the pose
// they will have a minute later and keeps the one they had a minute before, so whoever is on the
// guest list, no pose between the crouch on sitting down and the crouch on getting up is held
// under a minute either.
// Import rule: value-import only world, town-calendar, seasons, district-places and
// district-calendar; never resident-trips, events or anything under src/city/.
import type { EventPose } from '../events.ts';
import type { PoseContext } from '../outings.ts';
import { SNOWMAN_DAYS, SNOWMAN_STAGES, snowmanState } from '../district-calendar.ts';
import { yearDayAt } from '../seasons.ts';
import { hash } from '../world.ts';

const { base, head, dressed } = SNOWMAN_STAGES;
/** Minutes of a builder's spell at one task: 4 to 8, seeded per day, seat and spell. */
const SPELL = { least: 4, spread: 5 } as const;
/** A spell that would leave less than this before 15:45 runs on to 15:45 instead. */
const SLIVER = 2;

type Spell = { from: number; to: number; pose: 'crouch' | 'play' };
/**
 * A builder's afternoon, 14:00–15:45: down on their knees rolling and patting snow (`crouch`),
 * then up on their feet packing a snowball (`play`), turn and turn about. It starts and ends on the
 * knees, so they go from sitting to building and back by way of the crouch, never in one frame.
 */
export function builderSpells(seat: number, day: number): Spell[] {
  const spells: Spell[] = [];
  for (let from: number = base, k = 0; from < dressed; k++) {
    let to = Math.min(
      dressed,
      from + SPELL.least + (hash(`snowman-build:${Math.floor(day)}:${seat}:${k}`) % SPELL.spread),
    );
    if (dressed - to < SLIVER) to = dressed;
    spells.push({ from, to, pose: k % 2 ? 'play' : 'crouch' });
    from = to;
  }
  // Never end on the feet: the last spell of packing snow joins the crouch before it.
  if (spells.length > 1 && spells.at(-1)!.pose === 'play') {
    const last = spells.pop()!;
    spells.at(-1)!.to = last.to;
  }
  return spells;
}

/** What the planner hands the snowmen's poses: a lunch guest's visit and moment (PoseContext),
 *  and the lunch's own pose for them at any minute, which changes on the lunch's own beat. */
export type SnowmenContext = PoseContext & { lunch(time: number): EventPose | undefined };
/** Minutes a pose is held at least, and a guest takes to sit down or get up (the planner's
 *  POSE_HOLD and SEAT_SETTLE, restated: this file may not import resident-trips). */
const HOLD = 1;
const SETTLE = 0.4;
/**
 * The minute a guest's pose is read at: their own, kept a minute inside the stretch they are
 * settled on the blanket (from sitting down, or the lunch's start for a guest who waited, to the
 * crouch to get up). The pose they settle into is the one they will have a minute later and the
 * last before getting up the one they had a minute before, so both are held a minute even when
 * they arrive or leave mid-spell, mid-chat or mid-cheer. A stay under two minutes keeps its
 * middle pose throughout, like the lunch's own beats.
 */
function settledTime({ time, arrive, leave, trip }: SnowmenContext) {
  const from = Math.max(arrive, trip.event.start) + SETTLE,
    to = leave - SETTLE;
  return to - from >= 2 * HOLD ? Math.min(Math.max(time, from + HOLD), to - HOLD) : (from + to) / 2;
}
/**
 * The lunch's own pose either side of a stretch [from, to) that the snowmen take: the pose a
 * minute before `from` holds on until it, and the pose a minute after `to` starts at it. Each is
 * a run of the lunch's own that already reached that far, so both are held a minute at least.
 */
function lunchAround({ lunch, time }: SnowmenContext, from: number, to: number) {
  if (time < from) return lunch(time < from - HOLD ? time : from - HOLD);
  return lunch(time < to + HOLD ? to + HOLD : time);
}

/**
 * A builder's pose (lunch seats 0 and 1): building 14:00–15:45, from the crouch and back to it,
 * and the lunch's own pose either side.
 */
export function snowmenBuilderPose(context: SnowmenContext): EventPose | undefined {
  if (context.seat < 0 || context.seat > 1) return undefined;
  const c = { ...context, time: settledTime(context) };
  const { seat, time, day } = c;
  if (time < base || time >= dressed) return lunchAround(c, base, dressed);
  return builderSpells(seat, day).find((spell) => time < spell.to)?.pose;
}

/**
 * Which way each builder faces the day's snowman (k = 0..3, from lunch seats 0 and 1): the
 * quarter its spot lies in from the seat (SNOWMAN_SPOTS; the green's seats at local (−0.55, 0)
 * and (0.35, 0)). tests/snowmen.test.ts checks the table against both.
 */
type Facing = 'ne' | 'nw' | 'se' | 'sw';
export const BUILDER_FACING: readonly (readonly [Facing, Facing])[] = [
  ['se', 'se'],
  ['se', 'ne'],
  ['se', 'se'],
  ['ne', 'ne'],
];
/** The builders' blankets face these ways (the green's seats 0 and 1). */
const BLANKET: readonly [Facing, Facing] = ['se', 'sw'];
const OPPOSITE: Record<Facing, Facing> = { ne: 'sw', sw: 'ne', se: 'nw', nw: 'se' };
/** A quarter round from each facing, for turning about in two steps. */
const QUARTER: Record<Facing, Facing> = { ne: 'nw', nw: 'sw', sw: 'se', se: 'ne' };
/** Minutes a builder spends a quarter round, turning about at the start and the end. */
const TURN = 0.5;
/**
 * A builder's facing while building (14:00–15:45): turned to the snowman they are making, so the
 * heap at their knees and the snowball in their hands are on its side. A builder whose snowman is
 * behind their blanket turns about by a quarter first, and back the same way, never in one frame.
 * The planner asks it while a builder attends (tripState); undefined keeps the blanket's own
 * facing.
 */
export function snowmenBuilderFacing(seat: number, time: number, day: number) {
  if (seat < 0 || seat > 1 || time < base || time >= dressed) return undefined;
  const k = (SNOWMAN_DAYS as readonly number[]).indexOf(yearDayAt(Math.floor(day)));
  if (k < 0) return undefined;
  const want = BUILDER_FACING[k][seat];
  const about = OPPOSITE[want] === BLANKET[seat];
  return about && (time < base + TURN || time >= dressed - TURN) ? QUARTER[want] : want;
}

/**
 * The watchers' cheers: everyone on the blankets is up on their feet as the head goes on (15:15)
 * and again when the snowman gets its eyes, carrot and scarf (15:45), a ripple along the seats.
 */
export const WATCHER_CHEERS = [
  { from: head, minutes: 1.5 },
  { from: dressed, minutes: 2 },
] as const;
/** Each watcher's share of the ripple, in minutes after the cheer begins. */
const ripple = (seat: number) => [0, 0, 0, 0.2, 0.1, 0.3][seat] ?? 0;
/** Minutes in a watcher's chat beat, and of the chat at its start. */
const WATCH_BEAT = 8;
const WATCH_CHAT = 2.5;
/** No chat starts or runs on within this long of a cheer, so nothing is held under a minute. */
const CHEER_CLEAR = 1;

/**
 * A watcher's pose (lunch seats 2–5): sat on their blanket while the snowman goes up, chatting now
 * and then, and on their feet for the two cheers; the lunch's own pose before 14:00 and after the
 * last cheer.
 */
export function snowmenWatcherPose(context: SnowmenContext): EventPose | undefined {
  if (context.seat < 2 || context.seat > 5) return undefined;
  const c = { ...context, time: settledTime(context) };
  const { seat, time, day } = c;
  const last = WATCHER_CHEERS.at(-1)!;
  const done = last.from + last.minutes + ripple(seat);
  if (time < base || time >= done) return lunchAround(c, base, done);
  const cheers = WATCHER_CHEERS.map(({ from, minutes }) => ({
    from: from + ripple(seat),
    to: from + ripple(seat) + minutes,
  }));
  if (cheers.some((cheer) => time >= cheer.from && time < cheer.to)) return 'cheer';
  // The two on each side of the green talk now and then: seats 2 and 3, and 4 and 5.
  const pair = seat < 4 ? 0 : 1;
  const offset = hash(`snowman-watch:${Math.floor(day)}:${pair}`) % WATCH_BEAT;
  const beat = Math.floor((time - base + offset) / WATCH_BEAT);
  const start = base + beat * WATCH_BEAT - offset;
  const clear = cheers.every(
    (cheer) => start + WATCH_CHAT <= cheer.from - CHEER_CLEAR || start >= cheer.to + CHEER_CLEAR,
  );
  const chatting = (beat + pair) % 2 === 0 && start >= base && time < start + WATCH_CHAT && clear;
  return chatting ? 'chat' : 'sit';
}

/**
 * How many snowmen stand on the green at a moment: finished (dressed at 15:45 on its build day)
 * and not yet melted away. A half-rolled one is not counted, nor the carrot and scarf left behind.
 */
export function snowmenStanding(day: number, minutes: number) {
  let standing = 0;
  for (let k = 0; k < SNOWMAN_DAYS.length; k++) {
    const state = snowmanState(k, day, minutes);
    if (state && state.stage === 4 && state.melt < 1) standing++;
  }
  return standing;
}
