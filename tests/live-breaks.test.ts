import { describe, expect, it } from 'vitest';
import { BREAK_CARDS, LIVE_BREAK_ADS } from '../src/lib/break-cards';
import { CINEMA_VENUE } from '../src/lib/cinema';
import { eventsForDay } from '../src/lib/events';
import { FORK_NAME } from '../src/lib/lanterns';
import {
  activeBreak,
  breakAt,
  BREAK_MOUNT_GRACE_MS,
  breakItemForSlot,
  breakOpacity,
  breakPool,
  breakSeconds,
  calendarAt,
  comingUpAt,
  DEFAULT_BREAK_MINUTES,
  itemKey,
  nextBreakAfter,
  protectedMoments,
  quietFor,
  scheduledBreak,
  spotlightFor,
  spotlightHouse,
  welcomeShotAt,
  welcomeTimeline,
  type BreakItem,
  type ScheduledBreak,
  type WelcomeStep,
} from '../src/lib/live-breaks';
import {
  liveDistrictShots,
  liveHighlights,
  liveProgram,
  liveShotAt,
} from '../src/lib/live-director';
import { simulateResidents, timeLabel } from '../src/lib/simulation';
import { townCalendarAt } from '../src/lib/town-calendar';
import { TOWN_DAY_MS, townDayAt, townMinutesAt, UTC_DAY_MS } from '../src/lib/town-time';
import { getPlot, plotCenter } from '../src/lib/world';
import {
  ARTS,
  BAZPLACE,
  EVERGREEN,
  FUNKY_FUN,
  HELLO_WORLD,
  HOMES,
  JONS_ARCADE,
  MOONBEAM_CAFE,
} from './fixtures';
import { readPlaces } from './full-town';

// Every fixture is explicit: a fixed UTC midnight, the fixture homes, and hand-written arrivals
// and dates, so nothing here leans on Git history or on how many houses the town has today.
const T0 = Date.UTC(2026, 8, 29);
const DAY0 = townDayAt(T0);
const SLOT_30 = DEFAULT_BREAK_MINUTES * 60_000;
const at = (day: number, minute: number) => day * TOWN_DAY_MS + minute * 1000;
const clear = (windows: readonly { start: number; end: number }[], start: number, end: number) =>
  !windows.some((window) => window.start < end && window.end > start);
/** The first town day from DAY0 whose broadcast highlights pass `test`. */
function dayWith(test: (highlights: string[]) => boolean) {
  for (let day = DAY0; day < DAY0 + 400; day++) if (test(liveHighlights(day))) return day;
  throw new Error('No such day');
}
const founders = HOMES.filter((place) => place.creator === 'forktown');
const neighbors = HOMES.filter((place) => place.creator !== 'forktown');

describe('The pick', () => {
  it('airs each item once per cycle and never twice in a row, whatever the registry order', () => {
    const pool = breakPool();
    const n = pool.length;
    expect(n).toBe(LIVE_BREAK_ADS.length + 2);
    const keys = pool.map(itemKey).sort();
    expect(new Set(keys).size).toBe(n);
    const reversed = [...pool].reverse();
    const first = n * Math.floor(T0 / SLOT_30 / n);
    const problems: string[] = [];
    let previous = '';
    let cycle: string[] = [];
    for (let slot = first; slot < first + 20_000; slot++) {
      const key = itemKey(breakItemForSlot(slot));
      if (key === previous) problems.push(`${slot} repeats ${key}`);
      if (itemKey(breakItemForSlot(slot, reversed)) !== key) problems.push(`${slot} order`);
      cycle.push(key);
      if (cycle.length === n) {
        if (cycle.sort().join() !== keys.join()) problems.push(`${slot} not a permutation`);
        cycle = [];
      }
      previous = key;
    }
    expect(problems).toEqual([]);
  });
});

