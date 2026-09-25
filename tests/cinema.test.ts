import { residentTrips } from '../src/lib/resident-trips';
import { nightBedtime } from '../src/lib/night-routine';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CINEMA_FILMS,
  CINEMA_PLOTS,
  CINEMA_SEATS,
  cinemaProgram,
  cinemaAt,
  cinemaGuests,
  insideCinema,
  CINEMA_FRAME,
  CINEMA_SCREEN_RISE,
  CINEMA_SCREEN_ROLL_SECONDS,
} from '../src/lib/cinema';
import { cinemaEventForDay, HOUSE_PLOTS, venueAt, eventMinutes } from '../src/lib/events';
import { placeSchema } from '../src/lib/schema';
import { simulateResidents, residentActivityLabel } from '../src/lib/simulation';
import { isRoad, getPlot, plotEntrance, project } from '../src/lib/world';
import { liveProgram, liveShotAt, liveCamera, liveHighlights } from '../src/lib/live-director';
import { cinemaScreenHit, SCREEN_ORIGIN, SCREEN_SCALE } from '../src/city/cinema';
import { cityHit } from '../src/city/render';
import { townDayAt, townMinutesAt, TOWN_DAY_MS } from '../src/lib/town-time';

const sample = placeSchema.parse(JSON.parse(readFileSync('places/my-little-place.json', 'utf8')));
const crowd = HOUSE_PLOTS.slice(0, 32).map((plot, index) => ({
  ...sample,
  id: `moviegoer-${index}`,
  plot: plot.id,
  resident: {
    ...sample.resident,
    routine: { morning: 'home', afternoon: 'home', evening: 'stroll', night: 'stroll' } as const,
  },
}));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('Starlight Cinema', () => {
  it('raises at dusk, stays open through the closing card, and stows until the next night', () => {
    const day = 4,
      bill = cinemaProgram(day),
      duration = CINEMA_SCREEN_ROLL_SECONDS;
    expect(cinemaAt(CINEMA_SCREEN_RISE - 0.01, day).screenReveal).toBe(0);
    expect(cinemaAt(CINEMA_SCREEN_RISE, day).screenReveal).toBe(0);
    expect(cinemaAt(CINEMA_SCREEN_RISE + duration / 2, day).screenReveal).toBeCloseTo(0.5);
    expect(cinemaAt(CINEMA_SCREEN_RISE + duration, day).screenReveal).toBe(1);
    for (let t = bill.start; t <= bill.end; t += 0.5) expect(cinemaAt(t, day).screenReveal).toBe(1);
    expect(cinemaAt(bill.end + duration / 2, day).screenReveal).toBeCloseTo(0.5);
    expect(cinemaAt(bill.end + duration, day).screenReveal).toBe(0);
    for (const t of [0, 359.99, 360, 720, 1199.99])
      expect(cinemaAt(t, day + 1).screenReveal).toBe(0);
    expect(cinemaAt(1441, day).screenReveal).toBe(cinemaAt(1, day + 1).screenReveal);
    const screenPoint = (u: number, v: number) => ({
      x: SCREEN_ORIGIN.x + u * SCREEN_SCALE,
      y: SCREEN_ORIGIN.y - 150 + (u * 0.5 + v) * SCREEN_SCALE,
    });
    expect(cinemaScreenHit(screenPoint(160, 30), 1)).toBe(true);
    expect(cinemaScreenHit(screenPoint(160, 30), 0.5)).toBe(false);
    expect(cinemaScreenHit(screenPoint(160, 150), 0.5)).toBe(true);
    expect(cinemaScreenHit(screenPoint(160, 150), 0)).toBe(false);
    expect(cinemaScreenHit(screenPoint(160, 190), 0)).toBe(true);
    expect(cityHit(screenPoint(160, 30), [], [], 0)).toBeUndefined();
  });
  it('selects exactly three different films with a shared, varying, order-independent nightly bill', () => {
    const library = [
      ...CINEMA_FILMS,
      ...[18, 27, 71, 83].map((duration, index) => ({
        ...CINEMA_FILMS[0],
        id: `future-${index}`,
        duration,
      })),
    ];
    const seen = new Set<string>(),
      bills = new Set<string>();
    for (let day = 0; day < 80; day++) {
      const bill = cinemaProgram(day, library);
      expect(bill.films).toHaveLength(3);
      expect(new Set(bill.films.map((f) => f.id)).size).toBe(3);
      expect(cinemaProgram(day, [...library].reverse())).toEqual(bill);
      bill.films.forEach((f) => seen.add(f.id));
      bills.add(bill.films.map((f) => f.id).join(','));
      expect(bill.end - bill.start).toBe(
        bill.films.reduce((sum, film) => sum + film.duration, 0) + 24,
      );
      bill.slots.forEach((slot, index) => {
        if (index) expect(slot.start).toBe(bill.slots[index - 1].end);
        if (slot.kind !== 'film') expect(slot.end - slot.start).toBe(6);
      });
    }
    expect(seen.size).toBe(library.length);
    expect(bills.size).toBeGreaterThan(8);
    expect(cinemaProgram(0).end).toBe(
      1230 + 24 + cinemaProgram(0).films.reduce((sum, film) => sum + film.duration, 0),
    );
  });
  it('rotates the classics and the Starlight Reel together, three at a time', () => {
    expect(CINEMA_FILMS).toHaveLength(16);
    expect(CINEMA_FILMS.map((film) => film.artwork)).toEqual(
      expect.arrayContaining(['race', 'duel', 'ufo', 'orchestra', 'lanterns', 'mitten']),
    );
    const firstDay = townDayAt(Date.parse('2026-09-23T00:00:00Z'));
    const seen = new Set<string>(),
      selections = new Set<string>();
    for (let day = firstDay; day < firstDay + 90; day++) {
      const films = cinemaProgram(day).films;
      expect(new Set(films.map((film) => film.id)).size).toBe(3);
      films.forEach((film) => seen.add(film.id));
      selections.add(
        films
          .map((film) => film.id)
          .sort()
          .join(','),
      );
    }
    expect(seen.size).toBe(16);
    expect(selections.size).toBeGreaterThan(40);
  });
  it('fits any three films into the evening, so the screen is stowed before midnight', () => {
    // The disco, bedtimes, and the live director all assume the bill ends before 00:00.
    const longest = [...CINEMA_FILMS].sort((a, b) => b.duration - a.duration).slice(0, 3);
    const latest = cinemaProgram(0, longest);
    expect(latest.end + CINEMA_SCREEN_ROLL_SECONDS).toBeLessThanOrEqual(1440);
    for (const film of CINEMA_FILMS) expect(film.duration).toBeLessThanOrEqual(60);
  });
  it('shares the program and playback position across fresh instances, refreshes, and time zones', async () => {
    const utc = Date.parse('2026-09-23T00:20:37Z');
    const first = cinemaAt(townMinutesAt(utc), townDayAt(utc));
    expect(first.slot?.kind).toBe('film');
    vi.resetModules();
    const fresh = await import('../src/lib/cinema');
    for (const time of [
      utc,
      Date.parse('2026-09-23T03:20:37+03:00'),
      Date.parse('2026-09-22T17:20:37-07:00'),
    ]) {
      expect(fresh.cinemaAt(townMinutesAt(time), townDayAt(time))).toEqual(first);
    }
    const reloadedAt = utc + 1500;
    const reloaded = fresh.cinemaAt(townMinutesAt(reloadedAt), townDayAt(reloadedAt));
    expect(reloaded.program).toEqual(first.program);
    expect(reloaded.elapsed).toBeCloseTo(first.elapsed + 1.5);
    const nextNight = utc + TOWN_DAY_MS;
    expect(fresh.cinemaAt(townMinutesAt(nextNight), townDayAt(nextNight)).program).toEqual(
      cinemaProgram(first.program.day + 1),
    );
  });
  it('plays every film at its full duration and switches exactly at each card boundary', () => {
    for (let day = 0; day < 8; day++) {
      const bill = cinemaProgram(day);
      expect(cinemaAt(bill.start - 0.001, day).live).toBe(false);
      for (const slot of bill.slots) {
        expect(cinemaAt(slot.start, day).slot).toEqual(slot);
        expect(cinemaAt(slot.end - 0.001, day).slot).toEqual(slot);
        expect(cinemaAt(slot.start, day).elapsed).toBe(0);
        if (slot.film) expect(slot.end - slot.start).toBe(slot.film.duration);
      }
      expect(cinemaAt(bill.end, day).live).toBe(false);
      expect(cinemaAt(0, day + 1).program).toEqual(bill);
      expect(cinemaAt(1450, day)).toEqual(cinemaAt(10, day + 1));
    }
  });
  it('rejects invalid libraries and programs that cannot finish before morning', () => {
    expect(() => cinemaProgram(0, CINEMA_FILMS.slice(0, 2))).toThrow();
    expect(() => cinemaProgram(0, [...CINEMA_FILMS, CINEMA_FILMS[0]])).toThrow();
    for (const duration of [0, -1, NaN, Infinity, 600])
      expect(() =>
        cinemaProgram(
          0,
          CINEMA_FILMS.map((f) => ({ ...f, duration })),
        ),
      ).toThrow();
  });
  it('reserves all four empty plots, removes interior roads, and has twelve distinct lawn seats', () => {
    expect(CINEMA_PLOTS).toEqual(['D6', 'D7', 'E6', 'E7']);
    for (const plot of CINEMA_PLOTS) {
      expect(venueAt(plot)?.kind).toBe('cinema');
      expect(HOUSE_PLOTS.some((p) => p.id === plot)).toBe(false);
      expect(placeSchema.safeParse({ ...sample, plot }).success).toBe(false);
    }
    expect(isRoad(25, 17)).toBe(false);
    expect(isRoad(25, 21)).toBe(true);
    expect(new Set(CINEMA_SEATS.map((p) => JSON.stringify(p))).size).toBe(12);
    for (const seat of CINEMA_SEATS) expect(insideCinema(seat)).toBe(true);
  });
  it('walks a bounded audience continuously, then goes home or continues to the disco', () => {
    const day = 8,
      guests = cinemaGuests(crowd, day),
      event = cinemaEventForDay(day);
    expect(guests).toHaveLength(12);
    expect(cinemaGuests([...crowd].reverse(), day)).toEqual(guests);
    const at = (t: number) => simulateResidents(crowd, t % 1440, day + Math.floor(t / 1440));
    const seated = at(1300).filter((r) => r.event?.id === 'cinema');
    expect(seated).toHaveLength(12);
    expect(new Set(seated.map((r) => JSON.stringify(r.position))).size).toBe(12);
    for (const r of seated) {
      expect(r.moving).toBe(false);
      expect(r.pose).toBe('sit');
      expect(residentActivityLabel(r)).toContain('Watching a film');
    }
    for (const id of guests) {
      const trip = residentTrips(crowd, day)
        .get(id)!
        .find((p) => p.event.id === 'cinema')!;
      for (let t = trip.depart; t < trip.homeBy; t += 0.75) {
        const r = at(t).find((r) => r.id === id)!;
        expect(r.event?.id).toBe('cinema');
        expect(
          isRoad(Math.floor(r.position.x), Math.floor(r.position.y)) || insideCinema(r.position),
        ).toBe(true);
        expect(r.greeting).toBe(false);
      }
      for (const boundary of [
        trip.depart,
        trip.arrive,
        event.start,
        1320,
        trip.leave,
        1440,
        trip.homeBy,
      ]) {
        expect(
          distance(
            at(boundary - 0.001).find((r) => r.id === id)!.position,
            at(boundary + 0.001).find((r) => r.id === id)!.position,
          ),
        ).toBeLessThan(0.01);
      }
      const r = at(trip.homeBy + 0.001).find((r) => r.id === id)!;
      if (trip.continuesTo) {
        expect(r.event?.id).toBe('night-party');
        expect(distance(r.position, trip.route.at(-1)!)).toBeLessThan(0.01);
      } else {
        expect(r.activity).toBe(trip.homeBy >= nightBedtime(r.home) ? 'sleep' : 'stroll');
        expect(r.event).toBeUndefined();
        expect(r.position).toEqual(plotEntrance(getPlot(r.home.plot)!));
      }
    }
    const sleepers = crowd.map((p) => ({
      ...p,
      resident: { ...p.resident, routine: { ...p.resident.routine, night: 'sleep' as const } },
    }));
    expect(cinemaGuests(sleepers, day)).toEqual([]);
    expect(eventMinutes(event, 0)).toBe(1440);
  });
  it('makes the screen and the whole lawn selectable and frames them on wide and narrow screens', () => {
    const point = {
      x: SCREEN_ORIGIN.x + 160 * SCREEN_SCALE,
      y: SCREEN_ORIGIN.y - 150 + 80 * SCREEN_SCALE + 90 * SCREEN_SCALE,
    };
    expect(cinemaScreenHit(point)).toBe(true);
    expect(cityHit(point, [], [])).toEqual({ kind: 'place', id: 'D6' });
    expect(cityHit(project(26, 19), [], [])).toEqual({ kind: 'place', id: 'D6' });
    const day = Array.from({ length: 30 }, (_, i) => i).find((day) =>
      liveHighlights(day).includes('cinema'),
    )!;
    const program = liveProgram([], day),
      shot = liveShotAt(program, 1300, []);
    expect(shot.id).toBe(`event:${day}:cinema`);
    expect(shot.width).toBe(CINEMA_FRAME.width);
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      const camera = liveCamera(shot, width, height, 1300);
      const x = point.x * camera.zoom + camera.x,
        y = point.y * camera.zoom + camera.y;
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(width);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(height);
    }
  });
});
