import { SQUARE_SITE } from './town-config.ts';
import { BLOCK_SIZE, PLOTS, project, type Point } from './world.ts';
import { townCalendarAt } from './town-calendar.ts';
import { FLASH_MOB_CUES, FLASH_MOB_START, minuteOfBeat } from './flash-mob-beat.ts';

type Facing = 'se' | 'sw' | 'ne' | 'nw';

/**
 * Fountain Square, D8–E9: four plots paved as one square around a fountain, east of the cinema
 * across road x = 29. Its paving runs over tiles x 30–36 and y 14–20; the roads round it stay.
 */
export const SQUARE_VENUE = {
  id: 'square',
  plot: 'D8',
  name: 'Fountain Square',
  kind: 'square',
} as const;
export const SQUARE_PLOTS = PLOTS.filter(
  (plot) =>
    plot.row >= SQUARE_SITE.row &&
    plot.row < SQUARE_SITE.row + SQUARE_SITE.rows &&
    plot.col >= SQUARE_SITE.col &&
    plot.col < SQUARE_SITE.col + SQUARE_SITE.columns,
).map((plot) => plot.id);
export const isSquarePlot = (id: string) => SQUARE_PLOTS.includes(id);
export const SQUARE_GROUND = {
  left: 2 + SQUARE_SITE.col * BLOCK_SIZE,
  right: 1 + (SQUARE_SITE.col + SQUARE_SITE.columns) * BLOCK_SIZE,
  top: 2 + SQUARE_SITE.row * BLOCK_SIZE,
  bottom: 1 + (SQUARE_SITE.row + SQUARE_SITE.rows) * BLOCK_SIZE,
} as const;
export const SQUARE_CENTER = {
  x: (SQUARE_GROUND.left + SQUARE_GROUND.right) / 2,
  y: (SQUARE_GROUND.top + SQUARE_GROUND.bottom) / 2,
};
export const insideSquare = (point: Point) =>
  point.x >= SQUARE_GROUND.left &&
  point.x <= SQUARE_GROUND.right &&
  point.y >= SQUARE_GROUND.top &&
  point.y <= SQUARE_GROUND.bottom;
/** The camera's frame for the square's panel and the live view: the paving, the fountain's spray. */
export const SQUARE_FRAME = {
  center: {
    ...project(SQUARE_CENTER.x, SQUARE_CENTER.y),
    y: project(SQUARE_CENTER.x, SQUARE_CENTER.y).y - 30,
  },
  width: 560,
  height: 400,
};

// ---- What stands on the square (the art draws these; the dancers keep clear of them) ----------

/** The fountain: a round basin of `basin` tiles' radius, set back from the middle of the square. */
export const FOUNTAIN = { x: 32.8, y: 16.8, basin: 1.15 } as const;
/**
 * Two benches on the back edges, facing into the square (and the viewer): `along` is the axis the
 * seat runs on, from (x, y) for `length` tiles.
 */
export const SQUARE_BENCHES: readonly {
  x: number;
  y: number;
  along: 'x' | 'y';
  length: number;
  facing: Facing;
}[] = [
  { x: 30.45, y: 15.95, along: 'y', length: 1.5, facing: 'se' },
  { x: 33.15, y: 14.45, along: 'x', length: 1.5, facing: 'sw' },
];
/** Round planters at three corners: a tree at the back, flowers at the sides. */
export const SQUARE_PLANTERS: readonly (Point & { kind: 'tree' | 'flowers' })[] = [
  { x: 30.75, y: 14.75, kind: 'tree' },
  { x: 30.75, y: 20.25, kind: 'flowers' },
  { x: 36.25, y: 14.75, kind: 'flowers' },
];

// ---- The flash mob (a town secret: never in the events list) -------------------------------------

export const FLASH_MOB_ID = 'flash-mob';
/** Even dates of every season: Spring 2, 4 … 28, and so on, one town day in two. */
export const flashMobDay = (day: number) => townCalendarAt(Math.floor(day)).date % 2 === 0;
/** At most this many dancers, seated in the order of FLASH_MOB_SPOTS. */
export const FLASH_MOB_DANCERS = 12;
/**
 * The mob's times on the routine's clock: strollers set out after noon, dance from 17:00, walk back
 * to where they were standing by `end`, and are home by 20:00, before lantern hour (later only if
 * they stroll on into the evening). The dancers may stay out past 18:00 (their evening) for it;
 * they skip everything else that afternoon.
 */
export const FLASH_MOB_TIMES = {
  depart: 720,
  start: FLASH_MOB_START,
  end: Math.ceil(minuteOfBeat(FLASH_MOB_CUES.end)) + 3,
  homeBy: 1200,
} as const;
/** Every dancer is at their spot this many minutes before 17:00. */
export const FLASH_MOB_READY = 2;

/**
 * Where each seat dances: an arrow pointing at the viewer, its tip (seat 0, who starts) at the
 * square's front corner and the fountain behind it. Filled from the tip, so any number of dancers
 * stands in a balanced shape. Rows are 1.2 tiles apart, neighbours 1.2 tiles apart.
 */
