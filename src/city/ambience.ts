import { hash, PLOTS, project, WORLD_HEIGHT, WORLD_WIDTH, type Plot } from '../lib/world';
import { AUTUMN, SUMMER, snowAt, type TownSeason } from '../lib/seasons';
import { BLOSSOM, FOLIAGE, SNOW, pick, type Pair } from './season-palette';

type Ctx = CanvasRenderingContext2D;

// Grow a few uneven patches around each plot's edges, leaving its address clear.
// Plot-based seeds keep the meadow still across frames, visits, and town expansion.
const meadows = new Map(
  PLOTS.map((plot) => {
    const flowers = [];
    for (let patch = 0; patch < 3; patch++) {
      const seed = hash(`meadow:${plot.id}:${patch}`);
      const angle = (seed % 628) / 100;
      const cx = Math.cos(angle) * 0.85;
      const cy = Math.sin(angle) * 0.85;
      for (let i = 0; i < 5 + (seed % 4); i++) {
        const stem = hash(`flower:${plot.id}:${patch}:${i}`);
        const point = project(
          plot.x + 0.5 + cx + ((stem % 61) - 30) / 100,
          plot.y + 0.5 + cy + (((stem >>> 8) % 61) - 30) / 100,
        );
        // A second seed for the flower's year, so its place and colour stay as they were.
        const year = hash(`bloom:${plot.id}:${patch}:${i}`);
        flowers.push({
          ...point,
          height: 3 + (stem % 4),
          color: (stem >>> 16) % 4,
          when: (year % 1000) / 1000,
          bare: (year >>> 12) % 3 === 0,
        });
      }
    }
    return [plot.id, flowers.sort((a, b) => a.y - b.y)] as const;
  }),
);

// The meadow's year. Summer keeps the meadow's own palette; spring opens whites and pinks, autumn
// dries the heads to ochre and russet seed (never lantern amber), and frost holds them in the snow.
type Stage = 'spring' | 'summer' | 'seed' | 'frost';
const HEADS: Record<'spring' | 'seed', readonly Pair[]> = {
  spring: [BLOSSOM.white, BLOSSOM.pink, ['#B4A0C4', '#998AAB'], ['#89A569', '#71907A']],
  // Seed heads sit a step softer than the turning crowns, so the grass never outshines the trees.
  seed: [
    ['#D3C499', '#8E8C74'],
    ['#BA9C5C', '#716A4F'],
    ['#A87D60', '#6A5B50'],
    FOLIAGE.dormant.leaf,
  ],
};
const DRY_STEM: Pair = ['#A09A6B', '#6C776A'];
const SEED_CENTRE: Pair = ['#8E6E4A', '#5F5A4D'];

/** Where one flower is in its year, in whole days: each keeps its own schedule. */
function meadowStage(day: number, when: number): Stage {
  if (day < Math.floor(when * 5)) return 'seed';
  if (day < SUMMER - 3 + Math.floor(when * 6)) return 'spring';
  if (day < AUTUMN + 2 + Math.floor(when * 10)) return 'summer';
  return snowAt(day, when) > 0.5 ? 'frost' : 'seed';
}

export function drawMeadow(ctx: Ctx, plot: Plot, night: boolean, season?: TownSeason) {
  const colors = night
    ? ['#AABBA2', '#AFAB82', '#998AAB', '#71907A']
    : ['#F5EBCB', '#E3BD78', '#B4A0C4', '#89A569'];
  for (const flower of meadows.get(plot.id) ?? []) {
    const x = Math.round(flower.x),
      y = Math.round(flower.y);
    const stage = season ? meadowStage(season.groundDay, flower.when) : 'summer';
    const dry = stage === 'seed' || stage === 'frost';
    ctx.fillStyle = dry ? pick(DRY_STEM, night) : night ? '#6B8B73' : '#7E9C60';
    ctx.fillRect(x, y - flower.height, 1, flower.height);
    ctx.fillRect(x - 2, y - 2, 2, 1);
    // Some heads are lost to the snow; the rest keep a cap of frost.
    if (stage === 'frost' && flower.bare) continue;
    ctx.fillStyle =
      stage === 'summer'
        ? colors[flower.color]
        : stage === 'frost'
          ? pick(SNOW.frost, night)
          : pick(HEADS[stage][flower.color], night);
    ctx.fillRect(x - 1, y - flower.height, 3, 2);
    if (flower.color === 0) {
      ctx.fillRect(x, y - flower.height - 1, 1, 4);
      if (stage === 'frost') continue;
      ctx.fillStyle = stage === 'seed' ? pick(SEED_CENTRE, night) : night ? '#B6A574' : '#D7AB62';
      ctx.fillRect(x, y - flower.height, 1, 1);
    }
  }
}

export function drawChimneySmoke(
  ctx: Ctx,
  x: number,
  y: number,
  minutes: number,
  seed: number,
  night: boolean,
) {
  ctx.save();
  ctx.fillStyle = night ? '#D5DDD0' : '#F7F3DF';
  for (let puff = 0; puff < 4; puff++) {
    const age = (minutes / 10 + (seed % 100) / 100 + puff / 4) % 1;
    const size = 2 + age * 4;
    const px = Math.round(x + age * 10 + Math.sin(age * 5 + seed) * age * 3);
    const py = Math.round(y - age * 34);
    ctx.globalAlpha = Math.sin(age * Math.PI) * (night ? 0.2 : 0.35);
    // Overlapping blocks form one soft-edged pixel puff without a bright center.
    ctx.beginPath();
    ctx.rect(px - size, py - size / 2, size * 2, size);
    ctx.rect(px - size / 2, py - size, size, size * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawBirds(ctx: Ctx, minutes: number, night: boolean) {
  if (night) return;
  ctx.save();
  ctx.strokeStyle = '#667568';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  // Two small flocks, with a quiet gap between passes. No independent animation timer.
  for (let flock = 0; flock < 2; flock++) {
    const elapsed = (minutes + flock * 60) % 120;
    if (elapsed >= 80) continue;
    const progress = elapsed / 80;
    const center = project(
      -3 + progress * (WORLD_WIDTH + 6),
      WORLD_HEIGHT * (flock ? 0.65 : 0.3) + Math.sin(progress * Math.PI * 2) * 1.5,
    );
    ctx.globalAlpha = Math.min(1, elapsed / 6, (80 - elapsed) / 6) * 0.7;
    for (let bird = 0; bird < 3; bird++) {
      const x = center.x - bird * 14,
        y = center.y - 95 + (bird % 2 ? -9 : 4);
      const wing = Math.sin(minutes * 4 + bird * 0.8) * 3;
      ctx.beginPath();
      ctx.moveTo(x - 5, y - wing);
      ctx.lineTo(x - 2, y - 1);
      ctx.lineTo(x, y + 1);
      ctx.lineTo(x + 2, y - 1);
      ctx.lineTo(x + 5, y - wing);
      ctx.stroke();
    }
  }
  ctx.restore();
}
