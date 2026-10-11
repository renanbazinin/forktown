// Life on a neighbor's own lot: the front door, the garden path and the spots where they sit,
// potter or pause between outings. Pure geometry and timing in world tiles and town minutes;
// src/city draws what these describe.
import type { Place } from './schema';
import type { EventPose } from './events';
import type { ResidentState } from './simulation';
import { DUCK_STREET_Y } from './ducks';
import { duckAwareWalk, DUCK_NOTICE_RADIUS } from './duck-reactions';
import { hash, isRoad, type Plot, type Point } from './world';
import { snowCoverAt, yearDayAt } from './seasons';
import { laneAt, laneOffset, laneSide, walkLane, type LanePath } from './lanes';
import { facingAlong, facingToward, opposite, sideways, WALK_SPEED } from './walking';

/** Where on their own lot a neighbor is, or which way through the front door they are going. */
export type HomeSpotKind =
  | 'door'
  | 'bench'
  | 'porch'
  | 'step'
  | 'tree'
  | 'flowers'
  | 'beds'
  | 'paving'
  | 'gate'
  /** On the road in front of the lot, home for a moment between two outings. */
  | 'kerb';
/**
 * `out`: stepping out of the front door and down the path. `in`: up the path and in through the
 * door. `to` / `at` / `from`: walking to a spot, being there, and walking back to the road.
 */
export type HomeStage = 'out' | 'in' | 'to' | 'at' | 'from';
export type HomeLife = { spot: HomeSpotKind; stage: HomeStage };

/** Offsets from (plot.x, plot.y), in world tiles. The painted door's threshold, bottom centre. */
export const DOOR_OFFSET: Point = { x: 0.78, y: 1.045 };
/** The stepping stones run along this x offset, from the door toward the road. */
export const STONE_X = 0.76;
/** Just over the kerb, on the edge of the road in front of the lot, in line with the stones. */
export const KERB_OFFSET: Point = { x: STONE_X, y: 2.05 };

export const plotDoor = (plot: Point): Point => ({
  x: plot.x + DOOR_OFFSET.x,
  y: plot.y + DOOR_OFFSET.y,
});

/**
 * The seat anchors the art must line up with, as offsets from (plot.x, plot.y). A seated
 * figure's feet stand at `feet`; the seat's height and the hips over it live in the art
 * (houses.ts SEAT_TOPS and PERCH_HIPS_BEHIND, and the perch pose in residents.ts).
 */
export const BENCH_SEAT = { feet: { x: 1.44, y: 0.82 }, facing: 'sw' as const };
export const PORCH_CHAIR = { feet: { x: 0.37, y: 1.22 }, facing: 'sw' as const };
/** Sitting on the top stepping stone, just below the door. */
export const FRONT_STEP = { feet: { x: STONE_X, y: 1.24 }, facing: 'sw' as const };

/** Whether a home has a porch roof over its door: the porch feature, or any café. */
export const hasPorch = (place: Pick<Place, 'building' | 'design'>) =>
  place.design.feature === 'porch' || place.building === 'cafe';

type Facing = ResidentState['facing'];

// ---- The front door ----------------------------------------------------------------------

/** Minutes the front door takes to swing open or shut. */
export const DOOR_SWING = 0.4;
/** Minutes a neighbor takes to fade in or out while crossing the threshold. */
export const FADE_MINUTES = 0.5;

/**
 * How far the door stands open, 0..1, around someone stepping OUT onto the threshold at `te`: it
 * opens over the 0.4 minutes before, stays open while they walk off, and is shut by te + 1.3.
 */
export function doorOut(te: number, t: number): number {
  if (t < te - DOOR_SWING || t >= te + 1.3) return 0;
  if (t < te) return (t - te + DOOR_SWING) / DOOR_SWING;
  return t < te + 0.9 ? 1 : (te + 1.3 - t) / DOOR_SWING;
}

/** Around someone stepping IN over the threshold at `ti`: open by ti − 0.9, shut by ti + 0.7. */
export function doorIn(ti: number, t: number): number {
  if (t < ti - 1.3 || t >= ti + 0.7) return 0;
  if (t < ti - 0.9) return (t - ti + 1.3) / DOOR_SWING;
  return t < ti + 0.3 ? 1 : (ti + 0.7 - t) / DOOR_SWING;
}

// ---- Spots and the garden path -------------------------------------------------------------

/** The top stepping stone, just outside the door. */
const TOP: Point = { x: STONE_X, y: 1.16 };
/** plotEntrance as an offset: the road handoff where every trip and loop starts and ends. */
const ROAD: Point = { x: 0.5, y: 2.5 };
/** The garden gate: the end of the path on the verge, still on the lot. */
const GATE: Point = { x: STONE_X, y: 1.95 };

/** A place on the lot to spend a while, with the way to it from the stepping stones. */
export type HomeSpot = {
  kind: HomeSpotKind;
  /** Where the feet stand, as an offset from (plot.x, plot.y). */
  feet: Point;
  facing: Facing;
  pose?: EventPose;
  /** Sat on: a crouch on the way down and on the way up. */
  seated: boolean;
  /** Garden work, favoured in the morning and never done at night. */
  chore: boolean;
  /** Somewhere to enjoy the night from, too. */
  night: boolean;
  /** From a point on the stepping stones' line (x = STONE_X) to the feet, along the lawn. */
  via: Point[];
};

