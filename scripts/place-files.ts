import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlaceEntry } from '../src/lib/schema';

/**
 * Reads every place file in a folder. Only plain files count: the build would follow a link or
 * read through a folder, so a house has to be exactly the file it looks like in the PR.
 */
export async function readPlaceFiles(directory: URL) {
  const folder = fileURLToPath(directory).replace(/[\\/]+$/, '');
  const entries: PlaceEntry[] = [];
  const errors: string[] = [];
  if (!(await lstat(folder)).isDirectory())
    return { files: 0, entries, errors: ['places/ must be a plain folder, not a link.'] };
  let files = 0;
  for (const name of (await readdir(folder)).sort()) {
    const file = join(folder, name);
    if (!(await lstat(file)).isFile()) {
      errors.push(
        `${name}: Keep only plain files in places/. Links and folders can make a house point somewhere else.`,
      );
      continue;
    }
    if (!name.endsWith('.json')) continue;
    files++;
    try {
      entries.push({ file: name, data: JSON.parse(await readFile(file, 'utf8')) });
    } catch (error) {
      errors.push(
        `${name}: This is not valid JSON. Check quotation marks, commas, and brackets. ${error instanceof Error ? error.message : ''}`,
      );
    }
  }
  return { files, entries, errors };
}
