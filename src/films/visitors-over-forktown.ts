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
  rand,
  shade,
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
  type View,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * VISITORS OVER FORKTOWN
 * An ordinary night: a baker walking home, a busker under a lamp, a kid at the Stargazer
 * Station's telescope. A flying saucer beams all three aboard, and its tiny crew turns out to
 * be tourists, cameras round their necks and their map upside down. The night owls become tour
 * guides: over the Lantern Fork, up through the clouds, around the moon, and home again, with a
 * glowing pebble for the kid and a heart drawn in the sky.
 *
 * The busker's strums, the beams, and the cameras' clicks sit on one beat grid (BEAT) that the
 * score shares, so every pluck sounds as his hand crosses the strings.
 */

const BEAT = 1 / 96; // 0.5625 s of the 54 s story: about 107 bpm.
const ROOT = 60;

// ——— Story beats (story units), read by both the pictures and the score ———
const SCOPE = 0.1,
  SPOTTED = 0.118,
  ARRIVE = 0.14,
  INSIDE = 0.3,
  REVEAL = 0.335,
  CAMERAS = 0.36,
  CARD = 0.385,
  RELIEF = 0.415,
  TOUR = 0.44,
  CLOUDS = 0.5,
  MOON = 0.525,
  PARTY = 57 * BEAT,
  STARS = 0.63,
  HOME = 0.66,
  ROOF = 0.728,
  PEBBLE = 0.768,
  HEART = 0.8,
  FINAL = 0.875;
const CLICKS = [0.366, 0.372, 0.378] as const;
const PHOTO = 0.65; // the constellation gets its picture taken
const MAP_TAKE = 0.428,
  MAP_FLIP = 0.435;
const BREAD_TOSS = [0.603, 0.612, 0.621] as const;
type Lift = { beam: number; move: number; done: number; off: number };
// Pickups: the beam fades in, the guest rises (move → done), the beam fades out.
const UP: Record<'baker' | 'busker' | 'kid', Lift> = {
  baker: { beam: 0.166, move: 0.174, done: 0.198, off: 0.2 },
  busker: { beam: 0.214, move: 0.219, done: 0.241, off: 0.243 },
  kid: { beam: 0.257, move: 0.262, done: 0.284, off: 0.287 },
};
const DOWN: Record<'baker' | 'busker' | 'kid', Lift> = {
  baker: { beam: 0.675, move: 0.679, done: 0.693, off: 0.697 },
  busker: { beam: 0.706, move: 0.709, done: 0.721, off: 0.725 },
  kid: { beam: 0.736, move: 0.739, done: 0.752, off: 0.772 },
};
const DROP = 0.754; // the pebble leaves the saucer and drifts down to the kid's hands
const HEART_FROM = 0.818,
  HEART_TO = 0.858,
  ZIP = 0.862,
  GONE = 0.874;
/** When the busker is on screen with his guitar: every beat inside is a pluck. */
const STRUMS: readonly (readonly [number, number])[] = [
  [0.04, 0.08],
  [ARRIVE, UP.busker.done],
  [DOWN.busker.move, DOWN.busker.done],
];
/** The busker's one look down, mid-air (he skips a few beats). */
const LOOK_DOWN = 0.226;
const strumming = (p: number) =>
  STRUMS.some(([a, b]) => within(p, a, b)) || within(p, PARTY, STARS);
/** Hand travel across the strings: a quick stroke on the beat, a lazy return. */
function stroke(p: number) {
  const phase = (((p / BEAT) % 1) + 1) % 1;
  return phase < 0.2 ? easeOut(phase / 0.2) : 1 - ease((phase - 0.2) / 0.8);
}

// ——— Palette ———
const MINT = '#B5F0C1',
  TEAL = '#6FF0C8',
  NIGHT = '#0B1020',
  WARM = '#FFD68A',
  ALIEN = '#8ADB7E',
  ALIEN_DARK = '#4E9E5C',
  ALIEN_BELLY = '#C8F2B6',
  TIP = '#FFB3D6',
  EYE = '#141A26',
  HULL = '#A9BCC8',
  HULL_LIGHT = '#DCE8EE',
  RIM = '#6E8292',
  BELLY = '#4A5A6A';

// ——— Stage helpers ———
type World = { w: number; h: number };
function fillPath(ctx: Ctx, paint: string | CanvasGradient, pts: readonly number[]) {
  ctx.fillStyle = paint;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2)
    if (i) ctx.lineTo(pts[i], pts[i + 1]);
    else ctx.moveTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}
/** The world rectangle a view really shows, with the kit camera's edge clamping. */
function seen(view: View, world: World) {
  const hw = W / 2 / view.zoom,
    hh = H / 2 / view.zoom;
  const x = world.w <= hw * 2 ? world.w / 2 : clamp(view.x, hw, world.w - hw);
  const y = world.h <= hh * 2 ? world.h / 2 : clamp(view.y, hh, world.h - hh);
  return { x0: x - hw, x1: x + hw, y0: y - hh, y1: y + hh, zoom: view.zoom };
}
type Seen = ReturnType<typeof seen>;
function film(ctx: Ctx, world: World, view: View, paint: (v: Seen) => void) {
  const v = seen(view, world);
  camera(ctx, view, () => paint(v), world);
  return v;
}
/** Dithered bands of sky, drawn only where the camera looks. */
function bands(ctx: Ctx, colors: readonly string[], top: number, bottom: number, v: Seen) {
  const step = (bottom - top) / colors.length;
  const x0 = Math.floor(v.x0 / 6) * 6 - 6,
    x1 = v.x1 + 6;
  colors.forEach((color, i) => {
    const a = top + i * step;
    if (a + step >= v.y0 - 2 && a <= v.y1 + 2) box(ctx, x0, a, x1 - x0, Math.ceil(step) + 1, color);
  });
  for (let i = 1; i < colors.length; i++) {
    const y = Math.round(top + i * step);
    if (y < v.y0 - 3 || y > v.y1 + 3) continue;
    for (let x = x0; x < x1; x += 6) {
      box(ctx, x, y - 2, 3, 1, colors[i]);
      box(ctx, x + 3, y - 1, 3, 1, colors[i]);
      box(ctx, x + 3, y, 3, 1, colors[i - 1]);
    }
  }
}
/** Eases a point through keyframes [p, x, y]; holds at either end. */
function path(p: number, keys: readonly (readonly [number, number, number])[]) {
  if (p <= keys[0][0]) return { x: keys[0][1], y: keys[0][2] };
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, ax, ay] = keys[i],
      [b, bx, by] = keys[i + 1];
    if (p < b) {
      const t = ease((p - a) / (b - a));
      return { x: lerp(ax, bx, t), y: lerp(ay, by, t) };
    }
  }
  const last = keys[keys.length - 1];
  return { x: last[1], y: last[2] };
}
function halfDisc(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();
}

// ——— The saucer ———
type Aboard = readonly [boolean, boolean, boolean];
const NOBODY: Aboard = [false, false, false];
type SaucerPose = {
  s: number;
  seconds: number;
  tilt?: number;
  beam?: number;
  /** 1 = a silhouette against the moon. */
  dark?: number;
  aboard?: Aboard;
  wave?: boolean;
};
/** Six heads under the glass: three aliens, and whichever guests are aboard. */
function crew(ctx: Ctx, seconds: number, aboard: Aboard, wave: boolean, d: number) {
  const tone = (c: string) => (d > 0 ? mix(c, '#10141C', d) : c);
  const seats = [-12, -6.5, -1.5, 3.5, 8.5, 13];
  seats.forEach((sx, i) => {
    const bob = Math.sin(seconds * 4 + i * 1.3) * 0.5;
    const y = -7 + bob;
    const guest: number = i === 1 ? 0 : i === 2 ? 2 : i === 3 ? 1 : -1;
    if (guest < 0) {
      line(ctx, tone(ALIEN_DARK), 0.6, [sx - 1, y - 2, sx - 2, y - 4.5]);
      line(ctx, tone(ALIEN_DARK), 0.6, [sx + 1, y - 2, sx + 2, y - 4.5]);
      oval(ctx, sx, y, 2.6, 2.2, tone(ALIEN));
      box(ctx, sx - 1.6, y - 0.6, 1.2, 1.5, tone(EYE));
      box(ctx, sx + 0.5, y - 0.6, 1.2, 1.5, tone(EYE));
      if (wave)
        line(ctx, tone(ALIEN), 0.8, [sx + 2, y + 1, sx + 3.5 + Math.sin(seconds * 9 + i), y - 3]);
      return;
    }
    if (!aboard[guest]) return;
    const [skin, hat] = [
      ['#EDBE96', '#FFFFFF'],
      ['#A36B4B', '#D9573E'],
      ['#F2C9A2', '#4A2E26'],
    ][guest];
    disc(ctx, sx, y + 0.5, 2.4, tone(skin));
    box(ctx, sx - 2.4, y - 2.2, 4.8, 1.8, tone(hat));
    if (wave)
      line(ctx, tone(skin), 0.8, [sx - 2, y + 2, sx - 3.5 + Math.sin(seconds * 8 + i), y - 2.5]);
  });
}
/** The round saucer, centred on its rim: glass dome, crew, running lights, and beam port. */
function saucer(ctx: Ctx, x: number, y: number, o: SaucerPose) {
  const d = o.dark ?? 0;
  const tone = (c: string) => (d > 0 ? mix(c, '#10141C', d) : c);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.tilt ?? 0);
  ctx.scale(o.s, o.s);
  if (d < 1) glow(ctx, 0, 2, 50, TEAL, 0.22 * (1 - d));
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -3, 15, 13, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.clip();
  box(ctx, -16, -17, 32, 15, tone('#1C3440'));
  if (d < 1) glow(ctx, 0, -3, 16, MINT, 0.4 * (1 - d));
  crew(ctx, o.seconds, o.aboard ?? NOBODY, o.wave ?? false, d);
  box(ctx, -16, -17, 32, 15, alpha(MINT, 0.12));
  ctx.restore();
  line(ctx, alpha('#FFFFFF', 0.6 * (1 - d)), 1.1, [-10, -8, -7.5, -12, -3, -14.6]);
  oval(ctx, 0, 0, 34, 6.5, tone(HULL));
  oval(ctx, -4, -2, 25, 3, tone(HULL_LIGHT));
  oval(ctx, 0, 3, 38, 4.5, tone(RIM));
  oval(ctx, 0, 6, 20, 4.2, tone(BELLY));
  oval(ctx, 0, 8.6, 8, 2.2, mix(tone('#2E3C48'), '#E8FFF0', (o.beam ?? 0) * (1 - d)));
  // Running lights: a slow, soft chase around the rim.
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.08 + (i / 8) * 0.84);
    const on = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(o.seconds * 3 - i * 0.9));
    disc(
      ctx,
      -Math.cos(a) * 35,
      3 + Math.sin(a) * 3.4,
      1.7,
      mix(tone('#2D5A50'), TEAL, on * (1 - d)),
    );
  }
  ctx.restore();
}
/** A soft, steady cone of light from the saucer's port down to the ground. */
function beamCone(
  ctx: Ctx,
  x: number,
  top: number,
  bottom: number,
  amount: number,
  seconds: number,
) {
  if (amount <= 0) return;
  const len = bottom - top;
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, alpha(MINT, 0.46 * amount));
  g.addColorStop(1, alpha(MINT, 0.16 * amount));
  fillPath(ctx, g, [x - 8, top, x + 8, top, x + 30, bottom, x - 30, bottom]);
  fillPath(ctx, alpha('#EFFFF4', 0.1 * amount), [
    x - 4,
    top,
    x + 4,
    top,
    x + 13,
    bottom,
    x - 13,
    bottom,
  ]);
  oval(ctx, x, bottom, 32, 4.5, alpha(MINT, 0.3 * amount));
  glow(ctx, x, bottom - 4, 46, MINT, 0.26 * amount);
  for (let i = 0; i < 12; i++) {
    const t = (seconds * (0.22 + rand(i) * 0.2) + rand(i * 3)) % 1;
    const y = bottom - t * len;
    const half = 8 + (22 * (y - top)) / len;
    box(
      ctx,
      x + (rand(i * 7) - 0.5) * 1.6 * half,
      y,
      1,
      1,
      alpha('#F2FFF6', amount * 0.8 * Math.sin(t * Math.PI)),
    );
  }
}

