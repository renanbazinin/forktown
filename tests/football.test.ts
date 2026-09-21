import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  footballAt,
  FOOTBALL_PLOTS,
  FOOTBALL_ENTRANCE,
  GROUND,
  PITCH,
  insideFootball,
  footballListening,
} from '../src/lib/football';
import { isRoad, STREETLIGHTS, project, plotEntrance, getPlot } from '../src/lib/world';
import { HOUSE_PLOTS } from '../src/lib/events';
import { placeSchema } from '../src/lib/schema';
import { roadPath, simulateResidents } from '../src/lib/simulation';
import { cityHit } from '../src/city/render';
import { footballSoundsBetween, renderFootballSound } from '../src/music/football-sound';

const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
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
  });
  it('runs six repeatable daylight matches with a half-time and a final result', () => {
    expect(footballAt(359.99).live).toBe(false);
    expect(footballAt(1200).live).toBe(false);
    for (let match = 0; match < 6; match++) {
      const start = 360 + match * 140;
      expect(footballAt(start).score).toEqual([0, 0]);
      expect(footballAt(start).players).toHaveLength(8);
      expect(footballAt(start + 60).phase).toBe('halftime');
      expect(footballAt(start + 68).phase).toBe('second');
      expect(footballAt(start + 128).phase).toBe('fulltime');
      expect(footballAt(start + 139).clock).toBe('10:00');
      expect(footballAt(start + 139).score).toEqual(footballAt(start + 128).score);
    }
    expect(footballAt(544.32, 42)).toEqual(footballAt(544.32, 42));
    expect(footballAt(544.32, 42)).toEqual(footballAt(544.32 + 1440, 42));
  });
  it('awards a goal only when the ball reaches the goal line, and counts shots and saves', () => {
    let goals = 0,
      saves = 0;
    for (let day = 0; day < 8; day++)
      for (let attack = 0; attack < 10; attack++) {
        const start = 360 + (attack < 5 ? attack * 12 : 68 + (attack - 5) * 12);
        const before = footballAt(start + 8.99, day),
          after = footballAt(start + 9, day);
        const delta = after.score[0] + after.score[1] - before.score[0] - before.score[1];
        expect(delta).toBe(after.goal ? 1 : 0);
        if (after.goal) {
          goals++;
          expect(
            Math.min(Math.abs(after.ball.x - PITCH.left), Math.abs(after.ball.x - PITCH.right)),
          ).toBeLessThan(0.001);
          expect(Math.abs(after.ball.y - 25)).toBeLessThan(0.8);
        }
        saves += after.saves[0] + after.saves[1] - before.saves[0] - before.saves[1];
      }
    expect(goals).toBeGreaterThan(0);
    expect(saves).toBeGreaterThan(0);
    const final = footballAt(499, 0);
    expect(final.shots[0] + final.shots[1]).toBe(10);
  });
  it('moves continuously between passes, shots, possessions, halves, and matches', () => {
    for (let day = 0; day < 3; day++)
      for (let t = 0.25; t < 280; t += 0.25) {
        const previous = footballAt(360 + t - 0.001, day),
          next = footballAt(360 + t, day);
        expect(
          Math.hypot(next.ball.x - previous.ball.x, next.ball.y - previous.ball.y),
        ).toBeLessThan(0.02);
        next.players.forEach((p, i) => {
          expect(insideFootball(p)).toBe(true);
          expect(Math.hypot(p.x - previous.players[i].x, p.y - previous.players[i].y)).toBeLessThan(
            0.02,
          );
        });
      }
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
  it('plays contact once without replaying sounds after seeks or rejoining a match', () => {
    const before = footballAt(361.99),
      kick = footballAt(362.01);
    expect(footballSoundsBetween(before, kick)).toMatchObject([{ at: 2, kind: 'kick' }]);
    expect(footballSoundsBetween(kick, kick)).toEqual([]);
    expect(footballSoundsBetween(null, kick)).toEqual([]);
    expect(footballSoundsBetween(before, footballAt(380))).toEqual([]);
    expect(footballSoundsBetween(kick, before)).toEqual([]);
    expect(footballSoundsBetween(before, footballAt(362, 1))).toEqual([]);
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