const BENCH_SPOT: HomeSpot = {
  kind: 'bench',
  feet: BENCH_SEAT.feet,
  facing: BENCH_SEAT.facing,
  pose: 'perch',
  seated: true,
  chore: false,
  night: true,
  via: [{ x: STONE_X, y: 1.45 }, { x: BENCH_SEAT.feet.x, y: 1.45 }, BENCH_SEAT.feet],
};
const PORCH_SPOT: HomeSpot = {
  kind: 'porch',
  feet: PORCH_CHAIR.feet,
  facing: PORCH_CHAIR.facing,
  pose: 'perch',
  seated: true,
  chore: false,
  night: true,
  via: [{ x: STONE_X, y: 1.3 }, { x: PORCH_CHAIR.feet.x, y: 1.3 }, PORCH_CHAIR.feet],
};
const STEP_SPOT: HomeSpot = {
  kind: 'step',
  feet: FRONT_STEP.feet,
  facing: FRONT_STEP.facing,
  pose: 'sit',
  seated: true,
  chore: false,
  night: true,
  via: [FRONT_STEP.feet],
};
const TREE_SPOT: HomeSpot = {
  kind: 'tree',
  feet: { x: 1.78, y: 0.92 },
  facing: 'sw',
  pose: 'read',
  seated: true,
  chore: false,
  night: false,
  via: [
    { x: STONE_X, y: 1.45 },
    { x: 1.78, y: 1.45 },
    { x: 1.78, y: 0.92 },
  ],
};
// A watering can reaches out to the figure's right when it faces 'ne', about a quarter tile along
// +x and -y (residents.ts): each watering spot stands that far short of what it waters.
const FLOWERS_SPOT: HomeSpot = {
  kind: 'flowers',
  feet: { x: 1.62, y: 0.97 },
  facing: 'ne',
  pose: 'water',
  seated: false,
  chore: true,
  night: false,
  via: [
    { x: STONE_X, y: 1.45 },
    { x: 1.62, y: 1.45 },
    { x: 1.62, y: 0.97 },
  ],
};
/**
 * In front of the bed left of the path, and in front of the bed right of it, watering each. A
 * porch home's chair stands just behind the left one, so there only the right one is watered.
 */
const BED_SPOTS: HomeSpot[] = [
  {
    kind: 'beds',
    feet: { x: 0.4, y: 1.56 },
    facing: 'ne',
    pose: 'water',
    seated: false,
    chore: true,
    night: false,
    via: [
      { x: STONE_X, y: 1.56 },
      { x: 0.4, y: 1.56 },
    ],
  },
  {
    kind: 'beds',
    feet: { x: 1.12, y: 1.45 },
    facing: 'ne',
    pose: 'water',
    seated: false,
    chore: true,
    night: false,
    via: [
      { x: STONE_X, y: 1.45 },
      { x: 1.12, y: 1.45 },
    ],
  },
];
const PAVING_SPOT: HomeSpot = {
  kind: 'paving',
  feet: { x: 1.15, y: 1.3 },
  facing: 'se',
  pose: 'sweep',
  seated: false,
  chore: true,
  night: false,
  via: [
    { x: STONE_X, y: 1.3 },
    { x: 1.15, y: 1.3 },
  ],
};
/** Every home's fallback for a short while: standing at the gate, looking down the street. */
const GATE_SPOT: HomeSpot = {
  kind: 'gate',
  feet: GATE,
  facing: 'sw',
  seated: false,
  chore: false,
  night: true,
  via: [GATE],
};

/** The spots a home's own look offers, the gate last. */
export function homeSpots(place: Pick<Place, 'building' | 'decoration' | 'design'>): HomeSpot[] {
  return [
    ...(place.decoration === 'bench' ? [BENCH_SPOT] : []),
    ...(hasPorch(place) ? [PORCH_SPOT] : []),
    STEP_SPOT,
    ...(place.decoration === 'tree' ? [TREE_SPOT] : []),
    ...(place.decoration === 'flowers' ? [FLOWERS_SPOT] : []),
    ...(place.design.garden === 'paving'
      ? [PAVING_SPOT]
      : hasPorch(place)
        ? [BED_SPOTS[1]]
        : BED_SPOTS),
    GATE_SPOT,
  ];
}

/** A way between the door or the road handoff and a spot, walked from that end to the spot. */
type Way = { points: Point[]; minutes: number; arrive: Facing; leave: Facing };
type Ways = { door: Way; stretch: Way; road: Way };
const pathMinutes = (points: readonly Point[]) =>
  points
    .slice(1)
    .reduce((sum, point, i) => sum + Math.hypot(point.x - points[i].x, point.y - points[i].y), 0) /
  WALK_SPEED;
function way(start: Point[], spot: HomeSpot): Way {
  const points = [...start];
  for (const point of spot.via) {
    const last = points[points.length - 1];
    if (point.x !== last.x || point.y !== last.y) points.push(point);
  }
  const n = points.length;
  return {
    points,
    minutes: pathMinutes(points),
    arrive: facingToward(points[n - 2], points[n - 1]),
    leave: facingToward(points[n - 1], points[n - 2]),
  };
}
const ways = new Map<HomeSpot, Ways>(
  [
    BENCH_SPOT,
    PORCH_SPOT,
    STEP_SPOT,
    TREE_SPOT,
    FLOWERS_SPOT,
    ...BED_SPOTS,
    PAVING_SPOT,
    GATE_SPOT,
  ].map((spot) => [
    spot,
    {
      door: way([DOOR_OFFSET, TOP], spot),
      // The morning stretch happens on the top step, on the way down the path.
      stretch: way([DOOR_OFFSET, TOP, FRONT_STEP.feet], spot),
      road: way([ROAD, KERB_OFFSET], spot),
    },
  ]),
);

