# The Paper-boat Regatta

Every Regatta Week, Summer 10–16, the Boat Landing on **J15** sends ten paper boats down the river. "Fold a boat and let the river take it. Nobody keeps the times." The regatta reports and never ranks: no winner, no times, no order. Who comes and when is the planner's (see [Town events](TOWN_EVENTS.md#paper-boat-regatta)); this page is about what you see. Open `#venue=landing` or `#venue=regatta`, or click the lawn or its landing stage.

## The Landing

A tended lawn by the riverside road, with a strip of gravel along its river edge where the front row's boats are set down and a bench on its west half looking over the water. Across the road, on the near bank, a slim timber landing stage runs along the water on low piles (`REGATTA_COURSE.stage`, x 62.0–62.35, y 37.6–39.5); its south tip is where the boats go in. No far-bank tree stands in front of it (`RIVERSIDE_TREE_GAPS` leaves (63, 39) bare), nor in front of the boats sliding under the Kingfisher bridge. The stage, the lawn and the gravel are part of the town's cached ground layer and change once a day: in winter snow lies on the deck, the piles and the bench. The Landing is there all year: "A lawn by the river. Paper boats in summer."

All Regatta Week, whatever the hour:

- **Bunting** in cream and sage hangs over the stage between two poles: a sagging line and seven little pennants, point down. Cream and sage only: the terracotta pennant is the newest neighbor's.
- **The cork boom** lies across the river at y = 51, a rope of cork and cream floats between two posts, where the boats come to rest.

## A boat's afternoon

Each of the ten guests has a boat of their own: white paper with a band in their own outfit's colour. (A bright mustard or amber outfit gives a band a shade darker: on the river only lamps are amber.) Boat k is guest k's, seat k.

1. **In hand.** The guest carries it there on the walk (`paper-boat` carry sprite): in the near hand in front of the waist, riding with the step, and behind the body when they walk away from us. It is never drawn in a tube stack or the glass. At the town's 1.25 it is 9 px across, the size it keeps on the grass and on the water.
2. **Ashore.** On arrival the guest sets it down at their own feet, a step toward the river on their own row: its row's handover point, (spot x + 0.2, 38.15 + 0.31k) (`regattaHandover`, `REGATTA_COURSE.handoverX`). For the even rows, the front column at the gravel's edge, that is x = 60.95; the odd rows stand 0.55 tiles further in, so their boats rest at x 60.4, among the guests. `regattaBoat` has each boat ashore there until its launch, and the painter draws it there. Then they stand at their spot facing the water. Every guest arrives at least five minutes before their boat's launch (measured in the real, full, mixed and eager towns); the planner never lets one arrive later than a minute before it.
3. **With the boatwright.** The boatwright, a scenery figure in a flat cap, keeps the stage from 13:45 to 16:36. For each boat in launch order they walk briskly from the stage's south tip across the road (0.78 tiles a minute, a little over twice a neighbor's stroll), to the road's lawn-side edge for a front-row boat, or on in along the boat's own row for one among the guests (the row's own approach, which keeps clear of every other guest), stoop a step east of it and pick it up once its guest has set it down, carry it back the same way and stoop at the tip. The road's walking lanes (x 61.28 and 61.72) stay clear of the stoop.
4. **On the water.** It goes in at its launch, 14:00 + 6k (`regattaBoat`), and drifts down the near half of the river, swaying on its lane, a small wake trailing up-river behind it, its fold bobbing a pixel. The boats pass the Bandstand 14:31–15:11 and slide under the Kingfisher bridge 15:02–15:29 while capsules slide over, then come to rest against the boom or the boat ahead at 15:30–15:40, a little queue of white folds and coloured bands. No boat overtakes another.
5. **In the net.** At 16:35 the boatman, another scenery figure, comes to the bank's edge by the boom (x 61.9, clear of the road's river-side lane) with a long-handled net and a basket. From 16:40 he nets the boats out one every three minutes, boat 0 first, stepping up the bank from one to the next: the net goes out over the boat and down to the water, comes up with the boat in it, and swings over to the basket beside him on the water's side, where the white folds gather. He goes at 17:10 with the basket.

A boat is in exactly one of these places at a time (`boatAt`), in that order, never back and never skipping a step, so nobody teleports and nothing floats unattended. A seat with no guest has no boat.

The guests stand and watch, facing the water. For a minute and a half from the moment their own boat comes to rest, they cheer (`regattaPose`), with no music notes over them: no music plays at the Landing. Every guest is at the water when their own boat comes in: all 70 seat-days of a regatta year, in the real, full, mixed and eager towns.

## The panel

`LandingInfo`: `PUBLIC SPACE · J15`. In Regatta Week the regatta leads all day: the outing's eyebrow, `REGATTA WEEK · SUMMER 10–16`, "Paper-boat regatta.", its line, where the boats are now ("Boats are going in, one every six minutes.", "The boats are drifting down to the boom.", "The boats are coming to rest at the boom.", "The boatman is netting the boats out.", and so on) and its hours, 14:00–16:30, then `AT THE WATER NOW` and the neighbors there, only while they are. Then "The Boat Landing." and "A lawn by the river. Paper boats in summer.", and out of Regatta Week "Regatta Week is Summer 10–16." The district panels list people in one row shape (see [The Bandstand](BANDSTAND.md#the-panel)).

## Drawing it

- `src/city/district/landing.ts` is the painter. Ground: the lawn, the gravel edge, the stage and, on regatta days, the boom. Floor: the boats' wakes, and the lawn lit when J15 is hovered or selected. Objects: the bench, the bunting, each boat ashore or afloat at its own depth, the boatwright with the boat in hand, the boatman with his net and basket. Its hit test answers a click on the stage, which stands on the river off any plot, with J15.
- The day's guests and the boatwright's round are read once per day's plan (`regattaGuestsOf`); every place a boat or a figure is at is pure in the guests' arrivals and the minute.
- A boat on the water sits low: as wide as the boat in hand, its hull two rows of its band's colour, and nothing more than 4 px over its point, so a boat slipping under the Kingfisher bridge stays clear of the glass above it (the shared test in `tests/district-render.test.ts`). On the grass it is the boat in hand itself, on a little shadow.
- Render cap: 600 calls with ten boats and the boom; measured at about 220.

## Checking it

`tests/manual/district.html?venue=landing` with the Landing's moments: Regatta Week's morning, boats under arm, the first launches, the boatwright fetching, boats under the bridge, coming to rest, all at the boom, netting out, the last regatta day, and the Landing in spring, in winter and at night. `tests/regatta.test.ts` holds the cheers, a boat's whole afternoon in the real and full towns, the boatwright's pace, the boat in hand and the panel; `tests/district-render-bandstand.test.ts` the Landing's caps, the amber budget, the fades and the stage's click.
