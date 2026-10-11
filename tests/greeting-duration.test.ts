import { afterEach, describe, expect, it, vi } from 'vitest';
import * as homeLife from '../src/lib/home-life';
import * as trips from '../src/lib/resident-trips';
import * as errands from '../src/lib/seasonal-errands';
import { GREETING_MINUTES, simulateResidents } from '../src/lib/simulation';
import { FUNKY_FUN } from './fixtures';

afterEach(() => vi.restoreAllMocks());

/** A quiet meeting, with a doorway transition at an exact minute between planning samples. */
function meeting(until: number, from = 600) {
  vi.spyOn(trips, 'residentTrips').mockReturnValue(new Map());
  vi.spyOn(errands, 'residentErrands').mockReturnValue(new Map());
  vi.spyOn(homeLife, 'planAt').mockImplementation((_plan, minute) => ({
    indoors: false,
    position: { x: 10, y: 10 },
    moving: false,
    facing: 'se',
    walkPhase: 0,
    ...(minute < from || minute >= until ? { fade: 0.5 } : {}),
  }));
  const homes = [
    { ...FUNKY_FUN, id: 'greeting-a', plot: 'C4' },
    { ...FUNKY_FUN, id: 'greeting-c', plot: 'C2' },
  ];
  return (minute: number) => simulateResidents(homes, minute).filter((state) => state.greeting);
}

describe('Greeting availability between planning samples', () => {
  it('stays quiet when a doorway ends a meeting before the minimum greeting duration', () => {
    const talking = meeting(600 + GREETING_MINUTES - 0.06);
    // A 1.44-minute meeting used to be rounded up to 1.5 minutes, then cut short by the doorway.
    for (let frame = 0; frame < 40; frame++) expect(talking(600 + frame / 20)).toHaveLength(0);
  });

  it('keeps a long-enough meeting visible for its full minimum duration', () => {
    const talking = meeting(600 + GREETING_MINUTES + 0.04);
    for (let frame = 0; frame < GREETING_MINUTES * 20; frame++)
      expect(talking(600 + frame / 20)).toHaveLength(1);
    expect(talking(600 + GREETING_MINUTES + 0.05)).toHaveLength(0);
  });

  it('preserves a whole beat but checks availability just before its boundary', () => {
    const talking = meeting(605);
    expect(talking(604.99)).toHaveLength(1);
  });

  it('does not round a short meeting up at the end of a beat', () => {
    const talking = meeting(604.94, 603.5);
    expect(talking(603.5)).toHaveLength(0);
  });
});
