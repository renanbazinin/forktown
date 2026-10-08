// The Riverside's outings across a town year (SPEC §6.3): seats, calendars, exclusivity, worth,
// headways, invariance, turn tickets, determinism, drafts, where guests stand and what they carry,
// the regatta's boats, the snowmen's builders and the real town's floors. Four towns are planned
// once for the whole year (tests/district.ts) and every year-scale check reads that plan.
import { beforeAll, describe, expect, it } from 'vitest';
import { cinemaGuests } from '../src/lib/cinema';
import {
  activeIndex,
  harvestDay,
  OUTING_TABLE,
  outingOn,
  regattaBoat,
  regattaDay,
  REGATTA_LAUNCH_EVERY,
  SNOWMAN_STAGES,
  starNight,
} from '../src/lib/district-calendar';
import { BANDSTAND_FURNITURE } from '../src/lib/district-places';
import { EVENT_SPOTS, eventsForDay, HOUSE_PLOTS } from '../src/lib/events';
import { millpondSkatingDay, SKATING } from '../src/lib/millpond';
import { OUTINGS, outingOf, SEAT_EXCLUDES, SEAT_ORDER, type SeatCall } from '../src/lib/outings';
import {
  eventApproach,
  eventTubeJourney,
  HEADWAY_SHIFT_MAX,
  planHome,
  planResidentTrips,
  REGATTA_HANDOVER,
  ticketRank,
  VENUE_GATE_HEADWAY,
  withPreview,
  type Candidate,
  type ResidentTrip,
} from '../src/lib/resident-trips';
import { placeSchema, type Place } from '../src/lib/schema';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY, townCalendarAt } from '../src/lib/town-calendar';
import { TUBE_DOOR_HEADWAY } from '../src/lib/tubes';
import { routeLength, WALK_SPEED, WORTH_THE_WALK } from '../src/lib/walking';
import { findPlotAt, hash } from '../src/lib/world';
import {
  callOf,
  guestsOf,
  LIVE_TOWN,
  routine,
  SAMPLE,
  TOWNS,
  YEAR,
  yearOf,
  type PlanDay,
  type TownName,
} from './district';
import { insideEventGround } from './event-ground';
import { rosterTimeout } from './roster-timeout';
import { onRoadOrTube, riding } from './tube-riders';

/** Each call's seats (SPEC §4.0.A): today's, then every Riverside outing's spots. */
const CAPACITY: Record<SeatCall, number> = {
  cinema: EVENT_SPOTS.cinema.length,
  'football-morning': 6,
  green: EVENT_SPOTS.green.length,
  zoo: EVENT_SPOTS.zoo.length,
  'football-afternoon': 6,
  millpond: 6,
  concert: EVENT_SPOTS.stage.length,
  'night-party': EVENT_SPOTS.stage.length,
  ...(Object.fromEntries(OUTINGS.map((spec) => [spec.id, spec.seats.spots])) as Record<
    (typeof OUTINGS)[number]['id'],
    number
  >),
};
/** At most one of each set per neighbor and day (SPEC §4.0.F). */
const EXCLUSIVE: readonly (readonly SeatCall[])[] = [
  ['football-morning', 'market'],
  ['green', 'zoo', 'football-afternoon', 'millpond', 'regatta', 'harvest-fair', 'bandstand-tea'],
  ['concert', 'long-table', 'bandstand-sundown'],
  ['night-party', 'stargazing'],
];
/** The calls that sit on turn tickets, and their caps. */
const TICKETS: readonly [string, number][] = [
  ...OUTINGS.map((spec): [string, number] => [spec.id, OUTING_TABLE[spec.id].cap]),
  ['night-party', EVENT_SPOTS.stage.length],
];
const NAMES = Object.keys(TOWNS) as TownName[];
const year = (name: TownName) => yearOf(TOWNS[name]);
const YEAR_TIMEOUT = rosterTimeout(0.3, 60_000);

