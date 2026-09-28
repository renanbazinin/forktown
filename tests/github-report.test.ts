import { describe, expect, it } from 'vitest';
import { annotation, filesNamed, oneLine, summary, workflowLog } from '../scripts/github-report';

type Command = { name: string; properties: Record<string, string>; message: string };

// Reads log lines the way the Actions runner does, and returns the commands that ran. A command is
// "::name properties::message" at the start of a line, or else the older "##[name]message"
// anywhere in it. Properties split at "," and "=", and escapes are undone with "%25" last. After
// "::stop-commands::token", nothing runs until "::token::".
function runnerReads(lines: readonly string[]) {
  const known = new Set(['error', 'warning', 'notice', 'debug', 'add-mask', 'stop-commands']);
  const unescape = (value: string, property = false) => {
    let text = value.replace(/%0D/g, '\r').replace(/%0A/g, '\n');
    if (property) text = text.replace(/%3A/g, ':').replace(/%2C/g, ',');
    return text.replace(/%25/g, '%');
  };
  const command = (info: string, message: string): Command | undefined => {
    const [name, ...rest] = info.split(' ');
    if (!known.has(name)) return undefined;
    const pairs = rest.join(' ').split(',').filter(Boolean);
    const properties = Object.fromEntries(
      pairs.map((pair) => [
        pair.slice(0, pair.indexOf('=')),
        unescape(pair.slice(pair.indexOf('=') + 1), true),
      ]),
    );
    return { name, properties, message };
  };
  const read = (line: string) => {
    const text = line.trimStart();
    const end = text.indexOf('::', 2);
    if (text.startsWith('::') && end >= 0) {
      const found = command(text.slice(2, end), unescape(text.slice(end + 2)));
      if (found) return found;
    }
    const start = line.indexOf('##[');
    const close = start < 0 ? -1 : line.indexOf(']', start);
    return close < 0 ? undefined : command(line.slice(start + 3, close), line.slice(close + 1));
  };
  const ran: Command[] = [];
  let paused: string | undefined;
  for (const line of lines) {
    const found = read(line);
    if (!found || (paused && found.name !== paused)) continue;
    if (paused) {
      known.delete(paused);
      paused = undefined;
    } else if (found.name === 'stop-commands') {
      paused = found.message;
      known.add(paused);
    }
    ran.push(found);
  }
  return ran;
}

const note = (file: string, message: string) => ({
  name: 'error',
  properties: { file: `places/${file}`, title: 'House file' },
  message,
});

describe('Notes on house files in a GitHub workflow', () => {
  it('puts each problem on its house file', () => {
    expect(annotation('moon-cafe.json', 'moon-cafe.json → plot: Choose a house plot.')).toBe(
      '::error file=places/moon-cafe.json,title=House file::moon-cafe.json → plot: Choose a house plot.',
    );
  });

  it.each([
    ['a,b:c.json', 'a,b:c.json: 100% sure, see: here'],
    ['%0A%25.json', '%0A%25.json: literally %0A and %25'],
    ['x\r\n::stop-commands::pause.json', 'x\r\n::stop-commands::pause.json: bad'],
    ['y.json', 'y.json: Unexpected token\n::stop-commands::pause\r\n::add-mask::secret'],
    ['z,title=Hacked::.json', 'z,title=Hacked::.json → story::error::: nope'],
    ['##[stop-commands]quiet.json', '##[stop-commands]quiet.json: Rename this file.'],
    ['k.json', 'k.json → file: Unrecognized key: "##[stop-commands]tok"'],
  ])('keeps a hostile file name or message inside one annotation: %j', (file, message) => {
    const line = annotation(file, message);
    expect(line).not.toMatch(/[\r\n]/);
    expect(runnerReads([line])).toEqual([note(file, message)]);
  });

  it('prints the messages while commands are paused, then the notes', () => {
    const names = ['##[stop-commands]quiet.json', 'k.json', 'y.json'];
    const errors = [
      '##[stop-commands]quiet.json: Rename this file to quiet.json so its name matches the id.',
      'k.json → file: Unrecognized key: "##[error]fake"',
      'y.json: This is not valid JSON. "##[add-mask]zz\n::stop-commands::x" is not valid JSON',
      'places/ must be a plain folder, not a link.',
    ];
    const log = workflowLog(errors, names, 'pause-token');
    const messages = log.slice(1, 1 + errors.length);
    expect(messages).toEqual(errors.map((error) => `  • ${oneLine(error)}`));
    expect(runnerReads(log)).toEqual([
      { name: 'stop-commands', properties: {}, message: 'pause-token' },
      { name: 'pause-token', properties: {}, message: '' },
      ...names.map((file, i) => note(file, errors[i])),
    ]);
    // On one line each, but without the pause the older form would still run.
    expect(messages.map((line) => runnerReads([line]).map((command) => command.name))).toEqual([
      ['stop-commands'],
      ['error'],
      ['add-mask'],
      [],
    ]);
  });

  it('pauses under a token no house file can know', () => {
    const [first, second] = [workflowLog(['a.json: oops'], []), workflowLog(['a.json: oops'], [])];
    const token = first[0].replace('::stop-commands::', '');
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    expect(first).toEqual([`::stop-commands::${token}`, '  • a.json: oops', `::${token}::`]);
    expect(second[0]).not.toBe(first[0]);
  });

  it('keeps every message in the log on one line', () => {
    expect(oneLine('a\r\nb\rc\nd')).toBe('a b c d');
  });

  it('finds the files a message is about', () => {
    const names = ['a.json', 'a.json.json', 'b.json', 'c.json'];
    expect(filesNamed('a.json → plot: Choose a house plot.', names)).toEqual(['a.json']);
    expect(filesNamed('a.json.json: Rename this file to a.json.', names)).toEqual(['a.json.json']);
    expect(filesNamed('Plot C6 is claimed by both "a.json" and "c.json". Pick C7.', names)).toEqual(
      ['a.json', 'c.json'],
    );
    expect(filesNamed('places/ must be a plain folder, not a link.', names)).toEqual([]);
  });

  it('lists the problems on the summary page without rendering any of them', () => {
    const page = summary([
      'a.json: say `hi`\n# not a heading',
      'b.json → name: <b>bold</b> @someone',
    ]);
    expect(page).toContain("### Let's fix 2 things in the house files");
    expect(page).toContain("- `a.json: say 'hi' # not a heading`\n");
    expect(page).toContain('- `b.json → name: <b>bold</b> @someone`\n');
    expect(page).toContain('`npm run validate`');
  });

  it('keeps a long list short', () => {
    const page = summary(Array.from({ length: 25 }, (_, i) => `h${i}.json: oops`));
    expect(page.match(/^- /gm)).toHaveLength(21);
    expect(page).toContain('- …and 5 more in the log');
  });
});
