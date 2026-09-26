// Small helpers for isometric props. Each face is painted flat in its own sheared frame (`face`
// for upright ones, `plane` for level ones), so most details are single fillRects; the budget
// tests count every canvas call.
import { project, TILE_W, type Point } from '../lib/world';

type Ctx = CanvasRenderingContext2D;
/** Screen pixels per town unit along a face. */
export const PX = TILE_W / 2;
export const TAU = Math.PI * 2;

export const lift = (p: Point, rise: number): Point => ({ x: p.x, y: p.y - rise });
/** A town point `rise` pixels above the lawn, on screen. */
export const at = (x: number, y: number, rise = 0) => lift(project(x, y), rise);
export const frac = (value: number) => value - Math.floor(value);

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
export function disc(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
/**
 * Paint an upright face flat: u runs along the face in screen pixels, v is height (negative up).
 * An 'x' face runs down-right with the town's x axis, from its left end; a 'y' face runs up-right,
 * from its front corner.
 */
export function face(ctx: Ctx, origin: Point, along: 'x' | 'y', paint: () => void) {
  ctx.save();
  ctx.transform(1, along === 'x' ? 0.5 : -0.5, 0, 1, origin.x, origin.y);
  paint();
  ctx.restore();
}
/** Paint a level surface `rise` pixels up, from its far corner: u runs along x, w along y. */
export function plane(ctx: Ctx, x: number, y: number, rise: number, paint: () => void) {
  const origin = at(x, y, rise);
  ctx.save();
  ctx.transform(1, 0.5, -1, 0.5, origin.x, origin.y);
  paint();
  ctx.restore();
}
export function level(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rise: number,
  color: string,
) {
  plane(ctx, x0, y0, rise, () => rect(ctx, 0, 0, (x1 - x0) * PX, (y1 - y0) * PX, color));
}