// ——— The tourists ———
type Hold = 'none' | 'camera' | 'shoot' | 'map' | 'card' | 'bread' | 'wave' | 'point' | 'dance';
type AlienPose = {
  seconds: number;
  seed: number;
  eyes?: 'big' | 'happy';
  /** Pupils glance: -1 left, 1 right, and up with `up`. */
  look?: number;
  up?: boolean;
  hold?: Hold;
  /** Map rotation: π is upside down. */
  flip?: number;
  hop?: number;
  facing?: 1 | -1;
  /** A little jolt as the shutter goes. */
  shake?: number;
};
function pixelQuery(ctx: Ctx, x: number, y: number, color: string) {
  line(ctx, color, 1.3, [
    x - 2,
    y - 3,
    x - 1,
    y - 4.5,
    x + 1.5,
    y - 4.5,
    x + 2.5,
    y - 3,
    x + 1.4,
    y - 1.2,
  ]);
  line(ctx, color, 1.3, [x + 1.4, y - 1.2, x + 0.3, y - 0.4, x + 0.3, y + 1]);
  disc(ctx, x + 0.3, y + 3, 0.8, color);
}
function mapSheet(ctx: Ctx) {
  box(ctx, -7, -4.5, 14, 9, '#EFE2C0');
  box(ctx, -7, -4.5, 14, 1, '#D8C69E');
  // The fork in the road, and a red dot: YOU ARE HERE (somewhere).
  line(ctx, '#B77A48', 1.1, [0, 4, 0, 0.5, -4, -3]);
  line(ctx, '#B77A48', 1.1, [0, 0.5, 4, -3]);
  disc(ctx, -0.5, -2, 1.3, '#4F8A56');
  disc(ctx, 4.5, 2, 0.9, '#E04A3A');
  poly(ctx, '#3A6A9A', [-5.5, 3.5, -4.5, 0.5, -3.5, 3.5]);
}
function postcard(ctx: Ctx) {
  box(ctx, -10, -7, 20, 14, '#F5EEDC');
  box(ctx, -9, -6, 18, 9, '#34407A');
  box(ctx, -9, -1, 18, 1, '#4A5A94');
  disc(ctx, 6, -3.5, 1.5, '#F4EBC8');
  // The Lantern Fork and the Stargazer dome, as the postcard shop paints them.
  box(ctx, -5.5, -1, 1, 4, '#5A3E2E');
  disc(ctx, -7, -2.5, 2.2, '#3E7A4A');
  disc(ctx, -4, -3.5, 2.6, '#3E7A4A');
  disc(ctx, -6.5, -3, 0.6, WARM);
  disc(ctx, -3.5, -2.5, 0.6, WARM);
  halfDisc(ctx, 2, 3, 2.6, '#5C8FD8');
  box(ctx, -9, 3, 18, 3, '#2A3450');
  box(ctx, -9, 4, 18, 1, '#EFE6D0');
  pixelQuery(ctx, 12.5, -9, '#E04A3A');
}
/** A knee-high green tourist: huge eyes, wobbly antennae, a camera on a strap. */
function alien(ctx: Ctx, x: number, y: number, s: number, a: AlienPose) {
  const facing = a.facing ?? 1,
    hold = a.hold ?? 'none';
  const wob = Math.sin(a.seconds * 5 + a.seed * 2.1);
  shade(ctx, x, y, 12 * s, 0.3);
  ctx.save();
  ctx.translate(x + (a.shake ?? 0) * 0.6 * s, y - (a.hop ?? 0) * s);
  ctx.scale(s * facing, s);
  const arm = (sx: number, hx: number, hy: number) => {
    line(ctx, ALIEN_DARK, 1.5, [sx, -9, hx, hy]);
    disc(ctx, hx, hy, 1.1, ALIEN);
  };
  const dance = hold === 'dance' ? Math.sin(a.seconds * 6 + a.seed) : 0;
  // Legs, body, and the back arm.
  box(ctx, -3, -3, 2, 3, ALIEN_DARK);
  box(ctx, 1, -3, 2, 3, ALIEN_DARK);
  if (hold === 'map' || hold === 'card') arm(-3.5, -6, hold === 'card' ? -28 : -9);
  else if (hold === 'shoot') arm(-3.5, 0, -15);
  else if (hold === 'dance') arm(-3.5, -7, -15 + dance * 2);
  else arm(-3.5, -5.5, -4);
  oval(ctx, 0, -7, 4.6, 4.8, ALIEN);
  oval(ctx, 0.8, -6.2, 2.4, 3, ALIEN_BELLY);
  for (const side of [-1, 1]) {
    const tx = side * (5.2 + wob * 1.3),
      ty = -27 + Math.abs(wob) * 0.6;
    line(ctx, ALIEN_DARK, 0.9, [side * 2.4, -19, side * 3.6 + wob * 0.7, -23.5, tx, ty]);
    disc(ctx, tx, ty, 1.5, TIP);
  }
  oval(ctx, 0, -14.5, 7.6, 6.2, ALIEN);
  oval(ctx, 0.6, -11.2, 5, 2.2, alpha(ALIEN_BELLY, 0.55));
  const blink = Math.sin(a.seconds * 0.9 + a.seed * 3.7) > 0.985;
  const look = a.look ?? 0,
    lift = a.up ? -1 : 0;
  for (const ex of [-3.1, 3.1]) {
    if (a.eyes === 'happy') line(ctx, EYE, 1.1, [ex - 1.9, -14.3, ex, -16.6, ex + 1.9, -14.3]);
    else if (blink) box(ctx, ex - 2, -15, 4, 1, EYE);
    else {
      oval(ctx, ex, -15, 2.4, 3.3, EYE);
      box(ctx, ex - 0.9 + look * 0.7, -17.2 + lift, 1.3, 1.3, '#FFFFFF');
      box(ctx, ex + 0.6 + look * 0.4, -13.6 + lift * 0.5, 0.7, 0.7, alpha('#FFFFFF', 0.7));
    }
  }
  // The camera on its strap, or up at the eye.
  if (hold === 'shoot') {
    box(ctx, -0.5, -18.2, 7, 4.8, '#39404C');
    box(ctx, 0.5, -19.2, 2, 1, '#39404C');
    disc(ctx, 3, -15.8, 1.9, '#9DB4CC');
    disc(ctx, 3, -15.8, 0.9, '#2A3444');
    arm(3.5, 5.5, -15);
  } else {
    line(ctx, '#39404C', 0.6, [-2.6, -10.5, 0, -7.2, 2.6, -10.5]);
    box(ctx, -2.6, -8.4, 5.2, 3.4, '#39404C');
    disc(ctx, 0, -6.7, 1.2, '#9DB4CC');
    box(ctx, 1.2, -9.1, 1, 0.8, '#E05A5A');
  }
  // Front arm and props (maps and cards are drawn the right way round whatever the facing).
  const unflipped = (cx: number, cy: number, rot: number, paint: () => void) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(facing, 1);
    ctx.rotate(rot);
    paint();
    ctx.restore();
  };
  if (hold === 'map') {
    unflipped(0, -8, a.flip ?? 0, () => mapSheet(ctx));
    arm(3.5, 6, -9);
  } else if (hold === 'card') {
    unflipped(0, -36, 0, () => postcard(ctx));
    arm(3.5, 6, -28);
  } else if (hold === 'wave') arm(3.5, 8 + Math.sin(a.seconds * 9 + a.seed) * 1.5, -17);
  else if (hold === 'point') arm(3.5, 10, -14);
  else if (hold === 'dance') arm(3.5, 7, -15 - dance * 2);
  else if (hold === 'bread') {
    arm(3.5, 2.5, -11);
    box(ctx, 0.5, -13, 5, 2.6, '#C98B45');
    box(ctx, 1, -13, 4, 1, '#E8B870');
  } else if (hold !== 'shoot') arm(3.5, 5.5, -4);
  ctx.restore();
}

// ——— The night owls ———
const BAKER: Figure = {
  skin: '#EDBE96',
  hair: '#7A5238',
  coat: '#F2EDE2',
  legs: '#586078',
  shoes: '#4A3A34',
  build: 'adult',
  hat: 'cap',
  hatColor: '#FFFFFF',
};
const BUSKER: Figure = {
  skin: '#A36B4B',
  hair: '#2A2024',
  coat: '#4C7497',
  legs: '#353240',
  shoes: '#2A2428',
  build: 'adult',
  hat: 'beanie',
  hatColor: '#D9573E',
  arms: [1.1, 0.6],
};
const KID: Figure = {
  skin: '#F2C9A2',
  hair: '#4A2E26',
  coat: '#7B86D8',
  legs: '#3A4068',
  shoes: '#D95C5C',
  hairStyle: 'pigtails',
};
function baguette(ctx: Ctx, x: number, y: number, angle: number, length: number, s: number) {
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  const ax = x - dx * length * 0.25,
    ay = y - dy * length * 0.25,
    bx = x + dx * length * 0.75,
    by = y + dy * length * 0.75;
  line(ctx, '#B9772F', 3.4 * s, [ax, ay, bx, by]);
  line(ctx, '#E0A55A', 1.6 * s, [
    ax + dy * 0.5 * s,
    ay - dx * 0.5 * s,
    bx + dy * 0.5 * s,
    by - dx * 0.5 * s,
  ]);
  for (let k = 1; k < 4; k++)
    box(ctx, lerp(ax, bx, k / 4) - 0.5 * s, lerp(ay, by, k / 4) - 1 * s, 1.5 * s, 1 * s, '#F6DDA4');
}
/** The baker in his whites and apron; the baguette rides in his front hand. */
function baker(ctx: Ctx, x: number, y: number, over: Partial<Figure>, bread?: number, length = 22) {
  const f: Figure = { ...BAKER, ...over };
  const s = f.size ?? 1;
  person(ctx, x, y, f);
  const hip = f.step === undefined ? 11 : 11 + Math.abs(Math.cos(f.step));
  box(ctx, x - 4.5 * s, y - (hip + 1) * s, 9 * s, 6.5 * s, '#FFFFFF');
  box(ctx, x - 4.5 * s, y - (hip + 1.5) * s, 9 * s, 1 * s, '#D2C8B4');
  if (bread !== undefined) {
    const hand = handOf(x, y, f);
    baguette(ctx, hand.x, hand.y, bread, length * s, s);
  }
}
function guitar(ctx: Ctx, x: number, y: number, s: number, facing: number, strum: number | null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * facing, s);
  const hip = -11;
  line(ctx, '#5A3A22', 2, [2, hip - 6, 13, hip - 15]);
  box(ctx, 12, hip - 18, 3, 4, '#3A2618');
  oval(ctx, -1, hip - 1.5, 5.4, 4.3, '#D08A44');
  oval(ctx, 1.8, hip - 5.8, 4, 3.4, '#D08A44');
  oval(ctx, -2, hip - 0.5, 3.4, 2.4, '#E4A660');
  disc(ctx, 0.6, hip - 3.8, 1.4, '#3A2618');
  line(ctx, alpha('#F4E6C8', 0.6), 0.4, [-3, hip + 0.8, 13, hip - 15]);
  box(ctx, 11, hip - 15.5, 2, 2, BUSKER.skin);
  if (strum !== null) box(ctx, -0.5 + strum * 0.6, hip - 6.5 + strum * 3.5, 2.2, 2.2, BUSKER.skin);
  ctx.restore();
}
/** The busker and his guitar; `strum` is the picking hand's travel, or null to let go. */
function busker(ctx: Ctx, x: number, y: number, over: Partial<Figure>, strum: number | null) {
  const f: Figure = { ...BUSKER, ...over };
  person(ctx, x, y, f);
  guitar(ctx, x, y, f.size ?? 1, f.facing ?? 1, strum);
}
function guitarCase(ctx: Ctx, x: number, y: number, s: number, coins = 5) {
  box(ctx, x - 10 * s, y - 8 * s, 20 * s, 5 * s, '#3A2E3A');
  box(ctx, x - 10 * s, y - 3 * s, 20 * s, 3 * s, '#2A2430');
  box(ctx, x - 9 * s, y - 3 * s, 18 * s, 1.5 * s, '#8A2E3E');
  for (let i = 0; i < coins; i++)
    box(ctx, x + (-7 + i * 3.2) * s, y - (3 + (i % 2)) * s, 1.6 * s, 1.2 * s, '#F2C94C');
}
/** The kid's brass spyglass: its eyepiece at (x, y), pointing along `angle`. */
function spyglass(ctx: Ctx, x: number, y: number, angle: number, s: number) {
  const dx = Math.cos(angle) * s,
    dy = Math.sin(angle) * s;
  line(ctx, '#8A6A34', 2.2 * s, [x, y, x + dx * 5, y + dy * 5]);
  line(ctx, '#D9B45A', 3 * s, [x + dx * 5, y + dy * 5, x + dx * 14, y + dy * 14]);
  line(ctx, '#F2D88A', 3.6 * s, [x + dx * 14, y + dy * 14, x + dx * 16, y + dy * 16]);
}
function pebble(ctx: Ctx, x: number, y: number, bright: number, s = 1) {
  glow(ctx, x, y, 16 * s * (0.6 + bright), MINT, 0.5 * bright);
  oval(ctx, x, y, 2.2 * s, 1.7 * s, mix('#7FAF8A', '#DFFFE8', bright));
  box(ctx, x - 1 * s, y - 1 * s, 1 * s, 1 * s, '#FFFFFF');
}

