// Harness buttons for the Harvest Fair and the Long Table (agent D): the moments worth checking.
import type { DistrictButton } from './district';
import { townDay } from './district-days';

const A23 = townDay('Autumn', 23),
  A24 = townDay('Autumn', 24),
  A25 = townDay('Autumn', 25);

export const buttons: readonly DistrictButton[] = [
  { label: 'Props out at dawn', day: A23, minutes: 363 },
  { label: 'Seats waiting', day: A23, minutes: 760 },
  { label: 'The fair opens', day: A23, minutes: 810 },
  { label: 'Cider at the press', day: A24, minutes: 920 },
  { label: 'Last of the fair', day: A24, minutes: 1010 },
  { label: 'Press and bales go', day: A24, minutes: 1028 },
  { label: 'Laying the table', day: A24, minutes: 1048 },
  { label: 'The fiddler starts', day: A24, minutes: 1090 },
  { label: 'Dishes arrive', day: A25, minutes: 1120 },
  { label: 'Supper', day: A25, minutes: 1170 },
  { label: 'Before the lamps', day: A25, minutes: 1210 },
  { label: 'Table lamps lit', day: A25, minutes: 1235 },
  { label: 'Clearing the table', day: A25, minutes: 1270 },
  { label: 'An ordinary autumn day', day: townDay('Autumn', 20), minutes: 920 },
  { label: 'The day after', day: townDay('Autumn', 26), minutes: 920 },
];
