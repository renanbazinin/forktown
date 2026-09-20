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

`world.ts` owns 25 named plots with explicit coordinates. A place’s location depends only on its `plot`. Adding a file, changing names, or sorting a directory does not move other buildings. Empty plots can be selected on the map or through the directory.

Plots are not reservations. Concurrent pull requests can conflict; re-run checks against the current main branch before merging. Enable required status checks and require branches to be up to date (or use GitHub’s merge queue) when you publish.

### Rendering

`render.ts` composes terrain, `houses.ts` draws customizable homes and cached sign textures, and `residents.ts` draws resident sprites and greetings. Depth sorting follows isometric coordinates; house selection bounds account for extra floors. The canvas uses a capped device pixel ratio and only resizes its backing buffer when dimensions change. The clock updates at 10 Hz while playing and stops advancing in hidden tabs. A paused town redraws only on other state or input changes. Reduced-motion users start paused.

`City.tsx` owns the camera and input. The directory is an equivalent keyboard route to the places and empty plots; the map itself supports arrow keys, plus/minus, and Home. Canvas artwork is supplementary to textual place details.

### Private previews and persistence

The builder stores its fields under `forktown-draft-v2` in localStorage. Storage and clipboard failures have fallbacks. Draft validation allows unfinished text while keeping rendering choices valid. Saved drafts, including incomplete usernames or stories, are restored next time the builder opens. If their plot is now occupied, the editor chooses another available plot. A submitted local preview exists only in React state for the current visit, is labeled as local, and never changes source files or the public town.

Share links use `#place=id`, so static hosting needs no rewrite rules. Deep links work on root and repository subpaths. GitHub links are shown only after a valid `VITE_GITHUB_REPOSITORY=owner/repo` is set. The initial `forktown` creator is a clearly labeled starter credit, not a claimed contributor profile.

### Save to the local project

During `npm run dev`, `scripts/local-places.ts` adds a development-only POST endpoint. The builder’s **Save to my project** action writes a new, formatted `places/<id>.json` in the checkout running the server. Vite discovers the file and refreshes the city. The save creates no commits, branches, pushes, or PRs; those remain the contributor’s next steps. A completed save clears the browser draft.

The endpoint accepts loopback connections with a matching local Origin and a per-server token, requires JSON, and limits request size. It validates against the shared schema and the current files on disk, serializes saves to avoid simultaneous plot claims, rejects redirected places directories, and uses exclusive file creation to avoid overwriting existing files. Errors identify the conflict in the builder. The server token and save UI are disabled in production builds, and the endpoint is not installed in the production preview server. Hosted sites keep the download/copy contribution route.

### A deliberately small simulation

`simulation.ts` is a pure function of reviewed places and town minutes. BFS paths connect road tile centers. Each resident uses a stable id-based loop that starts and ends at their doorstep; whole walking loops plus short rests fit within the current period. This ensures residents are home when their activity changes. A different path can overlap another resident's path; there is no collision avoidance or traffic model.

Morning is 06:00-12:00, afternoon 12:00-18:00, evening 18:00-22:00, and night 22:00-06:00. The three configured choices are stroll, work at home, and relax at home. Sleeping and relaxing residents are inside; working residents appear at their doorstep. Nearby walkers occasionally exchange their configured greeting. No resident depends on another contributor's id or an appointment.

`use-town-clock.ts` starts each visit at 09:00. At 1x, one real second equals one town minute: a day takes 24 minutes. Visitors control their own clock with pause, 1x/4x/12x speed, and a time slider. Time scrubbing intentionally jumps to the corresponding state and pauses playback. The state is reproducible at the same time, not persisted or synchronized across visitors. Night lighting starts at 20:00.

Path and sign caches are bounded. The current 25-plot world does not require a game engine or worker. Before expanding to large districts, profile rendering, path allocation, and the pairwise greeting check.

## Where to extend it

- **Building family:** add an enum member and label in `schema.ts`, add its geometry in `houses.ts`, and consider its selection bounds in `buildingHit`. The editor discovers enum values automatically.
- **Decoration:** extend the enum and renderer.
- **District:** define a versioned plot convention before extending beyond the first 25 plots. Keep existing ids and coordinates stable. Update the schema, available plot list, and tests together.
- **Custom art or interactive interiors:** introduce a separately reviewed, bounded interface; do not execute arbitrary contributor files in the shared application.
- **Languages:** move UI strings to locale dictionaries while leaving place stories as their authors wrote them.
- **PR previews:** CI currently uploads a build artifact. A hosting service may add per-PR preview URLs later. No temporary public preview infrastructure is assumed.

## Current boundaries

One neighborhood, 25 plots, six building families, four decorations, and one resident per place. House customization and restricted exterior signs are supported; arbitrary HTML pages are not. Mobile supports touch drag and zoom buttons; multi-touch pinch zoom is not implemented. The contributor directory is the accessible way to browse Canvas content. There is no long-term plot reservation, automated account verification, multiplayer, persistent user backend, or content moderation service.
