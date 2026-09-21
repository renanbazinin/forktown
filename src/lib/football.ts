import { FOOTBALL_SITE } from './town-config.ts';
import { PLOTS, hash, project, type Point } from './world.ts';

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
export type FootballSound = { at: number; kind: 'kick' | 'whistle' | 'cheer'; strength: number };
export type FootballPlayer = Point & {
  team: 0 | 1;
  number: number;
  moving: boolean;
  kick: boolean;
  celebrate: boolean;
  dive: number;
};
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
  saves: [number, number];
  caption: string;
  players: FootballPlayer[];
  ball: Point & { height: number };
  goal: boolean;
  sounds: FootballSound[];
};
const CENTER = { x: 15.5, y: 25 };
const mix = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const bases: Point[] = [
  { x: 11.05, y: 25 },
  { x: 13.6, y: 23.7 },
  { x: 13.9, y: 26.2 },
  { x: 15.1, y: 25 },
  { x: 19.95, y: 25 },
  { x: 17.4, y: 26.3 },
  { x: 17.1, y: 23.8 },
  { x: 15.9, y: 25 },
];
function attack(day: number, match: number, index: number) {
  const seed = hash(`football:${day}:${match}:${index}`);
  const team = ((index + (hash(`kickoff:${day}:${match}`) % 2)) % 2) as 0 | 1;
  const direction = team === 0 ? 1 : -1;
  const wing = seed % 2 ? 1 : -1;
  const goal = seed % 5 < 2;
  const save = !goal && seed % 5 < 4;
  const start = index < 5 ? index * 12 : 68 + (index - 5) * 12;
  const targets = [
    CENTER,
    { x: 15.5 + direction * 0.8, y: 25 },
    { x: 15.5 + direction * 1.65, y: 25 + wing * 1.35 },
    { x: 15.5 + direction * 2.25, y: 25 + wing * 1.15 },
    { x: 15.5 + direction * 2.5, y: 25 - wing * 0.85 },
    { x: 15.5 + direction * 2.8, y: 25 - wing * 0.7 },
    { x: 15.5 + direction * 3.15, y: 25 + wing * 0.2 },
    { x: 15.5 + direction * 3.25, y: 25 + wing * 0.15 },
    {
      x: 15.5 + direction * (goal ? 4.7 : save ? 4.35 : 4.8),
      y: 25 + wing * (save ? 0.35 : goal ? 0.45 : 1.35),
    },
  ];
  return { seed, team, direction, wing, goal, save, start, targets };
}
const moments = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
export function footballAt(minutes: number, day = 0): FootballState {
  const time = ((minutes % 1440) + 1440) % 1440;
  const live = time >= 360 && time < 1200;
  const match = live ? Math.floor((time - 360) / 140) : 0;
  const elapsed = live ? (time - 360) % 140 : 0;
  const phase = !live
    ? 'closed'
    : elapsed < 60
      ? 'first'
      : elapsed < 68
        ? 'halftime'
        : elapsed < 128
          ? 'second'
          : 'fulltime';
  const half = elapsed < 68 ? 1 : 2;
  const playing = phase === 'first' || phase === 'second';
  const gameTime = Math.min(60, elapsed) + Math.max(0, Math.min(60, elapsed - 68));
  const seconds = Math.floor(gameTime * 5);
  const attacks = Array.from({ length: 10 }, (_, i) => attack(day, match, i));
  const score: [number, number] = [0, 0],
    shots: [number, number] = [0, 0],
    saves: [number, number] = [0, 0];
  const sounds: FootballSound[] = [0, 60, 68, 128].map((at) => ({
    at,
    kind: 'whistle',
    strength: 0.5,
  }));
  for (const a of attacks) {
    for (const at of [2, 4, 6, 8])
      sounds.push({ at: a.start + at, kind: 'kick', strength: at === 8 ? 1 : 0.65 });
    if (a.goal) sounds.push({ at: a.start + 9, kind: 'cheer', strength: 0.75 });
    if (live && elapsed >= a.start + 8) shots[a.team]++;
    if (live && elapsed >= a.start + 9) {
      if (a.goal) score[a.team]++;
      if (a.save) saves[1 - a.team]++;
    }
  }
  const index =
    half === 1
      ? Math.min(4, Math.floor(elapsed / 12))
      : 5 + Math.min(4, Math.floor((elapsed - 68) / 12));
  const a = attacks[index];
  const t = playing ? elapsed - a.start : 12;
  const points = [...a.targets, a.targets[8], CENTER];
  const segment = Math.max(0, moments.findIndex((end, i) => i > 0 && t < end) - 1);
  const slot = t >= 12 ? 9 : segment;
  const fraction = (t - moments[slot]) / (moments[slot + 1] - moments[slot]);
  const ball = mix(points[slot], points[slot + 1], fraction);
  const flight = [1, 3, 5, 7].includes(slot);
  const goal = playing && a.goal && t >= 9 && t < 10.8;
  function formation(at: number, frame: number): Point {
    const base = bases[at];
    if (frame === 0 || frame === 10) return base;
    const own = Math.floor(at / 4) === a.team;
    const number = at % 4;
    if (number === 0)
      return { x: base.x, y: 25 + (frame >= 8 && !own ? a.wing * 0.35 : a.wing * 0.1) };
    const carrier = frame <= 1 ? 3 : frame <= 3 ? 1 : frame <= 5 ? 2 : 3;
    if (own && number === carrier) return { ...points[Math.min(frame, 7)] };
    return {
      x: base.x + a.direction * (own ? 1.05 : 0.7) * Math.min(frame / 3, 1),
      y: base.y + Math.sin(frame * 0.6 + at) * 0.22,
    };
  }
  const players: FootballPlayer[] = bases.map((base, i) => ({
    ...(!playing ? base : mix(formation(i, slot), formation(i, slot + 1), fraction)),
    team: Math.floor(i / 4) as 0 | 1,
    number: i % 4 === 0 ? 1 : (i % 4) + 6,
    moving: playing,
    kick:
      playing &&
      Math.floor(i / 4) === a.team &&
      [2, 4, 6, 8].some((at) => t >= at && t < at + 0.28) &&
      i % 4 === (t < 3 ? 3 : t < 5 ? 1 : t < 7 ? 2 : 3),
    celebrate: goal && Math.floor(i / 4) === a.team,
    dive:
      playing && a.save && i % 4 === 0 && Math.floor(i / 4) !== a.team && t >= 8 && t < 10
        ? Math.sin(((t - 8) / 2) * Math.PI) * a.wing
        : 0,
  }));
  const caption =
    phase === 'closed'
      ? 'Back at sunrise · games from 06:00 to 20:00'
      : phase === 'halftime'
        ? 'Half-time · a sip of water, then back out.'
        : phase === 'fulltime'
          ? score[0] === score[1]
            ? 'Honours even. Another game in a moment!'
            : `${TEAMS[score[0] > score[1] ? 0 : 1].name} take this one!`
          : t >= 10
            ? 'Back to the centre. Here we go again.'
            : t >= 9
              ? a.goal
                ? `GOAL! ${TEAMS[a.team].name}!`
                : a.save
                  ? 'What a save! Safe hands from the keeper.'
                  : 'Just wide! The crowd holds its breath.'
              : t >= 8
                ? 'A shot on goal…'
                : t >= 6
                  ? 'A lovely ball into the middle.'
                  : t >= 4
                    ? 'One touch. Across the pitch.'
                    : t >= 2
                      ? 'Out to the wing. A little room to run.'
                      : `${TEAMS[a.team].name} build from the centre.`;
  return {
    live,
    day,
    match,
    elapsed,
    half,
    phase,
    clock: `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
    remaining: Math.ceil((phase === 'halftime' ? 68 : 140) - elapsed),
    score,
    shots,
    saves,
    caption,
    players: live ? players : [],
    ball: {
      ...(playing ? ball : CENTER),
      height: playing && flight ? Math.sin(fraction * Math.PI) * (slot === 5 ? 12 : 4) : 0,
    },
    goal,
    sounds: sounds.sort((a, b) => a.at - b.at),
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
