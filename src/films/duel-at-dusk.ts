import type { FilmModule } from './types';
import {
  alpha,
  box,
  camera,
  captions,
  clamp,
  disc,
  ease,
  easeIn,
  easeOut,
  faded,
  font,
  glow,
  H,
  hump,
  lerp,
  letterbox,
  line,
  mix,
  oval,
  person,
  poly,
  rand,
  shade,
  shot,
  sky,
  span,
  TAU,
  track,
  veil,
  vignette,
  W,
  within,
  write,
  type Ctx,
  type Eyes,
  type Figure,
  type Mouth,
  type View,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * DUEL AT DUSK
 * Two masked swordsmen meet on a castle bridge at sunset for a thrilling duel: parries along
 * the stones, a leap onto the parapet, a swing on a banner rope. But a knee creaks, a back
 * twinges, and somebody needs a moment. When a single hat feather floats down through the
 * golden light, the masks come off: it is the fortieth annual duel between two creaky old
 * best friends, and the feather goes in the jar with all the others.
 *
 * The duel is choreographed on one beat grid shared by pictures and score: every clash of
 * blades sounds on the frame where the two blades meet, and every age hint gets its sting.
 */

// A beat is 1/108 of the story: 120 bpm in the one-minute cut. The score derives its tempo
// from the same number, so the duel's clashes land on the music.
const BEAT = 1 / 108;
const DUEL = 0.1;
const at = (n: number) => DUEL + n * BEAT;

// Shared cues, in story time.
const STRIDE = 0.0175;
const WALK_END = 0.07;
const FOOTFALLS = [0.5, 1.5, 2.5, 3.5].map((k) => k * STRIDE);
const SALUTE = 0.074,
  SALUTE_DOWN = 0.086;
const BREATH = at(10),
  RESUME = at(12.5);
const LEAP = at(13),
  PERCH = at(13.8);
const KNEE = at(18);
const GRAB = at(19.3),
  SWING = at(20),
  APEX = at(21),
  LET_GO = at(22),
  TOUCH = at(22.5);
const HOP = at(22.6),
  HOP_LAND = at(23.1),
  BACK = at(23.4);
const THROW = at(31.5),
  PAUSE = at(32);
const PIGEON_BACK = 0.43;
const SPECS = 0.47,
  WIPE = 0.488,
  SLIP = 0.503;
const GUARD2 = 0.525,
  LUNGE = 0.549,
  PARRY = 0.552,
  FLICK = 0.567,
  FALL = FLICK + 0.012,
  LAND = 0.648;
const BOW = 0.672,
  BOW_RED = 0.684,
  LAUGH = 0.706,
  DROP_SWORDS = 0.709,
  HATS = 0.722,
  MASKS = 0.748,
  HUG = 0.762;
const PATS = [0.772, 0.78, 0.788] as const;
const POUR = 0.812,
  CLINK = 0.842,
  LID_OFF = 0.868,
  DROP = 0.879,
  LID_ON = 0.893,
  CHALK = 0.915;

const CUTS = [
  0,
  0.056,
  DUEL,
  at(7.25),
  BREATH,
  RESUME,
  at(17.5),
  at(19),
  at(24.5),
  at(26.5),
  PAUSE,
  0.445,
  0.52,
  0.562,
  0.578,
  0.645,
  0.665,
  0.8,
  0.86,
  0.905,
  0.942,
] as const;

// The set: a stone bridge between two gate towers, the sun going down behind it.
const DECK = 142,
  PARAPET = 112;
const TOWERS = [20, 370] as const;
const POLE = 250,
  PIVOT = { x: 262, y: 28 },
  ROPE = 70;
const K = 1.55,
  BLADE = 34;
const SEAT = { blue: 296, red: 348 } as const;
const JAR_X = 321;

const SKY_A = ['#3A2350', '#7A2F5A', '#C9505A', '#EE8A52'] as const;
const SKY_B = ['#4A2852', '#95405C', '#DE7458', '#F6B866'] as const;
const SKY_C = ['#302658', '#6E3A6C', '#B85E6E', '#EE9A66'] as const;
const SKY_D = ['#1C1A40', '#3A2A5C', '#9A4A62', '#F29458'] as const;
const INK = '#140C18';

// ——— Choreography ———
type Key = readonly number[];
/** Eases through keyframes [p, ...values]; holds at either end. */
function keyed(p: number, keys: readonly Key[]) {
  if (p <= keys[0][0]) return keys[0].slice(1);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i],
      b = keys[i + 1];
    if (p < b[0]) {
      const t = ease((p - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((v, j) => lerp(v, b[j + 1], t));
    }
  }
  return keys[keys.length - 1].slice(1);
}
const guardB = (x: number) => [x + 40, DECK - 46];
const guardR = (x: number, y = DECK) => [x - 38, y - 38];

/** One exchange: on beat n the fencers stand at bx and rx and their blades meet at (cx, cy). */
type Hit = readonly [n: number, bx: number, rx: number, cx: number, cy: number, who: 1 | -1];
type Bout = { b: Key[]; r: Key[] };
/** Keys for both fencers: a wind-up before every hit, then both blades on the contact point. */
function bout(start: readonly [number, number, number], hits: readonly Hit[], ry = DECK): Bout {
  let [pn, pbx, prx] = start;
  const b: Key[] = [[at(pn), pbx, ...guardB(pbx)]];
  const r: Key[] = [[at(pn), prx, ...guardR(prx, ry)]];
  for (const [n, bx, rx, cx, cy, who] of hits) {
    const w = n - Math.min(0.42, (n - pn) * 0.6);
    const mbx = lerp(pbx, bx, 0.5),
      mrx = lerp(prx, rx, 0.5);
    b.push([at(w), mbx, ...(who > 0 ? [mbx + 8, DECK - 104] : guardB(mbx))]);
    r.push([at(w), mrx, ...(who < 0 ? [mrx - 8, ry - 92] : guardR(mrx, ry))]);
    b.push([at(n), bx, cx, cy]);
    r.push([at(n), rx, cx, cy]);
    [pn, pbx, prx] = [n, bx, rx];
  }
  return { b, r };
}
// Along the bridge: Blue drives, Red ripostes, and they bind in close-up.
const HITS_A: readonly Hit[] = [
  [1, 184, 254, 219, 96, 1],
  [2, 198, 266, 232, 104, 1],
  [3, 212, 280, 246, 92, 1],
  [4, 204, 272, 238, 106, -1],
  [4.5, 196, 264, 230, 98, -1],
  [5, 186, 254, 220, 106, -1],
  [6, 190, 258, 224, 94, 1],
  [7.5, 196, 262, 229, 97, 1],
];
const RALLY_A = bout([0, 176, 262], HITS_A);
RALLY_A.b.push(
  [at(8.3), 199, 229, 92],
  [at(9.1), 201, 229, 86],
  [at(9.5), 188, ...guardB(188)],
  [at(10), 190, ...guardB(190)],
);
RALLY_A.r.push(
  [at(8.3), 259, 229, 92],
  [at(9.1), 257, 229, 86],
  [at(9.5), 276, ...guardR(276)],
  [at(10), 284, ...guardR(284)],
);
// Red on the parapet, slashing down.
const HITS_B: readonly Hit[] = [
  [14.5, 284, 340, 314, 86, -1],
  [15.5, 290, 344, 318, 80, 1],
  [16.5, 282, 338, 311, 90, -1],
];
const RALLY_B = bout([14, 276, 340], HITS_B, PARAPET);
// The flurry, the lock, and the big clash that throws them apart.
const HITS_C: readonly Hit[] = [
  [27, 250, 318, 284, 100, 1],
  [27.5, 258, 326, 292, 94, 1],
  [28, 264, 332, 298, 104, 1],
  [28.5, 256, 324, 290, 96, -1],
  [29, 246, 314, 280, 102, -1],
  [30, 256, 314, 285, 84, 1],
];
const RALLY_C = bout([26.5, 244, 318], HITS_C);
RALLY_C.b.push([at(31.4), 258, 285, 80], [THROW, 257, 285, 82], [PAUSE, 236, 246, 40]);
RALLY_C.r.push([at(31.4), 312, 285, 80], [THROW, 313, 285, 82], [PAUSE, 336, 326, 48]);
const SWING_HIT = { x: 316, y: 92 };
const PARRY_HIT = { x: 292, y: 100 };
/** Every blade contact, for the sparks and the clash sounds. */
export const CLASHES: readonly { p: number; x: number; y: number; big?: boolean }[] = [
  ...[...HITS_A, ...HITS_B, ...HITS_C].map(([n, , , x, y]) => ({ p: at(n), x, y })),
  { p: APEX, ...SWING_HIT },
  { p: THROW, x: 285, y: 82, big: true },
  { p: PARRY, ...PARRY_HIT },
];

// ——— The two old friends ———
type Who = 'blue' | 'red';
type Pose = {
  x: number;
  y?: number;
  facing?: 1 | -1;
  /** Point the sword arm and blade at this spot. */
  aim?: readonly number[];
  arm?: number;
  /** Blade angle relative to facing: 0 forward, positive down. */
  blade?: number;
  sword?: boolean;
  plant?: boolean;
  back?: number;
  lean?: number;
  step?: number;
  sitting?: boolean;
  eyes?: Eyes;
  mouth?: Mouth;
  hat?: 'on' | 'hand' | 'off';
  feather?: boolean;
  mask?: boolean;
  scarf?: number;
  specs?: 'on' | 'hand' | 'off';
  hanky?: boolean;
  tache?: number;
  billow?: number;
  dark?: number;
};
const LOOKS = {
  blue: {
    skin: '#E9C3A5',
    hair: '#D2CEC8',
    coat: '#3F5F9C',
    legs: '#2B3044',
    cloak: '#2A4782',
    lining: '#8DAEDD',
    hat: '#202C4A',
    band: '#B58D4E',
    plume: '#F5E9CD',
    body: [0.84, 1.14],
  },
  red: {
    skin: '#E9B18D',
    hair: '#E9B18D',
    coat: '#B23F3A',
    legs: '#3D2A31',
    cloak: '#8A282D',
    lining: '#E48A62',
    hat: '#4C1B22',
    band: '#D8A64E',
    plume: '#EF7B4F',
    body: [1.18, 0.88],
  },
} as const;
const SHOES = '#35251F',
  MASK = '#16111B',
  SCARF = '#6A2230',
  WHITE = '#F5F1EA',
  SIL = '#22152A';
const facingOf = (who: Who, pose: Pose) => pose.facing ?? (who === 'blue' ? 1 : -1);

/** A point on the body in the kit's torso frame (hip at 0, head top at -24), in world space. */
function bodyPoint(who: Who, pose: Pose, lx: number, ly: number) {
  const [sx, sy] = LOOKS[who].body;
  const lean = pose.lean ?? 0;
  const hip = pose.sitting
    ? -4
    : -11 - (pose.step === undefined ? 0 : Math.abs(Math.cos(pose.step)));
  const c = Math.cos(lean),
    s = Math.sin(lean);
  return {
    x: pose.x + (lx * c - ly * s) * K * facingOf(who, pose) * sx,
    y: (pose.y ?? DECK) + (hip + lx * s + ly * c) * K * sy,
  };
}
/** The front arm angle that points from the shoulder toward (tx, ty). */
function reach(who: Who, pose: Pose, tx: number, ty: number) {
  const [sx, sy] = LOOKS[who].body;
  const lean = pose.lean ?? 0;
  const origin = bodyPoint(who, { ...pose, lean: 0 }, 0, 0);
  const lx = (tx - origin.x) / (K * facingOf(who, pose) * sx),
    ly = (ty - origin.y) / (K * sy);
  const c = Math.cos(lean),
    s = Math.sin(lean);
  return Math.atan2(lx * c + ly * s - 1, -lx * s + ly * c + 11);
}
const armEnd = (side: 1 | -1, angle: number) =>
  [side + Math.sin(angle) * 10, -11 + Math.cos(angle) * 10] as const;

/** Repeats the kit's person transform, so costume pieces follow leans and sitting. */
function inTorso(ctx: Ctx, f: Figure, paint: () => void) {
  const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step));
  ctx.save();
  ctx.scale((f.facing ?? 1) * (f.size ?? 1), f.size ?? 1);
  ctx.translate(0, f.sitting ? -4 : -11 - bob);
  ctx.rotate(f.lean ?? 0);
  paint();
  ctx.restore();
}

