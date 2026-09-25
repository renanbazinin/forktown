import { drawGlow, LIGHT } from './glow';
import { SNOW, pick } from './season-palette';

type Ctx = CanvasRenderingContext2D;

/**
 * World px from a plot centre, left of where the front path starts. The stake stands where
 * the lantern post will stand: houses draw their post at local (-48, 15) under drawHouse's
 * 1.12 scale, which lands on this same spot.
 */
export const POST_OFFSET = { x: -54, y: 17 };

export type HouseLantern = { lit: boolean; tale?: boolean; newest?: boolean };

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

/**
 * A house's own lantern, in house-local coordinates; it lights with its lantern on the Fork.
 * `snow` is the house's own winter snow, 0..1, which settles on the crook.
 */
export function drawLanternPost(ctx: Ctx, lantern: HouseLantern, night: boolean, snow = 0) {
  const wood = night ? '#4A4538' : '#6F5A3C';
  rect(ctx, -49, 14, 4, 1, night ? '#0B171540' : '#23341B30');
  rect(ctx, -48, 1, 1, 14, wood);
  // A crook reaches right and the lantern hangs from its hook, as on the mark.
  rect(ctx, -48, 1, 4, 1, wood);
  if (snow > 0) {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * snow;
    rect(ctx, -48, 0, 4, 1, pick(SNOW.top, night));
    ctx.globalAlpha = alpha;
  }
  rect(ctx, -45, 2, 1, 1, wood);
  rect(ctx, -46, 3, 3, 1, night ? LIGHT.capNight : LIGHT.cap);
  rect(ctx, -46, 4, 3, 3, lantern.lit ? LIGHT.lit : night ? LIGHT.unlitNight : LIGHT.paper[0]);
  if (lantern.lit) {
    rect(ctx, -45, 5, 1, 1, LIGHT.core);
    drawGlow(ctx, -44.5, 5.5, lantern.tale ? 11 : 8, lantern.tale ? 0.7 : 0.55);
  }
  if (lantern.tale) {
    rect(ctx, -43, 6, 1, 1, LIGHT.tagString);
    rect(ctx, -43, 7, 2, 3, LIGHT.tag);
  }
  if (lantern.newest) {
    // The welcome pennant flies above the post until the next neighbor moves in.
    rect(ctx, -48, -7, 1, 8, wood);
    ctx.beginPath();
    ctx.moveTo(-49, -7);
    ctx.lineTo(-55, -5);
    ctx.lineTo(-49, -3);
    ctx.closePath();
    ctx.fillStyle = night ? LIGHT.pennantNight : LIGHT.pennant;
    ctx.fill();
    rect(ctx, -51, -6, 2, 1, night ? LIGHT.pennantHiNight : LIGHT.pennantHi);
  }
}

/** An empty plot's promise: a blank-tagged stake with a sprout, waiting for its lantern. */
export function drawSproutStake(ctx: Ctx, x: number, y: number, night: boolean, seed: number) {
  const bx = x + POST_OFFSET.x,
    by = y + POST_OFFSET.y,
    h = 9 + (seed % 3);
  rect(ctx, bx - 1, by, 5, 1, night ? '#0B171540' : '#23341B30');
  rect(ctx, bx, by - h, 2, h, night ? '#6E6452' : '#9A7B55');
  rect(ctx, bx, by - h, 1, h, night ? '#7F7560' : '#B89A6E');
  rect(ctx, bx + 2, by - h + 2, 5, 3, night ? '#8C8A74' : '#E9DDBB');
  rect(ctx, bx, by - h - 3, 1, 3, night ? '#3E6150' : '#5E8A4E');
  rect(ctx, bx - 3, by - h - 4, 3, 2, night ? '#507569' : '#87A66A');
  // The right leaf sits higher, as the lantern tip does on the mark.
  rect(ctx, bx + 1, by - h - 5, 3, 2, night ? '#5E8377' : '#95B478');
}
