import type { FilmModule } from './types';
import {
  alpha,
  box,
  camera,
  captions,
  disc,
  ease,
  easeIn,
  easeOut,
  faded,
  glow,
  H,
  handOf,
  hump,
  line,
  mix,
  oval,
  person,
  poly,
  rainfall,
  shade,
  shot,
  track,
  veil,
  sky,
  span,
  vignette,
  W,
  within,
  type Ctx,
  type Figure,
} from './kit';
import { composeFilm } from './score-kit';

/*
 * THE RAIN ORCHESTRA
 * Otto is bored of the rain, until a leak in the ceiling plays a note. Pots, cups, and jars
 * become an instrument; the whole street joins in; then the rain stops, one drop short of
 * the end of the tune. The last drop lands, the melody resolves, and the sun comes out.
 *
 * Every drip is a note: the art and the score read the same drop list, so each note sounds
 * as its drop lands in the matching, colour-coded container.
 */

// The tune's grid lives in story time: a beat is 1/108 of the story, which is 120 bpm in
// the one-minute cut (54 s of story). The score derives its tempo from the same number.
const BEAT = 1 / 108;
const HANG = BEAT * 1.1,
  FALL = BEAT * 0.8;
const CUTS = [0, 0.13, 0.3, 0.48, 0.64, 0.78, 0.9] as const;
const ROOT = 65; // F

// Bigger containers ring lower. Degrees are semitones above F.
const DEGREES = [0, 2, 4, 7, 9, 12] as const;
const COLOR: Record<number, string> = {
  0: '#D9694F',
  2: '#E9A13B',
  4: '#7FAF72',
  7: '#4B9CC4',
  9: '#9A7BC4',
  12: '#F1DFA6',
};
type Drop = { p: number; degree: number };
const tune = (from: number, degrees: readonly number[]): Drop[] =>
  degrees.map((degree, i) => ({ p: from + i * BEAT, degree }));
// Pentatonic phrases that never land on F: A hangs on G, B on C. The teacup (high F) is
// saved for the very last drop, so the tune only comes home at the end.
const THEME_A = [0, 4, 7, 4, 9, 7, 4, 2];
const THEME_B = [4, 7, 9, 7, 4, 2, 4, 7];
export const ROOM_DROPS: readonly Drop[] = [
  { p: 0.058, degree: 0 },
  { p: 0.1, degree: 0 },
  { p: 0.15, degree: 7 },
  { p: 0.166, degree: 0 },
  { p: 0.181, degree: 7 },
  ...tune(0.235, [0, 4, 7, 9]),
];
export const STREET_DROPS: readonly Drop[] = [
  ...tune(0.38, THEME_A),
  ...tune(0.49, [...THEME_A, ...THEME_B]),
];
export const LAST_DROP: Drop = { p: 0.875, degree: 12 };

// The attic: four leaks over a pot (F), a jar (A), a cup (C), and a glass (D).
const LEAKS: Record<number, number> = { 0: 176, 4: 204, 7: 232, 9: 260 };
const ROOM_FLOOR = 158,
  CEILING = 15;
// The street: six downpipes over six containers.
// Pipes run between the windows: at each party wall and down over each front door.
const SPOUT_X: Record<number, number> = { 0: 40, 2: 80, 4: 120, 7: 160, 9: 200, 12: 240 };
const SPOUT_Y = 90,
  STREET = 150;
const RIM: Record<number, number> = { 0: 128, 2: 134, 4: 137, 7: 136, 9: 135, 12: 144 };

const otto = (over: Partial<Figure> = {}): Figure => ({
  skin: '#E8B48E',
  hair: '#5B3A2C',
  coat: '#D9A441',
  legs: '#3E4F6B',
  shoes: '#6B3B2E',
  ...over,
});

function waterDrop(ctx: Ctx, x: number, y: number, swell = 1) {
  const s = Math.max(0.3, swell);
  box(ctx, x - 1, y - 2 * s, 2, 2 * s, '#BFE6F5');
  box(ctx, x - 1.5 * s, y - 1, 3 * s, 3, '#A6D6EC');
  box(ctx, x - 1, y, 1, 1, '#FFFFFF');
}
/** A little pixel quaver that floats up from a container after its note sounds. */
function quaver(ctx: Ctx, x: number, y: number, color: string) {
  box(ctx, x, y, 3, 2, color);
  box(ctx, x + 2, y - 7, 1, 8, color);
  box(ctx, x + 3, y - 7, 2, 1, color);
  box(ctx, x + 4, y - 6, 1, 2, color);
}
/** Hang, fall, splash, and float a note for each drop in the list. */
function drips(
  ctx: Ctx,
  p: number,
  drops: readonly Drop[],
  where: (degree: number) => { x: number; top: number; rim: number } | undefined,
) {
  for (const drop of drops) {
    const spot = where(drop.degree);
    if (!spot || p < drop.p - HANG - FALL || p > drop.p + 0.03) continue;
    const { x, top, rim } = spot;
    if (p < drop.p - FALL) waterDrop(ctx, x, top + 2, span(p, drop.p - HANG - FALL, drop.p - FALL));
    else if (p < drop.p)
      waterDrop(ctx, x, top + 2 + (rim - top - 2) * easeIn(span(p, drop.p - FALL, drop.p)));
    else {
      const t = span(p, drop.p, drop.p + 0.03);
      const splash = span(p, drop.p, drop.p + 0.007);
      if (splash < 1) {
        box(ctx, x - 2 - splash * 6, rim - 2 - hump(splash, 0, 1) * 5, 1, 1, '#CFEFFA');
        box(ctx, x + 2 + splash * 6, rim - 2 - hump(splash, 0, 1) * 5, 1, 1, '#CFEFFA');
        oval(ctx, x, rim, 2 + splash * 5, 1 + splash, alpha('#CFEFFA', 1 - splash));
      }
      faded(ctx, 1 - ease((t - 0.6) / 0.4), () =>
        quaver(ctx, x + 4 + Math.sin(t * 9) * 2, rim - 10 - t * 26, COLOR[drop.degree]),
      );
    }
  }
}
/** How much a container shivers right after it is struck. */
function ring(p: number, drops: readonly Drop[], degree: number) {
  let amount = 0;
  for (const drop of drops)
    if (drop.degree === degree && p >= drop.p && p < drop.p + 0.012)
      amount = Math.max(amount, 1 - (p - drop.p) / 0.012);
  return amount;
}

