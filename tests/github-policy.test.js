import { describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SUBPROCESS_TEST } from './subprocess-timeout';
import {
  evaluatePolicy,
  paginate,
  approvedByMaintainer,
  headModes,
  runContributionPolicy,
} from '../scripts/pr-policy.mjs';

const house = (filename = 'places/mine.json', status = 'added', extra = {}) => ({
  filename,
  status,
  ...extra,
});
const defaults = {
  files: [house()],
  author: 'Neighbor',
  authorPermission: 'none',
  approved: false,
  readHead: async () => ({ creator: 'neighbor', resident: { name: 'Hello' } }),
  readBase: async () => ({ creator: 'neighbor' }),
  modeOf: () => '100644',
};
const check = (overrides = {}) => evaluatePolicy({ ...defaults, ...overrides });
describe('Trusted PR policy', () => {
  it('accepts a house with case-insensitive author credit', async () => {
    expect((await check()).errors).toEqual([]);
  });
  it('allows docs-only PRs without houses', async () => {
    expect((await check({ files: [house('README.md', 'modified')] })).errors).toEqual([]);
  });
  it('blocks multiple new houses even with approval and deletions', async () => {
    const result = await check({
      approved: true,
      files: [house(), house('places/second.json'), house('places/old.json', 'removed')],
    });
    expect(result.errors.join(' ')).toContain('At most one');
  });
  it('counts a renamed house as a new filename', async () => {
    expect(
      (
        await check({
          files: [
            house(),
            house('places/renamed.json', 'renamed', { previous_filename: 'places/old.json' }),
          ],
        })
      ).added,
    ).toBe(2);
  });
  it('requires review for mismatched creator credit', async () => {
    expect(
      (await check({ readHead: async () => ({ creator: 'someone-else' }) })).errors.join(' '),
    ).toContain('maintainer');
  });
  it('allows documented collaborative credit with explicit approval', async () => {
    expect(
      (await check({ approved: true, readHead: async () => ({ creator: 'someone-else' }) })).errors,
    ).toEqual([]);
  });
  it('never grants new starter credit even with approval', async () => {
    expect(
      (
        await check({ approved: true, readHead: async () => ({ creator: 'forktown' }) })
      ).errors.join(' '),
    ).toContain('reserved');
  });
  it('allows edits to your own house without a credit change', async () => {
    expect((await check({ files: [house('places/mine.json', 'modified')] })).errors).toEqual([]);
  });
  it('requires review to edit someone else or change creator credit', async () => {
    expect(
      (
        await check({
          files: [house('places/mine.json', 'modified')],
          readBase: async () => ({ creator: 'other' }),
        })
      ).errors.join(' '),
    ).toContain('ownership');
  });
  it('requires review for deletions, including moves outside places', async () => {
    for (const file of [
      house('places/mine.json', 'removed'),
      house('docs/removed.json', 'renamed', { previous_filename: 'places/mine.json' }),
    ])
      expect((await check({ files: [file] })).errors.join(' ')).toContain('deletion');
  });
  it('requires approval for outside changes to validators/workflows', async () => {
    expect(
      (await check({ files: [house('src/lib/schema.ts', 'modified')] })).errors.join(' '),
    ).toContain('automation');
    expect(
      (await check({ authorPermission: 'admin', files: [house('src/lib/schema.ts', 'modified')] }))
        .errors,
    ).toEqual([]);
  });
  it.each(['README.md', 'docs/GUIDE.md', 'docs/images/town.png', 'examples/my-home.json'])(
    'lets anyone improve pages people only read: %s',
    async (path) => {
      expect((await check({ files: [house(path, 'modified')] })).errors).toEqual([]);
      expect((await check({ files: [house(path, 'added')] })).errors).toEqual([]);
    },
  );
  it.each([
    'CLAUDE.md',
    'AGENTS.md',
    'docs/CLAUDE.md',
    'docs/claude.md',
    'docs/CLAUDE.local.md',
    'docs/AGENTS.md',
    'docs/agents.override.md',
    'docs/GEMINI.md',
    'docs/AGENT.md',
    'docs/QWEN.md',
    'docs/warp.md',
    'docs/CRUSH.md',
    'docs/copilot-instructions.md',
    'docs/review.instructions.md',
    'docs/release.prompt.md',
    '.claude/commands/release.md',
    '.claude/agents/reviewer.md',
    '.claude/skills/deploy/SKILL.md',
    '.claude/settings.json',
    '.github/copilot-instructions.md',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/ISSUE_TEMPLATE/config.yml',
    '.github/workflows/check.yml',
    'SECURITY.md',
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    'THIRD_PARTY_NOTICES.md',
    'LICENSE',
    'src/notes.md',
    'scripts/notes.md',
    'places/notes.md',
    'docs/history/old.md',
    'docs/images/mark.svg',
    'examples/nested/home.json',
  ])('needs a maintainer for instructions, automation and policy files: %s', async (path) => {
    for (const status of ['added', 'modified', 'removed']) {
      const result = await check({ files: [house(path, status)] });
      expect(result.reviewReasons, status).toEqual([
        `Shared app or automation change: ${JSON.stringify(path)}`,
      ]);
      expect(result.errors.join(' ')).toContain('different maintainer');
    }
    expect(
      (await check({ authorPermission: 'write', files: [house(path, 'modified')] })).errors,
    ).toEqual([]);
  });
  it('needs a maintainer when a rename moves code into a reader-only path', async () => {
    const moved = house('docs/app.md', 'renamed', { previous_filename: 'src/App.tsx' });
    expect((await check({ files: [moved] })).reviewReasons).toHaveLength(1);
  });
  it('needs a maintainer when a reader page is renamed to an agent instruction file', async () => {
    const moved = house('docs/CLAUDE.md', 'renamed', { previous_filename: 'docs/notes.md' });
    expect((await check({ files: [moved] })).reviewReasons).toHaveLength(1);
  });
  it('rejects anything in places/ that is not a plain file, even with approval', async () => {
    for (const [path, mode] of [
      ['places/mine.json', '120000'],
      ['places/mine.json', '100755'],
      ['places/mine.json', '160000'],
      ['places/{"creator":"neighbor","x":"/keep.md', '120000'],
    ]) {
      const readHead = vi.fn(async () => ({ creator: 'neighbor' }));
      const result = await check({
        approved: true,
        authorPermission: 'admin',
        files: [house(path)],
        readHead,
        modeOf: () => mode,
      });
      expect(result.errors.join(' '), `${path} ${mode}`).toContain('must be a plain file');
      expect(readHead).not.toHaveBeenCalled();
    }
  });
  it('rejects house files in a folder under places/, even with approval', async () => {
    for (const status of ['added', 'modified', 'renamed']) {
      const readHead = vi.fn(async () => ({ creator: 'neighbor' }));
      const result = await check({
        approved: true,
        authorPermission: 'admin',
        files: [house('places/sub/mine.json', status, { previous_filename: 'places/mine.json' })],
        readHead,
      });
      expect(result.errors.join(' '), status).toContain('must be a plain file');
      expect(readHead).not.toHaveBeenCalled();
    }
    const removed = await check({ files: [house('places/sub/old.json', 'removed')] });
    expect(removed.errors.join(' ')).not.toContain('must be a plain file');
  });
  it('needs a maintainer for links and submodules anywhere else', async () => {
    for (const mode of ['120000', '160000']) {
      const files = [house('docs/q.md', 'added')];
      expect((await check({ files, modeOf: () => mode })).reviewReasons).toEqual([
        'Link or submodule: "docs/q.md"',
      ]);
      expect(
        (await check({ files, modeOf: () => mode, authorPermission: 'maintain' })).errors,
      ).toEqual([]);
    }
  });
  it('fails closed when a changed file is missing from the commit, but not for removals', async () => {
    await expect(check({ modeOf: () => undefined })).rejects.toThrow('Could not find');
    expect(
      (
        await check({
          files: [house('docs/gone.md', 'removed')],
          modeOf: () => undefined,
        })
      ).errors,
    ).toEqual([]);
  });
  it('rejects unreadable JSON and invalid resident lists', async () => {
    await expect(
      check({
        readHead: async () => {
          throw new Error('invalid JSON');
        },
      }),
    ).rejects.toThrow('invalid JSON');
    expect(
      (await check({ readHead: async () => ({ creator: 'neighbor', resident: [] }) })).errors.join(
        ' ',
      ),
    ).toContain('one resident');
  });
});
describe('Repository owner maintenance of existing project starter houses', () => {
  const starterCheck = (overrides = {}) =>
    check({
      files: [house('places/starter.json', 'modified')],
      author: 'Owner',
      repositoryOwner: 'owner',
      authorPermission: 'admin',
      readHead: async () => ({ creator: 'forktown' }),
      readBase: async () => ({ creator: 'forktown' }),
      ...overrides,
    });

  it('lets the admin repository owner maintain existing starter houses without self-review', async () => {
    expect((await starterCheck()).errors).toEqual([]);
  });

  it.each([
    { repositoryOwner: undefined },
    { repositoryOwner: 'another-owner' },
    { authorPermission: 'write' },
    { authorPermission: 'maintain' },
    { authorPermission: 'none' },
  ])(
    'requires independent review when ownership or admin permission is missing: %j',
    async (overrides) => {
      expect((await starterCheck(overrides)).errors.join(' ')).toContain('different maintainer');
    },
  );

  it.each([
    ['community', 'community'],
    ['forktown', 'Owner'],
    ['community', 'forktown'],
  ])('requires review for community houses or changed credit: %s to %s', async (before, after) => {
    expect(
      (
        await starterCheck({
          readBase: async () => ({ creator: before }),
          readHead: async () => ({ creator: after }),
        })
      ).errors.join(' '),
    ).toContain('different maintainer');
  });

  it.each([
    house('places/starter.json', 'removed'),
    house('places/renamed.json', 'renamed', { previous_filename: 'places/starter.json' }),
    house('docs/starter.json', 'renamed', { previous_filename: 'places/starter.json' }),
  ])('requires review for starter deletion or renaming: %j', async (file) => {
    expect((await starterCheck({ files: [file] })).errors.join(' ')).toContain(
      'different maintainer',
    );
  });

  it.each(['added', 'copied'])('still forbids new starter credit for %s files', async (status) => {
    expect(
      (await starterCheck({ files: [house('places/new.json', status)] })).errors.join(' '),
    ).toContain('reserved');
  });

  it('still enforces resident validation for owner-maintained starter houses', async () => {
    expect(
      (
        await starterCheck({ readHead: async () => ({ creator: 'forktown', resident: [] }) })
      ).errors.join(' '),
    ).toContain('one resident');
  });
});

