import names from '../data/draft-names.json';
import type { Place } from './schema';

function pickName(pool: string[], used: string[]) {
  const taken = new Set(used.map((name) => name.trim().toLowerCase()));
  const available = pool.filter((name) => !taken.has(name.toLowerCase()));
  const choices = available.length ? available : pool;
  return choices[Math.floor(Math.random() * choices.length)];
}

export function pickDraftNames(places: Place[]) {
  return {
    placeName: pickName(
      names.houses,
      places.map((place) => place.name),
    ),
    residentName: pickName(
      names.neighbors,
      places.map((place) => place.resident.name),
    ),
  };
}
