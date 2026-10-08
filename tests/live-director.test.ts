import { describe, expect, it } from 'vitest';
import {
  easeLiveCamera,
  liveCamera,
  liveProgram,
  liveHighlights,
  liveShotAt,
  SCENERY_START,
  SCENERY_SECONDS,
  FOLLOW_SECONDS,
  LANTERN_SHOT,
  LIVE_EASE_SECONDS,
  LIVE_RIDE_EASE_SECONDS,
  liveCenterLift,
  liveEaseSeconds,
  liveLabelLift,
  liveDistrictShot,
  liveDistrictShots,
  liveDistrictHighlight,
  FILM_NIGHT_SHOTS,
} from '../src/lib/live-director';
import { cinemaAt, cinemaProgram } from '../src/lib/cinema';
import { harvestDay, regattaDay, starNight } from '../src/lib/district-calendar';
import { FROZEN_TOWN, TOWNS, YEAR } from './district';
import { districtEvents } from '../src/lib/events';
import { OUTING_IDS } from '../src/lib/district-calendar';
import { tubeRides } from '../src/lib/tube-traffic';
import { residentTrips } from '../src/lib/resident-trips';
import { nightBedtime } from '../src/lib/night-routine';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { eventsForDay, isEventLive } from '../src/lib/events';
import { footballAt } from '../src/lib/football';
import { townCatAt } from '../src/lib/town-cat';
import { ducksAt } from '../src/lib/ducks';
import { getPlot, isRoad, plotCenter, project } from '../src/lib/world';
import { FORK_BOUNDS, FORK_PLOT } from '../src/lib/lanterns';
import { SKATING, millpondSkatingDay } from '../src/lib/millpond';
import { CALENDAR_EPOCH_DAY, townCalendarAt } from '../src/lib/town-calendar';
import { AFTER_HOURS, HOMES } from './fixtures';
import { readPlaces } from './full-town';
import { rosterTimeout } from './roster-timeout';

const places = readPlaces();
/** Whether the day's program may film the Morning Market (its district highlight). */
const filmsTheMarket = (day: number) =>
  liveDistrictShots(day).some((shot) => shot.outing === 'market');
const shotAt = (day: number, minute: number) =>
  liveShotAt(liveProgram(places, day), minute, simulateResidents(places, minute, day));

