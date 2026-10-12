import { describe, expect, it } from 'vitest';
import { signArtwork } from '../src/city/signs';
import { compileSign, SIGN_EXAMPLE } from '../src/lib/sign';
import { placeSchema, type Place } from '../src/lib/schema';
import { AFTER_HOURS } from './fixtures';

const sign: Place['sign'] = {
  mode: 'text',
  text: 'MAKE SOMETHING',
  color: '#FFF4D4',
  background: '#4C5E6C',
  html: '',
};
describe('Readable sign artwork', () => {
  it('keeps disabled signs absent and unsupported HTML inert', () => {
    expect(signArtwork({ ...sign, mode: 'none' })).toBeNull();
    expect(
      signArtwork({ ...sign, mode: 'html', html: '<script>alert(1)</script>' })!.lines[0].text,
    ).toBe('Your sign');
  });
});

describe('Exterior artwork is data, not a webpage', () => {
  it('compiles text, inherited styles and character entities into drawing instructions', () => {
    const art = compileSign(SIGN_EXAMPLE);
    expect(art.background).toBe('#35554A');
    expect(art.lines).toHaveLength(2);
    expect(art.lines[0]).toMatchObject({
      text: 'HELLO, NEIGHBOR',
      size: 24,
      bold: true,
      color: '#FFF4D4',
    });
    expect(compileSign('<p>Tea &amp; cake</p>').lines[0].text).toBe('Tea & cake');
  });
  it.each([
    '<script>alert(1)</script>',
    '<img src="https://example.com/pixel">',
    '<a href="javascript:alert(1)">Hello</a>',
    '<svg onload="alert(1)"></svg>',
    '<div onclick="alert(1)">Hi</div>',
    '<iframe srcdoc="hello"></iframe>',
    '<div style="background-image: url(https://example.com)">Hi</div>',
    '<div style="color: var(--secret)">Hi</div>',
    '<form>Hi</form>',
    '<style>@import "https://example.com";</style>',
    '<div style="position:fixed">Hi</div>',
    '<span style="font-size:999px">Hi</span>',
    '<div id="town">Hi</div>',
  ])('rejects executable, external or unbounded markup: %s', (html) => {
    expect(() => compileSign(html)).toThrow();
    expect(
      placeSchema.safeParse({ ...AFTER_HOURS, sign: { ...AFTER_HOURS.sign, mode: 'html', html } })
        .success,
    ).toBe(false);
  });
  it('bounds source size, nesting, line count and line length', () => {
    for (const html of [
      'x'.repeat(2001),
      '<div>'.repeat(10) + 'Hi' + '</div>'.repeat(10),
      '<p>Hi</p>'.repeat(4),
      '<p>' + 'x'.repeat(25) + '</p>',
    ])
      expect(() => compileSign(html)).toThrow();
  });
  it('preserves escaped markup as harmless text', () => {
    expect(compileSign('<p>&lt;script&gt;</p>').lines[0].text).toBe('<script>');
  });
});
