import { townDayAt } from './town-time.ts';

// A permanent epoch, shared by every build and visitor. This is a fictional
// calendar running at town speed, not the observer's local date or real astronomy.
export const CALENDAR_EPOCH = Date.UTC(2026, 8, 20);
export const CALENDAR_EPOCH_DAY = townDayAt(CALENDAR_EPOCH);
export const DAYS_PER_SEASON = 28;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * 4;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export const MOON_PHASES = [
  'New moon',
  'Waxing crescent',
  'First quarter',
  'Waxing gibbous',
  'Full moon',
  'Waning gibbous',
  'Last quarter',
  'Waning crescent',
] as const;
const mod = (value: number, length: number) => ((value % length) + length) % length;

export function townCalendarAt(day: number, minutes = 0) {
  const totalDays = day - CALENDAR_EPOCH_DAY + minutes / 1440;
  const wholeDay = Math.floor(totalDays);
  const dayOfYear = mod(wholeDay, DAYS_PER_YEAR);
  const seasonIndex = Math.floor(dayOfYear / DAYS_PER_SEASON);
  const date = (dayOfYear % DAYS_PER_SEASON) + 1;
  const year = Math.floor(wholeDay / DAYS_PER_YEAR) + 1;
  const lunarAge = mod(totalDays, DAYS_PER_SEASON);
  const moonPhase = lunarAge / DAYS_PER_SEASON;
  const moonName = MOON_PHASES[Math.round(moonPhase * 8) % 8];
  return {
    year,
    date,
    seasonIndex,
    season: SEASONS[seasonIndex],
    label: `${SEASONS[seasonIndex]} ${date}, Year ${year}`,
    moonPhase,
    moonName,
    illumination: (1 - Math.cos(moonPhase * Math.PI * 2)) / 2,
  };
}

// Horizontal illuminated slice of a unit lunar disc. Waxing lights its right
// side, waning its left. The terminator moves continuously through every phase.
export function moonSlice(phase: number, y: number): [number, number] {
  const edge = Math.sqrt(Math.max(0, 1 - y * y));
  const p = mod(phase, 1);
  const terminator = Math.cos(p * Math.PI * 2) * edge;
  return p <= 0.5 ? [terminator, edge] : [-edge, -terminator];
}

export function townSkyAt(day: number, minutes: number) {
  const time = mod(minutes, 1440);
  const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };
  const daylight = smooth((time - 300) / 120) * (1 - smooth((time - 1140) / 120));
  const sunProgress = (time - 360) / 840;
  // The evening owns the moon's path through midnight; there is no midnight jump.
  const moonProgress = (time >= 1200 ? time - 1200 : time + 240) / 600;
  const body = (progress: number) => ({
    x: 0.12 + progress * 0.76,
    y: 0.38 - Math.sin(progress * Math.PI) * 0.23,
    opacity: smooth(progress / 0.1) * smooth((1 - progress) / 0.1),
  });
  return {
    daylight,
    sun: body(sunProgress),
    moon: body(moonProgress),
    ...townCalendarAt(day, minutes),
  };
}
