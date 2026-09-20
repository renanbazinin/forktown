import { useEffect, useRef, useState } from 'react';
export function useTownClock() {
  const [minutes, setMinutes] = useState(9 * 60);
  const [playing, setPlaying] = useState(
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [speed, setSpeed] = useState(1);
  const previous = useRef(0);
  useEffect(() => {
    if (!playing) return;
    previous.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(),
        delta = Math.min((now - previous.current) / 1000, 1);
      previous.current = now;
      if (!document.hidden) setMinutes((value) => (value + delta * speed) % 1440);
    }, 100);
    return () => clearInterval(timer);
  }, [playing, speed]);
  return {
    minutes,
    playing,
    speed,
    setPlaying,
    setSpeed,
    seek: (value: number) => {
      setPlaying(false);
      setMinutes(Math.max(0, Math.min(1439, value)));
    },
  };
}
