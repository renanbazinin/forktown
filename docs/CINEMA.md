# The Starlight Cinema

Four public plots, **D6, D7, E6, E7**, form a single outdoor cinema near the Lunch Green. The internal streets and lamps are removed, while the perimeter roads remain connected. Existing homes stay at their original addresses. These four plots are excluded from the builder and contribution validation.

The venue has a large isometric screen, twelve picnic rugs, soft string lights, a projector and a popcorn stand. At 20:00 the screen rises smoothly from its ground cassette over six real seconds, displaying the Forktown cinema ident before the show. After the closing card, it rolls back down over six seconds and stays tucked away during the day. It is always stowed by sunrise. Open the events menu or `#venue=cinema` to visit it and read tonight's bill.

## The library

Sixteen original films: six classics and the ten-film **Starlight Reel**.

| Film                    | Length | Story                                                                                     |
| ----------------------- | ------ | ----------------------------------------------------------------------------------------- |
| The Runaway Popcorn     | 42 s   | A kernel escapes a rattling pot and finds its place in a popcorn bucket.                  |
| Miso and the Moon       | 54 s   | Miso climbs a cloud staircase toward a playful moon.                                      |
| The Last Duckling       | 60 s   | A butterfly distracts a duckling; a hurried chase reunites the family.                    |
| The Tiny Grand Prix     | 60 s   | Three beetles race bottle-cap cars until the mop arrives.                                 |
| Duel at Dusk            | 60 s   | Two swords cross on a castle bridge; only one feather falls.                              |
| Visitors over Forktown  | 60 s   | A flying saucer takes three night owls on an unexpected trip.                             |
| Hello, Downstream       | 60 s   | A paper boat marked "HELLO?" travels through town and out to sea, and someone replies.    |
| Mail for the Anglerfish | 60 s   | The deep-sea postman finally writes a letter to the fish who lights his way.              |
| The Rain Orchestra      | 60 s   | Leaks become notes, a street becomes a band, and the last drop finishes the tune.         |
| Cardboard Rocket        | 60 s   | Dinner keeps calling Nova home from the Moon, until her dad climbs into the box too.      |
| The Great Pie Heist     | 60 s   | A raccoon's three-step plan fails spectacularly, and the baker sets out an extra plate.   |
| Boo, Politely           | 60 s   | A shy ghost fails to scare off the new family, and becomes the daughter's night-light.    |
| Bolt and the Bloom      | 60 s   | A sweeping robot shelters the city's only sprout, and the flower brings everything back.  |
| The Sleeper Train       | 60 s   | A young fox fights sleep to see the sea at sunrise; the conductor wakes him just in time. |
| The Mitten              | 60 s   | The old winter tale: one lost mitten, five guests, and a single snowflake.                |
| Lanterns on the Cliff   | 60 s   | The lighthouse goes dark in a storm, so every house brings its lantern to the cliff.      |

These are original canvas animations with their own title and end cards, original scores, and sound effects, all rendered locally. No video downloads, external embeds, accounts, or remote services are needed. Turn on town sound and zoom into the screen to hear a film; the soundtrack is rendered in a worker and follows the screen, so seeking, reloading, and late arrivals stay in sync.

## Each night's program

The show starts at **20:30 town time**. One town minute equals one real second. A bill is three films plus a six-second opening, two six-second intermissions, and a six-second closing. The cards display the Forktown logo and next title.

Each town day chooses exactly three distinct films in a seeded order. The selection is independent of the order of the library, and everyone sees the same movie at the same moment. Adding more titles changes the pool; it does not increase the number of films per night. Every film retains its own duration. The program's end and audience departure are calculated from the selected films, without truncating or stretching them.

**No film may run longer than 60 seconds.** Any three films then finish by 23:54, and the screen is stowed before midnight. The Little Stage's night party, resident bedtimes, and the live director's night coverage all rely on that. The tests check it against the three longest films in the library.

Half the residents who chose both an evening stroll and a night out can attend, up to twelve. They walk in along the perimeter and side aisle and sit facing the screen. Afterward, selected disco guests can walk straight to the Little Stage if they can still dance for at least fifteen town minutes and get home before their own bedtime. Otherwise they walk home. Free time before bedtime can include moonlit walks and doorstep breaks. Residents with earlier bedtimes may leave the screening early to allow a full walk home; film playback is unchanged. Sleeping residents are never woken. The show runs even with no audience.

Cinema joins the live director's pool of possible daily highlights. When selected, the camera covers the complete program, including intermissions, before moving on. It does not count as an extra fourth highlight.

## The Starlight Reel

Each reel film is a self-contained module in `src/films/` that exports its pictures, its score, and its title-card look (`FilmModule` in `src/films/types.ts`), registered in `src/films/index.ts`. The classics keep their original drawings in `src/city/cinema-films.ts`.

- **`src/films/kit.ts`** is the drawing kit. It has pixel primitives, dithered skies, soft light, vignettes, fades and irises, rain, snow, and stars. It also provides captions and intertitles, and `person()`, a townsperson with expressions, poses, a walk cycle, and hats. `camera()` and `track()` handle eased camera keyframes, pushes, pans, and hard cuts. `titles()` draws the reel's opening card over the first frame and "The End" over the last, with each film's own dedication.
- **`src/films/score-kit.ts`** composes a film's score. `section()` lays down underscore for one act, with its own tempo, key, harmony, instrument, and groove. `note`, `chord`, and `fx` place individual cues. The reel's sound effects are synthesized in `src/music/cinema-render.ts`.
- **Loading.** Each film also exports its score on its own, collected in `src/films/scores.ts`. The audio worker imports only that registry, so its bundle carries no drawing code. The pictures are a separate chunk: `loadReel()` in `src/city/cinema-films.ts` fetches them as the screen starts to rise at 20:00. A visitor who arrives mid-film sees a brief "threading the projector" card until they arrive; a daytime visit never downloads them.
- **Story beats are shared.** A film's drawing and its score read the same timing constants, so sound lands on the picture. In _The Rain Orchestra_, every drip is a bell note: the drops, the containers they land in, and the notes they play come from one list.

## Add another film

1. Add a unique entry to `CINEMA_FILMS` in `src/lib/cinema.ts`, with a title, description, duration of at most 60 real seconds, and artwork key. The first and last three seconds are title and end cards; the story plays in between.
2. Add the key to `ReelArtwork`, create `src/films/<your-film>.ts` exporting a `FilmModule` and its score function, and register them in `src/films/index.ts` and `src/films/scores.ts`. Start from _The Rain Orchestra_ as a reference for structure, shots, and sound.
3. Draw from the supplied story time (`p`, 0 to 1) and the film's own clock, never from wall-clock state or unseeded randomness (use `rand(seed)`), so pausing, reloads, and late arrivals stay in sync. Keep art inside the 320 × 180 screen, avoid remote assets and flashing effects, and keep each frame under about 3,000 canvas calls.
4. Run `npm run check`, then watch the film in `tests/manual/cinema-films.html` with sound, and in context in `tests/manual/cinema.html`, including its first frame, ending, and the next film's start.

The cinema preview offers the full nightly bill, individual film starts, intermissions, screen raising and lowering, a daytime view, a screen close-up, and an optional simulated audience. Its controls never change the live town clock or saved resident routines. The film library page plays every film with its soundtrack and a scrubber.
