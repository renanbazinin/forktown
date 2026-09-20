import { useEffect, useRef } from 'react';
import type { Resident } from '../lib/schema';
import { drawResident } from '../city/residents';
export default function ResidentPreview({
  resident,
  size = 60,
}: {
  resident: Resident;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.imageSmoothingEnabled = false;
    drawResident(ctx, resident, size / 2, size * 0.87, size / 34);
  }, [resident, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />;
}