describe('The schedule', () => {
  it('defers each break within its own slot, exactly as a brute-force scan would', () => {
    const span = 2 * UTC_DAY_MS;
    const moments = protectedMoments(T0 - TOWN_DAY_MS, T0 + span + TOWN_DAY_MS, HOMES);
    for (const minutes of [1, 2, 3, 5, 30, 120]) {
      const slotMs = minutes * 60_000;
      const first = T0 / slotMs;
      expect(Number.isInteger(first)).toBe(true);
      const breaks: ScheduledBreak[] = [];
      const problems: string[] = [];
      for (let slot = first; slot < first + span / slotMs; slot++) {
        const found = scheduledBreak(slot, HOMES, minutes);
        const item = breakItemForSlot(slot);
        const length = breakSeconds(item) * 1000;
        const steps = Math.min(120, Math.floor((slotMs - length - 5000) / 5000));
        let expected: number | null = null;
        for (let k = 0; k <= steps && expected === null; k++) {
          const t = slot * slotMs + k * 5000;
          if (clear(moments, t - 2000, t + length + 3000)) expected = t;
        }
        if ((found?.start ?? null) !== expected) problems.push(`${minutes}:${slot} start`);
        if (!found) continue;
        breaks.push(found);
        if (found.key !== `break:${slot}` || found.slot !== slot) problems.push(`${slot} key`);
        if (itemKey(found.item) !== itemKey(item)) problems.push(`${slot} item`);
        if (found.end !== found.start + length) problems.push(`${slot} length`);
        if (found.start < slot * slotMs || found.end > (slot + 1) * slotMs)
          problems.push(`${minutes}:${slot} leaves its slot`);
        if (!clear(moments, found.start - 2000, found.end + 3000))
          problems.push(`${minutes}:${slot} meets a moment`);
      }
      expect(problems).toEqual([]);
      expect(breaks.length).toBeGreaterThan(0);
      for (let i = 1; i < breaks.length; i++)
        expect(breaks[i].start).toBeGreaterThanOrEqual(breaks[i - 1].end);

      // breakAt against a scan of every break, at a prime step and at every edge.
      const samples: number[] = [];
      for (let ms = T0; ms < T0 + span; ms += 997) samples.push(ms);
      for (const found of breaks)
        samples.push(found.start - 1, found.start, found.end - 1, found.end);
      // The breaks are in order and never overlap, so one pointer walks them with the samples.
      let next = 0;
      const wrong = samples
        .sort((a, b) => a - b)
        .filter((ms) => {
          while (next < breaks.length && breaks[next].end <= ms) next++;
          const candidate = breaks[next];
          const expected = candidate && ms >= candidate.start ? candidate : null;
          const actual = breakAt(ms, HOMES, minutes);
          return actual?.key !== expected?.key || actual?.start !== expected?.start;
        });
      expect(wrong).toEqual([]);

      // nextBreakAfter is the first break that starts later.
      for (let i = 0; i + 1 < breaks.length; i += Math.max(1, Math.floor(breaks.length / 40))) {
        expect(nextBreakAfter(breaks[i].start, HOMES, minutes)).toEqual(breaks[i + 1]);
        expect(nextBreakAfter(breaks[i + 1].start - 1, HOMES, minutes)).toEqual(breaks[i + 1]);
      }
    }
  });

  it('lands the half-hour breaks on 00:00, 06:00, 12:00 and 18:00 and steps round the shows', () => {
    const seen = new Set<string>();
    const first = T0 / SLOT_30;
    for (let slot = first; slot < first + (10 * UTC_DAY_MS) / SLOT_30; slot++) {
      const start = slot * SLOT_30;
      const day = townDayAt(start);
      const minute = townMinutesAt(start);
      const today = liveHighlights(day);
      let delay: number;
      let label: string;
      if (minute === 0) {
        // A featured disco runs to 02:30 (minute 150): clear two seconds later, on the 5 s grid.
        // A film night's stars run to 00:15 (live-director's FILM_NIGHT_SHOTS): 00:20.
        const disco = liveHighlights(day - 1).includes('night');
        const stars = liveDistrictShots(day - 1).some((shot) => shot.to > 1440);
        [delay, label] = disco
          ? [155, 'after the disco']
          : stars
            ? [20, 'after the stars']
            : [0, 'midnight'];
      } else if (minute === 360) {
        [delay, label] = [5, 'after the postcard'];
      } else if (minute === 720) {
        const football = today.includes('football');
        const afternoon = today.includes('afternoon');
        // The match ends at 780; with the afternoon the zoo runs on to 1020.
        [delay, label] = !football
          ? [0, 'noon']
          : afternoon
            ? [305, 'after the zoo']
            : [65, 'after the match'];
      } else {
        expect(minute).toBe(1080);
        [delay, label] = [0, 'dusk'];
      }
      seen.add(label);
      expect(scheduledBreak(slot, HOMES)?.start, `${label} ${slot}`).toBe(start + delay * 1000);
    }
    expect([...seen].sort()).toEqual(
      [
        'after the disco',
        'after the stars',
        'midnight',
        'after the postcard',
        'noon',
        'after the zoo',
        'after the match',
        'dusk',
      ].sort(),
    );
  });

  it('protects every shot the director puts on air', () => {
    // Enough days to feature all six highlights, every minute of each.
    const days: number[] = [];
    const covered = new Set<string>();
    for (let day = DAY0; covered.size < 6; day++) {
      const fresh = liveHighlights(day).filter((highlight) => !covered.has(highlight));
      if (!fresh.length) continue;
      fresh.forEach((highlight) => covered.add(highlight));
      days.push(day);
    }
    const unprotected: string[] = [];
    for (const day of days) {
      const program = liveProgram(HOMES, day);
      const moments = protectedMoments(at(day, 0), at(day + 1, 0), HOMES);
      for (let minute = 0; minute < 1440; minute++) {
        const shot = liveShotAt(program, minute, simulateResidents(HOMES, minute, day));
        const guarded =
          shot.kind === 'event' ||
          shot.kind === 'ducks' ||
          shot.kind === 'lanterns' ||
          shot.id.startsWith('postcard:');
        const ms = at(day, minute);
        if (guarded && clear(moments, ms, ms + 1)) unprotected.push(`${day}:${minute} ${shot.id}`);
      }
    }
    expect(unprotected).toEqual([]);
  });

  it('counts moments and the welcome, but not scheduled breaks, as noise', () => {
    const day = dayWith((highlights) => highlights.includes('evening'));
    expect(quietFor(at(day, 1100), 30, HOMES)).toBe(true);
    expect(quietFor(at(day, 1100), 45, HOMES)).toBe(false);
    expect(quietFor(at(day, 1150), 1, HOMES)).toBe(false);
    expect(quietFor(at(day, 1150), 0, HOMES)).toBe(false);
    // The postcard is every day; an empty town still has one.
    expect(quietFor(at(day, 330), 5, [])).toBe(false);
    const step: WelcomeStep = {
      kind: 'hold',
      start: at(day, 1110),
      end: at(day, 1120),
      house: spotlightHouse(ARTS.id, HOMES, [], {})!,
    };
    expect(quietFor(at(day, 1100), 30, HOMES, [step])).toBe(false);
    expect(quietFor(at(day, 1100), 9, HOMES, [step])).toBe(true);
    // A scheduled break is covered by the reel, so it never makes the town noisy.
    const found = [...Array(96).keys()]
      .map((k) => scheduledBreak(T0 / SLOT_30 + k, HOMES))
      .find((found) => found && quietFor(found.start - 5000, 1, HOMES))!;
    expect(quietFor(found.start, breakSeconds(found.item), HOMES)).toBe(true);
  });
});

