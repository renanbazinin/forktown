import { useEffect, useState } from 'react';
import { townDayAt, townMinutesAt } from './town-time';

export function useTownClock() {
  // Keep day and minute in one snapshot, also while paused across midnight.
  const [timestamp, setTimestamp] = useState(() => Date.now());
  const [playing, setPlaying] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      lastPaint = -Infinity;
    const tick = (now: number) => {
      if (!document.hidden && now - lastPaint >= 1000 / 30) {
        setTimestamp(Date.now());
        lastPaint = now;
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
