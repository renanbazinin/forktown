import type { AdModule } from '../types';
import {
  alpha,
  backOut,
  box,
  clamp,
  disc,
  ease,
  easeOut,
  glow,
  H,
  hump,
  lerp,
  oval,
  poly,
  rand,
  span,
  TAU,
  vignette,
  W,
  write,
  type Ctx,
} from '../kit';
import { composeAd } from '../score-kit';

// Starlight Snack Bar, 10 s: kernels pop out of a striped bucket until it overflows.
const RED = '#D8433B',
  CREAM = '#FFF1D6',
  BUTTER = '#F2C14E',
  KERNEL = '#FFF6E4',
  SHADOW = '#E9C98E';
/** Each kernel pops at its own moment, arcs out of the bucket, and settles on the heap. */
export const POPS = Array.from({ length: 34 }, (_, i) => {
  const at = 0.06 + (i / 34) ** 0.8 * 0.56 + rand(i * 3.7) * 0.02;
  return {
    at,
    side: rand(i * 5.1) * 2 - 1,
    lift: 30 + rand(i * 2.3) * 34,
    size: 3 + Math.round(rand(i * 7.9) * 2),
  };
});
const BUCKET = { x: 160, top: 96, bottom: 166, half: 34, flare: 44 };

function rays(ctx: Ctx, seconds: number) {
  box(ctx, 0, 0, W, H, '#B8322B');
  const turn = seconds * 0.12;
  for (let i = 0; i < 16; i++) {
    const a = turn + (i / 16) * TAU,
      b = a + TAU / 32;
    poly(ctx, i % 2 ? '#C53B32' : '#A92D27', [
      160,
      118,
      160 + Math.cos(a) * 400,
      118 + Math.sin(a) * 400,
      160 + Math.cos(b) * 400,
      118 + Math.sin(b) * 400,
    ]);
  }
  glow(ctx, 160, 110, 150, '#FFD27A', 0.35);
}

function kernel(ctx: Ctx, x: number, y: number, size: number, spin: number) {
  disc(ctx, x, y, size, KERNEL);
  disc(ctx, x + Math.cos(spin) * size * 0.6, y + Math.sin(spin) * size * 0.6, size * 0.7, KERNEL);
  box(ctx, x - 1, y + size * 0.3, 2, 1, SHADOW);
}

function bucket(ctx: Ctx, squash: number) {
  const { x, top, bottom, half, flare } = BUCKET;
  const t = top + squash * 3;
  for (let i = 0; i < 6; i++) {
    const a = -flare + (i * flare * 2) / 6,
      b = a + (flare * 2) / 6;
    const c = -half + (i * half * 2) / 6,
      d = c + (half * 2) / 6;
    poly(ctx, i % 2 ? CREAM : RED, [x + a, t, x + b, t, x + d, bottom, x + c, bottom]);
  }
  box(ctx, x - flare - 2, t - 3, flare * 2 + 4, 5, '#FFFFFF');
  box(ctx, x - flare - 2, t + 1, flare * 2 + 4, 1, alpha('#7A1F1B', 0.4));
  // The label.
  oval(ctx, x, t + 36, 22, 13, CREAM);
  oval(ctx, x, t + 36, 20, 11, RED);
  write(ctx, 'POP!', x, t + 40, { size: 10, color: CREAM });
}

/** The heap grows as kernels land, then spills over the rim. */
function heap(ctx: Ctx, p: number) {
  const landed = POPS.filter((k) => p > k.at + 0.08).length / POPS.length;
  const height = easeOut(landed) * 34;
  const { x, top, flare } = BUCKET;
  for (let i = 0; i < 26; i++) {
    const u = i / 25 - 0.5;
    const hx = x + u * (flare * 2 + height * 0.6);
    const hy = top + 2 - Math.cos(u * Math.PI) * height + rand(i * 4.4) * 4;
    if (hy > top + 2) continue;
    kernel(ctx, hx, hy, 4 + rand(i) * 1.5, i);
    kernel(ctx, hx + 3, hy + 5, 3.5, i + 2);
  }
  // Spillers tumble down the sides once it is full.
  for (let i = 0; i < 6; i++) {
    const fall = span(p, 0.5 + i * 0.03, 0.62 + i * 0.03);
    if (fall <= 0) continue;
    const side = i % 2 ? 1 : -1;
    kernel(
      ctx,
      x + side * (flare + 4 + fall * (10 + i * 3)),
      top - 2 + fall * fall * (58 - i * 4),
      3.5,
      fall * 6 + i,
    );
  }
}

export const snackBarAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    s.section({
      from: 0,
      to: 0.66,
      bpm: 132,
      root: 67,
      chords: [0, 5, 7, 5],
      groove: 'pulse',
      melody: [0, 4, 7, 12, 7, 4, 9, 7],
      step: 0.5,
      voice: 'pluck',
      gain: 0.8,
      fade: 0.3,
    });
    for (const k of POPS) s.fx('pop', k.at, 0.14, 0.1 + rand(k.at * 99) * 0.08, k.side * 0.6);
    s.fx('crunch', 0.52, 0.5, 0.08);
    // A little fanfare under the slate.
    [0, 4, 7, 12].forEach((d, i) => s.note(0.68 + i * 0.025, 67 + d, 0.6, 'bell', 0.09));
    s.chord(0.78, [55, 59, 62, 67], 1.6, 'pad', 0.05);
  });

export const snackBarAd: AdModule = {
  draw(ctx, p, seconds) {
    rays(ctx, seconds);
    const squash = POPS.reduce((sum, k) => sum + hump(p, k.at - 0.004, k.at + 0.02), 0);
    heap(ctx, p);
    for (const [i, k] of POPS.entries()) {
      const t = span(p, k.at, k.at + 0.08);
      if (t <= 0 || t >= 1) continue;
      const x = lerp(BUCKET.x + k.side * 20, BUCKET.x + k.side * 40, t);
      const y = BUCKET.top - Math.sin(t * Math.PI) * k.lift + t * 8;
      kernel(ctx, x, y, k.size * backOut(clamp(t * 4)), t * 9 + i);
    }
    bucket(ctx, clamp(squash));
    // A big word bounces in as the bucket fills.
    const word = backOut(span(p, 0.3, 0.38));
    if (word > 0) {
      ctx.save();
      ctx.translate(160, 42);
      ctx.scale(word, word);
      ctx.rotate(-0.08 + Math.sin(seconds * 3) * 0.03);
      write(ctx, 'FRESH', 0, 0, { size: 16, color: BUTTER, shadow: '#7A1F1B' });
      write(ctx, 'EVERY NIGHT', 0, 14, { size: 8, color: CREAM, shadow: '#7A1F1B' });
      ctx.restore();
    }
    vignette(ctx, 0.35 * ease(1 - span(p, 0, 0.1)) + 0.2, '#3A0E0C');
  },
  score: snackBarAdScore,
  look: { shade: '#2A1418', ink: '#FFF1D6', accent: '#F2C14E' },
};
