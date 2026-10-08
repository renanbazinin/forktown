// Snowmen on the Lunch Green (agent E, SPEC §4.6): the builders and the watchers, the snowmen
// themselves from their first snowball to the carrot left on the grass, and the green's panel line.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  builtDay,
  GREEN_CENTER,
  HEADLESS,
  scarfOf,
  SCARVES,
  SNOWMAN_RADII,
  SNOWMAN_SPOTS,
  snowmanShape,
} from '../src/city/district/snowmen';
import GreenNote from '../src/components/district/GreenNote';
import { SNOWMAN_DAYS, SNOWMAN_STAGES, snowmanState } from '../src/lib/district-calendar';
import { EVENT_SPOTS } from '../src/lib/events';
import {
  builderSpells,
  snowmenBuilderPose,
  snowmenStanding,
  snowmenWatcherPose,
  WATCHER_CHEERS,
} from '../src/lib/outings/snowmen';
import { residentTrips, tripState } from '../src/lib/resident-trips';
import { CALENDAR_EPOCH_DAY, townCalendarAt } from '../src/lib/town-calendar';
import { TOWNS, YEAR } from './district';

const BUILD_DAYS = SNOWMAN_DAYS.map((d) => CALENDAR_EPOCH_DAY + d);
const label = (day: number) => {
  const { season, date } = townCalendarAt(day);
  return `${season} ${date}`;
};
const dayOf = (name: string) => YEAR.find((day) => label(day) === name)!;
/** The runs of one pose in a list of samples. */
function runs(samples: { time: number; pose: string | undefined }[]) {
  const out: { pose: string | undefined; from: number; to: number }[] = [];
  for (const { time, pose } of samples) {
    const last = out.at(-1);
    if (last && last.pose === pose) last.to = time;
    else out.push({ pose, from: time, to: time });
  }
  return out;
}

describe('The builders and the watchers', () => {
  it('builds at seats 0 and 1: on the knees and up packing snow, turn about, 14:00–15:45', () => {
    for (const day of [...BUILD_DAYS, BUILD_DAYS[0] + 112])
      for (const seat of [0, 1]) {
        const spells = builderSpells(seat, day);
        expect(spells[0]).toMatchObject({ from: SNOWMAN_STAGES.base, pose: 'crouch' });
        expect(spells.at(-1)).toMatchObject({ to: SNOWMAN_STAGES.dressed, pose: 'crouch' });
        for (const [i, spell] of spells.entries()) {
          expect(spell.to - spell.from).toBeGreaterThanOrEqual(1);
          if (i) expect(spell.pose).not.toBe(spells[i - 1].pose);
          if (i) expect(spell.from).toBe(spells[i - 1].to);
        }
        expect(spells.some((spell) => spell.pose === 'play')).toBe(true);
        // Sat on the blanket the rest of the lunch.
        expect(snowmenBuilderPose(seat, SNOWMAN_STAGES.base - 0.01, day)).toBe('sit');
        expect(snowmenBuilderPose(seat, SNOWMAN_STAGES.dressed, day)).toBe('sit');
        for (let time = SNOWMAN_STAGES.base; time < SNOWMAN_STAGES.dressed; time += 0.25)
          expect(['crouch', 'play']).toContain(snowmenBuilderPose(seat, time, day));
      }
    // The two builders keep their own time.
    expect(builderSpells(0, BUILD_DAYS[0])).not.toEqual(builderSpells(1, BUILD_DAYS[0]));
    for (const seat of [2, 3, 4, 5, -1, 6])
      expect(snowmenBuilderPose(seat, 900, BUILD_DAYS[0])).toBeUndefined();
  });

  it('watches from seats 2–5: sat, chatting, and up on their feet as the head and the carrot go on', () => {
    for (const day of BUILD_DAYS)
      for (const seat of [2, 3, 4, 5]) {
        const samples = [];
        for (let time = 830; time < 960; time += 0.05)
          samples.push({ time, pose: snowmenWatcherPose(seat, time, day) });
        for (const { pose } of samples) expect(['sit', 'chat', 'cheer']).toContain(pose);
        const all = runs(samples);
        for (const run of all.slice(0, -1))
          expect(
            run.to - run.from + 0.05,
            `${seat} ${run.pose} at ${run.from}`,
          ).toBeGreaterThanOrEqual(1);
        for (const cheer of WATCHER_CHEERS)
          expect(snowmenWatcherPose(seat, cheer.from + 0.5, day)).toBe('cheer');
        expect(snowmenWatcherPose(seat, SNOWMAN_STAGES.base - 0.01, day)).toBe('sit');
        expect(snowmenWatcherPose(seat, 960, day)).toBe('sit');
      }
    for (const seat of [0, 1, 6])
      expect(snowmenWatcherPose(seat, 900, BUILD_DAYS[0])).toBeUndefined();
  });

  it('gives every lunch guest on a build day poses held a minute at least, in the full town', () => {
    let builders = 0;
    for (const day of BUILD_DAYS) {
      const plans = residentTrips(TOWNS.full, day);
      for (const [id, trips] of plans)
        for (const trip of trips) {
          if (trip.event.variant !== 'snowmen') continue;
          const home = TOWNS.full.find((place) => place.id === id)!;
          const samples = [];
          for (let time = 830; time < trip.leave; time += 0.05) {
            const state = tripState(home, trip, time, day);
            if (state.event?.phase === 'attending') samples.push({ time, pose: state.pose });
          }
          const all = runs(samples);
          for (const run of all.slice(1, -1))
            expect(
              run.to - run.from + 0.05,
              `${label(day)} seat ${trip.seat} ${run.pose} at ${run.from.toFixed(2)}`,
            ).toBeGreaterThanOrEqual(1);
          if (trip.seat < 2 && samples.some((s) => s.pose === 'play')) builders++;
          // A builder goes from sitting to building and back by way of the crouch.
          if (trip.seat < 2)
            for (let i = 1; i < all.length; i++)
              if (all[i].pose === 'play') expect(all[i - 1].pose).toBe('crouch');
        }
    }
    expect(builders).toBeGreaterThanOrEqual(BUILD_DAYS.length);
  });
});

