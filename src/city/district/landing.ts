// The Boat Landing (agent C, SPEC §4.5): the slim stage, the paper boats from regattaBoat, the cork
// boom, the boatwright and the boatman, and the cream and sage bunting all Regatta Week. Render
// cap: 600 calls with 10 boats and the boom (SPEC §6.6).
// Every guest sets their boat down on the lawn's river edge as they arrive; the boatwright crosses
// from the stage, picks it up and sets it on the water at its launch; it drifts down the near half
// of the river under the Kingfisher bridge to rest at the boom; the boatman nets it out after.
// Nobody teleports and nothing floats unattended.
// No Math.random, Date.now or performance.now: everything runs on the town clock.
import {
  landingRowY,
  OUTING_TIMES,
  REGATTA_BOATS,
  REGATTA_LAUNCH_EVERY,
  REGATTA_NETTING,
  regattaBoat,
  type RegattaBoat,
} from '../../lib/district-calendar';
import { DISTRICT_SPOTS, LANDING_VENUE, REGATTA_COURSE } from '../../lib/district-places';
import type { ResidentTrip } from '../../lib/resident-trips';
import type { Place } from '../../lib/schema';
import { groundFraction, snowAt, SUMMER } from '../../lib/seasons';
import { getPlot, project, type Point } from '../../lib/world';
import { boatBand, paintPaperBoat } from '../carry/paper-boat';
import type {
  DepthObject,
  DistrictGroundScene,
  DistrictHit,
  DistrictPainter,
  DistrictScene,
} from '../district-art';
import { tint } from '../houses';
import { pick, SNOW, type Pair } from '../season-palette';
import { groundTuft } from '../season-ground';
import {
  box,
  clamp01,
  drawFigure,
  ease,
  FIGURE_SCALE,
  fill,
  iso,
  smooth,
  type FigureHands,
  type Look,
} from './bandstand';

type Ctx = CanvasRenderingContext2D;
type Facing = 'se' | 'sw' | 'ne' | 'nw';

/** Regatta Week's days of the year: Summer 10–16, for the art the ground layer keeps. */
const REGATTA_WEEK = { from: SUMMER + 9, to: SUMMER + 15 } as const;
const regattaGroundDay = (groundDay: number) =>
  groundDay >= REGATTA_WEEK.from && groundDay <= REGATTA_WEEK.to;

const P = {
  lawn: ['#BFD5A4', '#577468'],
  edge: ['#D8CCA6', '#7A8271'],
  edgeShade: ['#C2B58E', '#6A7365'],
  deck: ['#B99670', '#6D6556'],
  plank: ['#A3815D', '#625B4D'],
  side: ['#8F7053', '#544E43'],
  pile: ['#7A6249', '#4D473E'],
  pileTop: ['#9C8263', '#5E584C'],
  rope: ['#8C7A5E', '#5A5547'],
  cork: ['#C9A77A', '#6E6758'],
  float: ['#ECE3CB', '#8C9488'],
  pole: ['#8F7053', '#544E43'],
  flagCream: ['#F0E8D2', '#99A297'],
  flagSage: ['#8FAE84', '#506B5B'],
  wake: ['#D9EAE6', '#7C9DA4'],
  waterline: ['#86AEB4', '#3D5F6A'],
  bench: ['#A8835C', '#635B4C'],
  benchDark: ['#87694A', '#514A3F'],
  benchLeg: ['#5F6B66', '#3B4441'],
  basket: ['#B58D5F', '#665D4D'],
  basketDark: ['#8E6C47', '#524A3E'],
  net: ['#D9D3C0', '#868E86'],
  shadow: ['#23341B26', '#0B171533'],
} satisfies Record<string, Pair>;

// ---------------------------------------------------------------------------------------------
// Who is at the regatta: read from the day's plan, once per plan.

export type RegattaGuest = {
  seat: number;
  id: string;
  arrive: number;
  leave: number;
  /** Their boat's band: their own outfit's colour. */
  band: string;
};
type Guest = RegattaGuest;
type Plan = ReadonlyMap<string, readonly ResidentTrip[]>;
const guestsByPlan = new WeakMap<object, (Guest | undefined)[]>();
/** The day's regatta guests by seat (their boat is boat k), from the plan and the homes. */
const regattaGuests = (scene: DistrictScene) => regattaGuestsOf(scene.plan(), scene.places);
export function regattaGuestsOf(plan: Plan, places: readonly Place[]): (Guest | undefined)[] {
  let guests = guestsByPlan.get(plan);
  if (guests) return guests;
  guests = Array.from({ length: REGATTA_BOATS }, () => undefined);
  const homes = new Map<string, Place>(places.map((place) => [place.id, place]));
  for (const [id, trips] of plan)
    for (const trip of trips as readonly ResidentTrip[])
      if (trip.event.outing === 'regatta' && trip.seat < REGATTA_BOATS) {
        const home = homes.get(id);
        guests[trip.seat] = {
          seat: trip.seat,
          id,
          arrive: trip.arrive,
          leave: trip.leave,
          band: home ? boatBand(home.resident) : '#8FAE84',
        };
      }
  guestsByPlan.set(plan, guests);
  return guests;
}

