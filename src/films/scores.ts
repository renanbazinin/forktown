import type { FilmArtwork } from '../lib/cinema';
import { boltAndTheBloomScore } from './bolt-and-the-bloom';
import { booPolitelyScore } from './boo-politely';
import { cardboardRocketScore } from './cardboard-rocket';
import { duelAtDuskScore } from './duel-at-dusk';
import { helloDownstreamScore } from './hello-downstream';
import { lanternsOnTheCliffScore } from './lanterns-on-the-cliff';
import { mailForTheAnglerfishScore } from './mail-for-the-anglerfish';
import { misoAndTheMoonScore } from './miso-and-the-moon';
import { theGreatPieHeistScore } from './the-great-pie-heist';
import { theLastDucklingScore } from './the-last-duckling';
import { theMittenScore } from './the-mitten';
import { theRainOrchestraScore } from './the-rain-orchestra';
import { theRunawayPopcornScore } from './the-runaway-popcorn';
import { theSleeperTrainScore } from './the-sleeper-train';
import { theTinyGrandPrixScore } from './the-tiny-grand-prix';
import { visitorsOverForktownScore } from './visitors-over-forktown';
import type { FilmModule } from './types';

/**
 * The films' soundtracks alone. The audio worker imports this rather than the full library, so
 * its bundle carries the scores without any of the drawing code.
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
};
