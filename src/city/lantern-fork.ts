import { FOUNDER_SLOTS, type LanternRegister } from '../lib/lanterns';
import { hash } from '../lib/world';
import { drawGlow, LIGHT } from './glow';
import { tint } from './houses';
import { drawVenueTitle } from './venue-title';
import { canopyAt, pumpkinOut, type TownSeason } from '../lib/seasons';
import { BLOSSOM, FOLIAGE, mixHex, pick, PUMPKIN, SNOW } from './season-palette';

type Ctx = CanvasRenderingContext2D;
type Lobe = { cx: number; cy: number; rx: number; ry: number };
type Box = { x: number; y: number; w: number; h: number };
export type ForkSlot = { x: number; y: number; size: 'large' | 'small' };

// All Fork art is in world px around the D3 plot centre, with negative y up. It stays inside
// FORK_BOUNDS (x -80..86, y -131..44), so C2, C3 and D2 keep their own hit areas.

/** The founders' lobe on the left; the crown and east lobes hold the neighbours. The V
 * between them is the fork itself, and it keeps C2's door visible behind the tree. */
export const FORK_LOBES = {
  left: { cx: -44, cy: -92, rx: 32, ry: 22 },
  crown: { cx: 28, cy: -104, rx: 30, ry: 24 },
  east: { cx: 58, cy: -86, rx: 26, ry: 20 },
} satisfies Record<string, Lobe>;

// A few fixed leaf clumps per lobe break up the flat fill, like the town trees' stepped tufts.
const DAPPLES = Object.entries(FORK_LOBES).flatMap(([name, lobe]) =>
  Array.from({ length: 7 }, (_, k) => {
    const seed = hash(`fork-leaf:${name}:${k}`);
    const angle = ((seed % 360) * Math.PI) / 180,
      reach = 0.35 + ((seed >>> 9) % 45) / 100;
    return {
      x: 2 * Math.round((lobe.cx + Math.cos(angle) * lobe.rx * reach) / 2) - 1,
      y: 2 * Math.round((lobe.cy + Math.sin(angle) * lobe.ry * reach) / 2),
      lobe,
    };
  }),
);

const LANTERN_SIZE = { large: { w: 3, h: 4 }, small: { w: 2, h: 3 } };
export const slotBox = (slot: ForkSlot): Box => ({
  x: slot.x,
  y: slot.y,
  ...LANTERN_SIZE[slot.size],
});

// Hand-placed arcs: eight founders under the left lobe, then the first sixteen neighbours
// along the crown's underside, the east lobe and a second tier above them.
const PLACED: [number, number][] = [
  [-60, -84],
  [-53, -80],
  [-46, -78],
  [-39, -78],
  [-32, -80],
  [-25, -84],
  [-49, -88],
  [-35, -88],
  [10, -88],
  [17, -86],
  [24, -85],
  [31, -85],
  [38, -87],
  [45, -76],
  [52, -74],
  [59, -73],
  [66, -75],
  [20, -94],
  [34, -94],
  [50, -81],
  [64, -81],
  [14, -100],
  [27, -100],
  [40, -100],
];
const SLOT_TARGET = FOUNDER_SLOTS + 160;

const insideLobe = (lobe: Lobe, box: Box, inset: number) =>
  [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ].every(
    ([px, py]) =>
      ((px - lobe.cx) / (lobe.rx - inset)) ** 2 + ((py - lobe.cy) / (lobe.ry - inset)) ** 2 <= 1,
  );
const apart = (a: Box, b: Box) =>
  a.x + a.w + 1 <= b.x || b.x + b.w + 1 <= a.x || a.y + a.h + 1 <= b.y || b.y + b.h + 1 <= a.y;

/**
 * Every slot a lantern can ever hang in; a slot never moves once a town grows past it.
 * After the placed arcs, large lanterns fill the crown, the east lobe and the upper half of
 * the founders' lobe row by row from the bottom; small ones then pack the gaps tightly.
 */
