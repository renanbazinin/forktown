import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { placeSchema } from '../src/lib/schema';
import { EVENT_SPOTS, HOUSE_PLOTS, VENUES, venueAt } from '../src/lib/events';
import {
  findPlotAt,
  getPlot,
  isRoad,
  plotEntrance,
  STREETLIGHTS,
  type Point,
} from '../src/lib/world';
import { CINEMA_ENTRANCE } from '../src/lib/cinema';
import { FOOTBALL_ENTRANCE, FOOTBALL_VENUE } from '../src/lib/football';
import { MILLPOND_GATE, MILLPOND_VENUE } from '../src/lib/millpond';
import { ZOO_ENTRANCE } from '../src/lib/zoo';
import {
  alongRoute,
  MAX_TRAVEL_SPEED_MULTIPLIER,
  planJourney,
  planTravel,
  roadPath,
  routeLength,
  WALK_SPEED,
} from '../src/lib/walking';
import {
  isTubePlot,
  TUBE_ALIGHT,
  TUBE_ALTITUDE,
  TUBE_BOARD,
  TUBE_LINE_NAME,
  TUBE_MIN_SAVING,
  TUBE_PARCELS,
  TUBE_PLOTS,
  TUBE_SIGN,
  TUBE_SIGN_LINES,
  TUBE_SPEED,
  TUBE_STACK_WALK,
  TUBE_STATIONS,
  TUBE_TRUNK_X,
  TUBE_VENUE,
  tubeAt,
  tubeFixedMinutes,
  tubeFrame,
  tubeInStack,
  tubeLength,
  tubeParcelMinutes,
  tubeParcelSlots,
  tubeRoute,
  tubeStageTime,
} from '../src/lib/tubes';
import {
  joinApproach,
  journeyAt,
  legsMinutes,
  paceLegs,
  reverseLegs,
  tubeChoice,
  tubeLegs,
  tubeLineMinutes,
  walkingPace,
} from '../src/lib/tube-journeys';
import { eventApproach } from '../src/lib/resident-trips';
import { onRoadOrTube, onTubeLine } from './tube-riders';

const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const DESTINATIONS = {
  stage: plotEntrance(getPlot('B5')!),
  green: plotEntrance(getPlot('C5')!),
  cinema: CINEMA_ENTRANCE,
  football: FOOTBALL_ENTRANCE,
  millpond: MILLPOND_GATE,
  zoo: ZOO_ENTRANCE,
};
const [FIRST, LAST] = [TUBE_STATIONS[0].id, TUBE_STATIONS.at(-1)!.id];