// ---- Timing on the lot ---------------------------------------------------------------------

/** Minutes crouched on the way down onto a seat and on the way up. */
export const CROUCH_MINUTES = 0.4;
/** A quarter turn on the spot before an about-face, so nobody spins in a single frame. */
const TURN_MINUTES = 0.2;
/** The morning stretch on the top step, stepping out between 06:00 and 09:00. */
export const STRETCH_MINUTES = 1;
/** Never at a spot for less than this, walks there and back aside (the gate excepted). */
export const MIN_SPOT_MINUTES = 3;
/** At the spot on either side of 22:00, when the evening hands over to the night. */
const HANDOVER_MINUTES = 1.5;
/** Night mode (moonlit loops and night stays) runs from 22:00 to bedtime. */
export const NIGHT_START = 1320;
/**
 * Lantern hour starts at 20:00, with the town two-thirds dark: from then on nobody waters,
 * sweeps or reads in the garden, only sits out (the night spots), though loops and labels stay in
 * day mode.
 */
export const DUSK = 1200;
/** And it is dark until 06:00: nobody early out of the door starts a chore before then. */
export const DAWN = 360;
/** The longest a garden chore goes on, walks there and back included. */
export const CHORE_MOST = 40;
/**
 * The least a pause at the gate (or on the kerb) lasts: on the way through, anything shorter is
 * taken in the stride instead, walking the path a little slower, and a stay there is never
 * shorter, so a walk up or down the path never halts for a moment.
 */
export const GATE_PAUSE = 0.8;
/** The most indoor time a door walk borrows beside a free window, so no walk is ever cut. */
export const BORROW_MAX = 6;
/**
 * The most a neighbor steps out before their free time begins at the door, or goes in before it
 * ends, so a street's doors never open or shut in one frame on the hour.
 */
export const DOOR_STAGGER = 3;
/** Minutes from the road handoff up onto the kerb; and a stay there, turning round and pausing. */
const KERB_WALK = Math.hypot(KERB_OFFSET.x - ROAD.x, KERB_OFFSET.y - ROAD.y) / WALK_SPEED;
const KERB_STAY = 2 * KERB_WALK + TURN_MINUTES + GATE_PAUSE;

type Edge = 'door' | 'road' | 'spot';
/** Straight through between the door and the road, pausing at the gate at most. */
const passing = (spot: HomeSpot, from: Edge, to: Edge) =>
  spot.kind === 'gate' &&
  ((from === 'door' && to === 'road') || (from === 'road' && to === 'door'));

/** The minutes a stay at `spot` needs, walks in and out and the least time there included. */
function stayNeeds(spot: HomeSpot, from: Edge, to: Edge, stretch: boolean) {
  const through = passing(spot, from, to);
  const facing = through ? (from === 'door' ? 'sw' : 'ne') : spot.facing;
  const all = ways.get(spot)!;
  let minutes = 0;
  if (from !== 'spot') {
    const way = from === 'road' ? all.road : stretch ? all.stretch : all.door;
    minutes += way.minutes + (stretch ? STRETCH_MINUTES : 0);
    if (!through && opposite(way.arrive, facing)) minutes += TURN_MINUTES;
  }
  if (to !== 'spot') {
    const way = to === 'road' ? all.road : all.door;
    minutes += way.minutes;
    if (!through && opposite(facing, way.leave)) minutes += TURN_MINUTES;
  }
  return (
    minutes +
    (from === 'spot' || to === 'spot'
      ? HANDOVER_MINUTES
      : through
        ? 0
        : spot.kind === 'gate'
          ? GATE_PAUSE
          : MIN_SPOT_MINUTES)
  );
}

// ---- Loops round the blocks ----------------------------------------------------------------

/** A closed walk round one or more blocks, from the road handoff back to it, tile centre to tile centre. */
export type StrollLoop = {
  points: Point[];
  /** Distance walked at each point. */
  ends: number[];
  length: number;
  minutes: number;
  /** Whether it passes close enough to the ducks' street to stop for them. */
  ducks: boolean;
};
const loopsByPlot = new Map<string, StrollLoop[]>();

/**
 * Every rectangle of whole blocks, up to three wide and two tall, whose edge passes the home's
 * own doorstep and runs on road all the way round, walked either way. The home block's own
 * 16-tile loop always exists.
 */
