import { describe, expect, it } from 'vitest';
import { edgeTree, edgeTreeAt } from '../src/city/render';
import { drawTownTree } from '../src/city/trees';
import { drawTubes, type TubeScene } from '../src/city/tubes';
import { REGATTA_COURSE } from '../src/lib/district-calendar';
import { townSeasonAt } from '../src/lib/seasons';
import { MAX_TRAVEL_SPEED_MULTIPLIER } from '../src/lib/walking';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { tubeParcels, tubeRides } from '../src/lib/tube-traffic';
import {
  TRUNK_ARCS,
  TUBE_ALTITUDE,
  TUBE_BANK_X,
  TUBE_BOARD_STEPS,
  TUBE_CORNER,
  TUBE_PARCEL_ROUTE,
  RIVERSIDE_TREE_GAPS,
  TUBE_PARCELS,
  TUBE_SAVING_SHARE,
  TUBE_SIGN_STATION,
  TUBE_STATIONS,
  TUBE_TREE_GAPS,
  TUBE_TRUNK_X,
  TUBE_TRUNK_Y,
  TUBE_ALIGHT_STEPS,
  TUBE_VENUE,
  loopSpur,
  stationTap,
  trunkPoint,
  tubeAt,
  tubeFixedMinutes,
  tubeLength,
  tubeMinSaving,
  tubeParcelSlots,
  tubeRoute,
  tubeStation,
  type TubePoint,
} from '../src/lib/tubes';
import { hash, project, unproject, WORLD_HEIGHT, WORLD_WIDTH, type Point } from '../src/lib/world';
import { fullTown, readPlaces } from './full-town';
import { matrixContext } from './matrix-context';

// The Treeline's loop: seven halts round the west, north and river edges of town, one bore. Every
// ride between any two halts is continuous, symmetric, honest about its minutes, clear of the
// walkers under its spurs, and runs only on the trunk and its own two spurs; the edge trees keep
// out of its way; and a full town fits in the stacks and the glass with parcels to spare.

const IDS = TUBE_STATIONS.map((station) => station.id);
const PAIRS = IDS.flatMap((a) => IDS.filter((b) => b !== a).map((b) => [a, b] as const));
const { S_N0, S_N1, S_E0 } = TRUNK_ARCS;

/** How far a ground point lies from the trunk's centreline (the three runs and both corners). */
function offTrunk(p: Point) {
  const R = TUBE_CORNER;
  const top = TUBE_TRUNK_Y + R,
    west = TUBE_TRUNK_X + R,
    east = TUBE_BANK_X - R;
  const options = [Infinity];
  if (p.y >= top) options.push(Math.abs(p.x - TUBE_TRUNK_X), Math.abs(p.x - TUBE_BANK_X));
  if (p.x >= west && p.x <= east) options.push(Math.abs(p.y - TUBE_TRUNK_Y));
  if (p.x <= west && p.y <= top) options.push(Math.abs(Math.hypot(p.x - west, p.y - top) - R));
  if (p.x >= east && p.y <= top) options.push(Math.abs(Math.hypot(p.x - east, p.y - top) - R));
  return Math.min(...options);
}
const samePoint = (a: TubePoint, b: TubePoint) => a.x === b.x && a.y === b.y && a.h === b.h;

/** Whether a point lies inside a polygon (even-odd). */
function inside(p: Point, polygon: readonly Point[]) {
  let within = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      within = !within;
  }
  return within;
}
/**
 * The world-px polygons a drawing fills: its fillRects and its filled paths, with save, restore,
 * translate and scale followed. Enough for drawTownTree, which uses nothing else.
 */