describe('The Treeline stations', () => {
  it('reserves C1 and N1 and leaves 141 house plots', () => {
    expect(TUBE_PLOTS).toEqual(['C1', 'N1']);
    expect(HOUSE_PLOTS).toHaveLength(141);
    for (const plot of TUBE_PLOTS) {
      expect(isTubePlot(plot)).toBe(true);
      expect(venueAt(plot)).toBeUndefined();
      expect(HOUSE_PLOTS.some((p) => p.id === plot)).toBe(false);
      const result = placeSchema.safeParse({ ...sample, plot });
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.message)).toContain(
        'This plot is reserved for a public town venue. Choose a house plot.',
      );
    }
    for (const plot of ['B1', 'D1', 'C2', 'M1', 'O1', 'N2']) {
      expect(isTubePlot(plot)).toBe(false);
      expect(placeSchema.safeParse({ ...sample, plot }).success).toBe(true);
    }
    for (const file of readdirSync('places').filter((f) => f.endsWith('.json')))
      expect(TUBE_PLOTS).not.toContain(JSON.parse(readFileSync(`places/${file}`, 'utf8')).plot);
    expect(TUBE_VENUE).toEqual({ id: 'tube', plot: 'C1', name: 'The Treeline', kind: 'tube' });
  });
  it('lists the stations in order along the line, north to south, so the ends are first and last', () => {
    // A new station goes in at its row, not at the end: [0] and at(-1) are the line's two ends.
    for (let i = 1; i < TUBE_STATIONS.length; i++)
      expect(TUBE_STATIONS[i].dock.y).toBeGreaterThan(TUBE_STATIONS[i - 1].dock.y);
    expect([FIRST, LAST]).toEqual(['C1', 'N1']);
  });
  it('keeps every road and lamp: a one-plot station removes nothing', () => {
    for (const station of TUBE_STATIONS) {
      const plot = getPlot(station.plot)!;
      for (let d = -2; d <= 2; d++) {
        expect(isRoad(1, plot.y + d)).toBe(true);
        expect(isRoad(plot.x + d, plot.y + 2)).toBe(true);
      }
    }
    expect(STREETLIGHTS.some((p) => p.x === 5 && p.y === 9)).toBe(true);
    expect(STREETLIGHTS.some((p) => p.x === 5 && p.y === 57)).toBe(true);
  });
  it('puts the sign on the first station, word for word, and names the line in the house voice', () => {
    expect(TUBE_SIGN).toBe('People & parcels. Please remove umbrella.');
    expect(TUBE_SIGN_LINES).toHaveLength(3);
    expect(TUBE_SIGN_LINES.join(' ')).toBe(TUBE_SIGN);
    expect(TUBE_STATIONS.map((s) => [s.id, s.name])).toEqual([
      ['C1', 'Hedgerow Halt'],
      ['N1', 'Willow Halt'],
    ]);
    expect(TUBE_LINE_NAME).toBe('The Treeline');
    for (const text of [
      TUBE_SIGN,
      ...TUBE_SIGN_LINES,
      TUBE_LINE_NAME,
      ...TUBE_STATIONS.map((s) => s.name),
    ])
      expect(text).not.toMatch(/forktown|!/i);
  });
  it('waits at the road door, stands its stack 0.7 tiles in, and turns at the plot centre', () => {
    for (const [station, y] of [
      [TUBE_STATIONS[0], 12.8],
      [TUBE_STATIONS[1], 56.8],
    ] as const) {
      const plot = getPlot(station.plot)!;
      expect(station.door).toEqual(plotEntrance(plot));
      expect(isRoad(Math.floor(station.door.x), Math.floor(station.door.y))).toBe(true);
      expect(station.stack.x).toBeCloseTo(3.5, 12);
      expect(station.stack.y).toBeCloseTo(y, 12);
      expect(distance(station.door, station.stack)).toBeCloseTo(TUBE_STACK_WALK, 12);
      expect(TUBE_STACK_WALK).toBe(0.7);
      expect(findPlotAt(station.stack.x, station.stack.y)?.id).toBe(plot.id);
      expect(station.dock).toEqual({ x: plot.x + 0.5, y: plot.y + 0.5 });
      expect(findPlotAt(station.dock.x, station.dock.y)?.id).toBe(plot.id);
    }
    const frame = tubeFrame('C1');
    expect(frame.center.x).toBeCloseTo(-389.5, 9);
    expect(frame.center.y).toBeCloseTo(260.25, 9);
    expect(frame.width).toBeCloseTo(373, 9);
    expect(frame.height).toBeCloseTo(302.5, 9);
  });
});

