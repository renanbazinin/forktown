import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawHouse, houseReach, type HouseLife } from '../src/city/houses';
import { renderCity, type Camera } from '../src/city/render';
import { drawResident, residentReach } from '../src/city/residents';
import { inTubeGlass, tubeCrowdOffsets } from '../src/city/tubes';
import { eventsForDay } from '../src/lib/events';
import type { Place } from '../src/lib/schema';
import { AUTUMN, WINTER, townSeasonAt } from '../src/lib/seasons';
import { simulateResidents, type ResidentState } from '../src/lib/simulation';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';
import { WORLD_BOUNDS, getPlot, plotCenter, project } from '../src/lib/world';
import { matrixContext } from './matrix-context';
import { recordingContext } from './recording-context';
import { everyShape, fullTown as town, places } from './house-variety';

vi.mock('../src/city/houses', async (original) => {
  const houses = await original<typeof import('../src/city/houses')>();
  return { ...houses, drawHouse: vi.fn(houses.drawHouse) };
});
vi.mock('../src/city/residents', async (original) => {
  const residents = await original<typeof import('../src/city/residents')>();
  return { ...residents, drawResident: vi.fn(residents.drawResident) };
});

// The map skips houses and walkers whose art cannot reach the screen, as it skips trees and
// lamps. Two halves make that safe: every mark a home or a figure makes stays inside the box the
// map culls by, and the map draws exactly the ones whose box meets the view.

const HOUSE_SCALE = 1.12,
  RESIDENT_SCALE = 1.25;
/** City.tsx's fitted overview. */
function whole(width: number, height: number): Camera {
  const zoom = Math.min(
    (width - 52) / (WORLD_BOUNDS.right - WORLD_BOUNDS.left + 36),
    (height - 85) / (WORLD_BOUNDS.bottom + 98),
  );
  return {
    x: width / 2 - ((WORLD_BOUNDS.left + WORLD_BOUNDS.right) / 2) * zoom,
    y: (height - WORLD_BOUNDS.bottom * zoom) / 2 + 28,
    zoom,
  };
}
const winter = townSeasonAt(CALENDAR_EPOCH_DAY + WINTER + 10, 1300);
const autumn = townSeasonAt(CALENDAR_EPOCH_DAY + AUTUMN + 6, 720);

function glows() {
  // drawGlow paints from a canvas; a stand-in lets the recorder see where the glow lands.
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => recordingContext().ctx }),
  });
}
afterEach(() => vi.unstubAllGlobals());