export function strollLoops(plot: Plot): StrollLoop[] {
  let loops = loopsByPlot.get(plot.id);
  if (loops) return loops;
  loops = [];
  const x0 = plot.x,
    y0 = plot.y + 2;
  const centre = (x: number, y: number) => ({ x: x + 0.5, y: y + 0.5 });
  for (let w = 1; w <= 3; w++)
    for (let a = 0; a < w; a++) {
      const left = x0 - 2 - 4 * a,
        right = x0 + 2 + 4 * (w - 1 - a);
      for (let h = 1; h <= 2; h++)
        for (const far of [y0 - 4 * h, y0 + 4 * h]) {
          const top = Math.min(y0, far),
            bottom = Math.max(y0, far);
          let road = true;
          for (let x = left; road && x <= right; x++) road = isRoad(x, y0) && isRoad(x, far);
          for (let y = top; road && y <= bottom; y++) road = isRoad(left, y) && isRoad(right, y);
          if (!road) continue;
          for (const east of [true, false]) {
            const [first, second] = east ? [right, left] : [left, right];
            const points = [
              centre(x0, y0),
              centre(first, y0),
              centre(first, far),
              centre(second, far),
              centre(second, y0),
              centre(x0, y0),
            ];
            const ends = [0];
            for (let i = 1; i < points.length; i++)
              ends.push(
                ends[i - 1] +
                  Math.abs(points[i].x - points[i - 1].x) +
                  Math.abs(points[i].y - points[i - 1].y),
              );
            const length = ends[ends.length - 1];
            loops.push({
              points,
              ends,
              length,
              minutes: length / WALK_SPEED,
              ducks:
                top + 0.5 <= DUCK_STREET_Y + DUCK_NOTICE_RADIUS &&
                bottom + 0.5 >= DUCK_STREET_Y - DUCK_NOTICE_RADIUS,
            });
          }
        }
    }
  loopsByPlot.set(plot.id, loops);
  return loops;
}

// ---- The window planner ------------------------------------------------------------------

/** How a free window opens or closes: through the front door, or at the road handoff for a trip. */
export type WindowEdge = 'door' | 'road';
export type FreeWindow = { ws: number; we: number; start: WindowEdge; end: WindowEdge };

type StayItem = {
  kind: 'stay';
  t0: number;
  t1: number;
  from: Edge;
  to: Edge;
  night: boolean;
  key: string;
};
type LoopItem = { kind: 'loop'; t0: number; t1: number; loop: StrollLoop; night: boolean };
type Item = StayItem | LoopItem;
type Context = { home: Place; plot: Plot; day: number; spots: HomeSpot[]; loops: StrollLoop[] };

/** A stretch of the plan on the lot: a straight walk (a → b) or a stop (a = b). */
type LotSeg = {
  kind: 'lot';
  t0: number;
  t1: number;
  a: Point;
  b: Point;
  moving: boolean;
  facing: Facing;
  /** Distance walked at t0, so the stride runs on across the path's corners. */
  d0: number;
  pose?: EventPose;
  life: HomeLife;
  night: boolean;
};
type LoopSeg = { kind: 'loop'; t0: number; t1: number; loop: StrollLoop; night: boolean };
export type HomePlan = {
  key: string;
  /** The first visible minute and the first minute indoors again. */
  shown: number;
  hidden: number;
  /** Stepping out onto, and in over, the threshold (only at a door edge). */
  te?: number;
  ti?: number;
  segs: (LotSeg | LoopSeg)[];
  /** -1..1, this neighbor's side of the road (the same on their trips). */
  lane: number;
  /** 0..1, where this neighbor's sips, drops and sweeps start, so a street never moves as one. */
  phase: number;
};

/**
 * Cycles per town minute of a still pose's own motion (drawResident reads it from walkPhase): a
 * sip of tea every five minutes, a watering can's drops, a broom swept to and fro.
 */
const POSE_CYCLES: Partial<Record<EventPose, number>> = { tea: 0.2, water: 2, sweep: 1 };

/**
 * Stepping out between 06:00 and 09:00, some mornings a neighbor stretches on the top step: not
 * under a porch roof, where their raised hands would reach through it.
 */
const stretches = (context: Context, te: number) =>
  te >= 350 &&
  te < 540 &&
  !hasPorch(context.home) &&
  hash(`stretch:${context.home.id}:${context.day}`) % 2 === 0;

/**
 * A stay's usual length, walks included: 20–34 minutes by day and 12–22 at night. Beside the
 * door it may be as short as the walk itself, so some neighbors head straight out for a loop and
 * others come in straight from one, and a street of homes never sits down or sets out together.
 */
function stayMinutes(night: boolean, key: string, least?: number) {
  const most = night ? 22 : 34;
  const from = least === undefined ? (night ? 12 : 20) : Math.min(most, Math.ceil(least));
  return from + (hash(`${night ? 'night-stay' : 'stay'}:${key}`) % (most - from + 1));
}

/** The shortest stay possible between two edges, at the gate (or, around 22:00, the step). */
function leastStay(from: Edge, to: Edge, stretch: boolean) {
  return stayNeeds(from === 'spot' || to === 'spot' ? STEP_SPOT : GATE_SPOT, from, to, stretch);
}

/**
 * Stays on the lot and loops round the blocks, always starting and ending with a stay: each loop
 * is picked by hash among those that still leave room for the stays; whatever the final stay has
 * beyond its usual length is shared out among all of them.
 */