describe('Coming up', () => {
  it('bills the concert, lantern hour and the films at 18:00, never the lanterns’ 19:58', () => {
    const day = dayWith((h) => h.includes('evening') && h.includes('cinema'));
    const rows = comingUpAt(at(day, 1080), HOMES);
    const evening = eventsForDay(day)[1];
    expect(rows).toEqual([
      {
        title: evening.name,
        place: evening.venue.name,
        townTime: '19:00',
        startsAt: at(day, 1140),
      },
      { title: 'Lantern hour', place: FORK_NAME, townTime: '20:00', startsAt: at(day, 1200) },
      {
        title: 'Films under the stars',
        place: CINEMA_VENUE.name,
        townTime: '20:30',
        startsAt: at(day, 1230),
      },
    ]);
    // No homes, no lanterns to bill.
    expect(comingUpAt(at(day, 1080), []).map((row) => row.title)).not.toContain('Lantern hour');
    expect(comingUpAt(at(day, 1080), HOMES, 1)).toEqual(rows.slice(0, 1));
  });

  it('rolls over midnight to the next day’s shows, in order', () => {
    const day = dayWith((h) => h.includes('night'));
    const ms = at(day, 1430);
    const rows = comingUpAt(ms, HOMES);
    expect(rows).toHaveLength(3);
    // The disco began at 23:30, so it is no longer coming up.
    expect(rows.map((row) => row.title)).not.toContain('Midnight at the Little Stage');
    for (const row of rows) expect(townDayAt(row.startsAt)).toBe(day + 1);
    const tomorrow = liveHighlights(day + 1);
    // Tomorrow's market (09:30) leads whenever the lineup films it and someone is there.
    const market = liveDistrictShots(day + 1).find((shot) => shot.outing === 'market');
    const shows = market && rows[0].title === market.label ? rows.slice(1) : rows;
    if (shows !== rows) expect(rows[0].townTime).toBe('09:30');
    const opener = tomorrow.includes('ducks')
      ? '10:00'
      : tomorrow.includes('football')
        ? '10:40'
        : tomorrow.includes('afternoon')
          ? '13:00'
          : tomorrow.includes('evening')
            ? '19:00'
            : '20:00';
    expect(shows[0].townTime).toBe(opener);
  });

  it('lists only later moments, soonest first, and never the postcard', () => {
    const problems: string[] = [];
    for (let ms = T0; ms < T0 + 3 * TOWN_DAY_MS; ms += 7_001) {
      const rows = comingUpAt(ms, HOMES);
      if (rows.length !== 3) problems.push(`${ms} length`);
      rows.forEach((row, i) => {
        if (row.startsAt <= ms) problems.push(`${ms} past`);
        if (i && row.startsAt < rows[i - 1].startsAt) problems.push(`${ms} order`);
        if (row.townTime !== timeLabel(townMinutesAt(row.startsAt))) problems.push(`${ms} time`);
        if (row.townTime === '05:00') problems.push(`${ms} postcard`);
      });
    }
    expect(problems).toEqual([]);
  });

  it('reads the calendar at the moment asked', () => {
    const ms = at(DAY0 + 3, 700);
    const calendar = townCalendarAt(DAY0 + 3, 700);
    expect(calendarAt(ms)).toEqual({
      label: calendar.label,
      season: calendar.season,
      moonName: calendar.moonName,
      moonPhase: calendar.moonPhase,
    });
  });
});

