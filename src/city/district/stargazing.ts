// Stargazing on the Bandstand lawn (docs/STARGAZING.md): the rugs per BANDSTAND_FURNITURE, the
// brass telescope (≤ 24 px) and the scenery astronomer; the summer meteors are in sky-extras.ts.
// Nothing amber. Render cap: 300 calls.
// No Math.random, Date.now or performance.now: everything runs on the town clock.
//
// On a new-moon night eight wool rugs unroll on the deckchairs' eight spots at 21:50, a brass
// telescope stands on the lawn's river side, and at 22:00 the astronomer walks in from the
// riverside road. They take turns at the eyepiece and pointing out the sky to the rugs until
// 00:30, when they walk off and the rugs roll themselves up. The rugs and the telescope do not
// change while they are out, so in a browser each is painted once into a sprite, by its look:
// night, and the snow a winter night lays round the rugs.
import { BANDSTAND_FURNITURE, DISTRICT_SPOTS } from '../../lib/district-places';
import { starNight } from '../../lib/district-calendar';
import { DEFAULT_RESIDENT, type Resident } from '../../lib/schema';
import { hash, project, type Point } from '../../lib/world';
import type { DepthObject, DistrictPainter, DistrictScene } from '../district-art';
import { plane, PX } from '../iso-paint';
import { tint } from '../houses';
import { drawResident, NIGHT_DIM } from '../residents';
import { drawSkyExtras } from '../sky-extras';
import { pick, SNOW, type Pair } from '../season-palette';

type Ctx = CanvasRenderingContext2D;

/** The evening's own timeline: 00:20 is minute 1460 of the evening before. */
export const eveningMinute = (minutes: number) => (minutes < 360 ? minutes + 1440 : minutes);
/** The evening a moment belongs to: before 06:00, last night's. */
export const eveningDay = (day: number, minutes: number) =>
  minutes < 360 ? Math.floor(day) - 1 : Math.floor(day);

// ---- The rugs ----

/**
 * A rug's size in tiles, along x and along y: room for one neighbor sat in the middle. The front
 * row's guests walk in down the gaps between the back row's rugs (the spots are 0.7 apart), so a
 * rug is 0.42 across, leaving them 0.14 either side: nobody treads on a rug someone sits on.
 */
export const RUG = { x: 0.42, y: 0.42 } as const;
/** Minutes a rug takes to unroll, and the gap between one rug and the next. */
const UNROLL = 1.5;
const STAGGER = 0.5;
/** Checked wool in four colourways: the cloth, its broad check and its fine line. */
const RUGS: readonly { cloth: Pair; check: Pair; line: Pair }[] = [
  { cloth: ['#A0605A', '#6A4A49'], check: ['#C08478', '#835F5A'], line: ['#E3CBA6', '#988A72'] },
  { cloth: ['#5F7E99', '#465A6B'], check: ['#86A0B5', '#5E7383'], line: ['#E3DDC6', '#8E9590'] },
  { cloth: ['#78905B', '#55654A'], check: ['#9BAE7E', '#6B7C5D'], line: ['#E8DDB5', '#959276'] },
  { cloth: ['#B69F7A', '#7A6C58'], check: ['#CDB991', '#8E7F66'], line: ['#8A5E52', '#5C4842'] },
];
/** The fringe at a rug's two short ends, and the shade along its two front edges. */
const FRINGE: Pair = ['#E5DCC2', '#9C9784'];
const EDGE: Pair = ['#3E4A3A70', '#1E2A2670'];
/** Rug k's colourway: the back row shifted two along, so no column repeats. */
const rugColours = (k: number) => RUGS[(k + (k >= 4 ? 2 : 0)) % RUGS.length];
/** Below this zoom a rug is its cloth only. */
const CHECK_ZOOM = 0.6;

/**
 * How far rug k is unrolled (0 rolled up, 1 flat) at a minute of the evening: each unrolls in
 * turn from 21:50, a minute and a half apiece, and rolls up again in turn before 00:35.
 */
