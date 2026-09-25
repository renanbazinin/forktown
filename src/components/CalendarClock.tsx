import { BookOpen, Pause, Play, X } from 'lucide-react';
import { memo, useId } from 'react';
import { timeLabel } from '../lib/simulation';
import { moonSlice, townCalendarAt, DAYS_PER_SEASON } from '../lib/town-calendar';
import type { useTownClock } from '../lib/use-town-clock';
import type { EveningTale, LanternHour } from '../lib/lanterns';
import type { Place } from '../lib/schema';
import { realWait } from '../lib/evening-copy';
import { seasonNote } from '../lib/season-copy';
import LanternGlyph from './LanternGlyph';
import '../calendar.css';
import '../stories.css';

const Moon = memo(function Moon({ phase, size = 20 }: { phase: number; size?: number }) {
  const rows = Array.from({ length: 41 }, (_, i) => {
    const y = -1 + i / 20;
    const [left, right] = moonSlice(phase, y);
    return { y: 12 + y * 9, left: 12 + left * 9, right: 12 + right * 9 };
  });
  const points = [
    ...rows.map((row) => `${row.left},${row.y}`),
    ...rows.reverse().map((row) => `${row.right},${row.y}`),
  ].join(' ');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.13" />
      <polygon points={points} fill="currentColor" />
    </svg>
  );
});

export default function CalendarClock({
  clock,
  evening,
  onVisitPlace,
}: {
  clock: ReturnType<typeof useTownClock>;
  evening?: { hour: LanternHour; tale?: EveningTale; places: readonly Place[] };
  onVisitPlace?: (plot: string) => void;
}) {
  const id = useId();
  const calendar = townCalendarAt(clock.day, clock.minutes);
  const told = evening?.tale && evening.places.find((place) => place.id === evening.tale?.placeId);
  return (
    <>
      <div className="map-clock" title="UTC-synced · One real minute is one town hour">
        <span className={clock.playing ? 'live-dot' : 'paused-dot'} />
        <time>{timeLabel(clock.minutes)}</time>
        <button
          className="calendar-trigger"
          popoverTarget={id}
          aria-label={`Open town calendar: ${calendar.label}, ${calendar.moonName}`}
          title={`${calendar.label} · ${calendar.moonName}`}
        >
          <Moon phase={calendar.moonPhase} size={18} />
          <span>
            {calendar.season} {calendar.date}
          </span>
        </button>
        <button
          aria-label={clock.playing ? 'Pause town' : 'Return to live town'}
          title={clock.playing ? 'Pause this view' : 'Catch up to the shared town clock'}
          onClick={() => clock.setPlaying(!clock.playing)}
        >
          {clock.playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
      <section id={id} popover="auto" className="town-calendar" aria-labelledby={`${id}-title`}>
        <header className="calendar-heading">
          <div>
            <span className="calendar-eyebrow">THE TOWN ALMANAC</span>
            <h2 id={`${id}-title`}>
              {calendar.season} <span>· Year {calendar.year}</span>
            </h2>
            {/* Read from the almanac's own date, so the line turns at midnight with the grid. */}
            <p className="calendar-season">
              {seasonNote(calendar.seasonIndex * DAYS_PER_SEASON + calendar.date - 1)}
            </p>
          </div>
          <button popoverTarget={id} popoverTargetAction="hide" aria-label="Close town calendar">
            <X size={16} />
          </button>
        </header>
        <div className="calendar-moon">
          <Moon phase={calendar.moonPhase} size={40} />
          <div>
            <strong>{calendar.moonName}</strong>
            <span>
              {Math.round(calendar.illumination * 100)}% illuminated · a 28-day lunar cycle
            </span>
          </div>
        </div>
        {evening && (
          <section className="almanac-evening" aria-label="This evening">
            <p>
              <LanternGlyph lit={evening.hour.phase !== 'waiting' && evening.hour.total > 0} />
              <span>
                <strong>Lantern hour</strong> · 20:00 ·{' '}
                {evening.hour.phase === 'waiting'
                  ? realWait(evening.hour.startsIn)
                  : evening.hour.phase === 'lighting'
                    ? 'happening now'
                    : 'all lit'}
              </span>
            </p>
            {told && (
              <p>
                <BookOpen size={14} aria-hidden="true" />
                <span>
                  <strong>Tonight's tale</strong> ·{' '}
                  <button
                    className="text-button"
                    onClick={() => {
                      document.getElementById(id)?.hidePopover();
                      onVisitPlace?.(told.plot);
                    }}
                  >
                    {told.name}
                  </button>
                </span>
              </p>
            )}
          </section>
        )}
        <ol className="calendar-days" aria-label={`${calendar.season}, Year ${calendar.year}`}>
          {Array.from({ length: DAYS_PER_SEASON }, (_, i) => (
            <li
              key={i}
              aria-current={i + 1 === calendar.date ? 'date' : undefined}
              aria-label={`${calendar.season} ${i + 1}${i + 1 === calendar.date ? ', today' : ''}`}
            >
              <Moon phase={i / DAYS_PER_SEASON} size={16} />
              <span>{i + 1}</span>
            </li>
          ))}
        </ol>
        <footer className="calendar-footer">
          <span className="calendar-status">
            <i className={clock.playing ? 'live-dot' : 'paused-dot'} />
            {clock.playing ? 'Shared town time' : 'Your view is paused'} ·{' '}
            {timeLabel(clock.minutes)}
          </span>
          <p>24 real minutes in a day. Four 28-day seasons, each about 11 real hours.</p>
          <p>
            One calendar for everyone, kept by UTC. Return tomorrow or refresh — the town keeps its
            place.
          </p>
        </footer>
      </section>
    </>
  );
}