/** A hat in torso units, brim resting on the head top at y = -24. */
function hat(ctx: Ctx, who: Who, feather: boolean, tone: (c: string) => string, w: number) {
  const c = LOOKS[who];
  if (who === 'blue') {
    if (feather) {
      poly(ctx, tone(c.plume), [
        -3,
        -29,
        -7,
        -34 + w,
        -13,
        -36 + w,
        -19,
        -34 + w * 1.5,
        -15,
        -32 + w,
        -9,
        -31,
      ]);
      line(ctx, tone('#D2BE94'), 0.5, [-3, -30, -9, -34 + w, -18, -34.5 + w * 1.5]);
    }
    box(ctx, -9, -26, 20, 2, tone(c.hat));
    box(ctx, -5, -31, 11, 5, tone(c.hat));
    box(ctx, -5, -27, 11, 1, tone(c.band));
  } else {
    if (feather)
      poly(ctx, tone(c.plume), [-2, -29, -3, -35 + w, -7, -39 + w, -6, -34 + w * 0.6, -4, -30]);
    box(ctx, -7, -26, 15, 2, tone(c.hat));
    box(ctx, -4, -30, 9, 4, tone(c.hat));
    box(ctx, -4, -27, 9, 1, tone(c.band));
  }
}
function spectacles(ctx: Ctx, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(1.5, -18.5, 1.4, 0, TAU);
  ctx.moveTo(5.9, -18.5);
  ctx.arc(4.5, -18.5, 1.4, 0, TAU);
  ctx.moveTo(0.1, -18.6);
  ctx.lineTo(-4, -19.6);
  ctx.stroke();
}

/** Masks, moustache, spectacles, and hats, drawn in the head's own frame. */
function costume(ctx: Ctx, who: Who, pose: Pose, tone: (c: string) => string, w: number) {
  const masked = pose.mask ?? true;
  const white = tone(WHITE);
  if (who === 'red') {
    const scarf = pose.scarf ?? 1;
    if (scarf < 0.97) {
      const k = 1 + (pose.tache ?? 0) * 0.45;
      ctx.save();
      ctx.translate(3, -16);
      ctx.scale(k, 1);
      box(ctx, -4, -1, 8, 2, white);
      box(ctx, -5, 0, 2, 3, white);
      box(ctx, 3, 0, 2, 3, white);
      box(ctx, -6, 2, 2, 1, white);
      box(ctx, 4, 2, 2, 1, white);
      ctx.restore();
    }
    box(ctx, -5, -17 + (1 - scarf) * 5, 11, 4, tone(SCARF));
    box(ctx, -7, -16 + (1 - scarf) * 5, 3, 2, tone(SCARF));
    if (!masked) {
      box(ctx, 0, -21, 3, 1, white);
      box(ctx, 4, -21, 3, 1, white);
      if (pose.hat !== 'on') box(ctx, -2, -24, 4, 1, tone('#FFE9D2'));
    }
  }
  if (masked) {
    const m = tone(MASK);
    box(ctx, -5, -20, 11, 3, m);
    box(ctx, -8, -20, 3, 1, m);
    box(ctx, -9, -19 + Math.round(w), 3, 1, m);
    const eyes = pose.eyes ?? 'open';
    for (const ex of [1, 4]) {
      if (eyes === 'closed' || eyes === 'happy' || eyes === 'sleepy')
        box(ctx, ex, -18, 2, 1, tone('#8C7F86'));
      else if (eyes === 'wide') {
        box(ctx, ex, -20, 2, 2, tone('#F6EDDC'));
        box(ctx, ex + 1, -19, 1, 1, tone('#1A1420'));
      } else {
        box(ctx, ex, -19, 2, 1, tone('#F6EDDC'));
        box(ctx, ex + 1, -19, 1, 1, tone('#1A1420'));
      }
    }
  }
  if (who === 'blue' && pose.specs === 'on') spectacles(ctx, tone('#E8CB7A'), 0.6);
  if ((pose.hat ?? 'on') === 'on') hat(ctx, who, pose.feather ?? true, tone, w);
}

/**
 * Draws one duelist and returns where the hands are. Blue is tall and thin, Red short and
 * round: the kit's person, stretched, in a cloak.
 */
function fencer(ctx: Ctx, who: Who, pose: Pose, seconds: number) {
  const c = LOOKS[who];
  const d = pose.dark ?? 0;
  const tone = (color: string) => (d > 0 ? mix(color, SIL, d) : color);
  const [sx, sy] = c.body;
  const facing = facingOf(who, pose);
  const y = pose.y ?? DECK;
  let front = pose.arm ?? 0.3;
  const b = pose.blade ?? 0.8;
  let angle = facing > 0 ? b : Math.PI - b;
  if (pose.aim) {
    front = reach(who, pose, pose.aim[0], pose.aim[1]);
    const s = bodyPoint(who, pose, 1, -11);
    angle = Math.atan2(pose.aim[1] - s.y, pose.aim[0] - s.x);
  }
  const back = pose.back ?? -2.3;
  const masked = pose.mask ?? true;
  const f: Figure = {
    skin: tone(c.skin),
    hair: tone(c.hair),
    coat: tone(c.coat),
    legs: tone(c.legs),
    shoes: tone(SHOES),
    build: 'adult',
    size: K,
    facing,
    step: pose.step,
    sitting: pose.sitting,
    lean: pose.lean ?? 0,
    arms: [back, front],
    hairStyle: who === 'red' ? 'bald' : 'short',
    eyes: pose.eyes ?? 'open',
    mouth: pose.mouth ?? 'flat',
    blush: !masked && d < 0.4,
  };
  const w = Math.sin(seconds * 5 + (who === 'red' ? 1.7 : 0));
  const billow = pose.billow ?? 0.5;
  shade(ctx, pose.x, y + 1, 20, 0.22 * (y === DECK ? 1 : 0.6));
  ctx.save();
  ctx.translate(pose.x, y);
  ctx.scale(sx, sy);
  inTorso(ctx, f, () => {
    const hem = pose.sitting ? 3 : 9;
    const flare = [-7 - billow * 3, -3 + w, -10 - billow * 8, hem - 2 + w * 2];
    poly(ctx, tone(c.cloak), [3, -13, -4, -13, ...flare, -5 - billow * 4, hem + w, 0, hem]);
    line(ctx, tone(c.lining), 1, [-5, -12, ...flare]);
    if (who === 'red') oval(ctx, 2.5, -5, 5.5, 5.5, f.coat);
  });
  person(ctx, 0, 0, f);
  inTorso(ctx, f, () => costume(ctx, who, pose, tone, w));
  ctx.restore();
  const hand = bodyPoint(who, pose, ...armEnd(1, front));
  const other = bodyPoint(who, pose, ...armEnd(-1, back));
  if (pose.sword ?? true) {
    const length = pose.plant ? (DECK + 1 - hand.y) / Math.max(0.2, Math.sin(angle)) : BLADE;
    sword(ctx, hand.x, hand.y, angle, tone, length);
  }
  // Things held in the other hand.
  if (pose.hat === 'hand') {
    ctx.save();
    ctx.translate(other.x, other.y);
    ctx.scale(K * sx * facing, K * sy);
    ctx.rotate(-0.35);
    ctx.translate(0, 27);
    hat(ctx, who, who === 'red', tone, w);
    ctx.restore();
  }
  if (pose.specs === 'hand') {
    ctx.save();
    ctx.translate(other.x - 3 * facing, other.y + 29);
    ctx.scale(K, K);
    spectacles(ctx, tone('#E8CB7A'), 0.5);
    ctx.restore();
  }
  if (pose.hanky)
    poly(ctx, tone(WHITE), [
      other.x - 3,
      other.y - 1,
      other.x + 3,
      other.y - 2,
      other.x + 2,
      other.y + 5,
      other.x - 2,
      other.y + 4,
    ]);
  return { hand, other };
}

