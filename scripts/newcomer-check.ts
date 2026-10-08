// npm run check:newcomers [-- [--plots C7,K12 | --all] [--house file.json] [--shards n]
//                              [--workers n] [--tests tests/a.test.ts,tests/b.test.ts] [--keep]]
//
// What a newcomer's pull request meets in CI, on a sample of free plots: for each plot it moves
// one house in as the town's newest arrival and runs every test that reads the town. It clones
// the repository into a temporary folder (sharing its Git objects, so a clone takes a moment),
// carries over any uncommitted changes as one commit, and links node_modules there (a junction on
// Windows, a symlink elsewhere). For every plot it writes the house and commits it, so the town's
// arrival order (read from Git history, as check.yml's checkout reads it) sees the house as the
// newest neighbor. Then it validates the town, runs the tests, and resets the commit away. Once
// every plot has run, each plot's failing test files run once more, one plot at a time with every
// worker, to tell a timeout on a busy machine from a real failure; a test that only ran out of
// time is marked "(timed out)".
//
// The house keeps the builder's defaults ("My Little Place", "New neighbor", the examples' story,
// the HELLO sign), with a resident who strolls every period and walks at night, the busiest a
// resident can be. Its file, a-new-home.json, sorts first in places/. `--house` takes a
// contributor's own file instead, moved to each plot checked.
//
// The plots: by default the free plot nearest to each of SAMPLE_ANCHORS, spread over the map;
// `--plots` names them; `--all` takes every free house plot (hours, not minutes).
// The tests: every test file that reads places/ or the arrival order, itself or through its
// imports; `--tests` names them instead.
//
// Too slow for CI: a few minutes a plot on a quiet machine, with several plots at once (by default
// a quarter as many as there are processors, each with its share of workers). Run it before
// merging a change to the simulation, the map or the venues, and with `--all` before the town
// grows; with other test runs going on the same machine, use fewer `--shards`. It prints a line
// per plot and a summary, and exits non-zero if any plot failed validation or a test that also
// failed its retry. `--keep` leaves the temporary clones in place and prints where they are.
import { spawn, spawnSync, type SpawnSyncOptions } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HOUSE_PLOTS } from '../src/lib/events.ts';
import { openPlotsNear, placeSchema, validatePlaces, type Place } from '../src/lib/schema.ts';
import { readPlaces } from '../tests/full-town.ts';
import { builderDefaultHouse } from './newcomer-houses.ts';
import { readPlaceFiles, withoutBom } from './place-files.ts';

/**
 * Where the default sample looks: the free plot nearest to each, so the sample follows the town
 * as it fills. Beside the Treeline's halts, Market Square, the Boat Landing and the Farm, and in
 * the far corners, where trips are longest.
 */
export const SAMPLE_ANCHORS = [
  'R2', // beside Barley Halt, the Treeline's south-west end
  'A10', // beside Hawthorn Halt, on the north edge
  'D13', // by Market Square and Watercress Halt
  'H14', // by the Boat Landing and the river walk
  'R11', // by Moon Harvest Farm, on the way to the snowmen's lunch
  'S15', // beside Bulrush Halt, in the south-east corner
  'A15', // the north-east corner
  'T1', // the south-west corner
] as const;

/** The plots the default sample checks: each anchor's nearest open plot, a different one each. */
export function samplePlots(
  taken: ReadonlySet<string>,
  anchors: readonly string[] = SAMPLE_ANCHORS,
): string[] {
  const chosen: string[] = [];
  for (const anchor of anchors) {
    const [plot] = openPlotsNear(anchor, new Set([...taken, ...chosen]), 1);
    if (plot) chosen.push(plot);
  }
  return chosen;
}

/** The newcomer on a plot: the builder's defaults, or a contributor's own house moved there. */
export function newcomerHouse(plot: string, template?: Place): Place {
  return template
    ? placeSchema.parse({ ...template, plot })
    : builderDefaultHouse(plot, 'a-new-home', 'newcomer-check');
}

