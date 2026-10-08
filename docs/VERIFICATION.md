# Living edition verification

This is a record of how the living edition was checked in September 2026, verified locally on September 20 with Node.js 24.19.0. It describes the town and the repository as they were then. For the town today, see the [project guide](PROJECT_GUIDE.md).

## Historical implementation checks (September 20)

- `npm run check`: 79 tests passed; all nine places (eight starters and the first contribution) validated; TypeScript and the production build passed.
- `npm run format:check`: passed.
- Contribution tests cover duplicate plots and ids, invalid fields, filename conventions, international text, incomplete drafts, stable coordinates, hit detection, and composed night colors.
- Publishing tests cover project paths, user-site roots, custom-domain overrides, and malformed configuration.
- Local save tests exercise real HTTP requests and temporary folders: file creation, formatting, duplicate files, stale plot claims, simultaneous saves, invalid data, malformed or oversized requests, local origin/session checks, and production disabling.

## Browser checks

- Inspected the full desktop layout and the 390px and 320px responsive layouts.
- Selected a building directly on the Canvas map and through the directory.
- Checked open plots, empty search results, day/night controls, zoom, and reset.
- Customized a building and verified the exported JSON through both the clipboard and the downloaded file on disk.
- Added that downloaded file to `places/` and verified its creator credit and direct share link in the city. Removed the temporary contribution afterward; the project retains its eight starter places.
- Checked the local preview, saved unfinished draft, friendly username error, and focus moving to the invalid field.
- Corrected narrow-screen building labels, sticky dialog controls, night roof colors, preview/source duplication during development, and illustration bounds.
- Loaded a production build from `/forktown/` and opened a direct link to the observatory, confirming the GitHub Pages-style subpath works.
- Used **Continue to save → Save to my project** in the browser. Confirmed the new JSON appeared in `places/`, the city updated from eight to nine places, the save confirmation stayed visible, and **See my place in town** opened its details after a reload. Confirmed the next builder draft was fresh. Removed the temporary test file afterward.

## GitHub and publishing

The initial foundation was pushed to the `renanbazinin/forktown` repository, which was private then. Its first **Check town** workflow passed; **Publish town** was skipped because publishing is opt-in. The local-save follow-up and `renanbazinin`’s first contribution, **My Little Place** on plot A1, have passed the local checks above.

The living edition was merged in PR #2 and deployed on September 20, 2026 at https://renanbazinin.github.io/forktown/. That release passed 94 tests, validated nine places, and passed type checking, formatting, and build checks. The map then had 50 plots. Hosted pages allow exploration and JSON browsing; building and saving require local development. The repository was still private, and an outside trial was still to come; see [External contributor trial](EXTERNAL_CONTRIBUTOR_TRIAL.md).

## Living edition checks

- New automated cases cover deterministic replay, road-only movement throughout the day, returning home before activity boundaries, nighttime sleep, incidental greetings, and reserved starter credit. (Residents have since gained their own lot: they may also walk their garden path and sit or potter at its spots, and they are in through their own front door within a few borrowed minutes of a boundary; `tests/home-life.test.ts` and `tests/living-town.test.ts` hold the new rules.)
- Sign tests cover inherited styles and entity decoding, source/nesting/text bounds, and rejection of scripts, events, links, images, SVG, iframes, forms, external CSS, and unsupported layout properties.
- Verified the three-tab builder in the browser: three-floor house, shutters, named resident, hat, morning stroll, and an HTML welcome sign. Unsupported link markup showed a useful error and blocked continuing.
- Saved the complete test contribution through the local builder. Verified its nested JSON on the confirmation screen, its appearance in the town, and its resident in the directory. Removed only that temporary `lantern-lane.json` test file afterward; the nine real places remain.
- Earlier checks covered following a resident, closer camera framing, pause, speed selection, time slider, and sleeping status at 23:59. The slider and speed controls were subsequently replaced by the shared UTC clock. No named meetings are part of the contribution format.
- Inspected the 390px mobile builder and sign editor; the dialog's scroll width matched its client width. Checked mobile night lighting and clock layout. Reset the temporary browser viewport after inspection.
- Verified the production build in a fresh browser tab: no console errors or warnings, readable Moonbeam sign artwork in its home details, and the hosted JSON-download flow. Closed the temporary preview afterward.
- This is a deterministic simulation with a shared UTC-based time phase, not a persistent multiplayer world. Larger districts, screen-reader testing with a human participant, and public fork onboarding remain future work.