export function rugOut(k: number, evening: number) {
  const { from, to } = BANDSTAND_FURNITURE.rugs;
  if (evening < from || evening >= to) return 0;
  const down = (evening - (from + STAGGER * k)) / UNROLL;
  const up = (to - STAGGER * (7 - k) - evening) / UNROLL;
  return Math.max(0, Math.min(1, down, up));
}

/**
 * On a snowy night the rugs lie on snow: a few drifts and frosted tufts on the lawn along each
 * rug's back edges and one side, in the lawn's own tuft shapes (season-ground.ts: 4 × 2 drifts of
 * roof snow, 2 × 2 frost), each at its own seeded place. In tiles from the rug's centre, with the
 * share of the rug's length that must be unrolled before it shows.
 */
export function rugDrifts(k: number) {
  return Array.from({ length: 4 }, (_, i) => {
    const seed = hash(`rug-snow:${k}:${i}`);
    const along = 0.12 + 0.76 * ((seed % 1000) / 1000);
    const away = 0.07 + 0.04 * (((seed >>> 10) % 100) / 100);
    const drift = (seed >>> 17) % 3 !== 0;
    // Two along the back edge (north, the stand's side), one on the west edge, one on the east.
    const edge = i < 2 ? 'north' : i === 2 ? 'west' : 'east';
    const x =
      edge === 'north'
        ? (along - 0.5) * RUG.x
        : edge === 'west'
          ? -RUG.x / 2 - away
          : RUG.x / 2 + away;
    const y = edge === 'north' ? -RUG.y / 2 - away : (along * 0.6 - 0.5) * RUG.y;
    // The east edge is the rug's unrolling end: its drift shows once the rug is flat.
    const after = edge === 'east' ? 1 : edge === 'west' ? 0 : along;
    return { x, y, drift, after };
  });
}
/** The share of the unrolling over which a drift fades in: under 0.08 alpha a frame. */
const DRIFT_FADE = 0.3;
const unit = (value: number) => Math.max(0, Math.min(1, value));
function paintRugSnow(ctx: Ctx, k: number, out: number, night: boolean) {
  const spot = DISTRICT_SPOTS.bandstand[k];
  const alpha = ctx.globalAlpha;
  for (const { x, y, drift, after } of rugDrifts(k)) {
    // Each shows as the rug unrolls up to it, over a third of the unrolling, never in a frame.
    const shown = unit((out + DRIFT_FADE - after) / DRIFT_FADE) * unit(out / DRIFT_FADE);
    if (shown <= 0) continue;
    const at = project(spot.x + x, spot.y + y);
    ctx.globalAlpha = alpha * shown;
    ctx.fillStyle = pick(drift ? SNOW.top : SNOW.frost, night);
    if (drift) ctx.fillRect(Math.round(at.x) - 2, Math.round(at.y) - 1, 4, 2);
    else ctx.fillRect(Math.round(at.x) - 1, Math.round(at.y) - 1, 2, 2);
  }
  ctx.globalAlpha = alpha;
}

/** Paints rug k flat on the lawn, unrolled to `out`, from its far corner. */
function paintRug(ctx: Ctx, k: number, out: number, night: boolean, snowy: boolean, fine: boolean) {
  const spot = DISTRICT_SPOTS.bandstand[k];
  const colours = rugColours(k);
  const w = RUG.x * PX,
    h = RUG.y * PX;
  // A rug unrolls along its length from the end nearest the stand.
  const length = Math.max(2, w * out);
  // Snow on the lawn round it, under the wool where they meet.
  if (snowy) paintRugSnow(ctx, k, out, night);
  plane(ctx, spot.x - RUG.x / 2, spot.y - RUG.y / 2, 0, () => {
    // The wool's own thickness: a shade along the two edges toward us.
    ctx.fillStyle = pick(EDGE, night);
    ctx.fillRect(1, 1, length, h);
    ctx.fillStyle = pick(colours.cloth, night);
    ctx.fillRect(0, 0, length, h);
    if (fine) {
      // A broad check each way, and a fine line through the cloth: a plain wool tartan, shown as
      // far as the rug is unrolled.
      ctx.fillStyle = pick(colours.check, night);
      ctx.fillRect(0, h * 0.28, length, 3);
      for (const at of [0.3, 0.66]) if (w * at + 3 <= length) ctx.fillRect(w * at, 0, 3, h);
      ctx.fillStyle = pick(colours.line, night);
      ctx.fillRect(0, h * 0.68, length, 1);
      ctx.fillStyle = pick(FRINGE, night);
      ctx.fillRect(-2, 0, 2, h);
      if (out >= 1) ctx.fillRect(w, 0, 2, h);
    }
    if (out < 1) {
      // The roll still to go, a fat edge of folded wool.
      ctx.fillStyle = pick(colours.check, night);
      ctx.fillRect(length - 2, -1, 4, h + 2);
    }
  });
}

