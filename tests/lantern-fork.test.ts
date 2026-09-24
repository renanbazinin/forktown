import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  drawLanternFork,
  FORK_LOBES,
  FORK_SLOTS,
  slotBox,
  type ForkSlot,
} from '../src/city/lantern-fork';
import { drawGlow, LIGHT } from '../src/city/glow';
import { LAMPS, lampOn, MAX_LAMP_DISTANCE, MIN_LAMP_DISTANCE } from '../src/city/lamplight';
import { drawHouse, houseBounds } from '../src/city/houses';
import { forkPlot } from '../src/city/render';
import { HOUSE_PLOTS } from '../src/lib/events';
import {
  FORK_BOUNDS,
  FORK_PLOT,
  FOUNDER_SLOTS,
  lanternRegister,
  type LanternRegister,
} from '../src/lib/lanterns';
import { placeSchema, type Place } from '../src/lib/schema';
import { getPlot, STREETLIGHTS } from '../src/lib/world';
import { recordingContext, type RecordedCall } from './recording-context';

const places = readdirSync('places')
  .filter((file) => file.endsWith('.json'))
  .map((file) => placeSchema.parse(JSON.parse(readFileSync(`places/${file}`, 'utf8'))));
const ARRIVALS = [
  'rehovot-orchard',
  'willow-lodge',
  'vaxsius-markus',
  'moss-nook',
  'mulu-s',
  'jons-arcade',
  'arts',
  'funky-fun',
  'my-little-place',
  'after-hours',
  'evergreen',
  'hello-world',
  'little-workshop',
  'moonbeam-cafe',
  'plot-twist',
  'stargazer',
  'sunday-morning',
];
const register = lanternRegister(places, ARRIVALS);
const inBounds = (x: number, y: number) =>
  x >= FORK_BOUNDS.left &&
  x <= FORK_BOUNDS.right &&
  y >= FORK_BOUNDS.top &&
  y <= FORK_BOUNDS.bottom;
const inLobe = (
  lobe: { cx: number; cy: number; rx: number; ry: number },
  x: number,
  y: number,
  grow = 0,
) => ((x - lobe.cx) / (lobe.rx + grow)) ** 2 + ((y - lobe.cy) / (lobe.ry + grow)) ** 2 <= 1;
const corners = (slot: ForkSlot) => {
  const { x, y, w, h } = slotBox(slot);
  return [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ];
};

function paintFork(options: { register?: LanternRegister; lit?: number; taleId?: string }) {
  const recorder = recordingContext();
  const objects = drawLanternFork(recorder.ctx, {
    x: 0,
    y: 0,
    depth: forkPlot.x + forkPlot.y,
    register: options.register ?? register,
    lit: options.lit ?? 0,
    taleId: options.taleId,
    night: true,
    leaf: '#365A4F',
    leafLight: '#507569',
  });
  objects.forEach((object) => object.paint());
  return { ...recorder, objects };
}
const filled = (calls: RecordedCall[], color: string) =>
  calls.filter((call) => call.name === 'fillRect' && call.fillStyle === color);

function stubDocument() {
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => recordingContext().ctx }),
  });
}
afterEach(() => vi.unstubAllGlobals());

describe('Lantern slots on the Fork', () => {
  it('has room for every founder and every house plot', () => {
    expect(FORK_SLOTS.length).toBeGreaterThanOrEqual(FOUNDER_SLOTS + HOUSE_PLOTS.length);
  });
  it('hangs the founders under the left lobe, clear of the fork', () => {
    for (const slot of FORK_SLOTS.slice(0, FOUNDER_SLOTS)) {
      expect(slot.x + 3).toBeLessThanOrEqual(-12);
      for (const [x, y] of corners(slot)) expect(inLobe(FORK_LOBES.left, x, y)).toBe(true);
    }
  });
  it('keeps the hand-placed neighbour arcs', () => {
    expect(FORK_SLOTS.slice(8, 24).map(({ x, y }) => [x, y])).toEqual([
      [10, -88],
      [17, -86],
      [24, -85],
      [31, -85],
      [38, -87],
      [45, -76],
      [52, -74],
      [59, -73],
      [66, -75],
      [20, -94],
      [34, -94],
      [50, -81],
      [64, -81],
      [14, -100],
      [27, -100],
      [40, -100],
    ]);
  });
  it('keeps every lantern inside the bounds and a lobe, with no two touching', () => {
    const lobes = Object.values(FORK_LOBES);
    FORK_SLOTS.forEach((slot, i) => {
      const box = corners(slot);
      for (const [x, y] of box) expect(inBounds(x, y)).toBe(true);
      // Placed arcs hang on the canopy's lower edge; generated slots sit well inside a lobe.
      const grow = i < 24 ? 1 : -1;
      expect(lobes.some((lobe) => box.every(([x, y]) => inLobe(lobe, x, y, grow)))).toBe(true);
    });
    const boxes = FORK_SLOTS.map(slotBox);
    boxes.forEach((a, i) =>
      boxes.slice(i + 1).forEach((b) => {
        const apart =
          a.x + a.w + 1 <= b.x ||
          b.x + b.w + 1 <= a.x ||
          a.y + a.h + 1 <= b.y ||
          b.y + b.h + 1 <= a.y;
        expect(apart).toBe(true);
      }),
    );
  });
  it('computes the same slots on a fresh import', async () => {
    vi.resetModules();
    const fresh = await import('../src/city/lantern-fork');
    expect(fresh.FORK_SLOTS).toEqual(FORK_SLOTS);
  });
});