function sword(
  ctx: Ctx,
  x: number,
  y: number,
  angle: number,
  tone: (c: string) => string,
  length = BLADE,
) {
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  line(ctx, tone('#6B4A33'), 1.6, [x - dx * 4, y - dy * 4, x, y]);
  line(ctx, tone('#E2BC62'), 1.3, [x - dy * 3.5, y + dx * 3.5, x + dy * 3.5, y - dx * 3.5]);
  line(ctx, tone('#DCE5EE'), 1.1, [x, y, x + dx * length, y + dy * length]);
  line(ctx, tone('#FFFFFF'), 0.5, [
    x + dx * 6,
    y + dy * 6,
    x + dx * length * 0.7,
    y + dy * length * 0.7,
  ]);
}
/** A loose feather, centred on (x, y). */
function plume(
  ctx: Ctx,
  x: number,
  y: number,
  a: number,
  color: string = LOOKS.blue.plume,
  len = 18,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  const h = len / 2;
  poly(ctx, color, [-h, 0, -h / 2, -2.8, h / 2, -2.4, h, -0.4, h / 2, 1.2, -h / 2, 1.5]);
  line(ctx, alpha('#B79C6C', 0.9), 0.5, [-h - 2, 0.4, h, -0.3]);
  ctx.restore();
}
function pigeon(
  ctx: Ctx,
  x: number,
  y: number,
  facing: number,
  flap: number | null,
  peck: number,
  dark = 0,
) {
  const tone = (c: string) => mix(c, SIL, dark);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  poly(ctx, tone('#6C7082'), [-4, -5, -10, -3, -4, -2]);
  oval(ctx, 0, -4, 5, 3.5, tone('#8E91A3'));
  if (flap === null) oval(ctx, -1, -4.5, 3.5, 2, tone('#767A8D'));
  else {
    const up = Math.sin(flap) * 6;
    poly(ctx, tone('#767A8D'), [-3, -5, 2, -5, -1, -6 - up, -6, -5 - up * 0.8]);
  }
  const hy = -8 + peck * 4;
  box(ctx, 2, hy + 1, 2, 3, tone('#6FA38E'));
  disc(ctx, 4, hy, 2.2, tone('#9A9DB0'));
  box(ctx, 6, hy, 2, 1, tone('#E0B070'));
  box(ctx, 4, hy - 1, 1, 1, tone('#1C1820'));
  if (flap === null) {
    box(ctx, -1, -1, 1, 1, tone('#C8665A'));
    box(ctx, 1, -1, 1, 1, tone('#C8665A'));
  }
  ctx.restore();
}
/** The feather jar: forty years of duels in one glass. (x, y) is its base. */
function jar(ctx: Ctx, x: number, y: number, lid: number, dark = 0) {
  const tone = (c: string) => mix(c, SIL, dark * 0.6);
  glow(ctx, x, y - 8, 22, '#FFD27A', 0.45 * (1 - dark * 0.3));
  box(ctx, x - 6, y - 15, 12, 15, alpha(tone('#E6D2B0'), 0.4));
  for (let i = 0; i < 16; i++) {
    const fx = x - 4 + rand(i * 3.3) * 8,
      fy = y - 2 - rand(i * 5.1) * 11;
    line(ctx, tone(i % 2 ? '#F5E9CD' : '#EF7B4F'), 1.2, [
      fx - 2,
      fy + 1.5,
      fx + 2,
      fy - 1.5 + (i % 3),
    ]);
  }
  box(ctx, x - 6, y - 15, 1, 15, alpha('#FFFFFF', 0.5));
  box(ctx, x - 5, y - 16, 10, 1, tone('#BFA67E'));
  if (lid < 1) box(ctx, x - 5 + lid * 8, y - 18 - lid * 9, 10, 2, tone('#B5823E'));
}
function basket(ctx: Ctx, x: number, y: number, dark = 0) {
  const tone = (c: string) => mix(c, SIL, dark);
  line(ctx, tone('#8A5A30'), 1, [x - 5, y - 8, x - 3, y - 14, x + 3, y - 14, x + 5, y - 8]);
  box(ctx, x - 7, y - 8, 14, 8, tone('#A8743E'));
  box(ctx, x - 7, y - 5, 14, 1, tone('#8A5A30'));
  box(ctx, x - 6, y - 10, 5, 2, tone('#D24C44'));
  box(ctx, x - 1, y - 10, 5, 2, tone('#F2E6D2'));
}
function cup(ctx: Ctx, x: number, y: number, dark: number, seconds: number, steam = true) {
  box(ctx, x - 2, y - 3, 4, 4, mix('#EDE6DA', SIL, dark));
  if (steam)
    for (let i = 0; i < 2; i++) {
      const t = (seconds * 0.6 + i * 0.5) % 1;
      box(
        ctx,
        x - 1 + Math.sin(t * 6 + i) * 1.5,
        y - 5 - t * 8,
        1,
        2,
        alpha('#FFF4E4', 0.5 * (1 - t)),
      );
    }
}

// ——— The set ———
/** Light across the evening: duel crimson, golden hush, rose reveal, and the last of the sun. */
function dusk(p: number) {
  const a = ease(span(p, 0.38, 0.5)),
    b = ease(span(p, 0.63, 0.75)),
    c = ease(span(p, 0.8, 0.97));
  const tint = (i: number) => mix(mix(mix(SKY_A[i], SKY_B[i], a), SKY_C[i], b), SKY_D[i], c);
  return { sky: [0, 1, 2, 3].map(tint), night: c, sunY: lerp(72, 98, p) };
}

function bridge(ctx: Ctx, p: number, seconds: number, v: View) {
  const e = dusk(p),
    n = e.night;
  const tone = (day: string, night: string) => mix(day, night, n);
  const hw = W / 2 / v.zoom,
    hh = H / 2 / v.zoom;
  const left = Math.floor(v.x - hw) - 2,
    right = Math.ceil(v.x + hw) + 2,
    bottom = v.y + hh + 2;
  const width = right - left;
  sky(ctx, e.sky, -20, 112, left, width);
  // The first stars, once the sun is nearly gone.
  if (n > 0)
    for (let i = 0; i < 26; i++)
      box(
        ctx,
        left + rand(i * 7.7) * width,
        -20 + rand(i * 3.1) * 70,
        1,
        1,
        alpha('#FFF1D0', n * (0.55 + 0.45 * Math.sin(seconds * 1.3 + i))),
      );
  // The sun hangs behind whatever the camera looks at, sinking all film long.
  const sx = v.x,
    sy = e.sunY;
  glow(ctx, sx, sy, 120, '#FFB06A', 0.42 - n * 0.12);
  glow(ctx, sx, sy, 40, '#FFE2A8', 0.5 - n * 0.2);
  disc(ctx, sx, sy, 18, tone('#FFC98A', '#FFB078'));
  disc(ctx, sx, sy, 14, tone('#FFEFC6', '#FFE2AE'));
  for (let i = 0; i < 6; i++) {
    const cx = v.x - 220 + ((((i * 131 + seconds * (1.5 + i * 0.4)) % 440) + 440) % 440);
    oval(
      ctx,
      cx,
      16 + i * 12,
      26 + (i % 3) * 16,
      1.5 + (i % 2),
      alpha(tone(i < 3 ? '#C85C78' : '#F4A07A', '#5A2E5A'), 0.6),
    );
  }
  // Two ridges of hills, slower than the bridge, and a far-off keep.
  const ridge = (base: number, amp: number, freq: number, depth: number, color: string) => {
    const shift = v.x * depth;
    const pts: number[] = [left, 116];
    for (let x = left; x <= right + 6; x += 6)
      pts.push(
        x,
        base -
          amp *
            (0.6 * Math.sin((x - shift) * freq) + 0.4 * Math.sin((x - shift) * freq * 2.7 + 1.3)),
      );
    pts.push(right + 6, 116);
    poly(ctx, color, pts);
  };
  ridge(99, 5, 0.02, 0.75, tone('#9A4F68', '#4A2A50'));
  const kx = 20 + v.x * 0.75,
    keep = tone('#7A3E5C', '#3A2244');
  box(ctx, kx - 5, 82, 10, 18, keep);
  box(ctx, kx - 10, 89, 5, 11, keep);
  box(ctx, kx + 5, 86, 4, 14, keep);
  box(ctx, kx - 1, 87, 1, 2, '#FFD08A');
  ridge(106, 4, 0.035, 0.5, tone('#6A3454', '#2E1C38'));
  // The far parapet, with the chalk score on its face.
  const pl = Math.max(68, left),
    pr = Math.min(370, right);
  const joint = tone('#4A3142', '#231829');
  if (pr > pl) {
    box(ctx, pl, 113, pr - pl, 22, tone('#5E3F50', '#2C1F34'));
    box(ctx, pl, 110, pr - pl, 3, tone('#E9A57A', '#A2586A'));
    box(ctx, pl, 113, pr - pl, 1, tone('#3E2838', '#1C1224'));
    [113, 120, 127].forEach((yy, row) => {
      if (row) box(ctx, pl, yy, pr - pl, 1, joint);
      for (let x = Math.floor(pl / 18) * 18 + row * 9; x < pr; x += 18)
        if (x > pl) box(ctx, x, yy, 1, 7, joint);
    });
    tally(ctx, p, n);
  }
  // The banner pole whose rope Blue will borrow.
  const wood = tone('#3A2630', '#1C1220');
  box(ctx, POLE - 1, 18, 3, 94, wood);
  box(ctx, POLE - 1, 26, 15, 2, wood);
  disc(ctx, POLE + 0.5, 17, 2, '#E2BC62');
  const fl = Math.sin(seconds * 6);
  poly(ctx, tone('#D8A040', '#7A4A40'), [
    POLE,
    19,
    POLE - 26,
    20 + fl,
    POLE - 34,
    18 + fl * 2,
    POLE - 28,
    23 + fl * 1.5,
    POLE - 34,
    27 + fl * 2,
    POLE,
    25,
  ]);
  // Gate towers at either end, each flying its champion's colours.
  const tower = tone('#3E2739', '#1E1428'),
    rim = tone('#E08A62', '#8A4658');
  if (left < TOWERS[0]) box(ctx, left, 62, TOWERS[0] - left, 74, tower);
  if (right > TOWERS[1] + 48) box(ctx, TOWERS[1] + 48, 62, right - TOWERS[1] - 48, 74, tower);
  TOWERS.forEach((tx, i) => {
    if (tx + 48 < left || tx > right) return;
    box(ctx, tx, 14, 48, 122, tower);
    for (let k = 0; k < 4; k++) box(ctx, tx + k * 13.3, 7, 8, 8, tower);
    box(ctx, i ? tx : tx + 46, 7, 2, 129, rim);
    const wx = tx + (i ? 34 : 8);
    glow(ctx, wx + 3, 42, 14, '#FFC870', 0.35);
    box(ctx, wx, 36, 6, 12, '#F6C46C');
    box(ctx, tx + 12, 104, 24, 32, INK);
    disc(ctx, tx + 24, 104, 12, INK);
    const bw = Math.sin(seconds * 2 + i * 2) * 2,
      bx = tx + (i ? 8 : 28);
    poly(ctx, tone(i ? '#A83A36' : '#3A5A98', i ? '#5A2230' : '#28304E'), [
      bx,
      20,
      bx + 12,
      20,
      bx + 12 + bw,
      62,
      bx + 6 + bw,
      55,
      bx + bw,
      62,
    ]);
    box(ctx, bx + 4 + bw * 0.5, 30, 4, 7, tone('#F2D48A', '#8A6A50'));
  });
  // The deck and the stone face of the bridge below it.
  const slab = tone('#7A5662', '#3A2836');
  box(ctx, left, 134, width, 14, tone('#8C6670', '#43303F'));
  box(ctx, left, 134, width, 2, tone('#5E4050', '#2A1C2E'));
  box(ctx, left, 140, width, 1, slab);
  for (let x = Math.floor(left / 22) * 22; x < right; x += 22) {
    box(ctx, x, 136, 1, 4, slab);
    box(ctx, x + 11, 141, 1, 6, slab);
  }
  box(ctx, left, 147, width, 2, tone('#B07A70', '#5A3A48'));
  if (bottom > 149) {
    box(ctx, left, 149, width, bottom - 149, tone('#4C3142', '#24182C'));
    for (let yy = 157, row = 0; yy < bottom; yy += 8, row++) {
      box(ctx, left, yy, width, 1, joint);
      for (let x = Math.floor(left / 20) * 20 + (row % 2) * 10; x < right; x += 20)
        box(ctx, x, yy - 7, 1, 7, joint);
    }
    if (bottom > 168) {
      oval(ctx, 219, 204, 78, 38, tone('#6A4658', '#34223A'));
      oval(ctx, 219, 206, 72, 34, '#1A1024');
    }
  }
  // Golden shafts of light while the feather falls.
  const rays = hump(p, 0.56, 0.7);
  if (rays > 0)
    faded(ctx, rays * 0.14, () => {
      for (let i = 0; i < 4; i++) {
        const a = -0.55 + i * 0.36 + Math.sin(seconds * 0.3 + i) * 0.03;
        poly(ctx, '#FFE2A0', [
          sx,
          sy,
          sx + Math.sin(a - 0.06) * 220,
          sy + Math.cos(a - 0.06) * 220,
          sx + Math.sin(a + 0.06) * 220,
          sy + Math.cos(a + 0.06) * 220,
        ]);
      }
    });
}

