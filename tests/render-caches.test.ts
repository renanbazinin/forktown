import { afterEach, describe, expect, it, vi } from 'vitest';
import { fontReady } from '../src/city/font-check';
import { tint } from '../src/city/houses';
import { signArtwork } from '../src/city/signs';
import { compileSign } from '../src/lib/sign';
import type { Place } from '../src/lib/schema';
import { PLOTS } from '../src/lib/world';

vi.mock('../src/lib/sign', async (original) => {
  const sign = await original<typeof import('../src/lib/sign')>();
  return { ...sign, compileSign: vi.fn(sign.compileSign) };
});

// The small per-frame helpers a full town calls thousands of times: a colour shade, a sign's
// artwork and a font check are each worked out once, and their memory stays bounded.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Colour shades', () => {
  const reference = (color: string, delta: number) => {
    const n = parseInt(color.slice(1), 16);
    return (
      '#' +
      [n >> 16, (n >> 8) & 255, n & 255]
        .map((v) =>
          Math.max(0, Math.min(255, v + delta))
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    );
  };

  it('gives the same shades as before, working each one out only once', () => {
    const colors = ['#000000', '#FFFFFF', '#789B76', '#846C56', '#f0e5c8', '#0B1715'];
    const deltas = [-55, -35, -24, -9, 0, 12, 14, 30, 255, -255];
    for (const color of colors)
      for (const delta of deltas) expect(tint(color, delta)).toBe(reference(color, delta));
    const parse = vi.spyOn(globalThis, 'parseInt');
    for (let frame = 0; frame < 30; frame++)
      for (const color of colors) for (const delta of deltas) tint(color, delta);
    expect(parse).not.toHaveBeenCalled();
    tint('#123456', 7);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('forgets old colours rather than growing without bound', () => {
    for (let i = 0; i < 10_000; i++) tint(`#${i.toString(16).padStart(6, '0')}`, 5);
    // A colour from long ago is worked out again, and still correctly.
    const expected = reference('#000001', 5);
    const parse = vi.spyOn(globalThis, 'parseInt');
    expect(tint('#000001', 5)).toBe(expected);
    expect(parse).toHaveBeenCalledTimes(1);
  });
});

describe('Sign artwork', () => {
  const html = (i: number, shop = 'Shop'): Place['sign'] => ({
    mode: 'html',
    text: 'HELLO',
    color: '#FFF4D4',
    background: '#35554A',
    html: `<div><strong style="font-size:24px">${shop} ${i}</strong></div>`,
  });
  const compiled = () => vi.mocked(compileSign).mock.calls.length;

  it('reads each sign once, even in a town of more signs than the old cap of 150', () => {
    const count = Math.max(200, PLOTS.length);
    const signs = Array.from({ length: count }, (_, i) => html(i));
    const before = compiled();
    for (const sign of signs) signArtwork(sign);
    expect(compiled() - before).toBe(count);
    // Frame after frame the map finds every sign by identity, without serialising it.
    const stringify = vi.spyOn(JSON, 'stringify');
    for (let frame = 0; frame < 5; frame++) for (const sign of signs) signArtwork(sign);
    expect(stringify).not.toHaveBeenCalled();
    // The builder makes a fresh sign object on every keystroke: equal words share the artwork.
    for (let frame = 0; frame < 3; frame++) for (let i = 0; i < count; i++) signArtwork(html(i));
    expect(compiled() - before).toBe(count);
  });

  it('keeps a bounded number of signs by their words, dropping the least recently used', () => {
    const count = Math.max(256, PLOTS.length * 2);
    const before = compiled();
    signArtwork(html(-1, 'Stall'));
    for (let i = 0; i < count; i++) signArtwork(html(i, 'Stall'));
    // The newest signs are still known by their words; the oldest was let go.
    signArtwork(html(count - 1, 'Stall'));
    expect(compiled() - before).toBe(count + 1);
    signArtwork(html(-1, 'Stall'));
    expect(compiled() - before).toBe(count + 2);
  });

  it('keys text signs by what they show', () => {
    const sign: Place['sign'] = {
      mode: 'text',
      text: 'MOSS & TEA',
      color: '#FFF4D4',
      background: '#35554A',
      html: '',
    };
    const art = signArtwork(sign)!;
    expect(signArtwork({ ...sign, html: '<p>unused</p>' })).toBe(art);
    expect(signArtwork({ ...sign, color: '#000000' })).not.toBe(art);
    expect(signArtwork({ ...sign, text: 'MOSS & TEA ROOMS' })).not.toBe(art);
  });
});

describe('Font checks', () => {
  function fonts(status: FontFaceSetLoadStatus = 'loaded') {
    const set = { status, check: vi.fn(() => status === 'loaded') };
    vi.stubGlobal('document', { fonts: set });
    return set;
  }

  it('asks the browser once per font until fonts start or finish loading', () => {
    const set = fonts('loading');
    for (let i = 0; i < 20; i++) expect(fontReady('10px "Space Mono"')).toBe(false);
    expect(set.check).toHaveBeenCalledTimes(1);
    set.status = 'loaded';
    set.check.mockReturnValue(true);
    for (let i = 0; i < 20; i++) expect(fontReady('10px "Space Mono"')).toBe(true);
    fontReady('5px "Space Mono"');
    expect(set.check).toHaveBeenCalledTimes(3);
    // Another document's font set is asked afresh.
    const other = fonts();
    fontReady('10px "Space Mono"');
    expect(other.check).toHaveBeenCalledTimes(1);
  });

  it('has no answer without a document', () => {
    expect(fontReady('10px "Space Mono"')).toBeUndefined();
  });
});
