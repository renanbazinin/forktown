// Harness buttons for the snowmen (agent E): the moments worth checking by eye.
import type { DistrictButton } from './district';
import { townDay } from './district-days';

const WINTER_3 = townDay('Winter', 3);

export const buttons: readonly DistrictButton[] = [
  { label: 'Lunch before the build, 13:50', day: WINTER_3, minutes: 830 },
  { label: 'Rolling the base, 14:20', day: WINTER_3, minutes: 860 },
  { label: 'The body, 15:00', day: WINTER_3, minutes: 900 },
  { label: 'The head goes on, 15:15', day: WINTER_3, minutes: 915.5 },
  { label: 'Head rolled, 15:40', day: WINTER_3, minutes: 940 },
  { label: 'Carrot and scarf, 15:46', day: WINTER_3, minutes: 946 },
  { label: 'Lunch over, 16:10', day: WINTER_3, minutes: 970 },
  { label: 'Second snowman, Winter 7', day: townDay('Winter', 7), minutes: 946 },
  { label: 'Third, Winter 11', day: townDay('Winter', 11), minutes: 946 },
  { label: 'Fourth, Winter 15', day: townDay('Winter', 15), minutes: 946 },
  { label: 'All four, Winter 20', day: townDay('Winter', 20), minutes: 720 },
  { label: 'All four at night, Winter 20', day: townDay('Winter', 20), minutes: 1320 },
  { label: 'The thaw starts, Winter 25', day: townDay('Winter', 25), minutes: 720 },
  { label: 'Melting, Winter 26', day: townDay('Winter', 26), minutes: 720 },
  { label: 'A carrot and a scarf, Winter 27', day: townDay('Winter', 27), minutes: 480 },
  { label: 'All gone, Winter 28', day: townDay('Winter', 28), minutes: 720 },
];