function sleepyCat(ctx: Ctx, x: number, y: number, seconds: number, awake: number) {
  shade(ctx, x, y + 1, 26);
  oval(ctx, x, y - 5, 12, 6, '#C98E5A');
  oval(ctx, x + 2, y - 4, 7, 4, '#E0B07A');
  box(ctx, x - 13, y - 3, 10, 3, '#B07442');
  disc(ctx, x + 9, y - 8, 5, '#C98E5A');
  box(ctx, x + 6, y - 14 + (Math.sin(seconds * 3) > 0.97 ? 1 : 0), 2, 3, '#B07442');
  box(ctx, x + 11, y - 14, 2, 3, '#B07442');
  if (awake > 0.5) {
    box(ctx, x + 10, y - 9, 1, 2, '#2A2530');
    box(ctx, x + 12, y - 9, 1, 1, '#2A2530');
  } else box(ctx, x + 9, y - 8, 4, 1, '#6E4526');
}

function room(ctx: Ctx, p: number, seconds: number) {
  // Rainy daylight through the window, a lamp, a sleepy cat.
  box(ctx, 0, 0, W, H, '#5B5D6F');
  for (let x = 6; x < W; x += 14) box(ctx, x, CEILING, 1, ROOM_FLOOR - CEILING, '#64677A');
  box(ctx, 0, ROOM_FLOOR - 6, W, 6, '#4C4A58');
  box(ctx, 0, 0, W, CEILING, '#4A3A35');
  box(ctx, 0, CEILING, W, 2, '#3A2C28');
  for (const x of [176, 204, 232, 260]) {
    box(ctx, x - 3, CEILING, 6, 1, '#2C211E');
    box(ctx, x - 1, CEILING + 1, 2, 1, '#2C211E');
  }
  box(ctx, 0, ROOM_FLOOR, W, H - ROOM_FLOOR, '#6E4F3F');
  for (let y = ROOM_FLOOR + 5; y < H; y += 6) box(ctx, 0, y, W, 1, '#5E4235');
  oval(ctx, 118, 170, 70, 8, '#8E5F54');
  oval(ctx, 118, 170, 60, 6, '#A7705F');
  // Window onto the rainy rooftops.
  box(ctx, 26, 28, 96, 86, '#E7DCC8');
  ctx.save();
  ctx.beginPath();
  ctx.rect(31, 33, 86, 76);
  ctx.clip();
  sky(ctx, ['#7D8A9C', '#8895A6', '#94A0B0'], 33, 109, 31, 86);
  for (let i = 0; i < 6; i++) {
    const x = 26 + i * 17,
      top = 78 + (i % 3) * 7;
    box(ctx, x, top, 16, 40, '#6A7688');
    poly(ctx, '#59657A', [x - 2, top, x + 8, top - 8, x + 18, top]);
  }
  rainfall(ctx, seconds, { amount: 0.5, color: '#C6D2DE', slant: 0.12 });
  for (let i = 0; i < 5; i++) {
    const y = 33 + ((seconds * (6 + i * 2) + i * 19) % 76);
    box(ctx, 38 + i * 17, y, 1, 4, '#D5E0EA');
  }
  ctx.restore();
  box(ctx, 73, 33, 2, 76, '#E7DCC8');
  box(ctx, 31, 70, 86, 2, '#E7DCC8');
  box(ctx, 20, 112, 108, 5, '#D2C4AC');
  // Window seat.
  box(ctx, 24, 117, 100, 20, '#8A5A4A');
  box(ctx, 28, 113, 92, 6, '#C98B6B');
  // Lamp and side table with the jar and glass waiting.
  box(ctx, 286, 118, 22, 40, '#7B5647');
  box(ctx, 283, 116, 28, 4, '#946A58');
  glow(ctx, 297, 86, 60, '#FFD68A', 0.4);
  box(ctx, 295, 92, 3, 24, '#3F3432');
  poly(ctx, '#F2C877', [286, 92, 308, 92, 303, 76, 291, 76]);
  const placed = (at: number) => span(p, at, at + 0.012);
  if (placed(0.195) < 1) jar(ctx, 290, 116);
  if (placed(0.21) < 1) glass(ctx, 302, 116);
  // The first two pots are already catching drips.
  roomPot(ctx, 176, 0, p);
  roomCup(ctx, 232, 7, p);
  const carry = (at: number, from: number, to: number) => lerpPath(ease(placed(at)), from, to);
  if (placed(0.195) > 0)
    jar(ctx, carry(0.195, 290, 204), placed(0.195) < 1 ? 150 : ROOM_FLOOR, ring(p, ROOM_DROPS, 4));
  if (placed(0.21) > 0)
    glass(ctx, carry(0.21, 302, 260), placed(0.21) < 1 ? 150 : ROOM_FLOOR, ring(p, ROOM_DROPS, 9));
  sleepyCat(ctx, 128, 168, seconds, within(p, 0.15, 0.3) ? 1 : 0);
  drips(ctx, p, ROOM_DROPS, (degree) =>
    degree in LEAKS
      ? { x: LEAKS[degree], top: CEILING, rim: { 0: 146, 4: 146, 7: 150, 9: 149 }[degree]! }
      : undefined,
  );
}
const lerpPath = (t: number, from: number, to: number) => from + (to - from) * t;
function roomPot(ctx: Ctx, x: number, degree: number, p: number) {
  const r = ring(p, ROOM_DROPS, degree) * Math.sin(p * 4000);
  shade(ctx, x, ROOM_FLOOR, 24);
  box(ctx, x - 11 + r, 146, 22, 12, '#5E6B73');
  box(ctx, x - 12 + r, 145, 24, 3, '#7F8E96');
  box(ctx, x - 15 + r, 148, 4, 2, '#4A565D');
  box(ctx, x + 11 + r, 148, 4, 2, '#4A565D');
  box(ctx, x - 9 + r, 150, 3, 6, alpha(COLOR[degree], 0.9));
}
function roomCup(ctx: Ctx, x: number, degree: number, p: number) {
  const r = ring(p, ROOM_DROPS, degree) * Math.sin(p * 4000);
  shade(ctx, x, ROOM_FLOOR, 14);
  box(ctx, x - 5 + r, 150, 10, 8, '#EDE3D0');
  box(ctx, x + 5 + r, 152, 3, 4, '#EDE3D0');
  box(ctx, x - 5 + r, 153, 10, 2, COLOR[degree]);
}
function jar(ctx: Ctx, x: number, y: number, shiver = 0) {
  const r = shiver * 0.8;
  box(ctx, x - 5 + r, y - 12, 10, 12, alpha('#CFE6E8', 0.85));
  box(ctx, x - 4 + r, y - 14, 8, 2, '#A9B8B4');
  box(ctx, x - 4 + r, y - 6, 8, 3, COLOR[4]);
}
function glass(ctx: Ctx, x: number, y: number, shiver = 0) {
  const r = shiver * 0.8;
  box(ctx, x - 4 + r, y - 9, 8, 9, alpha('#DDEFF5', 0.8));
  box(ctx, x - 4 + r, y - 9, 1, 9, '#FFFFFF');
  box(ctx, x - 3 + r, y - 4, 6, 2, COLOR[9]);
}

