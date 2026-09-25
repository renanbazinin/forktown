import type { CinemaFilm, CinemaSlot, ClassicArtwork, ReelArtwork } from '../lib/cinema';
import { titles } from '../films/kit';
import type { FilmModule } from '../films/types';

type Ctx = CanvasRenderingContext2D;
const W = 320,
  H = 180;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => {
  const p = clamp(value);
  return p * p * (3 - 2 * p);
};
function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function words(ctx: Ctx, text: string, y: number, size = 10, color = '#FFF2D0') {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px "Space Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, y);
}
function star(ctx: Ctx, x: number, y: number, color = '#FFE4A0', size = 2) {
  box(ctx, x - size, y, size * 2 + 1, 1, color);
  box(ctx, x, y - size, 1, size * 2 + 1, color);
}
function nightSky(ctx: Ctx, seconds: number) {
  box(ctx, 0, 0, W, H, '#202D48');
  for (let i = 0; i < 28; i++)
    star(
      ctx,
      (i * 73 + 17) % W,
      (i * 31 + 9) % 100,
      i % 3 ? '#8B9AAE' : '#FFE5AC',
      1 + Math.round((Math.sin(seconds * 0.4 + i) + 1) / 2),
    );
}
function heart(ctx: Ctx, x: number, y: number, color = '#ED9B9E') {
  box(ctx, x - 4, y - 2, 3, 2, color);
  box(ctx, x + 1, y - 2, 3, 2, color);
  box(ctx, x - 5, y, 10, 3, color);
  box(ctx, x - 3, y + 3, 6, 2, color);
  box(ctx, x - 1, y + 5, 2, 2, color);
}
function kernel(ctx: Ctx, x: number, y: number, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  box(ctx, -6, -7, 12, 10, '#FFF0BE');
  box(ctx, -3, -11, 7, 7, '#FFF5D7');
  box(ctx, -9, -5, 5, 7, '#FFF5D7');
  box(ctx, 4, -6, 5, 7, '#E6C58F');
  box(ctx, -3, 1, 7, 4, '#D4A963');
  box(ctx, -3, -4, 2, 2, '#4C4B41');
  box(ctx, 3, -4, 2, 2, '#4C4B41');
  ctx.restore();
}
function popcorn(ctx: Ctx, p: number, seconds: number) {
  box(ctx, 0, 0, W, H, '#674856');
  box(ctx, 22, 16, 276, 111, '#BC7773');
  for (let x = 0; x < W; x += 18) box(ctx, x, 0, 9, 28 + (x % 3) * 4, '#823C50');
  box(ctx, 0, 133, W, 47, '#493D4D');
  box(ctx, 0, 126, W, 7, '#E1B285');
  box(ctx, 31, 91, 45, 35, '#8DA4A0');
  box(ctx, 27, 92, 53, 5, '#D3DDD0');
  box(ctx, 39, 119, 28, 6, '#556F71');
  const rumble = p < 0.25 ? Math.sin(seconds * 10) * p * 5 : 0;
  const lidLift = Math.sin(clamp(p / 0.32) * Math.PI) * 32;
  box(ctx, 29 + rumble, 87 - lidLift, 49, 5, '#D4DED0');
  box(ctx, 47 + rumble, 82 - lidLift, 13, 5, '#637E7C');
  // The runaway's arc ends back inside the bucket, rather than resetting mid-story.
  const escape = ease((p - 0.18) / 0.52);
  const x = 55 + escape * 197;
  const bounce =
    p < 0.2 ? 0 : Math.abs(Math.sin((p - 0.2) * Math.PI * 8)) * (1 - ease((p - 0.72) / 0.15)) * 32;
  const y = p < 0.2 ? 106 - ease(p / 0.2) * 40 : 119 - bounce - ease((p - 0.68) / 0.2) * 32;
  for (let i = 0; i < 5; i++) kernel(ctx, 238 + (i % 3) * 11, 101 - Math.floor(i / 3) * 9, 0.7);
  box(ctx, 230, 101, 45, 25, '#FFF0D0');
  for (let i = 0; i < 4; i++) box(ctx, 232 + i * 12, 103, 5, 21, '#D46466');
  box(ctx, 229, 99, 48, 4, '#F7D699');
  kernel(ctx, x, y, 1.1);
  if (p > 0.87) {
    heart(ctx, 252, 67 - Math.sin(seconds) * 2);
    words(ctx, 'EVERY POP BELONGS.', 162, 10);
  } else
    words(ctx, p < 0.24 ? 'A very small beginning...' : '...and a very big adventure.', 162, 9);
}
function cat(ctx: Ctx, x: number, y: number, curled = false) {
  ctx.save();
  ctx.translate(x, y);
  box(ctx, -15, -15, 26, 13, '#D4A573');
  box(ctx, -10, -18, 19, 5, '#D4A573');
  box(ctx, 5, -27, 15, 15, '#D4A573');
  box(ctx, 5, -32, 4, 7, '#D4A573');
  box(ctx, 16, -32, 4, 7, '#D4A573');
  box(ctx, -20, -22, 6, 15, '#B38059');
  box(ctx, -24, -24, 10, 5, '#B38059');
  box(ctx, -7, -15, 3, 9, '#A77852');
  box(ctx, 0, -15, 3, 9, '#A77852');
  box(ctx, 9, -22, 2, curled ? 1 : 3, '#35434A');
  box(ctx, 16, -22, 2, curled ? 1 : 3, '#35434A');
  box(ctx, 14, -17, 3, 2, '#F2D2B0');
  if (!curled) {
    box(ctx, -11, -3, 5, 4, '#B38059');
    box(ctx, 5, -3, 5, 4, '#B38059');
  }
  ctx.restore();
}
function moon(ctx: Ctx, p: number, seconds: number) {
  nightSky(ctx, seconds);
  for (let i = 0; i < 6; i++) {
    const top = 115 + (i % 3) * 9;
    box(ctx, i * 60 - 9, top, 54, H - top, '#394760');
    box(ctx, i * 60 - 13, top - 6, 62, 7, '#657186');
    box(ctx, i * 60 + 10, top + 12, 7, 9, '#E7C47D');
  }
  const adventure = Math.sin(clamp((p - 0.15) / 0.7) * Math.PI);
  const moonX = 248 - adventure * 65,
    moonY = 40 + adventure * 20;
  oval(ctx, moonX, moonY, 23, 23, '#FFE5A0');
  oval(ctx, moonX - 9, moonY - 7, 21, 21, '#202D48');
  for (let i = 0; i < 3; i++) {
    const x = 106 + i * 39,
      y = 110 - i * 23;
    box(ctx, x, y + Math.sin(seconds + i) * 2, 30, 6, '#78899F');
    box(ctx, x + 6, y - 3 + Math.sin(seconds + i) * 2, 17, 5, '#B3BCC4');
  }
  const jump = Math.sin(clamp((p - 0.16) / 0.65) * Math.PI);
  cat(ctx, 72 + jump * 117, 113 - jump * 46, p > 0.86);
  if (p > 0.56 && p < 0.87)
    for (let i = 0; i < 8; i++) {
      const fall = clamp((p - 0.56) / 0.31);
      star(ctx, moonX - 12 + i * 8 - fall * 30, moonY + 22 + fall * (30 + i * 4), '#FFE8AC', 2);
    }
  words(
    ctx,
    p < 0.2
      ? 'Some friends are a little farther away.'
      : p > 0.86
        ? 'GOODNIGHT, LITTLE MOON.'
        : 'Almost... almost...',
    166,
    p < 0.2 ? 8 : 10,
  );
  if (p > 0.86) heart(ctx, 100, 66);
}
function filmDuck(ctx: Ctx, x: number, y: number, size: number, seconds: number, surprise = false) {
  ctx.save();
  ctx.translate(x, y - Math.abs(Math.sin(seconds * 5)) * 2);
  ctx.scale(size, size);
  box(ctx, -12, -13, 23, 11, '#F4D078');
  box(ctx, 7, -24, 12, 17, '#F4D078');
  box(ctx, 17, -17, 8, 4, '#DE9350');
  box(ctx, 14, -21, 2, 2, '#374D46');
  box(ctx, -7, -10, 12, 5, '#D8AD59');
  box(ctx, -9, -1, 6, 3, '#C18848');
  box(ctx, 5, -1, 6, 3, '#C18848');
  if (surprise) {
    box(ctx, 6, -39, 3, 7, '#927157');
    box(ctx, 6, -29, 3, 2, '#927157');
  }
  ctx.restore();
}
function duckling(ctx: Ctx, p: number, seconds: number) {
  box(ctx, 0, 0, W, H, '#C8DCC3');
  box(ctx, 0, 89, W, 91, '#95B4A1');
  box(ctx, 0, 117, W, 26, '#E4D8AC');
  box(ctx, 0, 148, W, 32, '#71A5AA');
  for (let i = 0; i < 12; i++)
    box(ctx, (i * 43 + seconds * 2) % W, 154 + (i % 3) * 7, 13, 1, '#B5D6CC');
  for (let i = 0; i < 6; i++) {
    const x = i * 63 + 7;
    box(ctx, x, 91, 2, 24, '#5C826A');
    box(ctx, x - 4, 89, 10, 4, '#DBA18D');
  }
  const family = 140 + ease(p / 0.72) * 120;
  filmDuck(ctx, family, 128, 1.05, seconds);
  for (let i = 1; i <= 3; i++) filmDuck(ctx, family - i * 25, 130, 0.6, seconds - i * 0.2);
  const lag =
    p < 0.2 ? 0 : p < 0.58 ? ease((p - 0.2) / 0.38) * 57 : (1 - ease((p - 0.58) / 0.32)) * 57;
  const x = family - 100 - lag;
  filmDuck(
    ctx,
    x,
    131 - (p > 0.58 && p < 0.68 ? Math.sin(((p - 0.58) / 0.1) * Math.PI) * 10 : 0),
    0.6,
    p > 0.58 ? seconds * 1.7 : p > 0.2 ? 0 : seconds,
    p > 0.55 && p < 0.7,
  );
  if (p < 0.7) {
    const bx = x + 17 + Math.sin(seconds * 1.3) * 12,
      by = 88 + Math.sin(seconds) * 8;
    const flap = 3 + Math.abs(Math.sin(seconds * 8)) * 4;
    box(ctx, bx - flap, by - 4, flap, 7, '#C28CB5');
    box(ctx, bx + 2, by - 4, flap, 7, '#E6ABBC');
    box(ctx, bx, by - 3, 2, 8, '#6D607A');
  }
  if (p > 0.9) heart(ctx, x, 93);
  words(
    ctx,
    p < 0.25
      ? 'Ooh. A butterfly!'
      : p < 0.58
        ? 'Just one more look...'
        : p < 0.9
          ? 'WAIT FOR ME!'
          : 'TOGETHER IS BETTER.',
    28,
    11,
    '#365C57',
  );
}