export const FORK_SLOTS: readonly ForkSlot[] = (() => {
  const slots: ForkSlot[] = PLACED.map(([x, y]) => ({ x, y, size: 'large' }));
  const boxes = slots.map(slotBox);
  const passes = [
    { size: 'large', step: [6, 7], offset: [0, 0], stagger: 3, inset: 3, upperLeft: true },
    { size: 'small', step: [3, 4], offset: [2, 2], stagger: 0, inset: 1, upperLeft: false },
  ] as const;
  for (const pass of passes) {
    const { w, h } = LANTERN_SIZE[pass.size];
    for (const lobe of [FORK_LOBES.crown, FORK_LOBES.east, FORK_LOBES.left]) {
      const upperOnly = pass.upperLeft && lobe === FORK_LOBES.left;
      for (let row = 0, y = lobe.cy + lobe.ry - 7 + pass.offset[1]; y >= lobe.cy - lobe.ry; row++) {
        const first = lobe.cx - lobe.rx + pass.offset[0] + (row % 2 ? pass.stagger : 0);
        for (let x = first; x + w <= lobe.cx + lobe.rx; x += pass.step[0]) {
          if (slots.length >= SLOT_TARGET) return slots;
          const box = { x, y, w, h };
          if (upperOnly && y + h > lobe.cy) continue;
          if (!insideLobe(lobe, box, pass.inset) || !boxes.every((other) => apart(other, box)))
            continue;
          slots.push({ x, y, size: pass.size });
          boxes.push(box);
        }
        y -= pass.step[1];
      }
    }
  }
  return slots;
})();

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

/** Ground-cache art: a pale, cobbled plaza for the Fork to stand in. */
export function drawForkPlaza(ctx: Ctx, x: number, y: number, night: boolean) {
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 70, 35, 0, 0, Math.PI * 2);
  ctx.fillStyle = night ? '#5E7064' : '#C9BF97';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 68, 33, 0, 0, Math.PI * 2);
  ctx.fillStyle = night ? '#7F8B7B' : '#E6DCBD';
  ctx.fill();
  for (let k = 0; k < 16; k++) {
    const seed = hash(`fork-plaza:${k}`);
    const angle = ((seed % 360) * Math.PI) / 180,
      reach = Math.sqrt(((seed >>> 9) % 1000) / 1000);
    rect(
      ctx,
      Math.round(x + Math.cos(angle) * 62 * reach) - 1,
      Math.round(y + 4 + Math.sin(angle) * 30 * reach),
      3,
      1,
      night ? '#718070' : '#D8CDA8',
    );
  }
}

