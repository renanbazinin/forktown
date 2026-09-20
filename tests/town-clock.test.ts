import { describe, expect, it } from 'vitest';
import { townMinutesAt, TOWN_DAY_MS } from '../src/lib/town-time';
import { timeLabel } from '../src/lib/simulation';

describe('A 24-minute town day shared through UTC', () => {
  it('starts at UTC midnight and advances an hour each real minute', () => {
    const midnight = Date.parse('2026-09-20T00:00:00Z');
    expect(timeLabel(townMinutesAt(midnight))).toBe('00:00');
    expect(timeLabel(townMinutesAt(midnight + 60_000))).toBe('01:00');
    expect(timeLabel(townMinutesAt(midnight + 12 * 60_000 + 30_000))).toBe('12:30');
    expect(timeLabel(townMinutesAt(midnight + 23 * 60_000 + 59_000))).toBe('23:59');
    expect(timeLabel(townMinutesAt(midnight + TOWN_DAY_MS))).toBe('00:00');
  });
  it('gives the same phase across timezone offsets and visits', () => {
    const utc = Date.parse('2026-09-20T12:07:34Z');
    expect(townMinutesAt(Date.parse('2026-09-20T15:07:34+03:00'))).toBe(townMinutesAt(utc));
    expect(townMinutesAt(Date.parse('2026-09-20T05:07:34-07:00'))).toBe(townMinutesAt(utc));
    expect(timeLabel(townMinutesAt(utc))).toBe('07:34');
    expect(townMinutesAt(utc + 3 * TOWN_DAY_MS)).toBe(townMinutesAt(utc));
  });
  it('catches up after absence without accumulated timer drift', () => {
    const start = Date.parse('2026-09-20T00:01:10.250Z');
    expect(townMinutesAt(start)).toBe(70.25);
    expect(townMinutesAt(start + 120_000)).toBe(190.25);
    expect(townMinutesAt(start + 86_400_000)).toBe(70.25);
  });
});
