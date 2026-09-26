import { describe, expect, it, vi } from 'vitest';
import { evaluatePolicy, paginate, approvedByMaintainer } from '../scripts/pr-policy.mjs';

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
