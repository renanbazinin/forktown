// The Morning Market's browsers, their bags and the panel (agent B, SPEC §4.1): a browser faces
// their stall, glances a quarter turn to the next stall every 6–10 minutes and holds each look a
// minute at least, never in the first or last minute at the spot; one beat in three they chat. On
// the way home they carry a paper bag topped by the day's market. The panel names the browsers
// only while they are there and says when the next market opens once this one has closed.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { paperBagSprite, PAPER_BAG } from '../src/city/carry/paper-bag';
import MarketInfo, { browsingNow, marketStatus } from '../src/components/district/MarketInfo';
import { byNeighborName } from '../src/components/district/NeighborList';
import { MARKET_KINDS, marketKind } from '../src/lib/district-calendar';
import { DISTRICT_COPY, PANEL_COPY } from '../src/lib/district-copy';
import { DISTRICT_SPOTS } from '../src/lib/district-places';
import { districtEvents, eventStatus } from '../src/lib/events';
import { outingOf } from '../src/lib/outings';
import {
  glanceFacing,
  MARKET_BEAT,
  MARKET_CALM,
  MARKET_CHAT,
  MARKET_GLANCE,
  marketBeat,
  marketChat,
  marketFacing,
  marketLookStart,
  marketPose,
  stallOfSeat,
} from '../src/lib/outings/market';
import { residentTrips, tripState, type ResidentTrip } from '../src/lib/resident-trips';
import type { Place } from '../src/lib/schema';
import type { ResidentState } from '../src/lib/simulation';
import { BRAND } from '../src/lib/brand';
import { TOWNS, YEAR } from './district';
import { recordingContext } from './recording-context';

const town: Place[] = TOWNS.full;
const ids = Array.from({ length: 60 }, (_, i) => `browser-${i}`);
const QUARTER: Record<string, readonly string[]> = {
  ne: ['nw', 'se'],
  nw: ['ne', 'sw'],
  se: ['ne', 'sw'],
  sw: ['nw', 'se'],
};

/** Each run of one facing over a visit, sampled every 0.05 minutes. */
function facingRuns(id: string, seat: number, arrive: number, leave: number) {
  const runs: { facing: string; from: number; to: number }[] = [];
  for (let t = arrive; t < leave; t += 0.05) {
    const facing = marketBeat(id, seat, arrive, t, leave).glance ?? 'own';
    const last = runs.at(-1);
    if (last && last.facing === facing) last.to = t;
    else runs.push({ facing, from: t, to: t });
  }
  return runs;
}

