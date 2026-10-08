// Extras in the night sky (agent E, SPEC §4.4): on the summer star nights only (Summer 27, 28 and
// Autumn 1), at most 3 slow cool-white meteors, each a 40-px streak that fades in and out over at
// least 1.5 real seconds (alpha changes ≤ 0.08 a frame). Screen space, after drawSky.
// No Math.random, Date.now or performance.now: meteors run on the town clock.
//
// A town minute is a real second, so a meteor's 2.6 minutes are 2.6 seconds on screen: it glides
// down across the top of the sky, high over the hills, brightening and fading on a slow swell.
// Like the stars it is drawn in whole pixels, and the town and the hills in front of the sky hide
// it wherever they stand.
import { starNight } from '../lib/district-calendar';
import { townCalendarAt, townSkyAt } from '../lib/town-calendar';
import { hash } from '../lib/world';
import type { SkyScene } from './district-art';

type Ctx = CanvasRenderingContext2D;

/** Meteors on a summer star night: at most this many, one at a time. */
export const METEORS = 3;
/** Town minutes (real seconds) a meteor is in the sky, from its first glow to its last. */
export const METEOR_MINUTES = 2.6;
/** The streak's length and how far its head glides, in px on a full-size screen. */
export const METEOR_LENGTH = 40;
const GLIDE = 70;
/** How bright its head gets at the top of its swell, and how many steps make its tail. */
const PEAK = 0.9;
const STEPS = 20;
/** Cool white: a little bluer than the stars' cream, never warm. */
export const METEOR_COLOUR = '#E6F0F2';
/** Below the hills' highest point (0.23 of the screen) nothing of a meteor may reach. */
export const METEOR_FLOOR = 0.18;

/** The evening's own timeline: 00:20 is minute 1460 of the evening before. */
const eveningMinute = (minutes: number) => (minutes < 360 ? minutes + 1440 : minutes);

/** Whether an evening is a summer star night: Summer 27 and 28, and Autumn 1 (SPEC §4.4). */
export function meteorNight(evening: number) {
  if (!starNight(evening)) return false;
  const { season, date } = townCalendarAt(Math.floor(evening));
  return (season === 'Summer' && date >= 27) || (season === 'Autumn' && date === 1);
}

export type Meteor = {
  /** The minute it starts to glow, on the evening's timeline. */
  start: number;
  /** Where its head starts, as fractions of the screen's width and height. */
  x: number;
  y: number;
  /** Which way it falls: down to the left (−1) or to the right (1). */
  side: -1 | 1;
};
/**
 * The evening's meteors: three, about 35 minutes apart, while the stargazers are out (one each in
 * 22:30–22:49, 23:05–23:24 and 23:40–23:59), each at its own place high in the sky. None on other
 * nights.
 */
export function meteorsOf(evening: number): Meteor[] {
  if (!meteorNight(evening)) return [];
  return Array.from({ length: METEORS }, (_, k) => {
    const seed = hash(`meteor:${Math.floor(evening)}:${k}`);
    return {
      start: 1350 + 35 * k + (seed % 20),
      x: 0.12 + (0.76 * ((seed >>> 5) % 1000)) / 1000,
      y: 0.035 + (0.05 * ((seed >>> 15) % 1000)) / 1000,
      side: (seed >>> 25) % 2 ? 1 : -1,
    };
  });
}

/** A meteor's brightness through its life: a slow swell from nothing and back, never a flash. */
export const meteorSwell = (age: number) =>
  age <= 0 || age >= METEOR_MINUTES ? 0 : Math.sin((Math.PI * age) / METEOR_MINUTES) ** 2;

/** Each step of a streak as drawn: where, and how bright, on a screen of the given size. */
export function meteorSteps(meteor: Meteor, evening: number, width: number, height: number) {
  const age = evening - meteor.start;
  const swell = meteorSwell(age);
  if (swell <= 0) return [];
  // The sun's own size rule, so a phone's meteor is a little smaller.
  const size = Math.max(0.7, Math.min(1, width / 900));
  const angle = (25 * Math.PI) / 180;
  const along = { x: meteor.side * Math.cos(angle), y: Math.sin(angle) };
  const glide = (age / METEOR_MINUTES) * GLIDE * size;
  const head = { x: meteor.x * width + along.x * glide, y: meteor.y * height + along.y * glide };
  const step = (METEOR_LENGTH * size) / STEPS;
  return Array.from({ length: STEPS }, (_, i) => ({
    x: Math.round(head.x - along.x * step * i),
    y: Math.round(head.y - along.y * step * i),
    w: 2,
    h: i < 2 ? 2 : 1,
    alpha: PEAK * swell * (1 - i / STEPS) ** 1.6,
  }));
}

/** The summer meteors, in screen space over the sky. Nothing on other nights or by day. */
export const drawSkyExtras = (ctx: Ctx, { day, minutes, night, width, height }: SkyScene) => {
  if (!night || width <= 0 || height <= 0) return;
  const evening = eveningMinute(minutes);
  const meteors = meteorsOf(minutes < 360 ? Math.floor(day) - 1 : Math.floor(day));
  const now = meteors.filter(
    (meteor) => evening > meteor.start && evening < meteor.start + METEOR_MINUTES,
  );
  if (!now.length) return;
  const dark = 1 - townSkyAt(day, minutes).daylight;
  const alpha = ctx.globalAlpha;
  ctx.fillStyle = METEOR_COLOUR;
  for (const meteor of now)
    for (const step of meteorSteps(meteor, evening, width, height)) {
      ctx.globalAlpha = alpha * dark * step.alpha;
      ctx.fillRect(step.x, step.y, step.w, step.h);
    }
  ctx.globalAlpha = alpha;
};
