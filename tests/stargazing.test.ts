// Stargazing by the river (agent E, SPEC §4.4): the stargazers' poses, the astronomer's night, the
// summer meteors (never a flash) and the note in the Bandstand's panel.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ASTRONOMER,
  ASTRONOMER_HOURS,
  astronomerAt,
  RAISED_NEAR_ARM,
  rugOut,
  RUG,
  SIDE_ARM,
  SIDE_HAND,
  TELESCOPE,
} from '../src/city/district/stargazing';
import { drawResident } from '../src/city/residents';
import { project } from '../src/lib/world';
import {
  drawSkyExtras,
  METEOR_COLOUR,
  METEOR_FLOOR,
  METEOR_LENGTH,
  METEOR_MINUTES,
  meteorNight,
  meteorsOf,
  meteorSteps,
} from '../src/city/sky-extras';
import StargazingNote, {
  rugsLine,
  stargazingLines,
} from '../src/components/district/StargazingNote';
import BandstandInfo from '../src/components/district/BandstandInfo';
import { OUTING_TIMES, starNight } from '../src/lib/district-calendar';
import { BANDSTAND_FURNITURE, DISTRICT_SPOTS } from '../src/lib/district-places';
import { STAR_HOLD, STAR_SETTLE, starPose } from '../src/lib/outings/stargazing';
import { residentTrips, tripState, type ResidentTrip } from '../src/lib/resident-trips';
import type { ResidentState } from '../src/lib/simulation';
import { townCalendarAt } from '../src/lib/town-calendar';
import { TOWNS, YEAR } from './district';
import { recordingContext } from './recording-context';

const STAR_NIGHTS = YEAR.filter(starNight);
const label = (day: number) => {
  const { season, date } = townCalendarAt(day);
  return `${season} ${date}`;
};
const dayOf = (name: string) => YEAR.find((day) => label(day) === name)!;
const SUMMER_27 = dayOf('Summer 27');
/** Every pose change in a run of samples, as [from, to, minute]. */
function runs(samples: { time: number; pose: string | undefined }[]) {
  const out: { pose: string | undefined; from: number; to: number }[] = [];
  for (const { time, pose } of samples) {
    const last = out.at(-1);
    if (last && last.pose === pose) last.to = time;
    else out.push({ pose, from: time, to: time });
  }
  return out;
}

describe('A stargazer on their rug', () => {
  // The full town on four star nights: every stargazer's whole visit, every 0.05 minutes.
  const nights = [SUMMER_27, dayOf('Autumn 1'), dayOf('Winter 1'), dayOf('Spring 28')];
  const visits: { home: (typeof TOWNS.full)[number]; trip: ResidentTrip; day: number }[] = [];
  for (const day of nights) {
    const plans = residentTrips(TOWNS.full, day);
    for (const [id, trips] of plans)
      for (const trip of trips)
        if (trip.event.outing === 'stargazing')
          visits.push({ home: TOWNS.full.find((place) => place.id === id)!, trip, day });
  }

  it('sits, and chats now and then, holding every pose a minute at least', () => {
    expect(visits.length).toBeGreaterThanOrEqual(nights.length * 4);
    let chats = 0;
    for (const { home, trip, day } of visits) {
      const samples: { time: number; pose: string | undefined }[] = [];
      for (let time = trip.event.start; time < trip.leave; time += 0.05) {
        const state = tripState(home, trip, time, day);
        if (state.event?.phase === 'attending') samples.push({ time, pose: state.pose });
      }
      const all = runs(samples);
      for (const run of all) {
        expect(['sit', 'chat', 'crouch']).toContain(run.pose);
        if (run.pose === 'chat') chats++;
      }
      // Between settling and getting up, no pose lasts under a minute.
      for (const run of all.slice(1, -1))
        expect(
          run.to - run.from + 0.05,
          `${home.id} ${run.pose} at ${run.from}`,
        ).toBeGreaterThanOrEqual(STAR_HOLD - 1e-9);
      // The first minute after settling and the last before getting up are a plain sit.
      const from = Math.max(trip.arrive, trip.event.start) + STAR_SETTLE;
      const to = trip.leave - STAR_SETTLE;
      for (const { time, pose } of samples)
        if ((time >= from && time < from + STAR_HOLD) || (time >= to - STAR_HOLD && time < to))
          expect(pose, `${home.id} at ${time}`).toBe('sit');
    }
    expect(chats).toBeGreaterThan(0);
  });

  it('faces the stand, never lies down, and asks nothing of the planner it may not read', () => {
    for (const { trip } of visits.slice(0, 10)) expect(trip.facing).toBe('ne');
    const context = {
      home: visits[0].home,
      trip: visits[0].trip,
      day: SUMMER_27,
      seat: 0,
      arrive: 1300,
      leave: 1470,
    };
    for (let time = 1300; time < 1470; time += 0.5)
      expect(['sit', 'chat']).toContain(starPose({ ...context, time }));
  });
});

