import type { FilmModule } from './types';
import type { Voice } from '../music/score';
import {
  alpha,
  box,
  camera,
  caption,
  disc,
  ease,
  easeIn,
  easeOut,
  faded,
  glow,
  H,
  hump,
  lerp,
  letterbox,
  line,
  mix,
  oval,
  poly,
  presence,
  rainfall,
  rand,
  span,
  track,
  veil,
  vignette,
  W,
  within,
  write,
  type Ctx,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * NIGHT BUS
 * Amara is a nurse at the end of a double shift. She takes the last bus home every night, and
 * every night Mr Hale is aboard in a pressed coat with fresh flowers on his knee. He rides to
 * the end of the line, the old seafront shelter, and never gets off; he just rides back. Sol
 * drives, and sees them both in his mirror. Tonight Amara stays on past her stop.
 *
 * Everything is timed in story seconds (114 of them between the title and the end card). The
 * score's pulse is the bus's indicator, and the bell, the doors, the engine and the waves are
 * shared constants, so every sound lands on its picture.
 */

// ——— Timing ———
const STORY = 114;
const at = (s: number) => s / STORY;

/** Where each shot begins, in story seconds, and what it is. */
const SHOT_LIST = [
  [0, 'street'], // the last bus through the sleeping town
  [7.5, 'cabin'], // on board: Amara, Mr Hale, Sol
  [12, 'mirror'], // over Sol's shoulder: the mirror
  [16.5, 'amara'], // Amara against the glass
  [21, 'hale'], // Mr Hale and his flowers
  [25.5, 'bell'], // the bell
  [28.5, 'stop'], // Hollin Road: the doors open
  [32, 'thatsYou'], // the mirror: "That's you, Amara."
  [34.5, 'stand'], // she stands, and sits back down
  [40, 'reflection'], // two faces in one window
  [45, 'arrival'], // the seafront: the end of the line
  [50.5, 'bench'], // the empty bench
  [54, 'grip'], // he does not get up
  [57.5, 'everyNight'], // "Every night."
  [61.5, 'understands'], // Amara understands
  [64.5, 'ring'], // the ring, and the badge
  [70, 'young'], // then: the same badge, on a young man's cap
  [72.2, 'thenWave'], // then: the bus comes in, and she waves
  [76, 'thenArm'], // then: flowers, an arm. Now: nobody
  [85, 'moveUp'], // Amara moves up the bus
  [89, 'offer'], // "I'll walk with you."
  [95, 'take'], // his hand on her arm
  [98.5, 'stepOff'], // they step off
  [102.5, 'morning'], // "Morning, love."
  [106, 'dawn'], // dawn over the sea
  [110.5, 'home'], // riding home
] as const;
type ShotName = (typeof SHOT_LIST)[number][1];
const CUTS = SHOT_LIST.map(([at]) => at);
/** The memory has its own grade, and the dawn a lighter vignette. */
const THEN: readonly ShotName[] = ['young', 'thenWave', 'thenArm'];
const MORNING: readonly ShotName[] = ['stepOff', 'morning', 'dawn', 'home'];

// The score's pulse, which the indicator keeps: 72 to the minute, four to the bar.
const BPM = 72;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
/** The stop bell: her hand finds it out of habit, on the downbeat after the theme. */
const CHIME_S = 27.3;
const THEME_S = CHIME_S - BAR * 8;
const beatAt = (n: number) => THEME_S + n * BEAT;
/** The indicator: counting the theme in as the film opens, pulling out from Hollin Road, and
 * pulling in at the seafront. */
const START_TICKS = [0, 1, 2, 3, 4, 5, 6, 7].map(beatAt);
const OUT_TICKS = [45, 46, 47, 48, 49, 50, 51].map(beatAt);
const IN_TICKS = [53, 54, 55, 56, 57].map(beatAt);
const TICKS = [...START_TICKS, ...OUT_TICKS, ...IN_TICKS];
/** The wipers keep the beat too: one sweep each way to the bar, thunking at each end. */
const wiper = (t: number) => Math.sin((Math.PI * (t - THEME_S)) / (BEAT * 2));
const WIPES = [15, 17, 19].map(beatAt);
const TERMINUS_S = beatAt(58);

const DOORS_S = 29.3;
const RISE_S = 35.3;
const SIT_S = 37.7;
const SHUT_S = 38.5;
const PULL_S = 39.1;
const GRIP_S = 55.7;
const RING_S = 65.8;
// The memory is a waltz in the major, a bar every two seconds.
const WALTZ_BPM = 90;
const WBEAT = 60 / WALTZ_BPM;
const WBAR = WBEAT * 3;
const BADGE_S = 68.2;
const WALTZ_S = BADGE_S;
const HALT_THEN_S = WALTZ_S + WBAR * 1.8;
const WAVE_S = WALTZ_S + WBAR * 2;
const GIFT_S = WALTZ_S + WBAR * 5;
/** She takes his arm on the top note of the waltz. */
const LINK_S = GIFT_S + WBEAT;
const INTO_THEN = [69.3, 70.9] as const;
const BACK_TO_NOW = [81.4, 83.6] as const;
const STAND_S = 85.6;
const BESIDE_S = 88.3;
const OFFER_S = 89.6;
/** He takes her arm on the downbeat where the theme turns major. */
const TAKE_S = OFFER_S + BAR * 2;
const LAY_S = OFFER_S + BAR * 3 + BEAT * 2;
const OFF_S = 102.1;
const DAWN_S = 105.9;
const GULL_S = 107.2;
const LAMP_OFF_S = 108.4;
const SNORE_S = 112;
/** Waves breaking on the sea wall, heard and seen together. */
const WAVES = [46.6, 51.3, 55.9, 60.6, 65.2, 83.9, 88.5, 93.2, 97.8, 102.9, 107.6, 112.2];

/** The hit points, in story time (0..1). */
export const SYNC = {
  chime: at(CHIME_S),
  doors: at(DOORS_S),
  shut: at(SHUT_S),
  ticks: TICKS.map(at),
  terminus: at(TERMINUS_S),
  wipes: WIPES.map(at),
  ring: at(RING_S),
  badge: at(BADGE_S),
  link: at(LINK_S),
  offer: at(OFFER_S),
  take: at(TAKE_S),
  lay: at(LAY_S),
  engineOff: at(OFF_S),
  waves: WAVES.map(at),
} as const;

const indicatorOn = (t: number) => TICKS.some((b) => t >= b && t < b + BEAT * 0.5);
const blink = (seconds: number, seed: number) => (seconds + seed * 1.7) % (3.4 + seed * 0.5) < 0.13;
const talking = (t: number, from: number, to: number) =>
  within(t, from, to) && Math.sin((t - from) * 19) > -0.2;
const surge = (t: number) => Math.max(0, ...WAVES.map((w) => hump(t, w + 0.4, w + 3.2)));

/** How far the bus has driven, for the views out of its windows: [story second, px/s]. */
const CRUISE = 62;
const SPEED: readonly (readonly [number, number])[] = [
  [0, CRUISE],
  [26.4, CRUISE],
  [29.0, 0],
  [PULL_S, 0],
  [PULL_S + 3.2, CRUISE],
  [46.2, CRUISE],
  [TERMINUS_S, 0],
];
function drive(t: number) {
  let d = 0;
  for (let i = 0; i < SPEED.length - 1; i++) {
    const [a, va] = SPEED[i],
      [b, vb] = SPEED[i + 1];
    if (t <= a) break;
    const e = Math.min(t, b);
    d += ((va + lerp(va, vb, (e - a) / (b - a))) / 2) * (e - a);
  }
  return d;
}
const LAMP_GAP = 150;
/** Street lamps outside the windows, in cabin x, for a bus that has driven `d`. */
function lampsAt(d: number, from: number, to: number) {
  const xs: number[] = [];
  for (
    let i = Math.floor((d + from - 40) / LAMP_GAP);
    i <= Math.ceil((d + to - 40) / LAMP_GAP);
    i++
  )
    xs.push(40 + i * LAMP_GAP - d);
  return xs;
}
/** How brightly a passing lamp lights a spot in the cabin. */
function sweep(t: number, x: number) {
  let k = 0;
  for (const lx of lampsAt(drive(t), x - 100, x + 100))
    k = Math.max(k, (1 - Math.min(1, Math.abs(lx - x) / 95)) ** 2);
  return k;
}
/** The Hollin Road stop, where the doors open onto the rain. */
const HOLLIN = drive(29) + 276;

// ——— Palette: sodium and cabin-yellow against a deep blue night ———
type Tone = (c: string) => string;
const keep: Tone = (c) => c;
const INK = '#16131C';
const SODIUM = '#FF9A3A';
const SODIUM_HI = '#FFCB7C';
const CABIN = '#FFD583';
const CABIN_HI = '#FFF0C2';
const CREAM = '#E8D8AC';
const GREEN = '#2E5B4A';
const GREEN_D = '#1F4135';
const MAROON = '#7D2E3B';
const MAROON_D = '#5A1F2A';
const POLE = '#E4B43A';
const BRASS = '#D4A344';
const BRASS_HI = '#FFE59C';
const ENAMEL = '#2B6A54';
const AMBER = '#FFB22E';
const RED_LAMP = '#FF4B3A';
const SCRUBS = '#3F8D9C';
const PETAL = '#FFF4E4';
const NIGHT_SKY = ['#050918', '#0A1230', '#131F48', '#1D2A56'] as const;

function vgrad(ctx: Ctx, x: number, y0: number, w: number, y1: number, stops: readonly string[]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y0, w, y1 - y0);
}
function mixAll(a: readonly string[], b: readonly string[], k: number) {
  return a.map((c, i) => mix(c, b[i], k));
}

// ——— People ———
type Kind = 'amara' | 'hale' | 'sol' | 'young' | 'wife';
type Who = {
  kind: Kind;
  skin: string;
  shade: string;
  hair: string;
  coat: string;
  coatD: string;
  legs: string;
  shoes: string;
};
const AMARA: Who = {
  kind: 'amara',
  skin: '#8C5638',
  shade: '#6C3E26',
  hair: '#1A1212',
  coat: '#2F4568',
  coatD: '#223352',
  legs: SCRUBS,
  shoes: '#E6E2DA',
};
const HALE: Who = {
  kind: 'hale',
  skin: '#EBC2A4',
  shade: '#CB9A7E',
  hair: '#EDEAE4',
  coat: '#A08159',
  coatD: '#7C6444',
  legs: '#47433F',
  shoes: '#2A221E',
};
const SOL: Who = {
  kind: 'sol',
  skin: '#C68B5F',
  shade: '#A46E47',
  hair: '#8E8983',
  coat: '#35584A',
  coatD: '#284437',
  legs: '#2B3340',
  shoes: '#1D1D22',
};
const YOUNG: Who = { ...SOL, kind: 'young', skin: '#EFC7A6', shade: '#D4A586', hair: '#5B3B25' };
const WIFE: Who = {
  kind: 'wife',
  skin: '#F1CDB0',
  shade: '#D8AA8C',
  hair: '#8C4F2E',
  coat: '#C9737C',
  coatD: '#A55A63',
  legs: '#6A5650',
  shoes: '#4A2E2A',
};
const SCARF = '#6E9A96';
const CAP = '#23392F';

/** The Forktown Transport badge: brass, green enamel, a little brass bus. */
function badge(ctx: Ctx, x: number, y: number, s: number, T: Tone = keep, shine = 0) {
  oval(ctx, x, y, 10 * s, 7 * s, T(BRASS));
  oval(ctx, x, y, 8.4 * s, 5.6 * s, T('#8A6420'));
  oval(ctx, x, y, 7.4 * s, 4.8 * s, T(ENAMEL));
  box(ctx, x - 4.6 * s, y - 2 * s, 9.2 * s, 3.4 * s, T(BRASS_HI));
  for (let i = 0; i < 3; i++)
    box(ctx, x - 3.6 * s + i * 2.6 * s, y - 1.4 * s, 1.6 * s, 1.2 * s, T(ENAMEL));
  disc(ctx, x - 2.6 * s, y + 1.8 * s, 1 * s, T(BRASS_HI));
  disc(ctx, x + 2.6 * s, y + 1.8 * s, 1 * s, T(BRASS_HI));
  oval(ctx, x - 4 * s, y - 4 * s, 3.4 * s, 1.1 * s, alpha('#FFFFFF', 0.45), -0.3);
  if (shine > 0) glow(ctx, x - 3 * s, y - 3 * s, 16 * s, BRASS_HI, shine);
}

/** A small bunch: white, yellow and pink, in brown paper. Blooms point along `rot` (0 = up). */
function bouquet(ctx: Ctx, x: number, y: number, s: number, T: Tone, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  for (const sx of [-2.5, -1, 0.5, 2]) line(ctx, T('#4F7A3A'), 1.1, [sx, 10, sx * 1.6, -8]);
  poly(ctx, T('#C9A474'), [-6, -6, 6, -6, 2.6, 7, -2.6, 7]);
  poly(ctx, T('#B08D5E'), [-6, -6, -2, -6, -1, 7, -2.6, 7]);
  const blooms: readonly (readonly [number, number, number, string])[] = [
    [-5, -12, 3, '#F6F1E6'],
    [4.5, -13, 3, '#F6F1E6'],
    [0, -16, 3.2, '#F2C94C'],
    [-2.5, -9.5, 2.6, '#E89AA8'],
    [3, -8.5, 2.4, '#F2C94C'],
    [-0.5, -12, 2.8, '#F6F1E6'],
  ];
  oval(ctx, -7, -9, 3, 1.4, T('#5E8C46'), 0.6);
  oval(ctx, 7, -10, 3, 1.4, T('#5E8C46'), -0.6);
  for (const [bx, by, r, c] of blooms) {
    disc(ctx, bx, by, r, T(c));
    disc(ctx, bx, by, r * 0.35, T(c === '#F6F1E6' ? '#E8B83A' : mix(c, '#7A4A20', 0.35)));
  }
  ctx.restore();
}

// ——— Figures in profile, for the wide and medium shots ———
type Pose = {
  x: number;
  /** The hip joint. */
  y: number;
  s?: number;
  facing?: 1 | -1;
  torso?: number;
  head?: number;
  /** Angles from hanging straight down; positive swings toward the facing side. */
  thighs?: readonly [number, number];
  shins?: readonly [number, number];
  arms?: readonly [number, number];
  fore?: readonly [number, number];
  eyes?: 'open' | 'half' | 'closed';
  mouth?: 'flat' | 'open';
  flowers?: boolean;
  bare?: boolean;
  T?: Tone;
};
const LEG = 13,
  UPPER = 11,
  LOWER = 10;
/** Hip height above the feet when standing. */
const HIP = LEG * 2 + 1;
const SIT = { thighs: [1.42, 1.5], shins: [0.06, 0.02] } as const;
function walking(phase: number, stride = 0.4) {
  const a = Math.sin(phase) * stride;
  return {
    thighs: [a, -a] as const,
    shins: [
      a - Math.max(0, Math.cos(phase)) * 0.5,
      -a - Math.max(0, -Math.cos(phase)) * 0.5,
    ] as const,
    arms: [-a * 0.8, a * 0.8] as const,
    fore: [-a * 0.8 + 0.2, a * 0.8 + 0.2] as const,
    bob: Math.abs(Math.cos(phase)) * 0.8,
  };
}

function profileHead(ctx: Ctx, who: Who, q: Pose, T: Tone) {
  const skin = T(who.skin),
    shade = T(who.shade),
    hair = T(who.hair),
    ink = T(INK);
  box(ctx, -2.2, -5, 4.6, 6, shade);
  const cx = 0.6,
    cy = -11.5;
  if (who.kind === 'amara') disc(ctx, cx - 6.6, cy - 3.4, 3.7, hair);
  if (who.kind === 'wife') oval(ctx, cx - 1.4, cy - 1.4, 7.8, 8.2, T(SCARF));
  oval(ctx, cx, cy, 6.2, 7.3, skin);
  poly(ctx, skin, [cx + 5.2, cy - 2.6, cx + 8.2, cy + 1.3, cx + 5.4, cy + 2.2]);
  oval(ctx, cx + 2.8, cy + 5, 3.2, 2.4, skin);
  oval(ctx, cx - 1.6, cy + 0.4, 1.5, 2.1, shade);
  switch (who.kind) {
    case 'amara':
      poly(ctx, hair, [
        cx - 6.2,
        cy + 1.5,
        cx - 6.8,
        cy - 3.5,
        cx - 3.5,
        cy - 7.5,
        cx + 1.5,
        cy - 7.9,
        cx + 5.4,
        cy - 5.2,
        cx + 5.8,
        cy - 3.4,
        cx + 2,
        cy - 4.8,
        cx - 2,
        cy - 4.2,
        cx - 3.4,
        cy - 1.4,
      ]);
      box(ctx, cx - 1.9, cy + 2.4, 1, 1, T('#F2C14E'));
      break;
    case 'hale':
      poly(ctx, hair, [
        cx - 6.3,
        cy + 2.4,
        cx - 6.6,
        cy - 2.6,
        cx - 4.6,
        cy - 6.2,
        cx - 1.6,
        cy - 7.4,
        cx + 2.4,
        cy - 7.1,
        cx - 1.4,
        cy - 5.8,
        cx - 3.2,
        cy - 2.2,
        cx - 3.3,
        cy + 1.8,
      ]);
      break;
    case 'wife':
      poly(ctx, T(SCARF), [
        cx - 6.8,
        cy + 3,
        cx - 7,
        cy - 4,
        cx - 3,
        cy - 8.6,
        cx + 3,
        cy - 8.4,
        cx + 6.4,
        cy - 5,
        cx + 4.6,
        cy - 4.4,
        cx + 0.5,
        cy - 5.8,
        cx - 3.4,
        cy - 3,
      ]);
      box(ctx, cx + 1.4, cy - 5.4, 3.6, 1.6, hair);
      poly(ctx, T(SCARF), [cx + 0.6, cy + 5.6, cx + 3.8, cy + 7.4, cx + 1, cy + 8.8]);
      break;
    default:
      if (q.bare)
        poly(ctx, hair, [
          cx - 6.4,
          cy + 2,
          cx - 6.6,
          cy - 3,
          cx - 4,
          cy - 7,
          cx + 2,
          cy - 7.8,
          cx + 5.4,
          cy - 5.6,
          cx + 3,
          cy - 5.4,
          cx - 2.6,
          cy - 3.6,
          cx - 3.2,
          cy + 1.2,
        ]);
      else {
        box(ctx, cx - 6.4, cy - 3, 3, 5, hair);
        poly(ctx, T(CAP), [
          cx - 7.4,
          cy - 4.2,
          cx - 7,
          cy - 9.6,
          cx - 2,
          cy - 11.6,
          cx + 5.6,
          cy - 10.4,
          cx + 6.6,
          cy - 5,
          cx + 6,
          cy - 4.2,
        ]);
        box(ctx, cx - 7, cy - 5.8, 13.4, 1.8, T('#15251F'));
        poly(ctx, T('#0E0E12'), [
          cx + 4,
          cy - 4.4,
          cx + 10,
          cy - 3.4,
          cx + 9,
          cy - 2.6,
          cx + 3.6,
          cy - 3.2,
        ]);
        box(ctx, cx + 3, cy - 6.2, 2, 1.6, T(BRASS));
      }
  }
  const brow =
    who.kind === 'amara'
      ? '#140E0E'
      : who.kind === 'hale'
        ? '#D8D4CC'
        : who.kind === 'wife'
          ? '#6A3A22'
          : who.kind === 'young'
            ? '#4A2E1C'
            : '#6E6862';
  box(ctx, cx + 2.2, cy - 4, 3.6, 1.1, T(brow));
  const eyes = q.eyes ?? 'open';
  if (eyes === 'open') box(ctx, cx + 3.3, cy - 2, 1.3, 2.1, ink);
  else if (eyes === 'half') box(ctx, cx + 2.8, cy - 1.1, 2.2, 1.1, ink);
  else box(ctx, cx + 2.6, cy - 0.6, 2.6, 0.9, ink);
  box(ctx, cx + 4.4, cy + 3.6, 2.2, q.mouth === 'open' ? 1.8 : 0.9, T('#5E302C'));
  if (who.kind === 'sol') {
    box(ctx, cx + 4.2, cy + 2.4, 3.6, 1.2, T('#8C867E'));
    poly(ctx, alpha(T('#5A544E'), 0.35), [
      cx - 1,
      cy + 2,
      cx + 6,
      cy + 4.5,
      cx + 4.5,
      cy + 7,
      cx,
      cy + 6,
    ]);
  }
}

