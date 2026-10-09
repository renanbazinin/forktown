import { z } from 'zod';
import { compileSign } from './sign.ts';
import { getPlot, PLOTS, type Plot } from './world.ts';
import { venueAt } from './events.ts';
import { FOOTBALL_VENUE, isFootballPlot } from './football.ts';
import { FARM, isFarmPlot } from './farm.ts';
import { isMillpondPlot, MILLPOND_VENUE } from './millpond.ts';
import { isTubePlot, TUBE_LINE_NAME, tubeStation } from './tubes.ts';
import { OPEN_PLOTS_COPY } from './open-plots.ts';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color.');
export const ACTIVITIES = ['stroll', 'work', 'home'] as const;
export const DEFAULT_DESIGN = {
  wall: '#F0E5C8',
  trim: '#846C56',
  floors: 1 as const,
  roof: 'classic' as const,
  windows: 'cross' as const,
  garden: 'wildflowers' as const,
  feature: 'none' as const,
};
export const DEFAULT_RESIDENT = {
  name: 'New neighbor',
  figure: 'male' as const,
  skin: '#D9B68B',
  hair: '#675A48',
  outfit: '#789B76',
  accessory: 'none' as const,
  greeting: 'Hello!',
  routine: {
    morning: 'work' as const,
    afternoon: 'stroll' as const,
    evening: 'home' as const,
    night: 'sleep' as const,
  },
};
export const DEFAULT_SIGN = {
  mode: 'text' as const,
  text: 'HELLO',
  color: '#FFF4D4',
  background: '#35554A',
  html: '',
};
export const designSchema = z
  .object({
    wall: color,
    trim: color,
    floors: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    roof: z.enum(['classic', 'flat', 'gable']),
    windows: z.enum(['cross', 'round', 'shutters']),
    garden: z.enum(['wildflowers', 'paving', 'vegetables']),
    feature: z.enum(['none', 'porch', 'balcony']),
  })
  .strict();
export const residentSchema = z
  .object({
    name: z.string().trim().min(2, 'Give your resident a name.').max(24),
    figure: z.enum(['male', 'female']).default('male'),
    skin: color,
    hair: color,
    outfit: color,
    accessory: z.enum(['none', 'hat', 'glasses']),
    greeting: z.string().trim().min(1).max(40),
    routine: z
      .object({
        morning: z.enum(ACTIVITIES),
        afternoon: z.enum(ACTIVITIES),
        evening: z.enum(ACTIVITIES),
        night: z.enum(['sleep', 'stroll']).default('sleep'),
      })
      .strict(),
  })
  .strict();
export const signSchema = z
  .object({
    mode: z.enum(['none', 'text', 'html']),
    text: z.string().max(18),
    color,
    background: color,
    html: z.string().max(2000),
  })
  .strict()
  .superRefine((sign, context) => {
    if (sign.mode === 'html')
      try {
        compileSign(sign.html);
      } catch (error) {
        context.addIssue({
          code: 'custom',
          path: ['html'],
          message: error instanceof Error ? error.message : 'Check your sign artwork.',
        });
      }
  });

export const BUILDING_TYPES = [
  'cottage',
  'cafe',
  'bookshop',
  'greenhouse',
  'studio',
  'observatory',
] as const;
export const DECORATIONS = ['flowers', 'tree', 'bench', 'mailbox'] as const;
export const TYPE_LABELS: Record<BuildingType, string> = {
  cottage: 'Cottage',
  cafe: 'Café',
  bookshop: 'Bookshop',
  greenhouse: 'Greenhouse',
  studio: 'Studio',
  observatory: 'Observatory',
};

// A plot a house can stand on: one on the town map that no public venue uses.
const plotSchema = z
  .string()
  .refine((id) => !!getPlot(id), 'Choose an existing plot from the town map.')
  .refine(
    (id) =>
      !venueAt(id) &&
      !isFootballPlot(id) &&
      !isFarmPlot(id) &&
      !isMillpondPlot(id) &&
      !isTubePlot(id),
    'This plot is reserved for a public town venue. Choose a house plot.',
  );

