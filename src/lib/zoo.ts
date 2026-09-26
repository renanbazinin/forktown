import { ZOO_SITE } from './town-config.ts';
import { BLOCK_SIZE, PLOTS, project, hash, type Point } from './world.ts';
import { ZOO_LAYOUT, type ZooPropKind } from './zoo-layout.ts';

export const ZOO_VENUE = { id: 'zoo', plot: 'O6', name: 'Willow Grove Zoo', kind: 'zoo' } as const;
export const ZOO_PLOTS = PLOTS.filter(
  (plot) =>
    plot.row >= ZOO_SITE.row &&
    plot.row < ZOO_SITE.row + ZOO_SITE.rows &&
    plot.col >= ZOO_SITE.col &&
    plot.col < ZOO_SITE.col + ZOO_SITE.columns,
).map((plot) => plot.id);
export const isZooPlot = (id: string) => ZOO_PLOTS.includes(id);
export const ZOO_GROUND = {
  left: 2 + ZOO_SITE.col * BLOCK_SIZE,
  right: 1 + (ZOO_SITE.col + ZOO_SITE.columns) * BLOCK_SIZE,
  top: 2 + ZOO_SITE.row * BLOCK_SIZE,
  bottom: 1 + (ZOO_SITE.row + ZOO_SITE.rows) * BLOCK_SIZE,
};
export const ZOO_CENTER = {
  x: (ZOO_GROUND.left + ZOO_GROUND.right) / 2,
  y: (ZOO_GROUND.top + ZOO_GROUND.bottom) / 2,
};
// The north gate connects to a retained street; the central promenade reaches every habitat.
export const ZOO_ENTRANCE = { x: ZOO_CENTER.x, y: ZOO_GROUND.top - 0.5 };
export const ZOO_FRAME = {
  center: { ...project(ZOO_CENTER.x, ZOO_CENTER.y), y: project(ZOO_CENTER.x, ZOO_CENTER.y).y - 35 },
  width: (ZOO_GROUND.right - ZOO_GROUND.left + ZOO_GROUND.bottom - ZOO_GROUND.top) * 38 + 90,
  height: (ZOO_GROUND.right - ZOO_GROUND.left + ZOO_GROUND.bottom - ZOO_GROUND.top) * 19 + 150,
};
export type ZooAnimal = 'giraffe' | 'elephant' | 'zebra' | 'penguin';
const species: readonly (ZooAnimal | null)[] = [
  'giraffe',
  'elephant',
  null,
  'zebra',
  'penguin',
  null,
];
export const ZOO_HABITATS = species.map((animal, index) => ({
  id: `habitat-${index + 1}`,
  animal,
  name: [
    'Giraffe Grove',
    'Elephant Meadow',
    'Future habitat',
    'Zebra Plains',
    'Penguin Cove',
    'Future habitat',
  ][index],
  left: ZOO_GROUND.left + 1 + (index % 3) * 7.3,
  top: ZOO_GROUND.top + 1 + Math.floor(index / 3) * 7.6,
  width: 6.2,
  height: 5.4,
}));
export const ZOO_SPOTS = Array.from({ length: 12 }, (_, index) => ({
  x: ZOO_GROUND.left + 2 + index * 1.7,
  y: ZOO_CENTER.y,
}));
export const insideZoo = (point: Point) =>
  point.x >= ZOO_GROUND.left &&
  point.x <= ZOO_GROUND.right &&
  point.y >= ZOO_GROUND.top &&
  point.y <= ZOO_GROUND.bottom;
export const insideZooHabitat = (point: Point) =>
  ZOO_HABITATS.some(
    (h) =>
      point.x >= h.left &&
      point.x <= h.left + h.width &&
      point.y >= h.top &&
      point.y <= h.top + h.height,
  );
// Visitors turn in at the north-west corner, under the gate (ZOO_GATE), and follow the side path
// to the central promenade. Tube riders from Willow Halt join this path without passing the gate.
export const ZOO_GATE = { x: ZOO_GROUND.left + 0.4, y: ZOO_GROUND.top };
export function zooRoute(spot: Point): Point[] {
  return [
    ZOO_ENTRANCE,
    { x: ZOO_GATE.x, y: ZOO_ENTRANCE.y },
    { x: ZOO_GATE.x, y: ZOO_CENTER.y },
    spot,
  ];
}
export type ZooHabitat = (typeof ZOO_HABITATS)[number];
export type ZooProp = {
  kind: ZooPropKind;
  left: number;
  top: number;
  width: number;
  height: number;
  solid: boolean;
};
/** What stands in a habitat, in town tiles (see zoo-layout.ts). Empty for the future habitats. */
export const zooProps = (h: ZooHabitat): ZooProp[] =>
  h.animal
    ? ZOO_LAYOUT[h.animal].map((p) => ({
        kind: p.kind,
        left: h.left + p.u,
        top: h.top + p.v,
        width: p.width,
        height: p.depth,
        solid: p.solid,
      }))
    : [];
const propOf = (h: ZooHabitat, kinds: readonly ZooPropKind[]) =>
  zooProps(h).find((p) => kinds.includes(p.kind));
export const zooPond = (h: ZooHabitat) => {
  // A future habitat has no water yet; it reports where a small pond would go.
  const pond = propOf(h, ['pool', 'pond']) ?? {
    left: h.left + 4.5,
    top: h.top + 3.7,
    width: 1.2,
    height: 0.8,
  };
  return { left: pond.left, top: pond.top, width: pond.width, height: pond.height };
};
export const zooTree = (h: ZooHabitat) => {
  // The penguins have no tree; their spot stays at the back corner like the others'.
  const tree = propOf(h, ['acacia', 'tree']) ?? { left: h.left + 0.5, top: h.top + 0.6 };
  return { x: tree.left + 0.3, y: tree.top + 0.3 };
};
export const ZOO_SLEEP = { start: 120, end: 240, transition: 8, walk: 12 } as const;
// The herds walk to their beds before lying down and back to their patches after getting up, so
// the night runs (in minutes of the day) from the start of the one walk to the end of the other.
const BEDTIME = {
  from: ZOO_SLEEP.start - ZOO_SLEEP.transition - ZOO_SLEEP.walk,
  until: ZOO_SLEEP.end + ZOO_SLEEP.transition + ZOO_SLEEP.walk,
} as const;
const BED_EDGES = [BEDTIME.from, BEDTIME.until] as const;
// An antic walk with a long way to go may set off up to LEAD minutes before the antic starts, and
// get home as long after it ends; the idle beats either side are held so nothing else moves them.
const LEAD = 12,
  HOLD_BEFORE = LEAD + 1,
  HOLD_AFTER = LEAD + 1.5;