function sequence(context: Context, ws: number, we: number, from: Edge, to: Edge, night: boolean) {
  const { home, day } = context;
  const loops = night ? context.loops.filter((loop) => loop.length <= 24) : context.loops;
  const items: Item[] = [];
  const finalLeast = leastStay('road', to, false);
  // The final stay's usual length, when it turns out to be the final one.
  // Door edges and 22:00 are shared by a whole street: stays beside them vary the most.
  const finalMinutes = (key: string) =>
    stayMinutes(night, key, to === 'road' ? undefined : finalLeast);
  let t = ws,
    edge = from;
  for (let k = 0; ; k++) {
    const key = `${home.id}:${day}:${ws}:${k}`;
    const least = leastStay(edge, 'road', edge === 'door' && stretches(context, t));
    const first = Math.max(stayMinutes(night, key, edge === 'road' ? undefined : least), least);
    const room = we - t - first - finalLeast;
    const fitting = loops.filter((loop) => loop.minutes <= room + 1e-9);
    if (!fitting.length) {
      items.push({ kind: 'stay', t0: t, t1: we, from: edge, to, night, key });
      break;
    }
    const loop = fitting[hash(`loop:${key}`) % fitting.length];
    items.push({ kind: 'stay', t0: t, t1: t + first, from: edge, to: 'road', night, key });
    items.push({ kind: 'loop', t0: t + first, t1: t + first + loop.minutes, loop, night });
    t += first + loop.minutes;
    edge = 'road';
  }
  // A long final stay shares its extra time with the others, so no stay drags on.
  const last = items[items.length - 1] as StayItem;
  const extra = last.t1 - last.t0 - finalMinutes(last.key);
  if (items.length > 1 && extra > 0) {
    const stays = items.filter((item) => item.kind === 'stay');
    const total = stays.reduce(
      (sum, item) => sum + (item === last ? finalMinutes(item.key) : item.t1 - item.t0),
      0,
    );
    let at = ws;
    for (const item of items) {
      const length =
        item.kind === 'loop'
          ? item.t1 - item.t0
          : item === last
            ? we - at
            : (item.t1 - item.t0) * (1 + extra / total);
      item.t0 = at;
      item.t1 = at += length;
    }
  }
  return items;
}

/** The window's stays and loops, split at 22:00 when an evening runs on into a night out. */
function layout(context: Context, { ws, we, start, end }: FreeWindow): Item[] {
  if (ws < NIGHT_START && we > NIGHT_START) {
    if (
      NIGHT_START - ws >= leastStay(start, 'spot', start === 'door' && stretches(context, ws)) &&
      we - NIGHT_START >= leastStay('spot', end, false)
    )
      return [
        ...sequence(context, ws, NIGHT_START, start, 'spot', false),
        ...sequence(context, NIGHT_START, we, 'spot', end, true),
      ];
  }
  // Too little on one side of 22:00 to split: night mode only when it is all but night already
  // (an evening running a few minutes past 22:00 into an outing stays in day mode).
  const night =
    ws >= NIGHT_START ||
    (we > NIGHT_START &&
      NIGHT_START - ws < leastStay(start, 'spot', start === 'door' && stretches(context, ws)));
  return sequence(context, ws, we, start, end, night);
}

/** What a stay's spot choice weighs up beyond the spot itself. */
type Weighing = {
  minutes: number;
  morning: boolean;
  night: boolean;
  /** The home has a bench or a porch to sit on, so the front step comes a distant second. */
  seats: boolean;
  /** Snow lies on the garden: no watering, little reading out under a bare tree. */
  snow: boolean;
  /** How many beds the home waters, which share a chore's weight between them. */
  beds: number;
};
function weight(spot: HomeSpot, { minutes, morning, night, seats, snow, beds }: Weighing) {
  if (spot.kind === 'gate') return 0;
  if (spot.kind === 'step' && seats) return 0.35;
  if (night) return spot.kind === 'step' ? 0.6 : 1;
  if (snow && spot.pose === 'water') return 0;
  if (spot.chore)
    return (
      (spot.kind === 'beds' ? 1 / beds : 1) *
      (morning ? 2.5 : 1) *
      // Sweeping the snow off the path is the one winter chore, and a common one.
      (snow && spot.kind === 'paving' ? 2 : 1)
    );
  const long = minutes >= 26;
  const base = spot.kind === 'step' ? (long ? 1 : 0.6) : long ? 2 : 1;
  return spot.kind === 'tree' && snow ? 0.15 : base;
}

/**
 * The spot for a stay: by hash among those that fit its minutes, seats favoured for longer
 * stays and garden work in the morning; the gate when nothing else fits, and at a door edge the
 * gate even so (the walk then borrows indoor time). `undefined` stands at the road handoff.
 */