describe('Live broadcast director', () => {
  // Every minute of four days for four towns: seconds of work, so it gets a generous timeout.
  it(
    'keeps the scenery window and films only selected events or eligible outdoor subjects',
    () => {
      const sleepers = places.map((p) => ({
        ...p,
        resident: {
          ...p.resident,
          routine: { morning: 'home', afternoon: 'home', evening: 'home', night: 'sleep' } as const,
        },
      }));
      for (const homes of [places, sleepers, [], [AFTER_HOURS]]) {
        for (let day = 0; day < 4; day++) {
          const program = liveProgram(homes, day);
          let scenery = 0;
          for (let minute = 0; minute < 1440; minute++) {
            const residents = simulateResidents(homes, minute, day);
            const shot = liveShotAt(program, minute, residents);
            if (shot.kind === 'home') {
              if (shot.id.startsWith('postcard:')) {
                scenery++;
                expect(minute).toBeGreaterThanOrEqual(SCENERY_START);
                expect(minute).toBeLessThan(SCENERY_START + SCENERY_SECONDS);
              } else {
                expect(
                  residents.some(
                    (resident) =>
                      resident.activity === 'stroll' && resident.event?.phase !== 'attending',
                  ),
                ).toBe(false);
                expect(townCatAt(homes, minute, day).outside).toBe(false);
              }
            } else if (shot.kind === 'neighbor') {
              const subject = residents.find((r) => r.id === shot.residentId)!;
              expect(subject.activity).toBe('stroll');
              const outing = OUTING_IDS.find((id) => id === subject.event?.id);
              // A Riverside guest is followed except while their outing's own shot is on air.
              if (subject.event?.phase === 'attending' && outing)
                expect(liveDistrictShot(program, minute)?.outing).not.toBe(outing);
              // Skaters on the Millpond are followable whatever the lineup (no show to skip).
              else if (subject.event?.phase === 'attending' && subject.event.id !== 'millpond') {
                const highlight =
                  subject.event.id === 'football' || subject.event.id === 'cinema'
                    ? subject.event.id
                    : program.events.find((event) => event.id === subject.event?.id)!.period;
                expect(
                  liveHighlights(highlight === 'night' && minute < 360 ? day - 1 : day),
                ).toContain(highlight);
              }
            } else if (shot.kind === 'event') {
              if (shot.id.startsWith('district:')) {
                // A Riverside shot: its outing is on, inside its own window, with someone there.
                // A film night's stars run past midnight under their evening's id.
                const [, shotDay, outing] = shot.id.split(':');
                const evening = Number(shotDay);
                expect(minute < 360 ? [day, day - 1] : [day]).toContain(evening);
                const district = liveDistrictShot(program, minute)!;
                expect(district.outing).toBe(outing);
                expect(minute).toBeGreaterThanOrEqual(district.from);
                expect(minute).toBeLessThan(district.to);
                // On that day, and under way (the Long Table's lamps outlast its 20:30 end).
                const clock = evening === day ? minute : minute + 1440;
                const event = districtEvents(evening).find((event) => event.id === outing)!;
                expect(clock).toBeGreaterThanOrEqual(event.start);
                expect(clock).toBeLessThan(event.homeBy);
              } else if (shot.id.startsWith('football:')) {
                expect(program.highlights).toContain('football');
                expect(footballAt(minute, day).live).toBe(true);
                expect(minute).toBeGreaterThanOrEqual(640);
                expect(minute).toBeLessThan(780);
              } else {
                const event = eventsForDay(day).find((event) => shot.id.endsWith(`:${event.id}`))!;
                expect(event).toBeDefined();
                expect(
                  liveHighlights(event.period === 'night' && minute < 360 ? day - 1 : day),
                ).toContain(event.id === 'cinema' ? 'cinema' : event.period);
                expect(isEventLive(event, minute)).toBe(true);
                if (event.venue.kind === 'green')
                  expect(
                    residents.some(
                      (r) =>
                        r.activity === 'stroll' &&
                        r.event?.id === event.id &&
                        r.event.phase === 'attending',
                    ),
                  ).toBe(true);
              }
            } else if (shot.kind === 'lanterns') {
              expect(homes.length).toBeGreaterThan(0);
              expect(minute).toBeGreaterThanOrEqual(LANTERN_SHOT.start);
              expect(minute).toBeLessThan(LANTERN_SHOT.end);
            } else if (shot.kind === 'ducks') {
              expect(program.highlights).toContain('ducks');
              expect(ducksAt(minute).length).toBeGreaterThan(0);
              expect(minute).toBeGreaterThanOrEqual(600);
              expect(minute).toBeLessThan(640);
            } else {
              expect(shot.kind).toBe('cat');
              expect(townCatAt(homes, minute, day).outside).toBe(true);
            }
          }
          expect(scenery).toBe(60);
        }
      }
    },
    rosterTimeout(390, 90_000),
  );

  it(
    'chooses three varied highlights each day, with no always-on ducks or disco',
    () => {
      const lineups = new Set<string>();
      for (let day = 0; day < 30; day++) {
        const highlights = liveHighlights(day);
        expect(new Set(highlights).size).toBe(3);
        expect(liveHighlights(day)).toEqual(highlights);
        lineups.add([...highlights].sort().join(','));
        for (const [highlight, minute] of [
          ['ducks', 620],
          ['football', 700],
          ['afternoon', 800],
          ['evening', 1150],
          // After any cinema bill has ended (see the cinema's before-midnight test).
          ['night', 1436],
        ] as const) {
          const shot = shotAt(day, minute);
          // A film night's stars air from the end of the bill, whatever the lineup.
          if (shot.id.startsWith('district:')) continue;
          expect(shot.kind === 'event' || shot.kind === 'ducks').toBe(
            highlights.includes(highlight),
          );
        }
      }
      expect(lineups.size).toBeGreaterThanOrEqual(7);
      for (const highlight of ['ducks', 'football', 'afternoon', 'evening', 'night'] as const) {
        const count = Array.from({ length: 30 }, (_, day) =>
          liveHighlights(day).includes(highlight),
        ).filter(Boolean).length;
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThan(30);
      }
    },
    rosterTimeout(390, 90_000),
  );

  it('follows people between highlights and holds the full selected football match', () => {
    expect(shotAt(12, 420).kind).toBe('neighbor');
    const afterAfternoon =
      Math.max(
        ...eventsForDay(12)
          .filter((event) => event.period === 'afternoon')
          .map((event) => event.end),
      ) + 5;
    expect(shotAt(12, afterAfternoon).kind).toBe('neighbor');
    const day = Array.from({ length: 30 }, (_, day) => day).find((day) =>
      liveHighlights(day).includes('football'),
    )!;
    for (const minute of [640, 700, 779.9]) expect(shotAt(day, minute).id).toContain('football:');
    expect(shotAt(12, 299.99).kind).not.toBe('home');
    expect(shotAt(12, 300).kind).toBe('home');
    expect(shotAt(12, 359.99).kind).toBe('home');
    expect(shotAt(12, 360).kind).not.toBe('home');
  });

  it(
    'stays with a winter skater once they are out on the Millpond ice',
    () => {
      // Every frozen day of two years with the published roster.
      const skatingDays = Array.from({ length: 224 }, (_, i) => CALENDAR_EPOCH_DAY + i).filter(
        millpondSkatingDay,
      );
      expect(skatingDays.length).toBe(22);
      let followed = 0,
        kept = 0;
      for (const day of skatingDays) {
        // The day's skaters first in every clip's cast, so even a crowded town follows one out.
        const skaters = [...residentTrips(places, day)]
          .filter(([, trips]) => trips.some((trip) => trip.event.id === 'millpond'))
          .map(([id]) => id);
        const planned = liveProgram(places, day);
        const program = {
          ...planned,
          cast: planned.cast.map((ids) => [
            ...skaters,
            ...ids.filter((id) => !skaters.includes(id)),
          ]),
        };
        let walkingIn: string | undefined;
        for (let minute = SKATING.depart; minute < SKATING.end; minute += 0.5) {
          const residents = simulateResidents(places, minute, day);
          const shot = liveShotAt(program, minute, residents);
          const subject = residents.find((r) => r.id === shot.residentId);
          // A follow that walked someone to the pond is not dropped as they step onto the ice.
          const arrived = residents.find((r) => r.id === walkingIn);
          if (arrived?.event?.phase === 'attending' && minute % FOLLOW_SECONDS !== 0) {
            expect(shot.residentId).toBe(arrived.id);
            kept++;
          }
          walkingIn = undefined;
          if (shot.kind !== 'neighbor' || subject?.event?.id !== 'millpond') continue;
          if (subject.event.phase === 'going') walkingIn = subject.id;
          if (subject.event.phase === 'attending') {
            expect(subject.pose).toBe('skate');
            followed++;
          }
        }
      }
      expect(followed).toBeGreaterThan(0);
      expect(kept).toBeGreaterThan(0);
    },
    rosterTimeout(190, 45_000),
  );

  it('keeps casting deterministic and switches away from a resident who goes indoors', () => {
    const program = liveProgram(places, 12);
    expect(liveProgram([...places].reverse(), 12)).toEqual(program);
    const residents = simulateResidents(places, 510, 12);
    const shot = liveShotAt(program, 510, residents);
    expect(shot.kind).toBe('neighbor');
    const indoors = residents.map((r) =>
      r.id === shot.residentId ? { ...r, activity: 'sleep' as const } : r,
    );
    expect(liveShotAt(program, 510, indoors).residentId).not.toBe(shot.residentId);
  });

  it('reshuffles the people followed across days and gives each available neighbor screen time', () => {
    const homes = HOMES.slice(0, 3).map((home) => ({
      ...home,
      resident: {
        ...home.resident,
        routine: { morning: 'stroll', afternoon: 'home', evening: 'home', night: 'sleep' } as const,
      },
    }));
    const sequences = new Set<string>();
    for (let day = 0; day < 60; day++) {
      // The third neighbor browses the market; on its live days the market's own shot films them.
      if (!liveHighlights(day).includes('football') || filmsTheMarket(day)) continue;
      const program = liveProgram(homes, day);
      const ids = Array.from({ length: 6 }, (_, index) => {
        const time = 360 + index * FOLLOW_SECONDS;
        return liveShotAt(program, time, simulateResidents(homes, time, day)).residentId!;
      });
      expect(new Set(ids).size).toBe(homes.length);
      for (const home of homes) expect(ids.filter((id) => id === home.id)).toHaveLength(2);
      sequences.add(ids.join(','));
    }
    expect(sequences.size).toBeGreaterThanOrEqual(6);
  });

  it('shares 45-second clips among outdoor neighbors, including spectators instead of repeating a lone walker', () => {
    const homes = HOMES.slice(0, 3).map((home) => ({
      ...home,
      resident: {
        ...home.resident,
        routine: {
          morning: 'stroll',
          afternoon: 'stroll',
          evening: 'stroll',
          night: 'sleep',
        } as const,
      },
    }));
    for (const day of Array.from({ length: 20 }, (_, day) => day).filter(
      (day) => liveHighlights(day).includes('football') && !filmsTheMarket(day),
    )) {
      const program = liveProgram(homes, day);
      const featured: string[] = [];
      for (let time = 360; time < 585; time += FOLLOW_SECONDS) {
        const residents = simulateResidents(homes, time, day);
        // Two at the match; the third walks to the market, or browses there.
        if (time >= 540)
          expect(residents.filter((r) => r.event?.id !== 'football')).toHaveLength(1);
        const shot = liveShotAt(program, time, residents);
        expect(shot.kind).toBe('neighbor');
        expect(shot.residentId).not.toBe(featured.at(-1));
        featured.push(shot.residentId!);
        for (const offset of [0.1, 20, FOLLOW_SECONDS - 0.01]) {
          expect(
            liveShotAt(program, time + offset, simulateResidents(homes, time + offset, day))
              .residentId,
          ).toBe(shot.residentId);
        }
        expect(liveShotAt(program, time, [...residents].reverse())).toEqual(shot);
      }
      expect(new Set(featured).size).toBe(3);
    }
  });

  it('rotates replacements too, and keeps an only available resident on screen', () => {
    const homes = HOMES.slice(0, 4).map((home) => ({
      ...home,
      resident: {
        ...home.resident,
        routine: {
          morning: 'stroll',
          afternoon: 'stroll',
          evening: 'home',
          night: 'sleep',
        } as const,
      },
    }));
    const program = liveProgram(homes, 12);
    const replacements = new Set<string>();
    for (let time = 360; time < 630; time += FOLLOW_SECONDS) {
      const residents = simulateResidents(homes, time, 12);
      const original = liveShotAt(program, time, residents);
      const remaining = residents
        .filter((r) => r.id !== original.residentId)
        .map((r) => ({ ...r, event: undefined }));
      const replacement = liveShotAt(program, time, remaining);
      expect(replacement.kind).toBe('neighbor');
      expect(replacement.residentId).not.toBe(original.residentId);
      replacements.add(replacement.residentId!);
      expect(liveShotAt(program, time, [remaining[0]]).residentId).toBe(remaining[0].id);
    }
    expect(replacements.size).toBeGreaterThan(1);
  });

  it('keeps both selected and skipped parties consistent across midnight', () => {
    for (let day = 0; day < 10; day++) {
      const selected = liveHighlights(day).includes('night');
      const before = shotAt(day, 1439.9);
      const after = shotAt(day + 1, 0);
      expect(before.kind === 'event').toBe(selected);
      expect(after.kind === 'event').toBe(selected);
      expect(shotAt(day + 1, 149.9).kind === 'event').toBe(selected);
      if (selected) expect(before).toEqual(after);
    }
    expect(shotAt(3, 160).kind).toBe('neighbor');
    // After the last night owl's bedtime only Miso is out, until the scenery at 05:00. In a full
    // town an owl can still be at their door then, so the shot is one of the quiet set: the
    // neighbor while anyone is out, and otherwise the cat (or the waking town at 05:00).
    const quiet = Math.max(
      290,
      ...places
        .filter((home) => home.resident.routine.night === 'stroll')
        .map((home) => nightBedtime(home) - 1440 + 0.5),
    );
    const settled = quiet < SCENERY_START ? 'cat' : 'home';
    const out = simulateResidents(places, quiet, 3).some((r) => r.activity === 'stroll');
    expect(out ? ['neighbor', settled] : [settled]).toContain(shotAt(3, quiet).kind);
  });

  it('films Lantern hour at the Lantern Fork every evening', () => {
    expect(LANTERN_SHOT).toEqual({ start: 1198, end: 1224 });
    const fork = plotCenter(getPlot(FORK_PLOT)!);
    for (let day = 0; day < 6; day++) {
      for (const [minute, filmed] of [
        [1197.9, false],
        [1198, true],
        [1210, true],
        [1223.9, true],
        [1224, false],
      ] as const) {
        const shot = shotAt(day, minute);
        expect(shot.kind === 'lanterns').toBe(filmed);
        if (!filmed) continue;
        expect(shot.id).toBe(`lanterns:${day}`);
        expect(shot.label).toBe('Lantern hour at the Lantern Fork');
        expect(shot).toEqual(shotAt(day, 1198));
      }
      const empty = liveProgram([], day);
      expect(liveShotAt(empty, 1210, []).kind).not.toBe('lanterns');
    }
    // The whole Fork, from the top of its crown to its plaque, stays inside both screens.
    const shot = shotAt(3, 1210);
    for (const [width, height] of [
      [1920, 900],
      [390, 844],
    ]) {
      const camera = liveCamera(shot, width, height);
      const screen = (x: number, y: number) => ({
        x: x * camera.zoom + camera.x,
        y: y * camera.zoom + camera.y,
      });
      const topLeft = screen(fork.x + FORK_BOUNDS.left, fork.y + FORK_BOUNDS.top);
      const bottomRight = screen(fork.x + FORK_BOUNDS.right, fork.y + FORK_BOUNDS.bottom);
      expect(topLeft.x).toBeGreaterThan(0);
      expect(topLeft.y).toBeGreaterThan(0);
      expect(bottomRight.x).toBeLessThan(width);
      expect(bottomRight.y).toBeLessThan(height);
      expect(camera.zoom).toBeLessThanOrEqual(1.8);
    }
  });

  it('frames the whole duck family on selected days and ends its clip on time', () => {
    // A day the market's shot (09:30–10:10, ranked first) leaves the whole walk to the ducks.
    const day = Array.from({ length: 30 }, (_, day) => day).find(
      (day) => liveHighlights(day).includes('ducks') && !filmsTheMarket(day),
    )!;
    for (const homes of [places, []]) {
      const program = liveProgram(homes, day);
      for (let minute = 600; minute < 640; minute += 0.5) {
        const shot = liveShotAt(program, minute, simulateResidents(homes, minute, day));
        expect(shot.kind).toBe('ducks');
        for (const [width, height] of [
          [1920, 900],
          [390, 844],
        ]) {
          const camera = liveCamera(shot, width, height);
          for (const duck of ducksAt(minute)) {
            const point = project(duck.position.x, duck.position.y);
            expect(point.x * camera.zoom + camera.x).toBeGreaterThan(20);
            expect(point.x * camera.zoom + camera.x).toBeLessThan(width - 20);
            expect(point.y * camera.zoom + camera.y).toBeGreaterThan(30);
            expect(point.y * camera.zoom + camera.y).toBeLessThan(height - 20);
          }
        }
      }
      expect(liveShotAt(program, 640, []).kind).not.toBe('ducks');
    }
  });

  it('keeps the cat on the street, visible during scenery, and continuous across midnight', () => {
    for (const homes of [places, [], [AFTER_HOURS]]) {
      const program = liveProgram(homes, 12);
      for (let minute = 0; minute < 1440; minute += 0.5) {
        const cat = townCatAt(homes, minute, 12);
        expect(isRoad(Math.floor(cat.position.x), Math.floor(cat.position.y))).toBe(true);
        if (minute >= 300 && minute < 360) {
          const shot = liveShotAt(program, minute, []);
          const point = project(cat.position.x, cat.position.y);
          for (const [width, height] of [
            [1920, 900],
            [390, 844],
          ]) {
            const camera = liveCamera(shot, width, height);
            expect(point.x * camera.zoom + camera.x).toBeGreaterThan(20);
            expect(point.x * camera.zoom + camera.x).toBeLessThan(width - 20);
            expect(point.y * camera.zoom + camera.y).toBeGreaterThan(20);
            expect(point.y * camera.zoom + camera.y).toBeLessThan(height - 20);
          }
        }
      }
      const before = townCatAt(homes, 1439.999, 12).position;
      const after = townCatAt(homes, 0, 13).position;
      expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(0.001);
    }
  });

  it('holds each shot centered without added drift or zoom', () => {
    for (const minute of [100, 320, 650, 800, 1200]) {
      const shot = shotAt(12, minute);
      for (const [width, height] of [
        [1920, 900],
        [390, 844],
        [844, 390],
      ]) {
        const camera = liveCamera(shot, width, height);
        const x = camera.x + shot.center.x * camera.zoom,
          y = camera.y + shot.center.y * camera.zoom;
        expect(x).toBeCloseTo(width / 2);
        expect(y).toBeCloseTo(height / 2);
        expect(x - (shot.width * camera.zoom) / 2).toBeGreaterThan(0);
        expect(x + (shot.width * camera.zoom) / 2).toBeLessThan(width);
        expect(y - (shot.height * camera.zoom) / 2).toBeGreaterThan(0);
        expect(y + (shot.height * camera.zoom) / 2).toBeLessThan(height);
      }
    }
    const footballDay = Array.from({ length: 30 }, (_, day) => day).find((day) =>
      liveHighlights(day).includes('football'),
    )!;
    const heldMatch = [640, 700, 779.9].map((minute) => shotAt(footballDay, minute));
    expect(heldMatch.every((shot) => shot.kind === 'event')).toBe(true);
    const first = liveCamera(heldMatch[0], 1280, 720);
    for (const shot of heldMatch.slice(1)) expect(liveCamera(shot, 1280, 720)).toEqual(first);
  });

  it('keeps a neighbor riding the tube near the centre, then settles as before', () => {
    const day = CALENDAR_EPOCH_DAY + 3;
    const ride = tubeRides(places, day).find((r) => r.direction === 'there' && r.board > 400)!;
    const program = { ...liveProgram(places, day), highlights: [], previousHighlights: [] };
    program.cast = program.cast.map((ids) => [
      ride.residentId,
      ...ids.filter((id) => id !== ride.residentId),
    ]);
    for (const [width, height] of [
      [1920, 1080],
      [390, 844],
    ]) {
      let camera: ReturnType<typeof liveCamera> | undefined;
      let previous: ResidentState | undefined;
      let worst = 0;
      const stages = new Set<string>();
      for (let t = ride.board - 1; t < ride.off + 2; t += 1 / 60) {
        const residents = simulateResidents(places, t, day);
        const shot = liveShotAt(program, t, residents);
        expect(shot.residentId).toBe(ride.residentId);
        const rider = residents.find((r) => r.id === ride.residentId)!;
        const target = liveCamera(shot, width, height);
        camera = camera ? easeLiveCamera(camera, target, 1 / 60, liveEaseSeconds(rider)) : target;
        const p = project(rider.position.x, rider.position.y);
        worst = Math.max(
          worst,
          Math.abs(p.x * camera.zoom + camera.x - width / 2) / (width / 2),
          Math.abs((p.y - liveCenterLift(rider)) * camera.zoom + camera.y - height / 2) /
            (height / 2),
        );
        // The label and the centre never jump, through the fwoomp, the ride and the drop.
        if (previous) {
          expect(Math.abs(liveLabelLift(rider) - liveLabelLift(previous))).toBeLessThanOrEqual(6);
          expect(Math.abs(liveCenterLift(rider) - liveCenterLift(previous))).toBeLessThanOrEqual(6);
        }
        if (rider.transit) stages.add(rider.transit.stage);
        previous = rider;
      }
      expect([...stages]).toEqual(['boarding', 'riding', 'alighting']);
      expect(worst).toBeLessThan(0.25);
    }
    expect(liveEaseSeconds(undefined)).toBe(LIVE_EASE_SECONDS);
    expect(liveCenterLift(undefined)).toBe(22);
    expect(liveLabelLift(undefined)).toBe(43);
    expect(LIVE_RIDE_EASE_SECONDS).toBe(0.12);
    const from = { x: 0, y: 40, zoom: 0.5 },
      to = { x: 900, y: -100, zoom: 1.5 };
    expect(easeLiveCamera(from, to, 1)).toEqual(easeLiveCamera(from, to, 1, LIVE_EASE_SECONDS));
    expect(LIVE_EASE_SECONDS).toBe(1.6);
  });

  it('eases camera changes without overshoot and independently of frame rate', () => {
    const from = { x: 0, y: 40, zoom: 0.5 },
      to = { x: 900, y: -100, zoom: 1.5 };
    const next = easeLiveCamera(from, to, 1);
    expect(next.x).toBeGreaterThan(from.x);
    expect(next.x).toBeLessThan(to.x);
    let stepped = from;
    for (let i = 0; i < 30; i++) stepped = easeLiveCamera(stepped, to, 1 / 30);
    expect(stepped.x).toBeCloseTo(next.x);
    expect(stepped.zoom).toBeCloseTo(next.zoom);
  });
});