/** Where the red score starts on the chalk line. */
function tallyX(ctx: Ctx) {
  ctx.font = font('italic', 5);
  return 300 + ctx.measureText('BLUE 20 · RED ').width;
}
function tally(ctx: Ctx, p: number, n: number) {
  const chalk = mix('#F1EADF', '#B8A8B4', n);
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = chalk;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let g = 0; g < 7; g++) {
    const gx = 300 + g * 7;
    for (let k = 0; k < 4; k++) {
      ctx.moveTo(gx + k * 1.3, 114.5);
      ctx.lineTo(gx + k * 1.3, 118.5);
    }
    ctx.moveTo(gx - 1, 118);
    ctx.lineTo(gx + 5, 115);
  }
  ctx.stroke();
  const style = { size: 5, type: 'italic' as const, color: chalk, align: 'left' as const };
  write(ctx, 'BLUE 20 · RED', 300, 127, style);
  const x = tallyX(ctx);
  write(ctx, '19', x, 127, style);
  const strike = span(p, CHALK, CHALK + 0.006),
    fresh = span(p, CHALK + 0.007, CHALK + 0.02);
  if (strike > 0) line(ctx, chalk, 0.6, [x - 1, 126, x - 1 + strike * 10, 123]);
  if (fresh > 0) {
    ctx.beginPath();
    ctx.rect(x + 2, 115, fresh * 12, 12);
    ctx.clip();
    write(ctx, '20', x + 3, 121.5, style);
  }
  ctx.restore();
}

function rope(
  ctx: Ctx,
  p: number,
  seconds: number,
  held: { x: number; y: number } | null,
  n: number,
) {
  let end = { x: PIVOT.x + Math.sin(seconds * 1.3) * 1.5, y: PIVOT.y + ROPE };
  if (held) end = held;
  else if (p >= LET_GO) {
    const t = (p - LET_GO) / BEAT;
    const th = -0.454 * Math.cos(t * 1.2) * Math.exp(-t * 0.25) + Math.sin(seconds * 1.3) * 0.02;
    end = { x: PIVOT.x + ROPE * Math.sin(th), y: PIVOT.y + ROPE * Math.cos(th) };
  }
  line(ctx, mix('#C8A26A', '#6A5048', n), 1, [PIVOT.x, PIVOT.y, end.x, end.y]);
  if (!held) box(ctx, end.x - 1, end.y, 3, 3, mix('#D24C44', '#6A3040', n));
}

// ——— Boots on the stones ———
/** Footwork in the low close-up: [beat, foot, dx]. Feet: Blue back, Blue front, Red front, Red back. */
const FOOTWORK: readonly (readonly [number, number, number])[] = [
  [24.6, 1, 30],
  [24.7, 3, 28],
  [24.8, 0, 30],
  [24.85, 2, 28],
  [25.3, 2, -32],
  [25.4, 0, -26],
  [25.45, 3, -32],
  [25.55, 1, -26],
  [25.95, 1, 22],
  [26.1, 3, 12],
  [26.15, 2, 12],
];
const STEP_BEATS = 0.22;
const FEET = [52, 112, 212, 272] as const;
function foot(i: number, p: number) {
  let x = FEET[i],
    lift = 0;
  for (const [n, f, dx] of FOOTWORK)
    if (f === i) {
      const t = span(p, at(n), at(n + STEP_BEATS));
      x += dx * ease(t);
      lift = Math.max(lift, Math.sin(t * Math.PI));
    }
  return { x, lift };
}
function boot(ctx: Ctx, x: number, lift: number, facing: number, who: Who, far: boolean) {
  const dim = (c: string) => (far ? mix(c, SIL, 0.3) : c);
  const tall = who === 'blue' ? 60 : 42;
  const leather = dim(who === 'blue' ? '#3A2622' : '#5A2A24');
  oval(ctx, x + facing * 6, 152, 17 - lift * 5, 3, alpha('#1A1020', 0.35 - lift * 0.15));
  ctx.save();
  ctx.translate(x, 150 - lift * 12);
  ctx.scale(facing, 1);
  box(ctx, -7, -200, 14, 200 - tall, dim(LOOKS[who].legs));
  box(ctx, -9, -tall, 18, tall - 8, leather);
  box(ctx, -12, -tall - 6, 24, 8, dim(who === 'blue' ? '#5C4032' : '#7A3A2E'));
  poly(ctx, leather, [-10, -12, 8, -12, 20, -7, 24, -2, 24, 0, -10, 0]);
  box(ctx, -10, 0, 34, 2, '#1A1216');
  box(ctx, -10, 0, 8, 4, '#1A1216');
  box(ctx, 2, -22, 4, 4, dim('#E2BC62'));
  box(ctx, -8, -tall, 2, tall - 8, alpha('#FFD2A0', 0.25));
  ctx.restore();
}
function bootsShot(ctx: Ctx, p: number, seconds: number) {
  box(ctx, 0, 0, W, 104, '#5A3C4E');
  [26, 52, 78].forEach((yy, row) => {
    box(ctx, 0, yy, W, 1, '#442C3C');
    for (let x = (row % 2) * 28; x < W; x += 56) box(ctx, x, yy - 26, 1, 26, '#442C3C');
  });
  const rows = [104, 111, 121, 136, 156, 180];
  for (let i = 0; i < rows.length - 1; i++) {
    box(ctx, 0, rows[i], W, rows[i + 1] - rows[i], i % 2 ? '#8E6872' : '#86606A');
    box(ctx, 0, rows[i], W, 1, '#6E4E5A');
    const step = 26 + i * 14;
    for (let x = (i * 17) % step; x < W; x += step)
      box(ctx, x, rows[i], 1, rows[i + 1] - rows[i], '#6E4E5A');
  }
  glow(ctx, 70, 10, 220, '#FFB06A', 0.35);
  const drift = ((p - at(24.5)) / (2 * BEAT)) * -14;
  for (const i of [0, 3, 1, 2]) {
    const f = foot(i, p);
    boot(ctx, f.x + drift, f.lift, i < 2 ? 1 : -1, i < 2 ? 'blue' : 'red', i === 0 || i === 3);
  }
  // Cloak hems whip across the top of the frame.
  const w = Math.sin(seconds * 6);
  poly(ctx, LOOKS.blue.cloak, [
    30 + drift,
    0,
    150 + drift,
    0,
    140 + drift + w * 6,
    14,
    90 + drift,
    20 + w * 3,
    40 + drift,
    12,
  ]);
  poly(ctx, LOOKS.red.cloak, [
    190 + drift,
    0,
    300 + drift,
    0,
    290 + drift,
    10 - w * 3,
    240 + drift,
    16,
    200 + drift - w * 5,
    11,
  ]);
}

// ——— Staging: where everyone is, act by act ———
type Cast = { blue: Pose; red: Pose };
const stance = (x: number) => 1.2 + Math.sin(x * 0.22) * 0.5;
const plumePoint = (pose: Pose) => bodyPoint('blue', pose, -11, -33);

function rally(p: number, keys: Bout, ry = DECK): Cast {
  const [bx, bax, bay] = keyed(p, keys.b);
  const [rx, rax, ray] = keyed(p, keys.r);
  const locked = within(p, at(7.5), at(9.1)) || within(p, at(30), THROW);
  const shiver = locked ? Math.sin(p * 9000) * 0.6 : 0;
  return {
    blue: { x: bx, aim: [bax, bay + shiver], step: stance(bx), lean: 0.06, billow: 0.9 },
    red: { x: rx, y: ry, aim: [rax, ray + shiver], step: stance(rx), lean: 0.06, billow: 0.9 },
  };
}

function opening(p: number): Cast {
  const walk = span(p, 0, WALK_END);
  const step = p < WALK_END ? (p / STRIDE) * Math.PI : undefined;
  const [arm, blade, back] = keyed(p, [
    [WALK_END - 0.004, 0.4, 0.9, -0.5],
    [SALUTE, 2.3, -Math.PI / 2, -0.5],
    [SALUTE_DOWN, 2.3, -Math.PI / 2, -0.5],
    [SALUTE_DOWN + 0.005, 0.9, 0.8, -1.6],
    [0.094, 0.9, 0.8, -2.3],
    [DUEL, 1.35, -0.12, -2.3],
  ]);
  const common = { arm, blade, back, step, billow: 1 };
  return {
    blue: { ...common, x: lerp(44, 176, walk) },
    red: { ...common, x: lerp(394, 262, walk) },
  };
}

function breather(p: number, seconds: number): Cast {
  const t = (p - BREATH) / BEAT;
  const bend = ease(span(t, 0.1, 0.5)) * (1 - ease(span(t, 1.9, 2.3)));
  const wait = ease(span(t, 0.2, 0.6));
  return {
    blue: {
      x: 190,
      arm: lerp(1.35, 0.5, wait),
      blade: lerp(-0.12, 1, wait),
      back: lerp(-2.3, -0.6, wait),
      step: t > 1 ? 1.2 + Math.sin(seconds * 10) * 0.25 : 1.2,
      lean: -0.04,
    },
    red: {
      x: lerp(284, 288, bend),
      arm: lerp(1.35, 0.3, bend),
      blade: lerp(-0.12, 1.3, bend),
      back: lerp(-2.3, 2.6, bend),
      lean: 0.45 * bend + Math.sin(seconds * 9) * 0.05 * bend,
      eyes: bend > 0.5 ? 'closed' : 'open',
      step: 1.2,
      billow: 0.3,
    },
  };
}

