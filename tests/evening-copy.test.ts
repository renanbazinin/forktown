import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EVENING_COPY,
  FORK_COPY,
  lanternCaption,
  lanternHourStatus,
  realWait,
} from '../src/lib/evening-copy';
import {
  restoreDraftDesign,
  restoreDraftPlot,
  storyPrompt,
  STORY_PROMPTS,
} from '../src/lib/builder-nudges';
import { FORK_PLOT, lanternHourAt, lanternRegister } from '../src/lib/lanterns';
import { HOUSE_PLOTS } from '../src/lib/events';
import { DEFAULT_DESIGN, placeSchema } from '../src/lib/schema';
import { ARRIVALS, TOWN } from './lantern-town';

const places = TOWN;
// Every house file, for checks about the plots they occupy today.
const everyHouse = readdirSync('places')
  .filter((name) => name.endsWith('.json'))
  .map((name) => placeSchema.parse(JSON.parse(readFileSync(`places/${name}`, 'utf8'))));
const nameOf = (id: string) => places.find((place) => place.id === id)?.name ?? id;

describe('Lantern hour words', () => {
  it('counts down in real time', () => {
    expect(realWait(0)).toBe('any moment now');
    expect(realWait(-3)).toBe('any moment now');
    expect(realWait(0.2)).toBe('in 1 second');
    expect(realWait(1)).toBe('in 1 second');
    expect(realWait(45)).toBe('in 45 seconds');
    expect(realWait(60)).toBe('in about 1 minute');
    expect(realWait(420)).toBe('in about 7 minutes');
    expect(realWait(840)).toBe('in about 14 minutes');
  });

  it('tells each phase of the evening', () => {
    expect(
      lanternHourStatus({ phase: 'waiting', lit: 0, total: 17, startsIn: 420, lastLightsAt: 1216 }),
    ).toEqual({
      sentence: 'The lanterns come on at 20:00, oldest first.',
      detail: 'Nightfall is in about 7 minutes.',
    });
    expect(
      lanternHourStatus({ phase: 'lighting', lit: 9, total: 17, startsIn: 0, lastLightsAt: 1216 }),
    ).toEqual({
      sentence: 'Lantern hour. The lanterns are coming on, oldest first.',
      detail: '9 of 17 lit',
    });
    expect(
      lanternHourStatus({ phase: 'lit', lit: 17, total: 17, startsIn: 0, lastLightsAt: 1216 }),
    ).toEqual({
      sentence: 'All 17 lanterns are lit.',
      detail: 'They stay lit until dawn at 06:00.',
    });
    expect(lanternHourStatus(lanternHourAt(0, 1300))).toEqual({
      sentence: 'No lanterns yet. The first house will light the first one.',
      detail: '',
    });
  });

  it('changes its sentence only at 20:00, 20:30 and 06:00', () => {
    const changes: number[] = [];
    let last = '';
    for (let minute = 360; minute < 1800; minute += 0.25) {
      const { sentence } = lanternHourStatus(lanternHourAt(17, minute % 1440));
      if (sentence !== last && minute > 360) changes.push(minute % 1440);
      last = sentence;
    }
    expect(changes).toEqual([1200, 1230]);
    expect(lanternHourStatus(lanternHourAt(17, 359.9)).sentence).not.toBe(
      lanternHourStatus(lanternHourAt(17, 360)).sentence,
    );
  });
});

describe('Lantern captions', () => {
  const register = lanternRegister(places, ARRIVALS);

  it('reports each house’s place in the town’s history', () => {
    expect(lanternCaption(register, 'after-hours', nameOf)).toEqual({
      label: 'FOUNDING LANTERN',
      detail: 'One of the houses the town began with.',
      newest: false,
    });
    expect(lanternCaption(register, 'my-little-place', nameOf)).toMatchObject({
      label: 'LANTERN No. 9 OF 17',
      detail: 'The first neighbor after the founding houses.',
      newest: false,
    });
    expect(lanternCaption(register, 'mulu-s', nameOf)).toMatchObject({
      label: 'LANTERN No. 13 OF 17',
      detail: 'Moved in after Arcade.',
    });
    expect(lanternCaption(register, 'rehovot-orchard', nameOf)).toMatchObject({
      label: 'LANTERN No. 17 OF 17',
      detail: 'Moved in after Willow Lodge.',
      newest: true,
      newestDetail:
        'The newest neighbor. The welcome pennant flies here until the next one moves in.',
    });
    expect(lanternCaption(register, 'a-draft', nameOf)).toBeUndefined();
  });

  it('claims no history it does not have', () => {
    const shallow = lanternRegister(places, []);
    expect(lanternCaption(shallow, 'mulu-s', nameOf)).toEqual({
      label: 'A LANTERN ON THE FORK',
      newest: false,
    });
    expect(lanternCaption(shallow, 'stargazer', nameOf)?.label).toBe('FOUNDING LANTERN');
  });
});

describe('The builder asks for a story of its own', () => {
  it('asks the same question for the same draft', () => {
    for (const seed of ['moss-nook', 'a', '', 'Rehovot Orchard']) {
      expect(STORY_PROMPTS).toContain(storyPrompt(seed));
      expect(storyPrompt(seed)).toBe(storyPrompt(seed));
    }
    const asked = new Set(places.map((place) => storyPrompt(place.id)));
    expect(asked.size).toBeGreaterThan(2);
  });

  it('moves a restored draft off a taken or reserved plot', () => {
    const available = HOUSE_PLOTS.filter(
      (plot) => !everyHouse.some((place) => place.plot === plot.id),
    );
    expect(restoreDraftPlot(available[3].id, available)).toBe(available[3].id);
    expect(restoreDraftPlot(FORK_PLOT, available)).toBe(available[0].id);
    expect(restoreDraftPlot('C6', available)).toBe(available[0].id);
    expect(restoreDraftPlot('C6', [])).toBe('A1');
  });

  it('brings back a three-floor draft with two floors', () => {
    const tall = { ...DEFAULT_DESIGN, floors: 3 as const, feature: 'balcony' as const };
    expect(restoreDraftDesign(tall)).toEqual({ ...tall, floors: 2 });
    for (const floors of [1, 2] as const) {
      const design = { ...DEFAULT_DESIGN, floors };
      expect(restoreDraftDesign(design)).toBe(design);
    }
  });
});

it('writes plain text only', () => {
  const register = lanternRegister(places, ARRIVALS);
  const words = [
    ...[0, 1, 45, 60, 840].map(realWait),
    ...[0, 17].flatMap((total) =>
      [300, 1205, 1300].flatMap((minute) =>
        Object.values(lanternHourStatus(lanternHourAt(total, minute))),
      ),
    ),
    ...places.flatMap((place) =>
      Object.values(lanternCaption(register, place.id, nameOf) ?? {}).map(String),
    ),
    ...Object.values(FORK_COPY).filter((value) => typeof value === 'string'),
    FORK_COPY.lede(17),
    FORK_COPY.neighborsHeading(true),
    FORK_COPY.neighborsHeading(false),
    ...Object.values(EVENING_COPY).filter((value) => typeof value === 'string'),
    EVENING_COPY.lanternBody(17),
    EVENING_COPY.taleTitle('Rehovot Orchard'),
    EVENING_COPY.visitPlace('Rehovot Orchard'),
    ...STORY_PROMPTS,
  ];
  expect(words.length).toBeGreaterThan(60);
  for (const word of words) expect(word).not.toContain('<');
});
