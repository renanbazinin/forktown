import { HOUSE_PLOTS } from '../../lib/events';
import type { BuildingType } from '../../lib/schema';
import type { AdModule } from '../types';
import {
  alpha,
  backOut,
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
  lerp,
  line,
  mix,
  oval,
  person,
  poly,
  presence,
  rand,
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
  type View,
} from '../kit';
import { composeAd } from '../score-kit';

// Open Plot Realty, 30 s: an agent shows off an empty plot, and the down payment fits in a pocket.

/** Every house plot on the map, counted from the map itself, so the ad keeps up with the town. */
export const PLOT_COUNT = HOUSE_PLOTS.length;

const INK = '#23392B';
const CREAM = '#FFF8E8';
const CORAL = '#C8553D';
const SIGN = '#2F5A48';
const PAPER = '#FDFCF8';
const DOOR = '#6E4E40';
const FLOOR = 12;

type Paint = (ctx: Ctx, floors: number, lit: number) => void;
const pane = (ctx: Ctx, x: number, y: number, w: number, h: number, lit: number) => {
  box(ctx, x, y, w, h, mix('#9CC4D8', '#FFD98A', lit));
  box(ctx, x, y, w, 1, mix('#C4E0EC', '#FFE8B8', lit));
  box(ctx, x - 1, y + h, w + 2, 1, '#F8F7F2');
};
const upstairs = (ctx: Ctx, top: number, floors: number, lit: number, left = -10, right = 4) => {
  if (floors < 1.9) return;
  pane(ctx, left, top + 4, 6, 5, lit);
  pane(ctx, right, top + 4, 6, 5, lit);
};

/**
 * One painter for each building style a neighbor can choose. Keyed by the town's own style list,
 * so a new style will not type-check until it has a painter here.
 */
export const STYLES: Record<BuildingType, { label: string; paint: Paint }> = {
  cottage: {
    label: 'Cottage',
    paint(ctx, floors, lit) {
      const top = -(FLOOR * floors + 3);
      box(ctx, 7, top - 13, 4, 10, '#9A5E4C');
      box(ctx, -15, top, 30, -top, '#F1E4C6');
      box(ctx, -15, top, 3, -top, '#DECDA8');
      poly(ctx, '#B8674A', [-19, top + 1, 0, top - 14, 19, top + 1]);
      poly(ctx, '#A35840', [-19, top + 1, 0, top - 14, 0, top + 1]);
      box(ctx, -3, -10, 6, 10, DOOR);
      box(ctx, 1, -5, 1, 1, '#D8C8A8');
      pane(ctx, -12, -9, 6, 5, lit);
      pane(ctx, 6, -9, 6, 5, lit);
      box(ctx, -13, -3, 8, 2, '#6F9A58');
      box(ctx, -12, -4, 1, 1, '#E58A86');
      box(ctx, -9, -4, 1, 1, '#F8F7F2');
      box(ctx, -7, -4, 1, 1, '#E58A86');
      upstairs(ctx, top, floors, lit);
    },
  },
  cafe: {
    label: 'Café',
    paint(ctx, floors, lit) {
      const top = -(FLOOR * floors + 5);
      box(ctx, -16, top, 32, -top, '#F4DCCB');
      box(ctx, -16, top, 3, -top, '#E2C6B2');
      box(ctx, -17, top - 3, 34, 3, '#8E5E50');
      box(ctx, -8, top - 8, 16, 5, SIGN);
      box(ctx, -2, top - 7, 4, 3, '#F8F4EC');
      box(ctx, 2, top - 6, 1, 1, '#F8F4EC');
      pane(ctx, -13, -10, 14, 7, lit);
      box(ctx, -6, -10, 1, 7, '#F4DCCB');
      box(ctx, 4, -11, 7, 11, DOOR);
      for (let i = 0; i < 7; i++) box(ctx, -16 + i * 4.6, -16, 4.6, 4, i % 2 ? '#F8F4EC' : CORAL);
      upstairs(ctx, top, floors, lit, -11, 5);
    },
  },
  bookshop: {
    label: 'Bookshop',
    paint(ctx, floors, lit) {
      const top = -(FLOOR * floors + 7);
      box(ctx, -14, top, 28, -top, '#5E7E6A');
      box(ctx, -14, top, 3, -top, '#4E6C5A');
      poly(ctx, '#46505E', [-17, top + 1, 0, top - 17, 17, top + 1]);
      poly(ctx, '#3A4350', [-17, top + 1, 0, top - 17, 0, top + 1]);
      disc(ctx, 0, top - 6, 2.5, mix('#9CC4D8', '#FFD98A', lit));
      box(ctx, -12, -14, 14, 2, '#E9DFC6');
      box(ctx, -12, -11, 14, 9, '#E9DFC6');
      const spines = [CORAL, '#7B5A78', '#4E7AA0', '#D98A6A', '#6F9A58', '#F8F4EC'];
      spines.forEach((color, i) => box(ctx, -11 + i * 2, -10 + (i % 3 === 1 ? 1 : 0), 2, 7, color));
      if (lit > 0) box(ctx, -11, -10, 12, 7, alpha('#FFD98A', lit * 0.45));
      box(ctx, 4, -11, 7, 11, '#2F3A48');
      upstairs(ctx, top, floors, lit, -9, 3);
    },
  },
  greenhouse: {
    label: 'Greenhouse',
    paint(ctx, floors, lit) {
      const top = -(FLOOR * floors + 2);
      const glass = mix('#CFE9E0', '#FFE6B0', lit * 0.6);
      box(ctx, -16, top, 32, -top, glass);
      poly(ctx, mix('#DDF1EA', '#FFEBC0', lit * 0.6), [-17, top, 0, top - 11, 17, top]);
      oval(ctx, -8, -4, 6, 5, '#6F9A58');
      oval(ctx, 7, -5, 7, 6, '#5E8A48');
      oval(ctx, 0, -3, 4, 3, '#86B06A');
      disc(ctx, -9, -8, 1, '#E58A86');
      disc(ctx, 9, -10, 1, '#F8F7F2');
      for (const x of [-16, -8, 8, 15]) box(ctx, x, top, 1, -top, '#F8F7F2');
      box(ctx, -16, top, 32, 1, '#F8F7F2');
      if (floors > 1.9) box(ctx, -16, -FLOOR - 1, 32, 1, '#F8F7F2');
      line(ctx, '#F8F7F2', 1, [-17, top, 0, top - 11, 17, top]);
      box(ctx, 0, top - 10, 1, 10, '#F8F7F2');
      box(ctx, -3, -10, 6, 10, alpha('#F8F7F2', 0.6));
      box(ctx, -2, -9, 4, 9, glass);
    },
  },
  studio: {
    label: 'Studio',
    paint(ctx, floors, lit) {
      const top = -(FLOOR * floors + 4);
      box(ctx, -15, top, 30, -top, '#E6DDCB');
      box(ctx, -15, top, 3, -top, '#D4C9B2');
      poly(ctx, '#5A5560', [-17, top + 1, -17, top - 2, 17, top - 12, 17, top + 1]);
      poly(ctx, mix('#A8CCE0', '#FFD98A', lit), [2, top - 6, 12, top - 9, 12, top - 7, 2, top - 4]);
      box(ctx, -12, -13, 15, 10, '#F8F7F2');
      pane(ctx, -11, -12, 13, 8, lit);
      box(ctx, -5, -12, 1, 8, '#F8F7F2');
      box(ctx, -11, -8, 13, 1, '#F8F7F2');
      box(ctx, 6, -11, 6, 11, CORAL);
      box(ctx, 7, -9, 1, 1, '#4E7AA0');
      box(ctx, 10, -6, 1, 1, '#F8F4EC');
      upstairs(ctx, top, floors, lit);
    },
  },
  observatory: {
    label: 'Observatory',
    paint(ctx, floors, lit) {
      const top = -(FLOOR * floors + 3);
      oval(ctx, 0, top, 14, 13, '#AEB8C2');
      oval(ctx, -5, top - 5, 5, 5, '#C4CCD4');
      box(ctx, -2, top - 13, 5, 13, '#2C3444');
      line(ctx, '#6A7280', 3, [1, top - 6, 11, top - 17]);
      box(ctx, -14, top, 28, -top, '#DDD6C6');
      box(ctx, -14, top, 3, -top, '#CAC2B0');
      box(ctx, -15, top, 30, 2, '#B8AE98');
      box(ctx, -3, -10, 6, 10, DOOR);
      for (const x of [-8, 8]) {
        disc(ctx, x, -7, 2.5, '#F8F7F2');
        disc(ctx, x, -7, 1.8, mix('#9CC4D8', '#FFD98A', lit));
        if (floors > 1.9) disc(ctx, x, top + 6, 1.8, mix('#9CC4D8', '#FFD98A', lit));
      }
    },
  },
};
/**
 * The catalogue's order, as a plain list so the jingle's beats (STYLE_AT) never pull the painters
 * into the audio worker. Keep it in step with STYLES and the schema's BUILDING_TYPES.
 */