// ---------------------------------------------------------------------------------------------
// The boatwright: from the stage to each boat on the lawn's edge, and back to the water.

const launchAt = (k: number) => OUTING_TIMES.regatta.start + REGATTA_LAUNCH_EVERY * k;
/**
 * Where guest k sets their boat down as they arrive: at their own feet, a step toward the river
 * on their own row. For the even rows (the front column, at the gravel's edge) that is the frozen
 * handover point, REGATTA_COURSE.handoverX; the odd rows stand 0.55 tiles further in, so their
 * boats rest 0.55 tiles short of it, where their guests are (REQUESTS-C.md: a handover per row).
 */
export const setDownAt = (k: number): Point => ({
  x: DISTRICT_SPOTS.landing[k].x + 0.2,
  y: landingRowY(k),
});
/** Where the boatwright sets a boat on the water: the stage's south tip. */
const LAUNCH_STAND = { x: 62.2, y: 39.36 } as const;
/** The road's lawn-side edge, clear of both of its walking lanes (x 61.28 and 61.72). */
const ROAD_EDGE = 61.05;
/**
 * Where the boatwright stoops to pick boat k up: a step east of it on its own row. That is the
 * road's lawn-side edge for the front column, and in among the guests for the odd rows, along
 * the row's own approach, which keeps clear of every other guest (SPEC §2.3).
 */
const pickAt = (k: number): Point => ({ x: setDownAt(k).x + 0.1, y: landingRowY(k) });
/** The boatwright's way from the stage to boat k: across the road, then in along its row. */
export const boatwrightWay = (k: number): Point[] => {
  const pick = pickAt(k);
  return pick.x < ROAD_EDGE - 1e-9
    ? [LAUNCH_STAND, { x: ROAD_EDGE, y: pick.y }, pick]
    : [LAUNCH_STAND, pick];
};
const lengthOf = (way: readonly Point[]) =>
  way.slice(1).reduce((sum, b, i) => sum + Math.hypot(b.x - way[i].x, b.y - way[i].y), 0);
/** Tiles a minute: a brisk step, more than twice a neighbor's stroll. Rows 7 and 9, far down the
 *  lawn and in among the guests, take a little more (at most 0.96), and so would a late guest. */
const BRISK = 0.78;
/** Minutes halfway down, picking a boat up or setting it on the water. */
const STOOP = 0.3;
/** The boatwright's hours on a regatta day. */
const BOATWRIGHT = { in: 825, out: 996 } as const;

type Leg = { from: number; to: number; a: Point; b: Point; carry?: number; stoop?: boolean };
type Errand = { k: number; legs: Leg[]; ashoreUntil: number };
const errandsByGuests = new WeakMap<object, Errand[]>();
/** A walk along `way` from `from` to `to`: a leg a stretch, each its share of the minutes. */
function walk(way: readonly Point[], from: number, to: number, carry?: number): Leg[] {
  const total = lengthOf(way);
  let at = from;
  return way.slice(1).map((b, i) => {
    const a = way[i];
    const end =
      i === way.length - 2 ? to : at + ((to - from) * Math.hypot(b.x - a.x, b.y - a.y)) / total;
    const leg: Leg = { from: at, to: end, a, b, carry };
    at = end;
    return leg;
  });
}
/**
 * The boatwright's round, one boat at a time in launch order: walk from the stage to the boat
 * (once its guest has set it down), stoop and pick it up, carry it back, stoop and set it on the
 * water at its launch minute. Every step is pure in the guests' arrivals.
 */
