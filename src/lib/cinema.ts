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
/** The first library, drawn in `src/city/cinema-films.ts`. */
export type ClassicArtwork = 'popcorn' | 'moon' | 'duckling' | 'race' | 'duel' | 'ufo';
/** The Starlight Reel: longer stories, each a self-contained module in `src/films/`. */
export type ReelArtwork =
  | 'boat'
  | 'anglerfish'
  | 'orchestra'
  | 'rocket'
  | 'heist'
  | 'ghost'
  | 'bloom'
  | 'train'
  | 'mitten'
  | 'lanterns';
export type FilmArtwork = ClassicArtwork | ReelArtwork;
export type CinemaFilm = {
  id: string;
  title: string;
  description: string;
  duration: number;
  artwork: FilmArtwork;
};
export const CINEMA_FILMS: readonly CinemaFilm[] = [
  {
    id: 'runaway-popcorn',
    title: 'The Runaway Popcorn',
    description: 'One tiny kernel dreams of a very big entrance.',
    duration: 42,
    artwork: 'popcorn',
  },
  {
    id: 'miso-and-the-moon',
    title: 'Miso and the Moon',
    description: 'A rooftop cat discovers that the moon has a playful side.',
    duration: 54,
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
];
export type CinemaSlot = {
  kind: 'opening' | 'film' | 'interval' | 'closing';
  start: number;
  end: number;
  film?: CinemaFilm;
  nextFilm?: CinemaFilm;
};

/** The UTC-based town day is the only seed: hosts, sessions, and reloads share a bill.
 * Registry order never changes the three selected films or their screening order.
 */
export function cinemaProgram(day: number, library: readonly CinemaFilm[] = CINEMA_FILMS) {
  if (
    library.length < 3 ||
    new Set(library.map((film) => film.id)).size !== library.length ||
    library.some((film) => !film.id || !Number.isFinite(film.duration) || film.duration <= 0)
  )
    throw new Error('Cinema needs at least three unique films with positive finite durations.');
  const films = [...library]
    .sort(
      (a, b) =>
        hash(`cinema:${Math.floor(day)}:${a.id}`) - hash(`cinema:${Math.floor(day)}:${b.id}`) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 3);
  const slots: CinemaSlot[] = [];
  let cursor = CINEMA_START;
  const add = (
    kind: CinemaSlot['kind'],
    duration: number,
    film?: CinemaFilm,
    nextFilm?: CinemaFilm,
  ) => {
    slots.push({
      kind,
      start: cursor,
      end: cursor + duration,
      ...(film ? { film } : {}),
      ...(nextFilm ? { nextFilm } : {}),
    });
    cursor += duration;
  };
  add('opening', CINEMA_CARD_SECONDS, undefined, films[0]);
  films.forEach((film, index) => {
    add('film', film.duration, film);
    if (index < films.length - 1) add('interval', CINEMA_CARD_SECONDS, undefined, films[index + 1]);
  });
  add('closing', CINEMA_CARD_SECONDS);
  if (cursor + 45 > 1800)
    throw new Error('The cinema bill must finish by 05:15 so guests can get home before morning.');
  return {
    day: Math.floor(day),
    films,
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
        hash(`cinema-guests:${day}:${a.id}`) - hash(`cinema-guests:${day}:${b.id}`) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, Math.min(CINEMA_SEATS.length, Math.floor(eligible.length / 2)))
    .map((home) => home.id);
}
