import { describe, expect, it } from 'vitest';
import {
  drawZoo,
  ZOO_GATE_PILLARS,
  ZOO_GATE_RECT,
  ZOO_HABITAT_SIGNS,
  ZOO_KIOSK,
  ZOO_SIGN,
  ZOO_ZOOMIES_TRACK,
  zooSignRect,
} from '../src/city/zoo';
import { ICE } from '../src/city/season-palette';
import { ZOO_LAYOUT } from '../src/lib/zoo-layout';
import {
  ZOO_CENTER,
  ZOO_GATE,
  ZOO_HABITATS,
  zooAnimalsAt,
  zooProps,
  zooTree,
} from '../src/lib/zoo';
import { townSeasonAt } from '../src/lib/seasons';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { project } from '../src/lib/world';
import { recordingContext } from './recording-context';

// Willow Grove Zoo's grounds through the renderer's eyes: the gate and the boards never cover
// each other or the visitors, the layout leaves the animals room, the whole zoo is skipped out of
// view, and it keeps the town's rules for light and snow.

const dayOf = (yearDay: number) => CALENDAR_EPOCH_DAY + 224 + yearDay;
const SUMMER = dayOf(42);
const DEEP_WINTER = dayOf(95);
const isNight = (minutes: number) => minutes < 360 || minutes >= 1200;

