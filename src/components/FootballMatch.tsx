import { useEffect, useId, useRef, useState, type ComponentType } from 'react';
import { ChevronDown, Clock3, Flag, Hand, Headphones, Target, Users, Whistle } from 'lucide-react';
import {
  FOOTBALL_PLOTS,
  LAST_MATCH,
  MATCH,
  ROSTERS,
  TEAMS,
  footballAt,
  playerProfile,
  type FootballEvent,
  type FootballEventKind,
  type FootballRole,
  type FootballState,
} from '../lib/football';

const PLAY = MATCH.first + MATCH.second;
/** Six games fit into daylight, 06:00 to 20:00. */
const GAMES = 6;
/** Seconds of play at a moment in the 140-second cycle (the clock stops at half-time). */
const played = (at: number) =>
  Math.min(MATCH.first, at) +
  Math.max(0, Math.min(MATCH.second, at - MATCH.first - MATCH.halftime));
/** The ten-minute scoreboard minute, counted the football way: 00:40 is the 1st minute. */
const minuteAt = (at: number) => Math.min(10, Math.floor((played(at) * 5) / 60) + 1);
/** The moments worth listing; tackles, passes and crosses live in the running commentary. */
const KEY_MOMENTS: Partial<Record<FootballEventKind, ComponentType<{ size?: number }>>> = {
  goal: FootballIcon,
  save: Hand,
  shot: Target,
  miss: Target,
  post: Target,
  corner: Flag,
  kickoff: Whistle,
  'half-time': Whistle,
  'full-time': Whistle,
};
/** How a shot ends; its outcome row tells the whole chance. */
const OUTCOMES = new Set<FootballEventKind>(['goal', 'save', 'miss', 'post']);
const FEED_ROWS = 4;

/**
 * Key moments, newest first. A shot folds into the row of its outcome, only the opening and
 * second-half kick-offs are listed, and no goal drops out while there are fewer than four.
 */
function keyMoments(events: FootballEvent[], caption: string) {
  const rows: FootballEvent[] = [];
  let halves = 0;
  events.forEach((event, i) => {
    if (!(event.kind in KEY_MOMENTS)) return;
    if (event.kind === 'kickoff') {
      const half = event.at < MATCH.first ? 1 : 2;
      if (halves >= half) return;
      halves = half;
    }
    if (event.kind === 'shot') {
      const next = events.slice(i + 1).find((e) => e.kind === 'shot' || OUTCOMES.has(e.kind));
      if (next && next.kind !== 'shot') return;
    }
    rows.push(event);
  });
  // The newest line is already the caption above the list.
  if (rows.at(-1)?.text === caption) rows.pop();
  const shown = rows.slice(-FEED_ROWS);
  const goals = rows.filter((event) => event.kind === 'goal');
  if (goals.length < FEED_ROWS)
    for (const goal of goals) {
      const oldest = shown.findIndex((event) => event.kind !== 'goal');
      if (shown.includes(goal) || oldest < 0) continue;
      shown.splice(oldest, 1);
      shown.push(goal);
    }
  return shown.sort((a, b) => b.at - a.at);
}

/** Match seconds a caption stays up before an ordinary line may replace it. */
const HOLD = 1.2;
const URGENT = new Set<FootballEventKind>([
  'goal',
  'save',
  'shot',
  'kickoff',
  'half-time',
  'full-time',
]);
/**
 * The running caption, held long enough to read: a new line waits until the current one has
 * been up for HOLD seconds, unless a shot, save, goal or whistle has just happened.
 */
function useSteadyCaption(game: FootballState) {
  const held = useRef({ text: game.caption, at: game.elapsed, match: game.match });
  const last = held.current;
  if (game.caption !== last.text) {
    const latest = game.events.at(-1);
    const urgent = !!latest && URGENT.has(latest.kind) && game.elapsed - latest.at < 0.5;
    const jumped = game.match !== last.match || game.elapsed < last.at;
    if (urgent || jumped || game.elapsed - last.at >= HOLD)
      held.current = { text: game.caption, at: game.elapsed, match: game.match };
  }
  return held.current.text;
}

