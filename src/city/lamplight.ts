import { GROUND } from '../lib/football';
import { FORK_PLOT, lampLit } from '../lib/lanterns';
import { getPlot, isRoad, STREETLIGHTS } from '../lib/world';

const fork = getPlot(FORK_PLOT)!;

/** Streetlamps with their Manhattan distance in tiles from the Fork: the light walks outward. */
export const LAMPS = STREETLIGHTS.map(({ x, y }) => ({
  x,
  y,
  distance: Math.abs(x + 0.5 - (fork.x + 0.5)) + Math.abs(y + 0.5 - (fork.y + 0.5)),
}));
/**
 * How far in from the edges of its junction tile a lamp's pole stands, in tiles: 0.45 tiles off
 * both walking lines through the tile's centre, so a walker in the outermost lane (LANE_SHIFT,
 * 0.22 tiles to their side) still passes the pole 0.23 tiles clear. A pole on a bank corner
 * stands BANK_INSET in: 0.425 tiles off the lines, so the Millpond's west lamp still shines on
 * open water beside the mill, not behind it.
 */
export const LAMP_INSET = 0.05;
const BANK_INSET = 0.075;
/**
 * Where a lamp's pole stands: on a kerb corner of its junction tile, off the walking lines that
 * every route follows through the tile's centre. That is the west corner, left of the crossing
 * on screen, unless no road runs on east of it: then the east corner, on the bank of whatever
 * lies there, where no one walks (the Millpond's west lamp shines on the water from there). The
 * lamp's logical tile (x, y) still measures its light.
 */
export const lampFoot = ({ x, y }: { x: number; y: number }) =>
  isRoad(x + 1, y)
    ? { x: x + LAMP_INSET, y: y + 1 - LAMP_INSET }
    : { x: x + 1 - BANK_INSET, y: y + BANK_INSET };
/** Px a tall lamp's pole, head and hood stand higher than a low one's, at zoom 1. */
export const LAMP_LIFT = 8;
/**
 * How much higher than a low lamp this one stands: LAMP_LIFT, so its head (35-41 px up) hangs
 * over the hat of a neighbor passing just behind the pole instead of over their face. The lamp
 * on the road in front of the football pitch stays low (head 27-33 px up): nothing there may
 * rise more than a few px over the road's far line, or it would stand in the pitch's view.
 */
export const lampLift = ({ x, y }: { x: number; y: number }) =>
  y === GROUND.bottom && x > GROUND.left - 1 && x < GROUND.right ? 0 : LAMP_LIFT;
export const MIN_LAMP_DISTANCE = Math.min(...LAMPS.map((lamp) => lamp.distance));
export const MAX_LAMP_DISTANCE = Math.max(...LAMPS.map((lamp) => lamp.distance));

/** The wave starts at the nearest lamp at 20:20 and reaches the farthest at 20:30. */
export const lampOn = (distance: number, minutes: number) =>
  lampLit(distance - MIN_LAMP_DISTANCE, MAX_LAMP_DISTANCE - MIN_LAMP_DISTANCE, minutes);
