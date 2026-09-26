import {
  ZOO_GROUND,
  ZOO_HABITATS,
  ZOO_CENTER,
  ZOO_ENTRANCE,
  ZOO_VENUE,
  zooAnimalsAt,
  zooPond,
  zooTree,
} from '../lib/zoo';
import { project, TILE_W, type Point } from '../lib/world';
import { canopyAt, seedFraction, type TownSeason } from '../lib/seasons';
import { tint } from './houses';
import { BLOSSOM, FALLEN_LEAVES, mixHex, pick, SNOW } from './season-palette';
import { AUTUMNS, leafTone, LIMB } from './trees';
import { drawVenueTitle } from './venue-title';

type Ctx = CanvasRenderingContext2D;
type Object = { depth: number; paint: () => void };
// Inset the entire raised plaque from the street, including its upper corners.
export const ZOO_SIGN = {
  point: { x: ZOO_ENTRANCE.x, y: ZOO_GROUND.top + 1.3 },
  width: 170,
  height: 34,
  rise: 40,
};
export const ZOO_SIGN_DEPTH = ZOO_SIGN.point.x + ZOO_SIGN.point.y + ZOO_SIGN.width / TILE_W;
export function zooSignHit(point: Point) {
  const gate = project(ZOO_SIGN.point.x, ZOO_SIGN.point.y);
  const x = point.x - gate.x;
  const y = point.y - gate.y - x * 0.5;
  return (
    x >= -ZOO_SIGN.width / 2 &&
    x <= ZOO_SIGN.width / 2 &&
    y >= -ZOO_SIGN.rise &&
    y <= -ZOO_SIGN.rise + ZOO_SIGN.height
  );
}
function ground(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  const corners = [project(x, y), project(x + w, y), project(x + w, y + h), project(x, y + h)];
  ctx.fillStyle = color;
  ctx.beginPath();
  corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
}
function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function fence(ctx: Ctx, from: Point, to: Point, night: boolean) {
  const count = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 0.65);
  const a = project(from.x, from.y),
    b = project(to.x, to.y);
  ctx.strokeStyle = night ? '#647C6D' : '#9A8864';
  ctx.lineWidth = 2;
  for (const rise of [7, 17]) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - rise);
    ctx.lineTo(b.x, b.y - rise);
    ctx.stroke();
  }
  for (let i = 0; i <= count; i++) {
    const p = project(
      from.x + ((to.x - from.x) * i) / count,
      from.y + ((to.y - from.y) * i) / count,
    );
    box(ctx, p.x - 2, p.y - 22, 4, 23, night ? '#70816C' : '#A8916D');
    box(ctx, p.x - 2, p.y - 23, 4, 3, night ? '#A3AF8A' : '#D0C09A');
  }
}
// Blossom clumps on a flowering zoo tree, [x, y, pink]: the top first, then the lower leaves.
const ZOO_BUDS = [
  [-9, -55, 0],
  [-15, -46, 1],
  [4, -53, 1],
  [-4, -42, 0],
  [11, -45, 1],
];
// The zoo's trees keep the town's year; the giraffe's acacia stays green and only takes snow.
const zooSeeds = new Map<string, number>();
function tree(ctx: Ctx, point: Point, night: boolean, acacia = false, season?: TownSeason) {
  const p = project(point.x, point.y);
  const key = `zoo-tree:${point.x},${point.y}`;
  const seed = zooSeeds.get(key) ?? zooSeeds.set(key, seedFraction(key)).get(key)!;
  const c =
    season &&
    canopyAt(season.yearDay, seed, acacia ? 'evergreen' : seed < 0.5 ? 'blossom' : 'deciduous');
  let leaves = night ? '#4B7362' : '#6F965A',
    crown = night ? '#63876B' : '#91AC68',
    light = night ? '#76936D' : '#B0BF7F';
  if (c && !acacia) {
    const autumn = AUTUMNS[Math.floor(seed * 30) % 3];
    leaves = leafTone(leaves, 'leaf', night, autumn, c);
    crown = leafTone(crown, 'light', night, autumn, c);
    // The sunlit patch stays a step brighter than the crown once it has turned or gone bare.
    light = mixHex(
      leafTone(light, 'light', night, autumn, c),
      tint(crown, 14),
      Math.max(c.turn, c.dormant),
    );
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  if (acacia) ctx.scale(1.5, 1.5);
  p.x = 0;
  p.y = 0;
  // Fallen leaves settle by the trunk.
  if (c && c.leaves > 0.3) {
    box(ctx, p.x - 11, p.y + 1, 2, 1, pick(FALLEN_LEAVES[0], night));
    box(ctx, p.x + 7, p.y + 3, 2, 1, pick(FALLEN_LEAVES[1], night));
  }
  box(ctx, p.x - 3, p.y - 38, 6, 38, '#8B795C');
  const half = acacia ? 29 : 17,
    upper = acacia ? 20 : 12,
    top = acacia ? 42 : 24;
  // Bare like the town's trees: the limbs show through a thinned crown.
  const bare = c && !acacia ? c.dormant : 0,
    alpha = ctx.globalAlpha;
  if (bare > 0) {
    const limb = pick(LIMB, night);
    box(ctx, p.x - 1, p.y - 52, 2, 16, limb);
    box(ctx, p.x - 9, p.y - 48, 8, 2, limb);
    box(ctx, p.x - 11, p.y - 55, 2, 7, limb);
    box(ctx, p.x + 1, p.y - 51, 8, 2, limb);
    box(ctx, p.x + 8, p.y - 57, 2, 6, limb);
    ctx.globalAlpha = alpha * (1 - 0.45 * bare);
  }
  box(ctx, p.x - half, p.y - 49, half * 2, 16, leaves);
  box(ctx, p.x - upper, p.y - 58, top, 15, crown);
  box(ctx, p.x - 13, p.y - 57, 18, 5, light);
  ctx.globalAlpha = alpha;
  if (c && c.blossom > 0) {
    // A few clumps of blossom open along the lit edges.
    for (const [bx, by, k] of ZOO_BUDS.slice(0, Math.round(c.blossom * ZOO_BUDS.length)))
      box(ctx, p.x + bx, p.y + by, 2, 2, pick(k ? BLOSSOM.pink : BLOSSOM.white, night));
  }
  if (c && c.snow > 0) {
    // A line of snow along the top, and on the ledges where the lower leaves stick out.
    ctx.globalAlpha *= c.snow;
    box(ctx, p.x - upper, p.y - 58, top, 2, pick(SNOW.top, night));
    box(ctx, p.x - half, p.y - 49, half - upper, 2, pick(SNOW.top, night));
    box(ctx, p.x + top - upper, p.y - 49, half + upper - top, 2, pick(SNOW.shade, night));
  }
  ctx.restore();
}
function sign(ctx: Ctx, point: Point, text: string, night: boolean, small = false) {
  const p = project(point.x, point.y),
    width = small ? 138 : ZOO_SIGN.width;
  ctx.save();
  // Follow the north fence's isometric angle instead of spanning the street.
  if (!small) {
    ctx.transform(1, 0.5, 0, 1, p.x, p.y);
    p.x = 0;
    p.y = 0;
  }
  for (const side of [-1, 1]) {
    const x = p.x + side * (width / 2 - 15);
    box(ctx, x - 3, p.y - 30, 6, 30, night ? '#6E7560' : '#927B59');
    box(ctx, x - 3, p.y - 30, 2, 30, night ? '#919274' : '#B8A078');
    box(ctx, x - 5, p.y - 2, 10, 3, night ? '#647B68' : '#A5B47F');
  }
  drawVenueTitle(ctx, {
    x: p.x,
    y: p.y - (small ? 51 : ZOO_SIGN.rise),
    width,
    height: small ? 34 : ZOO_SIGN.height,
    title: text,
    fontSize: small ? 13 : 16,
    night,
  });
  ctx.restore();
}
function sleepingAnimal(ctx: Ctx, a: ReturnType<typeof zooAnimalsAt>[number], night: boolean) {
  ctx.save();
  ctx.scale(1, 1 + Math.sin(a.sleepPhase) * 0.025);
  const dark = '#344537';
  if (a.species === 'penguin') {
    // A little round loaf, with flippers folded and beak tucked into its chest.
    box(ctx, -10, -18, 21, 17, '#3A515B');
    box(ctx, -7, -24, 15, 10, '#3A515B');
    box(ctx, -5, -15, 12, 13, night ? '#C7D7CA' : '#F0EFDD');
    box(ctx, 4, -16, 6, 3, '#D8AB63');
    box(ctx, 1, -20, 5, 1, '#F0EFDD');
    box(ctx, -9, -12, 5, 9, '#30464F');
    box(ctx, -7, -1, 6, 3, '#D8AB63');
    box(ctx, 3, -1, 6, 3, '#D8AB63');
  } else if (a.species === 'elephant') {
    const skin = night ? '#7F9593' : '#9FAEAD';
    box(ctx, -25, -24, 45, 23, skin);
    box(ctx, -19, -3, 17, 6, skin);
    box(ctx, 5, -3, 18, 6, skin);
    box(ctx, 12, -28, 25, 23, skin);
    box(ctx, 9, -25, 14, 20, night ? '#708584' : '#899B9D');
    box(ctx, 12, -22, 8, 13, '#A8B5AD');
    box(ctx, 28, -20, 6, 2, dark);
    // Curled trunk resting beside the folded front feet.
    box(ctx, 32, -14, 7, 15, skin);
    box(ctx, 25, -3, 13, 6, skin);
    box(ctx, 24, -7, 6, 7, skin);
    box(ctx, -30, -14, 7, 3, skin);
  } else {
    const giraffe = a.species === 'giraffe';
    const fur = giraffe ? (night ? '#BFA66D' : '#D8B864') : night ? '#B7C2B5' : '#EAE9D5';
    const marking = giraffe ? '#A27A43' : '#46554C';
    box(ctx, -19, -20, 36, 18, fur);
    for (const x of [-14, 5]) {
      box(ctx, x, -3, 14, 5, fur);
      box(ctx, x + 10, 0, 4, 2, marking);
    }
    // Fold the long neck back so the head rests on the animal's body.
    box(ctx, 10, giraffe ? -37 : -28, 8, giraffe ? 27 : 18, fur);
    box(ctx, giraffe ? -1 : 5, giraffe ? -40 : -31, 23, 11, fur);
    for (const x of [-14, -5, 4]) box(ctx, x, -18, 4, giraffe ? 5 : 14, marking);
    if (giraffe) {
      box(ctx, 12, -30, 4, 5, marking);
      box(ctx, 12, -46, 3, 7, marking);
      box(ctx, 19, -46, 3, 7, marking);
    } else {
      box(ctx, 13, -36, 4, 7, marking);
      box(ctx, 8, -28, 4, 12, marking);
    }
    box(ctx, giraffe ? 3 : 20, giraffe ? -36 : -27, 5, 2, dark);
    box(ctx, -24, -13, 6, 2, marking);
  }
  ctx.restore();
  // Undo the facing flip so the sleepy letters always read the right way round.
  ctx.save();
  ctx.scale(a.facing, 1);
  const height = a.species === 'giraffe' ? 52 : a.species === 'penguin' ? 30 : 36;
  for (let i = 0; i < 3; i++) {
    const q = (((a.sleepPhase / 6 + i / 3) % 1) + 1) % 1;
    ctx.globalAlpha = a.rest * Math.sin(q * Math.PI) * 0.8;
    ctx.fillStyle = night ? '#D9E6D3' : '#627C70';
    ctx.font = `${8 + q * 5}px "Space Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('z', 12 + q * 12, -height - q * 23);
  }
  ctx.restore();
}
function animal(ctx: Ctx, a: ReturnType<typeof zooAnimalsAt>[number], night: boolean) {
  const p = project(a.position.x, a.position.y);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(a.facing, 1);
  ctx.fillStyle = '#253D3024';
  ctx.beginPath();
  ctx.ellipse(0, 2, a.species === 'elephant' ? 25 : 15, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (a.rest > 0) {
    ctx.globalAlpha = a.rest;
    sleepingAnimal(ctx, a, night);
    ctx.globalAlpha = 1 - a.rest;
    if (a.rest === 1) {
      ctx.restore();
      return;
    }
  }
  const phase = a.action?.phase;
  const elapsed = a.action?.elapsed ?? 0;
  const progress = a.action?.progress ?? 0;
  // Ground effects stay below the animal, even while it is airborne.
  if (phase === 'splash' || phase === 'swim' || phase === 'drink') {
    ctx.strokeStyle = night ? '#A0CDD1' : '#D4F0EE';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const q = (elapsed * 0.5 + i / 3) % 1;
      ctx.globalAlpha = 1 - q;
      ctx.beginPath();
      ctx.ellipse(
        phase === 'drink' ? 37 : 0,
        phase === 'drink' ? 14 : 2,
        10 + q * 23,
        4 + q * 9,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (phase === 'splash') {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const x = Math.cos(angle) * progress * 44;
      const y =
        Math.sin(angle) * progress * 13 - Math.sin(progress * Math.PI) * (18 + (i % 3) * 10);
      ctx.globalAlpha = 1 - progress;
      box(ctx, x, y, 3, 5, '#C7EBEF');
    }
    ctx.globalAlpha = 1;
  }
  if (phase === 'run' || phase === 'skid') {
    for (let i = 0; i < 5; i++) {
      const q = (elapsed * 1.5 + i / 5) % 1;
      ctx.globalAlpha =
        (1 - q) * 0.55 * (phase === 'skid' ? 1 - progress : Math.sin(progress * Math.PI));
      box(
        ctx,
        -22 - q * 35,
        -2 - q * 9 + (i % 2) * 4,
        5 + q * 7,
        3 + q * 4,
        night ? '#ABB295' : '#E6D9B3',
      );
    }
    ctx.globalAlpha = 1;
  }
  ctx.translate(0, -a.lift);
  ctx.rotate(a.tilt);
  const step = a.step * (phase === 'run' ? 4 : 2);
  if (a.species === 'giraffe') {
    const fur = night ? '#BFA66D' : '#D8B864';
    for (const x of [-12, -5, 7, 13]) box(ctx, x, -20, 4, 22 + (x % 2 ? step : -step), fur);
    box(ctx, -16, -34, 32, 17, fur);
    const stretch = a.stretch;
    const wobble = phase === 'nibble' ? Math.sin(elapsed * 7) * 3 : 0;
    box(ctx, 9, -66 - stretch, 7, 38 + stretch, fur);
    box(ctx, 8 + wobble, -74 - stretch, 21, 11, fur);
    box(ctx, 12 + wobble, -81 - stretch, 3, 9, '#9A7650');
    box(ctx, 21 + wobble, -81 - stretch, 3, 9, '#9A7650');
    for (const [x, y] of [
      [-12, -31],
      [-2, -28],
      [9, -32],
      [11, -45],
      [11, -59],
    ])
      box(ctx, x, y - (y < -35 ? (stretch * (-y - 35)) / 31 : 0), 4, 5, '#A27A43');
    box(ctx, 23 + wobble, -72 - stretch, 2, 2, '#344537');
    if (phase === 'nibble') {
      box(ctx, 27 + wobble, -67 - stretch, 8, 3, '#76A956');
      for (let i = 0; i < 4; i++) {
        const q = (elapsed / 2 + i / 4) % 1;
        ctx.globalAlpha = 1 - q;
        box(ctx, 28 + Math.sin(q * 9 + i) * 12, -95 + q * 65, 5, 3, '#7DA758');
      }
      ctx.globalAlpha = 1;
    }
    box(ctx, -21, -29, 6, 3, '#9A7650');
  } else if (a.species === 'elephant') {
    const skin = night ? '#7F9593' : '#9FAEAD';
    box(ctx, -24, -36, 43, 29, skin);
    box(ctx, -18, -10, 10, 13 + step, skin);
    box(ctx, 7, -10, 10, 13 - step, skin);
    box(ctx, 10, -42, 27, 29, skin);
    let tip = { x: 38, y: 0 };
    const dip = { x: 37, y: 15 },
      raised = { x: 29, y: -65 };
    const mix = (a: Point, b: Point, q: number) => ({
      x: a.x + (b.x - a.x) * q,
      y: a.y + (b.y - a.y) * q,
    });
    if (phase === 'drink') tip = mix(tip, dip, Math.min(1, progress * 3));
    if (phase === 'raise-trunk') tip = mix(dip, raised, progress);
    if (phase === 'spray') tip = raised;
    if (phase === 'lower-trunk') tip = mix(raised, tip, progress);
    for (let i = 0; i <= 16; i++) {
      const q = i / 16;
      const x = (1 - q) ** 2 * 31 + 2 * (1 - q) * q * 48 + q ** 2 * tip.x;
      const y = (1 - q) ** 2 * -24 + 2 * (1 - q) * q * (tip.y < -20 ? -29 : 4) + q ** 2 * tip.y;
      box(ctx, x - 3, y - 3, 7, 7, skin);
    }
    if (phase === 'spray') {
      for (let i = 0; i < 28; i++) {
        const q = (elapsed * 0.9 + i / 28) % 1;
        const x = tip.x - q * 90 + Math.sin(i * 3) * q * 8;
        const y = tip.y - Math.sin(q * Math.PI) * 38 + q * q * 62;
        ctx.globalAlpha = Math.min(1, elapsed * 3) * (1 - q * 0.6) * Math.min(1, (5 - elapsed) * 2);
        box(ctx, x, y, i % 3 === 0 ? 4 : 3, 4, i % 2 ? '#A9DCE5' : '#E1F6EF');
      }
      ctx.globalAlpha = 1;
    }
    box(ctx, 9, -36, 14, 24, night ? '#708584' : '#899B9D');
    box(ctx, 12, -34, 8, 16, '#A8B5AD');
    box(ctx, 29, -33, phase === 'spray' ? 5 : 3, phase === 'spray' ? 1 : 3, '#344537');
    box(ctx, 27, -16, 10, 3, '#EEE4C8');
    box(ctx, -30, -26, 7, 3, skin);
  } else if (a.species === 'zebra') {
    const fur = night ? '#B7C2B5' : '#EAE9D5';
    for (const x of [-14, -7, 7, 14]) box(ctx, x, -14, 3, 16 + (x % 2 ? step : -step), '#485851');
    box(ctx, -18, -30, 35, 18, fur);
    box(ctx, 9, -43, 8, 24, fur);
    box(ctx, 10, -47, 20, 10, fur);
    for (const x of [-14, -5, 4, 12]) box(ctx, x, -29, 4, 16, '#46554C');
    box(ctx, 8, -47, 4, 21, '#46554C');
    box(ctx, 17, -53, 3, 8, '#46554C');
    box(ctx, 25, -45, 2, 2, '#253C31');
    box(ctx, -24, -26 + (phase === 'run' ? step : 0), 7, 2, '#46554C');
  } else {
    ctx.translate(0, a.submerged * 20 - a.stretch);
    ctx.beginPath();
    ctx.rect(-60, -80, 120, 80 - a.submerged * 20);
    ctx.clip();
    box(ctx, -8, -23, 16, 24, '#3A515B');
    box(ctx, -6, -30, 13, 12, '#3A515B');
    box(ctx, -4, -19, 9, 18, night ? '#C7D7CA' : '#F0EFDD');
    box(ctx, 6, -26, 8, 4, '#D8AB63');
    box(ctx, 3, -27, 2, 2, '#F8F3DD');
    box(ctx, -10, -17 + step, 3, 10, '#3A515B');
    box(ctx, 8, -17 - step, 3, 10, '#3A515B');
    box(ctx, -8, 0, 7, 3, '#D8AB63');
    box(ctx, 3, 0, 7, 3, '#D8AB63');
  }
  ctx.restore();
}

export function drawZoo(
  ctx: Ctx,
  minutes: number,
  night: boolean,
  selected = false,
  day = 0,
  season?: TownSeason,
): Object[] {
  const { left, right, top, bottom } = ZOO_GROUND;
  ground(ctx, left, top, right - left, bottom - top, night ? '#405F53' : '#A8C18C');
  // Broad, connected paths keep visitors outside the enclosures.
  ground(ctx, left + 0.05, top, 0.85, bottom - top, night ? '#7D8976' : '#DDD2AD');
  ground(ctx, left, ZOO_CENTER.y - 0.75, right - left, 1.5, night ? '#7D8976' : '#DDD2AD');
  ground(ctx, left, top, ZOO_ENTRANCE.x - left + 0.7, 0.7, night ? '#7D8976' : '#DDD2AD');
  const objects: Object[] = [];
  for (const [index, h] of ZOO_HABITATS.entries()) {
    ground(
      ctx,
      h.left,
      h.top,
      h.width,
      h.height,
      h.animal === 'penguin'
        ? night
          ? '#8AA5A3'
          : '#C5DADB'
        : h.animal
          ? night
            ? '#6D7959'
            : '#CBCA8D'
          : night
            ? '#4D715A'
            : '#9BB97D',
    );
    const pond = zooPond(h);
    if (h.animal === 'penguin') {
      ground(ctx, pond.left, pond.top, pond.width, pond.height, night ? '#477A8B' : '#78B8C6');
      ground(ctx, h.left + 0.8, h.top + 0.8, 3, 0.15, '#BEDBDD');
      for (let i = 0; i < 4; i++)
        ground(ctx, h.left + 0.6 + i * 1.2, h.top + 4.2, 0.8, 0.5, '#DDE4D8');
    } else if (h.animal) {
      ground(ctx, pond.left, pond.top, pond.width, pond.height, night ? '#5C8E92' : '#8BBAC0');
      for (let i = 0; i < 9; i++)
        ground(
          ctx,
          h.left + 0.5 + (i % 3) * 1.8,
          h.top + 0.5 + Math.floor(i / 3) * 1.6,
          0.3,
          0.18,
          night ? '#7C8A5E' : '#B1B77B',
        );
      const point = zooTree(h);
      objects.push({
        depth: point.x + point.y,
        paint: () => tree(ctx, point, night, h.animal === 'giraffe', season),
      });
    } else {
      for (let i = 0; i < 4; i++) {
        const point = { x: h.left + 0.9 + i * 1.4, y: h.top + 1.1 };
        objects.push({
          depth: point.x + point.y,
          paint: () => tree(ctx, point, night, false, season),
        });
      }
      const point = { x: h.left + h.width / 2, y: h.top + h.height / 2 };
      objects.push({
        depth: point.x + point.y,
        paint: () => {
          sign(ctx, point, 'Future habitat', night, true);
          const p = project(point.x, point.y);
          ctx.font = '9px "Space Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = night ? '#BDCEA4' : '#48674D';
          ctx.fillText('ROOM TO GROW', p.x, p.y + 16);
        },
      });
    }
    const a = { x: h.left, y: h.top },
      b = { x: h.left + h.width, y: h.top },
      c = { x: h.left + h.width, y: h.top + h.height },
      d = { x: h.left, y: h.top + h.height };
    for (const [from, to] of [
      [a, b],
      [b, c],
      [c, d],
      [d, a],
    ]) {
      // Segment the fences to share the painter's depth order with moving animals.
      const length = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y));
      for (let i = 0; i < length; i++) {
        const p = {
          x: from.x + ((to.x - from.x) * i) / length,
          y: from.y + ((to.y - from.y) * i) / length,
        };
        const q = {
          x: from.x + ((to.x - from.x) * (i + 1)) / length,
          y: from.y + ((to.y - from.y) * (i + 1)) / length,
        };
        objects.push({ depth: (p.x + p.y + q.x + q.y) / 2, paint: () => fence(ctx, p, q, night) });
      }
    }
    if (h.animal) {
      const point = {
        x: h.left + h.width / 2,
        y: index < 3 ? h.top + h.height + 0.2 : h.top - 0.2,
      };
      objects.push({
        depth: point.x + point.y,
        paint: () => sign(ctx, point, h.name, night, true),
      });
    }
  }
  for (const a of zooAnimalsAt(minutes, day))
    objects.push({ depth: a.position.x + a.position.y, paint: () => animal(ctx, a, night) });
  objects.push({
    // Sort at the near end so fence posts cannot paint over the lettering.
    depth: ZOO_SIGN_DEPTH,
    paint: () => sign(ctx, ZOO_SIGN.point, ZOO_VENUE.name, night),
  });
  if (selected) {
    ctx.strokeStyle = '#F2E2A1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    [
      project(left, top),
      project(right, top),
      project(right, bottom),
      project(left, bottom),
    ].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
  }
  return objects;
}
