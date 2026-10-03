import type { ErrandKind, ErrandVisual } from '../lib/seasonal-errands';
import type { ResidentState } from '../lib/simulation';
import { tint } from './houses';

type Facing = ResidentState['facing'];
type Ctx = CanvasRenderingContext2D;
type Point = { x: number; y: number };
const NIGHT_DIM = -35;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
const isLeft = (facing: Facing) => facing === 'sw' || facing === 'nw';
const isBack = (facing: Facing) => facing === 'ne' || facing === 'nw';

/**
 * Each object as a pixel map. Column 0 is x = −5 and the last row sits on the ground (y = −1),
 * so every item fits x = −5…5 and y = −13…−1. A '.' is left clear. Objects are about as wide as
 * the figure's shoulders and stop below its eyes, so the carrier still reads as a person.
 */
type Sprite = { rows: readonly string[]; colors: Readonly<Record<string, string>> };
const SPRITES: Record<ErrandKind, Sprite> = {
  // A shallow wooden seed tray: dark soil and three seedlings, the middle one tallest.
  seedlings: {
    colors: {
      o: '#6E4B2E',
      w: '#EBC98F',
      m: '#CC9659',
      d: '#A6713F',
      s: '#5B4330',
      g: '#3E7B3A',
      l: '#93CF58',
      L: '#C4E683',
      t: '#4E8A3C',
    },
    rows: [
      '...lL.Ll...',
      '.L.lgtgl.L.',
      'lgl..t..lgl',
      '.t...t...t.',
      '.sssssssss.',
      'owwwwwwwwwo',
      'ommdmmmdmmo',
      'odddddddddo',
      '.ooooooooo.',
    ],
  },
  // A glass pitcher, full to the brim, a lemon wheel and a mint leaf on its rim. Glass edges
  // and ice keep it from reading as a mug of anything else.
  lemonade: {
    colors: {
      k: '#5E7F7B',
      G: '#F2FBF6',
      y: '#F7DE6E',
      Y: '#FDF0B0',
      b: '#E6BD3E',
      c: '#FFFFFF',
      r: '#D9A514',
      P: '#FFF6B8',
      g: '#4F9A44',
    },
    rows: [
      '....grr....',
      '.....rPPr..',
      'kkkkkkrrk..',
      '.kGyyyykkk.',
      '.kGyyyyk..k',
      'kGyyccyyk.k',
      'kGyyccyyk.k',
      'kGyYyyyykk.',
      'kGyyyyyyk..',
      'kbyyyyyybk.',
      '.kbbbbbbk..',
      '..kkkkkk...',
    ],
  },
  // A round wicker basket under an arched handle: a pumpkin, red apples and a bunch of greens.
  harvest: {
    colors: {
      o: '#6B4A2E',
      h: '#B98547',
      P: '#E8862B',
      p: '#F7AE4C',
      q: '#C26520',
      s: '#5B6B2F',
      R: '#C8433A',
      r: '#EE7A5F',
      g: '#4F8A3A',
      l: '#8CC152',
      w: '#E2B97B',
      m: '#BE8A4D',
      d: '#94653A',
    },
    rows: [
      '...ooooo...',
      '..oh...ho..',
      '.oh..s..ho.',
      '.o..ppP..o.',
      '.o.pPPPq.ol',
      'rR.pPpPqglg',
      'RRrpPpPqgl.',
      'owwwwwwwwwo',
      'omdmdmdmdmo',
      '.odmdmdmdo.',
      '..ommmmmo..',
      '...ooooo...',
    ],
  },
  // An enamel mug of cocoa that still steams, beside a red flask with a cream cup-cap. The white
  // mug rides over the carrier's chest, the flask against the ground, so both stand out.
  thermos: {
    colors: {
      o: '#3B201E',
      R: '#C8463D',
      r: '#E8766A',
      c: '#EFE6CF',
      C: '#FFFFFF',
      W: '#F4ECD8',
      m: '#3F6F86',
      M: '#F6F2E8',
      h: '#7A4B32',
      S: '#FFFFFF',
    },
    rows: [
      '....S.occCo',
      '...S..occco',
      '..S.S..ooo.',
      '...S..oRrRo',
      '..S...oRrRo',
      '......oWWWo',
      '.mhhhmoRrRo',
      'mmMMMmoRrRo',
      'mmMMMmoRrRo',
      '.mmmmmoRRRo',
      '..mmm..ooo.',
    ],
  },
};

/** The item's base on the ground, relative to the resident's projected feet. Both the town's
 * stationary props and the figure's handoff use this anchor, including its far-side depth. */
export function errandGroundOffset(scale = 1.25): Point {
  return { x: 9 * scale, y: -2 * scale };
}

/** How each object is held once lifted, in the figure's local pixels before its mirror. `x`, `y`
 * place the object's base: in front at the waist, over the near side of the body. Walking away,
 * it rides further out past the near shoulder so the figure's back never hides it, and the near
 * hand takes its inner edge, keeping that arm off the object. Grips are relative to the base and
 * meet each object's own rim, handle or sides. */