function boatwrightRound(guests: readonly (Guest | undefined)[]): Errand[] {
  let errands = errandsByGuests.get(guests);
  if (errands) return errands;
  errands = [];
  let free = BOATWRIGHT.in + 1.5;
  for (let k = 0; k < REGATTA_BOATS; k++) {
    const guest = guests[k];
    if (!guest) continue;
    const launch = launchAt(k);
    const way = boatwrightWay(k);
    const pick = way.at(-1)!;
    const d = lengthOf(way);
    const carryEnd = launch - STOOP;
    // A brisk walk each way; for the farthest rows, a little quicker, the same both ways, when
    // the last launch leaves no more time for the round.
    const walking = Math.min(d / BRISK, (launch - free - 2 * STOOP) / 2);
    // Picked up in good time for the walk back, but never before the guest has set it down.
    const pickedUp = Math.max(guest.arrive + 0.2 + STOOP, carryEnd - walking);
    const reached = pickedUp - STOOP;
    const leave = Math.max(free, reached - walking);
    errands.push({
      k,
      ashoreUntil: pickedUp - STOOP / 2,
      legs: [
        ...walk(way, leave, reached),
        { from: reached, to: pickedUp, a: pick, b: pick, stoop: true, carry: pickedUp - STOOP / 2 },
        ...walk([...way].reverse(), pickedUp, carryEnd, pickedUp),
        {
          from: carryEnd,
          to: launch,
          a: LAUNCH_STAND,
          b: LAUNCH_STAND,
          stoop: true,
          carry: carryEnd,
        },
      ],
    });
    free = launch + 0.2;
  }
  errandsByGuests.set(guests, errands);
  return errands;
}

const facingOf = (dx: number, dy: number): Facing =>
  Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'se' : 'nw') : dy >= 0 ? 'sw' : 'ne';

type Walker = {
  at: Point;
  facing: Facing;
  stance: 'stand' | 'walk' | 'crouch';
  phase: number;
  /** The boat in hand, by seat. */
  carrying?: number;
};
/** Where the boatwright is and what they hold, at a minute. */
export function boatwrightAt(
  guests: readonly (Guest | undefined)[],
  minutes: number,
): (Walker & { alpha: number }) | undefined {
  if (minutes < BOATWRIGHT.in || minutes >= BOATWRIGHT.out + 2) return undefined;
  const alpha = Math.min(ease(minutes, BOATWRIGHT.in, 1.5), 1 - ease(minutes, BOATWRIGHT.out, 2));
  const idle = {
    at: LAUNCH_STAND,
    facing: 'sw' as Facing,
    stance: 'stand' as const,
    phase: 0,
    alpha,
  };
  for (const errand of boatwrightRound(guests))
    for (const leg of errand.legs) {
      if (minutes < leg.from || minutes >= leg.to) continue;
      const carrying = leg.carry !== undefined && minutes >= leg.carry ? errand.k : undefined;
      if (leg.stoop) {
        const toWater = leg.a === LAUNCH_STAND;
        return { ...idle, at: leg.a, facing: toWater ? 'sw' : 'nw', stance: 'crouch', carrying };
      }
      const f = (minutes - leg.from) / (leg.to - leg.from);
      const dx = leg.b.x - leg.a.x,
        dy = leg.b.y - leg.a.y;
      const walked = Math.hypot(dx, dy) * f;
      return {
        at: { x: leg.a.x + dx * f, y: leg.a.y + dy * f },
        facing: facingOf(dx, dy),
        stance: 'walk',
        phase: (walked * 3) % 1,
        carrying,
        alpha,
      };
    }
  return idle;
}

// ---------------------------------------------------------------------------------------------
// The boatman: nets each boat out at the boom, one every three minutes, into a basket.

const BOATMAN = { in: 995, out: REGATTA_NETTING.to + 1 } as const;
/** Minutes of one scoop: out over the boat, up with it, and over into the basket. */
const SCOOP = 0.9;
/** Where the boatman stands to reach boat k at rest: on the bank's edge beside it, clear of the
 *  road's river-side walking lane (x 61.72). */
const netStand = (k: number) => ({
  x: 61.9,
  y: REGATTA_COURSE.boomY - REGATTA_COURSE.restGap * k + 0.04,
});
const nettedAt = (k: number) => REGATTA_NETTING.from + REGATTA_NETTING.every * k;
/** Where the boatman is: walking up from the south, then a step north for each boat. */
function boatmanAt(guests: readonly (Guest | undefined)[], minutes: number) {
  if (minutes < BOATMAN.in || minutes >= BOATMAN.out + 2) return undefined;
  const alpha = Math.min(ease(minutes, BOATMAN.in, 1.5), 1 - ease(minutes, BOATMAN.out, 2));
  const boats = guests.flatMap((guest, k) => (guest ? [k] : []));
  // The boat they are working toward: the first not yet netted.
  const next = boats.find((k) => minutes < nettedAt(k) + SCOOP) ?? boats.at(-1);
  if (next === undefined) return undefined;
  const before = boats[boats.indexOf(next) - 1];
  const here = netStand(next);
  // A step north to the next boat, in the half minute after the last scoop.
  const stepFrom = before === undefined ? -Infinity : nettedAt(before) + SCOOP;
  const f = clamp01((minutes - stepFrom) / 0.5);
  const there = before === undefined ? here : netStand(before);
  const at = { x: there.x + (here.x - there.x) * f, y: there.y + (here.y - there.y) * f };
  const scoop = clamp01((minutes - nettedAt(next)) / SCOOP);
  return {
    at,
    walking: f > 0 && f < 1,
    phase: (Math.abs(here.y - there.y) * f * 3) % 1,
    next,
    scoop: minutes >= nettedAt(next) ? scoop : 0,
    netted: boats.filter((k) => minutes >= nettedAt(k) + SCOOP * NET_DROP).length,
    alpha,
  };
}

