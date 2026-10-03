import { useEffect, useRef } from 'react';
import { drawErrandItem, errandItemHeight } from '../city/errand-items';
import type { ErrandKind, ErrandVisual } from '../lib/seasonal-errands';
import '../errands.css';

/** The actual world object, enlarged three times and centred on a quiet paper tile. The fixed
 * backing scale keeps its pixels crisp; the neighboring activity text supplies its name. */
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
    // Each art pixel is three CSS pixels, six backing pixels. The object's 66-pixel width runs
    // from 11 to 77 and its base sits half its height below the middle, on whole pixels.
    ctx.translate(41, 44 + 3 * errandItemHeight(kind));
    ctx.scale(6, 6);
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
