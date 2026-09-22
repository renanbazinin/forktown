import { FARM_GROUND as G, scarecrowAt, ufoAt } from '../lib/farm';
import type { Place } from '../lib/schema';
import { houseBounds } from './houses';
import { project, hash, type Point } from '../lib/world';

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

export function drawFarmGround(ctx: Ctx, night: boolean) {
  ground(ctx, G.left, G.top, G.right - G.left, G.bottom - G.top, night ? '#65705A' : '#B8B584');
  // Two long footpaths leave the scarecrow room to travel between plots.
  for (const y of [75.5, 79.5])
    ground(ctx, G.left + 0.3, y - 0.35, G.right - G.left - 0.6, 0.7, night ? '#8B8870' : '#D6C69B');
  for (let bed = 0; bed < 6; bed++) {
    const left = G.left + 0.6 + bed * 3.7;
    for (const top of [G.top + 0.35, G.top + 2.1, G.top + 3.9, G.top + 5.9]) {
      const h = top > G.bottom - 1.5 ? 0.7 : 1.05;
      ground(ctx, left, top, 3.1, h, night ? '#584E43' : '#98734D');
      for (let row = 0; row < 2; row++) {
        ground(
          ctx,
          left + 0.12,
          top + row * 0.36 + 0.13,
          2.86,
          0.08,
          night ? '#786247' : '#BB925D',
        );
        for (let plant = 0; plant < 8; plant++) {
          const p = project(left + 0.24 + plant * 0.36, top + row * 0.36 + 0.2);
          const seed = hash(`crop:${bed}:${top}:${row}:${plant}`);
          if (bed % 3 === 0) {
            const height = 7 + (seed % 5);
            box(ctx, p.x, p.y - height, 1.5, height, night ? '#A09159' : '#CAAB54');
            box(ctx, p.x - 2, p.y - height, 5, 4, night ? '#C5B276' : '#F3D682');
            box(ctx, p.x - 3, p.y - 5, 3, 2, night ? '#8F945F' : '#B0AC65');
          } else if (bed % 3 === 1) {
            box(ctx, p.x - 4, p.y - 4, 8, 5, night ? '#526E54' : '#6F964E');
            box(ctx, p.x - 2, p.y - 7, 5, 4, night ? '#7E9567' : '#9FBA6B');
            if (seed % 3 === 0) box(ctx, p.x, p.y - 2, 2, 3, '#C78858');
          } else {
            box(ctx, p.x - 4, p.y - 3, 9, 3, night ? '#4C6B52' : '#729454');
            if (seed % 2 === 0) {
              box(ctx, p.x - 3, p.y - 6, 7, 6, night ? '#B17D4D' : '#E2A15A');
              box(ctx, p.x, p.y - 5, 1, 5, night ? '#D29C62' : '#F4BD6D');
              box(ctx, p.x, p.y - 8, 2, 2, '#648151');
            }
          }
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
      box(ctx, -7, -56, 14, 8, night ? '#AE9661' : '#D8B875');
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
