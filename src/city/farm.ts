import { FARM_GROUND as G, scarecrowAt, ufoAt } from '../lib/farm';
import type { Place } from '../lib/schema';
import { houseBounds } from './houses';
import { project, hash, type Point } from '../lib/world';
import {
  AUTUMN,
  SUMMER,
  WINTER,
  groundFraction,
  snowAt,
  yearDayAt,
  type TownSeason,
} from '../lib/seasons';
import { PUMPKIN, SNOW, mixHex, pick, type Pair } from './season-palette';

type Ctx = CanvasRenderingContext2D;
function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function ground(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  [project(x, y), project(x + w, y), project(x + w, y + h), project(x, y + h)].forEach((p, i) =>
    i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
  );
  ctx.closePath();
  ctx.fill();
}

// The farm's year. It is painted in the cached ground layer, so it reads season.groundDay only.
// Every plant and every row keeps its own schedule in whole days, so the field changes a little
// each town day. Without a season the field looks as it always has: ripe, gold and green.
const GRAIN = {
  stalk: ['#CAAB54', '#A09159'] as Pair,
  head: ['#F3D682', '#C5B276'] as Pair,
  leaf: ['#B0AC65', '#8F945F'] as Pair,
  // Young grain before it ripens, and the stubble left once a row is cut.
  greenStalk: ['#8FA55B', '#6B8058'] as Pair,
  greenHead: ['#B4C27A', '#899A6C'] as Pair,
  greenLeaf: ['#93AA5F', '#6A8159'] as Pair,
  stubble: ['#C6AD6A', '#8E865F'] as Pair,
};
const GREENS = { dark: ['#6F964E', '#526E54'] as Pair, light: ['#9FBA6B', '#7E9567'] as Pair };
const VINE = {
  flower: ['#E6CC6A', '#A29B6A'] as Pair,
  fruit: ['#8DAA5C', '#5E7A58'] as Pair,
  fruitLight: ['#A9C272', '#728C62'] as Pair,
  withered: ['#9A935F', '#5F6552'] as Pair,
};
const FIELD = {
  ground: ['#B8B584', '#65705A'] as Pair,
  soil: ['#98734D', '#584E43'] as Pair,
  furrow: ['#BB925D', '#786247'] as Pair,
};
/** 0..1 through a change that starts on day `start` and takes `length` whole days. */
const through = (day: number, start: number, length: number) =>
  Math.max(0, Math.min(1, (day - start + 1) / length));
const blend = (from: Pair, to: Pair, amount: number, night: boolean) =>
  mixHex(pick(from, night), pick(to, night), amount);

/** Grain: shoots in spring, tall and green in summer, gold by late summer, cut in late autumn. */
function grain(ctx: Ctx, p: Point, seed: number, night: boolean, day?: number, cut = 0) {
  const height = 7 + (seed % 5);
  if (day === undefined) {
    box(ctx, p.x, p.y - height, 1.5, height, pick(GRAIN.stalk, night));
    box(ctx, p.x - 2, p.y - height, 5, 4, pick(GRAIN.head, night));
    box(ctx, p.x - 3, p.y - 5, 3, 2, pick(GRAIN.leaf, night));
    return;
  }
  const when = groundFraction(seed, 1);
  const sown = 3 + Math.floor(when * 5);
  if (day < sown) return;
  if (day >= AUTUMN + 14 + Math.floor(cut * 8)) {
    box(ctx, p.x - 1, p.y - 3, 3, 3, pick(GRAIN.stubble, night));
    return;
  }
  if (day < SUMMER) {
    const shoot = Math.min(height, 2 + Math.floor((day - sown) / 3));
    box(ctx, p.x, p.y - shoot, 1.5, shoot, pick(GRAIN.greenStalk, night));
    if (shoot > 4) box(ctx, p.x - 3, p.y - 5, 3, 2, pick(GRAIN.greenLeaf, night));
    return;
  }
  const gold = through(day, SUMMER + 12 + Math.floor(when * 9), 6);
  box(ctx, p.x, p.y - height, 1.5, height, blend(GRAIN.greenStalk, GRAIN.stalk, gold, night));
  box(ctx, p.x - 2, p.y - height, 5, 4, blend(GRAIN.greenHead, GRAIN.head, gold, night));
  box(ctx, p.x - 3, p.y - 5, 3, 2, blend(GRAIN.greenLeaf, GRAIN.leaf, gold, night));
}

