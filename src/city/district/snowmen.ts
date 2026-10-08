// Snowmen on the Lunch Green (agent E, SPEC §4.6): four snowmen from snowmanState, about 22 px tall,
// leaning and shrinking as they melt, then a carrot and a scarf on the grass. Render cap: 40 calls
// for all four (SPEC §6.6).
// No Math.random, Date.now or performance.now: everything runs on the town clock.
//
// A snowman is three balls of snow, the colour of the snow on the roofs, in one path: one fill
// paints all three, and the fill's own hard shadow, a world pixel down and to the right, gives
// each ball its cool shaded edge and the base its foothold on the lawn. A scarf, a carrot and
// two coal eyes finish it: nine calls a snowman at full detail.
import { SNOWMAN_DAYS, SNOWMAN_STAGES, snowmanState } from '../../lib/district-calendar';
import { SNOWMEN_LUNCH } from '../../lib/district-copy';
import { EVENT_SPOTS, VENUES } from '../../lib/events';
import { residentGround } from '../../lib/lanes';
import type { ResidentState } from '../../lib/simulation';
import { CALENDAR_EPOCH_DAY, DAYS_PER_YEAR } from '../../lib/town-calendar';
import { getPlot, hash, project, type Point } from '../../lib/world';
import type { DepthObject, DistrictPainter, DistrictScene } from '../district-art';
import { pick, SNOW, type Pair } from '../season-palette';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
/** Where a ball's outline starts and ends: its lowest point. */
const FOOT = Math.PI / 2;

const GREEN_PLOT = getPlot(VENUES.find((venue) => venue.kind === 'green')!.plot)!;
/** The Lunch Green's centre, in tiles (C5: 19.5, 11.5). */
export const GREEN_CENTER: Point = { x: GREEN_PLOT.x + 0.5, y: GREEN_PLOT.y + 0.5 };
/**
 * Where snowman k stands, in tiles from the green's centre (SPEC §2.3): on the back lawn, clear
 * of the guests' blankets, the lane at x −1.35 and the stepping stones.
 */
export const SNOWMAN_SPOTS: readonly Point[] = [
  { x: 1.15, y: -0.45 },
  { x: 0.2, y: -1.1 },
  { x: 1.4, y: 0.45 },
  { x: -0.6, y: -1.15 },
];
/** Which way each snowman looks: toward the guests, one to each side. */
const LOOKS: readonly (-1 | 1)[] = [-1, 1, -1, 1];

/** The three balls' radii, base to head, in world px: 10, 8 and 6 across. */
export const SNOWMAN_RADII = [5, 4, 3] as const;
/** How far the base sits down into the snow, and how much each ball sits into the one below. */
const SINK = 0.5;
const NEST = [1.2, 1] as const;
/** Minutes each ball takes to roll to its full size on a build day: base, body and head. */
const ROLL = [40, 35, 25] as const;
/** A ball starts as a snowball this big, of its full radius, and is rolled up from there. */
const START = 0.3;
/** Melting: the snowman shrinks to this share of its size, leaning as it goes. */
const SHRINK = 0.6;
/** World px of lean, per px of height, and the tilt of each ball, by the time it has melted. */
const LEAN = 0.6;
const TILT = 0.45;
/** At this melt the head falls; the last of the lump fades over the final stretch. */
export const HEADLESS = 0.7;
const LAST = 0.12;
/** Below this zoom a snowman is snow and scarf only: its face is under a pixel. */
const FACE_ZOOM = 0.6;
/** Snowmen are the colour of the snow on the roofs, shaded cool and pale, never grey. */
const PALETTE = {
  snow: SNOW.top,
  rim: ['#A3B5B4', '#5E7174'] as Pair,
  coal: ['#36423F', '#252F2E'] as Pair,
  carrot: ['#D17C45', '#8C5F45'] as Pair,
};
/** A muted wool palette for the scarves, never amber. */
export const SCARVES: readonly Pair[] = [
  ['#A55A4C', '#6E4842'],
  ['#6E8A56', '#4B5F48'],
  ['#5C7A94', '#435768'],
  ['#8B6A88', '#5E4C60'],
  ['#4E8582', '#3A5D5D'],
];