/** A flask of something hot and a cup, at the back corner of two of the rugs. */
export const FLASKS = [1, 6] as const;
const FLASK = {
  body: ['#5E7D6A', '#45604F'] as Pair,
  cap: ['#B8BBB0', '#8B8E86'] as Pair,
  cup: ['#D9D3C0', '#9D9989'] as Pair,
};
/** Where rug k's flask stands, in tiles: just off its back right corner. */
export const flaskAt = (k: number): Point => ({
  x: DISTRICT_SPOTS.bandstand[k].x + RUG.x / 2 - 0.04,
  y: DISTRICT_SPOTS.bandstand[k].y - RUG.y / 2 + 0.06,
});
function paintFlask(ctx: Ctx, x: number, y: number, night: boolean) {
  ctx.fillStyle = pick(FLASK.body, night);
  ctx.fillRect(x - 1, y - 5, 2, 5);
  ctx.fillStyle = pick(FLASK.cap, night);
  ctx.fillRect(x - 1, y - 6, 2, 1);
  ctx.fillStyle = pick(FLASK.cup, night);
  ctx.fillRect(x + 2, y - 2, 2, 2);
}

// ---- The telescope ----

/**
 * The telescope's foot (tiles): on the lawn's river side, east of the stand's front, on open
 * lawn: south of the Bandstand's folded deckchairs (stacked at (60.82, 42.42) all night)
 * and clear of the stand's plinth and its steps.
 */
export const TELESCOPE: Point = { x: 60.85, y: 43.05 };
/** Telescope parts in world px from its foot: eyepiece, objective, mount head and three feet. */
const SCOPE = {
  eyepiece: { x: -6, y: -16 },
  objective: { x: 7, y: -21.5 },
  mount: { x: 0.5, y: -18.5 },
  feet: [
    { x: -5, y: 1 },
    { x: 5, y: 1.5 },
    { x: 1, y: -2 },
  ],
} as const;
/** The telescope's tallest point above its foot, world px: 24 at most. */
export const TELESCOPE_HEIGHT = 24;
const BRASS = {
  tube: ['#A08C5C', '#8E8059'] as Pair,
  light: ['#C9B47E', '#B5A67B'] as Pair,
  band: ['#5E5442', '#45403A'] as Pair,
  leg: ['#6E5C46', '#4F463C'] as Pair,
  mount: ['#4B514E', '#363C3B'] as Pair,
};
/** Minutes the telescope takes to appear at 21:50 and to go at 00:35. */
const SCOPE_FADE = 2;

