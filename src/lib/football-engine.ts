import type {
  FootballAction,
  FootballEvent,
  FootballEventKind,
  FootballSound,
} from './football.ts';
import { BALL_TURN, ROSTERS, STRIDE_CYCLE, TEAMS } from './football.ts';
import { hash } from './world.ts';

/*
 * The Meadow Ground match engine: a deterministic five-a-side match, simulated once per
 * (UTC day, match) at a fixed 20 Hz tick from a seeded integer PRNG and recorded frame by frame.
 *
 * Every viewer must reach the same decisions to the last bit, so the simulation only uses
 * + - * /, Math.sqrt, floor/round/abs/min/max and integer ops (no trigonometry, pow or exp).
 * football.ts imports this module, so values imported from it are only read inside functions.
 */

export const HZ = 20;
export const FRAMES = 140 * HZ;
const DT = 1 / HZ;

// Pitch geometry in tile units (see PITCH and GOAL_MOUTH in football.ts).
const L = 10.8,
  R = 20.2,
  TOP = 22.75,
  BOT = 27.25,
  MID = 15.5,
  CY = 25,
  LEN = 9.4;
const POST_A = 24.2,
  POST_B = 25.8,
  POST_R = 0.07,
  BAR = 22,
  NET = 0.45,
  ROOF = 18;
// Gaits and caps, tiles per second.
const WALK = 0.7,
  JOG = 1.2,
  SPRINT = 2,
  DIVE = 3.5,
  BALL_MAX = 8;
/** The steepest a shot can rise, px/s. */
const MAX_LIFT = 120;
/** Rolling deceleration on grass (tiles/s²) and gravity (screen px/s²). */
const ROLL = 1.8,
  G = 150;
/** Ball heights (px) a player can meet with feet, chest, head, or a keeper's hands. */
const FEET = 7,
  CHEST = 15,
  HEAD = 30,
  HANDS = 34;
/** A ball passing this near a player's centre (tiles) runs into the body. */
const BODY = 0.16;
// The ball stops against the advertising boards (far side y 22.5, west end x 10.3), the
// crowd rail (y 27.62) and the hedge behind the board-free east end; people stay in front
// of the boards, dugouts and rail.
const BALL_EDGE = { left: 10.4, right: 20.85, top: 22.6, bottom: 27.55 };
const BODY_EDGE = { left: 10.42, right: 20.84, top: 22.62, bottom: 27.5 };

/** The fixed kick-off picture shared by elapsed 0 and 140 of every match (mirrored at 68). */
export const LINEUP: readonly { x: number; y: number }[] = [
  { x: 11.5625, y: 25 },
  { x: 13, y: 25 },
  { x: 14.25, y: 23.625 },
  { x: 14.25, y: 26.375 },
  { x: 14.5625, y: 25 },
  { x: 19.4375, y: 25 },
  { x: 18, y: 25 },
  { x: 16.75, y: 26.375 },
  { x: 16.75, y: 23.625 },
  { x: 16.4375, y: 25 },
];
export const REF_SPOT = { x: 15.5, y: 23.75 } as const;
export const CENTRE_SPOT = { x: 15.5, y: 25 } as const;
/** Team 0 attacks +x in the first half; the second-half picture is the point reflection. */
export const lineupAt = (id: number, half: number) => LINEUP[half === 2 ? (id + 5) % 10 : id];

// ---------------------------------------------------------------- recorded frame layout
export const ACTIONS: readonly FootballAction[] = [
  'stand',
  'run',
  'kick',
  'tackle',
  'dive',
  'catch',
  'throw',
  'celebrate',
  'slide',
  'dejected',
  'wave',
  'drink',
  'handshake',
];
export const REF_ACTIONS = ['stand', 'run', 'whistle', 'point', 'carry'] as const;
export const RESTART_KINDS = [null, 'kickoff', 'throw-in', 'goal-kick', 'corner'] as const;
/** Per player: x y fx fy speed stride action actionT dive hasBall. */
export const PF = 10;
/** Referee: x y fx fy speed stride action actionT. */
export const REF_AT = 100;
/** Ball: x y height vx vy spin owner(-2 = loose) held. */
export const BALL_AT = 108;
/** Match: possession0 possession1 excitement net0 net1 attacking(-1) restart ownerSince. */
export const META_AT = 116;
export const FIELDS = 124;
const ACTION_CODE = Object.fromEntries(ACTIONS.map((a, i) => [a, i])) as Record<
  FootballAction,
  number
>;
const LOOPS: Partial<Record<FootballAction, number>> = {
  celebrate: 0.5,
  wave: 0.8,
  drink: 1.6,
};

export type StatMark = {
  at: number;
  team: 0 | 1;
  kind: 'shot' | 'onTarget' | 'save' | 'corner';
};
export type MatchStats = {
  passes: [number, number];
  completed: [number, number];
  turnovers: [number, number];
  tackles: [number, number];
  inPlay: number;
  maxSpeed: number;
  maxKeeper: number;
  maxBall: number;
  maxRef: number;
  spacing: number;
  /** What carriers chose and how moves ended (`lost:`, `out:`), for tuning. */
  choices: Record<string, number>;
};
export type MatchRecord = {
  frames: Float32Array;
  events: FootballEvent[];
  sounds: FootballSound[];
  marks: StatMark[];
  /** Goals with the player who celebrates (the scorer, or a teammate after an own goal). */
  goals: { at: number; team: 0 | 1; player: number }[];
  /** The team kicking off the first half. */
  kickoff: 0 | 1;
  /** The match of the day, 0..5; after the last the teams leave instead of lining up. */
  match: number;
  stats: MatchStats;
};

// ---------------------------------------------------------------- helpers
type Vec = { x: number; y: number };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const len = (x: number, y: number) => Math.sqrt(x * x + y * y);
const dist = (a: Vec, b: Vec) => len(a.x - b.x, a.y - b.y);
const ownLine = (d: number) => (d > 0 ? L : R);
/** Team frame: u from the own goal line toward the attacked goal, w across (left < 0). */
const toU = (d: number, x: number) => (x - ownLine(d)) * d;
const toW = (d: number, y: number) => (y - CY) * d;
const fromUW = (d: number, u: number, w: number): Vec => ({
  x: ownLine(d) + u * d,
  y: CY + w * d,
});
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Distance from p to the segment a→b. */
function segDist(p: Vec, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax,
    dy = by - ay,
    l2 = dx * dx + dy * dy;
  const f = l2 < 1e-12 ? 0 : clamp(((p.x - ax) * dx + (p.y - ay) * dy) / l2, 0, 1);
  return len(p.x - ax - dx * f, p.y - ay - dy * f);
}
// Fixed rotations (no trigonometry at run time).
const TURNS = [
  [1, 0],
  [0.8192, 0.5736],
  [0.8192, -0.5736],
  [0.342, 0.9397],
  [0.342, -0.9397],
  [-0.342, 0.9397],
  [-0.342, -0.9397],
] as const;
export const matchMinute = (t: number) => {
  const game = Math.min(60, t) + Math.max(0, Math.min(60, t - 68));
  return Math.min(10, Math.floor(Math.floor(game * 5) / 60) + 1);
};

// ---------------------------------------------------------------- state
type KickKind =
  | 'pass'
  | 'through'
  | 'switch'
  | 'lofted'
  | 'cross'
  | 'back'
  | 'shot'
  | 'clear'
  | 'throw'
  | 'roll'
  | 'punt'
  | 'kickoff'
  | 'corner'
  | 'goal-kick'
  | 'return';
type Kick = Vec & {
  at: number;
  kind: KickKind;
  to: number;
  speed: number;
  lift: number;
  score: number;
};
type Man = Vec & {
  id: number;
  team: 0 | 1;
  slot: number;
  keeper: boolean;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  stride: number;
  speed: number;
  act: FootballAction;
  actAt: number;
  actDur: number;
  hold: boolean;
  dive: number;
  diveDir: number;
  diveV: number;
  diveBurst: number;
  stun: number;
  guard: number;
  /** Beaten to a cross in the air until this time: they go up late and leave the ball. */
  beat: number;
  decide: number;
  since: number;
  dribX: number;
  dribY: number;
  pace: number;
  kick: Kick | null;
  run: (Vec & { until: number }) | null;
  arrived: number;
  shaped: boolean;
  /** Eased shape target. */
  sx: number;
  sy: number;
  // Intent for this tick.
  tx: number;
  ty: number;
  want: number;
  by: number;
  face: Vec | null;
  snap: boolean;
  /** Separation push for this tick (tiles/s), so bodies never overlap. */
  px: number;
  py: number;
  /** A presser's step-in tackle runs until this time. */
  lunge: number;
  /** The open spot a supporter picked (an index into LOOKS), re-chosen every other tick. */
  look: number;
  /** Going for the ball this tick: nobody else's body moves the target. */
  fetch: boolean;
  /** When a teammate's pass last reached this player (-9 never), who played it and when,
   * and whether the commentary already told it. */
  fed: number;
  fedBy: number;
  fedAt: number;
  fedTold: boolean;
};
type RefAction = (typeof REF_ACTIONS)[number];
type Ref = Vec & {
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  stride: number;
  speed: number;
  act: RefAction;
  actAt: number;
  tx: number;
  ty: number;
  want: number;
  by: number;
  face: Vec | null;
  snap: boolean;
  px: number;
  py: number;
};
type Ball = Vec & {
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rvx: number;
  rvy: number;
  spin: number;
  owner: number | null;
  mode: 'free' | 'feet' | 'hands' | 'placed';
  phase: number;
  amp: number;
  lift: number;
  spot: Vec;
  net: -1 | 0 | 1;
};
type Pass = { from: number; to: number; team: 0 | 1; kind: KickKind; at: number; oneTwo: boolean };
type Shot = {
  by: number;
  team: 0 | 1;
  keeper: number;
  outcome: 'goal' | 'save' | 'miss' | 'post' | 'block';
  at: number;
  y: number;
  blocker: number;
  catchIt: boolean;
  tip: boolean;
  /** A high save tipped over the bar. */
  over: boolean;
  /** A block that deflects the ball wide of the post, for a corner. */
  deflect: boolean;
  /** Struck straight into a keeper still down from an earlier dive: kept out with the body. */
  body: boolean;
  diveAt: number;
  /** Dive direction along y (-1, 0, 1) and the lateral distance it covers. */
  diveTo: number;
  diveReach: number;
  dived: boolean;
  big: boolean;
};
type SetPiece = {
  kind: 'kickoff' | 'throw-in' | 'goal-kick' | 'corner';
  team: 0 | 1;
  taker: number;
  spot: Vec;
  stage: 'fetch' | 'carry' | 'set' | 'ready';
  readyAt: number;
  from: number;
  /** A kick-off after a goal rather than at the start of a half. */
  again?: boolean;
};
type Goal = {
  team: 0 | 1;
  scorer: number;
  at: number;
  side: 0 | 1;
  spot: Vec;
  thrown: boolean;
  /** When the scorer's knee slide began, or -1. */
  slid: number;
};
type Mode = 'pre' | 'play' | 'restart' | 'goal' | 'break';
type Sim = {
  day: number;
  match: number;
  k: number;
  t: number;
  rng: () => number;
  talk: () => number;
  men: Man[];
  ref: Ref;
  ball: Ball;
  half: 1 | 2;
  dir: [number, number];
  first: 0 | 1;
  mode: Mode;
  poss: 0 | 1 | null;
  last: number;
  lastTeam: 0 | 1 | null;
  pass: Pass | null;
  shot: Shot | null;
  set: SetPiece | null;
  goal: Goal | null;
  presser: [number, number];
  /** Until when each side holds its block instead of pressing (after kick-offs and goal kicks). */
  calm: [number, number];
  /** Until when each side keeps the ball patiently (just after its kick-off). */
  settle: [number, number];
  /** When the last kick-off was played (both sides are choosy about shooting just after). */
  kicked: number;
  nextRun: [number, number];
  /** Each side's appetite for a shot this match (a little more or less trigger-happy). */
  mood: [number, number];
  /** Until when a loose ball off a save, a block or the woodwork invites a first-time finish. */
  rebound: number;
  reboundTeam: 0 | 1;
  /** Passes completed in the current spell of possession, and whose spell it is. */
  chain: number;
  chainTeam: 0 | 1 | null;
  /** Where the referee watches a restart from, re-chosen every few ticks. */
  refLook: Vec;
  refLookK: number;
  /** At a break: the player fetching the ball for the referee (-1 undecided, -2 none). */
  helper: number;
  /** At a break: the ball has been knocked back to die on the centre spot. */
  rolled: boolean;
  score: [number, number];
  onTargetOpen: [number, number];
  possTime: [number, number];
  events: FootballEvent[];
  sounds: FootballSound[];
  marks: StatMark[];
  goals: MatchRecord['goals'];
  bulge: [number, number];
  excite: number;
  since: number;
  lastLine: string;
  /** How often each commentary line (key + index) has been used this match. */
  used: Record<string, number>;
  stats: MatchStats;
  spacingSum: number;
  spacingN: number;
  path: Float64Array;
  pathOk: boolean;
  /** Everyone's position at the start of the tick, for order-free body contact. */
  pos: Float64Array;
};

// ---------------------------------------------------------------- commentary
const LINES: Record<string, string[]> = {
  kickoff: [
    '{t} get us under way.',
    "We're off! {t} kick off.",
    '{t} start from the centre.',
    'And away we go. {t} kick off.',
  ],
  restart: [
    '{t} restart from the centre.',
    'Back under way. {t} go again.',
    '{t} kick off. Can they hit back?',
  ],
  long: [
    '{p} spreads it wide to {q}.',
    'A raking ball from {p} finds {q}.',
    '{p} goes long for {q}.',
    'Lovely range from {p}, out to {q}.',
  ],
  switch: [
    '{p} switches it to {q}.',
    '{p} swings it across to {q}.',
    'Out to {q} on the far side.',
  ],
  through: [
    '{p} slides {q} through!',
    'Lovely weight from {p}. {q} is away!',
    '{p} threads it in behind for {q}.',
    'Through ball from {p}. {q} chases.',
  ],
  oneTwo: [
    '{p} and {q} play a neat one-two.',
    'Give and go! {q} gets it back from {p}.',
    'Quick one-two between {q} and {p}.',
  ],
  back: ['{p} plays it back to {q}.', 'Safe ball back to {q}.', '{p} goes back to the keeper.'],
  box: ['{p} picks out {q} in the box!', '{p} finds {q} near goal.', 'In to {q}. Danger here!'],
  forward: [
    '{p} finds {q}.',
    '{p} plays it into {q}.',
    'Neat ball from {p} to {q}.',
    '{p} slips it to {q}.',
    '{p} feeds {q}.',
  ],
  setup: [
    '{p} lays it on for {q}.',
    '{p} picks out {q}.',
    'Lovely ball from {p} to {q}.',
    '{p} tees up {q}.',
  ],
  cross: [
    '{p} whips in a cross!',
    '{p} lofts it into the box…',
    'In comes the cross from {p}.',
    '{p} swings it in.',
  ],
  cornerKick: ['{p} swings in the corner…', '{p} takes the corner.', 'Corner from {p}. Heads up!'],
  dribble: [
    '{p} skips past {q}!',
    '{p} dances away from {q}.',
    'Nutmeg! {p} leaves {q} behind.',
    '{p} glides past {q}.',
    'Lovely feet from {p} to beat {q}.',
  ],
  tackle: [
    'Strong tackle from {p}.',
    '{p} nicks it off {q}.',
    '{p} slides in and wins it!',
    'Superb timing from {p}.',
    '{p} wins it back for {t}.',
  ],
  poke: ['{p} pokes it away from {q}.', '{p} gets a toe to it!', '{p} knocks it loose from {q}.'],
  interception: [
    '{p} reads it and steps in.',
    'Cut out by {p}!',
    '{p} intercepts.',
    '{p} was waiting for that one.',
  ],
  claim: ['{p} comes out to claim it.', 'Safe hands from {p}.', '{p} plucks it out of the air.'],
  shot: ['{p} shoots!', '{p} lets fly!', '{p} goes for goal…', '{p} pulls the trigger!'],
  longShot: [
    '{p} tries one from distance!',
    'A long-range effort from {p}!',
    '{p} has a go from way out!',
  ],
  header: ['{p} rises to head it…', 'Header from {p}!', '{p} gets a head to it!'],
  volley: ['{p} volleys!', 'First time from {p}!', '{p} hits it on the half-volley!'],
  rebound: [
    '{p} pounces on the rebound!',
    'Follow-up from {p}!',
    '{p} gets there first and shoots!',
  ],
  goal: [
    'GOAL! {p} scores for {t}! {s}',
    'GOAL! {p} finds the corner! {s}',
    'GOAL! What a finish from {p}! {s}',
    'GOAL! {p} makes no mistake! {s}',
    'GOAL! {p} buries it! {s}',
  ],
  ownGoal: ['Own goal! It goes in off {p}. {s}', 'Oh no! {p} turns it into the net. {s}'],
  straight: ['Straight at {k}.', 'Comfortable for {k}.', '{k} holds on to it.', 'Right at {k}.'],
  diveSave: [
    'Great save by {k}!',
    '{k} gets down well to save.',
    '{k} gathers it at full stretch.',
  ],
  beaten: [
    '{k} blocks it with the body.',
    'Straight at {k}, who beats it away.',
    '{k} gets in the way of it.',
  ],
  bigSave: ['What a save from {k}!', 'Brilliant stop by {k}!', '{k} flies across to keep it out!'],
  parry: ['{k} parries it away!', 'Pushed away by {k}!', '{k} beats it out!'],
  tipped: ['{k} tips it round the post!', 'Fingertip save from {k}!', '{k} turns it behind!'],
  tippedOver: ['{k} tips it over the bar!', 'Up and over, thanks to {k}!', '{k} claws it over!'],
  wide: [
    '{p} drags it wide.',
    'Wide from {p}!',
    '{p} pulls it past the post.',
    'Just wide! So close from {p}.',
  ],
  over: ['Over the bar from {p}.', '{p} blazes it over.', 'High and handsome from {p}. Over.'],
  post: [
    'Off the post! {p} is denied by the woodwork!',
    '{p} rattles the post!',
    'Clang! {p} hits the upright!',
  ],
  bar: ['{p} hits the bar!', 'Off the crossbar from {p}!', 'The bar saves {t}!'],
  block: ['Blocked by {q}!', '{q} throws a body in the way!', 'Charged down by {q}.'],
  deflected: ['Deflected off {q}!', 'It takes a big deflection off {q}!', '{q} sticks out a leg!'],
  touch: [
    '{p} aims for touch.',
    '{p} looks to put it out.',
    'Safety first from {p}, towards touch.',
  ],
  behind: [
    '{p} knocks it towards the corner flag.',
    '{p} shovels it wide of the post.',
    'Safety first from {p}, wide of goal.',
  ],
  clearance: [
    '{p} hacks it clear.',
    '{p} clears the danger.',
    'Big clearance from {p}.',
    '{p} boots it away.',
  ],
  corner: ['Corner to {t}.', '{t} win a corner.', 'Out for a corner. {t} pile forward.'],
  goalKick: ['Goal kick to {t}.', 'Out for a goal kick.', '{k} will restart for {t}.'],
  throwIn: ['Throw-in to {t}.', 'Out of play. {t} throw.', '{t} have a throw.'],
  halfTime: ['Half-time: {s}.'],
  fullTime: ['Full-time: {s}!'],
};
const scoreLine = (s: Sim) => `${TEAMS[0].name} ${s.score[0]}–${s.score[1]} ${TEAMS[1].name}`;
const nameOf = (id: number) => (id >= 0 ? ROSTERS[id < 5 ? 0 : 1][id % 5].name : '');
function say(s: Sim, key: string, v: { p?: number; q?: number; k?: number; t?: number | null }) {
  const lines = LINES[key];
  const fill = (line: string) =>
    line
      .replace('{p}', nameOf(v.p ?? -1))
      .replace('{q}', nameOf(v.q ?? -1))
      .replace('{k}', nameOf(v.k ?? -1))
      .replace('{t}', v.t === null || v.t === undefined ? '' : TEAMS[v.t].name)
      .replace(
        '{s}',
        key === 'goal' || key === 'ownGoal' ? `(${s.score[0]}–${s.score[1]})` : scoreLine(s),
      );
  // The least-worn wording of this moment, from a random start: lines take turns through a
  // match, and the same line never comes twice in a row.
  const start = Math.floor(s.talk() * lines.length);
  let i = start;
  for (let n = 1; n < lines.length; n++) {
    const j = (start + n) % lines.length;
    if ((s.used[`${key}${j}`] ?? 0) < (s.used[`${key}${i}`] ?? 0)) i = j;
  }
  if (fill(lines[i]) === s.lastLine) i = (i + 1) % lines.length;
  s.used[`${key}${i}`] = (s.used[`${key}${i}`] ?? 0) + 1;
  return (s.lastLine = fill(lines[i]));
}
function event(
  s: Sim,
  kind: FootballEventKind,
  team: 0 | 1 | null,
  player: number | null,
  key: string,
  v: { p?: number; q?: number; k?: number; t?: number | null } = {},
  at = s.t,
) {
  s.events.push({
    at,
    minute: matchMinute(at),
    kind,
    team,
    player,
    text: say(s, key, { t: team, p: player ?? -1, ...v }),
  });
}
function sound(s: Sim, kind: FootballSound['kind'], strength: number, at = s.t) {
  if (at >= 0 && at < 140) s.sounds.push({ at, kind, strength: Math.round(strength * 100) / 100 });
}
function tag(s: Sim, key: string) {
  s.stats.choices[key] = (s.stats.choices[key] ?? 0) + 1;
}
function mark(s: Sim, team: 0 | 1, kind: StatMark['kind']) {
  s.marks.push({ at: s.t, team, kind });
}

