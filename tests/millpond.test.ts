import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BOAT_HULL,
  BOAT_LOOPS,
  BOAT_MOORINGS,
  BOAT_SEASON,
  BOAT_STORE,
  BOAT_TIMES,
  FISH_RISE,
  FISHER,
  HERON_ROOST,
  HERON_SCHEDULE,
  ICE_SECRET,
  MILL_SILHOUETTE,
  MILLPOND_GATE,
  MILLPOND_GROUND,
  MILLPOND_JETTY,
  MILLPOND_MILL,
  MILLPOND_PLOTS,
  MILLPOND_REEDS,
  MILLPOND_SEASON,
  MILLPOND_WATER,
  SCENERY_SKATE_LOOPS,
  SHORE_Y,
  SIGHTLINE,
  SKATE_LOOPS,
  SKATING,
  boatsAt,
  fisherAt,
  fishRisesAt,
  heronAt,
  hiddenByMill,
  iceOn,
  iceRim,
  iceSecretAt,
  insideMillpond,
  insideWater,
  isMillpondPlot,
  jettyDistance,
  leafCountAt,
  leafFadeAt,
  lilyFlowersOn,
  lilyPadsOn,
  millpondGroundDay,
  millpondRoute,
  millpondSkatingDay,
  millpondStatusAt,
  mistAt,
  petalCountAt,
  sceneSkatersAt,
  screenShoreDistance,
  shoreDistance,
  sightlineLimit,
  wheelAngleAt,
} from '../src/lib/millpond';
import { CALENDAR_EPOCH_DAY, townCalendarAt } from '../src/lib/town-calendar';
import { townDayAt, townMinutesAt, TOWN_DAY_MS } from '../src/lib/town-time';
import { townSeasonAt, yearDayAt, type TownSeason } from '../src/lib/seasons';
import { HOUSE_PLOTS, venueAt } from '../src/lib/events';
import { placeSchema } from '../src/lib/schema';
import { isRoad, project, STREETLIGHTS, type Point } from '../src/lib/world';
import { riverGlint } from '../src/city/season-ground';

const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
/** The absolute town day of a whole day of the year (0 = Spring 1) in a given year. */
const dayOf = (groundDay: number, year = 3) => CALENDAR_EPOCH_DAY + (year - 1) * 112 + groundDay;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const ellipse = (loop: { x: number; y: number; rx: number; ry: number }, n = 360) =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return { x: loop.x + loop.rx * Math.cos(t), y: loop.y + loop.ry * Math.sin(t) };
  });
const gap = (a: Point[], b: Point[]) =>
  Math.min(...a.map((p) => Math.min(...b.map((q) => distance(p, q)))));
/** The spec's heron range, restated independently of the module. */
const heronRange = (p: Point) => (p.y >= 35.3 && p.x >= 19.4 && p.x <= 22.3) || p.x >= 22.0;
const WHEEL_BAY = { left: 14.85, right: 15.7, top: 34.75, bottom: 35.95 };
const rectDistance = (p: Point, r: typeof WHEEL_BAY) =>
  Math.hypot(Math.max(r.left - p.x, 0, p.x - r.right), Math.max(r.top - p.y, 0, p.y - r.bottom));
const GATE_LANDING = { x: 17.9, y: 36.0 };
const OPEN_DAYS = [5, 20, 30, 40, 55, 61, 70, 80, 86, 107, 111].map((d) => dayOf(d));
/** Distance from a point to the segment a–b. */
const segmentDistance = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return distance(p, { x: a.x + u * dx, y: a.y + u * dy });
};
/** Every leg a skater walks from the south gate: the lane, the shore path, the columns and the crossing. */
const ROUTE_LEGS = SKATE_LOOPS.flatMap((_, seat) => {
  const route = millpondRoute(seat);
  return route.slice(1).map((to, i) => ({ from: route[i], to }));
});
/** Points every 0.05 tiles along every leg. */
const ROUTE_POINTS = ROUTE_LEGS.flatMap(({ from, to }) => {
  const steps = Math.max(1, Math.ceil(distance(from, to) / 0.05));
  return Array.from({ length: steps + 1 }, (_, k) => ({
    x: from.x + ((to.x - from.x) * k) / steps,
    y: from.y + ((to.y - from.y) * k) / steps,
  }));
});
const legGap = (p: Point) =>
  Math.min(...ROUTE_LEGS.map((leg) => segmentDistance(p, leg.from, leg.to)));
/** A hull's four corners (BOAT_HULL in the boat's own frame, turned to its heading). */
const hullCorners = (boat: { position: Point; heading: number }) => {
  const u = { x: Math.cos(boat.heading), y: Math.sin(boat.heading) };
  return [
    [BOAT_HULL.bow, BOAT_HULL.beam],
    [BOAT_HULL.bow, -BOAT_HULL.beam],
    [BOAT_HULL.stern, -BOAT_HULL.beam],
    [BOAT_HULL.stern, BOAT_HULL.beam],
  ].map(([a, b]) => ({
    x: boat.position.x + u.x * a - u.y * b,
    y: boat.position.y + u.y * a + u.x * b,
  }));
};
/** The widest gap between two convex quads along any of their edge normals (< 0: they overlap). */
const separation = (A: Point[], B: Point[]) => {
  let best = -Infinity;
  for (const quad of [A, B])
    quad.forEach((a, i) => {
      const b = quad[(i + 1) % quad.length];
      const n = { x: a.y - b.y, y: b.x - a.x };
      const length = Math.hypot(n.x, n.y);
      const along = (q: Point[]) => q.map((p) => (p.x * n.x + p.y * n.y) / length);
      const pa = along(A),
        pb = along(B);
      best = Math.max(best, Math.min(...pb) - Math.max(...pa), Math.min(...pa) - Math.max(...pb));
    });
  return best;
};

