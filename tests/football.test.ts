import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  footballAt,
  footballRecord,
  FOOTBALL_PLOTS,
  FOOTBALL_ENTRANCE,
  GROUND,
  PITCH,
  GOAL_MOUTH,
  CROSSBAR,
  BALL_TURN,
  STRIDE_CYCLE,
  insideFootball,
  footballListening,
  type FootballState,
} from '../src/lib/football';
import { drawFootball } from '../src/city/football';
import { recordingContext } from './recording-context';
import {
  simulateMatch,
  LINEUP,
  REF_SPOT,
  CENTRE_SPOT,
  FIELDS,
  FRAMES,
  HZ,
  PF,
  REF_AT,
  BALL_AT,
  META_AT,
  ACTIONS,
  LAST_MATCH,
} from '../src/lib/football-engine';
import { isRoad, STREETLIGHTS, project, plotEntrance, getPlot } from '../src/lib/world';
import { HOUSE_PLOTS } from '../src/lib/events';
import { placeSchema } from '../src/lib/schema';
import { roadPath, simulateResidents } from '../src/lib/simulation';
import { cityHit } from '../src/city/render';
import { footballSoundsBetween, renderFootballSound } from '../src/music/football-sound';
import { townDayAt, townMinutesAt, TOWN_DAY_MS, UTC_DAY_MS } from '../src/lib/town-time';

const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
const gameAtUtc = (timestamp: number) => footballAt(townMinutesAt(timestamp), townDayAt(timestamp));
const townDaysPerUtcDay = UTC_DAY_MS / TOWN_DAY_MS;
/** A match by UTC day number, match index and seconds into its 140-second cycle. */
const game = (utcDay: number, match: number, elapsed: number) =>
  footballAt(360 + match * 140 + elapsed, utcDay * townDaysPerUtcDay);
const fixtures = (days: number, from = 20500) =>
  Array.from({ length: days * 6 }, (_, i) => [from + Math.floor(i / 6), i % 6] as const);

describe('Football shared by UTC date and time', () => {
  const midnight = Date.parse('2026-09-22T00:00:00Z');

  it('gives viewers in different timezones the same complete match state', () => {
    const utc = Date.parse('2026-09-22T00:07:34.250Z');
    const game = gameAtUtc(utc);
    expect(game.live).toBe(true);
    expect(game.elapsed).toBe(94.25);
    expect(gameAtUtc(Date.parse('2026-09-22T03:07:34.250+03:00'))).toEqual(game);
    expect(gameAtUtc(Date.parse('2026-09-21T17:07:34.250-07:00'))).toEqual(game);
  });

  it('replays the complete daily lineup in all sixty town cycles', () => {
    for (let match = 0; match < 6; match++) {
      for (const elapsed of [0, 2.25, 8.5, 9.5, 60, 68, 94.25, 128, 139.99]) {
        const timestamp = midnight + (360 + match * 140 + elapsed) * 1000;
        const first = gameAtUtc(timestamp);
        for (let cycle = 1; cycle < townDaysPerUtcDay; cycle++) {
          const replay = gameAtUtc(timestamp + cycle * TOWN_DAY_MS);
          expect(replay.day).toBe(first.day + cycle);
          expect({ ...replay, day: first.day }).toEqual(first);
        }
      }
    }
  });

  it('refreshes the lineup at UTC midnight and varies fixtures within a date', () => {
    const lineup = (date: number) =>
      Array.from({ length: 6 }, (_, match) => {
        const { score, saves, sounds } = gameAtUtc(date + (360 + match * 140 + 128) * 1000);
        return { score, saves, sounds };
      });
    const today = lineup(midnight);
    expect(new Set(today.map((match) => JSON.stringify(match))).size).toBeGreaterThan(1);
    expect(lineup(midnight + UTC_DAY_MS)).not.toEqual(today);
    const before = gameAtUtc(midnight + UTC_DAY_MS - 1);
    const after = gameAtUtc(midnight + UTC_DAY_MS);
    expect(before.live).toBe(false);
    expect(after.live).toBe(false);
    expect(after.day).toBe(before.day + 1);
    expect(after.score).toEqual([0, 0]);
  });

  it('can join, reload, or resume directly at any frame without replaying earlier frames', () => {
    const timestamp = midnight + 454_250;
    const expected = gameAtUtc(timestamp);
    for (const offset of [123_000, -60_000, UTC_DAY_MS, -UTC_DAY_MS, 0]) {
      gameAtUtc(timestamp + offset);
      expect(gameAtUtc(timestamp)).toEqual(expected);
    }
    const previousCycle = gameAtUtc(timestamp - TOWN_DAY_MS - 10);
    expect(footballSoundsBetween(previousCycle, expected)).toEqual([]);
  });

  it('simulates the same match whatever was computed before it', () => {
    const a3 = simulateMatch(20533, 3),
      a1 = simulateMatch(20533, 1);
    const b1 = simulateMatch(20533, 1),
      b3 = simulateMatch(20533, 3);
    expect(b1.frames).toEqual(a1.frames);
    expect(b3.frames).toEqual(a3.frames);
    expect(b3.events).toEqual(a3.events);
    expect(b3.sounds).toEqual(a3.sounds);
    // Callers get fresh objects: mutating one state never reaches the next.
    const first = game(20533, 3, 50);
    first.players[0].x = -1;
    first.sounds.length = 0;
    first.events.forEach((e) => (e.text = ''));
    first.score[0] = 99;
    expect(game(20533, 3, 50)).not.toEqual(first);
    expect(game(20533, 3, 50).players[0].x).toBe(footballRecord(20533, 3).frames[1000 * FIELDS]);
  }, 20_000);
});

