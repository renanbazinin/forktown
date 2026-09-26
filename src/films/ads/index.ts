import type { AdArtwork } from '../../lib/cinema';
import { farmEggsAd } from './farm-eggs';
import { discoAd } from './little-stage-disco';
import { matchdayAd } from './matchday';
import { millpondAd } from './millpond';
import { phonesOffAd } from './phones-off';
import { snackBarAd } from './snack-bar';
import { zooAd } from './willow-grove-zoo';
import type { AdModule } from '../types';

/** Every ad between films, keyed by artwork. Each spot lives in its own module. */
export const ADS: Record<AdArtwork, AdModule> = {
  snacks: snackBarAd,
  phones: phonesOffAd,
  eggs: farmEggsAd,
  matchday: matchdayAd,
  disco: discoAd,
  millpond: millpondAd,
  zoo: zooAd,
};