function ottoInside(ctx: Ctx, p: number, seconds: number) {
  // Bored on the window seat, then down on the floor, arranging.
  if (p < 0.188) {
    const noticed = p > 0.102;
    const wakeUp = span(p, 0.15, 0.165);
    person(
      ctx,
      94,
      117,
      otto({
        size: 1.3,
        facing: 1,
        sitting: true,
        arms: wakeUp > 0.5 ? [0.3, 0.6] : [0.3, 2.5],
        eyes:
          p > 0.15
            ? 'wide'
            : noticed
              ? 'open'
              : Math.sin(seconds * 1.7) > 0.9
                ? 'closed'
                : 'sleepy',
        mouth: p > 0.17 ? 'o' : 'flat',
        lean: noticed ? 0.12 : -0.05,
      }),
    );
    return;
  }
  // Hop down, fetch the jar, then the glass, then stand back and listen.
  const path: [number, number, number][] = [
    [0.188, 94, 0],
    [0.195, 280, 1],
    [0.207, 204, -1],
    [0.21, 292, 1],
    [0.222, 256, -1],
    [0.232, 150, -1],
  ];
  let x = 150,
    facing: 1 | -1 = 1,
    moving = false;
  for (let i = 0; i < path.length - 1; i++) {
    const [a, ax] = path[i],
      [b, bx] = path[i + 1];
    if (p >= a && p < b) {
      x = ax + (bx - ax) * ease(span(p, a, b));
      facing = bx >= ax ? 1 : -1;
      moving = true;
    }
  }
  if (p >= 0.232) {
    x = 150;
    facing = 1;
  }
  const eureka = span(p, 0.265, 0.275);
  const dash = span(p, 0.28, 0.3);
  if (dash > 0) {
    x = 150 - easeIn(dash) * 190;
    facing = -1;
    moving = true;
  }
  person(
    ctx,
    x,
    ROOM_FLOOR + 2,
    otto({
      size: 1.3,
      facing,
      step: moving ? seconds * 14 : undefined,
      arms: dash > 0 ? [-0.6, 0.9] : eureka > 0 ? [2.6, 2.8] : p > 0.232 ? [0.2, 0.2] : undefined,
      eyes: p > 0.232 && p < 0.265 ? 'closed' : eureka > 0 ? 'wide' : 'open',
      mouth: eureka > 0 ? 'grin' : 'smile',
      lean: p > 0.232 && p < 0.265 ? -0.12 : 0,
    }),
  );
  if (p > 0.232 && p < 0.265) {
    // Eyes closed, listening: little sound lines by his ear.
    box(ctx, 160, 132, 3, 1, '#F1DFA6');
    box(ctx, 162, 128, 3, 1, '#F1DFA6');
  }
}

