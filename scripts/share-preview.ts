import type { Plugin } from 'vite';

export const CANONICAL_SITE = 'https://renanbazinin.github.io/forktown/';
const SITE = /^https:\/\/[\w.-]+(?::\d+)?\/(?:[\w.~-]+\/)*$/;

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

/** Fills %SITE_URL% in the page heads, for og:url and og:image. */
export function sharePreview(): Plugin {
  let url = CANONICAL_SITE;
  return {
    name: 'forktown-share-preview',
    configResolved(config) {
      url = siteUrl(config.env.VITE_SITE_URL);
    },
    transformIndexHtml(html) {
      return html.replaceAll('%SITE_URL%', url);
    },
  };
}
