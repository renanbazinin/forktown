import type { TownDuck } from '../lib/ducks';
import { project } from '../lib/world';

export function drawDuck(ctx: CanvasRenderingContext2D, duck: TownDuck, night: boolean) {
  const point = project(duck.position.x, duck.position.y);
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.globalAlpha *= duck.opacity;
  ctx.scale(duck.adult ? 1 : 0.65, duck.adult ? 1 : 0.65);
  if (duck.swimming) {
    ctx.strokeStyle = night ? '#8BAFB7' : '#E0EEEE';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 1, 13, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#23341B25';
    ctx.beginPath();
    ctx.ellipse(0, 1, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.scale(duck.left ? -1 : 1, 1);
  if (!duck.swimming) {
    const step = Math.round(duck.stride * 2);
    ctx.fillStyle = '#BC7739';
    ctx.fillRect(-5 + step, -2, 4, 3);
    ctx.fillRect(3 - step, -2, 4, 3);
  }
  ctx.translate(0, duck.swimming ? 2 : -Math.round(Math.abs(duck.stride)));
  ctx.fillStyle = duck.adult ? '#D2B17B' : '#F3D66D';
  ctx.fillRect(-10, -10, 18, 8);
  ctx.fillRect(-8, -12, 14, 4);
  ctx.fillRect(-13, -12, 5, 5);
  ctx.fillRect(3, -18, 9, 12);
  ctx.fillRect(5, -20, 6, 3);
  ctx.fillStyle = duck.adult ? '#A17D53' : '#DDB652';
  ctx.fillRect(-6, -9, 9, 4);
  ctx.fillRect(-4, -5, 6, 2);
  ctx.fillStyle = duck.adult ? '#EEE0B8' : '#FFF0AC';
  ctx.fillRect(5, -11, 5, 4);
  ctx.fillStyle = '#DF9446';
  ctx.fillRect(11, -14, 6, 3);
  ctx.fillStyle = '#29392F';
  ctx.fillRect(9, -17, 2, 2);
  ctx.restore();
}
