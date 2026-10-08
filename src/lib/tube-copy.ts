import {
  isTubePlot,
  TUBE_MIN_SAVING,
  TUBE_PARCEL_ROUTE,
  TUBE_PLOTS,
  TUBE_SIGN,
  TUBE_SIGN_STATION,
  TUBE_STATIONS,
  tubeStation,
} from './tubes.ts';
import { tubeLineMinutes } from './tube-journeys.ts';
import type { TubeStatus } from './tube-traffic.ts';

// The Treeline's words. tubes.ts holds the facts and tube-traffic.ts the day's rides; this file
// holds the voice. Everything reads the status the town is drawn from, so the panel never
// describes a different line. Brand rules (tests/tube-ui.test.ts holds them): headings end with a
// period, eyebrows are uppercase, no exclamation marks, and the copy never promises a crowd. Only
// the neighbors on the line right now are ever named; future riders stay private.

export const TUBE_LABEL = `PUBLIC SPACE · ${TUBE_PLOTS.join(' / ')}`;
export const TUBE_SIGN_CAPTION = `STATION SIGN · ${tubeStation(TUBE_SIGN_STATION).plot}`;

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
/** Two halts' minutes by tube and on foot, door to door (a road walk, so each pair is worked out
 * once, on first use). */
const MINUTES = new Map<string, { tube: number; walk: number }>();
function minutesBetween(from: string, to: string) {
  const key = `${from}>${to}`;
  let minutes = MINUTES.get(key);
  if (!minutes) MINUTES.set(key, (minutes = tubeLineMinutes(from, to)));
  return minutes;
}
/** The sign's halt to the parcels' far halt: the oldest stretch of the line. */
const lineMinutes = () => minutesBetween(...TUBE_PARCEL_ROUTE);
const NUMBERS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
];
/** "Seven halts round the edge of town, one bore." */
export const TUBE_LOOP_LINE = `${NUMBERS[TUBE_STATIONS.length] ?? TUBE_STATIONS.length} halts round the edge of town, one bore.`;
/** Where each halt stands, in a line: the heading of its own block when it is chosen on the map.
 * Scenery, never counted; the regatta course is the river's own whether a regatta is on or not. */
export const TUBE_HALT_NOTES: Readonly<Record<string, string>> = {
  R1: 'The south-west end of the line.',
  N1: 'On the west edge, on the road to the zoo gate.',
  C1: 'The halt with the sign and the umbrella stand.',
  A9: 'The one halt on the north edge.',
  C15: 'Across the duck street from the Market Square.',
  L15: 'Its bridge spans the regatta course.',
  R15: 'The south-east end of the line, down the far bank.',
};

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

/** The line right now: who is on it, how long it takes, and the parcel on the pad or in the glass.
 * The oldest stretch, Hedgerow Halt to Willow Halt, is timed here unless the chosen halt's own
 * block already times it. */
function lineBlock(status: TubeStatus, chosen?: string): TubeCopyBlock {
  const [from, to] = TUBE_PARCEL_ROUTE.map(station);
  const { tube, walk } = lineMinutes();
  const timed =
    !!chosen &&
    neighborsOf(chosen).some((other) =>
      [chosen, other.id].every((id) => (TUBE_PARCEL_ROUTE as readonly string[]).includes(id)),
    );
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
    body: timed
      ? TUBE_LOOP_LINE
      : `${TUBE_LOOP_LINE} ${from} to ${to} takes about ${Math.round(tube)} minutes; on foot it takes about ${Math.round(walk)}.`,
    note,
  };
}

/** The halts either side of one along the line (one at either end of it). */
function neighborsOf(id: string) {
  const i = TUBE_STATIONS.findIndex((s) => s.id === id);
  return [TUBE_STATIONS[i - 1], TUBE_STATIONS[i + 1]].filter((s) => !!s);
}
/** The halt chosen on the map: where it stands, and its minutes to the halts either side, by glass
 * and on foot. */
function haltBlock(id: string): TubeCopyBlock {
  const here = tubeStation(id);
  const [a, b] = neighborsOf(id).map((other) => {
    const { tube, walk } = minutesBetween(id, other.id);
    return { name: other.name, tube: Math.round(tube), walk: Math.round(walk) };
  });
  return {
    eyebrow: `${here.name.toUpperCase()} · ${here.plot}`,
    heading: TUBE_HALT_NOTES[id],
    body: b
      ? `${a.name} is about ${a.tube} minutes away by glass, ${b.name} about ${b.tube}. On foot they take about ${a.walk} and ${b.walk}.`
      : `${a.name} is about ${a.tube} minutes away by glass. On foot it takes about ${a.walk}.`,
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

/** The panel's words for a given line status, and the halt chosen on the map, if one is (pure:
 * the tests feed it every combination). */
export function tubeCopy(status: TubeStatus, chosen?: string | null): TubeCopy {
  const halt = chosen && isTubePlot(chosen) ? chosen : undefined;
  return {
    label: TUBE_LABEL,
    blocks: [...(halt ? [haltBlock(halt)] : []), lineBlock(status, halt), ridesBlock(status)],
    sign: { caption: TUBE_SIGN_CAPTION, text: TUBE_SIGN },
    footer: `Neighbors ride only when it saves at least ${TUBE_MIN_SAVING} minutes; short trips stay on foot. Everyone sees the same rides at the same moment, even after a refresh.`,
  };
}
