import type { ReelArtwork } from '../lib/cinema';
import { boltAndTheBloomScore } from './bolt-and-the-bloom';
import { booPolitelyScore } from './boo-politely';
import { cardboardRocketScore } from './cardboard-rocket';
import { helloDownstreamScore } from './hello-downstream';
import { lanternsOnTheCliffScore } from './lanterns-on-the-cliff';
import { mailForTheAnglerfishScore } from './mail-for-the-anglerfish';
import { theGreatPieHeistScore } from './the-great-pie-heist';
import { theMittenScore } from './the-mitten';
import { theRainOrchestraScore } from './the-rain-orchestra';
import { theSleeperTrainScore } from './the-sleeper-train';
import type { FilmModule } from './types';

/**
 * The reel's soundtracks alone. The audio worker imports this rather than the full reel, so
 * its bundle carries the scores without any of the drawing code.
 */
export const REEL_SCORES: Record<ReelArtwork, FilmModule['score']> = {
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