beforeAll(() => {
  for (const name of NAMES) year(name);
}, 180_000);

describe('The Riverside’s seats over a year', () => {
  it(
    'seats no more guests than spots, one to a spot, and every spot on each of its days',
    () => {
      for (const name of NAMES)
        for (const { day, guests } of year(name)) {
          for (const [call, list] of guests) {
            const seats = list.map(([, trip]) => trip.seat);
            expect(new Set(seats).size, `${name} ${call} on ${day}`).toBe(seats.length);
            for (const seat of seats) {
              expect(seat).toBeGreaterThanOrEqual(0);
              expect(seat).toBeLessThan(CAPACITY[call]);
            }
          }
          for (const spec of OUTINGS) {
            const seated = guests.get(spec.id)?.length ?? 0;
            if (!spec.on(day)) expect(seated, `${name} ${spec.id} on ${day}`).toBe(0);
            // Every town but the real one has a taker for every spot.
            else if (name !== 'real')
              expect(seated, `${name} ${spec.id} on ${day}`).toBe(spec.seats.spots);
          }
        }
    },
    YEAR_TIMEOUT,
  );

  it('runs each festival on its own days, and the snowmen on theirs', () => {
    const on = (test: (day: number) => boolean) =>
      YEAR.filter(test).map((day) => {
        const { season, date } = townCalendarAt(day);
        return `${season[0]}${season === 'Summer' ? 'u' : ''}${date}`;
      });
    expect(on(regattaDay)).toEqual(['Su10', 'Su11', 'Su12', 'Su13', 'Su14', 'Su15', 'Su16']);
    expect(on(harvestDay)).toEqual(['A23', 'A24', 'A25']);
    expect(on(starNight)).toEqual([
      'S1',
      'S27',
      'S28',
      'Su1',
      'Su27',
      'Su28',
      'A1',
      'A27',
      'A28',
      'W1',
      'W27',
      'W28',
    ]);
    expect(on((day) => eventsForDay(day)[0].variant === 'snowmen')).toEqual([
      'W3',
      'W7',
      'W11',
      'W15',
    ]);
    // The year's plans hold each outing on exactly its own days.
    for (const spec of OUTINGS)
      expect(
        year('eager')
          .filter(({ guests }) => guests.has(spec.id))
          .map(({ day }) => day),
        spec.id,
      ).toEqual(YEAR.filter((day) => outingOn(spec.id, day)));
  });

  it(
    'keeps each neighbor to one outing a period, and the Bandstand’s spots to one guest at a time',
    () => {
      let shared = 0;
      for (const name of NAMES)
        for (const { day, guests } of year(name)) {
          for (const calls of EXCLUSIVE) {
            const ids = calls.flatMap((call) => (guests.get(call) ?? []).map(([id]) => id));
            expect(new Set(ids).size, `${name} ${calls.join('/')} on ${day}`).toBe(ids.length);
          }
          // A film guest sees none of the evening's other outings, nor the stars.
          const film = new Set((guests.get('cinema') ?? []).map(([id]) => id));
          for (const call of SEAT_ORDER.filter((call) => SEAT_EXCLUDES[call].includes('cinema')))
            expect(
              (guests.get(call) ?? []).some(([id]) => film.has(id)),
              call,
            ).toBe(false);
          // One deckchair or rug to a guest at a time, across both sets and the stars.
          const bandstand = (['bandstand-tea', 'bandstand-sundown', 'stargazing'] as const).flatMap(
            (call) => (guests.get(call) ?? []).map(([, trip]) => trip),
          );
          for (let i = 0; i < bandstand.length; i++)
            for (let j = i + 1; j < bandstand.length; j++) {
              const a = bandstand[i],
                b = bandstand[j];
              if (a.seat !== b.seat) continue;
              shared++;
              expect(
                Math.max(a.arrive, b.arrive) >= Math.min(a.leave, b.leave),
                `${name} spot ${a.seat} on ${day}`,
              ).toBe(true);
            }
          // The deckchairs are out for every set's guest, the rugs for every stargazer.
          for (const [, trip] of [
            ...(guests.get('bandstand-tea') ?? []),
            ...(guests.get('bandstand-sundown') ?? []),
          ]) {
            expect(trip.arrive).toBeGreaterThanOrEqual(BANDSTAND_FURNITURE.chairs.from);
            expect(trip.leave).toBeLessThanOrEqual(BANDSTAND_FURNITURE.chairs.to);
          }
          for (const [, trip] of guests.get('stargazing') ?? []) {
            expect(trip.arrive).toBeGreaterThanOrEqual(BANDSTAND_FURNITURE.rugs.from);
            expect(trip.leave).toBeLessThanOrEqual(BANDSTAND_FURNITURE.rugs.to);
          }
        }
      // The sets and the stars do share the eight spots, a set apart.
      expect(shared).toBeGreaterThan(100);
    },
    YEAR_TIMEOUT,
  );

  it(
    'is worth the walk, and keeps two minutes apart at every tube door and venue gate',
    () => {
      type Mark = { t: number; home: string; hop: boolean };
      /** The minute each rider reaches a boarding door, or leaves a stepping-off one. */
      const doors = (trip: ResidentTrip, going: boolean) => {
        const legs = (going ? trip.legs : trip.returnLegs) ?? [];
        let at = going ? trip.depart : trip.leave;
        const marks: [string, number][] = [];
        for (const leg of legs) {
          if (leg.kind === 'board') marks.push([`door:${leg.from}`, at]);
          at += leg.minutes;
          if (leg.kind === 'alight') marks.push([`door:${leg.to}`, at]);
        }
        return marks;
      };
      let moved = 0,
        trips = 0,
        hops = 0;
      for (const name of NAMES)
        for (const { day, plans } of year(name)) {
          const marks = new Map<string, Mark[]>();
          const mark = (key: string, t: number, home: string, hop: boolean) => {
            const list = marks.get(key);
            if (list) list.push({ t, home, hop });
            else marks.set(key, [{ t, home, hop }]);
          };
          for (const [home, list] of plans)
            list.forEach((trip, index) => {
              trips++;
              const visit =
                Math.min(trip.event.end, trip.leave) - Math.max(trip.event.start, trip.arrive);
              expect(trip.duration).toBeLessThanOrEqual(WORTH_THE_WALK * visit + 1e-9);
              // The film's hop to the stage books its marks but is never moved.
              const hop = !!list[index - 1]?.continuesTo;
              if (!hop) {
                const { arriveShift, leaveShift, leaveCap } = trip.headway!;
                expect(arriveShift).toBeGreaterThanOrEqual(0);
                expect(arriveShift).toBeLessThanOrEqual(HEADWAY_SHIFT_MAX);
                expect(leaveShift).toBeLessThanOrEqual(HEADWAY_SHIFT_MAX);
                expect(trip.leave).toBeLessThanOrEqual(leaveCap + 1e-9);
                if (arriveShift || leaveShift) moved++;
              }
              if (trip.event.id === 'millpond')
                expect(trip.leave).toBeLessThanOrEqual(SKATING.end + 1e-9);
              // Doors, and the minute the guest passes the first point of their way in.
              for (const [key, t] of doors(trip, true)) mark(key, t, home, hop);
              if (!trip.continuesTo)
                for (const [key, t] of doors(trip, false)) mark(key, t, home, hop);
              const approach = eventApproach(trip.event, trip.seat);
              const gate = `gate:${trip.event.venue.id}:${approach[0].x},${approach[0].y}`;
              const minutes = routeLength(approach) / (WALK_SPEED * trip.pace);
              mark(gate, trip.arrive - minutes, home, hop);
              if (!trip.continuesTo) mark(gate, trip.leave + minutes, home, hop);
            });
          for (const [key, list] of marks) {
            const headway = key.startsWith('gate:') ? VENUE_GATE_HEADWAY : TUBE_DOOR_HEADWAY;
            list.sort((a, b) => a.t - b.t);
            for (let i = 0; i < list.length; i++)
              for (let j = i + 1; j < list.length && list[j].t - list[i].t < headway; j++)
                if (list[i].home !== list[j].home) {
                  if (list[i].hop || list[j].hop) hops++;
                  else expect.fail(`${name} ${key} on ${day}: ${list[i].home}, ${list[j].home}`);
                }
          }
        }
      expect(moved).toBeGreaterThan(0);
      expect(moved).toBeLessThan(trips);
      // Only a film guest's hop to the stage ever passes within the headway, a few times a year.
      expect(hops).toBeLessThan(40);
    },
    YEAR_TIMEOUT,
  );

  it(
    'changes no other outing’s guests on a day without a festival',
    () => {
      // The Riverside's daily outings seat last of all: with the festivals off, every other
      // outing's guests and seats are exactly those of the town without the Riverside.
      const others = SEAT_ORDER.filter((call) => !outingOf(call));
      const lists = (plan: PlanDay) =>
        others.map((call) =>
          (plan.guests.get(call) ?? []).map(([id, trip]) => `${id}:${trip.seat}`).sort(),
        );
      let entries = 0;
      for (const name of NAMES) {
        const daily = yearOf(TOWNS[name], { festivals: false }),
          none = yearOf(TOWNS[name], { outings: false });
        daily.forEach((plan, index) => {
          const seated = lists(plan);
          entries += seated.flat().length;
          expect(seated, `${name} on ${plan.day}`).toEqual(lists(none[index]));
          // And the daily three are seated all the same.
          expect(plan.guests.has('market') || name === 'real').toBe(true);
        });
      }
      expect(entries).toBeGreaterThan(20_000);
    },
    rosterTimeout(0.3, 120_000),
  );
});

