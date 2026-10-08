# The Treeline

Seven public plots hold the halts of the Treeline, one glass bore round three edges of town for people and parcels. In line order they are Barley Halt on R1, Willow Halt on N1, Hedgerow Halt on C1, Hawthorn Halt on A9, Watercress Halt on C15, Kingfisher Halt on L15 and Bulrush Halt on R15. Each halt takes a single plot, so it removes no road and no lamp. All seven plots are excluded from the builder and contribution validation, which leaves 230 house plots.

The glass runs low behind the edges of town. Down the west edge (x = −0.5) and along the north edge (y = −0.5) it is a 5-pixel tube 8 pixels off the ground, behind the tree lines, showing only in the gaps between the trees. At the north-east corner it curves round the river's head, easing down to 5 pixels, and runs down the far bank of the river (x = 63.5) as 4-pixel glass: a pale hairline threaded behind the willow trunks. It fades as the map zooms out and never carries snow. Each halt is one slim glass stack, 12 by 48 pixels, with a stone pad at its foot and a small lamp hanging under its hood, standing at the front of a plot that stays a meadow. From each stack a spur runs out at 39 pixels and dips to the trunk. Hedgerow Halt also has a tiny pale-green enamel sign and an umbrella stand, and it is where the parcels go from. Open `#venue=tube`, or click a stack, the sign or the glass. The camera frames the halt with its spur and the trunk behind it, beside the desktop panel or above the mobile panel.

## The panel

The panel opens with the halt you chose: its name and plot, where it stands, and its minutes to the halts either side, by glass and on foot. Then it says who is on the line now, under one line for the whole loop, "Seven halts round the edge of town, one bore.", with Hedgerow Halt to Willow Halt timed beside it; then how many rides the day holds and when the next one leaves, and where the parcel is. The sign follows, word for word.

