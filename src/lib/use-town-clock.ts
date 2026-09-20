import { useEffect, useState } from 'react';
import { townMinutesAt } from './town-time';

export function useTownClock() {
  const [minutes, setMinutes] = useState(() => townMinutesAt(Date.now()));
  const [playing, setPlaying] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      lastPaint = -Infinity;
    const tick = (now: number) => {
      if (!document.hidden && now - lastPaint >= 1000 / 30) {
        setMinutes(townMinutesAt(Date.now()));
        lastPaint = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (!document.hidden) setMinutes(townMinutesAt(Date.now()));
    };
    sync();
    frame = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', sync);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [playing]);
  return { minutes, playing, setPlaying };
}
