// The Harvest Fair and the Long Table (SPEC §4.3), agent D: what the guests do at their spots,
// the dish they carry to supper, and the farm panel's Harvest Fair section. The art is checked in
// tests/district-render-harvest.test.ts.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import FarmInfo from '../src/components/FarmInfo';
import { DISH_HEIGHT, DISHES, dishSprite, drawDish } from '../src/city/carry/dish';
import { DISTRICT_COPY, PANEL_COPY } from '../src/lib/district-copy';
import { farmPanelFrame, HARVEST_FRAME } from '../src/lib/district-places';
import { frameView } from '../src/lib/map-view';
import { project } from '../src/lib/world';
import { harvestDay, OUTING_TIMES } from '../src/lib/district-calendar';
import type { EventPose } from '../src/lib/events';
import { outingOf, type PoseContext } from '../src/lib/outings';
import {
  FAIR_CALM,
  FAIR_CLOSES,
  fairPose,
  fairSpells,
  HARVEST_HOLD,
  STRAW_SETTLE,
  tablePose,
} from '../src/lib/outings/harvest';
import { residentTrips, tripState, type ResidentTrip } from '../src/lib/resident-trips';
import type { Place } from '../src/lib/schema';
import type { ResidentState } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY, townCalendarAt } from '../src/lib/town-calendar';
import { TOWNS } from './district';
import { recordingContext } from './recording-context';
import { rosterTimeout } from './roster-timeout';

const town: Place[] = TOWNS.full;
const dayOf = (season: string, date: number) =>
  Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + i).find((day) => {
    const calendar = townCalendarAt(day);
    return calendar.season === season && calendar.date === date;
  })!;
const A23 = dayOf('Autumn', 23);
const FAIR_DAYS = [A23, A23 + 1, A23 + 2];

/** Every fair and table guest of the three days, with the context their pose is asked with. */
function guests() {
  const out: { home: Place; trip: ResidentTrip; day: number }[] = [];
  for (const day of FAIR_DAYS)
    for (const [id, trips] of residentTrips(town, day))
      for (const trip of trips)
        if (trip.event.outing === 'harvest-fair' || trip.event.outing === 'long-table')
          out.push({ home: town.find((place) => place.id === id)!, trip, day });
  return out;
}
const STEP = 0.05;
/** A guest's poses over their whole visit, as runs of one pose: [pose, from, to]. */
function runs(pose: (c: PoseContext) => EventPose | undefined, home: Place, trip: ResidentTrip) {
  const { arrive, leave, seat } = trip;
  const list: [EventPose | undefined, number, number][] = [];
  for (let time = arrive; time < leave; time += STEP) {
    const now = pose({ home, trip, time, day: 0, seat, arrive, leave });
    const last = list.at(-1);
    if (last && last[0] === now) last[2] = Math.min(leave, time + STEP);
    else list.push([now, time, Math.min(leave, time + STEP)]);
  }
  return list;
}