/** A grown-up in profile, about 61 px tall standing at s = 1; (x, y) is the hip joint. */
function figure(ctx: Ctx, who: Who, q: Pose) {
  const T = q.T ?? keep;
  const s = q.s ?? 1;
  const lean = q.torso ?? 0;
  const ts = Math.sin(lean),
    tc = Math.cos(lean);
  const [bt, ft] = q.thighs ?? [0, 0];
  const [bs, fs] = q.shins ?? [0, 0];
  const [ba, fa] = q.arms ?? [0.06, 0.14];
  const [bf, ff] = q.fore ?? [0.16, 0.3];
  ctx.save();
  ctx.translate(q.x, q.y);
  ctx.scale(s * (q.facing ?? 1), s);
  const sx = ts * 17.5,
    sy = -tc * 17.5;
  const arm = (a: number, f: number, color: string) => {
    const ex = sx + Math.sin(a) * UPPER,
      ey = sy + Math.cos(a) * UPPER;
    const hx = ex + Math.sin(f) * LOWER,
      hy = ey + Math.cos(f) * LOWER;
    line(ctx, color, 3.8, [sx, sy, ex, ey, hx, hy]);
    disc(ctx, hx, hy, 1.9, T(who.skin));
    return [hx, hy] as const;
  };
  const leg = (th: number, sh: number, color: string) => {
    const kx = Math.sin(th) * LEG,
      ky = Math.cos(th) * LEG;
    const fx = kx + Math.sin(sh) * LEG,
      fy = ky + Math.cos(sh) * LEG;
    line(ctx, color, 4.6, [0, 0, kx, ky, fx, fy]);
    poly(ctx, T(who.shoes), [
      fx - 2.6,
      fy - 1.4,
      fx + 3.4,
      fy - 1.2,
      fx + 4.6,
      fy + 1.6,
      fx - 2.6,
      fy + 1.6,
    ]);
  };
  arm(ba, bf, T(who.coatD));
  leg(bt, bs, T(mix(who.legs, INK, 0.3)));
  leg(ft, fs, T(who.legs));
  // A long overcoat hangs over the thighs; a parka or a uniform jacket stops at the hip.
  const long = who.kind === 'hale' || who.kind === 'wife';
  const th = (bt + ft) / 2;
  const dx = Math.sin(th),
    dy = Math.cos(th);
  const reach = long ? 15 : 4;
  poly(ctx, T(long ? who.coat : who.coatD), [
    dy * 5.5,
    -dx * 5.5,
    -dy * 5.5,
    dx * 5.5,
    dx * reach - dy * 6,
    dy * reach + dx * 6,
    dx * reach + dy * 6,
    dy * reach - dx * 6,
  ]);
  line(ctx, T(who.coat), 10.5, [0, -1, sx * 0.96, sy * 0.96]);
  line(ctx, T(who.coatD), 2.4, [-4.2 * tc, -1 - 4.2 * ts, sx - 4.2 * tc, sy - 4.2 * ts]);
  // Collars, and the ID card on Amara's lanyard.
  const nx = sx + tc * 3.2,
    ny = sy + ts * 3.2;
  if (who.kind === 'amara') {
    disc(ctx, nx, ny + 1, 2.2, T(SCRUBS));
    line(ctx, T('#C8463A'), 0.8, [nx, ny, nx + ts * -6 + tc * 0.6, ny + tc * 6]);
    box(ctx, nx - ts * 7 - 0.6, ny + tc * 6, 2.4, 3, T('#F2F2EE'));
  } else if (who.kind !== 'wife') disc(ctx, nx, ny + 0.5, 1.8, T('#EEEAE0'));
  ctx.save();
  ctx.translate(sx + ts * 1.5, sy - tc * 1.5);
  ctx.rotate(lean + (q.head ?? 0));
  profileHead(ctx, who, q, T);
  ctx.restore();
  const hand = arm(fa, ff, T(who.coat));
  if (q.flowers) bouquet(ctx, hand[0] + 2, hand[1] - 1, 0.5, T, 1.35);
  ctx.restore();
}

// ——— Small figures facing the camera, for the seafront ———
type Front = {
  x: number;
  /** Ground under the feet, or the seat under the hips when sitting. */
  y: number;
  s: number;
  sit?: boolean;
  arms?: 'down' | 'lap' | 'wave' | 'cap' | 'hold' | 'link';
  wave?: number;
  tilt?: number;
  eyes?: 'open' | 'closed';
  bare?: boolean;
  T?: Tone;
};
function frontHead(ctx: Ctx, who: Who, f: Front, T: Tone) {
  const skin = T(who.skin),
    hair = T(who.hair),
    ink = T(INK);
  if (who.kind === 'amara') disc(ctx, 0, -9.6, 4, hair);
  if (who.kind === 'wife') oval(ctx, 0, 0.6, 8.6, 9, T(SCARF));
  if (who.kind === 'hale') {
    oval(ctx, -6.4, -1, 2.4, 4, hair);
    oval(ctx, 6.4, -1, 2.4, 4, hair);
  }
  oval(ctx, 0, 0, 7, 8, skin);
  switch (who.kind) {
    case 'amara':
      poly(ctx, hair, [-7, 0, -6.6, -5, -3, -7.9, 3, -7.9, 6.6, -5, 7, 0, 5, -4, 0, -5, -5, -4]);
      break;
    case 'hale':
      poly(
        ctx,
        hair,
        [-6.6, -2, -5.6, -5.6, -2, -7.4, 2.4, -7.4, 5.8, -5.4, 3, -5.6, -1, -5.2, -4.6, -3.4],
      );
      break;
    case 'wife':
      poly(
        ctx,
        T(SCARF),
        [-8, 2, -7.4, -5, -3, -8.8, 3, -8.8, 7.4, -5, 8, 2, 6, -3, 0, -5, -6, -3],
      );
      box(ctx, -3, -5.2, 6, 1.6, hair);
      break;
    default:
      if (f.bare)
        poly(ctx, hair, [-7, 0, -6.8, -5, -3, -8, 3, -8, 6.8, -5, 7, 0, 5, -4.6, -5, -4.6]);
      else {
        box(ctx, -7.2, -3, 2.4, 5, hair);
        box(ctx, 4.8, -3, 2.4, 5, hair);
        poly(ctx, T(CAP), [-8.4, -3.6, -8, -9, -4, -11, 4, -11, 8, -9, 8.4, -3.6]);
        box(ctx, -8.2, -5, 16.4, 1.8, T('#15251F'));
        box(ctx, -7.6, -3.4, 15.2, 1.6, T('#0E0E12'));
        box(ctx, -1.2, -7, 2.4, 1.8, T(BRASS));
      }
  }
  if (f.eyes === 'closed') {
    box(ctx, -4.2, 0.6, 2.6, 0.9, ink);
    box(ctx, 1.6, 0.6, 2.6, 0.9, ink);
  } else {
    box(ctx, -3.4, -0.6, 1.3, 2, ink);
    box(ctx, 2.1, -0.6, 1.3, 2, ink);
  }
  if (who.kind === 'sol') box(ctx, -2.3, 2.6, 4.6, 1.3, T('#8C867E'));
  box(ctx, -1.2, 4.2, 2.4, 0.9, T('#5E302C'));
}
/** A townsperson facing us, about 63 px tall at s = 1. */
function frontal(ctx: Ctx, who: Who, f: Front) {
  const T = f.T ?? keep;
  const legs = T(who.legs),
    legsD = T(mix(who.legs, INK, 0.22)),
    coat = T(who.coat),
    coatD = T(who.coatD),
    skin = T(who.skin),
    shoes = T(who.shoes);
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.s, f.s);
  if (f.sit) {
    box(ctx, -7.5, -2, 6.5, 5, legs);
    box(ctx, 1, -2, 6.5, 5, legs);
    box(ctx, -7, 3, 5.5, 11, legsD);
    box(ctx, 1.5, 3, 5.5, 11, legsD);
    box(ctx, -8, 13, 7, 3, shoes);
    box(ctx, 1, 13, 7, 3, shoes);
    ctx.translate(0, -1);
  } else {
    box(ctx, -6.5, -26, 5.5, 24, legsD);
    box(ctx, 1, -26, 5.5, 24, legs);
    box(ctx, -7.5, -3, 7, 3, shoes);
    box(ctx, 0.5, -3, 7, 3, shoes);
    ctx.translate(0, -25);
  }
  const long = who.kind === 'hale' || who.kind === 'wife';
  if (long && !f.sit) poly(ctx, coat, [-9.5, -2, 9.5, -2, 10.5, 14, -10.5, 14]);
  poly(ctx, coat, [-9, 1, 9, 1, 9.5, -17, 6, -21, -6, -21, -9.5, -17]);
  box(ctx, -9, -17, 3, 18, coatD);
  switch (who.kind) {
    case 'amara':
      poly(ctx, T(SCRUBS), [-3.5, -21, 3.5, -21, 0, -15]);
      line(ctx, T('#C8463A'), 0.8, [-2.4, -20, 1.2, -9]);
      box(ctx, 0, -9.5, 3, 3.6, T('#F2F2EE'));
      break;
    case 'hale':
      poly(ctx, T('#F1EEE6'), [-3, -21, 3, -21, 0, -16]);
      box(ctx, -0.7, -18.5, 1.4, 7, T('#2E4A3F'));
      break;
    case 'wife':
      poly(ctx, T(SCARF), [-3, -21, 3, -21, 0, -17]);
      break;
    default:
      poly(ctx, T('#E9E6DE'), [-3, -21, 3, -21, 0, -16]);
      box(ctx, -0.6, -18, 1.2, 6, T('#1C2E26'));
  }
  const limb = (points: number[], color: string) => {
    line(ctx, color, 3.8, points);
    disc(ctx, points[points.length - 2], points[points.length - 1], 1.9, skin);
  };
  switch (f.arms ?? 'down') {
    case 'down':
      limb([-8.5, -18, -10, -9, -9.5, -1], coatD);
      limb([8.5, -18, 10, -9, 9.5, -1], coat);
      break;
    case 'lap':
      limb([-8.5, -18, -9.5, -8, -3.5, -3], coatD);
      limb([8.5, -18, 9.5, -8, 3.5, -3], coat);
      break;
    case 'wave': {
      const w = Math.sin(f.wave ?? 0) * 3;
      limb([-8.5, -18, -10, -9, -9.5, -1], coatD);
      limb([8.5, -18, 13, -25, 14 + w, -35], coat);
      break;
    }
    case 'cap':
    case 'hold':
      limb([-8.5, -18, -9.5, -9, -2.5, -11], coatD);
      limb([8.5, -18, 9.5, -9, 2.5, -11], coat);
      break;
    case 'link':
      limb([-8.5, -18, -10, -9, -9.5, -2], coatD);
      limb([8.5, -18, 11, -9, 15, -7], coat);
      break;
  }
  if (f.arms === 'cap') {
    oval(ctx, 0, -10, 6.5, 3, T(CAP));
    box(ctx, -1.2, -12, 2.4, 1.6, T(BRASS));
  }
  box(ctx, -2.5, -25, 5, 5, T(who.shade));
  ctx.save();
  ctx.translate(0, -30);
  ctx.rotate(f.tilt ?? 0);
  frontHead(ctx, who, f, T);
  ctx.restore();
  ctx.restore();
}

// ——— Close-ups: big faces that can act ———
type Face = {
  eyes?: 'open' | 'half' | 'closed' | 'down' | 'wide';
  /** Pupil direction, -1..1 each way. */
  look?: readonly [number, number];
  /** Positive lifts the inner ends (worry, grief); negative knits them (resolve). */
  brows?: number;
  raise?: number;
  mouth?: 'flat' | 'soft' | 'sad' | 'part' | 'smile' | 'talk';
  /** -1..1: a three-quarter turn toward screen left or right. */
  turn?: number;
  tilt?: number;
  /** Eyes welling up, 0..1. */
  wet?: number;
  /** A coloured light falling on the face from (keyX, keyY). */
  key?: string;
  keyX?: number;
  keyY?: number;
  keyAmount?: number;
  T?: Tone;
};

function collar(ctx: Ctx, who: Who, T: Tone) {
  switch (who.kind) {
    case 'amara':
      oval(ctx, 0, 33, 27, 7, T(who.coatD));
      poly(ctx, T(SCRUBS), [-12, 30, 12, 30, 0, 48]);
      poly(ctx, T('#2F6F7C'), [-12, 30, -9, 30, 0, 44, 0, 48]);
      line(ctx, T('#C8463A'), 1.6, [-9, 32, -5, 62]);
      line(ctx, T('#C8463A'), 1.6, [9, 32, 5, 62]);
      box(ctx, -6, 60, 12, 15, T('#F2F2EE'));
      box(ctx, -4, 62, 5, 6, T('#8FB3C4'));
      box(ctx, -4, 70, 8, 1.4, T('#8FB3C4'));
      line(ctx, T(who.coatD), 1.6, [-15, 42, -18, 96]);
      line(ctx, T(who.coatD), 1.6, [15, 42, 18, 96]);
      break;
    case 'hale':
      poly(ctx, T('#F4F1E8'), [-11, 29, 11, 29, 0, 44]);
      poly(ctx, T('#FFFFFF'), [-11, 28, -1, 32, -7, 38]);
      poly(ctx, T('#FFFFFF'), [11, 28, 1, 32, 7, 38]);
      poly(ctx, T('#2E4A3F'), [-2.8, 34, 2.8, 34, 4, 62, 0, 67, -4, 62]);
      box(ctx, -3, 31.5, 6, 4, T('#233A31'));
      poly(ctx, T(who.coatD), [-19, 30, -3, 70, -16, 64, -30, 40]);
      poly(ctx, T(who.coatD), [19, 30, 3, 70, 16, 64, 30, 40]);
      line(ctx, T(mix(who.coat, '#FFFFFF', 0.2)), 1, [-19, 31, -4, 68]);
      break;
    default:
      poly(ctx, T('#ECE8DE'), [-11, 29, 11, 29, 0, 43]);
      poly(ctx, T('#1C2E26'), [-2.6, 33, 2.6, 33, 3.6, 60, 0, 64, -3.6, 60]);
      poly(ctx, T(who.coatD), [-18, 30, -4, 62, -26, 42]);
      poly(ctx, T(who.coatD), [18, 30, 4, 62, 26, 42]);
  }
}

/**
 * A head-and-shoulders close-up, the face about 46 × 48 at s = 1, centred on (x, y). Eyes,
 * brows and mouth all act; a coloured key light can fall across the skin.
 */
function portrait(ctx: Ctx, who: Who, x: number, y: number, s: number, f: Face) {
  const T = f.T ?? keep;
  const u = (f.turn ?? 0) * 6;
  const skin = T(who.skin),
    shade = T(who.shade),
    hair = T(who.hair),
    ink = T(INK);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  poly(ctx, T(who.coat), [-48, 100, -44, 46, -19, 31, 19, 31, 44, 46, 48, 100]);
  poly(ctx, T(who.coatD), [-48, 100, -44, 46, -32, 38, -33, 100]);
  box(ctx, -7.5 + u * 0.25, 12, 15, 21, shade);
  collar(ctx, who, T);
  ctx.translate(0, 20);
  ctx.rotate(f.tilt ?? 0);
  ctx.translate(0, -20);
  // Behind the head.
  if (who.kind === 'amara') {
    disc(ctx, -2 + u * 0.3, -25, 9, hair);
    line(ctx, T('#3A2C28'), 1.2, [-8 + u * 0.3, -29, -2 + u * 0.3, -32, 4 + u * 0.3, -30]);
  }
  if (who.kind === 'hale' || who.kind === 'sol' || who.kind === 'young') {
    oval(ctx, -18.5 + u * 0.3, -4, 4, 8, hair);
    oval(ctx, 18.5 + u * 0.3, -4, 4, 8, hair);
  }
  if (u < 5) oval(ctx, -19.5 + u * 0.35, 3, 3.8, 6.2, skin);
  if (u > -5) oval(ctx, 19.5 + u * 0.35, 3, 3.8, 6.2, skin);
  if (who.kind === 'amara') {
    if (u < 5) disc(ctx, -19.8 + u * 0.35, 8, 1.3, T('#F2C14E'));
    if (u > -5) disc(ctx, 19.8 + u * 0.35, 8, 1.3, T('#F2C14E'));
  }
  if (who.kind === 'hale') {
    // Big old ears.
    if (u < 5) oval(ctx, -20 + u * 0.35, 4, 4.6, 7.6, skin);
    if (u > -5) oval(ctx, 20 + u * 0.35, 4, 4.6, 7.6, skin);
  }
  oval(ctx, u * 0.15, 0, 19, 23, skin);
  // The far cheek falls into shadow.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(u * 0.15, 0, 19, 23, 0, 0, Math.PI * 2);
  ctx.clip();
  oval(ctx, -u * 2.6 + (u >= 0 ? -21 : 21), 4, 12, 26, alpha(shade, 0.55));
  if (f.key && (f.keyAmount ?? 0) > 0) glow(ctx, f.keyX ?? 0, f.keyY ?? 0, 40, f.key, f.keyAmount);
  ctx.restore();
  // Age, tiredness, stubble.
  if (who.kind === 'hale') {
    line(ctx, alpha(shade, 0.9), 0.9, [u - 9, -13.5, u - 2, -14.5, u + 8, -13.5]);
    line(ctx, alpha(shade, 0.8), 0.9, [u - 7, -17, u + 6, -17]);
    line(ctx, shade, 1.1, [u - 5.5, 8, u - 8.5, 13, u - 8, 17]);
    line(ctx, shade, 1.1, [u + 5.5, 8, u + 8.5, 13, u + 8, 17]);
    for (const sd of [-1, 1]) {
      const ex = sd * 8 + u;
      line(ctx, alpha(shade, 0.9), 0.8, [ex + sd * 5.5, -3.5, ex + sd * 8.5, -5]);
      line(ctx, alpha(shade, 0.9), 0.8, [ex + sd * 5.5, -1, ex + sd * 8.5, -0.5]);
      line(ctx, alpha(shade, 0.9), 1, [ex - 3.5, 4.2, ex, 5.8, ex + 3.5, 4.2]);
    }
  }
  // Sixteen hours on her feet, under the eyes.
  if (who.kind === 'amara')
    for (const sd of [-1, 1]) {
      const ex = sd * 8 + u;
      oval(ctx, ex, 5, 4.2, 1.6, alpha(shade, 0.45));
    }
  if (who.kind === 'sol')
    poly(ctx, alpha(T('#5E5852'), 0.45), [
      -17 + u * 0.1,
      4,
      -12 + u * 0.1,
      18,
      -4 + u,
      23,
      4 + u,
      23,
      12 + u * 0.1,
      18,
      17 + u * 0.1,
      4,
      12 + u,
      12,
      -12 + u,
      12,
    ]);
  // Eyes.
  const eyes = f.eyes ?? 'open';
  const [lx, ly] = f.look ?? [0, 0];
  const iris = who.kind === 'hale' ? '#5B7390' : who.kind === 'amara' ? '#3A2418' : '#4A3A2A';
  for (const sd of [-1, 1]) {
    const ex = sd * 8 + u,
      ey = -2;
    if (eyes === 'closed') {
      line(ctx, ink, 1.3, [ex - 4.2, ey + 0.6, ex, ey + 2.4, ex + 4.2, ey + 0.6]);
      continue;
    }
    const wide = eyes === 'wide' ? 1.15 : 1;
    const px = ex + lx * 1.7,
      py = ey + ly * 1.5 + (eyes === 'down' ? 1.6 : 0);
    oval(ctx, ex, ey, 4.5 * wide, 4.7 * wide, T('#F8F4EE'));
    disc(ctx, px, py + 0.4, 2.7, T(iris));
    disc(ctx, px, py + 0.4, 1.3, ink);
    disc(ctx, px - 0.9, py - 0.5, 0.8, '#FFFFFF');
    const heavy = who.kind === 'hale' || who.kind === 'sol';
    const lid = eyes === 'half' ? 0.55 : eyes === 'down' ? 0.62 : heavy ? 0.3 : 0.12;
    const top = ey - 5.2,
      cut = ey - 5.2 + lid * 9.4;
    poly(ctx, skin, [ex - 5.4, top - 1, ex + 5.4, top - 1, ex + 5.4, cut, ex - 5.4, cut]);
    line(ctx, ink, 1.2, [ex - 4.6, cut + 0.6, ex, cut - 0.2, ex + 4.6, cut + 0.6]);
    if ((f.wet ?? 0) > 0) {
      disc(ctx, px + 1.1, py + 1.6, 0.7 * (f.wet ?? 0), alpha('#FFFFFF', 0.9));
      line(ctx, alpha('#CFEAF5', f.wet ?? 0), 1.1, [ex - 3.6, ey + 4.4, ex + 3.6, ey + 4.4]);
    }
  }
  // Brows.
  const browC = T(
    who.kind === 'amara'
      ? '#150F0F'
      : who.kind === 'hale'
        ? '#E4E0D8'
        : who.kind === 'young'
          ? '#3E2616'
          : '#6E6862',
  );
  const b = f.brows ?? 0;
  const thick = who.kind === 'hale' ? 3 : who.kind === 'amara' ? 1.8 : 2.4;
  for (const sd of [-1, 1]) {
    const ex = sd * 8 + u;
    const base = -10 - (f.raise ?? 0) * 3.5;
    line(ctx, browC, thick, [ex + sd * 5.2, base + b * 0.8, ex - sd * 4, base - b * 2.4]);
    if (who.kind === 'hale')
      line(ctx, T('#B8B2A8'), 0.8, [
        ex + sd * 5.2,
        base + b * 0.8 + 1.6,
        ex - sd * 4,
        base - b * 2.4 + 1.6,
      ]);
  }
  // Nose.
  oval(ctx, u * 1.15, 7.5, who.kind === 'hale' ? 3 : 2.5, 3.2, shade);
  oval(ctx, u * 1.15 - 0.7, 6.3, 1.1, 1.3, alpha('#FFFFFF', 0.25));
  if (who.kind === 'sol')
    poly(ctx, T('#8C867E'), [
      u - 8,
      12.5,
      u - 3,
      10.2,
      u,
      11,
      u + 3,
      10.2,
      u + 8,
      12.5,
      u + 5,
      13.6,
      u,
      12.6,
      u - 5,
      13.6,
    ]);
  // Mouth.
  const mx = u,
    my = 15.5;
  const lip = T(who.kind === 'amara' ? '#3E1E18' : INK);
  switch (f.mouth ?? 'flat') {
    case 'flat':
      line(ctx, lip, 1.4, [mx - 5, my + 1, mx + 5, my + 1]);
      break;
    case 'soft':
      line(ctx, lip, 1.4, [
        mx - 5.5,
        my + 0.2,
        mx - 2,
        my + 1.6,
        mx + 2,
        my + 1.6,
        mx + 5.5,
        my + 0.2,
      ]);
      break;
    case 'smile':
      line(ctx, lip, 1.4, [
        mx - 6,
        my - 0.4,
        mx - 2.5,
        my + 2.4,
        mx + 2.5,
        my + 2.4,
        mx + 6,
        my - 0.4,
      ]);
      break;
    case 'sad':
      line(ctx, lip, 1.4, [
        mx - 5.5,
        my + 2.6,
        mx - 2,
        my + 0.8,
        mx + 2,
        my + 0.8,
        mx + 5.5,
        my + 2.6,
      ]);
      break;
    case 'part':
      oval(ctx, mx, my + 1.4, 3.6, 1.6, lip);
      break;
    case 'talk':
      oval(ctx, mx, my + 1.8, 3.2, 2.8, lip);
      oval(ctx, mx, my + 3.2, 2, 1, T('#B8605A'));
      break;
  }
  // Hair in front, and Sol's cap.
  const h = (points: number[], color = hair) =>
    poly(
      ctx,
      color,
      points.map((v, i) => (i % 2 ? v : v + u * 0.3)),
    );
  switch (who.kind) {
    case 'amara':
      h([
        -20, 2, -20, -10, -15, -19.5, -6, -24, 4, -24.5, 13, -21, 19, -12.5, 20, 2, 17.5, -8, 12,
        -14.5, 4, -17, -4, -16.5, -12, -14, -17, -8,
      ]);
      line(ctx, T('#3A2A26'), 1, [-4 + u * 0.3, -22, 6 + u * 0.3, -21, 13 + u * 0.3, -17]);
      // A strand come loose after sixteen hours.
      line(ctx, hair, 1, [15 + u * 0.3, -14, 18 + u * 0.3, -4, 16.5 + u * 0.3, 5]);
      break;
    case 'hale':
      h([
        -19.5, -3, -19, -12, -14, -19, -6, -22, 4, -22.5, 12, -20, 17.5, -14, 19.5, -4, 16.5, -11,
        9.5, -16, 1, -17.5, -8, -16, -14.5, -12,
      ]);
      line(ctx, T('#C4BEB4'), 0.9, [-6 + u * 0.3, -21.5, -11 + u * 0.3, -15]);
      break;
    case 'sol':
    case 'young': {
      const capc = T(CAP);
      h([-24, -11, -22, -24, -12, -31, 12, -31, 22, -24, 24, -11], capc);
      h([-23, -15.5, 23, -15.5, 23, -10.5, -23, -10.5], T('#15251F'));
      h([-21, -11, 21, -11, 17, -5, -17, -5], T('#0E0E12'));
      line(ctx, alpha('#FFFFFF', 0.2), 1, [-15 + u * 0.3, -9.5, 15 + u * 0.3, -9.5]);
      badge(ctx, u * 0.3, -21, 0.42, T);
      break;
    }
    default:
      h([
        -19, -2, -18, -14, -10, -21, 4, -22, 14, -18, 19, -8, 19, -2, 14, -12, 4, -16, -8, -14, -14,
        -9,
      ]);
  }
  ctx.restore();
}