describe('Turn tickets', () => {
  it('gives every house plot one ticket day in each block, and no day more than the spots', () => {
    const plots = HOUSE_PLOTS.length;
    for (const [kind, cap] of TICKETS) {
      const perBlock = Math.ceil(plots / cap);
      // Two whole blocks of the kind's own active days, from the calendar's epoch.
      const active: number[] = [];
      for (let day = CALENDAR_EPOCH_DAY; active.length < 2 * perBlock; day++)
        if (kind === 'night-party' || outingOn(kind as never, day)) active.push(day);
      for (const block of [0, 1]) {
        const days = active.filter(
          (day) => Math.floor(activeIndex(kind, day) / perBlock) === block,
        );
        expect(days, `${kind} block ${block}`).toHaveLength(perBlock);
        const held = new Map<string, number>();
        for (const day of days) {
          let today = 0;
          for (const { id } of HOUSE_PLOTS)
            if (ticketRank(kind, cap, day, id) !== undefined) {
              today++;
              held.set(id, (held.get(id) ?? 0) + 1);
            }
          expect(today, `${kind} on ${day}`).toBeLessThanOrEqual(cap);
        }
        for (const { id } of HOUSE_PLOTS) expect(held.get(id), `${kind} ${id}`).toBe(1);
      }
    }
  });

  it('brings everyone to the market and both Bandstand sets in a year, when all are free', () => {
    const seen = new Map<SeatCall, Set<string>>();
    for (const { guests } of year('eager'))
      for (const [call, list] of guests)
        for (const [id] of list) seen.set(call, (seen.get(call) ?? new Set()).add(id));
    for (const call of ['market', 'bandstand-tea', 'bandstand-sundown'] as const)
      expect(seen.get(call)!.size, call).toBe(TOWNS.eager.length);
  });

  it(
    'moves at most one guest of an outing when one more neighbor moves in',
    () => {
      // Half the mixed town, then the same with one all-day stroller added on J4.
      const half = TOWNS.mixed.filter((_, index) => index % 2);
      const plot = ['F8', 'J4', 'A8', 'C14', 'R12'].find(
        (id) => !half.some((home) => home.plot === id),
      )!;
      expect(plot).toBe('J4');
      const newcomer = placeSchema.parse({
        ...SAMPLE,
        id: 'newcomer-j4',
        plot,
        resident: { ...SAMPLE.resident, routine: routine(0) },
      });
      const grown = [...half, newcomer];
      const days = new Map<string, number>(),
        moved = new Map<string, number>();
      for (const day of YEAR) {
        const before = guestsOf(planResidentTrips(half, day)),
          after = guestsOf(planResidentTrips(grown, day));
        for (const [kind] of TICKETS) {
          const call = kind as SeatCall;
          const was = new Set((before.get(call) ?? []).map(([id]) => id));
          const now = new Set((after.get(call) ?? []).map(([id]) => id));
          if (!was.size && !now.size) continue;
          days.set(kind, (days.get(kind) ?? 0) + 1);
          if ([...was].filter((id) => !now.has(id)).length > 1)
            moved.set(kind, (moved.get(kind) ?? 0) + 1);
        }
      }
      // A tenth of its days, and at least one (a festival of three days may lose a day to the
      // headways). With v1's decks the market moved more than one guest on 109 of 112 days.
      for (const [kind] of TICKETS)
        expect(moved.get(kind) ?? 0, kind).toBeLessThanOrEqual(
          Math.max(1, Math.floor(0.1 * days.get(kind)!)),
        );
    },
    rosterTimeout(0.3, 60_000),
  );
});

