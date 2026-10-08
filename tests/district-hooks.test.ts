// The Riverside's shared-file hooks: every place a shared file calls a feature's registry,
// checked with the features' own code (or spies in its place), so a feature's part lives in its
// own files and the shared files never change for it.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { placeSchema, type Place } from '../src/lib/schema';
import {
  districtEvents,
  eventsForDay,
  eventStatus,
  HOUSE_PLOTS,
  insideVenue,
  isDistrictVenue,
  snowmenDay,
  VENUES,
  type TownEvent,
} from '../src/lib/events';
import {
  BANDS,
  marketKind,
  MARKET_KINDS,
  OUTING_IDS,
  OUTING_TIMES,
  SNOWMAN_DAYS,
  harvestDay,
  regattaDay,
  starNight,
  type OutingId,
} from '../src/lib/district-calendar';
import {
  BANDSTAND_FRAME,
  BANDSTAND_VENUE,
  DISTRICT_FRAMES,
  HARVEST_VENUE,
  LANDING_VENUE,
  MARKET_PLOTS,
  MARKET_VENUE,
  insideDistrict,
} from '../src/lib/district-places';
import { BAND_COPY, DISTRICT_COPY, SNOWMEN_LUNCH } from '../src/lib/district-copy';
import { OUTINGS, outingOf } from '../src/lib/outings';
import { CALENDAR_EPOCH_DAY, townCalendarAt } from '../src/lib/town-calendar';
import { getPlot, plotCenter, type Point } from '../src/lib/world';
import { planHome, tripState } from '../src/lib/resident-trips';
import {
  residentActivityLabel,
  simulateResidents,
  type ResidentState,
} from '../src/lib/simulation';
import type { ResidentTransit } from '../src/lib/tubes';
import { linkHash, readDeepLink } from '../src/lib/deep-link';
import { compose, durationOf, trackForTown, TRACKS } from '../src/music/score';
import {
  DISTRICT_SHOTS,
  districtShotAirs,
  liveDistrictHighlight,
  liveDistrictShots,
  liveProgram,
  liveShotAt,
} from '../src/lib/live-director';
import { comingUpAt, protectedMoments } from '../src/lib/live-breaks';
import { TOWN_DAY_MS } from '../src/lib/town-time';
import TownEvents, { districtCards } from '../src/components/TownEvents';
import { footballAt } from '../src/lib/football';
import { DISTRICT_PAINTERS } from '../src/city/district-art';
import { CARRY_SPRITES } from '../src/city/carry-items';
import { cityHit, renderCity } from '../src/city/render';
import { drawResident, residentReach } from '../src/city/residents';
import { drawFarm } from '../src/city/farm';
import { drawVenue } from '../src/city/venues';
import { drawScarecrowExtras } from '../src/city/district/harvest';
import {
  snowmenBuilderFacing,
  snowmenBuilderPose,
  snowmenWatcherPose,
} from '../src/lib/outings/snowmen';
import { recordingContext } from './recording-context';
import { insideEventGround } from './event-ground';
import { FROZEN_TOWN } from './district';

// The scarecrow's festival dress is the harvest painter's, and the snowmen's builders and
// watchers are the snowmen outing's; the hooks only have to call them.
vi.mock('../src/city/district/harvest', async (original) => ({
  ...(await original<typeof import('../src/city/district/harvest')>()),
  drawScarecrowExtras: vi.fn(),
}));
vi.mock('../src/lib/outings/snowmen', () => ({
  snowmenBuilderPose: vi.fn(() => 'crouch'),
  snowmenWatcherPose: vi.fn(() => 'cheer'),
  snowmenBuilderFacing: vi.fn(() => 'ne'),
}));