// ——— SCENES ———

// ——— Forktown by night: a street of houses and the Stargazer Station ———
const TOWN: World = { w: 480, h: 240 };
const STREET = 212,
  DECK = 150;
const BUSKER_X = 198,
  CASE_X = 176,
  BAKER_STOP = 236,
  BAKER_HOME = 258,
  KID_X = 372;
const GLASS = { x: 361, y: 119, angle: -Math.PI + 0.55 } as const;
const HEART_C = { x: 300, y: 76, k: 1.7 } as const;
const WINK = { x: 440, y: 66 } as const;
const TOWN_SKY = ['#0B1020', '#0F182E', '#15203A', '#1C2A46'];
const FOOT = 0.006; // one footfall of the baker's stroll, in story units

function heartPoint(t: number) {
  const x = 16 * Math.sin(t) ** 3;
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return { x: HEART_C.x + x * HEART_C.k, y: HEART_C.y + y * HEART_C.k };
}
/** The heart the saucer draws with its lights; it lingers, softly, to the very end. */
function heartTrail(ctx: Ctx, p: number) {
  const drawn = span(p, HEART_FROM, HEART_TO);
  if (drawn <= 0) return;
  const fade = 1 - 0.55 * ease(span(p, FINAL, 1));
  const pts: number[] = [];
  const n = Math.max(2, Math.ceil(drawn * 48));
  for (let i = 0; i <= n; i++) {
    const q = heartPoint((i / n) * drawn * TAU);
    pts.push(q.x, q.y);
  }
  line(ctx, alpha(TEAL, 0.22 * fade), 5, pts);
  line(ctx, alpha(MINT, 0.9 * fade), 1.6, pts);
  const done = ease(span(p, HEART_TO, HEART_TO + 0.012));
  if (done > 0) glow(ctx, HEART_C.x, HEART_C.y + 6, 56, MINT, 0.2 * done * fade);
}
function lamp(ctx: Ctx, x: number) {
  box(ctx, x - 1, 164, 2, STREET - 164, '#262A38');
  box(ctx, x - 3, STREET - 3, 6, 3, '#262A38');
  box(ctx, x - 4, 158, 8, 3, '#353A4C');
  box(ctx, x - 3, 161, 6, 4, '#FFE7B0');
  glow(ctx, x, 163, 38, WARM, 0.32);
  oval(ctx, x, STREET + 3, 28, 4, alpha(WARM, 0.12));
}
function pane(ctx: Ctx, x: number, y: number, w: number, h: number, lit = '#F2C46A') {
  box(ctx, x - 1, y - 1, w + 2, h + 2, '#2A2230');
  box(ctx, x, y, w, h, lit);
  box(ctx, x + w / 2 - 0.5, y, 1, h, '#2A2230');
  box(ctx, x, y + h / 2 - 0.5, w, 1, '#2A2230');
}
/** The Stargazer Station's blue dome: its slit and big telescope turn together. */
function dome(ctx: Ctx, turn: number) {
  halfDisc(ctx, 418, DECK, 28, '#4C7CC4');
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(418, DECK, 28, 28, 0, Math.PI, TAU);
  ctx.clip();
  oval(ctx, 408, DECK - 14, 14, 12, '#6A9ADC');
  box(ctx, 388, DECK - 5, 60, 3, '#3A5E9E');
  ctx.translate(418, DECK);
  ctx.rotate(turn);
  box(ctx, -4, -30, 8, 30, '#121A2E');
  ctx.restore();
  const tx = 418 + Math.sin(turn) * 38,
    ty = DECK - 8 - Math.cos(turn) * 38;
  line(ctx, '#C9D2E0', 5, [418, DECK - 8, tx, ty]);
  line(ctx, '#8E9AB0', 6, [lerp(418, tx, 0.86), lerp(DECK - 8, ty, 0.86), tx, ty]);
  box(ctx, 414, DECK - 2, 8, 2, '#2A3656');
}
function townSet(ctx: Ctx, p: number, seconds: number, v: Seen, turn: number) {
  bands(ctx, TOWN_SKY, 0, STREET, v);
  for (let i = 0; i < 70; i++) {
    const x = rand(i * 3.1 + 5) * TOWN.w,
      y = rand(i * 5.7 + 2) * 140;
    if (x < v.x0 - 2 || x > v.x1 + 2 || y < v.y0 - 2 || y > v.y1) continue;
    const tw = Math.sin(seconds * (0.5 + rand(i) * 0.8) + i * 2.3);
    box(ctx, x, y, 1, 1, alpha(i % 3 ? '#FFE9B8' : '#A9C8E8', 0.55 + 0.35 * tw));
  }
  glow(ctx, 96, 46, 44, '#F4EBC8', 0.22);
  disc(ctx, 96, 46, 12, '#F4EBC8');
  disc(ctx, 92, 43, 2.4, '#E2D8B4');
  disc(ctx, 100, 50, 1.8, '#E2D8B4');
  disc(ctx, 99, 40, 1.2, '#E2D8B4');
  heartTrail(ctx, p);
  const wink = ease(span(p, GONE - 0.004, GONE + 0.01));
  if (wink > 0) {
    const tw = 0.65 + 0.35 * Math.sin(seconds * 2.2);
    glow(ctx, WINK.x, WINK.y, 8, TEAL, 0.6 * wink * tw);
    box(ctx, WINK.x - 0.5, WINK.y - 0.5, 1.5, 1.5, alpha('#DFFFEF', wink * (0.6 + 0.4 * tw)));
  }
  // Far rooftops peeking over the street.
  for (let i = 0; i < 25; i++) {
    const x = i * 20 - 4,
      top = 126 + rand(i + 40) * 30;
    if (x > v.x1 || x + 22 < v.x0) continue;
    box(ctx, x, top, 22, STREET - top, '#131B32');
    if (rand(i + 90) > 0.55) box(ctx, x + 7, top + 6, 3, 3, alpha('#E8B864', 0.5));
  }
  // The bakery, shut for the night.
  box(ctx, 0, 134, 110, STREET - 134, '#6A4A46');
  poly(ctx, '#3A2830', [-6, 136, 55, 112, 116, 136]);
  box(ctx, 80, 114, 8, 14, '#4A3436');
  pane(ctx, 16, 142, 14, 10);
  pane(ctx, 80, 142, 14, 10, '#C89A5A');
  box(ctx, 26, 152, 58, 9, '#2A1E26');
  write(ctx, 'BAKERY', 55, 159, { size: 6, color: '#F2C46A' });
  for (let i = 0; i < 10; i++) {
    const c = i % 2 ? '#F0E2CA' : '#C8584A';
    box(ctx, 5 + i * 10, 163, 10, 6, c);
    box(ctx, 6 + i * 10, 169, 8, 1.5, c);
  }
  box(ctx, 8, 175, 44, 26, '#2A2230');
  box(ctx, 10, 177, 40, 22, '#E9B86E');
  for (let k = 0; k < 4; k++) oval(ctx, 16 + k * 9, 195, 4, 2.2, '#B9772F');
  line(ctx, '#C98B45', 2, [14, 188, 26, 183]);
  line(ctx, '#C98B45', 2, [30, 188, 44, 183]);
  glow(ctx, 30, 190, 40, '#F2B860', 0.28);
  box(ctx, 62, 176, 18, 36, '#4A3030');
  box(ctx, 65, 179, 12, 10, '#C89A5A');
  // A neighbour.
  box(ctx, 110, 144, 58, STREET - 144, '#48506E');
  poly(ctx, '#2C3048', [106, 146, 139, 122, 172, 146]);
  pane(ctx, 120, 152, 12, 12);
  pane(ctx, 146, 152, 12, 12, '#3A3A52');
  box(ctx, 132, 184, 14, 28, '#2E3450');
  // The baker's house: round window, green door, a porch light left on.
  box(ctx, 226, 142, 96, STREET - 142, '#5C4E72');
  poly(ctx, '#342A44', [220, 144, 274, 116, 328, 144]);
  disc(ctx, 274, 131, 6.5, '#2A2230');
  disc(ctx, 274, 131, 5, '#F4CF84');
  box(ctx, 273.5, 126, 1, 10, '#2A2230');
  pane(ctx, 238, 152, 16, 14);
  pane(ctx, 294, 152, 16, 14, '#C89A5A');
  box(ctx, 236, 167, 20, 3, '#6A4A3A');
  for (let k = 0; k < 5; k++) box(ctx, 237 + k * 4, 165, 2, 2, k % 2 ? '#F2A0B0' : '#F6D06A');
  box(ctx, 264, 180, 17, 32, '#3E6E5E');
  box(ctx, 266, 182, 13, 12, '#4E8270');
  box(ctx, 277, 196, 2, 2, '#E9C46A');
  box(ctx, 261, 210, 23, 2, '#4A4458');
  box(ctx, 285, 184, 3, 4, '#FFE7B0');
  glow(ctx, 286, 186, 20, WARM, 0.3);
  // The Stargazer Station.
  box(ctx, 350, DECK, 122, STREET - DECK, '#34466C');
  box(ctx, 350, DECK, 122, 3, '#56688E');
  pane(ctx, 360, 168, 10, 12, '#9FC4F0');
  pane(ctx, 454, 168, 10, 12, '#9FC4F0');
  box(ctx, 380, 156, 76, 8, '#1C2440');
  write(ctx, 'STARGAZER STATION', 418, 162, { size: 4.5, color: '#9FC4F0' });
  box(ctx, 410, 186, 16, 26, '#232C46');
  halfDisc(ctx, 418, 186, 8, '#232C46');
  halfDisc(ctx, 418, 186, 5, '#8FB6E8');
  dome(ctx, turn);
  box(ctx, 350, DECK - 8, 122, 1, '#8A9AB8');
  for (let x = 352; x < 472; x += 10) box(ctx, x, DECK - 8, 1, 8, '#6A7A98');
  // The kid's tripod, with or without its spyglass.
  line(ctx, '#5A4A3A', 1.2, [352, 115, 345, DECK]);
  line(ctx, '#5A4A3A', 1.2, [352, 115, 359, DECK]);
  line(ctx, '#4A3C30', 1.2, [352, 115, 352, DECK]);
  // The street.
  box(ctx, 0, STREET, TOWN.w, H + 60 - STREET, '#1E2334');
  box(ctx, 0, STREET, TOWN.w, 2, '#39405A');
  for (let i = 0; i < 30; i++)
    box(ctx, (i * 37) % TOWN.w, STREET + 7 + ((i * 11) % 18), 8, 1, '#282E42');
  lamp(ctx, 214);
  lamp(ctx, 338);
}

