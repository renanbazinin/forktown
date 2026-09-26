import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TubeInfo from '../src/components/TubeInfo';
import { places } from '../src/lib/places';
import {
  onTheLine,
  tubeCopy,
  TUBE_LABEL,
  TUBE_SIGN_CAPTION,
  type TubeCopy,
} from '../src/lib/tube-copy';
import { tubeLineMinutes } from '../src/lib/tube-journeys';
import {
  tubeRides,
  tubeStatus,
  type TubeParcelStage,
  type TubeRide,
  type TubeStatus,
} from '../src/lib/tube-traffic';
import {
  TUBE_ALIGHT,
  TUBE_BOARD,
  TUBE_SIGN,
  TUBE_SPEED,
  TUBE_STATIONS,
  tubeLength,
  tubeParcelMinutes,
} from '../src/lib/tubes';
import type { TubeStage } from '../src/lib/tube-journeys';
import { CALENDAR_EPOCH_DAY, DAYS_PER_YEAR } from '../src/lib/town-calendar';

const YEAR = CALENDAR_EPOCH_DAY + DAYS_PER_YEAR * 2; // Year 3, like the fixtures
const FIRST = TUBE_STATIONS[0].id;
const LAST = TUBE_STATIONS.at(-1)!.id;
const NAMES = ['Eliza', 'Sol', 'Renan'];
const STAGES: TubeStage[] = ['boarding', 'riding', 'alighting'];

/** A ride on the line's timetable: boarding, the glass, stepping off. */
const ride = (board: number, from = FIRST, to = LAST, residentId = 'rider'): TubeRide => {
  const depart = board + TUBE_BOARD;
  const arrive = depart + tubeLength(from, to) / TUBE_SPEED;
  return {
    residentId,
    eventId: 'zoo',
    direction: from === FIRST ? 'there' : 'home',
    from,
    to,
    board,
    depart,
    arrive,
    off: arrive + TUBE_ALIGHT,
  };
};
const onLine = (name: string, stage: TubeStage, from = FIRST, to = LAST, board = 700) => ({
  ...ride(board, from, to, `id-${name || 'blank'}`),
  name,
  stage,
});
const parcel = (stage?: TubeParcelStage) => {
  const depart = 725;
  return {
    id: 'parcel-1',
    from: LAST,
    to: FIRST,
    depart,
    arrive: depart + tubeParcelMinutes(LAST, FIRST),
    ...(stage ? { stage } : {}),
  };
};
const status = (fields: Partial<TubeStatus> = {}): TubeStatus => ({
  day: YEAR,
  time: 720,
  now: [],
  today: [],
  done: 0,
  ...fields,
});

/** Every combination the status can report: riders at each stage, names and blanks, parcels,
 * daytime and after midnight, and what comes next. */
function* statuses(): Generator<TubeStatus> {
  const crews = [
    [],
    ...NAMES.map((name) => [name]),
    [''],
    ['  '],
    NAMES.slice(0, 2),
    ['Sol', 'Sol'],
    ['Sol', ' sol'],
    ['Eliza', ''],
    NAMES,
    ['Eliza', '', 'Sol'],
  ];
  const parcels = [undefined, parcel(), parcel('sending'), parcel('riding'), parcel('arrived')];
  for (const time of [420, 720, 1100, 1439.9, 1440, 1500, 1799])
    for (const crew of crews)
      for (const stage of STAGES)
        for (const [from, to] of [
          [FIRST, LAST],
          [LAST, FIRST],
        ])
          for (const rides of [0, 1, 2, 5])
            for (const upcoming of ['next', 'firstToday', 'neither'] as const)
              for (const p of parcels) {
                const now = crew.map((name) => onLine(name, stage, from, to, time - 1));
                const today = [
                  ...now,
                  ...Array.from({ length: rides }, (_, i) =>
                    ride(time + 30 * (i - 1), to, from, `later-${i}`),
                  ),
                ];
                yield status({
                  time,
                  now,
                  today,
                  done: Math.max(0, today.length - now.length - 1),
                  ...(upcoming === 'next' ? { next: ride(time + 20, to, from, 'next') } : {}),
                  ...(upcoming === 'firstToday' && time >= 1440
                    ? { firstToday: ride(725, from, to, 'first') }
                    : {}),
                  ...(time < 1440 || !p ? { parcel: p } : {}),
                });
              }
}