export const ORDER: readonly BuildingType[] = [
  'cottage',
  'cafe',
  'bookshop',
  'greenhouse',
  'studio',
  'observatory',
];
const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

/** The ad's copy. The tagline lives only on the sponsor slate. */
export const COPY = {
  plots: `${PLOT_COUNT} plots.`,
  styles: `${COUNT_WORDS[ORDER.length] ?? ORDER.length} styles.`,
  floors: 'One or two floors.',
  features: 'Original features.',
  ask: 'Now, about the down payment.',
  joke: 'Down payment: one JSON file.',
  eyebrow: 'OPEN HOUSE · EVERY DAY',
  address: 'renanbazinin.github.io/forktown',
  pick: 'Pick an open plot',
  button: 'Create my house file on GitHub',
} as const;

// Story beats in spot progress (0..1 across the 30 s), shared by the picture and the jingle.
export const CUTS = [0, 0.17, 0.37, 0.6] as const;
/** The agent reaches the plot and presents it; a rabbit pops up on cue. */
export const ARRIVE = 0.1;
export const RABBIT = 0.12;
/** The catalogue flips: one style per page, then back to the cottage for the floors. */
export const STYLE_AT: readonly number[] = ORDER.map((_, i) => 0.19 + (i * 0.12) / ORDER.length);
export const RETURN = 0.312;
export const FLOOR_UP = 0.326;
export const FLOOR_DOWN = 0.35;
/** The down payment: the ask, a gulp, a heavy piggy bank, a kind no, and the paper. */
export const ASK = 0.41;
export const GULP = 0.425;
export const PIGGY = 0.455;
export const NOPE = 0.478;
export const POCKET = 0.505;
/** The paper goes down on the desk, and the stamp comes down on it. */
export const SET_DOWN = 0.537;
export const STAMP = 0.548;
export const MOVE_IN = 0.566;
export const HUG = 0.58;
/** At nightfall the lanterns come on, oldest first: three neighbors, then the new house. */
export const LANTERNS = [0.775, 0.79, 0.805, 0.83] as const;
/** The address and the button are readable from here until the slate. */
export const END_CARD = 0.605;

// The lane at the edge of town, in world units: three neighbors, then the open plots.
const WORLD = { w: 440, h: H };
const G = 136;
const LANE = 150;
const PLOT = 215;
const OPEN_PLOTS = [PLOT, 300, 385] as const;
const NEIGHBORS: readonly (readonly [number, BuildingType, number])[] = [
  [40, 'cottage', 1],
  [95, 'bookshop', 2],
  [150, 'cafe', 1],
];
const TABLE = { x: 226, top: 137 };

const AGENT: Figure = {
  skin: '#E6B08C',
  hair: '#4A2E26',
  coat: CORAL,
  legs: '#2F3440',
  build: 'adult',
  hairStyle: 'bun',
};
const NEWCOMER: Figure = {
  skin: '#B07A58',
  hair: '#2A2226',
  coat: '#5E86B8',
  legs: '#4A5A6E',
  build: 'adult',
  hat: 'beanie',
  hatColor: '#7B5A78',
};

