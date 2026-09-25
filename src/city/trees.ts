import {
  canopyAt,
  seedFraction,
  treeKind,
  type Canopy,
  type TownSeason,
  type TreeKind,
} from '../lib/seasons';
import { tint } from './houses';
import { BLOSSOM, FALLEN_LEAVES, FOLIAGE, mixHex, pick, SNOW, type Pair } from './season-palette';

type Ctx = CanvasRenderingContext2D;
/** The two leaf tones of the day or night palette, and which of the two it is. */
export type Foliage = { leaf: string; leafLight: string; night?: boolean };
type Swatch = { leaf: Pair; light: Pair };
/** Where a crown's autumn starts and where it ends up as the season deepens. */
export type Autumn = readonly [from: Swatch, to: Swatch];

function poly(ctx: Ctx, points: number[][], fill: string) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}
function diamond(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  poly(
    ctx,
    [
      [x, y - ry],
      [x + rx, y],
      [x, y + ry],
      [x - rx, y],
    ],
    fill,
  );
}

// Each broadleaf keeps its own autumn: gold, ochre deepening to russet, or russet ending rust.
export const AUTUMNS: readonly Autumn[] = [
  [FOLIAGE.ochre, FOLIAGE.ochre],
  [FOLIAGE.ochre, FOLIAGE.russet],
  [FOLIAGE.russet, FOLIAGE.rust],
];
const LARCH: Autumn = [FOLIAGE.larch, FOLIAGE.larch];
const BLOOMS: Pair[][] = [
  [BLOSSOM.pink, BLOSSOM.pink, BLOSSOM.deep],
  [BLOSSOM.white, BLOSSOM.white, BLOSSOM.pink],
  [BLOSSOM.pink, BLOSSOM.white, BLOSSOM.deep],
];
// Blossom spots on a round crown, mostly on its top ledges and lit side. Each tree starts from
// its own spot and steps through the list, so no two trees flower alike.
const BUDS = [
  [-3, -38],
  [-11, -34],
  [3, -37],
  [-16, -28],
  [-7, -30],
  [-1, -33],
  [-14, -22],
  [9, -34],
  [-5, -24],
  [2, -29],
  [15, -27],
  [-9, -18],
  [7, -22],
  [12, -16],
];
/** A bare broadleaf's trunk and two forked limbs, seen through its thinned crown. */
const LIMBS = [
  [-1, -24, 2, 12],
  [-5, -26, 4, 2],
  [-7, -32, 2, 6],
  [1, -28, 4, 2],
  [5, -34, 2, 6],
];
/** Snow resting on a conifer's boughs, just inside the upper slope of each tier: [x, y] of a
 * 2x2 on the shaded right; the lit left-hand side mirrors it. */
const BOUGHS = [
  [3, -36],
  [6, -31],
  [5, -27],
  [9, -21],
  [9, -14],
  [13, -9],
];
/** Bare limbs take the trunk's colour, dimmed at night so they don't glow inside the crown. */
export const LIMB: Pair = ['#867459', '#5C5446'];
type Schedule = { kind: TreeKind; s: number; autumn: Autumn; bloom: Pair[] };
// A tree's kind and schedule depend only on its seed, so each is worked out once.
const schedules = new Map<number, Schedule>();
function scheduleOf(variant: number): Schedule {
  let schedule = schedules.get(variant);
  if (!schedule) {
    const kind = treeKind(variant);
    schedule = {
      kind,
      s: seedFraction(`tree:${variant}`),
      autumn: kind === 'larch' ? LARCH : AUTUMNS[(variant >>> 7) % 3],
      bloom: BLOOMS[(variant >>> 15) % 3],
    };
    schedules.set(variant, schedule);
  }
  return schedule;
}
/** Where fallen petals and leaves settle, around the trunk on the tree's shadow. */
const LITTER = [
  [-10, 1],
  [9, 4],
  [-4, 5],
  [14, 0],
  [3, 7],
  [-14, 3],
];

/** One tone of a leafy crown on its day of the year: fresh in early spring, turning through its
 * autumn, then bare twigs. A summer canopy keeps `colour` exactly. */