describe('A browser at their stall', () => {
  it('glances to the next stall every 6 to 10 minutes, a quarter turn, and holds it', () => {
    let glances = 0;
    for (const id of ids)
      for (const seat of [0, 3, 5, 6, 9, 11]) {
        const arrive = 480 + (seat % 4) * 7,
          leave = arrive + 90;
        const own = DISTRICT_SPOTS.market[seat].facing;
        const runs = facingRuns(id, seat, arrive, leave);
        for (const run of runs) {
          // Every look lasts a minute at least, the last one included.
          expect(run.to - run.from + 0.05, `${id} ${seat}`).toBeGreaterThanOrEqual(1);
          if (run.facing === 'own') continue;
          glances++;
          expect(QUARTER[own]).toContain(run.facing);
          expect(run.to - run.from).toBeGreaterThan(MARKET_GLANCE - 0.11);
          expect(run.to - run.from).toBeLessThan(MARKET_GLANCE + 0.01);
          // Never in the first or the last calm minute at the spot.
          expect(run.from - arrive).toBeGreaterThanOrEqual(MARKET_CALM);
          expect(leave - run.to).toBeGreaterThanOrEqual(MARKET_CALM);
        }
        // The looks begin 6–10 minutes apart.
        for (let k = 1; k < 12; k++) {
          const gap = marketLookStart(id, k) - marketLookStart(id, k - 1);
          expect(gap).toBeGreaterThanOrEqual(MARKET_BEAT.min);
          expect(gap).toBeLessThanOrEqual(MARKET_BEAT.max);
        }
      }
    expect(glances).toBeGreaterThan(1000);
  });

  it('keeps to their own stall until their own hour opens, if they come early', () => {
    let early = 0;
    for (const id of ids) {
      const arrive = 470,
        opens = 500,
        leave = 600;
      for (let t = arrive; t < leave; t += 0.05) {
        const beat = marketBeat(id, 2, arrive, t, leave, opens);
        if (!beat.glance) continue;
        // A glance starts only once the hour is open, and it is the same as without the wait.
        expect(arrive + marketLookStart(id, beat.look)).toBeGreaterThanOrEqual(opens);
        expect(marketBeat(id, 2, arrive, t, leave).glance).toBe(beat.glance);
      }
      for (let t = arrive; t < opens; t += 0.05)
        if (marketBeat(id, 2, arrive, t, leave).glance) early++;
      for (let t = arrive; t < opens; t += 0.05)
        expect(marketBeat(id, 2, arrive, t, leave, opens).glance).toBeUndefined();
    }
    // Without the wait some of them would have glanced before their hour.
    expect(early).toBeGreaterThan(0);
  });

  it('looks inward from the ends of a row, and either way from its middle stall', () => {
    for (const id of ids) {
      expect(glanceFacing(id, 0, 1)).toBe('se'); // north row, west end: east along the row
      expect(glanceFacing(id, 5, 1)).toBe('nw'); // north row, east end
      expect(glanceFacing(id, 6, 1)).toBe('sw'); // west row, north end: south along the row
      expect(glanceFacing(id, 11, 1)).toBe('ne'); // west row, south end
    }
    const middle = new Set(ids.flatMap((id) => [1, 2, 3].map((k) => glanceFacing(id, 2, k))));
    expect([...middle].sort()).toEqual(['nw', 'se']);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(stallOfSeat)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    ]);
  });

  it('chats one beat in three, for a while, facing their own stall', () => {
    let beats = 0,
      chats = 0;
    for (const id of ids) {
      const arrive = 500,
        leave = 640;
      for (let k = 0; k < 10; k++) {
        const from = marketLookStart(id, k) + (k ? MARKET_GLANCE : 0) + MARKET_CALM;
        if (arrive + from + MARKET_CHAT > leave - MARKET_CALM) break;
        beats++;
        const at = marketBeat(id, 4, arrive, arrive + from + 0.5, leave);
        if (!at.chat) continue;
        chats++;
        expect(at.glance).toBeUndefined();
        expect(marketBeat(id, 4, arrive, arrive + from + MARKET_CHAT - 0.01, leave).chat).toBe(
          true,
        );
        expect(marketBeat(id, 4, arrive, arrive + from + MARKET_CHAT + 0.01, leave).chat).toBe(
          false,
        );
      }
      // Never in the first minute at the spot, nor the last.
      for (let t = arrive; t < arrive + MARKET_CALM; t += 0.1)
        expect(marketBeat(id, 4, arrive, t, leave).chat).toBe(false);
      for (let t = leave - MARKET_CALM; t < leave; t += 0.1)
        expect(marketBeat(id, 4, arrive, t, leave).chat).toBe(false);
    }
    expect(chats / beats).toBeGreaterThan(0.22);
    expect(chats / beats).toBeLessThan(0.45);
  });

  it('chats on their feet, and only on a chat beat', () => {
    const plan = residentTrips(town, YEAR[8]);
    let checked = 0;
    for (const [id, trips] of plan)
      for (const trip of trips) {
        if (trip.event.outing !== 'market') continue;
        const home = town.find((place) => place.id === id)!;
        for (let t = trip.arrive; t < trip.leave; t += 0.5) {
          const context = {
            home,
            trip,
            time: t,
            day: YEAR[8],
            seat: trip.seat,
            arrive: trip.arrive,
            leave: trip.leave,
          };
          const chat = marketBeat(id, trip.seat, trip.arrive, t, trip.leave).chat;
          expect(marketPose(context)).toBe(chat ? 'chat' : undefined);
          // The market is not a seated outing: no crouch leads into the chat.
          expect(tripState(home, trip, t, YEAR[8]).pose).toBe(chat ? 'chat' : undefined);
          expect(marketFacing(context)).toBe(
            marketBeat(id, trip.seat, trip.arrive, t, trip.leave, trip.event.start).glance,
          );
          expect(marketChat(context)).toBe(
            marketBeat(id, trip.seat, trip.arrive, t, trip.leave).chat,
          );
          checked++;
        }
      }
    expect(checked).toBeGreaterThan(100);
  });

  it('arrives and sets off facing the stall, and never turns about in the planner', () => {
    let browsers = 0;
    for (const day of [YEAR[1], YEAR[40], YEAR[90]]) {
      const plan = residentTrips(town, day);
      for (const [id, trips] of plan)
        for (const trip of trips as ResidentTrip[]) {
          if (trip.event.outing !== 'market') continue;
          browsers++;
          const home = town.find((place) => place.id === id)!;
          const own = DISTRICT_SPOTS.market[trip.seat].facing;
          expect(tripState(home, trip, trip.arrive + 0.5, day).facing).toBe(own);
          expect(tripState(home, trip, trip.leave - 0.5, day).facing).toBe(own);
          let before = tripState(home, trip, trip.arrive, day).facing;
          for (let t = trip.arrive; t < trip.leave; t += 0.1) {
            const now = tripState(home, trip, t, day).facing;
            expect(now === before || QUARTER[before!].includes(now!), `${id} at ${t}`).toBe(true);
            before = now;
          }
        }
    }
    expect(browsers).toBeGreaterThanOrEqual(30);
  });
});

