# Town events

Each 24-minute UTC town day has a program. The Lunch Green holds one lunch, Willow Grove Zoo an afternoon with the animals, the Little Stage one evening show and then a midnight disco, and the Starlight Cinema its film bill. Down by the river the Riverside adds its own: Market Square opens every morning, and the Bandstand plays a teatime set and a sundown set every day. On their own days come the Paper-boat Regatta, the Harvest Fair and the Long Table, and stargazing on new-moon nights. In early winter the lunch builds snowmen on the green.

Every choice is deterministic from the town-day number, so reloads, time zones and visit order never change the lineup. Consecutive days can repeat a selection. Pausing freezes both the day and the time; returning to live catches up both together.

## The program

| Venue              | Plot           | Event                                              | Town time                         | Seats                   | Days                       |
| ------------------ | -------------- | -------------------------------------------------- | --------------------------------- | ----------------------- | -------------------------- |
| Market Square      | D14–E15        | Morning Market: farmers’, flowers or books         | 08:00–11:30, each guest their own | half(12)                | daily                      |
| Meadow Ground      | F3–G5          | Football, morning                                  | 07:10–10:45                       | half(6)                 | daily                      |
| Lunch Green        | C5             | Picnic, books & lemonade, lawn games               | 13:00–16:00                       | all(6)                  | daily                      |
| Lunch Green        | C5             | Snowmen on the green (the lunch, with other props) | 13:00–16:00                       | all(6)                  | Winter 3, 7, 11, 15        |
| Willow Grove Zoo   | O4–R9          | An afternoon with the animals                      | 14:00–17:00                       | half(12)                | daily                      |
| Meadow Ground      | F3–G5          | Football, afternoon                                | 13:10–16:45                       | half(6)                 | daily                      |
| The Millpond       | H3–I6          | Skating                                            | 14:00–16:40                       | half(6)                 | Winter 9–19                |
| The Boat Landing   | J15            | Paper-boat regatta                                 | 14:00–16:30, a launch every 6 min | half(10)                | Summer 10–16               |
| Moon Harvest Farm  | S4–T5 west end | Harvest fair                                       | 13:00–17:00                       | half(12)                | Autumn 23–25               |
| The Bandstand      | K15            | Teatime set: brass, folk or strings                | 16:00–17:30                       | all(8)                  | daily                      |
| The Bandstand      | K15            | Sundown set: the same band                         | 18:15–20:00                       | all(8)                  | daily                      |
| Moon Harvest Farm  | S4–T5 west end | The Long Table                                     | 18:30–20:30                       | all(16)                 | Autumn 23–25               |
| Little Stage       | B5             | Rock, acoustic, jazz                               | 19:00–21:00                       | all(8)                  | daily                      |
| Starlight Cinema   | D6–E7          | Films under the stars                              | 20:30 to the bill’s end, by 23:54 | min(12, ⌊eligible / 2⌋) | daily                      |
| The Bandstand lawn | K15            | Stargazing by the river                            | 22:15–00:15                       | half(8)                 | new-moon nights, 12 a year |
| Little Stage       | B5             | Midnight at the Little Stage                       | 23:30–02:30                       | all(8)                  | daily                      |

`all(n)` seats up to n guests. `half(n)` seats up to n, and never more than half of the neighbors free for it, rounded up. Football is a match rather than an entry in the events list, and skating follows the ice; both still take their seats in the order below. See [Football](FOOTBALL.md), [The Millpond](MILLPOND.md) and [the cinema guide](CINEMA.md).

Link to the venues with `#venue=green`, `#venue=stage`, `#venue=market`, `#venue=bandstand`, `#venue=landing` and `#venue=farm`. `#venue=regatta` is an alias for the Boat Landing and `#venue=stars` for the Bandstand. The stage's link finds the Midnight Disco after dark. Every venue panel has a Share button for its link.

## Who goes

Neighbors set to `stroll` in an outing's period are eligible: morning for the market and the morning match, afternoon for the lunch, the zoo, the afternoon match, skating, the regatta, the fair and the teatime set, evening for the concert, the Long Table and the sundown set, and night for the film, the stars and the disco (the film also needs an evening stroll). Each outing has a line, and its spots go down the line in order. A neighbor who can't make it passes the spot to the next in line: too far to get there on foot or by the Treeline, not worth the walk, unable to stay fifteen minutes and be home before their next routine or bedtime, or already out at an earlier outing that runs late. So a spot stays empty only when nobody else free that period can reach it. A far neighbor whose turn comes keeps it by riding, so the Treeline changes who goes as well as how. When all spots are taken, other neighbors keep their regular stroll instead of waiting in a queue.

### The seat order

The day is seated in one order. Each call leaves out the guests of the calls named in its last column, so nobody is in two places at once.