describe('Meet the neighbors', () => {
  const n = breakPool().length;
  it('walks the neighbors in id order, one house per cycle, leaving founders out', () => {
    const order = neighbors.map((place) => place.id).sort();
    expect(order.length).toBeGreaterThanOrEqual(3);
    for (let cycle = 0; cycle < 3 * order.length; cycle++)
      for (const offset of [0, 5, n - 1]) {
        const house = spotlightFor(cycle * n + offset, HOMES, [], {});
        expect(house?.place.id).toBe(order[cycle % order.length]);
        expect(house?.founder).toBe(false);
      }
  });

  it('lets founders fill in while fewer than three neighbors live here', () => {
    const town = [HELLO_WORLD, BAZPLACE, EVERGREEN, ARTS];
    const walk = [0, 1, 2, 3, 4].map((cycle) => spotlightFor(cycle * n, town, [], {})?.place.id);
    expect(walk).toEqual(['arts', 'bazplace', 'evergreen', 'hello-world', 'arts']);
    expect(spotlightFor(0, [], [], {})).toBeNull();
  });

  it('covers every house of the real town once per pass', () => {
    const places = readPlaces();
    const pass = places.filter((place) => place.creator !== 'forktown');
    const expected = (pass.length >= 3 ? pass : places).map((place) => place.id).sort();
    const walked = expected.map(
      (_, cycle) => spotlightFor(cycle * n + 3, places, [], {})!.place.id,
    );
    expect([...walked].sort()).toEqual(expected);
    expect(new Set(walked).size).toBe(walked.length);
  });

  it('tells when a neighbor moved in and which lantern is theirs, only when it’s known', () => {
    const arrivals = ['funky-fun', 'arts', 'gone-away', 'bazplace', 'jons-arcade'];
    const dates = {
      'funky-fun': '2026-09-29T18:29:00+03:00',
      [EVERGREEN.id]: '2026-09-20T10:00:00Z',
      arts: 'not a date',
    };
    const fun = spotlightHouse(FUNKY_FUN.id, HOMES, arrivals, dates)!;
    expect(fun.place).toBe(FUNKY_FUN);
    expect(fun.founder).toBe(false);
    expect(fun.movedIn).toBe(
      townCalendarAt(townDayAt(Date.parse('2026-09-29T18:29:00+03:00'))).label,
    );
    expect(fun.lantern).toBe(`LANTERN No. ${HOMES.length} OF ${HOMES.length}`);
    expect(spotlightHouse(JONS_ARCADE.id, HOMES, arrivals, dates)!.lantern).toBe(
      `LANTERN No. ${founders.length + 1} OF ${HOMES.length}`,
    );
    expect(spotlightHouse('arts', HOMES, arrivals, dates)!.movedIn).toBeNull();
    const founder = spotlightHouse(EVERGREEN.id, HOMES, arrivals, dates)!;
    expect(founder).toMatchObject({ founder: true, movedIn: null, lantern: 'FOUNDING LANTERN' });
    // Without history nothing is claimed.
    expect(spotlightHouse(ARTS.id, HOMES, [], {})).toMatchObject({ movedIn: null, lantern: null });
    expect(spotlightHouse('nobody', HOMES, arrivals, dates)).toBeNull();
  });
});

