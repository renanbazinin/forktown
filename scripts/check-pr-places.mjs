import { execFileSync } from 'node:child_process';

// Read committed Git data only. Never import or execute files from the proposed PR.
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
try {
  const [baseRef, headRef] = process.argv.slice(2);
  if (!baseRef || !headRef || process.argv.length !== 4)
    throw new Error(
      'Usage: npm run check:pr -- <base-ref> <head-ref> (commit your changes first).',
    );
  const resolve = (ref) =>
    git('rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`).trim();
  const base = resolve(baseRef);
  const head = resolve(headRef);
  const ancestor = git('merge-base', base, head).trim();
  // Disable rename detection: new filenames count, even if another file was deleted.
  // Compare the whole branch, not just its latest commit or a net change in town size.
  const added = git(
    'diff',
    '--name-only',
    '-z',
    '--no-renames',
    '--diff-filter=A',
    ancestor,
    head,
    '--',
    'places/',
  )
    .split('\0')
    .filter((path) => /^places\/[^/]+\.json$/.test(path));
  if (added.length > 1) {
    console.error(
      `This PR adds ${added.length} house files. Each PR may add at most one house and its neighbor.`,
    );
    added.forEach((path) => console.error(`  - ${JSON.stringify(path)}`));
    throw new Error(
      'Keep one new file in places/ in this PR and move the others to separate PRs. Deleting an existing house does not increase the allowance.',
    );
  }
  console.log(
    `House allowance passed: ${added.length} new house file(s). Code, docs, and edits to existing houses are welcome too.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