/** Where in the scoop the net reaches a boat, and where it drops it into the basket. */
const NET_REACH = 0.35,
  NET_DROP = 0.88;

/**
 * Where boat k is at a minute: in its guest's hands on the way there, set down on the lawn's
 * edge, in the boatwright's hands, on the water, in the boatman's net, or in his basket. Exactly
 * one place at a time, so nobody teleports and nothing floats unattended. Undefined when seat k
 * has no guest today: no guest, no boat.
 */
export function boatAt(
  guests: readonly (Guest | undefined)[],
  k: number,
  minutes: number,
): 'hand' | 'ashore' | 'carried' | 'water' | 'net' | 'basket' | undefined {
  const guest = guests[k];
  if (!guest) return undefined;
  if (minutes < guest.arrive) return 'hand';
  const errand = boatwrightRound(guests).find((e) => e.k === k)!;
  if (minutes < errand.ashoreUntil) return 'ashore';
  if (minutes < launchAt(k)) return 'carried';
  if (minutes < nettedAt(k) + SCOOP * NET_REACH) return 'water';
  if (minutes < nettedAt(k) + SCOOP * NET_DROP) return 'net';
  return 'basket';
}

// ---------------------------------------------------------------------------------------------
// Art.

const BOATWRIGHT_LOOK: Look = { skin: '#C99B74', hair: '#5A5048', outfit: '#6F8A9E' };
const BOATMAN_LOOK: Look = { skin: '#B98563', hair: '#8C857C', outfit: '#7E8B5C' };

/**
 * A paper boat afloat, sitting low: its fold, its rim and the two rows of its hull in the
 * folder's colour, as [row, from x, to x, part] in px from the boat's point. It is as wide as
 * the boat in hand (paper-boat.ts at the town's 1.25), its fold lower on the water. Nothing rises
 * more than 4 px over that point, so a boat slipping under the Kingfisher bridge stays clear of
 * the glass above it (REQUESTS-C.md 2).
 */
const BOAT_ROWS = [
  [-4, -1, 0, 'fold'],
  [-3, -2, 1, 'fold'],
  [-2, -4, 3, 'rim'],
  [-1, -3, 2, 'band'],
  [0, -2, 1, 'band'],
] as const;
const BOAT_PAPER = {
  fold: ['#FFFFFB', '#B9C2BD'],
  rim: ['#F6F5EE', '#B1BAB6'],
} satisfies Record<string, Pair>;
/**
 * The boat side on down the river, its bow to the south-west on screen, sheared to the iso slope.
 * Its fold bobs a pixel on the river's swell.
 */
function drawBoat(ctx: Ctx, p: Point, band: string, night: boolean, bob = 0) {
  const x = Math.round(p.x),
    y = Math.round(p.y);
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, -0.5, 0, 1, 0, 0);
  for (const [row, from, to, part] of BOAT_ROWS) {
    ctx.fillStyle =
      part === 'band' ? (night ? tint(band, -30) : band) : pick(BOAT_PAPER[part], night);
    ctx.fillRect(from, row + (part === 'fold' ? bob : 0), to - from + 1, 1);
  }
  ctx.restore();
  // The water's darker line along the hull.
  box(ctx, x - 3, y + 1, 7, 1, pick(P.waterline, night));
}
/** A boat set down on the lawn's edge: the boat in hand, the same size, on its own shadow. */
function drawAshoreBoat(ctx: Ctx, p: Point, band: string, night: boolean) {
  const x = Math.round(p.x),
    y = Math.round(p.y);
  box(ctx, x - 5, y - 1, 10, 2, pick(P.shadow, night));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(FIGURE_SCALE, FIGURE_SCALE);
  paintPaperBoat((rx, ry, w, h, color) => box(ctx, rx, ry, w, h, color), 0, 0, band, night);
  ctx.restore();
}