const minuteOfDay = (time: number) => ((time % 1440) + 1440) % 1440;
// One town minute is one real second. One actor per habitat; the others keep wandering.
export const ZOO_QUIRKS = {
  elephant: { interval: 137, offset: 19, duration: 30, label: 'The elephant shower' },
  penguin: { interval: 113, offset: 61, duration: 30, label: 'Penguin splash landing' },
  zebra: { interval: 157, offset: 97, duration: 30, label: 'A case of the zoomies' },
  giraffe: { interval: 173, offset: 139, duration: 30, label: 'The very stretchy snack' },
} as const;
const QUIRK_SEEDS: Record<ZooAnimal, number> = {
  elephant: hash('zoo:elephant'),
  penguin: hash('zoo:penguin'),
  zebra: hash('zoo:zebra'),
  giraffe: hash('zoo:giraffe'),
};
// Antic number `cycle` of a species: when it starts, who performs it, and whether it runs at all.
function anticOf(species: ZooAnimal, cycle: number) {
  const config = ZOO_QUIRKS[species],
    count = species === 'penguin' ? 5 : 3;
  const start = cycle * config.interval - config.offset;
  // Skip the entire antic, and the walks around it, if it would interrupt the walk to bed, sleep,
  // or the walk back.
  const startMinute = minuteOfDay(start);
  return {
    start,
    actor: (((cycle + QUIRK_SEEDS[species]) % count) + count) % count,
    active: !(
      startMinute - HOLD_BEFORE < BEDTIME.until &&
      startMinute + config.duration + HOLD_AFTER > BEDTIME.from
    ),
  };
}
export function zooMomentAt(species: ZooAnimal, minutes: number, day = 0) {
  const config = ZOO_QUIRKS[species];
  const absolute = day * 1440 + minutes;
  const antic = anticOf(species, Math.floor((absolute + config.offset) / config.interval));
  const elapsed = absolute - antic.start;
  return {
    ...config,
    start: antic.start,
    elapsed,
    actor: antic.actor,
    active: antic.active && elapsed < config.duration,
  };
}
export type ZooAction =
  | 'approach'
  | 'drink'
  | 'raise-trunk'
  | 'spray'
  | 'lower-trunk'
  | 'crouch'
  | 'dive'
  | 'splash'
  | 'swim'
  | 'hop-out'
  | 'run'
  | 'skid'
  | 'stretch'
  | 'nibble'
  | 'return';