describe('The welcome', () => {
  const ids = ['funky-fun', 'arts', 'bazplace'];
  const known = (list: string[]) =>
    list.filter((id) => neighbors.some((place) => place.id === id)).slice(0, 3);

  /** What welcomeTimeline should return, from a plain scan of moments and breaks. */
  function expected(list: string[], earliest: number, minutes: number | null) {
    const windows: { start: number; end: number }[] = protectedMoments(
      earliest - 10_000,
      earliest + 700_000,
      HOMES,
    );
    if (minutes)
      for (let slot = Math.floor((earliest - 10_000) / (minutes * 60_000)); ; slot++) {
        if (slot * minutes * 60_000 > earliest + 700_000) break;
        const found = scheduledBreak(slot, HOMES, minutes);
        if (found) windows.push(found);
      }
    const placed: [string, number][] = [];
    let from = earliest;
    for (const id of known(list))
      for (let t = from; t <= earliest + 600_000; t += 5000)
        if (clear(windows, t - 2000, t + 38_000)) {
          placed.push([id, t]);
          from = t + 35_000;
          break;
        }
    return { placed, windows };
  }

  function check(list: string[], earliest: number, minutes: number | null) {
    const steps = welcomeTimeline(list, earliest, HOMES, [], {}, minutes);
    const { placed, windows } = expected(list, earliest, minutes);
    const cards = steps.filter((step) => step.kind === 'card');
    const got = cards.map((step): [string, number] => [step.house.place.id, step.start]);
    const problems: string[] = [];
    if (JSON.stringify(got) !== JSON.stringify(placed)) problems.push(`${earliest} placement`);
    steps.forEach((step, i) => {
      if (step.kind !== (i % 2 ? 'hold' : 'card')) problems.push(`${earliest} kinds`);
      if (step.end - step.start !== (step.kind === 'card' ? 10_000 : 25_000))
        problems.push(`${earliest} length`);
      if (i % 2 && (step.start !== steps[i - 1].end || step.house !== steps[i - 1].house))
        problems.push(`${earliest} pair`);
      if (!clear(windows, step.start, step.end)) problems.push(`${earliest} meets`);
    });
    return { problems, dropped: known(list).length - cards.length };
  }

  it('never meets a moment or a scheduled break, over three days of reloads', () => {
    const problems: string[] = [];
    let placed = 0;
    for (let s = 0; s < 3 * 1440; s++) {
      const list = ids.slice(0, (s % 3) + 1);
      const result = check(list, T0 + s * 1000 + 17, s % 5 ? DEFAULT_BREAK_MINUTES : null);
      problems.push(...result.problems);
      placed += known(list).length - result.dropped;
    }
    expect(problems).toEqual([]);
    expect(placed).toBeGreaterThan(3 * 1440);
  });

  it('drops the houses that can’t start within ten minutes', () => {
    // With a break every minute the gaps are tight: some houses fit, some are left out.
    let dropped = 0;
    let shown = 0;
    const problems: string[] = [];
    for (let s = 0; s < 2 * 1440; s += 13) {
      const result = check(ids, T0 + s * 1000, 1);
      problems.push(...result.problems);
      dropped += result.dropped;
      shown += 3 - result.dropped;
    }
    expect(problems).toEqual([]);
    expect(dropped).toBeGreaterThan(0);
    expect(shown).toBeGreaterThan(0);
  });

  it('welcomes only known neighbors, at most three, in the order asked', () => {
    const list = ['nobody', 'arts', EVERGREEN.id, 'arts', 'bazplace', 'jons-arcade', 'funky-fun'];
    const day = dayWith((h) => !h.includes('ducks') && !h.includes('football'));
    const steps = welcomeTimeline(list, at(day, 400), HOMES, [], {}, null);
    expect(steps.filter((step) => step.kind === 'card').map((step) => step.house.place.id)).toEqual(
      ['arts', 'bazplace', 'jons-arcade'],
    );
    // A quiet morning: back to back from the earliest moment.
    expect(steps.map((step) => step.start - at(day, 400))).toEqual([
      0, 10_000, 35_000, 45_000, 70_000, 80_000,
    ]);
    expect(welcomeTimeline([EVERGREEN.id, 'nobody'], at(day, 400), HOMES, [], {}, 30)).toEqual([]);
  });

  it('doesn’t wait behind a break the freshly opened page will skip', () => {
    // A page that opens just before a slot's break never shows it, so the welcome goes first.
    for (let slot = Math.floor(T0 / 1_800_000); ; slot++) {
      const found = scheduledBreak(slot, HOMES, DEFAULT_BREAK_MINUTES);
      if (!found) continue;
      const mount = found.start - 10_000;
      const earliest = mount + 6000;
      if (!quietFor(earliest - 2000, 45, HOMES)) continue;
      const waits = welcomeTimeline(['arts'], earliest, HOMES, [], {}, DEFAULT_BREAK_MINUTES);
      const skips = welcomeTimeline(
        ['arts'],
        earliest,
        HOMES,
        [],
        {},
        DEFAULT_BREAK_MINUTES,
        mount,
      );
      expect(waits[0].start).toBeGreaterThanOrEqual(found.end);
      expect(skips[0].start).toBe(earliest);
      // A break the page will show still blocks it.
      const old = welcomeTimeline(
        ['arts'],
        earliest,
        HOMES,
        [],
        {},
        30,
        found.start - BREAK_MOUNT_GRACE_MS,
      );
      expect(old[0].start).toBeGreaterThanOrEqual(found.end);
      break;
    }
  });

  it('frames the new house for the card and the hold', () => {
    const [card, hold] = welcomeTimeline(['arts'], T0, HOMES, [], {}, null);
    const center = plotCenter(getPlot(ARTS.plot)!);
    const shot = welcomeShotAt(card);
    expect(shot).toEqual({
      id: 'welcome:arts',
      kind: 'home',
      label: `Welcome to ${ARTS.name}`,
      center: { x: center.x, y: center.y - 40 },
      width: 430,
      height: 320,
    });
    expect(shot.residentId).toBeUndefined();
    expect(welcomeShotAt(hold)).toBe(shot);
  });
});