describe('The Millpond site', () => {
  it('reserves exactly H3–I6 and leaves 143 house plots', () => {
    expect([...MILLPOND_PLOTS].sort()).toEqual(['H3', 'H4', 'H5', 'H6', 'I3', 'I4', 'I5', 'I6']);
    expect(HOUSE_PLOTS).toHaveLength(143);
    expect(MILLPOND_GROUND).toEqual({ left: 10, right: 25, top: 30, bottom: 37 });
    for (const plot of MILLPOND_PLOTS) {
      expect(isMillpondPlot(plot)).toBe(true);
      expect(venueAt(plot)).toBeUndefined();
      expect(HOUSE_PLOTS.some((p) => p.id === plot)).toBe(false);
      expect(placeSchema.safeParse({ ...sample, plot }).success).toBe(false);
    }
    for (const plot of ['H2', 'H7', 'I2', 'I7', 'J3', 'J6', 'G2']) {
      expect(isMillpondPlot(plot)).toBe(false);
      expect(placeSchema.safeParse({ ...sample, plot }).success).toBe(true);
    }
    for (const file of readdirSync('places').filter((f) => f.endsWith('.json')))
      expect(MILLPOND_PLOTS).not.toContain(JSON.parse(readFileSync(`places/${file}`, 'utf8')).plot);
    // Half-open, like the layout's own site test: the perimeter roads stay outside.
    expect(insideMillpond({ x: 10, y: 30 })).toBe(true);
    expect(insideMillpond({ x: 24.99, y: 36.99 })).toBe(true);
    expect(insideMillpond({ x: 25, y: 33 })).toBe(false);
    expect(insideMillpond({ x: 17.5, y: 37 })).toBe(false);
  });

  it('removes the interior roads, keeps the perimeter and all its lamps', () => {
    for (let x = 10; x < 25; x++) for (let y = 30; y < 37; y++) expect(isRoad(x, y)).toBe(false);
    for (let x = 9; x <= 25; x++) {
      expect(isRoad(x, 29)).toBe(true);
      expect(isRoad(x, 37)).toBe(true);
    }
    for (let y = 29; y <= 37; y++) {
      expect(isRoad(9, y)).toBe(true);
      expect(isRoad(25, y)).toBe(true);
    }
    expect(isRoad(Math.floor(MILLPOND_GATE.x), Math.floor(MILLPOND_GATE.y))).toBe(true);
    expect(STREETLIGHTS.some((p) => insideMillpond({ x: p.x + 0.5, y: p.y + 0.5 }))).toBe(false);
    // The two lamps whose reflections land on the water are still standing.
    expect(STREETLIGHTS.some((p) => p.x === 17 && p.y === 29)).toBe(true);
    expect(STREETLIGHTS.some((p) => p.x === 9 && p.y === 33)).toBe(true);
  });

  it('keeps one simple, clockwise water outline well inside the ground', () => {
    const n = MILLPOND_WATER.length;
    const edges = MILLPOND_WATER.map((a, i) => [a, MILLPOND_WATER[(i + 1) % n]] as const);
    const cross = (o: Point, a: Point, b: Point) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    for (let i = 0; i < n; i++)
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const [a, b] = edges[i],
          [c, d] = edges[j];
        const crosses =
          Math.sign(cross(a, b, c)) !== Math.sign(cross(a, b, d)) &&
          Math.sign(cross(c, d, a)) !== Math.sign(cross(c, d, b));
        expect(crosses).toBe(false);
      }
    // Shoelace with y down: positive is clockwise on screen (the iso map keeps orientation).
    const area = edges.reduce((sum, [a, b]) => sum + (a.x * b.y - b.x * a.y), 0) / 2;
    expect(area).toBeCloseTo(69.7, 1);
    for (const p of MILLPOND_WATER) {
      expect(p.x - MILLPOND_GROUND.left).toBeGreaterThanOrEqual(0.15 - 1e-9);
      expect(MILLPOND_GROUND.right - p.x).toBeGreaterThanOrEqual(0.15 - 1e-9);
      expect(p.y - MILLPOND_GROUND.top).toBeGreaterThanOrEqual(0.15 - 1e-9);
      expect(MILLPOND_GROUND.bottom - p.y).toBeGreaterThanOrEqual(0.6 - 1e-9);
    }
    // The N (17,29) and W (9,33) lamp heads mirror onto open water.
    expect(shoreDistance({ x: 18.289, y: 30.289 })).toBeGreaterThan(0.12);
    expect(shoreDistance({ x: 10.289, y: 34.289 })).toBeGreaterThan(0.12);
    expect(insideWater({ x: 17.5, y: 33.5 })).toBe(true);
    expect(shoreDistance({ x: 17.5, y: 33.5 })).toBeGreaterThan(1);
    expect(shoreDistance({ x: 17.5, y: 36.8 })).toBeLessThan(0);
  });

  it('puts the mill on a dry bank with its wheel in the bay, the path south of it, the jetty in the water', () => {
    const { left, right, top, bottom, wheel, door } = MILLPOND_MILL;
    for (const x of [left, (left + right) / 2, right])
      for (const y of [top, (top + bottom) / 2, bottom])
        expect(shoreDistance({ x, y })).toBeLessThan(0);
    expect(bottom).toBeLessThan(SHORE_Y);
    expect(shoreDistance(wheel)).toBeGreaterThan(0.05);
    expect(door.from).toBeGreaterThanOrEqual(top);
    expect(door.to).toBeLessThanOrEqual(bottom);
    expect(insideWater({ x: MILLPOND_JETTY.x, y: MILLPOND_JETTY.to + 0.05 })).toBe(true);
    expect(shoreDistance({ x: MILLPOND_JETTY.x, y: MILLPOND_JETTY.from })).toBeLessThan(0.1);
    expect(insideMillpond({ x: MILLPOND_GATE.x, y: SHORE_Y })).toBe(true);
    expect(insideWater({ x: MILLPOND_GATE.x, y: SHORE_Y })).toBe(false);
    for (let x = 12.3; x <= 23.0; x += 0.05) expect(insideWater({ x, y: SHORE_Y })).toBe(false);
  });
});