describe('Complete API inspection', () => {
  it('reads later pages so a second house cannot hide after 100 files', async () => {
    const first = Array.from({ length: 100 }, (_, i) => house(`docs/${i}.md`));
    const api = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce([house(), house('places/two.json')]);
    const files = await paginate(api, '/files', 102);
    expect(api).toHaveBeenLastCalledWith('/files?per_page=100&page=2');
    expect((await check({ files })).errors.join(' ')).toContain('At most one');
  });
  it('rejects truncated responses', async () => {
    await expect(paginate(async () => [], '/files', 2)).rejects.toThrow('incomplete');
  });
  it('rejects API failures instead of granting an allowance', async () => {
    await expect(
      paginate(
        async () => {
          throw new Error('HTTP 403');
        },
        '/files',
        1,
      ),
    ).rejects.toThrow('403');
  });
  it('fails closed at the GitHub 3000-file limit', async () => {
    await expect(paginate(async () => Array(100).fill(house()), '/files', 3001)).rejects.toThrow(
      'too large',
    );
  });
});
describe('Approval is tied to the author, current commit and current maintainer permission', () => {
  const review = { user: { login: 'reviewer' }, state: 'APPROVED', commit_id: 'head' };
  const approval = (reviews, permission = 'write') =>
    approvedByMaintainer(reviews, 'head', 'author', async () => permission);
  it('accepts an independent maintainer approval of the current commit', async () => {
    expect(await approval([review])).toBe(true);
  });
  it('rejects stale, self-approved and non-maintainer reviews', async () => {
    expect(await approval([{ ...review, commit_id: 'old' }])).toBe(false);
    expect(await approval([{ ...review, user: { login: 'author' } }])).toBe(false);
    expect(await approval([review], 'read')).toBe(false);
  });
  it('invalidates a dismissed approval or subsequent changes request', async () => {
    for (const state of ['DISMISSED', 'CHANGES_REQUESTED'])
      expect(await approval([review, { ...review, state }])).toBe(false);
  });
});

