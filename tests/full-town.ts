import { readdirSync, readFileSync } from 'node:fs';
import { HOUSE_PLOTS } from '../src/lib/events';
import {
  ACTIVITIES,
  BUILDING_TYPES,
  DECORATIONS,
  placeSchema,
  type HouseDesign,
  type Place,
} from '../src/lib/schema';
import { hash } from '../src/lib/world';

// The town with every house plot taken: the real neighbors where they live, and a made-up house
// on every plot that is still free. A made-up house is a pure function of its plot, so the same
// plot always holds the same house however the real town grows. Every run of plots deals each
// option once, in a shuffled order, so a town with no real houses at all shows every building,
// design, sign and routine the builder offers. New houses stop at two floors, so these do too.
// Only tests and scripts/full-town-check.ts use these houses; they never go in places/.

/** Every house file in places/, parsed, in file order. */
export const readPlaces = (directory = 'places') =>
  readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .map((file) => placeSchema.parse(JSON.parse(readFileSync(`${directory}/${file}`, 'utf8'))));

export const FULL_TOWN_CREATOR = 'full-town';
export const fullTownId = (plot: string) => `full-town-${plot.toLowerCase()}`;

const FLOORS = [1, 2] as const;
const ROOFS = ['classic', 'flat', 'gable'] as const;
const WINDOWS = ['cross', 'round', 'shutters'] as const;
const GARDENS = ['wildflowers', 'paving', 'vegetables'] as const;
const FEATURES = ['none', 'porch', 'balcony'] as const;
const SIGNS = ['text', 'html', 'none'] as const;
const FIGURES = ['male', 'female'] as const;
const ACCESSORIES = ['none', 'hat', 'glasses'] as const;
const NIGHTS = ['sleep', 'stroll'] as const;
/** All 54 routines: 3 × 3 × 3 daytime choices, each with an early night or a night walk. */
const ROUTINES = ACTIVITIES.flatMap((morning) =>
  ACTIVITIES.flatMap((afternoon) =>
    ACTIVITIES.flatMap((evening) =>
      NIGHTS.map((night) => ({ morning, afternoon, evening, night })),
    ),
  ),
);
const WALLS = ['#F0E5C8', '#D1DDE0', '#E8C9B5', '#C9D8B6', '#F2D7A0', '#BFC6D9', '#E4E0D6'];
const TRIMS = ['#846C56', '#687451', '#5B4B63', '#3F5A6B', '#8A4F3D', '#4D4D4D'];
const COLORS = ['#A578BD', '#789B76', '#8392B1', '#D08C60', '#C75D6B', '#5E9C9A', '#B8A04A'];
const SKINS = ['#F2D0B5', '#D9B68B', '#B98A62', '#885E45', '#5C3B28'];
const HAIRS = ['#2B2118', '#675A48', '#B5763C', '#DBD0AA', '#8E3B2E', '#3C4A6B'];
const OUTFITS = ['#789B76', '#60838A', '#A34E4E', '#E0B75A', '#7A6CA8', '#4F6F52', '#C4865A'];
const GREETINGS = ['Hello!', 'Lovely day for it.', 'Come by for tea.', 'Mind the ducks!'];
const SIGN_INK = ['#FFF4D4', '#FFE7A3', '#F4F1E8', '#FFD2C2'];
const SIGN_BOARDS = ['#35554A', '#735557', '#3F4E6B', '#5A4632', '#2F3A2F'];

/**
 * One of `options` for the plot at `index`. Each run of `options.length` plots deals every
 * option exactly once, rotated by a hash of the run and the choice, so choices do not line up.
 */
function deal<T>(options: readonly T[], index: number, choice: string): T {
  const run = Math.floor(index / options.length);
  return options[(index + hash(`full-town:${choice}:${run}`)) % options.length];
}
/** A look that needs no coverage: the same for the same plot, varied across plots. */
const tint = (options: readonly string[], plot: string, choice: string) =>
  options[hash(`full-town:${choice}:${plot}`) % options.length];

/** Signs of one, two and three runs of text, all within the sign language's limits. */
function signHtml(plot: string, index: number) {
  const ink = tint(SIGN_INK, plot, 'html-ink');
  const board = tint(SIGN_BOARDS, plot, 'html-board');
  const runs = [
    `<strong style="font-size: 24px">PLOT ${plot}</strong>`,
    `<p style="font-size: 12px; color: ${ink}">A full town neighbor</p>`,
    `<span style="font-size: 16px; font-weight: bold">OPEN LATE</span>`,
  ].slice(0, 1 + (index % 3));
  return `<div style="background-color: ${board}; color: ${ink}; text-align: center">\n  ${runs.join('\n  ')}\n</div>`;
}

/** The made-up house on a house plot, as the builder would save it. */
export function fullTownHouse(plot: string): Place {
  const index = HOUSE_PLOTS.findIndex((candidate) => candidate.id === plot);
  if (index < 0) throw new Error(`${plot} is not a house plot.`);
  const design: HouseDesign = {
    wall: tint(WALLS, plot, 'wall'),
    trim: tint(TRIMS, plot, 'trim'),
    floors: deal(FLOORS, index, 'floors'),
    roof: deal(ROOFS, index, 'roof'),
    windows: deal(WINDOWS, index, 'windows'),
    garden: deal(GARDENS, index, 'garden'),
    feature: deal(FEATURES, index, 'feature'),
  };
  const mode = deal(SIGNS, index, 'sign');
  return placeSchema.parse({
    id: fullTownId(plot),
    name: `Full Town ${plot}`,
    creator: FULL_TOWN_CREATOR,
    plot,
    building: deal(BUILDING_TYPES, index, 'building'),
    color: tint(COLORS, plot, 'color'),
    decoration: deal(DECORATIONS, index, 'decoration'),
    story: `A made-up neighbor on plot ${plot}, here so the town can be checked with every plot taken.`,
    design,
    resident: {
      name: `Neighbor ${plot}`,
      figure: deal(FIGURES, index, 'figure'),
      skin: tint(SKINS, plot, 'skin'),
      hair: tint(HAIRS, plot, 'hair'),
      outfit: tint(OUTFITS, plot, 'outfit'),
      accessory: deal(ACCESSORIES, index, 'accessory'),
      greeting: tint(GREETINGS, plot, 'greeting'),
      routine: deal(ROUTINES, index, 'routine'),
    },
    sign: {
      mode,
      text: mode === 'none' ? '' : `HOUSE ${plot}`,
      color: tint(SIGN_INK, plot, 'ink'),
      background: tint(SIGN_BOARDS, plot, 'board'),
      html: mode === 'html' ? signHtml(plot, index) : '',
    },
  });
}

/** The made-up houses for every house plot the roster leaves free, in plot order. */
export const fullTownNewcomers = (roster: readonly Place[]) => {
  const taken = new Set(roster.map((place) => place.plot));
  return HOUSE_PLOTS.filter((plot) => !taken.has(plot.id)).map((plot) => fullTownHouse(plot.id));
};

/** The roster, followed by a made-up house on every house plot it leaves free. */
export const fullTown = (roster: readonly Place[]): Place[] => [
  ...roster,
  ...fullTownNewcomers(roster),
];
