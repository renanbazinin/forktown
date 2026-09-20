import { useEffect, useRef } from 'react';
import { drawBuilding } from '../city/render';
import { houseBounds, type HouseAppearance } from '../city/houses';

export default function BuildingPreview({
  place,
  size = 140,
  night = false,
}: {
  place: HouseAppearance;
  size?: number;
  night?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.imageSmoothingEnabled = false;
    const { top, bottom, left, right } = houseBounds(place);
    const scale = size / Math.max(left + right + 10, top + bottom + 14);
    const baseline = (size - (top + bottom) * scale) / 2 + top * scale;
    drawBuilding(ctx, place, size / 2, baseline, night, scale);
  }, [place, size, night]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