// ---------------------------------------------------------------- setup
function createSim(day: number, match: number): Sim {
  const seed = hash(`football:${day}:${match}`);
  const rng = prng(seed);
  const first = (rng() < 0.5 ? 0 : 1) as 0 | 1;
  const mood: [number, number] = [rng() * 0.16, rng() * 0.16];
  const men: Man[] = LINEUP.map((p, id) => ({
    x: p.x,
    y: p.y,
    id,
    team: (id < 5 ? 0 : 1) as 0 | 1,
    slot: id % 5,
    keeper: id % 5 === 0,
    vx: 0,
    vy: 0,
    fx: id < 5 ? 1 : -1,
    fy: 0,
    stride: 0,
    speed: 0,
    act: 'stand',
    actAt: 0,
    actDur: 0,
    hold: false,
    dive: 0,
    diveDir: 0,
    diveV: 0,
    diveBurst: 0,
    stun: 0,
    guard: 0,
    beat: 0,
    decide: 0,
    since: 0,
    dribX: id < 5 ? 1 : -1,
    dribY: 0,
    pace: JOG,
    kick: null,
    run: null,
    arrived: -1,
    shaped: false,
    sx: p.x,
    sy: p.y,
    tx: p.x,
    ty: p.y,
    want: 0,
    by: 0,
    face: null,
    snap: false,
    px: 0,
    py: 0,
    lunge: 0,
    look: 0,
    fetch: false,
    fed: -9,
    fedBy: -1,
    fedAt: 0,
    fedTold: false,
  }));
  const s: Sim = {
    day,
    match,
    k: 0,
    t: 0,
    rng,
    talk: prng(seed ^ 0x5bd1e995),
    men,
    ref: {
      ...REF_SPOT,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 1,
      stride: 0,
      speed: 0,
      act: 'stand',
      actAt: 0,
      tx: REF_SPOT.x,
      ty: REF_SPOT.y,
      want: 0,
      by: 0,
      face: null,
      snap: false,
      px: 0,
      py: 0,
    },
    ball: {
      ...CENTRE_SPOT,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rvx: 0,
      rvy: 0,
      spin: 0,
      owner: null,
      mode: 'placed',
      phase: 0,
      amp: 0,
      lift: 0,
      spot: { ...CENTRE_SPOT },
      net: -1,
    },
    half: 1,
    dir: [1, -1],
    first,
    mode: 'pre',
    poss: null,
    last: -1,
    lastTeam: null,
    pass: null,
    shot: null,
    set: kickoffSet(first, 0, false),
    goal: null,
    presser: [-1, -1],
    calm: [0, 0],
    settle: [0, 0],
    kicked: -99,
    nextRun: [3, 3],
    mood,
    rebound: 0,
    reboundTeam: 0,
    chain: 0,
    chainTeam: null,
    refLook: { ...REF_SPOT },
    refLookK: -9,
    helper: -1,
    rolled: false,
    score: [0, 0],
    onTargetOpen: [0, 0],
    possTime: [0, 0],
    events: [],
    sounds: [],
    marks: [],
    goals: [],
    bulge: [0, 0],
    excite: 0.2,
    since: 0,
    lastLine: '',
    used: {},
    stats: {
      passes: [0, 0],
      completed: [0, 0],
      turnovers: [0, 0],
      tackles: [0, 0],
      inPlay: 0,
      maxSpeed: 0,
      maxKeeper: 0,
      maxBall: 0,
      maxRef: 0,
      spacing: 0,
      choices: {},
    },
    spacingSum: 0,
    spacingN: 0,
    path: new Float64Array(3 * 61),
    pathOk: false,
    pos: new Float64Array(20),
  };
  return s;
}
function kickoffSet(team: 0 | 1, from: number, fetch: boolean): SetPiece {
  return {
    kind: 'kickoff',
    team,
    taker: team * 5 + 4,
    spot: { ...CENTRE_SPOT },
    stage: fetch ? 'fetch' : 'set',
    readyAt: from + 1.3,
    from,
  };
}

// ---------------------------------------------------------------- actions & intents
function act(s: Sim, m: Man, a: FootballAction, dur = 0) {
  if (m.act !== a || !LOOPS[a]) m.actAt = s.t;
  if (m.act === a && LOOPS[a]) {
    m.hold = true;
    return;
  }
  m.act = a;
  m.actDur = dur;
  m.hold = true;
}
/** Hold a looping or held pose for this tick. */
function pose(s: Sim, m: Man, a: FootballAction, dur = 0.8) {
  if (m.act !== a) {
    m.act = a;
    m.actAt = s.t;
    m.actDur = dur;
  }
  m.hold = true;
}
const busy = (s: Sim, m: Man) =>
  (m.act === 'kick' ||
    m.act === 'tackle' ||
    m.act === 'dive' ||
    m.act === 'catch' ||
    m.act === 'throw' ||
    m.act === 'slide') &&
  s.t < m.actAt + m.actDur;
function go(m: Man | Ref, x: number, y: number, want: number, face: Vec | null = null) {
  m.tx = x;
  m.ty = y;
  m.want = want;
  m.by = 0;
  m.face = face;
}
function arrive(m: Man | Ref, p: Vec, by: number, pref: number, face: Vec | null = null) {
  m.tx = p.x;
  m.ty = p.y;
  m.want = pref;
  m.by = by;
  m.face = face;
}
const paceFor = (d: number, urgent = false) =>
  d > 1.5 ? (urgent ? SPRINT : 1.6) : d > 0.45 ? JOG : d > 0.12 ? WALK : 0.4;

// ---------------------------------------------------------------- simulation entry
export function simulateMatch(day: number, match: number): MatchRecord {
  const s = createSim(day, match);
  const frames = new Float32Array((FRAMES + 1) * FIELDS);
  record(s, frames, 0);
  for (let k = 1; k <= FRAMES; k++) {
    s.k = k;
    s.t = k / HZ;
    step(s);
    record(s, frames, k);
  }
  seam(frames, BALL_AT + 5, BALL_TURN);
  for (let id = 0; id < 10; id++) seam(frames, id * PF + 5, STRIDE_CYCLE);
  seam(frames, REF_AT + 5, STRIDE_CYCLE);
  s.sounds.sort((a, b) => a.at - b.at);
  s.events.sort((a, b) => a.at - b.at);
  s.stats.spacing = s.spacingN ? s.spacingSum / s.spacingN : 0;
  return {
    frames,
    events: s.events,
    sounds: s.sounds,
    marks: s.marks,
    goals: s.goals,
    kickoff: s.first,
    match,
    stats: s.stats,
  };
}

/**
 * Every match starts from nothing run, so a distance field (ball spin, strides) would jump at
 * the join to the next kick-off. Stretch it by a hair so the match ends a whole number of
 * cycles on, and start both ends a quarter of the way in, clear of any rounding at a cycle edge.
 */
function seam(f: Float32Array, i: number, period: number) {
  const end = f[FRAMES * FIELDS + i];
  const scale = end > 0 ? (Math.max(1, Math.round(end / period)) * period) / end : 1;
  for (let k = 0; k <= FRAMES; k++) f[k * FIELDS + i] = f[k * FIELDS + i] * scale + period / 4;
}

function step(s: Sim) {
  for (const m of s.men) {
    m.hold = false;
    m.face = null;
    m.fetch = false;
  }
  s.ref.face = null;
  if (s.k === 1200 || s.k === 2560) endHalf(s);
  if (s.k === 1361) startSecondHalf(s);
  s.pathOk = false;
  // A side holding its block after a restart steps in once the ball comes into its half.
  for (const team of [0, 1] as const)
    if (s.calm[team] > s.t && toU(s.dir[team], s.ball.x) < 4.4) s.calm[team] = 0;
  if (s.mode === 'break') breakTime(s);
  else {
    if (s.mode === 'goal') goalTime(s);
    else if (s.mode === 'pre' || s.mode === 'restart') setPiece(s);
    if (s.mode === 'play' || s.mode === 'restart' || s.mode === 'goal' || s.mode === 'pre')
      think(s);
    refPlay(s);
  }
  separate(s);
  for (const m of s.men) moveMan(s, m);
  moveRef(s);
  const stopped = s.mode === 'break' && deadBall(s);
  ballStep(s);
  if (stopped) {
    s.ball.vx = 0;
    s.ball.vy = 0;
  }
  if (s.mode === 'play') {
    contacts(s);
    tackles(s);
  } else if (s.mode === 'goal') contacts(s);
  tally(s);
}

// ---------------------------------------------------------------- phases
function endHalf(s: Sim) {
  const full = s.k === 2560;
  sound(s, 'final-whistle', 0.8);
  if (full) sound(s, 'applause', 0.8, s.t + 0.7);
  s.events.push({
    at: s.t,
    minute: matchMinute(s.t),
    kind: full ? 'full-time' : 'half-time',
    team: null,
    player: null,
    text: say(s, full ? 'fullTime' : 'halfTime', {}),
  });
  s.mode = 'break';
  s.rolled = false;
  s.pass = null;
  s.shot = null;
  s.set = null;
  s.goal = null;
  s.poss = null;
  s.ref.act = 'whistle';
  s.ref.actAt = s.t;
  const b = s.ball;
  for (const m of s.men) {
    m.kick = null;
    m.run = null;
    m.arrived = -1;
  }
  if (b.owner !== null && b.owner >= 0) {
    const m = s.men[b.owner];
    if (b.mode === 'hands') {
      // A keeper or thrower hands the ball on: a gentle roll toward the referee.
      const d = dist(m, s.ref) || 1;
      launch(s, m, (s.ref.x - m.x) / d, (s.ref.y - m.y) / d, clamp(1 + d * 0.6, 1, 3), 0, 'roll');
      // A throw already winding up simply lets go.
      if (m.act !== 'throw' || s.t - m.actAt >= 0.45) act(s, m, 'throw', 0.6);
    } else {
      b.mode = 'free';
      b.owner = null;
      b.vx = m.vx * 0.7;
      b.vy = m.vy * 0.7;
    }
  } else if (b.mode === 'placed') b.mode = 'free';
}
function startSecondHalf(s: Sim) {
  s.half = 2;
  s.dir = [-1, 1];
  s.mode = 'pre';
  s.set = kickoffSet((1 - s.first) as 0 | 1, s.t, false);
  s.ball.mode = 'placed';
  s.ball.spot = { ...CENTRE_SPOT };
  s.ball.owner = null;
  s.poss = null;
  s.presser = [-1, -1];
}

/** Half-time and full-time: walk off, swap ends or shake hands, and line up again exactly. */
function breakTime(s: Sim) {
  const t = s.t,
    full = t >= 128;
  const win = s.score[0] === s.score[1] ? null : s.score[0] > s.score[1] ? 0 : 1;
  helpRef(s, full);
  const danger = goalBound(s);
  for (const m of s.men) {
    if (m.id === s.helper) continue;
    if (m.keeper && danger === (ownLine(s.dir[m.team]) === L ? 0 : 1)) {
      // A ball played before the whistle still rolling at goal: the keeper steps across to
      // stop it rather than watch it into the net.
      const p = meetPoint(s, m);
      go(m, p.x, p.y, paceFor(dist(m, p), true));
      m.fetch = true;
      continue;
    }
    const home = lineupAt(m.id, full ? 1 : 2);
    const faceHome = { x: m.team === 0 ? (full ? 1 : -1) : full ? -1 : 1, y: 0 };
    if (!full) {
      // Swap ends in lanes that never meet: Meadow along the far side, Sunset along the near
      // side, keepers just inside them. Take a drink once there and stand ready.
      const lane = m.team === 0 ? 22.95 + LANE[m.slot] : 27.05 - LANE[m.slot];
      const gap = home.x - m.x,
        way = gap > 0 ? 1 : -1;
      const crossing = (m.x - MID) * (home.x - MID) < 0 || Math.abs(m.x - MID) < 0.6;
      const off = Math.abs(m.y - lane);
      const path = off + Math.abs(gap) + Math.abs(lane - home.y);
      // The lane only while it can still be walked in time (the last 2.4 tiles are left for
      // the final run in); someone held up, like a player who fetched the ball, cuts across.
      const late = (path - 2.4) / Math.max(0.3, 66.2 - t) > 1.8;
      if (t < 60.6) brake(m);
      else if (crossing && Math.abs(gap) > 0.9 && t < 66.2 && !late) {
        const pace = clamp(path / Math.max(0.6, 66.8 - t), WALK, 1.8);
        // Ease onto the lane while heading across, then follow it to above home.
        go(m, off > 0.2 ? m.x + way * clamp(off, 0.4, 1.2) : home.x - way * 0.4, lane, pace);
      } else arrive(m, home, 67.5, m.keeper ? JOG : 0.9, dist(m, home) < 0.3 ? faceHome : null);
      if (dist(m, home) < 0.02 && m.arrived < 0) m.arrived = t;
      if (m.arrived > 0 && m.arrived < 66.2 && t < 67.2) pose(s, m, 'drink', 1.6);
      continue;
    }
    // The handshake line on halfway, each side nearer the end it takes next match.
    const line = { x: m.team === 0 ? 15.22 : 15.78, y: [25, 24.2, 23.4, 26.6, 25.8][m.slot] };
    const toLine = dist(m, line);
    const partner = { x: m.team === 0 ? 1 : -1, y: 0 };
    if (t < 130.2) {
      brake(m);
      if (win !== null && t > 128.3) pose(s, m, m.team === win ? 'celebrate' : 'dejected', 0.8);
    } else if (t < 134.6) {
      const pace = clamp(toLine / Math.max(0.4, 133.4 - t), WALK, SPRINT);
      go(m, line.x, line.y, toLine < 0.05 ? 0 : pace, toLine < 0.4 ? partner : null);
      if (t >= 133.3 && toLine < 0.15) pose(s, m, 'handshake', 1.2);
    } else if (t < 135.8) {
      go(m, line.x, line.y, toLine < 0.05 ? 0 : WALK, { x: 0, y: 1 });
      if (t > 134.75) pose(s, m, 'wave', 0.8);
    } else if (s.match === LAST_MATCH) {
      // The day's last game: no kick-off to line up for, so each side heads for its dugout
      // (in the order they stood, so no paths cross) and has a drink in front of the manager.
      const rank = [2, 1, 0, 4, 3][m.slot];
      const bench = { x: m.team === 0 ? 13 - rank * 0.4 : 18 + rank * 0.4, y: 23 };
      const d = dist(m, bench);
      go(m, bench.x, bench.y, d < 0.03 ? 0 : clamp(d / Math.max(0.4, 138.8 - t), WALK, 1.6));
      if (d < 0.3) m.face = { x: 0, y: 1 };
      if (d < 0.12) pose(s, m, 'drink', 1.6);
    } else arrive(m, home, 139.6, JOG, dist(m, home) < 0.6 ? faceHome : null);
  }
  refBreak(s, full);
}
/** Six matches a day: after the last one nobody lines up again. */
export const LAST_MATCH = 5;
/** Half-time lanes, as offsets in from each side's touchline: side by side, never in file. */
const LANE = [1.4, 0, 0.35, 0.7, 1.05];
/**
 * When the whistle leaves the ball far from the referee, the nearest player who can spare
 * the walk fetches it and throws it to them.
 */
function helpRef(s: Sim, full: boolean) {
  const t = s.t,
    b = s.ball,
    r = s.ref,
    start = full ? 128.6 : 60.6;
  if (t < start) {
    s.helper = -1;
    return;
  }
  if (s.helper === -2) return;
  if (s.helper === -1) {
    // Decide as soon as someone is clearly better placed than the referee. After the day's
    // last game the referee collects the ball himself: nobody knocks it back to the spot.
    if (b.mode === 'hands' || b.mode === 'placed' || (full && s.match === LAST_MATCH))
      return void (s.helper = -2);
    // Where the ball comes to rest, and whether a player can fetch it, knock it over and still
    // be home in time.
    const p = predict(s);
    const inNet = b.net >= 0;
    const stop = inNet ? { x: b.x, y: b.y } : { x: p[180], y: p[181] };
    // Decided once: near the referee, or with nobody to spare, the referee fetches it.
    if (dist(r, stop) < 2.5) return void (s.helper = -2);
    const spare = (full ? 139.6 : 67.5) - t - 0.6;
    // How long until it is at rest (the helper cannot knock it on before then).
    let still = 60;
    while (still > 1 && p[still * 3] === p[still * 3 - 3] && p[still * 3 + 1] === p[still * 3 - 2])
      still--;
    const rest = inNet ? 0.3 : still >= 60 ? 3.5 : still * DT;
    let best = -1,
      bd = dist(r, stop) - 0.6;
    for (const m of s.men) {
      const home = lineupAt(m.id, full ? 1 : 2);
      const d = dist(m, stop);
      // Fetching from behind a goal takes a carry out as well.
      const extra = behindGoal(stop) ? 1.2 : 0.5;
      if (d < bd && Math.max(d / SPRINT, rest) + extra + dist(stop, home) / 1.6 < spare) {
        bd = d;
        best = m.id;
      }
    }
    s.helper = best < 0 ? -2 : best;
    if (best < 0) return;
  }
  const m = s.men[s.helper];
  // Never at the cost of the line-up: out of time, leave the ball and run home.
  if (dist(m, lineupAt(m.id, full ? 1 : 2)) / 1.9 + 0.35 > (full ? 139.6 : 67.5) - t) {
    if (b.owner === m.id) {
      b.mode = 'free';
      b.owner = null;
      b.vx = 0;
      b.vy = 0;
      b.vz = 0;
    }
    m.kick = null;
    s.helper = -2;
    return;
  }
  if (b.mode === 'hands' && b.owner === m.id) {
    // Picked up from behind a goal: carry it out in front of the net, then bowl it back.
    if (behindGoal(m)) {
      go(m, clamp(m.x, L + 0.6, R - 0.6), m.y, SPRINT, { x: MID - m.x, y: 0 });
      m.fetch = true;
      return;
    }
    brake(m);
    m.face = { x: CENTRE_SPOT.x - m.x, y: CENTRE_SPOT.y - m.y };
    if (!m.kick) {
      m.kick = { ...CENTRE_SPOT, at: t + 0.3, kind: 'return', to: -1, speed: 0, lift: 0, score: 0 };
      act(s, m, 'throw', 0.6);
    } else if (t >= m.kick.at) {
      m.kick = null;
      rollToSpot(s, m, 0);
      s.helper = -2;
    }
    return;
  }
  if (b.mode !== 'free' || b.owner !== null) {
    s.helper = -2;
    return;
  }
  const near = dist(m, b) < 0.26 && b.z < 1 && len(b.vx, b.vy) < 1.2;
  if (!m.kick && !near) {
    const p = meetPoint(s, m);
    go(m, p.x, p.y, paceFor(dist(m, p), true));
    m.fetch = true;
    return;
  }
  if (!m.kick && behindGoal(b)) {
    // Behind the net a pass would only hit the netting: pick it up instead.
    b.mode = 'hands';
    b.owner = m.id;
    b.lift = 13;
    b.net = -1;
    act(s, m, 'catch', 0.4);
    return;
  }
  // At the ball: a pass along the ground that dies on the centre spot.
  brake(m);
  m.face = { x: CENTRE_SPOT.x - m.x, y: CENTRE_SPOT.y - m.y };
  if (!m.kick) {
    m.kick = { ...CENTRE_SPOT, at: t + 0.2, kind: 'return', to: -1, speed: 0, lift: 0, score: 0 };
    act(s, m, 'kick', 0.4);
  } else if (t >= m.kick.at) {
    m.kick = null;
    rollToSpot(s, m, 0);
    sound(s, 'kick', 0.45);
    s.helper = -2;
  }
}
/** The goal (0 at L, 1 at R) the loose ball is rolling or dropping into under the bar, or -1. */
function goalBound(s: Sim): -1 | 0 | 1 {
  const b = s.ball;
  // The ball knocked back to the centre spot never heads for a goal.
  if (b.mode !== 'free' || b.net >= 0 || s.rolled) return -1;
  const p = predict(s);
  for (let i = 3; i <= 180; i += 3) {
    const x0 = p[i - 3],
      x1 = p[i];
    for (const side of [0, 1] as const) {
      const line = side === 0 ? L : R,
        d = side === 0 ? -1 : 1;
      if ((x0 - line) * d > 0 || (x1 - line) * d <= 0) continue;
      const f = (x0 - line) / (x0 - x1 || 1e-9);
      const y = p[i - 2] + (p[i + 1] - p[i - 2]) * f,
        z = p[i - 1] + (p[i + 2] - p[i - 1]) * f;
      return y > POST_A && y < POST_B && z < BAR ? side : -1;
    }
    if (x1 === x0 && p[i + 1] === p[i - 2] && p[i + 2] === p[i - 1]) return -1;
  }
  return -1;
}
/**
 * After the whistle nobody plays on, but a ball still rolling at goal dies against whoever it
 * reaches first (the keeper takes it on the chest), for the referee or a helper to collect.
 */
function deadBall(s: Sim) {
  const b = s.ball;
  if (goalBound(s) < 0) return false;
  const nx = b.x + b.vx * DT,
    ny = b.y + b.vy * DT;
  let best: Man | null = null,
    bd = 9;
  for (const m of s.men) {
    if (b.z > (m.keeper ? HANDS : CHEST)) continue;
    const dd = segDist(m, b.x, b.y, nx, ny);
    if (dd < (m.keeper ? 0.34 : 0.22) && dd < bd) {
      bd = dd;
      best = m;
    }
  }
  if (!best) return false;
  const v = len(b.vx, b.vy) || 1,
    ux = b.vx / v,
    uy = b.vy / v;
  // This tick it runs on just in front of the body, on the side it came from, and stops there.
  const along = clamp((best.x - b.x) * ux + (best.y - b.y) * uy - 0.12, 0, v * DT);
  b.vx = (ux * along) / DT;
  b.vy = (uy * along) / DT;
  b.vz = Math.min(0, b.vz);
  s.pathOk = false;
  if (best.keeper && b.z > FEET) act(s, best, 'catch', 0.4);
  return true;
}
/** Behind a goal line, level with the net (where a ball rolled back would meet the netting). */
const behindGoal = (p: Vec) =>
  (p.x < L + 0.3 || p.x > R - 0.3) && p.y > POST_A - 0.35 && p.y < POST_B + 0.35;
