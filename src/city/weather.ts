import { AUTUMN, WINTER, type TownSeason } from '../lib/seasons';
import { insideCinema } from '../lib/cinema';
import { insideFarm } from '../lib/farm';
import { insideFootball } from '../lib/football';
import { insideZoo } from '../lib/zoo';
import { insideMillpond, MILLPOND_REEDS } from '../lib/millpond';
import { VENUES } from '../lib/events';
import { hash, isRoad, PLOTS, project, WORLD_HEIGHT, WORLD_WIDTH, type Point } from '../lib/world';
import { FIREFLY, SNOW, pick, type Pair } from './season-palette';

type Ctx = CanvasRenderingContext2D;
type Visible = (point: Point, rx: number, above: number, below: number) => boolean;
type DepthObject = { depth: number; paint: () => void };

// Seasonal life in the air: fireflies on summer nights, falling snow, and the season's light.
// Every motion is a pure function of the town minute and hash() seeds, like the birds.

const mod = (value: number, length: number) => ((value % length) + length) % length;
const unit = (seed: number, shift: number, steps = 1000) => ((seed >>> shift) % steps) / steps;
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

type Firefly = {
  ground: Point;
  /** Hover height above the grass, in world pixels. */
  lift: number;
  /** Blink period in town minutes, and where in it this one starts. */
  period: number;
  phase: number;
  drift: [x: number, y: number, speedX: number, speedY: number, turn: number];
  /** Out once the night's firefly level passes this, so the count swells and thins smoothly. */
  threshold: number;
  big: boolean;
};

// Small swarms over grass: meadow and garden edges, under the edge trees and along the river.
// Seeded by place, so each summer night the same banks and verges light up.
const venueTiles = new Set(
  VENUES.map((venue) => PLOTS.find((plot) => plot.id === venue.plot)!).map(
    (plot) => `${plot.x},${plot.y}`,
  ),
);
const onGrass = (x: number, y: number) =>
  x >= 0 &&
  y >= 0 &&
  x < WORLD_WIDTH &&
  y < WORLD_HEIGHT &&
  !isRoad(Math.floor(x), Math.floor(y)) &&
  ![insideCinema, insideZoo, insideFootball, insideFarm, insideMillpond].some((inside) =>
    inside({ x, y }),
  );
function swarm(
  key: string,
  x: number,
  y: number,
  spread: number,
  accept: (x: number, y: number) => boolean = onGrass,
) {
  const seed = hash(`firefly:${key}`);
  const flies: Firefly[] = [];
  for (let k = 0; k < 3 + (seed % 4); k++) {
    const s = hash(`firefly:${key}:${k}`);
    const fx = x + (unit(s, 0) - 0.5) * spread,
      fy = y + (unit(s, 10) - 0.5) * spread;
    if (!accept(fx, fy)) continue;
    const t = hash(`firefly-flight:${key}:${k}`);
    flies.push({
      ground: project(fx, fy),
      lift: 4 + (t % 15),
      period: 2 + unit(t, 4, 300) * 3,
      phase: unit(t, 12),
      drift: [2 + ((t >>> 22) % 4), 1 + ((t >>> 26) % 3), 0.2 + unit(s, 20, 30), 0.3, unit(t, 8)],
      threshold: unit(s, 2) * 0.9,
      big: s % 5 < 4,
    });
  }
  return { point: project(x, y), depth: x + y, flies };
}
// Over the Millpond's reed beds on summer nights: a few swarms, low over the reeds and the water.
export const MILLPOND_SWARMS = MILLPOND_REEDS.filter((_, i) => i % 2 === 0)
  .slice(0, 5)
  .map((reed) =>
    swarm(`reeds:${reed.seed}`, reed.x, reed.y, 0.7, (x, y) => insideMillpond({ x, y })),
  );
const SWARMS = [
  // Around the plots, a tile out from the middle: over a meadow, or the lawn beside a house.
  ...PLOTS.filter((plot) => !venueTiles.has(`${plot.x},${plot.y}`)).flatMap((plot) => {
    const seed = hash(`firefly-plot:${plot.id}`);
    if (seed % 5 === 0) return [];
    const angle = unit(seed, 3, 628) * 2 * Math.PI,
      reach = 0.95 + unit(seed, 13, 25);
    const x = plot.x + 0.5 + Math.cos(angle) * reach,
      y = plot.y + 0.5 + Math.sin(angle) * reach;
    return onGrass(x, y) ? [swarm(plot.id, x, y, 1.1)] : [];
  }),
  // Under the edge trees on the two far sides of town.
  ...Array.from({ length: Math.ceil(WORLD_HEIGHT / 2) }, (_, i) => {
    const seed = hash(`firefly-edge:x:${i}`);
    return seed % 5 < 2 ? [] : [swarm(`x:${i}`, 0.5, 2 * i + unit(seed, 4) * 2, 0.6)];
  }).flat(),
  ...Array.from({ length: Math.ceil(WORLD_WIDTH / 2) }, (_, i) => {
    const seed = hash(`firefly-edge:y:${i}`);
    return seed % 5 < 2 ? [] : [swarm(`y:${i}`, 2 * i + unit(seed, 4) * 2, 0.5, 0.6)];
  }).flat(),
  // Low over the water and the far bank: the near bank is the riverside road.
  ...Array.from({ length: Math.floor((WORLD_HEIGHT - 9) / 2) }, (_, i) => {
    const seed = hash(`firefly-river:${i}`);
    const y = 9 + 2 * i + unit(seed, 4) * 2;
    return seed % 3 ? [swarm(`river:${i}`, WORLD_WIDTH - 1.4 + unit(seed, 14) * 0.6, y, 0.8)] : [];
  }).flat(),
  ...MILLPOND_SWARMS,
];