describe('Harvest Fair guests', () => {
  it(
    'stand at first and last, and sit a spell or two on the straw seat, a minute at least each',
    () => {
      let seated = 0,
        visits = 0;
      for (const { home, trip } of guests()) {
        if (trip.event.outing !== 'harvest-fair') continue;
        visits++;
        const list = runs(fairPose, home, trip);
        const where = `${home.id} at the fair from ${trip.arrive.toFixed(1)}`;
        // Standing on arrival and before leaving, for FAIR_CALM at least.
        expect(list[0][0], where).toBeUndefined();
        expect(list[0][2] - list[0][1], where).toBeGreaterThanOrEqual(FAIR_CALM - STEP);
        expect(list.at(-1)![0], where).toBeUndefined();
        expect(list.at(-1)![2] - list.at(-1)![1], where).toBeGreaterThanOrEqual(FAIR_CALM - STEP);
        list.forEach(([pose, from, to], i) => {
          expect([undefined, 'crouch', 'sit', 'sip', 'chat'], where).toContain(pose);
          if (pose === 'crouch') {
            // Halfway down between standing and the seat, a moment each way.
            expect(to - from, where).toBeCloseTo(STRAW_SETTLE, 0);
            const around = [list[i - 1][0], list[i + 1][0]];
            expect(
              around.filter((p) => p === undefined),
              where,
            ).toHaveLength(1);
          } else expect(to - from, where).toBeGreaterThanOrEqual(HARVEST_HOLD - STEP);
          if (pose === 'sit' || pose === 'sip' || pose === 'chat') seated++;
          // Never straight from standing to the seat, or back.
          if (i && pose !== 'crouch' && list[i - 1][0] !== 'crouch')
            expect(pose === undefined || list[i - 1][0] === undefined, where).toBe(false);
        });
      }
      // Twelve a day for three days, and most of them sit down for a while.
      expect(visits).toBe(36);
      expect(seated).toBeGreaterThan(36);
    },
    rosterTimeout(0.2, 60_000),
  );

  it('keeps every spell inside the visit and before the fair closes, with a stand between', () => {
    for (const stay of [20, 45, 120, 240])
      for (const closes of [stay, stay - 10, 30])
        for (const id of ['a', 'b', 'full-town-c4', 'renan']) {
          const spells = fairSpells(id, stay, closes);
          spells.forEach(([from, to], i) => {
            expect(from).toBeGreaterThanOrEqual(FAIR_CALM);
            expect(to).toBeLessThanOrEqual(stay - FAIR_CALM);
            expect(to).toBeLessThanOrEqual(closes);
            expect(to - from).toBeGreaterThanOrEqual(2 * STRAW_SETTLE + HARVEST_HOLD);
            if (i) expect(from - spells[i - 1][1]).toBeGreaterThanOrEqual(2);
          });
        }
    // A stop of a few minutes is spent on their feet.
    expect(fairSpells('a', 4)).toEqual([]);
  });

  it('are all on their feet by 17:00, when the fair closes and the seats are gathered up', () => {
    let late = 0;
    for (const town of [TOWNS.real, TOWNS.full])
      for (const day of FAIR_DAYS)
        for (const [id, trips] of residentTrips(town, day))
          for (const trip of trips) {
            if (trip.event.outing !== 'harvest-fair') continue;
            const home = town.find((place) => place.id === id)!;
            if (trip.leave > FAIR_CLOSES) late++;
            for (const [pose, from, to] of runs(fairPose, home, trip))
              if (pose !== undefined) {
                expect(from, `${id} on ${day}`).toBeLessThan(FAIR_CLOSES);
                expect(to, `${id} on ${day}`).toBeLessThanOrEqual(FAIR_CLOSES + STEP);
              }
          }
    // Some stay on past the close to say their goodbyes, standing.
    expect(late).toBeGreaterThan(0);
  });
});

describe('Long Table guests', () => {
  it(
    'sit, sip and chat, each for a minute at least, from sitting down to getting up',
    () => {
      let visits = 0;
      const seen = new Set<EventPose | undefined>();
      for (const { home, trip } of guests()) {
        if (trip.event.outing !== 'long-table') continue;
        visits++;
        const list = runs(tablePose, home, trip);
        const where = `${home.id} at the table from ${trip.arrive.toFixed(1)}`;
        expect(list[0][0], where).toBe('sit');
        for (const [pose, from, to] of list) {
          seen.add(pose);
          expect(['sit', 'sip', 'chat'], where).toContain(pose);
          expect(to - from, where).toBeGreaterThanOrEqual(HARVEST_HOLD - STEP);
        }
      }
      expect(visits).toBe(48);
      expect([...seen].sort()).toEqual(['chat', 'sip', 'sit']);
    },
    rosterTimeout(0.2, 60_000),
  );

  it(
    'are drawn as the pose says, crouching a moment on the way down and up',
    () => {
      for (const { home, trip, day } of guests().filter(
        (_, i) => i % 5 === 0, // a sample: tripState walks the plan
      )) {
        const { arrive, leave } = trip;
        const mid = (arrive + leave) / 2;
        const state = tripState(home, trip, mid, day);
        const spec = outingOf(trip.event.outing!)!;
        const asked = spec.pose({ home, trip, time: mid, day, seat: trip.seat, arrive, leave });
        expect(state.event?.phase).toBe('attending');
        expect(state.pose).toBe(asked);
        if (trip.event.outing === 'long-table') {
          expect(tripState(home, trip, arrive + 0.1, day).pose).toBe('crouch');
          expect(tripState(home, trip, leave - 0.1, day).pose).toBe('crouch');
        }
      }
    },
    rosterTimeout(0.2, 60_000),
  );

  it('carry their dish there only: a pie, a loaf or a jar', () => {
    const variants = new Set<number>();
    for (const { home, trip, day } of guests()) {
      if (trip.event.outing !== 'long-table') continue;
      const going = tripState(home, trip, trip.arrive - 1, day);
      expect(going.carry?.kind).toBe('dish');
      variants.add(going.carry!.variant);
      expect(tripState(home, trip, trip.arrive + 1, day).carry).toBeUndefined();
      expect(tripState(home, trip, trip.leave + 1, day).carry).toBeUndefined();
    }
    expect([...variants].sort()).toEqual([0, 1, 2]);
  });
});