function paintTelescope(ctx: Ctx, x: number, y: number, night: boolean) {
  const { eyepiece: e, objective: o, mount: m, feet } = SCOPE;
  // The tripod: three wooden legs from the mount head to the lawn.
  ctx.strokeStyle = pick(BRASS.leg, night);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const foot of feet) {
    ctx.moveTo(x + m.x, y + m.y + 1);
    ctx.lineTo(x + foot.x, y + foot.y);
  }
  ctx.stroke();
  ctx.fillStyle = pick(BRASS.mount, night);
  ctx.fillRect(x + m.x - 1.5, y + m.y - 0.5, 3, 3);
  // The brass tube, pointing up over the river, with its top edge catching the starlight.
  ctx.strokeStyle = pick(BRASS.tube, night);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + e.x, y + e.y);
  ctx.lineTo(x + o.x, y + o.y);
  ctx.stroke();
  ctx.strokeStyle = pick(BRASS.light, night);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + e.x + 2, y + e.y - 1.6);
  ctx.lineTo(x + o.x - 2, y + o.y - 1.3);
  ctx.stroke();
  // The dew shield round the objective, a band at the balance, and the eyepiece.
  ctx.strokeStyle = pick(BRASS.band, night);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + o.x - 2.4, y + o.y + 1);
  ctx.lineTo(x + o.x, y + o.y);
  ctx.stroke();
  ctx.fillStyle = pick(BRASS.band, night);
  ctx.fillRect(x + e.x - 1.5, y + e.y - 0.5, 2, 2);
  ctx.lineWidth = 1;
}

// ---- The astronomer ----

/** The astronomer: silver hair, spectacles and a long navy coat. Scenery, never counted. */
export const ASTRONOMER: Resident = {
  ...DEFAULT_RESIDENT,
  name: 'The astronomer',
  figure: 'female',
  skin: '#C9A27E',
  hair: '#B8B3A8',
  outfit: '#4F5F7A',
  accessory: 'glasses',
};
/**
 * Where the astronomer peers through the eyepiece, and where they step back to, to point: off the
 * scope's eyepiece end, so the raised hand shows against the lawn and the sky, never the brass.
 */
export const AT_EYEPIECE: Point = { x: TELESCOPE.x, y: TELESCOPE.y + 0.18 };
export const AT_POINT: Point = { x: TELESCOPE.x - 0.12, y: TELESCOPE.y + 0.38 };
/** Where they come and go: the riverside road, on the eyepiece's row. */
const ROADSIDE: Point = { x: 61.55, y: AT_EYEPIECE.y };
/** The astronomer's evening (there 22:00–00:30), on the evening's timeline. */
export const ASTRONOMER_HOURS = { from: 1320, to: 1470 } as const;
const WALK_SPEED = 0.32;
const RESIDENT_SCALE = 1.25;
/** Minutes for the step between the two stances: at a stroll, no faster. */
const STEP = 1.1;
const FADE_STEPS = 0.6;

