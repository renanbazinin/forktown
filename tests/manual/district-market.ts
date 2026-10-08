// Harness buttons for Market Square (agent B): the moments worth checking by eye. The morning in
// order on a spring farmers' day, then each market at the live shot through the year, then the
// square shut under canvas. The kind of a day is MARKET_KINDS[hash('market:' + day) % 3].
import type { DistrictButton } from './district';
import { townDay } from './district-days';

const spring = townDay('Spring', 2); // a farmers' market, early spring
export const buttons: readonly DistrictButton[] = [
  { label: 'Stallholders arrive · 07:20', day: spring, minutes: 440 },
  { label: 'Awnings unroll · 07:40', day: spring, minutes: 460 },
  { label: 'Crates go out · 07:52', day: spring, minutes: 472 },
  { label: 'Open · 08:30', day: spring, minutes: 510 },
  { label: 'Live shot · 09:50', day: spring, minutes: 590 },
  { label: 'Packing up · 11:40', day: spring, minutes: 700 },
  { label: 'Shut, the ducks pass · 12:10', day: spring, minutes: 730 },
  { label: 'Bags on the way home · 10:40', day: townDay('Spring', 3), minutes: 640 },
  { label: 'Flowers & seedlings · Spring 3', day: townDay('Spring', 3), minutes: 590 },
  { label: 'Books & bric-a-brac · Spring 1', day: townDay('Spring', 1), minutes: 590 },
  { label: 'Radishes · Spring 17', day: townDay('Spring', 17), minutes: 590 },
  { label: 'Strawberries · Summer 2', day: townDay('Summer', 2), minutes: 590 },
  { label: 'Tomatoes · Summer 16', day: townDay('Summer', 16), minutes: 590 },
  { label: 'Sweet peas · Summer 4', day: townDay('Summer', 4), minutes: 590 },
  { label: 'Apples and squash · Autumn 1', day: townDay('Autumn', 1), minutes: 590 },
  { label: 'Pumpkins · Autumn 18', day: townDay('Autumn', 18), minutes: 590 },
  { label: 'Bulbs & dried flowers · Autumn 4', day: townDay('Autumn', 4), minutes: 590 },
  { label: 'First snow on the awnings · Winter 1', day: townDay('Winter', 1), minutes: 590 },
  { label: 'Wreaths & winter greens · Winter 2', day: townDay('Winter', 2), minutes: 590 },
  { label: 'Roots and jars · Winter 16', day: townDay('Winter', 16), minutes: 590 },
  { label: 'Under canvas at night · 22:40', day: townDay('Winter', 2), minutes: 1360 },
];