const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
const YEAR = Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + i);
const REGATTA = YEAR.find(regattaDay)!;
const HARVEST = YEAR.find(harvestDay)!;
const PLAIN = YEAR.find((day) => !regattaDay(day) && !harvestDay(day) && !starNight(day))!;
const STARS = YEAR.find((day) => starNight(day) && !regattaDay(day) && !harvestDay(day))!;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('The Riverside in the events list', () => {
  it('lists the daily three every day and the festivals on their own days', () => {
    for (const day of YEAR) {
      const ids = districtEvents(day).map((event) => event.id);
      expect(ids.slice(0, 3)).toEqual(['market', 'bandstand-tea', 'bandstand-sundown']);
      expect(ids.includes('regatta')).toBe(regattaDay(day));
      expect(ids.includes('harvest-fair')).toBe(harvestDay(day));
      expect(ids.includes('long-table')).toBe(harvestDay(day));
      expect(ids.includes('stargazing')).toBe(starNight(day));
      // eventsForDay: today's five unchanged, then the Riverside's outings.
      for (const minutes of [100, 720]) {
        const events = eventsForDay(day, minutes);
        expect(events.slice(0, 5).every((event) => !event.outing)).toBe(true);
        expect(events.slice(5)).toEqual(districtEvents(day, minutes));
      }
    }
    // Before 06:00 the night's stargazing belongs to yesterday, like the film.
    expect(districtEvents(STARS + 1, 100).some((event) => event.id === 'stargazing')).toBe(true);
    expect(districtEvents(STARS + 1, 720).some((event) => event.id === 'stargazing')).toBe(
      starNight(STARS + 1),
    );
  });

  it('takes every field from the frozen calendar, places, copy and registry', () => {
    const venues: Record<OutingId, TownEvent['venue']> = {
      market: MARKET_VENUE,
      'bandstand-tea': BANDSTAND_VENUE,
      'bandstand-sundown': BANDSTAND_VENUE,
      regatta: LANDING_VENUE,
      'harvest-fair': HARVEST_VENUE,
      'long-table': HARVEST_VENUE,
      stargazing: BANDSTAND_VENUE,
    };
    const all = [REGATTA, HARVEST, STARS].flatMap((day) =>
      districtEvents(day).map((event) => ({ day, event })),
    );
    expect(new Set(all.map(({ event }) => event.id))).toEqual(new Set(OUTING_IDS));
    for (const { day, event } of all) {
      const id = event.outing!;
      expect(event.id).toBe(id);
      expect(event).toMatchObject({
        ...OUTING_TIMES[id],
        name: DISTRICT_COPY[id].name(day),
        description: DISTRICT_COPY[id].description(day),
        venue: venues[id],
        period: outingOf(id)!.period,
      });
      expect(outingOf(id)!.venue).toBe(event.venue);
      expect(event.name).not.toMatch(/\.$/);
    }
    // Both sets play the day's band.
    const [, tea, sundown] = districtEvents(PLAIN);
    expect(tea.name).toBe(sundown.name);
    expect(BANDS.map((band) => BAND_COPY[band].name)).toContain(tea.name);
    // Morning outings say "Later today" before they start.
    expect(eventStatus(districtEvents(PLAIN)[0], 300)).toBe('Later today');
  });

  it('turns the lunch into snowmen on the build days, with the same guests', () => {
    let builds = 0;
    for (const day of YEAR) {
      const [lunch] = eventsForDay(day);
      const plain = eventsForDay(day - 112)[0];
      expect(snowmenDay(day)).toBe(
        (SNOWMAN_DAYS as readonly number[]).includes(day - CALENDAR_EPOCH_DAY),
      );
      if (!snowmenDay(day)) {
        expect(lunch.variant).toBeUndefined();
        continue;
      }
      builds++;
      expect(lunch).toMatchObject({ ...SNOWMEN_LUNCH, variant: 'snowmen' });
      // The line key is the hashed choice's id, so the guest list is the day's own.
      expect(['picnic', 'books', 'games']).toContain(lunch.id);
      expect(townCalendarAt(day).season).toBe('Winter');
      expect(plain.period).toBe('afternoon');
    }
    expect(builds).toBe(4);
  });

  it('keeps the Riverside venues inside their own grounds', () => {
    for (const venue of [MARKET_VENUE, BANDSTAND_VENUE, LANDING_VENUE, HARVEST_VENUE]) {
      expect(isDistrictVenue(venue)).toBe(true);
      const plot = getPlot(venue.plot)!;
      const centre = { x: plot.x + 0.5, y: plot.y + 0.5 };
      expect(insideVenue(venue, centre)).toBe(insideDistrict(venue.kind, centre));
      expect(insideEventGround(venue, centre)).toBe(insideDistrict(venue.kind, centre));
    }
    for (const venue of VENUES.filter((venue) => !isDistrictVenue(venue)))
      expect(isDistrictVenue(venue)).toBe(false);
  });
});

