import { AUTUMN, WINTER, groundFraction, snowAt, type TownSeason } from '../lib/seasons';
import { BLOSSOM, FALLEN_LEAVES, SNOW, pick } from './season-palette';

// Seasonal touches for the cached ground layer. They read season.groundDay only, which is part
// of the ground cache key, so the layer repaints at most once per town day. Snow is read at the
// day's first minute, so the ground whitens the morning after the roofs, never before them.

/** One of the three grass tufts on a tile: fallen leaves in autumn, frost and snow in winter. */
export function groundTuft(seed: number, k: number, night: boolean, season?: TownSeason) {
  const grass = { fill: night ? '#638171' : '#A4BE81', w: 2, h: 2 };
  if (!season) return grass;
  const day = season.groundDay;
  // Each tuft keeps its own day for every change, so the lawn turns a little each town day.
  const when = groundFraction(seed, k),
    share = groundFraction(seed, k + 3);
  // Snow lies in the grass: the tufts frost over and a few gather a small drift.
  if (snowAt(day, when) > 0.5)
    return share < 0.18
      ? { fill: pick(SNOW.top, night), w: 4, h: 2 }
      : { fill: pick(SNOW.frost, night), w: 2, h: 2 };
  // Fallen leaves, gathering on the lawns while the trees let go (canopyAt's leaf fall), a few
  // more each day until the snow covers them.
  if (share < 0.4 && day >= AUTUMN + 13 + Math.floor(when * 10) && day < WINTER + 2) {
    const look = groundFraction(seed, k + 6);
    const leaf = FALLEN_LEAVES[Math.floor(look * 9) % FALLEN_LEAVES.length];
    return { fill: pick(leaf, night), w: look > 0.7 ? 3 : 2, h: look > 0.85 ? 2 : 1 };
  }
  // A pale petal on the odd tuft while the blossom trees shed.
  if (share > 0.93 && day >= 15 + Math.floor(when * 6) && day < 24 + Math.floor(when * 4))
    return { fill: pick(share > 0.965 ? BLOSSOM.white : BLOSSOM.pink, night), w: 2, h: 1 };
  return grass;
}

/** The river's light streaks: thin ice in deep winter, after the snow has settled. */
export function riverGlint(base: string, night: boolean, season?: TownSeason, seed = 0) {
  if (!season) return base;
  const day = season.groundDay,
    when = groundFraction(seed, 7);
  const ice = day >= WINTER + 3 + Math.floor(when * 6) && day < WINTER + 19 + Math.floor(when * 5);
  return ice ? pick(SNOW.ice, night) : base;
}
