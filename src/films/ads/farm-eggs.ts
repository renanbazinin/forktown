import type { AdModule } from '../types';
import {
  alpha,
  backOut,
  box,
  camera,
  disc,
  ease,
  easeIn,
  glow,
  H,
  hump,
  lerp,
  mix,
  oval,
  poly,
  sky,
  span,
  TAU,
  vignette,
  W,
  write,
  type Ctx,
} from '../kit';
import { composeAd } from '../score-kit';

// Moon Harvest Farm, 10 s: the moon sets, the sun rises, and three hens fill the gate basket.
/** Each hen puffs up, then drops its egg into the basket below; the last one is golden. */
export const LAYS = [
  { x: 106, at: 0.2, feather: '#F4EEE2', shade: '#D8CCB8' },
  { x: 160, at: 0.34, feather: '#B8683A', shade: '#8E4C2A' },
  { x: 214, at: 0.48, feather: '#2E2A30', shade: '#1C1A20' },
];
const RAIL = 104,
  BASKET = { x: 160, y: 150 };
const DROP = 0.06;

function hen(
  ctx: Ctx,
  x: number,
  y: number,
  feather: string,
  shade: string,
  puff: number,
  blink: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 + puff * 0.18, 1 - puff * 0.1);
  box(ctx, -5, -1, 2, 5, '#E0A33A');
  box(ctx, 3, -1, 2, 5, '#E0A33A');
  oval(ctx, 0, -10, 13, 10, feather);
  oval(ctx, -3, -8, 8, 5, shade);
  poly(ctx, feather, [-12, -14, -18, -24, -9, -18]);
  poly(ctx, shade, [-13, -12, -17, -20, -10, -15]);
  disc(ctx, 9, -20, 6, feather);
  poly(ctx, '#D8433B', [6, -26, 8, -30, 10, -27, 12, -30, 13, -25]);
  poly(ctx, '#F2B84E', [14, -21, 19, -19, 14, -17]);
  box(ctx, 13, -16, 2, 3, '#D8433B');
  box(ctx, 10, blink ? -21 : -22, 2, blink ? 1 : 2, '#1C1A20');
  ctx.restore();
}

/** A setting crescent: the disc, minus a second disc, clipped so the sky shows through. */
function crescent(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(x - r, y - r, r * 2, r * 2);
  ctx.arc(x + r * 0.45, y - r * 0.3, r * 0.9, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill('evenodd');
  ctx.restore();
}

function egg(ctx: Ctx, x: number, y: number, golden: boolean, s = 1) {
  oval(ctx, x, y, 4 * s, 5 * s, golden ? '#F2C14E' : '#F7EBD8');
  oval(ctx, x - 1.2 * s, y - 1.5 * s, 1.4 * s, 2 * s, golden ? '#FFE9A0' : '#FFFFFF');
}

export const farmEggsAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    s.fx('tweet', 0.02, 1.2, 0.07, -0.5);
    s.section({
      from: 0,
      to: 0.7,
      bpm: 100,
      root: 60,
      chords: [0, 5, 7, 0],
      groove: 'waltz',
      melody: [0, 4, 7, 4, 9, 7, 4, 2, 0, null],
      voice: 'pluck',
      gain: 0.7,
      fade: 0.4,
    });
    for (const [i, lay] of LAYS.entries()) {
      s.fx('squeak', lay.at, 0.25, 0.06, (lay.x / W - 0.5) * 1.2);
      s.fx('pop', lay.at + DROP, 0.14, 0.14, (lay.x / W - 0.5) * 0.6);
      s.note(lay.at + DROP, 72 + [0, 4, 7][i], 0.5, 'bell', 0.07);
    }
    s.fx('sparkle', LAYS[2].at + DROP + 0.01, 1.2, 0.1);
    s.chord(0.72, [48, 55, 60, 64], 2, 'pad', 0.05);
  });

