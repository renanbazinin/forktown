import type { CinemaFilm } from '../lib/cinema';
import type { FilmCue } from '../music/cinema-score';
import type { Ctx, Look } from './kit';

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
