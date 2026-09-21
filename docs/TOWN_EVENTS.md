# Town events

Each 24-minute UTC town day selects one lunch event and one evening show, followed by a nightly midnight disco. The choices are deterministic from the town-day number, so reloads, time zones, and visit order do not change the lineup. Consecutive days can repeat a selection. Pausing freezes both the day and the time; returning to live catches up both together.

| Venue        | Reserved plot | Events                               | Town time   |
| ------------ | ------------- | ------------------------------------ | ----------- |
| Lunch Green  | C5            | Picnic, books & lemonade, lawn games | 13:00–16:00 |
| Little Stage | B5            | Rock, acoustic, jazz                 | 19:00–21:00 |
| Little Stage | B5            | Midnight at the Little Stage         | 23:30–02:30 |

Neighbors set to `stroll` during that period are eligible. The green has six spots around its blanket; the stage has eight spots across its audience lawn. Guests are chosen deterministically by day and house ID. When all spots are taken, other neighbors keep their regular stroll instead of waiting in a queue. The selection changes with each town day.

Guests leave home shortly after 12:00 or 18:00, follow roads, then walk onto the venue lawn. Departures are staggered slightly; everyone gets home before the next routine starts. Neighbors at work or home remain indoors.

Night owls (`routine.night: "stroll"`) can join the midnight party. Up to eight guests leave home after 22:30, dance from 23:30 to 02:30, and walk home by 04:30. Their guest list and spots remain attached to the evening across midnight. Other night owls keep their local moonlit walks, and sleepers stay indoors. The stage becomes a tiny DJ booth with a pastel dance floor, steady colored bulbs, alternating raised hands, and dancing feet.

Picnic guests sit with folded legs, sip lemonade, or chat. Book events bring open books; lawn games add a small ball. Concertgoers sway and occasionally raise both hands, with brief music notes above the crowd. Rock shows encourage more cheering than acoustic or jazz sets. Gestures have independent timing and stay repeatable for the shared clock. Rugs are drawn beneath guests, and the stage sits at the rear of its plot to leave audience space.

The stage performers and DJ are scenery, not extra contributed residents. Sound is optional: turn on town sound for the current concert or the original midnight dance track. There is no autoplay audio or flashing lights. Pausing the town also pauses gestures, performers, music notes, and sound.

## Extend it

`src/lib/events.ts` owns venues, event choices, and schedules; `src/city/venues.ts` draws them. `src/lib/simulation.ts` handles attendance, and `TownEvents.tsx` exposes the daily program through keyboard-accessible buttons. Existing house JSON requires no new fields.

Add lunch and evening choices to the appropriate period in `EVENT_CHOICES`; the night party has a fixed entry in `eventsForDay`. For new venues, use an empty plot, update drawing and schedule configuration, and keep attendance bounded. Use `eventMinutes` and `isEventLive` for schedules that cross midnight, and `eventAtVenue` when a venue hosts multiple events. Reserve plots centrally so both UI choices and local-save/CI validation agree. Do not convert another contributor’s home into a public venue.

`EVENT_SPOTS` defines physical positions and facing directions relative to each plot center; its length is the venue capacity. Keep spots inside the public lawn and away from furniture. The simulator routes to those positions, so update artwork and approach paths together when changing them. A first contribution still needs no extra JSON fields.

Run `npm run check` and `npm run format:check`. Event tests cover UTC rollover, stable selection, reserved plots, attendance limits, road paths, no teleporting at arrival/departure, indoor routines, and exact event boundaries. Verify the stage and green at close zoom and on mobile after artwork changes.

For repeatable artwork checks, run the development server and open `/tests/manual/events.html`. Its buttons render lunch, concerts, travel, and bedtime with the real renderer and residents. Enable **Full venue + overflow** to exercise a sixteen-resident crowd, and **Animate preview** to inspect gestures and movement. This separate development fixture does not change the live clock, save houses, or enter the production build.
