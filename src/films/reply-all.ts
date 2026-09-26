import type { FilmModule } from './types';
import {
  alpha,
  backOut,
  box,
  camera,
  caption,
  disc,
  ease,
  easeIn,
  easeOut,
  faded,
  font,
  glow,
  H,
  handOf,
  hump,
  lerp,
  line,
  mix,
  oval,
  person,
  poly,
  presence,
  rand,
  span,
  TAU,
  track,
  veil,
  vignette,
  W,
  within,
  write,
  type Ctx,
  type Figure,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * REPLY ALL
 * Dev meant to tell only his sister what he thought of last night's compulsory karaoke. His
 * phone buzzes, the mouse slides, and the email goes to all four hundred staff through a very
 * slow mail server. One corridor, one birthday cake, one wet floor, one lift and one fire drill
 * later he pulls the plug at 399 of 400, just in time for the boss to find him. The boss is
 * grateful. The four hundredth inbox belonged to Gord from IT.
 *
 * Everything is timed in story seconds (84 of them between the title and the end card). The
 * sync points are shared by the pictures and the score, so every click, ping, skid and ding
 * lands on its frame.
 */

// ——— Timing ———
const STORY = 84;
const at = (s: number) => s / STORY;

/** Where each shot begins, in story seconds. */
const CUTS = [
  0, 4.5, 10, 11.8, 13.5, 16.5, 19, 22.5, 28, 30.5, 36, 38.5, 42.5, 46.5, 48.5, 54, 56.5, 60, 63,
  65, 69.5, 75, 79.4, 81.2, 82.4,
] as const;

const LINE1 = 'The CEO sang like',
  LINE2 = 'a fax machine.';
const MESSAGE = LINE1 + LINE2;
/** Dev's keystrokes, with a breath between the two lines and a little human unevenness. */
const KEY_TIMES = [...MESSAGE].map(
  (_, i) => 5.4 + i * 0.115 + (i >= LINE1.length ? 0.35 : 0) + (rand(i * 3.3) - 0.5) * 0.05,
);
const REPLY1 = 'Fax machines are',
  REPLY2 = 'underrated.';
/** Gord types a lot faster. */
const GORD_KEYS = [...(REPLY1 + REPLY2)].map((_, i) => 77.6 + i * 0.042);

const BUZZ = 10.5; // Sis texts back: "well??"
const NUDGE = 11.3; // ...and the buzzing phone bumps the mouse
const CLICK_S = 12.9;
const POPUP = 16.8;
const BOLT_S = 19.4;
const LIMBO_S = 25.8;
const SKID_S = 31.6;
const PAPER_S = 33.9;
const CLAMP_S = 40.2;
const DING_S = 41.2;
const WHISTLE_S = 43.0;
const PEEL_S = 45.7;
const BURST_S = 48.8;
const DIVE_S = 52.0;
const YANK_S = 53.3;
const SLURP_S = 57.4;
const DOOR_S = 58.8;
const HAT_S = 73.6;
const PLUG_S = 75.6;
const MAIL_S = 76.0;
const SNORT_S = 76.9;
const REPLY_S = 79.0;
const STORM_S = 79.4;
const DEADPAN_S = 81.2;

/** The hit points, in story time (0..1), for anyone who wants to check the sync. */
export const SYNC = {
  keys: KEY_TIMES.map(at),
  buzz: at(BUZZ),
  click: at(CLICK_S),
  bolt: at(BOLT_S),
  limbo: at(LIMBO_S),
  skid: at(SKID_S),
  paper: at(PAPER_S),
  clamp: at(CLAMP_S),
  ding: at(DING_S),
  whistle: at(WHISTLE_S),
  yank: at(YANK_S),
  door: at(DOOR_S),
  snort: at(SNORT_S),
  replyAll: at(REPLY_S),
  storm: at(STORM_S),
} as const;

/** How far the email has got. The server is slow, then it is not. */
const PROGRESS: readonly (readonly [number, number])[] = [
  [CLICK_S, 1],
  [18.3, 1],
  [18.7, 2],
  [28, 38],
  [36, 170],
  [46.5, 330],
  [48.4, 377],
  [YANK_S, 399],
];
function sent(t: number) {
  if (t < CLICK_S) return 0;
  for (let i = 0; i < PROGRESS.length - 1; i++) {
    const [a, ca] = PROGRESS[i],
      [b, cb] = PROGRESS[i + 1];
    if (t < b) return Math.floor(lerp(ca, cb, (t - a) / (b - a)));
  }
  return 399;
}
/** A mouth that flaps while a line is spoken. */
const talking = (t: number, from: number, to: number) =>
  within(t, from, to) && Math.sin((t - from) * 23) > -0.25;

// ——— Palette: beige, grey and teal under fluorescent tubes ———
const INK = '#23262B';
const TEAL = '#2E8C88';
const TEAL_D = '#1E625F';
const SCREEN = '#EEF4EF';
const BEIGE = '#D8CAAB';
const BEIGE_D = '#BDAE8E';
const CARPET = '#8A9295';
const WARM = '#FFC77A';
const SUN = '#FFE4AE';
const HAT_A = '#D9577E',
  HAT_B = '#F2C94C';
const RED = '#C8463A';
const dark = (c: string, k = 0.25) => mix(c, INK, k);

// ——— People ———
type Style = 'dev' | 'ceo' | 'gord' | 'bob' | 'curly';
type Person = {
  skin: string;
  shade: string;
  hair: string;
  coat: string;
  coatD: string;
  legs: string;
  shoes: string;
  style: Style;
  glasses?: boolean;
  collar: 'shirt' | 'tie' | 'hoodie' | 'cardigan';
};
const DEV: Person = {
  skin: '#E4B690',
  shade: '#C79470',
  hair: '#3A2A22',
  coat: '#2F8F8A',
  coatD: '#23706C',
  legs: '#4E545C',
  shoes: '#2A2A30',
  style: 'dev',
  glasses: true,
  collar: 'shirt',
};
const CEO: Person = {
  skin: '#EDC6A4',
  shade: '#D0A381',
  hair: '#DCD8D0',
  coat: '#2F3B5C',
  coatD: '#222B45',
  legs: '#2F3B5C',
  shoes: '#1C1C22',
  style: 'ceo',
  collar: 'tie',
};
const GORD: Person = {
  skin: '#DCA37F',
  shade: '#BD835F',
  hair: '#8A5530',
  coat: '#6B7078',
  coatD: '#545960',
  legs: '#3A3F4A',
  shoes: '#2A2A30',
  style: 'gord',
  collar: 'hoodie',
};
const PRIYA: Person = {
  skin: '#B98062',
  shade: '#9C654A',
  hair: '#2A1E1C',
  coat: '#D6A544',
  coatD: '#B8892F',
  legs: '#4A4F58',
  shoes: '#2E2A2A',
  style: 'bob',
  collar: 'cardigan',
};
const TOM: Person = {
  skin: '#F0C8A8',
  shade: '#D6A586',
  hair: '#6B4A34',
  coat: '#8A97A8',
  coatD: '#6F7B8C',
  legs: '#3F444C',
  shoes: '#2E2A2A',
  style: 'curly',
  collar: 'shirt',
};

// ——— Close-ups: big faces that can act ———
type Eyes = 'open' | 'wide' | 'closed' | 'happy' | 'half' | 'squeeze' | 'glassy';
type Mouth =
  'smile' | 'smug' | 'o' | 'flat' | 'wobble' | 'grin' | 'frown' | 'grit' | 'open' | 'chew';
type Face = {
  eyes?: Eyes;
  /** Pupil direction, -1..1 each way. */
  look?: readonly [number, number];
  /** -1 worried … 1 cross. */
  brows?: number;
  raise?: number;
  /** Lifts just the right brow. */
  arch?: number;
  mouth?: Mouth;
  /** -1..1: a three-quarter turn toward screen left or right. */
  turn?: number;
  tilt?: number;
  sweat?: number;
  tear?: number;
  hat?: boolean;
  /** A coloured light falling on the face from (keyX, keyY). */
  key?: string;
  keyX?: number;
  keyY?: number;
  keyAmount?: number;
  /** A screen reflected in Dev's glasses. */
  glint?: string;
};

/** A paper party hat, base centred on (x, y). */
function partyHat(ctx: Ctx, x: number, y: number, s: number, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  poly(ctx, HAT_A, [-10, 0, 10, 0, 0, -26]);
  poly(ctx, HAT_B, [-7.3, -7, 7.3, -7, 5.4, -12, -5.4, -12]);
  poly(ctx, HAT_B, [-3.4, -17, 3.4, -17, 2.3, -20, -2.3, -20]);
  disc(ctx, 0, -27, 3, '#F7ECC4');
  ctx.restore();
}

function collarDetail(ctx: Ctx, who: Person) {
  switch (who.collar) {
    case 'shirt':
      poly(ctx, who.coatD, [-12, 27, 12, 27, 0, 42]);
      poly(ctx, '#F1F1EC', [-9, 27, 9, 27, 0, 38]);
      poly(ctx, '#FFFFFF', [-10, 26, -1, 30, -6, 35]);
      poly(ctx, '#FFFFFF', [10, 26, 1, 30, 6, 35]);
      if (who.style === 'dev') {
        // The lanyard and the security pass.
        line(ctx, '#E0B23C', 1.2, [-9, 30, -3, 56]);
        line(ctx, '#E0B23C', 1.2, [9, 30, 3, 56]);
        box(ctx, -6, 55, 12, 15, '#F4F4EE');
        box(ctx, -4, 57, 5, 6, '#9FB5AF');
        box(ctx, -4, 65, 8, 1.5, '#9FB5AF');
      }
      break;
    case 'tie':
      poly(ctx, '#F2F0EA', [-11, 27, 11, 27, 0, 50]);
      poly(ctx, '#B8403A', [-2.6, 29, 2.6, 29, 3.6, 46, 0, 51, -3.6, 46]);
      poly(ctx, who.coatD, [-11, 27, -2, 52, -16, 42]);
      poly(ctx, who.coatD, [11, 27, 2, 52, 16, 42]);
      break;
    case 'hoodie':
      line(ctx, '#D8D8D2', 1.2, [-5, 31, -6, 48]);
      line(ctx, '#D8D8D2', 1.2, [5, 31, 6, 48]);
      break;
    case 'cardigan':
      poly(ctx, '#EFE7D6', [-10, 27, 10, 27, 0, 44]);
      disc(ctx, 0, 52, 1.3, who.coatD);
      disc(ctx, 0, 62, 1.3, who.coatD);
      break;
  }
}

function hairBack(ctx: Ctx, who: Person, u: number) {
  if (who.style === 'bob') {
    oval(ctx, u * 0.2, 4, 24.5, 27, who.hair);
    box(ctx, -25 + u * 0.2, 4, 8, 24, who.hair);
    box(ctx, 17 + u * 0.2, 4, 8, 24, who.hair);
  } else if (who.style === 'gord') oval(ctx, u * 0.2, -4, 24, 26, who.hair);
}

function hairFront(ctx: Ctx, who: Person, u: number) {
  const h = (points: number[]) =>
    poly(
      ctx,
      who.hair,
      points.map((v, i) => (i % 2 ? v : v + u * 0.3)),
    );
  switch (who.style) {
    case 'dev':
      h([
        -21, -2, -21.5, -12, -17, -21, -8, -26.5, 4, -27.5, 14, -24, 20, -16, 21.5, -4, 18, -10, 13,
        -15, 7, -12.5, 2, -16.5, -4, -13, -10, -16, -15, -10, -18, -4,
      ]);
      break;
    case 'ceo':
      h([
        -21, 6, -21.5, -8, -18, -17, -11, -22, -2, -24.5, 8, -24, 16, -20, 20.5, -11, 21, 6, 18.5,
        -4, 16, -12, 9, -17, 1, -18.5, -8, -17.5, -15, -12, -18.5, -3,
      ]);
      line(ctx, mix(who.hair, INK, 0.2), 0.8, [-7 + u * 0.3, -22, -4 + u * 0.3, -17.5]);
      break;
    case 'gord':
      h([
        -22, 4, -23, -10, -18, -21, -8, -27, 5, -28, 16, -23, 22, -13, 22.5, 4, 19, -5, 15, -12, 9,
        -8, 5, -14, -1, -9, -6, -15, -11, -9, -16, -13, -19, -3,
      ]);
      h([
        -20.5, -1, -21, 10, -16, 21, -8, 28.5, 0, 30.5, 8, 28.5, 16, 21, 21, 10, 20.5, -1, 16.5, 5,
        10, 9.5, 3, 8, -3, 8, -10, 9.5, -16.5, 5,
      ]);
      poly(ctx, dark(who.hair, 0.15), [
        -8 + u,
        12.5,
        -3 + u,
        10,
        u,
        11,
        3 + u,
        10,
        8 + u,
        12.5,
        4 + u,
        13.5,
        u,
        12.5,
        -4 + u,
        13.5,
      ]);
      break;
    case 'bob':
      h([
        -21, 6, -21.5, -10, -15, -21, -4, -26, 8, -26, 17, -20, 21.5, -9, 21, 6, 18, -6, 12, -13, 4,
        -11, -4, -13, -12, -11, -17, -5,
      ]);
      break;
    case 'curly':
      for (let i = 0; i < 8; i++) {
        const a = Math.PI + 0.2 + i * 0.39;
        disc(ctx, Math.cos(a) * 18 + u * 0.3, -6 + Math.sin(a) * 19, 6.5, who.hair);
      }
      break;
  }
}

/**
 * A head-and-shoulders close-up, about 40 × 48 at s = 1, centred on the face. Eyes, brows and
 * mouth all act; a coloured key light can fall across the skin.
 */
function portrait(ctx: Ctx, who: Person, x: number, y: number, s: number, f: Face) {
  const u = (f.turn ?? 0) * 6;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  poly(ctx, who.coat, [-42, 84, -38, 40, -16, 28, 16, 28, 38, 40, 42, 84]);
  poly(ctx, who.coatD, [-42, 84, -38, 40, -27, 33, -30, 84]);
  if (who.collar === 'hoodie') oval(ctx, 0, 29, 22, 7, who.coatD);
  box(ctx, -7 + u * 0.25, 12, 14, 18, who.shade);
  collarDetail(ctx, who);
  ctx.translate(0, 20);
  ctx.rotate(f.tilt ?? 0);
  ctx.translate(0, -20);
  hairBack(ctx, who, u);
  if (u < 5) oval(ctx, -20 + u * 0.35, 3, 4, 6, who.skin);
  if (u > -5) oval(ctx, 20 + u * 0.35, 3, 4, 6, who.skin);
  oval(ctx, u * 0.15, 0, 20, 24, who.skin);
  if (f.key && (f.keyAmount ?? 0) > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(u * 0.15, 0, 20, 24, 0, 0, TAU);
    ctx.clip();
    glow(ctx, f.keyX ?? 0, f.keyY ?? 0, 38, f.key, f.keyAmount);
    ctx.restore();
  }
  hairFront(ctx, who, u);
  // Eyes.
  const eyes = f.eyes ?? 'open';
  const [lx, ly] = f.look ?? [0, 0];
  for (const sd of [-1, 1]) {
    const ex = sd * 8 + u,
      ey = -2;
    const px = ex + lx * 1.8,
      py = ey + ly * 1.8;
    if (eyes === 'open' || eyes === 'half' || eyes === 'glassy') {
      oval(ctx, ex, ey, 4.6, 5, '#FFFFFF');
      oval(ctx, px, py + 0.5, 2.3, 2.6, INK);
      disc(ctx, px - 0.8, py - 0.4, 0.8, '#FFFFFF');
      if (eyes === 'half') {
        poly(ctx, who.skin, [ex - 5.5, ey - 6, ex + 5.5, ey - 6, ex + 5.5, ey, ex - 5.5, ey]);
        line(ctx, INK, 1.1, [ex - 4.8, ey, ex + 4.8, ey]);
      }
      if (eyes === 'glassy') {
        disc(ctx, px + 1, py + 1.5, 0.7, '#FFFFFF');
        line(ctx, '#BFE9F5', 1.1, [ex - 3.6, ey + 4.3, ex + 3.6, ey + 4.3]);
      }
    } else if (eyes === 'wide') {
      oval(ctx, ex, ey, 5.6, 6.4, '#FFFFFF');
      disc(ctx, ex + lx * 2.2, ey + ly * 2.2, 1.2, INK);
    } else if (eyes === 'closed')
      line(ctx, INK, 1.2, [ex - 4, ey + 1, ex, ey + 2.4, ex + 4, ey + 1]);
    else if (eyes === 'happy')
      line(ctx, INK, 1.3, [ex - 4, ey + 1.5, ex, ey - 1.5, ex + 4, ey + 1.5]);
    else line(ctx, INK, 1.3, [ex + sd * 3.5, ey - 2.5, ex - sd * 3, ey, ex + sd * 3.5, ey + 2.5]);
  }
  // Brows.
  const brow = mix(who.hair, INK, who.style === 'ceo' ? 0.4 : 0.3);
  const b = f.brows ?? 0;
  for (const sd of [-1, 1]) {
    const ex = sd * 8 + u;
    const lift = -9.5 - (f.raise ?? 0) * 4 - (sd > 0 ? (f.arch ?? 0) * 5 : 0);
    line(ctx, brow, 2.2, [ex + sd * 5, lift - b, ex - sd * 4, lift + b * 2.2]);
  }
  // Nose.
  oval(ctx, u * 1.15, 7.5, 2.4, 3, who.shade);
  oval(ctx, u * 1.15 - 0.6, 6.4, 1.1, 1.3, alpha('#FFFFFF', 0.28));
  // Mouth.
  const mx = u,
    my = 15.5;
  switch (f.mouth ?? 'flat') {
    case 'smile':
      line(ctx, INK, 1.4, [mx - 6, my, mx - 2.5, my + 2.5, mx + 2.5, my + 2.5, mx + 6, my]);
      break;
    case 'smug':
      line(ctx, INK, 1.4, [mx - 5, my + 1, mx, my + 2, mx + 6, my - 1.5]);
      break;
    case 'o':
      oval(ctx, mx, my + 1.5, 2.2, 2.8, INK);
      break;
    case 'flat':
      line(ctx, INK, 1.4, [mx - 5, my + 1, mx + 5, my + 1]);
      break;
    case 'wobble':
      line(ctx, INK, 1.3, [
        mx - 6,
        my + 2,
        mx - 3,
        my + 0.8,
        mx,
        my + 2.2,
        mx + 3,
        my + 0.8,
        mx + 6,
        my + 2,
      ]);
      break;
    case 'grin':
      poly(ctx, INK, [mx - 7, my - 1, mx + 7, my - 1, mx + 5, my + 5, mx - 5, my + 5]);
      box(ctx, mx - 6, my - 1, 12, 2.5, '#FFFFFF');
      break;
    case 'frown':
      line(ctx, INK, 1.4, [mx - 6, my + 3, mx - 2, my + 0.5, mx + 2, my + 0.5, mx + 6, my + 3]);
      break;
    case 'grit':
      box(ctx, mx - 7, my - 2, 14, 6, INK);
      box(ctx, mx - 6, my - 1, 12, 4, '#FFFFFF');
      box(ctx, mx - 6, my + 0.6, 12, 0.7, alpha(INK, 0.6));
      for (const k of [-3, 0, 3]) box(ctx, mx + k, my - 1, 0.6, 4, alpha(INK, 0.5));
      break;
    case 'open':
      oval(ctx, mx, my + 2, 5, 4.5, INK);
      oval(ctx, mx, my + 4.5, 3, 1.8, '#C8605A');
      break;
    case 'chew':
      oval(ctx, mx, my + 1, 3, 1.5, INK);
      oval(ctx, mx + 9, my - 2, 4, 3.5, who.skin);
      break;
  }
  if (who.glasses) {
    const frame = '#2B2B33';
    for (const sd of [-1, 1]) {
      const ex = sd * 8 + u;
      if (f.glint) box(ctx, ex - 4.6, -6.5, 4, 2.6, alpha(f.glint, 0.55));
      line(ctx, frame, 1.3, [
        ex - 5.8,
        -7.5,
        ex + 5.8,
        -7.5,
        ex + 5.8,
        3,
        ex - 5.8,
        3,
        ex - 5.8,
        -7.5,
      ]);
    }
    line(ctx, frame, 1.2, [u - 2.2, -4, u + 2.2, -4]);
  }
  if (who.style === 'gord') {
    // Headphones, always.
    ctx.strokeStyle = '#2E3136';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(u * 0.2, -1, 25, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    box(ctx, -27 + u * 0.2, -4, 6, 12, '#2E3136');
    box(ctx, 21 + u * 0.2, -4, 6, 12, '#2E3136');
  }
  if (f.hat) partyHat(ctx, 4 + u * 0.3, -21, 1, 0.14);
  if (f.sweat) {
    const dy = -14 + f.sweat * 14;
    poly(ctx, '#CBEAF3', [21, dy - 4, 23.5, dy + 1, 21, dy + 3.5, 18.5, dy + 1]);
  }
  if (f.tear) {
    const ex = 8 + u;
    poly(ctx, alpha('#CBEAF3', f.tear), [
      ex + 1,
      4 + f.tear * 7,
      ex + 2.6,
      8 + f.tear * 7,
      ex + 1,
      10 + f.tear * 7,
      ex - 0.6,
      8 + f.tear * 7,
    ]);
  }
  ctx.restore();
}

// ——— Screens ———
const BTN = { y: 130, h: 18, reply: { x: 82, w: 62 }, all: { x: 150, w: 92 } } as const;
const REPLY_AT = [BTN.reply.x + BTN.reply.w / 2, BTN.y + 9] as const;
const ALL_AT = [BTN.all.x + BTN.all.w / 2, BTN.y + 9] as const;
type Mail = {
  dark?: boolean;
  subject: string;
  from: string;
  quote: string;
  typed: string;
  /** Received text is grey; text being typed is ink. */
  muted?: boolean;
  caret?: boolean;
  hover?: 0 | 1 | 2;
  press?: 0 | 1 | 2;
  cursor?: readonly [number, number];
  banner?: string;
  bannerColor?: string;
  toast?: number;
};

function button(
  ctx: Ctx,
  label: string,
  x: number,
  w: number,
  hover: boolean,
  press: boolean,
  dim: boolean,
) {
  const y = BTN.y + (press ? 1 : 0);
  const fill = press ? TEAL : hover ? (dim ? '#24413F' : '#D3EEE9') : dim ? '#14191E' : SCREEN;
  box(ctx, x, y, w, BTN.h, press ? TEAL_D : TEAL);
  box(ctx, x + 1, y + 1, w - 2, BTN.h - 2, fill);
  write(ctx, label, x + w / 2, y + 12.5, {
    size: 9,
    color: press ? '#FFFFFF' : dim ? '#8FE0D5' : TEAL_D,
  });
}

/** The mouse pointer, tip at (x, y). */
function pointer(ctx: Ctx, x: number, y: number, s = 1) {
  const pts = [0, 0, 0, 14, 3.5, 10.8, 6, 16, 8.4, 15, 6, 9.8, 10.4, 9.8].map((v, i) =>
    i % 2 ? y + v * s : x + v * s,
  );
  poly(ctx, '#FFFFFF', pts);
  line(ctx, INK, 1, [...pts, pts[0], pts[1]]);
}

/** A full-frame email client. The world is the 320 × 180 screen, bezel and all. */
function mailScreen(ctx: Ctx, m: Mail, seconds: number) {
  const dim = !!m.dark;
  const bg = dim ? '#14191E' : SCREEN;
  const text = dim ? '#9FE3B4' : INK;
  const soft = dim ? '#6F8C86' : '#7D8A86';
  box(ctx, 0, 0, W, H, '#2A2F34');
  box(ctx, 10, 8, 300, 158, bg);
  box(ctx, 10, 8, 300, 13, dim ? '#1F4745' : TEAL);
  write(ctx, 'Mail', 18, 17.5, { size: 7, color: '#F2FBF8', align: 'left' });
  for (let i = 0; i < 3; i++) disc(ctx, 300 - i * 8, 14.5, 2, alpha('#FFFFFF', 0.55));
  box(ctx, 10, 21, 60, 145, dim ? '#1C2329' : '#E0E8E3');
  box(ctx, 12, 26, 56, 11, alpha(TEAL, dim ? 0.45 : 0.22));
  ['Inbox', 'Sent', 'Drafts', 'Junk'].forEach((label, i) =>
    write(ctx, label, 17, 34 + i * 13, { size: 7, color: soft, align: 'left' }),
  );
  write(ctx, m.subject, 80, 38, { size: 10, color: text, align: 'left' });
  disc(ctx, 86, 50, 5, dim ? '#5B8FA8' : '#E39A74');
  write(ctx, m.from, 86, 52.5, { size: 6, color: '#FFFFFF' });
  write(ctx, m.quote, 96, 53, { size: 8, color: soft, align: 'left' });
  box(ctx, 78, 61, 224, 1, dim ? '#2E3A40' : '#CAD3CE');
  const lines = m.typed.split('\n');
  lines.forEach((l, i) =>
    write(ctx, l, 80, 84 + i * 20, { size: 14, color: m.muted ? soft : text, align: 'left' }),
  );
  if (m.caret && Math.floor(seconds * 2.4) % 2 === 0) {
    ctx.font = font('mono', 14);
    const cx = 80 + ctx.measureText(lines[lines.length - 1]).width + 1;
    box(ctx, cx, 72 + (lines.length - 1) * 20, 2, 15, text);
  }
  button(ctx, 'REPLY', BTN.reply.x, BTN.reply.w, m.hover === 1, m.press === 1, dim);
  button(ctx, 'REPLY ALL', BTN.all.x, BTN.all.w, m.hover === 2, m.press === 2, dim);
  if (m.banner) {
    box(ctx, 92, 70, 150, 28, alpha('#0B0E14', 0.85));
    box(ctx, 92, 70, 150, 2, m.bannerColor ?? '#E0A33A');
    write(ctx, m.banner, 167, 89, { size: 12, color: m.bannerColor ?? '#E0A33A' });
  }
  if (m.toast) {
    const y = 24 - (1 - easeOut(m.toast)) * 22;
    box(ctx, 176, y, 128, 20, dim ? '#24413F' : '#FFFFFF');
    box(ctx, 176, y, 3, 20, TEAL);
    write(ctx, '1 new: RE: Karaoke night!!', 240, y + 13, {
      size: 6,
      color: dim ? '#CFF3EC' : INK,
    });
  }
  if (m.cursor) pointer(ctx, m.cursor[0], m.cursor[1]);
}

/** The outbox: "Sending… n of 400", the bar, and one line of small print. */
function sendDialog(
  ctx: Ctx,
  count: number,
  sub: string,
  subColor: string,
  pop: number,
  seconds: number,
  spinning: boolean,
) {
  if (pop <= 0) return;
  box(ctx, 10, 8, 300, 158, alpha('#0B0E14', 0.3 * Math.min(1, pop * 2)));
  ctx.save();
  ctx.translate(160, 88);
  const k = backOut(pop);
  ctx.scale(k, k);
  ctx.translate(-160, -88);
  box(ctx, 64, 58, 200, 72, alpha('#0B0E14', 0.3));
  box(ctx, 60, 52, 200, 72, '#FBFCFA');
  box(ctx, 60, 52, 200, 12, TEAL);
  write(ctx, 'Outbox', 66, 61, { size: 7, color: '#FFFFFF', align: 'left' });
  write(ctx, `Sending… ${count} of 400`, 160, 85, { size: 13, color: INK });
  box(ctx, 76, 93, 168, 11, '#9FB5AF');
  box(ctx, 77, 94, 166, 9, '#E6ECE9');
  box(ctx, 77, 94, Math.max(2, Math.floor((166 * count) / 400)), 9, TEAL);
  write(ctx, sub, 160, 116, { size: 8, color: subColor });
  // The hourglass, turning over and over.
  const turn = spinning
    ? Math.floor(seconds / 1.4) * Math.PI + ease((seconds % 1.4) / 0.45) * Math.PI
    : 0;
  ctx.save();
  ctx.translate(248, 58);
  ctx.rotate(turn);
  poly(ctx, '#FFFFFF', [-3, -4, 3, -4, 0, 0]);
  poly(ctx, '#FFFFFF', [-3, 4, 3, 4, 0, 0]);
  ctx.restore();
  ctx.restore();
}

/** What Dev has typed so far. */
function typed(t: number) {
  const n = KEY_TIMES.filter((k) => k <= t).length;
  return n <= LINE1.length ? LINE1.slice(0, n) : `${LINE1}\n${LINE2.slice(0, n - LINE1.length)}`;
}
const DEV_MAIL = {
  subject: 'RE: Karaoke night!!',
  from: 'S',
  quote: 'Sis: so how was it?? x',
} as const;

// ——— Wide shots: posable townsfolk in the picture-house style ———
type Limbs = readonly [number, number, number, number];
/** Angles in radians from hanging straight down; positive swings toward the facing side. */
type Motion = { torso: number; drop: number; spin: number; nod: number; legs: Limbs; arms: Limbs };
type SmallEyes = 'open' | 'wide' | 'closed' | 'happy' | 'half';
type SmallMouth = 'flat' | 'o' | 'smile' | 'grin' | 'open' | 'grit';
type Pose = Partial<Motion> & {
  x: number;
  y: number;
  s?: number;
  facing?: 1 | -1;
  squash?: number;
  eyes?: SmallEyes;
  mouth?: SmallMouth;
  hat?: boolean;
  sheet?: boolean;
  tone?: (c: string) => string;
  /** Paints a prop in the front hand's frame. */
  hold?: () => void;
};
const lerp4 = (a: Limbs, b: Limbs, k: number): Limbs => [
  lerp(a[0], b[0], k),
  lerp(a[1], b[1], k),
  lerp(a[2], b[2], k),
  lerp(a[3], b[3], k),
];
const blend = (a: Motion, b: Motion, k: number): Motion => ({
  torso: lerp(a.torso, b.torso, k),
  drop: lerp(a.drop, b.drop, k),
  spin: lerp(a.spin, b.spin, k),
  nod: lerp(a.nod, b.nod, k),
  legs: lerp4(a.legs, b.legs, k),
  arms: lerp4(a.arms, b.arms, k),
});
const STILL: Motion = {
  torso: 0,
  drop: 0,
  spin: 0,
  nod: 0,
  legs: [0.04, 0, -0.04, 0],
  arms: [0.12, 0.2, -0.1, 0.05],
};
function running(phase: number, lean = 0.3): Motion {
  const sw = Math.sin(phase);
  const a = -sw * 0.95,
    b = sw * 0.95;
  return {
    torso: lean,
    drop: 0.6 - Math.abs(Math.cos(phase)) * 1.4,
    spin: 0,
    nod: -0.15,
    legs: [a, a - 0.95, b, b - 0.95],
    arms: [sw * 1.05, sw * 1.05 + 1.4, -sw * 1.05, -sw * 1.05 + 1.4],
  };
}
function seated(seconds: number, typing: number): Motion {
  const tap = Math.sin(seconds * 22) * 0.14 * typing;
  return {
    torso: 0.1,
    drop: 7,
    spin: 0,
    nod: 0.08,
    legs: [1.45, 0.05, 1.55, 0.1],
    arms: [0.9, 1.75 + tap, 1.0, 1.8 - tap],
  };
}
function limbo(seconds: number): Motion {
  const shuffle = Math.sin(seconds * 16) * 0.12;
  return {
    torso: -1.38,
    drop: 9,
    spin: 0,
    nod: 0.55,
    legs: [1.15 + shuffle, -0.35, 1.3 - shuffle, -0.15],
    arms: [-2.1, -2.7, -1.4, -2.2],
  };
}
function skidding(seconds: number): Motion {
  const flail = Math.sin(seconds * 17);
  return {
    torso: -0.95,
    drop: 10.5,
    spin: 0,
    nod: 0.3,
    legs: [1.55, 1.75, 1.7, 1.95],
    arms: [2.5 + flail * 0.5, 2.9 + flail * 0.6, 2.2 - flail * 0.5, 2.7 - flail * 0.4],
  };
}
function marching(phase: number): Motion {
  const sw = Math.sin(phase);
  const a = Math.max(0, -sw) * 1.1,
    b = Math.max(0, sw) * 1.1;
  return {
    torso: 0,
    drop: 0,
    spin: 0,
    nod: 0,
    legs: [a, a * 0.1, b, b * 0.1],
    arms: [sw * 0.75, sw * 0.75, -sw * 0.75, -sw * 0.75],
  };
}
const DIVE: Motion = {
  torso: 0,
  drop: 0,
  spin: 1.4,
  nod: -0.2,
  legs: [-0.25, -0.6, 0.05, -0.2],
  arms: [2.95, 3.0, 2.75, 2.9],
};
const SLUMP: Motion = {
  torso: -0.22,
  drop: 12,
  spin: 0,
  nod: 0.25,
  legs: [1.5, 1.5, 1.45, 1.45],
  arms: [0.5, 1.2, 0.8, 1.5],
};

function smallHead(ctx: Ctx, who: Person, q: Pose, T: (c: string) => string) {
  const skin = T(who.skin),
    hair = T(who.hair),
    ink = T(INK);
  box(ctx, -5, -12, 11, 11, skin);
  box(ctx, -4, -13, 9, 1, skin);
  box(ctx, -4, -1, 9, 1, skin);
  switch (who.style) {
    case 'dev':
      box(ctx, -5, -14, 11, 4, hair);
      box(ctx, -5, -12, 4, 6, hair);
      box(ctx, 2, -11, 4, 1, hair);
      break;
    case 'ceo':
      box(ctx, -5, -13, 10, 2, hair);
      box(ctx, -5, -12, 3, 7, hair);
      break;
    case 'gord':
      box(ctx, -6, -14, 12, 4, hair);
      box(ctx, -6, -12, 4, 8, hair);
      box(ctx, -2, -5, 8, 5, hair);
      box(ctx, -1, -1, 6, 2, hair);
      box(ctx, -7, -9, 2, 5, T('#2E3136'));
      break;
    case 'bob':
      box(ctx, -6, -14, 12, 4, hair);
      box(ctx, -6, -12, 4, 10, hair);
      box(ctx, 5, -12, 2, 6, hair);
      break;
    case 'curly':
      for (let i = 0; i < 4; i++) disc(ctx, -4 + i * 3, -13, 2.6, hair);
      box(ctx, -6, -12, 3, 5, hair);
      break;
  }
  const ey = -8;
  const eyes = q.eyes ?? 'open';
  for (const ex of [1, 4]) {
    if (eyes === 'open') box(ctx, ex, ey, 1, 2, ink);
    else if (eyes === 'wide') {
      box(ctx, ex, ey - 1, 2, 3, T('#FFFFFF'));
      box(ctx, ex + 1, ey, 1, 1, ink);
    } else if (eyes === 'happy') {
      box(ctx, ex - 1, ey + 1, 1, 1, ink);
      box(ctx, ex, ey, 1, 1, ink);
      box(ctx, ex + 1, ey + 1, 1, 1, ink);
    } else if (eyes === 'half') {
      box(ctx, ex - 1, ey, 3, 1, ink);
      box(ctx, ex, ey + 1, 1, 1, ink);
    } else box(ctx, ex - 1, ey + 1, 3, 1, ink);
  }
  if (who.glasses) box(ctx, -1, ey - 1, 8, 1, T('#2B2B33'));
  const my = -4;
  switch (q.mouth ?? 'flat') {
    case 'flat':
      box(ctx, 2, my, 3, 1, ink);
      break;
    case 'o':
      box(ctx, 2, my - 1, 2, 2, ink);
      break;
    case 'open':
      box(ctx, 2, my - 1, 3, 3, ink);
      break;
    case 'smile':
      box(ctx, 2, my - 1, 1, 1, ink);
      box(ctx, 3, my, 2, 1, ink);
      break;
    case 'grin':
      box(ctx, 1, my - 1, 5, 2, ink);
      box(ctx, 2, my - 1, 3, 1, T('#FFFFFF'));
      break;
    case 'grit':
      box(ctx, 1, my - 1, 5, 2, T('#FFFFFF'));
      box(ctx, 1, my, 5, 1, alpha(ink, 0.5));
      break;
  }
  if (q.hat) partyHat(ctx, 0.5, -13, 0.4, 0.1);
  if (q.sheet) poly(ctx, T('#F7F7F2'), [-7, -12, 6, -15, 8, -8, -5, -5]);
}

/** A chunky posable figure about 38 px tall at s = 1; (x, y) is the ground under the hip. */
function figure(ctx: Ctx, who: Person, q: Pose) {
  const T = q.tone ?? ((c: string) => c);
  const s = q.s ?? 1;
  const [bt, bs, ft, fs] = q.legs ?? STILL.legs;
  const [ba, bf, fa, ff] = q.arms ?? STILL.arms;
  const lean = q.torso ?? 0,
    ts = Math.sin(lean),
    tc = Math.cos(lean);
  ctx.save();
  ctx.translate(q.x, q.y);
  ctx.scale(s * (q.facing ?? 1) * (1 - (q.squash ?? 0)), s);
  ctx.translate(0, -14 + (q.drop ?? 0));
  if (q.spin) ctx.rotate(q.spin);
  const limb = (
    x0: number,
    y0: number,
    a: number,
    b: number,
    l1: number,
    l2: number,
    w: number,
    color: string,
  ) => {
    const x1 = x0 + Math.sin(a) * l1,
      y1 = y0 + Math.cos(a) * l1;
    const x2 = x1 + Math.sin(b) * l2,
      y2 = y1 + Math.cos(b) * l2;
    line(ctx, color, w, [x0, y0, x1, y1, x2, y2]);
    return [x2, y2] as const;
  };
  const skin = T(who.skin);
  const shx = ts * 11,
    shy = -tc * 11;
  const [bhx, bhy] = limb(shx - tc, shy - ts, ba, bf, 6, 5.5, 2.6, T(who.coatD));
  disc(ctx, bhx, bhy, 1.5, skin);
  for (const [th, sh, color] of [
    [bt, bs, T(dark(who.legs))],
    [ft, fs, T(who.legs)],
  ] as const) {
    const [fx, fy] = limb(0, 0, th, sh, 7, 7, 3.2, color);
    box(ctx, fx - 1.5, fy - 1, 5, 2.5, T(who.shoes));
  }
  const nx = ts * 13,
    ny = -tc * 13;
  const hx = -2 * ts,
    hy = 2 * tc;
  poly(ctx, T(who.coat), [
    hx - 4.2 * tc,
    hy - 4.2 * ts,
    hx + 4.2 * tc,
    hy + 4.2 * ts,
    nx + 4.6 * tc,
    ny + 4.6 * ts,
    nx - 4.6 * tc,
    ny - 4.6 * ts,
  ]);
  const along = (k: number, side = 0) => [ts * k + tc * side, -tc * k + ts * side];
  if (who.collar === 'tie') {
    line(ctx, T('#F2F0EA'), 2.4, [...along(12.8), ...along(10.2)]);
    line(ctx, T('#B8403A'), 1.4, [...along(12.2), ...along(6)]);
  } else if (who.style === 'dev')
    line(ctx, T('#E0B23C'), 0.8, [...along(12.5, 2), ...along(7.5, 0.5)]);
  ctx.save();
  ctx.translate(nx, ny);
  ctx.rotate(lean + (q.nod ?? 0));
  smallHead(ctx, who, q, T);
  ctx.restore();
  const [gx, gy] = limb(shx + tc, shy + ts, fa, ff, 6, 5.5, 2.6, T(who.coat));
  disc(ctx, gx, gy, 1.5, skin);
  if (q.hold) {
    ctx.save();
    ctx.translate(gx, gy);
    q.hold();
    ctx.restore();
  }
  ctx.restore();
}
/** Where a figure's front hand is, in the frame it was drawn in. */
function handAt(q: Pose) {
  const s = q.s ?? 1,
    f = (q.facing ?? 1) * (1 - (q.squash ?? 0));
  const lean = q.torso ?? 0,
    ts = Math.sin(lean),
    tc = Math.cos(lean);
  const [, , fa, ff] = q.arms ?? STILL.arms;
  const lx = ts * 11 + tc + Math.sin(fa) * 6 + Math.sin(ff) * 5.5;
  const ly = -tc * 11 + ts + Math.cos(fa) * 6 + Math.cos(ff) * 5.5;
  const sp = q.spin ?? 0,
    c = Math.cos(sp),
    sn = Math.sin(sp);
  return {
    x: q.x + (lx * c - ly * sn) * s * f,
    y: q.y + (lx * sn + ly * c - 14 + (q.drop ?? 0)) * s,
  };
}

/** An office chair; `spin` turns the backrest round. (x, y) is the floor under the stem. */
function chair(ctx: Ctx, x: number, y: number, s: number, spin: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  line(ctx, '#3A3E44', 1.6, [-8, -1, 8, -1]);
  for (const cx of [-8, 0, 8]) disc(ctx, cx, -0.5, 1.2, '#24272B');
  box(ctx, -1, -9, 2, 8, '#50555C');
  box(ctx, -7, -12, 14, 3, '#3F4A52');
  const c = Math.cos(spin),
    sn = Math.sin(spin);
  const bw = 2 + Math.abs(sn) * 9;
  box(ctx, -c * 6 - 1, -14, 2, 3, '#30363C');
  box(ctx, -c * 6 - bw / 2, -27, bw, 14, sn > 0 ? '#46525A' : '#38434A');
  ctx.restore();
}

/** A phone lit with a new message, with buzz marks while it vibrates. */
function smallPhone(ctx: Ctx, x: number, y: number, s: number, buzz: boolean, seconds: number) {
  const j = buzz ? Math.sin(seconds * 70) * 0.6 : 0;
  glow(ctx, x + j, y, 9 * s, '#DDF6F0', 0.5);
  box(ctx, x - 1.5 * s + j, y - 2.5 * s, 3 * s, 5 * s, '#DDF6F0');
  if (buzz)
    for (const sd of [-1, 1])
      box(ctx, x + sd * 3.5 * s, y - 2 * s, 0.8 * s, 4 * s, alpha('#FFFFFF', 0.8));
}

// ——— The office: 9 a.m., beige, open plan ———
type Mate = {
  x: number;
  row: 0 | 1;
  facing: 1 | -1;
  skin: string;
  hair: string;
  coat: string;
  hairStyle: NonNullable<Figure['hairStyle']>;
  ping: number;
  grin?: boolean;
};
const ROWS = [
  { top: 86, ground: 100, s: 0.8, right: 232 },
  { top: 112, ground: 130, s: 0.95, right: W },
] as const;
const MATES: readonly Mate[] = [
  {
    x: 30,
    row: 0,
    facing: 1,
    skin: '#E8B998',
    hair: '#6B4A34',
    coat: '#8C9BA8',
    hairStyle: 'bob',
    ping: 33.2,
  },
  {
    x: 82,
    row: 0,
    facing: -1,
    skin: '#8E5A3E',
    hair: '#2A1E1C',
    coat: '#7E8C7A',
    hairStyle: 'short',
    ping: 30.1,
    grin: true,
  },
  {
    x: 136,
    row: 0,
    facing: 1,
    skin: '#F0C8A8',
    hair: '#8A8A8A',
    coat: '#D3C7B0',
    hairStyle: 'bald',
    ping: 29.1,
  },
  {
    x: 190,
    row: 0,
    facing: -1,
    skin: '#D9A07E',
    hair: '#3E2A20',
    coat: '#B98585',
    hairStyle: 'bun',
    ping: 29.7,
  },
  {
    x: 36,
    row: 1,
    facing: 1,
    skin: '#B97C5C',
    hair: '#2A1E1C',
    coat: '#5F6B7A',
    hairStyle: 'short',
    ping: 34.5,
    grin: true,
  },
  {
    x: 100,
    row: 1,
    facing: -1,
    skin: '#F0C8A8',
    hair: '#C9A66B',
    coat: '#6E9C94',
    hairStyle: 'long',
    ping: 31,
  },
  {
    x: 214,
    row: 1,
    facing: 1,
    skin: '#E8B998',
    hair: '#3E2A20',
    coat: '#A38CB0',
    hairStyle: 'short',
    ping: 28.4,
  },
  {
    x: 268,
    row: 1,
    facing: -1,
    skin: '#8E5A3E',
    hair: '#2A1E1C',
    coat: '#C9A66B',
    hairStyle: 'bun',
    ping: 28.9,
    grin: true,
  },
];
/** The front row: Priya and Tom, who get their own close-up later. */
const FRONT = [
  { who: PRIYA, x: 58, facing: 1, ping: 36.2 },
  { who: TOM, x: 284, facing: -1, ping: 36.5 },
] as const;
const FRONT_Y = 166;
const DEV_DESK = 184;
const DEV_SEAT = 152;
const TUBES = [18, 98, 178, 258] as const;

type OfficeMode = 'calm' | 'bolt' | 'after' | 'storm';

/** A small monitor, slightly turned to camera: a bright rectangle with a little on it. */
function monitor(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  facing: number,
  content: 'mail' | 'dialog',
) {
  const w = 16 * s,
    h = 12 * s;
  const skew = facing * 1.5 * s;
  poly(ctx, '#2F3438', [
    x - w / 2,
    y - h - skew,
    x + w / 2,
    y - h + skew,
    x + w / 2,
    y + skew,
    x - w / 2,
    y - skew,
  ]);
  const i = 1.2 * s;
  poly(ctx, '#E4F3EF', [
    x - w / 2 + i,
    y - h + i - skew,
    x + w / 2 - i,
    y - h + i + skew,
    x + w / 2 - i,
    y - i + skew,
    x - w / 2 + i,
    y - i - skew,
  ]);
  if (content === 'dialog') {
    box(ctx, x - 5 * s, y - 8 * s, 10 * s, 5 * s, '#FFFFFF');
    box(ctx, x - 4 * s, y - 5 * s, 8 * s, 1 * s, TEAL);
  } else
    for (let k = 0; k < 3; k++)
      box(ctx, x - 5 * s, y - (9 - k * 2.5) * s, (8 - k * 2) * s, 0.8 * s, alpha(INK, 0.35));
  box(ctx, x - 0.8 * s, y, 1.6 * s, 3 * s, '#3A3F44');
  glow(ctx, x, y - h / 2, 16 * s, '#DDF6F0', 0.25);
}

function backWall(ctx: Ctx, t: number, seconds: number, storm: number) {
  box(ctx, 0, 0, W, 24, '#E8E1D1');
  for (let x = 20; x < W; x += 40) box(ctx, x, 0, 1, 22, '#DAD2C0');
  box(ctx, 0, 10, W, 1, '#DAD2C0');
  box(ctx, 0, 22, W, 2, '#CBC2AE');
  box(ctx, 0, 24, W, 76, BEIGE);
  box(ctx, 0, 96, W, 4, BEIGE_D);
  // Windows with the blinds two-thirds down.
  for (const wx of [10, 56]) {
    box(ctx, wx, 32, 40, 40, '#B5AC98');
    box(ctx, wx + 2, 34, 36, 36, '#CFE0E6');
    for (let yy = 35; yy < 58; yy += 3) box(ctx, wx + 2, yy, 36, 2, '#E9EDEC');
  }
  // Nine o'clock.
  disc(ctx, 110, 44, 7.5, '#8E8676');
  disc(ctx, 110, 44, 6.5, '#F6F3EC');
  line(ctx, INK, 1.2, [110, 44, 105.5, 44]);
  line(ctx, INK, 0.9, [110, 44, 110, 38.5]);
  // Last night's banner, still up, one corner giving way.
  ctx.save();
  ctx.translate(126, 27);
  ctx.rotate(0.06);
  box(ctx, 0, 0, 98, 13, '#EFA7B6');
  box(ctx, 0, 0, 98, 1, '#D98597');
  write(ctx, 'KARAOKE NIGHT!', 49, 9.5, { size: 8, color: '#7A2E45' });
  ctx.restore();
  poly(ctx, '#E596A7', [220, 34, 224, 34, 223, 45]);
  // The boss's glass office, with a birthday balloon on the door.
  box(ctx, 236, 28, 84, 72, '#C6D5D2');
  box(ctx, 262, 78, 40, 4, '#8E7A62');
  box(ctx, 264, 82, 2, 14, '#6E5E4A');
  box(ctx, 298, 82, 2, 14, '#6E5E4A');
  line(ctx, '#4A4F55', 1, [306, 96, 306, 70]);
  disc(ctx, 306, 68, 2.2, '#4A4F55');
  for (const fx of [236, 278, 318]) box(ctx, fx, 28, 2, 72, '#98A5A4');
  box(ctx, 236, 28, 84, 2, '#98A5A4');
  box(ctx, 242, 42, 32, 58, alpha('#E9F2F0', 0.45));
  box(ctx, 247, 48, 22, 8, '#2F3B5C');
  write(ctx, 'CEO', 258, 54, { size: 6, color: '#FFFFFF' });
  box(ctx, 269, 72, 2, 6, '#7A8484');
  line(ctx, alpha('#FFFFFF', 0.35), 1.5, [284, 90, 300, 36]);
  const bx = 276 + Math.sin(seconds * 1.1) * 2 + storm * 6,
    by = 50 + Math.sin(seconds * 1.7) * 1.5 - storm * 4;
  line(ctx, '#7A7A7A', 0.6, [270, 74, bx, by + 8]);
  oval(ctx, bx, by, 6, 7.5, '#E8705E');
  disc(ctx, bx - 2, by - 3, 1.5, alpha('#FFFFFF', 0.5));
  // The tubes: one of them is not quite well.
  TUBES.forEach((x, i) => {
    const hum = i === 2 ? 0.82 + 0.18 * Math.sin(seconds * 3.1) * Math.sin(seconds * 7.3) : 1;
    box(ctx, x, 20, 42, 3, alpha('#F9FDF7', hum));
    glow(ctx, x + 21, 26, 50, '#F4FBF2', 0.28 * hum);
  });
  void t;
}

function mate(ctx: Ctx, m: Mate, t: number, seconds: number, storm: number) {
  const r = ROWS[m.row];
  const since = t - m.ping;
  const up = storm > 0 ? 1 : since >= 0 ? ease(span(since, 0.25, 0.7)) : 0;
  const standing = storm > 0.4;
  monitor(ctx, m.x + m.facing * 15 * r.s, r.top - 1, r.s, -m.facing, 'mail');
  const wave = Math.sin(seconds * 9 + m.x);
  const f: Figure = {
    skin: m.skin,
    hair: m.hair,
    coat: m.coat,
    legs: '#4A4F58',
    build: 'adult',
    size: r.s,
    facing: m.facing,
    sitting: !standing,
    hairStyle: m.hairStyle,
    arms: standing ? [2.6 + wave * 0.35, 2.5] : [0.5, lerp(1.1, 2.5, up)],
    eyes: up > 0.3 ? (m.grin && !standing ? 'happy' : 'wide') : 'open',
    mouth: up > 0.3 ? (standing ? 'open' : m.grin ? 'grin' : 'o') : 'flat',
    blush: up > 0.3,
  };
  // Pinged heads pop up over the partitions like meerkats.
  const y = standing ? r.ground - 4 : r.ground - up * 7 * r.s;
  person(ctx, m.x, y, f);
  if (up > 0) {
    const hand = handOf(m.x, y, f);
    smallPhone(ctx, hand.x, hand.y - 2 * r.s, r.s, storm > 0 || since < 0.9, seconds);
  }
}

function partitionRow(ctx: Ctx, top: number, bottom: number, right: number) {
  box(ctx, 0, top, right, bottom - top, '#93A8A3');
  box(ctx, 0, top, right, 2, '#6F837F');
  for (let x = 0; x < right; x += 54) box(ctx, x, top, 2, bottom - top, '#7E928D');
}

function frontDesk(
  ctx: Ctx,
  x: number,
  facing: number,
  content: 'mail' | 'dialog',
  phoneLit: boolean,
) {
  const top = FRONT_Y - 18;
  monitor(ctx, x + facing * 6, top - 2, 1.35, -facing, content);
  box(ctx, x - 26, top, 52, 3, '#D2C6AA');
  box(ctx, x - 26, top + 3, 52, 2, '#B3A78B');
  box(ctx, x - 24, top + 5, 2, 13, '#8E8676');
  box(ctx, x + 22, top + 5, 2, 13, '#8E8676');
  box(ctx, x + facing * 10 - 8, top + 5, 16, 13, '#BDB195');
  box(ctx, x - facing * 10 - 8, top - 1.5, 14, 1.5, '#E3E3DD');
  box(ctx, x + facing * 18 - 2, top - 6, 5, 6, TEAL);
  if (!phoneLit) box(ctx, x - facing * 20 - 2, top - 1, 5, 1.5, '#2A2E33');
}

function office(ctx: Ctx, t: number, seconds: number, mode: OfficeMode) {
  const storm = mode === 'storm' ? ease(span(t, STORM_S, STORM_S + 0.5)) : 0;
  backWall(ctx, t, seconds, storm);
  box(ctx, 0, 100, W, 80, CARPET);
  for (let y = 112; y < H; y += 16) box(ctx, 0, y, W, 1, '#838B8E');
  for (let x = 0; x < W; x += 32) box(ctx, x, 100, 1, 80, alpha('#7E8689', 0.5));
  for (const r of [0, 1] as const) {
    for (const m of MATES) if (m.row === r) mate(ctx, m, t, seconds, storm);
    partitionRow(ctx, ROWS[r].top, ROWS[r].ground, ROWS[r].right);
  }
  // The front row: Priya, Dev, Tom.
  const outbox = t >= CLICK_S ? 'dialog' : 'mail';
  frontDesk(ctx, FRONT[0].x + 28, 1, 'mail', t >= FRONT[0].ping);
  frontDesk(ctx, DEV_DESK, 1, outbox, false);
  frontDesk(ctx, FRONT[1].x - 28, -1, 'mail', t >= FRONT[1].ping);
  for (const fm of FRONT) {
    const up = storm > 0 ? 1 : ease(span(t - fm.ping, 0.2, 0.6));
    chair(ctx, fm.x - fm.facing * 3, FRONT_Y, 1.1, fm.facing > 0 ? 0.4 : 2.7);
    const q: Pose = {
      x: fm.x,
      y: FRONT_Y,
      s: 1.12,
      facing: fm.facing,
      ...(storm > 0.4 ? STILL : seated(seconds + fm.x, up > 0 ? 0 : 1)),
      eyes: up > 0.3 ? 'wide' : 'open',
      mouth: up > 0.3 ? (storm > 0.4 ? 'open' : 'o') : 'flat',
    };
    if (up > 0)
      q.arms = [
        storm > 0.4 ? 2.7 + Math.sin(seconds * 8) * 0.3 : 0.9,
        1.7,
        lerp(1, 2.3, up),
        lerp(1.8, 3.2, up),
      ];
    figure(ctx, fm.who, q);
    if (up > 0) {
      const h = handAt(q);
      smallPhone(ctx, h.x, h.y - 2, 1.1, storm > 0 || t - fm.ping < 0.9, seconds);
    }
  }
  devAtDesk(ctx, t, seconds, mode);
  if (storm > 0) envelopes(ctx, t, storm);
}

/** Dev at his desk: typing, then gone, leaving a spinning chair and loose paper. */
function devAtDesk(ctx: Ctx, t: number, seconds: number, mode: OfficeMode) {
  const since = t - BOLT_S;
  const rolled = since > 0 ? easeOut(span(since, 0, 1.2)) * 26 : 0;
  const spin = since > 0 ? 20 * (1 - Math.exp(-since / 4)) : 0.35;
  chair(ctx, DEV_SEAT - 2 - rolled, FRONT_Y, 1.1, spin + 0.35);
  if (since > 0)
    for (let i = 0; i < 6; i++) {
      const age = Math.min(since, 2.2);
      const vx = (rand(i * 2.3) - 0.3) * 50,
        x = DEV_DESK - 12 + i * 4 + vx * age;
      const y = Math.min(
        FRONT_Y - 1 - rand(i) * 4,
        FRONT_Y - 20 - (50 + rand(i * 5.1) * 30) * age + 70 * age * age,
      );
      const w = 2 + Math.abs(Math.cos(age * 7 + i)) * 4;
      box(ctx, x - w / 2, y, w, 2, '#F5F3EB');
    }
  if (mode === 'after' || mode === 'storm') return;
  let q: Pose;
  if (t < BOLT_S) {
    const typing = mode === 'calm' ? 1 : 0;
    q = {
      x: DEV_SEAT,
      y: FRONT_Y,
      s: 1.12,
      ...seated(seconds, typing),
      eyes: mode === 'bolt' ? 'wide' : 'open',
      mouth: mode === 'bolt' ? 'o' : 'smile',
    };
  } else {
    const rise = ease(span(since, 0, 0.3));
    const x = DEV_SEAT + (since > 0.3 ? (since - 0.3) * 88 : 0);
    const m = blend(seated(seconds, 0), running(seconds * 13, 0.35), rise);
    q = { x, y: FRONT_Y - hump(since, 0, 0.35) * 5, s: 1.12, ...m, eyes: 'wide', mouth: 'open' };
  }
  figure(ctx, DEV, q);
}

/** The reply-all storm: envelopes swirling over the desks. */
function envelopes(ctx: Ctx, t: number, amount: number) {
  faded(ctx, amount, () => {
    for (let i = 0; i < 28; i++) {
      const r1 = rand(i * 3.7),
        r2 = rand(i * 5.3),
        r3 = rand(i * 7.9);
      const age = (t - STORM_S) * (0.6 + r3 * 0.6) + r1 * 3;
      const x = ((r2 * 380 + age * (70 + r1 * 90)) % 380) - 30;
      const y = 34 + r1 * 96 + Math.sin(age * 3 + i) * 12;
      box(ctx, x - 6, y - 4, 12, 8, '#F7F6F0');
      line(ctx, '#8FA7A1', 1, [x - 6, y - 4, x, y + 1, x + 6, y - 4]);
    }
  });
}

// ——— Close-up sets ———
/** Dev's desk from above, in slow motion: finger, mouse, and a phone that will not keep still. */
function fingerShot(ctx: Ctx, t: number, seconds: number) {
  box(ctx, 0, 0, W, H, '#CDBF9F');
  for (let i = 0; i < 6; i++) box(ctx, 0, 70 + i * 19 + (i % 2) * 5, W, 1, alpha('#B4A585', 0.6));
  box(ctx, 0, 0, W, 38, '#2B3035');
  box(ctx, 0, 36, W, 3, '#1F2327');
  glow(ctx, 160, 40, 220, '#E6F7F2', 0.3);
  box(ctx, 50, 62, 180, 118, '#3E5C5A');
  box(ctx, 50, 62, 180, 2, '#4E706D');
  // The mug from last night.
  oval(ctx, 22, 92, 16, 5, '#246E6A');
  box(ctx, 6, 70, 32, 22, TEAL);
  oval(ctx, 22, 70, 16, 5, '#1B3F3D');
  line(ctx, TEAL, 4, [38, 76, 46, 80, 38, 88]);
  write(ctx, 'MIC', 22, 85, { size: 7, color: '#E6F6F3' });
  // The phone buzzes, crawls across the desk, and bumps the mouse.
  const lit = t >= BUZZ;
  const buzzing = within(t, BUZZ, NUDGE + 0.15);
  const px = 276 - easeIn(span(t, BUZZ, NUDGE)) * 38 + (buzzing ? Math.sin(seconds * 70) * 1.3 : 0);
  if (lit) glow(ctx, px, 112, 60, '#DDF6F0', 0.35);
  ctx.save();
  ctx.translate(px, 112);
  ctx.rotate(-0.12);
  box(ctx, -18, -34, 36, 68, '#1E2226');
  box(ctx, -15, -30, 30, 60, lit ? '#E4F5F0' : '#14171B');
  if (lit) {
    box(ctx, -13, -20, 26, 22, '#FFFFFF');
    disc(ctx, -8, -14, 3, '#E39A74');
    write(ctx, 'Sis', 3, -12, { size: 6, color: '#7D8A86' });
    write(ctx, 'well??', 0, -3, { size: 8, color: INK });
  }
  ctx.restore();
  if (buzzing)
    for (const sd of [-1, 1])
      for (const k of [0, 1])
        line(ctx, alpha('#FFFFFF', 0.75), 1.2, [
          px + sd * (24 + k * 5),
          100,
          px + sd * (27 + k * 5),
          112,
          px + sd * (24 + k * 5),
          124,
        ]);
  // The mouse, nudged a few pixels right at the worst possible moment.
  const mx = 138 + ease(span(t, NUDGE, NUDGE + 0.25)) * 10;
  oval(ctx, mx + 4, 130, 30, 40, alpha('#0B0E14', 0.25));
  oval(ctx, mx, 124, 28, 38, '#E7EAEB');
  oval(ctx, mx - 7, 114, 14, 20, '#F4F6F6');
  line(ctx, '#B9C0C3', 1.2, [mx, 87, mx, 114]);
  box(ctx, mx - 2, 96, 4, 9, '#8E979B');
  // Dev's hand: the index finger descending, very slowly.
  const press = ease(span(t, 10.1, 12));
  const skin = DEV.skin,
    edge = DEV.shade;
  poly(ctx, DEV.coat, [0, 180, 0, 146, 62, 136, 100, 170, 96, 180]);
  poly(ctx, DEV.coatD, [0, 150, 62, 138, 66, 146, 0, 158]);
  oval(ctx, mx - 6, 148, 26, 22, skin);
  line(ctx, skin, 9, [mx - 28, 152, mx - 33, 128]);
  line(ctx, skin, 8, [mx + 16, 140, mx + 22, 122]);
  line(ctx, skin, 7, [mx + 22, 150, mx + 29, 136]);
  line(ctx, skin, 9, [mx + 5, 136, mx + 7, 106]);
  const tipY = lerp(94, 101, press);
  oval(
    ctx,
    mx - 9 + (1 - press) * 5,
    tipY + 4 + (1 - press) * 8,
    5,
    3,
    alpha('#0B0E14', 0.25 * (1 - press)),
  );
  line(ctx, skin, 9.5, [mx - 8, 136, mx - 9, tipY]);
  oval(ctx, mx - 9, tipY + 1, 2.6, 3, mix(skin, '#FFFFFF', 0.35));
  for (const k of [-8, 5, 17]) line(ctx, edge, 0.8, [mx + k - 3, 128, mx + k + 3, 128]);
  if (press > 0.2 && press < 1)
    for (const k of [0, 1, 2])
      line(ctx, alpha('#FFFFFF', 0.5), 1, [
        mx - 22 + k * 3,
        tipY - 8 - k * 5,
        mx - 17 + k * 3,
        tipY - 10 - k * 5,
      ]);
}

/** The two buttons, huge, and a cursor drifting from one to the other. */
function buttonsShot(ctx: Ctx, t: number, seconds: number) {
  const slide = easeOut(span(t, 11.95, 12.6));
  const cx = lerp(REPLY_AT[0] + 2, ALL_AT[0] - 30, slide);
  const jolt = t >= CLICK_S ? Math.exp(-(t - CLICK_S) * 9) * 1.5 : 0;
  const view = {
    x: lerp(156, 164, span(t, 11.8, 13.5)),
    y: 128 + jolt,
    zoom: lerp(2.35, 2.75, ease(span(t, 11.8, 13.5))),
  };
  camera(ctx, view, () =>
    mailScreen(
      ctx,
      {
        ...DEV_MAIL,
        typed: `${LINE1}\n${LINE2}`,
        hover: cx > BTN.all.x ? 2 : 1,
        press: t >= CLICK_S ? 2 : 0,
        cursor: [cx, REPLY_AT[1] + (t >= CLICK_S ? 1 : 0)],
      },
      seconds,
    ),
  );
}

/** A soft, out-of-focus office behind a close-up. */
function officeBlur(ctx: Ctx, screenGlow = 0.35) {
  box(ctx, 0, 0, W, H, '#CFC2A4');
  box(ctx, 0, 0, W, 16, '#E4DDCC');
  for (const x of [20, 200]) {
    box(ctx, x, 13, 70, 3, '#F9FDF7');
    glow(ctx, x + 35, 18, 80, '#F4FBF2', 0.3);
  }
  box(ctx, 10, 36, 70, 56, '#BFB39A');
  box(ctx, 14, 40, 62, 48, '#C9D9DC');
  for (let y = 42; y < 70; y += 5) box(ctx, 14, y, 62, 3, '#DDE4E4');
  box(ctx, 118, 30, 110, 16, alpha('#EFA7B6', 0.7));
  box(ctx, 0, 122, W, 58, '#8FA39E');
  box(ctx, 0, 120, W, 3, '#6F837F');
  glow(ctx, 330, 100, 150, '#DDF6F0', screenGlow);
}

function horrorShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [13.5, 160, 92, 1],
    [16.5, 156, 88, 1.22],
  ]);
  const shock = t >= 13.9;
  const tremble = t >= 15 ? Math.sin(seconds * 45) * 0.4 : 0;
  camera(ctx, view, () => {
    officeBlur(ctx);
    portrait(ctx, DEV, 150 + tremble, 104, 1.5, {
      eyes: shock ? 'wide' : 'open',
      look: [0.9, 0.1],
      raise: shock ? ease(span(t, 13.9, 14.3)) : 0,
      brows: t >= 15 ? -ease(span(t, 15, 15.5)) * 0.9 : 0,
      mouth: !shock ? 'smug' : t < 14.4 ? 'flat' : 'o',
      sweat: span(t, 15.2, 16.4),
      key: '#DDF6F0',
      keyX: 22,
      keyAmount: 0.35,
      glint: '#DFF7F2',
      turn: 0.25,
    });
  });
}

