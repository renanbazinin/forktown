import { useEffect, useRef } from 'react';
import { drawErrandItem } from '../city/errand-items';
import type { ErrandKind, ErrandVisual } from '../lib/seasonal-errands';
import '../errands.css';

/** The actual world object, enlarged two times on a quiet paper tile. The fixed backing scale
 * keeps its original pixels crisp; the neighboring activity text supplies its accessible name. */
export default function ErrandItemPreview({ kind }: { kind: ErrandKind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 88, 88);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.scale(2, 2); // Two backing pixels for each CSS pixel.
    ctx.translate(22, 39);
    ctx.scale(2, 2); // Each original art pixel occupies exactly two CSS pixels.
    drawErrandItem(ctx, kind, 0, 0);
    ctx.restore();
  }, [kind]);
  return (
    <canvas ref={ref} width={88} height={88} className="errand-item-preview" aria-hidden="true" />
  );
}

/** Show a visual key only while the followed neighbor handles or carries the real object. */
export function FollowErrandItem({ errand }: { errand?: ErrandVisual }) {
  return errand && errand.phase !== 'outbound' && errand.phase !== 'returning' ? (
    <ErrandItemPreview kind={errand.kind} />
  ) : null;
}
