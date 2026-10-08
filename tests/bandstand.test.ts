// Bandstand Evenings (SPEC §4.2), agent C: how the listeners sit, sip and applaud; when the
// players and the deckchairs are out; the panel's words; and the three bands' arrangements.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { chairOut, playersAt, PLAYERS } from '../src/city/district/bandstand';
import { BANDSTAND_NOTE, drawResident } from '../src/city/residents';
import { pick } from '../src/city/season-palette';
import BandstandInfo, { bandstandNow, listening } from '../src/components/district/BandstandInfo';
import { nextStarNight } from '../src/components/district/StargazingNote';
import {
  bandOf,
  BANDS,
  nextOutingDay,
  OUTING_TIMES,
  starNight,
} from '../src/lib/district-calendar';
import { BAND_COPY, PANEL_COPY } from '../src/lib/district-copy';
import { BANDSTAND_FURNITURE } from '../src/lib/district-places';
import { CHEER_WINDOW, HOLD, SETTLE } from '../src/lib/outings/bandstand';
import { residentTrips, tripState, type ResidentTrip } from '../src/lib/resident-trips';
import { DEFAULT_RESIDENT, type Place } from '../src/lib/schema';
import { simulateResidents } from '../src/lib/simulation';
import { townCalendarAt } from '../src/lib/town-calendar';
import { BANDSTAND_TRACKS, composeBandstand } from '../src/music/bandstand-tracks';
import { BEATS, compose, durationOf } from '../src/music/score';
import { TOWNS, YEAR } from './district';
import { recordingContext } from './recording-context';
import { rosterTimeout } from './roster-timeout';

const FRAME = 1 / 30;
/** Every Bandstand visit of a town over some days, with its home. */
function visits(town: Place[], days: readonly number[]) {
  const homes = new Map(town.map((place) => [place.id, place]));
  return days.flatMap((day) =>
    [...residentTrips(town, day)].flatMap(([id, trips]) =>
      trips
        .filter((trip) => trip.event.outing?.startsWith('bandstand'))
        .map((trip) => ({ home: homes.get(id)!, trip, day })),
    ),
  );
}
const poseOf = (home: Place, trip: ResidentTrip, time: number, day: number) =>
  tripState(home, trip, time, day).pose;
/** A sample of days across the year: each season's start, middle and end. */
const SAMPLE = YEAR.filter((_, i) => i % 9 === 4);

describe('Listeners at the Bandstand', () => {
  it(
    'perch, take tea or a drink, and applaud only in a set’s last five minutes',
    () => {
      let seen = 0,
        cheers = 0;
      const kinds = new Set<string>();
      for (const [town, days] of [
        [TOWNS.full, SAMPLE],
        [TOWNS.real, YEAR],
      ] as const)
        for (const { home, trip, day } of visits(town, days)) {
          const sundown = trip.event.outing === 'bandstand-sundown';
          const allowed = sundown
            ? ['sit', 'crouch', 'perch', 'sip', 'cheer', undefined]
            : ['sit', 'crouch', 'perch', 'tea', 'cheer', undefined];
          for (let t = trip.arrive; t < trip.leave; t += FRAME) {
            const pose = poseOf(home, trip, t, day);
            kinds.add(String(pose));
            expect(allowed, `${home.id} at ${t.toFixed(2)}`).toContain(pose);
            if (pose === 'cheer') {
              expect(t).toBeGreaterThanOrEqual(trip.event.end - CHEER_WINDOW - 1e-9);
              expect(t).toBeLessThan(trip.event.end);
              cheers++;
            }
          }
          seen++;
        }
      expect(seen).toBeGreaterThan(100);
      expect(cheers).toBeGreaterThan(0);
      for (const pose of ['perch', 'tea', 'sip', 'cheer', 'crouch']) expect(kinds).toContain(pose);
    },
    rosterTimeout(0.5, 120_000),
  );

  it(
    'holds every pose a minute at least, and is halfway down only to sit or to rise',
    () => {
      let runs = 0;
      for (const { home, trip, day } of visits(TOWNS.full, SAMPLE)) {
        let pose: string | undefined = 'start',
          since = trip.arrive;
        const close = (t: number) => {
          const length = t - since;
          if (pose === 'crouch') expect(length, `${home.id} crouch`).toBeLessThan(SETTLE + 0.1);
          // Poses cut by arriving or leaving are the planner's settle; the rest are held.
          // A frame apart, a pose held a minute spans 30 samples (29 at a float edge).
          else if (since > trip.arrive + SETTLE && t < trip.leave - SETTLE && pose !== undefined)
            expect(length, `${home.id} ${pose} at ${since.toFixed(2)}`).toBeGreaterThan(
              HOLD - 1.5 * FRAME,
            );
          runs++;
        };
        // Sampled by index from the arrival, so the step never drifts.
        for (let i = 0, t = trip.arrive; t < trip.leave; t = trip.arrive + ++i * FRAME) {
          const now = poseOf(home, trip, t, day);
          if (now === pose) continue;
          if (pose !== 'start') close(t);
          pose = now;
          since = t;
        }
      }
      expect(runs).toBeGreaterThan(200);
    },
    rosterTimeout(0.5, 120_000),
  );

  it('sit up halfway when the band strikes up, never in a single frame', () => {
    let waited = 0;
    for (const { home, trip, day } of visits(TOWNS.full, SAMPLE)) {
      const start = trip.event.start;
      if (trip.arrive + SETTLE + HOLD > start || trip.leave < start + 3) continue;
      expect(poseOf(home, trip, start - FRAME, day)).toBe('sit');
      expect(poseOf(home, trip, start + FRAME, day)).toBe('crouch');
      expect(poseOf(home, trip, start + SETTLE + FRAME, day)).toBe('perch');
      waited++;
    }
    expect(waited).toBeGreaterThan(20);
  });
});