type Stance = { pose: 'peer' | 'point' | 'walk'; at: Point; facing: 'ne' | 'nw' | 'se' | 'sw' };
type Visit = { from: number; to: number; stance: Stance['pose'] };
/** Minutes to walk between two points at a stroll. */
const walking = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) / WALK_SPEED;
const lerp = (a: Point, b: Point, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/**
 * The astronomer's night: the walk in from the road, then turns at the eyepiece (4 to 9 minutes)
 * and a step back from it, turned to the rugs and pointing up at the sky over the river (3 to 6,
 * each turn's first minute or so the step across),
 * seeded by the evening; the walk off at 00:30.
 */
export function astronomerVisits(evening: number): Visit[] {
  const visits: Visit[] = [];
  const arrive = ASTRONOMER_HOURS.from - walking(ROADSIDE, AT_EYEPIECE);
  visits.push({ from: arrive, to: ASTRONOMER_HOURS.from, stance: 'walk' });
  const leave = ASTRONOMER_HOURS.to;
  let t: number = ASTRONOMER_HOURS.from;
  for (let k = 0; t < leave; k++) {
    const peer = k % 2 === 0;
    const seed = hash(`astronomer:${evening}:${k}`);
    let to = Math.min(leave, t + (peer ? 4 + (seed % 6) : 3 + (seed % 4)));
    if (leave - to < 3) to = leave;
    visits.push({ from: t, to, stance: peer ? 'peer' : 'point' });
    t = to;
  }
  return visits;
}

/** Where the astronomer is and what they are doing at a minute of a star night's evening. */
export function astronomerAt(day: number, minutes: number) {
  const evening = eveningMinute(minutes);
  const night = eveningDay(day, minutes);
  if (!starNight(night)) return undefined;
  const visits = astronomerVisits(night);
  // Off home along the eyepiece's row, from wherever the night's last turn left them.
  const end = visits.at(-1)!.stance === 'point' ? AT_POINT : AT_EYEPIECE;
  const away = walking(end, ROADSIDE);
  const first = visits[0].from,
    last = ASTRONOMER_HOURS.to + away;
  if (evening < first || evening >= last) return undefined;
  const alpha = Math.min(1, (evening - first) / FADE_STEPS, (last - evening) / FADE_STEPS);
  const walk = (from: Point, to: Point, progress: number): Stance & { phase: number } => {
    const p = Math.max(0, Math.min(1, progress));
    const dx = to.x - from.x,
      dy = to.y - from.y;
    const facing =
      Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'nw' : 'se') : dy < 0 ? ('ne' as const) : 'sw';
    return { pose: 'walk', at: lerp(from, to, p), facing, phase: (p * Math.hypot(dx, dy) * 3) % 1 };
  };
  if (evening < ASTRONOMER_HOURS.from)
    return {
      ...walk(ROADSIDE, AT_EYEPIECE, (evening - first) / (ASTRONOMER_HOURS.from - first)),
      alpha,
    };
  if (evening >= ASTRONOMER_HOURS.to) {
    return { ...walk(end, ROADSIDE, (evening - ASTRONOMER_HOURS.to) / away), alpha };
  }
  const index = visits.findIndex((visit) => evening < visit.to);
  const visit = visits[index];
  const spot = visit.stance === 'point' ? AT_POINT : AT_EYEPIECE;
  // Each turn begins with the step across from the last one.
  const since = evening - visit.from;
  if (index > 1 && since < STEP) {
    const from = visit.stance === 'point' ? AT_EYEPIECE : AT_POINT;
    return { ...walk(from, spot, since / STEP), alpha };
  }
  return visit.stance === 'point'
    ? { pose: 'point' as const, at: spot, facing: 'sw' as const, phase: 0, alpha }
    : { pose: 'peer' as const, at: spot, facing: 'ne' as const, phase: 0, alpha };
}

/**
 * The `cheer` pose's raised near arm (residents.ts), in figure px before any mirroring: its hand
 * and arm (x 5–8 from y −24, with half a pixel to spare away from the face) and the top of its
 * shoulder beside the neck. Two holes that never overlap, so the even-odd clip cuts both.
 * Pointing leaves only the far arm up.
 */
export const RAISED_NEAR_ARM = [
  { x: 5, y: -24.5, w: 3.5, h: 13.5 },
  { x: 4, y: -15, w: 1, h: 4 },
] as const;
/** The near arm the town's standing figures hang at their side (residents.ts), and its hand. */
export const SIDE_ARM = { x: 3, y: -11, w: 2, h: 6 },
  SIDE_HAND = { x: 3, y: -6, w: 2, h: 2 };

function paintAstronomer(
  ctx: Ctx,
  state: NonNullable<ReturnType<typeof astronomerAt>>,
  night: boolean,
) {
  const feet = project(state.at.x, state.at.y);
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * state.alpha;
  const pointing = state.pose === 'point';
  const left = state.facing === 'sw' || state.facing === 'nw';
  const s = RESIDENT_SCALE;
  /** A rectangle in the figure's own px, on the canvas, mirrored as the figure is. */
  const box = (r: { x: number; y: number; w: number; h: number }) =>
    [
      left ? feet.x - s * (r.x + r.w) : feet.x + s * r.x,
      feet.y + s * r.y,
      s * r.w,
      s * r.h,
    ] as const;
  if (pointing) {
    // Turned to the rugs, one arm raised to the sky over the river: the town's own cheer, with
    // the near arm left out (clipped away) and hung at the side instead.
    ctx.save();
    ctx.beginPath();
    ctx.rect(feet.x - 40, feet.y - 80, 80, 90);
    for (const r of RAISED_NEAR_ARM) ctx.rect(...box(r));
    ctx.clip('evenodd');
  }
  drawResident(
    ctx,
    ASTRONOMER,
    feet.x,
    feet.y,
    s,
    {
      moving: state.pose === 'walk',
      facing: state.facing,
      // Arms still at the top of the cheer, where its stride is nil and no music note is shown.
      walkPhase: pointing ? 0.5 : state.phase,
      greeting: false,
      // Stooped to the eyepiece, halfway down; or both arms up, one of them clipped.
      ...(state.pose === 'peer' ? { pose: 'crouch' as const } : {}),
      ...(pointing ? { pose: 'cheer' as const } : {}),
    },
    { night },
  );
  if (pointing) {
    ctx.restore();
    ctx.fillStyle = tint(ASTRONOMER.outfit, NIGHT_DIM * +night);
    ctx.fillRect(...box(SIDE_ARM));
    ctx.fillStyle = tint(ASTRONOMER.skin, NIGHT_DIM * +night);
    ctx.fillRect(...box(SIDE_HAND));
  }
  ctx.globalAlpha = alpha;
}