/** Priya and Tom read the email. Tom looks, very slowly, toward the boss's office. */
function gossipShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [36, 160, 92, 1],
    [38.5, 164, 94, 1.08],
  ]);
  camera(ctx, view, () => {
    officeBlur(ctx, 0.15);
    box(ctx, 250, 20, 70, 100, alpha('#C6D5D2', 0.8));
    oval(ctx, 290, 50, 7, 9, '#E8705E');
    const shake = t >= 37.6 ? Math.sin(seconds * 30) * 0.8 : 0;
    const pr = span(t, 36.2, 36.5);
    portrait(ctx, PRIYA, 92, 100 + shake * 0.5, 1.05, {
      eyes: t < 36.6 ? 'open' : t < 37.6 ? 'wide' : 'squeeze',
      look: [0.1, 0.9],
      raise: t >= 36.6 ? 1 : 0,
      mouth: 'o',
      key: '#DDF6F0',
      keyY: 26,
      keyAmount: 0.45 * pr,
    });
    const tom = ease(span(t, 37.4, 38.4));
    portrait(ctx, TOM, 228, 102, 1.05, {
      eyes: t < 37 ? 'open' : 'wide',
      look: [lerp(-0.1, 1, tom), lerp(0.9, 0, tom)],
      raise: ease(span(t, 37, 37.3)),
      mouth: t < 37 ? 'flat' : 'o',
      turn: tom * 0.85,
      key: '#DDF6F0',
      keyY: 26,
      keyAmount: 0.45 * span(t, 36.5, 36.8),
    });
    // Phones held at chest height, lighting the faces from below.
    bigPhone(ctx, 96, 166, 1.1, pr, seconds, within(t, 36.2, 36.9));
    bigPhone(ctx, 226, 168, 1.1, span(t, 36.5, 36.8), seconds, within(t, 36.5, 37.2));
    if (t >= 36.9) hand(ctx, 94, 123, 1.05, PRIYA.skin, PRIYA.shade, 0.1);
  });
}