type Visible = (
  point: { x: number; y: number },
  rx: number,
  above: number,
  below: number,
) => boolean;
function paint(day: number, minutes: number, visible: Visible = () => true, animals = true) {
  const record = recordingContext();
  const objects = drawZoo(record.ctx as unknown as CanvasRenderingContext2D, {
    minutes,
    day,
    night: isNight(minutes),
    season: townSeasonAt(day, minutes),
    visible,
  });
  [...objects]
    .filter((object) => animals || object.part !== 'animal')
    .sort((a, b) => a.depth - b.depth)
    .forEach((object) => object.paint());
  const fills = record.calls
    .filter((call) => call.name === 'fill' || call.name === 'fillRect')
    .map((call) => String(call.fillStyle));
  return { calls: record.calls, fills, objects };
}
const overlap = (a: ReturnType<typeof zooSignRect>, b: ReturnType<typeof zooSignRect>) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe('Willow Grove Zoo grounds', () => {
  it('never lets two habitat boards, or a board and the gate plaque, overlap on screen', () => {
    const rects = [ZOO_GATE_RECT, ...ZOO_HABITAT_SIGNS.map(zooSignRect)];
    const names = ['gate', ...ZOO_HABITAT_SIGNS.map((sign) => sign.id)];
    const clashes: string[] = [];
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        if (overlap(rects[i], rects[j])) clashes.push(`${names[i]} × ${names[j]}`);
    expect(clashes).toEqual([]);
    // Every habitat keeps its own board, and the future pens say what they are for.
    expect(ZOO_HABITAT_SIGNS.map((sign) => sign.title)).toEqual(ZOO_HABITATS.map((h) => h.name));
    for (const sign of ZOO_HABITAT_SIGNS.filter((sign) => sign.future))
      expect(sign.subtitle).toBe('ROOM TO GROW');
  });

  it('keeps the boards in front of the promenade below the visitors’ feet', () => {
    // A board hung on a row-1 back fence stands between the viewer and the promenade: its top
    // edge must stay below the line the visitors stand on, at every point along it.
    for (const sign of ZOO_HABITAT_SIGNS.filter((sign) => !sign.front)) {
      const clearance = (sign.point.y - ZOO_CENTER.y) * 38 - sign.rise;
      expect(clearance, sign.id).toBeGreaterThanOrEqual(4);
    }
  });

  it('builds the gate over the side path with head room under the plaque', () => {
    const [west, east] = ZOO_GATE_PILLARS;
    expect(west.y).toBe(east.y);
    expect(west.x).toBeLessThan(ZOO_GATE.x - 0.25);
    expect(east.x).toBeGreaterThan(ZOO_GATE.x + 0.25);
    // The plaque is centred between the pillars and clears a walker by a head.
    expect(ZOO_SIGN.point.x).toBeCloseTo((west.x + east.x) / 2, 5);
    expect(ZOO_SIGN.rise - ZOO_SIGN.height).toBeGreaterThanOrEqual(40);
  });

  it('keeps the tall things in the giraffe pen clear of the gate and the kiosk on screen', () => {
    // Screen boxes of the painted art, in px from each ground point.
    type Box = { left: number; right: number; top: number; bottom: number };
    const around = (x: number, y: number, half: number, above: number, below = 0): Box => {
      const p = project(x, y);
      return { left: p.x - half, right: p.x + half, top: p.y - above, bottom: p.y + below };
    };
    const hits = (a: Box, b: Box) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const giraffe = ZOO_HABITATS.find((h) => h.animal === 'giraffe')!;
    const tree = zooTree(giraffe);
    const feeder = zooProps(giraffe).find((p) => p.kind === 'feeder')!;
    const crown = around(tree.x, tree.y, 34, 72, -56);
    const trunk = around(tree.x, tree.y, 6, 72);
    const basket = around(feeder.left + feeder.width / 2, feeder.top + feeder.height / 2, 11, 75);
    const pillars = ZOO_GATE_PILLARS.map((p) => around(p.x, p.y, 9, 108, 1));
    // The kiosk, eaves included: from its left and right corners, ground to roof.
    const k = ZOO_KIOSK;
    const [left, right, front] = [
      project(k.left - 0.1, k.top + k.height + 0.1),
      project(k.left + k.width + 0.1, k.top - 0.1),
      project(k.left + k.width, k.top + k.height),
    ];
    const kiosk = { left: left.x, right: right.x, top: right.y - 28, bottom: front.y };
    for (const [i, pillar] of pillars.entries()) {
      expect(hits(pillar, crown), `pillar ${i} × acacia`).toBe(false);
      expect(hits(pillar, trunk), `pillar ${i} × acacia trunk`).toBe(false);
      expect(hits(pillar, basket), `pillar ${i} × feeder`).toBe(false);
    }
    expect(hits(kiosk, basket), 'kiosk × feeder').toBe(false);
    expect(hits(kiosk, crown), 'kiosk × acacia').toBe(false);
    // The acacia stands framed between the pillars, under the beam.
    const [west, east] = pillars;
    expect(crown.left).toBeGreaterThan(west.right);
    expect(crown.right).toBeLessThan(east.left);
    const beam = project(ZOO_SIGN.point.x, ZOO_SIGN.point.y).y - (ZOO_SIGN.rise - ZOO_SIGN.height);
    expect(crown.top).toBeGreaterThan(beam + 8);
  });

  it('wears the zebras’ track into the grass where their zoomies run', () => {
    const zebra = ZOO_HABITATS.find((h) => h.animal === 'zebra')!;
    const cx = zebra.left + zebra.width / 2,
      cy = zebra.top + zebra.height / 2;
    const { rx, ry, width } = ZOO_ZOOMIES_TRACK;
    let running = 0;
    for (let t = 0; t < 1440 * 2; t += 0.5)
      for (const a of zooAnimalsAt(t)) {
        if (a.species !== 'zebra' || a.action?.phase !== 'run') continue;
        running++;
        const r = Math.hypot((a.position.x - cx) / rx, (a.position.y - cy) / ry);
        // Within the track's width either side of the loop.
        expect(Math.abs(r - 1) * Math.min(rx, ry), `${a.id} at ${t}`).toBeLessThanOrEqual(
          width + 0.05,
        );
      }
    expect(running).toBeGreaterThan(20);
  });

  it('keeps solid props inside their habitat, apart, and the animals most of the ground', () => {
    for (const h of ZOO_HABITATS.filter((h) => h.animal)) {
      const solid = zooProps(h).filter((p) => p.solid);
      for (const p of solid) {
        expect(p.left, `${h.id} ${p.kind}`).toBeGreaterThanOrEqual(h.left + 0.2);
        expect(p.top, `${h.id} ${p.kind}`).toBeGreaterThanOrEqual(h.top + 0.2);
        expect(p.left + p.width, `${h.id} ${p.kind}`).toBeLessThanOrEqual(
          h.left + h.width - 0.2 + 1e-9,
        );
        expect(p.top + p.height, `${h.id} ${p.kind}`).toBeLessThanOrEqual(
          h.top + h.height - 0.2 + 1e-9,
        );
      }
      for (const [i, a] of solid.entries())
        for (const b of solid.slice(i + 1)) {
          // The island stands in the pool.
          if ([a.kind, b.kind].includes('island') && [a.kind, b.kind].includes('pool')) continue;
          const gap = Math.max(
            b.left - (a.left + a.width),
            a.left - (b.left + b.width),
            b.top - (a.top + a.height),
            a.top - (b.top + b.height),
          );
          expect(gap, `${h.id} ${a.kind}/${b.kind}`).toBeGreaterThanOrEqual(0.4 - 1e-9);
        }
      const covered = solid
        .filter((p) => p.kind !== 'island')
        .reduce((sum, p) => sum + p.width * p.height, 0);
      expect(covered / (h.width * h.height), h.id).toBeLessThanOrEqual(0.6);
    }
    expect(Object.keys(ZOO_LAYOUT).sort()).toEqual(['elephant', 'giraffe', 'penguin', 'zebra']);
  });

  it('skips the whole zoo when its frame is out of view', () => {
    const { calls, objects } = paint(SUMMER, 900, () => false);
    expect(calls).toEqual([]);
    expect(objects).toEqual([]);
    // A view of one habitat culls most of the rest.
    const elephant = ZOO_HABITATS.find((h) => h.animal === 'elephant')!;
    const middle = project(elephant.left + elephant.width / 2, elephant.top + elephant.height / 2);
    const near = (point: { x: number; y: number }, rx: number, above: number, below: number) =>
      point.x + rx >= middle.x - 400 &&
      point.x - rx <= middle.x + 400 &&
      point.y + below >= middle.y - 250 &&
      point.y - above <= middle.y + 250;
    expect(paint(SUMMER, 900, near).calls.length).toBeLessThan(paint(SUMMER, 900).calls.length);
  });

  it('paints the same frame twice and stays within its call budget', () => {
    let most = 0;
    for (const day of [SUMMER, DEEP_WINTER, dayOf(10), dayOf(66)])
      for (const minutes of [180, 720, 900, 1290]) {
        const a = paint(day, minutes),
          b = paint(day, minutes);
        expect(a.calls).toEqual(b.calls);
        most = Math.max(most, a.calls.length);
      }
    // The whole zoo, animals included, at its busiest.
    expect(most).toBeLessThanOrEqual(7000);
  });

  it('shows amber only in the gate lanterns, and only once the lamps are lit', () => {
    const LANTERN = '#F1D68F',
      HALO = '#FFE2A016';
    const amberLike = (colour: string) => {
      if (!/^#[0-9A-F]{6}$/i.test(colour)) return false;
      const n = parseInt(colour.slice(1), 16);
      const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
      return r >= 0xe0 && g >= 0xb0 && g <= 0xea && b <= 0xb8 && r - b >= 0x40;
    };
    for (const day of [SUMMER, DEEP_WINTER])
      for (const minutes of [720, 1100, 1205, 1290, 180]) {
        // The grounds alone: the animals keep their own palette rules.
        const { fills } = paint(day, minutes, undefined, false);
        const lit = fills.filter((colour) => colour === LANTERN).length;
        if (!isNight(minutes) || minutes === 1205) expect(lit, `${minutes}`).toBe(0);
        if (minutes === 1290 || minutes === 180) expect(lit, `${minutes}`).toBe(2);
        expect(fills.filter((colour) => colour === HALO && !isNight(minutes))).toEqual([]);
        expect(fills.filter((colour) => colour !== LANTERN && amberLike(colour))).toEqual([]);
      }
  });

  it('skins the three ponds over in deep winter, never the penguin pool', () => {
    const ice = (day: number) =>
      paint(day, 720).fills.filter((colour) => colour === ICE.sheet[0]).length;
    expect(ice(SUMMER)).toBe(0);
    expect(ice(DEEP_WINTER)).toBe(3);
  });
});