type Lane = {
  seconds: number;
  house: { type: BuildingType; floors: number; pop: number } | null;
  /** Lantern light for the three neighbors, oldest first, then the new house. */
  lit: readonly number[];
  night: number;
  /** Whether the plot on offer still flies its OPEN pennant. */
  offered: boolean;
};

function building(
  ctx: Ctx,
  type: BuildingType,
  x: number,
  g: number,
  floors: number,
  lit: number,
  pop = 1,
) {
  if (pop <= 0) return;
  ctx.save();
  ctx.translate(x, g);
  ctx.scale(lerp(1.3, 1, ease(pop)), backOut(pop));
  STYLES[type].paint(ctx, floors, lit);
  ctx.restore();
}

function lanternPost(ctx: Ctx, x: number, y: number, lit: number) {
  box(ctx, x, y - 17, 1, 17, '#3E3A40');
  box(ctx, x - 1, y - 18, 3, 1, '#3E3A40');
  box(ctx, x - 1, y - 22, 3, 4, mix('#56545C', '#FFE6A8', lit));
  box(ctx, x - 2, y - 23, 5, 1, '#3E3A40');
  if (lit > 0) glow(ctx, x + 0.5, y - 20, 16, '#FFD27A', lit * 0.55);
}

function plotMarks(ctx: Ctx, x: number, seconds: number, flag: boolean) {
  const back = G - 12,
    front = G + 6;
  poly(ctx, '#93B676', [x - 26, back, x + 26, back, x + 30, front, x - 30, front]);
  line(ctx, alpha('#F8F7F2', 0.85), 1, [
    x - 26,
    back - 2,
    x + 26,
    back - 2,
    x + 30,
    front - 2,
    x - 30,
    front - 2,
    x - 26,
    back - 2,
  ]);
  for (const [sx, sy] of [
    [x - 26, back],
    [x + 26, back],
    [x + 30, front],
    [x - 30, front],
  ])
    box(ctx, sx - 1, sy - 4, 2, 5, '#8E6C4C');
  if (flag) {
    // A little OPEN pennant on the front stake, flapping in the breeze.
    const wave = Math.sin(seconds * 5 + x * 0.1);
    box(ctx, x - 31, front - 20, 1, 16, '#8E6C4C');
    poly(ctx, CORAL, [x - 30, front - 20, x - 19, front - 17 + wave, x - 30, front - 13]);
  }
}

function lane(ctx: Ctx, view: View, s: Lane) {
  const dim = (color: string) => mix(color, '#1C2A34', s.night * 0.55);
  const drift = view.x * 0.55;
  oval(ctx, 60 + drift, 122, 170, 20, dim('#A9C68C'));
  oval(ctx, 290 + drift, 124, 180, 17, dim('#9DBE82'));
  oval(ctx, 470 + drift, 123, 120, 16, dim('#A9C68C'));
  box(ctx, 0, 118, WORLD.w, H - 118, dim('#88AC6C'));
  box(ctx, 0, 118, WORLD.w, 2, dim('#9CC07E'));
  for (let i = 0; i < 30; i++) {
    const x = rand(i * 3.3) * WORLD.w,
      y = 121 + rand(i * 7.1) * 50;
    if (y > LANE - 7 && y < LANE + 9) continue;
    box(ctx, x, y, 1, 2, dim('#6F9458'));
    box(ctx, x + 2, y + 1, 1, 1, dim('#6F9458'));
  }
  // The lane itself.
  box(ctx, 0, LANE - 5, WORLD.w, 12, dim('#DCCBA2'));
  box(ctx, 0, LANE - 5, WORLD.w, 1, dim('#C9B68C'));
  box(ctx, 0, LANE + 7, WORLD.w, 1, dim('#C9B68C'));
  // A round tree where the town gives way to meadow.
  box(ctx, 426, 104, 4, 32, dim('#6A5040'));
  disc(ctx, 428, 96, 16, dim('#6F9A58'));
  disc(ctx, 420, 102, 10, dim('#7FA85A'));
  OPEN_PLOTS.forEach((x, i) => plotMarks(ctx, x, s.seconds, i > 0 || (s.offered && !s.house)));
  if (s.house) {
    shade(ctx, PLOT, G + 1, 40 * ease(s.house.pop), 0.2);
    building(ctx, s.house.type, PLOT, G, s.house.floors, s.lit[3] ?? 0, s.house.pop);
    if (s.house.pop >= 1) lanternPost(ctx, PLOT + 22, G + 8, s.lit[3] ?? 0);
  }
  NEIGHBORS.forEach(([x, type, floors], i) => {
    shade(ctx, x, G + 1, 40, 0.2);
    building(ctx, type, x, G, floors, s.lit[i] ?? 0);
    lanternPost(ctx, x + 20, G + 8, s.lit[i] ?? 0);
  });
}

function daySky(ctx: Ctx, seconds: number) {
  sky(ctx, ['#8CC4E2', '#AAD4EA', '#CFE6EC', '#EAF1E2'], 0, 124);
  glow(ctx, 272, 28, 70, '#FFF6D8', 0.5);
  disc(ctx, 272, 28, 10, '#FFF8E4');
  for (let i = 0; i < 3; i++) {
    const x = ((40 + i * 130 + seconds * (3 + i)) % 400) - 40,
      y = 18 + i * 14;
    oval(ctx, x, y, 18, 5, alpha('#FFFFFF', 0.8));
    oval(ctx, x + 8, y - 3, 10, 5, alpha('#FFFFFF', 0.8));
  }
}