function hand(ctx: Ctx, x: number, y: number, s: number, skin: string, shade: string, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  oval(ctx, 0, 2, 9, 9, skin);
  for (let i = 0; i < 4; i++) oval(ctx, -6 + i * 4, -6, 2.3, 5, skin);
  oval(ctx, -9, 4, 2.6, 5, skin);
  for (const k of [-4, 0, 4]) line(ctx, shade, 0.8, [k, -3, k, 1]);
  ctx.restore();
}

/** A phone in a close-up, screen toward us. */
function bigPhone(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  lit: number,
  seconds: number,
  buzz: boolean,
) {
  const j = buzz ? Math.sin(seconds * 60) * 1.2 : 0;
  ctx.save();
  ctx.translate(x + j, y);
  ctx.scale(s, s);
  box(ctx, -9, -15, 18, 30, '#1F2327');
  box(ctx, -7.5, -13, 15, 25, lit > 0 ? mix('#15181C', '#DDF4EE', lit) : '#15181C');
  if (lit > 0.5)
    for (let k = 0; k < 4; k++) box(ctx, -6, -10 + k * 4, 12 - (k % 2) * 4, 1.5, alpha(INK, 0.35));
  ctx.restore();
  if (lit > 0) glow(ctx, x + j, y, 28 * s, '#DDF4EE', 0.35 * lit);
  if (buzz)
    for (const sd of [-1, 1])
      line(ctx, alpha('#FFFFFF', 0.75), 1.2, [
        x + sd * 13 * s,
        y - 6,
        x + sd * 16 * s,
        y,
        x + sd * 13 * s,
        y + 6,
      ]);
}

