import { AUTUMN, SPRING, SUMMER, WINTER } from './seasons';
import { DAYS_PER_YEAR } from './town-calendar';

// The almanac's words for the turning year. seasons.ts holds the facts; this file holds the voice.
// Each line names something a visitor can find in town that day, so the stages follow the model's
// own schedules (tests/season-copy.test.ts holds them to it). They start at midnight, so the line
// turns with the almanac's date and never flickers during a day.

export type SeasonStage = {
  /** The whole year day the stage starts on, 0..111. */
  from: number;
  /** The year day it ends before. */
  to: number;
  note: string;
};

/** The whole year, in order, with no gaps. */
export const SEASON_NOTES: readonly SeasonStage[] = [
  // Spring: bare twigs leaf out, the flowering trees bloom, then shed their petals.
  { from: SPRING, to: SPRING + 4, note: 'The first green on bare branches.' },
  { from: SPRING + 4, to: SPRING + 19, note: 'Blossom on the branches.' },
  { from: SPRING + 19, to: SPRING + 26, note: 'Petals on the paths.' },
  { from: SPRING + 26, to: SUMMER, note: 'Everything in leaf.' },
  // Summer: fireflies from the third night. Their last nights run into the first days of autumn,
  // before any tree has turned.
  { from: SUMMER, to: SUMMER + 2, note: 'Long days ahead.' },
  { from: SUMMER + 2, to: SUMMER + 25, note: 'Fireflies after dark.' },
  { from: SUMMER + 25, to: AUTUMN + 2, note: 'The last warm nights.' },
  // Autumn: the trees turn ochre, deepen to russet, then let go. Amber is for light, not leaves.
  { from: AUTUMN + 2, to: AUTUMN + 6, note: 'The first leaves are turning.' },
  { from: AUTUMN + 6, to: AUTUMN + 15, note: 'Ochre trees and pumpkins on the steps.' },
  { from: AUTUMN + 15, to: AUTUMN + 22, note: 'Russet trees and pumpkins on the steps.' },
  { from: AUTUMN + 22, to: WINTER, note: 'Leaves on the lawns.' },
  // Winter: the first snow settles over Winter 1–2 and thaws over Winter 24–28.
  { from: WINTER, to: WINTER + 2, note: 'The first snow.' },
  { from: WINTER + 2, to: WINTER + 23, note: 'Snow on the rooftops.' },
  { from: WINTER + 23, to: DAYS_PER_YEAR, note: 'The thaw.' },
];

/** One line for the almanac: what a visitor can see in town on this day of the year. It wraps
 * like yearDayAt, so 112 is Spring 1 again and callers never need to mod. */
export function seasonNote(yearDay: number) {
  const day = ((yearDay % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  return (SEASON_NOTES.find((stage) => day < stage.to) ?? SEASON_NOTES[0]).note;
}