export type ZooAnimalState = {
  id: string;
  species: ZooAnimal;
  position: Point;
  facing: number;
  /** Leg phase, -1…1; the legs only swing while `moving`. */
  step: number;
  lift: number;
  tilt: number;
  stretch: number;
  submerged: number;
  sleeping: boolean;
  rest: number;
  sleepPhase: number;
  /** Walking rather than standing still. */
  moving: boolean;
  /** 0 head up … 1 head down to graze, drink or sniff the ground. */
  graze: number;
  /** -1 … 1: head turned away from (-1) or toward (+1) the viewer; 0 straight ahead. */
  look: number;
  /** 0 … 1: an ear flap (elephants) or ear flick (the others). */
  ear: number;
  /** -1 … 1: tail swish. */
  tail: number;
  /** Eyes shut for a blink. */
  blink: boolean;
  /** 0 upright … 1 lying flat to swim (penguins in the pool). */
  swim: number;
  action?: { phase: ZooAction; elapsed: number; progress: number };
};
const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const between = (from: Point, to: Point, progress: number): Point => ({
  x: from.x + (to.x - from.x) * progress,
  y: from.y + (to.y - from.y) * progress,
});
// Every animal keeps to its own patch of the habitat: a box clear of the solid props and far enough
// from the other patches that two animals can never touch. Life comes in beats of 12–40 s: walk to
// a new spot in the patch at a natural pace, then graze, look around or just stand. The beats that
// hold an antic's start or end, or the edge of the night, are spent standing, so nothing sets off
// mid-stride. The antic actor walks from where it stands, through a door on its patch's edge, along
// a route that keeps clear of everyone else's patch; the zebras have no corner the zoomies cannot
// reach, so the other two step off the loop and watch. Beds are placed so that the walk to bed from
// anywhere in the patch keeps the same spacing. Everything is a pure function of time, seeded per
// animal.
type Patch = readonly [left: number, right: number, top: number, bottom: number];
type HerdPlan = {
  /** How close two animals' feet may come, in tiles. */
  gap: number;
  patches: readonly Patch[];
  beds: readonly (readonly [number, number])[];
  /** Zebras: where each stands to watch when another has the zoomies. */
  watch?: readonly (readonly [number, number])[];
  /** Idle walking pace, tiles per minute (one town minute is one real second). */
  pace: readonly [number, number];
  /** Minutes per full leg cycle at that pace. */
  stride: number;
  /** Share of idle beats spent grazing, and looking around. */
  graze: number;
  look: number;
};
// In habitat tiles (as zoo-layout.ts), searched offline against the layout: patches keep their gap
// from each other, from the antic anchors and from the actor's routes; beds keep it on the way in.
const HERD_PLANS: Record<ZooAnimal, HerdPlan> = {
  giraffe: {
    gap: 0.95,
    patches: [
      [3.7, 4.55, 0.45, 1.3],
      [0.45, 1.35, 1.9, 3.75],
      [2.55, 4.15, 3.0, 4.9],
    ],
    // Along the back fence: either side of the acacia's trunk, under its crown, and one toward
    // the feeder, so no sleeping neck crosses the trunk or a neighbour.
    beds: [
      [4.3, 0.5],
      [1.1, 0.5],
      [2.6, 0.45],
    ],
    pace: [0.24, 0.32],
    stride: 1.35,
    graze: 0.35,
    look: 0.35,
  },
  elephant: {
    gap: 1.25,
    // The back meadow, the strip between the house and the pond, and the front corner by the
    // promenade, left of the name board so it never hides the legs.
    patches: [
      [1.5, 3.0, 0.45, 1.9],
      [4.55, 5.9, 1.9, 2.5],
      [0.45, 1.6, 4.3, 5.0],
    ],
    // Two by the house, one between the house and the tree.
    beds: [
      [1.9, 1.5],
      [5.5, 1.85],
      [3.5, 2.0],
    ],
    pace: [0.2, 0.27],
    stride: 1.4,
    graze: 0.5,
    look: 0.25,
  },
  zebra: {
    gap: 0.95,
    patches: [
      [0.45, 2.3, 1.55, 3.15],
      [2.05, 4.15, 4.15, 4.9],
      [3.9, 5.7, 1.55, 3.15],
    ],
    // Each watches the zoomies from just off the loop beside its own patch: left, front, right.
    watch: [
      [0.32, 2.5],
      [3.1, 5.12],
      [5.9, 2.3],
    ],
    // In the lee of the shade, where the roof does not hide them.
    beds: [
      [1.4, 2.85],
      [1.85, 4.9],
      [2.05, 3.95],
    ],
    pace: [0.26, 0.34],
    stride: 1.05,
    graze: 0.55,
    look: 0.3,
  },
  penguin: {
    gap: 0.5,
    // Four stretches of the front beach and the bank beside the ledge.
    patches: [
      [0.3, 1.25, 3.55, 5.1],
      [1.8, 2.75, 3.55, 5.1],
      [3.3, 4.25, 3.55, 5.1],
      [4.8, 5.9, 3.55, 5.1],
      [5.25, 5.85, 1.45, 2.95],
    ],
    // A huddle on the beach.
    beds: [
      [3.9, 4.25],
      [4.4, 4.4],
      [4.95, 4.5],
      [5.5, 4.5],
      [4.75, 4.0],
    ],
    pace: [0.22, 0.28],
    stride: 0.6,
    graze: 0.25,
    look: 0.35,
  },
};
const ZOOMIES = { rx: 1.8, ry: 1.45, laps: 2 } as const;
type Box = { left: number; right: number; top: number; bottom: number };
type Route = { points: Point[]; length: number };
type Herd = {
  species: ZooAnimal;
  plan: HerdPlan;
  ids: string[];
  seeds: number[];
  offsets: number[];
  homes: Box[];
  /** Door to antic anchor (for zebras: to where the runner joins the loop). */
  routes: Route[];
  beds: Point[];
  bedFacing: number[];
  /** Giraffes browse at the feeder from the nearest edge of a patch that reaches it. */
  browse: (Point | null)[];
  browseFacing: number[];
  /** Look this way to see the promenade: +1 toward the viewer (row 0), -1 away (row 1). */
  toward: number;
  center: Point;
  /** Penguins: where the diver lands in the pool, and where it climbs out. */
  landing: Point;
  kerb: Point;
  /** Zebras: where each runner joins the loop (as an angle and as arc length), and each watcher's walk per runner. */
  starts: number[];
  startArcs: number[];
  watch: Route[][];
  /** The night's walk to or from bed, worked out once per walk (keyed by when it starts or ends). */
  night: { key: number; spots: Point[]; facings: number[]; duration: number };
};
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const facingOf = (dx: number, dy: number) => (dx - dy >= 0 ? 1 : -1);
const boxArea = (b: Box) => Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
const route = (points: Point[]): Route => ({
  points,
  length: points.reduce(
    (sum, p, i) => (i ? sum + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) : 0),
    0,
  ),
});
// If a prop is ever moved into a patch, the patch gives way on the side that keeps the most room.
function clearOfProps(box: Box, props: ZooProp[], margin: number): Box {
  let b = box;
  for (const p of props) {
    if (!p.solid) continue;
    const left = p.left - margin,
      right = p.left + p.width + margin,
      top = p.top - margin,
      bottom = p.top + p.height + margin;
    if (left >= b.right || right <= b.left || top >= b.bottom || bottom <= b.top) continue;
    b = [
      { ...b, right: Math.min(b.right, left) },
      { ...b, left: Math.max(b.left, right) },
      { ...b, bottom: Math.min(b.bottom, top) },
      { ...b, top: Math.max(b.top, bottom) },
    ].reduce((best, option) => (boxArea(option) > boxArea(best) ? option : best));
  }
  return b;
}
const nearestIn = (b: Box, p: Point): Point => ({
  x: clamp(p.x, b.left, b.right),
  y: clamp(p.y, b.top, b.bottom),
});
const loopAt = (center: Point, angle: number): Point => ({
  x: center.x + Math.cos(angle) * ZOOMIES.rx,
  y: center.y + Math.sin(angle) * ZOOMIES.ry,
});
// Arc length round the loop, tabulated once, so the runner keeps a steady speed on the bends.
const LOOP_STEPS = 120;
const LOOP_ARC = [0];
for (let n = 1; n <= LOOP_STEPS; n++) {
  const a = ((n - 1) / LOOP_STEPS) * Math.PI * 2,
    b = (n / LOOP_STEPS) * Math.PI * 2;
  LOOP_ARC.push(
    LOOP_ARC[n - 1] +
      Math.hypot(
        ZOOMIES.rx * (Math.cos(b) - Math.cos(a)),
        ZOOMIES.ry * (Math.sin(b) - Math.sin(a)),
      ),
  );
}
const LOOP_LENGTH = LOOP_ARC[LOOP_STEPS];
function arcOf(angle: number) {
  const turns = angle / (Math.PI * 2),
    whole = Math.floor(turns),
    f = (turns - whole) * LOOP_STEPS,
    n = Math.min(LOOP_STEPS - 1, Math.floor(f));
  return whole * LOOP_LENGTH + LOOP_ARC[n] + (LOOP_ARC[n + 1] - LOOP_ARC[n]) * (f - n);
}
function angleOf(arc: number) {
  const whole = Math.floor(arc / LOOP_LENGTH),
    rest = arc - whole * LOOP_LENGTH;
  let low = 0,
    high = LOOP_STEPS;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (LOOP_ARC[middle] <= rest) low = middle;
    else high = middle;
  }
  const f = low + (rest - LOOP_ARC[low]) / (LOOP_ARC[low + 1] - LOOP_ARC[low]);
  return (whole + f / LOOP_STEPS) * Math.PI * 2;
}
// The zoomies: a second to reach a full gallop, two laps at a steady speed, then a short skid that
// ends back where the run began.
const RUN = { from: 8, ramp: 1, until: 20, brake: 0.6 } as const;
const RUN_SPEED =
  (ZOOMIES.laps * LOOP_LENGTH) / (RUN.until - RUN.from - RUN.ramp / 2 + RUN.brake / 2);