describe('On air', () => {
  const slot0 = T0 / SLOT_30;
  const slots = [...Array(200).keys()].map((k) => slot0 + k);
  const breaks = slots.map((slot) => scheduledBreak(slot, HOMES)).filter((b) => b !== null);
  const found = breaks[0];
  const base = {
    places: HOMES,
    minutes: DEFAULT_BREAK_MINUTES as number | null,
    forced: null as { item: BreakItem; start: number } | null,
    welcome: [] as WelcomeStep[],
    mountedAt: found.start - 60_000,
    arrivals: [] as readonly string[],
    dates: {} as Record<string, string>,
  };

  it('shows the scheduled break, the same object every frame', () => {
    const active = activeBreak({ ...base, ms: found.start + 1000 });
    expect(active).toMatchObject({
      key: `break:${found.slot}`,
      start: found.start,
      end: found.end,
      source: 'scheduled',
    });
    expect(active!.item).toBe(found.item);
    expect(active!.data.now).toBe(found.start);
    expect(activeBreak({ ...base, ms: found.start + 1033 })).toBe(active);
    expect(activeBreak({ ...base, ms: found.start - 1 })).toBeNull();
    expect(activeBreak({ ...base, ms: found.end })).toBeNull();
    expect(activeBreak({ ...base, minutes: null, ms: found.start + 1000 })).toBeNull();
  });

  it('never opens a page in the middle of a break', () => {
    const ms = found.start + 3000;
    expect(
      activeBreak({ ...base, ms, mountedAt: found.start - BREAK_MOUNT_GRACE_MS }),
    ).not.toBeNull();
    expect(
      activeBreak({ ...base, ms, mountedAt: found.start - BREAK_MOUNT_GRACE_MS + 1 }),
    ).toBeNull();
    expect(activeBreak({ ...base, ms, mountedAt: found.start - 1000 })).toBeNull();
    expect(activeBreak({ ...base, ms, mountedAt: found.start + 2000 })).toBeNull();
  });

  it('puts a forced item first, then a welcome card, then the schedule', () => {
    const forced = {
      item: { kind: 'card', card: BREAK_CARDS['coming-up'] } as BreakItem,
      start: found.start + 500,
    };
    const house = spotlightHouse('arts', HOMES, [], {})!;
    const card: WelcomeStep = {
      kind: 'card',
      start: found.start - 4000,
      end: found.start + 6000,
      house,
    };
    const ms = found.start + 1000;
    const shown = activeBreak({ ...base, ms, forced, welcome: [card] })!;
    expect(shown).toMatchObject({
      key: 'forced:card:coming-up',
      source: 'forced',
      start: forced.start,
      end: forced.start + 12_000,
    });
    expect(shown.data.comingUp).toEqual(comingUpAt(forced.start, HOMES));
    expect(shown.data.calendar).toEqual(calendarAt(forced.start));
    const welcome = activeBreak({ ...base, ms, welcome: [card] })!;
    expect(welcome).toMatchObject({
      key: `welcome:arts:${card.start}`,
      source: 'welcome',
      start: card.start,
      end: card.end,
    });
    expect(welcome.item).toEqual({ kind: 'card', card: BREAK_CARDS.welcome });
    expect(welcome.data).toEqual({ now: card.start, house });
    // A welcome hold keeps the camera on the house: the break it meets yields.
    const hold: WelcomeStep = { ...card, kind: 'hold' };
    expect(activeBreak({ ...base, ms, welcome: [hold] })).toBeNull();
    // Before the forced item starts, the schedule still runs.
    expect(activeBreak({ ...base, ms: found.start + 100, forced })?.source).toBe('scheduled');
  });

  it('fills each card from the town at the moment it starts', () => {
    const neighborsBreak = breaks.find(
      (b) => b.item.kind === 'card' && b.item.card.card === 'neighbors',
    )!;
    const shown = activeBreak({ ...base, ms: neighborsBreak.start + 10, mountedAt: 0 })!;
    expect(shown.data.house?.place.id).toBe(
      spotlightFor(neighborsBreak.slot, HOMES, [], {})!.place.id,
    );
    const ad = breaks.find((b) => b.item.kind === 'ad')!;
    expect(activeBreak({ ...base, ms: ad.start + 10, mountedAt: 0 })!.data).toEqual({
      now: ad.start,
    });
    const newest = activeBreak({
      ...base,
      ms: found.start + 1000,
      forced: { item: { kind: 'card', card: BREAK_CARDS.welcome }, start: found.start },
      arrivals: [MOONBEAM_CAFE.id, 'jons-arcade', 'arts'],
    })!;
    expect(newest.data.house?.place.id).toBe('jons-arcade');
  });

  it('fades over 400 ms at each end', () => {
    const b = { start: 10_000, end: 22_000 };
    expect(
      [9000, 10_000, 10_200, 10_400, 16_000, 21_800, 22_000, 23_000].map((ms) =>
        breakOpacity(b, ms),
      ),
    ).toEqual([0, 0, 0.5, 1, 1, 0.5, 0, 0]);
  });
});
