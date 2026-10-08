# The Harvest Fair and the Long Table

Three days a year, Autumn 23–25, the west end of Moon Harvest Farm (x 14–22, y 74–81) holds the town's harvest. The grain is cut by Autumn 22 and the greens of the second bed are picked, so the field is stubble. In the afternoon there is a fair on the two footpaths, with cider pressed on the spot. In the evening a long table is laid down the middle for supper, and each guest brings a dish. Guests come in through the two gaps in the farm's west fence, the north gate at (13.5, 75.5) and the south gate at (13.5, 79.5). Who comes, where they sit and when they arrive and go are the planner's, and [Town events](TOWN_EVENTS.md) has all of it. This page is what the fair looks like and how it is drawn.

## The day of the fair

| Town time   | What happens                                                                                                                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 06:00–06:05 | The fair's things fade in: a handcart of pumpkins between the gates, bunting along the west fence, the cider press, six round bales down the middle and a small straw seat at every fair spot.                                   |
| 13:00–17:00 | **Harvest fair.** A presser walks the press's bar round, a quarter turn at a time.                                                                                                                                               |
| 17:04–17:10 | Two farmhands come to clear the fair. The press, the bales and the seats fade as they work.                                                                                                                                      |
| 17:15–17:42 | One farmhand walks the north side east to west, putting down the trestles and the boards. The other follows on the south side with the cloth, the jugs, a pumpkin, a bowl of apples and the four lamps. They leave by the gates. |
| 18:00–20:30 | A fiddler plays at the table's east end.                                                                                                                                                                                         |
| 18:30–20:30 | **The Long Table.** Each guest's dish is on the table at their place from the moment they sit down.                                                                                                                              |
| 20:20–20:30 | The four table lamps light in the streetlamp wave.                                                                                                                                                                               |
| 20:56–20:58 | The table lamps go out, after the last guest can have left.                                                                                                                                                                      |
| 20:55–21:00 | The cart and the bunting fade away.                                                                                                                                                                                              |
| 21:00–21:15 | The farmhands clear the table west to east: first the dishes, the lamps and the cloth, then the boards and the trestles.                                                                                                         |

Every time comes from `HARVEST_PROPS` in `src/lib/district-places.ts`, and every fade stays inside its prop's own window there. On any other day nothing is drawn, and the farm looks as it always has.

## What the guests do

- **At the fair**, each guest stands on the footpath when they arrive and for their last minutes, at least a minute and a half each. In between they take the straw seat at their spot for a spell or two of 9 to 20 minutes, with a cup of cider (`sip`), a word with a neighbour (`chat`) or just sitting (`sit`). Between spells they stand for 2 to 6 minutes to stretch their legs. They crouch for 0.4 of a minute on the way down and up, as everyone does at a seated outing. The fair is not a seated outing, so `fairPose` crouches them itself.
- **At the Long Table**, each guest sits, sips and chats, four to seven minutes at a time, starting with a plain sit while they wait for supper. The planner crouches them on the way down and up.
- Every pose is held a minute at least: the planner calls these functions as they are, with no hold of its own (`src/lib/outings/harvest.ts`).
- **The dish.** A Long Table guest carries a dish on the way there only: a pie, a cottage loaf or a jar of jam under a gingham cap, by `hash('dish:' + day + ':' + id) % 3`. It rides level on the near hand at the waist. Walking away from us it rides out past the near shoulder, so the back never hides it (`src/city/carry/dish.ts`). The same pixels stand on the table at the guest's place once they arrive.

## The art

Everything is in `src/city/district/harvest.ts`, matched to the town's scale: a neighbour stands about 31 px tall.

- **The stubble patch.** On Autumn 23–25 the cached ground layer lays bed 1 (x 18.2–21.5, y 74.3–81.0) over the leafy greens: its rows of soil with their furrows and picked stalks, the footpaths on through it, and loose straw where the fair stood. It reads only the season's whole day and the look, never the minute.
- **The handcart** (14.6, 77.5), 18 px at most: a two-wheeled cart against the fence, its handles down to the south, heaped with eight of the farm's pumpkins. Pumpkins never glow.
- **The bunting**: three spans of faded cloth pennants hung from the fence posts between the gates, each sorted just after its own span of fence.
- **The cider press** (19.5, 77.5), 24 px at most: a timber base, a slatted tub with two iron hoops, crushed apples round the follower block, two posts and a beam with the screw through it, and a spout over a bucket. Its bar points at the presser, behind the press while it points away from us.
- **Six round bales**, 12 px at most: straw drums stood on end, their rolled spiral on top, tied once round.
- **Straw seats**: a square of straw 5 px tall at each fair spot, under the sitter's hips.
- **The table** runs along y 77.5 from x 15 to 21, its top 7 px up, in eight segments, one for each pair of seats facing across it. Each sorts between the two: the north guests, facing us, sit behind it, and the south guests, backs to us, sit in front. A linen cloth with a faded red runner hangs nearly to the ground, the trestles' feet showing under it. Down the middle stand four lamps, two stoneware jugs, a pumpkin and a bowl of apples.
- **The table lamps**, 16 px with the table: small hurricane lamps. Each lights at the minute the streetlamp wave reaches its distance from the Fork, coming up over 0.75 of a minute, and all four go out together over two minutes at 20:56. Only a lit lamp is amber.
- **The fiddler** stands facing us at the table's east end, fiddle under the chin and bow going, and now and then a pale note drifts up.
- **The farmhands, the presser and the fiddler** are scenery, never neighbours, and never counted. Each fades in over a minute and out over a minute or less.
- **The scarecrow** wears a faded red ribbon round its hat on the three days, tied in a bow with two tails, and a sprig of wheat in the band (`drawScarecrowExtras`, called by `farm.ts`).

At night everything takes its night colours, like the houses around it. Nothing changes its opacity by more than 0.08 in a frame.

## Drawing it cheaply

The bales, seats, cart, bunting, press, each table segment, a lamp and a jug are each painted once into a sprite per kind, season day and look, at the map's device scale, and stamped from then on. A new scale (a zoom under way) is painted straight onto the map until it has held for a frame. Without a document (the node tests) or under a skewed transform everything paints directly. Painted directly, the whole fair is at most 844 canvas calls, against its cap of 1,200 (measured at 19:55 with all sixteen dishes on the table). The cap is checked every five minutes of all three days. Off-screen it draws nothing at all.

## The farm's panel

`#venue=farm`, or a click on the farm, opens Moon Harvest Farm's panel (`src/components/FarmInfo.tsx`). It keeps the farm's own line, `PUBLIC SPACE · S4–T9 · 12 PLOTS`. On a fair day it gives the fair and the Long Table, each with its eyebrow, its name, its description, its times and whether it is on. While any neighbours are there it names them, each name a link that follows them: "At the fair now: Hazel, Jon and Renan." On other days it says what the fair is and when, "Autumn 23–25.", and "Next: Autumn 23." That last line also shows once the last Long Table of the year is over. It never counts anyone.

## Checking it

- `tests/harvest.test.ts`: the poses over every fair and table visit of the full town's three days, the dish and its grip, and the panel.
- `tests/district-render-harvest.test.ts`: nothing on other days or off-screen, the cap all day, props and their times, laying and clearing, each dish from its guest's arrival, the lamps in the wave, amber, no flashing, heights, the patch covering every green, the scarecrow's hat and the sprite cache.
- `tests/manual/district.html?venue=harvest`: the moments in `tests/manual/district-harvest.ts`, from the props at dawn to the clearing, an ordinary autumn day and the day after.
