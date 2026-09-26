import {
  BOAT_SEASON,
  BOAT_TIMES,
  HERON_SCHEDULE,
  iceOn,
  millpondGroundDay,
  millpondSkatingDay,
  millpondStatusAt,
  MILLPOND_PLOTS,
  SKATING,
  type MillpondStatus,
} from './millpond.ts';
import { DAYS_PER_YEAR, townCalendarAt } from './town-calendar.ts';

// The Millpond's words. millpond.ts holds the facts; this file holds the voice. Everything reads
// the same (minutes, day) the pond is drawn from, so the panel never describes a different pond.
// Brand rules (tests/millpond-ui.test.ts holds them): headings end with a period, eyebrows are
// uppercase, no exclamation marks, and the copy never promises a crowd or hints at what the
// winter nights keep to themselves.

export type MillpondCopyBlock = { eyebrow: string; heading: string; body: string; note?: string };
export type MillpondCopy = { label: string; blocks: MillpondCopyBlock[]; footer: string };
export type MillpondCard = {
  name: string;
  live: boolean;
  status: 'Happening now' | 'Later today' | 'Finished today';
  time: string;
  skaters: number;
};

export const MILLPOND_LABEL = `PUBLIC SPACE · ${MILLPOND_PLOTS[0]}–${MILLPOND_PLOTS.at(-1)} · ${MILLPOND_PLOTS.length} PLOTS`;
export const SKATING_NAME = 'Skating on the Millpond';
/**
 * Skating is on through the posted hours, and from the moment a neighbour who set out early
 * reaches the ice (skaters leave home at 13:00 and glide as soon as they arrive).
 */
export const skatingLiveAt = (time: number, skaters: number) =>
  (time >= SKATING.start && time < SKATING.end) ||
  (skaters > 0 && time >= SKATING.depart && time < SKATING.end);

const clock = (minutes: number) => {
  const value = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
};
/** The whole town day and the minute within it, the same split `millpondStatusAt` makes. */
const split = (minutes: number, day: number) => {
  const absolute = day * 1440 + minutes;
  const today = Math.floor(absolute / 1440);
  return { today, time: absolute - today * 1440 };
};
/** "Eliza is out on the ice.", "Eliza and Sol are…", "3 neighbors are…"; nothing for nobody. */
export function onTheIce(names: readonly string[]) {
  const named = names.map((name) => name.trim());
  if (!named.length) return undefined;
  if (named.some((name) => !name) || named.length > 2)
    return named.length === 1
      ? '1 neighbor is out on the ice.'
      : `${named.length} neighbors are out on the ice.`;
  return named.length === 1
    ? `${named[0]} is out on the ice.`
    : `${named[0]} and ${named[1]} are out on the ice.`;
}
/** 'tomorrow', or the first later day that passes `test` ("Winter 9"); every test here passes
 * within the year (the ice comes and goes once a year). */
const nextDays = new Map<string, string>();
const nextDay = (today: number, test: (day: number) => boolean) => {
  const key = `${test === openOn ? 'open' : 'skate'}:${today}`;
  let found = nextDays.get(key);
  if (found === undefined) {
    let ahead = 1;
    while (ahead < DAYS_PER_YEAR && !test(today + ahead)) ahead++;
    const almanac = townCalendarAt(today + ahead, 720);
    found = ahead === 1 ? 'tomorrow' : `${almanac.season} ${almanac.date}`;
    nextDays.set(key, found);
  }
  return found;
};
const openOn = (day: number) => iceOn(millpondGroundDay(720, day)).stage === 'open';
// The two rowboats' day on the water: the first pushes off, then the second; the second comes
// home first. Each glide between the jetty and its loop takes ten minutes.
const BOAT_GLIDE = 10;
const firstOut = Math.min(...BOAT_TIMES.map((boat) => boat.out));
const lastOut = Math.max(...BOAT_TIMES.map((boat) => boat.out));
const firstBack = Math.min(...BOAT_TIMES.map((boat) => boat.back));
const lastBack = Math.max(...BOAT_TIMES.map((boat) => boat.back));
const rowingHours = `${clock(firstOut)}–${clock(lastBack)}`;

