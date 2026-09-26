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
  line,
  oval,
  poly,
  rand,
  sky,
  span,
  TAU,
  track,
  vignette,
  W,
  write,
  type Ctx,
} from '../kit';
import { composeAd } from '../score-kit';

// The Millpond, 20 s: a heron keeps its dignity, and a duck has other ideas.
/** The duck's three quacks, each louder than the last; the heron leaves on the third. */
export const QUACKS = [0.4, 0.5, 0.6];
export const LIFT = 0.63;
export const LEAP = 0.72;
const WATER = 112;
const HERON = { x: 212, y: 128 };

function mill(ctx: Ctx, seconds: number) {
  box(ctx, 24, 58, 56, 54, '#B89A78');
  poly(ctx, '#7A4A3A', [18, 60, 52, 34, 86, 60]);
  box(ctx, 44, 78, 12, 16, '#3A2A24');
  box(ctx, 62, 70, 9, 9, '#F5D9A0');
  // The wheel turns slowly, dipping into the pond.
  const turn = seconds * 0.6;
  disc(ctx, 94, 104, 20, '#6A4A34');
  disc(ctx, 94, 104, 16, alpha('#2A1E18', 0.6));
  for (let i = 0; i < 8; i++) {
    const a = turn + (i / 8) * TAU;
    line(ctx, '#8A6A4A', 2, [94, 104, 94 + Math.cos(a) * 20, 104 + Math.sin(a) * 20]);
    box(ctx, 94 + Math.cos(a) * 20 - 2, 104 + Math.sin(a) * 20 - 2, 5, 4, '#8A6A4A');
  }
  disc(ctx, 94, 104, 3, '#3A2A24');
}

function pond(ctx: Ctx, seconds: number) {
  sky(ctx, ['#F2C58A', '#F6D9A6', '#EAD8B8', '#C8D8C8'], 0, WATER);
  glow(ctx, 250, 40, 90, '#FFE3A0', 0.45);
  disc(ctx, 250, 40, 12, '#FFEBB8');
  oval(ctx, 60, WATER + 2, 120, 22, '#6E9460');
  oval(ctx, 270, WATER + 4, 120, 20, '#5E8452');
  mill(ctx, seconds);
  box(ctx, 0, WATER, W, H - WATER, '#5A8A94');
  for (let i = 0; i < 10; i++) box(ctx, 0, WATER + i * 7, W, 3, i % 2 ? '#62929C' : '#54848E');
  // Sun glints and slow ripples.
  for (let i = 0; i < 18; i++) {
    const x = (rand(i * 3.3) * W + seconds * (4 + (i % 3) * 3)) % W;
    const y = WATER + 4 + rand(i * 7.1) * (H - WATER - 8);
    box(ctx, x, y, 4 + (i % 3) * 2, 1, alpha('#FFF1D2', 0.5));
  }
  box(ctx, 250 - 8, WATER + 2, 16, 2, alpha('#FFEBB8', 0.5));
}

function reeds(ctx: Ctx, seconds: number, x0: number, count: number) {
  for (let i = 0; i < count; i++) {
    const x = x0 + i * 7 + rand(i * 2.2 + x0) * 4;
    const sway = Math.sin(seconds * 1.2 + i * 0.7) * 2;
    const h = 30 + rand(i + x0) * 22;
    line(ctx, '#4A6A3A', 2, [x, H, x + sway * 0.5, H - h * 0.5, x + sway, H - h]);
    if (i % 2 === 0) box(ctx, x + sway - 1, H - h - 6, 3, 8, '#7A5A3A');
  }
}

function heron(ctx: Ctx, p: number, seconds: number) {
  const look = ease(span(p, QUACKS[1] + 0.02, QUACKS[1] + 0.06));
  const flight = span(p, LIFT, LIFT + 0.14);
  const x = HERON.x + easeIn(flight) * 140,
    y = HERON.y - easeIn(flight) * 130 - flight * 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.5, 1.5);
  if (flight <= 0) {
    line(ctx, '#6A6A70', 1.5, [-2, 0, -2, 18]);
    line(ctx, '#6A6A70', 1.5, [3, 0, 4, 18]);
  } else line(ctx, '#6A6A70', 1.5, [-4, 0, -18, 4]);
  // Wings: folded while it stands, great slow beats once it goes.
  const beat = Math.sin(seconds * 5);
  oval(ctx, 0, -6, 12, 7, '#9AA0A8');
  if (flight > 0) {
    poly(ctx, '#8A9098', [-6, -8, 6, -8, 18, -8 - beat * 18, -2, -10 - beat * 16]);
    poly(ctx, '#7A8088', [-6, -6, 6, -6, 14, -6 + beat * 10, -4, -6 + beat * 8]);
  } else oval(ctx, -3, -7, 9, 5, '#8A9098');
  // An S-neck that turns the head, very slowly, toward the duck.
  const face = lerp(1, -1, look);
  line(ctx, '#B8BEC6', 3, [6, -10, 10, -18, 6, -24, 8, -30]);
  disc(ctx, 8, -32, 3.5, '#C8CED6');
  box(ctx, 8 - 3, -36, 6, 1.5, '#2A2A30');
  line(ctx, '#2A2A30', 1, [5, -35, 5 - 6 * face, -37]);
  poly(ctx, '#E0B040', [8 + 2 * face, -33, 8 + 12 * face, -31.5, 8 + 2 * face, -31]);
  box(ctx, 8 + face - 0.5, -33, 1.5, 1.5, '#1C1A20');
  // A heavy, unimpressed lid once it has looked.
  if (look > 0.8 && flight <= 0) box(ctx, 8 + face - 1, -34, 3, 1, '#9AA0A8');
  ctx.restore();
  if (flight <= 0) {
    oval(ctx, HERON.x + 3, HERON.y + 27, 12, 2, alpha('#FFFFFF', 0.25));
  }
}

