# Brand

Forktown is a little town, built one pull request at a time. Its identity rests on one idea: **a fork that ends in a lantern**. A trunk splits in two. The left limb ends in a round sage canopy, the town as it began. The right limb ends in a warm paper lantern: someone's fork, lit. It reads as a tree fork, a fork in the road, and a git fork at once.

One house. One neighbor. One lantern. The lantern is the town's unit of belonging and never means anything else.

## The mark

The mark is drawn on a 32 x 32 pixel grid from a single list, `MARK_PIXELS` in `src/lib/brand.ts`. The header (`BrandMark`), the favicon, and the `/live` watermark all read that list, and `tests/brand.test.ts` pins `public/favicon.svg` to `markSvg({ tile: true })` byte for byte.

| Part                   | Rects `[x, y, w, h]`                                                                | Day       | Night     |
| ---------------------- | ----------------------------------------------------------------------------------- | --------- | --------- |
| Tile (favicon, cards)  | `[0, 0, 32, 32]`, radius 7                                                          | `#EEF1E6` | `#263C3C` |
| Road                   | `[6, 27, 20, 2]`                                                                    | `#C9B48B` | `#8C7F62` |
| Trunk and limbs (moss) | `[14, 18, 4, 9]` `[11, 15, 4, 4]` `[8, 12, 4, 4]` `[17, 15, 4, 4]` `[20, 13, 4, 3]` | `#516B42` | `#9DB88A` |
| Canopy (leaf)          | `[6, 4, 5, 1]` `[5, 5, 7, 1]` `[4, 6, 9, 5]` `[5, 11, 7, 1]` `[7, 12, 4, 1]`        | `#769267` | `#6F9A6A` |
| Canopy light           | `[5, 6, 3, 2]`                                                                      | `#95B478` | `#B5CFA0` |
| Lantern cap and hook   | `[23, 2, 1, 1]` `[21, 3, 5, 1]` `[21, 11, 5, 1]` `[23, 12, 1, 1]`                   | `#6F5A3C` | `#3E3A30` |
| Lantern body           | `[21, 4, 5, 7]` `[20, 5, 7, 5]`                                                     | `#F2C06B` | `#F2C06B` |
| Lantern core           | `[22, 6, 3, 3]`                                                                     | `#FFE0A0` | `#FFE0A0` |

- **Clear space:** 4px around the mark at 32px, scaled with it.
- **Minimum size:** 16px. Below that the lantern stops reading as a lantern.
- **Night:** the tree and road step into the dusk palette; the lantern keeps its colours, because it is the light.

Do and don't:

- Never recolour the lantern.
- Never mirror the mark. The canopy is always on the left and the lantern on the right.
- Never put the Y on streetlamps. The shape appears at exactly four scales: the mark, the Lantern Fork on D3, each home's lantern post, and the sprout stake on an empty plot.

## The wordmark

Lowercase **forktown** in Fraunces 500 at 27px (23px below 600px), tracked -1px, `#334C3C` by day and `#F1EEDC` at night. The 26px mark sits before it and is hidden below 600px. The full stop is a 6 x 8 pixel lantern (`LanternDot`) resting on the baseline; after 20:00 it gets a soft static glow.

The word appears in the world exactly once, on the timber-and-green plaque at the foot of the Lantern Fork.

One tagline, everywhere: **A little town, built one pull request at a time.** The page title is `Forktown — a little town, built one pull request at a time`. Both live in `src/lib/brand.ts` as `TAGLINE` and `TITLE`, and the test checks `index.html`, `live/index.html`, and the README against them.

## Tokens

The tokens live in `src/styles.css` under `@layer base :root`. `BRAND` in `src/lib/brand.ts` mirrors them, and the test fails if the two drift apart or if any stylesheet uses a `var(--x)` that is not declared.

| Token            | Value     | Role                                                   |
| ---------------- | --------- | ------------------------------------------------------ |
| `--leaf`         | `#769267` | Mark canopy. Decorative.                               |
| `--lantern`      | `#f2c06b` | Fills, badges, the live indicator, and glows **only**. |
| `--lantern-ink`  | `#8a5a1c` | Accent text on cream.                                  |
| `--lantern-pale` | `#fff6df` | Tale quotes and day badges.                            |
| `--glow`         | `#ffe0a0` | Lit lantern light; text on dusk.                       |
| `--timber`       | `#ad9069` | Sign frames. Decorative.                               |
| `--timber-ink`   | `#6f5a3c` | Timber text.                                           |
| `--dusk`         | `#263c3c` | Night pills and dock.                                  |
| `--dusk-surface` | `#2b4242` | Night panels.                                          |
| `--dusk-raised`  | `#30494a` | Night hover, active, and quote backgrounds.            |
| `--dusk-line`    | `#45605c` | Night borders.                                         |
| `--dusk-ink`     | `#f1eedc` | Night text.                                            |
| `--dusk-muted`   | `#c3d4c2` | Night secondary text.                                  |
| `--dusk-link`    | `#bfd8a6` | Night links.                                           |
| `--sans`         | DM Sans   | Interface type, for places that name it outright.      |

