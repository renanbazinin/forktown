import { FOOTBALL_SITE } from './town-config.ts';
import { TOWN_DAY_MS, UTC_DAY_MS } from './town-time.ts';
import { PLOTS, project, type Point } from './world.ts';
import {
  ACTIONS,
  BALL_AT,
  CENTRE_SPOT,
  FIELDS,
  FRAMES,
  HZ,
  LAST_MATCH,
  META_AT,
  PF,
  REF_ACTIONS,
  REF_AT,
  RESTART_KINDS,
  simulateMatch,
  type MatchRecord,
} from './football-engine.ts';
/** The day's sixth and last match: afterwards nobody lines up again until sunrise. */
export { LAST_MATCH } from './football-engine.ts';

export const FOOTBALL_PLOTS = PLOTS.filter(
  (p) =>
    p.row >= FOOTBALL_SITE.row &&
    p.row < FOOTBALL_SITE.row + FOOTBALL_SITE.rows &&
    p.col >= FOOTBALL_SITE.col &&
    p.col < FOOTBALL_SITE.col + FOOTBALL_SITE.columns,
).map((p) => p.id);
export const FOOTBALL_VENUE = {
  id: 'football',
  name: 'The Meadow Ground',
  plot: 'F4',
  kind: 'football',
} as const;
export const GROUND = { left: 10, right: 21, top: 22, bottom: 29 } as const;
export const PITCH = { left: 10.8, right: 20.2, top: 22.75, bottom: 27.25 } as const;
export const FOOTBALL_CENTER = { x: 15.5, y: 25.5 };
export const FOOTBALL_ENTRANCE = { x: 15.5, y: 29.5 };
export const TEAMS = [
  { name: 'Meadow FC', short: 'MEADOW', color: '#287968', light: '#C4E7C1' },
  { name: 'Sunset United', short: 'SUNSET', color: '#E49B45', light: '#FFE1A2' },
] as const;
export const isFootballPlot = (id: string) => FOOTBALL_PLOTS.includes(id);
export const insideFootball = (p: Point) =>
  p.x >= GROUND.left && p.x < GROUND.right && p.y >= GROUND.top && p.y < GROUND.bottom;
export const spectatorSpot = (seat: number): Point => ({ x: 13.2 + seat * 0.65, y: 28.15 });
/** The 140-second cycle: two 60-second halves, an 8-second break, and 12 seconds at full-time. */
export const MATCH = { first: 60, halftime: 8, second: 60, fulltime: 12, length: 140 } as const;
/** Goal mouth on the tile y axis, shared by the engine, the renderer and the tests. */
export const GOAL_MOUTH = { top: 24.2, bottom: 25.8 } as const;
/** Crossbar height in screen pixels at zoom 1; a ball above it cannot score. */
export const CROSSBAR = 22;
/** Tiles of `spin` per turn of the ball's panels, and of `stride` per stride cycle (two steps). */
export const BALL_TURN = 0.45;
export const STRIDE_CYCLE = 0.62;
export type FootballRole = 'keeper' | 'defender' | 'wing' | 'striker';
export type HairStyle = 'short' | 'buzz' | 'curly' | 'ponytail' | 'bun' | 'bob';
export type FootballProfile = {
  number: number;
  name: string;
  role: FootballRole;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
};
/**
 * Five a side: a keeper, a defender, two wings and a striker (futsal's diamond).
 * Player ids are `team * 5 + slot`; slot 0 is always the keeper.
 */