export const placeSchema = z
  .object({
    id: z
      .string()
      .min(3, 'Choose a file id of at least 3 characters, e.g. moon-cafe.')
      .max(40, 'Keep the file id to 40 characters or fewer.')
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Use lowercase letters, numbers, and single hyphens, e.g. moon-cafe.',
      )
      .refine(
        (id) => !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(id),
        'This file id is reserved on Windows. Add a word, e.g. con-house or aux-cafe.',
      ),
    name: z
      .string()
      .trim()
      .min(3, 'Give your place a name of at least 3 characters.')
      .max(32, 'Keep the name to 32 characters or fewer.'),
    creator: z
      .string()
      .min(1, 'Add your GitHub username so we can credit your contribution.')
      .max(39, 'A GitHub username can have at most 39 characters.')
      .regex(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d]))*$/i, 'Use your GitHub username, without the @.'),
    plot: plotSchema,
    building: z.enum(BUILDING_TYPES),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color, e.g. #A578BD.'),
    decoration: z.enum(DECORATIONS),
    story: z
      .string()
      .trim()
      .min(10, 'Tell us a little about your place (at least 10 characters).')
      .max(180, 'Keep the story to 180 characters or fewer.'),
    design: designSchema.default(DEFAULT_DESIGN),
    resident: residentSchema.default(DEFAULT_RESIDENT),
    sign: signSchema.default(DEFAULT_SIGN),
  })
  .strict();

// Drafts may be unfinished, but their rendering options must always be valid.
export const draftSchema = placeSchema.extend({
  id: z.string().max(40),
  name: z.string().max(32),
  creator: z.string().max(39),
  story: z.string().max(180),
  resident: residentSchema
    .extend({ name: z.string().max(24), greeting: z.string().max(40) })
    .default(DEFAULT_RESIDENT),
  sign: z
    .object({
      mode: z.enum(['none', 'text', 'html']),
      text: z.string().max(18),
      color,
      background: color,
      html: z.string().max(2000),
    })
    .strict()
    .default(DEFAULT_SIGN),
});

export type Place = z.infer<typeof placeSchema>;
export type HouseDesign = Place['design'];
export type Resident = Place['resident'];
export type BuildingType = (typeof BUILDING_TYPES)[number];
export type Decoration = (typeof DECORATIONS)[number];
export type PlaceEntry = { file: string; data: unknown };
export type ValidationResult = { places: Place[]; errors: string[] };

const STARTER_IDS = new Set([
  'after-hours',
  'evergreen',
  'hello-world',
  'little-workshop',
  'moonbeam-cafe',
  'plot-twist',
  'stargazer',
  'sunday-morning',
]);
// New homes have one or two floors. These were built with three before that, and keep them.
const THREE_FLOOR_IDS = new Set(['arts']);
// The id in the examples a newcomer copies, which the copy has to change.
const EXAMPLE_ID = 'your-unique-id';

/**
 * Up to `count` house plots that no one has claimed, nearest to `plot` first. Ties keep map
 * order, so a town always gets the same suggestions.
 */
export function openPlotsNear(plot: string, taken: ReadonlySet<string>, count = 3): string[] {
  const from = getPlot(plot);
  if (!from) return [];
  const distance = (other: Plot) => (other.col - from.col) ** 2 + (other.row - from.row) ** 2;
  return PLOTS.filter((other) => !taken.has(other.id) && plotSchema.safeParse(other.id).success)
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, count)
    .map((other) => other.id);
}