describe('The rugs and the telescope', () => {
  it('unroll from 21:50, are flat for the whole outing, and roll up by 00:35', () => {
    const { from, to } = BANDSTAND_FURNITURE.rugs;
    for (let k = 0; k < 8; k++) {
      expect(rugOut(k, from - 0.01)).toBe(0);
      expect(rugOut(k, to)).toBe(0);
      // Out before the first guest can arrive (21:56.4) and until the last has gone (00:29.6).
      for (let t = 1316; t <= 1470; t += 0.5) expect(rugOut(k, t), `rug ${k} at ${t}`).toBe(1);
      // Unrolling takes a minute and a half, never a frame.
      let before = 0;
      for (let t = from; t < from + 6; t += 1 / 30) {
        const out = rugOut(k, t);
        expect(out - before).toBeLessThanOrEqual(1 / 30 / 1.5 + 1e-9);
        before = out;
      }
    }
  });

  it('lie on the eight spots, and the telescope stands clear of the rugs and the ways in', () => {
    const spots = DISTRICT_SPOTS.bandstand;
    // Neighbouring rugs never touch.
    for (const a of spots)
      for (const b of spots)
        if (a !== b)
          expect(
            Math.abs(a.x - b.x) >= RUG.x || Math.abs(a.y - b.y) >= RUG.y,
            `${a.x},${a.y} and ${b.x},${b.y}`,
          ).toBe(true);
    // On the plot (x 58–61), on the lawn's river side, a tile from the nearest rug.
    expect(TELESCOPE.x).toBeLessThan(61);
    expect(TELESCOPE.x).toBeGreaterThan(60.5);
    for (const s of spots)
      expect(Math.hypot(s.x - TELESCOPE.x, s.y - TELESCOPE.y)).toBeGreaterThanOrEqual(1.1);
  });
});

