import { afterEach, describe, expect, it } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  unlinkSync,
  existsSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import type { Plugin, UserConfig } from 'vite';
import { SUBPROCESS_TEST } from './subprocess-timeout';
import { thirdPartyLicenses, thirdPartyNotices } from '../scripts/third-party-licenses';
import {
  CANONICAL_SITE,
  escapeHtml,
  housePage,
  housePages,
  IMAGE_ALT,
  missingPage,
  sharePreview,
  siteUrl,
} from '../scripts/share-preview';
import { CHUNK_WARNING_KB, chunkBudget } from '../scripts/chunk-budget';
import { shareTitle } from '../src/lib/brand';
import { places } from '../src/lib/places';

const script = fileURLToPath(new URL('../scripts/configure-pages.mjs', import.meta.url));
const created: string[] = [];
afterEach(() => {
  for (const directory of created.splice(0)) {
    const output = join(directory, 'github-env');
    if (existsSync(output)) unlinkSync(output);
    rmdirSync(directory);
  }
});
function configure(repository: string, override = '', site = '') {
  const directory = mkdtempSync(join(tmpdir(), 'forktown-pages-'));
  created.push(directory);
  const output = join(directory, 'github-env');
  const result = spawnSync(process.execPath, [script], {
    env: {
      ...process.env,
      GITHUB_REPOSITORY: repository,
      GITHUB_ENV: output,
      PAGES_BASE_PATH: override,
      PAGES_SITE_URL: site,
    },
    encoding: 'utf8',
  });
  return {
    status: result.status,
    output: existsSync(output) ? readFileSync(output, 'utf8') : '',
    error: result.stderr,
  };
}
describe('Static publishing configuration', SUBPROCESS_TEST, () => {
  it('uses a repository subpath for project Pages sites', () => {
    expect(configure('neighbor/forktown')).toMatchObject({
      status: 0,
      output:
        'VITE_BASE_PATH=/forktown/\nVITE_GITHUB_REPOSITORY=neighbor/forktown\nVITE_SITE_URL=https://neighbor.github.io/forktown/\n',
    });
  });
  it('uses the root for a user Pages site', () => {
    const { output } = configure('Neighbor/neighbor.github.io');
    expect(output).toContain('VITE_BASE_PATH=/\n');
    expect(output).toContain('VITE_SITE_URL=https://neighbor.github.io/\n');
  });
  it('lets a custom domain name its own address for link previews', () => {
    expect(configure('neighbor/forktown', '/', 'https://town.example/').output).toContain(
      'VITE_SITE_URL=https://town.example/\n',
    );
    expect(configure('neighbor/forktown', '/', 'http://town.example').status).toBe(1);
    expect(configure('neighbor/forktown', '/', 'https://town.example/"><x').status).toBe(1);
  });
  it('supports a custom-domain root override', () => {
    expect(configure('neighbor/forktown', '/').output).toContain('VITE_BASE_PATH=/\n');
  });
  it('rejects a malformed or multi-line base override', () => {
    expect(configure('neighbor/forktown', '/wrong\nOTHER=value/').status).toBe(1);
    expect(configure('neighbor/forktown', 'missing-slashes').status).toBe(1);
  });
  it('requires a valid owner/repository pair', () => {
    expect(configure('not-a-repository').status).toBe(1);
  });
});

describe('Private reports', () => {
  const form = 'https://github.com/renanbazinin/forktown/security/advisories/new';
  it('send security and conduct reports to the same private form', () => {
    for (const file of ['SECURITY.md', 'CODE_OF_CONDUCT.md', '.github/ISSUE_TEMPLATE/config.yml'])
      expect(readFileSync(file, 'utf8'), file).toContain(form);
    for (const file of ['SECURITY.md', 'CODE_OF_CONDUCT.md'])
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/when it is enabled|must be listed/);
  });
});

