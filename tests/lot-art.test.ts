import { describe, expect, it, vi } from 'vitest';
import { drawCinema, MAST_X, mastHeight } from '../src/city/cinema';
import { lampBlocksGoal } from '../src/city/football';
import {
  DOOR_AJAR,
  drawHouse,
  drawHouseDoor,
  HOUSE_SCALE,
  lotToHouse,
  PERCH_HIPS_BEHIND,
  SEAT_TOPS,
  STEPPING_STONES,
  tint,
  underPorchRoof,
} from '../src/city/houses';
import { LAMP_LIFT, LAMPS, lampFoot, lampLift } from '../src/city/lamplight';
import { renderCity, type Camera } from '../src/city/render';
import { drawResident } from '../src/city/residents';
import { drawVenue, onPatchwork } from '../src/city/venues';
import { cinemaAt } from '../src/lib/cinema';
import { EVENT_SPOTS, eventSpot, eventsForDay, VENUES } from '../src/lib/events';
import {
  BENCH_SEAT,
  DOOR_OFFSET,
  FRONT_STEP,
  homeSpots,
  KERB_OFFSET,
  PORCH_CHAIR,
  STONE_X,
} from '../src/lib/home-life';
import { LANE_SHIFT } from '../src/lib/lanes';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { DEFAULT_RESIDENT } from '../src/lib/schema';
import type { ResidentState } from '../src/lib/simulation';
import { WORLD_BOUNDS, getPlot, plotCenter, project, unproject } from '../src/lib/world';
import { readPlaces } from './full-town';
import { matrixContext } from './matrix-context';
import { recordingContext, type RecordedCall } from './recording-context';

// The art of a neighbour's own lot and the streets they walk: seats that hold a sitter, a door
// that opens inside its frame, one straight garden path, lamps off the walking lines, a rug
// under every picnic seat, watering cans over what they water, and music notes only where there
// is music.

const places = readPlaces();
const RESIDENT_SCALE = 1.25;

/** Each filled path's corners, in the order drawn. */
function filledPaths(calls: readonly RecordedCall[]) {
  const paths: { points: number[][]; fill: unknown }[] = [];
  let points: number[][] = [];
  for (const call of calls) {
    if (call.name === 'beginPath') points = [];
    if (call.name === 'moveTo' || call.name === 'lineTo')
      points.push([
        (call.args[0] as number) + call.offset.x,
        (call.args[1] as number) + call.offset.y,
      ]);
    if (call.name === 'fill') paths.push({ points, fill: call.fillStyle });
  }
  return paths;
}
/** Whether a point lies inside a convex polygon, whichever way round it was drawn. */
function inside(polygon: readonly (readonly number[])[], [x, y]: number[]) {
  const sides = polygon.map((p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    return Math.sign((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]));
  });
  return sides.every((s) => s >= 0) || sides.every((s) => s <= 0);
}
function whole(width: number, height: number): Camera {
  const zoom = Math.min(
    (width - 52) / (WORLD_BOUNDS.right - WORLD_BOUNDS.left + 36),
    (height - 85) / (WORLD_BOUNDS.bottom + 98),
  );
  return {
    x: width / 2 - ((WORLD_BOUNDS.left + WORLD_BOUNDS.right) / 2) * zoom,
    y: (height - WORLD_BOUNDS.bottom * zoom) / 2 + 28,
    zoom,
  };
}

describe('Sitting out on the lot', () => {
  it("rests a perched neighbour's lap on the garden bench and on the porch chair", () => {
    for (const [spot, top, feet] of [
      ['bench', SEAT_TOPS.bench, BENCH_SEAT.feet],
      ['porch', SEAT_TOPS.porch, PORCH_CHAIR.feet],
    ] as const)
      for (const pose of ['perch', 'tea'] as const) {
        const name = spot === 'porch' ? 'porch chair' : spot;
        // The figure stands where the map draws it on the lot, in the house's own px.
        const anchor = lotToHouse(feet);
        const recorder = matrixContext();
        drawResident(
          recorder.ctx,
          DEFAULT_RESIDENT,
          anchor.x,
          anchor.y,
          RESIDENT_SCALE / HOUSE_SCALE,
          {
            pose,
            facing: 'sw',
            moving: false,
            walkPhase: 0.7,
            greeting: false,
            lot: { spot, stage: 'at' },
          },
        );
        // The lap: an 8 by 2 rect in the trousers' near shade.
        const lap = recorder.calls.findIndex(
          (call) =>
            call.name === 'fillRect' &&
            call.fillStyle === '#53605A' &&
            call.args[2] === 8 &&
            call.args[3] === 2,
        );
        expect(lap, name).toBeGreaterThan(0);
        const corners = recorder.points.filter((p) => p.index === lap);
        const bottom = Math.max(...corners.map((p) => p.y));
        const middle =
          (Math.min(...corners.map((p) => p.x)) + Math.max(...corners.map((p) => p.x))) / 2;
        // The lap's underside sits on the seat: a pixel and a half up from it is seat top, and
        // it hangs no more than a pixel and a half past the seat's front edge.
        expect(inside(top, [middle, bottom - 1.5]), `${name} ${pose}`).toBe(true);
        expect(inside(top, [middle, bottom + 1.5]), `${name} ${pose}`).toBe(false);
        // And the shoes stand on the ground at the anchor, the lowest of the figure's pixels.
        const lowest = Math.max(
          ...recorder.points.filter((p) => p.call === 'fillRect').map((p) => p.y),
        );
        expect(lowest - anchor.y).toBeGreaterThan(0);
        expect(lowest - anchor.y).toBeLessThanOrEqual(2 * (RESIDENT_SCALE / HOUSE_SCALE) + 1);
      }
  });
});

