// The Riverside's words: every outing's name, description, labels and panel lines (SPEC §4.1–4.7).
// district-calendar.ts holds the facts; this file holds the voice. Frozen: the events list, the
// labels, the panels and the tests all read these strings, so they change here or nowhere.
// The copy reports and never ranks, and never promises a crowd.
import { bandOf, marketKind, type Band, type OutingId } from './district-calendar.ts';
import { townCalendarAt } from './town-calendar.ts';

export type OutingLabels = {
  going: string;
  attending: string;
  waiting: string;
  returning: string;
  /** TUBE_PLACES: where a rider is going to, and coming home from. */
  tube: readonly [to: string, from: string];
};
export type OutingCopy = {
  /** The TownEvent name, with no trailing period; headings add it where they render. */
  name(day: number): string;
  description(day: number): string;
  /** The panel's uppercase eyebrow, where the outing has its own. */
  panelEyebrow?: string;
  labels: OutingLabels;
};

const season = (day: number) => townCalendarAt(Math.floor(day)).season;

/** The farmers' market changes its stalls with the season. */
const FARMERS: Record<string, string> = {
  Spring: 'Radishes, greens and seedlings in trays. Bring a bag, take the spring home.',
  Summer: 'Strawberries, tomatoes and the first beans. Bring a bag, take the summer home.',
  Autumn: 'Apples, squash and a pumpkin or two. Bring a bag, take the autumn home.',
  Winter: 'Roots, jars and crates of keeping apples. Bring a bag, take the winter home.',
};
function market(day: number) {
  const kind = marketKind(day);
  if (kind === 'books')
    return {
      name: 'Books & bric-a-brac',
      description: 'Paperbacks, teacups and a gramophone horn. Haggling is gentle here.',
    };
  const now = season(day);
  if (kind === 'farmers') return { name: 'Farmers’ market', description: FARMERS[now] };
  if (now === 'Autumn')
    return {
      name: 'Bulbs & dried flowers',
      description: 'Paper bags of bulbs and bunches hung to dry. Plant now, see them in spring.',
    };
  if (now === 'Winter')
    return {
      name: 'Wreaths & winter greens',
      description: 'Holly, ivy and fir tied with twine. Something green for the door.',
    };
  return {
    name: 'Flowers & seedlings',
    description: 'Buckets of stems and trays of green things. Something for every windowsill.',
  };
}

/** Tonight's band, the same for both sets. */
export const BAND_COPY: Record<Band, { name: string; description: string }> = {
  brass: {
    name: 'Brass at the bandstand',
    description: 'A tuba, two cornets and a drum. The river keeps time.',
  },
  folk: {
    name: 'Folk on the riverbank',
    description: 'A fiddle and a squeezebox by the water. Everyone half knows the chorus.',
  },
  strings: {
    name: 'A string trio by the river',
    description:
      'Three chairs, three strings and the evening coming in. Deckchairs face the music.',
  },
};

const BANDSTAND_LABELS: OutingLabels = {
  going: 'Walking to the Bandstand',
  attending: 'Listening at the Bandstand',
  waiting: 'Waiting for the band',
  returning: 'Walking home from the Bandstand',
  tube: ['the Bandstand', 'the Bandstand'],
};

