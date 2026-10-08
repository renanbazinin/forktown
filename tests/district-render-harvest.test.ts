// The Harvest Fair and the Long Table's art (SPEC §4.3, §6.6), agent D: the stubble patch, the
// props at their places and times, the table laid and cleared, each guest's dish from their
// arrival, the lamps in the streetlamp wave, the scarecrow's hat, heights, caps over the whole
// day, no amber but a lit lamp, no flashing, and the static art cached by kind, season day and
// night. tests/district-render.test.ts holds the checks every painter shares.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dishesOnTable,
  drawScarecrowExtras,
  fairLeaves,
  FLOOR_REACH,
  GROUND_MID,
  GROUND_REACH,
  harvestSpriteStats,
  HARVEST_PAIRS,
  HARVEST_PALETTE,
  HARVEST_PIECES,
  harvestPainter,
  isFairGroundDay,
  isStubbleGroundDay,
  LAMP_FADE,
  lampLight,
  LAMPS_OUT,
  presserAt,
  propOut,
  scripted,
  SEAT_FADE,
  seatOut,
  segmentParts,
  SPRITE_BUDGET,
  SPRITE_IDLE,
  SPRITE_MAX,
  STUBBLE_FROM,
  STUBBLE_PATCH,
  TABLE_LAMP_LIGHTS,
  TABLE_LAMPS,
} from '../src/city/district/harvest';
import type { DistrictGroundScene, DistrictScene } from '../src/city/district-art';
import { drawFarmGround } from '../src/city/farm';
import { pick, SNOW } from '../src/city/season-palette';
import { LIGHT } from '../src/city/glow';
import { MAX_LAMP_DISTANCE, MIN_LAMP_DISTANCE } from '../src/city/lamplight';
import { HARVEST_PROPS, SCARECROW_KEEP_OUT } from '../src/lib/district-places';
import { fairPose } from '../src/lib/outings/harvest';
import { FORK_PLOT, lampLightsAt } from '../src/lib/lanterns';
import { residentTrips } from '../src/lib/resident-trips';
import type { Place } from '../src/lib/schema';
import { AUTUMN, townSeasonAt } from '../src/lib/seasons';
import { CALENDAR_EPOCH_DAY, townCalendarAt } from '../src/lib/town-calendar';
import { getPlot, project } from '../src/lib/world';
import { TOWNS } from './district';
import { matrixContext } from './matrix-context';
import { recordingContext } from './recording-context';
import { rosterTimeout } from './roster-timeout';

const town: Place[] = TOWNS.full;
const dayOf = (season: string, date: number) =>
  Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + i).find((day) => {
    const calendar = townCalendarAt(day);
    return calendar.season === season && calendar.date === date;
  })!;
const A23 = dayOf('Autumn', 23);
const FAIR = [A23, A23 + 1, A23 + 2];
const isNight = (minutes: number) => minutes < 360 || minutes >= 1200;
const everywhere = () => true;
const nowhere = () => false;
const prop = (id: string) => HARVEST_PROPS.find((p) => p.id === id)!;

function sceneAt(
  day: number,
  minutes: number,
  visible = everywhere,
  zoom = 1,
  places = town,
): DistrictScene {
  return {
    day,
    minutes,
    night: isNight(minutes),
    season: townSeasonAt(day, minutes),
    zoom,
    visible,
    selected: null,
    hovered: null,
    places,
    residents: [],
    plan: () => residentTrips(places, minutes < 360 ? day - 1 : day),
  };
}
const groundOf = (day: number, night: boolean, visible = everywhere): DistrictGroundScene => ({
  night,
  season: townSeasonAt(day, 600),
  groundDay: townSeasonAt(day, 600).groundDay,
  visible,
});