describe('Painting the Lantern Fork', () => {
  it('stays inside FORK_BOUNDS and sorts as a tree and a plaque', () => {
    const { calls, objects } = paintFork({ lit: 17, taleId: 'mulu-s' });
    expect(forkPlot).toEqual(getPlot(FORK_PLOT));
    expect(objects.map((object) => object.depth)).toEqual([
      forkPlot.x + forkPlot.y + 0.5,
      forkPlot.x + forkPlot.y + 1.3,
    ]);
    const points = calls.flatMap(({ name, args, offset }) => {
      const [x, y, a, b] = args as number[];
      if (name === 'fillRect')
        return [
          [offset.x + x, offset.y + y],
          [offset.x + x + a, offset.y + y + b],
        ];
      if (name === 'moveTo' || name === 'lineTo') return [[offset.x + x, offset.y + y]];
      if (name === 'ellipse')
        return [
          [offset.x + x - a, offset.y + y - b],
          [offset.x + x + a, offset.y + y + b],
        ];
      return [];
    });
    expect(points.length).toBeGreaterThan(100);
    for (const [x, y] of points) expect(inBounds(x, y), `${x},${y}`).toBe(true);
    // The plaque and its posts span x -22..62 and y 14..42.
    const plaque = calls.filter((call) => call.offset.x === 20 && call.name === 'fillRect');
    expect(plaque.length).toBeGreaterThan(0);
    expect(filled(calls, '#6E7560').map((call) => call.args)).toEqual([
      [-6, 34, 4, 8],
      [40, 34, 4, 8],
    ]);
  });
  it('draws one glow for each lit lantern and none before nightfall', () => {
    stubDocument();
    expect(paintFork({ lit: 6 }).calls.filter((call) => call.name === 'drawImage')).toHaveLength(6);
    expect(paintFork({ lit: 0 }).calls.filter((call) => call.name === 'drawImage')).toHaveLength(0);
  });
  it('marks only tonight’s tale with a tag and only the newest neighbour with a bow', () => {
    expect(filled(paintFork({ taleId: 'mulu-s' }).calls, LIGHT.tag)).toHaveLength(1);
    expect(filled(paintFork({}).calls, LIGHT.tag)).toHaveLength(0);
    const bow = filled(paintFork({}).calls, LIGHT.pennantNight);
    const newest = FORK_SLOTS[register.byId.get('rehovot-orchard')!.slot];
    expect(bow).toHaveLength(3);
    for (const call of bow) expect((call.args as number[])[1]).toBe(newest.y - 1);
    const shallow = lanternRegister(places, []);
    expect(shallow.newest).toBeUndefined();
    expect(filled(paintFork({ register: shallow }).calls, LIGHT.pennantNight)).toHaveLength(0);
  });
});

