// The Harvest Fair and the Long Table (agent D, SPEC §4.3): the trodden-stubble patch over bed 1
// (ground, keyed by groundDay), the props of HARVEST_PROPS, the table, the dishes, the four table
// lamps and the fiddler; and the scarecrow's ribboned hat. Render cap: 1,200 calls (SPEC §6.6).
// No Math.random, Date.now or performance.now: everything runs on the town clock.
import type { DistrictPainter } from '../district-art';

type Ctx = CanvasRenderingContext2D;

/** Foundation stub: nothing drawn yet; the farm's west end looks as it does today. */
export const harvestPainter: DistrictPainter = {
  objects: () => [],
};

/**
 * The scarecrow's festival dress, drawn by farm.ts's scarecrow at its feet (x, y), world px.
 * Foundation stub: draws nothing.
 */
export const drawScarecrowExtras: (
  ctx: Ctx,
  x: number,
  y: number,
  day: number,
  night: boolean,
) => void = () => {};