| #   | Call                | Line                                                                      | Seats                   | Leaves out    | Days            |
| --- | ------------------- | ------------------------------------------------------------------------- | ----------------------- | ------------- | --------------- |
| 1   | Film                | `cinemaGuests(roster, day)`, forced, no backfill                          | min(12, ⌊eligible / 2⌋) | —             | daily           |
| 2   | Football, morning   | hash `fans:${day}:morning`                                                | half(6)                 | —             | daily           |
| 3   | Regatta             | turn tickets `regatta`; a launch per seat                                 | half(10)                | —             | Summer 10–16    |
| 4   | Harvest Fair        | turn tickets `harvest-fair`                                               | half(12)                | #3            | Autumn 23–25    |
| 5   | Lunch (green)       | hash `${day}:${choice.id}` (the hashed choice's id, also on snowmen days) | all(6)                  | #3–4          | daily           |
| 6   | Zoo                 | hash `zoo:${day}`                                                         | half(12)                | #3–5          | daily           |
| 7   | Football, afternoon | hash `fans:${day}:afternoon`                                              | half(6)                 | #3–6          | daily           |
| 8   | Skating             | hash `skate:${day}`                                                       | half(6)                 | #3–7          | Winter 9–19     |
| 9   | Long Table          | turn tickets `long-table`                                                 | all(16)                 | film          | Autumn 23–25    |
| 10  | Concert             | hash `${day}:${choice.id}`                                                | all(8)                  | film, #9      | daily           |
| 11  | Stargazing          | turn tickets `stargazing`                                                 | half(8)                 | film          | new-moon nights |
| 12  | Disco               | turn tickets `night-party`                                                | all(8)                  | #11           | daily           |
| 13  | Market              | turn tickets `market`; each home's own window                             | half(12)                | #2            | daily           |
| 14  | Bandstand teatime   | turn tickets `bandstand-tea`                                              | all(8)                  | #3–8          | daily           |
| 15  | Bandstand sundown   | turn tickets `bandstand-sundown`                                          | all(8)                  | film, #9, #10 | daily           |

- **Why this order.** A festival goes first in its period, because rare days are the point. The town's older daily outings keep their order and their lines. The Riverside's daily outings come last of all, so on a day without a festival they never change anyone else's guest list. On festival days the older lists change by design (see [Measured](#measured)).
- **Hops.** A film guest may still walk straight from the cinema aisle to the disco. There is no hop from the stars to the disco: the Bandstand's gate to the stage's is 238 unhurried minutes.
- **A previewed draft** joins every line behind the whole town, on the call's own hash key, and never holds a ticket. It only takes a spot the town leaves free, so it never changes anyone else's day.

### Lines and turn tickets

A **hash line** is today's: the eligible neighbors, sorted by ``hash(`${key}:${id}`)``, ties broken by id code unit, never by the browser's language. Each day draws a new line.

**Turn tickets** are fair turns that stay put when the town grows. Every Riverside outing and the disco use them. The outing's active days (every day for the daily ones, its own days for a festival, the new-moon nights for the stars) are dealt in blocks of P = ⌈L / spots⌉, where L is the number of house plots. In each block every house plot holds exactly one ticket day, by a hash of the outing, the block and the plot, and no day has more tickets than spots. On its ticket day a home goes to the front of the line; behind the ticket holders the rest of the line is today's hash line. So every eligible home is at the front once a block, whoever else lives in town.

| Outing         | Spots | P (days in a block, 230 house plots) |
| -------------- | ----- | ------------------------------------ |
| Market         | 12    | 20                                   |
| Regatta        | 10    | 23                                   |
| Harvest Fair   | 12    | 20                                   |
| Long Table     | 16    | 15                                   |
| Stargazing     | 8     | 29                                   |
| Bandstand sets | 8     | 29 each                              |
| Disco          | 8     | 29                                   |

Adding a house moves at most one existing guest: the newcomer either holds today's ticket or takes one place in the rest of the line. With one all-day stroller added to a half-full town, the days on which more than one existing guest loses a seat are 0 for the market, the disco and every festival, and 0–2 and 0–4 a year for the teatime and sundown sets, through the headways below. Tickets read only the published town, so a draft never moves anyone. `activeIndex` in `src/lib/district-calendar.ts` counts the active days; `ticketRank` in `src/lib/resident-trips.ts` ranks the plots.

### Worth the walk

A trip is planned only if it is worth the walk: one way may take at most three times the minutes spent at the event (`WORTH_THE_WALK = 3` in `src/lib/walking.ts`). One way counts the planned, possibly brisk, minutes including the tube's fixed minutes. The film-to-disco hop meets the same rule, and so does every outing.

| Effect                            | Value                                   |
| --------------------------------- | --------------------------------------- |
| Worst planned ratio               | 3.00                                    |
| Real-town concert guests a day    | 5.94 → 5.71                             |
| Real-town disco guests a night    | 4.81 → 4.09 (star nights included)      |
| Concert reach, evening-only plots | 88% → 76% (concert or sundown set: 97%) |
| Film seats missed by sleepy owls  | 3 (before: 14)                          |

### Two minutes apart at doors and gates

Neighbors who would reach a tube door or a venue gate within two minutes of each other are spaced out, so they never walk in lockstep as one figure.

- **Marks.** A rider marks `door:<halt>` when they reach the boarding door and when they leave the stepping-off door, both ways. A guest marks `gate:<venue>:<x>,<y>` where they pass the first point of the venue's approach: arriving, the minute they pass it going in; leaving, the minute they pass it on the way out, at their own pace. A trip that hops on to the disco writes no marks for the way home.
- **The book.** Each day's plan keeps one book of marks and passes it to every home it plans. After each invitation it replaces that home's marks. A previewed draft's marks are late: the town's homes ignore them, while the draft respects everyone's. The book is never module state, so planning one home on its own gives the same answer whatever was planned before.
- **Resolving.** A trip clashes when one of its marks is within two minutes of another home's mark on the same key. A clash on the way there arrives half a minute earlier, at most six minutes earlier, else later. A clash on the way home leaves half a minute later, at most six minutes later and never past the cap, else earlier from then on. The cap is the event's end plus the seat's own stagger plus six minutes, or the venue's hard end: nobody skates past 16:40. The arrival and the leave move separately, so moving an arrival never delays the leave. After 200 half-minute steps a plan that still clashes drops, and the seat passes on. A clashing plan is never kept.
- **Hops** keep their marks but are never moved; the pairs that include a hop are the only exception (1 to 6 a year in a town).
- **Recorded.** Every moved trip carries `headway: { arriveShift, leaveShift, leaveCap }`, so the tests can check every bound from the plans.

| Town      | Door / gate pairs under 2 min | Trips moved | Move: median / p95 / max (min) | Plans dropped | Planning, ms a day |
| --------- | ----------------------------- | ----------- | ------------------------------ | ------------- | ------------------ |
| Real, 30  | 0 / 0                         | 46%         | 3.5 / 7.0 / 19.0               | 0.01%         | 4.0                |
| Full, 230 | 0 / 0                         | 54%         | 4.0 / 15.0 / 28.5              | 0.46%         | 9.4                |
| Mixed     | 0 / 0                         | 51%         | 4.0 / 15.5 / 24.5              | 0.26%         | 12.8               |
| Eager     | 0 / 0                         | 60%         | 4.0 / 16.5 / 65.0              | 0.09%         | 14.8               |

No arrival moves more than six minutes earlier, no leave passes its cap, and every seat is still filled in the full, mixed and eager towns. The Bandstand's shared spots never overlap: teatime guests leave their chairs by 17:45 at the latest, and sundown guests arrive from 17:55.

### Personal windows

- **The market.** Each home has its own browsing hour. It starts at 08:00 plus ten minutes times `hash('market-browse:' + id) % 13`, and lasts 60 to 90 minutes (`hash('market-stay:' + id) % 31` more than an hour), ending by 11:30. A home that can't make its own hour takes one it can make, picked by the same hash among the thirteen starts; with none, it keeps the nominal 08:00–11:30. With 230 house plots, 47 morning-only plots move to an hour they can make, and then every plot can make the hour it has. Stays run 44–90 minutes in the real town and 33–90 in a full one.
- **The regatta.** Seat k's own start is 14:00 plus 6k minutes, when the boatwright launches their boat. A guest arrives in time to set the boat down a minute before its launch, or the seat passes on.

### One outing at a time

| Period    | At most one of                                                                          | Also                                             |
| --------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Morning   | morning football, the market                                                            |                                                  |
| Afternoon | the lunch, the zoo, afternoon football, skating, the regatta, the fair, the teatime set |                                                  |
| Evening   | the concert, the Long Table, the sundown set                                            | A film guest has none of them, and no stargazing |
| Night     | the disco, stargazing                                                                   |                                                  |

No Bandstand spot is held by two guests whose visits overlap, across the teatime set, the sundown set and the stars. Every trip keeps fifteen minutes at the event at least, is home by the routine's end or by bedtime at night, leaves by its cap, never turns straight back on its route, and joins the venue's own approach where the road first meets it.

## Getting there and back

Guests step out of their front door and down the garden path when the period begins (a guest who leaves on the hour steps out a few minutes early), follow the roads (or ride the Treeline when it saves enough, see [The Treeline](TUBES.md)), then turn in at the venue's own gate or lane without walking past it and back, and walk onto the venue's lawn. Every Riverside approach starts on a road tile's centre: the market's two lanes behind its stall rows, the Bandstand's two ways in from the south road and the riverside road, one row of the Boat Landing each from the riverside road, and the farm's two fence gates at (13.5, 75.5) and (13.5, 79.5). No approach passes within 0.3 tiles of another guest's spot, so nobody walks through a neighbor who is already there.

Neighbors who walk a street together are given lanes for the day, so they walk side by side instead of as one figure or one head over the other: each keeps to their own side and edges across only to walk clear of someone, such as a neighbor they catch up with. A lane is drawn sideways of the way they walk, eases in and out at every end, and keeps to the line through the stage's crowd. A guest whose spot faces back the way they came turns through a quarter arriving and leaving, and no pose flashes up for a moment just after they settle or just before they get up to go. The last frame of a walk keeps the facing of its last stretch, so nobody turns about for a frame as they arrive.

Departures are staggered slightly by seat, so most guests arrive a few minutes early and wait at their spot: sitting on the blanket, in their cinema seat or in a deckchair, or standing on the audience lawn, facing the show, with a status such as "Waiting for Jazz under the stars" or "Waiting for the band". Zoo visitors, football fans, market browsers, regatta guests, fairgoers and Long Table guests start as soon as they arrive, because the animals, the match, the stalls, the river and the fair are already there. Everyone gets home before the next routine starts: back at the road in front of their lot by then, and in through the front door a few minutes later, borrowing those minutes rather than hurrying. Neighbors at work or home remain indoors.

## The lunch, the show and the disco

| Venue        | Reserved plot | Events                               | Town time   |
| ------------ | ------------- | ------------------------------------ | ----------- |
| Lunch Green  | C5            | Picnic, books & lemonade, lawn games | 13:00–16:00 |
| Little Stage | B5            | Rock, acoustic, jazz                 | 19:00–21:00 |
| Little Stage | B5            | Midnight at the Little Stage         | 23:30–02:30 |

The green has six spots around its blanket; the stage has eight spots across its audience lawn.

Night owls (`routine.night: "stroll"`) can join the midnight party. Up to eight guests come on turn tickets: each owl's ticket night comes round once in every 29 nights, so the floor goes round the whole town, and stargazers sit the disco out on their night. Arrivals spread over the first hour, but an owl with an early bedtime comes early enough for fifteen minutes on the floor and an unhurried walk home; an owl who lives too far from the stage to manage even that passes the spot on. Cinema guests are eligible too: when travel and bedtime leave at least fifteen town minutes to dance, they walk directly from the cinema aisle to the stage, then return to their own home. Their guest list and spots remain attached to the evening across midnight. In the free time around events, night owls walk moonlit loops round the block and sit out on their own bench, porch or front step. Each has a stable bedtime in one of three bands: 00:00–01:00, 02:00–03:00, or 04:00–05:00. All journeys fit before that bedtime (a guest home right at bedtime goes in through the front door a few minutes later); explicit sleepers stay indoors. The stage becomes the Midnight Disco. A DJ in headphones works two turntables at a booth with a small level meter. A light-up floor covers every dancing spot, its pastel colours drifting across it in a slow wave. A mirror ball turns overhead, sending reflections gliding round the floor, and two soft pools of coloured light wander over it. The festoon bulbs stay steady. Every light fades or glides, and none of them flashes (`tests/disco.test.ts` checks the floor frame by frame).

Picnic guests sit with folded legs, sip lemonade, or chat. Book events bring open books; lawn games add a small ball. Concertgoers sway and occasionally raise both hands, with brief music notes above the crowd. Rock shows encourage more cheering than acoustic or jazz sets. Once the band has gone, the last of the crowd stop swaying and stand quietly until they leave. Guests crouch for a moment as they sit down on a blanket, a cinema seat or a deckchair, and again as they get up. Zoo visitors look from the habitats on one side of the promenade to the other every five to eleven minutes, turning clockwise, and now and then point and cheer. Gestures have independent timing and stay repeatable for the shared clock. Rugs are drawn beneath guests, and the stage sits at the rear of its plot to leave audience space.

The stage performers and DJ are scenery, not extra contributed residents. Sound is optional: turn on town sound for the current concert or the original midnight dance track. There is no autoplay audio or flashing lights. Pausing the town also pauses gestures, performers, music notes, and sound.

## The Riverside

The east of town is the Riverside: **Market Square** on D14–E15 by the duck street, the **Boat Landing** on J15, the **Bandstand** on K15 and **Kingfisher Halt** on L15, whose bridge spans the regatta course. Stargazing uses the Bandstand's lawn, and the Harvest Fair and the Long Table use the west end of Moon Harvest Farm. The river runs at x = 62, the riverside road at x = 61, and the far bank at x = 63. None of these plots takes a house: the market's four plots, J15 and K15 are reserved like every venue.

### Morning Market

Daily, 08:00–11:30 (guests leave from 06:00 and are home by 12:00), each guest within their own browsing hour.

- **Kind.** `MARKET_KINDS[hash('market:' + day) % 3]`: a farmers' market, flowers or books, the same all day for everyone. The name and words follow the season:

| Kind                       | Name                    | Description                                                                    |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| Farmers’, spring           | Farmers’ market         | Radishes, greens and seedlings in trays. Bring a bag, take the spring home.    |
| Farmers’, summer           | Farmers’ market         | Strawberries, tomatoes and the first beans. Bring a bag, take the summer home. |
| Farmers’, autumn           | Farmers’ market         | Apples, squash and a pumpkin or two. Bring a bag, take the autumn home.        |
| Farmers’, winter           | Farmers’ market         | Roots, jars and crates of keeping apples. Bring a bag, take the winter home.   |
| Flowers, spring and summer | Flowers & seedlings     | Buckets of stems and trays of green things. Something for every windowsill.    |
| Flowers, autumn            | Bulbs & dried flowers   | Paper bags of bulbs and bunches hung to dry. Plant now, see them in spring.    |
| Flowers, winter            | Wreaths & winter greens | Holly, ivy and fir tied with twine. Something green for the door.              |
| Books                      | Books & bric-a-brac     | Paperbacks, teacups and a gramophone horn. Haggling is gentle here.            |

- **Ground.** The square takes x 54–61, y 14–21. Its inner roads (x = 57 and y = 17) and their lamps are gone; the perimeter roads x = 53, x = 61, y = 21 and the duck street y = 13 stay. Six stalls stand three to an edge, their counters along y 14.9 (north) and x 54.9 (west), 1.5 tiles each, with their fronts to the two sides the camera sees. The south and east sides stay open.
- **Guests.** Up to twelve, from morning strollers who are not at the morning match. Seats 0–5 browse the north stalls at x 55.6, 56.4, 57.5, 58.3, 59.4 and 60.2 on y 15.75, facing `ne`; they come in from (61.5, 15.5) along a lane behind the row at y 16.2, then one step forward. Seats 6–11 browse the west stalls at y 16.55, 17.25, 18.15, 18.85, 19.75 and 20.45 on x 55.75, facing `nw`; they come in from (55.5, 21.5) along x 56.4. They browse from the moment they arrive: they stand facing their stall, glance to the next stall every 6 to 10 minutes (never within a minute of arriving or leaving), and chat one beat in three. They walk home with a paper bag whose top shows greens, stems or a book corner by the day's kind. It is not drawn in the tube's stack or glass.
- **Scenery.** Stallholders fade in 07:10–07:30. Awnings unroll one at a time 07:15–07:45, two minutes each; the market opens at 08:00 and packs up 11:30–12:00. Awning stripes are sage and cream for the farmers' market, rose and cream for flowers, slate and cream for books, never amber, and stalls with their awnings stay within 28 pixels. Crates follow the farm's calendar; a produce handcart stands in the north-west corner and a low pump (24 pixels at most) in the open corner. The six stallholders face the camera behind their counters. They are scenery: never neighbors, never counted. In winter snow lies on the awnings; at night the stalls are folded frames under pale canvas. The duck family passes behind the north stalls at 08:05–08:36 and back past the packing-up at 11:53–12:25, by Watercress Halt's door at 08:07–08:21 and 12:08–12:22.
- **Panel.** `PUBLIC SPACE · D14–E15 · 4 PLOTS`, "Market Square.", today's kind and its words, and "Open 08:00–11:30. Browsers walk home with a paper bag." It names the neighbors browsing now, only while they are there, and says nothing about a crowd when nobody is. Out of hours it says "Next market: tomorrow, 08:00."
- **Live.** The market frame is centred on (1520, 1395) world pixels, 640 × 420. Its shot runs 09:30–10:10 on the days the district highlight picks it.
- **The real town** (30 houses) sends 2.0 browsers a day, 9 different neighbors a year. The stallholders carry the look, and the words never promise a crowd.

### Bandstand Evenings

Every day of the year, harvest days included, the Bandstand on K15 plays two sets: the **teatime set** 16:00–17:30 for afternoon strollers, and the **sundown set** 18:15–20:00 for evening strollers. The band is `BANDS[hash('bandstand:' + day) % 3]`, the same for both sets.

| Band    | Name                       | Description                                                                       |
| ------- | -------------------------- | --------------------------------------------------------------------------------- |
| brass   | Brass at the bandstand     | A tuba, two cornets and a drum. The river keeps time.                             |
| folk    | Folk on the riverbank      | A fiddle and a squeezebox by the water. Everyone half knows the chorus.           |
| strings | A string trio by the river | Three chairs, three strings and the evening coming in. Deckchairs face the music. |

- **Card.** Both sets share one card in the Events panel. It shows whichever set is live, else the next one today, else the teatime set.
- **Guests.** Eight a set, in eight deckchairs on the south lawn, all facing `ne` toward the stand: (58.45, 44.15), (59.15, 44.15), (59.85, 44.15), (60.55, 44.15) in the front row and (58.80, 44.75), (59.50, 44.75), (60.20, 44.75), (60.90, 44.75) behind. Chairs west of x 59.6 come up from the south road at (59.5, 45.5); the rest come from the corner of the riverside and south roads, along the lawn's south edge. They sit to wait and to listen. The teatime set has its tea and perches; at sundown they perch and sip, and cheer only in each set's last five minutes. Every pose is held a minute at least. The deckchairs change hands around six.
- **Scenery.** An octagonal platform about 1.4 tiles across on six slender posts, with a shallow green-and-cream cap, 40 pixels at most, on the plot's north half. The players are scenery, facing the camera: tuba, cornet and drum; fiddle, squeezebox and guitar; or violin, viola and cello. Music notes rise as at the stage. Players fade in at 15:45, take their interval tea on the steps 17:30–18:15 and are gone by 20:15. The deckchairs are out 15:35–20:20 and stacked beside the stand otherwise. Blossom lies on the cap in spring; snow and scarves in winter.
- **The peak lamp.** A lamp under the cap lights in the streetlamp wave and stays lit until 06:00. It is lit light, so it may be amber, and it is a lamp, never a lantern. On star nights it is not lit at all, so the sky stays dark for the stargazers.
- **Music.** Each band has its own arrangement (`src/music/bandstand-tracks.ts`). It is local, like the cinema's: `bandstandListening` gives a gain by the camera's zoom and its distance from the Bandstand, and a pan by screen x, and a live set plays only while that gain is at least 0.005. A live stage show plays first. Sound stays opt-in and never autoplays outside `/live`.
- **Panel.** `PUBLIC SPACE · K15`, "The Bandstand.", tonight's band, "Teatime set 16:00. Sundown set 18:15." and "Eight deckchairs face the music." On new-moon nights it also shows the stargazing note.
- **Live.** The Bandstand frame is centred on (608, 1922), 520 × 370. Its shot runs 16:00–16:40, the teatime set, on the days the district highlight picks it.
- **The real town** has 1.74 teatime guests on 99 days of 112, and no sundown guests. The words never promise a crowd.

### Harvest Fair and the Long Table

Autumn 23–25, after the grain is cut row by row on Autumn 15–22, both at the west end of Moon Harvest Farm (x 14–22, y 74–81). Guests come in by the farm's two fence gates: the **north gate** (13.5, 75.5) for fair spots 0–5 and table seats 0–7, the **south gate** (13.5, 79.5) for fair spots 6–11 and table seats 8–15. Every approach runs gate → (14.5, gate) → (14.5, lane) → along the lane → spot, and the lane lies beside the spot's row on the side the guest faces from.

- **Harvest fair**, 13:00–17:00, first in the afternoon, up to twelve. "The field is cut and the gate is open. Cider, bales and a cart of pumpkins." Fairgoers stand on the two footpaths at x 16.35, 17.05, 17.75, 18.45, 20.55 and 21.25, on y 75.4 facing `sw` (lane 74.9) and on y 79.6 facing `ne` (lane 80.1). They sip cider, chat and sit on a small square straw seat at their spot. The spots keep 0.75 tiles from the scarecrow's four west perches, because on three fair days in nine the scarecrow stands on one of them all day.
- **The Long Table**, 18:30–20:30, first in the evening, up to sixteen, never a film guest. "Supper on the stubble at Moon Harvest Farm. Bring a dish and stay for the lamps." The table runs along y 77.5 from x 15.0 to 21.0, and seats k = 0–7 sit at (15.2 + 0.8k, 77.0) facing `sw` (lane 76.45), seats 8–15 at (15.2 + 0.8(k − 8), 78.0) facing `ne` (lane 78.55). They sit, sip and chat. Each guest carries a dish there, a pie, a loaf or a jar by `hash('dish:' + day + ':' + id) % 3`, and it stands on the table at their place from the moment they arrive.
- **Props** (on fair days): a pumpkin cart (18 pixels at most, never glowing) at (14.6, 77.5) between the gates and bunting in faded cloth on the west fence, both 06:00–21:00; a cider press (24 pixels at most) at (19.5, 77.5) with a scenery presser turning it 13:00–17:00; six round bales (12 pixels at most) at (16.0, 77.1), (16.0, 77.9), (17.2, 77.5), (20.6, 77.1), (20.6, 77.9) and (21.5, 77.5). The press and the bales fade out 17:10–17:15 as two farmhands clear them and lay the trestles, the cloth and the jugs, 17:10–17:45. A scenery fiddler plays at the table's east end, (21.45, 77.5), 18:00–20:30, while the Bandstand still plays its own set. Every prop keeps 0.75 tiles from the scarecrow and clear of the guests' spots and approaches while it is out.
- **Lamps.** Four table lamps (16 pixels at most) light 20:20–20:30 in the streetlamp wave, by their distance from the Fork. They fade out over two minutes at 20:56, after the last possible leave, and the table is cleared 21:00–21:15.
- **The stubble.** From Autumn 22, when the last of the grain is cut, a trodden-stubble patch covers the first bed (x 18.2–21.5, y 74.3–81.0), so nobody sits among full-grown greens. It stays until spring, as the grain's stubble does. On the three days the scarecrow wears a ribboned hat.
- **Panel.** The farm's panel gains a Harvest Fair section: `HARVEST FAIR · MOON HARVEST FARM` or `THE LONG TABLE · AUTUMN 23–25`, the dates, today's program, the guests by name only while they are there, and "Next: Autumn 23." out of season. Its link stays `#venue=farm`.
- **Live.** The harvest frame is centred on (−2261, 1785), 640 × 420. The fair's shot runs 15:00–15:40 and the Long Table's 20:24–20:44, right after lantern hour, with the table lamps lit.
- **The real town** sends 12 fairgoers a day and 4.33 to the table: the farm's first visitors.

### Stargazing

On new-moon nights (season dates 27, 28 and 1, judged at 22:00: twelve nights a year), 22:15–00:15, on the Bandstand lawn. "No moon tonight, so the sky is full. Rugs out, faces up." After midnight it belongs to the evening before, like the film.

- **Guests.** Up to eight night owls, seated first at night, never a film guest; on their night they sit the disco out. They sit on rugs on the eight deckchair spots, facing `ne`, and chat now and then. Nobody lies down.
- **Scenery.** The rugs and a brass telescope (24 pixels at most) are out 21:50–00:35, after the deckchairs have gone; on Winter 1 the rugs lie on snow. A scenery astronomer stands at the telescope 22:00–00:30, shifting between two stances. The Bandstand's peak lamp stays dark. On the summer star nights only (Summer 27, 28 and Autumn 1) up to three slow, cool-white meteors cross the sky, each a 40-pixel streak that fades in and out over a second and a half at least. Nothing is amber, and nothing flashes.
- **Panel.** The Bandstand's panel shows the stargazing note: `NEW MOON · THE BANDSTAND LAWN` and "Stargazing by the river."
- **Live.** The Bandstand frame at night, 23:00–23:45, a protected moment.
- **The real town** has 2.42 stargazers a star night; on those nights the disco has 2.17 dancers (4.3 on other nights), never none.

### Paper-boat Regatta

Summer 10–16, 14:00–16:30, first in the afternoon, up to ten guests. "Fold a boat and let the river take it. Nobody keeps the times." It reports and never ranks: no winner, no times, no order.

- **Guests.** They stand on the Boat Landing's river edge, facing `se`, each on their own row: spot k is (60.75 or 60.2 by k's parity, 38.15 + 0.31k). Each comes in from the riverside road at (61.5, ⌊y⌋ + 0.5) and carries a paper boat there, white with a band in their own outfit colour. On arrival they set it down at their feet, a step toward the river on their own row: x 60.95 for the front column, 60.4 for the back. Two or three minutes before its launch the scenery boatwright crosses from the landing stage, picks it up and launches it at 14:00 + 6k. Nobody teleports and nothing floats unattended. They cheer for a minute and a half from the moment their own boat comes to rest. Nobody stands east of the riverside road.
- **Boats** (`regattaBoat(k, day, minutes)` in `src/lib/district-calendar.ts`, pure in the day and the minute). Boat k launches from the landing stage's south tip (62.125, 39.5) and drifts down the near half of the river, x 62.085–62.165, swaying ±0.04, until it comes to rest against the cork boom at y = 51 or the boat ahead, at y = 51 − 0.14k, between 15:30 and 15:40. No boat overtakes another. They pass the Bandstand 14:31–15:11 and slide under the Kingfisher bridge 15:02–15:29, while capsules slide over. A scenery boatman nets them out 16:40–17:10, and bunting in cream and sage hangs at the Landing all Regatta Week.
- **Panel.** `PUBLIC SPACE · J15`, "The Boat Landing.", "A lawn by the river. Paper boats in summer." and "Regatta Week is Summer 10–16." During Regatta Week the outing's eyebrow reads `REGATTA WEEK · SUMMER 10–16`.
- **Live.** The regatta frame is centred on (600, 2000), 740 × 450, and holds the landing stage, the Bandstand, the bridge and the boom. Its shot runs 14:40–15:45.
- **The real town** sends 10 a day. Every guest is at the water to see their own boat come in: 70 of 70 seat-days.

