import { BUILDER_DEFAULT_STORY } from '../src/lib/lanterns';

// The town as it stood when the Lantern Fork was planted, kept here rather than read from
// places/ so that new houses, renames and rewritten stories never change these expectations.
// Roster-wide checks that must hold for any town read the real files instead.
const OWN = 'A story of its own, in its own words.';
export const TOWN = [
  { id: 'after-hours', creator: 'forktown', name: 'After Hours Studio', story: OWN },
  { id: 'arts', creator: 'renabazinin', name: 'arts', story: BUILDER_DEFAULT_STORY },
  { id: 'evergreen', creator: 'forktown', name: 'Evergreen House', story: OWN },
  { id: 'funky-fun', creator: 'renabazinin', name: 'funky fun', story: BUILDER_DEFAULT_STORY },
  { id: 'hello-world', creator: 'forktown', name: 'Hello, World!', story: OWN },
  { id: 'jons-arcade', creator: 'SomeJon', name: 'Arcade', story: OWN },
  { id: 'little-workshop', creator: 'forktown', name: 'The Little Workshop', story: OWN },
  { id: 'moonbeam-cafe', creator: 'forktown', name: 'Moonbeam Café', story: OWN },
  { id: 'moss-nook', creator: 'renanbazinin', name: 'Moss Nook', story: BUILDER_DEFAULT_STORY },
  { id: 'mulu-s', creator: 'HayluMulu', name: "Mulu's", story: OWN },
  {
    id: 'my-little-place',
    creator: 'renanbazinin',
    name: 'My Little Place',
    story: BUILDER_DEFAULT_STORY,
  },
  { id: 'plot-twist', creator: 'forktown', name: 'Plot Twist Books', story: OWN },
  { id: 'rehovot-orchard', creator: 'Adi1231234', name: 'Rehovot Orchard', story: OWN },
  { id: 'stargazer', creator: 'forktown', name: 'Stargazer Station', story: OWN },
  { id: 'sunday-morning', creator: 'forktown', name: 'Sunday Morning', story: OWN },
  { id: 'vaxsius-markus', creator: 'amashi', name: 'Vaxsius Markus', story: OWN },
  {
    id: 'willow-lodge',
    creator: 'renanbazinin',
    name: 'Willow Lodge',
    story: BUILDER_DEFAULT_STORY,
  },
];

/** Newest first, as the build reads it from the town's merge history. */
export const ARRIVALS = [
  'rehovot-orchard',
  'willow-lodge',
  'vaxsius-markus',
  'moss-nook',
  'mulu-s',
  'jons-arcade',
  'arts',
  'funky-fun',
  'my-little-place',
  'after-hours',
  'evergreen',
  'hello-world',
  'little-workshop',
  'moonbeam-cafe',
  'plot-twist',
  'stargazer',
  'sunday-morning',
];
