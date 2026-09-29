import { describe, expect, it } from 'vitest';
import {
  CALENDAR_EPOCH,
  CALENDAR_EPOCH_DAY,
  DAYS_PER_SEASON,
  DAYS_PER_YEAR,
  moonSlice,
  townCalendarAt,
  townNightShare,
  townSkyAt,
} from '../src/lib/town-calendar';
import { townDayAt, townMinutesAt, TOWN_DAY_MS } from '../src/lib/town-time';

const skyAt = (timestamp: number) => townSkyAt(townDayAt(timestamp), townMinutesAt(timestamp));

describe('A persistent town calendar', () => {
  it('starts from a fixed epoch and carries dates through seasons and years', () => {
    expect(skyAt(CALENDAR_EPOCH)).toMatchObject({ label: 'Spring 1, Year 1', moonPhase: 0 });
    expect(skyAt(CALENDAR_EPOCH + TOWN_DAY_MS - 1).label).toBe('Spring 1, Year 1');
    expect(skyAt(CALENDAR_EPOCH + TOWN_DAY_MS).label).toBe('Spring 2, Year 1');
    expect(townCalendarAt(CALENDAR_EPOCH_DAY + 27).label).toBe('Spring 28, Year 1');
    expect(townCalendarAt(CALENDAR_EPOCH_DAY + 28).label).toBe('Summer 1, Year 1');
    expect(townCalendarAt(CALENDAR_EPOCH_DAY + 111).label).toBe('Winter 28, Year 1');
    expect(townCalendarAt(CALENDAR_EPOCH_DAY + DAYS_PER_YEAR).label).toBe('Spring 1, Year 2');
    expect(townCalendarAt(CALENDAR_EPOCH_DAY - 1).label).toBe('Winter 28, Year 0');
  });

  it('shares the entire sky and date across timezones, reloads, and gaps in viewing', () => {
    const timestamp = Date.parse('2026-09-22T00:07:34.250Z');
    const expected = skyAt(timestamp);
    expect(skyAt(Date.parse('2026-09-22T03:07:34.250+03:00'))).toEqual(expected);
    expect(skyAt(Date.parse('2026-09-21T17:07:34.250-07:00'))).toEqual(expected);
    for (const offset of [TOWN_DAY_MS * 1000, -TOWN_DAY_MS, 1234, 0]) {
      skyAt(timestamp + offset);
      expect(skyAt(timestamp)).toEqual(expected);
    }
  });

  it('cycles continuously through new, crescent, half, and full moons', () => {
    const moon = (days: number) => townCalendarAt(CALENDAR_EPOCH_DAY + days);
    expect(moon(0)).toMatchObject({ moonName: 'New moon', illumination: 0 });
    expect(moon(3).moonName).toBe('Waxing crescent');
    expect(moon(7).illumination).toBeCloseTo(0.5);
    expect(moon(14)).toMatchObject({ moonName: 'Full moon', illumination: 1 });
    expect(moon(21).illumination).toBeCloseTo(0.5);
    expect(moon(25).moonName).toBe('Waning crescent');
    expect(moon(DAYS_PER_SEASON).moonPhase).toBe(0);
    const before = townCalendarAt(CALENDAR_EPOCH_DAY + 27, 1439.999);
    expect(before.illumination).toBeCloseTo(moon(28).illumination, 10);
    expect(townCalendarAt(CALENDAR_EPOCH_DAY, 720).moonPhase).toBeGreaterThan(moon(0).moonPhase);
  });
});

