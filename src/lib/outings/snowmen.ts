// Snowmen on the Lunch Green (agent E, SPEC §4.6): on a build day (variant `snowmen`) lunch seats 0
// and 1 alternate `crouch` and `play` (each held at least a minute) from 14:00 to 15:45; seats 2–5
// only `sit`, `chat` or `cheer`. The planner's attendingPose calls these on that variant only, and
// they answer for the whole lunch: everyone sits before the building starts and after it is done.
// Import rule (SPEC §7.3): value-import only world, town-calendar, seasons, district-places and
// district-calendar; never resident-trips, events or anything under src/city/.
import type { EventPose } from '../events.ts';
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

/**
 * A builder's pose (lunch seats 0 and 1): building 14:00–15:45, and sat on their blanket the rest
 * of the lunch. Only the seats' own changes, all held a minute or more, so the lunch's beat (which
 * these glances cannot see) never cuts in just before or after the building.
 */
export function snowmenBuilderPose(seat: number, time: number, day: number): EventPose | undefined {
  if (seat < 0 || seat > 1) return undefined;
  if (time < base || time >= dressed) return 'sit';
  return builderSpells(seat, day).find((spell) => time < spell.to)?.pose;
}

/**
 * Which way each builder faces the day's snowman (k = 0..3, from lunch seats 0 and 1): the
 * quarter its spot lies in from the seat (SPEC §2.3 spots; the green's seats at local (−0.55, 0)
 * and (0.35, 0)). tests/snowmen.test.ts checks the table against both.
 */
type Facing = 'ne' | 'nw' | 'se' | 'sw';
export const BUILDER_FACING: readonly (readonly [Facing, Facing])[] = [
  ['se', 'se'],
  ['ne', 'ne'],
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
 * Not called yet: the lunch is not an outing, so its facing needs a hook in the planner
 * (REQUESTS-E.md). Undefined keeps the blanket's own facing.
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
 * A watcher's pose (lunch seats 2–5): sat on their blanket all lunch, chatting now and then while
 * the snowman goes up, and on their feet for the two cheers. Calm before 14:00 and after the last
 * cheer, so a guest settling in or getting up to go never changes pose within a minute of it.
 */
export function snowmenWatcherPose(seat: number, time: number, day: number): EventPose | undefined {
  const last = WATCHER_CHEERS.at(-1)!;
  if (seat < 2 || seat > 5) return undefined;
  if (time < base || time >= last.from + last.minutes + ripple(seat)) return 'sit';
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