/** Where the saucer is over town, as keyframes [p, x, y]. */
const SHIP_OUT = [
  [ARRIVE, -70, 36],
  [0.163, BAKER_STOP, 128],
  [0.203, BAKER_STOP, 128],
  [0.213, BUSKER_X, 128],
  [0.244, BUSKER_X, 128],
  [0.256, KID_X, 70],
  [0.289, KID_X, 70],
  [INSIDE, 396, 26],
] as const;
const SHIP_BACK = [
  [HOME, 250, -60],
  [0.674, BAKER_HOME, 128],
  [0.699, BAKER_HOME, 128],
  [0.705, BUSKER_X, 128],
  [0.726, BUSKER_X, 128],
  [0.735, KID_X, 70],
  [HEART + 0.004, KID_X, 70],
] as const;
function shipPath(p: number) {
  const dip = heartPoint(0);
  if (p < HOME) return { ...path(p, SHIP_OUT), s: 1 };
  if (p < HEART + 0.004) return { ...path(p, SHIP_BACK), s: 1 };
  if (p < HEART_FROM) {
    const t = ease(span(p, HEART + 0.004, 0.816));
    return { x: lerp(KID_X, dip.x, t), y: lerp(70, dip.y, t) - hump(t, 0, 1) * 16, s: 1 - 0.6 * t };
  }
  if (p < ZIP) {
    const q = heartPoint(ease(span(p, HEART_FROM, HEART_TO)) * TAU);
    return { ...q, s: 0.4 };
  }
  const t = easeIn(span(p, ZIP, GONE));
  return { x: lerp(dip.x, WINK.x, t), y: lerp(dip.y, WINK.y, t), s: 0.4 - 0.34 * t };
}
function ship(p: number, seconds: number) {
  const a = shipPath(p),
    before = shipPath(p - 0.002),
    after = shipPath(p + 0.002);
  const bob = p < HEART ? Math.sin(seconds * 2) * 1.5 : 0;
  return { x: a.x, y: a.y + bob, s: a.s, tilt: clamp((after.x - before.x) * 0.012, -0.3, 0.3) };
}
type Ship = ReturnType<typeof ship>;
const beamOf = (p: number, l: Lift) =>
  Math.min(ease(span(p, l.beam, l.beam + 0.01)), 1 - ease(span(p, l.off, l.off + 0.01)));
const aboardAt = (p: number): Aboard => [
  p >= UP.baker.done && p < DOWN.baker.move,
  p >= UP.busker.done && p < DOWN.busker.move,
  p >= UP.kid.done && p < DOWN.kid.move,
];
/** Guests enter and leave through the port: nothing above the saucer's belly shows. */
function belowPort(ctx: Ctx, sh: Ship, paint: () => void) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(sh.x - 60, sh.y + 7, 120, 260);
  ctx.clip();
  paint();
  ctx.restore();
}
/** How far along a lift a guest is: 0 on the ground, 1 inside the saucer. */
function hoist(p: number, l: Lift, up: boolean) {
  const t = ease(span(p, l.move, l.done));
  return up ? t : 1 - t;
}
/** How much the Stargazer's big telescope turns to watch the kid float away. */
function domeTurn(p: number, sh: Ship) {
  const rest = -0.38;
  if (p < UP.kid.beam || p > INSIDE) return rest;
  const y = lerp(DECK, sh.y + 8, hoist(p, UP.kid, true)) - 30;
  const watch = Math.atan2(KID_X - 418, DECK - 8 - y);
  return lerp(
    rest,
    watch,
    ease(span(p, UP.kid.beam, UP.kid.move + 0.004)) * (1 - span(p, 0.29, INSIDE)),
  );
}

function bakerTown(ctx: Ctx, p: number, seconds: number, sh: Ship) {
  const s = 1.35;
  const short = p > BREAD_TOSS[0] ? 12 : 22;
  if (p < UP.baker.move) {
    const walking = p < 0.1;
    const step = walking ? (p / FOOT) * Math.PI : undefined;
    const x = lerp(66, BAKER_STOP, span(p, 0, 0.1));
    const passing = within(p, 0.058, 0.086);
    const alarmed = p > ARRIVE + 0.012;
    const lift = p > UP.baker.beam;
    const conduct = passing ? stroke(p) : 0;
    baker(
      ctx,
      x,
      STREET,
      {
        size: s,
        step,
        arms: lift
          ? [0.9, 0.9]
          : alarmed
            ? [0.3, 0.5]
            : [walking ? -Math.sin(step ?? 0) * 0.6 : 0.2, 2.4 - conduct * 0.4],
        eyes: alarmed ? 'wide' : passing ? 'happy' : 'open',
        mouth: alarmed ? 'o' : passing ? 'grin' : 'smile',
        lean: alarmed ? -0.18 : 0,
      },
      alarmed ? 1.3 : -2 + conduct * 0.5,
      short,
    );
    return;
  }
  if (p < UP.baker.off + 0.02) {
    // Up he goes, rowing the air with the baguette.
    const row = seconds * 7;
    belowPort(ctx, sh, () =>
      baker(
        ctx,
        BAKER_STOP,
        lerp(STREET, sh.y + 8, hoist(p, UP.baker, true)),
        {
          size: s,
          step: seconds * 12,
          arms: [1.6 + Math.sin(row) * 0.9, 1.9 - Math.sin(row) * 0.9],
          eyes: 'wide',
          mouth: 'o',
        },
        -0.6 + Math.sin(row) * 0.9,
        short,
      ),
    );
    return;
  }
  if (p < DOWN.baker.move) return;
  const landed = p >= DOWN.baker.done;
  const wave = Math.sin(seconds * 7) * 0.35;
  const draw = () =>
    baker(
      ctx,
      BAKER_HOME,
      lerp(STREET, sh.y + 8, hoist(p, DOWN.baker, false)),
      {
        size: s,
        arms: landed ? [0.2, 2.7 + wave] : [0.5, 0.5],
        eyes: 'happy',
        mouth: landed ? 'grin' : 'smile',
        lean: landed ? -0.1 : 0,
      },
      landed ? -1.7 + wave : 1.2,
      short,
    );
  if (landed) draw();
  else belowPort(ctx, sh, draw);
}

function buskerTown(ctx: Ctx, p: number, seconds: number, sh: Ship) {
  const s = 1.35;
  const strum = strumming(p) ? stroke(p) : 0.4;
  if (p < UP.busker.move) {
    const greeting = within(p, 0.06, 0.084);
    guitarCase(ctx, CASE_X, STREET, s);
    busker(
      ctx,
      BUSKER_X,
      STREET,
      {
        size: s,
        facing: -1,
        eyes: greeting ? 'happy' : 'closed',
        mouth: greeting ? 'grin' : 'smile',
        lean: 0.04 + strum * 0.03,
      },
      strum,
    );
    return;
  }
  if (p < UP.busker.off + 0.02) {
    // He never stops playing. He does look down, once.
    const looks = within(p, LOOK_DOWN, LOOK_DOWN + 0.007);
    const after = p >= LOOK_DOWN + 0.007;
    const t = hoist(p, UP.busker, true);
    belowPort(ctx, sh, () => {
      const cy = lerp(
        STREET,
        sh.y + 8,
        ease(span(p, UP.busker.move + 0.005, UP.busker.done + 0.002)),
      );
      guitarCase(ctx, CASE_X + t * 14, cy, s, 3);
      for (let i = 0; i < 4; i++)
        box(
          ctx,
          CASE_X + t * 14 + (i - 1.5) * 6,
          cy - 8 - ((seconds * 14 + i * 9) % 16),
          2,
          2,
          '#F2C94C',
        );
      busker(
        ctx,
        BUSKER_X,
        lerp(STREET, sh.y + 8, t),
        {
          size: s,
          facing: -1,
          eyes: looks ? 'wide' : after ? 'happy' : 'closed',
          mouth: looks ? 'o' : after ? 'grin' : 'smile',
          lean: looks ? 0.35 : 0.04,
        },
        looks ? 0.5 : strum,
      );
    });
    return;
  }
  if (p < DOWN.busker.move) return;
  const landed = p >= DOWN.busker.done;
  const draw = () => {
    const y = lerp(STREET, sh.y + 8, hoist(p, DOWN.busker, false));
    guitarCase(ctx, CASE_X, y, s);
    busker(
      ctx,
      BUSKER_X,
      y,
      {
        size: s,
        facing: 1,
        arms: landed ? [1.1, 2.7 + Math.sin(seconds * 6 + 1) * 0.35] : [1.1, 0.6],
        eyes: 'happy',
        mouth: 'grin',
        lean: landed ? -0.1 : 0,
      },
      landed ? null : strum,
    );
  };
  if (landed) draw();
  else belowPort(ctx, sh, draw);
}

function kidTown(ctx: Ctx, p: number, seconds: number, sh: Ship) {
  const s = 1.5;
  const stowed = span(p, DOWN.kid.done, DOWN.kid.done + 0.004);
  if (p < UP.kid.move - 0.002 || stowed >= 1) spyglass(ctx, GLASS.x, GLASS.y, GLASS.angle, s);
  if (p < UP.kid.move) {
    const looking = p < SPOTTED;
    const pointing = within(p, SPOTTED + 0.004, UP.baker.beam);
    person(ctx, KID_X, DECK, {
      ...KID,
      size: s,
      facing: -1,
      arms: looking
        ? [1.2, 1.5]
        : pointing
          ? [0.3, 2.8]
          : p > UP.kid.beam
            ? [2.2, 2.4]
            : [0.4, 0.6],
      eyes: looking ? 'closed' : 'wide',
      mouth: looking ? 'flat' : 'o',
      lean: looking ? 0.15 : -0.1,
    });
    return;
  }
  if (p < UP.kid.off + 0.02) {
    // Up she goes, spyglass trained on the saucer the whole way.
    belowPort(ctx, sh, () => {
      const y = lerp(DECK, sh.y + 8, hoist(p, UP.kid, true));
      person(ctx, KID_X, y, {
        ...KID,
        size: s,
        facing: -1,
        arms: [2.3, 2.6],
        eyes: 'closed',
        mouth: 'o',
        step: seconds * 5,
      });
      spyglass(ctx, KID_X - 5, y - 32, -Math.PI / 2 - 0.25, s);
    });
    return;
  }
  if (p < DOWN.kid.move) return;
  const landed = p >= DOWN.kid.done;
  const y = lerp(DECK, sh.y + 8, hoist(p, DOWN.kid, false));
  let f: Figure;
  let hold: 'front' | 'back' | null = null;
  let bright = 0;
  if (!landed) f = { ...KID, size: s, facing: -1, arms: [0.4, 1.4], eyes: 'happy', mouth: 'smile' };
  else if (p < PEBBLE)
    f = {
      ...KID,
      size: s,
      facing: -1,
      arms: stowed < 1 ? [0.4, 1.4] : [2.5, 2.3],
      eyes: 'wide',
      mouth: 'o',
      lean: -0.12,
    };
  else if (p < HEART) {
    const happy = p > PEBBLE + 0.008;
    f = {
      ...KID,
      size: s,
      facing: -1,
      arms: [1.25, 1.35],
      eyes: happy ? 'happy' : 'wide',
      mouth: happy ? 'grin' : 'o',
    };
    hold = 'front';
    bright = ease(span(p, PEBBLE, PEBBLE + 0.014));
  } else if (p < FINAL) {
    const love = p > HEART_TO;
    f = {
      ...KID,
      size: s,
      facing: -1,
      arms: [0.3, 2.5],
      eyes: love ? 'happy' : 'open',
      mouth: love ? 'grin' : 'o',
      lean: -0.1,
    };
    hold = 'front';
    bright = 1;
  } else {
    f = {
      ...KID,
      size: s,
      facing: -1,
      arms: [2.3, 2.7 + Math.sin(seconds * 6 + 2) * 0.35],
      eyes: 'happy',
      mouth: 'grin',
      lean: -0.08,
    };
    hold = 'back';
    bright = 1;
  }
  const paint = () => {
    person(ctx, KID_X, y, f);
    if (stowed < 1) {
      const hand = handOf(KID_X, y, f);
      const t = ease(stowed);
      spyglass(
        ctx,
        lerp(hand.x, GLASS.x, t),
        lerp(hand.y, GLASS.y, t),
        lerp(1.9, GLASS.angle, t),
        s,
      );
    }
  };
  if (landed) paint();
  else belowPort(ctx, sh, paint);
  if (hold) {
    const h = handOf(KID_X, y, f, hold);
    glow(ctx, h.x, h.y - 6, 20, MINT, 0.3 * bright);
    pebble(ctx, h.x, h.y - 1, bright, 0.8);
  }
  // The souvenir drifts down the beam into her hands.
  if (within(p, DROP, PEBBLE)) {
    const t = ease(span(p, DROP, PEBBLE));
    const hand = handOf(KID_X, DECK, f);
    pebble(
      ctx,
      lerp(sh.x, hand.x, t) + Math.sin(t * 9) * 2,
      lerp(sh.y + 10, hand.y - 1, t),
      0.8,
      0.8,
    );
  }
}