| Halt            | Where it stands (the halt's heading)               | Either side, by glass, then on foot                                  |
| --------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| Barley Halt     | The south-west end of the line.                    | Willow Halt about 7 minutes; on foot 63                              |
| Willow Halt     | On the west edge, on the road to the zoo gate.     | Barley Halt about 7, Hedgerow Halt about 9; on foot 63 and 150       |
| Hedgerow Halt   | The halt with the sign and the umbrella stand.     | Willow Halt about 9, Hawthorn Halt about 10; on foot 150 and 125     |
| Hawthorn Halt   | The one halt on the north edge.                    | Hedgerow Halt about 10, Watercress Halt about 9; on foot 125 and 100 |
| Watercress Halt | Across the duck street from the Market Square.     | Hawthorn Halt about 9, Kingfisher Halt about 9; on foot 100 and 125  |
| Kingfisher Halt | Its bridge spans the regatta course.               | Watercress Halt about 9, Bulrush Halt about 7; on foot 125 and 88    |
| Bulrush Halt    | The south-east end of the line, down the far bank. | Kingfisher Halt about 7 minutes; on foot 88                          |

When Hedgerow or Willow Halt is chosen, its own block already times the oldest stretch, so the line block keeps only the loop's line. `#venue=tube` chooses Hedgerow Halt. The halts' headings are scenery: the regatta course is the river's own whether a regatta is on or not, and nothing is counted.

## The halts

| #   | Plot | Halt            | Edge  | Door         | Stack        | Tap (tiles along the line) |
| --- | ---- | --------------- | ----- | ------------ | ------------ | -------------------------- |
| 1   | R1   | Barley Halt     | west  | (3.5, 73.5)  | (3.5, 72.8)  | −71.00                     |
| 2   | N1   | Willow Halt     | west  | (3.5, 57.5)  | (3.5, 56.8)  | −55.00                     |
| 3   | C1   | Hedgerow Halt   | west  | (3.5, 13.5)  | (3.5, 12.8)  | −11.00                     |
| 4   | A9   | Hawthorn Halt   | north | (35.5, 5.5)  | (35.5, 4.8)  | 36.57                      |
| 5   | C15  | Watercress Halt | bank  | (59.5, 13.5) | (59.5, 12.8) | 76.14                      |
| 6   | L15  | Kingfisher Halt | bank  | (59.5, 49.5) | (59.5, 48.8) | 112.14                     |
| 7   | R15  | Bulrush Halt    | bank  | (59.5, 73.5) | (59.5, 72.8) | 136.14                     |

Each stack stands 0.7 tiles in from the plot's doorstep. The tap is where the halt's spur meets the trunk, measured along the line from the north-west corner, so the line order is the order of the taps. A halt's edge follows its plot: the first column is west, the last column is the bank, and the first row is north.

- **West halts** (Barley, Willow, Hedgerow) keep the original Γ spur: out at 39 pixels over the lawn and the west lane, a dip from x = 1.35 to the edge, and an elbow of radius 0.5 onto the trunk. Hedgerow Halt's door is on road y = 13, which runs east to the Lunch Green, and Willow Halt's on road y = 57, which runs straight east to the zoo's north gate.
- **Hawthorn Halt** has an I spur: from the stack it runs straight north at 39 pixels to y = 1.35, dips to the edge, and takes an elbow east or west onto the north run. It has no dock bubble.
- **Bank halts** (Watercress, Kingfisher, Bulrush) have a Γ bridge: north over the lawn to the dock, then east at 39 pixels over the lawn and the riverside road to x = 61.65, then down over the river to the far bank with the same easy slope, and an elbow north or south onto the bank run. Kingfisher Halt's bridge spans the regatta course at y = 47.5, so paper boats drift under it while capsules slide over. Each bridge rests on one slim pier mid-river (see [Close up](#close-up)).

Every spur clears a walker: the underside stands at least 35 pixels over the walkers' band of the lane or road it crosses, against a 31-pixel walker. Three far-bank trees give way to the bridges, at (63, 11), (63, 47) and (63, 71).

## Riding only when it saves time

A ride's minutes are fixed: 2 to board, which includes the 0.7-tile walk from the road to the stack, the turn, the crouch and the fwoomp; the glass at 10 tiles a minute; and 2 to step off, settle and walk back out to the road. So a ride takes 4 + length / 10 minutes.

A neighbor rides only when, door to door, the tube is faster than walking the whole way by at least ten unhurried minutes (`TUBE_MIN_SAVING`), or by 0.4 times the ride's fixed minutes where that is more (`tubeMinSaving`). Only Barley to Bulrush asks for more than ten: 10.31. The choice tries every pair of halts that clears its own saving and takes the fastest, ties going to the first pair in line order.

| Pair    | Glass tiles | Fixed min | On foot, door to door |
| ------- | ----------- | --------- | --------------------- |
| R1–N1   | 26.498      | 6.650     | 63                    |
| R1–C1   | 70.498      | 11.050    | 200                   |
| R1–A9   | 118.066     | 15.807    | 313                   |
| R1–C15  | 157.669     | 19.767    | 363                   |
| R1–L15  | 193.669     | 23.367    | 250                   |
| R1–R15  | 217.669     | 25.767    | 175                   |
| N1–C1   | 54.498      | 9.450     | 150                   |
| N1–A9   | 102.066     | 14.207    | 263                   |
| N1–C15  | 141.669     | 18.167    | 313                   |
| N1–L15  | 177.669     | 21.767    | 200                   |
| N1–R15  | 201.669     | 24.167    | 225                   |
| C1–A9   | 58.066      | 9.807     | 125                   |
| C1–C15  | 97.669      | 13.767    | 175                   |
| C1–L15  | 133.669     | 17.367    | 288                   |
| C1–R15  | 157.669     | 19.767    | 363                   |
| A9–C15  | 50.101      | 9.010     | 100                   |
| A9–L15  | 86.101      | 12.610    | 213                   |
| A9–R15  | 110.101     | 15.010    | 288                   |
| C15–L15 | 46.563      | 8.656     | 125                   |
| C15–R15 | 70.563      | 11.056    | 200                   |
| L15–R15 | 34.563      | 7.456     | 88                    |

Hedgerow Halt to Willow Halt is the oldest stretch of the line and has not moved by a hair: 40 route points and 54.497876192710336 tiles, 9.45 minutes door to door against 150 on foot.

The choice is unhurried and ignores the timetable, so it is the same for a home and a destination every day, in both directions. Over every house plot and the six destinations the tests use (the stage, the green, the cinema, the football, the Millpond and the zoo), 542 pairs ride, and the smallest ride saves 10.79 minutes. Of the 230 house plots, the seat-0 trip rides for 76 to the football, 130 to the green, 86 to the zoo, 48 to the Millpond, 125 to the stage, 77 to the cinema, 193 to the market, 131 to the Boat Landing, 164 to the farm and 130 to the Bandstand. Nearby trips stay on foot.

Only walking hurries, never past 1.4 times the usual pace; the glass keeps its own speed. Because every pair's saving is at least 0.4 times its fixed minutes (`TUBE_SAVING_SHARE`, tested equal to the hurry), the tube stays faster even at full hurry, so a trip that rides never fails where walking the whole way would have made it. The way home is the same choice, never decided again. Every trip before a neighbor's first ride of the day is planned as it would be on foot with the same outings, moved only in time by the door and gate headways, and a test compares the two plans. A rider's last walk joins the venue's own path where the road first meets it, so nobody walks past the zoo's gate and back. Neighbors who walk the whole way join it the same way, and a trip rides only while the tube still saves its minutes against that shorter walk.

Seats go down each day's line to the next neighbor who can make it, and a far neighbor whose turn comes keeps it by riding, where without the tube the seat would pass to the next neighbor who can walk. So the tube changes who goes as well as how. Two riders never reach the same door within two minutes of each other (`TUBE_DOOR_HEADWAY`): the planner moves one of them, so boarders are spaced out at the stack.

| Town                      | Rides a day (most) | Most in the glass at once | Most in one stack at once |
| ------------------------- | ------------------ | ------------------------- | ------------------------- |
| Real, 30 homes            | 24.7 (40)          | 6                         | 2                         |
| Full, 230                 | 90.3 (126)         | 9                         | 2                         |
| Mixed routines, 230       | 93.9 (118)         | 9                         | 2                         |
| Everyone out all day, 230 | 96.0 (130)         | 13                        | 2                         |

Measured over 28 sample days with every outing seated. The stack's clip holds four figures side by side, and a test holds a full town to that over 28 days, and the glass to 24 riders at once.

## The halts and the sign

Hedgerow Halt on C1 carries the sign (`TUBE_SIGN_STATION`), the umbrella stand and the parcels. Nothing reads the first or the last halt in the list as "the sign" or "the ends".

The sign reads "People & parcels. Please remove umbrella." word for word. It is painted in three lines, "People & parcels.", "Please remove" and "umbrella.", in bold 4-pixel Space Mono on a 44 × 15 plate of pale lawn-green enamel that faces the road, just right of the stack. At the town's usual zoom it is a small green plate; the lettering reads from about zoom 3. The panel is where it is read: it shows the same words as real text on a plate in the sign's own colors, which it keeps at night because it is a physical sign. The other halts have no sign.

West of Hedgerow Halt's walk-in stands a small brass bucket with one furled plum umbrella, crook handle up, so every neighbor boarding there passes it.

## Boarding, riding and stepping off

Boarding takes two minutes. The neighbor walks from the door to the stack, back to the camera, at 0.4375 tiles a minute, and steps in at 1.6 minutes. Inside the glass they turn to face out, crouch at 1.8, and at 1.88 the fwoomp stretches them up the glass and into the hood by 2.0. Two rings of air and four bits of grass puff out around the stack's foot for half a minute.

In the glass they are a tiny figure in their own colors, head first, with a faint streak of those colors behind. They whoosh along the spur, dip behind the trees at the elbow and run along the trunk at 10 tiles a minute: 5.45 minutes from Hedgerow Halt to Willow Halt, 21.77 from Barley Halt round the whole line to Bulrush Halt. The glass washes over them, so they read as inside it. The little figure is straight, so where the glass turns (a stack's top, the corner over the lawn, the dip, the elbow, the corners of town) it is cut short at the turn rather than sticking out into the air.

At the far stack they drop down the glass in 0.12 minutes, with another puff, settle by 0.25, and walk out to the door by 2.0, toward the camera, at 0.4 tiles a minute.

Two at once: riders within 0.45 tiles of each other in the glass are drawn one just behind the other, two figures in a stack stand side by side 3 pixels apart and each crouches a moment after the one before, and two walking in or out together keep 3 pixels apart. Riders going opposite ways would pass through each other in the single bore; a crossing lasts about a frame and is accepted.

The labels read "Boarding the tube to Willow Grove Zoo", "Riding the tube to Willow Grove Zoo", "Boarding the tube home from the zoo", "Riding the tube home from the zoo" and "Stepping off the tube at Willow Halt", with every other outing named the same way: "Riding the tube to Market Square", "Riding the tube home from the regatta". They show in the follow status, the neighbors list and the house card. Walking legs keep their usual labels.

## Parcels

Parcels ride between Hedgerow Halt and Willow Halt only (`TUBE_PARCEL_ROUTE`), so they never reach the river. A daylight timetable offers a slot every 20 minutes from 07:00 to 19:00, each leaving up to six minutes late by a seeded hash of the day, alternately from each end; about one slot in four stays empty. A parcel waits on its pad for half a minute, rises into the stack, rides stack to stack in 5.45 minutes, drops onto the far pad and waits there half a minute to be collected. A slot is skipped whenever its episode would come within a minute of anyone boarding, riding or stepping off anywhere on the line, so a parcel never shares the glass, a stack or a pad with a person. The last one is collected by 19:12, before the night begins at 20:00, so no parcels run at night. The real town sends 16.8 parcels a day (13 at least), and a full town, whose riders fill more of the day, about 11. Parcels get no puff. The panel says when the next one leaves, or that one is waiting, in the glass or just arrived.

## Quiet on purpose

- **Behind the trees.** The west run, the north-west corner, the north run, the north-east corner and the bank run are painted with the ground, before the town's depth sort, so every edge tree and far-bank willow stands in front of the glass and its riders, and the line shows only in the gaps. Riders in that glass are painted straight after the ground. The spurs are sorted with everything else, so a walker on the riverside road passes under a bridge.
- **Posts.** 37 trunk posts: on the west run every four tiles (y = 3.5, 7.5, 15.5 … 51.5, 59.5, 63.5, 67.5, skipping halt rows), on the north run every second plot column (x = 7.5 + 8k up to 55.5, skipping Hawthorn Halt's 35.5), and down the bank every plot row from 15.5 to 67.5, skipping Kingfisher Halt's 47.5, with two pilings in the pool at the river's head at y = 3.5 and 7.5. Trunk posts are 6 pixels tall and bank posts 3. Each west spur has one 27-pixel post in the tree-free tile beside the lane, Hawthorn Halt's stands at y = 0.62 under its I spur, and each bank bridge has one slim pier mid-river at x = 62.38, about 27 pixels tall, standing in the water instead of on a shadow. Glass bubbles sit where a middle halt's spur tees into the trunk.
- **It fades with distance.** The glass is drawn at `clamp((zoom − 0.3) / 1, 0.35, 1)`: 0.35 at the whole-town zoom, 0.40 at the opening view's 0.7, and full from 1.3. The stacks, the sign, the stand, the posts, the pads and the riders themselves stay at full strength; the whoosh is how the line is found. The discoverability floor is tested: at the opening zoom the glass highlight still stands at least 40 levels off the lawn. At whole-town zoom the line is a near-invisible pale line round three edges.
- **Hover and selection.** A hover or a selection marks one halt, and everything of the line that is that halt's own lights with it: its spur, its dock bubble, its spur post or pier, its stack, and in the cached ground its elbows onto the trunk, its stem and its T bubble. Hovered, the glass's highlight turns pale gold, at no extra cost; selected, a pale gold halo runs round the glass and stands behind the stack's. Close up, the halo stops short of the trunk between the elbows. Its plot lights too. The runs of trunk never light, so a mark repaints only the halt's own rectangle (`tubeMarkArea`): its plot, widened over its elbows and its T, at most 291 × 160 pixels.
- **Low and small.** A stack with its hood is 48 pixels tall, 49 with snow, and the tests hold it to 50. The sign is 25 pixels, the umbrella 17, and the spurs run 36.5–41.5 pixels above the lawn, so a 31-pixel walker clears their underside.
- **The meadow stays.** The halt plots keep their wildflowers, and the daisies still grow under the spur. Only the sprout stake, the plot label and the dashed outline are left out.
- **Amber stays with light.** The glass stays cool, day and night. The only amber is the lit lamp in each of the seven hoods and its glow. See [the amber budget](BRAND.md#the-amber-budget).
- **No crowd promised.** The panel names neighbors only while they are on the line, and never names anyone before they ride. Two neighbors who share a name read "Two neighbors named Jon are on the line.", never "Jon and Jon". Headings end with a period, eyebrows are uppercase, and there are no exclamation marks.

## Close up

From zoom 1, where every pixel shows, the line keeps a few more things; below it the plain art stays, so the opening view and the whole town cost what they did.

- **The bends keep their width.** Glass is painted in vertical slices, which keep a straight run its 5 pixels but pinch a bend that runs straight down the screen to a wire. The corner round the river's head, and the elbows where Watercress and Kingfisher Halt's bridges turn south onto the far bank, run that way, so close up each is filled as one outline instead: 5 pixels across the screen where it runs down, and 5 down it where it runs across, with its highlight and rim as 1-pixel lines along it. The highlight slides to the middle of the glass where it runs straight at the viewer, as a tube's top would. The outline's ends are cut straight up and down, so it meets the slices of the piece beside it without a step.
- **The folds never cross themselves.** Barley, Willow and Hedgerow Halt's elbows north, and Hawthorn Halt's elbow west, fold back across the screen: their two legs run a few pixels apart, so their slices would overlap and the far leg's rim would cut across the near leg's highlight. Close up each is split at the fold into its two legs, each in slices: the nearer leg first, then the farther one kept out of it, so the hairpin reads as one tube passing behind itself.
- **The T.** At a halt between two others, the dip splits into two elbows that join the trunk a tile apart, with the T bubble between them. Close up, the halt's own glass is painted together, the nearest run first, each kept out of what is already there and all of it kept off the trunk between the elbows: the translucent glass never doubles up, the trunk runs on unbroken, and the elbows tuck in behind it like fillets. At Watercress and Kingfisher Halt the elbows open round the bubble on screen, so a short stem runs straight on from where the dip splits into the bubble, and the T stays joined, gold and all, when the halt is selected. At the west and north halts the elbow toward the viewer already carries the dip past the bubble, so there is no stem.
- **Still water.** The bank glass runs 5 pixels over the river's head pool, so its reflection lies 5 pixels under the water line there. It is drawn in the river's own hand, as short flat 1-pixel ticks like its glints, 3 to 9 pixels long and 7 to 12 apart, the same every day, broken at each piling and stopping where it would land past the pool. The two pilings in the pool stand in a flat ring with a short dark reflection, and each bank pier in a wider ring with a broken one. Zoomed out, a pier keeps a plain pale ripple.
- **The piers.** A pier is a slim two-sided column on a stone foot, dry on top and darker where the river wets it.
- **The far bank.** Down the far bank's grass the glass lays a faint 1-pixel shade under itself.
- **The hood lamp.** It hangs under the hood's lip in a dark frame (see [Night and winter](#night-and-winter)).

## Night and winter

The lamp in each hood lights in the streetlamp wave, between 20:20 and 20:30, by its distance from the Fork, with two modest glows, one at the hood and one at the pad. It hangs under the hood's lip in a dark frame, like a streetlamp's head: pale by day, grey at night until the wave reaches it, then amber with a hot middle. The reflections on the river take the night's colors and stay cool. The glass takes its night colors, with the highlight at about 45%, and stays cool. The sign keeps its colors and its ink is never brightened. A late rider standing in the lit stack is the nicest frame of the night.

In winter, snow lies on three surfaces only: the hoods, the top of the sign and the bucket's rim, faded in and out with the town's snow cover. There is no snow on the glass or the posts, and the meadow's frost shows through the glass. Autumn's golden hour washes over the line as it does over everything else.

## Following a rider

- **On the map.** Follow a neighbor from the neighbors list, and while they board, ride and step off the camera follows the figure itself: up the stack, along the glass and down again. The height is continuous across every stage, so the map never jumps. The follow status reads their label.
- **On `/live`.** Riders can be followed like anyone outdoors. While a neighbor rides, the camera eases with a 0.12-second time constant instead of 1.6, so the glass stays in frame at 10 tiles a second, and it settles as before once they step off. The shot center and the name label rise with them, so neither dips. See [the live broadcast](LIVE.md).
- **In the glass.** There is no foot diamond in the glass; a followed rider's glass glows faintly gold instead. In a stack the diamond sits at the stack's foot.
- **Clicks.** Riders in the glass and figures in a stack cannot be clicked; a click there selects the halt. A click on the glass of a run selects the halt whose tap is nearest along the line. Neighbors walking to and from a stack can be clicked as usual. Hovering a halt names it: "Kingfisher Halt · The Treeline".

## Growing the line

The line is one bore round three edges, and `TUBE_HALT_PLOTS` lists its halts in line order (a check at load throws if the taps are not increasing). The model handles any number of halts: `tubeChoice` tries every pair, and `tubeRoute` builds any pair from its two spurs and the trunk between their taps, corners included. So does the art, which cuts its glass from every halt's own spur and one trunk run between consecutive taps, and hands each ride to its pieces by halt and direction. What a new halt still needs:

- **A plot on an edge.** The first column, the first row or the last column; `tubes.ts` refuses any other plot. Reserving it takes one house plot, and every count that follows `HOUSE_PLOTS` moves with it.
- **Its gap in the trees.** `TUBE_TREE_GAPS` follows the halts, and the edge-tree filter in `render.ts` skips each halt's crossing tile. On the west and north edges the crossing tiles are already free of trees; on the bank a willow gives way.
- **The posts.** Trunk posts skip each halt's own row or column by themselves, and a bubble takes the place where the new spur tees in.
- **The pinned numbers.** The pair table, the taps, the 37 posts, Hedgerow to Willow's 40 points and 54.498 tiles, and the riding pairs are pinned in `tests/edge-loop.test.ts`, `tests/tubes.test.ts` and `tests/tubes-render.test.ts`, and each moves with a new halt.

A wider town moves the river east, and with it the bank run and the three bank halts: they move to the new last column in the same change (see [Expanding the town](EXPANDING_THE_TOWN.md)). A longer town extends the west and bank runs.

One halt is still a candidate. **G1, Meadow Halt**, on the west run: its stack would stand at (3.5, 28.8) and its spur run along row 27.5, where the column-0 pieces sort at depth 26.9, behind the row-27 edge tree. Leave out its spur post, or move it to x ≈ 0.9, and check 26.9 against the tree's 1.48 scale and ±7-pixel jitter; failing that, skip that one edge tree.

## Follow-ups

- **A keyboard route to the line.** The Explore directory lists homes and open plots, and the events list has no entry for the Treeline, so a keyboard user reaches it only through `#venue=tube`. The zoo's card tells visitors they may take the tube, which makes the gap easier to notice. Moon Harvest Farm has the same gap.
- **Two piers behind a willow.** The far-bank tree one row south of Watercress and Kingfisher Halt's gaps, at (63, 12) and (63, 48), stands within 6 pixels of that halt's pier on screen and in front of it, so those two piers show only as a column above a crown; Bulrush Halt's, with no tree there, stands clear. The same tree at (63, 48) stands in front of the regatta lane where it passes under the Kingfisher bridge, and in the `/live` regatta frame at 15:15 Kingfisher's pier shows as a bare column over its crown. The tree gaps are fixed in `TUBE_TREE_GAPS` and `render.ts`; leaving out those two trees would show both piers and the boats under the bridge.

## Determinism

Everything on the line is a pure function of the places, the town day and the minute, like the rest of the simulation. One route geometry, `tubeRoute`, a 3-D polyline of ground tiles and centerline heights, is read by both the renderer and the model, so a rider is always drawn inside the glass. The route, each halt's tap, the tube choice for each start and end, and each day's rides per roster are memoized, but all are pure, so no answer depends on what was asked before. The parcel timetable seeds from `hash()` of fixed `tube-parcel:` strings. There is no `Math.random`, no `Date`, no storage and no canvas created at module load, so node tests can import every module. Everyone sees the same rides at the same moment, even after a refresh.

## Performance

Measured with the recording context in node. The frame rows count the ground layer too, because node has no cache. `drawGlow` does nothing in node, so a lit lamp adds two `drawImage` calls in the browser that these numbers leave out.

| Frame                                                                    | Line's calls (quiet)            | Cap             |
| ------------------------------------------------------------------------ | ------------------------------- | --------------- |
| Test camera box (zoom 0.7)                                               | 173, ground 84                  | 250, ground 100 |
| Whole town at fit, 1440 × 900 (zoom 0.245)                               | 513                             | 1,050           |
| Each bank halt in view, depth objects (stack, bridge, pier, dock bubble) | 89 (107 selected); 0 off-screen | 150             |
| A halt's own glass close up, in the cached ground (elbows, stem, clips)  | 118 at most, selected           | 150             |
| The real opening frame, 1120 × 640 (zoom 0.35)                           | 230 at most                     | 250             |
| The real opening frame, phone 390 × 440 (zoom 0.176)                     | 225 at most                     | 250             |

The bank halt row counts the depth objects drawn every frame, at zoom 1 and 3. The halt's elbows, its stem and T bubble, and its pier's ring and reflection lie in the cached ground, which is painted once per cache and repainted only inside the halt's rectangle when it is marked. Close up, a halt's own glass there costs 71 calls at a west or north halt (102 selected), 82 at Watercress and Kingfisher Halt (118 selected), and 30 at Barley Halt (34), most of it the clips that keep its runs apart; Bulrush Halt's one elbow is plain slices.

The opening frame is measured with the published town at every ride moment of a summer day and at 10:00, 12:00 and 20:10. The close-up art (above) starts at zoom 1, so of it these frames pay only for the hood's lip and the lamp's frame, at the test box's 0.7. Below zoom 1 the glass drops its 1-pixel rim and paints each corner in four slices instead of eight; below zoom 0.5 it also drops its 1-pixel highlight, posts become one stroke, and the stacks, the sign, the stand, the puffs and the pads drop their sub-pixel rows. Piece geometry, painters and hit-testing are the same at every zoom. Every part keeps its own cap in the tests (a spur's glass, a bubble, a post, an empty stack, a stack's share on top of its figures, the sign, the stand, a puff, a rider and a parcel). The ground cache holds the pads, the trunk posts and pilings, the reflections, rings and shade, and the glass of the runs, corners and elbows. It reads only `night`, the zoom, the view and the halt marked, never the minute, so the riders, the parcels, the lamps and the snow are drawn every frame, and a mark repaints only its halt's rectangle. Nothing is added to `drawFarFields` or `drawSky`.

## Code and verification

- `src/lib/tubes.ts`: the halts (`TUBE_HALT_PLOTS`, `TUBE_STATIONS`, with each door, stack, dock and edge), the reserved plots, the sign station (`TUBE_SIGN_STATION`), the parcel route (`TUBE_PARCEL_ROUTE`), the sign and its three lines, `TUBE_VENUE`, the camera frame, the timing and the saving rule (`tubeMinSaving`), the door headway, the trunk geometry (`trunkPoint`, `trunkS`, `stationTap`, `loopSpur`, `tubeTrunkBetween`), the one shared route geometry (`tubeRoute`, `tubeLength`, `tubeAt`), `TUBE_TREE_GAPS`, a resident's `ResidentTransit`, `tubeStageTime`, `tubeInStack`, and the parcel timetable. It imports nothing but the world, so the build-time schema can import it.
- `src/lib/tube-journeys.ts`: tube or walk (`tubeChoice`), the legs of a tube journey (walk, board, ride, step off, walk), `joinApproach`, `reverseLegs`, `tubeLineMinutes`, and `journeyAt`, where a traveler is at any minute, with the same running sums as `tubeRides`, so the panel and the town change stage at the same instant. The last frame of a walk keeps its last stretch's facing.
- `src/lib/tube-traffic.ts`: the day's rides, read from the same plans the residents follow (`tubeRides`), the parcels that never share the tube (`tubeParcels`, `tubeParcelsAt`), and `tubeStatus`, everything the panel needs.
- `src/lib/tube-copy.ts`: the line's voice. It writes the panel's words for every status and every halt chosen on the map (`TUBE_HALT_NOTES`, `TUBE_LOOP_LINE`), and the `PUBLIC SPACE · R1 / N1 / C1 / A9 / C15 / L15 / R15` label.
- `src/lib/walking.ts`: `planJourney`, which adds fixed minutes that never hurry and keeps every trip worth the walk; `planTravel` is the same with none.
- `src/lib/resident-trips.ts`: the tube block in the trip planner, the door and gate headways, and `planResidentTrips(…, { tube: false })`, the same day's guests with nobody riding (not the town without the tube, whose lines would pass a rider's seat on).
- `src/lib/simulation.ts`: `ResidentState.transit`, the tube labels and `townClock`, the minute wrap the panel shares with the town.
- `src/lib/live-director.ts`: `liveEaseSeconds`, `liveCenterLift` and `liveLabelLift`, so `/live` keeps a rider in frame.
- `src/lib/events.ts` and `schema.ts`: the reservation of the seven halts.
- `src/city/tubes.ts`: the art. `drawTubeGround` paints the pads, the trunk posts and pilings, and the glass of the runs, corners and elbows into the ground cache; `drawTubeTraffic` paints riders and parcels there every frame; `drawTubes` returns the depth objects: spur pieces with their riders, tee and dock bubbles, spur posts and river piers, the stacks with everyone and everything inside them, the sign, the umbrella stand and the puffs. `tubeHit` picks the stacks, the sign, the stand and the glass; `tubeMarkArea` is the rectangle a mark may repaint; `tubeGlassEdges`, `tubeGlassRuns` and `tubeStem` give the tests a bent piece's two edges, the runs each piece is painted in close up, and a bank halt's stem.
- `src/city/render.ts`: the plot-loop skips, the three layers, the walk-in offsets, the edge-tree gaps, the halt marks (`tube:<halt>`), and picking in `cityHit`. `src/city/residents.ts` gains a `shadow: false` option for figures in a stack.
- `src/components/TubeInfo.tsx`: the line's panel, with the sign as real text, styled by `.home-sign .tube-sign` in `src/explore.css`; it takes the selected halt as `station` and opens with that halt's block.
- `src/films/ads/the-treeline.ts`: the cinema's 20-second ad. The umbrella meets the sign at Hedgerow Halt; the ride runs behind the trees under a strip that maps the whole line, seven stops in their places along the loop with the stretch from Hedgerow to Willow lit; the drop is at Willow Halt. `tests/ad-tube.test.ts` holds the story's beats, the sound on the picture, the real sign, the strip and the one caption. `App.tsx`, `City.tsx` and `LiveStream.tsx` handle `#venue=tube`, the camera, the tooltip, following a rider on the map, and `/live`. `ZooInfo.tsx` says far visitors may take the tube when it saves time.
- `tests/edge-loop.test.ts`: the line order, taps and arcs; all 42 ordered pairs continuous, symmetric, 4 + length / 10 minutes and saving at least 0.4 times that; every route point on the trunk or its own two spurs; the spurs' clearance over the walkers; the longest ride; Hedgerow to Willow unchanged; the sign station; parcels only between Hedgerow and Willow, never with a rider; the tree gaps; and a full town's traffic: four in a stack and 24 in the glass at most, four parcels a day at least.
- `tests/tubes.test.ts`: the reservation (seven halts, 230 house plots), roads and lamps, the sign and the names, doors, stacks and docks, the halts in line order, the route (40 points, 54.498 tiles, continuous, low behind the trees and clear of walkers), the riding pairs re-derived from every house plot, the same answer both ways, `planJourney` with worth, `leaveStagger` and `leaveCap`, a full journey without a jump, the facing at the end of a walk, `tubeInStack`, `joinApproach`, the parcel slots and purity.
- `tests/tube-travel.test.ts`: a year of trips. Every trip before a ride is planned as on foot, moved only in time, no trip the walking plan keeps is lost, even for far night owls, rides save their pair's minutes, riders move continuously, rides and parcels keep to their windows and never share the tube, the panel's status matches the town, also at every ride's board, depart, arrive and step-off instant and the whole minutes near them, riders are home before their next commitment, the labels by each ride's own halts, and rides across midnight.
- `tests/tube-riders.ts`: helpers the travel tests share: `onTubeLine` (every halt's walk to its stack and the glass between every pair of halts), `riding`, `onRoadOrTube`, `stepBound` and `stationWalk`.
- `tests/live-director.test.ts`: a rider stays near the center of `/live` and the label and center never jump.
- `tests/tubes-render.test.ts`: the call budgets per frame and per part, the real opening frame, the heights, the posts, the discoverability floor, no snow on glass and amber only when lit, the palette clear of every season swatch, the sign word for word, one painter per rider, every rider and parcel inside its glass round corners, bends and stack tops, a parcel on the pad with neighbors boarding beside it, glass built from every halt and one trunk run between consecutive taps, figures in a stack drawn once with no floating shadow, the depth order on every run, a mark that lights one halt's own glass, in the ground only inside its rectangle, close up the glass keeping its width round every bend and never turning back across the screen within a run, each middle halt's dip running into its T with its glass clipped off the trunk and its junction within 150 calls, reflections (short flat ticks) and rings only on the river, the hood lamp's hot middle only while lit, the meadow, determinism and purity.
- `tests/map-interactions.test.ts`: riders in the glass and in a stack are never hit, neighbors walking to a stack are; the stacks, the sign and the glass select the halt, the glass between two halts the nearer tap, behind houses and walkers in front.
- `tests/tube-ui.test.ts`: the wiring, the panel's markup and the sign exactly once, the chosen halt's block for every halt (where it stands, its minutes either side, the oldest stretch timed once), the brand voice over every status, with every halt chosen, and over a real year, riders named only while on the line, two neighbors with one name never read as "Jon and Jon" (on every pair of halts and at every stage), and purity. `tests/brand.test.ts` checks that a `#venue=tube` link skips the welcome card.
- The counts in `tests/events.test.ts`, `lanterns.test.ts`, `millpond.test.ts` and `contributions.test.ts` follow `HOUSE_PLOTS`, and the tube's own bounds in `zoo-travel.test.ts`, `living-town.test.ts` and `night-walks.test.ts` keep their walkers' bound.
- `/tests/manual/tubes.html` on the development server draws Year 3 with the real renderer and residents. **Scenes** jumps to Hedgerow Halt at noon, boarding at C1 (the walk in, the crouch and the fwoomp of the day's first daytime ride from Hedgerow Halt), riding the trunk (the day's first daytime ride), stepping off at Willow Halt and walking out (the first daytime ride to it), each searched forward through the year when the day has none, Hedgerow Halt at night, snow, the opening view, the whole town, and the line selected and hovered. It has day and minute sliders, a view (`c1`, `n1`, `trunk`, `opening`, `whole`) and emphasis (`none`, `hover`, `selected`) menu, **Play** and **Next ride** (half a minute before the next boarding), and `?day=42&time=720&view=c1&emphasis=none` opens a year day (0–111) and town minute. The page stays in Year 3: Play and Next ride go round from day 111 to day 0, so the slider, the status line and the URL always name the same moment, and pausing writes the moment into the URL. It shows the panel's words for the moment beside the canvas and links to `/#venue=tube`. The page never changes the live clock or saves houses.

Run `npm run check`, `npm run format:check` and `npm run check:full-town`.