/** Knock or bowl the ball back so that it comes to rest on the centre spot. */
function rollToSpot(s: Sim, m: Man | null, lift: number) {
  rollTo(s, m, lift, CENTRE_SPOT);
  s.rolled = true;
}
/** Knock or bowl the ball (from feet or hands) so that it comes to rest at `to`. */
function rollTo(s: Sim, m: Man | null, lift: number, to: Vec) {
  const b = s.ball;
  const D = dist(b, to) || 1,
    ux = (to.x - b.x) / D,
    uy = (to.y - b.y) / D;
  // Find the pace by rolling the ball ahead of time: the grass, the rough and any bounce.
  // The rough makes the distance jump with the pace, so a chip over it is tried as well.
  let v = 0,
    up = lift,
    miss = 99;
  for (const tryLift of [lift, lift + 14, lift + 28]) {
    let lo = 0.2,
      hi = 7;
    for (let it = 0; it < 14; it++) {
      const mid = (lo + hi) / 2;
      if (restAlong(b, ux, uy, mid, tryLift) < D) lo = mid;
      else hi = mid;
    }
    const pace = (lo + hi) / 2;
    const err = Math.abs(restAlong(b, ux, uy, pace, tryLift) - D);
    if (err < miss - 0.05) {
      miss = err;
      v = pace;
      up = tryLift;
    }
    if (miss < 0.12) break;
  }
  if (m) launch(s, m, ux, uy, v, up, 'return');
  else {
    b.mode = 'free';
    b.owner = null;
    b.vx = ux * v;
    b.vy = uy * v;
    b.vz = up;
    b.net = -1;
  }
}
/** How far along (ux, uy) the ball comes to rest when struck at `pace` with `lift`. */
function restAlong(b: Ball, ux: number, uy: number, pace: number, lift: number) {
  const c = { x: b.x, y: b.y, z: b.z, vx: ux * pace, vy: uy * pace, vz: lift };
  for (let i = 0; i < 200 && (c.vx !== 0 || c.vy !== 0 || c.z > 0 || c.vz > 0); i++) fly(c);
  return (c.x - b.x) * ux + (c.y - b.y) * uy;
}
function brake(m: Man) {
  go(m, m.x + m.vx * 0.2, m.y + m.vy * 0.2, 0);
}
function refBreak(s: Sim, full: boolean) {
  const r = s.ref,
    b = s.ball,
    t = s.t;
  const standBy = full ? 139.7 : 67.7;
  // After the day's last game the referee keeps the ball: no kick-off to set it down for.
  const last = full && s.match === LAST_MATCH;
  if (t < (full ? 128.6 : 60.6)) {
    r.act = 'whistle';
    go(r, r.x + r.vx * 0.2, r.y + r.vy * 0.2, 0);
    return;
  }
  // Fetch the ball, carry it to the centre spot, set it down, and step back to the circle,
  // at whatever pace the time left demands; short of time, bowl it onto the spot instead.
  const drop = { x: CENTRE_SPOT.x, y: CENTRE_SPOT.y - 0.14 };
  if (!last && b.mode === 'free' && b.net < 0 && b.z < 0.5 && len(b.vx, b.vy) < 0.05) {
    // A ball that comes to rest on the spot is set there; one that stops short is fetched.
    if (dist(b, CENTRE_SPOT) < 0.3) {
      b.mode = 'placed';
      b.owner = null;
      b.spot = { ...CENTRE_SPOT };
    }
    s.rolled = false;
  }
  // Last resorts that keep the kick-off picture exact: out of time, the ball is set on the
  // spot from wherever it is, and the referee leaves it to step back in time.
  const left = standBy - t;
  const rolling = s.rolled && b.mode === 'free' && len(b.vx, b.vy) > 0.05;
  const onHand = b.mode === 'hands' && b.owner === -1 && dist(r, drop) < 0.5;
  if (
    !last &&
    b.mode !== 'placed' &&
    ((left < 1.6 && !rolling && !onHand) || left < 0.9 || dist(r, REF_SPOT) / 1.9 + 0.3 > left)
  ) {
    b.mode = 'placed';
    b.owner = null;
    b.spot = { ...CENTRE_SPOT };
    b.net = -1;
    s.rolled = false;
  }
  const holding = b.mode === 'hands' && b.owner === -1;
  const placed = b.mode === 'placed';
  let stop = ballStop(s),
    lob = false;
  if (b.mode === 'free' && b.z > 3) {
    // A ball in the air: meet it where it comes down to catching height.
    const p = predict(s);
    for (let i = 1; i <= 60; i++) {
      const z = p[i * 3 + 2],
        at = { x: p[i * 3], y: p[i * 3 + 1] };
      if (z > 4 && z < 20 && p[i * 3 + 2] < p[i * 3 - 1] && i * DT * SPRINT >= dist(r, at) - 0.3) {
        stop = at;
        lob = true;
        break;
      }
    }
  }
  const path =
    (placed || s.rolled ? 0 : holding ? dist(r, drop) : dist(r, stop) + dist(stop, drop)) +
    (placed || s.rolled ? dist(r, REF_SPOT) : dist(drop, REF_SPOT));
  // Paced to be done with a second to spare: players crossing can hold the referee up.
  const pace = clamp(
    (path * 1.3) / Math.max(0.4, standBy - t - (placed ? 0.6 : holding ? 1.6 : 2.1)),
    WALK,
    SPRINT,
  );
  // Set, or on its way to the spot: step back to the circle and let it come.
  if (placed || (s.rolled && b.mode === 'free'))
    return arrive(r, REF_SPOT, standBy, pace, { x: 0, y: 1 });
  if (s.helper >= 0) {
    // A player is fetching the ball and will knock it back: wait by the circle.
    return go(r, REF_SPOT.x, REF_SPOT.y + 0.3, dist(r, REF_SPOT) > 0.4 ? JOG : WALK, {
      x: b.x - r.x,
      y: b.y - r.y,
    });
  }
  if (!holding) {
    // A ball in the air is met at a run, before it drops past.
    go(r, stop.x, stop.y + (lob ? 0 : 0.05), lob ? Math.max(pace, 1.6) : pace);
    const near = len(b.x - r.x, b.y - r.y);
    // Pick it up, or catch it out of the air.
    if ((near < 0.3 && b.z < 8 && len(b.vx, b.vy) < 2.2) || (near < 0.4 && b.z > 4 && b.z < 26)) {
      b.mode = 'hands';
      b.owner = -1;
      b.lift = 12;
      b.net = -1;
    }
    return;
  }
  // At full-time the ball waits by the touchline while the teams shake hands.
  if (full && (t < 135.8 || last)) return go(r, 15.5, 22.75, Math.min(pace, JOG), { x: 0, y: 1 });
  const d = dist(r, drop);
  // Out from around the goal first, so a bowled ball never meets the netting.
  if ((r.x < L + 0.4 || r.x > R - 0.4) && Math.abs(r.y - CY) < 1.2)
    return go(r, clamp(r.x, L + 0.7, R - 0.7), r.y, SPRINT, { x: MID - r.x, y: 0 });
  // Too far to carry it and still stand ready: bowl it along the grass to the spot.
  if (d > 0.6 && (d + dist(drop, REF_SPOT)) / 1.6 + 0.8 > standBy - t) {
    r.act = 'carry';
    return rollToSpot(s, null, 0);
  }
  go(r, drop.x, drop.y, d < 0.03 ? 0 : pace, { x: 0, y: 1 });
  if (d < 0.05) {
    b.mode = 'placed';
    b.owner = null;
    b.spot = { ...CENTRE_SPOT };
  }
}

// ---------------------------------------------------------------- set pieces
/**
 * After a kick-off: how long the other side sits in its block, how long the kicking side keeps
 * the ball patiently, how far upfield (u) it takes the ball meanwhile, and how much quicker than
 * usual it reckons a marker is to a pass (so it keeps it rather than risk it).
 */
const KO_CALM = 4,
  KO_SETTLE = 4.5,
  HOLD = 5.5,
  WARY = 0.1;
function setPiece(s: Sim) {
  const sp = s.set;
  if (!sp) return;
  const t = s.t,
    b = s.ball,
    taker = s.men[sp.taker],
    d = s.dir[sp.team];
  if (sp.kind === 'kickoff') {
    const stand = { x: MID - d * 0.16, y: CY };
    if (sp.stage === 'fetch') return; // the goal sequence brings the ball back
    arrive(taker, stand, sp.readyAt - 0.1, WALK, { x: d, y: 0 });
    if (sp.stage === 'set' && t >= sp.readyAt && dist(taker, stand) < 0.05) {
      sp.stage = 'ready';
      sp.readyAt = t + 0.3;
      sound(s, 'whistle', 0.6);
      s.ref.act = 'whistle';
      s.ref.actAt = t;
      event(s, 'kickoff', sp.team, null, sp.again ? 'restart' : 'kickoff');
    }
    if (sp.stage === 'ready' && t >= sp.readyAt) {
      // Played back to whichever of the defender and the wings has the most room.
      let kick: Kick | null = null,
        top = -1;
      for (const slot of [1, 2, 3]) {
        const k = passTo(s, taker, s.men[sp.team * 5 + slot], 'kickoff');
        const score = k ? k.score * (0.75 + s.rng() * 0.5) : -1;
        if (k && score > top) {
          top = score;
          kick = k;
        }
      }
      const q = s.men[kick ? kick.to : sp.team * 5 + 1];
      kick ??= {
        ...lineupAt(q.id, s.half),
        at: t,
        kind: 'kickoff' as const,
        to: q.id,
        speed: 3,
        lift: 0,
        score: 0,
      };
      fire(s, taker, kick);
      s.mode = 'play';
      s.set = null;
      s.goal = null;
      s.poss = sp.team;
      // The other side holds its shape while the kick-off is played back and out, and the
      // kicking side keeps it for a moment before looking forward: nobody runs in behind yet.
      s.calm[1 - sp.team] = t + KO_CALM;
      s.settle[sp.team] = t + KO_SETTLE;
      s.kicked = t;
      s.nextRun[sp.team] = Math.max(s.nextRun[sp.team], t + KO_SETTLE);
    }
    return;
  }
  // Throw-ins, corners and goal kicks: collect, carry or place, then restart.
  const inward = sp.kind === 'throw-in' ? (sp.spot.y < CY ? 1 : -1) : 0;
  if (sp.stage === 'fetch') {
    if (b.owner === taker.id && b.mode === 'hands') sp.stage = 'carry';
    else {
      const p = ballStop(s);
      go(taker, p.x, p.y, paceFor(dist(taker, p), true));
      taker.fetch = true;
      if (dist(taker, b) < 0.24 && b.z < 10 && len(b.vx, b.vy) < 2.5) {
        b.mode = 'hands';
        b.owner = taker.id;
        b.lift = 13;
        b.net = -1;
        sp.stage = 'carry';
      }
      return;
    }
  }
  const stand =
    sp.kind === 'throw-in'
      ? { x: sp.spot.x, y: sp.spot.y - inward * 0.12 }
      : sp.kind === 'corner'
        ? {
            x: sp.spot.x - d * 0.12,
            y: sp.spot.y + (sp.spot.y < CY ? -0.1 : 0.1),
          }
        : { x: sp.spot.x - d * 0.18, y: sp.spot.y };
  const faceIn =
    sp.kind === 'throw-in' ? { x: 0, y: inward } : { x: MID - sp.spot.x, y: CY - sp.spot.y };
  if (sp.stage === 'carry') {
    go(
      taker,
      stand.x,
      stand.y,
      paceFor(dist(taker, stand), true),
      dist(taker, stand) < 0.4 ? faceIn : null,
    );
    if (dist(taker, stand) < 0.06) {
      if (sp.kind !== 'throw-in') {
        b.mode = 'placed';
        b.owner = null;
        b.spot = { ...sp.spot };
      }
      sp.stage = 'set';
      sp.readyAt = t + (sp.kind === 'corner' ? 0.5 : 0.3);
    }
    return;
  }
  go(taker, stand.x, stand.y, WALK, faceIn);
  if (sp.stage === 'set' && t >= sp.readyAt) {
    const kick = restartKick(s, taker, sp);
    sp.stage = 'ready';
    taker.kick = kick;
    if (sp.kind === 'throw-in') {
      act(s, taker, 'throw', 0.6);
      b.lift = 26;
      kick.at = t + 0.3;
    } else {
      act(s, taker, 'kick', 0.4);
      kick.at = t + 0.15;
    }
  }
  if (sp.stage === 'ready' && taker.kick && t >= taker.kick.at) {
    const kick = taker.kick;
    taker.kick = null;
    fire(s, taker, kick);
    s.mode = 'play';
    s.set = null;
    s.poss = sp.team;
    s.calm[1 - sp.team] = t + (sp.kind === 'goal-kick' ? 2 : sp.kind === 'throw-in' ? 0.8 : 0);
  }
}
function restartKick(s: Sim, m: Man, sp: SetPiece): Kick {
  const mates = s.men.filter((q) => q.team === m.team && q !== m);
  let best: Kick | null = null;
  if (sp.kind === 'corner' && s.rng() < 0.7) {
    const d = s.dir[m.team];
    const near = s.rng() < 0.45;
    const target = fromUW(
      d,
      8.55 + s.rng() * 0.3,
      (sp.spot.y < CY ? -1 : 1) * d * (near ? 0.45 : -0.35),
    );
    const q = mates
      .filter((q) => !q.keeper)
      .reduce((a, b) => (dist(a, target) < dist(b, target) ? a : b));
    return cross(s, q, target, 'corner');
  }
  for (const q of mates) {
    if (q.keeper && sp.kind !== 'goal-kick') continue;
    const kick = passTo(s, m, q, sp.kind === 'throw-in' ? 'throw' : 'pass');
    if (kick && (!best || kick.score > best.score)) best = kick;
    if (sp.kind === 'goal-kick' && !q.keeper) {
      const long = passTo(s, m, q, 'lofted');
      if (long && (!best || long.score * (0.6 + s.rng() * 0.6) > best.score)) best = long;
    }
  }
  if (best) return best;
  const d = s.dir[m.team];
  const p = fromUW(d, toU(d, m.x) + 3, 0);
  return { ...p, at: s.t, kind: 'clear', to: -1, speed: 4, lift: 60, score: 0 };
}

// ---------------------------------------------------------------- goals
function goalTime(s: Sim) {
  const g = s.goal!;
  const t = s.t,
    since = t - g.at,
    b = s.ball;
  const conceding = (1 - g.team) as 0 | 1;
  const dc = s.dir[conceding];
  const keeper = s.men[conceding * 5];
  const taker = s.men[conceding * 5 + 4];
  const scorer = s.men[g.scorer];
  // The scorer's side celebrates until a moment after the knee slide.
  const party = g.slid < 0 ? since < 6 : t < g.slid + 1.7;
  for (const m of s.men) {
    const home = kickoffSpot(s, m, conceding);
    if (m === keeper) continue;
    if (m === taker && since > 1.5) continue;
    if (m.team === g.team && party) {
      if (m === scorer) {
        if (since < 0.3) brake(m);
        else if (g.slid < 0 && dist(m, g.spot) > 0.95 && since < 4.4) {
          // Away to our own supporters, arms up, flat out when they are far.
          go(m, g.spot.x, g.spot.y, dist(m, g.spot) > 2.5 ? SPRINT : 1.8);
          pose(s, m, 'celebrate');
        } else if (g.slid < 0) {
          g.slid = t;
          act(s, m, 'slide', 0.9);
        } else if (t < g.slid + 0.9) {
          // The knee slide: glide on, slowing to a stop.
          const k = 1 - (t - g.slid) / 0.9;
          go(m, m.x + m.fx * 0.6, m.y + m.fy * 0.6, 1.5 * k, { x: m.fx, y: m.fy });
          m.hold = true;
        } else {
          brake(m);
          pose(s, m, 'celebrate');
        }
      } else if (m.keeper) {
        brake(m);
        if (since > 0.4 && since < 2.2) pose(s, m, 'celebrate');
        if (since >= 2.2) go(m, home.x, home.y, paceFor(dist(m, home)));
      } else {
        // Teammates chase the scorer's run from behind, then pile in around them, each to
        // their own side.
        const o = HUDDLE[m.slot];
        const rl = len(g.spot.x - scorer.x, g.spot.y - scorer.y);
        const spot =
          g.slid < 0 && rl > 0.5
            ? {
                x: scorer.x - ((g.spot.x - scorer.x) / rl) * (0.55 + m.slot * 0.2) + o[0] * 0.5,
                y: Math.min(27.45, scorer.y - ((g.spot.y - scorer.y) / rl) * 0.55 + o[1] * 0.5),
              }
            : { x: scorer.x + o[0], y: Math.min(27.45, scorer.y + o[1]) };
        const d = dist(m, spot);
        if (d > 0.1 && since > 0.3) go(m, spot.x, spot.y, d > 1 ? 1.8 : 1.1);
        else brake(m);
        if (dist(m, scorer) < 1 && since > 0.9) pose(s, m, 'celebrate');
      }
      continue;
    }
    if (m.team === conceding && since < 2.2) {
      brake(m);
      if (since > 0.3) pose(s, m, 'dejected', 0.8);
      continue;
    }
    go(
      m,
      home.x,
      home.y,
      paceFor(dist(m, home)),
      dist(m, home) < 0.3 ? { x: s.dir[m.team], y: 0 } : null,
    );
  }
  // The conceding keeper fetches the ball out of the net and sends it back to the centre.
  if (keeper.act === 'dive' && t < keeper.actAt + keeper.actDur) {
    // Beaten at full stretch: the dive plays out, landing included.
  } else if (since < 1.1) {
    brake(keeper);
    if (since > 0.3) pose(s, keeper, 'dejected', 0.8);
  } else if (!g.thrown) {
    if (b.owner === keeper.id) {
      const out = fromUW(dc, 0.45, 0);
      go(keeper, out.x, out.y, WALK, { x: dc, y: 0 });
      if (!keeper.kick && dist(keeper, out) < 0.15) {
        keeper.kick = {
          ...taker,
          at: t + 0.3,
          kind: 'return',
          to: taker.id,
          speed: 0,
          lift: 0,
          score: 0,
        };
        act(s, keeper, 'throw', 0.6);
        b.lift = 22;
      }
      if (keeper.kick && t >= keeper.kick.at) {
        keeper.kick = null;
        // Bowled out along the grass to come to rest at the kick-off taker's feet.
        rollTo(s, keeper, 0, taker);
        g.thrown = true;
      }
    } else {
      go(keeper, b.x - dc * 0.1, b.y, since < 2 ? WALK : JOG);
      if (dist(keeper, b) < 0.2 && b.z < 8) {
        b.mode = 'hands';
        b.owner = keeper.id;
        b.lift = 13;
        b.net = -1;
        act(s, keeper, 'catch', 0.5);
      }
    }
  } else {
    const home = kickoffSpot(s, keeper, conceding);
    go(keeper, home.x, home.y, paceFor(dist(keeper, home)), { x: dc, y: 0 });
  }
  // The kick-off taker collects the ball and places it on the spot.
  if (since > 1.5) {
    const spot = kickoffSpot(s, taker, conceding);
    if (b.mode === 'placed') {
      go(taker, spot.x, spot.y, paceFor(dist(taker, spot)), { x: dc, y: 0 });
    } else if (b.owner === taker.id) {
      go(taker, spot.x, spot.y, JOG, { x: dc, y: 0 });
      if (dist(b, CENTRE_SPOT) < 0.3) {
        b.mode = 'placed';
        b.owner = null;
        b.spot = { ...CENTRE_SPOT };
      }
    } else if (g.thrown) {
      // Meet the throw where it comes down, rather than chase where it will roll.
      const p = meetPoint(s, taker);
      go(taker, p.x, p.y, paceFor(dist(taker, p), true));
      taker.fetch = true;
    } else go(taker, MID - dc * 0.6, CY, WALK, { x: -dc, y: 0 });
  }
  // Referee: whistle, point to the centre, then back to the circle.
  const r = s.ref;
  if (since >= 0.8 && since < 0.85 + DT) {
    r.act = 'whistle';
    r.actAt = t;
  } else if (since > 1.3 && since < 2.9) r.act = 'point';
  if (since > 1.3) arrive(r, REF_SPOT, g.at + 6.5, WALK, { x: 0, y: 1 });
  else go(r, r.x + r.vx * 0.2, r.y + r.vy * 0.2, 0, { x: MID - r.x, y: CY - r.y });
  // Kick off once everyone is back and the ball is on the spot.
  const ready =
    b.mode === 'placed' &&
    since > 5.4 &&
    (since > 9 || s.men.every((m) => dist(m, kickoffSpot(s, m, conceding)) < 0.45));
  if (ready) {
    s.mode = 'restart';
    const walk = dist(taker, kickoffSpot(s, taker, conceding)) / WALK;
    s.set = { ...kickoffSet(conceding, t, false), readyAt: t + 0.5 + walk, again: true };
  }
}
/** Where each side's supporters stand along the near rail, whichever end they attack. */
const FAN_CORNER = [
  { x: 11.6, y: 27.4 },
  { x: 18, y: 27.4 },
] as const;
const HUDDLE = [
  [0, 0],
  [-0.5, -0.3],
  [0.45, -0.4],
  [-0.15, -0.62],
  [0.55, 0.1],
];
function kickoffSpot(s: Sim, m: Man, team: 0 | 1): Vec {
  if (m.id === team * 5 + 4) return { x: MID - s.dir[team] * 0.16, y: CY };
  return lineupAt(m.id, s.half);
}
function scored(s: Sim, side: 0 | 1) {
  const team = (s.dir[0] === (side === 1 ? 1 : -1) ? 0 : 1) as 0 | 1;
  s.score[team]++;
  const scorer = s.last >= 0 ? s.last : team * 5 + 4;
  const own = s.men[scorer].team !== team;
  if (s.onTargetOpen[team] <= 0) {
    // A goal that no shot earned (a deflection or an own goal) still counts on target.
    if (!s.shot || s.shot.team !== team) mark(s, team, 'shot');
    mark(s, team, 'onTarget');
  } else s.onTargetOpen[team]--;
  s.events.push({
    at: s.t,
    minute: matchMinute(s.t),
    kind: 'goal',
    team,
    player: own ? null : scorer,
    text: say(s, own ? 'ownGoal' : 'goal', { p: scorer, t: team }),
  });
  sound(s, 'cheer', 1);
  sound(s, 'whistle', 0.7, s.t + 0.8);
  // The final ball is always worth a line, told at the moment it was played.
  const shooter = s.men[scorer];
  if (!own && s.t - shooter.fed < 3.5 && shooter.fedBy >= 0 && !shooter.fedTold) {
    event(s, 'pass', team, shooter.fedBy, 'setup', { q: scorer }, shooter.fedAt);
    shooter.fedTold = true;
  }
  const who = own ? team * 5 + 4 : scorer;
  s.goals.push({ at: s.t, team, player: who });
  s.goal = {
    team,
    scorer: who,
    at: s.t,
    side,
    spot: { ...FAN_CORNER[team] },
    thrown: false,
    slid: -1,
  };
  s.mode = 'goal';
  s.shot = null;
  s.pass = null;
  s.poss = null;
  s.ball.net = side;
  for (const m of s.men) {
    m.kick = null;
    m.run = null;
  }
}