const texts = (copy: TubeCopy) => [
  copy.label,
  copy.footer,
  copy.sign.caption,
  ...copy.blocks.flatMap((block) => [block.eyebrow, block.heading, block.body, block.note ?? '']),
];
const escape = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The brand's copy rules plus the line's own: quiet, honest, and only today's riders named. */
function voiceProblems(copy: TubeCopy, status: TubeStatus, roster: readonly string[]) {
  const problems: string[] = [];
  // The sign is the user's own words; the voice rules are for the town's.
  const text = texts(copy).join(' ');
  if (copy.label !== TUBE_LABEL) problems.push(`label ${copy.label}`);
  if (copy.sign.text !== TUBE_SIGN) problems.push(`sign ${copy.sign.text}`);
  if (copy.blocks.length !== 2) problems.push(`${copy.blocks.length} blocks`);
  for (const block of copy.blocks) {
    if (!block.heading.endsWith('.')) problems.push(`heading "${block.heading}"`);
    // Two neighbors can share a name; the heading never says it twice ("Jon and Jon").
    if (/\b(\w+) and \1\b/i.test(block.heading)) problems.push(`heading "${block.heading}"`);
    if (!/^[A-Z0-9 ·/’&–-]+$/.test(block.eyebrow)) problems.push(`eyebrow "${block.eyebrow}"`);
    if (!block.body.trim()) problems.push(`empty body under "${block.heading}"`);
  }
  if (text.includes('!')) problems.push('exclamation mark');
  if (/forktown/i.test(text)) problems.push('says forktown');
  if ((text.match(/\blittle\b/gi) ?? []).length > 1) problems.push('"little" more than once');
  const crowd = text.match(/crowd|packed|busy|dozens|lots of/i);
  if (crowd) problems.push(`crowd "${crowd[0]}"`);
  if (/neighbour/i.test(text)) problems.push('British "neighbour"');
  const named = new Set(status.now.map((ride) => ride.name.trim()).filter(Boolean));
  let unnamed = text;
  for (const name of named) unnamed = unnamed.replace(new RegExp(escape(name), 'g'), '');
  if (unnamed.includes("'")) problems.push('straight apostrophe');
  for (const name of roster) {
    const pattern = new RegExp(`\\b${escape(name)}\\b`);
    if (!named.has(name)) {
      if (pattern.test(text)) problems.push(`names ${name}, who is not on the line`);
      continue;
    }
    const others = texts({ ...copy, blocks: copy.blocks.slice(1) }).join(' ');
    if (pattern.test(others) || pattern.test(copy.blocks[0].body + (copy.blocks[0].note ?? '')))
      problems.push(`names ${name} outside the line-now heading`);
  }
  const { tube, walk } = tubeLineMinutes(FIRST, LAST);
  if (!copy.blocks[0].body.includes(`about ${Math.round(tube)} minutes`))
    problems.push('tube minutes');
  if (!copy.blocks[0].body.includes(`about ${Math.round(walk)}.`)) problems.push('walk minutes');
  return problems;
}