export const ROSTERS: readonly [readonly FootballProfile[], readonly FootballProfile[]] = [
  [
    {
      number: 1,
      name: 'Moss',
      role: 'keeper',
      skin: '#C99A6E',
      hair: '#3B2F28',
      hairStyle: 'short',
    },
    {
      number: 4,
      name: 'Hazel',
      role: 'defender',
      skin: '#E2BE95',
      hair: '#8A5A36',
      hairStyle: 'bun',
    },
    {
      number: 7,
      name: 'Fern',
      role: 'wing',
      skin: '#916447',
      hair: '#2A2320',
      hairStyle: 'ponytail',
    },
    {
      number: 11,
      name: 'Bramble',
      role: 'wing',
      skin: '#D7A875',
      hair: '#5C4336',
      hairStyle: 'curly',
    },
    {
      number: 9,
      name: 'Rowan',
      role: 'striker',
      skin: '#B78259',
      hair: '#342E2B',
      hairStyle: 'buzz',
    },
  ],
  [
    { number: 1, name: 'Dusk', role: 'keeper', skin: '#A57855', hair: '#2E2622', hairStyle: 'bob' },
    {
      number: 3,
      name: 'Saffron',
      role: 'defender',
      skin: '#E8CBA4',
      hair: '#B9763A',
      hairStyle: 'buzz',
    },
    {
      number: 8,
      name: 'Coral',
      role: 'wing',
      skin: '#D9B68B',
      hair: '#6B3F2A',
      hairStyle: 'ponytail',
    },
    {
      number: 6,
      name: 'Amber',
      role: 'wing',
      skin: '#7E553B',
      hair: '#1F1A18',
      hairStyle: 'curly',
    },
    {
      number: 10,
      name: 'Ember',
      role: 'striker',
      skin: '#EBC9A0',
      hair: '#C9803F',
      hairStyle: 'short',
    },
  ],
];
export const playerProfile = (id: number) => ROSTERS[id < 5 ? 0 : 1][id % 5];
export type FootballSound = {
  at: number;
  kind: 'kick' | 'whistle' | 'final-whistle' | 'cheer' | 'ooh' | 'applause' | 'post';
  strength: number;
};
export type FootballAction =
  | 'stand'
  | 'run'
  | 'kick'
  | 'tackle'
  | 'dive'
  | 'catch'
  | 'throw'
  | 'celebrate'
  | 'slide'
  | 'dejected'
  | 'wave'
  | 'drink'
  | 'handshake';
export type FootballPlayer = Point & {
  /** Stable index 0..9: `team * 5 + slot`; slot 0 is the keeper. */
  id: number;
  team: 0 | 1;
  number: number;
  name: string;
  role: FootballRole;
  /** Unit vector on the ground plane (tile axes) that the body faces. */
  facing: Point;
  /** Ground speed in tiles per second. */
  speed: number;
  /**
   * Distance run so far in tiles. Drives a stride cycle (`STRIDE_CYCLE`) that never slides;
   * continuous, and every match starts and ends on the same point of the cycle.
   */
  stride: number;
  action: FootballAction;
  /** 0..1 progress through the current action (kick swing, dive arc, celebration hop). */
  actionT: number;
  /** Keeper dive: -1..1 stretch along the tile y axis (+ toward larger y). 0 otherwise. */
  dive: number;
  /** True while this player controls or holds the ball. */
  hasBall: boolean;
};
export type FootballReferee = Point & {
  facing: Point;
  speed: number;
  stride: number;
  action: 'stand' | 'run' | 'whistle' | 'point' | 'carry';
  actionT: number;
};
export type FootballBall = Point & {
  /** Height above the grass in screen pixels at zoom 1 (the crossbar is `CROSSBAR`). */
  height: number;
  /** Ground velocity in tiles per second. */
  vx: number;
  vy: number;
  /**
   * Distance rolled or flown, in tiles; turns the ball's panels (`BALL_TURN`). Continuous, and
   * every match starts and ends on the same panel turn, so the next kick-off joins seamlessly.
   */
  spin: number;
  /** The player id controlling or holding it, -1 for the referee, null when loose. */
  owner: number | null;
  /** Carried in hands (keeper, throw-in, referee): `height` is already hand height. */
  held: boolean;
};
export type FootballEventKind =
  | 'kickoff'
  | 'pass'
  | 'cross'
  | 'dribble'
  | 'tackle'
  | 'interception'
  | 'shot'
  | 'save'
  | 'goal'
  | 'miss'
  | 'post'
  | 'clearance'
  | 'corner'
  | 'goal-kick'
  | 'throw-in'
  | 'half-time'
  | 'full-time';