describe('Keeping the football in view (analytic)', () => {
  it('keeps every skater, boat and heron under the north and west lines', () => {
    // Painted extents, rounded up (recorded with matrixContext; the render test re-records them):
    // a resident skater at scale 1.25 with a hat, arms out and leaning, ±15.75 px and 33 px up.
    for (const loop of [...SKATE_LOOPS, ...SCENERY_SKATE_LOOPS])
      for (const p of ellipse(loop)) expect(sightlineLimit(p, 16)).toBeGreaterThanOrEqual(33);
    // A walker on the way in: ±8.75 px, 32.5 px up.
    for (const p of ROUTE_POINTS) expect(sightlineLimit(p, 9)).toBeGreaterThanOrEqual(33);
    // A boat with its rower: −37.8…+39.2 px wide, 30 px up.
    for (const loop of BOAT_LOOPS)
      for (const p of ellipse(loop)) expect(sightlineLimit(p, 40)).toBeGreaterThanOrEqual(30);
    for (const p of [...BOAT_MOORINGS, ...BOAT_STORE])
      expect(sightlineLimit(p, 40)).toBeGreaterThanOrEqual(30);
    // The heron with its neck raised: −19.5…+20.3 px, 31.2 px up.
    for (let x = 19.4; x <= 24.4; x += 0.1)
      for (let y = 30.2; y <= 36.4; y += 0.1)
        if (heronRange({ x, y }) && insideWater({ x, y }))
          expect(sightlineLimit({ x, y }, 21)).toBeGreaterThanOrEqual(32);
    expect(sightlineLimit({ x: 20, y: 30 })).toBe(38);
    expect(sightlineLimit({ x: 10, y: 35 }, 10)).toBe(33);
  });

  it('lets only the mill rise above 40 px, and keeps it left of the football frame', () => {
    expect(SIGHTLINE).toEqual({ northY: 29, westX: 9, frameX: -770, frameHeight: 40 });
    for (const reed of MILLPOND_REEDS) expect(reed.size).toBeLessThanOrEqual(SIGHTLINE.frameHeight);
    for (const p of MILL_SILHOUETTE) {
      expect(p.x).toBeGreaterThanOrEqual(-900);
      expect(p.x).toBeLessThanOrEqual(SIGHTLINE.frameX);
      // Rule 1 (north line) and rule 2 (west line) in world px.
      expect(p.y).toBeGreaterThanOrEqual(1102 + p.x / 2);
      expect(p.y).toBeGreaterThanOrEqual(342 - p.x / 2);
    }
    // The ridge at its full height, plus the outline's 2 px margin.
    expect(Math.min(...MILL_SILHOUETTE.map((p) => p.y))).toBeCloseTo(
      project(MILLPOND_MILL.left, (MILLPOND_MILL.top + MILLPOND_MILL.bottom) / 2).y -
        MILLPOND_MILL.height -
        2,
    );
    // The W lamp head (sx −911) and its reflection stay clear of the mill.
    expect(Math.min(...MILL_SILHOUETTE.map((p) => p.x))).toBeGreaterThan(-900);
  });

  it('keeps reeds low on the north bank and out of every path, column, bay and reflection', () => {
    expect(MILLPOND_REEDS.length).toBeGreaterThanOrEqual(10);
    expect(MILLPOND_REEDS.length).toBeLessThanOrEqual(14);
    expect(new Set(MILLPOND_REEDS.map((r) => r.seed)).size).toBe(MILLPOND_REEDS.length);
    const allLoops = [...SKATE_LOOPS, ...SCENERY_SKATE_LOOPS].map((l) => ellipse(l, 180));
    const boatLoops = BOAT_LOOPS.map((l) => ellipse(l, 180));
    for (const reed of MILLPOND_REEDS) {
      expect(insideMillpond(reed)).toBe(true);
      expect(Math.abs(shoreDistance(reed))).toBeLessThan(0.3);
      expect(reed.y).toBeGreaterThanOrEqual(30.35);
      expect(reed.size).toBeLessThanOrEqual(20);
      expect(reed.size).toBeLessThanOrEqual(38 * (reed.y - 29.6));
      expect(reed.size).toBeLessThanOrEqual(sightlineLimit(reed, 8));
      if (reed.y < 31.6) {
        // The north bank: never under the fans, the N lamp's column or the goal confetti.
        expect(reed.x <= 11.5 || reed.x >= 20.5).toBe(true);
        expect(reed.size).toBeLessThanOrEqual(14);
      }
      expect(reed.x < 17.2 - 0.3 || reed.x > 17.8 + 0.3).toBe(true);
      expect(legGap(reed)).toBeGreaterThan(0.3);
      expect(jettyDistance(reed)).toBeGreaterThan(0.3);
      expect(rectDistance(reed, WHEEL_BAY)).toBeGreaterThan(0.3);
      for (const spot of [
        { x: 18.289, y: 30.289 },
        { x: 10.289, y: 34.289 },
      ])
        expect(distance(reed, spot)).toBeGreaterThan(0.6);
      expect(Math.abs(reed.y - SHORE_Y) > 0.3 || reed.x < 12.3).toBe(true);
      expect(hiddenByMill(reed)).toBe(false);
      for (const loop of allLoops) expect(gap([reed], loop)).toBeGreaterThanOrEqual(0.3);
      for (const loop of boatLoops) expect(gap([reed], loop)).toBeGreaterThanOrEqual(0.4);
    }
    // Thick in the heron's east cove.
    expect(MILLPOND_REEDS.filter((r) => r.x >= 22.5 && r.y >= 33.3).length).toBeGreaterThanOrEqual(
      4,
    );
    expect(Math.min(...MILLPOND_REEDS.map((r) => distance(r, HERON_ROOST)))).toBeLessThan(0.5);
  });
});

describe('Skate loops', () => {
  it('keeps the six resident loops on the ice, apart, and clear of the jetty and the mill', () => {
    expect(SKATE_LOOPS).toHaveLength(6);
    const rings = SKATE_LOOPS.map((l) => ellipse(l));
    rings.forEach((ring, i) => {
      for (const p of ring) {
        expect(shoreDistance(p)).toBeGreaterThanOrEqual(0.6);
        expect(jettyDistance(p)).toBeGreaterThanOrEqual(0.25);
        expect(hiddenByMill(p)).toBe(false);
      }
      for (let j = i + 1; j < rings.length; j++)
        expect(gap(ring, rings[j])).toBeGreaterThanOrEqual(0.9);
    });
    // Every leg in (the columns and the crossing to the mill-side loop) crosses no mill wall and,
    // but for the column that runs out along the jetty, keeps off the deck.
    for (const p of ROUTE_POINTS) {
      expect(
        p.x < MILLPOND_MILL.left ||
          p.x > MILLPOND_MILL.right ||
          p.y < MILLPOND_MILL.top ||
          p.y > MILLPOND_MILL.bottom,
      ).toBe(true);
      if (p.x !== SKATE_LOOPS[2].x) expect(jettyDistance(p)).toBeGreaterThan(0.2);
    }
  });

  it('fits two scenery loops in free ice, 0.9 from every resident loop and clear of the columns', () => {
    expect(SCENERY_SKATE_LOOPS).toHaveLength(2);
    const residents = SKATE_LOOPS.map((l) => ellipse(l));
    const rings = SCENERY_SKATE_LOOPS.map((l) => ellipse(l));
    for (const ring of rings) {
      for (const resident of residents) expect(gap(ring, resident)).toBeGreaterThanOrEqual(0.9);
      for (const p of ring) {
        expect(shoreDistance(p)).toBeGreaterThanOrEqual(0.3);
        expect(jettyDistance(p)).toBeGreaterThanOrEqual(0.3);
        expect(hiddenByMill(p)).toBe(false);
        expect(legGap(p)).toBeGreaterThan(0.3);
      }
    }
    expect(gap(rings[0], rings[1])).toBeGreaterThanOrEqual(0.9);
  });

  it('freezes with the river, tile for tile, and skates only on the frozen days', () => {
    const seeds = Array.from({ length: 600 }, (_, i) => i * 7 + 3);
    for (let groundDay = 0; groundDay < 112; groundDay++) {
      const season = { groundDay } as TownSeason;
      const iced = seeds.filter((seed) => riverGlint('#000000', false, season, seed) !== '#000000');
      const { stage, cover } = iceOn(groundDay);
      if (stage === 'open') expect(iced).toHaveLength(0);
      else if (stage === 'frozen') expect(iced).toHaveLength(seeds.length);
      else {
        expect(iced.length).toBeGreaterThan(0);
        expect(iced.length).toBeLessThan(seeds.length);
        expect(cover).toBeGreaterThan(0);
        expect(cover).toBeLessThan(1);
      }
    }
    for (let day = -120; day < 240; day++) {
      const groundDay = townSeasonAt(day, 720).groundDay;
      expect(millpondGroundDay(720, day)).toBe(groundDay);
      expect(millpondGroundDay(0, day)).toBe(groundDay);
      expect(millpondGroundDay(1439.999, day)).toBe(groundDay);
      expect(millpondSkatingDay(day)).toBe(iceOn(groundDay).stage === 'frozen');
      expect(millpondSkatingDay(day)).toBe(groundDay >= 92 && groundDay <= 102);
    }
    for (let day = 76; day <= 86; day++) expect(millpondSkatingDay(day)).toBe(true);
    for (const day of [75, 87, 70, 20, 0]) expect(millpondSkatingDay(day)).toBe(false);
    expect(SKATING).toEqual({ depart: 780, start: 840, end: 1000, homeBy: 1070 });
  });

  it('turns the waterwheel once every six minutes on open water and stills it on the ice', () => {
    const day = dayOf(40);
    expect(wheelAngleAt(0, day)).toBeCloseTo(0);
    expect(wheelAngleAt(1.5, day)).toBeCloseTo(Math.PI / 2);
    expect(wheelAngleAt(6, day)).toBeCloseTo(0);
    for (let d = 87; d <= 106; d++) expect(wheelAngleAt(720, dayOf(d))).toBeNull();
    expect(wheelAngleAt(720, dayOf(107))).not.toBeNull();
  });
});