function chooseSpot(
  context: Context,
  stay: StayItem,
  stretch: boolean,
  /** Minutes before the stay begins that its door opens (a street's doors open apart). */
  lead: number,
  next?: StayItem,
): HomeSpot | undefined {
  const minutes = stay.t1 - stay.t0;
  const morning = stay.t0 < 720;
  /** When they would get to the spot: after stepping out, stretching and walking to it. */
  const reached = (spot: HomeSpot) => {
    const all = ways.get(spot)!;
    if (stay.from === 'spot') return stay.t0;
    if (stay.from === 'road') return stay.t0 + all.road.minutes;
    return stay.t0 - lead + (stretch ? all.stretch.minutes + STRETCH_MINUTES : all.door.minutes);
  };
  // In the dark (from 20:00, even in day mode, and before 06:00), only the spots to sit out the
  // night at will do.
  const dark = (spot: HomeSpot) => stay.night || stay.t1 > DUSK || reached(spot) < DAWN;
  const fits = context.spots.filter(
    (spot) =>
      (spot.night || !dark(spot)) &&
      (!spot.chore || minutes <= CHORE_MOST) &&
      stayNeeds(spot, stay.from, stay.to, stretch) <= minutes + 1e-9 &&
      // The seat kept across 22:00 must also leave time to get up and go after it.
      (stay.to !== 'spot' ||
        (spot.night &&
          !!next &&
          stayNeeds(spot, 'spot', next.to, false) <= next.t1 - next.t0 + 1e-9)),
  );
  const weighing: Weighing = {
    minutes,
    morning,
    // The seat kept across 22:00 is a night spot; the gate never is.
    night: stay.night || stay.to === 'spot',
    seats: context.spots.some((spot) => spot.kind === 'bench' || spot.kind === 'porch'),
    snow: snowCoverAt(yearDayAt(context.day, stay.t0)) > 0.5,
    beds: context.spots.filter((spot) => spot.kind === 'beds').length,
  };
  const weighed = fits
    .map((spot) => ({ spot, weight: weight(spot, weighing) }))
    .filter((option) => option.weight > 0);
  if (weighed.length) {
    let pick =
      (hash(`spot:${stay.key}`) / 2 ** 32) *
      weighed.reduce((sum, option) => sum + option.weight, 0);
    for (const option of weighed) if ((pick -= option.weight) < 0) return option.spot;
    return weighed[weighed.length - 1].spot;
  }
  if (stay.to === 'spot') return STEP_SPOT;
  if (fits.length || stay.from === 'door' || stay.to === 'door') return GATE_SPOT;
  return undefined;
}

/** Builds a plan's segments in time order. */
class Track {
  segs: (LotSeg | LoopSeg)[] = [];
  t = 0;
  at: Point = ROAD;
  facing: Facing = 'sw';
  walked = 0;
  constructor(private plot: Plot) {}
  private world(point: Point): Point {
    return { x: this.plot.x + point.x, y: this.plot.y + point.y };
  }
  /** Walk from `this.at` along offsets; the stage reads `before` until `switchAt`. */
  walk(
    points: Point[],
    life: HomeLife,
    night: boolean,
    switchAt = -Infinity,
    before = life,
    /** Minutes a tile, as a multiple of WALK_SPEED's: over 1 is an unhurried amble. */
    slow = 1,
  ) {
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1],
        to = points[i];
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      if (!length) continue;
      const t0 = this.t,
        t1 = t0 + (length / WALK_SPEED) * slow;
      const facing = facingToward(from, to);
      const a = this.world(from),
        b = this.world(to);
      const piece = (s0: number, s1: number, pa: Point, pb: Point, d0: number, stage: HomeLife) =>
        this.segs.push({
          kind: 'lot',
          t0: s0,
          t1: s1,
          a: pa,
          b: pb,
          moving: true,
          facing,
          d0,
          life: stage,
          night,
        });
      if (t0 < switchAt && switchAt < t1) {
        const f = (switchAt - t0) / (t1 - t0);
        const mid = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        piece(t0, switchAt, a, mid, this.walked, before);
        piece(switchAt, t1, mid, b, this.walked + length * f, life);
      } else piece(t0, t1, a, b, this.walked, t0 < switchAt ? before : life);
      this.t = t1;
      this.walked += length;
      this.facing = facing;
      this.at = to;
    }
  }
  hold(until: number, facing: Facing, life: HomeLife, night: boolean, pose?: EventPose) {
    if (until > this.t + 1e-9) {
      const at = this.world(this.at);
      this.segs.push({
        kind: 'lot',
        t0: this.t,
        t1: until,
        a: at,
        b: at,
        moving: false,
        facing,
        d0: this.walked,
        life,
        night,
        ...(pose ? { pose } : {}),
      });
      this.t = until;
    }
    this.facing = facing;
  }
  /** End exactly on the planned minute, whatever rounding the walks gathered. */
  close(t: number) {
    const last = this.segs[this.segs.length - 1];
    if (last) last.t1 = t;
    this.t = t;
  }
  stay(
    context: Context,
    stay: StayItem,
    spot: HomeSpot | undefined,
    t0: number,
    t1: number,
    stretch: boolean,
  ) {
    const { night } = stay;
    this.t = t0;
    if (!spot) {
      // Too short a gap between two trips even for the gate: a moment on the kerb in front of
      // the lot, off the road's walking line, when there is time to step up to it, turn round and
      // pause there properly; else at the road handoff.
      this.at = ROAD;
      if (t1 - t0 >= KERB_STAY - 1e-9) {
        this.walk([ROAD, KERB_OFFSET], { spot: 'kerb', stage: 'to' }, night);
        const here: HomeLife = { spot: 'kerb', stage: 'at' };
        this.hold(this.t + TURN_MINUTES, sideways('sw'), here, night);
        this.hold(t1 - KERB_WALK, 'sw', here, night);
        this.walk([KERB_OFFSET, ROAD], { spot: 'kerb', stage: 'from' }, night);
        this.close(t1);
      } else this.hold(t1, 'ne', { spot: 'kerb', stage: 'at' }, night);
      return;
    }
    const through = passing(spot, stay.from, stay.to);
    const facing = through ? (stay.from === 'door' ? 'sw' : 'ne') : spot.facing;
    const kind = through ? 'door' : spot.kind;
    const going: HomeLife = through
      ? { spot: 'door', stage: stay.from === 'door' ? 'from' : 'in' }
      : { spot: kind, stage: 'to' };
    const all = ways.get(spot)!;
    // Straight through, a pause at the gate shorter than GATE_PAUSE is walked instead.
    let slow = 1;
    if (through) {
      const needs = stayNeeds(spot, stay.from, stay.to, stretch);
      const walking = needs - (stretch ? STRETCH_MINUTES : 0),
        pause = t1 - t0 - needs;
      if (pause > 1e-9 && pause < GATE_PAUSE) slow = (walking + pause) / walking;
    }
    if (stay.from === 'spot') {
      this.at = spot.feet;
      this.facing = facing;
    } else {
      const way = stay.from === 'road' ? all.road : stretch ? all.stretch : all.door;
      const out: HomeLife = { spot: kind, stage: 'out' };
      const switchAt = stay.from === 'door' ? t0 + 1.3 : -Infinity;
      this.at = way.points[0];
      if (stretch) {
        this.walk(way.points.slice(0, 3), going, night, switchAt, out, slow);
        this.hold(this.t + STRETCH_MINUTES, 'sw', out, night, 'stretch');
        this.walk(way.points.slice(2), going, night, switchAt, out, slow);
      } else this.walk(way.points, going, night, switchAt, out, slow);
      if (!through && opposite(this.facing, facing))
        this.hold(this.t + TURN_MINUTES, sideways(facing), going, night);
    }
    const leaving = stay.to === 'spot' ? undefined : stay.to === 'road' ? all.road : all.door;
    const turnOut = !!leaving && !through && opposite(facing, leaving.leave);
    const leave = leaving ? t1 - leaving.minutes * slow - (turnOut ? TURN_MINUTES : 0) : t1;
    const here: HomeLife = through ? going : { spot: kind, stage: 'at' };
    const pose =
      night && spot.kind === 'porch' && context.home.building === 'cafe' ? 'tea' : spot.pose;
    if (spot.seated && !through) {
      if (stay.from !== 'spot') this.hold(this.t + CROUCH_MINUTES, facing, here, night, 'crouch');
      this.hold(leaving ? leave - CROUCH_MINUTES : leave, facing, here, night, pose);
      if (leaving) this.hold(leave, facing, here, night, 'crouch');
    } else this.hold(leave, facing, here, night, pose);
    if (leaving) {
      const off: HomeLife = through
        ? going
        : { spot: kind, stage: stay.to === 'door' ? 'in' : 'from' };
      if (turnOut) this.hold(this.t + TURN_MINUTES, sideways(facing), off, night);
      this.walk([...leaving.points].reverse(), off, night, -Infinity, off, slow);
    }
    this.close(t1);
  }
  loop(item: LoopItem) {
    this.segs.push({ kind: 'loop', t0: item.t0, t1: item.t1, loop: item.loop, night: item.night });
    const points = item.loop.points;
    this.t = item.t1;
    this.at = ROAD;
    this.facing = facingAlong(points[points.length - 2], points[points.length - 1]);
  }
}