export type FootballEvent = {
  /** Seconds into the 140-second cycle. */
  at: number;
  /** The match minute shown to viewers, 1–10 (like 7'). */
  minute: number;
  kind: FootballEventKind;
  team: 0 | 1 | null;
  /** Player id, or null for whole-match moments. */
  player: number | null;
  /** One line of commentary. */
  text: string;
};
export type FootballRestart = 'kickoff' | 'throw-in' | 'goal-kick' | 'corner' | null;
export type FootballState = {
  live: boolean;
  day: number;
  match: number;
  elapsed: number;
  half: number;
  phase: 'closed' | 'first' | 'halftime' | 'second' | 'fulltime';
  clock: string;
  remaining: number;
  score: [number, number];
  shots: [number, number];
  onTarget: [number, number];
  saves: [number, number];
  corners: [number, number];
  /** Whole percentages that sum to 100; 50/50 before the first touch. */
  possession: [number, number];
  /** The current commentary line. */
  caption: string;
  /** Every event so far, oldest first; nothing after `elapsed`. */
  events: FootballEvent[];
  players: FootballPlayer[];
  referee: FootballReferee | null;
  ball: FootballBall;
  /** The team on the ball right now. */
  attacking: 0 | 1 | null;
  /** The x direction each team attacks this half (teams change ends at half-time). */
  direction: [1 | -1, 1 | -1];
  restart: FootballRestart;
  /** True for the few seconds of a goal celebration. */
  goal: boolean;
  celebration: { team: 0 | 1; player: number; since: number } | null;
  /** 0..1: how close the next chance feels. The crowd leans in as it rises. */
  excitement: number;
  /** Net bulge 0..1 of the left (PITCH.left) and right (PITCH.right) goals. */
  net: [number, number];
  /** Every sound cue in this match, sorted by `at`. */
  sounds: FootballSound[];
};
const CACHE_SIZE = 12;
const cache = new Map<string, MatchRecord>();
/** The recorded match for a UTC date: simulated once, then served from a small LRU. */
export function footballRecord(utcDay: number, match: number): MatchRecord {
  const key = `${utcDay}:${match}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const record = simulateMatch(utcDay, match);
  cache.set(key, record);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return record;
}
const queued = new Set<string>();
/**
 * Simulate an upcoming match while the browser is idle, so the first frame of the next kick-off
 * never waits for it. Browsers without idle callbacks (Safari) get a plain timer instead, well
 * before the kick-off; outside a page (tests, workers) this does nothing.
 */
function prefetch(utcDay: number, match: number) {
  const key = `${utcDay}:${match}`;
  const page = globalThis as {
    document?: unknown;
    requestIdleCallback?: (fn: () => void) => number;
  };
  if (!page.document || cache.has(key) || queued.has(key)) return;
  queued.add(key);
  const run = () => {
    queued.delete(key);
    captionsOf(footballRecord(utcDay, match));
  };
  if (page.requestIdleCallback) page.requestIdleCallback.call(globalThis, run);
  else setTimeout(run, 250);
}
const CONTEXT: Record<string, string[]> = {
  keeper: ['{p} has it in the hands.', '{p} gathers it up.', '{p} looks to start an attack.'],
  back: ['{p} on the ball for {t}.', '{t} keep it at the back.', '{p} takes a touch and looks up.'],
  middle: [
    '{p} carries it forward.',
    '{p} looks for a pass.',
    '{p} drives into midfield.',
    '{t} probe for an opening.',
  ],
  final: [
    '{p} is in the danger zone!',
    '{p} looks for an opening…',
    '{p} eyes up the goal.',
    '{p} runs at the defence!',
  ],
  loose: ['Loose ball!', 'It breaks free…', 'Up for grabs!'],
  moving: ['{t} move it on.', '{t} keep the ball moving.', 'Knocked forward by {t}.'],
  'throw-in': ['{p} takes the throw.', 'Throw-in, {t}.', '{p} looks for a teammate.'],
  corner: ['{t} line up the corner.', 'Bodies in the box for the corner…', 'Corner kick coming.'],
  'goal-kick': ['{p} sets up the goal kick.', 'Goal kick, {t}.', '{p} will take it.'],
  kickoff: ['Back to the centre for the kick-off.', 'The teams reset.', '{t} to kick off.'],
};
function contextLine(key: string, seed: number, player: number | null, team: 0 | 1 | null) {
  const lines = CONTEXT[key];
  return lines[seed % lines.length]
    .replace('{p}', player === null ? '' : playerProfile(player).name)
    .replace('{t}', team === null ? 'the teams' : TEAMS[team].name);
}
function closedState(day: number): FootballState {
  return {
    live: false,
    day,
    match: 0,
    elapsed: 0,
    half: 1,
    phase: 'closed',
    clock: '00:00',
    remaining: MATCH.length,
    score: [0, 0],
    shots: [0, 0],
    onTarget: [0, 0],
    saves: [0, 0],
    corners: [0, 0],
    possession: [50, 50],
    caption: 'Back at sunrise · games from 06:00 to 20:00',
    events: [],
    players: [],
    referee: null,
    ball: { ...CENTRE_SPOT, height: 0, vx: 0, vy: 0, spin: 0, owner: null, held: false },
    attacking: null,
    direction: [1, -1],
    restart: null,
    goal: false,
    celebration: null,
    excitement: 0,
    net: [0, 0],
    sounds: [],
  };
}
/** How many entries of a list sorted by `at` fall at or before `time`. */
function upTo(list: readonly { at: number }[], time: number) {
  let lo = 0,
    hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].at <= time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
type Caption = { at: number; text: string; weight: number };
/** How much a line matters: a heavier line may cut a lighter one short. */
const WEIGHT: Partial<Record<FootballEventKind, number>> = {
  'half-time': 6,
  'full-time': 6,
  goal: 5,
  save: 4,
  miss: 4,
  post: 4,
  shot: 3,
  kickoff: 2,
  corner: 2,
  'goal-kick': 2,
  'throw-in': 2,
};
/** The least time a line stays up unless something bigger happens: events, then context. */
const HOLD = { event: 1.7, context: 2.8 };
const captionCache = new WeakMap<MatchRecord, Caption[]>();
/**
 * The commentary line through a whole match, decided once from the record so it reads at
 * a steady pace: a line stays up for its hold unless a bigger moment cuts in, and the
 * running context between moments only changes every few seconds.
 */
function captionsOf(record: MatchRecord): Caption[] {
  const hit = captionCache.get(record);
  if (hit) return hit;
  const lines: Caption[] = [];
  let seen = 0;
  for (let k = 0; k <= FRAMES; k++) {
    const t = k / HZ;
    while (seen < record.events.length && record.events[seen].at <= t + 1e-9) seen++;
    const want = rawCaption(record, k, t, seen);
    const cur = lines.at(-1);
    if (cur && want.text === cur.text) continue;
    const shown = cur ? t - cur.at : Infinity;
    // Context never goes up just before a moment it would be cut short by.
    const next = record.events[seen];
    if (cur && want.weight === 0 && next && next.at - t < 0.7) continue;
    // Shots, saves and goals cut in at once; lesser moments wait for the line to be read.
    const cut =
      want.weight > cur!?.weight && (want.weight >= 3 || (cur!.weight === 0 && shown >= 0.6));
    if (!cur || cut || shown >= (cur.weight ? HOLD.event : HOLD.context))
      lines.push({ at: t, text: want.text, weight: want.weight });
  }
  captionCache.set(record, lines);
  return lines;
}
/** What the commentator would say at frame k, before any holding. */
function rawCaption(record: MatchRecord, k: number, t: number, seen: number) {
  const f = record.frames,
    o = k * FIELDS,
    events = record.events;
  const latest = seen > 0 ? events[seen - 1] : undefined;
  const score: [number, number] = [0, 0];
  for (let i = 0; i < seen; i++) if (events[i].kind === 'goal') score[events[i].team!]++;
  if (t >= 60 && t < 68)
    return {
      text: t < 63 && latest ? latest.text : 'Half-time · a sip of water, then back out.',
      weight: 6,
    };
  if (t >= 128)
    return {
      text:
        t < 131 && latest
          ? latest.text
          : score[0] === score[1]
            ? record.match === LAST_MATCH
              ? 'Honours even. Back at sunrise for more!'
              : 'Honours even. Another game in a moment!'
            : `${TEAMS[score[0] > score[1] ? 0 : 1].name} take ${record.match === LAST_MATCH ? 'the last game of the day' : 'this one'}!`,
      weight: 6,
    };
  const half = t < 68 ? 1 : 2;
  const goals = record.goals.filter((g) => g.at <= t + 1e-9);
  const lastGoal = goals.at(-1);
  if (lastGoal && t - lastGoal.at < 4) {
    const goal = events.slice(0, seen).filter((e) => e.kind === 'goal');
    return { text: goal.at(-1)!.text, weight: 5 };
  }
  if (latest && t - latest.at < 2.5) return { text: latest.text, weight: WEIGHT[latest.kind] ?? 1 };
  if (!events.slice(0, seen).some((e) => e.kind === 'kickoff' && e.at >= (half === 1 ? 0 : 68)))
    return {
      text: `The teams line up. ${TEAMS[half === 1 ? record.kickoff : 1 - record.kickoff].name} to kick off.`,
      weight: 0,
    };
  // A steady line about who has the ball, chosen per spell of possession.
  const code = f[o + BALL_AT + 6];
  const owner = code >= 0 ? code : null;
  const restart = RESTART_KINDS[f[o + META_AT + 6]];
  const attackingCode = f[o + META_AT + 5];
  const attacking = attackingCode < 0 ? null : (attackingCode as 0 | 1);
  const seed = Math.floor(f[o + META_AT + 7] * 20) + (owner ?? 11) * 7;
  // After a goal the side that conceded restarts; otherwise whoever has the ball.
  const kicking = lastGoal
    ? ((1 - lastGoal.team) as 0 | 1)
    : ((half === 1 ? record.kickoff : 1 - record.kickoff) as 0 | 1);
  const team = owner !== null ? (owner < 5 ? 0 : 1) : restart === 'kickoff' ? kicking : attacking;
  const direction = team === null || (team === 0) === (half === 1) ? 1 : -1;
  const bx = f[o + BALL_AT],
    by = f[o + BALL_AT + 1];
  const u = (bx - (direction > 0 ? PITCH.left : PITCH.right)) * direction;
  const speed = Math.sqrt(f[o + BALL_AT + 3] ** 2 + f[o + BALL_AT + 4] ** 2);
  const key = restart
    ? restart
    : owner === null
      ? speed > 2.2 && team !== null
        ? 'moving'
        : 'loose'
      : f[o + BALL_AT + 7] === 1 && owner % 5 === 0
        ? 'keeper'
        : u < 3.2
          ? 'back'
          : u < 6.4
            ? 'middle'
            : 'final';
  // Whoever is nearest the ball takes a restart.
  let near = 0,
    bd = Infinity;
  for (let id = 0; id < 10; id++) {
    const dx = f[o + id * PF] - bx,
      dy = f[o + id * PF + 1] - by;
    if (dx * dx + dy * dy < bd) {
      bd = dx * dx + dy * dy;
      near = id;
    }
  }
  return {
    text: contextLine(key, seed, owner ?? (restart ? near : null), team),
    weight: 0,
  };
}
export function footballAt(minutes: number, day = 0): FootballState {
  // `day` is the shared 24-minute town cycle, not a local calendar date.
  // Replay the same six fixtures throughout a UTC date; refresh at UTC midnight.
  const utcDay = Math.floor((day * TOWN_DAY_MS) / UTC_DAY_MS);
  const time = ((minutes % 1440) + 1440) % 1440;
  if (time >= 355 && time < 360) prefetch(utcDay, 0);
  if (time < 360 || time >= 1200) return closedState(day);
  const match = Math.floor((time - 360) / 140);
  const elapsed = (time - 360) % 140;
  const record = footballRecord(utcDay, match);
  if (elapsed > 110 && match < 5) prefetch(utcDay, match + 1);
  const frames = record.frames;
  // Linear interpolation between the two recorded frames around `elapsed`.
  const position = elapsed * HZ;
  let k = Math.floor(position),
    f = position - k;
  if (k >= FRAMES) {
    k = FRAMES - 1;
    f = 1;
  }
  const a = k * FIELDS,
    b = a + FIELDS;
  const at = (i: number) => frames[a + i] + (frames[b + i] - frames[a + i]) * f;
  const phase: FootballState['phase'] =
    elapsed < 60 ? 'first' : elapsed < 68 ? 'halftime' : elapsed < 128 ? 'second' : 'fulltime';
  const half = elapsed < 68 ? 1 : 2;
  const gameTime = Math.min(60, elapsed) + Math.max(0, Math.min(60, elapsed - 68));
  const seconds = Math.floor(gameTime * 5);
  // Blended facing, renormalised; a turn through the opposite direction keeps the earlier frame.
  const facing = (i: number) => {
    let x = at(i),
      y = at(i + 1),
      l = Math.sqrt(x * x + y * y);
    if (l < 1e-3) {
      x = frames[a + i];
      y = frames[a + i + 1];
      l = Math.sqrt(x * x + y * y) || 1;
    }
    return { x: x / l, y: y / l };
  };
  // Action progress: interpolate within one action, wrap looping ones, never blend two actions.
  const progress = (i: number, loop: boolean) => {
    const from = frames[a + i],
      to = frames[b + i];
    if (frames[a + i - 1] !== frames[b + i - 1]) return from;
    if (to >= from) return from + (to - from) * f;
    return loop ? (from + (to + 1 - from) * f) % 1 : from;
  };
  const players: FootballPlayer[] = [];
  for (let id = 0; id < 10; id++) {
    const p = id * PF,
      profile = playerProfile(id),
      action = ACTIONS[frames[a + p + 6]];
    players.push({
      x: at(p),
      y: at(p + 1),
      id,
      team: id < 5 ? 0 : 1,
      number: profile.number,
      name: profile.name,
      role: profile.role,
      facing: facing(p + 2),
      speed: at(p + 4),
      stride: at(p + 5),
      action,
      actionT: progress(p + 7, action === 'celebrate' || action === 'wave' || action === 'drink'),
      dive: at(p + 8),
      hasBall: frames[a + p + 9] === 1,
    });
  }
  const referee: FootballReferee = {
    x: at(REF_AT),
    y: at(REF_AT + 1),
    facing: facing(REF_AT + 2),
    speed: at(REF_AT + 4),
    stride: at(REF_AT + 5),
    action: REF_ACTIONS[frames[a + REF_AT + 6]],
    actionT: progress(REF_AT + 7, false),
  };
  const ownerCode = frames[a + BALL_AT + 6];
  const ball: FootballBall = {
    x: at(BALL_AT),
    y: at(BALL_AT + 1),
    height: at(BALL_AT + 2),
    vx: frames[b + BALL_AT + 3],
    vy: frames[b + BALL_AT + 4],
    spin: at(BALL_AT + 5),
    owner: ownerCode === -2 ? null : ownerCode,
    held: frames[a + BALL_AT + 7] === 1,
  };
  const events = record.events.slice(0, upTo(record.events, elapsed)).map((e) => ({ ...e }));
  const score: [number, number] = [0, 0],
    shots: [number, number] = [0, 0],
    onTarget: [number, number] = [0, 0],
    saves: [number, number] = [0, 0],
    corners: [number, number] = [0, 0];
  for (const e of events) if (e.kind === 'goal') score[e.team!]++;
  const counts = { shot: shots, onTarget, save: saves, corner: corners };
  for (const m of record.marks.slice(0, upTo(record.marks, elapsed))) counts[m.kind][m.team]++;
  const held = [frames[a + META_AT], frames[a + META_AT + 1]];
  const total = held[0] + held[1];
  const first = total > 0 ? Math.round((held[0] / total) * 100) : 50;
  const lastGoal = record.goals[upTo(record.goals, elapsed) - 1];
  const scoring =
    !!lastGoal && elapsed - lastGoal.at < 4 && lastGoal.at < (elapsed < 68 ? 60 : 128);
  const attackingCode = frames[a + META_AT + 5];
  const attacking = attackingCode < 0 ? null : (attackingCode as 0 | 1);
  const restart = RESTART_KINDS[frames[a + META_AT + 6]];
  const lines = captionsOf(record);
  const caption = lines[upTo(lines, Math.min(elapsed, MATCH.length)) - 1].text;
  return {
    live: true,
    day,
    match,
    elapsed,
    half,
    phase,
    clock: `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
    remaining: Math.ceil((phase === 'halftime' ? 68 : 140) - elapsed),
    score,
    shots,
    onTarget,
    saves,
    corners,
    possession: [first, 100 - first],
    caption,
    events,
    players,
    referee,
    ball,
    attacking,
    direction: half === 1 ? [1, -1] : [-1, 1],
    restart,
    goal: scoring,
    celebration: scoring
      ? { team: lastGoal.team, player: lastGoal.player, since: lastGoal.at }
      : null,
    excitement: Math.max(0, Math.min(1, at(META_AT + 2))),
    net: [at(META_AT + 3), at(META_AT + 4)],
    sounds: record.sounds.map((sound) => ({ ...sound })),
  };
}

export function footballListening(
  camera: { x: number; y: number; zoom: number },
  width: number,
  height: number,
) {
  const center = project(FOOTBALL_CENTER.x, FOOTBALL_CENTER.y);
  const x = center.x * camera.zoom + camera.x,
    y = center.y * camera.zoom + camera.y;
  const visible = x > 0 && x < width && y > 0 && y < height;
  const distance = Math.hypot((x - width / 2) / (width / 2), (y - height / 2) / (height / 2));
  return {
    gain: visible
      ? Math.max(0, Math.min(1, (camera.zoom - 0.45) / 0.65)) * Math.max(0, 1 - distance * 0.45)
      : 0,
    pan: Math.max(-1, Math.min(1, (x / width - 0.5) * 1.5)),
  };
}
