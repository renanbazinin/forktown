# Market Square

Four public plots by the river, **D14, D15, E14 and E15**, make one paved square on the duck street. Every morning it holds a market: a farmers' market, flowers or books, the same all day for everyone (`MARKET_KINDS[hash('market:' + day) % 3]`). Six stalls stand along the square's two back edges, three facing the camera from the north edge and three from the west, with their counters on the lines the browsers face (y 14.9 and x 54.9). The south and east sides stay open. A produce handcart waits in the north-west corner, and a low iron pump with a stone trough stands in the open south-east corner. Open `#venue=market`, or click a stall or the paving. The times, the seats, the copy and the live shot are in [Town events](TOWN_EVENTS.md); this page is about what the square looks like and how the browsers behave.

## The morning

The stallholders come one after another, in an order of the day's own (`hash('market-awning:' + day + ':' + stall)`):

| Town time   | What happens                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| 07:10–07:30 | Each stallholder fades in over three minutes, folds back the canvas and puts the frame up.                           |
| 07:15–07:45 | The awnings unroll one at a time. Each roll fades in at the top rail, then unrolls over two minutes.                 |
| 07:32–07:58 | The wares come off the handcart: one piece every 2.3 minutes per stall, each fading in over a minute.                |
| 08:00–11:30 | Open. Browsers come and go at their own hours (each home's window, from 08:00).                                      |
| 11:30–12:00 | The wares go back on the cart, the awnings roll up one at a time, the frames fold under canvas, the stallholders go. |

The cart is full overnight and empties as the stalls fill: each of its three loads goes out with the first crate of two stalls, and comes back with them at noon. While the market is open the stalls' canvas covers ride in it, folded. Every change is a fade of a minute or more, or a roll, so nothing moves more than 0.05 in alpha a frame (the town's no-flashing rule allows 0.08). The ducks still pass behind the north stalls on the duck street at 08:05–08:36 and come back past the packing-up at 11:53–12:25.

From noon to the next morning the square is shut: each counter under a roped canvas cover with the folded poles making ridges on top and their ends poking out, the cart covered too. That is the look at night and through the afternoon and evening.

## The stalls

A stall is 1.5 tiles long and 0.9 tiles deep. From the back: two posts carry the top rail at 26 px; the striped awning reaches 0.26 tiles toward the camera from the rail and dips to 23 px at its scalloped hem; the stallholder stands in front of it; then the counter, 12 px high, with a cloth runner in the awning's stripe and a slate of prices on its front. The awning sits over the back of the stall on purpose. A figure is 31 px tall and a stall may stand only 28 px (SPEC §2.4), so an awning over the stallholder's head would hide them from the camera entirely. Over the back, it frames their head instead.

- **Awnings.** Sage and cream for the farmers' market, rose and cream for flowers, slate and cream for books. Never amber. In winter `snowAt` lays snow on each awning on its own schedule, and on the covers at night.
- **Stallholders.** Six scenery figures drawn with the residents' own figure, dressed for the day's trade, with an apron in the stripe or in cream. They face the browsers. Now and then one turns to the stock behind for a minute or so (more often while stocking and packing), but never while a browser at their stall is chatting. They are never residents and never counted.
- **Depth.** Each stall sorts at `s0 + 0.6 + counter line`: behind its own browsers and anyone on the lanes in front, in front of anyone on the duck street or the west road behind it. A stall's screen box can only meet a walker behind it below that line, and a browser in front above it.
- **Heights.** The stalls reach 27.5 px (the rolled awning on the rail), the pump 23 px and the tubs 24 px. `tests/district-render-market.test.ts` measures every painted point.

## The wares

What is on the counters depends on the market and the season, and the farmers' stalls follow the farm's own year: a new set of crates at the middle of each season, as its rows ripen. Each stall has a back row on the counter, with its lowest piece in the middle where the stallholder stands, a front row, and sometimes something on the paving in front. Stalls swap places from day to day.

| Market   | Spring                                                   | Summer                                                    | Autumn                                               | Winter                                                     |
| -------- | -------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| Farmers' | Seedling trays, rhubarb, eggs, then radishes and lettuce | Strawberries and cherries, then tomatoes, beans and plums | Apples, pears and squash, then pumpkins and cabbages | Roots, keeping apples and jars of jam and chutney          |
| Flowers  | Tulips, daffodils and irises in zinc buckets, trays      | Sweet peas, roses and cornflowers, potted geraniums       | Paper bags of bulbs, bunches of dried flowers        | Wreaths of fir, holly and ivy, bundles of fir, little firs |

