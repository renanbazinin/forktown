import { useEffect, useRef } from 'react';
import type { Place } from '../lib/schema';
import { compileSign } from '../lib/sign';
import { drawSign, SIGN_WIDTH, SIGN_HEIGHT } from '../city/signs';

export default function SignPreview({ sign }: { sign: Place['sign'] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  let lettering = sign.text;
  if (sign.mode === 'html')
    try {
      lettering = compileSign(sign.html)
        .lines.map((line) => line.text)
        .join('. ');
    } catch {
      lettering = 'Unfinished artwork';
    }
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = Math.max(2, Math.min(window.devicePixelRatio || 1, 3));
    canvas.width = SIGN_WIDTH * ratio;
    canvas.height = SIGN_HEIGHT * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawSign(ctx, sign);
  }, [sign]);
  if (sign.mode === 'none') return null;
  return (
    <canvas
      ref={ref}
      width={240}
      height={100}
      style={{ width: SIGN_WIDTH, maxWidth: '100%', height: 'auto' }}
      role="img"
      aria-label={`Exterior sign: ${lettering}`}
    />
  );
}
