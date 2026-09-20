import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';

export type SignLine = {
  text: string;
  color: string;
  size: number;
  bold: boolean;
  align: CanvasTextAlign;
};
export type SignArtwork = { background: string; lines: SignLine[] };
type Node = DefaultTreeAdapterMap['node'];
const hex = /^#[0-9a-f]{6}$/i;

// This is an artwork language, never a DOM insertion or a browser document.
// Parse an allowlisted HTML/CSS subset into plain text drawing instructions.
export function compileSign(source: string): SignArtwork {
  if (source.length > 2000) throw new Error('Keep your sign HTML under 2,000 characters.');
  const document = parseFragment(source);
  const artwork: SignArtwork = { background: '#35554A', lines: [] };
  let count = 0;
  function walk(node: Node, style: Omit<SignLine, 'text'>, depth: number) {
    if (++count > 60 || depth > 8)
      throw new Error('Keep your sign simple: at most 60 elements and 8 levels.');
    if (node.nodeName === '#text') {
      const text = (node as DefaultTreeAdapterMap['textNode']).value.replace(/\s+/g, ' ').trim();
      if (text) artwork.lines.push({ text, ...style });
      return;
    }
    if (!('tagName' in node))
      throw new Error('Use only div, p, span, strong, b, and br in your sign.');
    if (!['div', 'p', 'span', 'strong', 'b', 'br'].includes(node.tagName))
      throw new Error(
        `The <${node.tagName}> element is not supported. Use div, p, span, strong, b, or br.`,
      );
    const next = { ...style, bold: style.bold || ['strong', 'b'].includes(node.tagName) };
    for (const attribute of node.attrs) {
      if (attribute.name !== 'style')
        throw new Error(
          `The ${attribute.name} attribute is not allowed. Only inline style is supported.`,
        );
      for (const declaration of attribute.value.split(';').filter((s) => s.trim())) {
        const [rawProperty, rawValue, extra] = declaration.split(':');
        const property = rawProperty.trim().toLowerCase(),
          value = rawValue?.trim() ?? '';
        if (extra !== undefined) throw new Error('Use simple inline CSS values.');
        if (property === 'color' && hex.test(value)) next.color = value;
        else if (property === 'background-color' && hex.test(value) && depth === 0)
          artwork.background = value;
        else if (property === 'font-size' && /^(12|16|20|24|28)px$/.test(value))
          next.size = parseInt(value);
        else if (property === 'font-weight' && ['normal', 'bold', '400', '700'].includes(value))
          next.bold = ['bold', '700'].includes(value);
        else if (property === 'text-align' && ['left', 'center', 'right'].includes(value))
          next.align = value as CanvasTextAlign;
        else
          throw new Error(
            `Unsupported CSS: ${property}. Use hex colors, font-size (12/16/20/24/28px), font-weight, or text-align. Set background-color on the outer div.`,
          );
      }
    }
    for (const child of node.childNodes) walk(child, next, depth + 1);
  }
  for (const child of document.childNodes)
    walk(child, { color: '#FFF4D4', size: 20, bold: false, align: 'center' }, 0);
  if (!artwork.lines.length) throw new Error('Add some text to your sign.');
  if (artwork.lines.length > 3 || artwork.lines.some((line) => line.text.length > 24))
    throw new Error('A sign has up to three text runs, with 24 characters per run.');
  return artwork;
}

export const SIGN_EXAMPLE =
  '<div style="background-color: #35554A; color: #FFF4D4; text-align: center">\n  <strong style="font-size: 24px">HELLO, NEIGHBOR</strong>\n  <p style="font-size: 12px">Make yourself at home</p>\n</div>';