describe('The astronomer', () => {
  it('is there 22:00–00:30, walking in from the road and off again, never in a jump', () => {
    for (const night of [SUMMER_27, dayOf('Winter 1')]) {
      const at = (evening: number) =>
        astronomerAt(evening >= 1440 ? night + 1 : night, evening % 1440);
      expect(at(ASTRONOMER_HOURS.from - 3)).toBeUndefined();
      expect(at(ASTRONOMER_HOURS.to + 3)).toBeUndefined();
      let before: ReturnType<typeof astronomerAt>;
      let stance: string | undefined,
        since = 0;
      for (let evening = 1310; evening < 1480; evening += 1 / 30) {
        const now = at(evening);
        if (evening >= ASTRONOMER_HOURS.from && evening < ASTRONOMER_HOURS.to)
          expect(now, `${evening}`).toBeDefined();
        if (now && before) {
          // At a stroll at most: 0.32 tiles a minute.
          const moved = Math.hypot(now.at.x - before.at.x, now.at.y - before.at.y);
          expect(moved, `${evening}`).toBeLessThanOrEqual((0.32 / 30) * 1.01 + 1e-9);
          expect(Math.abs(now.alpha - before.alpha)).toBeLessThanOrEqual(0.08 + 1e-9);
        }
        if (!before && now) expect(now.alpha).toBeLessThanOrEqual(0.08 + 1e-9);
        if (before && !now) expect(before.alpha).toBeLessThanOrEqual(0.08 + 1e-9);
        // Each stance is held a minute at least.
        if (now?.pose !== stance) {
          if (stance === 'peer' || stance === 'point')
            expect(evening - since, `${stance} at ${since}`).toBeGreaterThanOrEqual(1);
          stance = now?.pose;
          since = evening;
        }
        // Never on a rug, and never east of the riverside road.
        if (now) {
          for (const s of DISTRICT_SPOTS.bandstand)
            expect(
              Math.abs(now.at.x - s.x) > RUG.x / 2 || Math.abs(now.at.y - s.y) > RUG.y / 2,
            ).toBe(true);
          expect(now.at.x).toBeLessThan(62);
        }
        before = now;
      }
    }
  });

  it('points with one arm raised and one at the side, the hand clear of the telescope', () => {
    // The town's own figure, standing and cheering (arms still at the top, walk phase 0.5): the
    // rectangles that differ are the arms. Pointing clips the cheer's raised near arm away and
    // hangs the standing near arm at the side, so the figure keeps two hands.
    const rects = (pose?: 'cheer') => {
      const { ctx, calls } = recordingContext(200, 200);
      drawResident(ctx, ASTRONOMER, 0, 0, 1, {
        moving: false,
        facing: 'se',
        walkPhase: 0.5,
        greeting: false,
        ...(pose ? { pose } : {}),
      });
      return calls
        .filter((call) => call.name === 'fillRect')
        .map((call) => (call.args as number[]).join(','));
    };
    const standing = rects(),
      cheering = rects('cheer');
    const raised = cheering
      .filter((r) => !standing.includes(r))
      .map((r) => r.split(',').map(Number));
    const lowered = standing
      .filter((r) => !cheering.includes(r))
      .map((r) => r.split(',').map(Number));
    const inHoles = (x: number, y: number) =>
      RAISED_NEAR_ARM.some((h) => x > h.x && x < h.x + h.w && y > h.y && y < h.y + h.h);
    // Left of x 4 the head and body cover the arm's shoulder in their own colours.
    const covered = ([x, y, w, h]: number[]) => {
      for (let px = Math.max(4, x) + 0.5; px < x + w; px++)
        for (let py = y + 0.5; py < y + h; py++) if (!inHoles(px, py)) return false;
      return true;
    };
    // Every raised rectangle on the near side (x ≥ 3) is cut past the figure's outline; every
    // far one is kept.
    const near = raised.filter(([x]) => x >= 3),
      far = raised.filter(([x]) => x < 0);
    expect(near.length).toBeGreaterThanOrEqual(3);
    expect(far.length).toBeGreaterThanOrEqual(3);
    for (const r of near) expect(covered(r), `${r}`).toBe(true);
    for (const [x, y, w, h] of far)
      for (let px = x + 0.5; px < x + w; px++)
        for (let py = y + 0.5; py < y + h; py++) expect(inHoles(px, py)).toBe(false);
    // Nothing else of the figure (face, glasses, hair, body) falls in the holes.
    for (const r of standing.map((s) => s.split(',').map(Number)))
      if (!lowered.some((l) => l.join() === r.join()))
        for (let px = r[0] + 0.5; px < r[0] + r[2]; px++)
          for (let py = r[1] + 0.5; py < r[1] + r[3]; py++)
            expect(inHoles(px, py), `${r} at ${px},${py}`).toBe(false);
    // The arm hung at the side is the standing figure's own near arm and hand.
    expect(lowered.filter(([x]) => x >= 3)).toEqual([
      [SIDE_ARM.x, SIDE_ARM.y, SIDE_ARM.w, SIDE_ARM.h],
      [SIDE_HAND.x, SIDE_HAND.y, SIDE_HAND.w, SIDE_HAND.h],
    ]);
    // Pointing, they face the rugs, and the raised far arm (mirrored to the right of the figure)
    // shows against the lawn: the eyepiece end of the telescope is a few px further right.
    const pointing = YEAR.filter(starNight)
      .flatMap((night) =>
        Array.from({ length: 300 }, (_, i) => 1320 + i * 0.5).map((e) =>
          astronomerAt(e >= 1440 ? night + 1 : night, e % 1440),
        ),
      )
      .filter((state) => state?.pose === 'point');
    expect(pointing.length).toBeGreaterThan(100);
    const scope = project(TELESCOPE.x, TELESCOPE.y);
    for (const state of pointing) {
      expect(state!.facing).toBe('sw');
      const feet = project(state!.at.x, state!.at.y);
      // The raised hand's far edge: x −4 of the figure, mirrored, at 1.25 scale.
      expect(scope.x - 7.5 - (feet.x + 4 * 1.25 + 3 * 1.25)).toBeGreaterThanOrEqual(1);
    }
  });

  it('only comes out on a star night', () => {
    const plain = YEAR.find((day) => !starNight(day) && !starNight(day - 1))!;
    for (let minutes = 0; minutes < 1440; minutes += 10)
      expect(astronomerAt(plain, minutes)).toBeUndefined();
  });
});