describe('The grey heron', () => {
  it('is away only on frozen days, fading at its roost across the midnights the ice sets and breaks', () => {
    for (let groundDay = 0; groundDay < 112; groundDay++) {
      const heron = heronAt(720, dayOf(groundDay));
      expect(heron === null).toBe(iceOn(groundDay).stage === 'frozen');
    }
    // It stays through the freezing days (87–91) and comes back for the thaw (103–106).
    const lastHome = dayOf(91),
      firstHome = dayOf(103);
    expect(iceOn(91).stage).toBe('freezing');
    expect(iceOn(92).stage).toBe('frozen');
    expect(iceOn(102).stage).toBe('frozen');
    expect(iceOn(103).stage).toBe('thawing');
    expect(heronAt(1429.9, lastHome)?.opacity).toBe(1);
    expect(heronAt(1440, lastHome)?.opacity).toBeCloseTo(0.5);
    expect(heronAt(0, lastHome + 1)?.opacity).toBeCloseTo(0.5);
    expect(heronAt(9.99, lastHome + 1)!.opacity).toBeLessThan(0.001);
    expect(heronAt(10, lastHome + 1)).toBeNull();
    expect(heronAt(1430, firstHome - 1)).toBeNull();
    expect(heronAt(1430.01, firstHome - 1)!.opacity).toBeLessThan(0.001);
    expect(heronAt(0, firstHome)?.opacity).toBeCloseTo(0.5);
    expect(heronAt(10, firstHome)?.opacity).toBe(1);
    // No fade where the ice only starts to form or finishes melting.
    for (const [day, t] of [
      [dayOf(86), 1439.9],
      [dayOf(87), 0.1],
      [dayOf(106), 1439.9],
      [dayOf(107), 0.1],
    ])
      expect(heronAt(t, day)?.opacity).toBe(1);
    for (const [day, from, to] of [
      [lastHome, 1420, 1440],
      [lastHome + 1, 0, 10],
      [firstHome - 1, 1430, 1440],
      [firstHome, 0, 20],
    ])
      for (let t = from; t < to; t += 0.25) {
        const heron = heronAt(t, day);
        if (!heron) continue;
        if (heron.opacity < 1) {
          expect(heron.pose).toBe('sleep');
          expect(heron.position).toEqual(HERON_ROOST);
        }
      }
  });

  it(
    'only rests in the east cove on freezing and thawing days: on the ice edge, then past the thin rim',
    { timeout: 20_000 },
    () => {
      for (const groundDay of [87, 88, 89, 90, 91, 103, 104, 105, 106]) {
        const day = dayOf(groundDay);
        const freezing = iceOn(groundDay).stage === 'freezing';
        const rim = iceRim(groundDay);
        let rested = 0;
        for (let t = 0; t < 1440; t += 0.5) {
          const heron = heronAt(t, day)!;
          expect(['sleep', 'walk', 'stand', 'preen']).toContain(heron.pose);
          expect(heron.fish).toBe(false);
          // Fading only at the roost, across the midnights into and out of the frozen days.
          if (heron.opacity < 1) {
            expect([91, 103]).toContain(groundDay);
            expect(heron.pose).toBe('sleep');
          }
          const p = heron.position;
          expect(p.x).toBeGreaterThanOrEqual(22.0);
          expect(distance(p, HERON_ROOST)).toBeLessThan(1.5);
          expect(heronRange(p) || distance(p, HERON_ROOST) < 1e-9).toBe(true);
          expect(sightlineLimit(p, 21)).toBeGreaterThanOrEqual(32);
          const status = millpondStatusAt(t, day);
          expect(status.heron).toBe(heron.pose === 'sleep' ? 'asleep' : 'resting');
          expect(status.heronWalking !== undefined).toBe(heron.pose === 'walk');
          if (heron.pose !== 'stand' && heron.pose !== 'preen') continue;
          rested++;
          if (freezing) {
            // Standing on the forming ice, a few px in from its edge: dry feet.
            expect(screenShoreDistance(p)).toBeLessThanOrEqual(rim);
            expect(heron.wade).toBe(0);
            expect(heron.wading).toBe(false);
          } else {
            // In the first open shallows past the rim of ice that is left.
            expect(screenShoreDistance(p)).toBeGreaterThanOrEqual(rim + 10);
            expect(heron.wade).toBeGreaterThan(0.95);
            expect(heron.wading).toBe(true);
          }
        }
        expect(rested).toBeGreaterThan(1500);
        // No hunting and no fish while the pond is part ice.
        expect(fishRisesAt(1170, day)).toEqual([]);
      }
    },
  );

  it(
    'keeps to its shallows, clear of the jetty, the boats, the wheel bay and the landing',
    { timeout: 20_000 },
    () => {
      for (const day of OPEN_DAYS)
        for (let t = 300; t <= 1320; t += 0.5) {
          const heron = heronAt(t, day)!;
          const p = heron.position;
          const roost = distance(p, HERON_ROOST);
          expect(heronRange(p) || roost < 1e-9).toBe(true);
          expect(shoreDistance(p) >= 0.15 || roost <= 0.5).toBe(true);
          expect(jettyDistance(p)).toBeGreaterThan(0.6);
          expect(rectDistance(p, WHEEL_BAY)).toBeGreaterThan(0.6);
          expect(distance(p, GATE_LANDING)).toBeGreaterThan(0.6);
          for (const berth of BOAT_MOORINGS) expect(distance(p, berth)).toBeGreaterThan(0.6);
          for (const boat of boatsAt(t, day))
            if (boat.state !== 'stored') expect(distance(p, boat.position)).toBeGreaterThan(0.6);
          expect(sightlineLimit(p, 12)).toBeGreaterThanOrEqual(32);
          expect(hiddenByMill(p)).toBe(false);
          expect(heron.wading).toBe(shoreDistance(p) > 0.12);
          expect(heron.wading).toBe(heron.wade > 0.5);
        }
    },
  );

  it(
    'sleeps, walks out, hunts twice a day with 3–5 strikes, and stalks no faster than 0.05 tiles a minute',
    { timeout: 20_000 },
    () => {
      let strikes = 0,
        catches = 0;
      for (let k = 0; k < 24; k++) {
        const day = dayOf((k * 7) % 84) + 112 * (k % 3);
        expect(heronAt(1300, day)?.pose).toBe('sleep');
        expect(heronAt(300, day)?.pose).toBe('sleep');
        expect(heronAt(345, day)?.pose).toBe('walk');
        expect(heronAt(1275, day)?.pose).toBe('walk');
        for (const hunt of HERON_SCHEDULE.hunts) {
          let count = 0,
            previous = heronAt(hunt.from, day)!;
          for (let i = 1; i < (hunt.to - hunt.from) / 0.1; i++) {
            const heron = heronAt(hunt.from + i * 0.1, day)!;
            expect(['stalk', 'freeze', 'strike', 'swallow', 'stand']).toContain(heron.pose);
            if (heron.pose === 'strike' && previous.pose !== 'strike') count++;
            if (heron.pose === 'swallow' && previous.pose !== 'swallow') catches++;
            if (heron.pose === 'stalk' && previous.pose === 'stalk')
              expect(distance(heron.position, previous.position) / 0.1).toBeLessThanOrEqual(0.05);
            if (heron.pose !== 'stalk')
              expect(distance(heron.position, previous.position)).toBeLessThan(0.05 * 0.1 + 1e-9);
            expect(heron.fish).toBe(heron.pose === 'swallow');
            previous = heron;
          }
          expect(count).toBeGreaterThanOrEqual(3);
          expect(count).toBeLessThanOrEqual(5);
          strikes += count;
        }
        for (const t of [500, 800, 1200])
          expect(['stand', 'preen']).toContain(heronAt(t, day)!.pose);
      }
      // About two strikes in five end with a silver fish.
      expect(catches / strikes).toBeGreaterThan(0.25);
      expect(catches / strikes).toBeLessThan(0.55);
      expect(heronAt(400.3, dayOf(30))).toEqual(heronAt(400.3, dayOf(30)));
    },
  );

  it('moves continuously across midnight and every schedule edge', { timeout: 20_000 }, () => {
    const edges = [
      0, 10, 330, 360, 480, 492, 700, 712, 948, 960, 1110, 1122, 1260, 1290, 1430, 1440,
    ];
    for (const day of [
      ...OPEN_DAYS.filter((_, i) => i % 2 === 0),
      dayOf(86),
      dayOf(88),
      dayOf(91),
      dayOf(92),
      dayOf(102),
      dayOf(103),
      dayOf(106),
      dayOf(107),
    ]) {
      for (const edge of edges) {
        const before = heronAt(edge - 0.001, day),
          after = heronAt(edge + 0.001, day);
        if (before && after) {
          expect(distance(before.position, after.position)).toBeLessThan(0.001);
          expect(Math.abs(before.opacity - after.opacity)).toBeLessThan(0.001);
        }
      }
      for (let t = 0; t < 1440; t += 0.25) {
        const now = heronAt(t, day),
          next = heronAt(t + 0.001, day);
        if (!now || !next) continue;
        expect(distance(now.position, next.position)).toBeLessThanOrEqual(0.0005);
        expect(Math.abs(now.opacity - next.opacity)).toBeLessThan(0.001);
        expect(Math.abs(now.look - next.look)).toBeLessThan(0.02);
        // Wading in and out is gradual: the sprite never pops down or up.
        expect(Math.abs(now.wade - next.wade)).toBeLessThan(0.01);
      }
    }
  });

  it('turns its head only toward a fish leaping within two tiles', () => {
    let looks = 0;
    for (const day of OPEN_DAYS.slice(0, 5))
      for (let t = 360; t < 1290; t += 0.2) {
        const heron = heronAt(t, day)!;
        const near = fishRisesAt(t, day).filter(
          (rise) => rise.leap && distance(rise.position, heron.position) <= 2,
        );
        expect(Math.abs(heron.look)).toBeLessThanOrEqual(1);
        if (heron.look !== 0) {
          looks++;
          expect(near.length).toBeGreaterThan(0);
        }
        if (near.length === 0) expect(heron.look).toBe(0);
      }
    expect(looks).toBeGreaterThan(0);
    expect(heronAt(100, dayOf(30))!.look).toBe(0);
  });
});