type Hold = { x: number; y: number; far: Point; near: Point };
const HOLDS: Record<ErrandKind, { front: Hold; back: Hold }> = {
  seedlings: {
    front: { x: 4, y: -4, far: { x: -5, y: -3 }, near: { x: 6, y: -3 } },
    back: { x: 7, y: -4, far: { x: -5, y: -3 }, near: { x: -2, y: -3 } },
  },
  lemonade: {
    front: { x: 5, y: -3, far: { x: -5, y: -3 }, near: { x: 5, y: -8 } },
    back: { x: 7, y: -3, far: { x: -5, y: -3 }, near: { x: -2, y: -5 } },
  },
  harvest: {
    front: { x: 4, y: -3, far: { x: -5, y: -5 }, near: { x: 6, y: -5 } },
    back: { x: 7, y: -3, far: { x: -5, y: -5 }, near: { x: -2, y: -5 } },
  },
  thermos: {
    front: { x: 5, y: -3, far: { x: -5, y: -3 }, near: { x: 6, y: -5 } },
    back: { x: 7, y: -3, far: { x: -5, y: -3 }, near: { x: 1, y: -6 } },
  },
};

export type ErrandItemPose = {
  /** Local figure pixels before its left/right mirror. The anchor is the item's base centre. */
  anchor: Point;
  /** Hands meet the actual support points of this particular item. */
  farGrip: Point;
  nearGrip: Point;
  bodyBob: number;
  bend: number;
  grounded: boolean;
  armReach: number;
};

/** Pure, reversible handoff geometry. Time comes from the simulation; drawing never advances it.
 * The first pickup and last dropoff frame are precisely the stationary ground item's frame. */
export function errandItemPose(
  errand: ErrandVisual | undefined,
  facing: Facing,
  walkPhase = 0,
  moving = false,
): ErrandItemPose | undefined {
  if (!errand || errand.phase === 'outbound' || errand.phase === 'returning') return;
  const progress = clamp(errand.progress);
  const handling = errand.phase !== 'carrying';
  const lift =
    errand.phase === 'pickup'
      ? ease((progress - 0.2) / 0.6)
      : errand.phase === 'dropoff'
        ? 1 - ease((progress - 0.2) / 0.6)
        : 1;
  // Knees bend as the hands meet the object, then straighten while it is lifted. Reverse this
  // on delivery. A weight-bearing walker keeps the normal one-pixel body bob, never a loose arm.
  const bend = handling ? Math.round(3 * Math.sin(Math.PI * progress)) : 0;
  const bodyBob = handling
    ? bend
    : moving
      ? -Math.round(Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 0.8)
      : 0;
  // The item stays on one piece of ground while its collector turns. Convert that fixed
  // screen-side anchor into the figure's mirrored local coordinates before lifting it.
  const groundX = isLeft(facing) ? -9 : 9;
  const groundY = -2;
  const hold = HOLDS[errand.kind][isBack(facing) ? 'back' : 'front'];
  const anchor = {
    x: Math.round(groundX + (hold.x - groundX) * lift),
    y: Math.round(groundY + (hold.y + bodyBob - groundY) * lift),
  };
  const { far, near } = hold;
  return {
    anchor,
    farGrip: { x: anchor.x + far.x, y: anchor.y + far.y },
    nearGrip: { x: anchor.x + near.x, y: anchor.y + near.y },
    bodyBob,
    bend,
    grounded: lift === 0,
    armReach:
      errand.phase === 'pickup'
        ? ease((progress - 0.05) / 0.15)
        : errand.phase === 'dropoff'
          ? 1 - ease((progress - 0.8) / 0.15)
          : 1,
  };
}

/** An object's height in its own pixels, from 9 to 13; every one is 11 wide. */
export const errandItemHeight = (kind: ErrandKind) => SPRITES[kind].rows.length;

/** Paints one object with its base centre at (x, y), one fillRect per run of a colour. The town
 * prop, the carried object and the Events card's enlarged preview all use this same art. */
export function drawErrandItem(ctx: Ctx, kind: ErrandKind, x: number, y: number, night = false) {
  const { rows, colors } = SPRITES[kind];
  rows.forEach((row, index) => {
    const top = y - rows.length + index;
    for (let start = 0; start < row.length;) {
      const key = row[start];
      let end = start + 1;
      while (row[end] === key) end++;
      if (key !== '.') {
        ctx.fillStyle = night ? tint(colors[key], NIGHT_DIM) : colors[key];
        ctx.fillRect(x - 5 + start, top, end - start, 1);
      }
      start = end;
    }
  });
}

/** Town prop before pickup / after dropoff. X/Y are its base centre, not the resident's feet.
 * Keep it in the ordinary world depth pass; callers use errandGroundOffset for the handoff. */
export function drawGroundErrandItem(
  ctx: Ctx,
  kind: ErrandKind,
  groundX: number,
  groundY: number,
  night = false,
  scale = 1.25,
) {
  ctx.save();
  ctx.translate(groundX, groundY);
  ctx.scale(scale, scale);
  drawErrandItem(ctx, kind, 0, 0, night);
  ctx.restore();
}
