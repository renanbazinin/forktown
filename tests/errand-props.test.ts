import { describe, expect, it } from 'vitest';
import { drawSeasonalErrandProps, seasonalErrandProps } from '../src/city/seasonal-errands';
import { errandGroundOffset } from '../src/city/errand-items';
import { residentErrands } from '../src/lib/seasonal-errands';
import { withPreview } from '../src/lib/resident-trips';
import { HOUSE_PLOTS } from '../src/lib/events';
import type { Place } from '../src/lib/schema';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { unproject } from '../src/lib/world';
import { fullTownHouse, readPlaces } from './full-town';
import { recordingContext } from './recording-context';

const town = readPlaces();
const YEAR = CALENDAR_EPOCH_DAY + 224;
const scenesFor = (homes: Place[]) =>
  [0, 1, 2, 3].map((season) => {
    for (let n = 0; n < 28; n++) {
      const day = YEAR + season * 28 + n;
      const trip = [...residentErrands(homes, day).values()].flat()[0];
      if (trip) return { day, trip };
    }
    throw new Error(`No real errand in season ${season}`);
  });
const scenes = scenesFor(town);

describe('The same item through a seasonal handoff', () => {
  it.each(scenes)(
    'does not duplicate or lose $trip.ritual.kind at either handoff',
    ({ day, trip }) => {
      const pickup = trip.segments.find((segment) => segment.phase === 'pickup')!;
      const dropoff = trip.segments.find((segment) => segment.phase === 'dropoff')!;
      expect(seasonalErrandProps(town, pickup.start - 0.00001, day)).toEqual([
        { kind: trip.ritual.kind, point: trip.ritual.pickup.point, opacity: 1 },
      ]);
      for (const minute of [
        pickup.start,
        pickup.end,
        (pickup.end + dropoff.start) / 2,
        dropoff.end - 0.00001,
      ])
        expect(seasonalErrandProps(town, minute, day)).toEqual([]);
      expect(seasonalErrandProps(town, dropoff.end, day)).toEqual([
        { kind: trip.ritual.kind, point: trip.ritual.delivery.point, opacity: 1 },
      ]);
      expect(seasonalErrandProps(town, 1199, day)[0].opacity).toBeCloseTo(0.2);
      expect(seasonalErrandProps(town, 1200, day)).toEqual([]);
      expect(seasonalErrandProps(town, 359.9, day)).toEqual([]);
      expect(seasonalErrandProps([], 720, day)).toEqual([]);
    },
  );

  it('keeps the published prop identical in a private house preview', () => {
    // A full-town fixture has no vacancy: make one in this test's base roster only.
    const plot =
      HOUSE_PLOTS.find((plot) => !town.some((place) => place.plot === plot.id)) ?? HOUSE_PLOTS[0];
    const base = town.filter((place) => place.plot !== plot.id);
    const preview = withPreview(base, fullTownHouse(plot.id));
    for (const { day, trip } of scenesFor(base))
      for (const time of [trip.depart, trip.homeBy, 1199])
        expect(seasonalErrandProps(preview, time, day)).toEqual(
          seasonalErrandProps(base, time, day),
        );
  });

  it('sorts by the item’s actual ground anchor and restores canvas state', () => {
    const { day, trip } = scenes[0];
    const props = seasonalErrandProps(town, trip.depart, day);
    const { ctx, calls } = recordingContext();
    ctx.globalAlpha = 0.7;
    const objects = drawSeasonalErrandProps(ctx, props, false);
    const offset = errandGroundOffset();
    const ground = unproject(offset.x, offset.y);
    expect(objects[0].depth).toBeCloseTo(props[0].point.x + props[0].point.y + ground.x + ground.y);
    objects[0].paint();
    expect(ctx.globalAlpha).toBe(0.7);
    expect(calls.filter((call) => call.name === 'fillRect').length).toBeGreaterThan(10);
  });
});
