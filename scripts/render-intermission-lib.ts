// Pure helpers for scripts/render-intermission.ts: argument parsing, the segment list, the reel
// manifest, the WAV writer, the FFmpeg command and the list of places Chrome may live. No I/O, so
// all of it runs without Chrome or FFmpeg.
import { posix, win32 } from 'node:path';
import type { ReelSegment } from '../src/lib/break-cards';

/** The reel's picture: /live/'s 320×180 frame scaled 4× with no smoothing, 15 frames a second. */
export const REEL_FPS = 15;
export const REEL_WIDTH = 1280;
export const REEL_HEIGHT = 720;
/** The mix level for the reel, the same headroom the cinema's speakers leave the town. */
export const REEL_GAIN = 0.55;
export const JPEG_QUALITY = 0.92;
/** Segment ids and file names the stream box accepts (reel.mjs SEGMENT_ID, deploy.py REEL_FILE). */
export const SEGMENT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MANIFEST_FILE = 'manifest.json';

export const RENDER_USAGE = `Renders the live stream's intermission reel: one MP4 per segment plus manifest.json.

  npm run render:intermission -- --out <dir> [--only <id>[,<id>…]]

  --out <dir>   where <id>.mp4 and manifest.json go (created if missing)
  --only <id>   render only these segments (repeatable or comma-separated), e.g. right-back or
                ad-zoo; the manifest keeps earlier segments that are still current
  --help        show this text

Needs Chrome (or Edge; set CHROME_PATH to pick one) and ffmpeg on PATH.`;

export type RenderArgs = { out: string | null; only: string[] | null; help: boolean };

/** Parses `--out <dir>`, `--out=<dir>`, `--only a --only b`, `--only a,b` and `--help`. */
export function parseRenderArgs(argv: readonly string[]): RenderArgs {
  const args: RenderArgs = { out: null, only: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    const match = /^--(out|only)(?:=(.*))?$/.exec(arg);
    if (!match) throw new Error(`Unknown argument: ${arg}`);
    const value = match[2] ?? argv[++i];
    if (value === undefined || value === '' || (match[2] === undefined && value.startsWith('--'))) {
      throw new Error(`--${match[1]} needs a value`);
    }
    if (match[1] === 'out') {
      if (args.out !== null) throw new Error('--out given twice');
      args.out = value;
    } else {
      const ids = value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (!ids.length) throw new Error('--only needs a segment id');
      args.only = [...new Set([...(args.only ?? []), ...ids])];
    }
  }
  if (!args.help && args.out === null) throw new Error('--out <dir> is required');
  return args;
}

/** The segments to render, in reel order; unknown ids in `only` are an error that lists the real ones. */
export function selectSegments(
  all: readonly ReelSegment[],
  only: readonly string[] | null,
): ReelSegment[] {
  if (!only) return [...all];
  const known = new Set(all.map((segment) => segment.id));
  const unknown = only.filter((id) => !known.has(id));
  if (unknown.length) {
    throw new Error(
      `Unknown segment ${unknown.join(', ')}. The reel has: ${[...known].join(', ')}.`,
    );
  }
  return all.filter((segment) => only.includes(segment.id));
}

/** Differences between the segment list built in Node and the one the preview page reports. */
export function compareSegments(
  node: readonly ReelSegment[],
  page: readonly ReelSegment[],
): string[] {
  const key = (segment: ReelSegment) =>
    `${segment.id} ${segment.kind} ${segment.duration} s` +
    (segment.interruptibleAfter === undefined ? '' : ` from ${segment.interruptibleAfter} s`);
  const problems: string[] = [];
  const count = Math.max(node.length, page.length);
  for (let i = 0; i < count; i++) {
    const a = node[i] ? key(node[i]) : 'nothing';
    const b = page[i] ? key(page[i]) : 'nothing';
    if (a !== b) problems.push(`segment ${i}: Node has ${a}, the page has ${b}`);
  }
  return problems;
}

/** What a segment id plays: `right-back` is a card, `ad-<artwork>` an ad. */
export function segmentSource(
  segment: Pick<ReelSegment, 'id' | 'kind'>,
): { kind: 'card'; card: string } | { kind: 'ad'; artwork: string } {
  if (segment.kind === 'ad') {
    if (!segment.id.startsWith('ad-')) throw new Error(`Ad segment ${segment.id} must start "ad-"`);
    return { kind: 'ad', artwork: segment.id.slice(3) };
  }
  return { kind: 'card', card: segment.id };
}

export function segmentFile(id: string): string {
  if (!SEGMENT_ID.test(id)) throw new Error(`Segment id ${JSON.stringify(id)} is not a plain slug`);
  return `${id}.mp4`;
}

/** Frames 0…n−1 at t = k/fps: a segment never repeats its first frame at the end, so loops seam. */
export function frameCount(duration: number, fps = REEL_FPS): number {
  const frames = duration * fps;
  if (!Number.isInteger(frames) || frames <= 0) {
    throw new Error(`A ${duration} s segment is not a whole number of frames at ${fps} fps`);
  }
  return frames;
}

export type ManifestSegment = {
  id: string;
  kind: 'card' | 'ad';
  file: string;
  duration: number;
  interruptibleAfter?: number;
};
export type ReelManifest = {
  version: 1;
  fps: number;
  width: number;
  height: number;
  renderedAt: string;
  segments: ManifestSegment[];
};

const manifestSegment = (segment: ReelSegment): ManifestSegment => ({
  id: segment.id,
  kind: segment.kind,
  file: segmentFile(segment.id),
  duration: segment.duration,
  ...(segment.interruptibleAfter === undefined
    ? {}
    : { interruptibleAfter: segment.interruptibleAfter }),
});

