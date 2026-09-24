import { hash, project, TILE_H, TILE_W, WORLD_HEIGHT, WORLD_WIDTH } from '../lib/world';

type Ctx = CanvasRenderingContext2D;
type Rgb = readonly number[];
type Layer = 0 | 1;

export const mixRgb = (from: Rgb, to: Rgb, amount: number) =>
  from.map((channel, i) => channel + (to[i] - channel) * amount);
export const rgb = (color: Rgb) => `rgb(${color.map(Math.round).join(' ')})`;
const smooth = (t: number) => t * t * (3 - 2 * t);
const townTime = (minutes: number) => ((minutes % 1440) + 1440) % 1440;

// Warm light either side of the sun's low arcs: 18:30-20:20 (still 0.30 when the lanterns
// start at 20:00) and 05:30-07:00. Only the sky, the hills and a faint wash take the colour.
export function goldenHour(minutes: number) {
  const t = townTime(minutes);
  const bell = (center: number, width: number) =>
    smooth(Math.max(0, 1 - Math.abs(t - center) / width));
  return Math.max(bell(1165, 55), bell(375, 45));
}

// Other forks keep the same nightfall as the Lantern Fork.
export const sisterForkLit = (minutes: number) => {
  const t = townTime(minutes);
  return t >= 1200 || t < 360;
};

// Heights as fractions of the screen. The desktop opening view shows sky down to about half
// height at its edges, with the far fields filling the lower part of those triangles; the
// ridges sit just above the fields so both read, and pass quietly behind the town elsewhere.
const RIDGES = [
  { base: 0.29, amp: 0.06 },
  { base: 0.34, amp: 0.045 },
];
const PHASES = RIDGES.map((_, layer) =>
  [0, 1, 2].map((k) => (hash(`horizon:${layer}:${k}`) % 1000) / 1000),
);

export function horizonRidge(u: number, layer: Layer) {
  const [a, b, c] = PHASES[layer];
  const wave = (frequency: number, phase: number) =>
    Math.sin(2 * Math.PI * (frequency * u + phase));
  return 0.5 + 0.25 * wave(1.7, a) + 0.15 * wave(4.3, b) + 0.1 * wave(9.1, c);
}

// Even screen rows keep the hills on the same two-pixel grain as the sun and moon.
export function horizonY(u: number, height: number, layer: Layer) {
  const { base, amp } = RIDGES[layer];
  return 2 * Math.round((height * (base - amp * horizonRidge(u, layer))) / 2);
}

// The ridge is sampled once per four-pixel step, so it reads as terraced pixel hills.
const ridgeAt = (x: number, width: number, height: number, layer: Layer) =>
  horizonY((Math.floor(x / 4) * 4) / width, height, layer);

export const SISTER_FORKS = [0.11, 0.79, 0.91].map((u, i) => ({
  u,
  seed: hash(`sister-fork:${i}`),
}));

// Anchor points on the far ridge, kept near the screen sides so the opening view shows them.
export const sisterForkSites = (width: number, height: number) =>
  SISTER_FORKS.map(({ u, seed }) => {
    const x = Math.round(u * width);
    return { x, y: ridgeAt(x, width, height, 0), seed };
  });

// One path per layer: only the steps where the ridge changes height become vertices.
// The sides and base sit just off-canvas, so nothing but the ridge line ever shows.
function traceRidge(ctx: Ctx, width: number, height: number, layer: Layer, lift = 0) {
  let level = ridgeAt(0, width, height, layer) - lift;
  ctx.beginPath();
  ctx.moveTo(-1, height + 1);
  ctx.lineTo(-1, level);
  for (let x = 4; x < width; x += 4) {
    const y = ridgeAt(x, width, height, layer) - lift;
    if (y === level) continue;
    ctx.lineTo(x, level);
    ctx.lineTo(x, y);
    level = y;
  }
  ctx.lineTo(width + 1, level);
  ctx.lineTo(width + 1, height + 1);
}

function drawSisterFork(
  ctx: Ctx,
  site: { x: number; y: number; seed: number },
  width: number,
  height: number,
  scale: number,
  lit: boolean,
) {
  const size = (value: number) => Math.max(1, Math.round(value * scale));
  // Every piece stands on the lowest ridge step beneath it, so nothing floats.
  const groundUnder = (dx: number, w: number) => {
    const left = site.x + Math.round(dx * scale);
    let ground = ridgeAt(left + size(w) - 1, width, height, 0);
    for (let x = left; x < left + size(w); x += 4)
      ground = Math.max(ground, ridgeAt(x, width, height, 0));
    return ground;
  };
  const block = (ground: number, dx: number, dy: number, w: number, h: number) =>
    ctx.fillRect(
      site.x + Math.round(dx * scale),
      ground + Math.round(dy * scale),
      size(w),
      size(h),
    );
  // A tiny Y: trunk, two limbs, a canopy on the left and a lantern on the right.
  const root = groundUnder(-19, 2);
  const tree = (dx: number, dy: number, w: number, h: number) => block(root, dx - 22, dy, w, h);
  tree(3, -6, 2, 6);
  tree(1, -9, 2, 3);
  tree(5, -9, 2, 3);
  tree(-1, -13, 4, 4);
  const houses = Array.from({ length: 3 + (site.seed % 3) }, (_, k) => {
    const dx = -12 + 7 * k,
      w = 5 + ((site.seed >>> (3 * k)) % 4),
      h = 4 + ((site.seed >>> (2 * k + 1)) % 4);
    return { dx, w, h, ground: groundUnder(dx, w) };
  });
  for (const { dx, w, h, ground } of houses) {
    block(ground, dx, -h, w, h + 2);
    block(ground, dx + 1, -h - 2, w - 2, 2);
  }
  ctx.save();
  if (lit) {
    ctx.fillStyle = '#FFE0A0';
    ctx.globalAlpha = 0.25;
    tree(5, -13, 4, 5);
    ctx.globalAlpha = 0.85;
    for (const { dx, h, ground } of houses) block(ground, dx + 2, -h + 2, 1, 1);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = '#E9DDB8';
    ctx.globalAlpha = 0.6;
  }
  tree(6, -12, 2, 3);
  ctx.restore();
}