describe('The Treeline geometry', () => {
  it('runs one route from stack top to stack top: 54.498 tiles and 9.45 fixed minutes', () => {
    const route = tubeRoute('C1', 'N1');
    expect(route).toHaveLength(40);
    expect(route[0].x).toBe(3.5);
    expect(route[0].y).toBeCloseTo(12.8, 12);
    expect(route[0].h).toBe(39);
    expect(route.at(-1)).toEqual({ x: 3.5, y: 56.8, h: 39 });
    expect(route[19]).toEqual({ x: -0.5, y: 12, h: 8 });
    expect(route[20]).toEqual({ x: -0.5, y: 55, h: 8 });
    expect(tubeRoute('N1', 'C1')).toEqual([...route].reverse());
    expect(() => tubeRoute('C1', 'C1')).toThrow();
    expect(TUBE_TRUNK_X).toBe(-0.5);
    expect(tubeLength('C1', 'N1')).toBeCloseTo(54.498, 3);
    expect(Math.abs(tubeLength('N1', 'C1') - tubeLength('C1', 'N1'))).toBeLessThanOrEqual(1e-9);
    expect([TUBE_BOARD, TUBE_SPEED, TUBE_ALIGHT, TUBE_MIN_SAVING]).toEqual([2, 10, 2, 10]);
    expect(tubeFixedMinutes('C1', 'N1')).toBe(4 + tubeLength('C1', 'N1') / 10);
    expect(tubeLineMinutes('C1', 'N1')).toEqual({ tube: tubeFixedMinutes('C1', 'N1'), walk: 150 });
    expect(TUBE_ALTITUDE).toEqual({ spur: 39, trunk: 8, radius: 2.5 });
  });
  it('keeps the glass continuous, low behind the trees and clear of walkers over the lane', () => {
    for (const [from, to] of [
      ['C1', 'N1'],
      ['N1', 'C1'],
    ]) {
      const length = tubeLength(from, to);
      const steps = Math.floor(length * 100);
      let previous = tubeAt(from, to, 0);
      let lowest = previous.altitude;
      expect(previous.altitude).toBe(39);
      for (let i = 1; i <= steps + 1; i++) {
        const at = tubeAt(from, to, i > steps ? length : i / 100);
        expect(onTubeLine(at.position)).toBe(true);
        expect(distance(at.position, previous.position)).toBeLessThanOrEqual(0.01 + 1e-9);
        expect(Math.abs(at.altitude - previous.altitude)).toBeLessThanOrEqual(0.2);
        expect(at.index).toBeGreaterThanOrEqual(previous.index);
        // Over the x = 1 lane the underside clears a 31 px walker's hat.
        const row = at.position.y === 11.5 || at.position.y === 55.5;
        if (row && at.position.x >= 1.1 && at.position.x <= 1.9)
          expect(at.altitude - TUBE_ALTITUDE.radius).toBeGreaterThanOrEqual(34);
        if (at.position.x === TUBE_TRUNK_X && at.position.y >= 12 && at.position.y <= 55)
          expect(at.altitude).toBe(TUBE_ALTITUDE.trunk);
        lowest = Math.min(lowest, at.altitude);
        previous = at;
      }
      expect(lowest).toBe(TUBE_ALTITUDE.trunk);
      expect(tubeAt(from, to, length).altitude).toBe(39);
      expect(tubeAt(from, to, length).index).toBe(38);
    }
    expect(tubeAt('C1', 'N1', 27).facing).toBe('sw');
    expect(tubeAt('N1', 'C1', 27).facing).toBe('ne');
  });
});