/** The cards as a visitor reads them: each button's label and text, in order. */
function cards(events: TownEvent[], minutes: number, day: number, attending?: Map<string, number>) {
  const html = renderToStaticMarkup(
    createElement(TownEvents, {
      events,
      minutes,
      day,
      attending,
      football: footballAt(minutes, day),
      onVisit: () => {},
    }),
  );
  const decode = (text: string) =>
    text.replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"');
  return [...html.matchAll(/<button[^>]*aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)].map(
    ([, label, inner]) => ({ label: decode(label), text: decode(inner.replace(/<[^>]*>/g, '')) }),
  );
}

describe('The Riverside’s cards', () => {
  const day = PLAIN;
  /** Today's five (eventsForDay lists the Riverside's outings after them). */
  const five = eventsForDay(day, 720).filter((event) => !event.outing);
  const all = (minutes: number) => [...five, ...districtEvents(day, minutes)];

  it('shows both Bandstand sets on one card: the live one, else the next, else the teatime set', () => {
    const at = (minutes: number) =>
      districtCards(all(minutes), minutes).filter((event) => event.venue === BANDSTAND_VENUE);
    for (const [minutes, id] of [
      [600, 'bandstand-tea'],
      [1000, 'bandstand-tea'],
      [1060, 'bandstand-sundown'],
      [1150, 'bandstand-sundown'],
      [1300, 'bandstand-tea'],
    ] as const) {
      expect(at(minutes).map((event) => event.id)).toEqual([id]);
    }
    // In start order.
    const starts = districtCards(all(600), 600).map((event) => event.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('follows today’s five, and joins the live cards while it is on', () => {
    // Market time: the market is live and nothing of today's five is.
    const morning = cards(all(600), 600, day);
    const market = morning.findIndex((card) => card.label.includes(MARKET_VENUE.name));
    expect(market).toBe(1);
    expect(morning[0].label).toMatch(/football/i);
    // Later on, the finished market follows today's five, before skating waits at the end.
    const evening = cards(all(1150), 1150, day);
    const labels = evening.map((card) => card.label);
    const marketAt = labels.findIndex((label) => label.includes(MARKET_VENUE.name));
    expect(marketAt).toBeGreaterThan(5);
    expect(labels.filter((label) => label.includes(BANDSTAND_VENUE.name))).toHaveLength(1);
    // Today's five keep their order.
    const names = five.map((event) => event.name);
    const order = names.map((name) => labels.findIndex((label) => label.includes(`: ${name}, `)));
    expect(order.every((index) => index > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('counts the neighbors there only while it is on and someone is', () => {
    const count = new Map([['market', 3]]);
    const live = cards(all(600), 600, day, count).find((card) =>
      card.label.includes(MARKET_VENUE.name),
    )!;
    expect(live.text).toContain('Happening now · 08:00–11:30 · 3 there');
    expect(live.label).toMatch(/, 3 there$/);
    const empty = cards(all(600), 600, day, new Map()).find((card) =>
      card.label.includes(MARKET_VENUE.name),
    )!;
    expect(empty.text).not.toMatch(/there/);
    const later = cards(all(300), 300, day, count).find((card) =>
      card.label.includes(MARKET_VENUE.name),
    )!;
    expect(later.text).toContain('Later today · 08:00–11:30');
    expect(later.text).not.toMatch(/there/);
    // The label says the card's status and times too, as words.
    expect(later.label).toContain('later today, 08:00 to 11:30');
    const finished = cards(all(1150), 1150, day, count).find((card) =>
      card.label.includes(MARKET_VENUE.name),
    )!;
    expect(finished.label).toContain('finished today, 08:00 to 11:30');
  });
});

describe('The Riverside’s links', () => {
  it('opens each venue, the aliases included, and gives every plot of a venue its link', () => {
    for (const [venue, plot] of [
      ['market', 'D14'],
      ['bandstand', 'K15'],
      ['landing', 'J15'],
      ['regatta', 'J15'],
      ['stars', 'K15'],
    ])
      expect(readDeepLink(`#venue=${venue}`, [])).toEqual({ plot });
    for (const plot of MARKET_PLOTS) expect(linkHash(plot, [])).toBe('#venue=market');
    expect(linkHash('K15', [])).toBe('#venue=bandstand');
    expect(linkHash('J15', [])).toBe('#venue=landing');
  });
});

describe('The Bandstand’s music', () => {
  // eventsForDay lists the Riverside's outings after today's five.
  const events = eventsForDay(PLAIN);
  const band = BANDS.find((band) => BAND_COPY[band].name === districtEvents(PLAIN)[1].name)!;

  it('plays the day’s band only near the stand, and never over the stage', () => {
    const concert = events[1];
    expect(trackForTown(concert.start - 0.01, events)).toBe('town');
    expect(trackForTown(concert.start - 0.01, events, { gain: 0.004 })).toBe('town');
    expect(trackForTown(concert.start - 0.01, events, { gain: 1 })).toBe(band);
    expect(trackForTown(1000, events, { gain: 0.5 })).toBe(band);
    expect(trackForTown(concert.start, events, { gain: 1 })).toBe(concert.id);
    // Between the sets the town plays its own tune.
    expect(trackForTown(1060, events, { gain: 1 })).toBe('town');
    // Without the Riverside in the list, today's answers.
    expect(
      trackForTown(
        1000,
        events.filter((event) => !event.outing),
        { gain: 1 },
      ),
    ).toBe('town');
  });

  it('has a playable track for every band, today’s acoustic notes until its own', () => {
    for (const id of BANDS) {
      expect(TRACKS[id].title.length).toBeGreaterThan(0);
      expect(durationOf(id)).toBeGreaterThan(30);
      expect(compose(id).length).toBeGreaterThan(100);
    }
  });
});

describe('The Riverside on the live stream', () => {
  it('films a festival on its days, else the day’s market or teatime set', () => {
    for (const day of YEAR) {
      const shots = liveDistrictShots(day).map((shot) => shot.outing);
      const festivals = [
        ...(regattaDay(day) ? ['regatta'] : []),
        ...(harvestDay(day) ? ['harvest-fair', 'long-table'] : []),
        ...(starNight(day) ? ['stargazing'] : []),
      ];
      expect(shots).toEqual(
        festivals.length
          ? festivals
          : [liveDistrictHighlight(day) === 'market' ? 'market' : 'bandstand-tea'],
      );
    }
    for (const shot of Object.values(DISTRICT_SHOTS)) {
      expect(shot.frame.width).toBeLessThanOrEqual(850);
      expect(shot.frame.height).toBeLessThanOrEqual(540);
    }
    expect(DISTRICT_SHOTS.stargazing.frame).toBe(BANDSTAND_FRAME);
  });

  it('puts a festival before the day’s events and the highlight after them, both protected', () => {
    // With nobody in town, a shot goes on air only when the program says someone is there.
    const program = (day: number) => ({
      ...liveProgram([], day),
      district: liveDistrictShots(day),
    });
    expect(liveProgram([], REGATTA).district).toEqual([]);
    const regatta = liveShotAt(program(REGATTA), 900, []);
    expect(regatta).toMatchObject({
      id: `district:${REGATTA}:regatta`,
      kind: 'event',
      label: DISTRICT_COPY.regatta.name(REGATTA),
      center: DISTRICT_FRAMES.regatta.center,
    });
    const highlight = liveDistrictShots(PLAIN)[0];
    const shot = liveShotAt(program(PLAIN), highlight.from, []);
    expect(shot.id).toBe(`district:${PLAIN}:${highlight.outing}`);
    expect(liveShotAt(program(PLAIN), highlight.to, []).id).not.toMatch(/^district:/);
    // Every district window is held clear of breaks, whether or not it airs: breaks never need
    // the plan.
    for (const day of [REGATTA, HARVEST, STARS, PLAIN]) {
      const start = day * TOWN_DAY_MS;
      // The day's own (a film night's stars before it may still run past midnight).
      const moments = protectedMoments(start, start + TOWN_DAY_MS, [sample]).filter(
        (moment) => moment.kind === 'district' && moment.start >= start,
      );
      expect(moments.map((moment) => (moment.start - start) / 1000)).toEqual(
        liveDistrictShots(day).map((shot) => shot.from),
      );
    }
  });

  it('bills a Riverside moment in “Coming up” only when it airs, from the minute it first does', () => {
    // The director films a district shot only when someone is planned there, and only while
    // nothing it ranks higher holds the air (the cinema over a festival, a busy afternoon at
    // the zoo over the teatime set). The card asks the same question (districtShotAirs), so it
    // never promises a moment that never comes. Checked against the director itself, every
    // quarter minute of each window, over a year of the frozen town.
    const town = FROZEN_TOWN;
    const seen = { aired: 0, late: 0, nobody: 0, held: 0 };
    for (let day = CALENDAR_EPOCH_DAY; day < CALENDAR_EPOCH_DAY + 112; day++) {
      const program = liveProgram(town, day);
      for (const shot of liveDistrictShots(day)) {
        let first: number | undefined;
        for (let time = shot.from; time < shot.to && first === undefined; time += 0.25) {
          const on = liveShotAt(program, time, simulateResidents(town, time, day));
          if (on.id === `district:${day}:${shot.outing}`) first = time;
        }
        const where = `${townCalendarAt(day).label}, ${shot.outing}`;
        expect(districtShotAirs(program, shot), where).toBe(first);
        const rows = comingUpAt(day * TOWN_DAY_MS + (shot.from - 30) * 1000, town, 8);
        const window = [shot.from, shot.to].map((minute) => day * TOWN_DAY_MS + minute * 1000);
        const row = rows.find(
          (candidate) =>
            candidate.title === shot.label &&
            candidate.startsAt >= window[0] &&
            candidate.startsAt < window[1],
        );
        if (first === undefined) {
          expect(row, where).toBeUndefined();
          if (program.district.some((candidate) => candidate.outing === shot.outing)) seen.held++;
          else seen.nobody++;
          continue;
        }
        expect(row?.startsAt, where).toBe(day * TOWN_DAY_MS + first * 1000);
        seen.aired++;
        if (first > shot.from) seen.late++;
      }
    }
    // The year has shots that air and days with nobody planned. Since the daily pick and the
    // film night's windows keep every shot clear of what ranks higher (live-director), nothing
    // planned is held off or airs late.
    expect(seen.aired).toBeGreaterThan(0);
    expect(seen.nobody).toBeGreaterThan(0);
    expect(seen.late).toBe(0);
    expect(seen.held).toBe(0);
  }, 60_000);
});

const AFTERNOONS = {
  morning: 'home',
  afternoon: 'stroll',
  evening: 'home',
  night: 'sleep',
} as const;
/** A neighbor out all morning on the house plot nearest Market Square. */
const shopper: Place = (() => {
  const square = getPlot('D14')!;
  const plot = [...HOUSE_PLOTS].sort(
    (a, b) =>
      Math.hypot(a.x - square.x, a.y - square.y) - Math.hypot(b.x - square.x, b.y - square.y),
  )[0];
  return placeSchema.parse({
    ...sample,
    id: 'riverside-shopper',
    plot: plot.id,
    resident: {
      ...sample.resident,
      routine: { morning: 'stroll', afternoon: 'home', evening: 'home', night: 'sleep' },
    },
  });
})();

describe('A Riverside guest on the way', () => {
  it('carries the market’s bag home only, by the day’s market', () => {
    const day = PLAIN;
    const market = districtEvents(day)[0];
    const [trip] = planHome(shopper, [{ event: market, seat: 3, period: 'morning' }]);
    expect(trip).toBeDefined();
    const approach = trip.route.slice(-3);
    expect(approach.at(-1)).toEqual({ x: 58.3, y: 15.75 });
    for (let t = trip.depart; t < trip.homeBy; t += 0.5) {
      const state = tripState(shopper, trip, t, day);
      if (state.event!.phase === 'returning')
        expect(state.carry).toEqual({
          kind: 'paper-bag',
          variant: MARKET_KINDS.indexOf(marketKind(day)),
        });
      else expect(state.carry).toBeUndefined();
    }
    expect(outingOf('market')!.carry!.leg).toBe('returning');
  });

  it('builds snowmen at lunch seats 0 and 1 and watches from the rest, on build days only', () => {
    const builders = vi.mocked(snowmenBuilderPose),
      watchers = vi.mocked(snowmenWatcherPose);
    const lunchGoer = { ...shopper, resident: { ...shopper.resident, routine: AFTERNOONS } };
    const facings = vi.mocked(snowmenBuilderFacing);
    const visit = (day: number, seat: number) => {
      const lunch = eventsForDay(day)[0];
      const [trip] = planHome(lunchGoer, [{ event: lunch, seat, period: 'afternoon' }]);
      return { trip, state: tripState(lunchGoer, trip, 870, day) };
    };
    const build = YEAR.find(snowmenDay)!;
    builders.mockClear();
    watchers.mockClear();
    facings.mockClear();
    const builder = visit(build, 0);
    expect(builder.state.pose).toBe('crouch');
    // With the guest's visit and the lunch's own pose at any minute.
    const [asked] = builders.mock.calls.at(-1)!;
    expect(asked).toMatchObject({ seat: 0, time: 870, day: build, home: lunchGoer });
    expect(asked).toMatchObject({ arrive: builder.trip.arrive, leave: builder.trip.leave });
    expect(['sit', 'sip', 'chat', 'read', 'play']).toContain(asked.lunch(800));
    // The builders face the way the snowmen's file says.
    expect(facings).toHaveBeenCalledWith(0, 870, build);
    expect(builder.state.facing).toBe('ne');
    expect(visit(build, 3).state.pose).toBe('cheer');
    expect(watchers.mock.calls.at(-1)![0]).toMatchObject({ seat: 3, time: 870, day: build });
    builders.mockClear();
    watchers.mockClear();
    facings.mockClear();
    visit(build + 1, 0);
    visit(build + 1, 3);
    expect(builders).not.toHaveBeenCalled();
    expect(watchers).not.toHaveBeenCalled();
    expect(facings).not.toHaveBeenCalled();
  });

  it('says where they are going in the outing’s own words, on foot and on the tube', () => {
    const base = {
      id: 'x',
      resident: sample.resident,
      home: sample,
      position: { x: 0, y: 0 },
      activity: 'stroll',
      moving: true,
      facing: 'se',
      walkPhase: 0,
      greeting: false,
    } satisfies Partial<ResidentState>;
    for (const id of OUTING_IDS) {
      const labels = DISTRICT_COPY[id].labels;
      for (const phase of ['going', 'waiting', 'attending', 'returning'] as const)
        expect(
          residentActivityLabel({
            ...base,
            event: { id, name: 'Anything', phase },
          } as ResidentState),
        ).toBe(labels[phase]);
      const transit = { stage: 'riding', from: 'C1', to: 'L15' } as ResidentTransit;
      expect(
        residentActivityLabel({
          ...base,
          transit,
          event: { id, name: 'Anything', phase: 'going' },
        } as ResidentState),
      ).toBe(`Riding the tube to ${labels.tube[0]}`);
      expect(
        residentActivityLabel({
          ...base,
          transit,
          event: { id, name: 'Anything', phase: 'returning' },
        } as ResidentState),
      ).toBe(`Riding the tube home from ${labels.tube[1]}`);
    }
  });
});

describe('The Riverside on the map', () => {
  const view = (center: Point, zoom = 1) => ({
    x: 720 - center.x * zoom,
    y: 450 - center.y * zoom,
    zoom,
  });

  it('calls every painter at its ground, floor, objects and sky, and sorts its objects', () => {
    const order: string[] = [];
    const added: (() => void)[] = [];
    for (const [id, painter] of Object.entries(DISTRICT_PAINTERS)) {
      for (const point of ['ground', 'floor', 'sky'] as const) {
        const before = painter[point];
        const spy = vi.fn((...args: unknown[]) => {
          order.push(`${id}:${point}`);
          (before as ((...args: unknown[]) => void) | undefined)?.(...args);
        });
        painter[point] = spy as never;
        added.push(() => {
          if (before) painter[point] = before as never;
          else delete painter[point];
        });
      }
      vi.spyOn(painter, 'objects').mockImplementation((_, scene) => {
        order.push(`${id}:objects`);
        expect(scene.plan().size).toBe(1);
        return [{ depth: -1e6, paint: () => order.push(`${id}:paint`) }];
      });
    }
    try {
      const { ctx } = recordingContext();
      renderCity({
        ctx: ctx as unknown as CanvasRenderingContext2D,
        width: 1440,
        height: 900,
        camera: view(plotCenter(getPlot('K15')!)),
        places: [shopper],
        selectedPlot: 'K15',
        hoveredPlot: null,
        night: false,
        showPlots: false,
        minutes: 600,
        day: PLAIN,
      });
      const ids = Object.keys(DISTRICT_PAINTERS);
      for (const point of ['sky', 'ground', 'floor', 'objects', 'paint'])
        expect(order.filter((entry) => entry.endsWith(`:${point}`))).toEqual(
          ids.map((id) => `${id}:${point}`),
        );
      // Sky first, then the cached ground, then the floor, then the sort.
      const first = (point: string) => order.findIndex((entry) => entry.endsWith(`:${point}`));
      expect(first('sky')).toBeLessThan(first('ground'));
      expect(first('ground')).toBeLessThan(first('floor'));
      expect(first('floor')).toBeLessThan(first('objects'));
      expect(first('objects')).toBeLessThan(first('paint'));
    } finally {
      for (const undo of added) undo();
    }
  });

  it('hands a click to a painter’s hit when it is in front', () => {
    const market = DISTRICT_PAINTERS.market;
    const point = plotCenter(getPlot('E15')!);
    market.hit = vi.fn(() => ({ plot: 'E15', depth: 1e6 }));
    try {
      expect(cityHit(point, [], [])).toEqual({ kind: 'place', id: 'E15' });
      expect(market.hit).toHaveBeenCalledWith(
        point,
        expect.objectContaining({ day: 0, minutes: 720, places: [] }),
      );
    } finally {
      delete market.hit;
    }
    expect(cityHit(point, [], [])).toBeUndefined();
  });

  it('draws what a guest carries through its sprite, and reaches as high as it does', () => {
    const sprite = CARRY_SPRITES['paper-bag'];
    const draw = vi.spyOn(sprite, 'draw');
    const grip = vi
      .spyOn(sprite, 'grip')
      .mockReturnValue({ anchor: { x: 5, y: -6 }, behind: true });
    const { ctx } = recordingContext();
    const state = {
      moving: true,
      facing: 'sw',
      walkPhase: 0.25,
      greeting: false,
      carry: { kind: 'paper-bag', variant: 2 },
    } as const;
    drawResident(ctx as unknown as CanvasRenderingContext2D, sample.resident, 0, 0, 1, state, {
      night: true,
    });
    expect(grip).toHaveBeenCalledWith('sw', 0.25);
    expect(draw).toHaveBeenCalledWith(expect.anything(), 5, -6, 2, sample.resident, true);
    const plain = residentReach(ctx as unknown as CanvasRenderingContext2D, sample.resident);
    const height = vi.spyOn(sprite, 'height', 'get').mockReturnValue(9);
    expect(
      residentReach(ctx as unknown as CanvasRenderingContext2D, sample.resident, state).above,
    ).toBe(plain.above + 9);
    height.mockRestore();
    // A seasonal round's object takes the hands instead.
    draw.mockClear();
    drawResident(ctx as unknown as CanvasRenderingContext2D, sample.resident, 0, 0, 1, {
      ...state,
      errand: { kind: 'harvest', phase: 'carrying', progress: 0.5 } as never,
    });
    expect(draw).not.toHaveBeenCalled();
  });

  it('dresses the scarecrow for the fair through its one hook', () => {
    const { ctx } = recordingContext();
    for (const object of drawFarm(ctx as unknown as CanvasRenderingContext2D, 600, HARVEST, true))
      object.paint();
    expect(drawScarecrowExtras).toHaveBeenCalledWith(ctx, 0, 0, HARVEST, true);
  });

  it('builds snowmen on the green instead of setting out books and games', () => {
    const green = VENUES.find((venue) => venue.id === 'green')!;
    const lunch = eventsForDay(PLAIN)[0];
    const books = (variant?: 'snowmen') => {
      const { ctx, calls } = recordingContext();
      drawVenue(
        ctx as unknown as CanvasRenderingContext2D,
        green,
        0,
        0,
        false,
        { ...lunch, id: 'books', ...(variant ? { variant } : {}) },
        800,
      );
      return calls.filter((call) => call.fillStyle === '#799C96').length;
    };
    expect(books()).toBeGreaterThan(0);
    expect(books('snowmen')).toBe(0);
  });

  it('keeps the Riverside’s marks, frames and panels in the shared files', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('DISTRICT_PANELS.harvest');
    expect(app).toContain('DISTRICT_PANELS[selectedVenue.kind]');
    expect(app).toContain('<GreenNote day={clock.day} minutes={clock.minutes} />');
    expect(app).toContain('trackForTown(clock.minutes, events, bandstandListening)');
    expect(app).toContain('attending={attending}');
    expect(app).not.toContain("import FarmInfo from './components/FarmInfo'");
    const city = readFileSync('src/components/City.tsx', 'utf8');
    expect(city).toContain('frameCamera(district, width, height)');
    // On a harvest day the farm's panel opens on the fair (farmPanelFrame), read through a ref.
    expect(city).toContain('farmPanelFrame(dayRef.current)');
    expect(city).toContain('bandstandListening(renderedCamera');
    const live = readFileSync('src/components/LiveStream.tsx', 'utf8');
    expect(live).toContain('bandstandListening(camera.current');
    expect(live).toContain('trackForTown(clock.minutes, events, bandstandField)');
    // Every outing has its card and its copy.
    for (const spec of OUTINGS)
      expect(DISTRICT_COPY[spec.id].labels.going.length).toBeGreaterThan(0);
  });
});