describe('Rising fish', () => {
  it(
    'rise only on open water between 06:00 and 23:00, busiest at dusk, a third of them leaps',
    { timeout: 20_000 },
    () => {
      let day = 0,
        dusk = 0,
        rises = 0,
        leaps = 0;
      for (const d of OPEN_DAYS) {
        for (const t of [0, 200, 359.9, 1381.3, 1439]) expect(fishRisesAt(t, d)).toEqual([]);
        const seen = new Map<number, boolean>();
        for (let t = 360; t < 1382; t += 0.2)
          for (const rise of fishRisesAt(t, d)) seen.set(rise.id, rise.leap);
        for (const [id, leap] of seen) {
          const time = id - d * 1440;
          rises++;
          if (leap) leaps++;
          if (leap) expect(time).toBeLessThan(FISH_RISE.leaps);
          if (time >= 600 && time < 720) day++;
          if (time >= 1110 && time < 1230) dusk++;
        }
      }
      expect(dusk).toBeGreaterThan(day * 2.5);
      // 18:30–20:30: about one rise every half minute.
      expect(dusk / OPEN_DAYS.length / 120).toBeGreaterThan(1.7);
      expect(dusk / OPEN_DAYS.length / 120).toBeLessThan(2.2);
      expect(leaps / rises).toBeGreaterThan(0.25);
      expect(leaps / rises).toBeLessThan(0.42);
      for (let groundDay = 87; groundDay <= 106; groundDay++)
        for (const t of [400, 900, 1170, 1300])
          expect(fishRisesAt(t, dayOf(groundDay))).toEqual([]);
    },
  );

  it(
    'keep off the shallows, the jetty, the boats, the heron and the mill',
    { timeout: 20_000 },
    () => {
      for (const day of OPEN_DAYS)
        for (let t = 360; t < 1382; t += 0.37)
          for (const rise of fishRisesAt(t, day)) {
            const p = rise.position;
            expect(shoreDistance(p)).toBeGreaterThanOrEqual(0.5);
            expect(p.y).toBeGreaterThanOrEqual(31);
            expect(jettyDistance(p)).toBeGreaterThanOrEqual(0.5);
            expect(hiddenByMill(p)).toBe(false);
            expect(distance(p, heronAt(t, day)!.position)).toBeGreaterThanOrEqual(0.5);
            for (const boat of boatsAt(t, day))
              expect(distance(p, boat.position)).toBeGreaterThanOrEqual(0.5);
            expect(rise.progress).toBeGreaterThanOrEqual(0);
            expect(rise.progress).toBeLessThan(1);
          }
    },
  );

  it('keeps two or three rings on the water at dusk, and lands every leap 8 px to its side', () => {
    let rings = 0,
      samples = 0,
      most = 0,
      landings = 0;
    for (const day of OPEN_DAYS)
      for (let t = FISH_RISE.dusk; t < FISH_RISE.night; t += 0.1) {
        const now = fishRisesAt(t, day);
        rings += now.length;
        samples++;
        most = Math.max(most, now.length);
        for (const rise of now) {
          expect(Math.abs(rise.side)).toBe(1);
          const s = project(rise.position.x, rise.position.y),
            l = project(rise.landing.x, rise.landing.y);
          // Along the rise's own screen row, 8 world px to its side, and into open water.
          expect(l.y).toBeCloseTo(s.y, 6);
          expect(l.x - s.x).toBeCloseTo(8 * rise.side, 6);
          if (!rise.leap) continue;
          landings++;
          expect(shoreDistance(rise.landing)).toBeGreaterThanOrEqual(0.3);
          expect(jettyDistance(rise.landing)).toBeGreaterThan(0.3);
          expect(hiddenByMill(rise.landing)).toBe(false);
        }
      }
    expect(rings / samples).toBeGreaterThanOrEqual(2);
    expect(rings / samples).toBeLessThanOrEqual(3);
    expect(most).toBeLessThanOrEqual(4);
    expect(landings).toBeGreaterThan(0);
  });

  it('lets each rise last 1.2 minutes in one place under one id', () => {
    const day = dayOf(40);
    const rise = fishRisesAt(1150, day)[0];
    expect(rise).toBeDefined();
    const start = day * 1440 + 1150 - rise.progress * FISH_RISE.lasts;
    for (let dt = 0; dt < FISH_RISE.lasts; dt += 0.1) {
      const again = fishRisesAt(start + dt - day * 1440, day).find((r) => r.id === rise.id)!;
      expect(again.position).toEqual(rise.position);
      expect(again.leap).toBe(rise.leap);
      expect(again.progress).toBeCloseTo(dt / FISH_RISE.lasts, 6);
    }
    expect(
      fishRisesAt(start + FISH_RISE.lasts - day * 1440, day).some((r) => r.id === rise.id),
    ).toBe(false);
  });
});

