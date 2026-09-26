import type { CinemaAd, CinemaFilm } from '../lib/cinema';

/**
 * The Starlight Reel drawing kit. Every film renders a pure function of its own story
 * time onto a 320 × 180 screen, so pausing, seeking, and late arrivals stay in sync.
 * No wall clock, no unseeded randomness, no remote assets, and no flashing.
 */
export type Ctx = CanvasRenderingContext2D;
export const W = 320;
export const H = 180;
export const TAU = Math.PI * 2;

export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Local progress through [from, to], clamped to 0..1. */
export const span = (p: number, from: number, to: number) => clamp((p - from) / (to - from));
export const ease = (t: number) => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};
export const easeIn = (t: number) => clamp(t) ** 3;
export const easeOut = (t: number) => 1 - (1 - clamp(t)) ** 3;
/** Overshoots a little before settling: good for landings and pop-ins. */
export const backOut = (t: number) => {
  const c = clamp(t) - 1;
  return 1 + c * c * (2.7 * c + 1.7);
};
/** Rises 0 → 1 → 0 across [from, to]. */
export const hump = (p: number, from: number, to: number) => Math.sin(span(p, from, to) * Math.PI);
export const within = (p: number, from: number, to: number) => p >= from && p < to;
/** Fades in and out at the edges of [from, to]; `edge` is the fade width in story units. */
export function presence(p: number, from: number, to: number, edge = 0.012) {
  if (p < from || p >= to) return 0;
  const width = Math.min(edge, (to - from) / 3);
  return Math.min(ease((p - from) / width), ease((to - p) / width));
}

/** Deterministic 0..1 noise for any numeric seed. */
export function rand(seed: number) {
  let h = Math.imul(Math.floor(seed * 7919) ^ 0x5bd1e995, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Which shot is on screen: each cut is the story time where a new shot begins. */
export function shot(p: number, cuts: readonly number[]) {
  let index = 0;
  while (index + 1 < cuts.length && p >= cuts[index + 1]) index++;
  const from = cuts[index],
    to = cuts[index + 1] ?? 1;
  return { index, from, to, local: span(p, from, to) };
}

/** #RRGGBB → #RRGGBBAA. */
export const alpha = (hex: string, amount: number) =>
  hex.slice(0, 7) +
  Math.round(clamp(amount) * 255)
    .toString(16)
    .padStart(2, '0');

/** Mixes two #RRGGBB colours; handy for day-to-night grading. */
export function mix(a: string, b: string, t: number) {
  const c = clamp(t);
  const channel = (i: number) =>
    Math.round(
      parseInt(a.slice(1 + i * 2, 3 + i * 2), 16) * (1 - c) +
        parseInt(b.slice(1 + i * 2, 3 + i * 2), 16) * c,
    )
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

export function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
export function oval(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  rotation = 0,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rotation, 0, TAU);
  ctx.fill();
}
export const disc = (ctx: Ctx, x: number, y: number, r: number, color: string) =>
  oval(ctx, x, y, r, r, color);
/** A filled polygon from a flat list of x, y pairs. */
export function poly(ctx: Ctx, color: string, points: readonly number[]) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points.length; i += 2)
    if (i) ctx.lineTo(points[i], points[i + 1]);
    else ctx.moveTo(points[i], points[i + 1]);
  ctx.closePath();
  ctx.fill();
}
/** An open stroked path from a flat list of x, y pairs. */
export function line(ctx: Ctx, color: string, width: number, points: readonly number[]) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < points.length; i += 2)
    if (i) ctx.lineTo(points[i], points[i + 1]);
    else ctx.moveTo(points[i], points[i + 1]);
  ctx.stroke();
}
/** Temporarily paint with transparency. */
export function faded(ctx: Ctx, amount: number, paint: () => void) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(amount);
  paint();
  ctx.restore();
}
export type View = { x: number; y: number; zoom: number };
/**
 * Frames world point (x, y) at the screen centre, magnified by `zoom`. By default the view
 * is kept inside a 320 × 180 set so a push-in never reveals the void past its edges; pass a
 * bigger `world` for scrolling sets, or null to allow anything.
 */
