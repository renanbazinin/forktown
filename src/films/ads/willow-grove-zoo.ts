import type { AdModule } from '../types';
import {
  alpha,
  box,
  camera,
  clamp,
  disc,
  ease,
  easeOut,
  glow,
  H,
  hump,
  lerp,
  line,
  oval,
  poly,
  rand,
  shot,
  sky,
  span,
  track,
  vignette,
  W,
  write,
  type Ctx,
} from '../kit';
import { composeAd } from '../score-kit';

// Willow Grove Zoo, 30 s: a giraffe, an elephant, a zebra, and penguins who will not take no.
export const CUTS = [0, 0.2, 0.4, 0.54] as const;
export const SPRAY = 0.28;
export const TAP = 0.72;
export const WAVE = 0.78;
const INK = '#2A2230';

function savanna(ctx: Ctx, top = 118) {
  sky(ctx, ['#8CC8E8', '#B0DAEE', '#D8ECF0', '#F2F0DC'], 0, top);
  glow(ctx, 60, 30, 100, '#FFF1C0', 0.4);
  oval(ctx, 90, top + 4, 150, 18, '#9AB86A');
  oval(ctx, 260, top + 6, 130, 16, '#8AAE60');
  box(ctx, 0, top, W, H - top, '#C8B070');
  // A willow, for Willow Grove.
  line(ctx, '#6A5040', 6, [280, top + 6, 284, top - 40]);
  oval(ctx, 284, top - 50, 30, 18, '#7FA85A');
  for (let i = 0; i < 9; i++)
    line(ctx, '#8AB86A', 2, [
      262 + i * 5,
      top - 46,
      258 + i * 5 + (i % 2) * 3,
      top - 14 + (i % 3) * 4,
    ]);
}

function giraffe(ctx: Ctx, local: number, seconds: number) {
  savanna(ctx);
  const rise = easeOut(span(local, 0.05, 0.45));
  const chew = Math.sin(seconds * 7) * 1.2;
  ctx.save();
  ctx.translate(170, lerp(250, 64, rise));
  // The neck, patched, going down out of frame.
  poly(ctx, '#E8B860', [-10, 10, 10, 10, 18, 200, -18, 200]);
  for (let i = 0; i < 8; i++)
    oval(ctx, (i % 2 ? 5 : -5) + (rand(i) - 0.5) * 4, 24 + i * 20, 5, 7, '#A86A38');
  line(ctx, '#7A4A28', 3, [-10, 14, -12, 60]);
  // The head, with ossicones, ears, and a slow chew.
  oval(ctx, 0, 0, 16, 12, '#E8B860');
  oval(ctx, 14, 6 + chew * 0.3, 12, 8, '#F2CC80');
  disc(ctx, 22, 4, 1.5, INK);
  box(ctx, 10, 11 + chew, 12, 1.5, '#8A5A38');
  for (const x of [-6, 4]) {
    box(ctx, x, -20, 3, 12, '#C89048');
    disc(ctx, x + 1.5, -21, 3, '#6A4A30');
  }
  poly(ctx, '#E8B860', [-16, -4, -30, -10, -18, 4]);
  // A long-lashed blink, straight down the lens.
  const blink = hump(local, 0.62, 0.7) > 0.5;
  if (blink) box(ctx, 2, -1, 8, 2, INK);
  else {
    disc(ctx, 6, -1, 3.5, '#FFFFFF');
    disc(ctx, 7, -1, 2, INK);
  }
  line(ctx, INK, 1, [2, -5, 5, -7, 8, -6, 11, -8]);
  ctx.restore();
}