/** A bright warm colour: what the eye reads as lamplight (tests/district-render.test.ts). */
const amberLike = (colour: string) => {
  const AMBER = new Set([BRAND.lantern, BRAND.glow, BRAND.lanternInk].map((c) => c.toUpperCase()));
  if (AMBER.has(colour.toUpperCase().slice(0, 7))) return true;
  if (!/^#[0-9A-F]{6}/i.test(colour)) return false;
  const n = parseInt(colour.slice(1, 7), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return r >= 0xe0 && g >= 0xb0 && g <= 0xea && b <= 0xb8 && r - b >= 0x40;
};

describe('The paper bag', () => {
  const sample = town[0].resident;
  const drawn = (variant: number, night = false) => {
    const { ctx, calls } = recordingContext();
    paperBagSprite.draw(ctx, 0, 0, variant, sample, night);
    return calls.filter((call) => call.name === 'fillRect');
  };

  it('is carried home from the market only, topped by the day’s market', () => {
    const carry = outingOf('market')!.carry!;
    expect(carry).toMatchObject({ kind: 'paper-bag', leg: 'returning' });
    for (const day of YEAR.slice(0, 9))
      expect(carry.variant(day, 'anyone')).toBe(MARKET_KINDS.indexOf(marketKind(day)));
    // Greens, stems and a book's corner: three different tops over the same bag.
    const tops = [0, 1, 2].map((variant) =>
      drawn(variant)
        .map((call) => String(call.fillStyle))
        .join(','),
    );
    expect(new Set(tops).size).toBe(3);
  });

  it('sits in the crook of the near arm and stays within its own height above the hand', () => {
    for (const variant of [0, 1, 2]) {
      const top = Math.min(...drawn(variant).map((call) => Number(call.args[1])));
      expect(-top).toBeLessThanOrEqual(paperBagSprite.height);
      expect(-top).toBeGreaterThanOrEqual(PAPER_BAG.height);
      for (const call of drawn(variant)) {
        const [x, , w] = call.args as number[];
        expect(x).toBeGreaterThanOrEqual(-PAPER_BAG.width / 2 - 1);
        expect(x + w).toBeLessThanOrEqual(PAPER_BAG.width / 2 + 1);
      }
    }
    // Facing the camera it rides in front at the hip; walking away the body hides most of it.
    expect(paperBagSprite.grip('se', 0)).toEqual({ anchor: { x: 5, y: -4 }, behind: false });
    expect(paperBagSprite.grip('sw', 0)).toEqual({ anchor: { x: 5, y: -4 }, behind: false });
    expect(paperBagSprite.grip('ne', 0)).toEqual({ anchor: { x: 6, y: -4 }, behind: true });
    expect(paperBagSprite.grip('nw', 0.25).anchor.y).toBe(-5);
  });

  it('dims at night like its carrier and is never amber', () => {
    for (const variant of [0, 1, 2]) {
      const day = drawn(variant).map((call) => String(call.fillStyle));
      const night = drawn(variant, true).map((call) => String(call.fillStyle));
      expect(night).not.toEqual(day);
      for (const colour of [...day, ...night]) expect(amberLike(colour), colour).toBe(false);
    }
  });
});

describe('The market’s panel', () => {
  const day = YEAR[2];
  const home = town[0];
  const at = (phase: NonNullable<ResidentState['event']>['phase'], who = home): ResidentState =>
    ({
      id: who.id,
      resident: who.resident,
      home: who,
      position: { x: 56, y: 16 },
      activity: 'stroll',
      moving: phase !== 'attending',
      facing: 'ne',
      walkPhase: 0,
      greeting: false,
      event: { id: 'market', name: 'Market', phase },
    }) as ResidentState;
  const html = (minutes: number, residents: ResidentState[] = []) =>
    renderToStaticMarkup(
      createElement(MarketInfo, { day, minutes, residents, places: town, onFollow: () => {} }),
    );
  /** The words a reader sees, without the markup. */
  const text = (minutes: number, residents: ResidentState[] = []) =>
    html(minutes, residents)
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&');

  it('shows the eyebrow, the heading, today’s market and the hours', () => {
    const page = text(600);
    expect(page).toContain(PANEL_COPY.market.eyebrow);
    expect(page).toContain('Market Square.');
    expect(page).toContain(DISTRICT_COPY.market.name(day));
    expect(page).toContain(DISTRICT_COPY.market.description(day));
    expect(page).toContain('Open 08:00–11:30. Browsers walk home with a paper bag.');
    expect(page).not.toMatch(/!/);
  });

  it('names the browsers only while they are at the stalls, and nobody else', () => {
    const other = town[1];
    const page = html(600, [at('attending'), at('going', other)]);
    expect(page).toContain(home.resident.name);
    expect(page).not.toContain(other.resident.name);
    expect(page).toContain(DISTRICT_COPY.market.labels.attending);
    expect(browsingNow([at('returning'), at('going')])).toEqual([]);
  });

  it('says nothing about a crowd when nobody is there', () => {
    const page = text(600);
    expect(page).not.toMatch(/neighbou?r|nobody|no one|quiet|empty|\b0\b|AT THE STALLS/i);
  });

  it('says when the next market opens once this one has closed', () => {
    expect(html(700)).toContain(PANEL_COPY.market.next);
    expect(html(1400)).toContain(PANEL_COPY.market.next);
    expect(html(300)).not.toContain(PANEL_COPY.market.next);
    expect(html(600)).not.toContain(PANEL_COPY.market.next);
    expect(html(300)).toContain('LATER TODAY');
    expect(html(600)).toContain('HAPPENING NOW');
    expect(html(700)).toContain('FINISHED TODAY');
  });

  it('runs its status on the clock, as the event card does, and names who is there', () => {
    const market = districtEvents(day, 600).find((event) => event.id === 'market')!;
    const card: Record<string, string> = {
      'Later today': 'later',
      'Happening now': 'open',
      'Finished today': 'closed',
    };
    for (let minutes = 0; minutes < 1440; minutes += 5)
      expect(marketStatus(minutes), `${minutes}`).toBe(card[eventStatus(market, minutes)]);
    // An early browser at 07:48 and a lingering one at 11:40 are named, under the clock's status.
    const early = text(468, [at('attending')]);
    expect(early).toContain('LATER TODAY');
    expect(early).toContain(home.resident.name);
    const lingering = html(700, [at('attending')]);
    expect(lingering).toContain('FINISHED TODAY');
    expect(lingering).toContain(PANEL_COPY.market.next);
    expect(lingering).toContain(home.resident.name);
  });
});

describe('The district panels’ names', () => {
  it('lists neighbors by name in English, whatever the viewer’s language, then by id', () => {
    // Market Square, the Bandstand, the Landing and the farm all sort with byNeighborName.
    const names = ['Jon', 'Ylva', 'Ivy', 'Chloe', 'Hugo', 'Aase', 'Zoe', 'yuda'];
    const neighbors = names.map(
      (name, i) => ({ id: `home-${i}`, resident: { name } }) as unknown as ResidentState,
    );
    const sorted = [...neighbors].sort(byNeighborName).map((neighbor) => neighbor.resident.name);
    expect(sorted).toEqual(['Aase', 'Chloe', 'Hugo', 'Ivy', 'Jon', 'Ylva', 'yuda', 'Zoe']);
    // These languages would each order the same names otherwise.
    for (const locale of ['lt', 'da', 'cs', 'haw'])
      expect(
        [...names].sort((a, b) => a.localeCompare(b, locale)),
        locale,
      ).not.toEqual(sorted);
    // Two neighbors with one name stay two rows, in id order.
    const twins = [
      { id: 'b', resident: { name: 'Jon' } },
      { id: 'a', resident: { name: 'Jon' } },
    ] as unknown as ResidentState[];
    expect(twins.sort(byNeighborName).map((twin) => twin.id)).toEqual(['a', 'b']);
  });
});
