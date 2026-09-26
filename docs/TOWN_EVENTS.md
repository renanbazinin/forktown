# Town events

Each 24-minute UTC town day selects one lunch event and one evening show, followed by a nightly midnight disco. The choices are deterministic from the town-day number, so reloads, time zones, and visit order do not change the lineup. Consecutive days can repeat a selection. Pausing freezes both the day and the time; returning to live catches up both together.

| Venue        | Reserved plot | Events                               | Town time   |
| ------------ | ------------- | ------------------------------------ | ----------- |
| Lunch Green  | C5            | Picnic, books & lemonade, lawn games | 13:00–16:00 |
| Little Stage | B5            | Rock, acoustic, jazz                 | 19:00–21:00 |
| Little Stage | B5            | Midnight at the Little Stage         | 23:30–02:30 |

Neighbors set to `stroll` during that period are eligible. The green has six spots around its blanket; the stage has eight spots across its audience lawn. Guests are chosen deterministically by day and house ID: each day draws a new line, and spots go down it in order. A neighbor who can't make it (too far to get there, stay fifteen minutes and be home before their next routine or bedtime, or already out at an earlier outing that runs late) passes the spot to the next in line, so a spot stays empty only when nobody else free that period can reach it. When all spots are taken, other neighbors keep their regular stroll instead of waiting in a queue.

Guests leave home shortly after 12:00 or 18:00, follow roads (or ride the Treeline when it saves at least ten minutes), then walk onto the venue lawn. Departures are staggered slightly; everyone gets home before the next routine starts. Neighbors at work or home remain indoors.

Night owls (`routine.night: "stroll"`) can join the midnight party. Up to eight guests have staggered arrivals and departures during the 23:30–02:30 show. Arrivals spread over the first hour, but an owl with an early bedtime comes early enough for fifteen minutes on the floor and an unhurried walk home; an owl who lives too far from the stage to manage even that passes the spot on. Cinema guests are eligible too: when travel and bedtime leave at least fifteen town minutes to dance, they walk directly from the cinema aisle to the stage, then return to their own home. Their guest list and spots remain attached to the evening across midnight. Night owls take short local walks and visible doorstep breaks in the free time around events. Each has a stable bedtime in one of three bands: 00:00–01:00, 02:00–03:00, or 04:00–05:00. All journeys fit before that bedtime; explicit sleepers stay indoors. The stage becomes a tiny DJ booth with a pastel dance floor, steady colored bulbs, alternating raised hands, and dancing feet.

Picnic guests sit with folded legs, sip lemonade, or chat. Book events bring open books; lawn games add a small ball. Concertgoers sway and occasionally raise both hands, with brief music notes above the crowd. Rock shows encourage more cheering than acoustic or jazz sets. Gestures have independent timing and stay repeatable for the shared clock. Rugs are drawn beneath guests, and the stage sits at the rear of its plot to leave audience space.

The stage performers and DJ are scenery, not extra contributed residents. Sound is optional: turn on town sound for the current concert or the original midnight dance track. There is no autoplay audio or flashing lights. Pausing the town also pauses gestures, performers, music notes, and sound.

## Every evening

Two things happen every evening, whatever the lineup. They open the Events panel under "THIS EVENING", and the almanac lists them too.

- **Lantern hour, 20:00.** The Lantern Fork on D3 lights one lantern for every house, oldest first: one a second with today's houses, and all of them by 20:20 at any size. Each house's windows and lantern post light with its lantern, then the streetlamps follow outward from the Fork until 20:30. Everything stays lit until 06:00. Before nightfall the card counts down in real time ("Nightfall is in about 7 minutes."); while it lights it shows "Happening now". See [The Lantern Fork](LANTERN_FORK.md).
- **Tonight's tale.** One neighbor's own story, told from 06:00 to 06:00 in a fair rotation. The card quotes it and links to the house. See [Tonight's tale](TALES.md).

Lantern hour is not a gathering: it has no guests, no spots and no venue schedule, and it never changes who attends the lunch, the concert or the disco.

## Winter skating

On the Millpond's frozen days, Winter 9–19, the Events panel also shows **Skating on the Millpond**, 14:00–16:40. It waits after the day's other cards, and while skating is live it moves up to join the cards that are happening now. It reads "Later today", "Happening now" with the live dot, or "Finished today". While skating is live it adds "· 1 on the ice" (or however many neighbors are skating), when there are any. Its button opens the pond, and its label says the status, the time and the count aloud. Skating is not a scheduled venue event, just as Lantern hour is not: it follows the ice rather than the day's lineup, and it never appears in `eventsForDay`. Skaters are chosen from the afternoon strollers whom the lunch, the zoo and the football have not claimed, so skating never takes a guest from them. See [The Millpond](MILLPOND.md).

## Extend it

`src/lib/events.ts` owns venues, event choices, and schedules; `src/city/venues.ts` draws them. `src/lib/simulation.ts` handles attendance, and `TownEvents.tsx` exposes the daily program through keyboard-accessible buttons. Existing house JSON requires no new fields.

Add lunch and evening choices to the appropriate period in `EVENT_CHOICES`; the night party has a fixed entry in `eventsForDay`. For new venues, use an empty plot, update drawing and schedule configuration, and keep attendance bounded. Use `eventMinutes` and `isEventLive` for schedules that cross midnight, and `eventAtVenue` when a venue hosts multiple events. Reserve plots centrally so both UI choices and local-save/CI validation agree. Do not convert another contributor’s home into a public venue.

`EVENT_SPOTS` defines physical positions and facing directions relative to each plot center; its length is the venue capacity. Keep spots inside the public lawn and away from furniture. The simulator routes to those positions, so update artwork and approach paths together when changing them. A first contribution still needs no extra JSON fields.

Run `npm run check` and `npm run format:check`. Event tests cover UTC rollover, stable selection, reserved plots, attendance limits, road paths, no teleporting at arrival/departure, indoor routines, and exact event boundaries. Verify the stage and green at close zoom and on mobile after artwork changes.

For repeatable artwork checks, run the development server and open `/tests/manual/events.html`. Its buttons render lunch, concerts, travel, and bedtime with the real renderer and residents. Enable **Full venue + overflow** to exercise a sixteen-resident crowd, and **Animate preview** to inspect gestures and movement. This separate development fixture does not change the live clock, save houses, or enter the production build.
