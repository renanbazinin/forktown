import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { MARK_COLORS, MARK_PIXELS } from '../src/lib/brand';

// The home-screen icon: the mark at 5x on a full day tile, 180 x 180 as iOS asks. iOS
// rounds the corners itself, so the tile has none. Run `npx tsx scripts/touch-icon.ts`
// after changing the mark; tests/brand.test.ts checks the icon still matches it.
export const TOUCH_ICON_SIZE = 180;
const SCALE = 5;
const INSET = (TOUCH_ICON_SIZE - 32 * SCALE) / 2;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Raw PNG scanlines: a 0 (no filter) byte, then RGB pixels, for each row. */
export function touchIconScanlines() {
  const size = TOUCH_ICON_SIZE;
  const pixels = Array.from({ length: size * size }, () => rgb(MARK_COLORS.day.tile));
  for (const [x, y, w, h, color] of MARK_PIXELS)
    for (let py = y * SCALE; py < (y + h) * SCALE; py++)
      for (let px = x * SCALE; px < (x + w) * SCALE; px++)
        pixels[(py + INSET) * size + px + INSET] = rgb(MARK_COLORS.day[color]);
  const rows = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) rows.set(pixels[y * size + x], y * (1 + size * 3) + 1 + x * 3);
  return rows;
}

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function touchIconPng() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(TOUCH_ICON_SIZE, 0);
  header.writeUInt32BE(TOUCH_ICON_SIZE, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(touchIconScanlines(), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/touch-icon.ts'))
  writeFileSync(new URL('../public/apple-touch-icon.png', import.meta.url), touchIconPng());