function townScene(ctx: Ctx, p: number, seconds: number, v: Seen) {
  const sh = ship(p, seconds);
  townSet(ctx, p, seconds, v, domeTurn(p, sh));
  const lifts: [Lift, number][] = [
    [UP.baker, STREET],
    [UP.busker, STREET],
    [UP.kid, DECK],
    [DOWN.baker, STREET],
    [DOWN.busker, STREET],
    [DOWN.kid, DECK],
  ];
  let beam = 0;
  for (const [l, ground] of lifts) {
    const amount = beamOf(p, l);
    if (amount <= 0) continue;
    beam = amount;
    beamCone(ctx, sh.x, sh.y + 9, ground, amount, seconds);
  }
  buskerTown(ctx, p, seconds, sh);
  bakerTown(ctx, p, seconds, sh);
  kidTown(ctx, p, seconds, sh);
  if (p >= ARRIVE && !within(p, INSIDE, HOME) && p < GONE)
    saucer(ctx, sh.x, sh.y, {
      s: sh.s,
      seconds,
      tilt: sh.tilt,
      beam,
      aboard: aboardAt(p),
      wave: p > HOME,
    });
}

/** Through the eyepiece: a light that moves the wrong way for a star. */
function scopeView(ctx: Ctx, p: number, seconds: number) {
  box(ctx, 0, 0, W, H, '#05070D');
  const u = span(p, SCOPE, SPOTTED);
  ctx.save();
  ctx.beginPath();
  ctx.arc(160, 90, 72, 0, TAU);
  ctx.clip();
  box(ctx, 88, 18, 144, 144, '#0D1730');
  glow(ctx, 160, 150, 90, '#2A3E6A', 0.5);
  ctx.translate(-u * 12, u * 4);
  starfield(ctx, seconds, {
    count: 70,
    seed: 21,
    bottom: H,
    colors: ['#FFE9B8', '#A9C8E8', '#FFFFFF'],
  });
  const lx = 104 + u * 116,
    ly = 120 - u * 56 + Math.sin(u * 14) * 5;
  glow(ctx, lx, ly, 12 + u * 18, TEAL, 0.55);
  disc(ctx, lx, ly, 1.5 + u * 1.2, '#E8FFF2');
  faded(ctx, span(u, 0.5, 0.85), () => saucer(ctx, lx, ly, { s: 0.2 + u * 0.12, seconds }));
  ctx.restore();
  box(ctx, 159, 22, 1, 136, alpha('#A9C8E8', 0.12));
  box(ctx, 92, 89, 136, 1, alpha('#A9C8E8', 0.12));
  ctx.strokeStyle = '#6A5530';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(160, 90, 75, 0, TAU);
  ctx.stroke();
  line(ctx, alpha('#FFFFFF', 0.12), 2, [110, 50, 130, 34, 152, 26]);
}

// ——— Moon and Earth, for the window and the real thing ———
function moon(ctx: Ctx, x: number, y: number, r: number) {
  glow(ctx, x, y, r * 1.7, '#E8E4D8', 0.22);
  disc(ctx, x, y, r, '#D2CEC2');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  oval(ctx, x - r * 0.28, y - r * 0.22, r * 0.3, r * 0.2, '#B9B4A7');
  oval(ctx, x + r * 0.2, y + r * 0.28, r * 0.22, r * 0.14, '#BCB7AA');
  oval(ctx, x - r * 0.05, y + r * 0.05, r * 0.14, r * 0.1, '#C2BDB0');
  for (let k = 0; k < 7; k++) {
    const cx = x + (rand(k + 3) - 0.5) * r * 1.5,
      cy = y + (rand(k + 11) - 0.5) * r * 1.5,
      cr = r * (0.05 + rand(k + 19) * 0.06);
    disc(ctx, cx, cy, cr, '#ADA89B');
    disc(ctx, cx - cr * 0.3, cy - cr * 0.3, cr * 0.5, '#E2DED3');
  }
  disc(ctx, x + r * 0.55, y + r * 0.2, r * 1.02, alpha('#3A3E52', 0.35));
  ctx.restore();
}
function earth(ctx: Ctx, x: number, y: number, r: number) {
  glow(ctx, x, y, r * 1.8, '#8FD0FF', 0.3);
  disc(ctx, x, y, r, '#2E6FB8');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  oval(ctx, x - r * 0.35, y - r * 0.15, r * 0.35, r * 0.5, '#4FA36A');
  oval(ctx, x + r * 0.35, y + r * 0.3, r * 0.3, r * 0.22, '#5AAE6E');
  oval(ctx, x + r * 0.1, y - r * 0.55, r * 0.5, r * 0.12, alpha('#FFFFFF', 0.8));
  oval(ctx, x - r * 0.2, y + r * 0.55, r * 0.45, r * 0.1, alpha('#FFFFFF', 0.7));
  disc(ctx, x + r * 0.6, y + r * 0.35, r * 1.05, alpha('#0A1024', 0.45));
  ctx.restore();
}

// ——— Inside the saucer: a round cabin with a big porthole ———
const FLOOR = 162,
  DESK_Y = 136;