export const FLASH_MOB_SPOTS: readonly (Point & { facing: Facing })[] = [
  { x: 36.15, y: 20.15, facing: 'se' },
  { x: 34.95, y: 20.15, facing: 'sw' },
  { x: 36.15, y: 18.95, facing: 'se' },
  { x: 34.95, y: 18.95, facing: 'se' },
  { x: 33.75, y: 20.15, facing: 'sw' },
  { x: 36.15, y: 17.75, facing: 'se' },
  { x: 33.75, y: 18.95, facing: 'sw' },
  { x: 34.95, y: 17.75, facing: 'se' },
  { x: 32.55, y: 20.15, facing: 'sw' },
  { x: 36.15, y: 16.55, facing: 'se' },
  { x: 31.35, y: 20.15, facing: 'sw' },
  { x: 36.15, y: 15.35, facing: 'se' },
];
/**
 * Where each seat lingers before it all starts and after it ends, looking like anyone else out on
 * the square: on a bench, on the fountain's rim, by a planter, watching the water. Seat 0 waits
 * on their own dance spot, turned to the fountain. `pose` is how they pass the time there.
 *
 * Each lingers on the side of the square their spot is on, so the walks into the arrow (one at a
 * time, in seat order) never pass anyone still lingering or already dancing, and the strolls back
 * (all at once) never cross: the arrow's left arm sits west and south-west of the fountain, its
 * right arm north and east of it. Seat 3, on the rim's east side, walks round the fountain.
 */
export const FLASH_MOB_LINGER: readonly (Point & {
  facing: Facing;
  pose?: 'perch' | 'tea' | 'read';
})[] = [
  { x: 36.15, y: 20.15, facing: 'nw' },
  // By the flowers at the west corner, watching the solo.
  { x: 31.3, y: 19.6, facing: 'se' },
  { x: 35.0, y: 16.4, facing: 'nw' },
  // On the fountain's rim, east and south-west.
  { x: 33.83, y: 15.77, facing: 'se', pose: 'perch' },
  { x: 32.07, y: 18.06, facing: 'sw', pose: 'perch' },
  // The north bench.
  { x: 34.35, y: 14.65, facing: 'sw', pose: 'perch' },
  // In front of the fountain, watching the water.
  { x: 34.0, y: 18.0, facing: 'nw' },
  { x: 33.45, y: 14.65, facing: 'sw', pose: 'perch' },
  // The west bench.
  { x: 30.65, y: 17.15, facing: 'se', pose: 'tea' },
  { x: 35.6, y: 15.3, facing: 'sw' },
  { x: 30.65, y: 16.25, facing: 'se', pose: 'perch' },
  // Under the tree.
  { x: 31.4, y: 15.0, facing: 'se' },
];
/**
 * Each seat's way in: the road-tile centre it turns in from (roadPath needs an exact road centre),
 * then the point it rounds on the way, if any (a bench's end), clear of the fountain and of
 * everyone else's place.
 */
const WAYS_IN: readonly { gate: Point; via?: Point }[] = [
  { gate: { x: 37.5, y: 20.5 } },
  { gate: { x: 29.5, y: 19.5 } },
  { gate: { x: 37.5, y: 16.5 } },
  // Round the north bench's east end, through seat 5's gate, so the day's headways keep the two
  // of them apart on the way in and out.
  { gate: { x: 36.5, y: 13.5 }, via: { x: 35.0, y: 15.0 } },
  { gate: { x: 32.5, y: 21.5 } },
  { gate: { x: 36.5, y: 13.5 }, via: { x: 35.0, y: 14.9 } },
  { gate: { x: 37.5, y: 18.5 } },
  { gate: { x: 32.5, y: 13.5 }, via: { x: 32.85, y: 14.95 } },
  { gate: { x: 29.5, y: 18.5 }, via: { x: 30.95, y: 17.75 } },
  { gate: { x: 37.5, y: 15.5 } },
  { gate: { x: 29.5, y: 15.5 }, via: { x: 30.85, y: 15.55 } },
  // East of the tree's planter, never over its rim.
  { gate: { x: 30.5, y: 13.5 }, via: { x: 31.5, y: 14.3 } },
];
/** A seat's way in, from its gate on the road round the square to where it lingers. */
export function squareApproach(seat: number): Point[] {
  const { gate, via } = WAYS_IN[seat],
    spot = FLASH_MOB_LINGER[seat];
  return via ? [gate, via, { x: spot.x, y: spot.y }] : [gate, { x: spot.x, y: spot.y }];
}

/** Listen only when the square is on screen and the camera is close to it (as the cinema does). */
export function squareListening(
  camera: { x: number; y: number; zoom: number },
  width: number,
  height: number,
) {
  if (width <= 0 || height <= 0) return { gain: 0, pan: 0 };
  const x = SQUARE_FRAME.center.x * camera.zoom + camera.x;
  const y = SQUARE_FRAME.center.y * camera.zoom + camera.y;
  const distance = Math.hypot((x - width / 2) / (width / 2), (y - height / 2) / (height / 2));
  return {
    gain:
      x > 0 && x < width && y > 0 && y < height
        ? Math.max(0, Math.min(1, (camera.zoom - 0.4) / 0.8)) * Math.max(0, 1 - distance * 0.45)
        : 0,
    pan: Math.max(-1, Math.min(1, (x / width - 0.5) * 1.5)),
  };
}