function racer(ctx: Ctx, x: number, y: number, color: string, number: number) {
  oval(ctx, x, y + 7, 17, 4, '#302D3C');
  box(ctx, x - 12, y + 1, 7, 8, '#34333E');
  box(ctx, x + 7, y + 1, 7, 8, '#34333E');
  oval(ctx, x, y, 19, 7, color);
  box(ctx, x - 15, y - 2, 30, 3, '#FFE5AA');
  oval(ctx, x - 2, y - 9, 7, 8, '#43584D');
  box(ctx, x + 2, y - 15, 7, 7, '#789773');
  box(ctx, x + 7, y - 14, 2, 2, '#FFF1C9');
  box(ctx, x + 3, y - 20, 1, 5, '#43584D');
  box(ctx, x + 8, y - 19, 1, 4, '#43584D');
  ctx.fillStyle = '#302D3C';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(number), x, y + 3);
}
function race(ctx: Ctx, p: number, seconds: number) {
  box(ctx, 0, 0, W, H, '#D8BC92');
  box(ctx, 0, 0, W, 59, '#70958F');
  for (let i = 0; i < 8; i++) {
    box(ctx, i * 45, 0, 1, 59, '#A2B5A0');
    box(ctx, 0, 24 + (i % 2) * 22, W, 1, '#A2B5A0');
  }
  // Oversized kitchen props establish the racers' miniature scale.
  box(ctx, 21, 13, 40, 42, '#E7D9B9');
  box(ctx, 17, 10, 48, 7, '#B76D62');
  box(ctx, 29, 25, 24, 17, '#91AAA0');
  oval(ctx, 250, 36, 28, 17, '#B27860');
  oval(ctx, 250, 32, 28, 17, '#EBD0A0');
  for (let i = 0; i < 6; i++)
    box(ctx, 235 + (i % 3) * 12, 22 + Math.floor(i / 3) * 13, 4, 4, '#946952');
  box(ctx, 0, 60, W, 7, '#A78569');
  const progress = ease((p - 0.16) / 0.7);
  for (let lane = 0; lane < 3; lane++) {
    box(ctx, 0, 94 + lane * 27, W, 1, '#BA986F');
    for (let i = 0; i < 9; i++) {
      const x = ((((i * 43 - progress * 300) % 360) + 360) % 360) - 20;
      box(ctx, x, 91 + lane * 27, 12, 2, '#EEDDAD');
    }
  }
  for (let row = 0; row < 12; row++)
    for (let col = 0; col < 2; col++)
      box(ctx, 281 + col * 5, 67 + row * 7, 5, 7, (row + col) % 2 ? '#F9EAC5' : '#494251');
  const sprint = ease((p - 0.2) / 0.67);
  const sweep = ease((p - 0.57) / 0.23);
  const finish = ease((p - 0.84) / 0.1);
  const slow = 37 + sprint * 78 + sweep * 182;
  const xs = [37 + sprint * 255, 37 + sprint * 248, slow];
  if (p > 0.57 && p < 0.94) {
    const mx = slow - 17;
    box(ctx, mx - 7, 26, 5, 95, '#AF7457');
    box(ctx, mx - 20, 116, 28, 9, '#A5B6AB');
    for (let i = 0; i < 7; i++)
      box(ctx, mx - 23 + i * 5, 125, 4, 21 + Math.sin(seconds * 9 + i) * 3, '#ECE1C1');
  }
  xs.forEach((x, i) =>
    racer(ctx, x - finish * 21, 85 + i * 27, ['#C75E60', '#6593AC', '#D3AE4C'][i], i + 1),
  );
  if (p < 0.18) {
    const lit = Math.min(2, Math.floor(p / 0.06));
    box(ctx, 126, 18, 68, 24, '#414B4A');
    for (let i = 0; i < 3; i++) oval(ctx, 139 + i * 21, 30, 6, 6, i <= lit ? '#EFBA70' : '#62706A');
  }
  if (p > 0.88) {
    star(ctx, 278, 111, '#FFF0A6', 5);
    words(ctx, '1ST: NUMBER 3!', 30, 12);
  }
  words(
    ctx,
    p < 0.18
      ? 'READY... SET...'
      : p < 0.57
        ? 'THE KITCHEN GRAND PRIX'
        : p < 0.88
          ? 'HERE COMES THE CLEANUP CREW!'
          : 'A CLEAN SWEEP.',
    168,
    9,
    '#4C4548',
  );
}

