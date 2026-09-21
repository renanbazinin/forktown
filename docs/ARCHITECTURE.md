# How Forktown fits together

## A static city, built from reviewed files

Place JSON files → shared schema validation → Vite static build → React interface + Canvas city.

The browser imports bundled place data. There is no database, GitHub API dependency, login, or runtime fetch of contributor repositories. Merging a contribution changes the next build of the town. Forks work on their own and may be hosted separately.

### Why React, TypeScript, and Canvas?

React manages the directory, forms, native dialogs, and contribution state. TypeScript makes renderer and data changes easier to follow. Canvas provides a compact, original isometric world without a game engine. The complete contributor entry point remains a small JSON file; contributors do not need to learn the app stack.

### The contribution boundary

`src/lib/schema.ts` is the source of truth for fields and bounds. The CLI, app loader, and editor all reuse it. Files have stable ids and names; the loader discovers `places/*.json`, so contributors never touch an index. Duplicate ids and occupied plots fail the build. Strings are rendered as text. The optional `sign.html` field is parsed with parse5 into a bounded set of drawing instructions; it is never inserted into the DOM or run in an iframe. Scripts, links, external assets, event attributes, and unsupported CSS are rejected. See [sign artwork](SIGN_ARTWORK.md).

Schema validation does not prove creator identity, story suitability, or authorization to modify an existing place. Those are part of maintainer review. No contribution is automatically merged. Checks run without repository write permissions or secrets.

### Stable world positions

`town-config.ts` sets the row and column counts; `world-layout.ts` derives 50 named plots on a four-tile street grid. Each block has a three-by-three grass plot with the house centered inside, a wider lawn, and a short entrance path. Road bounds, resident entrances, plot selection, shoreline, and camera framing follow the shared world dimensions. Expanding the row or column counts preserves existing plot ids, coordinates, and share links. A place’s location depends only on its `plot`. Adding a file, changing names, or sorting a directory does not move other buildings. Empty plots can be selected on the map or through the directory.

Plots are not reservations. Concurrent pull requests can conflict; re-run checks against the current main branch before merging. Enable required status checks and require branches to be up to date (or use GitHub’s merge queue) when you publish.

### Rendering

`render.ts` composes terrain, `houses.ts` draws customizable homes and cached sign textures, and `residents.ts` draws resident sprites and greetings. Depth sorting follows isometric coordinates; house selection bounds account for extra floors. The canvas uses a capped device pixel ratio and only resizes its backing buffer when dimensions change. Animation uses requestAnimationFrame capped at 30 updates per second while the page is visible. Hidden tabs stop painting; returning immediately resynchronizes to UTC time. A paused town redraws only on other state or input changes. Reduced-motion users start paused.

`City.tsx` owns the camera and input. The directory is an equivalent keyboard route to the places and empty plots; the map itself supports arrow keys, plus/minus, and Home. Canvas artwork is supplementary to textual place details.

`ambience.ts` adds plot-seeded wildflowers only to unoccupied lawns and small daytime bird flocks. Houses with chimneys smoke while their resident is working or relaxing indoors; at night, one window shows that resident's silhouette. Motion derives only from the existing town minutes, so pause, hidden tabs, and reduced-motion behavior also apply to these details. The scenery adds no contribution fields or interaction targets.

### Private previews and persistence

The builder stores its fields under `forktown-draft-v2` in localStorage. Storage and clipboard failures have fallbacks. Draft validation allows unfinished text while keeping rendering choices valid. Saved drafts, including incomplete usernames or stories, are restored next time the builder opens. If their plot is now occupied, the editor chooses another available plot. A submitted local preview exists only in React state for the current visit, is labeled as local, and never changes source files or the public town.

Share links use `#place=id`, so static hosting needs no rewrite rules. Deep links work on root and repository subpaths. GitHub links are shown only after a valid `VITE_GITHUB_REPOSITORY=owner/repo` is set. The initial `forktown` creator is a clearly labeled starter credit, not a claimed contributor profile.

### Save to the local project

During `npm run dev`, `scripts/local-places.ts` adds a development-only POST endpoint. The builder’s **Save to my project** action writes a new, formatted `places/<id>.json` in the checkout running the server. Vite discovers the file and refreshes the city. The save creates no commits, branches, pushes, or PRs; those remain the contributor’s next steps. A completed save clears the browser draft.

The endpoint accepts loopback connections with a matching local Origin and a per-server token, requires JSON, and limits request size. It validates against the shared schema and the current files on disk, serializes saves to avoid simultaneous plot claims, rejects redirected places directories, and uses exclusive file creation to avoid overwriting existing files. Errors identify the conflict in the builder. The server token and save UI are disabled in production builds, and the endpoint is not installed in the production preview server. Hosted sites are read-only: contribution actions open a fork-and-local-development guide, and the builder is not mounted. The shared source browser shows the actual bundled JSON files; local users can also open a newly saved file before it is pushed.

