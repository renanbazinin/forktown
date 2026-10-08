// Every greeting is said for its whole spell or not at all, whoever else is in town: a bubble
// another one (or a heart for the ducklings) keeps unsaid stays unsaid when that one moves on,
// and one that is said never gives way halfway. First in small staged meetings, then in the
// frozen town with a newcomer's house on plots where the town once cut a greeting short.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DUCK_STREET_Y } from '../src/lib/ducks';
import { HOUSE_PLOTS } from '../src/lib/events';
import * as homeLife from '../src/lib/home-life';
import * as trips from '../src/lib/resident-trips';
import { placeSchema, type Place } from '../src/lib/schema';
import * as errands from '../src/lib/seasonal-errands';
import { GREETING_MINUTES, simulateResidents } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { hash, type Point } from '../src/lib/world';
import { FUNKY_FUN } from './fixtures';
import { fullTown, fullTownHouse } from './full-town';
import { rosterTimeout } from './roster-timeout';

afterEach(() => vi.restoreAllMocks());

/** Twenty frames a town minute, as the town-sim test watches greetings. */
const STEP = 0.05;
type Said = { id: string; from: number; to: number };
/** Every greeting said from `from` to `to`, frame by frame: whose, and its first and last frames. */
function greetingsSaid(homes: Place[], from: number, to: number, day: number): Said[] {
  const said: Said[] = [];
  const open = new Map<string, number>();
  for (let frame = 0; from + frame * STEP < to; frame++) {
    const minute = from + frame * STEP;
    for (const state of simulateResidents(homes, minute, day)) {
      const started = open.get(state.id);
      if (state.greeting && started === undefined) open.set(state.id, minute);
      if (!state.greeting && started !== undefined) {
        said.push({ id: state.id, from: started, to: minute });
        open.delete(state.id);
      }
    }
  }
  for (const [id, started] of open) said.push({ id, from: started, to });
  return said;
}

describe('A greeting held up by another', () => {
  // Staged meetings at 10:00, beat 120, whose turn goes to the first of each pair by id.
  const BEAT = 120;
  const GREETING = 'Good morning, neighbour!';
  /** Two ids whose pair may greet this beat (one pair in three does). */
  const pairIds = (name: string) => {
    for (let n = 0; ; n++) {
      const [first, second] = [`${name}-${n}-a`, `${name}-${n}-b`];
      if (hash(`${first}:${second}:${BEAT}`) % 3 === 0) return [first, second] as const;
    }
  };
  type Stand = {
    at: Point;
    /** Through their door (so not free to talk) before `from` and from `until`. */
    from?: number;
    until?: number;
    greeting?: string;
    /** Stopped to admire the ducklings over these minutes. */
    love?: [number, number];
  };
  /** Neighbors who stand still where they are told, with no trips or errands that day. */
  function staged(stands: Record<string, Stand>) {
    vi.spyOn(trips, 'residentTrips').mockReturnValue(new Map());
    vi.spyOn(errands, 'residentErrands').mockReturnValue(new Map());
    vi.spyOn(homeLife, 'planAt').mockImplementation((plan, minute) => {
      // A home's plan is keyed by its id first.
      const stand = stands[plan.key.split('|')[0]];
      const loving = stand.love && minute >= stand.love[0] && minute < stand.love[1];
      return {
        indoors: false,
        position: stand.at,
        moving: false,
        facing: 'se',
        walkPhase: 0,
        ...(minute < (stand.from ?? 0) || minute >= (stand.until ?? Infinity) ? { fade: 0.5 } : {}),
        ...(loving ? { duckLove: true } : {}),
      };
    });
    const plots = ['B2', 'B3', 'B4', 'C2', 'C3', 'C4', 'D2'];
    return Object.entries(stands).map(([id, stand], index) =>
      placeSchema.parse({
        ...FUNKY_FUN,
        id,
        plot: plots[index],
        resident: { ...FUNKY_FUN.resident, greeting: stand.greeting ?? GREETING },
      }),
    );
  }
  const [a1, a2] = pairIds('greeting-a');
  const [b1, b2] = pairIds('greeting-b');

  it('stays unsaid for the whole spell when an earlier bubble it would cover moves on', () => {
    // One pair talks from 10:00 to 10:02; a second, whose bubbles would cover the first's from
    // anywhere they stand (they stand together, three tiles across the screen from it), meets at
    // 10:00:30 until 10:03. It used to speak up at 10:02 for the minute left.
    const homes = staged({
      [a1]: { at: { x: 10, y: 10 } },
      [a2]: { at: { x: 10, y: 10 }, until: 602.05 },
      [b1]: { at: { x: 11.5, y: 8.5 } },
      [b2]: { at: { x: 11.5, y: 8.5 }, from: 600.45, until: 603.05 },
    });
    const said = greetingsSaid(homes, 600, 605, CALENDAR_EPOCH_DAY);
    expect(said.map(({ id }) => id)).toEqual([a1]);
    expect(said[0].to - said[0].from).toBeGreaterThan(GREETING_MINUTES);
  });

  it('lets the other of the pair speak for the whole spell, never handing over halfway', () => {
    // The second pair's first speaker would cover the earlier bubble; the other, a step further
    // off with a short greeting, would not. It used to say the first part, then hand over at 10:02.
    const homes = staged({
      [a1]: { at: { x: 10, y: 10 } },
      [a2]: { at: { x: 10, y: 10 }, until: 602.05 },
      [b1]: { at: { x: 11.5, y: 8.5 } },
      [b2]: { at: { x: 12.2, y: 7.8 }, from: 600.45, until: 603.05, greeting: 'Hi!' },
    });
    const said = greetingsSaid(homes, 600, 605, CALENDAR_EPOCH_DAY);
    expect(said.map(({ id }) => id).sort()).toEqual([a1, b2].sort());
    const second = said.find(({ id }) => id === b2)!;
    // From the first look of their spell to the last that found them in range.
    expect(second.from).toBeCloseTo(600.5, 5);
    expect(second.to).toBeCloseTo(603, 5);
  });

  it('stays unsaid when a heart for the ducklings would come up under it partway', () => {
    // On the duck street in the ducks' hours: a neighbor steps out at 10:01 and stops to admire
    // the ducklings right beside a pair who talk from 10:00 to 10:03. It used to be cut at 10:01.
    const street = DUCK_STREET_Y;
    const [c1, c2] = pairIds('greeting-c');
    const homes = staged({
      [c1]: { at: { x: 20, y: street } },
      [c2]: { at: { x: 20, y: street }, until: 603.05 },
      lover: { at: { x: 20.75, y: street - 0.75 }, from: 601, love: [601, 605] },
    });
    expect(greetingsSaid(homes, 600, 605, CALENDAR_EPOCH_DAY)).toEqual([]);
  });
});

