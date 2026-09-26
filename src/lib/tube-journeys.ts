// Tube or walk, and where a traveller is along a journey that mixes the two.
// Pure: the choice depends only on the two road points and the constants in tubes.ts.
import type { ResidentState } from './simulation';
import type { Point } from './world';
import { alongRoute, facingAlong, roadPath, routeLength, WALK_SPEED } from './walking';
import {
  TUBE_ALIGHT,
  TUBE_ALIGHT_STEPS,
  TUBE_ALTITUDE,
  TUBE_BOARD,
  TUBE_BOARD_STEPS,
  TUBE_MIN_SAVING,
  TUBE_SPEED,
  TUBE_STATIONS,
  tubeAt,
  tubeFixedMinutes,
  tubeLength,
  tubeRoute,
  tubeStation,
  type ResidentTransit,
} from './tubes';

export type { ResidentTransit, TubeStage } from './tubes';
type Leg = {
  /** Ground polyline. Board is door → stack, ride is the glass's ground trace, alight is
   *  stack → door. Legs chain end to start. */
  route: Point[];
  /** How long this leg takes on this trip (walks at the trip's own pace). */
  minutes: number;
};
/** One leg of a journey: a walk on the road, or boarding, riding or stepping off the tube. */
export type TripLeg =
  | (Leg & { kind: 'walk' })
  | (Leg & {
      kind: 'board' | 'ride' | 'alight';
      /** The ride's boarding and stepping-off station ids. */
      from: string;
      to: string;
    });
export type TubeChoice = {
  from: string;
  to: string;
  /** Road walk from the start to the boarding door, and from the far door to the end. */
  before: Point[];
  after: Point[];
  /** Unhurried minutes saved against walking the whole road path. */
  saving: number;
};

const same = (a: Point | undefined, b: Point) => !!a && a.x === b.x && a.y === b.y;
const choices = new Map<string, TubeChoice | null>();
/**
 * The best tube ride between two road points, or undefined when walking is as good. Rides only
 * when door to door is at least TUBE_MIN_SAVING unhurried minutes faster; ties keep the first
 * station pair in line order.
 */
export function tubeChoice(start: Point, end: Point): TubeChoice | undefined {
  const key = `${start.x},${start.y}:${end.x},${end.y}`;
  const cached = choices.get(key);
  if (cached !== undefined) return cached ?? undefined;
  const walk = routeLength(roadPath(start, end)) / WALK_SPEED;
  let best: (TubeChoice & { time: number }) | undefined;
  for (const a of TUBE_STATIONS)
    for (const b of TUBE_STATIONS) {
      if (a === b) continue;
      const before = roadPath(start, a.door),
        after = roadPath(b.door, end);
      if (!same(before.at(-1), a.door) || !same(after.at(-1), end)) continue;
      const time =
        (routeLength(before) + routeLength(after)) / WALK_SPEED + tubeFixedMinutes(a.id, b.id);
      if (!best || time < best.time)
        best = { from: a.id, to: b.id, before, after, saving: walk - time, time };
    }
  const choice =
    best && best.saving >= TUBE_MIN_SAVING
      ? {
          from: best.from,
          to: best.to,
          before: best.before,
          after: best.after,
          saving: best.saving,
        }
      : undefined;
  // Bounded like roadPath's cache.
  if (choices.size > 4096) choices.clear();
  choices.set(key, choice ?? null);
  return choice;
}

/** Door to door between two stations: by tube, and on foot (for honest copy). */
export function tubeLineMinutes(from: string, to: string) {
  const a = tubeStation(from),
    b = tubeStation(to);
  return {
    tube: tubeFixedMinutes(from, to),
    walk: routeLength(roadPath(a.door, b.door)) / WALK_SPEED,
  };
}

/** Join the road walk to the venue's approach at the first approach point that lies on the road's last
 *  straight run (row or column), so nobody walks past the gate and back. Tube legs only. */
