import { isEventLive, type TownEvent, type Venue } from '../lib/events';
import { project } from '../lib/world';
import { FORK_BOUNDS } from '../lib/lanterns';
import { drawVenueTitle } from './venue-title';

export const venueBounds = (venue: Venue) =>
  venue.kind === 'fork'
    ? FORK_BOUNDS
    : {
        left: venue.kind === 'stage' ? -44 : -84,
        right: 84,
        top: venue.kind === 'stage' ? -94 : -40,
        bottom: venue.kind === 'stage' ? 26 : 38,
      };

export function drawVenue(
  ctx: CanvasRenderingContext2D,
  venue: Venue,
  x: number,
  y: number,
  night: boolean,
  event?: TownEvent,
  minutes = 0,
  layer: 'ground' | 'objects' = 'objects',
) {
  // The Lantern Fork has its own painter (lantern-fork.ts); the green art must not land on D3.
  if (venue.kind === 'fork') return;
  const live = !!event && isEventLive(event, minutes);
  const party = live && event?.id === 'night-party';
  ctx.save();
  ctx.translate(x, y);
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const poly = (points: number[][], color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };
  if (layer === 'ground' && venue.kind === 'stage') {
    if (party) {
      // Steady pastel tiles sit under the dancers and leave the stage approach open.
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 5; col++) {
          const pt = project(-1 + col * 0.5, 0.5 + row * 0.4);
          poly(
            [
              [pt.x, pt.y - 8],
              [pt.x + 16, pt.y],
              [pt.x, pt.y + 8],
              [pt.x - 16, pt.y],
            ],
            ['#796E87', '#8D816C', '#638B80'][(row + col) % 3],
          );
        }
    }
    ctx.restore();
    return;
  }
  if (venue.kind === 'stage') {
    // Pull the platform to the rear of its plot, leaving a real audience lawn.
    // This matches the walkable spots in events.ts: platform local y ends at 0.2.
    ctx.translate(20.9, -10.45);
    ctx.scale(0.78, 0.78);
    // Raised timber stage, shaded canopy, speakers and warm, steady festoon lights.
    poly(
      [
        [-72, 0],
        [0, -36],
        [72, 0],
        [0, 36],
      ],
      night ? '#5C665E' : '#BA956C',
    );
    poly(
      [
        [-72, 0],
        [0, 36],
        [72, 0],
        [72, 9],
        [0, 45],
        [-72, 9],
      ],
      night ? '#414E49' : '#8E7255',
    );
    for (const px of [-62, 60]) rect(px, -75, 4, 82, night ? '#637D73' : '#6F856D');
    poly(
      [
        [-78, -72],
        [0, -106],
        [78, -72],
        [0, -40],
      ],
      night ? '#556F70' : '#7D9E97',
    );
    poly(
      [
        [-78, -72],
        [0, -40],
        [78, -72],
        [78, -63],
        [0, -31],
        [-78, -63],
      ],
      night ? '#365653' : '#557E72',
    );
    drawVenueTitle(ctx, {
      x: 0,
      y: -59,
      width: 120,
      height: 24,
      title: party ? 'Midnight Disco' : venue.name,
      fontSize: 12,
      night,
    });
    for (let i = 0; i < 7; i++)
      rect(
        -57 + i * 19,
        -37 + Math.abs(i - 3) * -4,
        4,
        4,
        party ? ['#F2C18E', '#CEB7DF', '#ADDBC9'][i % 3] : live || night ? '#FFE0A0' : '#CFBE8E',
      );
    for (const px of [-55, 41]) {
      rect(px, -18, 15, 29, '#35453F');
      rect(px + 3, -15, 9, 7, '#58645B');
      rect(px + 3, -3, 9, 9, '#202F2E');
    }
    if (party) {
      // A tiny DJ, two turntables, and a raised hand. Lights stay steady.
      const lift = Math.sin(minutes * 2) > 0 ? 2 : 0;
      rect(-5, -27, 11, 16, '#B18DB7');
      rect(-4, -37, 9, 10, '#D6B18F');
      rect(-5, -39, 11, 4, '#424A41');
      rect(-7, -36, 3, 7, '#283E3A');
      rect(5, -36, 3, 7, '#283E3A');
      rect(6, -26, 8, 3, '#B18DB7');
      rect(12, -33 - lift, 3, 10, '#D6B18F');
      rect(-25, -12, 50, 20, '#304F48');
      rect(-25, -14, 50, 4, '#8FAAA0');
      for (const px of [-14, 14]) {
        ctx.fillStyle = '#233D38';
        ctx.beginPath();
        ctx.ellipse(px, -12, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        rect(px - 1, -13, 2, 2, '#E5C989');
      }
      for (let i = 0; i < 3; i++) rect(-5 + i * 4, -7, 2, 5, '#D1B5D6');
    } else {
      // Instruments remain on the stage between shows; performers appear only during a set.
      rect(-9, -15, 19, 14, '#AE795B');
      rect(-8, -17, 17, 3, '#E1CF9F');
      rect(-17, -29, 1, 23, '#788176');
      rect(-24, -31, 16, 3, '#C5B475');
      rect(22, -28, 2, 36, '#3D5049');
      rect(20, -29, 8, 3, '#293F3A');
      if (live) {
        const bob = Math.sin(minutes * 2) > 0 ? 1 : 0;
        for (const [px, py, shirt] of [
          [-27, 7, '#B686A6'],
          [28, 8, '#D8B46F'],
          [0, -19, '#89B4AE'],
        ] as const) {
          rect(px - 3, py - 13 + bob, 8, 10, shirt);
          rect(px - 3, py - 22 + bob, 7, 9, '#D6B18F');
          rect(px - 4, py - 23 + bob, 9, 4, '#424A41');
          rect(px - 3, py - 3, 3, 6, '#35463E');
          rect(px + 2, py - 3, 3, 6, '#35463E');
          if (px !== 0) {
            rect(px - 5, py - 10 + bob, 12, 6, '#C77456');
            poly(
              [
                [px + 4, py - 8 + bob],
                [px + 14, py - 17 + bob],
                [px + 16, py - 14 + bob],
                [px + 6, py - 5 + bob],
              ],
              '#EDD3A0',
            );
          }
        }
      }
    }
    if (live) {
      ctx.font = '18px serif';
      // Set here, not left to whatever the last object drew with, which culling can change.
      ctx.textAlign = 'start';
      ctx.fillStyle = night ? '#EED8A3' : '#6E7653';
      ctx.fillText('♪', -82, -24 - Math.sin(minutes) * 4);
      ctx.fillText('♫', 82, -13 - Math.cos(minutes) * 4);
    }
  } else {
    if (layer === 'ground') {
      // Patchwork picnic rugs and a lemonade/book table, kept clear of the front pavement.
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 5; col++) {
          const px = (col - row) * 11 - 18,
            py = (col + row) * 5.5 - 12;
          poly(
            [
              [px, py],
              [px + 11, py + 5.5],
              [px, py + 11],
              [px - 11, py + 5.5],
            ],
            (row + col) % 2 ? (night ? '#70847A' : '#E7DAB7') : night ? '#886F70' : '#CC8F82',
          );
        }
      // A shared basket and a few snacks sit between the seated neighbors.
      rect(-20, 8, 10, 7, '#AB805B');
      rect(-19, 7, 8, 2, '#D8B883');
      rect(-15, 4, 2, 4, '#A2A86F');
      rect(-23, 20, 5, 2, '#F2D99C');
      ctx.restore();
      return;
    }
    rect(26, -8, 3, 23, '#7F765B');
    rect(57, -21, 3, 23, '#7F765B');
    poly(
      [
        [15, -11],
        [46, -26],
        [66, -16],
        [35, 0],
      ],
      night ? '#8B9180' : '#CFB58C',
    );
    rect(40, -29, 7, 10, '#D8C678');
    rect(42, -31, 3, 3, '#E8DCB8');
    rect(51, -24, 5, 6, '#E9DFBC');
    if (live && event?.id === 'books') {
      rect(23, -20, 13, 4, '#799C96');
      rect(24, -24, 11, 4, '#BE9776');
    }
    if (live && event?.id === 'games') {
      for (let i = 0; i < 5; i++)
        rect(-18 + i * 7, 8 + (i % 2) * 5, 4, 4, i % 2 ? '#F1DE9F' : '#527866');
    }
    for (const px of [-72, 69]) rect(px, -40, 3, 56, '#839070');
    ctx.strokeStyle = night ? '#72877A' : '#8D9574';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-70, -39);
    ctx.quadraticCurveTo(0, -15, 70, -39);
    ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const px = -61 + i * 15,
        py = -38 + (1 - Math.abs(i - 4) / 4) * 11;
      poly(
        [
          [px, py],
          [px + 9, py],
          [px + 4, py + 10],
        ],
        ['#CD927C', '#E7CA86', '#89AAA1'][i % 3],
      );
    }
  }
  ctx.restore();
}
