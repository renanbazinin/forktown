import { CINEMA_SITE } from './town-config.ts';
import { PLOTS, hash, project, type Point } from './world.ts';

export const CINEMA_VENUE = {
  id: 'cinema',
  plot: 'D6',
  name: 'The Starlight Cinema',
  kind: 'cinema',
} as const;
export const CINEMA_PLOTS = PLOTS.filter(
  (plot) =>
    plot.row >= CINEMA_SITE.row &&
    plot.row < CINEMA_SITE.row + CINEMA_SITE.rows &&
    plot.col >= CINEMA_SITE.col &&
    plot.col < CINEMA_SITE.col + CINEMA_SITE.columns,
).map((plot) => plot.id);
export const isCinemaPlot = (id: string) => CINEMA_PLOTS.includes(id);
export const CINEMA_GROUND = { left: 22, right: 29, top: 14, bottom: 21 } as const;
export const CINEMA_CENTER = { x: 25.5, y: 17.5 };
export const CINEMA_ENTRANCE = { x: 25.5, y: 21.5 };
export const CINEMA_SEATS = Array.from({ length: 12 }, (_, index) => ({
  x: 23 + (index % 4) * 1.35,
  y: 16.8 + Math.floor(index / 4) * 1.25,
}));
export const insideCinema = (point: Point) =>
  point.x >= 22 && point.x <= 29 && point.y >= 14 && point.y <= 21;
export const CINEMA_FRAME = {
  center: { ...project(25.5, 17), y: project(25.5, 17).y - 60 },
  width: 600,
  height: 450,
};
export const CINEMA_START = 20 * 60 + 30;
/** Listen only when the cinema is on screen and the camera is close to it. */
export function cinemaListening(
  camera: { x: number; y: number; zoom: number },
  width: number,
  height: number,
) {
  if (width <= 0 || height <= 0) return { gain: 0, pan: 0 };
  const x = CINEMA_FRAME.center.x * camera.zoom + camera.x;
  const y = (CINEMA_FRAME.center.y - 60) * camera.zoom + camera.y;
  const distance = Math.hypot((x - width / 2) / (width / 2), (y - height / 2) / (height / 2));
  return {
    gain:
      x > 0 && x < width && y > 0 && y < height
        ? Math.max(0, Math.min(1, (camera.zoom - 0.4) / 0.8)) * Math.max(0, 1 - distance * 0.45)
        : 0,
    pan: Math.max(-1, Math.min(1, (x / width - 0.5) * 1.5)),
  };
}
export const CINEMA_CARD_SECONDS = 6;
export const CINEMA_SCREEN_RISE = 20 * 60;
export const CINEMA_SCREEN_ROLL_SECONDS = 6;
/**
 * Seconds of films and ads on the screen each night. Films run from one to three minutes in
 * ten-second steps, and ads fill whatever the night's films leave, so every bill is the same
 * length and still ends before midnight.
 */
export const CINEMA_SCREEN_TIME = 180;
export const FILM_LENGTH = { min: 60, max: 180, step: 10 } as const;
/** Every film is a self-contained module in `src/films/`, keyed by its artwork. */
export type FilmArtwork =
  | 'popcorn'
  | 'moon'
  | 'duckling'
  | 'race'
  | 'duel'
  | 'ufo'
  | 'boat'
  | 'anglerfish'
  | 'orchestra'
  | 'rocket'
  | 'heist'
  | 'ghost'
  | 'bloom'
  | 'train'
  | 'mitten'
  | 'lanterns'
  | 'table'
  | 'nightbus'
  | 'courier'
  | 'whiteout'
  | 'replyall'
  | 'roadtest';