// A blink is a short flash: a quick brightening, a steady glow, then two fading steps.
const BLINK = 0.55;
const blinkAlpha = (q: number) => (q < 0.14 ? 0.5 : q < 0.62 ? 1 : q < 0.82 ? 0.6 : 0.3);

/** Summer fireflies as depth objects, so houses and trees in front of them hide them. */
export function drawFireflies(
  ctx: Ctx,
  season: TownSeason,
  night: boolean,
  visible: Visible,
): DepthObject[] {
  const level = season.fireflies;
  if (!night || level <= 0) return [];
  // The absolute town minute: fireflies keep blinking and drifting straight through midnight.
  const time = season.day * 1440 + season.minutes;
  const objects: DepthObject[] = [];
  for (const { point, depth, flies } of SWARMS) {
    // Wide enough for the whole swarm, so flies near the screen edge never pop in and out.
    if (!visible(point, 50, 45, 22)) continue;
    const lit = flies.flatMap((fly) => {
      const q = mod(time / fly.period + fly.phase, 1);
      if (level <= fly.threshold || q >= BLINK) return [];
      const [dx, dy, speedX, speedY, turn] = fly.drift;
      const x = Math.round(fly.ground.x + Math.sin(time * speedX + turn * 6.3) * dx),
        y = Math.round(
          fly.ground.y - fly.lift + Math.sin(time * speedY * (1 + turn) + turn * 9) * dy,
        );
      return [{ x, y, big: fly.big, alpha: blinkAlpha(q / BLINK) }];
    });
    if (!lit.length) continue;
    objects.push({
      depth,
      paint: () => {
        const alpha = ctx.globalAlpha;
        for (const { x, y, big, alpha: glow } of lit) {
          const size = big ? 2 : 1;
          ctx.globalAlpha = alpha * glow * 0.4;
          ctx.fillStyle = FIREFLY.halo;
          ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
          ctx.globalAlpha = alpha * glow;
          ctx.fillStyle = FIREFLY.core;
          ctx.fillRect(x, y, size, size);
        }
        ctx.globalAlpha = alpha;
      },
    });
  }
  return objects;
}

// Flakes per screen area at a full flurry, and the most any screen gets.
const FLAKES_PER_PIXEL = 60 / (1440 * 900);
const MAX_FLAKES = 110;
const FLAKES = Array.from({ length: MAX_FLAKES }, (_, i) => {
  const seed = hash(`snowflake:${i}`),
    more = hash(`snowflake-fall:${i}`);
  return {
    x: unit(seed, 0),
    y: unit(seed, 10),
    // Screen pixels per town minute: a flake crosses a laptop screen in 20-40 seconds.
    fall: 24 + (more % 22),
    lean: 0.18 + unit(more, 6, 20) / 100,
    sway: 1 + ((more >>> 12) % 3),
    turn: unit(more, 16),
    small: seed % 4 === 0,
    alpha: 0.55 + unit(seed, 22, 26) / 100,
  };
});

/** Screen-space snowfall in front of the town, on flurry days in winter. */
export function drawSnowfall(
  ctx: Ctx,
  width: number,
  height: number,
  season: TownSeason,
  night: boolean,
) {
  const count = Math.min(MAX_FLAKES, season.flurry * FLAKES_PER_PIXEL * width * height);
  if (count <= 0) return;
  // The absolute town minute keeps flakes falling straight through midnight.
  const time = season.day * 1440 + season.minutes;
  const margin = 8,
    spanX = width + 2 * margin,
    spanY = height + 2 * margin;
  ctx.save();
  ctx.fillStyle = pick(SNOW.flake, night);
  for (let i = 0; i < count; i++) {
    const flake = FLAKES[i];
    const fallen = time * flake.fall;
    const x = Math.round(
      mod(flake.x * spanX - fallen * flake.lean, spanX) -
        margin +
        Math.sin(time * 0.3 + flake.turn * 6.3) * flake.sway,
    );
    const y = Math.round(mod(flake.y * spanY + fallen, spanY) - margin);
    // The newest flake of a thickening flurry fades in rather than appearing at once.
    ctx.globalAlpha = flake.alpha * Math.min(1, count - i);
    const size = flake.small ? 1 : 2;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

// Winter's light is cool and pale off the snow; late autumn's is faintly russet.
const WINTER_LIGHT: Pair = ['#E8F0F0', '#9DB3B8'];
const AUTUMN_LIGHT: Pair = ['#C48A62', '#7E6152'];

/** A faint seasonal wash over the finished frame, like golden hour's. */
export function drawSeasonLight(
  ctx: Ctx,
  width: number,
  height: number,
  season: TownSeason,
  night: boolean,
) {
  const d = season.yearDay;
  const winter = (night ? 0.04 : 0.055) * season.snow;
  // Autumn's light eases in over Autumn 7-15 and hands over to winter's over Autumn 27 - Winter 1.
  const autumn =
    d >= AUTUMN && d < WINTER + 2
      ? (night ? 0.012 : 0.018) *
        smooth((d - AUTUMN - 6) / 8) *
        (1 - smooth((d - (WINTER - 2)) / 3))
      : 0;
  const [alpha, pair] = winter >= autumn ? [winter, WINTER_LIGHT] : [autumn, AUTUMN_LIGHT];
  if (alpha < 0.002) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pick(pair, night);
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
