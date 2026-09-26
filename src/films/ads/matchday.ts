import type { AdModule } from '../types';
import {
  alpha,
  backOut,
  box,
  camera,
  clamp,
  disc,
  ease,
  easeOut,
  glow,
  hump,
  lerp,
  line,
  oval,
  person,
  rand,
  shot,
  sky,
  span,
  vignette,
  W,
  write,
  type Ctx,
} from '../kit';
import { composeAd } from '../score-kit';

// The Meadow Ground, 10 s: one kick, one goal, and the loudest grandmother in Forktown.
export const KICK = 0.12;
export const GOAL = 0.36;
export const SHOUT = 0.48;
const CUTS = [0, KICK + 0.015];
const FROM = { x: 64, y: 138 },
  TO = { x: 284, y: 84 };

function ball(ctx: Ctx, x: number, y: number, r: number, spin: number) {
  disc(ctx, x, y, r, '#F7F4EC');
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * Math.PI * 2) / 3;
    disc(ctx, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.28, '#2A2A30');
  }
  oval(ctx, x - r * 0.3, y - r * 0.35, r * 0.3, r * 0.2, '#FFFFFF');
}

function pitch(ctx: Ctx) {
  sky(ctx, ['#F2C58A', '#F6D9A6', '#F8E6C2'], 0, 64);
  glow(ctx, 40, 20, 120, '#FFE3A0', 0.4);
  for (let i = 0; i < 8; i++) box(ctx, 0, 64 + i * 15, W, 15, i % 2 ? '#6FA25A' : '#78AC62');
  box(ctx, 0, 132, W, 1, alpha('#FFFFFF', 0.6));
  box(ctx, 238, 64, 1, 116, alpha('#FFFFFF', 0.6));
}

/** The home crowd on the bank behind the goal line: they leap when it goes in. */
function crowd(ctx: Ctx, p: number, seconds: number) {
  const joy = span(p, GOAL, GOAL + 0.02);
  box(ctx, 0, 52, W, 14, '#8C7A60');
  for (let i = 0; i < 30; i++) {
    const x = 6 + i * 10.5 + rand(i) * 4;
    const jump = joy > 0 ? Math.abs(Math.sin(seconds * 9 + i * 1.7)) * 5 : 0;
    const y = 58 - jump - (i % 2) * 3;
    const scarf = i % 3 ? '#D8433B' : '#F5D547';
    box(ctx, x - 3, y, 7, 8, ['#3E4C7E', '#6B4A34', '#4A5A48', '#7A3A3A'][i % 4]);
    box(ctx, x - 3, y, 7, 2, scarf);
    disc(ctx, x, y - 3, 3, ['#E8C0A0', '#B8886A', '#8A5E44', '#F0D0B8'][i % 4]);
    if (joy > 0 && i % 4 === 1) line(ctx, scarf, 2, [x + 3, y, x + 7, y - 7 - jump]);
  }
  box(ctx, 0, 64, W, 2, '#E8E2D2');
}

function goalFrame(ctx: Ctx, p: number) {
  const bulge = hump(p, GOAL, GOAL + 0.06) * 8;
  for (let i = 0; i <= 8; i++)
    line(ctx, alpha('#FFFFFF', 0.5), 1, [
      262 + i * 4,
      70,
      266 + i * 4 + bulge * Math.sin((i / 8) * Math.PI),
      128,
    ]);
  for (let j = 0; j <= 7; j++)
    line(ctx, alpha('#FFFFFF', 0.5), 1, [262, 70 + j * 8, 300 + bulge, 72 + j * 8]);
  box(ctx, 258, 68, 4, 62, '#FFFFFF');
  box(ctx, 258, 68, 44, 4, '#FFFFFF');
}

/** The keeper sets, dives the wrong way round, and lands in a heap. */
function keeper(ctx: Ctx, p: number) {
  const dive = ease(span(p, KICK + 0.1, GOAL + 0.02));
  ctx.save();
  ctx.translate(lerp(270, 262, dive), lerp(128, 112, hump(p, KICK + 0.1, GOAL + 0.05)) + dive * 10);
  ctx.rotate(-dive * 1.35);
  person(ctx, 0, 0, {
    skin: '#C8906A',
    hair: '#2A2230',
    coat: '#F5D547',
    legs: '#2A2A30',
    build: 'adult',
    facing: -1,
    size: 1.1,
    arms: [2.6, 2.9],
    eyes: dive > 0.5 ? 'wide' : 'open',
    mouth: dive > 0.5 ? 'o' : 'flat',
    hat: p < SHOUT + 0.05 ? 'cap' : 'none',
    hatColor: '#2A2A30',
  });
  ctx.restore();
}

