// Market Square's art (agent B, SPEC §4.1, §2.4, §6.6): the static art is made once per market,
// season day and night; the awnings unroll one at a time 07:15–07:45 and everything is packed by
// noon; the stalls stay under 28 px and the pump under 24; the wares follow the market and the
// farm's year; snow lies on the awnings in winter; the stalls sort between the browsers and the
// street behind; a click on a stall or the paving finds the square; nothing is amber; and the
// cap holds on the busiest morning of every market.
import { describe, expect, it } from 'vitest';
import {
  CART_WOOD,
  COUNTER_FRONT,
  holderFacing,
  holderTurned,
  MARKET_CART,
  MARKET_HEIGHTS,
  MARKET_PUMP,
  MARKET_STALL_GEOMETRY,
  marketArt,
  marketPainter,
  stallAt,
  stallDepth,
  stallTimes,
  waresKey,
} from '../src/city/district/market';
import type { DistrictScene } from '../src/city/district-art';
import { drawResident } from '../src/city/residents';
import { SNOW, PUMPKIN } from '../src/city/season-palette';
import { BRAND } from '../src/lib/brand';
import { marketKind, type MarketKind } from '../src/lib/district-calendar';
import { DISTRICT_SPOTS, districtApproach } from '../src/lib/district-places';
import { residentTrips, tripState } from '../src/lib/resident-trips';
import type { Place } from '../src/lib/schema';
import { townSeasonAt } from '../src/lib/seasons';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { townCalendarAt } from '../src/lib/town-calendar';
import { project } from '../src/lib/world';
import { TOWNS, YEAR } from './district';
import { matrixContext } from './matrix-context';
import { recordingContext } from './recording-context';

const town: Place[] = TOWNS.full;
const isNight = (minutes: number) => minutes < 360 || minutes >= 1200;
/** The first day of the year with this market in this season (0 spring … 3 winter), from `date`. */
const dayWith = (kind: MarketKind, season: number, date = 1) =>
  YEAR.find((day) => {
    const c = townCalendarAt(day);
    return c.seasonIndex === season && c.date >= date && marketKind(day) === kind;
  })!;
const sceneAt = (day: number, minutes: number, residents: ResidentState[] = []): DistrictScene => ({
  day,
  minutes,
  night: isNight(minutes),
  season: townSeasonAt(day, minutes),
  zoom: 1,
  visible: () => true,
  selected: null,
  hovered: null,
  places: town,
  residents,
  plan: () => residentTrips(town, minutes < 360 ? day - 1 : day),
});
/** Every colour a scene's market paints with. */
function coloursOf(scene: DistrictScene) {
  const { ctx, calls } = recordingContext();
  for (const object of marketPainter.objects(ctx, scene).sort((a, b) => a.depth - b.depth))
    object.paint();
  return new Set(calls.filter((call) => call.name === 'fillRect').map((c) => String(c.fillStyle)));
}