// ——— Hands, for the inserts ———
type HandOpts = {
  /** The wedding ring, and how much it catches the light (0 plain, 1 a glint). */
  ring?: number;
  /** How far the fingers curl over whatever they hold, 0..1. */
  curl?: number;
  /** The index finger out straight, the others folded. */
  point?: boolean;
  /** Knuckles whiten as the hand tightens. */
  grip?: number;
  sleeve?: string;
  cuff?: string;
  T?: Tone;
};
/**
 * The back of a hand seen from above, fingers pointing right from the knuckles at (x, y), thumb
 * on the upper side. About 55 px from wrist to fingertip at s = 1.
 */
function topHand(
  ctx: Ctx,
  who: Who,
  x: number,
  y: number,
  s: number,
  rot: number,
  o: HandOpts = {},
) {
  const T = o.T ?? keep;
  const old = who.kind === 'hale';
  const grip = o.grip ?? 0;
  const skin = T(mix(who.skin, '#FFF0E6', grip * 0.22)),
    shade = T(who.shade),
    nail = T(mix(who.skin, '#FFFFFF', 0.4));
  const curl = o.curl ?? 0.3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  if (o.sleeve) poly(ctx, T(o.sleeve), [-110, -17, -30, -14, -28, 15, -110, 19]);
  if (o.cuff) box(ctx, -35, -12, 7, 24, T(o.cuff));
  poly(ctx, skin, [-30, -9.5, -14, -11.5, 0, -12.5, 3, -11, 3, 12, 0, 13.5, -14, 11.5, -30, 9.5]);
  // The thumb, along the upper side.
  line(ctx, skin, 6.2, [-24, -8, -9, -14.5, 1, -16.5]);
  oval(ctx, 2.4, -16.6, 1.8, 1.5, nail);
  line(ctx, alpha(shade, 0.7), 0.8, [-7, -13.6, -2, -15.4]);
  const fingers: readonly (readonly [number, number, number])[] = [
    [-8.3, 21, 5.4],
    [-2.7, 23, 5.5],
    [2.9, 21, 5.2],
    [8.2, 16.5, 4.6],
  ];
  fingers.forEach(([fy, len, w], i) => {
    const straight = o.point && i === 0;
    const L = straight ? len + 3 : o.point ? len * 0.42 : len * (1 - curl * 0.3);
    const drop = straight ? 0 : curl * 2.4;
    line(ctx, skin, w, [0, fy, L, fy + drop]);
    if (!straight && (curl > 0.45 || o.point))
      line(ctx, shade, w * 0.86, [L - 1.8, fy + drop + 0.2, L + 0.4, fy + drop + 0.8]);
    else oval(ctx, L - 0.2, fy + drop, 1.9, w * 0.3, nail);
    for (const k of [0.36, 0.7]) {
      const jx = L * k;
      line(ctx, alpha(shade, 0.7), 0.7, [
        jx,
        fy - w * 0.28 + drop * k,
        jx + 0.4,
        fy + w * 0.28 + drop * k,
      ]);
    }
    oval(ctx, 0.6, fy, 2.2, w * 0.36, alpha(old ? '#D98A78' : shade, 0.35 + grip * 0.25));
  });
  for (const gy of [-5.5, 0.1, 5.6]) line(ctx, alpha(shade, 0.85), 0.7, [-3, gy, 9, gy + curl]);
  // Tendons; and for an old hand, veins and a few spots.
  for (const gy of [-7, -2, 3]) line(ctx, alpha(shade, 0.3), 0.8, [-24, gy * 0.6, -3, gy]);
  if (old) {
    line(ctx, alpha('#8A98C4', 0.5), 1.1, [-29, 1.5, -20, -1.5, -10, 1, -4, -1]);
    line(ctx, alpha('#8A98C4', 0.42), 1, [-27, 6.5, -16, 4.8, -6, 6]);
    disc(ctx, -17, -6, 1.5, alpha(shade, 0.65));
    disc(ctx, -22, 3.5, 1.1, alpha(shade, 0.55));
    disc(ctx, -9, 8, 0.9, alpha(shade, 0.55));
  }
  if (o.ring !== undefined) {
    box(ctx, 3.6, -0.6, 3.2, 7, T(BRASS));
    box(ctx, 4.2, -0.4, 0.9, 6.6, T(BRASS_HI));
    box(ctx, 6.2, -0.4, 0.6, 6.6, T('#8A6420'));
    if (o.ring > 0) glow(ctx, 5.2, 1.4, 12, BRASS_HI, 0.6 * o.ring);
  }
  ctx.restore();
}

// ——— The bus from outside ———
type BusLook = {
  T: Tone;
  seconds: number;
  /** Cabin light, 0..1. */
  lit: number;
  wheel: number;
  old?: boolean;
  indicator?: boolean;
  /** An idling engine: a shiver and a little exhaust. */
  idle?: number;
  door?: number;
  cast?: 'night' | 'empty' | 'then' | 'home' | 'none';
  beams?: number;
};
/** A single-decker in bottle green and cream, facing right; (x, y) is the ground at the tail. */
function bus(ctx: Ctx, x: number, y: number, s: number, b: BusLook) {
  const T = b.T;
  const idle = b.idle ?? 0;
  const shiver = idle * (Math.sin(b.seconds * 41) > 0.2 ? 0.4 : 0);
  ctx.save();
  ctx.translate(x, y - shiver);
  ctx.scale(s, s);
  oval(ctx, 76, 0, 82, 3.4, alpha('#000000', 0.4));
  // Exhaust from the tail while the engine idles.
  if (idle > 0)
    for (let i = 0; i < 3; i++) {
      const k = (b.seconds * 0.7 + i / 3) % 1;
      disc(ctx, -3 - k * 16, -5 - k * 9, 2 + k * 5, alpha(T('#C8CCD8'), 0.28 * (1 - k) * idle));
    }
  const outline = b.old
    ? [0, -8, 0, -46, 3, -53, 11, -56, 126, -56, 137, -54, 145, -48, 149, -40, 151, -8]
    : [0, -8, 0, -51, 2, -54, 6, -56, 142, -56, 146, -54, 148, -50, 150, -30, 150, -8];
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < outline.length; i += 2)
    if (i) ctx.lineTo(outline[i], outline[i + 1]);
    else ctx.moveTo(outline[i], outline[i + 1]);
  ctx.closePath();
  ctx.clip();
  box(ctx, -2, -60, 156, 32, T(CREAM));
  box(ctx, -2, -30, 156, 24, T(b.old ? '#35664F' : GREEN));
  box(ctx, -2, -30, 156, 1.2, T(BRASS));
  box(ctx, -2, -19, 156, 2.4, T('#141418'));
  box(ctx, -2, -12, 156, 5, T(b.old ? '#264A39' : GREEN_D));
  box(ctx, -2, -56, 156, 2, alpha('#FFFFFF', 0.12));
  ctx.restore();
  // Windows: lit from inside.
  const pane = mix(T('#1E2232'), CABIN, b.lit);
  const top = b.old ? -49 : -50;
  const panes: readonly (readonly [number, number])[] = [
    [3, 12],
    [18, 20],
    [42, 20],
    [66, 20],
    [90, 20],
  ];
  for (const [px, pw] of panes) {
    box(ctx, px, top, pw, 18, pane);
    if (b.lit > 0) {
      box(ctx, px, top, pw, 3, alpha(CABIN_HI, 0.7 * b.lit));
      oval(ctx, px + pw / 2, top + 17, pw / 2 - 2, 3.4, mix(T(MAROON_D), MAROON, b.lit));
    }
  }
  // The door, and the windscreen.
  const door = b.door ?? 0;
  box(ctx, 113, top, 14, 42, mix(T('#1E2232'), mix(CABIN, '#B89A60', 0.3), b.lit));
  if (door < 1) {
    const pw = 7 * (1 - door * 0.75);
    box(ctx, 113, top, pw, 42, alpha(T('#0E1220'), 0.25));
    box(ctx, 127 - pw, top, pw, 42, alpha(T('#0E1220'), 0.25));
    box(ctx, 113 + pw - 0.6, top, 0.8, 42, T('#141418'));
    box(ctx, 127 - pw - 0.2, top, 0.8, 42, T('#141418'));
  }
  if (door > 0) box(ctx, 114, -9, 12, 2.4, T('#6A6A70'));
  const screen = b.old
    ? [131, -49, 141, -49, 146, -36, 131, -36]
    : [130, -51, 146, -51, 149.5, -31, 130, -31];
  poly(ctx, mix(T('#161A28'), mix(CABIN, '#7A6A50', 0.5), b.lit * 0.7), screen);
  // Who is aboard.
  const head = (hx: number, hy: number, who: Who, tilt = 0) => {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(tilt);
    const skin = mix(T(who.skin), who.skin, b.lit);
    const hair = mix(T(who.hair), who.hair, b.lit);
    if (who.kind === 'amara') disc(ctx, -3.6, -3, 2.2, hair);
    oval(ctx, 0, 0, 3.6, 4.2, skin);
    if (who.kind === 'sol' || who.kind === 'young') {
      box(ctx, -4, -5, 8, 2.6, mix(T(CAP), CAP, b.lit));
      box(ctx, 2, -3, 3.4, 1, '#0E0E12');
    } else box(ctx, -3.8, -4.4, 7, 2.2, hair);
    ctx.restore();
    box(ctx, hx - 3.5, hy + 4, 7, 4, mix(T(who.coat), who.coat, b.lit * 0.8));
  };
  const cast = b.cast ?? 'night';
  if (cast === 'night') {
    head(51, top + 9, AMARA, -0.35);
    head(99, top + 8, HALE);
    disc(ctx, 103, top + 15, 1.6, '#F6F1E6');
    disc(ctx, 105, top + 14, 1.2, '#F2C94C');
  }
  if (cast === 'home') {
    head(101, top + 9, AMARA, 0.05);
    head(96, top + 10, HALE, 0.45);
  }
  if (cast === 'then') head(137, top + 10, YOUNG);
  else if (cast !== 'none') head(137, top + 10, SOL);
  // Rain on the glass.
  for (let i = 0; i < 12; i++) {
    const rx = 4 + rand(i * 3.1) * 105,
      ry = top + 2 + ((rand(i * 1.7) * 16 + b.seconds * (3 + rand(i) * 4)) % 15);
    box(ctx, rx, ry, 0.8, 2, alpha('#DDE6F5', 0.35));
  }
  // Wheels.
  for (const wx of [28, 122]) {
    disc(ctx, wx, -8, 11, T('#08080C'));
    disc(ctx, wx, -8, 8.4, T('#18181E'));
    disc(ctx, wx, -8, 4.4, T(b.old ? '#B8BCC4' : '#868C96'));
    for (let k = 0; k < 3; k++) {
      const a = b.wheel + (k * Math.PI * 2) / 3;
      line(ctx, T('#3A3E46'), 1, [wx, -8, wx + Math.cos(a) * 4, -8 + Math.sin(a) * 4]);
    }
  }
  // Destination blind, crest, lamps.
  box(ctx, 119, -55.5, 27, 5.5, '#111114');
  write(ctx, '7 SEAFRONT', 132.5, -51.4, { size: 4, color: mix(T(AMBER), AMBER, b.lit) });
  badge(ctx, 80, -23.5, 0.3, T);
  if (b.old) {
    box(ctx, 146, -30, 5, 14, T('#B8BCC4'));
    for (let i = 0; i < 4; i++) box(ctx, 146.5, -28 + i * 3.4, 4, 1, T('#6A6E76'));
    disc(ctx, 148, -34, 3.2, T('#D8DCE4'));
    disc(ctx, 148, -34, 2.2, (b.beams ?? 0) > 0 ? '#FFF3C8' : T('#E8E0C0'));
    box(ctx, 140, -10, 13, 2.6, T('#C8CCD4'));
  } else {
    box(ctx, 146, -17, 4, 3, (b.beams ?? 0) > 0 ? '#FFF3C8' : T('#D8D2BC'));
    box(ctx, 146.5, -27, 3, 2, b.indicator ? AMBER : T('#8A6A30'));
  }
  box(ctx, 0, -22, 2, 5, RED_LAMP);
  box(ctx, 0, -27, 2, 2.4, b.indicator ? AMBER : T('#8A6A30'));
  glow(ctx, 1, -20, 9, RED_LAMP, 0.45);
  if (b.indicator) {
    glow(ctx, 148, -26, 12, AMBER, 0.8);
    glow(ctx, 1, -26, 10, AMBER, 0.7);
  }
  if ((b.beams ?? 0) > 0) {
    const bx = b.old ? 150 : 150,
      by = b.old ? -34 : -15.5;
    glow(ctx, bx, by, 16, '#FFF1C8', 0.8 * (b.beams ?? 0));
    faded(ctx, 0.1 * (b.beams ?? 0), () =>
      poly(ctx, '#FFF1C8', [bx, by - 2, bx + 110, by - 16, bx + 110, by + 22, bx, by + 2]),
    );
  }
  if (b.lit > 0) glow(ctx, 60, top + 10, 70, CABIN, 0.12 * b.lit);
  ctx.restore();
}

// ——— The town street at night: a tracking shot beside the bus ———
const STREET_V = 40;
function houseRow(ctx: Ctx, cam: number, f: number, w: number, base: number, seed: number) {
  const off = cam * f;
  const first = Math.floor(off / w) - 1;
  for (let i = first; i < first + Math.ceil(W / w) + 3; i++) {
    const x = i * w - off;
    const r = rand(i * 1.37 + seed);
    const top = base - 64 - Math.floor(r * 3) * 6;
    box(ctx, x, top, w - 2, base - top, mix('#161D38', '#212948', rand(i * 2.1 + seed)));
    poly(ctx, '#0D1229', [x - 3, top + 1, x + w / 2 - 1, top - 13, x + w + 1, top + 1]);
    box(ctx, x + w * 0.66, top - 15, 6, 10, '#11172F');
    const rows: readonly (readonly [number, number])[] = [
      [x + 7, top + 9],
      [x + w - 21, top + 9],
      [x + 7, top + 35],
    ];
    rows.forEach(([wx, wy], k) => {
      const lit = rand(i * 3.3 + k * 7.1 + seed) < 0.1;
      box(ctx, wx, wy, 13, 15, lit ? '#FFB45A' : '#0B1024');
      if (lit) {
        glow(ctx, wx + 6, wy + 7, 20, SODIUM_HI, 0.3);
        box(ctx, wx, wy, 13, 4, '#E08A3A');
      }
      box(ctx, wx + 6, wy, 1, 15, '#161D38');
    });
    box(ctx, x + w - 19, top + 35, 11, base - top - 35, '#0E1328');
  }
}
function streetShot(ctx: Ctx, t: number, seconds: number) {
  const busX = -20 + STREET_V * t;
  const screenTail = lerp(64, 104, ease(span(t, 0.5, 7.5)));
  const cam = busX - screenTail;
  vgrad(ctx, 0, 0, W, 150, NIGHT_SKY);
  glow(ctx, 160, 170, 260, '#6A3A34', 0.3);
  // Rooftops far off, a spire among them.
  const far = cam * 0.2;
  for (let i = Math.floor(far / 40) - 1; i < Math.floor(far / 40) + 10; i++) {
    const x = i * 40 - far;
    const h = 20 + rand(i * 5.3) * 14;
    box(ctx, x, 86 - h, 38, h + 20, '#0C1330');
    if (rand(i * 9.1) < 0.15)
      poly(ctx, '#0C1330', [x + 12, 86 - h, x + 18, 86 - h - 30, x + 24, 86 - h]);
  }
  houseRow(ctx, cam, 0.55, 56, 140, 5);
  // Pavement and the wet road.
  box(ctx, 0, 140, W, 7, '#1A1F34');
  box(ctx, 0, 147, W, 2, '#2A3050');
  vgrad(ctx, 0, 149, W, 180, ['#0D1224', '#0A0E1C']);
  for (let i = Math.floor(cam / 60) - 1; i < Math.floor(cam / 60) + 7; i++)
    box(ctx, i * 60 - cam, 170, 26, 2, alpha('#C8C4B0', 0.35));
  // Street lamps and their pools of sodium.
  for (let i = Math.floor(cam / 128) - 1; i < Math.floor(cam / 128) + 4; i++) {
    const x = i * 128 + 40 - cam;
    box(ctx, x - 1, 60, 3, 82, '#1B2034');
    box(ctx, x - 1, 58, 13, 3, '#1B2034');
    box(ctx, x + 8, 60, 8, 3, SODIUM_HI);
    glow(ctx, x + 12, 64, 50, SODIUM, 0.5);
    oval(ctx, x + 12, 143, 28, 4, alpha(SODIUM, 0.25));
    for (let k = 0; k < 6; k++) {
      const ry = 150 + k * 5 + Math.sin(seconds * 3 + k) * 1;
      box(ctx, x + 10 + Math.sin(seconds * 2 + k * 1.3), ry, 4, 3, alpha(SODIUM, 0.28 - k * 0.04));
    }
    for (let k = 0; k < 8; k++) {
      const ry = 66 + ((k * 11 + seconds * 120) % 70);
      box(ctx, x + 6 + rand(k + i * 13) * 14, ry, 1, 3, alpha(SODIUM_HI, 0.45));
    }
  }
  // The bus, and its lit windows smeared in the wet road.
  const tail = busX - cam;
  faded(ctx, 0.22, () => {
    for (const px of [18, 42, 66, 90]) box(ctx, tail + px * 0.8, 175, 16, 3, CABIN);
  });
  bus(ctx, tail, 172, 0.8, {
    T: (c) => mix(c, '#0E1430', 0.42),
    seconds,
    lit: 1,
    wheel: (STREET_V * t) / 8,
    indicator: indicatorOn(t),
    beams: 1,
  });
  rainfall(ctx, seconds, {
    amount: 0.9,
    color: alpha('#A8BCE0', 0.5),
    slant: 0.28,
    speed: 210,
    length: 7,
    seed: 3,
  });
  // A lamp post whips past right in front of the lens.
  for (let i = Math.floor((cam * 1.8) / 520) - 1; i < Math.floor((cam * 1.8) / 520) + 2; i++) {
    const x = i * 520 + 260 - cam * 1.8;
    if (x > -30 && x < W + 30) {
      box(ctx, x, 0, 12, H, '#06080F');
      box(ctx, x + 10, 0, 2, H, alpha(SODIUM, 0.35));
    }
  }
}