/** Run with the default collation set to another language, as a visitor's browser would. */
function inLanguage<T>(locale: string, run: () => T): T {
  const original = String.prototype.localeCompare;
  String.prototype.localeCompare = function (
    this: string,
    that: string,
    locales?: Intl.LocalesArgument,
    options?: Intl.CollatorOptions,
  ) {
    return original.call(this, that, locales ?? locale, options);
  } as typeof original;
  try {
    return run();
  } finally {
    String.prototype.localeCompare = original;
  }
}

describe('The same plan for everyone', () => {
  it(
    'plans the same day for any roster order, in any language, whatever was planned before',
    () => {
      const festive = YEAR.filter(
        (day, index) => index % 7 === 0 || regattaDay(day) || harvestDay(day) || starNight(day),
      );
      for (const name of ['mixed', 'full'] as const)
        for (const day of festive) {
          const backward = planResidentTrips([...TOWNS[name]].reverse(), day);
          const plan = year(name)[day - CALENDAR_EPOCH_DAY].plans;
          for (const home of TOWNS[name])
            expect(backward.get(home.id), `${name} ${home.id} on ${day}`).toEqual(
              plan.get(home.id),
            );
        }
      const english = YEAR.filter((_, index) => index % 9 === 0).map((day) => [
        ...planResidentTrips(TOWNS.real, day),
      ]);
      for (const locale of ['lt', 'haw', 'da', 'cs'])
        expect(
          inLanguage(locale, () =>
            YEAR.filter((_, index) => index % 9 === 0).map((day) => [
              ...planResidentTrips(TOWNS.real, day),
            ]),
          ),
          locale,
        ).toEqual(english);
      // One home planned on its own (no book) gets the same answer before and after a town.
      const party = eventsForDay(YEAR[3]).find((event) => event.id === 'night-party')!;
      const owl = TOWNS.eager.find((home) => home.plot === 'A4')!;
      const alone = () =>
        planHome(
          owl,
          [{ event: party, seat: 0, period: 'night' }],
          new Map([[party, eventTubeJourney(owl, party, 0)]]),
        );
      const before = alone();
      planResidentTrips(TOWNS.eager, YEAR[3]);
      expect(alone()).toEqual(before);
    },
    rosterTimeout(0.3, 60_000),
  );

  it(
    'previews a draft house on the Riverside without moving anyone already in town',
    () => {
      let outings = 0;
      for (const [plot, k] of [
        ['T15', 0],
        ['B15', 35],
        ['A14', 46],
        ['F14', 0],
        ['C14', 8],
        ['K14', 0],
        ['M15', 0],
      ] as const) {
        const draft = placeSchema.parse({
          ...SAMPLE,
          id: 'my-draft',
          plot,
          resident: { ...SAMPLE.resident, routine: routine(k) },
        });
        for (const homes of [TOWNS.real, TOWNS.mixed.filter((_, index) => index % 3 === 0)]) {
          const roster = homes.filter((home) => home.plot !== plot);
          const town = withPreview(roster, draft);
          for (const day of YEAR.filter((_, index) => index % 6 === 0)) {
            const before = planResidentTrips(roster, day),
              after = planResidentTrips(town, day);
            for (const home of roster) expect(after.get(home.id)).toEqual(before.get(home.id));
            outings += after.get(draft.id)!.length;
          }
        }
      }
      expect(outings).toBeGreaterThan(50);
    },
    rosterTimeout(0.3, 60_000),
  );
});

