import { placeSchema } from '../src/lib/schema';

// Homes for tests that need a particular home: seven of the files in places/ as they stood when
// the tests stopped taking "the first house" from there, parsed the same way. Because they live
// here, a newcomer whose house sorts first, or a neighbor who remodels theirs, never changes these
// expectations. Roster-wide checks that must hold for any town read the real files with
// readPlaces() from ./full-town instead.

const home = (data: unknown) => placeSchema.parse(data);

/** A two-floor studio: classic roof, round windows, paving, a balcony and a tree. A night owl. */
export const AFTER_HOURS = home({
  id: 'after-hours',
  name: 'After Hours Studio',
  creator: 'forktown',
  plot: 'C4',
  building: 'studio',
  color: '#AD88AE',
  decoration: 'tree',
  story:
    'An open studio for tiny experiments and big what-ifs. Come as you are. Make something a little weird.',
  design: {
    wall: '#E9D1BE',
    trim: '#715E51',
    floors: 2,
    roof: 'classic',
    windows: 'round',
    garden: 'paving',
    feature: 'balcony',
  },
  resident: {
    name: 'Juno',
    skin: '#D9B68B',
    hair: '#675A48',
    outfit: '#AD88AE',
    accessory: 'hat',
    greeting: 'Still a little awake?',
    routine: {
      morning: 'stroll',
      afternoon: 'home',
      evening: 'stroll',
      night: 'stroll',
    },
  },
  sign: {
    mode: 'text',
    text: 'AFTER HOURS STUDIO',
    color: '#FFF4D4',
    background: '#35554A',
    html: '',
  },
});

/** A three-floor observatory, from before new homes stopped at two, with an HTML sign. */
export const ARTS = home({
  id: 'arts',
  name: 'arts',
  creator: 'renabazinin',
  plot: 'E5',
  building: 'observatory',
  color: '#789B76',
  decoration: 'flowers',
  story: 'A small corner of the internet, made with curiosity and a little courage.',
  design: {
    wall: '#F0E5C8',
    trim: '#846C56',
    floors: 3,
    roof: 'classic',
    windows: 'cross',
    garden: 'wildflowers',
    feature: 'balcony',
  },
  resident: {
    name: 'New neighbor',
    skin: '#ffffff',
    hair: '#05ff8a',
    outfit: '#60838a',
    accessory: 'hat',
    greeting: 'Go with honor, friend!',
    routine: {
      morning: 'home',
      afternoon: 'home',
      evening: 'stroll',
      night: 'stroll',
    },
  },
  sign: {
    mode: 'html',
    text: 'HELLO',
    color: '#FFF4D4',
    background: '#35554A',
    html: '<div style="background-color: #291B38; text-align: center">\n  <strong style="color: #FFACC5; font-size: 28px">▄██▄ ▄██▄</strong>\n  <strong style="color: #FF729F; font-size: 28px">▀███████▀</strong>\n  <strong style="color: #FFC296; font-size: 28px">▀███▀</strong>\n</div>',
  },
});

/** A two-floor studio with a gable roof, round windows, vegetables, a porch and a bench. */
export const BAZPLACE = home({
  id: 'bazplace',
  name: 'BazPlace',
  creator: 'Sharpen6',
  plot: 'E4',
  building: 'studio',
  color: '#789B76',
  decoration: 'bench',
  story: 'Metal symphonic music',
  design: {
    wall: '#F0E5C8',
    trim: '#846C56',
    floors: 2,
    roof: 'gable',
    windows: 'round',
    garden: 'vegetables',
    feature: 'porch',
  },
  resident: {
    name: 'Hazel',
    figure: 'male',
    skin: '#D9B68B',
    hair: '#675A48',
    outfit: '#789B76',
    accessory: 'none',
    greeting: 'Hello!',
    routine: {
      morning: 'work',
      afternoon: 'stroll',
      evening: 'home',
      night: 'sleep',
    },
  },
  sign: {
    mode: 'html',
    text: 'HELLO',
    color: '#FFF4D4',
    background: '#35554A',
    html: '<div style="background-color: #203B35; text-align: center">\n  <strong style="color: #FFE7A3; font-size: 24px">SHARPEN\'S</strong>\n  <p style="color: #BFE2C2; font-size: 12px">WELCOME HOME</p>\n</div>',
  },
});

