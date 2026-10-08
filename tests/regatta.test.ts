// The Paper-boat Regatta (SPEC §4.5), agent C: every guest cheers their own boat in; every boat
// goes from its guest's hands to the lawn's edge, to the boatwright, to the water and at last to the
// boatman's basket, one place at a time; the paper boat in hand; and the Landing's panel.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { boatBand, paperBoatSprite } from '../src/city/carry/paper-boat';
import {
  boatAt,
  boatwrightAt,
  boatwrightWay,
  regattaGuestsOf,
  setDownAt,
  type RegattaGuest,
} from '../src/city/district/landing';
import LandingInfo, { atTheWater, regattaNow } from '../src/components/district/LandingInfo';
import {
  OUTING_TIMES,
  REGATTA_BOATS,
  REGATTA_LAUNCH_EVERY,
  regattaBoat,
  regattaDay,
} from '../src/lib/district-calendar';
import { DISTRICT_COPY, PANEL_COPY } from '../src/lib/district-copy';
import { DISTRICT_SPOTS, REGATTA_COURSE } from '../src/lib/district-places';
import { LANE_SHIFT } from '../src/lib/lanes';
import { REGATTA_CHEER, regattaCheer } from '../src/lib/outings/regatta';
import { residentTrips, tripState } from '../src/lib/resident-trips';
import { DEFAULT_RESIDENT, type Place } from '../src/lib/schema';
import { simulateResidents } from '../src/lib/simulation';
import { project, type Point } from '../src/lib/world';
import { TOWNS, YEAR } from './district';
import { recordingContext } from './recording-context';
import { rosterTimeout } from './roster-timeout';

const DAYS = YEAR.filter(regattaDay);
const launchAt = (k: number) => OUTING_TIMES.regatta.start + REGATTA_LAUNCH_EVERY * k;
const STEP = 0.05;
/** A town's regatta days: each with its guests by seat and their homes. */
function regattas(town: Place[]) {
  const homes = new Map(town.map((place) => [place.id, place]));
  return DAYS.map((day) => {
    const plan = residentTrips(town, day);
    const trips = [...plan].flatMap(([id, list]) =>
      list.filter((trip) => trip.event.outing === 'regatta').map((trip) => ({ id, trip })),
    );
    return { day, guests: regattaGuestsOf(plan, town), trips, homes };
  });
}

describe('Regatta guests', () => {
  it(
    'cheer for a minute and a half from the moment their own boat comes to rest, and only then',
    () => {
      let cheered = 0,
        guests = 0;
      for (const town of [TOWNS.real, TOWNS.full, TOWNS.mixed, TOWNS.eager])
        for (const { day, trips, homes } of regattas(town))
          for (const { id, trip } of trips) {
            const home = homes.get(id)!;
            const restAt = regattaBoat(trip.seat, day, 900)!.restAt;
            const cheer = regattaCheer(trip.seat, day, trip.arrive, trip.leave);
            guests++;
            if (cheer && cheer.from === restAt && cheer.to === restAt + REGATTA_CHEER) cheered++;
            for (let t = trip.arrive + STEP; t < trip.leave; t += STEP) {
              const pose = tripState(home, trip, t, day).pose;
              const inside = !!cheer && t >= cheer.from && t < cheer.to;
              // Turning to go may drop a pose for a moment; nothing else stands in for it.
              if (inside && t < trip.leave - 0.25) expect(pose, `${id} at ${t}`).toBe('cheer');
              if (!inside) expect(pose, `${id} at ${t}`).toBeUndefined();
            }
          }
      // Every guest is at the water when their own boat comes in (SPEC §4.5: 70 of 70 seat-days).
      expect(guests).toBe(4 * 7 * REGATTA_BOATS);
      expect(cheered).toBe(guests);
    },
    rosterTimeout(0.6, 120_000),
  );
});

