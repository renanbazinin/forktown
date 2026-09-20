# Forktown 🌱

**A living pixel town, built one pull request at a time.**

Make your first open-source contribution a place of your own. Design a home, give its resident a simple daily rhythm, and add your own outdoor sign with one JSON file. After review and merging, the shared city rebuilds with your place, your name, and a link to share.

Forktown begins with eight clearly labeled starter places on a 25-plot map. Those starter places use `creator: "forktown"` as a project credit; they are not real community contributions or a GitHub account endorsement.

## Take a look locally

Use Node.js 24 LTS (Node 22.12+ is supported).

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. No accounts, API keys, database, or remote services are required.

## Make your first contribution

1. Open the city and choose **Build a place**.
2. Make a home with the Home, Neighbor, and Outdoor sign tabs. Choose an empty plot; the builder suggests an available file id.
3. In your local checkout, choose **Continue to save → Save to my project**. The builder creates your JSON in `places/` and updates the local city. On a hosted site, download the JSON instead.
4. Commit the new file on a branch in your fork. If you downloaded it, first add it to `places/`.
5. Open a pull request against the original repository.

Read the [step-by-step contribution guide](CONTRIBUTING.md). You can do the whole contribution through GitHub’s browser interface. A builder preview is private to your current visit; it becomes part of the public city only after a pull request is reviewed, merged, and deployed. The builder saves draft details on your device, including unfinished text, for your next visit.

## What works

- An original isometric city renderer, with trees, roads, a river, little residents, and six building styles.
- Mouse and touch panning, zoom buttons, scroll zoom, and keyboard map controls.
- Custom floors, roof shapes, wall and trim colors, window styles, gardens, porches, and balconies.
- Residents with names, outfits, accessories, greetings, and three simple daily choices.
- Road-following strolls, occasional neighbor greetings, bedtime, and a camera that follows a resident.
- A local town clock with pause, time scrubbing, speed controls, day/night lighting, and reduced-motion support.
- Exterior signs: simple text or a restricted HTML/CSS artwork language, drawn as noninteractive canvas textures.
- Searchable place directory and open-plot directory, including a keyboard-accessible alternative to the map.
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
src/components/City.tsx    Map interaction and accessible controls
src/components/Contribute.tsx  Building editor and JSON export
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

See [publishing](docs/PUBLISHING.md). Creating this local project does not create a GitHub repository or publish anything.

## A foundation for more

The living edition keeps the first contribution small. Morning, afternoon, and evening each use one choice: stroll, work at home, or relax at home. Nights are for sleeping. Every visitor has their own controllable clock; this is a small local simulation. There are no accounts, leaderboards, real-time multiplayer, or automatic merges. Every place has a bounded plot and reviewed data. New districts, original sprites, more building types, and richer interactions can follow the community’s needs.

See [architecture and extension points](docs/ARCHITECTURE.md) and [the roadmap](docs/ROADMAP.md).

Be kind, stay curious, and help the next person find their way in. [Code of conduct](CODE_OF_CONDUCT.md) · [MIT license](LICENSE)