function rabbit(ctx: Ctx, x: number, y: number, up: number, seconds: number) {
  if (up <= 0) return;
  oval(ctx, x, y + 1, 5, 1.5, '#4E6A3C');
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 8, y - 22, 16, 23);
  ctx.clip();
  ctx.translate(x, y + (1 - up) * 14);
  oval(ctx, 0, -4, 4, 4, '#B8A28C');
  disc(ctx, 0, -8, 3, '#C4AE98');
  const twitch = Math.sin(seconds * 9) > 0.6 ? 1 : 0;
  box(ctx, -2, -15 + twitch, 2, 6, '#C4AE98');
  box(ctx, 1, -15, 2, 6, '#C4AE98');
  box(ctx, -1, -14 + twitch, 1, 3, '#E8B8B0');
  box(ctx, 1, -9, 1, 1, '#2A2530');
  box(ctx, 2, -7, 1, 1, '#E58A86');
  ctx.restore();
}

function clipboard(ctx: Ctx, x: number, y: number) {
  box(ctx, x - 3, y - 8, 7, 9, '#A8845C');
  box(ctx, x - 2, y - 7, 5, 7, PAPER);
  box(ctx, x - 1, y - 9, 3, 2, '#6A6A70');
  box(ctx, x - 1, y - 5, 3, 1, '#9AA0A8');
  box(ctx, x - 1, y - 3, 3, 1, '#9AA0A8');
}

function catalogue(ctx: Ctx, x: number, y: number, flip: number) {
  box(ctx, x - 7, y - 4, 14, 6, SIGN);
  box(ctx, x - 6, y - 5, 6, 6, PAPER);
  box(ctx, x, y - 5, 6, 6, '#EDEBE2');
  box(ctx, x - 5, y - 3, 4, 3, '#B8674A');
  box(ctx, x + 1, y - 4, 4, 1, '#9AA0A8');
  box(ctx, x + 1, y - 2, 3, 1, '#9AA0A8');
  if (flip > 0 && flip < 1) {
    const w = Math.cos(flip * Math.PI) * 6;
    box(ctx, x + Math.min(0, w), y - 6, Math.abs(w) + 1, 6, '#FFFFFF');
  }
}

function piggy(ctx: Ctx, x: number, y: number, squash = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 + squash * 0.15, 1 - squash * 0.2);
  for (let i = 0; i < 4; i++) box(ctx, -6 + i * 3.6, -3, 2, 3, '#D98A96');
  oval(ctx, 0, -8, 9, 6.5, '#F2A8B4');
  oval(ctx, -2, -10, 5, 2.5, alpha('#FFFFFF', 0.35));
  oval(ctx, 8.5, -8, 2.6, 2.4, '#E8909E');
  box(ctx, 8, -9, 1, 1, '#A85868');
  box(ctx, 9, -8, 1, 1, '#A85868');
  poly(ctx, '#E8909E', [2, -13, 4, -17, 6, -13]);
  disc(ctx, 5, -10, 0.9, '#2A2530');
  box(ctx, -3, -15, 5, 1, '#A85868');
  line(ctx, '#E8909E', 1, [-9, -9, -11, -11, -10, -12]);
  ctx.restore();
}

function jsonPaper(ctx: Ctx, x: number, y: number, open: number, stamped: boolean) {
  const w = 3 + 6 * open,
    h = 3 + 8 * open;
  box(ctx, x - w / 2, y - h / 2, w, h, PAPER);
  box(ctx, x - w / 2, y + h / 2 - 1, w, 1, '#D8D4C6');
  if (open > 0.8) write(ctx, '{ }', x, y + 1, { size: 4, color: '#343E35' });
  if (stamped) line(ctx, '#516B42', 1.2, [x - 2.5, y + 2.5, x - 1, y + 4, x + 3, y + 0.5]);
}

function sparkles(ctx: Ctx, x: number, y: number, t: number) {
  if (t <= 0 || t >= 1) return;
  for (let i = 0; i < 10; i++) {
    const a = rand(i * 2.7) * TAU,
      r = 16 + easeOut(t) * 18 * (0.5 + rand(i + 5));
    const sx = x + Math.cos(a) * r * 1.3,
      sy = y + Math.sin(a) * r * 0.8;
    const color = alpha('#FFF8E8', 1 - t);
    box(ctx, sx - 1, sy, 3, 1, color);
    box(ctx, sx, sy - 1, 1, 3, color);
  }
}

function puff(ctx: Ctx, x: number, g: number, t: number) {
  if (t <= 0 || t >= 1) return;
  for (let i = 0; i < 6; i++) {
    const side = i / 5 - 0.5;
    oval(
      ctx,
      x + side * 50 * easeOut(t),
      g - easeOut(t) * 4,
      5 * (1 - t) + 1,
      3 * (1 - t) + 1,
      alpha('#EFE6CC', 0.8 * (1 - t)),
    );
  }
}

function heading(ctx: Ctx, text: string, amount: number, sub = '') {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = amount;
  const rise = (1 - amount) * 4;
  write(ctx, text, 16, 36 + rise, {
    size: 20,
    type: 'serif',
    color: INK,
    align: 'left',
  });
  box(ctx, 16, 44 + rise, 30, 2, CORAL);
  if (sub) write(ctx, sub, 16, 60 + rise, { size: 12, type: 'italic', color: INK, align: 'left' });
  ctx.restore();
}

