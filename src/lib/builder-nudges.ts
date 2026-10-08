import type { HouseDesign } from './schema';
import { getPlot, hash } from './world';

// The builder asks a question instead of offering a story, so new houses arrive with their own.
export const STORY_PROMPTS = [
  'What would a neighbor find on your porch?',
  'What is this house for, really?',
  'What should visitors never do here?',
  'What drifts out of the window at night?',
  'Who is always welcome here, and why?',
  'What would you leave on the step for the next person?',
] as const;

/** The same draft always asks the same question. */
export const storyPrompt = (seed: string) =>
  STORY_PROMPTS[hash(`story-prompt:${seed}`) % STORY_PROMPTS.length];

/** The builder stops at two floors. Homes already in town with a third keep it. */
export const restoreDraftDesign = (design: HouseDesign): HouseDesign =>
  design.floors > 2 ? { ...design, floors: 2 } : design;

/**
 * A saved draft keeps its plot unless that plot was taken or reserved since. Then it moves to the
 * nearest open plot (the first of equally near ones), so it stays in the part of town it chose.
 */
export function restoreDraftPlot(plot: string, available: readonly { id: string }[]) {
  if (available.some((candidate) => candidate.id === plot)) return plot;
  const from = getPlot(plot);
  const distance = (id: string) => {
    const to = getPlot(id);
    return from && to ? (to.col - from.col) ** 2 + (to.row - from.row) ** 2 : 0;
  };
  let nearest = available[0];
  for (const candidate of available)
    if (distance(candidate.id) < distance(nearest.id)) nearest = candidate;
  return nearest?.id ?? 'A1';
}