### Snowmen on the Lunch Green

On Winter 3, 7, 11 and 15 (year days 86, 90, 94 and 98) the lunch on the green builds snowmen. It is the day's lunch with other words and props ("Snowmen on the green", "Roll the snow into someone with a carrot nose. They stand until the thaw."), and its line keeps the hashed choice's key, so no guest list changes. The books and games props stay away whatever the hashed choice was.

- **Builders.** Lunch seats 0 and 1 crouch and play by turns, each held a minute at least, 14:00–15:45, turned to the day's snowman; the ball they play with is a snowball. Seats 2–5 sit, chat or cheer until the last cheer. Before 14:00 and after the building the lunch keeps its own poses, each still held a minute at least.
- **Stages.** The base 14:00–14:40, the body 14:40–15:15, the head 15:15–15:40; eyes, a carrot and a scarf at 15:45. The latest builder arrives at 13:49, so a builder is there through every stage. Snowman k stands at spot k of four, round the green and clear of its guests, its lane and the stepping stones.
- **Until the thaw.** Each snowman is a pure function of the year day and the minute: no roster, no storage. It stands from its build day's 15:45 until it melts, which starts between Winter 24 and 26. It is about 21 pixels tall in balls of 10, 8 and 6 pixels, with snow on its head like the roofs. Melting, it leans, shrinks to 40% and loses its head at 0.7; at 1 the carrot and the scarf lie on the grass for half a day. All are gone by the end of Winter 27, so Spring 1 is always clear. The scarf's colour is muted wool, never amber.
- **Panel.** The green's panel adds one line while they stand, for example "Snowmen on the green: 3. They stay until the thaw." It is history, not a score.

