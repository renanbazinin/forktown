import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { touchIconScanlines } from '../scripts/touch-icon';
import { describe, expect, it } from 'vitest';
import {
  ARRIVAL_COPY,
  BRAND,
  CSS_TOKENS,
  MARK_PIXELS,
  NIGHT_FOCUS,
  TAGLINE,
  TITLE,
  WELCOME_KEY,
  contrast,
  markSvg,
  shareTitle,
  shouldIntroduce,
  shouldWelcome,
  type BrandColor,
} from '../src/lib/brand';

const styles = readFileSync('src/styles.css', 'utf8');
const root = styles.match(/@layer base \{\s*:root \{([^}]*)\}/)![1];
const declared = new Map(
  [...root.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
);
const cssFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? cssFiles(join(dir, entry.name))
      : entry.name.endsWith('.css')
        ? [join(dir, entry.name)]
        : [],
  );
const storage = (items: Record<string, string> = {}) => ({
  getItem: (key: string) => items[key] ?? null,
});

describe('The Lantern Fork mark', () => {
  it('is the favicon, byte for byte', () => {
    expect(readFileSync('public/favicon.svg', 'utf8').trim()).toBe(markSvg({ tile: true }));
  });

  it('is the home-screen icon, pixel for pixel', () => {
    const png = readFileSync('public/apple-touch-icon.png');
    const data: Buffer[] = [];
    for (let at = 8; at < png.length;) {
      const length = png.readUInt32BE(at);
      const type = png.subarray(at + 4, at + 8).toString('ascii');
      if (type === 'IHDR') expect([...png.subarray(at + 16, at + 18)]).toEqual([8, 2]);
      if (type === 'IDAT') data.push(png.subarray(at + 8, at + 8 + length));
      at += 12 + length;
    }
    expect(inflateSync(Buffer.concat(data)).equals(touchIconScanlines())).toBe(true);
  });

  it('draws 19 whole-pixel rects inside a 32x32 grid', () => {
    expect(MARK_PIXELS).toHaveLength(19);
    for (const [x, y, w, h] of MARK_PIXELS) {
      expect([x, y, w, h].every(Number.isInteger)).toBe(true);
      expect(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 32 && y + h <= 32).toBe(true);
    }
  });
});

describe('Brand tokens', () => {
  it('match the CSS custom properties one for one', () => {
    for (const key of Object.keys(BRAND) as BrandColor[])
      expect(declared.get(CSS_TOKENS[key])?.toLowerCase(), key).toBe(BRAND[key].toLowerCase());
    expect(CSS_TOKENS.lanternInk).toBe('--lantern-ink');
  });

  it('declares every custom property the stylesheets use', () => {
    const files = cssFiles('src');
    expect(files.length).toBeGreaterThan(3);
    for (const file of files)
      for (const [, name] of readFileSync(file, 'utf8').matchAll(/var\((--[\w-]+)/g)) {
        expect(declared.has(name), `${name} in ${file}`).toBe(true);
      }
  });

  it('keeps every text pair readable, day and dusk', () => {
    const pairs: [BrandColor, BrandColor][] = [
      ['ink', 'surface'],
      ['muted', 'surface'],
      ['lanternInk', 'surface'],
      ['lanternInk', 'paper'],
      ['duskInk', 'dusk'],
      ['duskInk', 'duskSurface'],
      ['duskMuted', 'duskSurface'],
      ['duskLink', 'duskSurface'],
      ['glow', 'duskSurface'],
    ];
    for (const [text, background] of pairs)
      expect(contrast(BRAND[text], BRAND[background]), `${text} on ${background}`).toBeGreaterThan(
        4.5,
      );
    expect(contrast(NIGHT_FOCUS, BRAND.duskSurface)).toBeGreaterThan(3);
    // The lantern is a fill, never text on cream.
    expect(contrast(BRAND.lantern, BRAND.surface)).toBeLessThan(3);
  });
});

describe('One tagline', () => {
  it('names the town the same way everywhere', () => {
    const index = readFileSync('index.html', 'utf8');
    expect(index.match(/<title>(.*)<\/title>/)![1]).toBe(TITLE);
    expect(index.match(/property="og:title"\s+content="([^"]*)"/)![1]).toBe(TITLE);
    expect(index.match(/name="description"\s+content="([^"]*)"/)![1].startsWith(TAGLINE)).toBe(
      true,
    );
    expect(readFileSync('README.md', 'utf8')).toContain(TAGLINE);
    expect(
      readFileSync('live/index.html', 'utf8').match(/name="description"\s+content="([^"]*)"/)![1],
    ).toContain('built one pull request at a time');
  });
});

