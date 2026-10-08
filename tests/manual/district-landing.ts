// Harness buttons for the Boat Landing (agent C): the moments worth checking by eye.
import type { DistrictButton } from './district';
import { townDay } from './district-days';

export const buttons: readonly DistrictButton[] = [
  { label: 'Regatta Week morning', day: townDay('Summer', 12), minutes: 600 },
  { label: 'Boats under arm', day: townDay('Summer', 10), minutes: 830 },
  { label: 'First launches', day: townDay('Summer', 10), minutes: 860 },
  { label: 'The boatwright fetches', day: townDay('Summer', 10), minutes: 866.5 },
  { label: 'Boats under the bridge', day: townDay('Summer', 10), minutes: 915 },
  { label: 'Coming to rest', day: townDay('Summer', 10), minutes: 935 },
  { label: 'All at the boom', day: townDay('Summer', 10), minutes: 980 },
  { label: 'Netting out', day: townDay('Summer', 10), minutes: 1005 },
  { label: 'Last regatta day', day: townDay('Summer', 16), minutes: 915 },
  { label: 'The Landing in spring', day: townDay('Spring', 12), minutes: 720 },
  { label: 'The Landing in winter', day: townDay('Winter', 10), minutes: 720 },
  { label: 'The Landing at night', day: townDay('Autumn', 5), minutes: 1300 },
];