const runSpeed = (t: number) => {
  const time = t - RUN.from;
  if (time <= 0) return 0;
  if (time < RUN.ramp) return (RUN_SPEED * time) / RUN.ramp;
  return RUN_SPEED * clamp(1 - (time - (RUN.until - RUN.from)) / RUN.brake, 0, 1);
};
function runDistance(t: number) {
  const time = t - RUN.from,
    run = RUN.until - RUN.from;
  if (time <= 0) return 0;
  if (time < RUN.ramp) return (RUN_SPEED * time * time) / (2 * RUN.ramp);
  if (time < run) return RUN_SPEED * (time - RUN.ramp / 2);
  const brake = Math.min(time - run, RUN.brake);
  return RUN_SPEED * (run - RUN.ramp / 2 + brake - (brake * brake) / (2 * RUN.brake));
}
// Tiles per gallop stride: a whole number of half strides by the end of the run, so the legs come
// together as the skid begins.
const GALLOP = (() => {
  const run = runDistance(RUN.until);
  return (2 * run) / Math.max(1, Math.round(run / 0.35));
})();
function anticAnchor(h: ZooHabitat): Point {
  const pond = zooPond(h),
    tree = zooTree(h);
  if (h.animal === 'elephant') return { x: pond.left - 0.45, y: pond.top + 0.3 };
  if (h.animal === 'penguin') return { x: pond.left + pond.width + 0.2, y: pond.top + 1.5 };
  return { x: tree.x + 0.5, y: tree.y + 0.5 };
}
function herdFor(h: ZooHabitat, row: number): Herd {
  const species = h.animal!,
    plan = HERD_PLANS[species],
    props = zooProps(h);
  const local = (u: number, v: number): Point => ({ x: h.left + u, y: h.top + v });
  const center = local(h.width / 2, h.height / 2);
  const homes = plan.patches.map(([u0, u1, v0, v1]) =>
    clearOfProps(
      { left: h.left + u0, right: h.left + u1, top: h.top + v0, bottom: h.top + v1 },
      props,
      species === 'elephant' ? 0.4 : 0.3,
    ),
  );
  const anchor = anticAnchor(h),
    pool = zooPond(h);
  // Penguins on the front beach walk to their diving rock along the pool's near edge.
  const edge = pool.top + pool.height + 0.12;
  const doors = homes.map((b) =>
    species === 'penguin' && b.top > edge
      ? { x: clamp(anchor.x, b.left + 0.1, b.right - 0.1), y: b.top }
      : nearestIn(b, species === 'zebra' ? center : anchor),
  );
  const starts = doors.map((d) =>
    Math.atan2((d.y - center.y) / ZOOMIES.ry, (d.x - center.x) / ZOOMIES.rx),
  );
  const routes = doors.map((door, i) => {
    if (species === 'zebra') return route([door, loopAt(center, starts[i])]);
    if (species === 'penguin' && homes[i].top > edge) {
      const along = Math.abs(door.x - anchor.x) > 0.3 ? [{ x: door.x, y: edge }] : [];
      return route([door, ...along, { x: anchor.x, y: edge }, anchor]);
    }
    return route([door, anchor]);
  });
  // The two zebras not running step off the loop to a spot beside their own patch, so their walks
  // there and back never cross the runner's or each other's.
  const watch = doors.map((_, runner) =>
    (plan.watch ?? []).map(([u, v], i) => route([i === runner ? doors[i] : local(u, v)])),
  );
  const beds = plan.beds.map(([u, v]) => local(u, v));
  const feeder = props.find((p) => p.kind === 'feeder');
  const browse = homes.map((b) => {
    if (!feeder) return null;
    const middle = { x: feeder.left + feeder.width / 2, y: feeder.top + feeder.height / 2 };
    const spot = nearestIn(b, middle);
    const reach = Math.hypot(
      Math.max(0, feeder.left - spot.x, spot.x - feeder.left - feeder.width),
      Math.max(0, feeder.top - spot.y, spot.y - feeder.top - feeder.height),
    );
    return reach < 0.6 ? spot : null;
  });
  return {
    species,
    plan,
    ids: homes.map((_, i) => `${species}-${i}`),
    seeds: homes.map((_, i) => hash(`zoo:${species}:${i}`)),
    offsets: homes.map((_, i) => (hash(`zoo:${species}:${i}:beat`) % 1000) * 0.026),
    homes,
    routes,
    beds,
    bedFacing: beds.map((b) => facingOf(center.x - b.x, center.y - b.y)),
    browse,
    browseFacing: browse.map((spot) =>
      spot && feeder
        ? facingOf(feeder.left + feeder.width / 2 - spot.x, feeder.top + feeder.height / 2 - spot.y)
        : 1,
    ),
    toward: row === 0 ? 1 : -1,
    center,
    landing: { x: pool.left + 2.7, y: pool.top + 1.15 },
    kerb: { x: pool.left + pool.width - 0.2, y: anchor.y },
    starts,
    startArcs: starts.map(arcOf),
    watch,
    night: { key: NaN, spots: [], facings: [], duration: 1 },
  };
}
const HERDS = ZOO_HABITATS.flatMap((h, index) =>
  h.animal ? [herdFor(h, Math.floor(index / 3))] : [],
);
// A cheap integer hash for per-beat choices; the per-animal seeds come from hash().
function noise(seed: number, k: number, salt: number) {
  let x = (seed + Math.imul(k | 0, 0x9e3779b1)) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15) ^ Math.imul(salt + 1, 0x85ebca6b), 0x846ca68b);
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}
// Beats average 26 minutes; each edge is nudged up to 7 either way, so beats run 12–40.
const BEAT = 26,
  BEAT_JITTER = 7;