// Each lobe is one stepped path of 2px rows, so fractional zoom never shows seams between rows.
function steppedLobe(
  ctx: Ctx,
  lobe: Lobe,
  fill: string,
  keep: (dy: number) => boolean = () => true,
) {
  const rows: { y: number; half: number }[] = [];
  for (let y = lobe.cy - lobe.ry; y < lobe.cy + lobe.ry; y += 2) {
    const dy = y + 1 - lobe.cy;
    const half = 2 * Math.round((lobe.rx * Math.sqrt(Math.max(0, 1 - (dy / lobe.ry) ** 2))) / 2);
    if (half > 0 && keep(dy)) rows.push({ y, half });
  }
  if (!rows.length) return;
  ctx.beginPath();
  rows.forEach(({ y, half }, i) => {
    if (i) ctx.lineTo(lobe.cx + half, y);
    else ctx.moveTo(lobe.cx + half, y);
    ctx.lineTo(lobe.cx + half, y + 2);
  });
  for (let i = rows.length - 1; i >= 0; i--) {
    ctx.lineTo(lobe.cx - rows[i].half, rows[i].y + 2);
    ctx.lineTo(lobe.cx - rows[i].half, rows[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

type ForkOptions = {
  x: number;
  y: number;
  /** The plot's depth, plot.x + plot.y. */
  depth: number;
  register: LanternRegister;
  /** How many lanterns are lit, in register order. */
  lit: number;
  taleId?: string;
  night: boolean;
  leaf: string;
  leafLight: string;
  /** The Fork stays evergreen; a season only adds blossom, a few turned leaves or snow. */
  season?: TownSeason;
};

// The Fork keeps the middle of the town's schedules: it flowers through early spring, and a few
// of its leaves turn in the second half of autumn.
const FORK_SEASON_SEED = 0.5;
function forkYear(season: TownSeason) {
  const leafy = canopyAt(season.yearDay, FORK_SEASON_SEED, 'deciduous');
  return {
    blossom: canopyAt(season.yearDay, FORK_SEASON_SEED, 'blossom').blossom,
    // The turned dapples go green again as the town's other trees go bare.
    turned: leafy.deepen * (1 - leafy.dormant),
    snow: leafy.snow,
  };
}

function drawTree(ctx: Ctx, o: ForkOptions) {
  const { night, season } = o;
  // The canopy stays evergreen so the lanterns always hang in leaves. The year only lends it
  // a little blossom, a few dapples that turn late in autumn, and snow on the lobes' tops.
  const year = season && forkYear(season);
  const bark = night ? '#5C5446' : '#8A6F4E',
    barkLight = night ? '#6E6452' : '#A88B63',
    barkDark = night ? '#463F36' : '#6F583D';
  ctx.beginPath();
  ctx.ellipse(6, 3, 58, 15, 0, 0, Math.PI * 2);
  ctx.fillStyle = night ? '#0B171530' : '#23341B2A';
  ctx.fill();
  rect(ctx, -14, -3, 8, 5, bark);
  rect(ctx, 7, -3, 9, 5, bark);
  ctx.beginPath();
  ctx.moveTo(-9, 2);
  ctx.lineTo(9, 2);
  ctx.lineTo(6, -42);
  ctx.lineTo(-6, -42);
  ctx.closePath();
  ctx.fillStyle = bark;
  ctx.fill();
  rect(ctx, -6, -42, 4, 44, barkLight);
  rect(ctx, 4, -40, 3, 42, barkDark);
  // Two limbs split from the trunk: the left towards the founders, the right towards the
  // crown, with a short east limb carrying the newer lanterns.
  // Each bough is a run of overlapping squares [x, y, size] with a lit top edge.
  const boughs = [
    [-6, -44, 9],
    [-11, -50, 9],
    [-16, -56, 9],
    [-21, -62, 9],
    [-26, -67, 9],
    [-31, -72, 9],
    [6, -46, 9],
    [10, -53, 9],
    [14, -60, 9],
    [18, -67, 9],
    [22, -74, 9],
    [25, -81, 9],
    [26, -74, 7],
    [33, -74, 7],
    [40, -74, 7],
    [47, -75, 7],
  ];
  for (const [cx, cy, w] of boughs) {
    const left = cx - Math.floor(w / 2),
      top = cy - Math.floor(w / 2);
    rect(ctx, left, top, w, w, bark);
    rect(ctx, left, top, w, 2, barkLight);
  }
  for (const lobe of [FORK_LOBES.left, FORK_LOBES.east, FORK_LOBES.crown]) {
    steppedLobe(ctx, lobe, o.leaf);
    steppedLobe(ctx, lobe, tint(o.leaf, -12), (dy) => dy > 0.45 * lobe.ry);
    for (const dapple of DAPPLES)
      if (dapple.lobe === lobe) rect(ctx, dapple.x, dapple.y, 4, 2, tint(o.leaf, -14));
    steppedLobe(
      ctx,
      {
        cx: Math.round(lobe.cx - 0.28 * lobe.rx),
        cy: Math.round(lobe.cy - 0.32 * lobe.ry),
        rx: 0.55 * lobe.rx,
        ry: 0.5 * lobe.ry,
      },
      o.leafLight,
    );
    rect(
      ctx,
      Math.round(lobe.cx - 0.45 * lobe.rx),
      Math.round(lobe.cy - 0.62 * lobe.ry),
      5,
      3,
      tint(o.leafLight, 14),
    );
    if (!year) continue;
    DAPPLES.forEach((dapple, i) => {
      if (dapple.lobe !== lobe) return;
      // Pale pink blossom opens on one dapple in three, clear of the lanterns' cream.
      if (i % 3 === 0 && i / DAPPLES.length < year.blossom) {
        rect(ctx, dapple.x + 2, dapple.y, 2, 2, pick(BLOSSOM.deep, night));
        rect(ctx, dapple.x + 1, dapple.y - 1, 2, 2, pick(BLOSSOM.pink, night));
      }
      // One dapple in four turns ochre or russet late in autumn; the canopy stays green.
      if (i % 4 === 1 && year.turned > 0) {
        const autumn = i % 8 === 1 ? FOLIAGE.russet : FOLIAGE.ochre;
        const from = tint(o.leaf, -14);
        rect(ctx, dapple.x, dapple.y, 4, 2, mixHex(from, pick(autumn.leaf, night), year.turned));
      }
    });
    if (year.snow > 0) {
      const alpha = ctx.globalAlpha;
      ctx.globalAlpha = alpha * year.snow;
      steppedLobe(ctx, lobe, pick(SNOW.top, night), (dy) => dy < -0.7 * lobe.ry);
      ctx.globalAlpha = alpha;
    }
  }
  // A crowded tree softens each glow so a big town's canopy stays a canopy, not a blaze.
  const crowd = Math.min(1, Math.sqrt(32 / Math.max(1, o.register.total)));
  for (const entry of o.register.entries) {
    const slot = FORK_SLOTS[entry.slot];
    // A lantern without a slot is not drawn; the register in the DOM still lists it.
    if (!slot) continue;
    const { x, y, w, h } = slotBox(slot);
    const lit = entry.index < o.lit;
    const tale = entry.id === o.taleId;
    // A one-pixel hanger ties each lantern to the bough above it.
    rect(ctx, x + w - 2, y - 1, 1, 1, night ? LIGHT.capNight : LIGHT.cap);
    rect(ctx, x, y, w, 1, night ? LIGHT.capNight : LIGHT.cap);
    rect(
      ctx,
      x,
      y + 1,
      w,
      h - 1,
      lit ? LIGHT.lit : night ? LIGHT.unlitNight : LIGHT.paper[entry.slot % 3],
    );
    if (lit) {
      rect(ctx, x + w - 2, y + h - 2, 1, 1, LIGHT.core);
      const large = slot.size === 'large';
      drawGlow(
        ctx,
        x + w / 2,
        y + (h + 1) / 2,
        tale ? 13 : large ? 10 : 7,
        (tale ? 0.7 : large ? 0.55 : 0.45) * crowd,
      );
    }
    if (tale) {
      rect(ctx, x + w, y + 2, 1, 1, LIGHT.tagString);
      rect(ctx, x + w, y + 3, 2, 3, LIGHT.tag);
    }
    if (entry.id === o.register.newest) {
      const pennant = night ? LIGHT.pennantNight : LIGHT.pennant;
      rect(ctx, x - 2, y - 1, 2, 1, pennant);
      rect(ctx, x + w, y - 1, 2, 1, pennant);
      rect(ctx, x + 1, y - 1, 1, 1, pennant);
    }
  }
}

function drawPlaque(ctx: Ctx, night: boolean, season?: TownSeason) {
  for (const px of [-6, 40]) {
    rect(ctx, px, 34, 4, 8, night ? '#6E7560' : '#927B59');
    rect(ctx, px, 34, 1, 8, night ? '#919274' : '#B8A078');
  }
  drawVenueTitle(ctx, {
    x: 20,
    y: 14,
    width: 84,
    height: 20,
    title: 'forktown.',
    fontSize: 12,
    night,
  });
  // Two small pumpkins keep the plaque company from mid autumn until the first snow, taken in
  // before the snow settles on the Fork itself.
  if (season && pumpkinOut(season.yearDay, 0.2)) {
    rect(ctx, -14, 38, 7, 4, pick(PUMPKIN.body, night));
    rect(ctx, -13, 37, 5, 6, pick(PUMPKIN.body, night));
    rect(ctx, -11, 38, 1, 4, pick(PUMPKIN.rib, night));
    rect(ctx, -11, 35, 2, 2, pick(PUMPKIN.stem, night));
  }
  if (season && pumpkinOut(season.yearDay, 0.45)) {
    rect(ctx, 47, 39, 5, 3, pick(PUMPKIN.body, night));
    rect(ctx, 48, 38, 3, 5, pick(PUMPKIN.body, night));
    rect(ctx, 49, 39, 1, 3, pick(PUMPKIN.rib, night));
    rect(ctx, 49, 36, 1, 2, pick(PUMPKIN.stem, night));
  }
}

/**
 * The Lantern Fork as two depth objects. Residents only walk road-tile centres, so walkers on
 * the back roads (depth <= plot + 25.5 on D3) pass behind the tree at +0.5, and walkers on the
 * front roads (>= 27.5) pass in front of the plaque at +1.3.
 */
export function drawLanternFork(ctx: Ctx, o: ForkOptions) {
  const at = (paint: () => void) => () => {
    ctx.save();
    ctx.translate(o.x, o.y);
    paint();
    ctx.restore();
  };
  return [
    { depth: o.depth + 0.5, paint: at(() => drawTree(ctx, o)) },
    { depth: o.depth + 1.3, paint: at(() => drawPlaque(ctx, o.night, o.season)) },
  ];
}