export type FilmGenre = 'drama' | 'action' | 'comedy';
export type CinemaFilm = {
  id: string;
  title: string;
  description: string;
  duration: number;
  artwork: FilmArtwork;
  /** Grown-up films carry a 14+ badge on their title card; the rest are for everyone. */
  rating?: '14+';
  genre?: FilmGenre;
};
/** Every ad is a self-contained module in `src/films/ads/`, keyed by its artwork. */
export type AdArtwork = 'snacks' | 'phones' | 'eggs' | 'matchday' | 'disco' | 'millpond' | 'zoo';
/** A short spot from somewhere in town, shown in the breaks between films. */
export type CinemaAd = {
  id: string;
  sponsor: string;
  tagline: string;
  duration: number;
  artwork: AdArtwork;
};
/** Anything the projector can play: a film or an ad. */
export type Screening = CinemaFilm | CinemaAd;
export const isAd = (screening: Screening): screening is CinemaAd => 'sponsor' in screening;
export const CINEMA_FILMS: readonly CinemaFilm[] = [
  {
    id: 'runaway-popcorn',
    title: 'The Runaway Popcorn',
    description: 'One tiny kernel dreams of a very big entrance.',
    duration: 60,
    artwork: 'popcorn',
  },
  {
    id: 'miso-and-the-moon',
    title: 'Miso and the Moon',
    description: 'A rooftop cat discovers that the moon has a playful side.',
    duration: 60,
    artwork: 'moon',
  },
  {
    id: 'the-last-duckling',
    title: 'The Last Duckling',
    description: 'A butterfly, a distracted duckling, and a family worth hurrying for.',
    duration: 60,
    artwork: 'duckling',
  },
  {
    id: 'the-tiny-grand-prix',
    title: 'The Tiny Grand Prix',
    description: 'Three beetles, bottle-cap racers, and a mop with other plans.',
    duration: 60,
    artwork: 'race',
  },
  {
    id: 'duel-at-dusk',
    title: 'Duel at Dusk',
    description: 'Two swords cross on a castle bridge. Only one feather will fall.',
    duration: 60,
    artwork: 'duel',
  },
  {
    id: 'visitors-over-forktown',
    title: 'Visitors over Forktown',
    description: 'A flying saucer arrives, and three night owls take an unexpected trip.',
    duration: 60,
    artwork: 'ufo',
  },
  {
    id: 'hello-downstream',
    title: 'Hello, Downstream',
    description: 'A paper boat with one word on its side, and a very long way to go.',
    duration: 60,
    artwork: 'boat',
  },
  {
    id: 'mail-for-the-anglerfish',
    title: 'Mail for the Anglerfish',
    description:
      'The deep-sea postman has a letter for everyone except the one who lights the way.',
    duration: 60,
    artwork: 'anglerfish',
  },
  {
    id: 'the-rain-orchestra',
    title: 'The Rain Orchestra',
    description: 'A leaky roof, a pile of pots, and a bored boy who hears music in the rain.',
    duration: 60,
    artwork: 'orchestra',
  },
  {
    id: 'cardboard-rocket',
    title: 'Cardboard Rocket',
    description: 'Nova is flying to the Moon tonight. Dinner keeps calling her home.',
    duration: 60,
    artwork: 'rocket',
  },
  {
    id: 'the-great-pie-heist',
    title: 'The Great Pie Heist',
    description: 'A raccoon with a plan, a pie on a windowsill, and nothing going to plan.',
    duration: 60,
    artwork: 'heist',
  },
  {
    id: 'boo-politely',
    title: 'Boo, Politely',
    description: 'A shy little ghost tries to scare off the new family. It does not go well.',
    duration: 60,
    artwork: 'ghost',
  },
  {
    id: 'bolt-and-the-bloom',
    title: 'Bolt and the Bloom',
    description: 'In a grey city where nothing grows, a small robot finds something that does.',
    duration: 60,
    artwork: 'bloom',
  },
  {
    id: 'the-sleeper-train',
    title: 'The Sleeper Train',
    description: 'Fennel wants to stay awake to see the sea at sunrise. The night is very long.',
    duration: 60,
    artwork: 'train',
  },
  {
    id: 'the-mitten',
    title: 'The Mitten',
    description: 'An old winter tale: one lost red mitten, and far too many guests.',
    duration: 60,
    artwork: 'mitten',
  },
  {
    id: 'lanterns-on-the-cliff',
    title: 'Lanterns on the Cliff',
    description: 'The lighthouse goes dark in a storm, so the whole town lights the way home.',
    duration: 60,
    artwork: 'lanterns',
  },
  {
    id: 'the-long-table',
    title: 'The Long Table',
    description:
      'After the funeral, three grown siblings share their mother’s kitchen and one recipe none of them can make alone.',
    duration: 180,
    artwork: 'table',
    rating: '14+',
    genre: 'drama',
  },
  {
    id: 'night-bus',
    title: 'Night Bus',
    description:
      'A nurse after a double shift, an old man with fresh flowers, and the stop he never gets off at.',
    duration: 120,
    artwork: 'nightbus',
    rating: '14+',
    genre: 'drama',
  },
  {
    id: 'night-courier',
    title: 'Night Courier',
    description:
      'Rain, neon, one bike messenger, and a cold box that has to reach the hospital before the clock runs out.',
    duration: 150,
    artwork: 'courier',
    rating: '14+',
    genre: 'action',
  },
  {
    id: 'whiteout',
    title: 'Whiteout',
    description:
      'A mountain rescuer, a stranded climber, and a storm that will not wait for either of them.',
    duration: 120,
    artwork: 'whiteout',
    rating: '14+',
    genre: 'action',
  },
  {
    id: 'reply-all',
    title: 'Reply All',
    description: 'One email. Four hundred inboxes. One very long corridor to the server room.',
    duration: 90,
    artwork: 'replyall',
    rating: '14+',
    genre: 'comedy',
  },
  {
    id: 'mirror-signal-panic',
    title: 'Mirror, Signal, Panic',
    description:
      'Grace is forty-three, on her ninth driving test, and the examiner has not blinked once.',
    duration: 100,
    artwork: 'roadtest',
    rating: '14+',
    genre: 'comedy',
  },
];
/** The spots between films: short, cheerful, and all from around town. */
export const CINEMA_ADS: readonly CinemaAd[] = [
  {
    id: 'starlight-snack-bar',
    sponsor: 'Starlight Snack Bar',
    tagline: 'Popcorn: the other feature.',
    duration: 10,
    artwork: 'snacks',
  },
  {
    id: 'phones-off',
    sponsor: 'The Starlight Cinema',
    tagline: 'Phones off. Stars on.',
    duration: 10,
    artwork: 'phones',
  },
  {
    id: 'moon-harvest-eggs',
    sponsor: 'Moon Harvest Farm',
    tagline: 'Fresh eggs at the farm gate, every morning.',
    duration: 10,
    artwork: 'eggs',
  },
  {
    id: 'meadow-matchday',
    sponsor: 'The Meadow Ground',
    tagline: 'Five-a-side. Bring your loudest voice.',
    duration: 10,
    artwork: 'matchday',
  },
  {
    id: 'little-stage-disco',
    sponsor: 'Midnight at the Little Stage',
    tagline: 'One more song. Every night at midnight.',
    duration: 20,
    artwork: 'disco',
  },
  {
    id: 'the-millpond',
    sponsor: 'The Millpond',
    tagline: 'Reeds, ripples, and ducks with opinions.',
    duration: 20,
    artwork: 'millpond',
  },
  {
    id: 'willow-grove-zoo',
    sponsor: 'Willow Grove Zoo',
    tagline: 'Come and say hello. The penguins insist.',
    duration: 30,
    artwork: 'zoo',
  },
];
export type CinemaSlot = {
  kind: 'opening' | 'film' | 'ad' | 'interval' | 'closing';
  start: number;
  end: number;
  film?: CinemaFilm;
  ad?: CinemaAd;
  nextFilm?: CinemaFilm;
};