/** Shot 1: the agent strides up the lane and presents a patch of grass like a mansion. */
function showing(ctx: Ctx, p: number, seconds: number) {
  daySky(ctx, seconds);
  const view = track(p, [
    [0, 350, 108, 1.5],
    [ARRIVE, 238, 110, 1.6],
    [CUTS[1], 232, 110, 1.66],
  ]);
  camera(
    ctx,
    view,
    () => {
      lane(ctx, view, { seconds, house: null, lit: [], night: 0, offered: true });
      const up = ease(span(p, RABBIT, RABBIT + 0.006)) * (1 - ease(span(p, 0.156, 0.163)));
      rabbit(ctx, PLOT + 2, G - 2, up, seconds);
      const walk = span(p, 0, ARRIVE);
      const x = lerp(470, 252, easeOut(walk));
      const present = backOut(span(p, ARRIVE, ARRIVE + 0.012));
      const f: Figure = {
        ...AGENT,
        facing: -1,
        step: walk < 1 ? seconds * 10 : undefined,
        arms:
          walk < 1
            ? [Math.sin(seconds * 10) * 0.5, 0.5]
            : [-0.2 - present * 0.4, 0.5 + present * 1.5],
        eyes: up > 0.5 ? 'wide' : walk < 1 ? 'open' : 'happy',
        mouth: walk < 1 ? 'smile' : 'grin',
      };
      shade(ctx, x, LANE, 16);
      person(ctx, x, LANE, f);
      const hand = handOf(x, LANE, f, 'back');
      clipboard(ctx, hand.x, hand.y + 2);
      // A little "ta-da" of sparkle where the arm sweeps.
      sparkles(ctx, PLOT + 6, G - 20, span(p, ARRIVE, ARRIVE + 0.03));
    },
    WORLD,
  );
  const lower = span(p, 0.015, 0.03) * (1 - span(p, 0.072, 0.085));
  if (lower > 0) {
    ctx.save();
    ctx.globalAlpha = lower;
    box(ctx, 14, 146, 150, 20, alpha('#1F3326', 0.82));
    poly(ctx, CORAL, [22, 157, 28, 151, 34, 157]);
    box(ctx, 23, 157, 10, 5, CREAM);
    write(ctx, 'OPEN PLOT REALTY', 100, 159, { size: 8, color: CREAM });
    ctx.restore();
  }
  heading(ctx, COPY.plots, ease(span(p, 0.08, 0.095)));
  captions(ctx, p, [[RABBIT + 0.004, 0.158, COPY.features]], {}, 0.01);
}

/** The house on offer during the catalogue: one style per page, then the floors. */
function tryOn(p: number) {
  if (p < STYLE_AT[0]) return null;
  if (p >= RETURN) {
    const up = backOut(span(p, FLOOR_UP, FLOOR_UP + 0.01)),
      down = backOut(span(p, FLOOR_DOWN, FLOOR_DOWN + 0.01));
    const type: BuildingType = 'cottage';
    return { type, index: -1, floors: 1 + up - down, pop: span(p, RETURN, RETURN + 0.008) };
  }
  let index = 0;
  while (index + 1 < STYLE_AT.length && p >= STYLE_AT[index + 1]) index++;
  const pop = span(p, STYLE_AT[index], STYLE_AT[index] + 0.008);
  return { type: ORDER[index], index, floors: 1, pop };
}

/** Shot 2: the catalogue. Each page tries a different style on the plot. */
function catalogueShot(ctx: Ctx, p: number, seconds: number) {
  daySky(ctx, seconds);
  const view = { x: 214, y: 112, zoom: 2.1 + span(p, CUTS[1], CUTS[2]) * 0.08 };
  const house = tryOn(p);
  camera(
    ctx,
    view,
    () => {
      lane(ctx, view, { seconds, house, lit: [], night: 0, offered: true });
      const beat = house ? (house.index >= 0 ? STYLE_AT[house.index] : RETURN) : 0;
      if (house) puff(ctx, PLOT, G, span(p, beat, beat + 0.014));
      const lift = hump(p, FLOOR_UP - 0.008, FLOOR_UP + 0.012),
        press = hump(p, FLOOR_DOWN - 0.008, FLOOR_DOWN + 0.012);
      const f: Figure = {
        ...AGENT,
        facing: -1,
        arms:
          lift > 0
            ? [0.6 + lift * 2.2, 0.6 + lift * 2.2]
            : press > 0
              ? [1.2 - press * 0.4, 1.2 - press * 0.4]
              : [0.2, 1.1],
        eyes: lift > 0.3 || press > 0.3 ? 'wide' : 'happy',
        mouth: lift > 0.3 || press > 0.3 ? 'o' : 'grin',
        lean: Math.sin(seconds * 3) * 0.03,
      };
      shade(ctx, 252, LANE, 16);
      person(ctx, 252, LANE, f);
      if (lift <= 0 && press <= 0) {
        const hand = handOf(252, LANE, f);
        const flip = STYLE_AT.reduce((a, t) => a + span(p, t - 0.006, t), 0) % 1;
        catalogue(ctx, hand.x - 2, hand.y - 1, flip);
      }
    },
    WORLD,
  );
  const styles = presence(p, 0.176, RETURN - 0.002, 0.01);
  const label = house && house.index >= 0 ? STYLES[house.type].label : '';
  heading(ctx, COPY.styles, styles, label);
  heading(ctx, COPY.floors, presence(p, RETURN + 0.004, CUTS[2] + 0.02, 0.01));
}

/** Shot 3: the down payment. The piggy bank is not needed; the paper in the pocket is. */
function downPayment(ctx: Ctx, p: number, seconds: number) {
  daySky(ctx, seconds);
  const view = track(p, [
    [CUTS[2], 214, 126, 2.5],
    [POCKET, 222, 127, 2.7],
    [STAMP, 222, 126, 2.7],
    [MOVE_IN + 0.012, 220, 119, 2.25],
  ]);
  const moved = span(p, MOVE_IN, MOVE_IN + 0.01);
  camera(
    ctx,
    view,
    () => {
      lane(ctx, view, {
        seconds,
        house: moved > 0 ? { type: 'cottage', floors: 2, pop: moved } : null,
        lit: [],
        night: 0,
        offered: true,
      });
      puff(ctx, PLOT, G, span(p, MOVE_IN, MOVE_IN + 0.016));
      sparkles(ctx, PLOT, G - 24, span(p, MOVE_IN + 0.004, MOVE_IN + 0.04));
      agentAtDesk(ctx, p, seconds);
      desk(ctx, p);
      newcomer(ctx, p, seconds);
    },
    WORLD,
  );
}

