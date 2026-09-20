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
        <span className="clock-sync">
          <span className={clock.playing ? 'live-dot' : 'paused-dot'} />
          {clock.playing ? 'UTC-synced' : 'View paused'}
        </span>
        <span className="clock-hint">1 minute = 1 town hour</span>
        <button
          className="clock-play"
          aria-label={clock.playing ? 'Pause town' : 'Return to live town'}
          title={clock.playing ? 'Pause this view' : 'Catch up to the shared town clock'}
          onClick={() => clock.setPlaying(!clock.playing)}
        >
          {clock.playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
      </div>
    </div>
  );
}
