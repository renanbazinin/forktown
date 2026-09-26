# Third-party notices

Forktown’s code and original procedural city artwork are distributed under the project’s MIT license. Its locally bundled fonts retain their original SIL Open Font License 1.1 terms:

- DM Sans — [font license](public/licenses/dm-sans.txt)
- Fraunces — [font license](public/licenses/fraunces.txt)
- Space Mono — [font license](public/licenses/space-mono.txt)

These license files are also included in the published site under `licenses/`. Font packages are supplied by Fontsource.

The published site also bundles open-source JavaScript, such as React, React DOM and scheduler (MIT), zod (MIT), parse5 (MIT), entities (BSD-2-Clause), lucide-react (ISC), and small helpers from Vite and Rolldown (MIT). Minifying removes their license comments, so every production build writes their full notices to `licenses/third-party.txt`: [read it on the live site](https://renanbazinin.github.io/forktown/licenses/third-party.txt). [`scripts/third-party-licenses.ts`](scripts/third-party-licenses.ts) copies the license file of each package that ends up in the town or its music workers, and the build stops if one has none.