## The Events panel, links, live and labels

- **Cards.** Today's five cards come first, as always. The Riverside's cards follow, sorted by start; a live one joins the cards that are happening now, as skating does, so a live market never sits at the bottom. Both Bandstand sets share one card. A Riverside card uses the usual markup (the status and time line, the name, the venue and the arrow), its own icon (`ShoppingBasket`, `Music4`, `Sailboat`, `Wheat`, `UtensilsCrossed`, `Telescope`) and no eyebrow. While it is live it adds "· 2 there" (or however many neighbors are there), only when there are any. Each card is a keyboard button with its `#venue=` link and Share.
- **The events list.** `eventsForDay(day, minutes)` returns today's five unchanged (the lunch, the concert, the disco, the film and the zoo), then `districtEvents(day, minutes)`: the market, the teatime set and the sundown set, then on their days the regatta, the Harvest Fair, the Long Table and stargazing. The Riverside's events are built only from frozen data (`district-places.ts`, `district-calendar.ts`, `district-copy.ts`). A name has no trailing period ("Brass at the bandstand"); headings add one where they render. `eventStatus` says "Later today" before 08:00.
- **Live.** The broadcast's daily highlights are unchanged. On a festival day the festival's shot (regatta 14:40–15:45, fair 15:00–15:40, Long Table 20:24–20:44, stars 23:00–23:45) ranks after lantern hour and the cinema and before the day's events. On other days `liveDistrictHighlight(day)` picks the market (09:30–10:10) or the teatime set (16:00–16:40), after the day's events and before the ducks. A shot with nobody there for its whole window is skipped. Its guests are followable except while their outing is on air. "Coming up in Forktown." lists the day's Riverside moment only when it will air, at the minute it first does (`districtShotAirs`: someone is planned there, and the cinema or a busy afternoon event does not hold the air for the whole window), and no break covers its window either way. Every frame is at most 850 × 540. See [Forktown Live](LIVE.md).
- **Labels** in the follow status, the neighbors list and the house card:

