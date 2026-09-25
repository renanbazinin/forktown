import type { FilmArtwork } from '../lib/cinema';
import { boltAndTheBloom } from './bolt-and-the-bloom';
import { booPolitely } from './boo-politely';
import { cardboardRocket } from './cardboard-rocket';
import { duelAtDusk } from './duel-at-dusk';
import { helloDownstream } from './hello-downstream';
import { lanternsOnTheCliff } from './lanterns-on-the-cliff';
import { mailForTheAnglerfish } from './mail-for-the-anglerfish';
import { misoAndTheMoon } from './miso-and-the-moon';
import { theGreatPieHeist } from './the-great-pie-heist';
import { theLastDuckling } from './the-last-duckling';
import { theMitten } from './the-mitten';
import { theRainOrchestra } from './the-rain-orchestra';
import { theRunawayPopcorn } from './the-runaway-popcorn';
import { theSleeperTrain } from './the-sleeper-train';
import { theTinyGrandPrix } from './the-tiny-grand-prix';
import { visitorsOverForktown } from './visitors-over-forktown';
import type { FilmModule } from './types';

/** Every film in the library, keyed by artwork. Each film lives in its own module. */
export const REEL: Record<FilmArtwork, FilmModule> = {
  popcorn: theRunawayPopcorn,
  moon: misoAndTheMoon,
  duckling: theLastDuckling,
  race: theTinyGrandPrix,
  duel: duelAtDusk,
  ufo: visitorsOverForktown,
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