/** The twelve sample days of SPEC §6.7, as season and date. */
const SAMPLE_DAYS = (
  [
    ['Spring', 1],
    ['Spring', 2],
    ['Spring', 3],
    ['Summer', 10],
    ['Summer', 15],
    ['Summer', 23],
    ['Autumn', 9],
    ['Autumn', 23],
    ['Autumn', 24],
    ['Autumn', 25],
    ['Winter', 3],
    ['Winter', 11],
  ] as const
).map(([season, date]) =>
  YEAR.find((day) => {
    const calendar = townCalendarAt(day);
    return calendar.season === season && calendar.date === date;
  })!,
);
/** The full town every 5 town minutes of a plan day, 06:00 to 06:00, with each home's trips. */
function* fullTownMoments() {
  const homes = TOWNS.full;
  for (const day of SAMPLE_DAYS) {
    const plans = year('full')[day - CALENDAR_EPOCH_DAY].plans;
    for (let minute = 360; minute < 1800; minute += 5) {
      const states = simulateResidents(homes, minute % 1440, day + Math.floor(minute / 1440));
      yield { day, minute, states, plans };
    }
  }
}
/** The trip a resident's event belongs to. */
const tripOf = (plans: Map<string, ResidentTrip[]>, state: ResidentState) =>
  plans.get(state.id)?.find((trip) => trip.event.id === state.event?.id);