export function leafTone(
  colour: string,
  key: keyof Swatch,
  night: boolean,
  autumn: Autumn,
  c: Canopy,
) {
  const [from, to] = autumn;
  const turned = mixHex(pick(from[key], night), pick(to[key], night), c.deepen);
  const fresh = mixHex(colour, pick(FOLIAGE.fresh[key], night), c.fresh);
  return mixHex(mixHex(fresh, turned, c.turn), pick(FOLIAGE.dormant[key], night), c.dormant);
}

/** Petals or leaves drifting down from the crown, looping on the town clock like chimney smoke. */
function drift(
  ctx: Ctx,
  minutes: number,
  variant: number,
  count: number,
  colours: readonly Pair[],
  night: boolean,
  tumble: boolean,
) {
  const alpha = ctx.globalAlpha;
  for (let k = 0; k < count; k++) {
    const lane = (variant >>> (4 + 5 * k)) % 26;
    const age = (minutes / 8 + lane / 26 + k / 3) % 1;
    const x = Math.round(-13 + lane + age * 7 + Math.sin(age * 9 + k) * 2),
      y = Math.round(-15 + age * 18);
    ctx.globalAlpha = alpha * Math.min(1, age * 8, (1 - age) * 6);
    // A leaf turns over as it falls; a petal just flutters.
    const flat = !tumble || Math.floor(age * 10) % 2 === 0;
    rect(ctx, x, y, flat ? 2 : 1, flat ? 1 : 2, pick(colours[k % colours.length], night));
  }
  ctx.globalAlpha = alpha;
}