export function camera(
  ctx: Ctx,
  view: View,
  paint: () => void,
  world: { w: number; h: number } | null = { w: W, h: H },
) {
  let { x, y } = view;
  const zoom = view.zoom;
  if (world) {
    const hw = W / 2 / zoom,
      hh = H / 2 / zoom;
    x = world.w <= hw * 2 ? world.w / 2 : clamp(x, hw, world.w - hw);
    y = world.h <= hh * 2 ? world.h / 2 : clamp(y, hh, world.h - hh);
  }
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-x, -y);
  paint();
  ctx.restore();
}
/**
 * Eases a camera through keyframes [p, x, y, zoom]. It holds before the first and after the
 * last; two keys at the same p make a hard cut.
 */
export function track(
  p: number,
  keys: readonly (readonly [number, number, number, number])[],
): View {
  const view = (k: readonly [number, number, number, number]) => ({ x: k[1], y: k[2], zoom: k[3] });
  if (p <= keys[0][0]) return view(keys[0]);
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, ax, ay, az] = keys[i],
      [b, bx, by, bz] = keys[i + 1];
    if (p < b) {
      const t = ease((p - a) / (b - a));
      return { x: lerp(ax, bx, t), y: lerp(ay, by, t), zoom: lerp(az, bz, t) };
    }
  }
  return view(keys[keys.length - 1]);
}

/** A pixel-art vertical gradient: flat bands joined by a two-row checker dither. */
export function sky(ctx: Ctx, bands: readonly string[], top = 0, bottom = H, left = 0, width = W) {
  const step = (bottom - top) / bands.length;
  bands.forEach((color, i) => box(ctx, left, top + i * step, width, Math.ceil(step) + 1, color));
  for (let i = 1; i < bands.length; i++) {
    const y = Math.round(top + i * step);
    for (let x = left; x < left + width; x += 4) {
      box(ctx, x, y - 2, 2, 1, bands[i]);
      box(ctx, x + 2, y - 1, 2, 1, bands[i]);
      box(ctx, x, y, 2, 1, bands[i - 1]);
      box(ctx, x + 2, y + 1, 1, 1, bands[i - 1]);
    }
  }
}
/** Soft light: a radial falloff from `color` at the centre to nothing at `radius`. */
export function glow(
  ctx: Ctx,
  x: number,
  y: number,
  radius: number,
  color: string,
  strength = 0.5,
) {
  if (strength <= 0 || radius <= 0) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, alpha(color, strength));
  gradient.addColorStop(0.45, alpha(color, strength * 0.4));
  gradient.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
/** Darkened corners that pull the eye inward. */
export function vignette(ctx: Ctx, strength = 0.45, color = '#0B0E14') {
  const gradient = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  gradient.addColorStop(0, alpha(color, 0));
  gradient.addColorStop(1, alpha(color, strength));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}
/** A full-frame wash, used for fades, dusk grading, and dissolves between shots. */
export function veil(ctx: Ctx, color: string, amount: number) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(amount);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
/** Classic iris: everything outside the circle is covered. */
export function iris(ctx: Ctx, x: number, y: number, radius: number, color = '#07090C') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.moveTo(x + Math.max(0, radius), y);
  ctx.arc(x, y, Math.max(0, radius), 0, TAU, true);
  ctx.fill('evenodd');
  ctx.restore();
}
export function letterbox(ctx: Ctx, amount: number, color = '#07090C') {
  const bar = Math.round(clamp(amount) * 18);
  if (!bar) return;
  box(ctx, 0, 0, W, bar, color);
  box(ctx, 0, H - bar, W, bar, color);
}