describe('The PR head commit, read like the checkout will read it', () => {
  it('reads every mode from one recursive tree', async () => {
    const api = vi.fn(async () => ({
      truncated: false,
      tree: [
        { path: 'places/mine.json', mode: '100644' },
        { path: 'docs/q', mode: '120000' },
      ],
    }));
    const modes = await headModes(api, '/repos/o/r', 'abc');
    expect(api).toHaveBeenCalledWith('/repos/o/r/git/trees/abc?recursive=1');
    expect(modes.get('docs/q')).toBe('120000');
    expect(modes.get('places/mine.json')).toBe('100644');
  });
  it('fails closed on a truncated or missing tree', async () => {
    for (const reply of [{ truncated: true, tree: [] }, { tree: [] }, {}])
      await expect(headModes(async () => reply, '/repos/o/r', 'abc')).rejects.toThrow('incomplete');
  });
});

const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const BLOB = 'c'.repeat(40);
const pull = (number, login, ref = 'main') => ({
  number,
  state: 'open',
  user: { login },
  changed_files: 1,
  head: { sha: HEAD },
  base: { ref, sha: BASE, repo: { full_name: 'o/r' } },
});
// A small stand-in for the GitHub REST API: enough routes for one policy run.
function fakeGitHub({ pulls, mode = '100644', creator = 'alice', permissions = {} }) {
  const statuses = [];
  const reads = [];
  const blob = (value) => ({
    encoding: 'base64',
    size: 64,
    content: Buffer.from(JSON.stringify(value)).toString('base64'),
  });
  const api = async (path, body) => {
    if (body) {
      statuses.push({ path, ...body });
      return {};
    }
    reads.push(path);
    const route = path.split('?')[0].replace('/repos/o/r', '');
    const page = Number(new URLSearchParams(path.split('?')[1]).get('page') ?? '1');
    const list = (items) => (page === 1 ? items : []);
    let match;
    if (route === '') return { default_branch: 'main' };
    if ((match = route.match(/^\/pulls\/(\d+)$/)))
      return pulls.find((pr) => pr.number === Number(match[1]));
    if (route === `/commits/${HEAD}/pulls`) return list(pulls);
    if (/^\/pulls\/\d+\/files$/.test(route))
      return list([{ filename: 'places/alice.json', status: 'added', sha: BLOB }]);
    if (/^\/pulls\/\d+\/reviews$/.test(route)) return list([]);
    if ((match = route.match(/^\/collaborators\/([^/]+)\/permission$/))) {
      if (permissions[match[1]]) return { permission: permissions[match[1]] };
      throw Object.assign(new Error('not found'), { status: 404 });
    }
    if (route === `/git/trees/${HEAD}`)
      return { truncated: false, tree: [{ path: 'places/alice.json', mode }] };
    if (route === `/git/blobs/${BLOB}`) return blob({ creator, resident: { name: 'Al' } });
    throw new Error(`Unexpected API call ${path}`);
  };
  const log = { log: vi.fn(), error: vi.fn() };
  const run = (options) =>
    runContributionPolicy({ api, repo: 'o/r', runUrl: 'https://run', log, ...options });
  return { run, statuses, reads, log };
}