const clamp = (value: number) => Math.max(0, Math.min(1, value));
/** The absolute town day snowman k was built on, in the year of `day`. */
export function builtDay(k: number, day: number) {
  const year = Math.floor((Math.floor(day) - CALENDAR_EPOCH_DAY) / DAYS_PER_YEAR);
  return CALENDAR_EPOCH_DAY + year * DAYS_PER_YEAR + SNOWMAN_DAYS[k];
}
/**
 * Snowman k's scarf, from its own build day (`snowman:${day}`): that colour, or the next one along
 * that no earlier snowman of the winter is wearing, so the four never match.
 */
export function scarfOf(k: number, day: number): Pair {
  const worn: number[] = [];
  for (let i = 0; i <= k; i++) {
    let index = hash(`snowman:${builtDay(i, day)}`) % SCARVES.length;
    while (worn.includes(index)) index = (index + 1) % SCARVES.length;
    worn.push(index);
  }
  return SCARVES[worn[k]];
}

type Ball = { x: number; y: number; rx: number; ry: number; tilt: number };
/** Snowman k's shape at a moment, in world px from its feet. Undefined when there is nothing. */
export type SnowmanShape = {
  /** Base, body and head, those that are there. */
  balls: Ball[];
  /** 0..1: the last of a melted lump fades before only the carrot and scarf are left. */
  alpha: number;
  /** The scarf round the neck, while there is a neck to wear it. */
  scarf?: { x: number; y: number; w: number; h: number };
  /** The face, on a head that is finished and dressed. */
  face?: { eyes: [Point, Point]; carrot: { x: number; y: number; w: number } };
  /** What lies on the grass once the head has gone: the carrot, then the scarf as well. */
  dropped: { carrot: boolean; scarf: boolean };
  /** Which way it looks (−1 left, 1 right), and the side it leans and drops things to. */
  look: -1 | 1;
  lean: -1 | 1;
};

/**
 * Snowman k at a town day and minute: rolled up ball by ball on its build day (the base from
 * 14:00, the body from 14:40, the head from 15:15, each growing from a snowball), dressed at 15:45,
 * then standing until the thaw. As it melts it leans, sags and shrinks to 40%; its head goes at
 * melt 0.7, carrot first to the grass; the last lump fades away, and the carrot and scarf lie on
 * the grass for half a day more. Pure in the day and the minute, like snowmanState.
 */
export function snowmanShape(k: number, day: number, minutes: number): SnowmanShape | undefined {
  const state = snowmanState(k, day, minutes);
  if (!state || state.stage === 0) return undefined;
  const look = LOOKS[k];
  const lean: -1 | 1 = hash(`snowman-lean:${k}`) % 2 ? 1 : -1;
  const minute = ((minutes % 1440) + 1440) % 1440;
  const { stage, melt } = state;
  // How far each ball is rolled: on its build day, by the minute; finished from then on.
  const starts = [SNOWMAN_STAGES.base, SNOWMAN_STAGES.body, SNOWMAN_STAGES.head];
  const rolled = starts.map((start, i) =>
    stage === 4 ? 1 : stage > i + 1 ? 1 : stage === i + 1 ? clamp((minute - start) / ROLL[i]) : -1,
  );
  const size = 1 - SHRINK * melt;
  const sag = 1 - 0.25 * melt;
  const headless = melt >= HEADLESS;
  const gone = melt >= 1;
  const balls: Ball[] = [];
  let top = 0;
  for (let i = 0; i < 3 && !gone; i++) {
    if (rolled[i] < 0 || (i === 2 && headless)) break;
    const r = SNOWMAN_RADII[i] * size * (START + (1 - START) * rolled[i]);
    const ry = r * sag;
    const y = i === 0 ? -(ry - SINK) : top - ry + NEST[i - 1] * size;
    balls.push({ x: lean * LEAN * melt * -y, y, rx: r, ry, tilt: lean * TILT * melt });
    top = y - ry;
  }
  const dressed = stage === 4 && !gone;
  const neck = balls[1];
  const head = balls[2];
  return {
    balls,
    alpha: clamp((1 - melt) / LAST),
    scarf:
      dressed && neck
        ? {
            x: neck.x - neck.rx * 0.85,
            y: neck.y - neck.ry + (head ? -0.1 : 0.6 * size),
            w: neck.rx * 1.7,
            h: 1.8 * size,
          }
        : undefined,
    face:
      dressed && head
        ? {
            eyes: [
              { x: head.x + look * 0.5 - 1.5 * size, y: head.y - 1.2 * size },
              { x: head.x + look * 0.5 + 0.5 * size, y: head.y - 1.2 * size },
            ],
            carrot: { x: head.x + look * 0.3 * size, y: head.y - 0.1 * size, w: 3.2 * size },
          }
        : undefined,
    dropped: { carrot: stage === 4 && headless, scarf: stage === 4 && gone },
    look,
    lean,
  };
}

