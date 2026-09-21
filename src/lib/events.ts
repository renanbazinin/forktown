import { getPlot, hash, PLOTS } from './world.ts';
import { isFootballPlot } from './football.ts';

// Public venues belong to the town, outside the one-house contribution files.
export const VENUES = [
  { id: 'green', plot: 'C5', name: 'The Lunch Green', kind: 'green' },
  { id: 'stage', plot: 'B5', name: 'The Little Stage', kind: 'stage' },
] as const;
export type Venue = (typeof VENUES)[number];
export type EventPose = 'sit' | 'read' | 'sip' | 'chat' | 'play' | 'cheer' | 'sway' | 'dance';
type EventSpot = { x: number; y: number; facing: 'se' | 'sw' | 'ne' | 'nw' };
// Coordinates relative to the plot center. These are usable lawn spots, not a street queue.
// Keep the stage audience in front of the platform (which ends at local y = 0.2).
export const EVENT_SPOTS: Record<Venue['kind'], readonly EventSpot[]> = {
  green: [
    { x: -0.55, y: 0, facing: 'se' },
    { x: 0.35, y: 0, facing: 'sw' },
    { x: -0.55, y: 0.85, facing: 'ne' },
    { x: 0.45, y: 0.9, facing: 'nw' },
    { x: -1.25, y: -0.55, facing: 'se' },
    { x: 1.1, y: 1.25, facing: 'nw' },
  ],
  stage: [
    { x: -0.15, y: 0.7, facing: 'ne' },
    { x: -0.5, y: 1.35, facing: 'ne' },
    { x: 0.55, y: 0.65, facing: 'ne' },
    { x: 0.9, y: 1.35, facing: 'ne' },
    { x: -0.85, y: 0.65, facing: 'ne' },
    { x: 0.2, y: 1.3, facing: 'ne' },
    { x: 1.25, y: 0.7, facing: 'ne' },
    { x: -1.2, y: 1.3, facing: 'ne' },
  ],
};
export function eventSpot(venue: Venue, index: number) {
  const plot = getPlot(venue.plot)!;
  const spot = EVENT_SPOTS[venue.kind][index];
  return { position: { x: plot.x + 0.5 + spot.x, y: plot.y + 0.5 + spot.y }, facing: spot.facing };
}
export function insideVenue(venue: Venue, point: { x: number; y: number }) {
  const plot = getPlot(venue.plot)!;
  return Math.abs(point.x - plot.x - 0.5) <= 1.5 && Math.abs(point.y - plot.y - 0.5) <= 1.5;
}
export const venueAt = (plot: string) => VENUES.find((venue) => venue.plot === plot);
export const HOUSE_PLOTS = PLOTS.filter((plot) => !venueAt(plot.id) && !isFootballPlot(plot.id));

export const EVENT_CHOICES = {
  afternoon: [
    {
      id: 'picnic',
      name: 'Bring-a-blanket picnic',
      description: 'A long lunch, a little sunshine, and a hello across the green.',
    },
    {
      id: 'books',
      name: 'Books & lemonade',
      description: 'Trade a story and stay for a glass of something sweet.',
    },
    {
      id: 'games',
      name: 'Lawn games club',
      description: 'A friendly afternoon of games. No score worth keeping.',
    },
  ],
  evening: [
    {
      id: 'rock',
      name: 'Little town, loud guitars',
      description: 'Tonight’s tiny rock concert. Big riffs, small stage.',
    },
    {
      id: 'acoustic',
      name: 'Golden-hour acoustic',
      description: 'Warm lights, wooden guitars, and a quiet evening together.',
    },
    {
      id: 'jazz',
      name: 'Jazz under the stars',
      description: 'A little swing drifting through the neighborhood.',
    },
  ],
} as const;
export type TownEvent = {
  id: string;
  name: string;
  description: string;
  venue: Venue;
  period: 'afternoon' | 'evening' | 'night';
  depart: number;
  start: number;
  end: number;
  homeBy: number;
};

export function eventsForDay(day: number): TownEvent[] {
  const daytime = (['afternoon', 'evening'] as const).map((period, index) => {
    const choices = EVENT_CHOICES[period];
    const choice = choices[hash(`forktown-event:${Math.floor(day)}:${period}`) % choices.length];
    return {
      ...choice,
      period,
      venue: VENUES[index],
      depart: index ? 1080 : 720,
      start: index ? 1140 : 780,
      end: index ? 1260 : 960,
      homeBy: index ? 1310 : 1070,
    };
  });
  return [
    ...daytime,
    {
      id: 'night-party',
      name: 'Midnight at the Little Stage',
      description:
        'A little disco for the night owls. Warm lights, dancing feet, and one more song.',
      venue: VENUES[1],
      period: 'night',
      depart: 1350,
      start: 1410,
      end: 1590,
      homeBy: 1710,
    },
  ];
}
// Night events use the evening's timeline: 02:30 is minute 1590, not 150.
// Every consumer (travel, artwork, labels, and music) shares this midnight rule.
export function eventMinutes(event: TownEvent, minutes: number) {
  const time = ((minutes % 1440) + 1440) % 1440;
  return event.period === 'night' && time < 360 ? time + 1440 : time;
}
export function isEventLive(event: TownEvent, minutes: number) {
  const time = eventMinutes(event, minutes);
  return time >= event.start && time < event.end;
}
export function eventAtVenue(events: TownEvent[], venueId: string, minutes: number) {
  const program = events.filter((event) => event.venue.id === venueId);
  return (
    program.find((event) => {
      const time = eventMinutes(event, minutes);
      return time >= event.depart && time < event.homeBy;
    }) ??
    program.find((event) => eventMinutes(event, minutes) < event.end) ??
    program.at(-1)
  );
}
export function eventStatus(event: TownEvent, minutes: number) {
  const time = eventMinutes(event, minutes);
  return time < event.start
    ? event.period === 'night'
      ? 'Later tonight'
      : 'Later today'
    : time < event.end
      ? 'Happening now'
      : 'Finished today';
}
// Validate configuration early, including after changing the world dimensions.
for (const venue of VENUES)
  if (!getPlot(venue.plot)) throw new Error(`Public venue ${venue.name} needs plot ${venue.plot}.`);