// ——— The street ———
const HOUSES = ['#B8836C', '#98A598', '#C8B08A', '#8E7F9C'];
function street(ctx: Ctx, seconds: number, wet: number, sun: number) {
  sky(
    ctx,
    [0, 1, 2, 3].map((i) =>
      mix(
        ['#5A6679', '#66728A', '#737F95', '#808BA0'][i],
        ['#7DB8DE', '#8FC6E4', '#A5D3EA', '#BCDFEC'][i],
        sun,
      ),
    ),
    0,
    60,
  );
  // Clouds roll back as the sun comes out.
  for (let i = 0; i < 7; i++) {
    const drift = sun * (i % 2 ? 1 : -1) * 190;
    const x = i * 52 - 10 + drift + Math.sin(seconds * 0.1 + i) * 3;
    oval(ctx, x, 14 + (i % 3) * 7, 38, 11, mix('#4F5A6C', '#E9EEF0', sun));
    oval(ctx, x + 16, 10 + (i % 3) * 7, 22, 9, mix('#5A6679', '#F5F7F8', sun));
  }
  if (sun > 0) {
    glow(ctx, 250, 8, 90, '#FFE9A8', 0.55 * sun);
    disc(ctx, 250, 8 - (1 - sun) * 20, 12, alpha('#FFF1C2', sun));
  }
  rainbow(ctx, span(sun, 0.4, 1));
  // A terrace of four houses with one long gutter.
  HOUSES.forEach((color, i) => {
    const x = i * 80;
    const face = mix(mix(color, '#56607A', 0.35 * wet), color, sun * 0.2);
    box(ctx, x, 40, 80, STREET - 40, face);
    box(ctx, x, 40, 2, STREET - 40, mix(face, '#20232C', 0.2));
    poly(ctx, mix('#6D4E48', '#8C5A4E', sun), [x - 4, 42, x + 40, 20, x + 84, 42]);
    box(ctx, x + 50, 24, 8, 14, '#6E5A55');
    for (const wx of [x + 10, x + 52]) {
      box(ctx, wx - 1, 53, 20, 22, '#E7DCC8');
      box(ctx, wx + 1, 55, 16, 18, i === 1 || i === 0 ? '#F4CF84' : '#F0CB82');
      box(ctx, wx + 8, 55, 2, 18, '#E7DCC8');
    }
    box(ctx, x + 30, 96, 20, STREET - 96, mix('#4F3B38', '#6A4A40', sun));
    box(ctx, x + 28, 94, 24, 3, '#E7DCC8');
    box(ctx, x + 45, 122, 2, 2, '#E9C46A');
  });
  box(ctx, 0, 40, W, 3, '#6F7880');
  box(ctx, 0, 43, W, 1, '#4E565E');
  for (const degree of DEGREES) {
    const x = SPOUT_X[degree];
    box(ctx, x - 2, 43, 4, SPOUT_Y - 43, '#7E878F');
    box(ctx, x - 1, 43, 1, SPOUT_Y - 43, '#9EA7AF');
    box(ctx, x - 3, SPOUT_Y - 3, 7, 4, '#6A737B');
  }
  // Pavement, puddles, and cobbles.
  box(ctx, 0, STREET, W, H - STREET, mix('#56555F', '#8C877E', sun));
  box(ctx, 0, STREET, W, 2, mix('#6C6B74', '#A39D92', sun));
  for (let i = 0; i < 26; i++)
    box(ctx, (i * 37) % W, STREET + 8 + ((i * 11) % 22), 9, 1, mix('#4B4A54', '#7D786F', sun));
  for (const [px, py, pw] of [
    [70, 170, 34],
    [200, 165, 26],
    [150, 176, 40],
  ]) {
    oval(ctx, px, py, pw / 2, 3, mix('#6E7D93', '#9FD0EA', sun));
    if (wet > 0.1)
      for (let k = 0; k < 2; k++) {
        const t = (seconds * 0.9 + k * 0.5 + px) % 1;
        ctx.strokeStyle = alpha('#C7D6E2', (1 - t) * wet);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(px - pw / 4 + (k * pw) / 2, py, 1 + t * 6, 0.5 + t * 1.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
  }
}
function rainbow(ctx: Ctx, amount: number) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.6 * amount;
  ['#E46A5E', '#F0A04B', '#F2D45C', '#79BF73', '#5AA7D6', '#8C7BCB'].forEach((color, i) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    // A wide, low arc that rises behind the rooftops and sweeps across the whole sky.
    const sweep = 0.95 * easeOut(amount);
    ctx.arc(160, 300, 286 - i * 3, Math.PI * 1.5 - sweep, Math.PI * 1.5 + sweep * 0.55);
    ctx.stroke();
  });
  ctx.restore();
}
function container(ctx: Ctx, degree: number, shiver: number) {
  const x = SPOUT_X[degree] + shiver,
    c = COLOR[degree],
    dark = mix(c, '#1C1E26', 0.3);
  shade(ctx, SPOUT_X[degree], STREET + 1, 26);
  switch (degree) {
    case 0: // bucket
      poly(ctx, c, [x - 11, 130, x + 11, 130, x + 9, STREET, x - 9, STREET]);
      box(ctx, x - 12, 128, 24, 3, dark);
      line(ctx, '#5C5F66', 1, [x - 11, 129, x - 6, 122, x + 6, 122, x + 11, 129]);
      break;
    case 2: // watering can
      box(ctx, x - 8, 134, 16, STREET - 134, c);
      poly(ctx, c, [x + 7, 140, x + 18, 128, x + 19, 131, x + 8, 145]);
      box(ctx, x - 12, 137, 4, 7, dark);
      box(ctx, x - 8, 134, 16, 2, dark);
      break;
    case 4: // stock pot
      box(ctx, x - 9, 137, 18, STREET - 137, c);
      box(ctx, x - 10, 136, 20, 2, dark);
      box(ctx, x - 13, 139, 3, 2, dark);
      box(ctx, x + 10, 139, 3, 2, dark);
      break;
    case 7: // kettle
      oval(ctx, x, 143, 8, 7, c);
      box(ctx, x - 3, 134, 6, 3, dark);
      poly(ctx, c, [x + 6, 142, x + 13, 135, x + 14, 137, x + 7, 146]);
      line(ctx, dark, 1, [x - 6, 138, x - 5, 131, x + 5, 131, x + 6, 138]);
      break;
    case 9: // jar
      box(ctx, x - 5, 136, 10, STREET - 136, alpha('#D6ECEE', 0.9));
      box(ctx, x - 4, 134, 8, 2, dark);
      box(ctx, x - 5, 142, 10, 3, c);
      break;
    case 12: // teacup
      box(ctx, x - 5, 144, 10, 6, c);
      box(ctx, x + 5, 145, 3, 3, c);
      box(ctx, x - 7, STREET - 1, 14, 1, dark);
      box(ctx, x - 5, 144, 10, 1, '#FFFFFF');
      break;
  }
}
function dog(ctx: Ctx, x: number, y: number, seconds: number, bark: number, down: boolean) {
  shade(ctx, x, y, 20);
  const wag = Math.sin(seconds * (down ? 2 : 14)) * 2;
  if (down) {
    box(ctx, x - 9, y - 6, 18, 6, '#C48A5A');
    box(ctx, x + 6, y - 10, 8, 7, '#C48A5A');
    box(ctx, x + 7, y - 10, 3, 6, '#8C5A36');
    box(ctx, x + 12, y - 7, 2, 1, '#2A2530');
    box(ctx, x - 12, y - 3 + wag * 0.3, 4, 2, '#C48A5A');
    return;
  }
  box(ctx, x - 8, y - 12, 15, 7, '#C48A5A');
  box(ctx, x - 7, y - 5, 2, 5, '#A87045');
  box(ctx, x + 4, y - 5, 2, 5, '#A87045');
  box(ctx, x - 12, y - 14 + wag, 4, 2, '#C48A5A');
  const lift = bark * 2;
  box(ctx, x + 4, y - 19 - lift, 9, 8, '#C48A5A');
  box(ctx, x + 11, y - 15 - lift, 4, 3, '#D9A676');
  box(ctx, x + 14, y - 16 - lift, 2, 2, '#2A2530');
  box(ctx, x + 5, y - 19 - lift, 3, 7, '#8C5A36');
  box(ctx, x + 10, y - 17 - lift, 1, 1, '#2A2530');
  if (bark > 0.2) box(ctx, x + 12, y - 12 - lift, 4, 1 + bark * 2, '#7A2E2E');
}
function umbrella(ctx: Ctx, x: number, y: number, open: number, color: string) {
  line(ctx, '#3A3036', 1, [x, y, x, y - 22]);
  if (open > 0.5)
    poly(ctx, color, [x - 16, y - 18, x - 12, y - 26, x, y - 30, x + 12, y - 26, x + 16, y - 18]);
  else poly(ctx, color, [x - 2, y - 8, x, y - 26, x + 2, y - 8]);
}