describe('One commit status for every PR that shares a head commit', () => {
  it('passes a single house PR and reports on its head commit', async () => {
    const github = fakeGitHub({ pulls: [pull(1, 'alice')] });
    expect(await github.run({ number: '1' })).toBe('success');
    expect(github.statuses.map((status) => status.state)).toEqual(['pending', 'success']);
    expect(github.statuses[1]).toMatchObject({
      path: `/repos/o/r/statuses/${HEAD}`,
      context: 'Contribution policy',
    });
  });
  it('gives the same answer whichever duplicate PR asks, and never borrows a pass', async () => {
    const pulls = [pull(1, 'alice'), pull(2, 'mallory')];
    for (const options of [{ number: '1' }, { number: '2' }, { sha: HEAD }]) {
      const github = fakeGitHub({ pulls });
      expect(await github.run(options)).toBe('failure');
      expect(github.statuses.at(-1).state).toBe('failure');
      expect(github.log.error.mock.calls[0][0]).toContain('PR #2:');
      expect(github.log.error.mock.calls[0][0]).toContain('close the duplicate');
    }
  });
  it('ignores PRs into other branches, which do not gate a merge', async () => {
    const pulls = [pull(1, 'alice'), pull(2, 'mallory', 'old-branch')];
    for (const options of [{ number: '1' }, { number: '2' }]) {
      const github = fakeGitHub({ pulls });
      expect(await github.run(options)).toBe('success');
    }
    const alone = fakeGitHub({ pulls: [pull(2, 'mallory', 'old-branch')] });
    expect(await alone.run({ number: '2' })).toBe('skipped');
    expect(alone.statuses).toEqual([]);
  });
  it('fails closed when too many PRs share a commit to check them all', async () => {
    const github = fakeGitHub({
      pulls: Array.from({ length: 11 }, (_, i) => pull(i + 1, `neighbor-${i}`)),
    });
    expect(await github.run({ number: '1' })).toBe('failure');
    expect(github.statuses.map((status) => status.state)).toEqual(['failure']);
  });
  it('rejects a house that is a link without reading the link text', async () => {
    const github = fakeGitHub({ pulls: [pull(1, 'alice')], mode: '120000' });
    expect(await github.run({ number: '1' })).toBe('failure');
    expect(github.log.error.mock.calls[0][0]).toContain('must be a plain file');
    expect(github.reads.some((path) => path.includes('/git/blobs/'))).toBe(false);
  });
  it('still needs a maintainer for credit that differs from the author', async () => {
    const github = fakeGitHub({ pulls: [pull(1, 'alice')], creator: 'bob' });
    expect(await github.run({ number: '1' })).toBe('failure');
    expect(github.log.error.mock.calls[0][0]).toContain('different maintainer');
  });
  it('says so when a review matches no open PR, instead of passing quietly', async () => {
    const movedOn = { ...pull(1, 'alice'), head: { sha: 'd'.repeat(40) } };
    for (const pulls of [[], [movedOn]]) {
      const github = fakeGitHub({ pulls });
      expect(await github.run({ sha: HEAD })).toBe('unresolved');
      expect(github.statuses).toEqual([]);
      expect(github.log.error.mock.calls[0][0]).toContain('/check-contribution');
    }
    const elsewhere = fakeGitHub({ pulls: [pull(2, 'mallory', 'old-branch')] });
    expect(await elsewhere.run({ sha: HEAD })).toBe('skipped');
  });
});

