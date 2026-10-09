import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SeasonalErrandCard from '../src/components/SeasonalErrandCard';
import { errandAction, seasonalErrandCard } from '../src/lib/errand-copy';
import { places } from '../src/lib/places';
import { residentErrands, type ErrandKind, type ErrandTrip } from '../src/lib/seasonal-errands';
import { CALENDAR_EPOCH_DAY, DAYS_PER_YEAR } from '../src/lib/town-calendar';
import { withPreview } from '../src/lib/resident-trips';
import { HOUSE_PLOTS } from '../src/lib/events';
import type { Place } from '../src/lib/schema';
import { unescapeHtml } from './markup';

const YEAR = CALENDAR_EPOCH_DAY + 2 * DAYS_PER_YEAR;
const noop = () => {};
const render = (minutes: number, day: number, roster = places) =>
  renderToStaticMarkup(
    createElement(SeasonalErrandCard, {
      places: roster,
      minutes,
      day,
      onFollow: noop,
      onVisit: noop,
    }),
  );
const samples = [0, 1, 2, 3].map((season) => {
  for (let date = 0; date < 28; date++) {
    const day = YEAR + season * 28 + date;
    const trip = [...residentErrands(places, day).values()].flat()[0];
    if (trip) return { day, trip };
  }
  throw new Error(`The published roster has no representative errand in season ${season}.`);
});
const middle = (trip: ErrandTrip, phase: ErrandTrip['segments'][number]['phase']) => {
  const segment = trip.segments.find((part) => part.phase === phase)!;
  return (segment.start + segment.end) / 2;
};
const carried: Record<ErrandKind, string> = {
  seedlings: 'carrying seedlings to the Lantern Fork',
  lemonade: 'carrying lemonade to the Little Stage',
  harvest: 'carrying the harvest basket to the Lunch Green',
  thermos: 'carrying warm drinks to the Millpond',
};