function streetScene(ctx: Ctx, p: number, seconds: number) {
  const wet = 1 - span(p, 0.635, 0.65),
    sun = ease(span(p, 0.876, 0.93));
  street(ctx, seconds, wet, sun);
  // Otto's containers arrive one by one, lowest note first.
  const setOut = (i: number) => span(p, 0.312 + i * 0.008, 0.318 + i * 0.008);
  DEGREES.forEach((degree, i) => {
    if (setOut(i) <= 0) return;
    ctx.save();
    ctx.translate(0, -(1 - easeOut(setOut(i))) * 8);
    const hit = ring(p, STREET_DROPS, degree) + (degree === 12 ? ring(p, [LAST_DROP], 12) : 0);
    container(ctx, degree, hit * Math.sin(p * 5200));
    ctx.restore();
  });
  const spot = (degree: number) => ({ x: SPOUT_X[degree], top: SPOUT_Y, rim: RIM[degree] });
  drips(ctx, p, STREET_DROPS, spot);
  if (p > 0.78) {
    // The last drop gathers slowly at the end of the teacup's pipe.
    const gather = span(p, 0.79, LAST_DROP.p - FALL);
    if (p < LAST_DROP.p - FALL)
      waterDrop(
        ctx,
        SPOUT_X[12] + Math.sin(seconds * 5) * 0.4 * gather,
        SPOUT_Y + 2 + gather * 1.5,
        0.3 + gather * 0.9,
      );
    else drips(ctx, p, [LAST_DROP], spot);
  }
  // Neighbours: a grumpy upstairs window, a lid-banging girl, a can drummer, a big red umbrella.
  const playing = within(p, 0.49, 0.64) || p > 0.9;
  const beatPhase = ((((p - 0.49) / BEAT) % 1) + 1) % 1;
  const onBeat = playing ? Math.max(0, 1 - beatPhase * 4) : 0;
  const cheer = span(p, 0.9, 0.92);
  const slump = within(p, 0.66, LAST_DROP.p);
  const lookUp = within(p, 0.645, 0.7);
  const face = (happy: 'happy' | 'open'): Pick<Figure, 'eyes' | 'mouth'> =>
    lookUp
      ? { eyes: 'wide', mouth: 'o' }
      : slump
        ? { eyes: 'open', mouth: 'flat' }
        : { eyes: happy, mouth: 'grin' };
  const inWindow = (x: number, paint: () => void) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, 55, 16, 18);
    ctx.clip();
    box(ctx, x + 1, 55, 16, 18, '#E9B96E');
    paint();
    ctx.restore();
    box(ctx, x + 8, 55, 2, 18, '#E7DCC8');
  };
  // Upstairs in house two: Mr. Ferro throws open his shutters at the noise.
  const shutters = span(p, 0.455, 0.465);
  if (shutters > 0) {
    const grumpy = p < 0.505;
    inWindow(132, () => {
      person(ctx, 141, 101, {
        skin: '#E2B08E',
        hair: '#C9C4BD',
        coat: '#6E7F6A',
        legs: '#3C3A44',
        build: 'adult',
        size: 1.25,
        hairStyle: 'bald',
        facing: 1,
        arms: grumpy ? [1.4, 1.4] : cheer > 0 ? [2.8, 2.8] : [0.4, 1.8 + onBeat * 0.5],
        ...(grumpy ? { eyes: 'sad', mouth: 'frown' } : face('happy')),
      });
      box(ctx, 143, 66, 5, 2, '#EDE9E2');
    });
    box(ctx, 130, 53, 5 - shutters * 4, 22, '#5E7A6A');
    box(ctx, 148 + shutters * 4, 53, 5 - shutters * 4, 22, '#5E7A6A');
  }
  if (p > 0.5)
    inWindow(10, () => {
      const f: Figure = {
        skin: '#B77B5A',
        hair: '#2B2026',
        coat: '#E98FA0',
        legs: '#4A3F5A',
        hairStyle: 'pigtails',
        size: 1.25,
        facing: 1,
        arms: cheer > 0 ? [2.9, 2.9] : slump ? [0.2, 0.2] : [2 + onBeat * 0.6, 2 + onBeat * 0.6],
        ...face('happy'),
      };
      person(ctx, 19, 89, f);
      if (!slump && cheer === 0)
        for (const side of ['front', 'back'] as const) {
          const h = handOf(19, 89, f, side);
          oval(ctx, h.x + (side === 'front' ? 2 : -2) * (1 - onBeat), h.y, 2, 5, '#C7CED3');
        }
    });
  if (p > 0.5) {
    // Next door, the man in the flat cap drums tin cans on his windowsill.
    inWindow(212, () =>
      person(ctx, 221, 101, {
        skin: '#8A5A42',
        hair: '#1E1A1E',
        coat: '#4F7A86',
        legs: '#35323E',
        build: 'adult',
        facing: -1,
        size: 1.25,
        arms:
          cheer > 0
            ? [2.8, 2.8]
            : slump
              ? [0.3, 0.3]
              : [1.6 + onBeat * 0.5, 1.6 + (1 - onBeat) * 0.5],
        hat: 'cap',
        hatColor: '#34303A',
        ...face('happy'),
      }),
    );
    for (const [cx, h] of [
      [215, 6],
      [221, 8],
      [227, 5],
    ]) {
      box(ctx, cx - 2, 76 - h, 5, h, '#A7B0B5');
      box(ctx, cx - 2, 76 - h, 5, 1, '#D3D9DC');
    }
  }
  if (p > 0.49) {
    const walkIn = span(p, 0.49, 0.515);
    const x = -16 + easeOut(walkIn) * 44;
    const f: Figure = {
      skin: '#F0C8A8',
      hair: '#B6663E',
      coat: '#6B5AA0',
      legs: '#2F2C3A',
      build: 'adult',
      hairStyle: 'bun',
      facing: 1,
      size: 1.25,
      step: walkIn < 1 ? seconds * 12 : undefined,
      arms: [0.3, cheer > 0 ? 2.8 : 2.2],
      ...face('happy'),
    };
    person(ctx, x, 172, f);
    const hand = handOf(x, 172, f);
    const tap = walkIn >= 1 && playing && !slump ? onBeat : 0;
    umbrella(ctx, hand.x, hand.y + 2 - tap, within(p, 0.645, 0.9) ? 0 : 1, '#D2463F');
  }
  // Otto and his crate.
  box(ctx, 276, 136, 26, 14, '#9C7552');
  box(ctx, 276, 136, 26, 2, '#B98E66');
  box(ctx, 282, 140, 1, 10, '#7D5C40');
  box(ctx, 294, 140, 1, 10, '#7D5C40');
  const raincoat = { coat: '#D8543C', hat: 'hood', hatColor: '#D8543C', size: 1.3 } as const;
  if (p < 0.33) {
    // Runs out of his front door with an armful of pots.
    const run = span(p, 0.3, 0.33);
    person(
      ctx,
      282 - run * 12,
      STREET,
      otto({ ...raincoat, facing: -1, step: seconds * 14, arms: [1.4, 1.4], mouth: 'grin' }),
    );
    box(ctx, 266 - run * 12, 124, 14, 9, '#8E9AA2');
    box(ctx, 268 - run * 12, 121, 9, 4, '#E9A13B');
    return;
  }
  const standing = p > 0.36;
  const conducting = within(p, 0.372, 0.46) || within(p, 0.48, 0.64);
  const phase = conducting ? Math.sin(((p - 0.38) / BEAT) * Math.PI) : 0;
  const bow = hump(p, 0.925, 0.955);
  const waiting = within(p, 0.79, LAST_DROP.p);
  const f: Figure = otto({
    ...raincoat,
    facing: -1,
    step: !standing ? seconds * 14 : undefined,
    arms:
      cheer > 0 && bow < 0.1
        ? [2.9, 2.9]
        : slump && !waiting
          ? [0.1, 0.35]
          : conducting
            ? [0.8, 2.3 + phase * 0.5]
            : [0.3, 1.2],
    ...(waiting
      ? { eyes: 'wide', mouth: 'o' }
      : slump
        ? { eyes: 'sad', mouth: 'flat' }
        : lookUp
          ? { eyes: 'wide', mouth: 'o' }
          : { eyes: 'happy', mouth: 'grin' }),
    lean: bow * 0.7,
  });
  const ox = standing ? 289 : 270 + span(p, 0.33, 0.36) * 19,
    oy = standing ? 136 : STREET - span(p, 0.35, 0.36) * 14;
  person(ctx, ox, oy, f);
  if (!(cheer > 0 && bow < 0.1)) {
    const hand = handOf(ox, oy, f);
    const droop = slump && !waiting ? 12 : 0;
    line(ctx, '#C89B6A', 1.5, [hand.x, hand.y, hand.x - 6, hand.y - 8 + droop]);
    oval(ctx, hand.x - 7, hand.y - 9 + droop, 2, 3, '#C89B6A');
  }
  // The dog trots in and barks at the end of every phrase.
  if (p > 0.515) {
    const trot = span(p, 0.515, 0.535);
    const bark = Math.max(...BARKS.map((b) => hump(p, b, b + 0.01)));
    dog(ctx, 330 - trot * 62, STREET + 14, seconds, lookUp ? 0 : bark, slump && !lookUp);
  }
}
const BARKS = [0.49 + 7 * BEAT, 0.49 + 15 * BEAT, 0.93];

