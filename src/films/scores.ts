import type { AdArtwork, FilmArtwork } from '../lib/cinema';
import { farmEggsAdScore } from './ads/farm-eggs';
import { discoAdScore } from './ads/little-stage-disco';
import { matchdayAdScore } from './ads/matchday';
import { millpondAdScore } from './ads/millpond';
import { phonesOffAdScore } from './ads/phones-off';
import { snackBarAdScore } from './ads/snack-bar';
import { zooAdScore } from './ads/willow-grove-zoo';
import { boltAndTheBloomScore } from './bolt-and-the-bloom';
import { booPolitelyScore } from './boo-politely';
import { cardboardRocketScore } from './cardboard-rocket';
import { duelAtDuskScore } from './duel-at-dusk';
import { helloDownstreamScore } from './hello-downstream';
import { lanternsOnTheCliffScore } from './lanterns-on-the-cliff';
import { mailForTheAnglerfishScore } from './mail-for-the-anglerfish';
import { mirrorSignalPanicScore } from './mirror-signal-panic';
import { misoAndTheMoonScore } from './miso-and-the-moon';
import { nightBusScore } from './night-bus';
import { nightCourierScore } from './night-courier';
import { replyAllScore } from './reply-all';
import { theGreatPieHeistScore } from './the-great-pie-heist';
import { theLastDucklingScore } from './the-last-duckling';
import { theLongTableScore } from './the-long-table';
import { theMittenScore } from './the-mitten';
import { theRainOrchestraScore } from './the-rain-orchestra';
import { theRunawayPopcornScore } from './the-runaway-popcorn';
import { theSleeperTrainScore } from './the-sleeper-train';
import { theTinyGrandPrixScore } from './the-tiny-grand-prix';
import { visitorsOverForktownScore } from './visitors-over-forktown';
import { whiteoutScore } from './whiteout';
import type { AdModule, FilmModule } from './types';

/**
 * The soundtracks alone, for films and ads. The audio worker imports this rather than the full
 * library, so its bundle carries the scores without any of the drawing code.
 */
export const REEL_SCORES: Record<FilmArtwork, FilmModule['score']> = {
  popcorn: theRunawayPopcornScore,
  moon: misoAndTheMoonScore,
  duckling: theLastDucklingScore,
  race: theTinyGrandPrixScore,
  duel: duelAtDuskScore,
  ufo: visitorsOverForktownScore,
  boat: helloDownstreamScore,
  anglerfish: mailForTheAnglerfishScore,
  orchestra: theRainOrchestraScore,
  rocket: cardboardRocketScore,
  heist: theGreatPieHeistScore,
  ghost: booPolitelyScore,
  bloom: boltAndTheBloomScore,
  train: theSleeperTrainScore,
  mitten: theMittenScore,
  lanterns: lanternsOnTheCliffScore,
  table: theLongTableScore,
  nightbus: nightBusScore,
  courier: nightCourierScore,
  whiteout: whiteoutScore,
  replyall: replyAllScore,
  roadtest: mirrorSignalPanicScore,
};
export const AD_SCORES: Record<AdArtwork, AdModule['score']> = {
  snacks: snackBarAdScore,
  phones: phonesOffAdScore,
  eggs: farmEggsAdScore,
  matchday: matchdayAdScore,
  disco: discoAdScore,
  millpond: millpondAdScore,
  zoo: zooAdScore,
};
