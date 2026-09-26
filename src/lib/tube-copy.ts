import { TUBE_MIN_SAVING, TUBE_PLOTS, TUBE_SIGN, TUBE_STATIONS, tubeStation } from './tubes.ts';
import { tubeLineMinutes } from './tube-journeys.ts';
import type { TubeStatus } from './tube-traffic.ts';

// The Treeline's words. tubes.ts holds the facts and tube-traffic.ts the day's rides; this file
// holds the voice. Everything reads the status the town is drawn from, so the panel never
// describes a different line. Brand rules (tests/tube-ui.test.ts holds them): headings end with a
// period, eyebrows are uppercase, no exclamation marks, and the copy never promises a crowd. Only
// the neighbors on the line right now are ever named; future riders stay private.

export const TUBE_LABEL = `PUBLIC SPACE · ${TUBE_PLOTS.join(' / ')}`;
export const TUBE_SIGN_CAPTION = `STATION SIGN · ${TUBE_STATIONS[0].plot}`;

export type TubeCopyBlock = { eyebrow: string; heading: string; body: string; note?: string };
export type TubeCopy = {
  label: string;
  blocks: TubeCopyBlock[];
  sign: { caption: string; text: string };
  footer: string;
};

const clock = (minutes: number) => {
  const value = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
};
const station = (id: string) => tubeStation(id).name;
/** End to end by tube and on foot, door to door (a road walk, so worked out once, on first use). */
let line: { tube: number; walk: number } | undefined;
const lineMinutes = () => (line ??= tubeLineMinutes(TUBE_STATIONS[0].id, TUBE_STATIONS.at(-1)!.id));

/** "Eliza is riding to Willow Halt.", "Eliza and Sol are on the line.", "Two neighbors named Jon
 * are on the line." (never "Jon and Jon"), "3 neighbors are on the line."; nothing for nobody. */
export function onTheLine(now: TubeStatus['now']): string | undefined {
  const named = now.map((ride) => ride.name.trim());
  if (!named.length) return undefined;
  if (named.some((name) => !name) || named.length > 2)
    return named.length === 1
      ? 'One neighbor is on the line.'
      : `${named.length} neighbors are on the line.`;
  if (named.length === 2)
    return named[0].toLowerCase() === named[1].toLowerCase()
      ? `Two neighbors named ${named[0]} are on the line.`
      : `${named[0]} and ${named[1]} are on the line.`;
  const [ride] = now;
  if (ride.stage === 'boarding') return `${named[0]} is boarding at ${station(ride.from)}.`;
  if (ride.stage === 'riding') return `${named[0]} is riding to ${station(ride.to)}.`;
  return `${named[0]} is stepping off at ${station(ride.to)}.`;
}

/** The line right now: who is on it, how long it takes, and the parcel on the pad or in the glass. */
function lineBlock(status: TubeStatus): TubeCopyBlock {
  const first = TUBE_STATIONS[0],
    last = TUBE_STATIONS.at(-1)!;
  const { tube, walk } = lineMinutes();
  const parcel = status.parcel;
  const note = !parcel
    ? undefined
    : parcel.stage === 'sending'
      ? `A parcel is waiting at ${station(parcel.from)}.`
      : parcel.stage === 'riding'
        ? 'A parcel is in the glass.'
        : parcel.stage === 'arrived'
          ? `A parcel just arrived at ${station(parcel.to)}.`
          : `Next parcel leaves ${station(parcel.from)} at ${clock(parcel.depart)}.`;
  return {
    eyebrow: status.now.length ? 'ON THE LINE NOW' : 'QUIET ON THE LINE',
    heading: onTheLine(status.now) ?? 'Nobody in the glass right now.',
    body: `Glass runs behind the northwest tree line, from ${first.name} to ${last.name} in about ${Math.round(tube)} minutes. On foot it takes about ${Math.round(walk)}.`,
    note,
  };
}

/** The day's rides, counted and never named. After midnight the plan is yesterday's, so the
 * count is of the rides still to come tonight. */
function ridesBlock(status: TubeStatus): TubeCopyBlock {
  const { now, today, next, firstToday, time } = status;
  const nextRide = next && `Next ride at ${clock(next.board)} from ${station(next.from)}.`;
  if (time < 1440) {
    const n = today.length;
    return {
      eyebrow: 'RIDES TODAY',
      heading: n === 0 ? 'No rides today.' : n === 1 ? 'One ride today.' : `${n} rides today.`,
      body:
        nextRide ??
        (now.length
          ? 'The last ride of the day is under way.'
          : n
            ? 'Today’s rides are over.'
            : 'Short trips stay on foot.'),
    };
  }
  const r = now.length + today.filter((ride) => ride.board > time).length;
  return {
    eyebrow: 'RIDES TONIGHT',
    heading:
      r === 0
        ? 'No more rides tonight.'
        : r === 1
          ? 'One more ride tonight.'
          : `${r} more rides tonight.`,
    body:
      nextRide ??
      (firstToday
        ? `The first ride of the day leaves ${station(firstToday.from)} at ${clock(firstToday.board)}.`
        : 'Short trips stay on foot.'),
  };
}

/** The panel's words for a given line status (pure: the tests feed it every combination). */
export function tubeCopy(status: TubeStatus): TubeCopy {
  return {
    label: TUBE_LABEL,
    blocks: [lineBlock(status), ridesBlock(status)],
    sign: { caption: TUBE_SIGN_CAPTION, text: TUBE_SIGN },
    footer: `Neighbors ride only when it saves at least ${TUBE_MIN_SAVING} minutes; short trips stay on foot. Everyone sees the same rides at the same moment, even after a refresh.`,
  };
}