const WIN = { x: 160, y: 84, rx: 66, ry: 44 } as const;
const HUDDLE = { baker: 58, busker: 104, kid: 82 } as const;
const TOURISTS = [180, 198, 216] as const;
const DANCE = [150, 176, 202] as const;
// The Fork constellation: a crossbar, three prongs, and a handle.
const FORK_STARS = [
  [156, 102],
  [156, 89],
  [156, 76],
  [147, 76],
  [165, 76],
  [146, 62],
  [156, 60],
  [166, 62],
] as const;
const FORK_LINES = [
  [0, 1],
  [1, 2],
  [3, 4],
  [3, 5],
  [2, 6],
  [4, 7],
] as const;
function constellation(ctx: Ctx, p: number, seconds: number) {
  FORK_LINES.forEach(([a, b], i) => {
    const t = ease(span(p, STARS + 0.004 + i * 0.003, STARS + 0.008 + i * 0.003));
    if (t <= 0) return;
    const [ax, ay] = FORK_STARS[a],
      [bx, by] = FORK_STARS[b];
    line(ctx, alpha(MINT, 0.7), 0.7, [ax, ay, lerp(ax, bx, t), lerp(ay, by, t)]);
  });
  const lit = ease(span(p, STARS + 0.004, STARS + 0.03));
  FORK_STARS.forEach(([sx, sy], i) => {
    glow(ctx, sx, sy, 5, '#FFF3C8', 0.5 * lit * (0.8 + 0.2 * Math.sin(seconds * 2 + i)));
    box(ctx, sx - 0.5, sy - 0.5, 1.5, 1.5, '#FFF6DA');
  });
}
function porthole(ctx: Ctx, p: number, seconds: number) {
  const space = p >= TOUR;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(WIN.x, WIN.y, WIN.rx, WIN.ry, 0, 0, TAU);
  ctx.clip();
  box(ctx, WIN.x - WIN.rx, WIN.y - WIN.ry, WIN.rx * 2, WIN.ry * 2, space ? '#070A18' : '#0C1630');
  for (let i = 0; i < 40; i++) {
    const x = WIN.x - WIN.rx + rand(i * 2.3 + 7) * WIN.rx * 2,
      y = WIN.y - WIN.ry + rand(i * 4.1 + 3) * WIN.ry * 2;
    box(ctx, x, y, 1, 1, alpha('#FFE9B8', 0.5 + 0.3 * Math.sin(seconds + i)));
  }
  if (!space) {
    // Forktown's lights, far below.
    oval(ctx, WIN.x, WIN.y + 64, 96, 40, '#0A1222');
    glow(ctx, 160, 126, 54, WARM, 0.14);
    for (let i = 0; i < 26; i++)
      box(ctx, 104 + rand(i + 50) * 112, 112 + rand(i + 70) * 14, 1, 1, alpha(WARM, 0.8));
  } else {
    earth(ctx, 108, 104, 10);
    moon(ctx, 212, 72, 25);
  }
  if (p >= STARS) constellation(ctx, p, seconds);
  line(ctx, alpha('#FFFFFF', 0.08), 4, [112, 66, 128, 54, 150, 46]);
  ctx.restore();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#4E6C7A';
  ctx.beginPath();
  ctx.ellipse(WIN.x, WIN.y, WIN.rx + 2, WIN.ry + 2, 0, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    disc(ctx, WIN.x + Math.cos(a) * (WIN.rx + 2), WIN.y + Math.sin(a) * (WIN.ry + 2), 1, '#9AB8C4');
  }
}
function cabin(ctx: Ctx, p: number, seconds: number) {
  box(ctx, 0, 0, W, H, '#0C1824');
  glow(ctx, 160, 96, 200, '#1E4A52', 0.55);
  for (const x of [8, 56, 264, 312])
    line(ctx, '#15303C', 4, [x, 0, lerp(x, 160, 0.12), FLOOR - 10]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = alpha(TEAL, 0.35);
  ctx.beginPath();
  ctx.ellipse(160, -10, 190, 36, 0, 0, Math.PI);
  ctx.stroke();
  porthole(ctx, p, seconds);
  // The control desk under the window, buttons glowing softly.
  glow(ctx, 160, DESK_Y + 4, 70, TEAL, 0.16);
  box(ctx, 92, DESK_Y, 136, 16, '#27404E');
  box(ctx, 92, DESK_Y, 136, 2, '#5E8A96');
  const keys = ['#FF9FB8', TEAL, '#FFE08A', '#9FC4FF'];
  for (let i = 0; i < 14; i++)
    disc(
      ctx,
      99 + i * 9.4,
      DESK_Y + 7,
      1.5,
      alpha(keys[i % 4], 0.65 + 0.35 * Math.sin(seconds * 1.6 + i)),
    );
  // Floor.
  oval(ctx, 160, 186, 196, 36, '#18293A');
  oval(ctx, 160, 188, 150, 24, '#203648');
  ctx.strokeStyle = alpha(TEAL, 0.3);
  ctx.beginPath();
  ctx.ellipse(160, 186, 170, 28, 0, Math.PI, TAU);
  ctx.stroke();
  // The round door, which slides up to let the crew in.
  const open = ease(span(p, INSIDE + 0.004, INSIDE + 0.016));
  box(ctx, 282, 112, 32, FLOOR - 112, '#2E4A58');
  halfDisc(ctx, 298, 112, 16, '#2E4A58');
  box(ctx, 286, 112, 24, FLOOR - 112, '#DFFFEA');
  halfDisc(ctx, 298, 112, 12, '#DFFFEA');
  box(ctx, 286, 100 - open * 48, 24, FLOOR - 100, '#3E6272');
  box(ctx, 286, 100 - open * 48, 24, 2, '#6E96A6');
  box(ctx, 292, 130 - open * 48, 12, 2, '#6E96A6');
  if (open > 0) {
    glow(ctx, 298, 140, 70, MINT, 0.3 * open);
    poly(ctx, alpha('#DFFFEA', 0.14 * open), [286, FLOOR, 310, FLOOR, 250, 180, 140, 180]);
  }
}
/** A tourist's shadow thrown huge across the wall by the light from the door. */
function bigShadow(ctx: Ctx, x: number, s: number, seconds: number, seed: number) {
  const c = '#03070C',
    wob = Math.sin(seconds * 5 + seed * 2.1);
  box(ctx, x - 3 * s, FLOOR - 3 * s, 2 * s, 3 * s, c);
  box(ctx, x + 1 * s, FLOOR - 3 * s, 2 * s, 3 * s, c);
  oval(ctx, x, FLOOR - 7 * s, 4.6 * s, 4.8 * s, c);
  oval(ctx, x, FLOOR - 14.5 * s, 7.6 * s, 6.2 * s, c);
  for (const side of [-1, 1]) {
    const tx = x + side * (5.2 + wob * 1.3) * s,
      ty = FLOOR - 27 * s;
    line(ctx, c, 0.9 * s, [x + side * 2.4 * s, FLOOR - 19 * s, tx, ty]);
    disc(ctx, tx, ty, 1.5 * s, c);
  }
}

function guests(ctx: Ctx, p: number, seconds: number) {
  const s = 1.5;
  if (p < TOUR) {
    const scared = p < CAMERAS;
    const relieved = p >= RELIEF;
    const flinch = Math.max(...CLICKS.map((c) => hump(p, c, c + 0.005))) * 2;
    const shiver = (i: number) => (scared ? Math.sin(seconds * 38 + i * 2) * 0.5 : 0);
    const face: Pick<Figure, 'eyes' | 'mouth'> = scared
      ? { eyes: 'wide', mouth: 'o' }
      : relieved
        ? { eyes: 'happy', mouth: 'grin' }
        : { eyes: 'open', mouth: 'flat' };
    const lower = ease(span(p, CAMERAS, CARD));
    baker(
      ctx,
      HUDDLE.baker + shiver(0),
      FLOOR - flinch,
      {
        size: s,
        arms: relieved ? [0.3, 0.6] : [0.4, 1.6 - lower * 0.8],
        ...face,
        lean: scared ? -0.08 : 0,
      },
      relieved ? 1.2 : lerp(-0.25, 0.8, lower),
    );
    const laugh = relieved ? Math.sin(seconds * 9) * 0.06 : 0;
    busker(
      ctx,
      HUDDLE.busker + shiver(1),
      FLOOR - flinch,
      { size: s, ...face, lean: (scared ? -0.12 : 0) - laugh },
      0.4,
    );
    // The kid steps up, takes the map, and turns it the right way round.
    const walk = span(p, RELIEF + 0.003, MAP_TAKE);
    const kx = lerp(HUDDLE.kid, TOURISTS[0] - 24, ease(walk));
    const holding = p >= MAP_TAKE;
    const kf: Figure = {
      ...KID,
      size: s,
      facing: 1,
      step: walk > 0 && walk < 1 ? seconds * 14 : undefined,
      arms: holding ? [0.4, 1.7] : relieved ? [0.3, 0.4] : [1.3, 1.3],
      ...(relieved ? { eyes: 'happy', mouth: 'grin' } : face),
    };
    person(ctx, kx + shiver(2), FLOOR - flinch, kf);
    if (!holding && !relieved) {
      const h = handOf(kx + shiver(2), FLOOR - flinch, kf);
      spyglass(ctx, h.x - 4, h.y - 6, 1.1, 1.2);
    }
    if (holding) {
      const h = handOf(kx, FLOOR, kf);
      ctx.save();
      ctx.translate(h.x + 4, h.y - 3);
      ctx.scale(1.3, 1.3);
      ctx.rotate(Math.PI * (1 - ease(span(p, MAP_TAKE + 0.001, MAP_FLIP))));
      mapSheet(ctx);
      ctx.restore();
    }
    return;
  }
  // The party, somewhere past the moon.
  if (p < STARS) {
    busker(
      ctx,
      76,
      FLOOR,
      { size: s, facing: 1, eyes: 'happy', mouth: 'grin', lean: stroke(p) * 0.04 },
      stroke(p),
    );
    const tossed = BREAD_TOSS.filter((t) => p >= t).length;
    const tear = Math.max(...BREAD_TOSS.map((t) => hump(p, t - 0.004, t + 0.002)));
    const bf: Figure = {
      ...BAKER,
      size: s,
      facing: -1,
      arms: [0.4, 1.2 + tear * 0.8],
      eyes: 'happy',
      mouth: 'grin',
    };
    baker(ctx, 238, FLOOR, bf, -2.4 + tear * 0.6, 22 - tossed * 3.4);
    const hand = handOf(238, FLOOR, bf);
    BREAD_TOSS.forEach((t, i) => {
      const f = span(p, t, t + 0.007);
      if (f <= 0 || f >= 1) return;
      const bx = lerp(hand.x, DANCE[i] + 3, f),
        by = lerp(hand.y, FLOOR - 14, f) - hump(f, 0, 1) * 16;
      box(ctx, bx - 2, by - 1, 4, 2.4, '#C98B45');
    });
  }
  const kf: Figure = {
    ...KID,
    size: s,
    facing: 1,
    arms: [0.3, 2.55 + Math.sin(seconds * 2) * 0.08],
    eyes: 'happy',
    mouth: 'grin',
    lean: -0.06,
  };
  person(ctx, 132, FLOOR, kf);
}

function tourists(ctx: Ctx, p: number, seconds: number) {
  const s = 1.05;
  if (p < REVEAL) return;
  if (p < TOUR) {
    TOURISTS.forEach((tx, i) => {
      const walk = span(p, REVEAL + i * 0.003, REVEAL + 0.017 + i * 0.003);
      const x = lerp(306 + i * 8, tx, ease(walk));
      const toddle = walk > 0 && walk < 1 ? Math.abs(Math.sin(seconds * 12 + i)) * 1.4 : 0;
      let hold: Hold = 'camera';
      let flip = Math.PI;
      if (p >= CAMERAS && p < CARD && p > CLICKS[i] - 0.006) hold = 'shoot';
      if (p >= CARD && p < RELIEF + 0.006) hold = i === 0 ? 'map' : i === 1 ? 'card' : 'point';
      if (i === 0 && p >= CARD) flip = Math.PI + Math.sin(seconds * 3) * 0.5;
      if (i === 0 && p >= RELIEF && p < MAP_TAKE) hold = 'map';
      if (i === 0 && p >= MAP_TAKE) hold = 'none';
      const glee = p >= MAP_FLIP;
      const hop = glee ? hump(p, MAP_FLIP + i * 0.002, MAP_FLIP + 0.007 + i * 0.002) * 5 : toddle;
      alien(ctx, x, FLOOR, s, {
        seconds,
        seed: i,
        facing: -1,
        hold,
        flip,
        hop,
        eyes: glee ? 'happy' : 'big',
        look: p < CAMERAS ? -1 : 0,
        shake: hump(p, CLICKS[i], CLICKS[i] + 0.004),
      });
    });
    return;
  }
  if (p < STARS) {
    DANCE.forEach((dx, i) => {
      const beat = (p - PARTY) / BEAT;
      const bar = Math.floor((beat + i) / 3);
      const fed = p >= BREAD_TOSS[i] + 0.007 && p < BREAD_TOSS[i] + 0.017;
      alien(ctx, dx, FLOOR, s, {
        seconds,
        seed: i + 4,
        facing: bar % 2 ? 1 : -1,
        hold: fed ? 'bread' : 'dance',
        hop: Math.abs(Math.sin(beat * Math.PI)) * 3,
        eyes: 'happy',
      });
    });
    return;
  }
  // One tourist hops up on the desk to photograph the Fork.
  const shoot = within(p, PHOTO - 0.005, PHOTO + 0.01);
  alien(ctx, 184, DESK_Y, s, {
    seconds,
    seed: 7,
    facing: -1,
    hold: shoot ? 'shoot' : 'point',
    up: true,
    look: -1,
    eyes: p > PHOTO + 0.01 ? 'happy' : 'big',
    shake: hump(p, PHOTO, PHOTO + 0.004),
  });
}

function cabinScene(ctx: Ctx, p: number, seconds: number) {
  cabin(ctx, p, seconds);
  if (within(p, INSIDE, REVEAL)) {
    const u = ease(span(p, INSIDE + 0.008, REVEAL));
    faded(
      ctx,
      0.5 * ease(span(p, INSIDE + 0.008, INSIDE + 0.02)) * (1 - span(p, REVEAL, REVEAL + 0.01)),
      () => TOURISTS.forEach((_, i) => bigShadow(ctx, lerp(292, 186 + i * 36, u), 3.1, seconds, i)),
    );
  }
  guests(ctx, p, seconds);
  tourists(ctx, p, seconds);
}

// ——— The grand tour: Forktown from above ———
const AIR: World = { w: 480, h: 270 };
const FORK_AT = { x: 240, y: 132 } as const;
const ROADS = [
  [240, 290, 240, 172],
  [240, 172, 160, 104, 128, -20],
  [240, 172, 320, 104, 352, -20],
  [40, 222, 440, 222],
] as const;
const ROOFS = ['#7A4A4A', '#4A5A7A', '#6A5A3A', '#5A4A6A', '#3E6A5A'] as const;
const AIR_HOUSES: readonly (readonly [number, number, number])[] = [
  [212, 196],
  [268, 196],
  [212, 250],
  [268, 250],
  [184, 150],
  [150, 118],
  [200, 118],
  [118, 78],
  [170, 70],
  [296, 150],
  [330, 118],
  [280, 118],
  [362, 78],
  [312, 70],
  [120, 204],
  [360, 244],
  [150, 250],
  [420, 204],
].map(([x, y], i) => [x, y, i] as const);
const AIR_LAMPS = [
  [228, 250],
  [252, 206],
  [212, 160],
  [268, 160],
  [180, 120],
  [300, 120],
  [150, 70],
  [336, 70],
  [100, 212],
  [380, 212],
] as const;
function airHouse(ctx: Ctx, x: number, y: number, i: number) {
  const roof = ROOFS[i % ROOFS.length];
  box(ctx, x - 8, y - 6, 16, 8, roof);
  box(ctx, x - 8, y - 2, 16, 1, mix(roof, '#0B0E14', 0.35));
  box(ctx, x - 8, y + 2, 16, 5, '#2A2E40');
  box(ctx, x - 4, y + 3, 3, 2, i % 3 ? WARM : '#6A6A7A');
  box(ctx, x + 2, y + 3, 3, 2, i % 2 ? WARM : '#6A6A7A');
}
function aerial(ctx: Ctx, seconds: number, v: Seen) {
  box(ctx, v.x0 - 2, v.y0 - 2, v.x1 - v.x0 + 4, v.y1 - v.y0 + 4, '#13221D');
  for (let i = 0; i < 70; i++)
    box(ctx, rand(i + 300) * AIR.w, rand(i + 400) * AIR.h, 3, 1, i % 2 ? '#182A24' : '#0F1C18');
  for (const r of ROADS) {
    line(ctx, '#2A3240', 16, r);
    line(ctx, '#384254', 12, r);
  }
  // The pond, holding the moon.
  oval(ctx, 382, 150, 42, 22, '#1C3A54');
  oval(ctx, 382, 150, 38, 19, '#26506E');
  disc(ctx, 394, 144, 4.5, alpha('#F4EFCF', 0.85));
  for (let k = 0; k < 2; k++) {
    const t = (seconds * 0.4 + k * 0.5) % 1;
    ctx.strokeStyle = alpha('#9FC4E0', 0.5 * (1 - t));
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(372, 154, 4 + t * 14, 1.5 + t * 5, 0, 0, TAU);
    ctx.stroke();
  }
  // The Starlight Cinema, mid-show (the film on its screen looks familiar).
  const cx = 96,
    cy = 150;
  glow(ctx, cx, cy - 10, 56, '#C8D8FF', 0.28);
  box(ctx, cx - 30, cy - 28, 60, 32, '#1A1A22');
  box(ctx, cx - 28, cy - 26, 56, 14, '#6F86C8');
  box(ctx, cx - 28, cy - 12, 56, 14, '#E8A8C0');
  saucer(ctx, cx + Math.sin(seconds * 0.8) * 12, cy - 13, { s: 0.2, seconds, dark: 1 });
  box(ctx, cx - 30, cy + 4, 2, 8, '#2A2A34');
  box(ctx, cx + 28, cy + 4, 2, 8, '#2A2A34');
  const rugs = ['#D9573E', '#F2C94C', '#7B86D8', '#6FC8A0'];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 6; c++) box(ctx, cx - 26 + c * 9, cy + 12 + r * 7, 6, 4, rugs[(r + c) % 4]);
  // The Stargazer Station.
  box(ctx, 400, 72, 30, 16, '#34466C');
  disc(ctx, 415, 72, 11, '#4C7CC4');
  box(ctx, 414, 61, 2, 11, '#121A2E');
  for (const [hx, hy, i] of AIR_HOUSES) airHouse(ctx, hx, hy, i);
  for (const [lx, ly] of AIR_LAMPS) {
    glow(ctx, lx, ly, 10, WARM, 0.4);
    box(ctx, lx - 0.5, ly - 0.5, 1.5, 1.5, '#FFE7B0');
  }
  // The Lantern Fork: a lantern for every house, glowing in the V of the roads.
  const { x, y } = FORK_AT;
  glow(ctx, x, y - 6, 52, '#FFC860', 0.4);
  box(ctx, x - 2, y + 2, 4, 14, '#4A3426');
  disc(ctx, x - 14, y - 6, 15, '#2A5234');
  disc(ctx, x + 2, y - 14, 17, '#2F5A3A');
  disc(ctx, x + 17, y - 5, 13, '#2A5234');
  disc(ctx, x - 4, y - 18, 7, '#3A6A44');
  for (let k = 0; k < 16; k++) {
    const a = rand(k + 60) * TAU,
      d = 4 + rand(k + 70) * 12;
    const lx = x + Math.cos(a) * d * 1.4,
      ly = y - 9 + Math.sin(a) * d * 0.8;
    box(ctx, lx - 1, ly - 1, 2, 3, alpha('#FFD06A', 0.75 + 0.25 * Math.sin(seconds * 1.5 + k)));
  }
}
function tourPath(p: number) {
  const u = span(p, TOUR, CLOUDS);
  const a = Math.PI * 0.85 + u * TAU * 0.95;
  const climb = easeIn(span(u, 0.8, 1));
  return {
    x: FORK_AT.x + Math.cos(a) * 150,
    y: FORK_AT.y + 10 + Math.sin(a) * 78 - climb * 20,
    s: 0.72 + climb * 0.9,
    tilt: Math.cos(a) * 0.22,
  };
}
function tourScene(ctx: Ctx, p: number, seconds: number) {
  const t = tourPath(p);
  const view = { x: lerp(FORK_AT.x, t.x, 0.6), y: lerp(FORK_AT.y + 10, t.y, 0.6), zoom: 1.35 };
  film(ctx, AIR, view, (v) => {
    aerial(ctx, seconds, v);
    glow(ctx, t.x, t.y + 30, 34, MINT, 0.3);
    saucer(ctx, t.x, t.y, { s: t.s, seconds, tilt: t.tilt, aboard: [true, true, true] });
  });
  // Wisps of cloud below the saucer, drifting faster than the town: parallax.
  for (let i = 0; i < 5; i++) {
    const x = ((((rand(i + 5) * 560 - view.x * 1.6) % 560) + 560) % 560) - 120,
      y = ((((rand(i + 15) * 320 - view.y * 1.6) % 320) + 320) % 320) - 70;
    oval(ctx, x, y, 46, 12, alpha('#C8D4E8', 0.1));
    oval(ctx, x + 20, y - 5, 26, 9, alpha('#C8D4E8', 0.08));
  }
}