const beatEdge = (seed: number, k: number) =>
  k * BEAT + (noise(seed, k, 1) - 0.5) * 2 * BEAT_JITTER;
// A beat spent standing where the last one ended: it holds the start or end of an antic this
// animal takes part in (it keeps grazing and looking about), or the edge of the night (it just
// stands, ready for the walk to or from bed).
const HOLD_ANTIC = 1,
  HOLD_BED = 2;
function holdIn(herd: Herd, i: number, k: number) {
  const seed = herd.seeds[i],
    shift = herd.offsets[i];
  const from = beatEdge(seed, k) - shift,
    until = beatEdge(seed, k + 1) - shift;
  for (const edge of BED_EDGES)
    if (Math.ceil((from - edge) / 1440) * 1440 + edge < until) return HOLD_BED;
  const config = ZOO_QUIRKS[herd.species];
  const first = Math.ceil((from - config.duration - HOLD_AFTER + config.offset) / config.interval);
  for (let cycle = first; cycle <= first + 1; cycle++) {
    const antic = anticOf(herd.species, cycle);
    if (!antic.active || (herd.species !== 'zebra' && antic.actor !== i)) continue;
    const end = antic.start + config.duration;
    if (
      (from <= antic.start && until > antic.start - HOLD_BEFORE) ||
      (from <= end + HOLD_AFTER && until > end)
    )
      return HOLD_ANTIC;
  }
  return 0;
}
// Giraffes browse at the feeder on about one beat in eight, never twice running.
const browsing = (herd: Herd, i: number, k: number) =>
  herd.browse[i] !== null && (k & 1) === 1 && noise(herd.seeds[i], k, 3) < 0.24;
function target(herd: Herd, i: number, k: number): Point {
  const seed = herd.seeds[i];
  // Some even beats are spent where the last walk ended.
  const beat = (k & 1) === 0 && noise(seed, k, 2) < 0.3 && !browsing(herd, i, k - 1) ? k - 1 : k;
  const browse = herd.browse[i];
  if (browse && browsing(herd, i, beat)) return browse;
  const b = herd.homes[i];
  let x = b.left + (b.right - b.left) * noise(seed, beat, 4),
    y = b.top + (b.bottom - b.top) * noise(seed, beat, 5);
  // Otherwise a giraffe that can reach the feeder mostly stands away from it.
  if (browse && Math.hypot(x - browse.x, y - browse.y) < 0.9) {
    x = b.left + (b.right - b.left) * noise(seed, beat, 9);
    y = b.top + (b.bottom - b.top) * noise(seed, beat, 10);
  }
  return { x, y };
}
// Where the animal stands at the end of beat k.
function spotAfter(herd: Herd, i: number, k: number): Point {
  for (let n = 0; n < 4 && holdIn(herd, i, k); n++) k--;
  return target(herd, i, k);
}
// Which way the animal faces at the end of beat k: the way its last walk went, or at the feeder.
function facingAfter(herd: Herd, i: number, k: number) {
  for (let n = 0; n < 5; n++, k--) {
    const to = spotAfter(herd, i, k);
    if (to === herd.browse[i]) return herd.browseFacing[i];
    const from = spotAfter(herd, i, k - 1);
    if (to.x !== from.x || to.y !== from.y) return facingOf(to.x - from.x, to.y - from.y);
  }
  return 1;
}
// Distance covered after `time` of a walk: a short speed-up, a steady pace, a short slow-down.
function glide(time: number, duration: number, distance: number) {
  const ramp = Math.min(0.5, duration / 4),
    top = distance / (duration - ramp);
  if (time < ramp) return (0.5 * top * time * time) / ramp;
  if (time > duration - ramp) return distance - (0.5 * top * (duration - time) ** 2) / ramp;
  return top * (time - ramp / 2);
}
// Leg phase from distance walked: a whole number of steps, so the legs land together on arrival.
const legs = (walked: number, distance: number, stride: number) =>
  Math.sin(
    (Math.PI * walked * Math.max(1, Math.round((2 * distance) / stride))) /
      Math.max(distance, 1e-6),
  );
// Rises over `rise` after `from`, falls over `rise` before `until`; zero outside.
const envelope = (time: number, from: number, until: number, rise: number) =>
  ease((time - from) / rise) * ease((until - time) / rise);
