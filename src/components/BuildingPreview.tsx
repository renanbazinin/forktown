import { useEffect, useRef } from 'react';
import { drawBuilding } from '../city/render';
import { houseBounds, type HouseAppearance } from '../city/houses';

type Observer = typeof IntersectionObserver;
/**
 * Runs `paint` once `element` comes within 200 px of the view, then stops watching; at once where
 * nothing can tell (no IntersectionObserver: server rendering, an old browser). Returns the
 * cleanup. A full town's directory mounts a row per house, so its previews paint as they scroll
 * near, not all 230 in one task with a canvas each.
 */
export function paintWhenNear(
  element: Element,
  paint: () => void,
  Watch: Observer | undefined = globalThis.IntersectionObserver,
): () => void {
  if (typeof Watch === 'undefined') {
    paint();
    return () => {};
  }
  const observer = new Watch(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      paint();
    },
    { rootMargin: '200px' },
  );
  observer.observe(element);
  return () => observer.disconnect();
}

export default function BuildingPreview({
  place,
  size = 140,
  night = false,
  lazy = false,
}: {
  place: HouseAppearance;
  size?: number;
  night?: boolean;
  /** Paint only once near the view (a directory row); otherwise at once. */
  lazy?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      // The backing store grows only when it paints: until then it is the default 48 x 48.
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
    };
    if (!lazy) {
      paint();
      return;
    }
    return paintWhenNear(canvas, paint);
  }, [place, size, night, lazy]);
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