// ——— On board: the cabin in section, front to the right ———
const FLOOR = 140;
const SEAT_Y = 125;
const ROWS = [30, 94, 158, 222] as const;
const hipX = (row: number) => ROWS[row] + 11;
const PANES: readonly (readonly [number, number])[] = [
  [6, 60],
  [70, 124],
  [134, 188],
  [198, 252],
];
const WIN_TOP = 32,
  WIN_BOT = 92;
type View = 'street' | 'sea' | 'dawn';

function outside(ctx: Ctx, view: View, d: number, t: number, seconds: number, dawn: number) {
  if (view === 'street') {
    box(ctx, 0, 20, 400, 130, '#0A1027');
    glow(ctx, 200, 150, 260, '#3E2A38', 0.4);
    const off = d * 0.45;
    for (let i = Math.floor(off / 60) - 1; i < Math.floor(off / 60) + 9; i++) {
      const x = i * 60 - off;
      const top = 42 + Math.floor(rand(i * 1.9 + 3) * 3) * 6;
      box(ctx, x, top, 57, 120, '#141B37');
      poly(ctx, '#0E1430', [x - 2, top, x + 29, top - 10, x + 59, top]);
      for (let k = 0; k < 2; k++)
        if (rand(i * 4.7 + k) < 0.16) {
          box(ctx, x + 8 + k * 26, top + 10, 10, 11, '#FFB45A');
          glow(ctx, x + 13 + k * 26, top + 15, 16, SODIUM_HI, 0.3);
        } else box(ctx, x + 8 + k * 26, top + 10, 10, 11, '#0B1024');
    }
    // The Hollin Road stop: a flag, a shelter and its bright timetable.
    const sx = HOLLIN - d;
    if (sx > -80 && sx < 480) {
      box(ctx, sx - 60, 62, 46, 70, alpha('#8FA8C8', 0.18));
      box(ctx, sx - 62, 60, 50, 3, '#1E2640');
      box(ctx, sx - 40, 80, 12, 16, '#F4EFD8');
      glow(ctx, sx - 34, 88, 18, '#FFFFFF', 0.25);
      box(ctx, sx, 48, 2, 100, '#2A3040');
      box(ctx, sx - 9, 40, 20, 14, '#E4E0D0');
      box(ctx, sx - 9, 40, 20, 4, '#C8463A');
      write(ctx, 'HOLLIN RD', sx + 1, 51, { size: 3.6, color: '#1A1A20' });
    }
    for (const x of lampsAt(d, -40, 440)) {
      box(ctx, x - 1, 30, 3, 120, '#10162C');
      box(ctx, x - 6, 34, 12, 4, SODIUM_HI);
      glow(ctx, x, 38, 46, SODIUM, 0.6);
    }
  } else if (view === 'sea') {
    vgrad(ctx, 0, 20, 400, 72, ['#070B1E', '#131E44', '#22305A']);
    vgrad(ctx, 0, 72, 400, 100, ['#1A2A50', '#0C1430']);
    for (let i = 0; i < 14; i++) {
      const gx = 60 + ((i * 37) % 120) + Math.sin(seconds * 1.4 + i) * 3;
      box(ctx, gx, 74 + (i % 5) * 4, 6 - (i % 3), 1, alpha('#C8D4F0', 0.5));
    }
    box(ctx, 0, 84, 400, 1.4, '#3A4466');
    for (let x = 4; x < 400; x += 14) box(ctx, x, 84, 1.4, 10, '#2E3858');
    glow(ctx, 300, 50, 70, SODIUM, 0.45);
    box(ctx, 296, 46, 10, 3, SODIUM_HI);
  } else {
    const sky = dawnSky(dawn);
    vgrad(ctx, 0, 20, 400, 74, sky);
    glow(ctx, 110, 74, 90, '#FFD08A', 0.35 + dawn * 0.3);
    disc(ctx, 110, 74, 9, alpha('#FFE6B0', 0.9));
    vgrad(ctx, 0, 74, 400, 100, [mix(sky[3], '#7A6A90', 0.3), mix(sky[1], '#1C2448', 0.4)]);
    for (let i = 0; i < 16; i++) {
      const gx = 94 + ((i * 29) % 34) + Math.sin(seconds * 1.6 + i * 2) * 3;
      box(ctx, gx, 76 + (i % 6) * 3.4, 5 - (i % 3), 1, alpha('#FFE8B8', 0.7));
    }
    const off = d * 1.2;
    box(ctx, 0, 86, 400, 1.4, '#6A5A70');
    for (let i = Math.floor(off / 14) - 1; i < Math.floor(off / 14) + 32; i++)
      box(ctx, i * 14 - off, 86, 1.4, 10, '#5A4A62');
    for (let i = Math.floor(off / 190) - 1; i < Math.floor(off / 190) + 4; i++) {
      const x = i * 190 + 60 - off;
      box(ctx, x - 1, 30, 3, 70, '#4A3E58');
      box(ctx, x - 5, 30, 10, 3, '#5A4A62');
    }
  }
  void t;
}

function glassRain(
  ctx: Ctx,
  x0: number,
  y0: number,
  w: number,
  h: number,
  seconds: number,
  moving: number,
  seed: number,
  count = 22,
) {
  for (let i = 0; i < count; i++) {
    const r1 = rand(seed + i * 3.1),
      r2 = rand(seed + i * 5.7);
    if (moving > 0.2) {
      const x = x0 + ((((r1 * w - seconds * (16 + r2 * 12) * moving) % w) + w) % w);
      const y = y0 + ((r2 * h + seconds * (6 + r1 * 5)) % h);
      line(ctx, alpha('#DCE6F8', 0.26), 0.8, [x, y, x - 5 * moving, y + 1.8]);
    } else {
      const x = x0 + r1 * w;
      const y = y0 + ((r2 * h + (i % 4 === 0 ? seconds * 5 : 0)) % h);
      if (i % 2) continue;
      box(ctx, x, y, 1, i % 4 === 0 ? 2.6 : 1, alpha('#B8C8E8', 0.3));
      box(ctx, x, y, 0.5, 0.5, alpha('#FFFFFF', 0.4));
    }
  }
}

function seat(ctx: Ctx, x: number) {
  box(ctx, x + 3, 131, 2, FLOOR - 131, '#6E6E76');
  box(ctx, x + 24, 131, 2, FLOOR - 131, '#6E6E76');
  box(ctx, x, SEAT_Y, 30, 7, MAROON);
  box(ctx, x, SEAT_Y + 5, 30, 2, MAROON_D);
  oval(ctx, x + 29, SEAT_Y + 3.5, 2.5, 3.5, MAROON);
  box(ctx, x - 3, 88, 9, SEAT_Y - 86, MAROON);
  oval(ctx, x + 1.5, 89, 4.5, 3, MAROON);
  box(ctx, x - 3, 88, 2, SEAT_Y - 86, MAROON_D);
  for (let k = 0; k < 5; k++) {
    box(ctx, x - 0.5, 94 + k * 7, 1, 1, '#E0A040');
    box(ctx, x + 2.5, 97 + k * 7, 1, 1, '#4AA0A0');
  }
  line(ctx, '#C8CCD4', 1.4, [x - 3, 86, x + 6, 86]);
  box(ctx, x - 2, 86, 1, 3, '#A8ACB4');
  box(ctx, x + 4, 86, 1, 3, '#A8ACB4');
}

type CabinShot = {
  view: View;
  d: number;
  moving: number;
  door?: number;
  stopping?: number;
  dawn?: number;
  cast: () => void;
};
function cabin(ctx: Ctx, t: number, seconds: number, c: CabinShot) {
  const door = c.door ?? 0;
  // Out of the windows.
  ctx.save();
  ctx.beginPath();
  for (const [a, b] of PANES) ctx.rect(a, WIN_TOP, b - a, WIN_BOT - WIN_TOP);
  ctx.rect(262, 30, 30, FLOOR - 30);
  ctx.rect(300, WIN_TOP, 70, WIN_BOT - WIN_TOP);
  ctx.moveTo(376, 26);
  ctx.lineTo(400, 26);
  ctx.lineTo(400, 104);
  ctx.lineTo(388, 104);
  ctx.closePath();
  ctx.clip();
  outside(ctx, c.view, c.d, t, seconds, c.dawn ?? 0);
  if (c.view !== 'dawn') {
    for (const [a, b] of PANES)
      glassRain(ctx, a, WIN_TOP, b - a, WIN_BOT - WIN_TOP, seconds, c.moving, a, 14);
    box(ctx, 0, WIN_TOP + 3, 400, 2, alpha(CABIN_HI, 0.12));
  }
  ctx.restore();
  // The wall, the pillars, the door frame, the ceiling.
  const wall = '#E6C88C',
    wallD = '#C9A86A';
  for (const [a, b] of [
    [0, 6],
    [60, 70],
    [124, 134],
    [188, 198],
    [252, 262],
  ] as const)
    box(ctx, a, WIN_TOP, b - a, WIN_BOT - WIN_TOP, wallD);
  box(ctx, 0, WIN_BOT, 262, SEAT_Y - WIN_BOT + 8, wall);
  box(ctx, 0, WIN_BOT, 262, 3, '#B89858');
  box(ctx, 0, 116, 262, 6, wallD);
  box(ctx, 0, 26, 300, 6, wallD);
  box(ctx, 0, 0, 400, 26, '#EED8A2');
  box(ctx, 0, 18, 300, 4, CABIN_HI);
  for (let x = 30; x < 300; x += 60) glow(ctx, x, 20, 34, CABIN_HI, 0.35);
  // Cards along the cove: nothing to sell, just the town.
  const cards: readonly (readonly [number, string])[] = [
    [18, '#6E9C94'],
    [84, '#C98A5A'],
    [150, '#8C7AA8'],
    [214, '#B85A5A'],
  ];
  for (const [x, col] of cards) {
    box(ctx, x, 5, 40, 11, col);
    box(ctx, x + 3, 8, 18, 2, alpha('#FFFFFF', 0.7));
    box(ctx, x + 3, 11.5, 26, 1.4, alpha('#FFFFFF', 0.45));
  }
  // The door: two glass leaves that fold back against the frame.
  box(ctx, 260, 28, 34, 3, '#3A3A42');
  if (door > 0) {
    faded(ctx, 0.35 * door, () =>
      poly(ctx, '#6A86B8', [262, FLOOR, 292, FLOOR, 250, 180, 200, 180]),
    );
    rainfall(ctx, seconds, {
      amount: 0.12 * door,
      color: alpha('#B8C8E8', 0.55),
      slant: 0.2,
      top: 30,
      bottom: FLOOR,
      seed: 21,
    });
  }
  const leaf = 15 * (1 - door * 0.8);
  for (const [lx, lw] of [
    [262, leaf],
    [292 - leaf, leaf],
  ] as const) {
    box(ctx, lx, 30, lw, FLOOR - 30, alpha('#9AB0D0', 0.12));
    box(ctx, lx, 30, 1.5, FLOOR - 30, '#2E2E36');
    box(ctx, lx + lw - 1.5, 30, 1.5, FLOOR - 30, '#2E2E36');
    box(ctx, lx, 84, lw, 2, '#2E2E36');
  }
  box(ctx, 262, FLOOR - 4, 30, 4, '#8C8C94');
  // The driver's cab.
  box(ctx, 294, 26, 6, FLOOR - 26, '#4A4850');
  box(ctx, 300, 26, 100, 6, wallD);
  box(ctx, 300, WIN_BOT, 76, FLOOR - WIN_BOT, '#3E3C44');
  poly(ctx, '#2A2830', [366, 102, 400, 96, 400, FLOOR, 372, FLOOR]);
  for (let i = 0; i < 3; i++) disc(ctx, 378 + i * 7, 104, 1.8, i === 1 ? '#7AE08A' : AMBER);
  if (indicatorOn(t)) glow(ctx, 385, 104, 10, '#7AE08A', 0.6);
  box(ctx, 372, 30, 3, 12, '#1C1C22');
  // STOPPING, over the cab.
  const stopping = c.stopping ?? 0;
  box(ctx, 304, 8, 58, 12, '#16161C');
  write(ctx, 'STOPPING', 333, 17, {
    size: 7,
    color: stopping > 0 ? mix('#5A2020', '#FF5A48', stopping) : '#3A2226',
  });
  if (stopping > 0) glow(ctx, 333, 14, 30, '#FF5A48', 0.35 * stopping);
  // Seats, then the people in them.
  for (const x of ROWS) seat(ctx, x);
  seat(ctx, 318);
  c.cast();
  // Steering wheel, poles, bell pushes.
  line(ctx, '#2A2A30', 2.4, [360, 122, 364, 108]);
  oval(ctx, 362, 106, 13, 2.6, '#1E1E24', -0.4);
  for (const px of [142, 282]) {
    box(ctx, px, 26, 3.5, FLOOR - 26, POLE);
    box(ctx, px + 0.8, 26, 1, FLOOR - 26, '#FFE08A');
    box(ctx, px - 1, 96, 5.5, 7, '#C8302A');
    box(ctx, px, 98, 3.5, 3, '#FF5A48');
  }
  // Floor.
  vgrad(ctx, 0, FLOOR, 400, 180, ['#5A4A3E', '#3A302A']);
  for (let x = -8; x < 400; x += 10) line(ctx, alpha('#2A221E', 0.5), 1, [x, FLOOR, x - 6, 180]);
  // Light from the lamps outside sweeps through the cabin as they pass.
  if (c.view === 'street')
    for (const lx of lampsAt(c.d, -80, 480)) {
      glow(ctx, lx, 80, 80, SODIUM, 0.22);
      faded(ctx, 0.08, () =>
        poly(ctx, SODIUM, [lx - 20, WIN_TOP, lx + 20, WIN_TOP, lx + 40, FLOOR, lx - 40, FLOOR]),
      );
    }
  if (c.view === 'dawn') {
    veil(ctx, '#F4A890', 0.1 + (c.dawn ?? 0) * 0.08);
    for (const [a, b] of PANES) glow(ctx, (a + b) / 2, 70, 60, '#FFD0A0', 0.2);
  }
}

// ——— Seated poses aboard ———
function seated(row: number, o: Partial<Pose> & { dx?: number; dy?: number } = {}): Pose {
  return {
    x: hipX(row) + (o.dx ?? 0),
    y: SEAT_Y - 2 + (o.dy ?? 0),
    thighs: SIT.thighs,
    shins: SIT.shins,
    ...o,
  };
}
const AMARA_DOZE = { torso: -0.14, head: -0.22, arms: [0.3, 0.45], fore: [1.35, 1.45] } as const;
const HALE_SIT = { torso: 0.02, arms: [0.5, 0.62], fore: [1.0, 1.1], flowers: true } as const;
function solDriving(seconds: number): Pose {
  const steer = Math.sin(seconds * 0.9) * 0.06;
  return {
    x: 334,
    y: SEAT_Y - 2,
    torso: 0.12,
    thighs: SIT.thighs,
    shins: SIT.shins,
    arms: [0.95 + steer, 1.05 - steer],
    fore: [1.9, 2.0],
    eyes: blink(seconds, 2) ? 'closed' : 'open',
  };
}