describe('The summer meteors', () => {
  it('cross the sky on Summer 27, Summer 28 and Autumn 1 only, three a night at most', () => {
    const nights = YEAR.filter(meteorNight).map(label);
    expect(nights).toEqual(['Summer 27', 'Summer 28', 'Autumn 1']);
    for (const day of YEAR) {
      const meteors = meteorsOf(day);
      expect(meteors.length).toBeLessThanOrEqual(3);
      expect(meteors.length > 0).toBe(meteorNight(day));
      // While the stargazers are out, never two at once, and each takes its 2.6 seconds.
      for (const [k, meteor] of meteors.entries()) {
        expect(meteor.start).toBeGreaterThanOrEqual(OUTING_TIMES.stargazing.start);
        expect(meteor.start + METEOR_MINUTES).toBeLessThanOrEqual(OUTING_TIMES.stargazing.end);
        if (k) expect(meteor.start).toBeGreaterThan(meteors[k - 1].start + METEOR_MINUTES);
      }
    }
    expect(METEOR_MINUTES).toBeGreaterThanOrEqual(1.5);
  });

  it('is a 40-px cool-white streak, high over the hills on every screen', () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(METEOR_COLOUR.slice(i, i + 2), 16));
    expect(b).toBeGreaterThanOrEqual(r);
    expect(Math.min(r, g, b)).toBeGreaterThan(0xd0);
    for (const day of YEAR.filter(meteorNight))
      for (const meteor of meteorsOf(day))
        for (const [width, height] of [
          [1280, 720],
          [1440, 900],
          [1120, 640],
          [390, 440],
          [2560, 1440],
        ])
          for (let age = 0.05; age < METEOR_MINUTES; age += 0.05) {
            const steps = meteorSteps(meteor, meteor.start + age, width, height);
            const head = steps[0],
              tail = steps.at(-1)!;
            const length = Math.hypot(head.x - tail.x, head.y - tail.y);
            const size = Math.max(0.7, Math.min(1, width / 900));
            expect(Math.abs(length - METEOR_LENGTH * size * (19 / 20))).toBeLessThan(2);
            for (const step of steps) {
              expect(step.y + step.h).toBeLessThanOrEqual(METEOR_FLOOR * height);
              expect(step.y).toBeGreaterThanOrEqual(0);
              expect(step.x).toBeGreaterThanOrEqual(0);
              expect(step.x + step.w).toBeLessThanOrEqual(width);
            }
          }
  });

  it('paints each pixel of a streak once, in an unbroken line', () => {
    for (const day of YEAR.filter(meteorNight))
      for (const meteor of meteorsOf(day))
        for (const [width, height] of [
          [1280, 720],
          [390, 440],
          [2560, 1440],
        ])
          for (let age = 0.1; age < METEOR_MINUTES; age += 0.25) {
            const steps = meteorSteps(meteor, meteor.start + age, width, height);
            const seen = new Set<string>();
            for (const step of steps) {
              expect(step.w).toBeGreaterThanOrEqual(1);
              for (let x = step.x; x < step.x + step.w; x++)
                for (let y = step.y; y < step.y + step.h; y++) {
                  // A pixel painted twice would stack its alpha: a bead in the fade.
                  expect(seen.has(`${x},${y}`), `${x},${y}`).toBe(false);
                  seen.add(`${x},${y}`);
                }
            }
            // Each step touches the one before it, side by side or corner to corner.
            for (let i = 1; i < steps.length; i++) {
              const [a, b] = [steps[i - 1], steps[i]];
              expect(Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0)).toBe(0);
              expect(Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0)).toBe(0);
            }
          }
  });

  it('fades in and out over many frames: no alpha jumps more than 0.08 a frame', () => {
    // One real second is one town minute; a frame is 1/30 of it. Every summer star night, from
    // the first glow of each meteor to its last, the step-by-step alpha of every pixel.
    const FRAME = 1 / 30;
    let frames = 0,
      seen = 0;
    for (const night of YEAR.filter(meteorNight)) {
      let before: number[] = [];
      for (let evening = 1340; evening < 1460; evening += FRAME) {
        const { ctx, calls } = recordingContext(1280, 720);
        const alphas: number[] = [];
        const proxy = new Proxy(ctx, {
          get(target, key) {
            const value = target[key as keyof typeof target];
            if (key !== 'fillRect') return value;
            return (...args: number[]) => {
              alphas.push(target.globalAlpha);
              return (value as (...a: number[]) => void)(...args);
            };
          },
        }) as CanvasRenderingContext2D;
        drawSkyExtras(proxy, {
          day: evening >= 1440 ? night + 1 : night,
          minutes: evening % 1440,
          night: true,
          width: 1280,
          height: 720,
        });
        expect(calls.every((call) => call.name === 'fillRect')).toBe(true);
        // A meteor that appears or goes is compared with nothing: it starts and ends near 0.
        const length = Math.max(alphas.length, before.length);
        for (let i = 0; i < length; i++)
          expect(
            Math.abs((alphas[i] ?? 0) - (before[i] ?? 0)),
            `${label(night)} at ${evening.toFixed(3)}, step ${i}`,
          ).toBeLessThanOrEqual(0.08 + 1e-9);
        if (alphas.length) seen++;
        before = alphas;
        frames++;
      }
    }
    expect(frames).toBeGreaterThan(10_000);
    // Three nights, three meteors, 2.6 seconds each.
    expect(seen).toBeGreaterThanOrEqual(3 * 3 * 2.5 * 30);
  });

  it('draws nothing by day, nor on any other night', () => {
    for (const day of YEAR.slice(0, 60))
      for (const minutes of [600, 1356, 1390, 1428, 30]) {
        const { ctx, calls } = recordingContext(1280, 720);
        drawSkyExtras(ctx, {
          day,
          minutes,
          night: minutes < 360 || minutes >= 1200,
          width: 1280,
          height: 720,
        });
        const evening = minutes < 360 ? day - 1 : day;
        if (!meteorNight(evening) || minutes === 600) expect(calls).toHaveLength(0);
      }
  });
});