/**
 * The manifest after a render, in reel order. Segments rendered now are always listed. With
 * `--only`, a segment rendered earlier stays only if the previous manifest listed it with the same
 * kind, duration and interruptibleAfter and its file is still there; `missing` names the rest.
 */
export function reelManifest(
  all: readonly ReelSegment[],
  rendered: ReadonlySet<string>,
  renderedAt: string,
  previous: unknown = null,
  fileExists: (file: string) => boolean = () => false,
): { manifest: ReelManifest; missing: string[] } {
  const earlier = new Map<string, string>();
  const prior = previous as Partial<ReelManifest> | null;
  if (
    prior &&
    prior.version === 1 &&
    prior.fps === REEL_FPS &&
    prior.width === REEL_WIDTH &&
    prior.height === REEL_HEIGHT &&
    Array.isArray(prior.segments)
  ) {
    for (const segment of prior.segments) {
      if (segment && typeof segment.id === 'string') {
        earlier.set(segment.id, JSON.stringify(segment));
      }
    }
  }
  const segments: ManifestSegment[] = [];
  const missing: string[] = [];
  for (const segment of all) {
    const entry = manifestSegment(segment);
    const kept = earlier.get(segment.id) === JSON.stringify(entry) && fileExists(entry.file);
    if (rendered.has(segment.id) || kept) segments.push(entry);
    else missing.push(segment.id);
  }
  return {
    manifest: {
      version: 1,
      fps: REEL_FPS,
      width: REEL_WIDTH,
      height: REEL_HEIGHT,
      renderedAt,
      segments,
    },
    missing,
  };
}

/** A 16-bit stereo PCM WAV of a mix at `gain`, clamped to full scale. */
export function encodeWav(
  mix: { left: Float32Array; right: Float32Array; sampleRate: number },
  gain = REEL_GAIN,
): Uint8Array {
  const frames = Math.min(mix.left.length, mix.right.length);
  const bytes = new Uint8Array(44 + frames * 4);
  const view = new DataView(bytes.buffer);
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + frames * 4, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 2, true); // stereo
  view.setUint32(24, mix.sampleRate, true);
  view.setUint32(28, mix.sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, frames * 4, true);
  const sample = (value: number) =>
    Math.round(Math.max(-1, Math.min(1, (Number.isFinite(value) ? value : 0) * gain)) * 32767);
  for (let i = 0; i < frames; i++) {
    view.setInt16(44 + i * 4, sample(mix.left[i]), true);
    view.setInt16(46 + i * 4, sample(mix.right[i]), true);
  }
  return bytes;
}

/**
 * FFmpeg: JPEG frames on stdin plus the WAV, into an H.264 (yuv420p, BT.601 limited range, tagged)
 * + AAC 44.1 kHz stereo MP4 of exactly `duration` seconds, moov first.
 */
export function ffmpegArgs(o: { wav: string; output: string; duration: number }): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'image2pipe',
    '-framerate',
    String(REEL_FPS),
    '-c:v',
    'mjpeg',
    '-i',
    'pipe:0',
    '-i',
    o.wav,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-vf',
    `scale=${REEL_WIDTH}:${REEL_HEIGHT}:flags=neighbor:out_color_matrix=bt601:out_range=tv,format=yuv420p`,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-tune',
    'animation',
    '-crf',
    '16',
    '-r',
    String(REEL_FPS),
    '-g',
    String(REEL_FPS * 2),
    '-colorspace',
    'smpte170m',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'iec61966-2-1',
    '-color_range',
    'tv',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ar',
    '44100',
    '-ac',
    '2',
    '-t',
    String(o.duration),
    '-map_metadata',
    '-1',
    '-movflags',
    '+faststart',
    '-f',
    'mp4',
    o.output,
  ];
}

const envValue = (env: Readonly<Record<string, string | undefined>>, name: string) => {
  const key = Object.keys(env).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  const value = key === undefined ? undefined : env[key];
  return value ? value : undefined;
};

/**
 * Where to look for a Chromium browser, most preferred first: CHROME_PATH, then Chrome in Program
 * Files, Program Files (x86) and the user's LOCALAPPDATA, then Edge; the app bundles on a Mac; the
 * usual names on PATH elsewhere. The caller takes the first that exists.
 */
export function chromeCandidates(
  platform: string,
  env: Readonly<Record<string, string | undefined>>,
): string[] {
  const list: string[] = [];
  const override = envValue(env, 'CHROME_PATH');
  if (override) list.push(override);
  if (platform === 'win32') {
    const roots = ['ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA']
      .map((name) => envValue(env, name))
      .filter((root): root is string => !!root);
    for (const root of roots)
      list.push(win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    for (const root of roots)
      list.push(win32.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  } else {
    if (platform === 'darwin') {
      list.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      );
    }
    const names = [
      'google-chrome-stable',
      'google-chrome',
      'chromium',
      'chromium-browser',
      'chrome-headless-shell',
      'microsoft-edge-stable',
      'microsoft-edge',
    ];
    const dirs = (envValue(env, 'PATH') ?? '/usr/local/bin:/usr/bin:/bin')
      .split(':')
      .filter(Boolean);
    for (const name of names) for (const dir of dirs) list.push(posix.join(dir, name));
  }
  return [...new Set(list)];
}

/** Chrome's `<profile>/DevToolsActivePort`: the port, then the browser's WebSocket path. */
export function parseDevToolsActivePort(text: string): { port: number; path: string } | null {
  const [portLine, pathLine] = text.split(/\r?\n/);
  const port = Number(portLine);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
  if (!pathLine?.startsWith('/devtools/browser/')) return null;
  return { port, path: pathLine.trim() };
}

/** "2 min 05 s" / "42.3 s". */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)} min ${String(whole % 60).padStart(2, '0')} s`;
}