function leap(p: number, seconds: number): Cast {
  if (p >= at(14)) return rally(p, RALLY_B, PARAPET);
  const charge = span(p, RESUME + 0.002, at(14));
  const bx = lerp(190, 276, ease(charge));
  const blue: Pose = {
    x: bx,
    aim: guardB(bx),
    step: charge > 0 && charge < 1 ? seconds * 14 : 1.2,
    billow: 1,
  };
  const retreat = span(p, RESUME, LEAP);
  const t = span(p, LEAP, PERCH);
  let red: Pose;
  if (p < LEAP) {
    const x = lerp(284, 318, ease(retreat));
    red = { x, aim: guardR(x), step: retreat > 0 ? seconds * 12 : 1.2 };
  } else if (p < PERCH) {
    const x = lerp(318, 340, ease(t)),
      y = lerp(DECK, PARAPET, t) - Math.sin(Math.PI * t) * 22;
    red = { x, y, aim: [x - 20, y - 70], back: 2.6, step: 2.2, billow: 1 };
  } else
    red = {
      x: 340,
      y: PARAPET,
      aim: guardR(340, PARAPET),
      lean: hump(p, PERCH, at(14)) * 0.25,
      step: 1.2,
    };
  return { blue, red };
}

function knee(p: number): Cast {
  const lunge = ease(span(p, at(17.5), at(17.9)));
  const recover = ease(span(p, at(18.5), at(19)));
  const bx = 282 + lunge * 8 - recover * 4;
  const hurt = p >= KNEE;
  return {
    blue: {
      x: bx,
      aim: [bx + 32, DECK - 84 + recover * 30],
      lean: 0.3 * lunge * (1 - recover) - 0.1 * recover,
      step: 1.2 + lunge * 0.5,
      back: hurt ? lerp(-2.3, 0.5, ease(span(p, KNEE, KNEE + 0.004))) : -2.3,
      eyes: hurt ? (p < at(18.5) ? 'wide' : 'closed') : 'open',
      mouth: hurt ? 'frown' : 'flat',
    },
    red: { x: 338, y: PARAPET, aim: guardR(338, PARAPET) },
  };
}

const ropeAngle = (p: number) =>
  keyed(p, [
    [SWING, -0.576],
    [APEX, 0.52],
    [LET_GO, -0.454],
  ])[0];
function swing(p: number, seconds: number): Cast {
  let blue: Pose;
  if (p < SWING) {
    // Back under the rope, grab it, and walk it back taut.
    const x =
      p < GRAB
        ? lerp(286, 263, ease(span(p, at(19), GRAB)))
        : lerp(263, 225, ease(span(p, GRAB + 0.002, SWING - 0.001)));
    const moving = within(p, at(19), GRAB) || within(p, GRAB + 0.002, SWING - 0.001);
    blue = {
      x,
      aim: guardB(x),
      back: lerp(-2.3, Math.PI, ease(span(p, GRAB - 0.003, GRAB))),
      step: moving ? seconds * 12 : 1.2,
      lean: -0.05,
    };
  } else if (p < LET_GO) {
    // Hanging from the rope by one hand, knees tucked, sword out.
    const th = ropeAngle(p);
    const x = PIVOT.x + ROPE * Math.sin(th) + 1.3,
      y = PIVOT.y + ROPE * Math.cos(th) + 44.2;
    const toward =
      ease(span(p, APEX - 0.6 * BEAT, APEX)) * (1 - ease(span(p, APEX, APEX + 0.5 * BEAT)));
    blue = {
      x,
      y,
      sitting: true,
      back: Math.PI,
      aim: [lerp(x + 38, SWING_HIT.x, toward), lerp(y - 36, SWING_HIT.y, toward)],
      billow: 1,
    };
  } else if (p < TOUCH) {
    const t = span(p, LET_GO, TOUCH);
    const x = lerp(232.6, 226, t),
      y = lerp(135.1, DECK, easeIn(t));
    blue = { x, y, sitting: true, back: lerp(Math.PI, 2.4, t), aim: [x + 36, y - 40], billow: 1 };
  } else {
    const flourish = hump(p, TOUCH, at(23.6));
    blue = {
      x: 226,
      aim: [262 - flourish * 20, DECK - 46 - flourish * 50],
      back: -2.3 + flourish * 0.5,
      step: 1.2,
    };
  }
  let red: Pose;
  if (p < HOP) {
    const g = guardR(340, PARAPET);
    if (p < APEX) {
      const toward = ease(span(p, APEX - 0.6 * BEAT, APEX));
      red = {
        x: 340,
        y: PARAPET,
        aim: [lerp(g[0], SWING_HIT.x, toward), lerp(g[1], SWING_HIT.y, toward)],
      };
    } else {
      // Knocked off balance: arms windmilling on top of the wall.
      const wobble = Math.sin(((p - APEX) / BEAT) * 9) * (1 - span(p, APEX, HOP));
      const flail = ease(span(p, APEX, APEX + 0.3 * BEAT));
      red = {
        x: 340,
        y: PARAPET,
        aim: [lerp(SWING_HIT.x, 334 + wobble * 16, flail), lerp(SWING_HIT.y, 44, flail)],
        lean: wobble * 0.35,
        back: 2.4 + wobble,
        eyes: 'wide',
      };
    }
  } else if (p < HOP_LAND) {
    const t = span(p, HOP, HOP_LAND);
    const x = lerp(340, 318, t);
    red = {
      x,
      y: lerp(PARAPET, DECK, t) - Math.sin(Math.PI * t) * 10,
      aim: [x - 30, DECK - 90],
      back: 2.6,
      step: 2,
    };
  } else {
    // The landing finds his back.
    const ouch = hump(p, BACK - 0.002, at(24.4));
    red = {
      x: 318,
      arm: lerp(1.35, 0.4, ouch),
      blade: lerp(-0.12, 1.1, ouch),
      back: lerp(-2.3, -0.5, ouch),
      lean: -0.22 * ouch,
      eyes: ouch > 0.3 ? 'closed' : 'open',
      step: 1.2,
    };
  }
  return { blue, red };
}

function pause(p: number, seconds: number): Cast {
  const settle = ease(span(p, PAUSE, PAUSE + 0.01));
  const pant = (ph: number) => 0.3 * settle + Math.sin(seconds * 6.5 + ph) * 0.05;
  const lean = { arm: 0.55, blade: Math.PI / 2, plant: true, back: 0.55, step: 1.2 };
  const blue: Pose = {
    ...lean,
    x: lerp(236, 240, settle),
    lean: pant(0),
    eyes: 'closed',
    mouth: 'open',
  };
  const red: Pose = { ...lean, x: lerp(336, 334, settle), lean: pant(1.4), eyes: 'closed' };
  if (p > 0.445) {
    // Blue hunts through his cloak for his spectacles and perches them on over the mask.
    const lift = ease(span(p, 0.458, SPECS)) * (1 - ease(span(p, SPECS + 0.002, SPECS + 0.008)));
    blue.back = within(p, 0.447, 0.456)
      ? 1.3 + Math.sin(seconds * 16) * 0.25
      : lerp(0.55, 2.35, lift);
    blue.specs = p >= SPECS ? 'on' : p >= 0.456 ? 'hand' : 'off';
    blue.eyes = p >= SPECS ? 'open' : 'closed';
    blue.mouth = 'flat';
    if (p >= SPECS) blue.lean = 0.1;
  }
  if (p > 0.482) {
    // Red mops his brow; his scarf slips; out springs a magnificent white moustache.
    const up = ease(span(p, 0.482, WIPE)) * (1 - ease(span(p, 0.5, 0.505)));
    red.back = lerp(0.55, 2.6 + (within(p, WIPE, 0.5) ? Math.sin(seconds * 14) * 0.25 : 0), up);
    red.hanky = p < 0.506;
    red.scarf = 1 - ease(span(p, SLIP, SLIP + 0.003));
    const since = (p - SLIP) / BEAT;
    red.tache = p > SLIP ? Math.sin(since * 7) * Math.exp(-since * 1.2) : 0;
    red.eyes = p > SLIP + 0.002 && p < 0.514 ? 'wide' : 'open';
    red.lean = 0.12 - hump(p, 0.512, 0.52) * 0.15;
  }
  return { blue, red };
}

function blueFinale(p: number): Pose {
  const [x, lean] = keyed(p, [
    [0.52, 240, 0.2],
    [GUARD2, 250, 0],
    [0.546, 250, 0],
    [LUNGE, 262, 0.2],
    [0.553, 262, 0.2],
    [0.558, 252, 0],
    [FLICK - 0.004, 252, 0.75],
    [0.575, 252, 0.75],
    [0.598, 252, 0],
  ]);
  return {
    x,
    lean,
    step: 1.2 + lean * 0.8,
    specs: 'on',
    feather: p < FLICK,
    eyes: within(p, FLICK, 0.59) ? 'wide' : 'open',
    billow: 0.7,
    aim: keyed(p, [
      [0.52, 280, 96],
      [GUARD2, ...guardB(250)],
      [0.546, ...guardB(250)],
      [LUNGE, 300, 104],
      [PARRY, PARRY_HIT.x, PARRY_HIT.y],
      [0.557, 290, 84],
      [0.563, 292, 126],
      [0.575, 292, 128],
      [0.6, 276, 152],
    ]),
  };
}
function redFinale(p: number): Pose {
  const [x] = keyed(p, [
    [0.52, 334],
    [GUARD2, 318],
    [PARRY - 0.004, 318],
    [PARRY, 312],
    [0.558, 298],
    [FLICK, 294],
    [0.575, 296],
    [0.6, 302],
  ]);
  const pose: Pose = { x, y: DECK - hump(p, 0.56, 0.574) * 12, scarf: 0, step: 1.2, billow: 0.7 };
  if (p < 0.528) pose.aim = guardR(x);
  else if (p < 0.546) {
    // The flourish: two showy loops of the blade.
    const a = span(p, 0.528, 0.546) * TAU * 2;
    pose.aim = [x - 34 + Math.cos(a) * 14, DECK - 44 + Math.sin(a) * 14];
  } else {
    const tip = plumePoint(blueFinale(FLICK));
    pose.aim = keyed(p, [
      [0.546, 298, 98],
      [PARRY, PARRY_HIT.x, PARRY_HIT.y],
      [0.557, 272, 130],
      [FLICK, tip.x, tip.y],
      [0.575, 300, 24],
      [0.585, 300, 24],
      [0.605, 276, 156],
    ]);
  }
  return pose;
}
/** The loose feather: flicked up, then down in slow swings to the stones. */
function looseFeather(p: number) {
  const f0 = plumePoint(blueFinale(FLICK));
  if (p < FALL) {
    const t = easeOut(span(p, FLICK, FALL));
    return { x: f0.x + t * 10, y: f0.y - t * 14, a: -0.5 + t * (1.05 + TAU) };
  }
  if (p >= LAND) {
    const s = (p - LAND) / BEAT;
    return { x: 284, y: DECK - 1, a: Math.sin(s * 5) * 0.2 * Math.exp(-s * 1.5) };
  }
  const t = span(p, FALL, LAND);
  const sw = Math.sin(t * 3 * TAU);
  return {
    x: lerp(f0.x + 10, 284, t) + sw * 12 * (1 - t * 0.4),
    y: lerp(f0.y - 14, DECK - 1, t) - Math.abs(sw) * 3,
    a: Math.cos(t * 3 * TAU) * 0.55 * (1 - t),
  };
}

