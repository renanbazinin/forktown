import type { Place } from './schema';

declare const __FORKTOWN_LOCAL_SAVE_TOKEN__: string;

export const localSaveAvailable =
  !!__FORKTOWN_LOCAL_SAVE_TOKEN__ &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

export async function revealLocalHouse(id: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/__forktown/reveal-place', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forktown-Token': __FORKTOWN_LOCAL_SAVE_TOKEN__,
      },
      body: JSON.stringify({ id }),
    });
  } catch {
    throw new Error(
      'Could not reach your local town. Find this file in your project’s places folder.',
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.file !== `places/${id}.json`)
    throw new Error(
      result?.error ?? 'Could not show this file. Refresh your local town and try again.',
    );
}

export async function saveToProject(place: Place): Promise<string> {
  let response: Response;
  try {
    response = await fetch('/__forktown/places', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forktown-Token': __FORKTOWN_LOCAL_SAVE_TOKEN__,
      },
      body: JSON.stringify(place),
    });
  } catch {
    throw new Error(
      'Could not confirm the save. Check your places folder and that the local city is still running before trying again.',
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.file !== `places/${place.id}.json`)
    throw new Error(
      result?.error ??
        'Could not confirm the save. Refresh the local city and check your places folder.',
    );
  return result.file;
}