describe('Gardening', () => {
  it('waters the bed or the flowers each watering spot faces, never the path', () => {
    /** Each painted rectangle of these colours, in house px: [left, top, right, bottom]. */
    const rects = (recorder: ReturnType<typeof matrixContext>, colours: string[]) =>
      recorder.calls.flatMap((call, index) => {
        if (call.name !== 'fillRect' || !colours.includes(call.fillStyle as string)) return [];
        const corners = recorder.points.filter((p) => p.index === index);
        const xs = corners.map((p) => p.x),
          ys = corners.map((p) => p.y);
        return [[Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]];
      });
    const union = (list: number[][]) =>
      [0, 1, 2, 3].map((i) => (i < 2 ? Math.min : Math.max)(...list.map((r) => r[i])));
    const [base] = places;
    for (const garden of ['vegetables', 'wildflowers'] as const) {
      const place = {
        ...base,
        decoration: 'flowers' as const,
        design: { ...base.design, garden },
      };
      const house = matrixContext();
      drawHouse(house.ctx, place, 0, 0, false, 1, { minutes: 720 });
      // The flowers' stems and heads, all together, and each bed: its soil, or its one wildflower,
      // stem and head, painted in bed order.
      const flowers = rects(house, ['#6C915B', '#EABD8A']);
      expect(flowers.length).toBe(8);
      const stems = rects(house, ['#668654']),
        heads = rects(house, ['#EDC88B', '#D18F87', '#B3A5CD']);
      const targets = {
        // A wildflower grows in the middle of its patch of ground, which reaches 2 px in front
        // of the stem's foot as a vegetable bed's soil does in front of its plant's.
        beds:
          garden === 'vegetables'
            ? rects(house, ['#957453'])
            : stems.map((stem, i) => {
                const [l, t, r, b] = union([stem, heads[i]]);
                return [l, t, r, b + 2];
              }),
        flowers: [union(flowers)],
      };
      expect(targets.beds.length).toBe(7);
      const spots = homeSpots(place).filter((spot) => spot.pose === 'water');
      expect(spots.map((spot) => spot.kind)).toEqual(['flowers', 'beds', 'beds']);
      const watered = new Set<number[]>();
      for (const spot of spots) {
        const anchor = lotToHouse(spot.feet);
        for (let k = 0; k < 10; k++) {
          const figure = matrixContext();
          drawResident(
            figure.ctx,
            DEFAULT_RESIDENT,
            anchor.x,
            anchor.y,
            RESIDENT_SCALE / HOUSE_SCALE,
            {
              pose: 'water',
              facing: spot.facing,
              moving: false,
              walkPhase: k / 10,
              greeting: false,
            },
          );
          const drops = rects(figure, ['#BFE0E6']);
          expect(drops.length).toBe(3);
          for (const [left, top, right, bottom] of drops) {
            // Straight over one bed's soil (or among the flowers), and no lower than its ground.
            // A wildflower is narrower than a bed: each drop lands on it, give or take a pixel.
            const middle = (left + right) / 2;
            const over = ([l, r]: number[]) =>
              garden === 'wildflowers' && spot.kind === 'beds'
                ? middle >= l - 1 && middle <= r + 1
                : left >= l - 1 && right <= r + 1;
            const under = targets[spot.kind as 'beds' | 'flowers'].find(
              ([l, t, r, b]) => over([l, r]) && top >= t - 12 && bottom <= b + 1,
            );
            expect(under, `${garden}: ${spot.kind} at ${spot.feet.x},${spot.feet.y}`).toBeDefined();
            watered.add(under!);
          }
        }
      }
      // The flowers and two different beds.
      expect(watered.size, garden).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps a porch home's watering can clear of its porch chair", () => {
    // The chair's seat, its backrest above and its legs down to the ground, in house px.
    const seat = SEAT_TOPS.porch;
    const chair = {
      left: Math.min(...seat.map(([x]) => x)),
      right: Math.max(...seat.map(([x]) => x)),
      top: Math.min(...seat.map(([, y]) => y)) - 9,
      bottom: Math.max(...seat.map(([, y]) => y)) + 6,
    };
    const [base] = places;
    for (const garden of ['vegetables', 'wildflowers'] as const)
      for (const building of ['cottage', 'cafe'] as const) {
        const place = {
          ...base,
          building,
          decoration: 'flowers' as const,
          design: { ...base.design, feature: 'porch' as const, garden },
        };
        const spots = homeSpots(place).filter((spot) => spot.pose === 'water');
        expect(spots.length).toBeGreaterThan(0);
        for (const spot of spots) {
          const anchor = lotToHouse(spot.feet);
          for (let k = 0; k < 10; k++) {
            const figure = matrixContext();
            drawResident(
              figure.ctx,
              DEFAULT_RESIDENT,
              anchor.x,
              anchor.y,
              RESIDENT_SCALE / HOUSE_SCALE,
              {
                pose: 'water',
                facing: spot.facing,
                moving: false,
                walkPhase: k / 10,
                greeting: false,
              },
            );
            // The can, its rose and its drops: two pixels clear of the chair at least.
            figure.calls.forEach((call, index) => {
              if (call.name !== 'fillRect') return;
              if (!['#6F9C8C', '#557D70', '#BFE0E6'].includes(call.fillStyle as string)) return;
              const corners = figure.points.filter((p) => p.index === index);
              const left = Math.min(...corners.map((p) => p.x)),
                right = Math.max(...corners.map((p) => p.x)),
                top = Math.min(...corners.map((p) => p.y)),
                bottom = Math.max(...corners.map((p) => p.y));
              const clear =
                right <= chair.left - 2 ||
                left >= chair.right + 2 ||
                bottom <= chair.top - 2 ||
                top >= chair.bottom + 2;
              expect(
                clear,
                `${building} ${garden} ${spot.kind} ${spot.feet.x},${spot.feet.y}`,
              ).toBe(true);
            });
          }
        }
      }
  });

  it('plants nothing under or behind the garden bench', () => {
    const [base] = places;
    for (const garden of ['vegetables', 'wildflowers'] as const)
      for (const decoration of ['bench', 'mailbox'] as const) {
        const house = matrixContext();
        drawHouse(
          house.ctx,
          { ...base, decoration, design: { ...base.design, feature: 'none', garden } },
          0,
          0,
          false,
          1,
          { minutes: 720 },
        );
        // Where each bed meets the lawn: its soil, or its wildflower's foot.
        const grounds = house.calls.flatMap((call, index) => {
          if (
            call.name !== 'fillRect' ||
            call.fillStyle !== (garden === 'vegetables' ? '#957453' : '#668654')
          )
            return [];
          const corners = house.points.filter((p) => p.index === index);
          const bottom = Math.max(...corners.map((p) => p.y));
          return [garden === 'vegetables' ? corners : corners.filter((p) => p.y === bottom)];
        });
        if (decoration !== 'bench') {
          expect(grounds.length, garden).toBe(7);
          continue;
        }
        // The bench's footprint on the lawn is its shadow; five beds of seven stay clear of it.
        const footprint = filledPaths(house.calls).find(
          (path) => path.fill === '#23341B25' && path.points.every(([x]) => x > 0),
        )!;
        expect(footprint).toBeDefined();
        expect(grounds.length, garden).toBe(5);
        for (const corners of grounds)
          for (const { x, y } of corners)
            expect(inside(footprint.points, [x, y]), garden).toBe(false);
      }
  });
});

describe('Cheering', () => {
  it('draws music notes for the stage and the disco, never over football fans or zoo visitors', () => {
    const notes = (event: ResidentState['event'], walkPhase: number) => {
      const recorder = recordingContext();
      drawResident(recorder.ctx, DEFAULT_RESIDENT, 0, 0, 1, {
        pose: 'cheer',
        facing: 'sw',
        moving: false,
        walkPhase,
        greeting: false,
        event,
      });
      return recorder.calls.filter(
        (call) => call.name === 'fillRect' && call.fillStyle === '#E0B768',
      ).length;
    };
    const at = (id: string) => ({ id, name: id, phase: 'attending' as const });
    let stage = 0;
    for (let k = 0; k < 20; k++) {
      const phase = k / 20;
      stage += notes(at('rock'), phase);
      expect(notes(at('football'), phase)).toBe(0);
      expect(notes(at('zoo'), phase)).toBe(0);
    }
    expect(stage).toBeGreaterThan(0);
    // The disco's DJ, drawn with no event at all, keeps its notes too.
    expect(notes(undefined, 0.1)).toBeGreaterThan(0);
  });
});

describe('The front door', () => {
  it('opens inside its own frame and the path in front, clear of the porch, post and pumpkin', () => {
    const place = places.find((home) => home.design.feature === 'porch')!;
    let marks = 0;
    for (const night of [false, true])
      for (let k = 0; k <= 50; k++) {
        const recorder = matrixContext();
        drawHouseDoor(recorder.ctx, place, 0, 0, night, 1, {
          minutes: night ? 1300 : 720,
          lantern: { lit: true },
          door: k / 50,
        });
        if (k / 50 < DOOR_AJAR) {
          expect(recorder.calls).toEqual([]);
          continue;
        }
        for (const p of recorder.points) {
          marks++;
          // The recorder pads each path corner by half a line width either way; rects are exact.
          const pad = p.call === 'fillRect' ? 0 : 0.5;
          // Left of the right post (x -5) and the pumpkin (x -3), right of bed 1 (x -23).
          expect(p.x).toBeGreaterThanOrEqual(-21 - pad);
          expect(p.x).toBeLessThanOrEqual(-5 + pad);
          // Within half a pixel of the doorway's top, which leans down 1 px in 2 like the wall:
          // well under the porch roof's fascia.
          expect(p.y).toBeGreaterThanOrEqual(-2.52 + (p.x - pad + 13) / 2 - pad);
          expect(p.y).toBeLessThanOrEqual(20 + pad);
        }
      }
    expect(marks).toBeGreaterThan(500);
  });

  it("swings a porch home's door short of the chair beside it, and others' all the way", () => {
    const porch = places.find(
      (home) => home.design.feature === 'porch' && home.building !== 'cafe',
    )!;
    const leafEdge = (place: typeof porch) => {
      const recorder = matrixContext();
      drawHouseDoor(recorder.ctx, place, 0, 0, false, 1, { minutes: 720, door: 1 });
      // The leaf's edge line is its outermost mark.
      return Math.min(...recorder.points.filter((p) => p.call === 'fillRect').map((p) => p.x));
    };
    // The chair's right-most point is its seat's back corner; a pixel's gap stays between them.
    const chair = Math.max(...SEAT_TOPS.porch.map(([x]) => x));
    expect(leafEdge(porch)).toBeGreaterThanOrEqual(chair + 1);
    // With no chair beside it, the door opens square to the wall: 8 px out from its hinge.
    expect(leafEdge({ ...porch, design: { ...porch.design, feature: 'none' } })).toBeCloseTo(
      -21,
      9,
    );
  });
});

describe('Under the porch roof', () => {
  const porch = places.find((home) => home.design.feature === 'porch' && home.building !== 'cafe')!;
  const plot = getPlot(porch.plot)!;
  // A skin colour nothing else on the map uses, to find the figure among the calls.
  const SKIN = '#123457';
  const sitter = (greeting: boolean): ResidentState => ({
    id: porch.id,
    resident: { ...porch.resident, skin: SKIN },
    home: porch,
    activity: 'stroll',
    position: { x: plot.x + PORCH_CHAIR.feet.x, y: plot.y + PORCH_CHAIR.feet.y },
    moving: false,
    facing: 'sw',
    walkPhase: 0.5,
    greeting,
    pose: 'perch',
    lot: { spot: 'porch', stage: 'at' },
  });

  it('knows who stands or sits under it', () => {
    const cafe = {
      ...porch,
      building: 'cafe' as const,
      design: { ...porch.design, feature: 'none' as const },
    };
    const bare = { ...porch, design: { ...porch.design, feature: 'none' as const } };
    const hips = { x: PORCH_CHAIR.feet.x, y: PORCH_CHAIR.feet.y - PERCH_HIPS_BEHIND };
    for (const home of [porch, cafe]) {
      // In the doorway, on the top stone and on the chair.
      expect(underPorchRoof(home, DOOR_OFFSET)).toBe(true);
      expect(underPorchRoof(home, { x: STONE_X, y: 1.16 })).toBe(true);
      expect(underPorchRoof(home, hips)).toBe(true);
      // Out on the path, sitting on the front step, and past either end of the roof.
      expect(underPorchRoof(home, { x: STONE_X, y: 1.39 })).toBe(false);
      expect(underPorchRoof(home, FRONT_STEP.feet)).toBe(false);
      expect(underPorchRoof(home, { x: 0, y: 1.1 })).toBe(false);
      expect(underPorchRoof(home, { x: 1.2, y: 1.1 })).toBe(false);
    }
    expect(underPorchRoof(bare, DOOR_OFFSET)).toBe(false);
  });

  it("keeps a porch sitter's face in sight under the roof's front edge", () => {
    const house = matrixContext();
    drawHouse(house.ctx, porch, 0, 0, false, 1, { minutes: 720 });
    // The fascia hangs from the roof's front edge; its lower side runs through its last corners.
    const fascia = filledPaths(house.calls).find(
      (path) =>
        path.fill === tint(porch.color, -24) &&
        path.points.length === 4 &&
        path.points.every(([x]) => x < 0),
    )!;
    expect(fascia).toBeDefined();
    const [, , [x2, y2], [x3, y3]] = fascia.points;
    const edge = (x: number) => y2 + ((y3 - y2) * (x - x2)) / (x3 - x2);
    const anchor = lotToHouse(PORCH_CHAIR.feet);
    for (const resident of [DEFAULT_RESIDENT, { ...DEFAULT_RESIDENT, figure: 'female' as const }])
      for (const pose of ['perch', 'tea'] as const)
        for (const walkPhase of [0.2, 0.8]) {
          const figure = matrixContext();
          drawResident(figure.ctx, resident, anchor.x, anchor.y, RESIDENT_SCALE / HOUSE_SCALE, {
            ...sitter(false),
            pose,
            walkPhase,
          });
          const eyes = figure.points.filter((p) => figure.calls[p.index].fillStyle === '#35453D');
          expect(eyes.length).toBe(8);
          for (const eye of eyes)
            expect(eye.y, `${pose} ${walkPhase}`).toBeGreaterThan(edge(eye.x));
        }
  });

  it('paints the roof again over a neighbour under it, with their words on top', () => {
    const width = 900,
      height = 700,
      zoom = 3;
    const centre = plotCenter(plot);
    const camera = { x: width / 2 - centre.x * zoom, y: height / 2 - centre.y * zoom, zoom };
    const paint = (resident: ResidentState) => {
      const recorder = recordingContext(width, height);
      renderCity({
        ctx: recorder.ctx,
        width,
        height,
        camera,
        places: [porch],
        selectedPlot: null,
        hoveredPlot: null,
        night: false,
        showPlots: false,
        residents: [resident],
        minutes: 720,
        day: 3,
      });
      return recorder.calls;
    };
    const roof = tint(porch.color, 0);
    const after = (calls: RecordedCall[], from: number, test: (call: RecordedCall) => boolean) =>
      calls.findIndex((call, i) => i > from && test(call));
    const lastSkin = (calls: RecordedCall[]) => {
      let last = -1;
      calls.forEach((call, i) => {
        if (call.name === 'fillRect' && call.fillStyle === SKIN) last = i;
      });
      return last;
    };
    const calls = paint(sitter(true));
    const figure = lastSkin(calls);
    expect(figure).toBeGreaterThan(-1);
    const eave = after(calls, figure, (call) => call.name === 'fill' && call.fillStyle === roof);
    expect(eave).toBeGreaterThan(figure);
    const words = after(
      calls,
      eave,
      (call) => call.name === 'fillRect' && call.fillStyle === '#FCFAEF',
    );
    expect(words).toBeGreaterThan(eave);
    // Out on the path, in front of the roof, nothing is painted over them.
    const walker = paint({
      ...sitter(false),
      position: { x: plot.x + STONE_X, y: plot.y + 1.63 },
      pose: undefined,
      moving: true,
      lot: { spot: 'door', stage: 'from' },
    });
    const shown = lastSkin(walker);
    expect(after(walker, shown, (call) => call.name === 'fill' && call.fillStyle === roof)).toBe(
      -1,
    );
  });
});

describe('Doorways', () => {
  it('fades a neighbour as one see-through layer, never through their own overlapping parts', () => {
    const layers: ReturnType<typeof recordingContext>[] = [];
    vi.stubGlobal('document', {
      createElement: () => {
        const layer = recordingContext();
        layers.push(layer);
        return Object.assign(layer.ctx.canvas, { getContext: () => layer.ctx });
      },
    });
    try {
      const [place] = places;
      const plot = getPlot(place.plot)!;
      const width = 900,
        height = 700;
      const recorder = recordingContext(width, height);
      const alphas: number[] = [];
      const ctx = new Proxy(recorder.ctx, {
        get(target, key) {
          if (key === 'drawImage')
            return (...args: unknown[]) => {
              alphas.push(target.globalAlpha);
              return (target.drawImage as (...a: unknown[]) => void)(...args);
            };
          return Reflect.get(target, key);
        },
        set: (target, key, value) => Reflect.set(target, key, value),
      });
      const centre = plotCenter(plot);
      const skin = '#123457';
      const fading: ResidentState = {
        id: place.id,
        resident: { ...place.resident, skin },
        home: place,
        activity: 'stroll',
        position: { x: plot.x + STONE_X, y: plot.y + 1.63 },
        moving: true,
        facing: 'sw',
        walkPhase: 0.3,
        greeting: false,
        lot: { spot: 'door', stage: 'out' },
        fade: 0.4,
      };
      renderCity({
        ctx,
        width,
        height,
        camera: { x: width / 2 - centre.x * 2, y: height / 2 - centre.y * 2, zoom: 2 },
        places: [],
        selectedPlot: null,
        hoveredPlot: null,
        night: false,
        showPlots: false,
        residents: [fading],
        minutes: 720,
        day: 3,
      });
      const skinned = (calls: RecordedCall[]) =>
        calls.filter((call) => call.name === 'fillRect' && call.fillStyle === skin).length;
      // The whole figure goes into a layer, and the map gets one copy of it at the fade.
      const layer = layers.find((candidate) => skinned(candidate.calls) > 0);
      expect(layer).toBeDefined();
      expect(skinned(recorder.calls)).toBe(0);
      expect(recorder.calls.filter((call) => call.args[0] === layer!.ctx.canvas).length).toBe(1);
      expect(alphas).toContain(0.4);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('Streets and paths', () => {
  const width = 1440,
    height = 900;
  const camera = whole(width, height);
  const paint = (residents: ResidentState[] = []) => {
    const recorder = recordingContext(width, height);
    renderCity({
      ctx: recorder.ctx,
      width,
      height,
      camera,
      places,
      selectedPlot: null,
      hoveredPlot: null,
      night: true,
      showPlots: false,
      residents,
      minutes: 1300,
      day: 3,
    });
    return recorder.calls;
  };

  it('stands every lamp post on a kerb corner of its crossing, off the walking lines', () => {
    for (const lamp of LAMPS) {
      const foot = lampFoot(lamp);
      // Inside the junction tile, and far enough from both lines through its centre that a
      // walker in the outermost lane (LANE_SHIFT to their side) passes 0.2 tiles clear of it.
      expect(foot.x - lamp.x).toBeGreaterThan(0);
      expect(foot.x - lamp.x).toBeLessThan(1);
      expect(foot.y - lamp.y).toBeGreaterThan(0);
      expect(foot.y - lamp.y).toBeLessThan(1);
      expect(Math.abs(foot.x - lamp.x - 0.5) - LANE_SHIFT).toBeGreaterThanOrEqual(0.2);
      expect(Math.abs(foot.y - lamp.y - 0.5) - LANE_SHIFT).toBeGreaterThanOrEqual(0.2);
      // A side corner, left or right of the crossing on screen: as deep as its centre, so no
      // walker through the crossing itself passes behind the post.
      expect(foot.x + foot.y).toBeCloseTo(lamp.x + lamp.y + 1, 9);
      // In front of the football pitch a post stays low, its snow line (36 px up on a low post)
      // at most 3 px over the road's far line; everywhere else it stands tall.
      if (lamp.y === 29 && lamp.x > 9 && lamp.x < 21)
        expect(36 + lampLift(lamp) - 38 * (foot.y - 29)).toBeLessThanOrEqual(3);
      else expect(lampLift(lamp)).toBe(LAMP_LIFT);
    }
  });

  it('paints each post at its foot and sorts it by its foot, among the walkers', () => {
    const lamp = LAMPS.find((l) => l.x === 17 && l.y === 13)!;
    const foot = lampFoot(lamp);
    const walker = (id: string, dx: number, dy: number): ResidentState => ({
      id,
      resident: places[0].resident,
      home: places[0],
      activity: 'stroll',
      position: { x: foot.x + dx, y: foot.y + dy },
      moving: true,
      facing: 'se',
      walkPhase: 0.2,
      greeting: false,
    });
    // One just behind the post's foot, one just in front of it, both across its screen line.
    const calls = paint([walker('behind', -0.1, -0.1), walker('front', 0.1, 0.1)]);
    // A post is 2 px wide and 30 px tall, or LAMP_LIFT taller, in the night's pole grey.
    const posts = calls.filter(
      (call) =>
        call.name === 'fillRect' &&
        call.fillStyle === '#637266' &&
        call.args[2] === 2 &&
        (call.args[3] === 30 || call.args[3] === 30 + LAMP_LIFT),
    );
    const expected = LAMPS.filter((l) => !lampBlocksGoal(l.x + 0.5, l.y + 0.5)).map((l) => {
      const at = project(lampFoot(l).x, lampFoot(l).y);
      return `${at.x},${at.y - 29 - lampLift(l)},${30 + lampLift(l)}`;
    });
    expect(posts.map((call) => `${call.args[0]},${call.args[1]},${call.args[3]}`).sort()).toEqual(
      expected.sort(),
    );
    const at = project(foot.x, foot.y);
    const post = calls.findIndex(
      (call) =>
        posts.includes(call) && call.args[0] === at.x && call.args[1] === at.y - 29 - LAMP_LIFT,
    );
    // Each figure's shadow, under the camera's translate and the figure's own (the recorder adds
    // up translations and leaves out the zoom).
    const shadow = (id: string) => {
      const d = id === 'front' ? 0.1 : -0.1;
      const p = project(foot.x + d, foot.y + d);
      return calls.findIndex(
        (call) =>
          call.name === 'ellipse' &&
          Math.abs(call.offset.x - camera.x - p.x) < 1e-9 &&
          Math.abs(call.offset.y - camera.y - p.y) < 1e-9,
      );
    };
    expect(shadow('behind')).toBeGreaterThan(-1);
    expect(shadow('behind')).toBeLessThan(post);
    expect(shadow('front')).toBeGreaterThan(post);
  });

  it("hangs a tall lamp's head above the face of anyone passing close behind its post", () => {
    const calls = paint();
    // A walker's face from the brow (glasses, eyes) down to the chin, facing either way, in map px.
    const face = (p: { x: number; y: number }) => ({
      left: p.x - 5 * RESIDENT_SCALE,
      right: p.x + 5 * RESIDENT_SCALE,
      top: p.y - 19 * RESIDENT_SCALE,
      bottom: p.y - 13 * RESIDENT_SCALE,
    });
    let passes = 0;
    for (const lamp of LAMPS) {
      if (lampLift(lamp) !== LAMP_LIFT || lampBlocksGoal(lamp.x + 0.5, lamp.y + 0.5)) continue;
      const foot = lampFoot(lamp);
      const at = project(foot.x, foot.y);
      // The lamp and its hood, as painted, over this post (another may share its column).
      const head = calls
        .filter(
          (call) =>
            call.name === 'fillRect' &&
            ((call.args[0] === at.x - 3 && call.args[2] === 8 && call.args[3] === 6) ||
              (call.args[0] === at.x - 4 && call.args[2] === 10 && call.args[3] === 2)) &&
            (call.args[1] as number) < at.y &&
            (call.args[1] as number) > at.y - 30 - 2 * LAMP_LIFT,
        )
        .map((call) => call.args as number[]);
      expect(head).toHaveLength(2);
      // Along both roads through the crossing, in every lane: behind the post and within 0.4
      // tiles of its foot, a walker reads as passing it, never as wearing the lamp for a head.
      for (const along of ['x', 'y'] as const)
        for (let lane = -1; lane <= 1; lane += 0.25)
          for (let t = -1.5; t <= 1.5; t += 0.02) {
            const side = lane * LANE_SHIFT;
            const g =
              along === 'x'
                ? { x: lamp.x + 0.5 + t, y: lamp.y + 0.5 + side }
                : { x: lamp.x + 0.5 + side, y: lamp.y + 0.5 + t };
            if (Math.hypot(g.x - foot.x, g.y - foot.y) > 0.4) continue;
            if (g.x + g.y >= foot.x + foot.y) continue;
            passes++;
            const f = face(project(g.x, g.y));
            for (const [x, y, w, h] of head)
              expect(x < f.right && x + w > f.left && y < f.bottom && y + h > f.top).toBe(false);
          }
    }
    expect(passes).toBeGreaterThan(100);
  });

  it("carries each home's stepping stones on past its lawn in one straight line to the kerb", () => {
    const calls = paint();
    const tops = new Set(
      calls.filter((call) => call.name === 'moveTo').map((call) => call.args.join()),
    );
    const { x, y, dx, dy, ry } = STEPPING_STONES;
    for (const place of places) {
      const plot = getPlot(place.plot)!;
      const centre = plotCenter(plot);
      const stones = [0, 1, 2, 3, 4].map((k) => {
        const screen = {
          x: centre.x + (x + k * dx) * HOUSE_SCALE,
          y: centre.y + (y + k * dy) * HOUSE_SCALE,
        };
        const world = unproject(screen.x, screen.y);
        return { screen, lot: { x: world.x - plot.x, y: world.y - plot.y } };
      });
      // The last two lie on the ground past the lawn; the ground layer paints them.
      for (const { screen } of stones.slice(3))
        expect(tops.has(`${screen.x},${screen.y - ry * HOUSE_SCALE}`), place.id).toBe(true);
      for (const [k, { lot }] of stones.entries()) {
        expect(lot.x).toBeCloseTo(STONE_X, 2);
        if (k)
          expect(lot.y - stones[k - 1].lot.y).toBeCloseTo(stones[1].lot.y - stones[0].lot.y, 9);
      }
      expect(stones[4].lot.y).toBeGreaterThanOrEqual(KERB_OFFSET.y);
    }
  });

  it('lays a rug or a blanket under every picnic seat on the green', () => {
    const green = VENUES.find((venue) => venue.kind === 'green')!;
    for (const night of [false, true]) {
      const recorder = recordingContext();
      drawVenue(recorder.ctx, green, 0, 0, night, undefined, 800, 'ground');
      const rugs = filledPaths(recorder.calls).filter((path) => path.points.length === 4);
      let blankets = 0;
      for (const spot of EVENT_SPOTS.green) {
        const seat = project(spot.x, spot.y);
        const under = rugs.filter((rug) => inside(rug.points, [seat.x, seat.y]));
        expect(under.length, `${spot.x},${spot.y}`).toBeGreaterThan(0);
        if (!onPatchwork(seat.x, seat.y)) blankets++;
      }
      // The two guests furthest out bring their own.
      expect(blankets).toBe(2);
    }
  });

  it("stows the cinema screen's masts with it, out of the Lunch Green's gathering", () => {
    // Raised, the masts reach just over the cloth's lifting bar; stowed, just over its cassette.
    expect(mastHeight(1)).toBe(157);
    expect(mastHeight(0)).toBeLessThanOrEqual(12);
    const green = VENUES.find((venue) => venue.kind === 'green')!;
    // Every guest's reach on the map, sitting or standing: 1.25 times a figure's own.
    const guests = EVENT_SPOTS.green.map((_, i) => {
      const { position } = eventSpot(green, i);
      const p = project(position.x, position.y);
      return { left: p.x - 22.5, right: p.x + 22.5, top: p.y - 60, bottom: p.y + 6.25 };
    });
    const feet = MAST_X.map((x) => project(x, 14.7));
    /** The frame's two masts as painted, and the top edge of the cloth's lifting bar. */
    const frame = (minutes: number, day: number) => {
      const recorder = matrixContext();
      for (const object of drawCinema(recorder.ctx, minutes, day, false)) object.paint();
      const box = (index: number) => {
        const corners = recorder.points.filter((p) => p.index === index);
        const xs = corners.map((p) => p.x),
          ys = corners.map((p) => p.y);
        return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), corners };
      };
      const masts = recorder.calls.flatMap((call, index) => {
        if (call.name !== 'fillRect' || call.args[2] !== 6) return [];
        const mast = { ...box(index), bottom: 0 };
        mast.bottom = Math.max(...mast.corners.map((p) => p.y));
        return feet.some((foot) => Math.abs(mast.left + 3 - foot.x) < 1e-6) ? [mast] : [];
      });
      const bar = recorder.calls.findIndex(
        (call) => call.name === 'fillRect' && call.fillStyle === '#D9CBA4',
      );
      // The bar leans with the screen: its top edge runs through its upper left and right corners.
      const barTop = (x: number) => {
        if (bar < 0) return undefined;
        const { left, right, corners } = box(bar);
        const top = (edge: number) =>
          Math.min(...corners.filter((p) => Math.abs(p.x - edge) < 1e-6).map((p) => p.y));
        return top(left) + ((top(right) - top(left)) * (x - left)) / (right - left);
      };
      return { masts, barTop };
    };
    // Rising at dusk, each mast's top rides just over the lifting bar.
    const dusk = CALENDAR_EPOCH_DAY + 224;
    for (let minutes = 1200.5; minutes < 1206; minutes += 1) {
      const reveal = cinemaAt(minutes, dusk).screenReveal;
      expect(reveal).toBeGreaterThan(0);
      expect(reveal).toBeLessThan(1);
      const { masts, barTop } = frame(minutes, dusk);
      expect(masts.length).toBe(2);
      for (const mast of masts) {
        const bar = barTop(mast.left + 3)!;
        expect(mast.top).toBeGreaterThanOrEqual(bar - 3);
        expect(mast.top).toBeLessThanOrEqual(bar);
      }
    }
    let masts = 0;
    for (let d = 0; d < 112; d += 11) {
      const day = CALENDAR_EPOCH_DAY + 224 + d;
      const gathering = eventsForDay(day).find((event) => event.venue.id === green.id)!;
      for (let minutes = gathering.depart; minutes <= gathering.homeBy; minutes += 25) {
        expect(cinemaAt(minutes, day).screenReveal).toBe(0);
        const rects = frame(minutes, day).masts;
        expect(rects.length).toBe(2);
        for (const mast of rects) {
          masts++;
          for (const guest of guests)
            expect(
              mast.left < guest.right &&
                mast.right > guest.left &&
                mast.top < guest.bottom &&
                mast.bottom > guest.top,
              `${day} ${minutes}`,
            ).toBe(false);
        }
      }
    }
    expect(masts).toBeGreaterThan(100);
  });
});