// ---- Sprites: the static art, painted once by its look ----

type Box = { left: number; top: number; width: number; height: number };
type Sprite = { canvas: HTMLCanvasElement; ctx: Ctx; key: string; want: string; seen: number };
const sprites = new WeakMap<Ctx, Map<string, Sprite>>();
/** Frames a new zoom must hold before a sprite is painted at it: a pinch paints directly. */
const SETTLED = 6;
/**
 * Draws `paint`'s art over `box` (world px) from a sprite of it, painted once per `key` at the
 * canvas's own scale. Without a document (tests) or under a skewed transform, it paints directly.
 */
export function spriteOf(ctx: Ctx, name: string, key: string, box: Box, paint: (c: Ctx) => void) {
  const t =
    typeof document !== 'undefined' && typeof ctx.getTransform === 'function'
      ? ctx.getTransform()
      : undefined;
  if (!t || t.b || t.c || t.a <= 0 || t.a !== t.d) return paint(ctx);
  const scale = t.a;
  const w = Math.ceil(box.width * scale),
    h = Math.ceil(box.height * scale);
  if (w * h > 4_000_000) return paint(ctx);
  let all = sprites.get(ctx);
  if (!all) sprites.set(ctx, (all = new Map()));
  let sprite = all.get(name);
  if (!sprite) {
    const canvas = document.createElement('canvas');
    const layer = canvas.getContext('2d');
    if (!layer) return paint(ctx);
    all.set(name, (sprite = { canvas, ctx: layer, key: '', want: '', seen: 0 }));
  }
  const full = `${key}:${scale}`;
  if (sprite.key !== full) {
    if (sprite.want !== full) {
      sprite.want = full;
      sprite.seen = 0;
    }
    // A sprite already made waits for a new zoom to settle; a new look is painted at once.
    const rescale = sprite.key && sprite.key.slice(0, sprite.key.lastIndexOf(':')) === key;
    if (rescale && ++sprite.seen < SETTLED) return paint(ctx);
    sprite.canvas.width = w;
    sprite.canvas.height = h;
    sprite.ctx.setTransform(scale, 0, 0, scale, -box.left * scale, -box.top * scale);
    paint(sprite.ctx);
    sprite.key = full;
  }
  ctx.save();
  ctx.resetTransform();
  ctx.drawImage(
    sprite.canvas,
    Math.round(t.e + box.left * scale),
    Math.round(t.f + box.top * scale),
  );
  ctx.restore();
}

// ---- The painter ----