const ANNOUNCED = new Set<FootballEventKind>(['goal', 'save', 'half-time', 'full-time']);
/**
 * One line for screen readers when something decisive happens (goals, saves, the whistles); it
 * clears after half a minute, so nothing stale is left to find.
 */
function announcement(game: FootballState) {
  const event = [...game.events].reverse().find((e) => ANNOUNCED.has(e.kind));
  if (!event || game.elapsed - event.at > 30) return '';
  const score = `${TEAMS[0].name} ${game.score[0]}, ${TEAMS[1].name} ${game.score[1]}.`;
  if (event.kind === 'goal') return `Minute ${event.minute}. ${event.text} ${score}`;
  if (event.kind === 'save') return `Minute ${event.minute}. ${event.text}`;
  return `${event.kind === 'half-time' ? 'Half-time' : 'Full-time'}. ${score}`;
}
const ROLES: Record<FootballRole, string> = {
  keeper: 'Keeper',
  defender: 'Defender',
  wing: 'Wing',
  striker: 'Striker',
};
const short = (team: 0 | 1) => TEAMS[team].name.split(' ')[0];

/** A line-drawn ball in the lucide style, for places where a football needs no words. */
export function FootballIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m12 7 4.76 3.46-1.82 5.59H9.06l-1.82-5.59Z" />
      <path d="M12 7V2m4.76 8.46 4.75-1.55m-6.57 7.14 2.94 4.04m-8.82-4.04-2.94 4.04m1.12-9.63L2.49 8.91" />
    </svg>
  );
}

function Crest({ team, size = 32 }: { team: 0 | 1; size?: number }) {
  const clip = useId();
  const { color, light } = TEAMS[team];
  return (
    <svg
      className="football-crest"
      width={size}
      height={size * 1.125}
      viewBox="0 0 32 36"
      aria-hidden="true"
    >
      <clipPath id={clip}>
        <path d="M16 1.5 29 5v11.5c0 8.6-5.6 14.8-13 18-7.4-3.2-13-9.4-13-18V5Z" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect width="32" height="36" fill={color} />
        {team === 0 ? (
          <>
            <path d="M0 27c6-6 11-8 16-8s10 2 16 8v9H0Z" fill={light} />
            <path d="M0 31c6-4 11-5.5 16-5.5S26 27 32 31v5H0Z" fill="#8FC79A" />
          </>
        ) : (
          <>
            <circle cx="16" cy="29" r="8" fill={light} />
            <path d="M0 29h32v7H0Z" fill="#B8612C" />
          </>
        )}
      </g>
      <path
        d="M16 1.5 29 5v11.5c0 8.6-5.6 14.8-13 18-7.4-3.2-13-9.4-13-18V5Z"
        fill="none"
        stroke={light}
        strokeWidth="1.5"
      />
      <text x="16" y={team === 0 ? 17 : 17.5} textAnchor="middle" fill={team ? '#4A2A10' : light}>
        {team === 0 ? 'M' : 'S'}
      </text>
    </svg>
  );
}

function status(game: FootballState) {
  if (!game.live) return 'Back at sunrise';
  if (game.phase === 'halftime') return `Half-time · back in ${game.remaining}s`;
  if (game.phase === 'fulltime')
    return game.match === LAST_MATCH
      ? 'Full-time · back at sunrise'
      : `Full-time · next game in ${game.remaining}s`;
  return `${game.half === 1 ? '1st' : '2nd'} half · ${game.clock}`;
}