describe('Market Square’s art', () => {
  it('is made once for a market, a season’s day and the night, and kept', () => {
    const day = dayWith('farmers', 1);
    const { groundDay } = townSeasonAt(day, 600);
    const art = marketArt(day, groundDay, false);
    // The same art all morning, whatever the minute.
    for (const minutes of [430, 480, 600, 700]) {
      const scene = sceneAt(day, minutes);
      expect(marketArt(scene.day, scene.season.groundDay, scene.night)).toBe(art);
    }
    expect(art.key).toBe(`farmers:${groundDay}:false`);
    expect(marketArt(day, groundDay, true)).not.toBe(art);
    expect(marketArt(day, groundDay + 1, false)).not.toBe(art);
    const books = dayWith('books', 1);
    expect(marketArt(books, townSeasonAt(books, 600).groundDay, false).kind).toBe('books');
  });

  it('unrolls the awnings one at a time, 07:15–07:45, two minutes each, and packs up by noon', () => {
    for (const day of YEAR.slice(0, 28)) {
      const spans = MARKET_STALL_GEOMETRY.map((stall) => {
        const t = stallTimes(day, stall.k);
        // Shut and empty through the night; the stallholder arrives 07:10–07:30.
        expect(stallAt(day, 300, stall.k)).toMatchObject({ holder: 0, cover: 1, roll: 0 });
        expect(stallAt(day, 429.9, stall.k).holder).toBe(0);
        expect(stallAt(day, 450, stall.k).holder).toBe(1);
        expect(t.unroll).toBeGreaterThanOrEqual(435);
        expect(t.unroll + 2).toBeLessThanOrEqual(465);
        expect(stallAt(day, t.unroll, stall.k).unrolled).toBe(0);
        expect(stallAt(day, t.unroll + 2, stall.k).unrolled).toBe(1);
        // Open from 08:00: the frame up, the awning out, the stock on the counter.
        const open = stallAt(day, 480, stall.k);
        expect(open).toMatchObject({ holder: 1, cover: 0, roll: 1, unrolled: 1 });
        for (let i = 0; i < 7; i++) expect(open.item(i)).toBe(1);
        // Everything packed and under canvas by noon, the stallholder gone.
        const noon = stallAt(day, 720, stall.k);
        expect(noon).toMatchObject({ holder: 0, cover: 1, roll: 0, unrolled: 0 });
        for (let i = 0; i < 8; i++) expect(stallAt(day, 690, stall.k).item(i)).toBe(1);
        for (let i = 0; i < 8; i++) expect(noon.item(i)).toBe(0);
        expect(t.rollUp).toBeGreaterThanOrEqual(690);
        return [t.unroll, t.unroll + 2] as const;
      });
      // One at a time: no two awnings unroll together.
      const sorted = [...spans].sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < sorted.length; i++)
        expect(sorted[i][0]).toBeGreaterThanOrEqual(sorted[i - 1][1]);
    }
  });

  it(
    'never flashes: every fade changes at most 0.08 a frame, all morning, every day',
    {
      timeout: 60_000,
    },
    () => {
      // One real second is one town minute; a frame is 1/30 of it.
      const FRAME = 1 / 30;
      let worst = 0;
      for (const day of YEAR.filter((_, i) => i % 9 === 0))
        for (const stall of MARKET_STALL_GEOMETRY) {
          const values = (m: ReturnType<typeof stallAt>) => [
            m.holder,
            m.cover,
            m.roll,
            ...[0, 1, 2, 3, 4, 5, 6].map((i) => m.item(i)),
          ];
          for (const [from, to] of [
            [425, 485],
            [685, 725],
          ]) {
            let before = values(stallAt(day, from, stall.k));
            for (let t = from + FRAME; t < to; t += FRAME) {
              const now = values(stallAt(day, t, stall.k));
              now.forEach((v, i) => (worst = Math.max(worst, Math.abs(v - before[i]))));
              before = now;
            }
          }
        }
      expect(worst).toBeGreaterThan(0.01);
      expect(worst).toBeLessThanOrEqual(0.08);
    },
  );

  it('stands no taller than 28 px a stall and 24 px the pump (SPEC §2.4)', () => {
    expect(MARKET_HEIGHTS.stall).toBeLessThanOrEqual(28);
    expect(MARKET_HEIGHTS.pump).toBeLessThanOrEqual(24);
    for (const minutes of [460, 600, 730]) {
      const scene = sceneAt(dayWith('books', 1), minutes);
      const recorder = matrixContext(1280, 720);
      const objects = marketPainter.objects(recorder.ctx, scene);
      for (const object of objects) {
        const start = recorder.points.length;
        object.paint();
        const top = Math.min(...recorder.points.slice(start).map((p) => p.y));
        const stall = MARKET_STALL_GEOMETRY.find((s) => stallDepth(s) === object.depth);
        if (stall) {
          // The stall's highest ground corner is its back corner at s0.
          const corner =
            stall.row === 'north'
              ? project(stall.s0, COUNTER_FRONT.north - 0.9)
              : project(COUNTER_FRONT.west - 0.9, stall.s0);
          expect(corner.y - top, `stall ${stall.k} at ${minutes}`).toBeLessThanOrEqual(28);
        } else if (object.depth === MARKET_PUMP.x + MARKET_PUMP.y + 0.2) {
          expect(project(MARKET_PUMP.x, MARKET_PUMP.y).y - top).toBeLessThanOrEqual(24);
        }
      }
    }
  });

  it('follows the market and the farm’s year in its wares', () => {
    expect(waresKey('farmers', 2)).toBe('farmers:0:early');
    expect(waresKey('farmers', 20)).toBe('farmers:0:late');
    expect(waresKey('farmers', 28 + 20)).toBe('farmers:1:late');
    expect(waresKey('flowers', 60)).toBe('flowers:2');
    expect(waresKey('books', 100)).toBe('books');
    // Each market its own awning: sage, rose or slate, on cream.
    const awnings = { farmers: '#86A56E', flowers: '#D08A94', books: '#6E8396' };
    for (const kind of ['farmers', 'flowers', 'books'] as const) {
      const colours = coloursOf(sceneAt(dayWith(kind, 1), 600));
      expect(colours.has(awnings[kind]), kind).toBe(true);
      for (const other of Object.values(awnings))
        if (other !== awnings[kind]) expect(colours.has(other)).toBe(false);
    }
    // Strawberries in early summer, pumpkins in autumn, the gramophone's horn at the books.
    expect(coloursOf(sceneAt(dayWith('farmers', 1), 600)).has('#C8364A')).toBe(true);
    expect(coloursOf(sceneAt(dayWith('farmers', 2, 15), 600)).has(PUMPKIN.body[0])).toBe(true);
    expect(coloursOf(sceneAt(dayWith('books', 0), 600)).has('#D2B57A')).toBe(true);
    // Books and bric-a-brac only at the books: no onion, potato or parsnip anywhere, any day.
    for (const date of [1, 4, 9, 15, 22]) {
      const books = coloursOf(sceneAt(dayWith('books', 0, date), 600));
      for (const produce of ['#C48A4E', '#CDB284', '#E2D6B0', '#D58F3E'])
        expect(books.has(produce), `${date} ${produce}`).toBe(false);
    }
    // Wreaths and fir in winter: the flowers' stall has no summer stems then.
    const winter = coloursOf(sceneAt(dayWith('flowers', 3, 5), 600));
    expect(winter.has('#46705A')).toBe(true);
    expect(winter.has('#D49CC6')).toBe(false);
  });

  it('lays snow on the awnings in winter and none in summer', () => {
    const deep = dayWith('farmers', 3, 8);
    const art = marketArt(deep, townSeasonAt(deep, 600).groundDay, false);
    expect(Math.min(...art.snow)).toBeGreaterThan(0.9);
    const summer = dayWith('farmers', 1);
    expect(Math.max(...marketArt(summer, townSeasonAt(summer, 600).groundDay, false).snow)).toBe(0);
    // A snowy awning is mixed toward the snow, so its plain stripe is gone.
    const colours = coloursOf(sceneAt(deep, 600));
    expect(colours.has('#86A56E')).toBe(true); // the counter's runner keeps the colour
    expect(colours.has(SNOW.top[0])).toBe(true);
  });

  it('drops a little litter by the stalls through the morning and sweeps it up at noon', () => {
    const bits = (day: number, minutes: number) => {
      const { ctx, calls } = recordingContext();
      marketPainter.floor!(ctx, sceneAt(day, minutes));
      return calls.filter((call) => call.name === 'fillRect').length;
    };
    const farmers = dayWith('farmers', 1),
      books = dayWith('books', 1);
    expect(bits(farmers, 470)).toBe(0);
    expect(bits(farmers, 560)).toBeGreaterThan(0);
    expect(bits(farmers, 640)).toBeGreaterThan(bits(farmers, 560));
    expect(bits(farmers, 640)).toBeLessThanOrEqual(30);
    expect(bits(books, 640)).toBeLessThan(bits(farmers, 640));
    expect(bits(farmers, 730)).toBe(0);
    expect(bits(farmers, 1300)).toBe(0);
  });

  it('is shut under canvas at night, with nobody behind the counters', () => {
    const day = dayWith('flowers', 0);
    for (const minutes of [100, 1300]) {
      const colours = coloursOf(sceneAt(day, minutes));
      expect(colours.has('#7D7B66')).toBe(true); // the canvas, by night
      for (const stall of MARKET_STALL_GEOMETRY)
        expect(stallAt(day, minutes, stall.k)).toMatchObject({ holder: 0, cover: 1, roll: 0 });
    }
  });

  it('keeps amber for lamps, for every market, season and hour', () => {
    const amberLike = (colour: string) => {
      const exact = new Set(
        [BRAND.lantern, BRAND.glow, BRAND.lanternInk].map((c) => c.toUpperCase()),
      );
      if (exact.has(colour.toUpperCase().slice(0, 7))) return true;
      if (!/^#[0-9A-F]{6}/i.test(colour)) return false;
      const n = parseInt(colour.slice(1, 7), 16);
      const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
      return r >= 0xe0 && g >= 0xb0 && g <= 0xea && b <= 0xb8 && r - b >= 0x40;
    };
    // At night nothing warm outshines the cart's own night wood: a warm, bright patch reads as a
    // lit window at the live zoom (a crate end once poked out past the cart's cover).
    const sum = (colour: string) => {
      const n = parseInt(colour.slice(1, 7), 16);
      return (n >> 16) + ((n >> 8) & 255) + (n & 255);
    };
    const wood = Math.max(...CART_WOOD.map(([, night]) => sum(night)));
    const litLike = (colour: string) => {
      if (!/^#[0-9A-F]{6}/i.test(colour)) return false;
      const n = parseInt(colour.slice(1, 7), 16);
      const [r, , b] = [n >> 16, (n >> 8) & 255, n & 255];
      return r - b >= 0x30 && sum(colour) > wood * 1.15;
    };
    const glowing: string[] = [];
    for (const kind of ['farmers', 'flowers', 'books'] as const)
      for (const season of [0, 1, 2, 3])
        for (const date of [1, 20])
          for (const minutes of [450, 600, 705, 1300]) {
            const day = dayWith(kind, season, date);
            const scene = sceneAt(day, minutes);
            const { ctx, draws } = (() => {
              const base = recordingContext();
              const draws: string[] = [];
              const target = base.ctx as unknown as Record<string, unknown>;
              const proxied = new Proxy(target, {
                get: (object, key) => {
                  const value = object[key as string];
                  if (typeof value !== 'function') return value;
                  return (...args: unknown[]) => {
                    draws.push(String(object.fillStyle), String(object.strokeStyle));
                    return (value as (...a: unknown[]) => unknown)(...args);
                  };
                },
                set: (object, key, value) => ((object[key as string] = value), true),
              }) as unknown as CanvasRenderingContext2D;
              return { ctx: proxied, draws };
            })();
            marketPainter.floor!(ctx, scene);
            for (const object of marketPainter.objects(ctx, scene)) object.paint();
            marketPainter.ground!(ctx, {
              night: scene.night,
              season: scene.season,
              groundDay: scene.season.groundDay,
              visible: () => true,
            });
            for (const colour of draws)
              if (amberLike(colour) || (scene.night && litLike(colour)))
                glowing.push(`${kind} ${season} ${minutes}: ${colour}`);
          }
    expect(glowing.slice(0, 12)).toEqual([]);
  });

  it('sorts each stall between its browsers in front and the street behind it', () => {
    for (const stall of MARKET_STALL_GEOMETRY) {
      const depth = stallDepth(stall);
      // Its two browsers, and every point of their way in, sort in front of it.
      for (const seat of [2 * stall.k, 2 * stall.k + 1]) {
        const spot = DISTRICT_SPOTS.market[seat];
        expect(spot.x + spot.y).toBeGreaterThan(depth);
        const way = districtApproach('market', seat);
        expect(way.at(-2)!.x + way.at(-2)!.y).toBeGreaterThan(depth);
      }
      // A walker on the street behind it whose figure could overlap it sorts behind it.
      if (stall.row === 'north') expect(stall.s1 - 0.4 + 13.75).toBeLessThan(depth);
      else expect(stall.s1 - 0.4 + 53.75).toBeLessThan(depth);
    }
    // The handcart sits in the north-west corner, behind the first stall of each row.
    expect(MARKET_CART.x0 + MARKET_CART.y1).toBeLessThan(stallDepth(MARKET_STALL_GEOMETRY[0]));
    expect(MARKET_CART.x0 + MARKET_CART.y1).toBeLessThan(stallDepth(MARKET_STALL_GEOMETRY[3]));
  });

  it('answers a click on a stall or the paving with the square’s plot', () => {
    const scene = sceneAt(dayWith('farmers', 0), 600);
    const stall = MARKET_STALL_GEOMETRY[1];
    const counter = project((stall.s0 + stall.s1) / 2, COUNTER_FRONT.north - 0.2);
    expect(marketPainter.hit!({ x: counter.x, y: counter.y - 6 }, scene)).toEqual({
      plot: 'D15',
      depth: stallDepth(stall),
    });
    const middle = project(57.5, 19.5);
    expect(marketPainter.hit!(middle, scene)).toEqual({ plot: 'E15', depth: -1 });
    expect(marketPainter.hit!(project(56.8, 20.6), scene)).toEqual({ plot: 'E14', depth: -1 });
    expect(marketPainter.hit!(project(40, 40), scene)).toBeUndefined();
  });

  it('answers a click by a stall’s own shape, so a head on the street behind it is still clicked', () => {
    const open = sceneAt(dayWith('farmers', 0), 600);
    const stall = MARKET_STALL_GEOMETRY[1];
    // A walker on the duck street behind stall 1 (depth 71.5, the stall's 72.65): their head
    // shows over the rail, and a click there must not be the stall's.
    for (const x of [57.6, 58.0, 58.3, 58.6]) {
      const feet = project(x, 13.5);
      for (const up of [20, 24, 28]) {
        const hit = marketPainter.hit!({ x: feet.x, y: feet.y - up }, open);
        expect(hit?.depth ?? -1, `${x} ${up}`).toBeLessThan(x + 13.5);
      }
    }
    // The rail, the awning and the counter are the stall's.
    const middle = (stall.s0 + stall.s1) / 2;
    const rail = project(middle, 14 + 0.08);
    expect(marketPainter.hit!({ x: rail.x, y: rail.y - 25 }, open)?.depth).toBe(stallDepth(stall));
    const counter = project(middle, COUNTER_FRONT.north);
    expect(marketPainter.hit!({ x: counter.x, y: counter.y - 8 }, open)?.depth).toBe(
      stallDepth(stall),
    );
    // Shut, only the covered counter: the empty air over it is not the stall.
    const shut = sceneAt(dayWith('farmers', 0), 1360);
    const top = project(middle, COUNTER_FRONT.north - 0.1);
    expect(marketPainter.hit!({ x: top.x, y: top.y - 12 }, shut)?.depth).toBe(stallDepth(stall));
    expect(marketPainter.hit!({ x: top.x, y: top.y - 26 }, shut)?.depth ?? -1).toBeLessThan(
      stallDepth(stall),
    );
  });

  it('stands a chatting browser up, its bubble clear of the head and hat all chat long', () => {
    // The chat's bubble, and the three dots in it.
    const BUBBLE = ['#FCFAEF', '#7B8A69'],
      DOTS = '#7B8A69';
    const guest = (event: string | undefined, pose?: 'chat' | 'sit', extra = {}) =>
      ({
        id: 'guest',
        resident: town[0].resident,
        position: { x: 58.3, y: 15.75 },
        facing: 'ne',
        walkPhase: 0.2,
        moving: false,
        greeting: false,
        ...(pose ? { pose } : {}),
        ...(event ? { event: { id: event, name: 'Anything', phase: 'attending' } } : {}),
        ...extra,
      }) as ResidentState;
    /** The figure's calls at the town's 1.25, and where its bubble's fills land. */
    const drawn = (state: ResidentState) => {
      const recorder = matrixContext(1280, 720);
      drawResident(recorder.ctx, state.resident, 0, 0, 1.25, state);
      const inBubble = (call: (typeof recorder.calls)[number]) =>
        call.name === 'fillRect' && BUBBLE.includes(String(call.fillStyle));
      const bubble = recorder.points.filter((point) => inBubble(recorder.calls[point.index]));
      const dots = bubble.filter((point) => recorder.calls[point.index].fillStyle === DOTS);
      const body = recorder.calls
        .filter((call) => !inBubble(call))
        .map((call) => [call.name, call.args, call.name === 'restore' ? '' : call.fillStyle]);
      return { bubble, dots, body };
    };
    for (let walkPhase = 0; walkPhase < 1; walkPhase += 0.1) {
      // On their feet, as a browser who is not chatting, under a bubble the whole chat long.
      const chat = drawn(guest('market', 'chat', { walkPhase }));
      expect(chat.body).toEqual(drawn(guest('market', undefined, { walkPhase })).body);
      expect(chat.bubble.length).toBeGreaterThan(0);
      // A standing figure's hair starts 22 px up and a hat's crown 25, in its own px at 1.25.
      expect(Math.max(...chat.bubble.map((p) => p.y))).toBeLessThanOrEqual(-25 * 1.25);
    }
    // A greeting or a heart takes its place: its own bubble, without the chat's three dots.
    expect(drawn(guest('market', 'chat')).dots).toHaveLength(3 * 4);
    expect(drawn(guest('market', 'chat', { greeting: true })).dots).toEqual([]);
    expect(drawn(guest('market', 'chat', { duckLove: true })).dots).toEqual([]);
    // Everyone else still sits to chat, the bubble over a seated head now and then: at home, on
    // the green, at the fair on a straw seat, on a rug and in a deckchair.
    for (const event of [undefined, 'picnic', 'harvest-fair', 'stargazing', 'bandstand-sundown'])
      for (const walkPhase of [0.2, 0.6]) {
        const chat = drawn(guest(event, 'chat', { walkPhase }));
        expect(chat.body, `${event}`).toEqual(drawn(guest(event, 'sit', { walkPhase })).body);
        if (walkPhase < 0.4) expect(Math.max(...chat.bubble.map((p) => p.y))).toBe(-19 * 1.25);
        else expect(chat.bubble).toEqual([]);
      }
  });

  it('turns a stallholder a quarter to the stock now and then, never while a browser chats', () => {
    const day = dayWith('books', 2);
    const OPPOSITE: Record<string, string> = { se: 'nw', sw: 'ne', ne: 'sw', nw: 'se' };
    for (const stall of MARKET_STALL_GEOMETRY) {
      let turned = 0,
        runs = 0,
        before = false,
        since = 0,
        facing = holderFacing(stall.row, false);
      for (let t = 425; t < 725; t += 0.05) {
        const now = holderTurned(day, t, stall.k, false);
        expect(holderTurned(day, t, stall.k, true)).toBe(false);
        // Always toward the camera, and never an about-face from one moment to the next.
        const next = holderFacing(stall.row, now);
        expect(['se', 'sw']).toContain(next);
        expect(next).not.toBe(OPPOSITE[facing]);
        facing = next;
        if (t < 480 || t >= 690) {
          before = now;
          continue;
        }
        if (now) turned++;
        if (now !== before) {
          // Each turn and each return is held a minute at least.
          if (runs) expect(t - since).toBeGreaterThanOrEqual(1);
          runs++;
          since = t;
        }
        before = now;
      }
      expect(turned * 0.05).toBeGreaterThan(5);
      expect(turned * 0.05).toBeLessThan(60);
    }
  });

  it('keeps within 1,100 calls on the busiest morning of every market, and less from afar', () => {
    for (const kind of ['farmers', 'flowers', 'books'] as const)
      for (const season of [0, 2, 3]) {
        const day = dayWith(kind, season, 15);
        const scene = sceneAt(day, 600, simulateResidents(town, 600, day));
        // Every one of the day's twelve browsers at their stall.
        const browsing = new Map<string, ResidentState>();
        for (const [id, trips] of scene.plan())
          for (const trip of trips)
            if (trip.event.outing === 'market') {
              const home = town.find((place) => place.id === id)!;
              const state = scene.residents.find((resident) => resident.id === id)!;
              browsing.set(id, {
                ...state,
                ...tripState(home, trip, Math.max(trip.arrive, trip.event.start) + 1, day),
              });
            }
        const residents = scene.residents.map((r) => browsing.get(r.id) ?? r);
        // The floor (the litter) and every object, as the shared cap counts them.
        const count = (zoom: number) => {
          const { ctx, calls } = recordingContext();
          marketPainter.floor!(ctx, { ...scene, residents, zoom });
          for (const object of marketPainter
            .objects(ctx, { ...scene, residents, zoom })
            .sort((a, b) => a.depth - b.depth))
            object.paint();
          return calls.length;
        };
        expect(count(1), `${kind} ${season}`).toBeLessThanOrEqual(1_100);
        expect(count(0.4)).toBeLessThan(count(1));
      }
  }, 60_000);

  it('paints nothing but what is in view', () => {
    const scene = sceneAt(dayWith('farmers', 0), 600);
    const { ctx } = recordingContext();
    // Only the west row's far end in view: a stall or two, no cart and no pump.
    const west = project(54.5, 20.1);
    const objects = marketPainter.objects(ctx, {
      ...scene,
      visible: (p, rx, above, below) =>
        Math.abs(p.x - west.x) <= rx + 20 &&
        p.y + below >= west.y - 20 &&
        p.y - above <= west.y + 20,
    });
    expect(objects.length).toBeGreaterThan(0);
    expect(objects.length).toBeLessThan(4);
  });

  it('still paints a piece with only its last px in view, at each edge of the screen', () => {
    type Area = { left: number; right: number; top: number; bottom: number };
    const within =
      (area: Area): DistrictScene['visible'] =>
      (p, rx, above, below) =>
        p.x + rx >= area.left &&
        p.x - rx <= area.right &&
        p.y + below >= area.top &&
        p.y - above <= area.bottom;
    const far = 1e6;
    const lost: string[] = [];
    // Open and stocked, shut at night, and snowed on in deep winter (snow caps the tubs).
    for (const [day, minutes] of [
      [dayWith('books', 0), 600],
      [dayWith('farmers', 2, 15), 600],
      [dayWith('flowers', 3, 8), 1360],
      [dayWith('farmers', 3, 8), 600],
    ]) {
      const scene = sceneAt(day, minutes);
      const recorder = matrixContext(1280, 720);
      const pieces = marketPainter.objects(recorder.ctx, scene).map((object) => {
        const start = recorder.points.length;
        object.paint();
        const points = recorder.points.slice(start);
        const xs = points.map((p) => p.x),
          ys = points.map((p) => p.y);
        return {
          depth: object.depth,
          left: Math.min(...xs),
          right: Math.max(...xs),
          top: Math.min(...ys),
          bottom: Math.max(...ys),
        };
      });
      expect(pieces.length).toBeGreaterThanOrEqual(10);
      for (const piece of pieces) {
        // A screen whose edge leaves only the piece's last half px in view, from each side.
        const edges: Area[] = [
          { left: -far, right: piece.left + 0.5, top: -far, bottom: far },
          { left: piece.right - 0.5, right: far, top: -far, bottom: far },
          { left: -far, right: far, top: -far, bottom: piece.top + 0.5 },
          { left: -far, right: far, top: piece.bottom - 0.5, bottom: far },
        ];
        edges.forEach((area, side) => {
          const { ctx } = recordingContext();
          const kept = marketPainter
            .objects(ctx, { ...scene, visible: within(area) })
            .some((object) => object.depth === piece.depth);
          if (!kept)
            lost.push(
              `${minutes} depth ${piece.depth} ${['left', 'right', 'top', 'bottom'][side]}`,
            );
        });
      }
    }
    expect(lost).toEqual([]);
  });
});