describe('Where the Riverside’s guests are', () => {
  it(
    'keeps every guest in their venue’s ground there, and everyone else on a road, the tube or home',
    () => {
      const astray: string[] = [];
      let guests = 0;
      for (const { day, minute, states, plans } of fullTownMoments())
        for (const state of states) {
          const { x, y } = state.position;
          const trip = state.event && tripOf(plans, state);
          const where = `${state.id} on ${day} at ${minute}: ${x.toFixed(2)},${y.toFixed(2)}`;
          if (state.event?.phase === 'attending' || state.event?.phase === 'waiting') {
            guests++;
            if (!trip || !insideEventGround(trip.event.venue, state.position))
              astray.push(`${where} away from ${state.event.id}`);
          } else if (
            !onRoadOrTube(state) &&
            findPlotAt(x, y)?.id !== state.home.plot &&
            // On the way in or out through a ground of the day's (the film's aisle on the hop to
            // the stage included).
            !(
              state.event &&
              plans.get(state.id)?.some((t) => insideEventGround(t.event.venue, state.position))
            )
          )
            astray.push(`${where} off the road`);
          // Nobody stands on the river or the far bank; riders cross it in the glass.
          if (x > 62 && !riding(state)) astray.push(`${where} east of the river's edge`);
        }
      expect(astray.slice(0, 5)).toEqual([]);
      expect(guests).toBeGreaterThan(10_000);
    },
    rosterTimeout(0.5, 120_000),
  );

  it(
    'carries a bag, a boat or a dish only on its outing’s own leg',
    () => {
      const wrong: string[] = [];
      const carried = new Map<string, number>();
      for (const { day, minute, states } of fullTownMoments())
        for (const state of states) {
          const spec = state.event && outingOf(state.event.id);
          const carry = spec?.carry;
          const where = `${state.id} on ${day} at ${minute}`;
          if (state.carry) {
            carried.set(state.carry.kind, (carried.get(state.carry.kind) ?? 0) + 1);
            if (!carry || state.event!.phase !== carry.leg || state.carry.kind !== carry.kind)
              wrong.push(`${where}: ${state.carry.kind} ${state.event?.id} ${state.event?.phase}`);
            else if (state.carry.variant !== carry.variant(day, state.id))
              wrong.push(`${where}: variant ${state.carry.variant}`);
          } else if (carry && state.event!.phase === carry.leg && state.moving)
            wrong.push(`${where}: no ${carry.kind} on the way`);
        }
      expect(wrong.slice(0, 5)).toEqual([]);
      // Bags on market mornings, boats on the regatta day, dishes on the Harvest evenings.
      for (const kind of ['paper-bag', 'paper-boat', 'dish'])
        expect(carried.get(kind) ?? 0, kind).toBeGreaterThan(0);
    },
    rosterTimeout(0.5, 120_000),
  );
});