/** Straight up through the clouds. */
function climbScene(ctx: Ctx, p: number, seconds: number) {
  const u = span(p, CLOUDS, MOON);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix('#1A2A54', '#04050E', u));
  g.addColorStop(1, mix('#34467A', '#0C1030', u));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  faded(ctx, span(u, 0.35, 1), () => starfield(ctx, seconds, { count: 60, seed: 4, bottom: H }));
  const clouds = (layer: number) => {
    const speed = [300, 520, 900][layer],
      color = ['#3A4A72', '#5A6C94', '#8A9CC0'][layer];
    faded(ctx, (1 - span(u, 0.5, 0.85)) * [0.9, 0.9, 0.55][layer], () => {
      for (let i = 0; i < 6; i++) {
        const y = ((rand(i + layer * 10) * 320 + u * speed) % 320) - 70,
          x = rand(i * 3 + layer * 7) * 380 - 30,
          r = 22 + layer * 12;
        oval(ctx, x, y, r * 1.6, r * 0.45, color);
        oval(ctx, x - r * 0.5, y - r * 0.2, r * 0.8, r * 0.4, color);
        oval(ctx, x + r * 0.6, y - r * 0.25, r * 0.7, r * 0.38, color);
      }
    });
  };
  clouds(0);
  clouds(1);
  const sy = 100 - u * 16;
  const tail = ctx.createLinearGradient(0, sy, 0, H);
  tail.addColorStop(0, alpha(TEAL, 0.35));
  tail.addColorStop(1, alpha(TEAL, 0));
  fillPath(ctx, tail, [148, sy + 8, 172, sy + 8, 196, H, 124, H]);
  for (let i = 0; i < 10; i++) {
    const y = ((rand(i + 80) * 220 + u * 1400) % 220) - 20;
    box(ctx, rand(i + 90) * W, y, 1, 14, alpha('#DFFFEF', 0.25));
  }
  saucer(ctx, 160, sy, {
    s: 1.3,
    seconds,
    tilt: Math.sin(seconds * 3) * 0.05,
    aboard: [true, true, true],
  });
  clouds(2);
}

/** Around the moon, with the Earth hanging in the dark. */
const MOON_AT = { x: 214, y: 104, r: 54 } as const;
const SPACE_CAM = [
  [MOON, 176, 92, 1.0],
  [0.56, 192, 98, 1.08],
  [PARTY, 204, 104, 1.22],
] as const;
function spaceScene(ctx: Ctx, p: number, seconds: number) {
  box(ctx, 0, 0, W, H, '#05060F');
  glow(ctx, 60, 40, 150, '#1A2350', 0.45);
  glow(ctx, 270, 24, 120, '#3A1E50', 0.3);
  starfield(ctx, seconds, { count: 90, seed: 31, bottom: H });
  earth(ctx, 62, 42, 20);
  const u = span(p, MOON + 0.002, PARTY - 0.004);
  const orbit = (a: number) => ({
    x: MOON_AT.x + Math.cos(a) * 96,
    y: MOON_AT.y + Math.sin(a) * 26 - Math.cos(a) * 8,
  });
  const a = Math.PI * 0.95 + u * TAU * 1.05;
  const front = Math.sin(a) > 0;
  const at = orbit(a);
  const drawShip = () => {
    const d = Math.hypot(at.x - MOON_AT.x, at.y - MOON_AT.y);
    const dark = front ? clamp(1 - (d - (MOON_AT.r - 14)) / 12) : 0;
    for (let k = 1; k < 9; k++) {
      const b = a - k * 0.06;
      if (Math.sin(b) > 0 === front) {
        const q = orbit(b);
        disc(ctx, q.x, q.y + 2, 1, alpha(TEAL, 0.5 - k * 0.05));
      }
    }
    saucer(ctx, at.x, at.y, {
      s: 0.5 + 0.18 * Math.sin(a),
      seconds,
      tilt: -Math.cos(a) * 0.15,
      dark,
      aboard: [true, true, true],
      wave: true,
    });
  };
  if (!front) drawShip();
  moon(ctx, MOON_AT.x, MOON_AT.y, MOON_AT.r);
  if (front) drawShip();
}

// ——— Cameras: [p, x, y, zoom]; two keys at one p are a hard cut ———
const TOWN_CAM = [
  [0, 240, 124, 0.75],
  [0.04, 196, 146, 0.95],
  [0.04, 118, 172, 1.9],
  [0.08, 206, 172, 1.9],
  [0.08, 366, 126, 2.6],
  [SCOPE, 364, 124, 2.8],
  [SPOTTED, 366, 122, 2.5],
  [ARRIVE, 368, 120, 2.3],
  [ARRIVE, 170, 120, 1.0],
  [0.165, 226, 140, 1.12],
  [0.165, 236, 160, 1.6],
  [0.2, 234, 152, 1.45],
  [0.213, 205, 168, 1.75],
  [0.245, 200, 160, 1.6],
  [0.245, 290, 120, 1.0],
  [0.258, 372, 112, 1.5],
  [INSIDE, 374, 96, 1.35],
  [HOME, 250, 140, 1.2],
  [ROOF, 222, 160, 1.45],
  [ROOF, 372, 106, 1.7],
  [PEBBLE, 372, 118, 2.0],
  [PEBBLE, 364, 128, 3.6],
  [HEART, 364, 126, 3.9],
  [HEART, 330, 90, 1.0],
  [FINAL, 320, 92, 1.05],
  [FINAL, 372, 128, 1.9],
  [0.93, 300, 136, 1.05],
  [1, 300, 134, 1.05],
] as const;
const CABIN_CAM = [
  [INSIDE, 132, 104, 1.2],
  [REVEAL, 146, 110, 1.32],
  [REVEAL, 250, 140, 2.5],
  [CAMERAS, 226, 140, 2.3],
  [CAMERAS, 138, 124, 1.75],
  [CARD, 142, 124, 1.8],
  [CARD, 198, 128, 3.0],
  [RELIEF, 198, 126, 3.2],
  [RELIEF, 128, 122, 1.7],
  [TOUR, 138, 120, 1.6],
  [PARTY, 158, 116, 1.35],
  [STARS, 160, 118, 1.45],
  [STARS, 160, 108, 2.0],
  [HOME, 162, 104, 2.15],
] as const;