describe('A paper boat’s afternoon', () => {
  const ORDER = ['hand', 'ashore', 'carried', 'water', 'net', 'basket'];

  it(
    'goes from hand to lawn to boatwright to water to net to basket, one place at a time',
    () => {
      let boats = 0;
      for (const town of [TOWNS.real, TOWNS.full])
        for (const { day, guests, trips, homes } of regattas(town))
          for (const { id, trip } of trips) {
            const k = trip.seat;
            const home = homes.get(id)!;
            const guest = guests[k] as RegattaGuest;
            expect(guest.arrive).toBe(trip.arrive);
            let last = 0;
            for (let t = trip.depart + STEP; t < 1035; t += STEP) {
              const where = boatAt(guests, k, t)!;
              const index = ORDER.indexOf(where);
              // Never back, never skipping a step.
              expect(index - last, `boat ${k} on ${day} at ${t.toFixed(2)}`).toBeGreaterThanOrEqual(
                0,
              );
              expect(index - last).toBeLessThanOrEqual(1);
              last = index;
              const state = tripState(home, trip, t, day);
              // In the guest's own hands on the way, and nowhere else then.
              expect(where === 'hand').toBe(state.carry?.kind === 'paper-boat');
              // Set down at their own row's handover point from the moment they arrive.
              if (where === 'ashore') {
                expect(t).toBeGreaterThanOrEqual(trip.arrive);
                const boat = regattaBoat(k, day, t)!;
                expect(boat.state).toBe('ashore');
                expect(boat.x).toBe(REGATTA_COURSE.handoverX);
              }
              // The boatwright holds it whenever it is neither ashore nor afloat.
              const wright = boatwrightAt(guests, t);
              expect(wright?.carrying === k).toBe(where === 'carried');
              if (where === 'water') expect(t).toBeGreaterThanOrEqual(launchAt(k));
            }
            // It goes in on the minute of its launch, from the stage's south tip.
            expect(boatAt(guests, k, launchAt(k) - STEP)).toBe('carried');
            expect(boatAt(guests, k, launchAt(k) + STEP)).toBe('water');
            expect(boatwrightAt(guests, launchAt(k) - STEP)?.stance).toBe('crouch');
            expect(last).toBe(ORDER.length - 1);
            boats++;
          }
      expect(boats).toBe(2 * 7 * REGATTA_BOATS);
    },
    rosterTimeout(0.6, 120_000),
  );

  it('is fetched at a brisk walk: the boatwright never jumps a step', () => {
    for (const town of [TOWNS.real, TOWNS.full])
      for (const { guests } of regattas(town)) {
        let before = boatwrightAt(guests, 826);
        for (let t = 826; t < 997; t += 0.02) {
          const now = boatwrightAt(guests, t);
          if (before && now) {
            const step = Math.hypot(now.at.x - before.at.x, now.at.y - before.at.y);
            // 0.78 tiles a minute: brisk, a little over twice a neighbor's stroll; the farthest
            // rows, fetched in among the guests between two launches, a little more.
            expect(step / 0.02).toBeLessThanOrEqual(1);
          }
          before = now;
        }
      }
  });

  it('is set down at its guest’s own feet, a step toward the river on their own row', () => {
    DISTRICT_SPOTS.landing.forEach((spot, k) => {
      const at = setDownAt(k);
      expect(at.y).toBe(spot.y);
      expect(at.x - spot.x).toBeCloseTo(0.2, 9);
      // The front column's is the frozen handover point on the gravel.
      if (k % 2 === 0) expect(at.x).toBeCloseTo(REGATTA_COURSE.handoverX, 9);
    });
  });

  it(
    'leaves the hand for the ground at the guest’s feet, never jumping across the lawn',
    () => {
      // The town's figures stand 1.25 times their own px; the boat's middle is 3 own px up.
      const SCALE = 1.25;
      const FRAME = 1 / 30;
      let checked = 0;
      for (const town of [TOWNS.real, TOWNS.full])
        for (const { day, trips, homes } of regattas(town))
          for (const { id, trip } of trips) {
            const before = tripState(homes.get(id)!, trip, trip.arrive - FRAME, day);
            expect(before.carry?.kind).toBe('paper-boat');
            const facing = before.facing ?? 'se';
            const { anchor } = paperBoatSprite.grip(facing, before.walkPhase ?? 0);
            const mirror = facing === 'sw' || facing === 'nw' ? -1 : 1;
            const feet = project(before.position!.x, before.position!.y);
            const hand = {
              x: feet.x + mirror * anchor.x * SCALE,
              y: feet.y + (anchor.y - 3) * SCALE,
            };
            const down = project(setDownAt(trip.seat).x, setDownAt(trip.seat).y);
            const ground = { x: down.x, y: down.y - 3 * SCALE };
            // From the hand to the ground by the feet, less than a figure's own height; set down
            // at the old handover point, an odd row's boat moved 45 px across the lawn.
            expect(
              Math.hypot(ground.x - hand.x, ground.y - hand.y),
              `boat ${trip.seat} on ${day}`,
            ).toBeLessThanOrEqual(22);
            checked++;
          }
      expect(checked).toBe(2 * 7 * REGATTA_BOATS);
    },
    rosterTimeout(0.6, 120_000),
  );

  it('is fetched along the guest’s own row, clear of every other guest and of the road’s lanes', () => {
    const clearance = (p: Point, a: Point, b: Point) => {
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const f = Math.max(
        0,
        Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
      );
      return Math.hypot(p.x - (a.x + dx * f), p.y - (a.y + dy * f));
    };
    for (let k = 0; k < REGATTA_BOATS; k++) {
      const way = boatwrightWay(k);
      const pick = way.at(-1)!;
      // A step east of the boat, on its row, and off the riverside road's walking lanes.
      expect(pick.y).toBe(setDownAt(k).y);
      expect(pick.x).toBeGreaterThan(setDownAt(k).x);
      expect(pick.x).toBeLessThanOrEqual(61.5 - LANE_SHIFT - 0.2);
      for (let i = 1; i < way.length; i++)
        DISTRICT_SPOTS.landing.forEach((spot, j) => {
          if (j === k) return;
          expect(
            clearance(spot, way[i - 1], way[i]),
            `boat ${k} past seat ${j}`,
          ).toBeGreaterThanOrEqual(0.3);
          // The boats still ashore: every boat before this one is already on the water.
          if (j > k)
            expect(clearance(setDownAt(j), way[i - 1], way[i])).toBeGreaterThanOrEqual(0.3);
        });
    }
  });

  it('has no boat for an empty seat', () => {
    const guests: (RegattaGuest | undefined)[] = Array.from({ length: REGATTA_BOATS });
    for (let k = 0; k < REGATTA_BOATS; k++) expect(boatAt(guests, k, 900)).toBeUndefined();
  });
});

