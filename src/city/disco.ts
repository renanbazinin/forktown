// The Midnight Disco at the Little Stage: a light-up floor, a mirror ball, a DJ booth and the
// stage's speakers. Everything is drawn around the stage plot's centre (drawVenue translates
// there) and moves from the town clock alone. Lights glide and fade; nothing flashes.
import { DEFAULT_RESIDENT, type Resident } from '../lib/schema';
import { at, disc, face, frac, level, plane, PX, rect, TAU } from './iso-paint';
import { drawResident } from './residents';
import { mixHex } from './season-palette';

type Ctx = CanvasRenderingContext2D;

/** Rose, lilac, mint, peach and sky: the floor and the moving lights drift through them. */
const PASTEL = ['#E9A6C4', '#BCA8EC', '#9FDCC8', '#F3C893', '#A3C8EC'];
const smooth = (t: number) => t * t * (3 - 2 * t);
/** A pastel that fades into the next one as `phase` passes each whole number. */
function drift(phase: number) {
  const i = Math.floor(phase);
  return mixHex(PASTEL[((i % 5) + 5) % 5], PASTEL[(((i + 1) % 5) + 5) % 5], smooth(frac(phase)));
}

// The floor covers every dancing spot in EVENT_SPOTS.stage, in front of the platform (which
// ends at local y = 0.2) and inside the plot's lawn.
export const DISCO_FLOOR = { x0: -1.36, x1: 1.36, y0: 0.36, y1: 1.36, cols: 7, rows: 3 } as const;
const FLOOR_MIDDLE = {
  x: (DISCO_FLOOR.x0 + DISCO_FLOOR.x1) / 2,
  y: (DISCO_FLOOR.y0 + DISCO_FLOOR.y1) / 2,
};

/** A tile's colour: pastels drift across the floor as a slow wave, and a soft swell of light
 * rolls over it every few seconds. Minutes are real seconds, so nothing here flashes. */
export function discoTile(minutes: number, col: number, row: number) {
  const colour = drift(minutes * 0.12 + (col + row) * 0.16);
  const swell = 0.5 + 0.5 * Math.sin(minutes * 1.4 - (col - row) * 0.9);
  return mixHex('#4A5266', colour, 0.55 + 0.4 * swell);
}

/** Ground layer: the tiles, under the dancers. */
export function drawDiscoFloor(ctx: Ctx, minutes: number) {
  const { x0, x1, y0, y1, cols, rows } = DISCO_FLOOR;
  const tile = { u: ((x1 - x0) / cols) * PX, w: ((y1 - y0) / rows) * PX };
  plane(ctx, x0, y0, 0, () => {
    rect(ctx, -1.5, -1.5, tile.u * cols + 3, tile.w * rows + 3, '#29313D');
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++)
        rect(
          ctx,
          col * tile.u + 0.75,
          row * tile.w + 0.75,
          tile.u - 1.5,
          tile.w - 1.5,
          discoTile(minutes, col, row),
        );
  });
}

// ---------------------------------------------------------------------------------------------
// Speakers: two cabinets at the platform's corners, for the concerts and the disco alike.

const SPEAKERS = [
  { x: -0.45, y: -0.1 },
  { x: 0.5, y: -1.05 },
];
const SPEAKER = { long: 0.22, deep: 0.18, high: 20 };

function speaker(ctx: Ctx, x: number, y: number, night: boolean, pump: number) {
  const x0 = x - SPEAKER.long / 2,
    x1 = x + SPEAKER.long / 2,
    y0 = y - SPEAKER.deep / 2,
    y1 = y + SPEAKER.deep / 2;
  const long = SPEAKER.long * PX,
    deep = SPEAKER.deep * PX,
    h = SPEAKER.high;
  face(ctx, at(x1, y1), 'y', () => rect(ctx, 0, -h, deep, h, night ? '#1F262E' : '#2E3A3A'));
  face(ctx, at(x0, y1), 'x', () => {
    rect(ctx, 0, -h, long, h, night ? '#2A323C' : '#3A4745');
    // A tweeter over a woofer whose cone breathes with the music.
    disc(ctx, long / 2, -6.5, 3.4, night ? '#141A20' : '#202A2A');
    disc(ctx, long / 2, -6.5, 2.2 + pump * 0.6, night ? '#39434F' : '#4D5A57');
    disc(ctx, long / 2, -6.5, 0.8, night ? '#56616E' : '#6C7872');
    disc(ctx, long / 2, -15, 1.6, night ? '#141A20' : '#202A2A');
    rect(ctx, 0, -h, long, 1, night ? '#46505D' : '#5B6A66');
  });
  level(ctx, x0, y0, x1, y1, h, night ? '#3B4552' : '#4E5C59');
}