const plans = new Map<string, HomePlan>();
const PLAN_CACHE = 4096;

/**
 * The plan for one free window of a neighbor's day: pure, and cached by everything it depends on
 * (the home's id, plot and look, the plan day and the window's bounds and edges).
 */
export function windowPlan(home: Place, plot: Plot, day: number, window: FreeWindow): HomePlan {
  const { ws, we, start, end } = window;
  const key = `${home.id}|${plot.id}|${home.building}|${home.decoration}|${home.design.feature}|${home.design.garden}|${day}|${ws}|${we}|${start}|${end}`;
  let plan = plans.get(key);
  if (plan) return plan;
  const context: Context = { home, plot, day, spots: homeSpots(home), loops: strollLoops(plot) };
  const items = layout(context, window);
  const track = new Track(plot);
  let shown = ws,
    hidden = we;
  let handover: HomeSpot | undefined;
  items.forEach((item, i) => {
    if (item.kind === 'loop') return track.loop(item);
    let t0 = item.t0,
      t1 = item.t1;
    let stretch = item.from === 'door' && stretches(context, t0);
    // A street's front doors open and shut a moment apart, not all on the stroke of the hour
    // (below): how far apart, for this stay.
    const stagger = (salt: string) => (hash(`${salt}:${item.key}`) % (DOOR_STAGGER * 10 + 1)) / 10;
    const lead = item.from === 'door' ? stagger('door-out') : 0;
    const spot =
      item.from === 'spot'
        ? handover
        : chooseSpot(context, item, stretch, lead, items[i + 1] as StayItem | undefined);
    if (item.to === 'spot') handover = spot;
    if (spot) {
      // A door walk longer than its window borrows a few indoor minutes beside it.
      const short = stayNeeds(spot, item.from, item.to, stretch) - (t1 - t0);
      // Neighbors off on the same trip on the hour step out a moment apart and wait at the gate;
      // those home together from one pause there a moment apart before going in. Either way the
      // wait fills some of what the borrowed minutes leave over (a short one is walked, below).
      const wait = (needs: number) =>
        Math.max(0, BORROW_MAX - needs) * ((hash(`door:${key}`) % 13) / 12);
      if (short > 0 && item.from === 'door') {
        stretch = stretches(context, t0 - short);
        const needs = stayNeeds(spot, item.from, item.to, stretch);
        shown = t0 = t1 - needs - wait(needs);
      } else if (short > 0 && item.to === 'door') {
        hidden = t1 += short + wait(t1 - t0 + short);
      } else if (short <= 0) {
        // Out up to DOOR_STAGGER minutes before the free time starts (borrowed, so everyone due
        // out is out on the hour), and in up to as long before it ends on the hour (bedtimes vary
        // already, and a night owl stays up until theirs).
        if (item.from === 'door') shown = t0 -= lead;
        if (item.to === 'door' && we <= NIGHT_START)
          hidden = t1 -= Math.min(-short, stagger('door-in'));
      }
    }
    track.stay(context, item, spot, t0, t1, stretch);
  });
  plan = {
    key,
    shown,
    hidden,
    ...(start === 'door' ? { te: shown } : {}),
    ...(end === 'door' ? { ti: hidden } : {}),
    segs: track.segs,
    lane: laneSide(home.id),
    phase: (hash(`pose:${home.id}`) % 100) / 100,
  };
  if (plans.size >= PLAN_CACHE) plans.delete(plans.keys().next().value!);
  plans.set(key, plan);
  return plan;
}