// Camera keyframes: [p, x, y, zoom].
const ROOM_CAMERA = [
  [0, 150, 96, 1.2],
  [0.05, 150, 96, 1.2],
  [0.1, 96, 100, 2.3],
  [0.13, 96, 100, 2.3],
  [0.13, 214, 140, 2.4],
  [0.186, 214, 140, 2.4],
  [0.2, 220, 128, 1.6],
  [0.232, 206, 128, 1.6],
  [0.262, 190, 130, 1.9],
  [0.268, 158, 128, 2.6],
  [0.28, 158, 128, 2.6],
  [0.3, 120, 128, 1.8],
] as const;
const STREET_CAMERA = [
  [0.3, 272, 116, 2.1],
  [0.315, 262, 118, 2.0],
  [0.36, 128, 122, 1.6],
  [0.378, 162, 108, 1.15],
  [0.452, 162, 108, 1.2],
  [0.47, 141, 66, 3.6],
  [0.49, 141, 66, 3.4],
  [0.565, 160, 90, 1],
  [0.7, 160, 90, 1],
  [0.78, 272, 110, 2],
  [0.78, 258, 120, 2.8],
  [0.875, 258, 119, 3],
  [0.9, 258, 118, 2.6],
  [0.9, 160, 90, 1],
  [1, 160, 94, 1.06],
] as const;