describe('seasonal errand card', () => {
  it('shows the actual route and named carrier during every season’s journey', () => {
    expect(samples.map(({ trip }) => trip.ritual.kind)).toEqual([
      'seedlings',
      'lemonade',
      'harvest',
      'thermos',
    ]);
    for (const { day, trip } of samples) {
      const time = middle(trip, 'carrying');
      const name = places.find((place) => place.id === trip.residentId)!.resident.name;
      const copy = seasonalErrandCard(places, time, day);
      expect(copy.body).toBe(`${name} is ${carried[trip.ritual.kind]}.`);
      expect(copy.route).toBe(`${trip.ritual.pickup.name} → ${trip.ritual.delivery.name}`);
      const html = render(time, day);
      // Decoded, as a reader hears it: React escapes a carrier named "D'Arcy & Bea".
      expect(unescapeHtml(html)).toContain(`Follow ${name}`);
      expect(html).toContain('Happening now');
      expect(html).toContain('is-live');
      expect(html).toContain(`Visit ${trip.ritual.delivery.name}`);
      expect(html).toContain('town time');
      expect(html).not.toContain('aria-live');
      expect(html).not.toMatch(
        /<button[^>]*>[\s\S]*<button[^>]*>[\s\S]*<\/button>[\s\S]*<\/button>/,
      );
    }
  });

  it('uses the planner’s exact half-open phase boundaries, including the walk home', () => {
    for (const { day, trip } of samples) {
      for (const segment of trip.segments) {
        const copy = seasonalErrandCard(places, segment.start, day);
        expect(copy.phase).toBe(segment.phase);
        expect(copy.live).toBe(true);
        const label = errandAction(trip.ritual.kind, segment.phase);
        expect(copy.body).toContain(`${label[0].toLowerCase()}${label.slice(1)}`);
        const html = render(middle(trip, segment.phase), day);
        expect(html).toContain('Happening now');
        expect(html).toContain('Follow ');
      }
      expect(seasonalErrandCard(places, trip.depart - 0.01, day).status).toBe('Later today');
      const after = seasonalErrandCard(places, trip.homeBy, day);
      expect(after.status).toBe('Finished today');
      expect(after.live).toBe(false);
      expect(after.canFollow).toBe(false);
      expect(after.phase).toBeUndefined();
      expect(after.body).toMatch(/ finished the round\.$/);
      expect(after.body).not.toContain('is home');
      expect(render(trip.homeBy, day)).not.toContain('Follow ');
    }
  });

  it('counts town minutes as real seconds and never consults a running clock', () => {
    const { trip, day } = samples[0];
    expect(seasonalErrandCard(places, trip.depart - 30, day).body).toContain('in 30 seconds.');
    expect(seasonalErrandCard(places, trip.depart - 90, day).body).toContain('in about 2 minutes.');
    expect(seasonalErrandCard(places, trip.depart - 0.2, day).body).toContain('in 1 second.');
    const paused = render(trip.depart - 30, day);
    expect(render(trip.depart - 30, day)).toBe(paused);
  });

  it('previews the calendar day before dawn and normalizes equivalent timestamps', () => {
    for (let season = 0; season < 4; season++) {
      const day = YEAR + season * 28;
      const beforeDawn = seasonalErrandCard(places, 180, day);
      expect(beforeDawn.day).toBe(day);
      expect(beforeDawn.ritual.seasonIndex).toBe(season);
      expect(beforeDawn.live).toBe(false);
      expect(beforeDawn.status).not.toBe('Finished today');
      expect(seasonalErrandCard(places, 1620, day - 1)).toEqual(beforeDawn);
      expect(seasonalErrandCard(places, -1260, day + 1)).toEqual(beforeDawn);
    }
  });

  it('does not invent a carrier, time or follow button when no round fits', () => {
    const indoors: Place[] = places.map((place) => ({
      ...place,
      resident: {
        ...place.resident,
        routine: { morning: 'home', afternoon: 'home', evening: 'home', night: 'sleep' },
      },
    }));
    for (const roster of [[], indoors]) {
      const copy = seasonalErrandCard(roster, 600, YEAR);
      expect(copy.status).toBe('No round planned today');
      expect(copy.residentId).toBeUndefined();
      expect(copy.residentName).toBeUndefined();
      expect(copy.time).toBeUndefined();
      expect(copy.live).toBe(false);
      const html = render(600, YEAR, roster);
      expect(html).toContain('No neighbor has time for the full round today.');
      expect(html).not.toContain('Follow ');
      expect(html).not.toContain('is-live');
      expect(html).toContain('Visit ');
    }
  });

  it('keeps the published card when a builder preview joins the roster', () => {
    const plot =
      HOUSE_PLOTS.find((candidate) => !places.some((place) => place.plot === candidate.id)) ??
      HOUSE_PLOTS[0];
    // check:full-town has no vacancy. This test makes one in its own base roster, then compares
    // that same published town with and without a private draft in the available plot.
    const base = places.filter((place) => place.plot !== plot.id);
    const draft: Place = {
      ...places[0],
      id: 'errand-ui-draft',
      plot: plot.id,
      resident: {
        ...places[0].resident,
        routine: { morning: 'stroll', afternoon: 'stroll', evening: 'stroll', night: 'stroll' },
      },
    };
    const preview = withPreview(base, draft);
    for (const { day, trip } of samples)
      expect(render(middle(trip, 'carrying'), day, preview)).toBe(
        render(middle(trip, 'carrying'), day, base),
      );
  });

  it('escapes a carrier’s words as text in both the card and its accessible actions', () => {
    const roster = places.map((place) => ({
      ...place,
      resident: { ...place.resident, name: '<b>Milo</b> & May' },
    }));
    const { day, trip } = samples[1];
    const html = render(middle(trip, 'carrying'), day, roster);
    expect(html).toContain('&lt;b&gt;Milo&lt;/b&gt; &amp; May');
    expect(html).not.toContain('<b>Milo</b>');
  });
});
