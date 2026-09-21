# Town events

Each 24-minute UTC town day selects one lunch event and one evening show. The choices are deterministic from the town-day number, so reloads, time zones, and visit order do not change the lineup. Consecutive days can repeat a selection. Pausing freezes both the day and the time; returning to live catches up both together.

| Venue        | Reserved plot | Events                               | Town time   |
| ------------ | ------------- | ------------------------------------ | ----------- |
| Lunch Green  | C5            | Picnic, books & lemonade, lawn games | 13:00–16:00 |
| Little Stage | B5            | Rock, acoustic, jazz                 | 19:00–21:00 |

Neighbors set to `stroll` during that period are eligible. The green has six spots around its blanket; the stage has eight spots across its audience lawn. Guests are chosen deterministically by day and house ID. When all spots are taken, other neighbors keep their regular stroll instead of waiting in a queue. The selection changes with each town day.

Guests leave home shortly after 12:00 or 18:00, follow roads, then walk onto the venue lawn. Departures are staggered slightly; everyone gets home before the next routine starts. Neighbors at work or home remain indoors.

Picnic guests sit with folded legs, sip lemonade, or chat. Book events bring open books; lawn games add a small ball. Concertgoers sway and occasionally raise both hands, with brief music notes above the crowd. Rock shows encourage more cheering than acoustic or jazz sets. Gestures have independent timing and stay repeatable for the shared clock. Rugs are drawn beneath guests, and the stage sits at the rear of its plot to leave audience space.

The stage performers are scenery, not extra contributed residents. Concerts are visual only, with no autoplay audio or flashing lights. Pausing the town also pauses gestures, performers, and music notes.

## Extend it

`src/lib/events.ts` owns venues, event choices, and schedules; `src/city/venues.ts` draws them. `src/lib/simulation.ts` handles attendance, and `TownEvents.tsx` exposes the daily program through keyboard-accessible buttons. Existing house JSON requires no new fields.

Add new choices to the appropriate period in `EVENT_CHOICES`. For new venues, use an empty plot, update drawing and schedule configuration, and keep attendance bounded. Venue slots currently correspond to lunch and evening; a new period needs explicit schedule and routine handling. Reserve plots centrally so both UI choices and local-save/CI validation agree. Do not convert another contributor’s home into a public venue.

`EVENT_SPOTS` defines physical positions and facing directions relative to each plot center; its length is the venue capacity. Keep spots inside the public lawn and away from furniture. The simulator routes to those positions, so update artwork and approach paths together when changing them. A first contribution still needs no extra JSON fields.

Run `npm run check` and `npm run format:check`. Event tests cover UTC rollover, stable selection, reserved plots, attendance limits, road paths, no teleporting at arrival/departure, indoor routines, and exact event boundaries. Verify the stage and green at close zoom and on mobile after artwork changes.

For repeatable artwork checks, run the development server and open `/tests/manual/events.html`. Its buttons render lunch, concerts, travel, and bedtime with the real renderer and residents. Enable **Full venue + overflow** to exercise a sixteen-resident crowd, and **Animate preview** to inspect gestures and movement. This separate development fixture does not change the live clock, save houses, or enter the production build.