type Draw = { name: string; fill: string; stroke: string; alpha: number };
/** A recorder that also notes the fill, the stroke and the alpha each call is made with. */
function capture(base = recordingContext(1280, 720)) {
  const target = base.ctx as unknown as Record<string, unknown>;
  const draws: Draw[] = [];
  const ctx = new Proxy(target, {
    get(object, key) {
      const value = object[key as string];
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        draws.push({
          name: String(key),
          fill: String(object.fillStyle),
          stroke: String(object.strokeStyle),
          alpha: Number(object.globalAlpha),
        });
        return (value as (...a: unknown[]) => unknown)(...args);
      };
    },
    set(object, key, value) {
      object[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls: base.calls, draws };
}
function paint(scene: DistrictScene, ctx = capture()) {
  harvestPainter.floor?.(ctx.ctx, scene);
  for (const object of harvestPainter.objects(ctx.ctx, scene).sort((a, b) => a.depth - b.depth))
    object.paint();
  return ctx;
}
/** A bright warm colour: what the eye reads as lamplight (district-render.test.ts's rule). */
const amberLike = (colour: string) => {
  if (!/^#[0-9A-F]{6}/i.test(colour)) return false;
  const n = parseInt(colour.slice(1, 7), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return r >= 0xe0 && g >= 0xb0 && g <= 0xea && b <= 0xb8 && r - b >= 0x40;
};

describe('The Harvest Fair’s day', () => {
  it('puts out nothing on any other day, and nothing before dawn or after the table is cleared', () => {
    for (const day of [dayOf('Autumn', 22), dayOf('Autumn', 26), dayOf('Summer', 23)])
      for (const minutes of [400, 900, 1150, 1235])
        expect(paint(sceneAt(day, minutes)).calls, `${day} at ${minutes}`).toHaveLength(0);
    for (const minutes of [0, 300, 359, 1275, 1300, 1439])
      expect(paint(sceneAt(A23, minutes)).calls, `at ${minutes}`).toHaveLength(0);
  });

  it('draws nothing off-screen, at any minute of a fair day', () => {
    for (const day of FAIR)
      for (let minutes = 355; minutes <= 1280; minutes += 5) {
        expect(paint(sceneAt(day, minutes, nowhere)).calls, `${day} at ${minutes}`).toHaveLength(0);
        const ground = capture();
        harvestPainter.ground!(ground.ctx, groundOf(day, isNight(minutes), nowhere));
        expect(ground.calls).toHaveLength(0);
      }
  });

  it(
    'keeps within its 1,200 calls all day, the table full of dishes included',
    () => {
      let most = 0;
      for (const day of FAIR)
        for (let minutes = 360; minutes < 1275; minutes += 5)
          for (const zoom of [1, 2.4]) {
            const calls = paint(sceneAt(day, minutes, everywhere, zoom)).calls.length;
            most = Math.max(most, calls);
            expect(calls, `${day} at ${minutes}`).toBeLessThanOrEqual(1_200);
          }
      // Measured: the most is laying and supper's busiest minutes, well within the cap.
      expect(most).toBeGreaterThan(200);
    },
    rosterTimeout(0.2, 60_000),
  );

  it('fades its props in at dawn and away at their times, inside HARVEST_PROPS', () => {
    for (const item of HARVEST_PROPS) {
      expect(propOut(item, item.from - 0.01), item.id).toBe(0);
      expect(propOut(item, item.to), item.id).toBe(0);
      expect(propOut(item, (item.from + item.to) / 2), item.id).toBe(1);
    }
    // The press and the bales are gone before the trestles go down.
    expect(propOut(prop('press'), 1030)).toBe(0);
    expect(segmentParts(7, 1035).legs).toBe(0);
    expect(segmentParts(7, 1036).legs).toBe(1);
  });

  it('lays the table east to west in 17:15–17:45 and clears it west to east in 21:00–21:15', () => {
    const table = prop('table');
    for (let k = 0; k < 8; k++) {
      for (const part of ['legs', 'board', 'cloth', 'things'] as const) {
        expect(segmentParts(k, table.from)[part], `${k} ${part}`).toBe(0);
        expect(segmentParts(k, 1065)[part], `${k} ${part}`).toBe(1);
        expect(segmentParts(k, 1259.9)[part], `${k} ${part}`).toBe(1);
        expect(segmentParts(k, table.to)[part], `${k} ${part}`).toBe(0);
      }
      // The cloth goes on after the board, and comes off before it.
      for (let t = table.from; t < table.to; t += 0.25) {
        const parts = segmentParts(k, t);
        expect(parts.cloth).toBeLessThanOrEqual(parts.board);
        expect(parts.things).toBeLessThanOrEqual(parts.cloth + 1e-9);
      }
      if (k)
        expect(segmentParts(k, 1037).legs).toBeGreaterThanOrEqual(segmentParts(k - 1, 1037).legs);
    }
    // Laid by 17:45, all gone by 21:15.
    expect(segmentParts(0, 1065).things).toBe(1);
  });

  it('keeps the farmhands and the presser away from every guest', () => {
    // The farmhands lay before the first Long Table guest sits down and clear after the last
    // has gone; the presser works the press inside the fair, and never on a guest's spot.
    for (const day of FAIR) {
      let first = Infinity,
        last = -Infinity;
      for (const trips of residentTrips(town, day).values())
        for (const trip of trips)
          if (trip.event.outing === 'long-table') {
            first = Math.min(first, trip.arrive);
            last = Math.max(last, trip.leave);
          }
      expect(first).toBeGreaterThan(1070);
      expect(last).toBeLessThan(1258);
    }
    for (let t = 780; t < 1020; t += 0.25) {
      const { figure } = presserAt(t);
      const press = prop('press');
      expect(Math.hypot(figure.position.x - press.x, figure.position.y - press.y)).toBeCloseTo(
        0.5,
        5,
      );
      for (const point of SCARECROW_KEEP_OUT.points)
        expect(
          Math.hypot(figure.position.x - point.x, figure.position.y - point.y),
        ).toBeGreaterThan(1);
    }
    // A scripted figure is out only inside its own steps.
    const steps = [
      { t: 10, x: 0, y: 0 },
      { t: 12, x: 1, y: 0 },
    ];
    expect(scripted(steps, 9.9)).toBeUndefined();
    expect(scripted(steps, 11)!.moving).toBe(true);
    expect(scripted(steps, 11)!.facing).toBe('se');
    expect(scripted(steps, 12)).toBeUndefined();
  });
});

describe('Culling', () => {
  it(
    'keeps every piece inside the boxes the fair is culled by as a whole',
    () => {
      const inside = (
        points: readonly { x: number; y: number }[],
        [rx, above, below]: readonly number[],
        where: string,
      ) => {
        let side = 0,
          top = Infinity,
          bottom = -Infinity;
        for (const p of points) {
          side = Math.max(side, Math.abs(p.x - GROUND_MID.x));
          top = Math.min(top, p.y);
          bottom = Math.max(bottom, p.y);
        }
        expect(side, where).toBeLessThanOrEqual(rx);
        if (!points.length) return;
        expect(top, where).toBeGreaterThanOrEqual(GROUND_MID.y - above);
        expect(bottom, where).toBeLessThanOrEqual(GROUND_MID.y + below);
      };
      let pieces = 0;
      for (const day of FAIR)
        for (
          let minutes = 360;
          minutes < 1275;
          minutes += minutes < 1035 || minutes >= 1255 ? 2 : 0.5
        ) {
          // The farmhands' walks out through the gates are the widest reach.
          if (minutes >= 1075 && minutes < 1255) minutes = 1255;
          const scene = sceneAt(day, minutes);
          const objects = matrixContext(1280, 720);
          for (const object of harvestPainter.objects(objects.ctx, scene)) object.paint();
          pieces += objects.points.length;
          inside(objects.points, GROUND_REACH, `${day} at ${minutes}`);
          const floor = matrixContext(1280, 720);
          harvestPainter.floor!(floor.ctx, scene);
          inside(floor.points, FLOOR_REACH, `floor ${day} at ${minutes}`);
        }
      expect(pieces).toBeGreaterThan(100_000);
    },
    rosterTimeout(0.3, 120_000),
  );
});

describe('The straw seats', () => {
  it('stay under every fair guest, sitting or standing, until they have gone, in both towns', () => {
    const press = prop('press');
    for (const places of [TOWNS.real, TOWNS.full])
      for (const day of FAIR) {
        const leaves = fairLeaves(sceneAt(day, 1030, everywhere, 1, places));
        let sat = 0;
        for (const [id, trips] of residentTrips(places, day))
          for (const trip of trips) {
            if (trip.event.outing !== 'harvest-fair') continue;
            const home = places.find((place) => place.id === id)!;
            const { arrive, leave, seat } = trip;
            for (let t = arrive; t < leave + 0.5; t += 0.05) {
              expect(seatOut(t, leaves[seat]), `${id} at ${t.toFixed(2)}`).toBe(1);
              const pose = fairPose({ home, trip, time: t, day, seat, arrive, leave });
              // Sitting, or on the way down or up, only while the press and bales are all there.
              if (pose === undefined || t >= leave) continue;
              sat++;
              expect(propOut(press, t), `${id} at ${t.toFixed(2)}`).toBe(1);
            }
          }
        expect(sat).toBeGreaterThan(1000);
        // All gathered up long before the table's guests come.
        for (let k = 0; k < 12; k++) expect(seatOut(1075, leaves[k])).toBe(0);
      }
    // A seat nobody took goes with the bales.
    expect(seatOut(1027.5)).toBeCloseTo(propOut(press, 1027.5), 9);
    expect(seatOut(1027.5, 1031)).toBe(1);
    expect(seatOut(1031.5 + SEAT_FADE / 2, 1031)).toBeCloseTo(0.5, 9);
  });
});

describe('The stubble patch', () => {
  it('is laid over bed 1 from the last of the grain to spring, the same whenever it is painted', () => {
    expect([...Array(112).keys()].filter(isFairGroundDay)).toEqual([
      AUTUMN + 22,
      AUTUMN + 23,
      AUTUMN + 24,
    ]);
    const days = [...Array(112).keys()].filter(isStubbleGroundDay);
    expect(days[0]).toBe(STUBBLE_FROM);
    expect(days).toEqual([...Array(112 - STUBBLE_FROM).keys()].map((d) => STUBBLE_FROM + d));
    expect(days).toEqual(expect.arrayContaining([AUTUMN + 22, AUTUMN + 23, AUTUMN + 24]));
    for (const day of [dayOf('Autumn', 21), dayOf('Spring', 1), dayOf('Summer', 20)]) {
      const off = capture();
      harvestPainter.ground!(off.ctx, groundOf(day, false));
      expect(off.calls).toHaveLength(0);
    }
    for (const day of [...FAIR, dayOf('Autumn', 22), dayOf('Autumn', 27), dayOf('Winter', 23)])
      for (const night of [false, true]) {
        const [a, b] = [capture(), capture()];
        harvestPainter.ground!(a.ctx, groundOf(day, night));
        harvestPainter.ground!(b.ctx, groundOf(day, night));
        expect(a.calls.length).toBeGreaterThan(50);
        expect(a.calls).toEqual(b.calls);
      }
    // The loose straw lies where the fair stood, from its first day to the autumn's end.
    const straw = (day: number) => {
      const { ctx, draws } = capture();
      harvestPainter.ground!(ctx, groundOf(day, false));
      return draws.filter((draw) => draw.fill === HARVEST_PALETTE.wisp[0]).length;
    };
    expect(straw(dayOf('Autumn', 22))).toBe(0);
    for (const day of [...FAIR, dayOf('Autumn', 28)]) expect(straw(day)).toBe(18);
    expect(straw(dayOf('Winter', 1))).toBe(0);
  });

  it('agrees with the rest of the field: stubble from the last of the grain, frost and snow with it', () => {
    /** The farm's grain plants cut to stubble on a day: 128 once all of it is in. */
    const cut = (day: number) => {
      const { ctx, calls } = recordingContext(1280, 720);
      drawFarmGround(ctx, false, townSeasonAt(day, 600));
      return calls.filter((call) => call.name === 'fillRect' && call.fillStyle === '#C6AD6A')
        .length;
    };
    const laid = (day: number) => isStubbleGroundDay(townSeasonAt(day, 600).groundDay);
    expect(cut(dayOf('Autumn', 21))).toBeLessThan(128);
    expect(laid(dayOf('Autumn', 21))).toBe(false);
    expect(cut(dayOf('Autumn', 22))).toBe(128);
    expect(laid(dayOf('Autumn', 22))).toBe(true);
    // The grain's stubble stands through the winter, and so does the patch; spring sows afresh.
    expect(cut(dayOf('Winter', 28))).toBe(128);
    expect(laid(dayOf('Winter', 28))).toBe(true);
    expect(cut(dayOf('Spring', 1))).toBe(0);
    expect(laid(dayOf('Spring', 1))).toBe(false);
    /** The fills a painter gives bed 1's field and its eight furrows, found where they start. */
    const fills = (paint: (ctx: CanvasRenderingContext2D) => void) => {
      const { ctx, calls } = recordingContext(1280, 720);
      paint(ctx);
      const startsAt = (p: { x: number; y: number }) =>
        calls.findIndex(
          (call) =>
            call.name === 'moveTo' &&
            Math.hypot((call.args[0] as number) - p.x, (call.args[1] as number) - p.y) < 0.01,
        );
      const fillAfter = (i: number) =>
        String(calls.slice(i).find((call) => call.name === 'fill')?.fillStyle);
      const furrows = [74.35, 76.1, 77.9, 79.9].flatMap((row) =>
        [0, 1].map((line) => fillAfter(startsAt(project(18.42, row + line * 0.36 + 0.13)))),
      );
      return { field: fillAfter(0), furrows };
    };
    let snowy = 0;
    for (let date = 1; date <= 28; date++)
      for (const night of [false, true]) {
        const day = dayOf('Winter', date);
        const farm = fills((ctx) => drawFarmGround(ctx, night, townSeasonAt(day, 600)));
        const patch = fills((ctx) => harvestPainter.ground!(ctx, groundOf(day, night)));
        const shade = pick(SNOW.shade, night);
        expect(
          patch.furrows.map((fill) => fill === shade),
          `Winter ${date}`,
        ).toEqual(farm.furrows.map((fill) => fill === shade));
        snowy += patch.furrows.filter((fill) => fill === shade).length;
        // Frosted together: the farm's field and the patch's trodden one.
        const bare = fills((ctx) =>
          drawFarmGround(ctx, night, townSeasonAt(dayOf('Autumn', 22), 600)),
        ).field;
        expect(patch.field !== pick(HARVEST_PALETTE.field, night)).toBe(farm.field !== bare);
      }
    expect(snowy).toBeGreaterThan(100);
  });

  it('covers every leafy green of bed 1, leaves and all', () => {
    // farm.ts plants bed 1 at x 18.54 + 0.36 per plant, rows from y 74.35, 76.1, 77.9 and 79.9:
    // each green is a leaf 8 px wide from 4 px up to 1 below its point, and a heart 5 px wide
    // from 7 px up.
    const { left, right, top, bottom } = STUBBLE_PATCH;
    const corners = [
      project(left, top),
      project(right, top),
      project(right, bottom),
      project(left, bottom),
    ];
    const inside = (p: { x: number; y: number }) =>
      corners.every((a, i) => {
        const b = corners[(i + 1) % 4];
        return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0;
      });
    let plants = 0;
    for (const row of [74.35, 76.1, 77.9, 79.9])
      for (const line of [0, 1])
        for (let plant = 0; plant < 8; plant++) {
          const p = project(18.3 + 0.24 + plant * 0.36, row + line * 0.36 + 0.2);
          plants++;
          for (const [dx, dy] of [
            [-2, -7],
            [3, -7],
            [-4, -4],
            [4, -4],
            [-4, 1],
            [4, 1],
          ])
            expect(inside({ x: p.x + dx, y: p.y + dy }), `${row} ${line} ${plant}`).toBe(true);
        }
    expect(plants).toBe(64);
  });
});

describe('The Long Table', () => {
  it('puts each guest’s dish at their place from the moment they arrive', () => {
    for (const day of FAIR) {
      const trips = [...residentTrips(town, day).values()]
        .flat()
        .filter((trip) => trip.event.outing === 'long-table');
      expect(trips).toHaveLength(16);
      for (const trip of trips) {
        const before = dishesOnTable(sceneAt(day, trip.arrive - 0.05));
        const after = dishesOnTable(sceneAt(day, trip.arrive + 0.05));
        expect(before.some((dish) => dish.seat === trip.seat)).toBe(false);
        expect(after.some((dish) => dish.seat === trip.seat)).toBe(true);
      }
      expect(dishesOnTable(sceneAt(day, 1250))).toHaveLength(16);
    }
  });

  it('lights its four lamps in the streetlamp wave and puts them out over two minutes at 20:56', () => {
    const fork = getPlot(FORK_PLOT)!;
    expect(TABLE_LAMPS).toHaveLength(4);
    TABLE_LAMPS.forEach((x, i) => {
      const distance = Math.abs(x - (fork.x + 0.5)) + Math.abs(77.5 - (fork.y + 0.5));
      expect(TABLE_LAMP_LIGHTS[i]).toBeCloseTo(
        lampLightsAt(distance - MIN_LAMP_DISTANCE, MAX_LAMP_DISTANCE - MIN_LAMP_DISTANCE),
        9,
      );
      expect(TABLE_LAMP_LIGHTS[i]).toBeGreaterThanOrEqual(1220);
      expect(TABLE_LAMP_LIGHTS[i]).toBeLessThanOrEqual(1230);
      expect(lampLight(i, TABLE_LAMP_LIGHTS[i] - 0.01, true)).toBe(0);
      expect(lampLight(i, 1240, true)).toBe(1);
      expect(lampLight(i, 1240, false)).toBe(0);
      expect(lampLight(i, LAMPS_OUT + LAMP_FADE / 2, true)).toBeCloseTo(0.5, 5);
      expect(lampLight(i, LAMPS_OUT + LAMP_FADE, true)).toBe(0);
    });
    // Out after the last possible leave (seat 15's cap, 20:55.5), cleared from 21:00.
    expect(LAMPS_OUT).toBeGreaterThanOrEqual(1255.5);
  });

  it('keeps amber for its lit lamps: none by day, none before they light', () => {
    // No day colour of its own palette is amber.
    expect(HARVEST_PAIRS.map((pair) => pair[0]).filter(amberLike)).toEqual([]);
    const lit = new Set([LIGHT.lit, LIGHT.core].map((colour) => colour.toUpperCase()));
    for (const day of FAIR)
      for (let minutes = 360; minutes < 1275; minutes += 5) {
        const recorder = paint(sceneAt(day, minutes));
        harvestPainter.ground!(recorder.ctx, groundOf(day, isNight(minutes)));
        const amber = recorder.draws
          .flatMap((draw) => [draw.fill, draw.stroke])
          .filter((colour) => amberLike(colour) || lit.has(colour.toUpperCase()));
        const lamps = TABLE_LAMPS.some((_, i) => lampLight(i, minutes, isNight(minutes)) > 0);
        if (!lamps) expect(amber, `${day} at ${minutes}`).toEqual([]);
        else for (const colour of amber) expect(lit.has(colour.toUpperCase())).toBe(true);
      }
  });

  it(
    'never flashes: nothing changes its alpha by more than 0.08 a frame, all day',
    () => {
      const FRAME = 1 / 30;
      const jumps: string[] = [];
      let compared = 0;
      for (const [from, to] of [
        [358, 367], // dawn: the cart, bunting, press, bales and seats
        [778, 783], // the presser comes
        [1017, 1068], // the presser goes, the press and bales fade, the table is laid
        [1078, 1083], // the fiddler comes
        [1217, 1262], // the lamps light and go out; the fiddler goes; the cart goes
        [1262, 1276], // the table is cleared
      ]) {
        let before: Draw[] | undefined;
        for (let minutes = from; minutes < to; minutes += FRAME) {
          const { draws } = paint(sceneAt(A23 + 1, minutes));
          if (
            before &&
            before.length === draws.length &&
            before.every((d, i) => d.name === draws[i].name)
          )
            draws.forEach((draw, i) => {
              compared++;
              if (Math.abs(draw.alpha - before![i].alpha) > 0.08 + 1e-9)
                jumps.push(`${minutes.toFixed(3)}: ${before![i].alpha} → ${draw.alpha}`);
            });
          before = draws;
        }
      }
      expect(jumps.slice(0, 5)).toEqual([]);
      expect(compared).toBeGreaterThan(10_000);
    },
    rosterTimeout(0.3, 120_000),
  );
});

describe('Heights and places', () => {
  /** How far a piece reaches above the far edge of its own footprint, in px at zoom 1. */
  function rise(piece: keyof typeof HARVEST_PIECES, footprint: number) {
    const recorder = matrixContext(400, 400);
    HARVEST_PIECES[piece](recorder.ctx, false);
    const top = Math.min(...recorder.points.map((p) => p.y));
    // A round footprint of radius r tiles reaches r × 19√2 px up the screen.
    return -top - footprint * 19 * Math.SQRT2;
  }
  it('keeps the bales, press, cart and lamps to their heights', () => {
    expect(rise('bale', prop('bale-0').r)).toBeLessThanOrEqual(12);
    expect(rise('press', prop('press').r)).toBeLessThanOrEqual(24);
    expect(rise('cart', prop('cart').r)).toBeLessThanOrEqual(18);
    // A lamp on the table and a straw seat, straight up from their own ground point.
    expect(rise('lamp', 0)).toBeLessThanOrEqual(16);
    expect(rise('seat', 0)).toBeLessThanOrEqual(12);
  });

  it('dresses the scarecrow for the fair, on its hat, on Autumn 23–25 only', () => {
    for (const day of [dayOf('Autumn', 22), dayOf('Autumn', 26), dayOf('Spring', 23)]) {
      const { ctx, calls } = recordingContext();
      drawScarecrowExtras(ctx, 0, 0, day, false);
      expect(calls).toHaveLength(0);
    }
    for (const day of FAIR)
      for (const night of [false, true]) {
        const { ctx, calls } = recordingContext();
        drawScarecrowExtras(ctx, 0, 0, day, night);
        expect(calls.length).toBeGreaterThan(5);
        for (const call of calls.filter((c) => c.name === 'fillRect')) {
          const [x, y, w, h] = call.args as number[];
          expect(x).toBeGreaterThanOrEqual(-12);
          expect(x + w).toBeLessThanOrEqual(12);
          expect(y).toBeGreaterThanOrEqual(-62);
          expect(y + h).toBeLessThanOrEqual(-43);
        }
      }
  });
});

describe('Static art', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is cached by kind, season day and night, and stamped once it holds', () => {
    let made = 0;
    const sprites: ReturnType<typeof recordingContext>[] = [];
    vi.stubGlobal('document', {
      createElement: () => {
        made++;
        const sprite = recordingContext(64, 64);
        sprites.push(sprite);
        return { width: 0, height: 0, getContext: () => sprite.ctx };
      },
    });
    // One map canvas, frame after frame.
    const ctx = recordingContext(1280, 720);
    const map = capture(ctx);
    const frame = (day: number, minutes: number) => {
      const before = ctx.calls.length;
      paint(sceneAt(day, minutes), map);
      return ctx.calls.slice(before);
    };
    // The first frame at a new scale paints straight onto the map.
    const first = frame(A23, 600);
    expect(made).toBe(0);
    expect(first.filter((call) => call.name === 'drawImage')).toHaveLength(0);
    // From the second, each kind is painted once into its sprite and stamped.
    const second = frame(A23, 600);
    const kinds = made;
    // The cart, the three bunting spans, the press, two bales and a seat.
    expect(kinds).toBe(8);
    expect(second.filter((call) => call.name === 'drawImage').length).toBeGreaterThanOrEqual(23);
    const third = frame(A23, 601);
    expect(made).toBe(kinds);
    expect(third.length).toBeLessThan(first.length / 2);
    // Night and another season day each paint their own.
    frame(A23, 601);
    paint({ ...sceneAt(A23, 601), night: true }, map);
    expect(made).toBe(2 * kinds);
    frame(A23 + 1, 600);
    expect(made).toBe(3 * kinds);
    // The laid table stamps a sprite per segment, plus a lamp and a jug.
    const supper = frame(A23, 1170);
    frame(A23, 1170);
    expect(made).toBe(3 * kinds + 10);
    expect(supper.length).toBeGreaterThan(0);
  });
  it('lights each lamp’s pool after the cloth round it, so no segment cuts it off', () => {
    vi.stubGlobal('document', {
      createElement: () => {
        const sprite = recordingContext(64, 64);
        return { width: 0, height: 0, getContext: () => sprite.ctx };
      },
    });
    const ctx = recordingContext(1280, 720);
    const map = capture(ctx);
    // The first frame paints straight onto the map; the second stamps the sprites.
    paint(sceneAt(A23 + 1, 1240), map);
    const before = ctx.calls.length;
    paint(sceneAt(A23 + 1, 1240), map);
    type Rect = { index: number; x: number; y: number; w: number; h: number };
    const images = ctx.calls
      .slice(before)
      .map((call, index) => ({ call, index }))
      .filter(({ call }) => call.name === 'drawImage');
    const rect = ({ call, index }: (typeof images)[number], w: number, h: number): Rect => ({
      index,
      x: call.args[1] as number,
      y: call.args[2] as number,
      w,
      h,
    });
    const glows = images
      .filter(({ call }) => call.args.length === 5)
      .map((image) => rect(image, image.call.args[3] as number, image.call.args[4] as number));
    // The table's segments are the 64-px-wide sprites.
    const segments = images
      .filter(({ call }) => call.args.length === 3)
      .filter(({ call }) => (call.args[0] as { width: number }).width === 64)
      .map((image) => rect(image, 64, (image.call.args[0] as { height: number }).height));
    expect(glows).toHaveLength(4);
    expect(segments).toHaveLength(8);
    let overlaps = 0;
    for (const glow of glows)
      for (const segment of segments)
        if (
          segment.x < glow.x + glow.w &&
          glow.x < segment.x + segment.w &&
          segment.y < glow.y + glow.h &&
          glow.y < segment.y + segment.h
        ) {
          overlaps++;
          expect(segment.index).toBeLessThan(glow.index);
        }
    // Each pool falls on its own segment and the ones either side, the end lamps on two.
    expect(overlaps).toBe(10);
  });

  it('keeps its sprites within a pixel budget, paints big ones directly and lets idle ones go', () => {
    const made: { width: number; height: number }[] = [];
    vi.stubGlobal('document', {
      createElement: () => {
        const sprite = recordingContext(64, 64);
        const canvas = { width: 0, height: 0, getContext: () => sprite.ctx };
        made.push(canvas);
        return canvas;
      },
    });
    /** A map canvas at `scale` device px a world px (the zoom times the screen's density). */
    const scaled = (scale: number) => {
      const target = recordingContext(1280, 720).ctx as unknown as Record<string, unknown>;
      return new Proxy(target, {
        get(object, key) {
          if (key === 'getTransform') return () => ({ a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 });
          const value = object[key as string];
          return typeof value === 'function' ? value.bind(object) : value;
        },
        set(object, key, value) {
          object[key as string] = value;
          return true;
        },
      }) as unknown as CanvasRenderingContext2D;
    };
    const frame = (ctx: CanvasRenderingContext2D, scene: DistrictScene) => {
      for (const object of harvestPainter.objects(ctx, scene).sort((a, b) => a.depth - b.depth))
        object.paint();
    };
    // Zoom 6 on a three-times screen: a laid segment would be 1152 × 828 px, so it is painted
    // straight onto the map, and only the small pieces keep sprites.
    const close = scaled(18);
    for (const minutes of [1170, 1170, 1170.5]) frame(close, sceneAt(A23, minutes));
    expect(harvestSpriteStats(close).sprites).toBeGreaterThan(0);
    expect(made.length).toBeGreaterThan(0);
    expect(made.every(({ width, height }) => width * height <= SPRITE_MAX)).toBe(true);
    // Zoom 6 on a twice screen, through the laying and into supper: never over the budget.
    const near = scaled(12);
    for (let minutes = 1030; minutes < 1090; minutes += 0.5) {
      frame(near, sceneAt(A23, minutes));
      expect(harvestSpriteStats(near).pixels).toBeLessThanOrEqual(SPRITE_BUDGET);
    }
    // The laying's pieces are let go once the table is laid; everything once it is out of view.
    for (let i = 0; i <= SPRITE_IDLE; i++) frame(near, sceneAt(A23, 1170));
    const laid = harvestSpriteStats(near);
    expect(laid.sprites).toBeGreaterThan(0);
    // At most the cart, three spans of bunting, eight laid segments, a lamp and a jug.
    expect(laid.sprites).toBeLessThanOrEqual(14);
    for (let i = 0; i <= SPRITE_IDLE; i++) frame(near, sceneAt(A23, 1170, nowhere));
    expect(harvestSpriteStats(near)).toEqual({ sprites: 0, pixels: 0 });
  });
});
