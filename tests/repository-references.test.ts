// Comments and docs cite only what is in the repository: its docs, its code and its tests. The
// design notes and build roles the Riverside was planned with are not here, so a pointer to one (a
// spec's section number, a build role's letter) would send a contributor nowhere.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const TEXT = /\.(?:ts|tsx|mts|js|mjs|cjs|md|html|css|json)$/;
// Built from parts, so this file never matches itself.
const OUTSIDE = new RegExp(
  ['SPEC\\s§', '\\b[Aa]gent\\s[A-E]\\b', '[Ff]eature\\s[Aa]gent', 'REQUESTS-[A-E]'].join('|'),
);

function files(path: string): string[] {
  if (statSync(path).isDirectory())
    return readdirSync(path).flatMap((name) => files(join(path, name)));
  return TEXT.test(path) ? [path] : [];
}

describe('References in comments and docs', () => {
  it('point only at what is in the repository', () => {
    const found = ['src', 'tests', 'scripts', 'docs', 'README.md', 'CONTRIBUTING.md']
      .flatMap(files)
      .flatMap((path) =>
        readFileSync(path, 'utf8')
          .split('\n')
          .flatMap((line, index) => (OUTSIDE.test(line) ? [`${path}:${index + 1}`] : [])),
      );
    expect(found).toEqual([]);
  });
});
