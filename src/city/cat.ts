import type { TownCat } from '../lib/town-cat';
import { project } from '../lib/world';

export function drawTownCat(
  ctx: CanvasRenderingContext2D,
  cat: TownCat,
  night: boolean,
  followed: boolean,
) {
  const point = project(cat.position.x, cat.position.y);
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.fillStyle = followed ? '#F0DBA575' : '#23341B30';
  ctx.beginPath();
  ctx.ellipse(0, 1, followed ? 16 : 11, followed ? 6 : 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(cat.left ? -0.9 : 0.9, 0.9);
  const fur = night ? '#C2A276' : '#BB8352';
  const dark = night ? '#8C6B4E' : '#855631';
  const step = Math.round(cat.stride * 2);
  ctx.fillStyle = dark;
  ctx.fillRect(-7, -4, 3, 5 - Math.max(0, step));
  ctx.fillRect(4, -4, 3, 5 - Math.max(0, -step));
  ctx.fillStyle = fur;
  ctx.fillRect(-9, -11, 17, 8);
  ctx.fillRect(4, -16, 9, 10);
  ctx.fillRect(4, -20, 3, 5);
  ctx.fillRect(10, -19, 3, 4);
  ctx.fillRect(-12, -13, 4, 5);
  ctx.fillRect(-14, -17 + Math.round(cat.stride), 3, 6);
  ctx.fillStyle = dark;
  ctx.fillRect(-6, -11, 2, 5);
  ctx.fillRect(-1, -11, 2, 4);
  ctx.fillStyle = '#FFF0CF';
  ctx.fillRect(8, -9, 5, 3);
  ctx.fillStyle = '#253A30';
  ctx.fillRect(10, -14, 2, 2);
  ctx.fillStyle = '#D17D72';
  ctx.fillRect(13, -10, 2, 2);
  ctx.restore();
}