const spots = DISTRICT_SPOTS.bandstand;
/** The lawn the rugs cover, world px, with room for the drifts. */
const RUG_BOX: Box = (() => {
  const corners = spots.flatMap((s) =>
    [
      [s.x - RUG.x / 2, s.y - RUG.y / 2],
      [s.x + RUG.x / 2, s.y - RUG.y / 2],
      [s.x + RUG.x / 2, s.y + RUG.y / 2],
      [s.x - RUG.x / 2, s.y + RUG.y / 2],
    ].map(([x, y]) => project(x, y)),
  );
  const xs = corners.map((p) => p.x),
    ys = corners.map((p) => p.y);
  // Room round the rugs for the drifts on a snowy night.
  const left = Math.min(...xs) - 6,
    top = Math.min(...ys) - 6;
  return { left, top, width: Math.max(...xs) + 6 - left, height: Math.max(...ys) + 6 - top };
})();
const RUG_CENTER = { x: RUG_BOX.left + RUG_BOX.width / 2, y: RUG_BOX.top + RUG_BOX.height / 2 };
const SCOPE_FOOT = project(TELESCOPE.x, TELESCOPE.y);
const SCOPE_BOX: Box = { left: SCOPE_FOOT.x - 10, top: SCOPE_FOOT.y - 27, width: 22, height: 31 };

/** Whether snow lies under the rugs: on a winter star night, with the town snowed in. */
const snowyAt = (scene: { season: DistrictScene['season'] }) => scene.season.snow > 0.3;

export const stargazingPainter: DistrictPainter = {
  floor(ctx: Ctx, scene: DistrictScene) {
    const { day, minutes, night, visible, zoom } = scene;
    const evening = eveningMinute(minutes);
    if (!starNight(eveningDay(day, minutes))) return;
    const { from, to } = BANDSTAND_FURNITURE.rugs;
    if (evening < from || evening >= to) return;
    if (!visible(RUG_CENTER, RUG_BOX.width / 2, RUG_BOX.height / 2, RUG_BOX.height / 2)) return;
    const snowy = snowyAt(scene);
    const fine = zoom >= CHECK_ZOOM;
    const out = spots.map((_, k) => rugOut(k, evening));
    const paintAll = (c: Ctx) => {
      for (const k of out.keys()) if (out[k] > 0) paintRug(c, k, out[k], night, snowy, fine);
    };
    // All eight flat: the same picture all night, so it is painted once. Its only seasonal part is
    // the snow round the rugs, so the season day enters the key through that.
    if (out.every((value) => value >= 1))
      spriteOf(ctx, 'rugs', `${night}:${snowy}:${fine}`, RUG_BOX, paintAll);
    else paintAll(ctx);
  },
  objects(ctx: Ctx, scene: DistrictScene): DepthObject[] {
    const { day, minutes, night, visible } = scene;
    const evening = eveningMinute(minutes);
    if (!starNight(eveningDay(day, minutes))) return [];
    const { from, to } = BANDSTAND_FURNITURE.rugs;
    if (evening < from || evening >= to) return [];
    const objects: DepthObject[] = [];
    if (visible(SCOPE_FOOT, 12, 27, 4)) {
      const shown = Math.min(1, (evening - from) / SCOPE_FADE, (to - evening) / SCOPE_FADE);
      objects.push({
        depth: TELESCOPE.x + TELESCOPE.y,
        paint: () => {
          if (shown >= 1)
            return spriteOf(ctx, 'telescope', `${night}`, SCOPE_BOX, (c) =>
              paintTelescope(c, SCOPE_FOOT.x, SCOPE_FOOT.y, night),
            );
          const alpha = ctx.globalAlpha;
          ctx.globalAlpha = alpha * shown;
          paintTelescope(ctx, SCOPE_FOOT.x, SCOPE_FOOT.y, night);
          ctx.globalAlpha = alpha;
        },
      });
    }
    for (const k of FLASKS) {
      if (rugOut(k, evening) < 1) continue;
      const at = flaskAt(k);
      const foot = project(at.x, at.y);
      if (visible(foot, 5, 8, 2))
        objects.push({ depth: at.x + at.y, paint: () => paintFlask(ctx, foot.x, foot.y, night) });
    }
    const astronomer = astronomerAt(day, minutes);
    if (astronomer && visible(project(astronomer.at.x, astronomer.at.y), 24, 62, 8))
      objects.push({
        depth: astronomer.at.x + astronomer.at.y,
        paint: () => paintAstronomer(ctx, astronomer, night),
      });
    return objects;
  },
  sky: drawSkyExtras,
};