export function starfield(
  ctx: Ctx,
  seconds: number,
  { count = 36, seed = 1, top = 0, bottom = H * 0.6, colors = ['#FFE9B8', '#A9B8D8'] } = {},
) {
  for (let i = 0; i < count; i++) {
    const x = rand(seed + i * 3.1) * W,
      y = top + rand(seed + i * 5.7) * (bottom - top);
    const twinkle = Math.sin(seconds * (0.6 + rand(seed + i) * 0.9) + i * 2.3);
    const color = colors[i % colors.length];
    box(ctx, x, y, 1, 1, color);
    if (twinkle > 0.55 && i % 3 === 0) {
      box(ctx, x - 1, y, 3, 1, alpha(color, 0.6));
      box(ctx, x, y - 1, 1, 3, alpha(color, 0.6));
    }
  }
}
/** Slanted rain streaks that loop through the frame; `amount` thins or thickens the shower. */
export function rainfall(
  ctx: Ctx,
  seconds: number,
  {
    amount = 1,
    speed = 190,
    slant = 0.22,
    length = 7,
    color = '#C7D6E2',
    seed = 7,
    top = 0,
    bottom = H,
  } = {},
) {
  const count = Math.round(70 * amount);
  const height = bottom - top + length;
  for (let i = 0; i < count; i++) {
    const fall =
      (rand(seed + i) * height + seconds * speed * (0.8 + rand(seed + i * 2) * 0.4)) % height;
    const y = top - length + fall;
    const x = ((rand(seed + i * 7) * (W + 60) - 30 + fall * slant) % (W + 60)) - 30;
    ctx.fillStyle = color;
    for (let k = 0; k < length; k += 2)
      ctx.fillRect(Math.round(x + k * slant), Math.round(y + k), 1, 2);
  }
}
export function snowfall(
  ctx: Ctx,
  seconds: number,
  { amount = 1, speed = 14, color = '#F4F7FB', seed = 11, top = 0, bottom = H, drift = 1 } = {},
) {
  const count = Math.round(60 * amount);
  const height = bottom - top + 4;
  for (let i = 0; i < count; i++) {
    const y =
      top - 2 + ((rand(seed + i) * height + seconds * speed * (0.6 + rand(seed + i * 3))) % height);
    const x =
      (((rand(seed + i * 5) * W + Math.sin(seconds * 0.8 + i) * 6 * drift + seconds * 3 * drift) %
        W) +
        W) %
      W;
    const size = i % 4 === 0 ? 2 : 1;
    box(ctx, x, y, size, size, color);
  }
}

export type Type = 'mono' | 'serif' | 'italic';
export const font = (type: Type, size: number) =>
  type === 'mono'
    ? `bold ${size}px "Space Mono", monospace`
    : `${type === 'italic' ? 'italic ' : ''}500 ${size}px Fraunces, Georgia, serif`;
export function write(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  {
    size = 9,
    color = '#FFF3D6',
    type = 'mono' as Type,
    align = 'center' as CanvasTextAlign,
    shadow = '',
  } = {},
) {
  ctx.font = font(type, size);
  ctx.textAlign = align;
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.fillText(text, x + 1, y + 1);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
/**
 * One line of narration at the foot of the frame on a soft band. Keep captions short: they
 * are read from a picnic rug. `amount` fades the whole caption.
 */
export function caption(
  ctx: Ctx,
  text: string,
  amount = 1,
  { y = 167, size = 10, type = 'italic' as Type, color = '#FFF3D6', band = '#0B0E14' } = {},
) {
  if (amount <= 0 || !text) return;
  ctx.save();
  ctx.globalAlpha = clamp(amount);
  ctx.font = font(type, size);
  const width = ctx.measureText(text).width + 16;
  ctx.globalAlpha = clamp(amount) * 0.55;
  box(ctx, (W - width) / 2, y - size - 2, width, size + 7, band);
  ctx.globalAlpha = clamp(amount);
  write(ctx, text, W / 2, y, { size, type, color });
  ctx.restore();
}
/** Timed captions: each entry is [from, to, text] in story time, with soft fades. */
export function captions(
  ctx: Ctx,
  p: number,
  lines: readonly (readonly [number, number, string])[],
  style: Parameters<typeof caption>[3] = {},
) {
  for (const [from, to, text] of lines) caption(ctx, text, presence(p, from, to), style);
}
/** A silent-film intertitle card: centred lines on a bordered panel. */
export function intertitle(
  ctx: Ctx,
  lines: readonly string[],
  amount = 1,
  { paper = '#15161C', ink = '#F4E6C4', rule = '#C9A36A', size = 14 } = {},
) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(amount);
  box(ctx, 0, 0, W, H, paper);
  ctx.strokeStyle = rule;
  ctx.lineWidth = 1;
  ctx.strokeRect(14.5, 14.5, W - 29, H - 29);
  ctx.strokeRect(18.5, 18.5, W - 37, H - 37);
  for (const [x, y] of [
    [18, 18],
    [W - 19, 18],
    [18, H - 19],
    [W - 19, H - 19],
  ])
    box(ctx, x - 2, y - 2, 5, 5, rule);
  const top = H / 2 - ((lines.length - 1) * (size + 6)) / 2 + size / 3;
  lines.forEach((text, i) =>
    write(ctx, text, W / 2, top + i * (size + 6), { size, type: 'italic', color: ink }),
  );
  ctx.restore();
}

/** A soft contact shadow under a character or prop. */
export function shade(ctx: Ctx, x: number, y: number, width: number, amount = 0.28) {
  oval(ctx, x, y, width / 2, Math.max(1.5, width / 7), alpha('#0B0E14', amount));
}