/** Leafy greens stay all year: seedlings in early spring, fewer and frosted in the snow. */
function greens(ctx: Ctx, p: Point, seed: number, night: boolean, day?: number) {
  const when = day === undefined ? 0 : groundFraction(seed, 2);
  if (day !== undefined && day < 5 + Math.floor(when * 8)) {
    box(ctx, p.x - 2, p.y - 3, 5, 3, pick(GREENS.light, night));
    return;
  }
  if (day !== undefined && day >= WINTER) {
    // Most are picked by winter; the rest wear the frost while the snow lies.
    if (groundFraction(seed, 3) < 0.45) return;
    const frost = snowAt(day, when) > 0.5;
    box(ctx, p.x - 4, p.y - 4, 8, 5, blend(GREENS.dark, SNOW.frost, frost ? 0.22 : 0, night));
    box(ctx, p.x - 2, p.y - 7, 5, 4, blend(GREENS.light, SNOW.frost, frost ? 0.6 : 0, night));
    return;
  }
  box(ctx, p.x - 4, p.y - 4, 8, 5, pick(GREENS.dark, night));
  box(ctx, p.x - 2, p.y - 7, 5, 4, pick(GREENS.light, night));
  if (seed % 3 === 0) box(ctx, p.x, p.y - 2, 2, 3, '#C78858');
}

/** The pumpkin patch: vines in spring, then flowers, small green fruit in summer and orange in
 * autumn. The first snow clears the field but for a forgotten pumpkin or two under a snow cap. */
function pumpkin(ctx: Ctx, p: Point, seed: number, night: boolean, day?: number) {
  const fruit = seed % 2 === 0;
  const ripe = (color: string) => {
    box(ctx, p.x - 3, p.y - 6, 7, 6, color);
    box(ctx, p.x, p.y - 5, 1, 5, pick(PUMPKIN.rib, night));
    box(ctx, p.x, p.y - 8, 2, 2, '#648151');
  };
  if (day === undefined) {
    box(ctx, p.x - 4, p.y - 3, 9, 3, pick(PUMPKIN.leaf, night));
    if (fruit) ripe(pick(PUMPKIN.body, night));
    return;
  }
  const when = groundFraction(seed, 4);
  const snowy = snowAt(day, when) > 0.5;
  if (day >= WINTER || snowy) {
    // This salt leaves exactly two behind, in different beds.
    if (!fruit || groundFraction(seed, 38) > 0.035) return;
    box(ctx, p.x - 3, p.y - 6, 7, 6, pick(PUMPKIN.body, night));
    if (snowy) {
      box(ctx, p.x - 3, p.y - 6, 7, 1, pick(SNOW.top, night));
      box(ctx, p.x - 2, p.y - 7, 5, 1, pick(SNOW.top, night));
    }
    box(ctx, p.x, p.y - 9, 2, 2, pick(PUMPKIN.stem, night));
    return;
  }
  if (day < 2 + Math.floor(when * 6)) return;
  if (day < 11 + Math.floor(when * 6)) {
    box(ctx, p.x - 2, p.y - 2, 4, 2, pick(PUMPKIN.leaf, night));
    return;
  }
  const wither = through(day, AUTUMN + 14 + Math.floor(when * 8), 4);
  box(ctx, p.x - 4, p.y - 3, 9, 3, blend(PUMPKIN.leaf, VINE.withered, wither, night));
  if (!fruit || day < 18 + Math.floor(when * 6)) return;
  const set = SUMMER + Math.floor(when * 5);
  if (day < set) {
    box(ctx, p.x - 1, p.y - 4, 2, 2, pick(VINE.flower, night));
    return;
  }
  const turn = AUTUMN - 6 + Math.floor(when * 8);
  if (day < turn) {
    // The fruit swells through summer, then turns orange around the start of autumn.
    const size = day < SUMMER + 12 + Math.floor(when * 6) ? 4 : 5;
    box(ctx, p.x - 2, p.y - size, size, size - 1, pick(VINE.fruit, night));
    box(ctx, p.x, p.y - size + 1, 1, size - 2, pick(VINE.fruitLight, night));
    return;
  }
  ripe(blend(VINE.fruit, PUMPKIN.body, through(day, turn, 4), night));
}

