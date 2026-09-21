import { describe, expect, it } from 'vitest';
import { layoutSign, signArtwork } from '../src/city/signs';
import { compileSign } from '../src/lib/sign';
import type { Place } from '../src/lib/schema';

const sign: Place['sign'] = {
  mode: 'text',
  text: 'MAKE SOMETHING',
  color: '#FFF4D4',
  background: '#4C5E6C',
  html: '',
};
describe('Readable sign artwork', () => {
  it('balances long labels without squeezing or losing their words', () => {
    const art = signArtwork(sign)!;
    expect(art.lines.map((line) => line.text)).toEqual(['MAKE', 'SOMETHING']);
    expect(signArtwork({ ...sign, text: 'HELLO, WORLD!' })!.lines.map((line) => line.text)).toEqual(
      ['HELLO,', 'WORLD!'],
    );
    expect(signArtwork({ ...sign, text: 'CAFÉ' })!.lines).toHaveLength(1);
  });
  it('fits all three maximum-size HTML lines inside the board with padding', () => {
    const art = compileSign('<div style="font-size:28px"><p>ONE</p><p>TWO</p><p>THREE</p></div>');
    const lines = layoutSign(art, (line) => line.text.length * line.size * 0.6);
    expect(lines).toHaveLength(3);
    expect(lines[0].y - (lines[0].size * lines[0].scale) / 2).toBeGreaterThanOrEqual(9.99);
    expect(lines[2].y + (lines[2].size * lines[2].scale) / 2).toBeLessThanOrEqual(90.01);
  });
  it('fits a long unbroken word proportionally, keeping text style hierarchy', () => {
    const art = compileSign(
      '<div><strong style="font-size:28px">ABCDEFGHIJKLMNOPQRSTUVWX</strong><p style="font-size:12px">Small caption</p></div>',
    );
    const measure = (line: (typeof art.lines)[number]) => line.text.length * line.size * 0.6;
    const lines = layoutSign(art, measure);
    for (const line of lines) expect(measure(line) * line.scale).toBeLessThanOrEqual(220.000001);
    expect(lines[0].scale).toBe(lines[1].scale);
    expect(lines[0].size / lines[1].size).toBe(28 / 12);
  });
  it('keeps disabled signs absent and unsupported HTML inert', () => {
    expect(signArtwork({ ...sign, mode: 'none' })).toBeNull();
    expect(
      signArtwork({ ...sign, mode: 'html', html: '<script>alert(1)</script>' })!.lines[0].text,
    ).toBe('Your sign');
  });
});
