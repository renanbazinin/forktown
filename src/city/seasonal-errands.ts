import { residentErrands, type ErrandKind } from '../lib/seasonal-errands';
import type { Place } from '../lib/schema';
import { project, unproject, type Point } from '../lib/world';
import { drawGroundErrandItem, errandGroundOffset } from './errand-items';

/** An item waiting to be collected, or resting where its neighbor set it down. */
export type ErrandProp = { kind: ErrandKind; point: Point; opacity: number };

export function seasonalErrandProps(places: Place[], minutes: number, day: number): ErrandProp[] {
  // Errands are daytime commitments. Nothing from yesterday is kept as mutable inventory.
  if (minutes < 360 || minutes >= 1200) return [];
  const props: ErrandProp[] = [];
  for (const trips of residentErrands(places, day).values())
    for (const trip of trips) {
      const pickup = trip.segments.find((segment) => segment.phase === 'pickup')!;
      const dropoff = trip.segments.find((segment) => segment.phase === 'dropoff')!;
      const point =
        minutes < pickup.start
          ? trip.ritual.pickup.point
          : minutes >= dropoff.end
            ? trip.ritual.delivery.point
            : undefined;
      if (point)
        props.push({
          kind: trip.ritual.kind,
          point,
          opacity: Math.min(1, (minutes - 360) / 5, (1200 - minutes) / 5),
        });
    }
  return props;
}

/** Item handoffs use the same anchor as drawResident, so neither end snaps or duplicates it. */
export function drawSeasonalErrandProps(
  ctx: CanvasRenderingContext2D,
  props: readonly ErrandProp[],
  night: boolean,
) {
  const offset = errandGroundOffset();
  const groundShift = unproject(offset.x, offset.y);
  return props.map(({ kind, point, opacity }) => ({
    depth: point.x + point.y + groundShift.x + groundShift.y,
    paint: () => {
      const at = project(point.x, point.y);
      ctx.save();
      ctx.globalAlpha *= opacity;
      drawGroundErrandItem(ctx, kind, at.x + offset.x, at.y + offset.y, night);
      ctx.restore();
    },
  }));
}
