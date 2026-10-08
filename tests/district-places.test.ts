// The Riverside's reservations and frozen data (SPEC §2, §4, §6.1): the 20 × 15 town's house
// plots, the market square's roads and lamps, every district spot and way in, the harvest props
// round the scarecrow, the regatta's boats, the bandstand's furniture and the district calendar.
// Static: nothing here plans a day.
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  activeIndex,
  BANDS,
  bandOf,
  harvestDay,
  MARKET_KINDS,
  marketKind,
  nextOutingDay,
  OUTING_IDS,
  OUTING_TABLE,
  OUTING_TIMES,
  regattaBoat,
  regattaDay,
  SNOWMAN_DAYS,
  SNOWMAN_STAGES,
  snowmanState,
  starNight,
  type OutingId,
} from '../src/lib/district-calendar';
import { DISTRICT_COPY, PANEL_COPY, SNOWMEN_LUNCH } from '../src/lib/district-copy';
import {
  BANDSTAND_FURNITURE,
  BANDSTAND_VENUE,
  DISTRICT_FRAMES,
  DISTRICT_OUTINGS,
  DISTRICT_SPOTS,
  districtApproach,
  HARVEST_GATES,
  HARVEST_GROUND,
  HARVEST_PROPS,
  HARVEST_VENUE,
  insideDistrict,
  isDistrictPlot,
  KINGFISHER_PIER,
  LANDING_VENUE,
  MARKET_GROUND,
  MARKET_PLOTS,
  MARKET_VENUE,
  outingSpots,
  REGATTA_COURSE,
  SCARECROW_KEEP_OUT,
  type DistrictKind,
} from '../src/lib/district-places';
import { HOUSE_PLOTS, VENUES, venueAt, EVENT_SPOTS, eventSpot } from '../src/lib/events';
import { isFarmPlot } from '../src/lib/farm';
import { joinApproach } from '../src/lib/tube-journeys';
import { isTubePlot, TUBE_HALT_PLOTS, TUBE_STATIONS } from '../src/lib/tubes';
import { CALENDAR_EPOCH_DAY, townCalendarAt } from '../src/lib/town-calendar';
import { MARKET_SITE, TOWN_SIZE } from '../src/lib/town-config';
import { roadPath } from '../src/lib/walking';
import {
  getPlot,
  hash,
  isRoad,
  plotEntrance,
  PLOTS,
  STREETLIGHTS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Point,
} from '../src/lib/world';
import { schemaHousePlots } from './house-plots';
// The registries (F0b) and every owner's file they read (SPEC §7.0, §7.3).
import {
  OUTINGS,
  outingOf,
  SEAT_EXCLUDES,
  SEAT_ORDER,
  snowmenBuilderPose as builderFromRegistry,
  snowmenWatcherPose as watcherFromRegistry,
  type OutingFacing,
  type OutingPose,
  type SeatCall,
} from '../src/lib/outings';
import { marketFacing, marketPose } from '../src/lib/outings/market';
import { sundownPose, teaPose } from '../src/lib/outings/bandstand';
import { regattaPose } from '../src/lib/outings/regatta';
import { fairPose, tablePose } from '../src/lib/outings/harvest';
import { starPose } from '../src/lib/outings/stargazing';
import { snowmenBuilderPose, snowmenWatcherPose } from '../src/lib/outings/snowmen';
import { DISTRICT_PAINTERS } from '../src/city/district-art';
import { marketPainter } from '../src/city/district/market';
import { bandstandPainter } from '../src/city/district/bandstand';
import { landingPainter } from '../src/city/district/landing';
import { drawScarecrowExtras, harvestPainter } from '../src/city/district/harvest';
import { stargazingPainter } from '../src/city/district/stargazing';
import { snowmenPainter } from '../src/city/district/snowmen';
import { drawSkyExtras } from '../src/city/sky-extras';
import { CARRY_SPRITES } from '../src/city/carry-items';
import { paperBagSprite } from '../src/city/carry/paper-bag';
import { paperBoatSprite } from '../src/city/carry/paper-boat';
import { dishSprite } from '../src/city/carry/dish';
import { BANDSTAND_TRACKS, composeBandstand } from '../src/music/bandstand-tracks';
import {
  DISTRICT_CARDS,
  DISTRICT_PANEL_FILES,
  DISTRICT_PANELS,
  type DistrictPanelProps,
  type GreenNoteProps,
  type StargazingNoteProps,
} from '../src/components/district/cards';
import MarketInfo from '../src/components/district/MarketInfo';
import BandstandInfo from '../src/components/district/BandstandInfo';
import LandingInfo from '../src/components/district/LandingInfo';
import StargazingNote from '../src/components/district/StargazingNote';
import GreenNote from '../src/components/district/GreenNote';
import FarmInfo from '../src/components/FarmInfo';
import TubeInfo from '../src/components/TubeInfo';
import { DISTRICT_BUTTONS } from './manual/district';
import type { ComponentProps } from 'react';
import type { EventPose } from '../src/lib/events';
import type { Band } from '../src/lib/district-calendar';
import type { Note } from '../src/music/score';

