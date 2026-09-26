# Forktown project guide

[← Start with the visual quick start](../README.md)

Features, project structure, and development commands. For your first house, follow the README; for the JSON contract and contribution rules, read [Contributing](../CONTRIBUTING.md).

Starter places use `creator: "forktown"` as a project credit, not a real community contribution or a GitHub account endorsement.

## What works

- An original isometric city renderer, with trees, roads, a river, little residents, and six building styles.
- Wildflower patches on open plots, small daytime flocks, and chimney smoke and evening window silhouettes when neighbors are home. Ambient movement pauses with the town.
- A daily 08:00–12:30 duck walk: a mother and five ducklings leave the river, follow the street beside the Lunch Green to the first houses, turn around, and return to the water. The last duckling briefly dawdles and catches up. Nearby wandering residents stop for four seconds, turn toward the ducks, and show a heart bubble before resuming their walk. The family appears in both town and live views, without needing resident participation.
- Mouse and touch panning, zoom buttons, scroll zoom, and keyboard map controls.
- Custom floors, roof shapes, wall and trim colors, window styles, gardens, porches, and balconies.
- Residents with male and female figures, names, outfits, accessories, greetings, and simple day and night routines. Existing JSON files keep the original figure when `resident.figure` is omitted.
- Road-following strolls with four directional walking views, distance-based footsteps, occasional neighbor greetings, bedtime, and a camera that follows a resident.
- Shared daily events: picnics, books, and lawn games at the Lunch Green; rock, acoustic, and jazz evenings at the Little Stage. Strolling neighbors can join a small audience and walk home afterward. Both venues are reserved public plots.
- A nightly 23:30–02:30 disco at the Little Stage, with a DJ, dancing night owls, steady pastel lights, and an original dance track. Guests arrive and leave at different times, returning before their own bedtime; sleeping neighbors stay indoors.
- The four-plot Starlight Cinema on D6, D7, E6, and E7: three original animated shorts every night from 20:30, with six-second Forktown intermissions, a twelve-seat picnic lawn, projector, string lights, and popcorn stand. Film lengths stay independent; each day selects three distinct titles from the library. Night owls can walk from the cinema to the disco afterward when travel time and bedtime allow. See [the cinema and film library guide](CINEMA.md).
- The six-plot Meadow Ground: five-a-side football all day, a live scoreboard, passing, shots, saves, goal celebrations, spectators, and short breaks between halves. Zoom close with Town sound enabled for kicks, whistles, and cheers. See [Football at the Meadow Ground](FOOTBALL.md).
- The eight-plot Millpond on H3–I6: a watermill, a jetty, reeds, a grey heron and rising fish, rowboats through the summer, the moon and the town's lanterns in the water at night, and skating on the winter ice. It sits low, so the football stays in view. See [The Millpond](MILLPOND.md).
- The Treeline: a thin glass tube behind the northwest trees, for people and parcels, with two small stations, Hedgerow Halt on C1 and Willow Halt on N1. Neighbors ride only when it saves at least ten minutes door to door; short trips stay on foot. Hedgerow Halt's tiny sign reads "People & parcels. Please remove umbrella." See [The Treeline](TUBES.md).
- A shared UTC-based 24-minute town day, automatic day/night lighting, pause/resume-live, and reduced-motion support.
- A quiet sun, moon, and starry background, with continuous lunar phases and a shared town almanac. Four 28-day seasons count forward from a permanent UTC epoch. Open the date beside the clock. See [Sky and calendar](SKY_AND_CALENDAR.md).
- The Lantern Fork identity: a leaf-and-lantern fork mark shared by the header, favicon and /live, a warm lantern accent, a dusk skin for the controls after 20:00, and a first-visit welcome card. See [Brand](BRAND.md).
- The Lantern Fork on D3: a forked tree at the heart of town with one lantern for every house, in the order the houses moved in. Select it for the full register. See [The Lantern Fork](LANTERN_FORK.md).
- Lantern hour at nightfall (20:00): the Fork's lanterns, each house's windows and its lantern post light in arrival order, then the streetlamps carry the light outward from the Fork by 20:30.
- Tonight's tale: each evening one neighbor's own story is told at the Fork, in the Events panel and in the almanac. See [Tales](TALES.md).
- The far side: golden-hour light, a quiet horizon with three sister forks, far fields beyond the town, and commit-stone paving at every crossing. See [The far side](THE_FAR_SIDE.md).
- The turning year: the seasons dress the town. Blossom and drifting petals in spring, fireflies on summer nights, ochre and russet trees and pumpkins in autumn, snow on the roofs, the trees and the far ridge in winter, and a line in the almanac for each stage. See [The turning year](THE_TURNING_YEAR.md).
- Optional original music: day and night themes, three concert arrangements, and a midnight dance track, with a volume control, soft transitions, and automatic pause when the tab is hidden. See [Forktown FM](MUSIC.md) for the listening preview and score guide.
- Exterior signs: simple text or a restricted HTML/CSS artwork language, drawn as noninteractive canvas textures.
- A full-screen town with compact controls. Explore opens searchable places and open plots; the neighbor and music buttons reveal residents and events. All directories work with a keyboard.
- Place stories, contributor credit, and shareable `#place=id` links without server routing.
- A live building editor, local preview, direct saves to your local checkout, JSON export, and browser-based contribution instructions.
- A shared schema used by the editor, build, and contribution validator.
- Friendly errors for occupied plots, duplicate ids, invalid names, unsupported fields, and malformed JSON.
- Automated checks on pull requests and optional GitHub Pages deployment.
- All fonts, art, and place data are served locally. The hosted city needs no backend and includes no analytics; development saves use only the local server.