function duelist(
  ctx: Ctx,
  x: number,
  y: number,
  facing: number,
  color: string,
  angle: number,
  crouch: number,
  bow: number,
  feather = true,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  box(ctx, -10, -13, 6, 13, '#354255');
  box(ctx, 5, -13, 6, 13, '#354255');
  box(ctx, -13, -3, 10, 4, '#263447');
  box(ctx, 5, -3, 11, 4, '#263447');
  ctx.translate(0, crouch);
  ctx.rotate(bow);
  box(ctx, -12, -35, 19, 22, color);
  box(ctx, -12, -17, 20, 4, '#E2B97C');
  box(ctx, -7, -49, 16, 14, '#E7BC91');
  box(ctx, 5, -44, 2, 2, '#354255');
  box(ctx, -12, -53, 26, 6, '#354255');
  box(ctx, -7, -61, 17, 10, color);
  if (feather) {
    box(ctx, -6, -67, 4, 9, '#F1DDAD');
    box(ctx, -10, -69, 6, 4, '#F1DDAD');
  }
  box(ctx, 4, -32, 13, 6, color);
  box(ctx, 14, -32, 5, 6, '#E7BC91');
  ctx.translate(17, -29);
  ctx.rotate(angle);
  box(ctx, -4, -2, 11, 4, '#866447');
  box(ctx, 5, -8, 3, 16, '#D9B375');
  box(ctx, 8, -2, 39, 4, '#C9DCE0');
  box(ctx, 11, -2, 35, 1, '#FFFFFF');
  ctx.restore();
}
function duel(ctx: Ctx, p: number, seconds: number) {
  box(ctx, 0, 0, W, H, '#67546C');
  box(ctx, 0, 68, W, 66, '#927A82');
  oval(ctx, 252, 45, 22, 22, '#E5B48B');
  for (let i = 0; i < 5; i++) {
    const x = i * 77 - 8;
    box(ctx, x, 63, 40, 67, '#554E67');
    for (let j = 0; j < 3; j++) box(ctx, x + j * 16, 54, 8, 12, '#554E67');
    box(ctx, x + 15, 83, 8, 19, '#E3B87C');
  }
  box(ctx, 0, 131, W, 49, '#555667');
  box(ctx, 0, 131, W, 6, '#B1A09B');
  for (let i = 0; i < 9; i++) {
    box(ctx, i * 40, 138, 1, 17, '#787380');
    box(ctx, i * 40 + 20, 155, 1, 25, '#787380');
  }
  box(ctx, 0, 154, W, 1, '#787380');
  const approach = ease((p - 0.1) / 0.15);
  const fighting = p >= 0.27 && p < 0.72;
  const exchange = clamp((p - 0.27) / 0.45) * 6;
  const beat = exchange % 1;
  const strike = fighting ? Math.sin(beat * Math.PI) : 0;
  const turn = Math.floor(exchange) % 2;
  const retreat = ease((p - 0.78) / 0.1);
  const left = 58 + approach * 48 + (turn === 0 ? 1 : -1) * strike * 7 - retreat * 8;
  const right = 262 - approach * 48 + (turn === 0 ? 1 : -1) * strike * 7 + retreat * 8;
  const salute = (1 - ease(p / 0.1)) * -1.2;
  const bow = Math.sin(clamp((p - 0.86) / 0.14) * Math.PI) * 0.45;
  const leftAngle = fighting ? -1.2 + strike * 0.85 : salute + retreat * 0.7;
  const rightAngle = fighting ? 0.25 - strike * 0.6 : salute + retreat * 0.7;
  duelist(ctx, left, 131, 1, '#739DB0', leftAngle, turn === 1 ? strike * 4 : 0, bow);
  duelist(ctx, right, 131, -1, '#BA7279', rightAngle, turn === 0 ? strike * 4 : 0, bow, p <= 0.72);
  if (fighting && beat > 0.38 && beat < 0.64) {
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + seconds;
      star(ctx, (left + right) / 2 + Math.cos(a) * 9, 90 + Math.sin(a) * 8, '#FFE6A1', (i % 2) + 1);
    }
  }
  if (p > 0.72) {
    const fall = ease((p - 0.72) / 0.15);
    // One loose hat feather ends the duel; both opponents bow.
    box(ctx, 220 - fall * 56 + Math.sin(seconds * 3) * 3, 62 + fall * 63, 9, 3, '#F1DDAD');
  }
  words(
    ctx,
    p < 0.25
      ? 'EN GARDE.'
      : p < 0.72
        ? 'CLASH! PARRY! RIPOSTE!'
        : p < 0.86
          ? 'A VERY CLOSE SHAVE.'
          : 'HONOR AMONG RIVALS.',
    169,
    10,
  );
}