// ——— Over Sol's shoulder: the road ahead and the mirror ———
function roadAhead(ctx: Ctx, seconds: number, speed: number, dawnK = 0, night = true) {
  const vx = 176,
    vy = 78;
  if (night) vgrad(ctx, 0, 0, W, vy + 4, NIGHT_SKY);
  else vgrad(ctx, 0, 0, W, vy + 4, dawnSky(dawnK));
  poly(ctx, night ? '#0C1126' : '#4A4262', [0, vy + 6, W, vy + 6, W, 150, 0, 150]);
  poly(ctx, night ? '#101830' : '#6A5A70', [vx - 6, vy, vx + 6, vy, W + 40, 150, -40, 150]);
  // The houses on either side, receding.
  for (const sd of [-1, 1])
    poly(ctx, night ? '#131A36' : '#5A4E6A', [
      vx + sd * 8,
      vy - 8,
      vx + sd * 8,
      vy + 2,
      vx + sd * 260,
      150,
      vx + sd * 260,
      -40,
    ]);
  // Centre-line dashes and lamps rushing toward us.
  for (let i = 0; i < 6; i++) {
    const z = 1 - ((i / 6 + seconds * 0.22 * speed) % 1);
    const k = 1 / (0.15 + z * 2.2);
    const y = vy + 8 * k * 0.9;
    if (y < 150) box(ctx, vx - 1 * k, y, 2 * k, 3 * k, alpha('#C8C4B0', 0.55));
    for (const sd of [-1, 1]) {
      const lx = vx + sd * 30 * k,
        ly = vy - 12 * k * 0.8;
      if (night) {
        glow(ctx, lx, ly, 12 * k, SODIUM, 0.55);
        box(ctx, lx - 1.5 * k, ly - 0.5 * k, 3 * k, 1.2 * k, SODIUM_HI);
        box(ctx, lx - 0.4 * k, y + 2 * k, 0.8 * k, 10 * k, alpha(SODIUM, 0.25));
      }
    }
  }
}
/** The passengers as the driver's mirror sees them, inside a rect of width w, height h. */
function mirrorCabin(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  seconds: number,
  home: boolean,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // The cabin in perspective, down the aisle to the back window.
  const vx = x + w * 0.5,
    vy = y + h * 0.4;
  box(ctx, x, y, w, h, '#E2C286');
  poly(ctx, '#F4E2B0', [x, y, x + w, y, vx + w * 0.1, vy - h * 0.12, vx - w * 0.1, vy - h * 0.12]);
  line(ctx, CABIN_HI, 1.6, [vx - w * 0.2, y + 2, vx - w * 0.06, vy - h * 0.13]);
  line(ctx, CABIN_HI, 1.6, [vx + w * 0.2, y + 2, vx + w * 0.06, vy - h * 0.13]);
  for (const sd of [-1, 1])
    poly(ctx, '#131A36', [
      x + (sd < 0 ? 0 : w),
      y + h * 0.16,
      vx + sd * w * 0.1,
      vy - h * 0.08,
      vx + sd * w * 0.1,
      vy + h * 0.06,
      x + (sd < 0 ? 0 : w),
      y + h * 0.56,
    ]);
  box(ctx, vx - w * 0.1, vy - h * 0.12, w * 0.2, h * 0.18, '#18203E');
  poly(ctx, '#5A4A3E', [
    x,
    y + h,
    x + w,
    y + h,
    vx + w * 0.08,
    vy + h * 0.12,
    vx - w * 0.08,
    vy + h * 0.12,
  ]);
  // Rows of seat backs, far to near; the passengers sit behind the rows they face.
  const row = (k: number) => {
    for (const sd of [-1, 1]) {
      const cx = vx + sd * w * 0.27 * k,
        top = vy + (y + h * 0.62 - vy) * k,
        bw = w * 0.3 * k,
        bh = h * 0.5 * k;
      box(ctx, cx - bw / 2, top, bw, bh, MAROON);
      box(ctx, cx - bw / 2, top, bw, Math.max(1, 2 * k), MAROON_D);
      line(ctx, '#D0D4DC', Math.max(0.8, 1.6 * k), [
        cx - bw / 2,
        top - 0.5,
        cx + bw / 2,
        top - 0.5,
      ]);
    }
  };
  const passenger = (who: Who, k: number, sd: number, tilt: number, closed: boolean) => {
    const cx = vx + sd * w * 0.27 * k,
      top = vy + (y + h * 0.62 - vy) * k,
      r = h * 0.2 * k;
    box(ctx, cx - r * 1.5, top - r * 0.6, r * 3, r * 1.4, who.coat);
    ctx.save();
    ctx.translate(cx, top - r * 1.4);
    ctx.rotate(tilt);
    if (who.kind === 'amara') disc(ctx, 0, -r * 1.05, r * 0.5, who.hair);
    if (who.kind === 'hale') {
      oval(ctx, -r * 0.85, 0, r * 0.3, r * 0.5, who.hair);
      oval(ctx, r * 0.85, 0, r * 0.3, r * 0.5, who.hair);
    }
    oval(ctx, 0, 0, r * 0.85, r, who.skin);
    oval(ctx, 0, -r * 0.62, r * 0.82, r * 0.42, who.hair);
    const ey = -r * 0.05;
    if (closed) {
      box(ctx, -r * 0.5, ey + r * 0.1, r * 0.34, Math.max(0.6, r * 0.1), INK);
      box(ctx, r * 0.16, ey + r * 0.1, r * 0.34, Math.max(0.6, r * 0.1), INK);
    } else {
      box(ctx, -r * 0.42, ey, r * 0.2, r * 0.28, INK);
      box(ctx, r * 0.22, ey, r * 0.2, r * 0.28, INK);
    }
    ctx.restore();
  };
  row(0.36);
  if (home) {
    row(0.55);
    passenger(AMARA, 0.78, -1, -0.05, false);
    passenger(HALE, 0.78, -1.45, 0.5, true);
  } else {
    // Amara, three rows back, her head on the glass; Mr Hale nearer, sitting up straight.
    passenger(AMARA, 0.55, 1.25, 0.4, !blink(seconds, 1));
    row(0.55);
    passenger(HALE, 0.78, -1, 0, blink(seconds, 3));
    const r = h * 0.2 * 0.78,
      bx = vx - w * 0.27 * 0.78,
      by = vy + (y + h * 0.62 - vy) * 0.78;
    for (const [dx, c] of [
      [-1.2, '#F6F1E6'],
      [0, '#F2C94C'],
      [1.1, '#E89AA8'],
    ] as const)
      disc(ctx, bx + r * 0.5 + dx * r * 0.35, by - r * 0.3, r * 0.26, c);
  }
  row(0.78);
  row(1);
  ctx.restore();
}
function mirrorShot(ctx: Ctx, t: number, seconds: number, dawnK: number) {
  const night = dawnK <= 0;
  const view = track(
    t,
    night
      ? [
          [12, 160, 92, 1],
          [16.5, 168, 86, 1.1],
        ]
      : [
          [110.5, 160, 92, 1.06],
          [114, 164, 88, 1.14],
        ],
  );
  camera(ctx, view, () => {
    roadAhead(ctx, seconds, 1, dawnK, night);
    if (night) {
      rainfall(ctx, seconds, {
        amount: 0.4,
        color: alpha('#A8BCE0', 0.4),
        slant: 0.1,
        speed: 120,
        seed: 9,
      });
      // Drops on the screen, and the wipers clearing them.
      for (let i = 0; i < 40; i++) {
        const dx = rand(i * 2.3) * W,
          dy = rand(i * 4.1) * 150;
        box(ctx, dx, dy, 1.4, 1.4, alpha('#C8D8F0', 0.45));
      }
      for (const px of [100, 230]) {
        const a = -Math.PI / 2 + wiper(t) * 1.05;
        line(ctx, '#0A0A0E', 2.6, [px, 152, px + Math.cos(a) * 118, 152 + Math.sin(a) * 118]);
      }
    } else glow(ctx, 100, 78, 90, '#FFD08A', 0.35);
    // The cab around the screen.
    box(ctx, 0, 0, 14, H, '#101014');
    box(ctx, W - 14, 0, 14, H, '#101014');
    box(ctx, 0, 0, W, 8, '#101014');
    poly(ctx, '#18181E', [0, 150, W, 142, W, H, 0, H]);
    for (let i = 0; i < 4; i++) disc(ctx, 120 + i * 16, 160, 3, i === 2 ? '#7AE08A' : '#E0A040');
    // The big mirror.
    box(ctx, 159, 8, 3, 8, '#0A0A0E');
    box(ctx, 96, 14, 128, 44, '#0A0A0E');
    mirrorCabin(ctx, 99, 17, 122, 38, seconds, !night);
    box(ctx, 99, 17, 122, 3, alpha('#FFFFFF', 0.12));
    // Sol, from behind: cap, ear, collar, and a hand on the wheel.
    const lit = night ? SODIUM : '#FFB890';
    oval(ctx, 190, 188, 120, 16, '#1A1A20');
    oval(ctx, 190, 188, 104, 11, '#26262E');
    ctx.save();
    ctx.translate(262, 132);
    // From behind: no face, just the back of a grey head, two ears and a cap.
    poly(ctx, SOL.coatD, [-60, 60, -44, 18, -22, 8, 22, 8, 44, 18, 60, 60]);
    poly(ctx, SOL.coat, [-22, 8, 22, 8, 16, 18, -16, 18]);
    box(ctx, -10, -8, 20, 16, SOL.shade);
    poly(ctx, '#ECE8DE', [-13, 5, 13, 5, 10, 10, -10, 10]);
    oval(ctx, -19.5, -16, 4, 7.5, SOL.skin);
    oval(ctx, 19.5, -16, 4, 7.5, SOL.skin);
    oval(ctx, 0, -19, 19.5, 20, SOL.hair);
    for (let i = 0; i < 7; i++)
      box(ctx, -12 + i * 4, -2.5 + (i % 2), 2, 3, mix(SOL.hair, SOL.shade, 0.55));
    poly(ctx, CAP, [-23, -27, -21, -40, -10, -46, 10, -46, 21, -40, 23, -27]);
    box(ctx, -23, -30, 46, 5, '#15251F');
    line(ctx, alpha(lit, 0.7), 2, [10, -46, 21, -40, 23, -27]);
    line(ctx, alpha(lit, 0.55), 1.6, [19, -22, 16, -4]);
    line(ctx, alpha(lit, 0.45), 1.8, [24, 12, 44, 20, 58, 56]);
    ctx.restore();
    disc(ctx, 204, 172, 6, SOL.skin);
    line(ctx, SOL.coat, 7, [232, 190, 206, 174]);
  });
}

/** The mirror, close: Sol's eyes. */
function mirrorClose(
  ctx: Ctx,
  t: number,
  seconds: number,
  f: Face,
  from: number,
  to: number,
  moving: number,
  terminus: boolean,
) {
  const view = track(t, [
    [from, 160, 90, 1],
    [to, 160, 88, 1.06],
  ]);
  camera(ctx, view, () => {
    if (terminus) {
      vgrad(ctx, 0, 0, W, H, ['#070B1E', '#141E44', '#0C1230']);
      glow(ctx, 250, 60, 90, SODIUM, 0.45);
      glow(ctx, 60, 110, 60, '#8AA0D0', 0.12);
    } else {
      box(ctx, 0, 0, W, H, '#0A0F24');
      const d = drive(t);
      for (let i = 0; i < 7; i++) {
        const x = ((((i * 97 - d * 0.9) % 420) + 420) % 420) - 50;
        glow(ctx, x, 40 + (i % 3) * 30, 40 + (i % 2) * 16, SODIUM, 0.32 + moving * 0.1);
      }
    }
    glassRain(ctx, 0, 0, W, H, seconds, moving, 30, 26);
    box(ctx, 156, 0, 8, 26, '#0A0A0E');
    box(ctx, 26, 24, 268, 110, '#0A0A0E');
    ctx.save();
    ctx.beginPath();
    ctx.rect(31, 29, 258, 100);
    ctx.clip();
    box(ctx, 31, 29, 258, 100, '#C8A874');
    glow(ctx, 160, 140, 180, CABIN, 0.5);
    portrait(ctx, SOL, 160, 80, 2.1, f);
    box(ctx, 31, 29, 258, 6, alpha('#FFFFFF', 0.08));
    faded(ctx, 0.06, () => poly(ctx, '#FFFFFF', [60, 129, 120, 29, 150, 29, 90, 129]));
    ctx.restore();
  });
}

// ——— Close-ups aboard ———
/** Out-of-focus night outside a window: lamps as soft discs sliding past. */
function bokehNight(ctx: Ctx, x0: number, y0: number, w: number, h: number, d: number) {
  vgrad(ctx, x0, y0, w, y0 + h, ['#080D22', '#101A3C', '#0A1028']);
  for (let i = 0; i < 9; i++) {
    const x = x0 + ((((i * 71 + rand(i) * 40 - d * 1.4) % (w + 120)) + w + 120) % (w + 120)) - 60;
    const y = y0 + h * (0.2 + rand(i * 3.3) * 0.6);
    glow(ctx, x, y, 22 + rand(i * 7) * 22, i % 3 ? SODIUM : '#FFD8A0', 0.35 + rand(i * 2) * 0.2);
  }
}
function amaraClose(ctx: Ctx, t: number, seconds: number) {
  const d = drive(t);
  const view = track(t, [
    [16.5, 160, 90, 1],
    [21, 150, 92, 1.1],
  ]);
  const glance = span(t, 19.2, 19.8);
  camera(ctx, view, () => {
    box(ctx, 0, 0, W, H, '#E6C88C');
    glow(ctx, 240, 40, 160, CABIN_HI, 0.5);
    box(ctx, 0, 0, 104, H, '#1A1A24');
    bokehNight(ctx, 0, 0, 100, H, d);
    glassRain(ctx, 0, 0, 100, H, seconds, 1, 40, 30);
    box(ctx, 100, 0, 10, H, '#C9A86A');
    box(ctx, 0, 150, 130, 30, MAROON);
    const key = sweep(t, 110);
    portrait(ctx, AMARA, 148, 94, 2, {
      eyes: glance > 0.5 ? (blink(seconds, 1) ? 'closed' : 'half') : 'closed',
      look: [lerp(-0.2, 1, glance), 0.1],
      brows: 0.4,
      mouth: 'flat',
      turn: -0.25,
      tilt: -0.24,
      key: SODIUM,
      keyX: -18,
      keyY: -10,
      keyAmount: 0.15 + key * 0.5,
    });
    // Her breath on the cold glass.
    oval(ctx, 88, 104, 9, 13, alpha('#DCE6F8', 0.1 + Math.sin(seconds * 1.6) * 0.04));
  });
}
function haleClose(
  ctx: Ctx,
  t: number,
  seconds: number,
  from: number,
  to: number,
  terminus: boolean,
) {
  const view = track(t, [
    [from, 160, 92, 1.02],
    [to, 164, 96, 1.12],
  ]);
  const grip = terminus ? ease(span(t, GRIP_S - 0.4, GRIP_S + 0.3)) : 0;
  const lift = terminus ? hump(t, GRIP_S - 0.2, GRIP_S + 1.6) * 3 : 0;
  camera(ctx, view, () => {
    box(ctx, 0, 0, W, H, '#E2C488');
    glow(ctx, 60, 30, 150, CABIN_HI, 0.45);
    box(ctx, 212, 0, 108, H, '#10142A');
    if (terminus) {
      vgrad(ctx, 216, 0, 104, H, ['#070B1E', '#152048', '#0C1230']);
      glow(ctx, 270, 70, 60, SODIUM, 0.55);
      box(ctx, 216, 112, 104, 2, '#3A4466');
    } else bokehNight(ctx, 216, 0, 104, H, drive(t));
    glassRain(ctx, 216, 0, 104, H, seconds, terminus ? 0 : 1, 60, 24);
    box(ctx, 208, 0, 10, H, '#C9A86A');
    box(ctx, 60, 128, 150, 52, MAROON);
    line(ctx, '#C8CCD4', 2, [60, 128, 210, 128]);
    const key = terminus ? 0.55 : sweep(t, 236) * 0.6;
    portrait(ctx, HALE, 150, 86 - lift, 1.9, {
      eyes: blink(seconds, 3)
        ? 'closed'
        : terminus
          ? 'open'
          : t > 23.4 && t < 24.4
            ? 'down'
            : 'open',
      look: terminus ? [1, 0.1] : [0.35, 0],
      brows: terminus ? 0.7 + grip * 0.4 : 0.1,
      raise: terminus ? 0.2 : 0.3,
      mouth: terminus ? (grip > 0.5 ? 'sad' : 'flat') : 'flat',
      turn: terminus ? 0.5 : 0.28,
      wet: terminus ? 0.6 : 0,
      key: SODIUM,
      keyX: 24,
      keyY: -8,
      keyAmount: 0.12 + key * 0.5,
    });
    // His hands and the flowers, in his lap.
    const shake = grip * Math.sin(seconds * 30) * 0.5;
    bouquet(ctx, 192 + shake, 170 - lift, 2.4, keep, 1.35);
    topHand(ctx, HALE, 150 + shake, 170 - lift, 1.1, 0.12, {
      ring: 0,
      curl: 0.35 + grip * 0.55,
      grip,
      sleeve: HALE.coat,
      cuff: '#F4F1E8',
    });
  });
}

// ——— The bell ———
function bellShot(ctx: Ctx, t: number, seconds: number) {
  const reach = easeOut(span(t, 25.9, CHIME_S - 0.05));
  const press = t >= CHIME_S && t < CHIME_S + 0.7 ? 1 : 0;
  const lit = t >= CHIME_S ? 1 : 0;
  const away = ease(span(t, CHIME_S + 0.8, CHIME_S + 1.5));
  const view = track(t, [
    [25.5, 160, 90, 1],
    [28.5, 168, 92, 1.12],
  ]);
  camera(ctx, view, () => {
    vgrad(ctx, 0, 0, W, H, ['#F2DCA4', '#E6C88C', '#B8925A']);
    box(ctx, 0, 38, W, 56, '#141A34');
    const d = drive(t);
    for (let i = 0; i < 6; i++) {
      const x = ((((i * 90 - d * 1.2) % 440) + 440) % 440) - 60;
      glow(ctx, x, 60, 38, SODIUM, 0.3);
    }
    for (let i = 0; i < 5; i++) glow(ctx, 40 + i * 70, 10, 30, CABIN_HI, 0.4);
    // STOPPING, blurred at the front of the bus.
    glow(ctx, 270, 24, 40, '#FF5A48', lit ? 0.45 : 0.08);
    box(ctx, 250, 20, 40, 8, lit ? '#FF7A64' : '#5A2A2A');
    // The pole and the push.
    box(ctx, 190, 0, 16, H, POLE);
    box(ctx, 193, 0, 3, H, '#FFE08A');
    box(ctx, 204, 0, 2, H, '#B88A20');
    box(ctx, 176, 76, 32, 40, '#B8282A');
    box(ctx, 178, 78, 28, 36, '#D8342E');
    write(ctx, 'STOP', 192, 88, { size: 8, color: '#FFFFFF' });
    disc(ctx, 192, 102 + press, 8, press ? '#FF8A70' : '#FF4A3A');
    disc(ctx, 190, 99 + press, 3, alpha('#FFFFFF', 0.4));
    if (lit) glow(ctx, 192, 102, 26, '#FF6A50', 0.4 * (1 - away * 0.5));
    // Her hand, from the left, one finger out.
    const s = 1.6;
    const tipX = lerp(-40, 189, reach) - away * 70 + press * 2,
      tipY = 101 + away * 34;
    topHand(ctx, AMARA, tipX - 24 * s, tipY + 8.3 * s, s, 0, {
      point: true,
      sleeve: AMARA.coat,
      cuff: SCRUBS,
    });
  });
  void seconds;
}

// ——— Two faces in one window ———
function reflectionShot(ctx: Ctx, t: number, seconds: number) {
  const d = drive(t);
  const view = track(t, [
    [40, 160, 90, 1],
    [45, 150, 88, 1.14],
  ]);
  camera(ctx, view, () => {
    box(ctx, 0, 0, W, H, '#060A1C');
    const off = d * 0.6;
    for (let i = Math.floor(off / 80) - 1; i < Math.floor(off / 80) + 6; i++) {
      const x = i * 80 - off;
      box(ctx, x, 40 + rand(i) * 20, 70, 140, '#0D1330');
      if (rand(i * 3.7) < 0.3) box(ctx, x + 20, 70, 14, 14, alpha('#FFB45A', 0.6));
    }
    for (const lx of lampsAt(d * 1.3, -100, 420)) glow(ctx, lx, 34, 50, SODIUM, 0.45);
    // The glass holds them both: Mr Hale up ahead, and Amara, who is watching him.
    faded(ctx, 0.5, () => {
      box(ctx, 0, 18, W, 5, CABIN_HI);
      glow(ctx, 160, 60, 200, CABIN, 0.12);
      portrait(ctx, HALE, 92, 90, 1.05, {
        turn: 0.3,
        look: [0.5, 0.35],
        brows: 0.15,
        mouth: 'flat',
        eyes: blink(seconds, 4) ? 'closed' : 'open',
        T: (c) => mix(c, '#E8B870', 0.2),
      });
      portrait(ctx, AMARA, 222, 98, 1.6, {
        turn: -0.45,
        look: [-1, 0],
        brows: 0.6,
        mouth: 'flat',
        eyes: blink(seconds, 5) ? 'closed' : 'open',
        T: (c) => mix(c, '#E8B870', 0.15),
      });
    });
    glassRain(ctx, 0, 0, W, H, seconds, 0.8, 70, 40);
    // The frame of the window, and the real Amara's shoulder, dark, in the corner.
    box(ctx, 0, 0, W, 10, '#C9A86A');
    box(ctx, 0, 0, 12, H, '#B8985C');
    box(ctx, 0, 164, W, 16, '#E6C88C');
    poly(ctx, '#10141F', [250, 180, 262, 150, 290, 138, 330, 140, 330, 180]);
    oval(ctx, 300, 118, 20, 24, '#0C0A0E');
    disc(ctx, 306, 90, 9, '#0C0A0E');
    line(ctx, alpha(CABIN, 0.35), 1.4, [282, 104, 281, 122, 286, 134]);
  });
}

// ——— The seafront: the end of the line ———
type Grade = {
  mode: 'night' | 'then' | 'dawn';
  T: Tone;
  sky: readonly string[];
  sea: readonly [string, string];
  moon: number;
  sun: number;
  glint: string;
};
const DAWN_KEYS: readonly (readonly [number, readonly string[]])[] = [
  [0, ['#070B1E', '#0F1838', '#1C2850', '#2A3660']],
  [0.3, ['#18223F', '#2E3A62', '#56648A', '#8A94AE']],
  [0.65, ['#34406C', '#6E6490', '#C98898', '#F2B4A2']],
  [1, ['#4F74AA', '#A688A8', '#F0A28C', '#FFD89A']],
];
function dawnSky(k: number): readonly string[] {
  for (let i = 0; i < DAWN_KEYS.length - 1; i++) {
    const [a, sa] = DAWN_KEYS[i],
      [b, sb] = DAWN_KEYS[i + 1];
    if (k <= b) return mixAll(sa, sb, (k - a) / (b - a));
  }
  return DAWN_KEYS[DAWN_KEYS.length - 1][1];
}
const THEN_SKY = ['#4A3A6A', '#B06A78', '#F09A74', '#FFD49A'] as const;
const thenTone: Tone = (c) => mix(mix(c, '#F2B878', 0.26), '#8E7C6C', 0.12);
function grade(mode: 'night' | 'then' | 'dawn', k = 0): Grade {
  if (mode === 'night')
    return {
      mode,
      T: (c) => mix(c, '#0D1330', 0.55),
      sky: NIGHT_SKY,
      sea: ['#1E2C58', '#0A1030'],
      moon: 1,
      sun: 0,
      glint: '#C8D4F0',
    };
  if (mode === 'then')
    return {
      mode,
      T: thenTone,
      sky: THEN_SKY.map(thenTone),
      sea: [thenTone('#E0A080'), thenTone('#5A5A80')],
      moon: 0,
      sun: 0,
      glint: '#FFE8C0',
    };
  const sky = dawnSky(k);
  const tint =
    k < 0.5 ? mix('#101634', '#4A4468', k / 0.5) : mix('#4A4468', '#C08070', (k - 0.5) / 0.5);
  const amount = k < 0.5 ? lerp(0.5, 0.38, k / 0.5) : lerp(0.38, 0.2, (k - 0.5) / 0.5);
  return {
    mode,
    T: (c) => mix(c, tint, amount),
    sky,
    sea: [mix(sky[3], '#6A6A90', 0.35), mix(sky[0], '#0A1030', 0.5)],
    moon: 0,
    sun: span(k, 0.55, 1),
    glint: mix('#C8D4F0', '#FFE8B8', k),
  };
}
const SEA = {
  w: 360,
  horizon: 90,
  wall: 118,
  prom: 124,
  kerb: 138,
  road: 140,
  near: 168,
  bench: 238,
  lamp: 284,
  front: 214,
  busS: 0.92,
  busY: 166,
} as const;
/** Where the bus's front is as it comes in along the front, stopping at `stop`. */
function arrival(t: number, from: number, stop: number, dist: number) {
  const k = span(t, from, stop);
  return SEA.front - dist * (1 - (1 - (1 - k) ** 2));
}

