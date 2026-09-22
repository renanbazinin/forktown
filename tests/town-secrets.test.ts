import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FARM,
  FARM_GROUND,
  FARM_PLOTS,
  insideFarm,
  scarecrowAt,
  SCARECROW_ROUTE,
  ufoAt,
} from '../src/lib/farm';
import { townDayAt, townMinutesAt, TOWN_DAY_MS } from '../src/lib/town-time';
import { HOUSE_PLOTS } from '../src/lib/events';
import { getPlot, isRoad, project, STREETLIGHTS } from '../src/lib/world';
import { placeSchema } from '../src/lib/schema';
import { cityHit } from '../src/city/render';

const houses = [
  { id: 'alpha', plot: 'A1' },
  { id: 'bravo', plot: 'B2' },
  { id: 'charlie', plot: 'C3' },
];

const at = (iso: string) => {
  const timestamp = Date.parse(iso);
  const minutes = townMinutesAt(timestamp),
    day = townDayAt(timestamp);
  return { crow: scarecrowAt(minutes, day), ufo: ufoAt(minutes, day, houses) };
};

describe('UTC town secrets', () => {
  it('rotates over every occupied house before repeating, regardless of input order', () => {
    const original = structuredClone(houses);
    for (let visit = -6; visit <= 9; visit++) {
      const state = ufoAt(120, visit * 10, houses)!;
      const next = ufoAt(120, (visit + 1) * 10, houses)!;
      expect(next.targetId).not.toBe(state.targetId);
      expect(ufoAt(120, visit * 10, [...houses].reverse())).toEqual(state);
      expect(ufoAt(120, (visit + houses.length) * 10, houses)).toEqual(state);
      const plot = getPlot(state.targetPlot)!;
      expect(Math.abs(state.position.x - plot.x - 0.5)).toBeLessThanOrEqual(0.25);
      expect(state.position.y).toBe(plot.y + 0.5);
      expect(ufoAt(90, visit * 10, houses)?.targetId).toBe(state.targetId);
      expect(ufoAt(179.999, visit * 10, houses)?.targetId).toBe(state.targetId);
    }
    expect(new Set([0, 10, 20].map((day) => ufoAt(120, day, houses)?.targetId)).size).toBe(3);
    expect(houses).toEqual(original);
  });

  it('handles an empty town, a single house, and invalid plots', () => {
    expect(ufoAt(120, 0, [])).toBeNull();
    expect(ufoAt(120, 0, [{ id: 'missing', plot: 'Z99' }])).toBeNull();
    expect(ufoAt(120, 0, houses.slice(0, 1))).toEqual(ufoAt(120, 10, houses.slice(0, 1)));
    expect(ufoAt(120, 0, [...houses, { id: 'missing', plot: 'Z99' }])).toEqual(
      ufoAt(120, 0, houses),
    );
  });

  it('replays the exact same state across refreshes, timezones, and independent clients', () => {
    expect(at('2026-09-22T00:02:00Z')).toEqual(at('2026-09-22T03:02:00+03:00'));
    expect(at('2026-09-22T00:02:00Z')).toEqual(at('2026-09-21T17:02:00-07:00'));
    const before = at('2026-09-22T00:01:04.125Z');
    at('2030-03-14T11:12:13Z');
    expect(at('2026-09-22T00:01:04.125Z')).toEqual(before);
    expect(before.crow.hopping).toBe(true);
    expect(before.crow.lift).toBeGreaterThan(0);
  });

  it('visits only every tenth night, with exact arrival and departure boundaries', () => {
    for (let day = -20; day <= 20; day++) {
      expect(ufoAt(120, day, houses) !== null).toBe(day % 10 === 0);
      for (const minute of [0, 89.999, 180, 360, 720, 1200, 1439.99])
        expect(ufoAt(minute, day, houses)).toBeNull();
    }
    expect(ufoAt(90, 0, houses)).not.toBeNull();
    expect(ufoAt(179.999, 0, houses)).not.toBeNull();
    expect(ufoAt(120, 0, houses)?.beam).toBe(1);
    expect(ufoAt(90, 0, houses)?.opacity).toBe(0);
    expect(ufoAt(179.999, 0, houses)!.opacity).toBeLessThan(0.001);
  });

  it('keeps the four-hour real UTC schedule after an absence or date rollover', () => {
    const start = Date.parse('2026-09-22T00:02:00Z');
    const ufo = ufoAt(townMinutesAt(start), townDayAt(start), houses);
    expect(ufo).not.toBeNull();
    for (const days of [10, 60, 6000]) {
      const later = start + days * TOWN_DAY_MS;
      expect(ufoAt(townMinutesAt(later), townDayAt(later), houses)).toMatchObject({
        phase: ufo!.phase,
        beam: ufo!.beam,
        opacity: ufo!.opacity,
      });
    }
  });

  it('moves one adjacent plot per night, including the return along T and loop boundary', () => {
    expect(SCARECROW_ROUTE).toEqual([
      'S9',
      'S8',
      'S7',
      'S6',
      'S5',
      'S4',
      'T4',
      'T5',
      'T6',
      'T7',
      'T8',
      'T9',
    ]);
    for (let day = -1; day <= 24; day++) {
      const before = scarecrowAt(59.999, day),
        after = scarecrowAt(68, day);
      const a = getPlot(before.plot)!,
        b = getPlot(after.plot)!;
      expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
      expect(scarecrowAt(60, day).position).toEqual(before.position);
      expect(scarecrowAt(64, day).lift).toBeCloseTo(14);
      expect(after.hopping).toBe(false);
      expect(after.lift).toBe(0);
      expect(scarecrowAt(1439.999, day).position).toEqual(after.position);
      expect(scarecrowAt(0, day + 1).position).toEqual(after.position);
      expect(scarecrowAt(720, day + 12)).toEqual(scarecrowAt(720, day));
      for (let minute = 60; minute <= 68; minute += 0.5)
        expect(insideFarm(scarecrowAt(minute, day).position)).toBe(true);
    }
  });
});