describe('Merges in the docs', () => {
  it('never claim that nothing merges automatically, now that first houses do', () => {
    const docs = readdirSync('docs').filter((name) => name.endsWith('.md'));
    const pages = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', ...docs.map((n) => `docs/${n}`)];
    for (const file of pages)
      expect(readFileSync(file, 'utf8'), file).not.toMatch(
        /(?:no|or) automatic merges|no contribution is automatically merged/i,
      );
  });
});

describe('Third-party notices in the published site', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const shipped = (path: string) => join(root, 'node_modules', path);
  const bundled = [
    shipped('react/cjs/react.production.js'),
    shipped('react-dom/cjs/react-dom-client.production.js'),
    shipped('scheduler/cjs/scheduler.production.js'),
    shipped('zod/v4/classic/schemas.js'),
    shipped('parse5/dist/index.js'),
    shipped('entities/dist/esm/decode.js'),
    shipped('lucide-react/dist/esm/icons/code-xml.mjs'),
    shipped('@fontsource/dm-sans/400.css'),
    '\0vite/preload-helper.js',
    '\0rolldown/runtime.js',
    '\0commonjsHelpers.js',
    join(root, 'src/App.tsx'),
    join(root, 'places/arts.json?raw'),
  ];

  it('copies the license of every package the bundle uses, build helpers included', () => {
    const { packages, text } = thirdPartyNotices(bundled, root);
    expect(packages.map((pkg) => pkg.name)).toEqual([
      '@fontsource/dm-sans',
      'entities',
      'lucide-react',
      'parse5',
      'react',
      'react-dom',
      'rolldown',
      'scheduler',
      'vite',
      'zod',
    ]);
    for (const pkg of packages) {
      expect(pkg.text.length, pkg.name).toBeGreaterThan(100);
      expect(text).toContain(`${pkg.name} ${pkg.version} (${pkg.license})`);
    }
    expect(text).toContain('Copyright (c) Meta Platforms');
    expect(text).toContain('ISC License');
    expect(text).toContain('Redistributions in binary form must reproduce');
    // Vite's own build tools are listed in its file but never reach the town.
    expect(text).not.toContain('Licenses of bundled dependencies');
  });

  it('adds licenses/third-party.txt to every production build', () => {
    const plugin = thirdPartyLicenses();
    const emitted: { fileName: string; source: string }[] = [];
    const generate = plugin.generateBundle as unknown as (
      this: unknown,
      options: unknown,
      bundle: Record<string, unknown>,
    ) => void;
    generate.call(
      { emitFile: (file: (typeof emitted)[number]) => emitted.push(file) },
      {},
      {
        'main.js': { type: 'chunk', moduleIds: bundled },
        'main.css': { type: 'asset' },
      },
    );
    expect(emitted.map((file) => file.fileName)).toEqual(['licenses/third-party.txt']);
    expect(emitted[0].source).toContain('react-dom');
    expect(plugin.apply).toBe('build');
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(
      /plugins: \[[^\]]*thirdPartyLicenses\(\)/,
    );
  });

  it('includes the packages only a music worker uses', () => {
    type Generate = (this: unknown, options: unknown, bundle: Record<string, unknown>) => void;
    const plugin = thirdPartyLicenses();
    const config = (plugin.config as unknown as () => UserConfig)();
    const [worker] = (config.worker!.plugins as () => Plugin[])();
    (worker.generateBundle as unknown as Generate).call(
      {},
      {},
      {
        'assets/render-worker.js': {
          type: 'chunk',
          moduleIds: [shipped('zod/v4/classic/schemas.js')],
        },
      },
    );
    const emitted: { source: string }[] = [];
    (plugin.generateBundle as unknown as Generate).call(
      { emitFile: (file: { source: string }) => emitted.push(file) },
      {},
      { 'main.js': { type: 'chunk', moduleIds: [shipped('react/cjs/react.production.js')] } },
    );
    expect(emitted[0].source).toMatch(/^zod \d/m);
    expect(emitted[0].source).toMatch(/^react \d/m);
  });

  it('stops the build when a bundled package has no license file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'forktown-licenses-'));
    try {
      mkdirSync(join(directory, 'node_modules', 'quiet'), { recursive: true });
      writeFileSync(
        join(directory, 'node_modules', 'quiet', 'package.json'),
        JSON.stringify({ name: 'quiet', version: '1.0.0' }),
      );
      expect(() =>
        thirdPartyNotices([join(directory, 'node_modules', 'quiet', 'index.js')], directory),
      ).toThrow('quiet has no license file');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

const pngSize = (file: string) => {
  const png = readFileSync(file);
  expect(png.subarray(1, 4).toString('ascii'), file).toBe('PNG');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20), bytes: png.length };
};

const meta = (html: string, key: string) =>
  html.match(new RegExp(`(?:property|name)="${key}"\\s+content="([^"]*)"`))?.[1];

describe('Link previews', () => {
  it.each([
    ['index.html', '%SITE_URL%'],
    ['live/index.html', '%SITE_URL%live/'],
  ])('%s has a large picture card with absolute addresses', (file, url) => {
    const html = readFileSync(file, 'utf8');
    for (const key of ['og:title', 'og:description', 'og:image:alt'])
      expect(meta(html, key)?.length, key).toBeGreaterThan(10);
    expect(meta(html, 'og:type')).toBe('website');
    expect(meta(html, 'og:url')).toBe(url);
    expect(meta(html, 'og:image')).toBe('%SITE_URL%og-image.png');
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
    expect(html).toContain('<link rel="apple-touch-icon" href="%BASE_URL%apple-touch-icon.png" />');
  });

  it('points at real pictures of the right size', () => {
    const image = pngSize('public/og-image.png');
    expect(image).toMatchObject({ width: 1200, height: 630 });
    expect(image.bytes).toBeLessThan(300_000);
    for (const file of ['index.html', 'live/index.html']) {
      const html = readFileSync(file, 'utf8');
      expect(meta(html, 'og:image:width')).toBe(String(image.width));
      expect(meta(html, 'og:image:height')).toBe(String(image.height));
    }
    expect(pngSize('public/apple-touch-icon.png')).toMatchObject({ width: 180, height: 180 });
  });

  it("fills in the main town, or a fork's own address", () => {
    expect(siteUrl()).toBe('https://renanbazinin.github.io/forktown/');
    expect(siteUrl('')).toBe(CANONICAL_SITE);
    expect(siteUrl('https://neighbor.github.io/forktown/')).toBe(
      'https://neighbor.github.io/forktown/',
    );
    for (const bad of ['http://town.example/', 'https://town.example', 'https://a/"><script>/'])
      expect(() => siteUrl(bad)).toThrow('VITE_SITE_URL');
    const plugin = sharePreview();
    (plugin.configResolved as unknown as (config: unknown) => void)({
      env: { VITE_SITE_URL: 'https://neighbor.github.io/forktown/' },
    });
    const html = (plugin.transformIndexHtml as unknown as (html: string) => string)(
      readFileSync('index.html', 'utf8'),
    );
    expect(html).not.toContain('%SITE_URL%');
    expect(meta(html, 'og:image')).toBe('https://neighbor.github.io/forktown/og-image.png');
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/plugins: \[[^\]]*sharePreview\(\)/);
  });
});