export function drawStageSpeakers(ctx: Ctx, minutes: number, night: boolean, live: boolean) {
  const pump = live ? Math.sin(minutes * TAU * 1.05) ** 2 : 0;
  for (const s of SPEAKERS) speaker(ctx, s.x, s.y, night, pump);
}

// ---------------------------------------------------------------------------------------------
// The DJ, the booth, the mirror ball and the light it throws.

/** The DJ is scenery, like the Millpond's fisher: not a contributed resident. */
const DJ: Resident = {
  ...DEFAULT_RESIDENT,
  name: 'DJ',
  figure: 'male',
  skin: '#D6B18F',
  hair: '#424A41',
  outfit: '#B18DB7',
  accessory: 'none',
};
const DJ_SPOT = { x: 0.14, y: -0.6 };
const DESK = { x0: -0.32, x1: 0.32, y0: -0.5, y1: -0.22, high: 12 };
const BALL = { x: -0.1, y: 0.95, rise: 60, r: 6.5 };

function dj(ctx: Ctx, minutes: number) {
  const p = at(DJ_SPOT.x, DJ_SPOT.y);
  const walkPhase = frac(minutes * 1.05);
  drawResident(
    ctx,
    DJ,
    p.x,
    p.y,
    1.25,
    { pose: 'dance', facing: 'sw', walkPhase, moving: false, greeting: false },
    { shadow: false },
  );
  // Headphones, in the figure's own pixels (it faces the floor, so it is drawn mirrored).
  const bob = -Math.round(Math.abs(Math.sin(walkPhase * TAU)) * 0.8);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(-1.25, 1.25);
  rect(ctx, -5, -24 + bob, 10, 1.5, '#2B3038');
  rect(ctx, -6, -20 + bob, 2, 4, '#2B3038');
  rect(ctx, 4, -20 + bob, 2, 4, '#2B3038');
  rect(ctx, 4, -19 + bob, 1, 2, drift(minutes * 0.2));
  ctx.restore();
}

function desk(ctx: Ctx, minutes: number) {
  const { x0, x1, y0, y1, high } = DESK;
  const long = (x1 - x0) * PX,
    deep = (y1 - y0) * PX;
  face(ctx, at(x1, y1), 'y', () => rect(ctx, 0, -high, deep, high, '#232A33'));
  face(ctx, at(x0, y1), 'x', () => {
    rect(ctx, 0, -high, long, high, '#2F3743');
    // A light strip along the top and a little level meter that rises and falls with the beat.
    rect(ctx, 0, -high, long, 1.5, drift(minutes * 0.2));
    for (let i = 0; i < 7; i++) {
      const bar = 1.5 + 4 * Math.abs(Math.sin(minutes * 2.2 + i * 1.3));
      rect(ctx, 5 + i * 2.2, -2.5 - bar, 1.4, bar, PASTEL[i % 5]);
    }
  });
  plane(ctx, x0, y0, high, () => {
    rect(ctx, 0, 0, long, deep, '#3C4553');
    // Two turntables and the mixer between them.
    const mid = deep / 2;
    for (const [u, turn] of [
      [5.5, 0],
      [long - 5.5, 1.7],
    ] as const) {
      disc(ctx, u, mid, 4.2, '#262C35');
      disc(ctx, u, mid, 3.4, '#15191F');
      disc(ctx, u, mid, 1.1, drift(minutes * 0.2 + turn));
      const a = minutes * 3.3 + turn;
      rect(ctx, u + Math.cos(a) * 2.3 - 0.5, mid + Math.sin(a) * 2.3 - 0.5, 1, 1, '#8C95A3');
      rect(ctx, u + 3.2, mid - 3.5, 0.8, 4, '#AEB6C0');
    }
    rect(ctx, long / 2 - 2.5, mid - 3, 5, 6, '#262C35');
    for (let i = 0; i < 3; i++) rect(ctx, long / 2 - 1.5 + i * 1.3, mid - 1.8, 0.8, 0.8, PASTEL[i]);
  });
}