describe('Tube or walk', () => {
  it(
    'rides only when door to door saves ten unhurried minutes, with a wide gap either side',
    { timeout: 20_000 },
    () => {
      const savings: number[] = [];
      for (const plot of HOUSE_PLOTS)
        for (const end of Object.values(DESTINATIONS)) {
          const choice = tubeChoice(plotEntrance(plot), end);
          if (choice) savings.push(choice.saving);
        }
      // Savings step by 12.5 minutes (one four-tile block): 12.5 − 9.45 = 3.05 is the best that walks.
      expect(savings.length).toBe(151);
      expect(Math.min(...savings)).toBeCloseTo(25 - tubeFixedMinutes('C1', 'N1'), 9);
      // Nearby trips stay on foot.
      for (const [plot, end] of [
        ['A1', DESTINATIONS.stage],
        ['C2', DESTINATIONS.green],
        ['E2', DESTINATIONS.football],
        ['A7', DESTINATIONS.zoo],
        ['Q3', DESTINATIONS.millpond],
      ] as const)
        expect(tubeChoice(plotEntrance(getPlot(plot)!), end)).toBeUndefined();
      expect(tubeChoice(plotEntrance(getPlot('A1')!), ZOO_ENTRANCE)).toMatchObject({
        from: 'C1',
        to: 'N1',
      });
      expect(tubeChoice(plotEntrance(getPlot('Q3')!), DESTINATIONS.stage)).toMatchObject({
        from: 'N1',
        to: 'C1',
      });
      // Only walking hurries, so a tube plan never fails where the walking plan would succeed.
      const fixed = TUBE_STATIONS.flatMap((a) =>
        TUBE_STATIONS.filter((b) => b !== a).map((b) => tubeFixedMinutes(a.id, b.id)),
      );
      expect(TUBE_MIN_SAVING).toBeGreaterThanOrEqual(
        (MAX_TRAVEL_SPEED_MULTIPLIER - 1) * Math.max(...fixed),
      );
    },
  );
  it('gives the same answer both ways and whatever was asked before', () => {
    const a = plotEntrance(getPlot('B2')!);
    const there = tubeChoice(a, ZOO_ENTRANCE)!;
    const back = tubeChoice(ZOO_ENTRANCE, a)!;
    expect([back.from, back.to]).toEqual([there.to, there.from]);
    expect(back.saving).toBeCloseTo(there.saving, 9);
    tubeChoice(plotEntrance(getPlot('D2')!), CINEMA_ENTRANCE);
    expect(tubeChoice(a, ZOO_ENTRANCE)).toEqual(there);
  });
  it('speeds up walking only, and matches the walking planner exactly without the tube', () => {
    for (const [tiles, start, from, until, depart, stagger] of [
      [80.4, 840, 720, 1080, 720, 0],
      [10, 840, 360, 1320, 720, 0],
      [44.8, 840, 360, 1320, 720, 0],
      [80, 840, 720, 1320, 720, 0],
      [32, 840, 750, 1150, 720, 10],
      [0, 840, 1005, 1080, 720, 0],
    ]) {
      const route = [
        { x: 0, y: 0 },
        { x: tiles, y: 0 },
      ];
      const walk = planTravel(route, start, 1020, from, until, depart, stagger);
      const journey = planJourney(tiles, 0, start, 1020, from, until, depart, stagger);
      expect(journey && { route, ...journey, speedMultiplier: undefined }).toEqual(
        walk && { ...walk, speedMultiplier: undefined },
      );
      if (walk)
        for (const key of ['duration', 'depart', 'arrive', 'leave', 'homeBy'] as const)
          expect(journey![key]).toBe(walk[key]);
    }
    // With the fixed tube minutes the walking part alone picks up the pace, never past 1.4×.
    const fixed = tubeFixedMinutes('C1', 'N1');
    const hurried = planJourney(60, fixed, 840, 1020, 720, 1080, 720)!;
    expect(hurried.speedMultiplier).toBe(MAX_TRAVEL_SPEED_MULTIPLIER);
    expect(hurried.duration - fixed).toBeCloseTo(60 / (WALK_SPEED * 1.4), 9);
    const easy = planJourney(20, fixed, 840, 1020, 720, 1080, 720)!;
    expect(easy.speedMultiplier).toBe(1);
    expect(easy.duration).toBeCloseTo(20 / WALK_SPEED + fixed, 9);
  });
  it(
    'walks to the stack, fwoomps, rides, drops and walks out without a jump',
    { timeout: 20_000 },
    () => {
      const start = plotEntrance(getPlot('A1')!);
      const choice = tubeChoice(start, ZOO_ENTRANCE)!;
      const legs = paceLegs(tubeLegs(choice), 1.4);
      expect(legs.map((leg) => leg.kind)).toEqual(['walk', 'board', 'ride', 'alight', 'walk']);
      expect(walkingPace(legs)).toBeCloseTo(0.448, 12);
      const total = legsMinutes(legs);
      expect(journeyAt(legs, 0, 0).position).toEqual(start);
      expect(journeyAt(legs, 0, total).position).toEqual(ZOO_ENTRANCE);
      const walk = legs[0].minutes,
        alightStart = walk + TUBE_BOARD + legs[2].minutes;
      // Moving only on the walks, the walk in to the stack and the walk back out to the door.
      const walking = (t: number) =>
        t < walk ||
        (t >= walk && t < walk + 1.6) ||
        (t >= alightStart + 0.25 && t < alightStart + TUBE_ALIGHT) ||
        t >= alightStart + TUBE_ALIGHT;
      let previous = journeyAt(legs, 0, 0);
      for (let i = 1; i <= Math.floor(total * 1000); i++) {
        const t = i / 1000;
        const now = journeyAt(legs, 0, t);
        const riding = now.transit?.stage === 'riding' || previous.transit?.stage === 'riding';
        expect(distance(now.position, previous.position)).toBeLessThanOrEqual(
          riding ? TUBE_SPEED * 0.001 + 1e-9 : 0.448 * 0.001 + 1e-9,
        );
        expect(onRoadOrTube(now)).toBe(true);
        expect(
          Math.abs((now.transit?.altitude ?? 0) - (previous.transit?.altitude ?? 0)),
        ).toBeLessThanOrEqual(0.33);
        // Stay clear of the leg edges, where the sum of the minutes decides.
        const edge = [walk, walk + 1.6, alightStart + 0.25, alightStart + TUBE_ALIGHT].some(
          (e) => Math.abs(t - e) < 1e-6,
        );
        if (!edge && t < total) expect(now.moving).toBe(walking(t));
        previous = now;
      }
      // Walking legs are exactly alongRoute.
      expect(journeyAt(legs, 0, walk / 2)).toEqual(alongRoute(legs[0].route, 0.5));
      const c1 = TUBE_STATIONS[0],
        n1 = TUBE_STATIONS[1];
      const walkingIn = journeyAt(legs, 0, walk + 0.8);
      expect(walkingIn.position.x).toBeCloseTo(3.5, 9);
      expect(walkingIn.position.y).toBeCloseTo(13.15, 9);
      expect(walkingIn).toMatchObject({
        moving: true,
        facing: 'ne',
        transit: { stage: 'boarding', from: 'C1', to: 'N1', altitude: 0, distance: 0 },
      });
      expect(walkingIn.transit!.progress).toBeCloseTo(0.4, 9);
      const standing = journeyAt(legs, 0, walk + 1.7);
      expect(distance(standing.position, c1.stack)).toBeLessThan(1e-9);
      expect(standing).toMatchObject({ moving: false, facing: 'sw' });
      expect(journeyAt(legs, 0, walk + 1.94).transit!.altitude).toBeCloseTo(19.5, 6);
      expect(journeyAt([legs[1]], 0, TUBE_BOARD).transit!.altitude).toBe(39);
      expect(journeyAt(legs, 0, walk + TUBE_BOARD).transit).toMatchObject({
        stage: 'riding',
        altitude: 39,
      });
      expect(journeyAt(legs, 0, alightStart + 0.06).transit!.altitude).toBeCloseTo(19.5, 6);
      const walkingOut = journeyAt(legs, 0, alightStart + 1);
      expect(walkingOut.position.x).toBeCloseTo(3.5, 9);
      expect(walkingOut.position.y).toBeCloseTo(57.1, 9);
      expect(walkingOut).toMatchObject({ moving: true, facing: 'sw' });
      expect(walkingOut.transit).toMatchObject({ stage: 'alighting', altitude: 0 });
      expect(walkingOut.transit!.distance).toBe(tubeLength('C1', 'N1'));
      const home = reverseLegs(legs);
      expect(home.map((leg) => leg.kind)).toEqual(['walk', 'board', 'ride', 'alight', 'walk']);
      expect(home[1]).toMatchObject({ from: 'N1', to: 'C1', minutes: TUBE_BOARD });
      expect(home[1].route).toEqual([n1.door, n1.stack]);
      expect(home[3].route).toEqual([c1.stack, c1.door]);
      expect(legsMinutes(home)).toBeCloseTo(total, 9);
      expect(reverseLegs(home)).toEqual(legs);
    },
  );
  it('tells a figure in the stack from one walking to or from it', () => {
    const at = (stage: 'boarding' | 'riding' | 'alighting', progress: number) =>
      tubeInStack({ stage, progress });
    expect(at('boarding', 0.79)).toBe(false);
    expect(at('boarding', 0.8)).toBe(true);
    expect(at('boarding', 1)).toBe(true);
    expect(at('alighting', 0)).toBe(true);
    expect(at('alighting', 0.12)).toBe(true);
    expect(at('alighting', 0.13)).toBe(false);
    expect(at('riding', 0.5)).toBe(false);
    expect(tubeStageTime({ stage: 'boarding', progress: 0.5, distance: 0 })).toBe(1);
    expect(tubeStageTime({ stage: 'alighting', progress: 0.25, distance: 54 })).toBe(0.5);
    expect(tubeStageTime({ stage: 'riding', progress: 0.5, distance: 27 })).toBeCloseTo(2.7, 12);
  });
  it('joins the road to the approach without a U-turn', () => {
    const approaches: Point[][] = [];
    for (const venue of VENUES.filter((v) => v.kind !== 'fork'))
      for (let seat = 0; seat < EVENT_SPOTS[venue.kind].length; seat++)
        approaches.push(eventApproach({ venue }, seat));
    for (let seat = 0; seat < 6; seat++) {
      approaches.push(eventApproach({ venue: FOOTBALL_VENUE }, seat));
      approaches.push(eventApproach({ venue: MILLPOND_VENUE }, seat));
    }
    let checked = 0;
    for (const station of TUBE_STATIONS)
      for (const approach of approaches) {
        const road = roadPath(station.door, approach[0]);
        const joined = joinApproach(road, approach);
        const unjoined = [...road, ...approach.slice(1)];
        expect(joined[0]).toEqual(station.door);
        expect(joined.at(-1)).toEqual(approach.at(-1));
        // The stage's own approach ends on a repeated point (its lane corner is the seat); the
        // join adds no repeat of its own and never walks back over a point.
        const repeats = (route: Point[]) =>
          route.slice(1).flatMap((p, i) => (p.x === route[i].x && p.y === route[i].y ? [p] : []));
        for (const p of repeats(joined)) expect(repeats(approach)).toContainEqual(p);
        const squeezed = joined.filter(
          (p, i) => !repeats([joined[i - 1] ?? { x: NaN, y: 0 }, p]).length,
        );
        expect(new Set(squeezed.map((p) => `${p.x},${p.y}`)).size).toBe(squeezed.length);
        expect(routeLength(joined)).toBeLessThanOrEqual(routeLength(unjoined) + 1e-9);
        checked++;
      }
    expect(checked).toBeGreaterThanOrEqual(100);
    // Stepping off at Willow Halt, a zoo visitor turns in at the zoo's own path, not past the gate.
    const n1 = TUBE_STATIONS[1];
    const zoo = VENUES.find((v) => v.kind === 'zoo')!;
    for (let seat = 0; seat < EVENT_SPOTS.zoo.length; seat++) {
      const approach = eventApproach({ venue: zoo }, seat);
      const road = roadPath(n1.door, approach[0]);
      expect(
        routeLength([...road, ...approach.slice(1)]) - routeLength(joinApproach(road, approach)),
      ).toBeCloseTo(22.2, 9);
    }
    expect(joinApproach([n1.door], [n1.door])).toEqual([n1.door]);
  });
});