| Outing         | Going                         | At the event               | Waiting                        | Returning                       | On the tube, to / from             |
| -------------- | ----------------------------- | -------------------------- | ------------------------------ | ------------------------------- | ---------------------------------- |
| Market         | Walking to Market Square      | Browsing the market        | Waiting for the market to open | Walking home from the market    | Market Square / the market         |
| Bandstand sets | Walking to the Bandstand      | Listening at the Bandstand | Waiting for the band           | Walking home from the Bandstand | the Bandstand / the Bandstand      |
| Regatta        | Walking to the Boat Landing   | Watching the paper boats   | Waiting for the boats          | Walking home from the regatta   | the Boat Landing / the regatta     |
| Harvest Fair   | Walking to the harvest fair   | At the harvest fair        | Waiting for the fair to open   | Walking home from the fair      | Moon Harvest Farm / the fair       |
| Long Table     | Walking to the Long Table     | At the Long Table          | Waiting for supper             | Walking home from supper        | Moon Harvest Farm / the Long Table |
| Stargazing     | Walking to the Bandstand lawn | Stargazing                 | Waiting for the dark           | Walking home from the stars     | the Bandstand lawn / the stars     |

## Every evening

Two things happen every evening, whatever the lineup. They open the Events panel under "THIS EVENING", and the almanac lists them too.

