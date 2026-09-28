import names from '../data/draft-names.json';
import type { Place } from './schema';

function pickName(pool: string[], used: string[], random: () => number) {
  const taken = new Set(used.map((name) => name.trim().toLowerCase()));
  const available = pool.filter((name) => !taken.has(name.toLowerCase()));
  const choices = available.length ? available : pool;
  return choices[Math.floor(random() * choices.length)];
}

export function pickDraftNames(places: readonly Place[], random: () => number = Math.random) {
  return {
    placeName: pickName(
      names.houses,
      places.map((place) => place.name),
      random,
    ),
    residentName: pickName(
      names.neighbors,
      places.map((place) => place.resident.name),
      random,
    ),
  };
}

/** A file id made from a house name, numbered when another house already has it. */
export function availableId(name: string, places: readonly Pick<Place, 'id'>[]) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 34)
      .replace(/-$/, '') || 'my-place';
  let id = base.length < 3 ? `my-${base}` : base;
  let suffix = 2;
  while (places.some((place) => place.id === id)) id = `${base}-${suffix++}`;
  return id;
}