function desk(ctx: Ctx, p: number) {
  const sag = hump(p, PIGGY, PIGGY + 0.008) * 1.5;
  const { x, top } = TABLE;
  box(ctx, x - 12, top + 2, 2, LANE + 2 - top - 2, '#8A7050');
  box(ctx, x + 10, top + 2, 2, LANE + 2 - top - 2, '#8A7050');
  box(ctx, x - 15, top + sag, 30, 3, '#C9B08A');
  box(ctx, x - 15, top + 3 + sag, 30, 8, SIGN);
  write(ctx, 'OPEN PLOT', x, top + 9 + sag, { size: 4, color: CREAM });
  if (p >= PIGGY) {
    // The clipboard, set down to deal with the piggy bank.
    box(ctx, x + 7, top - 1 + sag, 8, 1, '#A8845C');
    box(ctx, x + 8, top - 2 + sag, 6, 1, PAPER);
  }
  // The piggy bank: up out of the suitcase, onto the desk, and (kindly) pushed back.
  const lifted = span(p, 0.436, PIGGY),
    pushed = ease(span(p, NOPE + 0.012, NOPE + 0.022)),
    hugged = ease(span(p, HUG, HUG + 0.01));
  if (lifted > 0 && hugged < 1) {
    const px = lifted < 1 ? lerp(192, 223, lifted) : lerp(lerp(223, 214, pushed), 203, hugged);
    const py =
      lifted < 1
        ? lerp(LANE - 2, top + sag, easeIn(lifted)) - Math.sin(lifted * Math.PI) * 18
        : lerp(top + sag, 132, hugged);
    piggy(ctx, px, py, hump(p, PIGGY, PIGGY + 0.006));
  }
  // The paper, stamped, on the desk for a moment.
  if (p >= SET_DOWN && p < STAMP + 0.008) {
    box(ctx, x + 2, top - 1 + sag, 9, 2, PAPER);
    if (p >= STAMP) box(ctx, x + 4, top - 1, 5, 1, '#516B42');
  }
}

function agentAtDesk(ctx: Ctx, p: number, seconds: number) {
  const x = 247;
  const wag = Math.sin(seconds * 10) * 0.18;
  const cheer = p >= MOVE_IN + 0.004;
  let arms: [number, number] = [0.1, 0.5];
  if (cheer) arms = [2.6 + Math.sin(seconds * 6) * 0.2, 2.6 - Math.sin(seconds * 6) * 0.2];
  else if (p >= STAMP + 0.008) arms = [0.2, 1.8];
  else if (p >= SET_DOWN) arms = [0.2, lerp(2.5, 1.3, easeIn(span(p, SET_DOWN + 0.004, STAMP)))];
  else if (p >= 0.53) arms = [0.2, 1.8];
  else if (p >= POCKET) arms = [0.2, lerp(1, 1.6, span(p, 0.524, 0.53))];
  else if (p >= NOPE + 0.012) arms = [0.2, 1.4];
  else if (p >= NOPE) arms = [0.2, 2.5 + wag];
  else if (p >= ASK) arms = [0.2, 1.9];
  const f: Figure = {
    ...AGENT,
    facing: -1,
    arms,
    eyes: cheer ? 'happy' : p >= PIGGY && p < NOPE ? 'wide' : p >= NOPE ? 'happy' : 'open',
    mouth: cheer ? 'grin' : p >= PIGGY && p < NOPE ? 'o' : 'smile',
  };
  person(ctx, x, LANE - 1, f);
  const hand = handOf(x, LANE - 1, f);
  if (p < PIGGY) clipboard(ctx, hand.x, hand.y + (p >= ASK ? -2 : 3));
  if (p >= 0.53 && p < SET_DOWN) jsonPaper(ctx, hand.x - 1, hand.y - 6, 1, false);
  if (p >= SET_DOWN && p < STAMP + 0.008) {
    // The rubber stamp, raised high and brought down on the paper.
    const y = lerp(118, TABLE.top - 4, easeIn(span(p, SET_DOWN + 0.004, STAMP)));
    box(ctx, 231, y + 1, 7, 3, '#516B42');
    box(ctx, 233, y - 4, 3, 5, '#8A7050');
    disc(ctx, 234.5, y - 5, 2, '#8A7050');
  }
  if (p >= STAMP + 0.008 && !cheer) jsonPaper(ctx, hand.x - 1, hand.y - 6, 1, true);
  if (cheer) {
    const up = handOf(x, LANE - 1, f);
    jsonPaper(ctx, up.x, up.y - 6, 1, true);
  }
}

function newcomer(ctx: Ctx, p: number, seconds: number) {
  const walk = span(p, CUTS[2], 0.405);
  const x = lerp(172, 203, easeOut(walk));
  const lifting = within(p, 0.436, PIGGY);
  const hugging = p >= HUG;
  const looking = within(p, POCKET, 0.52);
  const offering = within(p, 0.515, 0.53);
  let arms: [number, number] = [0, 0.1];
  if (walk < 1) arms = [0.05, Math.sin(seconds * 9) * 0.4];
  else if (lifting) arms = [1.5, 1.6];
  else if (hugging) arms = [1.2, 1.3];
  else if (offering) arms = [0.1, lerp(0.2, 1.5, span(p, 0.515, 0.522))];
  else if (looking) arms = [0.1, -0.4];
  const worried = within(p, GULP, 0.436) || within(p, NOPE, POCKET);
  const f: Figure = {
    ...NEWCOMER,
    step: walk < 1 ? seconds * 9 : undefined,
    arms,
    eyes: hugging
      ? 'happy'
      : p >= MOVE_IN
        ? 'wide'
        : lifting
          ? 'closed'
          : worried
            ? 'wide'
            : looking
              ? 'open'
              : 'open',
    mouth: hugging ? 'grin' : p >= MOVE_IN ? 'o' : lifting ? 'flat' : worried ? 'o' : 'smile',
    lean: lifting ? -0.12 : looking ? 0.22 : 0,
  };
  // The suitcase: carried in, then set down.
  const back = handOf(x, LANE + 1, f, 'back');
  if (walk < 1) {
    box(ctx, back.x - 6, back.y + 1, 11, 8, '#8E6C4C');
    box(ctx, back.x - 2, back.y - 1, 3, 2, '#5A4632');
  } else {
    box(ctx, 186, LANE - 7, 12, 8, '#8E6C4C');
    box(ctx, 190, LANE - 9, 4, 2, '#5A4632');
    box(ctx, 186, LANE - 4, 12, 1, '#A8845C');
  }
  shade(ctx, x, LANE + 1, 16);
  person(ctx, x, LANE + 1, f);
  // A folded paper peeks out of the back pocket the whole time.
  if (p < POCKET + 0.008) box(ctx, x - 4, LANE - 12, 2, 3, PAPER);
  if (within(p, POCKET + 0.008, 0.53)) {
    const hand = handOf(x, LANE + 1, f);
    jsonPaper(ctx, hand.x, hand.y - 4, span(p, 0.512, 0.52), false);
  }
  if (within(p, GULP, GULP + 0.03)) {
    const drop = span(p, GULP, GULP + 0.03);
    disc(ctx, x + 7, LANE - 42 + drop * 5, 1.3, alpha('#9CD0EA', 1 - drop * 0.6));
    box(ctx, x + 7, LANE - 45 + drop * 5, 1, 2, alpha('#9CD0EA', 1 - drop * 0.6));
  }
  if (hugging) piggy(ctx, x + 2, LANE - 13, 0);
}

