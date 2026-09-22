import { z } from 'zod';
import { compileSign } from './sign.ts';
import { getPlot } from './world.ts';
import { venueAt } from './events.ts';
import { isFootballPlot } from './football.ts';
import { isFarmPlot } from './farm.ts';

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
    plot: z
      .string()
      .refine((id) => !!getPlot(id), 'Choose an existing plot from the town map.')
      .refine(
        (id) => !venueAt(id) && !isFootballPlot(id) && !isFarmPlot(id),
        'This plot is reserved for a public town venue. Choose a house plot.',
      ),
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

export function validatePlaces(entries: PlaceEntry[]): ValidationResult {
  const errors: string[] = [];
  const places: Place[] = [];
  const ids = new Set<string>();
  const plots = new Map<string, string>();
  for (const { file, data } of entries) {
    const result = placeSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues)
        errors.push(`${file} → ${issue.path.join('.') || 'file'}: ${issue.message}`);
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
    if (file !== `${place.id}.json`)
      errors.push(`${file}: Rename this file to ${place.id}.json so its name matches the id.`);
    if (ids.has(place.id))
      errors.push(`${file}: The id "${place.id}" is already used. Choose another id.`);
    if (plots.has(place.plot))
      errors.push(
        `${file}: Plot ${place.plot} belongs to "${plots.get(place.plot)}". Choose an empty plot in the city.`,
      );
    ids.add(place.id);
    plots.set(place.plot, place.name);
    places.push(place);
  }
  return { places, errors };
}
