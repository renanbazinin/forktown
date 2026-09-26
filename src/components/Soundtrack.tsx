import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import { TRACKS, type TrackId } from '../music/score';
import { TownPlayer } from '../music/player';
import { footballSoundsBetween } from '../music/football-sound';
import type { FootballState } from '../lib/football';
import type { cinemaAt } from '../lib/cinema';

export default function Soundtrack({
  track,
  playing,
  football,
  listening,
  cinema,
  cinemaListening,
  autoStart = false,
  hideControls = false,
}: {
  track: TrackId;
  playing: boolean;
  football: FootballState;
  listening: { gain: number; pan: number };
  cinema: ReturnType<typeof cinemaAt>;
  cinemaListening: { gain: number; pan: number };
  autoStart?: boolean;
  hideControls?: boolean;
}) {
  const player = useRef<TownPlayer | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [volume, setVolume] = useState(0.55);
  const [hidden, setHidden] = useState(document.hidden);
  const request = useRef(0);
  const previousMatch = useRef<FootballState | null>(null);
  const audible = enabled && playing && !hidden && cinemaListening.gain >= 0.005;
  const audibleFilm = audible ? (cinema.slot?.film ?? cinema.slot?.ad) : undefined;
  const audibleTitle = cinema.slot?.film?.title ?? cinema.slot?.ad?.sponsor;
  useEffect(() => {
    const film = cinema.slot?.film ?? cinema.slot?.ad;
    player.current?.cinemaSound(
      enabled && playing && !hidden && film
        ? {
            film,
            elapsed: cinema.elapsed,
            // An ad can play twice in one night, so the key includes where it starts.
            key: `${cinema.program.day}:${cinema.slot!.start}:${film.id}`,
            ...cinemaListening,
          }
        : undefined,
    );
  }, [cinema, cinemaListening, enabled, playing, hidden]);
  useEffect(() => {
    if (!enabled || !playing || hidden || !football.live || listening.gain < 0.015) {
      previousMatch.current = null;
      player.current?.silenceEffects();
      return;
    }
    for (const sound of footballSoundsBetween(previousMatch.current, football))
      player.current?.effect(sound.kind, listening.gain * sound.strength, listening.pan);
    previousMatch.current = football;
  }, [football, enabled, playing, hidden, listening]);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      ++request.current;
      player.current?.dispose();
      player.current = null;
    };
  }, []);
  useEffect(() => {
    if (!autoStart) return;
    // Capture pages request sound immediately. Browsers may defer resume until a gesture.
    const start = () => {
      try {
        player.current ??= new TownPlayer();
        player.current.volume(volume);
        setEnabled(true);
        void player.current.resume().catch(() => {});
      } catch {
        // Leave the gesture listener installed so a later attempt can recover.
      }
    };
    start();
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, [autoStart, volume]);
  useEffect(() => {
    if (!player.current) return;
    let cancelled = false;
    if (!enabled) {
      player.current.stop();
      setLoading(false);
      return;
    }
    if (hidden || !playing) {
      void player.current.suspend().catch(() => {});
      return;
    }
    setLoading(true);
    void player.current
      .resume()
      .then(() => {
        if (!cancelled) return player.current?.play(track);
      })
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Sound could not start. Try turning it on again.');
          setEnabled(false);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [track, enabled, playing, hidden]);
  const toggle = async () => {
    if (enabled) {
      ++request.current;
      setEnabled(false);
      return;
    }
    const revision = ++request.current;
    setError('');
    try {
      player.current ??= new TownPlayer();
      // Resume inside the click, including on browsers with strict autoplay rules.
      await player.current.resume();
      if (revision !== request.current) return;
      player.current.volume(volume);
      setEnabled(true);
    } catch {
      setError('Sound is unavailable in this browser.');
    }
  };
  if (hideControls) return null;
  return (
    <div className="town-sound">
      <button
        aria-label="Town sound"
        aria-expanded={open}
        title={enabled ? (audible && audibleTitle) || TRACKS[track].title : 'Turn on town sound'}
        onClick={() => setOpen(!open)}
      >
        {enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      {open && (
        <section
          className="sound-popover"
          aria-label="Town soundtrack"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <div className="sound-heading">
            <span>FORKTOWN FM</span>
            <button aria-label="Close sound controls" onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>
          <strong>{(audibleFilm && audibleTitle) || TRACKS[track].title}</strong>
          <p>
            {audibleFilm
              ? cinema.slot?.ad
                ? 'A word from around town'
                : 'Original movie score and sound effects'
              : TRACKS[track].subtitle}
          </p>
          <p className="sound-field-note">
            Zoom into the cinema for movie music and sound effects, or the football for kicks,
            whistles, and cheers.
          </p>
          <button className="sound-toggle" onClick={() => void toggle()} aria-pressed={enabled}>
            {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {enabled ? 'Sound on' : 'Turn sound on'}
          </button>
          <label className="sound-volume">
            Volume
            <input
              aria-label="Town volume"
              type="range"
              min="0"
              max="100"
              value={Math.round(volume * 100)}
              onChange={(event) => {
                const value = Number(event.target.value) / 100;
                setVolume(value);
                player.current?.volume(value);
              }}
            />
          </label>
          <small role="status">
            {error ||
              (audibleFilm && player.current?.cinemaStatus === 'error'
                ? 'Movie sound could not load. Turn sound off and on to retry.'
                : audibleFilm && player.current?.cinemaStatus === 'preparing'
                  ? 'Preparing movie soundtrack…'
                  : '') ||
              (enabled
                ? !playing
                  ? 'Paused with the town'
                  : loading
                    ? 'Warming up the band…'
                    : 'Original music, made for this little town.'
                : 'A little music, when you want it.')}
          </small>
        </section>
      )}
    </div>
  );
}
