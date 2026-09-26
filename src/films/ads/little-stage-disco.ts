import type { AdModule } from '../types';
import {
  alpha,
  backOut,
  box,
  camera,
  disc,
  ease,
  glow,
  H,
  hump,
  lerp,
  line,
  person,
  shot,
  sky,
  span,
  starfield,
  TAU,
  track,
  veil,
  vignette,
  W,
  write,
  type Ctx,
  type Figure,
} from '../kit';
import { composeAd } from '../score-kit';

// Midnight at the Little Stage, 20 s: the clock strikes twelve, and a shy grandad steals the show.
export const MIDNIGHT = 0.12;
export const CUT = 0.2;
export const NUDGE = 0.42;
export const MOVE = 0.56;
const BEAT = 60 / 116;
const LIGHTS = ['#FF7AC8', '#7FE0F0', '#F5D547', '#A88CFF'];

function clockFace(ctx: Ctx, p: number) {
  sky(ctx, ['#150E2A', '#1E1440', '#2A1A50'], 0, H);
  const s = 1 + ease(span(p, 0, CUT)) * 0.25;
  ctx.save();
  ctx.translate(160, 92);
  ctx.scale(s, s);
  disc(ctx, 0, 0, 62, '#3A2A1C');
  disc(ctx, 0, 0, 57, '#F4EAD2');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    box(ctx, Math.sin(a) * 48 - 1.5, -Math.cos(a) * 48 - 3, 3, i % 3 ? 4 : 7, '#3A2A1C');
  }
  write(ctx, 'XII', 0, -32, { size: 9, type: 'serif', color: '#3A2A1C' });
  // The minute hand clicks up to twelve; the hour hand is already there.
  const minute = lerp(-0.35, 0, ease(span(p, 0.02, MIDNIGHT)));
  line(ctx, '#2A1E14', 4, [0, 0, Math.sin(-0.02) * 26, -Math.cos(-0.02) * 26]);
  line(ctx, '#2A1E14', 2.5, [0, 0, Math.sin(minute * TAU) * 44, -Math.cos(minute * TAU) * 44]);
  disc(ctx, 0, 0, 4, '#D8433B');
  ctx.restore();
  glow(ctx, 160, 92, 110, '#FF7AC8', hump(p, MIDNIGHT, CUT) * 0.5);
}

function bulbs(ctx: Ctx, seconds: number) {
  for (let i = 0; i < 26; i++) {
    const x = i * 13 + 4,
      y = 22 + Math.sin((i / 25) * Math.PI) * 14;
    const on = 0.6 + Math.sin(seconds * 2 + i * 0.9) * 0.25;
    disc(ctx, x, y, 2, LIGHTS[i % 4]);
    glow(ctx, x, y, 8, LIGHTS[i % 4], 0.3 * on);
  }
  line(
    ctx,
    '#2A2040',
    1,
    Array.from({ length: 27 }, (_, i) => [
      i * 13 + 4,
      20 + Math.sin((i / 26) * Math.PI) * 14,
    ]).flat(),
  );
}

/** A mirror ball, turning slowly; its spots drift across the crowd (never strobing). */
function mirrorBall(ctx: Ctx, seconds: number) {
  line(ctx, '#8A7AA0', 1, [160, 0, 160, 34]);
  disc(ctx, 160, 44, 11, '#B8B4C8');
  for (let r = -2; r <= 2; r++)
    for (let c = -3; c <= 3; c++) {
      const shine = Math.sin(seconds * 3 + c * 1.3 + r * 0.7) > 0.4;
      box(
        ctx,
        160 + c * 3 - 1 + ((seconds * 6) % 3),
        44 + r * 4 - 1,
        2,
        2,
        shine ? '#FFFFFF' : '#8E8AA4',
      );
    }
  for (let i = 0; i < 14; i++) {
    const a = seconds * 0.45 + i * 0.9;
    const x = 160 + Math.cos(a) * (60 + (i % 4) * 34),
      y = 110 + Math.sin(a * 1.3 + i) * 34;
    disc(ctx, x, y, 2.5, alpha(LIGHTS[i % 4], 0.55));
  }
}

const GRANDAD: Figure = {
  skin: '#E8C0A0',
  hair: '#E4E0E8',
  coat: '#8A6A4A',
  legs: '#4A4A58',
  build: 'adult',
  hairStyle: 'short',
  size: 1.9,
  facing: 1,
};
const GRAN: Figure = {
  skin: '#D8A888',
  hair: '#C8C4D0',
  coat: '#5A8A9A',
  legs: '#3A3A48',
  build: 'adult',
  hairStyle: 'bun',
  size: 1.8,
  facing: 1,
};

function dancers(ctx: Ctx, seconds: number, circle: number) {
  const coats = ['#D8433B', '#5A8AD8', '#F2B84E', '#7FB36A', '#B86AD8', '#E88A5A'];
  for (let i = 0; i < 6; i++) {
    const bob = Math.abs(Math.sin((seconds / BEAT) * Math.PI + i));
    const home = 26 + i * 40;
    // When grandad moves, the dancers step back into a ring around him.
    const x = lerp(home, home < 160 ? home - 22 : home + 22, circle);
    person(ctx, x, 150 - bob * 3, {
      skin: ['#E8C0A0', '#B8886A', '#8A5E44', '#F0D0B8'][i % 4],
      hair: ['#2A2230', '#6B4A34', '#1C1A20', '#C8A060'][i % 4],
      coat: coats[i],
      legs: '#2A2A38',
      build: 'adult',
      size: 1.25,
      step: seconds * 6 + i,
      arms: circle > 0.5 ? [2.6, 2.8] : [0.8 + bob, 1.6 - bob],
      eyes: circle > 0.5 ? 'happy' : 'closed',
      mouth: circle > 0.5 ? 'grin' : 'smile',
      facing: x < 160 ? 1 : -1,
    });
  }
}

