// The Bandstand's music (agent C, SPEC §4.2): one arrangement for each band, played only while the
// Bandstand is on screen and the camera is close (bandstandListening), scaled by its gain. score.ts
// adds the three ids to TrackId and reads both exports below; the music render worker reaches this
// file through score.ts, so it imports nothing but types.
// No Math.random, Date.now or performance.now.
import type { Band } from '../lib/district-calendar';
import type { Note } from './score';

/** The Soundtrack's title line and tempo for each band's tune. */
export const BANDSTAND_TRACKS: Record<Band, { title: string; subtitle: string; bpm: number }> = {
  brass: { title: 'Brass at the Bandstand', subtitle: 'A tuba, two cornets and a drum', bpm: 86 },
  folk: { title: 'Folk on the Riverbank', subtitle: 'A fiddle and a squeezebox', bpm: 86 },
  strings: {
    title: 'A String Trio by the River',
    subtitle: 'Three chairs, three strings',
    bpm: 86,
  },
};

/**
 * A band's 16-bar arrangement (BEATS beats, like every track). Foundation stub: undefined, so
 * score.ts plays today's acoustic notes for every band.
 */
export function composeBandstand(_band: Band): Note[] | undefined {
  return undefined;
}