// ——— The long corridor ———
const HALL_W = 1600;
const HALL_FLOOR = 152;
const HALL_DOORS: readonly (readonly [number, string])[] = [
  [120, 'MEETING'],
  [330, 'HR'],
  [566, 'KITCHEN'],
  [1000, 'PRINT'],
  [1452, 'LIFTS'],
];
/** The part of a scrolling set the camera can see. */
function bounds(v: { x: number; zoom: number }, width: number) {
  const hw = W / 2 / v.zoom;
  const x = Math.max(hw, Math.min(width - hw, v.x));
  return { left: x - hw, right: x + hw };
}

function hallDoor(ctx: Ctx, x: number, label: string) {
  box(ctx, x - 2, 56, 36, 94, '#A89878');
  box(ctx, x, 58, 32, 92, '#C3B28E');
  box(ctx, x + 9, 66, 14, 22, '#DCE8E6');
  box(ctx, x + 26, 104, 4, 2, '#6E6A60');
  box(ctx, x + 2, 44, 28, 9, '#F2EEE3');
  write(ctx, label, x + 16, 51, { size: 5.5, color: INK });
}

function hall(ctx: Ctx, left: number, right: number) {
  const L = Math.floor(left) - 2,
    R = Math.ceil(right) + 2,
    w = R - L;
  const seen = (a: number, b: number) => b > L && a < R;
  box(ctx, L, 0, w, 22, '#E6DFD0');
  box(ctx, L, 20, w, 2, '#CFC6B2');
  box(ctx, L, 22, w, 86, BEIGE);
  box(ctx, L, 108, w, 2, '#B3A585');
  box(ctx, L, 110, w, 36, '#CDBE9D');
  box(ctx, L, 146, w, 4, '#9A8E74');
  box(ctx, L, 150, w, 30, '#B9BEBA');
  for (let x = Math.floor(L / 48) * 48; x < R; x += 48) box(ctx, x, 150, 1, 30, '#ADB3AF');
  box(ctx, L, 165, w, 1, '#ADB3AF');
  for (let x = Math.floor(L / 96) * 96 + 28; x < R; x += 96) {
    box(ctx, x, 16, 40, 3, '#F9FDF7');
    glow(ctx, x + 20, 22, 44, '#F4FBF2', 0.3);
    box(ctx, x + 4, 158, 32, 2, alpha('#FFFFFF', 0.3));
  }
  for (const [dx, label] of HALL_DOORS) if (seen(dx - 4, dx + 36)) hallDoor(ctx, dx, label);
  if (seen(206, 260)) {
    box(ctx, 206, 64, 52, 32, '#8E6A42');
    box(ctx, 208, 66, 48, 28, '#C49A64');
    const notes = ['#F4F1E4', '#EFA7B6', '#CFE8E4', '#F2D98A', '#F4F1E4'];
    notes.forEach((c, i) => box(ctx, 212 + i * 9, 69 + (i % 2) * 9, 7, 8, c));
  }
  if (seen(400, 450))
    for (let i = 0; i < 3; i++) {
      box(ctx, 404 + i * 16, 62, 12, 15, '#7A6A55');
      box(ctx, 405 + i * 16, 63, 10, 13, '#E8E2D2');
      disc(ctx, 410 + i * 16, 68, 2.5, '#DCA37F');
      box(ctx, 407 + i * 16, 64, 6, 2, '#8A5530');
    }
  if (seen(466, 486)) {
    box(ctx, 468, 112, 14, 38, '#E9EDEE');
    box(ctx, 470, 94, 10, 18, alpha('#8CC3E6', 0.85));
    box(ctx, 474, 118, 3, 3, TEAL);
  }
  for (const px of [660, 1540])
    if (seen(px - 12, px + 12)) {
      box(ctx, px - 7, 132, 14, 18, '#B7835A');
      for (let k = 0; k < 5; k++)
        oval(ctx, px - 6 + k * 3, 124 - (k % 2) * 6, 3, 8, '#6E9C6A', (k - 2) * 0.35);
    }
  if (seen(720, 734)) {
    box(ctx, 722, 120, 6, 16, RED);
    box(ctx, 718, 108, 14, 8, RED);
  }
  // Mop, bucket, the sign, and a long wet shine.
  if (seen(1070, 1310)) {
    box(ctx, 1112, 150, 190, 30, alpha('#DDF2F6', 0.3));
    for (const [sx, sy, sw] of [
      [1128, 156, 30],
      [1186, 162, 44],
      [1250, 157, 26],
    ])
      box(ctx, sx, sy, sw, 1, alpha('#FFFFFF', 0.7));
    box(ctx, 1072, 138, 14, 12, '#E8C83A');
    line(ctx, '#8E7A5A', 1.5, [1081, 138, 1092, 98]);
    poly(ctx, '#F0C83A', [1094, 150, 1098, 124, 1104, 124, 1108, 150]);
    box(ctx, 1097, 133, 8, 2, INK);
    write(ctx, '!', 1101, 145, { size: 7, color: INK });
  }
}

