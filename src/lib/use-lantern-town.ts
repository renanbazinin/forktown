import { useMemo } from 'react';
import {
  eveningDayAt,
  lanternHourAt,
  lanternRegister,
  taleOfTheEvening,
  type LanternHour,
  type LanternRegister,
  type EveningTale,
} from './lanterns';
import { townArrivals } from './arrivals';
import type { Place } from './schema';

export type LanternTown = {
  register: LanternRegister;
  hour: LanternHour;
  tale?: EveningTale;
  eveningDay: number;
};

/** The Lantern Fork's facts for the DOM. Pass published places only, never a draft. */
export function useLanternTown(
  places: readonly Place[],
  minutes: number,
  day: number,
  arrivals: readonly string[] = townArrivals,
): LanternTown {
  const register = useMemo(() => lanternRegister(places, arrivals), [places, arrivals]);
  const eveningDay = eveningDayAt(minutes, day);
  const tale = useMemo(() => taleOfTheEvening(places, eveningDay), [places, eveningDay]);
  // Cheap enough to recompute every tick.
  const hour = lanternHourAt(register.total, minutes);
  return { register, hour, tale, eveningDay };
}
