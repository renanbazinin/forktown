# Stargazing and the snowmen

Two quiet outings of the Riverside's year, both drawn from the town clock alone: stargazing on the Bandstand lawn on new-moon nights, and the snowmen built at lunch on the green in early winter. The program, the guest lists and the copy are in [Town events](TOWN_EVENTS.md); this page is about what they look like and how they behave.

## Stargazing by the river

On a new-moon night (season dates 27, 28 and 1, twelve a year) the Bandstand's lawn on K15 becomes a place to lie low and look up. "No moon tonight, so the sky is full. Rugs out, faces up." The outing runs 22:15–00:15 and, like the film, belongs to its evening: at 00:20 it is still last night's.

### The night, minute by minute

| Time         | What happens                                                                                                                                                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21:50        | The eight rugs unroll on the deckchairs' eight spots, one after another, half a minute apart, each over a minute and a half. A brass telescope fades in on the lawn's river side.                                                                                |
| 21:58        | The astronomer walks in from the riverside road and stops at the eyepiece at 22:00.                                                                                                                                                                              |
| 21:56 onward | Stargazers arrive (the earliest at 21:56), sit down on their rug facing the stand and the sky, and settle in.                                                                                                                                                    |
| 22:15–00:15  | The outing. The stargazers sit, and the two on each pair of rugs chat now and then. The astronomer takes turns at the eyepiece and a step back from it, pointing up at the sky over the river. On the three summer star nights a few slow meteors cross the sky. |
| 00:30        | The astronomer walks off along the eyepiece's row to the riverside road, fading for the last steps. The last stargazer has gone by 00:29.6.                                                                                                                      |
| 00:30–00:35  | The rugs roll themselves up in turn, and the telescope fades.                                                                                                                                                                                                    |

The Bandstand's peak lamp is not lit on a star night (the Bandstand's own art keeps it dark), so the only light on the lawn is the stars. Nothing here is amber, and nothing flashes.

### The stargazers

Up to eight night owls, seated first at night (see [Town events](TOWN_EVENTS.md)). Each sits on their own rug, facing `ne`, toward the stand and the sky over it. Nobody lies down: the town's figures have no lying pose, and the outing uses the poses there are.

- **Poses** (`starPose`, `src/lib/outings/stargazing.ts`). `sit`, and now and then `chat`. The two on each pair of rugs (seats 0 and 1, 2 and 3, 4 and 5, 6 and 7) share a nine-minute beat, seeded by the night: on one beat in three they talk for three minutes. A chat is only taken up when all of it fits between the first calm minute and the last, so every pose is held for a minute at least. The minute after sitting down and the minute before getting up are always a plain `sit`; the planner's own crouch leads into and out of the seat.
- **Rugs.** Plain wool tartans in four colourways (brick, slate, moss and oatmeal, the back row shifted two along so no column repeats), 0.52 × 0.42 tiles, with a fringe at each short end and a shade along the two edges toward the viewer. They are floor paint, so a sitter is always drawn on top. A rug unrolls along its length, its check showing as far as it has unrolled, with a fat roll of folded wool at the end still to go. On a snowy night (Winter 1, and late-winter nights before the thaw) each rug lies in a pale rim of snow. Two of the rugs (seats 1 and 6) have a flask and a cup at their back corner.

### The telescope and the astronomer

- **The telescope** stands at (60.82, 42.75), on the lawn's river side, east of the stand and more than a tile from every rug. It is a brass refractor on a wooden tripod, pointing up over the river, 24 pixels tall at most: three legs, a mount, the tube with its top edge catching the starlight, a dark dew shield and an eyepiece. Every colour is muted brass and wood, never lamplight.
- **The astronomer** is scenery, never counted and never named in the panel: silver hair, spectacles and a long navy coat. They walk in from the riverside road at 21:58 and are at the telescope 22:00–00:30, shifting between two stances, each held for minutes, a short step apart:
  - **At the eyepiece**: stooped, their back to the viewer, their head at the eyepiece (4 to 9 minutes).
  - **Pointing**: a step back, turned toward the rugs, one arm raised to the sky over the river (2 to 5 minutes).

  The turns are seeded by the night (`astronomer:${night}:${k}`), so every visitor sees the same night. They never stand on a rug or east of the riverside road, walk no faster than a neighbour's stroll, and fade over 0.6 minutes on the road only.

