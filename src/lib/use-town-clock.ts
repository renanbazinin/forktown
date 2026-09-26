import { useEffect, useState } from 'react';
import { townDayAt, townMinutesAt } from './town-time';

/** Thirty town repaints a second: smooth walking, and room to breathe on a phone. */
export const PAINT_INTERVAL = 1000 / 30;
// Frame timestamps are rounded and wobble by a fraction of a millisecond, so two 60 Hz frames
// can land a hair under PAINT_INTERVAL apart. A little slack lets them count.
const PAINT_SLACK = 3;

/**
 * Whether a frame at `now` repaints, given the beat the last repaint kept: the new beat, or null.
 * The beat moves one interval at a time, nudged a quarter of the way toward the frame that
 * painted. It locks onto displays near a multiple of 30 Hz (every second frame at 60 Hz, every
 * fourth at 120) and still averages about thirty on the rest. After a stall it starts again from
 * now instead of repainting a burst of catch-up frames.
 */
export function paintBeat(now: number, beat: number): number | null {
  const elapsed = now - beat;
  if (elapsed < PAINT_INTERVAL - PAINT_SLACK) return null;
  return elapsed < 2 * PAINT_INTERVAL
    ? beat + PAINT_INTERVAL + (elapsed - PAINT_INTERVAL) / 4
    : now;
}

export function useTownClock({ autoPlay = false }: { autoPlay?: boolean } = {}) {
  // Keep day and minute in one snapshot, also while paused across midnight.
  const [timestamp, setTimestamp] = useState(() => Date.now());
  const [playing, setPlaying] = useState(
    () => autoPlay || !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      beat = -Infinity;
    const tick = (now: number) => {
      const next = document.hidden ? null : paintBeat(now, beat);
      if (next !== null) {
        setTimestamp(Date.now());
        beat = next;
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (!document.hidden) setTimestamp(Date.now());
    };
    sync();
    frame = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', sync);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [playing]);
  return { minutes: townMinutesAt(timestamp), day: townDayAt(timestamp), playing, setPlaying };
}