The books stalls keep the same wares all year: boxes of paperbacks spines up, stacked hardbacks, teacups and a teapot, crates of records, picture frames, and one gramophone with its flared horn. The two half-barrel tubs at the open corners flower with the season too (tulips, geraniums, rust chrysanthemums, holly), and the chalk board by the north-east way in has the day's market drawn on it: an apple, a flower or a book.

## The browsers

Up to twelve browsers stand at the twelve spots, two to a stall (SPEC §2.3). They take no new pose. Their rhythm is in `src/lib/outings/market.ts`:

- They face their stall from the moment they arrive.
- Every 6–10 minutes (`market-look:${id}:${k}`) they glance a quarter turn to the next stall along their row for 1.5 minutes: inward from the stalls at the ends of a row, either way from the middle one.
- One beat in three (`market-chat:${id}:${k}`) they chat with the stallholder for two minutes, a minute after turning back.
- Nothing starts in their first minute at the spot or runs into their last, so they always arrive and set off facing their stall, and every look is held for a minute at least.
- Someone who comes before their own hour opens browses their own stall until it does, and glances only after, as an early guest anywhere in town faces the show.

`chat` is a seated pose in the figure (folded legs), so a browser never takes it. The market painter draws the residents' own chat bubble over them instead, from the same beat, while they keep standing. It skips a browser who is greeting someone.

## The paper bag

On the way home every browser carries a brown paper bag in the crook of the near arm, the hand under its bottom and its top rolled down (`src/city/carry/paper-bag.ts`). Greens show over the rim after a farmers' market, stems in flower after the flowers, and a book's corner after the books. Walking away from the camera it rides a little further out, so it peeks past the body. It bobs with the step, dims at night with its carrier, and is never drawn in a Treeline stack or the glass.

## The panel

`PUBLIC SPACE · D14–E15 · 4 PLOTS`, then whether the market is later today, happening now or finished today, "Market Square.", today's market and its words, and "Open 08:00–11:30. Browsers walk home with a paper bag." While anyone is browsing it lists them by name under "AT THE STALLS NOW", each a link that follows them; with nobody there it says nothing about a crowd. Once the market has closed it adds "Next market: tomorrow, 08:00." A browser still at a stall after 11:30 keeps it open until they set off.

## Where it lives

| File                                     | What                                                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/outings/market.ts`              | `marketBeat`, `marketFacing`, `marketPose` (none) and `marketChat`                                                                     |
| `src/city/district/market.ts`            | The paving and shadows (ground), the outline (floor), the stalls, cart, pump, tubs, board and chat bubbles (objects), and clicks (hit) |
| `src/city/carry/paper-bag.ts`            | The bag                                                                                                                                |
| `src/components/district/MarketInfo.tsx` | The panel                                                                                                                              |
| `tests/manual/district-market.ts`        | The harness's market moments                                                                                                           |
| `tests/market.test.ts`                   | The browsers' rhythm, the bag and the panel                                                                                            |
| `tests/district-render-market.test.ts`   | The art: its cache, the clock, heights, wares, snow, night, depth, clicks, amber and the call cap                                      |

**Cached art.** Everything that depends only on the market, the season's day and the night (`marketArt(day, groundDay, night)`, keyed `kind:groundDay:night`) is worked out once and kept: the colours, each stall's display, the stallholders and the snow. The paving and the shadows of the counters, the cart, the pump and the tubs are in the town's cached ground layer, which reads only the night and the season's whole day. A frame only places the art and runs the clock.

**Budgets.** At 10:00 with all twelve browsers at their stalls the market paints 860–970 canvas calls a frame, depending on the market and the season, against a cap of 1,100 (SPEC §6.6). Below zoom 0.6 the hems' scallops, the slates and the plank lines are left out. Off screen it paints nothing.

**Harness.** `tests/manual/district.html?venue=market` has the market's moments: the morning in order on a spring farmers' day, bags on the way home, each market at the live shot through the year, and the square under canvas at night.
