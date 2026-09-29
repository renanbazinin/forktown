# Welcome, neighbor

New here? Start with the [visual quick start](README.md): live site → localhost → build → save → pull request, with screenshots and copyable commands. Rather not install anything? [Start in your browser](#start-in-your-browser) instead.

You don’t need to be an expert to contribute to Forktown. A thoughtful first contribution is a small place with your own name, style, and story.

Want to learn from another house? Choose **Browse house files** in the builder, or select a house in town and click **View JSON**. In the **Find your way in** dialog, **House files** opens every house's JSON too. You can read and copy its actual JSON from `places/`, then return to your draft. After saving locally, **See my saved JSON** opens your new file. Local saves, private previews, and downloads do not publish anything to the shared town; a merged pull request is how your house gets there.

## Start in your browser

The published town saves nothing itself, but it can hand GitHub a whole house for an open plot. You need a GitHub account and nothing else.

1. In the [live town](https://renanbazinin.github.io/forktown/), select an open plot on the map, or choose **Find your way in → Pick an open plot**.
2. Type your GitHub username and choose **Create my house file on GitHub**. GitHub opens a new file in `places/`, named after the house's id, with every field filled in.
3. If GitHub asks you to fork the repository first, accept.
4. Replace the placeholder `story` with your own, so the Lantern Fork can tell it as Tonight's tale; it never tells the one filled in. Change the name and colors too, if you like; [every field](#or-write-one-file-yourself) is explained below. Keep the file name and `id` the same, and keep your own username in `creator`.
5. Choose **Commit changes**, then **Propose changes**, then **Create pull request**.

If GitHub opens an empty file, it dropped the text while it made your fork. Back in the town, choose **Copy JSON**, then **Start a blank file**, name it as the panel shows, and paste.

Want to design every detail first? Under the green button, **Or design every detail in the builder** opens the full builder right on the live town: Home, Neighbor and Outdoor sign tabs, and a preview of your house in town. Its last step, **Create my house file on GitHub**, opens the same filled-in file. A house with very long sign artwork is too long for that link; the builder then asks you to copy the JSON into a blank file instead.

## Build in your own copy

The full builder, with a preview of your house in town before you send it, runs in your own local fork. Explore houses and their JSON on the published town, then build on your computer.

1. On GitHub, fork the repository and clone your fork to your computer. Create a contribution branch.
2. Follow [Develop locally](#develop-locally) below to install dependencies and start your local town.
3. Choose **Find your way in → Build a place**, add your GitHub username, and use the Home, Neighbor, and Outdoor sign tabs to design it.
4. Choose **Continue to save → Save to my project**. This creates `places/<your-id>.json` in your local fork.
5. Click **See my saved JSON** to inspect the file. Commit it and push your contribution branch.
6. Open a pull request from your fork to the original repository, complete the checklist, and submit it.

Our checks will validate the file. If it’s your first house and the PR changes nothing else, it merges automatically once every check passes; otherwise a maintainer reviews the story, credit, and change before merging. If the **Auto-merge** check or a comment says your branch is behind `main`, click **Update branch** on your pull request. Once the updated site is deployed, your place appears in the neighborhood.

If you receive feedback, edit the file in the same branch of your fork. Your existing pull request updates automatically. You don’t need another pull request.

## Or write one file yourself

Copy `examples/my-little-place.json` to `places/your-unique-id.json`. Do not change the example itself. Then make the copy yours: choose your own `id` and rename the file to match it, put your GitHub username in `creator`, and pick an open `plot`. Here is the contract:

```json
{
  "id": "your-unique-id",
  "name": "Sam’s Moon Café",
  "creator": "your-github-username",
  "plot": "T3",
  "building": "cafe",
  "color": "#C97878",
  "decoration": "flowers",
  "story": "Coffee for anyone fixing one last bug. There is always a seat by the window."
}
```

`T3` is an example. Check that your chosen plot is still open before submitting.

| Field        | What to put here                                                                                                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | A unique 3–40 character id: lowercase letters, numbers, and single hyphens. The file must have this same name followed by `.json`. Windows device names (`con`, `prn`, `aux`, `nul`, `com1`–`com9`, `lpt1`–`lpt9`) are reserved; add a word, such as `aux-cafe`. |
| `name`       | A place name, 3–32 characters. International characters are welcome.                                                                                                                                                                                             |
| `creator`    | Your real GitHub username, without `@`. The starter-only credit `forktown` is reserved.                                                                                                                                                                          |
| `plot`       | An unoccupied plot shown in the town map (currently rows A-T, columns 1-10).                                                                                                                                                                                     |
| `building`   | `cottage`, `cafe`, `bookshop`, `greenhouse`, `studio`, or `observatory`.                                                                                                                                                                                         |
| `color`      | A six-digit hex color, such as `#789B76`.                                                                                                                                                                                                                        |
| `decoration` | `flowers`, `tree`, `bench`, or `mailbox`.                                                                                                                                                                                                                        |
| `story`      | A personal description of 10–180 characters. Your story may be told as Tonight's tale at the Lantern Fork.                                                                                                                                                       |

Add only your own place file. There is no shared list to edit. Plot positions remain fixed as the town grows.

Each pull request may add **at most one new house**, with **one neighbor** in that house's JSON file. Submit additional houses in separate PRs. The **Contribution policy** check counts new `places/*.json` filenames across the whole PR; deleting an old house does not give you another slot, and a rename counts as a new filename. Code/documentation PRs and updates to existing houses may add zero houses. This is a per-PR limit, not a lifetime limit per GitHub account.

## Make it more personal

The eight basic fields above still work: omitted `design`, `resident`, and `sign` objects get friendly defaults. Use the builder or `examples/living-place.json` when you want to customize them. If you include an object, include its required fields; `resident.figure` and `resident.routine.night` can be omitted.

- **Home:** `design` sets wall and trim hex colors, 1 or 2 floors (homes already built with three keep them), a `classic` / `flat` / `gable` roof, `cross` / `round` / `shutters` windows, `wildflowers` / `paving` / `vegetables` garden, and an optional `porch` or `balcony` feature (`none` is also valid). The top-level `color` sets the roof color. `classic` uses the building family's original roof.
- **Neighbor:** `resident` sets a name (2-24 characters), a `male` / `female` figure, skin/hair/outfit hex colors, `none` / `hat` / `glasses` accessory, and a greeting (1-40 characters). Choose **Figure** in the Neighbor tab, or add `"figure": "female"` inside your JSON's `resident` object. Omitted `figure` uses the original male artwork, so existing houses and saved drafts keep their appearance. Both figures support every accessory and daily activity. Update older forks before adding this field: older validators reject it.
- **Routine:** morning (06:00-12:00), afternoon (12:00-18:00), and evening (18:00-22:00) each choose `stroll`, `work`, or `home`. The last two mean working and relaxing at home. Night (22:00-06:00) chooses `sleep` (the default) or `stroll` (Be a night owl). Up to eight night owls can join the Little Stage's 23:30–02:30 party, including cinema guests who have time to walk over afterward. Arrivals and departures vary. Free time includes moonlit loops round the block and spells on their own bench, porch or front step, with a consistent individual bedtime between midnight and 05:00. No meetings, destinations, or other residents' names to configure.
- **Outdoor sign:** choose `none`, `text`, or `html`. Text signs have up to 18 characters plus `color` and `background`. HTML artwork uses the small language described in [sign artwork](docs/SIGN_ARTWORK.md).

One place brings one resident. A resident can be fictional; the creator credit should be your GitHub username. To change your own home or daily routine later, edit your existing JSON file and submit another PR.

The Little Stage (B5), the Lunch Green (C5) and the Lantern Fork (D3) are public venues, reserved for everyone. Choose another plot for your house. Neighbors who choose `stroll` in the afternoon or evening may walk to a town event, enjoy it, and walk home. There is no extra scheduling to configure, and work/home routines stay indoors. Lunch events run 13:00–16:00; evening shows run 19:00–21:00, in town time. Everyone sees the same daily lineup when their device clocks agree.

The Meadow Ground also reserves F3–F5 and G3–G5 for daytime five-a-side football. The Starlight Cinema, Willow Grove Zoo, Moon Harvest Farm, the Millpond, and the Treeline's two tube stations (C1 and N1) reserve plots too; [Expanding the town](docs/EXPANDING_THE_TOWN.md) lists every reserved plot. The town has 200 plots, with 141 available for houses before existing homes are counted. Morning and afternoon strollers can stop to watch a match and walk home, and in deep winter some afternoon strollers skate on the frozen Millpond; no extra fields are needed in your JSON. See [Football at the Meadow Ground](docs/FOOTBALL.md), [The Millpond](docs/MILLPOND.md) and [The Treeline](docs/TUBES.md).

The town follows a shared UTC-based day: one real minute equals one town hour. The cycle repeats every 24 minutes, starting at UTC midnight. Visitors can pause their view; returning to live catches up to the current town time. Following a neighbor keeps the camera with them; dragging the map or pressing Stop following returns to exploring.

## If two people choose the same plot

Choosing a plot in the builder does **not** reserve it. The first accepted contribution gets the plot. If it is occupied before yours is merged, choose another open plot and update only your file’s `plot` field. The automatic check will explain the conflict.

## Develop locally

Fork and clone the project, then create your contribution branch before designing your place.

```sh
git clone YOUR_FORK_URL
cd YOUR_FORK_DIRECTORY
npm ci
npm run dev
```

Add your file to `places/`, and the city reloads automatically.

You can also let the builder create the file: choose **Find your way in → Build a place → Continue to save → Save to my project**. It writes `places/<your-file-id>.json` into the checkout running `npm run dev`, and the local city updates. Existing files are never overwritten; choose a new id or edit an existing file yourself. Review the new file, commit it, push your branch, and open your PR. Saving does not make commits, switch branches, push, or create a PR.

**Save to my project** is available only in the local development city. A hosted site or `npm run preview` offers exploration, read-only house files, and instructions for contributing from your own copy. When it knows its GitHub repository, an open plot there also starts a house file on GitHub, and a quiet link under that button opens the builder, which hands the finished house to GitHub instead of saving it.

Before sending a pull request, check your house:

```sh
npm run validate
```

It takes a couple of seconds and points to the exact file and field that needs attention. On GitHub, the pull request check runs it first and notes each problem on the file. If you changed code too, run `npm run check`: it runs the tests, the validator, type checks, and the production build.

The pull request check also runs `npm run format:check` on code and docs. If it lists a file you changed, run `npm run format` to tidy the spacing, then commit the change. House files in `places/` are left to the validator, so spacing there never fails a pull request.

After committing, run `npm run check:pr -- origin/main HEAD` to check the house allowance locally (fetch the target branch first). On GitHub, **Contribution policy** uses trusted default-branch policy and API data without executing code from the PR. It checks credit and ownership too; see [Contribution policy and merge protection](docs/CONTRIBUTION_POLICY.md).

## A few things that help everyone

- Give credit honestly. GitHub checks new-house creator credit against the PR author. Collaborative credit, renamed accounts, and changes to another person's house need a different maintainer's approval of the current commit.
- Start with one place. You can propose another thoughtful addition or improve the shared world later.
- Keep names and stories welcoming. Avoid advertising, harassment, and personal information about other people.
- Don’t overwrite someone else’s place. For a collaborative change, explain it and get the creator involved.
- Use your own work, or work you have permission to contribute under the project’s MIT license.
- Ask for help in an issue if you get stuck. Being new is welcome here.

## Other ways to help

Looking for something to pick up? Issues labeled [good first issue](https://github.com/renanbazinin/forktown/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22) are small, with file pointers and a clear finish line. [Help wanted](https://github.com/renanbazinin/forktown/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22) issues are bigger pieces of the town, or need a particular skill. Say hello on the issue before you start, so two people don’t build the same thing.

You can also improve the guide, report a reproducible bug, test the site with a screen reader, add translations, draw a new building style in the renderer, or help plan the next neighborhood. For a new mechanism or a large change, open an issue first so we can agree on the shape of it.

Here for Hacktoberfest? See [what it means in Forktown](docs/CONTRIBUTION_POLICY.md#hacktoberfest).

Implementation notes live in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Please keep meaningful tests for contribution rules, geometry, and other behavior that newcomers depend on.

`npm run check:full-town` runs the validator and every test in a temporary copy with a made-up house on every free plot, so you can check that a change still holds when the town is full; it never touches `places/`. Tests read the town with `readPlaces()` from `tests/full-town.ts`, which hands out the made-up houses first, so a test that leans on "the first house" in `places/` will most likely fail there; a test that needs a particular home takes it from `tests/fixtures.ts`. Add `-- tests/some.test.ts` to run only some tests, or `-- --keep` to keep the copy.
