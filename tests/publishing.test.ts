import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SUBPROCESS_TEST } from './subprocess-timeout';

const script = fileURLToPath(new URL('../scripts/configure-pages.mjs', import.meta.url));
const created: string[] = [];
afterEach(() => {
  for (const directory of created.splice(0)) {
    const output = join(directory, 'github-env');
    if (existsSync(output)) unlinkSync(output);
    rmdirSync(directory);
  }
});
function configure(repository: string, override = '') {
  const directory = mkdtempSync(join(tmpdir(), 'forktown-pages-'));
  created.push(directory);
  const output = join(directory, 'github-env');
  const result = spawnSync(process.execPath, [script], {
    env: {
      ...process.env,
      GITHUB_REPOSITORY: repository,
      GITHUB_ENV: output,
      PAGES_BASE_PATH: override,
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
      output: 'VITE_BASE_PATH=/forktown/\nVITE_GITHUB_REPOSITORY=neighbor/forktown\n',
    });
  });
  it('uses the root for a user Pages site', () => {
    expect(configure('Neighbor/neighbor.github.io').output).toContain('VITE_BASE_PATH=/\n');
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
