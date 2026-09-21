import { execFileSync } from 'node:child_process';

/** Most recently added first, following the town's merge history rather than file edits. */
export function readArrivalOrder(root: string): string[] {
  try {
    const git = (args: string[]) =>
      execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000,
      }).trim();
    // A shallow checkout presents every old file as newly added. Prefer no claim to a false one.
    if (git(['rev-parse', '--is-shallow-repository']) === 'true') return [];
    const history = git([
      'log',
      '--first-parent',
      '--diff-filter=A',
      '--format=',
      '--name-only',
      '--',
      'places/',
    ]);
    return [
      ...new Set(
        history.split(/\r?\n/).flatMap((path) => {
          const match = /^places\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(path);
          return match ? [match[1]] : [];
        }),
      ),
    ];
  } catch {
    // Downloaded source archives may not have Git metadata.
    return [];
  }
}