function waterBlock(
  status: MillpondStatus,
  time: number,
  today: number,
  skaters: readonly string[],
): MillpondCopyBlock {
  // Only the frozen weeks send the heron away; the model says when it is gone.
  const away = status.heron ? undefined : 'The heron is away until the water opens.';
  const invitation = 'Anyone out for an afternoon walk can lace up on the bank and join in.';
  if (status.skating) {
    const { start, end } = status.skating;
    const live = status.skating.live || skatingLiveAt(time, skaters.length);
    if (live)
      return {
        eyebrow: 'ON THE ICE NOW',
        heading: 'Out on the ice.',
        body: `Skating until ${clock(end)}. ${invitation}`,
        note: onTheIce(skaters) ?? away,
      };
    if (time < start)
      return {
        eyebrow: 'SKATING THIS AFTERNOON',
        heading: 'Frozen hard.',
        body: `Skating from ${clock(start)} until ${clock(end)}. ${invitation}`,
        note: away,
      };
    const again = millpondSkatingDay(today + 1);
    return {
      eyebrow: again ? 'SKATING AGAIN TOMORROW' : 'THE LAST SKATE OF WINTER',
      heading: 'Frozen hard.',
      body: again
        ? `Skating is over for today. The ice opens again tomorrow at ${clock(start)}.`
        : 'That was the last skate of the winter. The ice starts to soften tomorrow.',
      note: away,
    };
  }
  // Every frozen day is a skating day, so the ice has only these two other faces.
  if (status.ice === 'freezing') {
    const from = nextDay(today, millpondSkatingDay);
    return {
      eyebrow: 'WINTER ON THE WATER',
      heading: 'The pond is freezing over.',
      body: `Ice reaches in from the banks a day at a time. Skating starts ${
        from === 'tomorrow' ? from : `on ${from}`
      }, once the ice is hard.`,
      note: away,
    };
  }
  if (status.ice === 'thawing') {
    const open = nextDay(today, openOn);
    return {
      eyebrow: 'LATE WINTER',
      heading: 'The ice is breaking up.',
      body: `Floes shrink a day at a time, and a thin rim lingers at the shore. Open water again ${
        open === 'tomorrow' ? open : `from ${open}`
      }.`,
      note: away,
    };
  }
  // Open water.
  if (status.boats === 'out') {
    if (time < lastOut + BOAT_GLIDE)
      return {
        eyebrow: 'ON THE WATER NOW',
        heading: 'Rowboats heading out.',
        body: `The first pushes off at ${clock(firstOut)}, the second at ${clock(lastOut)}. They row slow loops across the pond until evening.`,
      };
    if (time >= firstBack - BOAT_GLIDE)
      return {
        eyebrow: 'ON THE WATER NOW',
        heading: 'Rowboats heading home.',
        body: `One after the other they row in, and both are tied up at the jetty by ${clock(lastBack)}.`,
      };
    return {
      eyebrow: 'ON THE WATER NOW',
      heading: 'Rowboats out until evening.',
      body: `Two rowboats row slow loops across the pond. Both are tied up at the jetty again by ${clock(lastBack)}.`,
    };
  }
  const groundDay = millpondGroundDay(time, today);
  const boats =
    status.boats === 'stored'
      ? 'The rowboats lie upturned on the bank, waiting for warmer days.'
      : groundDay > BOAT_SEASON.lastOut
        ? 'Two rowboats wait at the jetty. Their summer on the water is over.'
        : groundDay < BOAT_SEASON.out
          ? `Two rowboats wait at the jetty for summer, when they go out ${rowingHours}.`
          : time < firstOut
            ? `Two rowboats wait at the jetty. They go out at ${clock(firstOut)}.`
            : 'The rowboats are back at the jetty.';
  if (time >= 1200 || time < 330)
    return {
      eyebrow: 'AFTER DARK',
      heading: 'Lights on the water.',
      body: 'The town’s lanterns glimmer along the far shore, and the mill wheel keeps turning.',
      note: boats,
    };
  return {
    eyebrow:
      time < 480 ? 'EARLY ON THE WATER' : time >= 1080 ? 'EVENING ON THE WATER' : 'BY THE OLD MILL',
    heading: 'Reeds, a jetty and a turning wheel.',
    body: 'The old mill turns all day beside the water. A quiet place to stop on a walk.',
    note: boats,
  };
}

type Fact = { eyebrow: string; heading: string; body: string; line: string };
const hunts = HERON_SCHEDULE.hunts.map((hunt) => `${clock(hunt.from)}–${clock(hunt.to)}`);
const heronDay = `It hunts ${hunts[0]} and ${hunts[1]}, and rests in between.`;
/** Where the heron stays on a day of ice at the edges: no hunting, one spot all day. */
const heronIceDay = (ice: MillpondStatus['ice']) =>
  ice === 'freezing'
    ? 'No hunting while the pond freezes over. Once the ice is hard, it leaves until the thaw.'
    : 'No hunting until the ice has gone. It rests all day just past the rim.';