describe('Rowboats', () => {
  it('are stored off-season, moored from Spring 10, and out on summer days 08:30–18:30', () => {
    for (let groundDay = 0; groundDay < 112; groundDay++) {
      const day = dayOf(groundDay);
      const stored = groundDay >= BOAT_SEASON.stored || groundDay < BOAT_SEASON.moored;
      const rowing = groundDay >= 28 && groundDay <= 61;
      for (const t of [300, 505, 530, 900, 1105, 1115, 1300]) {
        const boats = boatsAt(t, day);
        expect(boats.map((b) => b.id)).toEqual([0, 1]);
        boats.forEach((boat, id) => {
          const out = rowing && t >= BOAT_TIMES[id].out && t < BOAT_TIMES[id].back;
          expect(boat.state).toBe(stored ? 'stored' : out ? 'out' : 'moored');
          if (boat.state !== 'out') {
            expect(boat.rowerOpacity).toBe(0);
            expect(boat.oar).toBe(0);
          }
          expect(boat.rower).toBe(boat.rowerOpacity > 0);
          expect(boat.opacity).toBe(1);
        });
      }
    }
    for (const { out, back } of BOAT_TIMES) {
      expect(out).toBeGreaterThanOrEqual(510);
      expect(back).toBeLessThanOrEqual(1110);
    }
  });

  it('row loops on open water, clear of the jetty and the heron, and store on the west bank', () => {
    for (const loop of BOAT_LOOPS)
      for (const p of ellipse(loop)) {
        expect(p.y).toBeGreaterThanOrEqual(31.3);
        expect(shoreDistance(p)).toBeGreaterThanOrEqual(0.4);
        expect(jettyDistance(p)).toBeGreaterThan(0.5);
        expect(heronRange(p)).toBe(false);
        expect(hiddenByMill(p)).toBe(false);
      }
    for (const berth of BOAT_MOORINGS) {
      expect(insideWater(berth)).toBe(true);
      expect(jettyDistance(berth)).toBeGreaterThanOrEqual(0.29);
      expect(berth.x).toBeGreaterThan(MILLPOND_JETTY.x);
    }
    // A tidy, square pair on the west bank beside the mill, clear of every leg a skater walks.
    expect(BOAT_STORE).toEqual([
      { x: 10.95, y: 35.7, heading: 0 },
      { x: 11.05, y: 36.25, heading: 0.08 },
    ]);
    for (const store of BOAT_STORE) {
      expect(insideMillpond(store)).toBe(true);
      expect(shoreDistance(store)).toBeLessThan(-0.5);
      expect(store.x).toBeLessThan(MILLPOND_MILL.left);
      for (const corner of hullCorners({ position: store, heading: store.heading })) {
        expect(insideWater(corner)).toBe(false);
        expect(legGap(corner)).toBeGreaterThan(0.3);
      }
    }
    const [first, second] = BOAT_STORE.map((store) =>
      hullCorners({ position: store, heading: store.heading }),
    );
    expect(separation(first, second)).toBeGreaterThan(0.1);
    for (const day of [dayOf(10), dayOf(40), dayOf(80), dayOf(0)])
      for (let t = 0; t < 1440; t += 0.5)
        for (const boat of boatsAt(t, day)) {
          if (boat.state === 'stored') {
            expect(insideWater(boat.position)).toBe(false);
            expect(insideMillpond(boat.position)).toBe(true);
          } else {
            expect(shoreDistance(boat.position)).toBeGreaterThanOrEqual(0.2);
            expect(jettyDistance(boat.position)).toBeGreaterThanOrEqual(0.25);
            expect(sightlineLimit(boat.position, 24)).toBeGreaterThanOrEqual(24);
          }
        }
  });

  it('never touch hulls: backing out stern first, rowing, coming home or tied up', () => {
    let closest = Infinity;
    for (const groundDay of [BOAT_SEASON.out, 40, BOAT_SEASON.lastOut])
      for (let t = 480; t < 1140; t += 0.02) {
        const [a, b] = boatsAt(t, dayOf(groundDay));
        closest = Math.min(closest, separation(hullCorners(a), hullCorners(b)));
      }
    expect(closest).toBeGreaterThan(0.1);
    // Push-off: the first minutes move the boat straight back along the jetty, bow still to the shore.
    for (const [id, { out }] of BOAT_TIMES.entries())
      for (let t = out; t < out + 2.4; t += 0.1) {
        const boat = boatsAt(t, dayOf(40))[id];
        expect(boat.heading).toBeCloseTo(Math.PI / 2, 9);
        expect(boat.position.x).toBeCloseTo(BOAT_MOORINGS[id].x, 9);
        expect(boat.position.y).toBeLessThanOrEqual(BOAT_MOORINGS[id].y);
      }
  });

  it(
    'glide continuously and fade out and back in at the midnights they are put away',
    { timeout: 20_000 },
    () => {
      const turn = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
      const pairs: [number, number][] = [];
      for (const groundDay of [30, 45, 61])
        for (let t = 500; t < 1120; t += groundDay === 45 ? 0.1 : 0.5)
          pairs.push([dayOf(groundDay), t]);
      for (const groundDay of [8, 9, 75, 76])
        for (let t = 1400; t < 1480; t += 0.05) pairs.push([dayOf(groundDay), t]);
      for (const { out, back } of BOAT_TIMES)
        for (const edge of [out, out + 4, out + 10, back - 10, back - 4, back])
          pairs.push([dayOf(40), edge - 0.0005]);
      for (const [day, t] of pairs) {
        const now = boatsAt(t, day),
          next = boatsAt(t + 0.001, day);
        now.forEach((boat, id) => {
          const after = next[id];
          expect(Math.abs(boat.opacity - after.opacity)).toBeLessThan(0.001);
          expect(Math.abs(boat.rowerOpacity - after.rowerOpacity)).toBeLessThan(0.001);
          if (boat.opacity > 0 && after.opacity > 0) {
            expect(distance(boat.position, after.position)).toBeLessThanOrEqual(0.0006);
            expect(turn(boat.heading, after.heading)).toBeLessThan(0.01);
          }
        });
      }
      // Put away and brought back at midnight, invisible at the switch itself.
      for (const groundDay of [BOAT_SEASON.moored, BOAT_SEASON.stored]) {
        const day = dayOf(groundDay);
        expect(boatsAt(0, day).every((b) => b.opacity === 0)).toBe(true);
        expect(boatsAt(-10, day).every((b) => b.opacity === 1)).toBe(true);
        expect(boatsAt(10, day).every((b) => b.opacity === 1)).toBe(true);
        expect(boatsAt(-0.001, day)[0].state).not.toBe(boatsAt(0.001, day)[0].state);
      }
      expect(boatsAt(900, dayOf(40))).toEqual(boatsAt(900, dayOf(40)));
    },
  );
});