function benchAt(ctx: Ctx, T: Tone) {
  const x = SEA.bench;
  const iron = T('#26382F'),
    wood = T('#8A6440'),
    woodD = T('#6A4A2E');
  for (const sx of [x + 2, x + 32]) {
    box(ctx, sx, 114, 3, 22, iron);
    box(ctx, sx - 1, 126, 5, 2, iron);
  }
  for (let i = 0; i < 3; i++) box(ctx, x, 115 + i * 3.4, 36, 2.4, i % 2 ? woodD : wood);
  box(ctx, x - 1, 126, 38, 3, wood);
  box(ctx, x - 1, 129, 38, 1.4, woodD);
}
function seafront(
  ctx: Ctx,
  t: number,
  seconds: number,
  g: Grade,
  o: {
    lamp?: number;
    flowers?: boolean;
    back?: () => void;
    busDraw?: () => void;
    front?: () => void;
  } = {},
) {
  const T = g.T;
  vgrad(ctx, 0, 0, SEA.w, SEA.horizon, g.sky);
  if (g.mode === 'night') {
    for (let i = 0; i < 30; i++) {
      const sx = rand(i * 2.7) * SEA.w,
        sy = rand(i * 5.1) * 60;
      box(ctx, sx, sy, 1, 1, alpha('#E8ECF8', 0.4 + 0.3 * Math.sin(seconds * (0.5 + rand(i)) + i)));
    }
    glow(ctx, 92, 40, 50, '#C8D4F0', 0.25);
    disc(ctx, 92, 40, 7, '#E8ECF4');
    disc(ctx, 95, 38, 6, alpha(g.sky[1], 0.9));
  }
  if (g.mode === 'then') glow(ctx, 80, SEA.horizon, 140, '#FFD49A', 0.5);
  if (g.sun > 0) {
    const sy = SEA.horizon + 8 - g.sun * 16;
    glow(ctx, 120, sy, 120, '#FFD08A', 0.35 + g.sun * 0.35);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SEA.w, SEA.horizon);
    ctx.clip();
    disc(ctx, 120, sy, 11, '#FFEAC0');
    ctx.restore();
  }
  // Long clouds, lit from below at dawn and at dusk.
  const cloud =
    g.mode === 'night'
      ? '#0B1230'
      : g.mode === 'then'
        ? thenTone('#C8707A')
        : mix('#2A3050', '#E89A94', g.sun + 0.2);
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 97 + seconds * 1.5) % (SEA.w + 120)) - 60;
    oval(ctx, cx, 22 + i * 13, 50 + i * 10, 3 + (i % 2), alpha(cloud, 0.8));
  }
  // The sea.
  vgrad(ctx, 0, SEA.horizon, SEA.w, SEA.wall, g.sea);
  box(ctx, 0, SEA.horizon, SEA.w, 1, alpha(g.sky[3], 0.8));
  const gx = g.mode === 'night' ? 92 : g.mode === 'then' ? 80 : 120;
  for (let i = 0; i < 18; i++) {
    const y = SEA.horizon + 2 + (i % 9) * 2.8;
    const x =
      gx + Math.sin(i * 2.1) * (4 + (y - SEA.horizon) * 0.8) + Math.sin(seconds * 1.3 + i) * 2;
    box(ctx, x, y, 4 + (i % 3) * 2, 1, alpha(g.glint, g.mode === 'night' ? 0.45 : 0.7));
  }
  for (let i = 0; i < 8; i++) {
    const y = SEA.horizon + 6 + ((i * 3.3 + seconds * 1.2) % 22);
    box(ctx, ((i * 53) % SEA.w) + Math.sin(seconds + i) * 6, y, 14, 1, alpha(g.glint, 0.12));
  }
  // Spray where the waves meet the wall.
  const s = surge(t);
  if (s > 0) {
    for (let i = 0; i < 22; i++) {
      const x = (i * 17 + 5) % SEA.w;
      const lift = s * (1.5 + (i % 3) * 1.6);
      box(ctx, x, SEA.wall - 1.5 - lift, 6 + (i % 4) * 2, 1, alpha('#E8F0F8', 0.4 * s));
    }
  }
  box(ctx, 0, SEA.wall - 1, SEA.w, 2, alpha(T('#DDE6F0'), 0.3 + s * 0.3));
  // The railing along the front.
  box(ctx, 0, SEA.wall, SEA.w, 1.6, T('#DAD8CC'));
  box(ctx, 0, SEA.wall + 3.4, SEA.w, 1.2, T('#B8B6AA'));
  for (let x = 3; x < SEA.w; x += 10) box(ctx, x, SEA.wall, 1.4, SEA.prom - SEA.wall, T('#C8C6BA'));
  // The promenade.
  vgrad(ctx, 0, SEA.prom, SEA.w, SEA.kerb, [T('#8C8A90'), T('#6E6C74')]);
  const lamp = o.lamp ?? 1;
  if (lamp > 0)
    oval(ctx, SEA.lamp - 26, 132, 36, 6, alpha(g.mode === 'then' ? '#FFD890' : SODIUM, 0.3 * lamp));
  // The old shelter, with the terminus flag.
  const sh = 296;
  box(ctx, sh, 94, 60, 4, T('#2E5040'));
  poly(ctx, T('#3A6250'), [sh - 4, 94, sh + 30, 80, sh + 64, 94]);
  for (const px of [sh + 2, sh + 55]) box(ctx, px, 98, 3, 38, T('#2E5040'));
  box(ctx, sh + 5, 100, 50, 28, alpha(T('#9AB0C8'), 0.35));
  box(ctx, sh + 8, 118, 44, 3, T('#6A4A2E'));
  box(ctx, sh - 8, 96, 2, 42, T('#3A3E46'));
  box(ctx, sh - 15, 88, 16, 11, T('#E4E0D0'));
  box(ctx, sh - 15, 88, 16, 3, T('#2E5B4A'));
  write(ctx, '7', sh - 7, 98, { size: 7, color: T('#1A1A20') });
  benchAt(ctx, T);
  if (o.flowers) bouquet(ctx, SEA.bench + 10, 125, 0.46, (c) => mix(c, T(c), 0.5), 1.5);
  // The lamp over the bench.
  const post = T('#2A3230');
  box(ctx, SEA.lamp, 44, 3, SEA.kerb - 42, post);
  line(ctx, post, 2.4, [SEA.lamp + 1, 46, SEA.lamp - 4, 38, SEA.lamp - 14, 38]);
  box(ctx, SEA.lamp - 22, 38, 12, 4, post);
  const lampColor = g.mode === 'then' ? '#FFE0A0' : SODIUM;
  box(ctx, SEA.lamp - 20, 42, 8, 2, lamp > 0 ? mix(T(lampColor), SODIUM_HI, lamp) : T('#8A8070'));
  if (lamp > 0) {
    glow(ctx, SEA.lamp - 16, 44, 56, lampColor, 0.55 * lamp);
    faded(ctx, 0.06 * lamp, () =>
      poly(ctx, lampColor, [
        SEA.lamp - 22,
        44,
        SEA.lamp - 10,
        44,
        SEA.lamp + 10,
        136,
        SEA.lamp - 44,
        136,
      ]),
    );
  }
  o.back?.();
  // The road.
  box(ctx, 0, SEA.kerb, SEA.w, 2, T('#A8A6A0'));
  vgrad(ctx, 0, SEA.road, SEA.w, SEA.near, [T('#262838'), T('#1A1C28')]);
  if (lamp > 0 && g.mode !== 'then')
    for (let k = 0; k < 6; k++)
      box(
        ctx,
        SEA.lamp - 18 + Math.sin(seconds * 2 + k) * 0.8,
        SEA.road + 2 + k * 4,
        3,
        2,
        alpha(lampColor, (0.22 - k * 0.03) * lamp),
      );
  o.busDraw?.();
  box(ctx, 0, SEA.near, SEA.w, 2, T('#9A988F'));
  vgrad(ctx, 0, SEA.near + 2, SEA.w, 180, [T('#6A6870'), T('#56545C')]);
  o.front?.();
}

function seaBus(ctx: Ctx, g: Grade, seconds: number, front: number, o: Partial<BusLook> = {}) {
  bus(ctx, front - 150 * SEA.busS, SEA.busY, SEA.busS, {
    T: g.T,
    seconds,
    lit: 1,
    wheel: -front / 8,
    beams: 1,
    ...o,
  });
}

function arrivalShot(ctx: Ctx, t: number, seconds: number) {
  const g = grade('night');
  const front = arrival(t, 45, TERMINUS_S, 250);
  const view = track(t, [
    [45, 176, 96, 1.12],
    [50.5, 180, 98, 1.2],
  ]);
  camera(
    ctx,
    view,
    () =>
      seafront(ctx, t, seconds, g, {
        busDraw: () =>
          seaBus(ctx, g, seconds, front, {
            indicator: indicatorOn(t),
            idle: t > TERMINUS_S ? 1 : 0,
          }),
      }),
    { w: SEA.w, h: H },
  );
  rainfall(ctx, seconds, {
    amount: 0.5 * (1 - span(t, 45.5, 48.5)),
    color: alpha('#A8BCE0', 0.45),
    slant: 0.3,
    seed: 5,
  });
}
function povShot(ctx: Ctx, t: number, seconds: number) {
  const g = grade('night');
  const view = track(t, [
    [50.5, 250, 112, 2.3],
    [54, 254, 116, 2.75],
  ]);
  camera(ctx, view, () => seafront(ctx, t, seconds, g), { w: SEA.w, h: H });
  // The window he looks through: its frame, its drops, the cabin's glow on the glass.
  veil(ctx, '#1A2040', 0.12);
  box(ctx, 0, 12, W, 4, alpha(CABIN_HI, 0.1));
  glassRain(ctx, 0, 0, W, H, seconds, 0, 90, 34);
  box(ctx, 0, 0, W, 12, '#C9A86A');
  box(ctx, 0, 0, 22, H, '#B8985C');
  box(ctx, 22, 0, 2, H, '#1E1E24');
  box(ctx, 0, 160, W, 20, '#E6C88C');
  box(ctx, 0, 160, W, 3, '#B89858');
  oval(ctx, 70, 180, 60, 12, MAROON);
}

// ——— The ring and the badge ———
function ringShot(ctx: Ctx, t: number, seconds: number) {
  const open = ease(span(t, 66.9, BADGE_S));
  const view = track(t, [
    [64.5, 168, 128, 1.55],
    [RING_S, 184, 136, 2.6],
    [66.6, 184, 136, 2.6],
    [BADGE_S, 96, 50, 2.6],
    [70.8, 94, 50, 3.6],
  ]);
  const glint = hump(t, RING_S - 0.3, RING_S + 0.9);
  const shine = hump(t, BADGE_S - 0.4, BADGE_S + 1.4);
  camera(ctx, view, () => {
    // His coat, his lap, the flowers across it.
    box(ctx, 0, 0, W, H, '#8E7250');
    glow(ctx, 260, 30, 140, SODIUM, 0.35);
    for (let i = 0; i < 5; i++)
      line(ctx, alpha('#6A5236', 0.7), 3, [40 + i * 55, 0, 60 + i * 50, 110]);
    vgrad(ctx, 0, 108, W, 180, ['#4E4A46', '#3A3632']);
    box(ctx, 0, 108, W, 3, '#34302C');
    poly(ctx, '#8E7250', [0, 100, 70, 104, 58, 180, 0, 180]);
    poly(ctx, '#8E7250', [W, 100, 262, 106, 280, 180, W, 180]);
    line(ctx, '#6A5236', 2, [70, 104, 58, 180]);
    line(ctx, '#6A5236', 2, [262, 106, 280, 180]);
    bouquet(ctx, 214, 140, 3.3, keep, 1.5);
    topHand(ctx, HALE, 176, 132, 1.55, 0.06, {
      ring: 0.3 + glint,
      curl: 0.5,
      sleeve: HALE.coat,
      cuff: '#F4F1E8',
    });
    // The lining, and the badge he has worn inside his coat for forty years.
    if (open > 0.01) {
      poly(ctx, '#243A30', [20, 0, 20 + 70 * open, 0, 60 + 60 * open, 96, 60, 96]);
      poly(ctx, '#2E4A3E', [26, 0, 26 + 58 * open, 0, 62 + 48 * open, 84, 60, 84]);
    }
    if (open > 0.05) {
      faded(ctx, open, () => badge(ctx, 96, 50, 1.2, keep, shine * 0.7));
      box(ctx, 95, 41, 2, 3, '#B8B4A8');
    }
    poly(ctx, '#A08159', [0, 0, 20 + 70 * open * 0.02, 0, 60, 96, 0, 110]);
    line(ctx, '#C8A878', 1.4, [20, 0, 60, 96]);
    poly(ctx, '#7C6444', [20, 0, 26, 0, 64, 90, 60, 96]);
  });
  vignette(ctx, 0.5);
  void seconds;
}

// ——— Then ———
function thenShotA(ctx: Ctx, t: number, seconds: number) {
  const g = grade('then');
  const front = arrival(t, 69.6, HALT_THEN_S, 240);
  const stood = ease(span(t, WAVE_S - 0.5, WAVE_S));
  const view = track(t, [
    [72.2, 226, 108, 1.5],
    [76, 230, 110, 1.62],
  ]);
  camera(
    ctx,
    view,
    () =>
      seafront(ctx, t, seconds, g, {
        lamp: 0.6,
        back: () => {
          if (stood < 0.5)
            frontal(ctx, WIFE, {
              x: SEA.bench + 18,
              y: 127,
              s: 0.5,
              sit: true,
              arms: 'lap',
              T: g.T,
            });
          else
            frontal(ctx, WIFE, {
              x: SEA.bench + 14,
              y: 136,
              s: 0.5,
              arms: t > WAVE_S ? 'wave' : 'down',
              wave: (t - WAVE_S) * 9,
              T: g.T,
            });
        },
        busDraw: () =>
          seaBus(ctx, g, seconds, front, {
            old: true,
            cast: 'then',
            lit: 0.4,
            idle: t > HALT_THEN_S ? 1 : 0,
            beams: 0.5,
          }),
      }),
    { w: SEA.w, h: H },
  );
}
function thenShotB(ctx: Ctx, t: number, seconds: number) {
  // The memory, then the dissolve back to the same bench tonight.
  const now = ease(span(t, BACK_TO_NOW[0], BACK_TO_NOW[1]));
  const view = track(t, [
    [76, 236, 112, 1.9],
    [82, 250, 116, 2.05],
    [85, 254, 118, 2.2],
  ]);
  const paintNow = () => {
    const g = grade('night');
    camera(
      ctx,
      view,
      () =>
        seafront(ctx, t, seconds, g, {
          busDraw: () => seaBus(ctx, g, seconds, SEA.front, { idle: 1 }),
        }),
      { w: SEA.w, h: H },
    );
  };
  const paintThen = () => {
    const g = grade('then');
    camera(
      ctx,
      view,
      () =>
        seafront(ctx, t, seconds, g, {
          lamp: 0.6,
          back: () => {
            // He comes round the front of the bus with flowers; she meets him; they go.
            const walkIn = span(t, 76, GIFT_S - 0.3);
            const leave = span(t, LINK_S, 82.4);
            if (t < LINK_S) {
              const hx = lerp(212, SEA.bench + 4, easeOut(walkIn));
              const wk = walking(t * 7.5, 0.34 * (1 - span(t, GIFT_S - 0.6, GIFT_S - 0.3)));
              figure(ctx, YOUNG, {
                x: hx,
                y: 136 - HIP * 0.52,
                s: 0.52,
                ...wk,
                arms: t > GIFT_S - 0.4 ? [0.1, 1.3] : wk.arms,
                fore: t > GIFT_S - 0.4 ? [0.2, 1.5] : wk.fore,
                flowers: t < GIFT_S + 0.2,
                T: g.T,
              });
              const turn = t > GIFT_S - 1.2;
              if (!turn)
                frontal(ctx, WIFE, { x: SEA.bench + 22, y: 136, s: 0.5, arms: 'down', T: g.T });
              else
                figure(ctx, WIFE, {
                  x: SEA.bench + 18,
                  y: 136 - HIP * 0.5,
                  s: 0.5,
                  facing: -1,
                  arms: t > GIFT_S ? [0.1, 1.2] : [0.05, 0.1],
                  fore: t > GIFT_S ? [0.2, 1.6] : [0.1, 0.2],
                  flowers: t > GIFT_S + 0.2,
                  head: -0.1,
                  T: g.T,
                });
            } else {
              const wx = lerp(SEA.bench + 8, 380, easeIn(leave) * 0.5 + leave * 0.5);
              const wk = walking(t * 7, 0.34);
              figure(ctx, WIFE, {
                x: wx + 9,
                y: 136 - HIP * 0.5,
                s: 0.5,
                ...wk,
                arms: [wk.arms[0], -0.5],
                fore: [wk.fore[0], 0.3],
                T: g.T,
              });
              figure(ctx, YOUNG, {
                x: wx,
                y: 136 - HIP * 0.52,
                s: 0.52,
                ...walking(t * 7 + 0.4, 0.34),
                arms: [0, 0.9],
                fore: [0.2, 1.4],
                T: g.T,
              });
              bouquet(ctx, wx + 13, 118, 0.35, g.T, 0.2);
            }
          },
          busDraw: () =>
            seaBus(ctx, g, seconds, SEA.front, {
              old: true,
              cast: 'none',
              lit: 0.4,
              idle: 1,
              beams: 0.5,
            }),
        }),
      { w: SEA.w, h: H },
    );
  };
  if (now < 1) {
    paintThen();
    thenGrade(ctx, seconds);
  }
  if (now > 0) faded(ctx, now, paintNow);
}
/** Warm, faded, softly framed: how a memory looks. */
function thenGrade(ctx: Ctx, seconds: number) {
  veil(ctx, '#FFE2B0', 0.1);
  vignette(ctx, 0.55, '#3A2414');
  for (let i = 0; i < 14; i++) {
    const k = Math.floor(seconds * 8);
    box(ctx, rand(i * 3.1 + k) * W, rand(i * 7.3 + k) * H, 1, 1, alpha('#FFF0D0', 0.25));
  }
  letterbox(ctx, 0.55, '#1A120C');
}

/** Then: the badge on a young man's cap, and the young man at the wheel, coming in. */
function youngShot(ctx: Ctx, t: number, seconds: number) {
  const T = thenTone;
  const view = track(t, [
    [69.3, 150, 58, 3.4],
    [70.4, 150, 62, 2.8],
    [72.2, 156, 92, 1.12],
  ]);
  const sway = Math.sin(t * 1.3) * 0.04;
  const seen = ease(span(t, 70.9, 71.6));
  camera(ctx, view, () => {
    // Through the windscreen of the old bus: the cab, the far windows, the sun going down.
    vgrad(ctx, 0, 0, W, H, THEN_SKY.map(T));
    glow(ctx, 60, 120, 160, '#FFD49A', 0.45);
    box(ctx, 0, 110, W, 70, T('#5A4636'));
    for (let i = 0; i < 4; i++) box(ctx, 20 + i * 80, 30, 6, 80, T('#C8B08A'));
    portrait(ctx, YOUNG, 150, 98, 1.7, {
      eyes: blink(seconds, 4) ? 'closed' : 'open',
      look: [lerp(0.2, 0.9, seen), 0],
      brows: -0.1,
      raise: 0.3 * seen,
      mouth: seen > 0.5 ? 'smile' : 'soft',
      turn: lerp(0.1, 0.4, seen),
      tilt: sway * 0.5,
      key: '#FFD49A',
      keyX: 24,
      keyY: -8,
      keyAmount: 0.4,
      T,
    });
    // The big flat wheel, turning them in to the stop.
    ctx.save();
    ctx.translate(150, 188);
    ctx.rotate(sway);
    oval(ctx, 0, 0, 96, 26, T('#1A1614'));
    oval(ctx, 0, 0, 86, 19, alpha(T('#5A4636'), 0.9));
    line(ctx, T('#1A1614'), 5, [-80, 0, 80, 0]);
    ctx.restore();
    topHand(ctx, YOUNG, 70, 178, 1.2, -0.2, { curl: 0.7, sleeve: YOUNG.coat, cuff: '#EDE8DC', T });
    // The glass between us: the sky slides across it.
    faded(ctx, 0.14, () => {
      for (let i = 0; i < 3; i++) {
        const x = ((i * 130 + t * 40) % 460) - 70;
        poly(ctx, '#FFF0D0', [x, 0, x + 40, 0, x - 20, H, x - 60, H]);
      }
    });
    box(ctx, 0, 0, W, 8, T(CREAM));
    box(ctx, 0, 0, 8, H, T('#35664F'));
    box(ctx, W - 8, 0, 8, H, T('#35664F'));
  });
}

