# Forktown Live

Open `/live/` (or `/forktown/live/` on a repository Pages site) for a clean browser source for OBS or screen recording. `/live` also works on the development server; static hosts may redirect to the trailing slash. The production build includes a real `live/index.html`, so a direct visit or refresh does not need a server rewrite.

The town appears with a small Forktown symbol and a compact glass card in the top-right showing the resident population and latest contributor to join. During a resident follow, a name label travels above that neighbor and a small marker highlights their feet. There are no buttons, zoom controls, tooltips, or cursor. The route supplies the picture and town sound; use your recording software to capture or stream it. It does not save a recording or broadcast to a service itself.

Population counts one resident per occupied home, including the founding neighbors. Latest arrival uses the most recent addition of a current community home in the repository's mainline history, not its latest edit; starter homes are excluded. Builds embed that history locally, without browser API calls. CI fetches full history. Source archives or shallow clones without reliable history show a welcome message instead of guessing an arrival.

## A day in the director's notebook

One town day lasts 24 real minutes. The broadcast uses the same UTC town clock, residents, events, and football as the interactive town. Reloading or joining midway picks up the current scene. This dedicated moving broadcast plays immediately, including when the regular town would initially pause for reduced motion.

- **Three daily highlights:** a shuffle seeded by the day chooses three of the duck walk, football, lunch gathering, evening concert, disco, and outdoor cinema. Choices are shared by all viewers and stay fixed across reloads. All six activities still happen in town; only the broadcast lineup changes. A selected disco finishes at 02:30 the following morning, retaining the previous evening's choice across midnight.
- **One minute of neighborhood scenery:** 05:00–06:00 town time, exactly 60 real seconds per 24-minute cycle. Frame Miso's current neighborhood with him outside, keeping activity visible even in this wider view. Reloading does not restart this window. If there is no eligible outdoor subject or selected highlight during daylight, show a quiet home while Miso sleeps.
- **Selected gatherings:** when chosen, show the Lunch Green's 13:00–16:00 gathering when guests are present, the Little Stage's 19:00–21:00 concert, or the 23:30–02:30 disco.
- **Lantern hour:** 19:58–20:24 every evening, framed on the Lantern Fork: two seconds of the dark tree, the lanterns coming on in arrival order, then the first streetlamps. It outranks a featured concert for those 26 seconds and ends before the cinema's first film. An empty town has no lanterns, so it is never shown there. See [The Lantern Fork](LANTERN_FORK.md).
- **People throughout the day:** between highlights, follow an outdoor resident in 45-second clips. Shuffle the choices for each clip, favoring people with fewer featured clips and avoiding consecutive follows when another eligible neighbor is available. Only actual follows count toward the planned screen time. Include spectators at selected activities, but don't show a skipped event through audience close-ups. A neighbor skating on the frozen Millpond can always be followed, whatever the lineup, because the pond is not one of the highlights and has no show to skip; a follow that walks someone to the pond does not cut away when they step onto the ice. See [The Millpond](MILLPOND.md). A neighbor out in their own garden, on the bench, the porch or the front step, counts as outdoors. Switch to a ranked replacement if a resident goes indoors. If only one eligible neighbor is outside, stay with that neighbor. Keep the name label and foot highlight visible. A neighbor riding the tube is followed closely for the few seconds of the ride, then the camera settles; in the glass the label rides with them and there is no foot highlight.
- **The Riverside:** on a festival day, film the festival: the regatta 14:40–15:45, the Harvest Fair 15:00–15:40, the Long Table 20:24–20:44 or the stars 23:00–23:45. It ranks after lantern hour and the cinema and before the day's selected gatherings. On other days a shuffle seeded by the day picks the market (09:30–10:10) or the Bandstand's teatime set (16:00–16:40), ranked after the gatherings and before the ducks. A Riverside shot with nobody there for its whole window is skipped. Its guests can be followed, except while their outing is on air. See [Town events](TOWN_EVENTS.md#the-riverside).
- **Football:** on selected days, cover the full 10:40–13:00 match, including its break and final score. Other matches no longer automatically take over gaps in the broadcast.
- **The duck walk:** on selected days, follow the mother duck and five ducklings near the first houses at 10:00–10:40. Their full 08:00–12:30 river-to-neighborhood round trip still happens every day in the interactive town. The camera frames the whole family and tracks their movement.
- **Quiet hours:** follow Miso, the small town cat, when everyone is indoors and events are finished. At 20:00 each night, Miso emerges at the entrance of a home chosen by the evening's seed and wanders along the streets past nearby homes until 06:00. His nightly home and route are shared by the interactive town and live view and stay consistent across midnight and reloads. He is 20% smaller and walks 30% faster than his original stroll. Each night he keeps one steady pace, as near that as whole rounds allow, so his last round ends on his home step at 06:00 instead of out in the street. The cat does not count toward the resident population or alter residents' chosen routines. In a sparse neighborhood he explores his home's street; with no homes he starts outside the Little Stage.
- **Transitions:** ease nearby pans and zooms. Cut directly to distant subjects to avoid traveling over empty land. Keep people and the cat near the center; frame full event venues on both landscape and portrait screens.
- **During a held shot:** keep the camera fixed on the venue or scenery. Let the town's activity supply the motion. People, the cat, and ducks still use camera tracking as they move.

Lunch features can be a picnic, books and lemonade, or lawn games. Concerts can be rock, acoustic, or jazz. The director films the actual town simulation: it does not invent interactions or force residents into new routines.

The director plans a day's clips once, from the same day plans the town uses, and prepares the next day's in idle moments during the last town hour, so the picture doesn't stall at midnight. Casting and Miso's home follow the homes' ids in a fixed order, never the viewer's browser language, so every viewer sees the same neighbors.

The Starlight Cinema is also in the pool of daily broadcast highlights. When selected, its complete three-film program takes priority from 20:30 through the closing card, with the camera framing both screen and audience. Its initial program finishes at 23:30; later film libraries may produce different end times. Cinema guests are not used as audience close-ups on days when cinema is skipped. See [the cinema guide](CINEMA.md).

## Sound for recording

Town music starts automatically when the browser permits audible autoplay. Football kicks, whistles, and cheers use the camera's distance from the ground. Browsers can block sound on a fresh visit: allow sound/autoplay for the site or click anywhere on the page (a key press also retries). No sound button or prompt appears in the recording. Background tabs suspend sound and catch up with the live town when visible again. Ensure the capture browser is active and its audio output is included in your recording setup.

## Breaks

The live page can cut away from the town for a short break: a town ad or a card, drawn at 320×180 like the cinema's films and scaled whole over the picture (dusk fills any margin). A break fades in over its first 400 ms and out over its last 400 ms, and ads end on their sponsor card instead of fading it. Breaks are off unless the address asks for them, so a plain `/live/` is exactly the town.

### Address parameters

| Parameter                                   | Effect                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `breaks`                                    | Turns scheduled breaks on. Bare (`?breaks`), empty (`breaks=`) or anything but a whole number means every 30 minutes; `breaks=<N>` with N from 1 to 120 means every N minutes.                                                                                                                                                                                  |
| `break=ad:<artwork>` or `break=card:<card>` | Shows one item once, for testing or a preview: any live-break ad (`eggs`, `matchday`, `disco`, `millpond`, `zoo`, `realty`, `tube`, `ducks`, `lanterns`, `movers`) or card (`right-back`, `coming-up`, `neighbors`, `welcome`). It starts 2 s after the page opens, and at least half a second after the break pictures have loaded. Unknown names are ignored. |
| `welcome=<id>,<id>`                         | Welcomes up to three new neighbors by house id (see below). Founding houses and unknown ids are skipped.                                                                                                                                                                                                                                                        |
| `welcomeWait=1`                             | The welcome waits for `forktownLive.startWelcome()` instead of starting 2 s after the page opens. If nothing calls it, it starts 30 s after the page opens.                                                                                                                                                                                                     |
| `welcomeSince=<ms>`                         | When the welcome was asked for (epoch ms). A welcome more than ten minutes old is dropped, so a reload after a crash doesn't welcome the same neighbor again.                                                                                                                                                                                                   |

Anything else in the address, such as a cache-busting `v=`, is ignored.

### The schedule

Scheduled breaks follow real UTC time, so every viewer and every reload agrees. With the default 30 minutes there is one break per real half hour, starting on :00 or :30. Each slot airs one item from a pool of twelve: the ten live-break ads (every cinema ad except the snack bar and "phones off"), "Coming up in Forktown." and "Meet the neighbors.". The pool is shuffled once per pass, so each item airs once before any repeats, and the same item never airs twice in a row. "Meet the neighbors." moves on to the next neighbor's house each pass (in id order; founding houses fill in only while fewer than three neighbors live in town). "Coming up in Forktown." lists the next three billed moments with their town times, a real-time countdown, and the town date and moon. It bills the day's Riverside shot only when the director will air it, from the minute it first does, though its window is protected either way.

A break never covers a protected moment. These are the scenery minute (05:00–06:00), lantern hour (19:58–20:24, when the town has homes), and that day's featured highlights: the duck walk, the football match, the lunch gathering and the zoo afternoon, the evening concert, the midnight disco and the cinema's program, and the day's Riverside shot. When a slot opens during one, the break waits in 5 s steps until it has 2 s of clear air before it and 3 s after it. Every break ends inside its own slot, and a slot with no clear gap long enough is skipped. A page that opens (or reloads) during a break, or less than 15 s before one starts, skips that break, so a reloaded capture page never joins one partway through.

### The welcome

When a house moves in, the stream box reloads the page with `welcome=<id>`. Each new neighbor gets a 10 s "A new neighbor just moved in." card with the house, its resident, the builder's `@handle` and its lantern number when known. Then the camera holds on the house for 25 s, and the follow label reads "New neighbor" and the house's name. The camera moves to the house as soon as the card covers the town, so the card fades out on the house itself. Up to three houses follow one another. Each 35 s welcome starts in the first clear 5 s step that meets no protected moment or scheduled break, with the same 2 s and 3 s margins. A house that can't start within ten minutes is left out. With `welcomeWait=1`, the box calls `startWelcome()` once the page is on air, so the welcome is never hidden behind the box's own intermission.

### Pictures, sound and fonts

The ads and cards live in the same lazily loaded chunk as the cinema's films. When any break feature is on, the page fetches that chunk and the four faces the art writes in (Fraunces, Fraunces italic, Space Mono and DM Sans) as it opens, so no break paints in a fallback font. Until they arrive the town carries on without breaks. If the chunk can't load, the page shows no breaks or welcome cards and asks for it again every 30 s. The welcome waits up to ten seconds for them before it goes ahead, holding on the house without its card if it must. While a break fully covers the picture the town stops painting, but the camera keeps moving underneath. A break's jingle plays at full volume in the centre and lowers the town music, and the football sounds pause. The page renders the next break's sound up to 15 s before it starts, so its first note is on time.

### `window.forktownLive`

Every `/live/` page installs a small API for the stream box, with or without breaks:

```ts
window.forktownLive = {
  version: 1,
  build: { sha: string | null, builtAt: string },   // this build, as in live/build.json
  quietFor(seconds): boolean,   // no protected moment and no welcome step in the next N seconds
  startWelcome(): boolean,      // starts a waiting welcome; idempotent; false when there is none (or it is over)
  state(): {
    shot: string, label: string,                      // the camera's current shot id and label
    break: { key, item, endsAt } | null,              // the break on screen: e.g. key 'break:<slot>', item 'ad:eggs', endsAt in epoch ms
    welcome: 'none' | 'armed' | 'scheduled' | 'showing' | 'done',
    films: 'loading' | 'ready' | 'missing',           // the break pictures and fonts
    build: { sha, builtAt },
  },
};
```

Break keys are `break:<slot>` for a scheduled break, `welcome:<id>:<start>` for a welcome card and `forced:<item>` for a `break=` item. While a break or welcome card is on screen, `main.live-stream` also carries `data-break="<key>"`, which the stream box uses to hide its clock overlay. The town canvas keeps the accessible name `Forktown live: …`, naming the break during one. It is the only element with that name, and the break layer is hidden from assistive technology.

`quietFor` lets the box wait for a clear moment before a planned reload. Scheduled breaks don't count against it, because the box covers a reload with its own intermission and the reloaded page skips a break in progress.

### `live/build.json`

The production build also writes `live/build.json`, which the stream box polls to spot a deploy:

```json
{
  "version": 1,
  "sha": "<git revision or null>",
  "builtAt": "<ISO time>",
  "houses": [{ "id": "…", "name": "…", "creator": "…", "founder": false }],
  "arrivals": ["<newest id>", "…"],
  "latestArrival": { "id": "…", "name": "…", "creator": "…" }
}
```

`sha` and `builtAt` match `forktownLive.build`. When the published file's identity differs from the page's, the box works out which houses are new, waits for `quietFor`, and reloads with `welcome=<ids>&welcomeWait=1&welcomeSince=<now>`. The stream box's side, including the pre-rendered intermission reel it plays while the page reloads, is described in [the intermission reel guide](INTERMISSION_REEL.md).
