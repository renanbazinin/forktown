# Seasonal errands

A neighbor sometimes gives their walk a purpose: a tray of seedlings, a jug of lemonade, a harvest basket or warm drinks for the pond. At most one published resident makes a round each town day, when there is enough free time to collect it, carry it, set it down and walk home.

| Season | Round                  | Pickup → delivery                 |
| ------ | ---------------------- | --------------------------------- |
| Spring | Seedlings for the Fork | Lunch Green → Lantern Fork        |
| Summer | Lemonade for the stage | Lunch Green → Little Stage        |
| Autumn | A basket for the green | Hedgerow Halt → Lunch Green       |
| Winter | Warm cups by the pond  | Lunch Green → Millpond south gate |

The summer jug is set down on the Little Stage's east corner, not on its front kerb, where evening audiences stand and sit until 20:00. The autumn basket is waiting at Hedgerow Halt's depot. It is not one of the tube's simulated parcels, and its pickup is not synchronized with a parcel arrival. The winter round stays on land beside the gate, throughout winter: it never needs skating ice or sends a neighbor onto thawing water.

## A round that fits

The planner books the resident's existing outings first, then examines the remaining stroll time. Within the daytime errand window, 08:00–19:00, it looks for a free spell with room for the complete journey, two twelve-minute stops and the margins around existing commitments. The complete round, from departure at home through both handoffs to the return home, must take no more than 300 town minutes: five real minutes at the live town speed. A resident whose route would exceed that limit is passed over even when their day is otherwise free. Walking is at the normal pace. Residents working or relaxing indoors do not become couriers, and an errand never displaces a booked outing or keeps someone out beyond their routine.

The five visible phases are the walk to collect the item, pickup, carrying, delivery and the walk home. The item stays with its carrier during the middle walk. Stops have enough time to turn and handle the item. No new public plot, contributor field, account, inventory or backend is needed.

On a day with a planned round, its item waits at the pickup spot from 06:00. At pickup, the resident's handling animation takes over the same object; it does not remain on the ground as a duplicate. After delivery, it stays at the destination until 20:00. The ground prop fades in over the first five minutes after 06:00 and out over the last five before 20:00. There is no waiting item when no round is planned, and no item carries over as saved inventory the next day.

There is at most one carrier each day. If no published neighbor can finish the whole round within both the duration limit and their free time, nobody sets off. A quiet day is expected, especially for the longer winter walk; the town never speeds someone up or removes an existing outing to fill the card. An unsaved builder preview does not take the errand or change the published carrier's day.

## Finding the round

The Events panel has a compact seasonal card. It names the route, the actual carrier and the planned town times. Before departure it gives a countdown in real seconds or minutes: one town minute is one real second. During the round it describes the same phase as the neighbor directory and follow caption. The card offers **Follow** before departure and while the carrier is out, and **Visit** for the destination throughout the day. When the carrier returns, it reads **Finished today**. When no journey fits, it says **No round planned today** and offers no invented carrier or departure time.

All names, routes, phases and actions are real DOM text and ordinary keyboard buttons. The small seasonal icon and live dot are decorative. There is no continuously announcing live region. The card uses the displayed clock, so pausing freezes the countdown and the described phase with the town.

The card shows the actual carried object enlarged three times. The same drawing appears in the Follow caption during pickup, carrying and delivery. Each object is a small pixel map, about as wide as the resident's shoulders, with its own handholds: a wooden seed tray of three seedlings, a glass pitcher of lemonade with a lemon wheel on the rim, a wicker harvest basket of a pumpkin, apples and greens, and a steaming enamel mug of cocoa beside a red flask. A carrier walking toward the viewer holds it in front at the waist, below their eyes. Walking away, they hold it out past the near shoulder by its inner edge, so neither their back nor their arm hides it. Following an active errand starts with a closer view; later phase changes preserve the visitor's own zoom.

Errands are daytime journeys and never cross midnight. Their Events card belongs to the current calendar day: before 06:00 it previews the coming daytime round, even while the previous evening's disco is still running. The next season's errand appears with that calendar day.

## Determinism and implementation

`src/lib/seasonal-errands.ts` owns the ritual, safe stop geometry, feasible route and selected carrier. A plan depends on the published roster and the town day; its visible state is sampled at the displayed town minute. Reloading or visiting later cannot change the route. No accumulated simulation steps or browser storage decide what happened.

`src/lib/errand-copy.ts` supplies the five phase labels used by the map's follow caption, neighbor directory and Events card. `src/components/SeasonalErrandCard.tsx` reads the same plan as the resident simulation, with styling in `src/errands.css`. `src/city/seasonal-errands.ts` places the item before pickup and after delivery, using the handoff anchor shared with the carrier's artwork in `src/city/errand-items.ts`. The planner retains existing route, routine and draft-isolation rules rather than introducing a second independent schedule.

## Verification

The focused errand tests check travel feasibility, determinism and isolation from a draft. `tests/errand-ui.test.ts` renders the real card at the phases of actual planned journeys, at departure and return boundaries, before dawn, without an eligible carrier, and with names that need HTML escaping. Its countdown assertions use the town-to-real-time conversion, and the tests check that a finished card makes no claim about the resident's current location.

For visual review, run `npm run dev` and open `/tests/manual/seasonal-errands.html` on the development server. Each season button searches for a feasible round by an actual published resident; a season with none keeps the honest no-round state. Journey-stage buttons show the walk there, pickup, carrying, delivery and return. **Animation studio** shows every object on both resident figures in all four directions, with handoff and night-palette controls. The page's day and time are shareable in its query string and do not change the public town clock.

Inspect a close view, the whole town and a narrow mobile panel; pause and resume around stage changes; and check a winter round before freeze and during thaw. The resident and flask must stay on land. Also inspect the unattended item before pickup and after delivery, and its disappearance at 20:00. Run `npm run check`, `npm run check:full-town` and `npm run format:check` before publishing.
