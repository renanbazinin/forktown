# The turning year

The town's calendar has always named its seasons. Now the scenery keeps them too. Blossom opens in spring and its petals drift onto the paths. Fireflies come out on summer nights. The trees turn ochre and russet, let go and stand bare, and pumpkins wait on doorsteps. Then the first snow settles on the roofs, the trees and the far ridge, and in time it thaws, roof by roof.

A season is 28 town days, about 11 real hours, so a visitor who comes back tomorrow finds the town a little further through its year. Everyone who visits at the same moment finds the same one. None of it asks for attention.

## Quiet on purpose

- **Subtle.** The year changes colours and adds a few pixels. It never moves a building, and its strongest wash over the town is 0.055 alpha.
- **On top, never instead.** Seasonal art rests on a neighbor's choices and never recolours them. Snow lies on part of a roof and leaves the lower courses and the gable end in the colour the neighbor chose. A pumpkin sits beside the door. Walls, trim, windows, signs and lanterns keep their colours.
- **Only on the map.** `drawHouse` takes a season only from the map's `life`, and the builder preview passes none, so a house is always designed in its neighbor's own colours. The pieces that take a season take it as an optional argument, and without one each draws what it drew before the turning year.
- **The Fork stays evergreen.** The Lantern Fork's canopy keeps its leaves all year, so the lanterns always hang in green. The year only lends it pale blossom on one dapple in three in spring, one dapple in four turned ochre or russet late in autumn, and snow on the tops of its lobes.
- **Amber stays with light.** Autumn is ochre and russet, never amber. Fireflies are green-gold and never use the glow sprite. Pumpkins are painted fruit and never glow. Snow is slightly cool (`#EEF2EC`), never the paper-lantern cream. See [the amber budget](BRAND.md#the-amber-budget).

## A year of small schedules

`yearDayAt` turns the town day and minute into a day of the year: 0 at Spring 1, 00:00, wrapping after Winter 28. Each tree, roof, doorstep, lamp and meadow flower keeps its own schedule from a stable seed. So a change arrives over a few town days, an hour or two of real time, and never all at once at midnight. The dates below are the range those schedules span, in town time.

Round crowns are broadleaves, and 45% of them flower. One conifer in four is a larch, which turns gold and drops its needles. The rest are evergreens and only ever carry snow. The trees inside the street grid are all conifers, so the larches carry autumn into the inner streets.

## Spring

- **Spring 1–6, leaf-out.** Every broadleaf and larch starts the year bare. Each leafs out over two town days, starting between Spring 1, 14:24 and Spring 4, 02:24, so the whole town is in leaf by Spring 7. The new leaves are a step lighter (`FOLIAGE.fresh`) and settle into summer green over Spring 7–14.
- **Spring 2–8, blossom.** Each flowering tree opens over a day and a half, starting between Spring 2 and Spring 6. From Spring 8 to Spring 14 every one is in full bloom: four to seven clumps of pink, white and deeper pink, with a blush on the lit side of the crown.
- **Spring 15–24, petals.** Each flowering tree sheds over four town days, starting between Spring 15 and Spring 20. Up to three petals drift down at a time, looping on the town clock like chimney smoke, and a few settle under the crown. They are gone between Spring 26 and the end of Spring 28. On the lawns, about one grass tuft in fourteen carries a pale petal for a week or so between Spring 16 and Spring 27.
- **Meadows.** The wildflowers on open plots begin the year as last year's dry heads for up to four days, then open white, pink, lilac and green bud. They return to the meadow's own summer colours between Spring 26 and Summer 3.
- **The farm.** Grain is sown between Spring 4 and Spring 8, and its green shoots grow a step every three days. Greens start as small seedlings until Spring 6–13. The pumpkin patch sprouts over Spring 3–8, runs to vine, and flowers butter-yellow from Spring 19–24.
- **The millpond.** New reed shoots come up through last year's straw, and the beds are green from Spring 13. The two rowboats come off the west bank to wait at the jetty on Spring 10. Blossom petals float on the water from Spring 15 to Spring 27, and lily pads open, each on its own day between Spring 21 and Spring 28. See [The Millpond](MILLPOND.md).

## Summer

- **Summer green.** From Summer 1 every crown wears the palette's own summer leaves, exactly as the town did before the turning year.
- **Fireflies, 20:12–05:20.** On summer nights fireflies thicken over the 30 town minutes after 20:12 and thin over the 50 before 05:20. Across the season they gather from Summer 1, 12:00 to Summer 4, 12:00 and thin from Summer 25, 12:00 to Summer 28, 12:00. Each firefly has its own threshold, so the count swells and thins smoothly.
- **Where they fly.** Small swarms of up to six hover over grass: beside the plots over meadows and lawns, under the edge trees on the two far sides, and low over the river and its far bank. Five more hover over the Millpond's reed beds and the water beside them. Roads, venues, the zoo, the farm, the pitch and the cinema stay dark. Each firefly hovers 4–18 pixels up and drifts a few pixels. It blinks for 55% of its own two-to-five-minute period: a quick brightening, a steady glow, then two fading steps. Four in five have a 2 × 2 core. The core is `#EEF6B2` with a faint `#C4DE7C` halo at 0.4 of the blink. Each swarm is a depth object, so the houses and trees in front of it hide it.
- **The farm.** Small green pumpkins set between Summer 1 and Summer 5 and swell from Summer 13–18. The grain turns gold over six days, starting between Summer 13 and Summer 21. The pumpkins ripen to orange over four days, starting between Summer 23 and Autumn 2.
- **The millpond.** From Summer 1 to Autumn 6 the rowboats go out, 08:30–18:30. About one lily pad in three flowers pink, opening between Summer 3 and Summer 8 and going by Summer 19–26. Cattails stand in the reeds from Summer 8, and on summer nights the reed beds have their own fireflies.

## Autumn

- **Autumn 2–11, the turn.** Each broadleaf turns over two and a half town days, about an hour of real time, starting between Autumn 2 and Autumn 8. Every tree has turned by Autumn 12. A broadleaf keeps one of three autumns: ochre throughout, ochre deepening to russet, or russet deepening to rust. Larches turn gold (`FOLIAGE.larch`).
- **Autumn 9–21, deepening.** Starting between Autumn 9 and Autumn 13, each crown moves from its first autumn colour to its last over eight town days.
- **Autumn 13–28, leaf fall.** Each tree lets go over ten town days, starting between Autumn 13 and Autumn 18, busiest halfway through. Broadleaves drop up to two tumbling leaves at a time; a larch's needles fall without drifting. A small carpet gathers under each crown from the day after its fall begins and is complete six days later. On the lawns, up to four tufts in ten become fallen-leaf flecks, each from its own day between Autumn 14 and Autumn 23, as the trees let go, until the snow covers them.
- **Autumn 24 – Winter 2, bare crowns.** Each crown goes dormant over three town days, starting between Autumn 24 and Autumn 27. It fades to a haze of twigs (`FOLIAGE.dormant`), with its trunk and forked limbs showing through, darker at night, and stays bare until spring. The zoo's broadleaves go bare the same way.
- **Pumpkins.** A little under half the houses set a pumpkin on the doorstep, right of the door: A2, B2, C2, C3, C6, G6 and Q3 today. Each comes out on its own day between Autumn 5 and Autumn 11, and goes in the moment that roof's first snow begins. In vegetable gardens, two beds ripen into pumpkins on their own days from Autumn 3 to Autumn 7, and sometimes a third where no pumpkin waits on the doorstep. They are picked when the snow settles on that roof. Two small pumpkins keep the Fork's plaque company from Autumn 6 and Autumn 8, and go in on Winter 1 before the snow reaches the Fork itself. Every pumpkin follows one rule, `firstSnowAt`, so none is ever left out in the snow except the farm's two forgotten ones.
- **Meadows.** Between Autumn 3 and Autumn 12 each flower dries to a seed head: straw, soft ochre, muted russet or dormant brown, on a straw-coloured stem.
- **The farm.** The grain is cut to stubble row by row over Autumn 15–22, and the stubble stands through winter. The pumpkin vines wither to olive-brown over four days, starting between Autumn 15 and Autumn 22.
- **The millpond.** The reeds turn to straw from Autumn 3. Lily pads go, each on its own day between Autumn 11 and Autumn 21, and the rowboats are turned over on the west bank on Autumn 21. From Autumn 14 fallen leaves land on the water, each on its own day, and drift in to gather along the banks. They are gone by Winter 2.
- **The light.** A faint russet wash (`#C48A62` by day, `#7E6152` by night) eases in over Autumn 7–14, to at most 0.018 alpha by day and 0.012 by night. It fades over Autumn 27 – Winter 1, as winter's cooler wash takes over.

## Winter

- **Winter 1, the first snow.** Snow falls on Winter 1 every year. It thickens from midnight, peaks at 19:12 and has stopped by Winter 2, 14:24. While it falls, each roof, tree and streetlamp gathers its own snow, and each lantern post takes its house's. Each starts to settle between Winter 1, 03:36 and Winter 2, 08:24, and a roof's snow fades in over six real minutes. The town-wide cover, which drives the winter light and the far ridge, builds from Winter 1, 03:36 to Winter 2, 14:24.
- **What the snow touches.** On a gable roof it covers the top two courses and the far slope. A flat roof takes an inset field inside a rim of roof colour, and a studio's skylight stays clear. A dome takes a cap on its crown and snow on the deck, and the telescope stands over both. Snow also lies on chimney caps beside the warm flue, porch roofs, mailbox tops, decoration conifers, the crook of each lantern post and the hood of each streetlamp. Round crowns hold it on their upward ledges. Conifers take a cap and their needles pale a little, so even the small pines of the inner streets read as snowy; the larger pines at the edge of town also hold small clumps just inside each tier's slopes. The Fork carries it on the top of each lobe, the zoo's trees along their tops and ledges, and the scarecrow on its hat, and the lamps and the hat fade in and out like the roofs.
- **The ground.** The cached ground reads only the whole day, and it reads the snow as it was at that day's first minute. So the lawns whiten a town day at a time, at midnight, from Winter 2: the morning after the roofs, and never before a flake has fallen. The tufts frost over (`SNOW.frost`), and almost a fifth gather a small drift. Meadow heads keep a cap of frost, and a third lose theirs to the snow. The farm field frosts, its furrows fill with snow row by row, and just over half the greens stay out under frost. The pumpkin patch is cleared but for two forgotten pumpkins under snow caps. From Winter 4–9 until Winter 19–23 the river's glints turn to ice (`SNOW.ice`), tile by tile. The Millpond freezes and thaws on the same days: it is part-frozen while some of the river's tiles are ice, and frozen hard while every tile is.
- **Winter 3–22, flurries.** After the first snow, about one winter day in four has a quiet flurry. It begins between 06:00 and 17:00, thickens over 40 town minutes and lasts about five town hours, at 0.7 of the first snow's strength. Flurry days are seeded by the absolute day, so each winter falls differently. Later flurries add no snow; the cover only builds during the first snow.
- **Falling snow.** Flakes fall in screen space, in front of the town: 60 per 1440 × 900 screen at full strength, scaled by screen area and capped at 110. Most are 2 × 2 and one in four is 1 × 1, in `#F7F8F3` by day and `#CBD7D6` by night, at 0.55–0.8 alpha. They fall 24–45 pixels per town minute and lean gently left. They follow the absolute town minute, so nothing jumps at midnight.
- **The light.** A cool, pale wash (`#E8F0F0` by day, `#9DB3B8` by night) follows the snow cover, at most 0.055 alpha by day and 0.04 by night.
- **The millpond.** Ice grows in from the banks over Winter 4–8, and from Winter 9 to Winter 19 the pond is frozen hard, with snow lying on it in patches. On those afternoons some strollers skate, from just before 14:00 until 16:40. The heron stays through the freezing and thawing days, resting by the ice without hunting, and is away only while the pond is frozen hard. Over Winter 20–23 it breaks into shrinking floes, and Winter 24 is open water again. The reeds pale to winter straw from Winter 1, and snow settles on the mill roof and the jetty posts with the roofs of the town.
- **Winter 24–28, the thaw.** Each roof, tree and streetlamp thaws at its own moment during Winter 24–27, and a roof's snow fades over about 14 real minutes. Every roof, tree and lamp is clear by Winter 28, 14:24, and Spring 1 always starts clean. The lawns melt tuft by tuft over the same days, and no snow falls after Winter 22.

## Beyond the edges

The 18 far trees beyond the back edges keep the year from the whole day, like the rest of the ground cache. One in five is a pine and stays green. The rest show fresh leaves in early spring, ochre deepening to russet in autumn, and bare twigs through the winter. Every mix is partial, so they stay as hazy as the fields. In winter each far tree, pines too, takes a frosted top.

The far ridge keeps winter too. As the town's snow cover builds, a snow line comes down from the summits over the top three-tenths of the ridge's rise, and it lifts again with the thaw. The snow is painted as opaque rects in the hill's own colour, mixed toward snow, with a foot ragged two rows up or down. So it arrives and leaves by colour, never by alpha. The mix reaches 0.8 by day and only 0.16 by night, and at golden hour the snow takes the low sun's warmth. Each of the three sister forks gets a line of snow along its roofs and on its canopy. Their lanterns and windows light exactly as before. The near ridge stays clear. See [The far side](THE_FAR_SIDE.md).

## The almanac line

The **Town Almanac** now carries one short line under its heading: what a visitor can find in town that day. `SEASON_NOTES` splits the year into fourteen stages. Each stage starts at midnight and is read from the almanac's own date, so the line turns with the date and never changes during a day. The line is roman, as the town speaking, in `--muted` by day and `--dusk-muted` at night.

| Days                 | Line                                    |
| -------------------- | --------------------------------------- |
| Spring 1–4           | The first green on bare branches.       |
| Spring 5–19          | Blossom on the branches.                |
| Spring 20–26         | Petals on the paths.                    |
| Spring 27–28         | Everything in leaf.                     |
| Summer 1–2           | Long days ahead.                        |
| Summer 3–25          | Fireflies after dark.                   |
| Summer 26 – Autumn 2 | The last warm nights.                   |
| Autumn 3–6           | The first leaves are turning.           |
| Autumn 7–15          | Ochre trees and pumpkins on the steps.  |
| Autumn 16–22         | Russet trees and pumpkins on the steps. |
| Autumn 23–28         | Leaves on the lawns.                    |
| Winter 1–2           | The first snow.                         |
| Winter 3–23          | Snow on the rooftops.                   |
| Winter 24–28         | The thaw.                               |

The last warm nights run two days into autumn, because no tree has visibly turned before Autumn 3. No line mentions amber, gold, glow or lanterns. The almanac's footer now reads "24 real minutes in a day. Four 28-day seasons, each about 11 real hours."

## Performance

- `renderCity` takes one `townSeasonAt` snapshot per frame, from the same day and minute as the sky.
- The tufts, river glints, meadows, farm and far trees live in the ground cache and read only `season.groundDay`, the whole day of the year. It is part of `groundKey`, so the seasons repaint the cached layer at most once per town day, every 24 real minutes, on top of the usual camera, viewport and lighting changes.
- The tufts and glints change only colour and size, so they add no calls. The meadows never draw more than before the turning year (13,858 calls over every plot, 11,158 in deep winter). Neither does the farm's ground (1,529 at most, 805–809 in winter); the scarecrow's snowy hat adds 2 calls a frame. The far fields stay at 51 calls in every season, because a far tree sets its colour only when it changes.
- The sky stays within its budget. In winter, the ridge snow and the sister forks' roofs add up to 57 draw calls, 213 of the 400 allowed at 1440 × 900. They add no path vertices (656 of 800).

The largest change to one frame, measured with the recording context in the opening view at 1440 × 900 (camera 720, 88, zoom 0.7):

| Per frame                         | Spring | Summer | Autumn | Winter |
| --------------------------------- | ------ | ------ | ------ | ------ |
| Town trees (83 in view)           | +141   | 0      | +259   | +552   |
| Houses and lantern posts (all 18) | 0      | 0      | +51    | +288   |
| Fireflies                         | 0      | +316   | 0      | 0      |
| Falling snow                      | 0      | 0      | 0      | +62    |
| Far-ridge snow in the sky         | 0      | 0      | 0      | +57    |

The season light is one `fillRect`, drawn only in autumn and winter. Across the year, at several times of day, a whole opening-view frame now stays between about 31,000 and 33,500 calls (31,497–33,461 with the Millpond, the Treeline and today's football), well inside the budget of `tests/render-budget.ts`, 41,400 calls with today's 18 houses. When the turning year arrived, a frame on the same day and minute differed from the town before it by −752 to +214 calls. Spring and winter frames are often lighter than before, because the young farm and the snowy meadows draw less.

## Determinism

Everything here is a pure function of the town day and minute, like the sky and the moon. `townSeasonAt` takes the season and the whole day from the almanac itself, so the two can never disagree, not even a floating-point hair before midnight. Schedules come from `seedFraction` of fixed names such as `tree:<variant>`, `roof:<place id>`, `pumpkin:<place id>` and `lamp:<x>,<y>`. The ground uses the integer `groundFraction`, because it repaints on every pan and zoom. Fireflies, flakes and the ridge's ragged foot hash fixed strings. There is no `Math.random`, no `Date`, no storage and no canvas created at module load, so node tests can import every module.

Flurry days are seeded by the absolute day, so one winter differs from the next, but every visitor gets the same one, in any timezone. Pausing freezes the season with the rest of the view, and resuming catches up. Reduced-motion users inherit the town's paused start, so petals, leaves, fireflies and flakes hold still. The live broadcast uses the same renderer and keeps the same year.

## Code and verification

- `src/lib/seasons.ts`: the model: `yearDayAt`, `seedFraction`, `groundFraction`, `firstSnowAt`, `snowAt`, `snowCoverAt`, `treeKind`, `canopyAt`, `pumpkinOut`, `firefliesAt`, `flurryAt` and `townSeasonAt`.
- `src/lib/season-copy.ts`: `SEASON_NOTES` and `seasonNote`, the almanac's voice for the year.
- `src/city/season-palette.ts`: every seasonal colour as a day and night pair, and `mixHex`.
- `src/city/trees.ts`: the town's trees through the year, with `leafTone` and the three autumns.
- `src/city/weather.ts`: fireflies, falling snow and the season light.
- `src/city/season-ground.ts`: grass tufts and river ice.
- `src/city/houses.ts` and `lantern-post.ts`: roof snow, doorstep and garden pumpkins, and snow on the crook.
- `src/city/lantern-fork.ts`, `zoo.ts`, `farm.ts` and `ambience.ts`: the Fork's canopy and plaque pumpkins, the zoo's trees, the farm's year and the scarecrow's hat, and the meadows.
- `src/city/horizon.ts` and `sky.ts`: the far trees, the ridge snow and the sister forks' roofs.
- `src/lib/millpond.ts` and `src/city/millpond.ts`: the Millpond's ice, reeds, lilies, petals, leaves and rowboats through the year. See [The Millpond](MILLPOND.md).
- `src/city/render.ts`: the snapshot, `season.groundDay` in `groundKey`, streetlamp snow, fireflies in the depth sort, and the snowfall and season light over the finished frame.
- `src/components/CalendarClock.tsx` and `src/calendar.css`: the almanac line.
- `tests/seasons.test.ts`: agreement with the almanac and across time zones, snow schedules for every possible seed, canopies, pumpkins, fireflies, flurries, continuity across midnights and the new year, and determinism.
- `tests/season-copy.test.ts`: the town voice, stages that cover the year in order and turn at midnight, and a check every half town hour that the line never names something the town is not showing.
- `tests/season-render.test.ts`: the opening view at each stage of the year, within budget and identical for identical moments; each season's colours only in its own season; the sky, the sister forks and the far fields; every house design, with seasonal art inside `houseBounds` and previews unchanged; the Fork; the weather; and a ground cache that repaints once a town day.
- `/tests/manual/seasons.html` on the development server draws Year 3 with the real renderer. **Four seasons** shows Spring 9, Summer 15, Autumn 13 and Winter 12 at dawn, noon, golden hour or night, in the opening view or the whole town. **Through the year** scrubs all 112 days and every minute along a ribbon drawn from the model, with jumps to each stage, **Play the year** and **Run the clock**. **Details** shows ten subjects at eight stages, with a closer look at twice the zoom. **Night and weather** runs fireflies, the first snow, petals and falling leaves at town speed; with reduced motion they start paused. `?day=95&time=1320&view=whole` opens the scrubber on a year day (0–111) and town minute (0–1439), `?closer=0,6` opens a closer look by subject and stage (here the gable roof in deep snow), and `?eager=1` renders all 80 close-ups at once. The page never changes the live clock.

Run `npm run check` and `npm run format:check`.
