# Tonight's tale

Every evening the Lantern Fork tells one neighbor's story. It is the house's own `story`, quoted as written, in Fraunces italic with the author's line breaks kept. Roman type is the town speaking; italic is a neighbor's own words.

## How the tale is chosen

- **The evening runs from 06:00 to 06:00.** The hours after midnight belong to the evening before, so the tale told at 21:00 is still the tale at 03:00. It changes at dawn.
- **Only a story of the house's own is eligible.** A published house qualifies when its trimmed `story` is at least 10 characters and is not the builder's old example story ("A small corner of the internet, made with curiosity and a little courage."). Houses still carrying that example are skipped until they are rewritten.
- **The rotation is fair.** The eligible houses are shuffled once by a stable hash of their ids, and consecutive evenings walk that list. Every storied house gets an evening before any house repeats. Adding a house re-shuffles the order, so the rotation is "tonight", never an archive.
- **Published houses only.** An unsaved builder preview never becomes the tale.

`taleOfTheEvening(places, eveningDay)` in `src/lib/lanterns.ts` makes the choice, and `eveningDayAt(minutes, day)` names the evening. Both are pure functions of the shared UTC clock, so every visitor hears the same tale at the same moment.

## Where it is told

- **On the tree:** a cream paper tag hangs from that house's lantern on the Lantern Fork, and another from the lantern post outside the house itself. Both brighten after 20:00.
- **The Fork card:** select the Lantern Fork (D3, or `#venue=fork`) for the tale under "TONIGHT'S TALE", with the house name as a link and the neighbor's credit beneath it.
- **The Events panel:** "THIS EVENING" opens the panel with two cards: Lantern hour, and "Tonight's tale · (house)", with the story and a visit button.
- **The almanac:** the calendar popover lists Lantern hour and tonight's tale. Choosing the house closes the popover and takes you there.
- **The place card:** the house wears a "Tonight's tale" badge beside its lantern number for the whole evening.

Every surface is plain text in the DOM and reads correctly while the clock is paused. `src/lib/evening-copy.ts` holds every word the surfaces use, and `useLanternTown` in `src/lib/use-lantern-town.ts` gives them the register, the lantern hour and the tale in one place.

## Writing a story that can be told

The builder now starts with an empty story and asks a question instead: what a neighbor would find on your porch, what drifts out of the window at night, who is always welcome. Some guidance:

- Write a line a neighbor would tell over the fence: 10 to 180 characters, in your own words.
- Write about your own house only. Don't name other houses, other contributors or @handles.
- Line breaks are kept, so a short verse works.
- Keep it kind and public. No links, secrets, personal details or anything you would not want read aloud at the Fork.

## Safety

Stories render as React text only, never as HTML. The tale quotes what maintainers already reviewed in the pull request, so story suitability stays part of review. Default stories are skipped rather than amplified.

## What comes next

Each layer keeps the same contract: deterministic from the clock and the published places, a DOM text equivalent for every mark in the world, and no house ever referencing another.

1. **The Daily Fork (v2).** A "Today" tab in the Events panel that writes the day from facts the town already plans: the lineup, guest counts, the cinema, the lantern hour and tonight's tale. Maintainer-written templates, memoised per evening, framed as today and tonight.
2. **Porch tales (v3).** An optional contributor `tales` field, up to three short lines, one told each evening as a porch thought and as "Overheard on the porch" in the place card. `EveningTale.source` grows to `'porch'` without changing callers.
3. **Town tales (v3).** Maintainer-reviewed files starring only town-owned characters, dated by the town calendar and validated in CI like places. `source: 'town'`.
4. **Lantern Night.** On the full moon, the lanterns float from the Fork to hover over their own houses, with a countdown in the almanac.

Run `npm run check` and `npm run format:check`. `tests/lanterns.test.ts` covers the rotation and the evening boundary; `tests/evening-copy.test.ts` covers every word. During development, open `/tests/manual/stories.html` to see the Fork card, the Events panel, place cards and the almanac at 12:00, 19:53, 20:05, 21:00 and 02:00, with and without arrival history, by day and at dusk.
