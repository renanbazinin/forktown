import { describe, expect, it, vi } from 'vitest';
import {
  AUTUMN,
  canopyAt,
  firefliesAt,
  flurryAt,
  pumpkinOut,
  seedFraction,
  snowAt,
  snowCoverAt,
  SPRING,
  SUMMER,
  townSeasonAt,
  WINTER,
  yearDayAt,
  type Canopy,
  type TreeKind,
} from '../src/lib/seasons';
import {
  CALENDAR_EPOCH,
  CALENDAR_EPOCH_DAY,
  DAYS_PER_SEASON,
  DAYS_PER_YEAR,
  townCalendarAt,
} from '../src/lib/town-calendar';
import { TOWN_DAY_MS, townDayAt, townMinutesAt } from '../src/lib/town-time';

const EPOCH = CALENDAR_EPOCH_DAY;
// seedFraction can only return k / 10007, so this is every schedule a tree, roof or doorstep can
// have. SEEDS is a handful of them, including both ends, for the long sweeps.
const EVERY_SEED = Array.from({ length: 10007 }, (_, k) => k / 10007);
const SEEDS = [0, 0.27, 0.5, 0.81, 10006 / 10007];
const LEAFY: TreeKind[] = ['deciduous', 'blossom', 'larch'];
const KINDS: TreeKind[] = ['evergreen', ...LEAFY];
const FIELDS = [
  'turn',
  'deepen',
  'dormant',
  'blossom',
  'petalFall',
  'petals',
  'leafFall',
  'leaves',
  'snow',
] as const satisfies readonly (keyof Canopy)[];
// Sweeps step half a town minute (1.25 real seconds); nothing may move more than this per step.
const SMOOTH = 0.03;
const HOUR = 1 / 24;

const seasonAtTime = (timestamp: number) =>
  townSeasonAt(townDayAt(timestamp), townMinutesAt(timestamp));

/** Calls `visit` every half town minute for `days` town days from `fromDay` days after the epoch,
 * rolling over each midnight exactly as the town clock does. */
function walkClock(fromDay: number, days: number, visit: (day: number, minutes: number) => void) {
  for (let step = 0; step <= days * 2880; step++) {
    const whole = Math.floor(step / 2880);
    visit(EPOCH + fromDay + whole, (step - whole * 2880) / 2);
  }
}

/** The biggest change of `sample` between neighbouring half-minute steps of the town clock. */
function largestStep(
  fromDay: number,
  days: number,
  sample: (day: number, minutes: number) => number,
) {
  let largest = 0;
  let previous: number | undefined;
  walkClock(fromDay, days, (day, minutes) => {
    const next = sample(day, minutes);
    if (previous !== undefined) largest = Math.max(largest, Math.abs(next - previous));
    previous = next;
  });
  return largest;
}

/** The biggest change of any canopy value between two moments. */
const largestChange = (a: Canopy, b: Canopy) =>
  Math.max(
    Math.abs(a.turn - b.turn),
    Math.abs(a.deepen - b.deepen),
    Math.abs(a.dormant - b.dormant),
    Math.abs(a.blossom - b.blossom),
    Math.abs(a.petalFall - b.petalFall),
    Math.abs(a.petals - b.petals),
    Math.abs(a.leafFall - b.leafFall),
    Math.abs(a.leaves - b.leaves),
    Math.abs(a.snow - b.snow),
  );

/** Year days from `from` up to (not including) `to`, `step` apart. */
function span(from: number, to: number, step: number) {
  const days: number[] = [];
  for (let i = 0; from + i * step < to; i++) days.push(from + i * step);
  return days;
}

/** The heaviest snowfall of one town day, sampled every ten town minutes. */
function heaviestFlurry(day: number) {
  let heaviest = 0;
  for (let minutes = 0; minutes < 1440; minutes += 10)
    heaviest = Math.max(heaviest, flurryAt(day, minutes));
  return heaviest;
}

