import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Bundles by import graph. A static import that carries a value pulls its whole module (and any
// module-level work in it) into the bundle, so these checks follow them from each entry point.
// Type-only imports are erased at build time and don't count.

const CLAUSE =
  /(?:^|[\n;])\s*(import|export)\s+(type\s+)?((?:[\w$]+\s*,\s*)?(?:\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?|[\w$]+))\s+from\s+['"]([^'"]+)['"]/g;
const BARE = /(?:^|[\n;])\s*import\s+['"]([^'"]+)['"]/g;

/** The modules this file imports for their values (relative ones only), as repo paths. */
function valueImports(file: string): string[] {
  const source = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const found: string[] = [];
  for (const [, , typeOnly, clause, from] of source.matchAll(CLAUSE)) {
    if (typeOnly) continue;
    const named = /\{([^}]*)\}/.exec(clause)?.[1];
    const onlyTypes =
      named !== undefined &&
      !/^\s*[\w$]+\s*,/.test(clause) &&
      named
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .every((part) => part.startsWith('type '));
    if (!onlyTypes) found.push(from);
  }
  for (const [, from] of source.matchAll(BARE)) found.push(from);
  return found.flatMap((from) => {
    if (!from.startsWith('.')) return [];
    const base = join(dirname(file), from);
    const target = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find(
      (path) => existsSync(path) && statSync(path).isFile(),
    );
    if (!target) throw new Error(`${file} imports ${from}, which does not resolve`);
    return [relative('.', target).replaceAll('\\', '/')];
  });
}

/** Every module reachable from `entry` through value imports. */
function bundle(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...valueImports(file));
  }
  return seen;
}

describe('The cinema audio worker', () => {
  const worker = bundle('src/music/cinema-worker.ts');

  it('reaches every soundtrack: films, ads and break cards', () => {
    for (const file of [
      'src/music/cinema-render.ts',
      'src/music/cinema-score.ts',
      'src/films/scores.ts',
      'src/films/cards/jingles.ts',
    ])
      expect(worker.has(file), file).toBe(true);
  });

  it('bundles no town drawing code, no components and no roster', () => {
    const banned = [...worker].filter(
      (file) =>
        file.startsWith('src/city/') ||
        file.startsWith('src/components/') ||
        file === 'src/lib/places.ts' ||
        file === 'src/lib/arrivals.ts' ||
        file === 'src/lib/live-breaks.ts',
    );
    expect(banned).toEqual([]);
  });

  it('bundles no break card pictures: each jingle imports only the score kit', () => {
    const jingles = readdirSync('src/films/cards').filter((file) => file.endsWith('-jingle.ts'));
    expect(jingles.length).toBeGreaterThan(0);
    for (const file of jingles)
      expect(valueImports(`src/films/cards/${file}`), file).toEqual(['src/films/score-kit.ts']);
    expect(
      [...worker].filter((file) =>
        /^src\/films\/cards\/(?!jingles\.ts$)(?!.*-jingle\.ts$)/.test(file),
      ),
    ).toEqual([]);
  });
});

describe('The films chunk', () => {
  it('gets its houses only through data, never from the roster', () => {
    const films = bundle('src/films/index.ts');
    expect(films.has('src/films/cards/index.ts')).toBe(true);
    for (const file of ['src/lib/places.ts', 'src/lib/arrivals.ts', 'src/lib/live-breaks.ts'])
      expect(films.has(file), file).toBe(false);
  });
});

describe('The live page’s own modules', () => {
  it('stay in the main chunk, borrowing only the film kit', () => {
    const entries = [
      'src/lib/break-cards.ts',
      'src/lib/live-breaks.ts',
      'src/lib/live-params.ts',
      'src/lib/live-harness.ts',
      'src/components/LiveStream.tsx',
      'src/components/BreakOverlay.tsx',
      'src/components/Soundtrack.tsx',
    ].filter((file) => existsSync(file));
    for (const entry of entries) {
      const films = [...bundle(entry)].filter(
        (file) => file.startsWith('src/films/') && file !== 'src/films/kit.ts',
      );
      expect(films, entry).toEqual([]);
    }
  });
});

describe('The Riverside’s feature files', () => {
  it('stay out of the cinema and music workers and the place schema', () => {
    // The workers and the schema reach the frozen district data, never a feature's poses or art.
    for (const entry of [
      'src/music/cinema-worker.ts',
      'src/music/render-worker.ts',
      'src/lib/schema.ts',
    ]) {
      const reached = [...bundle(entry)].filter(
        (file) => file.startsWith('src/lib/outings/') || file.startsWith('src/city/'),
      );
      expect(reached, entry).toEqual([]);
    }
  });
});
