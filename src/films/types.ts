import type { CinemaAd, CinemaFilm } from '../lib/cinema';
import type { FilmCue } from '../music/cinema-score';
import type { AdLook, Ctx, Look } from './kit';

/** One Starlight Reel film: its pictures, its score, and its title-card look. */
export type FilmModule = {
  /**
   * Paints one frame. `p` is story time from 0 to 1 (the titles hold 0 and 1); `seconds`
   * is the film's own clock, for idle motion like blinking, rain, and waves.
   */
  draw: (ctx: Ctx, p: number, seconds: number) => void;
  score: (film: CinemaFilm) => FilmCue[];
  look: Look;
};

/**
 * One ad between films: its pictures and its jingle. Ads have no title cards; the projector
 * lays the sponsor slate over the last `slateSeconds` of the spot.
 */
export type AdModule = {
  /** Paints one frame. `p` runs from 0 to 1 across the whole spot; `seconds` is its own clock. */
  draw: (ctx: Ctx, p: number, seconds: number) => void;
  score: (ad: CinemaAd) => FilmCue[];
  /** The closing sponsor slate, painted over the last few seconds by the projector. */
  look: AdLook;
};