describe('Treeline panel copy', () => {
  it('names who is on the line, and only them', () => {
    expect(onTheLine([])).toBeUndefined();
    expect(onTheLine([onLine('Eliza', 'boarding')])).toBe('Eliza is boarding at Hedgerow Halt.');
    expect(onTheLine([onLine('Eliza', 'riding')])).toBe('Eliza is riding to Willow Halt.');
    expect(onTheLine([onLine('Eliza', 'alighting')])).toBe('Eliza is stepping off at Willow Halt.');
    expect(onTheLine([onLine('Sol', 'boarding', LAST, FIRST)])).toBe(
      'Sol is boarding at Willow Halt.',
    );
    expect(onTheLine([onLine('Sol', 'riding', LAST, FIRST)])).toBe(
      'Sol is riding to Hedgerow Halt.',
    );
    expect(onTheLine([onLine('Eliza', 'riding'), onLine('Sol', 'boarding')])).toBe(
      'Eliza and Sol are on the line.',
    );
    // Two neighbors with one name are never "Jon and Jon", whatever the case or spacing.
    expect(onTheLine([onLine('Jon', 'riding'), onLine('Jon', 'boarding')])).toBe(
      'Two neighbors named Jon are on the line.',
    );
    expect(onTheLine([onLine('Jon', 'alighting'), onLine(' jon ', 'riding')])).toBe(
      'Two neighbors named Jon are on the line.',
    );
    expect(onTheLine(NAMES.map((name) => onLine(name, 'riding')))).toBe(
      '3 neighbors are on the line.',
    );
    expect(onTheLine([onLine(' ', 'riding')])).toBe('One neighbor is on the line.');
    expect(onTheLine([onLine('Eliza', 'riding'), onLine('', 'riding')])).toBe(
      '2 neighbors are on the line.',
    );
  });

  it('tells the line honestly: minutes, parcels and the day’s rides', () => {
    const { tube, walk } = tubeLineMinutes(FIRST, LAST);
    expect([Math.round(tube), Math.round(walk)]).toEqual([9, 150]);
    const quiet = tubeCopy(status());
    expect(quiet.blocks[0]).toEqual({
      eyebrow: 'QUIET ON THE LINE',
      heading: 'Nobody in the glass right now.',
      body: 'Glass runs behind the northwest tree line, from Hedgerow Halt to Willow Halt in about 9 minutes. On foot it takes about 150.',
      note: undefined,
    });
    expect(quiet.blocks[1]).toEqual({
      eyebrow: 'RIDES TODAY',
      heading: 'No rides today.',
      body: 'Short trips stay on foot.',
    });
    expect(quiet.footer).toBe(
      'Neighbors ride only when it saves at least 10 minutes; short trips stay on foot. Everyone sees the same rides at the same moment, even after a refresh.',
    );
    expect(quiet.sign).toEqual({ caption: 'STATION SIGN · C1', text: TUBE_SIGN });
    expect(TUBE_SIGN_CAPTION).toBe('STATION SIGN · C1');
    expect(TUBE_LABEL).toBe('PUBLIC SPACE · C1 / N1');

    const notes = [undefined, 'sending', 'riding', 'arrived'].map(
      (stage) => tubeCopy(status({ parcel: parcel(stage as TubeParcelStage) })).blocks[0].note,
    );
    expect(notes).toEqual([
      'Next parcel leaves Willow Halt at 12:05.',
      'A parcel is waiting at Willow Halt.',
      'A parcel is in the glass.',
      'A parcel just arrived at Hedgerow Halt.',
    ]);

    const three = [ride(603), ride(723.5), ride(1012, LAST, FIRST)];
    const rides = (fields: Partial<TubeStatus>) => tubeCopy(status({ today: three, ...fields }));
    expect(rides({ next: three[1] }).blocks[1]).toEqual({
      eyebrow: 'RIDES TODAY',
      heading: '3 rides today.',
      body: 'Next ride at 12:03 from Hedgerow Halt.',
    });
    expect(rides({ now: [onLine('Eliza', 'riding')] }).blocks[1].body).toBe(
      'The last ride of the day is under way.',
    );
    expect(rides({}).blocks[1].body).toBe('Today’s rides are over.');
    expect(tubeCopy(status({ today: [three[0]] })).blocks[1].heading).toBe('One ride today.');

    const late = [ride(1300), ride(1460, LAST, FIRST), ride(1530)];
    expect(tubeCopy(status({ time: 1500, today: late, next: late[2] })).blocks[1]).toEqual({
      eyebrow: 'RIDES TONIGHT',
      heading: 'One more ride tonight.',
      body: 'Next ride at 01:30 from Hedgerow Halt.',
    });
    expect(
      tubeCopy(status({ time: 1455, today: late, now: [onLine('Sol', 'riding')], next: late[1] }))
        .blocks[1].heading,
    ).toBe('3 more rides tonight.');
    expect(
      tubeCopy(status({ time: 1600, today: late, firstToday: ride(723.5) })).blocks[1],
    ).toEqual({
      eyebrow: 'RIDES TONIGHT',
      heading: 'No more rides tonight.',
      body: 'The first ride of the day leaves Hedgerow Halt at 12:03.',
    });
    expect(tubeCopy(status({ time: 1600 })).blocks[1].body).toBe('Short trips stay on foot.');
  });

  it('keeps the brand voice for every status the line can report', () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const s of statuses()) {
      const problems = voiceProblems(tubeCopy(s), s, NAMES);
      checked++;
      if (problems.length) wrong.push(`${JSON.stringify(s)}: ${problems}`);
    }
    expect(checked).toBeGreaterThan(10_000);
    expect(wrong.slice(0, 5)).toEqual([]);
  });

  it('keeps the brand voice through a real year, naming only the neighbors on the line', () => {
    const roster = [...new Set(places.map((place) => place.resident.name.trim()))].filter(Boolean);
    const wrong: string[] = [];
    let riding = 0;
    for (let day = YEAR; day < YEAR + DAYS_PER_YEAR; day += 3)
      for (let minutes = 0; minutes < 1440; minutes += 7) {
        const s = tubeStatus(places, minutes, day);
        const copy = tubeCopy(s);
        if (s.now.length) riding++;
        const problems = voiceProblems(copy, s, roster);
        if (problems.length) wrong.push(`${day} ${minutes}: ${problems}`);
      }
    expect(wrong.slice(0, 5)).toEqual([]);
    // The sample catches neighbors on the line, so the naming rule is really exercised.
    expect(riding).toBeGreaterThan(0);
  }, 60_000);

  it('never says one name twice when two neighbors share it', () => {
    // Today's roster has two neighbors named Jon (E2 and F2), who ride to the zoo minutes apart
    // on a few days a year. Every moment they share the line is checked, not a sample.
    const names = new Map(places.map((place) => [place.id, place.resident.name.trim()]));
    const same = (a: TubeRide, b: TubeRide) =>
      a.residentId !== b.residentId &&
      !!names.get(a.residentId) &&
      names.get(a.residentId)!.toLowerCase() === names.get(b.residentId)!.toLowerCase();
    const headings = new Set<string>();
    for (let day = YEAR; day < YEAR + DAYS_PER_YEAR; day++) {
      const rides = tubeRides(places, day);
      for (const a of rides)
        for (const b of rides) {
          if (a.board >= b.board || !same(a, b) || a.off <= b.board) continue;
          const minute = (b.board + Math.min(a.off, b.off)) / 2;
          // After midnight the plan is still this day's, read from the next day's clock.
          const s =
            minute < 1440
              ? tubeStatus(places, minute, day)
              : tubeStatus(places, minute - 1440, day + 1);
          const heading = tubeCopy(s).blocks[0].heading;
          headings.add(heading);
          expect(heading).not.toMatch(/\b(\w+) and \1\b/i);
          if (s.now.length === 2)
            expect(heading).toBe(`Two neighbors named ${names.get(a.residentId)} are on the line.`);
        }
    }
    expect([...headings]).toContain('Two neighbors named Jon are on the line.');
  });

  it('shows the rider in the card while they ride', () => {
    let day = YEAR;
    const daytime = (ride: TubeRide) => ride.board >= 360 && ride.off < 1440;
    while (day < YEAR + DAYS_PER_YEAR && !tubeRides(places, day).some(daytime)) day++;
    const first = tubeRides(places, day).find(daytime)!;
    expect(first).toBeDefined();
    const name = places.find((place) => place.id === first.residentId)!.resident.name;
    const s = tubeStatus(places, (first.depart + first.arrive) / 2, day);
    expect(s.now.map((ride) => [ride.residentId, ride.stage])).toContainEqual([
      first.residentId,
      'riding',
    ]);
    const markup = renderToStaticMarkup(createElement(TubeInfo, { status: s }));
    expect(markup).toContain(s.now.length === 1 ? `${name} is riding to ` : ' are on the line.');
  });
});