function reveal(p: number, seconds: number): Cast {
  const hug = ease(span(p, HUG - 0.006, HUG + 0.004));
  const settle = ease(span(p, 0.665, 0.672));
  const laugh = within(p, LAUGH, HUG) ? 1 : 0;
  const pat = Math.max(...PATS.map((t) => hump(p, t - 0.004, t)));
  const face = (bow: number): Pick<Pose, 'eyes' | 'mouth'> =>
    laugh || hug > 0.5
      ? { eyes: 'happy', mouth: laugh ? 'grin' : 'smile' }
      : { eyes: bow > 0.3 ? 'closed' : 'open', mouth: 'flat' };
  const arms = (bow: number): Key[] => [
    [0.665, 0.3, -0.4],
    [bow, 0.3, -0.4],
    [bow + 0.008, 0.3, 1.3],
    [0.697, 0.3, 1.3],
    [0.703, 0.3, -0.4],
    [LAUGH + 0.004, 1, 0.9],
    [HATS, 1, 0.9],
    [HATS + 0.008, 1, 2.8],
    [HATS + 0.014, 1, 2.8],
    [MASKS - 0.006, 1, -0.3],
    [MASKS - 0.002, 2.7, -0.3],
    [MASKS + 0.003, 2.7, -0.3],
    [MASKS + 0.008, 0.6, -0.3],
    [HUG - 0.006, 0.6, -0.3],
    [HUG + 0.004, 1.9, -0.3],
  ];
  const common = {
    mask: p < MASKS,
    hat: p < HATS ? ('on' as const) : ('hand' as const),
    sword: p < DROP_SWORDS,
    blade: 1.2,
    billow: 0.4,
    step: 1.2,
  };
  const bowB = ease(span(p, BOW, BOW + 0.008)) * (1 - ease(span(p, 0.69, 0.697)));
  const bowR = ease(span(p, BOW_RED, BOW_RED + 0.007)) * (1 - ease(span(p, 0.697, 0.703)));
  const [ba, bb] = keyed(p, arms(BOW)),
    [ra, rb] = keyed(p, arms(BOW_RED));
  return {
    blue: {
      ...common,
      ...face(bowB),
      x: lerp(lerp(252, 256, settle), 274, hug),
      feather: false,
      specs: 'on',
      lean: bowB * 0.55 + laugh * (-0.1 + Math.sin(seconds * 13) * 0.07) + hug * 0.14,
      arm: ba + pat * 0.35,
      back: bb,
    },
    red: {
      ...common,
      ...face(bowR),
      x: lerp(lerp(302, 308, settle), 290, hug),
      scarf: 0,
      tache:
        hump(p, 0.699, 0.705) * Math.sin(seconds * 30) * 0.4 +
        laugh * Math.sin(seconds * 20) * 0.15,
      lean: bowR * 0.45 + laugh * (0.12 + Math.sin(seconds * 15 + 1) * 0.08) + hug * 0.14,
      arm: ra + pat * 0.35,
      back: rb,
    },
  };
}

/** The tip of the chalk while Red squares the score. */
function chalkTip(ctx: Ctx, p: number) {
  const x = tallyX(ctx);
  const strike = span(p, CHALK, CHALK + 0.006),
    fresh = span(p, CHALK + 0.007, CHALK + 0.02);
  return fresh > 0
    ? { x: x + 3 + fresh * 9, y: 120 + Math.sin(fresh * 18) * 1.5 }
    : { x: x - 1 + strike * 10, y: 126 - strike * 3 };
}
function picnic(p: number, ctx: Ctx): Cast {
  const base = { sitting: true, hat: 'off' as const, mask: false, sword: false, billow: 0.2 };
  const blue: Pose = {
    ...base,
    x: SEAT.blue,
    y: PARAPET,
    specs: 'on',
    feather: false,
    arm: 1.45,
    back: 0.3,
    lean: 0.05,
    eyes: 'happy',
    mouth: 'smile',
  };
  const red: Pose = {
    ...base,
    x: SEAT.red,
    y: PARAPET,
    scarf: 0,
    arm: 1.5,
    back: 0.3,
    lean: 0.1,
    eyes: 'happy',
  };
  // Tea: Red pours, they clink, they sip.
  const pour = hump(p, POUR - 0.004, POUR + 0.02);
  red.lean = 0.1 + pour * 0.25;
  red.arm = 1.5 + pour * 0.3;
  const clink = hump(p, CLINK - 0.008, CLINK + 0.006);
  if (clink > 0) {
    const meet = [322, 84] as const;
    blue.lean = 0.05 + clink * 0.25;
    red.lean = 0.1 + clink * 0.25;
    blue.arm = lerp(1.45, reach('blue', blue, ...meet), clink);
    red.arm = lerp(1.5, reach('red', red, ...meet), clink);
  }
  const sip = hump(p, 0.848, 0.858);
  blue.arm = (blue.arm ?? 1.45) + sip * 1.1;
  red.arm = (red.arm ?? 1.5) + sip * 1.1;
  if (within(p, 0.86, 0.905)) {
    // The jar: Red holds it in his lap and lifts the lid; Blue drops the feather in.
    red.arm = 1.05;
    red.lean = 0.2;
    red.back = lerp(0.3, 2, hump(p, LID_OFF - 0.005, LID_ON + 0.004));
    red.eyes = 'open';
    const offer = ease(span(p, 0.862, 0.872)) * (1 - ease(span(p, DROP + 0.004, 0.892)));
    blue.lean = 0.05 + offer * 0.3;
    blue.arm = lerp(1.45, 1.9, offer);
    blue.eyes = 'open';
  }
  if (within(p, 0.905, 0.942)) {
    // Red hops down to square the score on the wall in chalk.
    const tip = chalkTip(ctx, p);
    red.x = 352;
    red.y = DECK;
    red.sitting = false;
    red.step = 1.2;
    red.lean = 0.1;
    red.aim = [tip.x, tip.y];
    red.mouth = 'smile';
  }
  if (p >= 0.942) {
    blue.lean = 0.1;
    red.lean = 0.14;
  }
  return { blue, red };
}

function cast(p: number, seconds: number, ctx: Ctx): Cast {
  if (p < DUEL) return opening(p);
  if (p < BREATH) return rally(p, RALLY_A);
  if (p < RESUME) return breather(p, seconds);
  if (p < at(17.5)) return leap(p, seconds);
  if (p < at(19)) return knee(p);
  if (p < at(26.5)) return swing(p, seconds);
  if (p < PAUSE) return rally(p, RALLY_C);
  if (p < 0.52) return pause(p, seconds);
  if (p < 0.665) return { blue: blueFinale(p), red: redFinale(p) };
  if (p < 0.8) return reveal(p, seconds);
  return picnic(p, ctx);
}

// ——— Putting it on screen ———
function pigeonAt(p: number, seconds: number) {
  if (p < PERCH + 0.003) return { x: 356, y: PARAPET, facing: -1, flap: null, peck: 0 };
  if (p < PERCH + 0.035) {
    const t = span(p, PERCH + 0.003, PERCH + 0.035);
    return { x: 356 + t * 110, y: PARAPET - t * 100, facing: 1, flap: seconds * 28, peck: 0 };
  }
  if (p < PIGEON_BACK - 0.014) return null;
  if (p < PIGEON_BACK) {
    const t = ease(span(p, PIGEON_BACK - 0.014, PIGEON_BACK));
    return {
      x: lerp(390, 288, t),
      y: lerp(30, PARAPET, t),
      facing: -1,
      flap: seconds * 24,
      peck: 0,
    };
  }
  if (p < 0.8) {
    // It watches the feather all the way down.
    const watching = within(p, FLICK, LAND + 0.02);
    const facing = watching
      ? looseFeather(p).x > 288
        ? 1
        : -1
      : Math.sin(seconds * 0.8) > 0
        ? 1
        : -1;
    return { x: 288, y: PARAPET, facing, flap: null, peck: 0 };
  }
  return {
    x: 264,
    y: PARAPET,
    facing: 1,
    flap: null,
    peck: Math.max(0, Math.sin(seconds * 4)) ** 4,
  };
}

function dust(ctx: Ctx, x: number, y: number, p: number, from: number, size = 1) {
  if (p < from || p >= from + 0.012) return;
  const t = span(p, from, from + 0.012);
  for (const side of [-1, 1])
    oval(
      ctx,
      x + side * (3 + t * 10) * size,
      y - 1 - t * 3,
      (2 + t * 3) * size,
      (1 + t) * size,
      alpha('#E8C9B0', 0.5 * (1 - t)),
    );
}
function sparks(ctx: Ctx, p: number) {
  for (const c of CLASHES) {
    if (p < c.p || p >= c.p + 0.007) continue;
    const t = span(p, c.p, c.p + 0.007),
      r = c.big ? 18 : 11;
    glow(ctx, c.x, c.y, r, '#FFE3A0', 0.55 * (1 - t));
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + c.p * 60,
        d = 2 + t * r;
      box(
        ctx,
        c.x + Math.cos(a) * d,
        c.y + Math.sin(a) * d + t * t * 8,
        1,
        1,
        alpha('#FFF4C8', 1 - t),
      );
    }
  }
}
/** Little strain lines by a creaking joint. */
function creak(ctx: Ctx, x: number, y: number, amount: number) {
  if (amount <= 0) return;
  faded(ctx, amount, () => {
    for (let i = 0; i < 3; i++) {
      const a = -1.2 + i * 0.9,
        c = Math.cos(a),
        s = Math.sin(a);
      line(ctx, '#FFF0D0', 0.7, [
        x + c * 4,
        y + s * 4,
        x + c * 6.5 - s,
        y + s * 6.5 + c,
        x + c * 9,
        y + s * 9,
      ]);
    }
  });
}
/** How backlit the pair are: silhouettes at either end of the film. */
function shadowing(p: number) {
  if (p < 0.056) return lerp(0.62, 0.35, span(p, 0, 0.056));
  if (p < DUEL) return 0.16;
  if (p >= 0.942) return lerp(0.35, 0.72, ease(span(p, 0.942, 0.995)));
  if (p >= 0.8) return 0.2;
  return 0.05;
}

