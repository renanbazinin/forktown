import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BRAND,
  CSS_TOKENS,
  MARK_PIXELS,
  NIGHT_FOCUS,
  TAGLINE,
  TITLE,
  WELCOME_KEY,
  contrast,
  markSvg,
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
