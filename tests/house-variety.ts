import { readdirSync, readFileSync } from 'node:fs';
import { HOUSE_PLOTS } from '../src/lib/events';
import { BUILDING_TYPES, DECORATIONS, placeSchema, type Place } from '../src/lib/schema';

// Homes for render tests: the town's own, every shape a home can take, and a full town.

export const places = readdirSync('places')
  .filter((file) => file.endsWith('.json'))
  .map((file) => placeSchema.parse(JSON.parse(readFileSync(`places/${file}`, 'utf8'))));

const ROOFS = ['classic', 'flat', 'gable'] as const;
const FEATURES = ['none', 'porch', 'balcony'] as const;
const WINDOWS = ['cross', 'round', 'shutters'] as const;
const GARDENS = ['wildflowers', 'paving', 'vegetables'] as const;
const SIGNS = ['text', 'html', 'none'] as const;

/** Every building, roof, floor count and feature, with the other choices cycling through. */
export const everyShape = BUILDING_TYPES.flatMap((building) =>
  ROOFS.flatMap((roof) =>
    ([1, 2, 3] as const).flatMap((floors) =>
      FEATURES.map((feature, i): Place => {
        const from = places[(floors + i) % places.length];
        return {
          ...from,
          id: `${building}-${roof}-${floors}-${feature}`,
          building,
          decoration: DECORATIONS[(floors + i) % DECORATIONS.length],
          design: {
            ...from.design,
            roof,
            floors,
            feature,
            windows: WINDOWS[(floors + i) % 3],
            garden: GARDENS[(floors * 2 + i) % 3],
          },
          sign: {
            ...from.sign,
            mode: SIGNS[(floors + i) % 3],
            html: from.sign.html || '<p>Hi</p>',
          },
        };
      }),
    ),
  ),
);

/** A full town: the real homes, and every other house plot filled with varied copies. */
const taken = new Set(places.map((place) => place.plot));
export const fullTown: Place[] = [
  ...places,
  ...HOUSE_PLOTS.filter((plot) => !taken.has(plot.id)).map((plot, i) => {
    const from = places[i % places.length];
    return {
      ...from,
      id: `copy-${plot.id.toLowerCase()}`,
      plot: plot.id,
      building: BUILDING_TYPES[i % BUILDING_TYPES.length],
      design: { ...from.design, floors: ((i % 3) + 1) as 1 | 2 | 3 },
    };
  }),
];