/** The soundtrack on its own, so the audio worker never loads the pictures. */
export const theRainOrchestraScore: FilmModule['score'] = (film) =>
  composeFilm(film, { root: ROOT, voice: 'bell', intro: [7, 4, 0], outro: [0, 7, 12, 16] }, (s) => {
    // Rain everywhere until it stops; a soft roll of thunder sets the mood.
    const bpm = 60 / (BEAT * s.story);
    s.fx('rain', 0, s.story * 0.65, 0.13);
    s.fx('thunder', 0.01, 4, 0.18, -0.3);
    s.fx('yawn', 0.035, 1.4, 0.16, -0.4);
    // Act one: grey afternoon, a lonely little tune.
    s.section({
      from: 0,
      to: 0.14,
      bpm: 76,
      root: 62,
      minor: true,
      chords: [0, -4, 3, -2],
      melody: [null, 12, null, 10, null, 7, null, null],
      voice: 'keys',
      gain: 0.6,
      level: 0.8,
    });
    // Curiosity: pizzicato steps while he fetches jars.
    s.section({
      from: 0.14,
      to: 0.232,
      bpm,
      root: ROOT,
      chords: [0, 5],
      melody: [0, null, 7, null, 4, null, 9, null],
      step: 0.5,
      voice: 'pluck',
      gain: 0.45,
      level: 0.5,
      pad: false,
    });
    s.section({
      from: 0.232,
      to: 0.3,
      bpm,
      root: ROOT,
      chords: [0],
      level: 0.35,
      bass: false,
    });
    // Bustle: setting out pots on the street.
    s.section({
      from: 0.3,
      to: 0.38,
      bpm,
      root: ROOT,
      chords: [0, 5, 7, 0],
      melody: [0, 4, 7, 4],
      step: 0.5,
      voice: 'pluck',
      gain: 0.5,
      groove: 'tick',
      level: 0.7,
    });
    // First rehearsal: the drips carry the tune over a light bed.
    s.section({
      from: 0.38,
      to: 0.455,
      bpm,
      root: ROOT,
      chords: [0, 7],
      level: 0.55,
      groove: 'tick',
    });
    s.section({
      from: 0.455,
      to: 0.49,
      bpm,
      root: ROOT,
      chords: [-2],
      level: 0.4,
      bass: false,
    });
    // The whole street: full groove.
    s.section({
      from: 0.49,
      to: 0.64,
      bpm,
      root: ROOT,
      chords: [0, 7, 5, 7],
      level: 1,
      groove: 'pulse',
      fade: 0.3,
    });
    // The rain stops: a held suspension that never resolves, and an empty street.
    s.fx('wind', 0.65, s.story * 0.14, 0.06);
    s.section({
      from: 0.65,
      to: 0.78,
      bpm: 60,
      root: ROOT,
      chords: [5, 2],
      minor: true,
      level: 0.45,
      bass: false,
      fade: 2,
    });
    // The last drop gathers...
    s.note(0.79, ROOT + 7, s.story * 0.085, 'pad', 0.03, -0.2);
    s.note(0.79, ROOT + 11, s.story * 0.085, 'pad', 0.02, 0.2);
    for (let i = 0; i < 6; i++) s.fx('tick', 0.8 + i * 0.012, 0.05, 0.05 + i * 0.012, 0.3);
    // ...and lands: home at last.
    s.chord(LAST_DROP.p, [ROOT, ROOT + 4, ROOT + 7, ROOT + 12], 3.5, 'pad', 0.04);
    s.fx('sparkle', LAST_DROP.p, 1.4, 0.12, 0.4);
    // Finale: the tune played properly, and it finally resolves.
    s.section({
      from: 0.9,
      to: 1,
      bpm,
      root: ROOT,
      chords: [0, 7, 0],
      melody: [...THEME_A, 0, 12],
      voice: 'bell',
      gain: 0.85,
      groove: 'drive',
      level: 0.9,
    });
    s.fx('applause', 0.9, s.story * 0.09, 0.2);
    s.fx('tweet', 0.93, 1.2, 0.08, 0.6);
    s.fx('tweet', 0.965, 1.2, 0.07, -0.5);
    // Every drip is a bell note in its own container's pitch, with a tiny splash.
    const pan = (degree: number, street: boolean) =>
      street ? (SPOUT_X[degree] / W - 0.5) * 1.2 : (LEAKS[degree] / W - 0.5) * 0.8;
    for (const drop of ROOM_DROPS) {
      s.note(drop.p, ROOT + drop.degree, 1.4, 'bell', 0.11, pan(drop.degree, false));
      s.fx('drip', drop.p, 0.2, 0.08, pan(drop.degree, false));
    }
    for (const drop of STREET_DROPS) {
      s.note(drop.p, ROOT + drop.degree + 12, 1.1, 'bell', 0.1, pan(drop.degree, true));
      s.fx('drip', drop.p, 0.15, 0.06, pan(drop.degree, true));
    }
    s.note(LAST_DROP.p, ROOT + 24, 3, 'bell', 0.14, 0.5);
    s.fx('drip', LAST_DROP.p, 0.25, 0.1, 0.5);
    // Pots set down, shutters bang open, the band's umbrella and the dog.
    for (let i = 0; i < 6; i++) s.fx('knock', 0.318 + i * 0.008, 0.2, 0.14, (i / 5 - 0.5) * 1.2);
    s.fx('creak', 0.455, 0.7, 0.12, -0.2);
    s.fx('creak', 0.5, 0.6, 0.1, 0.3);
    for (const b of BARKS) s.fx('bark', b, 0.3, 0.16, 0.7);
    for (let i = 1; i < 16; i += 2) s.fx('knock', 0.49 + i * BEAT, 0.12, 0.07, -0.8);
  });