export function drawFarmGround(ctx: Ctx, night: boolean, season?: TownSeason) {
  const day = season?.groundDay;
  // A light frost over the field while the snow lies; the furrows fill with snow row by row.
  const frost = day !== undefined && snowAt(day) > 0.5;
  const field = blend(FIELD.ground, SNOW.frost, frost ? 0.3 : 0, night);
  ground(ctx, G.left, G.top, G.right - G.left, G.bottom - G.top, field);
  // Two long footpaths leave the scarecrow room to travel between plots.
  for (const y of [75.5, 79.5])
    ground(ctx, G.left + 0.3, y - 0.35, G.right - G.left - 0.6, 0.7, night ? '#8B8870' : '#D6C69B');
  for (let bed = 0; bed < 6; bed++) {
    const left = G.left + 0.6 + bed * 3.7;
    for (const top of [G.top + 0.35, G.top + 2.1, G.top + 3.9, G.top + 5.9]) {
      const h = top > G.bottom - 1.5 ? 0.7 : 1.05;
      ground(ctx, left, top, 3.1, h, blend(FIELD.soil, SNOW.frost, frost ? 0.15 : 0, night));
      for (let row = 0; row < 2; row++) {
        // One schedule per row: the snow settles and the grain is cut a row at a time.
        const rowWhen = day === undefined ? 0 : (hash(`row:${bed}:${top}:${row}`) % 1000) / 1000;
        const snowy = day !== undefined && snowAt(day, rowWhen) > 0.5;
        ground(
          ctx,
          left + 0.12,
          top + row * 0.36 + 0.13,
          2.86,
          0.08,
          pick(snowy ? SNOW.shade : FIELD.furrow, night),
        );
        for (let plant = 0; plant < 8; plant++) {
          const p = project(left + 0.24 + plant * 0.36, top + row * 0.36 + 0.2);
          const seed = hash(`crop:${bed}:${top}:${row}:${plant}`);
          if (bed % 3 === 0) grain(ctx, p, seed, night, day, rowWhen);
          else if (bed % 3 === 1) greens(ctx, p, seed, night, day);
          else pumpkin(ctx, p, seed, night, day);
        }
      }
    }
  }
}

function fence(ctx: Ctx, a: Point, b: Point, night: boolean) {
  const from = project(a.x, a.y),
    to = project(b.x, b.y);
  ctx.strokeStyle = night ? '#8C8B71' : '#C7B48A';
  ctx.lineWidth = 2;
  for (const rise of [5, 11]) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y - rise);
    ctx.lineTo(to.x, to.y - rise);
    ctx.stroke();
  }
  box(ctx, from.x - 1.5, from.y - 15, 3, 16, night ? '#A09C7D' : '#E0CD9F');
}

