import type { FilmArtwork } from '../lib/cinema';
import { boltAndTheBloom } from './bolt-and-the-bloom';
import { booPolitely } from './boo-politely';
import { cardboardRocket } from './cardboard-rocket';
import { duelAtDusk } from './duel-at-dusk';
import { helloDownstream } from './hello-downstream';
import { inTime } from './in-time';
import { lanternsOnTheCliff } from './lanterns-on-the-cliff';
import { mailForTheAnglerfish } from './mail-for-the-anglerfish';
import { mirrorSignalPanic } from './mirror-signal-panic';
import { misoAndTheMoon } from './miso-and-the-moon';
import { nightBus } from './night-bus';
import { nightCourier } from './night-courier';
import { replyAll } from './reply-all';
import { statues } from './statues';
import { tallOrder } from './tall-order';
import { theGreatPieHeist } from './the-great-pie-heist';
import { theLastDuckling } from './the-last-duckling';
import { theLongTable } from './the-long-table';
import { theMitten } from './the-mitten';
import { theRainOrchestra } from './the-rain-orchestra';
import { theReturnJob } from './the-return-job';
import { theRunawayPopcorn } from './the-runaway-popcorn';
import { theSleeperTrain } from './the-sleeper-train';
import { theTinyGrandPrix } from './the-tiny-grand-prix';
import { theWaspConcerto } from './the-wasp-concerto';
import { visitorsOverForktown } from './visitors-over-forktown';
import { whiteout } from './whiteout';
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
  table: theLongTable,
  nightbus: nightBus,
  courier: nightCourier,
  whiteout,
  replyall: replyAll,
  roadtest: mirrorSignalPanic,
  snowmen: statues,
  towers: tallOrder,
  wasp: theWaspConcerto,
  skiff: inTime,
  wren: theReturnJob,
};
export { ADS } from './ads';
export { CARDS } from './cards';