// What reads the town: house files, the arrival order, or the helpers that read them.
const ROSTER_SOURCES = [
  /import\.meta\.glob\([^)]*places\//,
  /readdirSync\(\s*['"`][^'"`]*places/,
  /['"`](\.\.\/)*places\/[^'"`]*\.json/,
  /readPlaces\s*\(/,
  /__TOWN_ARRIVAL/,
  /readArrival|arrivalDates\(/,
];
const IMPORTS =
  /(?:import|export)[^'"`;]*?from\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)|import\s*['"](\.[^'"]+)['"]/g;

/**
 * Every test file that reads the town: one that reads places/ or the arrival order itself, or
 * imports, at any depth, a module that does. Paths relative to `root`, with forward slashes.
 */
export function rosterTests(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name !== 'node_modules') walk(path);
      } else if (/\.(ts|tsx|mts|js|mjs)$/.test(name)) files.push(resolve(path));
    }
  };
  for (const dir of ['src', 'tests', 'scripts'])
    if (existsSync(join(root, dir))) walk(join(root, dir));
  const roots = new Set<string>();
  const imports = new Map<string, string[]>();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (ROSTER_SOURCES.some((pattern) => pattern.test(text))) roots.add(file);
    const deps: string[] = [];
    for (const match of text.matchAll(IMPORTS)) {
      const base = resolve(dirname(file), match[1] || match[2] || match[3]);
      const found = [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}.js`].find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
      );
      if (found) deps.push(found);
    }
    imports.set(file, deps);
  }
  const memo = new Map<string, boolean>();
  const reads = (file: string, stack = new Set<string>()): boolean => {
    if (memo.has(file)) return memo.get(file)!;
    if (stack.has(file)) return false;
    stack.add(file);
    const result = roots.has(file) || (imports.get(file) ?? []).some((dep) => reads(dep, stack));
    stack.delete(file);
    memo.set(file, result);
    return result;
  };
  return files
    .filter((file) => /[\\/]tests[\\/][^\\/]+\.test\.(ts|tsx|js)$/.test(file) && reads(file))
    .map((file) => relative(root, file).split(sep).join('/'))
    .sort();
}

type Failure = { file: string; test: string; timedOut: boolean };
type VitestReport = {
  testResults?: {
    name: string;
    assertionResults?: { fullName: string; status: string; failureMessages?: string[] }[];
  }[];
};

/**
 * The failed tests in a Vitest JSON report, by file; a file with no results failed to run. A test
 * that only ran out of time is marked, since a busy machine can do that on its own.
 */
export function reportFailures(report: string): Failure[] {
  try {
    const results: VitestReport = JSON.parse(readFileSync(report, 'utf8'));
    const name = (path: string) => path.replaceAll('\\', '/').replace(/^.*\/tests\//, 'tests/');
    return (results.testResults ?? []).flatMap((file) =>
      file.assertionResults?.length
        ? file.assertionResults
            .filter((test) => test.status === 'failed')
            .map((test) => ({
              file: name(file.name),
              test: test.fullName,
              timedOut: (test.failureMessages ?? []).some((message) =>
                /Test timed out in/.test(message),
              ),
            }))
        : [{ file: name(file.name), test: '(the file did not run)', timedOut: false }],
    );
  } catch {
    return [{ file: '-', test: 'Vitest wrote no report', timedOut: false }];
  }
}

async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const argv = process.argv.slice(2);
  const value = (name: string) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const list = (name: string) => value(name)?.split(',').filter(Boolean);
  const keep = argv.includes('--keep');
  const housePath = value('house');
  const template = housePath
    ? placeSchema.parse(JSON.parse(withoutBom(readFileSync(resolve(housePath), 'utf8'))))
    : undefined;

  const town = readPlaces(join(root, 'places'));
  const taken = new Set(town.map((place) => place.plot));
  const free = HOUSE_PLOTS.map((plot) => plot.id).filter((id) => !taken.has(id));
  const plots = argv.includes('--all') ? free : (list('plots') ?? samplePlots(taken));
  const refused = plots.filter((plot) => !free.includes(plot));
  if (refused.length || !plots.length) {
    console.error(`Not a free house plot in this town: ${refused.join(', ') || 'none given'}.`);
    process.exitCode = 1;
    return;
  }
  const tests = list('tests') ?? rosterTests(root);
  const cpus = availableParallelism();
  const shards = Math.max(
    1,
    Math.min(plots.length, Number(value('shards') ?? Math.max(1, Math.floor(cpus / 4)))),
  );
  const workers = Math.max(1, Number(value('workers') ?? Math.floor(cpus / shards)));
  const house = (plot: string) => newcomerHouse(plot, template);
  console.log(
    `${town.length} houses in town, ${free.length} free plots. Checking ${plots.length} ` +
      `(${plots.join(', ')}) with ${tests.length} test files, ${shards} at a time ` +
      `with ${workers} workers each. The newcomer: places/${house(plots[0]).id}.json.\n`,
  );

  const temp = mkdtempSync(join(tmpdir(), 'forktown-newcomers-'));
  // Nothing above the clones may pass for their Git repository.
  const env = { ...process.env, GIT_CEILING_DIRECTORIES: temp };
  const git = (cwd: string, args: string[]) => {
    const result = spawnSync(
      'git',
      [
        '-c',
        'user.name=Newcomer check',
        '-c',
        'user.email=newcomer-check@example.invalid',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'core.autocrlf=false',
        '-c',
        'gc.auto=0',
        ...args,
      ],
      { cwd, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 } satisfies SpawnSyncOptions,
    );
    if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
    return result.stdout.trim();
  };
  // The repository's changes not committed yet, so the check meets the code as it is now.
  const changed = git(root, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--no-renames',
  ])
    .split('\0')
    .filter(Boolean)
    .map((entry) => entry.slice(3));
  const head = git(root, ['rev-parse', 'HEAD']);
  const common = resolve(root, git(root, ['rev-parse', '--git-common-dir']));
  const clones: { dir: string; base: string }[] = [];
  let passed = false;

  try {
    for (let k = 0; k < shards; k++) {
      const clone = join(temp, `town-${k}`);
      git(temp, ['clone', '-q', '--shared', '--no-checkout', common, clone]);
      git(clone, ['checkout', '-q', '--detach', head]);
      for (const file of changed) {
        const from = join(root, file);
        if (existsSync(from) && statSync(from).isFile()) {
          mkdirSync(dirname(join(clone, file)), { recursive: true });
          copyFileSync(from, join(clone, file));
        } else rmSync(join(clone, file), { force: true });
      }
      if (changed.length) {
        git(clone, ['add', '-A']);
        git(clone, ['commit', '-q', '--no-verify', '--allow-empty', '-m', 'Changes not committed']);
      }
      // Linked only after Git has seen the clone, so Git never meets node_modules.
      symlinkSync(join(root, 'node_modules'), join(clone, 'node_modules'), 'junction');
      clones.push({ dir: clone, base: git(clone, ['rev-parse', 'HEAD']) });
    }

    const vitest = (clone: string, files: string[], report: string, maxWorkers: number) =>
      new Promise<void>((done) => {
        const child = spawn(
          process.execPath,
          [
            join(clone, 'node_modules', 'vitest', 'vitest.mjs'),
            'run',
            ...files,
            `--maxWorkers=${maxWorkers}`,
            '--reporter=json',
            `--outputFile=${report}`,
          ],
          { cwd: clone, stdio: 'ignore', env },
        );
        child.on('exit', () => done());
        child.on('error', () => done());
      });
    const seconds = (since: number) => Math.round((Date.now() - since) / 1000);

    /** Moves the newcomer in on `plot` as the newest arrival, runs `files`, and moves it out. */
    const withNewcomer = async (
      { dir: clone, base }: (typeof clones)[number],
      plot: string,
      files: string[],
      report: string,
      maxWorkers: number,
    ): Promise<{ errors: string[]; failed: Failure[] }> => {
      const place = house(plot);
      const file = `${place.id}.json`;
      try {
        writeFileSync(join(clone, 'places', file), `${JSON.stringify(place, null, 2)}\n`);
        git(clone, ['add', `places/${file}`]);
        git(clone, ['commit', '-q', '--no-verify', '-m', `Add ${place.id} on ${plot}`]);
        const read = await readPlaceFiles(pathToFileURL(join(clone, 'places') + sep));
        const errors = [...read.errors, ...validatePlaces(read.entries).errors];
        await vitest(clone, files, report, maxWorkers);
        return { errors, failed: reportFailures(report) };
      } catch (error) {
        // A step of the check itself failed, not a test: say so, and go on with the next plot.
        return { errors: [`The check could not run here: ${String(error)}`], failed: [] };
      } finally {
        git(clone, ['reset', '-q', '--hard', base]);
      }
    };

    type Result = { plot: string; errors: string[]; failed: Failure[]; flaky: Failure[] };
    const results: Result[] = [];
    const started = Date.now();
    // First every plot with every test, several plots at once.
    let next = 0;
    await Promise.all(
      clones.map(async (clone) => {
        while (next < plots.length) {
          const plot = plots[next++];
          const at = Date.now();
          const report = join(temp, `report-${plot}.json`);
          const { errors, failed } = await withNewcomer(clone, plot, tests, report, workers);
          results.push({ plot, errors, failed, flaky: [] });
          const verdict =
            errors.length || failed.length
              ? `${errors.length} validation problems, ${failed.length} tests to retry`
              : 'ok';
          console.log(
            `  ${plot.padEnd(4)} ${verdict}  ${seconds(at)}s  [${results.length}/${plots.length}]`,
          );
        }
      }),
    );
    // Then each plot's failing test files again, one plot at a time with every worker, so a test
    // that only ran out of time while the other plots ran gets a fair second run.
    for (const result of results) {
      const files = [...new Set(result.failed.map((failure) => failure.file))].filter((name) =>
        name.startsWith('tests/'),
      );
      if (!files.length) continue;
      const at = Date.now();
      const report = join(temp, `report-${result.plot}-retry.json`);
      const again = await withNewcomer(clones[0], result.plot, files, report, cpus);
      result.flaky = result.failed.filter(
        (one) => !again.failed.some((other) => other.file === one.file && other.test === one.test),
      );
      result.failed = again.failed;
      console.log(
        `  ${result.plot.padEnd(4)} retried ${files.length} test files: ` +
          `${result.failed.length ? `${result.failed.length} tests fail again` : 'all pass'}  ${seconds(at)}s`,
      );
    }

    console.log(
      `\nNewcomer check: ${plots.length} plots in ${(seconds(started) / 60).toFixed(1)} min`,
    );
    for (const result of results.sort((a, b) => plots.indexOf(a.plot) - plots.indexOf(b.plot))) {
      for (const error of result.errors) console.log(`  ${result.plot}  ! ${error}`);
      for (const failure of result.failed)
        console.log(
          `  ${result.plot}  x ${failure.file} > ${failure.test}${failure.timedOut ? ' (timed out)' : ''}`,
        );
      for (const failure of result.flaky)
        console.log(`  ${result.plot}  ~ ${failure.file} > ${failure.test} (passed on retry)`);
    }
    passed = results.every((result) => !result.errors.length && !result.failed.length);
    const slowOnly = results.every(
      (result) => !result.errors.length && result.failed.every((failure) => failure.timedOut),
    );
    console.log(
      passed
        ? '\nEvery newcomer settles in.'
        : slowOnly
          ? '\nOnly timeouts: run those plots again with --plots and --shards 1 on a quieter machine.'
          : '\nA newcomer needs a look.',
    );
  } catch (error) {
    console.error(error);
  } finally {
    if (keep) console.log(`Kept the clones in ${temp}`);
    else {
      // Unlink node_modules first, so cleaning up can never reach the real one.
      for (const { dir: clone } of clones)
        if (existsSync(join(clone, 'node_modules'))) unlinkSync(join(clone, 'node_modules'));
      try {
        rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
      } catch {
        console.error(`Could not remove ${temp}; delete it once nothing runs there.`);
      }
    }
  }
  process.exitCode = passed ? 0 : 1;
}

// Run as a script; tests import the helpers above without starting a check.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