/** Today's 30 homes (main at b59605d), frozen: a contributor's edit never changes this test. */
const OCCUPIED = [
  'A1', 'A2', 'A3', 'A4', 'B2', 'B3', 'B4', 'C2', 'C3', 'C4', 'C6', 'D2', 'D4', 'E2', 'E4',
  'E5', 'F2', 'F6', 'F7', 'G6', 'G7', 'I7', 'J5', 'J6', 'J10', 'Q1', 'Q3', 'Q10', 'T3', 'T10',
]; // prettier-ignore
/** Plots wanted by open house pull requests. */
const WANTED = ['F8', 'J4', 'A8'];
/** The 20 × 15 town's eleven new reservations. */
const NEW_RESERVATIONS = [...MARKET_PLOTS, 'J15', 'K15', 'R1', 'A9', 'C15', 'L15', 'R15'];
/** Plots other tests pin as house plots (SPEC §2.2). */
const PINNED_HOUSES = [
  'A4', 'B10', 'T10', 'P10', 'Q10', 'R10', 'S3', 'T2', 'T3', 'B7', 'B1', 'D1', 'C2', 'M1', 'O1',
  'N2', 'A1', 'E2', 'A7', 'Q3', 'H2', 'H7', 'I2', 'I7', 'J3', 'J6', 'G2', 'E5',
]; // prettier-ignore

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/** The shortest distance from a point to a segment. */
function toSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}
const segments = (route: readonly Point[]) => route.slice(1).map((b, i) => [route[i], b] as const);
/** Points where a walk turns straight back along the line it came in on (as trip-routes checks). */
function reversals(route: readonly Point[]): Point[] {
  const points = route.filter(
    (p, i) => i === 0 || p.x !== route[i - 1].x || p.y !== route[i - 1].y,
  );
  const turns: Point[] = [];
  for (let i = 1; i + 1 < points.length; i++) {
    const ax = points[i].x - points[i - 1].x,
      ay = points[i].y - points[i - 1].y,
      bx = points[i + 1].x - points[i].x,
      by = points[i + 1].y - points[i].y;
    if ((ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)) < -0.999)
      turns.push(points[i]);
  }
  return turns;
}
const seatsOf = (outing: OutingId) => outingSpots(outing).length;
const GROUND_OF: Record<OutingId, DistrictKind> = {
  market: 'market',
  regatta: 'landing',
  'harvest-fair': 'harvest',
  'long-table': 'harvest',
  'bandstand-tea': 'bandstand',
  'bandstand-sundown': 'bandstand',
  stargazing: 'bandstand',
};

describe('The 20 × 15 town', () => {
  it('has 300 plots and 230 house plots, every other plot reserved for the town', () => {
    expect(TOWN_SIZE).toEqual({ rows: 20, columns: 15 });
    expect([WORLD_WIDTH, WORLD_HEIGHT]).toEqual([64, 84]);
    expect(PLOTS).toHaveLength(300);
    // The one explicit pin; other tests derive the count.
    expect(HOUSE_PLOTS.length).toBe(230);
    expect(HOUSE_PLOTS.map((plot) => plot.id)).toEqual(schemaHousePlots());
    const reserved = PLOTS.filter((plot) => !HOUSE_PLOTS.includes(plot)).map((plot) => plot.id);
    expect(reserved).toHaveLength(70);
    for (const id of NEW_RESERVATIONS) expect(reserved).toContain(id);
    expect(new Set(NEW_RESERVATIONS).size).toBe(11);
    expect(HOUSE_PLOTS.filter((plot) => plot.col >= 10)).toHaveLength(91);
    expect(HOUSE_PLOTS.filter((plot) => !OCCUPIED.includes(plot.id))).toHaveLength(200);
  });

  it('reserves nothing anyone lives on or has asked for, and keeps every pinned house plot', () => {
    for (const id of NEW_RESERVATIONS) {
      expect(OCCUPIED).not.toContain(id);
      expect(WANTED).not.toContain(id);
    }
    for (const id of [...OCCUPIED, ...WANTED, ...PINNED_HOUSES])
      expect(
        HOUSE_PLOTS.some((plot) => plot.id === id),
        id,
      ).toBe(true);
    // S5–S9 stay the farm's.
    for (const id of ['S5', 'S6', 'S7', 'S8', 'S9']) expect(isFarmPlot(id)).toBe(true);
  });

  it('reserves the Treeline’s seven halts, and the Riverside’s six plots as venues', () => {
    expect(TUBE_HALT_PLOTS).toEqual(['R1', 'N1', 'C1', 'A9', 'C15', 'L15', 'R15']);
    for (const id of TUBE_HALT_PLOTS) {
      expect(isTubePlot(id)).toBe(true);
      expect(venueAt(id)).toBeUndefined();
    }
    // The line itself still runs C1 to N1 until the loop is built.
    expect(TUBE_STATIONS.map((station) => station.id)).toEqual(['C1', 'N1']);
    expect([...MARKET_PLOTS]).toEqual(['D14', 'D15', 'E14', 'E15']);
    for (const id of MARKET_PLOTS) {
      expect(isDistrictPlot(id)).toBe(true);
      expect(venueAt(id)).toBe(MARKET_VENUE);
      const plot = getPlot(id)!;
      expect(plot.row - MARKET_SITE.row).toBeGreaterThanOrEqual(0);
      expect(plot.row - MARKET_SITE.row).toBeLessThan(MARKET_SITE.rows);
      expect(plot.col - MARKET_SITE.col).toBeGreaterThanOrEqual(0);
      expect(plot.col - MARKET_SITE.col).toBeLessThan(MARKET_SITE.columns);
    }
    expect(venueAt('J15')).toBe(LANDING_VENUE);
    expect(venueAt('K15')).toBe(BANDSTAND_VENUE);
    expect(
      PLOTS.filter((plot) => isDistrictPlot(plot.id))
        .map((plot) => plot.id)
        .sort(),
    ).toEqual(['D14', 'D15', 'E14', 'E15', 'J15', 'K15']);
    // VENUES keeps the green and the stage first and the Fork last; the Riverside comes after
    // the zoo. The Harvest Fair uses the farm's own reserved plots.
    expect(VENUES.map((venue) => venue.id)).toEqual([
      'green',
      'stage',
      'cinema',
      'zoo',
      'market',
      'bandstand',
      'landing',
      'fork',
    ]);
    expect(VENUES.map((venue): string => venue.id)).not.toContain(HARVEST_VENUE.id);
    expect(isFarmPlot(HARVEST_VENUE.plot)).toBe(true);
  });

  it('opens Market Square inside its perimeter roads, with no lamp in the square', () => {
    expect(MARKET_GROUND).toEqual({ left: 54, right: 61, top: 14, bottom: 21 });
    for (let y = 14; y <= 20; y++) expect(isRoad(57, y), `57,${y}`).toBe(false);
    for (let x = 54; x <= 60; x++) expect(isRoad(x, 17), `${x},17`).toBe(false);
    for (let k = 13; k <= 21; k++) {
      expect(isRoad(53, k), `53,${k}`).toBe(true);
      expect(isRoad(61, k), `61,${k}`).toBe(true);
    }
    for (let k = 53; k <= 61; k++) {
      expect(isRoad(k, 13), `${k},13`).toBe(true);
      expect(isRoad(k, 21), `${k},21`).toBe(true);
    }
    expect(
      STREETLIGHTS.filter((lamp) => lamp.x >= 54 && lamp.x <= 60 && lamp.y >= 14 && lamp.y <= 20),
    ).toEqual([]);
    // Single-plot venues and halts take no road.
    for (const id of ['J15', 'K15', ...TUBE_HALT_PLOTS]) {
      const door = plotEntrance(getPlot(id)!);
      expect(isRoad(Math.floor(door.x), Math.floor(door.y)), id).toBe(true);
    }
  });
});