function elephant(ctx: Ctx, p: number, seconds: number) {
  savanna(ctx, 124);
  oval(ctx, 70, 150, 60, 12, '#6AAAC8');
  oval(ctx, 70, 148, 54, 9, '#8CC8E0');
  const lift = ease(span(p, SPRAY - 0.05, SPRAY));
  const ear = Math.sin(seconds * 2) * 3;
  ctx.save();
  ctx.translate(190, 150);
  for (const [x, d] of [
    [-34, 0],
    [-14, 1],
    [18, 0],
    [36, 1],
  ] as const)
    box(ctx, x - 7, -24, 14, 26, d ? '#8A8C94' : '#9A9CA4');
  oval(ctx, 0, -40, 50, 30, '#A0A2AA');
  oval(ctx, -8, -30, 38, 16, alpha('#7A7C84', 0.4));
  line(ctx, '#8A8C94', 3, [48, -44, 58, -34 + Math.sin(seconds * 3) * 4]);
  oval(ctx, -48, -52, 22, 20, '#A8AAB2');
  oval(ctx, -30, -50 + ear * 0.3, 16, 20 + ear, '#9A9CA4');
  disc(ctx, -52, -58, 2.5, INK);
  // The trunk sweeps up from the pool and aims high.
  const tipX = lerp(-110, -84, lift),
    tipY = lerp(-4, -96, lift);
  line(ctx, '#A8AAB2', 9, [-62, -46, lerp(-84, -76, lift), lerp(-20, -70, lift), tipX, tipY]);
  box(ctx, -64, -40, 10, 3, '#F4F0E4');
  ctx.restore();
  // A fountain arc of droplets, with a soft rainbow once the sun catches it.
  const spray = span(p, SPRAY, SPRAY + 0.1);
  if (spray > 0 && spray < 1) {
    for (let i = 0; i < 40; i++) {
      const t = (i / 40 + seconds * 0.8) % 1;
      const along = t * clamp(spray * 3);
      const x = 190 - 84 - along * 120,
        y = 150 - 96 - Math.sin(along * Math.PI) * 30 + along * 40;
      disc(ctx, x, y, 1.6, alpha('#DDF2FF', 0.85));
    }
    const bow = hump(p, SPRAY + 0.03, SPRAY + 0.1) * 0.35;
    ['#FF7A7A', '#FFD27A', '#8CE08C', '#7AB8FF'].forEach((color, i) => {
      ctx.strokeStyle = alpha(color, bow);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(60, 150, 60 - i * 3, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    });
  }
}

function zebra(ctx: Ctx, x: number, y: number, step: number, look: number) {
  ctx.save();
  ctx.translate(x, y);
  for (const [lx, phase] of [
    [-16, 0],
    [-10, Math.PI],
    [10, Math.PI],
    [16, 0],
  ] as const) {
    const swing = Math.sin(step + phase) * 3;
    box(ctx, lx + swing - 2, -18, 4, 18, '#F4F2EC');
    box(ctx, lx + swing - 2, -2, 4, 2, INK);
  }
  oval(ctx, 0, -26, 24, 12, '#F4F2EC');
  for (let i = 0; i < 7; i++)
    poly(ctx, INK, [-18 + i * 6, -36, -15 + i * 6, -36, -17 + i * 6, -16, -20 + i * 6, -18]);
  line(ctx, INK, 2, [-24, -28, -30, -18]);
  // Neck and head; `look` turns it back over the shoulder toward us.
  ctx.save();
  ctx.translate(20, -32);
  ctx.scale(lerp(1, -0.6, look), 1);
  poly(ctx, '#F4F2EC', [0, 0, 8, -18, 16, -14, 8, 4]);
  for (let i = 0; i < 3; i++) box(ctx, 3 + i * 3, -12 + i * 4, 6, 2, INK);
  oval(ctx, 16, -16, 9, 6, '#F4F2EC', 0.4);
  oval(ctx, 23, -12, 4, 4, '#3A3440');
  disc(ctx, 14, -19, 1.5, INK);
  box(ctx, 8, -26, 6, 8, INK);
  ctx.restore();
  ctx.restore();
}

function zebras(ctx: Ctx, local: number, seconds: number) {
  savanna(ctx);
  const run = span(local, 0, 0.8);
  const look = ease(span(local, 0.62, 0.78));
  zebra(ctx, lerp(-60, 180, easeOut(run)), 158, seconds * 9 * (1 - look), look);
  zebra(ctx, lerp(-150, 60, easeOut(run)), 150, seconds * 9 + 1, 0);
}

function penguin(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  step: number,
  wave: number,
  stare: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(Math.sin(step) * 0.08);
  oval(ctx, -5, 0, 5, 2, '#E8A040');
  oval(ctx, 5, 0, 5, 2, '#E8A040');
  oval(ctx, 0, -16, 12, 17, '#1E2230');
  oval(ctx, 0, -13, 8, 13, '#F4F6FA');
  // Flippers: one lifts to wave.
  poly(ctx, '#1E2230', [-11, -22, -16, -8, -11, -10]);
  ctx.save();
  ctx.translate(11, -22);
  ctx.rotate(-wave * (2 + Math.sin(step * 3) * 0.3));
  poly(ctx, '#1E2230', [0, 0, 5, 14, 0, 12]);
  ctx.restore();
  disc(ctx, 0, -32, 9, '#1E2230');
  oval(ctx, 0, -30, 6, 5, '#F4F6FA');
  disc(ctx, -3, -32, stare ? 2 : 1.4, INK);
  disc(ctx, 3, -32, stare ? 2 : 1.4, INK);
  if (stare) {
    box(ctx, -3, -33, 1, 1, '#FFFFFF');
    box(ctx, 3, -33, 1, 1, '#FFFFFF');
  }
  poly(ctx, '#E8A040', [-2, -29, 2, -29, 0, -25]);
  ctx.restore();
}

function penguins(ctx: Ctx, p: number, local: number, seconds: number) {
  sky(ctx, ['#BFE0F2', '#D8EEF8', '#EEF8FC'], 0, 100);
  poly(ctx, '#E4F2FA', [0, 100, 70, 70, 140, 100]);
  poly(ctx, '#D4E8F4', [120, 100, 210, 62, 300, 100]);
  box(ctx, 0, 100, W, H - 100, '#EEF6FC');
  box(ctx, 0, 100, W, 3, '#C8E0EE');
  oval(ctx, 70, 140, 50, 8, '#9ACCE4');
  const waddle = span(local, 0, 0.35);
  const wave = ease(span(p, WAVE, WAVE + 0.02));
  // The troupe waddles up behind the little one.
  for (let i = 0; i < 7; i++) {
    const row = i % 2;
    const x = 60 + i * 34 + Math.sin(seconds + i) * 2;
    const y = lerp(112 + row * 6, 150 + row * 10, ease(waddle));
    penguin(
      ctx,
      x,
      y,
      lerp(0.8, 1.5, ease(waddle)),
      seconds * 8 + i,
      i % 3 === 0 ? wave : 0,
      false,
    );
  }
  // The little one comes right up to the lens and stares down the audience.
  const close = ease(span(local, 0.2, 0.5));
  const bump = hump(p, TAP, TAP + 0.015);
  penguin(
    ctx,
    160,
    lerp(150, 238, close) - bump * 4,
    lerp(1.2, 4.2, close) + bump * 0.2,
    seconds * 8 * (1 - close),
    wave,
    close > 0.6,
  );
  if (bump > 0 || p > TAP) {
    // A little breath of fog on the lens where the beak tapped it.
    const fog = hump(p, TAP, TAP + 0.08);
    oval(ctx, 160, 116, 26 * fog + 1, 16 * fog + 1, alpha('#FFFFFF', 0.35 * fog));
  }
}

export const zooAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    s.section({
      from: 0,
      to: 0.86,
      bpm: 104,
      root: 60,
      chords: [0, 5, 0, 7, 0, 5, 7, 0],
      groove: 'march',
      melody: [0, 4, 7, 9, 7, 4, 2, null, 4, 5, 7, 12, 7, null, 4, null],
      step: 0.5,
      voice: 'pluck',
      gain: 0.6,
      level: 0.8,
      fade: 0.8,
    });
    s.fx('crunch', 0.08, 0.6, 0.05);
    s.fx('boing', 0.16, 0.4, 0.06, 0.2);
    // The elephant: a trumpet, then the spray.
    [0, 5, 12, 10].forEach((d, i) =>
      s.note(SPRAY - 0.05 + i * 0.006, 55 + d, 0.28, 'lead', 0.07, -0.3),
    );
    s.fx('splash', SPRAY, 1.5, 0.12, -0.4);
    s.fx('sparkle', SPRAY + 0.04, 1.4, 0.06);
    for (let i = 0; i < 10; i++) s.fx('step', 0.41 + i * 0.012, 0.08, 0.07, -0.6 + i * 0.12);
    s.fx('whistle', 0.5, 0.4, 0.04, 0.3);
    for (let i = 0; i < 8; i++) s.fx('squeak', 0.56 + i * 0.02, 0.15, 0.05, -0.5 + i * 0.14);
    s.fx('knock', TAP, 0.2, 0.2);
    s.fx('giggle', TAP + 0.02, 0.8, 0.05, 0.3);
    s.fx('flutter', WAVE, 0.8, 0.07);
    s.chord(0.87, [48, 55, 60, 64, 67], 3, 'pad', 0.05);
  });