describe('The early fisher', () => {
  it(
    'sits at the jetty end 05:30–07:00 on open water, with one bite and a catch one morning in three',
    { timeout: 20_000 },
    () => {
      let landed = 0,
        mornings = 0;
      for (let groundDay = 0; groundDay < 112; groundDay++)
        for (const year of [2, 3, 4, 5, 6]) {
          const day = dayOf(groundDay, year);
          if (iceOn(groundDay).stage !== 'open') {
            for (const t of [340, 375, 410]) expect(fisherAt(t, day)).toBeNull();
            continue;
          }
          mornings++;
          const final = fisherAt(FISHER.to - 0.01, day)!.catch;
          expect([0, 1]).toContain(final);
          if (final === 1) landed++;
          if ((groundDay + year) % 9 !== 0) continue;
          expect(fisherAt(FISHER.from, day)).toBeNull();
          expect(fisherAt(FISHER.to, day)).toBeNull();
          expect(fisherAt(200, day)).toBeNull();
          expect(fisherAt(FISHER.from + 2.5, day)!.opacity).toBeCloseTo(0.5);
          expect(fisherAt(FISHER.from + 5, day)!.opacity).toBe(1);
          let bites = 0,
            lastCatch = 0,
            previous = fisherAt(FISHER.from + 0.01, day)!;
          for (let t = FISHER.from + 0.05; t < FISHER.to; t += 0.05) {
            const fisher = fisherAt(t, day)!;
            expect(jettyDistance(fisher.position)).toBe(0);
            expect(fisher.position.y - MILLPOND_JETTY.to).toBeLessThan(0.3);
            if (fisher.bite > 0.95 && previous.bite <= 0.95) bites++;
            expect(fisher.catch).toBeGreaterThanOrEqual(lastCatch);
            expect(Math.abs(fisher.cast - previous.cast)).toBeLessThan(0.05);
            lastCatch = fisher.catch;
            previous = fisher;
          }
          expect(bites).toBe(1);
          expect(lastCatch).toBe(final);
        }
      expect(landed / mornings).toBeGreaterThan(0.22);
      expect(landed / mornings).toBeLessThan(0.45);
    },
  );
});

describe('Scenery skaters', () => {
  it(
    'skate their loops only on skating days, 14:00–16:40, fading over five minutes',
    { timeout: 20_000 },
    () => {
      for (let groundDay = 0; groundDay < 112; groundDay++) {
        const skaters = sceneSkatersAt(900, dayOf(groundDay));
        expect(skaters.length).toBe(groundDay >= 92 && groundDay <= 102 ? 2 : 0);
      }
      const day = dayOf(95);
      for (const t of [700, SKATING.start, SKATING.end, 1100])
        expect(sceneSkatersAt(t, day)).toEqual([]);
      expect(sceneSkatersAt(SKATING.start + 2.5, day)[0].opacity).toBeCloseTo(0.5);
      expect(sceneSkatersAt(SKATING.start + 5, day)[0].opacity).toBe(1);
      expect(sceneSkatersAt(SKATING.end - 2.5, day)[0].opacity).toBeCloseTo(0.5);
      for (let t = SKATING.start + 0.01; t < SKATING.end - 0.01; t += 0.05) {
        const now = sceneSkatersAt(t, day),
          next = sceneSkatersAt(t + 0.01, day);
        now.forEach((skater, id) => {
          const loop = SCENERY_SKATE_LOOPS[id];
          expect(skater.id).toBe(id);
          expect(
            ((skater.position.x - loop.x) / loop.rx) ** 2 +
              ((skater.position.y - loop.y) / loop.ry) ** 2,
          ).toBeCloseTo(1, 9);
          expect(distance(skater.position, next[id].position) / 0.01).toBeLessThanOrEqual(0.448);
          expect(skater.phase).toBeGreaterThanOrEqual(0);
          expect(skater.phase).toBeLessThan(1);
        });
      }
      expect(new Set(sceneSkatersAt(900, day).map((s) => s.facing)).size).toBeGreaterThan(0);
    },
  );
});

describe('Dawn mist', () => {
  it('rises in a bell over 05:30–07:00, peaking at 06:15, half as thick over the ice', () => {
    const open = dayOf(40),
      iced = dayOf(95);
    for (const t of [0, 330, 420, 720, 1300]) expect(mistAt(t, open)).toBe(0);
    expect(mistAt(375, open)).toBeCloseTo(1);
    expect(mistAt(375, iced)).toBeCloseTo(0.5);
    expect(mistAt(352.5, open)).toBeCloseTo(0.5);
    for (let t = 320; t < 430; t += 0.1) {
      const m = mistAt(t, open);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1);
      expect(Math.abs(mistAt(t + 0.001, open) - m)).toBeLessThan(0.001);
    }
  });
});

describe('Under the winter full moon', () => {
  const at = (iso: string) => {
    const timestamp = Date.parse(iso);
    const minutes = townMinutesAt(timestamp),
      day = townDayAt(timestamp);
    return {
      minutes,
      day,
      secret: iceSecretAt(minutes, day),
      label: townCalendarAt(day, minutes).label,
    };
  };

  it('appears only on Winter 14, 15 and 16 at 03:00–04:30, in any year, when the almanac says full moon', () => {
    for (const year of [-2, 1, 3, 7, 40])
      for (let groundDay = 0; groundDay < 112; groundDay++) {
        const day = dayOf(groundDay, year);
        const secret = iceSecretAt(180, day);
        expect(secret !== null).toBe(groundDay >= 97 && groundDay <= 99);
        const almanac = townCalendarAt(day, 180);
        expect(secret !== null).toBe(
          almanac.seasonIndex === ICE_SECRET.season && almanac.moonName === 'Full moon',
        );
        expect(iceSecretAt(179.999, day)).toBeNull();
        expect(iceSecretAt(270, day)).toBeNull();
        expect(iceSecretAt(1380, day)).toBeNull();
        if (secret) {
          expect(iceOn(groundDay).stage).toBe('frozen');
          expect(ICE_SECRET.dates).toContain(almanac.date);
        }
      }
  });

  it('cracks over four minutes, pulses its glint, and fades over the last eight', () => {
    const day = dayOf(98);
    expect(iceSecretAt(180, day)).toEqual({ crack: 0, glint: 0, opacity: 1, phase: 0 });
    expect(iceSecretAt(182, day)!.crack).toBeCloseTo(0.5);
    expect(iceSecretAt(182, day)!.glint).toBe(0);
    expect(iceSecretAt(184, day)!.crack).toBe(1);
    for (let t = 186; t < 262; t += 0.25) {
      const secret = iceSecretAt(t, day)!;
      expect(secret.glint).toBeGreaterThanOrEqual(0.3 - 1e-9);
      expect(secret.glint).toBeLessThanOrEqual(0.85 + 1e-9);
      expect(secret.opacity).toBe(1);
    }
    expect(iceSecretAt(266, day)!.opacity).toBeCloseTo(0.5);
    expect(iceSecretAt(269.999, day)!.opacity).toBeLessThan(0.001);
    for (let t = 179.5; t < 270.5; t += 0.1) {
      const now = iceSecretAt(t, day),
        next = iceSecretAt(t + 0.001, day);
      if (!now || !next) continue;
      expect(Math.abs(now.crack - next.crack)).toBeLessThan(0.001);
      expect(Math.abs(now.glint - next.glint)).toBeLessThan(0.002);
      expect(Math.abs(now.opacity - next.opacity)).toBeLessThan(0.001);
    }
    // The pond is quiet then: no heron, no fish, no fisher, the boats turned over on the bank.
    expect(heronAt(200, day)).toBeNull();
    expect(fishRisesAt(200, day)).toEqual([]);
    expect(fisherAt(200, day)).toBeNull();
    expect(boatsAt(200, day).every((b) => b.state === 'stored')).toBe(true);
  });

  it('replays the same night across timezones, refreshes and long absences', () => {
    const utc = at('2026-09-25T08:51:00Z');
    expect(utc.label).toBe('Winter 15, Year 3');
    expect(utc.minutes).toBe(180);
    expect(utc.secret).toEqual({ crack: 0, glint: 0, opacity: 1, phase: 0 });
    expect(at('2026-09-25T11:51:00+03:00')).toEqual(utc);
    expect(at('2026-09-25T01:51:00-07:00')).toEqual(utc);
    expect(at('2026-09-25T08:50:59Z').secret).toBeNull();
    const later = at('2026-09-25T08:51:50Z');
    expect(later.minutes).toBe(230);
    at('2026-09-26T00:00:00Z');
    expect(at('2026-09-25T08:51:50Z')).toEqual(later);
    const start = Date.parse('2026-09-25T08:51:50Z');
    for (const years of [1, 10, 250]) {
      const then = new Date(start + years * 112 * TOWN_DAY_MS).toISOString();
      expect(at(then).secret).toEqual(later.secret);
    }
  });
});

