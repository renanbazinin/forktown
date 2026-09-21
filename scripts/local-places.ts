import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import type { Connect, Plugin } from 'vite';
import { placeSchema, validatePlaces } from '../src/lib/schema.ts';

const endpoint = '/__forktown/places';
const revealEndpoint = '/__forktown/reveal-place';
const maxBodyBytes = 8192;
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

class SaveError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function reply(res: ServerResponse, status: number, body: object) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

function trustedRequest(req: IncomingMessage, token: string) {
  if (!loopback.has(req.socket.remoteAddress ?? '')) return false;
  if (!token || req.headers['x-forktown-token'] !== token) return false;
  try {
    const origin = new URL(req.headers.origin ?? '');
    return (
      ['http:', 'https:'].includes(origin.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) &&
      origin.host === req.headers.host &&
      origin.origin === req.headers.origin &&
      (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin')
    );
  } catch {
    return false;
  }
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let exceeded = false;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (exceeded) return;
      if (size > maxBodyBytes) {
        exceeded = true;
        chunks.length = 0;
        reject(new SaveError(413, 'This place file is too large. Keep it to the builder fields.'));
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (exceeded) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new SaveError(400, 'This is not valid JSON. Return to your design and try again.'));
      }
    });
    req.on('error', reject);
    req.on('aborted', () => reject(new SaveError(400, 'The save request was interrupted.')));
  });
}

async function savePlace(root: string, data: unknown) {
  const parsed = placeSchema.safeParse(data);
  if (!parsed.success)
    throw new SaveError(400, parsed.error.issues.map((issue) => issue.message).join(' '));
  const place = parsed.data;
  if (place.creator.toLowerCase() === 'forktown')
    throw new SaveError(
      400,
      'Use your own GitHub username. Forktown is reserved for starter places.',
    );

  // Never follow a replaced places directory outside this checkout.
  const directory = join(await realpath(root), 'places');
  if ((await realpath(directory)) !== directory)
    throw new SaveError(409, 'The places folder must be a regular folder in this project.');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.json'));
  const filename = `${place.id}.json`;
  if (files.some((file) => file.toLowerCase() === filename.toLowerCase()))
    throw new SaveError(
      409,
      `${filename} already exists. Choose a different file id; nothing was overwritten.`,
    );

  const entries = [];
  for (const file of files) {
    try {
      entries.push({ file, data: JSON.parse(await readFile(join(directory, file), 'utf8')) });
    } catch {
      throw new SaveError(
        409,
        `Fix the unreadable JSON in places/${file} before adding another place.`,
      );
    }
  }
  const result = validatePlaces([...entries, { file: filename, data: place }]);
  if (result.errors.length) throw new SaveError(409, result.errors.join(' '));
  try {
    // Exclusive creation also protects against another writer creating this file mid-save.
    await writeFile(join(directory, filename), JSON.stringify(place, null, 2) + '\n', {
      flag: 'wx',
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new SaveError(409, `${filename} already exists. Nothing was overwritten.`);
    throw error;
  }
  return { file: `places/${filename}`, place };
}

// Pass arguments directly, never through a shell. Linux opens the containing folder.
function revealInFileManager(file: string): Promise<void> {
  const command =
    process.platform === 'win32'
      ? 'explorer.exe'
      : process.platform === 'darwin'
        ? 'open'
        : 'xdg-open';
  const args =
    process.platform === 'win32'
      ? ['/select,', file]
      : process.platform === 'darwin'
        ? ['-R', file]
        : [dirname(file)];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('close', (code) => {
      // Explorer can return 1 when it hands the request to an existing window.
      if (code === 0 || (process.platform === 'win32' && code === 1)) resolve();
      else reject(new Error('The file manager could not open.'));
    });
  });
}

async function revealPlace(root: string, data: unknown, reveal: (file: string) => Promise<void>) {
  const parsed = placeSchema.shape.id.safeParse(
    data && typeof data === 'object' && 'id' in data ? data.id : undefined,
  );
  if (!parsed.success) throw new SaveError(400, 'Choose a house file from the list.');
  const directory = join(await realpath(root), 'places');
  const file = join(directory, `${parsed.data}.json`);
  try {
    if ((await realpath(directory)) !== directory || (await realpath(file)) !== file)
      throw new SaveError(
        409,
        'The house file must be a regular file in this project’s places folder.',
      );
    if (!(await stat(file)).isFile())
      throw new SaveError(409, 'This house file is not a regular file.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new SaveError(404, 'This file is no longer in your places folder. Refresh the town.');
    throw error;
  }
  await reveal(file);
  return { file: `places/${parsed.data}.json` };
}

export function localPlacesMiddleware(
  root: string,
  token: string,
  reveal: (file: string) => Promise<void> = revealInFileManager,
): Connect.NextHandleFunction {
  // Serialize validation + creation so two tabs cannot claim the same plot at once.
  let pending: Promise<unknown> = Promise.resolve();
  return (req, res, next) => {
    const route = req.url?.split('?')[0];
    if (route !== endpoint && route !== revealEndpoint) return next();
    const revealing = route === revealEndpoint;
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return reply(res, 405, { error: 'Use the local town’s file buttons.' });
    }
    if (!trustedRequest(req, token))
      return reply(res, 403, {
        error: 'Open the town on this computer and refresh before trying again.',
      });
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json')
      return reply(res, 415, { error: 'The place must be sent as JSON.' });

    void readBody(req)
      .then((data) => {
        if (revealing) return revealPlace(root, data, reveal);
        const saving = pending.then(() => savePlace(root, data));
        pending = saving.catch(() => undefined);
        return saving;
      })
      .then((saved) => reply(res, revealing ? 200 : 201, saved))
      .catch((error: unknown) => {
        const known = error instanceof SaveError;
        reply(res, known ? error.status : 500, {
          error: known
            ? error.message
            : revealing
              ? 'Could not open your file manager. Find this file in your project’s places folder.'
              : 'Could not save the file. Check that the places folder is writable, then try again.',
        });
      });
  };
}

export function localPlacesPlugin(): Plugin {
  let token = '';
  return {
    name: 'forktown-local-places',
    config(_config, { command, isPreview }) {
      token = command === 'serve' && !isPreview ? randomBytes(32).toString('hex') : '';
      return { define: { __FORKTOWN_LOCAL_SAVE_TOKEN__: JSON.stringify(token) } };
    },
    configureServer(server) {
      server.middlewares.use(localPlacesMiddleware(server.config.root, token));
    },
  };
}
