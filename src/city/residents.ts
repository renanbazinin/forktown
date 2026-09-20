import type { Resident } from '../lib/schema';
import type { ResidentState } from '../lib/simulation';
export function drawResident(
  ctx: CanvasRenderingContext2D,
  resident: Resident,
  x: number,
  y: number,
  scale = 1,
  state?: ResidentState,
  time = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const step = state?.moving ? Math.sin(time * 8) : 0;
  ctx.fillStyle = '#23341B30';
  ctx.beginPath();
  ctx.ellipse(0, 1, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#48524A';
  ctx.fillRect(-3, -3, 2, 4 + step);
  ctx.fillRect(1, -3, 2, 4 - step);
  ctx.fillStyle = resident.outfit;
  ctx.fillRect(-4, -12, 8, 10);
  ctx.fillRect(-6, -10 + step, 2, 6);
  ctx.fillRect(4, -10 - step, 2, 6);
  ctx.fillStyle = resident.skin;
  ctx.fillRect(-4, -19, 8, 8);
  ctx.fillStyle = resident.hair;
  ctx.fillRect(-4, -20, 8, 3);
  ctx.fillRect(-4, -18, 2, 3);
  ctx.fillStyle = '#35453D';
  ctx.fillRect(0, -16, 1, 1);
  ctx.fillRect(3, -16, 1, 1);
  if (resident.accessory === 'hat') {
    ctx.fillStyle = resident.outfit;
    ctx.fillRect(-4, -24, 8, 5);
    ctx.fillRect(-6, -20, 12, 2);
  }
  if (resident.accessory === 'glasses') {
    ctx.strokeStyle = '#394B46';
    ctx.lineWidth = 1;
    ctx.strokeRect(-1, -17, 3, 3);
    ctx.strokeRect(3, -17, 3, 3);
  }
  if (state?.greeting) {
    ctx.font = '10px "Space Mono", monospace';
    const width = ctx.measureText(resident.greeting).width + 12;
    ctx.fillStyle = '#FCFAEF';
    ctx.fillRect(-width / 2, -43, width, 16);
    ctx.fillStyle = '#4D664E';
    ctx.textAlign = 'center';
    ctx.fillText(resident.greeting, 0, -32);
  }
  ctx.restore();
}
