# Town secrets

Moon Harvest Farm reserves S4–T9 (12 plots). Wheat, vegetables, pumpkins, paths, and fences replace the vacant plots and internal roads. Perimeter streets remain connected. Open `#venue=farm` to focus the field.

All secret state is a pure function of the existing UTC epoch clock: `townDayAt(timestamp)` and `townMinutesAt(timestamp)`. A town day lasts 24 real minutes; a town minute lasts one real second. Refreshing, opening another browser, or running on localhost produces the same state for the same instant. No storage, random calls, or accumulated simulation steps are involved. As with the existing town clock, device clocks must be accurate; pausing freezes the view and resuming catches up.

- **Scarecrow:** at 01:00 each town night, it makes an eight-second hop to the next plot. Its loop is S9 → S8 → S7 → S6 → S5 → S4 → T4 → T5 → T6 → T7 → T8 → T9 → S9. It stays put through the day. The fixed Unix-epoch phase determines its position even if nobody watched earlier nights.
- **UFO:** town days divisible by ten, from 01:30 to 03:00. It approaches a house, hovers above its roof with a pale searchlight, and departs. Houses are sorted by stable file ID, and the UTC visit number selects the next house in that rotation. Every house is visited before the rotation repeats; a town with one house necessarily revisits it, and an empty town has no visit. The shared published house roster determines the rotation; local unsaved drafts do not affect it. Clients with the same roster and timestamp see the same target regardless of array order or timezone. This is every four real hours: 00:01:30–00:03:00 UTC, then the same interval at 04, 08, 12, 16, and 20 UTC, every date.

The secrets stay out of the scheduled events list. The farm has no map text or mystery hints in its panel.

Run `npm run check` and `npm run format:check`. `tests/town-secrets.test.ts` covers independent replay, time-zone offsets, missed cycles, midnight, exact event boundaries, the complete route, plot reservation, road access, and map selection. During development, `tests/manual/secrets.html` provides day/night, UFO, hop, and live UTC views without changing the production clock.
