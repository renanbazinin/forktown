import { Headphones, Flag, Users } from 'lucide-react';
import { TEAMS, type FootballState } from '../lib/football';

export default function FootballMatch({
  game,
  watching,
}: {
  game: FootballState;
  watching: number;
}) {
  const status = !game.live
    ? 'Back at sunrise'
    : game.phase === 'halftime'
      ? `Half-time · back in ${game.remaining}s`
      : game.phase === 'fulltime'
        ? `Full-time · next game in ${game.remaining}s`
        : `${game.half === 1 ? 'First' : 'Second'} half · ${game.clock}`;
  return (
    <div className="football-info">
      <span className="eyebrow">SIX PLOTS. ONE BEAUTIFUL GAME.</span>
      <h3>A little touchline magic.</h3>
      <p>Pick a side, find your spot, and stay for the next goal.</p>
      <div
        className="football-scorecard"
        aria-label={`Score: Meadow FC ${game.score[0]}, Sunset United ${game.score[1]}`}
      >
        <div className="football-live">
          {game.live && <i className="live-dot" />}
          {status}
        </div>
        <div className="football-score">
          {TEAMS.map((team, i) => (
            <div key={team.name}>
              <span className={`football-crest team-${i}`}>{i === 0 ? 'M' : 'S'}</span>
              <strong>{game.score[i]}</strong>
              <span>{team.name}</span>
            </div>
          ))}
          <span className="football-versus">:</span>
        </div>
        <p
          className={game.goal ? 'football-commentary is-goal' : 'football-commentary'}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {game.caption}
        </p>
      </div>
      <div className="football-stats" aria-label="Match statistics">
        <span>{game.shots[0]}</span>
        <small>SHOTS</small>
        <span>{game.shots[1]}</span>
        <span>{game.saves[0]}</span>
        <small>SAVES</small>
        <span>{game.saves[1]}</span>
      </div>
      <div className="football-notes">
        <p>
          <Flag size={16} />
          <span>
            Four a side. Two quick halves. A fresh match every 2 minutes 20 seconds, all day from
            06:00–20:00.
          </span>
        </p>
        <p>
          <Users size={16} />
          <span>
            {game.live
              ? `${8 + watching} on the touchline. There’s room for you, too.`
              : 'The teams and the touchline crowd return in the morning.'}
          </span>
        </p>
        <p>
          <Headphones size={16} />
          <span>
            Turn on <strong>Town sound</strong> and zoom closer for kicks, whistles, and a cheer
            when the ball goes in.
          </span>
        </p>
      </div>
    </div>
  );
}
