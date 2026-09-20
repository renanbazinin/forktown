import { placeSchema } from '../src/lib/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { localPlacesMiddleware, localPlacesPlugin } from '../scripts/local-places';
import { resolveConfig } from 'vite';

const place = {
  id: 'tiny-library',
  name: '  Tiny Library  ',
  creator: 'new-neighbor',
  plot: 'A1',
  building: 'bookshop',
  color: '#759BAF',
  decoration: 'bench',
  story: 'A little library for very big ideas.',
};
const token = 'test-session-token';
let root: string;
let server: Server;
let origin: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'forktown-save-test-'));
  await mkdir(join(root, 'places'));
  const middleware = localPlacesMiddleware(root, token);
  server = createServer((req, res) =>
    middleware(req, res, () => {
      res.writeHead(404);
      res.end();
    }),
  );
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a local test port.');
  origin = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((done) => server.close(() => done()));
  const absolute = resolve(root);
  if (
    dirname(absolute) !== resolve(tmpdir()) ||
    !absolute.startsWith(join(resolve(tmpdir()), 'forktown-save-test-'))
  )
    throw new Error('Refusing to remove anything outside the generated test fixture.');
  await rm(absolute, { recursive: true, force: true });
});

function save(data: unknown = place, headers: Record<string, string> = {}) {
  return fetch(`${origin}/__forktown/places`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'X-Forktown-Token': token,
      ...headers,
    },
    body: typeof data === 'string' ? data : JSON.stringify(data),
  });
}

describe('Save a place to the local checkout', () => {
  it('creates one normalized, readable JSON file in the project’s places folder', async () => {
    const response = await save();
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ file: 'places/tiny-library.json' });
    const content = await readFile(join(root, 'places/tiny-library.json'), 'utf8');
    expect(content).toBe(JSON.stringify(placeSchema.parse(place), null, 2) + '\n');
    expect(await readdir(root)).toEqual(['places']);
  });

  it('never overwrites an existing file, even when the new data has changed', async () => {
    await save();
    const before = await readFile(join(root, 'places/tiny-library.json'), 'utf8');
    const response = await save({
      ...place,
      plot: 'A2',
      story: 'A different story for the same file.',
    });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('already exists');
    expect(await readFile(join(root, 'places/tiny-library.json'), 'utf8')).toBe(before);
  });

  it('checks the current files for occupied plots before saving a stale browser draft', async () => {
    await writeFile(
      join(root, 'places/another-library.json'),
      JSON.stringify({ ...place, id: 'another-library' }),
    );
    const response = await save();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('Plot A1');
    expect(await readdir(join(root, 'places'))).toEqual(['another-library.json']);
  });

  it('serializes simultaneous claims for the same plot and remains usable after a conflict', async () => {
    const responses = await Promise.all([save(), save({ ...place, id: 'second-library' })]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await readdir(join(root, 'places'))).toHaveLength(1);
    expect((await save({ ...place, id: 'third-library', plot: 'A2' })).status).toBe(201);
  });

  it.each([
    { ...place, id: '../escape' },
    { ...place, building: 'unknown' },
    { ...place, script: 'alert(1)' },
    { ...place, creator: 'FORKTOWN' },
  ])('rejects invalid data without creating a file: %j', async (data) => {
    expect((await save(data)).status).toBe(400);
    expect(await readdir(join(root, 'places'))).toEqual([]);
  });

  it('rejects malformed and oversized requests without creating a file', async () => {
    expect((await save('{invalid')).status).toBe(400);
    expect((await save(JSON.stringify({ ...place, story: 'x'.repeat(9000) }))).status).toBe(413);
    expect(await readdir(join(root, 'places'))).toEqual([]);
  });

  it('explains an existing malformed file instead of saving into an invalid town', async () => {
    await writeFile(join(root, 'places/broken.json'), '{bad');
    const response = await save();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('places/broken.json');
    expect(await readdir(join(root, 'places'))).toEqual(['broken.json']);
  });

  it.each<Record<string, string>>([
    { Origin: 'https://another-site.example' },
    { Origin: 'null' },
    { Origin: 'http://localhost:9999' },
    { 'X-Forktown-Token': '' },
    { 'X-Forktown-Token': 'wrong-token' },
    { 'Sec-Fetch-Site': 'cross-site' },
  ])('rejects requests outside the local builder session: %j', async (headers) => {
    expect((await save(place, headers)).status).toBe(403);
    expect(await readdir(join(root, 'places'))).toEqual([]);
  });

  it('accepts only explicit JSON saves and leaves other development routes alone', async () => {
    expect((await save(place, { 'Content-Type': 'text/plain' })).status).toBe(415);
    expect((await fetch(`${origin}/__forktown/places`)).status).toBe(405);
    expect((await fetch(`${origin}/unrelated`)).status).toBe(404);
    expect(await readdir(join(root, 'places'))).toEqual([]);
  });

  it('removes the local save capability from production builds', async () => {
    const config = await resolveConfig(
      { configFile: false, plugins: [localPlacesPlugin()] },
      'build',
    );
    expect(config.define?.__FORKTOWN_LOCAL_SAVE_TOKEN__).toBe('""');
  });
});