describe('The Meadow Ground', () => {
  it('reserves all six plots and removes only their internal roads and lamps', () => {
    expect(FOOTBALL_PLOTS).toEqual(['F3', 'F4', 'F5', 'G3', 'G4', 'G5']);
    for (const plot of FOOTBALL_PLOTS) {
      expect(HOUSE_PLOTS.some((p) => p.id === plot)).toBe(false);
      expect(placeSchema.safeParse({ ...sample, plot }).success).toBe(false);
    }
    for (let x = GROUND.left; x < GROUND.right; x++)
      for (let y = GROUND.top; y < GROUND.bottom; y++) expect(isRoad(x, y)).toBe(false);
    for (let x = 9; x <= 21; x++) {
      expect(isRoad(x, 21)).toBe(true);
      expect(isRoad(x, 29)).toBe(true);
    }
    expect(STREETLIGHTS.some(insideFootball)).toBe(false);
    expect(roadPath(plotEntrance(getPlot('J10')!), FOOTBALL_ENTRANCE).at(-1)).toEqual(
      FOOTBALL_ENTRANCE,
    );
  });
  it('selects the pitch, former internal roads, and the raised scoreboard as one venue', () => {
    for (const p of [
      { x: 13.5, y: 25.5 },
      { x: 20, y: 28 },
      { x: 10.5, y: 22.5 },
    ])
      expect(cityHit(project(p.x, p.y), [], [])).toEqual({ kind: 'place', id: 'F4' });
    const board = project(15.5, 22.2);
    expect(cityHit({ x: board.x, y: board.y - 60 }, [], [])).toEqual({ kind: 'place', id: 'F4' });
    // Tall furniture standing over the road behind: dugout roofs, a mast's lamps, the board's legs.
    const leg = project(14.05, 22.12);
    for (const p of [
      { ...project(12.2, 22.3), h: 18 },
      { ...project(18.7, 22.3), h: 18 },
      { ...project(20.8, 22.2), h: 82 },
      { ...project(10.2, 22.2), h: 82 },
      { x: leg.x + 19, y: leg.y + 9.5, h: 12 },
    ])
      expect(cityHit({ x: p.x, y: p.y - p.h }, [], [])).toEqual({ kind: 'place', id: 'F4' });
  });
  it('runs six repeatable daylight matches with a half-time and a final result', () => {
    expect(footballAt(359.99).live).toBe(false);
    expect(footballAt(1200).live).toBe(false);
    expect(footballAt(359.99).players).toEqual([]);
    expect(footballAt(359.99).caption).toBe('Back at sunrise · games from 06:00 to 20:00');
    for (let match = 0; match < 6; match++) {
      const start = 360 + match * 140;
      expect(footballAt(start).score).toEqual([0, 0]);
      expect(footballAt(start).players).toHaveLength(10);
      expect(footballAt(start + 60).phase).toBe('halftime');
      expect(footballAt(start + 68).phase).toBe('second');
      expect(footballAt(start + 128).phase).toBe('fulltime');
      expect(footballAt(start + 139).clock).toBe('10:00');
      expect(footballAt(start + 139).score).toEqual(footballAt(start + 128).score);
      expect(footballAt(start + 30).direction).toEqual([1, -1]);
      expect(footballAt(start + 90).direction).toEqual([-1, 1]);
      // Only the day's last game signs off until sunrise.
      const farewell = footballAt(start + 135).caption;
      expect(/last game of the day|Back at sunrise/.test(farewell)).toBe(match === LAST_MATCH);
    }
    expect(footballAt(544.32, 42)).toEqual(footballAt(544.32, 42));
    expect(footballAt(544.32, 42)).toEqual(footballAt(544.32 + 1440, 42));
  });
  it('lines everyone up exactly at kick-off, at the second-half kick-off, and for the next match', () => {
    const mirror = (id: number) => LINEUP[(id + 5) % 10];
    // Six days: the half-time fetch (a helper knocking the ball back, the referee bowling it
    // or setting it down) must always leave time for the exact picture.
    for (const [day, match] of fixtures(6)) {
      for (const [elapsed, spot] of [
        [0, (id: number) => LINEUP[id]],
        [68, mirror],
      ] as const) {
        const g = game(day, match, elapsed);
        expect(g.players).toHaveLength(10);
        g.players.forEach((p) => expect({ x: p.x, y: p.y }).toEqual(spot(p.id)));
        expect({ x: g.ball.x, y: g.ball.y, h: g.ball.height }).toEqual({ ...CENTRE_SPOT, h: 0 });
        expect({ x: g.referee!.x, y: g.referee!.y }).toEqual(REF_SPOT);
      }
      // The recorded end of the cycle is the next match's first frame.
      const f = footballRecord(day, match).frames,
        end = FRAMES * FIELDS;
      if (match === LAST_MATCH) {
        // After the day's last game nobody lines up: each side stands by its own dugout
        // (Meadow's on the left, Sunset's on the right) and the referee keeps the ball.
        for (let id = 0; id < 10; id++) {
          const x = f[end + id * PF],
            y = f[end + id * PF + 1];
          expect(y).toBeLessThan(23.3);
          expect(id < 5 ? x < 13.3 : x > 17.7).toBe(true);
        }
        expect(f[end + BALL_AT + 6]).toBe(-1);
        continue;
      }
      for (let id = 0; id < 10; id++) {
        expect(f[end + id * PF]).toBe(LINEUP[id].x);
        expect(f[end + id * PF + 1]).toBe(LINEUP[id].y);
      }
      expect([f[end + REF_AT], f[end + REF_AT + 1]]).toEqual([REF_SPOT.x, REF_SPOT.y]);
      expect([f[end + BALL_AT], f[end + BALL_AT + 1], f[end + BALL_AT + 2]]).toEqual([
        CENTRE_SPOT.x,
        CENTRE_SPOT.y,
        0,
      ]);
    }
  });
  it('moves everyone and the ball continuously, inside the ground, at human speeds', () => {
    // Two whole matches in 0.01 s steps, through restarts, goals, half-time and the next kick-off.
    const step = 0.01;
    const worst = { outfield: 0, keeper: 0, referee: 0, ball: 0, height: 0, outside: 0 };
    for (const day of [20501, 20502]) {
      let previous: FootballState | null = null;
      for (let i = 0; i < 28000; i++) {
        const now = game(day, 0, i * step);
        if (previous) {
          now.players.forEach((p, j) => {
            const move = Math.hypot(p.x - previous!.players[j].x, p.y - previous!.players[j].y);
            const key = p.role === 'keeper' ? 'keeper' : 'outfield';
            worst[key] = Math.max(worst[key], move / step);
          });
          const r = now.referee!,
            r0 = previous.referee!;
          worst.referee = Math.max(worst.referee, Math.hypot(r.x - r0.x, r.y - r0.y) / step);
          const b = now.ball,
            b0 = previous.ball;
          worst.ball = Math.max(worst.ball, Math.hypot(b.x - b0.x, b.y - b0.y) / step);
          worst.height = Math.max(worst.height, Math.abs(b.height - b0.height) / step);
        }
        for (const p of [...now.players, now.referee!, now.ball])
          if (!insideFootball(p) || p.y > 27.9) worst.outside++;
        previous = now;
      }
    }
    expect(worst.outfield).toBeLessThan(2.01);
    expect(worst.keeper).toBeLessThan(3.51);
    expect(worst.referee).toBeLessThan(2.01);
    expect(worst.ball).toBeLessThan(8.01);
    expect(worst.height).toBeLessThan(400);
    expect(worst.outside).toBe(0);
  }, 30_000);
  it('keeps every recorded match within the speed caps and the ground', () => {
    const worst = { outfield: 0, keeper: 0, referee: 0, ball: 0 };
    const speed = (f: Float32Array, a: number, b: number, o: number) =>
      Math.hypot(f[b + o] - f[a + o], f[b + o + 1] - f[a + o + 1]) * HZ;
    for (const [day, match] of fixtures(4, 20600)) {
      const f = footballRecord(day, match).frames;
      for (let k = 1; k <= FRAMES; k++) {
        const a = (k - 1) * FIELDS,
          b = k * FIELDS;
        for (let id = 0; id < 10; id++) {
          const key = id % 5 === 0 ? 'keeper' : 'outfield';
          worst[key] = Math.max(worst[key], speed(f, a, b, id * PF));
        }
        worst.referee = Math.max(worst.referee, speed(f, a, b, REF_AT));
        worst.ball = Math.max(worst.ball, speed(f, a, b, BALL_AT));
      }
    }
    expect(worst.outfield).toBeLessThan(2.01);
    expect(worst.outfield).toBeGreaterThan(1.9);
    expect(worst.keeper).toBeLessThan(3.51);
    expect(worst.keeper).toBeGreaterThan(2.1);
    expect(worst.referee).toBeLessThan(2.01);
    expect(worst.ball).toBeLessThan(8.01);
    expect(worst.ball).toBeGreaterThan(6);
  });
  it('stops the ball at the boards and rail, keeps people in front of them, and never stalls a restart', () => {
    const outside = (v: number, lo: number, hi: number) => v < lo - 1e-4 || v > hi + 1e-4;
    let strays = 0,
      longest = 0,
      longestKickoff = 0;
    for (const [day, match] of fixtures(4, 20650)) {
      const f = footballRecord(day, match).frames;
      let kind = 0,
        since = 0;
      for (let k = 0; k <= FRAMES; k++) {
        const o = k * FIELDS;
        // A loose ball stops at the boards on the far side and the west end, and at the crowd
        // rail on the near side (a keeper may carry it out of the back of the net).
        if (
          f[o + BALL_AT + 6] === -2 &&
          (outside(f[o + BALL_AT], 10.4, 20.85) || outside(f[o + BALL_AT + 1], 22.6, 27.55))
        )
          strays++;
        for (let p = 0; p <= 10; p++) {
          const at = o + (p < 10 ? p * PF : REF_AT);
          if (outside(f[at], 10.42, 20.84) || outside(f[at + 1], 22.62, 27.5)) strays++;
        }
        const code = f[o + META_AT + 6];
        if (code !== kind) {
          kind = code;
          since = k;
        }
        // Throw-ins, goal kicks and corners are taken within seconds; so is a kick-off.
        if (kind > 1) longest = Math.max(longest, (k - since) / HZ);
        if (kind === 1) longestKickoff = Math.max(longestKickoff, (k - since) / HZ);
      }
    }
    expect(strays).toBe(0);
    expect(longest).toBeLessThan(7);
    expect(longestKickoff).toBeLessThan(9);
  });
  it('celebrates with the scorer’s own supporters and shows the keeper in every save', () => {
    const fans = [
      { x: 11.6, y: 27.4 },
      { x: 18, y: 27.4 },
    ];
    let goals = 0,
      reached = 0,
      saves = 0,
      dives = 0,
      down = 0;
    for (const [day, match] of fixtures(4, 20750)) {
      const record = footballRecord(day, match);
      const f = record.frames;
      for (const g of record.goals) {
        // Whatever the half, the run goes to that team's corner of the crowd.
        if (!(g.at < 54 || (g.at > 68 && g.at < 122))) continue;
        goals++;
        let closest = 99;
        for (let k = Math.round(g.at * HZ); k < Math.round((g.at + 6) * HZ); k++) {
          const o = k * FIELDS + g.player * PF;
          closest = Math.min(closest, Math.hypot(f[o] - fans[g.team].x, f[o + 1] - fans[g.team].y));
        }
        expect(closest).toBeLessThan(3);
        if (closest < 1.3) reached++;
      }
      // A save is always a dive or a catch, never the ball bouncing off a standing keeper.
      record.events.forEach((e, i) => {
        if (e.kind !== 'save') return;
        saves++;
        const k = Math.round(e.at * HZ);
        const o = e.player! * PF;
        const acts = new Set<string>();
        for (let j = k - 8; j <= k + 6; j++) acts.add(ACTIONS[f[j * FIELDS + o + 6]]);
        expect(acts.has('dive') || acts.has('catch')).toBe(true);
        // A diving save is a dive at this shot: one begun before it (the keeper still down from
        // the last) stops only a ball struck into the body, and is told as one.
        if (ACTIONS[f[k * FIELDS + o + 6]] !== 'dive') return;
        let shot = i;
        while (record.events[shot].kind !== 'shot') shot--;
        let start = k;
        while (
          ACTIONS[f[(start - 1) * FIELDS + o + 6]] === 'dive' &&
          f[(start - 1) * FIELDS + o + 7] <= f[start * FIELDS + o + 7]
        )
          start--;
        if (start > Math.round(record.events[shot].at * HZ)) dives++;
        else {
          down++;
          const off = f[k * FIELDS + BALL_AT + 1] - f[k * FIELDS + o + 1];
          expect(Math.abs(off)).toBeLessThan(0.301);
          expect(e.text).toMatch(/with the body|beats it away|in the way of it/);
        }
      });
    }
    expect(goals).toBeGreaterThan(20);
    expect(reached / goals).toBeGreaterThan(0.85);
    expect(saves).toBeGreaterThan(10);
    expect(dives).toBeGreaterThan(saves / 3);
    expect(down).toBeLessThan(saves / 20);
  });
  it('scores only when the ball crosses the line between the posts, under the bar', () => {
    let goals = 0;
    for (const [day, match] of fixtures(3)) {
      const record = footballRecord(day, match);
      const f = record.frames;
      for (const e of record.events.filter((e) => e.kind === 'goal')) {
        goals++;
        // The recorded tick of the goal and the one before it.
        const k = Math.round(e.at * HZ);
        expect(k / HZ).toBe(e.at);
        const [x0, y0, h0] = [0, 1, 2].map((i) => f[(k - 1) * FIELDS + BALL_AT + i]);
        const [x1, y1, h1] = [0, 1, 2].map((i) => f[k * FIELDS + BALL_AT + i]);
        const line = x1 < 15.5 ? PITCH.left : PITCH.right;
        const side = line === PITCH.left ? -1 : 1;
        expect((x0 - line) * side).toBeLessThanOrEqual(1e-5);
        expect((x1 - line) * side).toBeGreaterThan(0);
        const t = (x0 - line) / (x0 - x1);
        const y = y0 + (y1 - y0) * t,
          h = h0 + (h1 - h0) * t;
        expect(y).toBeGreaterThan(GOAL_MOUTH.top);
        expect(y).toBeLessThan(GOAL_MOUTH.bottom);
        expect(h).toBeLessThan(CROSSBAR);
        // The score changes in exactly that tick, for the team attacking that goal.
        const before = game(day, match, e.at - 0.02),
          after = game(day, match, e.at + 1e-6);
        const team = e.team!;
        expect(after.score[team]).toBe(before.score[team] + 1);
        expect(after.direction[team]).toBe(side);
        expect(after.goal).toBe(true);
        expect(after.celebration?.team).toBe(team);
        expect(after.sounds.some((s) => s.kind === 'cheer' && s.at === e.at)).toBe(true);
      }
      for (const t of [30, 59.99, 100, 139.99]) {
        const g = game(day, match, t);
        expect(g.score[0] + g.score[1]).toBe(g.events.filter((e) => e.kind === 'goal').length);
      }
    }
    expect(goals).toBeGreaterThan(0);
  });
  it('calls every ball over a line, and nothing rolls into a net after the whistle', () => {
    let loose = 0,
      over = 0,
      rolledIn = 0;
    for (const [day, match] of fixtures(4, 21000)) {
      const f = footballRecord(day, match).frames;
      for (let k = 1; k <= FRAMES; k++) {
        const o = k * FIELDS + BALL_AT,
          q = o - FIELDS,
          t = k / HZ;
        const [x, y, h] = [f[o], f[o + 1], f[o + 2]];
        // In open play (no restart, a side attacking) a loose ball is never past a line.
        const open =
          f[k * FIELDS + META_AT + 6] === 0 &&
          f[k * FIELDS + META_AT + 5] >= 0 &&
          (t < 60 || (t > 68.1 && t < 128));
        if (open && f[o + 6] === -2) {
          loose++;
          const past = Math.max(PITCH.top - y, y - PITCH.bottom, PITCH.left - x, x - PITCH.right);
          if (past > 0.06) over++;
        }
        // Once the half or the match is over, a ball played just before the whistle is
        // stopped by whoever it reaches (the keeper steps across) or dies wide of the posts.
        if ((t > 60 && t <= 68) || t > 128)
          for (const line of [PITCH.left, PITCH.right]) {
            const side = line === PITCH.left ? -1 : 1;
            if ((f[q] - line) * side > 0 || (x - line) * side <= 0) continue;
            const u = (f[q] - line) / (f[q] - x);
            const yc = f[q + 1] + (y - f[q + 1]) * u,
              hc = f[q + 2] + (h - f[q + 2]) * u;
            if (yc > GOAL_MOUTH.top && yc < GOAL_MOUTH.bottom && hc < CROSSBAR) rolledIn++;
          }
      }
    }
    expect(loose).toBeGreaterThan(10_000);
    expect(over).toBe(0);
    expect(rolledIn).toBe(0);
  });
  it('winds up each throw once and never turns right round between two frames', () => {
    let throws = 0,
      rewound = 0,
      flips = 0;
    for (const [day, match] of fixtures(3, 21100)) {
      const f = footballRecord(day, match).frames;
      for (let k = 1; k <= FRAMES; k++) {
        const a = (k - 1) * FIELDS,
          b = k * FIELDS;
        for (let id = 0; id <= 10; id++) {
          const o = id < 10 ? id * PF : REF_AT;
          // Facing is interpolated between frames, so it must never pass through zero.
          if (f[a + o + 2] * f[b + o + 2] + f[a + o + 3] * f[b + o + 3] <= 0) flips++;
          if (id === 10 || ACTIONS[f[b + o + 6]] !== 'throw') continue;
          if (ACTIONS[f[a + o + 6]] !== 'throw') throws++;
          else if (f[b + o + 7] < f[a + o + 7]) rewound++;
        }
      }
    }
    expect(throws).toBeGreaterThan(20);
    expect(rewound).toBe(0);
    expect(flips).toBe(0);
  });
  it('starts and ends every match on the same ball panel and stride phase', () => {
    const phase = (v: number, period: number) => (((v / period) % 1) + 1) % 1;
    for (const [day, match] of fixtures(2, 21200)) {
      const f = footballRecord(day, match).frames,
        end = FRAMES * FIELDS;
      const fields: [number, number][] = [
        [BALL_AT + 5, BALL_TURN],
        [REF_AT + 5, STRIDE_CYCLE],
        ...LINEUP.map((_, id): [number, number] => [id * PF + 5, STRIDE_CYCLE]),
      ];
      for (const [i, period] of fields) {
        expect(f[end + i]).toBeGreaterThan(f[i]);
        expect(Math.abs(phase(f[end + i], period) - phase(f[i], period))).toBeLessThan(1e-3);
      }
    }
    // As the town sees it: the ball on the centre spot does not turn at the next kick-off.
    const last = game(21200, 2, 139.999).ball.spin,
      next = game(21200, 3, 0).ball.spin;
    expect(phase(last, BALL_TURN)).toBeCloseTo(phase(next, BALL_TURN), 2);
  });
  it('names an own goal as one on the scoreboard', () => {
    const g = game(21129, 0, 30);
    const own = {
      at: 29,
      minute: 5,
      kind: 'goal' as const,
      team: 1 as const,
      player: null,
      text: 'Own goal!',
    };
    const state: FootballState = {
      ...g,
      events: [...g.events.filter((e) => e.at < 29), own],
      goal: true,
      celebration: { team: 1, player: 9, since: 29 },
    };
    const { ctx, calls } = recordingContext();
    drawFootball(ctx, state, false, false)
      .sort((a, b) => a.depth - b.depth)
      .forEach((layer) => layer.paint());
    const texts = calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));
    expect(texts).toContain("OWN GOAL · 5'");
    expect(texts.some((text) => text.startsWith('GOAL ·'))).toBe(false);
  });
  it('keeps the statistics consistent at every moment', () => {
    for (const [day, match] of fixtures(2, 20700)) {
      for (let t = 0; t < 140; t += 7.3) {
        const g = game(day, match, t);
        for (const team of [0, 1] as const) {
          const other = (1 - team) as 0 | 1;
          expect(g.score[team]).toBeLessThanOrEqual(g.onTarget[team]);
          expect(g.onTarget[team]).toBeLessThanOrEqual(g.shots[team]);
          expect(g.saves[other] + g.score[team]).toBeLessThanOrEqual(g.onTarget[team]);
        }
        expect(g.possession[0] + g.possession[1]).toBe(100);
        expect(g.possession.every((p) => p >= 0 && p <= 100)).toBe(true);
        expect(g.events.every((e) => e.at <= g.elapsed)).toBe(true);
        expect(g.events.every((e, i) => i === 0 || g.events[i - 1].at <= e.at)).toBe(true);
        expect(g.players.filter((p) => p.hasBall).length).toBeLessThanOrEqual(1);
        const minute = Math.min(10, Math.floor(Math.floor(g.elapsed * 5) / 60) + 1);
        if (g.elapsed < 60) expect(g.events.every((e) => e.minute <= minute)).toBe(true);
      }
      expect(game(day, match, 0).possession).toEqual([50, 50]);
    }
  });
  it('tells the match in varied commentary with the players’ names', () => {
    const names = ['Rowan', 'Ember', 'Moss', 'Dusk', 'Hazel', 'Saffron'];
    const all: string[] = [];
    for (const [day, match] of fixtures(2)) {
      const { events } = footballRecord(day, match);
      expect(events.length).toBeGreaterThan(25);
      expect(events.length).toBeLessThan(110);
      events.forEach((e, i) => i && expect(e.text).not.toBe(events[i - 1].text));
      expect(events.filter((e) => e.kind === 'half-time')).toHaveLength(1);
      expect(events.filter((e) => e.kind === 'full-time')).toHaveLength(1);
      expect(events.filter((e) => e.kind === 'kickoff').length).toBeGreaterThanOrEqual(2);
      all.push(...events.map((e) => e.text));
    }
    expect(names.every((name) => all.some((text) => text.includes(name)))).toBe(true);
    expect(new Set(all).size).toBeGreaterThan(80);
  });
  it('brings strolling residents along perimeter roads, keeps them off the pitch, and gets them home', () => {
    const homes = HOUSE_PLOTS.slice(0, 16).map((p, i) => ({
      ...sample,
      id: `fan-${i}`,
      plot: p.id,
      resident: {
        ...sample.resident,
        routine: {
          morning: 'stroll' as const,
          afternoon: 'stroll' as const,
          evening: 'home' as const,
          night: 'sleep' as const,
        },
      },
    }));
    const fans = simulateResidents(homes, 500, 3).filter((r) => r.event?.id === 'football');
    expect(fans).toHaveLength(6);
    expect(new Set(fans.map((r) => `${r.position.x},${r.position.y}`)).size).toBe(6);
    expect(simulateResidents([...homes].reverse(), 500, 3).reverse()).toEqual(
      simulateResidents(homes, 500, 3),
    );
    for (let minute = 360; minute <= 720; minute += 1.75)
      for (const state of simulateResidents(homes, minute, 3))
        if (state.event?.id === 'football') {
          expect(
            isRoad(Math.floor(state.position.x), Math.floor(state.position.y)) ||
              (insideFootball(state.position) && state.position.y > PITCH.bottom),
          ).toBe(true);
        }
    for (const boundary of [360, 430, 645, 710, 720, 1080]) {
      const before = simulateResidents(homes, boundary - 0.001, 3),
        after = simulateResidents(homes, boundary, 3);
      after.forEach((r, i) =>
        expect(
          Math.hypot(r.position.x - before[i].position.x, r.position.y - before[i].position.y),
        ).toBeLessThan(0.02),
      );
    }
    expect(simulateResidents(homes, 1200, 3).every((r) => !r.event && r.activity === 'home')).toBe(
      true,
    );
  });
  it('plays like football across many matches', () => {
    const goals: number[] = [];
    const byTeam = [0, 0];
    let shots = 0,
      onTarget = 0,
      saves = 0,
      corners = 0,
      passes = 0,
      turnovers = 0,
      inPlay = 0,
      moves = 0,
      // Sides that had two or more shots in a match, and those that scored with every one.
      shooting = 0,
      perfect = 0,
      // Kick-offs, those followed by a shot within five seconds, and goals scored that soon.
      kickoffs = 0,
      sharp = 0,
      quick = 0;
    const list = fixtures(12, 20800);
    for (const [day, match] of list) {
      const record = footballRecord(day, match);
      const f = record.frames;
      goals.push(record.goals.length);
      const starts = record.events.filter((e) => e.kind === 'kickoff');
      kickoffs += starts.length;
      for (const k of starts)
        if (record.events.some((e) => e.kind === 'shot' && e.at > k.at && e.at < k.at + 5)) sharp++;
      for (const g of record.goals) {
        const k = starts.filter((e) => e.at <= g.at).at(-1);
        if (k && g.at - k.at < 5) quick++;
      }
      const scored = [0, 0];
      for (const g of record.goals) {
        byTeam[g.team]++;
        scored[g.team]++;
        // Count the completed passes in the scoring side's spell of possession.
        let changes = 0,
          last = -1;
        for (let k = Math.round(g.at * HZ) - 1; k > 0; k--) {
          const owner = f[k * FIELDS + BALL_AT + 6];
          if (owner < 0) continue;
          if ((owner < 5 ? 0 : 1) !== g.team) break;
          if (last >= 0 && owner !== last) changes++;
          last = owner;
        }
        if (changes >= 2) moves++;
      }
      const tried = [0, 0];
      for (const m of record.marks) {
        if (m.kind === 'shot') tried[m.team]++;
        else if (m.kind === 'onTarget') onTarget++;
        else if (m.kind === 'save') saves++;
        else corners++;
      }
      shots += tried[0] + tried[1];
      for (const team of [0, 1])
        if (tried[team] >= 2) {
          shooting++;
          if (scored[team] === tried[team]) perfect++;
        }
      passes += record.stats.completed[0] + record.stats.completed[1];
      turnovers += Math.min(...record.stats.turnovers);
      inPlay += record.stats.inPlay;
    }
    const n = list.length;
    const total = goals.reduce((a, b) => a + b, 0);
    const mean = total / n;
    expect(mean).toBeGreaterThan(2.3);
    expect(mean).toBeLessThan(3.3);
    expect(Math.max(...goals)).toBeLessThanOrEqual(8);
    expect(goals.filter((g) => g === 0).length / n).toBeLessThan(0.1);
    expect(Math.min(...byTeam)).toBeGreaterThan(n * 0.8);
    expect(new Set(goals).size).toBeGreaterThan(3);
    // Plenty of shots, most of them saved, blocked or missed: the near misses are the drama.
    expect(shots / n).toBeGreaterThan(10.5);
    expect(shots / n).toBeLessThan(15.5);
    expect(total / shots).toBeGreaterThan(0.17);
    expect(total / shots).toBeLessThan(0.28);
    expect(onTarget / shots).toBeGreaterThan(0.45);
    expect(onTarget / shots).toBeLessThan(0.65);
    expect(saves / n).toBeGreaterThan(2.8);
    expect(saves / n).toBeLessThan(5.5);
    expect(corners / n).toBeGreaterThan(1.2);
    expect(corners / n).toBeLessThan(3.2);
    // A kick-off is no set move: few lead straight to a shot, and hardly a goal comes that soon.
    expect(kickoffs).toBeGreaterThan(n * 3);
    expect(sharp / kickoffs).toBeLessThan(0.15);
    expect(quick / total).toBeLessThan(0.08);
    // Hardly a side scores with every shot it takes.
    expect(shooting).toBeGreaterThan(n * 1.8);
    expect(perfect / shooting).toBeLessThan(0.1);
    // Still a passing game: many goals come from moves of 2+ passes.
    expect(passes / n / 2).toBeGreaterThan(18);
    expect(moves / total).toBeGreaterThan(0.25);
    expect(turnovers / n).toBeGreaterThan(2);
    expect(inPlay / n).toBeGreaterThan(60);
  });
  it('never lets a ball in play cross a goal mouth without a goal', () => {
    // A carrier backed onto a line keeps the ball on it: across open play the ball never goes
    // over a line at someone's feet or in the keeper's hands, and it crosses a goal line
    // between the posts and under the bar only in the tick a goal is scored.
    let open = 0,
      owned = 0,
      over = 0,
      scored = 0,
      crossed = 0;
    // (A ball on a touchline is still in play, as in the test above.)
    const outside = (x: number, y: number) =>
      x < PITCH.left - 1e-4 ||
      x > PITCH.right + 1e-4 ||
      y < PITCH.top - 0.06 ||
      y > PITCH.bottom + 0.06;
    for (const [day, match] of fixtures(10, 20036)) {
      const record = footballRecord(day, match);
      const f = record.frames;
      const goalTicks = new Set(record.goals.map((g) => Math.round(g.at * HZ)));
      for (let k = 1; k <= FRAMES; k++) {
        const q = (k - 1) * FIELDS,
          o = k * FIELDS,
          t = (k - 1) / HZ;
        // The previous frame in open play: no restart, a side attacking, the clock running.
        if (f[q + META_AT + 6] !== 0 || f[q + META_AT + 5] < 0) continue;
        if (!(t < 60 || (t > 68 && t < 128))) continue;
        open++;
        if (f[q + BALL_AT + 6] >= 0) {
          owned++;
          if (outside(f[q + BALL_AT], f[q + BALL_AT + 1])) over++;
        }
        // Frames hold 32-bit floats, so the lines are compared at that precision too.
        for (const line of [Math.fround(PITCH.left), Math.fround(PITCH.right)]) {
          const side = line < 15.5 ? -1 : 1;
          const x0 = f[q + BALL_AT],
            x1 = f[o + BALL_AT];
          if ((x0 - line) * side > 0 || (x1 - line) * side <= 0) continue;
          const u = (x0 - line) / (x0 - x1);
          const y = f[q + BALL_AT + 1] + (f[o + BALL_AT + 1] - f[q + BALL_AT + 1]) * u,
            h = f[q + BALL_AT + 2] + (f[o + BALL_AT + 2] - f[q + BALL_AT + 2]) * u;
          if (y <= GOAL_MOUTH.top || y >= GOAL_MOUTH.bottom || h >= CROSSBAR) continue;
          if (goalTicks.has(k)) scored++;
          else crossed++;
        }
      }
    }
    expect(open).toBeGreaterThan(60 * 1000);
    expect(owned).toBeGreaterThan(60 * 500);
    expect(over).toBe(0);
    expect(scored).toBeGreaterThan(100);
    expect(crossed).toBe(0);
  });
  it('never lets a cross or a corner fly through a player', () => {
    // Markers beaten to a delivery in the air leave it to the attacker, but one it flies straight
    // into still meets it: below head height it never passes within 0.15 tiles of an outfield
    // player's centre untouched.
    let deliveries = 0,
      through = 0;
    for (const [day, match] of fixtures(10, 20400)) {
      const { frames: f, events } = footballRecord(day, match);
      const at = (k: number, i: number) => f[k * FIELDS + i];
      const speed = (k: number) => Math.hypot(at(k, BALL_AT + 3), at(k, BALL_AT + 4));
      for (const e of events) {
        if (e.kind !== 'cross') continue;
        deliveries++;
        const k0 = Math.round(e.at * HZ),
          struck = at(k0, META_AT + 7);
        // In flight until the next strike or touch (someone gains it, or it is kicked, headed,
        // saved or blocked), or the whistle.
        const flying = (k: number) =>
          k <= FRAMES &&
          (k < 60 * HZ || (k > 68 * HZ && k < 128 * HZ)) &&
          at(k, META_AT + 7) === struck &&
          at(k, BALL_AT + 6) === -2;
        for (let k = k0 + 1; flying(k); k++) {
          // Met in the next tick (a touch that kills its pace included), it counts as met.
          if (at(k, BALL_AT + 2) >= 30 || !flying(k + 1) || speed(k + 1) < speed(k) * 0.5) continue;
          for (let id = 1; id < 10; id++) {
            if (id === 5) continue;
            const d = Math.hypot(
              at(k, id * PF) - at(k, BALL_AT),
              at(k, id * PF + 1) - at(k, BALL_AT + 1),
            );
            if (d < 0.15) through++;
          }
        }
      }
    }
    expect(deliveries).toBeGreaterThan(50);
    expect(through).toBe(0);
  });
});