export function drawFarm(ctx: Ctx, minutes: number, day: number, night: boolean) {
  const objects: { depth: number; paint: () => void }[] = [];
  const edges = [
    [
      { x: G.left, y: G.top },
      { x: G.right, y: G.top },
    ],
    [
      { x: G.left, y: G.bottom },
      { x: G.right, y: G.bottom },
    ],
    [
      { x: G.left, y: G.top },
      { x: G.left, y: G.bottom },
    ],
    [
      { x: G.right, y: G.top },
      { x: G.right, y: G.bottom },
    ],
  ];
  for (const [a, b] of edges) {
    const count = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let i = 0; i < count; i++) {
      // A gate in each short end, aligned with the footpaths.
      const from = { x: a.x + ((b.x - a.x) * i) / count, y: a.y + ((b.y - a.y) * i) / count };
      const to = {
        x: a.x + ((b.x - a.x) * (i + 1)) / count,
        y: a.y + ((b.y - a.y) * (i + 1)) / count,
      };
      if (a.x === b.x && [75.5, 79.5].some((y) => y >= from.y && y <= to.y)) continue;
      objects.push({
        depth: (from.x + to.x + from.y + to.y) / 2,
        paint: () => fence(ctx, from, to, night),
      });
    }
  }
  const crow = scarecrowAt(minutes, day);
  // In winter the hat keeps a line of snow on its brim and crown, settling like the roofs.
  const snow = snowAt(yearDayAt(day, minutes), 0.4);
  const brim = (x: number, y: number, w: number) => {
    if (!snow) return;
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * snow;
    box(ctx, x, y, w, 1, pick(SNOW.top, night));
    ctx.globalAlpha = alpha;
  };
  objects.push({
    depth: crow.position.x + crow.position.y,
    paint: () => {
      const p = project(crow.position.x, crow.position.y);
      ctx.fillStyle = '#263D343D';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 1, 11 - crow.lift / 4, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(p.x, p.y - crow.lift);
      ctx.rotate(crow.tilt);
      box(ctx, -2, -39, 4, 40, night ? '#8E7959' : '#A58A61');
      box(ctx, -19, -31, 38, 3, '#B29A6B');
      box(ctx, -8, -33, 16, 20, night ? '#7F6864' : '#B87A69');
      box(ctx, -17, -31, 34, 6, night ? '#7F6864' : '#B87A69');
      box(ctx, -8, -32, 5, 17, night ? '#9D8575' : '#D49C7D');
      box(ctx, 2, -22, 4, 5, '#D4BE8B');
      box(ctx, -7, -46, 14, 13, night ? '#BEAD7F' : '#E5CA8C');
      box(ctx, -4, -41, 2, 2, '#423D36');
      box(ctx, 3, -41, 2, 2, '#423D36');
      box(ctx, -2, -36, 5, 1, '#736248');
      box(ctx, -12, -48, 24, 3, '#9E8051');
      brim(-12, -49, 24);
      box(ctx, -7, -56, 14, 8, night ? '#AE9661' : '#D8B875');
      brim(-7, -57, 14);
      box(ctx, -7, -50, 14, 2, '#715E46');
      for (const x of [-21, 18]) box(ctx, x, -29, 4, 2, '#D8BE80');
      box(ctx, -5, -13, 3, 6, '#D8BE80');
      box(ctx, 3, -13, 3, 6, '#D8BE80');
      ctx.restore();
    },
  });
  return objects;
}

export function drawUfo(ctx: Ctx, minutes: number, day: number, houses: readonly Place[]) {
  const ufo = ufoAt(minutes, day, houses);
  if (!ufo) return;
  const p = project(ufo.position.x, ufo.position.y);
  const target = houses.find((house) => house.id === ufo.targetId)!;
  const roofHeight = houseBounds(target).top * 1.12;
  const altitude = ufo.altitude + roofHeight;
  const roofY = p.y - roofHeight * 0.7;
  ctx.save();
  ctx.globalAlpha = ufo.opacity;
  if (ufo.beam > 0) {
    const beam = ctx.createLinearGradient(p.x, p.y - altitude, p.x, roofY);
    beam.addColorStop(0, `rgba(191,244,195,${ufo.beam * 0.42})`);
    beam.addColorStop(1, `rgba(191,244,195,${ufo.beam * 0.04})`);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(p.x - 7, p.y - altitude + 7);
    ctx.lineTo(p.x + 7, p.y - altitude + 7);
    ctx.lineTo(p.x + 40, roofY);
    ctx.lineTo(p.x - 40, roofY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(191,244,195,${ufo.beam * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(p.x, roofY, 40, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(p.x, p.y - altitude);
  // Stepped silhouette to match the town's pixel artwork.
  box(ctx, -16, -22, 32, 17, '#639D9C');
  box(ctx, -10, -27, 20, 6, '#A3D6C8');
  box(ctx, -12, -20, 8, 9, '#C5EDDC');
  box(ctx, 1, -17, 8, 10, '#7DAE77');
  box(ctx, 1, -15, 2, 3, '#294D46');
  box(ctx, 7, -15, 2, 3, '#294D46');
  box(ctx, -29, -7, 58, 6, '#CFD8BF');
  box(ctx, -39, -1, 78, 7, '#93AEA2');
  box(ctx, -30, 6, 60, 6, '#506F70');
  box(ctx, -18, 12, 36, 3, '#36585E');
  for (let i = 0; i < 5; i++)
    box(ctx, -27 + i * 13, 5, 5, 3, Math.floor(ufo.phase / 2) % 5 === i ? '#F3E2A2' : '#ACE6C3');
  ctx.restore();
}
