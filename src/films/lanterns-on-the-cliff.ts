import type { FilmModule } from './types';
import { CINEMA_FILMS } from '../lib/cinema';
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
  rainfall,
  shade,
  shot,
  sky,
  span,
  starfield,
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
 * LANTERNS ON THE CLIFF
 * A storm, a fishing boat lost at sea, and a lighthouse whose lamp has just died. Rio runs
 * down into town, and every house on the Lantern Fork brings out its lantern to light the
 * way home. (Forktown's real Lantern Fork hangs a lantern for every house: this is its legend.)
 *
 * Pictures and score read the same cue list: every knock, door, and lantern that lights is a
 * shared story time, so each new lantern adds its own note to the tune as it glows.
 */

// Story seconds come from the film's listing, so the pacing follows the runtime.
const STORY = (CINEMA_FILMS.find((film) => film.artwork === 'lanterns')?.duration ?? 60) - 6;

const CUTS = [
  0, 0.075, 0.135, 0.215, 0.285, 0.365, 0.395, 0.43, 0.452, 0.485, 0.535, 0.565, 0.63, 0.705, 0.735,
  0.755, 0.78, 0.83, 0.89, 0.93,
] as const;

// Shared cues, in story time.
const PUSH_OFF = 0.028,
  WAVE_UP = 0.046;
const LAMP_ON = 0.152,
  SPUTTER = 0.293,
  DIE = 0.318,
  DARK = 0.34,
  JAM = 0.322;
const WRENCH = [0.344, 0.352, 0.36] as const;
const GRAB = 0.41;
const KNOCKS = [0.503, 0.51, 0.517] as const;
const DOOR = 0.524;
const NOD = 0.545;
const DOORS = [0.574, 0.584, 0.594, 0.604] as const;
/** When each neighbour's lantern lights: two per house, one after the other. */
const FOLK_LIT = [0.556, 0.568, 0.579, 0.583, 0.589, 0.593, 0.599, 0.603, 0.609, 0.613] as const;
const SEES = 0.727,
  FOGHORN = 0.757,
  TURN = 0.762;
const BUMP = 0.826,
  HUG = 0.848,
  CHEER = 0.856,
  TOLL = 0.862;
const RELIGHT = 0.897;

const WARM = '#F6B94F';
const FLAME = '#FFE7A6';
const INK = '#07090C';

// ——— The family and the neighbours ———
const rio = (over: Partial<Figure> = {}): Figure => ({
  skin: '#C98E66',
  hair: '#3A2622',
  coat: '#3E9E5C',
  legs: '#2F3A4C',
  shoes: '#E4B63E',
  hat: 'hood',
  hatColor: '#3E9E5C',
  ...over,
});
const tomas = (over: Partial<Figure> = {}): Figure => ({
  skin: '#DDA886',
  hair: '#EDE8DE',
  coat: '#2B3D68',
  legs: '#3A3540',
  shoes: '#2A2226',
  build: 'adult',
  hat: 'cap',
  hatColor: '#1F2B4A',
  ...over,
});
const ada = (over: Partial<Figure> = {}): Figure => ({
  skin: '#C98E66',
  hair: '#2E1E1C',
  coat: '#D9412F',
  legs: '#A8342A',
  shoes: '#2A2226',
  build: 'adult',
  hairStyle: 'bun',
  hat: 'brim',
  hatColor: '#E8B63A',
  ...over,
});
const FOLK: readonly Figure[] = [
  {
    skin: '#E8B894',
    hair: '#7A4A2E',
    coat: '#B5654A',
    legs: '#3A3442',
    build: 'adult',
    hairStyle: 'bob',
  },
  {
    skin: '#F2CDB0',
    hair: '#E0C070',
    coat: '#4C6E9E',
    legs: '#383846',
    hat: 'beanie',
    hatColor: '#E3B23C',
  },
  {
    skin: '#8A5A42',
    hair: '#1E1A1E',
    coat: '#4F7A86',
    legs: '#35323E',
    build: 'adult',
    hat: 'cap',
    hatColor: '#34303A',
  },
  { skin: '#B77B5A', hair: '#2B2026', coat: '#E98FA0', legs: '#4A3F5A', hairStyle: 'pigtails' },
  {
    skin: '#F0C8A8',
    hair: '#B6663E',
    coat: '#6B5AA0',
    legs: '#2F2C3A',
    build: 'adult',
    hairStyle: 'bun',
  },
  {
    skin: '#D9A07A',
    hair: '#4A3226',
    coat: '#C9A04A',
    legs: '#3B4660',
    build: 'adult',
    hat: 'beanie',
    hatColor: '#A8423A',
  },
  {
    skin: '#E2B08E',
    hair: '#C9C4BD',
    coat: '#6E7F6A',
    legs: '#3C3A44',
    build: 'adult',
    hairStyle: 'bald',
  },
  {
    skin: '#7A4E3A',
    hair: '#15110F',
    coat: '#8C4A6A',
    legs: '#2E2A36',
    build: 'adult',
    hairStyle: 'long',
  },
  {
    skin: '#C08B64',
    hair: '#5A3A2A',
    coat: '#7A6A58',
    legs: '#35323E',
    build: 'adult',
    hat: 'brim',
    hatColor: '#4A3E36',
  },
  {
    skin: '#E6B899',
    hair: '#8A8A8A',
    coat: '#A05A3A',
    legs: '#3A3442',
    build: 'adult',
    hat: 'hood',
    hatColor: '#5A7A9A',
  },
];

/** Grandpa's white beard, drawn in the same frame as the kit's head so it follows leans. */
function beard(ctx: Ctx, x: number, y: number, f: Figure) {
  const adult = f.build === 'adult';
  const leg = adult ? 11 : 6,
    torso = adult ? 13 : 9;
  const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((f.facing ?? 1) * (f.size ?? 1), f.size ?? 1);
  ctx.translate(0, f.sitting ? -4 : -leg - bob);
  ctx.rotate(f.lean ?? 0);
  const top = -torso - 11,
    white = '#F3F0EA';
  box(ctx, -2, top + 6, 2, 5, white);
  box(ctx, 1, top + 7, 5, 1, white);
  box(ctx, -1, top + 10, 7, 3, white);
  box(ctx, 0, top + 13, 5, 1, white);
  ctx.restore();
}

/** A little house lantern hanging from (x, y); `lit` blooms its flame and glow. */
function lantern(ctx: Ctx, x: number, y: number, lit: number, k = 1, sway = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  ctx.scale(k, k);
  if (lit > 0) glow(ctx, 0, 6, 22, WARM, 0.55 * lit);
  box(ctx, -1, -1, 3, 2, '#2A2226');
  poly(ctx, '#3A2E2A', [-3, 3, 0, 1, 3, 3]);
  box(ctx, -3, 3, 7, 1, '#3A2E2A');
  box(ctx, -2, 4, 5, 5, lit > 0 ? mix('#5C5048', '#FFD983', lit) : '#5C5048');
  if (lit > 0) box(ctx, 0, 5, 1, 3, alpha('#FFF6D8', lit));
  box(ctx, -3, 9, 7, 1, '#3A2E2A');
  ctx.restore();
}

/** Ada's little red boat; (x, y) is the waterline. `turn` is 1 bow-right, -1 bow-left. */
function boat(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  turn: number,
  tilt: number,
  light: number,
  crew?: () => void,
) {
  const facing = turn < 0 ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(s * facing * Math.max(0.06, Math.abs(turn)), s);
  box(ctx, 10, -38, 2, 30, '#5A4632');
  box(ctx, 5, -31, 10, 1, '#5A4632');
  crew?.();
  box(ctx, -31, -9, 4, 11, '#4A3A30');
  poly(ctx, '#C8392E', [-28, -12, 31, -14, 25, 1, -22, 1]);
  poly(ctx, '#9E2A24', [-26, -4, 28, -5, 25, 1, -22, 1]);
  line(ctx, '#F1E6D2', 1.5, [-28, -12, 31, -14]);
  if (s * Math.abs(turn) > 0.55) {
    ctx.save();
    ctx.translate(12, -6);
    ctx.scale(facing, 1);
    write(ctx, 'ADA', 0, 1, { size: 6, color: '#F4EBDD' });
    ctx.restore();
  }
  box(ctx, 8, -42, 6, 5, '#3A2E2A');
  box(ctx, 9, -41, 4, 3, mix('#5C5048', '#FFE08A', light));
  if (light > 0) glow(ctx, 11, -40, 26, FLAME, 0.6 * light);
  ctx.restore();
}

function gull(ctx: Ctx, x: number, y: number, flap: number, k = 1, color = '#F4EEE4') {
  const lift = Math.sin(flap) * 2.5 * k;
  line(ctx, color, 1, [
    x - 4 * k,
    y - lift,
    x - 1.5 * k,
    y,
    x,
    y + 0.5 * k,
    x + 1.5 * k,
    y,
    x + 4 * k,
    y - lift,
  ]);
}

/**
 * The lighthouse's two beams, seen from the side: as the lens turns they swing out, shorten
 * as they point at us or away, and a soft bloom rises when one faces us. Never a flash.
 */
function beams(ctx: Ctx, x: number, y: number, seconds: number, on: number, reach: number) {
  if (on <= 0.01) return;
  const turn = seconds * 0.75;
  for (const side of [0, Math.PI]) {
    const c = Math.cos(turn + side),
      toward = Math.sin(turn + side);
    const len = reach * c;
    if (Math.abs(len) > 3) {
      const half = 2 + Math.abs(len) * 0.13,
        drop = Math.abs(len) * 0.07;
      const g = ctx.createLinearGradient(x, y, x + len, y + drop);
      g.addColorStop(0, alpha(FLAME, 0.5 * on));
      g.addColorStop(1, alpha(FLAME, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y - 1.5);
      ctx.lineTo(x + len, y + drop - half);
      ctx.lineTo(x + len, y + drop + half);
      ctx.lineTo(x, y + 1.5);
      ctx.closePath();
      ctx.fill();
    }
    if (toward > 0) glow(ctx, x, y, 8 + reach * 0.08, FLAME, on * 0.4 * toward ** 3);
  }
  glow(ctx, x, y, 6 + reach * 0.03, FLAME, 0.7 * on);
}

/** The height of a rolling swell at x, shared by the water and anything floating on it. */
const swellY = (x: number, seconds: number, y: number, amp: number, k: number, speed: number) =>
  y +
  Math.sin(x * k + seconds * speed) * amp +
  Math.sin(x * k * 2.3 + seconds * speed * 1.7 + 1) * amp * 0.35;
function swell(
  ctx: Ctx,
  seconds: number,
  y: number,
  amp: number,
  color: string,
  { k = 0.05, speed = 1, crest = '', left = -8, right = W + 8, bottom = H } = {},
) {
  const points: number[] = [];
  for (let x = left; x <= right; x += 8) points.push(x, swellY(x, seconds, y, amp, k, speed));
  poly(ctx, color, [...points, right, bottom, left, bottom]);
  if (crest) line(ctx, crest, 1, points);
}

/** A distant figure: a dark little silhouette with a lantern glowing at its side. */
function walker(ctx: Ctx, x: number, y: number, lit: number, seconds: number, i: number, k = 1) {
  const bob = Math.abs(Math.sin(seconds * 8 + i)) * 0.6 * k;
  box(ctx, x - k, y - 5 * k - bob, 2 * k, 5 * k, '#15171E');
  box(ctx, x - k, y - 7.5 * k - bob, 2 * k, 2 * k, '#23242C');
  const lx = x + 1.8 * k,
    ly = y - 3 * k - bob;
  glow(ctx, lx, ly, 10 * k, WARM, 0.6 * lit);
  box(ctx, lx - 0.5, ly - 0.5, Math.max(1, k), Math.max(1, k), mix('#6B5A40', '#FFE6A0', lit));
}

function gear(ctx: Ctx, x: number, y: number, r: number, turn: number, color: string) {
  const teeth = Math.round(r * 1.1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  for (let i = 0; i < teeth; i++) {
    ctx.save();
    ctx.rotate((i / teeth) * TAU);
    box(ctx, -1, -r - 2, 3, 3, color);
    ctx.restore();
  }
  disc(ctx, 0, 0, r, color);
  box(ctx, -r + 1, -0.5, r * 2 - 2, 1, mix(color, '#1A1614', 0.3));
  box(ctx, -0.5, -r + 1, 1, r * 2 - 2, mix(color, '#1A1614', 0.3));
  disc(ctx, 0, 0, r * 0.35, mix(color, '#1A1614', 0.45));
  ctx.restore();
}

/** Point at distance d along a polyline. */
function along(points: readonly number[], d: number) {
  for (let i = 0; i + 3 < points.length; i += 2) {
    const x0 = points[i],
      y0 = points[i + 1],
      x1 = points[i + 2],
      y1 = points[i + 3];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (d <= len || i + 4 >= points.length) {
      const t = clamp(d / len);
      return { x: lerp(x0, x1, t), y: lerp(y0, y1, t) };
    }
    d -= len;
  }
  return { x: points[0], y: points[1] };
}
const lengthOf = (points: readonly number[]) => {
  let total = 0;
  for (let i = 0; i + 3 < points.length; i += 2)
    total += Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
  return total;
};

// ——— Light and weather ———
/** The colour script: golden dusk, then storm night, then a clear starry night. */
function weather(p: number) {
  return {
    dusk: ease(span(p, 0.1, 0.2)),
    storm: ease(span(p, 0.14, 0.205)) * (1 - ease(span(p, 0.845, 0.92))),
    rain: ease(span(p, 0.16, 0.2)) * (1 - ease(span(p, 0.84, 0.88))),
  };
}
type Weather = ReturnType<typeof weather>;
const tone = (w: Weather, gold: string, night: string, storm: string) =>
  mix(mix(gold, night, w.dusk), storm, w.storm);

/** The great lamp: lit at dusk, a gentle sputter, a slow fade, and a wobbly relight. */
function lampLevel(p: number) {
  if (p >= RELIGHT)
    return clamp(
      ease(span(p, RELIGHT, RELIGHT + 0.01)) * 0.55 -
        0.2 * hump(p, RELIGHT + 0.009, RELIGHT + 0.019) +
        0.45 * ease(span(p, RELIGHT + 0.016, RELIGHT + 0.03)),
    );
  const sputter =
    1 - 0.22 * hump(p, SPUTTER, SPUTTER + 0.012) - 0.3 * hump(p, SPUTTER + 0.013, DIE);
  return ease(span(p, LAMP_ON, LAMP_ON + 0.02)) * sputter * (1 - ease(span(p, DIE, DARK)));
}

function clouds(ctx: Ctx, p: number, seconds: number, w: Weather, top = 8) {
  // Warm wisps at sunset.
  if (w.dusk < 1)
    for (let i = 0; i < 4; i++)
      oval(
        ctx,
        40 + i * 80 + Math.sin(seconds * 0.05 + i) * 4,
        top + 14 + (i % 2) * 14,
        30,
        2.5,
        alpha('#F6C79A', 0.7 * (1 - w.dusk)),
      );
  // The storm bank rolls in off the sea, and at the end it breaks up and drifts away.
  const roll = ease(span(p, 0.12, 0.2)),
    gone = ease(span(p, 0.85, 0.94));
  if (roll <= 0 || gone >= 1) return;
  faded(ctx, 1 - gone, () => {
    for (let i = 0; i < 11; i++) {
      const x =
        i * 34 -
        20 +
        (1 - roll) * 300 +
        gone * (i % 2 ? 1 : -1) * 240 +
        Math.sin(seconds * 0.2 + i) * 4;
      const y = top + (i % 4) * 9;
      const c = tone(w, '#8A6A78', '#2A3446', '#29313F');
      oval(ctx, x, y, 34, 12, c);
      oval(ctx, x + 12, y - 6, 20, 9, mix(c, '#56657A', 0.3));
    }
  });
}

// ——— The harbour: one set for the wide shots, seen from the town pier ———
const HORIZON = 94;
const LAMP = { x: 62, y: 12 };
/** The cliff edge from the lighthouse down to the harbour mouth: where the lanterns stand. */
const RIDGE = [80, 49, 94, 52, 108, 58, 124, 67, 140, 77, 156, 88, 168, 97, 178, 104] as const;
/** The zigzag path from the town up to the lighthouse. */
const ZIG = [120, 146, 126, 130, 70, 118, 112, 104, 64, 90, 104, 76, 70, 62, 78, 50] as const;
const ROUTE = [...ZIG, ...RIDGE];
const LZ = lengthOf(ZIG),
  LR = lengthOf(RIDGE);
const PIER = 156;
/** The harbour set runs a little below the frame, so close shots can frame the berth high. */
const SET_H = 200;
const BERTH = { x: 178, y: 171 };
const GOLD_SKY = ['#5E5C8E', '#A9708C', '#E69468', '#F7C77A'];
const NIGHT_SKY = ['#0A1224', '#0F1C34', '#172844', '#213656'];
const STORM_SKY = ['#151B27', '#1B2331', '#212B3B', '#293545'];
const TOWN = [
  [2, 18, 16, '#B8836C'],
  [22, 18, 21, '#98A598'],
  [42, 20, 15, '#C8B08A'],
  [64, 18, 19, '#8E7F9C'],
  [84, 18, 14, '#C27A6A'],
  [104, 16, 18, '#7F9AA8'],
] as const;
/** Who waits on the pier at the end: [neighbour, x]. */
const PIER_FOLK = [
  [0, 248],
  [3, 260],
  [2, 273],
  [5, 288],
  [1, 300],
  [9, 314],
] as const;

/** How far lantern j (0 is Rio's) has come: up the zigzag, then out along the ridge. */
function lineUp(p: number, j: number) {
  const start = LZ * 0.86 * (1 - j / 10),
    end = LZ + LR * (1 - j / 10);
  return lerp(start, end, ease(span(p, 0.634 + j * 0.001, 0.686 + j * 0.0012)));
}
const bend = (t: number, a: number, b: number, c: number) =>
  (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
const depth = (y: number) => lerp(0.2, 1, clamp((y - 103) / (BERTH.y - 103)));
/** Ada's boat inside the harbour: leaving at sunset, and coming home through the mouth. */
function harbourBoat(p: number) {
  if (p < 0.135) {
    const t = ease(span(p, PUSH_OFF, 0.13));
    const y = bend(t, BERTH.y, 146, 106);
    return { x: bend(t, BERTH.x, 150, 195), y, s: depth(y) };
  }
  if (p < 0.78) return null;
  const t = ease(span(p, 0.78, BUMP));
  const y = bend(t, 102, 128, BERTH.y);
  return { x: bend(t, 195, 188, BERTH.x) - hump(p, BUMP, BUMP + 0.01) * 3, y, s: depth(y) };
}

/** A figure too far away for a face: a coat, a head, and maybe a waving arm. */
function speck(ctx: Ctx, x: number, y: number, h: number, coat: string, head: string, wave = -1) {
  box(ctx, x - 1, y - h, 2, h, coat);
  box(ctx, x - 1, y - h - 2, 2, 2, head);
  if (wave >= 0) box(ctx, x + 1, y - h - 3 + Math.round(Math.sin(wave)), 1, 3, coat);
}

function lighthouse(ctx: Ctx, x: number, base: number, w: Weather, lamp: number) {
  const white = tone(w, '#F4E8D8', '#8E96A8', '#6E7686'),
    red = tone(w, '#C8473A', '#5A2A30', '#4A262C'),
    dark = tone(w, '#3A2E2E', '#12151C', '#101318');
  poly(ctx, white, [x - 8, base, x + 8, base, x + 5, base - 30, x - 5, base - 30]);
  poly(ctx, red, [x - 7.2, base - 8, x + 7.2, base - 8, x + 6.4, base - 14, x - 6.4, base - 14]);
  poly(ctx, red, [x - 5.9, base - 20, x + 5.9, base - 20, x + 5.3, base - 26, x - 5.3, base - 26]);
  box(ctx, x - 2, base - 5, 3, 5, dark);
  box(ctx, x - 8, base - 32, 16, 2, dark);
  box(ctx, x - 4, base - 40, 8, 8, mix('#2E3440', FLAME, lamp));
  box(ctx, x - 1, base - 40, 1, 8, dark);
  poly(ctx, red, [x - 6, base - 40, x, base - 46, x + 6, base - 40]);
  disc(ctx, x, base - 47, 1.2, dark);
}

function harbour(ctx: Ctx, p: number, seconds: number) {
  const w = weather(p);
  const sun = 1 - w.dusk,
    lamp = lampLevel(p);
  sky(
    ctx,
    [0, 1, 2, 3].map((i) => tone(w, GOLD_SKY[i], NIGHT_SKY[i], STORM_SKY[i])),
    0,
    HORIZON,
  );
  const clear = (1 - w.storm) * ease(span(p, 0.84, 0.92));
  if (clear > 0)
    faded(ctx, clear, () => starfield(ctx, seconds, { count: 70, seed: 5, bottom: HORIZON - 6 }));
  if (sun > 0) {
    glow(ctx, 262, 84, 110, '#FFD88A', 0.55 * sun);
    disc(ctx, 262, 82 + span(p, 0, 0.14) * 9, 10, alpha('#FFEDB8', sun));
  }
  clouds(ctx, p, seconds, w);
  // The open sea beyond the harbour mouth.
  box(ctx, 0, HORIZON, W, 20, tone(w, '#D99A70', '#14223A', '#1B2632'));
  box(ctx, 0, HORIZON, W, 1, tone(w, '#F2C48A', '#22324C', '#2A3746'));
  if (sun > 0)
    for (let k = 0; k < 7; k++)
      box(
        ctx,
        250 + k * 2 + Math.sin(seconds * 2 + k) * 2,
        HORIZON + 2 + k * 2.4,
        24 - k * 3,
        1,
        alpha('#FFE3A6', 0.8 * sun),
      );
  const chop = (top: number, rows: number, seed: number) => {
    for (let i = 0; i < 22; i++) {
      const drift = seconds * (5 + w.storm * 12) * (i % 2 ? 1 : -1);
      const x = ((((i * 53 + seed + drift) % 340) + 340) % 340) - 10;
      box(
        ctx,
        x,
        top + ((i * 7) % rows),
        3 + w.storm * 5,
        1,
        alpha('#A9BCD0', 0.12 + 0.22 * w.storm),
      );
    }
  };
  chop(HORIZON + 3, 15, 0);
  // Out at sea, Ada's boat is only its masthead light.
  if (within(p, 0.14, 0.78)) {
    const x = 262 + span(p, 0.14, 0.4) * 24,
      y = HORIZON + 3 + Math.sin(seconds * 1.4) * 0.7;
    glow(ctx, x, y, 7, FLAME, 0.55);
    box(ctx, x, y, 1, 1, FLAME);
  }
  // Harbour water.
  box(ctx, 0, 112, W, SET_H - 112, tone(w, '#C98C6C', '#0F1A2C', '#16202B'));
  chop(116, 60, 17);
  // The breakwater on the far side of the mouth.
  const rock = tone(w, '#7A4E46', '#1A2233', '#161C25');
  poly(
    ctx,
    mix(rock, '#0B0E14', 0.15),
    [206, 114, 212, 104, 226, 101, 246, 104, 268, 100, 292, 103, 322, 100, 322, 116, 206, 116],
  );
  line(
    ctx,
    tone(w, '#B98266', '#2A3448', '#232B38'),
    1,
    [212, 104, 226, 101, 246, 104, 268, 100, 292, 103, 322, 100],
  );
  // The headland: the cliff, its grassy edge, the zigzag path, and the lighthouse on top.
  poly(ctx, rock, [-2, 46, 30, 45, 50, 47, ...RIDGE, 184, 112, 132, 146, 124, 150, -2, 150]);
  const seam = mix(rock, '#0B0E14', 0.25);
  line(ctx, seam, 1, [8, 70, 40, 76, 60, 96, 96, 112]);
  line(ctx, seam, 1, [120, 80, 140, 92, 150, 108]);
  line(ctx, seam, 1, [20, 104, 46, 112, 58, 132]);
  line(ctx, tone(w, '#8C6E56', '#2A3040', '#232833'), 1.5, ZIG);
  line(ctx, tone(w, '#8C9A4E', '#1E2C2A', '#1B2422'), 2.5, [-2, 46, 30, 45, 50, 47, ...RIDGE]);
  box(ctx, 72, 40, 16, 8, tone(w, '#E8D8C0', '#4A5060', '#3A404C'));
  poly(ctx, tone(w, '#8A4A3E', '#2A2228', '#222026'), [70, 41, 80, 34, 90, 41]);
  box(ctx, 82, 43, 3, 3, w.dusk > 0.5 ? '#F2C46A' : '#6A5A50');
  lighthouse(ctx, 62, 48, w, lamp);
  beams(ctx, LAMP.x, LAMP.y, seconds, lamp, 250);
  // The town at the foot of the cliff: its windows light up as dusk falls.
  box(ctx, 0, 146, 134, 4, tone(w, '#B98A62', '#2A2A32', '#24252C'));
  for (const [x, width, height, color] of TOWN) {
    const wall = tone(w, color, mix(color, '#0B1020', 0.72), mix(color, '#0B1020', 0.76));
    box(ctx, x, 148 - height, width, height, wall);
    poly(ctx, tone(w, '#8A4A3E', '#241E26', '#1E1B22'), [
      x - 2,
      149 - height,
      x + width / 2,
      141 - height,
      x + width + 2,
      149 - height,
    ]);
    const lit = mix('#6A5A50', '#F2C46A', w.dusk);
    box(ctx, x + width / 2 - 2, 153 - height, 4, 4, lit);
    for (let k = 0; k < 4; k++)
      box(ctx, x + width / 2 - 2, 153 + k * 5, 4, 1, alpha('#F2C46A', 0.3 * w.dusk * (1 - k / 4)));
  }
  // A little rowboat in front of the town.
  poly(ctx, tone(w, '#4F7A9A', '#1E2A3A', '#1A2430'), [52, 160, 80, 160, 76, 166, 56, 166]);
  // Lanterns: one light going down the path, then the whole town coming up it.
  if (within(p, 0.425, 0.49)) {
    const at = along(ZIG, LZ * (1 - span(p, 0.425, 0.49)));
    walker(ctx, at.x, at.y, 1, seconds, 0, 1.1);
  }
  if (p >= 0.63)
    for (let j = 10; j >= 0; j--) {
      const at = along(ROUTE, lineUp(p, j));
      walker(ctx, at.x, at.y, 1, seconds, j, 1.1);
    }
  // Rio and Grandpa wave from the cliff top at sunset; Grandpa waves again at the end.
  if (p < 0.14) {
    const wave = within(p, WAVE_UP - 0.01, 0.14) ? seconds * 9 : -1;
    speck(ctx, 78, 48, 7, '#2B3D68', '#EDE8DE', wave);
    speck(ctx, 84, 48, 5, '#3E9E5C', '#3E9E5C', wave + 1);
  }
  if (p > RELIGHT) speck(ctx, 67, 16, 5, '#2B3D68', '#EDE8DE', seconds * 7);
  harbourQuay(ctx, p, seconds, w);
}

/** The pier: Ada setting off at sunset, and the homecoming on the same boards. */
function harbourQuay(ctx: Ctx, p: number, seconds: number, w: Weather) {
  const plank = tone(w, '#9A6A48', '#3A2E2C', '#2E2628'),
    iron = tone(w, '#3A2E2E', '#15161C', '#121318');
  for (let x = 212; x < W; x += 16)
    box(ctx, x, PIER + 3, 3, SET_H - PIER, mix(plank, '#0B0E14', 0.4));
  box(ctx, 208, PIER, W - 208, 3, plank);
  box(ctx, 208, PIER + 3, W - 208, 2, mix(plank, '#0B0E14', 0.3));
  // The harbour bell swings when Ada is home.
  box(ctx, 229, PIER - 34, 2, 34, iron);
  box(ctx, 226, PIER - 34, 10, 2, iron);
  ctx.save();
  ctx.translate(234, PIER - 32);
  ctx.rotate(Math.sin(seconds * 8) * 0.4 * hump(p, TOLL - 0.004, TOLL + 0.035));
  poly(ctx, tone(w, '#D9B050', '#8A7646', '#5A4E34'), [-3, 8, -2, 1, 2, 1, 3, 8]);
  box(ctx, -1, 8, 2, 2, iron);
  ctx.restore();
  if (p < 0.075)
    for (let i = 0; i < 3; i++)
      gull(
        ctx,
        ((i * 90 + seconds * (9 + i * 3)) % 360) - 20,
        60 + i * 13 + Math.sin(seconds + i) * 3,
        seconds * 6 + i,
        1,
        '#FFF4E6',
      );
  const home = p >= 0.78,
    safe = p >= BUMP,
    cheer = p >= CHEER;
  const climb = span(p, 0.834, 0.844);
  const b = harbourBoat(p);
  const drawBoat = () => {
    if (!b) return;
    const bob = Math.sin(seconds * 1.6) * (0.6 + w.storm) * b.s;
    boat(
      ctx,
      b.x,
      b.y + bob,
      b.s,
      1,
      Math.sin(seconds * 1.3) * 0.03 * (1 + w.storm * 2),
      p > 0.5 ? 1 : ease(span(p, 0.12, 0.14)),
      climb > 0
        ? undefined
        : () => {
            const pushing = p < PUSH_OFF + 0.008,
              waving = !home && p > WAVE_UP;
            const f = ada({
              facing: waving ? -1 : 1,
              arms: pushing
                ? [0.3, 1.5]
                : waving
                  ? [0.3, 2.1 + Math.sin(seconds * 9) * 0.4]
                  : [-0.8, 0.4],
              lean: pushing ? 0.25 : waving ? -0.12 : 0,
              eyes: waving || safe ? 'happy' : home ? 'wide' : 'open',
              mouth: waving || safe ? 'grin' : 'smile',
            });
            person(ctx, -12, -3, f);
            if (pushing) {
              const hand = handOf(-12, -3, f);
              line(ctx, '#8A6A48', 1.5, [hand.x - 6, hand.y - 6, hand.x + 20, hand.y + 16]);
            } else if (!waving) {
              const hand = handOf(-12, -3, f, 'back');
              line(ctx, '#6A4E36', 2, [-29, -11, hand.x, hand.y]);
            }
          },
    );
  };
  if (!home) {
    drawBoat();
    return;
  }
  // Neighbours along the pier, lanterns up.
  PIER_FOLK.forEach(([i, x], k) => {
    const wobble = Math.sin(seconds * 6 + k * 1.7) * 0.2;
    const f: Figure = {
      ...FOLK[i],
      facing: -1,
      arms: cheer ? [2.3 + wobble, 2.8] : [0.2, 1.3],
      eyes: cheer ? 'happy' : safe ? 'open' : 'wide',
      mouth: cheer ? 'grin' : safe ? 'smile' : 'o',
    };
    person(ctx, x, PIER, f);
    const hand = handOf(x, PIER, f);
    lantern(ctx, hand.x, hand.y, 1, 1, Math.sin(seconds * 2 + k) * 0.1);
    for (let d = 0; d < 3; d++)
      box(ctx, hand.x - 1, PIER + 8 + d * 5, 3, 1, alpha(WARM, 0.35 - d * 0.1));
  });
  // Once Ada steps out, the boat sits behind her; until then she is in it, in front of the pier.
  if (climb > 0) drawBoat();
  // Rio waits by the bell, then runs to the end of the pier.
  const run = span(p, 0.836, 0.847),
    lift = ease(span(p, HUG, HUG + 0.008));
  const f = rio({
    facing: -1,
    step: run > 0 && run < 1 ? seconds * 15 : undefined,
    arms: lift > 0 ? [2.3, 2.3] : run > 0 ? [-0.5, 1.6] : [0.2, 2.6],
    eyes: lift > 0 ? 'happy' : safe ? 'wide' : 'open',
    mouth: lift > 0 || safe ? 'grin' : 'o',
  });
  const rx = lerp(240, 214, ease(run)),
    ry = PIER - lift * 7;
  if (lift > 0) lantern(ctx, 224, PIER - 10, 1);
  person(ctx, rx, ry, f);
  if (lift <= 0) {
    const hand = handOf(rx, ry, f);
    lantern(ctx, hand.x, hand.y, 1, 1, Math.sin(seconds * 3) * 0.15);
  }
  // Ada climbs up onto the pier and lifts Rio off her feet, arms around her.
  if (climb > 0 && b) {
    const ax = lerp(b.x - 10, 202, climb),
      ay = lerp(b.y - 3, PIER, easeOut(climb)) - hump(climb, 0, 1) * 6;
    person(
      ctx,
      ax,
      ay,
      ada({
        facing: 1,
        arms: lift > 0 ? [1.5, 1.75] : [0.4, 1.4],
        lean: lift > 0 ? 0.1 : 0,
        eyes: lift > 0 ? 'closed' : 'happy',
        mouth: 'grin',
      }),
    );
  } else drawBoat();
}

// ——— The cliff top at sunset: Rio and Grandpa wave Mama off ———
function cliffTop(ctx: Ctx, p: number, seconds: number) {
  const t = span(p, 0.075, 0.135);
  sky(ctx, GOLD_SKY, 0, 66);
  glow(ctx, 252, 62, 120, '#FFD88A', 0.55);
  disc(ctx, 252, 60 + t * 3, 11, '#FFEDB8');
  for (let i = 0; i < 3; i++)
    oval(
      ctx,
      50 + i * 95 + Math.sin(seconds * 0.05 + i) * 4,
      18 + (i % 2) * 16,
      34,
      2.5,
      '#F6C79A',
    );
  // The sea, far below.
  box(ctx, 0, 64, W, 3, '#F2C48A');
  sky(ctx, ['#E3A274', '#C98A6C', '#A87466'], 66, H);
  for (let k = 0; k < 9; k++)
    box(
      ctx,
      236 + Math.sin(seconds * 1.7 + k) * 3 - k,
      70 + k * 4,
      28 - k * 2,
      1,
      alpha('#FFE3A6', 0.85 - k * 0.07),
    );
  // Mama's boat heads out toward the sun, and Mama waves back.
  const bx = 236 + t * 24,
    by = 152 - t * 6;
  line(ctx, alpha('#FFF1D8', 0.55), 1, [bx - 8, by, bx - 30, by + 4]);
  line(ctx, alpha('#FFF1D8', 0.35), 1, [bx - 8, by, bx - 28, by - 3]);
  boat(ctx, bx, by, 0.34, 1, Math.sin(seconds * 1.4) * 0.04, 0, () =>
    person(
      ctx,
      -12,
      -3,
      ada({ facing: -1, arms: [0.3, 2.5 + Math.sin(seconds * 9) * 0.4], mouth: 'grin' }),
    ),
  );
  for (let i = 0; i < 3; i++)
    gull(
      ctx,
      ((i * 110 + seconds * (12 + i * 4)) % 380) - 30,
      30 + i * 16 + Math.sin(seconds * 1.3 + i) * 4,
      seconds * 7 + i * 2,
      1.3,
      '#FFF4E6',
    );
  // The cliff top, the lighthouse door, and the edge.
  poly(ctx, '#8C5A46', [196, 128, 224, 136, 218, 152, 236, 180, 200, 180]);
  poly(ctx, '#7E8C44', [0, 122, 70, 118, 150, 122, 200, 127, 224, 136, 216, 150, 230, 180, 0, 180]);
  line(ctx, '#B8B460', 2, [0, 122, 70, 118, 150, 122, 200, 127, 224, 136]);
  for (let i = 0; i < 14; i++) box(ctx, (i * 41) % 210, 132 + ((i * 17) % 40), 3, 1, '#6A7838');
  poly(ctx, '#F2E4D0', [-6, 126, 46, 126, 40, -4, 0, -4]);
  box(ctx, 34, -4, 8, 130, '#FFF1DE');
  poly(ctx, '#C8473A', [-5, 70, 44, 70, 42, 44, -3, 44]);
  box(ctx, 12, 96, 18, 30, '#5A3A2E');
  box(ctx, 14, 98, 14, 26, '#6E4636');
  box(ctx, 25, 111, 2, 2, '#E9C46A');
  // Rio and Grandpa wave from the edge.
  const wave = Math.sin(seconds * 9);
  const gf = tomas({
    size: 1.6,
    arms: [0.2, 2.1 + wave * 0.35],
    eyes: 'happy',
    mouth: 'smile',
  });
  const rf = rio({
    size: 1.8,
    arms: [2.2 - wave * 0.3, 2.0 + wave * 0.35],
    eyes: 'happy',
    mouth: 'grin',
  });
  shade(ctx, 132, 127, 24);
  shade(ctx, 170, 129, 20);
  person(ctx, 132, 127, gf);
  beard(ctx, 132, 127, gf);
  person(ctx, 170, 129, rf);
}

// ——— At sea ———
const SEA_SKY = ['#121824', '#171F2C', '#1D2634', '#232E3E'];
function seaClouds(ctx: Ctx, seconds: number, top: number) {
  for (let i = 0; i < 9; i++) {
    const x = ((((i * 47 - seconds * 16) % 380) + 380) % 380) - 30;
    oval(ctx, x, top + (i % 3) * 10, 36, 11, '#262F3E');
    oval(ctx, x + 14, top - 5 + (i % 3) * 10, 20, 8, '#2E3848');
  }
}
/**
 * Ada's boat on a rough sea. Early on she steers for the lighthouse; after the lamp dies she
 * is lost, bow out to sea, until she sees the lanterns and brings the boat round.
 */
function atSea(ctx: Ctx, p: number, seconds: number) {
  const lamp = lampLevel(p),
    late = p > 0.5;
  sky(ctx, SEA_SKY, 0, 100);
  seaClouds(ctx, seconds, 10);
  // The distant headland, its lighthouse, and later the lantern line along its edge.
  poly(ctx, '#0C1118', [-10, 100, -10, 68, 12, 64, 28, 66, 48, 76, 74, 90, 96, 99]);
  box(ctx, 18, 52, 5, 14, '#3E4452');
  box(ctx, 16, 50, 9, 2, '#23262E');
  box(ctx, 18, 45, 5, 5, mix('#262B36', FLAME, lamp));
  poly(ctx, '#23262E', [16, 45, 20.5, 41, 25, 45]);
  beams(ctx, 20.5, 47.5, seconds, lamp, 170);
  if (late)
    for (let j = 0; j <= 10; j++) {
      const at = along([28, 66, 48, 76, 74, 90, 92, 98], 76 * (1 - j / 10));
      glow(ctx, at.x, at.y - 2, 7, WARM, 0.6);
      box(ctx, at.x, at.y - 2, 1, 1, '#FFE6A0');
    }
  // Three swells, with the boat riding the middle one.
  box(ctx, 0, 98, W, H - 98, '#18232E');
  swell(ctx, seconds, 103, 1.5, '#1B2733', { k: 0.09, speed: 1.2 });
  swell(ctx, seconds, 118, 4, '#1E2C39', { k: 0.05, speed: 1.4, crest: '#3A4E60' });
  const turnT = span(p, TURN, TURN + 0.014);
  const turn = p < 0.5 ? -1 : Math.cos(ease(turnT) * Math.PI);
  const bx = 160 - ease(span(p, TURN, 0.78)) * 30;
  const at = (x: number) => swellY(x, seconds, 138, 7, 0.035, 1.6);
  const by = at(bx),
    tilt = Math.atan2(at(bx + 14) - at(bx - 14), 28);
  const looking = late && p >= SEES,
    found = late && p >= FOGHORN;
  boat(ctx, bx, by + 2, 1.5, turn, tilt, 1, () => {
    // She always faces the way she looks: home, then out to sea, then home again.
    const world = !late || looking ? -1 : 1;
    const f = ada({
      facing: (world * Math.sign(turn || 1)) as 1 | -1,
      arms: found && !turnT ? [0.3, 2.4] : [-0.8, turnT > 0 && turnT < 1 ? 1.1 : 0.4],
      lean: late && !looking ? -0.18 + Math.sin(seconds * 3) * 0.05 : 0,
      eyes: found ? 'happy' : looking ? 'wide' : late ? 'sad' : 'open',
      mouth: found ? 'grin' : looking ? 'o' : late ? 'frown' : 'flat',
    });
    person(ctx, -12, -3, f);
    const hand = handOf(-12, -3, f, 'back');
    line(ctx, '#6A4E36', 2, [-29, -11, hand.x, hand.y]);
    if (hump(p, FOGHORN, FOGHORN + 0.02) > 0) {
      // The foghorn on the mast: a brass horn and three sound arcs.
      const blow = hump(p, FOGHORN, FOGHORN + 0.02);
      poly(ctx, '#C9A04A', [12, -26, 20, -29, 20, -21, 12, -24]);
      for (let k = 0; k < 3; k++)
        box(ctx, 23 + k * 3, -27 - k, 1, 4 + k * 2, alpha('#F4EEE4', blow * (0.8 - k * 0.2)));
    }
  });
  // Spray off the bow.
  for (let k = 0; k < 6; k++) {
    const t = (seconds * 1.6 + k / 6) % 1;
    box(
      ctx,
      bx + turn * (40 + k * 3) - t * 10 * turn,
      by - 14 - Math.sin(t * Math.PI) * 14,
      1,
      1,
      alpha('#DDE8F0', 1 - t),
    );
  }
  swell(ctx, seconds, 152, 9, '#142130', { k: 0.03, speed: 1.1, crest: '#4A6072' });
  swell(ctx, seconds * 1.2, 172, 5, '#0F1822', { k: 0.045, speed: 1.3 });
}

/** Ada's view: the dark headland with a line of lanterns running down to the harbour mouth. */
function seaPov(ctx: Ctx, seconds: number) {
  sky(ctx, SEA_SKY, 0, 112);
  seaClouds(ctx, seconds, 8);
  const ridge = [60, 38, 90, 46, 130, 62, 170, 80, 206, 96, 236, 108];
  poly(ctx, '#0C1118', [-10, 120, -10, 40, 20, 36, 44, 36, ...ridge, 244, 114, 244, 120]);
  box(ctx, 34, 8, 12, 30, '#2E3440');
  box(ctx, 31, 6, 18, 2, '#1E222A');
  box(ctx, 35, -2, 10, 8, '#262B36');
  poly(ctx, '#1E222A', [33, -2, 40, -8, 47, -2]);
  poly(ctx, '#0E131A', [270, 120, 276, 106, 300, 104, 330, 108, 330, 120]);
  glow(ctx, 257, 114, 34, WARM, 0.22);
  for (let j = 10; j >= 0; j--) {
    const at = along(ridge, lengthOf(ridge) * (1 - j / 10));
    walker(ctx, at.x, at.y, 1, seconds, j, 1.7);
  }
  box(ctx, 0, 112, W, H - 112, '#16212C');
  swell(ctx, seconds, 124, 3, '#1A2733', { k: 0.07, speed: 1.3, crest: '#34485A' });
  swell(ctx, seconds, 148, 8, '#132030', { k: 0.035, speed: 1.2, crest: '#46607A' });
  swell(ctx, seconds * 1.1, 170, 6, '#0E1720', { k: 0.05, speed: 1.4 });
  // Reflections of the lanterns in the chop.
  for (let j = 0; j < 8; j++)
    box(
      ctx,
      90 + j * 18,
      128 + (j % 3) * 4 + Math.sin(seconds * 2 + j) * 1.5,
      4,
      1,
      alpha(WARM, 0.3),
    );
}

// ——— The lamp room ———
function lampRoom(ctx: Ctx, p: number, seconds: number) {
  const lamp = lampLevel(p),
    dead = span(p, DIE, DARK);
  // The storm through the glass.
  sky(ctx, ['#141B28', '#19212F', '#1F2837'], 16, 100);
  box(ctx, 0, 96, W, 22, '#0E151E');
  for (let i = 0; i < 16; i++)
    box(ctx, ((i * 43 + seconds * 9) % 330) - 10, 100 + ((i * 7) % 14), 5, 1, '#26323F');
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 16, W, 102);
  ctx.clip();
  rainfall(ctx, seconds, { amount: 0.5, color: '#4E5E74', slant: 0.3, top: 16, bottom: 118 });
  ctx.restore();
  box(ctx, 0, 0, W, 16, '#2A2428');
  box(ctx, 0, 14, W, 3, '#3A3034');
  for (let x = 24; x < W; x += 52) box(ctx, x, 16, 5, 102, '#2E282C');
  box(ctx, 0, 116, W, 5, '#4A3E3A');
  // Iron wall, floorboards.
  box(ctx, 0, 121, W, 41, '#3A3238');
  for (let x = 10; x < W; x += 26) {
    box(ctx, x, 121, 1, 41, '#302830');
    box(ctx, x + 4, 125, 1, 1, '#5A4E52');
    box(ctx, x + 4, 156, 1, 1, '#5A4E52');
  }
  box(ctx, 0, 160, W, 20, '#4A3A32');
  for (let y = 165; y < H; y += 5) box(ctx, 0, y, W, 1, '#3E3029');
  // The clockwork that turns the lens: it runs, then jams, then shudders under the wrench.
  box(ctx, 146, 100, 28, 60, '#4E4A52');
  box(ctx, 142, 98, 36, 4, '#6A6470');
  box(ctx, 132, 114, 52, 34, '#5E5040');
  box(ctx, 132, 114, 52, 2, '#8A7658');
  const pull = Math.max(...WRENCH.map((at) => hump(p, at - 0.004, at + 0.004)));
  const spin =
    Math.min(seconds, 3 + JAM * STORY) * 0.9 +
    Math.sin(seconds * 20) * 0.05 * hump(p, JAM, JAM + 0.01) +
    pull * 0.08;
  gear(ctx, 150, 128, 9, spin, '#B08A3A');
  gear(ctx, 168, 138, 6, -spin * 1.5 + 0.3, '#9A7A36');
  gear(ctx, 172, 122, 4, spin * 2.2, '#C9A04A');
  // The great lens, and the flame inside it.
  const glass = mix('#3E4C5E', '#FFD98A', lamp * 0.85);
  for (let k = 0; k < 8; k++) {
    const hw = 13 + Math.sin(((k + 0.5) / 8) * Math.PI) * 11;
    box(ctx, 160 - hw, 30 + k * 8.5, hw * 2, 7.5, glass);
    box(ctx, 160 - hw, 30 + k * 8.5, hw * 2, 1, mix(glass, '#FFFFFF', 0.3));
  }
  box(ctx, 158, 28, 4, 72, alpha('#8A6A30', 0.8));
  poly(ctx, '#B08A3A', [146, 31, 160, 21, 174, 31]);
  box(ctx, 144, 97, 32, 3, '#B08A3A');
  if (lamp > 0) {
    glow(ctx, 160, 64, 170, '#FFD27A', 0.42 * lamp);
    glow(ctx, 160, 64, 40, '#FFF1C8', 0.8 * lamp);
    oval(ctx, 160, 64, 1 + 3 * lamp, 1 + 6 * lamp, alpha('#FFF6DC', lamp));
  }
  // Grandpa tends the lamp, then fights the jammed gears with his wrench.
  const struggling = p >= DARK,
    beaten = p > 0.362;
  const gf = tomas({
    size: 1.5,
    arms: beaten
      ? [0.2, 0.5]
      : struggling
        ? [1.2, 1.35 + pull * 0.5]
        : p > DIE
          ? [0.3, 1.9]
          : [0.3, 1.2],
    lean: beaten ? 0.04 : struggling ? 0.06 + pull * 0.1 : p > SPUTTER ? -0.06 : 0,
    eyes: beaten
      ? 'sad'
      : struggling
        ? pull > 0.4
          ? 'closed'
          : 'sad'
        : p > SPUTTER
          ? 'wide'
          : 'open',
    mouth: beaten
      ? 'frown'
      : struggling
        ? pull > 0.4
          ? 'open'
          : 'frown'
        : p > SPUTTER
          ? 'o'
          : 'smile',
  });
  shade(ctx, 116, 162, 26);
  person(ctx, 116, 162, gf);
  beard(ctx, 116, 162, gf);
  if (p > DIE) {
    const hand = handOf(116, 162, gf);
    const angle = beaten ? 1.3 : -0.3 - pull * 0.4;
    const ex = hand.x + Math.cos(angle) * 11,
      ey = hand.y + Math.sin(angle) * 11;
    line(ctx, '#9AA0A8', 2, [hand.x, hand.y, ex, ey]);
    box(ctx, ex - 2, ey - 2, 4, 4, '#9AA0A8');
  }
  // Rio watches from the stair.
  const rf = rio({
    size: 1.5,
    facing: -1,
    arms: p > DIE ? [0.3, 1.1] : [0.2, 0.2],
    eyes: p > DARK ? 'sad' : p > SPUTTER ? 'wide' : 'open',
    mouth: p > DARK ? 'frown' : p > SPUTTER ? 'o' : 'smile',
  });
  shade(ctx, 214, 162, 20);
  person(ctx, 214, 162, rf);
  // When the lamp dies the room goes cold and blue; only the little house lantern stays warm.
  veil(ctx, '#0A0F1A', 0.5 * ease(dead));
  if (dead > 0) glow(ctx, 160, 50, 220, '#5A76A0', 0.14 * dead);
  box(ctx, 283, 88, 10, 2, '#2A2226');
  lantern(ctx, 290, 90, 1, 1.2);
}

// ——— At the lamp-room window, then the grab ———
const HOOK = handOf(236, 170, rio({ size: 2.6, facing: 1, arms: [0, 2.2] }));
function windowScene(ctx: Ctx, p: number, seconds: number) {
  box(ctx, 0, 0, W, H, '#161C28');
  box(ctx, 0, 170, W, 10, '#2A2224');
  const wx = 18,
    wy = 16,
    ww = 176,
    wh = 120;
  ctx.save();
  ctx.beginPath();
  ctx.rect(wx, wy, ww, wh);
  ctx.clip();
  sky(ctx, ['#0E141E', '#121A26', '#172030'], wy, 84, wx, ww);
  box(ctx, wx, 84, ww, wh - 68, '#0A1018');
  for (let i = 0; i < 10; i++)
    box(ctx, wx + ((i * 37 + seconds * 5) % ww), 90 + ((i * 9) % 40), 4, 1, '#16202C');
  // Mama's boat: one warm dot, very far out in the black.
  const dx = 70 + Math.sin(seconds * 0.7) * 0.8,
    dy = 88 + Math.sin(seconds * 1.4) * 0.8;
  glow(ctx, dx, dy, 8, FLAME, 0.5);
  box(ctx, dx, dy, 1, 1, '#FFE9B0');
  rainfall(ctx, seconds, { amount: 0.4, color: '#3E4C60', top: wy, bottom: wy + wh, slant: 0.3 });
  for (let i = 0; i < 7; i++)
    box(ctx, wx + 12 + i * 24, wy + ((seconds * (8 + i * 3) + i * 29) % wh), 1, 4, '#4A5A70');
  ctx.restore();
  box(ctx, wx - 4, wy - 4, ww + 8, 4, '#3A3034');
  box(ctx, wx - 4, wy, 4, wh, '#3A3034');
  box(ctx, wx + ww, wy, 4, wh, '#3A3034');
  box(ctx, wx + ww / 2 - 1, wy, 3, wh, '#3A3034');
  box(ctx, wx, wy + wh / 2 - 1, ww, 3, '#3A3034');
  box(ctx, wx - 8, wy + wh, ww + 16, 6, '#4A3E3A');
  // Rio: at the glass, then she turns, sees the lantern, takes it, and runs.
  const turned = p >= 0.401,
    held = p >= GRAB,
    run = span(p, 0.414, 0.43);
  const reach = within(p, 0.404, GRAB + 0.002);
  const f = rio({
    size: 2.6,
    facing: turned ? 1 : -1,
    step: run > 0 ? seconds * 15 : undefined,
    arms: run > 0 ? [-0.6, 1.1] : reach ? [0, 2.2] : turned ? [0.2, 0.4] : [1.3, 1.3],
    lean: run > 0 ? 0.2 : 0,
    eyes: reach || held ? 'open' : turned ? 'wide' : 'sad',
    mouth: reach || held ? 'flat' : turned ? 'o' : 'frown',
  });
  const x = 236 + easeIn(run) * 110;
  glow(ctx, HOOK.x, HOOK.y + 12, 90, WARM, 0.18);
  if (!held) {
    box(ctx, HOOK.x - 2, HOOK.y - 3, 14, 3, '#2A2226');
    lantern(ctx, HOOK.x, HOOK.y, 1, 2.2);
  }
  person(ctx, x, 170, f);
  if (held) {
    const hand = handOf(x, 170, f);
    lantern(ctx, hand.x, hand.y, 1, 2.2, Math.sin(seconds * 7) * 0.2 * run);
  }
}

// ——— Down the cliff path in the rain ———
const pathY = (x: number) => 30 + x * 0.375;
function runDown(ctx: Ctx, p: number, seconds: number) {
  const t = span(p, 0.452, 0.485);
  const rx = lerp(60, 262, t),
    ry = pathY(rx);
  // Far layer: the sea and the town's lights below, drifting slower than the cliff.
  sky(ctx, SEA_SKY, 0, 96);
  seaClouds(ctx, seconds, 12);
  box(ctx, 0, 96, W, H - 96, '#141E28');
  for (let i = 0; i < 14; i++)
    box(ctx, ((i * 41 + seconds * 7) % 330) - 10, 100 + ((i * 11) % 60), 5, 1, '#223040');
  for (let i = 0; i < 6; i++) {
    const x = 250 + i * 14 - t * 60,
      y = 150 + (i % 2) * 4;
    glow(ctx, x, y, 8, '#F2C46A', 0.35);
    box(ctx, x, y, 2, 2, '#F2C46A');
  }
  camera(ctx, { x: rx + 18, y: ry - 14, zoom: 2.1 }, () => {
    // The cliff wall above the path, the slope below it.
    const top: number[] = [],
      path: number[] = [];
    for (let x = -10; x <= 330; x += 10) {
      top.push(x, pathY(x) - 46 + Math.sin(x * 0.09) * 5);
      path.push(x, pathY(x));
    }
    poly(ctx, '#1A1F28', [...top, 330, pathY(330), -10, pathY(-10)]);
    for (let x = 0; x < 320; x += 23) box(ctx, x, pathY(x) - 30 + (x % 3) * 6, 6, 1, '#232A34');
    poly(ctx, '#141A1C', [...path, 330, pathY(330) + 70, -10, pathY(-10) + 70]);
    line(ctx, '#3A3A42', 3, path);
    for (let x = 4; x < 320; x += 22) {
      box(ctx, x, pathY(x) - 5, 2, 7, '#2E2622');
      line(ctx, '#3A302A', 1, [x + 1, pathY(x) - 4, x + 23, pathY(x + 22) - 4]);
    }
    for (let x = 8; x < 320; x += 13) box(ctx, x, pathY(x) + 6 + (x % 5), 2, 2, '#1E2A22');
    glow(ctx, rx + 4, ry - 8, 44, WARM, 0.32);
    const f = rio({ step: seconds * 16, arms: [-0.7, 1.0], lean: 0.18, mouth: 'flat' });
    person(ctx, rx, ry, f);
    const hand = handOf(rx, ry, f);
    lantern(ctx, hand.x, hand.y, 1, 1, Math.sin(seconds * 8) * 0.25);
  });
}

// ——— The Lantern Fork: five houses, five doors, a lantern hung by each ———
const HOUSE_X = [40, 128, 216, 304, 392] as const;
const HOUSE_COLOR = ['#5A4A4E', '#4A5552', '#5E5646', '#4E4A5E', '#5A4640'] as const;
const STREET = 158;
const doorX = (k: number) => HOUSE_X[k] + 30;
const doorAt = (k: number) => (k ? DOORS[k - 1] : DOOR);
const doorOpen = (p: number, k: number) => ease(span(p, doorAt(k), doorAt(k) + 0.006));
/** Where a neighbour's hand lands reaching back for the lantern by the door. */
const REACH_POSE: Figure = { ...FOLK[0], size: 1.3, facing: -1, arms: [-1.9, 0.3] };
const REACH = handOf(0, 0, REACH_POSE, 'back');
const rioRun = (p: number) => lerp(48, 400, span(p, 0.565, 0.63));
/** When neighbour i steps out of their door. */
const stepOut = (i: number) =>
  i === 0 ? 0.565 : i === 1 ? 0.561 : DOORS[(i >> 1) - 1] + (i % 2 ? 0.006 : 0.002);

function streetSet(ctx: Ctx, p: number, seconds: number) {
  sky(ctx, SEA_SKY, 0, 60, 0, 480);
  for (let i = 0; i < 12; i++) {
    const x = ((((i * 47 - seconds * 10) % 520) + 520) % 520) - 30;
    oval(ctx, x, 10 + (i % 3) * 9, 34, 10, '#262F3E');
  }
  HOUSE_X.forEach((hx, k) => {
    const color = HOUSE_COLOR[k],
      dx = doorX(k),
      open = doorOpen(p, k);
    box(ctx, hx, 46, 88, STREET - 46, color);
    box(ctx, hx, 46, 2, STREET - 46, mix(color, '#0B0E14', 0.3));
    box(ctx, hx + 60, 24, 8, 16, '#3A2E2E');
    poly(ctx, '#2E2226', [hx - 3, 48, hx + 44, 22, hx + 91, 48]);
    box(ctx, hx + 52, 62, 28, 28, '#2A2428');
    box(ctx, hx + 54, 64, 24, 24, '#B8894E');
    glow(ctx, hx + 66, 76, 22, '#F2C46A', 0.25);
    box(ctx, hx + 65, 64, 2, 24, '#2A2428');
    box(ctx, hx + 54, 75, 24, 2, '#2A2428');
    box(ctx, dx - 13, 102, 26, 56, '#2A2226');
    if (open > 0) {
      box(ctx, dx - 11, 104, 22, 54, '#F2B860');
      glow(ctx, dx, 132, 60, '#FFD27A', 0.45 * open);
      poly(ctx, alpha('#F6C36A', 0.28 * open), [
        dx - 11,
        STREET,
        dx + 11,
        STREET,
        dx + 24,
        H,
        dx - 24,
        H,
      ]);
    }
    box(ctx, dx - 11, 104, 22 * (1 - 0.8 * open), 54, '#5A3A2E');
    box(ctx, dx - 9, 108, 18 * (1 - 0.8 * open), 20, '#4E3228');
    if (open < 0.5) box(ctx, dx + 7, 132, 2, 2, '#E9C46A');
    // Each house's lantern waits on its bracket until someone takes it.
    const taken = k === 0 ? p >= 0.556 : open > 0.5;
    box(ctx, dx + REACH.x - 5, STREET + REACH.y - 3, 7, 2, '#2A2226');
    if (!taken) lantern(ctx, dx + REACH.x, STREET + REACH.y, 0, 1.3);
  });
  box(ctx, 88, 52, 46, 9, '#23293A');
  write(ctx, 'LANTERN FORK', 111, 59, { size: 5, color: '#E8D8B0' });
  box(ctx, 0, STREET, 480, H - STREET, '#1C2129');
  box(ctx, 0, STREET, 480, 2, '#2A303A');
  for (let i = 0; i < 30; i++)
    box(ctx, (i * 37) % 480, STREET + 6 + ((i * 11) % 14), 8, 1, '#232833');
}

/** Everyone on the street: Rio knocking, the first neighbour, then the whole procession. */
function streetFolk(ctx: Ctx, p: number, seconds: number) {
  const knock = Math.max(...KNOCKS.map((at) => hump(p, at - 0.003, at + 0.003)));
  // The neighbours, drawn back to front.
  for (let i = 9; i >= 0; i--) {
    const k = i >> 1,
      out = stepOut(i),
      dx = doorX(k);
    if (i === 0 ? doorOpen(p, 0) < 0.3 : p < out) continue;
    const lit = ease(span(p, FOLK_LIT[i], FOLK_LIT[i] + 0.005));
    if (i === 0 && p < 0.565) {
      // Framed in the doorway: sleepy, then wide awake, then a nod, then the lantern.
      const nod = hump(p, NOD, NOD + 0.005) + hump(p, NOD + 0.005, NOD + 0.01);
      const reach = within(p, 0.553, 0.565);
      const f: Figure = {
        ...(reach ? REACH_POSE : { ...FOLK[0], size: 1.3, facing: -1 }),
        arms: reach ? (p < 0.558 ? [-1.9, 0.3] : [-0.9, 0.3]) : [0.2, 0.9],
        lean: nod * 0.2,
        eyes: p < 0.541 ? 'sleepy' : nod > 0.3 ? 'closed' : p < NOD ? 'wide' : 'open',
        mouth: p < 0.541 ? 'flat' : p < NOD ? 'o' : p < 0.553 ? 'flat' : 'smile',
      };
      person(ctx, dx, STREET, f);
      if (p >= 0.552) {
        const hand = handOf(dx, STREET, f, 'back');
        lantern(ctx, hand.x, hand.y, lit, 1.3);
      }
      continue;
    }
    const stand = dx + (i % 2 ? 10 : -6);
    const trail = rioRun(p) - (26 + 15 * i);
    const following = trail > stand;
    const x = following ? trail : stand,
      y = lerp(STREET, i % 2 ? 173 : 166, ease(span(p, out, out + 0.006)));
    const swing = Math.sin(seconds * 13 + i);
    const f: Figure = {
      ...FOLK[i],
      size: 1.15,
      facing: following ? 1 : -1,
      step: following ? seconds * 13 + i : undefined,
      arms: following ? [-swing * 0.6, 1.3] : [0.2, 2.5],
      eyes: 'open',
      mouth: following ? 'flat' : 'smile',
    };
    person(ctx, x, y, f);
    const hand = handOf(x, y, f);
    lantern(ctx, hand.x, hand.y, lit, 1.15, following ? swing * 0.15 : 0);
    if (lit > 0)
      for (let d = 0; d < 3; d++)
        box(ctx, hand.x - 1, y + 3 + d * 3, 3, 1, alpha(WARM, (0.3 - d * 0.08) * lit));
  }
  // Rio: runs in, knocks, holds up her lantern, then leads the way.
  const arrive = span(p, 0.485, 0.5),
    leading = p >= 0.565;
  const f = rio({
    size: 1.4,
    facing: 1,
    step: leading || (arrive > 0 && arrive < 1) ? seconds * 15 : undefined,
    arms: leading
      ? [-Math.sin(seconds * 15) * 0.6, 2.5]
      : p >= DOOR
        ? [2.2, 0.3]
        : arrive >= 1
          ? [0.1, 1.5 + knock * 0.7]
          : [0.4, -0.6],
    lean: leading ? 0.12 : 0,
    eyes: 'open',
    mouth: leading ? 'smile' : 'flat',
  });
  const x = leading ? rioRun(p) : lerp(-12, 48, easeOut(arrive)),
    y = leading ? 170 : STREET;
  person(ctx, x, y, f);
  // She knocks with one hand and holds the lantern up with the other.
  const hand = handOf(x, y, f, leading ? 'front' : 'back');
  lantern(ctx, hand.x, hand.y, 1, 1.4, leading ? Math.sin(seconds * 7) * 0.15 : 0);
}

// ——— The lighthouse top: the lamp comes back ———
function towerTop(ctx: Ctx, p: number, seconds: number) {
  const w = weather(p),
    lamp = lampLevel(p),
    clear = ease(span(p, 0.86, 0.93));
  sky(
    ctx,
    [0, 1, 2, 3].map((i) => mix(STORM_SKY[i], NIGHT_SKY[i], clear)),
    0,
    H,
  );
  faded(ctx, clear, () => starfield(ctx, seconds, { count: 60, seed: 9, bottom: H }));
  clouds(ctx, p, seconds, w, 14);
  const cx = 150;
  glow(ctx, cx, 76, 150, FLAME, 0.3 * lamp);
  poly(ctx, '#8C94A6', [cx - 44, H + 2, cx + 44, H + 2, cx + 38, 120, cx - 38, 120]);
  poly(ctx, '#6E7688', [cx + 14, H + 2, cx + 44, H + 2, cx + 38, 120, cx + 12, 120]);
  poly(ctx, '#6A3036', [cx - 43, 176, cx + 43, 176, cx + 41, 150, cx - 41, 150]);
  // The lantern room and its lens.
  box(ctx, cx - 28, 52, 56, 48, mix('#1A2230', '#FFE3A0', lamp * 0.7));
  const glass = mix('#2E3A4A', '#FFD98A', lamp * 0.9);
  for (let k = 0; k < 5; k++) {
    const hw = 7 + Math.sin(((k + 0.5) / 5) * Math.PI) * 7;
    box(ctx, cx - hw, 58 + k * 8, hw * 2, 7, glass);
  }
  if (lamp > 0) {
    glow(ctx, cx, 76, 40, '#FFF1C8', 0.8 * lamp);
    oval(ctx, cx, 76, 1 + 3 * lamp, 1 + 5 * lamp, alpha('#FFF6DC', lamp));
  }
  for (const x of [cx - 28, cx - 10, cx + 8, cx + 25]) box(ctx, x, 52, 3, 48, '#23262E');
  poly(ctx, '#5A2A30', [cx - 34, 54, cx, 28, cx + 34, 54]);
  disc(ctx, cx, 27, 4, '#23262E');
  beams(ctx, cx, 76, seconds, lamp, 300);
  box(ctx, cx - 58, 114, 116, 6, '#1E2129');
  // Grandpa on the gallery: worried, then waving with both arms.
  const glad = lamp > 0.5,
    wave = Math.sin(seconds * 8);
  const gf = tomas({
    size: 1.5,
    facing: -1,
    arms: glad ? [2.5 + wave * 0.3, 2.8 - wave * 0.3] : [0.3, 1.0],
    eyes: glad ? 'happy' : 'wide',
    mouth: glad ? 'grin' : 'o',
  });
  person(ctx, cx + 44, 114, gf);
  beard(ctx, cx + 44, 114, gf);
  box(ctx, cx - 58, 96, 116, 2, '#2A2E38');
  for (let x = cx - 58; x <= cx + 58; x += 8) box(ctx, x, 96, 1, 18, '#2A2E38');
}

// Camera keyframes per set: [p, x, y, zoom]. Two keys at the same p are a hard cut.
const HARBOUR_CAM = [
  [0, 160, 90, 1],
  [0.012, 160, 90, 1],
  [0.032, 188, 146, 2],
  [0.075, 182, 140, 2.1],
  [0.135, 160, 90, 1],
  [0.16, 160, 90, 1],
  [0.215, 118, 72, 1.35],
  [0.43, 96, 96, 1.9],
  [0.452, 100, 102, 2],
  [0.63, 92, 102, 1.9],
  [0.662, 110, 92, 1.45],
  [0.705, 160, 90, 1],
  [0.78, 196, 112, 2.2],
  [0.83, 200, 138, 1.6],
  [0.83, 218, 128, 2.2],
  [0.89, 222, 126, 2.4],
  [0.93, 182, 104, 1.3],
  [1, 160, 90, 1],
] as const;
const CLIFF_CAM = [
  [0.075, 160, 90, 1.06],
  [0.135, 168, 96, 1.16],
] as const;
const SEA_CAM = [
  [0.215, 160, 96, 1.05],
  [0.285, 150, 104, 1.3],
  [0.705, 150, 110, 1.7],
  [0.735, 140, 104, 2],
  [0.755, 150, 106, 1.5],
  [0.78, 118, 100, 1.2],
] as const;
const LAMP_CAM = [
  [0.285, 160, 96, 1.2],
  [0.31, 160, 84, 1.45],
  [DARK, 160, 84, 1.5],
  [DARK, 142, 124, 2.1],
  [0.365, 144, 124, 2.25],
] as const;
const WINDOW_CAM = [
  [0.365, 160, 90, 1],
  [0.395, 92, 90, 1.7],
  [0.395, 205, 110, 1.35],
  [0.43, 215, 110, 1.35],
] as const;
const STREET_CAM = [
  [0.485, 96, 118, 1.5],
  [0.515, 86, 124, 1.9],
  [0.535, 86, 124, 1.9],
  [0.535, 72, 118, 3],
  [0.565, 72, 118, 3],
] as const;
const POV_CAM = [
  [0.735, 150, 90, 1],
  [0.755, 164, 92, 1.12],
] as const;
const TOWER_CAM = [
  [0.89, 160, 92, 1],
  [0.93, 160, 98, 1.1],
] as const;

/** Each new lantern adds a note: up the D major scale, one per neighbour. */
const LANTERN_NOTES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21] as const;
// The shanty in 6/8 for the harbour, and squared up to 4/4 when it turns heroic.
const SHANTY = [7, 12, 12, 14, 12, 9, 11, 9, 7, 4, 7, null] as const;
const SHANTY_MARCH = [7, 12, 12, 14, 12, 9, 14, 12, 11, 9, 7, 9, 7, 4, 7, null] as const;
const ROOT = 62; // D

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const lanternsOnTheCliffScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: ROOT, voice: 'pluck', intro: [7, 12, 14, 16], outro: [0, 7, 12, 16] },
    (s) => {
      // Sunset: a little sea shanty in 6/8, gulls and a calm sea.
      s.section({
        from: 0,
        to: 0.135,
        bpm: 132,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: SHANTY,
        voice: 'pluck',
        gain: 0.9,
        groove: 'waltz',
        level: 0.8,
      });
      for (const at of [0, 0.045, 0.09]) s.fx('wave', at, 3, 0.1, -0.3);
      s.fx('gull', 0.01, 0.6, 0.08, 0.5);
      s.fx('gull', 0.055, 0.5, 0.07, -0.4);
      s.fx('gull', 0.09, 0.6, 0.08, 0.3);
      s.fx('creak', PUSH_OFF, 0.8, 0.12, 0.2);
      s.fx('water', PUSH_OFF, 2, 0.06, 0.2);
      // The storm rolls in: minor, driving, wind and rain.
      s.fx('wind', 0.13, s.story * 0.17, 0.08);
      s.fx('rain', 0.16, s.story * 0.69, 0.1);
      s.fx('rain', 0.85, s.story * 0.035, 0.05);
      s.fx('thunder', 0.17, 4, 0.16, -0.4);
      s.fx('thunder', 0.25, 4, 0.14, 0.3);
      for (let i = 0; i < 6; i++) s.fx('wave', 0.15 + i * 0.024, 2.4, 0.2, (i % 2) - 0.5);
      s.fx('creak', 0.235, 0.8, 0.14, 0.1);
      s.fx('creak', 0.265, 0.8, 0.12, -0.1);
      s.section({
        from: 0.135,
        to: 0.215,
        bpm: 116,
        root: ROOT,
        minor: true,
        chords: [0, -4, -2, 0],
        groove: 'pulse',
        level: 0.6,
      });
      s.section({
        from: 0.215,
        to: 0.29,
        bpm: 116,
        root: ROOT,
        minor: true,
        chords: [0, -4, -2, 0],
        melody: [12, null, 10, 8, 7, null, 8, 7, 5, null, 3, null, 5, 7, null, null],
        step: 0.5,
        voice: 'lead',
        gain: 0.55,
        groove: 'drive',
        level: 0.85,
      });
      // The lamp room: the clock ticks, the lamp sputters, and dies.
      s.section({
        from: 0.285,
        to: DARK,
        bpm: 80,
        root: ROOT,
        minor: true,
        chords: [0, -4],
        melody: [12, null, null, 10, null, null, 8, null],
        voice: 'keys',
        gain: 0.6,
        groove: 'tick',
        level: 0.5,
      });
      s.fx('crackle', SPUTTER, 0.8, 0.12, 0.1);
      s.fx('crackle', SPUTTER + 0.013, 0.8, 0.1, 0.1);
      s.fx('creak', JAM, 1.1, 0.16, -0.2);
      s.fx('thud', DARK - 0.004, 0.8, 0.22);
      for (const at of WRENCH) {
        s.fx('clatter', at, 0.3, 0.07, -0.3);
        s.fx('creak', at, 0.5, 0.1, -0.2);
      }
      // Alone in the dark: bare, slow, and a long way from home.
      s.section({
        from: DARK,
        to: 0.43,
        bpm: 56,
        root: ROOT,
        minor: true,
        chords: [0, -4, 5, 0],
        melody: [null, 12, null, null, 7, null, null, null],
        voice: 'keys',
        gain: 0.55,
        bass: false,
        level: 0.45,
        fade: 1.5,
      });
      s.fx('click', GRAB, 0.1, 0.12, 0.4);
      // Rio runs: a march that won't give up.
      s.section({
        from: 0.43,
        to: 0.49,
        bpm: 126,
        root: ROOT,
        minor: true,
        chords: [0, -2, -4, -2],
        melody: [0, 7, 3, 7, 0, 7, 5, 7],
        step: 0.5,
        voice: 'pluck',
        gain: 0.6,
        groove: 'march',
        level: 0.7,
      });
      s.fx('wind', 0.43, s.story * 0.2, 0.06, 0.3);
      for (let i = 0; i < 8; i++) s.fx('step', 0.455 + i * 0.0038, 0.12, 0.09, 0.2);
      // Knock, knock, knock... and a door opens.
      s.section({
        from: 0.485,
        to: 0.545,
        bpm: 100,
        root: ROOT,
        minor: true,
        chords: [0, -4],
        groove: 'tick',
        level: 0.4,
        bass: false,
      });
      for (const at of KNOCKS) s.fx('knock', at, 0.25, 0.26, -0.3);
      s.fx('creak', DOOR, 0.9, 0.14, -0.2);
      s.chord(NOD, [ROOT, ROOT + 4, ROOT + 7, ROOT + 12], 2, 'pad', 0.035);
      // One by one, doors open and lanterns light, each with its own note.
      s.section({
        from: 0.545,
        to: 0.635,
        bpm: 120,
        root: ROOT,
        chords: [0, 5, 7, 0],
        groove: 'march',
        level: 0.65,
      });
      DOORS.forEach((at, k) => s.fx('creak', at, 0.6, 0.08, -0.6 + k * 0.4));
      FOLK_LIT.forEach((at, i) =>
        s.note(at, ROOT + LANTERN_NOTES[i], 1.4, 'bell', 0.09, -0.6 + i * 0.13),
      );
      // The lantern line: the tune comes back, heroic, and the ridge rings out.
      s.section({
        from: 0.63,
        to: 0.705,
        bpm: 120,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: SHANTY_MARCH,
        voice: 'lead',
        gain: 0.8,
        groove: 'drive',
        level: 0.9,
      });
      for (let j = 0; j <= 10; j++)
        s.note(
          0.686 + j * 0.0012,
          ROOT + 12 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24][j],
          1.2,
          'bell',
          0.06,
          0.6 - j * 0.12,
        );
      // Back at sea: the storm again, then she sees the lights.
      s.fx('wind', 0.705, s.story * 0.12, 0.08);
      for (let i = 0; i < 4; i++) s.fx('wave', 0.705 + i * 0.022, 2.4, 0.22, (i % 2) - 0.5);
      s.section({
        from: 0.705,
        to: SEES,
        bpm: 116,
        root: ROOT,
        minor: true,
        chords: [0, -4],
        groove: 'drive',
        level: 0.7,
      });
      s.fx('gasp', SEES, 0.5, 0.1, -0.2);
      s.section({
        from: SEES,
        to: FOGHORN,
        bpm: 60,
        root: ROOT,
        chords: [5, 0],
        bass: false,
        level: 0.6,
        fade: 0.8,
      });
      s.fx('sparkle', 0.737, 1.4, 0.06, 0.3);
      s.fx('foghorn', FOGHORN, 2.2, 0.26, -0.3);
      s.fx('creak', TURN, 1, 0.14);
      s.section({
        from: FOGHORN,
        to: 0.83,
        bpm: 120,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: SHANTY_MARCH,
        voice: 'lead',
        gain: 0.8,
        groove: 'drive',
        level: 0.85,
      });
      // Home: the boat bumps the pier, the bell rings, the town cheers.
      s.fx('thud', BUMP, 0.5, 0.2, -0.2);
      s.fx('splash', BUMP, 0.8, 0.08, -0.2);
      s.fx('crowd', CHEER - 0.004, 3.5, 0.16, 0.3);
      s.fx('applause', CHEER, 3, 0.14, 0.4);
      s.fx('toll', TOLL, 2.8, 0.22, 0.1);
      s.fx('toll', TOLL + 0.034, 2.8, 0.16, 0.1);
      s.section({
        from: 0.83,
        to: 0.89,
        bpm: 132,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: SHANTY,
        voice: 'keys',
        gain: 0.85,
        groove: 'waltz',
        level: 0.85,
      });
      // The storm clears, the lamp comes back, and the shanty rings out on bells.
      s.fx('hum', RELIGHT, 2.2, 0.06);
      s.fx('chime', RELIGHT + 0.02, 1.6, 0.1, -0.2);
      s.fx('wave', 0.9, 3, 0.08, -0.4);
      s.fx('gull', 0.95, 0.6, 0.06, 0.5);
      s.section({
        from: 0.89,
        to: 1,
        bpm: 132,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: SHANTY,
        voice: 'bell',
        gain: 0.9,
        groove: 'waltz',
        level: 0.9,
      });
      s.chord(0.985, [ROOT, ROOT + 4, ROOT + 7, ROOT + 12], 3, 'pad', 0.04);
    },
  );