describe('District spots and ways in', () => {
  const capacity = { market: 12, bandstand: 8, landing: 10, 'harvest-fair': 12, 'long-table': 16 };
  const ground: Record<keyof typeof capacity, DistrictKind> = {
    market: 'market',
    bandstand: 'bandstand',
    landing: 'landing',
    'harvest-fair': 'harvest',
    'long-table': 'harvest',
  };

  it('seats each outing on its own ground, off the road, more than 0.6 tiles apart', () => {
    for (const [list, count] of Object.entries(capacity) as [keyof typeof capacity, number][]) {
      const spots = DISTRICT_SPOTS[list];
      expect(spots, list).toHaveLength(count);
      for (const spot of spots) {
        expect(insideDistrict(ground[list], spot), `${list} ${spot.x},${spot.y}`).toBe(true);
        expect(isRoad(Math.floor(spot.x), Math.floor(spot.y)), `${list} ${spot.x}`).toBe(false);
      }
      spots.forEach((a, i) =>
        spots.slice(i + 1).forEach((b) => expect(distance(a, b), list).toBeGreaterThan(0.6)),
      );
    }
    for (const id of OUTING_IDS) expect(seatsOf(id)).toBe(OUTING_TABLE[id].cap);
    // EVENT_SPOTS keeps them round the anchor plot's centre, as for every venue.
    for (const venue of [MARKET_VENUE, BANDSTAND_VENUE, LANDING_VENUE])
      EVENT_SPOTS[venue.kind].forEach((_, seat) => {
        const list = venue.kind === 'market' ? 'market' : venue.kind;
        expect(eventSpot(venue, seat).position.x).toBeCloseTo(DISTRICT_SPOTS[list][seat].x, 9);
        expect(eventSpot(venue, seat).position.y).toBeCloseTo(DISTRICT_SPOTS[list][seat].y, 9);
      });
    // The landing's rows: alternating front and back, 0.31 apart down the river edge.
    DISTRICT_SPOTS.landing.forEach((spot, k) => {
      expect(spot).toEqual({ x: k % 2 ? 60.2 : 60.75, y: 38.15 + 0.31 * k, facing: 'se' });
      expect(spot.x).toBeLessThan(62);
    });
  });

  it('starts every way in at a road-tile centre, runs along rows and columns, and ends on the spot', () => {
    for (const id of OUTING_IDS)
      for (let seat = 0; seat < seatsOf(id); seat++) {
        const route = districtApproach(id, seat);
        const [first] = route;
        expect(isRoad(Math.floor(first.x), Math.floor(first.y)), `${id} ${seat}`).toBe(true);
        expect(first.x % 1).toBe(0.5);
        expect(first.y % 1).toBe(0.5);
        const spot = outingSpots(id)[seat];
        expect(route.at(-1)).toEqual({ x: spot.x, y: spot.y });
        for (const [a, b] of segments(route)) {
          expect(a.x === b.x || a.y === b.y, `${id} ${seat}`).toBe(true);
          expect(distance(a, b)).toBeGreaterThan(0);
        }
        expect(reversals(route), `${id} ${seat}`).toEqual([]);
        // Every step is on a road or on the outing's own ground.
        for (const p of route)
          expect(
            insideDistrict(GROUND_OF[id], p) || isRoad(Math.floor(p.x), Math.floor(p.y)),
            `${id} ${seat} ${p.x},${p.y}`,
          ).toBe(true);
      }
  });

  it('never walks past the way in and back, from any doorstep or tube door', () => {
    const starts = [
      ...HOUSE_PLOTS.map((plot) => plotEntrance(plot)),
      ...TUBE_STATIONS.map((station) => station.door),
    ];
    let checked = 0;
    for (const id of OUTING_IDS)
      for (let seat = 0; seat < seatsOf(id); seat++) {
        const approach = districtApproach(id, seat);
        for (const start of starts) {
          const route = joinApproach(roadPath(start, approach[0]), approach);
          expect(route.at(-1)).toEqual(approach.at(-1));
          if (reversals(route).length) expect.fail(`${id} ${seat} from ${start.x},${start.y}`);
          checked++;
        }
      }
    expect(checked).toBeGreaterThan(10_000);
  });

  it('keeps every way in clear of the outing’s other spots', () => {
    for (const id of OUTING_IDS) {
      const spots = outingSpots(id);
      for (let seat = 0; seat < spots.length; seat++)
        for (const [a, b] of segments(districtApproach(id, seat)))
          spots.forEach((other, k) => {
            if (k !== seat)
              expect(toSegment(other, a, b), `${id} ${seat} passes ${k}`).toBeGreaterThan(0.3);
          });
    }
  });

  it('brings harvest guests through the farm’s two west gates, clear of the scarecrow', () => {
    for (const id of ['harvest-fair', 'long-table'] as const)
      for (let seat = 0; seat < seatsOf(id); seat++) {
        const route = districtApproach(id, seat);
        const north = seat < (id === 'long-table' ? 8 : 6);
        expect(route[0]).toEqual(north ? HARVEST_GATES.north : HARVEST_GATES.south);
        // The fence is x = 14: each way in crosses it once, at its gate.
        for (const [a, b] of segments(route))
          if ((a.x - 14) * (b.x - 14) < 0 || a.x === 14 || b.x === 14) {
            expect(a.y).toBe(b.y);
            expect([75.5, 79.5]).toContain(a.y);
          }
        for (const p of route.slice(1)) expect(p.x).toBeGreaterThan(14);
      }
    for (const spot of [...DISTRICT_SPOTS['harvest-fair'], ...DISTRICT_SPOTS['long-table']])
      for (const crow of SCARECROW_KEEP_OUT.points)
        expect(distance(spot, crow)).toBeGreaterThanOrEqual(SCARECROW_KEEP_OUT.radius);
    for (const spot of DISTRICT_SPOTS['harvest-fair'])
      expect(insideDistrict('harvest', spot)).toBe(true);
    expect(HARVEST_GROUND).toEqual({ left: 14, right: 22, top: 74, bottom: 81 });
  });

  it('sets the harvest props clear of the scarecrow, and of every guest while they are out', () => {
    for (const prop of HARVEST_PROPS) {
      for (const crow of SCARECROW_KEEP_OUT.points)
        expect(distance(prop, crow), prop.id).toBeGreaterThanOrEqual(SCARECROW_KEEP_OUT.radius);
      expect(prop.from).toBeLessThan(prop.to);
      for (const id of ['harvest-fair', 'long-table'] as const) {
        const { depart, homeBy } = OUTING_TIMES[id];
        if (prop.to <= depart || prop.from >= homeBy) continue;
        for (let seat = 0; seat < seatsOf(id); seat++) {
          expect(
            distance(prop, outingSpots(id)[seat]),
            `${prop.id} ${id} ${seat}`,
          ).toBeGreaterThanOrEqual(0.5);
          for (const [a, b] of segments(districtApproach(id, seat)))
            expect(toSegment(prop, a, b), `${prop.id} ${id} ${seat}`).toBeGreaterThanOrEqual(0.35);
        }
      }
    }
    expect(new Set(HARVEST_PROPS.map((prop) => prop.id)).size).toBe(HARVEST_PROPS.length);
  });

  it('frames each district within 850 × 540', () => {
    for (const frame of Object.values(DISTRICT_FRAMES)) {
      expect(frame.width).toBeLessThanOrEqual(850);
      expect(frame.height).toBeLessThanOrEqual(540);
    }
  });
});

