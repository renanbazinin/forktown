import { Pause, Play, Clock3 } from 'lucide-react';
import { timeLabel, periodAt } from '../lib/simulation';
import type { useTownClock } from '../lib/use-town-clock';
export default function TownClock({ clock }: { clock: ReturnType<typeof useTownClock> }) {
  return (
    <div className="town-clock">
      <div className="clock-now">
        <Clock3 size={16} />
        <strong>{timeLabel(clock.minutes)}</strong>
        <span>{periodAt(clock.minutes)} in Forktown</span>
      </div>
      <div className="clock-playback">
        <button
          className="clock-play"
          aria-label={clock.playing ? 'Pause town' : 'Play town'}
          onClick={() => clock.setPlaying(!clock.playing)}
        >
          {clock.playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <label>
          <span className="sr-only">Simulation speed</span>
          <select
            aria-label="Simulation speed"
            value={clock.speed}
            onChange={(e) => clock.setSpeed(Number(e.target.value))}
          >
            <option value={1}>1×</option>
            <option value={4}>4×</option>
            <option value={12}>12×</option>
          </select>
        </label>
        <label className="clock-scrubber">
          <span className="sr-only">Town time</span>
          <input
            type="range"
            aria-label="Town time"
            aria-valuetext={timeLabel(clock.minutes)}
            min="0"
            max="1439"
            step="1"
            value={Math.floor(clock.minutes)}
            onChange={(e) => clock.seek(Number(e.target.value))}
          />
        </label>
        <span className="clock-hint">A day in {24 / clock.speed} minutes</span>
      </div>
    </div>
  );
}
