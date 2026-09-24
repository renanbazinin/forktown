type Ctx = CanvasRenderingContext2D;

/** Lantern-hour colours shared by the Fork, the house posts and the sprout stakes. */
export const LIGHT = {
  lit: '#FFE0A0',
  core: '#FFF6D8',
  unlitNight: '#7C8676',
  paper: ['#F6E3B4', '#F4D7A6', '#F7EACB'],
  cap: '#6F5A3C',
  capNight: '#3A382E',
  tag: '#FBF3DE',
  tagString: '#8A5A1C',
  pennant: '#C57B65',
  pennantNight: '#8E5C51',
  pennantHi: '#E2A38C',
  pennantHiNight: '#A8766A',
} as const;

// One soft sprite per radius stands in for every per-frame gradient. Sprites are made on
// first draw, never at module load: node tests import the renderer without a document.
const sprites = new Map<number, HTMLCanvasElement | null>();

function sprite(radius: number) {
  if (sprites.has(radius)) return sprites.get(radius)!;
  // Twice the world size keeps the falloff smooth when the map is zoomed in.
  const size = Math.ceil(radius * 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    glow.addColorStop(0, 'rgba(255,218,128,1)');
    glow.addColorStop(1, 'rgba(255,218,128,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
  }
  sprites.set(radius, ctx ? canvas : null);
  return ctx ? canvas : null;
}

export function drawGlow(ctx: Ctx, x: number, y: number, radius: number, intensity: number) {
  if (typeof document === 'undefined') return;
  const image = sprite(radius);
  if (!image) return;
  const alpha = ctx.globalAlpha,
    smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = alpha * intensity;
  ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = smoothing;
}