// ---------------------------------------------------------------- the ball
function launch(
  s: Sim,
  m: Man,
  ux: number,
  uy: number,
  speed: number,
  lift: number,
  kind: KickKind,
) {
  const b = s.ball;
  const v = Math.min(speed, BALL_MAX);
  b.mode = 'free';
  b.owner = null;
  // A ball knocked out of the back of the net is loose again.
  b.net = -1;
  b.vx = ux * v;
  b.vy = uy * v;
  b.vz = lift;
  b.amp = 0;
  if (b.z < 0.01 && lift > 0) b.z = 0.01;
  s.last = m.id;
  s.lastTeam = m.team;
  m.guard = s.t + (kind === 'shot' ? 0.5 : 0.3);
  s.since = s.t;
}
/** One step of free flight, shared by the ball and its prediction. */
function fly(b: { x: number; y: number; z: number; vx: number; vy: number; vz: number }) {
  if (b.z > 0 || b.vz > 0) {
    b.vz -= G * DT;
    b.z += b.vz * DT;
    if (b.z <= 0) {
      b.z = 0;
      if (b.vz < -38) {
        b.vz = -b.vz * 0.42;
        b.vx *= 0.8;
        b.vy *= 0.8;
      } else b.vz = 0;
    }
  } else {
    const v = len(b.vx, b.vy);
    // Longer grass beyond the lines slows the ball before it reaches the hedge.
    const off = b.x < L || b.x > R || b.y < TOP || b.y > BOT;
    const roll = off ? ROLL * 3 : ROLL;
    if (v <= roll * DT) {
      b.vx = 0;
      b.vy = 0;
    } else {
      const k = (v - roll * DT) / v;
      b.vx *= k;
      b.vy *= k;
    }
  }
  b.x += b.vx * DT;
  b.y += b.vy * DT;
  if (b.x < BALL_EDGE.left || b.x > BALL_EDGE.right) {
    b.x = clamp(b.x, BALL_EDGE.left, BALL_EDGE.right);
    b.vx *= -0.2;
    b.vy *= 0.5;
  }
  if (b.y < BALL_EDGE.top || b.y > BALL_EDGE.bottom) {
    b.y = clamp(b.y, BALL_EDGE.top, BALL_EDGE.bottom);
    b.vy *= -0.2;
    b.vx *= 0.5;
  }
}
/** Predict the loose ball for the next 3 s (60 steps) into s.path: x, y, z triples. */
function predict(s: Sim) {
  if (s.pathOk) return s.path;
  const b = s.ball,
    p = s.path;
  const c = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz };
  p[0] = c.x;
  p[1] = c.y;
  p[2] = c.z;
  for (let i = 1; i <= 60; i++) {
    fly(c);
    p[i * 3] = c.x;
    p[i * 3 + 1] = c.y;
    p[i * 3 + 2] = c.z;
  }
  s.pathOk = true;
  return p;
}
/** The first place the loose ball comes within m's reach at chest height or below. */
function meetPoint(s: Sim, m: Man): Vec {
  const b = s.ball;
  if (b.mode !== 'free' || b.net >= 0) return { x: b.x, y: b.y };
  const p = predict(s);
  for (let i = 1; i <= 60; i++) {
    const at = { x: p[i * 3], y: p[i * 3 + 1] };
    if (p[i * 3 + 2] < CHEST && dist(m, at) - 0.15 <= i * DT * SPRINT) return at;
  }
  return ballStop(s);
}
function ballStop(s: Sim): Vec {
  const b = s.ball;
  // A ball in the net stays there (the flight model knows nothing of netting).
  if (b.mode !== 'free' || b.net >= 0) return { x: b.x, y: b.y };
  const p = predict(s);
  // Where the ball will be in about a second, or where it rests.
  const i = len(b.vx, b.vy) < 0.3 ? 0 : 20;
  return { x: p[i * 3], y: p[i * 3 + 1] };
}
function ballStep(s: Sim) {
  const b = s.ball,
    ox = b.x,
    oy = b.y,
    oz = b.z;
  if (b.mode === 'feet') {
    const m = s.men[b.owner!];
    const sp = len(m.vx, m.vy);
    const cx = sp > 0.2 ? m.vx / sp : m.fx,
      cy = sp > 0.2 ? m.vy / sp : m.fy;
    const amp = m.kick ? 0 : clamp(0.04 + sp * 0.16, 0.04, 0.34);
    b.amp += (amp - b.amp) * 0.25;
    b.phase += DT / (0.42 + sp * 0.12);
    if (b.phase >= 1) b.phase -= 1;
    const reach = 0.13 + b.amp * 4 * b.phase * (1 - b.phase);
    follow(b, m.x + cx * reach, m.y + cy * reach, 0);
    keepIn(s, b);
  } else if (b.mode === 'hands') {
    const h = b.owner === -1 ? s.ref : s.men[b.owner!];
    follow(b, h.x + h.fx * 0.1, h.y + h.fy * 0.1 + 0.02, b.lift);
    keepIn(s, b);
  } else if (b.mode === 'placed') {
    glide(b, b.spot);
    if (Math.abs(b.x - b.spot.x) + Math.abs(b.y - b.spot.y) < 0.002 && b.z < 0.2) {
      b.x = b.spot.x;
      b.y = b.spot.y;
      b.z = 0;
    }
  } else {
    fly(b);
    goalFrames(s, ox, oy, oz);
    if (b.net < 0 && s.mode === 'play') lines(s, ox, oy, oz);
  }
  const moved = len(b.x - ox, b.y - oy);
  b.spin += moved;
  b.rvx = (b.x - ox) / DT;
  b.rvy = (b.y - oy) / DT;
  if (b.mode !== 'free') {
    b.vx = b.rvx;
    b.vy = b.rvy;
    b.vz = 0;
  }
}
/**
 * In play a ball at someone's feet or in a keeper's hands stays on the pitch: a carrier backed
 * onto a line keeps it on the line (still in play) rather than taking it over, above all
 * between the posts, where only a goal may cross.
 */
function keepIn(s: Sim, b: Ball) {
  if (s.mode !== 'play') return;
  b.x = clamp(b.x, L, R);
  b.y = clamp(b.y, TOP, BOT);
}
/** Kinematic ball (feet, hands, placing): close on the target without jumping. */
function follow(b: Ball, x: number, y: number, z: number, rate = 0.5) {
  let dx = (x - b.x) * rate,
    dy = (y - b.y) * rate;
  const d = len(dx, dy),
    cap = 6 * DT;
  if (d > cap) {
    dx *= cap / d;
    dy *= cap / d;
  }
  b.x += dx;
  b.y += dy;
  b.z += clamp((z - b.z) * 0.35, -4, 4);
  if (Math.abs(b.z - z) < 0.05) b.z = z;
}
/** Set down on a spot: ease in, never slower than a slow roll, and land on it exactly. */
function glide(b: Ball, to: Vec) {
  const dx = to.x - b.x,
    dy = to.y - b.y,
    d = len(dx, dy);
  const step = clamp(d * 0.3, 1.5 * DT, 6 * DT);
  if (d <= step) {
    b.x = to.x;
    b.y = to.y;
  } else {
    b.x += (dx / d) * step;
    b.y += (dy / d) * step;
  }
  b.z += clamp(-b.z * 0.35, -4, 4);
  if (b.z < 0.05) b.z = 0;
}
/** Goal frames: the net holds a scored ball; posts and netting stop balls from outside. */
function goalFrames(s: Sim, ox: number, oy: number, oz: number) {
  const b = s.ball;
  if (b.net === 0 || b.net === 1) {
    const d = b.net === 0 ? -1 : 1,
      line = b.net === 0 ? L : R,
      back = line + d * (NET - 0.06);
    if ((b.x - back) * d > 0) {
      b.x = back;
      if (Math.abs(b.vx) > 0.5) s.bulge[b.net] = 1;
      b.vx = 0;
      b.vy *= 0.3;
    }
    if ((b.x - line) * d < 0.02) b.x = line + d * 0.02;
    if (b.y < POST_A + 0.07 || b.y > POST_B - 0.07) {
      b.y = clamp(b.y, POST_A + 0.07, POST_B - 0.07);
      b.vy = 0;
    }
    if (b.z > BAR - 2) {
      b.z = BAR - 2;
      b.vz = -Math.abs(b.vz) * 0.3;
    }
    return;
  }
  for (const side of [0, 1] as const) {
    const d = side === 0 ? -1 : 1,
      line = side === 0 ? L : R;
    const inside = (x: number, y: number) =>
      (x - line) * d > 0 && (x - line) * d < NET && y > POST_A && y < POST_B;
    // Out of play the net still catches a ball rolling into the mouth.
    if (s.mode !== 'play' && (ox - line) * d <= 0 && inside(b.x, b.y) && b.z < BAR) {
      b.net = side;
      return;
    }
    // A ball dropping onto the roof net rolls off the back, or off the side where the
    // boards leave no room behind the net.
    if (inside(b.x, b.y) && oz >= ROOF && b.z < ROOF) {
      b.z = ROOF;
      b.vz = Math.abs(b.vz) * 0.15;
      const back = line + d * NET;
      if ((d < 0 ? back - BALL_EDGE.left : BALL_EDGE.right - back) > 0.05) {
        b.vx = d * 0.8;
        b.vy *= 0.5;
      } else {
        b.vx = d * 0.15;
        b.vy = b.y < CY ? -1.1 : 1.1;
      }
      continue;
    }
    if (inside(b.x, b.y) && !inside(ox, oy) && (ox - line) * d > 0 && b.z < BAR) {
      if (oy <= POST_A || oy >= POST_B) {
        b.y = oy;
        b.vy *= -0.3;
      } else {
        b.x = ox;
        b.vx *= -0.3;
      }
    }
  }
}
/** Lines: goals, woodwork, and the ball leaving the pitch. */
function lines(s: Sim, ox: number, oy: number, oz: number) {
  const b = s.ball;
  for (const side of [0, 1] as const) {
    const line = side === 0 ? L : R,
      d = side === 0 ? -1 : 1;
    if ((ox - line) * d > 0 || (b.x - line) * d <= 0) continue;
    const f = (ox - line) / (ox - b.x || 1e-9);
    const yc = oy + (b.y - oy) * f,
      zc = oz + (b.z - oz) * f;
    const post = Math.abs(yc - POST_A) <= POST_R || Math.abs(yc - POST_B) <= POST_R;
    const mouth = yc > POST_A && yc < POST_B;
    if (post && zc < BAR + 1) return woodwork(s, line, yc, false);
    if (mouth && zc >= BAR - 1.5 && zc < BAR + 1.5) return woodwork(s, line, yc, true);
    if (mouth && zc < BAR - 1.5) return scored(s, side);
    return out(s, 'goal-line', side, yc, b.x);
  }
  // A ball on the line is still in play; the guard shares the threshold, so a slow ball that
  // ends a tick on the line is still called when it crosses on the next.
  const top = TOP - 0.03,
    bot = BOT + 0.03;
  if ((oy >= top && b.y < top) || (oy <= bot && b.y > bot))
    out(s, 'touch', b.y < TOP ? 0 : 1, b.y < TOP ? TOP : BOT, b.x);
}
function woodwork(s: Sim, line: number, yc: number, bar: boolean) {
  const b = s.ball;
  b.x = line - (b.x - line) * 0.5;
  b.vx = -b.vx * (bar ? 0.4 : 0.5);
  b.vy = b.vy * 0.5 + (yc < CY ? -0.6 : 0.6) * (0.4 + s.rng());
  if (bar) b.vz = -Math.abs(b.vz) * 0.3 - 20;
  sound(s, 'post', 1);
  sound(s, 'ooh', 0.9, s.t + 0.12);
  const shooter = s.shot ? s.shot.by : s.last;
  if (shooter >= 0) {
    const team = s.men[shooter].team;
    event(s, 'post', team, shooter, bar ? 'bar' : 'post', { t: (1 - team) as 0 | 1 });
    loose(s, team);
  }
  s.shot = null;
  s.last = -1;
}
function out(s: Sim, kind: 'goal-line' | 'touch', side: 0 | 1, at: number, x: number) {
  const b = s.ball;
  const lastTeam = s.lastTeam ?? 0;
  if (s.shot && !s.shot.tip) {
    const sh = s.shot;
    const near = kind === 'goal-line' && at > POST_A - 0.4 && at < POST_B + 0.4 && b.z < BAR + 12;
    if (near) sound(s, 'ooh', 0.8, s.t + 0.1);
    event(s, 'miss', sh.team, sh.by, b.z > BAR - 1 ? 'over' : 'wide');
  }
  s.shot = null;
  s.pass = null;
  if (kind === 'touch') {
    const team = (1 - lastTeam) as 0 | 1;
    const spot = { x: clamp(x, L + 0.35, R - 0.35), y: side === 0 ? TOP : BOT };
    const taker = nearest(s, team, spot, (m) => !m.keeper);
    s.set = {
      kind: 'throw-in',
      team,
      taker: taker.id,
      spot,
      stage: 'fetch',
      readyAt: 0,
      from: s.t,
    };
    event(s, 'throw-in', team, null, 'throwIn');
    sound(s, 'whistle', 0.3, s.t + 0.15);
  } else {
    const line = side === 0 ? L : R;
    // The team defending this goal: its own line is `line`.
    const defending = (ownLine(s.dir[0]) === line ? 0 : 1) as 0 | 1;
    const attacking = (1 - defending) as 0 | 1;
    const top = at < CY;
    if (lastTeam === defending) {
      const d = s.dir[attacking];
      const spot = { x: line - d * 0.08, y: top ? TOP + 0.08 : BOT - 0.08 };
      // The wing on that side takes it, unless a teammate is much nearer the ball.
      const wing = s.men[attacking * 5 + ((top ? -1 : 1) * d < 0 ? 2 : 3)];
      s.pathOk = false;
      const p = predict(s),
        rest = { x: p[180], y: p[181] };
      const near = nearest(s, attacking, rest, (m) => !m.keeper);
      const taker = dist(near, rest) < dist(wing, rest) - 0.8 ? near : wing;
      s.set = {
        kind: 'corner',
        team: attacking,
        taker: taker.id,
        spot,
        stage: 'fetch',
        readyAt: 0,
        from: s.t,
      };
      mark(s, attacking, 'corner');
      event(s, 'corner', attacking, null, 'corner');
    } else {
      const d = s.dir[defending];
      const spot = fromUW(d, 0.55, (top ? -1 : 1) * d * 0.55);
      s.set = {
        kind: 'goal-kick',
        team: defending,
        taker: defending * 5,
        spot,
        stage: 'fetch',
        readyAt: 0,
        from: s.t,
      };
      event(s, 'goal-kick', defending, null, 'goalKick', { k: defending * 5 });
    }
    sound(s, 'whistle', 0.4, s.t + 0.15);
  }
  s.mode = 'restart';
  s.poss = s.set!.team;
  for (const m of s.men) {
    m.kick = null;
    m.run = null;
  }
}
function nearest(s: Sim, team: 0 | 1, p: Vec, ok: (m: Man) => boolean) {
  let best: Man | null = null;
  for (const m of s.men)
    if (m.team === team && ok(m) && (!best || dist(m, p) < dist(best, p))) best = m;
  return best!;
}

// ---------------------------------------------------------------- movement
/**
 * Body room as the camera sees it. Two figures side by side on screen need 0.3 tiles; one
 * standing behind the other (along the tile (1, 1) diagonal, straight up the screen) needs
 * 0.45, or the nearer figure hides the other. `apart` is 1 where two bodies just touch.
 */
const WIDE = 0.3 * Math.SQRT2,
  DEEP = 0.45 * Math.SQRT2;
function apart(dx: number, dy: number) {
  return Math.sqrt(apart2(dx, dy));
}
/** `apart` squared, for cheap comparisons. */
function apart2(dx: number, dy: number) {
  const a = (dx - dy) * INV_WIDE,
    c = (dx + dy) * INV_DEEP;
  return a * a + c * c;
}
const INV_WIDE = 1 / WIDE,
  INV_DEEP = 1 / DEEP;
/** Half the width of the box around one body's room: anything outside it is clear. */
const BOX = Math.sqrt(WIDE * WIDE + DEEP * DEEP) / 2 + 0.01;
const far = (dx: number, dy: number, box: number) => dx > box || dx < -box || dy > box || dy < -box;
/** The unit direction that opens the gap (dx, dy) fastest. */
function opening(dx: number, dy: number, out: Vec) {
  const a = (dx - dy) / (WIDE * WIDE),
    c = (dx + dy) / (DEEP * DEEP);
  const gx = a + c,
    gy = c - a,
    gl = len(gx, gy);
  out.x = gl > 1e-9 ? gx / gl : 0.6;
  out.y = gl > 1e-9 ? gy / gl : 0.8;
  return out;
}
/** The referee keeps half as much room again, out of everyone's way. */
const REF_ROOM = 1.5;
const dirTmp: Vec = { x: 0, y: 0 };
/**
 * Soft bodies. Targets that land on someone are moved to their side, and anyone closer than
 * a body's room eases apart. Only a tackle brings two bodies together, and exact arrivals
 * (the kick-off picture) are never nudged in their last moments.
 */
function separate(s: Sim) {
  const men = s.men;
  for (const m of men) {
    s.pos[m.id * 2] = m.x;
    s.pos[m.id * 2 + 1] = m.y;
  }
  const b = s.ball;
  for (const m of men) {
    m.px = 0;
    m.py = 0;
    if (m.by > 0 || diving(s, m)) continue;
    // Whoever is going to the ball gets there, even beside someone standing over it.
    if (m.fetch || len(m.tx - b.x, m.ty - b.y) < 0.4) continue;
    for (const o of men)
      if (o !== m && !far(m.tx - o.x, m.ty - o.y, BOX * 1.1) && !contact(s, m, o))
        clearOf(m, o, 1.1);
  }
  for (let i = 0; i < 10; i++)
    for (let j = i + 1; j < 10; j++) {
      const a = men[i],
        b = men[j];
      const dx = a.x - b.x,
        dy = a.y - b.y;
      if (far(dx, dy, BOX) || apart2(dx, dy) >= 1 || contact(s, a, b)) continue;
      const e = apart(dx, dy);
      const fa = !fixed(s, a) && !diving(s, a),
        fb = !fixed(s, b) && !diving(s, b);
      if (!fa && !fb) continue;
      const u = opening(dx, dy, dirTmp),
        k = (1 - e) * 2.6;
      const ka = fa ? (fb ? k / 2 : k) : 0,
        kb = fb ? (fa ? k / 2 : k) : 0;
      a.px += u.x * ka;
      a.py += u.y * ka;
      b.px -= u.x * kb;
      b.py -= u.y * kb;
    }
  const r = s.ref;
  r.px = 0;
  r.py = 0;
  if (fixed(s, r)) return;
  // Fetching the ball (or meeting a throw at a break), the referee may come as close as a
  // player would.
  const fetching = s.mode === 'break' ? b.mode === 'free' : len(r.tx - b.x, r.ty - b.y) < 0.4;
  const room = fetching ? 1 : REF_ROOM;
  for (const m of men) {
    if (r.by <= 0 && !fetching) clearOf(r, m, room * 1.1);
    const dx = r.x - m.x,
      dy = r.y - m.y;
    if (apart2(dx, dy) >= room * room) continue;
    const e = apart(dx, dy) / room;
    const u = opening(dx, dy, dirTmp),
      k = (1 - e) * 2.2;
    r.px += u.x * k;
    r.py += u.y * k;
  }
}
/** In the last moments of an exact arrival (the kick-off picture): never nudged. */
const fixed = (s: Sim, m: Man | Ref) => m.by > 0 && m.by - s.t < 1.5;
const diving = (s: Sim, m: Man) => m.act === 'dive' && s.t < m.actAt + m.actDur;
/** A step-in tackle: the one time two bodies meet. */
const contact = (s: Sim, a: Man, b: Man) =>
  (a.lunge > s.t && b.id === s.ball.owner) || (b.lunge > s.t && a.id === s.ball.owner);
