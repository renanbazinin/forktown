import { afterEach, describe, expect, it } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  rmdirSync,
  unlinkSync,
  existsSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SUBPROCESS_TEST } from './subprocess-timeout';
import { thirdPartyLicenses, thirdPartyNotices } from '../scripts/third-party-licenses';

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