describe('Parcels', () => {
  it('keeps a deterministic daylight timetable, alternating direction', () => {
    for (let day = 0; day < 30; day++) {
      const slots = tubeParcelSlots(day);
      expect(tubeParcelSlots(day)).toEqual(slots);
      expect(slots.length).toBeGreaterThan(18);
      for (const slot of slots) {
        expect(slot.depart).toBeGreaterThanOrEqual(TUBE_PARCELS.first);
        expect(slot.depart).toBeLessThanOrEqual(TUBE_PARCELS.last + TUBE_PARCELS.jitter);
        expect(Number.isInteger(slot.depart)).toBe(true);
      }
      expect(new Set(slots.map((slot) => slot.from))).toEqual(new Set([FIRST, LAST]));
    }
    expect(TUBE_PARCELS.wait).toBe(0.5);
    expect(tubeParcelMinutes('C1', 'N1')).toBe(tubeLength('C1', 'N1') / 10);
  });
});

describe('Tube modules stay pure', () => {
  it('uses no clock, randomness or storage, and keeps tubes.ts importable by the schema', () => {
    for (const file of ['tubes', 'tube-journeys', 'tube-traffic']) {
      const source = readFileSync(`src/lib/${file}.ts`, 'utf8');
      expect(source).not.toMatch(/\bDate\b|Math\.random|localStorage|sessionStorage|document\./);
    }
    const imports = readFileSync('src/lib/tubes.ts', 'utf8').match(/from '[^']+'/g);
    expect(imports).toEqual(["from './world.ts'"]);
  });
});
