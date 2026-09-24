# The Lantern Fork

At the heart of Forktown, on plot D3, stands a forked tree with one lantern for every house, hung in the order the houses moved in. Every house here started as a fork, so the town's landmark is one too.

## What visitors see

The trunk splits into two limbs. The smaller left lobe holds the eight founding lanterns. The taller right crown fills with the neighbors' lanterns in arrival order. A timber-and-green plaque at the foot reads `forktown.`, the only place the word appears in the world. Select the tree, or open `#venue=fork`, for the full register.

By day the lanterns are paper. One house, one neighbor, one lantern: a lantern never means anything else.

## Lantern hour

Nightfall is 20:00 town time, the minute the night palette begins. The town then lights itself in arrival order:

- **20:00:** Lantern No. 1 lights, then one more every real second. With 17 houses, the last lights at 20:16.
- **Any size:** a larger town lights faster, so every lantern is lit by 20:20.
- **20:20–20:30:** the streetlamps ignite, starting beside the Fork and carrying the light outward.
- **06:00:** dawn. Everything goes out until the next nightfall.

Each house's windows and the lantern post beside its front path light at the same moment as its lantern on the Fork, so the ritual reads anywhere on the map.

Nightfall comes every 24 real minutes, 20 minutes into each UTC cycle: 00:20, 00:44, 01:08 UTC and so on.

## Tonight's tale

Each evening one neighbor's own story is told at the Fork. The evening runs from 06:00 to 06:00, so the hours after midnight belong to the evening before, as with the disco. The builder's old example story is skipped. The storied houses are shuffled once by a stable hash and consecutive evenings walk that list, so every one gets an evening before any repeats. The tale's lantern and lantern post carry a cream paper tag. See [Tonight's tale](TALES.md).

## Numbers and the newest neighbor

Founding lanterns are No. 1–8. Neighbors continue from No. 9 in the order their house files arrived on the town's main line: "Lantern No. 13 of 17. Moved in after Arcade." Numbers are history, not scores. The newest neighbor flies a terracotta pennant until the next house moves in.

Every lantern keeps its place on the tree. Neighbors always start after the eight founding slots, so removing a founding house never moves a neighbor's lantern, and a new arrival changes no existing number.

## Honest without history

Arrival order comes from Git history at build time. A shallow clone or a source archive has none, so the Fork makes no claim: founders keep their numbers, and neighbors hang in id order, unnumbered, with a note that the order appears in a build with full history. If only some arrivals are known, the rest are appended unnumbered and everyone else keeps their number. So a local build can number houses differently from the published town, which CI builds with full history.

## The D3 reservation

The Fork is a public venue like the Little Stage and the Lunch Green. A house file on D3 fails validation with the usual reserved-venue message, and the builder and Explore skip it. The town has 151 house plots.

## Determinism

Everything is a pure function of the UTC clock, the published houses and the arrival history: no storage, no random calls, no accumulated state. Every visitor sees the same lanterns, tale and numbers at the same instant, in any timezone. Local drafts never get a lantern or a tale.

## Code and verification

- `src/lib/lanterns.ts`: the register, the lantern-hour clock, lamp timing and tonight's tale.
- `src/lib/events.ts` and `src/city/venues.ts`: the venue, the D3 reservation and the hit area.
- `src/lib/live-director.ts`: the /live Lantern hour shot.
- `src/city/lantern-fork.ts`, `lantern-post.ts`, `glow.ts` and `render.ts`: the tree, the posts, the light and the cascade.
- `src/components/ForkCard.tsx`: the register card.
- `tests/lanterns.test.ts` and `tests/lantern-fork.test.ts`.
- `tests/manual/lantern-fork.html`: scrub the minute and the roster by hand.

## Extend it

- **Gatherings:** `EVENT_SPOTS.fork` is empty. Give it spots to hold events at the Fork.
- **Lantern Night:** on the full moon, lanterns could float from the Fork to their own houses.
- **Porch tales:** contributors could add lines of their own to the rotation. `EveningTale.source` is ready for them.

Run `npm run check` and `npm run format:check`.
