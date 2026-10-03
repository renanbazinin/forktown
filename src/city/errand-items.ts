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
// Each object is held by its own physical rim, handle or sides. They no longer share a crate.
const GRIPS: Record<ErrandKind, readonly [Point, Point]> = {
  seedlings: [
    { x: -6, y: -2 },
    { x: 6, y: -2 },
  ],
  lemonade: [
    { x: -4, y: -4 },
    { x: 6, y: -8 },
  ],
  harvest: [
    { x: -6, y: -4 },
    { x: 6, y: -4 },
  ],
  thermos: [
    { x: -3, y: -4 },
    { x: 4, y: -9 },
  ],
};

/** The item's base on the ground, relative to the resident's projected feet. Both the town's
 * stationary props and the figure's handoff use this anchor, including its far-side depth. */
export function errandGroundOffset(scale = 1.25): Point {
  return { x: 9 * scale, y: -2 * scale };
}

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
  const anchor = {
    // Held beside the chest: back-facing hair and shoulders cannot swallow its silhouette.
    x: Math.round(groundX + (8 - groundX) * lift),
    y: Math.round(groundY + (-5 + bodyBob - groundY) * lift),
  };
  const [far, near] = GRIPS[errand.kind];
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

/** Small, distinct silhouettes before fine detail: leafy pots, a handled pitcher, a rounded
 * harvest basket and an insulated flask. Bases sit at y=0, inside x=−7…8 and y=−17…0, so the
 * ground handoff and existing resident bounds agree. All the pixel previews use this same art. */
export function drawErrandItem(ctx: Ctx, kind: ErrandKind, x: number, y: number, night = false) {
  const ink = (color: string) => (night ? tint(color, NIGHT_DIM) : color);
  const box = (dx: number, dy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = ink(color);
    ctx.fillRect(x + dx, y + dy, w, h);
  };
  if (kind === 'seedlings') {
    // Two separate terracotta pots with a clear gap; broad paired leaves survive town zoom.
    for (const [pot, height] of [
      [-4, 0],
      [3, -2],
    ]) {
      box(pot - 2, -6, 5, 4, '#874F37');
      box(pot - 1, -5, 3, 4, '#C9774B');
      box(pot - 3, -7, 7, 2, '#F0AE70');
      box(pot - 2, -7, 5, 1, '#644831');
      box(pot - 1, -4, 1, 2, '#EBA775');
      box(pot, -12 + height, 1, 6 - height, '#3D6334');
      box(pot - 3, -13 + height, 3, 3, '#3F733C');
      box(pot - 2, -13 + height, 2, 2, '#93BB55');
      box(pot + 1, -15 + height, 3, 3, '#3F733C');
      box(pot + 1, -15 + height, 2, 2, '#B6D475');
    }
    box(-7, -2, 15, 1, '#BE9861');
    box(-6, -1, 13, 1, '#625139');
  } else if (kind === 'lemonade') {
    // An open, generous handle and projecting spout distinguish a pitcher from a bottle.
    box(3, -12, 4, 2, '#696843');
    box(6, -11, 2, 7, '#696843');
    box(3, -5, 4, 2, '#696843');
    box(4, -11, 2, 1, '#FFF2CD');
    box(6, -10, 1, 5, '#FFF2CD');
    box(4, -5, 2, 1, '#FFF2CD');
    box(-4, -13, 8, 12, '#716B3F');
    box(-5, -11, 10, 8, '#716B3F');
    box(-4, -11, 8, 8, '#F4CF4E');
    box(-3, -13, 6, 4, '#FFF0B3');
    box(-3, -3, 6, 2, '#E2AB32');
    box(-2, -1, 4, 1, '#716B3F');
    box(-3, -10, 1, 6, '#FFF8DD');
    box(-7, -14, 5, 2, '#716B3F');
    box(-6, -14, 4, 1, '#FFF4D3');
    box(-4, -15, 8, 2, '#FFF4D3');
    box(-3, -15, 6, 1, '#716B3F');
    // A large lemon slice, rather than illegible label marks.
    box(-1, -8, 3, 5, '#FFF6C9');
    box(-2, -7, 5, 3, '#FFF6C9');
    box(-1, -7, 3, 3, '#E8B42A');
    box(0, -7, 1, 3, '#FFF6C9');
  } else if (kind === 'harvest') {
    box(-4, -17, 9, 1, '#715139');
    box(-6, -16, 2, 2, '#715139');
    box(5, -16, 2, 2, '#715139');
    box(-7, -14, 1, 9, '#715139');
    box(7, -14, 1, 9, '#715139');
    // A broad squat pumpkin fills the basket. Its rounded shoulders remain above the rim;
    // a single small bunch of greens stays to one side, separate from the pumpkin's stem.
    box(5, -12, 2, 7, '#D29A45');
    box(4, -14, 2, 3, '#527D3C');
    box(6, -15, 2, 3, '#91B650');
    box(-3, -14, 6, 10, '#A45C2E');
    box(-5, -13, 10, 8, '#A45C2E');
    box(-6, -11, 12, 4, '#A45C2E');
    box(-4, -12, 8, 6, '#E88F2D');
    box(-5, -10, 10, 3, '#E88F2D');
    box(-2, -13, 5, 8, '#F7B447');
    box(0, -12, 1, 6, '#D57927');
    box(-1, -16, 2, 3, '#49683A');
    // The basket has rounded corners and a woven front, never the seedling tray's flat base.
    box(-7, -6, 15, 3, '#705039');
    box(-6, -3, 13, 2, '#705039');
    box(-5, -1, 11, 1, '#705039');
    box(-6, -5, 13, 2, '#D3A063');
    box(-5, -3, 11, 2, '#AA7547');
    box(-4, -3, 3, 1, '#E8BC7B');
    box(2, -2, 3, 1, '#E8BC7B');
    box(-6, -6, 13, 1, '#E8BC7B');
  } else {
    // A narrow, handle-free insulated flask: stepped shoulders and a screw-on cup-cap.
    // Its closed lid never steams, and cannot be mistaken for the summer pitcher's open mouth.
    box(-2, -15, 5, 3, '#35535A');
    box(-3, -13, 7, 12, '#35535A');
    box(-2, -12, 5, 10, '#47858F');
    box(-2, -12, 2, 9, '#8BC6BF');
    box(2, -12, 1, 10, '#346770');
    box(-2, -1, 5, 1, '#35535A');
    box(-4, -17, 9, 3, '#788B7C');
    box(-3, -17, 7, 2, '#FFF0CE');
    box(-2, -17, 2, 2, '#FFFBE6');
    box(-2, -4, 5, 1, '#E4C684');
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