describe('The district calendar', () => {
  const YEAR = Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + i);
  const label = (day: number) => {
    const { season, date } = townCalendarAt(day);
    return `${season} ${date}`;
  };

  it('holds Regatta Week, the Harvest days, the new-moon nights and the snowmen’s days', () => {
    expect(YEAR.filter(regattaDay).map(label)).toEqual(
      [10, 11, 12, 13, 14, 15, 16].map((date) => `Summer ${date}`),
    );
    expect(YEAR.filter(harvestDay).map(label)).toEqual(['Autumn 23', 'Autumn 24', 'Autumn 25']);
    expect(YEAR.filter(starNight).map(label)).toEqual(
      ['Spring', 'Summer', 'Autumn', 'Winter'].flatMap((season) =>
        [1, 27, 28].map((date) => `${season} ${date}`),
      ),
    );
    expect(SNOWMAN_DAYS.map((d) => label(CALENDAR_EPOCH_DAY + d))).toEqual([
      'Winter 3',
      'Winter 7',
      'Winter 11',
      'Winter 15',
    ]);
    // Next year, the same days.
    expect(YEAR.map((day) => starNight(day + 112))).toEqual(YEAR.map((day) => starNight(day)));
    expect(nextOutingDay('harvest-fair', YEAR[0])).toBe(YEAR.find(harvestDay));
    expect(nextOutingDay('market', YEAR[5])).toBe(YEAR[5]);
    expect(nextOutingDay('stargazing', YEAR[1])).toBe(YEAR.slice(1).find(starNight));
  });

  it('counts each outing’s active days without a gap or a repeat', () => {
    for (const [kind, on] of [
      ['regatta', regattaDay],
      ['harvest-fair', harvestDay],
      ['long-table', harvestDay],
      ['stargazing', starNight],
      ['market', () => true],
      ['night-party', () => true],
    ] as const) {
      const days = [-112, 0, 112].flatMap((shift) => YEAR.map((day) => day + shift)).filter(on);
      expect(days.map((day) => activeIndex(kind, day))).toEqual(
        days.map((_, i) => activeIndex(kind, days[0]) + i),
      );
    }
    expect(activeIndex('market', CALENDAR_EPOCH_DAY)).toBe(0);
    expect(activeIndex('regatta', YEAR.find(regattaDay)!)).toBe(0);
    expect(activeIndex('stargazing', CALENDAR_EPOCH_DAY)).toBe(0);
  });

  it('keeps the frozen times, seats and lines', () => {
    expect(OUTING_TIMES).toEqual({
      market: { depart: 360, start: 480, end: 690, homeBy: 720 },
      regatta: { depart: 720, start: 840, end: 990, homeBy: 1080 },
      'harvest-fair': { depart: 720, start: 780, end: 1020, homeBy: 1080 },
      'bandstand-tea': { depart: 720, start: 960, end: 1050, homeBy: 1080 },
      'long-table': { depart: 1080, start: 1110, end: 1230, homeBy: 1320 },
      'bandstand-sundown': { depart: 1080, start: 1095, end: 1200, homeBy: 1320 },
      stargazing: { depart: 1320, start: 1335, end: 1455, homeBy: 1560 },
    });
    expect(
      Object.fromEntries(
        OUTING_IDS.map((id) => {
          const { underway, seated, cap, rule, newcomerKey } = OUTING_TABLE[id];
          return [id, [underway, seated, cap, rule, newcomerKey(7)]];
        }),
      ),
    ).toEqual({
      market: [true, false, 12, 'half', 'market:7'],
      regatta: [true, false, 10, 'half', 'regatta:7'],
      'harvest-fair': [true, false, 12, 'half', 'harvest-fair:7'],
      'bandstand-tea': [false, true, 8, 'all', 'bandstand-tea:7'],
      'long-table': [true, true, 16, 'all', 'long-table:7'],
      'bandstand-sundown': [false, true, 8, 'all', 'bandstand-sundown:7'],
      stargazing: [false, true, 8, 'half', 'stargazing:7'],
    });
    // The deckchairs and the rugs share the eight spots and are never out together.
    const { chairs, rugs } = BANDSTAND_FURNITURE;
    expect(chairs.to <= rugs.from || rugs.to <= chairs.from).toBe(true);
    expect(chairs.from).toBeLessThan(OUTING_TIMES['bandstand-tea'].start);
    expect(chairs.to).toBeGreaterThan(OUTING_TIMES['bandstand-sundown'].end);
    expect(rugs.from).toBeLessThan(OUTING_TIMES.stargazing.start);
    expect(rugs.to).toBeGreaterThan(OUTING_TIMES.stargazing.end);
  });

  it('turns over every market kind and band, the same all day', () => {
    expect(new Set(YEAR.map(marketKind))).toEqual(new Set(MARKET_KINDS));
    expect(new Set(YEAR.map(bandOf))).toEqual(new Set(BANDS));
    for (const day of YEAR.slice(0, 20)) {
      expect(marketKind(day + 0.9)).toBe(marketKind(day));
      expect(bandOf(day + 0.5)).toBe(bandOf(day));
    }
  });

  it('floats ten paper boats down the near lane, never overtaking, to rest at the boom', () => {
    const days = YEAR.filter(regattaDay);
    expect(regattaBoat(0, YEAR[0], 900)).toBeUndefined();
    expect(regattaBoat(10, days[0], 900)).toBeUndefined();
    for (const day of days) {
      for (let k = 0; k < 10; k++) {
        const boat = regattaBoat(k, day, 900)!;
        expect(boat.restAt).toBeGreaterThanOrEqual(930);
        expect(boat.restAt).toBeLessThanOrEqual(940);
        expect(regattaBoat(k, day, 840 + 6 * k - 0.01)!.state).toBe('ashore');
        expect(regattaBoat(k, day, 840 + 6 * k)!.state).toBe('drifting');
        expect(regattaBoat(k, day, 840 + 6 * k)!.y).toBeCloseTo(REGATTA_COURSE.launch.y, 9);
        expect(regattaBoat(k, day, boat.restAt)).toMatchObject({
          state: 'resting',
          y: REGATTA_COURSE.boomY - REGATTA_COURSE.restGap * k,
        });
        expect(regattaBoat(k, day, 1035)).toBeUndefined();
      }
      for (let t = 840; t < 1030; t += 0.05) {
        const boats = Array.from({ length: 10 }, (_, k) => regattaBoat(k, day, t));
        boats.forEach((boat, k) => {
          if (!boat || boat.state === 'ashore') return;
          expect(boat.x).toBeGreaterThanOrEqual(62.085 - 1e-9);
          expect(boat.x).toBeLessThanOrEqual(62.165 + 1e-9);
          if (Math.abs(boat.y - KINGFISHER_PIER.y) < 0.3)
            expect(Math.abs(boat.x - KINGFISHER_PIER.x)).toBeGreaterThanOrEqual(0.14);
          const ahead = boats[k - 1];
          if (ahead && ahead.state !== 'ashore')
            expect(ahead.y - boat.y, `${k} at ${t}`).toBeGreaterThanOrEqual(0.14 - 1e-9);
        });
      }
    }
  });

  it('builds a snowman on each build day and thaws them all before spring', () => {
    for (let k = 0; k < 4; k++) {
      const built = CALENDAR_EPOCH_DAY + SNOWMAN_DAYS[k];
      expect(snowmanState(k, built - 1, 900)).toBeUndefined();
      expect(snowmanState(k, built, SNOWMAN_STAGES.base - 0.01)!.stage).toBe(0);
      expect(snowmanState(k, built, SNOWMAN_STAGES.base)!.stage).toBe(1);
      expect(snowmanState(k, built, SNOWMAN_STAGES.body)!.stage).toBe(2);
      expect(snowmanState(k, built, SNOWMAN_STAGES.head)!.stage).toBe(3);
      expect(snowmanState(k, built, SNOWMAN_STAGES.dressed)).toEqual({ stage: 4, melt: 0 });
      expect(snowmanState(k, built + 1, 0)).toEqual({ stage: 4, melt: 0 });
      // Gone by Winter 28's evening, so Spring 1 is always clear.
      expect(snowmanState(k, CALENDAR_EPOCH_DAY + 111, 1200)).toBeUndefined();
      expect(snowmanState(k, CALENDAR_EPOCH_DAY + 112, 720)).toBeUndefined();
      let melt = 0;
      for (let day = built; day < CALENDAR_EPOCH_DAY + 112; day += 0.25) {
        const state = snowmanState(k, Math.floor(day), (day % 1) * 1440);
        if (!state) continue;
        expect(state.melt).toBeGreaterThanOrEqual(melt);
        melt = state.melt;
      }
      expect(melt).toBe(1);
    }
    expect(snowmanState(4, CALENDAR_EPOCH_DAY + 100, 0)).toBeUndefined();
  });
});

