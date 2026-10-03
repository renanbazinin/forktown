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

/** The item's base on the ground, relative to the resident's projected feet. Both the town's
 * stationary props and the figure's handoff use this anchor, including its far-side depth. */
export function errandGroundOffset(scale = 1.25): Point {
  return { x: 9 * scale, y: -2 * scale };
}

export type ErrandItemPose = {
  /** Local figure pixels before its left/right mirror. The anchor is the item's base centre. */
  anchor: Point;
  /** Hands meet these exact two points on the carrier's handles. */
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
  const anchor = {
    x: Math.round(groundX + (5 - groundX) * lift),
    y: Math.round(groundY + (-5 + bodyBob - groundY) * lift),
  };
  return {
    anchor,
    farGrip: { x: anchor.x - 3, y: anchor.y - 5 },
    nearGrip: { x: anchor.x + 3, y: anchor.y - 5 },
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

/** Original pixel props. Their bases sit at y=0; both hand contacts are (−3,−5) and (3,−5).
 * A shallow carrier keeps even a bottle supported by two hands, with no detached decoration. */
export function drawErrandItem(ctx: Ctx, kind: ErrandKind, x: number, y: number, night = false) {
  const ink = (color: string) => (night ? tint(color, NIGHT_DIM) : color);
  const box = (dx: number, dy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = ink(color);
    ctx.fillRect(x + dx, y + dy, w, h);
  };
  const wood = kind === 'seedlings' ? '#A97251' : '#AE8658';
  const edge = kind === 'seedlings' ? '#C98E66' : '#D0AB71';
  box(-4, -4, 9, 3, wood);
  box(-3, -1, 7, 1, '#866447');
  box(-5, -5, 11, 1, edge);
  // Two short side handles: the supporting fingers cover their outside ends.
  box(-4, -6, 2, 2, edge);
  box(2, -6, 2, 2, edge);
  box(-3, -3, 1, 2, edge);
  box(0, -3, 1, 2, edge);
  box(3, -3, 1, 2, edge);
  if (kind === 'seedlings') {
    box(-3, -6, 7, 1, '#665444');
    for (const stem of [-2, 2]) {
      box(stem, -9, 1, 4, '#6B8D57');
      box(stem - 2, -9, 2, 1, '#92B76D');
      box(stem + 1, -10, 2, 1, '#6F9A5B');
    }
  } else if (kind === 'lemonade') {
    box(-2, -11, 4, 7, '#E8CD77');
    box(-2, -11, 4, 1, '#F6E7B3');
    box(2, -9, 2, 4, '#F6E7B3');
    box(2, -8, 1, 2, '#9A7B51');
    box(-1, -10, 1, 5, '#F5E4A7');
    box(-2, -12, 4, 1, '#82956A');
    box(-3, -5, 2, 1, '#E4AE59');
    box(2, -5, 2, 1, '#DAB663');
  } else if (kind === 'harvest') {
    box(-3, -7, 4, 3, '#C58244');
    box(-2, -8, 2, 1, '#DDA455');
    box(-1, -9, 1, 2, '#6C8052');
    box(1, -7, 3, 3, '#B96456');
    box(2, -8, 1, 2, '#7F9459');
    box(-2, -6, 1, 2, '#E2AE61');
  } else {
    box(-2, -11, 5, 7, '#638D87');
    box(-2, -12, 5, 2, '#E5DECB');
    box(-1, -9, 1, 4, '#A0B9A9');
    box(2, -10, 1, 6, '#496C68');
    box(-2, -5, 5, 1, '#476C65');
  }
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
