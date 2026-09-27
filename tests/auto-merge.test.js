import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SUBPROCESS_TEST } from './subprocess-timeout';
import { CONTEXT, readTown, runAutoMerge } from '../scripts/auto-merge.mjs';

const HEAD = 'a'.repeat(40);
const TOWN = 'b'.repeat(40);
const BLOB = 'c'.repeat(40);
const pull = (number, login, extra = {}) => ({
  number,
  state: 'open',
  draft: false,
  merged: false,
  title: 'Add my house',
  user: { login },
  changed_files: 1,
  head: { sha: HEAD },
  base: { ref: 'main', repo: { full_name: 'o/r' } },
  ...extra,
});
const checkRun = (name, conclusion = 'success', extra = {}) => ({
  name,
  status: 'completed',
  conclusion,
  app: { slug: 'github-actions' },
  ...extra,
});
const CHECKS = [checkRun('check'), checkRun('Evaluate contribution')];
const STATUSES = [{ context: 'Contribution policy', state: 'success' }];
const refused = (status, detail) =>
  Object.assign(new Error(`GitHub API request failed (${status})`), { status, detail });

// A small stand-in for the GitHub REST API: enough routes for one auto-merge run.
function fakeGitHub({
  pulls = [pull(1, 'newcomer')],
  files = [{ filename: 'places/newcomer.json', status: 'added', sha: BLOB }],
  house = { creator: 'Newcomer' },
  checkRuns = CHECKS,
  statuses = STATUSES,
  hiddenChecks = 0,
  reviews = [],
  comments = [],
  permissions = {},
  creators = [['neighbor', ['neighbor-home.json']]],
  mainSha = TOWN,
  behindBy = 0,
  merge = () => ({ merged: true }),
  dispatch = () => null,
} = {}) {
  const writes = [];
  const api = async (path, body, method = body ? 'POST' : 'GET') => {
    const [route, query] = path.replace('/repos/o/r', '').split('?');
    if (method !== 'GET') {
      writes.push({ method, route, body });
      if (route.endsWith('/merge')) return merge();
      return route.endsWith('/dispatches') ? dispatch() : {};
    }
    const page = Number(new URLSearchParams(query).get('page') ?? '1');
    const list = (items) => (page === 1 ? items : []);
    let match;
    if (route === '') return { default_branch: 'main' };
    if (route === '/pulls') return list(pulls);
    if ((match = route.match(/^\/pulls\/(\d+)$/)))
      return pulls.find((pr) => pr.number === Number(match[1]));
    if (/^\/pulls\/\d+\/files$/.test(route)) return files;
    if (/^\/pulls\/\d+\/reviews$/.test(route)) return list(reviews);
    if (/^\/issues\/\d+\/comments$/.test(route)) return list(comments);
    if (route === `/git/blobs/${BLOB}`) {
      const text = typeof house === 'string' ? house : JSON.stringify(house);
      return {
        encoding: 'base64',
        size: text.length,
        content: Buffer.from(text).toString('base64'),
      };
    }
    if ((match = route.match(/^\/collaborators\/([^/]+)\/permission$/))) {
      if (permissions[match[1]]) return { permission: permissions[match[1]] };
      throw refused(404);
    }
    if (route === `/commits/${HEAD}/check-runs`)
      return { total_count: checkRuns.length + hiddenChecks, check_runs: checkRuns };
    if (route === `/commits/${HEAD}/status`) return { total_count: statuses.length, statuses };
    if (route === '/git/ref/heads/main') return { object: { sha: mainSha } };
    if (route === `/compare/${TOWN}...${HEAD}`) return { behind_by: behindBy };
    throw new Error(`Unexpected API call ${path}`);
  };
  const log = { log: vi.fn(), error: vi.fn() };
  const town = { sha: TOWN, creators: new Map(creators) };
  return {
    run: (options = {}) =>
      runAutoMerge({ api, repo: 'o/r', sha: HEAD, town, runUrl: 'https://run', log, ...options }),
    writes,
    merges: () => writes.filter((write) => write.route.endsWith('/merge')),
    statuses: () => writes.filter((write) => write.route.startsWith('/statuses/')),
    dispatches: () => writes.filter((write) => write.route.endsWith('/dispatches')),
    reminders: () => writes.filter((write) => write.route.endsWith('/comments')),
  };
}

