import { drawHouse, houseBounds } from './houses';
import { drawResident } from './residents';
import type { ResidentState } from '../lib/simulation';
export { drawHouse as drawBuilding } from './houses';
import type { Place } from '../lib/schema';
import {
  PLOTS,
  WORLD_SIZE,
  ROAD_MAX,
  BLOCK_SIZE,
  hash,
  isRoad,
  plotCenter,
  project,
  type Point,
} from '../lib/world';

type Ctx = CanvasRenderingContext2D;
type Palette = {
  grass: string;
  grassAlt: string;
  earth: string;
  edge: string;
  road: string;
  roadEdge: string;
  water: string;
  waterLight: string;
  leaf: string;
  leafLight: string;
  ink: string;
};
export type Camera = { x: number; y: number; zoom: number };
export const DAY: Palette = {
  grass: '#B9CF9B',
  grassAlt: '#B4CA94',
  earth: '#A99C70',
  edge: '#879B68',
  road: '#E4D9B9',
  roadEdge: '#C3BD95',
  water: '#A1C9C9',
  waterLight: '#C1DCDC',
  leaf: '#688F59',
  leafLight: '#87A66A',
  ink: '#4C6445',
};
export const NIGHT: Palette = {
  grass: '#526E63',
  grassAlt: '#4D685E',
  earth: '#3B514B',
  edge: '#344C43',
  road: '#829080',
  roadEdge: '#596F63',
  water: '#466E7B',
  waterLight: '#668F9B',
  leaf: '#365A4F',
  leafLight: '#507569',
  ink: '#C3D4C2',
};

