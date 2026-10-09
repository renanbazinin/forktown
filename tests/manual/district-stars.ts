// Harness buttons for stargazing: the moments worth checking by eye. The meteors are in
// the sky, which the Bandstand's frame does not reach: see them in a whole-town view at night.
import type { DistrictButton } from './district';
import { townDay } from './district-days';

const SUMMER_27 = townDay('Summer', 27),
  SUMMER_28 = townDay('Summer', 28);

export const buttons: readonly DistrictButton[] = [
  { label: 'Rugs unroll, 21:52', day: SUMMER_27, minutes: 1312 },
  { label: 'The astronomer walks in, 21:59', day: SUMMER_27, minutes: 1318.8 },
  { label: 'First on the rugs, 22:20', day: SUMMER_27, minutes: 1340 },
  { label: 'Pointing up, 23:05', day: SUMMER_27, minutes: 1385 },
  { label: 'At the eyepiece, 23:10', day: SUMMER_27, minutes: 1390 },
  { label: 'Live shot, 23:30', day: SUMMER_27, minutes: 1410 },
  { label: 'Midnight', day: SUMMER_28, minutes: 0 },
  { label: 'Going home, 00:20', day: SUMMER_28, minutes: 20 },
  { label: 'Rugs roll up, 00:32', day: SUMMER_28, minutes: 32.5 },
  { label: 'Spring 27, 23:10', day: townDay('Spring', 27), minutes: 1390 },
  { label: 'Autumn 28, 23:10', day: townDay('Autumn', 28), minutes: 1390 },
  { label: 'Winter 1: rugs on the snow', day: townDay('Winter', 1), minutes: 1390 },
  { label: 'Winter 28: the thaw', day: townDay('Winter', 28), minutes: 1390 },
];
