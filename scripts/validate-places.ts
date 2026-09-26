import { fileURLToPath } from 'node:url';
import { validatePlaces } from '../src/lib/schema';
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
  errors.forEach((error) => console.error(`  • ${error}`));
  process.exitCode = 1;
} else console.log(`All ${result.places.length} places look good. Welcome to the neighborhood!`);