## Wider lawns

- Expanded street spacing from three to four tiles, giving each house a three-by-three grass plot, a wider lawn border, and stepping stones toward the street.
- Updated plot hit areas, road routes, shoreline, lighting positions, and camera framing for the larger world. House artwork retains its scale.
- Geometry checks cover all 25 lawns and ensure every road stays outside selectable plots; routine and greeting tests also pass on the new road grid.
- Visually checked the expanded town and builder at desktop and 390px widths. Small screens start close enough to read the houses, with zoom-out available for the full map.

## Directional walking and the UTC clock

- Automated checks cover all four screen-space travel directions, bounded walk phase, UTC-midnight anchoring, one real minute per town hour, 24-minute rollover, timezone equivalence, and catch-up after absence.
- Inspected a temporary animated contact sheet containing all four directions with no accessory, a hat, and glasses. The view checks front/back artwork, mirroring, and stepping; the temporary page is removed afterward.
- Town time derives from the current timestamp, with rendering capped at 30 Hz. Pause remains available for accessibility and resumes directly to live time. Manual time slider, speed selection, and day/night toggles are removed.
- Browser verification confirmed no remaining time slider, a frozen paused clock, and immediate catch-up on resume. Checked the live follow view and the 390px clock layout without horizontal overflow; restored the normal viewport.

## Contribution work (September 21, 2026)

The initial local allowance work passed 103 tests but was not deployed. Review found an incompatible fork checkout in its proposed workflow. The replacement uses trusted default-branch code and paginated GitHub API data, with credit/ownership checks and statuses on the inspected PR commit. The expanded suite passed 122 tests during implementation; final release results are recorded in the associated PR.

The September 20 observation covered a fixed 24-minute town day using sampled screenshots. Walking, greetings, indoor hiding, day/night lighting and the map appeared intact; no new console errors were observed. Town hours 18 and 21 were missed, the final check arrived late, and exact transitions/continuous frame rate were not established.

Earlier sections are historical checks, including the former 25-plot layout and old controls. They are not claims about the current hosted UI. Since then the repository has gone public, and an outside contributor completed the fork trial on September 24, 2026 (issue #6).

## Any newcomer, on any plot (October 8, 2026)

The bigger town (20 × 15) was checked against the question "will the tests pass if someone builds a house on any plot?" A sweep committed one house, as the newest arrival, on each free plot of the 35-house town and ran the 74 test files that read the town. It found a tube-ride lookup crash with a newcomer on D13 and snowmen poses held under a minute with one on R11, both fixed. A review of the house pull request path found that the validator and the builder agree on the same 230 house plots, and that the rest needed help:

- A house on a plot that became a public place, such as R1 and A9 for the Treeline's halts, is now told which place stands there and which open plots are nearest. A plot that isn't on the map is told the rows and columns there are, with a hint when only the letter's case is wrong.
- A builder draft saved on such a plot moves to the nearest open plot instead of being thrown away.
- A house file saved as UTF-8 with a byte-order mark now validates, builds and passes the policy and auto-merge checks.
- `npm run check:full-town` gives its copy a Git history, so arrivals exist there, and a few of its made-up houses keep the builder's defaults or use every character the schema allows.
- `npm run check:newcomers` keeps the sweep: today's town plus one builder-default house, committed as the newest arrival, on a sample of eight free plots (R2, A10, D13, H14, R11, S15, A15 and T1, or the nearest free plot to each), or on every free plot with `--all`. It runs every test file that reads the town, runs each plot's failing files once more after every plot is done, marks a test that only ran out of time, and takes a few minutes a plot. CI doesn't run it; run it before merging a change to the simulation, the map or the venues.