describe('The regatta and the snowmen', () => {
  it('has every guest at the water to see their own boat come in, and none late for its launch', () => {
    let watched = 0,
      seats = 0;
    for (const name of NAMES)
      for (const { day, guests } of year(name))
        for (const [id, trip] of guests.get('regatta') ?? []) {
          seats++;
          const launch = 840 + REGATTA_LAUNCH_EVERY * trip.seat;
          // Boat in hand, set down on their own row before the boatwright comes for it.
          expect(trip.arrive, `${name} ${id} on ${day}`).toBeLessThanOrEqual(
            launch - REGATTA_HANDOVER,
          );
          expect(trip.event.start).toBe(launch);
          const { restAt } = regattaBoat(trip.seat, day, launch)!;
          if (trip.arrive <= restAt && trip.leave >= restAt + 1.5) watched++;
        }
    expect(seats).toBeGreaterThan(100);
    expect(watched / seats).toBeGreaterThanOrEqual(0.95);
  });

  it('keeps a builder at the snowmen through every minute of the building', () => {
    let days = 0;
    for (const name of NAMES)
      for (const { day, plans } of year(name)) {
        const lunch = [...plans.values()].flat().filter((trip) => trip.event.variant === 'snowmen');
        if (!lunch.length) continue;
        days++;
        const builders = lunch.filter((trip) => trip.seat < 2);
        for (let minute = SNOWMAN_STAGES.base; minute <= SNOWMAN_STAGES.dressed; minute++)
          expect(
            builders.some((trip) => trip.arrive <= minute && trip.leave >= minute),
            `${name} on ${day} at ${minute}`,
          ).toBe(true);
      }
    expect(days).toBe(16);
  });
});

