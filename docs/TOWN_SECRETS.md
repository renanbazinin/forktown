# Town secrets

A few things in town happen only at certain moments, and nothing points to them. Moon Harvest Farm keeps two, and the Millpond keeps one.

All secret state is a pure function of the existing UTC epoch clock: `townDayAt(timestamp)` and `townMinutesAt(timestamp)`. A town day lasts 24 real minutes; a town minute lasts one real second. Refreshing, opening another browser, or running on localhost produces the same state for the same instant. No storage, random calls, or accumulated simulation steps are involved. As with the existing town clock, device clocks must be accurate; pausing freezes the view and resuming catches up.

## Moon Harvest Farm

Moon Harvest Farm reserves S4–T9 (12 plots). Wheat, vegetables, pumpkins, paths, and fences replace the vacant plots and internal roads. Perimeter streets remain connected. Open `#venue=farm` to focus the field.

- **Scarecrow:** at 01:00 each town night, it makes an eight-second hop to the next plot. Its loop is S9 → S8 → S7 → S6 → S5 → S4 → T4 → T5 → T6 → T7 → T8 → T9 → S9. It stays put through the day. The fixed Unix-epoch phase determines its position even if nobody watched earlier nights.
- **UFO:** town days divisible by ten, from 01:30 to 03:00. It approaches a house, hovers above its roof with a pale searchlight, and departs. Houses are sorted by stable file ID, and the UTC visit number selects the next house in that rotation. Every house is visited before the rotation repeats; a town with one house necessarily revisits it, and an empty town has no visit. The shared published house roster determines the rotation; local unsaved drafts do not affect it. Clients with the same roster and timestamp see the same target regardless of array order or timezone. This is every four real hours: 00:01:30–00:03:00 UTC, then the same interval at 04, 08, 12, 16, and 20 UTC, every date.

`tests/town-secrets.test.ts` covers independent replay, time-zone offsets, missed cycles, midnight, exact event boundaries, the complete route, plot reservation, road access, and map selection. During development, `tests/manual/secrets.html` provides day/night, UFO, hop, and live UTC views without changing the production clock.

## The Millpond

The Millpond keeps its secret for the almanac's three full-moon nights of winter: **Winter 14, 15 and 16, from 03:00 to 04:30 town time**. The pond is always frozen hard then. At 03:00 a thin crack spreads from the end of the jetty toward the middle of the pond, about three and a half tiles over four town minutes: a dark 2-pixel line with a pale edge on its upper side. Then something glints under the ice near it, a cool silver light that pulses slowly on a five-minute swell. It is the fisher's lost lure. It always lies two tiles or more from the moon's reflection, so the moon never hides it. Over the last eight minutes the crack and the glint fade, and by 04:30 the ice is whole again. On a night the UFO flies, it has left by 03:00, so the two never share the sky.

`iceSecretAt(minutes, day)` keys on the almanac's whole date and the town minute, so it is a pure function of the UTC clock like everything else here. The dates are the almanac's own: as with the Fork's tales, the hours after midnight belong to the evening before, so 03:00 on Winter 15 is the small hours of the evening of Winter 14. The three nights come round once per town year, every 44 hours and 48 minutes of real time, and each night's window lasts 90 real seconds. In Year 3, Winter 15 at 03:00 falls at **2026-09-25 08:51 UTC**. Winter 14's window opens at 08:27 UTC and Winter 16's at 09:15 UTC the same morning, and the next winter's come 44 hours and 48 minutes later.

`tests/millpond.test.ts` checks that it appears only on Winter 14, 15 and 16 at 03:00–04:30 in any year, exactly when the almanac says full moon. It also checks the exact boundaries, the crack, pulse and fade, the same answer for 08:51 UTC written with `+03:00` and `−07:00` offsets, and the same moment 1, 10 and 250 town years later. `tests/millpond-render.test.ts` checks that the silver glint is painted only inside the window, and never within two tiles of the moon's path. In `/tests/manual/millpond.html`, the **Secret and controls** row opens Winter 15 at 03:00, 03:04 and 03:40, with controls at Winter 13, 03:00 and Winter 15, 02:00. See [The Millpond](MILLPOND.md).

## Out of sight

The secrets stay out of the scheduled events list. The farm has no map text or mystery hints in its panel. The Millpond's panel and its skating card say what the water is doing now, and never mention the crack or the glint.

Run `npm run check` and `npm run format:check`.
