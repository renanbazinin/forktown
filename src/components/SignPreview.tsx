import { useEffect, useRef } from 'react';
import type { Place } from '../lib/schema';
import { compileSign } from '../lib/sign';
import { signTexture } from '../city/houses';

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
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 240, 100);
    const texture = signTexture(sign);
    if (texture) ctx.drawImage(texture, 0, 0);
  }, [sign]);
  if (sign.mode === 'none') return null;
  return (
    <canvas
      ref={ref}
      width={240}
      height={100}
      role="img"
      aria-label={`Exterior sign: ${lettering}`}
    />
  );
}