describe('The real town’s Riverside', () => {
  // Today's 30 houses, frozen (tests/fixtures/town-2026-10.json).
  const count = (call: SeatCall) =>
    year('real')
      .filter(({ day }) => outingOf(call)?.on(day) ?? true)
      .map(({ guests }) => guests.get(call)?.length ?? 0);
  const mean = (list: number[]) => list.reduce((sum, n) => sum + n, 0) / list.length;

  it('keeps the market, the teatime set, the festivals, the stars and the disco going', () => {
    expect(mean(count('market'))).toBeGreaterThanOrEqual(1.5);
    expect(count('bandstand-tea').filter((n) => n >= 1).length).toBeGreaterThanOrEqual(80);
    for (const n of count('regatta')) expect(n).toBeGreaterThanOrEqual(8);
    for (const n of count('harvest-fair')) expect(n).toBeGreaterThanOrEqual(10);
    for (const n of count('long-table')) expect(n).toBeGreaterThanOrEqual(3);
    expect(count('stargazing')).toHaveLength(12);
    expect(mean(count('stargazing'))).toBeGreaterThanOrEqual(1.5);
    for (const n of count('night-party')) expect(n).toBeGreaterThanOrEqual(1);
  });

  it(
    'seats as many stargazers as the night allows, and a dancer whenever an owl can dance',
    () => {
      // The published roster as it is (every house plot taken in check:full-town).
      const homes = LIVE_TOWN;
      const journeys = (home: Place, list: Candidate[]) =>
        new Map(list.map((c) => [c.event, eventTubeJourney(home, c.event, c.seat)]));
      const earlier = new Set<SeatCall>(SEAT_ORDER.slice(0, SEAT_ORDER.indexOf('stargazing')));
      for (const day of YEAR) {
        const plans = planResidentTrips(homes, day);
        const guests = guestsOf(plans);
        const film = new Set(cinemaGuests(homes, day));
        const gazers = new Set((guests.get('stargazing') ?? []).map(([id]) => id));
        const events = eventsForDay(day);
        const stars = events.find((event) => event.outing === 'stargazing');
        const owls = homes.filter(
          (home) => home.resident.routine.night === 'stroll' && !film.has(home.id),
        );
        if (stars) {
          // The stars' line: tonight's ticket holders by rank, then everyone else on the hash
          // line. Down the line, a seat goes to each owl whose day, as planned before the stars,
          // still has room for them in that seat.
          const byId = (a: Place, b: Place) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
          const rank = (home: Place) => ticketRank('stargazing', 8, day, home.plot);
          const key = OUTING_TABLE.stargazing.newcomerKey(day);
          const line = [
            ...owls
              .filter((home) => rank(home) !== undefined)
              .sort((a, b) => rank(a)! - rank(b)! || byId(a, b)),
            ...owls
              .filter((home) => rank(home) === undefined)
              .sort((a, b) => hash(`${key}:${a.id}`) - hash(`${key}:${b.id}`) || byId(a, b)),
          ];
          const seats = Math.min(8, Math.ceil(owls.length / 2));
          let seated = 0;
          for (const home of line) {
            if (seated >= seats) break;
            const before: Candidate[] = (plans.get(home.id) ?? [])
              .filter((trip) => earlier.has(callOf(trip)))
              .map((trip) => ({
                event: trip.event,
                seat: trip.seat,
                period: trip.event.id === 'cinema' ? 'evening' : trip.event.period,
              }));
            const list = [...before, { event: stars, seat: seated, period: 'night' as const }];
            if (planHome(home, list, journeys(home, list)).length === list.length) seated++;
          }
          expect(gazers.size, `stargazers on ${day}`).toBe(seated);
        } else expect(gazers.size).toBe(0);
        // A dancer whenever an owl who is at neither the film nor the stars could dance alone.
        const party = events.find((event) => event.id === 'night-party')!;
        const free = owls.filter((home) => !gazers.has(home.id));
        const canDance = free.some((owl) => {
          const list: Candidate[] = [{ event: party, seat: 0, period: 'night' }];
          return planHome(owl, list, journeys(owl, list)).length > 0;
        });
        if (canDance)
          expect(guests.get('night-party')?.length ?? 0, `dancers on ${day}`).toBeGreaterThan(0);
      }
    },
    rosterTimeout(0.3, 60_000),
  );
});

// Skating has its own days too; the planner never seats anyone there off them.
it('skates only on the frozen days', () => {
  for (const { day, guests } of year('eager'))
    expect(guests.has('millpond')).toBe(millpondSkatingDay(day));
});
