import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { placeSchema, validatePlaces } from '../src/lib/schema';
import { compileSign, SIGN_EXAMPLE } from '../src/lib/sign';
import { periodAt, roadPath, simulateResidents, timeLabel } from '../src/lib/simulation';
import { getPlot, plotEntrance, project, ROAD_MAX_X, ROAD_MAX_Y } from '../src/lib/world';
import { eventsForDay, HOUSE_PLOTS, insideVenue } from '../src/lib/events';
import { insideFootball } from '../src/lib/football';
import { TUBE_TRUNK_X } from '../src/lib/tubes';
import { onRoadOrTube, riding } from './tube-riders';

const places = readdirSync('places')
  .filter((file) => file.endsWith('.json'))
  .map((file) => placeSchema.parse(JSON.parse(readFileSync(`places/${file}`, 'utf8'))));
const sample = places[0];

describe('Exterior artwork is data, not a webpage', () => {
  it('compiles text, inherited styles and character entities into drawing instructions', () => {
    const art = compileSign(SIGN_EXAMPLE);
    expect(art.background).toBe('#35554A');
    expect(art.lines).toHaveLength(2);
    expect(art.lines[0]).toMatchObject({
      text: 'HELLO, NEIGHBOR',
      size: 24,
      bold: true,
      color: '#FFF4D4',
    });
    expect(compileSign('<p>Tea &amp; cake</p>').lines[0].text).toBe('Tea & cake');
  });
  it.each([
    '<script>alert(1)</script>',
    '<img src="https://example.com/pixel">',
    '<a href="javascript:alert(1)">Hello</a>',
    '<svg onload="alert(1)"></svg>',
    '<div onclick="alert(1)">Hi</div>',
    '<iframe srcdoc="hello"></iframe>',
    '<div style="background-image: url(https://example.com)">Hi</div>',
    '<div style="color: var(--secret)">Hi</div>',
    '<form>Hi</form>',
    '<style>@import "https://example.com";</style>',
    '<div style="position:fixed">Hi</div>',
    '<span style="font-size:999px">Hi</span>',
    '<div id="town">Hi</div>',
  ])('rejects executable, external or unbounded markup: %s', (html) => {
    expect(() => compileSign(html)).toThrow();
    expect(
      placeSchema.safeParse({ ...sample, sign: { ...sample.sign, mode: 'html', html } }).success,
    ).toBe(false);
  });
  it('bounds source size, nesting, line count and line length', () => {
    for (const html of [
      'x'.repeat(2001),
      '<div>'.repeat(10) + 'Hi' + '</div>'.repeat(10),
      '<p>Hi</p>'.repeat(4),
      '<p>' + 'x'.repeat(25) + '</p>',
    ])
      expect(() => compileSign(html)).toThrow();
  });
  it('preserves escaped markup as harmless text', () => {
    expect(compileSign('<p>&lt;script&gt;</p>').lines[0].text).toBe('<script>');
  });
});