/** Paints snowman k's shape with its feet at (x, y). `shade` is the device px per world px. */
function paintSnowman(
  ctx: Ctx,
  x: number,
  y: number,
  shape: SnowmanShape,
  scarf: Pair,
  night: boolean,
  shade: number,
  detail: boolean,
) {
  const alpha = ctx.globalAlpha;
  // The balls and the scarf cast a hard shadow a world pixel down and to the right: the shaded
  // edge of each ball, and the base's foothold on the lawn.
  ctx.shadowColor = pick(PALETTE.rim, night);
  ctx.shadowOffsetX = shade;
  ctx.shadowOffsetY = shade;
  ctx.shadowBlur = 0;
  if (shape.balls.length) {
    ctx.globalAlpha = alpha * shape.alpha;
    ctx.fillStyle = pick(PALETTE.snow, night);
    ctx.beginPath();
    // Each ball is traced from its foot, which lies inside the ball below: the joins between
    // them run up through the snow, so one path needs no moves.
    for (const ball of shape.balls)
      ctx.ellipse(x + ball.x, y + ball.y, ball.rx, ball.ry, ball.tilt, FOOT, FOOT + TAU);
    ctx.fill();
    ctx.globalAlpha = alpha;
  }
  if (shape.scarf) {
    ctx.fillStyle = pick(scarf, night);
    ctx.fillRect(x + shape.scarf.x, y + shape.scarf.y, shape.scarf.w, shape.scarf.h);
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  if (shape.face && detail) {
    const { eyes, carrot } = shape.face;
    ctx.fillStyle = pick(PALETTE.carrot, night);
    ctx.fillRect(
      x + carrot.x + (shape.look < 0 ? -carrot.w : 0),
      y + carrot.y,
      carrot.w,
      Math.max(1, carrot.w / 3),
    );
    ctx.fillStyle = pick(PALETTE.coal, night);
    for (const eye of eyes) ctx.fillRect(x + eye.x, y + eye.y, 1, 1);
  }
  // Once the head is down, the carrot lies on the grass by the base; once the last of the snow
  // has gone, the scarf lies there too, in a loose fold.
  const side = shape.lean * 6;
  if (shape.dropped.scarf) {
    // Two lengths of wool, one lying over the other where it fell.
    ctx.fillStyle = pick(scarf, night);
    ctx.fillRect(x - 4, y - 2, 5, 2);
    ctx.fillRect(x, y - 1, 5, 2);
  }
  if (shape.dropped.carrot && detail) {
    ctx.fillStyle = pick(PALETTE.carrot, night);
    ctx.fillRect(x + side - 1.5, y + 1, 3, 1);
  }
}

/** World px a snowman reaches: sideways, above its feet (22 px tall) and below. */
const REACH = { x: 12, above: 24, below: 4 };

// ---- The builders at work (build days, 14:00–15:45) ----

/**
 * The trail the day's snowball leaves on the lawn, in tiles from the green's centre: started
 * between the two builders, just behind their blankets, and rolled round to the snowman's spot,
 * bending clear of the picnic rug (local x −0.55..0.89, y −0.08..1.08). One bend per snowman.
 */
export const TRACK_START: Point = { x: -0.1, y: -0.2 };
export const TRACK_BENDS: readonly Point[] = [
  { x: 0.55, y: -0.5 },
  { x: -0.15, y: -0.7 },
  { x: 1.45, y: -0.45 },
  { x: -0.15, y: -0.75 },
];
/**
 * The trail grows back from the snowball while the base is rolled, stays while the body is, and
 * fades as the head goes on, gone before the scarf: on Winter 15 three finished snowmen stand
 * beside it, and the four with their scarves fill the call cap.
 */
export const TRACK_TIMES = { grow: [840, 880], fade: [915, 935] } as const;
/** World px across: a band of packed snow, narrower than the base that pressed it. */
const TRACK_WIDTH = 3.5;
const TRACK_ALPHA = 0.85;
const TRACK_IN = 2;

/** Point t (0..1) along a quadratic from a through b to c. */
const along = (a: Point, b: Point, c: Point, t: number): Point => ({
  x: (1 - t) * (1 - t) * a.x + 2 * t * (1 - t) * b.x + t * t * c.x,
  y: (1 - t) * (1 - t) * a.y + 2 * t * (1 - t) * b.y + t * t * c.y,
});

/**
 * The day's trail while it is on the lawn: snowman k's, shown `from` a point along it (0 the
 * builders' end, 1 the snowball) to the snowball, at `alpha`. It is the end of the curve that
 * shows, so the trail always runs into the ball and lengthens back toward the builders.
 */
export function snowTrack(day: number, minutes: number) {
  const k = SNOWMAN_DAYS.findIndex((_, i) => builtDay(i, day) === Math.floor(day));
  if (k < 0) return undefined;
  const minute = ((minutes % 1440) + 1440) % 1440;
  const { grow, fade } = TRACK_TIMES;
  if (minute <= grow[0] || minute >= fade[1]) return undefined;
  const length = clamp((minute - grow[0]) / (grow[1] - grow[0]));
  // It comes in over the first two minutes and goes over the last twenty: never in a frame.
  const alpha =
    TRACK_ALPHA *
    clamp((minute - grow[0]) / TRACK_IN) *
    clamp((fade[1] - minute) / (fade[1] - fade[0]));
  return { k, from: 1 - length, alpha };
}

/** The scale render.ts draws every neighbor at (its RESIDENT_SCALE). */
export const FIGURE_SCALE = 1.25;
/**
 * residents.ts's `play` ball, in figure px from the feet and never mirrored: a 4-px square at
 * x 7, bouncing up to 10 px on |sin| of the walk phase. On a build day a builder up on their feet
 * is packing snow, so a snowball is laid over it, a device pixel wider all round so that none of
 * the ball's gold shows at its edges.
 */
export const PLAY_BALL = { x: 7, y: -3, size: 4, bounce: 10 } as const;
/** A crouching builder's heap of snow, in figure px from the feet: just past their toes. */
export const HEAP = { x: 7, y: -2.5, w: 5, h: 2.5 } as const;
const BUILDERS = EVENT_SPOTS.green.slice(0, 2);

/**
 * The builders at their work on a build day (14:00–15:45): the lunch's seats 0 and 1, at their
 * spots, crouched over the snow or up on their feet packing it.
 */
export function buildersAt(residents: readonly ResidentState[], minutes: number) {
  const minute = ((minutes % 1440) + 1440) % 1440;
  if (minute < SNOWMAN_STAGES.base || minute >= SNOWMAN_STAGES.dressed) return [];
  return residents.flatMap((resident) => {
    if (resident.event?.name !== SNOWMEN_LUNCH.name || resident.event.phase !== 'attending')
      return [];
    const pose = resident.pose;
    if (pose !== 'crouch' && pose !== 'play') return [];
    const seat = BUILDERS.findIndex(
      (spot) =>
        Math.hypot(
          GREEN_CENTER.x + spot.x - resident.position.x,
          GREEN_CENTER.y + spot.y - resident.position.y,
        ) < 0.1,
    );
    return seat < 0 ? [] : [{ resident, seat, pose, ground: residentGround(resident) }];
  });
}

type Box = { x: number; y: number; w: number; h: number };
/** A lump of snow: one fill, its hard shadow a world pixel down and right for the shaded edge. */
function paintSnow(ctx: Ctx, box: Box, night: boolean, shade: number) {
  ctx.shadowColor = pick(PALETTE.rim, night);
  ctx.shadowOffsetX = shade;
  ctx.shadowOffsetY = shade;
  ctx.shadowBlur = 0;
  ctx.fillStyle = pick(PALETTE.snow, night);
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** Where a builder's snow lies, in world px: the heap by their knees, or the snowball in hand. */
export function builderSnow(
  builder: ReturnType<typeof buildersAt>[number],
  device: number,
): Box & { depth: number } {
  const { resident, ground, pose } = builder;
  const feet = project(ground.x, ground.y);
  const depth = ground.x + ground.y;
  const s = FIGURE_SCALE;
  if (pose === 'crouch') {
    const left = resident.facing === 'sw' || resident.facing === 'nw';
    const front = resident.facing === 'se' || resident.facing === 'sw';
    return {
      x: left ? feet.x - s * (HEAP.x + HEAP.w) : feet.x + s * HEAP.x,
      y: feet.y + s * HEAP.y,
      w: s * HEAP.w,
      h: s * HEAP.h,
      // In front of the knees: after the figure when they face us, before it when they face away.
      depth: depth + (front ? 1e-4 : -1e-4),
    };
  }
  const bounce = Math.round(Math.abs(Math.sin(resident.walkPhase * TAU)) * PLAY_BALL.bounce);
  const edge = 1 / device;
  return {
    x: feet.x + s * PLAY_BALL.x - edge,
    y: feet.y + s * (PLAY_BALL.y - bounce) - edge,
    w: s * PLAY_BALL.size + 2 * edge,
    h: s * PLAY_BALL.size + 2 * edge,
    // Just after the figure, whose ball it covers.
    depth: depth + 1e-4,
  };
}

export const snowmenPainter: DistrictPainter = {
  floor(ctx: Ctx, scene: DistrictScene) {
    const track = snowTrack(scene.day, scene.minutes);
    if (!track) return;
    const spot = SNOWMAN_SPOTS[track.k],
      bend = TRACK_BENDS[track.k];
    // The end of the curve from `from`, as a quadratic of its own (de Casteljau).
    const t = track.from;
    const start = along(TRACK_START, bend, spot, t);
    const control = { x: (1 - t) * bend.x + t * spot.x, y: (1 - t) * bend.y + t * spot.y };
    const [a, b, c] = [start, control, spot].map((p) =>
      project(GREEN_CENTER.x + p.x, GREEN_CENTER.y + p.y),
    );
    const left = Math.min(a.x, b.x, c.x),
      right = Math.max(a.x, b.x, c.x),
      top = Math.min(a.y, b.y, c.y),
      bottom = Math.max(a.y, b.y, c.y);
    const half = (bottom - top) / 2 + TRACK_WIDTH;
    const middle = { x: (left + right) / 2, y: (top + bottom) / 2 };
    if (!scene.visible(middle, (right - left) / 2 + TRACK_WIDTH, half, half)) return;
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * track.alpha;
    ctx.strokeStyle = pick(PALETTE.snow, scene.night);
    ctx.lineWidth = TRACK_WIDTH;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.lineWidth = 1;
    ctx.globalAlpha = alpha;
  },
  objects(ctx: Ctx, scene: DistrictScene): DepthObject[] {
    const { day, minutes, night, visible, zoom } = scene;
    const objects: DepthObject[] = [];
    let shade: number | undefined;
    // One look at the canvas's scale a frame, for the shadow's world pixel.
    const device = () =>
      (shade ??= typeof ctx.getTransform === 'function' ? Math.max(1, ctx.getTransform().a) : zoom);
    for (const [k, spot] of SNOWMAN_SPOTS.entries()) {
      const shape = snowmanShape(k, day, minutes);
      if (!shape) continue;
      const tile = { x: GREEN_CENTER.x + spot.x, y: GREEN_CENTER.y + spot.y };
      const feet = project(tile.x, tile.y);
      if (!visible(feet, REACH.x, REACH.above, REACH.below)) continue;
      const scarf = scarfOf(k, day);
      const px = device();
      objects.push({
        // Just ahead of its own ground point: the green's table and bunting (at its plot's depth)
        // stand in front of the snowman behind them.
        depth: tile.x + tile.y - 0.02,
        paint: () => paintSnowman(ctx, feet.x, feet.y, shape, scarf, night, px, zoom >= FACE_ZOOM),
      });
    }
    // The builders' snow: a heap at a crouching builder's knees, a snowball in the hands of one up
    // on their feet packing it. One call each, shaded like the snowmen by a hard shadow.
    for (const builder of buildersAt(scene.residents, minutes)) {
      const feet = project(builder.ground.x, builder.ground.y);
      if (!visible(feet, 16 * FIGURE_SCALE, 16 * FIGURE_SCALE, 4)) continue;
      const px = device();
      const snow = builderSnow(builder, px);
      objects.push({ depth: snow.depth, paint: () => paintSnow(ctx, snow, night, px) });
    }
    return objects;
  },
};