// The cake parade: two carriers, a board across the corridor between them, a cake on it.
const BOARD_Y = 128;
const cakeX = (t: number) => 372 - (t - LIMBO_S) * 26;
const devHallA = (t: number) => 40 + (t - 22.5) * 100;
function carrier(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  coat: string,
  hair: string,
  t: number,
  seconds: number,
) {
  const shoulder = y - 22 * s;
  const reach = Math.acos(Math.max(-1, Math.min(1, (BOARD_Y - shoulder) / (10 * s))));
  const passed = t > LIMBO_S + 0.15;
  const f: Figure = {
    skin: '#E8B998',
    hair,
    coat,
    legs: '#4A4F58',
    build: 'adult',
    size: s,
    facing: -1,
    step: passed ? undefined : seconds * 7,
    arms: [reach, reach],
    eyes: passed ? 'wide' : 'happy',
    mouth: passed ? 'o' : Math.sin(seconds * 6) > 0 ? 'open' : 'o',
    hairStyle: 'short',
  };
  person(ctx, x, y, f);
  return handOf(x, y, f);
}
function cakeParade(ctx: Ctx, t: number, seconds: number, layer: 'back' | 'front') {
  const c = cakeX(t);
  if (layer === 'back') {
    const h = carrier(ctx, c + 30, 146, 0.92, '#6E9C94', '#2A1E1C', t, seconds);
    line(ctx, '#7A7A7A', 0.6, [h.x, h.y, h.x + 4, 98]);
    oval(ctx, h.x + 4 + Math.sin(seconds * 2) * 1.5, 92, 5, 6.5, TEAL);
    carrier(ctx, c - 30, 158, 1.05, '#B98585', '#6B4A34', t, seconds);
    return;
  }
  poly(ctx, '#C9B28A', [
    c - 38,
    BOARD_Y - 1,
    c + 38,
    BOARD_Y - 1,
    c + 38,
    BOARD_Y + 2,
    c - 38,
    BOARD_Y + 2,
  ]);
  box(ctx, c - 24, BOARD_Y - 13, 48, 12, '#F7EFE6');
  box(ctx, c - 24, BOARD_Y - 13, 48, 3, '#EFA7B6');
  for (let i = 0; i < 6; i++) box(ctx, c - 22 + i * 8, BOARD_Y - 10, 3, 2 + (i % 2), '#EFA7B6');
  write(ctx, "HAPPY B'DAY BOSS", c, BOARD_Y - 3.5, { size: 4.5, color: '#C0506E' });
  glow(ctx, c, BOARD_Y - 18, 26, '#FFD27A', 0.35);
  for (let i = 0; i < 6; i++) {
    const cx = c - 18 + i * 7;
    box(ctx, cx, BOARD_Y - 18, 1.5, 5, i % 2 ? '#8FD3CC' : HAT_B);
    oval(ctx, cx + 0.7, BOARD_Y - 20 + Math.sin(seconds * 13 + i) * 0.4, 1, 1.8, '#FFD27A');
  }
}
function cakeShot(ctx: Ctx, t: number, seconds: number) {
  const x = devHallA(t);
  const v = { x: x + 40, y: 111, zoom: 1.3 };
  const b = bounds(v, HALL_W);
  const k =
    ease(span(t, LIMBO_S - 0.62, LIMBO_S - 0.32)) *
    (1 - ease(span(t, LIMBO_S + 0.35, LIMBO_S + 0.6)));
  camera(
    ctx,
    v,
    () => {
      hall(ctx, b.left, b.right);
      cakeParade(ctx, t, seconds, 'back');
      figure(ctx, DEV, {
        x,
        y: HALL_FLOOR,
        ...blend(running(seconds * 13), limbo(seconds), k),
        eyes: k > 0.5 ? 'wide' : 'open',
        mouth: k > 0.5 ? 'grit' : 'open',
      });
      cakeParade(ctx, t, seconds, 'front');
    },
    { w: HALL_W, h: H },
  );
}

// The wet floor, the skid, and the intern's trolley of paper.
const TROLLEY = 1330;
function devSkid(t: number, seconds: number): Pose | null {
  if (t < SKID_S)
    return { x: 1010 + (t - 30.5) * 105, y: HALL_FLOOR, ...running(seconds * 13), mouth: 'open' };
  if (t < PAPER_S) {
    const k = span(t, SKID_S, PAPER_S);
    const fall = ease(span(t, SKID_S, SKID_S + 0.35));
    return {
      x: 1125.5 + 190 * (k * (1.35 - 0.35 * k)),
      y: HALL_FLOOR - hump(t, SKID_S, SKID_S + 0.4) * 7,
      ...blend(running(seconds * 13), skidding(seconds), fall),
      eyes: 'wide',
      mouth: 'o',
    };
  }
  if (t < 34.7) return null;
  if (t < 35.1) {
    const up = ease(span(t, 34.7, 35.1));
    return {
      x: 1318,
      y: HALL_FLOOR,
      ...blend({ ...STILL, drop: 9, torso: 0.6, legs: [1.2, -0.8, 1.3, -0.7] }, STILL, up),
      eyes: 'half',
      sheet: true,
    };
  }
  return {
    x: 1318 + (t - 35.1) * 110,
    y: HALL_FLOOR,
    ...running(seconds * 13),
    eyes: 'half',
    mouth: 'flat',
    sheet: true,
  };
}
function trolley(ctx: Ctx, t: number, seconds: number) {
  const tip = easeOut(span(t, PAPER_S, PAPER_S + 0.35)) * 0.35;
  const hit = t >= PAPER_S;
  const f: Figure = {
    skin: '#F0C8A8',
    hair: '#C9A66B',
    coat: '#B8C7A0',
    legs: '#5F6B7A',
    build: 'adult',
    size: 0.96,
    facing: -1,
    hairStyle: 'bun',
    arms: hit ? [2.8, 2.9] : [0.5, 1.3],
    eyes: hit ? 'wide' : 'open',
    mouth: hit ? 'o' : 'flat',
  };
  person(ctx, TROLLEY + 30, HALL_FLOOR - 2, f);
  ctx.save();
  ctx.translate(TROLLEY + 16, 150);
  ctx.rotate(tip);
  ctx.translate(-TROLLEY - 16, -150);
  box(ctx, TROLLEY - 14, 140, 30, 3, '#6D7278');
  line(ctx, '#6D7278', 1.5, [TROLLEY + 16, 141, TROLLEY + 19, 120]);
  disc(ctx, TROLLEY - 10, 147, 2.5, '#2F3338');
  disc(ctx, TROLLEY + 12, 147, 2.5, '#2F3338');
  if (!hit)
    for (let i = 0; i < 4; i++) {
      box(ctx, TROLLEY - 12, 118 + i * 5.5, 24, 5, '#F5F3EB');
      box(ctx, TROLLEY - 3, 118 + i * 5.5, 5, 5, '#8FB9B4');
    }
  ctx.restore();
  void seconds;
}
/** A ream's worth of paper in the air, drifting down (drag makes it float). */
function sheets(ctx: Ctx, t: number) {
  const age = t - PAPER_S;
  if (age < 0) return;
  if (age > 0.4) oval(ctx, 1318, 150, 22 * Math.min(1, age), 7, '#F2F0E8');
  for (let i = 0; i < 26; i++) {
    const r1 = rand(i * 1.7 + 3),
      r2 = rand(i * 2.9 + 5),
      r3 = rand(i * 4.1 + 7);
    const vx = (r1 - 0.45) * 150,
      vy = -70 - r2 * 90;
    const y0 = 124 + r3 * 10,
      floor = 147 + r3 * 20;
    const y = Math.min(floor, y0 + ((vy - 30) * (1 - Math.exp(-3 * age))) / 3 + 30 * age);
    const landed = y >= floor;
    const x =
      TROLLEY +
      (r1 - 0.5) * 16 +
      (vx * (1 - Math.exp(-2 * age))) / 2 +
      (landed ? 0 : Math.sin(age * 4 + i) * 5 * Math.min(1, age));
    const w = landed ? 6 : 2 + 4 * Math.abs(Math.cos(age * 5 + i * 1.3));
    box(ctx, x - w / 2, y - 1.5, w, 3, '#F6F4EC');
  }
}
function skidShot(ctx: Ctx, t: number, seconds: number) {
  const q = devSkid(t, seconds);
  const x = q ? q.x : 1318;
  const v = { x: Math.min(x, 1340) + 30 + Math.max(0, x - 1340), y: 111, zoom: 1.3 };
  const b = bounds(v, HALL_W);
  camera(
    ctx,
    v,
    () => {
      hall(ctx, b.left, b.right);
      trolley(ctx, t, seconds);
      if (q) figure(ctx, DEV, q);
      if (q && within(t, SKID_S, PAPER_S))
        for (let i = 0; i < 4; i++)
          disc(ctx, q.x + 16 + i * 3, 146 - ((seconds * 9 + i * 0.3) % 1) * 6, 0.8, '#DDF2F6');
      sheets(ctx, t);
    },
    { w: HALL_W, h: H },
  );
}