/** Move a target that lands on someone (closer than `room` bodies) to their near side. */
function clearOf(m: Man | Ref, o: Vec, room: number) {
  const dx = m.tx - o.x,
    dy = m.ty - o.y;
  if (apart2(dx, dy) >= room * room) return;
  const e = apart(dx, dy);
  // Round the body on the side the mover is coming from. `apart` scales with the offset, so
  // stretching the offset by room / e lands exactly on the edge of the room.
  const on = e > 0.05;
  const fx = on ? dx : m.x - o.x,
    fy = on ? dy : m.y - o.y,
    fe = apart(fx, fy);
  if (fe < 1e-6) {
    m.tx = o.x + WIDE * 0.5 * room;
    m.ty = o.y - WIDE * 0.5 * room;
    return;
  }
  m.tx = o.x + (fx * room) / fe;
  m.ty = o.y + (fy * room) / fe;
}
/** Nobody runs through a body: the part of a run that closes on a neighbour is taken out. */
function block(s: Sim, m: Man) {
  for (const o of s.men) {
    const dx = s.pos[o.id * 2] - m.x,
      dy = s.pos[o.id * 2 + 1] - m.y;
    if (o === m || far(dx, dy, BOX) || apart2(dx, dy) >= 1 || contact(s, m, o)) continue;
    const e = apart(dx, dy);
    if (e < 1e-6) continue;
    const u = opening(dx, dy, dirTmp),
      c = m.vx * u.x + m.vy * u.y;
    if (c <= 0) continue;
    const k = Math.min(1, (1 - e) / 0.25);
    m.vx -= u.x * c * k;
    m.vy -= u.y * c * k;
  }
}
function moveMan(s: Sim, m: Man) {
  const t = s.t;
  const ox = m.x,
    oy = m.y;
  const diving = m.act === 'dive' && t < m.actAt + m.actDur;
  if (diving) {
    // The dive: a burst along the goal line, a landing, and a slide on the grass.
    const e = t - m.actAt;
    const end = m.diveBurst;
    const burst = e < end ? m.diveV : e < end + 0.18 ? m.diveV * (1 - (e - end) / 0.18) : 0;
    m.vx *= 0.7;
    m.vy = burst;
    m.dive =
      m.diveDir *
      (e < 0.16 ? e / 0.16 : e < 0.75 ? 1 : Math.max(0, (m.actDur - e) / (m.actDur - 0.75)));
  } else {
    m.dive = 0;
    if (m.by > 0) arriveStep(s, m);
    else steer(m, m.tx, m.ty, m.stun > t ? Math.min(m.want, 0.4) : m.want);
    // Nobody runs through a body, except to make an exact line-up that is running late.
    const late = m.by > 0 && len(m.tx - m.x, m.ty - m.y) > (m.by - t) * 1.6;
    if (!(m.by > 0 && (m.by - t < 1.5 || late))) block(s, m);
  }
  const cap = diving ? DIVE : SPRINT;
  const v = len(m.vx, m.vy);
  if (v > cap) {
    m.vx *= cap / v;
    m.vy *= cap / v;
  }
  if (m.snap) {
    m.x = m.tx;
    m.y = m.ty;
    m.snap = false;
  } else {
    let vx = m.vx + m.px,
      vy = m.vy + m.py;
    const w = len(vx, vy);
    if (w > cap) {
      vx *= cap / w;
      vy *= cap / w;
    }
    m.x += vx * DT;
    m.y += vy * DT;
  }
  m.x = clamp(m.x, BODY_EDGE.left, BODY_EDGE.right);
  m.y = clamp(m.y, BODY_EDGE.top, BODY_EDGE.bottom);
  const moved = len(m.x - ox, m.y - oy);
  m.stride += moved;
  m.speed = moved < 1e-6 ? 0 : moved / DT;
  // Facing: explicit, else along the run, else toward the ball.
  const b = s.ball;
  if (diving) {
    // Along the line of the dive, turned fast but never flipped in one tick: a keeper diving
    // back the other way comes round through the pitch.
    const y = m.diveDir === 0 ? 1 : m.diveDir;
    if (m.fy * y < -0.2) turn(m, s.dir[m.team], 0, 14);
    else turn(m, 0, y, 14);
  } else if (m.face) turn(m, m.face.x, m.face.y, 7);
  else if (m.speed > 0.3) turn(m, m.vx, m.vy, m.speed > 1.2 ? 9 : 6);
  else turn(m, b.x - m.x, b.y - m.y, 5);
  if (m.by > 0 && t >= m.by && m.face) turn(m, m.face.x, m.face.y, 0);
  if (!m.hold && !busy(s, m)) {
    const base: FootballAction = m.speed > 0.12 ? 'run' : 'stand';
    if (m.act !== base) {
      m.act = base;
      m.actAt = t;
      m.actDur = 0;
    }
  }
}
function steer(m: Man | Ref, tx: number, ty: number, want: number) {
  const dx = tx - m.x,
    dy = ty - m.y,
    d = len(dx, dy);
  const speed = d < 0.03 ? 0 : Math.min(want, Math.sqrt(2 * 3.2 * (d - 0.03)));
  const wx = d > 1e-9 ? (dx / d) * speed : 0,
    wy = d > 1e-9 ? (dy / d) * speed : 0;
  let ax = wx - m.vx,
    ay = wy - m.vy;
  const a = len(ax, ay),
    cap = 4.5 * DT;
  if (a > cap) {
    ax *= cap / a;
    ay *= cap / a;
  }
  m.vx += ax;
  m.vy += ay;
}
/** Reach an exact spot by a deadline: steer with the pace the time allows, then glide in. */
function arriveStep(s: Sim, m: Man | Ref) {
  const n = Math.round((m.by - s.t) / DT);
  const dx = m.tx - m.x,
    dy = m.ty - m.y,
    d = len(dx, dy);
  if (n <= 0 && d <= SPRINT * DT) {
    // At the deadline: land exactly (the steering has already brought them within a hair).
    m.vx = dx / DT;
    m.vy = dy / DT;
    m.snap = true;
    return;
  }
  if (n <= 0) return steer(m, m.tx, m.ty, SPRINT);
  if (n <= 8 && d < 0.15) {
    m.vx = dx / (n + 1) / DT;
    m.vy = dy / (n + 1) / DT;
    return;
  }
  const want = clamp(Math.max(m.want, (d / Math.max(0.25, n * DT - 0.5)) * 1.1), 0, SPRINT);
  steer(m, m.tx, m.ty, want);
}
function turn(m: Man | Ref, x: number, y: number, rate: number) {
  const l = len(x, y);
  if (l < 1e-9) return;
  let nx = x / l,
    ny = y / l;
  if (rate === 0) {
    m.fx = nx;
    m.fy = ny;
    return;
  }
  if (m.fx * nx + m.fy * ny < -0.9) {
    // Turning right round: go via the side.
    const px = -m.fy,
      py = m.fx;
    nx = nx + px * 0.6;
    ny = ny + py * 0.6;
  }
  const k = Math.min(1, rate * DT);
  const fx = m.fx + (nx - m.fx) * k,
    fy = m.fy + (ny - m.fy) * k,
    fl = len(fx, fy) || 1;
  m.fx = fx / fl;
  m.fy = fy / fl;
  const tl = len(nx, ny);
  if (1 - (m.fx * nx + m.fy * ny) / tl < 1e-5) {
    m.fx = nx / tl;
    m.fy = ny / tl;
  }
}
function moveRef(s: Sim) {
  const r = s.ref,
    ox = r.x,
    oy = r.y;
  if (r.by > 0) arriveStep(s, r);
  else steer(r, r.tx, r.ty, r.want);
  const v = len(r.vx, r.vy);
  if (v > SPRINT) {
    r.vx *= SPRINT / v;
    r.vy *= SPRINT / v;
  }
  if (r.snap) {
    r.x = r.tx;
    r.y = r.ty;
    r.snap = false;
  } else {
    let vx = r.vx + r.px,
      vy = r.vy + r.py;
    const w = len(vx, vy);
    if (w > SPRINT) {
      vx *= SPRINT / w;
      vy *= SPRINT / w;
    }
    r.x = clamp(r.x + vx * DT, BODY_EDGE.left, BODY_EDGE.right);
    r.y = clamp(r.y + vy * DT, BODY_EDGE.top, BODY_EDGE.bottom);
  }
  const moved = len(r.x - ox, r.y - oy);
  r.stride += moved;
  r.speed = moved < 1e-6 ? 0 : moved / DT;
  const b = s.ball;
  if (r.face) turn(r, r.face.x, r.face.y, 6);
  else if (r.speed > 0.3) turn(r, r.vx, r.vy, 6);
  else turn(r, b.x - r.x, b.y - r.y, 4);
  if (r.by > 0 && s.t >= r.by && r.face) turn(r, r.face.x, r.face.y, 0);
  const t = s.t;
  if (r.act === 'whistle' && t < r.actAt + 0.6) return;
  if (r.act === 'point' && s.goal && t - s.goal.at < 2.9) return;
  if (s.ball.owner === -1) r.act = 'carry';
  else r.act = r.speed > 0.12 ? 'run' : 'stand';
}
function refPlay(s: Sim) {
  const r = s.ref,
    b = s.ball;
  if (s.mode === 'goal') return;
  if (s.mode === 'pre' || (s.mode === 'restart' && s.set?.kind === 'kickoff'))
    return go(r, REF_SPOT.x, REF_SPOT.y, WALK, { x: 0, y: 1 });
  const team = s.poss ?? s.lastTeam ?? 0,
    d = s.dir[team];
  let tx = clamp(b.x - d * 0.9, L + 0.7, R - 0.7),
    ty = clamp(b.y - 1.45, 22.7, 25.3);
  if (s.mode === 'restart' && s.set && s.set.kind !== 'kickoff') {
    if (s.k - s.refLookK >= 4) {
      s.refLook = refRestartSpot(s, s.set);
      s.refLookK = s.k;
    }
    const p = s.refLook;
    const dd = len(p.x - r.x, p.y - r.y);
    return go(r, p.x, p.y, dd > 2.4 ? 1.7 : dd > 0.7 ? JOG : dd > 0.2 ? WALK : 0.3, {
      x: s.set.spot.x - r.x,
      y: s.set.spot.y - r.y,
    });
  }
  // Keep out of the carrier's passing lanes.
  const owner = b.owner !== null && b.owner >= 0 ? s.men[b.owner] : null;
  if (owner)
    for (const q of s.men)
      if (
        q.team === owner.team &&
        q !== owner &&
        segDist({ x: tx, y: ty }, owner.x, owner.y, q.x, q.y) < 0.45
      )
        ty = Math.max(22.7, ty - 0.5);
  const dd = len(tx - r.x, ty - r.y);
  go(r, tx, ty, dd > 2.4 ? 1.7 : dd > 0.7 ? JOG : dd > 0.2 ? WALK : 0.3);
}

/**
 * Where the referee watches a restart from: a stride or two off the taker, toward the middle,
 * out of every lane the taker could use and clear of the players.
 */
function refRestartSpot(s: Sim, sp: SetPiece): Vec {
  const r = s.ref,
    taker = s.men[sp.taker],
    at = sp.spot;
  const toMid = at.x < MID ? 1 : -1;
  // A natural spot for each restart: along the line from a throw, level with the edge of the
  // area on the other side from a corner, and near halfway for a goal kick.
  const base =
    sp.kind === 'throw-in'
      ? { x: at.x + toMid * 1.5, y: at.y < CY ? at.y + 1.1 : at.y - 1.1 }
      : sp.kind === 'corner'
        ? { x: at.x + toMid * 2.4, y: at.y < CY ? 26.4 : 23.6 }
        : { x: at.x + toMid * 3.4, y: r.y < CY ? 23.5 : 26.5 };
  let best = base,
    top = -99;
  for (const [ox, oy] of REF_LOOKS) {
    const c = {
      x: clamp(base.x + ox, L + 0.4, R - 0.4),
      y: clamp(base.y + oy, TOP + 0.1, BOT - 0.1),
    };
    let score = -len(c.x - base.x, c.y - base.y) * 0.6 - len(c.x - r.x, c.y - r.y) * 0.1;
    if (dist(c, at) < 0.9) score -= 3;
    for (const m of s.men) {
      if (m !== taker && m.team === sp.team && segDist(c, at.x, at.y, m.x, m.y) < 0.5) score -= 1.2;
      const dm = dist(c, m);
      if (dm < 0.6) score -= (0.6 - dm) * 4;
    }
    if (score > top) {
      top = score;
      best = c;
    }
  }
  return best;
}
const REF_LOOKS = [
  [0, 0],
  [0.6, 0],
  [-0.6, 0],
  [0, 0.6],
  [0, -0.6],
  [1.2, 0],
  [-1.2, 0],
] as const;

// ---------------------------------------------------------------- thinking
type Eta = { t: number; i: number };
function eta(s: Sim, m: Man, top: number): Eta {
  const p = predict(s);
  for (let i = 1; i <= 60; i++) {
    if (p[i * 3 + 2] > top) continue;
    const t = i * DT;
    const dx = p[i * 3] - m.x,
      dy = p[i * 3 + 1] - m.y;
    // Out of reach even at best: skip the square root.
    const most = Math.max(0, t - 0.18) * SPRINT + Math.min(t, 0.4) + 0.3;
    if (dx * dx + dy * dy > most * most) continue;
    const dd = len(dx, dy);
    const d = dd - (m.keeper ? 0.3 : 0.2);
    if (d <= 0) return { t, i };
    const head = dd > 1e-6 ? (m.vx * dx + m.vy * dy) / dd : 0;
    const reach = Math.max(0, t - 0.18) * SPRINT + clamp(head, -1, 2) * Math.min(t, 0.4) * 0.5;
    if (d <= reach) return { t, i };
  }
  const d = len(p[180] - m.x, p[181] - m.y);
  return { t: 3 + d / SPRINT, i: 60 };
}
const reachTop = (s: Sim, m: Man) => (m.keeper && inBox(s, m.team, s.ball) ? HANDS : HEAD);
function inBox(s: Sim, team: 0 | 1, p: Vec) {
  const d = s.dir[team];
  return toU(d, p.x) < 1.5 && toU(d, p.x) > -0.1 && Math.abs(p.y - CY) < 1.5;
}

function think(s: Sim) {
  const b = s.ball,
    t = s.t;
  const owner = b.owner !== null && b.owner >= 0 ? s.men[b.owner] : null;
  const loose = b.mode === 'free' && b.net < 0 && s.mode === 'play';
  const etas: Eta[] = s.men.map((m) => (loose ? eta(s, m, reachTop(s, m)) : { t: 9, i: 60 }));
  // Who is attacking: the carrier's team, the team a pass is meant for, or whoever wins the race.
  let attack: 0 | 1 | null = owner ? owner.team : s.poss;
  const chaser: [Man | null, Man | null] = [null, null];
  if (loose) {
    const p = s.path;
    for (const m of s.men) {
      // Nobody stunned, or beaten to a cross in the air, goes for the ball.
      if (m.stun > t || m.beat > t) continue;
      const e = etas[m.id];
      // Keepers only come for balls they can reach in or near their area.
      if (m.keeper && toU(s.dir[m.team], p[e.i * 3]) > 2.1) continue;
      const c = chaser[m.team];
      if (!c || e.t < etas[c.id].t) chaser[m.team] = m;
    }
    const a = chaser[0] ? etas[chaser[0].id].t : 99,
      c = chaser[1] ? etas[chaser[1].id].t : 99;
    if (!s.pass || s.shot) attack = a + 0.1 < c ? 0 : c + 0.1 < a ? 1 : attack;
    else {
      const other = (1 - s.pass.team) as 0 | 1;
      const mine = chaser[s.pass.team] ? etas[chaser[s.pass.team]!.id].t : 99;
      const theirs = chaser[other] ? etas[chaser[other]!.id].t : 99;
      attack = theirs + 0.15 < mine ? other : s.pass.team;
    }
  }
  if (s.mode === 'play') s.poss = attack;
  for (const m of s.men) {
    m.shaped = false;
    if (s.mode === 'goal') continue;
    if (s.set && s.set.kind === 'kickoff') {
      if (m.id !== s.set.taker) {
        // After a goal, those back in position shift about while they wait.
        let home = kickoffSpot(s, m, s.set.team);
        if (s.mode === 'restart') home = idle(s, m, home, m.keeper ? 0.4 : 0.6);
        go(m, home.x, home.y, paceFor(dist(m, home)), { x: s.dir[m.team], y: 0 });
      }
      continue;
    }
    if (s.mode === 'restart' && s.set) {
      if (m.id !== s.set.taker) restartShape(s, m);
      continue;
    }
    if (owner === m) {
      carry(s, m);
      continue;
    }
    if (busy(s, m) && m.act !== 'kick') {
      if (m.act === 'tackle' || m.act === 'slide') brake(m);
      continue;
    }
    if (m.beat > t) {
      // Beaten to a delivery: caught flat-footed as it goes over.
      brake(m);
      continue;
    }
    if (s.shot && m.id === s.shot.keeper) {
      keeperShot(s, m);
      continue;
    }
    if (s.shot && m.team === s.shot.team && m.run && t < m.run.until) {
      // Following the shot in.
      go(m, m.run.x, m.run.y, SPRINT);
      continue;
    }
    const inPoss = attack === m.team;
    if (loose && !s.shot) {
      const receiver = !!s.pass && s.pass.to === m.id && s.pass.team === m.team;
      if (chaser[m.team] === m || receiver) {
        // A receiver strolls onto an uncontested pass but attacks a contested one.
        const rival = chaser[(1 - m.team) as 0 | 1];
        const contested = !!rival && etas[rival.id].t < etas[m.id].t + 0.5;
        chase(s, m, etas[m.id], receiver && !contested);
        continue;
      }
    }
    if (m.keeper) {
      keeperPlay(s, m, inPoss);
      continue;
    }
    if (inPoss) support(s, m, owner);
    else defend(s, m, owner);
  }
  // Space between teammates holding their shape: nobody stacks on top of a teammate.
  for (const m of s.men)
    for (const q of s.men) {
      if (q.team !== m.team || q.id <= m.id || !m.shaped || !q.shaped) continue;
      const dx = m.tx - q.tx,
        dy = m.ty - q.ty,
        d = len(dx, dy);
      if (d < 1.1) {
        const push = (1.1 - d) * 0.5,
          ux = d > 1e-6 ? dx / d : 0,
          uy = d > 1e-6 ? dy / d : 1;
        m.tx += ux * push;
        m.ty += uy * push;
        q.tx -= ux * push;
        q.ty -= uy * push;
      }
    }
  for (const m of s.men) {
    if (m.shaped) {
      // Ease shape targets so runs curve instead of twitching with every touch.
      m.sx += (clamp(m.tx, L + 0.2, R - 0.2) - m.sx) * 0.2;
      m.sy += (clamp(m.ty, TOP + 0.15, BOT - 0.15) - m.sy) * 0.2;
      m.tx = m.sx;
      m.ty = m.sy;
    } else {
      m.sx = m.tx;
      m.sy = m.ty;
    }
  }
}

function chase(s: Sim, m: Man, e: Eta, receiver: boolean) {
  const p = s.path;
  const x = p[e.i * 3],
    y = p[e.i * 3 + 1];
  const d = len(x - m.x, y - m.y);
  // A receiver comes to meet the ball at a natural pace; a race is a sprint.
  const want = receiver ? clamp(d / Math.max(0.25, e.t) + 0.4, 0.5, SPRINT) : paceFor(d, true);
  go(m, x, y, want);
  m.fetch = true;
}

/**
 * The diamond: a keeper, a defender, two wings and a striker. In possession it stretches
 * (width from the wings, depth from the striker); out of possession it drops goal-side
 * and narrows around the ball.
 */
function shape(s: Sim, m: Man, attacking: boolean): Vec {
  const d = s.dir[m.team],
    b = s.ball;
  const ub = clamp(toU(d, b.x), 0, LEN),
    wb = clamp(toW(d, b.y), -2.25, 2.25);
  let u = 0,
    w = 0;
  if (m.slot === 1) {
    u = attacking ? clamp(ub - 2.2, 1.8, 4.6) : clamp(ub - 2.3, 0.9, 3.1);
    w = wb * (attacking ? 0.25 : 0.5);
  } else if (m.slot === 2 || m.slot === 3) {
    const side = m.slot === 2 ? -1 : 1;
    const ballSide = side * wb > 0.3;
    if (attacking && ub > 5.8 && side * wb < -0.5) {
      // The far-side wing arrives at the far post once the ball is out wide near goal.
      u = clamp(ub + 1.6, 7.4, 8.4);
      w = side * 0.75;
    } else if (attacking) {
      u = clamp(ub + (ballSide ? 0.5 : 1.3), 3, 8.2);
      w = side * (ballSide ? 1.95 : 1.7);
    } else {
      u = clamp(ub - 1.3, 2.1, 4.8);
      w = side * 1.15 + wb * 0.35;
    }
  } else if (m.slot === 4) {
    if (attacking) {
      // Pin the last defender and stretch the space in front of them; near goal, attack
      // the near post of a ball out wide.
      u = clamp(Math.max(ub + 2, deepest(s, (1 - m.team) as 0 | 1) - 0.1), 5.6, 8.3);
      w = ub > 5.8 && Math.abs(wb) > 0.8 ? wb * 0.3 : -wb * 0.3;
    } else {
      u = clamp(ub + 1.2, 5, 6.6);
      w = wb * 0.3;
    }
  }
  return fromUW(d, u, clamp(w, -2, 2));
}

function support(s: Sim, m: Man, owner: Man | null) {
  const t = s.t,
    d = s.dir[m.team];
  let p = shape(s, m, true);
  // Runs in behind.
  if (m.run && t < m.run.until && dist(m, m.run) > 0.25) {
    go(m, m.run.x, m.run.y, 1.9);
    return;
  }
  m.run = null;
  if (
    owner &&
    owner.team === m.team &&
    s.mode === 'play' &&
    t >= s.nextRun[m.team] &&
    m.slot >= 2
  ) {
    const u = toU(d, m.x),
      ou = toU(d, owner.x);
    if (u > ou - 1 && u < 8 && s.rng() < 0.45) {
      const last = deepest(s, (1 - m.team) as 0 | 1);
      const ru = clamp(Math.max(u + 1.5, last + 0.7), u + 0.8, 8.6);
      const rw = clamp(toW(d, m.y) * (s.rng() < 0.5 ? 0.4 : 1) + (s.rng() - 0.5) * 0.8, -1.7, 1.7);
      const target = fromUW(d, ru, rw);
      m.run = { ...target, until: t + 1.6 };
      s.nextRun[m.team] = t + 1.8 + s.rng() * 2.2;
      go(m, target.x, target.y, 1.9);
      return;
    }
    s.nextRun[m.team] = t + 0.6;
  }
  // Show for the ball when the carrier is under pressure: the nearest teammate comes short.
  if (owner && owner.team === m.team) {
    const presser = closestOpp(s, owner);
    if (presser.d < 0.8 && dist(m, owner) < 2.8 && nearestMate(s, owner) === m) {
      const ax = owner.x - presser.m.x,
        ay = owner.y - presser.m.y,
        al = len(ax, ay) || 1;
      const sx = owner.x + (ax / al) * 0.6 + (m.x - owner.x) * 0.5,
        sy = owner.y + (ay / al) * 0.6 + (m.y - owner.y) * 0.5;
      p = { x: (p.x + sx) / 2, y: (p.y + sy) / 2 };
    }
    p = openSpot(s, m, owner, p);
  }
  const dd = dist(m, p);
  go(m, p.x, p.y, paceFor(dd));
  m.shaped = true;
}
const LOOKS = [
  [0, 0],
  [0.75, 0],
  [-0.75, 0],
  [0, 0.75],
  [0, -0.75],
  [0.55, 0.55],
  [0.55, -0.55],
  [-0.55, 0.55],
  [-0.55, -0.55],
] as const;
/**
 * Get open near the shape spot: away from markers, in a clear lane from the carrier, and
 * a little further forward if there is room.
 */