/** The stage: a slim timber landing stage along the near bank, on low piles. Cached ground. */
function stage(ctx: Ctx, night: boolean, snowy: boolean) {
  const { left, right, top, bottom } = REGATTA_COURSE.stage;
  const rise = 2;
  const a = iso(left, top, rise),
    b = iso(right, top, rise),
    c = iso(right, bottom, rise),
    d = iso(left, bottom, rise);
  // The two faces toward us: the water side and the south tip.
  fill(ctx, [b, c, iso(right, bottom), iso(right, top)], pick(P.side, night));
  fill(ctx, [c, d, iso(left, bottom), iso(right, bottom)], pick(P.plank, night));
  fill(ctx, [a, b, c, d], pick(snowy ? SNOW.top : P.deck, night));
  if (!snowy) {
    // Boards across the stage.
    ctx.fillStyle = pick(P.plank, night);
    for (let y = top + 0.16; y < bottom - 0.05; y += 0.16) {
      const p = iso(left + 0.02, y, rise),
        q = iso(right - 0.02, y, rise);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.lineTo(q.x, q.y + 1);
      ctx.lineTo(p.x, p.y + 1);
      ctx.fill();
    }
  }
  // Low piles along the water side, their tops a little above the deck.
  for (const y of [top + 0.05, (top + bottom) / 2, bottom - 0.05]) {
    const p = iso(right - 0.02, y, 0);
    box(ctx, Math.round(p.x) - 1, p.y - 5, 2, 5, pick(P.pile, night));
    box(ctx, Math.round(p.x) - 1, p.y - 5, 2, 1, pick(snowy ? SNOW.top : P.pileTop, night));
  }
}

/** The cork boom across the river at y 51: a rope of floats between two posts. */
function boom(ctx: Ctx, night: boolean) {
  const y = REGATTA_COURSE.boomY;
  const near = iso(61.98, y),
    far = iso(63.02, y);
  ctx.fillStyle = pick(P.rope, night);
  ctx.beginPath();
  ctx.moveTo(near.x, near.y - 1);
  ctx.lineTo(far.x, far.y - 1);
  ctx.lineTo(far.x, far.y);
  ctx.lineTo(near.x, near.y);
  ctx.fill();
  for (let i = 0; i < 10; i++) {
    const p = iso(62.05 + i * 0.1, y);
    box(ctx, Math.round(p.x) - 1, Math.round(p.y) - 2, 3, 2, pick(i % 2 ? P.float : P.cork, night));
  }
  for (const p of [near, far]) {
    box(ctx, Math.round(p.x) - 1, p.y - 7, 2, 7, pick(P.pile, night));
    box(ctx, Math.round(p.x) - 1, p.y - 7, 2, 1, pick(P.pileTop, night));
  }
}

const PLOT = getPlot(LANDING_VENUE.plot)!;
const PLOT_CENTER = project(PLOT.x + 0.5, PLOT.y + 0.5);
/** The Landing's lawn, J15's ±1.5 tiles (insideDistrict). */
const LAWN = {
  left: PLOT.x - 1,
  right: PLOT.x + 2,
  top: PLOT.y - 1,
  bottom: PLOT.y + 2,
} as const;
const diamond = (c: Point, rx: number, ry: number) => [
  { x: c.x, y: c.y - ry },
  { x: c.x + rx, y: c.y },
  { x: c.x, y: c.y + ry },
  { x: c.x - rx, y: c.y },
];
const STAGE_CENTER = iso(
  (REGATTA_COURSE.stage.left + REGATTA_COURSE.stage.right) / 2,
  (REGATTA_COURSE.stage.top + REGATTA_COURSE.stage.bottom) / 2,
);
const BOOM_CENTER = iso(62.5, REGATTA_COURSE.boomY);