describe('Auto-merge for a new neighbor', () => {
  it('merges one new house from someone with no house yet, once every check has passed', async () => {
    const github = fakeGitHub();
    expect(await github.run()).toEqual([
      { number: 1, state: 'success', description: expect.stringContaining('Merged automatically') },
    ]);
    // Pinned to the head that passed, and squashed so the commit on main credits the contributor.
    expect(github.merges()).toEqual([
      {
        method: 'PUT',
        route: '/pulls/1/merge',
        body: { sha: HEAD, merge_method: 'squash', commit_title: 'Add my house (#1)' },
      },
    ]);
    expect(github.statuses()).toEqual([
      {
        method: 'POST',
        route: `/statuses/${HEAD}`,
        body: expect.objectContaining({
          state: 'success',
          context: CONTEXT,
          target_url: 'https://run',
        }),
      },
    ]);
    // A merge by the workflow's token starts no push workflow, so it publishes the town itself.
    expect(github.dispatches()).toEqual([
      { method: 'POST', route: '/actions/workflows/pages.yml/dispatches', body: { ref: 'main' } },
    ]);
  });

  it.each(['neighbor', 'NEIGHBOR', 'Neighbor'])(
    'leaves %s, who already has a house, to a maintainer',
    async (login) => {
      const github = fakeGitHub({ pulls: [pull(1, login)], house: { creator: login } });
      const [outcome] = await github.run();
      expect(outcome).toMatchObject({ state: 'failure' });
      expect(outcome.description).toContain(`${login} already has a house (neighbor-home.json)`);
      expect(github.merges()).toEqual([]);
      expect(github.statuses()[0].body).toMatchObject({ state: 'failure', context: CONTEXT });
      expect(github.dispatches()).toEqual([]);
      expect(github.reminders()).toEqual([]);
      // Even behind main, no comment asks them to update: a maintainer decides either way.
      const behind = fakeGitHub({ pulls: [pull(1, login)], behindBy: 1 });
      expect((await behind.run())[0].state).toBe('failure');
      expect(behind.reminders()).toEqual([]);
    },
  );

  it('counts every house someone has', async () => {
    const github = fakeGitHub({
      pulls: [pull(1, 'neighbor')],
      creators: [['neighbor', ['first.json', 'second.json', 'third.json']]],
    });
    expect((await github.run())[0].description).toContain('(first.json and 2 more)');
  });

  it.each([
    ['credits an existing neighbor', { creator: 'neighbor' }],
    ['credits someone else', { creator: 'someone-new' }],
    ['credits nobody', { name: 'No credit' }],
    ['is a list', [{ creator: 'newcomer' }]],
    ['is not JSON', '{"creator": "newcomer"'],
  ])('leaves a house that %s to a maintainer', async (_, house) => {
    const github = fakeGitHub({ house });
    const [outcome] = await github.run();
    expect(outcome.state).toBe('failure');
    expect(outcome.description).toContain('credits the PR author');
    expect(github.merges()).toEqual([]);
  });

  it.each([
    ['a second changed file', { pulls: [pull(1, 'newcomer', { changed_files: 2 })] }],
    [
      'two listed files',
      {
        files: [
          { filename: 'places/newcomer.json', status: 'added', sha: BLOB },
          { filename: 'README.md', status: 'modified', sha: BLOB },
        ],
      },
    ],
    [
      'an edit to a house',
      { files: [{ filename: 'places/x.json', status: 'modified', sha: BLOB }] },
    ],
    ['a removed house', { files: [{ filename: 'places/x.json', status: 'removed', sha: BLOB }] }],
    [
      'a renamed house',
      {
        files: [
          {
            filename: 'places/x.json',
            previous_filename: 'places/old.json',
            status: 'renamed',
            sha: BLOB,
          },
        ],
      },
    ],
    [
      'a house in a folder',
      { files: [{ filename: 'places/a/x.json', status: 'added', sha: BLOB }] },
    ],
    ['an example', { files: [{ filename: 'examples/x.json', status: 'added', sha: BLOB }] }],
    ['a page', { files: [{ filename: 'README.md', status: 'added', sha: BLOB }] }],
    ['a draft', { pulls: [pull(1, 'newcomer', { draft: true })] }],
    [
      'a PR into another branch',
      { pulls: [pull(1, 'newcomer', { base: { ref: 'old', repo: { full_name: 'o/r' } } })] },
    ],
  ])('leaves %s alone, without a status', async (_, options) => {
    const github = fakeGitHub(options);
    expect((await github.run())[0].state).toBe('skipped');
    expect(github.writes).toEqual([]);
  });

  const policy = (state) => [{ context: 'Contribution policy', state }];
  it.each([
    [
      'check still running',
      { checkRuns: [checkRun('check', null, { status: 'queued' })] },
      'check',
    ],
    ['check failing', { checkRuns: [checkRun('check', 'failure')] }, 'check'],
    ['check missing', { checkRuns: [] }, 'check'],
    ['check from another app', { checkRuns: [checkRun('check', 'success', { app: {} })] }, 'check'],
    ['another check failing', { checkRuns: [...CHECKS, checkRun('lint', 'failure')] }, 'lint'],
    [
      'another check awaiting approval',
      { checkRuns: [...CHECKS, checkRun('signal', 'action_required')] },
      'signal',
    ],
    ['the policy still checking', { statuses: policy('pending') }, 'Contribution policy'],
    ['the policy failing', { statuses: policy('failure') }, 'Contribution policy'],
    ['the policy missing', { statuses: [] }, 'Contribution policy'],
    [
      'another status failing',
      { statuses: [...STATUSES, { context: 'preview', state: 'error' }] },
      'preview',
    ],
  ])('waits with %s', async (_, options, name) => {
    const github = fakeGitHub(options);
    const [outcome] = await github.run();
    expect(outcome.state).toBe('pending');
    expect(outcome.description).toContain(name);
    expect(github.merges()).toEqual([]);
    expect(github.statuses()[0].body.state).toBe('pending');
  });

  it('does not wait for its own earlier status', async () => {
    for (const state of ['pending', 'failure']) {
      const github = fakeGitHub({ statuses: [...STATUSES, { context: CONTEXT, state }] });
      expect((await github.run())[0].state).toBe('success');
    }
  });

  it('fails closed when GitHub lists only some of the checks', async () => {
    const github = fakeGitHub({ hiddenChecks: 1 });
    expect((await github.run())[0]).toMatchObject({ state: 'error' });
    expect(github.writes).toEqual([]);
  });

  it('asks for Update branch when behind main, without waiting for the other checks', async () => {
    const running = [checkRun('check', null, { status: 'in_progress' })];
    for (const options of [
      { behindBy: 1 },
      { mainSha: 'd'.repeat(40) },
      { behindBy: 1, checkRuns: running },
    ]) {
      const github = fakeGitHub(options);
      const [outcome] = await github.run();
      expect(outcome.state).toBe('pending');
      expect(outcome.description).toBe(
        'Behind main: click Update branch, and this merges automatically once the checks pass',
      );
      expect(github.merges()).toEqual([]);
      // A status notifies nobody, so the contributor also hears it by name.
      expect(github.reminders()).toEqual([
        {
          method: 'POST',
          route: '/issues/1/comments',
          body: { body: expect.stringContaining('@newcomer, `main` has moved on') },
        },
      ]);
    }
  });

  it('mentions the contributor only once per PR', async () => {
    const first = fakeGitHub({ behindBy: 1 });
    await first.run();
    const { body } = first.reminders()[0].body;
    const again = fakeGitHub({ behindBy: 1, comments: [{ user: { type: 'Bot' }, body }] });
    expect((await again.run())[0].state).toBe('pending');
    expect(again.reminders()).toEqual([]);
    // Someone quoting the reminder doesn't silence it.
    const quoted = fakeGitHub({ behindBy: 1, comments: [{ user: { type: 'User' }, body }] });
    await quoted.run();
    expect(quoted.reminders()).toHaveLength(1);
  });

  it('holds for a maintainer who requested changes, until they approve or dismiss them', async () => {
    const asked = { user: { login: 'Keeper' }, state: 'CHANGES_REQUESTED' };
    const permissions = { Keeper: 'write' };
    for (const reviews of [[asked], [asked, { ...asked, state: 'COMMENTED' }]]) {
      const [outcome] = await fakeGitHub({ reviews, permissions }).run();
      expect(outcome).toEqual({
        number: 1,
        state: 'pending',
        description: 'On hold: a maintainer requested changes',
      });
    }
    for (const state of ['APPROVED', 'DISMISSED']) {
      const reviews = [asked, { ...asked, state }];
      expect((await fakeGitHub({ reviews, permissions }).run())[0].state).toBe('success');
    }
    // Only a maintainer can hold it.
    expect((await fakeGitHub({ reviews: [asked] }).run())[0].state).toBe('success');
  });

  it('merges only the head that passed', async () => {
    const detail = 'Head branch was modified. Review and try the merge again.';
    const github = fakeGitHub({
      merge: () => {
        throw refused(409, detail);
      },
    });
    const [outcome] = await github.run();
    expect(outcome.state).toBe('pending');
    expect(outcome.description).toContain(detail);
    expect(github.dispatches()).toEqual([]);
  });

  it('says nothing more when someone else merged it first', async () => {
    const pulls = [pull(1, 'newcomer')];
    const github = fakeGitHub({
      pulls,
      merge: () => {
        pulls[0] = { ...pulls[0], state: 'closed', merged: true };
        throw refused(405, 'Pull Request is not mergeable');
      },
    });
    expect((await github.run())[0].state).toBe('skipped');
    expect(github.statuses()).toEqual([]);
    expect(github.dispatches()).toEqual([]);
  });

  it('reports any other refusal as an error, claiming nothing', async () => {
    const github = fakeGitHub({
      merge: () => {
        throw refused(403, 'Resource not accessible by integration');
      },
    });
    expect((await github.run())[0].state).toBe('error');
    expect(github.statuses()).toEqual([]);
    expect(github.dispatches()).toEqual([]);
  });

  it('reports a town that could not be published, after merging', async () => {
    const github = fakeGitHub({
      dispatch: () => {
        throw refused(403);
      },
    });
    expect((await github.run()).map((outcome) => outcome.state)).toEqual(['success', 'error']);
    expect(github.merges()).toHaveLength(1);
  });

  it('checks only the PRs whose head just finished, or the one it is given', async () => {
    const other = pull(2, 'another-newcomer', { head: { sha: 'e'.repeat(40) } });
    const github = fakeGitHub({ pulls: [pull(1, 'newcomer'), other] });
    expect((await github.run()).map((outcome) => outcome.number)).toEqual([1]);
    const unmatched = fakeGitHub();
    expect(await unmatched.run({ sha: 'f'.repeat(40) })).toEqual([]);
    expect(unmatched.writes).toEqual([]);
    const closed = fakeGitHub({ pulls: [pull(1, 'newcomer', { state: 'closed' })] });
    expect(await closed.run({ number: '1', sha: undefined })).toEqual([
      { number: 1, state: 'skipped', description: 'not an open PR into main' },
    ]);
  });

  it('keeps each status description within 140 characters', async () => {
    const long = Array.from({ length: 12 }, (_, i) => checkRun(`long-check-name-${i}`, 'failure'));
    const github = fakeGitHub({ checkRuns: [...CHECKS, ...long] });
    await github.run();
    const { description } = github.statuses()[0].body;
    expect(description).toHaveLength(140);
    expect(description.endsWith('…')).toBe(true);
  });
});