function paintedShapes(draw: (ctx: CanvasRenderingContext2D) => void) {
  let m = { a: 1, d: 1, e: 0, f: 0 };
  const stack: (typeof m)[] = [];
  const shapes: Point[][] = [];
  let path: Point[][] = [];
  const at = (x: number, y: number) => ({ x: m.a * x + m.e, y: m.d * y + m.f });
  const calls: Record<string, (...n: number[]) => void> = {
    save: () => stack.push({ ...m }),
    restore: () => (m = stack.pop() ?? m),
    translate: (x, y) => (m = { ...m, e: m.e + m.a * x, f: m.f + m.d * y }),
    scale: (x, y) => (m = { ...m, a: m.a * x, d: m.d * y }),
    beginPath: () => (path = []),
    moveTo: (x, y) => path.push([at(x, y)]),
    lineTo: (x, y) => path.at(-1)!.push(at(x, y)),
    fill: () => shapes.push(...path),
    fillRect: (x, y, w, h) => shapes.push([at(x, y), at(x + w, y), at(x + w, y + h), at(x, y + h)]),
  };
  const ctx = new Proxy(
    {},
    {
      get: (_, key) =>
        typeof key === 'string' && !['fillStyle', 'globalAlpha'].includes(key)
          ? (calls[key] ?? (() => undefined))
          : undefined,
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  draw(ctx);
  return shapes;
}

describe('The Treeline loop', () => {
  it('keeps its seven halts in line order, the sign at Hedgerow and the parcels on the old stretch', () => {
    expect(IDS).toEqual(['R1', 'N1', 'C1', 'A9', 'C15', 'L15', 'R15']);
    const taps = IDS.map(stationTap);
    for (let i = 1; i < taps.length; i++) expect(taps[i]).toBeGreaterThan(taps[i - 1]);
    for (const [id, tap] of [
      ['R1', -71],
      ['N1', -55],
      ['C1', -11],
      ['A9', 36.57],
      ['C15', 76.14],
      ['L15', 112.14],
      ['R15', 136.14],
    ] as const)
      expect(stationTap(id)).toBeCloseTo(tap, 2);
    expect([S_N0, S_N1, S_E0].map((s) => +s.toFixed(4))).toEqual([1.5708, 63.5708, 65.1416]);
    expect(TUBE_BANK_X).toBe(WORLD_WIDTH - 0.5);
    expect(TUBE_ALTITUDE).toEqual({ spur: 39, trunk: 8, bank: 5, radius: 2.5, bankRadius: 2 });
    // The trunk: 8 px along the back runs, easing to 5 px round the river's head.
    expect(trunkPoint(-20)).toEqual({ x: -0.5, y: 20.5, h: 8 });
    expect(trunkPoint(S_N0 + 10)).toEqual({ x: 10.5, y: -0.5, h: 8 });
    expect(trunkPoint(S_E0 + 30)).toEqual({ x: TUBE_BANK_X, y: 30.5, h: 5 });
    expect(trunkPoint((S_N1 + S_E0) / 2).h).toBeCloseTo(6.5, 9);
    expect(TUBE_SIGN_STATION).toBe('C1');
    expect(TUBE_VENUE.plot).toBe('C1');
    expect(TUBE_PARCEL_ROUTE).toEqual(['C1', 'N1']);
    for (let day = 0; day < 40; day++)
      for (const slot of tubeParcelSlots(day))
        expect([slot.from, slot.to].sort()).toEqual([...TUBE_PARCEL_ROUTE].sort());
  });

  it('runs every ride continuously, symmetric and honest about its minutes', () => {
    let longest = { fixed: 0, pair: '' };
    for (const [a, b] of PAIRS) {
      const length = tubeLength(a, b);
      expect(Math.abs(length - tubeLength(b, a)), `${a}>${b}`).toBeLessThanOrEqual(1e-9);
      expect(tubeRoute(b, a)).toEqual([...tubeRoute(a, b)].reverse());
      const fixed = tubeFixedMinutes(a, b);
      expect(fixed).toBeCloseTo(4 + length / 10, 12);
      expect(tubeMinSaving(a, b)).toBeGreaterThanOrEqual(TUBE_SAVING_SHARE * fixed);
      expect(tubeMinSaving(a, b)).toBeGreaterThanOrEqual(10);
      if (fixed > longest.fixed) longest = { fixed, pair: [a, b].sort().join('-') };
      let previous = tubeAt(a, b, 0);
      const steps = Math.ceil(length * 100);
      for (let i = 1; i <= steps; i++) {
        const at = tubeAt(a, b, Math.min(length, i / 100));
        const step = Math.hypot(
          at.position.x - previous.position.x,
          at.position.y - previous.position.y,
        );
        if (step > 0.01 + 1e-9 || Math.abs(at.altitude - previous.altitude) > 0.2)
          expect.fail(`${a}>${b} jumps at ${i / 100}: ${step} tiles, ${at.altitude} px`);
        previous = at;
      }
    }
    expect(TUBE_SAVING_SHARE).toBeCloseTo(MAX_TRAVEL_SPEED_MULTIPLIER - 1, 12);
    expect(longest.pair).toBe('R1-R15');
    expect(Math.abs(longest.fixed - 25.767)).toBeLessThanOrEqual(0.005);
    expect(tubeMinSaving('R1', 'R15')).toBeCloseTo(0.4 * longest.fixed, 12);
    // Hedgerow to Willow is the line it always was, to the bit.
    expect(tubeRoute('C1', 'N1')).toHaveLength(40);
    expect(tubeLength('C1', 'N1')).toBe(54.497876192710336);
  });

  it('keeps every point on the trunk or its own two spurs, high over the lanes and the road', () => {
    for (const [a, b] of PAIRS) {
      const dir = stationTap(b) > stationTap(a) ? 1 : -1;
      const spurs = [loopSpur(tubeStation(a), dir), loopSpur(tubeStation(b), dir === 1 ? -1 : 1)];
      for (const p of tubeRoute(a, b)) {
        const onSpur = spurs.some((spur) => spur.some((q) => samePoint(p, q)));
        if (!onSpur && offTrunk(p) > 1e-9) expect.fail(`${a}>${b}: ${p.x},${p.y} is off the line`);
      }
      // Over the walker band of the lane (x or y 1.1–1.9) or the riverside road (x 61.1–61.9)
      // on a spur's own row or column, the glass's underside clears a walker by 3 px.
      const length = tubeLength(a, b);
      for (let s = 0; s <= length; s += 0.01) {
        const at = tubeAt(a, b, s);
        const { x, y } = at.position;
        const over = [a, b].some((id) => {
          const { edge, dock } = tubeStation(id);
          if (edge === 'north') return x === dock.x && y >= 1.1 && y <= 1.9;
          return y === dock.y && ((x >= 1.1 && x <= 1.9) || (x >= 61.1 && x <= 61.9));
        });
        if (over && at.altitude - TUBE_ALTITUDE.radius < 34)
          expect.fail(`${a}>${b} at ${s}: underside ${at.altitude - TUBE_ALTITUDE.radius} px`);
      }
    }
  });

  it('keeps the edge trees out of its way', () => {
    expect(TUBE_TREE_GAPS).toEqual([
      { x: 0, y: 71 },
      { x: 0, y: 55 },
      { x: 0, y: 11 },
      { x: 35, y: 0 },
      { x: 63, y: 11 },
      { x: 63, y: 47 },
      { x: 63, y: 71 },
    ]);
    for (const gap of TUBE_TREE_GAPS) expect(edgeTreeAt(gap.x, gap.y)).toBeUndefined();
    // Only the three far-bank gaps take a tree away; the others were gaps already.
    expect(TUBE_TREE_GAPS.filter((gap) => gap.x === WORLD_WIDTH - 1)).toHaveLength(3);
    // No edge tree is drawn within 0.6 tiles of a spur where it crosses the edge: any point of its
    // dip or its elbow short of the trunk itself (the far-bank glass runs on behind the willows).
    const onTrunk = (p: Point) =>
      p.x === TUBE_TRUNK_X || p.y === TUBE_TRUNK_Y || p.x === TUBE_BANK_X;
    for (const station of TUBE_STATIONS) {
      const gap = TUBE_TREE_GAPS[TUBE_STATIONS.indexOf(station)];
      const spur = [...loopSpur(station, 1), ...loopSpur(station, -1)].filter((p) => !onTrunk(p));
      let near = 0;
      for (let x = gap.x - 3; x <= gap.x + 3; x++)
        for (let y = gap.y - 3; y <= gap.y + 3; y++) {
          const drawn = edgeTreeAt(x, y);
          if (!drawn) continue;
          near++;
          const tree = unproject(drawn.x, drawn.y);
          for (const p of spur) {
            const d = Math.hypot(p.x - tree.x, p.y - tree.y);
            if (d < 0.6) expect.fail(`${station.id}: the tree at ${x},${y} is ${d} from the spur`);
          }
        }
      // The edge keeps its trees either side (at Kingfisher Halt, three rows off: the row south
      // of its gap is one of the Riverside's, RIVERSIDE_TREE_GAPS).
      expect(near, station.id).toBeGreaterThan(0);
    }
  });

  it('keeps the far bank’s trees from standing in front of its piers, the regatta and the Landing', () => {
    // A row south of each bank halt's gap, and the launch's row by the Landing's stage.
    expect(RIVERSIDE_TREE_GAPS).toEqual([
      { x: 63, y: 12 },
      { x: 63, y: 48 },
      { x: 63, y: 72 },
      { x: 63, y: 39 },
    ]);
    expect(RIVERSIDE_TREE_GAPS.at(-1)!.y).toBe(Math.floor(REGATTA_COURSE.launch.y));
    for (const gap of RIVERSIDE_TREE_GAPS) {
      expect(edgeTreeAt(gap.x, gap.y)).toBeUndefined();
      // None is a Treeline gap: TUBE_TREE_GAPS keeps to the spurs' own tiles.
      expect(TUBE_TREE_GAPS).not.toContainEqual(gap);
    }
    // They take three trees away; Bulrush Halt's row south grew none.
    const grew = (gap: Point) => hash(`tree${gap.x},${gap.y}`) % 3 !== 0;
    expect(RIVERSIDE_TREE_GAPS.filter(grew)).toEqual([
      { x: 63, y: 12 },
      { x: 63, y: 48 },
      { x: 63, y: 39 },
    ]);

    const trees: { tile: Point; depth: number; shapes: Point[][] }[] = [];
    for (let x = 0; x < WORLD_WIDTH; x++)
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const tree = edgeTree(x, y);
        if (!tree) continue;
        const { point, scale, seed } = tree;
        // Its crown in full leaf, as render.ts draws it.
        const shapes = paintedShapes((ctx) =>
          drawTownTree(
            ctx,
            point.x,
            point.y,
            scale,
            { leaf: '#557A46', leafLight: '#6F9A58' },
            seed,
          ),
        );
        trees.push({ tile: { x, y }, depth: tree.depth, shapes });
      }
    /** The trees that cover a pixel of `area` (a world-px polygon), of those drawn after `depth`. */
    const covering = (area: Point[], depth: number) => {
      const xs = area.map((p) => p.x),
        ys = area.map((p) => p.y);
      const found = new Set<string>();
      for (let x = Math.floor(Math.min(...xs)); x < Math.max(...xs); x++)
        for (let y = Math.floor(Math.min(...ys)); y < Math.max(...ys); y++) {
          const pixel = { x: x + 0.5, y: y + 0.5 };
          if (!inside(pixel, area)) continue;
          for (const tree of trees)
            if (tree.depth > depth && tree.shapes.some((shape) => inside(pixel, shape)))
              found.add(`${tree.tile.x},${tree.tile.y}`);
        }
      return [...found];
    };
    const rectangle = (left: number, top: number, right: number, bottom: number) => [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ];

    // Each bank halt's pier, its column and its stone foot, as the Treeline paints it.
    const day = CALENDAR_EPOCH_DAY + 30;
    const scene: TubeScene = {
      minutes: 720,
      day,
      night: false,
      season: townSeasonAt(day, 720),
      zoom: 3,
      emphasis: 'none',
      station: null,
      visible: () => true,
      residents: [],
      parcels: () => [],
    };
    const piers = drawTubes(matrixContext().ctx, scene).filter(
      (object) => object.part === 'post' && tubeStation(object.station).edge === 'bank',
    );
    expect(piers).toHaveLength(3);
    for (const pier of piers) {
      const painted = matrixContext();
      const own = drawTubes(painted.ctx, scene).find(
        (object) => object.part === 'post' && object.station === pier.station,
      )!;
      const start = painted.points.length;
      own.paint();
      const points = painted.points.slice(start);
      const xs = points.map((p) => p.x),
        ys = points.map((p) => p.y);
      const column = rectangle(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      expect(Math.max(...ys) - Math.min(...ys), pier.station).toBeGreaterThan(20);
      expect(covering(column, pier.depth), `${pier.station}'s pier`).toEqual([]);
    }

    // A boat drifting under the Kingfisher bridge: 8 px wide and up to 4 tall over its point.
    const bridge = tubeStation('L15').dock.y;
    for (let y = bridge - 0.5; y <= bridge + 0.5; y += 0.05)
      for (const x of [62.085, REGATTA_COURSE.laneX, 62.165]) {
        const p = project(x, y);
        const boat = rectangle(p.x - 4, p.y - 4, p.x + 4, p.y + 1);
        expect(covering(boat, x + y), `a boat at ${x}, ${y.toFixed(2)}`).toEqual([]);
      }

    // The stage, from the water to its piles' tops (cached ground, under every tree), and the
    // boatwright standing at its south tip to set each boat on the water.
    const { left, right, top, bottom } = REGATTA_COURSE.stage;
    const lift = (p: Point, h: number) => ({ x: p.x, y: p.y - h });
    const [north, east, south, west] = [
      project(left, top),
      project(right, top),
      project(right, bottom),
      project(left, bottom),
    ];
    const stage = [lift(north, 5), lift(east, 5), east, south, west, lift(west, 5)];
    expect(covering(stage, -Infinity), 'the stage').toEqual([]);
    const launch = project(REGATTA_COURSE.launch.x, REGATTA_COURSE.launch.y);
    const figure = rectangle(launch.x - 10, launch.y - 40, launch.x + 10, launch.y);
    expect(
      covering(figure, REGATTA_COURSE.launch.x + REGATTA_COURSE.launch.y),
      'the launch',
    ).toEqual([]);
  });

  it(
    'fits a full town in its stacks and its glass, with parcels every day',
    { timeout: 60_000 },
    () => {
      const town = fullTown(readPlaces());
      const days = Array.from({ length: 28 }, (_, d) => CALENDAR_EPOCH_DAY + 224 + d);
      let mostInStack = 0,
        mostInGlass = 0,
        fewestParcels = Infinity;
      /** The most intervals [from, to) open at once. */
      const most = (spans: [number, number][]) => {
        const edges = spans.flatMap(([from, to]): [number, number][] => [
          [from, 1],
          [to, -1],
        ]);
        edges.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        let open = 0,
          peak = 0;
        for (const [, change] of edges) peak = Math.max(peak, (open += change));
        return peak;
      };
      for (const day of days) {
        const rides = tubeRides(town, day);
        const parcels = tubeParcels(town, day);
        fewestParcels = Math.min(fewestParcels, parcels.length);
        // A parcel never shares the line with a rider: its whole episode, and a margin.
        for (const parcel of parcels) {
          expect(TUBE_PARCEL_ROUTE).toContain(parcel.from);
          expect(TUBE_PARCEL_ROUTE).toContain(parcel.to);
          for (const ride of rides)
            expect(
              ride.off + TUBE_PARCELS.margin <= parcel.depart - TUBE_PARCELS.wait ||
                parcel.arrive + TUBE_PARCELS.wait + TUBE_PARCELS.margin <= ride.board,
            ).toBe(true);
        }
        // In a stack: boarding from the end of the walk in to the fwoomp, stepping off until the
        // settle.
        for (const id of IDS)
          mostInStack = Math.max(
            mostInStack,
            most([
              ...rides
                .filter((ride) => ride.from === id)
                .map((ride): [number, number] => [ride.board + TUBE_BOARD_STEPS.walk, ride.depart]),
              ...rides
                .filter((ride) => ride.to === id)
                .map((ride): [number, number] => [
                  ride.arrive,
                  ride.arrive + TUBE_ALIGHT_STEPS.settle,
                ]),
            ]),
          );
        mostInGlass = Math.max(
          mostInGlass,
          most([
            ...rides.map((ride): [number, number] => [ride.depart, ride.arrive]),
            ...parcels.map((parcel): [number, number] => [parcel.depart, parcel.arrive]),
          ]),
        );
      }
      expect(mostInStack).toBeGreaterThan(0);
      expect(mostInStack).toBeLessThanOrEqual(4);
      expect(mostInGlass).toBeGreaterThan(1);
      expect(mostInGlass).toBeLessThanOrEqual(24);
      expect(fewestParcels).toBeGreaterThanOrEqual(4);
    },
  );
});