describe('The Bandstand’s scenery', () => {
  it('has every deckchair out for every listener’s whole visit, all year', () => {
    const { from, to } = BANDSTAND_FURNITURE.chairs;
    let checked = 0;
    for (const { trip } of visits(TOWNS.full, YEAR)) {
      expect(trip.arrive).toBeGreaterThanOrEqual(from);
      expect(trip.leave).toBeLessThanOrEqual(to);
      expect(chairOut(trip.seat, trip.arrive)).toBe(1);
      expect(chairOut(trip.seat, trip.leave)).toBe(1);
      checked++;
    }
    expect(checked).toBeGreaterThan(112 * 8);
  });

  it('brings the players in at 15:45, gives them tea on the steps, and sees them gone by 20:15', () => {
    expect(playersAt(944.9)).toBeUndefined();
    expect(playersAt(PLAYERS.in + 0.75)!.alpha).toBeGreaterThan(0);
    expect(playersAt(950)!.playing).toBe(false);
    const tea = OUTING_TIMES['bandstand-tea'],
      sundown = OUTING_TIMES['bandstand-sundown'];
    for (let minutes = tea.start; minutes < tea.end; minutes += 5)
      expect(playersAt(minutes)).toMatchObject({ playing: true, tea: 0, alpha: 1 });
    expect(playersAt(1070)).toMatchObject({ playing: false, tea: 1 });
    for (let minutes = sundown.start; minutes < sundown.end; minutes += 5)
      expect(playersAt(minutes)).toMatchObject({ playing: true, tea: 0 });
    expect(playersAt(1205)!.playing).toBe(false);
    expect(playersAt(PLAYERS.gone)).toBeUndefined();
    expect(PLAYERS.gone).toBeLessThanOrEqual(1215);
  });
});

describe('The applause', () => {
  it('raises the stand’s own notes, olive by day and pale at night, never the stage’s gold', () => {
    /** The fills of a cheering listener over the stretch of its beat that shows a note. */
    const cheer = (id: string, night: boolean) => {
      const { ctx, calls } = recordingContext();
      for (let walkPhase = 0; walkPhase < 0.3; walkPhase += 0.05)
        drawResident(
          ctx,
          DEFAULT_RESIDENT,
          0,
          0,
          1,
          {
            moving: false,
            facing: 'ne',
            walkPhase,
            greeting: false,
            pose: 'cheer',
            event: { id, name: 'Anything', phase: 'attending' },
          },
          { night },
        );
      return calls.filter((call) => call.name === 'fillRect').map((call) => call.fillStyle);
    };
    for (const id of ['bandstand-tea', 'bandstand-sundown'])
      for (const night of [false, true]) {
        const fills = cheer(id, night);
        expect(fills).toContain(pick(BANDSTAND_NOTE, night));
        expect(fills).not.toContain('#E0B768');
      }
    // The stand's players play in the same colour.
    expect(BANDSTAND_NOTE).toEqual(['#5F7155', '#C9D2C2']);
  });
});