function stage(ctx: Ctx, p: number, seconds: number) {
  sky(ctx, ['#120A24', '#1C1036', '#281648', '#3A1E58'], 0, 120);
  starfield(ctx, seconds, { count: 20, seed: 9, bottom: 60 });
  bulbs(ctx, seconds);
  box(ctx, 0, 120, W, H - 120, '#2A1E3A');
  box(ctx, 0, 118, W, 3, '#4A3460');
  mirrorBall(ctx, seconds);
  const circle = ease(span(p, MOVE, MOVE + 0.04));
  dancers(ctx, seconds, circle);
  // Grandad at the edge of the floor, then in the middle of it.
  const tap = Math.sin((seconds / BEAT) * Math.PI * 2);
  const spin = span(p, MOVE, MOVE + 0.08);
  const gx = lerp(264, 160, ease(span(p, MOVE - 0.02, MOVE + 0.03)));
  const nudged = hump(p, NUDGE, NUDGE + 0.05);
  person(ctx, 300 - nudged * 3, 170, {
    ...GRAN,
    facing: -1,
    arms: [0.2, 0.2 + nudged * 1.6],
    eyes: 'happy',
    mouth: 'smile',
  });
  // A warm spotlight finds him the moment he moves.
  glow(ctx, gx, 150, 56, '#FFF0C0', ease(span(p, MOVE, MOVE + 0.05)) * 0.4);
  ctx.save();
  ctx.translate(gx, 172);
  if (spin > 0 && spin < 1) ctx.scale(Math.cos(spin * TAU), 1);
  person(ctx, 0, 0, {
    ...GRANDAD,
    facing: p > MOVE ? 1 : -1,
    step: p > MOVE + 0.08 ? seconds * 8 : undefined,
    arms:
      p > MOVE + 0.08
        ? [0.3, 2.9 + Math.sin(seconds * 4) * 0.2]
        : p > NUDGE
          ? [0.3, 0.3 + Math.max(0, tap) * 0.4]
          : [0.1, 0.1],
    eyes: p > MOVE ? 'happy' : p > NUDGE + 0.04 ? 'wide' : 'open',
    mouth: p > MOVE ? 'grin' : p > NUDGE + 0.04 ? 'o' : 'flat',
    lean: p > MOVE + 0.08 ? Math.sin(seconds * 4) * 0.15 : 0,
  });
  ctx.restore();
  // Before the move, just his foot gives him away.
  if (p > NUDGE - 0.08 && p < MOVE)
    box(ctx, gx - 8 + Math.max(0, tap) * 2, 168 - Math.max(0, tap) * 3, 8, 3, '#2A2230');
  const word = backOut(span(p, MOVE + 0.1, MOVE + 0.15));
  if (word > 0) {
    ctx.save();
    ctx.translate(160, 76);
    ctx.scale(word, word);
    write(ctx, 'ONE MORE SONG!', 0, 0, { size: 13, color: '#FFF0FA', shadow: '#FF7AC8' });
    ctx.restore();
  }
}

export const discoAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    for (let i = 0; i < 4; i++) s.fx('tick', 0.02 + i * 0.025, 0.08, 0.1);
    s.fx('toll', MIDNIGHT, 2.4, 0.14);
    s.fx('toll', MIDNIGHT + 0.05, 2, 0.08);
    s.section({
      from: CUT,
      to: 0.82,
      bpm: 116,
      root: 57,
      chords: [0, 0, 5, 7],
      minor: true,
      groove: 'drive',
      melody: [12, null, 10, 12, null, 7, 10, null],
      step: 0.5,
      voice: 'lead',
      gain: 0.65,
      fade: 0.4,
    });
    s.fx('swish', NUDGE, 0.3, 0.08, 0.6);
    s.fx('sweep', MOVE, 0.8, 0.1);
    s.fx('woo', MOVE + 0.06, 1.2, 0.12, -0.3);
    s.fx('applause', MOVE + 0.07, 3, 0.12);
    s.fx('crowd', MOVE + 0.07, 3, 0.08);
    s.chord(0.84, [45, 52, 57, 60], 2.4, 'pad', 0.05);
  });

export const discoAd: AdModule = {
  draw(ctx, p, seconds) {
    const { index } = shot(p, [0, CUT]);
    if (index === 0) clockFace(ctx, p);
    else {
      // A slow push-in on the floor, then back out when the ring forms.
      const view = track(p, [
        [CUT, 160, 100, 1],
        [NUDGE, 256, 118, 1.5],
        [MOVE, 246, 118, 1.45],
        [MOVE + 0.08, 160, 108, 1.2],
      ]);
      camera(ctx, view, () => stage(ctx, p, seconds));
    }
    veil(ctx, '#07090C', hump(p, CUT - 0.015, CUT + 0.015));
    vignette(ctx, 0.5, '#0A0616');
    if (index === 1) glow(ctx, 160, 120, 160, '#FF7AC8', 0.08);
  },
  score: discoAdScore,
  look: { shade: '#1A1030', ink: '#FFF0FA', accent: '#FF7AC8' },
};