describe('Farm land and map integration', () => {
  it('reserves exactly S4–T9 without displacing any contributed home', () => {
    expect([...FARM_PLOTS].sort()).toEqual([
      'S4',
      'S5',
      'S6',
      'S7',
      'S8',
      'S9',
      'T4',
      'T5',
      'T6',
      'T7',
      'T8',
      'T9',
    ]);
    expect(HOUSE_PLOTS.some((p) => FARM_PLOTS.includes(p.id))).toBe(false);
    const sample = JSON.parse(readFileSync('places/my-little-place.json', 'utf8'));
    for (const plot of FARM_PLOTS)
      expect(placeSchema.safeParse({ ...sample, plot }).success).toBe(false);
    for (const file of readdirSync('places').filter((name) => name.endsWith('.json')))
      expect(FARM_PLOTS).not.toContain(JSON.parse(readFileSync(`places/${file}`, 'utf8')).plot);
    for (const plot of ['S3', 'S10', 'T3', 'T10'])
      expect(placeSchema.safeParse({ ...sample, plot }).success).toBe(true);
  });

  it('removes interior roads and lamps while retaining perimeter access', () => {
    const g = FARM_GROUND;
    for (let x = g.left; x < g.right; x++) {
      for (let y = g.top; y < g.bottom; y++) expect(isRoad(x, y)).toBe(false);
      expect(isRoad(x, g.top - 1)).toBe(true);
      expect(isRoad(x, g.bottom)).toBe(true);
    }
    for (let y = g.top; y < g.bottom; y++) {
      expect(isRoad(g.left - 1, y)).toBe(true);
      expect(isRoad(g.right, y)).toBe(true);
    }
    expect(STREETLIGHTS.some((p) => insideFarm(p))).toBe(false);
  });

  it('selects the farm across its connected field, including former internal streets', () => {
    for (const point of [
      { x: 15.5, y: 75.5 },
      { x: 33, y: 77 },
      { x: 35.5, y: 79.5 },
    ])
      expect(cityHit(project(point.x, point.y), [], [])).toEqual({ kind: 'place', id: FARM.plot });
  });
});