// The town's own trees: a stepped round crown (even variants) or a pixel conifer (odd).
// Seasons are optional, so previews and tests without a season draw today's summer tree.
export function drawTownTree(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  p: Foliage,
  variant = 0,
  season?: TownSeason,
) {
  const conifer = variant % 2 === 1;
  const { kind, s: when, autumn, bloom } = scheduleOf(variant);
  const c = season && canopyAt(season.yearDay, when, kind);
  const night = !!p.night;
  const minutes = season?.minutes ?? 0;
  let leaves = p;
  if (c && kind !== 'evergreen') {
    const tone = (colour: string, key: keyof Swatch) => leafTone(colour, key, night, autumn, c);
    leaves = { leaf: tone(p.leaf, 'leaf'), leafLight: tone(p.leafLight, 'light') };
  }
  if (c && c.snow > 0 && conifer) {
    // Snow sifts into the needles too, so even a small pine reads as snowy from afar.
    leaves = {
      leaf: mixHex(leaves.leaf, pick(SNOW.shade, night), 0.2 * c.snow),
      leafLight: mixHex(leaves.leafLight, pick(SNOW.top, night), 0.32 * c.snow),
    };
  }
  let highlight = tint(leaves.leafLight, 14);
  if (c && c.blossom > 0) {
    // A tree in flower blushes on its lit side, and its bright tuft is the fullest clump.
    const flower = pick(bloom[0], night);
    leaves = { ...leaves, leafLight: mixHex(leaves.leafLight, flower, 0.2 * c.blossom) };
    highlight = mixHex(tint(leaves.leafLight, 14), flower, 0.45 * c.blossom);
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  diamond(ctx, 4, 3, 16, 7, '#23341B20');
  // Fallen petals and leaves lie on the grass behind the trunk until the first snow covers them.
  const litter = c ? (c.petals > 0 ? c.petals : c.leaves * (1 - c.snow)) : 0;
  if (c && litter > 0) {
    const count = Math.round(litter * (kind === 'larch' ? 3 : 4));
    for (let k = 0; k < count; k++) {
      const [lx, ly] = LITTER[(variant + k) % LITTER.length];
      const colour =
        c.petals > 0
          ? bloom[k % 2 ? 2 : 0]
          : kind === 'larch'
            ? FALLEN_LEAVES[2 - (k % 2) * 2]
            : FALLEN_LEAVES[(variant + k) % FALLEN_LEAVES.length];
      rect(ctx, lx, ly, 2, 1, pick(colour, night));
    }
  }
  rect(ctx, -2, -12, 4, 15, '#867459');
  // A bare crown is only a haze of twigs: its branches show through and the sky behind it too.
  const bare = c ? c.dormant : 0;
  const alpha = ctx.globalAlpha;
  if (bare > 0) {
    const limb = pick(LIMB, night);
    if (conifer) rect(ctx, -1, -38, 2, 27, limb);
    else for (const [bx, by, bw, bh] of LIMBS) rect(ctx, bx, by, bw, bh, limb);
    ctx.globalAlpha = alpha * (1 - 0.45 * bare);
  }
  if (conifer) {
    poly(
      ctx,
      [
        [0, -43],
        [10, -28],
        [6, -28],
        [15, -15],
        [10, -15],
        [18, -4],
        [-18, -4],
        [-10, -15],
        [-15, -15],
        [-6, -28],
        [-10, -28],
      ],
      leaves.leaf,
    );
    poly(
      ctx,
      [
        [0, -43],
        [0, -4],
        [-18, -4],
        [-10, -15],
        [-15, -15],
        [-6, -28],
        [-10, -28],
      ],
      leaves.leafLight,
    );
  } else {
    poly(
      ctx,
      [
        [-5, -39],
        [7, -39],
        [7, -35],
        [14, -35],
        [14, -29],
        [19, -29],
        [19, -16],
        [14, -16],
        [14, -10],
        [-12, -10],
        [-12, -14],
        [-18, -14],
        [-18, -29],
        [-13, -29],
        [-13, -35],
        [-5, -35],
      ],
      leaves.leaf,
    );
    poly(
      ctx,
      [
        [-5, -39],
        [7, -39],
        [7, -35],
        [4, -35],
        [4, -28],
        [-3, -28],
        [-3, -19],
        [-13, -19],
        [-13, -24],
        [-18, -24],
        [-18, -29],
        [-13, -29],
        [-13, -35],
        [-5, -35],
      ],
      leaves.leafLight,
    );
    rect(ctx, -7, -31, 5, 4, highlight);
  }
  ctx.globalAlpha = alpha;
  if (!c) {
    ctx.restore();
    return;
  }
  if (c.blossom > 0) {
    // Flowers open a few at a time, up to four to seven clumps on each tree, each with a
    // deeper edge on its shaded side.
    const count = Math.round(c.blossom * (4 + ((variant >>> 9) % 4))),
      first = (variant >>> 20) % BUDS.length;
    for (let k = 0; k < count; k++) {
      const [bx, by] = BUDS[(first + k * 3) % BUDS.length];
      rect(ctx, bx + 1, by + 1, 2, 2, pick(bloom[2], night));
      rect(ctx, bx, by, 2, 2, pick(bloom[k % 2], night));
    }
  }
  if (c.snow > 0) {
    // Snow rests on the upward ledges: bright on the lit side, a cooler shade on the far side.
    const top = pick(SNOW.top, night),
      shade = pick(SNOW.shade, night);
    ctx.globalAlpha = alpha * c.snow;
    if (conifer) {
      // A cap on the tip, then snow resting along each tier's exposed boughs.
      rect(ctx, -1, -43, 2, 2, top);
      rect(ctx, -2, -41, 4, 2, top);
      // Bough snow only where it can be seen: on the larger trees at the edge of town, and not
      // on a larch that has dropped its needles. The small inner pines show it in their tint.
      if (s >= 0.8 && bare < 1)
        for (const [bx, by] of BOUGHS) {
          rect(ctx, -bx - 2, by, 2, 2, top);
          rect(ctx, bx, by, 2, 2, shade);
        }
    } else {
      rect(ctx, -5, -39, 12, 2, top);
      rect(ctx, -13, -35, 8, 2, top);
      rect(ctx, 7, -35, 7, 2, shade);
      rect(ctx, -18, -29, 5, 2, top);
      rect(ctx, 14, -29, 5, 2, shade);
    }
    ctx.globalAlpha = alpha;
  }
  if (c.petalFall > 0)
    drift(ctx, minutes, variant, Math.ceil(c.petalFall * 3), bloom, night, false);
  else if (c.leafFall > 0 && kind !== 'larch')
    drift(ctx, minutes, variant, Math.ceil(c.leafFall * 2), FALLEN_LEAVES, night, true);
  ctx.restore();
}