/** The heron's walks: out of the reeds at first light, home at nightfall, between spots. */
function heronWalk(status: MillpondStatus): Fact | null {
  const open = status.ice === 'open';
  if (status.heronWalking === 'out')
    return {
      eyebrow: 'AT FIRST LIGHT',
      heading: 'The heron steps out of the reeds.',
      body: open ? heronDay : heronIceDay(status.ice),
      line: 'The heron steps out of the reeds.',
    };
  if (status.heronWalking === 'home')
    return {
      eyebrow: 'A GREY HERON',
      heading: 'The heron heads back to its reeds.',
      body: 'It roosts there for the night, on one leg.',
      line: 'The heron heads back to its reeds.',
    };
  if (status.heronWalking === 'between')
    return {
      eyebrow: 'A GREY HERON',
      heading: 'The heron walks to a new spot.',
      body: open ? heronDay : heronIceDay(status.ice),
      line: 'The heron walks to a new spot.',
    };
  return null;
}
/** Standing still between walks and hunts: in the shallows, on the ice edge, or past the rim. */
function heronRest(status: MillpondStatus): Fact {
  if (status.ice === 'freezing')
    return {
      eyebrow: 'A GREY HERON',
      heading: 'The heron waits at the edge of the ice.',
      body: heronIceDay(status.ice),
      line: 'The heron waits at the edge of the ice.',
    };
  if (status.ice !== 'open')
    return {
      eyebrow: 'A GREY HERON',
      heading: 'The heron is back by the open water.',
      body: heronIceDay(status.ice),
      line: 'The heron waits in the first open water.',
    };
  return {
    eyebrow: 'A GREY HERON',
    heading: 'The heron keeps watch.',
    body: 'It stands in the south-east shallows through the day and hunts at dawn and late afternoon.',
    line: 'The heron keeps watch from the shallows.',
  };
}
function lifeBlock(status: MillpondStatus): MillpondCopyBlock | null {
  const mist: Fact = {
    eyebrow: 'AT DAWN',
    heading: 'Mist on the pond.',
    body: 'Thin mist hangs low at first light and lifts as the morning warms.',
    line: 'Thin mist hangs over the pond.',
  };
  const fisher: Fact = {
    eyebrow: 'AT FIRST LIGHT',
    heading: 'An early fisher on the jetty.',
    body: 'Rod out over the water, back to the town, waiting for a bite before breakfast.',
    line: 'An early fisher sits at the end of the jetty.',
  };
  const hunting: Fact = {
    eyebrow: 'IN THE SHALLOWS',
    heading: 'The heron is hunting.',
    body: `Stock-still in the shallows, then one sudden strike. It hunts ${hunts[0]} and ${hunts[1]}.`,
    line: 'The heron is hunting in the shallows.',
  };
  const fish: Fact = {
    eyebrow: 'AT DUSK',
    heading: 'Fish are rising.',
    body: 'Rings spread across the evening water, and now and then a silver leap.',
    line: 'Fish are rising.',
  };
  const asleep: Fact = {
    eyebrow: 'IN THE REEDS',
    heading: 'The heron is asleep in the reeds.',
    body: 'On one leg, neck tucked in.',
    line: 'The heron is asleep in the reeds.',
  };
  const facts = [
    status.mist && mist,
    status.fisher && fisher,
    status.heron === 'hunting' && hunting,
    status.fishRising && fish,
    status.heron === 'asleep' && asleep,
    status.heron === 'resting' && (heronWalk(status) ?? heronRest(status)),
  ].filter((fact): fact is Fact => !!fact);
  const seasonal = [
    status.petals && 'Blossom petals drift on the water.',
    status.leaves && 'Fallen leaves drift in and gather along the banks.',
    status.lilies &&
      (status.flowers
        ? 'Lily pads float in the calm corners, some of them in flower.'
        : 'Lily pads float in the calm corners.'),
  ].filter((line): line is string => !!line);
  const [lead, ...rest] = facts;
  if (!lead && !seasonal.length) return null;
  const note = [...rest.map((fact) => fact.line), ...seasonal].slice(0, 3).join(' ');
  if (!lead)
    return {
      eyebrow: 'THROUGH THE SEASONS',
      heading: seasonal[0],
      body: seasonal.slice(1).join(' ') || 'Every season leaves something on the water.',
    };
  return { eyebrow: lead.eyebrow, heading: lead.heading, body: lead.body, note: note || undefined };
}

/** The panel's words for a given pond state (pure: the tests feed it every combination).
 * `skaters` are the names of the neighbours on the ice right now. */
export function millpondCopyFor(
  status: MillpondStatus,
  minutes: number,
  day: number,
  skaters: readonly string[] = [],
): MillpondCopy {
  const { today, time } = split(minutes, day);
  const life = lifeBlock(status);
  return {
    label: MILLPOND_LABEL,
    blocks: [waterBlock(status, time, today, skaters), ...(life ? [life] : [])],
    footer:
      'Skating when the winter ice holds, rowboats through the summer. Everyone sees the same pond at the same moment, even after a refresh.',
  };
}
export const millpondCopy = (minutes: number, day: number, skaters: readonly string[] = []) =>
  millpondCopyFor(millpondStatusAt(minutes, day), minutes, day, skaters);

/** The events list's skating card: only on skating days, live 14:00–16:40. */
export function skatingCard(minutes: number, day: number, skaters = 0): MillpondCard | null {
  const { today, time } = split(minutes, day);
  if (!millpondSkatingDay(today)) return null;
  const live = skatingLiveAt(time, skaters);
  return {
    name: SKATING_NAME,
    live,
    status: live ? 'Happening now' : time < SKATING.start ? 'Later today' : 'Finished today',
    time: `${clock(SKATING.start)}–${clock(SKATING.end)}`,
    skaters: live ? Math.max(0, Math.floor(skaters)) : 0,
  };
}
