import type { Place } from '../lib/schema';
import type { ResidentState } from '../lib/simulation';
import { hash } from '../lib/world';
import { drawChimneySmoke } from './ambience';
import { drawSign } from './signs';
import { drawLanternPost, type HouseLantern } from './lantern-post';

type Ctx = CanvasRenderingContext2D;
export type HouseAppearance = Pick<
  Place,
  'id' | 'building' | 'color' | 'decoration' | 'design' | 'sign'
>;
export function tint(color: string, delta: number) {
  const n = parseInt(color.slice(1), 16);
  return (
    '#' +
    [n >> 16, (n >> 8) & 255, n & 255]
      .map((value) =>
        Math.max(0, Math.min(255, value + delta))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function polygon(ctx: Ctx, points: number[][], fill: string) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}
const BASE_HEIGHT = {
  cottage: 32,
  cafe: 34,
  bookshop: 43,
  greenhouse: 32,
  studio: 36,
  observatory: 42,
};
export function houseBounds(place: HouseAppearance) {
  const height = BASE_HEIGHT[place.building] + (place.design.floors - 1) * 23;
  const roof =
    place.design.roof === 'classic' && place.building === 'observatory'
      ? 45
      : place.design.roof === 'flat'
        ? 14
        : 34;
  return { height, top: height + roof + 8, bottom: 46, left: 72, right: 72 };
}
export function drawHouse(
  ctx: Ctx,
  place: HouseAppearance,
  x: number,
  y: number,
  night = false,
  scale = 1,
  life?: { minutes: number; activity?: ResidentState['activity']; lantern?: HouseLantern },
) {
  const d = place.design,
    { height: h } = houseBounds(place);
  const roof = tint(place.color, night ? -35 : 0),
    wall = tint(d.wall, night ? -55 : 0),
    trim = tint(d.trim, night ? -25 : 0);
  const seed = hash(place.id);
  const awakeInside = life?.activity === 'home' || life?.activity === 'work';
  // On the map a home's windows wait for its lantern; previews without one keep the old glow.
  const windowsLit = night && (life?.lantern?.lit ?? true);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  polygon(
    ctx,
    [
      [-70, 7],
      [0, -28],
      [70, 7],
      [0, 42],
    ],
    night ? '#5A7667' : '#BFD5A4',
  );
  polygon(
    ctx,
    [
      [-42, 7],
      [0, -14],
      [43, 8],
      [0, 29],
    ],
    d.garden === 'paving' ? (night ? '#808477' : '#CFC9B3') : night ? '#567253' : '#BBD395',
  );
  // Garden beds stay within the plot; all artwork is drawn locally.
  for (let i = 0; i < 7; i++) {
    const gx = -34 + i * 10,
      gy = 24 - Math.abs(gx) * 0.35;
    if (d.garden === 'vegetables') {
      box(ctx, gx, gy, 7, 4, '#957453');
      box(ctx, gx + 2, gy - 4, 3, 6, '#567B44');
    }
    if (d.garden === 'wildflowers') {
      box(ctx, gx, gy - 3, 1, 5, '#668654');
      box(ctx, gx - 1, gy - 4, 3, 2, ['#EDC88B', '#D18F87', '#B3A5CD'][i % 3]);
    }
  }
  // Stepping stones cross the lawn from the front door toward the street.
  for (let step = 0; step < 3; step++) {
    const sx = -18 - step * 8.5,
      sy = 9 + step * 4.25;
    polygon(
      ctx,
      [
        [sx, sy - 3],
        [sx + 6, sy],
        [sx, sy + 3],
        [sx - 6, sy],
      ],
      night ? '#899483' : '#E3DABF',
    );
  }
  if (life?.lantern) drawLanternPost(ctx, life.lantern, night);
  polygon(
    ctx,
    [
      [-29, -h],
      [0, 15 - h],
      [0, 18],
      [-29, 3],
    ],
    wall,
  );
  polygon(
    ctx,
    [
      [0, 15 - h],
      [29, -h],
      [29, 3],
      [0, 18],
    ],
    tint(wall, -24),
  );
  if (place.building === 'greenhouse') {
    polygon(
      ctx,
      [
        [-27, 2],
        [-27, 6 - h],
        [-2, 19 - h],
        [-2, 15],
      ],
      night ? '#598178' : '#A7C5B2',
    );
    polygon(
      ctx,
      [
        [2, 15],
        [2, 19 - h],
        [27, 6 - h],
        [27, 2],
      ],
      night ? '#456D67' : '#8AB4A8',
    );
  }
  for (let floor = 0; floor < d.floors; floor++) {
    const yy = -h + 12 + floor * 23;
    if (floor > 0) {
      polygon(
        ctx,
        [
          [-29, yy - 7],
          [0, yy + 8],
          [29, yy - 7],
          [29, yy - 5],
          [0, yy + 10],
          [-29, yy - 5],
        ],
        trim,
      );
    }
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.transform(1, side === -1 ? 0.5 : -0.5, 0, 1, side === -1 ? -25 : 8, yy + 5);
      const silhouette = () => {
        if (!windowsLit || !awakeInside || floor !== 0 || side !== (seed % 2 ? -1 : 1)) return;
        // One neighbor behind one pane, with the window frame painted in front.
        box(ctx, 5, 3, 3, 3, '#83744D');
        box(ctx, 4, 6, 5, 4, '#83744D');
        box(ctx, 3, 9, 7, 1, '#83744D');
      };
      if (d.windows === 'round') {
        ctx.beginPath();
        ctx.arc(6, 6, 6, 0, Math.PI * 2);
        ctx.fillStyle = windowsLit ? '#F1D68F' : night ? '#4E6461' : '#8EBCBF';
        ctx.fill();
        silhouette();
        ctx.strokeStyle = trim;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        box(ctx, 0, 0, 12, 12, trim);
        box(ctx, 1, 1, 10, 10, windowsLit ? '#F1D68F' : night ? '#4E6461' : '#90B6BA');
        silhouette();
        box(ctx, 5, 0, 2, 12, trim);
        if (d.windows === 'cross') box(ctx, 0, 5, 12, 2, trim);
        else {
          box(ctx, -4, -1, 3, 14, roof);
          box(ctx, 13, -1, 3, 14, roof);
        }
      }
      ctx.restore();
    }
  }
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, -13, 0);
  box(ctx, 0, -4, 8, 16, trim);
  box(ctx, 5, 3, 1, 2, '#EFD8A4');
  ctx.restore();
  const flat =
    d.roof === 'flat' || (d.roof === 'classic' && ['studio', 'cafe'].includes(place.building));
  if (flat) {
    polygon(
      ctx,
      [
        [-33, -h],
        [0, -h - 17],
        [33, -h],
        [0, 17 - h],
      ],
      tint(roof, 12),
    );
    polygon(
      ctx,
      [
        [-33, -h],
        [0, 17 - h],
        [33, -h],
        [33, 5 - h],
        [0, 22 - h],
        [-33, 5 - h],
      ],
      roof,
    );
    if (place.building === 'studio') {
      polygon(
        ctx,
        [
          [-15, -h],
          [0, -h - 8],
          [15, -h],
          [0, 8 - h],
        ],
        '#9AC3C1',
      );
    }
  } else if (d.roof === 'classic' && place.building === 'observatory') {
    polygon(
      ctx,
      [
        [-30, -h],
        [0, 16 - h],
        [30, -h],
        [0, -16 - h],
      ],
      roof,
    );
    ctx.fillStyle = tint(roof, 12);
    ctx.beginPath();
    ctx.ellipse(0, -h, 25, 29, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    polygon(
      ctx,
      [
        [8, -h - 25],
        [28, -h - 42],
        [33, -h - 35],
        [12, -h - 18],
      ],
      '#B9C6BB',
    );
  } else {
    polygon(
      ctx,
      [
        [-33, -h],
        [0, 17 - h],
        [15, -h - 18],
        [-18, -h - 35],
      ],
      tint(roof, 14),
    );
    polygon(
      ctx,
      [
        [-18, -h - 35],
        [15, -h - 18],
        [33, -h],
        [0, -17 - h],
      ],
      tint(roof, -16),
    );
    polygon(
      ctx,
      [
        [0, 17 - h],
        [33, -h],
        [15, -h - 18],
      ],
      roof,
    );
    for (let i = 1; i < 5; i++) {
      ctx.strokeStyle = tint(roof, -9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-33 + 3 * i, -h - 7 * i);
      ctx.lineTo(3 * i, 17 - h - 7 * i);
      ctx.stroke();
    }
  }
  if (['cottage', 'cafe', 'bookshop', 'studio'].includes(place.building)) {
    const chimneyX = -18,
      chimneyY = -h - (flat ? 2 : 16);
    const brick = night ? '#827E6C' : '#B3977F';
    box(ctx, chimneyX, chimneyY - 13, 7, 14, brick);
    polygon(
      ctx,
      [
        [chimneyX + 7, chimneyY - 13],
        [chimneyX + 10, chimneyY - 15],
        [chimneyX + 10, chimneyY - 1],
        [chimneyX + 7, chimneyY + 1],
      ],
      tint(brick, -22),
    );
    box(ctx, chimneyX - 1, chimneyY - 15, 12, 3, tint(brick, 12));
    box(ctx, chimneyX + 2, chimneyY - 15, 6, 1, tint(brick, -35));
    box(ctx, chimneyX, chimneyY - 7, 7, 1, tint(brick, -12));
    if (awakeInside && life)
      drawChimneySmoke(ctx, chimneyX + 5, chimneyY - 17, life.minutes, seed, night);
  }
  if (d.feature === 'balcony') {
    polygon(
      ctx,
      [
        [1, -9],
        [30, -24],
        [40, -17],
        [11, -2],
      ],
      trim,
    );
    for (let i = 0; i < 6; i++) box(ctx, 11 + i * 5, -12 - i * 2.5, 1, 10, roof);
    polygon(
      ctx,
      [
        [10, -14],
        [40, -29],
        [40, -27],
        [10, -12],
      ],
      roof,
    );
  }
  if (d.feature === 'porch' || place.building === 'cafe') {
    polygon(
      ctx,
      [
        [-33, -13],
        [-2, 3],
        [-9, 12],
        [-40, -4],
      ],
      roof,
    );
    box(ctx, -38, -2, 2, 19, trim);
    box(ctx, -9, 12, 2, 14, trim);
  }
  if (place.decoration === 'bench') {
    const wood = tint(trim, 24),
      frame = tint(trim, -18);
    // Keep the feet and shadow inside the lawn's front-right edge.
    polygon(
      ctx,
      [
        [18, 14],
        [37, 23],
        [30, 26],
        [11, 17],
      ],
      '#23341B25',
    );
    box(ctx, 18, -4, 2, 18, frame);
    box(ctx, 34, 4, 2, 18, frame);
    box(ctx, 13, 10, 2, 7, frame);
    box(ctx, 29, 18, 2, 7, frame);
    // A raised seat with a visible front edge and two backrest slats.
    polygon(
      ctx,
      [
        [18, 7],
        [36, 16],
        [30, 19],
        [12, 10],
      ],
      wood,
    );
    polygon(
      ctx,
      [
        [12, 10],
        [30, 19],
        [30, 21],
        [12, 12],
      ],
      trim,
    );
    polygon(
      ctx,
      [
        [30, 19],
        [36, 16],
        [36, 18],
        [30, 21],
      ],
      frame,
    );
    polygon(
      ctx,
      [
        [18, -4],
        [36, 5],
        [36, 8],
        [18, -1],
      ],
      wood,
    );
    polygon(
      ctx,
      [
        [18, 1],
        [36, 10],
        [36, 13],
        [18, 4],
      ],
      wood,
    );
  }
  if (place.decoration === 'mailbox') {
    box(ctx, 34, 13, 2, 14, trim);
    box(ctx, 30, 10, 9, 6, roof);
    box(ctx, 38, 8, 1, 6, '#C57B65');
  }
  if (place.decoration === 'tree') {
    box(ctx, 39, 1, 3, 23, trim);
    polygon(
      ctx,
      [
        [40, -22],
        [52, -3],
        [48, -3],
        [55, 9],
        [26, 9],
        [32, -3],
        [28, -3],
      ],
      night ? '#41644E' : '#719455',
    );
  }
  if (place.decoration === 'flowers')
    for (let i = 0; i < 4; i++) {
      box(ctx, 29 + i * 4, 19 + i, 1, 6, '#6C915B');
      box(ctx, 28 + i * 4, 17 + i, 3, 3, '#EABD8A');
    }
  if (place.sign.mode !== 'none') {
    ctx.save();
    ctx.transform(1, -0.5, 0, 1, 1.5, 5 - h);
    ctx.fillStyle = '#263B3540';
    ctx.fillRect(-1, 0, 29, 15);
    ctx.fillStyle = trim;
    ctx.fillRect(-1, -1, 28, 14);
    drawSign(ctx, place.sign, 26, 12);
    ctx.restore();
  }
  ctx.restore();
}