function openSpot(s: Sim, m: Man, owner: Man, p: Vec): Vec {
  const d = s.dir[m.team];
  const at = (i: number) => ({
    x: clamp(p.x + LOOKS[i][0] * d, L + 0.3, R - 0.3),
    y: clamp(p.y + LOOKS[i][1], TOP + 0.2, BOT - 0.2),
  });
  if ((s.k + m.id) % 4) return at(m.look);
  let top = -9;
  for (let i = 0; i < LOOKS.length; i++) {
    const a = LOOKS[i][0],
      c = at(i);
    let open = 9,
      lane = 9;
    for (const o of s.men)
      if (o.team !== m.team) {
        open = Math.min(open, dist(o, c));
        if (!o.keeper) lane = Math.min(lane, segDist(o, owner.x, owner.y, c.x, c.y));
      }
    const D = dist(owner, c);
    const score =
      Math.min(open, 1.6) * 0.5 +
      Math.min(lane, 0.9) * 0.7 +
      a * 0.06 -
      len(c.x - p.x, c.y - p.y) * 0.18 -
      (D < 1.6 ? (1.6 - D) * 0.6 : 0) -
      (D > 5 ? (D - 5) * 0.2 : 0);
    if (score > top) {
      top = score;
      m.look = i;
    }
  }
  return at(m.look);
}
function nearestMate(s: Sim, m: Man) {
  let best: Man | null = null;
  for (const q of s.men)
    if (q.team === m.team && q !== m && !q.keeper && (!best || dist(q, m) < dist(best, m)))
      best = q;
  return best;
}
/** The last outfield defender's u, in the attacking team's frame. */
function deepest(s: Sim, defending: 0 | 1) {
  const d = s.dir[1 - defending];
  let u = 0;
  for (const m of s.men) if (m.team === defending && !m.keeper) u = Math.max(u, toU(d, m.x));
  return u;
}
function closestOpp(s: Sim, p: Man) {
  let best = s.men[p.team === 0 ? 5 : 0],
    bd = 99;
  for (const o of s.men)
    if (o.team !== p.team) {
      const d = dist(o, p);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
  return { m: best, d: bd };
}

function defend(s: Sim, m: Man, owner: Man | null) {
  const d = s.dir[m.team],
    b = s.ball,
    t = s.t;
  const goalX = ownLine(d);
  const target = owner ?? (s.pass && s.pass.to >= 0 ? s.men[s.pass.to] : null);
  // One presser: the outfield player best placed, kept unless another is clearly closer.
  let presser = s.presser[m.team];
  if (target) {
    let best = -1,
      bd = 99;
    for (const q of s.men)
      if (q.team === m.team && !q.keeper && q.stun <= t) {
        // Nobody leaves their post to chase far upfield: the defender stops at halfway.
        const leave = Math.max(0, toU(d, target.x) - PRESS_REACH[q.slot]);
        const dd = dist(q, target) + (q.id === presser ? -0.5 : 0) + leave * 0.8;
        if (dd < bd) {
          bd = dd;
          best = q.id;
        }
      }
    presser = best;
    s.presser[m.team] = best;
  }
  const calm = t < s.calm[m.team];
  if (owner && m.id === presser && !(b.mode === 'hands')) {
    const dd = dist(m, owner);
    if (m.lunge > t) {
      // The step-in: straight at the ball.
      go(m, b.x, b.y, SPRINT);
      return;
    }
    if (m.lunge > 0) {
      // A step-in that came up short: regain balance before the next.
      m.lunge = 0;
      m.stun = t + 0.2;
    }
    // Close down goal-side, then jockey half a stride off; while holding the block, just screen.
    const gx = goalX - owner.x,
      gy = CY - owner.y,
      gl = len(gx, gy) || 1;
    const gap = calm ? 1.1 : dd > 1.2 ? 0.45 : 0.5;
    const px = owner.x + (gx / gl) * gap + owner.vx * 0.25,
      py = owner.y + (gy / gl) * gap + owner.vy * 0.25;
    const pace = dd > 1.4 ? 1.9 : dd > 0.8 ? 1.5 : 1.15;
    go(m, px, py, calm ? Math.min(pace, JOG) : pace);
    // Step in now and then; a lone forward pressing high picks the moment more carefully.
    const rate = toU(d, owner.x) > 6.3 ? 0.3 : 0.45;
    if (!calm && dd < 0.72 && m.stun <= t && m.guard <= t && s.rng() < rate * DT)
      m.lunge = t + 0.35;
    return;
  }
  m.lunge = 0;
  let p = shape(s, m, false);
  if (calm) {
    // A mid block: stay in our half until the ball has been played out.
    const cap = [0, 2.6, 3.8, 3.8, 5.3][m.slot];
    if (toU(d, p.x) > cap) p = fromUW(d, cap, toW(d, p.y));
  }
  // Mark the most dangerous attacker near my zone.
  let mark: Man | null = null,
    md = 1.8;
  for (const o of s.men) {
    if (o.team === m.team || o.keeper || o === owner) continue;
    const dz = dist(o, p);
    if (dz < md && !marked(s, m, o)) {
      md = dz;
      mark = o;
    }
  }
  if (mark) {
    const gx = goalX - mark.x,
      gy = CY - mark.y,
      gl = len(gx, gy) || 1;
    const bx = b.x - mark.x,
      by = b.y - mark.y,
      bl = len(bx, by) || 1;
    const mx = mark.x + (gx / gl) * 0.5 + (bx / bl) * 0.1,
      my = mark.y + (gy / gl) * 0.5 + (by / bl) * 0.1;
    const danger = toU(d, mark.x) < 3.5 ? 0.55 : toU(d, mark.x) < 5 ? 0.3 : 0.1;
    p = { x: p.x + (mx - p.x) * danger, y: p.y + (my - p.y) * danger };
  }
  // Nobody presses a keeper holding the ball: back off to the shape.
  go(m, p.x, p.y, paceFor(dist(m, p), toU(d, b.x) < 4));
  m.shaped = true;
}
/** How far upfield (u) each slot will go to press the ball before leaving it to others. */
const PRESS_REACH = [0, 4.4, 6.6, 6.6, 9.4];
function marked(s: Sim, m: Man, o: Man) {
  // A teammate with a lower slot already closer to this attacker takes the mark.
  for (const q of s.men)
    if (q.team === m.team && !q.keeper && q.slot < m.slot && q.id !== s.presser[m.team])
      if (dist(q, o) < dist(m, o) - 0.2) return true;
  return false;
}

function keeperSpot(s: Sim, k: Man, inPoss: boolean): Vec {
  const d = s.dir[k.team],
    gx = ownLine(d),
    b = s.ball;
  const ex = b.x - gx,
    ey = b.y - CY,
    e = len(ex, ey) || 1;
  const ub = toU(d, b.x);
  let r = clamp(0.28 + e * 0.09, 0.3, 0.9);
  if (inPoss) r = clamp(0.45 + ub * 0.13, 0.45, 1.6);
  // One-on-one: come out to narrow the angle.
  const owner = b.owner !== null && b.owner >= 0 ? s.men[b.owner] : null;
  if (owner && owner.team !== k.team && e < 3.2 && !inPoss)
    r = clamp(r + (3.2 - e) * 0.25, 0.3, 1.25);
  const u = clamp(toU(d, gx + (ex / e) * r), 0.25, 1.7);
  const y = clamp(CY + (ey / e) * r, POST_A + 0.18, POST_B - 0.18);
  return { x: ownLine(d) + u * d, y };
}
function keeperPlay(s: Sim, k: Man, inPoss: boolean) {
  const p = keeperSpot(s, k, inPoss);
  const dd = dist(k, p);
  go(k, p.x, p.y, dd > 0.8 ? 1.8 : dd > 0.25 ? 1.3 : 0.8, { x: s.ball.x - k.x, y: s.ball.y - k.y });
}
/** Where a diving keeper comes to rest along the line once the push-off has carried them. */
function diveRest(s: Sim, k: Man) {
  const e = s.t - k.actAt,
    end = k.diveBurst;
  if (e < end) return k.y + k.diveV * (end - e + 0.09);
  const f = 1 - (e - end) / 0.18;
  return f > 0 ? k.y + k.diveV * 0.09 * f * f : k.y;
}
function keeperShot(s: Sim, k: Man) {
  const sh = s.shot!,
    b = s.ball,
    t = s.t;
  if (k.act === 'dive' && t < k.actAt + k.actDur) return;
  if (!sh.dived && t >= sh.diveAt && sh.diveTo !== 0) {
    sh.dived = true;
    k.diveDir = sh.diveTo;
    // An explosive push off; how far it carries depends on how long it lasts.
    const v = clamp(sh.diveReach / 0.28, 2.2, DIVE);
    k.diveV = sh.diveTo * v;
    k.diveBurst = clamp(sh.diveReach / v - 0.09, 0.05, 0.3);
    act(s, k, 'dive', 1.15);
    return;
  }
  // Set feet and shuffle along the line into the ball's path.
  let ty = k.y;
  if (sh.outcome === 'save' && sh.diveTo === 0 && t >= sh.at + 0.08 && Math.abs(b.vx) > 0.1) {
    const f = (k.x - b.x) / b.vx;
    if (f > 0) ty = b.y + b.vy * f;
  }
  go(k, k.x, clamp(ty, POST_A + 0.1, POST_B - 0.1), 1.6, { x: b.x - k.x, y: b.y - k.y });
}
function restartShape(s: Sim, m: Man) {
  const sp = s.set!,
    d = s.dir[m.team];
  if (sp.kind === 'kickoff') return;
  const mine = m.team === sp.team;
  if (m.keeper) {
    if (sp.kind === 'goal-kick' && mine) return;
    keeperPlay(s, m, mine);
    if (sp.stage !== 'fetch') {
      // On their toes while they wait.
      const p = idle(s, m, { x: m.tx, y: m.ty }, 0.35);
      m.ty = p.y;
    }
    return;
  }
  let p = shape(s, m, mine);
  if (sp.kind === 'corner') p = cornerSpot(s, m, sp);
  else if (sp.kind === 'goal-kick' && !mine) {
    const u = toU(d, p.x);
    p = fromUW(d, Math.min(u, 5.8), toW(d, p.y));
  } else if (sp.kind === 'throw-in' && mine && dist(m, sp.spot) < 3.2) {
    // Come short to offer the thrower an option.
    const inward = sp.spot.y < CY ? 1 : -1;
    p = {
      x: (p.x + sp.spot.x + (m.slot - 2.5) * 0.9) / 2,
      y: sp.spot.y + inward * (0.9 + (m.slot % 2) * 0.6),
    };
  }
  if (sp.stage !== 'fetch') p = idle(s, m, p);
  go(m, p.x, p.y, paceFor(dist(m, p)));
}
/**
 * A corner: the striker attacks the near post, the other wing the far post and the defender
 * waits at the edge of the area. Defenders stand goal-side and ball-side of their man, the
 * spare wing guards the near post and their striker stays up for the break.
 */
function cornerSpot(s: Sim, m: Man, sp: SetPiece): Vec {
  const att = sp.team,
    da = s.dir[att],
    goalX = ownLine(-da),
    side = sp.spot.y < CY ? -1 : 1;
  const at = (ug: number, y: number) => ({ x: goalX - da * ug, y });
  // Roles, whoever takes it: the striker attacks the near post (the wing on that side when the
  // striker takes it), the far wing the far post, the defender waits at the edge.
  const base = att * 5,
    sideWing = base + (side * da < 0 ? 2 : 3),
    farWing = base + (side * da < 0 ? 3 : 2);
  const nearMan = sp.taker !== base + 4 ? base + 4 : sideWing,
    farMan = sp.taker !== farWing ? farWing : sideWing,
    edgeMan = sp.taker !== base + 1 ? base + 1 : sideWing;
  if (m.team === att) {
    if (m.id === nearMan) return at(0.9, CY + side * 0.45);
    if (m.id === farMan) return at(1.3, CY - side * 0.6);
    if (m.id === edgeMan) return at(3.6, CY - side * 0.25);
    return at(3.6, CY - side * 0.25);
  }
  // The defending side's frame: its far-side wing takes the far-post runner.
  const dd = s.dir[m.team],
    farSlot = toW(dd, CY - side) < 0 ? 2 : 3;
  const man = m.slot === 1 ? s.men[nearMan] : m.slot === farSlot ? s.men[farMan] : null;
  if (!man) return m.slot === 4 ? at(3.1, CY + side * 0.3) : at(0.45, CY + side * 0.95);
  // Goal-side, stepped across the screen so the pair never stands in one screen column.
  const gl = len(goalX - man.x, CY - man.y) || 1,
    gx = (goalX - man.x) / gl,
    gy = (CY - man.y) / gl,
    across = gx - gy >= 0 ? 0.15 : -0.15;
  return { x: man.x + gx * 0.4 + across, y: man.y + gy * 0.4 - across };
}
/**
 * Nobody waits for a restart like a statue: a slow shuffle around the spot (a pair of
 * triangle waves, so it stays deterministic without trigonometry).
 */
function idle(s: Sim, m: Man, p: Vec, amp = 1): Vec {
  if (dist(m, p) > 0.6) return p;
  const tri = (v: number) => {
    const f = v - Math.floor(v);
    return f < 0.5 ? f * 2 : 2 - f * 2;
  };
  return {
    x: p.x + (tri(s.t * 0.21 + m.id * 0.37) - 0.5) * 0.36 * amp,
    y: p.y + (tri(s.t * 0.16 + m.id * 0.59) - 0.5) * 0.3 * amp,
  };
}

// ---------------------------------------------------------------- on the ball
type Option = { score: number; kick?: Kick; dir?: Vec; pace?: number };
function carry(s: Sim, m: Man) {
  const t = s.t,
    b = s.ball;
  const d = s.dir[m.team];
  if (m.kick) {
    go(m, m.x + m.vx * 0.15, m.y + m.vy * 0.15, 0.5);
    if (t >= m.kick.at) {
      const k = m.kick;
      m.kick = null;
      fire(s, m, k);
    }
    return;
  }
  if (b.mode === 'hands') {
    // A keeper with the ball: step forward, let the others spread, then distribute.
    const p = fromUW(d, Math.min(1.1, toU(d, m.x) + 0.3), toW(d, m.y) * 0.8);
    go(m, p.x, p.y, 0.5, { x: d, y: 0 });
    if (t >= m.decide) {
      const kick = distribute(s, m);
      m.kick = kick;
      if (kick.kind === 'punt') {
        act(s, m, 'kick', 0.45);
        kick.at = t + 0.2;
        b.lift = 8;
      } else {
        act(s, m, 'throw', 0.6);
        kick.at = t + 0.28;
        b.lift = kick.kind === 'roll' ? 5 : 20;
      }
    }
    return;
  }
  if (t >= m.decide) {
    const opt = choose(s, m);
    const tag = opt.kick ? opt.kick.kind : opt.pace === 0.6 ? 'shield' : 'dribble';
    s.stats.choices[tag] = (s.stats.choices[tag] ?? 0) + 1;
    if (opt.kick) {
      m.kick = { ...opt.kick, at: t + 0.16 };
      act(s, m, 'kick', 0.4);
    } else if (opt.dir) {
      m.dribX = opt.dir.x;
      m.dribY = opt.dir.y;
      m.pace = opt.pace ?? JOG;
      const pressed = closestOpp(s, m).d < 0.9;
      m.decide = t + (pressed ? 0.2 : 0.35) + s.rng() * 0.35;
    }
  }
  const tx = clamp(m.x + m.dribX * 0.9, L + 0.3, R - 0.3),
    ty = clamp(m.y + m.dribY * 0.9, TOP + 0.3, BOT - 0.3);
  go(m, tx, ty, m.pace);
}
function choose(s: Sim, m: Man): Option {
  const t = s.t,
    d = s.dir[m.team],
    b = s.ball;
  const u = toU(d, b.x),
    w = toW(d, b.y);
  const press = closestOpp(s, m);
  const fresh = t - m.since < 0.6;
  const opts: Option[] = [];
  // Shoot.
  if (!late(s)) {
    const c = chance(s, m);
    if (c.dist < SHOT_RANGE && u > SHOT_FROM && (c.xg > 0.35 || !choosy(s, m))) {
      // A sight of goal invites a go from distance, cage-football style: most of those are
      // saved, blocked or missed, but they test the keeper.
      const sight =
        c.dist > 2.6
          ? SIGHT *
            longRange(s, m, u, s.chain) *
            clamp((SHOT_RANGE - c.dist) / 2.2, 0.6, 1) *
            c.lane *
            (c.facing > 0.6 ? 1 : 0.5) *
            (1 - c.pressure * 0.5)
          : 0;
      const sc =
        c.xg * CLOSE +
        sight +
        s.mood[m.team] +
        (c.dist < 2.3 ? 0.3 : 0) +
        (press.d < 0.6 ? 0.1 : 0) -
        (fresh && c.dist > 4 ? 0.15 : 0);
      opts.push({ score: sc, kick: shotKick(s, m, false) });
    }
  }
  // Pass.
  for (const q of s.men) {
    if (q.team !== m.team || q === m) continue;
    const kinds: KickKind[] = ['pass'];
    if (q.run && s.t < q.run.until) kinds.push('through');
    if (!q.keeper && dist(q, m) > 3.2 && !winding(s))
      kinds.push(Math.abs(toW(d, q.y) - w) > 2 ? 'switch' : 'lofted');
    if (!q.keeper && u > 6 && Math.abs(w) > 1 && toU(d, q.x) > 7 && Math.abs(toW(d, q.y)) < 1.2)
      kinds.push('cross');
    for (const kind of kinds) {
      const k = passTo(s, m, q, kind);
      if (k) opts.push({ score: k.score - (fresh && press.d > 0.9 ? 0.15 : 0), kick: k });
    }
  }
  // Clear the danger.
  if (u < 2.8 && press.d < 0.8 && !winding(s)) {
    const k = clearKick(s, m);
    opts.push({ score: 0.3 + (0.8 - press.d) * 0.6 + (k.to === -1 ? 0.12 : 0), kick: k });
  }
  // Dribble.
  for (const [c, sn] of TURNS) {
    {
      const dx = d * c,
        dy = d * sn;
      const px = b.x + dx * 1.1,
        py = b.y + dy * 1.1;
      if (px < L + 0.35 || px > R - 0.35 || py < TOP + 0.35 || py > BOT - 0.35) continue;
      let space = 9;
      for (const o of s.men)
        if (o.team !== m.team) {
          space = Math.min(
            space,
            len(o.x - px, o.y - py) - 0.45,
            len(o.x - (b.x + dx * 0.5), o.y - (b.y + dy * 0.5)) - 0.3,
          );
        }
      const gain = c;
      const inward = u > 6 ? -Math.abs(w + dy * d) + Math.abs(w) : 0;
      // Keeping it patiently after a kick-off: not on into the final third yet.
      const patient = t < s.settle[m.team] && c > 0 && u + c * 1.1 > HOLD;
      // Carriers keep their line rather than zig-zagging.
      const keep = dx * m.dribX + dy * m.dribY;
      // Defenders and keepers move it on rather than carry it, above all when pressed deep.
      const carrier =
        (m.keeper ? 0.35 : m.slot === 1 ? 0.75 : 1) *
        (u < 3.2 && press.d < 1.1 ? 0.55 : 1) *
        (c > 0.5 && t < s.settle[m.team] ? 0.6 : 1) *
        (patient ? 0.3 : 1);
      const score =
        (0.06 + gain * 0.3 + clamp(space, -0.6, 1) * 0.32 + inward * 0.1 + keep * 0.08) * carrier;
      opts.push({ score, dir: { x: dx, y: dy }, pace: space > 1 ? 1.55 : space > 0.4 ? 1.2 : 0.8 });
    }
  }
  // Shield: turn away from the presser.
  if (press.d < 0.7) {
    const ax = m.x - press.m.x,
      ay = m.y - press.m.y,
      al = len(ax, ay) || 1;
    opts.push({ score: 0.25, dir: { x: ax / al, y: ay / al }, pace: 0.6 });
  }
  opts.sort((a, b2) => b2.score - a.score);
  // The best always stays in the running, even when nothing scores above zero.
  const top = opts.slice(0, 3).filter((o, i) => i === 0 || o.score > opts[0].score * 0.6);
  const weights = top.map((o) => Math.max(0.001, o.score));
  // Squared weights (no pow): favour the best without making it certain.
  let total = 0;
  for (let i = 0; i < weights.length; i++) {
    weights[i] = weights[i] * weights[i];
    total += weights[i];
  }
  let r = s.rng() * total;
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i];
  }
  return top[0];
}
/**
 * Shooting appetite: the furthest from goal anyone shoots, the deepest (u) they shoot from,
 * how much a sight of goal from distance invites a go, and how much a good chance does.
 */
const SHOT_RANGE = 6.8,
  SHOT_FROM = 3.4,
  SIGHT = 2.4,
  CLOSE = 7;
/**
 * How ready a side is to try one from distance: likelier once the move has been worked than
 * straight after winning the ball, from inside their own half only gradually, and less so while
 * the other side still sits in its block after a restart.
 */
function longRange(s: Sim, m: Man, u: number, passes: number) {
  const worked = s.chainTeam === m.team ? clamp(0.15 + passes * 0.3, 0, 1) : 0.15;
  return worked * clamp((u - SHOT_FROM) / 0.6, 0, 1) * (s.t < s.calm[1 - m.team] ? 0.5 : 1);
}
/**
 * Just after a kick-off neither side shoots without a good chance: the other side while it
 * would still be sitting in its block, the kicking side while it keeps the ball patiently.
 */
const choosy = (s: Sim, m: Man) => s.t < s.settle[m.team] || s.t < s.kicked + KO_CALM;
const late = (s: Sim) => (s.half === 1 ? 60 : 128) - s.t < 1.4;
/** The last seconds of a half: nobody launches a long ball the referee must chase. */
const winding = (s: Sim) => (s.half === 1 ? 60 : 128) - s.t < 2.2;

const ROLL_STEPS = [0.2, 0.4, 0.6, 0.8, 1];
const LOFT_STEPS = [0.9, 1];
/** Plan a pass from m to q: speed, loft, and how safe and useful it looks. */
function passTo(s: Sim, m: Man, q: Man, kind: KickKind): Kick | null {
  const b = s.ball,
    d = s.dir[m.team];
  let tx: number, ty: number;
  if (kind === 'through' && q.run) {
    tx = q.run.x;
    ty = q.run.y;
  } else {
    const lead = kind === 'lofted' || kind === 'switch' ? 0.9 : 0.5;
    tx = q.x + q.vx * lead;
    ty = q.y + q.vy * lead;
  }
  tx = clamp(tx, L + 0.3, R - 0.3);
  ty = clamp(ty, TOP + 0.25, BOT - 0.25);
  const D = len(tx - b.x, ty - b.y);
  if (D < 0.9 || D > 7.4) return null;
  const air = kind === 'lofted' || kind === 'switch' || kind === 'throw' || kind === 'cross';
  let speed: number, lift: number, T: number;
  if (kind === 'cross') {
    // Arrive at head height.
    T = 0.6 + D * 0.1;
    speed = D / T;
    lift = (20 + (G * T * T) / 2) / T;
  } else if (kind === 'throw') {
    T = 0.45 + D * 0.12;
    speed = D / T;
    lift = (G * T * T * 0.5 - 22) / T;
  } else if (air) {
    T = 0.55 + D * 0.12;
    speed = (D - 0.35) / T;
    lift = (G * T) / 2;
  } else {
    // Longer balls are struck harder so they beat the race to the receiver.
    const arrive = kind === 'through' ? 1.4 + D * 0.3 : kind === 'kickoff' ? 1.2 : 2 + D * 0.6;
    speed = Math.sqrt(arrive * arrive + 2 * ROLL * D);
    if (speed > 6.2) return null;
    T = (speed - arrive) / ROLL;
    lift = 0;
  }
  if (air) {
    // Never lofted straight into a marker: its first quarter-second is still low enough to
    // block, so nobody may stand (or be arriving) in that stretch of its path.
    const f = Math.min(1, (speed * 0.25) / D),
      ex = b.x + (tx - b.x) * f,
      ey = b.y + (ty - b.y) * f;
    for (const o of s.men)
      if (
        o.team !== m.team &&
        (segDist(o, b.x, b.y, ex, ey) < 0.35 ||
          segDist({ x: o.x + o.vx * 0.2, y: o.y + o.vy * 0.2 }, b.x, b.y, ex, ey) < 0.35)
      )
        return null;
  }
  // Safety: race the receiver against every opponent along the ball's path. Whoever can
  // first meet the ball wins it; the margin is how much slower the quickest opponent is.
  const samples = air ? LOFT_STEPS : ROLL_STEPS;
  const ballAt = (f: number) =>
    air ? T * f : (speed - Math.sqrt(Math.max(0, speed * speed - 2 * ROLL * D * f))) / ROLL;
  const reachAt = (o: Man, f: number, hands: boolean) => {
    const px = b.x + (tx - b.x) * f,
      py = b.y + (ty - b.y) * f;
    let d0 = len(o.x - px, o.y - py);
    // A marker behind the receiver has to get round them first.
    if (o !== q && segDist(q, o.x, o.y, px, py) < 0.3 && len(q.x - px, q.y - py) < d0) d0 += 0.4;
    return Math.max(0, d0 - (hands ? 0.4 : 0.22)) / 1.9 + 0.18;
  };
  let meet = samples.length - 1;
  for (let i = 0; i < samples.length; i++)
    if (
      reachAt(q, samples[i], false) <=
      ballAt(samples[i]) + (i === samples.length - 1 ? 0.3 : 0.02)
    ) {
      meet = i;
      break;
    }
  let margin = reachAt(q, samples[meet], false) > ballAt(samples[meet]) + 0.3 ? -0.3 : 1;
  for (const o of s.men) {
    if (o.team === m.team) continue;
    for (let i = 0; i <= meet; i++) {
      const f = samples[i];
      const hands =
        o.keeper && inBox(s, o.team, { x: b.x + (tx - b.x) * f, y: b.y + (ty - b.y) * f });
      margin = Math.min(margin, reachAt(o, f, hands) - ballAt(f));
    }
  }
  if (s.t < s.settle[m.team]) margin -= WARY;
  const safety = clamp(0.5 + margin * 2.2, 0, 1);
  const forward = (toU(d, tx) - toU(d, b.x)) / LEN;
  // In their half a ball backward gives up ground that was hard to win.
  const gain = forward > 0 ? forward * 1.3 : forward * (toU(d, b.x) > 4.7 ? 1.8 : 0.9);
  let open = 9;
  for (const o of s.men) if (o.team !== m.team) open = Math.min(open, len(o.x - tx, o.y - ty));
  const ut = toU(d, tx),
    wt = toW(d, ty);
  let value = 0.55 + gain * 1.25 + clamp(open / 1.6, 0, 1) * 0.28;
  if (ut > 7 && Math.abs(wt) < 1.4) value += 0.22;
  else if (ut > 6.3 && toU(d, b.x) <= 6.3) value += 0.1;
  if (q.keeper) value -= closestOpp(s, m).d < 0.7 && toU(d, b.x) < 4 ? 0.05 : 0.35;
  if (kind === 'through') value += 0.12;
  if (kind === 'cross') value += 0.1;
  if (kind === 'switch') value += 0.06;
  // Keeping it patiently after a kick-off: no ball into the final third yet.
  if (s.t < s.settle[m.team] && ut > HOLD) value -= 0.5;
  if (air) value -= 0.1;
  if (
    kind === 'pass' &&
    s.pass &&
    s.pass.to === m.id &&
    s.pass.from === q.id &&
    s.t - s.pass.at < 3
  )
    value -= 0.2; // not straight back
  // Careful at the back, where losing it costs a goal; braver the nearer we are to theirs.
  const ub = toU(d, b.x);
  const risk =
    ub < 3.2 || s.t < s.settle[m.team]
      ? safety * safety * safety
      : ub < 6.3
        ? safety * safety
        : safety * Math.sqrt(safety);
  const score = value * risk;
  return { x: tx, y: ty, at: s.t, kind, to: q.id, speed, lift, score };
}
function cross(s: Sim, q: Man, target: Vec, kind: KickKind = 'cross'): Kick {
  const b = s.ball;
  const D = len(target.x - b.x, target.y - b.y);
  const T = 0.6 + D * 0.1;
  // Arrive at head height.
  const lift = (20 + G * T * T * 0.5) / T;
  return { ...target, at: s.t, kind, to: q.id, speed: D / T, lift, score: 0.6 };
}
/** How much sooner `team` reaches p than the other side (seconds; negative: they lose it). */
function race(s: Sim, team: 0 | 1, p: Vec, skip: Man | null) {
  let mine = 9,
    theirs = 9;
  for (const o of s.men) {
    if (o === skip || (o.keeper && toU(s.dir[o.team], p.x) > 2)) continue;
    const at = Math.max(0, dist(o, p) - 0.25) / 1.9 + (o.stun > s.t ? 0.35 : 0.18);
    if (o.team === team) mine = Math.min(mine, at);
    else theirs = Math.min(theirs, at);
  }
  return theirs - mine;
}
const CLEAR_LANES = [-2, -1.25, -0.45, 0.45, 1.25, 2];
/**
 * Clear the danger: a lofted ball over the first line into the channel a teammate is most
 * likely to win when it comes down, or out of play when every landing spot belongs to them.
 */
