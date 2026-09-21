import type { Place } from '../lib/schema';
import { compileSign, type SignArtwork, type SignLine } from '../lib/sign';

export const SIGN_WIDTH = 240;
export const SIGN_HEIGHT = 100;
const cache = new Map<string, SignArtwork>();

export function signArtwork(sign: Place['sign']): SignArtwork | null {
  if (sign.mode === 'none') return null;
  const key = JSON.stringify(sign);
  const cached = cache.get(key);
  if (cached) return cached;
  let art: SignArtwork;
  try {
    if (sign.mode === 'html') art = compileSign(sign.html);
    else {
      let lines = [sign.text];
      // Give long names two balanced lines instead of squeezing their letters.
      const spaces = [...sign.text.matchAll(/\s+/g)].map((match) => match.index!);
      if (sign.text.length > 12 && spaces.length) {
        const split = spaces.reduce((best, index) =>
          Math.abs(index - sign.text.length / 2) < Math.abs(best - sign.text.length / 2)
            ? index
            : best,
        );
        lines = [sign.text.slice(0, split).trim(), sign.text.slice(split).trim()];
      }
      art = {
        background: sign.background,
        lines: lines.map((text) => ({
          text,
          color: sign.color,
          size: 28,
          bold: true,
          align: 'center',
        })),
      };
    }
  } catch {
    art = {
      background: '#5C534E',
      lines: [{ text: 'Your sign', color: '#FFF4D4', size: 24, bold: true, align: 'center' }],
    };
  }
  if (cache.size >= 150) cache.clear();
  cache.set(key, art);
  return art;
}

export const signFont = (line: SignLine, scale = 1) =>
  `${line.bold ? 700 : 400} ${line.size * scale}px Arial, sans-serif`;
export function layoutSign(art: SignArtwork, measure: (line: SignLine) => number) {
  const gap = 6;
  const height = art.lines.reduce((sum, line) => sum + line.size, 0) + gap * (art.lines.length - 1);
  const widest = Math.max(1, ...art.lines.map(measure));
  const scale = Math.min(2, 220 / widest, 80 / height);
  let y = (SIGN_HEIGHT - height * scale) / 2;
  return art.lines.map((line) => {
    const positioned = {
      ...line,
      scale,
      x: line.align === 'left' ? 10 : line.align === 'right' ? 230 : 120,
      y: y + (line.size * scale) / 2,
    };
    y += (line.size + gap) * scale;
    return positioned;
  });
}

// Draw vector lettering at the destination transform. The map zoom and display
// pixel ratio now control its resolution, rather than a tiny resampled bitmap.
export function drawSign(
  ctx: CanvasRenderingContext2D,
  sign: Place['sign'],
  width = SIGN_WIDTH,
  height = SIGN_HEIGHT,
) {
  const art = signArtwork(sign);
  if (!art) return;
  ctx.save();
  ctx.scale(width / SIGN_WIDTH, height / SIGN_HEIGHT);
  ctx.fillStyle = art.background;
  ctx.fillRect(0, 0, SIGN_WIDTH, SIGN_HEIGHT);
  ctx.beginPath();
  ctx.rect(0, 0, SIGN_WIDTH, SIGN_HEIGHT);
  ctx.clip();
  const lines = layoutSign(art, (line) => {
    ctx.font = signFont(line);
    return ctx.measureText(line.text).width;
  });
  ctx.textBaseline = 'middle';
  for (const line of lines) {
    ctx.font = signFont(line, line.scale);
    ctx.fillStyle = line.color;
    ctx.textAlign = line.align;
    ctx.fillText(line.text, line.x, line.y);
  }
  ctx.restore();
}
