import type { ReelArtwork } from '../lib/cinema';
import { cardboardRocket } from './cardboard-rocket';
import { boltAndTheBloom } from './bolt-and-the-bloom';
import { booPolitely } from './boo-politely';
import { helloDownstream } from './hello-downstream';
import { lanternsOnTheCliff } from './lanterns-on-the-cliff';
import { mailForTheAnglerfish } from './mail-for-the-anglerfish';
import { theGreatPieHeist } from './the-great-pie-heist';
import { theMitten } from './the-mitten';
import { theRainOrchestra } from './the-rain-orchestra';
import { theSleeperTrain } from './the-sleeper-train';
import type { FilmModule } from './types';

/** The Starlight Reel, keyed by artwork. Each film lives in its own module. */
export const REEL: Record<ReelArtwork, FilmModule> = {
  boat: helloDownstream,
  anglerfish: mailForTheAnglerfish,
  orchestra: theRainOrchestra,
  rocket: cardboardRocket,
  heist: theGreatPieHeist,
  ghost: booPolitely,
  bloom: boltAndTheBloom,
  train: theSleeperTrain,
  mitten: theMitten,
  lanterns: lanternsOnTheCliff,
};