export const DISTRICT_COPY: Record<OutingId, OutingCopy> = {
  market: {
    name: (day) => market(day).name,
    description: (day) => market(day).description,
    panelEyebrow: 'PUBLIC SPACE · D14–E15 · 4 PLOTS',
    labels: {
      going: 'Walking to Market Square',
      attending: 'Browsing the market',
      waiting: 'Waiting for the market to open',
      returning: 'Walking home from the market',
      tube: ['Market Square', 'the market'],
    },
  },
  'bandstand-tea': {
    name: (day) => BAND_COPY[bandOf(day)].name,
    description: (day) => BAND_COPY[bandOf(day)].description,
    panelEyebrow: 'PUBLIC SPACE · K15',
    labels: BANDSTAND_LABELS,
  },
  'bandstand-sundown': {
    name: (day) => BAND_COPY[bandOf(day)].name,
    description: (day) => BAND_COPY[bandOf(day)].description,
    panelEyebrow: 'PUBLIC SPACE · K15',
    labels: BANDSTAND_LABELS,
  },
  regatta: {
    name: () => 'Paper-boat regatta',
    description: () => 'Fold a boat and let the river take it. Nobody keeps the times.',
    panelEyebrow: 'REGATTA WEEK · SUMMER 10–16',
    labels: {
      going: 'Walking to the Boat Landing',
      attending: 'Watching the paper boats',
      waiting: 'Waiting for the boats',
      returning: 'Walking home from the regatta',
      tube: ['the Boat Landing', 'the regatta'],
    },
  },
  'harvest-fair': {
    name: () => 'Harvest fair',
    description: () =>
      'The field is cut and the gate is open. Cider, bales and a cart of pumpkins.',
    panelEyebrow: 'HARVEST FAIR · MOON HARVEST FARM',
    labels: {
      going: 'Walking to the harvest fair',
      attending: 'At the harvest fair',
      waiting: 'Waiting for the fair to open',
      returning: 'Walking home from the fair',
      tube: ['Moon Harvest Farm', 'the fair'],
    },
  },
  'long-table': {
    name: () => 'The Long Table',
    description: () =>
      'Supper on the stubble at Moon Harvest Farm. Bring a dish and stay for the lamps.',
    panelEyebrow: 'THE LONG TABLE · AUTUMN 23–25',
    labels: {
      going: 'Walking to the Long Table',
      attending: 'At the Long Table',
      waiting: 'Waiting for supper',
      returning: 'Walking home from supper',
      tube: ['Moon Harvest Farm', 'the Long Table'],
    },
  },
  stargazing: {
    name: () => 'Stargazing by the river',
    description: () => 'No moon tonight, so the sky is full. Rugs out, faces up.',
    panelEyebrow: 'NEW MOON · THE BANDSTAND LAWN',
    labels: {
      going: 'Walking to the Bandstand lawn',
      attending: 'Stargazing',
      waiting: 'Waiting for the dark',
      returning: 'Walking home from the stars',
      tube: ['the Bandstand lawn', 'the stars'],
    },
  },
};

/** The lunch on a snowman build day (Winter 3, 7, 11 and 15): a choice override, same guests. */
export const SNOWMEN_LUNCH = {
  name: 'Snowmen on the green',
  description: 'Roll the snow into someone with a carrot nose. They stand until the thaw.',
} as const;

/** The panels' own lines. Headings end in a period; eyebrows are uppercase. */
export const PANEL_COPY = {
  market: {
    eyebrow: 'PUBLIC SPACE · D14–E15 · 4 PLOTS',
    heading: 'Market Square.',
    hours: 'Open 08:00–11:30. Browsers walk home with a paper bag.',
    next: 'Next market: tomorrow, 08:00.',
  },
  bandstand: {
    eyebrow: 'PUBLIC SPACE · K15',
    heading: 'The Bandstand.',
    sets: 'Teatime set 16:00. Sundown set 18:15.',
    chairs: 'Eight deckchairs face the music.',
  },
  landing: {
    eyebrow: 'PUBLIC SPACE · J15',
    heading: 'The Boat Landing.',
    body: 'A lawn by the river. Paper boats in summer.',
    week: 'Regatta Week is Summer 10–16.',
  },
  harvest: {
    heading: 'Harvest Fair.',
    dates: 'Autumn 23–25.',
    next: 'Next: Autumn 23.',
  },
  stars: {
    eyebrow: 'NEW MOON · THE BANDSTAND LAWN',
    heading: 'Stargazing by the river.',
  },
  green: {
    /** History, not a score: how many snowmen stand on the green today. */
    snowmen: (count: number) => `Snowmen on the green: ${count}. They stay until the thaw.`,
  },
} as const;
