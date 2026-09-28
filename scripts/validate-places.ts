import { appendFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validatePlaces } from '../src/lib/schema';
import { summary, workflowLog } from './github-report';
import { readPlaceFiles } from './place-files';

const directory = new URL('../places/', import.meta.url);
const { files, entries, errors: fileErrors } = await readPlaceFiles(directory);
const result = validatePlaces(entries);
const errors = [...fileErrors, ...result.errors];
if (files === 0) errors.push(`No place files found in ${fileURLToPath(directory)}.`);
if (errors.length) {
  console.error(
    `\nLet's fix ${errors.length} thing${errors.length === 1 ? '' : 's'} before your place opens:\n`,
  );
  // In a GitHub workflow, a house file can't run a command from the log, and each problem is
  // also noted on its file and on the job's summary page.
  if (process.env.GITHUB_ACTIONS === 'true') {
    const names = await readdir(directory).catch(() => []);
    workflowLog(errors, names).forEach((line) => console.error(line));
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(errors));
  } else errors.forEach((error) => console.error(`  • ${error}`));
  process.exitCode = 1;
} else console.log(`All ${result.places.length} places look good. Welcome to the neighborhood!`);
