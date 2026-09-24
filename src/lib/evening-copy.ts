import type { LanternHour, LanternRegister } from './lanterns';

// Every DOM word the Lantern Fork says. lanterns.ts holds the facts; this file holds the voice.

/** One town minute is one real second, so a countdown reads in real time. */
export function realWait(townMinutes: number) {
  const seconds = Math.ceil(townMinutes);
  if (seconds <= 0) return 'any moment now';
  if (seconds < 60) return `in ${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.round(seconds / 60);
  return `in about ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** The sentence only changes at 20:00, 20:30 and 06:00, so it can sit in a live region. */
export function lanternHourStatus(hour: LanternHour) {
  if (hour.total <= 0)
    return { sentence: 'No lanterns yet. The first house will light the first one.', detail: '' };
  if (hour.phase === 'waiting')
    return {
      sentence: 'The lanterns come on at 20:00, oldest first.',
      detail: `Nightfall is ${realWait(hour.startsIn)}.`,
    };
  if (hour.phase === 'lighting')
    return {
      sentence: 'Lantern hour. The lanterns are coming on, oldest first.',
      detail: `${hour.lit} of ${hour.total} lit`,
    };
  return {
    sentence: hour.total === 1 ? 'The lantern is lit.' : `All ${hour.total} lanterns are lit.`,
    detail: 'They stay lit until dawn at 06:00.',
  };
}

export type LanternCaption = {
  label: string;
  detail?: string;
  newest: boolean;
  newestDetail?: string;
};
/** A house's place in the town's history. Undefined for anything not on the register (drafts). */
export function lanternCaption(
  register: LanternRegister,
  id: string,
  nameOf: (id: string) => string,
): LanternCaption | undefined {
  const entry = register.byId.get(id);
  if (!entry) return undefined;
  const newest =
    id === register.newest
      ? {
          newest: true,
          newestDetail:
            'The newest neighbor. The welcome pennant flies here until the next one moves in.',
        }
      : { newest: false };
  if (entry.founding)
    return {
      label: 'FOUNDING LANTERN',
      detail: 'One of the houses the town began with.',
      ...newest,
    };
  // Without history there is no number and no "moved in after" to claim.
  if (entry.number === undefined) return { label: 'A LANTERN ON THE FORK', ...newest };
  return {
    label: `LANTERN No. ${entry.number} OF ${register.total}`,
    detail: entry.after
      ? `Moved in after ${nameOf(entry.after)}.`
      : 'The first neighbor after the founding houses.',
    ...newest,
  };
}

export const FORK_COPY = {
  eyebrow: 'ONE LANTERN FOR EVERY NEIGHBOR',
  lede: (total: number) =>
    `Every house in Forktown hangs a lantern on this tree, in the order it moved in. ${total} lantern${total === 1 ? '' : 's'} so far.`,
  foundersHeading: 'The founding lanterns',
  neighborsHeading: (ordered: boolean) =>
    ordered ? 'Neighbors, in the order they moved in' : 'Neighbors',
  shallowNote: 'Arrival order appears when the town is built from its full Git history.',
  taleEyebrow: "TONIGHT'S TALE",
  footer: 'Every house here started as a fork. Yours could hang here next.',
  cta: 'Find your way in',
};

export const EVENING_COPY = {
  eyebrow: 'THIS EVENING',
  lanternTitle: '20:00 · Lantern hour',
  lanternBody: (total: number) =>
    `The Lantern Fork lights a lantern for each of our ${total} neighbors, oldest first.`,
  visitFork: 'Visit the Fork',
  taleTitle: (name: string) => `Tonight's tale · ${name}`,
  visitPlace: (name: string) => `Visit ${name}`,
};