describe('Quiet celestial motion', () => {
  it('keeps sunrise, sunset and the moon aligned with town daylight hours', () => {
    const sky = (minutes: number) => townSkyAt(CALENDAR_EPOCH_DAY, minutes);
    for (const minutes of [0, 300, 360, 1200, 1439]) expect(sky(minutes).sun.opacity).toBe(0);
    expect(sky(780).sun).toMatchObject({ x: 0.5, opacity: 1 });
    expect(sky(780).moon.opacity).toBe(0);
    expect(sky(60).moon).toMatchObject({ x: 0.5, opacity: 1 });
    expect(sky(780).daylight).toBe(1);
    expect(sky(60).daylight).toBe(0);
    expect(sky(360).daylight).toBeCloseTo(0.5);
    expect(sky(1200).daylight).toBeCloseTo(0.5);
  });

  it('never teleports the moon or changes the sky abruptly at midnight', () => {
    const before = townSkyAt(CALENDAR_EPOCH_DAY + 12, 1439.999);
    const after = townSkyAt(CALENDAR_EPOCH_DAY + 13, 0);
    expect(before.moon.x).toBeCloseTo(after.moon.x, 5);
    expect(before.moon.y).toBeCloseTo(after.moon.y, 5);
    expect(before.moon.opacity).toBe(after.moon.opacity);
    expect(before.illumination).toBeCloseTo(after.illumination, 6);
    expect(before.daylight).toBe(after.daylight);
  });

  it('draws opposite crescents, quarter discs and a full disc within the lunar limb', () => {
    expect(moonSlice(0, 0)).toEqual([1, 1]);
    expect(moonSlice(0.5, 0)).toEqual([-1, 1]);
    expect(moonSlice(0.25, 0)[0]).toBeCloseTo(0);
    expect(moonSlice(0.75, 0)[1]).toBeCloseTo(0);
    for (let phase = 0; phase <= 1; phase += 0.025) {
      for (let y = -1; y <= 1; y += 0.05) {
        const [left, right] = moonSlice(phase, y);
        const mirrored = moonSlice(1 - phase, y);
        expect(left).toBeGreaterThanOrEqual(-1);
        expect(right).toBeLessThanOrEqual(1);
        expect(left).toBeLessThanOrEqual(right);
        expect(right - left).toBeCloseTo(mirrored[1] - mirrored[0]);
        // An invisible new-moon slice can lie on either limb.
        if (right - left > 1e-10) {
          expect(left).toBeCloseTo(-mirrored[1]);
          expect(right).toBeCloseTo(-mirrored[0]);
        }
      }
    }
  });
});

describe('Nightfall below the sky', () => {
  const lights = (minutes: number) => minutes < 360 || minutes >= 1200;

  it('turns the town over eighty seconds around the lights, not in one frame', () => {
    // Plain day and plain night outside the fades, matching the lights' own hours there.
    for (let minutes = 0; minutes < 1440; minutes += 0.5) {
      const share = townNightShare(minutes);
      if ((minutes > 330 && minutes < 410) || (minutes > 1150 && minutes < 1230)) {
        expect(share).toBeGreaterThan(0);
        expect(share).toBeLessThan(1);
      } else expect(share).toBe(lights(minutes) ? 1 : 0);
    }
    // Dusk has barely begun at the golden-hour peak, is two-thirds dark as the first lantern
    // lights and is night as the last streetlamp does. Dawn mirrors it: the lights go out at 0.68.
    expect(townNightShare(1165)).toBeCloseTo(0.09, 2);
    expect(townNightShare(1200)).toBeCloseTo(0.68, 2);
    expect(townNightShare(1230)).toBe(1);
    expect(townNightShare(360)).toBeCloseTo(townNightShare(1200), 10);
    expect(townNightShare(410)).toBe(0);
  });

  it('never steps between two frames, through the fades and across midnight and noon', () => {
    // The map repaints thirty times a real second, and a town minute is one real second.
    let before = townNightShare(-1 / 30);
    for (let frame = 0; frame <= 1440 * 30; frame++) {
      const minutes = frame / 30;
      const share = townNightShare(minutes);
      expect(Math.abs(share - before)).toBeLessThan(0.001);
      // Darker through the evening, lighter through the morning.
      if (minutes >= 720) expect(share).toBeGreaterThanOrEqual(before);
      else if (minutes > 0) expect(share).toBeLessThanOrEqual(before);
      before = share;
    }
    expect(townNightShare(1440 + 1200)).toBe(townNightShare(1200));
    expect(townNightShare(-240)).toBe(townNightShare(1200));
  });
});
