import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { tint } from '../src/city/houses';
import { renderCity } from '../src/city/render';
import { drawResident, NIGHT_DIM } from '../src/city/residents';
import type { EventPose } from '../src/lib/events';
import { DEFAULT_RESIDENT, draftSchema, placeSchema, residentSchema } from '../src/lib/schema';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { project } from '../src/lib/world';
import { recordingContext } from './recording-context';

const legacyPlace = JSON.parse(readFileSync('examples/my-little-place.json', 'utf8'));
const { figure: _figure, ...legacyResident } = DEFAULT_RESIDENT;

describe('Resident figure compatibility', () => {
  it('keeps the original figure for old places and browser drafts', () => {
    for (const schema of [placeSchema, draftSchema]) {
      expect(schema.parse(legacyPlace).resident.figure).toBe('male');
      expect(schema.parse({ ...legacyPlace, resident: legacyResident }).resident.figure).toBe(
        'male',
      );
    }
    expect(
      draftSchema.parse({ ...legacyPlace, resident: { ...legacyResident, name: '', greeting: '' } })
        .resident.figure,
    ).toBe('male');
  });

  it.each(['male', 'female'] as const)(
    'preserves %s through draft storage and JSON export',
    (figure) => {
      const input = { ...legacyPlace, resident: { ...DEFAULT_RESIDENT, figure } };
      const restored = draftSchema.parse(JSON.parse(JSON.stringify(input)));
      const exported = JSON.stringify(placeSchema.parse(restored));
      expect(placeSchema.parse(JSON.parse(exported)).resident).toEqual(input.resident);
    },
  );

  it.each(['unknown', '', null, 1, {}])('rejects unsupported figure values: %j', (figure) => {
    for (const schema of [placeSchema, draftSchema])
      expect(
        schema.safeParse({ ...legacyPlace, resident: { ...DEFAULT_RESIDENT, figure } }).success,
      ).toBe(false);
  });

  it('retains strict validation for unrelated fields', () => {
    expect(residentSchema.safeParse({ ...DEFAULT_RESIDENT, unexpected: true }).success).toBe(false);
  });

  it('changes appearance without changing routes or event participation', () => {
    const male = placeSchema.parse({
      ...legacyPlace,
      resident: {
        ...DEFAULT_RESIDENT,
        routine: { morning: 'stroll', afternoon: 'stroll', evening: 'stroll', night: 'stroll' },
      },
    });
    const female = { ...male, resident: { ...male.resident, figure: 'female' as const } };
    for (let minute = 0; minute < 1440; minute += 17) {
      const {
        resident: maleResident,
        home: maleHome,
        ...maleState
      } = simulateResidents([male], minute, 0)[0];
      const {
        resident: femaleResident,
        home: femaleHome,
        ...femaleState
      } = simulateResidents([female], minute, 0)[0];
      expect(femaleState).toEqual(maleState);
      expect(femaleHome.id).toBe(maleHome.id);
      expect(femaleResident.figure).toBe('female');
      expect(maleResident.figure).toBe('male');
    }
  });
});

