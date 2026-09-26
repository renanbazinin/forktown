import { cinemaAt, CINEMA_FILMS, CINEMA_PLOTS, type CinemaFilm } from '../lib/cinema';
import { timeLabel } from '../lib/simulation';

const COUNT = ['No films', 'One film', 'Two films', 'Three films'];
const running = (seconds: number) =>
  seconds % 60 ? `${Math.floor(seconds / 60)} MIN ${seconds % 60} S` : `${seconds / 60} MIN`;
const billing = (film: CinemaFilm) =>
  [film.genre?.toUpperCase(), running(film.duration), film.rating].filter(Boolean).join(' · ');

export default function CinemaInfo({ minutes, day }: { minutes: number; day: number }) {
  const state = cinemaAt(minutes, day);
  const { program } = state;
  const adSeconds = program.ads.reduce((total, ad) => total + ad.duration, 0);
  /** The sponsors in the run of ads starting at slot `index`. */
  const adBreak = (index: number) => {
    const sponsors: string[] = [];
    for (let i = index; program.slots[i]?.ad; i++) sponsors.push(program.slots[i].ad!.sponsor);
    return sponsors;
  };
  return (
    <div className="venue-info">
      <span className="quiet-label">PUBLIC SPACE · {CINEMA_PLOTS.join(' / ')}</span>
      <div className="venue-program">
        <span className="eyebrow">
          {state.live ? 'ON THE SCREEN NOW' : 'TONIGHT UNDER THE STARS'}
        </span>
        <h3>
          {state.slot?.film?.title ??
            (state.slot?.ad
              ? `A word from ${state.slot.ad.sponsor}`
              : state.slot?.kind === 'closing'
                ? 'That’s a wrap.'
                : state.live
                  ? 'A little cinema break'
                  : `${COUNT[program.films.length]}. One lovely night.`)}
        </h3>
        <p>
          A seat on the lawn, a warm light, and original stories from one to three minutes long. The
          program starts at {timeLabel(program.start)} and ends at {timeLabel(program.end)}.
        </p>
        <p className="muted-copy">
          {adSeconds
            ? `${adSeconds} seconds of ads from around town fill the gap between stories.`
            : 'Tonight’s films fill the whole night, so there are no ads.'}
        </p>
        <p className="muted-copy">
          Turn on town sound and zoom into the screen to hear each film’s music and sound effects.
        </p>
      </div>
      {program.slots.map((slot, index) =>
        slot.film ? (
          <div className="venue-program" key={slot.film.id}>
            <span className="eyebrow">
              {billing(slot.film)} · {timeLabel(slot.start)}
            </span>
            <h3>{slot.film.title}</h3>
            <p>{slot.film.description}</p>
          </div>
        ) : slot.ad && program.slots[index - 1]?.kind !== 'ad' ? (
          <p className="muted-copy" key={`ads-${slot.start}`}>
            Ad break at {timeLabel(slot.start)}: {adBreak(index).join(' · ')}
          </p>
        ) : null,
      )}
      <p className="muted-copy">
        Films are picked from {CINEMA_FILMS.length} Forktown originals each town night, some for
        everyone and some for 14+. Everyone shares the same program, even after a refresh. Night
        owls can take a seat; the screen plays even on quiet evenings.
      </p>
    </div>
  );
}
