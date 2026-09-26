// Who and what is in the tube: the day's rides (read from the same plans the residents follow)
// and a parcel timetable that never shares the line with a rider. Pure functions of places, day
// and town minutes, memoised per roster like residentTrips.
import type { Place } from './schema';
import type { Point } from './world';
import { residentTrips } from './resident-trips';
import { townClock } from './simulation';
import type { TripLeg } from './tube-journeys';
import {
  TUBE_PARCELS,
  TUBE_SPEED,
  TUBE_STATIONS,
  tubeAt,
  tubeLength,
  tubeParcelMinutes,
  tubeParcelSlots,
  tubeStation,
  type TubeStage,
} from './tubes';

export type TubeRide = {
  residentId: string;
  eventId: string;
  direction: 'there' | 'home';
  from: string;
  to: string;
  /** Town minutes on the day's timeline (after midnight is 1440+, as in residentTrips): reaches the door … */
  board: number;
  /** … the capsule leaves the stack … */
  depart: number;
  /** … reaches the far stack … */
  arrive: number;
  /** … and the rider is back out at the far door. */
  off: number;
};
export type TubeParcel = { id: string; from: string; to: string; depart: number; arrive: number };
/** On the pad before it leaves, in the glass, on the far pad until it is collected. */
export type TubeParcelStage = 'sending' | 'riding' | 'arrived';
export type TubeParcelState = TubeParcel & {
  stage: TubeParcelStage;
  /** 0..1 through the current stage. */
  progress: number;
  position: Point;
  /** World px above `position`: 0 on a pad, the glass centreline while riding. */
  altitude: number;
  /** Tiles along tubeRoute(from, to): 0 sending, s riding, tubeLength arrived. */
  distance: number;
};

/** The journey's ride, if it has one. Its edges are the running sums journeyAt uses (start, then
 *  + each leg's minutes in turn), so the panel and the town change stage at the same instant. */
function rideOf(
  legs: readonly TripLeg[],
  start: number,
  residentId: string,
  eventId: string,
  direction: TubeRide['direction'],
): TubeRide | undefined {
  let board = start;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (leg.kind !== 'board') {
      board += leg.minutes;
      continue;
    }
    // tubeLegs always follows boarding with the ride and stepping off.
    const ride = legs[i + 1],
      alight = legs[i + 2];
    if (ride?.kind !== 'ride' || alight?.kind !== 'alight')
      throw new Error('A tube boarding is followed by a ride and a stepping off.');
    const depart = board + leg.minutes,
      arrive = depart + ride.minutes;
    return {
      residentId,
      eventId,
      direction,
      from: leg.from,
      to: leg.to,
      board,
      depart,
      arrive,
      off: arrive + alight.minutes,
    };
  }
  return undefined;
}

const rides = new WeakMap<Place[], Map<number, TubeRide[]>>();
/** Every ride the day's plans make, in boarding order. */
export function tubeRides(places: Place[], day: number): TubeRide[] {
  const cached = rides.get(places)?.get(day);
  if (cached) return cached;
  const list: TubeRide[] = [];
  for (const [id, trips] of residentTrips(places, day))
    for (const trip of trips) {
      if (trip.legs) {
        const ride = rideOf(trip.legs, trip.depart, id, trip.event.id, 'there');
        if (ride) list.push(ride);
      }
      // A cinema guest who goes on to the party never takes the cinema's way home.
      if (trip.returnLegs && !trip.continuesTo) {
        const ride = rideOf(trip.returnLegs, trip.leave, id, trip.event.id, 'home');
        if (ride) list.push(ride);
      }
    }
  list.sort((a, b) => a.board - b.board || a.residentId.localeCompare(b.residentId));
  let byDay = rides.get(places);
  if (!byDay) rides.set(places, (byDay = new Map()));
  if (byDay.size >= 3) byDay.clear();
  byDay.set(day, list);
  return list;
}

/** The day's parcels: the timetable's slots, minus any whose episode (on the pad, in the glass,
 *  on the far pad) comes within `margin` of a ride's, so a parcel never shares the glass, a stack
 *  or a pad with a person. */
export function tubeParcels(places: Place[], day: number): TubeParcel[] {
  const today = tubeRides(places, day);
  const { margin, wait } = TUBE_PARCELS;
  return tubeParcelSlots(day)
    .map((slot) => ({ ...slot, arrive: slot.depart + tubeParcelMinutes(slot.from, slot.to) }))
    .filter((parcel) =>
      today.every(
        (ride) =>
          ride.off + margin <= parcel.depart - wait || parcel.arrive + wait + margin <= ride.board,
      ),
    );
}

