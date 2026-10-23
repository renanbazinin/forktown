import type { EventPose } from './events';
import { hash, type Point } from './world';
import {
  FLASH_MOB_LINGER,
  FLASH_MOB_SPOTS,
  FLASH_MOB_TIMES,
  FOUNTAIN,
  squareApproach,
} from './square';
import { FLASH_MOB_CUES, flashMobBeat, minuteOfBeat } from './flash-mob-beat';
import { facingAlong, facingToward, opposite, sideways } from './walking';

type Facing = 'se' | 'sw' | 'ne' | 'nw';

/** Where a dancer is and what they are doing at one moment of the flash mob. */
export type FlashMobFrame = {
  position: Point;
  moving: boolean;
  facing: Facing;
  walkPhase: number;
  pose?: EventPose;
  /** True only while they dance (the mob's secret is out); false while they linger. */
  dancing: boolean;
};

// Minutes, as resident-trips.ts keeps them for every other outing (not imported: it imports us).
/** Halfway down into a seat, or up out of it. */
const SEAT_SETTLE = 0.4;
/** A quarter turn on the spot, before walking off the other way or after arriving from it. */
const SPOT_TURN = 0.2;
/** The least time any pose is held, so none flashes up. */
const POSE_HOLD = 1;
/** Beats of each dancer's walk from where they linger into their place. */
const WALK_IN = 2;
/** Tiles a walk keeps clear of the fountain's basin: its rim (0.27 wide) and a step beyond. */
const BASIN_CLEAR = 0.45;
/** Tiles a minute strolling back afterwards, as if nothing happened (brisk: a minute is a second). */
const STROLL_SPEED = 3;
/** Minutes standing still after the final pose before strolling back. */
const AFTER_PAUSE = 0.5;

/** The facings clockwise, a quarter turn apart. */
const RING: readonly Facing[] = ['ne', 'se', 'sw', 'nw'];
const turned = (facing: Facing, quarters: number) =>
  RING[(RING.indexOf(facing) + quarters + 400) % 4];

const SEATED_LINGER: ReadonlySet<string> = new Set(['perch', 'tea', 'read']);

function segmentDistance(a: Point, b: Point, c: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
  );
  return Math.hypot(a.x + dx * t - c.x, a.y + dy * t - c.y);
}
/**
 * A walk from `a` to `b` on the square that keeps BASIN_CLEAR off the fountain's basin (or, from
 * a seat on its rim, comes no nearer than that seat): straight when it can, else round the side
 * the straight line passes on, through the nearest point out from the basin that both legs clear.
 */
function aroundFountain(a: Point, b: Point): Point[] {
  const clear = Math.min(
    FOUNTAIN.basin + BASIN_CLEAR,
    Math.hypot(a.x - FOUNTAIN.x, a.y - FOUNTAIN.y) - 1e-6,
    Math.hypot(b.x - FOUNTAIN.x, b.y - FOUNTAIN.y) - 1e-6,
  );
  if (segmentDistance(a, b, FOUNTAIN) >= clear) return [a, b];
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = ((FOUNTAIN.x - a.x) * dx + (FOUNTAIN.y - a.y) * dy) / (dx * dx + dy * dy || 1);
  let nx = a.x + dx * t - FOUNTAIN.x,
    ny = a.y + dy * t - FOUNTAIN.y;
  let n = Math.hypot(nx, ny);
  // Straight through the middle: round the front, the side toward the viewer.
  if (n < 1e-6)
    [nx, ny, n] = dx * -1 + dy > 0 ? [-dy, dx, Math.hypot(dx, dy)] : [dy, -dx, Math.hypot(dx, dy)];
  for (let r = clear + 0.05; r < clear + 3; r += 0.05) {
    const w = { x: FOUNTAIN.x + (nx / n) * r, y: FOUNTAIN.y + (ny / n) * r };
    if (segmentDistance(a, w, FOUNTAIN) >= clear && segmentDistance(w, b, FOUNTAIN) >= clear)
      return [a, w, b];
  }
  return [a, b];
}