describe('Close-up football sound', () => {
  it('fades with distance and zoom and is silent when the ground is off screen', () => {
    const center = project(15.5, 25.5),
      at = (zoom: number) => ({ x: 500 - center.x * zoom, y: 350 - center.y * zoom, zoom });
    expect(footballListening(at(0.4), 1000, 700).gain).toBe(0);
    expect(footballListening(at(1.2), 1000, 700).gain).toBe(1);
    expect(footballListening(at(0.7), 1000, 700).gain).toBeGreaterThan(0);
    expect(footballListening({ ...at(1.2), x: 99999 }, 1000, 700).gain).toBe(0);
  });
  it('schedules every cue inside the cycle, in order, with a kick for every strike', () => {
    for (const [day, match] of fixtures(2, 20900)) {
      const { sounds, events } = footballRecord(day, match);
      expect(sounds.every((s) => s.at >= 0 && s.at < 140)).toBe(true);
      expect(sounds.every((s, i) => i === 0 || sounds[i - 1].at <= s.at)).toBe(true);
      expect(sounds.every((s) => s.strength > 0 && s.strength <= 1)).toBe(true);
      for (const e of events)
        if (['pass', 'cross', 'shot', 'clearance'].includes(e.kind))
          expect(sounds.some((s) => s.kind === 'kick' && s.at === e.at)).toBe(true);
      const finals = sounds.filter((s) => s.kind === 'final-whistle').map((s) => s.at);
      expect(finals).toEqual([60, 128]);
      expect(sounds.filter((s) => s.kind === 'cheer').length).toBe(
        events.filter((e) => e.kind === 'goal').length,
      );
      expect(sounds.filter((s) => s.kind === 'whistle').length).toBeGreaterThanOrEqual(2);
    }
  });
  it('plays contact once without replaying sounds after seeks or rejoining a match', () => {
    const kickAt = footballAt(360).sounds.find((s) => s.kind === 'kick')!.at;
    expect(kickAt).toBeGreaterThan(0.5);
    expect(kickAt).toBeLessThan(4);
    const before = footballAt(360 + kickAt - 0.01),
      kick = footballAt(360 + kickAt + 0.01);
    expect(footballSoundsBetween(before, kick)).toMatchObject([{ at: kickAt, kind: 'kick' }]);
    expect(footballSoundsBetween(kick, kick)).toEqual([]);
    expect(footballSoundsBetween(null, kick)).toEqual([]);
    expect(footballSoundsBetween(before, footballAt(380))).toEqual([]);
    expect(footballSoundsBetween(kick, before)).toEqual([]);
    expect(footballSoundsBetween(before, footballAt(360 + kickAt, 1))).toEqual([]);
    expect(footballSoundsBetween(footballAt(499.99), footballAt(500.01))).toEqual([]);
  });
  it.each(['kick', 'whistle', 'cheer'] as const)(
    'synthesizes a finite, bounded %s with a quiet tail',
    (kind) => {
      const data = renderFootballSound(kind, 12000);
      expect(data.length).toBeGreaterThan(1000);
      expect([...data].every((n) => Number.isFinite(n) && Math.abs(n) <= 1)).toBe(true);
      expect([...data].some((n) => Math.abs(n) > 0.04)).toBe(true);
      expect(Math.abs(data.at(-1)!)).toBeLessThan(0.015);
      expect(renderFootballSound(kind, 12000)).toEqual(data);
    },
  );
});