/** The end card: nightfall on the lane, the lanterns oldest first, and how to move in. */
function endCard(ctx: Ctx, p: number, seconds: number) {
  const night = ease(span(p, 0.62, 0.8));
  const bands = [
    mix('#3C5E68', '#16242C', night),
    mix('#4F7074', '#1E3036', night),
    mix('#7F8C82', '#28403E', night),
    mix('#C29A84', '#3A5048', night),
  ];
  sky(ctx, bands, 0, 124);
  faded(ctx, night, () => starfield(ctx, seconds, { count: 26, seed: 5, bottom: 96 }));
  const view = { x: 200, y: 90, zoom: 1 };
  const lit = LANTERNS.map((at) => ease(span(p, at, at + 0.01)));
  camera(
    ctx,
    view,
    () => {
      lane(ctx, view, {
        seconds,
        house: { type: 'cottage', floors: 2, pop: 1 },
        lit,
        night,
        offered: false,
      });
      // The yard sign, and the agent beside it.
      box(ctx, 262, LANE - 30, 2, 30, '#6A5040');
      box(ctx, 250, LANE - 30, 14, 2, '#6A5040');
      box(ctx, 251, LANE - 28, 1, 3, '#3E3A40');
      box(ctx, 260, LANE - 28, 1, 3, '#3E3A40');
      box(ctx, 248, LANE - 25, 16, 10, CREAM);
      box(ctx, 249, LANE - 24, 14, 8, SIGN);
      poly(ctx, CORAL, [252, LANE - 19, 256, LANE - 23, 260, LANE - 19]);
      box(ctx, 253, LANE - 19, 6, 3, CREAM);
      const wave = Math.sin(seconds * 6) * 0.35;
      person(ctx, 278, LANE, {
        ...AGENT,
        facing: -1,
        arms: [0.2, 2.2 + wave],
        eyes: 'happy',
        mouth: 'grin',
      });
      person(ctx, 196, G + 7, {
        ...NEWCOMER,
        hat: 'none',
        arms: [0.1, 2.2 - wave],
        eyes: 'happy',
        mouth: 'grin',
      });
      // The piggy bank has the best seat in the house.
      box(ctx, PLOT + 7, G - 8, 4, 3, '#F2A8B4');
    },
    WORLD,
  );
  // Night grades the scene; the lanterns and windows shine through it.
  veil(ctx, '#101C28', night * 0.35);
  camera(
    ctx,
    view,
    () =>
      [...NEIGHBORS.map(([x]) => x), PLOT].forEach((x, i) => {
        if (lit[i] <= 0) return;
        glow(ctx, x + (i < 3 ? 20 : 22) + 0.5, G - 12, 14, '#FFD27A', lit[i] * 0.5);
        glow(ctx, x, G - 10, 26, '#FFD98A', lit[i] * 0.22);
      }),
    WORLD,
  );
  vignette(ctx, 0.3);
  callToAction(ctx, presence(p, END_CARD, 0.874, 0.014));
}

function callToAction(ctx: Ctx, amount: number) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = amount;
  const rise = (1 - amount) * 3;
  write(ctx, COPY.eyebrow, W / 2, 20 + rise, { size: 6, color: '#BFD8A6' });
  write(ctx, COPY.address, W / 2, 38 + rise, {
    size: 12,
    color: CREAM,
    shadow: alpha('#0B0E14', 0.55),
  });
  // Two steps, as on the real page: pick an open plot, then the green button.
  const button = '500 9px "DM Sans", sans-serif';
  ctx.font = button;
  const label = ctx.measureText(COPY.button).width;
  const pill = label + 22;
  const left = Math.round((W - pill) / 2);
  write(ctx, COPY.pick, W / 2, 58 + rise, {
    size: 12,
    type: 'italic',
    color: CREAM,
    shadow: alpha('#0B0E14', 0.55),
  });
  const arrowY = 62 + rise;
  line(ctx, alpha('#BFD8A6', 0.9), 1, [W / 2, arrowY, W / 2, arrowY + 5]);
  poly(ctx, '#BFD8A6', [W / 2 - 2, arrowY + 4, W / 2 + 3, arrowY + 4, W / 2 + 0.5, arrowY + 7]);
  const top = 70 + rise;
  box(ctx, left + 1, top, pill - 2, 15, '#516B42');
  box(ctx, left, top + 1, pill, 13, '#516B42');
  box(ctx, left + 1, top + 14, pill - 2, 1, '#405934');
  ctx.font = button;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFDF4';
  ctx.fillText(COPY.button, left + 7, top + 10.5);
  // The little external-link mark the real button carries.
  const ix = left + pill - 13,
    iy = top + 4;
  ctx.strokeStyle = '#FFFDF4';
  ctx.lineWidth = 1;
  ctx.strokeRect(ix + 0.5, iy + 1.5, 5, 5);
  box(ctx, ix + 3, iy, 4, 4, '#516B42');
  line(ctx, '#FFFDF4', 1, [ix + 3, iy + 4, ix + 7, iy]);
  box(ctx, ix + 4, iy, 3, 1, '#FFFDF4');
  box(ctx, ix + 6, iy, 1, 3, '#FFFDF4');
  ctx.restore();
}