function Minute({ event }: { event: FootballEvent }) {
  const whistle = event.kind === 'half-time' ? 'HT' : event.kind === 'full-time' ? 'FT' : null;
  return whistle ? (
    <span className="football-minute" aria-hidden="true">
      {whistle}
    </span>
  ) : (
    <span className="football-minute">
      <span className="sr-only">Minute </span>
      {event.minute}&#39;
    </span>
  );
}

/** Goals by player, in the order they were scored: "Rowan 3', 8'". */
function scorers(goals: FootballEvent[], team: 0 | 1) {
  const byPlayer = new Map<string, number[]>();
  for (const goal of goals)
    if (goal.team === team) {
      const name = goal.player === null ? 'Own goal' : playerProfile(goal.player).name;
      byPlayer.set(name, [...(byPlayer.get(name) ?? []), goal.minute]);
    }
  return [...byPlayer];
}

function Side({ team, values }: { team: 0 | 1; values: [number, number] }) {
  const total = values[0] + values[1];
  return (
    <td className={`team-${team}`}>
      <span className="football-value">
        <b className={values[team] > values[1 - team] ? 'is-ahead' : undefined}>{values[team]}</b>
        <span className="football-bar" aria-hidden="true">
          <i
            className="football-fill"
            style={{ width: `${total ? (values[team] / total) * 100 : 0}%` }}
          />
        </span>
      </span>
    </td>
  );
}

function Comparison({ label, values }: { label: string; values: [number, number] }) {
  return (
    <tr>
      <Side team={0} values={values} />
      <th scope="row">{label}</th>
      <Side team={1} values={values} />
    </tr>
  );
}