## Project map

```text
places/                    One JSON file per place — start here!
examples/                  A copyable contribution example
src/lib/schema.ts          The contribution contract and friendly validator
src/lib/world.ts           Stable plot coordinates and projection math
src/city/render.ts         Terrain and depth-sorted world renderer
src/city/houses.ts         Customizable homes and exterior sign textures
src/city/residents.ts      Pixel resident artwork
src/lib/simulation.ts      Deterministic road routes and daily routines
src/lib/sign.ts            Restricted HTML/CSS-to-artwork compiler
src/lib/brand.ts           Tagline, brand palette, mark pixels, and identity copy
src/lib/lanterns.ts        The lantern register, lantern-hour clock, and tonight's tale
src/city/lantern-fork.ts   The Lantern Fork on D3
src/city/horizon.ts        The horizon, sister forks, and far fields
src/lib/seasons.ts         The turning year: seeded schedules for trees, snow, and fireflies
src/lib/season-copy.ts     The almanac's line for each stage of the year
src/city/trees.ts          The town's trees through the year
src/city/weather.ts        Fireflies, falling snow, and the season's light
src/city/season-ground.ts  Seasonal grass tufts and river ice
src/city/season-palette.ts The turning year's colors
src/lib/millpond.ts        The Millpond: its site, ice, heron, fish, boats, and skaters
src/lib/millpond-copy.ts   The Millpond's panel copy and skating card
src/city/millpond.ts       The Millpond's water, mill, and wildlife
src/lib/tubes.ts           The Treeline: stations, route geometry and timing
src/lib/tube-journeys.ts   Tube or walk, and where a rider is
src/lib/tube-traffic.ts    The day's rides and parcels
src/lib/tube-copy.ts       The Treeline's panel copy
src/city/tubes.ts          The Treeline's glass, stations and riders
src/components/City.tsx    Map interaction and accessible controls
src/components/Contribute.tsx  Building editor and JSON export
src/components/BrandMark.tsx   The leaf-and-lantern mark and the wordmark's lantern
src/components/WelcomeCard.tsx First-visit welcome card
src/components/ForkCard.tsx    The Lantern Fork's register card
src/App.tsx                The town, directory, and onboarding
scripts/validate-places.ts Command-line contribution checks
scripts/local-places.ts    Development-only saves to the local places folder
tests/                    Contribution rules and world behavior
docs/                     Architecture and publishing guides
.github/                  Pull request checks, templates, and deployment
```

## Useful commands

| Command             | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Start the local city                                     |
| `npm run validate`  | Check every place with beginner-friendly errors          |
| `npm test`          | Test contribution rules and map behavior                 |
| `npm run typecheck` | Check the app’s TypeScript                               |
| `npm run build`     | Validate and build the production site                   |
| `npm run preview`   | Serve the production build locally                       |
| `npm run check`     | Run tests, validation, type checks, and production build |

## Put your town online

The app is ready to publish as a static site. Set `VITE_GITHUB_REPOSITORY=your-name/your-repository` to connect GitHub links. The included GitHub Pages workflow is opt-in and knows how to set the repository base path.

See [publishing](PUBLISHING.md). Creating this local project does not create a GitHub repository or publish anything.

## A foundation for more

The living edition keeps the first contribution small. Morning, afternoon, and evening each use one choice: stroll, work at home, or relax at home. At night, choose sleep or a night out. Up to eight night owls can join the midnight party, and cinema guests can walk over after their films. Short local walks and doorstep breaks fill free time around events. Each night owl has a stable bedtime between midnight and 05:00, with all walks ending at home. Four starter residents opt into nightlife: After Hours Studio, Stargazer Station, Moonbeam Café, and Plot Twist Books. Omitted night choices default to sleep. The clock follows UTC: one real minute is one town hour, with a new town day every 24 real minutes. Visitors at the same moment see the same daily phase when their device clocks agree. There are no accounts, leaderboards, real-time multiplayer, or automatic merges. Every place has a bounded plot and reviewed data. New districts, original sprites, more building types, and richer interactions can follow the community’s needs.

See [architecture and extension points](ARCHITECTURE.md) and [the roadmap](ROADMAP.md).

Be kind, stay curious, and help the next person find their way in. [Code of conduct](../CODE_OF_CONDUCT.md) · [MIT license](../LICENSE)

## Growing the town

Change the row and column counts in `src/lib/town-config.ts` to add plots without moving existing homes. Roads, validation, the builder, and camera framing follow automatically. See [Expanding the town](EXPANDING_THE_TOWN.md) for examples and compatibility rules.
