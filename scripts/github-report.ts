import { randomUUID } from 'node:crypto';

// What the validator tells GitHub when it runs in a workflow: a note on each house file with a
// problem, and a short list on the job's summary page.
//
// House file names and messages come from the pull request, and the runner reads a command from
// any log line that starts with "::", or that holds "##[" anywhere. So the messages print while
// commands are paused, and the notes are escaped the way the runner decodes them.

/** Escapes a command's message: %, CR and LF. */
const escapeData = (text: string) =>
  text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

/** Escapes a command property, where ':' and ',' also mean something. */
const escapeProperty = (text: string) => escapeData(text).replace(/:/g, '%3A').replace(/,/g, '%2C');

/** An error annotation on a house file, which GitHub shows beside the file in the PR. */
export const annotation = (file: string, message: string) =>
  `::error file=${escapeProperty(`places/${file}`)},title=House file::${escapeData(message)}`;

/** A message on one log line. */
export const oneLine = (text: string) => text.replace(/\r\n?|\n/g, ' ');

/**
 * The files in places/ an error is about: the one it starts with, like every validator message,
 * or else each one it names in quotes, like a plot both files claim.
 */
export function filesNamed(error: string, names: readonly string[]) {
  const first = names
    .filter((name) => error.startsWith(`${name}:`) || error.startsWith(`${name} →`))
    .sort((a, b) => b.length - a.length)[0];
  return first ? [first] : names.filter((name) => error.includes(`"${name}"`));
}

/**
 * The log lines for the problems in a workflow. The messages sit between "::stop-commands::"
 * and a token no house file can know, so nothing in them runs, even the older "##[" form. The
 * notes on the files come after. Print every line to one stream: the runner reads stdout and
 * stderr separately, so a note on the other one could arrive while commands are still paused.
 */
export function workflowLog(
  errors: readonly string[],
  names: readonly string[],
  token: string = randomUUID(),
) {
  return [
    `::stop-commands::${token}`,
    ...errors.map((error) => `  • ${oneLine(error)}`),
    `::${token}::`,
    ...errors.flatMap((error) => filesNamed(error, names).map((file) => annotation(file, error))),
  ];
}

// The summary lists this many problems; the log has them all.
const SHOWN = 20;

/** Markdown for the job summary. Each message sits in a code span, so none of it renders. */
export function summary(errors: readonly string[]) {
  const lines = errors.slice(0, SHOWN).map((error) => `- \`${oneLine(error).replace(/`/g, "'")}\``);
  if (errors.length > SHOWN) lines.push(`- …and ${errors.length - SHOWN} more in the log`);
  return [
    `### Let's fix ${errors.length} thing${errors.length === 1 ? '' : 's'} in the house files`,
    '',
    ...lines,
    '',
    'Run `npm run validate` to check them again on your computer. It takes a couple of seconds.',
    '',
  ].join('\n');
}