function clearKick(s: Sim, m: Man, header = false): Kick {
  const d = s.dir[m.team],
    b = s.ball;
  const u = toU(d, b.x);
  const peak = header ? 17 + s.rng() * 6 : 32 + s.rng() * 9;
  const vz = Math.sqrt(2 * G * peak),
    air = (2 * vz) / G;
  // How long the ball stays within reach of a head on the way up.
  const rise = (vz - Math.sqrt(Math.max(0, vz * vz - 2 * G * HEAD))) / G;
  let best: Kick | null = null,
    top = -9,
    edge = -9;
  for (const reach of header ? [2.4, 3.2, 4] : [3.8, 4.8, 5.8])
    for (const w of CLEAR_LANES) {
      const p = fromUW(d, Math.min(LEN - 0.8, u + reach), w);
      p.y = clamp(p.y, TOP + 0.3, BOT - 0.3);
      const D = dist(b, p);
      if (D < (header ? 2 : 3.4) || D / air > 5.4) continue;
      // Nobody may stand under the ball while it is still low enough to head or block.
      const low = Math.min(D * 0.5, (D / air) * rise + 0.2) / D;
      let blocked = false;
      for (const o of s.men)
        if (
          o.team !== m.team &&
          segDist(o, b.x, b.y, b.x + (p.x - b.x) * low, b.y + (p.y - b.y) * low) < 0.42
        )
          blocked = true;
      if (blocked) continue;
      // Where it comes down, and a stride on where it bounces.
      const on = { x: p.x + ((p.x - b.x) / D) * 0.8, y: p.y + ((p.y - b.y) / D) * 0.8 };
      const margin = Math.max(race(s, m.team, p, m), race(s, m.team, on, m) - 0.1);
      const score =
        clamp(margin, -1, 1.2) + (Math.abs(w) > 1.5 ? 0.12 : 0) + reach * 0.03 + s.rng() * 0.12;
      if (score > top) {
        top = score;
        edge = margin;
        best = { ...p, at: s.t, kind: 'clear', to: -1, speed: D / air, lift: vz, score: margin };
      }
    }
  if (best && edge > 0.05) return best;
  // No safe landing anywhere: put it out of play over the nearer touchline, or, from deep
  // and wide, behind for a corner.
  const side = Math.abs(b.y - CY) > 0.3 ? (b.y < CY ? -1 : 1) : s.rng() < 0.5 ? -1 : 1;
  const behind = u < 1.6 && Math.abs(b.y - CY) > 0.9 && !m.keeper && s.rng() < 0.55;
  const p = behind
    ? { x: ownLine(d) - d * 0.7, y: b.y < CY ? POST_A - 0.8 : POST_B + 0.8 }
    : { x: fromUW(d, Math.min(LEN - 1, u + 2.2), 0).x, y: side < 0 ? TOP - 0.7 : BOT + 0.7 };
  const D = dist(b, p),
    T = 0.45 + D * 0.12;
  // `to` -2: into touch, -3: behind for a corner.
  return {
    ...p,
    at: s.t,
    kind: 'clear',
    to: behind ? -3 : -2,
    speed: D / T,
    lift: (G * T) / 2,
    score: -1,
  };
}
function distribute(s: Sim, k: Man): Kick {
  let best: Kick | null = null;
  for (const q of s.men) {
    if (q.team !== k.team || q === k) continue;
    const near = dist(k, q) < 3.4;
    const kick = passTo(s, k, q, near ? 'pass' : 'lofted');
    if (!kick) continue;
    kick.kind = near ? (s.rng() < 0.5 ? 'roll' : 'throw') : s.rng() < 0.55 ? 'punt' : 'throw';
    if (kick.kind === 'throw' && !near) kick.score *= 0.8;
    if (kick.kind === 'punt') kick.score *= 0.9 + s.rng() * 0.3;
    if (!best || kick.score > best.score) best = kick;
  }
  if (best) {
    if (best.kind === 'throw') {
      const D = dist(s.ball, best);
      const T = 0.4 + D * 0.11;
      best.speed = D / T;
      best.lift = (G * T * T * 0.5 - 18) / T;
    } else if (best.kind === 'roll') best.lift = 0;
    return best;
  }
  return clearKick(s, k);
}

/** How good a shot looks from here: distance, angle, pressure and the keeper. */
function chance(s: Sim, m: Man) {
  const d = s.dir[m.team],
    b = s.ball;
  const gx = ownLine(-d);
  const ax = gx - b.x,
    ay = CY - b.y,
    dd = len(ax, ay) || 0.01;
  const facing = Math.abs(ax) / dd;
  let press = 9;
  for (const o of s.men) if (o.team !== m.team && !o.keeper) press = Math.min(press, dist(o, b));
  const pressure = clamp(1 - press / 1.1, 0, 1);
  const k = s.men[(1 - m.team) * 5];
  // A keeper off their line or off the ball's line toward goal leaves more to aim at.
  const off = segDist(k, b.x, b.y, gx, CY);
  let lane = 1;
  for (const o of s.men)
    if (o.team !== m.team && !o.keeper && segDist(o, b.x, b.y, gx, CY) < 0.24 && dist(o, b) < 1.6)
      lane = 0.65;
  const xg =
    clamp(0.9 - dd * 0.17, 0.03, 0.78) *
    (0.3 + 0.7 * facing * facing) *
    (1 - pressure * 0.45) *
    (1 + clamp(off - 0.2, 0, 0.8) * 0.6) *
    lane;
  return { xg, dist: dd, pressure, facing, lane };
}
function shotKick(s: Sim, m: Man, header: boolean): Kick {
  const d = s.dir[m.team];
  return {
    x: ownLine(-d),
    y: CY,
    at: s.t,
    kind: 'shot',
    to: header ? 1 : 0,
    speed: 0,
    lift: 0,
    score: 0,
  };
}

/** Strike the ball: passes, crosses, clearances, and shots with their outcome decided now. */
function fire(s: Sim, m: Man, k: Kick) {
  const b = s.ball,
    t = s.t,
    d = s.dir[m.team];
  if (k.kind === 'shot') return shoot(s, m, k.to === 1 ? 'header' : 'foot');
  const hands = b.mode === 'hands';
  const q = k.to >= 0 ? s.men[k.to] : null;
  // A run timed just right: the target peels off the markers into space the delivery reaches
  // without passing anyone, and they are beaten to it in the air.
  const run =
    q && (k.kind === 'corner' || k.kind === 'cross') && s.rng() < 0.6 ? peel(s, m, q, k) : null;
  if (run) k = run;
  let tx = k.x,
    ty = k.y;
  const D0 = len(tx - b.x, ty - b.y) || 0.01;
  // Imperfect feet: a little error in direction and weight, more under pressure and at range.
  const press = closestOpp(s, m).d;
  const err = (0.04 + D0 * 0.025 + (press < 0.6 ? 0.08 : 0)) * (hands ? 0.6 : run ? 0.3 : 1);
  const e = (s.rng() + s.rng() + s.rng() - 1.5) * err * 2;
  const nx = -(k.y - b.y) / D0,
    ny = (k.x - b.x) / D0;
  tx += nx * e;
  ty += ny * e;
  const D = len(tx - b.x, ty - b.y) || 0.01;
  const weight = 1 + (s.rng() - 0.5) * 0.08;
  launch(s, m, (tx - b.x) / D, (ty - b.y) / D, k.speed * weight, k.lift, k.kind);
  if (k.kind === 'throw' || k.kind === 'roll' || k.kind === 'return') {
    // The wind-up began when the throw was set: the release carries it on, never restarts it.
    const winding = m.act === 'throw' && t - m.actAt < 0.45;
    if (!winding && (!m.keeper || k.kind !== 'return')) act(s, m, 'throw', 0.6);
  } else {
    act(s, m, 'kick', 0.4);
    m.actAt = t - 0.15;
    const strength =
      k.kind === 'clear' || k.kind === 'punt'
        ? 0.85
        : k.kind === 'kickoff'
          ? 0.5
          : clamp(0.5 + k.speed * 0.04, 0.55, 0.72);
    sound(s, 'kick', strength);
  }
  if (k.kind === 'return') return;
  // A keeper's throw or kick out of the hands: the other side drops off for a moment.
  if (hands && m.keeper && s.mode === 'play') s.calm[1 - m.team] = t + 1.6;
  s.stats.passes[m.team]++;
  const oneTwo =
    !!q && !!s.pass && s.pass.from === k.to && s.pass.to === m.id && t - s.pass.at < 3 && !!q.run;
  s.pass = { from: m.id, to: k.to, team: m.team, kind: k.kind, at: t, oneTwo };
  s.poss = m.team;
  if (run) {
    // The markers around the run are caught flat-footed and leave it to the attacker.
    const flight = D / Math.max(0.5, k.speed * weight) + 0.15;
    for (const o of s.men)
      if (o.team !== m.team && !o.keeper && dist(o, run) < 1) o.beat = Math.max(o.beat, t + flight);
  }
  if (k.kind === 'clear')
    event(
      s,
      'clearance',
      m.team,
      m.id,
      k.to === -2 ? 'touch' : k.to === -3 ? 'behind' : 'clearance',
    );
  else if (k.kind === 'cross') event(s, 'cross', m.team, m.id, 'cross');
  else if (k.kind === 'corner') event(s, 'cross', m.team, m.id, 'cornerKick');
  // Give-and-go: after a short pass forward the passer sometimes bursts on for the return.
  if (q && !m.keeper && (k.kind === 'pass' || k.kind === 'through') && s.mode === 'play') {
    const u = toU(d, m.x);
    if (u > 2.5 && u < 7.5 && dist(m, q) < 3 && s.rng() < 0.3) {
      const target = fromUW(d, Math.min(8.4, u + 2), toW(d, m.y) * 0.7);
      m.run = { ...target, until: t + 1.9 };
    }
  }
}

/** Where a target can peel off to, relative to where the delivery was aimed: a stride or two. */
const PEEL: readonly (readonly [number, number])[] = [
  [0, 0],
  ...[0.35, 0.65].flatMap((r) =>
    [
      [1, 0],
      [0.7071, 0.7071],
      [0, 1],
      [-0.7071, 0.7071],
      [-1, 0],
      [-0.7071, -0.7071],
      [0, -1],
      [0.7071, -0.7071],
    ].map(([x, y]) => [x * r, y * r] as const),
  ),
];
/**
 * A delivery to space the target can still reach, whose flight clears every opponent (the keeper
 * by more): the nearest to where it was aimed, or null when there is none.
 */
function peel(s: Sim, m: Man, q: Man, k: Kick): Kick | null {
  const b = s.ball;
  let best: Kick | null = null,
    bd = 9;
  for (const [ox, oy] of PEEL) {
    const off = len(ox, oy);
    if (off >= bd) continue;
    const x = clamp(k.x + ox, L + 0.3, R - 0.3),
      y = clamp(k.y + oy, TOP + 0.3, BOT - 0.3);
    const D = len(x - b.x, y - b.y),
      T = 0.6 + D * 0.1;
    if (D < 1 || len(x - q.x, y - q.y) - 0.2 > (T - 0.2) * SPRINT) continue;
    let clear = true;
    for (const o of s.men)
      if (o.team !== m.team && segDist(o, b.x, b.y, x, y) < (o.keeper ? 0.5 : 0.4)) clear = false;
    if (!clear) continue;
    bd = off;
    // Arrive at head height.
    best = { ...k, x, y, speed: D / T, lift: (20 + (G * T * T) / 2) / T };
  }
  return best;
}

/** A shot: the outcome is decided at the strike, then the ball is aimed to match. */
function shoot(s: Sim, m: Man, style: 'foot' | 'header' | 'volley', rebound = false) {
  const b = s.ball,
    t = s.t,
    d = s.dir[m.team];
  const c = chance(s, m);
  const keeper = s.men[(1 - m.team) * 5];
  const gx = ownLine(-d);
  let xg = c.xg * (style === 'header' ? 0.75 : style === 'volley' ? 0.85 : 1);
  // A chance made by a pass is a better one: the defence has been moved and the shooter is set.
  if (t - m.fed < 2.2) xg *= ASSISTED;
  if (m.slot === 4) xg *= 1.15;
  else if (m.slot === 1) xg *= 0.8;
  // Blockers: an outfield opponent close to the line of the shot.
  let blocker = -1;
  for (const o of s.men)
    if (o.team !== m.team && !o.keeper && dist(o, b) < 1.7 && dist(o, b) > 0.3)
      if (segDist(o, b.x, b.y, gx, CY) < 0.26 && toU(d, o.x) > toU(d, b.x)) blocker = o.id;
  // The keeper's plane: where the ball passes them on its way to the line.
  const kx = keeper.x;
  const between = (kx - b.x) * d > 0.05 && (gx - kx) * d >= -0.05;
  let outcome: Shot['outcome'];
  if (blocker >= 0 && s.rng() < BLOCKED) outcome = 'block';
  else {
    // Most shots that trouble the keeper are saved: only the best chances are likelier in than
    // out, and a speculative effort is mostly the keeper's or wide.
    const r = s.rng();
    const goal = clamp(xg * CONVERT, 0.02, 0.62);
    const onTarget = clamp(ON_TARGET + xg * 0.9 - c.pressure * 0.1, goal + 0.24, 0.9);
    outcome = r < goal ? 'goal' : r < onTarget ? 'save' : s.rng() < 0.12 ? 'post' : 'miss';
  }
  // A keeper still down from an earlier dive makes no new save: the shot goes in or wide,
  // unless it is struck straight into them where they lie.
  const down = diving(s, keeper);
  let body = false;
  if (outcome === 'save' && (!between || down)) {
    body = between && down && t - keeper.actAt > keeper.diveBurst + 0.18 && s.rng() < 0.4;
    if (!body) outcome = s.rng() < 0.5 ? 'goal' : 'miss';
  }
  const toLine = (yPlane: number) => b.y + ((yPlane - b.y) * (gx - b.x)) / (kx - b.x);
  const toPlane = (yLine: number) => b.y + ((yLine - b.y) * (kx - b.x)) / (gx - b.x);
  const power =
    style === 'header'
      ? 4.4
      : style === 'volley'
        ? 6.6
        : 6.3 + s.rng() * 1.5 - (c.dist < 1.6 ? 1.2 : 0);
  const speed = Math.min(BALL_MAX, power);
  // The highest the ball can be when it reaches the line (a strike can only rise so fast).
  const T0 = c.dist / speed;
  const top = b.z + MAX_LIFT * T0 - (G * T0 * T0) / 2;
  // Aim, around where the keeper is (or, still sliding from a dive, comes to rest).
  const ky = down ? diveRest(s, keeper) : keeper.y;
  let y: number, zLine: number;
  if (outcome === 'goal') {
    const far = ky < CY ? 1 : -1;
    const side = down || s.rng() < 0.8 ? far : -far;
    y = CY + side * (0.42 + s.rng() * 0.26);
    if (between && Math.abs(toPlane(y) - ky) < 0.45) y = CY - side * (0.42 + s.rng() * 0.26);
    zLine = s.rng() < 0.55 ? 1 + s.rng() * 5 : 8 + s.rng() * 10;
  } else if (body) {
    y = clamp(toLine(ky + (s.rng() - 0.5) * 0.2), POST_A + 0.15, POST_B - 0.15);
    zLine = 1 + s.rng() * 4;
  } else if (outcome === 'save') {
    // Most saves need a dive: aim toward the edge of the keeper's reach, inside the frame.
    // Some come straight at them.
    let off =
      s.rng() < 0.28 ? (s.rng() - 0.5) * 0.3 : (s.rng() < 0.5 ? -1 : 1) * (0.5 + s.rng() * 0.35);
    const yl = toLine(ky + off);
    if (yl < POST_A + 0.15 || yl > POST_B - 0.15) off = -off;
    y = clamp(toLine(ky + off), POST_A + 0.15, POST_B - 0.15);
    zLine = s.rng() < 0.6 ? 1 + s.rng() * 6 : 8 + s.rng() * 10;
  } else if (outcome === 'post') {
    y = s.rng() < 0.5 ? POST_A : POST_B;
    zLine = 2 + s.rng() * 12;
    if (s.rng() < 0.3 && top > BAR + 2) {
      y = CY + (s.rng() - 0.5) * 1.2;
      zLine = BAR;
    }
  } else if (outcome === 'miss') {
    if (s.rng() < 0.6 || top < BAR + 8) {
      const side = s.rng() < 0.5 ? -1 : 1;
      y = CY + side * (0.95 + s.rng() * 0.6);
      zLine = 1 + s.rng() * 10;
    } else {
      y = CY + (s.rng() - 0.5) * 1.5;
      zLine = Math.min(BAR + 4 + s.rng() * 16, top - 2);
    }
  } else {
    y = CY + (s.rng() - 0.5) * 1;
    zLine = 3;
  }
  // Speed and lift so the ball crosses the line at (gx, y) at height zLine.
  zLine = clamp(zLine, 0.5, Math.max(0.5, top - 1));
  const dx = gx - b.x,
    dy = y - b.y,
    D = len(dx, dy) || 0.01;
  const T = D / speed;
  const lift = clamp((zLine - b.z + (G * T * T) / 2) / T, b.z > 1 ? -80 : 0, MAX_LIFT);
  launch(s, m, dx / D, dy / D, speed, lift, 'shot');
  // Refine the lift against the real flight so the ball crosses where it must.
  for (let i = 0; i < 4; i++) {
    const zc = crossHeight(s, gx, d);
    if (zc === null || Math.abs(zc - zLine) < 0.5) break;
    b.vz = Math.min(MAX_LIFT, b.vz + (zLine - zc) / Math.max(0.15, T));
    if (b.vz < 0 && b.z < 1) b.vz = 0;
  }
  if (outcome === 'goal' || outcome === 'save') s.onTargetOpen[m.team]++;
  mark(s, m.team, 'shot');
  if (outcome === 'goal' || outcome === 'save') mark(s, m.team, 'onTarget');
  act(s, m, 'kick', 0.4);
  m.actAt = t - 0.15;
  sound(s, 'kick', style === 'header' ? 0.6 : 1);
  const key =
    style === 'header'
      ? 'header'
      : rebound
        ? 'rebound'
        : style === 'volley'
          ? 'volley'
          : c.dist > 4.5
            ? 'longShot'
            : 'shot';
  event(s, 'shot', m.team, m.id, key);
  // The most advanced teammate follows it in, for anything the keeper spills.
  let follower: Man | null = null;
  for (const q of s.men)
    if (q.team === m.team && !q.keeper && q !== m && toU(d, q.x) > 5)
      if (!follower || toU(d, q.x) > toU(d, follower.x)) follower = q;
  if (follower) {
    const p = fromUW(d, 8.1, clamp(toW(d, follower.y) * 0.5, -0.9, 0.9));
    follower.run = { ...p, until: t + 1.4 };
  }
  // The keeper: reach a save, dive late or the wrong way when beaten.
  const arrive = t + Math.abs(kx - b.x) / Math.max(0.5, Math.abs(b.vx));
  const need = (between ? toPlane(y) : y) - ky;
  let diveTo = 0,
    diveAt = arrive,
    diveReach = Math.abs(need);
  const big = outcome === 'save' && Math.abs(need) > 0.62;
  if (outcome === 'save') {
    diveTo = Math.abs(need) > 0.32 ? (need > 0 ? 1 : -1) : 0;
    diveAt = Math.max(t + 0.1, arrive - 0.3);
    diveReach = Math.max(0, Math.abs(need) - 0.25);
  } else if (outcome === 'goal' || outcome === 'post') {
    // Beaten: usually the right way but too late, now and then sold the wrong way.
    const wrong = s.rng() < 0.08;
    diveTo = s.rng() < 0.15 ? 0 : (need > 0 ? 1 : -1) * (wrong ? -1 : 1);
    diveAt = arrive - 0.1;
    diveReach = 0.35;
  } else if (outcome === 'miss' && Math.abs(y - CY) < 1.2 && zLine < BAR) {
    diveTo = need > 0 ? 1 : -1;
    diveAt = arrive - 0.08;
    diveReach = 0.3;
  }
  tag(s, 'out:' + outcome);
  // How the keeper deals with it: a high one tipped over, a firm one turned round the post,
  // one they see all the way held, the rest parried or beaten away.
  let tip = false,
    over = false,
    catchIt = false;
  if (outcome === 'save' && !body) {
    const high = zLine > 11,
      r = s.rng();
    if (high && r < 0.3) over = true;
    else if (diveTo !== 0 && speed > 5.2 && r < (high ? 0.62 : 0.4)) tip = true;
    else catchIt = s.rng() < (diveTo !== 0 ? 0.15 : 0.4) + (c.dist > 4.5 ? 0.15 : 0);
  }
  s.shot = {
    by: m.id,
    team: m.team,
    keeper: keeper.id,
    outcome,
    at: t,
    y,
    blocker,
    catchIt,
    tip,
    over,
    deflect: outcome === 'block' && s.rng() < 0.4,
    body,
    diveAt,
    diveTo,
    diveReach,
    dived: false,
    big,
  };
  s.pass = null;
  s.poss = m.team;
}
const ASSISTED = 1.4,
  CONVERT = 1.38,
  ON_TARGET = 0.55,
  BLOCKED = 0.34,
  REBOUND = 0.65;