// Screen-space hills behind the town, painted by drawSky after the sun and moon so the
// sun sets behind the far ridge. Two quiet layers fill the opening view's sky triangles.
export function drawHorizon(
  ctx: Ctx,
  width: number,
  height: number,
  daylight: number,
  minutes: number,
) {
  const glow = goldenHour(minutes);
  ctx.save();
  ctx.globalAlpha = 1; // drawSky leaves the last star/sun/moon alpha behind
  if (glow > 0) {
    // A one-pixel rim of low sun: the ridge lifted by a row, then covered by the hill itself.
    traceRidge(ctx, width, height, 0, 1);
    ctx.globalAlpha = 0.6 * glow;
    ctx.fillStyle = '#F2D8A8';
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  traceRidge(ctx, width, height, 0);
  ctx.fillStyle = rgb(
    mixRgb(mixRgb([44, 67, 65], [199, 211, 188], daylight), [217, 207, 163], 0.25 * glow),
  );
  ctx.fill();
  const scale = Math.max(0.7, Math.min(1, width / 900));
  const lit = sisterForkLit(minutes);
  for (const site of sisterForkSites(width, height)) {
    ctx.fillStyle = rgb(mixRgb([30, 49, 48], [122, 142, 110], daylight));
    drawSisterFork(ctx, site, width, height, scale, lit);
  }
  traceRidge(ctx, width, height, 1);
  ctx.fillStyle = rgb(mixRgb([40, 61, 58], [183, 199, 166], daylight));
  ctx.fill();
  ctx.restore();
}

const FAR_TREES = Array.from({ length: 18 }, (_, i) => {
  const seed = hash(`far-tree:${i}`);
  const side = i % 2;
  const along = ((seed % 1000) / 1000) * (side ? WORLD_HEIGHT : WORLD_WIDTH);
  const beyond = 0.4 + ((seed >>> 10) % 120) / 100;
  return side ? project(-beyond, along) : project(along, -beyond);
});

// World-space fields beyond the NE (y < 0) and NW (x < 0) edges, painted in the ground
// cache before the slab. Three fading strips, two hedgerows and a scatter of far trees.
export function drawFarFields(ctx: Ctx, night: boolean) {
  const W = WORLD_WIDTH,
    H = WORLD_HEIGHT;
  ctx.save();
  // In tile space each strip is two plain rectangles meeting in a square corner.
  ctx.transform(TILE_W / 2, TILE_H / 2, -TILE_W / 2, TILE_H / 2, 0, 0);
  ctx.fillStyle = night ? '#45605A' : '#B3C697';
  [0.55, 0.32, 0.14].forEach((alpha, k) => {
    const a = 2 * k,
      b = a + 2;
    ctx.globalAlpha = alpha;
    ctx.fillRect(-b, -b, W + b, 2);
    ctx.fillRect(-b, -a, 2, H + a);
  });
  // A tile-space band 1/TILE_H deep is one world pixel tall on screen.
  const line = 1 / TILE_H;
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = night ? '#3A544E' : '#9FB585';
  for (const edge of [2, 4]) {
    ctx.fillRect(-edge, -edge - line / 2, W + edge, line);
    ctx.fillRect(-edge - line / 2, -edge, line, H + edge);
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = night ? '#3C5650' : '#97AF80';
  for (const { x, y } of FAR_TREES) {
    ctx.fillRect(x - 6, y - 10, 12, 8);
    ctx.fillRect(x - 4, y - 12, 8, 2);
  }
  ctx.restore();
}

// A paver at the centre of a road crossing: the road grid reads as a commit graph.
// The four crossings around the Lantern Fork are brass, marking it as HEAD.
export function drawCommitStone(ctx: Ctx, x: number, y: number, night: boolean, brass: boolean) {
  const [fill, ring] = brass
    ? night
      ? ['#A2946B', '#7A6E50']
      : ['#E4C98A', '#B89A5E']
    : night
      ? ['#8E9A89', '#6C7C6F']
      : ['#EEE6CC', '#CFC6A3'];
  ctx.fillStyle = fill;
  ctx.fillRect(x - 6, y - 3, 12, 4);
  ctx.fillRect(x - 4, y - 4, 8, 6);
  ctx.fillStyle = ring;
  ctx.fillRect(x - 6, y, 12, 1);
  ctx.fillRect(x - 4, y + 1, 8, 1);
}

// Screen-space warmth over the finished frame, never stronger than 0.05.
export function drawGoldenHour(ctx: Ctx, width: number, height: number, minutes: number) {
  const alpha = 0.05 * goldenHour(minutes);
  if (alpha < 0.002) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#F2B45A';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