function filmPerson(ctx: Ctx, x: number, y: number, color: string, lifted = false) {
  box(ctx, x - 4, y - 13, 3, 13, '#333E54');
  box(ctx, x + 2, y - 13, 3, 13, '#333E54');
  box(ctx, x - 6, y - 26, 13, 15, color);
  box(ctx, x - 5, y - 37, 11, 11, '#E8BC93');
  box(ctx, x - 5, y - 39, 12, 5, '#514352');
  box(ctx, x - 2, y - 32, 2, 2, '#333E54');
  box(ctx, x + 3, y - 32, 2, 2, '#333E54');
  box(ctx, x - 10, y - (lifted ? 34 : 24), 4, 13, color);
  box(ctx, x + 7, y - (lifted ? 34 : 24), 4, 13, color);
}
function ufo(ctx: Ctx, p: number, seconds: number) {
  nightSky(ctx, seconds);
  for (let i = 0; i < 7; i++) {
    const x = i * 49 - 7,
      top = 73 + (i % 3) * 14;
    box(ctx, x, top, 43, 73, ['#42516A', '#526179', '#38495F'][i % 3]);
    box(ctx, x - 2, top - 5, 47, 5, '#738091');
    for (let j = 0; j < 6; j++)
      box(ctx, x + 8 + (j % 2) * 19, top + 11 + Math.floor(j / 2) * 15, 7, 9, '#D5B57D');
  }
  box(ctx, 0, 145, W, 35, '#354151');
  box(ctx, 0, 145, W, 4, '#9AA097');
  for (let i = 0; i < 9; i++) box(ctx, i * 43, 157, 22, 2, '#A9A589');
  const targets = [76, 160, 244];
  const colors = ['#D99183', '#E2C579', '#7DAEAB'];
  let sx = -60 + ease(p / 0.2) * 136;
  const abduct = clamp((p - 0.23) / 0.54) * 3;
  const index = Math.min(2, Math.floor(abduct));
  const local = abduct - index;
  if (p >= 0.23) sx = targets[index] - (index > 0 ? 84 * (1 - ease(local / 0.25)) : 0);
  const departure = ease((p - 0.83) / 0.17);
  sx += departure * 150;
  const sy = 35 - departure * 80 + Math.sin(seconds * 2) * 2;
  const beaming = p >= 0.23 && p < 0.77 && local >= 0.25 && local < 0.95;
  if (beaming) {
    ctx.fillStyle = '#B5F0C14D';
    ctx.beginPath();
    ctx.moveTo(sx - 13, sy + 10);
    ctx.lineTo(sx + 13, sy + 10);
    ctx.lineTo(sx + 31, 148);
    ctx.lineTo(sx - 31, 148);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const y = 53 + ((((i * 17 - seconds * 22) % 90) + 90) % 90);
      box(ctx, sx - 14, y, 28, 1, '#C9F4BF');
    }
  }
  for (let i = 0; i < 3; i++) {
    const lift = ease((abduct - i - 0.3) / 0.58);
    if (lift < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - ease((lift - 0.8) / 0.2);
      filmPerson(
        ctx,
        targets[i] + (lift > 0 ? Math.sin(seconds * 4 + i) * 3 : 0),
        144 - lift * 102,
        colors[i],
        lift > 0,
      );
      ctx.restore();
    }
  }
  oval(ctx, sx, sy - 7, 23, 17, '#8BC6BB');
  oval(ctx, sx, sy - 7, 16, 12, '#517E88');
  box(ctx, sx - 5, sy - 15, 10, 10, '#C0DDA0');
  box(ctx, sx - 4, sy - 12, 2, 3, '#273F50');
  box(ctx, sx + 2, sy - 12, 2, 3, '#273F50');
  oval(ctx, sx, sy + 4, 41, 11, '#809EAD');
  box(ctx, sx - 28, sy + 10, 56, 4, '#BBD6C8');
  for (let i = 0; i < 3; i++) {
    const collected = abduct >= i + 0.88;
    oval(ctx, sx - 23 + i * 23, sy + 3, 6, 4, collected ? colors[i] : '#DFEBAD');
    if (collected) box(ctx, sx - 25 + i * 23, sy, 4, 3, '#F3D7AC');
  }
  if (p > 0.92) {
    // Their forgotten shopping bag is the only thing left on the street.
    box(ctx, 155, 135, 10, 10, '#C4A581');
    box(ctx, 158, 132, 4, 2, '#C4A581');
  }
  words(
    ctx,
    p < 0.23
      ? 'AN ORDINARY NIGHT IN FORKTOWN...'
      : p < 0.77
        ? 'PLEASE REMAIN... AIRBORNE.'
        : 'THREE ONE-WAY TICKETS.',
    173,
    8,
  );
}