describe('Treeline panel', () => {
  it('uses the venue markup and shows the sign word for word, once', () => {
    const markup = renderToStaticMarkup(createElement(TubeInfo, { status: status() }));
    expect(markup).toContain('venue-info');
    expect(markup).toContain('quiet-label');
    expect(markup).toContain('PUBLIC SPACE · C1 / N1');
    expect(markup).toContain('STATION SIGN · C1');
    expect(markup.split('People &amp; parcels. Please remove umbrella.')).toHaveLength(2);
  });

  it('is wired into the app, the map and the live view', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain("get('venue') === 'tube'");
    expect(app).toContain("'#venue=tube'");
    // The heading names the line, never "Plot C1".
    expect(app).toContain('selectedTube ? TUBE_VENUE.name');
    expect(app.indexOf('selectedTube ? TUBE_VENUE.name')).toBeLessThan(
      app.indexOf('`Plot ${selectedPlot}`'),
    );
    // The line's panel comes before the empty-plot fallback that offers "Build here".
    expect(app.indexOf('<TubeInfo')).toBeGreaterThan(-1);
    expect(app.indexOf('<TubeInfo')).toBeLessThan(app.indexOf("'Build here'"));
    const city = readFileSync('src/components/City.tsx', 'utf8');
    expect(city).toContain('tubeCamera');
    expect(city).toContain('isTubePlot(hover)');
    expect(city).toContain('TUBE_LINE_NAME');
    expect(city).toContain('transit?.altitude');
    // The tooltip names the station, never the empty-plot tooltip.
    expect(city.indexOf('isTubePlot(hover)')).toBeLessThan(
      city.indexOf('PLOT_COPY.tooltip(hover)'),
    );
    const live = readFileSync('src/components/LiveStream.tsx', 'utf8');
    expect(live).toContain('liveEaseSeconds');
    expect(live).toContain('liveLabelLift');
    expect(readFileSync('src/components/ZooInfo.tsx', 'utf8')).toContain('take the tube');
  });

  it('is a pure function of the status', () => {
    for (const file of ['src/lib/tube-copy.ts', 'src/components/TubeInfo.tsx'])
      expect(readFileSync(file, 'utf8')).not.toMatch(
        /\bDate\b|Math\.random|localStorage|sessionStorage/,
      );
  });
});