function mirrorBall(ctx: Ctx, minutes: number) {
  const b = at(BALL.x, BALL.y, BALL.rise);
  // It hangs from the canopy's corner, directly above on screen.
  rect(ctx, b.x - 0.5, b.y - BALL.r - 10, 1, 10, '#8A93A0');
  ctx.save();
  disc(ctx, b.x, b.y, BALL.r, '#76829A');
  ctx.clip();
  disc(ctx, b.x - 1.3, b.y - 1.3, BALL.r - 1.2, '#A7B2C4');
  // Facets: meridians that slide round as the ball turns, and fixed parallels.
  const turn = minutes * 0.9;
  ctx.fillStyle = '#5E6A80';
  for (let k = 0; k < 8; k++) {
    const angle = frac(k / 8 + turn / TAU) * TAU;
    if (Math.cos(angle) > 0)
      ctx.fillRect(b.x + Math.sin(angle) * BALL.r - 0.5, b.y - BALL.r, 1, BALL.r * 2);
  }
  for (let j = -2; j <= 2; j++) ctx.fillRect(b.x - BALL.r, b.y + j * 2.6 - 0.5, BALL.r * 2, 1);
  // The facets catching the light glide across the front.
  ctx.fillStyle = '#F6F8FC';
  for (let g = 0; g < 3; g++) {
    const angle = frac(g / 3 + turn / TAU) * TAU;
    if (Math.cos(angle) > 0.2)
      ctx.fillRect(b.x + Math.sin(angle) * (BALL.r - 1.5) - 1, b.y - 3 + g * 2.6, 2, 1.6);
  }
  ctx.restore();
}

/** Reflections swim round the floor as the ball turns, one lap every half minute. */
function reflections(ctx: Ctx, minutes: number) {
  const ball = at(BALL.x, BALL.y, BALL.rise);
  const spots: { x: number; y: number }[] = [];
  for (let i = 0; i < 18; i++) {
    const angle = i * 2.4 + minutes * 0.21,
      reach = 0.3 + frac(i * 0.618) * 1.05;
    const x = BALL.x + Math.cos(angle) * reach,
      y = BALL.y + Math.sin(angle) * reach * 0.6;
    // Only the lawn in front of the stage catches them; the platform starts at y = 0.2.
    if (y < 0.26 || y > 1.36 || Math.abs(x) > 1.36) continue;
    spots.push(at(x, y));
  }
  ctx.strokeStyle = 'rgba(244, 241, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  spots.forEach((s, i) => {
    if (i % 3) return;
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(s.x, s.y);
  });
  ctx.stroke();
  ctx.fillStyle = '#F4F1FFCC';
  for (const s of spots) ctx.fillRect(s.x - 1, s.y - 0.5, 2, 1);
}

/** Two coloured pools of light glide over the floor from lamps up in the canopy. */
function pools(ctx: Ctx, minutes: number) {
  for (const [k, sx, sy, fx, fy] of [
    [0, 0.31, 0.47, 0, 1],
    [1, 0.27, 0.41, 2.5, 4],
  ] as const) {
    const x = FLOOR_MIDDLE.x + Math.sin(minutes * sx + fx) * 0.95,
      y = FLOOR_MIDDLE.y + Math.sin(minutes * sy + fy) * 0.32;
    plane(ctx, x, y, 0, () => disc(ctx, 0, 0, 0.3 * PX, drift(minutes * 0.08 + k * 2.5) + '55'));
  }
}

/** Objects layer, over the platform: everything the disco adds besides its floor. */
export function drawDiscoStage(ctx: Ctx, minutes: number) {
  pools(ctx, minutes);
  reflections(ctx, minutes);
  dj(ctx, minutes);
  desk(ctx, minutes);
  mirrorBall(ctx, minutes);
}
