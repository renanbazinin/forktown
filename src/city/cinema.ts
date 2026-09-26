import { cinemaAt, CINEMA_GROUND, CINEMA_SEATS } from '../lib/cinema';
import { project } from '../lib/world';
import { drawCinemaAd, drawCinemaCard, drawCinemaFilm, loadReel } from './cinema-films';

type Ctx = CanvasRenderingContext2D;
export const SCREEN_ORIGIN = project(22.3, 14.7);
export const SCREEN_SCALE = 0.76;
function polygon(ctx: Ctx, points: { x: number; y: number }[], color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach((point, index) =>
    index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
  );
  ctx.closePath();
  ctx.fill();
}
export function cinemaScreenHit(point: { x: number; y: number }, reveal = 1) {
  const u = (point.x - SCREEN_ORIGIN.x) / SCREEN_SCALE;
  const v = (point.y - (SCREEN_ORIGIN.y - 150) - u * SCREEN_SCALE * 0.5) / SCREEN_SCALE;
  return u >= -7 && u <= 327 && v >= 187 - 194 * reveal && v <= 194;
}
export function drawCinema(
  ctx: Ctx,
  minutes: number,
  day: number,
  night: boolean,
  selected = false,
) {
  const { left, right, top, bottom } = CINEMA_GROUND;
  polygon(
    ctx,
    [project(left, top), project(right, top), project(right, bottom), project(left, bottom)],
    night ? '#415F5B' : '#ACC394',
  );
  if (selected) {
    ctx.save();
    ctx.strokeStyle = '#E6D398';
    ctx.lineWidth = 2;
    ctx.beginPath();
    [
      project(left, top),
      project(right, top),
      project(right, bottom),
      project(left, bottom),
    ].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  // Individual picnic rugs sit underneath the audience, leaving a clear side aisle.
  for (const [index, seat] of CINEMA_SEATS.entries()) {
    const p = project(seat.x, seat.y);
    polygon(
      ctx,
      [
        { x: p.x, y: p.y - 9 },
        { x: p.x + 18, y: p.y },
        { x: p.x, y: p.y + 9 },
        { x: p.x - 18, y: p.y },
      ],
      ['#967D78', '#7D8D89', '#AA996E'][index % 3],
    );
    ctx.fillStyle = '#E0CEAB';
    ctx.fillRect(p.x + 8, p.y - 2, 4, 5);
  }
  const state = cinemaAt(minutes, day);
  // Fetch the reel's pictures while the screen rises, half an hour before the first film.
  if (state.screenReveal > 0) void loadReel();
  if (state.live) {
    polygon(
      ctx,
      [project(22.5, 15), project(28.5, 15), project(27.5, 20), project(24, 20)],
      '#ECE4BD0A',
    );
  }
  const objects: { depth: number; paint: () => void }[] = [];
  objects.push({
    depth: 25.5 + 14.7,
    paint: () => {
      ctx.save();
      // Projected screen plane: horizontal runs along the town's x axis, vertical stays upright.
      for (const x of [22.3, 28.7]) {
        const p = project(x, 14.7);
        ctx.fillStyle = '#5A625A';
        ctx.fillRect(p.x - 3, p.y - 157, 6, 157);
        ctx.fillStyle = '#BCAD84';
        ctx.fillRect(p.x - 7, p.y - 4, 14, 4);
      }
      ctx.transform(
        SCREEN_SCALE,
        SCREEN_SCALE * 0.5,
        0,
        SCREEN_SCALE,
        SCREEN_ORIGIN.x,
        SCREEN_ORIGIN.y - 150,
      );
      const top = 187 - 194 * state.screenReveal;
      if (state.screenReveal > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-7, top, 334, 187 - top);
        ctx.clip();
        ctx.fillStyle = '#283B3B';
        ctx.fillRect(-7, -7, 334, 194);
        ctx.fillStyle = '#C7BA93';
        ctx.fillRect(-3, -3, 326, 186);
        if (state.slot?.film) drawCinemaFilm(ctx, state.slot.film, state.elapsed);
        else if (state.slot?.ad) drawCinemaAd(ctx, state.slot.ad, state.elapsed);
        else drawCinemaCard(ctx, state.slot, state.live ? state.elapsed : 0);
        ctx.restore();
        // The lifting bar follows the cloth; artwork is revealed without stretching.
        ctx.fillStyle = '#D9CBA4';
        ctx.fillRect(-7, top, 334, 4);
      }
      ctx.fillStyle = '#283B3B';
      ctx.fillRect(-10, 187, 340, 8);
      ctx.fillStyle = '#9B9D83';
      ctx.fillRect(-10, 187, 340, 2);
      ctx.fillStyle = '#C7BA93';
      ctx.fillRect(-13, 185, 5, 12);
      ctx.fillRect(328, 185, 5, 12);
      ctx.restore();
    },
  });
  for (const x of [22.15, 28.8]) {
    const a = project(x, 15.5),
      b = project(x, 20.6);
    objects.push({
      depth: x + 19,
      paint: () => {
        ctx.strokeStyle = '#667463';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x, a.y - 50);
        ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 35, b.x, b.y - 50);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        for (let i = 0; i <= 6; i++) {
          const p = i / 6;
          const xx = a.x + (b.x - a.x) * p,
            yy = a.y + (b.y - a.y) * p - 50 + Math.sin(p * Math.PI) * 7;
          if (night) {
            ctx.fillStyle = '#F3CF8020';
            ctx.beginPath();
            ctx.arc(xx, yy, 7, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = night ? '#F4D99B' : '#DBCCA3';
          ctx.fillRect(xx - 2, yy, 4, 5);
        }
      },
    });
  }
  const booth = project(28.1, 20.3);
  objects.push({
    depth: 48.4,
    paint: () => {
      ctx.fillStyle = '#A78065';
      ctx.fillRect(booth.x - 17, booth.y - 27, 34, 27);
      ctx.fillStyle = '#E9D7AB';
      ctx.fillRect(booth.x - 19, booth.y - 32, 38, 7);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#DBA879' : '#A75E59';
        ctx.fillRect(booth.x - 20 + i * 10, booth.y - 43, 10, 12);
      }
      ctx.fillStyle = '#FAE6B0';
      for (let i = 0; i < 3; i++) ctx.fillRect(booth.x - 10 + i * 8, booth.y - 37, 5, 6);
      ctx.font = 'bold 6px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFF0CA';
      ctx.fillText('POPCORN', booth.x, booth.y - 12);
    },
  });
  const projector = project(25.5, 20.5);
  objects.push({
    depth: 46,
    paint: () => {
      ctx.fillStyle = '#425657';
      ctx.fillRect(projector.x - 9, projector.y - 21, 18, 12);
      ctx.fillRect(projector.x - 5, projector.y - 9, 3, 10);
      ctx.fillRect(projector.x + 4, projector.y - 9, 3, 10);
      ctx.fillStyle = state.live ? '#F8EBC5' : '#A8B8A1';
      ctx.fillRect(projector.x - 4, projector.y - 25, 8, 5);
      if (state.live)
        polygon(
          ctx,
          [
            { x: projector.x, y: projector.y - 23 },
            { x: SCREEN_ORIGIN.x + 40, y: SCREEN_ORIGIN.y - 85 },
            { x: SCREEN_ORIGIN.x + 190, y: SCREEN_ORIGIN.y - 10 },
          ],
          '#F8EBC50A',
        );
    },
  });
  return objects;
}