export const farmEggsAd: AdModule = {
  draw(ctx, p, seconds) {
    const dawn = ease(span(p, 0, 0.6));
    sky(
      ctx,
      [
        mix('#3E4C7E', '#8FB8D8', dawn),
        mix('#8A7CA8', '#CFE2EA', dawn),
        mix('#DDA6A2', '#F7E4C0', dawn),
        mix('#F7CFA2', '#FFF1D2', dawn),
      ],
      0,
      120,
    );
    // The moon sets on the left as the sun comes up on the right: Moon Harvest.
    const moonY = lerp(20, 84, easeIn(span(p, 0, 0.7)));
    crescent(ctx, 24, moonY, 11, alpha('#FFF6DC', 0.9 - dawn * 0.5));
    const sunY = lerp(112, 30, ease(span(p, 0.05, 0.65)));
    glow(ctx, 294, sunY, 70, '#FFD27A', 0.45);
    disc(ctx, 294, sunY, 14, '#FFE3A0');
    // Hills, then a push-in on the farm gate so the hens read from the lawn.
    oval(ctx, 70, 124, 140, 30, '#7FA06A');
    oval(ctx, 260, 128, 150, 34, '#6E9460');
    box(ctx, 0, 116, W, H - 116, '#5E8452');
    camera(ctx, { x: 160, y: 118, zoom: 1.4 }, () => gate(ctx, p, seconds), null);
    vignette(ctx, 0.3);
  },
  score: farmEggsAdScore,
  look: { shade: '#243020', ink: '#FFF6E2', accent: '#F2B84E' },
};

function gate(ctx: Ctx, p: number, seconds: number) {
  for (const x of [60, 260]) {
    box(ctx, x - 4, 88, 8, 60, '#7A5A3E');
    box(ctx, x - 5, 86, 10, 3, '#8E6C4C');
  }
  box(ctx, 56, RAIL, 208, 5, '#9A7650');
  box(ctx, 56, RAIL + 18, 208, 4, '#8A6846');
  box(ctx, 56, RAIL + 4, 208, 1, alpha('#3A2A1C', 0.4));
  // The honesty box and sign.
  box(ctx, 206, 136, 26, 20, '#8E6C4C');
  box(ctx, 210, 140, 18, 3, '#3A2A1C');
  write(ctx, 'EGGS', 219, 152, { size: 6, color: '#FFF1D6' });
  // The basket.
  const laid = LAYS.filter((lay) => p >= lay.at + DROP);
  oval(ctx, BASKET.x, BASKET.y + 14, 34, 5, alpha('#2A3A20', 0.35));
  for (const [i, lay] of laid.entries())
    egg(
      ctx,
      BASKET.x - 12 + i * 12,
      BASKET.y - 2 - (i === 1 ? 2 : 0),
      i === 2,
      i === 2 ? 1 + hump(p, lay.at + DROP, lay.at + DROP + 0.05) * 0.4 : 1,
    );
  poly(ctx, '#B8864E', [
    BASKET.x - 28,
    BASKET.y,
    BASKET.x + 28,
    BASKET.y,
    BASKET.x + 22,
    BASKET.y + 14,
    BASKET.x - 22,
    BASKET.y + 14,
  ]);
  for (let i = 0; i < 4; i++)
    box(ctx, BASKET.x - 26 + i * 2, BASKET.y + 3 + i * 3, 52 - i * 4, 1, '#94683A');
  box(ctx, BASKET.x - 29, BASKET.y - 2, 58, 3, '#C9965C');
  poly(ctx, '#A87A44', [
    BASKET.x - 24,
    BASKET.y - 1,
    BASKET.x - 20,
    BASKET.y - 26,
    BASKET.x + 20,
    BASKET.y - 26,
    BASKET.x + 24,
    BASKET.y - 1,
    BASKET.x + 20,
    BASKET.y - 1,
    BASKET.x + 17,
    BASKET.y - 22,
    BASKET.x - 17,
    BASKET.y - 22,
    BASKET.x - 20,
    BASKET.y - 1,
  ]);
  // The hens, and each egg on its way down.
  for (const [i, lay] of LAYS.entries()) {
    const puff = hump(p, lay.at - 0.05, lay.at + 0.01);
    const bob = Math.sin(seconds * 3 + i * 2) * 0.6;
    hen(
      ctx,
      lay.x,
      RAIL + 1 + bob,
      lay.feather,
      lay.shade,
      puff,
      Math.sin(seconds * 1.7 + i * 3) > 0.96,
    );
    const fall = span(p, lay.at, lay.at + DROP);
    if (fall > 0 && fall < 1)
      egg(
        ctx,
        lerp(lay.x - 2, BASKET.x - 12 + i * 12, fall),
        lerp(RAIL + 2, BASKET.y - 2, easeIn(fall)),
        i === 2,
        backOut(fall * 3),
      );
  }
  // The golden one gets a moment.
  const shine = hump(p, LAYS[2].at + DROP, LAYS[2].at + DROP + 0.14);
  if (shine > 0) glow(ctx, BASKET.x + 12, BASKET.y - 2, 30, '#FFE9A0', shine * 0.7);
}