describe('The Bandstand’s panel', () => {
  const render = (day: number, minutes: number, town: Place[] = TOWNS.full) =>
    renderToStaticMarkup(
      createElement(BandstandInfo, {
        day,
        minutes,
        residents: simulateResidents(town, minutes, day),
        places: town,
        onFollow: () => {},
      }),
    );
  const plain = YEAR.find((day) => !starNight(day) && bandOf(day) === 'folk')!;

  it('names tonight’s band, the sets and the deckchairs, in the town’s voice', () => {
    const html = render(plain, 700);
    expect(html).toContain(PANEL_COPY.bandstand.eyebrow);
    expect(html).toContain(PANEL_COPY.bandstand.heading);
    expect(html).toContain(BAND_COPY.folk.name);
    expect(html).toContain(PANEL_COPY.bandstand.sets);
    expect(html).toContain(PANEL_COPY.bandstand.chairs);
    for (let minutes = 0; minutes < 1440; minutes += 5) {
      const now = bandstandNow(minutes);
      if (!now) continue;
      // An eyebrow is uppercase Space Mono, as every eyebrow (BRAND.md).
      expect(now.eyebrow).toMatch(/^[A-Z0-9 ·/’&–-]+$/);
      expect(now.line).not.toMatch(/!/);
      for (const sentence of now.line.split('. ')) expect(sentence.length).toBeGreaterThan(8);
      expect(now.line.endsWith('.')).toBe(true);
    }
    expect(bandstandNow(980)!.line).toBe('The teatime set is playing.');
    expect(bandstandNow(1070)!.line).toContain('Tea on the steps');
    expect(bandstandNow(700)).toBeUndefined();
  });

  it('names the neighbors in the deckchairs only while they are there', () => {
    const residents = simulateResidents(TOWNS.full, 1000, plain);
    const here = listening(residents);
    expect(here.length).toBeGreaterThan(0);
    const html = render(plain, 1000);
    for (const resident of here) expect(html).toContain(resident.resident.name);
    // Before the chairs are out, nobody is named.
    const morning = render(plain, 600);
    for (const resident of here) expect(morning).not.toContain(resident.resident.name);
  });

  it('holds the stargazing note on a new-moon night', () => {
    const night = YEAR.find((day) => starNight(day))!;
    expect(render(night, 1360)).toContain(PANEL_COPY.stars.heading);
    expect(render(plain, 1360)).not.toContain(PANEL_COPY.stars.heading);
  });

  it('says when the stars come out next on any other night, and only then', () => {
    // A plain night two or more before a star night: the line names its date.
    const quiet = YEAR.find((day) => !starNight(day) && !starNight(day + 1))!;
    const next = townCalendarAt(nextOutingDay('stargazing', quiet + 1)!);
    const html = render(quiet, 1360);
    expect(nextStarNight(quiet, 1360)).toBe(`on ${next.season} ${next.date}`);
    expect(html).toContain(PANEL_COPY.stars.next(`on ${next.season} ${next.date}`));
    expect(html).not.toContain(PANEL_COPY.stars.heading);
    // At 01:00 on a date 27 the evening is still the 26th's, a plain one: tonight is the night.
    const first = YEAR.find((day) => starNight(day) && !starNight(day - 1))!;
    expect(townCalendarAt(first).date).toBe(27);
    expect(render(first, 60)).toContain(PANEL_COPY.stars.next('tonight'));
    // On a star night the note itself says it.
    expect(render(first, 1360)).not.toContain(PANEL_COPY.stars.next('tonight'));
  });

  it('asks the visitor to zoom in for the band only while a set plays', () => {
    expect(render(plain, 980)).toContain(PANEL_COPY.bandstand.listen);
    expect(render(plain, 1140)).toContain(PANEL_COPY.bandstand.listen);
    expect(render(plain, 1070)).not.toContain(PANEL_COPY.bandstand.listen);
    expect(render(plain, 700)).not.toContain(PANEL_COPY.bandstand.listen);
  });
});

describe('The bands’ arrangements', () => {
  it('give each band a tune of its own, in the town’s form and voices', () => {
    const acoustic = compose('acoustic');
    for (const band of BANDS) {
      const notes = composeBandstand(band)!;
      expect(notes).toEqual(compose(band));
      expect(notes).not.toEqual(acoustic);
      expect(notes.length).toBeGreaterThan(150);
      expect(Math.max(...notes.map((note) => note.beat))).toBeLessThan(BEATS);
      expect(durationOf(band)).toBeCloseTo((BEATS * 60) / BANDSTAND_TRACKS[band].bpm);
      for (const note of notes) {
        expect(note.gain).toBeLessThanOrEqual(0.2);
        expect(note.pitch).toBeGreaterThanOrEqual(28);
        expect(note.pitch).toBeLessThanOrEqual(90);
      }
      expect(BANDSTAND_TRACKS[band].title).not.toBe(BAND_COPY[band].name);
    }
    // Brass marches with a drum, folk taps a foot, and the strings play without one.
    const voices = (band: (typeof BANDS)[number]) =>
      new Set(composeBandstand(band)!.map((note) => note.voice));
    expect(voices('brass')).toContain('kick');
    expect(voices('brass')).toContain('snare');
    expect(voices('folk')).toContain('pluck');
    expect(voices('strings').has('kick')).toBe(false);
    expect(voices('strings')).toContain('pad');
  });
});
