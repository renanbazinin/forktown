// The district harness's registry (SPEC §7.1): tests/manual/district.html shows each venue at its
// frame on a chosen day and minute, with one row of buttons per feature. Each feature agent fills
// only their own tests/manual/district-*.ts list; the imports here are frozen. Write a moment's
// day with townDay from ./district-days (townDay('Summer', 10) is Summer 10 of Year 1), never
// with a value imported from this file, which imports the lists.
import { buttons as market } from './district-market';
import { buttons as bandstand } from './district-bandstand';
import { buttons as landing } from './district-landing';
import { buttons as harvest } from './district-harvest';
import { buttons as stars } from './district-stars';
import { buttons as snowmen } from './district-snowmen';

/** A moment the harness can jump to: its label, an absolute town day and a town minute. */
export type DistrictButton = { label: string; day: number; minutes: number };

export const DISTRICT_BUTTONS: Record<
  'market' | 'bandstand' | 'landing' | 'harvest' | 'stars' | 'snowmen',
  readonly DistrictButton[]
> = { market, bandstand, landing, harvest, stars, snowmen };
