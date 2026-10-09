// The town's newer instruments, for the tunes it plays through the day (src/music/tunes/), one
// family a file in this folder. Unlike render.ts's `voice`, a pure function of time per sample,
// each of these renders one whole note with state: modal resonators for struck bars, tines and
// piano strings, plucked strings (Karplus–Strong, tuned with a fractional all-pass), band-limited
// saws through state-variable filters for bowed and sung tones, and filtered noise for brushes,
// shakers and the night's crickets. Everything is synthesized here: no recordings or samples.
// Deterministic: noise comes from each note's own seed, so a tune renders the same everywhere.
// No Math.random or Date.

import type { Rendered, Strike } from './dsp';
import { epiano, felt } from './keys';
import { fingerbass, harp, nylon, upright } from './plucked';
import { kalimba, marimba, musicbox, vibes } from './bars';
import { choir, flute, glow, strings } from './sustained';
import { brush, ride, rim, shaker, softkick, swish, tick } from './drums';
import { birds, crickets, vinyl } from './ambience';

/** Every instrument a tune can write for, by name (a Note's `voice`). */
export const INSTRUMENTS = [
  'felt',
  'epiano',
  'nylon',
  'harp',
  'upright',
  'marimba',
  'vibes',
  'musicbox',
  'kalimba',
  'flute',
  'strings',
  'glow',
  'choir',
  'fingerbass',
  'softkick',
  'brush',
  'swish',
  'rim',
  'shaker',
  'ride',
  'tick',
  'vinyl',
  'crickets',
  'birds',
] as const;
export type Instrument = (typeof INSTRUMENTS)[number];
export const isInstrument = (voice: string): voice is Instrument =>
  (INSTRUMENTS as readonly string[]).includes(voice);

export type { Rendered, Strike };

const PLAYERS: Record<Instrument, (strike: Strike, sampleRate: number) => Rendered> = {
  felt,
  epiano,
  nylon,
  harp,
  upright,
  marimba,
  vibes,
  musicbox,
  kalimba,
  flute,
  strings,
  glow,
  choir,
  fingerbass,
  softkick,
  brush,
  swish,
  rim,
  shaker,
  ride,
  tick,
  vinyl,
  crickets,
  birds,
};

/** Renders one note on an instrument at unit gain, its release and ring included. */
export function playInstrument(
  instrument: Instrument,
  strike: Strike,
  sampleRate: number,
): Rendered {
  return PLAYERS[instrument](strike, sampleRate);
}