describe('The Riverside on air', () => {
  const festival = (day: number) => regattaDay(day) || harvestDay(day) || starNight(day);

  it('films the market on an afternoon day and the Bandstand on any other', () => {
    // The teatime set (16:00–16:40) lies inside an afternoon's zoo, which the director ranks
    // first; the market at 09:30 meets no event. So the pick never lets the zoo take the shot.
    const picks = { market: 0, bandstand: 0 };
    for (let day = CALENDAR_EPOCH_DAY; day < CALENDAR_EPOCH_DAY + 3 * 112; day++) {
      const pick = liveDistrictHighlight(day);
      expect(pick, townCalendarAt(day).label).toBe(
        liveHighlights(day).includes('afternoon') ? 'market' : 'bandstand',
      );
      if (!festival(day)) picks[pick]++;
    }
    // Still about an even split (SPEC §4.7): each gets 40–60% of the plain days.
    const plain = picks.market + picks.bandstand;
    for (const count of Object.values(picks)) {
      expect(count / plain).toBeGreaterThan(0.4);
      expect(count / plain).toBeLessThan(0.6);
    }
  });

  it('moves a film night’s Long Table before lantern hour and its stars after the bill', () => {
    let films = 0;
    for (let day = CALENDAR_EPOCH_DAY; day < CALENDAR_EPOCH_DAY + 5 * 112; day++) {
      const film = liveHighlights(day).includes('cinema');
      for (const shot of liveDistrictShots(day)) {
        if (shot.outing === 'long-table')
          expect([shot.from, shot.to]).toEqual(
            film
              ? [FILM_NIGHT_SHOTS['long-table'].from, FILM_NIGHT_SHOTS['long-table'].to]
              : [1224, 1244],
          );
        if (shot.outing !== 'stargazing') continue;
        expect([shot.from, shot.to]).toEqual(
          film ? [cinemaProgram(day).end, FILM_NIGHT_SHOTS.stargazing.to] : [1380, 1425],
        );
        if (film) films++;
        // Never a minute of the window under the bill.
        for (let minute = shot.from; minute < shot.to; minute += 0.25)
          expect(film && cinemaAt(minute, day).live, `${day} at ${minute}`).toBe(false);
      }
    }
    expect(films).toBeGreaterThan(5);
  });

  it(
    'airs every planned district shot for its whole window, all year, in the real and full towns',
    () => {
      // The zoo once held the teatime set on most of its days and the film night's bill the
      // stars: a planned shot now airs every minute of its window, a film night's stars past
      // midnight under their evening's id.
      for (const [name, town] of [
        ['frozen', FROZEN_TOWN],
        ['full', TOWNS.full],
      ] as const) {
        const seen = new Set<string>();
        let overnight = 0;
        for (const day of YEAR) {
          const program = liveProgram(town, day);
          for (const shot of program.district) {
            seen.add(shot.outing);
            for (let minute = Math.ceil(shot.from); minute < shot.to; minute++) {
              const late = minute >= 1440;
              const clock = late ? minute - 1440 : minute;
              const on = liveShotAt(
                late ? liveProgram(town, day + 1) : program,
                clock,
                simulateResidents(town, clock, late ? day + 1 : day),
              );
              expect(on.id, `${name}, ${townCalendarAt(day).label} at ${minute}`).toBe(
                `district:${day}:${shot.outing}`,
              );
              if (late) overnight++;
            }
          }
        }
        expect([...seen].sort(), name).toEqual(
          ['bandstand-tea', 'harvest-fair', 'long-table', 'market', 'regatta', 'stargazing'].sort(),
        );
        expect(overnight, name).toBeGreaterThan(0);
      }
    },
    rosterTimeout(1, 120_000),
  );
});