export type Eyes = 'open' | 'closed' | 'happy' | 'wide' | 'sad' | 'sleepy';
export type Mouth = 'smile' | 'grin' | 'open' | 'o' | 'flat' | 'frown' | 'none';
export type Figure = {
  skin: string;
  hair: string;
  coat: string;
  legs: string;
  shoes?: string;
  /** Uniform scale; kids are about 27px tall at 1, adults about 38px. */
  size?: number;
  build?: 'kid' | 'adult';
  facing?: 1 | -1;
  /** Walk-cycle phase in radians; leave undefined to stand still. */
  step?: number;
  /** Arm angles in radians from hanging straight down; positive swings toward the facing side. */
  arms?: readonly [number, number];
  eyes?: Eyes;
  mouth?: Mouth;
  hairStyle?: 'short' | 'bob' | 'bun' | 'pigtails' | 'long' | 'bald';
  hat?: 'none' | 'cap' | 'hood' | 'beanie' | 'brim';
  hatColor?: string;
  sitting?: boolean;
  /** Lean the upper body, in radians (positive leans toward the facing side). */
  lean?: number;
  blush?: boolean;
};
const darker = (color: string) => mix(color, '#0B0E14', 0.28);

/**
 * A townsperson in the Forktown picture-house style: big head, little body, readable at the
 * size of a picnic-rug view. (x, y) is the point between the feet on the ground.
 */