The existing tokens (`--paper`, `--surface`, `--ink`, `--muted`, `--line`, `--green`, `--green-deep`, `--green-pale`, `--mono`, `--serif`) are unchanged.

### Contrast

WCAG ratios, computed from `BRAND` by `contrast()` and asserted in `tests/brand.test.ts`. `/tests/manual/brand.html` renders the same table live.

| Text on background                  | Ratio | Use                                                         |
| ----------------------------------- | ----- | ----------------------------------------------------------- |
| `--ink` on `--surface`              | 10.84 | Body text                                                   |
| `--muted` on `--surface`            | 5.49  | Secondary text                                              |
| `--green` on `--surface`            | 5.79  | Links and buttons                                           |
| `--lantern-ink` on `--surface`      | 5.75  | Accent text                                                 |
| `--lantern-ink` on `--paper`        | 5.50  | Accent text                                                 |
| `--lantern-ink` on `--lantern-pale` | 5.48  | Badges                                                      |
| `--lantern-ink` on `--green-pale`   | 5.16  | Accent text on green                                        |
| `--ink` on `--lantern-pale`         | 10.34 | Quotes                                                      |
| `--muted` on `--lantern-pale`       | 5.23  | Quote credits                                               |
| `--ink` on `--lantern`              | 6.64  | Text on a lantern badge                                     |
| `--lantern` on `--surface`          | 1.63  | Never text: fill only                                       |
| `--dusk-ink` on `--dusk`            | 10.04 | Night pills                                                 |
| `--dusk-ink` on `--dusk-surface`    | 9.18  | Night panels                                                |
| `--dusk-ink` on `--dusk-raised`     | 8.27  | Night cards                                                 |
| `--dusk-muted` on `--dusk-surface`  | 6.89  | Night secondary text                                        |
| `--dusk-muted` on `--dusk-raised`   | 6.21  | Night secondary on cards                                    |
| `--dusk-link` on `--dusk-surface`   | 6.93  | Night links                                                 |
| `--glow` on `--dusk-surface`        | 8.38  | Night accents                                               |
| Focus `#a9cfa0` on `--dusk-surface` | 6.18  | Night focus ring (the day ring `#739b76` is only 3.41 here) |

## Type roles

- **Fraunces 500:** headings, the wordmark, and the plaque.
- **Fraunces 500 italic:** a neighbor's own words. Stories keep their line breaks.
- **DM Sans:** the interface.
- **Space Mono 400 and 700:** numbers, times, and uppercase eyebrows. Both weights are loaded, so bold numbers are really bold.

Roman is the town speaking. Italic is a neighbor speaking.

## Voice

Keep what already works: small, warm, two-beat sentences; headings that end in a period; uppercase Space Mono eyebrows; "little" at most once per screen. Report, never rank: numbers are history, not scores. No exclamation marks in town copy; neighbors' own greetings are the exception.

Git wears a costume in town copy:

| Git word                   | Town word                 |
| -------------------------- | ------------------------- |
| merged                     | moved in                  |
| contributor                | neighbor                  |
| a house's place in history | Lantern No. 12            |
| empty plot                 | room for one more lantern |

"Pull request" appears only in the guide and calls to action. "Fork" is a place (the Lantern Fork, the Fork) or the first guide step ("Fork the town"). Never use "repo", "commit", "branch", or "SHA" in town copy.

Lines to use:

- "Every house here started as a fork."
- "One house. One neighbor. One lantern."
- "Room for one more lantern."
- "At nightfall the lanterns come on, oldest first."
- "Every house here started as a fork. Yours could hang here next."

Interface strings owned by the identity (the welcome, the guide steps, and the empty-plot lines) live in `src/lib/brand.ts`.

## The amber budget

Amber is for light: lit lanterns, windows, lamps, and the live indicator on the Events button. It never marks anything else. Tonight's tale gets a cream paper tag and the newest neighbor gets a terracotta pennant, so a lantern always means one neighbor.

## The welcome card

A first visit (no saved flag and no `#place=` or `#venue=` link) shows a quiet card above the dock: the tiled mark, **Every house here started as a fork.**, the neighbor count and the newest arrival, and when nightfall comes. It is an `aside`, not a dialog, and never takes focus. It hides while a panel is open. Any of its actions, or its close button, stores `forktown-welcomed-v1` in local storage. When storage is blocked it greets once per page load. `/live` never shows it.

## The dusk skin

From nightfall (20:00) to dawn (06:00) the town's chrome follows the map into dusk: the clock pill, the dock, the zoom controls, the panel and its event cards, the tooltip, the follow status, the toast, the sound popover, the almanac, and the welcome card. The rules hang off `.town-app-night` in `src/explore.css` and `src/calendar.css`, unlayered so they beat the layered base styles. Inside dusk surfaces, `--ink`, `--muted`, `--line`, and `--green-pale` point at their dusk equivalents, so venue cards and future panels follow without extra rules. Colours ease over 400ms; reduced motion removes the transition. Modals (the guide, the builder, and the house files) stay cream at night: they are documents.
