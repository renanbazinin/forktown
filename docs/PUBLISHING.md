# Publish your Forktown

The working project is local until you create a remote repository and deploy it. Do not put tokens in source files or in `VITE_*` variables; those variables are public build-time configuration.

## Connect the repository

1. Create an empty GitHub repository named `forktown` (or a name you prefer).
2. Push this project to its `main` branch.
3. Add a short repository description and a website link after deployment.

For local GitHub links, copy `.env.example` to `.env` and set:

```dotenv
VITE_GITHUB_REPOSITORY=YOUR-USERNAME/forktown
VITE_BASE_PATH=/
```

Restart the development server after changing environment variables. Source, fork, and place-file links will then point to your repository. Contributor profiles always point to the username in their place file.

## GitHub Pages

The included deployment workflow is deliberately opt-in. Pull request checks run regardless of whether publishing is enabled.

1. In repository **Settings → Pages**, choose **GitHub Actions** as the source.
2. In **Settings → Secrets and variables → Actions → Variables**, create a repository variable named `ENABLE_PAGES` with value `true`.
3. Open **Actions → Publish town → Run workflow** on `main`.
4. GitHub publishes the built `dist/` artifact. The workflow reports the site URL.

Future pushes to `main` run the publishing workflow. It derives the repository path and GitHub link settings automatically. For a repository named `USERNAME.github.io`, it uses `/`; ordinary project repositories use `/REPOSITORY/`.

For a custom domain, create an Actions variable named `PAGES_BASE_PATH` with value `/`, and follow GitHub’s custom-domain setup. The workflow respects this override. Confirm DNS and the Pages settings before expecting the domain to work. Also create `PAGES_SITE_URL` with the domain’s full address, such as `https://town.example/`, so link previews point straight at it.

## Link previews

Shared links show a card with a picture of the town. Link previews need absolute addresses, so the page heads use `VITE_SITE_URL`. The Pages workflow sets it to your site’s address (`PAGES_SITE_URL`, or `https://OWNER.github.io/REPOSITORY/`); other builds fall back to the main town, https://renanbazinin.github.io/forktown/. On another host, set `VITE_SITE_URL` to the address ending in `/`.

Every house also gets a page of its own, `house/<id>/`, written at build by `scripts/share-preview.ts` from the same validated place files as the town. Its card reads “Name by @neighbor · Forktown” (founding houses leave out the byline) and quotes the house’s story, escaped, over the same town picture. Its `og:url` and canonical link are the page itself, so previews don’t fall back to the town’s card. A short script, not a meta refresh, then sends visitors on to `../../#place=<id>`, a relative address that works on any base path, with a plain link for anyone without JavaScript. In a published town, **Share** on a house panel hands on that page, and venues share their `#venue=` link. A new house’s page arrives with the deploy that brings the house. It never shows a lantern number, since that needs the full Git history. The build also writes `404.html`, which GitHub Pages shows for any address the site doesn’t have. A link to a house that has since left, or changed its file id, goes on to the town, which says the house isn’t in town; any other address gets a link to the town.

The picture is `public/og-image.png`, 1200 × 630 and under 300 kB: the real town at Autumn 11, 19:25 in Year 3 (2026-09-24 20:19:25 UTC), captured from a production build in headless Chrome with the clock pinned, zoomed in three steps, the interface hidden, and colors trimmed to six bits to keep it small. The home-screen icon, `public/apple-touch-icon.png`, is drawn from the mark by `npx tsx scripts/touch-icon.ts`.

## Other static hosts

```sh
npm ci
npm run build
```

Publish the `dist` folder. Set `VITE_BASE_PATH=/` for a root-domain site, or `/your-subpath/` for a subpath deployment. Set `VITE_GITHUB_REPOSITORY` and `VITE_SITE_URL` in the host’s build environment. Use `npm run preview` to inspect the result at `http://localhost:4173` before publishing.

## Before inviting contributors

Ticked items are done for renanbazinin/forktown. In your own fork, work through all of them.

- [x] Protect `main` as [Contribution policy and merge protection](CONTRIBUTION_POLICY.md) describes: require the `check` and `Contribution policy` statuses and up-to-date branches, keep the general review count at zero (the policy asks for review where it matters), and leave merge queues off. Don’t require `Auto-merge`: it only says whether a PR merges itself. Done September 21, 2026.
- [ ] Turn on private vulnerability reporting in **Settings → Code security**. [SECURITY.md](../SECURITY.md), [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) and `.github/ISSUE_TEMPLATE/config.yml` send private security and conduct reports to that form; in your own fork, point those links at your repository.
- [x] Test one contribution from a fork, check its build artifact, and confirm that merging updates the public town. Done with PR #41 on September 24, 2026; see the [external contributor trial](EXTERNAL_CONTRIBUTOR_TRIAL.md).
- [ ] Add five to eight repository topics, leaving out `hacktoberfest` (see [Hacktoberfest](CONTRIBUTION_POLICY.md#hacktoberfest)), and upload `public/og-image.png` in **Settings → Social preview**, so links to the repository show the town too.
- [ ] Open some `good first issue` and `help wanted` issues for documentation, accessibility, translations, and bigger pieces of the town, with file pointers and a clear finish line. The README and CONTRIBUTING already link to both lists.

Starter JSON files credit the project as `forktown`. Real contributions should credit the actual pull request author. Keep the starter designation clear and review changes to existing places.