// ——— SCORE ———
/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const visitorsOverForktownScore: FilmModule['score'] = (film) =>
  composeFilm(
    film,
    { root: ROOT, voice: 'bell', intro: [12, 13, 19], outro: [0, 7, 12, 16] },
    (s) => {
      const bpm = 60 / (BEAT * s.story);
      const len = (from: number, to: number) => (to - from) * s.story;
      /** Tourist talk: quick little pitched beeps. */
      const chatter = (p: number, pitches: readonly number[], pan = 0.5) => {
        s.fx('beep', p, 0.1, 0.03, pan);
        pitches.forEach((pitch, i) =>
          s.note(p + 0.002 + i * 0.0022, pitch, 0.09, 'lead', 0.035, pan),
        );
      };
      // Night air, and the saucer's hum whenever it is near.
      s.fx('wind', 0, len(0, ARRIVE), 0.05);
      s.fx('wind', FINAL, len(FINAL, 1) - 0.4, 0.05);
      s.fx('hum', ARRIVE, len(ARRIVE, INSIDE), 0.09);
      s.fx('hum', INSIDE, len(INSIDE, TOUR), 0.035);
      s.fx('hum', TOUR, len(TOUR, CLOUDS), 0.07, 0.2);
      s.fx('hum', MOON, len(MOON, PARTY), 0.04, 0.3);
      s.fx('hum', HOME, len(HOME, HEART + 0.015), 0.08);

      // Act one: mysterious minor bells over a quiet street.
      s.section({
        from: 0,
        to: ARRIVE,
        bpm: bpm / 2,
        root: ROOT,
        minor: true,
        chords: [0, -4],
        melody: [12, null, 13, null, 19, null, 22, 20, 19, null, 13, null, 12, null, null, null],
        voice: 'bell',
        gain: 0.5,
        level: 0.5,
        fade: 1.5,
      });
      s.fx('whir', SCOPE + 0.003, len(SCOPE, SPOTTED), 0.04, 0.3);
      s.fx('gasp', SPOTTED + 0.003, 0.5, 0.12, 0.4);
      // The busker's guitar: a pluck on every beat his hand crosses the strings.
      for (const [a, b] of STRUMS) {
        const riff = a > HOME ? [0, 7, 12, 16, 12, 7, 4, 7] : [0, 7, 12, 15, 12, 7, 3, 7];
        for (let k = Math.ceil(a / BEAT); k * BEAT < b; k++)
          if (!within(k * BEAT, LOOK_DOWN, LOOK_DOWN + 0.007))
            s.note(k * BEAT, ROOT + riff[k % 8], 0.6, 'pluck', 0.075, -0.2);
      }

      // Act two: the beam-ups, tension rising with each one.
      s.section({
        from: ARRIVE,
        to: UP.baker.off + 0.01,
        bpm,
        root: ROOT,
        minor: true,
        chords: [0, 0, -4, 1],
        melody: [24, null, null, 25, null, null, 24, null],
        voice: 'bell',
        gain: 0.35,
        groove: 'tick',
        level: 0.55,
        fade: 0.8,
      });
      s.section({
        from: UP.baker.off + 0.01,
        to: UP.busker.off + 0.01,
        bpm,
        root: ROOT,
        minor: true,
        chords: [0, -4, 0, 1],
        melody: [12, null, 15, null, 19, null, 15, null],
        voice: 'keys',
        gain: 0.3,
        groove: 'pulse',
        level: 0.62,
        fade: 0.4,
      });
      s.section({
        from: UP.busker.off + 0.01,
        to: INSIDE,
        bpm,
        root: ROOT,
        minor: true,
        chords: [0, 1],
        melody: [12, 15, 19, 24, 19, 15, 12, 13],
        step: 0.5,
        voice: 'bell',
        gain: 0.38,
        groove: 'pulse',
        level: 0.78,
        fade: 0.5,
      });
      for (const [l, x] of [
        [UP.baker, BAKER_STOP],
        [UP.busker, BUSKER_X],
        [UP.kid, KID_X],
        [DOWN.baker, BAKER_HOME],
        [DOWN.busker, BUSKER_X],
        [DOWN.kid, KID_X],
      ] as const)
        s.fx('beam', l.beam, len(l.beam, l.off + 0.01), 0.12, (x - 240) / 300);
      s.fx('gasp', UP.baker.beam + 0.004, 0.6, 0.14, 0);
      s.fx('sparkle', UP.busker.move + 0.006, 0.8, 0.05, -0.2);
      s.fx('whir', UP.kid.beam, len(UP.kid.beam, UP.kid.done), 0.05, 0.6);
      s.fx('woo', UP.kid.move + 0.004, 1.2, 0.1, 0.4);

      // Act three: inside, in the dark... and then the tourists.
      s.fx('whir', INSIDE + 0.004, 0.7, 0.08, 0.7);
      s.fx('gasp', INSIDE + 0.014, 0.7, 0.16, -0.4);
      s.section({
        from: INSIDE,
        to: CAMERAS,
        bpm: 60,
        root: ROOT - 12,
        minor: true,
        chords: [0, 1],
        melody: [null, 12, null, 13],
        voice: 'bell',
        gain: 0.3,
        level: 0.5,
        fade: 0.8,
      });
      for (let k = 0; k < 8; k++) s.fx('squeak', REVEAL + 0.002 + k * 0.0022, 0.08, 0.035, 0.6);
      chatter(REVEAL + 0.02, [88, 91, 86]);
      for (const c of CLICKS) s.fx('click', c, 0.12, 0.22, 0.4);
      s.section({
        from: CAMERAS,
        to: TOUR,
        bpm,
        root: ROOT,
        chords: [0, 7, 0, 5],
        melody: [0, null, 4, null, 7, 4, 0, null, 2, null, 5, null, 7, null, null, null],
        step: 0.5,
        voice: 'keys',
        gain: 0.42,
        groove: 'tick',
        level: 0.5,
        fade: 0.6,
      });
      chatter(CARD + 0.006, [84, 86, 88, 93]);
      chatter(CARD + 0.019, [86, 84, 91, 96], 0.3);
      s.chord(RELIEF, [60, 64, 67, 72], 2.2, 'pad', 0.04);
      s.fx('rustle', MAP_TAKE, 0.4, 0.08, 0.2);
      s.fx('giggle', MAP_FLIP, 1.0, 0.1, 0.4);
      chatter(MAP_FLIP + 0.004, [91, 93, 96], 0.4);

      // Act four: the joyride waltz.
      s.section({
        from: TOUR,
        to: CLOUDS,
        bpm,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: [12, null, 16, 19, null, 16, 17, null, 21, 19, null, null],
        voice: 'bell',
        gain: 0.55,
        groove: 'waltz',
        level: 0.8,
        fade: 0.8,
      });
      s.fx('warp', CLOUDS - 0.004, len(CLOUDS, MOON) + 0.4, 0.18);
      s.fx('sweep', CLOUDS + 0.004, 1.3, 0.07);
      s.section({
        from: MOON,
        to: PARTY,
        bpm,
        root: ROOT + 5,
        chords: [0, 5, 7, 0],
        melody: [12, null, null, 16, null, null, 19, null, null, 24, null, null],
        voice: 'bell',
        gain: 0.5,
        groove: 'waltz',
        level: 0.55,
        fade: 0.8,
      });
      s.fx('sparkle', 0.572, 1, 0.06, 0.2);
      // The party: the busker has the tune now.
      s.section({
        from: PARTY,
        to: STARS,
        bpm,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: [12, 16, 19, 17, 21, 24, 19, 23, 26, 24, 19, 16],
        voice: 'pluck',
        gain: 0.9,
        groove: 'waltz',
        level: 0.8,
        fade: 0.4,
      });
      BREAD_TOSS.forEach((t, i) => {
        s.fx('swish', t, 0.25, 0.05, 0.5);
        s.fx('crunch', t + 0.008, 0.3, 0.08, (DANCE[i] - 160) / 200);
      });
      chatter(0.608, [91, 88, 93], 0.1);
      chatter(0.624, [93, 96, 91, 98], -0.1);
      s.section({
        from: STARS,
        to: HOME,
        bpm,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: [24, null, null, 28, null, null, 31, null, null, 28, null, null],
        voice: 'bell',
        gain: 0.4,
        groove: 'waltz',
        level: 0.5,
        fade: 0.6,
      });
      s.fx('sparkle', STARS + 0.004, 1.6, 0.06, -0.2);
      s.fx('click', PHOTO, 0.12, 0.2, 0.3);

      // Act five: a warm goodbye, one doorstep at a time.
      s.section({
        from: HOME,
        to: HEART,
        bpm: bpm * 0.75,
        root: ROOT,
        chords: [0, 5, 0, 7, -3, 5, 7, 0],
        melody: [7, null, 9, 7, 4, null, 2, null, 4, 7, 9, 12, 11, null, 7, null],
        voice: 'keys',
        gain: 0.45,
        level: 0.6,
        fade: 1,
      });
      for (const l of [DOWN.baker, DOWN.busker, DOWN.kid]) s.fx('step', l.done, 0.15, 0.1);
      chatter(DOWN.kid.beam + 0.004, [93, 91, 88, 84]);
      s.fx('sparkle', DROP, 1.2, 0.07, 0.3);
      s.fx('chime', PEBBLE, 1.4, 0.1, 0.2);

      // Act six: a heart in the sky, and a warm goodnight.
      s.fx('whir', HEART + 0.004, 0.8, 0.07, 0.3);
      s.section({
        from: HEART,
        to: FINAL,
        bpm,
        root: ROOT + 5,
        chords: [0, 5],
        melody: [12, 16, 19, 24, 19, 16],
        step: 0.5,
        voice: 'bell',
        gain: 0.4,
        level: 0.55,
        fade: 0.8,
      });
      s.fx('sparkle', HEART_FROM, len(HEART_FROM, HEART_TO), 0.05, -0.1);
      s.fx('chime', HEART_TO, 1.4, 0.1, -0.1);
      s.fx('warp', ZIP, 0.8, 0.07, 0.6);
      s.section({
        from: FINAL,
        to: 1,
        bpm: bpm * 0.75,
        root: ROOT,
        chords: [0, 5, 7, 0],
        melody: [12, null, 16, 19, null, 16, 17, null, 16, 14, null, 12, null, null, null, null],
        voice: 'bell',
        gain: 0.5,
        level: 0.6,
        fade: 2,
      });
      s.fx('chime', GONE + 0.006, 1.2, 0.05, 0.6);
      s.fx('chime', 0.95, 1.2, 0.04, 0.6);
    },
  );

export const visitorsOverForktown: FilmModule = {
  draw(ctx, p, seconds) {
    if (p < SCOPE || within(p, SPOTTED, INSIDE) || p >= HOME) {
      film(ctx, TOWN, track(p, TOWN_CAM), (v) => townScene(ctx, p, seconds, v));
      vignette(ctx, 0.45, NIGHT);
    } else if (p < SPOTTED) scopeView(ctx, p, seconds);
    else if (p < TOUR || p >= PARTY) {
      camera(ctx, track(p, CABIN_CAM), () => cabinScene(ctx, p, seconds));
      vignette(ctx, 0.5, NIGHT);
    } else if (p < CLOUDS) {
      tourScene(ctx, p, seconds);
      vignette(ctx, 0.4, NIGHT);
    } else if (p < MOON) {
      climbScene(ctx, p, seconds);
      vignette(ctx, 0.35, NIGHT);
    } else {
      camera(ctx, track(p, SPACE_CAM), () => spaceScene(ctx, p, seconds));
      vignette(ctx, 0.4, NIGHT);
    }
    // Soft dips: into the eyepiece and out, aboard, out of the clouds, back inside, home.
    veil(
      ctx,
      '#05070D',
      Math.max(
        hump(p, SCOPE - 0.006, SCOPE + 0.006) * 0.8,
        hump(p, SPOTTED - 0.006, SPOTTED + 0.006) * 0.8,
        hump(p, INSIDE - 0.007, INSIDE + 0.007),
        hump(p, MOON - 0.006, MOON + 0.006) * 0.7,
        hump(p, PARTY - 0.006, PARTY + 0.006),
        hump(p, HOME - 0.007, HOME + 0.007),
      ),
    );
    captions(ctx, p, [
      [0.008, 0.075, 'An ordinary night in Forktown...'],
      [0.172, 0.235, 'Please remain... airborne.'],
      [0.446, 0.498, 'The grand tour, with local guides.'],
      [0.9, 0.985, 'Three round-trip tickets.'],
    ]);
  },
  score: visitorsOverForktownScore,
  look: { shade: '#0B1020', ink: '#EFFBF2', accent: '#B5F0C1', dedication: 'keep looking up' },
};