/** Final scores of the day's finished games, replayed from the shared clock. */
function Results({ day, count, evening }: { day: number; count: number; evening: boolean }) {
  const id = useId();
  const [scores, setScores] = useState<[number, number][]>([]);
  useEffect(() => {
    // An unseen game takes a few dozen milliseconds to simulate: one per task keeps the panel
    // responsive, and the engine caches them for the next render.
    const found: [number, number][] = [];
    let timer = 0;
    const next = () => {
      if (found.length === count) return setScores(found);
      found.push(footballAt(360 + found.length * MATCH.length + MATCH.length - 1, day).score);
      timer = window.setTimeout(next);
    };
    timer = window.setTimeout(next);
    return () => clearTimeout(timer);
  }, [day, count]);
  if (!count || !scores.length) return null;
  return (
    <section className="football-results" aria-labelledby={id}>
      <h3 className="football-heading" id={id}>
        {evening ? 'Today’s results' : 'Earlier today'}
      </h3>
      <ol>
        {scores.slice(0, count).map(([home, away], i) => (
          <li key={i} className={home > away ? 'team-0' : away > home ? 'team-1' : undefined}>
            <b aria-hidden="true">
              {home}–{away}
            </b>
            <small aria-hidden="true">G{i + 1}</small>
            <span className="sr-only">
              Game {i + 1}: {TEAMS[0].name} {home}, {TEAMS[1].name} {away}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function FootballMatch({
  game,
  watching,
  minutes,
}: {
  game: FootballState;
  watching: number;
  /** Town minutes, to tell the evening (today's results) from the early morning. */
  minutes?: number;
}) {
  const id = useId();
  const playing = game.phase === 'first' || game.phase === 'second';
  const goals = game.events.filter((event) => event.kind === 'goal');
  const scored = game.goal ? (game.celebration?.team ?? goals.at(-1)?.team ?? null) : null;
  const caption = useSteadyCaption(game);
  const feed = keyMoments(game.events, caption);
  const progress = game.live ? played(game.elapsed) / PLAY : 0;
  const winner =
    game.phase === 'fulltime' && game.score[0] !== game.score[1]
      ? game.score[0] > game.score[1]
        ? 0
        : 1
      : null;
  // A new key restarts the pop when the score changes.
  const digit = (team: 0 | 1) => (
    <b
      key={`${team}:${game.score[team]}`}
      className={`team-${team} ${scored === team ? 'is-new' : ''}`}
    >
      {game.score[team]}
    </b>
  );
  const timeline = `${
    game.phase === 'fulltime'
      ? 'All 10 minutes played'
      : game.phase === 'halftime'
        ? 'Half-time after 5 minutes'
        : `Minute ${minuteAt(game.elapsed)} of 10`
  }. ${
    goals.length
      ? `Goals: ${goals.map((g) => `${g.minute}' ${g.team === null ? '' : short(g.team)}`).join(', ')}.`
      : 'No goals yet.'
  }`;
  return (
    <div className="football-info">
      <span className="quiet-label">
        PUBLIC SPACE · {FOOTBALL_PLOTS[0]}–{FOOTBALL_PLOTS.at(-1)} · {FOOTBALL_PLOTS.length} PLOTS
      </span>
      <section
        className={`football-board ${scored === null ? '' : `goal-${scored}`}`}
        aria-labelledby={`${id}-score`}
      >
        <p className="football-status">
          <span>
            {game.live && <i className="live-dot" />}
            {status(game)}
          </span>
          {scored !== null ? (
            <span className={`football-flash team-${scored}`}>Goal · {short(scored)}</span>
          ) : (
            game.live && (
              <span>
                Game {game.match + 1} of {GAMES}
              </span>
            )
          )}
        </p>
        <h3 className="sr-only" id={`${id}-score`}>
          {game.live
            ? `${TEAMS[0].name} ${game.score[0]}, ${TEAMS[1].name} ${game.score[1]}`
            : `${TEAMS[0].name} against ${TEAMS[1].name}, first kick-off at 06:00`}
        </h3>
        <div className="football-teams">
          {([0, 1] as const).map((team) => {
            const list = scorers(goals, team);
            return (
              <div
                key={team}
                className={`football-side team-${team} ${winner === team ? 'is-winner' : ''}`}
              >
                <Crest team={team} />
                <strong>{TEAMS[team].name}</strong>
                {winner === team && <span className="football-won">Winners</span>}
                {list.length > 0 && (
                  <ul aria-label={`${TEAMS[team].name} goals`}>
                    {list.map(([name, when]) => (
                      <li key={name}>
                        {name} {when.map((m) => `${m}'`).join(', ')}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          <div className="football-scoreline" aria-hidden="true">
            {game.live ? (
              <>
                <span className="football-digits">
                  {digit(0)}
                  <i>:</i>
                  {digit(1)}
                </span>
                <small>
                  {game.phase === 'halftime' ? 'HT' : game.phase === 'fulltime' ? 'FT' : 'LIVE'}
                </small>
              </>
            ) : (
              <>
                <span className="football-digits is-time">06:00</span>
                <small>KICK-OFF</small>
              </>
            )}
          </div>
        </div>
        {game.live && (
          <div className="football-timeline" role="img" aria-label={timeline}>
            <div className="football-track">
              <span className="football-played" style={{ width: `${progress * 100}%` }} />
              <span className="football-half" />
              {goals.map((goal) => (
                <span
                  key={goal.at}
                  className={`football-pin team-${goal.team ?? 0}`}
                  style={{ left: `${(played(goal.at) / PLAY) * 100}%` }}
                />
              ))}
              {playing && <span className="football-now" style={{ left: `${progress * 100}%` }} />}
            </div>
            <div className="football-ticks">
              <span>0&#39;</span>
              <span>HT</span>
              <span>10&#39;</span>
            </div>
          </div>
        )}
        <div className="football-caption">
          {playing && (
            <span className="football-minute" aria-hidden="true">
              {minuteAt(game.elapsed)}&#39;
            </span>
          )}
          {/* Closed, the status bar already says "back at sunrise": the caption gives the day. */}
          <p>{game.live ? caption : 'First kick-off 06:00 · six games until 20:00'}</p>
        </div>
        {/* The caption changes every couple of seconds; only decisive moments are spoken. */}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {game.live ? announcement(game) : ''}
        </p>
      </section>

      {game.live && (
        <table className="football-stats">
          <caption className="sr-only">Match stats</caption>
          <thead>
            <tr>
              <th scope="col" className="team-0">
                <i className="football-fill" aria-hidden="true" />
                {short(0)}
              </th>
              <th scope="col">Match stats</th>
              <th scope="col" className="team-1">
                {short(1)}
                <i className="football-fill" aria-hidden="true" />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="football-possession">
              <td className="team-0">
                <b>{game.possession[0]}%</b>
              </td>
              <th scope="row">Possession</th>
              <td className="team-1">
                <b>{game.possession[1]}%</b>
              </td>
            </tr>
            <tr className="football-split" aria-hidden="true">
              <td colSpan={3}>
                <span>
                  <i className="football-fill team-0" style={{ flexGrow: game.possession[0] }} />
                  <i className="football-fill team-1" style={{ flexGrow: game.possession[1] }} />
                </span>
              </td>
            </tr>
            <Comparison label="Shots" values={game.shots} />
            <Comparison label="On target" values={game.onTarget} />
            <Comparison label="Saves" values={game.saves} />
            <Comparison label="Corners" values={game.corners} />
          </tbody>
        </table>
      )}

      {game.live && feed.length > 0 && (
        <section className="football-feed" aria-labelledby={`${id}-feed`}>
          <h3 className="football-heading" id={`${id}-feed`}>
            Key moments
          </h3>
          <ol>
            {feed.map((event) => {
              const Icon = KEY_MOMENTS[event.kind]!;
              return (
                <li
                  key={`${event.at}-${event.kind}`}
                  className={`team-${event.team ?? 'none'} ${event.kind === 'goal' ? 'is-goal' : ''}`}
                >
                  <Minute event={event} />
                  <Icon size={14} />
                  <span>{event.text}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <Results
        day={game.day}
        count={game.live ? game.match : (minutes ?? 0) >= 1200 ? GAMES : 0}
        evening={!game.live}
      />

      <details className="football-lineups">
        <summary>
          <span>Line-ups</span>
          <small>Five a side</small>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div>
          {ROSTERS.map((roster, index) => {
            const team = index as 0 | 1;
            return (
              <div key={team} className={`team-${team}`}>
                <h4>
                  <Crest team={team} size={16} />
                  {TEAMS[team].name}
                </h4>
                <ol>
                  {roster.map((player, slot) => {
                    const count = goals.filter((g) => g.player === team * 5 + slot).length;
                    return (
                      <li key={player.number}>
                        <span
                          className={`football-shirt ${player.role === 'keeper' ? 'is-keeper' : ''}`}
                        >
                          {player.number}
                        </span>
                        <span>
                          {player.name}
                          <small>{ROLES[player.role]}</small>
                        </span>
                        {count > 0 && (
                          <span className="football-scored">
                            {Array.from({ length: count }, (_, i) => (
                              <FootballIcon key={i} size={11} />
                            ))}
                            <span className="sr-only">
                              {count === 1 ? 'scored' : `scored ${count}`}
                            </span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      </details>

      <div className="football-notes">
        <p>
          <Users size={15} aria-hidden="true" />
          <span>
            {game.live
              ? `${8 + watching} on the touchline. There’s room for you, too.`
              : 'The teams and the touchline crowd return in the morning.'}
          </span>
        </p>
        <p>
          <Clock3 size={15} aria-hidden="true" />
          <span>
            A ten-minute match every 2 min 20 s, 06:00–20:00. Everyone watching shares the same
            game; the day’s six fixtures change at midnight UTC.
          </span>
        </p>
        <p>
          <Headphones size={15} aria-hidden="true" />
          <span>
            Turn on <strong>Town sound</strong> and zoom in for kicks, whistles, and cheers.
          </span>
        </p>
      </div>
    </div>
  );
}