describe('Houses wait for their lanterns', () => {
  const home: Place = places.find((place) => place.design.windows !== 'round')!;
  const paintHouse = (night: boolean, lantern?: Parameters<typeof drawHouse>[6]) => {
    const recorder = recordingContext();
    drawHouse(recorder.ctx, home, 0, 0, night, 1.12, lantern);
    return recorder;
  };
  it('keeps the legacy night windows when no lantern is given', () => {
    expect(paintHouse(true).fills).toContain('#F1D68F');
    expect(paintHouse(true, { minutes: 1205, activity: 'home' }).fills).toContain('#F1D68F');
  });
  it('shows dark panes and no silhouette until the lantern lights', () => {
    const dark = paintHouse(true, {
      minutes: 1205,
      activity: 'home',
      lantern: { lit: false },
    }).fills;
    expect(dark).not.toContain('#F1D68F');
    expect(dark).not.toContain('#83744D');
    expect(dark).toContain('#4E6461');
    const lit = paintHouse(true, { minutes: 1205, activity: 'home', lantern: { lit: true } });
    expect(lit.fills).toContain('#F1D68F');
    expect(filled(lit.calls, LIGHT.lit)).toHaveLength(1);
  });
  it('draws the post only with a lantern, the pennant only when newest, the tag only for the tale', () => {
    const post = (calls: RecordedCall[]) =>
      calls.filter((call) => call.name === 'fillRect' && `${call.args}` === `${[-48, 1, 1, 14]}`)
        .length;
    expect(post(paintHouse(false).calls)).toBe(0);
    const plain = paintHouse(false, { minutes: 720, lantern: { lit: false } });
    expect(post(plain.calls)).toBe(1);
    expect(plain.fills).not.toContain(LIGHT.pennant);
    expect(plain.fills).not.toContain(LIGHT.tag);
    const newest = paintHouse(false, { minutes: 720, lantern: { lit: false, newest: true } });
    expect(newest.fills).toContain(LIGHT.pennant);
    expect(newest.fills).not.toContain(LIGHT.tag);
    const tale = paintHouse(false, { minutes: 720, lantern: { lit: false, tale: true } });
    expect(tale.fills).toContain(LIGHT.tag);
    expect(tale.fills).not.toContain(LIGHT.pennant);
  });
  it('keeps houseBounds for every building type', () => {
    const heights = {
      cottage: 32,
      cafe: 34,
      bookshop: 43,
      greenhouse: 32,
      studio: 36,
      observatory: 42,
    };
    for (const [building, base] of Object.entries(heights))
      for (const roof of ['classic', 'flat', 'gable'] as const)
        for (const floors of [1, 2, 3] as const) {
          const height = base + (floors - 1) * 23;
          const top =
            roof === 'classic' && building === 'observatory' ? 45 : roof === 'flat' ? 14 : 34;
          expect(
            houseBounds({
              ...home,
              building: building as Place['building'],
              design: { ...home.design, roof, floors },
            }),
          ).toEqual({ height, top: height + top + 8, bottom: 46, left: 72, right: 72 });
        }
  });
});

describe('Glow and the lamp wave', () => {
  it('draws no glow without a document', () => {
    const { ctx, calls } = recordingContext();
    drawGlow(ctx, 0, 0, 10, 0.5);
    expect(calls).toHaveLength(0);
  });
  it('restores alpha and smoothing after a glow', () => {
    stubDocument();
    const { ctx, calls } = recordingContext();
    ctx.globalAlpha = 0.8;
    ctx.imageSmoothingEnabled = false;
    drawGlow(ctx, 4, 6, 10, 0.5);
    expect(calls.map((call) => call.name)).toEqual(['drawImage']);
    expect(calls[0].args.slice(1)).toEqual([-6, -4, 20, 20]);
    expect(ctx.globalAlpha).toBe(0.8);
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });
  it('measures every lamp by its Manhattan distance from the Fork', () => {
    const fork = getPlot(FORK_PLOT)!;
    expect(LAMPS).toHaveLength(STREETLIGHTS.length);
    for (const lamp of LAMPS)
      expect(lamp.distance).toBe(Math.abs(lamp.x - fork.x) + Math.abs(lamp.y - fork.y));
    expect(MAX_LAMP_DISTANCE).toBeGreaterThan(MIN_LAMP_DISTANCE);
  });
  it('lights the nearest lamp at 20:20 and the farthest at 20:30', () => {
    expect(LAMPS.every((lamp) => !lampOn(lamp.distance, 1219.999))).toBe(true);
    expect(lampOn(MIN_LAMP_DISTANCE, 1220)).toBe(true);
    expect(lampOn(MAX_LAMP_DISTANCE, 1229.999)).toBe(false);
    expect(lampOn(MAX_LAMP_DISTANCE, 1230)).toBe(true);
    expect(LAMPS.every((lamp) => lampOn(lamp.distance, 1230) && lampOn(lamp.distance, 300))).toBe(
      true,
    );
    expect(LAMPS.some((lamp) => lampOn(lamp.distance, 360))).toBe(false);
  });
});