export const zooAd: AdModule = {
  draw(ctx, p, seconds) {
    const { index, local } = shot(p, CUTS);
    if (index === 0) giraffe(ctx, local, seconds);
    else if (index === 1) elephant(ctx, p, seconds);
    else if (index === 2) zebras(ctx, local, seconds);
    else {
      const view = track(p, [
        [CUTS[3], 160, 90, 1],
        [TAP, 160, 96, 1.05],
      ]);
      camera(ctx, view, () => penguins(ctx, p, local, seconds));
    }
    // Leafy wipes between the enclosures.
    for (const cut of CUTS.slice(1)) {
      const wipe = hump(p, cut - 0.012, cut + 0.012);
      if (wipe > 0) {
        box(ctx, 0, 0, W * wipe, H, '#5E8A48');
        box(ctx, W * wipe - 6, 0, 6, H, '#7FA85A');
      }
    }
    const lower = span(p, 0.02, 0.06) * (1 - span(p, 0.16, 0.19));
    if (lower > 0) {
      ctx.save();
      ctx.globalAlpha = lower;
      box(ctx, 14, 146, 132, 20, alpha('#1E2A18', 0.7));
      write(ctx, 'WILLOW GROVE ZOO', 80, 159, { size: 8, color: '#FFF8E6' });
      ctx.restore();
    }
    vignette(ctx, 0.3);
  },
  score: zooAdScore,
  look: { shade: '#1E2A18', ink: '#FFF8E6', accent: '#F29E4C' },
};