let parcelHours: { from: number; until: number } | undefined;
/** Daylight only: outside these clock minutes no parcel can be on a pad or in the glass, so
 *  nothing is planned (at night the town still follows yesterday's plan). */
function parcelDaylight(time: number) {
  if (!parcelHours) {
    const longest = Math.max(
      ...TUBE_STATIONS.flatMap((a) =>
        TUBE_STATIONS.filter((b) => b !== a).map((b) => tubeParcelMinutes(a.id, b.id)),
      ),
    );
    parcelHours = {
      from: TUBE_PARCELS.first - TUBE_PARCELS.wait,
      until: TUBE_PARCELS.last + TUBE_PARCELS.jitter + longest + TUBE_PARCELS.wait,
    };
  }
  return time >= parcelHours.from && time < parcelHours.until;
}
const stageOf = (parcel: TubeParcel, time: number): TubeParcelStage | undefined =>
  time < parcel.depart - TUBE_PARCELS.wait || time >= parcel.arrive + TUBE_PARCELS.wait
    ? undefined
    : time < parcel.depart
      ? 'sending'
      : time < parcel.arrive
        ? 'riding'
        : 'arrived';

/** Parcels on a pad or in the glass at this moment. */
export function tubeParcelsAt(places: Place[], minutes: number, day: number): TubeParcelState[] {
  const time = townClock(minutes);
  if (!parcelDaylight(time)) return [];
  const { wait } = TUBE_PARCELS;
  const states: TubeParcelState[] = [];
  for (const parcel of tubeParcels(places, day)) {
    const stage = stageOf(parcel, time);
    if (stage === 'sending')
      states.push({
        ...parcel,
        stage,
        progress: (time - (parcel.depart - wait)) / wait,
        position: { ...tubeStation(parcel.from).stack },
        altitude: 0,
        distance: 0,
      });
    else if (stage === 'riding') {
      const distance = (time - parcel.depart) * TUBE_SPEED;
      const at = tubeAt(parcel.from, parcel.to, distance);
      states.push({
        ...parcel,
        stage,
        progress: (time - parcel.depart) / (parcel.arrive - parcel.depart),
        position: at.position,
        altitude: at.altitude,
        distance,
      });
    } else if (stage === 'arrived')
      states.push({
        ...parcel,
        stage,
        progress: (time - parcel.arrive) / wait,
        position: { ...tubeStation(parcel.to).stack },
        altitude: 0,
        distance: tubeLength(parcel.from, parcel.to),
      });
  }
  return states;
}

export type TubeStatus = {
  /** The plan being followed: yesterday's until 06:00, like the residents. */
  day: number;
  /** Minutes on that plan's timeline (00:00–05:59 read as 1440–1799). */
  time: number;
  /** Rides under way (boarding, in the glass or stepping off), with the rider's name. */
  now: (TubeRide & { name: string; stage: TubeStage })[];
  /** Every ride the plan makes, in boarding order, and how many are over. */
  today: TubeRide[];
  done: number;
  /** The next boarding on the followed plan. */
  next?: TubeRide;
  /** Only before 06:00 when the followed plan has no more rides: the new day's first ride. */
  firstToday?: TubeRide;
  /** The parcel whose episode is under way (with its stage), or else the next to leave today. */
  parcel?: TubeParcel & { stage?: TubeParcelStage };
};
/** Everything an info card needs, from the same plans the residents follow. */
export function tubeStatus(places: Place[], minutes: number, day: number): TubeStatus {
  const clock = townClock(minutes);
  const planDay = clock < 360 ? day - 1 : day;
  const time = clock < 360 ? clock + 1440 : clock;
  const today = tubeRides(places, planDay);
  const names = new Map(places.map((place) => [place.id, place.resident.name]));
  const stageAt = (ride: TubeRide): TubeStage =>
    time < ride.depart ? 'boarding' : time < ride.arrive ? 'riding' : 'alighting';
  const now = today
    .filter((ride) => time >= ride.board && time < ride.off)
    .map((ride) => ({ ...ride, name: names.get(ride.residentId) ?? '', stage: stageAt(ride) }));
  const next = today.find((ride) => ride.board > time);
  const firstToday = clock < 360 && !next ? tubeRides(places, day)[0] : undefined;
  const upcoming = parcelDaylight(clock)
    ? tubeParcels(places, day).find((parcel) => clock < parcel.arrive + TUBE_PARCELS.wait)
    : undefined;
  const stage = upcoming && stageOf(upcoming, clock);
  return {
    day: planDay,
    time,
    now,
    today,
    done: today.filter((ride) => ride.off <= time).length,
    ...(next ? { next } : {}),
    ...(firstToday ? { firstToday } : {}),
    ...(upcoming ? { parcel: stage ? { ...upcoming, stage } : upcoming } : {}),
  };
}