export function person(ctx: Ctx, x: number, y: number, f: Figure) {
  const adult = f.build === 'adult';
  const leg = adult ? 11 : 6,
    torso = adult ? 13 : 9,
    head = 11;
  const swing = f.step === undefined ? 0 : Math.sin(f.step);
  const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step)) * 1;
  const shoes = f.shoes ?? '#3B3440';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((f.facing ?? 1) * (f.size ?? 1), f.size ?? 1);
  // Legs: while sitting they point forward along the ground.
  if (f.sitting) {
    box(ctx, -3, -4, leg + 2, 3, f.legs);
    box(ctx, leg - 1, -5, 3, 4, shoes);
    ctx.translate(0, -1);
  } else {
    box(ctx, -3 - swing * 1.5, -leg, 2, leg - 1, darker(f.legs));
    box(ctx, -4 - swing * 1.5, -2 + Math.max(0, swing), 4, 2, shoes);
    box(ctx, 1 + swing * 1.5, -leg, 2, leg - 1, f.legs);
    box(ctx, swing * 1.5, -2 + Math.max(0, -swing), 4, 2, shoes);
  }
  const hip = f.sitting ? -3 : -leg + bob * -1;
  ctx.translate(0, hip);
  ctx.rotate(f.lean ?? 0);
  const [backArm, frontArm] = f.arms ?? [-swing * 0.6, swing * 0.6];
  const arm = (angle: number, color: string, dx: number) => {
    ctx.save();
    ctx.translate(dx, -torso + 2);
    ctx.rotate(-angle);
    box(ctx, -1, 0, 2, adult ? 10 : 7, color);
    box(ctx, -1, adult ? 9 : 6, 2, 2, f.skin);
    ctx.restore();
  };
  arm(backArm, darker(f.coat), -1);
  // Torso, with a darker back edge for a little volume.
  box(ctx, -4, -torso, 8, torso, f.coat);
  box(ctx, -4, -torso, 2, torso, darker(f.coat));
  if (adult) box(ctx, -4, -3, 8, 1, darker(f.coat));
  // Head.
  const top = -torso - head;
  box(ctx, -5, top + 1, 11, head - 1, f.skin);
  box(ctx, -4, top, 9, 1, f.skin);
  box(ctx, -4, top + head - 1, 9, 1, f.skin);
  const hair = f.hairStyle ?? 'short';
  if (hair !== 'bald') {
    box(ctx, -5, top - 1, 11, 4, f.hair);
    box(ctx, -5, top + 1, 4, 6, f.hair);
    if (hair === 'bob' || hair === 'long')
      box(ctx, -6, top + 1, 4, hair === 'long' ? 13 : 9, f.hair);
    if (hair === 'bun') disc(ctx, -5, top, 3, f.hair);
    if (hair === 'pigtails') {
      box(ctx, -8, top + 3, 3, 5, f.hair);
      box(ctx, 5, top + 3, 3, 5, f.hair);
    }
  } else box(ctx, -5, top + 2, 2, 4, darker(f.skin));
  const hat = f.hat ?? 'none',
    hatColor = f.hatColor ?? f.coat;
  if (hat === 'cap') {
    box(ctx, -5, top - 2, 11, 4, hatColor);
    box(ctx, 4, top + 1, 5, 2, darker(hatColor));
  } else if (hat === 'hood') {
    box(ctx, -6, top - 2, 13, 4, hatColor);
    box(ctx, -6, top + 1, 4, head - 1, hatColor);
    box(ctx, 6, top + 1, 1, head - 3, hatColor);
  } else if (hat === 'beanie') {
    box(ctx, -5, top - 3, 11, 5, hatColor);
    box(ctx, -5, top + 1, 11, 1, darker(hatColor));
    disc(ctx, 0, top - 4, 2, darker(hatColor));
  } else if (hat === 'brim') {
    box(ctx, -8, top, 17, 2, hatColor);
    box(ctx, -4, top - 4, 9, 4, hatColor);
  }
  // Face, in three-quarter view toward the facing side.
  const ink = '#2A2530';
  const eyeY = top + 5;
  const eyes = f.eyes ?? 'open';
  for (const ex of [1, 4]) {
    if (eyes === 'open') box(ctx, ex, eyeY, 1, 2, ink);
    else if (eyes === 'wide') {
      box(ctx, ex, eyeY - 1, 2, 3, '#FFFFFF');
      box(ctx, ex + 1, eyeY, 1, 1, ink);
    } else if (eyes === 'happy') {
      box(ctx, ex - 1, eyeY + 1, 1, 1, ink);
      box(ctx, ex, eyeY, 1, 1, ink);
      box(ctx, ex + 1, eyeY + 1, 1, 1, ink);
    } else if (eyes === 'sad') {
      box(ctx, ex, eyeY, 1, 2, ink);
      box(ctx, ex - 1, eyeY - 1, 2, 1, ink);
    } else if (eyes === 'sleepy') box(ctx, ex - 1, eyeY + 1, 2, 1, ink);
    else box(ctx, ex - 1, eyeY + 1, 3, 1, ink);
  }
  if (f.blush ?? true) box(ctx, 5, eyeY + 3, 2, 1, alpha('#E58A86', 0.8));
  const mouth = f.mouth ?? 'smile',
    my = top + head - 3;
  if (mouth === 'smile') {
    box(ctx, 2, my, 1, 1, ink);
    box(ctx, 3, my + 1, 2, 1, ink);
  } else if (mouth === 'grin') {
    box(ctx, 1, my, 5, 2, ink);
    box(ctx, 2, my, 3, 1, '#FFFFFF');
  } else if (mouth === 'open' || mouth === 'o')
    box(ctx, 2, my - (mouth === 'o' ? 0 : 1), 2, mouth === 'o' ? 2 : 3, ink);
  else if (mouth === 'flat') box(ctx, 2, my + 1, 3, 1, ink);
  else if (mouth === 'frown') {
    box(ctx, 2, my + 1, 1, 1, ink);
    box(ctx, 3, my, 2, 1, ink);
  }
  arm(frontArm, f.coat, 1);
  ctx.restore();
}

/** Where a figure's hand is, for props like umbrellas, spoons, lanterns, and letters. Ignores `lean`. */
export function handOf(x: number, y: number, f: Figure, side: 'front' | 'back' = 'front') {
  const adult = f.build === 'adult';
  const leg = adult ? 11 : 6,
    torso = adult ? 13 : 9,
    reach = adult ? 10 : 7;
  const swing = f.step === undefined ? 0 : Math.sin(f.step);
  const bob = f.step === undefined ? 0 : Math.abs(Math.cos(f.step));
  const [back, front] = f.arms ?? [-swing * 0.6, swing * 0.6];
  const angle = side === 'front' ? front : back;
  const hip = f.sitting ? -4 : -leg - bob;
  const size = f.size ?? 1;
  return {
    x: x + ((side === 'front' ? 1 : -1) + Math.sin(angle) * reach) * size * (f.facing ?? 1),
    y: y + (hip - torso + 2 + Math.cos(angle) * reach) * size,
  };
}

/** Look of the Starlight Reel's title and end cards for one film. */
export type Look = {
  /** Background wash behind the titles. */
  shade: string;
  ink: string;
  accent: string;
  /** Last line of the end card: a dedication or a wink, not a summary. */
  dedication: string;
};

