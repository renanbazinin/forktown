// Harness buttons for the Bandstand: the moments worth checking by eye.
import type { DistrictButton } from './district';
import { townDay } from './district-days';

export const buttons: readonly DistrictButton[] = [
  { label: 'Chairs going out', day: townDay('Spring', 9), minutes: 930 },
  { label: 'Folk tuning up', day: townDay('Spring', 9), minutes: 950 },
  { label: 'Folk at teatime', day: townDay('Spring', 9), minutes: 980 },
  { label: 'Brass at teatime', day: townDay('Spring', 6), minutes: 980 },
  { label: 'String trio at teatime', day: townDay('Spring', 2), minutes: 980 },
  { label: 'Applause', day: townDay('Spring', 9), minutes: 1047 },
  { label: 'Tea on the steps', day: townDay('Spring', 6), minutes: 1070 },
  { label: 'Sundown set', day: townDay('Spring', 6), minutes: 1170 },
  { label: 'Packing up', day: townDay('Spring', 6), minutes: 1206 },
  { label: 'Peak lamp lit', day: townDay('Spring', 6), minutes: 1235 },
  { label: 'Chairs gathered in', day: townDay('Spring', 6), minutes: 1226 },
  { label: 'Star night, lamp dark', day: townDay('Summer', 27), minutes: 1360 },
  { label: 'Summer brass', day: townDay('Summer', 5), minutes: 1110 },
  { label: 'Autumn leaves on the cap', day: townDay('Autumn', 20), minutes: 980 },
  { label: 'Winter scarves', day: townDay('Winter', 9), minutes: 980 },
  { label: 'Snow on the cap at dusk', day: townDay('Winter', 13), minutes: 1190 },
];