function ground(ctx: Ctx, scene: DistrictGroundScene) {
  const { night, season, groundDay, visible } = scene;
  if (visible(PLOT_CENTER, 110, 60, 60)) {
    fill(ctx, diamond(PLOT_CENTER, 105, 52.5), pick(P.lawn, night));
    for (let k = 0; k < 12; k++) {
      const gx = LAWN.left + 0.1 + groundFraction(k, 41) * 2.4,
        gy = LAWN.top + 0.1 + groundFraction(k, 42) * 2.8;
      const tuft = groundTuft(6011 * (k + 1), k % 3, night, season);
      const p = project(gx, gy);
      box(ctx, Math.round(p.x), Math.round(p.y), tuft.w, tuft.h, tuft.fill);
    }
    // A gravel edge along the lawn's river side, where the boats are set down.
    const edge = REGATTA_COURSE.handoverX - 0.13;
    fill(
      ctx,
      [
        iso(edge, LAWN.top + 0.06),
        iso(LAWN.right, LAWN.top + 0.06),
        iso(LAWN.right, LAWN.bottom - 0.06),
        iso(edge, LAWN.bottom - 0.06),
      ],
      pick(P.edge, night),
    );
    fill(
      ctx,
      [
        iso(LAWN.right, LAWN.top + 0.06),
        iso(LAWN.right, LAWN.bottom - 0.06),
        iso(LAWN.right, LAWN.bottom - 0.06, -1),
        iso(LAWN.right, LAWN.top + 0.06, -1),
      ],
      pick(P.edgeShade, night),
    );
  }
  if (visible(STAGE_CENTER, 50, 30, 30)) stage(ctx, night, snowAt(groundDay + 0.5, 0.6) > 0.5);
  if (regattaGroundDay(groundDay) && visible(BOOM_CENTER, 40, 20, 10)) boom(ctx, night);
}

/** Wakes behind the drifting boats, flat on the water; the lawn lights up when marked. */
function floor(ctx: Ctx, scene: DistrictScene) {
  const id = LANDING_VENUE.plot;
  if ((scene.selected === id || scene.hovered === id) && scene.visible(PLOT_CENTER, 110, 60, 60))
    fill(ctx, diamond(PLOT_CENTER, 108, 54), scene.night ? '#B5C59B40' : '#F4EDCD80');
  if (scene.zoom < 0.6) return;
  const today = boatsOut(scene);
  if (!today) return;
  ctx.fillStyle = pick(P.wake, scene.night);
  for (const { boat } of today.boats) {
    if (boat.state !== 'drifting') continue;
    const p = iso(boat.x, boat.y);
    if (!scene.visible(p, 12, 6, 6)) continue;
    // Two short lines trailing up-river, behind the stern.
    ctx.fillRect(Math.round(p.x) + 4, Math.round(p.y) - 2, 3, 1);
    ctx.fillRect(Math.round(p.x) + 2, Math.round(p.y) + 1, 3, 1);
  }
}

/** The boats with a guest today, with where each one is now. */
function boatsOut(scene: DistrictScene) {
  if (!regattaBoat(0, scene.day, OUTING_TIMES.regatta.start)) return undefined;
  if (scene.minutes < OUTING_TIMES.regatta.depart || scene.minutes >= REGATTA_NETTING.to + 2)
    return undefined;
  const guests = regattaGuests(scene);
  const out: { k: number; guest: Guest; boat: RegattaBoat }[] = [];
  guests.forEach((guest, k) => {
    const boat = guest && regattaBoat(k, scene.day, scene.minutes);
    if (guest && boat) out.push({ k, guest, boat });
  });
  return { guests, boats: out };
}

/** The bunting over the stage all Regatta Week: cream and sage, between two poles. */
const POLES = [
  { x: 62.3, y: 37.7 },
  { x: 62.3, y: 38.98 },
] as const;
function bunting(ctx: Ctx, night: boolean) {
  const tops = POLES.map((p) => iso(p.x, p.y, 25));
  for (const pole of POLES) {
    const foot = iso(pole.x, pole.y, 2);
    box(ctx, Math.round(foot.x), foot.y - 23, 1, 23, pick(P.pole, night));
  }
  const [a, b] = tops;
  // The line sags between the poles; the flags hang from it.
  const sag = (f: number) => a.y + (b.y - a.y) * f + Math.sin(f * Math.PI) * 4;
  // The line, a pixel at a time across the screen, one rect for each run on the same row.
  ctx.fillStyle = pick(P.rope, night);
  const left = Math.round(Math.min(a.x, b.x)),
    right = Math.round(Math.max(a.x, b.x));
  const rowAt = (x: number) => Math.round(sag((x - a.x) / (b.x - a.x)));
  for (let x = left, from = left; x <= right; x++)
    if (x === right || rowAt(x + 1) !== rowAt(from)) {
      ctx.fillRect(from, rowAt(from), x - from + 1, 1);
      from = x + 1;
    }
  // Pennants, cream and sage by turns, each a little triangle hanging point down.
  for (let i = 1; i < 8; i++) {
    const x = Math.round(a.x + (b.x - a.x) * (i / 8));
    const y = rowAt(x) + 1;
    ctx.fillStyle = pick(i % 2 ? P.flagCream : P.flagSage, night);
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x + 2, y);
    ctx.lineTo(x, y + 4);
    ctx.closePath();
    ctx.fill();
  }
}