export const openPlotRealtyAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    // Picture progress → jingle progress, so each effect lands on its frame.
    const at = (p: number) => (p * ad.duration - 0.1) / (ad.duration - 0.4);
    s.fx('tweet', at(0.015), 0.7, 0.05, 0.5);
    s.section({
      from: 0,
      to: at(CUTS[2]),
      bpm: 120,
      root: 62,
      chords: [0, 5, 7, 0],
      melody: [7, 9, 11, 12, null, 7, 4, null, 5, 7, 9, 7, 4, 2, 0, null],
      step: 0.5,
      voice: 'pluck',
      groove: 'pulse',
      gain: 0.5,
      level: 0.7,
      fade: 0.4,
    });
    for (let i = 0; i < 7; i++) s.fx('step', at(0.01 + i * 0.013), 0.08, 0.05, 0.5 - i * 0.07);
    s.fx('sparkle', at(ARRIVE), 1, 0.07, -0.2);
    s.fx('boing', at(RABBIT), 0.3, 0.05, -0.3);
    // The catalogue: a page turn and a pop for every style, climbing the scale.
    const scale = [0, 2, 4, 5, 7, 9, 11, 12];
    STYLE_AT.forEach((t, i) => {
      s.fx('rustle', at(t - 0.005), 0.14, 0.05, 0.4);
      s.fx('pop', at(t), 0.2, 0.13, -0.1);
      s.note(at(t), 74 + scale[i % scale.length], 0.3, 'bell', 0.05, -0.1);
    });
    s.fx('pop', at(RETURN), 0.2, 0.12, -0.1);
    s.fx('boing', at(FLOOR_UP), 0.5, 0.12, -0.1);
    s.fx('boing', at(FLOOR_DOWN), 0.4, 0.09, -0.1);
    // The down payment: tiptoe music, a gulp, a very heavy piggy bank, a kind no.
    s.section({
      from: at(CUTS[2]),
      to: at(STAMP),
      bpm: 120,
      root: 62,
      chords: [0, 5, 0, 7],
      minor: true,
      melody: [0, null, 3, null, 7, null, 3, null, 5, null, 3, null, 2, null, null, null],
      step: 0.5,
      voice: 'keys',
      groove: 'tick',
      gain: 0.45,
      level: 0.55,
      fade: 0.3,
    });
    for (let i = 0; i < 5; i++) s.fx('step', at(CUTS[2] + 0.004 + i * 0.007), 0.08, 0.05, -0.4);
    s.fx('gasp', at(GULP), 0.5, 0.1, -0.2);
    s.fx('thud', at(PIGGY), 0.4, 0.32, -0.1);
    s.fx('clatter', at(PIGGY + 0.002), 0.4, 0.06, -0.1);
    s.fx('giggle', at(NOPE), 0.7, 0.06, 0.3);
    s.fx('swish', at(NOPE + 0.012), 0.3, 0.08, 0);
    s.fx('rustle', at(POCKET + 0.008), 0.4, 0.08, -0.2);
    s.fx('thud', at(STAMP), 0.3, 0.2, 0.2);
    s.fx('chime', at(STAMP + 0.003), 1.2, 0.1, 0.2);
    s.fx('pop', at(MOVE_IN), 0.3, 0.14);
    s.fx('sparkle', at(MOVE_IN + 0.004), 1.4, 0.08);
    s.fx('woo', at(MOVE_IN + 0.01), 0.9, 0.05, 0.3);
    // Welcome home: the jingle comes back brighter, then the lanterns ring in, oldest first.
    s.section({
      from: at(STAMP),
      to: at(0.87),
      bpm: 120,
      root: 62,
      chords: [0, 5, 7, 0, 0, 5, 7, 7],
      melody: [12, 11, 9, 7, 9, 7, 4, null, 5, 7, 9, 11, 12, null, 7, null],
      step: 0.5,
      voice: 'pluck',
      groove: 'march',
      gain: 0.5,
      level: 0.65,
      fade: 0.8,
    });
    LANTERNS.forEach((t, i) => {
      s.note(at(t), 81 + [0, 2, 4, 7][i], 1, 'bell', 0.06, -0.45 + i * 0.3);
      s.fx('chime', at(t), 0.6, 0.03, -0.45 + i * 0.3);
    });
    s.chord(at(0.875), [50, 57, 62, 66, 69], 3, 'pad', 0.05);
  });

export const openPlotRealtyAd: AdModule = {
  draw(ctx, p, seconds) {
    const { index } = shot(p, CUTS);
    if (index === 0) showing(ctx, p, seconds);
    else if (index === 1) catalogueShot(ctx, p, seconds);
    else if (index === 2) downPayment(ctx, p, seconds);
    else endCard(ctx, p, seconds);
    if (index < 3) vignette(ctx, 0.22);
    // A sign-board wipe between the daytime shots, and a dip into the evening.
    for (const cut of [CUTS[1], CUTS[2]]) {
      const wipe = hump(p, cut - 0.012, cut + 0.012);
      if (wipe > 0) {
        box(ctx, 0, 0, W * wipe, H, SIGN);
        box(ctx, W * wipe - 5, 0, 5, H, CREAM);
      }
    }
    veil(ctx, '#1F3326', hump(p, CUTS[3] - 0.014, CUTS[3] + 0.014));
    captions(
      ctx,
      p,
      [
        [ASK - 0.004, PIGGY + 0.012, COPY.ask],
        [STAMP + 0.004, 0.668, COPY.joke],
      ],
      {},
      0.01,
    );
  },
  score: openPlotRealtyAdScore,
  look: { shade: '#1F3326', ink: CREAM, accent: '#BFD8A6' },
};