/** Grandma Ada in the front row, with her rattle, and rings of pure volume. */
function grandma(ctx: Ctx, p: number, seconds: number) {
  const yell = span(p, SHOUT, SHOUT + 0.18);
  ctx.save();
  ctx.translate(46, 188);
  ctx.scale(2.6, 2.6);
  person(ctx, 0, 0, {
    skin: '#E8C0A0',
    hair: '#DAD6DE',
    coat: '#D8433B',
    legs: '#3A3040',
    build: 'adult',
    hairStyle: 'bun',
    hat: 'beanie',
    hatColor: '#F5D547',
    arms: yell > 0 ? [0.4, 2.8 + Math.sin(seconds * 20) * 0.15] : [0.2, 0.6],
    eyes: yell > 0 ? 'closed' : 'happy',
    mouth: yell > 0 ? 'open' : 'smile',
  });
  ctx.restore();
  if (yell <= 0) return;
  // Sound rings roll out across the pitch, and the keeper's cap goes with them.
  for (let i = 0; i < 4; i++) {
    const ring = (yell * 3 + i * 0.35) % 1.4;
    if (ring > 1) continue;
    ctx.strokeStyle = alpha('#FFF1D6', 0.7 * (1 - ring));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(70, 118, 16 + ring * 120, -0.9, 0.2);
    ctx.stroke();
  }
  const cap = easeOut(span(p, SHOUT + 0.05, SHOUT + 0.2));
  if (cap > 0) {
    ctx.save();
    ctx.translate(lerp(246, 322, cap), lerp(112, 40, cap));
    ctx.rotate(cap * 6);
    box(ctx, -5, -2, 10, 4, '#2A2A30');
    box(ctx, 3, 0, 5, 2, '#2A2A30');
    ctx.restore();
  }
}

export const matchdayAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    s.fx('whistle', 0.02, 0.5, 0.1);
    s.fx('crowd', 0.02, 2.5, 0.04);
    s.section({ from: 0, to: KICK, bpm: 120, root: 57, chords: [0], groove: 'tick', fade: 0.2 });
    s.fx('thud', KICK, 0.2, 0.22, -0.4);
    s.fx('swish', KICK + 0.01, 0.8, 0.06, 0);
    s.fx('rustle', GOAL, 0.4, 0.12, 0.6);
    s.fx('applause', GOAL + 0.01, 3, 0.12, 0.2);
    s.fx('crowd', GOAL + 0.01, 3, 0.1, 0.2);
    s.section({
      from: GOAL,
      to: 0.72,
      bpm: 128,
      root: 60,
      chords: [0, 5, 7, 5],
      groove: 'march',
      melody: [7, 7, 9, 7, 12, 11, null, null],
      voice: 'lead',
      gain: 0.7,
      fade: 0.3,
    });
    s.fx('woo', SHOUT, 1.4, 0.16, -0.5);
    s.fx('gasp', SHOUT + 0.12, 0.6, 0.06, 0.5);
    s.chord(0.74, [48, 55, 60, 64], 2, 'pad', 0.05);
  });

export const matchdayAd: AdModule = {
  draw(ctx, p, seconds) {
    const { index, local } = shot(p, CUTS);
    if (index === 0) {
      // Close on the spot: the ball waits, the boot swings in.
      camera(
        ctx,
        { x: FROM.x + 6, y: FROM.y - 6, zoom: lerp(3, 3.3, local) },
        () => {
          pitch(ctx);
          ball(ctx, FROM.x, FROM.y, 4, 0);
          const swing = ease(local);
          ctx.save();
          ctx.translate(lerp(FROM.x - 26, FROM.x - 5, swing), FROM.y - 3);
          ctx.rotate(lerp(-0.5, 0.1, swing));
          box(ctx, -3, -22, 6, 20, '#2A2A30');
          box(ctx, -4, -2, 11, 5, '#D8433B');
          box(ctx, 5, 1, 3, 2, '#F7F4EC');
          ctx.restore();
        },
        null,
      );
      return;
    }
    pitch(ctx);
    crowd(ctx, p, seconds);
    goalFrame(ctx, p);
    keeper(ctx, p);
    const flight = span(p, KICK, GOAL);
    const x = lerp(FROM.x, TO.x, easeOut(flight)),
      y = lerp(FROM.y, TO.y, flight) - Math.sin(flight * Math.PI) * 34;
    if (p < GOAL) ball(ctx, x, y, 4, flight * 14);
    else ball(ctx, TO.x + 8, lerp(TO.y, 124, clamp((p - GOAL) * 12)), 4, 0);
    const word = backOut(span(p, GOAL + 0.01, GOAL + 0.06));
    if (word > 0 && p < SHOUT) {
      ctx.save();
      ctx.translate(160, 34);
      ctx.scale(word, word);
      write(ctx, 'GOAL!', 0, 8, { size: 22, color: '#F5D547', shadow: '#2A2A30' });
      ctx.restore();
    }
    grandma(ctx, p, seconds);
    vignette(ctx, 0.3);
  },
  score: matchdayAdScore,
  look: { shade: '#12301E', ink: '#F4FAF2', accent: '#F5D547' },
};