// ——— The lift ———
function liftGap(t: number) {
  if (t < 38.8) return 88;
  if (t < DING_S) return lerp(88, 15, ease(span(t, 38.8, CLAMP_S)));
  if (t < 41.9) return lerp(15, 88, ease(span(t, DING_S, DING_S + 0.35)));
  return lerp(88, 0, ease(span(t, 41.9, 42.5)));
}
function liftShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [38.5, 160, 96, 1.12],
    [42.5, 160, 100, 1.24],
  ]);
  camera(ctx, view, () => {
    box(ctx, 0, 0, W, 150, '#D3C7AA');
    box(ctx, 0, 0, W, 16, '#E6DFD0');
    for (const x of [30, 230]) {
      box(ctx, x, 13, 50, 3, '#F9FDF7');
      glow(ctx, x + 25, 18, 50, '#F4FBF2', 0.3);
    }
    box(ctx, 0, 146, W, 4, '#9A8E74');
    box(ctx, 0, 150, W, 30, '#B3B8B4');
    box(ctx, 22, 58, 72, 32, TEAL);
    write(ctx, 'B1', 58, 72, { size: 10, color: '#FFFFFF' });
    write(ctx, 'SERVER ROOM', 58, 84, { size: 6, color: '#E6F6F3' });
    box(ctx, 256, 132, 14, 18, '#B7835A');
    for (let k = 0; k < 5; k++)
      oval(ctx, 257 + k * 3, 124 - (k % 2) * 6, 3, 8, '#6E9C6A', (k - 2) * 0.35);
    // The car, and a colleague already in it, holding a coffee, saying nothing.
    box(ctx, 110, 34, 100, 116, '#8C959A');
    box(ctx, 116, 42, 88, 108, '#5D666C');
    box(ctx, 118, 44, 84, 80, '#6F797F');
    box(ctx, 118, 96, 84, 2, '#9AA3A8');
    box(ctx, 118, 140, 84, 10, '#50585E');
    const inside = t >= DING_S + 0.2;
    const f: Figure = {
      skin: '#D9A07E',
      hair: '#8A8A8A',
      coat: '#7E8C7A',
      legs: '#3F444C',
      build: 'adult',
      size: 0.95,
      facing: -1,
      hairStyle: 'short',
      arms: [0.2, 1.4],
      eyes: inside ? 'open' : 'sleepy',
      mouth: 'flat',
    };
    person(ctx, 184, 145, f);
    const cup = handOf(184, 145, f);
    box(ctx, cup.x - 2, cup.y - 4, 4, 5, '#F4F1EA');
    box(ctx, 146, 24, 28, 10, '#1D2024');
    write(ctx, t < 42 ? '3' : '2', 156, 32, { size: 7, color: '#F2B84B' });
    poly(ctx, '#F2B84B', [163, 27, 169, 27, 166, 31]);
    box(ctx, 214, 92, 8, 18, '#8C959A');
    disc(ctx, 218, 97, 1.8, '#E8E8E0');
    disc(ctx, 218, 104, 1.8, t < 42.5 ? '#F2B84B' : '#E8E8E0');
    // Dev.
    let q: Pose;
    if (t < 39.8)
      q = { x: -12 + (t - 38.5) * 100, y: 164, s: 1.1, ...running(seconds * 13), mouth: 'open' };
    else if (t < CLAMP_S) {
      const k = ease(span(t, 39.8, CLAMP_S));
      q = {
        x: lerp(118, 160, k),
        y: lerp(164, 146, k) - hump(t, 39.8, CLAMP_S) * 8,
        s: lerp(1.1, 1, k),
        ...blend(running(seconds * 13), { ...STILL, spin: 0.5, arms: [2.8, 3, 2.6, 3] }, k),
        eyes: 'wide',
        mouth: 'open',
      };
    } else if (t < DING_S) {
      const kick = Math.sin(seconds * 20) * 0.5;
      q = {
        x: 160,
        y: 146,
        s: 1.1,
        squash: 0.3,
        ...STILL,
        legs: [kick, kick, -kick, -kick],
        arms: [2.9, 3.1, 2.6, 3],
        eyes: 'wide',
        mouth: 'grit',
      };
    } else {
      const k = ease(span(t, DING_S, DING_S + 0.35));
      q = {
        x: lerp(160, 150, k),
        y: lerp(146, 143, k),
        s: 0.95,
        ...blend(STILL, { ...STILL, torso: 0.5, drop: 2 }, hump(t, DING_S, DING_S + 0.7)),
        eyes: t < 41.8 ? 'wide' : 'half',
        mouth: 'flat',
      };
    }
    const g = liftGap(t);
    const doors = () => {
      box(ctx, 116, 42, 44 - g / 2, 108, '#B9C2C6');
      box(ctx, 160 + g / 2, 42, 44 - g / 2, 108, '#B9C2C6');
      box(ctx, 159 - g / 2, 42, 1, 108, '#8E989C');
      box(ctx, 160 + g / 2, 42, 1, 108, '#8E989C');
      box(ctx, 124 - g / 2, 42, 4, 108, alpha('#FFFFFF', 0.25));
      box(ctx, 190 + g / 2, 42, 4, 108, alpha('#FFFFFF', 0.25));
    };
    if (t < 40.05) {
      doors();
      figure(ctx, DEV, q);
    } else {
      figure(ctx, DEV, q);
      doors();
    }
  });
}

// ——— The basement: a fire drill in single file ———
const DRILL_W = 640;
const SERVER_DOOR = 396;
const lineLead = (t: number) => 420 + (t - 42.5) * 34;
const marchPhase = (t: number) => (t - 42.5) * (116 / 60) * Math.PI;
function devDrillX(t: number) {
  if (t < 43.4) return 200 + ease(span(t, 42.5, 43.4)) * 122.6;
  if (t < PEEL_S) return lineLead(t) - 128;
  return lineLead(PEEL_S) - 128 + ease(span(t, PEEL_S, PEEL_S + 0.4)) * 12;
}
function drillShot(ctx: Ctx, t: number, seconds: number) {
  const dx = devDrillX(t);
  const v = { x: dx + 70, y: 104, zoom: 1.22 };
  const b = bounds(v, DRILL_W);
  camera(
    ctx,
    v,
    () => {
      const L = Math.floor(b.left) - 2,
        w = Math.ceil(b.right) + 2 - L;
      box(ctx, L, 0, w, 30, '#8E978C');
      box(ctx, L, 30, w, 120, '#A9B3A7');
      box(ctx, L, 12, w, 5, '#7C8A86');
      box(ctx, L, 22, w, 3, '#B0833E');
      for (let x = Math.floor(L / 60) * 60; x < L + w; x += 60) box(ctx, x, 10, 3, 18, '#6E7A76');
      box(ctx, L, 150, w, 30, '#8D928E');
      for (let x = Math.floor(L / 16) * 16; x < L + w; x += 16)
        box(ctx, x, 148, 8, 3, x % 32 ? '#2A2A2A' : HAT_B);
      // The lift Dev came out of, and the door he needs.
      box(ctx, 168, 48, 56, 100, '#8C959A');
      const open = 1 - ease(span(t, 43.2, 43.8));
      box(ctx, 172, 54, 48, 94, '#5D666C');
      box(ctx, 172, 54, 24 - open * 22, 94, '#B9C2C6');
      box(ctx, 196 + open * 22, 54, 24 - open * 22, 94, '#B9C2C6');
      box(ctx, SERVER_DOOR - 2, 58, 38, 92, '#56626A');
      const peel = t >= PEEL_S - 0.1;
      box(ctx, SERVER_DOOR, 60, 34, 90, peel ? '#1F272F' : '#6E7A80');
      if (peel) glow(ctx, SERVER_DOOR + 17, 100, 26, '#4FD1C5', 0.3);
      box(ctx, SERVER_DOOR + 2, 40, 30, 14, RED);
      write(ctx, 'SERVER', SERVER_DOOR + 17, 47, { size: 5, color: '#FFFFFF' });
      write(ctx, 'ROOM', SERVER_DOOR + 17, 52.5, { size: 5, color: '#FFFFFF' });
      box(ctx, 486, 60, 46, 14, '#3FAF6A');
      write(ctx, 'ASSEMBLY →', 509, 70, { size: 5, color: '#FFFFFF' });
      // The drill: six colleagues in hi-vis, in step, in no hurry.
      const ph = marchPhase(t);
      const coats = ['#E6D13C', '#E6C83C', '#E6D13C', '#DCC838', '#E6D13C', '#E6C83C'];
      const skins = ['#E8B998', '#8E5A3E', '#F0C8A8', '#D9A07E', '#B97C5C', '#F0C8A8'];
      for (let i = 0; i < 6; i++) {
        const f: Figure = {
          skin: skins[i],
          hair: i % 2 ? '#2A1E1C' : '#6B4A34',
          coat: coats[i],
          legs: '#4A4F58',
          build: 'adult',
          size: 1.02,
          facing: 1,
          step: ph,
          arms: [-Math.sin(ph) * 0.7, Math.sin(ph) * 0.7],
          eyes: 'open',
          mouth: 'flat',
          hairStyle: (['short', 'bob', 'bald', 'bun', 'short', 'long'] as const)[i],
        };
        const x = lineLead(t) - i * 22;
        person(ctx, x, 152, f);
        box(ctx, x - 4, 152 - 19, 8, 1, '#D8DCDE');
      }
      // The warden, whistle in, clipboard up.
      const watching = t >= PEEL_S;
      const wf: Figure = {
        skin: '#D9A07E',
        hair: '#3E2A20',
        coat: '#E6D13C',
        legs: '#3F444C',
        build: 'adult',
        size: 1.05,
        facing: -1,
        hat: 'cap',
        hatColor: '#F4F1EA',
        arms: [0.3, t > 46 && t < 46.3 ? 1.9 : 1.5],
        eyes: watching ? 'wide' : 'open',
        mouth: 'o',
      };
      person(ctx, 456, 152, wf);
      const clip = handOf(456, 152, wf);
      box(ctx, clip.x - 4, clip.y - 6, 7, 9, '#8E6A42');
      box(ctx, clip.x - 3, clip.y - 5, 5, 7, '#F4F1EA');
      box(ctx, 456 - 6, 152 - 31, 3, 2, '#C0C4C6');
      // Dev, stuck behind them, marching in step, until his door comes past.
      const inDoor = ease(span(t, PEEL_S, PEEL_S + 0.4));
      const q: Pose = {
        x: dx,
        y: 152 - inDoor * 6,
        s: 1.05 - inDoor * 0.12,
        ...(t < 43.4 ? running(seconds * 13) : marching(ph)),
        eyes: 'half',
        mouth: 'flat',
      };
      faded(ctx, 1 - span(t, PEEL_S + 0.3, PEEL_S + 0.6), () => figure(ctx, DEV, q));
    },
    { w: DRILL_W, h: H },
  );
}

// ——— The server room ———
const RACKS = [158, 190, 222, 254, 286] as const;
const SOCKET = { x: 173, y: 143 } as const;
const NOODLE = '#F0DFA0';

/** A rack of soft, twinkling LEDs; `dead` switches them off from the bottom up. */
function rack(ctx: Ctx, x: number, seconds: number, dead: number, busy: number, seed: number) {
  box(ctx, x, 30, 30, 120, '#171C22');
  box(ctx, x, 30, 2, 120, '#2B333C');
  box(ctx, x + 28, 30, 2, 120, '#2B333C');
  for (let k = 0; k < 11; k++) {
    if (seed === 0 && k >= 9) continue;
    const y = 34 + k * 10;
    box(ctx, x + 4, y, 22, 8, '#20272E');
    const off = dead > (10 - k) / 11;
    for (let j = 0; j < 3; j++) {
      const r = rand(seed * 97 + k * 13 + j * 5);
      const color = r < 0.5 ? '#4FD1C5' : r < 0.8 ? '#7BD88F' : '#F2B84B';
      const level = 0.5 + 0.5 * Math.sin(seconds * (0.6 + r * 2.2 + busy * 6) + r * 40);
      box(ctx, x + 7 + j * 5, y + 3, 2, 2, alpha(color, off ? 0.08 : 0.4 + level * 0.6));
    }
  }
}

function serverRoom(ctx: Ctx, seconds: number, o: { door: number; dead: number; busy?: number }) {
  box(ctx, 0, 0, W, 16, '#1A2129');
  box(ctx, 0, 16, W, 134, '#27313B');
  for (let x = 0; x < W; x += 36) box(ctx, x, 20, 1, 130, '#222B34');
  box(ctx, 0, 16, W, 4, '#39434D');
  line(ctx, '#2F6FB0', 1.5, [60, 20, 70, 30, 84, 21]);
  line(ctx, '#C9A33A', 1.5, [96, 20, 110, 33, 128, 21]);
  // The door, and the warm corridor beyond it when it opens.
  box(ctx, 12, 58, 42, 92, '#3F4B57');
  if (o.door > 0) {
    box(ctx, 16, 62, 34, 88, '#F3DDB0');
    glow(ctx, 33, 96, 60, SUN, 0.5 * o.door);
    const w = 30 * (1 - o.door) + 4;
    poly(ctx, '#4B5864', [16, 62, 16 + w, 60 - o.door * 5, 16 + w, 152 + o.door * 5, 16, 150]);
  } else {
    box(ctx, 16, 62, 34, 88, '#4B5864');
    box(ctx, 28, 72, 10, 14, '#6F8A96');
  }
  RACKS.forEach((x, i) => rack(ctx, x, seconds, i === 0 ? o.dead : 0, o.busy ?? 0, i));
  box(ctx, 160, 128, 26, 20, '#C5CED4');
  box(ctx, 160, 128, 26, 7, RED);
  write(ctx, 'MAIL', 173, 134, { size: 6, color: '#FFFFFF' });
  box(ctx, 169, 139, 8, 8, '#2B3238');
  box(ctx, 0, 150, W, 30, '#35404A');
  box(ctx, 0, 150, W, 1, '#4A5663');
  for (let x = 0; x < W; x += 30) box(ctx, x, 150, 1, 30, '#2E3842');
  box(ctx, 0, 164, W, 1, '#2E3842');
  glow(ctx, 238, 156, 90, '#4FD1C5', 0.12 * (1 - o.dead * 0.3));
}

/** Gord: headphones on, noodles up, eyes on his own screen. He does not look up. */
function gordAtDesk(ctx: Ctx, t: number, seconds: number, speaking: boolean) {
  box(ctx, 64, 122, 80, 4, '#59616B');
  box(ctx, 66, 126, 2, 24, '#454C55');
  box(ctx, 140, 126, 2, 24, '#454C55');
  poly(ctx, '#1A1E22', [120, 96, 140, 92, 140, 120, 120, 118]);
  poly(ctx, '#15272B', [122, 98, 138, 95, 138, 117, 122, 116]);
  for (let i = 0; i < 5; i++)
    box(ctx, 124, 100 + i * 3, 6 + ((i * 3) % 7), 1, alpha('#8EE3A8', 0.8));
  glow(ctx, 128, 106, 28, '#6FD3C0', 0.3);
  box(ctx, 128, 119, 4, 3, '#2A2F34');
  box(ctx, 104, 115, 8, 7, '#F4F1EA');
  box(ctx, 104, 117, 8, 2, RED);
  chair(ctx, 94, 150, 1.05, 0.5);
  const cyc = (seconds * 0.4) % 1;
  const lift = Math.max(
    ease(span(cyc, 0, 0.15)) * (1 - ease(span(cyc, 0.45, 0.6))),
    hump(t, SLURP_S - 0.4, SLURP_S + 0.5),
  );
  const talk = speaking && Math.sin(seconds * 23) > -0.2;
  figure(ctx, GORD, {
    x: 97,
    y: 150,
    s: 1.15,
    ...seated(seconds, 0),
    arms: [1.1, 1.8, lerp(1.2, 2.2, lift), lerp(1.9, 3.1, lift)],
    eyes: 'half',
    mouth: talk ? 'open' : lift > 0.5 ? 'o' : 'flat',
    hold: () => {
      line(ctx, '#C9A36A', 0.7, [0, 0, 4, -6]);
      line(ctx, '#C9A36A', 0.7, [1, 0, 5.5, -5]);
      if (lift > 0.4) line(ctx, NOODLE, 0.8, [4.5, -5.5, 3.5, -1, 5, 2.5]);
    },
  });
}

/** The plug and the fat blue cable, from wherever the plug is back into the rack. */
function mailCable(ctx: Ctx, plug: { x: number; y: number } | null) {
  if (!plug) {
    box(ctx, SOCKET.x - 4, SOCKET.y - 4, 8, 8, '#2F6FB0');
    line(ctx, '#2F6FB0', 3, [SOCKET.x, SOCKET.y + 4, 180, 151, 330, 153]);
    return;
  }
  line(ctx, '#2F6FB0', 3, [plug.x, plug.y, (plug.x + 190) / 2, 154, 190, 152, 330, 153]);
  box(ctx, plug.x - 4, plug.y - 4, 8, 8, '#2F6FB0');
  box(ctx, plug.x - 1, plug.y - 7, 1, 3, '#C9C9C0');
  box(ctx, plug.x + 1.5, plug.y - 7, 1, 3, '#C9C9C0');
}

const SIT_UP: Motion = { ...SLUMP, torso: 0.1, arms: [0.6, 1.4, 2.7, 3.0] };
function devServer(t: number, seconds: number): Pose | null {
  if (t < BURST_S) return null;
  if (t < 49.2)
    return {
      x: 36,
      y: 164,
      s: 1.1,
      ...STILL,
      arms: [2.5, 2.9, 2.3, 2.8],
      eyes: 'wide',
      mouth: 'open',
    };
  if (t < DIVE_S)
    return {
      x: 36 + ((t - 49.2) / (DIVE_S - 49.2)) * 76,
      y: 164,
      s: 1.1,
      ...running(seconds * 13),
      eyes: 'wide',
      mouth: 'open',
    };
  const reach: Motion = { ...DIVE, spin: 1.35, drop: 6 };
  if (t < 52.9) {
    const k = span(t, DIVE_S, 52.9);
    return {
      x: lerp(112, 150, k),
      y: lerp(164, 152, k) - Math.sin(k * Math.PI) * 12,
      s: lerp(1.1, 1, k),
      ...blend(running(seconds * 13), reach, ease(k * 2)),
      eyes: 'wide',
      mouth: 'grit',
    };
  }
  if (t < YANK_S) return { x: 150, y: 152, ...reach, eyes: 'wide', mouth: 'grit' };
  const k = ease(span(t, YANK_S, YANK_S + 0.45));
  return {
    x: lerp(150, 140, k),
    y: 152,
    ...blend(reach, SIT_UP, k),
    torso: lerp(0, 0.1 + Math.sin(seconds * 7) * 0.05, k),
    eyes: 'wide',
    mouth: 'open',
  };
}

function serverShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [48.5, 124, 104, 1.3],
    [51.2, 132, 108, 1.3],
    [52.9, 160, 124, 1.6],
    [54, 158, 126, 1.66],
  ]);
  const door =
    t < BURST_S ? 0 : easeOut(span(t, BURST_S, BURST_S + 0.2)) * (1 - ease(span(t, 50.2, 50.8)));
  camera(ctx, view, () => {
    serverRoom(ctx, seconds, { door, dead: span(t, YANK_S, YANK_S + 0.7) });
    gordAtDesk(ctx, t, seconds, within(t, 49.4, 50.6));
    const q = devServer(t, seconds);
    mailCable(ctx, q && t >= YANK_S ? handAt(q) : null);
    if (q) figure(ctx, DEV, q);
    if (t >= YANK_S && t < YANK_S + 0.4)
      glow(ctx, SOCKET.x, SOCKET.y, 14, '#FFFFFF', 0.4 * (1 - span(t, YANK_S, YANK_S + 0.4)));
  });
}

/** The CEO, as a shadow on the racks, party hat and all. */
function ceoShadow(ctx: Ctx, x: number, amount: number) {
  if (amount <= 0) return;
  const S = '#0B0E14';
  faded(ctx, amount * 0.6, () => {
    person(ctx, x, 150, {
      skin: S,
      hair: S,
      coat: S,
      legs: S,
      shoes: S,
      build: 'adult',
      size: 1.6,
      facing: 1,
      blush: false,
      eyes: 'closed',
      mouth: 'none',
      arms: [0.1, 0.9],
    });
    poly(ctx, S, [x - 6, 150 - 38 * 1.6 + 1, x + 8, 150 - 38 * 1.6, x + 2, 150 - 38 * 1.6 - 18]);
  });
}

function slumpShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [56.5, 168, 128, 1.85],
    [60, 164, 126, 1.95],
  ]);
  const light = easeOut(span(t, DOOR_S, DOOR_S + 0.8));
  camera(ctx, view, () => {
    serverRoom(ctx, seconds, { door: light, dead: 1 });
    poly(ctx, alpha(WARM, 0.24 * light), [150, 62, 246, 52, 246, 150, 150, 150]);
    ceoShadow(ctx, 222, ease(span(t, 59.2, 59.8)));
    poly(ctx, alpha(WARM, 0.3 * light), [50, 150, 50, 180, 250, 180, 124, 150]);
    gordAtDesk(ctx, t, seconds, false);
    const breathe = Math.sin(seconds * 2.4) * 0.04;
    const woke = t >= DOOR_S + 0.3;
    const q: Pose = {
      x: 188,
      y: 153,
      s: 1.2,
      facing: -1,
      ...SLUMP,
      torso: SLUMP.torso + breathe + ease(span(t, 56.5, 57.2)) * -0.1,
      nod: woke ? -0.1 : 0.35,
      eyes: woke ? 'wide' : 'closed',
      mouth: woke ? 'flat' : 'o',
    };
    mailCable(ctx, handAt(q));
    figure(ctx, DEV, q);
    if (light > 0) glow(ctx, 170, 138, 50, WARM, 0.2 * light);
  });
}

/** The boss in the doorway, backlit, phone in hand. */
function doorwayShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [60, 160, 92, 1],
    [63, 160, 94, 1.08],
  ]);
  camera(ctx, view, () => {
    box(ctx, 0, 0, W, H, '#222B34');
    box(ctx, 108, 14, 104, 166, '#EFD7A8');
    box(ctx, 108, 140, 104, 40, '#D9C290');
    glow(ctx, 170, 40, 130, SUN, 0.55);
    poly(ctx, alpha('#FFF1CC', 0.45), [150, 14, 196, 14, 212, 128, 178, 128]);
    box(ctx, 100, 8, 8, 172, '#3F4B57');
    box(ctx, 212, 8, 8, 172, '#3F4B57');
    box(ctx, 100, 6, 120, 8, '#3F4B57');
    poly(ctx, '#4B5864', [100, 14, 84, 2, 84, 180, 100, 180]);
    poly(ctx, alpha(WARM, 0.3), [108, 172, 212, 172, 300, 180, 30, 180]);
    const tone = (c: string) => mix(c, '#3A3140', 0.25);
    const says = talking(t, 60.4, 60.9);
    figure(ctx, CEO, {
      x: 160,
      y: 176,
      s: 2.7,
      facing: 1,
      ...STILL,
      arms: [0.15, 0.3, 1.2, 2.4],
      eyes: 'half',
      mouth: says ? 'o' : 'flat',
      hat: true,
      tone,
      hold: () => {
        box(ctx, -2, -5, 4, 7, '#1F2327');
        box(ctx, -1.4, -4.3, 2.8, 5.6, '#DDF4EE');
      },
    });
    const h = handAt({ x: 160, y: 176, s: 2.7, ...STILL, arms: [0.15, 0.3, 1.2, 2.4] });
    glow(ctx, h.x, h.y - 3, 22, '#DDF4EE', 0.3);
  });
  void seconds;
}

/** Background for close-ups in the server room: racks, and warm light from the door. */
function serverBackdrop(ctx: Ctx, seconds: number, warm: number, busy = 0) {
  box(ctx, 0, 0, W, H, '#232C35');
  for (const [x, i] of [
    [196, 2],
    [236, 3],
    [276, 4],
    [-8, 1],
  ] as const)
    rack(ctx, x, seconds, 0, busy, i);
  glow(ctx, 0, 90, 230, WARM, 0.35 * warm);
}

function gulpShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [63, 160, 92, 1],
    [65, 160, 90, 1.1],
  ]);
  const gulp = hump(t, 63.5, 63.9);
  camera(ctx, view, () => {
    serverBackdrop(ctx, seconds, 1);
    portrait(ctx, DEV, 160, 106 + gulp * 1.5, 1.55, {
      eyes: 'wide',
      look: [-0.9, -0.7],
      raise: 0.7,
      brows: -0.6,
      mouth: 'grit',
      sweat: 0.4 + span(t, 63, 65) * 0.6,
      turn: -0.35,
      key: WARM,
      keyX: -22,
      keyAmount: 0.4,
      glint: SUN,
    });
  });
}

function ceoShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [65, 160, 92, 1],
    [67.2, 160, 92, 1.02],
    [69.5, 158, 96, 1.16],
  ]);
  const crumple = ease(span(t, 67.6, 68.6));
  const relief = ease(span(t, 68.8, 69.5));
  const warm = ease(span(t, 67.4, 69.5));
  const says = talking(t, 65.4, 66.4);
  camera(ctx, view, () => {
    box(ctx, 0, 0, W, H, '#222B34');
    box(ctx, 92, 0, 136, 180, mix('#E9CF9C', '#F6DEAA', warm));
    glow(ctx, 160, 30, 150, SUN, 0.5 + warm * 0.25);
    box(ctx, 86, 0, 8, 180, '#3F4B57');
    box(ctx, 226, 0, 8, 180, '#3F4B57');
    portrait(ctx, CEO, 160, 102, 1.55, {
      eyes: crumple > 0.5 ? 'glassy' : 'half',
      look: [0.5, 0.6],
      arch: t >= 65.4 ? (1 - crumple) * ease(span(t, 65.4, 65.8)) : 0,
      brows: -crumple,
      raise: crumple * 0.5,
      mouth: says ? 'o' : relief > 0.5 ? 'smile' : crumple > 0.3 ? 'wobble' : 'flat',
      tear: relief,
      turn: 0.3,
      hat: true,
      key: mix('#9FD8D0', WARM, warm),
      keyX: 20 - warm * 30,
      keyAmount: 0.3 + warm * 0.2,
    });
    bigPhone(ctx, 236, 150, 1.3, 1, seconds, false);
    hand(ctx, 236, 166, 1.2, CEO.skin, CEO.shade, 0);
  });
  veil(ctx, '#FFB35C', warm * 0.08);
}

/** Two people on the floor of the server room, in a slab of morning sun. */
function sunShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [69.5, 160, 92, 1],
    [75, 162, 96, 1.08],
  ]);
  const hatK = ease(span(t, HAT_S, HAT_S + 0.5));
  const moved = t >= HAT_S;
  const thanks = t >= 72.5;
  camera(ctx, view, () => {
    serverBackdrop(ctx, seconds, 1);
    poly(ctx, alpha(SUN, 0.26), [0, 0, 110, 0, 320, 150, 320, 180, 40, 180, 0, 120]);
    for (let i = 0; i < 14; i++) {
      const u = (rand(i * 3.1) + seconds * (0.02 + rand(i) * 0.02)) % 1;
      box(
        ctx,
        40 + u * 220 + Math.sin(seconds + i) * 4,
        20 + rand(i * 7.7) * 130,
        1,
        1,
        alpha('#FFF6DA', 0.7 * Math.sin(u * Math.PI)),
      );
    }
    const says = talking(t, 69.9, 71.8) || talking(t, 72.6, 73.3);
    portrait(ctx, CEO, 104, 108, 1.08, {
      eyes: thanks ? 'happy' : 'glassy',
      look: t < 71 ? [0.2, 0.8] : [1, 0.1],
      brows: thanks ? 0 : -0.5,
      raise: 0.3,
      mouth: says ? 'o' : 'smile',
      tear: thanks ? 0 : 0.6,
      turn: 0.45,
      hat: !moved,
      key: WARM,
      keyX: -18,
      keyAmount: 0.45,
    });
    const surprised = within(t, HAT_S + 0.4, HAT_S + 0.9);
    portrait(ctx, DEV, 222, 112, 1.08, {
      eyes: surprised ? 'wide' : thanks ? 'happy' : 'open',
      look: [-1, 0],
      brows: thanks ? -0.5 : -0.2,
      raise: thanks ? 0.5 : 0.2,
      mouth: thanks ? 'smile' : t < 71 ? 'o' : 'flat',
      turn: -0.4,
      hat: t >= HAT_S + 0.5,
      key: WARM,
      keyX: -20,
      keyAmount: 0.4,
      glint: SUN,
    });
    if (moved && hatK < 1) {
      const x = lerp(104 + 6, 222 + 2, hatK),
        y = lerp(108 - 22 * 1.08, 112 - 22 * 1.08, hatK) - Math.sin(hatK * Math.PI) * 26;
      partyHat(ctx, x, y, 1.08, lerp(0.14, 0.1, hatK) + Math.sin(hatK * Math.PI) * 0.5);
      hand(ctx, x, y + 4, 1.05, CEO.skin, CEO.shade, 0.2);
    }
    if (thanks && !moved) hand(ctx, 190, 170, 1.05, CEO.skin, CEO.shade, -0.3);
  });
  veil(ctx, '#FFB35C', 0.07);
}

// ——— The four hundredth inbox ———
const GORD_QUOTE = 'Dev: The CEO sang like a fax...';
function gordReply(t: number) {
  const n = GORD_KEYS.filter((k) => k <= t).length;
  return n <= REPLY1.length
    ? REPLY1.slice(0, n)
    : `${REPLY1}\n${REPLY2.slice(0, n - REPLY1.length)}`;
}
/** Gord's screen, in dark mode, of course. */
function gordMail(t: number): Mail {
  const inbox = { dark: true, subject: 'Inbox', from: 'G', quote: 'No new mail.', typed: '' };
  if (t < PLUG_S) return { ...inbox, banner: 'OFFLINE', bannerColor: '#E0A33A' };
  if (t < MAIL_S) return { ...inbox, banner: 'BACKUP LINE: ON', bannerColor: '#5FBF7F' };
  if (t < 76.35) return { ...inbox, toast: span(t, MAIL_S, MAIL_S + 0.25) };
  if (t < 77.5)
    return {
      dark: true,
      subject: DEV_MAIL.subject,
      from: 'D',
      quote: 'Dev, to 400 recipients:',
      typed: `${LINE1}\n${LINE2}`,
      muted: true,
    };
  const aim = ease(span(t, 78.75, 78.95));
  return {
    dark: true,
    subject: 'RE: RE: Karaoke night!!',
    from: 'D',
    quote: GORD_QUOTE,
    typed: gordReply(t),
    caret: t < 78.75,
    hover: aim > 0.9 ? 2 : 0,
    press: t >= REPLY_S ? 2 : 0,
    cursor: t >= 78.7 ? [lerp(290, ALL_AT[0], aim), lerp(160, ALL_AT[1], aim)] : undefined,
  };
}

function gordShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [75, 160, 90, 1],
    [77.3, 160, 90, 1.02],
    [78.3, 232, 64, 1.75],
    [79.4, 232, 64, 1.8],
  ]);
  const snort = span(t, SNORT_S, SNORT_S + 0.9);
  const typing = within(t, 77.55, 78.8);
  camera(ctx, view, () => {
    serverBackdrop(ctx, seconds, 0.3);
    glow(ctx, 200, 70, 150, '#6FD3C0', 0.18);
    portrait(ctx, GORD, 80, 92, 1.2, {
      eyes: t < MAIL_S ? 'half' : t < SNORT_S ? 'open' : t < SNORT_S + 0.5 ? 'squeeze' : 'happy',
      look: [1, -0.1],
      raise: within(t, 76.3, SNORT_S) ? 1 : 0,
      mouth: t < MAIL_S ? 'chew' : t < SNORT_S ? 'o' : t < SNORT_S + 0.5 ? 'open' : 'grin',
      turn: 0.75,
      key: '#6FD3C0',
      keyX: 20,
      keyAmount: 0.3,
    });
    // The snort: noodles, briefly airborne.
    if (snort > 0 && snort < 1)
      for (let i = 0; i < 3; i++) {
        const x = 98 + i * 5 + snort * 26,
          y = 100 - Math.sin(snort * Math.PI) * 34 + i * 3;
        line(ctx, NOODLE, 1.4, [x, y, x + 3, y - 4, x + 6, y, x + 9, y - 4]);
      }
    if (t >= SNORT_S + 0.9) line(ctx, NOODLE, 1.4, [72, 118, 75, 121, 78, 118, 81, 122]);
    box(ctx, 0, 130, W, 50, '#4B535C');
    box(ctx, 0, 130, W, 2, '#5E6772');
    box(ctx, 146, 12, 172, 104, '#1A1E22');
    ctx.save();
    ctx.translate(150, 16);
    ctx.scale(0.51, 0.51);
    mailScreen(ctx, gordMail(t), seconds);
    ctx.restore();
    box(ctx, 222, 116, 12, 14, '#2A2F34');
    box(ctx, 172, 138, 80, 10, '#2E343A');
    for (let r = 0; r < 3; r++) box(ctx, 175, 140 + r * 2.6, 74, 1.4, '#454C55');
    box(ctx, 28, 132, 22, 18, '#F4F1EA');
    box(ctx, 28, 136, 22, 4, RED);
    const tap = within(t, PLUG_S - 0.3, PLUG_S + 0.3) || typing;
    const bob = typing ? Math.abs(Math.sin(seconds * 30)) * 3 : 0;
    if (tap) hand(ctx, 196, 140 - bob, 1.1, GORD.skin, GORD.shade, 0.2);
    else hand(ctx, 52, 138, 1.1, GORD.skin, GORD.shade, -0.3);
  });
}

function deadpanShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [DEADPAN_S, 160, 90, 1.02],
    [82.4, 160, 92, 1.1],
  ]);
  camera(ctx, view, () => {
    serverBackdrop(ctx, seconds, 0.5, 1);
    portrait(ctx, DEV, 160, 104, 1.6, {
      eyes: 'half',
      mouth: 'flat',
      hat: true,
      key: '#DDF6F0',
      keyX: 16,
      keyY: 22,
      keyAmount: 0.4,
      glint: '#DDF6F0',
    });
    bigPhone(ctx, 238, 164, 1.3, 1, seconds, within(t, 81.5, 81.8) || within(t, 81.9, 82.2));
    hand(ctx, 238, 178, 1.2, DEV.skin, DEV.shade);
  });
}

function finalShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [82.4, 160, 88, 1.25],
    [STORY, 160, 88, 1.4],
  ]);
  camera(ctx, view, () => {
    mailScreen(
      ctx,
      {
        dark: true,
        subject: 'RE: RE: Karaoke night!!',
        from: 'D',
        quote: GORD_QUOTE,
        typed: `${REPLY1}\n${REPLY2}`,
        press: 2,
      },
      seconds,
    );
    sendDialog(ctx, 1, 'about 1 minute left', '#6B7A76', span(t, 82.5, 82.85), seconds, true);
  });
}