type Pose = {
  x: number;
  y: number;
  facing: number;
  moving: boolean;
  step: number;
  graze: number;
  look: number;
  stretch: number;
};
const pose = (): Pose => ({
  x: 0,
  y: 0,
  facing: 1,
  moving: false,
  step: 0,
  graze: 0,
  look: 0,
  stretch: 0,
});
function idleAt(herd: Herd, i: number, time: number, out: Pose) {
  const seed = herd.seeds[i],
    plan = herd.plan;
  const t = time + herd.offsets[i];
  let k = Math.floor(t / BEAT);
  if (t < beatEdge(seed, k)) k--;
  else if (t >= beatEdge(seed, k + 1)) k++;
  const begin = beatEdge(seed, k),
    length = beatEdge(seed, k + 1) - begin,
    into = t - begin;
  const hold = holdIn(herd, i, k);
  const from = spotAfter(herd, i, k - 1),
    to = hold ? from : target(herd, i, k);
  const dx = to.x - from.x,
    dy = to.y - from.y,
    distance = Math.hypot(dx, dy);
  const pace = plan.pace[0] + (plan.pace[1] - plan.pace[0]) * noise(seed, k, 6);
  const walk = distance < 1e-6 ? 0 : Math.min(distance / pace, length * 0.75);
  out.graze = 0;
  out.look = 0;
  out.stretch = 0;
  if (into < walk) {
    const walked = glide(into, walk, distance);
    out.x = from.x + (dx * walked) / distance;
    out.y = from.y + (dy * walked) / distance;
    // A short shuffle up to the feeder faces it all the way, rather than turning on arrival.
    out.facing = to === herd.browse[i] && distance < 0.6 ? herd.browseFacing[i] : facingOf(dx, dy);
    out.moving = true;
    out.step = legs(walked, distance, (plan.stride * distance) / walk);
    return;
  }
  out.x = to.x;
  out.y = to.y;
  out.moving = false;
  out.step = 0;
  out.facing = walk
    ? to === herd.browse[i]
      ? herd.browseFacing[i]
      : facingOf(dx, dy)
    : facingAfter(herd, i, k - 1);
  if (hold === HOLD_BED) return;
  const settled = walk + 0.3;
  if (to === herd.browse[i]) {
    // Reach up into the hay basket.
    out.stretch = 7 * envelope(into, settled, length, 1.5);
    return;
  }
  const choice = noise(seed, k, 7);
  if (choice < plan.graze) {
    // Head down, with a pause to chew and glance at the visitors in a long graze.
    const middle = (settled + length) / 2;
    const chew = length - settled > 12 ? envelope(into, middle - 1.6, middle + 1.6, 0.6) : 0;
    out.graze = envelope(into, settled, length - 0.3, 1.2) * (1 - 0.85 * chew);
    out.look = chew * herd.toward * 0.7;
  } else if (choice < plan.graze + plan.look) {
    // A long look one way (usually at the promenade), then a shorter one back.
    const first = noise(seed, k, 8) < 0.6 ? herd.toward : -herd.toward;
    const glance = Math.min(6, (length - settled) / 2 - 0.6);
    out.look =
      first * envelope(into, settled + 0.3, settled + 0.3 + glance, 0.8) -
      first * 0.8 * envelope(into, settled + 0.6 + glance, length - 0.3, 0.8);
  }
}
// A short event somewhere in each `slot` minutes (with `chance`), as progress 0…1, else -1.
// `spread` narrows where in the slot it may fall, which evens out the gaps between events.
function pulse(
  seed: number,
  salt: number,
  time: number,
  slot: number,
  length: number,
  chance: number,
  spread = 1,
) {
  const k = Math.floor(time / slot);
  if (noise(seed, k, salt) >= chance) return -1;
  const at = k * slot + (slot - length) * (0.5 + (noise(seed, k, salt + 1) - 0.5) * spread);
  const q = (time - at) / length;
  return q >= 0 && q < 1 ? q : -1;
}
// Tail, ears (flippers for penguins) and blinks never stop, whatever else is going on.
function smallLife(herd: Herd, i: number, time: number, state: ZooAnimalState) {
  const seed = herd.seeds[i];
  const sway = Math.sin((time * Math.PI * 2) / (3.2 + (seed % 7) * 0.3) + (seed % 628) / 100);
  const flick = pulse(seed, 20, time, 8, 0.9, 0.6);
  state.tail = clamp(sway * 0.3 + (flick < 0 ? 0 : Math.sin(flick * Math.PI * 2) * 0.7), -1, 1);
  if (herd.species === 'elephant') {
    const flap = pulse(seed, 22, time, 10.5, 1.8, 0.9, 0.8);
    const twice = noise(seed, Math.floor(time / 10.5), 24) < 0.35 ? 2 : 1;
    state.ear = flap < 0 ? 0 : 0.5 - 0.5 * Math.cos(flap * Math.PI * 2 * twice);
  } else if (herd.species === 'penguin') {
    const flap = pulse(seed, 22, time, 9, 1.1, 0.45);
    state.ear = flap < 0 ? 0 : Math.abs(Math.sin(flap * Math.PI * 3));
  } else {
    const flick = pulse(seed, 22, time, 7, 0.35, 0.7);
    state.ear = flick < 0 ? 0 : Math.sin(flick * Math.PI);
  }
  // A 0.15 s blink every 3–7 s.
  const k = Math.floor(time / 5),
    at = k * 5 + 1.5 + noise(seed, k, 26) * 2;
  state.blink = time >= at && time < at + 0.15;
}
// One steady walk along `path` (or back along it when `back`), `time` minutes after setting off,
// at `pace` tiles per minute. Before and after the walk the animal stands at the path's ends.
function walkPath(
  herd: Herd,
  path: readonly Point[],
  pace: number,
  time: number,
  back: boolean,
  state: ZooAnimalState,
) {
  let length = 0;
  for (let n = 1; n < path.length; n++)
    length += Math.hypot(path[n].x - path[n - 1].x, path[n].y - path[n - 1].y);
  const duration = length / pace,
    walked = length < 1e-6 ? 0 : glide(clamp(time, 0, duration), duration, length);
  let along = back ? length - walked : walked;
  state.position = { ...path[0] };
  let dx = 0,
    dy = 0;
  for (let n = 1; n < path.length; n++) {
    const a = path[n - 1],
      b = path[n],
      piece = Math.hypot(b.x - a.x, b.y - a.y);
    if (piece < 1e-6 && n < path.length - 1) continue;
    [dx, dy] = back ? [a.x - b.x, a.y - b.y] : [b.x - a.x, b.y - a.y];
    if (along <= piece || n === path.length - 1) {
      state.position = between(a, b, piece ? Math.min(1, along / piece) : 1);
      break;
    }
    along -= piece;
  }
  state.moving = length > 0.02 && time > 0 && time < duration;
  state.step = state.moving ? legs(walked, length, herd.plan.stride * pace) : 0;
  if (state.moving) state.facing = facingOf(dx, dy);
  return duration;
}
// An antic's walks go at no less than the herd's brisk idle pace, and take TRAVEL minutes unless
// the way is long (then they start early and finish late, see LEAD).
const TRAVEL = 7.2;
const setOff = pose(),
  comeBack = pose();