describe('The paper boat in hand', () => {
  const look = { ...DEFAULT_RESIDENT, outfit: '#5F84A0' };

  it('is white, with a band in the folder’s own colour', () => {
    const { ctx, calls } = recordingContext();
    paperBoatSprite.draw(ctx, 0, 0, 0, look, false);
    const fills = calls.map((call) => String(call.fillStyle).toUpperCase());
    expect(fills).toContain('#5F84A0');
    expect(fills).toContain('#FFFFFB');
    // Bright mustard reads as lamplight on the river: the band takes it a shade darker.
    expect(boatBand({ outfit: '#E0B75A' })).not.toBe('#E0B75A');
    expect(boatBand({ outfit: '#5F84A0' })).toBe('#5F84A0');
    expect(paperBoatSprite.height).toBeGreaterThan(0);
  });

  it('rides in front of the waist, and behind the body walking away', () => {
    for (const facing of ['se', 'sw'] as const)
      expect(paperBoatSprite.grip(facing, 0)).toEqual({ anchor: { x: 6, y: -7 }, behind: false });
    for (const facing of ['ne', 'nw'] as const)
      expect(paperBoatSprite.grip(facing, 0).behind).toBe(true);
    // It rises and falls with the step, a pixel at most.
    const ys = [0, 0.25, 0.5, 0.75].map((phase) => paperBoatSprite.grip('se', phase).anchor.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(1);
  });
});

describe('The Landing’s panel', () => {
  const render = (day: number, minutes: number) =>
    renderToStaticMarkup(
      createElement(LandingInfo, {
        day,
        minutes,
        residents: simulateResidents(TOWNS.full, minutes, day),
        places: TOWNS.full,
        onFollow: () => {},
      }),
    );

  it('is the lawn by the river out of Regatta Week', () => {
    const day = YEAR.find((d) => !regattaDay(d))!;
    const html = render(day, 900);
    expect(html).toContain(PANEL_COPY.landing.eyebrow);
    expect(html).toContain(PANEL_COPY.landing.heading);
    expect(html).toContain(PANEL_COPY.landing.body);
    expect(html).toContain(PANEL_COPY.landing.week);
    expect(html).not.toContain(DISTRICT_COPY.regatta.panelEyebrow!);
  });

  it('reports the regatta in Regatta Week, never ranks it, and names guests only at the water', () => {
    const day = DAYS[0];
    const html = render(day, 915);
    expect(html).toContain(DISTRICT_COPY.regatta.panelEyebrow!);
    expect(html).toContain(DISTRICT_COPY.regatta.description(day));
    const here = atTheWater(simulateResidents(TOWNS.full, 915, day));
    expect(here.length).toBeGreaterThan(0);
    for (const resident of here) expect(html).toContain(resident.resident.name);
    const morning = render(day, 600);
    for (const resident of here) expect(morning).not.toContain(resident.resident.name);
    for (let minutes = 600; minutes < 1100; minutes += 5)
      for (const line of [regattaNow(day, minutes), regattaNow(DAYS.at(-1)!, minutes)]) {
        expect(line).not.toMatch(/!|first|last|winner|won|fastest|place/i);
        expect(line.endsWith('.')).toBe(true);
      }
    expect(regattaNow(DAYS.at(-1)!, 1100)).toContain('over until next summer');
    expect(regattaNow(day, 1100)).toContain('tomorrow');
  });
});