function players(ctx: Ctx, p: number, seconds: number) {
  const { blue, red } = cast(p, seconds, ctx);
  const dark = shadowing(p),
    n = dusk(p).night;
  blue.dark = red.dark = dark;
  const tone = (c: string) => mix(c, SIL, dark);
  const bird = pigeonAt(p, seconds);
  if (bird) pigeon(ctx, bird.x, bird.y, bird.facing, bird.flap, bird.peck, dark);
  const picnicking = p >= 0.8;
  if (picnicking) {
    // Swords crossed against the wall, hats off, the basket, the flask.
    sword(ctx, 262, 134, -0.9, tone);
    sword(ctx, 292, 134, Math.PI + 0.9, tone);
    ctx.save();
    ctx.translate(278, PARAPET);
    ctx.scale(K * 0.84, K * 1.14);
    ctx.translate(0, 24);
    hat(ctx, 'blue', false, tone, 0);
    ctx.restore();
    basket(ctx, 366, PARAPET, dark);
    ctx.save();
    ctx.translate(366, PARAPET - 9);
    ctx.scale(-K * 1.18, K * 0.88);
    ctx.translate(0, 24);
    hat(ctx, 'red', true, tone, Math.sin(seconds * 2) * 0.5);
    ctx.restore();
    if (p > 0.83) {
      box(ctx, 334, 103, 4, 9, tone('#5A6A7A'));
      box(ctx, 334, 101, 4, 2, tone('#3A4450'));
    }
    if (p < 0.862) plume(ctx, 318, 111, 0.1, tone(LOOKS.blue.plume), 14);
  }
  if (within(p, DROP_SWORDS, 0.8)) {
    sword(ctx, 246, DECK + 2, -0.03, tone);
    sword(ctx, 322, DECK - 1, Math.PI + 0.05, tone);
  }
  const holding = p >= GRAB && p < LET_GO;
  if (!holding) rope(ctx, p, seconds, null, n);
  const b = fencer(ctx, 'blue', blue, seconds);
  if (holding) rope(ctx, p, seconds, b.other, n);
  const r = fencer(ctx, 'red', red, seconds);
  sparks(ctx, p);
  // Age hints: one finger for a moment, sweat, a creaking knee, a twinging back.
  if (within(p, BREATH, RESUME)) {
    if ((red.back ?? 0) > 2) box(ctx, r.other.x - 0.5, r.other.y - 5, 1.2, 4, LOOKS.red.skin);
    const head = bodyPoint('red', red, 1, -24);
    for (let i = 0; i < 2; i++) {
      const t = (seconds * 1.4 + i * 0.5) % 1;
      box(
        ctx,
        head.x + (i ? 1 : -1) * (2 + t * 8),
        head.y - Math.sin(t * Math.PI) * 6 + t * 5,
        1,
        2,
        alpha('#CFEFFA', 1 - t),
      );
    }
  }
  creak(ctx, blue.x + 4, DECK - 10, p >= KNEE ? 1 - span(p, KNEE, KNEE + 0.014) : 0);
  if (p >= BACK && p < BACK + 0.014) {
    const spot = bodyPoint('red', red, -6, -4);
    creak(ctx, spot.x, spot.y, 1 - span(p, BACK, BACK + 0.014));
  }
  dust(ctx, 340, PARAPET, p, PERCH);
  dust(ctx, 226, DECK, p, TOUCH);
  dust(ctx, 318, DECK, p, HOP_LAND);
  dust(ctx, 284, DECK, p, LAND, 0.5);
  // The feather.
  if (p >= FLICK && p < 0.8) {
    const f = looseFeather(p);
    if (p < LAND) glow(ctx, f.x, f.y, 16, '#FFE7B0', 0.35);
    plume(ctx, f.x, f.y, f.a, tone(LOOKS.blue.plume));
  }
  if (!picnicking) return;
  // Tea, the jar, and the chalk.
  const jarShot = within(p, 0.86, 0.905);
  if (p < 0.83) {
    const pour = hump(p, POUR - 0.004, POUR + 0.02);
    ctx.save();
    ctx.translate(r.hand.x, r.hand.y);
    ctx.rotate(-pour * 1.3);
    box(ctx, -2, -8, 4, 9, tone('#5A6A7A'));
    box(ctx, -2, -10, 4, 2, tone('#3A4450'));
    ctx.restore();
    if (within(p, POUR, POUR + 0.015))
      line(ctx, '#A8622E', 1, [
        r.hand.x - 4,
        r.hand.y - 8,
        (r.hand.x + b.hand.x) / 2,
        r.hand.y - 9,
        b.hand.x,
        b.hand.y - 2,
      ]);
  } else if ((!jarShot && p < 0.905) || p >= 0.942) cup(ctx, r.hand.x, r.hand.y, dark, seconds);
  if (!jarShot || p < 0.862) cup(ctx, b.hand.x, b.hand.y, dark, seconds, !jarShot);
  if (jarShot) {
    const down = ease(span(p, 0.897, 0.904));
    const jx = lerp(r.hand.x - 2, JAR_X, down),
      jy = lerp(r.hand.y + 7, PARAPET, down);
    const lid =
      ease(span(p, LID_OFF - 0.003, LID_OFF + 0.003)) * (1 - ease(span(p, LID_ON - 0.004, LID_ON)));
    jar(ctx, jx, jy, lid, dark);
    if (p >= 0.862 && p < DROP)
      plume(ctx, b.hand.x + 3, b.hand.y - 2, -0.4, tone(LOOKS.blue.plume), 14);
    else if (p >= DROP && p < DROP + 0.011) {
      const t = span(p, DROP, DROP + 0.011);
      faded(ctx, 1 - ease(span(t, 0.75, 1)), () =>
        plume(
          ctx,
          lerp(b.hand.x + 3, jx, t) + Math.sin(t * 9) * 3,
          lerp(b.hand.y - 2, jy - 11, t),
          -0.4 + Math.sin(t * 9) * 0.5,
          tone(LOOKS.blue.plume),
          14,
        ),
      );
    }
  } else if (p >= 0.905) jar(ctx, JAR_X, PARAPET, 0, dark);
  if (within(p, 0.905, 0.942)) {
    const tip = chalkTip(ctx, p);
    line(ctx, '#F4F0E6', 1.4, [r.hand.x, r.hand.y, tip.x, tip.y]);
  }
}

// Camera keyframes: [p, x, y, zoom]. Two keys at the same p are a hard cut.
const CAM = [
  [0, 219, 92, 0.82],
  [0.056, 219, 96, 0.9],
  [0.056, 219, 100, 1.3],
  [DUEL, 219, 100, 1.5],
  [DUEL, 219, 100, 1.3],
  [at(3), 246, 100, 1.3],
  [at(6), 226, 100, 1.3],
  [at(7.25), 229, 100, 1.35],
  [at(7.25), 229, 92, 3],
  [BREATH, 229, 88, 3.3],
  [BREATH, 240, 100, 1.45],
  [RESUME, 244, 100, 1.45],
  [RESUME, 280, 96, 1.2],
  [at(17.5), 300, 92, 1.25],
  [at(17.5), 284, 108, 1.9],
  [at(19), 282, 110, 2],
  [at(19), 282, 88, 1.1],
  [at(24.5), 280, 90, 1.12],
  [at(26.5), 283, 100, 1.35],
  [at(29), 283, 100, 1.35],
  [at(29.9), 285, 92, 2.2],
  [at(31.4), 285, 90, 2.4],
  [PAUSE - 0.001, 286, 98, 1.3],
  [PAUSE, 287, 100, 1.3],
  [0.445, 288, 102, 1.4],
  [0.445, 244, 90, 2.4],
  [0.475, 246, 90, 2.5],
  [0.49, 330, 98, 2.5],
  [0.52, 332, 98, 2.6],
  [0.52, 286, 98, 1.4],
  [0.562, 282, 96, 1.5],
  [0.562, 266, 82, 3],
  [0.578, 268, 78, 3.1],
  [0.645, 284, 134, 3.4],
  [0.665, 284, 132, 3.5],
  [0.665, 282, 98, 1.45],
  [0.712, 282, 96, 1.5],
  [0.73, 283, 90, 2.1],
  [0.765, 283, 92, 2],
  [0.8, 283, 96, 1.7],
  [0.8, 323, 96, 1.6],
  [0.86, 323, 96, 1.7],
  [0.86, 328, 90, 3.2],
  [0.905, 326, 90, 3.3],
  [0.905, 322, 124, 3.4],
  [0.942, 322, 122, 3.5],
  [0.942, 323, 94, 1.25],
  [1, 323, 92, 1.02],
] as const;
/** While the feather falls the camera drifts down with it, both old men in frame. */
function featherCam(p: number): View {
  const f = looseFeather(p);
  return {
    x: lerp(f.x, 276, 0.4),
    y: clamp(f.y + 10, 70, 104),
    zoom: lerp(2.3, 2, span(p, 0.578, 0.645)),
  };
}