describe('The workflow step', SUBPROCESS_TEST, () => {
  const script = fileURLToPath(new URL('../scripts/check-github-pr.mjs', import.meta.url));
  // Runs the real script after a preload swaps fetch for canned GitHub replies.
  const runAfterReview = (replies) => {
    const directory = mkdtempSync(join(tmpdir(), 'forktown-policy-'));
    try {
      const stub = join(directory, 'github.mjs');
      writeFileSync(
        stub,
        `const replies = ${JSON.stringify(replies)};
globalThis.fetch = async (url) => {
  const body = replies[new URL(url).pathname];
  return { ok: body !== undefined, status: body === undefined ? 404 : 200, json: async () => body };
};`,
      );
      const event = join(directory, 'event.json');
      writeFileSync(event, JSON.stringify({ workflow_run: { head_sha: HEAD } }));
      return spawnSync(process.execPath, ['--import', pathToFileURL(stub).href, script], {
        env: {
          ...process.env,
          GITHUB_REPOSITORY: 'o/r',
          GH_TOKEN: 'token',
          GITHUB_EVENT_NAME: 'workflow_run',
          GITHUB_EVENT_PATH: event,
          GITHUB_RUN_ID: '1',
          PR_NUMBER: '',
        },
        encoding: 'utf8',
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };
  const lookup = `/repos/o/r/commits/${HEAD}/pulls`;

  it('fails the run when a review matches no open PR', () => {
    const result = runAfterReview({ '/repos/o/r': { default_branch: 'main' }, [lookup]: [] });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toContain('/check-contribution');
  });
  it('stays green when the reviewed PR goes into another branch', () => {
    const result = runAfterReview({
      '/repos/o/r': { default_branch: 'main' },
      [lookup]: [pull(2, 'mallory', 'old-branch')],
    });
    expect(result.status, result.stderr).toBe(0);
  });
});