// A greeting may be any 40 UTF-16 units. This stand-in for Chrome's 10px "Space Mono" and its
// fallbacks gives each character the advance and ink measured there: some are many letters wide,
// and combining marks take no room of their own but stack high above, far below, or far to the
// right of their letter.
type Glyph = {
  advance: number;
  ascent?: number;
  descent?: number;
  /** Ink past the advance on either side. */
  over?: number;
  /** How far a combining mark reaches, stacked on its letter's others: above, below, right. */
  above?: number;
  below?: number;
  trail?: number;
};
const LETTER: Glyph = { advance: 6.12, ascent: 8, descent: 3 };
const GLYPHS: Record<string, Glyph> = {
  W: { advance: 6.12, ascent: 7, descent: 0 },
  '\u665A': { advance: 10, ascent: 8, descent: 1, over: 1 },
  '\uFDFD': { advance: 66.68, ascent: 12, descent: 4, over: 1 },
  '\u2E3B': { advance: 30, ascent: 3, descent: 0 },
  '\uA9C5': { advance: 23, ascent: 9, descent: 10, over: 3 },
  '\u{1242B}': { advance: 46.37, ascent: 13, descent: 6, over: 0.5 },
  '\u0310': { advance: 0, above: 3.2 },
  '\u0325': { advance: 0, below: 2.3 },
  '\u0362': { advance: 0, trail: 3.3, below: 4.4 },
  // Forty units of these after one letter ink 320px to its right in Chrome, over a 12px advance.
  '\u{11363}': { advance: 0, trail: 17 },
};
function ink(text: string, align: string) {
  let x = 0,
    left = 0,
    right = 0,
    ascent = 0,
    descent = 0,
    up = 0,
    down = 0,
    ahead = 0;
  // A mark with no letter before it sits where a letter would be.
  let letter = { from: -LETTER.advance, to: 0, ascent: 8, descent: 3 };
  for (const char of text) {
    const glyph = GLYPHS[char] ?? LETTER;
    if (glyph.advance) {
      letter = {
        from: x,
        to: x + glyph.advance,
        ascent: glyph.ascent ?? 8,
        descent: glyph.descent ?? 3,
      };
      x += glyph.advance;
      up = down = ahead = 0;
    }
    up += glyph.above ?? 0;
    down += glyph.below ?? 0;
    ahead += glyph.trail ?? 0;
    left = Math.min(left, letter.from - (glyph.over ?? 0));
    right = Math.max(right, letter.to + (glyph.over ?? 0) + ahead);
    ascent = Math.max(ascent, letter.ascent + up);
    descent = Math.max(descent, letter.descent + down);
  }
  const shift = align === 'center' ? -x / 2 : align === 'right' || align === 'end' ? -x : 0;
  return { width: x, left: left + shift, right: right + shift, ascent, descent };
}
/** Measures and draws text with the stand-in font, keeping the ink each fillText lays down. */
function withFont(recorder: ReturnType<typeof matrixContext>) {
  const inked: { x: number; y: number; call: string }[] = [];
  const target = recorder.ctx as unknown as Record<string, unknown>;
  target.measureText = (text: string) => {
    const box = ink(text, recorder.ctx.textAlign);
    return {
      width: box.width,
      actualBoundingBoxLeft: -box.left,
      actualBoundingBoxRight: box.right,
      actualBoundingBoxAscent: box.ascent,
      actualBoundingBoxDescent: box.descent,
    };
  };
  target.fillText = (text: string, x: number, y: number) => {
    const box = ink(text, recorder.ctx.textAlign);
    const [a, b, c, d, e, f] = recorder.matrix();
    for (const px of [x + box.left, x + box.right])
      for (const py of [y - box.ascent, y + box.descent])
        inked.push({ x: a * px + c * py + e, y: b * px + d * py + f, call: 'ink' });
  };
  return inked;
}