/** A one-floor greenhouse with cross windows, vegetables and flowers. */
export const EVERGREEN = home({
  id: 'evergreen',
  name: 'Evergreen House',
  creator: 'forktown',
  plot: 'D2',
  building: 'greenhouse',
  color: '#7DAB95',
  decoration: 'flowers',
  story:
    'A quiet place to grow something new. Water the plants, make a little progress, and remember to take a break.',
  design: {
    wall: '#E1E6CE',
    trim: '#687451',
    floors: 1,
    roof: 'classic',
    windows: 'cross',
    garden: 'vegetables',
    feature: 'none',
  },
  resident: {
    name: 'Fern',
    skin: '#A97652',
    hair: '#3F3735',
    outfit: '#7DAB95',
    accessory: 'none',
    greeting: 'Looking lovely today!',
    routine: {
      morning: 'work',
      afternoon: 'stroll',
      evening: 'home',
    },
  },
  sign: {
    mode: 'text',
    text: 'EVERGREEN HOUSE',
    color: '#FFF4D4',
    background: '#735557',
    html: '',
  },
});

/** A one-floor studio with a flat roof, whose neighbor strolls all day and all night. */
export const FUNKY_FUN = home({
  id: 'funky-fun',
  name: 'funky fun',
  creator: 'renabazinin',
  plot: 'A2',
  building: 'studio',
  color: '#789B76',
  decoration: 'flowers',
  story: 'A small corner of the internet, made with curiosity and a little courage.',
  design: {
    wall: '#625b5b',
    trim: '#4b3016',
    floors: 1,
    roof: 'flat',
    windows: 'cross',
    garden: 'vegetables',
    feature: 'none',
  },
  resident: {
    name: 'bobo',
    skin: '#000000',
    hair: '#db9129',
    outfit: '#000000',
    accessory: 'hat',
    greeting: 'Hello!',
    routine: {
      morning: 'stroll',
      afternoon: 'stroll',
      evening: 'stroll',
      night: 'stroll',
    },
  },
  sign: {
    mode: 'html',
    text: 'HELLO',
    color: '#FFF4D4',
    background: '#35554A',
    html: '<div style="background-color: #192B40; text-align: center">\n  <strong style="color: #FFD580; font-size: 28px">MOON CLUB</strong>\n  <p style="color: #A8E6CF; font-size: 16px">Night owls welcome</p>\n</div>',
  },
});

/** A two-floor cottage with a gable roof, shutters, wildflowers, a porch and a mailbox. */
export const HELLO_WORLD = home({
  id: 'hello-world',
  name: 'Hello, World!',
  creator: 'forktown',
  plot: 'C2',
  building: 'cottage',
  color: '#789B76',
  decoration: 'mailbox',
  story:
    'Every adventure starts somewhere. This little cottage is a reminder that your first contribution belongs here.',
  design: {
    wall: '#F0DCB4',
    trim: '#795C58',
    floors: 2,
    roof: 'gable',
    windows: 'shutters',
    garden: 'wildflowers',
    feature: 'porch',
  },
  resident: {
    name: 'Pip',
    skin: '#F0C9A8',
    hair: '#A46E45',
    outfit: '#789B76',
    accessory: 'glasses',
    greeting: 'Hello, world!',
    routine: {
      morning: 'stroll',
      afternoon: 'stroll',
      evening: 'home',
    },
  },
  sign: {
    mode: 'text',
    text: 'HELLO, WORLD!',
    color: '#FFF4D4',
    background: '#4C5E6C',
    html: '',
  },
});

/** A two-floor studio with a flat roof, round windows, paving, a balcony and a bench. */
export const JONS_ARCADE = home({
  id: 'jons-arcade',
  name: 'Arcade',
  creator: 'SomeJon',
  plot: 'E2',
  building: 'studio',
  color: '#BE185D',
  decoration: 'bench',
  story:
    "Downstairs is a retro arcade with neon duel stations and coin-op fighting games. Upstairs is Jon's cozy living loft.",
  design: {
    wall: '#FFFBEB',
    trim: '#D97706',
    floors: 2,
    roof: 'flat',
    windows: 'round',
    garden: 'paving',
    feature: 'balcony',
  },
  resident: {
    name: 'Jon',
    skin: '#D9B68B',
    hair: '#451A03',
    outfit: '#BE185D',
    accessory: 'glasses',
    greeting: 'Time to d-d-d-duel!',
    routine: {
      morning: 'work',
      afternoon: 'stroll',
      evening: 'home',
      night: 'sleep',
    },
  },
  sign: {
    mode: 'html',
    text: 'ARCADE',
    color: '#F472B6',
    background: '#311333',
    html: '<div style="background-color: #311333; color: #F472B6; text-align: center"><strong style="font-size: 24px">🎮 ARCADE 🎮</strong><p style="font-size: 12px; color: #FBBF24">Time to Duel!</p></div>',
  },
});