/** A walk laid out once: its points, the running length at each and each stretch's facing. */
type Walk = { points: Point[]; at: number[]; length: number; facings: Facing[] };
function walkOf(points: Point[]): Walk {
  const at = [0];
  const facings: Facing[] = [];
  for (let i = 1; i < points.length; i++) {
    at.push(at[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    facings.push(facingToward(points[i - 1], points[i]));
  }
  return { points, at, length: at.at(-1)!, facings };
}
/** Where a walk is `f` of the way along it (0..1), and the facing of that stretch. */
function along(walk: Walk, f: number): { position: Point; facing: Facing } {
  const distance = Math.max(0, Math.min(1, f)) * walk.length;
  let i = 1;
  while (i < walk.points.length - 1 && walk.at[i] <= distance) i++;
  const a = walk.points[i - 1],
    b = walk.points[i];
  const span = walk.at[i] - walk.at[i - 1];
  const t = span ? (distance - walk.at[i - 1]) / span : 1;
  return {
    position: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
    facing: walk.facings[i - 1] ?? 'se',
  };
}

/** The first beat of seat k's part: seat 0 starts it alone, the rest join two beats apart. */
const joinBeat = (seat: number) =>
  seat ? FLASH_MOB_CUES.join + 2 * (seat - 1) : FLASH_MOB_CUES.solo;
/**
 * How far across the arrow each spot stands, 0 at its left end to 1 at its right on screen (by
 * x − y): the wave and the finale's ripple run across it in that order, not by seat.
 */
const ACROSS: readonly number[] = (() => {
  const columns = FLASH_MOB_SPOTS.map((spot) => spot.x - spot.y);
  const low = Math.min(...columns),
    high = Math.max(...columns);
  return columns.map((column) => (high > low ? (column - low) / (high - low) : 0));
})();

/** Each seat's walks and turns, laid out once. */
const LAID_OUT = FLASH_MOB_SPOTS.map((spot, seat) => {
  const linger = FLASH_MOB_LINGER[seat];
  const join = walkOf(aroundFountain(linger, spot));
  const back = walkOf([...join.points].reverse());
  const approach = squareApproach(seat);
  const n = approach.length;
  return {
    linger,
    spot,
    join,
    back,
    /** Minutes the stroll back takes. */
    strolling: back.length ? Math.max(1, back.length / STROLL_SPEED) : 0,
    seated: !!linger.pose && SEATED_LINGER.has(linger.pose),
    /** The facing the walk in arrives with, and the one the walk home sets off with. */
    arriving: facingAlong(approach[n - 2], approach[n - 1]),
    leaving: facingAlong(approach[n - 1], approach[n - 2]),
  };
});
/** Minutes the first strollers set off back, a moment after the final pose. */
const STROLL_FROM = minuteOfBeat(FLASH_MOB_CUES.end) + AFTER_PAUSE;
/** The least distance between two people on the square at once, in tiles. */
const APART = 0.6;
/**
 * When each seat sets off back, in minutes after STROLL_FROM. The strolls all happen at once, so
 * they are worked out once, seat by seat (the longest strolls first): each waits a quarter minute
 * more until it keeps APART from every stroll already set, from those still waiting at their
 * spots and from those back where they lingered, while still back by the mob's end. A seat that
 * finds no such start goes first on the next try, a dozen tries at most; the best try is kept.
 */
const STROLL_DELAYS: readonly number[] = (() => {
  const where = (seat: number, delay: number, time: number) => {
    const s = LAID_OUT[seat];
    const f = s.strolling ? (time - STROLL_FROM - delay) / s.strolling : 1;
    return f <= 0 ? s.spot : f >= 1 ? s.linger : along(s.back, f).position;
  };
  const window = FLASH_MOB_TIMES.end - STROLL_FROM;
  const schedule = (order: readonly number[]) => {
    const delays: number[] = FLASH_MOB_SPOTS.map(() => 0);
    const done: number[] = [];
    let worst = Infinity,
      stuck = -1;
    for (const seat of order) {
      let best = 0,
        bestGap = -Infinity;
      for (let delay = 0; delay + LAID_OUT[seat].strolling <= window; delay += 0.25) {
        let gap = Infinity;
        // Sampled a little closer than a frame (1/15 minute), with a twentieth of a tile to spare.
        for (let time = STROLL_FROM; time <= FLASH_MOB_TIMES.end && gap >= APART; time += 0.02) {
          const at = where(seat, delay, time);
          for (const other of done) {
            const there = where(other, delays[other], time);
            gap = Math.min(gap, Math.hypot(at.x - there.x, at.y - there.y) - 0.05);
          }
        }
        if (gap > bestGap) [best, bestGap] = [delay, gap];
        if (gap >= APART) break;
      }
      delays[seat] = best;
      done.push(seat);
      if (bestGap < worst) worst = bestGap;
      if (bestGap < APART && stuck < 0) stuck = seat;
    }
    return { delays, worst, stuck };
  };
  let order = LAID_OUT.map((_, seat) => seat).sort(
    (a, b) => LAID_OUT[b].strolling - LAID_OUT[a].strolling || a - b,
  );
  let kept = schedule(order);
  for (let tries = 1, last = kept; tries < 12 && last.stuck >= 0; tries++) {
    const stuck = last.stuck;
    order = [stuck, ...order.filter((seat) => seat !== stuck)];
    last = schedule(order);
    if (last.worst > kept.worst) kept = last;
  }
  return kept.delays;
})();
const SEATS = LAID_OUT.map((s, seat) => {
  const homeward = STROLL_FROM + STROLL_DELAYS[seat];
  return {
    ...s,
    /** Minutes the stroll back starts and ends: all back where they lingered by the mob's end. */
    homeward,
    returned: Math.min(homeward + s.strolling, FLASH_MOB_TIMES.end),
  };
});

/**
 * An ordinary glance while lingering: in one window of five minutes in two, a quarter turn one
 * way or the other, held 1.2 to 2.1 minutes. Only if all of it falls between `from` and `to`, so
 * a turn never cuts one short.
 */
function glance(seat: number, day: number, time: number, from: number, to: number) {
  const window = Math.floor(time / 5);
  const h = hash(`flash-mob:${Math.floor(day)}:${seat}:${window}`);
  if (h % 2) return 0;
  const start = window * 5 + 0.5 + ((h >>> 4) % 20) / 10;
  const end = start + 1.2 + ((h >>> 9) % 10) / 10;
  if (time < start || time >= end || start < from || end > to) return 0;
  return (h >>> 14) % 2 ? 1 : -1;
}

/**
 * The routine's move for a dancer in their place at `beat` (seat 0 from beat 0, the others once
 * they have walked in): the pose, its walkPhase on the mob's beat, and the way they face (their
 * spot's `facing`, but while pointing and spinning). The plan, in beats from 17:00:
 *
 *    0–40   groove      the solo, then each new dancer from their arrival
 *   40–56   clap        on every beat
 *   56–72   point       facing se on even beats and sw on odd ones, pointing right then left
 *   72–88   groove      side steps
 *   88–104  wave        arms overhead in turn across the arrow, half a beat apart, swaying
 *  104–120  spin        a quarter turn clockwise on every beat, four times round
 *  120–136  jump        every other beat
 *  136–152  ripple      claps, with four sweeps of raised arms across the arrow and back
 *  152–160  jump        every other beat
 *  160–164  clap        on every beat
 *  164–168  jump        on every beat, building to the hit
 *  168–176  tada        held in silence
 */
function routine(
  seat: number,
  beat: number,
  facing: Facing,
): { pose: EventPose; phase: number; facing: Facing } {
  const across = ACROSS[seat] ?? 0;
  const twoBeat = (from: number) => ((((beat - from) / 2) % 1) + 1) % 1;
  const oneBeat = ((beat % 1) + 1) % 1;
  const move = (pose: EventPose, phase: number) => ({ pose, phase, facing });
  if (beat < 40) return move('groove', twoBeat(0));
  if (beat < 56) return move('clap', oneBeat);
  if (beat < 72)
    return { pose: 'point', phase: oneBeat, facing: Math.floor(beat) % 2 ? 'sw' : 'se' };
  if (beat < 88) return move('groove', twoBeat(0));
  if (beat < 104) {
    const from = 88 + across * 4;
    return beat < from ? move('groove', twoBeat(0)) : move('wave', twoBeat(from));
  }
  if (beat < 120)
    return { pose: 'spin', phase: oneBeat, facing: turned(facing, 1 + Math.floor(beat - 104)) };
  if (beat < 136) return move('jump', twoBeat(120));
  if (beat < 152) {
    const sweep = Math.floor((beat - 136) / 4);
    const up = (sweep % 2 ? 1 - across : across) * 1.5;
    const local = beat - 136 - sweep * 4;
    return local >= up && local < up + 1.5 ? move('wave', (local - up) / 2) : move('clap', oneBeat);
  }
  if (beat < 160) return move('jump', twoBeat(152));
  if (beat < 164) return move('clap', oneBeat);
  // Quick hops, one a beat, landing on the next with no time to stand between.
  if (beat < 168) return move('jump', oneBeat * 0.75);
  return move('tada', 0);
}

/**
 * A dancer's frame at trip-time minute `time` of `day`: lingering at FLASH_MOB_LINGER[seat] from
 * `arrive`, dancing at FLASH_MOB_SPOTS[seat] on the mob's beat, and back where they lingered by
 * `leave`, when they walk home. Pure: the same arguments always give the same frame.
 */
export function flashMobFrame(
  seat: number,
  time: number,
  day: number,
  arrive: number,
  leave: number,
): FlashMobFrame {
  const s = SEATS[seat];
  const { linger, spot } = s;
  const beat = flashMobBeat(time);
  const join = joinBeat(seat);
  // Lingering, before and after: seated or on their feet, glancing about now and then.
  const lingering = (
    from: number,
    to: number,
    came: Facing,
    goes: Facing,
    sit: boolean,
  ): FlashMobFrame => {
    const settling = sit && (time < from + SEAT_SETTLE || time >= to - SEAT_SETTLE);
    const facing =
      time < from + SPOT_TURN && opposite(came, linger.facing)
        ? sideways(linger.facing)
        : time >= to - SPOT_TURN && opposite(linger.facing, goes)
          ? sideways(linger.facing)
          : sit
            ? linger.facing
            : turned(linger.facing, glance(seat, day, time, from + POSE_HOLD, to - POSE_HOLD));
    return {
      position: { x: linger.x, y: linger.y },
      moving: false,
      facing,
      walkPhase: (time / 5 + seat / 10) % 1,
      ...(settling ? { pose: 'crouch' as const } : sit ? { pose: linger.pose } : {}),
      dancing: false,
    };
  };
  // Before: from arriving until their part, getting up a beat early from a seat.
  if (beat < join) {
    const ready = minuteOfBeat(join - 1);
    const first = s.join.facings[0] ?? spot.facing;
    // Seat 0 turns from the fountain to the viewer through a quarter on the beat before.
    if (!seat || !s.join.length) {
      if (beat >= join - 1)
        return {
          position: { x: spot.x, y: spot.y },
          moving: false,
          facing: opposite(linger.facing, spot.facing) ? sideways(linger.facing) : spot.facing,
          walkPhase: 0,
          dancing: false,
        };
      return lingering(arrive, ready, s.arriving, linger.facing, false);
    }
    if (beat >= join - 1)
      return {
        position: { x: linger.x, y: linger.y },
        moving: false,
        facing: opposite(linger.facing, first) ? sideways(linger.facing) : linger.facing,
        walkPhase: 0,
        ...(s.seated ? { pose: 'crouch' as const } : {}),
        dancing: false,
      };
    return lingering(arrive, ready + (s.seated ? SEAT_SETTLE : 0), s.arriving, first, s.seated);
  }
  // Their walk into place, a stride a beat.
  if (seat && beat < join + WALK_IN && s.join.length) {
    const walked = (beat - join) / WALK_IN;
    return {
      ...along(s.join, walked),
      moving: true,
      walkPhase: (beat - join) % 1,
      dancing: true,
    };
  }
  // Dancing; arriving from the far way round, they turn through a quarter on the first half beat.
  if (beat < FLASH_MOB_CUES.end) {
    const move = routine(seat, beat, spot.facing);
    const came = s.join.facings.at(-1);
    const turning =
      seat > 0 && beat < join + WALK_IN + 0.5 && !!came && opposite(came, move.facing);
    return {
      position: { x: spot.x, y: spot.y },
      moving: false,
      facing: turning ? sideways(move.facing) : move.facing,
      walkPhase: move.phase,
      pose: move.pose,
      dancing: true,
    };
  }
  // Arms down as if nothing happened, a moment's pause, and a stroll back to where they were.
  const home = s.back.facings[0] ?? linger.facing;
  if (time < s.homeward)
    return {
      position: { x: spot.x, y: spot.y },
      moving: false,
      facing:
        time >= s.homeward - SPOT_TURN && opposite(spot.facing, home)
          ? sideways(spot.facing)
          : spot.facing,
      walkPhase: 0,
      dancing: false,
    };
  if (time < s.returned) {
    const f = (time - s.homeward) / (s.returned - s.homeward);
    return {
      ...along(s.back, f),
      moving: true,
      walkPhase: ((time - s.homeward) * 2) % 1,
      dancing: false,
    };
  }
  // Seat 0 has no stroll: they turn back to the fountain through a quarter.
  const came = s.back.length ? (s.back.facings.at(-1) ?? linger.facing) : spot.facing;
  const sit = s.seated && leave - s.returned >= 2 * SEAT_SETTLE + POSE_HOLD;
  return lingering(s.returned, leave, came, s.leaving, sit);
}
