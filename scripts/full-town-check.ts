// npm run check:full-town [-- [--keep] [vitest filters]]
//
// Runs the place validator and the whole test suite against a town with every house plot taken,
// so growth can never turn `npm run check` red for the next neighbor who moves in. It copies the
// repository's files (tracked, plus new files Git does not ignore) into a temporary folder, links
// node_modules there (a junction on Windows, a symlink elsewhere), and adds a made-up house from
// tests/full-town.ts on every free plot. places/ in the repository is never touched. It prints a
// summary naming every failing test, and exits non-zero if the validator or any test failed.
// Works on Windows, macOS and Linux; the whole suite takes a minute or two.
//
// Anything after `--` goes to Vitest, e.g. `npm run check:full-town -- tests/render-smoke.test.ts`.
// `--keep` leaves the temporary town in place and prints its path, for a closer look.
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fullTownNewcomers, readPlaces } from '../tests/full-town.ts';

type VitestReport = {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  testResults?: {
    name: string;
    assertionResults?: { fullName: string; status: string }[];
  }[];
};

const root = fileURLToPath(new URL('..', import.meta.url));
const keep = process.argv.includes('--keep');
const filters = process.argv.slice(2).filter((arg) => arg !== '--keep');
const temp = mkdtempSync(join(tmpdir(), 'forktown-full-town-'));
const town = join(temp, 'town');
const report = join(temp, 'vitest.json');
const modules = join(town, 'node_modules');
// Nothing above the copy may pass for its Git repository.
const options: SpawnSyncOptions = {
  cwd: town,
  stdio: 'inherit',
  env: { ...process.env, GIT_CEILING_DIRECTORIES: temp },
};

/** Runs an npm command in the copy, through the same npm that started this script. */
function npm(args: string[]) {
  const cli = process.env.npm_execpath;
  const result =
    cli && /\.[cm]?js$/.test(cli)
      ? spawnSync(process.execPath, [cli, ...args], options)
      : spawnSync(`npm ${args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ')}`, {
          ...options,
          shell: true,
        });
  return result.status === 0;
}

function readReport(): VitestReport {
  try {
    return JSON.parse(readFileSync(report, 'utf8'));
  } catch {
    return {};
  }
}

let passed = false;
try {
  const listed = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (listed.status !== 0) throw new Error(`git ls-files failed: ${listed.stderr}`);
  const files = listed.stdout.split('\0').filter((file) => file && existsSync(join(root, file)));
  for (const file of files) {
    mkdirSync(dirname(join(town, file)), { recursive: true });
    copyFileSync(join(root, file), join(town, file));
  }
  symlinkSync(join(root, 'node_modules'), modules, 'junction');

  const real = readPlaces(join(town, 'places'));
  const newcomers = fullTownNewcomers(real);
  for (const place of newcomers)
    writeFileSync(join(town, 'places', `${place.id}.json`), `${JSON.stringify(place, null, 2)}\n`);
  console.log(
    `\nA full town: ${real.length + newcomers.length} houses, ${real.length} real and ` +
      `${newcomers.length} made up on the free plots, in ${town}\n`,
  );

  const valid = npm(['run', 'validate']);
  const tested = npm([
    'run',
    'test',
    '--',
    '--reporter=default',
    '--reporter=json',
    `--outputFile.json=${report}`,
    ...filters,
  ]);
  passed = valid && tested;

  const results = readReport();
  // Vitest reports absolute paths, which may spell the temporary folder differently.
  const named = (path: string) =>
    files.find((file) => path.replaceAll('\\', '/').endsWith(`/${file}`)) ?? path;
  const failed = (results.testResults ?? []).flatMap((file) =>
    (file.assertionResults ?? [])
      .filter((test) => test.status === 'failed')
      .map((test) => `${named(file.name)} > ${test.fullName}`),
  );
  console.log(`\nFull town check (${real.length + newcomers.length} houses)`);
  console.log(`  validate  ${valid ? 'ok' : 'failed'}`);
  console.log(
    `  tests     ${results.numTotalTests === undefined ? 'no report' : `${results.numPassedTests} passed, ${results.numFailedTests} failed, ${results.numPendingTests} skipped`}`,
  );
  for (const test of failed) console.log(`    x ${test}`);
  console.log(passed ? '\nThe town has room for everyone.' : '\nThe full town needs a look.');
} catch (error) {
  console.error(error);
} finally {
  if (keep) console.log(`Kept the full town at ${town}`);
  else {
    // Unlink node_modules first, so cleaning up can never reach the real one.
    if (existsSync(modules)) unlinkSync(modules);
    rmSync(temp, { recursive: true, force: true });
  }
}
process.exitCode = passed ? 0 : 1;