describe('The dish', () => {
  it('is a pie, a loaf or a jar, each within a figure’s shoulders and below its chest', () => {
    expect(DISHES).toHaveLength(3);
    for (let variant = 0; variant < 3; variant++) {
      const { ctx, calls } = recordingContext();
      drawDish(ctx, 0, 0, variant, false);
      const rects = calls.filter((call) => call.name === 'fillRect');
      expect(rects.length).toBeGreaterThan(8);
      for (const call of rects) {
        const [x, y, w, h] = call.args as number[];
        expect(x).toBeGreaterThanOrEqual(-4);
        expect(x + w).toBeLessThanOrEqual(5);
        expect(y).toBeGreaterThanOrEqual(-DISH_HEIGHT);
        expect(y + h).toBeLessThanOrEqual(0);
      }
    }
    // The same pixels on every variant number the hash can give.
    const a = recordingContext(),
      b = recordingContext();
    drawDish(a.ctx, 0, 0, 4, false);
    drawDish(b.ctx, 0, 0, 1, false);
    expect(a.calls.map((c) => c.args)).toEqual(b.calls.map((c) => c.args));
  });

  it('rides in front facing us and out past the near shoulder walking away', () => {
    for (const facing of ['se', 'sw'] as const) {
      const grip = dishSprite.grip(facing, 0);
      expect(grip.behind).toBe(false);
      expect(grip.anchor.x).toBeGreaterThan(3);
    }
    for (const facing of ['ne', 'nw'] as const) {
      const grip = dishSprite.grip(facing, 0);
      expect(grip.behind).toBe(true);
      expect(grip.anchor.x).toBeGreaterThanOrEqual(7);
    }
    // It rides the walking bob, a pixel at most.
    const bobs = [0, 0.1, 0.25, 0.4, 0.5].map((phase) => dishSprite.grip('se', phase).anchor.y);
    expect(Math.max(...bobs) - Math.min(...bobs)).toBeLessThanOrEqual(1);
    expect(dishSprite.height).toBe(DISH_HEIGHT);
  });

  it('darkens at night with the figure that carries it', () => {
    const day = recordingContext(),
      night = recordingContext();
    drawDish(day.ctx, 0, 0, 0, false);
    drawDish(night.ctx, 0, 0, 0, true);
    expect(night.calls.map((c) => c.args)).toEqual(day.calls.map((c) => c.args));
    expect(night.fills).not.toEqual(day.fills);
  });
});