function poly(ctx: Ctx, points: number[][], fill: string, stroke?: string) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}
export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  // Keep the result in hex: night colors receive another shading pass on roof faces.
  return (
    '#' +
    [n >> 16, (n >> 8) & 255, n & 255]
      .map((v) =>
        Math.max(0, Math.min(255, v + amount))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function diamond(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  poly(
    ctx,
    [
      [x, y - ry],
      [x + rx, y],
      [x, y + ry],
      [x - rx, y],
    ],
    fill,
  );
}
function tree(ctx: Ctx, x: number, y: number, s: number, p: Palette, variant = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  diamond(ctx, 4, 3, 16, 7, '#23341B20');
  rect(ctx, -2, -12, 4, 15, '#867459');
  if (variant % 2) {
    poly(
      ctx,
      [
        [0, -43],
        [10, -28],
        [6, -28],
        [15, -15],
        [10, -15],
        [18, -4],
        [-18, -4],
        [-10, -15],
        [-15, -15],
        [-6, -28],
        [-10, -28],
      ],
      p.leaf,
    );
    poly(
      ctx,
      [
        [0, -43],
        [0, -4],
        [-18, -4],
        [-10, -15],
        [-15, -15],
        [-6, -28],
        [-10, -28],
      ],
      p.leafLight,
    );
  } else {
    poly(
      ctx,
      [
        [-5, -39],
        [7, -39],
        [7, -35],
        [14, -35],
        [14, -29],
        [19, -29],
        [19, -16],
        [14, -16],
        [14, -10],
        [-12, -10],
        [-12, -14],
        [-18, -14],
        [-18, -29],
        [-13, -29],
        [-13, -35],
        [-5, -35],
      ],
      p.leaf,
    );
    poly(
      ctx,
      [
        [-5, -39],
        [7, -39],
        [7, -35],
        [4, -35],
        [4, -28],
        [-3, -28],
        [-3, -19],
        [-13, -19],
        [-13, -24],
        [-18, -24],
        [-18, -29],
        [-13, -29],
        [-13, -35],
        [-5, -35],
      ],
      p.leafLight,
    );
    rect(ctx, -7, -31, 5, 4, shade(p.leafLight, 14));
  }
  ctx.restore();
}
type RenderOptions = {
  ctx: Ctx;
  width: number;
  height: number;
  camera: Camera;
  places: Place[];
  selectedPlot: string | null;
  hoveredPlot: string | null;
  night: boolean;
  showPlots: boolean;
  residents?: ResidentState[];
  minutes?: number;
  followed?: string | null;
};
export function renderCity({
  ctx,
  width,
  height,
  camera,
  places,
  selectedPlot,
  hoveredPlot,
  night,
  showPlots,
  residents = [],
  minutes = 0,
  followed,
}: RenderOptions) {
  ctx.clearRect(0, 0, width, height);
  const p = night ? NIGHT : DAY;
  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);
  const byPlot = new Map(places.map((place) => [place.plot, place]));
  const terrainPoint = (x: number, y: number) => project(x, y);
  const b = terrainPoint(WORLD_SIZE, 0),
    c = terrainPoint(WORLD_SIZE, WORLD_SIZE),
    d = terrainPoint(0, WORLD_SIZE);
  poly(
    ctx,
    [
      [d.x, d.y],
      [c.x, c.y],
      [c.x, c.y + 16],
      [d.x, d.y + 16],
    ],
    p.earth,
  );
  poly(
    ctx,
    [
      [b.x, b.y],
      [c.x, c.y],
      [c.x, c.y + 16],
      [b.x, b.y + 16],
    ],
    p.edge,
  );
  diamond(ctx, 0, c.y / 2, WORLD_SIZE * 38, WORLD_SIZE * 19, p.grass);
  for (let x = 0; x < WORLD_SIZE; x++)
    for (let y = 0; y < WORLD_SIZE; y++) {
      const pt = project(x + 0.5, y + 0.5);
      const seed = hash(`${x},${y}`);
      if (seed % 4 === 0) diamond(ctx, pt.x, pt.y, 38, 19, p.grassAlt);
      if (x === WORLD_SIZE - 2 || (x === WORLD_SIZE - 1 && y < 8)) {
        diamond(ctx, pt.x, pt.y, 38, 19, p.water);
        rect(ctx, pt.x - 12 + (seed % 16), pt.y, 12, 1, p.waterLight);
        if (y % 3 === 0) rect(ctx, pt.x + 3, pt.y + 6, 7, 1, p.waterLight);
      } else if (isRoad(x, y)) {
        diamond(ctx, pt.x, pt.y, 38, 19, p.roadEdge);
        diamond(ctx, pt.x, pt.y - 1, 36, 18, p.road);
        if (seed % 3 === 0) rect(ctx, pt.x + (seed % 10) - 5, pt.y + 4, 2, 1, p.roadEdge);
      } else if (seed % 2) {
        for (let k = 0; k < 3; k++) {
          const gx = pt.x - 19 + ((seed >> (k * 3)) % 35),
            gy = pt.y - 5 + ((seed >> (k * 2)) % 10);
          rect(ctx, gx, gy, 2, 2, night ? '#638171' : '#A4BE81');
        }
      }
    }
  // Stable plot IDs keep existing contributions in place as the town grows.
  for (const plot of PLOTS) {
    const pt = plotCenter(plot);
    const occupied = byPlot.has(plot.id);
    const active = selectedPlot === plot.id;
    const hover = hoveredPlot === plot.id;
    if (occupied) {
      diamond(ctx, pt.x, pt.y, 105, 52.5, night ? '#577468' : '#BFD5A4');
      // A short footpath connects the front of the lawn to the street.
      for (let step = 0; step < 5; step++) {
        const stone = project(plot.x + 0.5, plot.y + 1.02 + step * 0.25);
        diamond(ctx, stone.x, stone.y, 7, 3.5, night ? '#899483' : '#E3DABF');
      }
    }
    if (active || hover) diamond(ctx, pt.x, pt.y, 108, 54, night ? '#B5C59B40' : '#F4EDCD80');
    if (!occupied) {
      const corners = [
        [pt.x, pt.y - 49],
        [pt.x + 98, pt.y],
        [pt.x, pt.y + 49],
        [pt.x - 98, pt.y],
      ];
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = active || hover ? p.ink : night ? '#ABC6B850' : '#69885A55';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      if (showPlots || hover || active) {
        ctx.fillStyle = p.ink;
        ctx.font = '10px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(plot.id, pt.x, pt.y + 4);
      } else {
        rect(ctx, pt.x - 3, pt.y, 6, 1, night ? '#ABC6B870' : '#69885A70');
        rect(ctx, pt.x, pt.y - 3, 1, 6, night ? '#ABC6B870' : '#69885A70');
      }
    }
  }
  const objects: { depth: number; paint: () => void }[] = [];
  for (let x = 0; x < WORLD_SIZE; x++)
    for (let y = 0; y < WORLD_SIZE; y++) {
      const seed = hash(`tree${x},${y}`);
      const pt = project(x + 0.5, y + 0.5);
      if (
        (x === 0 || y === 0 || y >= WORLD_SIZE - 2 || (x === WORLD_SIZE - 1 && y >= 9)) &&
        seed % 3 !== 0
      ) {
        objects.push({
          depth: x + y,
          paint: () => tree(ctx, pt.x + (seed % 15) - 7, pt.y, 1 + (seed % 5) * 0.12, p, seed),
        });
      }
      if (
        x < ROAD_MAX &&
        y < ROAD_MAX &&
        !isRoad(x, y) &&
        x % BLOCK_SIZE === 0 &&
        y % BLOCK_SIZE === 2 &&
        seed % 2
      ) {
        objects.push({ depth: x + y, paint: () => tree(ctx, pt.x, pt.y, 0.65, p, seed) });
      }
    }
  for (const place of places) {
    const plot = PLOTS.find((v) => v.id === place.plot);
    if (!plot) continue;
    const pt = plotCenter(plot);
    objects.push({
      depth: plot.x + plot.y + 0.8,
      paint: () => drawHouse(ctx, place, pt.x, pt.y, night, 1.12),
    });
  }
  for (const [x, y] of [
    [1 + BLOCK_SIZE, 1 + BLOCK_SIZE * 2],
    [1 + BLOCK_SIZE * 3, 1 + BLOCK_SIZE],
    [1 + BLOCK_SIZE * 4, 1 + BLOCK_SIZE * 3],
    [1 + BLOCK_SIZE * 2, 1 + BLOCK_SIZE * 4],
  ]) {
    const pt = project(x + 0.5, y + 0.5);
    objects.push({
      depth: x + y,
      paint: () => {
        rect(ctx, pt.x, pt.y - 29, 2, 30, night ? '#637266' : '#8B9073');
        rect(ctx, pt.x - 3, pt.y - 33, 8, 6, night ? '#F4D79A' : '#EDE5C1');
        rect(ctx, pt.x - 4, pt.y - 35, 10, 2, night ? '#7A8C7D' : '#748269');
        if (night) {
          const glow = ctx.createRadialGradient(pt.x + 1, pt.y - 30, 0, pt.x + 1, pt.y - 30, 24);
          glow.addColorStop(0, '#FFDA8030');
          glow.addColorStop(1, '#FFDA8000');
          ctx.fillStyle = glow;
          ctx.fillRect(pt.x - 24, pt.y - 55, 50, 50);
        }
      },
    });
  }
  for (const resident of residents) {
    if (resident.activity !== 'stroll') continue;
    const pt = project(resident.position.x, resident.position.y);
    objects.push({
      depth: resident.position.x + resident.position.y,
      paint: () => {
        if (followed === resident.id)
          diamond(ctx, pt.x, pt.y + 2, 10, 5, night ? '#F0DBA575' : '#FFF7D5');
        drawResident(ctx, resident.resident, pt.x, pt.y, 1.25, resident, minutes);
      },
    });
  }
  objects.sort((a, b) => a.depth - b.depth).forEach((object) => object.paint());
  ctx.restore();
}

export function buildingHit(point: Point, places: Place[]): string | undefined {
  // Frontmost buildings win when their silhouettes overlap.
  const ordered = places
    .map((place) => ({ place, plot: PLOTS.find((p) => p.id === place.plot)! }))
    .filter((v) => v.plot)
    .sort((a, b) => b.plot.x + b.plot.y - (a.plot.x + a.plot.y));
  for (const { place, plot } of ordered) {
    const p = plotCenter(plot);
    const tall = houseBounds(place).top * 1.12;
    if (point.x >= p.x - 55 && point.x <= p.x + 55 && point.y >= p.y - tall && point.y <= p.y + 20)
      return plot.id;
  }
}