- **Lantern hour, 20:00.** The Lantern Fork on D3 lights one lantern for every house, oldest first: one a second with today's houses, and all of them by 20:20 at any size. Each house's windows and lantern post light with its lantern, then the streetlamps follow outward from the Fork until 20:30. Everything stays lit until 06:00. Before nightfall the card counts down in real time ("Nightfall is in about 7 minutes."); while it lights it shows "Happening now". See [The Lantern Fork](LANTERN_FORK.md).
- **Tonight's tale.** One neighbor's own story, told from 06:00 to 06:00 in a fair rotation. The card quotes it and links to the house. See [Tonight's tale](TALES.md).

Lantern hour is not a gathering: it has no guests, no spots and no venue schedule, and it never changes who attends anything.

## Winter skating

On the Millpond's frozen days, Winter 9–19, the Events panel also shows **Skating on the Millpond**, 14:00–16:40. It waits after the day's other cards, and while skating is live it moves up to join the cards that are happening now. It reads "Later today", "Happening now" with the live dot, or "Finished today". While skating is live it adds "· 1 on the ice" (or however many neighbors are skating), when there are any. Its button opens the pond, and its label says the status, the time and the count aloud. Skating is not a scheduled venue event, just as Lantern hour is not: it follows the ice rather than the day's lineup, and it never appears in `eventsForDay`. Skaters are chosen from the afternoon strollers whom the regatta, the fair, the lunch, the zoo and the football have not claimed, so skating never takes a guest from them, and nobody skates past 16:40. See [The Millpond](MILLPOND.md).

## Measured

Measured with the real planner on the town of 230 house plots: the full town (today's houses plus a made-up house on every free plot), a mixed town (every routine, spread over the plots), an eager town (everyone out all day, and a night owl), and the real town of 30 houses, each over a town year of 112 days.

**Seats.** Every outing seats its full capacity on every one of its days in the mixed, eager and full towns. Nobody is in two outings of one period, and no Bandstand spot is shared. On a day without a festival, the Riverside changes no other outing's guest list.

**Worst door-to-seat trip**, best of walk or tube (seat 0, unhurried minutes). Reach is the share of plots whose narrowest routine can make it under the planner's own rules (the market with each home's own hour; owl bedtimes at 00:30, 02:30 and 04:30).

| Venue or outing   | Worst (plot) | p90 | Median | Plots that ride | Narrowest-routine reach | 20 × 10 town, worst |
| ----------------- | ------------ | --- | ------ | --------------- | ----------------------- | ------------------- |
| Football am / pm  | 199 (O11)    | 161 | 124    | 76              | 100% / 100%             | 249                 |
| Lunch Green       | 175 (M8)     | 150 | 113    | 130             | 100%                    | 251                 |
| Zoo               | 233 (F12)    | 196 | 133    | 86              | 98%                     | 271                 |
| Skating           | 215 (T10)    | 178 | 128    | 48              | 100%                    | 215                 |
| Concert           | 180 (O10)    | 155 | 117    | 125             | 76%                     | 263                 |
| Film              | 223 (O11)    | 181 | 145    | 77              | 100 / 100 / 100%        | 273                 |
| Disco             | 180 (O10)    | 155 | 117    | 125             | 7 / 92 / 100%           | 263                 |
| Market            | 169 (I7)     | 143 | 96     | 193             | 100%                    |                     |
| Regatta           | 161 (F6)     | 139 | 102    | 131             | 100% (seats 8–9: 97%)   |                     |
| Harvest Fair      | 187 (H7)     | 153 | 116    | 164             | 100%                    |                     |
| Bandstand teatime | 163 (G6)     | 126 | 90     | 130             | 51%                     |                     |
| Long Table        | 185 (H7)     | 151 | 113    | 164             | 79%                     |                     |
| Bandstand sundown | 163 (G6)     | 126 | 90     | 130             | 92%                     |                     |
| Stargazing        | 163 (G6)     | 126 | 90     | 130             | 44 / 98 / 98%           |                     |

The concert or the sundown set reaches 97% of evening-only plots, at least one daily afternoon outing reaches every plot, and the disco or the stars reach 49%, 100% and 100% of the night-only owls by bedtime band.

**Rotation.** Different guests over a year in the eager town:

| Outing      | Guests    | Outing      | Guests |
| ----------- | --------- | ----------- | ------ |
| Football am | 193 (84%) | Market      | 230    |
| Green       | 197 (86%) | Teatime set | 230    |
| Zoo         | 229       | Sundown set | 230    |
| Football pm | 207 (90%) | Regatta     | 70     |
| Concert     | 208 (90%) | Fair        | 36     |
| Film        | 227 (99%) | Long Table  | 47     |
| Disco       | 158       | Stars       | 91     |
| Millpond    | 58        |             |        |

In the mixed town a stroller has 45 outings a year at the median, 10 at the 10th percentile, and 4 strollers have none. Every owl who can dance alone dances on some nights.

**The real town** (30 houses), guests a day:

| Outing      | Now             | Before the Riverside |
| ----------- | --------------- | -------------------- |
| Football am | 5.0             | 5.0                  |
| Market      | 2.0             | —                    |
| Green       | 6.0             | 6.0                  |
| Zoo         | 8.53            | 9.0                  |
| Football pm | 4.73            | 5.0                  |
| Teatime set | 1.74 on 99 days | —                    |
| Concert     | 5.71            | 5.94                 |
| Sundown set | 0               | —                    |
| Film        | 3.0             | 3.0                  |
| Disco       | 4.09            | 4.81                 |
| Stars       | 2.42            | —                    |
| Regatta     | 10              | —                    |
| Fair        | 12              | —                    |
| Long Table  | 4.33            | —                    |

**Festival days in the real town**, guests a day (the same outings with the festivals off in brackets):

| Days             | Zoo         | Football pm | Teatime     | Concert     | Disco       |
| ---------------- | ----------- | ----------- | ----------- | ----------- | ----------- |
| Regatta (7)      | 4.00 (9.00) | 2.00 (5.00) | 1.14 (2.00) | 5.71 (5.71) | 4.29 (4.29) |
| Harvest (3)      | 3.00 (9.00) | 2.00 (5.00) | 0.67 (3.00) | 1.67 (6.00) | 4.33 (4.33) |
| Star nights (12) | 9.00        | 5.00        | 1.83        | 5.83        | 2.17 (4.42) |

The Meadow Ground loses most of its afternoon supporters on the ten festival afternoons. That is the cost of festivals going first; seating the regatta at half(6) and the fair at half(8) would keep the zoo at 6.0 and 5.0 and afternoon fans at 3.0 on those days.

**Side by side.** Neighbors who walk together should read as two figures. On the test days of `tests/trip-routes.test.ts` and `tests/full-town-feel.test.ts`, full town, sampled every 0.2 minutes, the longest run of two walkers fused into one figure stays under 2 minutes and the longest run stacked one over the other under 3:

| Day                          | Close/together | Fused | Stacked |
| ---------------------------- | -------------- | ----- | ------- |
| Spring 1 (new moon)          | 0.038          | 1.6   | 2.0     |
| Spring 2                     | 0.033          | 1.6   | 2.4     |
| Spring 3                     | 0.088          | 1.4   | 1.8     |
| Summer 15                    | 0.043          | 1.4   | 2.0     |
| Summer 10 (regatta)          | 0.093          | 1.6   | 2.0     |
| Autumn 23 (harvest)          | 0.060          | 1.4   | 2.0     |
| Winter 11 (skating, snowmen) | 0.049          | 1.8   | 2.2     |

Over a whole year the full town still has 17 days with a pair over a limit (worst fused 4.6, stacked 4.8; the 20 × 10 town had 20 days, worst 11.6 and 35.8). Every one of them is an outing walker beside a neighbor out on their own loop or stroll, which no outing headway can see.

**Cost.** Planning takes 9.4 ms a day in the full town, 12.8 in the mixed and 14.8 in the eager town, and 4.0 in the real town. Simulating the full town takes 0.67 ms a frame on average, with up to 114 neighbors out at once.

## Extend it

`src/lib/events.ts` owns the venues, event choices and schedules, and `src/city/venues.ts` draws the green and the stage. `src/lib/resident-trips.ts` draws the guests, seats every call in the order above and plans their trips, `src/lib/walking.ts` plans one journey, `src/lib/simulation.ts` places everyone at each minute, and `TownEvents.tsx` shows the daily program through keyboard-accessible buttons. Existing house JSON requires no new fields.

The Riverside is split so each part has one home:

- `src/lib/district-calendar.ts`: which outings run on which days, their times, `activeIndex`, the market's kind and the band, the regatta's boats and the snowmen. Pure and frozen.
- `src/lib/district-places.ts`: the venues, grounds, spots, approaches, props, frames, the Bandstand's furniture times and `bandstandListening`. Frozen.
- `src/lib/district-copy.ts`: every name, description, label and panel line. Frozen.
- `src/lib/outings.ts`: the registry, one `OutingSpec` an outing (venue, period, days, times, seats, exclusions, underway or seated, what they carry, pose and facing), plus `SEAT_ORDER` and `SEAT_EXCLUDES`. The planner, the trip states and the tests read it.
- Each outing's poses in `src/lib/outings/*.ts`, its art in `src/city/district/*.ts` (painters registered in `src/city/district-art.ts`), what guests carry in `src/city/carry/*.ts`, its panel in `src/components/district/`, its music in `src/music/bandstand-tracks.ts`, and its moments for the harness in `tests/manual/district-*.ts`.

Add lunch and evening choices to the appropriate period in `EVENT_CHOICES`; the night party has a fixed entry in `eventsForDay`. For new venues, use an empty plot, update drawing and schedule configuration, and keep attendance bounded. Use `eventMinutes` and `isEventLive` for schedules that cross midnight, and `eventAtVenue` when a venue hosts multiple events. Reserve plots centrally so both UI choices and local-save/CI validation agree. Do not convert another contributor’s home into a public venue. A new outing takes a place in the seat order, its lines and leave-outs, and its own row in the exclusivity table.

`EVENT_SPOTS` defines physical positions and facing directions relative to each plot center; its length is the venue capacity. The Riverside's spots are in `DISTRICT_SPOTS`, in absolute tiles. Keep spots inside the public lawn and away from furniture, more than 0.6 tiles apart, with approaches that start on a road tile's centre and pass 0.3 tiles clear of the other spots. The simulator routes to those positions, so update artwork and approach paths together when changing them. A first contribution still needs no extra JSON fields.

## Verification

Run `npm run check`, `npm run format:check` and `npm run check:full-town`, which runs the whole suite with a made-up house on every free plot.

- `tests/events.test.ts`, `tests/trip-routes.test.ts` and `tests/living-town.test.ts`: UTC rollover, stable selection, reserved plots, attendance limits, road paths, no route that turns back on itself, lanes that draw walkers together side by side, seat crouches, poses held a minute at least as guests settle in and get up to go, quarter turns at spots and on the doorstep, the quiet crowd and the zoo, no teleporting at arrival or departure, early guests waiting at their spots, indoor routines, and exact event boundaries.
- `tests/event-seats.test.ts` fills synthetic towns of 230 houses for a town year: every seat is filled when enough neighbors can make it, a film seat stays empty only for a guest who can't reach the film and be home by bedtime, no spot is ever shared or over capacity, the tube never costs a trip made on foot, every trip keeps to its window and bedtime while rides and parcels never share the tube, seats go round the town, every night owl who can dance alone dances on some nights, every trip is worth the walk and keeps two minutes apart at every door and gate, a previewed draft never moves anyone, and the draw is the same in every browser language and roster order.
- `tests/outings.test.ts`: the Riverside over a year in the four towns: every seat on each of its days and none off them, one outing a period, the Bandstand's spots, turn tickets, the headways and worth, no other guest list changed on a day without a festival, at most one guest moved by a newcomer, the same plan for any roster order or language, drafts, every guest inside their venue's ground, what they carry and when, every regatta guest at the water for their own boat, a builder at every snowman stage, and the real town's outings.
- `tests/journeys.test.ts`: the worst trip from every house plot to every venue within its ceiling, and the narrowest routines' reach.
- `tests/full-town-feel.test.ts`: side by side on the busiest days, no teleport on the festival days, greetings at the Riverside's busy gates, quarter turns at the fair and the table, and the cost of a frame.
- `tests/district-places.test.ts`, `tests/district-hooks.test.ts` and `tests/district-render.test.ts`: the frozen grounds, spots, approaches, props, calendars and copy; the events list, cards, links, music, live shots, labels and carries; every painter's culling, caps, amber and the paper boats under the bridge.

Verify the venues at close zoom and on mobile after artwork changes. For repeatable checks, run the development server and open `/tests/manual/events.html`: its buttons render lunch, concerts, travel and bedtime with the real renderer and residents. Enable **Full venue + overflow** to exercise a sixteen-resident crowd, and **Animate preview** to inspect gestures and movement. `/tests/manual/district.html` shows each Riverside venue at its own frame on any day and minute, with the published town or a full one. Neither page changes the live clock, saves houses, or enters the production build.