describe('Greetings in the frozen town with one newcomer', () => {
  // Today's 30 houses, frozen in October 2026, and a newcomer as the builder saves one by
  // default: named after a neighbor who is already here, out on a stroll in every period. Each
  // town is the full town around them, every other plot taken, on a day of the third town year.
  const frozen = JSON.parse(readFileSync('tests/fixtures/town-2026-10.json', 'utf8')) as unknown[];
  const DAY = CALENDAR_EPOCH_DAY + 224 + 42;
  const town = (plot: string): Place[] => {
    const made = fullTownHouse(plot);
    const newcomer = {
      ...made,
      id: 'a-new-home',
      name: 'My Little Place',
      creator: 'sweep-newcomer',
      resident: {
        ...made.resident,
        name: 'New neighbor',
        routine: { morning: 'stroll', afternoon: 'stroll', evening: 'stroll', night: 'stroll' },
      },
    };
    return fullTown([newcomer, ...frozen].map((data) => placeSchema.parse(data)));
  };
  /** How long each greeting begun and finished between `from` and `to` was said for. */
  const lengths = (plot: string, from: number, to: number) =>
    greetingsSaid(town(plot), from, to, DAY)
      .filter((said) => said.from > from && said.to < to)
      .map((said) => said.to - said.from);

  it(
    'says each greeting for its whole spell with a newcomer on L4 or N3',
    () => {
      // On N3 a greeting near the newcomer's walk at 16:12 was held up by theirs, then said for
      // its last half minute; on L4 (with five more houses) for its last 1.4 minutes.
      for (const plot of ['L4', 'N3']) {
        const said = lengths(plot, 960, 990);
        expect(said.length).toBeGreaterThan(2);
        for (const length of said) expect(length).toBeGreaterThan(GREETING_MINUTES - STEP - 1e-6);
      }
    },
    rosterTimeout(60, 30_000),
  );

  it(
    'settles each greeting the same whatever was asked before',
    () => {
      // Frame by frame up to and through a busy stretch, then the same minutes asked of a fresh
      // copy of the town out of order: who speaks never depends on what is cached.
      const homes = town('N3');
      const minutes = Array.from({ length: 41 }, (_, i) => 968 + i * 0.25);
      const speakers = (roster: Place[], minute: number) =>
        simulateResidents(roster, minute, DAY)
          .filter((state) => state.greeting)
          .map((state) => state.id);
      for (let minute = 960; minute < 968; minute += STEP) speakers(homes, minute);
      const inOrder = minutes.map((minute) => speakers(homes, minute));
      const copy = structuredClone(homes);
      const outOfOrder = [...minutes].reverse().map((minute) => speakers(copy, minute));
      expect(outOfOrder.reverse()).toEqual(inOrder);
      expect(inOrder.flat().length).toBeGreaterThan(10);
    },
    rosterTimeout(60, 30_000),
  );

  it(
    'says each greeting for its whole spell wherever the newcomer moves in',
    () => {
      // Twelve free plots across the map, each watched for its own 40 minutes of 10:00 to 18:00.
      const taken = new Set(frozen.map((data) => placeSchema.parse(data).plot));
      const free = HOUSE_PLOTS.filter((plot) => !taken.has(plot.id));
      const all: number[] = [];
      for (let i = 0; i < 12; i++) {
        const plot = free[Math.floor(((i + 0.5) * free.length) / 12)].id;
        all.push(...lengths(plot, 600 + 40 * i, 640 + 40 * i));
      }
      expect(all.length).toBeGreaterThan(50);
      for (const length of all) expect(length).toBeGreaterThan(GREETING_MINUTES - STEP - 1e-6);
    },
    rosterTimeout(400, 120_000),
  );
});