type Antic = { start: number; actor: number; t: number; duration: number };
// The antic this animal takes part in at `time`, if any, with the time since it started.
function anticNow(herd: Herd, i: number, time: number): Antic | null {
  const config = ZOO_QUIRKS[herd.species];
  const cycle = Math.floor((time + config.offset) / config.interval);
  for (let c = cycle; c <= cycle + 1; c++) {
    const antic = anticOf(herd.species, c);
    const t = time - antic.start;
    if (!antic.active || t < -HOLD_BEFORE || t >= config.duration + HOLD_AFTER) continue;
    if (herd.species !== 'zebra' && antic.actor !== i) continue;
    return { start: antic.start, actor: antic.actor, t, duration: config.duration };
  }
  return null;
}
// The walk out (from where the animal stands, through its door, along its route) arrives at 8
// minutes; the walk back leaves at 22 and ends where idle life picks up again. Head poses fade
// before it sets off and come back once it is home. False while the antic itself is on.
function anticWalk(herd: Herd, i: number, antic: Antic, way: Route, state: ZooAnimalState) {
  const t = antic.t,
    back = t >= 22;
  if (t >= 8 && !back) return false;
  const idle = back ? comeBack : setOff;
  idleAt(herd, i, back ? antic.start + antic.duration : antic.start, idle);
  const home = { x: idle.x, y: idle.y };
  const length = way.length + Math.hypot(way.points[0].x - home.x, way.points[0].y - home.y);
  const pace = Math.max(herd.plan.pace[1], length / (TRAVEL + LEAD));
  const duration = length / pace,
    leave = 8 - duration;
  // Before the antic the held idle beat keeps the animal at home; once it starts, keep it there.
  const pose = back ? (t < antic.duration ? idle : state) : t < 0 ? state : idle;
  const keep = back ? ease((t - 22 - duration) / 1.2) : 1 - ease((t - leave + 1.2) / 1.2);
  state.graze = pose.graze * keep;
  state.look = pose.look * keep;
  state.stretch = pose.stretch * keep;
  if (!back && t < leave) {
    if (t < 0) return true;
    state.position = home;
    state.facing = idle.facing;
    state.moving = false;
    state.step = 0;
    return true;
  }
  walkPath(herd, [home, ...way.points], pace, back ? t - 22 : t - leave, back, state);
  if (back && t - 22 >= duration) state.facing = idle.facing;
  return true;
}
const runAngle = (herd: Herd, runner: number, elapsed: number) =>
  angleOf(herd.startArcs[runner] + runDistance(elapsed));