describe('The note in the Bandstand’s panel', () => {
  const guest = (name: string, phase: 'attending' | 'waiting' | 'going') =>
    ({
      id: name.toLowerCase(),
      resident: { name },
      event: { id: 'stargazing', name: 'Stargazing by the river', phase },
    }) as unknown as ResidentState;

  it('says when, then who is out on the rugs, then when the rugs come out again', () => {
    const before = stargazingLines(SUMMER_27, 1200, []);
    expect(before.heading).toBe('Stargazing by the river.');
    expect(before.eyebrow).toBe('NEW MOON · THE BANDSTAND LAWN');
    expect(before.body).toBe('No moon tonight, so the sky is full. Rugs out, faces up.');
    expect(before.status).toBe(
      'Stargazing on the lawn from 22:15 to 00:15. An astronomer brings a brass telescope.',
    );
    expect(stargazingLines(SUMMER_27, 1380, []).status).toBe(
      'Stargazing on the lawn from 22:15 to 00:15. The sky is dark.',
    );
    const out = [guest('Ada', 'attending'), guest('Sol', 'waiting'), guest('Kit', 'going')];
    expect(stargazingLines(SUMMER_27, 1380, out).status).toBe('Ada and Sol are out on the rugs.');
    // After midnight it is still Summer 27's night. The rugs stay out on the lawn until 00:35;
    // then the next rugs, counted from the reader's own day: Summer 28's are tonight's.
    expect(stargazingLines(SUMMER_27 + 1, 10, out.slice(0, 1)).status).toBe(
      'Ada is out on the rugs.',
    );
    expect(stargazingLines(SUMMER_27 + 1, 20, []).status).toBe(
      'Stargazing is over for tonight. The rugs come up by 00:35.',
    );
    for (const minutes of [40, 180])
      expect(stargazingLines(SUMMER_27 + 1, minutes, []).status).toBe(
        'The rugs are rolled up. They come out again tonight.',
      );
    expect(stargazingLines(SUMMER_27 + 2, 100, []).status).toBe(
      'The rugs are rolled up. They come out again tonight.',
    );
    expect(stargazingLines(dayOf('Autumn 1') + 1, 40, []).status).toBe(
      'The rugs are rolled up. They come out again on Autumn 27.',
    );
    // No star night is followed by a day without one and then another, but the words are ready.
    expect(stargazingLines(dayOf('Spring 26'), 40, []).status).toBe(
      'The rugs are rolled up. They come out again tomorrow night.',
    );
    expect(rugsLine([])).toBeUndefined();
    expect(rugsLine(['A', 'B', 'C'])).toBe('3 neighbors are out on the rugs.');
    expect(rugsLine([''])).toBe('1 neighbor is out on the rugs.');
  });

  it('mentions the meteors only on their three nights, and keeps the town’s voice', () => {
    for (const night of STAR_NIGHTS) {
      const lines = stargazingLines(night, 1300, []);
      expect(!!lines.meteors).toBe(meteorNight(night));
      for (const line of Object.values(lines).filter(Boolean) as string[]) {
        expect(line).not.toMatch(/!/);
        expect(line).not.toMatch(/lantern/i);
        expect(line.match(/\blittle\b/gi)?.length ?? 0).toBeLessThanOrEqual(1);
      }
      expect(lines.heading).toMatch(/\.$/);
    }
  });

  it('shows in the Bandstand’s panel on a star night, first once the band has gone', () => {
    const panel = (minutes: number, selected: string | null = null) =>
      renderToStaticMarkup(
        createElement(BandstandInfo, {
          day: SUMMER_27,
          minutes,
          residents: [guest('Ada', 'attending')],
          places: [],
          onFollow: () => {},
          selected,
        }),
      );
    const order = (html: string) =>
      html.indexOf('<h3>Stargazing by the river.</h3>') - html.indexOf('<h3>The Bandstand.</h3>');
    const html = panel(1380);
    expect(html).toContain('Stargazing by the river.');
    expect(html).toContain('Ada is out on the rugs.');
    // At 23:00 the stars lead, and the band's day is marked over; at teatime the band leads.
    expect(order(html)).toBeLessThan(0);
    expect(html).toContain('FINISHED TODAY');
    expect(order(panel(970))).toBeGreaterThan(0);
    // Chosen from the stars' card, the note leads even while the band is on.
    expect(order(panel(1020, 'stargazing'))).toBeLessThan(0);
    const note = renderToStaticMarkup(
      createElement(StargazingNote, { day: SUMMER_27, minutes: 1300, residents: [] }),
    );
    expect(note).toContain('class="venue-program"');
    expect(note).toContain('a few slow meteors');
  });
});