// ——— The score ———
const ROOT = 62; // D
/** The duel theme in D minor, in quavers over i–iv–v–i. */
const THEME = [
  7,
  null,
  12,
  null,
  12,
  14,
  15,
  12,
  15,
  null,
  17,
  15,
  14,
  null,
  12,
  null,
  10,
  null,
  14,
  null,
  14,
  15,
  17,
  14,
  19,
  null,
  17,
  15,
  14,
  null,
  12,
  null,
] as const;

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const duelAtDuskScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: ROOT, voice: 'pluck', intro: [0, 7, 12], outro: [0, 7, 12, 16] },
    (s) => {
      const bpm = 60 / (BEAT * s.story);
      const heroic = {
        bpm,
        root: ROOT,
        minor: true,
        chords: [0, 5, 7, 0],
        melody: THEME,
        step: 0.5,
        voice: 'lead' as const,
        gain: 0.62,
        fade: 0.25,
      };
      const thin = (from: number, to: number, chord: number) =>
        s.section({
          from,
          to,
          bpm,
          root: ROOT,
          minor: true,
          chords: [chord],
          level: 0.35,
          groove: 'tick',
          bass: false,
          fade: 0.15,
        });
      /** A sad trombone for every creak of age: wah, wah, wah, waah. */
      const sting = (p: number, pan: number) => {
        [3, 2, 1].forEach((d, i) =>
          s.note(p + i * BEAT * 0.5, ROOT - 12 + d, 0.22, 'lead', 0.075, pan),
        );
        s.note(p + BEAT * 1.5, ROOT - 12, 0.7, 'lead', 0.075, pan);
        s.fx('boing', p + BEAT * 1.5, 0.5, 0.08, pan);
      };
      s.fx('wind', 0, s.story * 0.66, 0.07);
      s.fx('wind', 0.64, s.story * 0.355, 0.05);
      // Dusk: a stern slow march for the approach, a footfall and a timpani stroke at a time.
      s.section({
        from: 0,
        to: DUEL,
        bpm: bpm / 2,
        root: ROOT,
        minor: true,
        chords: [0, 5],
        melody: [0, null, 3, 5, 7, null, 5, 3],
        voice: 'lead',
        gain: 0.5,
        level: 0.75,
        fade: 1.4,
      });
      for (const f of FOOTFALLS) {
        s.fx('step', f, 0.2, 0.22, -0.5);
        s.fx('step', f + 0.002, 0.2, 0.22, 0.5);
        s.note(f, ROOT - 26, 0.5, 'kick', 0.08);
      }
      s.fx('swish', SALUTE - 0.004, 0.35, 0.16, -0.3);
      s.fx('swish', SALUTE - 0.003, 0.35, 0.16, 0.3);
      s.fx('chime', SALUTE, 1.2, 0.05);
      s.fx('swish', SALUTE_DOWN, 0.4, 0.2);
      // The duel: heroic minor, with the band dropping out for every creak.
      s.section({ ...heroic, from: DUEL, to: BREATH, groove: 'drive' });
      thin(BREATH, RESUME, 7);
      s.section({ ...heroic, from: RESUME, to: at(17.5), groove: 'march' });
      thin(at(17.5), at(19), 5);
      s.section({ ...heroic, root: ROOT + 2, from: at(19), to: at(23.25), groove: 'drive' });
      thin(at(23.25), at(24.5), 7);
      s.section({
        bpm,
        root: ROOT + 2,
        minor: true,
        chords: [0],
        from: at(24.5),
        to: at(26.5),
        groove: 'drive',
        level: 0.7,
        pad: false,
      });
      s.section({
        ...heroic,
        root: ROOT + 2,
        from: at(26.5),
        to: PAUSE,
        groove: 'drive',
        gain: 0.75,
      });
      CLASHES.forEach((c, i) => {
        const pan = i % 2 ? 0.25 : -0.25;
        s.fx('swish', c.p - BEAT * 0.35, 0.2, 0.12, -pan);
        s.fx('clash', c.p, c.big ? 1.2 : 0.8, c.big ? 0.34 : 0.26, pan);
      });
      s.fx('thud', THROW, 0.5, 0.16);
      sting(at(10.4), 0.4);
      for (const n of [10.4, 11, 11.6]) s.fx('gasp', at(n), 0.45, 0.2, 0.4);
      for (const n of [11.3, 11.8]) s.fx('step', at(n), 0.12, 0.08, -0.4);
      s.fx('step', LEAP, 0.2, 0.18, 0.3);
      s.fx('swish', LEAP + 0.002, 0.4, 0.14, 0.3);
      s.fx('step', PERCH, 0.2, 0.22, 0.4);
      s.fx('flutter', PERCH + 0.003, 1.2, 0.12, 0.6);
      s.fx('creak', KNEE, 0.7, 0.3, -0.2);
      sting(KNEE + 0.003, -0.3);
      s.fx('creak', SWING - 0.004, 0.8, 0.1, 0);
      s.fx('swish', SWING, 0.9, 0.16, -0.3);
      s.fx('swish', APEX + 0.002, 0.9, 0.14, 0.3);
      s.fx('step', TOUCH, 0.2, 0.22, -0.3);
      s.fx('step', HOP_LAND, 0.2, 0.22, 0.3);
      s.fx('creak', BACK, 0.6, 0.26, 0.3);
      sting(BACK + 0.003, 0.3);
      for (const [n, f] of FOOTWORK)
        s.fx('step', at(n + STEP_BEATS), 0.15, 0.2, f < 2 ? -0.4 : 0.4);
      // The pause: panting, spectacles, and a moustache let loose.
      s.section({
        from: PAUSE,
        to: 0.52,
        bpm: bpm / 2,
        root: ROOT,
        minor: true,
        chords: [0, 5],
        melody: [12, null, null, 10, null, null, 7, null],
        voice: 'keys',
        gain: 0.45,
        level: 0.45,
        bass: false,
        fade: 1,
      });
      for (let i = 0; i < 6; i++)
        s.fx('gasp', PAUSE + 0.004 + i * 0.0075, 0.45, 0.16, i % 2 ? 0.45 : -0.45);
      s.fx('flutter', PIGEON_BACK - 0.012, 0.9, 0.08, 0.5);
      s.fx('rustle', 0.447, 0.5, 0.08, -0.4);
      s.fx('click', SPECS, 0.1, 0.12, -0.4);
      s.note(SPECS + 0.003, ROOT - 5, 0.4, 'lead', 0.05, -0.3);
      s.fx('rustle', WIPE, 0.6, 0.08, 0.4);
      s.fx('boing', SLIP, 0.6, 0.16, 0.4);
      // The final exchange, and the flick.
      s.section({
        ...heroic,
        from: 0.52,
        to: FLICK,
        groove: 'drive',
        chords: [0, 5, 7, 7],
        gain: 0.7,
      });
      for (const t of [0.531, 0.537, 0.543]) s.fx('swish', t, 0.25, 0.14, 0.3);
      s.fx('step', LUNGE, 0.2, 0.2, -0.3);
      s.fx('swish', FLICK - 0.006, 0.3, 0.2, 0.2);
      s.fx('click', FLICK, 0.1, 0.14);
      s.fx('sparkle', FLICK + 0.002, 1.2, 0.06);
      // Everything hushes while the feather falls: one held chord and a bell on every swing.
      s.chord(
        FLICK + 0.003,
        [ROOT, ROOT + 7, ROOT + 14, ROOT + 15],
        (LAND - FLICK) * s.story,
        'pad',
        0.035,
      );
      [27, 26, 24, 22, 19, 17].forEach((d, k) => {
        const swingAt = FALL + ((k + 0.5) / 6) * (LAND - FALL);
        s.note(swingAt, ROOT + d, 1.6, 'bell', 0.05, k % 2 ? 0.3 : -0.3);
        s.fx('flutter', swingAt, 0.4, 0.04, k % 2 ? 0.3 : -0.3);
      });
      s.fx('tick', LAND, 0.05, 0.05);
      // The bow, the laughter, the embrace: a tender waltz.
      s.fx('rustle', BOW, 0.5, 0.07, -0.3);
      s.fx('rustle', BOW_RED, 0.5, 0.07, 0.3);
      s.note(0.69, ROOT - 12, (LAUGH - 0.69) * s.story, 'pad', 0.03);
      s.fx('giggle', LAUGH, 1.6, 0.2, -0.35);
      s.fx('giggle', LAUGH + 0.004, 1.8, 0.2, 0.35);
      s.fx('giggle', LAUGH + 0.03, 1.2, 0.14);
      s.fx('clatter', DROP_SWORDS, 0.5, 0.14);
      s.fx('swish', HATS + 0.002, 0.3, 0.12, -0.3);
      s.fx('swish', HATS + 0.004, 0.3, 0.12, 0.3);
      s.fx('chime', HUG, 1.4, 0.12);
      for (const t of PATS) s.fx('thud', t, 0.2, 0.08, 0.1);
      s.section({
        from: 0.712,
        to: 0.8,
        bpm: bpm * 0.7,
        root: ROOT,
        chords: [0, 7, 5, 0],
        melody: [12, 14, 16, 19, null, 16, 17, 16, 14, 12, null, null],
        voice: 'bell',
        gain: 0.7,
        groove: 'waltz',
        level: 0.6,
        fade: 1.2,
      });
      s.section({
        from: 0.8,
        to: 0.945,
        bpm: bpm * 0.7,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: [16, 14, 12, 19, null, null, 17, 16, 14, 12, null, null],
        voice: 'keys',
        gain: 0.6,
        groove: 'waltz',
        level: 0.55,
        fade: 1,
      });
      s.fx('water', POUR, 0.9, 0.06, 0.1);
      s.fx('click', CLINK, 0.1, 0.12);
      s.fx('chime', CLINK, 0.9, 0.06);
      s.fx('pop', LID_OFF, 0.2, 0.12, 0.2);
      s.fx('flutter', DROP, 0.6, 0.05);
      s.fx('thud', LID_ON, 0.3, 0.16, 0.2);
      s.fx('sparkle', LID_ON + 0.003, 1.2, 0.05);
      s.fx('scribble', CHALK, 0.8, 0.12, 0.2);
      // The last of the sun: warm and major, all the way home.
      s.section({
        from: 0.94,
        to: 1,
        bpm: bpm / 2,
        root: ROOT,
        chords: [5, 0],
        melody: [16, 19, 24, null],
        voice: 'bell',
        gain: 0.6,
        level: 0.6,
        fade: 1.2,
      });
      s.chord(0.975, [ROOT, ROOT + 4, ROOT + 7, ROOT + 12], 2.2, 'pad', 0.035);
    },
  );

export const duelAtDusk: FilmModule = {
  draw(ctx, p, seconds) {
    const { index } = shot(p, CUTS);
    if (index === 8) bootsShot(ctx, p, seconds);
    else {
      const v = index === 14 ? featherCam(p) : track(p, CAM);
      camera(
        ctx,
        v,
        () => {
          bridge(ctx, p, seconds, v);
          players(ctx, p, seconds);
        },
        null,
      );
    }
    vignette(ctx, index === 20 ? 0.48 : 0.42);
    // Widescreen bars for the swashbuckler; they melt away with the masks.
    letterbox(ctx, 0.7 * (1 - ease(span(p, 0.68, 0.74))));
    veil(ctx, INK, hump(p, 0.79, 0.81) * 0.85);
    captions(ctx, p, [
      [0.012, 0.09, 'Dusk. The bridge. Swords drawn.'],
      [0.412, 0.5, 'The fortieth year running.'],
      [0.944, 0.992, 'Same time next year, old friend.'],
    ]);
  },
  score: duelAtDuskScore,
  look: {
    shade: '#1A1222',
    ink: '#FBEFD8',
    accent: '#E5B48B',
    dedication: 'for old friends and older rivals',
  },
};