/** Ids break a hash tie by code unit, so every browser language draws the same order. */
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const shuffled = <T extends { id: string }>(items: readonly T[], seed: string) =>
  [...items].sort((a, b) => hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`) || byId(a, b));
const unique = (items: readonly { id: string }[]) =>
  items.every((item) => item.id) && new Set(items.map((item) => item.id)).size === items.length;
const onStep = (seconds: number) =>
  Number.isFinite(seconds) && seconds > 0 && seconds % FILM_LENGTH.step === 0;

/** The UTC-based town day is the only seed: hosts, sessions, and reloads share a bill.
 * Registry order never changes the selected films, the ads, or their screening order.
 */
export function cinemaProgram(
  day: number,
  library: readonly CinemaFilm[] = CINEMA_FILMS,
  adReel: readonly CinemaAd[] = CINEMA_ADS,
) {
  if (
    library.length < 3 ||
    !unique(library) ||
    library.some(
      (film) =>
        !onStep(film.duration) ||
        film.duration < FILM_LENGTH.min ||
        film.duration > FILM_LENGTH.max,
    )
  )
    throw new Error('Cinema needs three or more unique films of one to three minutes each.');
  if (
    !unique(adReel) ||
    adReel.some((ad) => !onStep(ad.duration) || ad.duration >= FILM_LENGTH.min) ||
    !adReel.some((ad) => ad.duration === FILM_LENGTH.step)
  )
    throw new Error('Cinema ads must be short, and at least one must fill a single step.');
  const night = Math.floor(day);
  // The shuffle's first film always plays, then any later film that still fits tonight.
  let left = CINEMA_SCREEN_TIME;
  const films: CinemaFilm[] = [];
  for (const film of shuffled(library, `cinema:${night}`)) {
    if (film.duration > left) continue;
    films.push(film);
    left -= film.duration;
    if (left < FILM_LENGTH.min) break;
  }
  // Ads fill the rest exactly: each spot once, then repeats only if the reel runs short.
  const ads: CinemaAd[] = [];
  const order = shuffled(adReel, `cinema-ads:${night}`);
  for (let pass = 0; left > 0; pass++)
    for (const ad of order)
      if (ad.duration <= left && (pass || !ads.includes(ad))) {
        ads.push(ad);
        left -= ad.duration;
      }
  // Ads run in the breaks between films, or before the film on a one-film night.
  const breaks = Math.max(1, films.length - 1);
  const breakAds = (index: number) => ads.filter((_, i) => i % breaks === index);
  const slots: CinemaSlot[] = [];
  let cursor = CINEMA_START;
  const add = (slot: Omit<CinemaSlot, 'start' | 'end'>, duration: number) => {
    slots.push({ ...slot, start: cursor, end: cursor + duration });
    cursor += duration;
  };
  const advertise = (index: number) =>
    breakAds(index).forEach((ad) => add({ kind: 'ad', ad }, ad.duration));
  add({ kind: 'opening', nextFilm: films[0] }, CINEMA_CARD_SECONDS);
  if (films.length === 1) advertise(0);
  films.forEach((film, index) => {
    add({ kind: 'film', film }, film.duration);
    if (index === films.length - 1) return;
    advertise(index);
    add({ kind: 'interval', nextFilm: films[index + 1] }, CINEMA_CARD_SECONDS);
  });
  add({ kind: 'closing' }, CINEMA_CARD_SECONDS);
  if (cursor + CINEMA_SCREEN_ROLL_SECONDS > 1440)
    throw new Error('The cinema bill must end before midnight for the disco and bedtimes.');
  return {
    day: night,
    films,
    ads,
    slots,
    depart: 1170,
    start: CINEMA_START,
    end: cursor,
    homeBy: cursor + 45,
  };
}

export function cinemaAt(minutes: number, day = 0) {
  const time = ((minutes % 1440) + 1440) % 1440;
  const evening = day + Math.floor(minutes / 1440) - (time < 360 ? 1 : 0);
  const program = cinemaProgram(evening);
  const onEveningClock = time < 360 ? time + 1440 : time;
  const slot = program.slots.find(
    (slot) => onEveningClock >= slot.start && onEveningClock < slot.end,
  );
  const ease = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };
  // Raise from the ground cassette at dusk; finish lowering before sunrise even for a late bill.
  const lowerAt = Math.min(program.end, 1800 - CINEMA_SCREEN_ROLL_SECONDS);
  const screenReveal =
    ease((onEveningClock - CINEMA_SCREEN_RISE) / CINEMA_SCREEN_ROLL_SECONDS) *
    (1 - ease((onEveningClock - lowerAt) / CINEMA_SCREEN_ROLL_SECONDS));
  return {
    program,
    slot,
    live: !!slot,
    elapsed: slot ? onEveningClock - slot.start : 0,
    screenReveal,
  };
}

/** Half the eligible night owls choose cinema; they can join the disco afterward if time permits. */
export function cinemaGuests<
  T extends { id: string; resident: { routine: { evening: string; night: string } } },
>(homes: readonly T[], day: number): string[] {
  const eligible = homes.filter(
    (home) =>
      home.resident.routine.evening === 'stroll' && home.resident.routine.night === 'stroll',
  );
  return eligible
    .sort(
      (a, b) =>
        hash(`cinema-guests:${day}:${a.id}`) - hash(`cinema-guests:${day}:${b.id}`) || byId(a, b),
    )
    .slice(0, Math.min(CINEMA_SEATS.length, Math.floor(eligible.length / 2)))
    .map((home) => home.id);
}