describe('A link preview for every house', () => {
  const canonical = (html: string) => html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  const site = 'https://neighbor.github.io/forktown/';
  async function build(env: Record<string, string>, base?: string) {
    const plugin = sharePreview();
    (plugin.configResolved as unknown as (config: unknown) => void)({
      env,
      root: process.cwd(),
      base,
    });
    const emitted: { type: string; fileName: string; source: string }[] = [];
    await (plugin.generateBundle as unknown as (this: unknown) => Promise<void>).call({
      emitFile: (file: (typeof emitted)[number]) => emitted.push(file),
    });
    return emitted;
  }

  it('builds one page per house, pointing at itself and handing off to the town', async () => {
    const pages = (await build({ VITE_SITE_URL: site })).filter(
      (page) => page.fileName !== '404.html',
    );
    expect(pages.map((page) => page.fileName).sort()).toEqual(
      places.map((place) => `house/${place.id}/index.html`).sort(),
    );
    for (const { type, fileName, source } of pages) {
      const place = places.find((place) => fileName === `house/${place.id}/index.html`)!;
      const address = `${site}${fileName.replace(/index\.html$/, '')}`;
      expect(type).toBe('asset');
      expect(source).toMatch(/^<!doctype html>\n<html lang="en">/);
      expect(source).toContain('<meta charset="UTF-8" />');
      expect(source).toContain('<meta name="viewport"');
      expect(source).toContain(`<title>${meta(source, 'og:title')}</title>`);
      // Facebook and LinkedIn re-read og:url, so it must be this page, not the town.
      expect(meta(source, 'og:url'), place.id).toBe(address);
      expect(canonical(source)).toBe(address);
      expect(meta(source, 'og:title')).toBe(escapeHtml(shareTitle(place.name, place.creator)));
      expect(meta(source, 'og:description')).toBe(escapeHtml(place.story.replace(/\s+/g, ' ')));
      expect(meta(source, 'og:image')).toBe(`${site}og-image.png`);
      expect(meta(source, 'twitter:card')).toBe('summary_large_image');
      // Relative, so base paths and forks work; a script, so unfurlers stay on this page.
      expect(source).toContain(`location.replace("../../#place=${place.id}")`);
      expect(source).toContain(`<a href="../../#place=${place.id}">`);
      expect(source).toContain('<noscript>');
    }
    // Every house gets the same page, so a made-up one shows what it leaves out; a real house's
    // name or story could say anything.
    const quiet = housePage(
      {
        id: 'quiet-corner',
        name: 'Quiet Corner',
        creator: 'someone',
        story: 'A quiet corner by the water.',
      },
      site,
    );
    expect(quiet).not.toMatch(/http-equiv|Lantern No/i);
  });

  it('uses the main town’s address when no site address is set', async () => {
    const page = (await build({})).find((page) => page.fileName.startsWith('house/'))!;
    expect(meta(page.source, 'og:url')).toBe(`${CANONICAL_SITE}${page.fileName.slice(0, -10)}`);
    expect(meta(page.source, 'og:image')).toBe(`${CANONICAL_SITE}og-image.png`);
  });

  it('escapes everything a neighbor wrote', () => {
    const html = housePage(
      {
        id: 'moon-cafe',
        name: `<b>"Moe's" & co</b>`,
        creator: 'neighbor',
        story: `</title><script>alert('hi')</script>\n"Quotes" & 'more' <img src=x onerror=alert(1)>`,
      },
      site,
    );
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).not.toMatch(/<b>|<img|<\/title><script>/);
    expect(meta(html, 'og:title')).toBe(
      '&lt;b&gt;&quot;Moe&#39;s&quot; &amp; co&lt;/b&gt; by @neighbor · Forktown',
    );
    expect(meta(html, 'og:description')).toBe(
      '&lt;/title&gt;&lt;script&gt;alert(&#39;hi&#39;)&lt;/script&gt; &quot;Quotes&quot; &amp; &#39;more&#39; &lt;img src=x onerror=alert(1)&gt;',
    );
    expect(html).toContain('Visit &lt;b&gt;&quot;Moe&#39;s&quot; &amp; co&lt;/b&gt; in Forktown');
    for (const [, value] of html.matchAll(/="([^"]*)"/g))
      expect(value).not.toMatch(/[<>']|&(?!(?:amp|lt|gt|quot|#39);)/);
  });

  it('leaves out the starter credit, and never sends an empty description', () => {
    const html = housePage(
      { id: 'old-house', name: 'Old House', creator: 'forktown', story: ' ' },
      site,
    );
    expect(meta(html, 'og:title')).toBe('Old House · Forktown');
    expect(meta(html, 'og:description')).toBe(
      'A house in Forktown. A little town, built one pull request at a time.',
    );
    expect(meta(readFileSync('index.html', 'utf8'), 'og:image:alt')).toBe(IMAGE_ALT);
    expect(meta(html, 'og:image:alt')).toBe(IMAGE_ALT);
  });

  it('sends a link to a house that has left on to the town, and nowhere else', async () => {
    const script = (html: string) => html.match(/<script>([\s\S]*)<\/script>/)![1];
    const visit = (html: string, pathname: string) => {
      let address: string | undefined;
      runInNewContext(script(html), {
        location: { pathname, replace: (url: string) => (address = url) },
      });
      return address;
    };
    const missing = (await build({}, '/forktown/')).find((page) => page.fileName === '404.html')!;
    expect(missing.source).toMatch(/^<!doctype html>\n<html lang="en">/);
    expect(missing.source).toContain('<a href="/forktown/">Visit the town</a>');
    // The town then says the house isn't in town, as it does for any old #place= link.
    expect(visit(missing.source, '/forktown/house/old-house/')).toBe('/forktown/#place=old-house');
    expect(visit(missing.source, '/forktown/house/old-house')).toBe('/forktown/#place=old-house');
    for (const path of [
      '/forktown/no-such-page/',
      '/forktown/house/old-house/extra/',
      '/forktown/house/%3Cb%3E/',
      '/house/old-house/',
      '//elsewhere.example/forktown/house/old-house/',
    ])
      expect(visit(missing.source, path), path).toBeUndefined();
    expect(visit(missingPage('/'), '/house/old-house/')).toBe('/#place=old-house');
    expect(visit(missingPage('/'), '//elsewhere.example/house/old-house/')).toBeUndefined();
  });

  it('stops the build when a house file would not load', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'forktown-houses-'));
    try {
      writeFileSync(join(directory, 'broken.json'), '{');
      await expect(housePages(pathToFileURL(join(directory, '/')), site)).rejects.toThrow(
        'broken.json',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('A quiet first install and build', () => {
  it('names every package whose install script may run, so npm has nothing to warn about', () => {
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    const withScripts = Object.entries<{ hasInstallScript?: boolean }>(lock.packages)
      .filter(([, entry]) => entry.hasInstallScript)
      .map(([path]) => path.split('node_modules/').at(-1));
    const { allowScripts } = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(withScripts.length).toBeGreaterThan(0);
    for (const name of withScripts) expect(allowScripts, name).toHaveProperty([name!], true);
  });

  it('keeps the chunk-size warning quiet for a full town, but not for any size', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/plugins: \[[^\]]*chunkBudget\(\)/);
    const plugin = chunkBudget();
    expect((plugin.config as () => unknown)()).toEqual({
      build: { chunkSizeWarningLimit: CHUNK_WARNING_KB },
    });
    // A full town's main chunk measured 1,403 kB, and 1,499 kB with the largest house on every
    // free plot; the limit is the first and 8%. See scripts/chunk-budget.ts.
    expect(CHUNK_WARNING_KB).toBeGreaterThanOrEqual(1500);
    expect(CHUNK_WARNING_KB).toBeLessThanOrEqual(1516);
  });
});

describe('The live stream’s build manifest', () => {
  const config = () => readFileSync('vite.config.ts', 'utf8');

  it('comes after the chunk budget, from a plugin of its own', () => {
    expect(config()).toMatch(/chunkBudget\(\),\s*buildManifest\(\s*BUILD,/);
  });

  it('names the same build as the page, computed once', () => {
    const source = config();
    expect(source.match(/readBuildInfo\(/g)).toHaveLength(1);
    expect(source).toMatch(/const BUILD = readBuildInfo\(process\.cwd\(\)\);/);
    expect(source).toContain('__FORKTOWN_BUILD__: JSON.stringify(BUILD)');
    expect(source).toContain('__TOWN_ARRIVAL_DATES__: JSON.stringify(arrivalDates(arrivals))');
  });

  it('never reaches the browser-only roster from the config', () => {
    for (const file of ['scripts/build-manifest.ts', 'scripts/town-arrivals.ts', 'vite.config.ts'])
      expect(readFileSync(file, 'utf8'), file).not.toMatch(
        /from ['"][^'"]*\/(?:places|arrivals|live-breaks)(?:\.ts)?['"]/,
      );
  });
});
