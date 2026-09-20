export const TOWN_DAY_MS = 24 * 60 * 1000;

// Sixty 24-minute cycles fit exactly into a UTC day. Epoch-based arithmetic
// keeps the phase identical across time zones, reloads, and suspended tabs.
export function townMinutesAt(utcTimestamp: number): number {
  return (((utcTimestamp % TOWN_DAY_MS) + TOWN_DAY_MS) % TOWN_DAY_MS) / 1000;
}