// ——— Now: Amara moves up the bus ———
function moveUpShot(ctx: Ctx, t: number, seconds: number) {
  const rise = ease(span(t, STAND_S, STAND_S + 0.6));
  const walk = span(t, STAND_S + 0.5, BESIDE_S - 0.5);
  const sit = ease(span(t, BESIDE_S - 0.5, BESIDE_S));
  const view = track(t, [
    [85, 150, 92, 1.5],
    [88.6, 236, 94, 1.55],
  ]);
  camera(
    ctx,
    view,
    () =>
      cabin(ctx, t, seconds, {
        view: 'sea',
        d: 0,
        moving: 0,
        cast: () => {
          figure(
            ctx,
            HALE,
            seated(3, { ...HALE_SIT, head: 0.08, eyes: blink(seconds, 3) ? 'closed' : 'open' }),
          );
          figure(ctx, SOL, {
            ...solDriving(seconds),
            torso: 0.02,
            arms: [0.4, 0.5],
            fore: [1.2, 1.3],
            head: -0.05,
          });
          if (sit > 0) {
            figure(
              ctx,
              AMARA,
              seated(3, {
                dx: 6,
                dy: 3,
                s: 1.04,
                torso: 0.04,
                head: -0.05,
                arms: [0.3, 0.5],
                fore: [1.2, 1.3],
              }),
            );
          } else if (walk > 0) {
            const x = lerp(hipX(1) + 4, hipX(3) + 6, ease(walk));
            const wk = walking(walk * 14, 0.36);
            figure(ctx, AMARA, { x, y: FLOOR - HIP + 1 - wk.bob, s: 1.04, ...wk, torso: 0.06 });
          } else {
            const pose =
              rise > 0
                ? {
                    x: lerp(hipX(1), hipX(1) + 4, rise),
                    y: lerp(SEAT_Y - 2, FLOOR - HIP + 1, rise),
                    torso: lerp(0, 0.2, hump(t, STAND_S, STAND_S + 0.6)),
                    thighs: [lerp(1.42, 0, rise), lerp(1.5, 0, rise)] as const,
                    shins: [0, 0] as const,
                    s: 1.04,
                  }
                : {
                    ...seated(1, {
                      torso: -0.02,
                      head: 0.05,
                      arms: [0.3, 0.45],
                      fore: [1.35, 1.45],
                    }),
                  };
            figure(ctx, AMARA, { eyes: 'open', ...pose });
          }
        },
      }),
    { w: 400, h: H },
  );
}

// ——— The two-shot: side by side ———
function seatsFront(
  ctx: Ctx,
  t: number,
  seconds: number,
  o: { dawn: number; offer: number; asleep: number; take: number; speak: boolean },
) {
  const home = o.dawn > 0;
  const d = home ? (t - 110.5) * 50 : 0;
  // Behind them: the window, the cabin down the aisle, the ceiling.
  box(ctx, 0, 0, W, H, '#E6C88C');
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 20, 196, 74);
  ctx.clip();
  if (home) {
    const sky = dawnSky(o.dawn);
    vgrad(ctx, 0, 20, 196, 70, sky);
    glow(ctx, 70, 70, 90, '#FFD08A', 0.5);
    disc(ctx, 70, 70, 10, '#FFEAC0');
    vgrad(ctx, 0, 70, 196, 94, [mix(sky[3], '#7A6A90', 0.3), mix(sky[1], '#1C2448', 0.3)]);
    for (let i = 0; i < 14; i++)
      box(
        ctx,
        56 + ((i * 17) % 30) + Math.sin(seconds * 1.5 + i) * 3,
        72 + (i % 7) * 3,
        5,
        1,
        alpha('#FFE8B8', 0.75),
      );
    for (let i = Math.floor(d / 16) - 1; i < Math.floor(d / 16) + 14; i++)
      box(ctx, i * 16 - d, 80, 1.6, 14, '#5A4A62');
  } else {
    vgrad(ctx, 0, 20, 196, 94, ['#070B1E', '#152048', '#0C1230']);
    glow(ctx, 150, 50, 50, SODIUM, 0.5);
    box(ctx, 146, 46, 9, 2.4, SODIUM_HI);
    box(ctx, 0, 76, 196, 1.2, '#3A4466');
    for (let i = 0; i < 10; i++)
      box(ctx, 20 + ((i * 29) % 90), 80 + (i % 4) * 3, 4, 1, alpha('#C8D4F0', 0.4));
  }
  ctx.restore();
  box(ctx, 96, 20, 8, 74, '#C9A86A');
  box(ctx, 0, 18, 200, 3, '#C9A86A');
  box(ctx, 0, 92, 200, 4, '#B89858');
  // Down the aisle.
  vgrad(ctx, 196, 20, 124, 140, ['#F4DEA8', '#E6C88C']);
  box(ctx, 206, 26, 114, 30, home ? mix(dawnSky(o.dawn)[2], '#E6C88C', 0.35) : '#141A34');
  for (const px of [238, 278]) box(ctx, px, 26, 5, 30, '#C9A86A');
  // Across the aisle, the back of another double seat.
  box(ctx, 262, 102, 70, 80, MAROON);
  box(ctx, 262, 102, 70, 3, MAROON_D);
  line(ctx, '#C8CCD4', 2.2, [262, 101, 330, 101]);
  for (let k = 0; k < 4; k++) box(ctx, 270 + k * 14, 112 + (k % 2) * 16, 1.4, 1.4, '#E0A040');
  box(ctx, 300, 0, 5, H, POLE);
  box(ctx, 301, 0, 1.4, H, '#FFE08A');
  box(ctx, 0, 0, W, 18, '#EED8A2');
  box(ctx, 0, 12, W, 4, CABIN_HI);
  glow(ctx, 160, 14, 120, CABIN_HI, 0.3);
  // Their seat.
  box(ctx, 40, 96, 236, 84, MAROON);
  box(ctx, 40, 96, 236, 4, MAROON_D);
  line(ctx, '#C8CCD4', 2.4, [40, 95, 276, 95]);
  for (let k = 0; k < 12; k++) {
    box(ctx, 48 + k * 19, 106 + (k % 3) * 20, 1.4, 1.4, '#E0A040');
    box(ctx, 56 + k * 19, 116 + (k % 3) * 20, 1.4, 1.4, '#4AA0A0');
  }
  box(ctx, 30, 160, 256, 20, MAROON_D);
  box(ctx, 30, 158, 256, 3, MAROON);
  if (home) {
    // The one petal left behind.
    glow(ctx, 52, 162, 14, '#FFE0C0', 0.45);
    oval(ctx, 52, 162, 3.4, 1.8, PETAL, 0.4);
    oval(ctx, 51, 161.6, 1.6, 0.8, '#FFFFFF', 0.4);
  }
  const light: Tone = home ? (c) => mix(c, '#F8C0A0', 0.08) : keep;
  const key = home ? '#FFC8A0' : SODIUM;
  // Amara: the aisle seat, turned toward him. Hale: the window, flowers in his lap.
  const hale = () => {
    const asleep = o.asleep;
    portrait(ctx, HALE, lerp(112, 160, asleep), lerp(92, 110, asleep), 1.08, {
      eyes: asleep > 0.5 ? 'closed' : blink(seconds, 3) ? 'closed' : t > 93.6 ? 'down' : 'open',
      look: [0.8, t > 93.6 ? 0.8 : 0],
      brows: asleep > 0.5 ? 0 : 0.8,
      raise: asleep > 0.5 ? 0 : 0.35,
      mouth: asleep > 0.5 ? 'part' : 'flat',
      turn: lerp(0.45, 0.3, asleep),
      tilt: asleep * (0.62 + hump(t, SNORE_S, SNORE_S + 1.8) * 0.05),
      wet: asleep > 0.5 ? 0 : 0.8,
      key,
      keyX: -24,
      keyY: -6,
      keyAmount: 0.3,
      T: light,
    });
  };
  const amara = () => {
    portrait(ctx, AMARA, 212, 96, 1.08, {
      eyes: o.asleep > 0.5 ? 'half' : blink(seconds, 1) ? 'closed' : 'open',
      look: o.asleep > 0.5 ? [-0.3, 0.6] : [-1, 0.1],
      brows: o.asleep > 0.5 ? 0 : 0.3,
      raise: 0.1,
      mouth: o.speak ? 'talk' : o.asleep > 0.5 ? 'soft' : o.offer > 0.5 ? 'soft' : 'flat',
      turn: o.asleep > 0.5 ? -0.1 : -0.5,
      tilt: o.asleep > 0.5 ? -0.08 : 0,
      key,
      keyX: -30,
      keyY: -4,
      keyAmount: 0.25,
      T: light,
    });
  };
  if (o.asleep > 0) {
    amara();
    hale();
  } else {
    hale();
    amara();
  }
  if (!home) bouquet(ctx, 118, 170, 1.4, light, 1.3);
  // Her arm, crooked for him; on the way home, his hand still through it.
  const k = o.offer;
  if (o.take > 0) {
    line(ctx, light(AMARA.coat), 16, [258, 190, 186, 170]);
    topHand(ctx, HALE, 170, 172, 0.8, -0.28, {
      ring: 0.25,
      curl: 0.6,
      sleeve: HALE.coat,
      cuff: '#F4F1E8',
      T: light,
    });
  } else if (k > 0) {
    const ex = lerp(190, 148, k),
      ey = lerp(172, 154, k);
    line(ctx, light(AMARA.coat), 12, [180, 140, ex, ey, lerp(196, 190, k), 176]);
    line(ctx, light(AMARA.coatD), 2, [175, 140, ex - 5, ey]);
    line(ctx, light('#1A2A44'), 1.2, [ex + 4, ey - 2, ex + 10, ey + 6]);
    disc(ctx, lerp(198, 192, k), 177, 4, light(AMARA.skin));
  }
}
function twoShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [89, 164, 96, 1.04],
    [95, 170, 100, 1.2],
  ]);
  camera(ctx, view, () =>
    seatsFront(ctx, t, seconds, {
      dawn: 0,
      offer: ease(span(t, OFFER_S, OFFER_S + 0.8)),
      asleep: 0,
      take: 0,
      speak: talking(t, LINES[2][0], LINES[2][0] + 1.4),
    }),
  );
}
function homeShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [110.5, 160, 94, 1],
    [114, 150, 104, 1.1],
  ]);
  camera(ctx, view, () =>
    seatsFront(ctx, t, seconds, {
      dawn: lerp(0.85, 1, span(t, 110.5, 114)),
      offer: 1,
      asleep: 1,
      take: 1,
      speak: false,
    }),
  );
}

// ——— His hand on her arm ———
function takeShot(ctx: Ctx, t: number, seconds: number) {
  const reach = ease(span(t, 95.3, TAKE_S));
  const cover = ease(span(t, 97.1, 97.9));
  const view = track(t, [
    [95, 164, 100, 1],
    [98.5, 174, 112, 1.16],
  ]);
  camera(ctx, view, () => {
    // Their laps side by side: his camel coat, her navy parka, the seat behind.
    vgrad(ctx, 0, 0, W, 70, ['#6E2632', '#8A3440']);
    glow(ctx, 70, 10, 140, CABIN, 0.35);
    glow(ctx, 290, 30, 90, SODIUM, 0.25);
    poly(ctx, HALE.coat, [0, 56, 150, 62, 168, 180, 0, 180]);
    line(ctx, HALE.coatD, 3, [150, 62, 168, 180]);
    poly(ctx, AMARA.coatD, [150, 50, W, 44, W, 180, 160, 180]);
    bouquet(ctx, 70, 146, 3, keep, 1.75);
    // Her arm, crooked for him: shoulder top right, elbow toward him, hand in her lap.
    line(ctx, AMARA.coat, 34, [330, -30, 150, 98]);
    line(ctx, AMARA.coatD, 3, [322, -36, 142, 88]);
    line(ctx, AMARA.coat, 30, [150, 98, 290, 156]);
    for (let k = 0; k < 3; k++)
      line(ctx, '#1A2A44', 1.4, [166 + k * 5, 94 + k * 5, 172 + k * 5, 108 + k * 4]);
    topHand(ctx, AMARA, 290, 157, 1.3, 0.25, { curl: 0.35, cuff: SCRUBS });
    // His hand slides into the crook and settles on her forearm.
    topHand(
      ctx,
      HALE,
      lerp(10, 176, reach),
      lerp(230, 130, reach),
      1.6,
      lerp(-0.75, -0.38, reach),
      {
        ring: reach > 0.95 ? 0.35 : 0,
        curl: lerp(0.15, 0.7, reach),
        sleeve: HALE.coat,
        cuff: '#F4F1E8',
      },
    );
    // And hers comes to rest on his.
    if (cover > 0)
      topHand(ctx, AMARA, lerp(390, 200, cover), lerp(220, 146, cover), 1.45, Math.PI + 0.35, {
        curl: 0.4,
        sleeve: AMARA.coat,
        cuff: SCRUBS,
      });
  });
  vignette(ctx, 0.5);
  void seconds;
}

// ——— They step off ———
function depthScale(y: number) {
  return lerp(0.6, 0.5, span(y, 178, 136));
}
function stepOffShot(ctx: Ctx, t: number, seconds: number) {
  const k = span(t, 98.5, 106);
  const g = grade('dawn', lerp(0.12, 0.3, k));
  const idle = t < OFF_S ? 1 : 0;
  const view = track(t, [
    [98.5, 200, 128, 1.55],
    [101.4, 232, 120, 1.75],
    [102.5, 236, 118, 1.8],
  ]);
  const doorX = SEA.front - 150 * SEA.busS + 120 * SEA.busS;
  // Amara is down first; she turns, and he comes down on her arm; they cross to the bench.
  const cross = span(t, 99.5, LAY_S - 0.3);
  const path = (from: readonly [number, number], to: readonly [number, number]) =>
    [lerp(from[0], to[0], ease(cross)), lerp(from[1], to[1], ease(cross))] as const;
  const [ax, ay] = path([doorX + 12, 178], [SEA.bench - 14, 142]);
  const down = ease(span(t, 98.7, 99.4));
  const [hx0, hy0] = [lerp(doorX, doorX + 2, down), lerp(170, 178, down)];
  const [hx, hy] = t < 99.5 ? [hx0, hy0] : path([doorX + 2, 178], [SEA.bench - 2, 137]);
  const lay = hump(t, LAY_S - 0.5, LAY_S + 0.7);
  const drawPeople = () => {
    const walkingNow = cross > 0 && cross < 1;
    const wa = walking(t * 6.5, walkingNow ? 0.3 : 0);
    const wh = walking(t * 6.5 + 0.6, walkingNow ? 0.24 : 0);
    const sa = depthScale(ay),
      sh = depthScale(hy);
    figure(ctx, AMARA, {
      x: ax,
      y: ay - HIP * sa,
      s: sa,
      ...wa,
      arms: [wa.arms[0], 0.5],
      fore: [wa.fore[0], 1.4],
      head: 0.05,
      T: g.T,
    });
    figure(ctx, HALE, {
      x: hx,
      y: hy - HIP * sh + lay * 3,
      s: sh,
      ...wh,
      torso: lay * 0.6,
      head: lay * 0.3,
      arms: [wh.arms[0], lerp(0.5, 1.1, lay)],
      fore: [wh.fore[0], lerp(1.2, 1.6, lay)],
      flowers: t < LAY_S,
      T: g.T,
    });
  };
  camera(
    ctx,
    view,
    () =>
      seafront(ctx, t, seconds, g, {
        flowers: t >= LAY_S,
        back: () => {
          if (cross >= 0.6) drawPeople();
        },
        busDraw: () =>
          seaBus(ctx, g, seconds, SEA.front, { door: 1, idle, beams: 1, cast: 'empty' }),
        front: () => {
          if (cross < 0.6) drawPeople();
        },
      }),
    { w: SEA.w, h: H },
  );
  vignette(ctx, 0.4, '#141830');
}

// ——— "Morning, love." ———
function morningShot(ctx: Ctx, t: number, seconds: number) {
  const k = lerp(0.3, 0.45, span(t, 102.5, 106));
  const sky = dawnSky(k);
  const view = track(t, [
    [102.5, 160, 90, 1.02],
    [106, 166, 92, 1.12],
  ]);
  camera(ctx, view, () => {
    vgrad(ctx, 0, 0, W, 104, sky);
    glow(ctx, 300, 104, 140, '#F4B4A2', 0.3 + k * 0.3);
    vgrad(ctx, 0, 104, W, 140, [mix(sky[3], '#6A6A90', 0.35), mix(sky[0], '#0A1030', 0.5)]);
    for (let i = 0; i < 10; i++)
      box(ctx, 250 + ((i * 13) % 50), 108 + (i % 5) * 5, 6, 1, alpha('#F8D8C8', 0.4));
    box(ctx, 0, 134, W, 3, mix('#DAD8CC', sky[1], 0.4));
    box(ctx, 0, 137, W, 43, mix('#8C8A90', sky[1], 0.45));
    glow(ctx, 40, 20, 50, SODIUM, 0.35);
    // Amara, a little behind him, out of focus.
    faded(ctx, 0.75, () =>
      portrait(ctx, AMARA, 62, 112, 0.9, {
        turn: 0.4,
        look: [1, 0.3],
        brows: 0.4,
        mouth: 'flat',
        T: (c) => mix(c, sky[1], 0.4),
      }),
    );
    portrait(ctx, HALE, 186, 92, 1.95, {
      eyes: blink(seconds, 2) ? 'closed' : 'open',
      look: [0.9, 0.7],
      brows: 0.9,
      raise: 0.2,
      mouth: talking(t, LINES[3][0], LINES[3][0] + 1.1)
        ? 'part'
        : t > LINES[3][0] + 1.3
          ? 'soft'
          : 'flat',
      turn: 0.55,
      wet: 1,
      key: '#F8B8A8',
      keyX: 26,
      keyY: -4,
      keyAmount: 0.25 + k * 0.4,
      T: (c) => mix(c, '#5A5A80', 0.18),
    });
  });
}

// ——— Dawn ———
function dawnShot(ctx: Ctx, t: number, seconds: number) {
  const k = lerp(0.5, 0.95, span(t, 104, 110.5));
  const g = grade('dawn', k);
  const lamp = 1 - ease(span(t, LAMP_OFF_S, LAMP_OFF_S + 0.7));
  const view = track(t, [
    [105.2, 250, 118, 1.8],
    [106.4, 250, 118, 1.8],
    [110.5, 196, 96, 1.12],
  ]);
  camera(
    ctx,
    view,
    () => {
      seafront(ctx, t, seconds, g, {
        lamp,
        flowers: true,
        back: () => {
          frontal(ctx, HALE, {
            x: SEA.bench + 20,
            y: 126,
            s: 0.5,
            sit: true,
            arms: 'lap',
            T: g.T,
            tilt: 0.04,
          });
          frontal(ctx, AMARA, {
            x: SEA.bench + 31,
            y: 126,
            s: 0.5,
            sit: true,
            arms: 'lap',
            T: g.T,
            tilt: -0.1,
          });
        },
        busDraw: () => seaBus(ctx, g, seconds, SEA.front, { door: 1, beams: 0.6, cast: 'none' }),
        front: () =>
          frontal(ctx, SOL, {
            x: SEA.front - 150 * SEA.busS + 132 * SEA.busS,
            y: 178,
            s: 0.6,
            arms: 'cap',
            bare: true,
            T: g.T,
            tilt: 0.08,
          }),
      });
      // A gull, crossing into the light.
      const gk = span(t, GULL_S - 0.6, GULL_S + 3);
      if (gk > 0 && gk < 1) {
        const gx = lerp(60, 300, gk),
          gy = 50 - Math.sin(gk * Math.PI) * 14;
        const flap = Math.sin(t * 11) * 3;
        line(ctx, g.T('#2A2A3A'), 1.2, [gx - 6, gy - flap, gx, gy, gx + 6, gy - flap]);
      }
    },
    { w: SEA.w, h: H },
  );
}

// ——— Putting it on screen ———
const LINES: readonly (readonly [number, number, string])[] = [
  [32.2, 34.9, 'That’s you, Amara.'],
  [58.0, 60.9, 'Every night.'],
  [89.9, 92.9, 'I’ll walk with you.'],
  [103.0, 105.8, 'Morning, love.'],
];