/** A park bench on the lawn's west half, looking over the river. */
const BENCH = { x: 59.2, y: 39.2 } as const;
function bench(ctx: Ctx, night: boolean, snow: number) {
  const p = (dy: number, rise: number) => iso(BENCH.x, BENCH.y + dy, rise);
  const half = 0.28;
  box(
    ctx,
    Math.round(iso(BENCH.x, BENCH.y).x) - 10,
    Math.round(iso(BENCH.x, BENCH.y).y),
    18,
    2,
    pick(P.shadow, night),
  );
  for (const dy of [-half + 0.04, half - 0.04]) {
    const leg = p(dy, 0);
    box(ctx, Math.round(leg.x), leg.y - 6, 1, 6, pick(P.benchLeg, night));
  }
  // The seat and the back, both running along the town's y (facing the river, south-east).
  fill(
    ctx,
    [
      p(-half, 6),
      p(half, 6),
      iso(BENCH.x + 0.12, BENCH.y + half, 6),
      iso(BENCH.x + 0.12, BENCH.y - half, 6),
    ],
    pick(P.bench, night),
  );
  fill(ctx, [p(-half, 13), p(half, 13), p(half, 9), p(-half, 9)], pick(P.benchDark, night));
  if (snow > 0) {
    // Snow along the seat and the top of the back, settling and thawing with the roofs.
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * snow;
    fill(ctx, [p(-half, 14), p(half, 14), p(half, 12.5), p(-half, 12.5)], pick(SNOW.top, night));
    fill(
      ctx,
      [
        p(-half, 7),
        p(half, 7),
        iso(BENCH.x + 0.08, BENCH.y + half, 7),
        iso(BENCH.x + 0.08, BENCH.y - half, 7),
      ],
      pick(SNOW.top, night),
    );
    ctx.globalAlpha = alpha;
  }
}

/** The boatman's long-handled net, from the hands to its hoop. */
function drawNet(ctx: Ctx, hands: Point, hoop: Point, night: boolean, holding?: string) {
  ctx.strokeStyle = pick(P.pole, night);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hands.x, hands.y);
  ctx.lineTo(hoop.x, hoop.y);
  ctx.stroke();
  box(ctx, Math.round(hoop.x) - 2, Math.round(hoop.y) - 1, 5, 3, pick(P.net, night));
  if (holding) {
    box(ctx, Math.round(hoop.x) - 1, Math.round(hoop.y) - 3, 3, 2, '#F6F5EE');
    box(ctx, Math.round(hoop.x) - 1, Math.round(hoop.y) - 1, 3, 1, holding);
  }
}