export const lanternsOnTheCliff: FilmModule = {
  draw(ctx, p, seconds) {
    const { index } = shot(p, CUTS);
    const w = weather(p);
    let rain = w.rain * 0.75,
      dim = 0.4;
    switch (index) {
      case 1:
        camera(ctx, track(p, CLIFF_CAM), () => cliffTop(ctx, p, seconds));
        break;
      case 3:
      case 13:
      case 15:
        camera(ctx, track(p, SEA_CAM), () => atSea(ctx, p, seconds));
        rain = 1;
        break;
      case 4:
        camera(ctx, track(p, LAMP_CAM), () => lampRoom(ctx, p, seconds));
        rain = 0;
        dim = 0.55;
        break;
      case 5:
      case 6:
        camera(ctx, track(p, WINDOW_CAM), () => windowScene(ctx, p, seconds));
        rain = 0;
        dim = 0.55;
        break;
      case 8:
        runDown(ctx, p, seconds);
        rain = 1;
        break;
      case 9:
      case 10:
      case 11:
        camera(
          ctx,
          index === 11 ? { x: rioRun(p) + 50, y: 104, zoom: 1.15 } : track(p, STREET_CAM),
          () => {
            streetSet(ctx, p, seconds);
            streetFolk(ctx, p, seconds);
          },
          { w: 480, h: H },
        );
        rain = 0.7;
        break;
      case 14:
        camera(ctx, track(p, POV_CAM), () => seaPov(ctx, seconds));
        rain = 0.9;
        break;
      case 18:
        camera(ctx, track(p, TOWER_CAM), () => towerTop(ctx, p, seconds));
        break;
      default:
        camera(ctx, track(p, HARBOUR_CAM), () => harbour(ctx, p, seconds), { w: W, h: SET_H });
    }
    // Rain falls in screen space so it keeps its weight at every zoom.
    if (rain > 0) rainfall(ctx, seconds, { amount: rain, slant: 0.3, color: '#9FB0C4' });
    vignette(ctx, dim);
    // Dips to black: sunset into storm, and into the lamp coming back.
    veil(ctx, INK, Math.max(hump(p, 0.124, 0.146) * 0.85, hump(p, 0.884, 0.896) * 0.5));
    captions(ctx, p, [
      [0.034, 0.084, 'Mama always came home by the light.'],
      [0.15, 0.206, 'Then the weather turned.'],
      [0.343, 0.4, 'The light went out.'],
      [0.645, 0.702, 'Every house has a lantern.'],
    ]);
  },
  score: lanternsOnTheCliffScore,
  look: {
    shade: '#0C1620',
    ink: '#FFF3DE',
    accent: '#F6B94F',
    dedication: 'a town is a lighthouse, too',
  },
};