function stopShot(ctx: Ctx, t: number, seconds: number, from: number, to: number) {
  const door = ease(span(t, DOORS_S, DOORS_S + 0.6)) * (1 - ease(span(t, SHUT_S, SHUT_S + 0.5)));
  const view =
    from < 32
      ? track(t, [
          [from, 180, 92, 1.45],
          [to, 184, 94, 1.5],
        ])
      : track(t, [
          [from, 162, 88, 1.75],
          [to, 158, 90, 1.82],
        ]);
  const up = ease(span(t, RISE_S, RISE_S + 0.7)) * (1 - ease(span(t, SIT_S, SIT_S + 0.7)));
  const lookAt = span(t, RISE_S + 0.8, RISE_S + 1.3) * (1 - span(t, SIT_S - 0.3, SIT_S));
  camera(
    ctx,
    view,
    () =>
      cabin(ctx, t, seconds, {
        view: 'street',
        d: drive(t),
        moving: t < 29 || t > PULL_S + 1 ? 1 : 0,
        door,
        stopping: t >= CHIME_S && t < SHUT_S ? 1 : 0,
        cast: () => {
          figure(
            ctx,
            HALE,
            seated(3, { ...HALE_SIT, eyes: blink(seconds, 3) ? 'closed' : 'open' }),
          );
          figure(ctx, SOL, {
            ...solDriving(seconds),
            torso: 0.04,
            head: t > 32 && t < 35.5 ? -0.12 : 0,
          });
          const hip = hipX(1);
          figure(ctx, AMARA, {
            x: lerp(hip, hip + 14, up),
            y: lerp(SEAT_Y - 2, FLOOR - HIP + 1, up),
            s: 1,
            thighs: [lerp(1.42, 0.05, up), lerp(1.5, -0.05, up)],
            shins: [lerp(0.06, 0.05, up), lerp(0.02, 0, up)],
            torso: lerp(-0.02, 0.08, up) + hump(t, RISE_S, RISE_S + 0.7) * 0.25,
            head: lookAt * 0.18 + (t > SIT_S + 0.5 ? -0.12 : 0),
            arms: [lerp(0.3, 0.2, up), lerp(0.45, 1.3, up)],
            fore: [lerp(1.35, 0.3, up), lerp(1.45, 1.75, up)],
            eyes: blink(seconds, 1) ? 'closed' : 'open',
          });
        },
      }),
    { w: 400, h: H },
  );
}

function scene(t: number) {
  let i = 0;
  while (i + 1 < CUTS.length && t >= CUTS[i + 1]) i++;
  return { name: SHOT_LIST[i][1], from: CUTS[i], to: CUTS[i + 1] ?? STORY };
}
function shotOf(name: ShotName) {
  const i = SHOT_LIST.findIndex(([, n]) => n === name);
  return { name, from: CUTS[i], to: CUTS[i + 1] ?? STORY };
}

function drawShot(ctx: Ctx, name: ShotName, t: number, seconds: number) {
  const { from, to } = shotOf(name);
  switch (name) {
    case 'street':
      return streetShot(ctx, t, seconds);
    case 'cabin':
      return camera(
        ctx,
        track(t, [
          [7.5, 150, 90, 1.25],
          [12, 262, 92, 1.25],
        ]),
        () =>
          cabin(ctx, t, seconds, {
            view: 'street',
            d: drive(t),
            moving: 1,
            cast: () => {
              figure(ctx, AMARA, seated(1, { ...AMARA_DOZE, eyes: 'closed' }));
              figure(
                ctx,
                HALE,
                seated(3, { ...HALE_SIT, eyes: blink(seconds, 3) ? 'closed' : 'open' }),
              );
              figure(ctx, SOL, solDriving(seconds));
            },
          }),
        { w: 400, h: H },
      );
    case 'mirror':
      return mirrorShot(ctx, t, seconds, 0);
    case 'amara':
      return amaraClose(ctx, t, seconds);
    case 'hale':
      return haleClose(ctx, t, seconds, from, to, false);
    case 'bell':
      return bellShot(ctx, t, seconds);
    case 'stop':
    case 'stand':
      return stopShot(ctx, t, seconds, from, to);
    case 'thatsYou':
      return mirrorClose(
        ctx,
        t,
        seconds,
        {
          eyes: blink(seconds, 2) ? 'closed' : 'open',
          look: [0, 0.1],
          brows: 0.3,
          raise: 0.4,
          mouth: talking(t, LINES[0][0], LINES[0][0] + 1.3) ? 'part' : 'flat',
        },
        from,
        to,
        0,
        false,
      );
    case 'reflection':
      return reflectionShot(ctx, t, seconds);
    case 'arrival':
      return arrivalShot(ctx, t, seconds);
    case 'bench':
      return povShot(ctx, t, seconds);
    case 'grip':
      return haleClose(ctx, t, seconds, from, to, true);
    case 'everyNight':
      return mirrorClose(
        ctx,
        t,
        seconds,
        {
          eyes: blink(seconds, 2) ? 'closed' : 'open',
          look: t < 59.4 ? [-1, 0.2] : [0, 0.1],
          brows: 0.5,
          raise: 0.1,
          mouth: talking(t, LINES[1][0], LINES[1][0] + 0.9) ? 'part' : 'flat',
        },
        from,
        to,
        0,
        true,
      );
    case 'understands':
      return camera(
        ctx,
        track(t, [
          [61.5, 160, 90, 1.02],
          [64.5, 156, 92, 1.12],
        ]),
        () => {
          box(ctx, 0, 0, W, H, '#E2C488');
          glow(ctx, 260, 40, 150, CABIN_HI, 0.4);
          vgrad(ctx, 0, 0, 96, H, ['#070B1E', '#152048', '#0C1230']);
          glow(ctx, 40, 60, 50, SODIUM, 0.45);
          box(ctx, 96, 0, 10, H, '#C9A86A');
          portrait(ctx, AMARA, 170, 94, 1.95, {
            eyes: blink(seconds, 1) ? 'closed' : 'open',
            look: t < 62.8 ? [-0.6, -0.4] : [1, 0.1],
            brows: t < 62.8 ? 0.2 : 0.9,
            raise: 0.2,
            mouth: 'flat',
            turn: t < 62.8 ? -0.2 : 0.35,
            key: SODIUM,
            keyX: -24,
            keyY: -6,
            keyAmount: 0.3,
          });
        },
      );
    case 'ring':
      return ringShot(ctx, t, seconds);
    case 'young':
      youngShot(ctx, t, seconds);
      return thenGrade(ctx, seconds);
    case 'thenWave':
      thenShotA(ctx, t, seconds);
      return thenGrade(ctx, seconds);
    case 'thenArm':
      return thenShotB(ctx, t, seconds);
    case 'moveUp':
      return moveUpShot(ctx, t, seconds);
    case 'offer':
      return twoShot(ctx, t, seconds);
    case 'take':
      return takeShot(ctx, t, seconds);
    case 'stepOff':
      return stepOffShot(ctx, t, seconds);
    case 'morning':
      return morningShot(ctx, t, seconds);
    case 'dawn':
      return dawnShot(ctx, t, seconds);
    default:
      return homeShot(ctx, t, seconds);
  }
}

/** Soft cuts: into the memory out of the badge, and from his face into the dawn. */
const SOFT: readonly (readonly [number, number, ShotName, ShotName])[] = [
  [INTO_THEN[0], INTO_THEN[1], 'ring', 'young'],
  [105.2, 106.8, 'morning', 'dawn'],
];

export const nightBusScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: ROOT, voice: 'keys', intro: [12, 15, 19], outro: [0, 4, 7] }, (s) => {
    const sec = (x: number) => (x * s.story) / STORY;
    const note = (
      t: number,
      pitch: number,
      beats: number,
      voice: Voice,
      gain: number,
      bpm = BPM,
      pan = 0,
    ) => s.note(at(t), pitch, sec((beats * 60) / bpm), voice, gain, pan);
    const chord = (t: number, c: Chord, beats: number, pad: number, bass: number, bpm = BPM) => {
      c.pad.forEach((d, i) => note(t, ROOT + d, beats, 'pad', pad, bpm, (i - 1) * 0.35));
      if (bass > 0) note(t, ROOT + c.bass, beats * 0.9, 'bass', bass, bpm);
    };
    const melody = (
      from: number,
      notes: Line,
      o: {
        voice?: Voice;
        gain?: number;
        shift?: number;
        bpm?: number;
        beats?: readonly [number, number];
      },
    ) => {
      const bpm = o.bpm ?? BPM;
      for (const [b, d, len] of notes) {
        if (o.beats && (b < o.beats[0] || b >= o.beats[1])) continue;
        note(
          from + (b * 60) / bpm,
          ROOT + d + (o.shift ?? 0),
          len,
          o.voice ?? 'keys',
          o.gain ?? 0.07,
          bpm,
          Math.sin(b * 0.7) * 0.25,
        );
      }
    };

    // Night: rain on the roof, the road under the wheels, the engine's drone.
    s.fx('rain', 0, sec(7.5), 0.1);
    s.fx('rain', at(7.5), sec(DOORS_S - 7.5), 0.05);
    s.fx('rain', at(DOORS_S), sec(SHUT_S - DOORS_S), 0.085);
    s.fx('rain', at(SHUT_S), sec(45 - SHUT_S), 0.05);
    s.fx('rain', at(45), sec(3), 0.028);
    s.fx('rumble', 0, sec(7.8), 0.1);
    s.fx('rumble', at(7.4), sec(21.8), 0.07);
    s.fx('rumble', at(PULL_S + 0.4), sec(TERMINUS_S - PULL_S - 0.2), 0.07);
    s.fx('hum', 0, sec(29.2), 0.022);
    s.fx('hum', at(29.2), sec(PULL_S - 29.2), 0.03);
    s.fx('hum', at(PULL_S), sec(TERMINUS_S - PULL_S), 0.022);

    // The theme, alone on the keys, then with the harmony coming in under it.
    melody(THEME_S, THEME, { gain: 0.075 });
    NIGHT.forEach((c, i) => {
      if (i >= 2) chord(THEME_S + i * BAR, c, 3.9, 0.017, i >= 4 ? 0.05 : 0);
    });
    // Over Sol's shoulder, the wipers swish on the off-beats.
    for (const w of WIPES) s.fx('swish', at(w - 0.25), 0.4, 0.035, 0.15);
    s.fx('chime', at(CHIME_S), 1.6, 0.14, 0.3);

    // Hollin Road: air brakes, the doors, the cold.
    s.fx('sweep', at(28.6), 0.9, 0.07);
    s.fx('sweep', at(DOORS_S), 0.8, 0.09, 0.4);
    s.fx('thud', at(DOORS_S + 0.55), 0.2, 0.06, 0.4);
    s.fx('wind', at(DOORS_S), sec(SHUT_S - DOORS_S), 0.05, 0.4);
    // She stands. She looks at him. She sits back down.
    note(RISE_S, ROOT - 12, 4, 'keys', 0.06);
    chord(RISE_S, NIGHT[0], 4, 0.014, 0);
    note(RISE_S + 1.1, ROOT + 7, 2, 'keys', 0.05);
    s.fx('creak', at(SIT_S + 0.4), 0.5, 0.05, -0.2);
    note(SIT_S + 0.4, ROOT + 8, 3, 'keys', 0.055);
    s.fx('sweep', at(SHUT_S), 0.6, 0.07, 0.4);
    s.fx('thud', at(SHUT_S + 0.45), 0.25, 0.09, 0.4);
    s.fx('engine', at(PULL_S), 3, 0.08);
    // The indicator keeps the pulse: tick on, tock off.
    for (const b of TICKS) {
      s.fx('tick', at(b), 0.05, 0.1, 0.5);
      s.fx('click', at(b + BEAT / 2), 0.04, 0.05, 0.5);
    }
    // The theme again in the window, higher and quieter; it doesn't get to finish.
    melody(beatAt(48), THEME, { gain: 0.05, shift: 12, voice: 'bell', beats: [0, 9] });
    melody(beatAt(48), THEME, { gain: 0.05, beats: [0, 9] });
    chord(beatAt(48), NIGHT[0], 3.9, 0.016, 0.045);
    chord(beatAt(52), NIGHT[1], 3.9, 0.016, 0.045);
    chord(beatAt(56), NIGHT[2], 6, 0.013, 0);

    // The end of the line: air brakes, the idle, the wind and the sea.
    s.fx('sweep', at(TERMINUS_S - 0.3), 1, 0.08);
    s.fx('hum', at(TERMINUS_S), sec(INTO_THEN[0] - TERMINUS_S), 0.018);
    s.fx('wind', at(46), sec(INTO_THEN[0] - 46), 0.05);
    for (const w of WAVES)
      if (w < INTO_THEN[0] || w > BACK_TO_NOW[0]) s.fx('wave', at(w), 3.4, 0.08, -0.2);
    s.fx('foghorn', at(51), 2.4, 0.035, -0.5);
    s.fx('rustle', at(GRIP_S - 0.3), 0.6, 0.05, 0.1);
    note(61.6, ROOT - 12, 4, 'pad', 0.02);
    note(61.6, ROOT - 5, 4, 'pad', 0.014);
    note(RING_S, ROOT + 19, 1.5, 'bell', 0.04, BPM, 0.2);

    // Then: the theme as a waltz, in the major, for the years he drove this route.
    for (let bar = 0; bar < 8; bar++) {
      const t0 = WALTZ_S + bar * WBAR;
      const c = WALTZ_CHORDS[bar];
      const g = bar < 1 ? 0.6 : bar >= 6 ? lerp(1, 0.35, (bar - 6) / 2) : 1;
      note(t0, ROOT + c.bass, 2.6, 'bass', 0.05 * g, WALTZ_BPM);
      c.pad.forEach((d, i) => note(t0, ROOT + d, 2.9, 'pad', 0.013 * g, WALTZ_BPM, (i - 1) * 0.3));
      for (const beat of [1, 2])
        c.pad.forEach((d) =>
          note(t0 + beat * WBEAT, ROOT + d + 12, 0.6, 'keys', 0.018 * g, WALTZ_BPM, 0.25),
        );
    }
    for (const [b, d, len] of WALTZ) {
      const g = b >= 18 ? lerp(1, 0.4, (b - 18) / 6) : 1;
      note(WALTZ_S + b * WBEAT, ROOT + d, len, 'keys', 0.07 * g, WALTZ_BPM, 0.1);
      note(WALTZ_S + b * WBEAT, ROOT + d + 12, len, 'bell', 0.028 * g, WALTZ_BPM, -0.2);
    }
    s.fx('engine', at(69.6), 2, 0.05, -0.4);
    s.fx('sweep', at(HALT_THEN_S - 0.2), 0.6, 0.04, -0.2);
    s.fx('gull', at(74.4), 0.6, 0.035, 0.5);
    for (let i = 0; i < 5; i++)
      s.fx('step', at(LINK_S + 0.5 + i * 0.45), 0.1, 0.035, 0.3 + i * 0.1);

    // Now. The idle comes back, and the sea.
    s.fx('hum', at(BACK_TO_NOW[0]), sec(OFF_S - BACK_TO_NOW[0]), 0.018);
    s.fx('wind', at(BACK_TO_NOW[0]), sec(STORY - BACK_TO_NOW[0]) + 2.4, 0.045);
    s.fx('creak', at(STAND_S), 0.4, 0.05, -0.2);
    for (const f of [86.4, 87.0, 87.6]) s.fx('step', at(f), 0.12, 0.06, 0.1);
    s.fx('creak', at(BESIDE_S), 0.5, 0.05, 0.2);

    // "I'll walk with you": the theme comes back with the pad under it, and turns major
    // on the beat he takes her arm.
    melody(OFFER_S, THEME, { gain: 0.07, beats: [0, 8] });
    chord(OFFER_S, NIGHT[0], 3.9, 0.02, 0.05);
    chord(OFFER_S + BAR, NIGHT[1], 3.9, 0.02, 0.05);
    melody(OFFER_S, TURN, { gain: 0.075 });
    chord(TAKE_S, MAJOR.A, 3.9, 0.022, 0.055);
    chord(TAKE_S + BAR, MAJOR.D, 2, 0.02, 0.05);
    chord(LAY_S, MAJOR.A, 4, 0.02, 0.05);
    s.fx('sweep', at(98.2), 0.7, 0.05, -0.3);
    for (const f of [98.8, 99.3, 99.8, 100.3, 100.8]) s.fx('step', at(f), 0.12, 0.05, -0.1);
    s.fx('wind', at(98.6), 3, 0.05);
    s.fx('rustle', at(LAY_S - 0.1), 0.5, 0.05, 0.2);
    // Sol switches off the engine. Then only the sea.
    s.fx('click', at(OFF_S), 0.06, 0.12, -0.3);
    s.fx('thud', at(OFF_S + 0.05), 0.3, 0.06, -0.3);

    // Dawn: the theme a last time, in the major, all the way home.
    chord(DAWN_S - 0.4, MAJOR.A, 5, 0.02, 0);
    melody(DAWN_S, DAWN, { gain: 0.07 });
    melody(DAWN_S, DAWN, { gain: 0.03, voice: 'bell', shift: 12 });
    chord(DAWN_S, MAJOR.A, 3.9, 0.02, 0.05);
    chord(DAWN_S + BAR, MAJOR.D, 3.9, 0.02, 0.05);
    chord(DAWN_S + BAR * 2, MAJOR.E, 2, 0.02, 0.05);
    // Home on A, just as the end card comes up.
    chord(DAWN_S + BAR * 2 + BEAT * 2, MAJOR.A, 3, 0.02, 0.05);
    s.fx('gull', at(GULL_S), 0.7, 0.045, 0.3);
    s.fx('click', at(LAMP_OFF_S), 0.05, 0.05, 0.3);
    s.fx('engine', at(110.3), 1.2, 0.04);
    s.fx('rumble', at(110.5), sec(STORY - 110.5) + 2.6, 0.05);
    s.fx('snore', at(SNORE_S), 1.8, 0.035, -0.2);
  });

// ——— The score's material ———
const ROOT = 57; // A
type Line = readonly (readonly [number, number, number])[];
type Chord = { bass: number; pad: readonly number[] };
/** The night theme: [beat, degree above A3, beats]. */
const THEME: Line = [
  [0, 12, 1.9],
  [2, 15, 0.95],
  [3, 19, 0.95],
  [4, 17, 1.9],
  [6, 15, 1.9],
  [8, 10, 1.9],
  [10, 15, 0.95],
  [11, 17, 0.95],
  [12, 14, 3.8],
  [16, 12, 1.9],
  [18, 15, 0.95],
  [19, 19, 0.95],
  [20, 20, 1.9],
  [22, 19, 0.95],
  [23, 17, 0.95],
  [24, 15, 1.9],
  [26, 14, 0.95],
  [27, 12, 0.95],
  [28, 14, 3.8],
];
const NIGHT: readonly Chord[] = [
  { bass: -12, pad: [0, 3, 7] },
  { bass: -16, pad: [-4, 0, 3] },
  { bass: -9, pad: [-2, 3, 7] },
  { bass: -14, pad: [-2, 2, 5] },
  { bass: -12, pad: [0, 3, 7] },
  { bass: -16, pad: [-4, 0, 3] },
  { bass: -19, pad: [-4, 0, 5] },
  { bass: -17, pad: [-1, 2, 7] },
];
const MAJOR = {
  A: { bass: -12, pad: [0, 4, 7] },
  D: { bass: -19, pad: [-3, 0, 5] },
  E: { bass: -17, pad: [-1, 2, 7] },
} as const;
/** Bars three and four when he takes her arm: the same climb, in the major, home to A. */
const TURN: Line = [
  [8, 16, 1.9],
  [10, 19, 0.95],
  [11, 17, 0.95],
  [12, 17, 0.95],
  [13, 16, 0.95],
  [14, 12, 3.8],
];
/** The waltz: [beat, degree, beats], three to the bar. */
const WALTZ: Line = [
  [0, 12, 1],
  [1, 16, 1],
  [2, 19, 1],
  [3, 21, 2],
  [5, 19, 1],
  [6, 19, 2],
  [8, 16, 1],
  [9, 14, 3],
  [12, 12, 1],
  [13, 16, 1],
  [14, 19, 1],
  [15, 21, 1],
  [16, 24, 1],
  [17, 21, 1],
  [18, 19, 2],
  [20, 17, 1],
  [21, 12, 3],
];
const WALTZ_CHORDS: readonly Chord[] = [
  MAJOR.A,
  MAJOR.D,
  MAJOR.A,
  MAJOR.E,
  MAJOR.A,
  MAJOR.D,
  MAJOR.E,
  MAJOR.A,
];
/** Dawn: A, D, E, and home on A under the end card's chord. */
const DAWN: Line = [
  [0, 12, 1.9],
  [2, 16, 0.95],
  [3, 19, 0.95],
  [4, 21, 1.9],
  [6, 19, 0.95],
  [7, 17, 0.95],
  [8, 16, 0.95],
  [9, 14, 0.95],
  [10, 12, 3],
];

export const nightBus: FilmModule = {
  draw(ctx, p, seconds) {
    const t = p * STORY;
    const soft = SOFT.find(([a, b]) => t >= a && t < b);
    if (soft) {
      drawShot(ctx, soft[2], t, seconds);
      faded(ctx, ease(span(t, soft[0], soft[1])), () => drawShot(ctx, soft[3], t, seconds));
    } else drawShot(ctx, scene(t).name, t, seconds);
    // A tired night's vignette; the flashback carries its own.
    const { name } = scene(t);
    if (!THEN.includes(name)) vignette(ctx, MORNING.includes(name) ? 0.3 : 0.45, '#070A18');
    // Under the end card, let the last frame sink back so the words read.
    veil(ctx, '#0B0E14', ease((seconds - STORY - 3) / 0.9) * 0.35);
    for (const [from, to, text] of LINES) caption(ctx, text, presence(t, from, to, 0.3));
  },
  score: nightBusScore,
  look: {
    shade: '#121834',
    ink: '#F2E8D6',
    accent: '#FFB25C',
    dedication: 'for the people who work while we sleep',
  },
};
