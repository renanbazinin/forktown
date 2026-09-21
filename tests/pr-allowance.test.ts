import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/check-pr-places.mjs', import.meta.url));
const prefix = join(tmpdir(), 'forktown-pr-allowance-');
let directory: string;
function git(...args: string[]) {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
}
function file(path: string, contents = '{}') {
  writeFileSync(join(directory, path), contents);
}
function commit() {
  git('add', '.');
  git('commit', '-qm', 'test change');
}
function check(base = 'main', head = 'HEAD') {
  const result = spawnSync(process.execPath, [script, base, head], {
    cwd: directory,
    encoding: 'utf8',
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

beforeEach(() => {
  directory = mkdtempSync(prefix);
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Allowance test');
  git('config', 'user.email', 'allowance@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  mkdirSync(join(directory, 'places'));
  file('places/existing.json');
  file('README.md', 'Town');
  commit();
  git('checkout', '-qb', 'contribution');
});

afterEach(() => {
  // Only remove the exact temporary repository created by this test.
  if (!directory || !resolve(directory).startsWith(resolve(prefix)))
    throw new Error('Refusing to remove a path outside the test repository prefix.');
  rmSync(directory, { recursive: true, force: true });
});

describe('The committed PR house allowance', () => {
  it('allows code/docs changes and edits to existing houses without a new house', () => {
    file('README.md', 'Updated guide');
    file('places/existing.json', '{"name":"Updated house"}');
    commit();
    expect(check()).toMatchObject({ status: 0 });
  });

  it('allows one added house and ignores examples outside the town', () => {
    file('places/new-home.json');
    mkdirSync(join(directory, 'examples'));
    file('examples/another-home.json');
    commit();
    expect(check()).toMatchObject({ status: 0 });
  });

  it('rejects two additions across separate commits and lists both files', () => {
    file('places/first.json');
    commit();
    file('places/second.json');
    commit();
    const result = check();
    expect(result.status).toBe(1);
    expect(result.output).toContain('Each PR may add at most one house');
    expect(result.output).toContain('places/first.json');
    expect(result.output).toContain('places/second.json');
  });

  it('does not let deletion or rename detection hide a second addition', () => {
    renameSync(join(directory, 'places/existing.json'), join(directory, 'places/renamed.json'));
    file('places/another.json');
    commit();
    expect(check().status).toBe(1);
  });

  it('compares against the branch ancestor when the target has advanced', () => {
    file('places/mine.json');
    commit();
    git('checkout', '-q', 'main');
    file('places/someone-else.json');
    commit();
    git('checkout', '-q', 'contribution');
    expect(check()).toMatchObject({ status: 0 });
  });

  it('counts only the final committed PR content, allowing feedback fixes', () => {
    file('places/first.json');
    file('places/second.json');
    commit();
    git('rm', 'places/second.json');
    commit();
    expect(check().status).toBe(0);
  });

  it('fails closed when a comparison ref is unavailable', () => {
    expect(check('missing-branch').status).toBe(1);
  });

  it('reads the proposal as data without running its checker or package scripts', () => {
    mkdirSync(join(directory, 'scripts'));
    file('scripts/check-pr-places.mjs', 'process.exit(0)');
    file('package.json', '{"scripts":{"preinstall":"exit 1"}}');
    file('places/first.json');
    file('places/second.json');
    commit();
    expect(check().status).toBe(1);
  });
});