describe('The first-visit welcome', () => {
  it('greets new visitors once and lets deep links win', () => {
    expect(shouldWelcome('', storage())).toBe(true);
    expect(shouldWelcome('#place=arts', storage())).toBe(false);
    expect(shouldWelcome('#venue=fork', storage())).toBe(false);
    expect(shouldWelcome('#venue=tube', storage())).toBe(false);
    expect(shouldWelcome('', storage({ [WELCOME_KEY]: '1' }))).toBe(false);
    expect(shouldWelcome('#other=1&place=arts', storage())).toBe(false);
  });

  it('still greets when storage is missing or broken', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(shouldWelcome('', broken)).toBe(true);
    expect(shouldWelcome('', null)).toBe(true);
  });
});

describe('A newcomer who follows a shared house link', () => {
  const broken = {
    getItem: () => {
      throw new Error('blocked');
    },
  };

  it('is introduced in the house panel once, instead of the welcome card', () => {
    expect(shouldIntroduce('#place=arts', storage())).toBe(true);
    expect(shouldIntroduce('#other=1&place=arts', storage())).toBe(true);
    expect(shouldIntroduce('#place=arts', storage({ [WELCOME_KEY]: '1' }))).toBe(false);
    // Venues and plain visits have the welcome card's own rules.
    expect(shouldIntroduce('#venue=stage', storage())).toBe(false);
    expect(shouldIntroduce('', storage())).toBe(false);
    // Blocked storage introduces the town once per page load, like the welcome.
    expect(shouldIntroduce('#place=arts', broken)).toBe(true);
    expect(shouldIntroduce('#place=arts', null)).toBe(true);
  });

  it('credits the neighbor, or says a founding house was here first', () => {
    expect(ARRIVAL_COPY.body('someone')).toBe(
      'Forktown is built by first-time contributors. @someone added this house with one JSON file.',
    );
    expect(ARRIVAL_COPY.body(null)).not.toContain('@');
    expect(ARRIVAL_COPY.body(null)).toContain('founding house');
    for (const line of [ARRIVAL_COPY.body('someone'), ARRIVAL_COPY.body(null), ARRIVAL_COPY.action])
      expect(line).not.toMatch(/!|\b(?:repo|commit|branch|SHA)\b/);
  });

  it('shows the line where the house opens, and stores the welcome flag once it does', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('shouldIntroduce(window.location.hash, welcomeStorage())');
    expect(app).toContain('if (arrival) rememberWelcome();');
    expect(app).toMatch(/arrival === selected\.id && \(\s*<p className="arrival-intro">/);
    expect(app).toMatch(/onClick=\{\(\) => setModal\('guide'\)\}>\s*\{ARRIVAL_COPY\.action\}/);
  });
});

describe('Share titles', () => {
  it('name the neighbor, but never the founding houses’ starter credit', () => {
    expect(shareTitle('Moss Nook', 'someone')).toBe('Moss Nook by @someone · Forktown');
    expect(shareTitle('Moonbeam Café', 'forktown')).toBe('Moonbeam Café · Forktown');
    expect(shareTitle('The Little Stage')).toBe('The Little Stage · Forktown');
  });
});
