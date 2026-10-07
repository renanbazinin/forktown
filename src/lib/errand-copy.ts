import type { Place } from './schema';
import {
  residentErrands,
  seasonalRitual,
  type ErrandKind,
  type ErrandPhase,
  type SeasonalRitual,
} from './seasonal-errands';
import { realWait } from './evening-copy';

// The neighbor directory, follow caption and Events card describe the same five beats.
const ACTIONS: Record<ErrandKind, Record<ErrandPhase, string>> = {
  seedlings: {
    outbound: 'Walking to collect seedlings',
    pickup: 'Collecting the seedling tray',
    carrying: 'Carrying seedlings to the Lantern Fork',
    dropoff: 'Setting out seedlings at the Lantern Fork',
    returning: 'Walking home after the seedling round',
  },
  lemonade: {
    outbound: 'Walking to collect lemonade',
    pickup: 'Picking up the lemonade jug',
    carrying: 'Carrying lemonade to the Little Stage',
    dropoff: 'Setting out lemonade at the Little Stage',
    returning: 'Walking home after the lemonade round',
  },
  harvest: {
    outbound: 'Walking to collect the harvest basket',
    pickup: 'Collecting a harvest basket at Hedgerow Halt',
    carrying: 'Carrying the harvest basket to the Lunch Green',
    dropoff: 'Setting out the harvest basket at the Lunch Green',
    returning: 'Walking home after the harvest round',
  },
  thermos: {
    outbound: 'Walking to collect the thermos',
    pickup: 'Picking up the thermos',
    carrying: 'Carrying warm drinks to the Millpond',
    dropoff: 'Setting out warm drinks beside the Millpond',
    returning: 'Walking home after the winter round',
  },
};

export const errandAction = (kind: ErrandKind, phase: ErrandPhase): string => ACTIONS[kind][phase];

export type ErrandCardCopy = {
  ritual: SeasonalRitual;
  day: number;
  route: string;
  live: boolean;
  status: 'Later today' | 'Happening now' | 'Finished today' | 'No round planned today';
  body: string;
  time?: string;
  residentId?: string;
  residentName?: string;
  phase?: ErrandPhase;
  canFollow: boolean;
};

const clock = (minutes: number) => {
  const time = Math.floor(minutes);
  return `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
};

/** The daytime round belongs to the calendar day, including its early-morning preview. There
 * are no overnight errands. Read the supplied clock only, so pause freezes the countdown too. */
export function seasonalErrandCard(places: Place[], minutes: number, day: number): ErrandCardCopy {
  const today = day + Math.floor(minutes / 1440);
  const wrapped = minutes % 1440;
  const time = wrapped < 0 ? wrapped + 1440 : wrapped;
  const ritual = seasonalRitual(today);
  const trip = [...residentErrands(places, today).values()].flat()[0];
  const resident = trip && places.find((place) => place.id === trip.residentId);
  const base = {
    ritual,
    day: today,
    route: `${ritual.pickup.name} → ${ritual.delivery.name}`,
  };
  if (!trip || !resident)
    return {
      ...base,
      live: false,
      status: 'No round planned today',
      body: 'No neighbor has time for the full round today.',
      canFollow: false,
    };

  const phase = trip.segments.find((segment) => time >= segment.start && time < segment.end)?.phase;
  const name = resident.resident.name;
  const later = time < trip.depart;
  const action = phase && errandAction(ritual.kind, phase);
  return {
    ...base,
    live: !!phase,
    status: phase ? 'Happening now' : later ? 'Later today' : 'Finished today',
    body: action
      ? `${name} is ${action[0].toLowerCase()}${action.slice(1)}.`
      : later
        ? `${name} sets off ${realWait(trip.depart - time)}.`
        : `${name} finished the round.`,
    time: `${clock(trip.depart)}–${clock(trip.homeBy)}`,
    residentId: resident.id,
    residentName: name,
    phase,
    canFollow: later || !!phase,
  };
}