describe('Resident figures at night', () => {
  const resident = {
    ...DEFAULT_RESIDENT,
    skin: '#D1B38A',
    outfit: '#C97878',
    accessory: 'hat' as const,
  };
  type State = Parameters<typeof drawResident>[5];
  /** What a figure paints, call by call, with the colour of each. */
  const painted = (state?: State, options?: Parameters<typeof drawResident>[6]) => {
    const { ctx, calls } = recordingContext();
    drawResident(ctx, resident, 100, 200, 1.25, state, options);
    return calls
      .filter((call) => call.name.startsWith('fill') || call.name === 'ellipse')
      .map((call) => ({ name: call.name, args: call.args, fill: call.fillStyle as string }));
  };
  // Words and light keep their colours at night: the ground shadow, a greeting's bubble and ink,
  // a duck heart, a chat's bubble and dots, a tea's steam and music notes.
  const UNDIMMED = new Set([
    '#23341B30',
    '#FCFAEF',
    '#4D664E',
    '#D77683',
    '#7B8A69',
    '#FFFFFF80',
    '#E0B768',
  ]);
  const states: [string, State][] = [
    ['standing, with a greeting', { moving: false, facing: 'se', walkPhase: 0, greeting: true }],
    ['walking', { moving: true, facing: 'sw', walkPhase: 0.3, greeting: false }],
    [
      'in love with a duck',
      { moving: false, facing: 'se', walkPhase: 0, greeting: false, duckLove: true },
    ],
    ...(
      [
        ['sit', 0.2],
        ['read', 0.2],
        ['sip', 0.2],
        ['chat', 0.2],
        ['play', 0.2],
        ['cheer', 0.2],
        ['dance', 0.1],
        ['skate', 0.2],
        ['perch', 0.2],
        ['tea', 0.8],
        ['water', 0.5],
        ['sweep', 0.5],
        ['crouch', 0.2],
        ['stretch', 0.2],
      ] as [EventPose, number][]
    ).map(([pose, walkPhase]): [string, State] => [
      pose,
      { pose, moving: false, walkPhase, facing: 'ne', greeting: false },
    ]),
  ];

  it('draws a figure by day, or with no state, exactly as it always has', () => {
    for (const [, state] of [['none', undefined] as const, ...states])
      expect(painted(state, { night: false })).toEqual(painted(state));
  });

  it.each(states)(
    'darkens a figure %s at night like the roofs around it, keeping its words and light',
    (_, state) => {
      const day = painted(state),
        night = painted(state, { night: true });
      expect(night.map(({ name, args }) => [name, args])).toEqual(
        day.map(({ name, args }) => [name, args]),
      );
      let dimmed = 0;
      night.forEach(({ fill }, i) => {
        if (UNDIMMED.has(day[i].fill)) return expect(fill).toBe(day[i].fill);
        expect(fill).toBe(tint(day[i].fill, NIGHT_DIM));
        dimmed++;
      });
      expect(dimmed).toBeGreaterThan(15);
    },
  );

  it("dims the map's walkers at night, one fading on their doorstep too, but not their words", () => {
    const position = { x: 20.5, y: 40.5 };
    const at = project(position.x, position.y);
    for (const fade of [undefined, 0.5]) {
      const home = placeSchema.parse(legacyPlace);
      const walker: ResidentState = {
        id: home.id,
        resident,
        home,
        activity: 'stroll',
        position,
        moving: true,
        facing: 'se',
        walkPhase: 0.3,
        greeting: true,
        ...(fade === undefined ? {} : { fade }),
      };
      const draw = (night: boolean) => {
        const { ctx, calls } = recordingContext(900, 700);
        renderCity({
          ctx,
          width: 900,
          height: 700,
          camera: { x: 450 - at.x * 2, y: 350 - at.y * 2, zoom: 2 },
          places: [],
          selectedPlot: null,
          hoveredPlot: null,
          night,
          showPlots: false,
          residents: [walker],
          minutes: night ? 1300 : 720,
          day: 3,
        });
        return calls;
      };
      const skin = (calls: ReturnType<typeof draw>, colour: string) =>
        calls.filter((call) => call.name === 'fillRect' && call.fillStyle === colour).length;
      const byDay = draw(false),
        byNight = draw(true);
      expect(skin(byDay, resident.skin)).toBeGreaterThan(0);
      expect(skin(byNight, resident.skin)).toBe(0);
      expect(skin(byNight, tint(resident.skin, NIGHT_DIM))).toBe(skin(byDay, resident.skin));
      // The greeting still reads in its own ink.
      for (const calls of [byDay, byNight])
        expect(calls.some((call) => call.name === 'fillText' && call.fillStyle === '#4D664E')).toBe(
          true,
        );
    }
  });
});