describe('A snowman', () => {
  it('stands on the back lawn, clear of the blankets, the lane and the stepping stones', () => {
    for (const spot of SNOWMAN_SPOTS) {
      for (const seat of EVENT_SPOTS.green)
        expect(Math.hypot(spot.x - seat.x, spot.y - seat.y)).toBeGreaterThanOrEqual(0.85);
      expect(Math.abs(spot.x - -1.35)).toBeGreaterThanOrEqual(0.75);
      const stones = Math.hypot(spot.x, spot.y - Math.max(0.5, Math.min(1.6, spot.y)));
      expect(stones).toBeGreaterThanOrEqual(0.3);
      expect(Math.abs(spot.x)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(spot.y)).toBeLessThanOrEqual(1.5);
    }
    expect(GREEN_CENTER).toEqual({ x: 19.5, y: 11.5 });
  });

  it('is rolled up ball by ball on its build day, and dressed at 15:45', () => {
    for (const [k, day] of BUILD_DAYS.entries()) {
      expect(snowmanShape(k, day, SNOWMAN_STAGES.base - 1)).toBeUndefined();
      let before = 0;
      for (let minute = SNOWMAN_STAGES.base; minute < SNOWMAN_STAGES.dressed; minute += 0.5) {
        const shape = snowmanShape(k, day, minute)!;
        expect(shape.face).toBeUndefined();
        expect(shape.scarf).toBeUndefined();
        const balls = snowmanState(k, day, minute)!.stage;
        expect(shape.balls).toHaveLength(balls);
        // Only ever growing, a little at a time.
        const size = shape.balls.reduce((sum, ball) => sum + ball.rx, 0);
        expect(size).toBeGreaterThanOrEqual(before - 1e-9);
        expect(size - before).toBeLessThanOrEqual(SNOWMAN_RADII[0] * 0.7 + 1e-9);
        before = size;
      }
      const dressed = snowmanShape(k, day, SNOWMAN_STAGES.dressed)!;
      expect(dressed.balls.map((ball) => ball.rx)).toEqual([...SNOWMAN_RADII]);
      expect(dressed.face).toBeDefined();
      expect(dressed.scarf).toBeDefined();
    }
  });

  it('is about 22 px tall: balls of 10, 8 and 6, never over 22', () => {
    const shape = snowmanShape(0, BUILD_DAYS[3], 720)!;
    const top = Math.min(...shape.balls.map((ball) => ball.y - ball.ry));
    const bottom = Math.max(...shape.balls.map((ball) => ball.y + ball.ry));
    expect(-top).toBeGreaterThanOrEqual(20);
    expect(-top).toBeLessThanOrEqual(22);
    expect(bottom).toBeLessThanOrEqual(0.5);
    for (let k = 0; k < 4; k++)
      for (let day = BUILD_DAYS[0]; day < BUILD_DAYS[0] + 30; day++)
        for (let minute = 0; minute < 1440; minute += 60) {
          const s = snowmanShape(k, day, minute);
          if (s) for (const ball of s.balls) expect(ball.y - ball.ry).toBeGreaterThanOrEqual(-22);
        }
  });

  it('leans, shrinks to 40% and loses its head at 0.7; then a carrot and a scarf lie on the grass', () => {
    for (let k = 0; k < 4; k++) {
      let shrank = false,
        headless = false,
        leftovers = false;
      for (let t = BUILD_DAYS[3] + 1; t < BUILD_DAYS[0] + 26; t += 1 / 48) {
        const day = Math.floor(t),
          minute = (t - day) * 1440;
        const state = snowmanState(k, day, minute);
        const shape = snowmanShape(k, day, minute);
        expect(!!shape).toBe(!!state);
        if (!state || !shape) continue;
        const base = shape.balls[0];
        if (state.melt >= 1) {
          leftovers = true;
          expect(shape.balls).toHaveLength(0);
          expect(shape.dropped).toEqual({ carrot: true, scarf: true });
          continue;
        }
        expect(base.rx).toBeCloseTo(SNOWMAN_RADII[0] * (1 - 0.6 * state.melt), 6);
        if (state.melt > 0.5) shrank = true;
        expect(shape.balls.length === 3).toBe(state.melt < HEADLESS);
        if (state.melt >= HEADLESS) {
          headless = true;
          expect(shape.face).toBeUndefined();
          expect(shape.dropped.carrot).toBe(true);
          // Leaning over: its body is off its base, to one side.
          expect(Math.abs(shape.balls[1].x)).toBeGreaterThan(1);
        }
      }
      expect([shrank, headless, leftovers]).toEqual([true, true, true]);
    }
  });

  it('is gone by the end of Winter 27, so every spring starts clear', () => {
    for (const year of [0, 1, 2])
      for (let k = 0; k < 4; k++) {
        const spring = CALENDAR_EPOCH_DAY + 112 * (year + 1);
        for (let minute = 0; minute < 1440; minute += 30) {
          expect(snowmanShape(k, spring - 1, minute)).toBeUndefined();
          expect(snowmanShape(k, spring, minute)).toBeUndefined();
        }
      }
  });

  it('wears a muted wool scarf from its own build day, never amber, and no two alike', () => {
    for (const year of [0, 1, 2, 3, 4, 5]) {
      const day = BUILD_DAYS[0] + 112 * year;
      const worn = [0, 1, 2, 3].map((k) => scarfOf(k, day));
      expect(new Set(worn.map((pair) => pair[0])).size).toBe(4);
      expect(builtDay(2, day)).toBe(BUILD_DAYS[2] + 112 * year);
    }
    for (const pair of SCARVES)
      for (const colour of pair) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));
        // Muted: no channel near full, and not the warm yellow of lamplight.
        expect(Math.max(r, g, b)).toBeLessThan(0xc0);
        expect(r >= 0xe0 && g >= 0xb0 && b <= 0xb8).toBe(false);
      }
  });
});

describe('The green’s panel line', () => {
  it('counts the snowmen standing, and says nothing when none do', () => {
    const at = (name: string, minute: number) => snowmenStanding(dayOf(name), minute);
    expect(at('Winter 2', 720)).toBe(0);
    expect(at('Winter 3', 900)).toBe(0);
    expect(at('Winter 3', 946)).toBe(1);
    expect(at('Winter 8', 720)).toBe(2);
    expect(at('Winter 16', 720)).toBe(4);
    expect(at('Winter 28', 720)).toBe(0);
    expect(at('Spring 3', 720)).toBe(0);
    const html = (name: string, minutes: number) =>
      renderToStaticMarkup(createElement(GreenNote, { day: dayOf(name), minutes }));
    expect(html('Winter 16', 720)).toBe(
      '<p class="muted-copy">Snowmen on the green: 4. They stay until the thaw.</p>',
    );
    expect(html('Winter 3', 946)).toContain('Snowmen on the green: 1.');
    expect(html('Winter 2', 720)).toBe('');
    expect(html('Summer 9', 720)).toBe('');
  });
});