const CLASSICS: Record<ClassicArtwork, (ctx: Ctx, p: number, seconds: number) => void> = {
  popcorn,
  moon,
  duckling,
  race,
  duel,
  ufo,
};

let reel: Record<ReelArtwork, FilmModule> | undefined;
let reeling: Promise<Record<ReelArtwork, FilmModule>> | undefined;
/**
 * The Starlight Reel's pictures are their own chunk, fetched as the screen starts to rise (or
 * when a reel film is first asked for), so a daytime visit never downloads them.
 */
export function loadReel() {
  reeling ??= import('../films').then((module) => (reel = module.REEL));
  return reeling;
}

/** Shown for the moment it takes the reel to arrive, if someone sits down mid-film. */
function threading(ctx: Ctx, film: CinemaFilm, seconds: number) {
  nightSky(ctx, seconds);
  words(ctx, 'forktown.', 86, 21);
  words(ctx, film.title.toUpperCase(), 112, 9, '#DBBF89');
  words(ctx, 'THREADING THE PROJECTOR...', 130, 7, '#ADBFBA');
}

/** Original shorts, drawn locally at any point in their own timeline. */
export function drawCinemaFilm(ctx: Ctx, film: CinemaFilm, elapsed: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  const p = clamp((elapsed - 3) / (film.duration - 6));
  if (!(film.artwork in CLASSICS)) {
    const module = reel?.[film.artwork as ReelArtwork];
    if (module) {
      module.draw(ctx, p, elapsed);
      titles(ctx, film, elapsed, module.look);
    } else {
      void loadReel();
      threading(ctx, film, elapsed);
    }
    ctx.restore();
    return;
  }
  CLASSICS[film.artwork as ClassicArtwork](ctx, p, elapsed);
  if (elapsed < 3 || elapsed >= film.duration - 3) {
    box(ctx, 12, 52, 296, 63, '#293A48');
    words(ctx, elapsed < 3 ? 'FORKTOWN PICTURE HOUSE' : 'THE END', 70, 8, '#E5B97D');
    words(ctx, film.title, 92, 12);
    words(
      ctx,
      elapsed < 3 ? 'an original little story' : 'made for a little town',
      106,
      7,
      '#ADBFBA',
    );
  }
  ctx.restore();
}

export function drawCinemaCard(ctx: Ctx, slot?: CinemaSlot, seconds = 0) {
  nightSky(ctx, seconds);
  for (let i = 0; i < 4; i++)
    box(
      ctx,
      146 - i * 5,
      51 + i * 7,
      28 + i * 10,
      6,
      ['#92AD8D', '#ABC29B', '#789D80', '#567E6C'][i],
    );
  box(ctx, 157, 77, 6, 12, '#C7B68C');
  words(ctx, 'forktown.', 111, 21);
  words(ctx, 'STARLIGHT CINEMA', 128, 8, '#DBBF89');
  words(
    ctx,
    !slot
      ? 'THREE LITTLE FILMS · TONIGHT 20:30'
      : slot.kind === 'closing'
        ? 'THANK YOU. GET HOME UNDER THE STARS.'
        : slot.kind === 'opening'
          ? 'SETTLE IN. THE SHOW IS ABOUT TO BEGIN.'
          : 'A LITTLE BREATHER. ONE MORE STORY.',
    151,
    7,
    '#ADBFBA',
  );
  if (slot?.nextFilm) words(ctx, `NEXT: ${slot.nextFilm.title}`, 167, 8);
}