/** Which days of each winter, counted from Winter 1, have falling snow. */
function snowyWinterDays(fromYear: number, years: number) {
  return Array.from({ length: years }, (_, i) =>
    Array.from(
      { length: DAYS_PER_SEASON },
      (_, date) => heaviestFlurry(EPOCH + (fromYear + i) * DAYS_PER_YEAR + WINTER + date) > 0,
    ),
  );
}

describe('The year day', () => {
  it('starts at Spring 1, 00:00 on the calendar epoch and wraps after Winter 28', () => {
    expect([SPRING, SUMMER, AUTUMN, WINTER]).toEqual([0, 28, 56, 84]);
    expect(WINTER + DAYS_PER_SEASON).toBe(DAYS_PER_YEAR);
    expect(yearDayAt(EPOCH)).toBe(0);
    expect(yearDayAt(EPOCH, 0)).toBe(0);
    expect(seasonAtTime(CALENDAR_EPOCH)).toMatchObject({ yearDay: 0, groundDay: 0, index: 0 });
    expect(yearDayAt(EPOCH, 720)).toBe(0.5);
    expect(yearDayAt(EPOCH + SUMMER)).toBe(SUMMER);
    expect(yearDayAt(EPOCH + WINTER, 360)).toBe(WINTER + 0.25);
    expect(yearDayAt(EPOCH + 111, 1080)).toBe(111.75);
    expect(yearDayAt(EPOCH + DAYS_PER_YEAR)).toBe(0);
    expect(yearDayAt(EPOCH + DAYS_PER_YEAR * 5 + 30, 360)).toBe(30.25);
    expect(yearDayAt(EPOCH + 111, 1439.999)).toBeLessThan(DAYS_PER_YEAR);
  });

  it('counts backwards through earlier years', () => {
    expect(yearDayAt(EPOCH - 1)).toBe(111);
    expect(yearDayAt(EPOCH - 1, 1080)).toBe(111.75);
    expect(yearDayAt(EPOCH - DAYS_PER_YEAR)).toBe(0);
    expect(yearDayAt(EPOCH - DAYS_PER_YEAR - 1, 720)).toBe(111.5);
    expect(yearDayAt(EPOCH - 300)).toBe(36);
    expect(yearDayAt(0)).toBeGreaterThanOrEqual(0);
    expect(yearDayAt(0)).toBeLessThan(DAYS_PER_YEAR);
  });

  it("always agrees with the almanac's season and date", () => {
    const disagreements: string[] = [];
    for (let day = EPOCH - 300; day <= EPOCH + 300; day++) {
      for (const minutes of [0, 0.5, 359.5, 720, 1199.999, 1439, 1439.999]) {
        const season = townSeasonAt(day, minutes);
        const calendar = townCalendarAt(day, minutes);
        const ok =
          season.index === calendar.seasonIndex &&
          Number.isInteger(season.groundDay) &&
          season.groundDay === Math.floor(season.yearDay) &&
          season.groundDay === calendar.seasonIndex * DAYS_PER_SEASON + calendar.date - 1 &&
          season.yearDay >= 0 &&
          season.yearDay < DAYS_PER_YEAR &&
          season.day === day;
        if (!ok) disagreements.push(`${day - EPOCH} ${minutes}`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('keeps the season and ground day on the almanac, even a floating-point hair before midnight', () => {
    // A minute this close to 1440 can round the year day up to 0.0 at the end of Winter 28, while
    // the almanac (and so the season and the cached ground) still says Winter 28. The clock never
    // gets this close (it counts whole milliseconds), but the season must not flip either way.
    const hairs = [1440 - 1e-9, 1440 - 1e-12, 1440 * (1 - Number.EPSILON)];
    const disagreements: string[] = [];
    for (let day = EPOCH - 300; day <= EPOCH + 300; day++) {
      for (const minutes of hairs) {
        const season = townSeasonAt(day, minutes);
        const calendar = townCalendarAt(day, minutes);
        const intoDay = (season.yearDay - season.groundDay + DAYS_PER_YEAR) % DAYS_PER_YEAR;
        const ok =
          season.index === calendar.seasonIndex &&
          season.groundDay === calendar.seasonIndex * DAYS_PER_SEASON + calendar.date - 1 &&
          intoDay >= 0 &&
          intoDay <= 1;
        if (!ok) disagreements.push(`${day - EPOCH} ${minutes}`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('moves the ground day once a town day, at midnight, and never jumps the year day', () => {
    for (let day = EPOCH - 3; day < EPOCH + DAYS_PER_YEAR + 3; day++) {
      const morning = townSeasonAt(day, 0);
      const night = townSeasonAt(day, 1439.999);
      const next = townSeasonAt(day + 1, 0);
      expect(night.groundDay).toBe(morning.groundDay);
      expect(next.groundDay).toBe((morning.groundDay + 1) % DAYS_PER_YEAR);
      // The only step the year day takes at midnight is the wrap from 112 back to 0.
      const gap = (next.yearDay - night.yearDay + DAYS_PER_YEAR) % DAYS_PER_YEAR;
      expect(gap).toBeLessThan(1e-5);
    }
  });

  it('is the same instant, and the same season, in every time zone', () => {
    // Winter 1, 19:12 (the heaviest moment of the first snow) and Summer 15, 22:00 (fireflies).
    const instants = [
      [
        '2026-09-21T09:55:12.000Z',
        '2026-09-21T12:55:12.000+03:00',
        '2026-09-21T02:55:12.000-07:00',
        '2026-09-21T15:40:12.000+05:45',
      ],
      [
        '2026-09-20T17:10:00.000Z',
        '2026-09-21T02:10:00.000+09:00',
        '2026-09-20T13:10:00.000-04:00',
        '2026-09-21T07:10:00.000+14:00',
      ],
    ];
    for (const [utc, ...zoned] of instants) {
      const expected = seasonAtTime(Date.parse(utc));
      for (const written of zoned) expect(seasonAtTime(Date.parse(written))).toEqual(expected);
      // A later or earlier question never changes the answer.
      seasonAtTime(Date.parse(utc) + TOWN_DAY_MS * 1000);
      seasonAtTime(Date.parse(utc) - 1234);
      expect(seasonAtTime(Date.parse(utc))).toEqual(expected);
    }
    expect(seasonAtTime(Date.parse(instants[0][0]))).toMatchObject({ index: 3, groundDay: WINTER });
    expect(seasonAtTime(Date.parse(instants[0][0])).flurry).toBeGreaterThan(0.99);
    expect(seasonAtTime(Date.parse(instants[1][0]))).toMatchObject({ index: 1, groundDay: 42 });
    expect(seasonAtTime(Date.parse(instants[1][0])).fireflies).toBeGreaterThan(0.9);
  });
});

describe('Snow on roofs, lamps and crowns', () => {
  it('never lies outside winter', () => {
    for (const day of span(0, WINTER, HOUR)) {
      for (const s of SEEDS) expect(snowAt(day, s)).toBe(0);
      expect(snowAt(day)).toBe(0);
      expect(snowCoverAt(day)).toBe(0);
    }
  });

  it('starts every spring clean, whatever the schedule', () => {
    expect(EVERY_SEED.filter((s) => snowAt(SPRING, s) !== 0)).toEqual([]);
    // The thaw has cleared the last roof by the afternoon of Winter 28.
    expect(EVERY_SEED.filter((s) => snowAt(WINTER + 27.6, s) !== 0)).toEqual([]);
    expect(EVERY_SEED.filter((s) => snowAt(DAYS_PER_YEAR - 1e-6, s) !== 0)).toEqual([]);
    expect(townSeasonAt(EPOCH + 111, 1439.999).snow).toBe(0);
    expect(townSeasonAt(EPOCH + DAYS_PER_YEAR, 0).snow).toBe(0);
  });

  it('settles over Winter 1 and 2, covers everything in deep winter and thaws roof by roof', () => {
    expect(EVERY_SEED.filter((s) => snowAt(WINTER, s) !== 0)).toEqual([]);
    expect(EVERY_SEED.filter((s) => snowAt(WINTER + 2, s) !== 1)).toEqual([]);
    expect(EVERY_SEED.filter((s) => snowAt(95, s) !== 1)).toEqual([]);
    expect(EVERY_SEED.filter((s) => snowAt(WINTER + 23, s) !== 1)).toEqual([]);
    // Arrival and thaw are staggered: halfway through each, some roofs are white and some bare.
    for (const day of [WINTER + 0.8, WINTER + 25]) {
      const white = EVERY_SEED.filter((s) => snowAt(day, s) === 1).length;
      const bare = EVERY_SEED.filter((s) => snowAt(day, s) === 0).length;
      expect(white).toBeGreaterThan(2000);
      expect(bare).toBeGreaterThan(2000);
    }
  });

  it('only ever gathers during the first snow and only ever melts during the thaw', () => {
    for (const s of SEEDS) {
      let previous = snowAt(WINTER, s);
      for (const day of span(WINTER, DAYS_PER_YEAR, 1 / 1440)) {
        const next = snowAt(day, s);
        if (next > previous) expect(day).toBeLessThan(WINTER + 2);
        if (next < previous) expect(day).toBeGreaterThanOrEqual(WINTER + 23);
        previous = next;
      }
    }
  });

  it('settles only while snow is falling', () => {
    const settling: string[] = [];
    for (const s of SEEDS) {
      walkClock(WINTER, 2, (day, minutes) => {
        const yearDay = yearDayAt(day, minutes);
        if (snowAt(yearDay + 0.5 / 1440, s) > snowAt(yearDay, s) && flurryAt(day, minutes) === 0)
          settling.push(`${s} ${yearDay}`);
      });
    }
    expect(settling).toEqual([]);
  });

  it('arrives and leaves without a jump, even across the new year', () => {
    for (const s of SEEDS) {
      expect(
        largestStep(0, DAYS_PER_YEAR + 1, (day, m) => snowAt(yearDayAt(day, m), s)),
      ).toBeLessThan(SMOOTH);
    }
    expect(largestStep(WINTER - 1, 30, (day, m) => townSeasonAt(day, m).snow)).toBeLessThan(SMOOTH);
  });

  it('gives a town-wide cover between 0 and 1 that follows the average roof', () => {
    for (const day of span(0, DAYS_PER_YEAR, HOUR)) {
      const cover = snowCoverAt(day);
      expect(cover).toBeGreaterThanOrEqual(0);
      expect(cover).toBeLessThanOrEqual(1);
      if (day < WINTER) expect(cover).toBe(0);
    }
    for (const day of span(WINTER, DAYS_PER_YEAR, 0.25)) {
      const average = EVERY_SEED.reduce((sum, s) => sum + snowAt(day, s), 0) / EVERY_SEED.length;
      expect(Math.abs(snowCoverAt(day) - average)).toBeLessThan(0.1);
    }
    expect(snowCoverAt(95)).toBe(1);
  });
});

describe('Tree canopies', () => {
  it('leaves evergreens green all year, with nothing but snow on them', () => {
    for (const s of SEEDS) {
      for (const day of span(0, DAYS_PER_YEAR, 0.25)) {
        const { snow, ...rest } = canopyAt(day, s, 'evergreen');
        expect(Object.values(rest).every((value) => value === 0)).toBe(true);
        expect(snow).toBe(snowAt(day, s));
      }
    }
  });

  it('blossoms only on the flowering trees, and only in spring', () => {
    for (const kind of KINDS) {
      for (const s of SEEDS) {
        for (const day of span(0, DAYS_PER_YEAR, 0.25)) {
          const { blossom, petalFall, petals } = canopyAt(day, s, kind);
          if (kind !== 'blossom' || day >= SUMMER)
            expect([blossom, petalFall, petals]).toEqual([0, 0, 0]);
        }
      }
    }
    // Every flowering tree is in full bloom in the second week of spring.
    expect(EVERY_SEED.filter((s) => canopyAt(10, s, 'blossom').blossom !== 1)).toEqual([]);
    expect(EVERY_SEED.filter((s) => canopyAt(SUMMER - 1e-6, s, 'blossom').petals !== 0)).toEqual(
      [],
    );
  });

  it('shows every deciduous tree in leaf mid-summer and bare in deep winter', () => {
    for (const kind of LEAFY) {
      const inLeaf = EVERY_SEED.filter((s) => {
        const summer = canopyAt(42, s, kind);
        return summer.dormant === 0 && summer.turn === 0 && summer.leaves === 0;
      });
      expect(inLeaf).toHaveLength(EVERY_SEED.length);
      const bare = EVERY_SEED.filter((s) => {
        const winter = canopyAt(95, s, kind);
        return winter.dormant === 1 && winter.leafFall === 0 && winter.leaves === 0;
      });
      expect(bare).toHaveLength(EVERY_SEED.length);
      // Still bare on Spring 1 and in leaf by Spring 7.
      expect(EVERY_SEED.filter((s) => canopyAt(SPRING, s, kind).dormant !== 1)).toEqual([]);
      expect(EVERY_SEED.filter((s) => canopyAt(6, s, kind).dormant !== 0)).toEqual([]);
    }
  });

  it('turns the trees one by one in early autumn', () => {
    for (const kind of LEAFY) {
      for (const s of SEEDS) {
        for (const day of span(SUMMER, AUTUMN + 1, HOUR)) {
          expect(canopyAt(day, s, kind).turn).toBe(0);
          expect(canopyAt(day, s, kind).deepen).toBe(0);
        }
      }
      // Complete for everyone by Autumn 12, ochre deepening to russet by the end of autumn.
      expect(EVERY_SEED.filter((s) => canopyAt(AUTUMN + 11, s, kind).turn !== 1)).toEqual([]);
      expect(EVERY_SEED.filter((s) => canopyAt(WINTER - 1, s, kind).deepen !== 1)).toEqual([]);
      const turned = EVERY_SEED.filter((s) => canopyAt(AUTUMN + 6, s, kind).turn === 1).length;
      const green = EVERY_SEED.filter((s) => canopyAt(AUTUMN + 6, s, kind).turn === 0).length;
      expect(turned).toBeGreaterThan(2000);
      expect(green).toBeGreaterThan(2000);
    }
  });

  it('keeps every value between 0 and 1', () => {
    const outside: string[] = [];
    for (const kind of KINDS) {
      for (const s of SEEDS) {
        for (const day of span(0, DAYS_PER_YEAR, HOUR)) {
          const canopy = canopyAt(day, s, kind);
          for (const field of FIELDS)
            if (!(canopy[field] >= 0 && canopy[field] <= 1))
              outside.push(`${kind} ${field} ${day}`);
        }
      }
    }
    expect(outside).toEqual([]);
  });

  it('changes without a jump across midnights, seasons and the new year', () => {
    const jumps: string[] = [];
    for (const kind of LEAFY) {
      for (const s of [0, 0.5, 10006 / 10007]) {
        let previous: Canopy | undefined;
        walkClock(0, DAYS_PER_YEAR + 1, (day, minutes) => {
          const next = canopyAt(yearDayAt(day, minutes), s, kind);
          const last = previous;
          previous = next;
          // A quick look first; only a step that moves something is checked field by field.
          if (!last || largestChange(last, next) <= SMOOTH) return;
          for (const field of FIELDS) {
            if (Math.abs(next[field] - last[field]) <= SMOOTH) continue;
            // Autumn colour resets for the new year while the tree is bare; nobody can see it.
            const hidden =
              (field === 'turn' || field === 'deepen') && last.dormant === 1 && next.dormant === 1;
            if (!hidden) jumps.push(`${kind} ${s} ${field} at ${day - EPOCH}, ${minutes}`);
          }
        });
      }
    }
    expect(jumps).toEqual([]);
  });

  it('carries a bare tree over the new year without a flicker', () => {
    const quiet = ({ dormant, snow, leaves, leafFall, blossom, petals }: Canopy) =>
      dormant === 1 && snow + leaves + leafFall + blossom + petals === 0;
    for (const kind of LEAFY) {
      const flickers = EVERY_SEED.filter(
        (s) => !quiet(canopyAt(DAYS_PER_YEAR - 1e-6, s, kind)) || !quiet(canopyAt(0, s, kind)),
      );
      expect(flickers).toEqual([]);
    }
    // The autumn colour resets underneath: a bare tree leafs out green in spring.
    expect(canopyAt(DAYS_PER_YEAR - 1e-6, 0.5, 'deciduous').turn).toBe(1);
    expect(canopyAt(0, 0.5, 'deciduous').turn).toBe(0);
  });

  // Like petals, the leaf carpet gathers only once leaves have started to come down.
  it('gathers fallen leaves as the leaves drift down, not before', () => {
    for (const kind of LEAFY) {
      for (const s of SEEDS) {
        const firstOf = (field: 'leaves' | 'leafFall') =>
          span(AUTUMN, WINTER, 0.01).find((day) => canopyAt(day, s, kind)[field] > 0);
        expect(firstOf('leaves')).toBeGreaterThanOrEqual(firstOf('leafFall')!);
      }
    }
  });
});

describe('Doorstep pumpkins', () => {
  it('come out from Autumn 5, never in spring or summer', () => {
    for (const s of SEEDS) {
      for (const day of span(0, AUTUMN + 4, HOUR)) expect(pumpkinOut(day, s)).toBe(false);
    }
    expect(EVERY_SEED.filter((s) => pumpkinOut(AUTUMN + 4 - 1e-6, s))).toEqual([]);
    // Every doorstep has one by Autumn 12, but they come out over a week.
    expect(EVERY_SEED.filter((s) => !pumpkinOut(AUTUMN + 11, s))).toEqual([]);
    const out = EVERY_SEED.filter((s) => pumpkinOut(AUTUMN + 7.5, s)).length;
    expect(out).toBeGreaterThan(2000);
    expect(out).toBeLessThan(8000);
  });

  it('go in with the first snow and stay in until next autumn', () => {
    for (const s of SEEDS) {
      let outings = 0;
      let inTheSnow = 0;
      let lastOut = -1;
      let firstSnow = Infinity;
      let wasOut = false;
      for (const day of span(0, DAYS_PER_YEAR, 1 / 1440)) {
        const out = pumpkinOut(day, s);
        if (out && !wasOut) outings++;
        if (out) lastOut = day;
        if (out && snowAt(day, s) > 0) inTheSnow++;
        if (snowAt(day, s) > 0) firstSnow = Math.min(firstSnow, day);
        wasOut = out;
      }
      expect(outings).toBe(1);
      expect(inTheSnow).toBe(0);
      // Taken in within a town hour of its first snow.
      expect(firstSnow - lastOut).toBeGreaterThan(0);
      expect(firstSnow - lastOut).toBeLessThan(HOUR);
    }
    expect(EVERY_SEED.filter((s) => pumpkinOut(WINTER + 2, s))).toEqual([]);
  });
});

describe('Fireflies', () => {
  it('come out only on summer nights', () => {
    for (let date = 0; date < DAYS_PER_YEAR; date++) {
      const day = EPOCH + date;
      expect(townSeasonAt(day, 720).fireflies).toBe(0);
      expect(townSeasonAt(day, 360).fireflies).toBe(0);
      // Not before the lamps are lit at 20:00.
      expect(townSeasonAt(day, 1199.5).fireflies).toBe(0);
      if (date >= SUMMER && date < AUTUMN) continue;
      for (let minutes = 0; minutes < 1440; minutes += 10)
        expect(townSeasonAt(day, minutes).fireflies).toBe(0);
    }
    expect(townSeasonAt(EPOCH + 42, 1320).fireflies).toBeGreaterThan(0.9);
    expect(townSeasonAt(EPOCH + 43, 120).fireflies).toBeGreaterThan(0.9);
    expect(firefliesAt(42 + 1320 / 1440, 1320)).toBeGreaterThan(0.9);
  });

  it('never blink on or off at once, at dusk, dawn or midnight', () => {
    for (let date = SUMMER - 1; date < AUTUMN + 1; date++) {
      const before = townSeasonAt(EPOCH + date, 1439.99).fireflies;
      const after = townSeasonAt(EPOCH + date + 1, 0).fireflies;
      expect(Math.abs(before - after)).toBeLessThan(1e-3);
    }
    expect(
      largestStep(SUMMER - 1, DAYS_PER_SEASON + 2, (day, m) => townSeasonAt(day, m).fireflies),
    ).toBeLessThan(SMOOTH);
  });

  it('stay between 0 and 1', () => {
    walkClock(SUMMER - 1, DAYS_PER_SEASON + 2, (day, minutes) => {
      if (minutes % 5) return;
      const { fireflies } = townSeasonAt(day, minutes);
      expect(fireflies).toBeGreaterThanOrEqual(0);
      expect(fireflies).toBeLessThanOrEqual(1);
    });
  });
});

describe('Falling snow', () => {
  it('falls only in winter', () => {
    for (let year = -3; year <= 3; year++) {
      for (let date = 0; date < WINTER; date++) {
        const day = EPOCH + year * DAYS_PER_YEAR + date;
        for (let minutes = 0; minutes < 1440; minutes += 30) expect(flurryAt(day, minutes)).toBe(0);
      }
    }
  });

  it('brings the first snow on Winter 1, every year', () => {
    for (let year = -20; year <= 20; year++)
      expect(heaviestFlurry(EPOCH + year * DAYS_PER_YEAR + WINTER)).toBeGreaterThan(0.5);
  });

  it('has a quiet flurry of a few town hours on about one winter day in four', () => {
    const winters = snowyWinterDays(-20, 40);
    const snowy = winters.flat().filter(Boolean).length;
    const share = snowy / (winters.length * DAYS_PER_SEASON);
    expect(share).toBeGreaterThan(0.18);
    expect(share).toBeLessThan(0.32);
    const flurries: { heaviest: number; minutes: number }[] = [];
    for (let year = 0; year < 4; year++) {
      for (let date = 2; date < DAYS_PER_SEASON; date++) {
        const day = EPOCH + year * DAYS_PER_YEAR + WINTER + date;
        let heaviest = 0;
        let minutesFalling = 0;
        for (let minutes = 0; minutes < 1440; minutes++) {
          const flurry = flurryAt(day, minutes);
          heaviest = Math.max(heaviest, flurry);
          if (flurry > 0.3) minutesFalling++;
        }
        if (heaviest > 0) flurries.push({ heaviest, minutes: minutesFalling });
      }
    }
    expect(flurries.length).toBeGreaterThan(8);
    for (const flurry of flurries) {
      // Quieter than the first snow, and a few town hours long.
      expect(flurry.heaviest).toBeLessThan(0.9);
      expect(flurry.minutes).toBeGreaterThan(120);
      expect(flurry.minutes).toBeLessThan(480);
    }
  });

  it('never falls on a thawing town', () => {
    for (let year = -10; year <= 10; year++) {
      for (let date = 23; date < DAYS_PER_SEASON; date++)
        expect(heaviestFlurry(EPOCH + year * DAYS_PER_YEAR + WINTER + date)).toBe(0);
    }
  });

  it('differs from one year to the next', () => {
    const patterns = snowyWinterDays(0, 10).map((days) => days.map(Number).join(''));
    expect(new Set(patterns).size).toBeGreaterThanOrEqual(6);
  });

  it('drifts in and out without a jump, and stays between 0 and 1', () => {
    for (const year of [0, 1, 7]) {
      const from = year * DAYS_PER_YEAR + WINTER - 1;
      expect(largestStep(from, DAYS_PER_SEASON + 2, flurryAt)).toBeLessThan(SMOOTH);
      walkClock(from, DAYS_PER_SEASON + 2, (day, minutes) => {
        if (minutes % 5) return;
        const flurry = flurryAt(day, minutes);
        expect(flurry).toBeGreaterThanOrEqual(0);
        expect(flurry).toBeLessThanOrEqual(1);
      });
    }
  });

  // FNV-1a's lowest two bits depend only on the lowest two bits of each character, so picking
  // days with `hash(key) % 4` put flurries on a near-fixed four-day beat (about 60% of gaps were
  // exactly 4 days). A fair one-in-four draw leaves about 11% of gaps at 4 days.
  it('scatters flurry days instead of falling on a fixed beat', () => {
    const gaps: number[] = [];
    for (const days of snowyWinterDays(-20, 40)) {
      const flurryDays = days.map((snowy, date) => (snowy && date >= 2 ? date : -1));
      const dates = flurryDays.filter((date) => date >= 0);
      for (let i = 1; i < dates.length; i++) gaps.push(dates[i] - dates[i - 1]);
    }
    const fourDays = gaps.filter((gap) => gap === 4).length / gaps.length;
    expect(fourDays).toBeLessThan(0.3);
  });
});

describe('A deterministic year', () => {
  const almanac = (model: typeof import('../src/lib/seasons')) => {
    const moments = [
      [EPOCH, 0],
      [EPOCH + 9, 612.5],
      [EPOCH + 42, 1320],
      [EPOCH + 63, 450],
      [EPOCH + WINTER, 1152],
      [EPOCH + 95, 800],
      [EPOCH - 300, 1439.999],
      [EPOCH + 5000, 77],
    ];
    return moments.map(([day, minutes]) => {
      const season = model.townSeasonAt(day, minutes);
      const s = model.seedFraction(`tree:${day}`);
      return {
        season,
        seed: s,
        canopies: KINDS.map((kind) => model.canopyAt(season.yearDay, s, kind)),
        snow: model.snowAt(season.yearDay, s),
        pumpkin: model.pumpkinOut(season.yearDay, s),
        flurry: model.flurryAt(day, minutes),
        fireflies: model.firefliesAt(season.yearDay, minutes),
      };
    });
  };

  it('gives the same answers to the same questions, whatever was asked before', async () => {
    const model = await import('../src/lib/seasons');
    const first = almanac(model);
    for (let day = EPOCH - 50; day < EPOCH + 200; day += 7) townSeasonAt(day, day % 1440);
    expect(almanac(model)).toEqual(first);
  });

  it('gives the same answers on a fresh import', async () => {
    const before = almanac(await import('../src/lib/seasons'));
    vi.resetModules();
    const fresh = await import('../src/lib/seasons');
    expect(almanac(fresh)).toEqual(before);
  });

  it('seeds schedules with stable fractions in [0, 1)', () => {
    const keys = Array.from({ length: 4000 }, (_, i) => `tree:${i % 80},${Math.floor(i / 80)}`);
    const fractions = keys.map(seedFraction);
    expect(fractions.every((f) => f >= 0 && f < 1)).toBe(true);
    expect(keys.map(seedFraction)).toEqual(fractions);
    expect(seedFraction('')).toBe(seedFraction(''));
    // Spread over the whole range, so neighbours do not all turn on the same day.
    for (let quarter = 0; quarter < 4; quarter++) {
      const inQuarter = fractions.filter((f) => Math.floor(f * 4) === quarter).length;
      expect(inQuarter / fractions.length).toBeGreaterThan(0.2);
    }
    expect(new Set(fractions).size).toBeGreaterThan(3000);
  });
});