function objects(ctx: Ctx, scene: DistrictScene): DepthObject[] {
  const { night, minutes, visible } = scene;
  const out: DepthObject[] = [];
  if (visible(iso(BENCH.x, BENCH.y), 16, 16, 4))
    out.push({
      depth: BENCH.x + BENCH.y,
      paint: () => bench(ctx, night, snowAt(scene.season.yearDay, 0.55)),
    });
  const today = boatsOut(scene);
  const week = regattaGroundDay(scene.season.groundDay);
  if (week && visible(STAGE_CENTER, 40, 34, 4))
    out.push({
      depth: POLES[0].x + (POLES[0].y + POLES[1].y) / 2,
      paint: () => bunting(ctx, night),
    });
  if (!today) return out;
  const { guests, boats } = today;
  const wright = boatwrightAt(guests, minutes);
  const crew = boatmanAt(guests, minutes);
  for (const { k, guest, boat } of boats) {
    const where = boatAt(guests, k, minutes);
    if (where === 'ashore') {
      // At the guest's feet from their arrival until the boatwright takes it up.
      const at = setDownAt(k);
      const p = iso(at.x, at.y);
      if (!visible(p, 8, 10, 3)) continue;
      out.push({ depth: at.x + at.y, paint: () => drawAshoreBoat(ctx, p, guest.band, night) });
      continue;
    }
    // In a hand, the boatwright's, the net or the basket: drawn with whoever holds it.
    if (where !== 'water') continue;
    const p = iso(boat.x, boat.y);
    if (!visible(p, 8, 10, 3)) continue;
    const bob = Math.sin((minutes + k * 0.7) * 2.1) > 0.6 ? -1 : 0;
    out.push({
      depth: boat.x + boat.y,
      paint: () => drawBoat(ctx, p, guest.band, night, boat.state === 'drifting' ? bob : 0),
    });
  }
  if (wright) {
    const p = iso(wright.at.x, wright.at.y, wright.at.x > REGATTA_COURSE.stage.left ? 2 : 0);
    if (visible(p, 18, 40, 6)) {
      const band = wright.carrying === undefined ? undefined : guests[wright.carrying]?.band;
      const hands: FigureHands | undefined = band
        ? (r, look, bob) => {
            r(3, -11 + bob, 2, 3, look.outfit);
            r(4, -9 + bob, 2, 2, look.outfit);
            paintPaperBoat(r, 6, -7 + bob, band, false);
            r(5, -8 + bob, 2, 2, look.skin);
          }
        : undefined;
      out.push({
        depth: wright.at.x + wright.at.y,
        paint: () =>
          drawFigure(ctx, Math.round(p.x), Math.round(p.y), {
            look: BOATWRIGHT_LOOK,
            facing: wright.facing,
            stance: wright.stance,
            phase: wright.phase,
            cap: '#5E6B57',
            flat: true,
            night,
            alpha: wright.alpha,
            hands,
          }),
      });
    }
  }
  if (crew) {
    const p = iso(crew.at.x, crew.at.y);
    if (visible(p, 30, 44, 8)) {
      const target = netStand(crew.next);
      const boat = iso(62.12, target.y - 0.04);
      out.push({
        depth: crew.at.x + crew.at.y,
        paint: () => {
          const x = Math.round(p.x),
            y = Math.round(p.y);
          const alpha = ctx.globalAlpha;
          ctx.globalAlpha = alpha * crew.alpha;
          // The basket beside him on the bank, on the water's side of the road and a step up
          // the river, a white fold for every boat in it.
          const b = iso(crew.at.x + 0.05, crew.at.y - 0.17);
          box(ctx, Math.round(b.x) - 4, Math.round(b.y) - 5, 8, 5, pick(P.basket, night));
          box(ctx, Math.round(b.x) - 4, Math.round(b.y) - 5, 8, 1, pick(P.basketDark, night));
          for (let i = 0; i < Math.min(crew.netted, 6); i++)
            box(
              ctx,
              Math.round(b.x) - 3 + (i % 3) * 2,
              Math.round(b.y) - 6 - Math.floor(i / 3),
              2,
              1,
              '#F6F5EE',
            );
          drawFigure(ctx, x, y, {
            look: BOATMAN_LOOK,
            facing: crew.walking ? 'ne' : 'se',
            stance: crew.walking ? 'walk' : 'stand',
            phase: crew.phase,
            cap: '#4F5B4A',
            flat: true,
            night,
            hands: (r, look, bob) => {
              r(3, -11 + bob, 2, 3, look.outfit);
              r(4, -10 + bob, 2, 2, look.skin);
              r(-3, -11 + bob, 2, 3, tint(look.outfit, -24));
            },
          });
          // The net: up by the shoulder, out over the boat and down to the water, up with the
          // boat in it, over to the basket, and up by the shoulder again.
          const s = crew.scoop;
          const hands = { x: x + 6, y: y - 12 };
          const keys: Point[] = [
            { x: x + 4, y: y - 32 },
            boat,
            { x: boat.x, y: boat.y - 9 },
            { x: b.x + 2, y: b.y - 14 },
            { x: x + 4, y: y - 32 },
          ];
          const times = [0, NET_REACH, 0.5, NET_DROP, 1];
          const seg = Math.max(0, times.findIndex((at) => at > s) - 1);
          const f = s >= 1 ? 1 : smooth((s - times[seg]) / (times[seg + 1] - times[seg]));
          const from = keys[Math.min(seg, 3)],
            to = keys[Math.min(seg + 1, 4)];
          const hoop = { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f };
          const band =
            boatAt(guests, crew.next, minutes) === 'net' ? guests[crew.next]?.band : undefined;
          drawNet(ctx, hands, hoop, night, band);
          ctx.globalAlpha = alpha;
        },
      });
    }
  }
  return out;
}

/** The stage and its bunting stand on the river, off any plot: they select the Landing. */
function hit(point: Point): DistrictHit | undefined {
  const { left, right, top, bottom } = REGATTA_COURSE.stage;
  const corners = [iso(left, top), iso(right, top), iso(right, bottom), iso(left, bottom)];
  const xs = corners.map((c) => c.x),
    ys = corners.map((c) => c.y);
  if (
    point.x >= Math.min(...xs) - 4 &&
    point.x <= Math.max(...xs) + 4 &&
    point.y >= Math.min(...ys) - 28 &&
    point.y <= Math.max(...ys) + 4
  )
    return { plot: LANDING_VENUE.plot, depth: (left + right) / 2 + (top + bottom) / 2 };
  return undefined;
}

export const landingPainter: DistrictPainter = { ground, floor, objects, hit };
