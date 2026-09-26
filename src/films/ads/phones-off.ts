import type { AdModule } from '../types';
import {
  alpha,
  box,
  clamp,
  disc,
  ease,
  glow,
  H,
  oval,
  sky,
  span,
  starfield,
  vignette,
  W,
  write,
  type Ctx,
} from '../kit';
import { composeAd } from '../score-kit';

// The Starlight Cinema, 10 s: one phone lights up the lawn, the whole row turns, and it goes dark.
export const RING = 0.12;
export const OFF = 0.56;
/** Heads turn to glare one after another, spreading out from the phone. */
const HEADS = [
  { x: 30, y: 150, s: 1.7, turn: 0.3, hair: '#3A2E2A' },
  { x: 92, y: 146, s: 1.6, turn: 0.23, hair: '#6B4A34' },
  { x: 236, y: 146, s: 1.65, turn: 0.2, hair: '#8C6A4A' },
  { x: 296, y: 150, s: 1.7, turn: 0.27, hair: '#4A3A3E' },
];
const CULPRIT = { x: 164, y: 154 };

/** Seen from behind; `glare` turns the head to show a flat, unimpressed side-eye. */
function head(ctx: Ctx, x: number, y: number, s: number, hair: string, glare: number, lit: number) {
  const skin = lit ? '#8A6E62' : '#1E1A22';
  const side = x < CULPRIT.x ? 1 : -1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * side, s);
  box(ctx, -13, 2, 26, 30, '#15131A');
  box(ctx, -4, -2, 8, 6, lit ? '#6A544A' : '#18151C');
  oval(ctx, glare * 3, -10, 10, 12, skin);
  // Hair covers the back of the head, and slides round as the face turns toward the light.
  oval(ctx, -glare * 4, -13, 10.5, 10, hair);
  if (glare > 0.3) {
    const eye = 4 + glare * 3;
    box(ctx, eye - 1, -11, 4, 2, '#EDE6DA');
    box(ctx, eye + 2, -11, 1, 2, '#0B0A0E');
    // A lowered brow: the whole row agrees on this.
    box(ctx, eye - 2, -14, 6, 1, hair);
    box(ctx, eye + 3, -13, 1, 1, hair);
    box(ctx, eye + 1, -4, 3, 1, '#4A3A34');
  }
  ctx.restore();
}

export const phonesOffAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    s.section({
      from: 0,
      to: 0.1,
      bpm: 70,
      root: 57,
      chords: [0],
      pad: true,
      bass: false,
      fade: 0.3,
    });
    // The ringtone: three chirpy bursts.
    for (let i = 0; i < 6; i++) s.note(RING + i * 0.035, i % 2 ? 83 : 88, 0.12, 'lead', 0.05, 0.1);
    s.fx('beep', RING, 0.3, 0.1, 0.1);
    for (const h of HEADS) s.fx('swish', h.turn, 0.25, 0.05, (h.x / W - 0.5) * 1.4);
    s.fx('gasp', 0.36, 0.5, 0.06);
    s.fx('click', OFF, 0.1, 0.18, 0.1);
    // Silence, then the stars come back with the theme.
    s.fx('sparkle', OFF + 0.04, 1.2, 0.08);
    s.section({
      from: OFF + 0.02,
      to: 1,
      bpm: 84,
      root: 62,
      chords: [0, 7, 9, 5],
      melody: [12, 11, 7, 9, null, 7, 4, null],
      voice: 'bell',
      gain: 0.9,
      fade: 0.4,
      groove: 'none',
    });
  });

export const phonesOffAd: AdModule = {
  draw(ctx, p, seconds) {
    const lit = p >= RING && p < OFF ? 1 : 0;
    const dark = span(p, OFF, OFF + 0.1);
    sky(ctx, ['#0B1020', '#111A30', '#18223A', '#1C2640'], 0, 110);
    starfield(ctx, seconds, {
      count: 18 + Math.round(ease(dark) * 30),
      seed: 4,
      bottom: 100,
      colors: ['#FFE9B8', '#A9B8D8', '#FFFFFF'],
    });
    // The cinema screen, far off, showing a quiet blue scene.
    box(ctx, 96, 26, 128, 72, '#2A3346');
    box(ctx, 98, 28, 124, 68, alpha('#6D86A8', 0.6 - lit * 0.35));
    glow(ctx, 160, 62, 90, '#9DB5D8', 0.18 - lit * 0.12);
    box(ctx, 0, 110, W, H - 110, '#12161C');
    // The glow of the phone: a warm ugly rectangle of light in the dark.
    const pulse = 0.85 + Math.sin(seconds * 9) * 0.05;
    if (lit) {
      glow(ctx, CULPRIT.x + 22, CULPRIT.y - 18, 80, '#E8F2FF', 0.55 * pulse);
      glow(ctx, CULPRIT.x + 22, CULPRIT.y - 18, 170, '#B8D2FF', 0.18 * pulse);
    }
    for (const h of HEADS)
      head(ctx, h.x, h.y, h.s, h.hair, lit ? ease(span(p, h.turn, h.turn + 0.05)) : 0, lit);
    // The culprit, hunched over the light, then sinking in shame.
    const sink = ease(span(p, 0.36, 0.5)) * 8;
    ctx.save();
    ctx.translate(CULPRIT.x, CULPRIT.y + sink);
    ctx.scale(1.7, 1.7);
    box(ctx, -13, 2, 26, 30, '#15131A');
    oval(ctx, 0, -10, 10, 12, lit ? '#9A8274' : '#1E1A22');
    oval(ctx, 0, -14, 10.5, 9, '#5A3A2E');
    if (lit) {
      // The phone, held up at arm's length: the brightest thing on the lawn.
      box(ctx, 9, -16, 8, 13, '#C9D8EE');
      box(ctx, 10, -15, 6, 11, '#F7FBFF');
      box(ctx, 7, -6, 4, 3, '#9A8274');
      // A sweat drop as the heads turn.
      if (p > 0.3) disc(ctx, -9, -18 + ((seconds * 6) % 3), 1.2, '#B8D2FF');
    }
    ctx.restore();
    // Once it is off, the screen itself says thanks.
    const words = span(p, OFF + 0.04, OFF + 0.12);
    if (words > 0) {
      ctx.save();
      ctx.globalAlpha = ease(words);
      write(ctx, 'THANK YOU.', 160, 66, { size: 10, color: '#FFE9B8' });
      ctx.restore();
    }
    vignette(ctx, 0.55 + 0.15 * clamp(dark));
  },
  score: phonesOffAdScore,
  look: { shade: '#0E1118', ink: '#F4F6FA', accent: '#7FD1B9' },
};