describe('The farm panel', () => {
  const resident = (id: string, name: string, outing: string, phase: string) =>
    ({
      id,
      resident: { name },
      event: { id: outing, name: outing, phase },
    }) as unknown as ResidentState;
  const render = (
    day: number,
    minutes: number,
    residents: ResidentState[] = [],
    selected: string | null = null,
  ) =>
    renderToStaticMarkup(
      createElement(FarmInfo, {
        day,
        minutes,
        residents,
        places: [],
        onFollow: () => {},
        selected,
      }),
    );
  const headings = (markup: string) =>
    [...markup.matchAll(/<h3>(.*?)<\/h3>/g)].map(([, heading]) => heading);
  const TABLE = `${DISTRICT_COPY['long-table'].name(A23)}.`;

  it('keeps the farm’s own line and says when the fair is out of season', () => {
    for (const off of [dayOf('Spring', 9), dayOf('Autumn', 10)]) {
      expect(harvestDay(off)).toBe(false);
      const markup = render(off, 600);
      expect(markup).toContain('PUBLIC SPACE · S4–T9 · 12 PLOTS');
      expect(markup).toContain(PANEL_COPY.harvest.heading);
      expect(markup).toContain(PANEL_COPY.harvest.dates);
      expect(markup).toContain(PANEL_COPY.harvest.next);
      expect(markup).not.toContain('NOW</span>');
      // One forward-looking line, never the fair's present tense beside a field still growing.
      expect(markup).toContain(PANEL_COPY.harvest.body);
      expect(markup).not.toContain(DISTRICT_COPY['harvest-fair'].description(off));
      expect(markup).not.toContain(DISTRICT_COPY['long-table'].description(off));
    }
    const fair = render(A23, 600);
    expect(fair).toContain(DISTRICT_COPY['harvest-fair'].description(A23));
    expect(fair).toContain(DISTRICT_COPY['long-table'].description(A23));
    expect(fair).not.toContain(PANEL_COPY.harvest.body);
  });

  it('opens the farm on the fair on its days, centred beside the panel or above the sheet', () => {
    for (const [date, fair] of [
      [22, false],
      [23, true],
      [24, true],
      [25, true],
      [26, false],
    ] as const)
      expect(farmPanelFrame(dayOf('Autumn', date)), `Autumn ${date}`).toBe(
        fair ? HARVEST_FRAME : undefined,
      );
    // The table's middle sits where the panel view centres a frame.
    const table = project(18, 77.5);
    for (const [width, height, x, y] of [
      [1440, 900, (1440 - 370) / 2, 450],
      [390, 844, 195, 844 * 0.29],
    ]) {
      const view = frameView(HARVEST_FRAME, width, height);
      const screen = { x: table.x * view.zoom + view.x, y: table.y * view.zoom + view.y };
      expect(Math.hypot(screen.x - x, screen.y - y), `${width} × ${height}`).toBeLessThan(100);
    }
  });

  it('gives the day’s program on a fair day, with names only while they are there', () => {
    const markup = render(A23, 920, [
      resident('a', 'Hazel', 'harvest-fair', 'attending'),
      resident('b', 'Jon', 'harvest-fair', 'going'),
      resident('c', 'Renan', 'harvest-fair', 'attending'),
      resident('d', 'Gemma', 'long-table', 'going'),
    ]);
    for (const id of ['harvest-fair', 'long-table'] as const)
      expect(markup).toContain(DISTRICT_COPY[id].panelEyebrow);
    // The fair's heading is the farm's own, the same all year; the table's is its name.
    expect(headings(markup)).toEqual([PANEL_COPY.harvest.heading, TABLE]);
    expect(render(dayOf('Autumn', 20), 920)).toContain(`<h3>${PANEL_COPY.harvest.heading}</h3>`);
    expect(markup).toContain('13:00–17:00 · Happening now');
    expect(markup).toContain('18:30–20:30 · Later today');
    // The district panels' one row shape: an eyebrow, then a row each (figure, name, doing).
    expect(markup).toContain(PANEL_COPY.harvest.fairHere);
    expect(markup).toMatch(/Hazel.*Renan/);
    expect(markup).toContain(DISTRICT_COPY['harvest-fair'].labels.attending);
    expect(markup).not.toContain('Jon');
    expect(markup).not.toContain('Gemma');
    expect(markup).not.toContain(PANEL_COPY.harvest.tableHere);
    // The next fair is tomorrow's, not next year's.
    expect(markup).not.toContain(PANEL_COPY.harvest.next);
  });

  it('leads with the outing chosen, else the one on now, then the one to come', () => {
    expect(headings(render(A23, 920))).toEqual([PANEL_COPY.harvest.heading, TABLE]);
    // After the fair, before and during supper, the table leads.
    for (const minutes of [1080, 1215])
      expect(headings(render(A23, minutes)), `${minutes}`).toEqual([
        TABLE,
        PANEL_COPY.harvest.heading,
      ]);
    // Chosen from its card, the table leads while the fair is still on.
    expect(headings(render(A23, 920, [], 'long-table'))).toEqual([
      TABLE,
      PANEL_COPY.harvest.heading,
    ]);
  });

  it('names the next fair once the last Long Table is over', () => {
    const last = A23 + 2;
    expect(render(last, OUTING_TIMES['long-table'].end - 1)).not.toContain(PANEL_COPY.harvest.next);
    expect(render(last, OUTING_TIMES['long-table'].end + 1)).toContain(PANEL_COPY.harvest.next);
  });

  it('speaks in the town’s voice: no exclamation marks, headings end in a period', () => {
    for (const [day, minutes] of [
      [A23, 600],
      [A23, 1170],
      [A23 + 5, 900],
    ]) {
      const markup = render(day, minutes);
      expect(markup).not.toContain('!');
      for (const [, heading] of markup.matchAll(/<h3>(.*?)<\/h3>/g))
        expect(heading.endsWith('.')).toBe(true);
    }
    // The panel's new style uses no tokens it does not declare: none at all.
    expect(readFileSync('src/components/harvest-panel.css', 'utf8')).not.toContain('var(');
  });
});
