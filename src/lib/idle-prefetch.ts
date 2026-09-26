import { useEffect } from 'react';
import { residentTrips } from './resident-trips';
import type { Place } from './schema';

/** The residents switch to the next town day's plan at 06:00: plan it in the hour before. */
export const PLAN_AHEAD_FROM = 300;

const queued = new WeakMap<Place[], Set<string>>();
/**
 * Do tomorrow's work while the browser is idle, once per roster and key, so the first frame that
 * needs it finds it cached and never waits. The work is exactly what that frame would do, so the
 * town is the same either way. Browsers without idle callbacks (Safari) get a short timer instead;
 * outside a page (tests, workers) this does nothing.
 */
export function whenIdle(places: Place[], key: string, work: () => unknown) {
  const page = globalThis as {
    document?: unknown;
    requestIdleCallback?: (fn: () => void) => number;
  };
  if (!page.document) return;
  let keys = queued.get(places);
  if (!keys) queued.set(places, (keys = new Set()));
  if (keys.has(key)) return;
  // Only the last few days matter; asking again for a cached day costs nothing.
  if (keys.size >= 8) keys.clear();
  keys.add(key);
  const run = () => void work();
  if (page.requestIdleCallback) page.requestIdleCallback.call(globalThis, run);
  else setTimeout(run, 250);
}

/** Plan the next town day's trips while idle before 06:00, like football's next match. */
export function prefetchTownDay(places: Place[], minutes: number, day: number) {
  if (minutes >= PLAN_AHEAD_FROM && minutes < 360)
    whenIdle(places, `trips:${day}`, () => residentTrips(places, day));
}

export function useTownDayPrefetch(places: Place[], minutes: number, day: number) {
  useEffect(() => prefetchTownDay(places, minutes, day), [places, minutes, day]);
}
