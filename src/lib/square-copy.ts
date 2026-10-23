import { SQUARE_PLOTS } from './square';

// Fountain Square's words. square.ts holds the facts; this file holds the voice. Brand rules:
// headings end with a period, eyebrows are uppercase, no exclamation marks, and the copy never
// promises a crowd or hints at what the square keeps to itself on even dates at 17:00. Only the
// neighbors dancing at this moment are ever named, and only while they dance.

export type SquareCopyBlock = { eyebrow: string; heading: string; body: string; note?: string };
export type SquareCopy = { label: string; blocks: SquareCopyBlock[]; footer: string };

export const SQUARE_LABEL = `PUBLIC SPACE · ${SQUARE_PLOTS[0]}–${SQUARE_PLOTS.at(-1)} · ${SQUARE_PLOTS.length} PLOTS`;

/** "Eliza is dancing.", "Eliza and Sol are dancing.", "5 neighbors are dancing." */
export function dancingNow(names: readonly string[]) {
  const named = names.map((name) => name.trim());
  if (named.some((name) => !name) || named.length > 2)
    return named.length === 1 ? '1 neighbor is dancing.' : `${named.length} neighbors are dancing.`;
  return named.length === 1
    ? `${named[0]} is dancing.`
    : `${named[0]} and ${named[1]} are dancing.`;
}

/** The panel for the neighbors dancing right now (none on most minutes of most days). */
export function squareCopy(dancers: readonly string[]): SquareCopy {
  const blocks: SquareCopyBlock[] = [];
  if (dancers.length)
    blocks.push({
      eyebrow: 'HAPPENING NOW',
      heading: 'Something is happening by the fountain.',
      body: dancingNow(dancers),
      note: 'Nobody said a word about it.',
    });
  blocks.push({
    eyebrow: 'THE FOUNTAIN',
    heading: 'Fountain Square.',
    body: 'Warm stone round a fountain, beside the Starlight Cinema. Two benches, three planters and the sound of water, all day and all night.',
  });
  return {
    label: SQUARE_LABEL,
    blocks,
    footer: 'Reserved for everyone. Sit by the water a while.',
  };
}