### The summer meteors

On the summer star nights only (Summer 27, Summer 28 and Autumn 1), three slow meteors cross the sky, one in each of 22:30–22:49, 23:05–23:24 and 23:40–23:59, each at its own seeded place (`meteor:${night}:${k}`). A meteor is in the sky for 2.6 town minutes, which are 2.6 real seconds: a 40-pixel cool-white streak (`#E6F0F2`, a little bluer than the stars' cream) whose head glides down and across at 25° for 70 pixels, brightening and fading on a slow swell (`sin²`), so it is never a flash. Its alpha changes by under 0.04 a frame at 30 frames a second. It is drawn in whole pixels like the stars, a bright 2 × 2 head and a fading tail of 1-pixel steps, in the sky layer: the hills and the town stand in front of it, and it always stays in the top 18% of the screen, above the highest hill. On a phone it is a little smaller, by the sun's own size rule.

The meteors live in the sky, and the Bandstand's frame shows only lawn and river, so they are seen in the wider views of the town at night: the whole town, the opening frame, the postcard shots.

### The panel note

On a star night the Bandstand's panel holds the stargazing note: `NEW MOON · THE BANDSTAND LAWN`, "Stargazing by the river.", the night's description, and one line for the moment:

- Before the outing: "Rugs out on the lawn from 22:15 to 00:15. An astronomer brings a brass telescope."
- During it, who is out on the rugs, by name while they are there: "Ada is out on the rugs.", "Ada and Sol are out on the rugs.", or "3 neighbors are out on the rugs." With nobody there: "Rugs out on the lawn from 22:15 to 00:15. The sky is dark."
- After it: "The rugs are rolled up for tonight. They come out again tomorrow night." or "…on Autumn 27." for the next new moon.

On the three summer star nights it adds "On a summer new moon a few slow meteors cross the sky. Keep looking up." The note never counts the astronomer and never promises a crowd.

## Snowmen on the Lunch Green

On Winter 3, 7, 11 and 15 the lunch on the green (C5) builds a snowman, one each build day, so the green has one snowman after Winter 3, two after Winter 7 and four after Winter 15. They stand until the thaw.

### Building

- **Builders** (lunch seats 0 and 1, `snowmenBuilderPose`). From 14:00 to 15:45 each works in spells of 4 to 8 minutes, seeded by the day and the seat: down on their knees rolling and patting snow (`crouch`), then up on their feet packing snow (`play`), turn and turn about. Every spell starts and ends on the knees, so a builder goes from sitting to building and back by way of the crouch, never in one frame.
- **Watchers** (seats 2–5, `snowmenWatcherPose`). They sit on their blankets and chat now and then while the snowman goes up (the two on each side of the green share an eight-minute beat and talk for two and a half minutes on every other one). They are up on their feet, cheering, as the head goes on (15:15, a minute and a half) and when the snowman gets its face and scarf (15:45, two minutes), in a ripple along the seats. No chat starts within a minute of a cheer.
- **The rest of the lunch.** On a build day both functions answer for the whole lunch: before 14:00 and after the building everyone sits. The poses only see the seat, the minute and the day, never the guest's own lunch beat, so taking the whole lunch is what keeps every pose held for a minute at least, the switch at 14:00 included.

### The snowman

Snowman k stands at spot k, in tiles from the green's centre (19.5, 11.5): (1.15, −0.45), (0.2, −1.1), (1.4, 0.45) and (−0.6, −1.15). Each is at least 0.85 tiles from every lunch seat and 0.75 from the lane at x −1.35, clear of the stepping stones, on the green's back lawn. The one at (0.2, −1.1) stands behind the lemonade table and its bunting, which stand in front of it.

- **Look.** Three balls of snow, 10, 8 and 6 pixels across, each sitting a little into the one below, 21 pixels tall in all. They are the colour of the snow on the roofs (`SNOW.top`), by day and by night. One fill paints all three, and that fill's own hard shadow, one world pixel down and to the right in a cool grey, gives each ball its shaded edge and the base its foothold on the lawn. A wool scarf at the neck, a carrot nose pointing the way it looks (two look left, two right), and two coal eyes. Nine canvas calls a snowman, so four stay within the cap of 40; below zoom 0.6 the face is under a pixel and is left out.
- **Rolled up ball by ball** on its build day (`snowmanShape`, pure in the day and the minute, from `snowmanState`): the base from 14:00, the body from 14:40, the head from 15:15, each starting as a snowball a third of its size and growing to full size over 40, 35 and 25 minutes. The scarf, the carrot and the eyes go on at 15:45.
- **Scarves.** Muted wool, never amber: brick, moss, slate, plum or teal. Snowman k's colour comes from `snowman:${day}` of its own build day, or the next colour along that no earlier snowman of the winter is wearing, so the four never match.
- **The thaw.** Snowman k melts over 1.2 days from Winter 24–26 (`snowmanState`). As it melts it sags, shrinks to 40% and leans to its own side (each ball tilting with it). At melt 0.7 its head is gone, and the carrot lies on the grass beside it; the scarf stays on the body. The last of the lump fades as it goes, and then the carrot and the scarf lie on the grass for half a day more. All are gone by the end of Winter 27 (the last at 21:48), so every spring starts clear.

### The panel line

The green's panel adds one line while any snowman stands (finished and not yet melted away): "Snowmen on the green: 3. They stay until the thaw." It is history, not a score: it says how many are there, and nothing before the first is dressed or after the last has gone. A half-rolled snowman is not counted, nor the carrot and scarf left on the grass.

## Budgets and rules

| Art                                                                                | Cap       | Measured    |
| ---------------------------------------------------------------------------------- | --------- | ----------- |
| Stargazing props (rugs, flasks, telescope, astronomer), at full detail and in view | 300 calls | 177 at most |
| Four snowmen                                                                       | 40 calls  | 37 at most  |

- **Cached.** The rugs (once all eight are flat) and the telescope do not change while they are out, so in a browser each is painted once into a sprite at the canvas's own scale, by its look (night, snow, detail), and copied after that. A new zoom is painted into the sprite only once it has held for six frames, so a pinch draws directly. Without a document (the tests) everything is drawn directly, which is what the caps measure.
- **Off-screen**, every part is skipped by `scene.visible`, and both painters return nothing.
- **No amber**, anywhere: rugs, brass, the astronomer, snow, scarves, the carrot and the meteors.
- **No flashing.** Meteors, the telescope's fade and the astronomer's fade change alpha by at most 0.08 a frame; the rugs unroll rather than fade.
- **Determinism.** Everything runs on the town clock and hash seeds: no `Math.random`, `Date` or `performance.now`.

## Files

- `src/lib/outings/stargazing.ts`: `starPose`.
- `src/lib/outings/snowmen.ts`: `snowmenBuilderPose`, `snowmenWatcherPose`, `builderSpells`, `snowmenStanding`.
- `src/city/district/stargazing.ts`: the rugs (floor), the flasks, the telescope and the astronomer (objects), their sprites.
- `src/city/sky-extras.ts`: the summer meteors (`drawSkyExtras`, the stargazing painter's `sky`).
- `src/city/district/snowmen.ts`: the snowmen, `snowmanShape`.
- `src/components/district/StargazingNote.tsx`, `src/components/district/GreenNote.tsx`: the panel lines.
- `tests/stargazing.test.ts`, `tests/snowmen.test.ts`, `tests/district-render-stars.test.ts`: poses held a minute, the astronomer's walk and fades, the meteors frame by frame on every summer star night, the snowmen's stages, sizes, thaw and scarves, the panel lines, the caps at every moment they are out, heights, depths, colours and the sprites.
- `tests/manual/district-stars.ts`, `tests/manual/district-snowmen.ts`: the moments to check by eye in `tests/manual/district.html`.