describe('The Riverside’s words', () => {
  it('names every outing without a trailing period, in the town’s voice', () => {
    const YEAR = Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + i);
    const words: string[] = [SNOWMEN_LUNCH.name, SNOWMEN_LUNCH.description];
    for (const id of OUTING_IDS) {
      const copy = DISTRICT_COPY[id];
      for (const day of YEAR) {
        const name = copy.name(day);
        expect(name.endsWith('.'), name).toBe(false);
        words.push(name, copy.description(day));
        expect(copy.description(day)).toMatch(/\.$/);
      }
      words.push(...Object.values(copy.labels).flat());
      if (copy.panelEyebrow) expect(copy.panelEyebrow).toMatch(/^[A-Z0-9 ·/’&–-]+$/);
    }
    for (const panel of Object.values(PANEL_COPY))
      for (const [key, line] of Object.entries(panel)) {
        const text = typeof line === 'function' ? line(3) : line;
        if (key === 'heading') expect(text).toMatch(/\.$/);
        if (key === 'eyebrow') expect(text).toMatch(/^[A-Z0-9 ·/’&–-]+$/);
        words.push(text);
      }
    const text = words.join(' ');
    expect(text).not.toMatch(/[!']/);
    expect(text).not.toMatch(
      /\b(?:repo|commit|branch|SHA|merged|winner|won|fastest|first place)\b/i,
    );
    expect(text).not.toMatch(/neighbour|lantern/i);
    // Every season's market reads its own season.
    expect(new Set(YEAR.map((day) => DISTRICT_COPY.market.description(day))).size).toBe(8);
  });
});

describe('The Riverside’s registries', () => {
  const YEAR = Array.from({ length: 112 }, (_, i) => CALENDAR_EPOCH_DAY + i);
  /** SPEC §4.0.A: each new outing's seat call, period, venue and exclusions. */
  const SEATS: Record<
    OutingId,
    { order: number; period: string; venue: DistrictKind; excludes: SeatCall[] }
  > = {
    regatta: { order: 3, period: 'afternoon', venue: 'landing', excludes: [] },
    'harvest-fair': { order: 4, period: 'afternoon', venue: 'harvest', excludes: ['regatta'] },
    'long-table': { order: 9, period: 'evening', venue: 'harvest', excludes: ['cinema'] },
    stargazing: { order: 11, period: 'night', venue: 'bandstand', excludes: ['cinema'] },
    market: { order: 13, period: 'morning', venue: 'market', excludes: ['football-morning'] },
    'bandstand-tea': {
      order: 14,
      period: 'afternoon',
      venue: 'bandstand',
      excludes: ['regatta', 'harvest-fair', 'green', 'zoo', 'football-afternoon', 'millpond'],
    },
    'bandstand-sundown': {
      order: 15,
      period: 'evening',
      venue: 'bandstand',
      excludes: ['cinema', 'long-table', 'concert'],
    },
  };

  it('holds all seven outings in seat order, with their frozen fields', () => {
    expect(OUTINGS.map((outing) => outing.id)).toEqual([
      'regatta',
      'harvest-fair',
      'long-table',
      'stargazing',
      'market',
      'bandstand-tea',
      'bandstand-sundown',
    ]);
    expect(new Set(OUTINGS.map((outing) => outing.id))).toEqual(new Set(OUTING_IDS));
    const venues = {
      market: MARKET_VENUE,
      bandstand: BANDSTAND_VENUE,
      landing: LANDING_VENUE,
      harvest: HARVEST_VENUE,
    };
    for (const outing of OUTINGS) {
      const { id } = outing,
        row = OUTING_TABLE[id],
        seats = SEATS[id];
      expect(outingOf(id)).toBe(outing);
      expect(outing.venue, id).toBe(venues[seats.venue]);
      expect(DISTRICT_OUTINGS[outing.venue.kind]).toContain(id);
      expect(outing.period, id).toBe(seats.period);
      expect(outing.times, id).toBe(OUTING_TIMES[id]);
      expect(outing.seats, id).toEqual({ rule: row.rule, spots: row.cap });
      expect(outingSpots(id)).toHaveLength(row.cap);
      expect([outing.underway, outing.seated], id).toEqual([row.underway, row.seated]);
      expect(outing.order, id).toBe(seats.order);
      expect(SEAT_ORDER[outing.order - 1]).toBe(id);
      expect([...outing.excludes], id).toEqual(seats.excludes);
    }
    expect(OUTINGS.map((outing) => outing.order)).toEqual([3, 4, 9, 11, 13, 14, 15]);
    expect(outingOf('zoo')).toBeUndefined();
    expect(outingOf('night-party')).toBeUndefined();
  });

  it('runs each outing on its own days', () => {
    const days = (id: OutingId) => YEAR.filter((day) => outingOf(id)!.on(day));
    expect(days('regatta')).toEqual(YEAR.filter(regattaDay));
    expect(days('regatta')).toHaveLength(7);
    expect(days('harvest-fair')).toEqual(YEAR.filter(harvestDay));
    expect(days('long-table')).toEqual(YEAR.filter(harvestDay));
    expect(days('harvest-fair')).toHaveLength(3);
    expect(days('stargazing')).toEqual(YEAR.filter(starNight));
    expect(days('stargazing')).toHaveLength(12);
    for (const id of ['market', 'bandstand-tea', 'bandstand-sundown'] as const)
      expect(days(id)).toHaveLength(112);
  });

  it('carries a bag home from the market, a boat to the regatta and a dish to the table', () => {
    const carried = Object.fromEntries(
      OUTINGS.filter((outing) => outing.carry).map((o) => [o.id, [o.carry!.kind, o.carry!.leg]]),
    );
    expect(carried).toEqual({
      market: ['paper-bag', 'returning'],
      regatta: ['paper-boat', 'going'],
      'long-table': ['dish', 'going'],
    });
    for (const day of YEAR) {
      expect(outingOf('market')!.carry!.variant(day, 'home')).toBe(
        MARKET_KINDS.indexOf(marketKind(day)),
      );
      expect(outingOf('regatta')!.carry!.variant(day, 'home')).toBe(0);
      for (const id of ['full-town-a6', 'moss-nook'])
        expect(outingOf('long-table')!.carry!.variant(day, id)).toBe(hash(`dish:${day}:${id}`) % 3);
    }
    expect(new Set(YEAR.map((day) => outingOf('long-table')!.carry!.variant(day, 'x')))).toEqual(
      new Set([0, 1, 2]),
    );
  });

  it('lists every seat call once, each excluding only calls made before it', () => {
    expect(new Set(SEAT_ORDER).size).toBe(15);
    expect(Object.keys(SEAT_EXCLUDES).sort()).toEqual([...SEAT_ORDER].sort());
    for (const call of SEAT_ORDER)
      for (const excluded of SEAT_EXCLUDES[call])
        expect(SEAT_ORDER.indexOf(excluded), `${call} excludes ${excluded}`).toBeLessThan(
          SEAT_ORDER.indexOf(call),
        );
    // SPEC §4.0.F: at most one of each set a day, so the later call of any pair excludes the
    // earlier; a film guest has none of the evening's outings and no stargazing.
    const ONE_OF: SeatCall[][] = [
      ['football-morning', 'market'],
      [
        'green',
        'zoo',
        'football-afternoon',
        'millpond',
        'regatta',
        'harvest-fair',
        'bandstand-tea',
      ],
      ['concert', 'long-table', 'bandstand-sundown'],
      ['night-party', 'stargazing'],
    ];
    for (const set of ONE_OF)
      for (const a of set)
        for (const b of set)
          if (SEAT_ORDER.indexOf(a) < SEAT_ORDER.indexOf(b))
            expect(SEAT_EXCLUDES[b], `${b} excludes ${a}`).toContain(a);
    for (const call of ['concert', 'long-table', 'bandstand-sundown', 'stargazing'] as const)
      expect(SEAT_EXCLUDES[call]).toContain('cinema');
    // Today's first calls exclude nobody; the disco now leaves out the stargazers.
    expect(SEAT_EXCLUDES.cinema).toEqual([]);
    expect(SEAT_EXCLUDES['football-morning']).toEqual([]);
    expect(SEAT_EXCLUDES['night-party']).toEqual(['stargazing']);
  });

  it('reads every feature function from its owner’s file', () => {
    // SPEC §7.3: agent B the market, C the bandstand and the regatta, D the harvest, E the stars.
    const poses: Record<OutingId, OutingPose> = {
      market: marketPose,
      regatta: regattaPose,
      'harvest-fair': fairPose,
      'bandstand-tea': teaPose,
      'long-table': tablePose,
      'bandstand-sundown': sundownPose,
      stargazing: starPose,
    };
    for (const outing of OUTINGS) expect(outing.pose, outing.id).toBe(poses[outing.id]);
    const facings: Partial<Record<OutingId, OutingFacing>> = { market: marketFacing };
    for (const outing of OUTINGS) expect(outing.facing, outing.id).toBe(facings[outing.id]);
    expect(builderFromRegistry).toBe(snowmenBuilderPose);
    expect(watcherFromRegistry).toBe(snowmenWatcherPose);
    expectTypeOf(snowmenBuilderPose).toEqualTypeOf<
      (seat: number, time: number, day: number) => EventPose | undefined
    >();
    expectTypeOf(snowmenWatcherPose).toEqualTypeOf<
      (seat: number, time: number, day: number) => EventPose | undefined
    >();

    const painters = {
      market: marketPainter,
      bandstand: bandstandPainter,
      landing: landingPainter,
      harvest: harvestPainter,
      stargazing: stargazingPainter,
      snowmen: snowmenPainter,
    };
    expect(Object.keys(DISTRICT_PAINTERS)).toEqual(Object.keys(painters));
    for (const [key, painter] of Object.entries(painters))
      expect(DISTRICT_PAINTERS[key as keyof typeof painters], key).toBe(painter);
    expect(stargazingPainter.sky).toBe(drawSkyExtras);
    expectTypeOf(drawScarecrowExtras).toEqualTypeOf<
      (ctx: CanvasRenderingContext2D, x: number, y: number, day: number, night: boolean) => void
    >();

    expect(Object.keys(CARRY_SPRITES)).toEqual(['paper-bag', 'paper-boat', 'dish']);
    expect(CARRY_SPRITES['paper-bag']).toBe(paperBagSprite);
    expect(CARRY_SPRITES['paper-boat']).toBe(paperBoatSprite);
    expect(CARRY_SPRITES.dish).toBe(dishSprite);
    for (const sprite of Object.values(CARRY_SPRITES))
      expect(sprite.height).toBeGreaterThanOrEqual(0);

    expect(Object.keys(BANDSTAND_TRACKS).sort()).toEqual([...BANDS].sort());
    for (const track of Object.values(BANDSTAND_TRACKS)) expect(track.bpm).toBeGreaterThan(0);
    expectTypeOf(composeBandstand).toEqualTypeOf<(band: Band) => Note[] | undefined>();
  });

  it('gives every outing a card and every district venue its panel', async () => {
    expect(Object.keys(DISTRICT_CARDS).sort()).toEqual([...OUTING_IDS].sort());
    for (const id of OUTING_IDS)
      expect(DISTRICT_CARDS[id].group, id).toBe(
        id.startsWith('bandstand-') ? 'bandstand' : undefined,
      );
    expect(DISTRICT_CARDS['bandstand-tea'].icon).toBe(DISTRICT_CARDS['bandstand-sundown'].icon);
    const owners = {
      market: MarketInfo,
      bandstand: BandstandInfo,
      landing: LandingInfo,
      harvest: FarmInfo,
    };
    expect(Object.keys(DISTRICT_PANELS)).toEqual(Object.keys(owners));
    for (const [kind, owner] of Object.entries(owners) as [DistrictKind, unknown][]) {
      expect(DISTRICT_PANELS[kind].$$typeof, kind).toBe(Symbol.for('react.lazy'));
      expect((await DISTRICT_PANEL_FILES[kind]()).default, kind).toBe(owner);
    }
    expectTypeOf(StargazingNote).parameter(0).toEqualTypeOf<StargazingNoteProps>();
    expectTypeOf(GreenNote).parameter(0).toEqualTypeOf<GreenNoteProps>();
    expectTypeOf(FarmInfo).parameter(0).toEqualTypeOf<DistrictPanelProps>();
    expectTypeOf<ComponentProps<typeof TubeInfo>['station']>().toEqualTypeOf<
      string | null | undefined
    >();
  });

  it('gives the district harness one button list per feature', () => {
    expect(Object.keys(DISTRICT_BUTTONS)).toEqual([
      'market',
      'bandstand',
      'landing',
      'harvest',
      'stars',
      'snowmen',
    ]);
    for (const buttons of Object.values(DISTRICT_BUTTONS))
      expect(Array.isArray(buttons)).toBe(true);
  });
});