### A deliberately small simulation

`simulation.ts` is a pure function of reviewed places and town minutes. BFS paths connect road tile centers. Each resident uses a stable id-based loop that starts and ends at their doorstep; whole walking loops plus short rests fit within the current period. This ensures residents are home when their activity changes. A different path can overlap another resident's path; there is no collision avoidance or traffic model.

Morning is 06:00-12:00, afternoon 12:00-18:00, evening 18:00-22:00, and night 22:00-06:00. Daytime choices are stroll, work at home, and relax at home. Night chooses sleep (default) or stroll. A stable resident-id hash staggers three-hour local walks between 22:00 and 02:00; each walker returns home by 05:00. Night progress is anchored to 22:00 across midnight, so the town-day rollover does not teleport walkers. Working, sleeping, and relaxing residents are inside: their sprites are hidden and cannot be selected on the map. Their activity remains visible in the directory and follow status. Nearby walkers occasionally exchange their configured greeting. No resident depends on another contributor's id or an appointment.

Up to eight night strollers instead attend the Little Stage's 23:30–02:30 party, traveling from 22:30 and returning home by 04:30. Their guest list is seeded from the evening's day number, including after midnight, so the same people keep their spots. Selected guests sleep before departure and after returning; overflow keeps the local moonlit walks above. `eventMinutes` maps early-morning time onto the previous evening's timeline, and `eventAtVenue` chooses between the stage's evening concert and night party. Rendering, event labels, and music use the same timing helpers.

`town-time.ts` maps UTC epoch milliseconds to town minutes using a 1,440,000ms cycle. One real minute equals one town hour; sixty cycles fit exactly into one UTC day. At 00:00 UTC the town reads 00:00; 00:01 UTC is 01:00 in town, and 00:24 UTC begins another town day. This is a compressed clock, not the literal UTC hour. Every render derives time from Date.now(), so reloads, time zones, and suspended tabs do not reset the phase or accumulate timer drift. Synchronization assumes reasonably accurate device clocks; there is no network time service. Pause freezes only the current view, and resume catches up to live time. The slider, variable speed, and manual day/night controls are removed. Night lighting starts at town time 20:00.

Residents derive facing from their current route segment: southeast, southwest, northeast, or northwest. Front and back artwork is mirrored for left/right travel, with matching hats, glasses, hair, and limb layering. A distance-based walk phase drives alternating foot lifts, arm swing, and a small torso bob; resting residents have no gait animation. The ground shadow and greeting text are not mirrored or bounced.

Path and sign caches are bounded. The current 100-plot world does not require a game engine or worker. Before expanding to large districts, profile rendering, path allocation, and the pairwise greeting check.

## Where to extend it

The Meadow Ground occupies a six-plot public site in the expanded town. Its internal roads and lamps are removed before road graph construction. `footballAt` derives the ball, eight players, scores, breaks, and sound cues from the shared clock. The renderer adds the pitch beneath depth-sorted players and furnishings; strolling contributors reach spectators' spots through the south entrance. Sound proximity uses the displayed camera, including follow mode. See [Football](FOOTBALL.md) for the match model, boundaries, and verification fixture.

- **Building family:** add an enum member and label in `schema.ts`, add its geometry in `houses.ts`, and consider its selection bounds in `buildingHit`. The editor discovers enum values automatically.
- **Decoration:** extend the enum and renderer.
- **Town size:** increase the counts in `town-config.ts`; see [Expanding the town](EXPANDING_THE_TOWN.md). Plots, validation, roads, and framing derive from that configuration. Separate districts can be designed later without renumbering these addresses.
- **Custom art or interactive interiors:** introduce a separately reviewed, bounded interface; do not execute arbitrary contributor files in the shared application.
- **Languages:** move UI strings to locale dictionaries while leaving place stories as their authors wrote them.
- **PR previews:** CI currently uploads a build artifact. A hosting service may add per-PR preview URLs later. No temporary public preview infrastructure is assumed.

## Current boundaries

One neighborhood, 100 plots, six building families, four decorations, and one resident per place. House customization and restricted exterior signs are supported; arbitrary HTML pages are not. Mobile supports touch drag and zoom buttons; multi-touch pinch zoom is not implemented. The contributor directory is the accessible way to browse Canvas content. There is no long-term plot reservation, automated account verification, multiplayer, persistent user backend, or content moderation service.