const BILLING = { drama: 'drama', comedy: 'comedy', action: 'action picture' } as const;
/** The age badge in the corner of a grown-up film's title card. */
function rating(ctx: Ctx, label: string, x: number, y: number, look: Look) {
  box(ctx, x, y, 24, 13, alpha('#07090C', 0.55));
  ctx.strokeStyle = look.accent;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, 23, 12);
  write(ctx, label, x + 12, y + 9.5, { size: 7, color: look.ink });
}

/** Opening titles over the first frame, and an end card over the last. */
export function titles(ctx: Ctx, film: CinemaFilm, elapsed: number, look: Look) {
  const endAt = film.duration - 3;
  const amount =
    elapsed < 3
      ? 1 - ease((elapsed - 2.1) / 0.9)
      : elapsed >= endAt
        ? ease((elapsed - endAt) / 0.9)
        : 0;
  if (amount <= 0) return;
  const opening = elapsed < 3;
  ctx.save();
  ctx.globalAlpha = amount * 0.8;
  box(ctx, 0, 0, W, H, look.shade);
  ctx.globalAlpha = amount;
  letterbox(ctx, 1);
  const rule = (y: number, width: number) => {
    box(ctx, W / 2 - width - 4, y, width, 1, alpha(look.accent, 0.8));
    box(ctx, W / 2 + 4, y, width, 1, alpha(look.accent, 0.8));
    box(ctx, W / 2 - 1, y - 1, 3, 3, look.accent);
  };
  if (opening) {
    const rise = (1 - easeOut(elapsed / 1.2)) * 4;
    write(ctx, 'THE STARLIGHT CINEMA PRESENTS', W / 2, 62 + rise, { size: 6, color: look.accent });
    let size = 22;
    ctx.font = font('serif', size);
    while (size > 14 && ctx.measureText(film.title).width > W - 40)
      ctx.font = font('serif', --size);
    write(ctx, film.title, W / 2, 94 + rise * 0.5, {
      size,
      type: 'serif',
      color: look.ink,
      shadow: alpha('#000000', 0.35),
    });
    rule(106, 38);
    write(
      ctx,
      film.genre ? `a forktown ${BILLING[film.genre]}` : 'a forktown original',
      W / 2,
      124,
      {
        size: 9,
        type: 'italic',
        color: alpha(look.ink, 0.8),
      },
    );
    if (film.rating) rating(ctx, film.rating, W - 38, 26, look);
  } else {
    write(ctx, 'The End', W / 2, 88, {
      size: 24,
      type: 'italic',
      color: look.ink,
      shadow: alpha('#000000', 0.35),
    });
    rule(100, 30);
    write(ctx, look.dedication, W / 2, 118, {
      size: 9,
      type: 'italic',
      color: alpha(look.ink, 0.85),
    });
    write(ctx, 'FORKTOWN PICTURE HOUSE', W / 2, 150, { size: 5, color: look.accent });
  }
  ctx.restore();
}

/** How long an ad holds its sponsor slate at the end: three seconds, or four for longer spots. */
export const slateSeconds = (ad: CinemaAd) => (ad.duration > 10 ? 4 : 3);
/** Look of an ad's closing slate. */
export type AdLook = { shade: string; ink: string; accent: string };
/** Every ad ends on the same kind of card: who it is from, and one line to remember. */
export function slate(ctx: Ctx, ad: CinemaAd, elapsed: number, look: AdLook) {
  const from = ad.duration - slateSeconds(ad);
  const amount = ease((elapsed - from) / 0.6) * (1 - ease((elapsed - ad.duration + 0.5) / 0.5));
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = amount * 0.88;
  box(ctx, 0, 0, W, H, look.shade);
  ctx.globalAlpha = amount;
  const rise = (1 - easeOut((elapsed - from) / 0.9)) * 5;
  let size = 20;
  ctx.font = font('serif', size);
  while (size > 12 && ctx.measureText(ad.sponsor).width > W - 40) ctx.font = font('serif', --size);
  write(ctx, ad.sponsor, W / 2, 84 + rise, {
    size,
    type: 'serif',
    color: look.ink,
    shadow: alpha('#000000', 0.35),
  });
  box(ctx, W / 2 - 24, 96, 48, 1, alpha(look.accent, 0.9));
  write(ctx, ad.tagline, W / 2, 114, { size: 9, type: 'italic', color: alpha(look.ink, 0.9) });
  write(ctx, 'HERE IN FORKTOWN', W / 2, 150, { size: 5, color: look.accent });
  ctx.restore();
}
