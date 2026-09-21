import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { readArrivalOrder } from '../scripts/town-arrivals';

const folders: string[] = [];
const temporary = () => {
  const folder = mkdtempSync(join(tmpdir(), 'forktown-arrivals-'));
  folders.push(folder);
  return folder;
};
afterEach(() => {
  for (const folder of folders.splice(0)) {
    if (
      dirname(resolve(folder)) !== resolve(tmpdir()) ||
      !basename(folder).startsWith('forktown-arrivals-')
    )
      throw new Error('Unexpected temporary path');
    rmSync(folder, { recursive: true });
  }
});
function repository() {
  const root = temporary();
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git('init');
  git('config', 'user.name', 'Test Neighbor');
  git('config', 'user.email', 'neighbor@example.test');
  git('config', 'commit.gpgsign', 'false');
  mkdirSync(join(root, 'places'));
  const save = (name: string, value: string) => {
    writeFileSync(join(root, 'places', `${name}.json`), value);
    git('add', '.');
    git('commit', '-m', name);
  };
  return { root, save, git };
}

it('uses join order, not alphabetical order or later edits to older homes', () => {
  const { root, save, git } = repository();
  save('alpha', '{}');
  save('zebra', '{}');
  save('alpha', '{"edited":true}');
  expect(readArrivalOrder(root)).toEqual(['zebra', 'alpha']);
  git('rm', 'places/zebra.json');
  git('commit', '-m', 'Remove a place');
  expect(readArrivalOrder(root)).toEqual(['zebra', 'alpha']);
});

it('does not invent arrivals from the boundary of a shallow checkout', () => {
  const { root, save } = repository();
  save('alpha', '{}');
  save('zebra', '{}');
  const shallow = temporary();
  execFileSync('git', ['clone', '--depth', '1', pathToFileURL(root).href, shallow], {
    stdio: 'pipe',
  });
  expect(readArrivalOrder(shallow)).toEqual([]);
});

it('supports downloaded source without Git history', () => {
  expect(readArrivalOrder(temporary())).toEqual([]);
});