// ——— The score ———
const ROOT = 65; // F
/** A jaunty little pizzicato tune: muzak, then a chase, then something tender. */
const THEME = [
  7,
  null,
  7,
  9,
  7,
  null,
  4,
  null,
  5,
  null,
  5,
  7,
  5,
  null,
  2,
  null,
  4,
  null,
  4,
  5,
  4,
  null,
  0,
  null,
  2,
  4,
  5,
  7,
  9,
  11,
  12,
  null,
] as const;
/** Story seconds where the music stops dead: the lift doors, the cable, the deadpan. */
const STOPS = [CLAMP_S, YANK_S, DEADPAN_S] as const;
const PINGS = [28.4, 28.9, 29.1, 29.7, 30.1] as const;

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const replyAllScore: FilmModule['score'] = (film) => {
  const story = film.duration - 6;
  const time = (s: number) => 3 + at(s) * story;
  const cues = composeFilm(
    film,
    { root: ROOT, voice: 'pluck', intro: [0, 4, 7], outro: [0, 4, 7, 12] },
    (s) => {
      const sec = (x: number) => (x * s.story) / STORY;
      // Nine a.m.: the tubes hum and the muzak plays the theme very politely.
      s.fx('hum', 0, sec(10.2), 0.035);
      s.section({
        from: 0,
        to: at(10),
        bpm: 100,
        root: ROOT,
        chords: [0, 5, 0, 7],
        melody: THEME,
        step: 1,
        voice: 'keys',
        gain: 0.42,
        level: 0.45,
        groove: 'tick',
        fade: 0.8,
      });
      KEY_TIMES.forEach((k, i) => s.fx('click', at(k), 0.06, 0.12 + rand(i * 1.9) * 0.06, 0.2));
      // Slow motion: a heartbeat, the phone buzzing, the slide, the click.
      s.fx('warp', at(10), 1.4, 0.1);
      s.note(at(10.05), ROOT - 24, sec(2.9), 'pad', 0.05);
      for (const b of [10.3, 11.0, 11.6, 12.15, 12.6]) s.note(at(b), 36, 0.3, 'kick', 0.11);
      s.fx('whir', at(BUZZ), 0.28, 0.16, 0.4);
      s.fx('whir', at(BUZZ + 0.4), 0.28, 0.16, 0.4);
      s.fx('knock', at(NUDGE), 0.12, 0.14, 0.2);
      s.fx('swish', at(12.05), 0.45, 0.05);
      s.fx('click', at(CLICK_S), 0.12, 0.42);
      // Horror.
      s.fx('gasp', at(13.9), 0.6, 0.22);
      s.chord(at(13.6), [ROOT - 12, ROOT - 9, ROOT - 6], sec(2.9), 'pad', 0.045);
      s.note(at(14.6), ROOT - 5, 0.38, 'lead', 0.07);
      s.note(at(15.0), ROOT - 6, 0.38, 'lead', 0.07);
      s.note(at(15.4), ROOT - 7, 1.1, 'lead', 0.07);
      s.fx('drip', at(15.7), 0.3, 0.08);
      // Sending… 1 of 400.
      s.fx('beep', at(POPUP), 0.12, 0.12);
      s.section({
        from: at(16.6),
        to: at(BOLT_S),
        bpm: 120,
        root: ROOT,
        minor: true,
        chords: [0],
        level: 0.55,
        groove: 'tick',
        pad: false,
        fade: 0.2,
      });
      for (let b = 17; b < BOLT_S; b += 0.5) s.fx('tick', at(b), 0.05, 0.09);
      s.fx('beep', at(18.7), 0.08, 0.07);
      // The chase: pizzicato, a key higher and a notch faster for every leg.
      s.fx('swish', at(BOLT_S), 0.45, 0.22);
      s.fx('squeak', at(BOLT_S + 0.12), 0.7, 0.12, -0.3);
      s.fx('rustle', at(BOLT_S + 0.1), 0.8, 0.1, 0.2);
      const chase = {
        chords: [0, 7, 0, 7],
        melody: THEME,
        step: 0.5,
        voice: 'pluck' as const,
        gain: 0.8,
        level: 0.72,
        groove: 'drive' as const,
        fade: 0.15,
      };
      s.section({ ...chase, from: at(BOLT_S), to: at(30.5), bpm: 132, root: ROOT });
      s.fx('crowd', at(23.9), sec(3.6), 0.07, 0.4);
      [12, 9, 7, 4, 0].forEach((d, i) =>
        s.note(at(LIMBO_S - 0.45 + i * 0.09), ROOT + d, 0.25, 'pluck', 0.07),
      );
      s.fx('swish', at(LIMBO_S - 0.3), 0.7, 0.18);
      s.fx('woo', at(LIMBO_S + 0.25), 0.8, 0.12, 0.3);
      PINGS.forEach((b, i) => {
        const pan = [0.3, 0.6, -0.15, 0.2, -0.6][i];
        s.fx('beep', at(b), 0.1, 0.08, pan);
        s.fx('beep', at(b + 0.14), 0.1, 0.07, pan);
      });
      s.section({ ...chase, from: at(30.5), to: at(38.5), bpm: 144, root: ROOT + 2 });
      s.fx('squeak', at(SKID_S), 0.45, 0.2, -0.1);
      s.fx('swish', at(SKID_S + 0.2), sec(2.1), 0.12);
      s.fx('thud', at(PAPER_S), 0.4, 0.22);
      s.fx('clatter', at(PAPER_S + 0.02), 0.8, 0.14, 0.2);
      s.fx('rustle', at(PAPER_S + 0.05), 1.8, 0.14, 0.1);
      s.fx('flutter', at(PAPER_S + 0.3), 1.5, 0.05);
      for (const [b, pan] of [
        [36.2, -0.5],
        [36.5, 0.5],
      ] as const) {
        s.fx('beep', at(b), 0.1, 0.09, pan);
        s.fx('beep', at(b + 0.14), 0.1, 0.08, pan);
      }
      s.fx('gasp', at(36.7), 0.4, 0.1, -0.4);
      s.section({ ...chase, from: at(38.5), to: at(CLAMP_S), bpm: 152, root: ROOT + 4 });
      s.fx('sweep', at(38.8), 1.4, 0.06);
      s.fx('thud', at(CLAMP_S), 0.35, 0.24);
      s.fx('squeak', at(CLAMP_S + 0.15), 0.7, 0.1);
      s.fx('chime', at(DING_S), 1.2, 0.17);
      s.fx('sweep', at(DING_S + 0.05), 0.4, 0.06);
      s.fx('thud', at(41.5), 0.2, 0.12);
      s.section({
        ...chase,
        from: at(DING_S + 0.05),
        to: at(42.5),
        bpm: 152,
        root: ROOT + 4,
        fade: 0.1,
      });
      // The fire drill: the chase has to march in step.
      s.section({
        from: at(42.5),
        to: at(46.4),
        bpm: 116,
        root: ROOT + 5,
        chords: [0, 7, 0, 7],
        melody: THEME,
        step: 1,
        voice: 'lead',
        gain: 0.55,
        level: 0.7,
        groove: 'march',
        fade: 0.15,
      });
      for (let k = 0; k < 4; k++) s.fx('whistle', at(WHISTLE_S + (k * 120) / 116), 0.22, 0.08, 0.3);
      s.fx('creak', at(PEEL_S), 0.5, 0.1, 0.3);
      // The last stretch, and the outbox racing.
      s.section({
        ...chase,
        from: at(46.4),
        to: at(YANK_S),
        bpm: 168,
        root: ROOT + 5,
        gain: 0.85,
        level: 0.85,
        fade: 0.05,
      });
      s.section({
        from: at(50.4),
        to: at(YANK_S),
        bpm: 168,
        root: ROOT + 17,
        chords: [0],
        melody: THEME,
        step: 0.5,
        voice: 'bell',
        gain: 0.32,
        level: 0,
        bass: false,
        pad: false,
        fade: 0.05,
      });
      for (let b = 46.6; b < 48.5; b += 0.25) s.fx('tick', at(b), 0.04, 0.07);
      [46.8, 47.1, 47.3, 47.6, 47.8, 48.1].forEach((b, i) =>
        s.fx('beep', at(b), 0.09, 0.04, i % 2 ? 0.5 : -0.5),
      );
      s.fx('thud', at(BURST_S), 0.3, 0.2, -0.5);
      s.fx('hum', at(48.5), sec(84 - 48.5) - 0.2, 0.055);
      s.fx('squeak', at(50.7), 0.3, 0.05, -0.1);
      s.fx('swish', at(DIVE_S), 0.8, 0.2);
      s.fx('pop', at(YANK_S), 0.25, 0.32);
      s.fx('thud', at(YANK_S + 0.35), 0.35, 0.18);
      // Silence, and the server hum. Gord slurps. The door.
      s.fx('thud', at(56.9), 0.3, 0.08);
      s.fx('sweep', at(57), 1.2, 0.04);
      s.fx('squeak', at(SLURP_S), 0.35, 0.06, -0.3);
      s.fx('bubble', at(SLURP_S + 0.25), 0.3, 0.1, -0.3);
      s.fx('creak', at(DOOR_S), 1.1, 0.16, -0.5);
      s.note(at(60.4), ROOT - 24, 0.7, 'pluck', 0.12);
      s.fx('bubble', at(63.7), 0.25, 0.12);
      s.note(at(65.5), ROOT - 22, 0.7, 'pluck', 0.12);
      s.chord(at(67.6), [ROOT - 12, ROOT - 8, ROOT - 5, ROOT - 1], sec(2.2), 'pad', 0.03);
      // The turn: the theme again, slow and tender.
      s.section({
        from: at(69.3),
        to: at(75.2),
        bpm: 76,
        root: ROOT,
        chords: [0, 5, 0, 7],
        melody: THEME,
        step: 1,
        voice: 'bell',
        gain: 0.5,
        level: 0.5,
        fade: 1.2,
      });
      s.fx('swish', at(HAT_S), 0.4, 0.06);
      s.fx('pop', at(HAT_S + 0.5), 0.15, 0.08);
      s.fx('chime', at(HAT_S + 0.5), 1, 0.06);
      // Gord.
      s.section({
        from: at(75.2),
        to: at(STORM_S),
        bpm: 120,
        root: ROOT,
        chords: [0, 7],
        melody: [0, null, null, null, 7, null, null, null, 5, null, null, null, 4, null, 2, null],
        step: 0.5,
        voice: 'pluck',
        gain: 0.55,
        level: 0.35,
        groove: 'tick',
        pad: false,
        fade: 0.2,
      });
      s.fx('click', at(PLUG_S), 0.08, 0.2);
      s.fx('beep', at(PLUG_S + 0.12), 0.1, 0.06);
      s.fx('chime', at(MAIL_S), 0.8, 0.12);
      s.fx('sneeze', at(SNORT_S - 0.33), 0.5, 0.12);
      s.fx('boing', at(SNORT_S), 0.5, 0.12);
      s.fx('bubble', at(SNORT_S + 0.1), 0.3, 0.1);
      for (const k of GORD_KEYS) s.fx('click', at(k), 0.05, 0.1, 0.2);
      s.fx('click', at(REPLY_S), 0.12, 0.38);
      // The storm: four hundred phones and the chase theme flat out.
      s.section({
        ...chase,
        from: at(STORM_S),
        to: at(DEADPAN_S),
        bpm: 184,
        root: ROOT,
        gain: 0.8,
        level: 0.8,
        fade: 0.05,
      });
      s.fx('crowd', at(STORM_S), sec(1.8), 0.12);
      for (let i = 0; i < 16; i++)
        s.fx('beep', at(STORM_S + i * 0.1 + rand(i) * 0.05), 0.09, 0.06, (rand(i * 7) - 0.5) * 1.4);
      s.fx('clatter', at(STORM_S + 0.4), 0.6, 0.08);
      // Deadpan. Then the button.
      s.fx('whir', at(81.5), 0.28, 0.12, 0.4);
      s.fx('whir', at(81.9), 0.28, 0.12, 0.4);
      s.fx('beep', at(82.5), 0.12, 0.12);
      s.note(at(82.85), ROOT + 7, 0.3, 'pluck', 0.12);
      s.note(at(83.2), ROOT, 0.9, 'pluck', 0.14);
      s.note(at(83.2), ROOT - 24, 0.9, 'bass', 0.12);
    },
  );
  // Hard stops: any note still ringing across a stop is cut off right on it.
  return cues.map((cue) => {
    if (cue.kind !== 'note') return cue;
    for (const stop of STOPS) {
      const cut = time(stop);
      if (cue.at < cut && cue.at > cut - 4 && cue.at + cue.duration > cut)
        return { ...cue, duration: cut - cue.at + 0.02 };
    }
    return cue;
  });
};

// ——— Putting it on screen ———
const LINES: readonly (readonly [number, number, string])[] = [
  [49.3, 52.1, 'Ticket number?'],
  [60.3, 62.9, 'Dev.'],
  [65.4, 68, 'A fax machine?'],
  [69.8, 72.4, 'Eleven years, everyone said ‘lovely’.'],
  [72.5, 75, 'Thank you, Dev.'],
];
function scene(t: number) {
  let i = 0;
  while (i + 1 < CUTS.length && t >= CUTS[i + 1]) i++;
  return { index: i, from: CUTS[i], to: CUTS[i + 1] ?? STORY };
}

function screenShot(ctx: Ctx, t: number, seconds: number) {
  const view = track(t, [
    [4.5, 160, 90, 1.05],
    [10, 150, 96, 1.16],
  ]);
  const text = typed(t);
  const pointing = span(t, 9.25, 9.9);
  camera(ctx, view, () =>
    mailScreen(
      ctx,
      {
        ...DEV_MAIL,
        typed: text,
        caret: true,
        hover: pointing >= 1 ? 1 : 0,
        cursor:
          t >= 9.2
            ? [lerp(262, REPLY_AT[0], ease(pointing)), lerp(160, REPLY_AT[1], ease(pointing))]
            : undefined,
      },
      seconds,
    ),
  );
}

function dialogShot(
  ctx: Ctx,
  t: number,
  seconds: number,
  from: number,
  to: number,
  frozen = false,
) {
  const view = track(t, [
    [from, 160, 90, 1.2],
    [to, 160, 88, 1.4],
  ]);
  camera(ctx, view, () => {
    mailScreen(ctx, { ...DEV_MAIL, typed: `${LINE1}\n${LINE2}`, press: 2 }, seconds);
    if (frozen) sendDialog(ctx, 399, 'Connection lost', RED, 1, seconds, false);
    else
      sendDialog(
        ctx,
        sent(t),
        'about 1 minute left',
        '#6B7A76',
        span(t, POPUP, POPUP + 0.35),
        seconds,
        true,
      );
  });
}

export const replyAll: FilmModule = {
  draw(ctx, p, seconds) {
    const t = p * STORY;
    const { index, from, to } = scene(t);
    if (index === 0)
      camera(
        ctx,
        track(t, [
          [0, 160, 90, 1],
          [0.6, 160, 90, 1],
          [4.5, 152, 115, 1.38],
        ]),
        () => office(ctx, t, seconds, 'calm'),
      );
    else if (index === 6)
      camera(
        ctx,
        track(t, [
          [19, 168, 127, 1.7],
          [20, 172, 127, 1.7],
          [22.5, 226, 127, 1.7],
        ]),
        () => office(ctx, t, seconds, 'bolt'),
      );
    else if (index === 8)
      camera(
        ctx,
        track(t, [
          [28, 200, 104, 2.1],
          [30.5, 222, 102, 2.3],
        ]),
        () => office(ctx, t, seconds, 'after'),
      );
    else if (index === 22)
      camera(
        ctx,
        track(t, [
          [STORM_S, 160, 90, 1],
          [DEADPAN_S, 160, 96, 1.08],
        ]),
        () => office(ctx, t, seconds, 'storm'),
      );
    else if (index === 1) screenShot(ctx, t, seconds);
    else if (index === 2)
      camera(
        ctx,
        track(t, [
          [10, 160, 96, 1],
          [11.8, 150, 108, 1.14],
        ]),
        () => fingerShot(ctx, t, seconds),
      );
    else if (index === 3) buttonsShot(ctx, t, seconds);
    else if (index === 4) horrorShot(ctx, t, seconds);
    else if (index === 10) gossipShot(ctx, t, seconds);
    else if (index === 7) cakeShot(ctx, t, seconds);
    else if (index === 9) skidShot(ctx, t, seconds);
    else if (index === 11) liftShot(ctx, t, seconds);
    else if (index === 12) drillShot(ctx, t, seconds);
    else if (index === 14) serverShot(ctx, t, seconds);
    else if (index === 15) dialogShot(ctx, t, seconds, from, to, true);
    else if (index === 16) slumpShot(ctx, t, seconds);
    else if (index === 17) doorwayShot(ctx, t, seconds);
    else if (index === 18) gulpShot(ctx, t, seconds);
    else if (index === 19) ceoShot(ctx, t, seconds);
    else if (index === 20) sunShot(ctx, t, seconds);
    else if (index === 21) gordShot(ctx, t, seconds);
    else if (index === 23) deadpanShot(ctx, t, seconds);
    else if (index === 24) finalShot(ctx, t, seconds);
    else if (index === 5 || index === 13) dialogShot(ctx, t, seconds, from, to);
    else {
      box(ctx, 0, 0, W, H, '#16202A');
      write(ctx, `SHOT ${index}`, W / 2, H / 2, { size: 8, color: '#5AB0E0' });
    }
    vignette(ctx, 0.28);
    // Under the end card, let the last frame sink back so the words read.
    veil(ctx, '#0B0E14', ease((seconds - STORY - 3) / 0.9) * 0.45);
    // Short lines, each held at least 2.5 s, with quick fades so they are readable throughout.
    for (const [from, to, text] of LINES) caption(ctx, text, presence(t, from, to, 0.25));
  },
  score: replyAllScore,
  look: {
    shade: '#1B2A2E',
    ink: '#F4EFE2',
    accent: '#5CC8BE',
    dedication: 'for everyone who has ever hit Reply All',
  },
};