// ---- Where the plan has a neighbor at a given minute --------------------------------------

export type HomeMotion = Pick<ResidentState, 'position' | 'moving' | 'facing' | 'walkPhase'> &
  Partial<
    Pick<
      ResidentState,
      | 'pose'
      | 'lot'
      | 'fade'
      | 'door'
      | 'lane'
      | 'laneOffset'
      | 'nightWalk'
      | 'nightPorch'
      | 'duckLove'
    >
  >;
export type PlanPoint = { indoors: true; door?: number } | ({ indoors: false } & HomeMotion);

/** A loop's key among the day's loop lanes: its plan's key and the minute it sets off. */
export const loopKey = (plan: Pick<HomePlan, 'key'>, t0: number) => `${plan.key}#${t0}`;

/** Round a loop at `t`, eased into this neighbor's lane away from its ends. */
function loopMotion(seg: LoopSeg, lane: number, t: number): HomeMotion {
  const { points, ends, length } = seg.loop;
  const d = Math.max(0, Math.min(length, (t - seg.t0) * WALK_SPEED));
  let i = 0;
  while (i < points.length - 2 && d >= ends[i + 1]) i++;
  const a = points[i],
    b = points[i + 1];
  const f = (d - ends[i]) / (ends[i + 1] - ends[i]);
  const side = walkLane(lane, d, length);
  return {
    position: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
    moving: true,
    facing: facingAlong(a, b),
    walkPhase: (d * 3) % 1,
    ...(side ? { lane: side, laneOffset: laneOffset(points, d, side) } : {}),
  };
}

/**
 * The plan at `t` (in its plan day's minutes); indoors before it is shown and once hidden. Loops
 * take their lane from `lanes` (by loopKey) when it has one, else this neighbor's own side.
 */
export function planAt(
  plan: HomePlan,
  t: number,
  lanes?: (key: string) => LanePath | undefined,
): PlanPoint {
  const door = Math.max(
    plan.te === undefined ? 0 : doorOut(plan.te, t),
    plan.ti === undefined ? 0 : doorIn(plan.ti, t),
  );
  const open = door > 0 ? { door } : {};
  if (t < plan.shown || t >= plan.hidden) return { indoors: true, ...open };
  const { segs } = plan;
  let low = 0,
    high = segs.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (segs[mid].t0 <= t) low = mid;
    else high = mid - 1;
  }
  const seg = segs[low];
  let motion: HomeMotion;
  if (seg.kind === 'loop') {
    const lane = lanes?.(loopKey(plan, seg.t0)) ?? plan.lane;
    // A duck stop freezes the whole figure; catch-up uses lanes planned against town time.
    const sample = (at: number, laneTime = at) => loopMotion(seg, laneAt(lane, laneTime), at);
    motion = seg.loop.ducks
      ? (duckAwareWalk(`${plan.key}#${seg.t0}`, t, seg.t0, seg.t1, sample) as HomeMotion)
      : sample(t);
    if (seg.night) motion.nightWalk = true;
  } else {
    const f = seg.moving ? Math.max(0, Math.min(1, (t - seg.t0) / (seg.t1 - seg.t0))) : 0;
    const walked = seg.moving ? seg.d0 + Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) * f : 0;
    const cycles = seg.pose && POSE_CYCLES[seg.pose];
    motion = {
      position: seg.moving
        ? { x: seg.a.x + (seg.b.x - seg.a.x) * f, y: seg.a.y + (seg.b.y - seg.a.y) * f }
        : seg.a,
      moving: seg.moving,
      facing: seg.facing,
      walkPhase: seg.moving
        ? (walked * 3) % 1
        : cycles
          ? (((t * cycles + plan.phase) % 1) + 1) % 1
          : 0,
      ...(seg.pose ? { pose: seg.pose } : {}),
      lot: seg.life,
      ...(seg.night && (seg.life.stage === 'to' || seg.life.stage === 'at')
        ? { nightPorch: true }
        : {}),
    };
  }
  const fade = Math.min(
    plan.te === undefined ? 1 : (t - plan.te) / FADE_MINUTES,
    plan.ti === undefined ? 1 : (plan.ti - t) / FADE_MINUTES,
  );
  return { indoors: false, ...motion, ...(fade < 1 ? { fade: Math.max(0, fade) } : {}), ...open };
}
