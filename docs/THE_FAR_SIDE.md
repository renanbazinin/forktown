# The far side

Forktown used to end at its own edges: a green diamond floating in a plain wash of sky. The far side gives the town a place to stand. There is warm light at the ends of the day, a line of hills with three other little towns on it, fields that carry on past the back edges, and stones at the road crossings. None of it asks for attention. It sits behind and around the houses, so the first ten seconds already feel like somewhere.

## Golden hour

`goldenHour(minutes)` is a smooth bell that is 0 most of the day:

- **Evening:** 18:30–20:20 town time, peaking at 19:25. It is still about 0.30 at 20:00, so the warmth is fading just as the lanterns begin, and it is 0 from 20:20.
- **Dawn:** 05:30–07:00, peaking at 06:15.

Golden hour tints the light, not the grass. It warms the low sky and the sun's colour, lays a one-pixel rim of light along the far ridge, nudges the far hills toward straw, and adds a wash over the finished frame. The wash is `#F2B45A` at no more than 0.05 alpha, and it is skipped entirely outside golden hour. The ground, houses and venues keep their own day and night palettes.

## The horizon and the sister forks

Two layers of stepped pixel hills sit in the screen-space sky, behind the town. Each ridge is a sum of three sine waves with fixed, hashed phases, sampled every four pixels and snapped to even rows, so the hills read as terraces on the same two-pixel grain as the sun and moon. The far layer is lighter than the near one, as distance should be. At 1440 × 900 the opening view shows sky down to about half the screen height at its edges; the ridges sit in the upper part of those sky triangles, just above the far fields, and pass behind the town everywhere else. The sun now sets behind the far ridge.

On the far ridge, at 11%, 79% and 91% of the screen width, stand three **sister forks**. Each is a tiny Y tree with a canopy on one limb and a lantern on the other, next to a few houses. They are silhouettes a dozen pixels tall. Every piece stands on the lowest ridge step beneath it, so nothing floats. At exactly 20:00 their lanterns and windows light, together with the Lantern Fork, and at 06:00 they go out.

They matter because Forktown is one fork among many. Every house here started as a fork, and so did the town: somewhere over the hills, other towns keep their lanterns too.

On a phone the opening view is mostly town, so the hills stay out of sight there until you zoom out.

## The far fields

Beyond the northeast and northwest edges, the land keeps going for a little while. There are three strips, each two tiles deep, fading from 0.55 to 0.32 to 0.14 alpha. Two hedgerows sit at two and four tiles out, and 18 small far trees stand within two tiles of the edge. They are world-space pieces painted first inside the ground cache, before the earth slab. The slab, river and terrain are unchanged.

## Commit stones

Every road crossing has a flat paver at its centre, so the road grid reads as a commit graph. The four crossings around the Lantern Fork on D3 are brass: the Fork is HEAD. Stones are cream by day and grey-green by night; the brass stones are warm gold by day and a dimmed bronze by night. They are painted with the road tiles, in the ground cache.

## Performance

- The sky is screen space and never cached. `drawSky` makes at most 400 drawing calls per frame at 1440 × 900 (about 160 in practice). The ridges are one path per layer. Only the steps where a ridge changes height become vertices, which is a few hundred per frame, and path building draws nothing.
- Far fields and commit stones live in the ground cache. They repaint only when the cache does and add no `groundKey` inputs, because they depend only on `night`. The far fields take under 60 canvas calls: each strip is two rectangles drawn in tile space.
- The golden wash is at most one `fillRect` per frame.

## Determinism

Everything here is a pure function of the town minute, the viewport size and the night flag. Ridge phases, sister-fork houses and far-tree positions come from `hash()` of fixed strings. There is no `Math.random`, no `Date`, and no canvas created at module load, so two renders with identical inputs produce identical call logs, and node tests can import the modules.

## Code and verification

- `src/city/horizon.ts`: `goldenHour`, the ridges, the sister forks, `drawHorizon`, `drawFarFields`, `drawCommitStone` and `drawGoldenHour`.
- `src/city/sky.ts`: the warmer gradient and sun, and the horizon painted after the sun and moon.
- `src/city/render.ts`: draws the far fields first in the ground cache, a commit stone on each road crossing, and the golden wash after the finished frame.
- `tests/far-side.test.ts`: golden-hour timing and continuity, ridge bands and determinism, sister-fork placement and lighting, call budgets, stone colours and the wash.
- `/tests/manual/sky.html` on the development server: buttons for 12:00, 19:25 golden hour, 20:01 nightfall and 06:15 dawn, a **Whole town** toggle, and a 1440 × 900 / 390 × 844 size switch. `?time=1165&size=390x844&view=whole` opens a scene directly.

Run `npm run check` and `npm run format:check`.