/** Every point a drawing touches, in its own px, must keep 1px inside the box. */
function expectInside(
  points: { x: number; y: number; call: string }[],
  box: { left: number; right: number; top: number; bottom: number },
  what: string,
) {
  expect(points.length, what).toBeGreaterThan(20);
  for (const p of points) {
    const inside =
      p.x >= -box.left + 1 && p.x <= box.right - 1 && p.y >= -box.top + 1 && p.y <= box.bottom - 1;
    if (!inside) expect.fail(`${what}: ${p.call} at ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
}

describe('Culling houses and walkers', () => {
  it('keeps every mark a home makes, smoke and lantern included, inside its reach', () => {
    glows();
    const night: HouseLife = {
      minutes: 1300,
      activity: 'home',
      season: winter,
      lantern: { lit: true, tale: true, newest: true },
    };
    const day: HouseLife = {
      minutes: 720,
      activity: 'work',
      season: autumn,
      lantern: { lit: false },
    };
    const paint = (place: Place, dark: boolean, life: HouseLife, what: string) => {
      const recorder = matrixContext();
      drawHouse(recorder.ctx, place, 0, 0, dark, 1, life);
      expectInside(recorder.points, houseReach(place), `${place.id}, ${what}`);
    };
    for (const place of everyShape) {
      paint(place, true, night, 'winter night');
      paint(place, false, day, 'autumn day');
    }
    // The plume's puffs rise and drift over ten town minutes: follow a whole cycle on the
    // shortest and tallest chimneys, flat roofed and gabled.
    const chimneys = everyShape.filter(
      (place) =>
        ['cottage', 'studio', 'bookshop'].includes(place.building) &&
        place.design.floors !== 2 &&
        place.design.roof !== 'classic',
    );
    expect(chimneys.length).toBeGreaterThanOrEqual(8);
    for (const place of chimneys)
      for (let k = 0; k < 20; k++)
        paint(place, false, { ...day, minutes: 720 + k / 2 }, `smoke at ${720 + k / 2}`);
  });

  it('keeps every figure, prop and greeting inside its reach', () => {
    const say = (greeting: string) => {
      expect(greeting.length).toBeLessThanOrEqual(40);
      return { ...places[0].resident, greeting };
    };
    const greetings = [
      places[0].resident,
      say('W'.repeat(40)),
      say('晚上好，邻居们！今天的月亮真圆啊'),
      // One unit each, the widest glyphs a 10px bubble can hold: a 2.7 thousand px bubble.
      say('\uFDFD'.repeat(40)),
      say('\u2E3B\uA9C5\u{1242B} hi\u0362'),
      // Marks stacked high above one letter, far below another, and far to the right of a third.
      say('Hi' + '\u0310'.repeat(38)),
      say('g' + '\u0325'.repeat(39)),
      say('a' + '\u{11363}'.repeat(19)),
    ];
    const states: Partial<ResidentState>[] = [
      { moving: true, facing: 'se', walkPhase: 0.2 },
      { moving: true, facing: 'nw', walkPhase: 0.7 },
      { pose: 'sit', facing: 'sw' },
      { pose: 'read' },
      { pose: 'sip', walkPhase: 0.3 },
      { pose: 'chat', walkPhase: 0.1 },
      { pose: 'play', walkPhase: 0.25 },
      { pose: 'dance', walkPhase: 0.2 },
      { pose: 'cheer', walkPhase: 0.6 },
      { pose: 'skate', walkPhase: 0.4, facing: 'nw' },
      { greeting: true },
      { duckLove: true, greeting: true },
    ];
    for (const resident of greetings)
      for (const state of states) {
        const recorder = matrixContext();
        const inked = withFont(recorder);
        drawResident(recorder.ctx, resident, 0, 0, 1, state as ResidentState);
        const reach = residentReach(recorder.ctx, resident, state as ResidentState);
        // The recorder guesses 7px a character for text; the font knows where the ink went.
        expectInside(
          [...recorder.points.filter((point) => point.call !== 'fillText'), ...inked],
          { left: reach.x, right: reach.x, top: reach.above, bottom: reach.below },
          `${JSON.stringify(state)} ${JSON.stringify(resident.greeting)}`,
        );
        if (state.greeting && !state.duckLove) expect(inked.length).toBe(4);
      }
  });

  it('draws exactly the homes and walkers whose reach meets the view', () => {
    const day = CALENDAR_EPOCH_DAY + 20,
      minutes = 1050;
    const residents = simulateResidents(town, minutes, day);
    const walkers = residents.filter((r) => r.activity === 'stroll' && !inTubeGlass(r.transit));
    expect(walkers.length).toBeGreaterThan(10);
    const offsets = tubeCrowdOffsets(residents);
    const views: [string, number, number, Camera][] = [
      ['the whole town', 1440, 900, whole(1440, 900)],
      ['the opening view', 1440, 900, { x: 720, y: 88, zoom: 0.7 }],
      ['a phone', 390, 844, { x: 100, y: -300, zoom: 0.85 }],
      ['one street', 1440, 900, { x: -900, y: -700, zoom: 2.4 }],
      ['a corner', 1440, 900, { x: 400, y: -1600, zoom: 2 }],
      ['the far edge', 1440, 900, { x: -2600, y: -800, zoom: 1.2 }],
    ];
    // Put one house's reach a pixel inside, then a pixel outside, the left side of the view.
    const edgeHouse = town.find((place) => place.plot === 'E5')!;
    const centre = plotCenter(getPlot('E5')!);
    const edge = centre.x + houseReach(edgeHouse).right * HOUSE_SCALE;
    const y = 450 - centre.y * 1.5;
    views.push(['a house edge just in view', 1440, 900, { x: -(edge - 1) * 1.5, y, zoom: 1.5 }]);
    views.push([
      'a house edge just out of view',
      1440,
      900,
      { x: -(edge + 1) * 1.5, y, zoom: 1.5 },
    ]);
    // The map measures greetings as it draws them; the recorder counts 6px a character.
    const measure = recordingContext().ctx;
    const drawnHomes = new Map<string, Set<Place>>();
    for (const [name, width, height, camera] of views) {
      vi.mocked(drawHouse).mockClear();
      vi.mocked(drawResident).mockClear();
      renderCity({
        ctx: recordingContext(width, height).ctx,
        width,
        height,
        camera,
        places: town,
        selectedPlot: null,
        hoveredPlot: null,
        night: false,
        showPlots: false,
        residents,
        events: eventsForDay(day),
        minutes,
        day,
      });
      const view = {
        left: -camera.x / camera.zoom,
        right: (width - camera.x) / camera.zoom,
        top: -camera.y / camera.zoom,
        bottom: (height - camera.y) / camera.zoom,
      };
      const meets = (p: { x: number; y: number }, rx: number, above: number, below: number) =>
        p.x + rx >= view.left &&
        p.x - rx <= view.right &&
        p.y + below >= view.top &&
        p.y - above <= view.bottom;
      const homes = new Set(vi.mocked(drawHouse).mock.calls.map((call) => call[1] as Place));
      const expectedHomes = town.filter((place) => {
        const reach = houseReach(place);
        return meets(
          plotCenter(getPlot(place.plot)!),
          reach.right * HOUSE_SCALE,
          reach.top * HOUSE_SCALE,
          reach.bottom * HOUSE_SCALE,
        );
      });
      expect([...homes].map((p) => p.id).sort(), name).toEqual(
        expectedHomes.map((p) => p.id).sort(),
      );
      drawnHomes.set(name, homes);
      const figures = new Set(vi.mocked(drawResident).mock.calls.map((call) => call[5]));
      const expectedFigures = walkers.filter((walker) => {
        const ground = project(walker.position.x, walker.position.y);
        const reach = residentReach(measure, walker.resident, walker);
        return meets(
          { x: ground.x + (offsets.get(walker.id) ?? 0), y: ground.y },
          Math.max(reach.x * RESIDENT_SCALE, 12),
          reach.above * RESIDENT_SCALE,
          Math.max(reach.below * RESIDENT_SCALE, 9),
        );
      });
      expect(walkers.filter((walker) => figures.has(walker)).length, name).toBe(
        expectedFigures.length,
      );
      for (const walker of expectedFigures) expect(figures.has(walker), name).toBe(true);
    }
    expect(drawnHomes.get('the whole town')!.size).toBe(town.length);
    expect(drawnHomes.get('one street')!.size).toBeLessThan(town.length / 4);
    expect(drawnHomes.get('a house edge just in view')!.has(edgeHouse)).toBe(true);
    expect(drawnHomes.get('a house edge just out of view')!.has(edgeHouse)).toBe(false);
  });

  it('draws a walker off screen while its greeting reaches into view', () => {
    const day = CALENDAR_EPOCH_DAY + 20,
      minutes = 1050;
    const residents = simulateResidents(town, minutes, day);
    const index = residents.findIndex((r) => r.activity === 'stroll' && !inTubeGlass(r.transit));
    const ground = project(residents[index].position.x, residents[index].position.y);
    const feet = {
      x: ground.x + (tubeCrowdOffsets(residents).get(residents[index].id) ?? 0),
      y: ground.y,
    };
    const drawn = (greeting: string, camera: Camera) => {
      const walker = {
        ...residents[index],
        greeting: true,
        duckLove: false,
        resident: { ...residents[index].resident, greeting },
      };
      const recorder = matrixContext();
      withFont(recorder);
      vi.mocked(drawResident).mockClear();
      renderCity({
        ctx: recorder.ctx,
        width: 1440,
        height: 900,
        camera,
        places: town,
        selectedPlot: null,
        hoveredPlot: null,
        night: false,
        showPlots: false,
        residents: residents.map((resident, i) => (i === index ? walker : resident)),
        events: eventsForDay(day),
        minutes,
        day,
      });
      return vi.mocked(drawResident).mock.calls.some((call) => call[5] === walker);
    };
    // Feet 600px left of the view: forty of the widest glyph still reach well in.
    const left = { x: -(feet.x + 600), y: 450 - feet.y, zoom: 1 };
    expect(drawn('\uFDFD'.repeat(40), left)).toBe(true);
    expect(drawn('Hello!', left)).toBe(false);
    // Feet 150px below the view: marks stacked on one letter climb into it.
    const below = { x: 720 - feet.x, y: 900 - (feet.y - 150), zoom: 1 };
    expect(drawn('Hi' + '\u0310'.repeat(38), below)).toBe(true);
    expect(drawn('Hello!', below)).toBe(false);
    // Feet 300px left of the view: marks strung out to the right of one letter reach in.
    const behind = { x: -(feet.x + 300), y: 450 - feet.y, zoom: 1 };
    expect(drawn('a' + '\u{11363}'.repeat(19), behind)).toBe(true);
    expect(drawn('Hello!', behind)).toBe(false);
  });
});