describe('One pond for every visitor', () => {
  it('treats (minutes + 1440, day − 1) as the same moment everywhere', () => {
    const fns = [
      heronAt,
      fishRisesAt,
      boatsAt,
      fisherAt,
      sceneSkatersAt,
      mistAt,
      wheelAngleAt,
      iceSecretAt,
      millpondStatusAt,
    ];
    for (const groundDay of [0, 9, 30, 40, 76, 87, 95, 98, 106, 107])
      for (const minutes of [
        0, 5.5, 182.25, 375.125, 512.5, 840.5, 1000.25, 1105.75, 1170.5, 1435,
      ]) {
        const day = dayOf(groundDay);
        for (const fn of fns) {
          const expected = fn(minutes, day);
          expect(fn(minutes + 1440, day - 1)).toEqual(expected);
          expect(fn(minutes - 1440, day + 1)).toEqual(expected);
        }
      }
  });

  it('never reads a clock, a random source or storage', () => {
    const ban = /\bDate\b|Math\.random|localStorage|sessionStorage/;
    for (const file of ['src/lib/millpond.ts', 'src/city/millpond.ts'])
      if (existsSync(file)) expect(readFileSync(file, 'utf8')).not.toMatch(ban);
    expect(existsSync('src/lib/millpond.ts')).toBe(true);
  });

  it('gives the same answer whatever was asked before', () => {
    const day = dayOf(40);
    const first = [heronAt(1170, day), fishRisesAt(1170, day), boatsAt(900, day)];
    for (let t = 0; t < 1440; t += 37) {
      heronAt(t, day + 3);
      fishRisesAt(t, day - 5);
      boatsAt(t, day + 11);
    }
    expect([heronAt(1170, day), fishRisesAt(1170, day), boatsAt(900, day)]).toEqual(first);
  });

  it('reports a status that matches everything on the water', { timeout: 20_000 }, () => {
    for (let groundDay = 0; groundDay < 112; groundDay++) {
      const day = dayOf(groundDay);
      for (const t of [100, 345, 400, 600, 706, 900, 1000, 1150, 1200, 1275, 1300]) {
        const status = millpondStatusAt(t, day);
        const heron = heronAt(t, day);
        const boats = boatsAt(t, day);
        const open = iceOn(groundDay).stage === 'open';
        expect(status.ice).toBe(iceOn(groundDay).stage);
        expect(status.heron === null).toBe(heron === null);
        if (heron) {
          expect(status.heron === 'asleep').toBe(heron.pose === 'sleep');
          expect(status.heron === 'hunting').toBe(
            open && HERON_SCHEDULE.hunts.some((h) => t >= h.from && t < h.to),
          );
          expect(status.heronWalking !== undefined).toBe(heron.pose === 'walk');
        } else expect(status.heronWalking).toBeUndefined();
        const out = boats.filter((b) => b.state === 'out').length;
        expect(status.boatsOut).toBe(out);
        expect(status.boats === 'out').toBe(out > 0);
        if (status.boats !== 'out') expect(boats.every((b) => b.state === status.boats)).toBe(true);
        expect(status.mist).toBe(mistAt(t, day) > 0.2);
        expect(status.fisher).toBe(fisherAt(t, day) !== null);
        if (status.fishRising)
          for (let dt = 0; dt < 3; dt += 0.25)
            expect(fishRisesAt(t + dt, day).length).toBeGreaterThan(0);
        expect(status.fishRising).toBe(iceOn(groundDay).stage === 'open' && t >= 1110 && t < 1230);
        expect(status.skating !== null).toBe(millpondSkatingDay(day));
        if (status.skating) {
          expect(status.skating.live).toBe(t >= SKATING.start && t < SKATING.end);
          expect(sceneSkatersAt(t, day).length > 0).toBe(status.skating.live);
        }
        // The same counts the art draws, so a line never names what is not on the water.
        const yearDay = yearDayAt(day, t);
        expect(status.petals).toBe(open && petalCountAt(yearDay) > 0);
        expect(status.leaves).toBe(open && leafCountAt(yearDay) > 0 && leafFadeAt(yearDay) >= 0.3);
        expect(status.lilies).toBe(lilyPadsOn(groundDay).length > 0);
        if (open && heron && heron.opacity === 1 && [345, 706, 1275].includes(t))
          expect(status.heronWalking).toBe(t === 345 ? 'out' : t === 706 ? 'between' : 'home');
        expect(status.flowers).toBe(lilyFlowersOn(groundDay).length > 0);
        if (status.flowers) expect(status.lilies).toBe(true);
        // …inside the outer seasonal windows.
        if (status.petals) expect(groundDay).toBeGreaterThanOrEqual(MILLPOND_SEASON.petals.from);
        if (status.petals) expect(groundDay).toBeLessThan(MILLPOND_SEASON.petals.to);
        if (status.leaves) expect(groundDay).toBeGreaterThanOrEqual(MILLPOND_SEASON.leaves.from);
        if (status.leaves) expect(groundDay).toBeLessThan(MILLPOND_SEASON.leaves.to);
        if (status.lilies) expect(groundDay).toBeGreaterThanOrEqual(MILLPOND_SEASON.lilies.from);
        if (status.lilies) expect(groundDay).toBeLessThan(MILLPOND_SEASON.lilies.to);
      }
    }
  });
});