export function joinApproach(after: readonly Point[], tail: readonly Point[]): Point[] {
  if (tail.length < 2) return [...after];
  const c = tail[1];
  for (let i = after.length - 1; i > 0; i--) {
    const a = after[i - 1],
      b = after[i];
    const row = a.y === c.y && b.y === c.y,
      column = a.x === c.x && b.x === c.x;
    if (!row && !column) break;
    const [p, q, v] = row ? [a.x, b.x, c.x] : [a.y, b.y, c.y];
    if (Math.min(p, q) <= v && v <= Math.max(p, q)) {
      const head = after.slice(0, i);
      if (head.at(-1)!.x === c.x && head.at(-1)!.y === c.y) head.pop();
      return [...head, c, ...tail.slice(2)];
    }
  }
  return [...after, ...tail.slice(1)];
}

const walkLeg = (route: Point[]): TripLeg => ({
  kind: 'walk',
  route,
  minutes: routeLength(route) / WALK_SPEED,
});
/** Unhurried legs: walk to the door, board (the walk to the stack is inside it), ride, step off
 *  (and walk back to the door), walk on along `tail`. */
export function tubeLegs(
  choice: TubeChoice,
  tail: readonly Point[] = [choice.after.at(-1)!],
): TripLeg[] {
  const { from, to } = choice;
  const a = tubeStation(from),
    b = tubeStation(to);
  // The ride's ground trace; the lift stays in tubes.ts.
  const route = tubeRoute(from, to).map(({ x, y }) => ({ x, y }));
  const legs: TripLeg[] = [
    // Copies: roadPath's cached arrays are shared.
    walkLeg([...choice.before]),
    { kind: 'board', route: [a.door, a.stack], minutes: TUBE_BOARD, from, to },
    { kind: 'ride', route, minutes: tubeLength(from, to) / TUBE_SPEED, from, to },
    { kind: 'alight', route: [b.stack, b.door], minutes: TUBE_ALIGHT, from, to },
    walkLeg(joinApproach(choice.after, tail)),
  ];
  return legs.filter((leg) => leg.minutes > 0);
}
/** The whole ground trace, joints once: doorstep … door, stack, the glass, stack, door … end. */
export const legsRoute = (legs: readonly TripLeg[]): Point[] =>
  legs.reduce<Point[]>(
    (route, leg) => (route.length ? [...route, ...leg.route.slice(1)] : [...leg.route]),
    [],
  );
export const legsMinutes = (legs: readonly TripLeg[]) =>
  legs.reduce((sum, leg) => sum + leg.minutes, 0);
export const walkedTiles = (legs: readonly TripLeg[]) =>
  legs.reduce((sum, leg) => sum + (leg.kind === 'walk' ? routeLength(leg.route) : 0), 0);
export const fixedMinutes = (legs: readonly TripLeg[]) =>
  legs.reduce((sum, leg) => sum + (leg.kind === 'walk' ? 0 : leg.minutes), 0);
/** Tiles per minute on the walking legs (the planned, possibly brisk, pace). */
export const walkingPace = (legs: readonly TripLeg[]) =>
  walkedTiles(legs) / legs.reduce((sum, leg) => sum + (leg.kind === 'walk' ? leg.minutes : 0), 0);
/** Walk at `speedMultiplier` × the normal pace; the tube keeps its own time. */
export const paceLegs = (legs: readonly TripLeg[], speedMultiplier: number): TripLeg[] =>
  legs.map((leg) =>
    leg.kind === 'walk'
      ? { ...leg, minutes: routeLength(leg.route) / WALK_SPEED / speedMultiplier }
      : leg,
  );
