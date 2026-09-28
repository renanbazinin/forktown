import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';
import { BRAND, shareTitle, TAGLINE } from '../src/lib/brand.ts';
import { validatePlaces, type Place } from '../src/lib/schema.ts';
import { readPlaceFiles } from './place-files.ts';

export const CANONICAL_SITE = 'https://renanbazinin.github.io/forktown/';
const SITE = /^https:\/\/[\w.-]+(?::\d+)?\/(?:[\w.~-]+\/)*$/;
// The town picture's description, kept in step with index.html by tests/publishing.test.ts.
export const IMAGE_ALT =
  'Forktown on an autumn evening: houses around the Lantern Fork, a football match at the Meadow Ground and a concert at the Little Stage.';

/**
 * The published town's address. Link previews need absolute URLs, so the page head reads it
 * from VITE_SITE_URL (set by scripts/configure-pages.mjs for each fork) or uses the main town.
 */
export function siteUrl(value?: string) {
  const url = value || CANONICAL_SITE;
  if (!SITE.test(url))
    throw new Error(
      'VITE_SITE_URL must be an https address ending in /, such as https://you.github.io/forktown/.',
    );
  return url;
}

// Names and stories are written by contributors, so every value is escaped on its way in.
const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ENTITIES[char]);

// The hand-off pages wear the town's paper and ink.
const STYLE = `<style>
      body {
        margin: 0;
        display: grid;
        place-items: center;
        min-height: 100vh;
        padding: 0 16px;
        background: ${BRAND.paper};
        color: ${BRAND.ink};
        font: 16px/1.6 system-ui, sans-serif;
        text-align: center;
      }
      a {
        color: ${BRAND.greenDeep};
        font-weight: 600;
      }
    </style>`;

/**
 * A house's own page, `house/<id>/`. Link previews read its tags, and people go straight on to the
 * house in town. The hand-off is a script rather than a meta refresh, so unfurlers stay on this
 * page, and its address is relative, so base paths and forks keep working. There is no lantern
 * number: it needs the full Git history, which a shallow build doesn't have.
 */
export function housePage(place: Pick<Place, 'id' | 'name' | 'creator' | 'story'>, site: string) {
  const title = escapeHtml(shareTitle(place.name, place.creator));
  const name = escapeHtml(place.name);
  const story = place.story.replace(/\s+/g, ' ').trim();
  const description = escapeHtml(story || `A house in Forktown. ${TAGLINE}`);
  const url = escapeHtml(`${site}house/${encodeURIComponent(place.id)}/`);
  const town = `../../#place=${encodeURIComponent(place.id)}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="${BRAND.paper}" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" type="image/svg+xml" href="../../favicon.svg" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Forktown" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${escapeHtml(site)}og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(IMAGE_ALT)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    ${STYLE}
  </head>
  <body>
    <main>
      <p><a href="${escapeHtml(town)}">Visit ${name} in Forktown</a></p>
      <noscript>
        <p>
          Forktown draws the town with JavaScript. Turn it on, then
          <a href="${escapeHtml(town)}">visit ${name}</a>.
        </p>
      </noscript>
    </main>
    <script>
      location.replace(${JSON.stringify(town)});
    </script>
  </body>
</html>
`;
}

/**
 * GitHub Pages answers any address the site doesn't have with 404.html. A house page whose house
 * has since left, or changed its file id, goes on to the town, which says the house isn't in town;
 * any other address gets a link to the town. Only paths under the town's own base count, so the
 * page never sends anyone to another site.
 */
export function missingPage(base: string) {
  const home = escapeHtml(base);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="${BRAND.paper}" />
    <title>Page not found · Forktown</title>
    <link rel="icon" type="image/svg+xml" href="${home}favicon.svg" />
    ${STYLE}
  </head>
  <body>
    <main>
      <p>That page isn’t in Forktown. <a href="${home}">Visit the town</a></p>
    </main>
    <script>
      const home = ${JSON.stringify(base).replace(/</g, '\\u003c')};
      const path = location.pathname;
      const house = path.startsWith(home) && path.slice(home.length).match(/^house\\/([\\w-]+)\\/?$/);
      if (house) location.replace(home + '#place=' + house[1]);
    </script>
  </body>
</html>
`;
}

/** A page for every place the town builds, checked the same way the town checks them. */
export async function housePages(directory: URL, site: string) {
  const { entries, errors: fileErrors } = await readPlaceFiles(directory);
  const { places, errors } = validatePlaces(entries);
  if (fileErrors.length || errors.length)
    throw new Error(
      `The house pages could not be built:\n${[...fileErrors, ...errors].join('\n')}`,
    );
  return places.map((place) => ({
    fileName: `house/${place.id}/index.html`,
    source: housePage(place, site),
  }));
}

/**
 * Fills %SITE_URL% in the page heads, for og:url and og:image, and gives every house a page of
 * its own at build: a #place= link never reaches a crawler, so without one every house unfurls
 * as the same card. A 404 page catches links to houses that have since left.
 */
export function sharePreview(): Plugin {
  let url = CANONICAL_SITE;
  let root = process.cwd();
  let base = '/';
  return {
    name: 'forktown-share-preview',
    configResolved(config) {
      url = siteUrl(config.env.VITE_SITE_URL);
      root = config.root ?? root;
      base = config.base || base;
    },
    transformIndexHtml(html) {
      return html.replaceAll('%SITE_URL%', url);
    },
    async generateBundle() {
      for (const page of await housePages(pathToFileURL(join(root, 'places', '/')), url))
        this.emitFile({ type: 'asset', ...page });
      this.emitFile({ type: 'asset', fileName: '404.html', source: missingPage(base) });
    },
  };
}
