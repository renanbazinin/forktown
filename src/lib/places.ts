import { validatePlaces } from './schema';
import { townArrivals } from './arrivals';

const modules = import.meta.glob('../../places/*.json', { eager: true, import: 'default' });
const result = validatePlaces(
  Object.entries(modules).map(([path, data]) => ({ file: path.split('/').at(-1)!, data })),
);
if (result.errors.length) throw new Error(`The city could not load:\n${result.errors.join('\n')}`);
export const places = result.places.sort((a, b) =>
  a.plot.localeCompare(b.plot, 'en', { numeric: true }),
);
export const repository = /^[\w.-]+\/[\w.-]+$/.test(import.meta.env.VITE_GITHUB_REPOSITORY ?? '')
  ? (import.meta.env.VITE_GITHUB_REPOSITORY as string)
  : '';
export const repositoryUrl = repository ? `https://github.com/${repository}` : null;
export const isFoundingPlace = (place: { creator: string }) => place.creator === 'forktown';
export const latestArrival = townArrivals
  .map((id) => places.find((place) => place.id === id && !isFoundingPlace(place)))
  .find((place) => place !== undefined);
