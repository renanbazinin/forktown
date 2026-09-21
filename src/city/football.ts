import { GROUND, PITCH, TEAMS, type FootballState, type FootballPlayer } from '../lib/football';
import { project, type Point } from '../lib/world';
import { DEFAULT_RESIDENT } from '../lib/schema';
import { drawResident } from './residents';

type Ctx = CanvasRenderingContext2D;
type Layer = { depth: number; paint: () => void };
function line(ctx: Ctx, points: Point[], color: string, width = 1.2, close = false) {
  ctx.beginPath();
  points.forEach((p, i) => {
    const s = project(p.x, p.y);
    if (i) ctx.lineTo(s.x, s.y);
    else ctx.moveTo(s.x, s.y);
  });
  if (close) ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function groundRect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.beginPath();
  [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ].forEach((p, i) => {
    const s = project(p.x, p.y);
    if (i) ctx.lineTo(s.x, s.y);
    else ctx.moveTo(s.x, s.y);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function player(ctx: Ctx, p: FootballPlayer, time: number) {
  const screen = project(p.x, p.y),
    team = TEAMS[p.team];
  const stride = p.moving ? Math.sin(time * 9 + p.number) : 0;
  const lift = p.celebrate ? Math.abs(Math.sin(time * 7)) * 5 : 0;
  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.fillStyle = '#173B3D35';
  ctx.beginPath();
  ctx.ellipse(0, 1, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(p.dive * 9, -lift);
  ctx.rotate(p.dive * 0.75);
  const skin = ['#D7A875', '#916447', '#E2BE95', '#B78259'][(p.number + p.team) % 4];
  const kit = p.number === 1 ? (p.team === 0 ? '#A487C7' : '#D9736B') : team.color;
  const kick = p.kick ? (p.team === 0 ? 6 : -6) : Math.round(stride * 2);
  box(ctx, -4 - kick, -6, 3, 7, team.light);
  box(ctx, 1 + kick, -6, 3, 7, team.light);
  box(ctx, -5 - kick, 0, 5, 2, '#354840');
  box(ctx, 1 + kick, 0, 5, 2, '#354840');
  box(ctx, -5, -10, 10, 5, '#F4EDCD');
  box(ctx, -5, -20, 10, 11, kit);
  box(ctx, -8, -19, 3, 8, kit);
  box(ctx, 5, -19, 3, 8, kit);
  box(ctx, -8, -12, 3, 3, skin);
  box(ctx, 5, -12, 3, 3, skin);
  if (p.celebrate) {
    box(ctx, -9, -25, 3, 10, skin);
    box(ctx, 6, -25, 3, 10, skin);
  }
  box(ctx, -4, -28, 8, 9, skin);
  box(ctx, -4, -29, 8, 3, p.team ? '#5C4336' : '#342E2B');
  ctx.font = 'bold 7px "Space Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFF3D6';
  ctx.fillText(String(p.number), 0, -12);
  ctx.restore();
}
function goal(ctx: Ctx, x: number, direction: number) {
  const front = [project(x, 24.2), project(x, 25.8)];
  const back = [project(x + direction * 0.45, 24.2), project(x + direction * 0.45, 25.8)];
  ctx.strokeStyle = '#E4EBD38A';
  ctx.lineWidth = 0.8;
  for (let i = 0; i <= 5; i++) {
    const t = i / 5,
      a = {
        x: front[0].x + (front[1].x - front[0].x) * t,
        y: front[0].y + (front[1].y - front[0].y) * t,
      };
    const b = {
      x: back[0].x + (back[1].x - back[0].x) * t,
      y: back[0].y + (back[1].y - back[0].y) * t,
    };
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - 23);
    ctx.lineTo(b.x, b.y - 18);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(back[0].x, back[0].y - i * 3.6);
    ctx.lineTo(back[1].x, back[1].y - i * 3.6);
    ctx.stroke();
  }
  ctx.strokeStyle = '#F5F0D8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(front[0].x, front[0].y);
  ctx.lineTo(front[0].x, front[0].y - 23);
  ctx.lineTo(front[1].x, front[1].y - 23);
  ctx.lineTo(front[1].x, front[1].y);
  ctx.stroke();
}
export function drawFootball(
  ctx: Ctx,
  game: FootballState,
  night: boolean,
  selected: boolean,
): Layer[] {
  const white = night ? '#ACBCAE' : '#E9F0D4';
  groundRect(ctx, GROUND.left, GROUND.top, 11, 7, night ? '#4B6459' : '#C7CFA5');
  const width = PITCH.right - PITCH.left,
    height = PITCH.bottom - PITCH.top;
  for (let i = 0; i < 10; i++)
    groundRect(
      ctx,
      PITCH.left + (i * width) / 10,
      PITCH.top,
      width / 10,
      height,
      night ? (i % 2 ? '#456D59' : '#496F5B') : i % 2 ? '#78A568' : '#80AD70',
    );
  line(
    ctx,
    [
      { x: PITCH.left, y: PITCH.top },
      { x: PITCH.right, y: PITCH.top },
      { x: PITCH.right, y: PITCH.bottom },
      { x: PITCH.left, y: PITCH.bottom },
    ],
    white,
    1.8,
    true,
  );
  line(
    ctx,
    [
      { x: 15.5, y: PITCH.top },
      { x: 15.5, y: PITCH.bottom },
    ],
    white,
  );
  line(
    ctx,
    Array.from({ length: 49 }, (_, i) => ({
      x: 15.5 + Math.cos((i / 48) * Math.PI * 2) * 0.85,
      y: 25 + Math.sin((i / 48) * Math.PI * 2) * 0.85,
    })),
    white,
  );
  for (const [x, d] of [
    [PITCH.left, 1],
    [PITCH.right, -1],
  ]) {
    line(
      ctx,
      [
        { x, y: 23.5 },
        { x: x + d * 1.4, y: 23.5 },
        { x: x + d * 1.4, y: 26.5 },
        { x, y: 26.5 },
      ],
      white,
    );
    line(
      ctx,
      [
        { x, y: 24.2 },
        { x: x + d * 0.5, y: 24.2 },
        { x: x + d * 0.5, y: 25.8 },
        { x, y: 25.8 },
      ],
      white,
    );
  }
  const center = project(15.5, 25);
  box(ctx, center.x - 2, center.y - 1, 4, 2, white);
  if (selected)
    line(
      ctx,
      [
        { x: 10, y: 22 },
        { x: 21, y: 22 },
        { x: 21, y: 29 },
        { x: 10, y: 29 },
      ],
      '#FFF1B3',
      2,
      true,
    );
  const objects: Layer[] = [];
  const add = (x: number, y: number, paint: () => void) => objects.push({ depth: x + y, paint });
  for (const x of [PITCH.left, PITCH.right]) add(x, 25, () => goal(ctx, x, x < 15 ? -1 : 1));
  // Benches sit outside the touchline; town residents enter from the south path.
  for (const x of [11.7, 18.2])
    add(x, 28.3, () => {
      const a = project(x, 28.3),
        b = project(x + 1.25, 28.3);
      ctx.strokeStyle = night ? '#897C62' : '#A37E55';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 6);
      ctx.lineTo(b.x, b.y - 6);
      ctx.stroke();
      box(ctx, a.x - 2, a.y - 6, 3, 9, '#636958');
      box(ctx, b.x - 2, b.y - 6, 3, 9, '#636958');
    });
  if (game.live)
    for (let i = 0; i < 8; i++) {
      const x = i < 4 ? 10.45 + i * 0.64 : 18.65 + (i - 4) * 0.55,
        y = 27.95 + (i % 2) * 0.25;
      add(x, y, () => {
        const p = project(x, y);
        drawResident(
          ctx,
          {
            ...DEFAULT_RESIDENT,
            skin: ['#D9B68B', '#A57855', '#E8CBA4'][i % 3],
            outfit: TEAMS[i % 2].color,
            hair: i % 3 ? '#675A48' : '#CBC6A6',
          },
          p.x,
          p.y,
          1.05,
          {
            moving: false,
            facing: 'ne',
            walkPhase: (game.elapsed / 2 + i / 8) % 1,
            greeting: false,
            pose: game.goal ? 'cheer' : i % 3 === 0 ? 'sip' : undefined,
          },
        );
      });
    }
  // A little refreshment cart and sun umbrella beside the benches.
  add(20.45, 28.45, () => {
    const p = project(20.45, 28.45);
    box(ctx, p.x - 11, p.y - 18, 23, 16, night ? '#8E8665' : '#E4C382');
    box(ctx, p.x - 13, p.y - 20, 27, 4, '#F1E2B6');
    box(ctx, p.x - 8, p.y - 2, 4, 5, '#4B5C4D');
    box(ctx, p.x + 6, p.y - 2, 4, 5, '#4B5C4D');
    box(ctx, p.x, p.y - 46, 2, 28, '#8C8160');
    ctx.fillStyle = night ? '#8F9C78' : '#DF966E';
    ctx.beginPath();
    ctx.moveTo(p.x - 22, p.y - 36);
    ctx.lineTo(p.x + 1, p.y - 49);
    ctx.lineTo(p.x + 23, p.y - 36);
    ctx.closePath();
    ctx.fill();
  });
  for (const p of game.players) add(p.x, p.y, () => player(ctx, p, game.elapsed));
  add(game.ball.x, game.ball.y + 0.05, () => {
    const p = project(game.ball.x, game.ball.y);
    ctx.fillStyle = '#24472F45';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 1, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    box(ctx, p.x - 3, p.y - 6 - game.ball.height, 6, 6, '#F7F2D8');
    box(ctx, p.x - 1, p.y - 5 - game.ball.height, 2, 2, '#3F4D43');
    box(ctx, p.x + 1, p.y - 2 - game.ball.height, 2, 2, '#3F4D43');
  });
  add(15.5, 22.2, () => {
    const p = project(15.5, 22.2);
    box(ctx, p.x - 56, p.y - 40, 3, 40, '#647C65');
    box(ctx, p.x + 53, p.y - 40, 3, 40, '#647C65');
    box(ctx, p.x - 92, p.y - 93, 184, 60, night ? '#31463F' : '#345B4B');
    box(ctx, p.x - 89, p.y - 90, 178, 54, '#243F35');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#DBDCBA';
    ctx.font = '7px "Space Mono", monospace';
    ctx.fillText('THE MEADOW GROUND', p.x, p.y - 78);
    ctx.fillStyle = TEAMS[0].light;
    ctx.font = '8px "Space Mono", monospace';
    ctx.fillText('MEADOW', p.x - 59, p.y - 60);
    ctx.fillStyle = TEAMS[1].light;
    ctx.fillText('SUNSET', p.x + 59, p.y - 60);
    ctx.fillStyle = game.goal ? '#FBE2A0' : '#F5EBC8';
    ctx.font = 'bold 18px "Space Mono", monospace';
    ctx.fillText(`${game.score[0]} : ${game.score[1]}`, p.x, p.y - 58);
    ctx.font = '8px "Space Mono", monospace';
    ctx.fillText(
      !game.live
        ? 'SEE YOU AT SUNRISE'
        : game.goal
          ? 'GOOOAL!'
          : game.phase === 'halftime'
            ? 'HALF-TIME'
            : game.phase === 'fulltime'
              ? 'FULL-TIME'
              : `${game.clock}  ·  HALF ${game.half}`,
      p.x,
      p.y - 42,
    );
  });
  // Corner pennants, kept short enough to leave a clear view of the game.
  for (const x of [PITCH.left, PITCH.right])
    for (const y of [PITCH.top, PITCH.bottom])
      add(x, y, () => {
        const p = project(x, y);
        box(ctx, p.x, p.y - 17, 1, 17, white);
        box(ctx, p.x + 1, p.y - 17, 7, 5, '#EDBA68');
      });
  return objects;
}
