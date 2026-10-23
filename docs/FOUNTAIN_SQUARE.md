# Fountain Square

Four public plots, **D8, D9, E8 and E9**, are paved as one square round a stone fountain, just east of the Starlight Cinema across road x = 29. The square's inner roads (x = 33 and y = 17) are gone; the roads round it stay, with every lamp. The four plots are excluded from the builder and contribution validation, which leaves 226 house plots. Open `#venue=square` (or `#venue=fountain`) to visit it.

The square keeps a secret: see [Town secrets](TOWN_SECRETS.md#fountain-square). This page describes both.

## The square

- **Paving.** A kerb, a border of rose bricks set on end, a light stone band and a field of half-tile flags in two close tones. Round the fountain there is a darker edging ring, three rings of small setts and a grey stone ring against the basin. It is painted into the cached ground layer (`drawSquareGround` in `src/city/square.ts`): about 80 canvas calls at whole-town zoom, up to about 235 close up, where the joints appear.
- **The fountain** (`FOUNTAIN`, set back from the middle at (32.8, 16.8)): a round stone basin whose rim is a seat, a plinth, a column and an upper dish that spills ten streams, with a small jet on top. The water moves with the town minute and fades in and out, so nothing pops. It runs all year; at night it keeps a faint cool glint, never amber. It stands 65 px tall at zoom 1, low enough to hide nothing.
- **Furniture.** Two benches on the back edges, oak slats on green iron, facing into the square (`SQUARE_BENCHES`). Three round planters (`SQUARE_PLANTERS`): a town tree at the back corner that blossoms in spring and turns ochre then russet in autumn, and flowers at the side corners, replanted a day or two into each season (never yellow).
- **The year.** Frost and small snow piles against the kerbs, snow on the rim, the benches and the planters in winter; leaves blowing in from Autumn 13 until the first snow. Everything has a night palette.
- **Selecting.** Anywhere on the paving, or the fountain, a bench or a planter, selects the square. Its panel (`src/components/SquareInfo.tsx`, words in `src/lib/square-copy.ts`) describes the fountain, and says something is happening only while it is.

## The flash mob

On every **even date** of every season (Spring 2, 4 … 28, and so on: one town day in two, every 48 real minutes), at **17:00 town time**, up to twelve neighbors dance a flash mob on the square. Nothing announces it.

### Who dances

- Afternoon strollers only. Anyone whose afternoon routine is `work` or `home` stays at home, as always.
- The planner seats the mob after the festivals (the regatta and the Harvest Fair) and before the day's other afternoon calls, on the hash line `flash-mob:${day}`, all(12). A dancer skips everything else that afternoon: the lunch, the zoo, the football, skating and the teatime set seat others.
- A dancer must be lingering on the square by 16:58 and stay until the end; one who can't passes their place down the line.
- Dancers may stay out until **20:00**, past the end of an afternoon stroll, so the whole dance fits (`eventWindow` in `resident-trips.ts`). They walk home and step in through their own door, as at the end of any stroll (`runsWith` in `simulation.ts`), before lantern hour. A dancer who strolls in the evening too keeps their evening window and may get home later; they skip the Bandstand's sundown set that day.
- In the real town of 59 houses every even date measured has all twelve dancers. They arrive between 16:39 and 16:55.

### The afternoon, minute by minute

The mob dances to its own beat: 120 beats a minute, so two beats to every town minute (`src/lib/flash-mob-beat.ts`). The dance and the music change on the same 16-beat phrases.

| Town time   | Beats   | What happens                                                                                                                                                                                                                                                         |
| ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16:39–16:55 | —       | Dancers drift in one by one and linger like anyone else: by the flowers, on the fountain's rim, on the benches (one with a cup of tea), under the tree, watching the water. Standing ones glance about now and then. Seat 0 waits at the front, facing the fountain. |
| 17:00       | 0–16    | Seat 0 turns to the viewer and starts to groove alone.                                                                                                                                                                                                               |
| 17:08       | 16–40   | The others join, two beats apart: each gets up, dashes into their place in the arrow and grooves.                                                                                                                                                                    |
| 17:20       | 40–56   | Clap on every beat.                                                                                                                                                                                                                                                  |
| 17:28       | 56–72   | Point, thrown to one side and the other on alternate beats.                                                                                                                                                                                                          |
| 17:36       | 72–88   | Groove.                                                                                                                                                                                                                                                              |
| 17:44       | 88–104  | The wave: arms go up across the arrow half a beat apart, then sway.                                                                                                                                                                                                  |
| 17:52       | 104–120 | Spin: a quarter turn every beat.                                                                                                                                                                                                                                     |
| 18:00       | 120–136 | Jump, every other beat.                                                                                                                                                                                                                                              |
| 18:08       | 136–168 | The finale: claps with four sweeps of raised arms across the arrow and back, jumps, claps, then a jump on every beat.                                                                                                                                                |
| 18:24       | 168–176 | One last hit, and everyone holds the final pose in silence.                                                                                                                                                                                                          |
| 18:28       | 176–    | Arms down, as if nothing happened. A moment later everyone strolls back to where they lingered (each set off so nobody passes too close), and from 18:31 they walk home.                                                                                             |

The dancers stand in an arrow pointing at the viewer (`FLASH_MOB_SPOTS`), its tip at the square's front corner and the fountain behind. It fills from the tip, so any number of dancers stands in a balanced shape. Every frame is a pure function of the seat, the minute and the day (`flashMobFrame` in `src/lib/flash-mob.ts`): walks round the fountain, quarter turns only, every pose held a moment, every move on the beat or the half beat so it reads at 15 frames a second. The seven moves (`groove`, `clap`, `point`, `wave`, `spin`, `jump`, `tada`) are drawn in `src/city/residents.ts`; `tests/manual/residents.html` shows them in every facing.

While they dance, a dancer's card says "Dancing in a flash mob". Before and after, it says "Enjoying Fountain Square" or "Out for a stroll".

### Music

Four records, one for each week of the season (and quarter of the moon): **Nothing to See Here** on dates 2–6, **Somebody Brought a Tuba** on 8–14, **Moon in the Fountain** on 16–20 and **Thin Moon Disco** on 22–28. Each is 90 seconds at 120 BPM, written beat for beat to the same dance, played in step with the clock and heard only near the square. See [Music](MUSIC.md#fountain-square). A day with no dancers stays silent.

### On the live stream

On a day with dancers the director cuts to the square at 16:57 and holds it until 18:32 (`FLASH_MOB_SHOT`), after the festivals and before the day's own events (it only ever meets the zoo's last three minutes). Dancers can be followed at any other time. Breaks never cover that window on an even date, and "Coming up in Forktown." never bills it. See [Forktown Live](LIVE.md).

## Code

- `src/lib/square.ts`: the site, the fountain and furniture, the dancers' spots, where they linger and their ways in, the mob's dates and times, and `squareListening`.
- `src/lib/flash-mob-beat.ts`: the beat and the cues, shared by the dance, the art and the music (it imports nothing, so the music worker can use it).
- `src/lib/flash-mob.ts`: the choreography. `src/lib/resident-trips.ts` seats the dancers (`flashMobVisit`, `flashMobDancers`) and hands each frame to `tripState`.
- `src/city/square.ts`: the art. `src/music/flash-mob-track.ts` and `flash-mob-player.ts`: the music.

Locally, `npm run dev` shows it live whenever the town clock reads 17:00 on an even date (the almanac shows the date). `tests/manual/residents.html` shows the moves in every facing, and `tests/manual/music.html` plays the track on a pretend clock from 16:59:58 or any part of the dance.
