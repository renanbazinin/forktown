import { moonSlice, townSkyAt } from '../lib/town-calendar';
import { snowCoverAt, yearDayAt } from '../lib/seasons';
import { hash } from '../lib/world';
import { drawHorizon, goldenHour, mixRgb, rgb } from './horizon';

const stars = Array.from({ length: 44 }, (_, i) => {
  const seed = hash(`town-sky:${i}`);
  return { x: (seed % 997) / 997, y: ((seed >>> 10) % 997) / 997, bright: seed % 3 };
});

// Screen-space sky, drawn before the camera transform and all world geometry.
// It stays distant while panning; terrain naturally hides it in close-up views.
export function drawSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  day: number,
  minutes: number,
) {
  const sky = townSkyAt(day, minutes);
  // Golden hour warms the low sky and the sun; the grass keeps its palette.
  const glow = goldenHour(minutes);
  const stop = (dark: number[], light: number[], warm: number[] = dark, amount = 0) =>
    rgb(mixRgb(mixRgb(dark, light, sky.daylight), warm, amount * glow));
  ctx.save();
  const wash = ctx.createLinearGradient(0, 0, 0, height);
  wash.addColorStop(0, stop([29, 49, 53], [205, 219, 204]));
  wash.addColorStop(0.44, stop([40, 60, 58], [222, 226, 205], [240, 206, 152], 0.6));
  wash.addColorStop(0.65, stop([47, 68, 65], [220, 224, 202], [233, 211, 168], 0.35));
  wash.addColorStop(1, stop([54, 73, 67], [211, 222, 201], [242, 192, 138], 0.55));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);
  for (const star of stars) {
    ctx.globalAlpha = (1 - sky.daylight) * (0.12 + star.bright * 0.065);
    ctx.fillStyle = '#E6EAD3';
    ctx.fillRect(Math.round(star.x * width), Math.round(star.y * height * 0.72), 1.5, 1.5);
  }
  const size = Math.max(0.7, Math.min(1, width / 900));
  for (const [kind, body] of [
    ['sun', sky.sun],
    ['moon', sky.moon],
  ] as const) {
    if (body.opacity <= 0) continue;
    const x = body.x * width;
    const y = body.y * height;
    const radius = (kind === 'sun' ? 23 : 19) * size;
    const light = kind === 'sun' ? rgb(mixRgb([245, 223, 153], [244, 194, 122], glow)) : '#DFE6CF';
    const halo = ctx.createRadialGradient(x, y, radius, x, y, radius * 3.5);
    halo.addColorStop(0, kind === 'sun' ? '#F1D79722' : '#DCE5CD0B');
    halo.addColorStop(1, '#DCE5CD00');
    ctx.globalAlpha = body.opacity * (kind === 'sun' ? 1 : sky.illumination);
    ctx.fillStyle = halo;
    ctx.fillRect(x - radius * 4, y - radius * 4, radius * 8, radius * 8);
    // Two-pixel bands echo the town's small sprites without a harsh outline.
    for (let row = -radius; row < radius; row += 2) {
      const unitY = (row + 1) / radius;
      const edge = Math.sqrt(Math.max(0, 1 - unitY * unitY));
      ctx.globalAlpha = body.opacity * (kind === 'sun' ? 0.72 : 0.07);
      ctx.fillStyle = light;
      ctx.fillRect(Math.round(x - edge * radius), y + row, Math.round(edge * radius * 2), 2);
      if (kind === 'moon') {
        const [left, right] = moonSlice(sky.moonPhase, unitY);
        ctx.globalAlpha = body.opacity * 0.78;
        ctx.fillRect(
          Math.round(x + left * radius),
          y + row,
          Math.round((right - left) * radius),
          2,
        );
      }
    }
  }
  // Stars are already down, so the ridge hides the lowest of them and the setting sun.
  drawHorizon(ctx, width, height, sky.daylight, minutes, snowCoverAt(yearDayAt(day, minutes)));
  ctx.restore();
}