export const theRainOrchestra: FilmModule = {
  draw(ctx, p, seconds) {
    const { index } = shot(p, CUTS);
    if (index < 2) {
      camera(ctx, track(p, ROOM_CAMERA), () => {
        room(ctx, p, seconds);
        ottoInside(ctx, p, seconds);
      });
      vignette(ctx, 0.5);
    } else {
      camera(ctx, track(p, STREET_CAMERA), () => streetScene(ctx, p, seconds));
      // Rain falls in screen space so it keeps the same weight at every zoom.
      const rain = 1 - span(p, 0.635, 0.65);
      if (rain > 0)
        rainfall(ctx, seconds, { amount: rain * (index === 5 ? 0.4 : 0.9), slant: 0.15 });
      if (index === 5 && p > LAST_DROP.p)
        glow(ctx, 330, -20, 260, '#FFE3A0', ease(span(p, 0.876, 0.9)) * 0.45);
      vignette(ctx, 0.4 - ease(span(p, 0.88, 0.95)) * 0.25);
    }
    // Quick dips to black between inside and outside, and into and out of the last drop.
    veil(
      ctx,
      '#07090C',
      Math.max(hump(p, 0.29, 0.31), hump(p, 0.775, 0.785) * 0.7, hump(p, 0.895, 0.905) * 0.5),
    );
    captions(ctx, p, [
      [0.02, 0.11, 'Rain. Again.'],
      [0.235, 0.275, 'Wait... was that a tune?'],
      [0.36, 0.43, 'The Rain Orchestra: first rehearsal.'],
      [0.53, 0.6, 'Then the whole street joined in.'],
      [0.66, 0.75, 'And then... the rain stopped.'],
    ]);
  },
  score: theRainOrchestraScore,
  look: {
    shade: '#141821',
    ink: '#FFF1D2',
    accent: '#E9A13B',
    dedication: 'for everyone who ever waited out the rain',
  },
};
