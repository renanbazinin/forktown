# The sky and the town almanac

A small sun crosses the background between 06:00 and 20:00 town time. The moon follows between 20:00 and 06:00, continuing smoothly through midnight. Dawn and dusk blend the sky colors; a few fixed, faint stars appear at night. The sun and moon have quiet halos and pixel edges matching the map. They are painted behind the entire town in screen space, so they stay distant during camera movement and can be hidden by the terrain when zoomed in. While the moon is up, the Millpond holds its reflection in the same phase; the sky itself is unchanged. Both the interactive map and the live broadcast use the same renderer.

Choose the date and moon beside the map clock to open the **Town Almanac**. It shows the current season and year, a short line on what the season is doing in town that day, the date, lunar illumination, and a four-week overview. Escape, the close button, or a click outside closes it. The current date is also labeled for assistive technology. The live broadcast stays free of calendar controls.

## A calendar that keeps going

The fictional calendar begins at **2026-09-20 00:00:00 UTC**: Spring 1, Year 1, with a new moon. This epoch is a permanent constant, never the build date or the visitor's first visit.

- One town day is the existing 24 real minutes.
- Spring, Summer, Autumn, and Winter each contain 28 town days.
- A year contains 112 town days (44 hours and 48 minutes of real time).
- The moon completes a continuous 28-town-day cycle (11 hours and 12 minutes of real time), from new through waxing crescent, first quarter, gibbous, full, last quarter, and waning crescent. Full moon is halfway through the cycle, on the 15th date of each season.

These are game seasons and lunar phases, not real-world astronomical predictions. The seasons now dress the scenery: blossom, fireflies, turning leaves, pumpkins, and snow follow the calendar for every visitor. See [The turning year](THE_TURNING_YEAR.md). They change one outing: in deep winter, while the Millpond is frozen hard, some afternoon strollers skate on it. See [The Millpond](MILLPOND.md). Football retains its own daily lineup seeded by the real UTC date.

The calendar, sky, and moon are pure functions of the same epoch-based town day and minute that drive residents and events. There is no local timezone conversion, random initialization, saved calendar, or accumulated timer. A refresh, another visitor, or a return from a background tab derives the current state directly. Pausing freezes this view's date and sky together; resuming catches up. Reduced-motion users inherit the town's paused start. Synchronization still assumes reasonably accurate device clocks, as it does for the rest of the town.

## Golden hour and the horizon

Around sunset (18:30–20:20, peaking at 19:25) and sunrise (05:30–07:00, peaking at 06:15) the low sky and the sun turn warm, and a faint golden wash, never stronger than 0.05, lies over the town. Two layers of stepped pixel hills stand in the sky behind the town, and the sun sets behind them. Three tiny sister forks on the far ridge light their lanterns at 20:00 with the Lantern Fork. See [The far side](THE_FAR_SIDE.md) for timing, the far fields beyond the back edges, and the commit stones at road crossings.

## Nightfall below the sky

The town has two hand-picked looks, day and night, and it turns between them with the light instead of in one frame. Dusk runs from 19:10 to 20:30 town time, eighty real seconds on a smoothstep, and from 19:30 the land is a little darker than the sky, as it is after sunset. The town is 0.09 of the way to night at the golden-hour peak (19:25), two-thirds of the way when the first lantern lights at 20:00, and fully night as the last streetlamp lights at 20:30. Dawn mirrors it from 05:30 to 06:50, so at 06:00, when every light goes out at once, the town is exactly as dark as when the first lantern lit. Before this, the whole town switched at 20:00 and 06:00 in a single frame, under a sky that was already half dark.

Through the fades the map paints the town in both looks, each exactly as it is by day or by night, and lays the look it is turning to over the other, weighted by the town's night share (`townNightShare`): the night look at that share at dusk, the day look at one minus it at dawn. The second look has a canvas of its own, created when a fade starts and handed back with its caches when it ends; for the first and last two seconds of a fade, when it would change no pixel, it is not painted. Each canvas keeps one look for the whole fade, so its ground layer, house sprites and pitch layers stay warm, and the football players' facing is shared between the two so they always agree. Everything is painted for the same minute, so nothing that moves is ever doubled.

The cost is a second paint for 80 s at dusk and 80 s at dawn, most of it canvas raster in the browser's GPU process. Measured on a desktop with an RTX 3060 Ti, the map still repaints 30 times a second at rest on a 1440 × 900 screen at 2× (28–29 in the whole-town view) and about 22 times on a 2560 × 1440 screen at 2×; dragging the map through a fade drops it from about 36 to 21–27 times a second at 1440 × 900 at 2×. A slow phone may repaint about half as often through the fades.

The lights, the town's events and the page's night style keep 20:00 and 06:00: lanterns, windows, lamps, the sister forks, Miso and the cinema start on their own minutes, and a light that exists only in the night look swells in with it. The outlines and labels of open plots take their day or night ink at 20:00 and 06:00 in both looks, when the two inks read about equally well on the half-dark ground, so they never blend away. The page chrome, the wordmark and its mark included, still turns at 20:00 and 06:00, over 400 ms.

## Code and verification

- `src/lib/town-calendar.ts`: date arithmetic, lunar geometry, sky light, the town's night share, and celestial paths.
- `src/city/twilight.ts`: the dusk and dawn fades, used by the map and the live broadcast in place of a plain `renderCity`.
- `src/city/sky.ts`: the backdrop, drawn before camera transforms and terrain. It is separate from the ground cache so sky motion does not rebuild terrain. It hands the town's snow cover to the horizon.
- `src/city/horizon.ts`: golden-hour timing, the screen-space hills and sister forks with their winter snow, and the world-space far fields and commit stones.
- `src/components/CalendarClock.tsx` and `src/calendar.css`: the clock's date button and native dismissible almanac popover, with its season line.
- `src/lib/seasons.ts` and `src/lib/season-copy.ts`: what each day of the year does to the scenery, and the almanac's line for it.
- `tests/town-calendar.test.ts`: timezone agreement, direct access after gaps, season/year boundaries, lunar symmetry, sunrise/sunset, midnight continuity, and a night share that agrees with the lights outside the fades and never steps between two frames.
- `tests/twilight.test.ts`: one plain paint outside the fades and in their unseen first and last seconds, the right look and plot-mark ink on each canvas through them, the weight each look is laid down at, and only the second canvas handed back once a fade ends. `tests/render-smoke.test.ts` checks that the plot marks take their ink from the lights, not the look.
- `tests/far-side.test.ts`: golden-hour timing, ridge bands, sister-fork lighting, call budgets for the sky and far fields, and deterministic drawing.
- `tests/seasons.test.ts` and `tests/season-copy.test.ts`: the seasons' schedules agree with the almanac in every timezone, and the season line never names something the town is not showing.
- `/tests/manual/sky.html` on the development server: inspect day, night, golden hour, and moon phases using the real town renderer and its dusk and dawn fades, in the opening view or the whole town, at 1440 × 900 or 390 × 844. These controls exist only in the manual fixture and do not change the live clock. `/tests/manual/seasons.html` does the same for the seasons across the whole year, and `/tests/manual/millpond.html` shows the moon in the water at each phase.

Run `npm run check`. The fixed epoch should not be changed in later releases: changing it would shift everyone's calendar and moon phase.