/** Height at which the loose ball, left alone, crosses the goal line at gx (or null). */
function crossHeight(s: Sim, gx: number, d: number) {
  const b = s.ball;
  const c = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz };
  for (let i = 0; i < 60; i++) {
    const ox = c.x,
      oz = c.z;
    fly(c);
    if ((c.x - gx) * d >= 0) {
      const f = (gx - ox) / (c.x - ox || 1e-9);
      return oz + (c.z - oz) * f;
    }
  }
  return null;
}

// ---------------------------------------------------------------- contact
function contacts(s: Sim) {
  const b = s.ball,
    t = s.t;
  if (b.mode !== 'free' || b.net >= 0) return;
  const sh = s.shot;
  if (sh) return shotContact(s, sh);
  // Nobody can meet a ball in the instant it is struck.
  if (t - s.since < 0.12 && b.owner === null) return;
  const ox = b.x - b.rvx * DT,
    oy = b.y - b.rvy * DT;
  let best: Man | null = null,
    bd = 9;
  for (const m of s.men) {
    if (m.guard > t || m.stun > t || m.act === 'dive') continue;
    if (s.mode === 'goal' && !(s.goal && s.goal.thrown && m.id === (1 - s.goal.team) * 5 + 4))
      continue;
    const hands = m.keeper && s.mode === 'play' && inBox(s, m.team, b) && !backPass(s, m);
    const top = hands ? HANDS : HEAD;
    if (b.z > top) continue;
    // The kick-off taker is expecting the keeper's ball back. A marker beaten in the air only
    // meets a ball that flies into the body.
    const reach = hands ? 0.34 : s.mode === 'goal' ? 0.3 : m.beat > t ? BODY : 0.22;
    const dd = segDist(m, ox, oy, b.x, b.y);
    if (dd < reach && dd < bd) {
      bd = dd;
      best = m;
    }
  }
  if (!best) return;
  // Whoever meets it, the delivery is over: nobody is beaten to the next ball.
  for (const m of s.men) m.beat = 0;
  if (s.mode !== 'play') {
    if (s.mode === 'goal') gain(s, best, 'feet');
    return;
  }
  touch(s, best);
}
function backPass(s: Sim, k: Man) {
  return !!s.pass && s.pass.team === k.team && s.pass.kind !== 'cross' && s.t - s.pass.at < 3;
}
function touch(s: Sim, m: Man) {
  const b = s.ball,
    t = s.t,
    d = s.dir[m.team];
  const pass = s.pass;
  const lostBy = s.lastTeam;
  const mine = !!pass && pass.team === m.team;
  const hands = m.keeper && inBox(s, m.team, b) && !backPass(s, m);
  if (hands) {
    finishPass(s, m, pass, lostBy);
    gain(s, m, 'hands');
    if (pass && pass.team !== m.team)
      event(
        s,
        'interception',
        m.team,
        m.id,
        pass.kind === 'cross' || pass.kind === 'corner' ? 'claim' : 'interception',
      );
    act(s, m, 'catch', 0.5);
    m.decide = t + 0.6 + s.rng() * 0.5;
    return;
  }
  const c = chance(s, m);
  const near = c.dist < 3.2 && !late(s) && toU(d, m.x) > 5.5;
  if (b.z > CHEST) {
    // In the air: attack it toward goal, head it clear, or cushion it down.
    if (near && (mine || s.rng() < 0.5)) {
      finishPass(s, m, pass, lostBy);
      return shoot(s, m, 'header');
    }
    if (!mine && toU(d, m.x) < 4.7) {
      finishPass(s, m, pass, lostBy, true);
      return fire(s, m, clearKick(s, m, true));
    }
  } else if (
    mine &&
    near &&
    (c.dist < 2.6 || (c.dist < 3.3 && c.facing > 0.75 && c.pressure < 0.6)) &&
    (pass!.kind === 'cross' || pass!.kind === 'corner' || s.rng() < 0.5) &&
    s.rng() < 0.75
  ) {
    // First time from a cross, a cut-back or a ball laid into their stride.
    finishPass(s, m, pass, lostBy);
    return shoot(s, m, b.z > FEET ? 'volley' : 'foot');
  } else if (
    !mine &&
    s.rebound > t &&
    s.reboundTeam === m.team &&
    c.dist < 3.4 &&
    !late(s) &&
    s.rng() < REBOUND
  ) {
    // Off the keeper, a defender or the woodwork: hit it before they recover.
    finishPass(s, m, pass, lostBy);
    return shoot(s, m, b.z > FEET ? 'volley' : 'foot', true);
  } else if (
    mine &&
    pass!.kind !== 'clear' &&
    pass!.kind !== 'punt' &&
    !late(s) &&
    !choosy(s, m) &&
    c.dist >= 2.6 &&
    c.dist < 5.2 &&
    c.lane === 1 &&
    c.facing > 0.7 &&
    c.pressure < 0.5 &&
    b.z <= CHEST &&
    s.rng() < 0.9 * longRange(s, m, toU(d, b.x), s.chain + 1) * clamp((5.6 - c.dist) / 1.6, 0.3, 1)
  ) {
    // Laid into their path with the goal in sight: struck first time from distance.
    finishPass(s, m, pass, lostBy);
    return shoot(s, m, b.z > FEET ? 'volley' : 'foot');
  }
  // Under pressure in the box, a defender just clears it.
  if (!mine && toU(d, m.x) < 2 && closestOpp(s, m).d < 0.6 && s.rng() < 0.4 && !winding(s)) {
    finishPass(s, m, pass, lostBy, true);
    return fire(s, m, clearKick(s, m));
  }
  // A fast ball can squirm away from a heavy touch.
  if (len(b.vx, b.vy) > 5 && s.rng() < 0.3) {
    s.last = m.id;
    s.lastTeam = m.team;
    b.vx *= 0.35;
    b.vy *= 0.35;
    b.vz = Math.abs(b.vz) * 0.3;
    m.guard = t + 0.25;
    if (pass && pass.team !== m.team) s.stats.turnovers[pass.team]++;
    s.pass = null;
    return;
  }
  finishPass(s, m, pass, lostBy);
  gain(s, m, 'feet');
}
/** Book the pass that just arrived: completed, a one-two, or intercepted. */
function finishPass(s: Sim, m: Man, pass: Pass | null, lostBy: 0 | 1 | null, quiet = false) {
  if (pass && pass.team === m.team && pass.kind !== 'clear') {
    s.stats.completed[m.team]++;
    // Patient passing just after a kick-off does not count as working the move.
    if (s.chainTeam === m.team && s.t >= s.settle[m.team]) s.chain++;
    const from = pass.from;
    const told = s.events.length;
    const D = dist(s.men[from], m);
    const d = s.dir[m.team];
    const kicked = pass.kind !== 'throw' && pass.kind !== 'roll' && pass.kind !== 'return';
    // Notable passes are told at the moment of the kick, once we know they arrived.
    if (!kicked) {
      // Throws and rolls from the hands are not worth a line.
    } else if (pass.oneTwo && m.id === pass.to)
      event(s, 'pass', m.team, from, 'oneTwo', { q: m.id }, pass.at);
    else if (pass.kind === 'through' && m.id === pass.to)
      event(s, 'pass', m.team, from, 'through', { q: m.id }, pass.at);
    else if (pass.kind === 'switch') event(s, 'pass', m.team, from, 'switch', { q: m.id }, pass.at);
    else if (m.keeper && pass.kind === 'pass' && s.talk() < 0.5)
      event(s, 'pass', m.team, from, 'back', { q: m.id }, pass.at);
    else if (D > 3.8 && pass.kind !== 'cross' && pass.kind !== 'corner' && s.talk() < 0.6)
      event(s, 'pass', m.team, from, 'long', { q: m.id }, pass.at);
    else if (
      toU(d, m.x) > 7.6 &&
      Math.abs(m.y - CY) < 1.3 &&
      pass.kind === 'pass' &&
      s.talk() < 0.6
    )
      event(s, 'pass', m.team, from, 'box', { q: m.id }, pass.at);
    else if (toU(d, m.x) - toU(d, s.men[from].x) > 1.1 && s.talk() < 0.45)
      event(s, 'pass', m.team, from, 'forward', { q: m.id }, pass.at);
    if (kicked) {
      m.fed = s.t;
      m.fedBy = from;
      m.fedAt = pass.at;
      m.fedTold = s.events.length > told;
    }
  } else if (pass && pass.team !== m.team) {
    s.stats.turnovers[pass.team]++;
    tag(s, 'lost:' + pass.kind);
    if (!m.keeper && !quiet) event(s, 'interception', m.team, m.id, 'interception');
  } else if (!pass && lostBy !== null && lostBy !== m.team) s.stats.turnovers[lostBy]++;
  s.pass = null;
}
function gain(s: Sim, m: Man, how: 'feet' | 'hands') {
  const b = s.ball,
    t = s.t;
  if (s.chainTeam !== m.team) {
    s.chainTeam = m.team;
    s.chain = 0;
  }
  b.owner = m.id;
  b.mode = how;
  b.phase = 0.05;
  b.amp = how === 'feet' ? 0.16 : 0;
  b.lift = 13;
  b.vz = 0;
  s.last = m.id;
  s.lastTeam = m.team;
  s.since = t;
  m.since = t;
  // Keepers with the ball at their feet move it on quickly.
  m.decide = t + (how === 'hands' ? 1.4 : m.keeper ? 0.15 + s.rng() * 0.2 : 0.1 + s.rng() * 0.2);
  const sp = len(m.vx, m.vy);
  const d = s.dir[m.team];
  m.dribX = sp > 0.3 ? m.vx / sp : d;
  m.dribY = sp > 0.3 ? m.vy / sp : 0;
  m.pace = Math.max(0.6, Math.min(1.3, sp));
  if (s.mode === 'play') s.poss = m.team;
}
function shotContact(s: Sim, sh: Shot) {
  const b = s.ball,
    t = s.t;
  const k = s.men[sh.keeper];
  if (sh.outcome === 'block' && sh.blocker >= 0) {
    const o = s.men[sh.blocker];
    const da = s.dir[sh.team];
    if (len(o.x - b.x, o.y - b.y) < 0.28 && b.z < HEAD) {
      const sp = len(b.vx, b.vy);
      if (sh.deflect) {
        // Off a shin and wide of the post: left alone, it runs on over the line for a corner.
        const gx = ownLine(-da),
          side = b.y < CY ? -1 : 1;
        const tx = gx + da * 0.3,
          ty = CY + side * (1.1 + s.rng() * 0.6);
        const D = len(tx - b.x, ty - b.y) || 0.01;
        const v = clamp(sp * 0.5, Math.sqrt(2 * ROLL * D) + 0.8, 5.5);
        b.vx = ((tx - b.x) / D) * v;
        b.vy = ((ty - b.y) / D) * v;
        b.vz = 4 + s.rng() * 14;
        event(s, 'miss', sh.team, sh.by, 'deflected', { q: o.id });
      } else {
        b.vx = -b.vx * 0.25 + (s.rng() - 0.5) * sp * 0.5;
        b.vy = b.vy * 0.3 + (s.rng() - 0.5) * sp * 0.6;
        b.vz = 10 + s.rng() * 25;
        event(s, 'miss', sh.team, sh.by, 'block', { q: o.id });
        loose(s, sh.team);
      }
      s.last = o.id;
      s.lastTeam = o.team;
      o.guard = t + 0.3;
      sound(s, 'ooh', 0.5);
      s.shot = null;
      s.pass = null;
    } else if (toU(da, b.x) > toU(da, o.x) + 0.3) {
      // The block never came: it is the keeper's to deal with now, on target after all (a
      // keeper still down from a dive can only stop it with the body).
      sh.outcome = 'save';
      sh.body = diving(s, k);
      sh.catchIt = !sh.body;
      sh.blocker = -1;
      s.onTargetOpen[sh.team]++;
      mark(s, sh.team, 'onTarget');
    }
    return;
  }
  if (sh.outcome !== 'save') {
    // A weak effort that dies before the line becomes a loose ball.
    if (len(b.vx, b.vy) < 1 && b.z < 1) s.shot = null;
    return;
  }
  const d = s.dir[k.team];
  // Diving, the reach stretches toward the dive and behind it no further than standing; down
  // from an earlier dive, only a low ball struck into the body is kept out.
  const off = b.y - k.y,
    dv = k.dive;
  const lo = sh.body ? -0.3 : dv < 0 ? -0.48 + dv * 0.8 : -0.48,
    hi = sh.body ? 0.3 : dv > 0 ? 0.48 + dv * 0.8 : 0.48;
  const past = toU(d, b.x) <= toU(d, k.x) + 0.12;
  if (!past || off < lo || off > hi || b.z > (sh.body ? CHEST : HANDS)) {
    if (past && toU(d, b.x) < toU(d, k.x) - 0.3) s.shot = null; // got by after all
    return;
  }
  saveMade(s, k, sh);
}
function saveMade(s: Sim, k: Man, sh: Shot) {
  const b = s.ball,
    t = s.t,
    d = s.dir[k.team];
  mark(s, k.team, 'save');
  s.onTargetOpen[sh.team] = Math.max(0, s.onTargetOpen[sh.team] - 1);
  s.shot = null;
  s.last = k.id;
  s.lastTeam = k.team;
  if (sh.big) {
    sound(s, 'ooh', 0.8);
    sound(s, 'applause', 0.6, t + 0.6);
  }
  const dived = k.act === 'dive' && t < k.actAt + k.actDur;
  if (sh.catchIt) {
    event(s, 'save', k.team, k.id, sh.big ? 'bigSave' : dived ? 'diveSave' : 'straight', {
      k: k.id,
    });
    gain(s, k, 'hands');
    if (!dived) act(s, k, 'catch', 0.5);
    k.decide = t + 0.7 + s.rng() * 0.5;
    return;
  }
  const sp = len(b.vx, b.vy);
  const side = b.y < CY ? -1 : 1;
  if (sh.over && b.z > 8) {
    // Up and over: a flick of the fingers lifts it over the bar and behind for a corner.
    const u = Math.max(0.05, toU(d, b.x));
    const across = 1.1 + s.rng() * 0.5,
      T = u / across;
    b.vx = -d * across;
    b.vy *= 0.15;
    b.vz = (BAR + 7 - b.z + (G * T * T) / 2) / T;
    event(s, 'save', k.team, k.id, 'tippedOver', { k: k.id });
    if (!sh.big) sound(s, 'ooh', 0.6);
    if (!dived) act(s, k, 'catch', 0.3);
    k.guard = t + 0.6;
    s.pass = null;
    return;
  }
  let tip = sh.tip && dived;
  if (tip) {
    // Turned round the post: slow, sideways, and certain to cross the line outside the frame.
    const u = Math.max(0.05, toU(d, b.x));
    const across = 1.1 + s.rng() * 0.5;
    const wide = (side < 0 ? POST_A - 0.3 : POST_B + 0.3) - b.y;
    const vy = side * Math.max(1.8 + s.rng() * 0.8, (Math.abs(wide) * across) / u);
    if (Math.abs(vy) > 4) tip = false;
    else {
      b.vx = -d * across;
      b.vy = vy;
      event(s, 'save', k.team, k.id, 'tipped', { k: k.id });
    }
  }
  if (!tip) {
    // Beaten back out: it drops in front of goal, where it is anyone's.
    b.vx = d * Math.min(sp, 6) * (0.2 + s.rng() * 0.2);
    b.vy = side * (0.5 + s.rng() * 1.2);
    const key = sh.body || !dived ? 'beaten' : sh.big ? 'bigSave' : 'parry';
    event(s, 'save', k.team, k.id, key, { k: k.id });
    // A save with the body: arms up and it rebounds off them.
    if (!dived) act(s, k, 'catch', 0.3);
    loose(s, sh.team);
  }
  b.vz = 18 + s.rng() * 20;
  k.guard = t + 0.6;
  s.pass = null;
  s.lastTeam = k.team;
}

/** A ball knocked loose in front of goal: the attacking side may snap at it first time. */
function loose(s: Sim, team: 0 | 1) {
  s.rebound = s.t + 1.4;
  s.reboundTeam = team;
}
function tackles(s: Sim) {
  const b = s.ball,
    t = s.t;
  if (b.mode !== 'feet' || b.owner === null || b.owner < 0) return;
  const c = s.men[b.owner];
  if (c.kick && t > c.kick.at - 0.08) return;
  for (const m of s.men) {
    if (m.team === c.team || m.keeper || m.stun > t || m.guard > t) continue;
    // A presser's step-in meets the ball; anyone else only when it is run right at them.
    const lunging = m.lunge > t;
    const near = len(m.x - b.x, m.y - b.y);
    if (lunging ? near > 0.3 && dist(m, c) > 0.3 : near > 0.22) continue;
    if (!lunging && (t < s.calm[m.team] || s.rng() > 1.2 * DT)) continue;
    m.lunge = 0;
    m.guard = t + 0.9;
    const r = s.rng();
    s.stats.tackles[m.team]++;
    act(s, m, 'tackle', 0.55);
    tag(s, r < 0.35 ? 'lost:tackle' : r < 0.65 ? 'lost:poke' : 'skipped');
    if (r < 0.35) {
      c.stun = t + 0.45;
      s.stats.turnovers[c.team]++;
      event(s, 'tackle', m.team, m.id, 'tackle', { q: c.id });
      s.pass = null;
      gain(s, m, 'feet');
      c.kick = null;
    } else if (r < 0.65) {
      c.stun = t + 0.35;
      m.stun = t + 0.3;
      c.kick = null;
      const ax = b.x - m.x,
        ay = b.y - m.y,
        al = len(ax, ay) || 1;
      const sp = 1.6 + s.rng() * 1.6;
      b.mode = 'free';
      b.owner = null;
      b.vx = (ax / al) * sp + (s.rng() - 0.5) * 1.4;
      b.vy = (ay / al) * sp + (s.rng() - 0.5) * 1.4;
      b.vz = s.rng() * 12;
      s.last = m.id;
      s.lastTeam = m.team;
      m.guard = t + 0.2;
      c.guard = t + 0.25;
      s.pass = null;
      s.since = t;
      event(s, 'tackle', m.team, m.id, 'poke', { q: c.id });
    } else {
      m.stun = t + 0.85;
      const d = s.dir[c.team];
      c.dribX = d * 0.8192;
      c.dribY = (c.y < CY ? 1 : -1) * 0.5736;
      c.pace = 1.7;
      c.decide = t + 0.5;
      event(s, 'dribble', c.team, c.id, 'dribble', { q: m.id });
    }
    return;
  }
}

// ---------------------------------------------------------------- bookkeeping
function tally(s: Sim) {
  const b = s.ball;
  const playing = s.mode === 'play';
  if (playing) {
    s.stats.inPlay += DT;
    const team = b.owner !== null && b.owner >= 0 ? s.men[b.owner].team : s.poss;
    if (team !== null) s.possTime[team] += DT;
    // Average teammate spacing among outfield players.
    for (const team2 of [0, 1]) {
      let sum = 0,
        n = 0;
      for (let i = 1; i < 5; i++)
        for (let j = i + 1; j < 5; j++) {
          sum += dist(s.men[team2 * 5 + i], s.men[team2 * 5 + j]);
          n++;
        }
      s.spacingSum += sum / n;
      s.spacingN++;
    }
  }
  for (const m of s.men) {
    if (m.keeper) s.stats.maxKeeper = Math.max(s.stats.maxKeeper, m.speed);
    else s.stats.maxSpeed = Math.max(s.stats.maxSpeed, m.speed);
  }
  s.stats.maxRef = Math.max(s.stats.maxRef, s.ref.speed);
  s.stats.maxBall = Math.max(s.stats.maxBall, len(b.rvx, b.rvy));
  // Excitement: how near the attacking team is to goal, spiking with shots and goals.
  let target = 0.12;
  if (s.mode === 'goal') target = 1;
  else if (s.mode === 'break') target = 0.08;
  else if (s.shot) target = 1;
  else if (s.poss !== null) {
    const u = toU(s.dir[s.poss], b.x);
    target = 0.12 + clamp((u - 4.5) / 4.5, 0, 1) * 0.7;
    if (s.set && s.set.kind === 'corner') target = 0.65;
  }
  s.excite += (target - s.excite) * (target > s.excite ? 0.2 : 0.04);
  s.bulge[0] = Math.max(0, s.bulge[0] - DT / 1.4);
  s.bulge[1] = Math.max(0, s.bulge[1] - DT / 1.4);
}

function record(s: Sim, f: Float32Array, k: number) {
  const o = k * FIELDS,
    t = s.t;
  for (const m of s.men) {
    const p = o + m.id * PF;
    f[p] = m.x;
    f[p + 1] = m.y;
    f[p + 2] = m.fx;
    f[p + 3] = m.fy;
    f[p + 4] = m.speed;
    f[p + 5] = m.stride;
    f[p + 6] = ACTION_CODE[m.act];
    const loop = LOOPS[m.act];
    f[p + 7] = loop
      ? (t - m.actAt) / loop - Math.floor((t - m.actAt) / loop)
      : m.act === 'run' || m.act === 'stand'
        ? 0
        : clamp((t - m.actAt) / (m.actDur || 1), 0, 1);
    f[p + 8] = m.dive;
    f[p + 9] = s.ball.owner === m.id ? 1 : 0;
  }
  const r = s.ref,
    p = o + REF_AT;
  f[p] = r.x;
  f[p + 1] = r.y;
  f[p + 2] = r.fx;
  f[p + 3] = r.fy;
  f[p + 4] = r.speed;
  f[p + 5] = r.stride;
  f[p + 6] = REF_ACTIONS.indexOf(r.act);
  f[p + 7] =
    r.act === 'whistle'
      ? clamp((t - r.actAt) / 0.6, 0, 1)
      : r.act === 'point' && s.goal
        ? clamp((t - s.goal.at - 1.3) / 1.6, 0, 1)
        : 0;
  const b = s.ball,
    q = o + BALL_AT;
  f[q] = b.x;
  f[q + 1] = b.y;
  f[q + 2] = b.z;
  f[q + 3] = b.rvx;
  f[q + 4] = b.rvy;
  f[q + 5] = b.spin;
  f[q + 6] = b.owner === null ? -2 : b.owner;
  f[q + 7] = b.mode === 'hands' ? 1 : 0;
  const e = o + META_AT;
  f[e] = s.possTime[0];
  f[e + 1] = s.possTime[1];
  f[e + 2] = s.excite;
  f[e + 3] = s.bulge[0];
  f[e + 4] = s.bulge[1];
  f[e + 5] = s.mode === 'break' ? -1 : s.mode === 'goal' ? -1 : s.set ? s.set.team : (s.poss ?? -1);
  f[e + 6] = s.set
    ? RESTART_KINDS.indexOf(s.set.kind)
    : s.mode === 'goal' && s.goal && t - s.goal.at > 3
      ? 1
      : 0;
  f[e + 7] = s.since;
}