// Temporary default-branch checkouts, removed after each test.
const checkouts = [];
afterEach(() => {
  for (const directory of checkouts.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function checkout(houses, scripts = []) {
  const directory = mkdtempSync(join(tmpdir(), 'forktown-auto-merge-'));
  checkouts.push(directory);
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  mkdirSync(join(directory, 'places'));
  for (const [name, contents] of Object.entries(houses))
    writeFileSync(join(directory, 'places', name), contents);
  mkdirSync(join(directory, 'scripts'));
  for (const name of scripts)
    copyFileSync(
      fileURLToPath(new URL(`../scripts/${name}`, import.meta.url)),
      join(directory, 'scripts', name),
    );
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Auto-merge test');
  git('config', 'user.email', 'auto-merge@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.autocrlf', 'false');
  git('add', '.');
  git('commit', '-qm', 'town');
  return { directory, sha: git('rev-parse', 'HEAD') };
}

describe('The town it compares against', SUBPROCESS_TEST, () => {
  it('names every creator, ignoring case, with their houses and the commit read', () => {
    const { directory, sha } = checkout({
      'a.json': '{"creator":"Alice"}',
      'b.json': '{"creator":"alice"}',
      'c.json': '{"creator":"Bob"}',
      'notes.md': 'Not a house',
    });
    const town = readTown(directory);
    expect(town.sha).toBe(sha);
    expect([...town.creators]).toEqual([
      ['alice', ['a.json', 'b.json']],
      ['bob', ['c.json']],
    ]);
  });

  it.each(['{', '{"name":"No credit"}', 'null', '[]'])(
    'stops every auto-merge when a house reads %s',
    (contents) => {
      const { directory } = checkout({ 'a.json': contents });
      expect(() => readTown(directory)).toThrow();
    },
  );
});

describe('The workflow step', SUBPROCESS_TEST, () => {
  // Runs the real script in a trusted checkout after a preload swaps fetch for canned replies,
  // printing each write it makes.
  const runStep = (directory, replies, env) => {
    const stub = join(directory, 'github.mjs');
    writeFileSync(
      stub,
      `const replies = ${JSON.stringify(replies)};
globalThis.fetch = async (url, init = {}) => {
  const path = new URL(url).pathname;
  if (init.method && init.method !== 'GET') console.log(init.method, path, init.body);
  const body = replies[path];
  return { ok: body !== undefined, status: body === undefined ? 404 : 200, json: async () => body };
};`,
    );
    return spawnSync(
      process.execPath,
      ['--import', pathToFileURL(stub).href, join(directory, 'scripts', 'auto-merge-github.mjs')],
      {
        env: {
          ...process.env,
          GITHUB_REPOSITORY: 'o/r',
          GH_TOKEN: 'token',
          GITHUB_RUN_ID: '1',
          PR_NUMBER: '',
          HEAD_SHA: HEAD,
          ...env,
        },
        encoding: 'utf8',
      },
    );
  };

  it('merges a new neighbor against the checked-out town, and needs a PR to check', () => {
    const { directory, sha } = checkout({ 'home.json': '{"creator":"neighbor"}' }, [
      'auto-merge.mjs',
      'auto-merge-github.mjs',
      'pr-policy.mjs',
    ]);
    const repo = '/repos/o/r';
    const replies = {
      [repo]: { default_branch: 'main' },
      [`${repo}/pulls`]: [pull(1, 'newcomer')],
      [`${repo}/pulls/1`]: pull(1, 'newcomer'),
      [`${repo}/pulls/1/files`]: [{ filename: 'places/newcomer.json', status: 'added', sha: BLOB }],
      [`${repo}/pulls/1/reviews`]: [],
      [`${repo}/git/blobs/${BLOB}`]: {
        encoding: 'base64',
        size: 22,
        content: Buffer.from('{"creator":"newcomer"}').toString('base64'),
      },
      [`${repo}/commits/${HEAD}/check-runs`]: { total_count: 1, check_runs: [checkRun('check')] },
      [`${repo}/commits/${HEAD}/status`]: { total_count: 1, statuses: STATUSES },
      [`${repo}/git/ref/heads/main`]: { object: { sha } },
      [`${repo}/compare/${sha}...${HEAD}`]: { behind_by: 0 },
      [`${repo}/pulls/1/merge`]: { merged: true },
      [`${repo}/statuses/${HEAD}`]: {},
      [`${repo}/actions/workflows/pages.yml/dispatches`]: {},
    };
    const merged = runStep(directory, replies);
    expect(merged.status, merged.stderr).toBe(0);
    expect(merged.stdout).toContain(
      `PUT ${repo}/pulls/1/merge {"sha":"${HEAD}","merge_method":"squash","commit_title":"Add my house (#1)"}`,
    );
    expect(merged.stdout).toContain(`POST ${repo}/actions/workflows/pages.yml/dispatches`);

    // The existing neighbor's second house waits for a maintainer, and the run still passes.
    const second = runStep(directory, {
      ...replies,
      [`${repo}/pulls/1`]: pull(1, 'Neighbor'),
    });
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).not.toContain('/merge');
    expect(second.stdout).toContain('"state":"failure"');

    const nothing = runStep(directory, replies, { HEAD_SHA: '' });
    expect(nothing.status).toBe(1);
    expect(nothing.stderr).toContain('PR_NUMBER or HEAD_SHA');
  });
});