function duck(ctx: Ctx, p: number, seconds: number) {
  const arrive = ease(span(p, 0.3, 0.4));
  const spin = span(p, LIFT + 0.08, LIFT + 0.16);
  const x = lerp(96, 176, arrive),
    y = HERON.y + 24 + Math.sin(seconds * 2.4) * 0.8;
  const quack = QUACKS.reduce((m, q, i) => Math.max(m, hump(p, q, q + 0.035) * (1 + i * 0.4)), 0);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.6 * (spin > 0 && spin < 1 ? Math.cos(spin * TAU) : 1), 1.6);
  oval(ctx, 0, 0, 10, 5, '#8A8478');
  oval(ctx, 5, -1, 5, 4, '#7A4A34');
  poly(ctx, '#3A3A40', [-9, -2, -14, -6, -9, 1]);
  const head = quack * 2;
  disc(ctx, 8, -7 - head, 4.5, '#2E6A48');
  box(ctx, 6, -3 - head, 5, 1.5, '#F4F0E4');
  box(ctx, 9, -8 - head, 1.5, 1.5, '#1C1A20');
  poly(ctx, '#E8B040', [11, -8 - head, 17, -7 - head - quack * 2, 11, -6 - head]);
  if (quack > 0.1) poly(ctx, '#D89830', [11, -6 - head, 16, -4 - head + quack * 2, 11, -5 - head]);
  ctx.restore();
  oval(ctx, x, y + 6, 18 + Math.sin(seconds * 3) * 2, 2, alpha('#FFFFFF', 0.3));
  for (const [i, q] of QUACKS.entries()) {
    const pop = backOut(span(p, q, q + 0.02)) * (1 - span(p, q + 0.05, q + 0.07));
    if (pop <= 0) continue;
    ctx.save();
    ctx.translate(x + 18 + i * 4, y - 28 - i * 8);
    ctx.scale(pop * (1 + i * 0.35), pop * (1 + i * 0.35));
    write(ctx, i === 2 ? 'QUACK!!' : 'quack.', 0, 0, {
      size: 8,
      type: i === 2 ? 'mono' : 'italic',
      color: '#FFF8E6',
      shadow: '#2A3A40',
    });
    ctx.restore();
  }
}

export const millpondAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    s.fx('water', 0.01, 6, 0.05);
    s.fx('creak', 0.05, 1, 0.04, -0.6);
    s.section({
      from: 0,
      to: 0.38,
      bpm: 72,
      root: 62,
      chords: [0, 5, 9, 7],
      melody: [7, null, 9, 7, 4, null, 2, null],
      voice: 'keys',
      gain: 0.6,
      groove: 'none',
      fade: 1,
    });
    s.fx('splash', 0.31, 0.5, 0.05, -0.4);
    for (const [i, q] of QUACKS.entries()) s.fx('quack', q, 0.3, 0.12 + i * 0.05, 0.1);
    s.fx('squeak', QUACKS[1] + 0.03, 0.4, 0.04, 0.3);
    s.fx('flutter', LIFT, 1.6, 0.14, 0.4);
    s.fx('wind', LIFT + 0.02, 1.4, 0.05, 0.6);
    s.section({
      from: LIFT + 0.04,
      to: 0.8,
      bpm: 110,
      root: 62,
      chords: [0, 5, 7, 0],
      melody: [0, 4, 7, 12, 7, 4],
      step: 0.5,
      voice: 'pluck',
      gain: 0.7,
      groove: 'tick',
      fade: 0.3,
    });
    s.fx('splash', LEAP, 0.4, 0.1, -0.2);
    s.chord(0.82, [50, 57, 62, 66], 2.4, 'pad', 0.05);
  });

export const millpondAd: AdModule = {
  draw(ctx, p, seconds) {
    const view = track(p, [
      [0, 160, 90, 1],
      [0.24, 160, 90, 1],
      [0.36, 196, 116, 1.7],
      [LIFT + 0.02, 196, 116, 1.7],
      [LIFT + 0.12, 180, 100, 1.2],
    ]);
    camera(ctx, view, () => {
      pond(ctx, seconds);
      // A fish, briefly, for the audience.
      const leap = span(p, LEAP, LEAP + 0.05);
      if (leap > 0 && leap < 1)
        oval(
          ctx,
          132 + leap * 18,
          WATER + 34 - Math.sin(leap * Math.PI) * 18,
          5,
          2,
          '#C8D8E0',
          -0.8 + leap * 1.6,
        );
      heron(ctx, p, seconds);
      duck(ctx, p, seconds);
      reeds(ctx, seconds, 0, 10);
      reeds(ctx, seconds, 268, 8);
    });
    vignette(ctx, 0.35);
  },
  score: millpondAdScore,
  look: { shade: '#16303A', ink: '#EEF8F6', accent: '#9FD8C8' },
};