/** The same journey home: every route reversed, the ride's ends swapped, boarding and stepping off swapped. */
export const reverseLegs = (legs: readonly TripLeg[]): TripLeg[] =>
  [...legs].reverse().map((leg) => {
    const route = [...leg.route].reverse();
    if (leg.kind === 'walk') return { ...leg, route };
    if (leg.kind === 'ride') return { ...leg, route, from: leg.to, to: leg.from };
    const kind = leg.kind === 'board' ? 'alight' : 'board';
    return {
      kind,
      route,
      minutes: kind === 'board' ? TUBE_BOARD : TUBE_ALIGHT,
      from: leg.to,
      to: leg.from,
    };
  });

/** A point k of the way from p to q, landing exactly on either end. */
const between = (p: Point, q: Point, k: number): Point =>
  k <= 0 ? { ...p } : k >= 1 ? { ...q } : { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
type Movement = Pick<ResidentState, 'position' | 'moving' | 'facing' | 'walkPhase'> & {
  transit?: ResidentTransit;
};
/**
 * Where a traveller is at `time` on a journey that sets out at `start`. Each leg ends at the
 * running sum start + minutes + …, added leg by leg exactly as tubeRides adds them, so the town
 * and the panel change stage at the same instant, even on a pinned whole minute. Walking legs
 * match alongRoute exactly.
 */
export function journeyAt(legs: readonly TripLeg[], start: number, time: number): Movement {
  let startAt = start;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i],
      endAt = startAt + leg.minutes;
    if (time >= endAt && i < legs.length - 1) {
      startAt = endAt;
      continue;
    }
    const progress = time >= endAt ? 1 : Math.min(1, Math.max(0, time - startAt) / leg.minutes);
    if (leg.kind === 'walk') return alongRoute(leg.route, progress);
    const { from, to } = leg;
    if (leg.kind === 'ride') {
      const distance = progress * tubeLength(from, to);
      const at = tubeAt(from, to, distance);
      return {
        position: at.position,
        moving: false,
        facing: at.facing,
        walkPhase: 0,
        transit: { stage: 'riding', from, to, progress, altitude: at.altitude, distance },
      };
    }
    const t = progress * leg.minutes;
    if (leg.kind === 'board') {
      // Walk in to the stack, turn to face out, crouch, and fwoomp up into the glass.
      const station = tubeStation(from);
      const position = between(station.door, station.stack, t / TUBE_BOARD_STEPS.walk);
      const walking = t < TUBE_BOARD_STEPS.walk;
      const walked = Math.hypot(position.x - station.door.x, position.y - station.door.y);
      const lift =
        t <= TUBE_BOARD_STEPS.crouch
          ? 0
          : (TUBE_ALTITUDE.spur * (t - TUBE_BOARD_STEPS.crouch)) /
            (TUBE_BOARD - TUBE_BOARD_STEPS.crouch);
      return {
        position,
        moving: walking,
        facing: walking ? facingAlong(station.door, station.stack) : 'sw',
        walkPhase: walking ? (walked * 3) % 1 : 0,
        transit: {
          stage: 'boarding',
          from,
          to,
          progress,
          altitude: Math.min(TUBE_ALTITUDE.spur, lift),
          distance: 0,
        },
      };
    }
    // Drop out of the glass, settle, then walk out from the stack to the door.
    const station = tubeStation(to);
    const { drop, settle } = TUBE_ALIGHT_STEPS;
    const position = between(
      station.stack,
      station.door,
      t < settle ? 0 : (t - settle) / (TUBE_ALIGHT - settle),
    );
    const moving = t >= settle && progress < 1;
    const walked = Math.hypot(position.x - station.stack.x, position.y - station.stack.y);
    return {
      position,
      moving,
      facing: facingAlong(station.stack, station.door),
      walkPhase: moving ? (walked * 3) % 1 : 0,
      transit: {
        stage: 'alighting',
        from,
        to,
        progress,
        altitude: t < drop ? TUBE_ALTITUDE.spur * (1 - t / drop) : 0,
        distance: tubeLength(from, to),
      },
    };
  }
  throw new Error('A journey needs at least one leg.');
}