function watchZoomies(herd: Herd, i: number, moment: Antic, state: ZooAnimalState) {
  const t = moment.t,
    way = herd.watch[moment.actor][i];
  if (anticWalk(herd, i, moment, way, state)) return;
  // Stand off the loop and turn to follow the runner round.
  const spot = way.points[way.points.length - 1];
  const runner = loopAt(herd.center, runAngle(herd, moment.actor, t));
  state.position = { ...spot };
  state.moving = false;
  state.step = 0;
  state.graze = 0;
  state.stretch = 0;
  state.facing = facingOf(runner.x - spot.x, runner.y - spot.y);
  state.look = clamp((runner.x + runner.y - spot.x - spot.y) * 0.9, -1, 1) * envelope(t, 8, 22, 1);
}
function perform(herd: Herd, i: number, moment: Antic, state: ZooAnimalState) {
  const t = moment.t,
    species = herd.species,
    way = herd.routes[i];
  const anchor = way.points[way.points.length - 1];
  const action = (phase: ZooAction, from: number, until: number) => {
    state.action = { phase, elapsed: t - from, progress: (t - from) / (until - from) };
  };
  if (anticWalk(herd, i, moment, way, state)) {
    // Walks that spill outside the antic look like any other walk.
    if (t >= 0 && t < 8) action('approach', 0, 8);
    else if (t >= 22 && t < moment.duration) action('return', 22, 30);
    return;
  }
  state.position = { ...anchor };
  state.facing = 1;
  state.step = 0;
  state.moving = false;
  state.graze = 0;
  state.look = 0;
  state.stretch = 0;
  if (species === 'elephant') {
    if (t < 12) action('drink', 8, 12);
    else if (t < 15) action('raise-trunk', 12, 15);
    else if (t < 20) action('spray', 15, 20);
    else action('lower-trunk', 20, 22);
    // Ears flap happily under the shower.
    state.ear = Math.max(state.ear, Math.abs(Math.sin((t - 15) * 3)) * envelope(t, 15, 20, 0.6));
  } else if (species === 'penguin') {
    const landing = herd.landing,
      kerb = herd.kerb;
    state.facing = -1;
    if (t < 10) {
      action('crouch', 8, 10);
      state.stretch = -4 * Math.sin(((t - 8) / 2) * Math.PI);
    } else if (t < 12) {
      const q = (t - 10) / 2;
      action('dive', 10, 12);
      state.position = between(anchor, landing, ease(q));
      state.lift = Math.sin(q * Math.PI) * 42;
      state.tilt = Math.sin(q * Math.PI) * 0.9;
      // Flattens out as it meets the water.
      state.swim = ease((q - 0.55) / 0.45);
    } else if (t < 14) {
      action('splash', 12, 14);
      state.position = { ...landing };
      state.submerged = Math.sin(((t - 12) / 2) * Math.PI) * 0.85;
      state.swim = 1;
    } else if (t < 21.3) {
      action('swim', 14, 21.3);
      state.swim = 1;
      // Paddling flippers.
      state.ear = Math.max(
        state.ear,
        Math.abs(Math.sin((t - 14) * 5)) * envelope(t, 14, 21.3, 0.5),
      );
      if (t < 20) {
        // A lap of the pool, head first all the way round.
        const q = ((t - 14) / 6) * Math.PI * 2;
        state.position = {
          x: landing.x + 0.65 * (Math.cos(q) - 1),
          y: landing.y + Math.sin(q) * 0.45,
        };
        state.submerged = 0.4 * Math.sin(q / 2);
        state.facing = facingOf(-0.65 * Math.sin(q), 0.45 * Math.cos(q));
      } else {
        // Then over to the kerb by the rock, setting off at the lap's speed and slowing to a stop.
        const q = (t - 20) / 1.3,
          lap =
            (0.45 * Math.PI * 2 * 1.3) / (6 * Math.hypot(kerb.x - landing.x, kerb.y - landing.y));
        state.position = between(landing, kerb, q * q * (3 - 2 * q) + lap * q * (1 - q) * (1 - q));
        state.facing = facingOf(kerb.x - landing.x, kerb.y - landing.y);
      }
    } else {
      // A short, high hop over the kerb, upright once it is above the stone.
      const q = (t - 21.3) / 0.7;
      action('hop-out', 21.3, 22);
      state.position = between(kerb, anchor, ease(q));
      state.lift = Math.sin(q * Math.PI) * 30;
      state.facing = facingOf(anchor.x - kerb.x, anchor.y - kerb.y);
      state.swim = 1 - ease(q / 0.55);
    }
  } else if (species === 'zebra') {
    const angle = runAngle(herd, i, t),
      speed = runSpeed(t);
    state.position = loopAt(herd.center, angle);
    state.facing = facingOf(-ZOOMIES.rx * Math.sin(angle), ZOOMIES.ry * Math.cos(angle));
    state.moving = speed > 0;
    if (t < RUN.until) {
      // Legs and bounce both follow the ground covered.
      const stride = (Math.PI * 2 * runDistance(t)) / GALLOP;
      action('run', 8, 20);
      state.step = Math.sin(stride);
      state.lift = Math.abs(Math.sin(stride)) * 4 * (speed / RUN_SPEED);
    } else {
      // Legs braced, sliding to a stop and leaning back, then straightening up.
      action('skid', 20, 22);
      state.tilt = -0.14 * ease((t - 20) / 0.4) * (1 - ease((t - 20.9) / 1.1));
    }
  } else {
    if (t < 12) {
      action('stretch', 8, 12);
      state.stretch = ease((t - 8) / 4) * 23;
    } else if (t < 18) {
      action('nibble', 12, 18);
      state.stretch = 23 + Math.sin((t - 12) * Math.PI) * 2;
    } else {
      action('stretch', 18, 22);
      state.stretch = (1 - ease((t - 18) / 4)) * 23;
    }
  }
}
// Night: the herd walks to bed together, lies down there, sleeps, gets up and walks back to the
// patches. Everyone covers the same share of their walk at every moment (the beds are placed for
// that), at the pace the longest walk needs; worked out once per walk for the whole herd.
const beforeBed = pose();
function nightWalk(herd: Herd, key: number) {
  const walk = herd.night;
  if (walk.key === key) return walk;
  let longest = 0;
  for (let i = 0; i < herd.ids.length; i++) {
    idleAt(herd, i, key, beforeBed);
    walk.spots[i] = { x: beforeBed.x, y: beforeBed.y };
    walk.facings[i] = beforeBed.facing;
    longest = Math.max(
      longest,
      Math.hypot(herd.beds[i].x - beforeBed.x, herd.beds[i].y - beforeBed.y),
    );
  }
  walk.key = key;
  walk.duration = clamp(longest / herd.plan.pace[1], 2, ZOO_SLEEP.walk - 0.5);
  return walk;
}
function bedtime(herd: Herd, i: number, time: number, minute: number, state: ZooAnimalState) {
  const bed = herd.beds[i],
    rest = state.rest,
    awake = 1 - rest;
  state.graze = 0;
  state.look = 0;
  state.stretch = 0;
  state.ear *= awake;
  state.tail *= awake;
  if (rest > 0) state.blink = false;
  const lieDown = ZOO_SLEEP.start - ZOO_SLEEP.transition,
    getUp = ZOO_SLEEP.end + ZOO_SLEEP.transition;
  if (minute < lieDown || minute >= getUp) {
    const going = minute < lieDown;
    const walk = nightWalk(herd, time - minute + (going ? BEDTIME.from : BEDTIME.until));
    const spot = walk.spots[i];
    const length = Math.hypot(bed.x - spot.x, bed.y - spot.y);
    const into = going ? minute - BEDTIME.from : minute - getUp;
    state.facing = walk.facings[i];
    walkPath(herd, [spot, bed], Math.max(length / walk.duration, 1e-6), into, !going, state);
    if (going ? into >= walk.duration : into <= 0) state.facing = herd.bedFacing[i];
    return;
  }
  state.position = { ...bed };
  state.facing = herd.bedFacing[i];
  state.moving = false;
  state.step = 0;
}
const current = pose();
function animalAt(herd: Herd, i: number, time: number): ZooAnimalState {
  const minute = minuteOfDay(time);
  const rest =
    ease((minute - ZOO_SLEEP.start + ZOO_SLEEP.transition) / ZOO_SLEEP.transition) *
    (1 - ease((minute - ZOO_SLEEP.end) / ZOO_SLEEP.transition));
  const night = minute >= BEDTIME.from && minute < BEDTIME.until;
  if (!night) idleAt(herd, i, time, current);
  const state: ZooAnimalState = {
    id: herd.ids[i],
    species: herd.species,
    position: { x: current.x, y: current.y },
    facing: current.facing,
    step: current.step,
    lift: 0,
    tilt: 0,
    stretch: current.stretch,
    submerged: 0,
    sleeping: minute >= ZOO_SLEEP.start && minute < ZOO_SLEEP.end,
    rest,
    sleepPhase: time * 0.9 + i * 1.7,
    moving: current.moving,
    graze: current.graze,
    look: current.look,
    ear: 0,
    tail: 0,
    blink: false,
    swim: 0,
  };
  smallLife(herd, i, time, state);
  const antic = night ? null : anticNow(herd, i, time);
  if (night) bedtime(herd, i, time, minute, state);
  else if (antic?.actor === i) perform(herd, i, antic, state);
  else if (antic) watchZoomies(herd, i, antic, state);
  return state;
}
export function zooAnimalsAt(minutes: number, day = 0): ZooAnimalState[] {
  const time = day * 1440 + minutes,
    animals: ZooAnimalState[] = [];
  for (const herd of HERDS)
    for (let i = 0; i < herd.ids.length; i++) animals.push(animalAt(herd, i, time));
  return animals;
}