describe('A small predictable daily life', () => {
  it('faces in the direction of movement on all four isometric road directions', () => {
    const seen = new Set<string>();
    for (let time = 361; time < 1319; time += 2.37) {
      const now = simulateResidents(places, time),
        next = simulateResidents(places, time + 0.0001);
      now.forEach((state, index) => {
        expect(state.walkPhase).toBeGreaterThanOrEqual(0);
        expect(state.walkPhase).toBeLessThan(1);
        if (!state.moving || !next[index].moving || state.facing !== next[index].facing) return;
        const a = project(state.position.x, state.position.y),
          b = project(next[index].position.x, next[index].position.y);
        const direction = `${b.y > a.y ? 's' : 'n'}${b.x > a.x ? 'e' : 'w'}`;
        expect(state.facing).toBe(direction);
        seen.add(direction);
      });
    }
    expect([...seen].sort()).toEqual(['ne', 'nw', 'se', 'sw']);
  });
  it('derives the same state regardless of visit order and replay direction', () => {
    const before = simulateResidents(places, 810.25);
    simulateResidents(places, 1300);
    expect(simulateResidents(places, 810.25)).toEqual(before);
    expect(simulateResidents([...places].reverse(), 810.25).reverse()).toEqual(before);
    expect(simulateResidents(places, 810.25 + 1440)).toEqual(before);
  });
  it('keeps residents on roads except when entering their assigned public venue', () => {
    const wanderers = places.map((place) => ({
      ...place,
      resident: {
        ...place.resident,
        routine: {
          morning: 'stroll' as const,
          afternoon: 'stroll' as const,
          evening: 'stroll' as const,
          night: 'sleep' as const,
        },
      },
    }));
    for (let minute = 360; minute < 1320; minute += 2.75)
      for (const state of simulateResidents(wanderers, minute)) {
        const event = eventsForDay(0).find((event) => event.id === state.event?.id);
        expect(
          onRoadOrTube(state) ||
            (state.event?.id === 'football' && insideFootball(state.position)) ||
            (event && insideVenue(event.venue, state.position)),
        ).toBe(true);
        // Only the tube runs west of the lane, behind the trees.
        expect(state.position.x).toBeGreaterThanOrEqual(riding(state) ? TUBE_TRUNK_X : 1.5);
        expect(state.position.y).toBeLessThanOrEqual(ROAD_MAX_Y + 0.5);
      }
  });
  it('continues trips across free periods and returns home by bedtime', () => {
    const wanderer = {
      ...sample,
      resident: {
        ...sample.resident,
        routine: {
          morning: 'stroll' as const,
          afternoon: 'stroll' as const,
          evening: 'stroll' as const,
          night: 'sleep' as const,
        },
      },
    };
    const plot = getPlot(sample.plot)!;
    for (const boundary of [720, 1080, 1320]) {
      const before = simulateResidents([wanderer], boundary - 0.001)[0];
      const after = simulateResidents([wanderer], boundary)[0];
      expect(
        Math.hypot(after.position.x - before.position.x, after.position.y - before.position.y),
      ).toBeLessThan(0.001);
      if (boundary === 1320) expect(after.position).toEqual(plotEntrance(plot));
    }
  });
  it('keeps sleepers indoors and follows daytime activity choices', () => {
    expect(
      simulateResidents(
        places.filter((place) => place.resident.routine.night === 'sleep'),
        0,
      ).every((state) => state.activity === 'sleep' && !state.moving),
    ).toBe(true);
    for (const [time, period] of [
      [540, 'morning'],
      [810, 'afternoon'],
      [1200, 'evening'],
    ] as const)
      for (const state of simulateResidents(places, time))
        expect(state.activity).toBe(state.resident.routine[period]);
    expect(
      placeSchema.safeParse({
        ...sample,
        resident: {
          ...sample.resident,
          routine: { morning: 'meet-milo', afternoon: 'stroll', evening: 'home' },
        },
      }).success,
    ).toBe(false);
  });
  it('greets nearby walkers without naming a meeting partner', () => {
    // Include enough local strollers to keep walkers outside the event guest lists.
    const neighbors = HOUSE_PLOTS.slice(0, 24).map((plot, index) => ({
      ...sample,
      id: `greeting-${index}`,
      plot: plot.id,
      resident: {
        ...sample.resident,
        routine: {
          morning: 'stroll' as const,
          afternoon: 'stroll' as const,
          evening: 'stroll' as const,
          night: 'sleep' as const,
        },
      },
    }));
    let found = false;
    for (let minute = 360; minute < 1320; minute++) {
      const states = simulateResidents(neighbors, minute);
      for (const resident of states.filter((state) => state.greeting)) {
        found = true;
        expect(resident.activity).toBe('stroll');
        expect(
          states.some(
            (other) =>
              other.id !== resident.id &&
              other.greeting &&
              Math.hypot(
                other.position.x - resident.position.x,
                other.position.y - resident.position.y,
              ) < 1.4,
          ),
        ).toBe(true);
      }
    }
    expect(found).toBe(true);
  });
  it('finds connected road routes and wraps clock labels', () => {
    const route = roadPath({ x: 1.5, y: 1.5 }, { x: ROAD_MAX_X + 0.5, y: ROAD_MAX_Y + 0.5 });
    expect(route.at(-1)).toEqual({ x: ROAD_MAX_X + 0.5, y: ROAD_MAX_Y + 0.5 });
    for (let i = 1; i < route.length; i++)
      expect(Math.abs(route[i].x - route[i - 1].x) + Math.abs(route[i].y - route[i - 1].y)).toBe(1);
    expect(timeLabel(1440)).toBe('00:00');
    expect(timeLabel(-1)).toBe('23:59');
    expect(periodAt(1320)).toBe('night');
  });
  it('keeps the starter credit reserved for the original starter files', () => {
    expect(
      validatePlaces([
        { file: 'new-starter.json', data: { ...sample, id: 'new-starter', creator: 'forktown' } },
      ]).errors.join(' '),
    ).toContain('reserved');
  });
});