const orList = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items.at(-1)}` : items[0];

/** "The Millpond" reads "the Millpond" inside a sentence. */
const midSentence = (name: string) => name.replace(/^The /, 'the ');

/** The public place that stands on a plot no house may take, by name; undefined for any other. */
export function publicPlaceAt(plot: string): string | undefined {
  const venue = venueAt(plot);
  if (venue) return midSentence(venue.name);
  if (isTubePlot(plot)) return `${tubeStation(plot).name} on ${midSentence(TUBE_LINE_NAME)}`;
  if (isFootballPlot(plot)) return midSentence(FOOTBALL_VENUE.name);
  if (isFarmPlot(plot)) return midSentence(FARM.name);
  if (isMillpondPlot(plot)) return midSentence(MILLPOND_VENUE.name);
  return undefined;
}

// The map's first and last row letters and its column count, for a plot that isn't on it.
const rowLabel = (plot: Plot) => plot.id.slice(0, -String(plot.col + 1).length);
const FIRST_ROW = rowLabel(PLOTS[0]);
const LAST_ROW = rowLabel(PLOTS.reduce((last, plot) => (plot.row > last.row ? plot : last)));
const COLUMNS = Math.max(...PLOTS.map((plot) => plot.col)) + 1;

/**
 * What a house file hears when its plot is no house plot: which public place stands there and the
 * open plots nearest to it, or how plots are named when the plot is not on the map at all.
 * Undefined for a house plot.
 */
export function plotProblem(plot: string, taken: ReadonlySet<string>): string | undefined {
  if (!getPlot(plot)) {
    const upper = plot.trim().toUpperCase();
    const hint = upper !== plot && getPlot(upper) ? ` Did you mean ${upper}?` : '';
    return `Plot "${plot}" is not on the town map. Plots are a row letter from ${FIRST_ROW} to ${LAST_ROW} and a column number from 1 to ${COLUMNS}, like ${FIRST_ROW}1 or ${LAST_ROW}${COLUMNS}.${hint}`;
  }
  const place = publicPlaceAt(plot);
  if (!place) return undefined;
  const open = openPlotsNear(plot, taken);
  return `Plot ${plot} is reserved for ${place}, a public place. ${open.length ? `Pick an open plot such as ${orList(open)}.` : OPEN_PLOTS_COPY.full}`;
}

export function validatePlaces(entries: PlaceEntry[]): ValidationResult {
  const errors: string[] = [];
  const places: Place[] = [];
  const ids = new Set<string>();
  // Which file claimed each plot.
  const plots = new Map<string, string>();
  let taken: Set<string> | undefined;
  // Every plot any file asks for, even one that isn't valid yet: none of them is open.
  const claimed = () =>
    (taken ??= new Set(
      entries.flatMap(({ data }) => {
        const plot = (data as { plot?: unknown } | null)?.plot;
        return typeof plot === 'string' ? [plot] : [];
      }),
    ));
  for (const { file, data } of entries) {
    const result = placeSchema.safeParse(data);
    if (!result.success) {
      const plot = (data as { plot?: unknown } | null)?.plot;
      // A plot the map has no house on gets one clear sentence instead of the schema's.
      const plotMessage = typeof plot === 'string' ? plotProblem(plot, claimed()) : undefined;
      let plotTold = false;
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || 'file';
        if (path === 'plot' && plotMessage) {
          if (!plotTold) errors.push(`${file} → plot: ${plotMessage}`);
          plotTold = true;
        } else errors.push(`${file} → ${path}: ${issue.message}`);
      }
      continue;
    }
    const place = result.data;
    if (
      place.creator.toLowerCase() === 'forktown' &&
      (!STARTER_IDS.has(place.id) || place.creator !== 'forktown')
    )
      errors.push(
        `${file}: The creator "forktown" is reserved for the original starter places. Use your GitHub username.`,
      );
    if (place.design.floors === 3 && !THREE_FLOOR_IDS.has(place.id))
      errors.push(`${file}: New homes can have one or two floors. Set "floors" to 1 or 2.`);
    if (file !== `${place.id}.json`)
      errors.push(`${file}: Rename this file to ${place.id}.json so its name matches the id.`);
    if (place.id === EXAMPLE_ID)
      errors.push(
        `${file}: "${EXAMPLE_ID}" is the example's id. Choose your own id and rename the file to match.`,
      );
    if (ids.has(place.id))
      errors.push(`${file}: The id "${place.id}" is already used. Choose another id.`);
    // Either file may be the newcomer, so name both.
    if (plots.has(place.plot)) {
      const open = openPlotsNear(place.plot, claimed());
      errors.push(
        `Plot ${place.plot} is claimed by both "${plots.get(place.plot)}" and "${file}". ${open.length ? `If yours is the new one, pick an open plot such as ${orList(open)}.` : OPEN_PLOTS_COPY.full}`,
      );
    }
    ids.add(place.id);
    plots.set(place.plot, file);
    places.push(place);
  }
  return { places, errors };
}
